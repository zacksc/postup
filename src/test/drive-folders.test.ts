import { describe, it, expect } from 'vitest'
import { buildFolderPath, DEFAULT_FOLDER_TEMPLATE, DEFAULT_ROOT_FOLDER } from '@/lib/drive-folders'

describe('buildFolderPath (fluxo de pastas D21)', () => {
  it('expande o template padrão com cliente, data, mês por extenso e tipo', () => {
    const path = buildFolderPath(DEFAULT_FOLDER_TEMPLATE, {
      client: 'Loja Bella',
      date: '2026-08-04',
      type: 'reels',
    })
    expect(path).toBe('Loja Bella/2026/08_AGOSTO/04/reels')
  })

  it('anexa a sequência ao final quando há sequence mas o template não tem {sequencia}', () => {
    const path = buildFolderPath(DEFAULT_FOLDER_TEMPLATE, {
      client: 'Loja Bella',
      date: '2026-08-04',
      type: 'stories',
      sequence: 'sequencia-01',
    })
    expect(path).toBe('Loja Bella/2026/08_AGOSTO/04/stories/sequencia-01')
  })

  it('mapaia post_type para pastas amigáveis', () => {
    expect(buildFolderPath('{tipo}', { type: 'foto' })).toBe('fotos')
    expect(buildFolderPath('{tipo}', { type: 'carrossel' })).toBe('carrossel')
    expect(buildFolderPath('{tipo}', { type: 'design' })).toBe('design')
    expect(buildFolderPath('{tipo}', { type: 'desconhecido' })).toBe('outros')
  })

  it('usa data de hoje quando o contexto não tem data', () => {
    const path = buildFolderPath('{ano}/{mes}/{dia}', {})
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    expect(path).toBe(`${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())}`)
  })

  it('usa "Sem cliente" quando o nome não vem no contexto', () => {
    const path = buildFolderPath('{cliente}/{tipo}', { type: 'reels' })
    expect(path).toBe('Sem cliente/reels')
  })

  it('sanitiza caracteres inválidos do nome do cliente', () => {
    const path = buildFolderPath('{cliente}', { client: 'Loja "Top" / Verão' })
    expect(path).toBe('Loja Top Verão')
  })

  it('remove segmentos vazios e espaços em excesso', () => {
    const path = buildFolderPath('  {cliente} /  / {tipo}  ', { client: 'X', type: 'foto' })
    expect(path).toBe('X/fotos')
  })

  it('usa sem-sequencia quando o template tem {sequencia} e não há sequence', () => {
    const path = buildFolderPath('{cliente}/{tipo}/{sequencia}', { client: 'X', type: 'stories' })
    expect(path).toBe('X/stories/sem-sequencia')
  })

  it('suporta {mes} (número) e {mes_nome} separados', () => {
    const ctx = { client: 'X', date: '2026-08-04', type: 'reels' }
    expect(buildFolderPath('{cliente}/{ano}/{mes}/{mes_nome}/{dia}', ctx)).toBe('X/2026/08/AGOSTO/04')
    expect(buildFolderPath('{cliente}/{mes_nome}/{tipo}', ctx)).toBe('X/AGOSTO/reels')
  })

  it('suporta {semana} como Semana_N', () => {
    const ctx = { client: 'X', date: '2026-08-04', type: 'reels' }
    expect(buildFolderPath('{cliente}/{mes_completo}/{semana}', ctx)).toBe('X/08_AGOSTO/Semana_1')
  })

  it('preenche {agencia} e {equipe} do contexto', () => {
    const ctx = { client: 'X', date: '2026-08-04', type: 'reels', agencia: 'Agência Norte', equipe: 'Equipe Alpha' }
    expect(buildFolderPath('{agencia}/{cliente}/{equipe}/{tipo}', ctx)).toBe('Agência Norte/X/Equipe Alpha/reels')
  })

  it('omite agencia/equipe quando o placeholder está no template e o valor é vazio', () => {
    const ctx = { client: 'X', date: '2026-08-04', type: 'reels', agencia: '', equipe: '' }
    expect(buildFolderPath('{cliente}/{agencia}/{equipe}/{tipo}', ctx)).toBe('X/reels')
  })

  it('preenche {plataforma} com a rede social do post (default instagram)', () => {
    expect(buildFolderPath('{cliente}/{plataforma}', { client: 'X', plataforma: 'tiktok' })).toBe('X/tiktok')
    expect(buildFolderPath('{cliente}/{plataforma}', { client: 'X' })).toBe('X/instagram')
  })
})

describe('DEFAULT_ROOT_FOLDER', () => {
  it('agrupa todos os uploads sob a pasta raiz Postup', () => {
    expect(DEFAULT_ROOT_FOLDER).toBe('Postup')
  })
})
