FROM oven/bun:latest

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (Bun equivalent of npm ci --only=production)
RUN bun install

# Copy source code
COPY . .

# Build the application
RUN bun run build

# Expose the port (SvelteKit default is 3000)
EXPOSE 3000

# Start the application
CMD ["bun", "run", "start"]