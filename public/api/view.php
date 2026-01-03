<?php
// Увеличение счётчика просмотров для статьи.
// Не требует админ-токена (используется публичной частью сайта).

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

require_once __DIR__ . '/lib_json.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  // Для дев-окружений. На проде CORS не нужен (same-origin).
  header('Access-Control-Allow-Origin: *');
  header('Access-Control-Allow-Headers: Content-Type');
  header('Access-Control-Allow-Methods: POST, OPTIONS');
  exit;
}

$path = data_path('news.json');

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

$items = read_json($path, []);
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
  write_json_atomic($path, $items);
}

echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
