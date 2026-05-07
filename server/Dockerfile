# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

# Verificar se o build foi criado corretamente 
RUN ls -la /app/dist/main.js || (echo "❌ Build failed - main.js not found in dist directory" && exit 1)

# Stage 2: Runtime
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production

# Criar usuario sem previlegios de root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma

# Copiar e dar permissao no entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

# Altera a propriedade das pastas necessarias
RUN chown -R nestjs:nodejs /app/prisma
RUN chown -R nestjs:nodejs /app/node_modules/.prisma || true
RUN chown -R nestjs:nodejs /app/node_modules/@prisma || true

USER nestjs

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
