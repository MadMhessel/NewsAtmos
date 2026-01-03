import React, { useState, useEffect } from 'react';
import Link from '@/lib/next-shim';
import { newsService } from '@/lib/newsService';
import { Article, ArticleStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, Plus, Search, Copy, Archive, RefreshCw } from 'lucide-react';
import { formatDateShort } from '@/lib/utils';

const STATUS_TABS: { value: ArticleStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'draft', label: 'Черновики' },
  { value: 'review', label: 'На проверке' },
  { value: 'scheduled', label: 'Запланировано' },
  { value: 'published', label: 'Опубликовано' },
  { value: 'archived', label: 'Архив' },
  { value: 'trash', label: 'Корзина' },
];

const statusLabel = (status?: ArticleStatus) => {
  switch (status) {
    case 'draft':
      return 'Черновик';
    case 'review':
      return 'На проверке';
    case 'scheduled':
      return 'Запланировано';
    case 'archived':
      return 'Архив';
    case 'trash':
      return 'Корзина';
    case 'published':
    default:
      return 'Опубликовано';
  }
};

export default function DashboardPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ArticleStatus | 'all'>('all');

  const loadArticles = () => {
    setArticles(newsService.getAllAdmin());
  };

  useEffect(() => {
    loadArticles();
  }, []);

  const handleMoveToTrash = async (id: string) => {
    if (window.confirm('Переместить статью в корзину?')) {
      await newsService.moveToTrash(id);
      loadArticles();
    }
  };

  const handleArchive = async (id: string) => {
    await newsService.updateStatus(id, 'archived');
    loadArticles();
  };

  const handleRestore = async (id: string) => {
    await newsService.updateStatus(id, 'draft');
    loadArticles();
  };

  const handleDeleteForever = async (id: string) => {
    if (window.confirm('Удалить навсегда? Это действие необратимо.')) {
      await newsService.deleteArticle(id);
      loadArticles();
    }
  };

  const handleDuplicate = async (article: Article) => {
    const copy: Article = {
      ...article,
      id: Math.random().toString(36).substr(2, 9),
      slug: `${article.slug}-copy-${Date.now()}`,
      title: `${article.title} (копия)`,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await newsService.createArticle(copy);
    loadArticles();
  };

  const filteredArticles = articles.filter(a => {
    const matchesSearch = a.title.toLowerCase().includes(search.toLowerCase());
    const status = a.status || 'published';
    const matchesStatus = statusFilter === 'all' || status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalViews = articles.reduce((sum, article) => sum + (article.views ?? 0), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Новости</h1>
                <p className="text-sm sm:text-base text-muted-foreground">Управление контентом сайта</p>
            </div>
            <Button asChild>
                <Link href="/admin/create"><Plus className="w-4 h-4 mr-2" /> Добавить новость</Link>
            </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map(tab => (
            <Button
              key={tab.value}
              variant={statusFilter === tab.value ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter(tab.value)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border flex flex-wrap items-center gap-4 bg-secondary/10">
                <div className="relative flex-1 min-w-[240px] max-w-sm">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Поиск по заголовкам..." 
                        className="pl-9 bg-background"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span>Всего: {filteredArticles.length}</span>
                    <span>Просмотров всего: {totalViews}</span>
                </div>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border bg-muted/50 text-left">
                            <th className="p-4 font-medium text-muted-foreground">Заголовок</th>
                            <th className="p-4 font-medium text-muted-foreground w-40">Статус</th>
                            <th className="p-4 font-medium text-muted-foreground w-32">Просмотры</th>
                            <th className="p-4 font-medium text-muted-foreground w-40">Дата</th>
                            <th className="p-4 font-medium text-muted-foreground w-48 text-right">Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredArticles.map((article) => (
                            <tr key={article.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                                <td className="p-4">
                                    <div className="font-medium text-foreground line-clamp-1">{article.title}</div>
                                    <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{article.excerpt}</div>
                                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                      {article.isBreaking && <span className="rounded-full border px-2 py-0.5 text-destructive">Срочно</span>}
                                      {article.isFeatured && <span className="rounded-full border px-2 py-0.5">Главная</span>}
                                      {article.pinnedNowReading && (
                                        <span className="rounded-full border px-2 py-0.5">Сейчас читают (закреплено)</span>
                                      )}
                                      {!article.pinnedNowReading && (article.views ?? 0) > 0 && (
                                        <span className="rounded-full border px-2 py-0.5">Сейчас читают (по просмотрам)</span>
                                      )}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-foreground">
                                        {statusLabel(article.status)}
                                    </span>
                                </td>
                                <td className="p-4 text-muted-foreground whitespace-nowrap">
                                    {article.status === 'published' ? article.views ?? 0 : '—'}
                                </td>
                                <td className="p-4 text-muted-foreground whitespace-nowrap">
                                    {formatDateShort(article.publishedAt)}
                                </td>
                                <td className="p-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-muted-foreground hover:text-primary cursor-pointer">
                                            <Link href={`/admin/edit/${article.id}`}>
                                                <Pencil className="w-4 h-4" />
                                            </Link>
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-primary cursor-pointer"
                                            onClick={() => handleDuplicate(article)}
                                        >
                                            <Copy className="w-4 h-4" />
                                        </Button>
                                        {article.status !== 'trash' ? (
                                          <>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-primary cursor-pointer"
                                                onClick={() => handleArchive(article.id)}
                                            >
                                                <Archive className="w-4 h-4" />
                                            </Button>
                                            <Button 
                                                type="button"
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive cursor-pointer"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleMoveToTrash(article.id);
                                                }}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                          </>
                                        ) : (
                                          <>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-primary cursor-pointer"
                                                onClick={() => handleRestore(article.id)}
                                            >
                                                <RefreshCw className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive cursor-pointer"
                                                onClick={() => handleDeleteForever(article.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                          </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredArticles.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                    Ничего не найдено
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
}
