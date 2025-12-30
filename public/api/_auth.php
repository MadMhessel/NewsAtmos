<?php
// Простая серверная проверка для операций изменения данных.
// ВАЖНО: это не заменяет полноценную авторизацию, но закрывает самый опасный сценарий:
// когда кто угодно может POST-ом перезаписать новости/настройки/загрузки.

const ADMIN_TOKEN_SHA256 = 'da03c698dbef2649ddf0af56552483c31de6954d03d065da949b6a5c6d285b6b';

function get_header_value(string $name): ?string {
  $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
  if (isset($_SERVER[$key])) return (string)$_SERVER[$key];
  if (function_exists('getallheaders')) {
    $headers = getallheaders();
    foreach ($headers as $k => $v) {
      if (strcasecmp($k, $name) === 0) return (string)$v;
    }
  }
  return null;
}

function load_secrets(): array {
  $path = __DIR__ . '/data/secrets.php';
  if (!file_exists($path)) return [];
  $data = require $path;
  return is_array($data) ? $data : [];
}

function get_admin_tokens(): array {
  $secrets = load_secrets();
  $plain = getenv('ADMIN_TOKEN');
  if (!$plain && isset($secrets['adminToken'])) $plain = $secrets['adminToken'];
  if (!$plain && isset($secrets['admin_token'])) $plain = $secrets['admin_token'];

  $hash = getenv('ADMIN_TOKEN_SHA256');
  if (!$hash && isset($secrets['adminTokenSha256'])) $hash = $secrets['adminTokenSha256'];
  if (!$hash && isset($secrets['admin_token_sha256'])) $hash = $secrets['admin_token_sha256'];

  return [
    'plain' => $plain ?: null,
    'hash' => $hash ?: ADMIN_TOKEN_SHA256,
  ];
}

function is_admin_token_valid(?string $token): bool {
  if (!$token) return false;
  $tokens = get_admin_tokens();
  if ($tokens['plain']) {
    return hash_equals((string)$tokens['plain'], $token);
  }
  if ($tokens['hash']) {
    return hash_equals((string)$tokens['hash'], hash('sha256', $token));
  }
  return false;
}

function require_admin(): void {
  $token = get_header_value('X-Admin-Token');
  if (!is_admin_token_valid($token)) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Доступ запрещён'], JSON_UNESCAPED_UNICODE);
    exit;
  }
}

function get_cron_token(): ?string {
  $secrets = load_secrets();
  $token = getenv('CRON_TOKEN');
  if (!$token && isset($secrets['cronToken'])) $token = $secrets['cronToken'];
  if (!$token && isset($secrets['cron_token'])) $token = $secrets['cron_token'];
  return $token ?: null;
}

function require_cron_token(): void {
  $expected = get_cron_token();
  if (!$expected) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Cron token not configured'], JSON_UNESCAPED_UNICODE);
    exit;
  }
  $token = get_header_value('X-Cron-Token');
  if (!$token || !hash_equals($expected, $token)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Доступ запрещён'], JSON_UNESCAPED_UNICODE);
    exit;
  }
}
