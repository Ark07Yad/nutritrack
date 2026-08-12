FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src

# SQLite lives here; mount it as a volume so subscriptions survive a redeploy.
ENV DATABASE_PATH=/data/push.db
VOLUME /data

ENV PORT=8787
EXPOSE 8787

CMD ["node", "src/index.js"]
