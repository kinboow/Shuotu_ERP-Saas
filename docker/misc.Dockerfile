FROM node:18-alpine

WORKDIR /app

COPY services/shared/package*.json /app/services/shared/
RUN cd /app/services/shared && npm ci --omit=dev

COPY services/misc/package*.json /app/services/misc/
RUN cd /app/services/misc && npm ci --omit=dev

COPY services/shared /app/services/shared
COPY services/misc /app/services/misc

WORKDIR /app/services/misc

EXPOSE 5005

CMD ["node", "src/index.js"]
