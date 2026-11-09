import type { AcessoDaSala, CodigoRateLimit, EntradaDaSalaParaAConta, SalaDoLogin, SalaParaAConta } from '../../sessao/index.js'
import { entradaDaSala } from '../entrada-da-sala.js'

/**
 * A sala que o login pela conta da escola precisa (acesso-e-convites, 14.0; Tech Spec, seção 5, "Conta da escola do aluno"): o
 * `iniciar` com `intencao=reivindicar` chega com o slug e o token do link ou o código, e o acesso vigente é achado aqui, pelo mesmo
 * `AcessoDaSala` da página pública, com o mesmo limite de código errado por escola: o código na URL de um GET anônimo não é um
 * jeito de adivinhar códigos sem a espera que o `salas/abrir` impõe. Devolve só a escola e o acesso; nada de ano, turma ou nome.
 */
export class SalaDoLoginPelaSala implements SalaParaAConta {
  constructor(
    private readonly acessoDaSala: Pick<AcessoDaSala, 'naSala'>,
    private readonly chaveCodigo: Uint8Array,
    private readonly guarda: CodigoRateLimit,
  ) {}

  achar(entrada: EntradaDaSalaParaAConta): Promise<SalaDoLogin> {
    return this.acessoDaSala.naSala(entradaDaSala(entrada, this.chaveCodigo), ({ escolaId, acessoId }) => Promise.resolve({ escolaId, acessoId }), this.guarda)
  }
}
