FROM python:3.11-slim

WORKDIR /app

# Create non-root user
RUN groupadd -g 1000 appgroup && \
    useradd -u 1000 -g appgroup -s /bin/sh -d /app appuser

COPY requirements.txt .

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Set ownership of app directory to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

ENV PORT=8003
EXPOSE 8003

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8003"]
