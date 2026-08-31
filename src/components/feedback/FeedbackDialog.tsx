import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { sanitize } from '@/lib/utils'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { MessageSquare } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

interface Props {
  postId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function FeedbackDialog({ postId, open, onOpenChange, onSuccess }: Props) {
  const [fbText, setFbText] = useState('')
  const { user } = useAuth()

  async function handleSend() {
    if (!fbText.trim()) return
    try {
      await supabase.from('post_feedbacks').insert([
        { post_id: postId, author_role: 'gestor', author_name: 'Gestor', message: sanitize(fbText), type: 'message' },
      ])
      await supabase.from('posts').update({ status: 'alteracao', user_id: user?.id }).eq('id', postId)
      try {
        await supabase.from('posts').update({ is_feedback: true, user_id: user?.id }).eq('id', postId)
      } catch { /* tag é cosmética */ }
      setFbText('')
      onOpenChange(false)
      onSuccess()
      toast.success('Alteração solicitada')
    } catch {
      toast.error('Erro ao enviar feedback')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setFbText(''); onOpenChange(v) }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><MessageSquare size={18} /> Solicitar alteração</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <label className="text-xs font-medium">O que precisa ser alterado?</label>
          <textarea
            value={fbText}
            onChange={e => setFbText(e.target.value)}
            placeholder="Descreva a alteração com detalhes..."
            rows={4}
            className="w-full bg-secondary/30 border border-border rounded-lg p-3 text-sm resize-none"
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { setFbText(''); onOpenChange(false) }}>Cancelar</Button>
          <Button onClick={handleSend} disabled={!fbText.trim()}>Enviar alteração</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
