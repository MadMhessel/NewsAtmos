import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CorrectionsPage() {
  return (
    <div className="container py-12 max-w-xl">
      <h1 className="text-3xl font-bold mb-6">Сообщить об ошибке</h1>
      <p className="text-muted-foreground mb-8">
        Заметили неточность в материале? Пожалуйста, заполните форму ниже. Мы проверим информацию и внесем исправления.
      </p>
      
      <form className="space-y-6">
        <div className="space-y-2">
            <label className="text-sm font-medium">Ссылка на материал</label>
            <Input placeholder="https://..." />
        </div>
        
        <div className="space-y-2">
            <label className="text-sm font-medium">Описание ошибки</label>
            <textarea 
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Что именно написано неверно?"
            />
        </div>

        <Button type="submit">Отправить</Button>
      </form>
    </div>
  );
}
