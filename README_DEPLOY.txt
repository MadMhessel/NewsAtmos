Загрузка на хостинг (чистые URL без #)

1) Локально:
   npm install
   npm run build

   Примечание: после сборки автоматически создаётся dist/admin/index.html (скрипт scripts/postbuild.mjs).
   Это нужно, если вы хотите открывать админку по /admin как отдельную папку (например, чтобы защитить её Basic Auth).

2) На хостинг загрузить СОДЕРЖИМОЕ папки dist/ в корень сайта (обычно public_html).

3) Для корректной работы адресов вида /news/..., /admin, /privacy:
   - если хостинг на Apache: файл dist/.htaccess уже добавлен (перенесётся из public/.htaccess)
   - если Nginx: нужна настройка "try_files $uri $uri/ /index.html;" (в панели хостинга обычно это "SPA" или "Fallback to index.html")

4) Папки/права:
   - dist/api/* (news.php, upload.php, rss_pull.php...) должны выполняться сервером (PHP)
   - dist/uploads/ должна быть доступна для записи (права на папку обычно 755/775)
   - dist/api/data/ должна быть доступна для записи (755/775), туда пишутся incoming.json, seen.json, rss_log.txt, secrets.php
   - dist/api/backups/ создаётся автоматически при сохранении новостей

НАСТРОЙКИ САЙТА (через админку)
- /api/settings.json будет создаваться/обновляться при сохранении настроек.
- RSS-источники хранятся в /api/data/rss_sources.json.
- Логи RSS: /api/data/rss_log.txt, лог запуска по планировщику (если настроите) можно писать в /api/rss_cron.log

ПЛАНИРОВЩИК (Cron) ДЛЯ RSS
- Пример (раз в 10 минут):
  */10 * * * * /usr/bin/php -f /ABS/PATH/TO/SITE/api/cron_rss.php >> /ABS/PATH/TO/SITE/api/rss_cron.log 2>&1

  Где /ABS/PATH/TO/SITE — абсолютный путь до корня сайта на сервере.
  На некоторых хостингах он выглядит как: /var/www/<логин>/data/www/<домен>

ВАЖНО
- Секреты (REWRITE_SERVICE_URL, HMAC_SECRET, INTERNAL_TOOL_TOKEN) НЕ коммитятся в Git.
  Они сохраняются в /api/data/secrets.php и/или берутся из переменных окружения.
