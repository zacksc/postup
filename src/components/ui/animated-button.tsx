import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CircleCheck } from 'lucide-react'
import { type VariantProps } from 'class-variance-authority'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Botão com feedback animado além do `active:scale` padrão:
 * - Ripple no ponto do clique + leve escala (`whileTap`).
 * - `loading`: preenche o botão como barra de progresso. Com `progress` (0..1)
 *   a barra acompanha o valor real; sem progresso vira um shimmer indeterminado.
 * - `success`: rajada de confetes contida DENTRO do botão + check com pop.
 */
type AnimatedButtonProps = React.ComponentProps<'button'> & {
  variant?: VariantProps<typeof buttonVariants>['variant']
  size?: VariantProps<typeof buttonVariants>['size']
  loading?: boolean
  /** 0..1 — largura da barra quando `loading`. Omitir = barra indeterminada. */
  progress?: number
  success?: boolean
}

const CONFETTI_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4']

function seededRandom(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function AnimatedButton({
  className,
  variant = 'default',
  size = 'default',
  loading = false,
  progress,
  success = false,
  disabled,
  children,
  onPointerDown,
  onDrag,
  onDragStart,
  onDragEnd,
  onAnimationStart,
  onAnimationEnd,
  onAnimationIteration,
  style,
  ...props
}: AnimatedButtonProps) {
  const [ripples, setRipples] = React.useState<{ id: number; x: number; y: number; size: number }[]>([])
  const [burstKey, setBurstKey] = React.useState(0)
  const prevSuccess = React.useRef(false)

  void onDrag; void onDragStart; void onDragEnd
  void onAnimationStart; void onAnimationEnd; void onAnimationIteration

  React.useEffect(() => {
    if (success && !prevSuccess.current) setBurstKey(k => k + 1)
    prevSuccess.current = success
  }, [success])

  const particles = React.useMemo(() =>
    Array.from({ length: 14 }, (_, i) => {
      const rng = seededRandom(burstKey * 1000 + i)
      const angle = (i / 14) * Math.PI * 2 + rng * 0.6
      const dist = 16 + rng * 22
      return {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        size: 3 + rng * 4,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: rng * 0.06,
        rotate: (rng - 0.5) * 220,
      }
    }),
  [burstKey])

  function spawnRipple(e: React.PointerEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height) * 2.2
    const ripple = { id: Date.now() + Math.random(), x: e.clientX - rect.left, y: e.clientY - rect.top, size }
    setRipples(rs => [...rs, ripple])
    setTimeout(() => setRipples(rs => rs.filter(r => r.id !== ripple.id)), 600)
  }

  return (
    <motion.button
      data-slot="animated-button"
      data-variant={variant}
      data-size={size}
      whileTap={{ scale: 0.96 }}
      whileHover={{ y: -1 }}
      disabled={disabled || loading}
      onPointerDown={e => {
        if (e.button === 0) spawnRipple(e)
        onPointerDown?.(e)
      }}
      className={cn(
        buttonVariants({ variant, size, className }),
        'relative overflow-hidden isolate',
      )}
      style={{ ...style, opacity: loading ? 1 : style?.opacity }}
      {...props}
    >
      {/* Ripple do clique */}
      <AnimatePresence>
        {ripples.map(r => (
          <motion.span
            key={r.id}
            initial={{ scale: 0, opacity: 0.35 }}
            animate={{ scale: 1, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="pointer-events-none absolute rounded-full bg-white/60"
            style={{ left: r.x, top: r.y, width: r.size, height: r.size, translateX: '-50%', translateY: '-50%' }}
          />
        ))}
      </AnimatePresence>

      {/* Flash de sucesso no fundo */}
      <AnimatePresence>
        {success && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute inset-0 bg-success/25"
          />
        )}
      </AnimatePresence>

      {/* Conteúdo */}
      <span className={cn('relative inline-flex items-center justify-center gap-2 z-10', (loading || success) && 'opacity-70')}>
        {children}
      </span>

      {/* Check de sucesso */}
      <AnimatePresence>
        {success && (
          <motion.span
            data-testid="animated-success-check"
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            className="absolute inset-0 flex items-center justify-center text-success-foreground z-10"
          >
            <CircleCheck size={18} />
          </motion.span>
        )}
      </AnimatePresence>

      {/* Barra de progresso (loading) */}
      <span data-testid="animated-progress-bar" className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[3px] overflow-hidden rounded-b-[inherit]">
        {loading && (
          progress != null ? (
            <motion.span
              initial={false}
              animate={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }}
              transition={{ ease: 'easeOut', duration: 0.2 }}
              className="absolute inset-y-0 left-0 bg-current/80"
            />
          ) : (
            <motion.span
              animate={{ x: ['-100%', '100%'] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
              className="absolute inset-y-0 w-1/2 bg-current/80"
            />
          )
        )}
      </span>

      {/* Confetes (sucesso) */}
      <AnimatePresence>
        {success && burstKey > 0 && (
          <motion.span
            key={burstKey}
            data-testid="animated-confetti"
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          >
            {particles.map((p, i) => (
              <motion.span
                key={i}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.4, rotate: p.rotate }}
                transition={{ duration: 0.7, delay: p.delay, ease: 'easeOut' }}
                className="absolute rounded-[1px]"
                style={{ width: p.size, height: p.size, backgroundColor: p.color }}
              />
            ))}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

export { AnimatedButton }
