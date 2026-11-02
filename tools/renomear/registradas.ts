import { arquivoDepoisDasOndas, type Mapa } from './mapa.ts'
import { TITULO_DA_TROCA_A_MAO } from './relatorio.ts'

/**
 * As linhas da tabela "Troca à mão" do relatório da onda, `arquivo` e `nome`: a palavra comum que a onda olhou e decidiu. O `restos`
 * não a cobra, e o `reaplicar` não a troca (ela não é nome antigo do merge).
 */
export function trocaAMaoRegistrada(relatorio: string): Set<string> {
  const registrada = new Set<string>()
  const linhas = relatorio.split('\n')
  const inicio = linhas.indexOf(TITULO_DA_TROCA_A_MAO)
  if (inicio < 0) return registrada
  for (const linha of linhas.slice(inicio + 1)) {
    if (linha.startsWith('## ')) break
    const celulas = linha.split(/(?<!\\)\|/).map((celula) => celula.trim())
    const [, arquivo, nome] = celulas
    if (celulas.length >= 4 && arquivo !== undefined && nome !== undefined && arquivo !== 'Arquivo' && !/^-+$/.test(arquivo)) registrada.add(`${arquivo}\u0000${nome}`)
  }
  return registrada
}

/** A chave `arquivo\0nome` da troca à mão, com o arquivo levado pelos movimentos das ondas seguintes. */
export function chaveDaTrocaAMaoNoLugarDeHoje(chave: string, mapas: readonly Mapa[], indiceDaOnda: number): string {
  const [arquivo = '', nome = ''] = chave.split('\u0000')
  return `${arquivoDepoisDasOndas(arquivo, mapas, indiceDaOnda)}\u0000${nome}`
}
