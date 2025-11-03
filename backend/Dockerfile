FROM node:20-alpine

# Install dependencies for Puppeteer, Python, and bcrypt
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    python3 \
    py3-pip \
    build-base \
    python3-dev

# Tell Puppeteer to skip installing Chrome. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Rebuild bcrypt for Alpine Linux
RUN npm rebuild bcrypt --build-from-source

# Copy source code
COPY . .

# Create uploads and temp directories
RUN mkdir -p uploads temp

# Install Python dependencies for enrichment script
RUN pip3 install --break-system-packages --no-cache-dir pandas requests beautifulsoup4 lxml

# Expose port
EXPOSE 4000

# Start development server
CMD ["npm", "run", "dev"]

