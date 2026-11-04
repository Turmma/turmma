import { DomainException, type ListaRow } from '@educa/core'
import { ErrorCode, MAXIMO_DE_BYTES_DA_LISTA, MAXIMO_DE_LINHAS_DA_LISTA } from '@educa/shared'

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
 * - Acima de 512 KB em UTF-8, `ENTRADA_INVALIDA` antes de qualquer leitura; acima de 3.000 linhas de aluno, também (o teto da planilha de
 *   alunos, F2, 8.0). O erro de cada linha (nome, matrícula, documento, repetida) é o da classificação do core, igual ao da planilha. Sem
 *   nenhuma linha de aluno (texto vazio, só cabeçalho, só linha em branco), também: não há o que gravar.
 * - O BOM do começo, que o Excel grava, sai com o espaço das pontas: o `trim` do JavaScript o conta como espaço.
 * - Linhas separadas por `\n`, `\r\n` ou `\r`. Linha em branco, ou só com separadores e espaço (a linha vazia do Excel,
 *   `;;`), é ignorada e não conta no teto, mas conta na numeração, que é a do arquivo.
 * - O separador é o primeiro de tabulação, `;` e `,` que aparece fora de aspas na primeira linha que tem algum deles, e
 *   vale para o texto inteiro: o título sem separador antes da lista não a desmonta, e vira uma linha com erro. Sem
 *   separador em linha nenhuma, cada linha é um campo só.
 * - O cabeçalho é reconhecido e ignorado; a ordem das colunas vem dele. Coluna a mais é ignorada.
 * - Nome e matrícula sem espaço nas pontas. Campo que falta vira vazio, e a conferência de cada linha
 *   (a classificação) aponta.
 */
export function lerTextoDaLista(texto: string): ListaRow[] {
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
