import { Article, Category, ContentBlock, LiveStream, LiveUpdate } from './types';

export const CATEGORIES: Category[] = [
  { slug: 'city', title: 'Город' },
  { slug: 'incidents', title: 'Происшествия' },
  { slug: 'transport', title: 'Транспорт' },
  { slug: 'real-estate', title: 'Недвижимость' },
  { slug: 'russia-world', title: 'Россия и Мир' },
  { slug: 'events', title: 'Афиша' },
  { slug: 'sports', title: 'Спорт' },
];

const contentTemplate: ContentBlock[] = [
  { type: 'paragraph', value: 'Как сообщают источники в администрации, решение было принято после длительных консультаций с экспертами. Основная цель нововведений — улучшение качества жизни горожан и оптимизация существующих процессов.' },
  { type: 'paragraph', value: '«Мы понимаем обеспокоенность жителей, но уверяем, что все изменения пойдут на пользу», — заявил представитель ведомства на утреннем брифинге.' },
  { type: 'heading', value: 'Что изменится?' },
  { type: 'list', items: ['Первый этап начнется уже в следующем месяце.', 'Финансирование выделено из городского бюджета.', 'Контроль за исполнением возложен на специальную комиссию.'] },
  { type: 'paragraph', value: 'Эксперты отрасли отмечают, что подобные меры уже успешно зарекомендовали себя в соседних регионах. Однако, остаются вопросы касательно сроков реализации проекта.' },
  { type: 'quote', value: 'Это исторический момент для нашего города. Мы стоим на пороге больших перемен.', author: 'Иван Петров, урбанист' },
];

export const MOCK_ARTICLES: Article[] = [
  {
    id: '1',
    slug: 'new-central-park-opening',
    title: 'В центре города утвердили проект нового масштабного парка',
    excerpt: 'Мэрия представила финальный план реконструкции набережной. Работы начнутся уже весной, а бюджет превысит 2 миллиарда рублей.',
    content: [
      { type: 'paragraph', value: 'Сегодня на заседании градостроительного совета был утвержден окончательный проект нового центрального парка, который расположится вдоль набережной реки. Это один из самых амбициозных проектов десятилетия.' },
      ...contentTemplate
    ],
    category: { slug: 'city', title: 'Город' },
    tags: ['парки', 'благоустройство', 'мэрия'],
    author: { name: 'Алексей Смирнов', role: 'Редактор отдела "Город"' },
    publishedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 mins ago
    heroImage: 'https://loremflickr.com/800/600/park,architecture',
    readingTime: 4,
    isFeatured: true,
    facts: ['Площадь парка: 15 гектаров', 'Срок сдачи: 2025 год', 'Подрядчик: ООО "Зеленый Город"'],
    timeline: [
      { time: '10:00', text: 'Началось заседание совета' },
      { time: '11:30', text: 'Главный архитектор представил макет' },
      { time: '12:15', text: 'Проект утвержден единогласно' }
    ]
  },
  {
    id: '2',
    slug: 'metro-line-delay',
    title: 'Открытие новой станции метро переносится на полгода',
    excerpt: 'Причиной стали сложные грунты и задержки поставок оборудования. Подрядчик обещает наверстать упущенное.',
    content: contentTemplate,
    category: { slug: 'transport', title: 'Транспорт' },
    tags: ['метро', 'строительство', 'транспорт'],
    author: { name: 'Елена Волкова', role: 'Корреспондент' },
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    heroImage: 'https://loremflickr.com/800/600/subway,construction',
    readingTime: 3,
    isBreaking: true
  },
  {
    id: '3',
    slug: 'football-championship-win',
    title: '«Горожане» разгромили соперника в финале кубка',
    excerpt: 'Матч закончился со счетом 3:0. Болельщики празднуют победу на улицах города.',
    content: contentTemplate,
    category: { slug: 'sports', title: 'Спорт' },
    tags: ['футбол', 'победа'],
    author: { name: 'Дмитрий Орлов', role: 'Спортивный обозреватель' },
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    heroImage: 'https://loremflickr.com/800/600/football,stadium',
    readingTime: 2
  },
  {
    id: '4',
    slug: 'accident-main-street',
    title: 'Крупное ДТП на Ленина: движение перекрыто',
    excerpt: 'Столкнулись автобус и грузовик. На месте работают экстренные службы. Выбирайте пути объезда.',
    content: contentTemplate,
    category: { slug: 'incidents', title: 'Происшествия' },
    tags: ['ДТП', 'пробки'],
    author: { name: 'Служба новостей', role: '' },
    publishedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    heroImage: 'https://loremflickr.com/800/600/traffic,police',
    readingTime: 1,
    isBreaking: true
  },
  {
    id: '5',
    slug: 'art-exhibition-opening',
    title: 'Выставка авангардистов открылась в музее ИЗО',
    excerpt: 'Представлено более 100 полотен из частных коллекций. Вход свободный до конца недели.',
    content: contentTemplate,
    category: { slug: 'events', title: 'Афиша' },
    tags: ['культура', 'музей', 'выставка'],
    author: { name: 'Мария Искусственная', role: 'Арт-критик' },
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    heroImage: 'https://loremflickr.com/800/600/art,museum',
    readingTime: 5
  },
  {
    id: '6',
    slug: 'housing-prices-rise',
    title: 'Стоимость новостроек выросла на 15% за квартал',
    excerpt: 'Аналитики связывают это с подорожанием стройматериалов и высоким спросом на льготную ипотеку.',
    content: contentTemplate,
    category: { slug: 'real-estate', title: 'Недвижимость' },
    tags: ['цены', 'квартиры', 'ипотека'],
    author: { name: 'Иван Рублев', role: 'Экономический обозреватель' },
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    heroImage: 'https://loremflickr.com/800/600/building,architecture',
    readingTime: 6
  },
  {
    id: '7',
    slug: 'russia-world-summit',
    title: 'Россия и Мир: лидеры договорились о совместных проектах в энергетике',
    excerpt: 'На международном саммите стороны обсудили развитие инфраструктуры и новые технологические обмены.',
    content: contentTemplate,
    category: { slug: 'russia-world', title: 'Россия и Мир' },
    tags: ['дипломатия', 'энергетика', 'международные отношения'],
    author: { name: 'Служба новостей', role: 'Международный отдел' },
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    heroImage: 'https://loremflickr.com/800/600/world,conference',
    readingTime: 4
  },
  {
    id: '8',
    slug: 'global-markets-outlook',
    title: 'Россия и Мир: рынки реагируют на новые торговые соглашения',
    excerpt: 'Эксперты отмечают рост интереса инвесторов к совместным проектам и логистике.',
    content: contentTemplate,
    category: { slug: 'russia-world', title: 'Россия и Мир' },
    tags: ['экономика', 'рынки', 'торговля'],
    author: { name: 'Екатерина Литвинова', role: 'Экономический обозреватель' },
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    heroImage: 'https://loremflickr.com/800/600/global,market',
    readingTime: 5
  },
  // Filling up to have more data
  ...Array.from({ length: 15 }).map((_, i) => ({
    id: `generated-${i}`,
    slug: `generated-news-${i}`,
    title: `Событие местного значения номер ${i + 1}: подробности и факты`,
    excerpt: 'Краткое описание события, которое произошло недавно и может быть интересно широкому кругу читателей.',
    content: contentTemplate,
    category: CATEGORIES[i % CATEGORIES.length],
    tags: ['общество', 'новости'],
    author: { name: 'Редакция', role: '' },
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * (i + 1) * 5).toISOString(),
    heroImage: `https://loremflickr.com/800/600/city,urban?lock=${i}`,
    readingTime: 3,
  }))
];

