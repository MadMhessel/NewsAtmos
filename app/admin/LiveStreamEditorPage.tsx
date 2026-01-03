import React, { useEffect, useMemo, useState } from "react";
import Link from "@/lib/next-shim";
import { useNavigate, useParams } from "react-router-dom";
import { liveService } from "@/lib/liveService";
import { newsService } from "@/lib/newsService";
import { LiveStream, LiveStreamStatus, LiveUpdate, LiveUpdateType } from "@/lib/types";
import { CATEGORIES } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDateShort } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Pin,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

const STATUS_OPTIONS: { value: LiveStreamStatus; label: string }[] = [
  { value: 'draft', label: 'Черновик' },
  { value: 'published', label: 'Опубликовано' },
  { value: 'finished', label: 'Завершено' },
];

const UPDATE_TYPES: { value: LiveUpdateType; label: string }[] = [
  { value: 'update', label: 'Обновление' },
  { value: 'milestone', label: 'Веха' },
];

const slugify = (value: string) => {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9а-яё-]/gi, '')
    .replace(/-+/g, '-');
};

const toLocalInputValue = (iso?: string) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const fromLocalInputValue = (value: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
};

const isValidUrl = (value: string) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export default function LiveStreamEditorPage() {
  const navigate = useNavigate();
  const params = useParams();
  const id = params.id as string | undefined;

  const [stream, setStream] = useState<LiveStream | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSlugTouched, setIsSlugTouched] = useState(false);
  const [updates, setUpdates] = useState<LiveUpdate[]>([]);

  const [updateDraft, setUpdateDraft] = useState({
    eventTime: toLocalInputValue(new Date().toISOString()),
    text: '',
    type: 'update' as LiveUpdateType,
    sourceName: '',
    sourceUrl: '',
    mediaUrl: '',
  });
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const canManageUpdates = Boolean(stream?.id);

  useEffect(() => {
    if (!id) {
      const now = new Date().toISOString();
      setStream({
        id: '',
        slug: '',
        title: '',
        lead: '',
        body: '',
        coverImage: '',
        category: CATEGORIES[0],
        tags: [],
        status: 'draft',
        pinned: false,
        pinnedOrder: 0,
        createdAt: now,
        updatedAt: now,
      });
      return;
    }
    const existing = liveService.getById(id);
    if (!existing) {
      navigate('/admin/live');
      return;
    }
    setStream(existing);
    setUpdates(liveService.getUpdatesByStreamId(existing.id, 'desc'));
  }, [id, navigate]);

  useEffect(() => {
    if (!stream) return;
    setUpdates(liveService.getUpdatesByStreamId(stream.id, 'desc'));
    setStream(liveService.getById(stream.id) || stream);
  }, [stream?.id]);

  useEffect(() => {
    if (!stream || isSlugTouched) return;
    setStream(prev => (prev ? { ...prev, slug: slugify(prev.title) } : prev));
  }, [stream?.title, isSlugTouched]);

  const tagsValue = useMemo(() => (stream?.tags || []).join(', '), [stream?.tags]);

  const handleStreamChange = (patch: Partial<LiveStream>) => {
    setStream(prev => (prev ? { ...prev, ...patch } : prev));
  };

  const handleSave = async () => {
    if (!stream) return;
    if (!stream.title.trim() || !stream.slug.trim()) {
      alert('Заполните заголовок и слаг.');
      return;
    }
    setIsSaving(true);
    const now = new Date().toISOString();
    if (!stream.id) {
      const created = await liveService.createStream({
        ...stream,
        createdAt: now,
        updatedAt: now,
      });
      setStream(created);
      navigate(`/admin/live/${created.id}`, { replace: true });
    } else {
      await liveService.updateStream(stream.id, { ...stream, updatedAt: now });
      setStream(liveService.getById(stream.id) || stream);
    }
    setIsSaving(false);
  };

  const handleCoverUpload = async (file: File) => {
    if (!stream) return;
    setIsUploadingMedia(true);
    try {
      const url = await newsService.uploadImage(file);
      handleStreamChange({ coverImage: url });
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleSubmitUpdate = async () => {
    if (!stream) return;
    if (!stream.id) {
      alert('Сначала сохраните контейнер.');
      return;
    }
    if (!updateDraft.text.trim()) {
      alert('Введите текст обновления.');
      return;
    }
    if (!isValidUrl(updateDraft.sourceUrl)) {
      alert('Ссылка на источник должна начинаться с http/https.');
      return;
    }
    const eventTime = fromLocalInputValue(updateDraft.eventTime) || new Date().toISOString();

    if (editingUpdateId) {
      await liveService.updateUpdate(editingUpdateId, {
        eventTime,
        text: updateDraft.text.trim(),
        type: updateDraft.type,
        sourceName: updateDraft.sourceName.trim(),
        sourceUrl: updateDraft.sourceUrl.trim(),
        mediaUrl: updateDraft.mediaUrl.trim(),
      });
    } else {
      await liveService.addUpdate(stream.id, {
        eventTime,
        text: updateDraft.text.trim(),
        type: updateDraft.type,
        sourceName: updateDraft.sourceName.trim(),
        sourceUrl: updateDraft.sourceUrl.trim(),
        mediaUrl: updateDraft.mediaUrl.trim(),
      });
    }

    setUpdates(liveService.getUpdatesByStreamId(stream.id, 'desc'));
    setStream(liveService.getById(stream.id) || stream);
    setUpdateDraft({
      eventTime: toLocalInputValue(new Date().toISOString()),
      text: '',
      type: 'update',
      sourceName: '',
      sourceUrl: '',
      mediaUrl: '',
    });
    setEditingUpdateId(null);
  };

  const handleEditUpdate = (update: LiveUpdate) => {
    setEditingUpdateId(update.id);
    setUpdateDraft({
      eventTime: toLocalInputValue(update.eventTime),
      text: update.text,
      type: update.type,
      sourceName: update.sourceName || '',
      sourceUrl: update.sourceUrl || '',
      mediaUrl: update.mediaUrl || '',
    });
  };

  const handleCancelEdit = () => {
    setEditingUpdateId(null);
    setUpdateDraft({
      eventTime: toLocalInputValue(new Date().toISOString()),
      text: '',
      type: 'update',
      sourceName: '',
      sourceUrl: '',
      mediaUrl: '',
    });
  };

  const handleDeleteUpdate = async (update: LiveUpdate) => {
    if (!stream) return;
    if (!window.confirm('Удалить обновление?')) return;
    await liveService.deleteUpdate(update.id);
    setUpdates(liveService.getUpdatesByStreamId(stream.id, 'desc'));
    setStream(liveService.getById(stream.id) || stream);
  };

  const handleMoveUpdate = async (update: LiveUpdate, direction: 'up' | 'down') => {
    if (!stream) return;
    await liveService.moveUpdate(stream.id, update.id, direction);
    setUpdates(liveService.getUpdatesByStreamId(stream.id, 'desc'));
    setStream(liveService.getById(stream.id) || stream);
  };

  const handleUpdateMediaUpload = async (file: File) => {
    setIsUploadingMedia(true);
    try {
      const url = await newsService.uploadImage(file);
      setUpdateDraft(prev => ({ ...prev, mediaUrl: url }));
    } finally {
      setIsUploadingMedia(false);
    }
  };

  if (!stream) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/live')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Онлайн-материал</h1>
            <p className="text-sm text-muted-foreground">
              {stream.id ? `Обновлено ${formatDateShort(stream.updatedAt)}` : 'Новый контейнер'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" asChild disabled={!stream.slug}>
            <Link href={stream.slug ? `/live/${stream.slug}` : '#'} className={cn(!stream.slug && 'pointer-events-none opacity-50')}>
              <ExternalLink className="w-4 h-4 mr-2" /> Открыть страницу
            </Link>
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Сохранить
          </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Заголовок</label>
              <Input value={stream.title} onChange={(e) => handleStreamChange({ title: e.target.value })} className="mt-2" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Слаг (URL)</label>
              <Input
                value={stream.slug}
                onChange={(e) => {
                  setIsSlugTouched(true);
                  handleStreamChange({ slug: slugify(e.target.value) });
                }}
                className="mt-2"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Лид</label>
              <textarea
                value={stream.lead}
                onChange={(e) => handleStreamChange({ lead: e.target.value })}
                className="mt-2 w-full min-h-[90px] rounded-md border border-border bg-background p-3 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Описание (опционально)</label>
              <textarea
                value={stream.body || ''}
                onChange={(e) => handleStreamChange({ body: e.target.value })}
                className="mt-2 w-full min-h-[120px] rounded-md border border-border bg-background p-3 text-sm"
              />
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Лента обновлений</h3>
              <span className="text-xs text-muted-foreground">{updates.length} пунктов</span>
            </div>

            <div className={cn("space-y-4 rounded-lg border border-border p-4", !canManageUpdates && "opacity-60")}>
              {!canManageUpdates && (
                <div className="text-xs text-muted-foreground">
                  Сохраните контейнер, чтобы добавлять обновления.
                </div>
              )}
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Время события</label>
                  <div className="mt-2 flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-muted-foreground" />
                    <Input
                      type="datetime-local"
                      value={updateDraft.eventTime}
                      onChange={(e) => setUpdateDraft(prev => ({ ...prev, eventTime: e.target.value }))}
                      disabled={!canManageUpdates}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Тип</label>
                  <select
                    value={updateDraft.type}
                    onChange={(e) => setUpdateDraft(prev => ({ ...prev, type: e.target.value as LiveUpdateType }))}
                    className="mt-2 border border-border rounded-md bg-background px-3 py-2 text-sm"
                    disabled={!canManageUpdates}
                  >
                    {UPDATE_TYPES.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Текст</label>
                <textarea
                  value={updateDraft.text}
                  onChange={(e) => setUpdateDraft(prev => ({ ...prev, text: e.target.value }))}
                  className="mt-2 w-full min-h-[100px] rounded-md border border-border bg-background p-3 text-sm"
                  disabled={!canManageUpdates}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Источник (название)</label>
                  <Input
                    value={updateDraft.sourceName}
                    onChange={(e) => setUpdateDraft(prev => ({ ...prev, sourceName: e.target.value }))}
                    className="mt-2"
                    disabled={!canManageUpdates}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Источник (URL)</label>
                  <Input
                    value={updateDraft.sourceUrl}
                    onChange={(e) => setUpdateDraft(prev => ({ ...prev, sourceUrl: e.target.value }))}
                    className={cn("mt-2", updateDraft.sourceUrl && !isValidUrl(updateDraft.sourceUrl) && "border-destructive")}
                    placeholder="https://"
                    disabled={!canManageUpdates}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">URL должен начинаться с http/https.</p>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Медиа (URL)</label>
                <div className="mt-2 flex flex-wrap gap-3 items-center">
                  <Input
                    value={updateDraft.mediaUrl}
                    onChange={(e) => setUpdateDraft(prev => ({ ...prev, mediaUrl: e.target.value }))}
                    placeholder="https://"
                    className="flex-1"
                    disabled={!canManageUpdates}
                  />
                  <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <ImageIcon className="w-4 h-4" />
                    {isUploadingMedia ? 'Загрузка...' : 'Загрузить'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpdateMediaUpload(file);
                      }}
                      disabled={isUploadingMedia || !canManageUpdates}
                    />
                  </label>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={handleSubmitUpdate} disabled={isUploadingMedia || !canManageUpdates}>
                  {editingUpdateId ? <Pencil className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  {editingUpdateId ? 'Сохранить изменения' : 'Опубликовать'}
                </Button>
                {editingUpdateId && (
                  <Button variant="ghost" onClick={handleCancelEdit}>
                    <X className="w-4 h-4 mr-2" /> Отмена
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {updates.map((update, index) => (
                <div
                  key={update.id}
                  className={cn(
                    "rounded-lg border border-border p-4 bg-background",
                    update.type === 'milestone' && "border-accent/40 bg-accent/5"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-widest text-accent">
                        {new Date(update.eventTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-line mt-2">{update.text}</p>
                      {(update.sourceName || update.sourceUrl) && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Источник: {update.sourceName || update.sourceUrl}
                        </p>
                      )}
                      {update.mediaUrl && (
                        <img src={update.mediaUrl} alt="" className="mt-3 max-h-48 rounded-md border border-border object-cover" />
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
                        {update.type === 'milestone' ? 'Веха' : 'Обновление'}
                      </span>
                      <Button variant="ghost" size="icon" onClick={() => handleMoveUpdate(update, 'up')} disabled={index === 0}>
                        <ArrowUp className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleMoveUpdate(update, 'down')} disabled={index === updates.length - 1}>
                        <ArrowDown className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEditUpdate(update)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteUpdate(update)} className="text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {updates.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-6">
                  Пока нет обновлений. Добавьте первый пункт выше.
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Рубрика</label>
              <select
                value={stream.category?.slug || CATEGORIES[0].slug}
                onChange={(e) => {
                  const next = CATEGORIES.find(item => item.slug === e.target.value) || CATEGORIES[0];
                  handleStreamChange({ category: next });
                }}
                className="mt-2 w-full border border-border rounded-md bg-background px-3 py-2 text-sm"
              >
                {CATEGORIES.map((category) => (
                  <option key={category.slug} value={category.slug}>{category.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Теги (через запятую)</label>
              <Input
                value={tagsValue}
                onChange={(e) =>
                  handleStreamChange({
                    tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean),
                  })
                }
                className="mt-2"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Статус</label>
              <select
                value={stream.status}
                onChange={(e) => handleStreamChange({ status: e.target.value as LiveStreamStatus })}
                className="mt-2 w-full border border-border rounded-md bg-background px-3 py-2 text-sm"
              >
                {STATUS_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Закреп</span>
              <Button
                type="button"
                variant={stream.pinned ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleStreamChange({ pinned: !stream.pinned })}
              >
                <Pin className="w-4 h-4 mr-2" />
                {stream.pinned ? 'Закреплено' : 'Не закреплено'}
              </Button>
            </div>
            {stream.pinned && (
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Порядок закрепа</label>
                <Input
                  type="number"
                  min={1}
                  value={stream.pinnedOrder || 1}
                  onChange={(e) => handleStreamChange({ pinnedOrder: Number(e.target.value) })}
                  className="mt-2"
                />
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <ImageIcon className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Обложка</h3>
            </div>
            {stream.coverImage && (
              <img src={stream.coverImage} alt="Обложка" className="w-full h-48 object-cover rounded-lg border border-border" />
            )}
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <ImageIcon className="w-4 h-4" />
                {isUploadingMedia ? 'Загрузка...' : 'Загрузить'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCoverUpload(file);
                  }}
                  disabled={isUploadingMedia}
                />
              </label>
              {stream.coverImage && (
                <Button variant="ghost" size="icon" onClick={() => handleStreamChange({ coverImage: '' })}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
