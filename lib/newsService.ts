import { MOCK_ARTICLES, CATEGORIES } from './mockData';
import { Article, ArticleStatus, Category } from './types';

const STORAGE_KEY = 'cc_articles_v1';
const API_URL = '/api/news.php';
const FALLBACK_NEWS_URLS = ['/data/news.json', '/api/data/news.json', '/news.json', '/api/news.json'];
const UPLOAD_URL = '/api/upload.php';
const VIEW_URL = '/api/view.php';

const getAdminToken = () => {
  try {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token');
  } catch {
    return null;
  }
};

// localStorage обычно даёт 5–10 МБ на домен. Если туда положить Base64-картинку,
// лимит улетает мгновенно (QuotaExceededError). Поэтому в localStorage держим
// только «лёгкую» копию без Base64-обложек.
const makeLocalStorageSafe = (articles: Article[]): Article[] => {
  return articles.map(a => ({
    ...a,
    heroImage: typeof a.heroImage === 'string' && a.heroImage.startsWith('data:image/')
      ? ''
      : a.heroImage,
    heroImageSquare: typeof a.heroImageSquare === 'string' && a.heroImageSquare.startsWith('data:image/')
      ? ''
      : a.heroImageSquare
  }));
};

const isDevHost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
};

const fetchNewsJson = async (url: string): Promise<Article[] | null> => {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return null;
    const data = await response.json();
    if (!Array.isArray(data)) return null;
    return normalizeArticles(data);
  } catch {
    return null;
  }
};

function normalizeArticle(a: any): Article {
  const views = typeof a?.views === 'number' && isFinite(a.views) ? Math.max(0, Math.floor(a.views)) : 0;
  const pinnedNowReading = !!a?.pinnedNowReading;
  const pinnedNowReadingRank = typeof a?.pinnedNowReadingRank === 'number' && isFinite(a.pinnedNowReadingRank)
    ? Math.max(0, Math.floor(a.pinnedNowReadingRank))
    : 0;
  const status = (a?.status as ArticleStatus) || 'published';

  return {
    ...a,
    views,
    pinnedNowReading,
    pinnedNowReadingRank,
    status,
  } as Article;
}

function normalizeArticles(list: any[]): Article[] {
  return (Array.isArray(list) ? list : []).map(normalizeArticle);
}


// In-memory cache
let articlesCache: Article[] = [];
let isInitialized = false;

const isPublicVisible = (article: Article, now = new Date()): boolean => {
  const status = article.status || 'published';
  if (status !== 'published' && status !== 'scheduled') return false;

  const publishedAt = new Date(article.publishedAt);
  if (Number.isNaN(publishedAt.getTime())) return false;

  return publishedAt.getTime() <= now.getTime();
};

const withPublicVisible = (list: Article[]) => list.filter((article) => isPublicVisible(article));

