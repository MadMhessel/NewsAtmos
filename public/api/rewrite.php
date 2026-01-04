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
require_once __DIR__ . '/lib_feed.php';

$incomingPath = data_path('incoming.json');
$configPath = data_path('config.json');

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

/**
 * ВАЖНО:
 * Этот payload соответствует FastAPI-сервису (neutral-news-ai-editor / neutral-news-rewrite-api v2),
 * который ожидает поля source_text (обязательно) и прочие source_*.
 * Не добавляйте лишние ключи — чтобы не ловить 422.
 */
function prepare_rewrite_payload($item, $config, $text) {
  return [
    'source_title' => $item['raw']['title'] ?? '',
    'source_text'  => $text, // ОБЯЗАТЕЛЬНО
    'source_url'   => $item['source']['itemUrl'] ?? '',
    'source_site'  => $item['source']['name'] ?? '',
    'source_published_at' => $item['publishedAt'] ?? '',
    'source_image' => $item['raw']['image'] ?? ($item['raw']['heroImage'] ?? ''),
    'region_hint'  => $config['rewriteRegionHint'] ?? '',
  ];
}

function get_nested_value(array $data, string $path) {
  $segments = explode('.', $path);
  $value = $data;
  foreach ($segments as $segment) {
    if (!is_array($value) || !array_key_exists($segment, $value)) {
      return null;
    }
    $value = $value[$segment];
  }
  return $value;
}

function pick_first_value(array $data, array $paths) {
  foreach ($paths as $path) {
    $value = get_nested_value($data, $path);
    if (is_string($value) && trim($value) !== '') return trim($value);
    if (is_numeric($value)) return $value;
    if (is_array($value) && !empty($value)) return $value;
    if (is_bool($value)) return $value;
  }
  return null;
}

function normalize_string_list($value): array {
  if (is_array($value)) {
    $items = [];
    foreach ($value as $item) {
      if (is_string($item)) {
        $item = trim($item);
        if ($item !== '') $items[] = $item;
      }
    }
    return array_values(array_unique($items));
  }
  if (is_string($value)) {
    $parts = preg_split('/[,\n;]/', $value);
    $items = [];
    foreach ($parts as $part) {
      $part = trim($part);
      if ($part !== '') $items[] = $part;
    }
    return array_values(array_unique($items));
  }
  return [];
}

function text_to_blocks(string $text): array {
  $text = trim($text);
  if ($text === '') return [];
  $paragraphs = preg_split('/\r?\n\r?\n/', $text);
  $blocks = [];
  foreach ($paragraphs as $paragraph) {
    $paragraph = trim($paragraph);
    if ($paragraph === '') continue;
    $blocks[] = ['type' => 'paragraph', 'value' => $paragraph];
  }
  return $blocks;
}

function normalize_category($value, array $config): ?string {
  if (is_array($value)) {
    $value = reset($value);
  }
  if (!is_string($value)) return null;
  $value = trim($value);
  if ($value === '') return null;
  if (!empty($config['allowedCategories']) && is_array($config['allowedCategories'])) {
    foreach ($config['allowedCategories'] as $allowed) {
      if (!is_array($allowed)) continue;
      $slug = $allowed['slug'] ?? '';
      $title = $allowed['title'] ?? '';
      if ($slug !== '' && mb_strtolower($slug, 'UTF-8') === mb_strtolower($value, 'UTF-8')) {
        return $slug;
      }
      if ($title !== '' && mb_strtolower($title, 'UTF-8') === mb_strtolower($value, 'UTF-8')) {
        return $slug ?: $value;
      }
    }
    return $config['defaultCategorySlug'] ?? null;
  }
  return $value;
}

function normalize_bool($value): ?bool {
  if (is_bool($value)) return $value;
  if (is_numeric($value)) return (bool)$value;
  if (is_string($value)) {
    $value = strtolower(trim($value));
    if (in_array($value, ['true', '1', 'yes', 'y'], true)) return true;
    if (in_array($value, ['false', '0', 'no', 'n'], true)) return false;
  }
  return null;
}

