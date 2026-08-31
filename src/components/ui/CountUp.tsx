import { useEffect, useRef } from 'react'
import { animate, motion, useInView, useMotionValue, useTransform } from 'framer-motion'

interface CountUpProps {
  value: number
  className?: string
  duration?: number
}

export function CountUp({ value, className, duration = 0.7 }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -40px 0px' })
  const count = useMotionValue(0)
  const display = useTransform(count, v => Math.round(v).toLocaleString('pt-BR'))

  useEffect(() => {
    if (!inView) return
    const controls = animate(count, value, { duration, ease: [0.16, 1, 0.3, 1] })
    return controls.stop
  }, [inView, value, duration, count])

  return <motion.span ref={ref} className={className}>{display}</motion.span>
}
