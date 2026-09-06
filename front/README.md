# Конструктор сценариев Telegram-бота (Frontend)

Визуальный редактор сценариев бота на React Flow. Работает с Django REST Framework API.

## Стек

- React 19 + TypeScript + Vite
- [@xyflow/react](https://reactflow.dev/) — граф-редактор
- [@tanstack/react-query](https://tanstack.com/query) — API, кеш, инвалидация
- Zustand — состояние редактора и тестового чата
- Zod — валидация форм узлов
- Tailwind CSS v4 — стилизация

## Быстрый старт

```bash
npm install
npm run dev      # http://localhost:5173, прокси /api → localhost:8000
npm run build    # dist/ для Django static
```

При первом открытии приложение перенаправит на `/login`. Демо-учётка (после `python manage.py seed_demo` на backend):

- **Логин:** `demo`
- **Пароль:** `demo1234`

## Переменные окружения

```env
# .env — пустое значение = same-origin /api (через Vite proxy в dev)
VITE_API_URL=
```

Для production-сборки, если SPA отдаётся с другого домена:

```env
VITE_API_URL=https://your-backend.example.com
```

## Интеграция с Django

1. Соберите фронтенд: `npm run build`
2. Скопируйте `dist/` в Django static (например `static/bot-builder/`)
3. Добавьте view, отдающую `index.html` для всех маршрутов SPA
4. В dev включите CORS на DRF для `http://localhost:5173`

## Маршруты SPA

| URL | Экран |
|-----|-------|
| `/login` | Вход |
| `/` | Список ботов |
| `/bots/:botId/scenarios` | Сценарии бота |
| `/scenarios/:scenarioId/edit` | Редактор графа |

## Структура проекта

```
src/
├── api/           # client + React Query hooks
├── components/    # nodes, forms, chat, ui
├── pages/         # BotList, ScenarioList, ScenarioEditor
├── store/         # Zustand
├── types/         # TypeScript типы API
└── utils/         # graphUtils, Zod-схемы
```

## API

Все данные через реальный DRF API (без моков). См. контракт в ТЗ.
