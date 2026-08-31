import { Link } from 'react-router-dom'
import { Bell, LogOut } from 'lucide-react'
import { AppAvatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNotifications } from '@/hooks/use-notifications'
import { NotificationDropdown } from '@/components/layout/NotificationDropdown'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Breadcrumb } from '@/components/layout/Breadcrumb'
import { useAuth } from '@/hooks/use-auth'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface HeaderProps {
  creatorName?: string
  creatorAvatar?: string
}

export function Header({
  creatorName,
  creatorAvatar,
}: HeaderProps) {
  const { user, signOut } = useAuth()
  const name = creatorName || user?.user_metadata?.full_name || 'Usuário'
  const avatar = creatorAvatar || user?.user_metadata?.avatar_url || ''
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications()

  return (
    <header
      className={cn(
        'flex items-center justify-between',
        'h-16 px-6',
        'border-b border-border/50',
        'w-full shrink-0'
      )}
    >
      {/* Left: Title / Breadcrumb */}
      <Breadcrumb />

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
          >
            <Bell size={18} />
          </button>

          <AnimatePresence>
            {isPanelOpen && (
              <motion.div
                key="notification-panel"
                initial={{ opacity: 0, scale: 0.96, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -4 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="absolute top-full right-0 mt-2 z-50 origin-top-right"
              >
                <NotificationDropdown
                  notifications={notifications}
                  markAsRead={markAsRead}
                  markAllAsRead={markAllAsRead}
                  clearAll={clearAll}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {isPanelOpen ? null : unreadCount > 0 && (
            <span className="absolute top-0 right-0 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center pointer-events-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>

        <ThemeToggle />

        {/* Avatar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="outline-none ml-1">
              <AppAvatar
                name={name}
                src={avatar}
                size="sm"
                color="#9900ff"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[160px] rounded-xl">
            <DropdownMenuItem asChild>
              <Link to="/perfil" className="cursor-pointer">Perfil</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/configuracoes" className="cursor-pointer">Configurações</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={signOut} className="text-destructive cursor-pointer gap-2">
              <LogOut size={14} /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
