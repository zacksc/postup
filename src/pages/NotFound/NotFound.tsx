import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'

export default function NotFoundPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
      <p className="text-lg text-muted-foreground">Página não encontrada</p>
      <Button onClick={() => navigate(user ? '/home' : '/')} variant="outline" className="gap-2">
        <ArrowLeft size={16} /> Voltar ao início
      </Button>
    </div>
  )
}
