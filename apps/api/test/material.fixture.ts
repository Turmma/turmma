import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { CAMINHO_DO_MATERIAL } from '../../../tools/demonstracao/gerar-material.ts'
import { ExtractionQueue } from '../src/material/extraction-queue.js'
import type { ApiDeTeste, RespostaHttp } from './test-api.js'
import type { BancadaDeSessoes, SessaoDeTeste } from './sessao.fixture.js'

/** O PDF de demonstração commitado: seis páginas de "Química 2 — Capítulo 7: Estequiometria". */
export const PDF_DE_DEMONSTRACAO = readFileSync(CAMINHO_DO_MATERIAL)

/**
 * O PDF de demonstração com um comentário no fim: o mesmo texto, com outro resumo (`sha256`). Serve ao teste que
 * precisa de dois materiais iguais no conteúdo e diferentes como arquivo.
 */
export function variacaoDoPdf(): Buffer {
  return Buffer.concat([PDF_DE_DEMONSTRACAO, Buffer.from(`\n% ${randomUUID()}\n`, 'latin1')])
}

/** Um PDF de verdade, com uma página e nenhum texto: o que um scanner entrega sem OCR, menos a imagem. */
export function pdfSemTexto(): Buffer {
  return Buffer.from(
    [
      '%PDF-1.4',
      `% ${randomUUID()}`,
      '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
      '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj',
      'trailer<</Root 1 0 R>>',
      '%%EOF',
      '',
    ].join('\n'),
    'latin1',
  )
}

/** A assinatura de PDF e o resto lixo: o que um envio corrompido deixa. */
export function pdfCorrompido(): Buffer {
  return Buffer.concat([Buffer.from('%PDF-1.7\n', 'latin1'), randomBytes(2048)])
}

export interface CamposDoEnvio {
  readonly titulo?: string
  readonly disciplinaId: string
  readonly titularidade?: string
  readonly licenciante?: string
  readonly licenca?: string
  readonly declaracao?: string
  /** Campo que o contrato não tem, para o teste do contrato estrito. */
  readonly extra?: Readonly<Record<string, string>>
}

export interface OpcoesDoEnvio {
  /** O arquivo; `null` manda o pedido sem arquivo nenhum. */
  readonly arquivo?: Buffer | null
  readonly nomeDoArquivo?: string
  readonly tipo?: string
  /** O arquivo antes dos campos no multipart: o servidor só conhece a licença depois de já ter recebido os bytes. */
  readonly arquivoPrimeiro?: boolean
  /** O nome do campo do arquivo no multipart; a tela manda `arquivo`. */
  readonly campoDoArquivo?: string
  /** Quantas vezes o arquivo vai no multipart, no mesmo campo; a tela manda uma. */
  readonly copias?: number
}

/** `POST /v1/materiais` como a tela manda: multipart, com os campos antes do arquivo. */
export async function enviarMaterial(api: ApiDeTeste, sessao: Pick<SessaoDeTeste, 'token'>, campos: CamposDoEnvio, opcoes: OpcoesDoEnvio = {}): Promise<RespostaHttp & { retryAfter: string | null }> {
  const { arquivo = PDF_DE_DEMONSTRACAO, nomeDoArquivo = 'capitulo.pdf', tipo = 'application/pdf', arquivoPrimeiro = false, campoDoArquivo = 'arquivo', copias = 1 } = opcoes
  const formulario = new FormData()
  const anexar = (): void => {
    if (arquivo === null) return
    for (let copia = 0; copia < copias; copia += 1) formulario.append(campoDoArquivo, new Blob([new Uint8Array(arquivo)], { type: tipo }), nomeDoArquivo)
  }
  if (arquivoPrimeiro) anexar()
  const texto: Record<string, string | undefined> = {
    titulo: campos.titulo ?? 'Material sintético de teste',
    disciplinaId: campos.disciplinaId,
    titularidade: campos.titularidade ?? 'escola',
    licenciante: campos.licenciante,
    licenca: campos.licenca ?? 'autoria_da_escola',
    declaracao: campos.declaracao ?? 'true',
    ...campos.extra,
  }
  for (const [campo, valor] of Object.entries(texto)) if (valor !== undefined) formulario.append(campo, valor)
  if (!arquivoPrimeiro) anexar()
  const resposta = await fetch(`${api.url}/v1/materiais`, { method: 'POST', headers: { Authorization: `Bearer ${sessao.token}` }, body: formulario })
  const corpo = await resposta.text()
  return {
    status: resposta.status,
    corpo: corpo === '' ? {} : (JSON.parse(corpo) as RespostaHttp['corpo']),
    setCookie: resposta.headers.getSetCookie(),
    retryAfter: resposta.headers.get('Retry-After'),
  }
}

