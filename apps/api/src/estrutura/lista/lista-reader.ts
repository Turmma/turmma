import { DomainException } from '@educa/core'
import {
  ErrorCode,
  matriculaDigitadaSchema,
  nomeDigitadoSchema,
  MAXIMO_DE_BYTES_DA_LISTA,
  MAXIMO_DE_LINHAS_DA_LISTA,
  matriculasQueParecemDocumento,
  type ErroDaLinhaDaLista,
} from '@educa/shared'

/** Uma linha de aluno do texto: o número dela no texto (a partir de 1) e o nome e a matrícula, sem espaço nas pontas. */
export interface LinhaLida {
  readonly linha: number
  readonly nome: string
  readonly matricula: string
}

/** Os separadores aceitos, na ordem em que um vence o outro quando a primeira linha tem mais de um. */
const SEPARADORES = ['\t', ';', ','] as const
type Separador = (typeof SEPARADORES)[number]

const ASPAS = '"'

/**
 * Os campos da linha, separados por `separador` fora de aspas (A1, 2.0, E3). O campo que começa com aspas vai até a aspa
 * que fecha, e o separador dentro dele é texto; `""` dentro das aspas é uma aspa. Aspa que não fecha leva o resto da
 * linha. Sem separador, a linha inteira é um campo só.
 */
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

/** O separador da linha: o primeiro de `SEPARADORES` que aparece nela fora de aspas, se algum aparece. */
function separadorDa(linha: string): Separador | undefined {
  return SEPARADORES.find((separador) => camposDa(linha, separador).length > 1)
}

/** O campo sem acento, em minúsculas e sem espaço nas pontas, para reconhecer o cabeçalho ("Matrícula", "NOME"). */
function normalizado(campo: string): string {
  return campo.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

/**
 * As colunas do cabeçalho, se a linha é um: um campo com "nome" e outro com "matricula", em qualquer caixa, com ou sem
 * acento. A ordem das colunas vem dele, e a linha é ignorada. Sem cabeçalho, o nome é a primeira coluna, e a matrícula,
 * a segunda.
 */
function colunasDoCabecalho(campos: readonly string[]): { readonly nome: number; readonly matricula: number } | undefined {
  const lidos = campos.map(normalizado)
  const matricula = lidos.findIndex((campo) => campo.includes('matricula'))
  const nome = lidos.findIndex((campo, posicao) => posicao !== matricula && campo.includes('nome'))
  return matricula === -1 || nome === -1 ? undefined : { nome, matricula }
}

/**
 * Lê o texto da lista de nomes (A1, 2.0, E3; Tech Spec da A1, seção 4): colado ou lido do arquivo, uma linha por aluno,
 * com nome e matrícula.
 *
 * - Acima de 64 KB em UTF-8, `ENTRADA_INVALIDA` antes de qualquer leitura; acima de 200 linhas de aluno, também. Sem
 *   nenhuma linha de aluno (texto vazio, só cabeçalho, só linha em branco), também: não há o que gravar.
 * - O BOM do começo, que o Excel grava, sai com o espaço das pontas: o `trim` do JavaScript o conta como espaço.
 * - Linhas separadas por `\n`, `\r\n` ou `\r`. Linha em branco, ou só com separadores e espaço (a linha vazia do Excel,
 *   `;;`), é ignorada e não conta no teto, mas conta na numeração, que é a do arquivo.
 * - O separador é o primeiro de tabulação, `;` e `,` que aparece fora de aspas na primeira linha que tem algum deles, e
 *   vale para o texto inteiro: o título sem separador antes da lista não a desmonta, e vira uma linha com erro. Sem
 *   separador em linha nenhuma, cada linha é um campo só.
 * - O cabeçalho é reconhecido e ignorado; a ordem das colunas vem dele. Coluna a mais é ignorada.
 * - Nome e matrícula sem espaço nas pontas. Campo que falta vira vazio, e a conferência de cada linha
 *   (`errosDasLinhas`) aponta.
 */
export function lerTextoDaLista(texto: string): LinhaLida[] {
  if (Buffer.byteLength(texto, 'utf8') > MAXIMO_DE_BYTES_DA_LISTA) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
  const fisicas = texto.split(/\r\n|\r|\n/)
  let separador: Separador | undefined
  for (const conteudo of fisicas) {
    separador = separadorDa(conteudo)
    if (separador !== undefined) break
  }
  const lidas = fisicas
    .map((conteudo, posicao) => ({ linha: posicao + 1, campos: camposDa(conteudo, separador).map((campo) => campo.trim()) }))
    .filter(({ campos }) => campos.some((campo) => campo !== ''))
  const cabecalho = lidas[0] === undefined ? undefined : colunasDoCabecalho(lidas[0].campos)
  const deAlunos = cabecalho === undefined ? lidas : lidas.slice(1)
  if (deAlunos.length === 0 || deAlunos.length > MAXIMO_DE_LINHAS_DA_LISTA) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
  const colunas = cabecalho ?? { nome: 0, matricula: 1 }
  return deAlunos.map(({ linha, campos }) => ({ linha, nome: campos[colunas.nome] ?? '', matricula: campos[colunas.matricula] ?? '' }))
}

/**
 * O erro de cada linha que se confere sem o banco, na posição dela, ou `undefined` (A1, 2.0, E4): primeiro o nome
 * (`sem_nome`, `nome_invalido`), depois a matrícula (`sem_matricula`, `matricula_invalida`), depois a forma de
 * documento (`matricula_parece_documento`: CPF pontuado ou data, ou CPF sem pontuação na lista que é uma coluna de CPF,
 * `matriculasQueParecemDocumento` de `packages/shared`, a mesma que a tela usa; regra 20, item 2), depois a repetição no
 * texto (`matricula_repetida`, em cada linha da matrícula que aparece mais de uma vez; a linha que tem outro erro conta
 * na repetição, e mostra o erro dela). O nome e a matrícula seguem as regras do nome avulso (`nomeDigitadoSchema`, `matriculaDigitadaSchema`): as duas entradas gravam a mesma coisa.
 */
export function errosDasLinhas(linhas: readonly LinhaLida[]): Array<ErroDaLinhaDaLista | undefined> {
  // A maioria da coluna de CPF conta todas as matrículas preenchidas, também as de linha com outro erro: é a coluna do
  // texto que se julga, e a linha errada por outro motivo continua sendo uma linha daquela coluna.
  const parecemDocumento = matriculasQueParecemDocumento(linhas.map((linha) => linha.matricula))
  const doCampo = linhas.map(({ nome, matricula }, posicao): ErroDaLinhaDaLista | undefined => {
    if (nome === '') return 'sem_nome'
    if (!nomeDigitadoSchema.safeParse(nome).success) return 'nome_invalido'
    if (matricula === '') return 'sem_matricula'
    if (!matriculaDigitadaSchema.safeParse(matricula).success) return 'matricula_invalida'
    if (parecemDocumento[posicao] === true) return 'matricula_parece_documento'
    return undefined
  })
  const vezes = new Map<string, number>()
  for (const { matricula } of linhas) vezes.set(matricula, (vezes.get(matricula) ?? 0) + 1)
  return linhas.map(({ matricula }, posicao) => doCampo[posicao] ?? ((vezes.get(matricula) ?? 0) > 1 ? 'matricula_repetida' : undefined))
}
