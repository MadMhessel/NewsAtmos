<?php
// Простая серверная проверка для операций изменения данных.
// ВАЖНО: это не заменяет полноценную авторизацию, но закрывает самый опасный сценарий:
// когда кто угодно может POST-ом перезаписать новости/настройки/загрузки.

const ADMIN_TOKEN_SHA256 = 'da03c698dbef2649ddf0af56552483c31de6954d03d065da949b6a5c6d285b6b';

function get_header_value($name) {
  // getallheaders() доступен не везде, поэтому подстрахуемся
  $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
  if (isset($_SERVER[$key])) return $_SERVER[$key];
  if (function_exists('getallheaders')) {
    $headers = getallheaders();
    foreach ($headers as $k => $v) {
      if (strcasecmp($k, $name) === 0) return $v;
    }
  }
  return null;
}

function require_admin_token() {
  $token = get_header_value('X-Admin-Token');
  if (!$token || $token !== ADMIN_TOKEN_SHA256) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Доступ запрещён'], JSON_UNESCAPED_UNICODE);
    exit;
  }
}
