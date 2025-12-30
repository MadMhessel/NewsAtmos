import React from "react"
import Link from "@/lib/next-shim"
import { Image } from "@/lib/next-shim"
import { Article } from "@/lib/types"
import { formatDateShort, cn } from "@/lib/utils"

export interface ArticleCardProps {
  article: Article
  variant?: "compact" | "default" | "featured"
  className?: string
}

export const ArticleCard: React.FC<ArticleCardProps> = ({ article, variant = "default", className }) => {
  const heroPosition = article.heroFocal
    ? `${Math.round(article.heroFocal.x * 100)}% ${Math.round(article.heroFocal.y * 100)}%`
    : undefined
  // Compact: Sidebar style ("Right Now")
  if (variant === "compact") {
    return (
      <article className={cn("group relative pl-4 py-3 first:pt-0 border-l border-border/40 hover:border-accent transition-colors duration-300", className)}>
        <Link href={`/news/${article.slug}`} className="block">
          <div className="flex items-center gap-2 mb-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
              <time className="text-[11px] text-accent font-medium font-mono" dateTime={article.publishedAt}>
                {new Date(article.publishedAt).toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'})}
              </time>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 group-hover:text-foreground transition-colors">
                  {article.category.title}
              </span>
          </div>
          <h3 className="text-[14px] font-medium leading-snug text-foreground group-hover:text-primary transition-colors">
            {article.title}
          </h3>
        </Link>
        {/* Subtle hover background effect */}
        <div className="absolute inset-0 bg-secondary/0 group-hover:bg-secondary/10 -z-10 rounded-r-md transition-colors" />
      </article>
    )
  }

  // Default: Feed style
  return (
    <article className={cn("group flex flex-col h-full bg-card rounded-xl border border-border/60 hover:border-border transition-all duration-300 hover:shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden", className)}>
      {article.heroImage && (
        <Link href={`/news/${article.slug}`} className="relative aspect-[3/2] w-full block overflow-hidden bg-gray-100 dark:bg-muted">
           <Image 
             src={article.heroImage} 
             alt={article.title}
             fill
             className="object-cover transition-transform duration-700 group-hover:scale-105"
             style={heroPosition ? { objectPosition: heroPosition } : undefined}
           />
           <div className="absolute top-4 left-4 z-10">
             <span className="badge-pill px-3 py-1 rounded-full bg-primary text-primary-foreground border-transparent shadow-md hover:bg-primary/90 hover:text-primary-foreground hover:border-transparent">
               {article.category.title}
             </span>
           </div>
        </Link>
      )}
      
      <div className="flex flex-col flex-1 p-5">
        {!article.heroImage && (
             <div className="mb-4">
                 <span className="badge-pill">
                    {article.category.title}
                 </span>
             </div>
        )}
        
        <Link href={`/news/${article.slug}`} className="mb-3 block">
          <h3 className="text-[1.125rem] font-bold leading-[1.35] tracking-tight text-foreground group-hover:text-primary/80 transition-colors">
            {article.title}
          </h3>
        </Link>
        
        <p className="text-muted-foreground text-[14px] leading-relaxed line-clamp-3 mb-5 flex-1">
          {article.excerpt}
        </p>
        
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/30">
           <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-foreground/70">{article.author.name}</span>
           </div>
           <time dateTime={article.publishedAt} className="text-[11px] font-medium text-muted-foreground">{formatDateShort(article.publishedAt)}</time>
        </div>
      </div>
    </article>
  )
}
