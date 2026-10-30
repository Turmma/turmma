import { DomainException, type Database } from '@educa/nucleo'
import { ErrorCode, type AceitarConviteDeOperadorRequest, type AceitarConviteDeOperadorResponse, type ConsultarConviteDeOperadorResponse } from '@educa/shared'
import { baldeDaEquipe, type HashDeSenha, type SemaforoDeHash } from '../../credencial/index.js'
import type { EmissorDeDesafioDeOperador } from '../desafio-de-operador.js'
import { OperadorRepository } from '../operador/operador.repository.js'
import { hashDoTokenDeConvite } from '../token-do-convite.js'

/** Usado, vencido, revogado, de operador desativado e inexistente: a mesma resposta, que não diz qual (C9; regra 20, item 6). */
const conviteInvalido = () => new DomainException(ErrorCode.NAO_ENCONTRADO)

export interface DependenciasDoConviteDeOperador {
  readonly banco: Database
  readonly hash: Pick<HashDeSenha, 'gerar'>
  /** O semáforo do hash do F1, o mesmo do login: o argon2 do aceite divide o teto de CPU da instância com ele. */
  readonly semaforo: Pick<SemaforoDeHash, 'executar'>
  readonly emissorDeDesafio: Pick<EmissorDeDesafioDeOperador, 'emitir'>
}

/** O que o controller tira da requisição: o IP e se ele passou do limite por IP das rotas de senha. */
export interface OrigemDoAceite {
  readonly ip: string
  readonly acimaDoLimiteDoIp: boolean
}

/**
 * As duas rotas do convite do operador (Tech Spec da A0, seções 4 e 5), sem sessão, com o token sempre no corpo.
 *
 * - **Consultar:** diz só que o convite vale.
 * - **Aceitar:** grava a senha, zera o segundo fator e devolve o desafio `configurar_mfa`, sem sessão e sem cookie: o
 *   aceite não pula o segundo fator. A trava é do banco (`OperadorRepository.aceitarConvite`): dois aceites juntos
 *   gravam uma senha só, e o operador desativado não aceita. Na mesma transação, e só no aceite que venceu, as sessões
 *   abertas da conta são encerradas com o motivo `convite_aceito` (o convite novo é o caminho de recuperar a conta, e
 *   quem estava com a credencial de antes não segue dentro), e a `AuditoriaOperacao` recebe `convite_operador.aceito`,
 *   com o próprio operador de autor e alvo (tarefa 9.0): autor, ação, alvo e data, nunca a senha nem o token.
 * - **Hash:** o argon2 roda no semáforo do F1, no balde da equipe com a vez por IP, antes da transação (ela não segura a
 *   linha do operador durante o hash). Acima do limite por IP (`@DowngradeRateLimit`), o aceite não é recusado: vai para
 *   o fim do balde. O convite que não vale sai antes do hash, sem gastar a vez.
 */
export class ConviteDeOperadorService {
  constructor(private readonly dependencias: DependenciasDoConviteDeOperador) {}

  async consultar(token: string): Promise<ConsultarConviteDeOperadorResponse> {
    const valido = await new OperadorRepository(this.dependencias.banco).conviteValidoPorHash(hashDoTokenDeConvite(token))
    if (valido === undefined) throw conviteInvalido()
    return { valido: true }
  }

  async aceitar(pedido: AceitarConviteDeOperadorRequest, origem: OrigemDoAceite): Promise<AceitarConviteDeOperadorResponse> {
    const { banco, hash, semaforo, emissorDeDesafio } = this.dependencias
    const valido = await new OperadorRepository(banco).conviteValidoPorHash(hashDoTokenDeConvite(pedido.token))
    if (valido === undefined) throw conviteInvalido()
    const senhaHash = await semaforo.executar(baldeDaEquipe(origem.ip, origem.acimaDoLimiteDoIp), () => hash.gerar(pedido.senha))
    const aceito = await banco.transaction(async (tx) => {
      const repositorio = new OperadorRepository(tx)
      const apelido = await repositorio.aceitarConvite({ ...valido, senhaHash })
      if (apelido === undefined) return false
      await repositorio.encerrarSessoes(valido.operadorId, 'convite_aceito')
      await repositorio.auditar({ autor: apelido, acao: 'convite_operador.aceito', operadorAlvoId: valido.operadorId })
      return true
    })
    if (!aceito) throw conviteInvalido()
    return { etapa: 'configurar_mfa', desafio: await emissorDeDesafio.emitir({ operadorId: valido.operadorId, etapa: 'configurar_mfa' }) }
  }
}
