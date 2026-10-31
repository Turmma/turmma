import {
  DURACAO_DA_SESSAO_HORAS,
  TokenIssuer,
  DomainException,
  postgresErrorIn,
  runInContext,
  TAMANHO_MINIMO_CHAVE_ASSINATURA,
  validateEnvironment,
  type Database,
  type Clock,
} from '@educa/core'
import { ErrorCode, InvariantException, type PapelDeUsuario } from '@educa/shared'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { CredencialMatriculaRepository } from '../../credencial/credencial-matricula.repository.js'
import { CriacaoDeSessaoRepository } from '../../credencial/sessao-create.repository.js'
import { ResolucaoDeTenantRepository } from './tenant-resolution.repository.js'

/** Sessões de uma vez, no máximo: o cenário de carga pede cerca de mil de uma escola. */
export const QUANTIDADE_MAXIMA_DE_SESSOES_SINTETICAS = 5_000

/** Nome fixo de toda pessoa sintética: nenhum nome real, nem parecido com um, entra pelo comando. */
export const NOME_SINTETICO = 'Pessoa sintética'

export const MOTIVO_SESSAO_SINTETICA_FORA_DO_LOCAL = 'ops:sessao-sintetica só roda com AMBIENTE=local: sessão de teste não existe em staging nem em produção'

const esquemaAmbiente = z
  .object({
    // Opcional só para a ausência cair na mesma recusa, com o motivo: nada além de `local` passa.
    AMBIENTE: z.string().optional(),
    IDENTIDADE_CHAVE_ASSINATURA: z.string().min(TAMANHO_MINIMO_CHAVE_ASSINATURA),
  })
  .superRefine((valores, contexto) => {
    if (valores.AMBIENTE !== 'local') contexto.addIssue({ code: 'custom', path: ['AMBIENTE'], message: MOTIVO_SESSAO_SINTETICA_FORA_DO_LOCAL })
  })

export interface PedidoDeSessoesSinteticas {
  readonly escolaId: string
  readonly papel: PapelDeUsuario
  readonly quantidade: number
}

export interface SessaoSintetica {
  readonly usuarioId: string
  readonly sessaoId: string
  readonly token: string
}

/**
 * O emissor da chave do ambiente, só com `AMBIENTE=local`. Com `AMBIENTE` ausente ou diferente, recusa com
 * `InvalidConfigError` antes de qualquer banco: a sessão sintética não vira porta em staging nem em produção.
 *
 * O `relogio` só é usado por teste que precisa de um token já vencido de uma sessão que existe; sem ele, vale
 * o relógio do sistema.
 */
export function emissorDeTokenSintetico(ambiente: Record<string, string | undefined>, relogio?: Clock): TokenIssuer {
  const { IDENTIDADE_CHAVE_ASSINATURA: chave } = validateEnvironment(esquemaAmbiente, ambiente)
  const codificada = new TextEncoder().encode(chave)
  return relogio === undefined ? new TokenIssuer(codificada) : new TokenIssuer(codificada, relogio)
}

/** Hash de um refresh sorteado que ninguém guarda: a sessão sintética não se renova. */
function refreshHashDescartavel(): string {
  return createHash('sha256').update(randomBytes(32)).digest('hex')
}

/**
 * Cria, na escola pedida, `quantidade` usuários sintéticos com o papel pedido e uma sessão para cada, e emite o
 * token de cada sessão pelo `TokenIssuer`. É o que `ops:sessao-sintetica` e os testes usam para montar a sessão
 * real que a `SessaoGuard` lê.
 *
 * - Só com `AMBIENTE=local` (ver `emissorDeTokenSintetico`).
 * - Tudo numa transação, no contexto da escola pedida: usuário e sessão são gravados nela, nunca em outra.
 * - Professor e coordenador precisam de conta (a equipe entra por e-mail): cada um ganha uma conta com e-mail
 *   sintético no domínio reservado `.invalid`, que não recebe mensagem. Aluno não tem conta.
 * - Escola inexistente sai como `NAO_ENCONTRADO`, sem o id na mensagem.
 */
