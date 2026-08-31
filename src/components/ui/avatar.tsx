import * as React from 'react'
import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cn, getInitials } from '@/lib/utils'

/**
 * Componentes Primitivos (Baseados no Radix UI)
 * Estilizados via Tailwind para garantir comportamento padrão de layout e acessibilidade.
 */

function Avatar({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        'relative flex shrink-0 overflow-hidden rounded-full',
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      className={cn('aspect-square h-full w-full object-cover', className)}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        'flex h-full w-full items-center justify-center rounded-full bg-muted',
        className
      )}
      {...props}
    />
  )
}

const AVATAR_SIZES: Record<string, string> = {
  xs: 'h-6 w-6 text-[9px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-xl',
}

interface AppAvatarProps {
  /** Nome para gerar as iniciais (ex: "Loja Aurora" -> "LA") */
  name: string
  /** URL da imagem do avatar */
  src?: string
  /** Cor de fundo em Hexadecimal para o fallback */
  color?: string
  /** Escala de tamanhos pré-definidos */
  size?: keyof typeof AVATAR_SIZES
  className?: string
}

/**
 * AppAvatar
 * Componente principal para exibição de avatares de usuários ou lojas.
 * Gerencia automaticamente o carregamento da imagem e fallback com iniciais.
 */
function AppAvatar({
  name,
  src,
  color,
  size = 'md',
  className,
}: AppAvatarProps) {
  const initials = getInitials(name)
  const sizeClass = AVATAR_SIZES[size]

  return (
    <Avatar className={cn(sizeClass, className)}>
      <AvatarImage src={src} alt={`Avatar de ${name}`} />
      
      <AvatarFallback
        className="font-semibold text-white"
        style={{ backgroundColor: color || '#374151' }}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}

export { Avatar, AvatarImage, AvatarFallback, AppAvatar }