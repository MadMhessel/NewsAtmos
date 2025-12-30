export type SiteContacts = {
  editorialEmail: string;
  editorialPhone: string;
  editorialAddress: string;
  adsEmail: string;
};

export type SiteSettings = {
  siteName: string;
  siteTagline: string;
  telegramUrl: string;
  telegramButtonText: string;
  contacts: SiteContacts;
  footerAboutTitle: string;
  footerAboutText: string;
  footerAgeBadge: string;
  nowReadingCount: number;
  nowReadingMaxAgeHours: number;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: "Атмосфера2Н",
  siteTagline: "Независимое городское издание",
  telegramUrl: "https://t.me/atmosphera2n",
  telegramButtonText: "Перейти в канал",
  contacts: {
    editorialEmail: "editor@atmos2n.ru",
    editorialPhone: "+7 (999) 000-00-00",
    editorialAddress: "Нижний Новгород",
    adsEmail: "ads@atmos2n.ru",
  },
  footerAboutTitle: "Атмосфера2Н",
  footerAboutText: "Независимое городское издание.\nФакты, люди, смыслы.",
  footerAgeBadge: "18+",
  nowReadingCount: 6,
  nowReadingMaxAgeHours: 72,
};

const SETTINGS_URL = "/api/settings.php";
const STORAGE_KEY = "cc_site_settings_v1";

function safeParse(jsonText: string) {
  try { return JSON.parse(jsonText); } catch { return null; }
}

function isObject(v: any) {
  return v && typeof v === "object" && !Array.isArray(v);
}

export function normalizeSiteSettings(input: any): SiteSettings {
  const d = DEFAULT_SITE_SETTINGS;

  const out: SiteSettings = {
    siteName: typeof input?.siteName === "string" && input.siteName.trim() ? input.siteName.trim() : d.siteName,
    siteTagline: typeof input?.siteTagline === "string" ? input.siteTagline.trim() : d.siteTagline,
    telegramUrl: typeof input?.telegramUrl === "string" && input.telegramUrl.trim() ? input.telegramUrl.trim() : d.telegramUrl,
    telegramButtonText: typeof input?.telegramButtonText === "string" && input.telegramButtonText.trim() ? input.telegramButtonText.trim() : d.telegramButtonText,
    contacts: {
      editorialEmail: typeof input?.contacts?.editorialEmail === "string" ? input.contacts.editorialEmail.trim() : d.contacts.editorialEmail,
      editorialPhone: typeof input?.contacts?.editorialPhone === "string" ? input.contacts.editorialPhone.trim() : d.contacts.editorialPhone,
      editorialAddress: typeof input?.contacts?.editorialAddress === "string" ? input.contacts.editorialAddress.trim() : d.contacts.editorialAddress,
      adsEmail: typeof input?.contacts?.adsEmail === "string" ? input.contacts.adsEmail.trim() : d.contacts.adsEmail,
    },
    footerAboutTitle: typeof input?.footerAboutTitle === "string" && input.footerAboutTitle.trim() ? input.footerAboutTitle.trim() : d.footerAboutTitle,
    footerAboutText: typeof input?.footerAboutText === "string" ? input.footerAboutText : d.footerAboutText,
    footerAgeBadge: typeof input?.footerAgeBadge === "string" && input.footerAgeBadge.trim() ? input.footerAgeBadge.trim() : d.footerAgeBadge,
    nowReadingCount: typeof input?.nowReadingCount === "number" && isFinite(input.nowReadingCount) ? Math.max(1, Math.min(12, Math.floor(input.nowReadingCount))) : d.nowReadingCount,
    nowReadingMaxAgeHours: typeof input?.nowReadingMaxAgeHours === "number" && isFinite(input.nowReadingMaxAgeHours) ? Math.max(1, Math.min(720, Math.floor(input.nowReadingMaxAgeHours))) : d.nowReadingMaxAgeHours,
  };

  return out;
}

export async function loadSiteSettings(): Promise<SiteSettings> {
  // 1) Try server
  try {
    const res = await fetch(SETTINGS_URL, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      const normalized = normalizeSiteSettings(data);
      // cache locally
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized)); } catch {}
      return normalized;
    }
  } catch {
    // ignore
  }

  // 2) Local cache
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? safeParse(raw) : null;
    if (parsed) return normalizeSiteSettings(parsed);
  } catch {}

  return DEFAULT_SITE_SETTINGS;
}

export async function saveSiteSettings(next: SiteSettings): Promise<{ ok: boolean; error?: string }> {
  const token = typeof window !== "undefined" ? sessionStorage.getItem("admin_token") : null;

  try {
    const res = await fetch(SETTINGS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "X-Admin-Token": token } : {}),
      },
      body: JSON.stringify(next),
    });

    const data = await res.json().catch(() => ({} as any));
    if (!res.ok || data?.ok === false) {
      return { ok: false, error: data?.error || `Ошибка сохранения (${res.status})` };
    }

    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: "Не удалось связаться с сервером" };
  }
}