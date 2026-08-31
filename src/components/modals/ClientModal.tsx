import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { Client } from '@/types/client'

interface ClientModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  clientToEdit?: Partial<Client> | null
}

export function ClientModal({ isOpen, onClose, onSuccess, clientToEdit }: ClientModalProps) {
  const [name, setName] = useState(clientToEdit?.name || '')
  const [handle, setHandle] = useState(clientToEdit?.handle || '')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error('O nome do cliente é obrigatório')
      return
    }

    setLoading(true)
    try {
      if (clientToEdit) {
        const { error } = await supabase.from('clients').update({
          name: name.trim(),
          handle: handle.trim(),
        }).eq('id', clientToEdit.id)
        if (error) throw error
        toast.success('Cliente atualizado com sucesso!')
      } else {
        const { error } = await supabase.from('clients').insert([{
          name: name.trim(),
          handle: handle.trim(),
          metrics: {},
          contacts: [],
          branding: { fonts: [], logos: [], palette: [] },
          links: { canva: '', drive: '', linktree: '', meetings: [] },
          contracts: [],
        }])
        if (error) throw error
        toast.success('Cliente cadastrado com sucesso!')
      }
      onSuccess()
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar cliente'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{clientToEdit ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <Input placeholder="Nome do Cliente" value={name} onChange={e => setName(e.target.value)} />
          <Input placeholder="@handle" value={handle} onChange={e => setHandle(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
