import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Plus, PanelLeftClose, PanelLeftOpen, Settings, Home, CalendarDays, Users, ListTodo, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUnreadChat } from '@/hooks/use-unread-chat'
import { Brand } from '@/components/layout/Brand'
import { cn } from '@/lib/utils'
import { useState, useCallback, createContext, useContext, type ReactNode } from 'react'

interface SidebarContextType {
  collapsed: boolean
  toggle: () => void
}

const SidebarContext = createContext<SidebarContextType>({ collapsed: false, toggle: () => {} })

// eslint-disable-next-line react-refresh/only-export-components
export function useSidebarCollapse() {
  return useContext(SidebarContext)
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const toggle = useCallback(() => setCollapsed(c => !c), [])
  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  )
}

interface NavItemProps {
  to: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  label: string
  badge?: number
  isActive?: boolean
}

function NavItem({ to, icon: Icon, label, badge, isActive }: NavItemProps) {
  const { collapsed } = useSidebarCollapse()
  return (
    <Link
      to={to}
      className={cn(
        'flex items-center rounded-lg px-2.5 py-3 text-[13.5px] font-medium transition-colors relative',
        collapsed ? 'justify-center' : 'gap-3',
        isActive
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-secondary'
      )}
      title={collapsed ? label : undefined}
    >
      <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{label}</span>
          {badge !== undefined && badge > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-secondary px-1.5 text-[11px] font-medium text-muted-foreground">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </>
      )}
      {collapsed && badge !== undefined && badge > 0 && (
        <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-semibold flex items-center justify-center">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  )
}

function NavGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const { collapsed } = useSidebarCollapse()
  if (collapsed) return <div className="flex flex-col gap-0.5">{children}</div>
  return (
    <div className="flex flex-col gap-0.5">
      <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  )
}

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { totalUnread } = useUnreadChat()
  const { collapsed, toggle } = useSidebarCollapse()

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <div className={cn("flex h-full flex-col p-4 transition-all duration-300", collapsed ? 'items-center' : '-translate-y-7.5')}>
      {/* Logo + Toggle */}
      <div className={cn("mb-4 flex items-center gap-2", collapsed ? 'justify-center' : 'mb-1 justify-between')}>
        {!collapsed ? (
          <Brand variant="text" height={90} />
        ) : (
          <button
            onClick={toggle}
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary transition-colors"
            title="Expandir menu"
          >
            <PanelLeftOpen size={18} />
          </button>
        )}
        {!collapsed && (
          <button
            onClick={toggle}
            className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-secondary transition-colors"
            title="Recolher menu"
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      {/* Novo Post Button */}
      <Button
        onClick={() => navigate('/posts/novo')}
        className={cn(
          "mb-4 h-10 justify-center gap-2 rounded-xl bg-foreground text-sm font-medium text-primary-foreground hover:bg-foreground/80 shadow-sm",
          collapsed ? 'w-10 px-0' : 'w-full px-4'
        )}
        title="Novo Post"
      >
        <Plus size={16} strokeWidth={2.5} />
        {!collapsed && 'Novo Post'}
      </Button>

      {/* Navigation Groups */}
      <div className="flex flex-col gap-4 overflow-y-auto flex-1 w-full">
        <NavGroup title="Operações">
          <NavItem to="/home" icon={Home} label="Home" isActive={isActive('/home') || location.pathname === '/'} />
          <NavItem to="/cronograma" icon={CalendarDays} label="Cronograma" isActive={isActive('/cronograma')} />
          <NavItem to="/clientes" icon={Users} label="Clientes" isActive={isActive('/clientes')} />
          <NavItem to="/tarefas" icon={ListTodo} label="Tarefas" isActive={isActive('/tarefas')} />
          <NavItem to="/chat" icon={MessageSquare} label="Chat" badge={totalUnread} isActive={isActive('/chat')} />
        </NavGroup>
      </div>

      {/* Footer */}
      <div className={cn("mt-auto flex flex-col gap-0.5 border-t border-border pt-3 w-full", collapsed && 'items-center')}>
        <Link
          to="/configuracoes"
          className={cn(
            'flex items-center rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors',
            collapsed ? 'justify-center' : 'gap-2.5',
            isActive('/configuracoes')
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-secondary'
          )}
          title={collapsed ? 'Ajustes' : undefined}
        >
          <Settings size={18} strokeWidth={2} />
          {!collapsed && <span>Ajustes</span>}
        </Link>
      </div>
    </div>
  )
}
