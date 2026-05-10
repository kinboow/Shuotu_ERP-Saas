FROM node:18-alpine

WORKDIR /app/services/platform-admin

COPY services/platform-admin/package*.json ./
RUN npm ci --omit=dev

COPY services/platform-admin/ ./

EXPOSE 5090

CMD ["node", "src/index.js"]
