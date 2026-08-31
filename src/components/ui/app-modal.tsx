import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────

interface AppModalProps {
  // O elemento que abre o modal ao ser clicado
  // ReactNode aceita qualquer coisa: botão, ícone, div, texto...
  trigger?: React.ReactNode

  // Título do modal — obrigatório para acessibilidade
  // O Radix usa isso para o atributo aria-labelledby
  title: string

  // Subtítulo opcional — aparece abaixo do título em cinza
  description?: string

  // O conteúdo principal do modal — o que fica entre header e footer
  // children é a prop padrão do React para conteúdo aninhado
  children?: React.ReactNode

  // Botões de ação no rodapé — geralmente Cancel + Confirm
  footer?: React.ReactNode

  // Largura do modal — sm para confirmações, md para formulários,
  // lg para conteúdo mais complexo como o grid de aprovação
  size?: 'sm' | 'md' | 'lg' | 'xl'

  // Controle externo de aberto/fechado
  // Quando você precisa abrir o modal programaticamente
  // (sem o trigger) ou fechar após uma ação assíncrona
  open?: boolean
  onOpenChange?: (open: boolean) => void

  // Impede fechar ao clicar fora — útil em formulários longos
  // para evitar perda de dados acidental
  dismissible?: boolean

  className?: string
}

// Mapeamento de tamanhos
// max-w define a largura máxima — em telas menores o modal
// ocupa toda a largura graças ao w-full do DialogContent base
const MODAL_SIZES: Record<string, string> = {
  sm: 'max-w-sm',   // 384px — confirmações simples
  md: 'max-w-md',   // 448px — formulários pequenos
  lg: 'max-w-lg',   // 512px — formulários maiores
  xl: 'max-w-2xl',  // 672px — conteúdo complexo
}

// ─────────────────────────────────────────────
// AppModal
// ─────────────────────────────────────────────

function AppModal({
  trigger,
  title,
  description,
  children,
  footer,
  size = 'md',
  open,
  onOpenChange,
  dismissible = true,
  className,
}: AppModalProps) {
  return (
    // Dialog é o controlador de estado do Radix
    // Quando open e onOpenChange são passados, o controle
    // é externo — você decide quando abrir e fechar
    // Quando não são passados, o Dialog gerencia internamente
    // usando o DialogTrigger como gatilho
    <Dialog open={open} onOpenChange={onOpenChange}>

      {/* DialogTrigger só renderiza se trigger foi passado */}
      {/* asChild faz o Radix usar o elemento filho como trigger */}
      {/* em vez de criar um novo elemento HTML por conta própria */}
      {/* Sem asChild, o Radix envolveria o botão com outro elemento */}
      {trigger && (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      )}

      {/* DialogContent renderiza via portal no <body> */}
      {/* O cn combina o tamanho escolhido com classes extras */}
      <DialogContent
        className={cn(MODAL_SIZES[size], className)}
        // onInteractOutside controla o que acontece ao clicar fora
        // Se dismissible=false, preventDefault() cancela o fechamento
        onInteractOutside={(e) => {
          if (!dismissible) e.preventDefault()
        }}
      >
        {/* DialogHeader agrupa título e descrição */}
        <DialogHeader>
          {/* DialogTitle é obrigatório — o Radix usa para aria-labelledby */}
          {/* Se você omitir, o Radix lança um aviso no console */}
          <DialogTitle>{title}</DialogTitle>

          {/* DialogDescription só renderiza se description foi passado */}
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        {/* Conteúdo principal — qualquer coisa que você passar como filho */}
        {children && (
          <div className="py-2">
            {children}
          </div>
        )}

        {/* DialogFooter só renderiza se footer foi passado */}
        {/* DialogFooter já aplica flex e alinha os botões à direita */}
        {footer && (
          <DialogFooter>
            {footer}
          </DialogFooter>
        )}

      </DialogContent>
    </Dialog>
  )
}

export { AppModal }