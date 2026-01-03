import fs from 'node:fs';
import path from 'node:path';

// После vite build создаём физическую папку /admin с копией index.html.
// Это удобно для:
// 1) доступа по /admin без плясок с роутингом на хостинге
// 2) защиты /admin через Basic Auth на Apache (если нужно)

const distDir = path.resolve('dist');
const srcIndex = path.join(distDir, 'index.html');
const adminDir = path.join(distDir, 'admin');
const adminIndex = path.join(adminDir, 'index.html');

if (!fs.existsSync(srcIndex)) {
  console.error('[postbuild] Не найден dist/index.html. Сначала выполните vite build.');
  process.exit(1);
}

fs.mkdirSync(adminDir, { recursive: true });
fs.copyFileSync(srcIndex, adminIndex);
console.log('[postbuild] OK: создан dist/admin/index.html');