function normalize_rewrite_result(array $payloadResult, array $item, array $config): array {
  $rss = isset($payloadResult['rss']) && is_array($payloadResult['rss']) ? $payloadResult['rss'] : $payloadResult;
  $editorial = isset($payloadResult['editorial']) && is_array($payloadResult['editorial']) ? $payloadResult['editorial'] : [];

  $title = pick_first_value($rss, ['title', 'headline']);
  if ($title === null) $title = $item['raw']['title'] ?? '';

  $excerpt = pick_first_value($rss, ['excerpt', 'summary', 'description', 'subtitle']);
  if ($excerpt === null) $excerpt = $item['raw']['summary'] ?? '';

  $content = pick_first_value($rss, ['content', 'text', 'body', 'full_text', 'contentEncoded', 'content:encoded']);
  $contentBlocks = [];
  if (is_array($content)) {
    $contentBlocks = $content;
  } elseif (is_string($content)) {
    $contentBlocks = text_to_blocks($content);
  }

  $category = normalize_category(
    pick_first_value($rss, ['category', 'categories', 'section']),
    $config
  );

  $tags = normalize_string_list(pick_first_value($rss, ['tags', 'keywords']));
  if (empty($tags)) {
    $tags = normalize_string_list(pick_first_value($rss, ['categories']));
  }

  $heroImage = pick_first_value($rss, [
    'heroImage',
    'image.url',
    'image',
    'media.thumbnail',
    'media.content',
  ]);

  $heroImageSquare = pick_first_value($rss, ['heroImageSquare', 'image.square', 'media.square']);
  $heroImageAuthor = pick_first_value($rss, ['heroImageAuthor', 'image.author', 'media.author']);

  $heroFocalX = pick_first_value($rss, ['heroFocalX', 'heroFocal.x', 'image.focal.x']);
  $heroFocalY = pick_first_value($rss, ['heroFocalY', 'heroFocal.y', 'image.focal.y']);

  $authorName = pick_first_value($rss, ['authorName', 'author.name', 'author']);
  $authorRole = pick_first_value($rss, ['authorRole', 'author.role']);

  $sourceName = pick_first_value($rss, ['sourceName', 'source.name', 'source']);
  $sourceUrl = pick_first_value($rss, ['sourceUrl', 'source.url', 'source.link']);

  $locationCity = pick_first_value($rss, ['locationCity', 'location.city']);
  $locationDistrict = pick_first_value($rss, ['locationDistrict', 'location.district']);
  $locationAddress = pick_first_value($rss, ['locationAddress', 'location.address']);

  $status = pick_first_value($payloadResult, ['status']);
  $scheduledAt = pick_first_value($payloadResult, ['scheduledAt', 'scheduleAt', 'publishAt']);
  $slug = pick_first_value($payloadResult, ['slug']);

  $isVerified = normalize_bool(pick_first_value($payloadResult, ['isVerified']));
  $isFeatured = normalize_bool(pick_first_value($payloadResult, ['isFeatured']));
  $isBreaking = normalize_bool(pick_first_value($payloadResult, ['isBreaking']));
  $pinnedNowReading = normalize_bool(pick_first_value($payloadResult, ['pinnedNowReading']));
  $pinnedNowReadingRank = pick_first_value($payloadResult, ['pinnedNowReadingRank']);

  $flags = normalize_string_list(pick_first_value($payloadResult, ['flags']));
  $confidence = pick_first_value($payloadResult, ['confidence', 'score']);
  if (!is_numeric($confidence)) $confidence = null;

  $notes = normalize_string_list(pick_first_value($editorial, ['notes']));

  return array_filter([
    'title' => $title,
    'excerpt' => $excerpt,
    'category' => $category ?: ($config['defaultCategorySlug'] ?? null),
    'tags' => $tags,
    'content' => $contentBlocks,
    'heroImage' => $heroImage ?: ($item['image'] ?? ''),
    'heroImageSquare' => $heroImageSquare,
    'heroImageAuthor' => $heroImageAuthor,
    'heroFocalX' => is_numeric($heroFocalX) ? (float)$heroFocalX : null,
    'heroFocalY' => is_numeric($heroFocalY) ? (float)$heroFocalY : null,
    'status' => is_string($status) ? $status : null,
    'scheduledAt' => is_string($scheduledAt) ? $scheduledAt : null,
    'slug' => is_string($slug) ? $slug : null,
    'authorName' => $authorName,
    'authorRole' => $authorRole,
    'sourceName' => $sourceName ?: ($item['source']['name'] ?? ''),
    'sourceUrl' => $sourceUrl ?: ($item['source']['itemUrl'] ?? ''),
    'locationCity' => $locationCity,
    'locationDistrict' => $locationDistrict,
    'locationAddress' => $locationAddress,
    'isVerified' => $isVerified,
    'isFeatured' => $isFeatured,
    'isBreaking' => $isBreaking,
    'pinnedNowReading' => $pinnedNowReading,
    'pinnedNowReadingRank' => is_numeric($pinnedNowReadingRank) ? (int)$pinnedNowReadingRank : null,
    'flags' => $flags,
    'confidence' => $confidence !== null ? (float)$confidence : null,
    'notes' => $notes,
  ], static function ($value) {
    return $value !== null && $value !== '';
  });
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

function normalize_service_base(string $serviceUrl): string {
  $base = rtrim(trim($serviceUrl), '/');

  // если по ошибке сохранили полный путь /rewrite — обрежем до базы
  if (substr($base, -7) === '/rewrite') {
    $base = substr($base, 0, -7);
    $base = rtrim($base, '/');
  }

  // если по ошибке сохранили /healthz — тоже обрежем
  if (substr($base, -8) === '/healthz') {
    $base = substr($base, 0, -8);
    $base = rtrim($base, '/');
  }

  return $base;
}

function build_rewrite_url(string $serviceUrl): string {
  return normalize_service_base($serviceUrl) . '/rewrite';
}

function build_health_url(string $serviceUrl): string {
  return normalize_service_base($serviceUrl) . '/healthz';
}

function curl_json_get(string $url, int $timeoutSec, array $headers = []) {
  $ch = curl_init($url);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_TIMEOUT, max(5, $timeoutSec));
  if (!empty($headers)) curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
  $result = curl_exec($ch);
  $err = curl_error($ch);
  $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
  curl_close($ch);

  return [$result, $err, $status];
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  require_admin();

  $action = isset($_GET['action']) ? (string)$_GET['action'] : '';
  if (!in_array($action, ['health', 'test'], true)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Неизвестное действие'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  $config = read_json_with_legacy($configPath, []);
  $timeout = isset($config['rewriteTimeoutSec']) ? (int)$config['rewriteTimeoutSec'] : 25;

  $secrets = get_rewrite_secrets();
  if (empty($secrets['serviceUrl']) || empty($secrets['secret'])) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Rewrite service unavailable'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  // --- HEALTH CHECK ---
  if ($action === 'health') {
    $baseHeaders = [];
    if (!empty($secrets['internalToken'])) {
      $baseHeaders[] = 'X-Internal-Token: ' . $secrets['internalToken'];
    }

    // 1) основной healthz
    $healthUrl = build_health_url($secrets['serviceUrl']);
    [$result, $err, $status] = curl_json_get($healthUrl, $timeout, $baseHeaders);

    // 2) запасной вариант: GET /
    if ($result === false || $status >= 400) {
      $fallbackUrl = normalize_service_base($secrets['serviceUrl']) . '/';
      [$result2, $err2, $status2] = curl_json_get($fallbackUrl, $timeout, $baseHeaders);
      if ($result2 !== false && $status2 < 400) {
        $result = $result2; $err = $err2; $status = $status2;
      }
    }

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

  // --- TEST REWRITE ---
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

  $rewriteUrl = build_rewrite_url($secrets['serviceUrl']);
  $ch = curl_init($rewriteUrl);
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

$config = read_json_with_legacy($configPath, []);
$rewriteMaxChars = isset($config['rewriteMaxChars']) ? (int)$config['rewriteMaxChars'] : 14000;

$items = read_json_with_legacy($incomingPath, []);
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

$rewriteUrl = build_rewrite_url($serviceUrl);
$ch = curl_init($rewriteUrl);
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

$normalizedRewrite = normalize_rewrite_result($payloadResult, $item, $config);

$items[$foundIndex]['status'] = 'rewritten';
$items[$foundIndex]['rewrite'] = $normalizedRewrite;
$items[$foundIndex]['rewriteRaw'] = $payloadResult;
$items[$foundIndex]['updatedAt'] = now_utc_iso();

if (!write_json_atomic($incomingPath, $items)) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Не удалось сохранить incoming.json'], JSON_UNESCAPED_UNICODE);
  exit;
}

echo json_encode(['ok' => true, 'data' => $payloadResult], JSON_UNESCAPED_UNICODE);