/** Espera a fila de extração desta instância esvaziar: o material já saiu de `processando`. */
export function esperarExtracao(api: ApiDeTeste): Promise<void> {
  return api.app.get(ExtractionQueue).ociosa()
}

export interface LinhaDoMaterial {
  readonly id: string
  readonly disciplina_id: string
  readonly titulo: string
  readonly estado: string
  readonly falha: string | null
  readonly paginas: number | null
  readonly sha256: string
  readonly tamanho_bytes: number
  readonly declaracao: boolean
  readonly enviado_por: string | null
  readonly excluido_por: string | null
  readonly excluido_em: Date | null
}

/** As linhas de `material` da escola, em ordem de envio, com as excluídas. */
export async function materiaisDa(bancada: BancadaDeSessoes, escolaId: string): Promise<LinhaDoMaterial[]> {
  const { rows } = await bancada.pool.query<LinhaDoMaterial>(
    'select id, disciplina_id, titulo, estado, falha, paginas, sha256, tamanho_bytes, declaracao, enviado_por, excluido_por, excluido_em from material where escola_id = $1 order by id',
    [escolaId],
  )
  return rows
}

export interface LinhaDoTrecho {
  readonly material_id: string
  readonly disciplina_id: string
  readonly pagina: number
  readonly texto: string
}

export async function trechosDa(bancada: BancadaDeSessoes, escolaId: string): Promise<LinhaDoTrecho[]> {
  const { rows } = await bancada.pool.query<LinhaDoTrecho>('select material_id, disciplina_id, pagina, texto from trecho where escola_id = $1 order by material_id, pagina', [escolaId])
  return rows
}

export interface LinhaDeAuditoria {
  readonly entidade: string
  readonly entidade_id: string
  readonly autor_usuario_id: string | null
  readonly antes: unknown
  readonly depois: unknown
}

export async function auditoriaDa(bancada: BancadaDeSessoes, escolaId: string, acao: string): Promise<LinhaDeAuditoria[]> {
  const { rows } = await bancada.pool.query<LinhaDeAuditoria>('select entidade, entidade_id, autor_usuario_id, antes, depois from auditoria where escola_id = $1 and acao = $2 order by em, id', [escolaId, acao])
  return rows
}

/**
 * Grava materiais direto no banco, como se a pessoa os tivesse enviado: para o teste dos tetos, que precisa de dezenas
 * de envios sem subir dezenas de arquivos. Cada um com um resumo próprio.
 */
export async function materiaisJaEnviados(
  bancada: BancadaDeSessoes,
  sessao: Pick<SessaoDeTeste, 'escolaId' | 'usuarioId'>,
  disciplinaId: string,
  quantidade: number,
  { estado = 'falhou', enviadoHaMs = 0 }: { estado?: 'processando' | 'falhou'; enviadoHaMs?: number } = {},
): Promise<string[]> {
  const ids: string[] = []
  for (let indice = 0; indice < quantidade; indice += 1) {
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, declaracao, sha256, tamanho_bytes, estado, falha, enviado_por, enviado_em)
       values ($1, $2, 'Material sintético já enviado', 'escola', 'autoria_da_escola', true, $3, 1000, $4, $5, $6, now() - make_interval(secs => $7))
       returning id`,
      [sessao.escolaId, disciplinaId, randomBytes(32).toString('hex'), estado, estado === 'falhou' ? 'extracao_falhou' : null, sessao.usuarioId, enviadoHaMs / 1_000],
    )
    const id = rows[0]?.id
    if (id === undefined) throw new Error('material sintético não gravado')
    ids.push(id)
  }
  return ids
}

/**
 * Apaga os trechos e os materiais das escolas do teste. **Antes de `bancada.fechar()`**: a bancada apaga a disciplina,
 * e o material aponta para ela.
 */
export async function apagarMateriais(bancada: BancadaDeSessoes, escolas: readonly string[]): Promise<void> {
  if (escolas.length === 0) return
  await bancada.pool.query('delete from trecho where escola_id = any($1::uuid[])', [escolas])
  await bancada.pool.query('delete from material where escola_id = any($1::uuid[])', [escolas])
}
