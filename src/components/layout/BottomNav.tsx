import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { NAV_ITEMS } from '@/lib/navigation'
import { Button } from '@/components/ui/button'
import { useUnreadChat } from '@/hooks/use-unread-chat'
import { cn } from '@/lib/utils'

export function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { totalUnread } = useUnreadChat()
  const isNewPost = location.pathname === '/posts/novo'

  return (
    <>
      {/* Botão Flutuante de Novo Post (Apenas Mobile) — oculto na própria tela de novo post */}
      {!isNewPost && (
        <Button
          onClick={() => navigate('/posts/novo')}
          className="md:hidden fixed bottom-20 right-4 z-50 rounded-full w-14 h-14 shadow-lg shadow-primary/25"
          size="icon"
        >
          <Plus size={24} />
        </Button>
      )}

      <nav
        className={cn(
          'fixed bottom-0 left-0 right-0 z-40',
          'flex items-center justify-around',
          'h-16',
          'bg-card border-t border-border',
          'pb-safe',
          'md:hidden'
        )}
      >
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path)

          const Icon = item.icon
          const badgeCount = item.path === '/chat' ? totalUnread : 0

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center gap-1',
                'flex-1 h-full',
                'relative',
                'transition-colors duration-150',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <span className="relative">
                <Icon size={22} strokeWidth={isActive ? 2 : 1.75} />
                {badgeCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center leading-none shadow">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}