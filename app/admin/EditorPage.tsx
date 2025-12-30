import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { newsService } from '@/lib/newsService';
import { Article, ContentBlock, Category } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    ArrowLeft, Save, Plus, Trash2, GripVertical, 
    Image as ImageIcon, Type, Quote, List, Settings,
    MoreHorizontal, X, ChevronDown, ChevronRight, Eye, Loader2
} from 'lucide-react';
import Link from '@/lib/next-shim';
import { cn } from '@/lib/utils';

// --- Utility Components ---

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

// --- Block Components ---

interface BlockWrapperProps {
    children?: React.ReactNode;
    onDelete: () => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    isFocused?: boolean;
}

const BlockWrapper: React.FC<BlockWrapperProps> = ({ 
    children, 
    onDelete, 
    onMoveUp, 
    onMoveDown,
    isFocused 
}) => {
    return (
        <div
            className={cn(
                // На мобильных «поле слева» (gutter) с отрицательным отступом делало контент визуально крупнее
                // и иногда вызывало горизонтальный скролл. Оставляем gutter только со sm+.
                "group relative py-1",
                "sm:-ml-12 sm:pl-12"
            )}
        >
            {/* Gutter Actions */}
            <div className="hidden sm:flex absolute left-0 top-1.5 opacity-0 group-hover:opacity-100 transition-opacity items-center gap-1 pr-2">
                 <button className="p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-4 h-4" />
                 </button>
                 <button onClick={onDelete} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                 </button>
            </div>
            {children}
        </div>
    );
};

interface ContentBlockRendererProps {
    block: ContentBlock;
    onChange: (b: ContentBlock) => void;
    onDelete: () => void;
}

