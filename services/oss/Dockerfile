FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN mkdir -p storage/pdf storage/images storage/temp storage/documents

EXPOSE 3001

CMD ["node", "server.js"]
