// Importa a função toast do Sonner
// Essa função é o que dispara as notificações
import { toast } from 'sonner'
import { createElement } from 'react'
import { Link } from 'lucide-react'

// Um hook no React é uma função que começa com "use"
// Ele pode encapsular lógica reutilizável
// Aqui ele retorna um objeto com funções prontas para cada situação
export function useToast() {
  return {

    // Ações de post
    // Cada função chama toast com mensagem e estilo já definidos
    // O componente que usa o hook não precisa saber os detalhes

    postApproved: () =>
      toast.success('Post aprovado com sucesso!', {
        description: 'O criador será notificado.',
      }),

    postSaved: () =>
      toast.success('Post salvo no cronograma!'),

    postDeleted: () =>
      toast.success('Post removido do cronograma.'),

    feedbackSent: () =>
      toast.success('Alteração enviada ao criador!', {
        description: 'Você será notificado quando for corrigido.',
      }),

    // Links
    linkCopied: () =>
      toast('Link copiado!', {
        description: 'Cole no WhatsApp ou email do cliente.',
        icon: createElement(Link, { size: 16 }),
      }),

    // Clientes
    clientSaved: () =>
      toast.success('Cliente salvo com sucesso!'),

    clientDeleted: () =>
      toast.success('Cliente removido.'),

    // Erros — recebe a mensagem como parâmetro
    // porque erros são variáveis dependendo do contexto
    error: (message: string = 'Algo deu errado. Tente novamente.') =>
      toast.error(message),

    // Aviso — também recebe mensagem como parâmetro
    warning: (message: string) =>
      toast.warning(message),

    // Genérico — para casos não cobertos pelas funções acima
    // Útil durante o desenvolvimento
    info: (message: string) =>
      toast(message),
  }
}