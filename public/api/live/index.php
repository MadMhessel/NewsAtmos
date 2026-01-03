<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

require_once __DIR__ . '/../lib_json.php';

$streamsPath = __DIR__ . '/../live_streams.json';
$updatesPath = __DIR__ . '/../live_updates.json';

function parse_path_segments() {
  $pathInfo = isset($_SERVER['PATH_INFO']) ? trim($_SERVER['PATH_INFO'], '/') : '';
  if ($pathInfo === '') return [];
  return explode('/', $pathInfo);
}

function is_public_stream($stream) {
  $status = $stream['status'] ?? 'draft';
  return $status === 'published' || $status === 'finished';
}

function normalize_timestamp($value) {
  if ($value === null || $value === '') return null;
  if (is_numeric($value)) return (int)$value;
  $parsed = strtotime($value);
  return $parsed !== false ? $parsed * 1000 : null;
}

$segments = parse_path_segments();

if (count($segments) >= 2 && $segments[1] === 'updates') {
  $streamId = $segments[0];
  $afterRaw = isset($_GET['after']) ? $_GET['after'] : null;
  $after = normalize_timestamp($afterRaw);

  $updates = read_json($updatesPath, []);
  $updates = array_values(array_filter($updates, function ($item) use ($streamId, $after) {
    if (!isset($item['liveStreamId']) || $item['liveStreamId'] !== $streamId) return false;
    if ($after === null) return true;
    if (!isset($item['createdAt'])) return false;
    $created = strtotime($item['createdAt']);
    if ($created === false) return false;
    return ($created * 1000) > $after;
  }));

  usort($updates, function ($a, $b) {
    $timeA = isset($a['eventTime']) ? strtotime($a['eventTime']) : 0;
    $timeB = isset($b['eventTime']) ? strtotime($b['eventTime']) : 0;
    if ($timeA === $timeB) {
      return strcmp($a['id'] ?? '', $b['id'] ?? '');
    }
    return $timeA <=> $timeB;
  });

  echo json_encode(['streamId' => $streamId, 'order' => 'asc', 'updates' => $updates], JSON_UNESCAPED_UNICODE);
  exit;
}

$slug = $_GET['slug'] ?? ($segments[0] ?? null);
if (!$slug) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Не указан slug'], JSON_UNESCAPED_UNICODE);
  exit;
}

$streams = read_json($streamsPath, []);
$stream = null;
foreach ($streams as $item) {
  if (!isset($item['slug'])) continue;
  if ($item['slug'] === $slug) {
    $stream = $item;
    break;
  }
}

if (!$stream || !is_public_stream($stream)) {
  http_response_code(404);
  echo json_encode(['ok' => false, 'error' => 'Материал не найден'], JSON_UNESCAPED_UNICODE);
  exit;
}

$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 200;
if ($limit <= 0) $limit = 200;

$updates = read_json($updatesPath, []);
$updates = array_values(array_filter($updates, function ($item) use ($stream) {
  return isset($item['liveStreamId']) && $item['liveStreamId'] === $stream['id'];
}));

usort($updates, function ($a, $b) {
  $timeA = isset($a['eventTime']) ? strtotime($a['eventTime']) : 0;
  $timeB = isset($b['eventTime']) ? strtotime($b['eventTime']) : 0;
  if ($timeA === $timeB) {
    return strcmp($a['id'] ?? '', $b['id'] ?? '');
  }
  return $timeB <=> $timeA;
});

$updates = array_slice($updates, 0, $limit);

echo json_encode(['stream' => $stream, 'order' => 'desc', 'updates' => $updates], JSON_UNESCAPED_UNICODE);
