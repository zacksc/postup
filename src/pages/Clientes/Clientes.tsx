import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Filter, AlertCircle, RefreshCw, Archive } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ClientCard } from '@/components/client/ClientCard'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/use-auth'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Client } from '@/types/client'

export default function ClientesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const carregarClientes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase.from('clients').select('*')
      if (user) query = query.eq('user_id', user.id)
      const { data, error } = await query
      if (error) throw error
      setClients(data || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar clientes'
      setError(message)
      toast.error('Não foi possível carregar os clientes')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    carregarClientes()
  }, [carregarClientes])

  const filteredClients = clients.filter(client => {
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch = (
      client.name.toLowerCase().includes(searchLower) ||
      client.handle?.toLowerCase().includes(searchLower)
    )
    if (showArchived) {
      return matchesSearch && client.archived_at
    }
    return matchesSearch && !client.archived_at
  })

const archivedCount = clients.filter(c => c.archived_at).length

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8 max-w-[1440px] mx-auto pb-24">

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Meus Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie as marcas e acompanhe o volume de entregas do mês.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 border rounded-xl text-sm font-medium transition-colors",
              showArchived ? "bg-muted border-border text-foreground" : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <Archive size={16} />
            Arquivados ({archivedCount})
          </button>
          <button onClick={() => navigate('/clientes/novo')} className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors w-full md:w-auto">
            <Plus size={18} />
            Novo Cliente
          </button>
        </div>
      </header>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-card border border-border p-3 rounded-2xl shadow-sm">
        <div className="relative flex-1 w-full">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Search size={18} className="text-muted-foreground" />
          </div>
          <input
            type="text"
            placeholder="Buscar cliente por nome ou @..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
        </div>

        <button className="flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary text-secondary-foreground font-bold rounded-xl hover:bg-secondary/80 transition-colors w-full sm:w-auto">
          <Filter size={18} />
          <span className="sm:hidden md:inline">Filtrar</span>
        </button>
      </div>

      {loading ? (
        <div className="space-y-4 py-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 border-2 border-dashed border-destructive/30 rounded-3xl text-center bg-destructive/5">
          <div className="p-4 bg-destructive/10 rounded-full mb-4">
            <AlertCircle size={32} className="text-destructive" />
          </div>
          <h3 className="text-lg font-bold mb-1">Erro ao carregar dados</h3>
          <p className="text-sm text-muted-foreground max-w-[400px] mb-4">
            Não foi possível conectar ao banco de dados. Verifique se o Supabase está ativo.
          </p>
          <button
            onClick={carregarClientes}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            <RefreshCw size={16} />
            Tentar novamente
          </button>
        </div>
      ) : filteredClients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 stagger">
          {filteredClients.map(client => (
            <div
              key={client.id}
              className="transition-transform hover:-translate-y-1 duration-200 cursor-pointer"
              onClick={() => navigate(`/clients/${client.id}`)}
            >
              <ClientCard client={{
                id: client.id,
                name: client.name,
                handle: client.handle ? `@${client.handle.replace('@', '')}` : '',
                color: (client as unknown as { color?: string }).color || undefined,
                profilePhoto: client.profile_photo || undefined,
              }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 px-4 border-2 border-dashed border-border rounded-3xl text-center bg-secondary/20">
          <div className="p-4 bg-background rounded-full mb-4">
            {showArchived ? <Archive size={32} className="text-muted-foreground opacity-50" /> : <Search size={32} className="text-muted-foreground opacity-50" />}
          </div>
          <h3 className="text-lg font-bold mb-1">
            {showArchived ? 'Nenhum cliente arquivado' : (searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado')}
          </h3>
          <p className="text-sm text-muted-foreground max-w-[300px]">
            {showArchived
              ? 'Clientes arquivados aparecerão aqui.'
              : (searchTerm
                ? `Não encontramos nenhum cliente com o termo "${searchTerm}".`
                : 'Clique em "Novo Cliente" para começar.')}
          </p>
        </div>
      )}
    </div>
  )
}
