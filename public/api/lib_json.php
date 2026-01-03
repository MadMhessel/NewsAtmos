<?php

function data_root(): string {
  return dirname(__DIR__) . '/data';
}

function legacy_data_root(): string {
  return __DIR__ . '/data';
}

function data_path(string $file): string {
  return rtrim(data_root(), '/\\') . '/' . ltrim($file, '/\\');
}

function legacy_data_path(string $file): string {
  return rtrim(legacy_data_root(), '/\\') . '/' . ltrim($file, '/\\');
}

function ensure_data_dir(string $dir): bool {
  if (is_dir($dir)) return true;
  return mkdir($dir, 0755, true);
}

function read_json(string $path, $fallback = []) {
  if (!file_exists($path)) return $fallback;
  $raw = file_get_contents($path);
  if ($raw === false || trim($raw) === '') return $fallback;
  $data = json_decode($raw, true);
  return is_array($data) ? $data : $fallback;
}

function read_json_with_legacy(string $path, $fallback = []) {
  if (file_exists($path)) {
    return read_json($path, $fallback);
  }
  $legacyPath = legacy_data_path(basename($path));
  if (!file_exists($legacyPath)) return $fallback;
  return read_json($legacyPath, $fallback);
}

function write_json_atomic(string $path, $data): bool {
  $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
  if ($json === false) return false;
  $dir = dirname($path);
  if (!ensure_data_dir($dir)) return false;
  $tmp = $path . '.tmp';
  $ok = file_put_contents($tmp, $json, LOCK_EX);
  if ($ok === false) return false;
  return rename($tmp, $path);
}

function now_utc_iso(): string {
  $dt = new DateTime('now', new DateTimeZone('UTC'));
  return $dt->format('c');
}
