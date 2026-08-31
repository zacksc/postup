import type { Post } from '@/types/post'
import { cn } from '@/lib/utils'
import { format, isValid } from 'date-fns' // Adicionamos o isValid

interface PostPillProps {
  post: Post
  onClick: (post: Post) => void
}

export function PostPill({ post, onClick }: PostPillProps) {
  // 1. Validamos a data antes de passar para o format
  // O MOCK_POSTS usa objetos Date, mas se vier do banco como string, o new Date() resolve.
  const date = new Date(post.scheduledAt)
  const time = isValid(date) ? format(date, 'HH:mm') : '--:--'

  return (
    <button
      onClick={(e) => {
        // 2. Importante: evita que o clique na pílula selecione o dia no calendário ao mesmo tempo
        e.stopPropagation() 
        onClick(post)
      }}
      className={cn(
        'w-full flex items-center gap-1',
        'h-5 px-1.5',
        'text-[10px] font-semibold',
        'rounded-xs',
        'hover:opacity-85 transition-opacity',
        'truncate text-left border border-transparent'
      )}
      style={{ 
        backgroundColor: `color-mix(in srgb, ${post.clientColor} 18%, transparent)`,
        color: post.clientColor,
        borderColor: `color-mix(in srgb, ${post.clientColor} 30%, transparent)`
      }}
    >
      <span className="shrink-0 opacity-80">
        {time}
      </span>
      <span className="truncate">{post.clientName}</span>
    </button>
  )
}