FROM node:18-alpine

WORKDIR /app/services/oss

COPY services/oss/package*.json ./
RUN npm ci --omit=dev

COPY services/oss/ ./
RUN mkdir -p storage/pdf storage/images storage/temp storage/documents

EXPOSE 3001

CMD ["node", "server.js"]
