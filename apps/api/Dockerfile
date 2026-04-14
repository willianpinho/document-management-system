# ==============================================================================
# DMS API - Multi-stage Dockerfile
# ==============================================================================
# Base: Node.js 22 Alpine
# Build: pnpm with turbo prune
# Production: Minimal runtime image
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Base
# ------------------------------------------------------------------------------
FROM node:22-alpine AS base

# Install dependencies for native modules (sharp, bcrypt)
RUN apk add --no-cache libc6-compat openssl

# Install pnpm globally
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9 --activate

# ------------------------------------------------------------------------------
# Stage 2: Dependencies
# ------------------------------------------------------------------------------
FROM base AS deps

WORKDIR /app

# Copy root workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY tsconfig.base.json ./

# Copy package.json files for all workspace packages the API depends on.
# pnpm --frozen-lockfile needs every workspace:* entry resolvable, and
# @dms/typescript-config / @dms/eslint-config are required at build time for
# the NestJS tsconfig extension (decorators) to resolve.
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/typescript/package.json ./packages/config/typescript/
COPY packages/config/eslint/package.json ./packages/config/eslint/

# Copy prisma schema (needed by postinstall)
COPY prisma ./prisma

# Install dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# ------------------------------------------------------------------------------
# Stage 3: Builder
# ------------------------------------------------------------------------------
FROM base AS builder

WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy source code, including the workspace config packages that provide
# the shared NestJS tsconfig (emitDecoratorMetadata + experimentalDecorators).
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY tsconfig.base.json ./
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
COPY packages/config ./packages/config
COPY prisma ./prisma

# Generate Prisma client
RUN pnpm --filter @dms/api db:generate

# Build the application
RUN pnpm --filter @dms/api build

# Prune dev dependencies
RUN pnpm --filter @dms/api --prod deploy /app/pruned

# ------------------------------------------------------------------------------
# Stage 4: Production
# ------------------------------------------------------------------------------
FROM node:22-alpine AS production

# Add labels for container identification
LABEL org.opencontainers.image.title="DMS API"
LABEL org.opencontainers.image.description="Document Management System API"
LABEL org.opencontainers.image.vendor="DMS"

# Security: Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Install runtime dependencies
RUN apk add --no-cache \
    libc6-compat \
    openssl \
    dumb-init \
    curl

WORKDIR /app

# Set environment
ENV NODE_ENV=production
ENV PORT=4000

# Copy built application
COPY --from=builder --chown=nestjs:nodejs /app/pruned/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./package.json

# Copy Prisma schema and migrations for runtime. The generated Prisma
# client and engine are already inside the pruned node_modules produced by
# `pnpm deploy`, so no extra COPY is required here.
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 4000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/main.js"]
