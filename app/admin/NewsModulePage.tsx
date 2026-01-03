import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Article, ArticleStatus, ContentBlock } from '@/lib/types';
import { newsService } from '@/lib/newsService';
import { formatDateShort, slugify } from '@/lib/utils';
import { Check, Copy, ExternalLink, Loader2, Plus, RefreshCw, Search, Trash2, Wand2, X } from 'lucide-react';

const API_INCOMING = '/api/incoming.php';
const API_NEWS = '/api/news.php';
const API_REWRITE = '/api/rewrite.php';
const API_CONFIG = '/api/config.php';
const API_SECRETS = '/api/secrets.php';
const API_RSS = '/api/rss_sources.php';
const API_RSS_PULL = '/api/rss_pull.php';

type IncomingItem = {
  id: string;
  publishedAt?: string;
  source?: { name?: string; itemUrl?: string; title?: string };
  raw?: { title?: string; summary?: string; text?: string };
  image?: string;
  category?: string;
  status?: string;
  publishedNewsId?: string | null;
  rewrite?: {
    title?: string;
    excerpt?: string;
    category?: string;
    tags?: string[];
    content?: ContentBlock[];
    heroImage?: string;
    flags?: string[];
    confidence?: number;
  };
  rewriteError?: string;
};

type Config = {
  siteTitle: string;
  defaultAuthorName: string;
  defaultAuthorRole: string;
  defaultCategorySlug: string;
  allowedCategories: { slug: string; title: string }[];
  rssPollLimitPerRun: number;
  incomingMaxItems: number;
  maxNewItemsPerRun: number;
  dedupWindowDays: number;
  fetchTimeoutSec: number;
  userAgent: string;
  rewriteMaxChars: number;
  rewriteRegionHint: string;
  rewriteTimeoutSec: number;
  rewriteTemperature: number;
  appendSourceBlock: boolean;
  allowQuotesOnlyIfPresent: boolean;
  newsVersion: number;
};

type RssSource = {
  name: string;
  feedUrl: string;
  enabled: boolean;
  category?: { slug: string; title: string };
  defaultTags?: string[];
};

type DefaultRssSource = {
  name: string;
  feedUrl: string;
  categorySlug: string;
  enabled?: boolean;
  defaultTags?: string[];
};

const getAdminToken = () => {
  try {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token');
  } catch {
    return null;
  }
};

const apiFetch = async (url: string, options: RequestInit = {}) => {
  const token = getAdminToken();
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('X-Admin-Token', token);
  const res = await fetch(url, { ...options, headers });
  return res;
};

const normalizeBlocks = (blocks?: ContentBlock[]) => {
  if (!Array.isArray(blocks)) return [] as ContentBlock[];
  return blocks.map((block) => {
    if (block.type === 'list') {
      return { ...block, items: Array.isArray(block.items) ? block.items : [''] };
    }
    if (block.type === 'quote') {
      return { ...block, value: block.value || '', author: block.author || '' };
    }
    return { ...block, value: (block as any).value || '' } as ContentBlock;
  });
};

const ensureStringArray = (value?: string[]) => (Array.isArray(value) ? value.filter(Boolean) : []);

const defaultConfig: Config = {
  siteTitle: 'Новости',
  defaultAuthorName: 'Редакция',
  defaultAuthorRole: 'Новости',
  defaultCategorySlug: 'city',
  allowedCategories: [
    { slug: 'city', title: 'Город' },
    { slug: 'transport', title: 'Транспорт' },
    { slug: 'incidents', title: 'Происшествия' },
    { slug: 'russia-world', title: 'Россия и Мир' },
    { slug: 'sports', title: 'Спорт' },
    { slug: 'events', title: 'События' },
    { slug: 'real-estate', title: 'Недвижимость' },
    { slug: 'nn-region', title: 'Нижний Новгород и область' },
    { slug: 'federal', title: 'Федеральные СМИ' },
    { slug: 'business', title: 'Экономика и недвижимость' },
    { slug: 'society', title: 'Политика и общество' },
  ],
  rssPollLimitPerRun: 50,
  incomingMaxItems: 2000,
  maxNewItemsPerRun: 50,
  dedupWindowDays: 30,
  fetchTimeoutSec: 12,
  userAgent: 'NewsAtmos/1.0',
  rewriteMaxChars: 12000,
  rewriteRegionHint: 'Нижний Новгород',
  rewriteTimeoutSec: 25,
  rewriteTemperature: 0.2,
  appendSourceBlock: true,
  allowQuotesOnlyIfPresent: true,
  newsVersion: 0,
};

const DEFAULT_RSS_SOURCES: DefaultRssSource[] = [
  {
    name: 'НИА «Нижний Новгород»',
    feedUrl: 'https://www.niann.ru/rss',
    categorySlug: 'nn-region',
  },
  {
    name: '«Время Н»',
    feedUrl: 'https://www.vremyan.ru/rss/news.rss',
    categorySlug: 'nn-region',
  },
  {
    name: 'ИА «НТА-Приволжье» (НН/ПФО)',
    feedUrl: 'https://nta-pfo.ru/rss/',
    categorySlug: 'nn-region',
  },
  {
    name: 'Newsroom24 (НН)',
    feedUrl: 'https://newsroom24.ru/rss4/',
    categorySlug: 'nn-region',
  },
  {
    name: 'ТАСС',
    feedUrl: 'https://tass.ru/rss/google.xml',
    categorySlug: 'federal',
  },
  {
    name: 'Интерфакс (страница RSS)',
    feedUrl: 'https://www.interfax.ru/rss.asp',
    categorySlug: 'federal',
  },
  {
    name: 'РБК (новости)',
    feedUrl: 'https://rssexport.rbc.ru/rbcnews/news/30/full.rss',
    categorySlug: 'federal',
  },
  {
    name: 'Лента.ру (список и шаблоны лент)',
    feedUrl: 'https://lenta.ru/info/posts/export/',
    categorySlug: 'federal',
  },
  {
    name: 'Коммерсантъ (главное)',
    feedUrl: 'https://www.kommersant.ru/RSS/main.xml',
    categorySlug: 'federal',
  },
  {
    name: 'Коммерсантъ (каталог лент)',
    feedUrl: 'https://www.kommersant.ru/rss-list',
    categorySlug: 'federal',
  },
  {
    name: 'Московский комсомолец (каталог лент)',
    feedUrl: 'https://www.mk.ru/rss/',
    categorySlug: 'federal',
  },
  {
    name: 'Ведомости (каталог лент)',
    feedUrl: 'https://www.vedomosti.ru/info/rss',
    categorySlug: 'federal',
  },
  {
    name: 'Газета.Ru',
    feedUrl: 'https://www.gazeta.ru/rss',
    categorySlug: 'federal',
  },
  {
    name: 'Ведомости — все новости',
    feedUrl: 'https://www.vedomosti.ru/rss/news',
    categorySlug: 'business',
  },
  {
    name: 'Ведомости — недвижимость',
    feedUrl: 'https://www.vedomosti.ru/rss/rubric/realty',
    categorySlug: 'business',
  },
  {
    name: 'Ведомости — стройки и инфраструктура',
    feedUrl: 'https://www.vedomosti.ru/rss/rubric/realty/infrastructure',
    categorySlug: 'business',
  },
  {
    name: 'Ведомости — архитектура и дизайн',
    feedUrl: 'https://www.vedomosti.ru/rss/rubric/realty/architecture',
    categorySlug: 'business',
  },
  {
    name: 'РБК (единая новостная лента)',
    feedUrl: 'https://rssexport.rbc.ru/rbcnews/news/30/full.rss',
    categorySlug: 'business',
  },
  {
    name: 'Коммерсантъ (каталог лент по разделам)',
    feedUrl: 'https://www.kommersant.ru/rss-list',
    categorySlug: 'business',
  },
  {
    name: 'Интерфакс (страница RSS)',
    feedUrl: 'https://www.interfax.ru/rss.asp',
    categorySlug: 'business',
  },
  {
    name: 'Лента.ру — новости',
    feedUrl: 'https://lenta.ru/rss/news',
    categorySlug: 'society',
  },
  {
    name: 'Лента.ру — топ-7',
    feedUrl: 'https://lenta.ru/rss/top7',
    categorySlug: 'society',
  },
  {
    name: 'Лента.ру — главные за 24 часа',
    feedUrl: 'https://lenta.ru/rss/last24',
    categorySlug: 'society',
  },
  {
    name: 'Лента.ру — Россия',
    feedUrl: 'https://lenta.ru/rss/news/russia',
    categorySlug: 'society',
  },
  {
    name: 'Лента.ру — Мир',
    feedUrl: 'https://lenta.ru/rss/news/world',
    categorySlug: 'society',
  },
  {
    name: 'Коммерсантъ — главное',
    feedUrl: 'https://www.kommersant.ru/RSS/main.xml',
    categorySlug: 'society',
  },
  {
    name: 'Коммерсантъ — каталог лент',
    feedUrl: 'https://www.kommersant.ru/rss-list',
    categorySlug: 'society',
  },
  {
    name: 'МК — новостная лента',
    feedUrl: 'https://www.mk.ru/rss/news/index.xml',
    categorySlug: 'society',
  },
  {
    name: 'МК — каталог лент',
    feedUrl: 'https://www.mk.ru/rss/',
    categorySlug: 'society',
  },
];

