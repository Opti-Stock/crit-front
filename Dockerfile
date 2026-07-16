FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci --legacy-peer-deps

COPY . .

RUN npm run build

FROM nginx:1.27-alpine

ENV MAIN_API_UPSTREAM=http://127.0.0.1:3000 \
    ADMIN_API_UPSTREAM=http://127.0.0.1:3001 \
    CHECKIN_API_UPSTREAM=http://127.0.0.1:3002 \
    SUPER_ADMIN_API_UPSTREAM=http://127.0.0.1:3003

COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD wget -qO- http://127.0.0.1:8080/health || exit 1
