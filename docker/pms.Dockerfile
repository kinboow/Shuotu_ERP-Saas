FROM node:18-alpine

WORKDIR /app/services/pms

COPY services/pms/package*.json ./
RUN npm ci --omit=dev

COPY services/pms/ ./

EXPOSE 5004

CMD ["node", "src/index.js"]
