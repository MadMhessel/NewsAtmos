import React, { useEffect, useMemo, useState } from "react";
import { liveService } from "@/lib/liveService";
import { LiveStream, LiveUpdate } from "@/lib/types";
import { formatDate, formatDateShort } from "@/lib/utils";
import { Image } from "@/lib/next-shim";
import Link from "@/lib/next-shim";
import { notFound, useParams } from "@/lib/next-shim";
import { ArrowDownUp, Clock, Radio, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 25000;
const INITIAL_LOAD_LIMIT = 200;
const LOAD_MORE_STEP = 50;

const mergeUpdates = (existing: LiveUpdate[], incoming: LiveUpdate[]) => {
  const map = new Map(existing.map(update => [update.id, update]));
  incoming.forEach(update => {
    map.set(update.id, update);
  });
  return Array.from(map.values());
};

const sortUpdates = (updates: LiveUpdate[], direction: 'asc' | 'desc') => {
  return [...updates].sort((a, b) => {
    const diff = new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime();
    if (diff !== 0) return direction === 'asc' ? diff : -diff;
    return direction === 'asc' ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
  });
};

export default function LiveStreamPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [stream, setStream] = useState<LiveStream | null>(null);

  const [order, setOrder] = useState<'desc' | 'asc'>('desc');
  const [updates, setUpdates] = useState<LiveUpdate[]>([]);
  const [pendingUpdates, setPendingUpdates] = useState<LiveUpdate[]>([]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_LOAD_LIMIT);

  useEffect(() => {
    setStream(liveService.getBySlug(slug) || null);
  }, [slug]);

  useEffect(() => {
    if (!stream) return;
    const initialUpdates = liveService.getUpdatesByStreamId(stream.id, 'desc');
    setUpdates(initialUpdates);
  }, [stream?.id]);

  useEffect(() => {
    if (!stream) return;
    const interval = window.setInterval(async () => {
      const latest = [...updates, ...pendingUpdates].reduce((max, update) => {
        const ts = new Date(update.createdAt).getTime();
        return ts > max ? ts : max;
      }, 0);
      const incoming = await liveService.fetchUpdatesAfter(stream.id, latest);
      if (!incoming.length) return;

      const isNearTop = window.scrollY < 200;
      const isNearBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 200;

      const mergedIncoming = mergeUpdates([], incoming);
      if ((order === 'desc' && isNearTop) || (order === 'asc' && isNearBottom)) {
        setUpdates(prev => mergeUpdates(prev, mergedIncoming));
      } else {
        setPendingUpdates(prev => mergeUpdates(prev, mergedIncoming));
      }
      setStream(liveService.getById(stream.id) || stream);
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [stream?.id, updates, pendingUpdates, order]);

  const milestones = useMemo(() => {
    return updates.filter(update => update.type === 'milestone');
  }, [updates]);

  const sortedUpdates = useMemo(() => sortUpdates(updates, order), [updates, order]);
  const visibleUpdates = sortedUpdates.slice(0, visibleCount);
  const hasMore = sortedUpdates.length > visibleCount;

  const isPublic = stream.status === 'published' || stream.status === 'finished';

  if (!stream || !isPublic) {
    return notFound();
  }

  const handleShowPending = () => {
    setUpdates(prev => mergeUpdates(prev, pendingUpdates));
    setPendingUpdates([]);
    if (stream) {
      setStream(liveService.getById(stream.id) || stream);
    }
  };

  const handleToggleOrder = () => {
    setOrder(prev => (prev === 'desc' ? 'asc' : 'desc'));
  };

  return (
    <div className="pb-16 bg-background">
      <div className="border-b border-border py-4 mb-8">
        <div className="container flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground overflow-hidden whitespace-nowrap">
          <Link href="/" className="hover:text-accent transition-colors">Главная</Link>
          <span className="text-foreground opacity-50">/</span>
          <span className="text-foreground truncate opacity-80">{stream.title}</span>
        </div>
      </div>

      <article className="container">
        <header className="mx-auto max-w-[900px] text-center md:text-left mb-12">
          <div className="flex flex-wrap items-center gap-4 mb-6 justify-center md:justify-start">
            {stream.category && (
              <Link
                href={`/category/${stream.category.slug}`}
                className="text-accent font-bold uppercase tracking-[0.15em] text-[10px] hover:underline underline-offset-4"
              >
                {stream.category.title}
              </Link>
            )}
            <span className="inline-flex items-center gap-2 bg-destructive/10 text-destructive px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest rounded-sm border border-destructive/20">
              <Radio className="w-3 h-3" /> Онлайн
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.05] mb-6 text-foreground">
            {stream.title}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8 font-medium">
            {stream.lead}
          </p>

          <div className="flex flex-wrap items-center justify-center md:justify-between gap-4 border-y border-border py-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4" />
              <span>Опубликовано: {formatDate(stream.createdAt)}</span>
            </div>
            <div className="text-accent font-semibold text-xs uppercase tracking-wider">
              Обновлено: {formatDateShort(stream.updatedAt)}
            </div>
          </div>
        </header>

        {stream.coverImage && (
          <div className="relative aspect-[16/9] w-full max-w-[1000px] mx-auto mb-12 overflow-hidden rounded-lg bg-gray-100 dark:bg-muted">
            <Image
              src={stream.coverImage}
              alt={stream.title}
              fill
              className="object-cover"
            />
          </div>
        )}

        {stream.body && (
          <div className="mx-auto max-w-[760px] text-base text-foreground leading-relaxed mb-12">
            <p className="whitespace-pre-line">{stream.body}</p>
          </div>
        )}

        <div className="mx-auto max-w-[980px] grid gap-10 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-6 lg:sticky lg:top-24 h-fit">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Оглавление</h3>
              <Button variant="ghost" size="sm" onClick={handleToggleOrder} className="h-8 gap-2">
                <ArrowDownUp className="w-4 h-4" />
                {order === 'desc' ? 'Сначала новые' : 'Сначала старые'}
              </Button>
            </div>
            <div className="space-y-3 text-sm">
              {milestones.length === 0 && (
                <p className="text-muted-foreground text-sm">Вехи появятся по мере обновлений.</p>
              )}
              {milestones.map((item) => (
                <a
                  key={item.id}
                  href={`#update-${item.id}`}
                  className="block text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="text-accent font-semibold mr-2">
                    {new Date(item.eventTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {item.text}
                </a>
              ))}
            </div>
          </aside>

          <section className="space-y-6">
            {pendingUpdates.length > 0 && (
              <button
                type="button"
                onClick={handleShowPending}
                className="w-full rounded-lg border border-accent/30 bg-accent/10 text-accent font-semibold text-sm py-3 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Появились новые обновления ({pendingUpdates.length})
              </button>
            )}

            {visibleUpdates.map((update) => (
              <article
                key={update.id}
                id={`update-${update.id}`}
                className={cn(
                  "rounded-xl border border-border bg-card p-5 md:p-6 shadow-sm",
                  update.type === 'milestone' && "border-accent/40 bg-accent/5"
                )}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-bold text-accent uppercase tracking-widest">
                    {new Date(update.eventTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {update.type === 'milestone' && (
                    <span className="text-[10px] uppercase tracking-widest font-semibold text-accent border border-accent/40 px-2 py-0.5 rounded-full">
                      Веха
                    </span>
                  )}
                </div>
                <p className="text-base text-foreground leading-relaxed whitespace-pre-line">
                  {update.text}
                </p>
                {(update.sourceName || update.sourceUrl) && (
                  <div className="mt-4 text-xs text-muted-foreground">
                    Источник:{' '}
                    {update.sourceUrl ? (
                      <a href={update.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
                        {update.sourceName || update.sourceUrl}
                      </a>
                    ) : (
                      update.sourceName
                    )}
                  </div>
                )}
                {update.mediaUrl && (
                  <div className="mt-4">
                    <img
                      src={update.mediaUrl}
                      alt=""
                      className="w-full max-h-96 object-cover rounded-lg border border-border"
                    />
                  </div>
                )}
              </article>
            ))}

            {hasMore && (
              <Button variant="outline" className="w-full" onClick={() => setVisibleCount(prev => prev + LOAD_MORE_STEP)}>
                Показать ещё
              </Button>
            )}
          </section>
        </div>
      </article>
    </div>
  );
}
