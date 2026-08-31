/**
 * Fluxo de pastas no Google Drive (decisão D21).
 *
 * O usuário configura um TEMPLATE de pastas (default
 * `{cliente}/{ano}/{mes_completo}/{dia}/{tipo}`) que é expandido com o contexto de
 * cada upload de post. Uma pasta RAIZ (default `Postup`) agrupa todos os uploads
 * com contexto, unificando os clientes em um só lugar. A função `buildFolderPath`
 * é pura — testável sem mock de Supabase — e é usada tanto pelo upload
 * (`media-storage`) quanto pelo preview na tela de Configurações.
 *
 * Placeholders:
 *  - {cliente}      → nome do cliente (sanitizado)
 *  - {ano}          → ano do agendamento (YYYY)
 *  - {mes}          → mês como número (MM, ex.: 08)
 *  - {mes_nome}     → mês por extenso (ex.: AGOSTO)
 *  - {mes_completo} → número + nome (ex.: 08_AGOSTO)
 *  - {semana}       → semana do mês (Semana_1, Semana_2...)
 *  - {dia}          → dia (DD)
 *  - {tipo}         → reels / fotos / carrossel / stories / design / outros
 *  - {agencia}      → agência configurada nas Configurações
 *  - {equipe}       → equipe configurada nas Configurações
 *  - {plataforma}   → rede social do post (tiktok, instagram...)
 *  - {sequencia}    → nome da sequência (stories em ordem de postagem)
 *
 * Quando o contexto traz `sequence` mas o template não tem `{sequencia}`, a
 * sequência é anexada ao final do caminho (ex.: .../stories/sequencia-123).
 * Valores ausentes usam "Sem cliente"/data de hoje/"outros"/"instagram" para
 * nunca gerar pastas vazias. Placeholders de agencia/equipe vazios são removidos
 * do caminho (o segmento não aparece).
 */

export const DEFAULT_FOLDER_TEMPLATE = '{cliente}/{ano}/{mes_completo}/{dia}/{tipo}'

/** Pasta raiz no Drive que agrupa todos os uploads com contexto (default "Postup"). */
export const DEFAULT_ROOT_FOLDER = 'Postup'

export const FOLDER_PLACEHOLDERS = [
  { key: 'cliente', label: 'Cliente' },
  { key: 'ano', label: 'Ano' },
  { key: 'mes', label: 'Mês (número)' },
  { key: 'mes_nome', label: 'Mês (nome)' },
  { key: 'mes_completo', label: 'Mês (número_nome)' },
  { key: 'semana', label: 'Semana do mês' },
  { key: 'dia', label: 'Dia' },
  { key: 'tipo', label: 'Tipo (reels/fotos/carrossel/stories)' },
  { key: 'agencia', label: 'Agência' },
  { key: 'equipe', label: 'Equipe' },
  { key: 'plataforma', label: 'Rede social (tiktok/instagram)' },
  { key: 'sequencia', label: 'Sequência (stories)' },
] as const

// Mapeia o `post_type` do app para o nome da pasta. `design` também existe.
const TYPE_FOLDERS: Record<string, string> = {
  reels: 'reels',
  foto: 'fotos',
  carrossel: 'carrossel',
  stories: 'stories',
  design: 'design',
}

const MESES_EXTENSO = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
]

export interface FolderContext {
  client?: string
  /** Data no formato YYYY-MM-DD (data de agendamento do post). Sem valor → hoje. */
  date?: string
  type?: string
  /** Identificador da sequência (ex.: post de stories em ordem). Anexa uma subpasta. */
  sequence?: string
  /** Agência fixa (Configurações → Armazenamento). Usada pelo placeholder {agencia}. */
  agencia?: string
  /** Equipe fixa (Configurações → Armazenamento). Usada pelo placeholder {equipe}. */
  equipe?: string
  /** Rede social do post (tiktok, instagram...). Usada pelo placeholder {plataforma}. */
  plataforma?: string
}

// Caracteres proibidos no nome de pasta do Drive
const INVALID_SEGMENT = /[\\/:*?"<>|]/g

function sanitizeSegment(value: string): string {
  const cleaned = value.replace(INVALID_SEGMENT, ' ').replace(/\s+/g, ' ').trim()
  return cleaned || 'Sem nome'
}

const pad = (n: number) => String(n).padStart(2, '0')

const PLACEHOLDER_KEYS = [
  'cliente', 'ano', 'mes', 'mes_nome', 'mes_completo', 'semana',
  'dia', 'tipo', 'agencia', 'equipe', 'plataforma', 'sequencia',
]

export function buildFolderPath(template: string | undefined, ctx: FolderContext = {}): string {
  const tpl = template && template.trim() ? template.trim() : DEFAULT_FOLDER_TEMPLATE
  const date = ctx.date ? new Date(`${ctx.date}T12:00:00`) : new Date()
  if (Number.isNaN(date.getTime())) return buildFolderPath(undefined, { ...ctx, date: undefined })

  const mesNumero = pad(date.getMonth() + 1)
  const mesNome = MESES_EXTENSO[date.getMonth()] || ''
  const valores: Record<string, string> = {
    cliente: sanitizeSegment(ctx.client || 'Sem cliente'),
    ano: String(date.getFullYear()),
    mes: mesNumero,
    mes_nome: mesNome,
    mes_completo: `${mesNumero}_${mesNome}`,
    semana: `Semana_${Math.ceil(date.getDate() / 7)}`,
    dia: pad(date.getDate()),
    tipo: TYPE_FOLDERS[ctx.type || ''] || 'outros',
    agencia: ctx.agencia ? sanitizeSegment(ctx.agencia) : '',
    equipe: ctx.equipe ? sanitizeSegment(ctx.equipe) : '',
    plataforma: sanitizeSegment(ctx.plataforma || 'instagram'),
    sequencia: ctx.sequence ? sanitizeSegment(ctx.sequence) : '',
  }

  const re = new RegExp(`\\{(${PLACEHOLDER_KEYS.join('|')})\\}`, 'g')
  let path = tpl.replace(re, (_m, key: string) => {
    if (key === 'sequencia' && !valores.sequencia) return 'sem-sequencia'
    return valores[key] ?? ''
  })

  // Sem placeholder de sequência no template mas com sequence no contexto → anexa.
  if (!tpl.includes('{sequencia}') && valores.sequencia) {
    path = path ? `${path}/${valores.sequencia}` : valores.sequencia
  }

  return path
    .split('/')
    .map(p => p.trim())
    .filter(Boolean)
    .join('/')
}
