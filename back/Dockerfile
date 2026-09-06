# FROM python:3.12-slim

# WORKDIR /app

# RUN pip install --no-cache-dir uv

# COPY pyproject.toml README.md ./
# COPY back ./back

# RUN uv pip install --system ".[constructor]"

# WORKDIR /app/back

# ENV PYTHONPATH=/app/back

# CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

FROM python:3.12-slim
WORKDIR /app
 
# uv не входит в python:3.12-slim — ставим его официальным способом
# (копируем бинарник из образа astral-sh, без curl/pip — быстрее и не тянет лишнего)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/
 
COPY pyproject.toml README.md ./
COPY back ./back
COPY runner ./runner

# Install both constructor and runner extras so runner dependencies (aiohttp, aiogram, etc.) are available
RUN uv pip install --system ".[constructor,runner]"

WORKDIR /app/back
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000"]