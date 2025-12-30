import Link from "@/lib/next-shim"
import { Article } from "@/lib/types"

export function BreakingList({ articles }: { articles: (Article & { time: string })[] }) {
  if (!articles.length) return null;

  return (
    <div className="bg-primary/5 border-b border-border/60 h-[38px] flex items-center relative overflow-hidden">
      <div className="container flex items-center h-full">
        {/* Label */}
        <div className="flex items-center gap-2 shrink-0 pr-6 border-r border-border h-full relative z-10">
             <span className="flex h-1.5 w-1.5 rounded-full bg-accent"></span>
             <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-foreground/80">Сейчас</span>
        </div>
        
        {/* Scroll Area */}
        <div className="flex-1 overflow-x-auto no-scrollbar flex items-center h-full pl-4 mask-fade-right">
          <div className="flex items-center gap-6 whitespace-nowrap">
            {articles.map((article, idx) => (
              <div key={article.id} className="flex items-center gap-4 group">
                {idx > 0 && <span className="w-px h-3 bg-accent/30" />}
                <Link 
                  href={`/news/${article.slug}`}
                  className="flex items-center gap-2 hover:opacity-100 opacity-80 transition-opacity"
                >
                  <span className="font-mono text-[11px] text-accent font-medium tracking-tight">{article.time}</span>
                  <span className="text-[12px] font-medium text-foreground tracking-tight group-hover:underline decoration-border underline-offset-4">{article.title}</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}