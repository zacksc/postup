import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'
import { AppAvatar } from '@/components/ui/avatar'

export interface ClientStats {
  id: string;
  name: string;
  handle: string;
  color?: string;
  profilePhoto?: string;
}

export interface ClientCardProps {
  client: ClientStats;
  className?: string;
  onClick?: () => void;
}

export function ClientCard({ client, className, onClick }: ClientCardProps) {
  const { name, handle, color, profilePhoto } = client

  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3 p-4 rounded-xl border border-border bg-card lift hover:border-primary/40 hover:shadow-md cursor-pointer",
        className
      )}
    >
      <AppAvatar name={name} src={profilePhoto} color={color} size="md" />

      <div className="flex flex-col min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-foreground truncate">
          {name}
        </h3>
        <span className="text-xs text-muted-foreground truncate">
          {handle}
        </span>
      </div>

      <ChevronRight size={18} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 duration-300 shrink-0" />
    </div>
  )
}
