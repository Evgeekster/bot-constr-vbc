# Bot Constructor Monorepo

Telegram bot scenario constructor: Django constructor, aiogram runners, React frontend.

## Structure

- `back/` — Django + DRF constructor (Postgres source of truth)
- `runner/` — aiogram bot runners (read snapshots from Redis)
- `front/` — React Flow editor

## Local development

```bash
# Infrastructure
docker compose up -d postgres redis

# Dependencies (from repo root)
uv pip install -e ".[dev]"

# Generate Fernet key (once)
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Migrate & run
cd back
cp .env.example .env  # edit FERNET_KEY
python manage.py migrate
python manage.py seed_demo          # demo user + bot + scenario
python manage.py seed_demo --publish  # + publish snapshot to Redis
python manage.py runserver

# Celery worker (separate terminal)
celery -A config worker -l info

# Runner supervisor (separate terminal)
python manage.py runbot_supervisor
```

## Tests

```bash
pytest
```
# bot-constr-vbc
