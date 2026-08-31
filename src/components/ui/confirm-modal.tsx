import { AppModal } from '@/components/ui/app-modal'
import { Button } from '@/components/ui/button'

// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────

interface ConfirmModalProps {
  trigger: React.ReactNode

  title: string
  description?: string

  // Label do botão de confirmação
  // Padrão: 'Confirmar' — mude para 'Deletar', 'Remover', etc.
  confirmLabel?: string

  // Variante do botão de confirmação
  // Para ações destrutivas use 'destructive'
  confirmVariant?: 'default' | 'destructive'

  // Função chamada quando o usuário confirma
  // void significa que não retorna nada
  onConfirm: () => void

  // Estado de carregamento — desabilita os botões enquanto
  // a ação assíncrona (deletar no banco) está em andamento
  loading?: boolean
}

// ─────────────────────────────────────────────
// ConfirmModal
// ─────────────────────────────────────────────

function ConfirmModal({
  trigger,
  title,
  description,
  confirmLabel = 'Confirmar',
  confirmVariant = 'default',
  onConfirm,
  loading = false,
}: ConfirmModalProps) {

  // Estado interno para controlar aberto/fechado
  // Precisamos disso para fechar o modal depois que onConfirm terminar
  const [open, setOpen] = React.useState(false)

  // Quando o usuário confirma:
  // 1. Chama a função de ação (deletar, salvar, etc.)
  // 2. Fecha o modal
  function handleConfirm() {
    onConfirm()
    setOpen(false)
  }

  return (
    <AppModal
      trigger={trigger}
      title={title}
      description={description}
      size="sm"
      open={open}
      onOpenChange={setOpen}
      // Impede fechar ao clicar fora durante o loading
      dismissible={!loading}
      footer={
        // Fragment (<>) agrupa os dois botões sem criar elemento no DOM
        <>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            variant={confirmVariant}
            onClick={handleConfirm}
            disabled={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  )
}

// React precisa de import para usar useState no ConfirmModal
// Como o arquivo não tinha import do React, adicionamos aqui
import * as React from 'react'

export { ConfirmModal }