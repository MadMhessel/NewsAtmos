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

$path = __DIR__ . '/data/config.json';

function default_config() {
  return [
    'siteTitle' => 'Новости',
    'defaultAuthorName' => 'Редакция',
    'defaultAuthorRole' => 'Editor',
    'defaultCategorySlug' => 'city',
    'allowedCategories' => [
      ['slug' => 'city', 'title' => 'Город'],
      ['slug' => 'society', 'title' => 'Общество'],
      ['slug' => 'economy', 'title' => 'Экономика'],
    ],
    'rssPollLimitPerRun' => 50,
    'incomingMaxItems' => 2000,
    'rewriteMaxChars' => 14000,
    'rewriteRegionHint' => 'Россия',
    'rewriteTemperature' => 0.5,
    'rewriteIncludeSourceBlock' => true,
    'rewriteUseSourceImage' => true,
    'rewriteQuotesPolicy' => 'source_only',
    'newsVersion' => 0,
  ];
}

function ensure_data_dir($dir) {
  if (is_dir($dir)) return true;
  return mkdir($dir, 0755, true);
}

function read_json_file($path, $fallback) {
  if (!file_exists($path)) return $fallback;
  $raw = file_get_contents($path);
  if ($raw === false || trim($raw) === '') return $fallback;
  $data = json_decode($raw, true);
  return is_array($data) ? $data : $fallback;
}

function write_json_file($path, $data) {
  $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
  if ($json === false) return false;
  $dir = dirname($path);
  if (!ensure_data_dir($dir)) return false;
  $tmp = $path . '.tmp';
  $ok = file_put_contents($tmp, $json, LOCK_EX);
  if ($ok === false) return false;
  return rename($tmp, $path);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  echo json_encode(read_json_file($path, default_config()), JSON_UNESCAPED_UNICODE);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  require_admin_token();

  $raw = file_get_contents('php://input');
  $data = json_decode($raw, true);
  if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Некорректные данные'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  $safe = default_config();

  $safe['siteTitle'] = isset($data['siteTitle']) ? mb_substr(trim((string)$data['siteTitle']), 0, 120) : $safe['siteTitle'];
  $safe['defaultAuthorName'] = isset($data['defaultAuthorName']) ? mb_substr(trim((string)$data['defaultAuthorName']), 0, 120) : $safe['defaultAuthorName'];
  $safe['defaultAuthorRole'] = isset($data['defaultAuthorRole']) ? mb_substr(trim((string)$data['defaultAuthorRole']), 0, 120) : $safe['defaultAuthorRole'];
  $safe['defaultCategorySlug'] = isset($data['defaultCategorySlug']) ? mb_substr(trim((string)$data['defaultCategorySlug']), 0, 80) : $safe['defaultCategorySlug'];

  if (isset($data['allowedCategories']) && is_array($data['allowedCategories'])) {
    $safe['allowedCategories'] = [];
    foreach ($data['allowedCategories'] as $cat) {
      if (!is_array($cat)) continue;
      $slug = isset($cat['slug']) ? mb_substr(trim((string)$cat['slug']), 0, 80) : '';
      $title = isset($cat['title']) ? mb_substr(trim((string)$cat['title']), 0, 120) : '';
      if ($slug === '' || $title === '') continue;
      $safe['allowedCategories'][] = ['slug' => $slug, 'title' => $title];
    }
    if (count($safe['allowedCategories']) === 0) {
      $safe['allowedCategories'] = default_config()['allowedCategories'];
    }
  }

  $safe['rssPollLimitPerRun'] = isset($data['rssPollLimitPerRun']) ? (int)$data['rssPollLimitPerRun'] : $safe['rssPollLimitPerRun'];
  $safe['incomingMaxItems'] = isset($data['incomingMaxItems']) ? (int)$data['incomingMaxItems'] : $safe['incomingMaxItems'];
  $safe['rewriteMaxChars'] = isset($data['rewriteMaxChars']) ? (int)$data['rewriteMaxChars'] : $safe['rewriteMaxChars'];
  $safe['rewriteRegionHint'] = isset($data['rewriteRegionHint']) ? mb_substr(trim((string)$data['rewriteRegionHint']), 0, 200) : $safe['rewriteRegionHint'];
  $safe['rewriteTemperature'] = isset($data['rewriteTemperature']) ? (float)$data['rewriteTemperature'] : $safe['rewriteTemperature'];
  $safe['rewriteIncludeSourceBlock'] = !empty($data['rewriteIncludeSourceBlock']);
  $safe['rewriteUseSourceImage'] = !empty($data['rewriteUseSourceImage']);
  $safe['rewriteQuotesPolicy'] = isset($data['rewriteQuotesPolicy']) && in_array($data['rewriteQuotesPolicy'], ['source_only', 'allow'], true)
    ? $data['rewriteQuotesPolicy']
    : $safe['rewriteQuotesPolicy'];
  $safe['newsVersion'] = isset($data['newsVersion']) ? (int)$data['newsVersion'] : $safe['newsVersion'];

  if (!write_json_file($path, $safe)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Не удалось сохранить файл (права доступа?)'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
  exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'Метод не поддерживается'], JSON_UNESCAPED_UNICODE);
