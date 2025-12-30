import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSiteSettings } from "@/components/shared/SiteSettingsProvider";
import { normalizeSiteSettings } from "@/lib/siteSettings";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-medium text-foreground mb-2">{children}</div>;
}

function Help({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-muted-foreground mt-2 leading-relaxed">{children}</div>;
}

export default function SettingsPage() {
  const { settings, update, save, isLoading, refresh } = useSiteSettings();
  const [status, setStatus] = React.useState<null | { type: "ok" | "err"; text: string }>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    // ensure latest settings after entering admin
    refresh();
  }, [refresh]);

  const onChange = (patch: any) => {
    update(normalizeSiteSettings({ ...settings, ...patch }));
  };

  const onChangeContacts = (patch: any) => {
    update(normalizeSiteSettings({ ...settings, contacts: { ...settings.contacts, ...patch } }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setStatus(null);
    const res = await save();
    setIsSaving(false);
    setStatus(res.ok ? { type: "ok", text: "Сохранено. Изменения видны на сайте после обновления страницы." }
                     : { type: "err", text: res.error || "Не удалось сохранить" });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Настройки сайта</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Здесь редактируются основные данные, которые используются на публичных страницах.
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving || isLoading} className="shrink-0">
          {isSaving ? "Сохраняем…" : "Сохранить"}
        </Button>
      </div>

      {status && (
        <div className={[
          "rounded-lg border p-4 text-sm",
          status.type === "ok" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                               : "border-destructive/30 bg-destructive/10 text-destructive"
        ].join(" ")}>
          {status.text}
        </div>
      )}

      <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold mb-4">Основное</h2>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <FieldLabel>Название сайта</FieldLabel>
            <Input value={settings.siteName} onChange={(e) => onChange({ siteName: e.target.value })} placeholder="Например: Атмосфера2Н" />
            <Help>Используется в подвале и на служебных страницах.</Help>
          </div>

          <div>
            <FieldLabel>Короткое описание</FieldLabel>
            <Input value={settings.siteTagline} onChange={(e) => onChange({ siteTagline: e.target.value })} placeholder="Например: Независимое городское издание" />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold mb-4">Кнопка Telegram</h2>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <FieldLabel>Ссылка на канал</FieldLabel>
            <Input value={settings.telegramUrl} onChange={(e) => onChange({ telegramUrl: e.target.value })} placeholder="https://t.me/..." />
            <Help>Ссылка открывается в новой вкладке.</Help>
          </div>

          <div>
            <FieldLabel>Текст кнопки</FieldLabel>
            <Input value={settings.telegramButtonText} onChange={(e) => onChange({ telegramButtonText: e.target.value })} placeholder="Перейти в канал" />
          </div>
        </div>
      </section>

      
      <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold mb-4">Блок «Сейчас читают»</h2>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <FieldLabel>Количество материалов</FieldLabel>
            <Input
              type="number"
              min={1}
              max={12}
              value={settings.nowReadingCount}
              onChange={(e) => onChange({ nowReadingCount: Number(e.target.value) })}
            />
            <Help>Рекомендуем 5–8. Максимум — 12.</Help>
          </div>

          <div>
            <FieldLabel>Период для автодобивки (в часах)</FieldLabel>
            <Input
              type="number"
              min={1}
              max={720}
              value={settings.nowReadingMaxAgeHours}
              onChange={(e) => onChange({ nowReadingMaxAgeHours: Number(e.target.value) })}
            />
            <Help>Автодобивка берёт новости за этот период и сортирует по просмотрам. Закреплённые материалы показываются всегда.</Help>
          </div>
        </div>
      </section>

<section className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold mb-4">Контакты</h2>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <FieldLabel>Email редакции</FieldLabel>
            <Input value={settings.contacts.editorialEmail} onChange={(e) => onChangeContacts({ editorialEmail: e.target.value })} placeholder="editor@..." />
          </div>

          <div>
            <FieldLabel>Телефон</FieldLabel>
            <Input value={settings.contacts.editorialPhone} onChange={(e) => onChangeContacts({ editorialPhone: e.target.value })} placeholder="+7 ..." />
          </div>

          <div className="md:col-span-2">
            <FieldLabel>Адрес</FieldLabel>
            <Input value={settings.contacts.editorialAddress} onChange={(e) => onChangeContacts({ editorialAddress: e.target.value })} placeholder="Город, улица, дом" />
          </div>

          <div>
            <FieldLabel>Email рекламного отдела</FieldLabel>
            <Input value={settings.contacts.adsEmail} onChange={(e) => onChangeContacts({ adsEmail: e.target.value })} placeholder="ads@..." />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold mb-4">Подвал</h2>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <FieldLabel>Заголовок</FieldLabel>
            <Input value={settings.footerAboutTitle} onChange={(e) => onChange({ footerAboutTitle: e.target.value })} placeholder="Атмосфера2Н" />
          </div>

          <div>
            <FieldLabel>Возрастная маркировка</FieldLabel>
            <Input value={settings.footerAgeBadge} onChange={(e) => onChange({ footerAgeBadge: e.target.value })} placeholder="18+" />
          </div>

          <div className="md:col-span-2">
            <FieldLabel>Текст (можно в 2 строки)</FieldLabel>
            <textarea
              className="w-full min-h-[96px] rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              value={settings.footerAboutText}
              onChange={(e) => onChange({ footerAboutText: e.target.value })}
              placeholder={"Независимое городское издание.\nФакты, люди, смыслы."}
            />
            <Help>Переносы строк сохраняются.</Help>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="secondary" type="button" onClick={() => { refresh(); setStatus(null); }} disabled={isSaving}>
            Сбросить (перезагрузить с сервера)
          </Button>
        </div>
      </section>
    </div>
  );
}
