import { AuditoriaRecorder, AuditoriaRepository, currentContext, DomainException, runInContext, type Database } from '@educa/core'
import { ErrorCode, trocasDaProvisoriaResponseSchema, type TrocasDaProvisoriaResponse } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import type { BilheteDaTroca, DadosDoBilheteDaTroca } from '../../credencial/bilhete-da-troca.js'
import { CredencialMatriculaRepository } from '../../credencial/credencial-matricula.repository.js'
import type { DeviceCookie } from '../../credencial/device-cookie.js'
import type { LoginLockout, Reserva } from '../../credencial/login-lockout.js'
import type { PasswordHasher } from '../../credencial/password-hasher.js'
import type { RequestOrigin, ResultadoDoLogin } from '../../credencial/request-origin.js'
import type { HashBulkhead } from '../../credencial/senha/hash-bulkhead.js'
import { escolaBucket } from '../../credencial/senha/login-buckets.js'
import type { ConclusaoDeLogin } from '../completion/login-completion.js'
import { naEscolaSemUsuario } from '../tenant/escola-sem-usuario.js'
import { chaveDaTentativa } from './matricula.service.js'

const registro = new AuditoriaRecorder()

export interface TrocaDaProvisoriaDependencies {
  readonly banco: Database
  readonly bilhetes: Pick<BilheteDaTroca, 'verificar'>
  /** O hash da senha nova, pela vez no semáforo do argon2 (o mesmo do login). */
  readonly hash: Pick<PasswordHasher, 'gerar'>
  readonly semaforo: Pick<HashBulkhead, 'executar'>
  /** O contador de tentativas da conta do aluno, o mesmo do login. */
  readonly contador: LoginLockout
  readonly dispositivo: DeviceCookie
  readonly conclusao: Pick<ConclusaoDeLogin, 'entrarComoAluno'>
}

type ReservaLiberada = Extract<Reserva, { liberada: true }>

const credencialInvalida = () => new DomainException(ErrorCode.NAO_AUTENTICADO)

/**
 * A troca da senha provisória (`POST /v1/sessao/matricula/trocar-senha` e `GET /v1/sessao/matricula/trocas`; acesso-e-convites, tarefa 10.0, RF13; Tech Spec, seção 5, "Senha
 * provisória"). O aluno chega com o bilhete que o login de matrícula devolveu no `Authorization`, e cria a senha nova antes de qualquer tela.
 *
 * - **A escola e o aluno vêm do bilhete assinado**, nunca do corpo nem da URL, e as duas rotas rodam num contexto que tem só a escola (`naEscolaSemUsuario`): o repository aplica o escopo
 *   (regra 10, item 3). Bilhete que não confere (assinatura, `typ`, `aud`, prazo), aluno que não é desta escola, provisória substituída, vencida ou já usada, aluno só com a conta da escola:
 *   tudo é `NAO_AUTENTICADO`, e nada diz qual parte falhou nem se o aluno existe (regra 20, item 6).
 * - **`trocar-senha` conta no contador de tentativas da conta** (o mesmo do login): a tentativa é contada antes da senha nova ser aceita, e só a troca certa zera. Falha repetida segura a
 *   conta com `CONTA_SEGURADA`. A vez no semáforo do hash vem antes da contagem, como no login: o 503 de quem esperou demais não conta.
 * - **Uma troca só:** o `update` condicionado ao vencimento da provisória do bilhete é a trava. Duas trocas com o mesmo bilhete gravam uma vez e abrem uma sessão; a outra tem zero
 *   linhas. A senha nova, a anulação da provisória e o `senha_provisoria.usada` (autor o aluno) vão na mesma transação; a sessão nasce depois, no caminho de toda entrada de aluno.
 * - **`trocas`** devolve as provisórias geradas antes da que o aluno usou, e só lê.
 *
 * Nada aqui vai a log: nem a senha, nem o bilhete, nem a matrícula.
 */
