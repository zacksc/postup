import { Badge } from '@/components/ui/badge'

export type PostStatus =
  | 'rascunho'
  | 'aguardando'
  | 'alteracao'
  | 'aprovado'
  | 'publicado'

export type PostType =
  | 'reels'
  | 'carrossel'
  | 'foto'
  | 'stories'
  | 'design'

// Record<PostStatus, string> garante que todo status tem um label
// Se adicionar um status novo no tipo, TypeScript exige o label aqui também
const STATUS_LABELS: Record<PostStatus, string> = {
  rascunho:   'Rascunho',
  aguardando: 'Aguardando',
  alteracao:  'Em alteração',
  aprovado:   'Aprovado',
  publicado:  'Publicado',
}

const TYPE_LABELS: Record<PostType, string> = {
  reels:     'Reels',
  carrossel: 'Carrossel',
  foto:      'Foto',
  stories:   'Stories',
  design:    'Design',
}

interface StatusBadgeProps {
  status: PostStatus
  size?: 'sm' | 'md' | 'lg'
}

// StatusBadge — recebe o status, encontra a variante e o label certos
// Não precisa saber qual cor usar — o badge.tsx já sabe
export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  return (
    <Badge variant={status} size={size}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}

interface TypeBadgeProps {
  type: PostType
  size?: 'sm' | 'md' | 'lg'
}

// TypeBadge — passa contentType para o Badge renderizar o ícone certo
export function TypeBadge({ type, size = 'md' }: TypeBadgeProps) {
  return (
    <Badge variant="tipo" size={size} contentType={type}>
      {TYPE_LABELS[type]}
    </Badge>
  )
}