const ContentBlockRenderer: React.FC<ContentBlockRendererProps> = ({ 
    block, 
    onChange, 
    onDelete 
}) => {
    switch (block.type) {
        case 'heading':
            return (
                <BlockWrapper onDelete={onDelete}>
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
                <BlockWrapper onDelete={onDelete}>
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
                <BlockWrapper onDelete={onDelete}>
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
        case 'paragraph':
        default:
            return (
                <BlockWrapper onDelete={onDelete}>
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

// --- Main Editor Component ---

export default function EditorPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const categories = newsService.getCategories();
    
    const isEditing = !!id;

    // State
    const [title, setTitle] = useState('');
    const [slug, setSlug] = useState('');
    const [excerpt, setExcerpt] = useState('');
    const [categorySlug, setCategorySlug] = useState(categories[0].slug);
    const [authorName, setAuthorName] = useState('Редакция');
    const [heroImage, setHeroImage] = useState('');
    const [content, setContent] = useState<ContentBlock[]>([]);
    
    const [isFeatured, setIsFeatured] = useState(false);
    const [isBreaking, setIsBreaking] = useState(false);
    const [pinnedNowReading, setPinnedNowReading] = useState(false);
    const [pinnedNowReadingRank, setPinnedNowReadingRank] = useState(0);
    const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);

    // Image Upload State
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initial Load
    useEffect(() => {
        if (id) {
            const article = newsService.getById(id);
            if (article) {
                setTitle(article.title);
                setSlug(article.slug);
                setExcerpt(article.excerpt);
                setCategorySlug(article.category.slug);
                setAuthorName(article.author.name);
                setHeroImage(article.heroImage);
                setContent(article.content);
                setIsFeatured(article.isFeatured || false);
                setIsBreaking(article.isBreaking || false);
                setPinnedNowReading(!!article.pinnedNowReading);
                setPinnedNowReadingRank(typeof (article as any).pinnedNowReadingRank === 'number' ? (article as any).pinnedNowReadingRank : 0);
                setIsSlugManuallyEdited(true); // Don't auto-update slug for existing articles
            }
        } else {
             // New article default setup
             setContent([{ type: 'paragraph', value: '' }]);
        }
    }, [id]);

    // Auto-Slug
    useEffect(() => {
        if (!isSlugManuallyEdited && !isEditing) {
            const generated = title.toLowerCase()
                .replace(/[^a-z0-9а-яё\s]/g, '')
                .replace(/\s+/g, '-');
            setSlug(generated);
        }
    }, [title, isSlugManuallyEdited, isEditing]);

    const handleSave = async () => {
        if (!title) return alert('Нужен хотя бы заголовок');
        
        const finalSlug = slug || `article-${Date.now()}`;
        
        // Safety check for existing article
        const existingArticle = id ? newsService.getById(id) : undefined;

        const articleData: Article = {
            id: id || Math.random().toString(36).substr(2, 9),
            slug: finalSlug,
            title,
            excerpt,
            content,
            category: categories.find(c => c.slug === categorySlug) || categories[0],
            tags: [],
            author: { name: authorName, role: 'Editor' },
            // Fallback to current date if not found
            publishedAt: existingArticle ? existingArticle.publishedAt : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            heroImage,
            readingTime: 3, // Mock calc
            isFeatured,
            isBreaking,
            views: (existingArticle as any)?.views ?? 0,
            pinnedNowReading,
            pinnedNowReadingRank: pinnedNowReading ? pinnedNowReadingRank : 0
        };

        if (isEditing && existingArticle) {
            await newsService.updateArticle(articleData);
        } else {
            await newsService.createArticle(articleData);
        }

        navigate('/admin');
    };

    const addBlock = (type: ContentBlock['type']) => {
        const newBlock = type === 'list' 
            ? { type, items: [''] } as ContentBlock
            : { type, value: '' } as ContentBlock;
        setContent([...content, newBlock]);
    };

    // --- Image Handling ---

    const processFile = async (file: File) => {
        if (!file.type.startsWith('image/')) return;
        
        setIsUploading(true);
        try {
            const url = await newsService.uploadImage(file);
            setHeroImage(url);
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

    return (
        <div className="flex flex-col md:flex-row min-h-screen bg-background text-foreground animate-in fade-in">
            
            {/* LEFT: Content Canvas */}
            {/* На мобильных лучше избегать вложенного скролла — иначе ощущается «раздуто» и неудобно */}
            <div className="flex-1 md:overflow-y-auto">
                {/* Navbar within Canvas - ALIGNED with Content */}
                <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border/40 md:border-none">
                     <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-8 py-3 sm:py-4 flex items-center justify-between">
                        <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
                            <Link href="/admin"><ArrowLeft className="w-4 h-4 mr-2" /> Назад</Link>
                        </Button>
                        <div className="md:hidden">
                            <Button onClick={handleSave} size="sm">Сохранить</Button>
                        </div>
                     </div>
                </div>

                <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-8 pb-24 sm:pb-32 pt-6 md:pt-8">
                    {/* Hidden Input for File Upload */}
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleImageUpload}
                    />

                    {/* Cover Image Area */}
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
                                <img src={heroImage} alt="Cover" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-medium">
                                    Изменить обложку
                                </div>
                            </>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground gap-2">
                                <ImageIcon className="w-5 h-5" />
                                <span className="text-sm font-medium">Добавить обложку (клик или drop)</span>
                            </div>
                        )}
                    </div>

                    {/* Title */}
                    <AutoResizeTextarea
                        className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.1] placeholder:text-muted-foreground/30 mb-5 sm:mb-6"
                        value={title}
                        onChange={setTitle}
                        placeholder="Громкий заголовок..."
                        autoFocus={!isEditing}
                    />

                    {/* Lead */}
                    <AutoResizeTextarea
                        className="text-base sm:text-lg md:text-2xl text-muted-foreground leading-relaxed mb-8 sm:mb-12"
                        value={excerpt}
                        onChange={setExcerpt}
                        placeholder="Напишите вводку, которая зацепит читателя..."
                    />

                    {/* Blocks */}
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
                            />
                        ))}
                    </div>

                    {/* Add Block Menu */}
                    <div className="mt-8 pt-8 border-t border-dashed border-border/50">
                        <div className="flex flex-wrap items-center gap-2 justify-center opacity-70 hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="sm" onClick={() => addBlock('paragraph')} className="h-8 gap-2"><Type className="w-4 h-4" /> Текст</Button>
                            <Button variant="ghost" size="sm" onClick={() => addBlock('heading')} className="h-8 gap-2"><div className="font-bold text-xs">H2</div> Заголовок</Button>
                            <Button variant="ghost" size="sm" onClick={() => addBlock('quote')} className="h-8 gap-2"><Quote className="w-4 h-4" /> Цитата</Button>
                            <Button variant="ghost" size="sm" onClick={() => addBlock('list')} className="h-8 gap-2"><List className="w-4 h-4" /> Список</Button>
                        </div>
                    </div>

                </div>
            </div>

            {/* RIGHT: Sidebar Inspector */}
            <div className="w-full md:w-80 bg-card border-t md:border-t-0 md:border-l border-border flex flex-col h-auto md:h-screen md:sticky md:top-0 md:overflow-y-auto">
                <div className="p-4 border-b border-border flex items-center justify-between bg-card z-10 md:sticky md:top-0">
                    <span className="font-bold text-sm text-muted-foreground uppercase tracking-widest">Публикация</span>
                    <Button onClick={handleSave} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                        {isEditing ? 'Обновить' : 'Опубликовать'}
                    </Button>
                </div>

                <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 flex-1">
                    
                    {/* Status & Settings */}
                    <div className="space-y-4">
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

                    {/* Metadata Accordion style */}
                    <div className="space-y-6">
                        <div className="grid gap-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">URL (Slug)</label>
                            <input 
                                className="w-full bg-transparent border-b border-border py-1 text-sm font-mono text-muted-foreground focus:text-foreground focus:border-accent outline-none transition-colors"
                                value={slug}
                                onChange={e => {
                                    setSlug(e.target.value);
                                    setIsSlugManuallyEdited(true);
                                }}
                                placeholder="auto-generated"
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

                    {/* SEO Preview (Static visual) */}
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
                
                {/* Footer Info */}
                <div className="p-4 border-t border-border bg-secondary/10 text-xs text-muted-foreground text-center">
                    Auto-saved at {new Date().toLocaleTimeString()}
                </div>
            </div>
        </div>
    );
}