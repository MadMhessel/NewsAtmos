import React, { useState } from "react"
import { newsService } from "@/lib/newsService"
import { liveService } from "@/lib/liveService"
import { FeaturedArticle } from "@/components/news/FeaturedArticle"
import { BreakingList } from "@/components/news/BreakingList"
import { ArticleCard } from "@/components/news/ArticleCard"
import { LivePinnedCard } from "@/components/live/LivePinnedCard"
import { Button } from "@/components/ui/button"
import { useSiteSettings } from "@/components/shared/SiteSettingsProvider"
import Link from "@/lib/next-shim"
import { Send, Loader2 } from "lucide-react"

export default function HomePage() {
  const { settings } = useSiteSettings()

  const [displayCount, setDisplayCount] = useState(6)
  const [isLoading, setIsLoading] = useState(false)

  const featured = newsService.getFeatured()
  const breaking = newsService.getBreaking()
  const pinnedLive = liveService.getPinned()
  const primaryLive = pinnedLive[0]
  const latestLiveUpdates = primaryLive
    ? liveService.getUpdatesByStreamId(primaryLive.id, 'desc').slice(0, 6)
    : []
  // Fetch more articles to accommodate pagination
  const allLatest = newsService.getLatest(60, featured?.id)

  const breakingForTicker = breaking.map(b => ({
    ...b,
    time: new Date(b.publishedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }))

  // «Сейчас читают»: гибрид (закреплённые + автодобивка по просмотрам)
  const nowReading = newsService.getNowReadingHybrid(
    settings.nowReadingCount || 6,
    { excludeIds: featured ? [featured.id] : [], maxAgeHours: settings.nowReadingMaxAgeHours || 72 }
  )
  // Основная лента: показываем все свежие новости по порядку публикации
  const visibleArticles = allLatest.slice(0, displayCount)
  const hasMore = displayCount < allLatest.length

  const handleShowMore = () => {
    setIsLoading(true)
    // Simulate network delay for better UX
    setTimeout(() => {
        setDisplayCount(prev => prev + 6)
        setIsLoading(false)
    }, 600)
  }

  return (
    <>
      <BreakingList articles={breakingForTicker} />

      {pinnedLive.length > 0 && (
        <section className="container py-10 md:py-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-foreground relative pl-4 after:absolute after:left-0 after:top-1 after:bottom-1 after:w-1 after:bg-destructive after:rounded-full">
              Онлайн-новости
            </h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
            <div className="grid gap-6">
              {pinnedLive.map(stream => (
                <LivePinnedCard key={stream.id} stream={stream} />
              ))}
            </div>
            {primaryLive && (
              <aside className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4 lg:sticky lg:top-24 h-fit">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Сводка последних событий</h3>
                  <Link
                    href={`/live/${primaryLive.slug}`}
                    className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-accent"
                  >
                    К трансляции
                  </Link>
                </div>
                {latestLiveUpdates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Пока нет обновлений.</p>
                ) : (
                  <div className="space-y-3 text-sm">
                    {latestLiveUpdates.map((item) => (
                      <Link
                        key={item.id}
                        href={`/live/${primaryLive.slug}#update-${item.id}`}
                        className="block rounded-lg border border-border/60 px-3 py-2 hover:border-accent/40 hover:text-foreground transition-colors"
                      >
                        <div className="text-[11px] font-semibold text-accent uppercase tracking-widest mb-1">
                          {new Date(item.eventTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-sm text-foreground/80 line-clamp-3">{item.text}</div>
                      </Link>
                    ))}
                  </div>
                )}
              </aside>
            )}
          </div>
        </section>
      )}
      
      <div className="container py-10 md:py-16">
        {featured && <FeaturedArticle article={featured} />}

        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 mt-16">
           
           {/* Main Feed (8 cols) */}
           <div className="lg:col-span-8">
              <div className="flex items-center justify-between mb-8">
                 <h2 className="text-2xl font-bold tracking-tight text-foreground relative pl-4 after:absolute after:left-0 after:top-1 after:bottom-1 after:w-1 after:bg-accent after:rounded-full">Лента событий</h2>
              </div>
              
              <div className="grid md:grid-cols-2 gap-x-6 gap-y-10 animate-in fade-in duration-500">
                {visibleArticles.map(article => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
              
              <div className="mt-16 flex justify-center">
                 {hasMore ? (
                     <Button 
                        variant="outline" 
                        size="lg" 
                        onClick={handleShowMore}
                        disabled={isLoading}
                        className="w-full md:w-auto h-12 rounded-full border border-border text-foreground hover:bg-secondary/50 font-bold uppercase tracking-widest text-[11px] px-8 transition-all min-w-[200px]" 
                     >
                        {isLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            "Показать еще"
                        )}
                     </Button>
                 ) : (
                     <p className="text-muted-foreground text-sm font-medium opacity-50">Больше новостей нет</p>
                 )}
              </div>
           </div>

           {/* Sidebar (4 cols) */}
           <aside className="lg:col-span-4 space-y-12">
              
              {/* "Right Now" Block */}
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent mb-6 flex items-center gap-2">
                   Сейчас читают
                </h3>
                <div className="flex flex-col gap-1">
                  {nowReading.map(article => (
                    <ArticleCard key={article.id} article={article} variant="compact" />
                  ))}
                </div>
              </div>

              {/* Telegram Promo */}
              <div className="bg-white dark:bg-card border border-border rounded-xl p-8 shadow-sm relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-3 opacity-[0.03]">
                    <Send className="w-24 h-24 text-foreground" />
                 </div>
                 
                 <span className="inline-block w-10 h-10 rounded-full bg-[#24A1DE]/10 text-[#24A1DE] mb-5 flex items-center justify-center">
                    <Send className="w-5 h-5 -ml-0.5 mt-0.5" />
                 </span>
                 
                 <h3 className="font-bold text-xl mb-3 text-foreground tracking-tight">
                    Мы в Telegram
                 </h3>
                 
                 <p className="text-sm text-muted-foreground mb-6 leading-relaxed relative z-10">
                   Оперативно, честно и без цензуры. Читайте главные новости города в удобном формате мессенджера.
                 </p>
                 
                 <Button className="w-full bg-[#24A1DE] hover:bg-[#24A1DE]/90 text-white font-bold rounded-md h-11 text-xs uppercase tracking-widest shadow-lg shadow-[#24A1DE]/20 transition-all" asChild>
                    <a href={settings.telegramUrl} target="_blank" rel="noopener noreferrer">
                       {settings.telegramButtonText}
                    </a>
                 </Button>
              </div>

           </aside>
        </div>
      </div>
    </>
  )
}
