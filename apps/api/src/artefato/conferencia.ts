import { diaDeUso, DomainException, LLMError, systemClock } from '@educa/core'
import { ErrorCode, conteudoDeAtividadeSchema, type AdaptacaoAplicada, type Citacao, type ConteudoDeAtividade, type ConteudoDoArtefato, type Habilidade } from '@educa/shared'
import type { TrechoComHabilidades } from '../material/trecho-search.js'
import type { ArtefatoLido, ArtefatoRepository } from './artefato.repository.js'

/**
 * A habilidade que não é da **seção da página citada** sai na gravação (classificacao-bncc, 10.0; Tech Spec, seção 5, "Geração"): a questão fica com `habilidade: null` e o plano perde aquele código. A conferência da
 * saída da tarefa já barrou o código que não veio em trecho nenhum; este é o caso do código que veio, mas de outra seção (o capítulo 3 na questão que cita o capítulo 7). O plano vale a **união das seções que cita**
 * (as citações da lista e as de cada etapa). Devolve o conteúdo e quantas habilidades anulou, para a métrica `ia.habilidade_anulada`.
 */
export function anularHabilidadesForaDaSecao(conteudo: ConteudoDoArtefato, entregues: readonly TrechoComHabilidades[]): { readonly conteudo: ConteudoDoArtefato; readonly anuladas: number } {
  const doTrecho = (citacao: Citacao): readonly Habilidade[] => entregues.find((trecho) => trecho.materialId === citacao.materialId && trecho.pagina === citacao.pagina)?.habilidades ?? []
  if (conteudo.tipo === 'atividade_objetiva') {
    let anuladas = 0
    const questoes = conteudo.questoes.map((questao) => {
      const { habilidade } = questao
      if (habilidade === null || doTrecho(questao.citacao).some((daPagina) => daPagina.codigo === habilidade.codigo)) return questao
      anuladas += 1
      return { ...questao, habilidade: null }
    })
    return { conteudo: { ...conteudo, questoes }, anuladas }
  }
  const dasSecoesCitadas = new Set(citacoesDoConteudo(conteudo).flatMap((citacao) => doTrecho(citacao).map((habilidade) => habilidade.codigo)))
  const habilidades = conteudo.habilidades.filter((habilidade) => dasSecoesCitadas.has(habilidade.codigo))
  return { conteudo: { ...conteudo, habilidades }, anuladas: conteudo.habilidades.length - habilidades.length }
}

/** Toda citação que o conteúdo guarda: a de cada questão, ou a lista do plano e a de cada etapa. */
export function citacoesDoConteudo(conteudo: ConteudoDoArtefato): Citacao[] {
  if (conteudo.tipo === 'atividade_objetiva') return conteudo.questoes.map((questao) => questao.citacao)
  return [...conteudo.citacoes, ...conteudo.etapas.flatMap((etapa) => (etapa.citacao === undefined ? [] : [etapa.citacao]))]
}

/** A mesma habilidade, ou nenhuma nas duas: a questão sem habilidade (classificacao-bncc, 10.0) continua sem ela na versão adaptada. */
const mesmaHabilidade = (a: Habilidade | null, b: Habilidade | null): boolean => (a === null || b === null ? a === b : a.codigo === b.codigo && a.descricao === b.descricao)

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
        mesmaHabilidade(questao.habilidade, origem.habilidade) &&
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

/** A atividade que pode ser adaptada: objetiva, e que não é ela mesma uma versão adaptada. Fora disso, `CONFLITO`. */
export function atividadeOriginal(lido: ArtefatoLido): ConteudoDeAtividade {
  const conteudo = conteudoDeAtividadeSchema.safeParse(lido.conteudo)
  if (lido.tipo !== 'atividade_objetiva' || lido.origemId !== null || !conteudo.success || conteudo.data.adaptacao !== undefined) throw new DomainException(ErrorCode.CONFLITO)
  return conteudo.data
}

/**
 * A atividade só se adapta se o material que ela cita ainda está em uso (RF7, RF11, D5): a adaptação manda o trecho citado ao modelo e grava uma versão nova, com entrega, que cita de novo a página. Licença
 * que não vale hoje, `LICENCA_VENCIDA`; edição substituída, ou cuja linha o expurgo apagou, `EDICAO_SUBSTITUIDA`: a professora gera a atividade de novo, que cita a edição atual. **Só se chama com o artefato já achado no alcance.**
 */
export async function exigirMaterialEmUso(artefatos: ArtefatoRepository, conteudo: ConteudoDeAtividade): Promise<void> {
  const ids = [...new Set(citacoesDoConteudo(conteudo).map((citacao) => citacao.materialId))]
  const fora = await artefatos.materiaisForaDoUso(ids, diaDeUso(systemClock.agora()))
  if (fora.licencaVencida) throw new DomainException(ErrorCode.LICENCA_VENCIDA)
  if (fora.substituido) throw new DomainException(ErrorCode.EDICAO_SUBSTITUIDA)
}
