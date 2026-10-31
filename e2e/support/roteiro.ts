import { randomUUID } from 'node:crypto'
import type { APIRequestContext } from '@playwright/test'
import { Client } from 'pg'
import { urlDoBancoDeTeste } from '../../tools/ci/compose.ts'
import { ProfessoraPelaApi } from './atividade-db.ts'
import { entrarComoAlunoPelaApi, responderPelaApi } from './aluno-api.ts'
import { expect } from './profiles.ts'

/**
 * O que o e2e do roteiro da demonstração (`e2e/roteiro-da-demonstracao.spec.ts`) lê no banco e faz pela API. A escola
 * nasce na tela, sem seed (D71): aqui só se **lê** o que a tela gravou, para a asserção provar a regra, e se fazem pela
 * API os papéis de apoio que a demonstração faz em outros perfis (a segunda professora, o professor de Física, os
 * alunos que não são o da tela). Tudo sintético.
 */

async function comBanco<T>(tarefa: (banco: Client) => Promise<T>): Promise<T> {
  const banco = new Client({ connectionString: urlDoBancoDeTeste() })
  await banco.connect()
  try {
    return await tarefa(banco)
  } finally {
    await banco.end()
  }
}

async function umId(banco: Client, instrucao: string, parametros: unknown[]): Promise<string> {
  const { rows } = await banco.query<{ id: string }>(instrucao, parametros)
  const achado = rows[0]?.id
  if (achado === undefined) throw new Error(`o e2e do roteiro não achou a linha: ${instrucao}`)
  return achado
}

/** O usuário da escola com a conta daquele e-mail (a equipe entra por e-mail). */
export function usuarioDaEquipe(escolaId: string, email: string): Promise<string> {
  return comBanco((banco) => umId(banco, 'select u.id from usuario u join conta c on c.id = u.conta_id where u.escola_id = $1 and c.email = $2', [escolaId, email.toLowerCase()]))
}

/** O aluno da escola com aquela matrícula. */
export function alunoDaMatricula(escolaId: string, matricula: string): Promise<string> {
  return comBanco((banco) => umId(banco, 'select usuario_id as id from credencial_matricula where escola_id = $1 and matricula = $2', [escolaId, matricula]))
}

/** A turma da escola com aquele nome. */
export function turmaDoNome(escolaId: string, nome: string): Promise<string> {
  return comBanco((banco) => umId(banco, 'select id from turma where escola_id = $1 and nome = $2', [escolaId, nome]))
}

export interface QuestaoNoBanco {
  readonly gabarito: number
  readonly habilidade: string
  readonly alternativaCerta: string
}

/** O artefato de atividade objetiva da escola com aquele título: o id e, de cada questão, o gabarito e a habilidade. */
export function atividadeNoBanco(escolaId: string, titulo: string): Promise<{ id: string; questoes: QuestaoNoBanco[] }> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ id: string; conteudo: { questoes: { gabarito: number; alternativas: string[]; habilidade: { codigo: string } }[] } }>(
      "select id, conteudo from artefato where escola_id = $1 and titulo = $2 and tipo = 'atividade_objetiva' and origem_id is null",
      [escolaId, titulo],
    )
    if (rows.length !== 1 || rows[0] === undefined) throw new Error(`o e2e do roteiro esperava um artefato "${titulo}", achou ${String(rows.length)}`)
    const { id, conteudo } = rows[0]
    return { id, questoes: conteudo.questoes.map((questao) => ({ gabarito: questao.gabarito, habilidade: questao.habilidade.codigo, alternativaCerta: questao.alternativas[questao.gabarito] ?? '' })) }
  })
}

/** A disciplina da escola com aquele nome. */
export function disciplinaDoNome(escolaId: string, nome: string): Promise<string> {
  return comBanco((banco) => umId(banco, 'select id from disciplina where escola_id = $1 and nome = $2', [escolaId, nome]))
}

