import { newsService } from "@/lib/newsService"
import Link from "@/lib/next-shim"

export default function MenuPage() {
    const categories = newsService.getCategories();
    
    return (
        <div className="container py-8">
            <h1 className="text-2xl font-bold mb-6">Меню</h1>
            <nav className="flex flex-col space-y-4">
                {categories.map(cat => (
                    <Link 
                        key={cat.slug} 
                        href={`/category/${cat.slug}`}
                        className="text-xl font-medium p-2 hover:bg-muted rounded transition-colors"
                    >
                        {cat.title}
                    </Link>
                ))}
                <div className="h-px bg-border my-4" />
                <Link href="/about" className="text-muted-foreground">О проекте</Link>
                <Link href="/contacts" className="text-muted-foreground">Контакты</Link>
            </nav>
        </div>
    )
}
