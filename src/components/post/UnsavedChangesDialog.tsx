import { useState } from 'react'
import { FileText, Loader2, LogOut, Pencil } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { AnimatedButton } from '@/components/ui/animated-button'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  description: string
  /** "Sair mesmo assim" (vermelho) */
  onLeave: () => void
  /** "Continuar editando" (cor do app) */
  onContinue: () => void
  /** "Salvar como rascunho" (cinza) — só exibido quando informado (tela de programar post) */
  onSaveDraft?: () => Promise<boolean | void> | boolean | void
  leaveLabel?: string
  continueLabel?: string
  draftLabel?: string
}

/**
 * Diálogo genérico de "alterações não salvas". Aparece quando uma navegação
 * interna é bloqueada e oferece: sair mesmo assim (vermelho), continuar
 * editando (cor do app) e, quando aplicável, salvar como rascunho (cinza).
 */
export function UnsavedChangesDialog({
  open,
  onClose,
  title,
  description,
  onLeave,
  onContinue,
  onSaveDraft,
  leaveLabel = 'Sair mesmo assim',
  continueLabel = 'Continuar editando',
  draftLabel = 'Salvar como rascunho',
}: Props) {
  const [savingDraft, setSavingDraft] = useState(false)

  async function saveDraft() {
    setSavingDraft(true)
    try {
      const result = await onSaveDraft?.()
      // Retorno false = ação falhou; mantém o diálogo aberto.
      if (result === false) return
      onClose()
    } finally {
      setSavingDraft(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <AnimatedButton variant="destructive" onClick={onLeave} className="w-full">
            <LogOut size={16} />
            {leaveLabel}
          </AnimatedButton>

          <AnimatedButton variant="default" onClick={onContinue} className="w-full">
            <Pencil size={16} />
            {continueLabel}
          </AnimatedButton>

          {onSaveDraft && (
            <AnimatedButton variant="secondary" loading={savingDraft} onClick={() => void saveDraft()} className="w-full">
              {savingDraft ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
              {draftLabel}
            </AnimatedButton>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
