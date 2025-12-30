import { ContentBlock } from "@/lib/types"

export function ArticleContent({ content }: { content: ContentBlock[] }) {
  return (
    <div className="article-body">
      {content.map((block, idx) => {
        switch (block.type) {
          case 'paragraph':
            return <p key={idx}>{block.value}</p>
          case 'heading':
            return <h2 key={idx}>{block.value}</h2>
          case 'quote':
            return (
              <blockquote key={idx}>
                <p>{block.value}</p>
                {block.author && <cite>{block.author}</cite>}
              </blockquote>
            )
          case 'list':
            return (
              <ul key={idx}>
                {block.items.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            )
          case 'divider':
            return <hr key={idx} className="my-8 border-border/60" />
          case 'callout': {
            const kindClass = block.kind === 'warning'
              ? 'border-yellow-500/30 bg-yellow-500/10'
              : block.kind === 'important'
              ? 'border-red-500/30 bg-red-500/10'
              : 'border-border/60 bg-secondary/20'
            return (
              <aside key={idx} className={`my-8 rounded-xl border p-5 ${kindClass}`}>
                {block.title && (
                  <div className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {block.title}
                  </div>
                )}
                <div className="text-base leading-relaxed">{block.value}</div>
              </aside>
            )
          }
          default:
            return null
        }
      })}
    </div>
  )
}
