import { DomainException, AuditoriaRecorder, type Database } from '@educa/core'
import {
  ErrorCode,
  conteudoDeAtividadeSchema,
  destaquesAbertosSchema,
  loteApresentadoSchema,
  correcaoDoLoteResponseSchema,
  destaqueAbertoResponseSchema,
  loteAprovadoResponseSchema,
  type DestaquesAbertos,
  type LoteApresentado,
  type QuestaoObjetiva,
  type CorrecaoDoLoteResponse,
  type DestaqueAbertoResponse,
  type LoteAprovadoResponse,
} from '@educa/shared'
import type { RespostasDaTentativa } from './correcao-de-objetiva.js'
import { CorrecaoRepository, type CorrecaoLida, type LoteLido, type ValidacaoLida } from './correcao.repository.js'
import type { LeituraDoLote } from './lote-read-marker.js'
import { loteApresentado, marcaDoApresentado } from './lote.js'

const registro = new AuditoriaRecorder()

/** O lote como o servidor o monta, das linhas de `correcao`: as correções, com o nome, e o que a validação guarda. */
interface LoteMontado {
  readonly questoes: readonly QuestaoObjetiva[]
  readonly correcoes: readonly CorrecaoLida[]
  readonly apresentado: LoteApresentado
}

/** A correção de um aluno como a professora da turma a vê (D34): o nome e as contagens. Nenhuma nota (D46). */
const correcaoDoAluno = (lida: CorrecaoLida) => ({ alunoId: lida.alunoId, nome: lida.nome, acertos: lida.acertos, total: lida.total, emBranco: lida.emBranco })

const destaqueParaATela = (lida: CorrecaoLida) => ({ ...correcaoDoAluno(lida), motivos: lida.destaques, abertoEm: lida.destaqueAbertoEm?.toISOString() ?? null })

/** O registro da validação como a tela o recebe: a cópia do que foi apresentado e aberto. Quem confirmou e já foi eliminado sai sem nome. */
function validacaoParaATela(lida: ValidacaoLida): unknown {
  return {
    id: lida.id,
    apresentado: loteApresentadoSchema.parse(lida.apresentado),
    aberto: destaquesAbertosSchema.parse(lida.aberto),
    confirmadaPor: lida.nomeDeQuemConfirmou === null ? null : { id: lida.confirmadaPor, nome: lida.nomeDeQuemConfirmou },
    confirmadaEm: lida.confirmadaEm.toISOString(),
  }
}

/** A entrega do lote, no formato comum das entregas (`entregaSchema`). */
function entregaParaATela(lote: LoteLido): unknown {
  return {
    id: lote.entregaId,
    tipo: 'lote_de_correcao',
    funcao: 'correcao_de_objetiva',
    estado: lote.estado,
    turmaId: lote.turmaId,
    titulo: lote.titulo,
    artefatoId: null,
    atividadeAplicadaId: lote.atividadeAplicadaId,
    criadaEm: lote.criadaEm.toISOString(),
    decididaEm: lote.decididaEm?.toISOString() ?? null,
    decididaPor: lote.decididaPor === null || lote.nomeDeQuemDecidiu === null ? null : { id: lote.decididaPor, nome: lote.nomeDeQuemDecidiu },
    justificativa: lote.justificativa,
  }
}

const respostasCorrigidas = (questoes: readonly QuestaoObjetiva[], respostas: RespostasDaTentativa) =>
  questoes.map((questao, indice) => {
    const alternativa = respostas.get(indice + 1) ?? null
    return { questao: indice + 1, alternativa, gabarito: questao.gabarito, correta: alternativa === questao.gabarito }
  })

