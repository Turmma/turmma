import { CHAVES_DE_CREDENCIAL } from '@educa/nucleo'
import * as shared from '@educa/shared'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/**
 * Nenhuma resposta traz senha, hash, segredo de MFA, identificador externo, refresh ou campo de credencial (RF18;
 * Tech Spec, seção 7). A varredura percorre todo esquema de resposta exportado por `packages/shared` (os
 * `*ResponseSchema`), em qualquer profundidade: contrato que uma tarefa seguinte criar entra sozinho, sem mudar este
 * teste.
 */

/** Nomes que nenhum campo de resposta pode ter, nem como parte do nome (`senhaHash`, `refreshToken`). */
const CHAVES_PROIBIDAS = ['senha', 'hash', 'segredo', 'sujeito', 'refresh'] as const

/** As chaves de credencial que o redact do log remove em qualquer nível (`authorization`, `cookie`, `set-cookie`): também nunca vão num corpo. */
const CHAVES_DE_CREDENCIAL_DO_REDACT: readonly string[] = CHAVES_DE_CREDENCIAL

/**
 * Contratos que só a equipe recebe e que podem levar e-mail. Aluno não tem e-mail (regra 20, item 2): em qualquer
 * outro contrato, `email` é recusado. Vazia no F1 até aqui.
 */
const CONTRATOS_SO_DA_EQUIPE: readonly string[] = []

/**
 * Exceções nominais, declaradas aqui e revistas uma a uma: o contrato e as chaves que ele pode ter. São duas, e pelo
 * mesmo motivo: `/v1/conta/mfa/configurar` (tarefa 6.0 do F1) e `/v1/operacao/sessao/mfa/configurar` (tarefa 7.0 da
 * A0) devolvem o segredo em texto uma vez, com `no-store`, para a pessoa colar no gerenciador de senhas do computador.
 * Os `codigosRecuperacao` não batem em nenhuma chave proibida e por isso não precisam de exceção.
 */
const EXCECOES_NOMINAIS: Readonly<Record<string, readonly string[]>> = {
  configurarMfaResponseSchema: ['segredo'],
  configurarSegundoFatorDeOperadorResponseSchema: ['segredo'],
}

/** Os caminhos de todo campo do esquema, em qualquer profundidade (`itens[].aluno.nome`). */
function camposDoEsquema(esquema: z.ZodType, caminho = '', vistos = new Set<z.ZodType>()): string[] {
  if (vistos.has(esquema)) return []
  vistos.add(esquema)
  const definicao = esquema._zod.def as unknown as Record<string, unknown> & { type: string }
  const filho = (valor: unknown, sufixo = '') => camposDoEsquema(valor as z.ZodType, `${caminho}${sufixo}`, vistos)
  switch (definicao.type) {
    case 'object':
      return Object.entries(definicao['shape'] as Record<string, z.ZodType>).flatMap(([campo, valor]) => {
        const aqui = caminho === '' ? campo : `${caminho}.${campo}`
        return [aqui, ...camposDoEsquema(valor, aqui, vistos)]
      })
    case 'array':
      return filho(definicao['element'], '[]')
    case 'optional':
    case 'nullable':
    case 'default':
    case 'prefault':
    case 'readonly':
    case 'catch':
    case 'nonoptional':
      return filho(definicao['innerType'])
    case 'union':
      return (definicao['options'] as z.ZodType[]).flatMap((opcao) => filho(opcao))
    case 'intersection':
      return [...filho(definicao['left']), ...filho(definicao['right'])]
    case 'record':
      return filho(definicao['valueType'], '{}')
    case 'pipe':
      return [...filho(definicao['in']), ...filho(definicao['out'])]
    case 'tuple':
      return (definicao['items'] as z.ZodType[]).flatMap((item) => filho(item, '[]'))
    case 'lazy':
      return filho((definicao['getter'] as () => z.ZodType)())
    default:
      return []
  }
}

