import { DomainException, requestSessao, type Database } from '@educa/nucleo'
import { ErrorCode, type TrocaDeEscolaRequest } from '@educa/shared'
import type { ConclusaoDeLogin } from '../conclusao/conclusao-de-login.js'
import { verificarDesafio, type ConsumoDeDesafio, type EmissorDeDesafio, type SessaoDeOrigemDaTroca } from '../../credencial/desafio.js'
import type { OrigemDaRequisicao, ResultadoDoLogin } from '../../credencial/origem-da-requisicao.js'
import type { ResolucaoDeTenantRepository, UsuarioAtivoDaConta } from '../tenant/resolucao-de-tenant.repository.js'
import { SessaoDeOrigemRepository } from '../../credencial/sessao-de-origem.repository.js'

export interface DependenciasDaTroca {
  readonly banco: Database
  readonly resolucao: ResolucaoDeTenantRepository
  readonly consumo: ConsumoDeDesafio
  readonly conclusao: ConclusaoDeLogin
  readonly emissorDeDesafio: EmissorDeDesafio
  /** Chave de assinatura do desafio, a mesma do token de acesso. */
  readonly chaveAssinatura: Uint8Array
}

/** `usuarioId` de outra conta, desativado, de aluno ou inexistente: a mesma resposta (regra 10, item 6). */
const naoEncontrado = () => new DomainException(ErrorCode.NAO_ENCONTRADO)

/**
 * Quem trabalha em mais de uma escola escolhe e troca (RF14; Tech Spec, seções 4 e 5, "Etapas" e "Troca de escola").
 * As duas entradas recebem só o `usuarioId`; a escola de destino vem do banco, e só depois de o id ser conferido
 * entre os usuários ativos de equipe da conta, a do desafio ou a da sessão, nunca uma conta do cliente.
 *
 * - **`escolher`:** com o desafio da etapa. O `jti` só é consumido quando a etapa conclui (sessão gravada ou o desafio
 *   do segundo fator emitido): o `usuarioId` recusado não gasta o desafio.
 * - **Troca pelo token:** só a sessão de método `email` troca; a de matrícula e a externa recebem 404, como o id de
 *   outra conta. A sessão nova, de família nova, nasce no destino, e a de origem é encerrada na mesma transação, com
 *   motivo `troca_de_escola`.
 * - **Coordenação no destino:** sem o segundo fator cumprido nesta entrada, a resposta é o desafio `mfa` (com o
 *   destino e, na troca, a origem) ou `configurar_mfa`, e nenhuma sessão é gravada nem encerrada. Na troca pelo token,
 *   o segundo fator é pedido sempre: a sessão de origem não diz se ele foi cumprido, e um token de 10 min não vira
 *   uma sessão de 12 h da coordenação sem o código.
 * - **Inatividade:** a da escola e do papel de destino, porque a guarda a lê da sessão nova.
 */
export class TrocaDeEscolaService {
  constructor(private readonly dependencias: DependenciasDaTroca) {}

  async escolher(desafio: string, pedido: TrocaDeEscolaRequest, origem: OrigemDaRequisicao): Promise<ResultadoDoLogin> {
    const { consumo } = this.dependencias
    const verificado = await verificarDesafio(desafio, this.dependencias.chaveAssinatura, ['escolher'])
    await consumo.conferirLivre(verificado)
    const destino = await this.#destinoDaConta(verificado.contaId, pedido.usuarioId)
    await consumo.consumir(verificado)
    return this.#entrar(verificado.contaId, destino, verificado.mfaCumprido, undefined, origem)
  }

  async trocar(pedido: TrocaDeEscolaRequest, origem: OrigemDaRequisicao): Promise<ResultadoDoLogin> {
    const { escolaId, sessaoId } = requestSessao()
    const daOrigem = await new SessaoDeOrigemRepository(this.dependencias.banco).metodoEConta(sessaoId)
    if (daOrigem?.metodo !== 'email' || daOrigem.contaId === null) throw naoEncontrado()
    const destino = await this.#destinoDaConta(daOrigem.contaId, pedido.usuarioId)
    return this.#entrar(daOrigem.contaId, destino, false, { escolaId, sessaoId }, origem)
  }

  /** O usuário ativo de equipe da conta com esse id, ou 404. */
  async #destinoDaConta(contaId: string, usuarioId: string): Promise<UsuarioAtivoDaConta> {
    const ativos = await this.dependencias.resolucao.usuariosAtivosDaConta(contaId)
    const destino = ativos.find((ativo) => ativo.usuarioId === usuarioId.toLowerCase() && ativo.papel !== 'aluno')
    if (destino === undefined) throw naoEncontrado()
    return destino
  }

  async #entrar(
    contaId: string,
    destino: UsuarioAtivoDaConta,
    mfaCumprido: boolean,
    troca: SessaoDeOrigemDaTroca | undefined,
    origem: OrigemDaRequisicao,
  ): Promise<ResultadoDoLogin> {
    const conta = await this.dependencias.resolucao.mfaDaConta(contaId)
    if (conta === undefined) throw new DomainException(ErrorCode.NAO_AUTENTICADO)
    if (destino.papel === 'coordenador' && !mfaCumprido) {
      const { emissorDeDesafio } = this.dependencias
      if (conta.ativadoEm === null) {
        return { resposta: { etapa: 'configurar_mfa', desafio: await emissorDeDesafio.emitir({ contaId, etapa: 'configurar_mfa', mfaCumprido: false }) }, cookies: [] }
      }
      const desafio = await emissorDeDesafio.emitir({ contaId, etapa: 'mfa', mfaCumprido: false, destinoUsuarioId: destino.usuarioId, ...(troca === undefined ? {} : { origem: troca }) })
      return { resposta: { etapa: 'mfa', desafio }, cookies: [] }
    }
    return this.dependencias.conclusao.entrarNoDestino(destino, contaId, conta.email, troca, origem)
  }
}
