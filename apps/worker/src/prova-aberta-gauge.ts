import { estaAbertaAlemDoFimEfetivo, METRICS, PRAZO_DO_ALERTA_DA_PROVA_ABERTA_MS, ProvasVencidasRepository, requireEscolaId, runInContext, type Database, type LoggerBase, type Meter, type Clock, type CronEscolasRepository } from '@educa/core'
import { randomUUID } from 'node:crypto'
import { EscolaGauge } from './escola-gauge.js'
import { PROVAS_POR_JOB } from './processors/encerrar-provas-vencidas.js'

export interface ProvaAbertaGaugeDependencies {
  escolas: Pick<CronEscolasRepository, 'listIds'>
  banco: Database
  relogio: Clock
  logger: LoggerBase
  medidor: Meter
}

/**
 * `prova.aberta_alem_do_fim` por escola (avaliacao-e-correcao, 6.0; Tech Spec §7c, "Alerta"): quantas provas abertas do ano em curso da escola passaram do **fim efetivo** (o `fecha_em` com as extensões da turma e o limite de
 * cada aluno em andamento, com as quedas) há 5 min ou mais. É a rotina que deveria tê-las encerrado no minuto: o alerta "Prova vencida ainda aberta" dispara acima de 0, e a prova do aluno estendido não conta
 * enquanto o limite dele não chega. A escola sem prova nessa situação não tem série. A série traz a escola e um número: nenhum id de prova, turma nem aluno.
 *
 * O laço, a lista de escolas, o contexto de cada uma e a exportação são da `EscolaGauge`; aqui está só o que se mede numa escola, com o ano em curso dela no contexto.
 */
export class ProvaAbertaGauge extends EscolaGauge {
  constructor(
    private readonly dependencias: ProvaAbertaGaugeDependencies,
    opcoes: { intervaloMs?: number } = {},
  ) {
    super(
      dependencias,
      {
        metrica: METRICS.provasAbertasAlemDoFim,
        descricao: 'Provas abertas além do fim efetivo há 5 min ou mais, por escola',
        evento: 'worker.medicao_da_prova_aberta_indisponivel',
      },
      opcoes,
    )
  }

  protected override async medirEscola(): Promise<number | undefined> {
    const { banco } = this.dependencias
    const anoLetivoId = await new ProvasVencidasRepository(banco).anoEmCursoDaEscola()
    if (anoLetivoId === undefined) return undefined
    return runInContext({ requisicaoId: randomUUID(), escolaId: requireEscolaId(), anoLetivoId }, async () => {
      const candidatas = await new ProvasVencidasRepository(banco).abertasComJanelaVencidaHa(PRAZO_DO_ALERTA_DA_PROVA_ABERTA_MS / 1000, PROVAS_POR_JOB)
      let alemDoFim = 0
      for (const candidata of candidatas) if (await estaAbertaAlemDoFimEfetivo(banco, candidata)) alemDoFim += 1
      return alemDoFim === 0 ? undefined : alemDoFim
    })
  }
}
