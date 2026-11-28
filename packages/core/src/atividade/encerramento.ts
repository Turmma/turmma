import { conteudoDeAtividadeSchema, limiteDaTentativa, type ExtensaoDoLimite } from '@educa/shared'
import { AuditoriaRecorder } from '../auditoria/auditoria-recorder.js'
import type { Database, DatabaseTransaction } from '../db/database.js'
import { acertosDoLote, corrigirTentativa, destaquesDaTentativa, type HistoricoAprovado } from './correcao-de-objetiva.js'
import { CorrecaoDeObjetivaRepository, type NovaCorrecao } from './correcao-de-objetiva.repository.js'
import { EncerramentoDaProvaRepository, type AplicacaoDaRotina, type AplicacaoTravada, type AttemptInProgress, type TentativaVencida } from './encerramento.repository.js'
import { pulsoEstaVelho, QuedasDaApiRepository, type LeituraDasQuedas } from './quedas-da-api.repository.js'

const registro = new AuditoriaRecorder()
const MS_POR_MINUTO = 60_000

/** O autor das ações que a rotina do sistema grava, sem pessoa (a auditoria exige o apelido do operador quando o contexto não tem usuário). */
const AUTOR_DA_ROTINA = 'rotina'

/** A função `correcao_de_objetiva` está suspensa na escola do contexto? Quem chama diz como lê; só é perguntada quando o lote ainda pode nascer. */
export type FuncaoSuspensa = () => Promise<boolean>

/**
 * O que a rotina fez com uma aplicação: `encerrada`; `nao_vencida` (o fim efetivo ainda não chegou: a extensão, a queda ou o limite de alguém o empurraram); `pulso_velho` (a API ficou
 * mais de 30 s sem pulsar, e nada encerra durante uma queda); `nao_aplicavel` (já encerrada, não avaliativa ou sem janela).
 */
export type DesfechoDaRotina = 'encerrada' | 'nao_vencida' | 'pulso_velho' | 'nao_aplicavel'

/** Os limites da aplicação lidos numa visão só do banco: o relógio do banco, o pulso, e o que está vencido e quando termina cada tentativa. */
interface LeituraDosLimites {
  readonly agora: Date
  readonly pulsoVelho: boolean
  readonly extensoes: readonly ExtensaoDoLimite[]
  readonly vencidas: TentativaVencida[]
  /** O maior limite entre as tentativas em andamento que têm um; `null` se nenhuma tem. */
  readonly ultimoLimite: Date | null
}

function limitesDasTentativas(tentativas: readonly AttemptInProgress[], extensoes: readonly ExtensaoDoLimite[], leitura: LeituraDasQuedas, agora: Date) {
  const limites = tentativas.map((tentativa) => ({ id: tentativa.id, limite: limiteDaTentativa({ alunoId: tentativa.alunoId, iniciadaEm: tentativa.iniciadaEm, limiteBase: tentativa.limiteBase, extensoes, ...leitura }) }))
  const comLimite = limites.flatMap(({ id, limite }) => (limite === null ? [] : [{ id, limite }]))
  return {
    vencidas: comLimite.filter(({ limite }) => limite.getTime() <= agora.getTime()),
    ultimoLimite: comLimite.reduce<Date | null>((maior, { limite }) => (maior === null || limite.getTime() > maior.getTime() ? limite : maior), null),
  }
}

/**
 * Lê, na transação do `for update`, tudo o que o limite de cada tentativa em andamento pede: as tentativas, as extensões e o pulso com as indisponibilidades **numa consulta só**
 * (uma queda que o pulso grava entre duas leituras seria contada como aberta e como fechada, ou nenhuma das duas). O relógio é o `now()` do banco, o mesmo do PUT.
 */
