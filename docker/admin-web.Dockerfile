FROM node:18-alpine AS builder

WORKDIR /app/platform-admin

COPY platform-admin/package*.json ./
RUN npm install

COPY platform-admin/ ./
RUN npm run build

FROM nginx:1.27-alpine

COPY docker/nginx/admin.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/platform-admin/build /usr/share/nginx/html

EXPOSE 80
