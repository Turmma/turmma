import { nomeDaSerie, type Disciplina, type ResumoDoMaterialRow, type Material, type ResumoDoMaterialResponse, type Serie } from '@educa/shared'

/**
 * O que o resumo do material desenha, sem React (ingestao-do-material, 11.0; RF18; `cenarios.md`, "Telas"): as linhas na ordem em que a coordenação lê (disciplina, série, e o "sem série" por último) e o aviso da migração.
 * Fica num módulo puro para a ordem e a condição do aviso terem teste de unidade e para a tela só desenhar.
 */

/** O nome que a linha sem série leva na coluna "Série". */
export const NOME_DA_LINHA_SEM_SERIE = 'Sem série'

/** Uma linha do resumo como a tabela a mostra: os nomes no lugar dos ids. */
export interface MaterialResumoRow {
  readonly chave: string
  readonly disciplina: string
  readonly serie: string
  readonly pronto: number
  readonly processando: number
  readonly falhou: number
  readonly recusados30Dias: number
}

/** A ordem das etapas: o Ensino Fundamental antes do Médio, como a Estrutura as lista. */
const POSICAO_DA_ETAPA: Readonly<Record<Serie['etapa'], number>> = { ef_anos_finais: 0, em: 1 }

/**
 * As linhas do resumo, **por disciplina (em ordem alfabética) e, dentro dela, por série** (6º ao 9º, depois o 1º ao 3º do Médio), com a linha sem série no fim da disciplina. O id que a escola não tem na lista
 * (a disciplina ou a série lida depois do resumo) vira "Disciplina" ou "Série", e não some da conta.
 */
export function linhasDoResumo(resumo: ResumoDoMaterialResponse, disciplinas: readonly Disciplina[], series: readonly Serie[]): MaterialResumoRow[] {
  const nomeDaDisciplina = new Map(disciplinas.map((disciplina) => [disciplina.id, disciplina.nome]))
  const serieDe = new Map(series.map((serie) => [serie.id, serie]))
  const posicaoDaSerie = (linha: ResumoDoMaterialRow): number => {
    const serie = linha.serieId === null ? undefined : serieDe.get(linha.serieId)
    return serie === undefined ? 1_000 : POSICAO_DA_ETAPA[serie.etapa] * 100 + serie.ano
  }
  return resumo.linhas
    .map((linha) => ({ linha, disciplina: nomeDaDisciplina.get(linha.disciplinaId) ?? 'Disciplina', posicao: linha.serieId === null ? 10_000 : posicaoDaSerie(linha) }))
    .sort((a, b) => a.disciplina.localeCompare(b.disciplina, 'pt-BR') || a.posicao - b.posicao)
    .map(({ linha, disciplina }) => {
      const serie = linha.serieId === null ? undefined : serieDe.get(linha.serieId)
      return {
        chave: `${linha.disciplinaId}:${linha.serieId ?? 'sem-serie'}`,
        disciplina,
        serie: linha.serieId === null ? NOME_DA_LINHA_SEM_SERIE : serie === undefined ? 'Série' : nomeDaSerie(serie),
        pronto: linha.pronto,
        processando: linha.processando,
        falhou: linha.falhou,
        recusados30Dias: linha.recusados30Dias,
      }
    })
}

/**
 * O aviso "séries atribuídas na migração" (Tech Spec, seção 13): o material de antes da declaração de séries ganhou **todas** as séries da escola (o 6º ano vê o material do 9º até a coordenação corrigir), ou
 * nenhuma, se a escola ainda não tinha séries. O aviso aparece quando há material sem série (`semSerie`) **ou** material declarado para todas as séries de uma escola que tem mais de uma: a tela não distingue o
 * que a migração atribuiu do que a coordenação escolheu, e por isso o texto pede que se confira, sem afirmar que o material veio da migração.
 */
export function avisoDaMigracao(resumo: Pick<ResumoDoMaterialResponse, 'semSerie'>, materiais: readonly Pick<Material, 'serieIds'>[] | undefined, series: readonly Serie[]): string | undefined {
  if (resumo.semSerie > 0) {
    return `Séries atribuídas na migração: ${String(resumo.semSerie)} ${resumo.semSerie === 1 ? 'material está sem série e não aparece' : 'materiais estão sem série e não aparecem'} para nenhuma turma. Confira a série de cada um.`
  }
  const comTodas = series.length > 1 && materiais?.some((material) => material.serieIds.length === series.length) === true
  return comTodas
    ? 'Séries atribuídas na migração: o material enviado antes da declaração de séries vale para todas as séries da escola, e o do 9º ano aparece para o 6º. Confira a série de cada um.'
    : undefined
}

/**
 * O que a lista mostra do andamento de cada material, numa linha só: `id:estado`, em ordem. Mudou a linha, mudou o estado de algum material (ou entrou ou saiu um), e é só então que o resumo se relê
 * (regra 80, itens 1 e 10: o resumo não tem laço próprio; a lista, que já se relê enquanto há `processando`, é quem o avisa).
 */
export function assinaturaDosEstados(materiais: readonly Pick<Material, 'id' | 'estado'>[]): string {
  return materiais
    .map((material) => `${material.id}:${material.estado}`)
    .sort()
    .join('|')
}

/**
 * O resumo ficou para trás da lista: ele ainda conta material `processando` e a lista, mais nova, já não tem nenhum. É o material que terminou entre as duas primeiras leituras da aba, antes de haver uma assinatura
 * anterior para comparar.
 */
export function resumoFicouParaTras(resumo: Pick<ResumoDoMaterialResponse, 'linhas'> | undefined, materiais: readonly Pick<Material, 'estado'>[]): boolean {
  return resumo?.linhas.some((linha) => linha.processando > 0) === true && !materiais.some((material) => material.estado === 'processando')
}
