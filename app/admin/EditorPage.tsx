import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { newsService } from '@/lib/newsService';
import { Article, ArticleStatus, ContentBlock } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    ArrowLeft,
    Plus,
    Trash2,
    GripVertical,
    Image as ImageIcon,
    Type,
    Quote,
    List,
    X,
    ChevronDown,
    Eye,
    Loader2,
    ArrowUp,
    ArrowDown,
    Copy,
    Minimize2,
    Maximize2
} from 'lucide-react';
import Link from '@/lib/next-shim';
import { cn, slugify } from '@/lib/utils';
import { ArticleContent } from '@/components/news/ArticleContent';
import { ArticleCard } from '@/components/news/ArticleCard';

const STATUS_OPTIONS: { value: ArticleStatus; label: string }[] = [
    { value: 'draft', label: 'Черновик' },
    { value: 'review', label: 'На проверке' },
    { value: 'scheduled', label: 'Запланировано' },
    { value: 'published', label: 'Опубликовано' },
    { value: 'archived', label: 'Архив' },
    { value: 'trash', label: 'Корзина' },
];

const AUTOSAVE_INTERVAL_MS = 15000;
const MAX_AUTOSAVE_IMAGE_WIDTH = 1920;

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

const getAutosaveKey = (id?: string) => `editor_autosave_${id || 'new'}`;
const getVersionsKey = (id: string) => `versions_${id}`;

const AutoResizeTextarea = ({ 
    value, 
    onChange, 
    className, 
    placeholder,
    autoFocus
}: { 
    value: string; 
    onChange: (val: string) => void; 
    className?: string; 
    placeholder?: string;
    autoFocus?: boolean;
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    };

    useLayoutEffect(() => {
        adjustHeight();
    }, [value]);

    return (
        <textarea
            ref={textareaRef}
            className={cn("w-full resize-none bg-transparent outline-none overflow-hidden", className)}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onInput={adjustHeight}
            placeholder={placeholder}
            rows={1}
            autoFocus={autoFocus}
        />
    );
};

interface BlockWrapperProps {
    children?: React.ReactNode;
    onDelete: () => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    onDuplicate?: () => void;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
    previewText?: string;
}

