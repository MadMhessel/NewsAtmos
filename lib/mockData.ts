import { Article, Category, LiveStream, LiveUpdate } from './types';

export const CATEGORIES: Category[] = [
  { slug: 'city', title: 'Город' },
  { slug: 'incidents', title: 'Происшествия' },
  { slug: 'transport', title: 'Транспорт' },
  { slug: 'real-estate', title: 'Недвижимость' },
  { slug: 'russia-world', title: 'Россия и Мир' },
  { slug: 'events', title: 'Афиша' },
  { slug: 'sports', title: 'Спорт' },
];

export const MOCK_ARTICLES: Article[] = [];
export const MOCK_LIVE_STREAMS: LiveStream[] = [];
export const MOCK_LIVE_UPDATES: LiveUpdate[] = [];
