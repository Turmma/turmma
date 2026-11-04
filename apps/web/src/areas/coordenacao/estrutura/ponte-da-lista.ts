import {
  ErrorCode,
  INTERVALO_DA_CONSULTA_DE_EXECUCAO_MS,
  type ErroDaLinhaDaLista,
  type Importacao,
  type PreviaDaListaResponse,
  type PreviaDaPlanilhaResponse,
  type PreviaRow,
  type ResultadoDaLinhaDaLista,
} from '@educa/shared'
import { ApiError } from '../../../api/client'

/**
 * A ponte entre a API nova da lista da turma (F2, 8.0: o contrato da importação) e a tela da A1, que ainda lê o formato antigo (a
 * prévia com nome e matrícula em cada linha, a gravação com as contagens na resposta). A 13.0 troca a lista pelo `ImportarPlanilha`,
 * que lê o contrato novo direto, e apaga este arquivo junto de `api/lista.ts` e dos esquemas antigos (`TODO.md`). Até lá a ponte
 * só traduz: nenhuma regra da lista mora aqui, e o que a API disse não é mudado, só reescrito no formato que a tela entende.
 */

const SEPARADORES = ['\t', ';', ','] as const
type Separador = (typeof SEPARADORES)[number]
const ASPAS = '"'

/** Os campos da linha, como o leitor da API os separa: fora de aspas, `""` dentro delas é uma aspa, aspa que não fecha leva o resto. */
function camposDa(linha: string, separador: Separador | undefined): string[] {
  if (separador === undefined) return [linha]
  const campos: string[] = []
  let atual = ''
  let entreAspas = false
  for (let posicao = 0; posicao < linha.length; posicao += 1) {
    const caractere = linha[posicao]
    if (entreAspas) {
      if (caractere !== ASPAS) atual += caractere
      else if (linha[posicao + 1] === ASPAS) {
        atual += ASPAS
        posicao += 1
      } else entreAspas = false
    } else if (caractere === ASPAS && atual.trim() === '') {
      entreAspas = true
      atual = ''
    } else if (caractere === separador) {
      campos.push(atual)
      atual = ''
    } else atual += caractere
  }
  campos.push(atual)
  return campos
}

const normalizado = (campo: string): string => campo.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

/**
 * Nome e matrícula de cada linha do texto, pelo número dela (contando cabeçalho e linha em branco), como `lerTextoDaLista` da API, e
 * quantas dessas linhas são de aluno (as lidas, menos o cabeçalho, quando há).
 */
function nomeEMatriculaPorLinha(texto: string): { readonly porLinha: Map<number, { readonly nome: string; readonly matricula: string }>; readonly alunos: number } {
  const fisicas = texto.split(/\r\n|\r|\n/)
  let separador: Separador | undefined
  for (const conteudo of fisicas) {
    separador = SEPARADORES.find((candidato) => camposDa(conteudo, candidato).length > 1)
    if (separador !== undefined) break
  }
  const lidas = fisicas
    .map((conteudo, posicao) => ({ linha: posicao + 1, campos: camposDa(conteudo, separador).map((campo) => campo.trim()) }))
    .filter(({ campos }) => campos.some((campo) => campo !== ''))
  const primeira = lidas[0]
  const lidos = primeira?.campos.map(normalizado) ?? []
  const matricula = lidos.findIndex((campo) => campo.includes('matricula'))
  const nome = lidos.findIndex((campo, posicao) => posicao !== matricula && campo.includes('nome'))
  const comCabecalho = matricula !== -1 && nome !== -1
  const colunas = comCabecalho ? { nome, matricula } : { nome: 0, matricula: 1 }
  const porLinha = new Map(lidas.map(({ linha, campos }) => [linha, { nome: campos[colunas.nome] ?? '', matricula: campos[colunas.matricula] ?? '' }]))
  return { porLinha, alunos: comCabecalho ? lidas.length - 1 : lidas.length }
}

/** Quantas linhas do texto são de aluno: a conta a que a gravação se confere (`gravacaoDe`). */
export const alunosDoTexto = (texto: string): number => nomeEMatriculaPorLinha(texto).alunos