export const newsService = {
  // Инициализация: загрузка данных с сервера (news.json)
  init: async (): Promise<void> => {
    if (isInitialized) return;

    try {
        const response = await fetch(API_URL, { cache: 'no-store' });
        if (!response.ok) throw new Error('API not available');

        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
            articlesCache = normalizeArticles(data);
        } else {
            let fallbackArticles: Article[] | null = null;
            for (const url of FALLBACK_NEWS_URLS) {
              fallbackArticles = await fetchNewsJson(url);
              if (fallbackArticles && fallbackArticles.length > 0) break;
            }

            if (fallbackArticles && fallbackArticles.length > 0) {
              articlesCache = fallbackArticles;
            } else if (Array.isArray(data)) {
              articlesCache = normalizeArticles(data);
            } else {
              console.log('No data on server, using mocks');
              articlesCache = normalizeArticles([...MOCK_ARTICLES]);
            }
        }
    } catch (e) {
        console.warn('Backend connection failed (dev mode?), using localStorage/Mocks', e);
        let fallbackArticles: Article[] | null = null;
        for (const url of FALLBACK_NEWS_URLS) {
          fallbackArticles = await fetchNewsJson(url);
          if (fallbackArticles && fallbackArticles.length > 0) break;
        }
        if (fallbackArticles && fallbackArticles.length > 0) {
          articlesCache = fallbackArticles;
          isInitialized = true;
          return;
        }
        // Fallback to LocalStorage
        const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
        if (stored) {
            articlesCache = normalizeArticles(JSON.parse(stored));
        } else {
            articlesCache = normalizeArticles([...MOCK_ARTICLES]);
        }
    }
    isInitialized = true;
  },

  setArticles: (articles: Article[]) => {
    articlesCache = normalizeArticles(articles);
    isInitialized = true;
  },

  // Синхронизация: отправка данных на сервер
  save: async () => {
    // 1) LocalStorage — только как запасной вариант. Ошибки квоты не должны
    //    блокировать сохранение на сервер.
    if (typeof window !== 'undefined') {
      try {
        const safe = makeLocalStorageSafe(articlesCache);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
      } catch (e) {
        // Если квота/доступ к Storage ограничен — просто игнорируем.
        console.warn('localStorage save skipped:', e);
      }
    }

    // 2) Server JSON
    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(getAdminToken() ? { 'X-Admin-Token': getAdminToken() as string } : {}) },
            body: JSON.stringify(articlesCache)
        });
    } catch (e) {
        console.error('Failed to sync with server', e);
    }
  },

  // Загрузка изображения на сервер
  uploadImage: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const doUpload = async (): Promise<string> => {
      const response = await fetch(UPLOAD_URL, {
            headers: { ...(getAdminToken() ? { 'X-Admin-Token': getAdminToken() as string } : {}) },
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        let details = '';
        try {
          const j = await response.json();
          details = j?.error ? ` (${j.error})` : '';
        } catch {
          // ignore
        }
        throw new Error('Upload failed' + details);
      }
      const data = await response.json();
      if (!data?.url) throw new Error('Upload failed (no url)');
      return data.url as string;
    };

    try {
      return await doUpload();
    } catch (e) {
      // На хостинге Base64 — почти гарантированная смерть localStorage и огромный news.json.
      // Поэтому Base64 оставляем только для локальной разработки.
      if (!isDevHost()) {
        console.error('Upload error:', e);
        throw e;
      }

      console.warn('Upload error (dev), falling back to Base64', e);
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }
  },

  // --- Read Methods (Sync, return from Cache) ---

  getFeatured: (): Article | undefined => {
    const visible = withPublicVisible(articlesCache);
    return visible.find(a => a.isFeatured) || visible[0];
  },

  getBreaking: (): Article[] => {
    return withPublicVisible(articlesCache).filter(a => a.isBreaking).slice(0, 5);
  },

  getLatest: (limit = 10, excludeId?: string): Article[] => {
    let articles = [...withPublicVisible(articlesCache)].sort((a, b) => 
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
    if (excludeId) {
      articles = articles.filter(a => a.id !== excludeId);
    }
    return articles.slice(0, limit);
  },


  /**
   * «Сейчас читают» — гибрид:
   * 1) закреплённые (pinnedNowReading) по приоритету (pinnedNowReadingRank)
   * 2) добивка по просмотрам (views), затем по свежести
   */
  getNowReadingHybrid: (
    limit = 6,
    opts?: { excludeIds?: string[]; maxAgeHours?: number }
  ): Article[] => {
    const exclude = new Set((opts?.excludeIds || []).filter(Boolean));
    const maxAgeHours = typeof opts?.maxAgeHours === 'number' && isFinite(opts.maxAgeHours) ? opts.maxAgeHours : 72;
    const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;

    const all = [...withPublicVisible(articlesCache)].filter(a => !exclude.has(a.id));

    const pinned = all
      .filter(a => a.pinnedNowReading)
      .sort((a, b) => {
        const ra = a.pinnedNowReadingRank ?? 0;
        const rb = b.pinnedNowReadingRank ?? 0;
        if (ra !== rb) return ra - rb;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      })
      .slice(0, limit);

    const pinnedIds = new Set(pinned.map(a => a.id));

    const restPoolRecent = all.filter(a => !pinnedIds.has(a.id) && new Date(a.publishedAt).getTime() >= cutoff);
    const restPoolAny = all.filter(a => !pinnedIds.has(a.id));

    const pickFrom = (pool: Article[]) => {
      return pool
        .sort((a, b) => {
          const va = a.views ?? 0;
          const vb = b.views ?? 0;
          if (va !== vb) return vb - va;
          return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        })
        .slice(0, Math.max(0, limit - pinned.length));
    };

    let rest = pickFrom(restPoolRecent);
    if (pinned.length + rest.length < limit) {
      // если новостей мало за период — добиваем из всех
      const already = new Set([...pinnedIds, ...rest.map(a => a.id)]);
      rest = rest.concat(pickFrom(restPoolAny.filter(a => !already.has(a.id))));
      rest = rest.slice(0, Math.max(0, limit - pinned.length));
    }

    return [...pinned, ...rest].slice(0, limit);
  },

  /**
   * Учёт просмотров статьи (используется для «Сейчас читают»).
   * Защита от накрутки “в один заход”: +1 на статью за сессию браузера.
   */
  trackView: async (id: string) => {
    if (typeof window === 'undefined') return;

    const key = `cc_viewed_${id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // если sessionStorage недоступен — всё равно продолжим
    }

    // Обновим локальный кэш, чтобы рейтинг менялся сразу
    const a = articlesCache.find(x => x.id === id);
    if (a) a.views = (a.views ?? 0) + 1;

    try {
      await fetch(VIEW_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
    } catch {
      // игнорируем — просмотры не критичны
    }
  },
  getAll: (): Article[] => {
    return [...withPublicVisible(articlesCache)].sort((a, b) => 
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  },

  getByCategory: (slug: string): Article[] => {
    return withPublicVisible(articlesCache)
      .filter(a => a.category.slug === slug)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  },

  getBySlug: (slug: string): Article | undefined => {
    return withPublicVisible(articlesCache).find(a => a.slug === slug);
  },
  
  getById: (id: string): Article | undefined => {
    return articlesCache.find(a => a.id === id);
  },

  search: (query: string): Article[] => {
    const q = query.toLowerCase();
    return withPublicVisible(articlesCache).filter(a => 
      a.title.toLowerCase().includes(q) || 
      a.excerpt.toLowerCase().includes(q) ||
      a.content.some(block => {
        if (block.type === 'list') {
            return block.items.some(i => i.toLowerCase().includes(q));
        }
        return block.value.toLowerCase().includes(q);
      })
    );
  },

  getCategories: (): Category[] => CATEGORIES,

  getRelated: (article: Article): Article[] => {
    return withPublicVisible(articlesCache)
      .filter(a => a.category.slug === article.category.slug && a.id !== article.id)
      .slice(0, 4);
  },

  getAllAdmin: (): Article[] => {
    return [...articlesCache].sort((a, b) => 
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  },

  getBySlugAdmin: (slug: string): Article | undefined => {
    return articlesCache.find(a => a.slug === slug);
  },

  // --- Write Methods ---

  createArticle: async (article: Article) => {
    articlesCache.unshift(article);
    await newsService.save();
  },

  updateArticle: async (article: Article) => {
    const index = articlesCache.findIndex(a => a.id === article.id);
    if (index !== -1) {
      articlesCache[index] = article;
      await newsService.save();
    }
  },

  deleteArticle: async (id: string) => {
    articlesCache = articlesCache.filter(a => a.id !== id);
    await newsService.save();
  },

  moveToTrash: async (id: string) => {
    const article = articlesCache.find(a => a.id === id);
    if (!article) return;
    article.status = 'trash';
    article.deletedAt = new Date().toISOString();
    await newsService.save();
  },

  updateStatus: async (id: string, status: ArticleStatus) => {
    const article = articlesCache.find(a => a.id === id);
    if (!article) return;
    article.status = status;
    if (status === 'trash') {
      article.deletedAt = new Date().toISOString();
    } else {
      article.deletedAt = undefined;
    }
    await newsService.save();
  }
};