const liveBaseTime = Date.now();

export const MOCK_LIVE_STREAMS: LiveStream[] = [
  {
    id: 'live-1',
    slug: 'city-marathon-live',
    title: 'Онлайн: городской марафон — старт, перекрытия, результаты',
    lead: 'Следим в реальном времени за стартом, перекрытиями улиц и финишем участников.',
    coverImage: 'https://loremflickr.com/1200/800/marathon,city',
    category: { slug: 'events', title: 'Афиша' },
    tags: ['марафон', 'спорт', 'центр'],
    status: 'published',
    pinned: true,
    pinnedOrder: 1,
    createdAt: new Date(liveBaseTime - 1000 * 60 * 90).toISOString(),
    updatedAt: new Date(liveBaseTime - 1000 * 60 * 4).toISOString(),
  },
];

export const MOCK_LIVE_UPDATES: LiveUpdate[] = [
  {
    id: 'live-1-update-1',
    liveStreamId: 'live-1',
    eventTime: new Date(liveBaseTime - 1000 * 60 * 70).toISOString(),
    text: 'Открыли стартовый коридор, участники собираются на площади.',
    type: 'milestone',
    createdAt: new Date(liveBaseTime - 1000 * 60 * 70).toISOString(),
    updatedAt: new Date(liveBaseTime - 1000 * 60 * 70).toISOString(),
  },
  {
    id: 'live-1-update-2',
    liveStreamId: 'live-1',
    eventTime: new Date(liveBaseTime - 1000 * 60 * 55).toISOString(),
    text: 'Стартовали первые участники. Движение в центре перекрыто до 14:00.',
    type: 'update',
    sourceName: 'Дирекция марафона',
    createdAt: new Date(liveBaseTime - 1000 * 60 * 55).toISOString(),
    updatedAt: new Date(liveBaseTime - 1000 * 60 * 55).toISOString(),
  },
  {
    id: 'live-1-update-3',
    liveStreamId: 'live-1',
    eventTime: new Date(liveBaseTime - 1000 * 60 * 35).toISOString(),
    text: 'На финише готовится зона награждения, волонтёры раздают воду.',
    type: 'update',
    createdAt: new Date(liveBaseTime - 1000 * 60 * 35).toISOString(),
    updatedAt: new Date(liveBaseTime - 1000 * 60 * 35).toISOString(),
  },
  {
    id: 'live-1-update-4',
    liveStreamId: 'live-1',
    eventTime: new Date(liveBaseTime - 1000 * 60 * 10).toISOString(),
    text: 'Первые участники финишировали, время лидера — 1:05:42.',
    type: 'milestone',
    createdAt: new Date(liveBaseTime - 1000 * 60 * 10).toISOString(),
    updatedAt: new Date(liveBaseTime - 1000 * 60 * 10).toISOString(),
  },
];
