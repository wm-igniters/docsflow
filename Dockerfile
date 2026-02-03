FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
ARG MONGODB_URI
ENV MONGODB_URI=$MONGODB_URI

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

EXPOSE 3000

CMD ["npm", "start"]


