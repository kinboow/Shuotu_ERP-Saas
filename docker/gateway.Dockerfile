FROM node:18-alpine

WORKDIR /app/services/gateway

COPY services/gateway/package*.json ./
RUN npm ci --omit=dev

COPY services/gateway/ ./

EXPOSE 5000

CMD ["node", "src/index.js"]
