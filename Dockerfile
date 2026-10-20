FROM node:24-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat curl wget

FROM base AS dependencies
ENV NODE_ENV=development
COPY package.json package-lock.json ./
RUN npm ci --include=dev

FROM base AS builder
ENV NODE_ENV=development
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build
RUN npm prune --production

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build

EXPOSE 3000
CMD ["node", "build"]
