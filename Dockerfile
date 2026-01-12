# ===========================================
# DOCKERFILE FOR SST BORROWING SYSTEM
# Multi-stage build for optimized production image
# ===========================================

# Stage 1: Base image with Node.js
FROM node:20-alpine AS base

# Stage 2: Install dependencies
FROM base AS deps
# libc6-compat needed for some npm packages on Alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Enable pnpm and install dependencies
# frozen-lockfile ensures reproducible builds
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Stage 3: Build the application
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Build-time arguments for Next.js (placeholder values for build)
# Actual values are provided at runtime
ARG MONGODB_URI="mongodb://localhost:27017/placeholder"
ARG NEXTAUTH_SECRET="build-time-placeholder-secret"
ARG NEXTAUTH_URL="http://localhost:3000"
ARG QR_HMAC_SECRET="build-time-qr-hmac-secret"

ENV MONGODB_URI=$MONGODB_URI
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENV NEXTAUTH_URL=$NEXTAUTH_URL
ENV QR_HMAC_SECRET=$QR_HMAC_SECRET

# Build the Next.js application
RUN corepack enable pnpm && pnpm build

# Stage 4: Production runner
FROM base AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security (OWASP Best Practice)
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built assets
# We utilize Next.js 'standalone' output to reduce image size
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Run as non-root user
USER nextjs

# Expose port
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application
CMD ["node", "server.js"]
