FROM node:20-bookworm-slim

# Install Python 3, pip, venv, and FFmpeg for media processing & YouTube imports
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency configs
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install Node dependencies
RUN npm install && \
    cd client && npm install && \
    cd ../server && npm install

# Copy application source code
COPY . .

# Create python virtualenv and install yt-dlp for YouTube imports
RUN python3 -m venv /app/server/venv && \
    /app/server/venv/bin/pip install --no-cache-dir yt-dlp && \
    ln -s /app/server/venv/bin/yt-dlp /usr/local/bin/yt-dlp

# Build React client for production
RUN npm run build

# Ensure upload directories exist
RUN mkdir -p /app/server/uploads/videos /app/server/uploads/dubs /app/server/uploads/exports

# Default port for Render and Cloud providers
ENV PORT=3001
ENV NODE_ENV=production

EXPOSE $PORT

# Run Express server (which now serves both API and static UI)
CMD ["node", "server/server.js"]
