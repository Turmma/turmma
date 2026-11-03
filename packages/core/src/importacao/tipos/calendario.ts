import { createHash } from 'node:crypto'
import { CABECALHOS_DA_PLANILHA, TAMANHO_MAXIMO_DA_DESCRICAO_DO_EVENTO, TIPOS_DE_EVENTO_DO_CALENDARIO, type PreviaDaPlanilhaRow, type TipoDeEventoDoCalendario } from '@educa/shared'
import { z } from 'zod'
import type { AnoDeDestino, EventoGravado, EventoNovo } from '../importacao.repository.js'
import { lerTabela, normalizarTexto } from '../leitor.js'
import type { PlanoDaImportacao, PreviaDoTipo, TipoDeImportacao } from '../tipo.js'

/**
 * A planilha de calendário (F2, 4.0, RF10; Tech Spec, seção 5, "Gravar": "Calendário: substitui no ano"): início, fim, tipo e
 * descrição de cada feriado, recesso ou evento do ano. Reimportar deixa no ano exatamente os eventos da planilha: o que já
 * existe igual fica (com o mesmo id), o que é novo entra, e o que a planilha não traz sai. A prévia mostra os três.
 *
 * O evento não tem pessoa: o modelo pede para não escrever nome na descrição (`docs/lgpd.md`, "Evento do calendário").
 */

/** O que a planilha guarda de cada evento até o job: já lido, validado e com a descrição sem espaço a mais. */
const eventoGuardadoSchema = z.strictObject({
  tipo: z.enum(TIPOS_DE_EVENTO_DO_CALENDARIO),
  inicio: z.iso.date(),
  fim: z.iso.date(),
  descricao: z.string().min(1).max(TAMANHO_MAXIMO_DA_DESCRICAO_DO_EVENTO),
})
const guardadoSchema = z.array(eventoGuardadoSchema)

/** Os códigos de erro de linha do calendário: palavra de lista fechada, nunca texto com o dado da linha. */
type ErroDaLinhaDoCalendario = 'linha_incompleta' | 'data_invalida' | 'fim_antes_do_inicio' | 'fora_do_ano' | 'tipo_invalido' | 'descricao_vazia' | 'descricao_longa' | 'repetida'

const FORMATO_ISO = /^(\d{4})-(\d{2})-(\d{2})$/
const FORMATO_BRASILEIRO = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/

/** A data como `AAAA-MM-DD`, aceitando `AAAA-MM-DD` e `DD/MM/AAAA`; dia que não existe ("31/02/2026") é `null`. */
function lerData(texto: string): string | null {
  const limpo = texto.trim()
  const iso = FORMATO_ISO.exec(limpo)
  const brasileiro = FORMATO_BRASILEIRO.exec(limpo)
  const [ano, mes, dia] = iso !== null ? [iso[1], iso[2], iso[3]] : brasileiro !== null ? [brasileiro[3], brasileiro[2], brasileiro[1]] : []
  if (ano === undefined || mes === undefined || dia === undefined) return null
  const [a, m, d] = [Number(ano), Number(mes), Number(dia)]
  const data = new Date(Date.UTC(a, m - 1, d))
  if (data.getUTCFullYear() !== a || data.getUTCMonth() !== m - 1 || data.getUTCDate() !== d) return null
  return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
}

type EventoLido = z.infer<typeof eventoGuardadoSchema>

/** O período da linha, ou o código do erro: datas que existem, fim depois do início, tudo dentro do ano. */
function lerPeriodo(campos: Readonly<Record<string, string>>, ano: AnoDeDestino): { readonly inicio: string; readonly fim: string } | ErroDaLinhaDoCalendario {
  const inicio = lerData(campos['inicio'] ?? '')
  const fim = lerData(campos['fim'] ?? '')
  if (inicio === null || fim === null) return 'data_invalida'
  if (fim < inicio) return 'fim_antes_do_inicio'
  return inicio < ano.inicio || fim > ano.fim ? 'fora_do_ano' : { inicio, fim }
}

/** A descrição sem espaço a mais, ou o erro dela: não vazia, até 120 caracteres. O texto é do usuário, e por isso o erro vai num objeto. */
function lerDescricao(texto: string): { readonly descricao: string } | { readonly erro: ErroDaLinhaDoCalendario } {
  const descricao = texto.replace(/\s+/g, ' ').trim()
  if (descricao === '') return { erro: 'descricao_vazia' }
  return descricao.length > TAMANHO_MAXIMO_DA_DESCRICAO_DO_EVENTO ? { erro: 'descricao_longa' } : { descricao }
}

