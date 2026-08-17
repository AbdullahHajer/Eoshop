# syntax=docker/dockerfile:1.7

FROM node:22.23.1-alpine3.24 AS frontend-build

WORKDIR /app

ARG VITE_CENTRAL_DOMAINS=localhost,127.0.0.1,eoshop.local
ARG VITE_TENANT_BASE_DOMAIN=eoshop.local
ENV VITE_CENTRAL_DOMAINS=${VITE_CENTRAL_DOMAINS}
ENV VITE_TENANT_BASE_DOMAIN=${VITE_TENANT_BASE_DOMAIN}

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci \
    --no-audit \
    --no-fund \
    --fetch-retries=5 \
    --fetch-retry-mintimeout=20000 \
    --fetch-retry-maxtimeout=120000

COPY index.html tsconfig.json vite.config.ts ./
COPY public ./public
COPY src ./src

RUN npm run build

FROM frontend-build AS frontend-quality

RUN npm run test

FROM nginx:1.30.4-alpine3.24

COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /app/dist /usr/share/nginx/html

EXPOSE 80
