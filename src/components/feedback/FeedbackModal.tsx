import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"

interface FeedbackModalProps {
  feedback: {
    id: string
    message: string
    post: { title: string }
  } | null
  isOpen: boolean
  onClose: () => void
  onUpdateStatus: (id: string, newStatus: string) => void
}

export function FeedbackModal({ feedback, isOpen, onClose, onUpdateStatus }: FeedbackModalProps) {
  if (!feedback) return null

  // Função disparada ao mudar o status
  const handleStatusChange = (newStatus: string) => {
    onUpdateStatus(feedback.id, newStatus)
    onClose() // Fecha o modal após a alteração
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Feedback: {feedback.post.title}</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-1 gap-6 overflow-hidden mt-4">
          {/* Lado Esquerdo: Preview */}
          <div className="w-1/2 bg-muted rounded-xl flex items-center justify-center p-4">
            <span className="text-muted-foreground text-sm">Preview: {feedback.post.title}</span>
          </div>

          {/* Lado Direito: Ações */}
          <div className="w-1/2 flex flex-col gap-6">
            <div>
              <h4 className="text-sm font-bold mb-2">Solicitação do Cliente</h4>
              <p className="text-sm bg-secondary/50 p-3 rounded-lg">{feedback.message}</p>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-bold">Notificar:</h4>
              <div className="flex gap-4">
                 {['Cliente', 'Liderança', 'Equipe'].map((pessoa) => (
                   <label key={pessoa} className="flex items-center gap-2 text-sm cursor-pointer">
                     <Checkbox /> {pessoa}
                   </label>
                 ))}
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé de Ações */}
        <div className="border-t pt-4 flex justify-between items-center">
            <Select onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Mudar Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aguardando">Aguardando Resposta</SelectItem>
                <SelectItem value="alteracao">Em Alteração</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="publicados">Publicados</SelectItem>
              </SelectContent>
            </Select>
            
            <button onClick={onClose} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-bold">
              Cancelar
            </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}