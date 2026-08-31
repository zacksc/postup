import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface RevealProps {
  children: ReactNode
  className?: string
  delay?: number
  y?: number
}

export function Reveal({ children, className, delay = 0, y = 16 }: RevealProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -60px 0px' }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  )
}
