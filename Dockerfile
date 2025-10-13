# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

COPY tsconfig.json ./
COPY prisma ./prisma
RUN npx prisma generate || true

COPY src ./src

ENV NODE_ENV=production
RUN npm run build || true

EXPOSE 4000
CMD ["npm", "run", "dev"]
