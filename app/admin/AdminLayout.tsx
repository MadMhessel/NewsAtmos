import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Link from '@/lib/next-shim';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, FileText, Settings, LogOut, Plus, Newspaper } from 'lucide-react';
import { cn } from '@/lib/utils';
import LoginPage from '@/app/admin/LoginPage';

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem('admin_auth') === 'true' && !!sessionStorage.getItem('admin_token'));

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
        {/* На мобильных админка выглядела крупнее из-за фиксированных больших отступов */}
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
            {children}
        </div>
      </main>
    </div>
  );
}

export default AdminLayout;
