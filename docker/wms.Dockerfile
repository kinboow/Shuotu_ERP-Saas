FROM node:18-alpine

WORKDIR /app/services/wms

COPY services/wms/package*.json ./
RUN npm ci --omit=dev

COPY services/wms/ ./

EXPOSE 5003

CMD ["node", "src/index.js"]
