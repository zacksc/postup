import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Evita problemas de renderização inconsistente antes da hidratação
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="w-8 h-8 rounded-lg shrink-0 border border-transparent">
        <div className="w-4 h-4" />
      </Button>
    )
  }

  const isDark = theme === 'dark'

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground shrink-0 transition-transform active:scale-90 duration-200 hover:bg-secondary"
      aria-label="Alternar tema"
    >
      {isDark ? (
        <Sun className="size-[17px] text-amber-400 rotate-0 scale-100 transition-all dark:rotate-0 dark:scale-100 duration-300" />
      ) : (
        <Moon className="size-[17px] text-foreground rotate-0 scale-100 transition-all duration-300" />
      )}
    </Button>
  )
}
