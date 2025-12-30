import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from '@/components/shared/ThemeProvider';
import { SiteSettingsProvider } from '@/components/shared/SiteSettingsProvider';
import { newsService } from '@/lib/newsService';
import './app/globals.css';

// Layout
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

// Public Pages
// ВАЖНО: /app/page.tsx в этом проекте не является «домашней страницей» (наследие структуры Next).
// Для Vite+React Router домашний экран живёт в components/screens/HomePage.
import HomePage from '@/components/screens/HomePage';
import CategoryPage from '@/app/category/[slug]/page';
import ArticlePage from '@/app/news/[slug]/page';
import SearchPage from '@/app/search/page';
import AboutPage from '@/app/about/page';
import ContactsPage from '@/app/contacts/page';
import CorrectionsPage from '@/app/corrections/page';
import MenuPage from '@/app/menu/page';
import PrivacyPage from '@/app/privacy/page';
import TermsPage from '@/app/terms/page';
import NotFound from '@/app/not-found';

// Admin Pages
import AdminLayout from '@/app/admin/AdminLayout';
import DashboardPage from '@/app/admin/DashboardPage';
import EditorPage from '@/app/admin/EditorPage';
import SettingsPage from '@/app/admin/SettingsPage';
import NewsModulePage from '@/app/admin/NewsModulePage';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Don't render Public Header/Footer for Admin routes
  if (pathname.startsWith('/admin')) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased font-sans">
      <Header />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}

function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Init data from server or localstorage before rendering
    newsService.init().then(() => {
        setIsReady(true);
    });
  }, []);

  if (!isReady) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div></div>;
  }

  return (
    <Router>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SiteSettingsProvider>
        <Layout>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/category/:slug" element={<CategoryPage />} />
            <Route path="/news/:slug" element={<ArticlePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/corrections" element={<CorrectionsPage />} />
            <Route path="/menu" element={<MenuPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            
            {/* Admin Routes */}
            <Route path="/admin/login" element={<Navigate to="/admin" replace />} />
            <Route path="/admin" element={<AdminLayout><DashboardPage /></AdminLayout>} />
            <Route path="/admin/create" element={<AdminLayout><EditorPage /></AdminLayout>} />
            <Route path="/admin/edit/:id" element={<AdminLayout><EditorPage /></AdminLayout>} />
            <Route path="/admin/news" element={<AdminLayout><NewsModulePage /></AdminLayout>} />
            <Route path="/admin/settings" element={<AdminLayout><SettingsPage /></AdminLayout>} />

            {/* System Routes */}
            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </Layout>
      </SiteSettingsProvider>
      </ThemeProvider>
    </Router>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}
