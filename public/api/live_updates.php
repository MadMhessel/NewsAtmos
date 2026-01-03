<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

require_once __DIR__ . '/_auth.php';
require_once __DIR__ . '/lib_json.php';

$configPath = data_path('config.json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  header('Access-Control-Allow-Origin: *');
  header('Access-Control-Allow-Headers: Content-Type, X-Admin-Token');
  header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
  exit;
}

$path = data_path('live_updates.json');

function backup_live_updates_file($path) {
  if (!file_exists($path)) return;
  $dir = data_path('backups');
  if (!is_dir($dir)) {
    mkdir($dir, 0755, true);
  }
  $timestamp = date('Ymd_His');
  $backupPath = $dir . "/live_updates_{$timestamp}.json";
  copy($path, $backupPath);

  $files = glob($dir . '/live_updates_*.json');
  rsort($files);
  if (count($files) > 30) {
    foreach (array_slice($files, 30) as $file) {
      @unlink($file);
    }
  }
}

function normalize_timestamp($value) {
  if ($value === null || $value === '') return null;
  if (is_numeric($value)) return (int)$value;
  $parsed = strtotime($value);
  return $parsed !== false ? $parsed * 1000 : null;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
  $data = read_json($path, []);
  $streamId = isset($_GET['streamId']) ? $_GET['streamId'] : null;
  $afterRaw = isset($_GET['after']) ? $_GET['after'] : null;
  $after = normalize_timestamp($afterRaw);

  if ($streamId) {
    $data = array_values(array_filter($data, function ($item) use ($streamId) {
      return isset($item['liveStreamId']) && $item['liveStreamId'] === $streamId;
    }));
  }

  if ($after !== null) {
    $data = array_values(array_filter($data, function ($item) use ($after) {
      if (!isset($item['createdAt'])) return false;
      $created = strtotime($item['createdAt']);
      if ($created === false) return false;
      return ($created * 1000) > $after;
    }));
  }

  usort($data, function ($a, $b) {
    $timeA = isset($a['eventTime']) ? strtotime($a['eventTime']) : 0;
    $timeB = isset($b['eventTime']) ? strtotime($b['eventTime']) : 0;
    if ($timeA === $timeB) {
      return strcmp($a['id'] ?? '', $b['id'] ?? '');
    }
    return $timeA <=> $timeB;
  });

  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

if ($method === 'POST') {
  require_admin();

  $raw = file_get_contents('php://input');
  $data = json_decode($raw, true);

  if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Некорректный JSON: ожидается массив'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  backup_live_updates_file($path);

  if (!write_json_atomic($path, $data)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Не удалось сохранить файл (права доступа?)'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  $config = read_json($configPath, []);
  $config['liveVersion'] = isset($config['liveVersion']) ? ((int)$config['liveVersion'] + 1) : 1;
  write_json_atomic($configPath, $config);

  echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
  exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'Метод не поддерживается'], JSON_UNESCAPED_UNICODE);
