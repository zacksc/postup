import { isToday, isSameDay, format } from 'date-fns'
import { Play, Images, Camera, Circle, Paintbrush, type LucideIcon } from 'lucide-react'
import type { Post } from '@/types/post'
import type { PostType } from '@/components/ui/status-badge'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/utils'

interface WeekViewProps {
  days: Date[]
  selectedDay: Date | null
  getPostsForDay: (day: Date) => Post[]
  onDayClick: (day: Date) => void
  onPostClick: (post: Post) => void
}

// Mapeamento de tipo para ícone — mesmo padrão do Badge
const TYPE_ICONS: Record<PostType, LucideIcon> = {
  reels:     Play,
  carrossel: Images,
  foto:      Camera,
  stories:   Circle,
  design:    Paintbrush,
}

const WEEK_DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function WeekView({
  days,
  selectedDay,
  getPostsForDay,
  onDayClick,
  onPostClick,
}: WeekViewProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* Cabeçalho com os dias — mostra dia da semana + número */}
      <div className="grid grid-cols-7 border-b border-border">
        {days.map(day => {
          const isTodayDate = isToday(day)
          const isSelected = selectedDay ? isSameDay(day, selectedDay) : false
          const dayIndex = day.getDay() // 0 = domingo

          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={cn(
                'flex flex-col items-center gap-1 py-3 cursor-pointer',
                'transition-colors hover:bg-accent/50',
                isSelected && 'bg-primary/5'
              )}
            >
              {/* Nome do dia abreviado */}
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                {WEEK_DAYS_SHORT[dayIndex]}
              </span>

              {/* Número do dia com destaque para hoje */}
              <span
                className={cn(
                  'flex items-center justify-center',
                  'w-8 h-8 rounded-full',
                  'text-sm font-semibold',
                  isTodayDate
                    ? 'bg-primary text-primary-foreground'
                    : isSelected
                      ? 'text-primary'
                      : 'text-foreground'
                )}
              >
                {format(day, 'd')}
              </span>
            </div>
          )
        })}
      </div>

      {/* Colunas de posts por dia */}
      <div className="grid grid-cols-7 flex-1 min-h-0 overflow-y-auto">
        {days.map(day => {
          const dayPosts = getPostsForDay(day)
            // Ordena por horário — mais cedo primeiro
            .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
          const isSelected = selectedDay ? isSameDay(day, selectedDay) : false

          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={cn(
                'flex flex-col gap-1.5 p-1.5',
                'border-r border-border',
                'min-h-[200px]',
                'cursor-pointer transition-colors',
                isSelected ? 'bg-primary/5' : 'hover:bg-accent/30'
              )}
            >
              {dayPosts.length === 0 ? (
                // Estado vazio — ponto centralizado
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-border" />
                </div>
              ) : (
                dayPosts.map(post => {
                  const Icon = TYPE_ICONS[post.type]

                  return (
                    <button
                      key={post.id}
                      onClick={(e) => {
                        // stopPropagation impede que o clique no card
                        // também dispare o onDayClick da coluna
                        e.stopPropagation()
                        onDayClick(day)
                        onPostClick(post)
                      }}
                      className={cn(
                        'w-full text-left',
                        'flex flex-col gap-1',
                        'p-2 rounded-lg',
                        'transition-opacity hover:opacity-85',
                        'text-xs'
                      )}
                      // Borda esquerda e background translúcido com a cor do cliente
                      style={{ 
                        borderLeftColor: post.clientColor,
                        backgroundColor: `color-mix(in srgb, ${post.clientColor} 12%, transparent)`
                      }}
                    >
                      {/* Horário */}
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {format(post.scheduledAt, 'HH:mm')}
                      </span>

                      {/* Nome do cliente */}
                      <span
                        className="font-semibold text-[10px] uppercase tracking-wide truncate"
                        style={{ color: post.clientColor }}
                      >
                        {post.clientName}
                      </span>

                      {/* Legenda truncada */}
                      <span className="text-[10px] text-muted-foreground line-clamp-2 leading-snug">
                        {post.caption}
                      </span>

                      {/* Rodapé — tipo e status */}
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <Icon size={10} strokeWidth={1.75} />
                          {post.type}
                        </span>
                        <StatusBadge status={post.status} size="sm" />
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}