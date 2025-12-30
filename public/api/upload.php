<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

require_once __DIR__ . '/_auth.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  header('Access-Control-Allow-Origin: *');
  header('Access-Control-Allow-Headers: Content-Type, X-Admin-Token');
  header('Access-Control-Allow-Methods: POST, OPTIONS');
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'error' => 'Метод не поддерживается'], JSON_UNESCAPED_UNICODE);
  exit;
}

if (!isset($_FILES['file'])) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Файл не передан'], JSON_UNESCAPED_UNICODE);
  exit;
}

$file = $_FILES['file'];

if ($file['error'] !== UPLOAD_ERR_OK) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Ошибка загрузки: ' . $file['error']], JSON_UNESCAPED_UNICODE);
  exit;
}

$maxBytes = 8 * 1024 * 1024;
if ($file['size'] > $maxBytes) {
  http_response_code(413);
  echo json_encode(['ok' => false, 'error' => 'Файл слишком большой (лимит 8 МБ)'], JSON_UNESCAPED_UNICODE);
  exit;
}

$allowed = [
  'image/jpeg' => 'jpg',
  'image/png'  => 'png',
  'image/webp' => 'webp',
  'image/gif'  => 'gif'
];

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime  = finfo_file($finfo, $file['tmp_name']);
finfo_close($finfo);

if (!isset($allowed[$mime])) {
  http_response_code(415);
  echo json_encode(['ok' => false, 'error' => 'Недопустимый тип файла: ' . $mime], JSON_UNESCAPED_UNICODE);
  exit;
}

$ext = $allowed[$mime];

$uploadsDirFs = realpath(__DIR__ . '/../uploads');
if ($uploadsDirFs === false) {
  $uploadsDirFs = __DIR__ . '/../uploads';
  if (!mkdir($uploadsDirFs, 0755, true)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Не удалось создать папку uploads'], JSON_UNESCAPED_UNICODE);
    exit;
  }
}

$baseName = 'img_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
$targetFs = rtrim($uploadsDirFs, '/\\') . DIRECTORY_SEPARATOR . $baseName;

if (!move_uploaded_file($file['tmp_name'], $targetFs)) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Не удалось сохранить файл'], JSON_UNESCAPED_UNICODE);
  exit;
}

$url = '/uploads/' . $baseName;

echo json_encode(['ok' => true, 'url' => $url], JSON_UNESCAPED_UNICODE);
