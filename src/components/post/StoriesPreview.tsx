import { useState } from 'react';
import { cn } from '@/lib/utils';
import { X, Send, MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PreviewMedia } from '@/components/post/PreviewMedia';
import { resolvePreviewMedia, type PostPreviewData } from '@/components/post/preview-types';

interface StoriesPreviewProps {
  post: PostPreviewData;
  className?: string;
}

/**
 * Preview do Instagram Stories (9:16):
 *  - Topo (~14-15%): barra de progresso segmentada, foto + nome + horário,
 *    menu "..." e fechar (X)
 *  - Base (~16-20%): legenda como sticker (sempre visível) + campo de resposta
 *    com ícone de compartilhar (a barra pode ser escondida pelo controle "ações")
 *  - Sem coluna lateral de botões.
 * Controles (som, esconder ações, ver capa) compartilhados no canto superior direito.
 */
export function StoriesPreview({ post, className }: StoriesPreviewProps) {
  const { client, caption, scheduledAt, status } = post || {};
  const { files: filesArray, coverUrl } = resolvePreviewMedia(post);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [actionsVisible, setActionsVisible] = useState(true);

  return (
    <div className={cn(
      "w-full aspect-[9/16] bg-black rounded-2xl overflow-hidden relative flex flex-col shadow-sm",
      className
    )}>
      {/* Mídia em tela cheia */}
      <div className="absolute inset-0 bg-muted">
        {filesArray.length > 0 ? (
          <PreviewMedia
            files={filesArray}
            coverUrl={coverUrl}
            className="w-full h-full"
            overlayTopClass="top-14"
            actionsVisible={actionsVisible}
            onToggleActions={() => setActionsVisible(v => !v)}
            index={currentIndex}
            onIndexChange={setCurrentIndex}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground uppercase tracking-widest">
            MÍDIA
          </div>
        )}
      </div>

      {/* Barras de progresso segmentadas (uma por story) — ocultas no modo limpo */}
      {actionsVisible && (
        <div className="absolute top-2 left-3 right-3 z-10 flex gap-1 pointer-events-none">
          {filesArray.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-0.5 rounded-full flex-1',
                i <= currentIndex ? 'bg-white' : 'bg-white/30'
              )}
            />
          ))}
        </div>
      )}

      {/* Header: foto + nome + horário + "..." + fechar — oculto no modo limpo */}
      {actionsVisible && (
        <div className="relative z-10 p-3 pt-4 flex items-center gap-2 pointer-events-none">
          {client?.profilePhoto ? (
            <img
              src={client.profilePhoto}
              alt={client.name}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-primary"
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-primary"
              style={{ background: client?.color || '#374151' }}
            >
              {client?.name?.charAt(0) || "?"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-semibold truncate">{client?.handle || "@cliente"}</p>
            {scheduledAt && (
              <p className="text-white/70 text-[10px]">
                {format(scheduledAt, "dd/MM 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
          </div>
          <MoreHorizontal size={18} className="text-white/80" />
          <X size={18} className="text-white/80" />
        </div>
      )}

      {/* Base (~16-20%): legenda-sticker sempre + barra de resposta escondível —
          oculto no modo limpo */}
      {actionsVisible && (
        <div className="relative z-10 mt-auto p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/75 to-transparent flex flex-col gap-2">
        {caption && (
          <div className="rounded-lg bg-white/15 backdrop-blur px-2.5 py-1.5">
             <p
               className={cn('text-white text-xs cursor-pointer', !captionExpanded && 'line-clamp-2')}
               onClick={() => caption && setCaptionExpanded(!captionExpanded)}
             >
               {caption}
             </p>
            {caption && (
              <button
                type="button"
                onClick={() => setCaptionExpanded(!captionExpanded)}
                className="self-start text-white/70 text-[10px] font-medium hover:text-white transition-colors"
              >
                {captionExpanded ? 'Ver menos' : 'Ver mais'}
              </button>
            )}
          </div>
        )}
        {actionsVisible && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-9 rounded-full bg-white/20 flex items-center px-3 text-white/80 text-[11px]">
              Enviar mensagem
            </div>
            <Send size={20} className="text-white/90" />
          </div>
        )}
        {status && (
          <span className="absolute -top-8 right-3 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/15 text-white">
            {status}
          </span>
        )}
      </div>
      )}
    </div>
  );
}
