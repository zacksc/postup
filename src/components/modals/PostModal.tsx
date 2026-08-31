import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X, Upload, Play, Layers, Circle, Image } from 'lucide-react'
import { cn } from '@/lib/utils'
import { compressImage } from '@/lib/compress-image'
import { uploadMedia, uploadOriginalToDrive } from '@/lib/media-storage'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, rectSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const POST_TYPES = [
    { value: 'reels', label: 'Reels', icon: Play },
    { value: 'carrossel', label: 'Carrossel', icon: Layers },
    { value: 'stories', label: 'Stories', icon: Circle },
    { value: 'foto', label: 'Foto', icon: Image },
]

interface MediaItem {
    id: string
    file: File
    url: string
    type: 'video' | 'image'
}

interface PostModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    clients: { id: string; name: string; color?: string }[]
}

function SortableMedia({ item, index, onRemove }: { item: MediaItem; index: number; onRemove: () => void }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
    const style = { transform: CSS.Transform.toString(transform), transition }

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="relative group aspect-square border rounded-lg overflow-hidden bg-muted cursor-grab">
            <img src={item.url} className="w-full h-full object-cover" />
            <div className="absolute top-1 left-1 bg-primary text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{index + 1}</div>
            <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }} className="absolute top-1 right-1 bg-black/50 hover:bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <X size={10} />
            </button>
        </div>
    )
}

export function PostModal({ isOpen, onClose, onSuccess, clients }: PostModalProps) {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [selectedClientId, setSelectedClientId] = useState('')
    const [selectedType, setSelectedType] = useState('reels')
    const [date, setDate] = useState('')
    const [time, setTime] = useState('')
    const [caption, setCaption] = useState('')
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);

    const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newItems: MediaItem[] = Array.from(e.target.files).map(file => ({
                id: Math.random().toString(36),
                file,
                url: URL.createObjectURL(file),
                type: file.type.startsWith('video') ? 'video' : 'image'
            }));
            setMediaItems(prev => [...prev, ...newItems]);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        const overId = over?.id;
        if (active.id !== overId) {
            setMediaItems((items) => {
                const oldIndex = items.findIndex(i => i.id === active.id);
                const newIndex = items.findIndex(i => i.id === overId);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    // Cleanup: revoga as URLs ao fechar o modal ou desmontar
    const cleanupMedia = () => {
        mediaItems.forEach(item => URL.revokeObjectURL(item.url));
    };

    const handleClose = () => {
        cleanupMedia();
        onClose();
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        const client = clients.find(c => c.id === selectedClientId)
        const driveContext = {
            client: client?.name,
            date,
            type: selectedType,
            sequence: selectedType === 'stories' ? `sequencia-${Date.now()}` : undefined,
        }

        try {
            const uploadedUrls: string[] = []
            const uploadedOriginalUrls: (string | null)[] = []
            for (const item of mediaItems) {
                const compressed = await compressImage(item.file)
                const fileName = `${Date.now()}_${item.file.name.replace(/\.[^.]+$/, '')}.webp`
                const [displayUrl, origUrl] = await Promise.all([
                    uploadMedia(compressed, fileName, { context: driveContext }),
                    uploadOriginalToDrive(item.file, fileName, { context: driveContext }),
                ])
                if (!displayUrl) throw new Error('Falha no upload')
                uploadedUrls.push(displayUrl)
                uploadedOriginalUrls.push(origUrl)
            }

        const { data: createdPost } = await supabase.from('posts').insert([{
            client_name: client?.name,
            client_color: client?.color,
            post_type: selectedType,
            scheduled_at: new Date(`${date}T${time}`).toISOString(),
            caption,
            status: 'aguardando',
            media_urls: uploadedUrls,
            user_id: user?.id,
        }]).select('id').single()

        if (createdPost && uploadedOriginalUrls.some(Boolean)) {
            await supabase.from('posts').update({ original_urls: uploadedOriginalUrls, user_id: user?.id }).eq('id', createdPost.id)
        }

            cleanupMedia(); // Limpa antes de encerrar
            onSuccess()
            onClose()
        } catch (err) { console.error(err) } finally { setLoading(false) }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="bg-card w-full max-w-md rounded-xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center shrink-0">
                    <h2 className="text-sm font-bold">Novo Post</h2>
                    <X size={16} className="cursor-pointer" onClick={handleClose} />
                </div>

                <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 overflow-y-auto flex-1">
                    <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecione o cliente..." />
                        </SelectTrigger>
                        <SelectContent>
                            {clients?.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="grid grid-cols-4 gap-2">
                        {POST_TYPES.map(type => (
                            <button key={type.value} type="button" onClick={() => setSelectedType(type.value)} className={cn("flex flex-col items-center gap-1.5 py-2 rounded-lg border", selectedType === type.value ? "bg-primary/10 border-primary" : "border-border")}>
                                <type.icon size={14} />
                                <span className="text-[9px]">{type.label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <input required type="date" className="h-9 rounded-lg border px-3 text-xs" onChange={e => setDate(e.target.value)} />
                        <input required type="time" className="h-9 rounded-lg border px-3 text-xs" onChange={e => setTime(e.target.value)} />
                    </div>

                    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <div className="grid grid-cols-3 gap-3">
                            <SortableContext items={mediaItems.map(i => i.id)} strategy={rectSortingStrategy}>
                                {mediaItems.map((item, index) => (
                                    <SortableMedia key={item.id} item={item} index={index} onRemove={() => setMediaItems(prev => prev.filter(i => i.id !== item.id))} />
                                ))}
                            </SortableContext>
                            <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted">
                                <Upload size={16} />
                                <input type="file" multiple className="hidden" onChange={handleFiles} />
                            </label>
                        </div>
                    </DndContext>

                    <textarea rows={3} className="w-full rounded-lg border p-2 text-xs" placeholder="Legenda..." onChange={e => setCaption(e.target.value)} />
                    <Button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Agendar Post'}</Button>
                </form>
            </div>
        </div>
    )
}