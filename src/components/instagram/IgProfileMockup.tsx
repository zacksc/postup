import { useState } from 'react'
import { cn } from '@/lib/utils'
import { MediaPreview } from '@/components/post/MediaPreview'
import { Play, Layers, Image as ImageIcon, Circle, Paintbrush, Calendar, Tag } from 'lucide-react'

export interface IgProfileClient {
  name: string
  handle?: string | null
  profilePhoto?: string | null
  followers?: number | string | null
  following?: number | string | null
  bio?: string | null
}

export interface IgProfilePost {
  id: string
  mediaUrl?: string | null
  postType?: string
  status?: string
}

const TYPE_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  reels: Play,
  carrossel: Layers,
  foto: ImageIcon,
  stories: Circle,
  design: Paintbrush,
}

const STATUS_CLASS: Record<string, string> = {
  publicado: 'bg-blue-500',
  aprovado: 'bg-emerald-500',
  aguardando: 'bg-orange-500',
  alteracao: 'bg-red-500',
  rascunho: 'bg-muted-foreground',
}

function typeIcon(type: string, size = 16) {
  const Icon = TYPE_ICONS[type.toLowerCase()] || ImageIcon
  return <Icon size={size} />
}

export default function IgProfileMockup({ client, posts, width = 300 }: { client: IgProfileClient; posts: IgProfilePost[]; width?: number }) {
  const [tab, setTab] = useState<'grid' | 'tags'>('grid')

  return (
    <div className="rounded-[32px] overflow-hidden border-[3px] border-[#222] shadow-2xl bg-black" style={{ width }}>
      {/* Notch */}
      <div className="h-8 bg-black flex items-center justify-center relative shrink-0">
        <div className="w-[80px] h-1 rounded-full bg-white/20" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[20px] bg-black rounded-b-2xl" />
      </div>
      {/* IG profile header */}
      <div className="bg-white px-4 pt-4 pb-3 shrink-0">
        <div className="flex items-center gap-3 mb-3">
          {client.profilePhoto ? (
            <img src={client.profilePhoto} alt="" className="w-[56px] h-[56px] rounded-full object-cover shrink-0 border-2 border-gray-100" />
          ) : (
            <div className="w-[56px] h-[56px] rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center text-white font-bold text-base shrink-0">
              {client.name?.charAt(0) || '?'}
            </div>
          )}
          <div className="flex flex-1 justify-around">
            <div className="flex flex-col items-center"><span className="text-[14px] font-bold text-black">{posts.length}</span><span className="text-[10px] text-gray-500">posts</span></div>
            <div className="flex flex-col items-center"><span className="text-[14px] font-bold text-black">{client.followers ?? '—'}</span><span className="text-[10px] text-gray-500">seg.</span></div>
            <div className="flex flex-col items-center"><span className="text-[14px] font-bold text-black">{client.following ?? '—'}</span><span className="text-[10px] text-gray-500">seg.</span></div>
          </div>
        </div>
        <p className="text-[12px] font-bold text-black">{client.name}</p>
        {client.bio ? (
          <p className="text-[11px] text-gray-700 leading-snug mb-2">{client.bio}</p>
        ) : (
          <p className="text-[11px] text-gray-700 leading-snug mb-2 flex items-center gap-1">Agendamento de conteúdo <Calendar size={11} /></p>
        )}
        <div className="w-full py-2 text-center text-[12px] font-semibold bg-blue-50 border border-blue-200 rounded-lg text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer">Seguir</div>
      </div>
      {/* IG tabs */}
      <div className="flex bg-white border-t border-gray-100 shrink-0">
        <button
          onClick={() => setTab('grid')}
          className={cn('flex-1 flex items-center justify-center py-2.5 text-lg transition-colors', tab === 'grid' ? 'border-b-2 border-black text-black' : 'text-gray-400')}
        >
          ⊞
        </button>
        <button
          onClick={() => setTab('tags')}
          className={cn('flex-1 flex items-center justify-center py-2.5 transition-colors', tab === 'tags' ? 'border-b-2 border-black text-black' : 'text-gray-400')}
        >
          <Tag size={20} />
        </button>
      </div>
      {/* Grid — apenas os posts, sem espaços vazios */}
      <div className="overflow-y-auto max-h-[420px]">
        <div className="grid grid-cols-3 gap-[1px] bg-gray-200">
          {posts.map((p) => (
            <div key={p.id} className="aspect-[4/5] bg-gray-100 relative overflow-hidden">
              {p.mediaUrl ? (
                <MediaPreview url={p.mediaUrl} thumbnail className="w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-lg">{typeIcon(p.postType || 'foto', 18)}</div>
              )}
              {p.status !== 'publicado' && <div className="absolute inset-0 border-2 border-white/40 border-dashed pointer-events-none" />}
              <div className={cn('absolute top-1 right-1 w-[14px] h-[14px] rounded-full border-2 border-white shadow-sm', STATUS_CLASS[p.status || ''] || 'bg-muted')} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
