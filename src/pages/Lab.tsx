// src/pages/Lab.tsx
import { PostCard, type Post } from '@/components/post/PostCard'
import { PostPill } from '@/components/post/PostPill'
import { IgPreview } from '@/components/post/IgPreview'
import { ClientCard, type ClientStats } from '@/components/client/ClientCard'
import { FeedbackCard, type Feedback } from '@/components/post/FeedbackCard'
import { KanbanColumn } from '@/components/post/KanbanColumn'

// Dados de exemplo (Mock) para alimentar o laboratório
const samplePost: Post = {
  id: 'lab-1',
  type: 'reels',
  caption: 'Bastidores da nova coleção de verão!\n\n#socialmedia #postup #verao',
  scheduled_at: '2026-04-16 18:00',
  status: 'aguardando',
  client: { name: 'Loja Aurora', color: 'bg-gray-500' },
  files: [{ url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800' }]
}
const sampleClient: ClientStats = {
  id: 'c1',
  name: 'Loja Aurora',
  handle: '@lojaaurora',
  color: '#374151',
  profilePhoto: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800',
}
const sampleFeedback: Feedback = {
  id: 'f1',
  client: { name: 'Loja Aurora', color: 'bg-gray-500' },
  post: { title: 'Reels Verão', type: 'reels', date: '22/04' },
  message: 'A música ficou um pouco alta, pode baixar um pouco e subir de novo?',
  isUrgent: true
}
const sampleKanban: Feedback[] = [
  sampleFeedback
]
export default function LabPage() {
  return (
    <div className="p-6 md:p-10 flex flex-col gap-12 max-w-5xl mx-auto pb-24">
        {/* 6. KANBAN COLUMN (O agrupador) */}
      <section>
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-6">6. Tarefas Column</h2>
        <div className="flex gap-6 overflow-x-auto pb-4">
          {/* CORREÇÃO AQUI: 
            Passamos cada prop individualmente como definido na interface do componente.
          */}
          <KanbanColumn 
            title="Em alteração"
            colorClass="bg-destructive"
            feedbacks={sampleKanban}
            onCardClick={(fb: Feedback) => alert(`Movendo feedback ${fb.id}`)}
          />

          {/* Exemplo de coluna vazia para testar o Empty State */}
          <KanbanColumn 
            title="Concluído"
            colorClass="bg-success"
            feedbacks={[]} 
          />
        </div>
      </section>
{/* SEÇÃO DE CLIENTES */}
      <section>
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-6">4. ClientCard (Gestão)</h2>
        <div className="max-w-sm">
          <ClientCard client={sampleClient} onClick={() => alert('Abriu cliente!')} />
        </div>
      </section>

      {/* SEÇÃO DE FEEDBACKS */}
      <section>
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-6">5. FeedbackCard (Tarefas)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FeedbackCard 
            feedback={sampleFeedback} 
            onMove={() => alert('Movido para Revisão')} 
          />
          <FeedbackCard 
            feedback={{
              ...sampleFeedback,
              id: 'f2',
              isUrgent: false,
              message: 'Aprovado! Pode programar.'
            }} 
          />
        </div>
      </section>

      {/* SEÇÕES ANTERIORES (Cards, Pills, IgPreview...) */}
      <section className="opacity-50 grayscale hover:grayscale-0 transition-all">
         <p className="text-xs text-center border-t pt-4 italic">Componentes de post anteriores renderizados abaixo...</p>
         {/* ... aqui você manteria o código do PostCard e IgPreview ... */}
      </section>
      
      <section>
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-6">1. PostPill (Calendário)</h2>
        <div className="w-48">
          <PostPill 
            time="18:00" 
            clientName={samplePost.client?.name || ''} 
            clientColorClass="bg-gray-100 text-gray-600 border-gray-200"
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-6">2. PostCard (Variantes)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-xs italic text-muted-foreground">Variante: List (Padrão)</span>
            <PostCard post={samplePost} variant="list" />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs italic text-muted-foreground">Variante: Compact (Sidebar)</span>
            <PostCard post={samplePost} variant="compact" />
          </div>
        </div>
      </section>

      <section className="flex flex-col md:flex-row gap-10">
        <div className="flex-1">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-6">3. IgPreview (Clone IG)</h2>
          <IgPreview post={{ ...samplePost, caption: samplePost.caption || '', client: { name: samplePost.client?.name || '', color: samplePost.client?.color || '', handle: '' }, scheduledAt: new Date(samplePost.scheduled_at) }} />
        </div>
        
        <div className="flex-1 flex flex-col gap-4 bg-secondary/30 p-6 rounded-xl border border-border">
          <h3 className="font-bold">Por que esse Lab?</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Aqui visualizamos a hierarquia do <strong>Postup</strong>. O mesmo objeto de dados (Post) 
            alimenta três componentes com propósitos diferentes. 
            <br/><br/>
            Isso prova que nossa <strong>Interface TypeScript</strong> está bem desenhada: 
            ela é flexível o suficiente para a pílula pequena e detalhada o suficiente para o clone do Instagram.
          </p>
        </div>
      </section>

    </div>
  )
}