/** Quantos artefatos a escola tem: zero antes de a professora escolher a ferramenta prova que a pergunta da D18 não gera nada. */
export function artefatosNoBanco(escolaId: string): Promise<number> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ total: number }>('select count(*)::int as total from artefato where escola_id = $1', [escolaId])
    return rows[0]?.total ?? 0
  })
}

/** A aplicação aberta ou encerrada daquele artefato. */
export function aplicacaoDoArtefato(escolaId: string, artefatoId: string): Promise<string> {
  return comBanco((banco) => umId(banco, 'select id from atividade_aplicada where escola_id = $1 and artefato_id = $2', [escolaId, artefatoId]))
}

const comToken = (token: string) => ({ Authorization: `Bearer ${token}` })

/** Entra por e-mail e senha pela API (`POST /v1/sessao/email`), como a tela faria, e devolve o token. */
export async function tokenDaEquipe(request: APIRequestContext, email: string, senha: string): Promise<string> {
  const resposta = await request.post('/v1/sessao/email', { data: { email, senha } })
  const corpo = (await resposta.json()) as { etapa?: string; token?: string }
  if (!resposta.ok() || corpo.etapa !== 'pronta' || corpo.token === undefined) throw new Error(`a entrada por e-mail não abriu sessão: ${String(resposta.status())} ${String(corpo.etapa)}`)
  return corpo.token
}

/**
 * Um professor de apoio faz pela API o que a demonstração faz em outro perfil: aceita o convite do link que a
 * coordenação copiou, define a senha, entra e confirma os vínculos que a coordenação alocou para ele (D3).
 */
export async function professorAceitaEConfirmaPelaApi(request: APIRequestContext, linkDoConvite: string, email: string, senha: string): Promise<void> {
  const token = new URL(linkDoConvite).hash.slice(1)
  const aceite = await request.post('/v1/convites/aceitar', { data: { token, senha } })
  expect(aceite.ok(), 'o professor de apoio aceita o convite').toBe(true)
  const sessao = await tokenDaEquipe(request, email, senha)
  const meus = await request.get('/v1/meus-vinculos', { headers: comToken(sessao) })
  expect(meus.ok(), 'o professor de apoio lê os vínculos dele').toBe(true)
  const { itens } = (await meus.json()) as { itens: { id: string; estado: string }[] }
  const pendentes = itens.filter((vinculo) => vinculo.estado === 'pendente')
  expect(pendentes.length, 'a coordenação alocou o professor de apoio').toBeGreaterThan(0)
  for (const vinculo of pendentes) {
    const confirmado = await request.post(`/v1/vinculos/${vinculo.id}/confirmar`, { headers: comToken(sessao) })
    expect(confirmado.ok(), 'o professor de apoio confirma o vínculo').toBe(true)
  }
}

/**
 * Um aluno de apoio reivindica o nome pela API pública da sala, com o código que a professora projetou, como a página
 * `/e/<slug>/turma` faz (D4): abre a sala, acha o nome livre dele e manda matrícula e senha.
 */
export async function alunoReivindicaPelaApi(request: APIRequestContext, sala: { slug: string; codigo: string }, aluno: { nome: string; matricula: string; senha: string }): Promise<void> {
  const aberta = await request.post('/v1/salas/abrir', { data: sala })
  expect(aberta.ok(), 'a sala abre pelo código').toBe(true)
  const { nomes } = (await aberta.json()) as { nomes: { id: string; nome: string }[] }
  const livre = nomes.find((nome) => nome.nome === aluno.nome)
  if (livre === undefined) throw new Error('o nome do aluno de apoio não está livre na lista da turma')
  const pedido = await request.post('/v1/salas/reivindicar', { data: { ...sala, listaNomeId: livre.id, matricula: aluno.matricula, senha: aluno.senha, chaveEnvio: randomUUID() } })
  expect(pedido.ok(), 'o pedido do aluno de apoio é aceito').toBe(true)
}

