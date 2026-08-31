import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Heart, MessageCircle, Bookmark, Share2, Music2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PreviewMedia } from '@/components/post/PreviewMedia';
import { resolvePreviewMedia, type PostPreviewData } from '@/components/post/preview-types';

interface TikTokPreviewProps {
  post: PostPreviewData;
  className?: string;
}

/**
 * Preview do TikTok (9:16) conforme a zona segura — a mais agressiva das três:
 *  - Topo ~8%: abas fixas "Seguindo / Para você" (diferença chave vs. Reels)
 *  - Direita ~16% de largura: foto de perfil, curtir, comentar, salvar,
 *    compartilhar e disco de som — ancorados NA BASE (junto da legenda).
 *  - Base ~25-30%: @usuário, legenda (expande), hashtags e som rolando
 * Controles (som, esconder ações, ver capa) compartilhados no canto superior direito.
 */
export function TikTokPreview({ post, className }: TikTokPreviewProps) {
  const { client, caption, scheduledAt, status } = post || {};
  const { files: filesArray, coverUrl } = resolvePreviewMedia(post);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [actionsVisible, setActionsVisible] = useState(true);

  const hashtags = (caption || '').match(/#[\w]+/g) || [];

  return (
    <div className={cn(
      "w-full aspect-[9/16] bg-black rounded-xl overflow-hidden relative flex flex-col shadow-sm",
      className
    )}>
      {/* Mídia em tela cheia (fundo) */}
      <div className="absolute inset-0 bg-muted">
        {filesArray.length > 0 ? (
          <PreviewMedia
            files={filesArray}
            coverUrl={coverUrl}
            className="w-full h-full"
            overlayTopClass="top-12"
            actionsVisible={actionsVisible}
            onToggleActions={() => setActionsVisible(v => !v)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground uppercase tracking-widest">
            MÍDIA
          </div>
        )}
      </div>

      {/* Abas fixas no topo (~8%): "Seguindo / Para você" — oculto no modo limpo */}
      {actionsVisible && (
        <div className="relative z-10 pt-3 pb-1 flex items-center justify-center gap-6 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
          <span className="text-white/50 text-xs font-semibold">Seguindo</span>
          <span className="text-white text-xs font-bold relative">
            Para você
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-white rounded-full" />
          </span>
        </div>
      )}

      {/* Base (~25-30%): @usuário, legenda, hashtags, som + coluna de ações à
          direita, tudo ancorado na base (coluna não fica alta demais).
          Oculto no modo limpo. */}
      {actionsVisible && (
        <div className="relative z-10 mt-auto flex items-end gap-3 p-3 pt-16 bg-gradient-to-t from-black/85 via-black/50 to-transparent">
          <div className="flex-1 min-w-0 space-y-1.5">
            <p className="text-white text-xs font-bold">{client?.handle || "@cliente"}</p>
             <p
               className={cn('text-white text-xs cursor-pointer', !captionExpanded && 'line-clamp-2')}
               onClick={() => caption && setCaptionExpanded(!captionExpanded)}
             >
               {caption || "Legenda do post..."}
             </p>
            {hashtags.length > 0 && (
              <p className="text-[#2ec1d1] text-[10px] font-medium truncate">{hashtags.join(' ')}</p>
            )}
            {caption && (
              <button
                type="button"
                onClick={() => setCaptionExpanded(!captionExpanded)}
                className="text-white/70 text-[10px] font-medium hover:text-white transition-colors"
              >
                {captionExpanded ? 'Ver menos' : 'Ver mais'}
              </button>
            )}
            <div className="flex items-center gap-1.5 text-white/80 text-[11px]">
              <Music2 size={13} />
              <span className="truncate">Som original · Postup</span>
            </div>
            {status && (
              <div className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/15 text-white">
                Status: {status}
              </div>
            )}
            {scheduledAt && (
              <p className="text-[10px] text-white/70">
                Agendado para {format(scheduledAt, "dd/MM 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
          </div>

          {/* Coluna de ações (~16% de largura), ancorada na base junto à legenda */}
          <div className="flex flex-col items-center gap-3 shrink-0 text-white pb-1">
            {client?.profilePhoto ? (
              <img
                src={client.profilePhoto}
                alt={client.name}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-white"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full ring-2 ring-white overflow-hidden flex items-center justify-center text-[10px] font-bold"
                style={{ background: client?.color || '#374151' }}
              >
                {client?.name?.charAt(0) || "?"}
              </div>
            )}
            <div className="flex flex-col items-center gap-0.5">
              <Heart size={24} className="drop-shadow" />
              <span className="text-[10px]">123</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <MessageCircle size={24} className="drop-shadow" />
              <span className="text-[10px]">45</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <Bookmark size={24} className="drop-shadow" />
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <Share2 size={24} className="drop-shadow" />
            </div>
            <div className="w-8 h-8 rounded-full bg-black/40 border border-white/40 flex items-center justify-center">
              <Music2 size={16} className="drop-shadow" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
