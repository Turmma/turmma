import { DomainException, requireEscolaId, AuditoriaRecorder, requestSessao, type Database } from '@educa/core'
import {
  alcanceDe,
  ErrorCode,
  InvariantException,
  decisaoResponseSchema,
  pedidosDaTurmaResponseSchema,
  type PedidosDaTurmaQuery,
  type DecisaoDePedido,
  type DecisorDaReivindicacao,
  type DecidirReivindicacoesRequest,
  type DecisaoResponse,
  type PedidosDaTurmaResponse,
  type ResultadoDaDecisao,
} from '@educa/shared'
import { paginar } from '../../http/paginacao.js'
import { TurmaRepository } from '../../estrutura/turma/turma.repository.js'
import { VinculoRepository } from '../../estrutura/vinculo/vinculo.repository.js'
import { type ContadorDeTentativas, CredencialMatriculaRepository, CriacaoDeSessaoRepository, identificadorDoAluno } from '../../credencial/index.js'
import { DecisaoRepository, type AlcanceDoPedido } from './decisao.repository.js'

const registro = new AuditoriaRecorder()

/** Quem decidiu, como o pedido e a auditoria o guardam, pelo alcance da célula de quem decide. */
const DECISOR_DO_ALCANCE: Readonly<Record<AlcanceDoPedido, DecisorDaReivindicacao>> = { unidade: 'coordenacao', turma_vinculada: 'professor' }

/**
 * O alcance da sessão na célula `reivindicacao.<acao>` da `MATRIZ`: `unidade` e `nominal_auditado` são a coordenação,
 * que alcança toda turma da escola; `turma_vinculada` é o professor, que precisa do vínculo confirmado. Qualquer outro
 * alcance não chega aqui (a guarda de permissão barra o `nunca`) e, se chegasse, responderia como inexistente.
 */
function alcanceDaSessao(acao: 'ler' | 'decidir'): AlcanceDoPedido {
  const alcance = alcanceDe(requestSessao().papel, 'reivindicacao', acao)
  if (alcance === 'unidade' || alcance === 'nominal_auditado') return 'unidade'
  if (alcance === 'turma_vinculada') return 'turma_vinculada'
  throw new DomainException(ErrorCode.NAO_ENCONTRADO)
}

/** O que a transação de um id decidiu, e a matrícula do aluno aprovado, para zerar o contador de login dela depois do lote. */
type DesfechoDoPedido = { readonly resultado: Exclude<ResultadoDaDecisao, 'decidida'> } | { readonly resultado: 'decidida'; readonly matriculaAprovada?: string }

/**
 * Os pedidos de reivindicação da turma e a decisão sobre eles (A1, tarefa 8.0, RF12, RF13 e RF16; Tech Spec da A1, seções
 * 4, 5 e 7). O professor com vínculo `confirmado` na turma e a coordenação leem os pendentes e decidem os selecionados; só
 * a aprovação de uma pessoa cria o aluno (D4, regra 60, item 7), e nada aqui decide sozinho (regra 70, item 2).
 *
 * Nada disto loga: o nome, a matrícula e o hash nunca vão a log, e a auditoria leva só ids, o estado e quem decidiu.
 */
export class DecisaoService {
  constructor(
    private readonly banco: Database,
    /** O contador de falhas do login por matrícula (F1), que a aprovação zera (E22). */
    private readonly contador: Pick<ContadorDeTentativas, 'chaveDe' | 'zerar'>,
  ) {}