async function limitesLidos(tx: Database | DatabaseTransaction, aplicacaoId: string, aPartirDe?: Date): Promise<LeituraDosLimites> {
  const encerramentos = new EncerramentoDaProvaRepository(tx)
  const tentativas = await encerramentos.tentativasEmAndamento(aplicacaoId)
  const extensoes = await encerramentos.extensoes(aplicacaoId)
  // Só as indisponibilidades que terminam depois do começo da primeira tentativa (ou de `aPartirDe`, a janela da rotina) tocam a prova: sem nenhuma das duas, nenhuma interessa, e a leitura traz só o pulso.
  const desde = tentativas.reduce<Date | undefined>((menor, tentativa) => (menor === undefined || tentativa.iniciadaEm.getTime() < menor.getTime() ? tentativa.iniciadaEm : menor), aPartirDe)
  const leitura = await new QuedasDaApiRepository(tx).leituraDesde(desde ?? new Date())
  // Sem a linha do pulso não há relógio do banco: o fim do mundo conhecido é o de agora na máquina, e a rotina, que olha `pulsoVelho`, não encerra.
  const agora = leitura.pulso?.agora ?? new Date()
  return { agora, pulsoVelho: pulsoEstaVelho(leitura.pulso), extensoes, ...limitesDasTentativas(tentativas, extensoes, leitura, agora) }
}

/**
 * O encerramento da prova, **o mesmo** para a professora e para a rotina (Tech Spec §5.5): com a aplicação travada, a `aberta` passa a `encerrada` e **grava o fato** (cada tentativa
 * em andamento com o limite vencido recebe `enviada_em` = limite e `envio = 'limite'`; a que ainda tinha tempo fica sem envio e é levada com o salvo), e então corrige.
 *
 * - **Encerrar é idempotente** (regra 80, item 7): quem chega depois da primeira transação encontra o lote vigente e não corrige de novo; só o lote rejeitado deixa corrigir outra vez, num lote novo.
 * - **Função suspensa não corrige** (D60): a atividade encerra, as respostas ficam, e o lote não nasce. Retomada a função, encerrar de novo corrige.
 * - **Quem nunca abriu não tem correção**: faltar não é ficar em branco.
 */
export async function encerrarProva(tx: DatabaseTransaction, aplicacao: AplicacaoTravada, suspensa: FuncaoSuspensa): Promise<void> {
  const encerramentos = new EncerramentoDaProvaRepository(tx)
  if (aplicacao.estado === 'aberta') {
    const { vencidas } = await limitesLidos(tx, aplicacao.id)
    await encerramentos.encerrar(aplicacao.id)
    await encerramentos.registrarVencidas(aplicacao.id, vencidas)
  }
  await corrigirLote(tx, aplicacao, suspensa)
}

/**
 * O fim efetivo da prova (§5.6): o do que vier depois, o `fecha_em` com as extensões da turma e o limite de cada tentativa em andamento (que já leva a extensão do aluno, o tempo adicional e as
 * quedas). Quem ainda pode estar fazendo a prova, ou começar dentro da janela, impede o encerramento.
 */
export function fimEfetivo(fechaEm: Date, extensoes: readonly ExtensaoDoLimite[], ultimoLimite: Date | null): Date {
  const daTurmaEmMs = extensoes.filter((extensao) => extensao.alunoId === null).reduce((soma, extensao) => soma + extensao.minutos * MS_POR_MINUTO, 0)
  return new Date(Math.max(fechaEm.getTime() + daTurmaEmMs, ultimoLimite?.getTime() ?? 0))
}

/**
 * A rotina que encerra a prova vencida (`atividade.encerrar-vencidas`, Tech Spec §5.6): com a aplicação travada (`lockDaRotina`), **confere de novo, na transação, o pulso** (a API parada há mais de
 * 30 s não deixa nada encerrar, porque a queda ainda não foi gravada e o tempo dos alunos ainda vai andar), o fim efetivo, e encerra pelo mesmo caminho da professora. Grava a auditoria
 * `atividade.encerrada_pelo_limite`, **uma por aplicação e sem aluno**: a contagem de tentativas vencidas, nunca quais.
 */
