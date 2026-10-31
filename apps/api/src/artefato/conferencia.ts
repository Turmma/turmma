import { LLMError } from '@educa/core'
import { habilidadesDaDisciplina, type AdaptacaoAplicada, type Citacao, type ConteudoDeAtividade, type ConteudoDoArtefato, type Etapa, type Habilidade } from '@educa/shared'

/** Quantas habilidades uma tarefa aceita (`habilidadesSchema`, na camada de IA). */
export const MAXIMO_DE_HABILIDADES_NA_TAREFA = 6

function palavrasDe(texto: string): Set<string> {
  const semAcento = texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
  return new Set((semAcento.match(/[\p{L}\p{N}]+/gu) ?? []).filter((palavra) => palavra.length >= 3))
}

/**
 * As habilidades do catálogo que a tarefa pode cobrar, para a disciplina e a etapa da turma: até seis, primeiro as que
 * mais têm a ver com o tema pedido (pelo assunto e pela descrição), e no empate na ordem do catálogo. Só código e
 * descrição: a entrada da tarefa é estrita. Sem catálogo para a disciplina, vem a habilidade geral, nunca lista vazia.
 */
export function habilidadesParaOTema(disciplina: string, etapa: Etapa, tema: string): Habilidade[] {
  const doTema = palavrasDe(tema)
  return habilidadesDaDisciplina(disciplina, etapa)
    .map((habilidade, posicao) => ({ habilidade, posicao, afinidade: [...palavrasDe(`${habilidade.tema} ${habilidade.descricao}`)].filter((palavra) => doTema.has(palavra)).length }))
    .sort((a, b) => b.afinidade - a.afinidade || a.posicao - b.posicao)
    .slice(0, MAXIMO_DE_HABILIDADES_NA_TAREFA)
    .map(({ habilidade }) => ({ codigo: habilidade.codigo, descricao: habilidade.descricao }))
}

/** Toda citação que o conteúdo guarda: a de cada questão, ou a lista do plano e a de cada etapa. */
export function citacoesDoConteudo(conteudo: ConteudoDoArtefato): Citacao[] {
  if (conteudo.tipo === 'atividade_objetiva') return conteudo.questoes.map((questao) => questao.citacao)
  return [...conteudo.citacoes, ...conteudo.etapas.flatMap((etapa) => (etapa.citacao === undefined ? [] : [etapa.citacao]))]
}

const mesmosTipos = (a: readonly string[], b: readonly string[]): boolean => [...a].sort().join(',') === [...b].sort().join(',')

/**
 * A versão adaptada muda a forma, **nunca o que é cobrado** (D67; `docs/aia/adaptacao.md`): as mesmas questões, na
 * mesma ordem, com as mesmas alternativas em número, o mesmo gabarito, a mesma habilidade e a mesma citação; e a
 * `adaptacao` gravada é exatamente a que o professor pediu. A camada de IA confere isso na saída do modelo; esta é a
 * conferência de quem grava. Fora disso, `IA_SAIDA_INVALIDA`, e nem a versão nem a entrega nascem.
 */
export function exigirAdaptacaoFiel(original: ConteudoDeAtividade, adaptada: ConteudoDeAtividade, pedida: AdaptacaoAplicada): void {
  const fiel =
    adaptada.questoes.length === original.questoes.length &&
    adaptada.questoes.every((questao, indice) => {
      const origem = original.questoes[indice]
      return (
        origem !== undefined &&
        questao.gabarito === origem.gabarito &&
        questao.alternativas.length === origem.alternativas.length &&
        questao.habilidade.codigo === origem.habilidade.codigo &&
        questao.habilidade.descricao === origem.habilidade.descricao &&
        questao.citacao.materialId === origem.citacao.materialId &&
        questao.citacao.pagina === origem.citacao.pagina &&
        questao.citacao.trecho === origem.citacao.trecho
      )
    }) &&
    adaptada.adaptacao !== undefined &&
    mesmosTipos(adaptada.adaptacao.tipos, pedida.tipos) &&
    adaptada.adaptacao.tempoExtraPercentual === pedida.tempoExtraPercentual
  if (!fiel) throw new LLMError('IA_SAIDA_INVALIDA')
}
