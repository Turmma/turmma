import { ALTERNATIVAS_POR_QUESTAO, type DiagnosticoGravado, type Habilidade, type LoteApresentado, type MotivoDeDestaque, type QuestaoObjetiva, type ResumoDoLote } from '@educa/shared'
import { createHash } from 'node:crypto'
import type { RespostasDaTentativa } from '@educa/core'

/** Uma linha de `correcao`, com o que o lote soma e mostra. */
export interface CorrecaoDoLote {
  readonly alunoId: string
  readonly acertos: number
  readonly total: number
  readonly emBranco: number
  readonly porHabilidade: DiagnosticoGravado
  readonly destaques: readonly MotivoDeDestaque[]
  readonly destaqueAbertoEm: Date | null
}

export interface DadosDoLote {
  readonly questoes: readonly QuestaoObjetiva[]
  readonly alunosDaTurma: number
  readonly correcoes: readonly CorrecaoDoLote[]
  /** As respostas de cada aluno corrigido, pelo id dele: é de onde sai a contagem por alternativa. */
  readonly respostas: ReadonlyMap<string, RespostasDaTentativa>
  /** O lote é de uma avaliativa, cuja coluna "Saiu da aba" a professora vê: o registro guarda **só que ela foi mostrada**, nunca a contagem por aluno (D56, D70). */
  readonly saidaDaAbaMostrada?: boolean
}

const SEM_RESPOSTAS: RespostasDaTentativa = new Map()

/**
 * A descrição de cada habilidade da atividade, pelo código: o diagnóstico gravado só tem o código. A questão sem habilidade (classificacao-bncc, 10.0) entra com a chave `null`, uma só para todas elas, e
 * nunca se soma à de um código.
 */
export function habilidadesDaAtividade(questoes: readonly QuestaoObjetiva[]): Map<string | null, Habilidade | null> {
  const habilidades = new Map<string | null, Habilidade | null>()
  for (const questao of questoes) {
    const codigo = questao.habilidade?.codigo ?? null
    if (!habilidades.has(codigo)) habilidades.set(codigo, questao.habilidade)
  }
  return habilidades
}

/**
 * O resumo do lote (D33), **só com número somado** e sem pessoa: é o que a professora vê em `GET …/correcao` e o que a
 * validação guarda em `apresentado.resumo` (D56). Os dois saem desta função, das mesmas linhas de `correcao`.
 *
 * `mediaDeAcertos` é a média de **questões acertadas**, com duas casas: não é nota nem percentual convertido (D46). A
 * distribuição tem uma faixa por contagem de acertos, de zero ao total.
 *
 * **As duas contagens não se misturam** (decisão do pacote Z, aluno transferido). `corrigidos` é **quem respondeu**: a
 * correção é do trabalho feito, então quem abriu a atividade nesta turma entra, mesmo que tenha saído dela antes do
 * encerramento; é o denominador de todo número do resumo (média, distribuição, por questão, por habilidade).
 * `alunosDaTurma` é o número atual da turma, pelo vínculo, à parte: não é denominador de nada, e pode ser menor que
 * `corrigidos` depois de uma transferência.
 */
export function resumoDoLote({ questoes, alunosDaTurma, correcoes, respostas }: DadosDoLote): ResumoDoLote {
  const somaDeAcertos = correcoes.reduce((soma, correcao) => soma + correcao.acertos, 0)
  const habilidades = habilidadesDaAtividade(questoes)
  const porHabilidade = new Map<string | null, { acertos: number; total: number }>()
  for (const correcao of correcoes) {
    for (const parte of correcao.porHabilidade) {
      const soma = porHabilidade.get(parte.codigo) ?? { acertos: 0, total: 0 }
      soma.acertos += parte.acertos
      soma.total += parte.total
      porHabilidade.set(parte.codigo, soma)
    }
  }
  return {
    alunosDaTurma,
    corrigidos: correcoes.length,
    questoes: questoes.length,
    mediaDeAcertos: correcoes.length === 0 ? 0 : Math.round((somaDeAcertos / correcoes.length) * 100) / 100,
    distribuicao: Array.from({ length: questoes.length + 1 }, (_, acertos) => ({ de: acertos, ate: acertos, alunos: correcoes.filter((correcao) => correcao.acertos === acertos).length })),
    // Na ordem em que a habilidade aparece na atividade. A que não é da atividade (não acontece: o artefato não muda) fica de fora.
    porHabilidade: [...habilidades.entries()].flatMap(([codigo, habilidade]) => {
      const soma = porHabilidade.get(codigo)
      return soma === undefined ? [] : [{ habilidade, acertos: soma.acertos, total: soma.total }]
    }),
    porQuestao: questoes.map((questao, indice) => {
      const porAlternativa = Array.from({ length: ALTERNATIVAS_POR_QUESTAO }, () => 0)
      let emBranco = 0
      for (const correcao of correcoes) {
        const marcada = (respostas.get(correcao.alunoId) ?? SEM_RESPOSTAS).get(indice + 1)
        if (marcada === undefined) emBranco += 1
        else porAlternativa[marcada] = (porAlternativa[marcada] ?? 0) + 1
      }
      return { numero: indice + 1, habilidade: questao.habilidade, gabarito: questao.gabarito, acertos: porAlternativa[questao.gabarito] ?? 0, porAlternativa, emBranco }
    }),
  }
}

/**
 * O que a validação guarda como **apresentado** (D56): o resumo e os destaques, cada um com o id do aluno e os motivos,
 * em ordem de id, e, no lote da avaliativa, a marca de que a coluna "Saiu da aba" foi mostrada (sem a contagem de ninguém). Sem nome e sem texto. Montado no servidor, das linhas de `correcao`: nada daqui vem do cliente.
 */
export function loteApresentado(dados: DadosDoLote): LoteApresentado {
  return {
    resumo: resumoDoLote(dados),
    destaques: dados.correcoes
      .filter((correcao) => correcao.destaques.length > 0)
      .map((correcao) => ({ alunoId: correcao.alunoId, motivos: [...correcao.destaques] }))
      .sort((a, b) => (a.alunoId < b.alunoId ? -1 : a.alunoId > b.alunoId ? 1 : 0)),
    ...(dados.saidaDaAbaMostrada === true ? { saidaDaAbaMostrada: true as const } : {}),
  }
}

/** A marca do que foi apresentado: muda se qualquer número ou destaque mudar. É o que liga a leitura da professora à aprovação dela. */
export function marcaDoApresentado(apresentado: LoteApresentado): string {
  return createHash('sha256').update(JSON.stringify(apresentado)).digest('hex')
}
