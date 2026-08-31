import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Reveal } from '@/components/ui/Reveal'
import { useAuth } from '@/hooks/use-auth'
import { Brand } from '@/components/layout/Brand'
import {
  Calendar,
  MessageSquareText,
  LayoutGrid,
  CheckCircle2,
  ArrowRight,
  Menu,
  X,
  ClipboardCheck,
  Clock,
  BarChart3,
  Lock,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const features = [
  {
    icon: Calendar,
    title: 'Calendário Visual',
    description: 'Arraste e solte posts no calendário. Visualize toda a programação mensal do seu cliente em um só lugar.',
  },
  {
    icon: MessageSquareText,
    title: 'Feedback do Cliente',
    description: 'Cliente aprova ou solicita alterações diretamente na plataforma. Sem mais trocas intermináveis de WhatsApp.',
  },
  {
    icon: LayoutGrid,
    title: 'Grid do Instagram',
    description: 'Visualize como o feed do Instagram ficará antes de publicar. Planeje a estética do perfil com antecedência.',
  },
  {
    icon: ClipboardCheck,
    title: 'Cards de Feedback',
    description: 'Organize solicitações de alteração em cards com prioridade e prazo. Nunca perça um pedido de vista.',
  },
  {
    icon: Clock,
    title: 'Histórico de Versões',
    description: 'Cada alteração gera uma nova versão. Compare, restaure e acompanhe a evolução de cada post.',
  },
  {
    icon: BarChart3,
    title: 'Métricas em Tempo Real',
    description: 'Acompanhe posts aprovados, pendentes, publicados e cards abertos em um dashboard intuitivo.',
  },
]

const steps = [
  {
    step: '01',
    title: 'Crie o Post',
    description: 'Produza o conteúdo, agende a data e defina o tipo de post diretamente no calendário.',
  },
  {
    step: '02',
    title: 'Compartilhe com o Cliente',
    description: 'O cliente recebe um link único para visualizar, aprovar ou solicitar alterações.',
  },
  {
    step: '03',
    title: 'Itere até Aprovar',
    description: 'Cada feedback gera uma nova versão. O cliente aprova quando estiver satisfeito.',
  },
  {
    step: '04',
    title: 'Publique com Confiança',
    description: 'Com a aprovação final, publique sabendo que tudo está alinhado com o cliente.',
  },
]

const testimonials = [
  {
    name: 'Ana Silva',
    role: 'Social Media Manager',
    content: 'O PostUp revolucionou a forma como gerencio posts dos meus clientes. O fluxo de aprovação é incrível.',
    rating: 5,
  },
  {
    name: 'Carlos Oliveira',
    role: 'Agência de Marketing',
    content: 'Reduzimos o tempo de aprovação de posts em 70%. Meus clientes amam a facilidade de dar feedback.',
    rating: 5,
  },
  {
    name: 'Juliana Costa',
    role: 'Freelancer',
    content: 'Finalmente uma ferramenta que entende a necessidade de quem gerencia múltiplos clientes. Simples e poderosa.',
    rating: 5,
  },
]

const pricing = [
  {
    name: 'Iniciante',
    price: 'Grátis',
    period: '',
    description: 'Para começar a organizar seus posts',
    items: [
      'Até 2 clientes',
      'Posts ilimitados',
      'Calendário visual',
      'Feedback do cliente',
    ],
    cta: 'Começar Grátis',
    featured: false,
    locked: false,
  },
  {
    name: 'Basic',
    price: 'R$ 19,90',
    period: '/mês',
    description: 'Para quem quer mais recursos',
    items: [
      'Até 5 clientes',
      'Grid do Instagram',
      'Histórico de versões',
      'Cards de feedback',
    ],
    cta: 'Assinar',
    featured: false,
    locked: true,
  },
  {
    name: 'Profissional',
    price: 'R$ 49',
    period: '/mês',
    description: 'Para profissionais que levam a sério',
    items: [
      'Clientes ilimitados',
      'Grid do Instagram',
      'Histórico de versões',
      'Cards de feedback',
      'Métricas avançadas',
      'Suporte prioritário',
    ],
    cta: 'Assinar Agora',
    featured: true,
    locked: true,
  },
  {
    name: 'Agência',
    price: 'R$ 99',
    period: '/mês',
    description: 'Para agências com demanda elevada',
    items: [
      'Tudo do Profissional',
      'Múltiplos usuários',
      'Relatórios customizados',
      'API de integração',
      'Onboarding dedicado',
      'SLA garantido',
    ],
    cta: 'Falar com Vendas',
    featured: false,
    locked: true,
  },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/home" replace />
  }

  return (
    <div className="min-h-screen bg-white animate-page">
      {/* Navbar */}
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          scrolled
            ? 'bg-background/80 backdrop-blur-xl border-b border-border shadow-sm'
            : 'bg-transparent',
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <Link to="/" className="flex items-center">
              <Brand variant="text" height={120} />
            </Link>

            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Funcionalidades
              </a>
              <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Como Funciona
              </a>
              <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Preços
              </a>
              <button onClick={() => navigate('/demo')} className="text-sm text-primary font-medium hover:text-primary-hover transition-colors cursor-pointer">
                Demonstração
              </button>
            </nav>

            <div className="hidden md:flex items-center gap-3">
              <Button variant="default" size="sm" onClick={() => navigate('/login')}>
                Entrar
              </Button>
            </div>

            <button
              className="md:hidden p-2 text-muted-foreground"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-card border-b border-border">
            <div className="px-4 py-4 flex flex-col gap-3">
              <a href="#features" onClick={() => setMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground py-2">
                Funcionalidades
              </a>
              <a href="#how-it-works" onClick={() => setMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground py-2">
                Como Funciona
              </a>
              <a href="#pricing" onClick={() => setMenuOpen(false)} className="text-sm text-muted-foreground hover:text-foreground py-2">
                Preços
              </a>
              <button onClick={() => { setMenuOpen(false); navigate('/demo') }} className="text-sm text-primary font-medium text-left py-2 hover:text-primary-hover transition-colors">
                Demonstração
              </button>
              <div className="flex flex-col gap-2 pt-2 border-t border-border">
                <Button variant="outline" onClick={() => navigate('/login')}>
                  Entrar
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* Hero */}
        <section className="relative pt-20 md:pt-10 pb-20 md:pb-40 overflow-hidden bg-white -translate-y-16 md:-translate-y-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="max-w-3xl mx-auto text-center">
              <div className="mb-1">
                <Brand variant="icon" height={460} className="mx-auto" />
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]">
                Poste com{' '}
                <span className="text-primary">confiança</span>
                <br />
                sem o caos do WhatsApp
              </h1>

              <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
                A plataforma que organiza a criação, aprovação e publicação de posts 
                com seus clientes. Chega de prints, áudios perdidos e versões soltas.
              </p>

              <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
                <Button size="lg" onClick={() => navigate('/login')}>
                  Entrar na plataforma <ArrowRight size={18} />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate('/demo')}>
                  Ver Demo
                </Button>
              </div>

              <div className="mt-12 flex items-center justify-center md:gap-8 gap-4 text-[11px] md:text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-success" />
                  Sem cartão de crédito
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-success" />
                  Setup em 5 minutos
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-success" />
                  Cancelamento livre
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-0 md:py-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <Reveal>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                  Tudo que você precisa para gerenciar posts
                </h2>
              </Reveal>
              <Reveal delay={0.08}>
                <p className="mt-4 text-muted-foreground">
                Do briefing à aprovação, o PostUp centraliza todo o fluxo de criação de conteúdo 
                em uma única plataforma.
                </p>
              </Reveal>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((f, i) => (
                <Reveal key={f.title} delay={(i % 3) * 0.07}>
                  <div className="group bg-card border border-border rounded-2xl p-6 h-full hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5 transition-all duration-300">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                      <f.icon size={20} className="text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="py-20 md:py-28 bg-stone-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <Reveal>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                  Como funciona
                </h2>
              </Reveal>
              <Reveal delay={0.08}>
                <p className="mt-4 text-muted-foreground">
                  Em apenas 4 passos você transforma o caos em um fluxo organizado de aprovação.
                </p>
              </Reveal>
            </div>

            <div className="grid md:grid-cols-4 gap-8 relative">
              {steps.map((s, i) => (
                <Reveal key={s.step} delay={i * 0.08}>
                  <div className="relative">
                    {i < steps.length - 1 && (
                      <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px bg-gradient-to-r from-primary/40 to-transparent" />
                    )}
                    <div className="flex flex-col items-center text-center">
                      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                        <span className="text-2xl font-bold text-primary">{s.step}</span>
                      </div>
                      <h3 className="font-semibold mb-2">{s.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-20 md:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <Reveal>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                  Quem usa, recomenda
                </h2>
              </Reveal>
              <Reveal delay={0.08}>
                <p className="mt-4 text-muted-foreground">
                  O que profissionais estão dizendo sobre o PostUp.
                </p>
              </Reveal>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {testimonials.map((t, i) => (
                <Reveal key={t.name} delay={(i % 3) * 0.07}>
                  <div className="bg-card border border-border rounded-2xl p-6 h-full">
                    <div className="flex gap-1 mb-4">
                      {Array.from({ length: t.rating }).map((_, i) => (
                        <svg key={i} className="w-4 h-4 fill-amber-400" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">"{t.content}"</p>
                    <div>
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-20 md:py-28 bg-stone-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <Reveal>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                  Planos simples e transparentes
                </h2>
              </Reveal>
              <Reveal delay={0.08}>
                <p className="mt-4 text-muted-foreground">
                  Comece grátis e evolua conforme sua demanda crescer.
                </p>
              </Reveal>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {pricing.map((plan, i) => (
                <Reveal key={plan.name} delay={(i % 4) * 0.06} className="h-full">
                  <div
                    className={cn(
                      'bg-card border rounded-2xl p-6 flex flex-col relative transition-all duration-300 overflow-hidden h-full',
                      plan.featured
                        ? 'border-primary shadow-lg shadow-primary/10 scale-[1.02]'
                        : 'border-border hover:border-primary/30',
                      plan.locked && 'select-none',
                    )}
                  >
                  {plan.featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider z-10">
                      Mais Popular
                    </div>
                  )}

                  {plan.locked && (
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <Lock size={18} className="text-muted-foreground" />
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground">Em breve</span>
                    </div>
                  )}

                  <div className={cn(plan.locked && 'blur-xs')}>
                    <div className="mb-6">
                      <h3 className="font-bold text-lg">{plan.name}</h3>
                      <div className="mt-3 flex items-baseline gap-0.5">
                        <span className="text-3xl font-bold">{plan.price}</span>
                        <span className="text-sm text-muted-foreground">{plan.period}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
                    </div>

                    <ul className="flex flex-col gap-3 mb-8 flex-1">
                      {plan.items.map((item) => (
                        <li key={item} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 size={16} className="text-success shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>

                    <Button
                      variant={plan.featured ? 'default' : 'outline'}
                      className="w-full"
                      disabled={plan.locked}
                      onClick={() => navigate('/cadastro')}
                    >
                      {plan.cta}
                    </Button>
                  </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 md:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-gradient-to-br from-primary to-primary-hover rounded-3xl p-10 md:p-16 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />

              <div className="relative">
                <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground">
                  Pronto para organizar seus posts?
                </h2>
                <p className="mt-4 text-primary-foreground/80 max-w-lg mx-auto">
                  Cadastre-se grátis e comece a gerenciar seus posts com seus clientes 
                  de forma simples e profissional.
                </p>
                <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="bg-white text-primary hover:bg-white/90 shadow-lg"
                    onClick={() => navigate('/login')}
                  >
                    Entrar na plataforma <ArrowRight size={18} />
                  </Button>
                  <Button
                    size="lg"
                    variant="ghost"
                    className="text-primary-foreground hover:bg-white/10"
                    onClick={() => navigate('/demo')}
                  >
                    Ver demonstração
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <span className="text-lg font-bold tracking-tight">PostUp</span>
            </div>

            <nav className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">Funcionalidades</a>
              <a href="#pricing" className="hover:text-foreground transition-colors">Preços</a>
              <Link to="/login" className="hover:text-foreground transition-colors">Entrar</Link>
            </nav>

            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} PostUp. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
