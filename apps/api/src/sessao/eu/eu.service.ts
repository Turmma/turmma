import { DomainException, inatividadeDoPapel, METRICS, type Meter } from '@educa/nucleo'
import { ErrorCode, euResponseSchema, introducaoResponseSchema, type EuResponse, type IntroducaoResponse } from '@educa/shared'
import type { EuRepository, LinhaDoEu } from './eu.repository.js'
import type { ResolucaoDeTenantRepository } from '../tenant/resolucao-de-tenant.repository.js'

/**
 * Quem está na sessão, no contrato de `GET /v1/eu`: a inatividade é a do papel na escola da sessão, e `acessos`, os
 * usuários ativos de equipe da conta dela (12.0), com o nome da escola, o da rede e o papel, para o seletor. A conta vem do
 * usuário da sessão, nunca do cliente; o aluno não tem conta, e os acessos dele vêm vazios.
 *
 * **A introdução vista.** A data é a mais antiga entre a da própria linha e a dos outros usuários ativos da conta com o
 * mesmo papel (o aluno só tem a dele). Quando ela vem de outra escola e a linha da sessão ainda está nula, o `GET` grava
 * nessa linha o `now()` da própria escrita, e nunca o valor de lá: assim, quando o vínculo da outra escola terminar, a
 * introdução não reabre aqui. Se essa gravação falhar, o `GET` devolve a data lida, sem gravar, e a falha é contada.
 */
export class EuService {
  readonly #naoGravadas: ReturnType<Meter['createCounter']>

  constructor(
    private readonly eu: EuRepository,
    private readonly resolucao: ResolucaoDeTenantRepository,
    medidor: Meter,
  ) {
    this.#naoGravadas = medidor.createCounter(METRICS.introducaoFalha, { description: 'Gravações da linha da sessão, disparadas por data de outra escola da mesma conta, que falharam (grava now(), nunca a data emprestada)' })
    this.#naoGravadas.add(0)
  }

  async obter(): Promise<EuResponse> {
    const linha = await this.eu.doContexto()
    // A guarda acabou de ler este usuário ativo; sumir entre as duas leituras é o mesmo que não estar autenticado.
    if (linha === undefined) throw new DomainException(ErrorCode.NAO_AUTENTICADO)
    const acessos = linha.contaId === null ? [] : await this.resolucao.acessosDaConta(linha.contaId)
    const emprestada = await this.#emprestada(linha)
    let propria = linha.introducaoVistaEm
    if (propria === null && emprestada !== null) propria = await this.#gravarSemEmprestar()
    return euResponseSchema.parse({
      usuarioId: linha.usuarioId,
      papel: linha.papel,
      nome: linha.nome,
      escola: linha.escola,
      inatividadeMin: inatividadeDoPapel(linha),
      introducaoVistaEm: maisAntiga(propria, emprestada)?.toISOString() ?? null,
      acessos: acessos.map(({ usuarioId, escolaNome, redeNome, papel }) => ({ usuarioId, escolaNome, redeNome, papel })),
    })
  }

  /** `POST /v1/eu/introducao`: grava a primeira vez e responde a mesma data que o `GET` devolveria. */
  async concluirIntroducao(): Promise<IntroducaoResponse> {
    const linha = await this.eu.doContexto()
    if (linha === undefined) throw new DomainException(ErrorCode.NAO_AUTENTICADO)
    const gravada = await this.eu.marcarIntroducaoVista()
    if (gravada === undefined) throw new DomainException(ErrorCode.NAO_AUTENTICADO)
    const vista = maisAntiga(gravada, await this.#emprestada(linha)) ?? gravada
    return introducaoResponseSchema.parse({ introducaoVistaEm: vista.toISOString() })
  }

  /** A data de outra escola da conta, com o mesmo papel; o aluno não tem conta e não empresta. */
  async #emprestada(linha: LinhaDoEu): Promise<Date | null> {
    return linha.contaId === null ? null : this.resolucao.introducaoMaisAntigaDaConta(linha.contaId, linha.papel)
  }

  /** O mesmo método do `POST`: sem data na entrada, só `now()` na linha da sessão. A falha não derruba o `GET`. */
  async #gravarSemEmprestar(): Promise<Date | null> {
    try {
      return (await this.eu.marcarIntroducaoVista()) ?? null
    } catch {
      this.#naoGravadas.add(1)
      return null
    }
  }
}

const maisAntiga = (a: Date | null, b: Date | null): Date | null => {
  if (a === null) return b
  if (b === null) return a
  return a.getTime() <= b.getTime() ? a : b
}
