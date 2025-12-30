import { useSiteSettings } from "@/components/shared/SiteSettingsProvider"

export default function ContactsPage() {
  const { settings } = useSiteSettings()

  return (
    <div className="container py-12 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">Контакты</h1>
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-4">
            <h3 className="text-xl font-semibold">Редакция</h3>
            <p>Email: <a href={`mailto:${settings.contacts.editorialEmail}`} className="text-primary hover:underline">{settings.contacts.editorialEmail}</a></p>
            <p>Телефон: {settings.contacts.editorialPhone}</p>
            <p>Адрес: {settings.contacts.editorialAddress}</p>
        </div>
        <div className="space-y-4">
            <h3 className="text-xl font-semibold">Рекламный отдел</h3>
            <p>Email: <a href={`mailto:${settings.contacts.adsEmail}`} className="text-primary hover:underline">{settings.contacts.adsEmail}</a></p>
        </div>
      </div>
    </div>
  );
}