import { diaDeUso, DomainException, AuditoriaRecorder, systemClock, resumoDoAnalista, type Database, type AnalistaInput, type Clock } from '@educa/core'
import {
  ErrorCode,
  conteudoDoResumoDoAnalistaSchema,
  analistaNominalResponseSchema,
  resumoDoAnalistaResponseSchema,
  GRUPO_MINIMO_DE_PROFESSORES,
  type AnalistaNominalQuery,
  type GerarResumoDoAnalistaRequest,
  type AnalistaNominalResponse,
  type ExecucaoAceitaResponse,
  type ResumoDoAnalistaResponse,
} from '@educa/shared'
import type { LimiteDePedidosDeIa } from '../assistente/ai-request-rate-limit.js'
import type { AgendadorDeExecucoes } from '../ia/execucao.scheduler.js'
import { AnalistaRepository } from './analista.repository.js'

const registro = new AuditoriaRecorder()

/**
 * Abaixo deste acerto a habilidade vira alerta. **Ponto de partida desta fatia, não decisão de produto**: os limiares
 * dos indicadores estão em aberto (`CLAUDE.md`, "Indicadores de desempenho"), e a tarefa recebe o número de quem chama.
 */
export const LIMIAR_DE_ACERTO_BAIXO_PERCENTUAL = 60

/** O que o schema do resumo aceita por lista. O que passa disto fica de fora, na ordem em que veio (série, disciplina, código). */
const MAXIMO_DE_RECORTES = 100
const MAXIMO_DE_HABILIDADES_POR_RECORTE = 60

const chaveDoRecorte = (serieId: string, disciplinaId: string): string => `${serieId}:${disciplinaId}`

/** O acerto em percentual com uma casa, a mesma conta do `valor` do alerta. */
const percentual = (acertos: number, total: number): number => (total === 0 ? 0 : Math.round((acertos * 1000) / total) / 10)

/**
 * O Analista de desempenho escolar (MVP, A5; D34, D45, D46, D57, D64; regra 70, itens 7 a 9).
 *
 * - **Gerar** conta o pedido no limite por pessoa e por escola, e agenda a tarefa `resumo_do_analista`. Os agregados são
 *   montados **no servidor**, no contexto de quem pediu: acerto por habilidade por série e disciplina, **só de lote
 *   aprovado**. O recorte com menos de dois professores não leva número nenhum: vai para `recortesNominais`, só com a
 *   série e a disciplina. A tarefa recebe só agregado, e o que ela devolve é validado pelo schema do contrato antes de
 *   gravar. Função suspensa é recusada pelo agendador, antes de gravar a execução.
 * - **O resumo** lido é o mais recente da escola no ano em curso, validado de novo na leitura.
 * - **O nominal** é o detalhe de uma turma, que identifica os professores dela. A finalidade é obrigatória e conferida
 *   antes de procurar a turma (a consulta é validada no controller). A auditoria `analista.nominal_lido` é gravada **na
 *   mesma transação, a cada leitura, antes de responder**: sem registro, sem resposta. A turma de outra escola ou de
 *   outro ano responde como inexistente, **sem** auditoria. Não traz aluno, `atencao_humana` nem entregas por turma.
 */
export class AnalistaService {
  constructor(
    private readonly banco: Database,
    private readonly agendador: AgendadorDeExecucoes,
    private readonly limite: LimiteDePedidosDeIa,
    private readonly relogio: Clock = systemClock,
  ) {}

  async resumo(): Promise<ResumoDoAnalistaResponse> {
    const ultimo = await new AnalistaRepository(this.banco).ultimoResumo()
    return resumoDoAnalistaResponseSchema.parse({ resumo: ultimo === undefined ? null : { id: ultimo.id, geradoEm: ultimo.geradoEm.toISOString(), conteudo: ultimo.conteudo } })
  }

  async gerar({ chaveEnvio }: GerarResumoDoAnalistaRequest): Promise<ExecucaoAceitaResponse> {
    await this.limite.contar()
    return this.agendador.agendar({
      tarefa: resumoDoAnalista,
      chaveEnvio,
      entradaDaExecucao: { tarefa: 'resumo_do_analista' },
      // Roda depois de a rota responder, no contexto de quem pediu: a escola e o ano letivo são os da sessão.
      entrada: () => this.agregados(),
      aoConcluir: async (saida, tx, execucaoId) => {
        // Validado de novo antes de gravar (regra 30, item 7): o que não cabe no schema estrito não vira resumo.
        const conteudo = conteudoDoResumoDoAnalistaSchema.parse(saida)
        return { tipo: 'resumo_do_analista', resumoId: await new AnalistaRepository(tx).gravarResumo(conteudo, execucaoId) }
      },
    })
  }

  /** Os agregados da escola no ano em curso, na forma que a tarefa recebe. Sem professor, sem turma e sem aluno. */
  async agregados(): Promise<AnalistaInput> {
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

  async nominal({ turmaId, finalidade }: AnalistaNominalQuery): Promise<AnalistaNominalResponse> {
    const id = turmaId.toLowerCase()
    const resposta = await this.banco.transaction(async (tx) => {
      const analista = new AnalistaRepository(tx)
      const turma = await analista.turmaDaEscola(id)
      // A turma de outra escola, de outro ano ou inexistente: a mesma resposta, e nenhuma auditoria.
      if (turma === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const professores = await analista.professoresDaTurma(id)
      const lotesAprovados = await analista.lotesAprovadosDaTurma(id)
      const acertos = lotesAprovados === 0 ? [] : await analista.acertosDaTurma(id)
      const descricoes = lotesAprovados === 0 ? new Map<string, string>() : await analista.descricoesDasHabilidades(id)
      const sinais = await analista.sinaisPorTipo(id)
      const montada = {
        turma: { id: turma.id, nome: turma.nome, serie: { id: turma.serieId, etapa: turma.etapa, ano: turma.ano } },
        professores: professores.map((professor) => ({ id: professor.id, nome: professor.nome, disciplina: { id: professor.disciplinaId, nome: professor.disciplina } })),
        lotesAprovados,
        porHabilidade: acertos
          .filter((linha) => linha.total > 0)
          .slice(0, MAXIMO_DE_HABILIDADES_POR_RECORTE)
          .map((linha) => ({ habilidade: { codigo: linha.codigo, descricao: descricoes.get(linha.codigo) ?? linha.codigo }, acertos: linha.acertos, total: linha.total })),
        sinais: { travou: sinais.get('travou') ?? 0, resposta_pronta: sinais.get('resposta_pronta') ?? 0, duvida_repetida: sinais.get('duvida_repetida') ?? 0 },
      }
      // A cada leitura, na mesma transação, antes de responder (regra 20, item 10; regra 70, item 8).
      await registro.gravar(tx, 'analista.nominal_lido', { entidadeId: turma.id, depois: { professores: new Set(professores.map((professor) => professor.id)).size }, finalidade })
      return montada
    })
    return analistaNominalResponseSchema.parse(resposta)
  }
}
