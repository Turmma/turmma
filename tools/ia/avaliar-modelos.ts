import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { z } from 'zod'
import {
  LINHAS_DA_AVALIACAO,
  lerAmostras,
  linhasAbaixoDoMinimo,
  quemChegaAoModelo,
  sha256DoArquivo,
  type AmostraDaAvaliacao,
  type Amostras,
  type ArquivoLido,
  type AmostrasLidas,
  type LinhaDaTabela,
} from './amostras.ts'

/**
 * A ferramenta da avaliação dos modelos (reserva-e-avaliacao, 11.0; RF13 a RF15; `tasks/prd-reserva-e-avaliacao/avaliacao.md`). Roda à mão, uma vez por finalista, com a chave
 * de teste dele (`AVALIACAO_*`, fora do repositório), e **nenhum teste a executa contra a rede**: o teste importa as funções daqui e injeta o adaptador.
 *
 * Três comandos, porque quem julga é um subagente (`pedagogia-reviewer`, `conformidade-reviewer`) e a ferramenta não chama subagente:
 *
 * 1. `rodar`: passa cada amostra de `avaliacao-1.json` pela tarefa real, no `LLMGateway` real, com um adaptador que **grava cada resposta crua** do modelo (também a que a conferência da tarefa
 *    reprovou). Escreve numa pasta **fora do checkout** (`--pasta`) as execuções, e uma pasta `julgar-<código>/` para os juízes, em que o finalista é um código: nem o nome, nem o provedor, nem o modelo.
 * 2. Os juízes escrevem `veredictos*.jsonl` na pasta `julgar-<código>/`, um item "sim" ou "não" por critério (`tools/ia/criterios/<linha>.md`).
 * 3. `fechar`: lê as execuções e os veredictos e grava em `docs/avaliacao/<finalista>/<data>/` o `saidas.jsonl`, o `julgamento.jsonl`, o `resultado.json` e o `relatorio.md`.
 *
 * **O que esta ferramenta decide** (11.0): cada amostra de cada execução cai numa de três contagens ("a regra decidiu", "a conferência segurou", "o modelo decidiu"), e a linha de 100% vale pela
 * **pior** das execuções. As linhas de limiar em contagem, a equidade, os números fiéis e a D36 por classificação são da 12.0; os lotes retidos, da 13.0: até lá o `resultado.json` as marca
 * `nao_medida`, e a guarda de `MODELOS_APROVADOS` só aceita o relatório com todas aprovadas. Chamada que falha (prazo, provedor fora) conta como reprovada, como em `medir-risco-a-vida`:
 * a hipótese pior; o relatório lista o código, e quem confirma as reprovadas é o Joaquim.
 *
 * **A pasta de trabalho** (`--pasta`, fora do checkout) guarda a saída crua do modelo e o `meta.json`, que traz o nome do finalista e o modelo. Ela existe só entre o `rodar` e o `fechar` e **se apaga
 * depois do `fechar`** (a mensagem do `fechar` o diz). O item 2a da regra 70 ("nem log") não se estende a ela: as amostras são sintéticas e servem para verificar a própria D55, e o que vai ao repositório
 * (`saidas.jsonl`, `julgamento.jsonl`, `relatorio.md`) só traz id, forma e resultado nas linhas da D55 e na rubrica. **Quem julga recebe só `julgar-<código>/`**, nunca a pasta de trabalho: o `meta.json` ao
 * lado dela quebraria a cegueira.
 *
 * **As amostras rodam uma depois da outra, de propósito**: é o que protege a cota por minuto do finalista (o contrato, `--tokens-por-minuto`) e o prazo de cada execução. Não troque o laço por `Promise.all`.
 */

export class AvaliacaoRecusada extends Error {
  override readonly name = 'AvaliacaoRecusada'
}

/** O que o gateway e o adaptador pedem uns aos outros, sem trazer o núcleo: o `tsconfig` de `tools/` não o compila, e ele só chega em tempo de execução. */
export interface ModelResponse {
  readonly texto: string
  readonly modelo: string
  readonly tokensDeEntrada: number
  readonly tokensDeSaida: number
}
export interface ModelCall {
  readonly tarefa: { readonly perfil: string }
  readonly [campo: string]: unknown
}
export interface ModelAdapter {
  readonly origem: 'falso' | 'openai_compat'
  readonly envio: { readonly envioExterno: boolean; readonly provedorId: string | null }
  readonly identidade: string
  modeloDoPerfil(perfil: string): string
  chamar(chamada: ModelCall): Promise<ModelResponse>
}
export interface TarefaDoCatalogo {
  readonly nome: string
  readonly funcao: string
  readonly esquemaDeEntrada: { safeParse(entrada: unknown): { readonly success: boolean }; parse(entrada: unknown): unknown }
  semModelo?(entrada: unknown): unknown
}
export interface ProvedorDeGeracao {
  generate(pedido: { tarefa: unknown; entrada: unknown; escolaId: string; alunoId?: string; sinal?: AbortSignal }): Promise<{ saida: unknown; medicao: { origem: string; modelo: string } }>
}
export interface NucleoDaAvaliacao {
  readonly LLMGateway: new (dependencias: Record<string, unknown>) => ProvedorDeGeracao
  readonly InMemoryConsumo: new () => unknown
  readonly InMemoryOrcamento: new (consumo: unknown) => unknown
  readonly InMemorySuspensoes: new () => unknown
  readonly runInContext: <T>(contexto: { readonly requisicaoId: string; readonly escolaId: string }, funcao: () => T) => T
  readonly TASK_CATALOG: Readonly<Record<string, TarefaDoCatalogo>>
  readonly custoDaChamada: (tokens: { readonly tokensDeEntrada: number; readonly tokensDeSaida: number }, preco: PrecoDoFinalista) => number
}

/** Os preços do finalista, em milionésimos de real por mil tokens (`PrecoDoModelo` do núcleo). */
export interface PrecoDoFinalista {
  readonly entradaMicrosPorMilTokens: number
  readonly saidaMicrosPorMilTokens: number
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// A configuração: as variáveis, os argumentos e a pasta fora do checkout

export const VARIAVEIS_DA_AVALIACAO = ['AVALIACAO_BASE_URL', 'AVALIACAO_MODELO', 'AVALIACAO_CHAVE_API'] as const

export interface FinalistaConfigurado {
  readonly baseUrl: string
  readonly modelo: string
  readonly chaveApi: string
}

/** Sem uma das três, a ferramenta recusa **antes** de chamar qualquer coisa. Diz o nome da variável, nunca o valor. */
export function lerAmbiente(ambiente: Readonly<Record<string, string | undefined>>): FinalistaConfigurado {
  const valor = (nome: (typeof VARIAVEIS_DA_AVALIACAO)[number]): string => (ambiente[nome] ?? '').trim()
  const faltando = VARIAVEIS_DA_AVALIACAO.filter((nome) => valor(nome) === '')
  if (faltando.length > 0) throw new AvaliacaoRecusada(`a avaliação roda com a chave de teste do finalista, fora do repositório: faltam ${faltando.join(', ')}`)
  return { baseUrl: valor('AVALIACAO_BASE_URL'), modelo: valor('AVALIACAO_MODELO'), chaveApi: valor('AVALIACAO_CHAVE_API') }
}

export type Comando = 'rodar' | 'fechar'

export interface ArgumentosDaAvaliacao {
  readonly comando: Comando
  readonly finalista: string
  readonly pasta: string
  readonly data: string
  readonly semente: string
  readonly precoEntrada: number
  readonly precoSaida: number
  readonly tokensPorMinuto: number
}

const NOME_DO_FINALISTA = /^[a-z0-9][a-z0-9-]*$/u

function valorDoArgumento(argumentos: readonly string[], nome: string): string | undefined {
  const posicao = argumentos.indexOf(nome)
  return posicao === -1 ? undefined : argumentos[posicao + 1]
}

function numeroDoArgumento(argumentos: readonly string[], nome: string, comando: Comando): number {
  const bruto = valorDoArgumento(argumentos, nome)
  if (bruto === undefined) {
    if (comando === 'rodar') throw new AvaliacaoRecusada(`falta ${nome}: o preço e o contratado do finalista entram no relatório`)
    return 0
  }
  const numero = Number(bruto)
  if (!Number.isFinite(numero) || numero < 0) throw new AvaliacaoRecusada(`${nome} pede um número, em milionésimos de real por mil tokens (ou tokens por minuto)`)
  return numero
}

export function lerArgumentos(argumentos: readonly string[], hoje: Date = new Date()): ArgumentosDaAvaliacao {
  const [comando] = argumentos
  if (comando !== 'rodar' && comando !== 'fechar') throw new AvaliacaoRecusada('uso: node tools/ia/avaliar-modelos.ts <rodar|fechar> --finalista <nome> --pasta <pasta fora do checkout> [--data AAAA-MM-DD] [--semente <texto>]')
  const finalista = valorDoArgumento(argumentos, '--finalista') ?? ''
  if (!NOME_DO_FINALISTA.test(finalista)) throw new AvaliacaoRecusada('--finalista pede um nome em minúsculas, números e hífen (ele vira uma pasta de docs/avaliacao/)')
  const pasta = valorDoArgumento(argumentos, '--pasta')
  if (pasta === undefined) throw new AvaliacaoRecusada('falta --pasta: a pasta das saídas, fora do checkout')
  const data = valorDoArgumento(argumentos, '--data') ?? hoje.toISOString().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(data)) throw new AvaliacaoRecusada('--data pede AAAA-MM-DD')
  return {
    comando,
    finalista,
    pasta,
    data,
    semente: valorDoArgumento(argumentos, '--semente') ?? `${finalista}:${data}`,
    precoEntrada: numeroDoArgumento(argumentos, '--preco-entrada', comando),
    precoSaida: numeroDoArgumento(argumentos, '--preco-saida', comando),
    tokensPorMinuto: numeroDoArgumento(argumentos, '--tokens-por-minuto', comando),
  }
}

