"""Supervisor: manage runner subprocesses for active bots."""

from __future__ import annotations

import logging
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

from django.core.management.base import BaseCommand

from apps.bots.models import BotInstance

logger = logging.getLogger(__name__)

RUNNER_SCRIPT = Path(__file__).resolve().parents[5] / "runner" / "runner" / "runner.py"
POLL_INTERVAL = 5


class Command(BaseCommand):
    help = "Supervise aiogram runner processes for active bots"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Map of bot_id -> subprocess.Popen
        self.processes: dict[int, subprocess.Popen] = {}
        # Map of bot_id -> open log file handle
        self.log_handles: dict[int, any] = {}

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("Starting bot supervisor..."))
        try:
            while True:
                self._reconcile()
                self._check_dead()
                time.sleep(POLL_INTERVAL)
        except KeyboardInterrupt:
            self._shutdown_all()

    def _reconcile(self) -> None:
        active_bots = BotInstance.objects.filter(is_active=True)
        active_ids = set()

        for bot in active_bots:
            active_ids.add(bot.id)
            if bot.id not in self.processes or self.processes[bot.id].poll() is not None:
                self._start_runner(bot)

        for bot_id in list(self.processes.keys()):
            if bot_id not in active_ids:
                self._stop_runner(bot_id)

    def _start_runner(self, bot: BotInstance) -> None:
        env = os.environ.copy()
        env["REDIS_URL"] = env.get("REDIS_URL", "redis://localhost:6379/0")
        env["BOT_TOKEN"] = bot.token

        # Ensure the project root is on PYTHONPATH so the 'runner' top-level package is importable
        project_root = Path(__file__).resolve().parents[5]
        existing_py = env.get("PYTHONPATH", "")
        env["PYTHONPATH"] = project_root.as_posix() + (os.pathsep + existing_py if existing_py else "")

        # Prepare logs directory for runner processes
        logs_dir = project_root / "logs" / "runners"
        try:
            logs_dir.mkdir(parents=True, exist_ok=True)
        except Exception:
            # best-effort; if it fails, continue without file logging
            logs_dir = None

        # Build command to run runner as a module
        cmd = [
            sys.executable,
            "-m",
            "runner.runner",
            "--bot-id",
            str(bot.id),
            "--token",
            bot.token,
        ]

        # Open log file and start subprocess with redirected stdout/stderr if possible
        logfile = None
        proc = None
        if logs_dir:
            log_path = logs_dir / f"runner_bot_{bot.id}.log"
            try:
                logfile = open(log_path, "a", encoding="utf-8", buffering=1)
                logfile.write(f"\n--- Starting runner for bot {bot.id} ({bot.name}) pid placeholder ---\n")
                proc = subprocess.Popen(cmd, env=env, stdout=logfile, stderr=logfile)
            except Exception:
                # fallback to starting without file redirection
                if logfile:
                    logfile.close()
                    logfile = None
                proc = subprocess.Popen(cmd, env=env)
        else:
            proc = subprocess.Popen(cmd, env=env)

        self.processes[bot.id] = proc
        if logfile:
            self.log_handles[bot.id] = logfile
            logfile.write(f"Started runner for bot {bot.id} ({bot.name}), pid={proc.pid}\n")
        self.stdout.write(f"Started runner for bot {bot.id} ({bot.name}), pid={proc.pid}")

    def _stop_runner(self, bot_id: int) -> None:
        proc = self.processes.pop(bot_id, None)
        log = self.log_handles.pop(bot_id, None)
        if proc and proc.poll() is None:
            proc.send_signal(signal.SIGTERM)
            try:
                proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                proc.kill()
            self.stdout.write(f"Stopped runner for bot {bot_id}")
        if log:
            try:
                log.write(f"Stopped runner for bot {bot_id}\n")
                log.flush()
                log.close()
            except Exception:
                pass

    def _check_dead(self) -> None:
        for bot_id, proc in list(self.processes.items()):
            if proc.poll() is not None:
                self.stdout.write(
                    self.style.WARNING(f"Runner for bot {bot_id} exited, restarting...")
                )
                # close and remove corresponding log handle if present
                log = self.log_handles.pop(bot_id, None)
                if log:
                    try:
                        log.write(f"Runner for bot {bot_id} exited with code {proc.returncode}\n")
                        log.flush()
                        log.close()
                    except Exception:
                        pass
                del self.processes[bot_id]

    def _shutdown_all(self) -> None:
        for bot_id in list(self.processes.keys()):
            self._stop_runner(bot_id)
        # ensure any remaining log handles are closed
        for log in list(self.log_handles.values()):
            try:
                log.close()
            except Exception:
                pass
        self.stdout.write("Supervisor stopped.")
