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

$dataDir = __DIR__ . '/data';
$incomingPath = $dataDir . '/incoming.json';

$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : '';

if ($method === 'GET') {
  if ($action === 'list') {
    $items = read_json($incomingPath, []);
    $list = [];
    foreach ($items as $item) {
      $list[] = [
        'id' => isset($item['id']) ? $item['id'] : '',
        'publishedAt' => isset($item['publishedAt']) ? $item['publishedAt'] : null,
        'source' => [
          'name' => isset($item['source']['name']) ? $item['source']['name'] : null,
          'itemUrl' => isset($item['source']['itemUrl']) ? $item['source']['itemUrl'] : null,
        ],
        'raw' => [
          'title' => isset($item['raw']['title']) ? $item['raw']['title'] : null,
        ],
        'status' => isset($item['status']) ? $item['status'] : null,
        'category' => isset($item['category']) ? $item['category'] : null,
        'image' => isset($item['image']) ? $item['image'] : null,
        'publishedNewsId' => isset($item['publishedNewsId']) ? $item['publishedNewsId'] : null,
      ];
    }
    echo json_encode($list, JSON_UNESCAPED_UNICODE);
    exit;
  }

  if ($action === 'get') {
    $id = isset($_GET['id']) ? trim((string)$_GET['id']) : '';
    if ($id === '') {
      http_response_code(400);
      echo json_encode(['ok' => false, 'error' => 'Не указан id'], JSON_UNESCAPED_UNICODE);
      exit;
    }
    $items = read_json($incomingPath, []);
    foreach ($items as $item) {
      if (isset($item['id']) && (string)$item['id'] === $id) {
        echo json_encode($item, JSON_UNESCAPED_UNICODE);
        exit;
      }
    }
    http_response_code(404);
    echo json_encode(['ok' => false, 'error' => 'Не найдено'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Неизвестное действие'], JSON_UNESCAPED_UNICODE);
  exit;
}

if ($method === 'POST') {
  if ($action === 'set_status') {
    require_admin();

    $raw = file_get_contents('php://input');
    $payload = json_decode($raw, true);
    if (!is_array($payload)) {
      http_response_code(400);
      echo json_encode(['ok' => false, 'error' => 'Некорректный JSON'], JSON_UNESCAPED_UNICODE);
      exit;
    }

    $id = isset($payload['id']) ? trim((string)$payload['id']) : '';
    $status = isset($payload['status']) ? trim((string)$payload['status']) : '';
    if ($id === '' || $status === '') {
      http_response_code(400);
      echo json_encode(['ok' => false, 'error' => 'Нужны id и status'], JSON_UNESCAPED_UNICODE);
      exit;
    }

    $items = read_json($incomingPath, []);
    $found = false;
    $now = now_utc_iso();
    foreach ($items as $idx => $item) {
      if (isset($item['id']) && (string)$item['id'] === $id) {
        $items[$idx]['status'] = $status;
        if (isset($payload['publishedNewsId'])) {
          $items[$idx]['publishedNewsId'] = $payload['publishedNewsId'];
        }
        $items[$idx]['updatedAt'] = $now;
        $found = true;
        break;
      }
    }

    if (!$found) {
      http_response_code(404);
      echo json_encode(['ok' => false, 'error' => 'Не найдено'], JSON_UNESCAPED_UNICODE);
      exit;
    }

    if (!write_json_atomic($incomingPath, $items)) {
      http_response_code(500);
      echo json_encode(['ok' => false, 'error' => 'Не удалось сохранить файл (права доступа?)'], JSON_UNESCAPED_UNICODE);
      exit;
    }

    echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
    exit;
  }

  if ($action === 'upsert') {
    require_admin();

    $raw = file_get_contents('php://input');
    $payload = json_decode($raw, true);
    if (!is_array($payload)) {
      http_response_code(400);
      echo json_encode(['ok' => false, 'error' => 'Некорректный JSON'], JSON_UNESCAPED_UNICODE);
      exit;
    }

    $id = isset($payload['id']) ? trim((string)$payload['id']) : '';
    if ($id === '') {
      http_response_code(400);
      echo json_encode(['ok' => false, 'error' => 'Нужен id'], JSON_UNESCAPED_UNICODE);
      exit;
    }

    $items = read_json($incomingPath, []);
    $now = now_utc_iso();
    $foundIndex = null;

    foreach ($items as $idx => $item) {
      if (isset($item['id']) && (string)$item['id'] === $id) {
        $foundIndex = $idx;
        break;
      }
    }

    if ($foundIndex === null) {
      if (!isset($payload['createdAt']) || trim((string)$payload['createdAt']) === '') {
        $payload['createdAt'] = $now;
      }
      $payload['updatedAt'] = $now;
      array_unshift($items, $payload);
    } else {
      if (!isset($payload['createdAt']) || trim((string)$payload['createdAt']) === '') {
        $payload['createdAt'] = isset($items[$foundIndex]['createdAt']) ? $items[$foundIndex]['createdAt'] : $now;
      }
      $payload['updatedAt'] = $now;
      $items[$foundIndex] = $payload;
    }

    if (!write_json_atomic($incomingPath, $items)) {
      http_response_code(500);
      echo json_encode(['ok' => false, 'error' => 'Не удалось сохранить файл (права доступа?)'], JSON_UNESCAPED_UNICODE);
      exit;
    }

    echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
    exit;
  }

  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Неизвестное действие'], JSON_UNESCAPED_UNICODE);
  exit;
}
