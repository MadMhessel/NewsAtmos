import Link from "@/lib/next-shim"
import { useSiteSettings } from "@/components/shared/SiteSettingsProvider"

export function Footer() {
  const { settings } = useSiteSettings()

  return (
    <footer className="border-t border-border bg-background pt-20 pb-10">
      <div className="container">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4 mb-20">
          <div className="col-span-2 md:col-span-1 pr-8">
            <span className="text-xl font-bold tracking-tight text-foreground block mb-6">{settings.footerAboutTitle}</span>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{settings.footerAboutText}</p>
          </div>
          
          <div className="flex flex-col gap-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-foreground/40">О проекте</h3>
            <Link href="/about" className="text-sm font-medium text-foreground/80 hover:text-accent transition-colors">О нас</Link>
            <Link href="/contacts" className="text-sm font-medium text-foreground/80 hover:text-accent transition-colors">Контакты</Link>
            <Link href="/menu" className="text-sm font-medium text-foreground/80 hover:text-accent transition-colors">Вакансии</Link>
          </div>
          
          <div className="flex flex-col gap-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-foreground/40">Читателям</h3>
            <Link href="/corrections" className="text-sm font-medium text-foreground/80 hover:text-accent transition-colors">Сообщить об ошибке</Link>
            <Link href="/rss.xml" className="text-sm font-medium text-foreground/80 hover:text-accent transition-colors">RSS лента</Link>
            <Link href="/search" className="text-sm font-medium text-foreground/80 hover:text-accent transition-colors">Поиск</Link>
          </div>
          
          <div className="flex flex-col gap-4">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-foreground/40">Документы</h3>
            <Link href="/privacy" className="text-sm font-medium text-muted-foreground/80 hover:text-foreground transition-colors">Политика конфиденциальности</Link>
            <Link href="/terms" className="text-sm font-medium text-muted-foreground/80 hover:text-foreground transition-colors">Условия использования</Link>
          </div>
        </div>
        
        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
           <div className="flex items-center gap-4">
               <p>&copy; {new Date().getFullYear()} {settings.siteName}</p>
</div>
           <p className="opacity-50">{settings.footerAgeBadge}</p>
        </div>
      </div>
    </footer>
  )
}