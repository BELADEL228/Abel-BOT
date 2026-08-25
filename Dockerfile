FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json prisma ./
RUN npm ci

COPY src ./src
RUN npm run build
RUN npx prisma generate

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000

CMD ["node", "dist/index.js"]
