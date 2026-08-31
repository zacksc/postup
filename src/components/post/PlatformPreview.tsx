import { IgPreview } from '@/components/post/IgPreview';
import { TikTokPreview } from '@/components/post/TikTokPreview';
import { StoriesPreview } from '@/components/post/StoriesPreview';
import { ReelsPreview } from '@/components/post/ReelsPreview';
import type { PostPreviewData } from '@/components/post/preview-types';

/**
 * Escolhe a preview correta conforme plataforma + tipo do post:
 *  - stories      → StoriesPreview (9:16, com barras de progresso)
 *  - reels        → ReelsPreview   (9:16, topo limpo + coluna lateral + base com "Seguir")
 *  - tiktok       → TikTokPreview  (9:16, com abas "Seguindo/Para você" + coluna lateral)
 *  - instagram    → IgPreview      (feed; a mídia se adapta à proporção real)
 * O tamanho é definido pelo contêiner (className opcional); as previews verticais
 * usam w-full + aspect-ratio fixo e a do feed se ajusta ao conteúdo.
 */
interface PlatformPreviewProps {
  platform: string;
  post: PostPreviewData;
  className?: string;
}

export function PlatformPreview({ platform, post, className }: PlatformPreviewProps) {
  if (post.type === 'stories') {
    return <StoriesPreview post={post} className={className} />;
  }
  if (post.type === 'reels') {
    return <ReelsPreview post={post} className={className} />;
  }
  if (platform === 'tiktok') {
    return <TikTokPreview post={post} className={className} />;
  }
  return (
    <IgPreview
      post={post}
      className={className}
    />
  );
}
