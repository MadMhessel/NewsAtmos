<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

require_once __DIR__ . '/_auth.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  header('Access-Control-Allow-Origin: *');
  header('Access-Control-Allow-Headers: Content-Type, X-Admin-Token');
  header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
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
  $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
  if ($json === false) return false;
  $tmp = $path . '.tmp';
  $ok = file_put_contents($tmp, $json, LOCK_EX);
  if ($ok === false) return false;
  return rename($tmp, $path);
}

function backup_news_file($path) {
  if (!file_exists($path)) return;
  $dir = __DIR__ . '/backups';
  if (!is_dir($dir)) {
    mkdir($dir, 0755, true);
  }
  $timestamp = date('Ymd_His');
  $backupPath = $dir . "/news_{$timestamp}.json";
  copy($path, $backupPath);

  $files = glob($dir . '/news_*.json');
  rsort($files);
  if (count($files) > 30) {
    foreach (array_slice($files, 30) as $file) {
      @unlink($file);
    }
  }
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
  $data = read_json_file($path);
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

if ($method === 'POST') {
  $raw = file_get_contents('php://input');
  $data = json_decode($raw, true);

  if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Некорректный JSON: ожидается массив'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  backup_news_file($path);

  if (!write_json_file($path, $data)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Не удалось сохранить файл (права доступа?)'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
  exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'Метод не поддерживается'], JSON_UNESCAPED_UNICODE);
