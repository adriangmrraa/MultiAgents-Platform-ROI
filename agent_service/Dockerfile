# /agent_service/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Create non-root user
RUN groupadd -g 1000 appgroup && \
    useradd -u 1000 -g appgroup -s /bin/sh -d /app appuser

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Set ownership of app directory to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose Nexus v3 Port
EXPOSE 8001

# Start Agent Service
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
