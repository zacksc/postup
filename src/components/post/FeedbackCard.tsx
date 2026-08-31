import { cn } from '@/lib/utils'
import { AlertCircle, ArrowRight, Video, Layers, Image as ImageIcon } from 'lucide-react'

// O Contrato de dados do Feedback
export interface Feedback {
  id: string;
  client?: {
    name?: string;
    color?: string;
  };
  post?: {
    id?: string;
    title?: string;
    type?: 'reels' | 'carrossel' | 'foto' | 'stories' | 'design';
    date?: string;
  };
  message?: string;
  isUrgent?: boolean;
}

export interface FeedbackCardProps {
  feedback: Feedback;
  onMove?: () => void; // Função disparada ao clicar no botão de mover
  className?: string;
  onClick?: () => void; // Função disparada ao clicar no card
}

// Reutilizamos a lógica de ícones
const typeIcons = {
  reels: Video,
  carrossel: Layers,
  foto: ImageIcon,
  stories: Video,
  design: ImageIcon,
}

export function FeedbackCard({ feedback, onMove, className, onClick }: FeedbackCardProps) {
  const { client, post, message, isUrgent } = feedback
  const TypeIcon = typeIcons[(post?.type || 'foto') as keyof typeof typeIcons] || ImageIcon

  return (
    <div 
    onClick={onClick}
    className={cn(
      // relative é necessário para o posicionamento absoluto da borda esquerda
      "relative flex flex-col gap-3 p-4 pl-5 rounded-xl border border-border bg-card shadow-sm transition-all hover:shadow-md",
      className
    )}>

      {/* 2. CABEÇALHO: Cliente e Post */}
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-0.5 min-w-0 pr-4">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">
            {client?.name || '—'}
          </span>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground truncate mt-0.5">
            <TypeIcon size={14} className="text-muted-foreground shrink-0" />
            <span className="truncate">{post?.title || 'Sem legenda'}</span>
          </div>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground shrink-0 mt-1">
          {post?.date || '—'}
        </span>
      </div>

      {/* 3. MENSAGEM DO CLIENTE */}
      {/* Usamos border-l-2 para simular um "quote" (citação) */}
      <p className="text-sm text-muted-foreground italic line-clamp-3 pl-2 border-l-2 border-muted my-1">
        "{message || 'Sem comentário'}"
      </p>

      {/* 4. RODAPÉ: Urgência e Ação */}
      <div className="flex items-center justify-between mt-1">
        {isUrgent ? (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-destructive/10 text-destructive text-[10px] font-bold uppercase tracking-wider rounded-md">
            <AlertCircle size={12} />
            Urgente
          </div>
        ) : (
          <div /> /* Spacer invisível para manter o botão à direita usando justify-between */
        )}

        <button
          onClick={onMove}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground text-xs font-bold rounded-lg transition-colors cursor-pointer"
        >
          Revisão
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}