const BlockWrapper: React.FC<BlockWrapperProps> = ({ 
    children, 
    onDelete, 
    onMoveUp, 
    onMoveDown,
    onDuplicate,
    isCollapsed,
    onToggleCollapse,
    previewText
}) => {
    return (
        <div
            className={cn(
                "group relative py-1",
                "sm:-ml-12 sm:pl-12"
            )}
        >
            <div className="hidden sm:flex absolute left-0 top-1.5 opacity-0 group-hover:opacity-100 transition-opacity items-center gap-1 pr-2">
                 <button className="p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-4 h-4" />
                 </button>
                 <button onClick={onMoveUp} className="p-1 text-muted-foreground hover:text-foreground transition-colors" disabled={!onMoveUp}>
                    <ArrowUp className="w-4 h-4" />
                 </button>
                 <button onClick={onMoveDown} className="p-1 text-muted-foreground hover:text-foreground transition-colors" disabled={!onMoveDown}>
                    <ArrowDown className="w-4 h-4" />
                 </button>
                 <button onClick={onDuplicate} className="p-1 text-muted-foreground hover:text-foreground transition-colors" disabled={!onDuplicate}>
                    <Copy className="w-4 h-4" />
                 </button>
                 <button onClick={onToggleCollapse} className="p-1 text-muted-foreground hover:text-foreground transition-colors" disabled={!onToggleCollapse}>
                    {isCollapsed ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                 </button>
                 <button onClick={onDelete} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                 </button>
            </div>

            <div className="sm:hidden flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                <button onClick={onMoveUp} disabled={!onMoveUp} className="p-1 rounded-md border border-border">
                    <ArrowUp className="w-3 h-3" />
                </button>
                <button onClick={onMoveDown} disabled={!onMoveDown} className="p-1 rounded-md border border-border">
                    <ArrowDown className="w-3 h-3" />
                </button>
                <button onClick={onDuplicate} disabled={!onDuplicate} className="p-1 rounded-md border border-border">
                    <Copy className="w-3 h-3" />
                </button>
                <button onClick={onToggleCollapse} disabled={!onToggleCollapse} className="p-1 rounded-md border border-border">
                    {isCollapsed ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
                </button>
                <button onClick={onDelete} className="p-1 rounded-md border border-destructive text-destructive">
                    <Trash2 className="w-3 h-3" />
                </button>
            </div>

            {isCollapsed ? (
                <div className="rounded-md border border-dashed border-border/70 bg-secondary/20 px-4 py-3 text-sm text-muted-foreground">
                    {previewText || 'Блок свернут'}
                </div>
            ) : (
                children
            )}
        </div>
    );
};

interface ContentBlockRendererProps {
    block: ContentBlock;
    onChange: (b: ContentBlock) => void;
    onDelete: () => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    onDuplicate?: () => void;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
}

const ContentBlockRenderer: React.FC<ContentBlockRendererProps> = ({ 
    block, 
    onChange, 
    onDelete,
    onMoveUp,
    onMoveDown,
    onDuplicate,
    isCollapsed,
    onToggleCollapse
}) => {
    const previewText = block.type === 'list'
        ? `Список: ${block.items.filter(Boolean).slice(0, 2).join('; ')}`
        : block.type === 'divider'
        ? 'Разделитель'
        : block.type === 'callout'
        ? `Справка: ${block.value.slice(0, 60)}`
        : block.value?.slice(0, 60);

    switch (block.type) {
        case 'heading':
            return (
                <BlockWrapper
                    onDelete={onDelete}
                    onMoveUp={onMoveUp}
                    onMoveDown={onMoveDown}
                    onDuplicate={onDuplicate}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={onToggleCollapse}
                    previewText={previewText}
                >
                    <input
                        className="w-full bg-transparent text-xl sm:text-2xl font-bold placeholder:text-muted-foreground/40 outline-none"
                        value={block.value}
                        onChange={(e) => onChange({ ...block, value: e.target.value })}
                        placeholder="Подзаголовок"
                    />
                </BlockWrapper>
            );
        case 'quote':
            return (
                <BlockWrapper
                    onDelete={onDelete}
                    onMoveUp={onMoveUp}
                    onMoveDown={onMoveDown}
                    onDuplicate={onDuplicate}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={onToggleCollapse}
                    previewText={previewText}
                >
                    <div className="pl-4 border-l-4 border-accent my-4">
                        <AutoResizeTextarea
                            className="text-lg sm:text-xl italic font-serif text-foreground/90 placeholder:text-muted-foreground/50"
                            value={block.value}
                            onChange={(val) => onChange({ ...block, value: val })}
                            placeholder="Цитата..."
                        />
                        <input
                            className="mt-2 text-sm text-muted-foreground bg-transparent outline-none w-full"
                            value={block.author || ''}
                            onChange={(e) => onChange({ ...block, author: e.target.value })}
                            placeholder="Автор цитаты (необязательно)"
                        />
                    </div>
                </BlockWrapper>
            );
        case 'list':
            return (
                <BlockWrapper
                    onDelete={onDelete}
                    onMoveUp={onMoveUp}
                    onMoveDown={onMoveDown}
                    onDuplicate={onDuplicate}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={onToggleCollapse}
                    previewText={previewText}
                >
                    <div className="space-y-2 my-2">
                        {block.items.map((item, idx) => (
                            <div key={idx} className="flex gap-3 items-start">
                                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-foreground/40 shrink-0" />
                                <AutoResizeTextarea
                                    className="text-base sm:text-lg leading-relaxed text-foreground/90 placeholder:text-muted-foreground/40"
                                    value={item}
                                    onChange={(val) => {
                                        const newItems = [...block.items];
                                        newItems[idx] = val;
                                        onChange({ ...block, items: newItems });
                                    }}
                                    placeholder="Элемент списка"
                                />
                                <button 
                                    onClick={() => {
                                        const newItems = block.items.filter((_, i) => i !== idx);
                                        if (newItems.length === 0) onDelete();
                                        else onChange({ ...block, items: newItems });
                                    }}
                                    className="mt-1 opacity-0 group-hover:opacity-20 hover:!opacity-100 transition-opacity hidden sm:inline-flex"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        <button 
                            onClick={() => onChange({ ...block, items: [...block.items, ''] })}
                            className="text-sm text-muted-foreground hover:text-accent pl-5 flex items-center gap-1"
                        >
                            <Plus className="w-3 h-3" /> Добавить пункт
                        </button>
                    </div>
                </BlockWrapper>
            );
        case 'callout':
            return (
                <BlockWrapper
                    onDelete={onDelete}
                    onMoveUp={onMoveUp}
                    onMoveDown={onMoveDown}
                    onDuplicate={onDuplicate}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={onToggleCollapse}
                    previewText={previewText}
                >
                    <div className="rounded-xl border border-border/60 bg-secondary/10 p-4 space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Тип</label>
                            <select
                                className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                                value={block.kind}
                                onChange={(e) => onChange({ ...block, kind: e.target.value as 'info' | 'warning' | 'important' })}
                            >
                                <option value="info">Инфо</option>
                                <option value="warning">Предупреждение</option>
                                <option value="important">Важно</option>
                            </select>
                            <input
                                className="flex-1 min-w-[200px] bg-transparent border-b border-border py-1 text-sm"
                                value={block.title || ''}
                                onChange={(e) => onChange({ ...block, title: e.target.value })}
                                placeholder="Заголовок (опционально)"
                            />
                        </div>
                        <AutoResizeTextarea
                            className="text-base leading-relaxed text-foreground/90 placeholder:text-muted-foreground/40"
                            value={block.value}
                            onChange={(val) => onChange({ ...block, value: val })}
                            placeholder="Текст блока..."
                        />
                    </div>
                </BlockWrapper>
            );
        case 'divider':
            return (
                <BlockWrapper
                    onDelete={onDelete}
                    onMoveUp={onMoveUp}
                    onMoveDown={onMoveDown}
                    onDuplicate={onDuplicate}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={onToggleCollapse}
                    previewText={previewText}
                >
                    <div className="py-4">
                        <hr className="border-border/60" />
                    </div>
                </BlockWrapper>
            );
        case 'paragraph':
        default:
            return (
                <BlockWrapper
                    onDelete={onDelete}
                    onMoveUp={onMoveUp}
                    onMoveDown={onMoveDown}
                    onDuplicate={onDuplicate}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={onToggleCollapse}
                    previewText={previewText}
                >
                    <AutoResizeTextarea
                        className="text-base sm:text-[1.125rem] md:text-[1.25rem] leading-[1.6] text-foreground/85 placeholder:text-muted-foreground/30 font-serif"
                        value={block.value}
                        onChange={(val) => onChange({ ...block, value: val })}
                        placeholder="Начните писать..."
                    />
                </BlockWrapper>
            );
    }
};

export default function EditorPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const categories = newsService.getCategories();
    const isEditing = !!id;

    const [title, setTitle] = useState('');
    const [slug, setSlug] = useState('');
    const [excerpt, setExcerpt] = useState('');
    const [categorySlug, setCategorySlug] = useState(categories[0].slug);
    const [authorName, setAuthorName] = useState('Редакция');
    const [heroImage, setHeroImage] = useState('');
    const [heroImageSquare, setHeroImageSquare] = useState('');
    const [heroFocal, setHeroFocal] = useState<{ x: number; y: number } | undefined>(undefined);
    const [content, setContent] = useState<ContentBlock[]>([]);
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [sourceName, setSourceName] = useState('');
    const [sourceUrl, setSourceUrl] = useState('');
    const [locationCity, setLocationCity] = useState('');
    const [locationDistrict, setLocationDistrict] = useState('');
    const [locationAddress, setLocationAddress] = useState('');
    const [isVerified, setIsVerified] = useState(false);

    const [status, setStatus] = useState<ArticleStatus>('draft');
    const [scheduledAt, setScheduledAt] = useState('');

    const [isFeatured, setIsFeatured] = useState(false);
    const [isBreaking, setIsBreaking] = useState(false);
    const [pinnedNowReading, setPinnedNowReading] = useState(false);
    const [pinnedNowReadingRank, setPinnedNowReadingRank] = useState(0);
    const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);

    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving'>('saved');
    const [lastAutosaveAt, setLastAutosaveAt] = useState<string | null>(null);
    const hasHydratedRef = useRef(false);
    const skipDirtyRef = useRef(true);

    const [collapsedBlocks, setCollapsedBlocks] = useState<Record<number, boolean>>({});

    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewMode, setPreviewMode] = useState<'card' | 'page'>('card');
    const [previewCardVariant, setPreviewCardVariant] = useState<'default' | 'compact'>('default');
    const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

    const applyDraft = (draft: Partial<Article> & { savedAt?: string }) => {
        if (draft.title !== undefined) setTitle(draft.title);
        if (draft.slug !== undefined) setSlug(draft.slug);
        if (draft.excerpt !== undefined) setExcerpt(draft.excerpt);
        if (draft.category?.slug) setCategorySlug(draft.category.slug);
        if (draft.author?.name) setAuthorName(draft.author.name);
        if (draft.heroImage !== undefined) setHeroImage(draft.heroImage || '');
        if (draft.heroImageSquare !== undefined) setHeroImageSquare(draft.heroImageSquare || '');
        if (draft.heroFocal !== undefined) setHeroFocal(draft.heroFocal);
        if (draft.content) setContent(draft.content);
        if (draft.tags) setTags(draft.tags);
        if (draft.source?.name !== undefined) setSourceName(draft.source?.name || '');
        if (draft.source?.url !== undefined) setSourceUrl(draft.source?.url || '');
        if (draft.location?.city !== undefined) setLocationCity(draft.location?.city || '');
        if (draft.location?.district !== undefined) setLocationDistrict(draft.location?.district || '');
        if (draft.location?.address !== undefined) setLocationAddress(draft.location?.address || '');
        if (typeof draft.isVerified === 'boolean') setIsVerified(draft.isVerified);
        if (draft.status) setStatus(draft.status);
        if (draft.scheduledAt) setScheduledAt(draft.scheduledAt);
        if (typeof draft.isFeatured === 'boolean') setIsFeatured(draft.isFeatured);
        if (typeof draft.isBreaking === 'boolean') setIsBreaking(draft.isBreaking);
        if (typeof draft.pinnedNowReading === 'boolean') setPinnedNowReading(draft.pinnedNowReading);
        if (typeof draft.pinnedNowReadingRank === 'number') setPinnedNowReadingRank(draft.pinnedNowReadingRank);
        if (draft.savedAt) setLastAutosaveAt(draft.savedAt);
    };

    useEffect(() => {
        const article = id ? newsService.getById(id) : undefined;
        if (article) {
            setTitle(article.title);
            setSlug(article.slug);
            setExcerpt(article.excerpt);
            setCategorySlug(article.category.slug);
            setAuthorName(article.author.name);
            setHeroImage(article.heroImage);
            setHeroImageSquare(article.heroImageSquare || '');
            setHeroFocal(article.heroFocal);
            setContent(article.content);
            setTags(article.tags || []);
            setSourceName(article.source?.name || '');
            setSourceUrl(article.source?.url || '');
            setLocationCity(article.location?.city || '');
            setLocationDistrict(article.location?.district || '');
            setLocationAddress(article.location?.address || '');
            setIsVerified(!!article.isVerified);
            setStatus(article.status || 'published');
            setScheduledAt(article.scheduledAt || '');
            setIsFeatured(article.isFeatured || false);
            setIsBreaking(article.isBreaking || false);
            setPinnedNowReading(!!article.pinnedNowReading);
            setPinnedNowReadingRank(typeof (article as any).pinnedNowReadingRank === 'number' ? (article as any).pinnedNowReadingRank : 0);
            setIsSlugManuallyEdited(true);
        } else {
            setContent([{ type: 'paragraph', value: '' }]);
            setStatus('draft');
        }

        const autosaveKey = getAutosaveKey(id);
        const rawDraft = typeof window !== 'undefined' ? localStorage.getItem(autosaveKey) : null;
        if (rawDraft) {
            try {
                const draft = JSON.parse(rawDraft);
                const shouldRestore = !article || window.confirm('Найден локальный автосейв. Восстановить?');
                if (shouldRestore) {
                    applyDraft(draft);
                }
            } catch {
                // ignore broken draft
            }
        }

        setSaveState('saved');
        hasHydratedRef.current = true;
        skipDirtyRef.current = true;
    }, [id]);

    useEffect(() => {
        if (!isSlugManuallyEdited && !isEditing) {
            setSlug(slugify(title));
        }
    }, [title, isSlugManuallyEdited, isEditing]);

    useEffect(() => {
        if (!hasHydratedRef.current || skipDirtyRef.current) {
            skipDirtyRef.current = false;
            return;
        }
        setSaveState('dirty');
    }, [
        title,
        slug,
        excerpt,
        categorySlug,
        authorName,
        heroImage,
        heroImageSquare,
        heroFocal,
        content,
        tags,
        sourceName,
        sourceUrl,
        locationCity,
        locationDistrict,
        locationAddress,
        isVerified,
        status,
        scheduledAt,
        isFeatured,
        isBreaking,
        pinnedNowReading,
        pinnedNowReadingRank
    ]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (saveState !== 'dirty') return;
            const draft = buildLocalDraft();
            try {
                localStorage.setItem(getAutosaveKey(id), JSON.stringify(draft));
                setLastAutosaveAt(draft.savedAt || null);
                setSaveState('saved');
            } catch {
                // ignore quota errors
            }
        }, AUTOSAVE_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [saveState, id, title, slug, excerpt, categorySlug, authorName, heroImage, heroImageSquare, heroFocal, content, tags, sourceName, sourceUrl, locationCity, locationDistrict, locationAddress, isVerified, status, scheduledAt, isFeatured, isBreaking, pinnedNowReading, pinnedNowReadingRank]);

    const buildLocalDraft = () => {
        const safeHeroImage = heroImage.startsWith('data:image/') ? '' : heroImage;
        const safeHeroSquare = heroImageSquare.startsWith('data:image/') ? '' : heroImageSquare;
        return {
            title,
            slug,
            excerpt,
            category: categories.find(c => c.slug === categorySlug) || categories[0],
            author: { name: authorName, role: 'Редактор' },
            heroImage: safeHeroImage,
            heroImageSquare: safeHeroSquare,
            heroFocal,
            content,
            tags,
            source: { name: sourceName, url: sourceUrl },
            location: { city: locationCity, district: locationDistrict, address: locationAddress },
            isVerified,
            status,
            scheduledAt,
            isFeatured,
            isBreaking,
            pinnedNowReading,
            pinnedNowReadingRank,
            savedAt: new Date().toISOString(),
        };
    };

    const storeVersion = (articleData: Article) => {
        if (!articleData.id) return;
        try {
            const key = getVersionsKey(articleData.id);
            const existing = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
            const list = existing ? JSON.parse(existing) : [];
            const next = [{ savedAt: new Date().toISOString(), article: articleData }, ...list].slice(0, 5);
            localStorage.setItem(key, JSON.stringify(next));
        } catch {
            // ignore
        }
    };

    const getPublishWarnings = () => {
        const warnings: string[] = [];
        if (!title.trim()) warnings.push('Заголовок отсутствует.');
        if (title.length > 120) warnings.push('Заголовок слишком длинный.');
        if (!excerpt.trim()) warnings.push('Описание (лид) не заполнено.');
        if (!categorySlug) warnings.push('Рубрика не выбрана.');
        if (!heroImage) warnings.push('Обложка не добавлена.');
        const meaningfulBlocks = content.filter(block => ['paragraph', 'list', 'quote', 'callout'].includes(block.type));
        if (meaningfulBlocks.length < 2) warnings.push('Недостаточно контента (нужно 2–3 абзаца/списка/цитаты).');
        const categoryTitle = categories.find(c => c.slug === categorySlug)?.title?.toLowerCase() || '';
        if ((categoryTitle.includes('происше') || categoryTitle.includes('город')) && !sourceName && !sourceUrl) {
            warnings.push('Для городских/происшествий нужен источник.');
        }
        return warnings;
    };

    const handleSave = async () => {
        if (!title) return alert('Нужен хотя бы заголовок');

        if (status === 'scheduled' && !scheduledAt) {
            return alert('Укажите дату/время для планирования.');
        }

        if (status === 'published' || status === 'scheduled') {
            const warnings = getPublishWarnings();
            if (warnings.length > 0) {
                const proceed = window.confirm(`Перед публикацией есть замечания:\n\n${warnings.map(w => `• ${w}`).join('\n')}\n\nОпубликовать всё равно?`);
                if (!proceed) return;
            }
        }

        setSaveState('saving');

        const finalSlug = slugify(slug || title) || `article-${Date.now()}`;
        const existingArticle = id ? newsService.getById(id) : undefined;
        const nowIso = new Date().toISOString();
        const scheduledIso = scheduledAt || '';

        const publishedAt = status === 'scheduled'
            ? scheduledIso
            : existingArticle?.publishedAt || nowIso;

        const articleData: Article = {
            id: id || Math.random().toString(36).substr(2, 9),
            slug: finalSlug,
            title,
            excerpt,
            content,
            category: categories.find(c => c.slug === categorySlug) || categories[0],
            tags,
            author: { name: authorName, role: 'Редактор' },
            publishedAt,
            updatedAt: nowIso,
            createdAt: existingArticle?.createdAt || nowIso,
            heroImage,
            heroImageSquare,
            heroFocal,
            readingTime: 3,
            isFeatured,
            isBreaking,
            views: (existingArticle as any)?.views ?? 0,
            pinnedNowReading,
            pinnedNowReadingRank: pinnedNowReading ? pinnedNowReadingRank : 0,
            status,
            scheduledAt: status === 'scheduled' ? scheduledIso : undefined,
            deletedAt: status === 'trash' ? nowIso : undefined,
            source: { name: sourceName || undefined, url: sourceUrl || undefined },
            location: {
                city: locationCity || undefined,
                district: locationDistrict || undefined,
                address: locationAddress || undefined,
            },
            isVerified,
        };

        if (isEditing && existingArticle) {
            await newsService.updateArticle(articleData);
        } else {
            await newsService.createArticle(articleData);
        }

        storeVersion(articleData);
        setSaveState('saved');
        navigate('/admin');
    };

    const addBlock = (type: ContentBlock['type']) => {
        let newBlock: ContentBlock;
        if (type === 'list') {
            newBlock = { type, items: [''] } as ContentBlock;
        } else if (type === 'divider') {
            newBlock = { type: 'divider' } as ContentBlock;
        } else if (type === 'callout') {
            newBlock = { type: 'callout', kind: 'info', title: '', value: '' } as ContentBlock;
        } else {
            newBlock = { type, value: '' } as ContentBlock;
        }
        setContent([...content, newBlock]);
    };

    const moveBlock = (from: number, to: number) => {
        if (to < 0 || to >= content.length) return;
        const newContent = [...content];
        const [moved] = newContent.splice(from, 1);
        newContent.splice(to, 0, moved);
        setContent(newContent);
    };

    const duplicateBlock = (index: number) => {
        const newContent = [...content];
        newContent.splice(index + 1, 0, JSON.parse(JSON.stringify(content[index])));
        setContent(newContent);
    };

    const toggleCollapse = (index: number) => {
        setCollapsedBlocks((prev) => ({ ...prev, [index]: !prev[index] }));
    };

    const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter' && e.key !== ',') return;
        e.preventDefault();
        const value = tagInput.trim();
        if (!value) return;
        if (!tags.includes(value)) {
            setTags([...tags, value]);
        }
        setTagInput('');
    };

    const removeTag = (value: string) => {
        setTags(tags.filter(tag => tag !== value));
    };

    const loadImage = (file: File) => {
        return new Promise<HTMLImageElement>((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            img.onerror = () => reject(new Error('Image load error'));
            img.src = url;
        });
    };

    const canvasToFile = (canvas: HTMLCanvasElement, name: string, quality = 0.85) => {
        return new Promise<File>((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Failed to compress'));
                    return;
                }
                resolve(new File([blob], name, { type: 'image/webp' }));
            }, 'image/webp', quality);
        });
    };

    const processFile = async (file: File) => {
        if (!file.type.startsWith('image/')) return;

        setIsUploading(true);
        try {
            const img = await loadImage(file);
            const scale = Math.min(1, MAX_AUTOSAVE_IMAGE_WIDTH / img.width);
            const targetWidth = Math.round(img.width * scale);
            const targetHeight = Math.round(img.height * scale);

            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas not supported');
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

            const webpFile = await canvasToFile(canvas, file.name.replace(/\.[^/.]+$/, '') + '.webp');
            const url = await newsService.uploadImage(webpFile);
            setHeroImage(url);

            const size = Math.min(targetWidth, targetHeight);
            const squareCanvas = document.createElement('canvas');
            squareCanvas.width = size;
            squareCanvas.height = size;
            const sctx = squareCanvas.getContext('2d');
            if (sctx) {
                const sx = Math.max(0, Math.round((targetWidth - size) / 2));
                const sy = Math.max(0, Math.round((targetHeight - size) / 2));
                sctx.drawImage(canvas, sx, sy, size, size, 0, 0, size, size);
                try {
                    const squareFile = await canvasToFile(squareCanvas, file.name.replace(/\.[^/.]+$/, '') + '-square.webp');
                    const squareUrl = await newsService.uploadImage(squareFile);
                    setHeroImageSquare(squareUrl);
                } catch {
                    // optional
                }
            }
        } catch (error) {
            alert('Ошибка загрузки изображения');
        } finally {
            setIsUploading(false);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleHeroFocalPick = (e: React.MouseEvent<HTMLImageElement>) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        setHeroFocal({ x, y });
    };

    const versions = (() => {
        if (!id) return [] as { savedAt: string; article: Article }[];
        try {
            const raw = typeof window !== 'undefined' ? localStorage.getItem(getVersionsKey(id)) : null;
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    })();

    const previewArticle: Article = {
        id: id || 'preview',
        slug: slug || 'preview',
        title: title || 'Заголовок',
        excerpt: excerpt || 'Описание',
        content: content.length ? content : [{ type: 'paragraph', value: 'Текст статьи...' }],
        category: categories.find(c => c.slug === categorySlug) || categories[0],
        tags,
        author: { name: authorName || 'Редакция', role: 'Редактор' },
        publishedAt: new Date().toISOString(),
        heroImage,
        heroImageSquare,
        heroFocal,
        readingTime: 3,
        isFeatured,
        isBreaking,
        pinnedNowReading,
        pinnedNowReadingRank,
        status,
    };

    return (
        <div className="flex flex-col md:flex-row min-h-screen bg-background text-foreground animate-in fade-in">
            <div className="flex-1 md:overflow-y-auto">
                <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border/40 md:border-none">
                     <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-8 py-3 sm:py-4 flex items-center justify-between">
                        <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
                            <Link href="/admin"><ArrowLeft className="w-4 h-4 mr-2" /> Назад</Link>
                        </Button>
                        <div className="flex items-center gap-2 md:hidden">
                            <Button variant="ghost" size="sm" onClick={() => setIsPreviewOpen(true)}>
                                <Eye className="w-4 h-4 mr-2" /> Предпросмотр
                            </Button>
                            <Button onClick={handleSave} size="sm">Сохранить</Button>
                        </div>
                     </div>
                </div>

                <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-8 pb-24 sm:pb-32 pt-6 md:pt-8">
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleImageUpload}
                    />

                    <div 
                        className={cn(
                            "group relative w-full rounded-xl overflow-hidden transition-all duration-300 cursor-pointer mb-8",
                            heroImage ? "aspect-video bg-muted" : "h-24 bg-secondary/30 hover:bg-secondary/50 border-2 border-dashed border-border",
                            isDragging && "border-primary bg-primary/5 ring-2 ring-primary/20"
                        )}
                        onClick={() => !isUploading && fileInputRef.current?.click()}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        {isUploading ? (
                             <div className="w-full h-full aspect-video flex items-center justify-center bg-muted/50">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                             </div>
                        ) : heroImage ? (
                            <>
                                <img
                                    src={heroImage}
                                    alt="Обложка"
                                    className="w-full h-full object-cover"
                                    onClick={handleHeroFocalPick}
                                />
                                {heroFocal && (
                                    <div
                                        className="absolute w-4 h-4 rounded-full border-2 border-white bg-white/60 shadow"
                                        style={{
                                            left: `calc(${heroFocal.x * 100}% - 8px)`,
                                            top: `calc(${heroFocal.y * 100}% - 8px)`
                                        }}
                                    />
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-medium">
                                    Изменить обложку / выбрать фокус
                                </div>
                            </>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground gap-2">
                                <ImageIcon className="w-5 h-5" />
                                <span className="text-sm font-medium">Добавить обложку (клик или перетащить)</span>
                            </div>
                        )}
                    </div>

                    <AutoResizeTextarea
                        className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.1] placeholder:text-muted-foreground/30 mb-5 sm:mb-6"
                        value={title}
                        onChange={setTitle}
                        placeholder="Громкий заголовок..."
                        autoFocus={!isEditing}
                    />

                    <AutoResizeTextarea
                        className="text-base sm:text-lg md:text-2xl text-muted-foreground leading-relaxed mb-8 sm:mb-12"
                        value={excerpt}
                        onChange={setExcerpt}
                        placeholder="Напишите вводку, которая зацепит читателя..."
                    />

                    <div className="space-y-6">
                        {content.map((block, idx) => (
                            <ContentBlockRenderer 
                                key={idx} 
                                block={block}
                                onChange={(updated) => {
                                    const newContent = [...content];
                                    newContent[idx] = updated;
                                    setContent(newContent);
                                }}
                                onDelete={() => {
                                    setContent(content.filter((_, i) => i !== idx));
                                }}
                                onMoveUp={idx > 0 ? () => moveBlock(idx, idx - 1) : undefined}
                                onMoveDown={idx < content.length - 1 ? () => moveBlock(idx, idx + 1) : undefined}
                                onDuplicate={() => duplicateBlock(idx)}
                                isCollapsed={collapsedBlocks[idx]}
                                onToggleCollapse={() => toggleCollapse(idx)}
                            />
                        ))}
                    </div>

                    <div className="mt-8 pt-8 border-t border-dashed border-border/50">
                        <div className="flex flex-wrap items-center gap-2 justify-center opacity-70 hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="sm" onClick={() => addBlock('paragraph')} className="h-8 gap-2"><Type className="w-4 h-4" /> Текст</Button>
                            <Button variant="ghost" size="sm" onClick={() => addBlock('heading')} className="h-8 gap-2"><div className="font-bold text-xs">H2</div> Заголовок</Button>
                            <Button variant="ghost" size="sm" onClick={() => addBlock('quote')} className="h-8 gap-2"><Quote className="w-4 h-4" /> Цитата</Button>
                            <Button variant="ghost" size="sm" onClick={() => addBlock('list')} className="h-8 gap-2"><List className="w-4 h-4" /> Список</Button>
                            <Button variant="ghost" size="sm" onClick={() => addBlock('divider')} className="h-8 gap-2">Разделитель</Button>
                            <Button variant="ghost" size="sm" onClick={() => addBlock('callout')} className="h-8 gap-2">Справка</Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full md:w-80 bg-card border-t md:border-t-0 md:border-l border-border flex flex-col h-auto md:h-screen md:sticky md:top-0 md:overflow-y-auto">
                <div className="p-4 border-b border-border flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card z-10 md:sticky md:top-0">
                    <span className="font-bold text-sm text-muted-foreground uppercase tracking-widest whitespace-nowrap">Публикация</span>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setIsPreviewOpen(true)}>
                            <Eye className="w-4 h-4 mr-2" /> Предпросмотр
                        </Button>
                        <Button onClick={handleSave} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                            {status === 'published' ? 'Опубликовать' : 'Сохранить'}
                        </Button>
                    </div>
                </div>

                <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 flex-1">
                    <div className="space-y-4">
                        <div className="grid gap-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Статус</label>
                            <div className="relative">
                                <select
                                    className="w-full appearance-none bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent font-medium cursor-pointer"
                                    value={status}
                                    onChange={e => setStatus(e.target.value as ArticleStatus)}
                                >
                                    {STATUS_OPTIONS.map(option => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
                            </div>
                        </div>

                        {status === 'scheduled' && (
                            <div className="grid gap-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Публикация</label>
                                <Input
                                    type="datetime-local"
                                    value={toLocalInputValue(scheduledAt)}
                                    onChange={(e) => setScheduledAt(fromLocalInputValue(e.target.value))}
                                />
                            </div>
                        )}

                         <div className="grid gap-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Рубрика</label>
                            <div className="relative">
                                <select 
                                    className="w-full appearance-none bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent font-medium cursor-pointer"
                                    value={categorySlug}
                                    onChange={e => setCategorySlug(e.target.value)}
                                >
                                    {categories.map(c => <option key={c.slug} value={c.slug}>{c.title}</option>)}
                                </select>
                                <ChevronDown className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
                            </div>
                         </div>

                         <div className="flex flex-col gap-3 pt-2">
                             <label className="flex items-center gap-3 cursor-pointer group">
                                <input 
                                    type="checkbox" 
                                    checked={isFeatured} 
                                    onChange={e => setIsFeatured(e.target.checked)}
                                    className="w-4 h-4 rounded border-border text-primary focus:ring-offset-0 focus:ring-0 cursor-pointer"
                                />
                                <span className="text-sm font-medium group-hover:text-primary transition-colors">Главная новость</span>
                             </label>
                             <label className="flex items-center gap-3 cursor-pointer group">
                                <input 
                                    type="checkbox" 
                                    checked={isBreaking} 
                                    onChange={e => setIsBreaking(e.target.checked)}
                                    className="w-4 h-4 rounded border-border text-destructive focus:ring-offset-0 focus:ring-0 cursor-pointer"
                                />
                                <span className="text-sm font-medium group-hover:text-destructive transition-colors">Срочная молния</span>
                             </label>
                             <label className="flex items-center gap-3 cursor-pointer group">
                                <input 
                                    type="checkbox" 
                                    checked={pinnedNowReading} 
                                    onChange={e => setPinnedNowReading(e.target.checked)}
                                    className="w-4 h-4 rounded border-border text-foreground focus:ring-offset-0 focus:ring-0 cursor-pointer"
                                />
                                <span className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">Закрепить в «Сейчас читают»</span>
                             </label>
                             {pinnedNowReading && (
                               <div className="pl-7 flex items-center gap-3">
                                 <span className="text-xs text-muted-foreground">Приоритет</span>
                                 <input
                                   type="number"
                                   min={0}
                                   max={99}
                                   value={pinnedNowReadingRank}
                                   onChange={e => setPinnedNowReadingRank(Number(e.target.value) || 0)}
                                   className="h-9 w-24 rounded-md border border-border bg-background px-3 text-sm"
                                 />
                                 <span className="text-xs text-muted-foreground">меньше = выше</span>
                               </div>
                             )}
                         </div>
                    </div>

                    <div className="h-px bg-border/50" />

                    <div className="space-y-6">
                        <div className="grid gap-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">URL (слаг)</label>
                            <input 
                                className="w-full bg-transparent border-b border-border py-1 text-sm font-mono text-muted-foreground focus:text-foreground focus:border-accent outline-none transition-colors"
                                    value={slug}
                                    onChange={e => {
                                    setSlug(slugify(e.target.value));
                                    setIsSlugManuallyEdited(true);
                                }}
                                placeholder="автоматически"
                            />
                        </div>

                         <div className="grid gap-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Автор</label>
                            <input 
                                className="w-full bg-transparent border-b border-border py-1 text-sm font-medium focus:border-accent outline-none"
                                value={authorName}
                                onChange={e => setAuthorName(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Источник</label>
                        <input
                            className="w-full bg-transparent border-b border-border py-1 text-sm"
                            value={sourceName}
                            onChange={(e) => setSourceName(e.target.value)}
                            placeholder="Название источника"
                        />
                        <input
                            className="w-full bg-transparent border-b border-border py-1 text-sm"
                            value={sourceUrl}
                            onChange={(e) => setSourceUrl(e.target.value)}
                            placeholder="Ссылка на источник"
                        />
                    </div>

                    <div className="space-y-4">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Теги</label>
                        <Input
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={handleTagKeyDown}
                            placeholder="Введите тег и нажмите Enter"
                        />
                        <div className="flex flex-wrap gap-2">
                            {tags.map(tag => (
                                <span key={tag} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                                    {tag}
                                    <button onClick={() => removeTag(tag)}>
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Локация</label>
                        <input
                            className="w-full bg-transparent border-b border-border py-1 text-sm"
                            value={locationCity}
                            onChange={(e) => setLocationCity(e.target.value)}
                            placeholder="Город"
                        />
                        <input
                            className="w-full bg-transparent border-b border-border py-1 text-sm"
                            value={locationDistrict}
                            onChange={(e) => setLocationDistrict(e.target.value)}
                            placeholder="Район"
                        />
                        <input
                            className="w-full bg-transparent border-b border-border py-1 text-sm"
                            value={locationAddress}
                            onChange={(e) => setLocationAddress(e.target.value)}
                            placeholder="Адрес"
                        />
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isVerified}
                            onChange={(e) => setIsVerified(e.target.checked)}
                            className="w-4 h-4 rounded border-border text-primary focus:ring-offset-0 focus:ring-0 cursor-pointer"
                        />
                        <span className="text-sm font-medium">Проверено</span>
                    </label>

                    <div className="space-y-4">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">История версий</label>
                        {versions.length === 0 ? (
                            <div className="text-xs text-muted-foreground">Нет сохраненных версий</div>
                        ) : (
                            <div className="space-y-2">
                                {versions.map((version, index) => (
                                    <Button
                                        key={version.savedAt}
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-between"
                                        onClick={() => {
                                            if (window.confirm('Откатиться к этой версии?')) {
                                                applyDraft(version.article);
                                            }
                                        }}
                                    >
                                        <span>Версия {index + 1}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(version.savedAt).toLocaleString('ru-RU')}
                                        </span>
                                    </Button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="pt-4">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 block">SEO Превью</label>
                        <div className="p-3 bg-secondary/20 rounded-lg border border-border/50 text-[13px]">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-4 h-4 rounded-full bg-gray-200"></div>
                                <span className="text-foreground/70 text-xs">Атмосфера2Н</span>
                            </div>
                            <div className="text-[#1a0dab] dark:text-[#8ab4f8] text-base font-medium truncate mb-0.5 hover:underline cursor-pointer">
                                {title || 'Заголовок статьи...'}
                            </div>
                            <div className="text-green-700 dark:text-green-400 text-xs mb-1">
                                https://citychronicle.ru/news/{slug || '...'}
                            </div>
                            <div className="text-muted-foreground line-clamp-2 leading-snug">
                                {excerpt || 'Описание статьи появится здесь...'}
                            </div>
                        </div>
                    </div>

                </div>

                <div className="p-4 border-t border-border bg-secondary/10 text-xs text-muted-foreground text-center">
                    {saveState === 'saving' && 'Сохранение...'}
                    {saveState === 'dirty' && 'Есть несохранённые изменения'}
                    {saveState === 'saved' && `Сохранено${lastAutosaveAt ? ` в ${new Date(lastAutosaveAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : ''}`}
                </div>
            </div>

            {isPreviewOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-background rounded-xl shadow-lg w-full max-w-5xl h-[90vh] flex flex-col">
                        <div className="p-4 border-b border-border flex flex-wrap items-center gap-3 justify-between">
                            <div className="flex items-center gap-2">
                                <Button variant={previewMode === 'card' ? 'default' : 'ghost'} size="sm" onClick={() => setPreviewMode('card')}>Карточка</Button>
                                <Button variant={previewMode === 'page' ? 'default' : 'ghost'} size="sm" onClick={() => setPreviewMode('page')}>Страница</Button>
                            </div>
                            {previewMode === 'card' && (
                                <div className="flex items-center gap-2">
                                    <Button variant={previewCardVariant === 'default' ? 'default' : 'ghost'} size="sm" onClick={() => setPreviewCardVariant('default')}>Лента</Button>
                                    <Button variant={previewCardVariant === 'compact' ? 'default' : 'ghost'} size="sm" onClick={() => setPreviewCardVariant('compact')}>Компакт</Button>
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <Button variant={previewDevice === 'desktop' ? 'default' : 'ghost'} size="sm" onClick={() => setPreviewDevice('desktop')}>Десктоп</Button>
                                <Button variant={previewDevice === 'mobile' ? 'default' : 'ghost'} size="sm" onClick={() => setPreviewDevice('mobile')}>Мобильный</Button>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setIsPreviewOpen(false)}>
                                <X className="w-4 h-4 mr-2" /> Закрыть
                            </Button>
                        </div>
                        <div className="flex-1 overflow-auto p-6 bg-muted/30">
                            <div className={cn('mx-auto', previewDevice === 'mobile' ? 'max-w-[375px]' : 'max-w-3xl')}>
                                {previewMode === 'card' ? (
                                    <ArticleCard article={previewArticle} variant={previewCardVariant} />
                                ) : (
                                    <div className="bg-background rounded-xl border border-border/60 p-6">
                                        <h1 className="text-2xl sm:text-3xl font-bold mb-4">{previewArticle.title}</h1>
                                        <p className="text-muted-foreground mb-6">{previewArticle.excerpt}</p>
                                        {previewArticle.heroImage && (
                                            <img src={previewArticle.heroImage} alt={previewArticle.title} className="w-full aspect-video object-cover rounded-lg mb-6" />
                                        )}
                                        <ArticleContent content={previewArticle.content} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
