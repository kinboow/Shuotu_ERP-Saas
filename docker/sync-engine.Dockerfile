FROM node:18-alpine

WORKDIR /app

COPY services/shared/package*.json /app/services/shared/
RUN cd /app/services/shared && npm ci --omit=dev

COPY services/sync-engine/package*.json /app/services/sync-engine/
RUN cd /app/services/sync-engine && npm ci --omit=dev

COPY services/shared /app/services/shared
COPY services/sync-engine /app/services/sync-engine

WORKDIR /app/services/sync-engine

EXPOSE 5001

CMD ["node", "src/index.js"]
