import { InvalidConfigError, DomainException, runInContext, AuditoriaRecorder, summarizeError, type Database } from '@educa/nucleo'
import {
  CHAVES_DE_CATEGORIA_DO_INCIDENTE,
  ErrorCode,
  InvariantException,
  FINALIDADE_DO_REGISTRO_DE_INCIDENTE,
  MAXIMO_DE_ESCOLAS_DO_INCIDENTE,
  MAXIMO_DE_TITULARES_ESTIMADOS,
  MAXIMO_DO_TEXTO_DO_INCIDENTE,
  RISCOS_DO_INCIDENTE,
} from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { z } from 'zod'
import { AcessoDaEscolaRepository } from '../credencial/index.js'
import { abrirBancoDeOperacao, ArgumentoInvalido, autorDoComando, lerOperador, OperadorRecusado, type BancoDoComando, type SaidaDoComando } from './comando.js'
import { OperacaoPrivacidadeRepository, type SecaoDoIncidente } from './operacao-privacidade.repository.js'
import type { ConferenciaDoAutor } from '../sessao/index.js'

const registro = new AuditoriaRecorder()

/**
 * O registro de incidente de segurança pela operação (F3, RF8; Tech Spec do F3, seções 3, 5 e 6):
 *
 *   OPERADOR=<pessoa da equipe> npm run -s ops:incidente -- registrar --arquivo <caminho.json>
 *
 * O arquivo é um JSON com o instante em que a Turmma soube do incidente e **uma seção por escola afetada**, com os números e os
 * textos dela:
 *
 *   { "conhecidoEm": "2026-10-09T14:00:00-03:00",
 *     "escolas": [ { "escola": "<uuid>", "circunstancias": "…", "categorias": ["conversa_do_aluno"], "titularesEstimados": 12,
 *                    "risco": "relevante", "contencao": "…", "correcao": "…" } ] }
 *
 * - **Nada de titular.** A seção leva quantos se estima e que categorias de dado foram alcançadas (lista fechada), nunca quais
 *   pessoas. Os textos têm até 1.000 caracteres, e o arquivo, 256 KB.
 * - **Cada escola lê só a dela.** O texto de uma seção que cite o **nome** ou o **id** de outra escola afetada do mesmo arquivo é
 *   recusado, sem gravar nada: ele chegaria à coordenação da escola errada. A comparação ignora caixa e acento, exige o nome inteiro
 *   (não casa no meio de uma palavra), e não conta a ocorrência que fica dentro do nome da própria escola, para "Escola Alfa" e "Escola Alfa Norte"
 *   conviverem. O id vale com e sem hífen.
 * - O incidente, a seção de cada escola (escrita **no contexto dela**, aberto antes: regra 10, item 3) e o `incidente.registrado` da
 *   auditoria de cada escola são uma transação só, que começa pela conferência do autor. Escola inexistente: `NAO_ENCONTRADO`, e
 *   desfaz tudo. A escola vê o aviso no mesmo instante, e as 24 h para confirmar contam de `conhecidoEm`.
 * - O erro cita só a opção e a posição da seção no arquivo, nunca o conteúdo.
 */

export interface SecaoDoArquivoDeIncidente extends SecaoDoIncidente {
  readonly escolaId: string
}

export interface PedidoDeIncidente {
  readonly comando: 'registrar'
  readonly conhecidoEm: Date
  readonly secoes: readonly SecaoDoArquivoDeIncidente[]
}

/** O maior arquivo aceito. Um incidente de 200 escolas, com os três textos no limite, cabe com folga. */
export const TAMANHO_MAXIMO_DO_ARQUIVO_DE_INCIDENTE = 256 * 1024

/** Texto de seção: sem caractere de controle, salvo a quebra de linha e a tabulação. */
const SEM_CONTROLE = /^(?:[^\p{Cc}]|[\n\r\t])+$/u

const esquemaTexto = z.string().trim().min(1).max(MAXIMO_DO_TEXTO_DO_INCIDENTE).regex(SEM_CONTROLE)
const esquemaSecao = z.strictObject({
  escola: z.uuid(),
  circunstancias: esquemaTexto,
  categorias: z.array(z.enum(CHAVES_DE_CATEGORIA_DO_INCIDENTE)).min(1),
  titularesEstimados: z.number().int().min(0).max(MAXIMO_DE_TITULARES_ESTIMADOS),
  risco: z.enum(RISCOS_DO_INCIDENTE),
  contencao: esquemaTexto,
  correcao: esquemaTexto,
})
const esquemaArquivo = z.strictObject({
  conhecidoEm: z.iso.datetime({ offset: true }),
  escolas: z.array(esquemaSecao).min(1).max(MAXIMO_DE_ESCOLAS_DO_INCIDENTE),
})

