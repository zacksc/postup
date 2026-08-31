import { isSameMonth, isToday, isSameDay, format } from 'date-fns'
import type { Post } from '@/types/post'
import { CalendarPostCard } from '@/components/calendar/CalendarPostCard'
import { cn } from '@/lib/utils'

interface MonthViewProps {
  days: Date[]
  referenceDate: Date
  selectedDay: Date | null
  getPostsForDay: (day: Date) => Post[]
  onDayClick: (day: Date) => void
  onDayDoubleClick: (day: Date) => void
  onPostClick: (post: Post) => void
}

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function MonthView({
  days,
  referenceDate,
  selectedDay,
  getPostsForDay,
  onDayClick,
  onDayDoubleClick,
  onPostClick,
}: MonthViewProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEK_DAYS.map(day => (
          <div
            key={day}
            className="py-2 text-center text-[11px] font-medium text-muted-foreground uppercase tracking-wider"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 flex-none min-h-0 md:flex-1">
        {days.map(day => {
          const dayPosts = getPostsForDay(day)
          const isCurrentMonth = isSameMonth(day, referenceDate)
          const isSelected = selectedDay ? isSameDay(day, selectedDay) : false
          const isTodayDate = isToday(day)

          const sorted = [...dayPosts].sort((a, b) => {
            const urgencyOrder: Record<string, number> = { alteracao: 0, aguardando: 1 }
            const ua = urgencyOrder[a.status] ?? 2
            const ub = urgencyOrder[b.status] ?? 2
            if (ua !== ub) return ua - ub
            return a.scheduledAt.getTime() - b.scheduledAt.getTime()
          })
          const MAX_VISIBLE = 3
          const visiblePosts = sorted.slice(0, MAX_VISIBLE)
          const extraCount = sorted.length - MAX_VISIBLE

          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              onDoubleClick={() => onDayDoubleClick(day)}
              className={cn(
                'flex flex-col gap-0.5 p-1.5',
                'border-b border-r border-border',
                'aspect-square md:aspect-auto md:min-h-[100px]',
                'cursor-pointer transition-colors',
                isSelected
                  ? 'bg-primary/5 ring-1 ring-inset ring-primary/30'
                  : 'hover:bg-accent/50',
                !isCurrentMonth && 'opacity-40'
              )}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span
                  className={cn(
                    'flex items-center justify-center',
                    'w-6 h-6',
                    'text-xs font-medium',
                    isTodayDate
                      ? 'bg-primary text-primary-foreground'
                      : isSelected
                        ? 'text-primary font-semibold'
                        : 'text-foreground'
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>

              {/* Mobile: dots */}
              <div className="flex flex-wrap items-center gap-1 md:hidden">
                {dayPosts.slice(0, 3).map(post => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDayClick(day)
                      onPostClick(post)
                    }}
                    className="h-2 w-2 transition-transform hover:scale-125"
                    style={{ backgroundColor: post.clientColor }}
                    aria-label={`${post.clientName} ${format(post.scheduledAt, 'HH:mm')}`}
                  />
                ))}
                {dayPosts.length > 3 && (
                  <span className="text-[9px] font-medium text-muted-foreground">
                    +{dayPosts.length - 3}
                  </span>
                )}
              </div>

              {/* Desktop: mini-cards */}
              <div className="hidden flex-col gap-0.5 flex-1 min-h-0 md:flex">
                {visiblePosts.map(post => (
                  <CalendarPostCard
                    key={post.id}
                    post={{
                      id: post.id,
                      clientName: post.clientName,
                      clientColor: post.clientColor,
                      type: post.type,
                      caption: post.caption || '',
                      scheduledAt: post.scheduledAt,
                      status: post.status,
                      mediaUrls: (post.files || []).map(f => f.url),
                      profilePhoto: post.profilePhoto,
                    }}
                    onClick={() => {
                      onDayClick(day)
                      onPostClick(post)
                    }}
                  />
                ))}
                {extraCount > 0 && (
                  <span className="text-[10px] font-medium text-muted-foreground px-1 hover:text-foreground cursor-pointer">
                    +{extraCount} mais
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
