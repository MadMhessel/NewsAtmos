<?php

function normalize_text(string $value, bool $stripHtml = true, bool $normalizeWhitespace = true): string {
  $value = html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
  if ($stripHtml) {
    $value = strip_tags($value);
  }
  if ($normalizeWhitespace) {
    $value = preg_replace('/\s+/u', ' ', $value);
  }
  return trim($value);
}

function make_hash(string $value): string {
  $value = normalize_text($value, true, true);
  $value = mb_strtolower($value, 'UTF-8');
  return sha1($value);
}

function fetch_url_curl(string $url, array $options = []): array {
  $timeout = isset($options['timeout']) ? (int)$options['timeout'] : 15;
  $userAgent = isset($options['userAgent']) ? (string)$options['userAgent'] : 'NewsAtmosRSS/1.0';

  $ch = curl_init($url);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
  curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, $timeout);
  curl_setopt($ch, CURLOPT_TIMEOUT, $timeout + 5);
  curl_setopt($ch, CURLOPT_USERAGENT, $userAgent);
  $body = curl_exec($ch);
  $err = curl_error($ch);
  $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
  curl_close($ch);
  if ($body === false || $status >= 400) {
    return ['ok' => false, 'error' => $err ?: ('HTTP ' . $status)];
  }
  return ['ok' => true, 'body' => $body, 'status' => $status];
}

function parse_date_to_utc(string $value): string {
  $value = trim($value);
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

function extract_image(SimpleXMLElement $item, bool $isAtom): string {
  if ($isAtom) {
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

    if (isset($item->link)) {
      foreach ($item->link as $link) {
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

function parse_rss_atom(string $body, array $options = []): array {
  $stripHtml = isset($options['stripHtml']) ? (bool)$options['stripHtml'] : true;
  $normalizeWhitespace = isset($options['normalizeWhitespace']) ? (bool)$options['normalizeWhitespace'] : true;

  $xml = @simplexml_load_string($body, 'SimpleXMLElement', LIBXML_NOCDATA);
  if ($xml === false) {
    return ['ok' => false, 'error' => 'XML parse error', 'items' => []];
  }

  $isAtom = $xml->getName() === 'feed' || isset($xml->entry);
  $items = [];

  if ($isAtom) {
    foreach ($xml->entry as $entry) {
      $title = trim((string)$entry->title);
      $link = '';
      if (isset($entry->link)) {
        foreach ($entry->link as $linkEl) {
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
      $guid = trim((string)$entry->id);
      $published = trim((string)$entry->published);
      $updated = trim((string)$entry->updated);
      $summaryRaw = (string)$entry->summary;
      $contentRaw = (string)$entry->content;
      $publishedAt = parse_date_to_utc($published !== '' ? $published : $updated);
      $summary = normalize_text($summaryRaw !== '' ? $summaryRaw : $contentRaw, $stripHtml, $normalizeWhitespace);
      $text = normalize_text($contentRaw, $stripHtml, $normalizeWhitespace);
      $image = extract_image($entry, true);

      $items[] = [
        'title' => $title,
        'link' => $link,
        'guid' => $guid,
        'publishedAt' => $publishedAt,
        'summary' => $summary,
        'text' => $text,
        'image' => $image,
      ];
    }
  } elseif (isset($xml->channel) && isset($xml->channel->item)) {
    foreach ($xml->channel->item as $item) {
      $title = trim((string)$item->title);
      $link = trim((string)$item->link);
      $guid = trim((string)$item->guid);
      $pubDate = trim((string)$item->pubDate);
      $contentNs = $item->children('content', true);
      $contentRaw = isset($contentNs->encoded) ? (string)$contentNs->encoded : '';
      $description = (string)$item->description;
      $publishedAt = parse_date_to_utc($pubDate);
      $summary = normalize_text($description !== '' ? $description : $contentRaw, $stripHtml, $normalizeWhitespace);
      $text = normalize_text($contentRaw, $stripHtml, $normalizeWhitespace);
      $image = extract_image($item, false);

      $items[] = [
        'title' => $title,
        'link' => $link,
        'guid' => $guid,
        'publishedAt' => $publishedAt,
        'summary' => $summary,
        'text' => $text,
        'image' => $image,
      ];
    }
  }

  return ['ok' => true, 'items' => $items];
}