export class TrocaDaProvisoria {
  constructor(private readonly dependencias: TrocaDaProvisoriaDependencies) {}

  async trocar(bilhete: string, senhaNova: string, origem: RequestOrigin): Promise<ResultadoDoLogin> {
    const { banco, hash, semaforo, contador, conclusao } = this.dependencias
    const dados = await this.#bilhete(bilhete)
    const { escolaId, usuarioId, provisoriaExpiraEm } = dados
    return naEscolaSemUsuario({ escolaId }, async () => {
      const aluno = await new CredencialMatriculaRepository(banco).paraATroca(usuarioId, provisoriaExpiraEm)
      if (aluno === undefined) throw credencialInvalida()
      const { chave, identificador } = chaveDaTentativa(this.dependencias, escolaId, aluno.matricula, origem)
      const vale = aluno.provisoriaVale && !aluno.suspenso
      const tentativa = await semaforo.executar(escolaBucket(escolaId), async (): Promise<{ readonly seguradaPorMs: number } | { readonly reserva: ReservaLiberada; readonly senhaHash: string | undefined }> => {
        const reserva = await contador.reservar(chave)
        if (!reserva.liberada) return { seguradaPorMs: reserva.esperaMs }
        return { reserva, senhaHash: vale ? await hash.gerar(senhaNova) : undefined }
      })
      if ('seguradaPorMs' in tentativa) throw contaSegurada(tentativa.seguradaPorMs)
      if (tentativa.senhaHash === undefined) throw falhou(tentativa.reserva)
      const senhaHash = tentativa.senhaHash

      const requisicaoId = currentContext()?.requisicaoId ?? randomUUID()
      const trocou = await runInContext({ requisicaoId, escolaId, usuarioId }, () =>
        banco.transaction(async (tx) => {
          if (!(await new CredencialMatriculaRepository(tx).trocarProvisoria(usuarioId, provisoriaExpiraEm, senhaHash))) return false
          await registro.gravar(tx, 'senha_provisoria.usada', { entidadeId: usuarioId })
          return true
        }),
      )
      if (!trocou) throw falhou(tentativa.reserva)
      await contador.zerar(chave)
      return conclusao.entrarComoAluno({ usuarioId, escolaId }, identificador, origem)
    })
  }

  async trocas(bilhete: string): Promise<TrocasDaProvisoriaResponse> {
    const { banco } = this.dependencias
    const { escolaId, usuarioId, provisoriaExpiraEm } = await this.#bilhete(bilhete)
    return naEscolaSemUsuario({ escolaId }, async () => {
      const aluno = await new CredencialMatriculaRepository(banco).paraATroca(usuarioId, provisoriaExpiraEm)
      if (aluno === undefined || !aluno.provisoriaVale || aluno.suspenso) throw credencialInvalida()
      const anteriores = await new AuditoriaRepository(banco).provisoriasAnterioresDoAluno(usuarioId)
      return trocasDaProvisoriaResponseSchema.parse({
        anteriores: anteriores.map((anterior) => ({ geradaEm: anterior.geradaEm.toISOString(), papel: anterior.papel, usada: anterior.usada })),
      })
    })
  }

  async #bilhete(bilhete: string): Promise<DadosDoBilheteDaTroca> {
    const dados = await this.dependencias.bilhetes.verificar(bilhete)
    if (dados === undefined) throw credencialInvalida()
    return dados
  }
}

/** A conta está segurada: `CONTA_SEGURADA` com o tempo que falta, como no login. */
function contaSegurada(esperaMs: number): DomainException {
  return new DomainException(ErrorCode.CONTA_SEGURADA, undefined, Math.max(1, Math.ceil(esperaMs / 1_000)))
}

/** A tentativa que não trocou: a credencial inválida, ou `CONTA_SEGURADA` se foi esta falha que segurou a conta. */
function falhou(reserva: ReservaLiberada): DomainException {
  return reserva.esperaSeFalharMs > 0 ? contaSegurada(reserva.esperaSeFalharMs) : credencialInvalida()
}
