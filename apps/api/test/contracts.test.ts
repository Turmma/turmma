import { CHAVES_DE_CREDENCIAL } from '@educa/core'
import * as shared from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/**
 * Nenhuma resposta traz senha, hash, segredo de MFA, identificador externo, refresh ou campo de credencial (RF18;
 * Tech Spec, seção 7). A varredura percorre todo esquema de resposta exportado por `packages/shared` (os
 * `*ResponseSchema`), em qualquer profundidade: contrato que uma tarefa seguinte criar entra sozinho, sem mudar este
 * teste.
 */

/** Nomes que nenhum campo de resposta pode ter, nem como parte do nome (`senhaHash`, `refreshToken`). */
const CHAVES_PROIBIDAS = ['senha', 'hash', 'segredo', 'sujeito', 'refresh', 'cifrado'] as const

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
  // A senha provisória do aluno: mostrada uma vez, na resposta de quem a gera (acesso-e-convites, tarefa 9.0). Nenhuma leitura a devolve.
  senhaProvisoriaResponseSchema: ['senha'],
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

  it('F2, RF17: a grade sai sem e-mail: o professor da aula vai só com id e nome, e o calendário não tem pessoa', () => {
    expect(camposDoEsquema(shared.gradeResponseSchema)).toEqual([
      'aulas',
      'aulas[].id',
      'aulas[].turmaId',
      'aulas[].disciplinaId',
      'aulas[].professor',
      'aulas[].professor.usuarioId',
      'aulas[].professor.nome',
      'aulas[].diaSemana',
      'aulas[].inicio',
      'aulas[].fim',
      'aulas[].sala',
    ])
    expect(problemasDoContrato('gradeResponseSchema', shared.gradeResponseSchema)).toEqual([])
    expect(camposDoEsquema(shared.calendarioResponseSchema)).toEqual(['eventos', 'eventos[].id', 'eventos[].tipo', 'eventos[].inicio', 'eventos[].fim', 'eventos[].descricao'])
    // A varredura reprova a grade que passasse a levar o e-mail do professor, em qualquer profundidade.
    const comEmail = z.object({ aulas: z.array(z.object({ professor: z.object({ usuarioId: z.uuid(), nome: z.string(), email: z.email() }) })) })
    expect(problemasDoContrato('gradeResponseSchema', comEmail)).toEqual(['gradeResponseSchema: aulas[].professor.email (email)'])
  })

  it('F2, 12.0: a grade lida pelo professor recusa o e-mail do colega em qualquer aula, e a consulta exige a turma e não aceita a escola', () => {
    const aula = { id: randomUUID(), turmaId: randomUUID(), disciplinaId: null, professor: { usuarioId: randomUUID(), nome: 'Colega' }, diaSemana: 1, inicio: '08:00', fim: '08:50', sala: null }
    expect(shared.gradeResponseSchema.safeParse({ aulas: [aula] }).success).toBe(true)
    expect(shared.gradeResponseSchema.safeParse({ aulas: [aula, { ...aula, professor: { ...aula.professor, email: 'colega@escola.invalid' } }] }).success).toBe(false)
    expect(shared.gradeQuerySchema.safeParse({ turmaId: aula.turmaId }).success).toBe(true)
    expect(shared.gradeQuerySchema.safeParse({}).success).toBe(false)
    expect(shared.gradeQuerySchema.safeParse({ turmaId: aula.turmaId, escolaId: randomUUID() }).success).toBe(false)
  })

  it('F2: a prévia e o gravar das planilhas entram na varredura e saem sem campo proibido', () => {
    const nomes = esquemasDeResposta.map(([nome]) => nome)
    expect(nomes).toEqual(expect.arrayContaining(['previaDaPlanilhaResponseSchema', 'gravarPlanilhaResponseSchema', 'gradeResponseSchema', 'calendarioResponseSchema']))
    expect(camposDoEsquema(shared.gravarPlanilhaResponseSchema)).toEqual(['id'])
  })

  it('camada-ia 5.0: `GET /v1/operacao/uso` traz o grupo `ia` só com número, e `GET …/escolas/:id/uso-ia` os 12 meses sem pessoa, função, modelo, aviso nem teto', () => {
    const nomes = esquemasDeResposta.map(([nome]) => nome)
    expect(nomes).toEqual(expect.arrayContaining(['usoDoPainelResponseSchema', 'usoDeIaDaEscolaDoPainelResponseSchema']))
    const doUso = camposDoEsquema(shared.usoDoPainelResponseSchema).filter((campo) => campo.startsWith('itens[].ia'))
    const periodo = (prefixo: string) => ['execucoes', 'chamadas', 'tokens', 'custoMicros', 'chamadasPeloProvedorDeReserva'].map((campo) => `${prefixo}.${campo}`)
    expect(doUso).toEqual([
      'itens[].ia',
      'itens[].ia.hoje',
      ...periodo('itens[].ia.hoje'),
      // O mês reusa o esquema de hoje, e a varredura não o repete.
      'itens[].ia.mes',
      'itens[].ia.alunosAtivos',
      'itens[].ia.valorPorAlunoMicros',
      'itens[].ia.origemDoValor',
      'itens[].ia.porcentagem',
      'itens[].ia.situacao',
    ])
    // 8.0: a rede e o orçamento da escola, fora do `ia`, são os da lista de escolas: id e nome da rede, e só número no orçamento (nenhuma pessoa).
    const daLinha = camposDoEsquema(shared.usoDoPainelResponseSchema).filter((campo) => campo.startsWith('itens[].rede') || campo.startsWith('itens[].orcamento'))
    expect(daLinha).toEqual([
      'itens[].rede',
      'itens[].rede.id',
      'itens[].rede.nome',
      'itens[].orcamento',
      'itens[].orcamento.proprio',
      'itens[].orcamento.proprio.valorPorAlunoMicros',
      'itens[].orcamento.proprio.tetoDeSegurancaPercentual',
      'itens[].orcamento.vigente',
      'itens[].orcamento.vigente.valorPorAlunoMicros',
      'itens[].orcamento.vigente.origemDoValor',
      'itens[].orcamento.vigente.tetoDeSegurancaPercentual',
      'itens[].orcamento.vigente.origemDoTeto',
    ])
    expect(camposDoEsquema(shared.usoDeIaDoPeriodoDoPainelSchema)).toEqual(['execucoes', 'chamadas', 'tokens', 'custoMicros', 'chamadasPeloProvedorDeReserva'])
    const dosMeses = camposDoEsquema(shared.usoDeIaDaEscolaDoPainelResponseSchema)
    expect(dosMeses).toEqual([
      'meses',
      'meses[].execucoes',
      'meses[].chamadas',
      'meses[].tokens',
      'meses[].custoMicros',
      'meses[].chamadasPeloProvedorDeReserva',
      'meses[].mes',
      'meses[].alunosAtivos',
      'meses[].valorPorAlunoMicros',
      'meses[].origemDoValor',
      'meses[].porcentagem',
      'meses[].situacao',
    ])
    for (const proibido of ['alunoId', 'usuarioId', 'nome', 'funcao', 'modelo', 'provedorId', 'aviso', 'teto', 'entrada', 'saida']) {
      expect([...doUso, ...dosMeses].filter((campo) => campo.toLowerCase().includes(proibido.toLowerCase())), proibido).toEqual([])
    }
    expect(problemasDoContrato('usoDoPainelResponseSchema', shared.usoDoPainelResponseSchema)).toEqual([])
    expect(problemasDoContrato('usoDeIaDaEscolaDoPainelResponseSchema', shared.usoDeIaDaEscolaDoPainelResponseSchema)).toEqual([])
  })

  it('ingestao-do-material 4.0: `GET /v1/materiais/:id` entra na varredura com os capítulos, e só com o que o painel mostra: nem o texto das páginas, nem hash, nem quem enviou', () => {
    expect(esquemasDeResposta.map(([nome]) => nome)).toContain('materialComCapitulosResponseSchema')
    const campos = camposDoEsquema(shared.materialComCapitulosResponseSchema)
    expect(campos.filter((campo) => campo.startsWith('capitulos'))).toEqual(['capitulos', 'capitulos[].ordem', 'capitulos[].numero', 'capitulos[].titulo', 'capitulos[].paginaInicial', 'capitulos[].paginaFinal'])
    for (const proibido of ['sha256', 'enviadoPor', 'texto']) expect(campos).not.toContain(proibido)
    expect(problemasDoContrato('materialComCapitulosResponseSchema', shared.materialComCapitulosResponseSchema)).toEqual([])
    // O capítulo é estrito: campo a mais é recusado, e o título passa do teto da coluna não.
    const capitulo = { ordem: 1, numero: 1, titulo: 'Capítulo 1', paginaInicial: 1, paginaFinal: 2 }
    expect(shared.capituloDoMaterialSchema.safeParse(capitulo).success).toBe(true)
    expect(shared.capituloDoMaterialSchema.safeParse({ ...capitulo, texto: 'a página inteira' }).success).toBe(false)
    expect(shared.capituloDoMaterialSchema.safeParse({ ...capitulo, titulo: 'a'.repeat(shared.TAMANHO_MAXIMO_DO_TITULO_DO_CAPITULO + 1) }).success).toBe(false)
  })

  it('classificacao-bncc 7.0: as seções do `GET /v1/materiais/:id` e a lista de habilidades entram na varredura, e saem sem `corrigidaPor`, sem `execucaoId` e sem `falhasSeguidas`', () => {
    const nomes = esquemasDeResposta.map(([nome]) => nome)
    expect(nomes).toEqual(expect.arrayContaining(['materialComCapitulosResponseSchema', 'secaoDoMaterialResponseSchema', 'reclassificarResponseSchema', 'habilidadesBnccResponseSchema']))
    const campos = camposDoEsquema(shared.materialComCapitulosResponseSchema)
    expect(campos.filter((campo) => campo.startsWith('secoes'))).toEqual([
      'secoes',
      'secoes[].id',
      'secoes[].ordem',
      'secoes[].paginaInicial',
      'secoes[].paginaFinal',
      'secoes[].capitulo',
      'secoes[].capitulo.numero',
      'secoes[].capitulo.titulo',
      'secoes[].situacao',
      'secoes[].habilidades',
      'secoes[].habilidades[].codigo',
      'secoes[].habilidades[].descricao',
      'secoes[].habilidades[].origem',
      'secoes[].corrigida',
    ])
    expect(campos).toContain('classificacaoSuspensa')
    for (const proibido of ['corrigidaPor', 'corrigidaEm', 'execucaoId', 'falhasSeguidas', 'classificadaEm']) expect(campos.filter((campo) => campo.includes(proibido))).toEqual([])
    for (const nome of ['materialComCapitulosResponseSchema', 'secaoDoMaterialResponseSchema', 'reclassificarResponseSchema', 'habilidadesBnccResponseSchema'] as const) expect(problemasDoContrato(nome, shared[nome])).toEqual([])
    // A seção é estrita: quem corrigiu e a execução não passam, nem por engano.
    const secao = { id: '0196c0a8-7b2c-7000-8000-000000000001', ordem: 1, paginaInicial: 1, paginaFinal: 2, capitulo: null, situacao: 'classificada', habilidades: [], corrigida: true }
    expect(shared.secaoDoMaterialResponseSchema.safeParse(secao).success).toBe(true)
    expect(shared.secaoDoMaterialResponseSchema.safeParse({ ...secao, corrigidaPor: secao.id }).success).toBe(false)
    expect(shared.secaoDoMaterialResponseSchema.safeParse({ ...secao, execucaoId: secao.id }).success).toBe(false)
  })

  it('ingestao-do-material 10.0: `GET /v1/artefatos/:id` traz as `fontes` só com materialId, título, edição e substituído: nem hash, nem chave do objeto, nem quem enviou, nem licenciante', () => {
    expect(esquemasDeResposta.map(([nome]) => nome)).toContain('artefatoResponseSchema')
    const campos = camposDoEsquema(shared.artefatoResponseSchema)
    expect(campos.filter((campo) => campo.startsWith('fontes'))).toEqual(['fontes', 'fontes[].materialId', 'fontes[].titulo', 'fontes[].edicao', 'fontes[].substituido'])
    for (const proibido of ['sha256', 'chave', 'enviadoPor', 'licenciante', 'licencaId', 'licenca', 'titularidade']) expect(campos.filter((campo) => campo.startsWith('fontes'))).not.toContain(`fontes[].${proibido}`)
    expect(problemasDoContrato('artefatoResponseSchema', shared.artefatoResponseSchema)).toEqual([])
    // A seção de cada questão (classificacao-bncc, 11.0): o capítulo, as páginas e as habilidades com a origem; nunca quem corrigiu nem a execução.
    expect(campos.filter((campo) => campo.startsWith('secoesDasQuestoes'))).toEqual([
      'secoesDasQuestoes',
      'secoesDasQuestoes[].capitulo',
      'secoesDasQuestoes[].capitulo.numero',
      'secoesDasQuestoes[].capitulo.titulo',
      'secoesDasQuestoes[].paginaInicial',
      'secoesDasQuestoes[].paginaFinal',
      'secoesDasQuestoes[].habilidades',
      'secoesDasQuestoes[].habilidades[].codigo',
      'secoesDasQuestoes[].habilidades[].origem',
    ])
    for (const proibido of ['corrigidaPor', 'corrigida_por', 'execucaoId', 'execucao_id']) expect(campos.filter((campo) => campo.includes(proibido)), proibido).toEqual([])
    // A fonte é estrita: campo a mais (o licenciante, o hash) é recusado.
    const fonte = { materialId: randomUUID(), titulo: 'Química 2', edicao: '2025', substituido: false }
    expect(shared.fonteDoArtefatoSchema.safeParse(fonte).success).toBe(true)
    expect(shared.fonteDoArtefatoSchema.safeParse({ ...fonte, licenciante: 'Editora' }).success).toBe(false)
    expect(shared.fonteDoArtefatoSchema.safeParse({ ...fonte, sha256: 'abc' }).success).toBe(false)
  })

  it('reengenharia-continuacao 9.0: `GET /v1/tutor/uso` entra na varredura e traz, por aluno, só os campos declarados: a contagem das perguntas sem resposta, e nunca o texto delas, o código do erro nem a execução', () => {
    expect(esquemasDeResposta.map(([nome]) => nome)).toContain('usoDoTutorResponseSchema')
    const campos = camposDoEsquema(shared.usoDoTutorResponseSchema)
    expect(campos.filter((campo) => campo.startsWith('alunos'))).toEqual([
      'alunos',
      'alunos[].aluno',
      'alunos[].aluno.id',
      'alunos[].aluno.nome',
      'alunos[].trocasHoje',
      'alunos[].semRespostaHoje',
      'alunos[].ultimaTrocaEm',
      'alunos[].ultimaReferencia',
      'alunos[].ultimaReferencia.atividadeAplicadaId',
      'alunos[].ultimaReferencia.questao',
      'alunos[].ultimaReferencia.materialId',
      'alunos[].ultimaReferencia.pagina',
    ])
    expect(campos.filter((campo) => /texto|pergunta|mensagem|erro|codigo|execucao/i.test(campo))).toEqual([])
    expect(problemasDoContrato('usoDoTutorResponseSchema', shared.usoDoTutorResponseSchema)).toEqual([])
    // O aluno é estrito: o campo a mais (o texto da pergunta cortada, o código) é recusado.
    const aluno = { aluno: { id: randomUUID(), nome: 'Aluno Sintético' }, trocasHoje: 1, semRespostaHoje: 2, ultimaTrocaEm: new Date().toISOString(), ultimaReferencia: { atividadeAplicadaId: null, questao: null, materialId: null, pagina: null } }
    expect(shared.usoDoAlunoSchema.safeParse(aluno).success).toBe(true)
    expect(shared.usoDoAlunoSchema.safeParse({ ...aluno, ultimaSemResposta: 'não entendi a questão 3' }).success).toBe(false)
    expect(shared.usoDoAlunoSchema.safeParse({ ...aluno, erro: 'IA_INDISPONIVEL' }).success).toBe(false)
  })

  it('e-mail é recusado em contrato que pode chegar ao aluno, e só passa em contrato declarado da equipe', () => {
    const comEmail = z.object({ itens: z.array(z.object({ usuarioId: z.uuid(), email: z.email() })) })
    expect(problemasDoContrato('alunosDaTurmaResponseSchema', comEmail)).toEqual(['alunosDaTurmaResponseSchema: itens[].email (email)'])
    expect(CONTRATOS_SO_DA_EQUIPE).toEqual([])
    expect(EXCECOES_NOMINAIS).toEqual({ configurarMfaResponseSchema: ['segredo'], configurarSegundoFatorDeOperadorResponseSchema: ['segredo'], senhaProvisoriaResponseSchema: ['senha'] })
  })
})
