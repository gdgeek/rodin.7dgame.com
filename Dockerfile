# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src

# Build
RUN pnpm run build

# Prune dev dependencies
RUN pnpm prune --prod

# Stage 2: Production
FROM node:22-alpine

WORKDIR /usr/src/app

# Enable pnpm (optional if just running node, but good for consistency)
# RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy node_modules from builder
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/package.json ./package.json

# Expose port
EXPOSE 3000

# Start command
CMD ["node", "dist/index.js"]