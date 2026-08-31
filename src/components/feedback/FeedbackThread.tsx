import { useState } from 'react';
import type { PostFeedback } from '../../types/feedback';
import { MessageSquare, History, Pencil, CheckCircle2, Upload } from 'lucide-react';
import { cn, getInitials } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
  feedbacks: PostFeedback[];
}

const ALTERATION_PREFIX = 'Gestor solicitou alteração:';

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function getLogIcon(msg: string) {
  if (msg.includes('aprovou')) return <CheckCircle2 size={10} />;
  if (msg.includes('publicado')) return <Upload size={10} />;
  if (msg.includes('solicitou')) return <Pencil size={10} />;
  return <History size={10} />;
}

export function FeedbackThread({ feedbacks }: Props) {
  const [modalLog, setModalLog] = useState<PostFeedback | null>(null);

  const modalDetail = modalLog?.message.startsWith(ALTERATION_PREFIX)
    ? modalLog.message.slice(ALTERATION_PREFIX.length).trim()
    : null;

  if (feedbacks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
        <MessageSquare className="w-6 h-6 opacity-20" />
        <p className="text-xs">Nenhum feedback ainda</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {feedbacks.map((fb) => {
          if (fb.type === 'log') {
            const isAlteration = fb.message.startsWith(ALTERATION_PREFIX);
            const summary = isAlteration ? 'Gestor solicitou alteração' : fb.message;

            return (
              <div key={fb.id}>
                <div className="flex items-center justify-center gap-2 py-1">
                  <div className="h-px flex-1 bg-border/40" />
                  <button
                    onClick={() => setModalLog(fb)}
                    className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                  >
                    {getLogIcon(fb.message)}
                    <span className="text-[10px] font-medium">{summary}</span>
                    <span className="text-[10px] opacity-60">{formatDateTime(fb.created_at)}</span>
                  </button>
                  <div className="h-px flex-1 bg-border/40" />
                </div>
              </div>
            );
          }

          const isGestor = fb.author_role === 'gestor';
          const displayName = fb.author_name || (isGestor ? 'Gestor' : 'Cliente');

          return (
            <div key={fb.id} className={`flex flex-col ${isGestor ? 'items-end' : 'items-start'}`}>
              <div className="flex gap-2 max-w-[90%] items-start">
                {!isGestor && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-muted to-muted-foreground flex items-center justify-center text-[9px] font-bold text-white shrink-0 mt-3">
                    <span>{getInitials(displayName)}</span>
                  </div>
                )}
                <div className="min-w-0">
                  <div
                    className={cn(
                      "px-3 py-2 text-sm",
                      isGestor
                        ? 'bg-primary/20 border border-primary/30 rounded-[10px_0_10px_10px]'
                        : 'bg-secondary border border-border rounded-[0_10px_10px_10px]'
                    )}
                  >
                    <p>{fb.message}</p>
                  </div>
                  <div className={cn(
                    "flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground px-0.5",
                    isGestor ? 'justify-end' : 'justify-start'
                  )}>
                    <span className="font-semibold">{displayName}</span>
                    <span>·</span>
                    <span>{formatDateTime(fb.created_at)}</span>
                  </div>
                </div>
                {isGestor && (
                  <div className="w-6 h-6 rounded-full bg-primary/30 flex items-center justify-center text-[9px] font-bold text-primary shrink-0 mt-3">
                    <span>{getInitials(displayName)}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!modalLog} onOpenChange={(open: boolean) => { if (!open) setModalLog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {modalLog?.message.startsWith(ALTERATION_PREFIX) ? 'Alteração solicitada' : 'Detalhes do evento'}
            </DialogTitle>
          </DialogHeader>
          {modalDetail && (
            <div className="py-2 space-y-3">
              <p className="text-sm leading-relaxed">{modalDetail}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold">{modalLog?.author_name || 'Gestor'}</span>
                <span>·</span>
                <span>{modalLog ? formatDateTime(modalLog.created_at) : ''}</span>
              </div>
            </div>
          )}
          {!modalDetail && modalLog && (
            <div className="py-2">
              <p className="text-sm text-muted-foreground">{modalLog.message}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
