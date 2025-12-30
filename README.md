# ATMOSPHERE 2Н — новостной сайт (SPA)

Это одностраничное приложение на React + TypeScript + Tailwind, с маршрутизацией через `HashRouter` (на обычном хостинге открывается без настроек перезаписи URL).

## Как запустить локально

1) Установите Node.js (LTS) и npm.
2) В папке проекта выполните:

```bash
npm install
npm run dev
```

Откройте `http://localhost:3000`.

## Как собрать для обычного хостинга

```bash
npm install
npm run build
```

После этого появится папка `dist/`. На хостинг загружаете **только содержимое `dist/`**.

### PHP-часть

- `public/api/news.php` — чтение/запись `news.json`.
- `public/api/upload.php` — загрузка изображений в `uploads/`.

При сборке Vite копирует всё из `public/` в `dist/`, поэтому на хостинге у вас будет:

- `/api/news.php`
- `/api/upload.php`
- `/api/news.json` (создастся автоматически при сохранении)
- `/uploads/...`

## Важно

Если загрузить на хостинг **исходники** (файлы `.tsx`), будет «пустая страница»: браузер не умеет выполнять TypeScript/TSX и Tailwind-директивы (`@tailwind`, `@apply`) без сборки.
