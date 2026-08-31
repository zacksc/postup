import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X, Download, TrendingUp, Users, Eye, MessageCircle, Bookmark, Share2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { ClientMonthlyMetrics } from '@/types/client'

interface MonthlyReportProps {
  clientId: string
  clientName: string
  open: boolean
  onClose: () => void
}

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(new Date().getFullYear(), i, 1)
  return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy', { locale: ptBR }) }
})

export function MonthlyReport({ clientId, clientName, open, onClose }: MonthlyReportProps) {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [metrics, setMetrics] = useState<Partial<ClientMonthlyMetrics>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !clientId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('client_monthly_metrics')
        .select('*')
        .eq('client_id', clientId)
        .eq('month', selectedMonth)
        .single()
      if (!cancelled) {
        if (data) setMetrics(data)
        else setMetrics({ month: selectedMonth })
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [open, clientId, selectedMonth])

  async function saveMetrics() {
    setSaving(true)
    const { error } = await supabase
      .from('client_monthly_metrics')
      .upsert({
        client_id: clientId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        month: selectedMonth,
        ...metrics,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'client_id,month' })
    if (error) {
      toast.error('Erro ao salvar métricas')
    } else {
      toast.success('Métricas salvas!')
    }
    setSaving(false)
  }

  function generateReport() {
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Relatório ${clientName} - ${format(new Date(selectedMonth + '-01'), 'MMMM yyyy', { locale: ptBR })}</title>
<style>
  body { font-family: 'Roboto', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #0a0a0a; }
  h1 { font-size: 24px; border-bottom: 2px solid #0a0a0a; padding-bottom: 8px; }
  h2 { font-size: 16px; margin-top: 32px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; }
  .metric { display: inline-block; width: 45%; margin: 8px 2%; padding: 12px; border: 1px solid #e5e5e5; }
  .metric .value { font-size: 24px; font-weight: bold; }
  .metric .label { font-size: 11px; color: #6b7280; text-transform: uppercase; }
  .notes { background: #f5f5f5; padding: 16px; margin-top: 16px; }
  @media print { body { margin: 0; } }
</style></head><body>
<h1>${clientName}</h1>
<p>Relatório Mensal — ${format(new Date(selectedMonth + '-01'), 'MMMM yyyy', { locale: ptBR })}</p>

<h2>Métricas</h2>
<div class="metric"><div class="value">${metrics.followers ?? '—'}</div><div class="label">Seguidores</div></div>
<div class="metric"><div class="value">${metrics.following ?? '—'}</div><div class="label">Seguindo</div></div>
<div class="metric"><div class="value">${metrics.new_followers ?? '—'}</div><div class="label">Novos seguidores</div></div>
<div class="metric"><div class="value">${metrics.reach ?? '—'}</div><div class="label">Alcance</div></div>
<div class="metric"><div class="value">${metrics.impressions ?? '—'}</div><div class="label">Impressões</div></div>
<div class="metric"><div class="value">${metrics.engagement_rate ?? '—'}%</div><div class="label">Engajamento</div></div>
<div class="metric"><div class="value">${metrics.profile_visits ?? '—'}</div><div class="label">Visitas ao perfil</div></div>
<div class="metric"><div class="value">${metrics.comments ?? '—'}</div><div class="label">Comentários</div></div>
<div class="metric"><div class="value">${metrics.saves ?? '—'}</div><div class="label">Salvamentos</div></div>
<div class="metric"><div class="value">${metrics.shares ?? '—'}</div><div class="label">Compartilhamentos</div></div>

${metrics.notes ? `<h2>Observações</h2><div class="notes">${metrics.notes}</div>` : ''}
${metrics.goals_next ? `<h2>Próximos Caminhos</h2><div class="notes">${metrics.goals_next}</div>` : ''}

<p style="margin-top:40px;font-size:11px;color:#9ca3af">Gerado por PostUp em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
</body></html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-bold">Relatório Mensal — {clientName}</h2>
          <button onClick={onClose} className="p-1 hover:bg-secondary"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={saveMetrics} disabled={saving} size="sm">
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button onClick={generateReport} variant="outline" size="sm">
              <Download size={14} className="mr-1" /> Gerar Relatório
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { key: 'followers', label: 'Seguidores', icon: Users },
                { key: 'following', label: 'Seguindo', icon: Users },
                { key: 'new_followers', label: 'Novos seguidores', icon: TrendingUp },
                { key: 'reach', label: 'Alcance', icon: Eye },
                { key: 'impressions', label: 'Impressões', icon: Eye },
                { key: 'engagement_rate', label: 'Engajamento %', icon: TrendingUp },
                { key: 'profile_visits', label: 'Visitas ao perfil', icon: Users },
                { key: 'comments', label: 'Comentários', icon: MessageCircle },
                { key: 'saves', label: 'Salvamentos', icon: Bookmark },
                { key: 'shares', label: 'Compartilhamentos', icon: Share2 },
              ].map(({ key, label, icon: Icon }) => (
                <div key={key} className="border border-border p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon size={12} className="text-muted-foreground" />
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">{label}</span>
                  </div>
                  <input
                    type="number"
                    value={(metrics as Record<string, unknown>)[key] as number ?? ''}
                    onChange={e => setMetrics({ ...metrics, [key]: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full bg-secondary/30 border border-border px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Observações</label>
            <textarea
              value={metrics.notes || ''}
              onChange={e => setMetrics({ ...metrics, notes: e.target.value })}
              rows={3}
              className="w-full bg-secondary/30 border border-border px-3 py-2 text-sm outline-none resize-none focus:ring-1 focus:ring-primary"
              placeholder="Notas sobre o mês..."
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-muted-foreground mb-1 block">Próximos Caminhos</label>
            <textarea
              value={metrics.goals_next || ''}
              onChange={e => setMetrics({ ...metrics, goals_next: e.target.value })}
              rows={3}
              className="w-full bg-secondary/30 border border-border px-3 py-2 text-sm outline-none resize-none focus:ring-1 focus:ring-primary"
              placeholder="Metas e ações para o próximo mês..."
            />
          </div>
        </div>
      </div>
    </div>
  )
}
