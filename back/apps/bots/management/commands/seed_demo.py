"""Seed demo data for local development."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.bots.models import BotInstance
from apps.scenarios.models import Node, Scenario, Transition
from apps.scenarios.services.menu_sync import sync_menu_transitions
from apps.scenarios.tasks import get_redis_client, publish_scenario_task

User = get_user_model()

DEMO_USERNAME = "demo"
DEMO_PASSWORD = "demo1234"
DEMO_BOT_NAME = "Demo Bot"


class Command(BaseCommand):
    help = "Create demo user, bot, and sample scenario for local development"

    def add_arguments(self, parser):
        parser.add_argument(
            "--publish",
            action="store_true",
            help="Publish scenario to Redis after seeding",
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete existing demo bot before seeding",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options["reset"]:
            BotInstance.objects.filter(name=DEMO_BOT_NAME).delete()
            User.objects.filter(username=DEMO_USERNAME).delete()
            self.stdout.write("Removed previous demo data.")

        user, user_created = User.objects.get_or_create(username=DEMO_USERNAME)
        if user_created:
            user.set_password(DEMO_PASSWORD)
            user.save()
            self.stdout.write(self.style.SUCCESS(f"Created user '{DEMO_USERNAME}' / '{DEMO_PASSWORD}'"))
        else:
            self.stdout.write(f"User '{DEMO_USERNAME}' already exists.")

        bot, bot_created = BotInstance.objects.get_or_create(
            owner=user,
            name=DEMO_BOT_NAME,
            defaults={
                "token": "0000000000:REPLACE_WITH_REAL_TELEGRAM_TOKEN",
                "is_active": False,
            },
        )
        if bot_created:
            self.stdout.write(self.style.SUCCESS(f"Created bot '{DEMO_BOT_NAME}' (id={bot.id})"))
        else:
            self.stdout.write(f"Bot '{DEMO_BOT_NAME}' already exists (id={bot.id}).")

        scenario, scenario_created = Scenario.objects.get_or_create(
            bot=bot,
            name="Welcome flow",
            defaults={"version": 1, "is_published": False},
        )
        if not scenario_created and scenario.nodes.exists():
            self.stdout.write(f"Scenario '{scenario.name}' already has nodes — skipping graph.")
            self._print_summary(user, bot, scenario)
            return

        if scenario_created:
            self.stdout.write(self.style.SUCCESS(f"Created scenario '{scenario.name}' (id={scenario.id})"))

        scenario.nodes.all().delete()

        start = Node.objects.create(
            scenario=scenario,
            key="start",
            type="message",
            config={"text": "👋 Привет! Это демо-сценарий конструктора ботов."},
            position={"x": 100, "y": 80},
        )
        ask_name = Node.objects.create(
            scenario=scenario,
            key="ask_name",
            type="question",
            config={
                "prompt": "Как вас зовут?",
                "var_name": "name",
                "validation": "any",
            },
            position={"x": 100, "y": 220},
        )
        greet = Node.objects.create(
            scenario=scenario,
            key="greet",
            type="message",
            config={"text": "Приятно познакомиться! Выберите действие:"},
            position={"x": 100, "y": 360},
        )
        menu = Node.objects.create(
            scenario=scenario,
            key="main_menu",
            type="menu",
            config={
                "text": "Главное меню",
                "buttons": [
                    {"text": "ℹ️ О боте", "callback": "about"},
                    {"text": "📞 Контакты", "callback": "contacts"},
                ],
            },
            position={"x": 100, "y": 500},
        )
        about = Node.objects.create(
            scenario=scenario,
            key="about",
            type="message",
            config={"text": "Это демо-бот, собранный в визуальном редакторе сценариев."},
            position={"x": 400, "y": 420},
        )
        contacts = Node.objects.create(
            scenario=scenario,
            key="contacts",
            type="message",
            config={"text": "Напишите нам: support@example.com"},
            position={"x": 400, "y": 580},
        )
        check_vip = Node.objects.create(
            scenario=scenario,
            key="check_vip",
            type="condition",
            config={},
            position={"x": 100, "y": 640},
        )
        vip_msg = Node.objects.create(
            scenario=scenario,
            key="vip",
            type="message",
            config={"text": "🌟 VIP-пользователь! Спасибо за лояльность."},
            position={"x": -120, "y": 780},
        )
        regular_msg = Node.objects.create(
            scenario=scenario,
            key="regular",
            type="message",
            config={"text": "Спасибо, что пользуетесь ботом!"},
            position={"x": 320, "y": 780},
        )

        Transition.objects.create(from_node=start, to_node=ask_name, trigger="always", priority=0)
        Transition.objects.create(from_node=ask_name, to_node=greet, trigger="always", priority=0)
        Transition.objects.create(from_node=greet, to_node=menu, trigger="always", priority=0)
        sync_menu_transitions(menu)
        menu_to_about = menu.transitions_out.get(trigger="callback", trigger_value="about")
        menu_to_about.to_node = about
        menu_to_about.save(update_fields=["to_node"])
        menu_to_contacts = menu.transitions_out.get(trigger="callback", trigger_value="contacts")
        menu_to_contacts.to_node = contacts
        menu_to_contacts.save(update_fields=["to_node"])
        Transition.objects.create(from_node=about, to_node=check_vip, trigger="always", priority=0)
        Transition.objects.create(from_node=contacts, to_node=check_vip, trigger="always", priority=0)
        Transition.objects.create(
            from_node=check_vip,
            to_node=vip_msg,
            trigger="condition",
            condition_expr='context.name == "VIP"',
            priority=10,
        )
        Transition.objects.create(
            from_node=check_vip,
            to_node=regular_msg,
            trigger="always",
            priority=0,
        )

        bot.default_scenario = scenario
        bot.save(update_fields=["default_scenario"])

        self.stdout.write(self.style.SUCCESS("Demo scenario graph created."))

        if options["publish"]:
            scenario.version += 1
            scenario.is_published = True
            scenario.save(update_fields=["version", "is_published", "updated_at"])
            try:
                publish_scenario_task(scenario.id)
                self.stdout.write(self.style.SUCCESS(f"Published to Redis (version={scenario.version})."))
            except Exception as exc:
                self.stdout.write(
                    self.style.WARNING(f"Publish skipped — Redis unavailable: {exc}")
                )

        self._print_summary(user, bot, scenario)

    def _print_summary(self, user, bot, scenario) -> None:
        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("Demo credentials"))
        self.stdout.write(f"  User:     {user.username} / {DEMO_PASSWORD}")
        self.stdout.write(f"  Bot id:   {bot.id}")
        self.stdout.write(f"  Scenario: {scenario.id} — {scenario.name}")
        self.stdout.write("")
        self.stdout.write("Login to Django admin or use session auth for /api/")
        self.stdout.write("Frontend: npm run dev → http://localhost:5173")
