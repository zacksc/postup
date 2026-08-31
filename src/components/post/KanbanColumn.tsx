import { cn } from '@/lib/utils'
import { FeedbackCard, type Feedback } from './FeedbackCard'

interface KanbanColumnProps {
  columnId?: string; // Opcional
  title: string;
  colorClass: string;
  feedbacks?: Feedback[]; // Opcional
  onDropFeedback?: (e: React.DragEvent, columnId: string) => void; // Opcional,
  onCardClick?: (feedback: Feedback) => void; // Função disparada ao clicar no card
}

export function KanbanColumn({ 
  columnId = 'default', 
  title, 
  colorClass, 
  feedbacks = [], // Se vier vazio ou undefined, ele vira um array vazio automaticamente
  onDropFeedback,
  onCardClick,
}: KanbanColumnProps) {
  return (
    <div 
      className="flex flex-col w-[320px] shrink-0 bg-secondary/20 border border-border rounded-2xl h-full max-h-full"
      onDragOver={(e) => e.preventDefault()} 
      onDrop={(e) => {
        // Só executa a função se ela foi passada no componente pai
        if (onDropFeedback) onDropFeedback(e, columnId)
      }}
    >
      <div className="flex items-center gap-2 p-4 border-b border-border/50">
        <div className={cn("w-3 h-3 rounded-full", colorClass)} />
        <h3 className="font-bold text-sm text-foreground">{title}</h3>
        <span className="ml-auto text-xs font-medium text-muted-foreground bg-background px-2 py-0.5 rounded-full">
          {/* Lê o length com segurança */}
          {feedbacks.length}
        </span>
      </div>

      <div className="flex flex-col gap-3 p-3 overflow-y-auto min-h-[150px]">
        {feedbacks.map(fb => (
          <div 
            key={fb.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('feedbackId', fb.id)
              e.dataTransfer.setData('sourceColumn', columnId)
            }}
            className="cursor-grab active:cursor-grabbing"
          >
            <FeedbackCard 
            key={fb.id}
            onClick={() => onCardClick?.(fb)} // Passa a função para abrir o modal
            feedback={fb} />
          </div>
        ))}
      </div>
    </div>
  )
}