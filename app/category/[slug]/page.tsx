import React from "react"
import { newsService } from "@/lib/newsService"
import { ArticleCard } from "@/components/news/ArticleCard"
import { useParams, notFound } from "@/lib/next-shim"

export default function CategoryPage() {
  const params = useParams();
  const slug = params.slug as string;
  
  const articles = newsService.getByCategory(slug)
  const categories = newsService.getCategories()
  const category = categories.find(c => c.slug === slug)

  if (!category) {
    return notFound();
  }

  return (
    <div className="container py-8 md:py-12">
      <div className="mb-10 border-b pb-6">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">{category.title}</h1>
        <div className="mt-4 flex gap-2 text-sm text-muted-foreground">
          <button className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground font-medium">Все</button>
          <button className="px-3 py-1 rounded-full hover:bg-secondary/50">За сегодня</button>
          <button className="px-3 py-1 rounded-full hover:bg-secondary/50">Популярное</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
        {articles.map(article => (
          <ArticleCard key={article.id} article={article} />
        ))}
        {articles.length === 0 && (
          <p className="col-span-full text-muted-foreground">Новостей в этой рубрике пока нет.</p>
        )}
      </div>
    </div>
  )
}