/** O evento de uma linha, ou o código do primeiro erro dela. A ordem dos testes é a ordem em que a coordenação os corrige. */
function lerLinha(campos: Readonly<Record<string, string>>, ano: AnoDeDestino): EventoLido | ErroDaLinhaDoCalendario {
  const periodo = lerPeriodo(campos, ano)
  if (typeof periodo === 'string') return periodo
  const tipo = TIPOS_DE_EVENTO_DO_CALENDARIO.find((candidato) => candidato === normalizarTexto(campos['tipo'] ?? ''))
  if (tipo === undefined) return 'tipo_invalido'
  const descricao = lerDescricao(campos['descricao'] ?? '')
  return 'erro' in descricao ? descricao.erro : { tipo, ...periodo, descricao: descricao.descricao }
}

/** A identidade de um evento: dois iguais nesta chave são o mesmo evento, na planilha e no banco. */
function chaveDoEvento(evento: { readonly tipo: TipoDeEventoDoCalendario; readonly inicio: string; readonly fim: string; readonly descricao: string }): string {
  return JSON.stringify([evento.tipo, evento.inicio, evento.fim, evento.descricao])
}

/**
 * O que a planilha faria no ano contra os eventos que ele tem: os da planilha que entram, e o que sai. A `assinatura` resume o
 * que a coordenação viu (o ano, os eventos da planilha e os do banco): o job só grava se, no passo (3), ela é a mesma.
 */
function planejarContra(ano: AnoDeDestino, eventos: readonly EventoLido[], existentes: readonly EventoGravado[]): PlanoDaImportacao {
  const daPlanilha = new Set(eventos.map(chaveDoEvento))
  const noBanco = new Map<string, string[]>()
  for (const existente of existentes) noBanco.set(chaveDoEvento(existente), [...(noBanco.get(chaveDoEvento(existente)) ?? []), existente.id])
  const entram: EventoNovo[] = eventos.filter((evento) => !noBanco.has(chaveDoEvento(evento)))
  // O que sai: o que a planilha não traz, e a cópia a mais de um evento que ela traz (o banco nunca cria, mas a mão pode).
  const saem: string[] = []
  for (const [chave, ids] of noBanco) saem.push(...(daPlanilha.has(chave) ? ids.slice(1) : ids))
  const assinatura = createHash('sha256')
    .update(JSON.stringify({ ano: [ano.id, ano.inicio, ano.fim], planilha: [...daPlanilha].sort(), banco: [...noBanco.keys()].sort(), copias: existentes.length - noBanco.size }))
    .digest('hex')
  return {
    assinatura,
    resumo: { entram: entram.length, ja_existem: daPlanilha.size - entram.length, eventos_removidos: saem.length },
    aplicar: async (gravacao) => {
      await gravacao.apagarEventos(ano.id, saem)
      await gravacao.inserirEventos(ano.id, entram)
    },
  }
}

export const tipoCalendario: TipoDeImportacao = {
  tipo: 'calendario',
  usaTurma: false,

  async previa(repositorio, ano, texto): Promise<PreviaDoTipo> {
    const tabela = lerTabela(texto, CABECALHOS_DA_PLANILHA.calendario)
    const existentes = await repositorio.eventosDoAno(ano.id)
    const noBanco = new Set(existentes.map(chaveDoEvento))
    const linhas: PreviaDaPlanilhaRow[] = []
    const validos: EventoLido[] = []
    const vistos = new Set<string>()
    for (const { linha, campos } of tabela.linhas) {
      const lido = campos === null ? 'linha_incompleta' : lerLinha(campos, ano)
      if (typeof lido === 'string') {
        linhas.push({ linha, resultado: 'erro', erro: lido })
      } else if (vistos.has(chaveDoEvento(lido))) {
        linhas.push({ linha, resultado: 'erro', erro: 'repetida' })
      } else {
        vistos.add(chaveDoEvento(lido))
        validos.push(lido)
        linhas.push({ linha, resultado: noBanco.has(chaveDoEvento(lido)) ? 'ja_existe' : 'entra' })
      }
    }
    const plano = planejarContra(ano, validos, existentes)
    return { linhas, contagens: plano.resumo, candidatos: [], guardado: validos, assinatura: plano.assinatura }
  },

  async planejar(repositorio, ano, guardado) {
    const lido = guardadoSchema.safeParse(guardado)
    return lido.success ? planejarContra(ano, lido.data, await repositorio.eventosDoAno(ano.id)) : undefined
  },
}
