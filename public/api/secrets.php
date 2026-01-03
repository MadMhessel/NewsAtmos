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

$path = data_path('secrets.php');
$keys = ['REWRITE_SERVICE_URL', 'HMAC_SECRET', 'INTERNAL_TOOL_TOKEN'];

function write_php_array_atomic(string $path, array $data): bool {
  $dir = dirname($path);
  if (!ensure_data_dir($dir)) return false;
  $payload = "<?php\nreturn " . var_export($data, true) . ";\n";
  $tmp = $path . '.tmp';
  $ok = file_put_contents($tmp, $payload, LOCK_EX);
  if ($ok === false) return false;
  return rename($tmp, $path);
}

function get_secret_value(string $key, array $secrets): ?string {
  $env = getenv($key);
  if ($env !== false && $env !== '') return (string)$env;
  return isset($secrets[$key]) ? (string)$secrets[$key] : null;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  require_admin();
  $secrets = load_secrets();
  $response = [];
  foreach ($keys as $key) {
    $response[$key] = get_secret_value($key, $secrets) ? true : false;
  }
  echo json_encode($response, JSON_UNESCAPED_UNICODE);
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

  $secrets = load_secrets();
  foreach ($keys as $key) {
    if (array_key_exists($key, $data)) {
      $value = trim((string)$data[$key]);
      if ($value === '') {
        unset($secrets[$key]);
      } else {
        $secrets[$key] = $value;
      }
    }
  }

  if (!write_php_array_atomic($path, $secrets)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Не удалось сохранить файл (права доступа?)'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
  exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'Метод не поддерживается'], JSON_UNESCAPED_UNICODE);