function lerOpcoes(argumentos: string[]) {
  try {
    return parseArgs({ args: argumentos, options: { arquivo: { type: 'string' } }, strict: true, allowPositionals: true })
  } catch {
    // O erro do parseArgs repete o argumento recebido; a mensagem fica só com as opções aceitas.
    throw new ArgumentoInvalido('--arquivo')
  }
}

/** O conteúdo do arquivo, ou `ArgumentoInvalido` sem o caminho nem o conteúdo: o motivo vai entre parênteses, em texto fixo. */
async function lerArquivo(caminho: string): Promise<string> {
  try {
    if ((await stat(caminho)).size > TAMANHO_MAXIMO_DO_ARQUIVO_DE_INCIDENTE) throw new ArgumentoInvalido('--arquivo (maior que 256 KB)')
    return await readFile(caminho, 'utf8')
  } catch (erro) {
    if (erro instanceof ArgumentoInvalido) throw erro
    throw new ArgumentoInvalido('--arquivo (não foi possível ler o arquivo)')
  }
}

/**
 * Lê e confere o pedido antes de abrir o banco: a opção, o arquivo, o formato de cada campo e a escola repetida. O erro cita o
 * caminho do campo (`escolas.1.titularesEstimados`) e nunca o valor.
 */
export async function lerPedidoDeIncidente(argumentos: string[]): Promise<PedidoDeIncidente> {
  const { values: valores, positionals: posicionais } = lerOpcoes(argumentos)
  if (posicionais.join(' ') !== 'registrar') throw new ArgumentoInvalido('comando (registrar)')
  if (valores.arquivo === undefined || valores.arquivo === '') throw new ArgumentoInvalido('--arquivo')
  let bruto: unknown
  try {
    bruto = JSON.parse(await lerArquivo(valores.arquivo))
  } catch (erro) {
    if (erro instanceof ArgumentoInvalido) throw erro
    throw new ArgumentoInvalido('--arquivo (não é um JSON válido)')
  }
  const lido = esquemaArquivo.safeParse(bruto)
  if (!lido.success) {
    const campo = lido.error.issues[0]?.path.join('.') ?? ''
    throw new ArgumentoInvalido(`--arquivo (campo inválido: ${campo === '' ? 'raiz' : campo})`)
  }
  const conhecidoEm = new Date(lido.data.conhecidoEm)
  if (conhecidoEm.getTime() > Date.now()) throw new ArgumentoInvalido('--arquivo (campo inválido: conhecidoEm no futuro)')
  const secoes = lido.data.escolas.map(({ escola, ...resto }) => ({ ...resto, escolaId: escola.toLowerCase(), categorias: [...new Set(resto.categorias)] }))
  if (new Set(secoes.map((secao) => secao.escolaId)).size !== secoes.length) throw new ArgumentoInvalido('--arquivo (escola repetida)')
  return { comando: 'registrar', conhecidoEm, secoes }
}

/** O texto sem acento nem caixa, com os espaços colapsados: a forma em que o nome e o id da outra escola são procurados. */
export function textoParaComparar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

const escaparParaRegex = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export interface EscolaDoIncidente {
  readonly id: string
  readonly nome: string
}

