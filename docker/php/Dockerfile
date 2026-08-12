# syntax=docker/dockerfile:1.7

FROM php:8.4-fpm-alpine3.24 AS php-base

RUN set -eux; \
    apk add --no-cache libpng libpq libzip oniguruma libxml2; \
    apk add --no-cache --virtual .build-deps \
        $PHPIZE_DEPS \
        libpng-dev \
        libzip-dev \
        oniguruma-dev \
        postgresql-dev \
        libxml2-dev; \
    docker-php-ext-install -j"$(nproc)" \
        bcmath \
        exif \
        gd \
        mbstring \
        opcache \
        pcntl \
        pdo_pgsql \
        pgsql \
        zip; \
    apk del .build-deps; \
    mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

COPY --from=composer:2.10.2 /usr/bin/composer /usr/local/bin/composer

WORKDIR /var/www/backend

FROM php-base AS vendor

COPY backend/composer.json backend/composer.lock ./

RUN composer install \
    --no-dev \
    --no-interaction \
    --no-progress \
    --no-scripts \
    --optimize-autoloader \
    --prefer-dist

FROM php-base AS quality

ENV APP_ENV=testing \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    CACHE_STORE=array \
    QUEUE_CONNECTION=sync \
    SESSION_DRIVER=array

COPY backend/composer.json backend/composer.lock ./

RUN --mount=type=cache,target=/tmp/composer-cache \
    COMPOSER_CACHE_DIR=/tmp/composer-cache composer install \
    --no-interaction \
    --no-progress \
    --no-scripts \
    --prefer-dist

COPY backend/ ./

RUN set -eux; \
    mkdir -p \
        storage/app/private \
        storage/app/public \
        storage/framework/cache/data \
        storage/framework/sessions \
        storage/framework/testing \
        storage/framework/views \
        storage/logs \
        bootstrap/cache; \
    composer dump-autoload --optimize --no-interaction

CMD ["composer", "check"]

FROM php-base AS app

ENV APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr

COPY backend/ ./
COPY --from=vendor /var/www/backend/vendor ./vendor

RUN set -eux; \
    mkdir -p \
        storage/app/private \
        storage/app/public \
        storage/framework/cache/data \
        storage/framework/sessions \
        storage/framework/testing \
        storage/framework/views \
        storage/logs \
        bootstrap/cache; \
    php artisan package:discover --ansi; \
    chown -R www-data:www-data storage bootstrap/cache

USER www-data

EXPOSE 9000

CMD ["php-fpm", "-F"]
