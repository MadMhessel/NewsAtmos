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

$path = data_path('config.json');

function default_config() {
  return [
    'siteTitle' => 'Новости',
    'defaultAuthorName' => 'Редакция',
    'defaultAuthorRole' => 'Новости',
    'defaultCategorySlug' => 'city',
    'allowedCategories' => [
      ['slug' => 'city', 'title' => 'Город'],
      ['slug' => 'transport', 'title' => 'Транспорт'],
      ['slug' => 'incidents', 'title' => 'Происшествия'],
      ['slug' => 'russia-world', 'title' => 'Россия и Мир'],
      ['slug' => 'sports', 'title' => 'Спорт'],
      ['slug' => 'events', 'title' => 'События'],
      ['slug' => 'real-estate', 'title' => 'Недвижимость'],
      ['slug' => 'nn-region', 'title' => 'Нижний Новгород и область'],
      ['slug' => 'federal', 'title' => 'Федеральные СМИ'],
      ['slug' => 'business', 'title' => 'Экономика и недвижимость'],
      ['slug' => 'society', 'title' => 'Политика и общество'],
    ],
    'pollIntervalMinutes' => 10,
    'maxNewItemsPerRun' => 50,
    'rssPollLimitPerRun' => 50,
    'incomingMaxItems' => 2000,
    'fetchTimeoutSec' => 12,
    'userAgent' => 'NewsAtmos/1.0',
    'dedupWindowDays' => 30,
    'stripHtml' => true,
    'normalizeWhitespace' => true,
    'rewriteMaxChars' => 12000,
    'rewriteRegionHint' => 'Нижний Новгород',
    'rewriteTimeoutSec' => 25,
    'rewriteTemperature' => 0.2,
    'appendSourceBlock' => true,
    'allowQuotesOnlyIfPresent' => true,
    'newsVersion' => 0,
  ];
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  require_admin();
  if (isset($_GET['action']) && $_GET['action'] === 'check_write') {
    $testPath = data_path('.write_test');
    ensure_data_dir(data_root());
    $ok = @file_put_contents($testPath, (string)time(), LOCK_EX);
    if ($ok === false) {
      http_response_code(500);
      echo json_encode(['ok' => false, 'error' => 'Не удалось записать файл в /public/api/data'], JSON_UNESCAPED_UNICODE);
      exit;
    }
    echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
    exit;
  }

  echo json_encode(read_json($path, default_config()), JSON_UNESCAPED_UNICODE);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  require_admin();

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

  $safe['pollIntervalMinutes'] = isset($data['pollIntervalMinutes']) ? (int)$data['pollIntervalMinutes'] : $safe['pollIntervalMinutes'];

  if (isset($data['maxNewItemsPerRun'])) {
    $safe['maxNewItemsPerRun'] = (int)$data['maxNewItemsPerRun'];
  } elseif (isset($data['rssPollLimitPerRun'])) {
    $safe['maxNewItemsPerRun'] = (int)$data['rssPollLimitPerRun'];
  }

  $safe['rssPollLimitPerRun'] = $safe['maxNewItemsPerRun'];
  $safe['incomingMaxItems'] = isset($data['incomingMaxItems']) ? (int)$data['incomingMaxItems'] : $safe['incomingMaxItems'];
  if (isset($data['fetchTimeoutSec'])) {
    $safe['fetchTimeoutSec'] = (int)$data['fetchTimeoutSec'];
  } elseif (isset($data['fetchTimeoutSeconds'])) {
    $safe['fetchTimeoutSec'] = (int)$data['fetchTimeoutSeconds'];
  }
  $safe['userAgent'] = isset($data['userAgent']) ? mb_substr(trim((string)$data['userAgent']), 0, 200) : $safe['userAgent'];
  $safe['dedupWindowDays'] = isset($data['dedupWindowDays']) ? (int)$data['dedupWindowDays'] : $safe['dedupWindowDays'];
  $safe['stripHtml'] = isset($data['stripHtml']) ? (bool)$data['stripHtml'] : $safe['stripHtml'];
  $safe['normalizeWhitespace'] = isset($data['normalizeWhitespace']) ? (bool)$data['normalizeWhitespace'] : $safe['normalizeWhitespace'];

  $safe['rewriteMaxChars'] = isset($data['rewriteMaxChars']) ? (int)$data['rewriteMaxChars'] : $safe['rewriteMaxChars'];
  $safe['rewriteRegionHint'] = isset($data['rewriteRegionHint']) ? mb_substr(trim((string)$data['rewriteRegionHint']), 0, 200) : $safe['rewriteRegionHint'];
  $safe['rewriteTimeoutSec'] = isset($data['rewriteTimeoutSec']) ? (int)$data['rewriteTimeoutSec'] : $safe['rewriteTimeoutSec'];
  $safe['rewriteTemperature'] = isset($data['rewriteTemperature']) ? (float)$data['rewriteTemperature'] : $safe['rewriteTemperature'];
  if (isset($data['appendSourceBlock'])) {
    $safe['appendSourceBlock'] = !empty($data['appendSourceBlock']);
  } elseif (isset($data['rewriteIncludeSourceBlock'])) {
    $safe['appendSourceBlock'] = !empty($data['rewriteIncludeSourceBlock']);
  }

  if (isset($data['allowQuotesOnlyIfPresent'])) {
    $safe['allowQuotesOnlyIfPresent'] = !empty($data['allowQuotesOnlyIfPresent']);
  } elseif (isset($data['rewriteQuotesPolicy'])) {
    $safe['allowQuotesOnlyIfPresent'] = $data['rewriteQuotesPolicy'] === 'source_only';
  }
  $safe['newsVersion'] = isset($data['newsVersion']) ? (int)$data['newsVersion'] : $safe['newsVersion'];

  if (!write_json_atomic($path, $safe)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Не удалось сохранить файл (права доступа?)'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
  exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'Метод не поддерживается'], JSON_UNESCAPED_UNICODE);
