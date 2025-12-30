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

$path = __DIR__ . '/settings.json';

function default_settings() {
  return [
    'siteName' => 'Атмосфера2Н',
    'siteTagline' => 'Независимое городское издание',
    'telegramUrl' => 'https://t.me/atmosphera2n',
    'telegramButtonText' => 'Перейти в канал',
    'contacts' => [
      'editorialEmail' => 'editor@atmos2n.ru',
      'editorialPhone' => '+7 (999) 000-00-00',
      'editorialAddress' => 'Нижний Новгород',
      'adsEmail' => 'ads@atmos2n.ru',
    ],
    'footerAboutTitle' => 'Атмосфера2Н',
    'footerAboutText' => "Независимое городское издание.\nФакты, люди, смыслы.",
    'footerAgeBadge' => '18+',
  ];
}

function read_json_file($path, $fallback) {
  if (!file_exists($path)) return $fallback;
  $raw = file_get_contents($path);
  if ($raw === false || trim($raw) === '') return $fallback;
  $data = json_decode($raw, true);
  if (!is_array($data)) return $fallback;
  return $data;
}

function write_json_file($path, $data) {
  $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
  if ($json === false) return false;
  $dir = dirname($path);
  if (!is_dir($dir)) return false;
  return file_put_contents($path, $json) !== false;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  echo json_encode(read_json_file($path, default_settings()), JSON_UNESCAPED_UNICODE);
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

  // Минимальная нормализация — сервер не должен принимать гигабайты и мусор.
  $maxLen = 5000;
  $safe = default_settings();

  $safe['siteName'] = isset($data['siteName']) ? mb_substr(trim((string)$data['siteName']), 0, 120) : $safe['siteName'];
  $safe['siteTagline'] = isset($data['siteTagline']) ? mb_substr(trim((string)$data['siteTagline']), 0, 160) : $safe['siteTagline'];
  $safe['telegramUrl'] = isset($data['telegramUrl']) ? mb_substr(trim((string)$data['telegramUrl']), 0, 400) : $safe['telegramUrl'];
  $safe['telegramButtonText'] = isset($data['telegramButtonText']) ? mb_substr(trim((string)$data['telegramButtonText']), 0, 60) : $safe['telegramButtonText'];

  if (isset($data['contacts']) && is_array($data['contacts'])) {
    $c = $data['contacts'];
    $safe['contacts']['editorialEmail'] = isset($c['editorialEmail']) ? mb_substr(trim((string)$c['editorialEmail']), 0, 120) : $safe['contacts']['editorialEmail'];
    $safe['contacts']['editorialPhone'] = isset($c['editorialPhone']) ? mb_substr(trim((string)$c['editorialPhone']), 0, 80) : $safe['contacts']['editorialPhone'];
    $safe['contacts']['editorialAddress'] = isset($c['editorialAddress']) ? mb_substr(trim((string)$c['editorialAddress']), 0, 200) : $safe['contacts']['editorialAddress'];
    $safe['contacts']['adsEmail'] = isset($c['adsEmail']) ? mb_substr(trim((string)$c['adsEmail']), 0, 120) : $safe['contacts']['adsEmail'];
  }

  $safe['footerAboutTitle'] = isset($data['footerAboutTitle']) ? mb_substr(trim((string)$data['footerAboutTitle']), 0, 120) : $safe['footerAboutTitle'];
  $safe['footerAboutText'] = isset($data['footerAboutText']) ? mb_substr((string)$data['footerAboutText'], 0, $maxLen) : $safe['footerAboutText'];
  $safe['footerAgeBadge'] = isset($data['footerAgeBadge']) ? mb_substr(trim((string)$data['footerAgeBadge']), 0, 20) : $safe['footerAgeBadge'];

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