/**
 * A correção do lote para a professora, a abertura dos destaques e a aprovação com o registro da validação (MVP, A3;
 * D33, D56; regra 70, itens 1, 3 e 6).
 *
 * - **Só a professora com vínculo confirmado na turma do lote e na disciplina do artefato** lê, abre e aprova. Lote de
 *   outra turma, de outra disciplina, de outra escola e o inexistente respondem o mesmo `NAO_ENCONTRADO`.
 * - **O que a validação guarda é montado no servidor**, das linhas de `correcao`, pela mesma função que monta o que
 *   `GET …/correcao` mostra. O corpo da aprovação é vazio e estrito: nada do cliente entra no registro.
 * - **A aprovação exige a leitura**: a professora precisa ter recebido a correção deste lote, e o que ela recebeu
 *   precisa ser o que o servidor monta agora (`LeituraDoLote`). Sem isso, `CONFLITO`, e nada é gravado.
 * - **A aprovação exige todos os destaques abertos**: sem isso, `DESTAQUES_NAO_ABERTOS`, sem validação gravada e com
 *   a entrega ainda pendente. O gatilho do banco é a segunda barreira.
 * - **Validação e aprovação na mesma transação**, com a entrega travada: dois cliques gravam uma validação, uma
 *   aprovação e uma auditoria; o segundo responde `ENTREGA_JA_DECIDIDA`.
 * - **Só uma pessoa aprova.** O autor é o usuário da sessão; não há job, execução nem rotina que chame `aprovarLote`.
 * - Suspender a função não mexe no lote pendente: ele continua podendo ser aprovado ou rejeitado (contrato, decisão 22).
 */
export class CorrecaoService {
  constructor(
    private readonly banco: Database,
    private readonly leitura: LeituraDoLote,
  ) {}