/** Os campos proibidos de um contrato, com o motivo. Vazio quando o contrato está limpo. */
function problemasDoContrato(nome: string, esquema: z.ZodType): string[] {
  const permitidas = EXCECOES_NOMINAIS[nome] ?? []
  const proibidas = [...CHAVES_PROIBIDAS, ...CHAVES_DE_CREDENCIAL_DO_REDACT, ...(CONTRATOS_SO_DA_EQUIPE.includes(nome) ? [] : ['email'])]
  return camposDoEsquema(esquema).flatMap((caminho) => {
    const campo = (caminho.split('.').at(-1) ?? caminho).replace(/(\[\]|\{\})+$/, '').toLowerCase()
    if (permitidas.some((permitida) => permitida.toLowerCase() === campo)) return []
    return proibidas.filter((proibida) => campo.includes(proibida)).map((proibida) => `${nome}: ${caminho} (${proibida})`)
  })
}

const esquemasDeResposta: Array<[string, z.ZodType]> = Object.entries(shared as Record<string, unknown>).flatMap(([nome, valor]) =>
  nome.endsWith('ResponseSchema') && valor instanceof z.ZodType ? [[nome, valor] as [string, z.ZodType]] : [],
)

describe('contratos de saída: nenhuma resposta traz credencial, segredo ou identificador externo', () => {
  it('a varredura enxerga os contratos exportados, e os campos deles', () => {
    const nomes = esquemasDeResposta.map(([nome]) => nome)
    expect(nomes).toEqual(
      expect.arrayContaining(['contextResponseSchema', 'systemStatusResponseSchema', 'avisosResponseSchema', 'jobStateResponseSchema', 'jobAcceptedResponseSchema', 'configurarMfaResponseSchema', 'ativarMfaResponseSchema']),
    )
    expect(camposDoEsquema(shared.configurarMfaResponseSchema)).toEqual(['uri', 'segredo'])
    expect(camposDoEsquema(shared.contextResponseSchema)).toEqual(['escolaId', 'usuarioId', 'papel', 'sessaoId', 'anoLetivoId'])
    expect(CHAVES_DE_CREDENCIAL_DO_REDACT).toEqual(['authorization', 'cookie', 'set-cookie'])
  })

  it('nenhum contrato de resposta exportado tem campo proibido', () => {
    expect(esquemasDeResposta.flatMap(([nome, esquema]) => problemasDoContrato(nome, esquema))).toEqual([])
  })

  it('a exceção do segredo vale só no contrato do configurar: o mesmo campo em outro contrato é reprovado', () => {
    expect(problemasDoContrato('configurarMfaResponseSchema', shared.configurarMfaResponseSchema)).toEqual([])
    expect(problemasDoContrato('ativarMfaResponseSchema', shared.configurarMfaResponseSchema)).toEqual(['ativarMfaResponseSchema: segredo (segredo)'])
  })

  it('privacidade: reprova o contrato de fixture com senhaHash, em qualquer profundidade e forma', () => {
    const fixture = z.object({
      usuarioId: z.uuid(),
      senhaHash: z.string(),
      acessos: z.array(z.object({ escola: z.object({ mfaSegredo: z.string().optional() }) })).nullable(),
      externo: z.union([z.object({ sujeitoExterno: z.string() }), z.null()]),
      porEscola: z.record(z.string(), z.object({ refreshToken: z.string() })),
      cabecalhos: z.object({ Cookie: z.string() }),
    })
    expect(problemasDoContrato('fixtureResponseSchema', fixture)).toEqual([
      'fixtureResponseSchema: senhaHash (senha)',
      'fixtureResponseSchema: senhaHash (hash)',
      'fixtureResponseSchema: acessos[].escola.mfaSegredo (segredo)',
      'fixtureResponseSchema: externo.sujeitoExterno (sujeito)',
      'fixtureResponseSchema: porEscola{}.refreshToken (refresh)',
      'fixtureResponseSchema: cabecalhos.Cookie (cookie)',
    ])
  })

  it('e-mail é recusado em contrato que pode chegar ao aluno, e só passa em contrato declarado da equipe', () => {
    const comEmail = z.object({ itens: z.array(z.object({ usuarioId: z.uuid(), email: z.email() })) })
    expect(problemasDoContrato('alunosDaTurmaResponseSchema', comEmail)).toEqual(['alunosDaTurmaResponseSchema: itens[].email (email)'])
    expect(CONTRATOS_SO_DA_EQUIPE).toEqual([])
    expect(EXCECOES_NOMINAIS).toEqual({ configurarMfaResponseSchema: ['segredo'], configurarSegundoFatorDeOperadorResponseSchema: ['segredo'] })
  })
})