/**
 * O erro da planilha de alunos no código que a tela da lista sabe dizer em texto. Os três de turma só existem na planilha da escola
 * inteira (a lista traz a turma no caminho), e a API os recusa antes: se chegarem, o contrato mudou, e a falha aparece.
 */
const ERRO_DA_LISTA: Readonly<Record<string, ErroDaLinhaDaLista | undefined>> = {
  linha_incompleta: 'sem_matricula',
  sem_nome: 'sem_nome',
  nome_invalido: 'nome_invalido',
  sem_matricula: 'sem_matricula',
  matricula_invalida: 'matricula_invalida',
  matricula_notacao_cientifica: 'matricula_invalida',
  matricula_parece_documento: 'matricula_parece_documento',
  matricula_repetida: 'matricula_repetida',
}

/**
 * O que a linha faz, nas duas palavras da tela antiga. Só `entra` e `ja_existe` têm tradução fiel. "Muda de turma" não grava sem a
 * marca da coordenação (que a tela da A1 não tem), e a matrícula é de outro lugar: vira o erro `matricula_em_uso`, que a tela já diz.
 * "Nome corrigido" **grava** (a API corrige o nome sempre) e a tela da A1 não sabe mostrar isso: dizer "já existe, nada muda" seria
 * esconder uma escrita em dado de aluno, e por isso ele fica fora da tabela, e a ponte o trata como falha de contrato. A tela nova
 * (13.0) mostra os dois por extenso.
 */
const RESULTADO_DA_LISTA: Readonly<Record<string, Exclude<ResultadoDaLinhaDaLista, 'erro'> | undefined>> = {
  entra: 'entra',
  ja_existe: 'ja_existe',
}

/** A prévia nova no formato da tela da A1, com o nome e a matrícula tirados do texto que foi enviado. */
export function previaNoFormatoDaLista(texto: string, resposta: PreviaDaPlanilhaResponse): PreviaDaListaResponse {
  const doTexto = nomeEMatriculaPorLinha(texto).porLinha
  const linhas = resposta.linhas.map((lida): PreviaRow => {
    const { nome, matricula } = doTexto.get(lida.linha) ?? { nome: '', matricula: '' }
    if (lida.resultado === 'erro') {
      const erro = lida.erro === undefined ? undefined : ERRO_DA_LISTA[lida.erro]
      if (erro === undefined) throw new ApiError(ErrorCode.ERRO_INTERNO)
      return { linha: lida.linha, nome, matricula, resultado: 'erro', erro }
    }
    if (lida.resultado === 'muda_de_turma') return { linha: lida.linha, nome, matricula, resultado: 'erro', erro: 'matricula_em_uso' }
    const resultado = RESULTADO_DA_LISTA[lida.resultado]
    if (resultado === undefined) throw new ApiError(ErrorCode.ERRO_INTERNO)
    return { linha: lida.linha, nome, matricula, resultado }
  })
  const quantas = (resultado: ResultadoDaLinhaDaLista) => linhas.filter((linha) => linha.resultado === resultado).length
  return { linhas, entram: quantas('entra'), jaExistem: quantas('ja_existe'), comErro: quantas('erro') }
}

/**
 * Quanto esperar entre uma leitura da importação e a seguinte, e por quanto tempo. O job leva segundos; o prazo cobre a fila cheia. A
 * espera começa no intervalo que a casa usa para acompanhar uma execução (1 s) e cresce 1,5 vez a cada leitura até o teto de 3 s:
 * em 60 s são umas 22 leituras, bem abaixo do limite por usuário (120 por minuto), que a coordenadora divide com tudo o mais que
 * faz (regra 80, item 1). Cada leitura passa pela sessão no banco.
 */
export const ESPERA_ENTRE_LEITURAS_DA_IMPORTACAO_MS = INTERVALO_DA_CONSULTA_DE_EXECUCAO_MS
export const ESPERA_MAXIMA_ENTRE_LEITURAS_DA_IMPORTACAO_MS = 3_000
export const PRAZO_DA_IMPORTACAO_MS = 60_000

