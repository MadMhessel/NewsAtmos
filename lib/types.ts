export type Category = {
  slug: string;
  title: string;
};

export type Author = {
  name: string;
  role: string;
};

export type ArticleStatus = 'draft' | 'review' | 'scheduled' | 'published' | 'archived' | 'trash';

export type ArticleSource = {
  name?: string;
  url?: string;
};

export type ArticleLocation = {
  city?: string;
  district?: string;
  address?: string;
};

export type ContentBlock = 
  | { type: 'paragraph'; value: string }
  | { type: 'heading'; value: string }
  | { type: 'quote'; value: string; author?: string }
  | { type: 'list'; items: string[] }
  | { type: 'divider' }
  | { type: 'callout'; kind: 'info' | 'warning' | 'important'; title?: string; value: string };

export type Article = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: ContentBlock[];
  category: Category;
  tags: string[];
  author: Author;
  publishedAt: string; // ISO date string
  updatedAt?: string;
  heroImage: string;
  readingTime: number; // minutes
  isBreaking?: boolean;
  isFeatured?: boolean;
  // Популярность/блок «Сейчас читают»
  views?: number;
  pinnedNowReading?: boolean;
  pinnedNowReadingRank?: number;
  status?: ArticleStatus;
  createdAt?: string;
  scheduledAt?: string;
  deletedAt?: string;
  source?: ArticleSource;
  location?: ArticleLocation;
  isVerified?: boolean;
  heroFocal?: { x: number; y: number };
  heroImageSquare?: string;
  facts?: string[]; // "Что известно на сейчас"
  timeline?: { time: string; text: string }[];
  relatedIds?: string[];
  sourceIncomingId?: string;
};

export type LiveStreamStatus = 'draft' | 'published' | 'finished';

export type LiveUpdateType = 'update' | 'milestone';

export type LiveStream = {
  id: string;
  slug: string;
  title: string;
  lead: string;
  body?: string;
  coverImage?: string;
  category?: Category;
  tags?: string[];
  status?: LiveStreamStatus;
  pinned?: boolean;
  pinnedOrder?: number;
  createdAt: string;
  updatedAt: string;
};

export type LiveUpdate = {
  id: string;
  liveStreamId: string;
  eventTime: string;
  text: string;
  type: LiveUpdateType;
  sourceName?: string;
  sourceUrl?: string;
  mediaUrl?: string;
  createdAt: string;
  updatedAt?: string;
};
