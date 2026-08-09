FROM node:22-bookworm-slim

# Install FFmpeg for media processing
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency configs first
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

# Install Node dependencies
RUN npm install && \
    cd frontend && npm install && \
    cd ../backend && npm install

# Copy application source code
COPY . .

# Build React frontend for production
RUN npm run build

# Default port for Render
ENV PORT=3001
ENV NODE_ENV=production

EXPOSE $PORT

# Run Express backend
CMD ["node", "backend/server.js"]
