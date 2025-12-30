<?php
// Увеличение счётчика просмотров для статьи.
// Не требует админ-токена (используется публичной частью сайта).

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  // Для дев-окружений. На проде CORS не нужен (same-origin).
  header('Access-Control-Allow-Origin: *');
  header('Access-Control-Allow-Headers: Content-Type');
  header('Access-Control-Allow-Methods: POST, OPTIONS');
  exit;
}

$path = __DIR__ . '/news.json';

function read_json_file($path) {
  if (!file_exists($path)) return [];
  $raw = file_get_contents($path);
  if ($raw === false) return [];
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

function write_json_file($path, $data) {
  $dir = dirname($path);
  if (!is_dir($dir)) return false;
  $tmp = $path . '.tmp';
  $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
  if ($json === false) return false;
  $ok = file_put_contents($tmp, $json, LOCK_EX);
  if ($ok === false) return false;
  return rename($tmp, $path);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'error' => 'Метод не поддерживается'], JSON_UNESCAPED_UNICODE);
  exit;
}

$raw = file_get_contents('php://input');
$payload = json_decode($raw, true);

$id = is_array($payload) && isset($payload['id']) ? trim((string)$payload['id']) : '';
if ($id === '') {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Не указан id'], JSON_UNESCAPED_UNICODE);
  exit;
}

$items = read_json_file($path);
$changed = false;

for ($i = 0; $i < count($items); $i++) {
  if (!is_array($items[$i])) continue;
  if (!isset($items[$i]['id'])) continue;
  if ((string)$items[$i]['id'] !== $id) continue;

  $views = 0;
  if (isset($items[$i]['views']) && is_numeric($items[$i]['views'])) {
    $views = (int)$items[$i]['views'];
  }
  $views = max(0, $views + 1);
  $items[$i]['views'] = $views;
  $items[$i]['updatedAt'] = (new DateTime('now', new DateTimeZone('UTC')))->format(DateTime::ATOM);
  $changed = true;
  break;
}

if ($changed) {
  // Если не удалось записать — всё равно отвечаем ok, чтобы не ломать страницу.
  write_json_file($path, $items);
}

echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
