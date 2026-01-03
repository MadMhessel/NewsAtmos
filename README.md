# ATMOSPHERE 2Н — новостной сайт (SPA)

Одностраничное приложение на React + TypeScript + Tailwind. Сборка — Vite.

## Локальный запуск

```bash
npm install
npm run dev
```

Откройте `http://localhost:3000`.

## Сборка для обычного хостинга

```bash
npm install
npm run build
```

Появится папка `dist/`. На хостинг загружаете **только содержимое `dist/`**.

После сборки автоматически создаётся `dist/admin/index.html` (скрипт `scripts/postbuild.mjs`).
Это удобно, если вы хотите физическую папку `/admin` (например, для защиты Basic Auth).

## PHP-часть (в `dist/api/`)

- `news.php` — чтение/запись `news.json`.
- `upload.php` — загрузка изображений в `uploads/`.
- `cron_rss.php` / `rss_pull.php` — сбор RSS в `api/data/`.
- `rewrite.php` — вызов сервиса рерайта (URL/секреты берутся из `/api/data/secrets.php` и/или переменных окружения).

Vite копирует всё из `public/` в `dist/`, поэтому на хостинге будет:

- `/api/*`
- `/uploads/*`
- `/.htaccess`

## Планировщик (Cron) для RSS

Пример: раз в 10 минут

```bash
*/10 * * * * /usr/bin/php -f /ABS/PATH/TO/SITE/api/cron_rss.php >> /ABS/PATH/TO/SITE/api/rss_cron.log 2>&1
```

`/ABS/PATH/TO/SITE` — абсолютный путь до корня сайта на сервере.

## Важно

- Если загрузить на хостинг **исходники** (файлы `.tsx`), будет «пустая страница»: браузер не выполняет TypeScript/TSX без сборки.
- Секреты не коммитятся в Git: файл `/api/data/secrets.php` хранится только на сервере.