export async function criarSessoesSinteticas(
  banco: Database,
  ambiente: Record<string, string | undefined>,
  pedido: PedidoDeSessoesSinteticas,
): Promise<SessaoSintetica[]> {
  const emissor = emissorDeTokenSintetico(ambiente)
  if (!Number.isInteger(pedido.quantidade) || pedido.quantidade < 1 || pedido.quantidade > QUANTIDADE_MAXIMA_DE_SESSOES_SINTETICAS) {
    throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
  }
  let criadas: Array<{ usuarioId: string; sessaoId: string }>
  try {
    criadas = await runInContext({ requisicaoId: randomUUID(), escolaId: pedido.escolaId }, () =>
      banco.transaction(async (tx) => {
        const criacao = new CriacaoDeSessaoRepository(tx)
        const contas: Array<string | null> =
          pedido.papel === 'aluno'
            ? Array.from({ length: pedido.quantidade }, () => null)
            : await new ResolucaoDeTenantRepository(tx).criarContas(Array.from({ length: pedido.quantidade }, () => `sintetico-${randomUUID()}@educa.invalid`))
        const usuarios = await criacao.criarUsuarios(contas.map((contaId) => ({ contaId, papel: pedido.papel, nome: NOME_SINTETICO })))
        const sessoes = await criacao.criarSessoes(
          usuarios.map(({ id: usuarioId, contaId }) => ({
            usuarioId,
            contaId,
            metodo: pedido.papel === 'aluno' ? 'matricula' : 'email',
            refreshHash: refreshHashDescartavel(),
            duracaoHoras: DURACAO_DA_SESSAO_HORAS,
          })),
        )
        return sessoes.map(({ id: sessaoId, usuarioId }) => ({ usuarioId, sessaoId }))
      }),
    )
  } catch (erro) {
    // foreign_key_violation: a escola informada não existe.
    if (postgresErrorIn(erro)?.code === '23503') throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    throw erro
  }
  return Promise.all(
    criadas.map(async ({ usuarioId, sessaoId }) => ({
      usuarioId,
      sessaoId,
      token: (await emissor.emitir({ escolaId: pedido.escolaId, usuarioId, sessaoId })).token,
    })),
  )
}

/** Um aluno sintético com credencial: a matrícula e o hash da senha, já gerado por quem chama. */
export interface AlunoComMatriculaSintetico {
  readonly matricula: string
  readonly senhaHash: string
}

/**
 * O seed de alunos que entram por matrícula (tarefa 11.0; Tech Spec, seção 3, "Aluno"): na escola pedida, um usuário
 * aluno sem conta (nome fixo sintético, nunca e-mail) e a `credencial_matricula` dele, numa transação, no contexto da
 * escola. Só com `AMBIENTE=local`, como as sessões sintéticas. Devolve os ids na ordem pedida.
 */
export async function criarAlunosComMatricula(
  banco: Database,
  ambiente: Record<string, string | undefined>,
  escolaId: string,
  alunos: readonly AlunoComMatriculaSintetico[],
): Promise<string[]> {
  validateEnvironment(esquemaAmbiente, ambiente)
  if (alunos.length < 1 || alunos.length > QUANTIDADE_MAXIMA_DE_SESSOES_SINTETICAS) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
  return runInContext({ requisicaoId: randomUUID(), escolaId }, () =>
    banco.transaction(async (tx) => {
      const usuarios = await new CriacaoDeSessaoRepository(tx).criarUsuarios(alunos.map(() => ({ contaId: null, papel: 'aluno' as const, nome: NOME_SINTETICO })))
      const credenciais = alunos.map((aluno, posicao) => {
        const usuario = usuarios[posicao]
        if (usuario === undefined) throw new InvariantException('aluno sintético não criado')
        return { usuarioId: usuario.id, matricula: aluno.matricula, senhaHash: aluno.senhaHash }
      })
      await new CredencialMatriculaRepository(tx).criar(credenciais)
      return credenciais.map((credencial) => credencial.usuarioId)
    }),
  )
}
