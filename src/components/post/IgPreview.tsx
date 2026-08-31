import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Heart, MessageCircle, Send, Bookmark } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PreviewMedia } from '@/components/post/PreviewMedia';
import { resolvePreviewMedia, type PostPreviewData } from '@/components/post/preview-types';
import { useMediaAspect } from '@/hooks/use-media-aspect';

interface IgPreviewProps {
  post: PostPreviewData;
  className?: string;
}

/**
 * Preview do feed do Instagram:
 *  - Header (foto + handle), área de mídia que se adapta às proporções da
 *    mídia enviada (com carrossel), linha de ações (curtir, comentar, enviar,
 *    salvar) e legenda.
 *  - "Esconder ações" oculta a linha de botões de ação.
 *  - Clique na mídia abre em tela cheia; capa separada (não no carrossel).
 */
export function IgPreview({ post, className }: IgPreviewProps) {
  const { client, type, caption, scheduledAt, status } = post || {};
  const { files: filesArray, coverUrl } = resolvePreviewMedia(post);
  const firstFile = filesArray[0];
  const mediaAspect = useMediaAspect(firstFile?.url, firstFile?.mediaType);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [actionsVisible, setActionsVisible] = useState(true);

  return (
    <div className={cn(
      "w-full bg-background border border-border rounded-xl overflow-hidden relative shadow-sm",
      className
    )}>
      {/* Header do Post — oculto no modo limpo */}
      {actionsVisible && (
        <div className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {client?.profilePhoto ? (
              <img
                src={client.profilePhoto}
                alt={client.name}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                style={{ background: client?.color || '#374151' }}
              >
                {client?.name?.charAt(0) || "?"}
              </div>
            )}
            <span className="text-sm font-semibold">{client?.handle || "@cliente"}</span>
          </div>
        </div>
      )}

      {/* Área da Mídia */}
      <div
        className="bg-muted flex items-center justify-center relative w-full"
        style={mediaAspect ? { aspectRatio: `${mediaAspect}` } : { aspectRatio: '1 / 1' }}
      >
        {filesArray.length > 0 ? (
          <PreviewMedia
            files={filesArray}
            coverUrl={coverUrl}
            className="w-full h-full"
            actionsVisible={actionsVisible}
            onToggleActions={() => setActionsVisible(v => !v)}
          />
        ) : (
          <span className="text-xs text-muted-foreground uppercase tracking-widest font-medium">
            {(type || 'MÍDIA').toUpperCase()}
          </span>
        )}
      </div>

      {/* Botões de Ação (escondíveis) */}
      {actionsVisible && (
        <div className="p-3 flex justify-between items-center">
          <div className="flex gap-4">
            <Heart size={22} className="cursor-pointer" />
            <MessageCircle size={22} className="cursor-pointer" />
            <Send size={22} className="cursor-pointer" />
          </div>
          <Bookmark size={22} className="cursor-pointer" />
        </div>
      )}

      {/* Legenda Resumida — oculta no modo limpo */}
      {actionsVisible && (
        <div className="px-3 pb-4">
          <p className="text-sm font-semibold mb-1">{client?.name || "..."}</p>
           <p
             className={cn('text-sm cursor-pointer', !captionExpanded && 'line-clamp-2')}
             onClick={() => caption && setCaptionExpanded(!captionExpanded)}
           >
             <span className="font-semibold mr-1">{client?.handle}</span>
             {caption || "Legenda do post..."}
           </p>
          {caption && (
            <button
              type="button"
              onClick={() => setCaptionExpanded(!captionExpanded)}
              className="text-xs text-muted-foreground hover:text-foreground font-medium mt-0.5"
            >
              {captionExpanded ? 'Ver menos' : 'Ver mais'}
            </button>
          )}
          {scheduledAt && (
            <p className="text-[10px] text-muted-foreground mt-2 uppercase">
              Agendado para {format(scheduledAt, "dd/MM 'às' HH:mm", { locale: ptBR })}
            </p>
          )}
          {status && (
            <div className="mt-2 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary border border-border">
              Status: {status}
            </div>
          )}
         </div>
       )}
     </div>
   );
 }