export interface AcompanhamentoDaImportacao {
  readonly esperaMs?: number
  readonly esperaMaximaMs?: number
  readonly prazoMs?: number
}

/** O que da importação a ponte lê: o estado e as contagens (`Importacao` de `@educa/shared`). */
type EstadoLido = Pick<Importacao, 'estado' | 'resumo'>

const ESTADO_NA_FILA: EstadoLido = { estado: 'na_fila', resumo: null }

/** A leitura da importação, com o limite por usuário (`LIMITE_EXCEDIDO`) lido como "ainda na fila": a tela não vê o 429. */
async function lerSemOLimite(ler: () => Promise<EstadoLido>): Promise<EstadoLido> {
  try {
    return await ler()
  } catch (erro) {
    if (erro instanceof ApiError && erro.codigo === ErrorCode.LIMITE_EXCEDIDO) return ESTADO_NA_FILA
    throw erro
  }
}

/**
 * Espera a importação sair da fila e devolve as contagens no formato da tela da A1. `desatualizada` (a prévia envelheceu: outra
 * pessoa mexeu na lista) é `CONFLITO`, que a tela trata como prévia a refazer; `falhou` é erro de servidor; a fila que não anda dentro
 * do prazo é indisponibilidade, e a tela deixa "Gravar lista" para tentar de novo (a gravação é idempotente: o que entrou fica como
 * "já existe"). O limite por usuário (`LIMITE_EXCEDIDO`) numa leitura não chega à tela: conta como "ainda na fila", com a espera
 * seguinte (que já cresce), e depois do prazo é indisponibilidade como a fila parada. `alunos` é quantas linhas de aluno o texto tem.
 */
export async function esperarAGravacao(
  ler: () => Promise<EstadoLido>,
  alunos: number,
  { esperaMs = ESPERA_ENTRE_LEITURAS_DA_IMPORTACAO_MS, esperaMaximaMs = ESPERA_MAXIMA_ENTRE_LEITURAS_DA_IMPORTACAO_MS, prazoMs = PRAZO_DA_IMPORTACAO_MS }: AcompanhamentoDaImportacao = {},
): Promise<Gravacao> {
  const limite = Date.now() + prazoMs
  let espera = esperaMs
  for (;;) {
    const gravacao = gravacaoDe(await lerSemOLimite(ler), alunos)
    if (gravacao !== undefined) return gravacao
    if (Date.now() >= limite) throw new ApiError(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
    await new Promise((resolver) => setTimeout(resolver, espera))
    espera = Math.min(espera * 1.5, esperaMaximaMs)
  }
}

type Gravacao = { gravados: number; jaExistentes: number }

/**
 * As contagens da importação concluída. Os nomes corrigidos contam entre os gravados (foram escritos). Linha de aluno que não entrou,
 * não existia nem foi corrigida é linha que a gravação deixou de fora (a matrícula passou a ser de outra turma depois da prévia, e
 * sem a marca da coordenação nada é transferido): a conta não fecha, e a tela não pode dizer "0 nomes gravados" calada. É
 * `CONFLITO`, a prévia a refazer.
 */
function contagemDaGravacao(resumo: EstadoLido['resumo'], alunos: number): Gravacao {
  const { entram = 0, nomes_corrigidos: corrigidos = 0, ja_existem: jaExistentes = 0, transferidos = 0 } = resumo ?? {}
  if (entram + corrigidos + jaExistentes + transferidos < alunos) throw new ApiError(ErrorCode.CONFLITO)
  return { gravados: entram + corrigidos, jaExistentes }
}

/** A importação lida: as contagens se concluiu, `undefined` se ainda está na fila, e o erro que a tela entende nos outros dois estados. */
function gravacaoDe(lida: EstadoLido, alunos: number): Gravacao | undefined {
  if (lida.estado === 'concluida') return contagemDaGravacao(lida.resumo, alunos)
  if (lida.estado === 'desatualizada') throw new ApiError(ErrorCode.CONFLITO)
  if (lida.estado === 'falhou') throw new ApiError(ErrorCode.ERRO_INTERNO)
  return undefined
}
