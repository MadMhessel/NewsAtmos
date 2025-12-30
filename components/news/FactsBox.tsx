import { CheckCircle2 } from "lucide-react"

export function FactsBox({ facts }: { facts: string[] }) {
  if (!facts || facts.length === 0) return null

  return (
    <div className="my-8 bg-secondary/20 border border-border/60 rounded-xl p-6">
      <h3 className="mb-5 font-bold text-xs uppercase tracking-widest text-primary flex items-center gap-2 opacity-80">
        <span className="w-1.5 h-1.5 rounded-full bg-accent" />
        Что известно на сейчас
      </h3>
      <ul className="grid gap-3">
        {facts.map((fact, idx) => (
          <li key={idx} className="flex gap-3 text-base leading-relaxed text-foreground bg-background p-3 rounded-lg border border-border/40 shadow-sm">
             <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5 opacity-80" />
             <span>{fact}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}