const procurarNome = (nome: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escaparParaRegex(nome)}(?![\\p{L}\\p{N}])`, 'gu')

/**
 * Se o texto de uma seção cita o nome ou o id de **outra** escola afetada. O nome das outras só conta inteiro, entre fronteiras de
 * palavra, e a ocorrência que fica dentro do nome da própria escola não conta (a escola 'Colégio Ametista Norte' pode escrever o
 * próprio nome; o nome de uma escola mais longa que contém o da própria conta como citação). O id vale com e sem hífen.
 */
export function citaOutraEscola(texto: string, propria: EscolaDoIncidente, outras: readonly EscolaDoIncidente[]): boolean {
  const comparavel = textoParaComparar(texto)
  const nomeProprio = textoParaComparar(propria.nome)
  const daPropria = nomeProprio === '' ? [] : [...comparavel.matchAll(procurarNome(nomeProprio))].map((achado) => ({ ini: achado.index ?? 0, fim: (achado.index ?? 0) + achado[0].length }))
  return outras.some((outra) => {
    const id = outra.id.toLowerCase()
    if (comparavel.includes(id) || comparavel.includes(id.replaceAll('-', ''))) return true
    const nome = textoParaComparar(outra.nome)
    if (nome === '') return false
    return [...comparavel.matchAll(procurarNome(nome))].some((achado) => {
      const ini = achado.index ?? 0
      const fim = ini + achado[0].length
      return !daPropria.some((propriaAqui) => propriaAqui.ini <= ini && fim <= propriaAqui.fim)
    })
  })
}

/**
 * Registra o incidente, escreve a seção de cada escola no contexto dela e grava `incidente.registrado` na auditoria da escola, numa
 * transação só, com o autor conferido como primeira instrução. Devolve o id do incidente e quantas escolas ele alcançou.
 */
export function registrarIncidente(banco: Database, autor: ConferenciaDoAutor, pedido: PedidoDeIncidente): Promise<{ incidenteId: string; escolas: number }> {
  const requisicaoId = randomUUID()
  return runInContext({ requisicaoId }, () =>
    banco.transaction(async (tx) => {
      const autorOperador = await autor(tx)
      const nomes: EscolaDoIncidente[] = []
      for (const { escolaId } of pedido.secoes) {
        const nome = await runInContext({ requisicaoId, escolaId }, () => new AcessoDaEscolaRepository(tx).nome())
        if (nome === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
        nomes.push({ id: escolaId, nome })
      }
      pedido.secoes.forEach((secao, posicao) => {
        const propria = nomes[posicao]
        if (propria === undefined) throw new InvariantException('escola sem nome lido')
        const outras = nomes.filter((_, outra) => outra !== posicao)
        if ([secao.circunstancias, secao.contencao, secao.correcao].some((texto) => citaOutraEscola(texto, propria, outras))) {
          throw new ArgumentoInvalido(`--arquivo (a seção ${posicao + 1} cita o nome ou o id de outra escola afetada)`)
        }
      })
      const repositorio = new OperacaoPrivacidadeRepository(tx)
      const incidenteId = await repositorio.registrarIncidente(pedido.conhecidoEm, autorOperador)
      for (const { escolaId, ...secao } of pedido.secoes) {
        await runInContext({ requisicaoId, escolaId }, async () => {
          const secaoId = await repositorio.ligarEscolaAoIncidente(incidenteId, secao)
          await registro.gravar(tx, 'incidente.registrado', {
            entidadeId: secaoId,
            depois: { risco: secao.risco, titularesEstimados: secao.titularesEstimados },
            finalidade: FINALIDADE_DO_REGISTRO_DE_INCIDENTE,
            autorOperador,
          })
        })
      }
      return { incidenteId, escolas: pedido.secoes.length }
    }),
  )
}

/** Texto fixo por código, sem nada do pedido. */
const MENSAGEM_DO_OPERADOR: Partial<Record<ErrorCode, string>> = {
  NAO_ENCONTRADO: 'escola não encontrada',
}

/**
 * Executa o comando e devolve o código de saída: 0 registrado, 1 `NAO_ENCONTRADO` ou `ERRO_INTERNO` resumido, 2 argumento,
 * arquivo ou ambiente inválido, texto que cita outra escola, ou `OPERADOR` que não é operador ativo. Argumento, arquivo e formato
 * do `OPERADOR` são conferidos antes de abrir o banco; o `OPERADOR` contra os ativos, dentro da transação.
 */
export async function executarOpsIncidente(
  argumentos: string[],
  ambiente: Record<string, string | undefined>,
  terminal: SaidaDoComando,
  abrirBanco: (ambiente: Record<string, string | undefined>) => BancoDoComando = abrirBancoDeOperacao,
): Promise<number> {
  try {
    const pedido = await lerPedidoDeIncidente(argumentos)
    const operador = lerOperador(ambiente)
    const { banco, fechar } = abrirBanco(ambiente)
    try {
      const resposta = await registrarIncidente(banco, autorDoComando(operador), pedido)
      terminal.saida(`${JSON.stringify(resposta)}\n`)
      return 0
    } finally {
      await fechar()
    }
  } catch (erro) {
    if (erro instanceof ArgumentoInvalido || erro instanceof InvalidConfigError || erro instanceof OperadorRecusado) {
      // Só o nome da opção ou da variável, e a posição da seção: nunca o valor.
      terminal.erro(`${erro.message}\n`)
      return 2
    }
    if (erro instanceof DomainException && MENSAGEM_DO_OPERADOR[erro.codigo] !== undefined) {
      terminal.erro(`${erro.codigo}: ${MENSAGEM_DO_OPERADOR[erro.codigo]}\n`)
      return 1
    }
    // O erro cru do Postgres traz o valor da linha na mensagem e no `detail`: sai só o resumo seguro.
    terminal.erro(`${ErrorCode.ERRO_INTERNO}: ${JSON.stringify(summarizeError(erro))}\n`)
    return 1
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await executarOpsIncidente(process.argv.slice(2), process.env, {
    saida: (texto) => process.stdout.write(texto),
    erro: (texto) => process.stderr.write(texto),
  })
}
