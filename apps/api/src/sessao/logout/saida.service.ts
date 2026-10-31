import { requestSessao, type Environment, type Database } from '@educa/core'
import { SESSAO_COOKIE, serializarCookie } from '../../credencial/cookies.js'
import { ipParaRegistro } from '../../credencial/request-origin.js'
import { RegistroDeAcessoRepository } from '../../credencial/registro-de-acesso.repository.js'
import { SessaoWriteRepository } from '../../credencial/sessao-write.repository.js'

/**
 * "Sair" (RF13, RF5): encerra a sessão da requisição com motivo `saida` e grava `saida` no registro de acesso, numa
 * transação. A requisição seguinte com o mesmo token já é recusada pela guarda, e o cookie de renovação não renova
 * mais. Devolve o `Set-Cookie` que apaga o `educa_sessao`; o `educa_dispositivo` fica, porque só dá prioridade no
 * login, nunca acesso.
 */
export class LogoutService {
  constructor(
    private readonly banco: Database,
    private readonly ambiente: Environment,
  ) {}

  async sair(ip: string): Promise<readonly string[]> {
    const { sessaoId, usuarioId } = requestSessao()
    await this.banco.transaction(async (tx) => {
      if (await new SessaoWriteRepository(tx).encerrar(sessaoId, 'saida')) {
        await new RegistroDeAcessoRepository(tx).gravar('saida', usuarioId, ipParaRegistro(ip))
      }
    })
    return [serializarCookie(SESSAO_COOKIE, '', { ambiente: this.ambiente, maxAgeSegundos: 0 })]
  }
}
