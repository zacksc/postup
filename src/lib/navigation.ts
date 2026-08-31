import {
  Home,
  CalendarDays,
  Users,
  ListTodo,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react'

// NavItem define o formato de cada item de navegação
// Exportado para ser usado como tipo nos componentes de nav
export interface NavItem {
  // label — texto exibido ao lado do ícone na sidebar
  label: string

  // path — rota para onde o item navega
  // Usado para comparar com a rota atual e destacar o item ativo
  path: string

  // icon — componente do Lucide que representa o item
  // LucideIcon é o tipo que o Lucide exporta para todos os ícones
  icon: LucideIcon
}

// NAV_ITEMS — fonte única de verdade para a navegação do app
// Qualquer componente que precise da lista de rotas importa daqui
// Se você adicionar uma nova página, adiciona aqui e reflete em tudo
export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Home',
    path: '/',
    icon: Home,
  },
  {
    label: 'Cronograma',
    path: '/cronograma',
    icon: CalendarDays,
  },
  {
    label: 'Clientes',
    path: '/clientes',
    icon: Users,
  },
  {
    label: 'Tarefas',
    path: '/tarefas',
    icon: ListTodo,
  },
  {
    label: 'Chat',
    path: '/chat',
    icon: MessageSquare,
  },
]
