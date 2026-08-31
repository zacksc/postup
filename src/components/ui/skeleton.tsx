import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
  /** 'pulse' = fade clássico; 'shimmer' = varredura de luz (padrão, igual ao loader-skeleton do Motion UI). */
  variant?: 'pulse' | 'shimmer'
}

export function Skeleton({ className, variant = 'shimmer' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'rounded-md bg-muted',
        variant === 'pulse' ? 'animate-pulse' : 'skeleton-shimmer',
        className
      )}
    />
  )
}
