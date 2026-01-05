import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Link from '@/lib/next-shim';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, FileText, Settings, LogOut, Plus, Newspaper, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import LoginPage from '@/app/admin/LoginPage';

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem('admin_auth') === 'true' && !!sessionStorage.getItem('admin_token'));
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Simple "Auth" check
  useEffect(() => {
    const auth = sessionStorage.getItem('admin_auth');
    if (auth !== 'true') {
      setIsAuthenticated(false);
    } else {
      setIsAuthenticated(true);
    }
  }, [navigate]);

  if (!isAuthenticated) {
    return <LoginPage redirectTo={location.pathname} onSuccess={() => setIsAuthenticated(true)} />;
  }

  const handleLogout = () => {
    sessionStorage.removeItem('admin_auth');
      sessionStorage.removeItem('admin_token');
    try {
      localStorage.removeItem('admin_token');
    } catch {
      // ignore storage errors
    }
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) return null;

  const navItems = [
    { href: '/admin', label: 'Все новости', icon: FileText },
    { href: '/admin/news', label: 'Новости', icon: Newspaper },
    { href: '/admin/live', label: 'Онлайн-новости', icon: LayoutDashboard },
    { href: '/admin/create', label: 'Создать новость', icon: Plus },
    { href: '/admin/settings', label: 'Настройки', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-secondary/20 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border hidden md:flex flex-col fixed inset-y-0 z-50">
        <div className="h-16 flex items-center px-6 border-b border-border">
            <span className="font-bold text-xl tracking-tight">Админ<span className="text-primary">панель</span></span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
                const isActive = location.pathname === item.href || (item.href !== '/admin' && location.pathname.startsWith(item.href));
                return (
                    <Link 
                        key={item.href} 
                        href={item.href}
                        className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors",
                            isActive 
                                ? "bg-primary/10 text-primary" 
                                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        )}
                    >
                        <item.icon className="w-4 h-4" />
                        {item.label}
                    </Link>
                )
            })}
        </nav>

        <div className="p-4 border-t border-border">
             <Button variant="ghost" className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleLogout}>
                <LogOut className="w-4 h-4" /> Выйти
             </Button>
             <Link href="/" className="block mt-2 text-center text-xs text-muted-foreground hover:underline">
                Вернуться на сайт
             </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64">
        <div className="md:hidden sticky top-0 z-40 bg-card border-b border-border">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-foreground"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Открыть меню"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-semibold">Админпанель</span>
            <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Выйти">
              <LogOut className="w-5 h-5 text-destructive" />
            </Button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-background/80" onClick={() => setIsMobileMenuOpen(false)} />
            <div className="absolute left-0 top-0 h-full w-72 bg-card border-r border-border shadow-xl flex flex-col">
              <div className="flex items-center justify-between px-4 py-4 border-b border-border">
                <span className="font-bold text-lg">Навигация</span>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground"
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-label="Закрыть меню"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.href || (item.href !== '/admin' && location.pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="p-4 border-t border-border space-y-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4" /> Выйти
                </Button>
                <Link href="/" className="block text-center text-xs text-muted-foreground hover:underline">
                  Вернуться на сайт
                </Link>
              </div>
            </div>
          </div>
        )}
        {/* На мобильных админка выглядела крупнее из-за фиксированных больших отступов */}
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
            {children}
        </div>
      </main>
    </div>
  );
}

export default AdminLayout;
