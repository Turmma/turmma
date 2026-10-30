import { InvariantException, retencaoDaEscola, type CompartilhamentoRow, type PapelDoTitular } from '@educa/shared'
import type { Banco, TransacaoBanco } from '../db/banco.js'
import { relogioDoSistema, type Relogio } from '../relogio.js'
import { RetencaoDaEscolaRepository } from '../retencao/retencao-da-escola.repository.js'
import { CompartilhamentoRepository, type ChamadaDoRastro } from './compartilhamento.repository.js'
import { SuboperadorDaEscolaRepository, type SuboperadorLidoPelaEscola } from './suboperador-da-escola.repository.js'

/** De quem é a foto: o titular do pedido, que é aluno ou professor da escola do contexto (F3, RF10). */
export interface AlvoDoCompartilhamento {
  readonly titularId: string
  readonly papel: PapelDoTitular
}

/** O período do titular na escola, já com as datas que faltam resolvidas. */
interface PeriodoDoTitular {
  /** O começo: a entrada dele, ou o horizonte do rastro quando não há data de entrada. */
  readonly inicio: Date
  /** O fim: o encerramento do vínculo, ou o fim do dia de uso do `agora`. */
  readonly fim: Date
  /** `false` quando o titular não tem data de entrada: para ele não existe período anterior ao rastro. */
  readonly entradaConhecida: boolean
}

/**
 * A foto do compartilhamento do titular (F3, RF13; Tech Spec do F3, seção 5, "Compartilhamento"; LGPD, art. 18, VII e
 * § 6º): **por quais empresas o dado dele passou**, com o período, sem pessoa. É o que o `POST pedidos` grava no
 * registro e o que o detalhe devolve, e o que a eliminação refaz antes de anonimizar (tarefa 15.0): depois que o
 * expurgo anula `consumo_ia.aluno_id`, a foto salva é o que ainda responde à pergunta. **Aqui é só a regra**: as
 * consultas ficam no `CompartilhamentoRepository`, e todo suboperador sai do `SuboperadorDaEscolaRepository`.
 *
 * Três fontes, sempre na escola do contexto (regra 10: nada de outra escola entra):
 *
 * 1. **Rastro** (`origem: 'rastro'`, só do aluno): as chamadas com envio externo atribuíveis a ele — por
 *    `consumo_ia.aluno_id` ou pela execução que ele pediu (`execucao_agente.solicitada_por`) —, agrupadas por
 *    `provedor` e casadas com o suboperador **vigente na data da chamada**, porque a chave encerrada pode ter sido
 *    cadastrada de novo. O provedor que não casa com nenhum suboperador da escola aparece como "provedor não
 *    cadastrado" (`suboperadorId: null`): é o que a escola diz ao titular quando o rastro aponta uma empresa que ela
 *    não conhece.
 * 2. **Reserva** (`origem: 'periodo'`, o rótulo "a escola usava X enquanto você estava nela"): os suboperadores da
 *    escola vigentes no período do titular. Entra quando o rastro não responde pelas chamadas — as linhas sem
 *    `provedor`, antigas —, quando o período começa antes do horizonte do rastro (o expurgo já anulou quem era o
 *    aluno: "rastro expirado") — e **sempre para o professor**, cuja foto não pode separar quem usou a IA de quem não
 *    usou (D64; regra 70, itens 8 e 9).
 * 3. **Hospedagem**: a empresa de `alcance = 'todas'` (a hospedagem, e as que atendem toda escola) **aparece
 *    sempre**, porque o dado do titular vive com ela desde que ele entrou.
 *
 * **O período é o do titular na escola, nunca o da empresa** (triagem de 09/10/2026): no aluno, a mais antiga entre
 * `credencial_matricula.criada_em` e `conta_externa.ligada_em`; no professor, o vínculo. As datas da reserva são a
 * **interseção** da vigência do suboperador com esse período, e a interseção vazia não entra na foto: o `inicio` e o
 * `fim` que o repositório devolve nunca vão direto para a foto, e nenhuma data é anterior à entrada do titular. O
 * titular sem nenhuma das datas de entrada não tem período anterior ao rastro: o período dele começa no horizonte, e
 * a reserva só entra pelas linhas antigas.
 *
 * O relógio é injetado (o job da eliminação roda com o dele), e o horizonte do rastro é o prazo de
 * `consumo_por_aluno`, a categoria que o mapa de `docs/lgpd.md` liga à lista de compartilhamento.
 */
export class Compartilhamento {
  constructor(
    private readonly banco: Banco | TransacaoBanco,
    private readonly relogio: Relogio = relogioDoSistema,
  ) {}

