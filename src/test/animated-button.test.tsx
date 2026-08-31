import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AnimatedButton } from '@/components/ui/animated-button'

describe('AnimatedButton', () => {
  it('renderiza o rótulo e propaga o clique', () => {
    const onClick = vi.fn()
    render(<AnimatedButton onClick={onClick}>Salvar</AnimatedButton>)

    fireEvent.click(screen.getByRole('button', { name: /salvar/i }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('fica desabilitado enquanto está carregando', () => {
    render(<AnimatedButton loading>Salvar</AnimatedButton>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('exibe a barra de progresso com largura proporcional ao progresso', () => {
    render(<AnimatedButton loading progress={0.5}>Salvar</AnimatedButton>)
    const bar = screen.getByTestId('animated-progress-bar')
    const fill = bar.firstElementChild as HTMLElement
    expect(fill).toBeTruthy()
    expect(fill.style.width).toBe('50%')
  })

  it('exibe check e confetes no estado de sucesso', () => {
    render(<AnimatedButton success>Publicar</AnimatedButton>)
    expect(screen.getByTestId('animated-success-check')).toBeInTheDocument()
    expect(screen.getByTestId('animated-confetti')).toBeInTheDocument()
  })

  it('não mostra a barra de progresso sem estado de loading', () => {
    render(<AnimatedButton>Salvar</AnimatedButton>)
    expect(screen.getByTestId('animated-progress-bar').firstElementChild).toBeNull()
  })
})