  /**
   * `GET /v1/turmas/:id/reivindicacoes`: uma página dos pedidos pendentes da turma, com o nome, a hora e se houve
   * tentativa com matrícula errada no nome. O professor lê a turma em que tem vínculo `confirmado` (pendente, contestado,
   * encerrado, de outra turma ou escola: o `NAO_ENCONTRADO` da inexistente), sem finalidade e sem registro.
   *
   * A coordenação (`nominal_auditado`) é obrigada a dizer a finalidade, conferida antes de procurar a turma (a falta dela
   * responde igual para qualquer id), e a leitura grava `turma.reivindicacoes_lidas` na mesma transação, a cada leitura:
   * sem registro, sem lista (A2).
   */
  async pedidos(turmaId: string, consulta: PedidosDaTurmaQuery): Promise<PedidosDaTurmaResponse> {
    const nominalAuditado = alcanceDe(requestSessao().papel, 'reivindicacao', 'ler') === 'nominal_auditado'
    const { finalidade } = consulta
    if (nominalAuditado && finalidade === undefined) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
    const alcance = alcanceDaSessao('ler')
    const pagina = await this.banco.transaction(async (tx) => {
      if ((await new TurmaRepository(tx).aberta(turmaId, alcance)) === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const cortada = paginar(await new DecisaoRepository(tx).pendentes(turmaId, consulta), consulta.limite)
      if (nominalAuditado && finalidade !== undefined) {
        await registro.gravar(tx, 'turma.reivindicacoes_lidas', { entidadeId: turmaId, depois: { quantidade: cortada.itens.length }, finalidade })
      }
      return {
        ...cortada,
        itens: cortada.itens.map((pedido) => ({ ...pedido, solicitadaEm: pedido.solicitadaEm.toISOString() })),
      }
    })
    return pedidosDaTurmaResponseSchema.parse(pagina)
  }

  /**
   * `POST /v1/reivindicacoes/decidir`: aprova ou recusa cada id, na ordem do pedido, **uma transação por id**, e diz o que
   * aconteceu com cada um. Sem ano em curso, a rota inteira falha fechada com `NAO_ENCONTRADO`.
   *
   * Um erro no meio do lote (um 5xx) não desfaz os ids já decididos antes dele, e a resposta não diz quais foram: quem
   * chama relê os pedidos da turma depois de um erro (a tela da 16.0).
   *
   * Os contadores de login das matrículas aprovadas são zerados depois do laço, juntos, também quando o lote para no meio:
   * com o Redis do login lento, a espera é a de um comando, e não a de um por aprovação.
   */
  async decidir({ ids, decisao }: DecidirReivindicacoesRequest): Promise<DecisaoResponse> {
    const alcance = alcanceDaSessao('decidir')
    const resultados: Array<{ id: string; resultado: ResultadoDaDecisao }> = []
    const aprovadas: string[] = []
    try {
      for (const lido of ids) {
        const id = lido.toLowerCase()
        const desfecho = await this.#decidirUm(id, decisao, alcance)
        if (desfecho.resultado === 'decidida' && desfecho.matriculaAprovada !== undefined) aprovadas.push(desfecho.matriculaAprovada)
        resultados.push({ id, resultado: desfecho.resultado })
      }
    } finally {
      const escolaId = requireEscolaId()
      await Promise.all(aprovadas.map((matricula) => this.contador.zerar(this.contador.chaveDe(identificadorDoAluno(escolaId, matricula), 'outro'))))
    }
    return decisaoResponseSchema.parse({ resultados })
  }

  /**
   * A decisão de um pedido (Tech Spec da A1, seção 5, passo 6), numa transação:
   *
   * 1. Trava o ano em curso em `FOR SHARE` (10.0): encerrado no meio do lote, o pedido sai `nao_encontrada`, sem gravar.
   *    Trava o pedido se ele está no alcance de quem decide e ainda `pendente` (`travarPendente`). Sem linha, uma leitura
   *    com o mesmo alcance, aplicado antes do estado, separa `ja_decidida` de `nao_encontrada`, sem gravar nada (I6, C3).
   * 2. **Aprovada**: o usuário `aluno` com o nome da lista, a credencial com a matrícula da lista e o hash do pedido, o
   *    vínculo `aluno` `confirmado` com `decidido_em`, e a linha da lista `aprovado`, sem nome nem matrícula (E18).
   *    **Recusada**: a linha da lista volta a `livre` (E25).
   * 3. O pedido fechado, sem hash, chave nem marca de matrícula errada (E21, E30), e `reivindicacao.decidida` com quem
   *    decidiu e como, na mesma transação (A1).
   * 4. Depois do commit, a aprovação devolve a matrícula, e `decidir` zera o contador de falhas do login dela (E22): o aluno
   *    que errou o login antes de ser aprovado entra logo depois. Só a origem `outro`: o `educa_dispositivo` que faria a
   *    tentativa contar como `conhecido` só nasce de um login certo com a matrícula, que não existia antes da aprovação. O
   *    zerar nunca lança; com o Redis fora, o contador vence sozinho em 15 min.
   */
  #decidirUm(id: string, decisao: DecisaoDePedido, alcance: AlcanceDoPedido): Promise<DesfechoDoPedido> {
    return this.banco.transaction(async (tx): Promise<DesfechoDoPedido> => {
      if (!(await new TurmaRepository(tx).travarAnoEmCurso())) return { resultado: 'nao_encontrada' }
      const decisoes = new DecisaoRepository(tx)
      const pedido = await decisoes.travarPendente(id, alcance)
      if (pedido === undefined) return { resultado: (await decisoes.alcancavel(id, alcance)) ? 'ja_decidida' : 'nao_encontrada' }
      let alunoId: string | null = null
      let matriculaAprovada: string | undefined
      if (decisao === 'aprovar') {
        const nome = await decisoes.nomeDoPedido(pedido.listaNomeId)
        if (nome === undefined) throw new InvariantException('nome do pedido pendente não encontrado')
        const [aluno] = await new CriacaoDeSessaoRepository(tx).criarUsuarios([{ contaId: null, papel: 'aluno', nome: nome.nome }])
        if (aluno === undefined) throw new InvariantException('aluno não criado')
        await new CredencialMatriculaRepository(tx).criar([{ usuarioId: aluno.id, matricula: nome.matricula, senhaHash: pedido.senhaHash }])
        await new VinculoRepository(tx).criarAlunoConfirmado(aluno.id, pedido.turmaId)
        await decisoes.aprovarNome(pedido.listaNomeId, aluno.id)
        alunoId = aluno.id
        matriculaAprovada = nome.matricula
      } else {
        await decisoes.devolverNome(pedido.listaNomeId)
      }
      const estado = decisao === 'aprovar' ? 'aprovada' : 'recusada'
      const decididaComo = DECISOR_DO_ALCANCE[alcance]
      await decisoes.fechar(id, estado, decididaComo)
      await registro.gravar(tx, 'reivindicacao.decidida', { entidadeId: id, depois: { turmaId: pedido.turmaId, estado, decididaComo, alunoId } })
      return matriculaAprovada === undefined ? { resultado: 'decidida' } : { resultado: 'decidida', matriculaAprovada }
    })
  }
}
