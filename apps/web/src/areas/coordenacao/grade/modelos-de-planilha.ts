import { CABECALHOS_DA_PLANILHA, type TipoDePlanilha } from '@educa/shared'
import { downloadFromUrl } from '../../../components/download-from-url'

/**
 * Os modelos das quatro planilhas para baixar (F2, 14.0; RF1). O cabeçalho vem de `CABECALHOS_DA_PLANILHA`, a mesma tabela que a
 * prévia usa para conferir o arquivo que a coordenação sobe: o modelo baixado e preenchido entra sem erro porque os dois lados leem
 * uma lista só. O modelo traz o cabeçalho e mais nada: uma linha de exemplo seria lida como dado.
 */

/** O nome do arquivo baixado e o rótulo do botão de cada modelo. Um `Record` por tipo: a fonte única, que o painel de importar também lê. */
export const MODELO_DE_CADA_TIPO: Readonly<Record<TipoDePlanilha, { readonly arquivo: string; readonly rotulo: string }>> = {
  alunos: { arquivo: 'modelo-alunos.csv', rotulo: 'Baixar modelo de alunos' },
  professores: { arquivo: 'modelo-professores.csv', rotulo: 'Baixar modelo de professores' },
  grade: { arquivo: 'modelo-grade.csv', rotulo: 'Baixar modelo da grade' },
  calendario: { arquivo: 'modelo-calendario.csv', rotulo: 'Baixar modelo do calendário' },
}

/** Os quatro modelos na ordem em que a coordenação monta a escola. */
export const MODELOS_DE_PLANILHA = (['alunos', 'professores', 'grade', 'calendario'] as const satisfies readonly TipoDePlanilha[]).map((tipo) => ({ tipo, ...MODELO_DE_CADA_TIPO[tipo] }))

/** O texto do modelo: o cabeçalho separado por ponto e vírgula, que o Excel brasileiro abre em colunas, e a quebra de linha. O BOM faz o Excel abrir em UTF-8. */
export function textoDoModelo(cabecalhos: readonly string[]): string {
  return ['\uFEFF', cabecalhos.join(';'), '\r\n'].join('')
}

/** Entrega o modelo ao navegador como arquivo `.csv`. */
export function baixarModelo(cabecalhos: readonly string[], nome: string): void {
  const url = URL.createObjectURL(new Blob([textoDoModelo(cabecalhos)], { type: 'text/csv;charset=utf-8' }))
  downloadFromUrl(url, nome)
  URL.revokeObjectURL(url)
}

/** Baixa o modelo de um dos quatro tipos, com o cabeçalho de `packages/shared`. */
export function baixarModeloDoTipo(tipo: TipoDePlanilha): void {
  baixarModelo(CABECALHOS_DA_PLANILHA[tipo], MODELO_DE_CADA_TIPO[tipo].arquivo)
}