const buildDefaultRssSources = (categories: { slug: string; title: string }[]): RssSource[] => {
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  return DEFAULT_RSS_SOURCES.map((source) => ({
    name: source.name,
    feedUrl: source.feedUrl,
    enabled: source.enabled ?? true,
    defaultTags: source.defaultTags,
    category: bySlug.get(source.categorySlug) || categories[0],
  }));
};

const normalizeFeedUrl = (value: string) => value.trim().toLowerCase();

const mergeRssSources = (current: RssSource[], additions: RssSource[]) => {
  const existing = new Set(current.map((source) => normalizeFeedUrl(source.feedUrl)));
  const next = [...current];
  additions.forEach((source) => {
    const normalized = normalizeFeedUrl(source.feedUrl);
    if (!normalized || existing.has(normalized)) return;
    existing.add(normalized);
    next.push(source);
  });
  return next;
};

const statusLabel: Record<string, string> = {
  new: 'Новая',
  rewritten: 'Переписана',
  rewriting: 'Реврайт',
  ignored: 'Игнор',
  error: 'Ошибка',
  published: 'Опубликовано',
};

const statusClasses: Record<string, string> = {
  new: 'border-blue-500/40 text-blue-600 dark:text-blue-300',
  rewritten: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
  rewriting: 'border-amber-500/40 text-amber-700 dark:text-amber-300',
  ignored: 'border-muted-foreground/40 text-muted-foreground',
  error: 'border-destructive/40 text-destructive',
  published: 'border-purple-500/40 text-purple-700 dark:text-purple-300',
};

const blockTypeLabels: Record<ContentBlock['type'], string> = {
  paragraph: 'Абзац',
  heading: 'Заголовок',
  list: 'Список',
  quote: 'Цитата',
  divider: 'Разделитель',
  callout: 'Врезка',
};

const STATUS_OPTIONS: { value: ArticleStatus; label: string }[] = [
  { value: 'draft', label: 'Черновик' },
  { value: 'review', label: 'На проверке' },
  { value: 'scheduled', label: 'Запланировано' },
  { value: 'published', label: 'Опубликовано' },
  { value: 'archived', label: 'Архив' },
  { value: 'trash', label: 'Корзина' },
];

const toLocalInputValue = (iso?: string) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const fromLocalInputValue = (value: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
};

const NewsModulePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'incoming' | 'drafts' | 'published' | 'settings' | 'ai_settings'>('incoming');
  const [incomingItems, setIncomingItems] = useState<IncomingItem[]>([]);
  const [newsItems, setNewsItems] = useState<Article[]>([]);
  const [config, setConfig] = useState<Config>(defaultConfig);
  const [rssSources, setRssSources] = useState<RssSource[]>([]);
  const [rssCategoryFilter, setRssCategoryFilter] = useState<string>('all');
  const [incomingCategoryFilter, setIncomingCategoryFilter] = useState<string>('all');
  const [aiAdminToken, setAiAdminToken] = useState(() => {
    try {
      return typeof window !== 'undefined' ? localStorage.getItem('admin_token') || '' : '';
    } catch {
      return '';
    }
  });
  const [secretsStatus, setSecretsStatus] = useState({
    REWRITE_SERVICE_URL: false,
    HMAC_SECRET: false,
    INTERNAL_TOOL_TOKEN: false,
  });
  const [secretsDraft, setSecretsDraft] = useState({
    REWRITE_SERVICE_URL: '',
    HMAC_SECRET: '',
    INTERNAL_TOOL_TOKEN: '',
  });
  const [rewriteHealthResult, setRewriteHealthResult] = useState<string | null>(null);
  const [rewriteTestResult, setRewriteTestResult] = useState<string | null>(null);
  const [rssPullResult, setRssPullResult] = useState<string | null>(null);
  const [incomingSearch, setIncomingSearch] = useState('');
  const [incomingStatus, setIncomingStatus] = useState('');
  const [newsSearch, setNewsSearch] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [editor, setEditor] = useState<{
    mode: 'incoming' | 'news';
    item: IncomingItem | Article;
  } | null>(null);
  const [editorDraft, setEditorDraft] = useState<{
    title: string;
    excerpt: string;
    category: string;
    tags: string[];
    content: ContentBlock[];
    heroImage: string;
    status: ArticleStatus;
    scheduledAt: string;
    slug: string;
    authorName: string;
    authorRole: string;
    sourceName: string;
    sourceUrl: string;
    locationCity: string;
    locationDistrict: string;
    locationAddress: string;
    isVerified: boolean;
    isFeatured: boolean;
    isBreaking: boolean;
    pinnedNowReading: boolean;
    pinnedNowReadingRank: number;
    flags: string[];
    confidence: number | null;
  } | null>(null);
  const [editorBusy, setEditorBusy] = useState(false);
  const [rewriteBusyId, setRewriteBusyId] = useState<string | null>(null);
  const rssPresetSources = useMemo(() => {
    const bySlug = new Map(config.allowedCategories.map((c) => [c.slug, c]));
    const fallbackCategory = config.allowedCategories[0] || { slug: config.defaultCategorySlug || 'general', title: 'Без категории' };
    return DEFAULT_RSS_SOURCES.map((source) => ({
      ...source,
      category: bySlug.get(source.categorySlug) || fallbackCategory,
    }));
  }, [config.allowedCategories, config.defaultCategorySlug]);

  const rssPresetIndex = useMemo(() => {
    return new Set(rssSources.map((source) => normalizeFeedUrl(source.feedUrl)));
  }, [rssSources]);

  const filteredRssPresets = useMemo(() => {
    if (rssCategoryFilter === 'all') return rssPresetSources;
    return rssPresetSources.filter((source) => source.category?.slug === rssCategoryFilter);
  }, [rssPresetSources, rssCategoryFilter]);

  const allPresetsAdded = useMemo(() => {
    if (rssPresetSources.length === 0) return true;
    return rssPresetSources.every((preset) => rssPresetIndex.has(normalizeFeedUrl(preset.feedUrl)));
  }, [rssPresetIndex, rssPresetSources]);

  const loadConfig = async () => {
    try {
      const res = await apiFetch(API_CONFIG);
      if (!res.ok) throw new Error('config');
      const data = await res.json();
      setConfig({ ...defaultConfig, ...data });
    } catch {
      setConfig(defaultConfig);
    }
  };

  const loadIncoming = async () => {
    try {
      const res = await fetch(`${API_INCOMING}?action=list`);
      if (!res.ok) throw new Error('incoming');
      const data = await res.json();
      setIncomingItems(Array.isArray(data) ? data : []);
    } catch {
      setIncomingItems([]);
    }
  };

  const loadNews = async () => {
    try {
      const res = await fetch(API_NEWS);
      if (!res.ok) throw new Error('news');
      const data = await res.json();
      const next = Array.isArray(data) ? data : [];
      setNewsItems(next);
      newsService.setArticles(next);
    } catch {
      setNewsItems([]);
    }
  };

  const loadRssSources = async () => {
    try {
      const res = await apiFetch(API_RSS);
      if (!res.ok) throw new Error('rss');
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setRssSources(data);
      } else {
        setRssSources(buildDefaultRssSources(config.allowedCategories));
      }
    } catch {
      setRssSources(buildDefaultRssSources(config.allowedCategories));
    }
  };

  const loadSecretsStatus = async () => {
    try {
      const res = await apiFetch(API_SECRETS);
      if (!res.ok) throw new Error('secrets');
      const data = await res.json();
      setSecretsStatus({
        REWRITE_SERVICE_URL: !!data?.REWRITE_SERVICE_URL,
        HMAC_SECRET: !!data?.HMAC_SECRET,
        INTERNAL_TOOL_TOKEN: !!data?.INTERNAL_TOOL_TOKEN,
      });
    } catch {
      setSecretsStatus({
        REWRITE_SERVICE_URL: false,
        HMAC_SECRET: false,
        INTERNAL_TOOL_TOKEN: false,
      });
    }
  };

  useEffect(() => {
    loadConfig();
    loadIncoming();
    loadNews();
    loadRssSources();
    loadSecretsStatus();
  }, []);

  const filteredIncoming = useMemo(() => {
    return [...incomingItems]
      .filter((item) => {
        const title = item?.raw?.title || '';
        const matchesSearch = title.toLowerCase().includes(incomingSearch.toLowerCase());
        const status = item.status || 'new';
        const matchesStatus = !incomingStatus || status === incomingStatus;
        const category = item.category || '';
        const matchesCategory = incomingCategoryFilter === 'all' || category === incomingCategoryFilter;
        return matchesSearch && matchesStatus && matchesCategory;
      })
      .sort((a, b) => {
        const da = new Date(a.publishedAt || '').getTime();
        const db = new Date(b.publishedAt || '').getTime();
        return db - da;
      });
  }, [incomingItems, incomingSearch, incomingStatus, incomingCategoryFilter]);

  const incomingCategoryOptions = useMemo(() => {
    const options = config.allowedCategories.map((category) => ({
      slug: category.slug,
      title: category.title,
    }));
    const known = new Set(options.map((option) => option.slug));
    rssSources.forEach((source) => {
      if (source.category?.slug && !known.has(source.category.slug)) {
        known.add(source.category.slug);
        options.push({ slug: source.category.slug, title: source.category.title });
      }
    });
    return options;
  }, [config.allowedCategories, rssSources]);

  const incomingCategoryLabels = useMemo(() => {
    const map = new Map<string, string>();
    incomingCategoryOptions.forEach((option) => {
      map.set(option.slug, option.title);
    });
    return map;
  }, [incomingCategoryOptions]);

  const filteredNews = useMemo(() => {
    return [...newsItems]
      .filter((item) => {
        const title = item.title || '';
        const matchesSearch = title.toLowerCase().includes(newsSearch.toLowerCase());
        if (activeTab === 'drafts') return matchesSearch && (item.status || 'published') === 'draft';
        if (activeTab === 'published') return matchesSearch && (item.status || 'published') === 'published';
        return matchesSearch;
      })
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }, [newsItems, newsSearch, activeTab]);

  const filteredRssSources = useMemo(() => {
    const indexed = rssSources.map((source, index) => ({ source, index }));
    if (rssCategoryFilter === 'all') return indexed;
    return indexed.filter(({ source }) => source.category?.slug === rssCategoryFilter);
  }, [rssSources, rssCategoryFilter]);

  const openIncomingEditor = async (item: IncomingItem) => {
    setEditor({ mode: 'incoming', item });
    const rewrite = item.rewrite || {};
    const title = rewrite.title || item.raw?.title || '';
    setEditorDraft({
      title,
      excerpt: rewrite.excerpt || item.raw?.summary || '',
      category: rewrite.category || item.category || config.defaultCategorySlug,
      tags: ensureStringArray(rewrite.tags),
      content: normalizeBlocks(rewrite.content),
      heroImage: rewrite.heroImage || item.image || '',
      status: 'draft',
      scheduledAt: '',
      slug: slugify(title),
      authorName: config.defaultAuthorName,
      authorRole: config.defaultAuthorRole,
      sourceName: item.source?.name || '',
      sourceUrl: item.source?.itemUrl || '',
      locationCity: '',
      locationDistrict: '',
      locationAddress: '',
      isVerified: false,
      isFeatured: false,
      isBreaking: false,
      pinnedNowReading: false,
      pinnedNowReadingRank: 0,
      flags: ensureStringArray(rewrite.flags),
      confidence: typeof rewrite.confidence === 'number' ? rewrite.confidence : null,
    });
  };

  const openNewsEditor = (item: Article) => {
    setEditor({ mode: 'news', item });
    setEditorDraft({
      title: item.title || '',
      excerpt: item.excerpt || '',
      category: item.category?.slug || config.defaultCategorySlug,
      tags: ensureStringArray(item.tags),
      content: normalizeBlocks(item.content),
      heroImage: item.heroImage || '',
      status: item.status || 'draft',
      scheduledAt: item.scheduledAt || '',
      slug: item.slug || '',
      authorName: item.author?.name || config.defaultAuthorName,
      authorRole: item.author?.role || config.defaultAuthorRole,
      sourceName: item.source?.name || '',
      sourceUrl: item.source?.url || '',
      locationCity: item.location?.city || '',
      locationDistrict: item.location?.district || '',
      locationAddress: item.location?.address || '',
      isVerified: !!item.isVerified,
      isFeatured: !!item.isFeatured,
      isBreaking: !!item.isBreaking,
      pinnedNowReading: !!item.pinnedNowReading,
      pinnedNowReadingRank: item.pinnedNowReadingRank ?? 0,
      flags: [],
      confidence: null,
    });
  };

  const closeEditor = () => {
    setEditor(null);
    setEditorDraft(null);
    setStatusMessage(null);
  };

  const updateIncomingStatus = async (id: string, status: string, publishedNewsId?: string) => {
    setIsBusy(true);
    setStatusMessage(null);
    try {
      const payload: Record<string, string> = { id, status };
      if (publishedNewsId) payload.publishedNewsId = publishedNewsId;
      const res = await apiFetch(`${API_INCOMING}?action=set_status`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Ошибка');
      await loadIncoming();
    } catch (e: any) {
      setStatusMessage({ type: 'err', text: e?.message || 'Не удалось обновить статус.' });
    } finally {
      setIsBusy(false);
    }
  };

  const saveIncoming = async (payload: IncomingItem) => {
    setEditorBusy(true);
    setStatusMessage(null);
    try {
      const res = await apiFetch(`${API_INCOMING}?action=upsert`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Ошибка');
      await loadIncoming();
      setStatusMessage({ type: 'ok', text: 'Сохранено в incoming.json' });
    } catch (e: any) {
      setStatusMessage({ type: 'err', text: e?.message || 'Не удалось сохранить.' });
    } finally {
      setEditorBusy(false);
    }
  };

  const rewriteIncoming = async (id: string) => {
    setRewriteBusyId(id);
    setStatusMessage(null);
    try {
      const res = await apiFetch(API_REWRITE, {
        method: 'POST',
        body: JSON.stringify({ action: 'rewrite_incoming', id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Ошибка реврайта');
      await loadIncoming();
      if (editor?.mode === 'incoming' && (editor.item as IncomingItem).id === id) {
        const updated = await fetch(`${API_INCOMING}?action=get&id=${id}`);
        if (updated.ok) {
          const item = await updated.json();
          await openIncomingEditor(item);
        }
      }
    } catch (e: any) {
      setStatusMessage({ type: 'err', text: e?.message || 'Не удалось выполнить реврайт.' });
    } finally {
      setRewriteBusyId(null);
    }
  };

  const getFreshConfig = async () => {
    const res = await apiFetch(API_CONFIG);
    if (!res.ok) throw new Error('Не удалось получить настройки');
    return res.json();
  };

  const saveNewsItems = async (items: Article[]) => {
    setEditorBusy(true);
    setStatusMessage(null);
    try {
      const latestConfig = await getFreshConfig();
      if (latestConfig.newsVersion !== config.newsVersion) {
        setConfig({ ...config, ...latestConfig });
        throw new Error('Новости уже были изменены другим пользователем. Перезагрузите список и повторите сохранение.');
      }

      const res = await apiFetch(API_NEWS, {
        method: 'POST',
        body: JSON.stringify(items),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Ошибка сохранения');

      await loadNews();
      await loadConfig();
      setStatusMessage({ type: 'ok', text: 'Сохранено в news.json' });
    } catch (e: any) {
      setStatusMessage({ type: 'err', text: e?.message || 'Не удалось сохранить новости.' });
    } finally {
      setEditorBusy(false);
    }
  };

  const buildArticleFromDraft = (base?: Article): Article => {
    const draft = editorDraft as NonNullable<typeof editorDraft>;
    const now = new Date().toISOString();
    const category = config.allowedCategories.find((c) => c.slug === draft.category) || config.allowedCategories[0];
    const slug = draft.slug || slugify(draft.title) || base?.slug || `news-${Date.now()}`;
    return {
      id: base?.id || Math.random().toString(36).slice(2, 10),
      slug,
      title: draft.title,
      excerpt: draft.excerpt,
      content: draft.content,
      category,
      tags: draft.tags,
      author: { name: draft.authorName || config.defaultAuthorName, role: draft.authorRole || config.defaultAuthorRole },
      publishedAt: base?.publishedAt || now,
      updatedAt: now,
      createdAt: base?.createdAt || now,
      heroImage: draft.heroImage,
      readingTime: base?.readingTime || 3,
      status: draft.status || base?.status || 'draft',
      scheduledAt: draft.status === 'scheduled' ? (draft.scheduledAt || base?.scheduledAt) : undefined,
      views: base?.views || 0,
      source: {
        name: draft.sourceName || base?.source?.name,
        url: draft.sourceUrl || base?.source?.url,
      },
      location: {
        city: draft.locationCity || base?.location?.city,
        district: draft.locationDistrict || base?.location?.district,
        address: draft.locationAddress || base?.location?.address,
      },
      isVerified: draft.isVerified,
      isBreaking: draft.isBreaking,
      isFeatured: draft.isFeatured,
      pinnedNowReading: draft.pinnedNowReading,
      pinnedNowReadingRank: draft.pinnedNowReading ? draft.pinnedNowReadingRank : undefined,
      sourceIncomingId: base?.sourceIncomingId,
    } as Article;
  };

  const saveDraftFromIncoming = async (publish?: boolean) => {
    if (!editorDraft || !editor || editor.mode !== 'incoming') return;
    const incomingItem = editor.item as IncomingItem;
    const base = buildArticleFromDraft({ sourceIncomingId: incomingItem.id } as Article);
    const article = {
      ...base,
      status: publish === true ? 'published' : publish === false ? 'draft' : base.status,
      publishedAt: publish ? new Date().toISOString() : base.publishedAt,
      scheduledAt: base.status === 'scheduled' ? base.scheduledAt : undefined,
      sourceIncomingId: incomingItem.id,
    } as Article;

    const next = [article, ...newsItems.filter((n) => n.id !== article.id)];
    await saveNewsItems(next);

    if (publish) {
      await updateIncomingStatus(incomingItem.id, 'published', article.id);
    }
  };

  const saveEditedNews = async (publishToggle?: boolean) => {
    if (!editorDraft || !editor || editor.mode !== 'news') return;
    const base = editor.item as Article;
    const updated = buildArticleFromDraft(base);
    if (publishToggle === true) {
      updated.status = 'published';
      updated.publishedAt = new Date().toISOString();
      updated.scheduledAt = undefined;
    }
    if (publishToggle === false) {
      updated.status = 'draft';
      updated.scheduledAt = undefined;
    }

    const next = newsItems.map((n) => (n.id === updated.id ? updated : n));
    await saveNewsItems(next);
  };

  const handleCopyResult = async () => {
    if (!editorDraft) return;
    const text = [editorDraft.title, editorDraft.excerpt, editorDraft.content.map((b) => {
      if (b.type === 'list') return b.items.join('\n');
      if (b.type === 'quote') return `${b.value}${b.author ? ` — ${b.author}` : ''}`;
      return (b as any).value || '';
    }).join('\n\n')].filter(Boolean).join('\n\n');

    try {
      await navigator.clipboard.writeText(text);
      setStatusMessage({ type: 'ok', text: 'Текст скопирован в буфер обмена.' });
    } catch {
      setStatusMessage({ type: 'err', text: 'Не удалось скопировать текст.' });
    }
  };

  const addBlock = (type: ContentBlock['type']) => {
    if (!editorDraft) return;
    let newBlock: ContentBlock;
    if (type === 'list') {
      newBlock = { type: 'list', items: [''] };
    } else if (type === 'quote') {
      newBlock = { type: 'quote', value: '', author: '' };
    } else {
      newBlock = { type, value: '' } as ContentBlock;
    }
    setEditorDraft({ ...editorDraft, content: [...editorDraft.content, newBlock] });
  };

  const moveBlock = (index: number, delta: number) => {
    if (!editorDraft) return;
    const next = [...editorDraft.content];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setEditorDraft({ ...editorDraft, content: next });
  };

  const deleteBlock = (index: number) => {
    if (!editorDraft) return;
    const next = [...editorDraft.content];
    next.splice(index, 1);
    setEditorDraft({ ...editorDraft, content: next });
  };

  const updateBlock = (index: number, patch: Partial<ContentBlock>) => {
    if (!editorDraft) return;
    const next = [...editorDraft.content];
    next[index] = { ...next[index], ...patch } as ContentBlock;
    setEditorDraft({ ...editorDraft, content: next });
  };

  const addTag = (value: string) => {
    if (!editorDraft) return;
    const trimmed = value.trim();
    if (!trimmed) return;
    if (editorDraft.tags.includes(trimmed)) return;
    setEditorDraft({ ...editorDraft, tags: [...editorDraft.tags, trimmed] });
  };

  const removeTag = (value: string) => {
    if (!editorDraft) return;
    setEditorDraft({ ...editorDraft, tags: editorDraft.tags.filter((tag) => tag !== value) });
  };

  const saveSettings = async () => {
    setIsBusy(true);
    setStatusMessage(null);
    try {
      const res = await apiFetch(API_CONFIG, {
        method: 'POST',
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Ошибка сохранения');
      setStatusMessage({ type: 'ok', text: 'Настройки сохранены.' });
      await loadConfig();
    } catch (e: any) {
      setStatusMessage({ type: 'err', text: e?.message || 'Не удалось сохранить настройки.' });
    } finally {
      setIsBusy(false);
    }
  };

  const saveRssSources = async () => {
    setIsBusy(true);
    setStatusMessage(null);
    try {
      const res = await apiFetch(API_RSS, {
        method: 'POST',
        body: JSON.stringify(rssSources),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Ошибка сохранения');
      setStatusMessage({ type: 'ok', text: 'Источники сохранены.' });
      await loadRssSources();
    } catch (e: any) {
      setStatusMessage({ type: 'err', text: e?.message || 'Не удалось сохранить источники.' });
    } finally {
      setIsBusy(false);
    }
  };

  const saveSecrets = async () => {
    setIsBusy(true);
    setStatusMessage(null);
    try {
      const res = await apiFetch(API_SECRETS, {
        method: 'POST',
        body: JSON.stringify(secretsDraft),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data?.error || 'Ошибка сохранения');
      setStatusMessage({ type: 'ok', text: 'Секреты сохранены.' });
      setSecretsDraft({ REWRITE_SERVICE_URL: '', HMAC_SECRET: '', INTERNAL_TOOL_TOKEN: '' });
      await loadSecretsStatus();
    } catch (e: any) {
      setStatusMessage({ type: 'err', text: e?.message || 'Не удалось сохранить секреты.' });
    } finally {
      setIsBusy(false);
    }
  };

  const checkAccess = async () => {
    setStatusMessage(null);
    try {
      const res = await apiFetch(API_CONFIG);
      if (!res.ok) throw new Error(`Ошибка доступа (${res.status})`);
      setStatusMessage({ type: 'ok', text: 'Доступ подтверждён.' });
    } catch (e: any) {
      setStatusMessage({ type: 'err', text: e?.message || 'Не удалось проверить доступ.' });
    }
  };

  const checkCloudRun = async () => {
    setStatusMessage(null);
    setRewriteHealthResult(null);
    try {
      const res = await apiFetch(`${API_REWRITE}?action=health`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || `Ошибка проверки (${res.status})`);
      }
      setRewriteHealthResult(JSON.stringify(data, null, 2));
      setStatusMessage({ type: 'ok', text: 'Cloud Run доступен.' });
    } catch (e: any) {
      setStatusMessage({ type: 'err', text: e?.message || 'Не удалось проверить Cloud Run.' });
    }
  };

  const testRewrite = async () => {
    setStatusMessage(null);
    setRewriteTestResult(null);
    try {
      const res = await apiFetch(`${API_REWRITE}?action=test`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || `Ошибка теста (${res.status})`);
      }
      setRewriteTestResult(JSON.stringify(data, null, 2));
      setStatusMessage({ type: 'ok', text: 'Тест реврайта выполнен.' });
    } catch (e: any) {
      setStatusMessage({ type: 'err', text: e?.message || 'Не удалось выполнить тест реврайта.' });
    }
  };

  const checkWritePermissions = async () => {
    setStatusMessage(null);
    try {
      const res = await apiFetch(`${API_CONFIG}?action=check_write`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || `Ошибка проверки (${res.status})`);
      }
      setStatusMessage({ type: 'ok', text: 'Права записи подтверждены.' });
    } catch (e: any) {
      setStatusMessage({ type: 'err', text: e?.message || 'Не удалось проверить права записи.' });
    }
  };

  const runRssPull = async (): Promise<boolean> => {
    setStatusMessage(null);
    setRssPullResult(null);
    try {
      const res = await apiFetch(API_RSS_PULL, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        throw new Error(data?.error || `Ошибка запуска (${res.status})`);
      }
      setRssPullResult(JSON.stringify(data, null, 2));
      setStatusMessage({ type: 'ok', text: `Сбор запущен. Добавлено: ${data?.added ?? 0}.` });
      return true;
    } catch (e: any) {
      setStatusMessage({ type: 'err', text: e?.message || 'Не удалось запустить сбор.' });
      return false;
    }
  };

  const refreshIncomingFromRss = async () => {
    setIsBusy(true);
    const ok = await runRssPull();
    if (ok) {
      await loadIncoming();
    }
    setIsBusy(false);
  };

  const updateRssSource = (idx: number, patch: Partial<RssSource>) => {
    const next = [...rssSources];
    next[idx] = { ...next[idx], ...patch } as RssSource;
    setRssSources(next);
  };

  const addRssSource = () => {
    setRssSources([
      ...rssSources,
      { name: '', feedUrl: '', enabled: true, category: config.allowedCategories[0], defaultTags: [] },
    ]);
  };

  const addPresetSource = (preset: (typeof rssPresetSources)[number]) => {
    setRssSources((prev) =>
      mergeRssSources(prev, [
        {
          name: preset.name,
          feedUrl: preset.feedUrl,
          enabled: preset.enabled ?? true,
          defaultTags: preset.defaultTags,
          category: preset.category,
        },
      ])
    );
  };

  const addAllPresetSources = () => {
    setRssSources((prev) =>
      mergeRssSources(
        prev,
        rssPresetSources.map((preset) => ({
          name: preset.name,
          feedUrl: preset.feedUrl,
          enabled: preset.enabled ?? true,
          defaultTags: preset.defaultTags,
          category: preset.category,
        }))
      )
    );
  };

  const deleteRssSource = (idx: number) => {
    const next = [...rssSources];
    next.splice(idx, 1);
    setRssSources(next);
  };

  const updateCategory = (idx: number, patch: Partial<Config['allowedCategories'][number]>) => {
    const next = [...config.allowedCategories];
    next[idx] = { ...next[idx], ...patch };
    setConfig({ ...config, allowedCategories: next });
  };

  const addCategory = () => {
    setConfig({
      ...config,
      allowedCategories: [...config.allowedCategories, { slug: '', title: '' }],
    });
  };

  const removeCategory = (idx: number) => {
    const next = [...config.allowedCategories];
    const removed = next.splice(idx, 1);
    const nextDefault = removed[0]?.slug === config.defaultCategorySlug ? next[0]?.slug || '' : config.defaultCategorySlug;
    setConfig({ ...config, allowedCategories: next, defaultCategorySlug: nextDefault });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Новости</h1>
        <p className="text-sm text-muted-foreground">
          Входящие из RSS, черновики, публикации и настройки редакционного процесса.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-56">
          <div className="rounded-xl border border-border bg-card p-3 space-y-1">
            {([
              { key: 'incoming', label: 'Входящие' },
              { key: 'drafts', label: 'Черновики' },
              { key: 'published', label: 'Опубликованные' },
              { key: 'settings', label: 'Настройки' },
              { key: 'ai_settings', label: 'Настройки ИИ' },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                className={[
                  'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition',
                  activeTab === tab.key ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/40'
                ].join(' ')}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </aside>

        <section className="flex-1">
          {statusMessage && (
            <div className={[
              'rounded-lg border p-4 text-sm mb-4',
              statusMessage.type === 'ok'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-destructive/30 bg-destructive/10 text-destructive'
            ].join(' ')}>
              {statusMessage.text}
            </div>
          )}

          {activeTab === 'incoming' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px] max-w-sm">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Поиск по заголовкам..."
                    className="pl-9 bg-background"
                    value={incomingSearch}
                    onChange={(e) => setIncomingSearch(e.target.value)}
                  />
                </div>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={incomingStatus}
                  onChange={(e) => setIncomingStatus(e.target.value)}
                >
                  <option value="">Все статусы</option>
                  <option value="new">Новая</option>
                  <option value="rewritten">Переписана</option>
                  <option value="rewriting">Реврайт</option>
                  <option value="ignored">Игнор</option>
                  <option value="error">Ошибка</option>
                  <option value="published">Опубликована</option>
                </select>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={incomingCategoryFilter}
                  onChange={(e) => setIncomingCategoryFilter(e.target.value)}
                >
                  <option value="all">Все темы</option>
                  {incomingCategoryOptions.map((category) => (
                    <option key={category.slug} value={category.slug}>{category.title}</option>
                  ))}
                </select>
                <Button variant="secondary" onClick={refreshIncomingFromRss} disabled={isBusy}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Обновить
                </Button>
                <div className="ml-auto text-xs text-muted-foreground">Всего: {filteredIncoming.length}</div>
              </div>

              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-left">
                        <th className="p-3 font-medium text-muted-foreground">Дата</th>
                        <th className="p-3 font-medium text-muted-foreground">Источник</th>
                        <th className="p-3 font-medium text-muted-foreground">Заголовок</th>
                        <th className="p-3 font-medium text-muted-foreground">Категория</th>
                        <th className="p-3 font-medium text-muted-foreground">Статус</th>
                        <th className="p-3 font-medium text-muted-foreground text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIncoming.map((item) => {
                        const status = item.status || 'new';
                        return (
                          <tr key={item.id} className="border-b border-border hover:bg-muted/20">
                            <td className="p-3 text-muted-foreground whitespace-nowrap">
                              {formatDateShort(item.publishedAt || '')}
                            </td>
                            <td className="p-3">
                              <div className="text-xs text-muted-foreground">{item.source?.name || '—'}</div>
                            </td>
                            <td className="p-3">
                          <div className="font-medium text-foreground line-clamp-2">{item.raw?.title || 'Без названия'}</div>
                        </td>
                            <td className="p-3 text-muted-foreground">
                              {item.category ? (incomingCategoryLabels.get(item.category) || item.category) : '—'}
                            </td>
                            <td className="p-3">
                              <span className={[
                                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
                                statusClasses[status] || 'border-muted-foreground/30 text-muted-foreground'
                              ].join(' ')}>
                                {status === 'rewriting' && <Loader2 className="w-3 h-3 animate-spin" />}
                                {statusLabel[status] || status}
                              </span>
                              {item.rewriteError && (
                                <div className="text-[11px] text-destructive mt-1">{item.rewriteError}</div>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="flex flex-wrap justify-end gap-2">
                                <Button size="sm" variant="secondary" onClick={() => openIncomingEditor(item)}>
                                  Открыть
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={!!rewriteBusyId}
                                  onClick={() => rewriteIncoming(item.id)}
                                >
                                  <Wand2 className="w-4 h-4 mr-1" /> Реврайт
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => updateIncomingStatus(item.id, 'ignored')}>
                                  Игнор
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => updateIncomingStatus(item.id, 'published')}>
                                  Опубликовано
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredIncoming.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-muted-foreground">
                            Нет входящих новостей
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {(activeTab === 'drafts' || activeTab === 'published') && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px] max-w-sm">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Поиск по заголовкам..."
                    className="pl-9 bg-background"
                    value={newsSearch}
                    onChange={(e) => setNewsSearch(e.target.value)}
                  />
                </div>
                <Button variant="secondary" onClick={loadNews} disabled={isBusy}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Обновить
                </Button>
                <div className="ml-auto text-xs text-muted-foreground">Всего: {filteredNews.length}</div>
              </div>

              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-left">
                        <th className="p-3 font-medium text-muted-foreground">Заголовок</th>
                        <th className="p-3 font-medium text-muted-foreground">Категория</th>
                        <th className="p-3 font-medium text-muted-foreground">Теги</th>
                        <th className="p-3 font-medium text-muted-foreground">Дата</th>
                        <th className="p-3 font-medium text-muted-foreground text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredNews.map((item) => (
                        <tr key={item.id} className="border-b border-border hover:bg-muted/20">
                          <td className="p-3">
                            <div className="font-medium text-foreground line-clamp-2">{item.title}</div>
                            <div className="text-xs text-muted-foreground line-clamp-1">{item.excerpt}</div>
                          </td>
                          <td className="p-3 text-muted-foreground">{item.category?.title || '—'}</td>
                          <td className="p-3 text-muted-foreground">{item.tags?.join(', ') || '—'}</td>
                          <td className="p-3 text-muted-foreground whitespace-nowrap">{formatDateShort(item.publishedAt)}</td>
                          <td className="p-3">
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="secondary" onClick={() => openNewsEditor(item)}>
                                Редактировать
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredNews.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-muted-foreground">
                            Нет новостей для отображения
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <section className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">API и безопасность</h2>
                    <p className="text-xs text-muted-foreground">Секреты задаются только через переменные окружения сервера.</p>
                  </div>
                  <Button onClick={saveSettings} disabled={isBusy}>
                    Сохранить
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Название сайта</label>
                    <Input value={config.siteTitle} onChange={(e) => setConfig({ ...config, siteTitle: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Категория по умолчанию</label>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={config.defaultCategorySlug}
                      onChange={(e) => setConfig({ ...config, defaultCategorySlug: e.target.value })}
                    >
                      {config.allowedCategories.map((c) => (
                        <option key={c.slug} value={c.slug}>{c.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Автор по умолчанию</label>
                    <Input value={config.defaultAuthorName} onChange={(e) => setConfig({ ...config, defaultAuthorName: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Роль автора</label>
                    <Input value={config.defaultAuthorRole} onChange={(e) => setConfig({ ...config, defaultAuthorRole: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Новых новостей за запуск</label>
                    <Input
                      type="number"
                      value={config.maxNewItemsPerRun}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        setConfig({ ...config, maxNewItemsPerRun: value, rssPollLimitPerRun: value });
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Максимум входящих</label>
                    <Input
                      type="number"
                      value={config.incomingMaxItems}
                      onChange={(e) => setConfig({ ...config, incomingMaxItems: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Лимит символов для реврайта</label>
                    <Input
                      type="number"
                      value={config.rewriteMaxChars}
                      onChange={(e) => setConfig({ ...config, rewriteMaxChars: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Региональная подсказка</label>
                    <Input value={config.rewriteRegionHint} onChange={(e) => setConfig({ ...config, rewriteRegionHint: e.target.value })} />
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Источники RSS</h2>
                    <p className="text-xs text-muted-foreground">URL должен начинаться с http/https.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={rssCategoryFilter}
                      onChange={(e) => setRssCategoryFilter(e.target.value)}
                    >
                      <option value="all">Все категории</option>
                      {config.allowedCategories.map((c) => (
                        <option key={c.slug} value={c.slug}>{c.title}</option>
                      ))}
                    </select>
                    <Button variant="secondary" onClick={addRssSource}>Добавить</Button>
                    <Button onClick={saveRssSources} disabled={isBusy}>Сохранить</Button>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">Встроенные источники</h3>
                      <p className="text-xs text-muted-foreground">
                        Быстро добавьте заранее подготовленные ленты СМИ и тематик.
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={addAllPresetSources}
                      disabled={isBusy || allPresetsAdded}
                    >
                      {allPresetsAdded ? 'Все добавлены' : 'Добавить все'}
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {filteredRssPresets.map((preset) => {
                      const isAdded = rssPresetIndex.has(normalizeFeedUrl(preset.feedUrl));
                      return (
                        <div key={preset.feedUrl} className="rounded-lg border border-border bg-background p-3 flex flex-col gap-2">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-foreground">{preset.name}</div>
                              <div className="text-xs text-muted-foreground break-all">{preset.feedUrl}</div>
                            </div>
                            <Button
                              size="sm"
                              variant={isAdded ? 'secondary' : 'default'}
                              disabled={isAdded}
                              onClick={() => addPresetSource(preset)}
                            >
                              {isAdded ? 'Добавлено' : 'Добавить'}
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Категория: <span className="text-foreground/80">{preset.category?.title || 'Без категории'}</span>
                          </div>
                        </div>
                      );
                    })}
                    {filteredRssPresets.length === 0 && (
                      <div className="text-sm text-muted-foreground">Нет встроенных источников в этой категории.</div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredRssSources.map(({ source, index }) => (
                    <div key={`${source.feedUrl}-${index}`} className="rounded-lg border border-border p-4 space-y-3">
                      <div className="flex flex-wrap gap-3 items-center">
                        <Input
                          className="flex-1 min-w-[180px]"
                          placeholder="Название"
                          value={source.name}
                          onChange={(e) => updateRssSource(index, { name: e.target.value })}
                        />
                        <Input
                          className="flex-[2] min-w-[240px]"
                          placeholder="https://example.com/rss"
                          value={source.feedUrl}
                          onChange={(e) => updateRssSource(index, { feedUrl: e.target.value })}
                        />
                        <select
                          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                          value={source.category?.slug || config.defaultCategorySlug}
                          onChange={(e) => {
                            const selected = config.allowedCategories.find((c) => c.slug === e.target.value);
                            updateRssSource(index, { category: selected || config.allowedCategories[0] });
                          }}
                        >
                          {config.allowedCategories.map((c) => (
                            <option key={c.slug} value={c.slug}>{c.title}</option>
                          ))}
                        </select>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={!!source.enabled}
                            onChange={(e) => updateRssSource(index, { enabled: e.target.checked })}
                          />
                          Включён
                        </label>
                        <Button variant="ghost" onClick={() => deleteRssSource(index)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Теги по умолчанию (через запятую)</label>
                        <Input
                          value={(source.defaultTags || []).join(', ')}
                          onChange={(e) => updateRssSource(index, { defaultTags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
                        />
                      </div>
                    </div>
                  ))}
                  {rssSources.length === 0 && (
                    <div className="text-sm text-muted-foreground">Добавьте RSS-источники.</div>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">Настройки реврайта</h2>
                  <p className="text-xs text-muted-foreground">Без ключей и секретов.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Температура</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={config.rewriteTemperature}
                      onChange={(e) => setConfig({ ...config, rewriteTemperature: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Таймаут реврайта (сек.)</label>
                    <Input
                      type="number"
                      value={config.rewriteTimeoutSec}
                      onChange={(e) => setConfig({ ...config, rewriteTimeoutSec: Number(e.target.value) })}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={config.allowQuotesOnlyIfPresent}
                      onChange={(e) => setConfig({ ...config, allowQuotesOnlyIfPresent: e.target.checked })}
                    />
                    Цитаты только если есть в исходнике
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={config.appendSourceBlock}
                      onChange={(e) => setConfig({ ...config, appendSourceBlock: e.target.checked })}
                    />
                    Всегда добавлять блок «Источник»
                  </label>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'ai_settings' && (
            <div className="space-y-6">
              <section className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">A) Доступ и безопасность</h2>
                    <p className="text-xs text-muted-foreground">ADMIN_TOKEN хранится в браузере (localStorage).</p>
                  </div>
                  <Button variant="secondary" onClick={checkAccess}>
                    Проверить доступ
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">ADMIN_TOKEN</label>
                    <Input
                      type="password"
                      value={aiAdminToken}
                      onChange={(e) => {
                        const next = e.target.value;
                        setAiAdminToken(next);
                        try {
                          localStorage.setItem('admin_token', next);
                        } catch {
                          // ignore storage errors
                        }
                      }}
                      placeholder="Вставьте токен администратора"
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">B) Подключение сервиса реврайта (Cloud Run)</h2>
                    <p className="text-xs text-muted-foreground">Секреты сохраняются только на сервере.</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={checkCloudRun}>Проверить Cloud Run</Button>
                    <Button variant="secondary" onClick={testRewrite}>Тест реврайта</Button>
                    <Button onClick={saveSecrets} disabled={isBusy}>Сохранить секреты</Button>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">REWRITE_SERVICE_URL</label>
                    <Input
                      value={secretsDraft.REWRITE_SERVICE_URL}
                      onChange={(e) => setSecretsDraft({ ...secretsDraft, REWRITE_SERVICE_URL: e.target.value })}
                      placeholder={secretsStatus.REWRITE_SERVICE_URL ? 'Задано' : 'Не задано'}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Текущее состояние: {secretsStatus.REWRITE_SERVICE_URL ? 'задано' : 'не задано'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">HMAC_SECRET</label>
                    <Input
                      type="password"
                      value={secretsDraft.HMAC_SECRET}
                      onChange={(e) => setSecretsDraft({ ...secretsDraft, HMAC_SECRET: e.target.value })}
                      placeholder={secretsStatus.HMAC_SECRET ? 'Задано' : 'Не задано'}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Текущее состояние: {secretsStatus.HMAC_SECRET ? 'задано' : 'не задано'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">INTERNAL_TOOL_TOKEN (опционально)</label>
                    <Input
                      type="password"
                      value={secretsDraft.INTERNAL_TOOL_TOKEN}
                      onChange={(e) => setSecretsDraft({ ...secretsDraft, INTERNAL_TOOL_TOKEN: e.target.value })}
                      placeholder={secretsStatus.INTERNAL_TOOL_TOKEN ? 'Задано' : 'Не задано'}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Текущее состояние: {secretsStatus.INTERNAL_TOOL_TOKEN ? 'задано' : 'не задано'}
                    </p>
                  </div>
                </div>
                {rewriteHealthResult && (
                  <div>
                    <p className="text-xs text-muted-foreground">Ответ Cloud Run (/healthz)</p>
                    <pre className="mt-2 rounded-lg bg-muted/30 p-3 text-xs overflow-auto">{rewriteHealthResult}</pre>
                  </div>
                )}
                {rewriteTestResult && (
                  <div>
                    <p className="text-xs text-muted-foreground">Ответ теста реврайта</p>
                    <pre className="mt-2 rounded-lg bg-muted/30 p-3 text-xs overflow-auto">{rewriteTestResult}</pre>
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">C) Параметры реврайта</h2>
                    <p className="text-xs text-muted-foreground">Несекретные параметры сохраняются в config.json.</p>
                  </div>
                  <Button onClick={saveSettings} disabled={isBusy}>Сохранить параметры</Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Региональная подсказка</label>
                    <Input value={config.rewriteRegionHint} onChange={(e) => setConfig({ ...config, rewriteRegionHint: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Максимум символов</label>
                    <Input type="number" value={config.rewriteMaxChars} onChange={(e) => setConfig({ ...config, rewriteMaxChars: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Таймаут реврайта (сек.)</label>
                    <Input type="number" value={config.rewriteTimeoutSec} onChange={(e) => setConfig({ ...config, rewriteTimeoutSec: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Температура</label>
                    <Input type="number" step="0.1" value={config.rewriteTemperature} onChange={(e) => setConfig({ ...config, rewriteTemperature: Number(e.target.value) })} />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={config.appendSourceBlock}
                      onChange={(e) => setConfig({ ...config, appendSourceBlock: e.target.checked })}
                    />
                    Добавлять блок «Источник»
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={config.allowQuotesOnlyIfPresent}
                      onChange={(e) => setConfig({ ...config, allowQuotesOnlyIfPresent: e.target.checked })}
                    />
                    Цитаты только если есть в исходнике
                  </label>
                  <div>
                    <label className="text-sm font-medium">Автор по умолчанию</label>
                    <Input value={config.defaultAuthorName} onChange={(e) => setConfig({ ...config, defaultAuthorName: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Роль автора</label>
                    <Input value={config.defaultAuthorRole} onChange={(e) => setConfig({ ...config, defaultAuthorRole: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Категория по умолчанию</label>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={config.defaultCategorySlug}
                      onChange={(e) => setConfig({ ...config, defaultCategorySlug: e.target.value })}
                    >
                      {config.allowedCategories.map((c) => (
                        <option key={c.slug} value={c.slug}>{c.title || c.slug}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Разрешённые категории</h3>
                    <Button variant="secondary" size="sm" onClick={addCategory}>Добавить категорию</Button>
                  </div>
                  {config.allowedCategories.map((cat, idx) => (
                    <div key={`${cat.slug}-${idx}`} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-center">
                      <Input
                        placeholder="Слаг"
                        value={cat.slug}
                        onChange={(e) => updateCategory(idx, { slug: slugify(e.target.value) })}
                      />
                      <Input
                        placeholder="Название"
                        value={cat.title}
                        onChange={(e) => updateCategory(idx, { title: e.target.value })}
                      />
                      <Button variant="ghost" onClick={() => removeCategory(idx)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {config.allowedCategories.length === 0 && (
                    <p className="text-xs text-muted-foreground">Добавьте хотя бы одну категорию.</p>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">D) Лимиты и качество сбора</h2>
                    <p className="text-xs text-muted-foreground">Параметры парсинга RSS и дедупликации.</p>
                  </div>
                  <Button variant="secondary" onClick={checkWritePermissions}>
                    Проверить права записи
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Лимит входящих (incomingMaxItems)</label>
                    <Input type="number" value={config.incomingMaxItems} onChange={(e) => setConfig({ ...config, incomingMaxItems: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Новых за запуск (maxNewItemsPerRun)</label>
                    <Input
                      type="number"
                      value={config.maxNewItemsPerRun}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        setConfig({ ...config, maxNewItemsPerRun: value, rssPollLimitPerRun: value });
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Окно дедупликации, дни (dedupWindowDays)</label>
                    <Input type="number" value={config.dedupWindowDays} onChange={(e) => setConfig({ ...config, dedupWindowDays: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Таймаут запроса, сек. (fetchTimeoutSec)</label>
                    <Input type="number" value={config.fetchTimeoutSec} onChange={(e) => setConfig({ ...config, fetchTimeoutSec: Number(e.target.value) })} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium">User-Agent (userAgent)</label>
                    <Input value={config.userAgent} onChange={(e) => setConfig({ ...config, userAgent: e.target.value })} />
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-border bg-card p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">E) Источники RSS</h2>
                    <p className="text-xs text-muted-foreground">URL должен начинаться с http/https.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={rssCategoryFilter}
                      onChange={(e) => setRssCategoryFilter(e.target.value)}
                    >
                      <option value="all">Все категории</option>
                      {config.allowedCategories.map((c) => (
                        <option key={c.slug} value={c.slug}>{c.title}</option>
                      ))}
                    </select>
                    <Button variant="secondary" onClick={addRssSource}>Добавить источник</Button>
                    <Button variant="secondary" onClick={runRssPull}>Прогнать сбор сейчас</Button>
                    <Button onClick={saveRssSources} disabled={isBusy}>Сохранить</Button>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">Встроенные источники</h3>
                      <p className="text-xs text-muted-foreground">
                        Быстро добавьте заранее подготовленные ленты СМИ и тематик.
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={addAllPresetSources}
                      disabled={isBusy || allPresetsAdded}
                    >
                      {allPresetsAdded ? 'Все добавлены' : 'Добавить все'}
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {filteredRssPresets.map((preset) => {
                      const isAdded = rssPresetIndex.has(normalizeFeedUrl(preset.feedUrl));
                      return (
                        <div key={preset.feedUrl} className="rounded-lg border border-border bg-background p-3 flex flex-col gap-2">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-foreground">{preset.name}</div>
                              <div className="text-xs text-muted-foreground break-all">{preset.feedUrl}</div>
                            </div>
                            <Button
                              size="sm"
                              variant={isAdded ? 'secondary' : 'default'}
                              disabled={isAdded}
                              onClick={() => addPresetSource(preset)}
                            >
                              {isAdded ? 'Добавлено' : 'Добавить'}
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Категория: <span className="text-foreground/80">{preset.category?.title || 'Без категории'}</span>
                          </div>
                        </div>
                      );
                    })}
                    {filteredRssPresets.length === 0 && (
                      <div className="text-sm text-muted-foreground">Нет встроенных источников в этой категории.</div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredRssSources.map(({ source, index }) => (
                    <div key={`${source.feedUrl}-${index}`} className="rounded-lg border border-border p-4 space-y-3">
                      <div className="flex flex-wrap gap-3 items-center">
                        <Input
                          className="flex-1 min-w-[180px]"
                          placeholder="Название"
                          value={source.name}
                          onChange={(e) => updateRssSource(index, { name: e.target.value })}
                        />
                        <Input
                          className="flex-[2] min-w-[240px]"
                          placeholder="https://example.com/rss"
                          value={source.feedUrl}
                          onChange={(e) => updateRssSource(index, { feedUrl: e.target.value })}
                        />
                        <select
                          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                          value={source.category?.slug || config.defaultCategorySlug}
                          onChange={(e) => {
                            const selected = config.allowedCategories.find((c) => c.slug === e.target.value);
                            updateRssSource(index, { category: selected || config.allowedCategories[0] });
                          }}
                        >
                          {config.allowedCategories.map((c) => (
                            <option key={c.slug} value={c.slug}>{c.title}</option>
                          ))}
                        </select>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={!!source.enabled}
                            onChange={(e) => updateRssSource(index, { enabled: e.target.checked })}
                          />
                          Включён
                        </label>
                        <Button variant="ghost" onClick={() => deleteRssSource(index)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Теги по умолчанию (через запятую)</label>
                        <Input
                          value={(source.defaultTags || []).join(', ')}
                          onChange={(e) => updateRssSource(index, { defaultTags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
                        />
                      </div>
                    </div>
                  ))}
                  {rssSources.length === 0 && (
                    <div className="text-sm text-muted-foreground">Добавьте RSS-источники.</div>
                  )}
                </div>

                {rssPullResult && (
                  <div>
                    <p className="text-xs text-muted-foreground">Результат запуска RSS</p>
                    <pre className="mt-2 rounded-lg bg-muted/30 p-3 text-xs overflow-auto">{rssPullResult}</pre>
                  </div>
                )}
              </section>
            </div>
          )}
        </section>
      </div>

      {editor && editorDraft && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-auto p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-5xl shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold">
                  {editor.mode === 'incoming' ? 'Карточка входящей новости' : 'Редактирование новости'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {editor.mode === 'incoming' ? (editor.item as IncomingItem).raw?.title : (editor.item as Article).title}
                </p>
              </div>
              <Button variant="ghost" onClick={closeEditor}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {statusMessage && (
              <div className={[
                'mx-6 mt-4 rounded-lg border p-3 text-sm',
                statusMessage.type === 'ok'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-destructive/30 bg-destructive/10 text-destructive'
              ].join(' ')}>
                {statusMessage.text}
              </div>
            )}

            <div className="grid gap-6 p-6 lg:grid-cols-2">
              {editor.mode === 'incoming' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
                    <div className="text-xs uppercase text-muted-foreground">Оригинал</div>
                    <div className="text-sm font-semibold">{(editor.item as IncomingItem).raw?.title || 'Без названия'}</div>
                    <div className="text-xs text-muted-foreground">Источник: {(editor.item as IncomingItem).source?.name || '—'}</div>
                    {(editor.item as IncomingItem).source?.itemUrl && (
                      <a
                        href={(editor.item as IncomingItem).source?.itemUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary inline-flex items-center gap-1"
                      >
                        Открыть источник <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {(editor.item as IncomingItem).raw?.summary && (
                      <p className="text-xs text-muted-foreground">{(editor.item as IncomingItem).raw?.summary}</p>
                    )}
                    {(editor.item as IncomingItem).raw?.text && (
                      <div className="text-xs text-muted-foreground max-h-56 overflow-auto border border-border rounded-lg p-2 bg-background">
                        {(editor.item as IncomingItem).raw?.text}
                      </div>
                    )}
                    {(editor.item as IncomingItem).image && (
                      <img src={(editor.item as IncomingItem).image} alt="" className="w-full rounded-lg border border-border" />
                    )}
                  </div>

                  <div className="space-y-2">
                    <Button
                      variant="secondary"
                      onClick={() => rewriteIncoming((editor.item as IncomingItem).id)}
                      disabled={!!rewriteBusyId}
                    >
                      <Wand2 className="w-4 h-4 mr-2" /> Реврайт через Gemini
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => updateIncomingStatus((editor.item as IncomingItem).id, 'ignored')}
                    >
                      Игнорировать входящую
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Заголовок</label>
                    <Input value={editorDraft.title} onChange={(e) => setEditorDraft({ ...editorDraft, title: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Лид</label>
                    <textarea
                      className="w-full min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={editorDraft.excerpt}
                      onChange={(e) => setEditorDraft({ ...editorDraft, excerpt: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium">Статус</label>
                      <select
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={editorDraft.status}
                        onChange={(e) => setEditorDraft({ ...editorDraft, status: e.target.value as ArticleStatus })}
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Категория</label>
                      <select
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={editorDraft.category}
                        onChange={(e) => setEditorDraft({ ...editorDraft, category: e.target.value })}
                      >
                        {config.allowedCategories.map((c) => (
                          <option key={c.slug} value={c.slug}>{c.title}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {editorDraft.status === 'scheduled' && (
                    <div>
                      <label className="text-sm font-medium">Публикация</label>
                      <Input
                        type="datetime-local"
                        value={toLocalInputValue(editorDraft.scheduledAt)}
                        onChange={(e) => setEditorDraft({ ...editorDraft, scheduledAt: fromLocalInputValue(e.target.value) })}
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium">Обложка</label>
                    <Input value={editorDraft.heroImage} onChange={(e) => setEditorDraft({ ...editorDraft, heroImage: e.target.value })} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Промо</label>
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editorDraft.isFeatured}
                          onChange={(e) => setEditorDraft({ ...editorDraft, isFeatured: e.target.checked })}
                        />
                        Главная новость
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editorDraft.isBreaking}
                          onChange={(e) => setEditorDraft({ ...editorDraft, isBreaking: e.target.checked })}
                        />
                        Срочная молния
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editorDraft.pinnedNowReading}
                          onChange={(e) => setEditorDraft({ ...editorDraft, pinnedNowReading: e.target.checked })}
                        />
                        Закрепить в «Сейчас читают»
                      </label>
                      {editorDraft.pinnedNowReading && (
                        <div className="pl-6 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Приоритет</span>
                          <input
                            type="number"
                            min={0}
                            max={99}
                            value={editorDraft.pinnedNowReadingRank}
                            onChange={(e) => setEditorDraft({ ...editorDraft, pinnedNowReadingRank: Number(e.target.value) || 0 })}
                            className="h-9 w-24 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                          />
                          <span>меньше = выше</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">URL (слаг)</label>
                    <Input value={editorDraft.slug} onChange={(e) => setEditorDraft({ ...editorDraft, slug: e.target.value })} />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Автор</label>
                    <Input value={editorDraft.authorName} onChange={(e) => setEditorDraft({ ...editorDraft, authorName: e.target.value })} />
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium">Источник</label>
                      <Input value={editorDraft.sourceName} onChange={(e) => setEditorDraft({ ...editorDraft, sourceName: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Ссылка на источник</label>
                      <Input value={editorDraft.sourceUrl} onChange={(e) => setEditorDraft({ ...editorDraft, sourceUrl: e.target.value })} />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Теги</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {editorDraft.tags.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                          {tag}
                          <button type="button" onClick={() => removeTag(tag)} className="text-muted-foreground hover:text-destructive">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      <Input
                        className="max-w-[180px]"
                        placeholder="Добавить тег"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            addTag((e.target as HTMLInputElement).value);
                            (e.target as HTMLInputElement).value = '';
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Локация</label>
                    <Input
                      value={editorDraft.locationCity}
                      onChange={(e) => setEditorDraft({ ...editorDraft, locationCity: e.target.value })}
                      placeholder="Город"
                    />
                    <Input
                      value={editorDraft.locationDistrict}
                      onChange={(e) => setEditorDraft({ ...editorDraft, locationDistrict: e.target.value })}
                      placeholder="Район"
                    />
                    <Input
                      value={editorDraft.locationAddress}
                      onChange={(e) => setEditorDraft({ ...editorDraft, locationAddress: e.target.value })}
                      placeholder="Адрес"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editorDraft.isVerified}
                      onChange={(e) => setEditorDraft({ ...editorDraft, isVerified: e.target.checked })}
                    />
                    Проверено
                  </label>

                  {(editorDraft.flags.length > 0 || editorDraft.confidence !== null) && (
                    <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
                      {editorDraft.confidence !== null && <div>Уверенность: {editorDraft.confidence}</div>}
                      {editorDraft.flags.length > 0 && <div>Флаги: {editorDraft.flags.join(', ')}</div>}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Контент</h3>
                    <div className="flex flex-wrap gap-2">
                      {(['paragraph', 'heading', 'list', 'quote'] as ContentBlock['type'][]).map((type) => (
                        <Button key={type} size="sm" variant="secondary" onClick={() => addBlock(type)}>
                          <Plus className="w-3 h-3 mr-1" /> {blockTypeLabels[type]}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {editorDraft.content.map((block, idx) => (
                      <div key={idx} className="rounded-lg border border-border bg-background p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{blockTypeLabels[block.type]}</span>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => moveBlock(idx, -1)} className="hover:text-foreground">↑</button>
                            <button type="button" onClick={() => moveBlock(idx, 1)} className="hover:text-foreground">↓</button>
                            <button type="button" onClick={() => deleteBlock(idx)} className="hover:text-destructive">Удалить</button>
                          </div>
                        </div>
                        {block.type === 'list' && (
                          <div className="space-y-2">
                            {(block.items || []).map((item, itemIdx) => (
                              <Input
                                key={itemIdx}
                                value={item}
                                onChange={(e) => {
                                  const items = [...block.items];
                                  items[itemIdx] = e.target.value;
                                  updateBlock(idx, { items } as ContentBlock);
                                }}
                                placeholder={`Пункт ${itemIdx + 1}`}
                              />
                            ))}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateBlock(idx, { items: [...block.items, ''] } as ContentBlock)}
                            >
                              + Добавить пункт
                            </Button>
                          </div>
                        )}
                        {block.type === 'quote' && (
                          <div className="space-y-2">
                            <textarea
                              className="w-full min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                              value={block.value}
                              onChange={(e) => updateBlock(idx, { value: e.target.value } as ContentBlock)}
                              placeholder="Цитата"
                            />
                            <Input
                              value={block.author || ''}
                              onChange={(e) => updateBlock(idx, { author: e.target.value } as ContentBlock)}
                              placeholder="Автор (опционально)"
                            />
                          </div>
                        )}
                        {block.type !== 'list' && block.type !== 'quote' && (
                          <textarea
                            className="w-full min-h-[72px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={(block as any).value}
                            onChange={(e) => updateBlock(idx, { value: e.target.value } as ContentBlock)}
                          />
                        )}
                      </div>
                    ))}
                    {editorDraft.content.length === 0 && (
                      <div className="text-xs text-muted-foreground">Добавьте блоки контента.</div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
                  {editor.mode === 'incoming' ? (
                    <>
                      <Button onClick={() => saveDraftFromIncoming()} disabled={editorBusy}>
                        <Check className="w-4 h-4 mr-2" /> Сохранить
                      </Button>
                      <Button variant="secondary" onClick={() => saveDraftFromIncoming(true)} disabled={editorBusy}>
                        Опубликовать
                      </Button>
                      <Button variant="ghost" onClick={handleCopyResult} disabled={editorBusy}>
                        <Copy className="w-4 h-4 mr-2" /> Копировать результат
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          if (!editorDraft) return;
                          const incoming = editor.item as IncomingItem;
                          saveIncoming({
                            ...incoming,
                            rewrite: {
                              title: editorDraft.title,
                              excerpt: editorDraft.excerpt,
                              category: editorDraft.category,
                              tags: editorDraft.tags,
                              content: editorDraft.content,
                              heroImage: editorDraft.heroImage,
                              flags: editorDraft.flags,
                              confidence: editorDraft.confidence ?? undefined,
                            },
                          });
                        }}
                        disabled={editorBusy}
                      >
                        Сохранить правки
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button onClick={() => saveEditedNews()} disabled={editorBusy}>
                        <Check className="w-4 h-4 mr-2" /> Сохранить
                      </Button>
                      <Button variant="secondary" onClick={() => saveEditedNews(true)} disabled={editorBusy}>
                        Опубликовать
                      </Button>
                      <Button variant="ghost" onClick={() => saveEditedNews(false)} disabled={editorBusy}>
                        Снять с публикации
                      </Button>
                    </>
                  )}
                  {editorBusy && (
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" /> Сохраняем…
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewsModulePage;
