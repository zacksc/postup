import { Outlet, useLocation } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Sidebar, SidebarProvider, useSidebarCollapse } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { PostSaveProgressToast } from '@/components/post/PostSaveProgressToast'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'

function AppShellInner() {
  const { user } = useAuth()
  const location = useLocation()
  const avatarUrl = user?.user_metadata?.avatar_url || ''
  const pageKey = location.pathname + location.search
  const { collapsed } = useSidebarCollapse()

  return (
    <div className="flex h-dvh bg-canvas p-3 gap-3">
      {/* Sidebar flutuante */}
      <aside className={cn(
        "hidden md:flex flex-col z-50 shrink-0 rounded-2xl bg-panel border border-border/50 shadow-sm overflow-hidden transition-all duration-300",
        collapsed ? 'w-20' : 'w-64'
      )}>
        <Sidebar />
      </aside>

      {/* Conteúdo principal flutuante */}
      <div className="flex flex-col flex-1 rounded-2xl bg-panel border border-border/50 shadow-sm overflow-hidden min-w-0">
        <Header creatorAvatar={avatarUrl} />
        <main key={pageKey} className="flex-1 min-h-0 overflow-y-auto pb-16 md:pb-0">
          <Outlet />
        </main>
      </div>

      <BottomNav />
      <PostSaveProgressToast />
    </div>
  )
}

export function AppShell() {
  return (
    <SidebarProvider>
      <AppShellInner />
    </SidebarProvider>
  )
}
