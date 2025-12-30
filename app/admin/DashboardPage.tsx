import React, { useState, useEffect } from 'react';
import Link from '@/lib/next-shim';
import { newsService } from '@/lib/newsService';
import { Article } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pencil, Trash2, Plus, Search } from 'lucide-react';
import { formatDateShort } from '@/lib/utils';

export default function DashboardPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [search, setSearch] = useState('');

  const loadArticles = () => {
    setArticles(newsService.getAll());
  };

  useEffect(() => {
    loadArticles();
  }, []);

  const handleDelete = (id: string) => {
    if (window.confirm('Вы уверены, что хотите удалить эту статью?')) {
        newsService.deleteArticle(id);
        loadArticles();
    }
  };

  const filteredArticles = articles.filter(a => 
    a.title.toLowerCase().includes(search.toLowerCase())
  );

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

        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border flex items-center gap-4 bg-secondary/10">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Поиск по заголовкам..." 
                        className="pl-9 bg-background"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="text-sm text-muted-foreground ml-auto">
                    Всего: {filteredArticles.length}
                </div>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border bg-muted/50 text-left">
                            <th className="p-4 font-medium text-muted-foreground">Заголовок</th>
                            <th className="p-4 font-medium text-muted-foreground w-32">Рубрика</th>
                            <th className="p-4 font-medium text-muted-foreground w-40">Дата</th>
                            <th className="p-4 font-medium text-muted-foreground w-40 text-right">Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredArticles.map((article) => (
                            <tr key={article.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                                <td className="p-4">
                                    <div className="font-medium text-foreground line-clamp-1">{article.title}</div>
                                    <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{article.excerpt}</div>
                                </td>
                                <td className="p-4">
                                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-foreground">
                                        {article.category.title}
                                    </span>
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
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive cursor-pointer"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(article.id);
                                            }}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredArticles.length === 0 && (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-muted-foreground">
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