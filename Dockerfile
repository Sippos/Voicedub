FROM node:20-bookworm

# Install Python 3, pip, venv, build tools, and FFmpeg for media processing & SQLite native compiling
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    sqlite3 \
    libsqlite3-dev \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency configs
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install Node dependencies and cleanly rebuild better-sqlite3 for container architecture to prevent SIGSEGV (139)
RUN npm install && \
    cd client && npm install && \
    cd ../server && npm install && \
    npm rebuild better-sqlite3 --build-from-source

# Copy application source code
COPY . .

# Create python virtualenv and install yt-dlp for YouTube imports
RUN python3 -m venv /app/server/venv && \
    /app/server/venv/bin/pip install --no-cache-dir yt-dlp && \
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

# Run Express server (which serves both API and static UI)
CMD ["node", "server/server.js"]
