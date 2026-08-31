import * as React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

// Tipagem das props do Field
// Estende as props nativas do input HTML para aceitar
// tudo que um input normal aceita (onChange, onBlur, value, etc.)
interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string           // texto acima do campo
  hint?: string            // texto de ajuda abaixo
  error?: string           // mensagem de erro (substitui o hint)
  required?: boolean       // mostra asterisco vermelho no label
  multiline?: boolean      // se true, renderiza textarea em vez de input
  rows?: number            // número de linhas do textarea
  containerClassName?: string  // classe extra no wrapper externo
}

const Field = React.forwardRef<HTMLInputElement, FieldProps>(
  (
    {
      label,
      hint,
      error,
      required,
      multiline = false,
      rows = 3,
      containerClassName,
      className,
      id,
      ...props
    },
    ref
  ) => {
    // Gera um id único se não for passado
    // Necessário para conectar o label ao input via htmlFor
    const generatedId = React.useId()
    const fieldId = id || generatedId

    // Define a borda do campo — vermelha se tiver erro, padrão caso contrário
    const inputClass = cn(
      'transition-colors',
      error && 'border-destructive focus-visible:ring-destructive/30',
      className
    )

    return (
      // Wrapper externo — agrupa label + campo + mensagem
      <div className={cn('flex flex-col gap-1.5', containerClassName)}>

        {/* Label — só renderiza se existir */}
        {label && (
          <Label
            htmlFor={fieldId}
            className={cn(
              'text-sm font-medium text-foreground',
              error && 'text-destructive'
            )}
          >
            {label}
            {/* Asterisco de obrigatório */}
            {required && (
              <span className="text-destructive ml-1" aria-hidden="true">
                *
              </span>
            )}
          </Label>
        )}

        {/* Campo — textarea ou input dependendo da prop multiline */}
        {multiline ? (
          <Textarea
            id={fieldId}
            rows={rows}
            className={cn(
              'resize-none transition-colors',
              error && 'border-destructive focus-visible:ring-destructive/30',
              className
            )}
            aria-invalid={!!error}
            aria-describedby={
              error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined
            }
            {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <Input
            id={fieldId}
            ref={ref}
            className={inputClass}
            aria-invalid={!!error}
            aria-describedby={
              error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined
            }
            {...props}
          />
        )}

        {/* Mensagem abaixo do campo — erro tem prioridade sobre hint */}
        {error ? (
          <p
            id={`${fieldId}-error`}
            className="text-xs text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : hint ? (
          <p
            id={`${fieldId}-hint`}
            className="text-xs text-muted-foreground"
          >
            {hint}
          </p>
        ) : null}

      </div>
    )
  }
)

Field.displayName = 'Field'

export { Field }