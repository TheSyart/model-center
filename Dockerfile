# ---- 依赖与构建 ----
FROM node:22-alpine AS builder
# better-sqlite3 需要原生编译工具链（alpine musl 环境）
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- 运行 ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# SQLite 数据目录（挂卷持久化：-v model-center-data:/app/data）
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3000
# 必须提供 MASTER_KEY（openssl rand -hex 32）
# docker run -e MASTER_KEY=... -p 3000:3000 -v model-center-data:/app/data model-center
CMD ["node", "server.js"]
