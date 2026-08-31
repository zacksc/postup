import logoPostup from '@/assets/logoPostup.svg'
import logoPostuptext from '@/assets/logoPostuptext.svg'

// eslint-disable-next-line react-refresh/only-export-components
export { logoPostup, logoPostuptext }

interface BrandProps {
  variant?: 'full' | 'icon' | 'text'
  className?: string
  height?: number
  onClick?: () => void
}

export function Brand({ variant = 'text', className = '', height = 10, onClick }: BrandProps) {
  const size = height

  if (variant === 'icon') {
    return (
      <img
        src={logoPostup}
        alt="PostUp"
        className={className}
        onClick={onClick}
        style={{ width: `${size}px`, height: `${size}px`, objectFit: 'contain' }}
      />
    )
  }

  if (variant === 'full') {
    return (
      <img
        src={logoPostuptext}
        alt="PostUp"
        className={className}
        onClick={onClick}
        style={{ height: `${size}px`, width: 'auto' }}
      />
    )
  }

  return (
    <img
      src={logoPostuptext}
      alt="PostUp"
      className={className}
      onClick={onClick}
      style={{ height: `${size}px`, width: 'auto' }}
    />
  )
}