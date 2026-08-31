import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

const LABEL_MAP: Record<string, (params?: Record<string, string>) => string> = {
  'cronograma': () => 'Cronograma',
  'clientes': () => 'Clientes',
  'feedbacks': () => 'Tarefas',
  'tarefas': () => 'Tarefas',
  'novo': () => 'Novo',
  'perfil': () => 'Perfil',
  'lab': () => 'Ajustes',
  'grid': () => 'Grid Instagram',
  'historico': () => 'Histórico',
}

export function Breadcrumb() {
  const { pathname } = useLocation()

  if (pathname === '/') return null

  const segments = pathname.split('/').filter(Boolean)

  const smartLabel = (seg: string, prev: string | undefined): string => {
    if (prev === 'posts' && seg !== 'novo') return 'Visualizar Post'
    if (prev === 'posts' && seg === 'novo') return 'Programar Post'
    if (prev === 'clients') return 'Dossiê'
    if (prev === 'grid') return 'Grid Instagram'
    if (prev === 'review') return 'Revisão do Cliente'
    const fn = LABEL_MAP[seg]
    if (fn) return fn()
    return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ')
  }

  return (
    <nav className="hidden md:flex items-center gap-1 text-xs text-muted-foreground min-w-0">
      <Link to="/home" className="hover:text-foreground transition-colors shrink-0">
        <Home size={14} />
      </Link>
      {segments.map((seg, i) => {
        const path = '/' + segments.slice(0, i + 1).join('/')
        const isLast = i === segments.length - 1
        const label = smartLabel(seg, segments[i - 1])

        return (
          <span key={path} className="flex items-center gap-1 min-w-0">
            <ChevronRight size={12} className="shrink-0" />
            {isLast ? (
              <span className="text-foreground font-medium truncate">{label}</span>
            ) : (
              <Link to={path} className="hover:text-foreground transition-colors truncate">
                {label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
