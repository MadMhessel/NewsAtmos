<?php
header('Content-Type: application/json; charset=utf-8');

if (php_sapi_name() !== 'cli') {
  http_response_code(403);
  echo json_encode(['ok' => false, 'error' => 'CLI only'], JSON_UNESCAPED_UNICODE);
  exit;
}

$sourcesPath = __DIR__ . '/rss_sources.json';
$dataDir = __DIR__ . '/data';
$incomingPath = $dataDir . '/incoming.json';
$logPath = $dataDir . '/rss_log.txt';
$maxAdditions = 50;

function log_message($path, $message) {
  $line = '[' . gmdate('c') . '] ' . $message . "\n";
  file_put_contents($path, $line, FILE_APPEND | LOCK_EX);
}

function ensure_data_dir($dir) {
  if (is_dir($dir)) return true;
  return mkdir($dir, 0755, true);
}

function read_json_file($path) {
  if (!file_exists($path)) return [];
  $raw = file_get_contents($path);
  if ($raw === false || trim($raw) === '') return [];
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
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

function now_utc_iso() {
  $dt = new DateTime('now', new DateTimeZone('UTC'));
  return $dt->format('c');
}

function normalize_hash_input($value) {
  $value = html_entity_decode((string)$value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
  $value = trim($value);
  $value = preg_replace('/\s+/u', ' ', $value);
  return mb_strtolower($value, 'UTF-8');
}

function clean_text($value) {
  $value = html_entity_decode((string)$value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
  $value = strip_tags($value);
  $value = trim($value);
  $value = preg_replace('/\s+/u', ' ', $value);
  return $value;
}

function parse_date_to_utc($value) {
  $value = trim((string)$value);
  if ($value === '') {
    return now_utc_iso();
  }
  try {
    $dt = new DateTime($value);
  } catch (Exception $e) {
    return now_utc_iso();
  }
  $dt->setTimezone(new DateTimeZone('UTC'));
  return $dt->format('c');
}

function fetch_feed($url) {
  $ch = curl_init($url);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
  curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
  curl_setopt($ch, CURLOPT_TIMEOUT, 20);
  curl_setopt($ch, CURLOPT_USERAGENT, 'NewsAtmosRSS/1.0 (+https://example.local)');
  $body = curl_exec($ch);
  $err = curl_error($ch);
  $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
  curl_close($ch);
  if ($body === false || $status >= 400) {
    return ['ok' => false, 'error' => $err ?: ('HTTP ' . $status)];
  }
  return ['ok' => true, 'body' => $body];
}

function get_rss_image($item) {
  if (isset($item->enclosure)) {
    foreach ($item->enclosure as $enc) {
      $attrs = $enc->attributes();
      $type = isset($attrs['type']) ? (string)$attrs['type'] : '';
      $url = isset($attrs['url']) ? (string)$attrs['url'] : '';
      if ($url !== '' && ($type === '' || stripos($type, 'image/') === 0)) {
        return $url;
      }
    }
  }

  $media = $item->children('media', true);
  if ($media) {
    if (isset($media->thumbnail)) {
      foreach ($media->thumbnail as $thumb) {
        $attrs = $thumb->attributes();
        if (isset($attrs['url']) && (string)$attrs['url'] !== '') {
          return (string)$attrs['url'];
        }
      }
    }
    if (isset($media->content)) {
      foreach ($media->content as $content) {
        $attrs = $content->attributes();
        $type = isset($attrs['type']) ? (string)$attrs['type'] : '';
        if (isset($attrs['url']) && (string)$attrs['url'] !== '' && ($type === '' || stripos($type, 'image/') === 0)) {
          return (string)$attrs['url'];
        }
      }
    }
  }

  return '';
}

function get_atom_image($entry) {
  $media = $entry->children('media', true);
  if ($media) {
    if (isset($media->thumbnail)) {
      foreach ($media->thumbnail as $thumb) {
        $attrs = $thumb->attributes();
        if (isset($attrs['url']) && (string)$attrs['url'] !== '') {
          return (string)$attrs['url'];
        }
      }
    }
    if (isset($media->content)) {
      foreach ($media->content as $content) {
        $attrs = $content->attributes();
        $type = isset($attrs['type']) ? (string)$attrs['type'] : '';
        if (isset($attrs['url']) && (string)$attrs['url'] !== '' && ($type === '' || stripos($type, 'image/') === 0)) {
          return (string)$attrs['url'];
        }
      }
    }
  }

  if (isset($entry->link)) {
    foreach ($entry->link as $link) {
      $attrs = $link->attributes();
      $rel = isset($attrs['rel']) ? (string)$attrs['rel'] : '';
      $type = isset($attrs['type']) ? (string)$attrs['type'] : '';
      $href = isset($attrs['href']) ? (string)$attrs['href'] : '';
      if ($href !== '' && $rel === 'enclosure' && ($type === '' || stripos($type, 'image/') === 0)) {
        return $href;
      }
    }
  }

  return '';
}

if (!file_exists($sourcesPath)) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'rss_sources.json not found'], JSON_UNESCAPED_UNICODE);
  exit;
}

