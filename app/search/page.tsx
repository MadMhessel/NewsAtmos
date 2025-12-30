import React from "react"
import { newsService } from "@/lib/newsService"
import { ArticleCard } from "@/components/news/ArticleCard"
import { SearchBar } from "@/components/shared/SearchBar"
import { useSearchParams } from "@/lib/next-shim"

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || ""
  const results = query ? newsService.search(query) : []

  return (
    <div className="container py-12 min-h-[60vh]">
      <div className="max-w-xl mx-auto mb-12 text-center">
        <h1 className="text-3xl font-bold mb-6">Поиск</h1>
        <SearchBar />
      </div>

      {query && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold border-b pb-2">
            Результаты по запросу «{query}» <span className="text-muted-foreground ml-2">{results.length}</span>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {results.map(article => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>

          {results.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Ничего не найдено. Попробуйте изменить запрос.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
