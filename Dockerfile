FROM node:22-bookworm-slim

# Install Python 3, venv, pip, and FFmpeg for media processing & YouTube imports
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency configs first
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install pure Node dependencies (no native C++ compilation needed!)
RUN npm install && \
    cd client && npm install && \
    cd ../server && npm install

# Copy application source code
COPY . .

# Create python virtualenv and install latest yt-dlp for YouTube imports
RUN python3 -m venv /app/server/venv && \
    /app/server/venv/bin/pip install --no-cache-dir --upgrade pip wheel && \
    /app/server/venv/bin/pip install --no-cache-dir --upgrade yt-dlp && \
    ln -s /app/server/venv/bin/yt-dlp /usr/local/bin/yt-dlp

# Build React client for production
RUN npm run build

# Ensure clean data and upload directories exist
RUN mkdir -p /app/server/uploads/videos /app/server/uploads/dubs /app/server/uploads/exports /app/server/data && \
    chmod -R 777 /app/server/uploads /app/server/data

# Default port for Render and Cloud providers
ENV PORT=3001
ENV NODE_ENV=production

EXPOSE $PORT

# Run Express server (uses Node 22 built-in node:sqlite)
CMD ["node", "server/server.js"]
