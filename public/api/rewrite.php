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
    'temperature' => $config['rewriteTemperature'] ?? 0.2,
    'appendSourceBlock' => !empty($config['appendSourceBlock']),
    'allowQuotesOnlyIfPresent' => !empty($config['allowQuotesOnlyIfPresent']),
    'includeSourceBlock' => !empty($config['appendSourceBlock']),
    'quotesPolicy' => !empty($config['allowQuotesOnlyIfPresent']) ? 'source_only' : 'allow',
  ];
}

function get_rewrite_secrets(): array {
  $secrets = load_secrets();
  $serviceUrl = getenv('REWRITE_SERVICE_URL');
  if (!$serviceUrl && isset($secrets['REWRITE_SERVICE_URL'])) $serviceUrl = $secrets['REWRITE_SERVICE_URL'];
  $secret = getenv('HMAC_SECRET');
  if (!$secret && isset($secrets['HMAC_SECRET'])) $secret = $secrets['HMAC_SECRET'];
  $internalToken = getenv('INTERNAL_TOOL_TOKEN');
  if (!$internalToken && isset($secrets['INTERNAL_TOOL_TOKEN'])) $internalToken = $secrets['INTERNAL_TOOL_TOKEN'];
  return [
    'serviceUrl' => $serviceUrl,
    'secret' => $secret,
    'internalToken' => $internalToken,
  ];
}

function build_health_url(string $serviceUrl): string {
  $base = rtrim($serviceUrl, '/');
  if (substr($base, -8) === '/rewrite') {
    return substr($base, 0, -8) . '/healthz';
  }
  return $base . '/healthz';
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  require_admin();

  $action = isset($_GET['action']) ? (string)$_GET['action'] : '';
  if (!in_array($action, ['health', 'test'], true)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Неизвестное действие'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  $config = read_json($configPath, []);
  $timeout = isset($config['rewriteTimeoutSec']) ? (int)$config['rewriteTimeoutSec'] : 25;
  $secrets = get_rewrite_secrets();
  if (empty($secrets['serviceUrl']) || empty($secrets['secret'])) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Rewrite service unavailable'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  if ($action === 'health') {
    $healthUrl = build_health_url($secrets['serviceUrl']);
    $ch = curl_init($healthUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, max(5, $timeout));
    $headers = [];
    if (!empty($secrets['internalToken'])) {
      $headers[] = 'X-Internal-Token: ' . $secrets['internalToken'];
    }
    if (!empty($headers)) {
      curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    }
    $result = curl_exec($ch);
    $err = curl_error($ch);
    $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    if ($result === false || $status >= 400) {
      http_response_code(502);
      echo json_encode(['ok' => false, 'error' => $err ?: ('HTTP ' . $status)], JSON_UNESCAPED_UNICODE);
      exit;
    }

    $payloadResult = json_decode($result, true);
    if (!is_array($payloadResult)) {
      $payloadResult = ['raw' => $result];
    }

    echo json_encode(['ok' => true, 'status' => $status, 'data' => $payloadResult], JSON_UNESCAPED_UNICODE);
    exit;
  }

  $sampleItem = [
    'raw' => [
      'title' => 'Тестовый заголовок',
      'summary' => 'Короткое описание для проверки реврайта.',
    ],
    'source' => [
      'name' => 'NewsAtmos',
      'itemUrl' => 'https://example.com',
    ],
    'category' => $config['defaultCategorySlug'] ?? 'city',
    'publishedAt' => now_utc_iso(),
  ];
  $payloadBody = prepare_rewrite_payload($sampleItem, $config, 'Это тестовый текст для проверки работы сервиса реврайта.');
  $payloadJson = json_encode($payloadBody, JSON_UNESCAPED_UNICODE);
  $timestamp = (string)time();
  $signature = hash_hmac('sha256', $timestamp . '.' . $payloadJson, $secrets['secret']);

  $headers = [
    'Content-Type: application/json',
    'X-Timestamp: ' . $timestamp,
    'X-Signature: ' . $signature,
  ];
  if (!empty($secrets['internalToken'])) {
    $headers[] = 'X-Internal-Token: ' . $secrets['internalToken'];
  }

  $ch = curl_init($secrets['serviceUrl']);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_POST, true);
  curl_setopt($ch, CURLOPT_TIMEOUT, max(5, $timeout));
  curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
  curl_setopt($ch, CURLOPT_POSTFIELDS, $payloadJson);
  $result = curl_exec($ch);
  $err = curl_error($ch);
  $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
  curl_close($ch);

  if ($result === false || $status >= 400) {
    http_response_code(502);
    echo json_encode(['ok' => false, 'error' => $err ?: ('HTTP ' . $status)], JSON_UNESCAPED_UNICODE);
    exit;
  }

  $payloadResult = json_decode($result, true);
  if (!is_array($payloadResult)) {
    http_response_code(502);
    echo json_encode(['ok' => false, 'error' => 'Некорректный ответ от сервиса реврайта.'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  echo json_encode(['ok' => true, 'data' => $payloadResult], JSON_UNESCAPED_UNICODE);
  exit;
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

$secrets = get_rewrite_secrets();
$serviceUrl = $secrets['serviceUrl'];
$secret = $secrets['secret'];
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

$timeout = isset($config['rewriteTimeoutSec']) ? (int)$config['rewriteTimeoutSec'] : 25;
$ch = curl_init($serviceUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_TIMEOUT, max(5, $timeout));
$headers = [
  'Content-Type: application/json',
  'X-Timestamp: ' . $timestamp,
  'X-Signature: ' . $signature,
];
if (!empty($secrets['internalToken'])) {
  $headers[] = 'X-Internal-Token: ' . $secrets['internalToken'];
}
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
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
