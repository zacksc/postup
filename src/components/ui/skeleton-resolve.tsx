import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SkeletonResolveProps {
  /** true enquanto os dados carregam → mostra o esqueleto. */
  loading: boolean
  skeleton: ReactNode
  children: ReactNode
  className?: string
  /** Duração do crossfade quando o conteúdo chega. */
  duration?: number
}

/**
 * Crossfade entre esqueleto e conteúdo real quando os dados chegam —
 * equivalente gratuito do SkeletonResolveList/SkeletonResolveRow do Motion UI.
 *
 * Enquanto `loading`, renderiza `skeleton` (monte os ossos com a MESMA
 * geometria do conteúdo para não haver layout shift). Ao carregar, o esqueleto
 * some e o conteúdo entra com fade. Reduz a "poluição" visual de skeletons
 * piscando na tela e dá a sensação de morph.
 */
export function SkeletonResolve({ loading, skeleton, children, className, duration = 0.35 }: SkeletonResolveProps) {
  return (
    <div className={cn('relative', className)}>
      <AnimatePresence initial={false} mode="wait">
        {loading ? (
          <motion.div
            key="skeleton"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: duration * 0.4 } }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {skeleton}
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
