import { DomainException, type Database, type ProvedorExterno } from '@educa/core'
import { ErrorCode, PROVEDORES_DE_CONTA_DA_ESCOLA, type AcessoDaEscolaResponse } from '@educa/shared'
import { AcessoDaEscolaRepository } from '../../credencial/acesso-publico.repository.js'
import { naEscolaSemUsuario } from '../tenant/escola-sem-usuario.js'
import type { TenantResolutionRepository } from '../tenant/tenant-resolution.repository.js'

/**
 * `GET /v1/escolas/:slug/acesso` (tarefa 11.0): o nome da escola do endereço e os provedores de conta que ela liberou.
 * O slug é público (é o endereço), e por isso slug inexistente responde `NAO_ENCONTRADO`; fora do formato também, sem
 * ir ao banco: quem barra é o `ZodValidationPipe` do controller, e o contrato de `ler` exige o `slug` já validado: outro chamador (um job, outro
 * módulo) tem de conferir o formato antes. Nunca devolve domínio nem tenant: só o tipo do provedor
 * (13.0), e só dos provedores que a escola liberou e que a configuração ligou: um botão que não pode funcionar não aparece.
 */
export class AcessoDaEscolaService {
  constructor(
    private readonly banco: Database,
    private readonly resolucao: TenantResolutionRepository,
    private readonly ligados: readonly ProvedorExterno[],
  ) {}

  async ler(slug: string): Promise<AcessoDaEscolaResponse> {
    const escolaId = await this.resolucao.escolaPorSlug(slug)
    if (escolaId === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const lido = await naEscolaSemUsuario({ escolaId }, async () => {
      const repositorio = new AcessoDaEscolaRepository(this.banco)
      return { nome: await repositorio.nome(), liberados: await repositorio.provedoresLiberados() }
    })
    if (lido.nome === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    // Na ordem fixa do contrato, para a resposta não depender da ordem do banco.
    const provedores = PROVEDORES_DE_CONTA_DA_ESCOLA.filter((provedor) => lido.liberados.includes(provedor) && this.ligados.includes(provedor))
    return { nome: lido.nome, provedores }
  }
}
