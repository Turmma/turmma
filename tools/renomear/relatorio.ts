import type { Mapa, OcorrenciaClassificada, Recusa } from './mapa.ts'
import type { Referencia } from './referencias.ts'
import type { TrocaAMao } from './texto.ts'

/**
 * O `<N>.relatorio.md` da onda (Tech Spec da X8, §5, passo 7). Os títulos de seção são fixos: o `restos` lê a troca à mão
 * registrada, e a revisão da onda lê as ocorrências. A tabela "Sem classificação" copia a linha do código-fonte (coluna `Trecho`):
 * o relatório só se gera sobre a árvore versionada, de seed sintético, e **nunca sobre uma árvore com dado real** (regra 20,
 * item 17): o repositório é público e o relatório pode ser versionado.
 */

export const TITULO_DAS_OCORRENCIAS = '## Ocorrências por texto'
export const TITULO_DA_TROCA_A_MAO = '## Troca à mão'
export const TITULO_SEM_CLASSIFICACAO = '## Sem classificação'
export const TITULO_DAS_RECUSAS = '## Recusas'

export interface DadosDoRelatorio {
  mapa: Mapa
  caminhoDoMapa: string
  recusas: readonly Recusa[]
  ocorrencias: ReadonlyArray<{ referencia: Referencia; classificacao: OcorrenciaClassificada }>
  semClassificacao: readonly Referencia[]
  aMao: readonly TrocaAMao[]
  arquivosTocados: number
}

const celula = (texto: string): string => texto.replace(/\|/g, '\\|')

function tabela(cabecalho: readonly string[], linhas: readonly (readonly string[])[]): string[] {
  return [`| ${cabecalho.join(' | ')} |`, `|${cabecalho.map(() => '---').join('|')}|`, ...linhas.map((linha) => `| ${linha.map(celula).join(' | ')} |`)]
}

/** A troca à mão, uma linha por arquivo e palavra, com as linhas juntas: `com` aparece dezenas de vezes por arquivo. */
function trocaAMaoAgrupada(aMao: readonly TrocaAMao[]): string[][] {
  const grupos = new Map<string, number[]>()
  for (const { arquivo, de, linha } of aMao) grupos.set(`${arquivo}\u0000${de}`, [...(grupos.get(`${arquivo}\u0000${de}`) ?? []), linha])
  return [...grupos].map(([chave, linhas]) => {
    const [arquivo = '', de = ''] = chave.split('\u0000')
    return [arquivo, de, linhas.join(', ')]
  })
}

export function montarRelatorio(dados: DadosDoRelatorio): string {
  const { mapa } = dados
  const vermelho = dados.recusas.length > 0 || dados.semClassificacao.length > 0
  const contagem = (tipo: string) => String(mapa.entradas.filter((entrada) => entrada.tipo === tipo).length)
  const linhas = [
    `# Relatório da onda ${mapa.nome}`,
    '',
    `**Mapa:** \`${dados.caminhoDoMapa}\`${mapa.linha ? ' (onda de linha: nenhum documento tocado)' : ''}`,
    `**Estado:** ${vermelho ? 'vermelho' : 'verde'}`,
    '',
    `Entradas: ${String(mapa.entradas.length)} (${contagem('simbolo')} símbolos, ${contagem('arquivo')} arquivos, ${contagem('pasta')} pastas, ${contagem('pacote')} pacotes). Arquivos tocados: ${String(dados.arquivosTocados)}.`,
    '',
  ]
  if (dados.recusas.length > 0) linhas.push(TITULO_DAS_RECUSAS, '', ...dados.recusas.map((recusa) => `- ${recusa.codigo}: ${recusa.detalhe}`), '')
  linhas.push(TITULO_DAS_OCORRENCIAS, '')
  linhas.push(...tabela(['Arquivo', 'Linha', 'Nome', 'Classe', 'Linha do anexo'], dados.ocorrencias.map(({ referencia, classificacao }) => [referencia.arquivo, String(referencia.linha), referencia.de, classificacao.classe, classificacao.linha])), '')
  if (dados.semClassificacao.length > 0) {
    linhas.push(TITULO_SEM_CLASSIFICACAO, '', ...tabela(['Arquivo', 'Linha', 'Nome', 'Trecho'], dados.semClassificacao.map((r) => [r.arquivo, String(r.linha), r.de, r.trecho])), '')
  }
  linhas.push(TITULO_DA_TROCA_A_MAO, '', ...tabela(['Arquivo', 'Nome', 'Linhas'], trocaAMaoAgrupada(dados.aMao)), '')
  return linhas.join('\n')
}
