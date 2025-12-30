export type Category = {
  slug: string;
  title: string;
};

export type Author = {
  name: string;
  role: string;
};

export type ContentBlock = 
  | { type: 'paragraph'; value: string }
  | { type: 'heading'; value: string }
  | { type: 'quote'; value: string; author?: string }
  | { type: 'list'; items: string[] };

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
  facts?: string[]; // "Что известно на сейчас"
  timeline?: { time: string; text: string }[];
  relatedIds?: string[];
};
