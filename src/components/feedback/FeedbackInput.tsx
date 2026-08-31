import { useState } from 'react';
import { Send } from 'lucide-react';

interface Props {
  onSend: (message: string, role: 'gestor' | 'cliente') => Promise<void>;
  sending: boolean;
}

export function FeedbackInput({ onSend, sending }: Props) {
  const [message, setMessage] = useState('');
  const [role, setRole] = useState<'gestor' | 'cliente'>('gestor');

  const handleSubmit = async () => {
    if (!message.trim() || sending) return;
    await onSend(message, role);
    setMessage('');
  };

  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex gap-2 p-1 bg-muted/50 rounded-lg w-fit">
        <button 
          onClick={() => setRole('gestor')}
          className={`px-3 py-1 text-xs rounded-md ${role === 'gestor' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
        >
          Gestor
        </button>
        <button 
          onClick={() => setRole('cliente')}
          className={`px-3 py-1 text-xs rounded-md ${role === 'cliente' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
        >
          Cliente
        </button>
      </div>
      
      <div className="relative">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Adicionar comentário..."
          maxLength={500}
          className="w-full min-h-[80px] p-3 text-sm bg-transparent border rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <div className="flex justify-between items-center mt-2">
          <span className="text-[10px] text-muted-foreground">{message.length} / 500</span>
          <button 
            disabled={!message.trim() || sending}
            onClick={handleSubmit}
            className="p-2 bg-primary text-primary-foreground rounded-full disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
