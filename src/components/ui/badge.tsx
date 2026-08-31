/* eslint-disable react-refresh/only-export-components */
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import {
  Play,        // reels
  Images,      // carrossel
  Camera,      // foto
  Circle,      // stories
  Paintbrush,  // design
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Record com LucideIcon como valor
// LucideIcon é o tipo que o Lucide exporta para todos os ícones
// Isso garante que só ícones válidos do Lucide entram no objeto
const TYPE_ICONS: Record<string, LucideIcon> = {
  reels:     Play,
  carrossel: Images,
  foto:      Camera,
  stories:   Circle,
  design:    Paintbrush,
}

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full font-medium transition-colors select-none',
  {
    variants: {
      variant: {
        // Status do post
        rascunho:
          'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20',
        aguardando:
          'bg-warning/10 text-warning border border-warning/25',
        alteracao:
          'bg-destructive/10 text-destructive border border-destructive/25',
        aprovado:
          'bg-success/10 text-success border border-success/25',
        publicado:
          'bg-blue-500/10 text-blue-400 border border-blue-500/25',

        // Tipo de conteúdo
        tipo:
          'bg-primary/8 text-primary border border-primary/20',

        // Contador
        count:
          'bg-destructive text-destructive-foreground rounded-full tabular-nums',

        // Genéricos
        default:
          'bg-primary/10 text-primary border border-primary/20',
        secondary:
          'bg-secondary text-secondary-foreground border border-border',
        outline:
          'border border-border text-foreground bg-transparent',
      },

      size: {
        sm: 'px-2 py-0.5 text-[10px]',
        md: 'px-2.5 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  contentType?: keyof typeof TYPE_ICONS
}

function Badge({
  className,
  variant,
  size,
  contentType,
  children,
  ...props
}: BadgeProps) {

  // Busca o componente de ícone pelo tipo
  // Se contentType for 'reels', Icon vai ser o componente Play
  // Se não passar contentType, Icon fica undefined e nada é renderizado
  const Icon = contentType ? TYPE_ICONS[contentType] : undefined

  // O tamanho do ícone acompanha o tamanho do badge
  const iconSize = size === 'lg' ? 14 : 11

  return (
    <span
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {/* Renderiza o ícone só se existir */}
      {Icon && (
        <Icon
          size={iconSize}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  )
}

export { Badge, badgeVariants }