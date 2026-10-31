import { currentContext, DomainException, runInContext, AuditoriaRecorder, requestSessao, type Database } from '@educa/core'
import { ContaGlobalRepository } from '@educa/core/conta-global'
import { ErrorCode, FINALIDADE_DA_REDEFINICAO_PELO_OPERADOR, type FinalidadeDaRedefinicaoDeMfa } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { RedefinicaoDeMfaRepository } from './redefinicao-de-mfa.repository.js'
import { ResolucaoDeTenantRepository } from '../tenant/tenant-resolution.repository.js'
import type { ConferenciaDoAutor } from '../author-check.js'

const registro = new AuditoriaRecorder()

/**
 * A redefinição do segundo fator de quem perdeu o app autenticador e os códigos (RF19; Tech Spec, seção 5, "TOTP").
 *
 * **Pela coordenação** (`POST /v1/usuarios/:id/mfa/redefinir`): numa transação, com a conta travada, e sempre com a
 * mesma resposta (202) para quem chama, tenha agido ou não:
 * - o alvo é procurado só na escola da sessão, ativo e diferente de quem pede. Id de outra escola, de ninguém, de
 *   aluno (sem conta) ou o próprio: nada muda e nada é gravado;
 * - a conta é global. Se ela também tem usuário ativo em outra escola, nada muda: apagar o segundo fator dela a partir
 *   de A mexeria no acesso dela em B. Grava-se a recusa na auditoria de A, sem dizer qual escola, e a escola recorre ao
 *   operador;
 * - todos os usuários ativos da conta são desta escola: apaga segredo, ativação, último passo e códigos de
 *   recuperação, encerra as sessões abertas da conta (motivo `mfa_redefinido`, 17.4) e grava `usuario.mfa_redefinido`
 *   com a finalidade. A redefinição existe para "perdi o celular" e "suspeita de acesso indevido": a sessão aberta no
 *   aparelho perdido, ou por quem invadiu, cai na requisição seguinte. No login seguinte, a pessoa configura o MFA de
 *   novo. A resposta e a auditoria não dizem quantas sessões caíram, que podiam ser também de outra escola.
 */
export class RedefinicaoDeMfa {
  constructor(private readonly banco: Database) {}

  async pelaCoordenacao(alvoId: string, finalidade: FinalidadeDaRedefinicaoDeMfa): Promise<void> {
    const { escolaId, usuarioId } = requestSessao()
    if (alvoId === usuarioId) return
    await this.banco.transaction(async (tx) => {
      const contaId = await new RedefinicaoDeMfaRepository(tx).contaDoUsuarioAtivo(alvoId)
      if (contaId === undefined) return
      const resolucao = new ResolucaoDeTenantRepository(tx)
      const conta = await resolucao.travarContaParaRedefinir(contaId)
      if (conta === undefined) return
      if (conta.escolasAtivas.some((outra) => outra !== escolaId)) {
        await registro.gravar(tx, 'usuario.mfa_redefinicao_recusada', { entidadeId: alvoId, finalidade })
        return
      }
      await resolucao.apagarMfa(contaId)
      await new ContaGlobalRepository(tx).encerrarSessoesDaConta(contaId, 'mfa_redefinido')
      await registro.gravar(tx, 'usuario.mfa_redefinido', { entidadeId: alvoId, antes: { mfaAtivo: conta.mfaAtivo }, depois: { mfaAtivo: false }, finalidade })
    })
  }
}

/**
 * **Pelo operador** (`ops:redefinir-mfa`), a pedido formal da escola, quando ninguém mais da coordenação pode fazê-lo,
 * ou quando a conta também está em outra escola. O comando recebe só o id do usuário e o número do pedido.
 *
 * - O autor é conferido como primeira instrução da transação (`ConferenciaDoAutor`), antes de ler o usuário.
 * - A escola vem do usuário, nunca do argumento, e cada registro é gravado no contexto da escola dele, com
 *   `autor_operador` e a finalidade `pedido_formal_da_escola`.
 * - As sessões abertas da conta, em todas as escolas, são encerradas na mesma transação (17.4), como na redefinição
 *   pela coordenação.
 * - A conta é global: o segundo fator dela vale em toda escola em que ela tem usuário ativo. Por isso cada uma dessas
 *   escolas recebe o registro, com o usuário dela como entidade: a coordenação de B também fica sabendo que o MFA do
 *   coordenador dela foi redefinido, sem saber de A.
 * - Usuário inexistente, desativado ou sem conta: `NAO_ENCONTRADO`, sem nada gravado.
 * - Devolve nada: o comando imprime só "ok" ou o código do erro.
 */
export async function redefinirMfaPeloOperador(banco: Database, autor: ConferenciaDoAutor, usuarioId: string, pedido: number): Promise<void> {
  const requisicaoId = currentContext()?.requisicaoId ?? randomUUID()
  await runInContext({ requisicaoId }, () =>
    banco.transaction(async (tx) => {
      const autorOperador = await autor(tx)
      const resolucao = new ResolucaoDeTenantRepository(tx)
      const alvo = await resolucao.escolaDoUsuarioParaOperador(usuarioId)
      if (alvo?.contaId === null || alvo === undefined || !alvo.ativo) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const { contaId } = alvo
      await runInContext({ requisicaoId, escolaId: alvo.escolaId }, async () => {
        const conta = await resolucao.travarContaParaRedefinir(contaId)
        if (conta === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
        await resolucao.apagarMfa(contaId)
        await new ContaGlobalRepository(tx).encerrarSessoesDaConta(contaId, 'mfa_redefinido')
        // Com os agendados para eliminação (14.0): a coordenação de cada escola da conta é avisada, entre em ela ou não.
        const usuarios = await resolucao.usuariosAtivosDaConta(contaId, { comSuspensos: true })
        const porEscola = new Map<string, string>([[alvo.escolaId, usuarioId]])
        for (const ativo of usuarios) if (!porEscola.has(ativo.escolaId)) porEscola.set(ativo.escolaId, ativo.usuarioId)
        for (const [escolaId, entidadeId] of porEscola) {
          await runInContext({ requisicaoId, escolaId }, () =>
            registro.gravar(tx, 'usuario.mfa_redefinido', {
              entidadeId,
              antes: { mfaAtivo: conta.mfaAtivo },
              depois: { mfaAtivo: false, pedidoDoOperador: pedido },
              finalidade: FINALIDADE_DA_REDEFINICAO_PELO_OPERADOR,
              autorOperador,
            }),
          )
        }
      })
    }),
  )
}
