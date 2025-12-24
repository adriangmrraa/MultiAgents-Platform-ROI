# /agent_service/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Expose Nexus v3 Port
EXPOSE 8001

# Start Agent Service
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