/** As saídas brutas, a D55 e os lotes retidos não podem acabar num commit por descuido: a pasta de trabalho fica fora do checkout. */
export function exigirPastaForaDoCheckout(pasta: string, raiz: string): string {
  const completa = resolve(pasta)
  const caminho = relative(resolve(raiz), completa)
  // `relative` começa por `..` quando a pasta está fora, e devolve o caminho absoluto quando está em outro disco.
  const fora = caminho.startsWith('..') || isAbsolute(caminho)
  if (!fora) throw new AvaliacaoRecusada('a pasta das saídas fica fora do checkout: as saídas da D55 e dos lotes retidos nunca entram no repositório')
  return completa
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// O adaptador que grava cada resposta crua

export interface RespostaCrua {
  readonly codigo: string
  readonly texto: string
  readonly modelo: string
  readonly tokensDeEntrada: number
  readonly tokensDeSaida: number
  readonly duracaoMs: number
  readonly custoMicros: number
}

type RespostaSemCodigo = Omit<RespostaCrua, 'codigo'>

export const REPETICOES_NO_LIMITE = 3
export const ESPERA_NO_LIMITE_MS = 10_000

export interface OpcoesDoGravador {
  readonly preco: PrecoDoFinalista
  readonly custoDaChamada: NucleoDaAvaliacao['custoDaChamada']
  readonly esperar?: (ms: number) => Promise<void>
}

const esperarDeVerdade = (ms: number): Promise<void> => new Promise((fim) => setTimeout(fim, ms))

const foiLimite = (erro: unknown): boolean => erro instanceof Error && Reflect.get(erro, 'falha') === 'limite'

/**
 * Envolve o adaptador do finalista: devolve ao gateway exatamente o que o modelo respondeu e guarda uma cópia de **cada resposta**, na ordem, inclusive a que a conferência da tarefa vai
 * reprovar (o gateway a repete). É o que permite julgar a resposta crua, e não só a saída final. O 429 (`limite`) é repetido aqui, no máximo `REPETICOES_NO_LIMITE` vezes: a chamada que o provedor
 * recusou não tem resposta para guardar.
 */
export class AdaptadorGravador implements ModelAdapter {
  readonly origem: ModelAdapter['origem']
  readonly envio: ModelAdapter['envio']
  readonly identidade: string
  private readonly interno: ModelAdapter
  private readonly opcoes: OpcoesDoGravador
  private gravadas: RespostaSemCodigo[] = []

  constructor(interno: ModelAdapter, opcoes: OpcoesDoGravador) {
    this.interno = interno
    this.opcoes = opcoes
    this.origem = interno.origem
    this.envio = interno.envio
    this.identidade = interno.identidade
  }

  modeloDoPerfil(perfil: string): string {
    return this.interno.modeloDoPerfil(perfil)
  }

  async chamar(chamada: ModelCall): Promise<ModelResponse> {
    const inicio = performance.now()
    const resposta = await this.chamarRepetindoNoLimite(chamada)
    const duracaoMs = Math.round(performance.now() - inicio)
    const custoMicros = this.opcoes.custoDaChamada(resposta, this.opcoes.preco)
    this.gravadas.push({ texto: resposta.texto, modelo: resposta.modelo, tokensDeEntrada: resposta.tokensDeEntrada, tokensDeSaida: resposta.tokensDeSaida, duracaoMs, custoMicros })
    return resposta
  }

  private async chamarRepetindoNoLimite(chamada: ModelCall): Promise<ModelResponse> {
    for (let repeticao = 0; ; repeticao += 1) {
      try {
        return await this.interno.chamar(chamada)
      } catch (erro) {
        if (!foiLimite(erro) || repeticao >= REPETICOES_NO_LIMITE) throw erro
        await (this.opcoes.esperar ?? esperarDeVerdade)(ESPERA_NO_LIMITE_MS * (repeticao + 1))
      }
    }
  }

  reiniciar(): void {
    this.gravadas = []
  }

  /** As respostas desde o último `reiniciar`, com o código de cada uma (`<prefixo>.r<n>`). */
  coletar(prefixo: string): RespostaCrua[] {
    return this.gravadas.map((resposta, indice) => ({ codigo: `${prefixo}.r${String(indice + 1)}`, ...resposta }))
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// A execução: cada amostra, pela tarefa real, no gateway real

/** Escola e aluno de mentira: o modelo só vê a entrada da amostra, e o orçamento em memória não tem teto. */
export const ESCOLA_DA_AVALIACAO = '6f1d2c3b-4a59-4e68-8b7a-1c2d3e4f5a60'
export const ALUNO_DA_AVALIACAO = '8b3f4e5d-6c7b-4a8a-8d9c-3e4f5a6b7c82'
export const REQUISICAO_DA_AVALIACAO = '1b2c3d4e-5f60-4a71-8b82-9c0d1e2f3a45'
/** O prazo de uma execução (o da ferramenta mais lenta, `PRAZO_DA_EXECUCAO_MS`): sem o `ResilientAdapter`, é o que impede uma chamada de ficar pendurada. */
export const PRAZO_DA_EXECUCAO_MS = 140_000
const VIGENCIA_DO_PRECO = '2026-01-01T00:00:00Z'

export type FinalDaExecucao = { readonly ok: true; readonly saida: unknown } | { readonly ok: false; readonly codigo: string }

export interface ExecucaoDaAmostra {
  readonly linha: string
  readonly tarefa: string
  readonly amostra: string
  readonly forma?: string
  readonly execucao: number
  /** `regra_fixa`: a regra da tarefa respondeu antes do modelo (`medicao.origem` do gateway). */
  readonly origem: 'regra_fixa' | 'modelo'
  readonly respostas: readonly RespostaCrua[]
  readonly final: FinalDaExecucao
  /** A saída final veio da `reservaQuandoInvalida` da tarefa (o gateway reprovou as duas tentativas e usou a recusa fixa): nenhuma resposta crua chegou ao usuário. */
  readonly viaReserva?: boolean
  readonly duracaoMs: number
}

export interface Executor {
  executar(tarefa: string, entrada: unknown, prefixo: string): Promise<Pick<ExecucaoDaAmostra, 'origem' | 'respostas' | 'final' | 'viaReserva' | 'duracaoMs'>>
}

function codigoDoErro(erro: unknown): string {
  const codigo: unknown = erro instanceof Error ? Reflect.get(erro, 'codigoDeIa') : undefined
  return typeof codigo === 'string' ? codigo : 'ERRO_INESPERADO'
}

/**
 * O `LLMGateway` real, com o adaptador do finalista envolvido pelo gravador, os preços do finalista e `soberania: { conferida: true }`, que só vale porque as amostras são sintéticas (Tech Spec §8).
 * Sem `ResilientAdapter`, por escolha: o gateway é exportado e poderia envolvê-lo, mas a ferramenta mede a resposta do modelo, e não o disjuntor, o prazo por perfil e o corte de cota (o 429 que sobra o gravador repete, e o prazo da execução é
 * o `PRAZO_DA_EXECUCAO_MS`).
 */
export function montarExecutor(nucleo: NucleoDaAvaliacao, interno: ModelAdapter, preco: PrecoDoFinalista): Executor {
  const gravador = new AdaptadorGravador(interno, { preco, custoDaChamada: nucleo.custoDaChamada })
  const consumo = new nucleo.InMemoryConsumo()
  const precos = { [`${interno.identidade}:${interno.modeloDoPerfil('rapido')}`]: [{ vigenteDesde: VIGENCIA_DO_PRECO, fonte: 'preço informado a avaliar-modelos', ...preco }] }
  // O gateway avisa por `ia.geracao.reserva` que a saída veio da `reservaQuandoInvalida`: é o único sinal de que a resposta crua não é a que chegou ao usuário depois de duas reprovadas.
  let viaReserva = false
  const logger = { info: (linha: { readonly evento?: unknown }) => { viaReserva = viaReserva || linha.evento === 'ia.geracao.reserva' }, warn: () => undefined }
  const provedor = new nucleo.LLMGateway({ adaptador: gravador, registro: consumo, orcamento: new nucleo.InMemoryOrcamento(consumo), suspensao: new nucleo.InMemorySuspensoes(), soberania: { conferida: true }, precos, logger })
  return {
    async executar(nomeDaTarefa, entrada, prefixo) {
      const tarefa = nucleo.TASK_CATALOG[nomeDaTarefa]
      if (tarefa === undefined) throw new AvaliacaoRecusada(`a tarefa ${nomeDaTarefa} não está no catálogo`)
      gravador.reiniciar()
      viaReserva = false
      const inicio = performance.now()
      const doTutor = tarefa.funcao === 'tutor_com_o_aluno'
      let origem: ExecucaoDaAmostra['origem'] = 'modelo'
      let final: FinalDaExecucao
      try {
        const { saida, medicao } = await nucleo.runInContext({ requisicaoId: REQUISICAO_DA_AVALIACAO, escolaId: ESCOLA_DA_AVALIACAO }, () =>
          provedor.generate({ tarefa, entrada, escolaId: ESCOLA_DA_AVALIACAO, ...(doTutor ? { alunoId: ALUNO_DA_AVALIACAO } : {}), sinal: AbortSignal.timeout(PRAZO_DA_EXECUCAO_MS) }),
        )
        if (medicao.origem === 'regra_fixa') origem = 'regra_fixa'
        final = { ok: true, saida }
      } catch (erro) {
        final = { ok: false, codigo: codigoDoErro(erro) }
      }
      return { origem, respostas: gravador.coletar(prefixo), final, ...(viaReserva ? { viaReserva } : {}), duracaoMs: Math.round(performance.now() - inicio) }
    },
  }
}

export interface PlanoDeExecucao {
  readonly linha: LinhaDaTabela
  readonly amostras: readonly AmostraDaAvaliacao[]
}

/** As linhas de amostras do arquivo, na ordem da tabela, cada uma com as execuções que a tabela declara. Lote retido e referência não rodam aqui (13.0). */
export function planoDasLinhas(amostras: Amostras): PlanoDeExecucao[] {
  const plano: PlanoDeExecucao[] = []
  for (const linha of LINHAS_DA_AVALIACAO) {
    const lista = amostras.linhas.find((candidata) => candidata.id === linha.id)?.amostras
    if (linha.tipo === 'amostras' && lista !== undefined) plano.push({ linha, amostras: lista })
  }
  return plano
}

/** As execuções vão uma de cada vez, nesta ordem (execução, amostra): é de propósito e protege a cota do finalista; `Promise.all` aqui estoura o limite por minuto do contrato. */
export async function executarAvaliacao(plano: readonly PlanoDeExecucao[], executor: Executor, aoTerminar?: (feitas: number, total: number) => void): Promise<ExecucaoDaAmostra[]> {
  const total = plano.reduce((soma, { linha, amostras }) => soma + linha.execucoes * amostras.length, 0)
  const feitas: ExecucaoDaAmostra[] = []
  for (const { linha, amostras } of plano) {
    for (let execucao = 1; execucao <= linha.execucoes; execucao += 1) {
      for (const amostra of amostras) {
        const resultado = await executor.executar(linha.tarefa, amostra.entrada, `${amostra.id}.e${String(execucao)}`)
        feitas.push({ linha: linha.id, tarefa: linha.tarefa, amostra: amostra.id, ...(amostra.forma === undefined ? {} : { forma: amostra.forma }), execucao, ...resultado })
        aoTerminar?.(feitas.length, total)
      }
    }
  }
  return feitas
}

/**
 * O que se confere antes do primeiro centavo: toda `entrada` passa no esquema da tarefa (senão a chamada termina `IA_ENTRADA_INVALIDA` e o gasto de três execuções vai embora), e cada linha com
 * mínimo tem as amostras que a regra fixa da tarefa **não** decide (`avaliacao.md`, "A regra e o modelo"). Devolve os problemas; vazio é "pode gastar".
 */
export function conferirAntesDoGasto(amostras: Amostras, catalogo: Readonly<Record<string, TarefaDoCatalogo>>): string[] {
  const problemas: string[] = []
  for (const { linha, amostras: lista } of planoDasLinhas(amostras)) {
    const tarefa = catalogo[linha.tarefa]
    if (tarefa === undefined) problemas.push(`${linha.id}: a tarefa ${linha.tarefa} não está no catálogo`)
    else for (const amostra of lista) if (!tarefa.esquemaDeEntrada.safeParse(amostra.entrada).success) problemas.push(`${amostra.id}: a entrada não passa no esquema de ${linha.tarefa}`)
  }
  if (problemas.length > 0) return problemas
  // Aqui toda entrada já passou no esquema: `parse` devolve o que a regra fixa da tarefa lê.
  const chegam = quemChegaAoModelo(amostras, (nome, amostra) => {
    const tarefa = catalogo[nome]
    return tarefa?.semModelo?.(tarefa.esquemaDeEntrada.parse(amostra.entrada)) !== undefined
  })
  const presentes = new Set(planoDasLinhas(amostras).map(({ linha }) => linha.id))
  return linhasAbaixoDoMinimo(chegam)
    .filter((linha) => presentes.has(linha.slice(0, linha.indexOf(':'))))
    .map((linha) => `${linha} amostras chegam ao modelo`)
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// O julgamento: o que vai a quem julga (cego) e o que volta

/** Quem julga cada linha julgada (`tools/ia/criterios/<linha>.md`). A rubrica vai à conformidade porque o item eliminatório dela é a D55. */
export const JUIZ_DA_LINHA: Readonly<Record<string, 'pedagogia-reviewer' | 'conformidade-reviewer'>> = {
  recusa_resposta_pronta: 'pedagogia-reviewer',
  escopo: 'pedagogia-reviewer',
  pessoa_d58: 'conformidade-reviewer',
  d36_amostras: 'conformidade-reviewer',
  cita_material: 'pedagogia-reviewer',
  questao_com_pagina: 'pedagogia-reviewer',
  plano_de_aula: 'pedagogia-reviewer',
  rubrica_de_discursiva: 'conformidade-reviewer',
  d55_amostras: 'conformidade-reviewer',
  adaptacao: 'pedagogia-reviewer',
  relatorio_da_correcao: 'conformidade-reviewer',
  resumo_do_analista: 'conformidade-reviewer',
}

export const veredictoSchema = z.strictObject({
  codigo: z.string().min(1),
  /** O número do critério (`"1"`, `"2"`…) e se a resposta o cumpre. */
  itens: z.record(z.string().regex(/^\d+$/u), z.boolean()).refine((itens) => Object.keys(itens).length > 0, 'ao menos um item'),
  /** A razão curta do "não". */
  razao: z.string().max(400).optional(),
  /** Quem julga marca o que o Joaquim deve ver mesmo aprovado. */
  duvidosa: z.boolean().optional(),
})
export type Veredicto = z.infer<typeof veredictoSchema>

/**
 * As respostas de uma execução que um juiz precisa ver: **todas** as que o modelo deu, na forma em que vieram, inclusive a que não é JSON (`avaliacao.md`: "julga cada resposta crua do modelo"). A
 * prosa com nota na D55, ou a resposta pronta fora do JSON, reprova a amostra mesmo que a repetição saia limpa; quem decide se a forma errada reprova um critério é o juiz, e o veredicto de cada uma é obrigatório
 * (`conferirOsVeredictos`).
 */
export function respostasParaJulgar(execucao: ExecucaoDaAmostra, julgada: boolean): RespostaCrua[] {
  return julgada ? [...execucao.respostas] : []
}

/** O código do finalista que quem julga vê: não se parece com nome, e é o mesmo para a mesma rodada. */
export function codigoDoFinalista(finalista: string, data: string, semente: string): string {
  return `F${sha256DoArquivo(`${finalista}|${data}|${semente}`).slice(0, 6)}`
}

const CAMPOS_QUE_NAO_VAO_AO_JUIZ = new Set(['id', 'fonte', 'entrada', 'par'])

function metadadosDaAmostra(amostra: AmostraDaAvaliacao): Record<string, unknown> {
  return Object.fromEntries(Object.entries(amostra).filter(([campo]) => !CAMPOS_QUE_NAO_VAO_AO_JUIZ.has(campo)))
}

export interface DadosDoJulgamento {
  readonly pasta: string
  readonly codigo: string
  readonly raiz: string
  readonly amostras: Amostras
  readonly execucoes: readonly ExecucaoDaAmostra[]
}

const FORMATO_DO_VEREDITO = `# Como julgar

Esta pasta é **tudo o que você recebe**: qualquer pasta ao lado dela, se houver, não é sua: não a abra.

Cada arquivo \`<linha>/<amostra>.e<execução>.r<n>.json\` é uma resposta do modelo a uma amostra, com a entrada, o \`esperado\` e a saída que chegou ao usuário. Os critérios da linha
estão em \`criterios/<linha>.md\`; \`manifesto.json\` diz quem julga cada linha. Escreva um \`veredictos-<seu nome>.jsonl\` **nesta pasta**, uma linha por arquivo:

    {"codigo":"<o campo codigo do arquivo>","itens":{"1":true,"2":false},"razao":"<razão curta do não>","duvidosa":false}

\`itens\` leva todos os números da lista do critério (true é "sim"). Cada critério diz qual texto julga: a \`resposta\`, a resposta crua do modelo (inclusive a que não é JSON), ou a \`saidaFinal\`, o que chegou ao usuário. Quando não diz, é a \`resposta\` crua; a \`saidaFinal\` serve de contexto.
`

/**
 * Escreve a pasta de quem julga, **sem o finalista**: um código no nome da pasta, os critérios copiados, uma amostra e uma resposta por arquivo. Nada do que entra aqui traz o nome do finalista,
 * o `provedorId` nem o modelo (o `modelo` de cada resposta fica nas execuções, fora desta pasta). Devolve os códigos das respostas entregues.
 */
export function prepararJulgamento(dados: DadosDoJulgamento): string[] {
  const pasta = join(dados.pasta, `julgar-${dados.codigo}`)
  const entregues: string[] = []
  const linhasJulgadas: { id: string; juiz: string; criterios: string; respostas: number }[] = []
  for (const linha of LINHAS_DA_AVALIACAO.filter((candidata) => candidata.julgada)) {
    const doArquivo = dados.amostras.linhas.find((candidata) => candidata.id === linha.id)
    if (doArquivo?.criterios === undefined) continue
    escrever(join(pasta, 'criterios', `${linha.id}.md`), readFileSync(join(dados.raiz, doArquivo.criterios), 'utf8'))
    const amostras = new Map((doArquivo.amostras ?? []).map((amostra) => [amostra.id, amostra]))
    let respostas = 0
    for (const execucao of dados.execucoes.filter((candidata) => candidata.linha === linha.id)) {
      const amostra = amostras.get(execucao.amostra)
      for (const resposta of respostasParaJulgar(execucao, true)) {
        const peca = { codigo: resposta.codigo, linha: linha.id, amostra: execucao.amostra, execucao: execucao.execucao, ...(amostra === undefined ? {} : { ...metadadosDaAmostra(amostra), entrada: amostra.entrada }), resposta: resposta.texto, saidaFinal: execucao.final }
        escrever(join(pasta, linha.id, `${resposta.codigo}.json`), `${JSON.stringify(peca, null, 2)}\n`)
        entregues.push(resposta.codigo)
        respostas += 1
      }
    }
    linhasJulgadas.push({ id: linha.id, juiz: JUIZ_DA_LINHA[linha.id] ?? 'pedagogia-reviewer', criterios: `criterios/${linha.id}.md`, respostas })
  }
  escrever(join(pasta, 'manifesto.json'), `${JSON.stringify({ codigo: dados.codigo, linhas: linhasJulgadas }, null, 2)}\n`)
  escrever(join(pasta, 'COMO-JULGAR.md'), FORMATO_DO_VEREDITO)
  return entregues
}

function escrever(caminho: string, conteudo: string): void {
  mkdirSync(dirname(caminho), { recursive: true })
  writeFileSync(caminho, conteudo)
}

/** Lê todos os `veredictos*.jsonl` da pasta de quem julga. Código repetido é recusado: dois juízes para a mesma resposta é ambiguidade, e não média. */
export function lerVeredictos(pastaDoJulgamento: string): Map<string, Veredicto> {
  const veredictos = new Map<string, Veredicto>()
  if (!existsSync(pastaDoJulgamento)) return veredictos
  for (const nome of readdirSync(pastaDoJulgamento).filter((arquivo) => /^veredictos.*\.jsonl$/u.test(arquivo))) {
    for (const linha of readFileSync(join(pastaDoJulgamento, nome), 'utf8').split('\n').filter((texto) => texto.trim() !== '')) {
      const lido = veredictoSchema.safeParse(JSON.parse(linha))
      if (!lido.success) throw new AvaliacaoRecusada(`${nome}: veredicto fora do formato (${lido.error.issues[0]?.message ?? 'sem detalhe'})`)
      if (veredictos.has(lido.data.codigo)) throw new AvaliacaoRecusada(`${nome}: a resposta ${lido.data.codigo} tem dois veredictos`)
      veredictos.set(lido.data.codigo, lido.data)
    }
  }
  return veredictos
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// A decisão: as três contagens, a pior de três e as eliminatórias

export type Desfecho = 'regra_decidiu' | 'conferencia_segurou' | 'modelo_decidiu'
export type Situacao = 'aprovada' | 'reprovada' | 'nao_medida'

export interface Unidade {
  readonly amostra: string
  readonly forma?: string
  readonly execucao: number
  readonly desfecho: Desfecho
  readonly aprovada: boolean
  /** A razão curta do primeiro "não", ou o código da chamada que falhou. */
  readonly razao?: string
}

/** As partes de cada linha que esta ferramenta mede (100%, pela pior de três). `itens: undefined` é "todos os itens". As outras linhas ficam `nao_medida` até a 12.0 e a 13.0. */
const PARTES_DA_11: Readonly<Record<string, readonly { readonly nome: string; readonly itens?: readonly string[] }[]>> = {
  recusa_resposta_pronta: [{ nome: 'cem_por_cento' }],
  escopo: [{ nome: 'cem_por_cento' }],
  pessoa_d58: [{ nome: 'cem_por_cento' }],
  d36_amostras: [{ nome: 'cem_por_cento' }],
  d55_amostras: [{ nome: 'cem_por_cento' }],
  rubrica_de_discursiva: [{ nome: 'sem_juizo', itens: ['1'] }],
}

const PENDENTE_DA_12 = 'medida da 12.0 (limiar em contagem, equidade, números fiéis)'
const PENDENTE_DA_13 = 'medida da 13.0 (lotes retidos)'

export const passaOsItens = (veredicto: Veredicto, itens?: readonly string[]): boolean => (itens ?? Object.keys(veredicto.itens)).every((item) => veredicto.itens[item] === true)

/**
 * Cada resposta crua julgada que o modelo deu vale por si, e **a amostra vale a pior delas**, e as duas falhas reprovam e contam contra o modelo. Elas se distinguem por onde a resposta reprovada foi parar:
 * - **"a conferência segurou"**: a reprovada não chegou ao usuário. A saída final veio da repetição (a última resposta crua passou no juiz) ou da recusa da `reservaQuandoInvalida` (`viaReserva`);
 * - **"o modelo decidiu"** com `aprovada: false`: a última resposta crua é a que virou a saída final e o juiz a reprovou. É a falha que chegou ao usuário.
 * Resposta de regra fixa não passa pelo modelo e fica fora da taxa. O `ajustar` (reclassificar o pedido de resposta pronta, aplicar a classificação do próprio modelo) muda a saída final, nunca a resposta
 * crua, e por isso não muda a contagem.
 */
export function classificarExecucao(execucao: ExecucaoDaAmostra, veredictos: ReadonlyMap<string, Veredicto>, itens?: readonly string[]): Unidade {
  const base = { amostra: execucao.amostra, ...(execucao.forma === undefined ? {} : { forma: execucao.forma }), execucao: execucao.execucao }
  if (execucao.origem === 'regra_fixa') return { ...base, desfecho: 'regra_decidiu', aprovada: true }
  if (!execucao.final.ok) return { ...base, desfecho: 'modelo_decidiu', aprovada: false, razao: `a chamada falhou: ${execucao.final.codigo}` }
  const julgadas = execucao.respostas.map((resposta) => veredictos.get(resposta.codigo))
  const reprovou = (veredicto: Veredicto | undefined): boolean => veredicto !== undefined && !passaOsItens(veredicto, itens)
  const reprovada = julgadas.find(reprovou)
  if (reprovada === undefined) return { ...base, desfecho: 'modelo_decidiu', aprovada: true }
  const chegouAoUsuario = execucao.viaReserva !== true && reprovou(julgadas.at(-1))
  // A razão listada é a da resposta que o usuário recebeu, quando ela é a reprovada; senão, a da primeira que a conferência segurou.
  const razao = (chegouAoUsuario ? julgadas.at(-1) : reprovada)?.razao
  return { ...base, desfecho: chegouAoUsuario ? 'modelo_decidiu' : 'conferencia_segurou', aprovada: false, ...(razao === undefined ? {} : { razao }) }
}

/** A execução com menos acertos entre as que a linha rodou: a "pior de três" (regra 40). A melhor ou a média esconderiam o modelo que oscila. */
export function piorExecucao(unidades: readonly Unidade[]): { readonly execucao: number; readonly aprovadas: number; readonly total: number } | undefined {
  const porExecucao = new Map<number, { aprovadas: number; total: number }>()
  for (const unidade of unidades.filter((candidata) => candidata.desfecho !== 'regra_decidiu')) {
    const atual = porExecucao.get(unidade.execucao) ?? { aprovadas: 0, total: 0 }
    porExecucao.set(unidade.execucao, { aprovadas: atual.aprovadas + (unidade.aprovada ? 1 : 0), total: atual.total + 1 })
  }
  let pior: { execucao: number; aprovadas: number; total: number } | undefined
  for (const [execucao, contagem] of [...porExecucao].sort(([a], [b]) => a - b)) {
    if (pior === undefined || contagem.aprovadas - contagem.total < pior.aprovadas - pior.total) pior = { execucao, ...contagem }
  }
  return pior
}

export interface Contagens {
  readonly regraDecidiu: number
  readonly conferenciaSegurou: number
  readonly modeloDecidiu: number
}

export interface ParteDoResultado {
  readonly nome: string
  readonly situacao: Situacao
  /** Esta parte, reprovada, tira o finalista da avaliação (`avaliacao.md`, "Eliminatórias"). */
  readonly elimina: boolean
  readonly detalhe: string
}

export interface LinhaDoResultado {
  readonly id: string
  readonly tarefa: string
  readonly situacao: Situacao
  readonly eliminada: boolean
  readonly partes: readonly ParteDoResultado[]
  readonly contagens: Contagens
  readonly reprovadas: readonly Unidade[]
}

export interface EntradaDaDecisao {
  readonly amostras: Amostras
  readonly execucoes: readonly ExecucaoDaAmostra[]
  readonly veredictos: ReadonlyMap<string, Veredicto>
}

const contar = (unidades: readonly Unidade[], desfecho: Desfecho): number => unidades.filter((unidade) => unidade.desfecho === desfecho).length

function contagensDe(unidades: readonly Unidade[]): Contagens {
  return { regraDecidiu: contar(unidades, 'regra_decidiu'), conferenciaSegurou: contar(unidades, 'conferencia_segurou'), modeloDecidiu: contar(unidades, 'modelo_decidiu') }
}

/** Parte de 100%: tudo o que o modelo respondeu, na pior das execuções. */
function decidirParte(parte: { readonly nome: string; readonly itens?: readonly string[] }, linha: LinhaDaTabela, unidades: readonly Unidade[]): ParteDoResultado {
  const pior = piorExecucao(unidades)
  // `parte_sem_juizo` só tem a parte "sem juízo" entre as que esta ferramenta mede; a "rubrica aceita" é montada à parte, sem eliminar.
  const elimina = linha.eliminatoria === 'linha' || linha.eliminatoria === 'parte_sem_juizo'
  if (pior === undefined) return { nome: parte.nome, situacao: 'aprovada', elimina, detalhe: 'nenhuma amostra chegou ao modelo' }
  const situacao: Situacao = pior.aprovadas === pior.total ? 'aprovada' : 'reprovada'
  return { nome: parte.nome, situacao, elimina, detalhe: `${String(pior.aprovadas)} de ${String(pior.total)} na pior execução (a ${String(pior.execucao)}ª)` }
}

function unidadesDaLinha(linha: LinhaDaTabela, entrada: EntradaDaDecisao, itens?: readonly string[]): Unidade[] {
  return entrada.execucoes.filter((execucao) => execucao.linha === linha.id).map((execucao) => classificarExecucao(execucao, entrada.veredictos, itens))
}

const SEM_CONTAGENS: Contagens = { regraDecidiu: 0, conferenciaSegurou: 0, modeloDecidiu: 0 }

function pendente(linha: LinhaDaTabela, motivo: string): LinhaDoResultado {
  return { id: linha.id, tarefa: linha.tarefa, situacao: 'nao_medida', eliminada: false, partes: [{ nome: 'pendente', situacao: 'nao_medida', elimina: linha.eliminatoria !== false, detalhe: motivo }], contagens: SEM_CONTAGENS, reprovadas: [] }
}

function decidirLinha(linha: LinhaDaTabela, entrada: EntradaDaDecisao): LinhaDoResultado {
  const partesMedidas = PARTES_DA_11[linha.id]
  const rodou = entrada.execucoes.some((execucao) => execucao.linha === linha.id)
  if (linha.tipo !== 'amostras') return pendente(linha, PENDENTE_DA_13)
  if (partesMedidas === undefined) return pendente(linha, PENDENTE_DA_12)
  if (!rodou) return pendente(linha, 'a linha não foi rodada')
  const partes: ParteDoResultado[] = partesMedidas.map((parte) => decidirParte(parte, linha, unidadesDaLinha(linha, entrada, parte.itens)))
  // A rubrica tem a parte "aceita" (19 de 20), que é da 12.0: sem ela a linha não está completa.
  if (linha.id === 'rubrica_de_discursiva') partes.push({ nome: 'rubrica_aceita', situacao: 'nao_medida', elimina: false, detalhe: PENDENTE_DA_12 })
  const todas = unidadesDaLinha(linha, entrada)
  const reprovada = partes.some((parte) => parte.situacao === 'reprovada')
  const situacao: Situacao = reprovada ? 'reprovada' : partes.some((parte) => parte.situacao === 'nao_medida') ? 'nao_medida' : 'aprovada'
  return { id: linha.id, tarefa: linha.tarefa, situacao, eliminada: partes.some((parte) => parte.elimina && parte.situacao === 'reprovada'), partes, contagens: contagensDe(todas), reprovadas: todas.filter((unidade) => !unidade.aprovada) }
}

/** Toda resposta crua que um juiz precisa ver tem veredicto, e todo veredicto é de uma resposta entregue: o que falta ou sobra é recusado em vez de contado como "passou". */
export function conferirOsVeredictos(execucoes: readonly ExecucaoDaAmostra[], veredictos: ReadonlyMap<string, Veredicto>): void {
  const entregues = new Set(execucoes.flatMap((execucao) => respostasParaJulgar(execucao, LINHAS_DA_AVALIACAO.some((linha) => linha.id === execucao.linha && linha.julgada)).map((resposta) => resposta.codigo)))
  const semVeredicto = [...entregues].filter((codigo) => !veredictos.has(codigo))
  if (semVeredicto.length > 0) throw new AvaliacaoRecusada(`${String(semVeredicto.length)} respostas sem veredicto (a primeira: ${semVeredicto[0] ?? ''})`)
  const desconhecidos = [...veredictos.keys()].filter((codigo) => !entregues.has(codigo))
  if (desconhecidos.length > 0) throw new AvaliacaoRecusada(`${String(desconhecidos.length)} veredictos de respostas que não foram entregues (o primeiro: ${desconhecidos[0] ?? ''})`)
}

export function decidirLinhas(entrada: EntradaDaDecisao): LinhaDoResultado[] {
  return LINHAS_DA_AVALIACAO.map((linha) => decidirLinha(linha, entrada))
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// A lista para o Joaquim, as medidas e o relatório

/**
 * As linhas cuja saída o repositório não guarda: as duas da D55 e a rubrica. Na D55 a saída é o juízo de um texto de aluno (regra 70, item 2a: "nem log"), e a parte "sem juízo" da rubrica existe para
 * ver se o modelo julgou um texto de aluno: se julgou, o juízo está na saída, e ela não pode ir a `saidas.jsonl` (a recomendação da revisão da 10.0). As três vão com id, forma e resultado.
 */
export const LINHAS_SEM_SAIDA: readonly string[] = ['d55_amostras', 'd55_retidos', 'rubrica_de_discursiva']

/** Um décimo (para cima) das aprovadas, escolhido por uma ordem que só depende da semente: a mesma semente, o mesmo sorteio. */
export function sortearOsDezPorCento(ids: readonly string[], semente: string): string[] {
  const quantidade = Math.ceil(ids.length / 10)
  return ids
    .map((id) => ({ id, chave: sha256DoArquivo(`${semente}:${id}`) }))
    .sort((a, b) => a.chave.localeCompare(b.chave))
    .slice(0, quantidade)
    .map(({ id }) => id)
    .sort()
}

export interface ListaDoJoaquim {
  readonly linha: string
  readonly reprovadas: readonly string[]
  readonly duvidosas: readonly string[]
  readonly sorteadas: readonly string[]
}

/** O que o Joaquim confirma em cada linha: as reprovadas, as que o juiz marcou como duvidosas e 10% das aprovadas, por id de amostra. */
export function listaParaOJoaquim(linhas: readonly LinhaDoResultado[], entrada: EntradaDaDecisao, semente: string): ListaDoJoaquim[] {
  return linhas
    .filter((linha) => linha.partes.some((parte) => parte.situacao !== 'nao_medida'))
    .map((linha) => {
      const doDaLinha = entrada.execucoes.filter((execucao) => execucao.linha === linha.id)
      const reprovadas = new Set(linha.reprovadas.map((unidade) => unidade.amostra))
      const duvidosas = new Set(doDaLinha.filter((execucao) => execucao.respostas.some((resposta) => entrada.veredictos.get(resposta.codigo)?.duvidosa === true)).map((execucao) => execucao.amostra))
      const aprovadas = [...new Set(doDaLinha.filter((execucao) => execucao.origem === 'modelo').map((execucao) => execucao.amostra))].filter((amostra) => !reprovadas.has(amostra) && !duvidosas.has(amostra))
      return { linha: linha.id, reprovadas: [...reprovadas].sort(), duvidosas: [...duvidosas].sort(), sorteadas: sortearOsDezPorCento(aprovadas, `${semente}:${linha.id}`) }
    })
}

export const percentil = (valores: readonly number[], p: number): number => {
  const ordenados = [...valores].sort((a, b) => a - b)
  return ordenados[Math.min(ordenados.length - 1, Math.max(0, Math.ceil((p / 100) * ordenados.length) - 1))] ?? 0
}

/** O uso mensal que o relatório assume para chegar ao custo por aluno e por professor: premissa desta ferramenta, escrita no relatório e a rever por quem decide. O tutor é o de `docs/avaliacao-de-modelos.md` §2 (10 trocas por dia letivo, 20 dias). */
export const USO_MENSAL_DO_ALUNO: Readonly<Record<string, number>> = { turno_do_tutor: 200 }
export const USO_MENSAL_DO_PROFESSOR: Readonly<Record<string, number>> = { propor_ferramenta: 40, gerar_atividade_objetiva: 8, gerar_plano_de_aula: 12, adaptar_atividade: 4, relatorio_da_correcao: 4 }

export interface Medidas {
  readonly modelos: readonly string[]
  readonly latenciaP50Ms: number
  readonly latenciaP95Ms: number
  readonly tokensDeEntrada: number
  readonly tokensDeSaida: number
  readonly custoMicros: number
  readonly custoPorTarefaMicros: Readonly<Record<string, number>>
  readonly custoPorAlunoPorMesMicros: number
  readonly custoPorProfessorPorMesMicros: number
}

const somar = (valores: readonly number[]): number => valores.reduce((soma, valor) => soma + valor, 0)

/** Custo médio, por execução que chegou ao modelo, de cada tarefa. */
function custoPorTarefa(execucoes: readonly ExecucaoDaAmostra[]): Record<string, number> {
  const porTarefa = new Map<string, number[]>()
  for (const execucao of execucoes.filter((candidata) => candidata.origem === 'modelo')) porTarefa.set(execucao.tarefa, [...(porTarefa.get(execucao.tarefa) ?? []), somar(execucao.respostas.map((resposta) => resposta.custoMicros))])
  return Object.fromEntries([...porTarefa].map(([tarefa, custos]) => [tarefa, Math.round(somar(custos) / custos.length)]))
}

const custoDoUso = (uso: Readonly<Record<string, number>>, porTarefa: Readonly<Record<string, number>>): number => somar(Object.entries(uso).map(([tarefa, vezes]) => (porTarefa[tarefa] ?? 0) * vezes))

export function medir(execucoes: readonly ExecucaoDaAmostra[]): Medidas {
  const respostas = execucoes.flatMap((execucao) => execucao.respostas)
  const porTarefa = custoPorTarefa(execucoes)
  return {
    modelos: [...new Set(respostas.map((resposta) => resposta.modelo))].sort(),
    latenciaP50Ms: percentil(execucoes.map((execucao) => execucao.duracaoMs), 50),
    latenciaP95Ms: percentil(execucoes.map((execucao) => execucao.duracaoMs), 95),
    tokensDeEntrada: somar(respostas.map((resposta) => resposta.tokensDeEntrada)),
    tokensDeSaida: somar(respostas.map((resposta) => resposta.tokensDeSaida)),
    custoMicros: somar(respostas.map((resposta) => resposta.custoMicros)),
    custoPorTarefaMicros: porTarefa,
    custoPorAlunoPorMesMicros: custoDoUso(USO_MENSAL_DO_ALUNO, porTarefa),
    custoPorProfessorPorMesMicros: custoDoUso(USO_MENSAL_DO_PROFESSOR, porTarefa),
  }
}

export interface ResultadoDaAvaliacao {
  readonly versao: 1
  readonly finalista: string
  readonly data: string
  readonly modelos: readonly string[]
  /** Algum finalista eliminado por linha eliminatória reprovada. */
  readonly eliminado: boolean
  /** Todas as linhas medidas: enquanto a 12.0 e a 13.0 não existem, `false`. */
  readonly completo: boolean
  readonly linhas: readonly {
    readonly id: string
    readonly tarefa: string
    readonly situacao: Situacao
    readonly eliminada: boolean
    readonly partes: readonly ParteDoResultado[]
    readonly contagens: Contagens
  }[]
}

export function montarResultado(finalista: string, data: string, linhas: readonly LinhaDoResultado[], modelos: readonly string[]): ResultadoDaAvaliacao {
  return {
    versao: 1,
    finalista,
    data,
    modelos,
    eliminado: linhas.some((linha) => linha.eliminada),
    completo: linhas.every((linha) => linha.situacao !== 'nao_medida'),
    linhas: linhas.map(({ id, tarefa, situacao, eliminada, partes, contagens }) => ({ id, tarefa, situacao, eliminada, partes, contagens })),
  }
}

export const serializarResultado = (resultado: ResultadoDaAvaliacao): string => `${JSON.stringify(resultado, null, 2)}\n`

const reais = (micros: number): string => `R$ ${(micros / 1_000_000).toFixed(2).replace('.', ',')}`

export interface DadosDoRelatorio {
  readonly finalista: string
  readonly data: string
  readonly semente: string
  readonly modelo: string
  readonly tokensPorMinuto: number
  readonly arquivos: readonly ArquivoLido[]
  readonly resultado: ResultadoDaAvaliacao
  readonly sha256DoResultado: string
  readonly linhas: readonly LinhaDoResultado[]
  readonly medidas: Medidas
  readonly lista: readonly ListaDoJoaquim[]
}

const sim = (situacao: Situacao): string => ({ aprovada: 'aprovada', reprovada: 'REPROVADA', nao_medida: 'não medida' })[situacao]

function dizReprovada(linha: LinhaDoResultado, unidade: Unidade): string {
  // Nas linhas sem saída no repositório o relatório não repete a razão: só o id, a forma do pedido e o resultado.
  if (LINHAS_SEM_SAIDA.includes(linha.id)) return `- ${unidade.amostra} (${unidade.forma ?? 'sem forma'}), execução ${String(unidade.execucao)}: ${unidade.desfecho === 'conferencia_segurou' ? 'a conferência segurou' : 'reprovada'}`
  return `- ${unidade.amostra}, execução ${String(unidade.execucao)}: ${unidade.razao ?? 'reprovada'}`
}

function secaoDasLinhas(linhas: readonly LinhaDoResultado[]): string[] {
  const tabela = ['| Linha | Situação | A regra decidiu | A conferência segurou | O modelo decidiu | Detalhe |', '|---|---|---|---|---|---|']
  for (const linha of linhas) {
    const detalhe = linha.partes.map((parte) => `${parte.nome}: ${sim(parte.situacao)} (${parte.detalhe})`).join('; ')
    const { regraDecidiu, conferenciaSegurou, modeloDecidiu } = linha.contagens
    tabela.push(`| ${linha.id}${linha.eliminada ? ' (eliminatória)' : ''} | ${sim(linha.situacao)} | ${String(regraDecidiu)} | ${String(conferenciaSegurou)} | ${String(modeloDecidiu)} | ${detalhe} |`)
  }
  return tabela
}

function secaoDasReprovadas(linhas: readonly LinhaDoResultado[]): string[] {
  const saida: string[] = []
  for (const linha of linhas.filter((candidata) => candidata.reprovadas.length > 0)) saida.push(`### ${linha.id}`, '', ...linha.reprovadas.map((unidade) => dizReprovada(linha, unidade)), '')
  return saida.length === 0 ? ['Nenhuma amostra reprovada.', ''] : saida
}

function secaoDaLista(lista: readonly ListaDoJoaquim[], semente: string): string[] {
  const saida = [`Semente do sorteio dos 10% das aprovadas: \`${semente}\`.`, '']
  for (const item of lista) saida.push(`- ${item.linha}: reprovadas ${item.reprovadas.join(', ') || '—'}; duvidosas ${item.duvidosas.join(', ') || '—'}; sorteadas ${item.sorteadas.join(', ') || '—'}`)
  return saida
}

function secaoDosCustos(medidas: Medidas, tokensPorMinuto: number): string[] {
  const porTarefa = Object.entries(medidas.custoPorTarefaMicros).map(([tarefa, micros]) => `${tarefa} ${reais(micros)}`).join('; ') || 'sem medida'
  const uso = (usos: Readonly<Record<string, number>>): string => Object.entries(usos).map(([tarefa, vezes]) => `${String(vezes)} × ${tarefa}`).join(', ')
  return [
    `- Latência por execução: p50 ${String(medidas.latenciaP50Ms)} ms, p95 ${String(medidas.latenciaP95Ms)} ms.`,
    `- Tokens: ${String(medidas.tokensDeEntrada)} de entrada e ${String(medidas.tokensDeSaida)} de saída.`,
    `- Custo desta avaliação: ${reais(medidas.custoMicros)}. Custo médio por execução: ${porTarefa}.`,
    `- Tokens por minuto oferecidos pelo contrato: ${String(tokensPorMinuto)}.`,
    `- Custo por aluno por mês: ${reais(medidas.custoPorAlunoPorMesMicros)} (premissa: ${uso(USO_MENSAL_DO_ALUNO)} por mês).`,
    `- Custo por professor por mês: ${reais(medidas.custoPorProfessorPorMesMicros)} (premissa: ${uso(USO_MENSAL_DO_PROFESSOR)} por mês).`,
  ]
}

/** O `relatorio.md`. Nas linhas da D55 e na rubrica traz só id, forma e resultado; nenhuma saída de modelo entra aqui. */
export function montarRelatorio(dados: DadosDoRelatorio): string {
  const { resultado } = dados
  return [
    `# Avaliação de ${dados.finalista} em ${dados.data}`,
    '',
    `Modelo (a versão exata que respondeu): ${dados.medidas.modelos.join(', ') || dados.modelo}. Configurado: ${dados.modelo}.`,
    `Finalista eliminado: ${resultado.eliminado ? 'SIM' : 'não'}. Todas as linhas medidas: ${resultado.completo ? 'sim' : 'não'}.`,
    '',
    '**Aprovação mínima, não taxa estimada:** cada linha passa ou não passa contra o limiar de `avaliacao.md`; os números abaixo são contagens desta rodada e não valem como taxa esperada em produção. A contagem é por amostra × execução.',
    '',
    '## Arquivos lidos',
    '',
    '| Arquivo | sha256 |',
    '|---|---|',
    ...dados.arquivos.map((arquivo) => `| ${arquivo.caminho} | ${arquivo.sha256} |`),
    '',
    `sha256 do \`resultado.json\`: \`${dados.sha256DoResultado}\``,
    '',
    '## Linhas',
    '',
    ...secaoDasLinhas(dados.linhas),
    '',
    '## Amostras reprovadas',
    '',
    ...secaoDasReprovadas(dados.linhas),
    '## Para o Joaquim confirmar',
    '',
    ...secaoDaLista(dados.lista, dados.semente),
    '',
    '## Latência, tokens e custo',
    '',
    ...secaoDosCustos(dados.medidas, dados.tokensPorMinuto),
    '',
  ].join('\n')
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// O que vai ao repositório: `saidas.jsonl` e `julgamento.jsonl`

const resultadoDaUnidade = (unidade: Unidade): string => (unidade.desfecho === 'regra_decidiu' ? 'regra_decidiu' : unidade.aprovada ? 'aprovada' : unidade.desfecho === 'conferencia_segurou' ? 'conferencia_segurou' : 'reprovada')

const jsonl = (itens: readonly unknown[]): string => (itens.length === 0 ? '' : `${itens.map((item) => JSON.stringify(item)).join('\n')}\n`)

/**
 * As saídas brutas, uma linha por execução de amostra. **Na D55 e na rubrica só o id, a forma e o resultado**: nenhuma resposta do modelo sobre texto de aluno entra no repositório (RF14). A resposta de modelo
 * de outra linha vai inteira, com o código que o veredicto cita.
 */
export function montarSaidas(entrada: EntradaDaDecisao): string {
  return jsonl(
    entrada.execucoes.map((execucao) => {
      const resultado = resultadoDaUnidade(classificarExecucao(execucao, entrada.veredictos, itensMedidosDaLinha(execucao.linha)))
      const base = { linha: execucao.linha, amostra: execucao.amostra, ...(execucao.forma === undefined ? {} : { forma: execucao.forma }), execucao: execucao.execucao }
      if (LINHAS_SEM_SAIDA.includes(execucao.linha)) return { ...base, resultado }
      return { ...base, origem: execucao.origem, resultado, respostas: execucao.respostas, final: execucao.final }
    }),
  )
}

/** Os itens que a parte medida da linha olha: a rubrica, só o "sem juízo"; as outras, todos (`undefined`). */
const itensMedidosDaLinha = (linhaId: string): readonly string[] | undefined => PARTES_DA_11[linhaId]?.[0]?.itens

/** O julgamento, um veredicto por linha. Na D55 e na rubrica só o id, a forma e o resultado: nem os itens nem a razão, que citariam o texto do aluno. */
export function montarJulgamento(entrada: EntradaDaDecisao): string {
  const itens: unknown[] = []
  for (const execucao of entrada.execucoes) {
    for (const resposta of execucao.respostas) {
      const veredicto = entrada.veredictos.get(resposta.codigo)
      if (veredicto === undefined) continue
      const resultado = passaOsItens(veredicto, itensMedidosDaLinha(execucao.linha)) ? 'aprovada' : 'reprovada'
      if (LINHAS_SEM_SAIDA.includes(execucao.linha)) itens.push({ codigo: resposta.codigo, linha: execucao.linha, amostra: execucao.amostra, ...(execucao.forma === undefined ? {} : { forma: execucao.forma }), execucao: execucao.execucao, resultado })
      else itens.push({ codigo: resposta.codigo, linha: execucao.linha, amostra: execucao.amostra, execucao: execucao.execucao, resultado, itens: veredicto.itens, ...(veredicto.razao === undefined ? {} : { razao: veredicto.razao }), ...(veredicto.duvidosa === true ? { duvidosa: true } : {}) })
    }
  }
  return jsonl(itens)
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// As etapas, com as pastas

const metaSchema = z.strictObject({
  versao: z.literal(1),
  finalista: z.string(),
  modelo: z.string(),
  data: z.string(),
  codigo: z.string(),
  semente: z.string(),
  tokensPorMinuto: z.number(),
  arquivos: z.array(z.strictObject({ caminho: z.string(), sha256: z.string() })),
})
export type MetaDaRodada = z.infer<typeof metaSchema>

const execucaoSchema = z.strictObject({
  linha: z.string(),
  tarefa: z.string(),
  amostra: z.string(),
  forma: z.string().optional(),
  execucao: z.number().int(),
  origem: z.enum(['regra_fixa', 'modelo']),
  respostas: z.array(z.strictObject({ codigo: z.string(), texto: z.string(), modelo: z.string(), tokensDeEntrada: z.number(), tokensDeSaida: z.number(), duracaoMs: z.number(), custoMicros: z.number() })),
  final: z.union([z.strictObject({ ok: z.literal(true), saida: z.unknown() }), z.strictObject({ ok: z.literal(false), codigo: z.string() })]),
  viaReserva: z.boolean().optional(),
  duracaoMs: z.number(),
})

/** Os arquivos que a rodada leu, com o sha256 de cada um: o arquivo de amostras, os critérios e os lotes retidos (pelo sha256 do `RETIDOS.json`). */
export function arquivosDaRodada(amostras: Amostras, lidos: readonly ArquivoLido[]): ArquivoLido[] {
  const lotes = amostras.linhas.flatMap((linha) => linha.lotes ?? []).map((lote) => ({ caminho: lote.caminho, sha256: lote.sha256 }))
  return [...lidos, ...lotes]
}

export interface DadosDaRodada {
  readonly argumentos: ArgumentosDaAvaliacao
  readonly finalista: FinalistaConfigurado
  readonly raiz: string
  /** O arquivo de amostras e os critérios já lidos (`lerAmostras`), com o sha256 de cada um. */
  readonly lidas: AmostrasLidas
  readonly nucleo: NucleoDaAvaliacao
  readonly adaptador: ModelAdapter
  readonly aoTerminar?: (feitas: number, total: number) => void
}

/** `rodar`: confere antes do gasto, executa tudo e deixa na pasta (fora do checkout) as execuções, a meta e a pasta de quem julga. */
export async function rodar(dados: DadosDaRodada): Promise<{ readonly execucoes: number; readonly respostasParaJulgar: number }> {
  const { argumentos, raiz } = dados
  const pasta = exigirPastaForaDoCheckout(argumentos.pasta, raiz)
  const { amostras, arquivos } = dados.lidas
  const problemas = conferirAntesDoGasto(amostras, dados.nucleo.TASK_CATALOG)
  if (problemas.length > 0) throw new AvaliacaoRecusada(`antes do gasto: ${problemas.slice(0, 5).join('; ')}`)
  const executor = montarExecutor(dados.nucleo, dados.adaptador, { entradaMicrosPorMilTokens: argumentos.precoEntrada, saidaMicrosPorMilTokens: argumentos.precoSaida })
  const execucoes = await executarAvaliacao(planoDasLinhas(amostras), executor, dados.aoTerminar)
  const codigo = codigoDoFinalista(argumentos.finalista, argumentos.data, argumentos.semente)
  const meta: MetaDaRodada = { versao: 1, finalista: argumentos.finalista, modelo: dados.finalista.modelo, data: argumentos.data, codigo, semente: argumentos.semente, tokensPorMinuto: argumentos.tokensPorMinuto, arquivos: arquivosDaRodada(amostras, arquivos) }
  escrever(join(pasta, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`)
  escrever(join(pasta, 'execucoes.jsonl'), jsonl(execucoes))
  const entregues = prepararJulgamento({ pasta, codigo, raiz, amostras, execucoes })
  return { execucoes: execucoes.length, respostasParaJulgar: entregues.length }
}

export interface DadosDoFechamento {
  readonly argumentos: ArgumentosDaAvaliacao
  readonly raiz: string
  readonly lidas: AmostrasLidas
}

function lerExecucoes(pasta: string): ExecucaoDaAmostra[] {
  return readFileSync(join(pasta, 'execucoes.jsonl'), 'utf8')
    .split('\n')
    .filter((linha) => linha.trim() !== '')
    .map((linha) => execucaoSchema.parse(JSON.parse(linha)) as ExecucaoDaAmostra)
}

/** O que a rodada leu tem de ser o que está no checkout agora: se o arquivo de amostras ou um critério mudou entre a rodada e o fechamento, as respostas julgadas não são as do que o relatório cita. */
function conferirOsArquivosDaRodada(meta: MetaDaRodada, atuais: readonly ArquivoLido[]): void {
  const mudaram = atuais.filter((arquivo) => meta.arquivos.find((lido) => lido.caminho === arquivo.caminho)?.sha256 !== arquivo.sha256).map((arquivo) => arquivo.caminho)
  if (mudaram.length > 0) throw new AvaliacaoRecusada(`o arquivo mudou depois da rodada: ${mudaram.join(', ')}`)
}

/** `fechar`: lê as execuções e os veredictos e grava os quatro arquivos em `docs/avaliacao/<finalista>/<data>/`. Devolve a pasta. */
export function fechar(dados: DadosDoFechamento): string {
  const pasta = exigirPastaForaDoCheckout(dados.argumentos.pasta, dados.raiz)
  const meta = metaSchema.parse(JSON.parse(readFileSync(join(pasta, 'meta.json'), 'utf8')))
  const { amostras, arquivos } = dados.lidas
  conferirOsArquivosDaRodada(meta, arquivos)
  const execucoes = lerExecucoes(pasta)
  const veredictos = lerVeredictos(join(pasta, `julgar-${meta.codigo}`))
  conferirOsVeredictos(execucoes, veredictos)
  const entrada: EntradaDaDecisao = { amostras, execucoes, veredictos }
  const linhas = decidirLinhas(entrada)
  const medidas = medir(execucoes)
  const resultado = montarResultado(meta.finalista, meta.data, linhas, medidas.modelos)
  const textoDoResultado = serializarResultado(resultado)
  const relatorio = montarRelatorio({ finalista: meta.finalista, data: meta.data, semente: meta.semente, modelo: meta.modelo, tokensPorMinuto: meta.tokensPorMinuto, arquivos: meta.arquivos, resultado, sha256DoResultado: sha256DoArquivo(textoDoResultado), linhas, medidas, lista: listaParaOJoaquim(linhas, entrada, meta.semente) })
  const destino = join(dados.raiz, 'docs', 'avaliacao', meta.finalista, meta.data)
  escrever(join(destino, 'saidas.jsonl'), montarSaidas(entrada))
  escrever(join(destino, 'julgamento.jsonl'), montarJulgamento(entrada))
  escrever(join(destino, 'resultado.json'), textoDoResultado)
  escrever(join(destino, 'relatorio.md'), relatorio)
  return destino
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// O ponto de entrada

const raizDoRepositorio = join(dirname(fileURLToPath(import.meta.url)), '../..')
const importar = <T>(caminho: string): Promise<T> => import(pathToFileURL(join(raizDoRepositorio, caminho)).href) as Promise<T>

interface NucleoEmDist extends NucleoDaAvaliacao {
  readonly OpenAICompatAdapter: new (config: { baseUrl: string; modelos: Record<string, string>; chaveApi: string; processamentoLocal: boolean; provedorId: string }) => ModelAdapter
}

/**
 * O núcleo, **módulo a módulo** do `dist`, e nunca o barril (o `index.js` do `dist` do núcleo), que reexporta `db/schema` e os repositories: a ferramenta roda à mão contra um provedor pago e não toca banco. A guarda
 * `ponto-de-entrada-da-avaliacao` segue cada caminho abaixo até o `src` e reprova o barril pelo grafo. O `shared` não tem banco, e o barril dele vale.
 */
const MODULOS_DO_NUCLEO = [
  'packages/core/dist/ia/llm-gateway.js',
  'packages/core/dist/ia/consumo.js',
  'packages/core/dist/ia/suspensao.js',
  'packages/core/dist/ia/tasks/index.js',
  'packages/core/dist/context/context.js',
  'packages/core/dist/ia/openai-compat-adapter.js',
] as const

async function carregarONucleo(): Promise<NucleoEmDist> {
  const modulos = await Promise.all(MODULOS_DO_NUCLEO.map((caminho) => importar<Record<string, unknown>>(caminho)))
  return Object.assign({}, ...modulos) as NucleoEmDist
}
interface CompartilhadoEmDist {
  readonly TAREFAS_DE_IA: readonly string[]
  readonly TIPOS_DE_ADAPTACAO: readonly string[]
}

export interface ComandosDaAvaliacao {
  readonly rodar: () => Promise<string>
  readonly fechar: () => string
}

/** O comando escolhe uma das duas etapas; o ponto de entrada só liga cada uma ao que ela precisa (o provedor, só no `rodar`). */
export async function despachar(comando: Comando, comandos: ComandosDaAvaliacao): Promise<string> {
  return comando === 'fechar' ? comandos.fechar() : await comandos.rodar()
}

/** O aviso de andamento sai de 25 em 25 execuções e na última; nas outras, o texto é vazio. */
export const textoDoAndamento = (feitas: number, total: number): string => (feitas % 25 === 0 || feitas === total ? `${String(feitas)} de ${String(total)} execuções\n` : '')

async function principal(argumentos: readonly string[]): Promise<void> {
  const lidos = lerArgumentos(argumentos)
  const compartilhado = await importar<CompartilhadoEmDist>('packages/shared/dist/index.js')
  const lidas = lerAmostras(raizDoRepositorio, { tarefas: compartilhado.TAREFAS_DE_IA, tiposDeAdaptacao: compartilhado.TIPOS_DE_ADAPTACAO })
  const rodarComOFinalista = async (): Promise<string> => {
    // A recusa sem a chave vem antes de qualquer `import()` do núcleo e de qualquer chamada: a ordem destas linhas é o que garante "recusa antes de gastar", e `principal` não tem teste (o `lerAmbiente`, sim).
    const finalista = lerAmbiente(process.env)
    const nucleo = await carregarONucleo()
    const modelos = { rapido: finalista.modelo, padrao: finalista.modelo, complexo: finalista.modelo, visao: finalista.modelo }
    const adaptador = new nucleo.OpenAICompatAdapter({ baseUrl: finalista.baseUrl, modelos, chaveApi: finalista.chaveApi, processamentoLocal: false, provedorId: lidos.finalista })
    const aoTerminar = (feitas: number, total: number): void => {
      process.stderr.write(textoDoAndamento(feitas, total))
    }
    const resultado = await rodar({ argumentos: lidos, finalista, raiz: raizDoRepositorio, lidas, nucleo, adaptador, aoTerminar })
    return `${String(resultado.execucoes)} execuções; ${String(resultado.respostasParaJulgar)} respostas para julgar (entregue a quem julga só a pasta julgar-<código>, nunca ${lidos.pasta}) em ${lidos.pasta}/julgar-${codigoDoFinalista(lidos.finalista, lidos.data, lidos.semente)}`
  }
  const saida = await despachar(lidos.comando, { rodar: rodarComOFinalista, fechar: () => `gravado em ${fechar({ argumentos: lidos, raiz: raizDoRepositorio, lidas })}; apague a pasta de trabalho ${lidos.pasta}: ela tem a saída crua e o nome do finalista` })
  process.stdout.write(`${saida}\n`)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal(process.argv.slice(2)).catch((erro: unknown) => {
    process.stderr.write(`${erro instanceof AvaliacaoRecusada ? erro.message : 'a avaliação falhou antes de terminar'}\n`)
    process.exitCode = 1
  })
}
