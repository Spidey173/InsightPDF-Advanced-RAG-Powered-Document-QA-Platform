# Stage 1: Build the frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend-next/package*.json ./
RUN npm ci
COPY frontend-next/ ./
# Build the frontend with relative API URLs so it uses relative paths
ENV NEXT_PUBLIC_API_URL=""
RUN npm run build

# Stage 2: Serve with backend
FROM python:3.10-slim AS runner
WORKDIR /app
# Install system packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements first to leverage caching
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend application
COPY backend/ ./backend/

# Copy built frontend from Stage 1 to the location expected by main.py
COPY --from=frontend-builder /app/frontend/out ./frontend-next/out

WORKDIR /app/backend

# Create upload dir and expose port
RUN mkdir -p uploads && chmod 777 uploads
ENV PORT=7860
EXPOSE 7860

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
