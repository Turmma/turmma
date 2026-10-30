import { pareceDocumento, type ErroDaLinhaDaLista, type PreviaRow, type PreviaDaListaResponse } from '@educa/shared'

/**
 * O que a prévia da lista diz à coordenação (A1, 13.0; RF4), fora da tela para ser provado sem navegador. A API dá o
 * resultado de cada linha; aqui ficam o texto do erro, a ordem (erros primeiro) e os avisos sobre o que o leitor da 2.0
 * aceita calado e a tela precisa apontar.
 */

/** O erro de cada linha em texto, sem código (regra 50, item 12): o que está errado e, pelo texto, o que fazer. */
export const TEXTO_DO_ERRO_DA_LINHA: Readonly<Record<ErroDaLinhaDaLista, string>> = {
  sem_nome: 'Falta o nome.',
  nome_invalido: 'O nome passa de 200 caracteres ou tem um caractere que não é texto.',
  sem_matricula: 'Falta a matrícula.',
  matricula_invalida: 'A matrícula passa de 40 caracteres ou tem um caractere que não é texto.',
  matricula_parece_documento: 'Parece CPF ou data de nascimento, e não matrícula: confira esta linha.',
  matricula_repetida: 'Esta matrícula aparece em mais de uma linha do texto.',
  matricula_em_uso: 'Esta matrícula já é de um aluno da escola ou está na lista de outra turma.',
}

/** O que acontece com a linha que não tem erro, em texto. O `ja_existe` diz que o nome gravado não muda (RF5). */
export const TEXTO_DO_RESULTADO = {
  entra: 'Entra na lista.',
  ja_existe: 'Já está na lista desta turma, por esta matrícula: nada muda, nem o nome gravado.',
} as const

/** As linhas na ordem da tela: as de erro primeiro, e cada grupo na ordem do texto. */
export function linhasNaOrdemDaTela(linhas: readonly PreviaRow[]): PreviaRow[] {
  const pelaLinha = (a: PreviaRow, b: PreviaRow) => a.linha - b.linha
  return [...linhas.filter((linha) => linha.resultado === 'erro').sort(pelaLinha), ...linhas.filter((linha) => linha.resultado !== 'erro').sort(pelaLinha)]
}

/**
 * Os avisos da prévia, sobre o que o leitor da lista (2.0) aceita e pode não ser o que a coordenação quis:
 *
 * - `titulo_antes_da_lista`: o separador é o da primeira linha que tem um, e um título com vírgula ("Turma 8ºA, manhã")
 *   faz as linhas `nome;matrícula` saírem todas sem matrícula. Metade ou mais das linhas, e pelo menos duas, sem
 *   matrícula;
 * - `cabecalho_nao_reconhecido`: só "nome" e "matrícula" são lidos como cabeçalho, e um `Nome;RA` entra como aluno. A
 *   primeira linha sem erro com a matrícula sem nenhum algarismo;
 * - `coluna_parece_documento`: sem cabeçalho a segunda coluna é a matrícula, e um `nome;CPF` ou `nome;nascimento`
 *   gravaria o CPF ou a data como matrícula (regra 20, item 2: aluno não tem CPF nem data de nascimento). Alguma linha
 *   que a API marcou com `matricula_parece_documento` (CPF pontuado, data, ou a coluna com maioria de CPF sem
 *   pontuação), ou com a forma de CPF pontuado ou de data e outro erro antes (`pareceDocumento`, de `packages/shared`).
 *   A API recusa a gravação dessa lista (correção `2026-10-03-trava-de-documento-so-na-tela`), e a tela diz o porquê.
 */
export const AVISOS_DA_PREVIA = ['titulo_antes_da_lista', 'cabecalho_nao_reconhecido', 'coluna_parece_documento'] as const
export type AvisoDaPrevia = (typeof AVISOS_DA_PREVIA)[number]

export const TEXTO_DO_AVISO: Readonly<Record<AvisoDaPrevia, string>> = {
  titulo_antes_da_lista:
    'Quase todas as linhas ficaram sem matrícula. Se a primeira linha é um título (como "Turma 8ºA, manhã"), tire-a e veja a prévia de novo: a lista usa o separador da primeira linha que tem um.',
  cabecalho_nao_reconhecido:
    'A primeira linha parece um cabeçalho, e vai entrar como aluno. Só "nome; matrícula" é lido como cabeçalho: troque a linha por "nome; matrícula" ou tire-a.',
  coluna_parece_documento:
    'A segunda coluna parece CPF ou data de nascimento, e não matrícula. A lista leva só nome e matrícula: confira as colunas e tire o CPF e a data antes de gravar.',
}

export function avisosDaPrevia(linhas: readonly PreviaRow[]): AvisoDaPrevia[] {
  const avisos: AvisoDaPrevia[] = []
  const semMatricula = linhas.filter((linha) => linha.erro === 'sem_matricula').length
  if (semMatricula >= 2 && semMatricula * 2 >= linhas.length) avisos.push('titulo_antes_da_lista')
  const [primeira] = [...linhas].sort((a, b) => a.linha - b.linha)
  if (primeira !== undefined && primeira.resultado !== 'erro' && !/\d/.test(primeira.matricula)) avisos.push('cabecalho_nao_reconhecido')
  if (linhas.some((linha) => linha.erro === 'matricula_parece_documento' || pareceDocumento(linha.matricula))) avisos.push('coluna_parece_documento')
  return avisos
}

/**
 * A gravação que a tela oferece: sem linha de erro (a API recusaria), com algo novo a gravar e sem a coluna que parece
 * documento. O motivo vai para a tela quando não pode, sem repetir o texto do aviso. A linha que parece documento é erro
 * para a API; sem outro erro, o motivo é o da coluna, que o aviso explica.
 */
export function podeGravar(previa: PreviaDaListaResponse): { readonly pode: true } | { readonly pode: false; readonly motivo: string } {
  const outrosErros = previa.linhas.filter((linha) => linha.resultado === 'erro' && linha.erro !== 'matricula_parece_documento').length
  if (outrosErros > 0) return { pode: false, motivo: 'Corrija as linhas com erro no texto e veja a prévia de novo: a lista só é gravada sem erro nenhum.' }
  // Daqui em diante, todo erro que sobrar é de documento. O aviso acima da prévia já diz o que fazer: aqui, só que a
  // gravação espera por isso.
  const soErroDeDocumento = previa.comErro > 0
  if (soErroDeDocumento || avisosDaPrevia(previa.linhas).includes('coluna_parece_documento')) return { pode: false, motivo: 'Nada é gravado enquanto a segunda coluna parecer CPF ou data de nascimento.' }
  if (previa.entram === 0) return { pode: false, motivo: 'Nada novo para gravar: todos os nomes já estão na lista desta turma.' }
  return { pode: true }
}
