import { diaDeUso, DomainException, resumoDoAnalista, systemClock, type AnalistaInput, type Clock, type Database, type DatabaseTransaction } from '@educa/core'
import { ErrorCode, conteudoDoResumoDoAnalistaSchema, GRUPO_MINIMO_DE_PROFESSORES, type ResultadoGravado } from '@educa/shared'
import type { EntradaDaTarefa, ExecucaoCommand, ExecucaoLida, Preparado, SaidaDaTarefa } from '../ia/execucao-command.js'
import { AnalistaRepository } from './analista.repository.js'

/**
 * Abaixo deste acerto a habilidade vira alerta. **Ponto de partida desta fatia, não decisão de produto**: os limiares
 * dos indicadores estão em aberto (`CLAUDE.md`, "Indicadores de desempenho"), e a tarefa recebe o número de quem chama.
 */
export const LIMIAR_DE_ACERTO_BAIXO_PERCENTUAL = 60

/** O que o schema do resumo aceita por lista. O que passa disto fica de fora, na ordem em que veio (série, disciplina, código). */
const MAXIMO_DE_RECORTES = 100
export const MAXIMO_DE_HABILIDADES_POR_RECORTE = 60

const chaveDoRecorte = (serieId: string, disciplinaId: string): string => `${serieId}:${disciplinaId}`

/** O acerto em percentual com uma casa, a mesma conta do `valor` do alerta. */
const percentual = (acertos: number, total: number): number => (total === 0 ? 0 : Math.round((acertos * 1000) / total) / 10)

/**
 * O resumo do Analista de desempenho escolar (MVP, A5; D34, D45, D46, D57, D64): os agregados são montados **no
 * servidor**, no contexto de quem pediu (a escola e o ano letivo são os da sessão), **só de lote aprovado**. O recorte
 * com menos de dois professores não leva número nenhum. A tarefa recebe só agregado, e o que ela devolve é validado pelo
 * schema do contrato antes de gravar.
 */
export class ResumoDoAnalistaCommand implements ExecucaoCommand<EntradaDaTarefa<typeof resumoDoAnalista>, SaidaDaTarefa<typeof resumoDoAnalista>, null> {
  readonly tarefa = resumoDoAnalista
  readonly fila = 'normal' as const

  constructor(
    private readonly banco: Database,
    private readonly relogio: Clock = systemClock,
  ) {}

  async preparar(_execucao: ExecucaoLida): Promise<Preparado<EntradaDaTarefa<typeof resumoDoAnalista>, null>> {
    return { entrada: await this.#agregados(), lido: null }
  }

  async concluir(saida: SaidaDaTarefa<typeof resumoDoAnalista>, _lido: null, tx: DatabaseTransaction, execucaoId: string): Promise<ResultadoGravado> {
    // Validado de novo antes de gravar (regra 30, item 7): o que não cabe no schema estrito não vira resumo.
    const conteudo = conteudoDoResumoDoAnalistaSchema.parse(saida)
    return { tipo: 'resumo_do_analista', resumoId: await new AnalistaRepository(tx).saveResumo(conteudo, execucaoId) }
  }

  /** Os agregados da escola no ano em curso, na forma que a tarefa recebe. Sem professor, sem turma e sem aluno. */
  async #agregados(): Promise<AnalistaInput> {
    const analista = new AnalistaRepository(this.banco)
    const periodoDoAno = await analista.periodoDoAno()
    if (periodoDoAno === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const hoje = diaDeUso(this.relogio.agora())
    // Do começo do ano letivo até hoje (ou até o fim dele, se já passou).
    const fim = hoje < periodoDoAno.inicio ? periodoDoAno.inicio : hoje > periodoDoAno.fim ? periodoDoAno.fim : hoje

    // Uma consulta por vez: o resumo é trabalho de lote e não ocupa o pool do banco com sete conexões de uma escola só.
    const numeros = await analista.numerosDaEscola()
    const trocasComOTutor = await analista.trocasComOTutor()
    const sinais = await analista.sinaisPorTipo()
    const comLotes = await analista.recortesComLotes()
    const acertos = await analista.acertosPorRecorte()
    const descricoes = await analista.descricoesDasHabilidades()

    const { recortes, recortesNominais } = this.#recortes(comLotes, acertos, descricoes)

    return {
      periodo: { inicio: periodoDoAno.inicio, fim },
      escola: {
        ...numeros,
        trocasComOTutor,
        sinais: { travou: sinais.get('travou') ?? 0, resposta_pronta: sinais.get('resposta_pronta') ?? 0, duvida_repetida: sinais.get('duvida_repetida') ?? 0, atencao_humana: sinais.get('atencao_humana') ?? 0 },
      },
      recortes,
      recortesNominais,
      limiarDeAcertoBaixoPercentual: LIMIAR_DE_ACERTO_BAIXO_PERCENTUAL,
    }
  }

  /**
   * Os recortes com número (dois ou mais professores com lote aprovado) e os que vão só nominais, cada lista até o teto do
   * schema. A conta do acerto usa só a linha que tem prova (`total > 0`) do próprio recorte.
   */
  #recortes(comLotes: Awaited<ReturnType<AnalistaRepository['recortesComLotes']>>, acertos: Awaited<ReturnType<AnalistaRepository['acertosPorRecorte']>>, descricoes: Map<string, string>): Pick<AnalistaInput, 'recortes' | 'recortesNominais'> {
    const recortes: AnalistaInput['recortes'] = []
    const recortesNominais: AnalistaInput['recortesNominais'] = []
    for (const recorte of comLotes) {
      const chave = chaveDoRecorte(recorte.serieId, recorte.disciplinaId)
      const identificacao = { serie: { id: recorte.serieId, etapa: recorte.etapa, ano: recorte.ano }, disciplina: { id: recorte.disciplinaId, nome: recorte.disciplina } }
      // Grupo mínimo pelos professores que **decidiram** lote aprovado no recorte, não pelos que têm vínculo nele: com um
      // só, o número do recorte é o resultado dele (D45), e quem não aplicou nada ficaria exposto como quem não usa (D64).
      const quantos = recorte.professores
      if (quantos < GRUPO_MINIMO_DE_PROFESSORES) {
        if (recortesNominais.length < MAXIMO_DE_RECORTES) recortesNominais.push(identificacao)
        continue
      }
      if (recortes.length >= MAXIMO_DE_RECORTES) continue
      const doRecorte = acertos.filter((linha) => chaveDoRecorte(linha.serieId, linha.disciplinaId) === chave && linha.total > 0)
      const soma = doRecorte.reduce((parcial, linha) => ({ acertos: parcial.acertos + linha.acertos, total: parcial.total + linha.total }), { acertos: 0, total: 0 })
      recortes.push({
        ...identificacao,
        professores: quantos,
        alunos: recorte.alunos,
        lotesAprovados: recorte.lotesAprovados,
        acertoPercentual: percentual(soma.acertos, soma.total),
        porHabilidade: doRecorte.slice(0, MAXIMO_DE_HABILIDADES_POR_RECORTE).map((linha) => ({ habilidade: { codigo: linha.codigo, descricao: descricoes.get(linha.codigo) ?? linha.codigo }, acertos: linha.acertos, total: linha.total })),
      })
    }
    return { recortes, recortesNominais }
  }
}
