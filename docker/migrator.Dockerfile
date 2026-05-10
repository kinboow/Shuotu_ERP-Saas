FROM node:18-alpine

WORKDIR /app

COPY services/shared/package*.json /app/services/shared/
RUN cd /app/services/shared && npm ci --omit=dev

COPY services/misc/package*.json /app/services/misc/
RUN cd /app/services/misc && npm ci --omit=dev

COPY services/sync-engine/package*.json /app/services/sync-engine/
RUN cd /app/services/sync-engine && npm ci --omit=dev

COPY services/oms/package*.json /app/services/oms/
RUN cd /app/services/oms && npm ci --omit=dev

COPY services/wms/package*.json /app/services/wms/
RUN cd /app/services/wms && npm ci --omit=dev

COPY services/pms/package*.json /app/services/pms/
RUN cd /app/services/pms && npm ci --omit=dev

COPY services/platform-admin/package*.json /app/services/platform-admin/
RUN cd /app/services/platform-admin && npm ci --omit=dev

COPY services/shared /app/services/shared
COPY services/misc /app/services/misc
COPY services/sync-engine /app/services/sync-engine
COPY services/oms /app/services/oms
COPY services/wms /app/services/wms
COPY services/pms /app/services/pms
COPY services/platform-admin /app/services/platform-admin
COPY services/migrate.js /app/services/migrate.js

CMD ["node", "services/migrate.js"]
