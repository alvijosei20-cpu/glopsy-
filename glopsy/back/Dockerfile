FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=development
ENV PORT=3000
ENV ENABLE_HTTPS=0

EXPOSE 3000

CMD ["sh", "-c", "node scripts/migrate.mjs && node server.js"]
