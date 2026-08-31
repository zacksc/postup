import { useState, useEffect, useMemo, useRef } from 'react'
import { isSameDay, isToday, format, getHours, getMinutes } from 'date-fns'
import { Play, Images, Camera, Circle, Paintbrush, type LucideIcon } from 'lucide-react'
import { MediaPreview } from '@/components/post/MediaPreview'
import { resolveThumbMedia, cn } from '@/lib/utils'

const TYPE_ICONS: Record<string, LucideIcon> = {
  reels: Play,
  carrossel: Images,
  foto: Camera,
  stories: Circle,
  design: Paintbrush,
}

const HOUR_HEIGHT = 64
const HALF_HOUR = HOUR_HEIGHT / 2
const START_HOUR = 7
const END_HOUR = 23
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i)

const STATUS_BG: Record<string, string> = {
  publicado: 'bg-blue-500/15',
  aprovado: 'bg-emerald-500/15',
  aguardando: 'bg-orange-500/15',
  alteracao: 'bg-red-500/15',
  rascunho: 'bg-muted-foreground/15',
}

const STATUS_BORDER: Record<string, string> = {
  publicado: 'border-blue-500/30',
  aprovado: 'border-emerald-500/30',
  aguardando: 'border-orange-500/30',
  alteracao: 'border-red-500/30',
  rascunho: 'border-muted-foreground/30',
}

interface WeekTimePost {
  id: string
  clientName: string
  clientColor: string
  type: string
  caption: string
  scheduledAt: Date
  status: string
  mediaUrls: string[]
  profilePhoto?: string
}

interface WeekTimeGridProps {
  days: Date[]
  posts: WeekTimePost[]
  onPostClick: (id: string) => void
  onSlotClick: (day: Date, hour: number) => void
}

export function WeekTimeGrid({ days, posts, onPostClick, onSlotClick }: WeekTimeGridProps) {
  const [now, setNow] = useState(new Date())
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  // Auto-scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current) {
      const nowTop = ((getHours(now) - START_HOUR) * HOUR_HEIGHT) - 100
      scrollRef.current.scrollTop = Math.max(0, nowTop)
    }
  }, [now])

  const nowLineTop = useMemo(() => {
    const h = getHours(now)
    const m = getMinutes(now)
    return ((h - START_HOUR) * HOUR_HEIGHT) + (m / 60) * HOUR_HEIGHT
  }, [now])

  const showNowLine = now.getHours() >= START_HOUR && now.getHours() <= END_HOUR

  function getPostPosition(post: WeekTimePost) {
    const h = getHours(post.scheduledAt)
    const m = getMinutes(post.scheduledAt)
    const top = ((h - START_HOUR) * HOUR_HEIGHT) + (m / 60) * HOUR_HEIGHT
    return Math.max(0, top)
  }

  function getPostsForDay(day: Date) {
    return posts
      .filter(p => isSameDay(p.scheduledAt, day))
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
  }

  function handleSlotClick(day: Date, e: React.MouseEvent) {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top + (scrollRef.current?.scrollTop || 0)
    const hour = START_HOUR + Math.floor(y / HOUR_HEIGHT)
    const halfHour = y % HOUR_HEIGHT < HALF_HOUR ? 0 : 30
    const clampedHour = Math.max(START_HOUR, Math.min(END_HOUR, hour))
    onSlotClick(day, clampedHour + halfHour / 60)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Day headers */}
      <div className="grid grid-cols-8 border-b border-border shrink-0">
        <div className="w-16 shrink-0" />
        {days.map(day => {
          const today = isToday(day)
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "py-2 text-center border-l border-border",
                today && "bg-primary/5"
              )}
            >
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block">
                {format(day, 'EEE', { locale: undefined })}
              </span>
              <span className={cn(
                "text-sm font-semibold",
                today ? "text-primary" : "text-foreground"
              )}>
                {format(day, 'd')}
              </span>
            </div>
          )
        })}
      </div>

      {/* Time grid — scrollable with mouse wheel */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-0"
      >
        <div className="grid grid-cols-8 relative" style={{ height: (HOURS.length * HOUR_HEIGHT) }}>
          {/* Time gutter */}
          <div className="w-16 shrink-0 relative">
            {HOURS.map(h => (
              <div
                key={h}
                className="absolute left-0 right-0 flex items-start justify-end pr-2 -translate-y-1/2"
                style={{ top: (h - START_HOUR) * HOUR_HEIGHT }}
              >
                <span className="text-[10px] text-muted-foreground font-mono">
                  {String(h).padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map(day => {
            const dayPosts = getPostsForDay(day)
            const today = isToday(day)

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "relative border-l border-border cursor-pointer",
                  today && "bg-primary/[0.02]"
                )}
                onClick={(e) => handleSlotClick(day, e)}
              >
                {/* Hour lines */}
                {HOURS.map(h => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-border/50 hover:bg-primary/[0.03] transition-colors"
                    style={{ top: (h - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                  >
                    <div className="absolute left-0 right-0 border-t border-border/30" style={{ top: HALF_HOUR }} />
                  </div>
                ))}

                {/* Posts */}
                {dayPosts.map(post => {
                  const top = getPostPosition(post)
                  const Icon = TYPE_ICONS[post.type.toLowerCase()] || Camera
                  const { url: thumbUrl, poster: thumbPoster } = resolveThumbMedia(post.mediaUrls)

                  return (
                    <button
                      key={post.id}
                      onClick={(e) => { e.stopPropagation(); onPostClick(post.id) }}
                      className={cn(
                        "absolute left-0.5 right-0.5 p-1 text-left overflow-hidden hover:opacity-85 transition-opacity z-10 border",
                        STATUS_BG[post.status] || 'bg-muted-foreground/15',
                        STATUS_BORDER[post.status] || 'border-muted-foreground/30',
                      )}
                      style={{
                        top: `${top}px`,
                        height: `${HOUR_HEIGHT - 2}px`,
                      }}
                    >
                      <div className="flex items-center gap-1 min-w-0">
                        {thumbUrl && (
                          <div className="w-5 h-5 shrink-0 overflow-hidden bg-muted">
                            <MediaPreview url={thumbUrl} poster={thumbPoster} thumbnail className="w-full h-full object-cover" />
                          </div>
                        )}
                        <span className="text-[9px] font-semibold truncate" style={{ color: post.clientColor }}>
                          {post.clientName.split(' ')[0]}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Icon size={8} className="text-muted-foreground shrink-0" />
                        <span className="text-[8px] font-mono text-muted-foreground">
                          {format(post.scheduledAt, 'HH:mm')}
                        </span>
                      </div>
                      <span className="text-[8px] text-muted-foreground line-clamp-1 mt-0.5 block">
                        {post.caption?.split(' ').slice(0, 3).join(' ')}
                      </span>
                    </button>
                  )
                })}

                {/* Now line */}
                {today && showNowLine && (
                  <div
                    className="absolute left-0 right-0 z-20 pointer-events-none"
                    style={{ top: `${nowLineTop}px` }}
                  >
                    <div className="h-0.5 bg-red-500 w-full" />
                    <div className="w-2 h-2 bg-red-500 -translate-y-1 -translate-x-0.5" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
