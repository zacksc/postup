import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle2 } from 'lucide-react';

const atividades = [
  { id: 1, user: 'Ana Silva', action: 'aprovou o feedback', target: 'Reels Verão', time: 'Há 2 horas' },
  { id: 2, user: 'Ezequiel', action: 'editou o post', target: 'Cold Brew', time: 'Há 5 horas' },
  { id: 3, user: 'Sistema', action: 'mudou status para Aguardando', target: 'Dicas de Treino', time: 'Ontem' },
];

export default function HistoricoPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-[800px] mx-auto">
      <header className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-secondary rounded-full">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Histórico de Atividades</h1>
      </header>

      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="space-y-6">
          {atividades.map((item) => (
            <div key={item.id} className="flex gap-4 items-start">
              <div className="p-2 bg-primary/10 rounded-full text-primary">
                <CheckCircle2 size={16} />
              </div>
              <div>
                <p className="text-sm">
                  <span className="font-bold">{item.user}</span> {item.action} <span className="font-medium text-primary">{item.target}</span>
                </p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Clock size={12} />
                  <span>{item.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}