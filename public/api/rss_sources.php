<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  header('Access-Control-Allow-Origin: *');
  header('Access-Control-Allow-Headers: Content-Type, X-Admin-Token');
  header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
  exit;
}

require_once __DIR__ . '/_auth.php';
require_once __DIR__ . '/lib_json.php';

$path = data_path('rss_sources.json');

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  echo json_encode(read_json($path, []), JSON_UNESCAPED_UNICODE);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  require_admin();

  $raw = file_get_contents('php://input');
  $data = json_decode($raw, true);
  if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Некорректные данные'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  $safe = [];
  foreach ($data as $item) {
    if (!is_array($item)) continue;
    $name = isset($item['name']) ? trim((string)$item['name']) : '';
    $feedUrl = isset($item['feedUrl']) ? trim((string)$item['feedUrl']) : '';
    if ($name === '') {
      http_response_code(400);
      echo json_encode(['ok' => false, 'error' => 'Имя источника не может быть пустым'], JSON_UNESCAPED_UNICODE);
      exit;
    }
    if ($feedUrl === '' || !preg_match('#^https?://#i', $feedUrl)) {
      http_response_code(400);
      echo json_encode(['ok' => false, 'error' => 'feedUrl должен начинаться с http/https'], JSON_UNESCAPED_UNICODE);
      exit;
    }

    $category = null;
    if (isset($item['category']) && is_array($item['category'])) {
      $slug = isset($item['category']['slug']) ? trim((string)$item['category']['slug']) : '';
      $title = isset($item['category']['title']) ? trim((string)$item['category']['title']) : '';
      if ($slug !== '' && $title !== '') {
        $category = ['slug' => $slug, 'title' => $title];
      }
    }

    $safe[] = [
      'name' => mb_substr($name, 0, 120),
      'feedUrl' => mb_substr($feedUrl, 0, 800),
      'category' => $category,
      'defaultTags' => isset($item['defaultTags']) && is_array($item['defaultTags']) ? array_values(array_filter($item['defaultTags'])) : [],
      'enabled' => !empty($item['enabled']),
    ];
  }

  if (!write_json_atomic($path, $safe)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Не удалось сохранить файл (права доступа?)'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
  exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'Метод не поддерживается'], JSON_UNESCAPED_UNICODE);
