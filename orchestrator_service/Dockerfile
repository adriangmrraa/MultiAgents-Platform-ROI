FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Create non-root user
RUN groupadd -g 1000 appgroup && \
    useradd -u 1000 -g appgroup -s /bin/sh -d /app appuser

COPY requirements.txt .

RUN apt-get update && apt-get install -y \
    curl \
    libpq-dev \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --upgrade pip
RUN pip install --no-cache-dir --default-timeout=100 --retries 5 -r requirements.txt

COPY . .

# Set ownership of app directory to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Run Alembic migrations on startup, then start server
CMD sh -c "echo 'Running migrations...' && alembic upgrade head 2>&1 && echo 'Starting server...' && uvicorn main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"
