import React from "react"
import { newsService } from "@/lib/newsService"
import { ArticleCard } from "@/components/news/ArticleCard"
import { useParams, notFound } from "@/lib/next-shim"

export default function CategoryPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [activeFilter, setActiveFilter] = React.useState<'all' | 'today' | 'popular'>('all');
  
  const articles = newsService.getByCategory(slug)
  const categories = newsService.getCategories()
  const category = categories.find(c => c.slug === slug)

  if (!category) {
    return notFound();
  }

  const filteredArticles = React.useMemo(() => {
    if (activeFilter === 'today') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      return articles.filter(article => new Date(article.publishedAt).getTime() >= startOfDay.getTime());
    }

    if (activeFilter === 'popular') {
      return [...articles].sort((a, b) => {
        const viewsA = a.views ?? 0;
        const viewsB = b.views ?? 0;
        if (viewsA !== viewsB) return viewsB - viewsA;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      });
    }

    return articles;
  }, [activeFilter, articles]);

  const getFilterClassName = (filter: 'all' | 'today' | 'popular') => {
    const base = "px-3 py-1 rounded-full font-medium transition-colors";
    if (filter === activeFilter) {
      return `${base} bg-secondary text-secondary-foreground`;
    }
    return `${base} hover:bg-secondary/50`;
  };

  return (
    <div className="container py-8 md:py-12">
      <div className="mb-10 border-b pb-6">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">{category.title}</h1>
        <div className="mt-4 flex gap-2 text-sm text-muted-foreground">
          <button
            className={getFilterClassName('all')}
            onClick={() => setActiveFilter('all')}
            type="button"
          >
            Все
          </button>
          <button
            className={getFilterClassName('today')}
            onClick={() => setActiveFilter('today')}
            type="button"
          >
            За сегодня
          </button>
          <button
            className={getFilterClassName('popular')}
            onClick={() => setActiveFilter('popular')}
            type="button"
          >
            Популярное
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
        {filteredArticles.map(article => (
          <ArticleCard key={article.id} article={article} />
        ))}
        {filteredArticles.length === 0 && (
          <p className="col-span-full text-muted-foreground">Новостей в этой рубрике пока нет.</p>
        )}
      </div>
    </div>
  )
}
