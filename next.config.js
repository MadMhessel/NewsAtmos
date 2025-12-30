/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // Отключаем оптимизацию картинок, так как на статическом хостинге нет Node.js сервера для их обработки
  images: {
    unoptimized: true,
  },
  // Убираем слеш в конце URL, чтобы корректно работали ссылки на файлы
  trailingSlash: true,
};

module.exports = nextConfig;