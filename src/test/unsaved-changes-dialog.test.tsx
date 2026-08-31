import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UnsavedChangesDialog } from '@/components/post/UnsavedChangesDialog'

const baseProps = {
  open: true,
  onClose: vi.fn(),
  title: 'Alterações não salvas',
  description: 'O que deseja fazer?',
  onLeave: vi.fn(),
  onContinue: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('UnsavedChangesDialog', () => {
  it('mostra os três botões quando "salvar rascunho" é informado', () => {
    render(<UnsavedChangesDialog {...baseProps} onSaveDraft={vi.fn()} />)
    expect(screen.getByRole('button', { name: /sair mesmo assim/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continuar editando/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /salvar como rascunho/i })).toBeInTheDocument()
  })

  it('esconde "salvar como rascunho" quando não é informado', () => {
    render(<UnsavedChangesDialog {...baseProps} />)
    expect(screen.getByRole('button', { name: /sair mesmo assim/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continuar editando/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /salvar como rascunho/i })).not.toBeInTheDocument()
  })

  it('dispara sair e continuar editando nos cliques', () => {
    render(<UnsavedChangesDialog {...baseProps} />)

    fireEvent.click(screen.getByRole('button', { name: /sair mesmo assim/i }))
    expect(baseProps.onLeave).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /continuar editando/i }))
    expect(baseProps.onContinue).toHaveBeenCalledTimes(1)
  })

  it('salva rascunho e fecha o diálogo no sucesso', async () => {
    const onSaveDraft = vi.fn().mockResolvedValue(true)
    render(<UnsavedChangesDialog {...baseProps} onSaveDraft={onSaveDraft} />)

    fireEvent.click(screen.getByRole('button', { name: /salvar como rascunho/i }))
    await waitFor(() => expect(onSaveDraft).toHaveBeenCalledTimes(1))
    expect(baseProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('mantém o diálogo aberto quando o rascunho falha', async () => {
    const onSaveDraft = vi.fn().mockResolvedValue(false)
    render(<UnsavedChangesDialog {...baseProps} onSaveDraft={onSaveDraft} />)

    fireEvent.click(screen.getByRole('button', { name: /salvar como rascunho/i }))
    await waitFor(() => expect(onSaveDraft).toHaveBeenCalledTimes(1))
    expect(baseProps.onClose).not.toHaveBeenCalled()
  })
})
