import Link from "@/lib/next-shim"
import { Image } from "@/lib/next-shim"
import { Article } from "@/lib/types"
import { formatDate } from "@/lib/utils"

export function FeaturedArticle({ article }: { article: Article }) {
  return (
    <section className="group relative w-full mb-12">
       <div className="grid lg:grid-cols-12 gap-0 lg:gap-10 bg-card lg:bg-transparent rounded-xl overflow-hidden lg:overflow-visible shadow-sm lg:shadow-none border border-border/60 lg:border-none">
         {/* Image Column */}
         <Link href={`/news/${article.slug}`} className="lg:col-span-8 relative aspect-[16/9] w-full overflow-hidden rounded-none lg:rounded-xl block bg-gray-100 dark:bg-muted">
            <Image 
               src={article.heroImage} 
               alt={article.title}
               fill
               priority
               className="object-cover transition-transform duration-1000 group-hover:scale-[1.02]"
             />
             <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors" />
         </Link>

         {/* Content Column */}
         <div className="lg:col-span-4 flex flex-col justify-center py-6 px-6 lg:py-2 lg:px-0">
            <div className="flex items-center gap-3 mb-6">
              {article.isBreaking && (
                <span className="badge-pill bg-destructive/5 text-destructive border-destructive/20 hover:border-destructive/40">
                    Срочно
                </span>
              )}
              <span className="badge-pill">
                {article.category.title}
              </span>
            </div>
            
            <Link href={`/news/${article.slug}`}>
              <h1 className="text-3xl md:text-4xl lg:text-[2.5rem] font-extrabold tracking-tight leading-[1.1] mb-6 text-foreground group-hover:text-foreground/80 transition-colors">
                {article.title}
              </h1>
            </Link>
            
            <p className="text-lg text-muted-foreground leading-relaxed mb-8 line-clamp-4 md:line-clamp-none font-medium">
              {article.excerpt}
            </p>
            
            <div className="flex items-center gap-3 text-xs mt-auto pt-6 border-t border-border/50">
              <span className="font-bold text-foreground">{article.author.name}</span>
              <span className="w-1 h-1 rounded-full bg-border" />
              <time className="text-muted-foreground font-medium">{formatDate(article.publishedAt)}</time>
            </div>
         </div>
       </div>
    </section>
  )
}