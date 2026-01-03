<?php
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/_auth.php';
require_once __DIR__ . '/lib_json.php';
require_once __DIR__ . '/lib_feed.php';

if (php_sapi_name() !== 'cli') {
  require_cron_token();
}

$sourcesPath = data_path('rss_sources.json');
$incomingPath = data_path('incoming.json');
$seenPath = data_path('seen.json');
$configPath = data_path('config.json');
$logPath = data_path('rss_log.txt');

function log_message($path, $message) {
  $line = '[' . gmdate('c') . '] ' . $message . "\n";
  file_put_contents($path, $line, FILE_APPEND | LOCK_EX);
}

if (!ensure_data_dir(data_root())) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Cannot create data directory'], JSON_UNESCAPED_UNICODE);
  exit;
}

$config = read_json_with_legacy($configPath, []);
$pollIntervalMinutes = isset($config['pollIntervalMinutes']) ? (int)$config['pollIntervalMinutes'] : 0;
if ($pollIntervalMinutes > 0 && file_exists($logPath)) {
  $lastRun = filemtime($logPath);
  if ($lastRun && (time() - $lastRun) < ($pollIntervalMinutes * 60)) {
    log_message($logPath, 'Пропуск: интервал опроса ещё не истёк.');
    echo json_encode(['ok' => true, 'skipped' => true], JSON_UNESCAPED_UNICODE);
    exit;
  }
}

$maxAdditions = isset($config['maxNewItemsPerRun']) ? (int)$config['maxNewItemsPerRun'] : (int)($config['rssPollLimitPerRun'] ?? 50);
$incomingMaxItems = isset($config['incomingMaxItems']) ? (int)$config['incomingMaxItems'] : 2000;
$fetchTimeout = isset($config['fetchTimeoutSec'])
  ? (int)$config['fetchTimeoutSec']
  : (isset($config['fetchTimeoutSeconds']) ? (int)$config['fetchTimeoutSeconds'] : 12);
$userAgent = isset($config['userAgent']) ? (string)$config['userAgent'] : 'NewsAtmosRSS/1.0';
$dedupWindowDays = isset($config['dedupWindowDays']) ? (int)$config['dedupWindowDays'] : 30;
$stripHtml = isset($config['stripHtml']) ? (bool)$config['stripHtml'] : true;
$normalizeWhitespace = isset($config['normalizeWhitespace']) ? (bool)$config['normalizeWhitespace'] : true;

$sources = read_json_with_legacy($sourcesPath, []);
if (!is_array($sources)) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'rss_sources.json invalid'], JSON_UNESCAPED_UNICODE);
  exit;
}

$incoming = read_json_with_legacy($incomingPath, []);
$seen = read_json_with_legacy($seenPath, []);
if (!is_array($seen)) $seen = [];

$nowTs = time();
$dedupWindowSeconds = max(0, $dedupWindowDays) * 86400;
if ($dedupWindowSeconds > 0) {
  foreach ($seen as $hash => $timestamp) {
    if (!is_numeric($timestamp) || $timestamp < ($nowTs - $dedupWindowSeconds)) {
      unset($seen[$hash]);
    }
  }
}

$newItems = [];
$addedCount = 0;

foreach ($sources as $source) {
  if (!is_array($source)) continue;
  if (empty($source['enabled'])) continue;

  $feedUrl = isset($source['feedUrl']) ? trim((string)$source['feedUrl']) : '';
  if ($feedUrl === '') continue;

  $fetch = fetch_url_curl($feedUrl, ['timeout' => $fetchTimeout, 'userAgent' => $userAgent]);
  if (empty($fetch['ok'])) {
    log_message($logPath, 'Ошибка загрузки ' . $feedUrl . ': ' . ($fetch['error'] ?? 'unknown'));
    continue;
  }

  $parsed = parse_rss_atom($fetch['body'], [
    'stripHtml' => $stripHtml,
    'normalizeWhitespace' => $normalizeWhitespace,
  ]);

  if (empty($parsed['ok'])) {
    log_message($logPath, 'Ошибка парсинга XML ' . $feedUrl);
    continue;
  }

  foreach ($parsed['items'] as $item) {
    if ($addedCount >= $maxAdditions) break 2;

    $title = isset($item['title']) ? $item['title'] : '';
    $itemUrl = isset($item['link']) ? $item['link'] : '';
    $guid = isset($item['guid']) ? $item['guid'] : '';
    $publishedAt = isset($item['publishedAt']) ? $item['publishedAt'] : now_utc_iso();

    $hashBase = $itemUrl !== '' ? $itemUrl : ($guid !== '' ? $guid : ($title . '|' . $publishedAt));
    $hash = make_hash($hashBase);

    if (isset($seen[$hash])) continue;

    $nowIso = now_utc_iso();

    $incomingItem = [
      'id' => $hash,
      'hash' => $hash,
      'publishedAt' => $publishedAt,
      'source' => [
        'name' => isset($source['name']) ? $source['name'] : '',
        'feedUrl' => $feedUrl,
        'itemUrl' => $itemUrl,
      ],
      'raw' => [
        'title' => $title,
        'summary' => isset($item['summary']) ? $item['summary'] : '',
        'text' => isset($item['text']) ? $item['text'] : '',
      ],
      'image' => isset($item['image']) ? $item['image'] : '',
      'category' => (
  isset($source['category'])
    ? (
        is_array($source['category'])
          ? ($source['category']['slug'] ?? null)
          : (is_string($source['category']) ? (trim($source['category']) !== '' ? trim($source['category']) : null) : null)
      )
    : null
),
      'tags' => isset($source['defaultTags']) && is_array($source['defaultTags']) ? $source['defaultTags'] : [],
      'status' => 'new',
      'publishedNewsId' => null,
      'createdAt' => $nowIso,
      'updatedAt' => $nowIso,
    ];

    $newItems[] = $incomingItem;
    $seen[$hash] = $nowTs;
    $addedCount++;
  }
}

if ($addedCount > 0) {
  $incoming = array_merge($newItems, $incoming);
  if ($incomingMaxItems > 0 && count($incoming) > $incomingMaxItems) {
    $incoming = array_slice($incoming, 0, $incomingMaxItems);
  }
  if (!write_json_atomic($incomingPath, $incoming)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Не удалось сохранить incoming.json'], JSON_UNESCAPED_UNICODE);
    exit;
  }
}

if (!write_json_atomic($seenPath, $seen)) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Не удалось сохранить seen.json'], JSON_UNESCAPED_UNICODE);
  exit;
}

log_message($logPath, 'Добавлено новых: ' . $addedCount);

echo json_encode(['ok' => true, 'added' => $addedCount], JSON_UNESCAPED_UNICODE);