$sourcesRaw = file_get_contents($sourcesPath);
$sources = json_decode($sourcesRaw, true);
if (!is_array($sources)) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'rss_sources.json invalid'], JSON_UNESCAPED_UNICODE);
  exit;
}

if (!ensure_data_dir($dataDir)) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => 'Cannot create data directory'], JSON_UNESCAPED_UNICODE);
  exit;
}

$incoming = read_json_file($incomingPath);
$existingHashes = [];
$existingUrls = [];
foreach ($incoming as $item) {
  if (isset($item['hash'])) {
    $existingHashes[(string)$item['hash']] = true;
  }
  if (isset($item['source']['itemUrl'])) {
    $url = normalize_hash_input($item['source']['itemUrl']);
    if ($url !== '') {
      $existingUrls[$url] = true;
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

  $fetch = fetch_feed($feedUrl);
  if (!$fetch['ok']) {
    log_message($logPath, 'Ошибка загрузки ' . $feedUrl . ': ' . $fetch['error']);
    continue;
  }

  $xml = @simplexml_load_string($fetch['body'], 'SimpleXMLElement', LIBXML_NOCDATA);
  if ($xml === false) {
    log_message($logPath, 'Ошибка парсинга XML ' . $feedUrl);
    continue;
  }

  $isAtom = $xml->getName() === 'feed' || isset($xml->entry);
  $items = [];

  if ($isAtom) {
    foreach ($xml->entry as $entry) {
      $items[] = $entry;
    }
  } elseif (isset($xml->channel) && isset($xml->channel->item)) {
    foreach ($xml->channel->item as $item) {
      $items[] = $item;
    }
  }

  foreach ($items as $item) {
    if ($addedCount >= $maxAdditions) break 2;

    if ($isAtom) {
      $title = trim((string)$item->title);
      $link = '';
      if (isset($item->link)) {
        foreach ($item->link as $linkEl) {
          $attrs = $linkEl->attributes();
          $rel = isset($attrs['rel']) ? (string)$attrs['rel'] : '';
          $href = isset($attrs['href']) ? (string)$attrs['href'] : '';
          if ($href === '') continue;
          if ($rel === '' || $rel === 'alternate') {
            $link = $href;
            break;
          }
        }
      }
      $guid = trim((string)$item->id);
      $published = trim((string)$item->published);
      $updated = trim((string)$item->updated);
      $summaryRaw = (string)$item->summary;
      $contentRaw = (string)$item->content;
      $publishedAt = parse_date_to_utc($published !== '' ? $published : $updated);
      $summary = clean_text($summaryRaw !== '' ? $summaryRaw : $contentRaw);
      $text = clean_text($contentRaw);
      $image = get_atom_image($item);
    } else {
      $title = trim((string)$item->title);
      $link = trim((string)$item->link);
      $guid = trim((string)$item->guid);
      $pubDate = trim((string)$item->pubDate);
      $contentNs = $item->children('content', true);
      $contentRaw = isset($contentNs->encoded) ? (string)$contentNs->encoded : '';
      $description = (string)$item->description;
      $publishedAt = parse_date_to_utc($pubDate);
      $summary = clean_text($description !== '' ? $description : $contentRaw);
      $text = clean_text($contentRaw);
      $image = get_rss_image($item);
    }

    $itemUrl = $link;
    $hashBase = $itemUrl !== '' ? $itemUrl : ($guid !== '' ? $guid : ($title . '|' . $publishedAt));
    $hash = sha1(normalize_hash_input($hashBase));

    if (isset($existingHashes[$hash])) continue;
    if ($itemUrl !== '') {
      $normalizedUrl = normalize_hash_input($itemUrl);
      if ($normalizedUrl !== '' && isset($existingUrls[$normalizedUrl])) continue;
    }

    $now = now_utc_iso();

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
        'summary' => $summary,
        'text' => $text,
      ],
      'image' => $image,
      'category' => isset($source['category']) ? $source['category'] : null,
      'tags' => isset($source['defaultTags']) && is_array($source['defaultTags']) ? $source['defaultTags'] : [],
      'status' => 'new',
      'createdAt' => $now,
      'updatedAt' => $now,
    ];

    $newItems[] = $incomingItem;
    $existingHashes[$hash] = true;
    if ($itemUrl !== '') {
      $normalizedUrl = normalize_hash_input($itemUrl);
      if ($normalizedUrl !== '') {
        $existingUrls[$normalizedUrl] = true;
      }
    }
    $addedCount++;
  }
}

if ($addedCount > 0) {
  $incoming = array_merge($newItems, $incoming);
  if (!write_json_file($incomingPath, $incoming)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Не удалось сохранить incoming.json'], JSON_UNESCAPED_UNICODE);
    exit;
  }
}

log_message($logPath, 'Добавлено новых: ' . $addedCount);

echo json_encode(['ok' => true, 'added' => $addedCount], JSON_UNESCAPED_UNICODE);
