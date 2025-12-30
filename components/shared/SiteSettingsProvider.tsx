import React from "react";
import { SiteSettings, DEFAULT_SITE_SETTINGS, loadSiteSettings, saveSiteSettings, normalizeSiteSettings } from "@/lib/siteSettings";

type Ctx = {
  settings: SiteSettings;
  isLoading: boolean;
  refresh: () => Promise<void>;
  update: (next: SiteSettings) => void;
  save: () => Promise<{ ok: boolean; error?: string }>;
};

const SiteSettingsContext = React.createContext<Ctx | null>(null);

export function SiteSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = React.useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [isLoading, setIsLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const loaded = await loadSiteSettings();
      setSettings(loaded);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const update = React.useCallback((next: SiteSettings) => {
    setSettings(normalizeSiteSettings(next));
  }, []);

  const save = React.useCallback(async () => {
    const res = await saveSiteSettings(settings);
    return res;
  }, [settings]);

  const value: Ctx = { settings, isLoading, refresh, update, save };

  return <SiteSettingsContext.Provider value={value}>{children}</SiteSettingsContext.Provider>;
}

export function useSiteSettings() {
  const ctx = React.useContext(SiteSettingsContext);
  if (!ctx) {
    return {
      settings: DEFAULT_SITE_SETTINGS,
      isLoading: false,
      refresh: async () => {},
      update: (_: SiteSettings) => {},
      save: async () => ({ ok: false, error: "Контекст настроек недоступен" }),
    };
  }
  return ctx;
}