export async function encerrarPeloLimite(tx: DatabaseTransaction, aplicacao: AplicacaoDaRotina, suspensa: FuncaoSuspensa): Promise<DesfechoDaRotina> {
  if (aplicacao.estado !== 'aberta' || !aplicacao.avaliativa || aplicacao.fechaEm === null) return 'nao_aplicavel'
  const { agora, pulsoVelho, extensoes, vencidas, ultimoLimite } = await limitesLidos(tx, aplicacao.id, aplicacao.fechaEm)
  if (pulsoVelho) return 'pulso_velho'
  if (agora.getTime() < fimEfetivo(aplicacao.fechaEm, extensoes, ultimoLimite).getTime()) return 'nao_vencida'
  const encerramentos = new EncerramentoDaProvaRepository(tx)
  await encerramentos.encerrar(aplicacao.id)
  await encerramentos.registrarVencidas(aplicacao.id, vencidas)
  await registro.save(tx, 'atividade.encerrada_pelo_limite', { entidadeId: aplicacao.id, depois: { turmaId: aplicacao.turmaId, vencidas: vencidas.length }, autorOperador: AUTOR_DA_ROTINA })
  await corrigirLote(tx, aplicacao, suspensa)
  return 'encerrada'
}

/**
 * A correção do lote, com a aplicação já travada. Não corrige se a aplicação já tem lote pendente ou aprovado (é o que faz a reexecução não inserir nem alterar correção), se a função está
 * suspensa, ou se ninguém abriu a atividade. **Quem nunca abriu não tem correção**: faltar não é ficar em branco.
 */
async function corrigirLote(tx: DatabaseTransaction, aplicacao: AplicacaoTravada, suspensa: FuncaoSuspensa): Promise<void> {
  const correcoes = new CorrecaoDeObjetivaRepository(tx)
  if (await correcoes.hasLoteVigente(aplicacao.id)) return
  if (await suspensa()) return
  const respostas = await correcoes.respostasPorAluno(aplicacao.id)
  if (respostas.size === 0) return

  const { questoes } = conteudoDeAtividadeSchema.parse(aplicacao.conteudo)
  const historico = new Map<string, HistoricoAprovado>()
  for (const anterior of await correcoes.historicoAprovado([...respostas.keys()], aplicacao.disciplinaId)) {
    const soma = historico.get(anterior.alunoId) ?? { acertos: 0, total: 0 }
    historico.set(anterior.alunoId, { acertos: soma.acertos + anterior.acertos, total: soma.total + anterior.total })
  }
  const lote = acertosDoLote(questoes, [...respostas.values()])
  const novas: NovaCorrecao[] = [...respostas].map(([alunoId, marcadas]) => {
    const correcao = corrigirTentativa(questoes, marcadas)
    return { alunoId, ...correcao, destaques: destaquesDaTentativa({ questoes, respostas: marcadas, correcao, historico: historico.get(alunoId), lote }) }
  })
  await correcoes.createLote(aplicacao, novas)
}

/** Há quanto tempo a prova aberta passou do fim efetivo para o alerta disparar (Tech Spec §7c): a rotina por minuto a teria encerrado, e o professor está com a prova pendurada. */
export const PRAZO_DO_ALERTA_DA_PROVA_ABERTA_MS = 5 * MS_POR_MINUTO

/** A regra do alerta "Prova vencida ainda aberta": o fim efetivo passou há `PRAZO_DO_ALERTA_DA_PROVA_ABERTA_MS` ou mais. O fim é o efetivo, não o `fecha_em`: o aluno estendido não dispara. */
export function provaAbertaAlemDoFim(agora: Date, fim: Date): boolean {
  return agora.getTime() - fim.getTime() >= PRAZO_DO_ALERTA_DA_PROVA_ABERTA_MS
}

/**
 * A medição do alerta: a prova aberta (que a medição já achou com a janela passada há mais de 5 min) está **além do fim efetivo** há 5 min ou mais? Lê o mesmo que a rotina (as tentativas,
 * as extensões e as quedas) e conta com o mesmo limite; só lê, nunca trava nem encerra. A lacuna aberta do pulso já anda o limite de quem estava fazendo a prova: durante uma queda só conta a prova que ninguém mais fazia.
 */
export async function estaAbertaAlemDoFimEfetivo(banco: Database | DatabaseTransaction, aplicacao: { readonly id: string; readonly fechaEm: Date }): Promise<boolean> {
  const { agora, extensoes, ultimoLimite } = await limitesLidos(banco, aplicacao.id, aplicacao.fechaEm)
  return provaAbertaAlemDoFim(agora, fimEfetivo(aplicacao.fechaEm, extensoes, ultimoLimite))
}