  /** A foto do titular, sem ordem garantida, no formato que o `compartilhamentoSchema` do contrato aceita. */
  async doTitular(alvo: AlvoDoCompartilhamento): Promise<CompartilhamentoRow[]> {
    const leituras = new CompartilhamentoRepository(this.banco)
    const agora = this.relogio.agora()
    const ajustes = await new RetencaoDaEscolaRepository(this.banco).ajustes()
    const retencao = retencaoDaEscola(ajustes).find((candidata) => candidata.categoria === 'consumo_por_aluno')
    if (retencao === undefined) throw new InvariantException('prazo de consumo_por_aluno ausente do catálogo de retenção')
    const { horizonte, fimDoDia } = await leituras.datasDeReferencia(agora, retencao.meses)
    const periodo = await this.#periodoDoTitular(leituras, alvo, horizonte, fimDoDia)
    const suboperadores = await new SuboperadorDaEscolaRepository(this.banco).daEscola()
    const rastro: ChamadaDoRastro[] = alvo.papel === 'aluno' ? await leituras.rastroDoAluno(alvo.titularId) : []

    // O gatilho da reserva: o rastro não responde por estas chamadas, e a resposta honesta é o período.
    const reserva =
      alvo.papel === 'professor' ||
      rastro.some((chamada) => chamada.provedor === null) ||
      (periodo.entradaConhecida && periodo.inicio.getTime() < horizonte.getTime())

    const linhas: CompartilhamentoRow[] = this.#linhasDoRastro(rastro, suboperadores, periodo)
    for (const suboperador of suboperadores) {
      const intersecao = this.#intersecao(suboperador, periodo)
      if (intersecao === undefined) continue
      // A hospedagem (`todas`) aparece sempre; as demais empresas só com a reserva, que diz "a escola usava X
      // enquanto você estava nela".
      if (suboperador.alcance !== 'todas' && !reserva) continue
      linhas.push({ suboperadorId: suboperador.id, chave: suboperador.chave, primeiroEm: intersecao.primeiroEm.toISOString(), ultimoEm: intersecao.ultimoEm.toISOString(), origem: 'periodo' })
    }
    return linhas
  }

  /**
   * O período do titular na escola. Aluno: a mais antiga entre a credencial de matrícula e a conta externa ligada (a
   * aprovação da reivindicação cria a credencial; `usuario` não tem data de criação), e ele segue até o fim do dia.
   * Professor: o vínculo, do `criado_em` mais antigo ao `encerrado_em` mais recente; com algum aberto, até o fim do
   * dia. Sem data de entrada, o período começa no horizonte do rastro.
   */
  async #periodoDoTitular(leituras: CompartilhamentoRepository, alvo: AlvoDoCompartilhamento, horizonte: Date, fimDoDia: Date): Promise<PeriodoDoTitular> {
    const entrada = alvo.papel === 'aluno' ? await leituras.entradaDoAluno(alvo.titularId) : await leituras.entradaDoProfessor(alvo.titularId)
    if (alvo.papel === 'aluno') return { inicio: entrada ?? horizonte, fim: fimDoDia, entradaConhecida: entrada !== null }
    const { encerrado, abertos } = await leituras.vinculosDoProfessor(alvo.titularId)
    return {
      inicio: entrada ?? horizonte,
      fim: abertos > 0 || encerrado === null ? fimDoDia : encerrado,
      entradaConhecida: entrada !== null,
    }
  }

  /** As linhas do rastro: uma por `provedor` e por suboperador vigente na data da chamada. */
  #linhasDoRastro(rastro: readonly ChamadaDoRastro[], suboperadores: readonly SuboperadorLidoPelaEscola[], periodo: PeriodoDoTitular): CompartilhamentoRow[] {
    const grupos = new Map<string, { suboperadorId: string | null; chave: string; primeiroEm: Date; ultimoEm: Date }>()
    for (const chamada of rastro) {
      if (chamada.provedor === null) continue
      // O casamento é na data da chamada: a chave encerrada pode ter sido cadastrada de novo, e a empresa de hoje não
      // era a de ontem.
      const casa = suboperadores.find((suboperador) => suboperador.chave === chamada.provedor && this.#vigenteEm(suboperador, chamada.em))
      const chave = `${chamada.provedor}/${casa?.id ?? ''}`
      const grupo = grupos.get(chave)
      if (grupo === undefined) {
        grupos.set(chave, { suboperadorId: casa?.id ?? null, chave: chamada.provedor, primeiroEm: chamada.em, ultimoEm: chamada.em })
        continue
      }
      grupo.primeiroEm = maisCedo(grupo.primeiroEm, chamada.em)
      grupo.ultimoEm = maisTarde(grupo.ultimoEm, chamada.em)
    }
    const linhas: CompartilhamentoRow[] = []
    for (const grupo of grupos.values()) {
      // Nenhuma data da foto é anterior à entrada do titular.
      const primeiroEm = maisTarde(grupo.primeiroEm, periodo.inicio)
      const ultimoEm = maisCedo(grupo.ultimoEm, periodo.fim)
      if (primeiroEm.getTime() > ultimoEm.getTime()) continue
      linhas.push({ suboperadorId: grupo.suboperadorId, chave: grupo.chave, primeiroEm: primeiroEm.toISOString(), ultimoEm: ultimoEm.toISOString(), origem: 'rastro' })
    }
    return linhas
  }

  /**
   * A interseção da vigência do suboperador para a escola com o período do titular. Vazia não entra na foto: a empresa
   * encerrada antes de o titular entrar nunca recebeu dado dele. `fim` é exclusivo, como na correção da 8.0 (o igual
   * também fica fora: não houve um instante em comum).
   */
  #intersecao(suboperador: SuboperadorLidoPelaEscola, periodo: PeriodoDoTitular): { primeiroEm: Date; ultimoEm: Date } | undefined {
    const primeiroEm = maisTarde(suboperador.inicio, periodo.inicio)
    const ultimoEm = maisCedo(suboperador.fim ?? periodo.fim, periodo.fim)
    return primeiroEm.getTime() >= ultimoEm.getTime() ? undefined : { primeiroEm, ultimoEm }
  }

  /** `true` quando a vigência do suboperador para a escola cobre o instante da chamada (o `fim` é exclusivo). */
  #vigenteEm(suboperador: SuboperadorLidoPelaEscola, em: Date): boolean {
    return suboperador.inicio.getTime() <= em.getTime() && (suboperador.fim === null || em.getTime() < suboperador.fim.getTime())
  }
}

const maisCedo = (a: Date, b: Date): Date => (a.getTime() <= b.getTime() ? a : b)
const maisTarde = (a: Date, b: Date): Date => (a.getTime() >= b.getTime() ? a : b)
