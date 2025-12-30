<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  header('Access-Control-Allow-Origin: *');
  header('Access-Control-Allow-Headers: Content-Type, X-Admin-Token');
  header('Access-Control-Allow-Methods: POST, OPTIONS');
  exit;
}

require_once __DIR__ . '/_auth.php';
require_once __DIR__ . '/lib_json.php';
require_once __DIR__ . '/lib_feed.php';

$dataDir = __DIR__ . '/data';
$incomingPath = $dataDir . '/incoming.json';
$configPath = $dataDir . '/config.json';

function extract_text_from_html($html) {
  $html = preg_replace('#<(script|style)[^>]*>.*?</\1>#si', ' ', $html);
  $html = preg_replace('#<br\s*/?>#i', "\n", $html);
  $html = strip_tags($html);
  $lines = preg_split('/\r?\n/', $html);
  $lines = array_map('trim', $lines);
  $lines = array_filter($lines, function ($line) { return mb_strlen($line, 'UTF-8') > 30; });
  return implode("\n\n", $lines);
}

function fetch_url($url) {
  $ch = curl_init($url);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
  curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
  curl_setopt($ch, CURLOPT_TIMEOUT, 20);
  curl_setopt($ch, CURLOPT_USERAGENT, 'NewsAtmosRewrite/1.0');
  $body = curl_exec($ch);
  $err = curl_error($ch);
  $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
  curl_close($ch);
  if ($body === false || $status >= 400) {
    return ['ok' => false, 'error' => $err ?: ('HTTP ' . $status)];
  }
  return ['ok' => true, 'body' => $body];
}

function prepare_rewrite_payload($item, $config, $text) {
  return [
    'title' => isset($item['raw']['title']) ? $item['raw']['title'] : '',
    'summary' => isset($item['raw']['summary']) ? $item['raw']['summary'] : '',
    'text' => $text,
    'source' => [
      'name' => isset($item['source']['name']) ? $item['source']['name'] : '',
      'url' => isset($item['source']['itemUrl']) ? $item['source']['itemUrl'] : '',
      'publishedAt' => isset($item['publishedAt']) ? $item['publishedAt'] : '',
    ],
    'categoryHint' => isset($item['category']) ? $item['category'] : ($config['defaultCategorySlug'] ?? ''),
    'regionHint' => $config['rewriteRegionHint'] ?? '',
    'temperature' => $config['rewriteTemperature'] ?? 0.5,
    'includeSourceBlock' => !empty($config['rewriteIncludeSourceBlock']),
    'useSourceImage' => !empty($config['rewriteUseSourceImage']),
    'quotesPolicy' => $config['rewriteQuotesPolicy'] ?? 'source_only',
  ];
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'error' => 'Метод не поддерживается'], JSON_UNESCAPED_UNICODE);
  exit;
}

require_admin();

$raw = file_get_contents('php://input');
$payload = json_decode($raw, true);
if (!is_array($payload)) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Некорректный JSON'], JSON_UNESCAPED_UNICODE);
  exit;
}

$action = isset($payload['action']) ? $payload['action'] : '';
if ($action !== 'rewrite_incoming') {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Неизвестное действие'], JSON_UNESCAPED_UNICODE);
  exit;
}

$id = isset($payload['id']) ? trim((string)$payload['id']) : '';
if ($id === '') {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Нужен id'], JSON_UNESCAPED_UNICODE);
  exit;
}

$config = read_json($configPath, []);
$rewriteMaxChars = isset($config['rewriteMaxChars']) ? (int)$config['rewriteMaxChars'] : 14000;

$items = read_json($incomingPath, []);
$foundIndex = null;
foreach ($items as $idx => $item) {
  if (isset($item['id']) && (string)$item['id'] === $id) {
    $foundIndex = $idx;
    break;
  }
}

if ($foundIndex === null) {
  http_response_code(404);
  echo json_encode(['ok' => false, 'error' => 'Не найдено'], JSON_UNESCAPED_UNICODE);
  exit;
}

$item = $items[$foundIndex];
if (isset($item['status']) && $item['status'] === 'rewriting') {
  echo json_encode(['ok' => false, 'error' => 'Реврайт уже выполняется'], JSON_UNESCAPED_UNICODE);
  exit;
}

$items[$foundIndex]['status'] = 'rewriting';
$items[$foundIndex]['updatedAt'] = now_utc_iso();
write_json_atomic($incomingPath, $items);

$rawText = isset($item['raw']['text']) ? $item['raw']['text'] : '';
$rawText = trim((string)$rawText);

if ($rawText === '') {
  $sourceUrl = isset($item['source']['itemUrl']) ? trim((string)$item['source']['itemUrl']) : '';
  if ($sourceUrl !== '') {
    $fetch = fetch_url($sourceUrl);
    if ($fetch['ok']) {
      $extracted = extract_text_from_html($fetch['body']);
      $rawText = $extracted;
      $items[$foundIndex]['raw']['text'] = $rawText;
    }
  }
}

$clean = normalize_text($rawText, true, true);
if ($rewriteMaxChars > 0 && mb_strlen($clean, 'UTF-8') > $rewriteMaxChars) {
  $clean = mb_substr($clean, 0, $rewriteMaxChars);
}

$serviceUrl = getenv('REWRITE_SERVICE_URL');
$secret = getenv('HMAC_SECRET');
if (!$serviceUrl || !$secret) {
  $items[$foundIndex]['status'] = 'error';
  $items[$foundIndex]['rewriteError'] = 'Не настроены переменные окружения для реврайта.';
  write_json_atomic($incomingPath, $items);
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Rewrite service unavailable'], JSON_UNESCAPED_UNICODE);
  exit;
}

$payloadBody = prepare_rewrite_payload($item, $config, $clean);
$payloadJson = json_encode($payloadBody, JSON_UNESCAPED_UNICODE);
$timestamp = (string)time();
$signature = hash_hmac('sha256', $timestamp . '.' . $payloadJson, $secret);

$ch = curl_init($serviceUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 60);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  'Content-Type: application/json',
  'X-Timestamp: ' . $timestamp,
  'X-Signature: ' . $signature,
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payloadJson);
$result = curl_exec($ch);
$err = curl_error($ch);
$status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
curl_close($ch);

if ($result === false || $status >= 400) {
  $items[$foundIndex]['status'] = 'error';
  $items[$foundIndex]['rewriteError'] = $err ?: ('HTTP ' . $status);
  write_json_atomic($incomingPath, $items);
  http_response_code(502);
  echo json_encode(['ok' => false, 'error' => 'Rewrite failed'], JSON_UNESCAPED_UNICODE);
  exit;
}

$payloadResult = json_decode($result, true);
if (!is_array($payloadResult)) {
  $items[$foundIndex]['status'] = 'error';
  $items[$foundIndex]['rewriteError'] = 'Некорректный ответ от сервиса реврайта.';
  write_json_atomic($incomingPath, $items);
  http_response_code(502);
  echo json_encode(['ok' => false, 'error' => 'Rewrite failed'], JSON_UNESCAPED_UNICODE);
  exit;
}

$items[$foundIndex]['status'] = 'rewritten';
$items[$foundIndex]['rewrite'] = $payloadResult;
$items[$foundIndex]['updatedAt'] = now_utc_iso();

if (!write_json_atomic($incomingPath, $items)) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Не удалось сохранить incoming.json'], JSON_UNESCAPED_UNICODE);
  exit;
}

echo json_encode(['ok' => true, 'data' => $payloadResult], JSON_UNESCAPED_UNICODE);