  async #montar(correcoes: CorrecaoRepository, lote: LoteLido): Promise<LoteMontado> {
    const { questoes } = conteudoDeAtividadeSchema.parse(lote.conteudo)
    const doLote = await correcoes.correcoesDoLote(lote.entregaId)
    const respostas = await correcoes.respostasPorAluno(lote.atividadeAplicadaId)
    return { questoes, correcoes: doLote, apresentado: loteApresentado({ questoes, alunosDaTurma: lote.alunosDaTurma, correcoes: doLote, respostas }) }
  }

  async ler(atividadeAplicadaId: string): Promise<CorrecaoDoLoteResponse> {
    const correcoes = new CorrecaoRepository(this.banco)
    const lote = await correcoes.loteDaAplicacao(atividadeAplicadaId)
    if (lote === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const montado = await this.#montar(correcoes, lote)
    const validacao = await correcoes.validacao(lote.entregaId)
    const destaques = montado.correcoes.filter((correcao) => correcao.destaques.length > 0)
    const destaquesAbertos = destaques.filter((destaque) => destaque.destaqueAbertoEm !== null).length
    const resposta = correcaoDoLoteResponseSchema.parse({
      atividadeAplicadaId: lote.atividadeAplicadaId,
      titulo: lote.titulo,
      entrega: { id: lote.entregaId, estado: lote.estado },
      resumo: montado.apresentado.resumo,
      destaques: destaques.map(destaqueParaATela),
      outras: montado.correcoes.filter((correcao) => correcao.destaques.length === 0).map(correcaoDoAluno),
      destaquesAbertos,
      podeAprovar: lote.estado === 'pendente' && destaquesAbertos === destaques.length,
      validacao: validacao === undefined ? null : validacaoParaATela(validacao),
    })
    // Só o lote pendente tem aprovação pela frente; e só depois de a resposta estar montada e válida a leitura conta.
    if (lote.estado === 'pendente') await this.leitura.registrar(lote.entregaId, marcaDoApresentado(montado.apresentado))
    return resposta
  }

  async abrirDestaque(atividadeAplicadaId: string, alunoId: string): Promise<DestaqueAbertoResponse> {
    const aberto = await this.banco.transaction(async (tx) => {
      const correcoes = new CorrecaoRepository(tx)
      const lote = await correcoes.loteDaAplicacao(atividadeAplicadaId, true)
      if (lote === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      let [destaque] = await correcoes.correcoesDoLote(lote.entregaId, alunoId)
      // O aluno sem correção neste lote e o que não é destaque respondem igual ao inexistente.
      if (destaque === undefined || destaque.destaques.length === 0) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      if (destaque.destaqueAbertoEm === null) {
        // Depois da decisão, nenhuma correção do lote muda: o que não foi aberto antes não se abre mais.
        if (lote.estado !== 'pendente') throw new DomainException(ErrorCode.ENTREGA_JA_DECIDIDA)
        if (await correcoes.abrirDestaque(lote.entregaId, alunoId)) {
          await registro.gravar(tx, 'correcao.destaque_aberto', { entidadeId: lote.entregaId, depois: { atividadeAplicadaId: lote.atividadeAplicadaId, alunoId, motivos: destaque.destaques } })
        }
        ;[destaque] = await correcoes.correcoesDoLote(lote.entregaId, alunoId)
        if (destaque === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      }
      const { questoes } = conteudoDeAtividadeSchema.parse(lote.conteudo)
      const respostas = (await correcoes.respostasPorAluno(lote.atividadeAplicadaId, alunoId)).get(alunoId) ?? new Map<number, number>()
      const historico = await correcoes.historicoAprovado([alunoId], lote.disciplinaId, lote.criadaEm)
      return { destaque, respostas: respostasCorrigidas(questoes, respostas), historico: historico.map(({ titulo, acertos, total }) => ({ titulo, acertos, total })) }
    })
    return destaqueAbertoResponseSchema.parse({ ...aberto, destaque: destaqueParaATela(aberto.destaque) })
  }

  async aprovarLote(entregaId: string): Promise<LoteAprovadoResponse> {
    // Lida antes da transação: a entrega não fica travada à espera do Redis.
    const marcaLida = await this.leitura.marcaLida(entregaId)
    const aprovado = await this.banco.transaction(async (tx) => {
      const correcoes = new CorrecaoRepository(tx)
      const lote = await correcoes.travarLote(entregaId)
      if (lote === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      if (lote.estado !== 'pendente') throw new DomainException(ErrorCode.ENTREGA_JA_DECIDIDA)

      const montado = await this.#montar(correcoes, lote)
      // Validação efetiva (D56): quem aprova leu a correção deste lote, e leu o que vai ficar registrado como apresentado.
      if (marcaLida !== marcaDoApresentado(montado.apresentado)) throw new DomainException(ErrorCode.CONFLITO)

      const destaques = montado.correcoes.filter((correcao) => correcao.destaques.length > 0)
      const aberto: DestaquesAbertos = destaques
        .flatMap((destaque) => (destaque.destaqueAbertoEm === null ? [] : [{ alunoId: destaque.alunoId, abertoEm: destaque.destaqueAbertoEm.toISOString() }]))
        .sort((a, b) => (a.alunoId < b.alunoId ? -1 : a.alunoId > b.alunoId ? 1 : 0))
      if (aberto.length < destaques.length) throw new DomainException(ErrorCode.DESTAQUES_NAO_ABERTOS)

      const validacaoId = await correcoes.gravarValidacao(lote, loteApresentadoSchema.parse(montado.apresentado), destaquesAbertosSchema.parse(aberto))
      if (!(await correcoes.aprovar(entregaId))) throw new DomainException(ErrorCode.ENTREGA_JA_DECIDIDA)
      await registro.gravar(tx, 'lote.aprovado', {
        entidadeId: entregaId,
        antes: { estado: 'pendente' },
        depois: {
          estado: 'aprovada',
          atividadeAplicadaId: lote.atividadeAplicadaId,
          turmaId: lote.turmaId,
          validacaoId,
          corrigidos: montado.correcoes.length,
          destaques: destaques.length,
          destaquesAbertos: aberto.length,
        },
      })
      const [aprovada, validacao] = [await correcoes.lote(entregaId), await correcoes.validacao(entregaId)]
      if (aprovada === undefined || validacao === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      return { aprovada, validacao }
    })
    return loteAprovadoResponseSchema.parse({ entrega: entregaParaATela(aprovado.aprovada), validacao: validacaoParaATela(aprovado.validacao) })
  }
}
