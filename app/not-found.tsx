import Link from '@/lib/next-shim'
import { Button } from "@/components/ui/button"
 
export default function NotFound() {
  return (
    <div className="container flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h2 className="text-4xl font-extrabold mb-4">404</h2>
      <p className="text-xl text-muted-foreground mb-8">Страница не найдена</p>
      <Button asChild>
        <Link href="/">Вернуться на главную</Link>
      </Button>
    </div>
  )
}
