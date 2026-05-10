FROM node:18-alpine

WORKDIR /app/services/webhook

COPY services/webhook/package*.json ./
RUN npm ci --omit=dev

COPY services/webhook/ ./

EXPOSE 8080
EXPOSE 8678

CMD ["node", "src/index.js"]
