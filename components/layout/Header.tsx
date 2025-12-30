import React, { useState } from "react"
import Link from "@/lib/next-shim"
import { useLocation } from "react-router-dom"
import { ThemeToggle } from "@/components/shared/ThemeToggle"
import { SearchBar } from "@/components/shared/SearchBar"
import { newsService } from "@/lib/newsService"
import { Menu, X, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function Header() {
  const categories = newsService.getCategories()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  // Need location to determine active state manually in SPA mode
  const location = useLocation(); 

  return (
    <>
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 border-b border-border transition-colors duration-300">
      <div className="container flex h-16 items-center justify-between">
        
        {/* Left: Logo & Desktop Nav */}
        <div className="flex items-center gap-8 lg:gap-10">
          <Link href="/" className="flex items-center gap-3 group relative z-10 outline-none">
            <div className="relative h-6 md:h-8 w-auto min-w-[100px] select-none flex items-center">
                <img 
                    src="https://i.ibb.co/SDB0qyTC/logo11.png" 
                    alt="Атмосфера2N" 
                    className="h-full w-auto object-contain object-left 
                               brightness-0 dark:brightness-100 dark:invert-0
                               opacity-90 hover:opacity-100 transition-opacity" 
                />
            </div>
          </Link>
          
          <nav className="hidden lg:flex items-center gap-2">
            {categories.map((cat) => {
              const isActive = location.pathname === `/category/${cat.slug}`;
              return (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  className={cn(
                    "group relative px-3 py-2 text-[13px] font-medium uppercase tracking-wide transition-colors",
                    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {cat.title}
                  {/* Active State / Hover Line */}
                  <span className={cn(
                    "absolute bottom-1 left-3 right-3 h-[1.5px] bg-primary origin-center transition-transform duration-300",
                    isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100 opacity-70"
                  )} />
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Right: Tools */}
        <div className="flex items-center gap-3 md:gap-5">
          <div className="hidden md:block w-56 lg:w-64 transition-all">
             <SearchBar />
          </div>
          
          <div className="md:hidden">
            <Button variant="ghost" size="icon" onClick={() => setIsSearchOpen(!isSearchOpen)} className="hover:bg-transparent hover:text-primary">
               <Search className="h-5 w-5 text-muted-foreground" />
            </Button>
          </div>

          <div className="w-px h-6 bg-border mx-1 opacity-50" />

          <ThemeToggle />
          
          <div className="lg:hidden ml-1">
             <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="hover:bg-transparent text-foreground relative">
                {isMobileMenuOpen ? <X className="h-6 w-6"/> : <Menu className="h-6 w-6"/>}
             </Button>
          </div>
        </div>
      </div>
      
      {/* Mobile Search Expand */}
      {isSearchOpen && (
        <div className="md:hidden border-t border-border px-4 py-3 bg-background animate-in slide-in-from-top-2">
          <SearchBar />
        </div>
      )}
    </header>

    {/* Mobile Menu Overlay */}
    {isMobileMenuOpen && (
      <div className="fixed inset-0 top-16 z-40 bg-background flex flex-col p-6 animate-in slide-in-from-right-5 duration-300 overflow-y-auto">
         <nav className="flex flex-col space-y-6">
          <div className="space-y-3">
            <span className="text-[11px] font-bold text-accent uppercase tracking-widest block mb-2 opacity-80">Рубрики</span>
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className="block text-2xl font-bold text-foreground/90 hover:text-primary transition-colors border-b border-border/40 pb-3"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {cat.title}
              </Link>
            ))}
          </div>
          
          <div className="space-y-4 pt-6">
             <span className="text-[11px] font-bold text-accent uppercase tracking-widest block mb-2 opacity-80">Инфо</span>
             <Link href="/about" className="block text-lg font-medium text-muted-foreground hover:text-foreground" onClick={() => setIsMobileMenuOpen(false)}>О проекте</Link>
             <Link href="/contacts" className="block text-lg font-medium text-muted-foreground hover:text-foreground" onClick={() => setIsMobileMenuOpen(false)}>Контакты</Link>
          </div>
         </nav>
      </div>
    )}
    </>
  )
}