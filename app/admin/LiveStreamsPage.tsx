import React, { useEffect, useMemo, useState } from "react";
import Link from "@/lib/next-shim";
import { liveService } from "@/lib/liveService";
import { LiveStream, LiveStreamStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateShort } from "@/lib/utils";
import { ArrowDown, ArrowUp, Eye, Pencil, Pin, Plus, Search, Trash2, X } from "lucide-react";

const STATUS_TABS: { value: LiveStreamStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'draft', label: 'Черновики' },
  { value: 'published', label: 'Опубликовано' },
  { value: 'finished', label: 'Завершено' },
];

const statusLabel = (status?: LiveStreamStatus) => {
  switch (status) {
    case 'draft':
      return 'Черновик';
    case 'finished':
      return 'Завершено';
    case 'published':
    default:
      return 'Опубликовано';
  }
};

export default function LiveStreamsPage() {
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LiveStreamStatus | 'all'>('all');
  const [pinnedFilter, setPinnedFilter] = useState<'all' | 'pinned' | 'not_pinned'>('all');
  const [dateFilter, setDateFilter] = useState('');

  const loadStreams = () => {
    setStreams(liveService.getAllAdmin());
  };

  useEffect(() => {
    loadStreams();
  }, []);

  const handleTogglePinned = async (stream: LiveStream) => {
    if (stream.pinned) {
      await liveService.togglePinned(stream.id, false);
    } else {
      const maxOrder = Math.max(0, ...streams.map(item => item.pinnedOrder || 0));
      await liveService.togglePinned(stream.id, true, maxOrder + 1);
    }
    loadStreams();
  };

  const handleMovePinned = async (stream: LiveStream, direction: 'up' | 'down') => {
    const pinned = streams.filter(item => item.pinned).sort((a, b) => (a.pinnedOrder || 0) - (b.pinnedOrder || 0));
    const index = pinned.findIndex(item => item.id === stream.id);
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || swapIndex < 0 || swapIndex >= pinned.length) return;
    const current = pinned[index];
    const target = pinned[swapIndex];
    await liveService.updateStream(current.id, { pinnedOrder: target.pinnedOrder });
    await liveService.updateStream(target.id, { pinnedOrder: current.pinnedOrder });
    loadStreams();
  };

  const handleStatusChange = async (stream: LiveStream, status: LiveStreamStatus) => {
    await liveService.updateStatus(stream.id, status);
    loadStreams();
  };

  const handleDelete = async (stream: LiveStream) => {
    if (window.confirm('Удалить онлайн-материал и все обновления?')) {
      await liveService.deleteStream(stream.id);
      loadStreams();
    }
  };

  const filteredStreams = useMemo(() => {
    return streams.filter(stream => {
      const matchesSearch = stream.title.toLowerCase().includes(search.toLowerCase());
      const status = stream.status || 'draft';
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      const matchesPinned =
        pinnedFilter === 'all' ||
        (pinnedFilter === 'pinned' && stream.pinned) ||
        (pinnedFilter === 'not_pinned' && !stream.pinned);
      const matchesDate = dateFilter
        ? new Date(stream.createdAt).toISOString().slice(0, 10) === dateFilter
        : true;
      return matchesSearch && matchesStatus && matchesPinned && matchesDate;
    });
  }, [streams, search, statusFilter, pinnedFilter, dateFilter]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Онлайн-новости</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Контейнеры с лентой обновлений</p>
        </div>
        <Button asChild>
          <Link href="/admin/live/create"><Plus className="w-4 h-4 mr-2" /> Создать онлайн</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map(tab => (
          <Button
            key={tab.value}
            variant={statusFilter === tab.value ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setStatusFilter(tab.value)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex flex-wrap items-center gap-4 bg-secondary/10">
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по заголовкам..."
              className="pl-9 bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <label>Закреп:</label>
            <select
              value={pinnedFilter}
              onChange={(e) => setPinnedFilter(e.target.value as typeof pinnedFilter)}
              className="border border-border rounded-md bg-background px-2 py-1 text-sm"
            >
              <option value="all">Все</option>
              <option value="pinned">Только закреплённые</option>
              <option value="not_pinned">Без закрепа</option>
            </select>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <label>Дата:</label>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-[160px]"
            />
            {dateFilter && (
              <Button variant="ghost" size="icon" onClick={() => setDateFilter('')}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          <div className="ml-auto text-sm text-muted-foreground">
            Всего: {filteredStreams.length}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="p-4 font-medium text-muted-foreground">Заголовок</th>
                <th className="p-4 font-medium text-muted-foreground w-40">Статус</th>
                <th className="p-4 font-medium text-muted-foreground w-40">Обновлено</th>
                <th className="p-4 font-medium text-muted-foreground w-32">Закреп</th>
                <th className="p-4 font-medium text-muted-foreground w-48 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredStreams.map((stream) => (
                <tr key={stream.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="p-4">
                    <div className="font-medium text-foreground line-clamp-1">{stream.title}</div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{stream.lead}</div>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-foreground">
                      {statusLabel(stream.status)}
                    </span>
                  </td>
                  <td className="p-4 text-muted-foreground whitespace-nowrap">
                    {formatDateShort(stream.updatedAt)}
                  </td>
                  <td className="p-4 text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant={stream.pinned ? 'default' : 'ghost'}
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleTogglePinned(stream)}
                      >
                        <Pin className="w-4 h-4" />
                      </Button>
                      {stream.pinned && (
                        <div className="flex items-center gap-1 text-xs">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleMovePinned(stream, 'up')}
                          >
                            <ArrowUp className="w-3 h-3" />
                          </Button>
                          <span>{stream.pinnedOrder || 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleMovePinned(stream, 'down')}
                          >
                            <ArrowDown className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-muted-foreground hover:text-primary">
                        <Link href={`/live/${stream.slug}`}>
                          <Eye className="w-4 h-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-muted-foreground hover:text-primary">
                        <Link href={`/admin/live/${stream.id}`}>
                          <Pencil className="w-4 h-4" />
                        </Link>
                      </Button>
                      {stream.status !== 'published' ? (
                        <Button variant="outline" size="sm" onClick={() => handleStatusChange(stream, 'published')}>
                          Опубликовать
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => handleStatusChange(stream, 'draft')}>
                          Снять
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => handleStatusChange(stream, 'finished')}>
                        Завершить
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(stream)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredStreams.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    Онлайн-материалы не найдены.
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
