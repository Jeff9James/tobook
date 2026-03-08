# ToBook - Markdown to KDP Book Converter
# Multi-stage build for Railway deployment

FROM node:20-slim as base

# Install system dependencies for TinyTeX and Pandoc
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    tar \
    perl \
    fontconfig \
    libfontconfig1 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV UPLOAD_DIR=/app/uploads
ENV OUTPUT_DIR=/app/outputs
ENV TINYTEX_DIR=/app/.tinytex
ENV PANDOC_DIR=/app/.pandoc

# Create directories
RUN mkdir -p uploads outputs

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
