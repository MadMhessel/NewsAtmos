import React from "react"
import { newsService } from "@/lib/newsService"
import { ArticleContent } from "@/components/news/ArticleContent"
import { FactsBox } from "@/components/news/FactsBox"
import { ArticleCard } from "@/components/news/ArticleCard"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/utils"
import { Image } from "@/lib/next-shim"
import Link from "@/lib/next-shim"
import { useParams, notFound } from "@/lib/next-shim"
import { Share2, AlertTriangle, Clock, ChevronRight } from "lucide-react"

export default function ArticlePage() {
  const params = useParams();
  const slug = params.slug as string;
  
  const article = newsService.getBySlug(slug)

  if (!article) {
    return notFound();
  }

  React.useEffect(() => {
    // +1 просмотр за сессию браузера
    newsService.trackView(article.id);
  }, [article.id]);

  const related = newsService.getRelated(article)

  return (
    <div className="pb-20 bg-background">
      {/* Breadcrumbs */}
      <div className="border-b border-border py-4 mb-8">
        <div className="container flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground overflow-hidden whitespace-nowrap">
           <Link href="/" className="hover:text-accent transition-colors">Главная</Link>
           <ChevronRight className="h-3 w-3" />
           <Link href={`/category/${article.category.slug}`} className="hover:text-accent transition-colors">{article.category.title}</Link>
           <ChevronRight className="h-3 w-3" />
           <span className="text-foreground truncate opacity-50">{article.title}</span>
        </div>
      </div>

      <article className="container">
        <header className="mx-auto max-w-[800px] mb-12 text-center md:text-left">
           <div className="flex flex-wrap items-center gap-4 mb-8 justify-center md:justify-start">
             <Link 
                href={`/category/${article.category.slug}`} 
                className="text-accent font-bold uppercase tracking-[0.15em] text-[10px] hover:underline underline-offset-4"
             >
                {article.category.title}
             </Link>
             {article.isBreaking && (
                <span className="bg-destructive/10 text-destructive px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-sm border border-destructive/20">
                  Срочно
                </span>
             )}
           </div>

           <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] mb-8 text-foreground">
             {article.title}
           </h1>

           <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed mb-10 font-medium">
             {article.excerpt}
           </p>

           <div className="flex flex-wrap items-center justify-center md:justify-between gap-6 py-6 border-t border-b border-border">
              <div className="flex items-center gap-4">
                 <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center text-lg font-bold text-muted-foreground">
                    {article.author.name.charAt(0)}
                 </div>
                 <div className="text-sm">
                    <div className="font-bold text-foreground">{article.author.name}</div>
                    <div className="text-muted-foreground text-xs">{article.author.role}</div>
                 </div>
              </div>
              
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                 <div className="flex items-center gap-2">
                    <time>{formatDate(article.publishedAt)}</time>
                 </div>
                 {article.updatedAt && (
                   <div className="text-accent font-medium text-xs uppercase tracking-wider">
                      Обновлено: {new Date(article.updatedAt).toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}
                   </div>
                 )}
              </div>
           </div>
        </header>

        {/* Hero Image */}
        {article.heroImage && (
          <figure className="mx-auto mb-16 w-full max-w-[1000px]">
            <div className="flex justify-center rounded-lg bg-gray-100 dark:bg-muted p-2">
              <Image 
                src={article.heroImage} 
                alt={article.title}
                priority
                className="h-auto w-auto max-w-full rounded-md"
              />
            </div>
            <figcaption className="mt-3 text-xs font-medium text-muted-foreground">
              Фото: Источник / Пресс-служба
            </figcaption>
          </figure>
        )}
        
        <div className="mx-auto max-w-[760px]">
            {/* Facts */}
            {article.facts && <FactsBox facts={article.facts} />}

            {/* Content */}
            <ArticleContent content={article.content} />

            {/* Timeline */}
            {article.timeline && (
              <div className="my-14 p-8 bg-card border border-border rounded-lg">
                <h3 className="font-bold text-lg mb-8 uppercase tracking-widest text-foreground">Хронология</h3>
                <div className="space-y-8 relative border-l border-border ml-2 pl-8">
                  {article.timeline.map((item, i) => (
                    <div key={i} className="relative group">
                      <div className="absolute -left-[37px] top-1.5 h-3 w-3 rounded-full bg-background border-2 border-accent group-hover:bg-accent transition-colors" />
                      <div className="text-xs font-bold text-accent mb-2 font-mono">{item.time}</div>
                      <div className="text-base text-foreground leading-relaxed font-medium">{item.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-3 mt-16 pt-10 border-t border-border">
              {article.tags.map(tag => (
                <Link key={tag} href={`/search?q=${tag}`} className="px-4 py-1.5 bg-transparent border border-border hover:border-accent text-muted-foreground hover:text-foreground text-xs font-bold uppercase tracking-wider rounded-full transition-all">
                  #{tag}
                </Link>
              ))}
            </div>
            
            {/* Disclaimer / Report */}
            <div className="mt-16 p-6 bg-muted/20 rounded-lg flex flex-col md:flex-row items-center justify-between gap-6">
               <div className="text-sm text-muted-foreground text-center md:text-left">
                  <p>Заметили ошибку? Выделите текст и нажмите Ctrl+Enter или сообщите нам.</p>
               </div>
               <div className="flex gap-3">
                 <Button variant="ghost" size="sm" className="h-9 gap-2 text-muted-foreground hover:text-foreground">
                   <AlertTriangle className="h-3 w-3" /> Исправить
                 </Button>
                 <Button variant="outline" size="sm" className="h-9 gap-2 bg-transparent border-border hover:border-foreground">
                   <Share2 className="h-3 w-3" /> Поделиться
                 </Button>
               </div>
            </div>
        </div>
      </article>

      {/* Related News */}
      {related.length > 0 && (
        <section className="bg-card border-t border-border mt-24 py-20">
          <div className="container">
            <div className="flex items-center gap-4 mb-10">
               <span className="w-8 h-px bg-accent"></span>
               <h2 className="text-xl font-bold uppercase tracking-widest text-foreground">Читайте также</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
              {related.map(item => (
                <ArticleCard key={item.id} article={item} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
