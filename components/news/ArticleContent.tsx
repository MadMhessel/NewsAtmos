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
          default:
            return null
        }
      })}
    </div>
  )
}