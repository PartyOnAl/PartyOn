import type { ReactNode } from 'react'

/** Case-insensitive highlight of every occurrence of `query` in `text` (primary color). */
export function MatchHighlight({
  text,
  query,
}: {
  text: string
  query: string
}): ReactNode {
  const q = query.trim()
  if (!q) return text
  const lower = text.toLowerCase()
  const qq = q.toLowerCase()
  const parts: ReactNode[] = []
  let start = 0
  let i = lower.indexOf(qq, start)
  let key = 0
  while (i >= 0) {
    if (i > start) {
      parts.push(<span key={`t${key++}`}>{text.slice(start, i)}</span>)
    }
    parts.push(
      <span key={`m${key++}`} className="font-semibold text-primary">
        {text.slice(i, i + qq.length)}
      </span>,
    )
    start = i + qq.length
    i = lower.indexOf(qq, start)
  }
  if (start < text.length) {
    parts.push(<span key={`t${key++}`}>{text.slice(start)}</span>)
  }
  return parts.length > 0 ? <>{parts}</> : text
}