/** O código de erro que a API devolve ao pedido de versão adaptada daquele artefato, ou `null` se ela aceitou. */
export async function erroAoPedirVersaoAdaptada(request: APIRequestContext, token: string, artefatoId: string): Promise<string | null> {
  const resposta = await request.post(`/v1/artefatos/${artefatoId}/adaptar`, { headers: comToken(token), data: { tipos: ['fonte_ampliada'], chaveEnvio: randomUUID() } })
  if (resposta.status() === 202) return null
  const corpo = (await resposta.json()) as { erro?: { codigo?: string } }
  return corpo.erro?.codigo ?? `HTTP ${String(resposta.status())}`
}

export interface AlunoDeApoio {
  readonly nome: string
  readonly matricula: string
  readonly senha: string
}

/**
 * A segunda professora da disciplina faz, pela API e na turma dela, o que a demonstração deixa pronto na véspera: gera o
 * acesso, aprova os pedidos de nome dos alunos de apoio, gera uma atividade com a ferramenta, aplica, os alunos
 * respondem, e ela encerra, abre os destaques e **aprova o lote**. É o que dá ao recorte da série e da disciplina dois
 * professores distintos com correção aprovada, e por isso número no Analista (D45). Devolve o id do artefato.
 */
export async function segundaProfessoraAprovaUmLotePelaApi(
  request: APIRequestContext,
  professora: { email: string; senha: string },
  turma: { slug: string; turmaId: string; disciplinaId: string; tema: string },
  alunos: readonly AlunoDeApoio[],
): Promise<string> {
  const token = await tokenDaEquipe(request, professora.email, professora.senha)
  const acesso = await request.post(`/v1/turmas/${turma.turmaId}/acesso`, { headers: comToken(token), data: { validadeDias: 1 } })
  expect(acesso.ok(), 'a segunda professora gera o acesso da turma dela').toBe(true)
  const { codigo } = (await acesso.json()) as { codigo: string }
  for (const aluno of alunos) await alunoReivindicaPelaApi(request, { slug: turma.slug, codigo }, aluno)
  const lidos = await request.get(`/v1/turmas/${turma.turmaId}/reivindicacoes`, { headers: comToken(token) })
  expect(lidos.ok(), 'a segunda professora lê os pedidos').toBe(true)
  const { itens } = (await lidos.json()) as { itens: { id: string }[] }
  expect(itens).toHaveLength(alunos.length)
  const decisao = await request.post('/v1/reivindicacoes/decidir', { headers: comToken(token), data: { ids: itens.map((pedido) => pedido.id), decisao: 'aprovar' } })
  expect(decisao.ok(), 'a segunda professora aprova os pedidos').toBe(true)

  const pedido = await request.post('/v1/ferramentas/atividade_objetiva/gerar', {
    headers: comToken(token),
    data: { turmaId: turma.turmaId, disciplinaId: turma.disciplinaId, tema: turma.tema, quantidade: 3, chaveEnvio: randomUUID() },
  })
  expect(pedido.status(), 'a ferramenta aceita o pedido').toBe(202)
  const { execucaoId } = (await pedido.json()) as { execucaoId: string }
  let artefatoId: string | undefined
  await expect
    .poll(
      async () => {
        const execucao = (await (await request.get(`/v1/execucoes/${execucaoId}`, { headers: comToken(token) })).json()) as { estado: string; resultado: { artefatoId?: string } | null }
        artefatoId = execucao.resultado?.artefatoId
        return execucao.estado
      },
      { timeout: 45_000, intervals: [1_000] },
    )
    .toBe('concluida')
  if (artefatoId === undefined) throw new Error('a geração da segunda professora não devolveu artefato')

  const dela = await ProfessoraPelaApi.entrar(request, professora)
  const aplicadaId = await dela.aplicar(artefatoId, turma.turmaId, false)
  for (const aluno of alunos) await responderPelaApi(request, await entrarComoAlunoPelaApi(request, { slug: turma.slug, ...aluno }), aplicadaId, [0, 1, 2])
  await dela.encerrarEAprovar(aplicadaId)
  return artefatoId
}
