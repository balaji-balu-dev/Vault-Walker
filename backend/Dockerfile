FROM python:3.11-slim

# Install system dependencies, smartmontools, and cloudflared for Linux containers
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    smartmontools \
    ca-certificates \
    && ARCH=$(dpkg --print-architecture) \
    && case "${ARCH}" in \
         amd64) CF_ARCH="amd64" ;; \
         arm64) CF_ARCH="arm64" ;; \
         *) CF_ARCH="amd64" ;; \
       esac \
    && curl -fsSL -o /usr/local/bin/cloudflared "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${CF_ARCH}" \
    && chmod +x /usr/local/bin/cloudflared \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application source and frontend dist
COPY backend /app/backend
COPY frontend/dist /app/frontend/dist

# Default storage directory
VOLUME ["/storage_disk", "/app/backend/data"]

ENV STORAGE_ROOT=/storage_disk
ENV HOST=0.0.0.0
ENV PORT=8000
ENV PYTHONPATH=/app/backend

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
