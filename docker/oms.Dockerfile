FROM node:18-alpine

WORKDIR /app/services/oms

COPY services/oms/package*.json ./
RUN npm ci --omit=dev

COPY services/oms/ ./

EXPOSE 5002

CMD ["node", "src/index.js"]
