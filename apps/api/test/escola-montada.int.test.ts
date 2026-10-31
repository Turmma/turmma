import { CAMPOS_PROIBIDOS_NA_AUDITORIA } from '@educa/core'
import {
  ErrorCode,
  nomeDaListaSchema,
  acessoDaTurmaResponseSchema,
  acessoGeradoResponseSchema,
  conviteDeProfessorResponseSchema,
  decisaoResponseSchema,
  disciplinaResponseSchema,
  gravacaoDaListaResponseSchema,
  listaDaTurmaResponseSchema,
  listaDeProfessoresResponseSchema,
  minhaTurmaResponseSchema,
  pedidosDaTurmaResponseSchema,
  previaDaListaResponseSchema,
  reivindicacaoResponseSchema,
  salaAbertaResponseSchema,
  turmaResponseSchema,
  MENSAGENS_DE_ERRO,
} from '@educa/shared'
import { randomBytes, randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { z } from 'zod'
import { hmacDoCodigoDaTurma, sortearCodigoDaTurma } from '../src/sala/codigo-da-sala.js'
import { hashDoToken } from '../src/credencial/index.js'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { chamar, subirApi, type ApiDeTeste, type RespostaHttp } from './api-com-sessao.js'
import { configuracaoDeTeste } from './configuracao-de-teste.js'
import { BancadaDeSessoes, type SessaoDeTeste } from './sessao-de-teste.js'

/**
 * Os cenários transversais da A1 (`tasks/prd-apresentacao-escola/cenarios.md`): I3, P1, A1, A3 e A4, cada um uma
 * varredura sobre `ROTAS_DA_A1`, as rotas autenticadas novas da funcionalidade. A tarefa 1.0 criou o arquivo com as
 * rotas dela; cada tarefa seguinte acrescenta as suas à lista, e o que elas precisam à escola montada, a `estadoDe` e
 * às sentinelas, e as cinco varreduras passam a cobri-las sem mudar.
 *
 * Toda varredura termina chamando a rota com o recurso da própria escola e conferindo o sucesso: sem isso, uma rota
 * que não existe (ou um caminho escrito errado aqui) responderia o mesmo 404 e passaria calada.
 *
 * A rota sem parâmetro de id (`POST` e `GET /v1/professores`, 3.0) não tem recurso de B a pedir: fica fora do I3 por id,
 * e o isolamento da lista é o "I3 (lista)" de `professores.int.test.ts`. As outras quatro varreduras a cobrem.
 *
 * A lista de nomes (2.0) mora na `turmaComVinculo`, e não na `turma`: excluir a `turma` precisa continuar dando certo.
 *
 * As rotas do acesso da turma (4.0) são do professor com vínculo confirmado, e não da coordenação (`autor`): o sucesso, o
 * I3, a auditoria e as variantes do A3 e do A4 pedem com o professor, e o P1 com a coordenação, o aluno e o professor
 * na turma em que ele não tem vínculo.
 *
 * A página pública da sala (`POST /v1/salas/abrir`, 5.0) é anônima (`anonima`): vai sem token, abre a turma da escola
 * montada pelo slug e pelo código do acesso dela, e entra na auditoria (nenhum registro), no A3 e no A4. Fica fora do I3,
 * que é por id no caminho (o dela é o I4 de `salas-abrir.int.test.ts`), e do P1, que é da célula da matriz, que a rota
 * anônima não tem.
 *
 * A reivindicação do nome (`POST /v1/salas/reivindicar`, 6.0) também é anônima: pede pelo código e pelo link os dois
 * nomes livres da `turmaComVinculo` guardados para ela, com a matrícula certa, e passa também pelas recusas (matrícula
 * errada, nome inexistente, nome já reivindicado), que respondem `REIVINDICACAO_RECUSADA`. O nome reivindicado da escola
 * montada nasce por ela. A senha, as chaves de envio e o hash gravado nunca vão a resposta nem a log.
 *
 * Os pedidos da turma (8.0) são da coordenação e também do professor com vínculo confirmado (`abertaAoProfessor`): a
 * coordenação lê com finalidade e grava `turma.reivindicacoes_lidas`, e o P1 pede com o aluno e com o professor na turma
 * em que ele não tem vínculo. A decisão aprova o pedido pendente do nome reivindicado da escola montada, e grava
 * `reivindicacao.decidida`; o id do pedido vai no corpo, e não no caminho: fica fora do I3 por id, que é a I6 de
 * `decisao.int.test.ts`, e o P1 pede só com o aluno (o professor sem vínculo recebe `nao_encontrada`, também na I6). A
 * turma do aluno (`GET /v1/minha-turma`) é só do aluno (`autor: 'aluno'`), que tem vínculo confirmado na
 * `turmaComVinculo`; o P1 pede com a coordenação e com o professor (P4).
 *
 * Toda chamada das varreduras sai com o `X-Forwarded-For` de `IP_DO_PEDIDO`, com a API confiando no 127.0.0.1: o A4
 * procura o IP no log, como procura o slug (Tech Spec da A1, seção 7, "Registro de acesso").
 */

/** Uma escola da A1 montada pela API, como a coordenação faria, com as pessoas e os recursos que as rotas pedem. */
interface EscolaMontada {
  readonly escolaId: string
  readonly slug: string
  readonly coordenacao: SessaoDeTeste
  readonly professor: SessaoDeTeste
  readonly aluno: SessaoDeTeste
  /** Sem vínculo: renomear e excluir dão certo. */
  readonly disciplina: string
  readonly turma: string
  /** Com o vínculo confirmado do professor: excluir dá `CONFLITO`. */
  readonly disciplinaComVinculo: string
  readonly turmaComVinculo: string
  /** Os nomes gravados, únicos por escola, que o log nunca pode ter (A4). */
  readonly nomes: {
    readonly disciplina: string
    readonly turma: string
    readonly disciplinaComVinculo: string
    readonly turmaComVinculo: string
    readonly nomeLivre: string
    readonly nomeReivindicado: string
  }
  /**
   * A lista de nomes da `turmaComVinculo` (2.0): um nome livre (retirar dá certo; a matrícula dele, gravada em outra
   * turma, dá `CONFLITO`) e um reivindicado pela sala, com o pedido pendente (6.0; retirar dá `CONFLITO`). Mais dois
   * livres, que a reivindicação toma pelo código e pelo link. As matrículas nunca vão a log (A4).
   */
  readonly lista: {
    readonly livre: string
    readonly reivindicado: string
    readonly matriculaLivre: string
    readonly matriculaReivindicada: string
    readonly paraReivindicar: readonly [NomeParaReivindicar, NomeParaReivindicar]
  }
  /** O pedido pendente do nome reivindicado (6.0), que a decisão (8.0) aprova. */
  readonly pedidoPendente: string
  /** Matrícula e hash de senha de um aluno da escola, que nenhuma resposta nem log pode ter (A3, A4). */
  readonly matricula: string
  readonly senhaHash: string
  /**
   * O professor cadastrado pela coordenação (3.0), com o convite em aberto: refazer e revogar dão certo. O e-mail e o
   * token dele nunca aparecem em outra resposta nem em log (A3, A4); o e-mail cadastrado de novo dá `CONFLITO`.
   */
  readonly convidado: { readonly usuarioId: string; readonly email: string; readonly token: string }
  /** O professor com o convite revogado: refazer dá `CONFLITO`. */
  readonly convidadoRevogado: string
  /** O professor que aceitou o convite: revogar dá `CONFLITO`. */
  readonly convidadoAceito: string
  /**
   * O acesso vigente da `turmaComVinculo`, gerado pelo professor (4.0): revogar e ler dão certo. O token e o código
   * aparecem só na resposta que os criou: em nenhuma outra, e nunca em log (A3, A4).
   */
  readonly acesso: { readonly token: string; readonly codigo: string }
  /**
   * Um token e um código que não são de acesso nenhum, sorteados na montagem (5.0): os 404 da página pública da sala os
   * usam, e o A4 os procura no log, como procura o token e o código do acesso vigente.
   */
  readonly semAcesso: { readonly token: string; readonly codigo: string }
}

/** Um nome livre da lista que a reivindicação toma, com a matrícula dele. */
interface NomeParaReivindicar {
  readonly id: string
  readonly matricula: string
}

/** Uma rota nova da A1, com o que as varreduras precisam para chamá-la na escola montada. */
interface RotaDaA1 {
  /**
   * Como a spec a escreve: verbo e caminho, com um parâmetro de id (`PATCH /v1/turmas/:id`), ou sem ele, na rota da
   * escola inteira (`GET /v1/professores`).
   */
  readonly rota: string
  /**
   * O id que vai no caminho: o recurso da escola montada que a chamada de sucesso alcança. Só na rota com parâmetro: a
   * rota sem id não tem recurso de B a pedir, e o I3 dela mora no teste da funcionalidade (`professores.int.test.ts`).
   */
  readonly alvo?: (escola: EscolaMontada) => string
  /**
   * O recurso da escola montada em que o professor tem vínculo confirmado, se a rota o alcança por um: o P1 pede com ele
   * também, porque o professor dono é quem mais pode passar por uma célula aberta com filtro de vínculo.
   */
  readonly alvoDoProfessor?: (escola: EscolaMontada) => string
  /**
   * Quem chama a rota com sucesso: a coordenação (o padrão), o professor com vínculo confirmado no alvo (o acesso da
   * turma, 4.0) ou o aluno com vínculo confirmado (a turma dele, 8.0). O I3, a auditoria e as variantes pedem com ele.
   */
  readonly autor?: 'professor' | 'aluno'
  /**
   * Na rota da coordenação que o professor com vínculo confirmado também chama (os pedidos da turma, 8.0): o P1 não pede
   * com o professor no alvo, e sim com o aluno e, se houver `alvoSemVinculo`, com o professor na turma sem vínculo dele.
   */
  readonly abertaAoProfessor?: true
  /** Na rota do professor (ou aberta a ele), o recurso da escola montada em que ele **não** tem vínculo: o P1 pede com ele. */
  readonly alvoSemVinculo?: (escola: EscolaMontada) => string
  /** O corpo válido, se a rota lê corpo. */
  readonly corpo?: (escola: EscolaMontada) => Record<string, unknown>
  /**
   * A rota anônima (a página pública da sala, 5.0): vai sem token, e o sucesso e as variantes não dependem de quem chama.
   * Fica fora do P1, que é da célula da matriz.
   */
  readonly anonima?: true
  /**
   * Na rota sem parâmetro de id que responde `NAO_ENCONTRADO` a um pedido, os corpos desses pedidos: o A3 e o A4 passam
   * por eles como passam pelo id sorteado das outras.
   */
  readonly inexistentes?: (escola: EscolaMontada) => ReadonlyArray<Record<string, unknown>>
  /**
   * Na rota da reivindicação (6.0), os corpos que ela recusa com `REIVINDICACAO_RECUSADA` (409): o A3 e o A4 passam por
   * eles como passam pelo conflito das outras.
   */
  readonly recusas?: (escola: EscolaMontada) => ReadonlyArray<Record<string, unknown>>
  /** Outros corpos que dão o mesmo sucesso da rota (a página da sala pelo link, além do código): o A3 e o A4 passam por eles. */
  readonly outrosSucessos?: (escola: EscolaMontada) => ReadonlyArray<Record<string, unknown>>
  /** O status do sucesso, pela coordenação, com o `alvo` e o `corpo`. */
  readonly sucesso: 200 | 201 | 204
  /** O contrato estrito da resposta de sucesso; sem ele, o corpo é vazio (204). */
  readonly resposta?: z.ZodType
  /** O pedido da mesma rota que dá `CONFLITO` na escola montada, se a rota tem um (o alvo, se a rota tem parâmetro). */
  readonly conflito?: (escola: EscolaMontada) => { readonly alvo?: string; readonly corpo?: Record<string, unknown> }
  /** As ações de auditoria que o sucesso grava, em ordem (A1). Vazia quando a spec não pede auditoria da rota. */
  readonly auditoria: readonly string[]
}

/** A finalidade com que a coordenação lê a lista e os pedidos. */
const FINALIDADE = 'conferencia_de_cadastro'

/** Em minúsculas, como o `detail` do índice único (`lower(nome)`) o escreveria: a sentinela pega o vazamento dos dois jeitos. */
const NOME_RENOMEADO = `renomeada ${randomUUID().slice(0, 8)}`

/** O nome dos professores cadastrados pelas varreduras, que o log nunca pode ter (A4). */
const NOME_DO_PROFESSOR = `professor ${randomUUID().slice(0, 8)}`
/** O domínio dos e-mails cadastrados pelas varreduras, que nenhuma resposta nem log pode ter (A3, A4). */
const DOMINIO_DO_EMAIL = `escola-${randomUUID().slice(0, 8)}.invalid`
/** A senha com que o professor da escola montada aceita o convite. */
const SENHA_DO_ACEITE = 'senha-do-aceite-sintetica-1'
/** O nome dos alunos que as varreduras põem na lista, e o prefixo das matrículas deles: nenhum dos dois vai a log (A4). */
const NOME_NA_LISTA = `aluno da lista ${randomUUID().slice(0, 8)}`
const PREFIXO_DA_MATRICULA = `lista-${randomUUID().slice(0, 8)}`
const matriculaNova = (): string => `${PREFIXO_DA_MATRICULA}-${randomUUID().slice(0, 8)}`
/**
 * A senha que o aluno cria na reivindicação (6.0): nenhuma resposta nem log pode tê-la (A3, A4). Em minúsculas e com `_`,
 * no formato de evento que o `NestLogger` deixa passar: a sentinela pega o vazamento também por ali.
 */
const SENHA_DA_SALA = `senha_da_sala_${randomBytes(6).toString('hex')}`
/** Toda chave de envio que as varreduras mandaram: nenhuma resposta nem log pode tê-la (A3, A4). */
const CHAVES_DE_ENVIO: string[] = []
const chaveNova = (): string => {
  const chave = randomUUID()
  CHAVES_DE_ENVIO.push(chave)
  return chave
}

/** O IP de onde as varreduras chamam as rotas (TEST-NET-3, RFC 5737), que o log nunca pode ter (A4). */
const IP_DO_PEDIDO = `203.0.113.${String(randomBytes(1)[0] ?? 0)}`

/** O corpo da reivindicação do nome, pelo código ou pelo link do acesso da escola montada, com uma chave nova. */
function reivindicacao(escola: EscolaMontada, nome: NomeParaReivindicar, caminho: 'codigo' | 'token' = 'codigo'): Record<string, unknown> {
  const pelo = caminho === 'codigo' ? { codigo: escola.acesso.codigo } : { token: escola.acesso.token }
  return { slug: escola.slug, ...pelo, listaNomeId: nome.id, matricula: nome.matricula, senha: SENHA_DA_SALA, chaveEnvio: chaveNova() }
}

/**
 * As rotas autenticadas novas da A1. 4.0: gerar, ler e revogar o acesso da turma, do professor; o gerar grava
 * `acesso_turma.gerado`, e o revogar `acesso_turma.revogado`. 1.0: renomear e excluir disciplina e turma. Renomear e excluir não gravam
 * auditoria: o RF16 não pede (1_task.md, "Fora do escopo"). 3.0: cadastrar e listar professores, e refazer e revogar o
 * convite de professor; a lista não grava auditoria (são professores, não aluno). 2.0: a prévia, a gravação, o nome
 * avulso, a leitura e a retirada da lista de nomes; a prévia não grava nada, e a leitura grava `turma.lista_lida`. 8.0:
 * os pedidos da turma, que a coordenação lê gravando `turma.reivindicacoes_lidas`; a decisão, que grava
 * `reivindicacao.decidida`; e a turma do aluno, sem auditoria.
 */
const ROTAS_DA_A1: readonly RotaDaA1[] = [
  {
    rota: 'PATCH /v1/disciplinas/:id',
    alvo: (escola) => escola.disciplina,
    alvoDoProfessor: (escola) => escola.disciplinaComVinculo,
    corpo: () => ({ nome: NOME_RENOMEADO }),
    sucesso: 200,
    resposta: disciplinaResponseSchema,
    conflito: (escola) => ({ alvo: escola.disciplina, corpo: { nome: escola.nomes.disciplinaComVinculo } }),
    auditoria: [],
  },
  {
    rota: 'DELETE /v1/disciplinas/:id',
    alvo: (escola) => escola.disciplina,
    alvoDoProfessor: (escola) => escola.disciplinaComVinculo,
    sucesso: 204,
    conflito: (escola) => ({ alvo: escola.disciplinaComVinculo }),
    auditoria: [],
  },
  {
    rota: 'PATCH /v1/turmas/:id',
    alvo: (escola) => escola.turma,
    alvoDoProfessor: (escola) => escola.turmaComVinculo,
    corpo: () => ({ nome: NOME_RENOMEADO }),
    sucesso: 200,
    resposta: turmaResponseSchema,
    conflito: (escola) => ({ alvo: escola.turma, corpo: { nome: escola.nomes.turmaComVinculo } }),
    auditoria: [],
  },
  {
    rota: 'DELETE /v1/turmas/:id',
    alvo: (escola) => escola.turma,
    alvoDoProfessor: (escola) => escola.turmaComVinculo,
    sucesso: 204,
    conflito: (escola) => ({ alvo: escola.turmaComVinculo }),
    auditoria: [],
  },
  {
    rota: 'POST /v1/professores',
    corpo: () => ({ nome: NOME_DO_PROFESSOR, email: `professor-${randomUUID()}@${DOMINIO_DO_EMAIL}` }),
    sucesso: 201,
    resposta: conviteDeProfessorResponseSchema,
    conflito: (escola) => ({ corpo: { nome: NOME_DO_PROFESSOR, email: escola.convidado.email } }),
    auditoria: ['professor.cadastrado', 'convite.criado'],
  },
  {
    rota: 'GET /v1/professores',
    sucesso: 200,
    resposta: listaDeProfessoresResponseSchema,
    auditoria: [],
  },
  {
    rota: 'POST /v1/professores/:usuarioId/convite/refazer',
    alvo: (escola) => escola.convidado.usuarioId,
    corpo: () => ({}),
    sucesso: 201,
    resposta: conviteDeProfessorResponseSchema,
    conflito: (escola) => ({ alvo: escola.convidadoRevogado, corpo: {} }),
    auditoria: ['convite.refeito'],
  },
  {
    rota: 'POST /v1/professores/:usuarioId/convite/revogar',
    alvo: (escola) => escola.convidado.usuarioId,
    corpo: () => ({}),
    sucesso: 204,
    conflito: (escola) => ({ alvo: escola.convidadoAceito, corpo: {} }),
    auditoria: ['convite.revogado'],
  },
  {
    rota: 'POST /v1/turmas/:id/lista/previa',
    alvo: (escola) => escola.turma,
    alvoDoProfessor: (escola) => escola.turmaComVinculo,
    corpo: () => ({ texto: `${NOME_NA_LISTA};${matriculaNova()}` }),
    sucesso: 200,
    resposta: previaDaListaResponseSchema,
    auditoria: [],
  },
  {
    rota: 'POST /v1/turmas/:id/lista',
    alvo: (escola) => escola.turma,
    alvoDoProfessor: (escola) => escola.turmaComVinculo,
    corpo: () => ({ texto: `${NOME_NA_LISTA};${matriculaNova()}` }),
    sucesso: 201,
    resposta: gravacaoDaListaResponseSchema,
    conflito: (escola) => ({ alvo: escola.turma, corpo: { texto: `${NOME_NA_LISTA};${escola.lista.matriculaLivre}` } }),
    auditoria: ['lista.gravada'],
  },
  {
    rota: 'POST /v1/turmas/:id/lista/nome',
    alvo: (escola) => escola.turma,
    alvoDoProfessor: (escola) => escola.turmaComVinculo,
    corpo: () => ({ nome: NOME_NA_LISTA, matricula: matriculaNova() }),
    sucesso: 201,
    resposta: nomeDaListaSchema,
    conflito: (escola) => ({ alvo: escola.turma, corpo: { nome: NOME_NA_LISTA, matricula: escola.lista.matriculaLivre } }),
    auditoria: ['lista.gravada'],
  },
  {
    rota: 'GET /v1/turmas/:id/lista?finalidade=conferencia_de_cadastro',
    alvo: (escola) => escola.turmaComVinculo,
    alvoDoProfessor: (escola) => escola.turmaComVinculo,
    sucesso: 200,
    resposta: listaDaTurmaResponseSchema,
    auditoria: ['turma.lista_lida'],
  },
  {
    rota: 'DELETE /v1/lista-nomes/:id',
    alvo: (escola) => escola.lista.livre,
    sucesso: 204,
    conflito: (escola) => ({ alvo: escola.lista.reivindicado }),
    auditoria: ['lista_nome.retirado'],
  },
  {
    rota: 'POST /v1/turmas/:id/acesso',
    autor: 'professor',
    alvo: (escola) => escola.turmaComVinculo,
    alvoSemVinculo: (escola) => escola.turma,
    corpo: () => ({ validadeDias: 7 }),
    sucesso: 201,
    resposta: acessoGeradoResponseSchema,
    auditoria: ['acesso_turma.gerado'],
  },
  {
    rota: 'GET /v1/turmas/:id/acesso',
    autor: 'professor',
    alvo: (escola) => escola.turmaComVinculo,
    alvoSemVinculo: (escola) => escola.turma,
    sucesso: 200,
    resposta: acessoDaTurmaResponseSchema,
    auditoria: [],
  },
  {
    rota: 'POST /v1/turmas/:id/acesso/revogar',
    autor: 'professor',
    alvo: (escola) => escola.turmaComVinculo,
    alvoSemVinculo: (escola) => escola.turma,
    corpo: () => ({}),
    sucesso: 204,
    auditoria: ['acesso_turma.revogado'],
  },
  {
    rota: 'POST /v1/salas/abrir',
    anonima: true,
    corpo: (escola) => ({ slug: escola.slug, codigo: escola.acesso.codigo }),
    outrosSucessos: (escola) => [{ slug: escola.slug, token: escola.acesso.token }],
    inexistentes: (escola) => [
      { slug: escola.slug, codigo: escola.semAcesso.codigo },
      { slug: escola.slug, token: escola.semAcesso.token },
    ],
    sucesso: 200,
    resposta: salaAbertaResponseSchema,
    auditoria: [],
  },
  {
    rota: 'POST /v1/salas/reivindicar',
    anonima: true,
    corpo: (escola) => reivindicacao(escola, escola.lista.paraReivindicar[0]),
    outrosSucessos: (escola) => [reivindicacao(escola, escola.lista.paraReivindicar[1], 'token')],
    inexistentes: (escola) => [
      { ...reivindicacao(escola, escola.lista.paraReivindicar[0]), codigo: escola.semAcesso.codigo },
      { ...reivindicacao(escola, escola.lista.paraReivindicar[0], 'token'), token: escola.semAcesso.token },
    ],
    recusas: (escola) => [
      { ...reivindicacao(escola, escola.lista.paraReivindicar[0]), matricula: escola.lista.matriculaLivre },
      { ...reivindicacao(escola, escola.lista.paraReivindicar[0], 'token'), listaNomeId: randomUUID() },
      reivindicacao(escola, { id: escola.lista.reivindicado, matricula: escola.lista.matriculaReivindicada }),
    ],
    sucesso: 200,
    resposta: reivindicacaoResponseSchema,
    auditoria: [],
  },
  {
    rota: `GET /v1/turmas/:id/reivindicacoes?finalidade=${FINALIDADE}`,
    alvo: (escola) => escola.turmaComVinculo,
    abertaAoProfessor: true,
    alvoSemVinculo: (escola) => escola.turma,
    sucesso: 200,
    resposta: pedidosDaTurmaResponseSchema,
    auditoria: ['turma.reivindicacoes_lidas'],
  },
  {
    rota: 'POST /v1/reivindicacoes/decidir',
    abertaAoProfessor: true,
    corpo: (escola) => ({ ids: [escola.pedidoPendente], decisao: 'aprovar' }),
    sucesso: 200,
    resposta: decisaoResponseSchema,
    auditoria: ['reivindicacao.decidida'],
  },
  {
    rota: 'GET /v1/minha-turma',
    autor: 'aluno',
    sucesso: 200,
    resposta: minhaTurmaResponseSchema,
    auditoria: [],
  },
]

/** A sessão que chama a rota com sucesso: a da coordenação, ou a do professor ou do aluno na rota dele. */
const autorDa = (rota: RotaDaA1, escola: EscolaMontada): SessaoDeTeste => (rota.autor === 'professor' ? escola.professor : rota.autor === 'aluno' ? escola.aluno : escola.coordenacao)

describe('escola montada (A1): as varreduras transversais sobre as rotas novas', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  let api: ApiDeTeste
  /** A escola B: só é alvo de pedidos da A, e nunca muda. */
  let b: EscolaMontada

  async function criado(resposta: Promise<RespostaHttp>, status = 201): Promise<string> {
    const lida = await resposta
    expect(lida.status).toBe(status)
    return lida.corpo['id'] as string
  }

  async function montar(): Promise<EscolaMontada> {
    const escolaId = await bancada.escola()
    const coordenacao = await bancada.sessao(escolaId, 'coordenador')
    const professor = await bancada.sessao(escolaId, 'professor')
    const aluno = await bancada.sessao(escolaId, 'aluno')
    const sufixo = randomUUID().slice(0, 8)
    const matricula = `sentinela-matricula-${sufixo}`
    const senhaHash = `sentinela-hash-${randomUUID()}`
    await bancada.alunosComMatricula(escolaId, [{ matricula, senhaHash }])
    const post = (caminho: string, corpo?: unknown) => chamar(api.url, 'POST', caminho, coordenacao.token, corpo)
    const ano = await criado(post('/v1/anos-letivos', { ano: 2026, inicio: '2026-02-01', fim: '2026-12-15' }))
    await criado(post(`/v1/anos-letivos/${ano}/abrir`), 200)
    const serie = await criado(post('/v1/series', { etapa: 'ef_anos_finais', ano: 8 }))
    // Em minúsculas, pelo mesmo motivo do `NOME_RENOMEADO`.
    const nomes = {
      disciplina: `disciplina ${sufixo}`,
      disciplinaComVinculo: `com vínculo ${sufixo}`,
      turma: `turma ${sufixo}`,
      turmaComVinculo: `turma vinc ${sufixo}`,
      nomeLivre: `livre ${sufixo}`,
      nomeReivindicado: `reivindicado ${sufixo}`,
    }
    const disciplina = await criado(post('/v1/disciplinas', { nome: nomes.disciplina }))
    const disciplinaComVinculo = await criado(post('/v1/disciplinas', { nome: nomes.disciplinaComVinculo }))
    const turma = await criado(post('/v1/turmas', { serieId: serie, nome: nomes.turma }))
    const turmaComVinculo = await criado(post('/v1/turmas', { serieId: serie, nome: nomes.turmaComVinculo }))
    const vinculo = await criado(post('/v1/vinculos', { usuarioId: professor.usuarioId, turmaId: turmaComVinculo, disciplinaId: disciplinaComVinculo, papel: 'professor' }))
    await criado(chamar(api.url, 'POST', `/v1/vinculos/${vinculo}/confirmar`, professor.token), 200)
    const matriculaLivre = matriculaNova()
    const matriculaReivindicada = matriculaNova()
    const matriculasParaReivindicar = [matriculaNova(), matriculaNova()] as const
    const linhas = [
      `${nomes.nomeLivre};${matriculaLivre}`,
      `${nomes.nomeReivindicado};${matriculaReivindicada}`,
      ...matriculasParaReivindicar.map((matricula) => `${NOME_NA_LISTA};${matricula}`),
    ]
    await criado(post(`/v1/turmas/${turmaComVinculo}/lista`, { texto: linhas.join('\n') }))
    const { rows: daLista } = await bancada.pool.query<{ id: string; matricula: string }>('select id, matricula from lista_nome where escola_id = $1', [escolaId])
    const idDa = (matricula: string): string => {
      const id = daLista.find((linha) => linha.matricula === matricula)?.id
      if (id === undefined) throw new Error('nome da lista não gravado')
      return id
    }
    const convidar = async () => {
      const email = `professor-${randomUUID()}@${DOMINIO_DO_EMAIL}`
      const resposta = await post('/v1/professores', { nome: NOME_DO_PROFESSOR, email })
      expect(resposta.status).toBe(201)
      return { email, ...conviteDeProfessorResponseSchema.parse(resposta.corpo) }
    }
    const convidado = await convidar()
    const revogado = await convidar()
    await criado(post(`/v1/professores/${revogado.usuarioId}/convite/revogar`, {}), 204)
    const aceito = await convidar()
    const aceite = await fetch(`${api.url}/v1/convites/aceitar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: aceito.token, senha: SENHA_DO_ACEITE }) })
    expect(aceite.status).toBe(200)
    const gerado = await chamar(api.url, 'POST', `/v1/turmas/${turmaComVinculo}/acesso`, professor.token, { validadeDias: 7 })
    expect(gerado.status).toBe(201)
    const acesso = acessoGeradoResponseSchema.parse(gerado.corpo)
    const slug = await bancada.slugDe(escolaId)
    // O nome reivindicado nasce pela sala (6.0), com o pedido pendente.
    const pedido = { slug, codigo: acesso.codigo, listaNomeId: idDa(matriculaReivindicada), matricula: matriculaReivindicada, senha: SENHA_DA_SALA, chaveEnvio: chaveNova() }
    expect((await chamar(api.url, 'POST', '/v1/salas/reivindicar', undefined, pedido)).status).toBe(200)
    const { rows: pedidos } = await bancada.pool.query<{ id: string }>(`select id from reivindicacao where escola_id = $1 and estado = 'pendente'`, [escolaId])
    const pedidoPendente = pedidos[0]?.id
    if (pedidoPendente === undefined || pedidos.length !== 1) throw new Error('pedido pendente não gravado')
    // O aluno da escola montada tem vínculo confirmado na `turmaComVinculo`: é a turma que ele vê (8.0).
    await bancada.pool.query(
      `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())`,
      [escolaId, ano, aluno.usuarioId, turmaComVinculo, coordenacao.usuarioId],
    )
    return {
      escolaId,
      slug,
      coordenacao,
      professor,
      aluno,
      disciplina,
      turma,
      disciplinaComVinculo,
      turmaComVinculo,
      nomes,
      matricula,
      senhaHash,
      pedidoPendente,
      convidado: { usuarioId: convidado.usuarioId, email: convidado.email, token: convidado.token },
      convidadoRevogado: revogado.usuarioId,
      convidadoAceito: aceito.usuarioId,
      lista: {
        livre: idDa(matriculaLivre),
        reivindicado: idDa(matriculaReivindicada),
        matriculaLivre,
        matriculaReivindicada,
        paraReivindicar: [
          { id: idDa(matriculasParaReivindicar[0]), matricula: matriculasParaReivindicar[0] },
          { id: idDa(matriculasParaReivindicar[1]), matricula: matriculasParaReivindicar[1] },
        ],
      },
      acesso: { token: acesso.token, codigo: acesso.codigo },
      semAcesso: { token: randomBytes(32).toString('base64url'), codigo: sortearCodigoDaTurma() },
    }
  }

  /** O que a escola tem nas tabelas que as rotas da A1 escrevem, e a auditoria dela. As tarefas seguintes somam as tabelas delas. */
  async function estadoDe(escola: EscolaMontada): Promise<unknown> {
    const linhas = async (consulta: string) => (await bancada.pool.query(consulta, [escola.escolaId])).rows
    return {
      disciplinas: await linhas('select id, nome, area from disciplina where escola_id = $1 order by id'),
      turmas: await linhas('select id, ano_letivo_id, serie_id, nome, turno from turma where escola_id = $1 order by id'),
      vinculos: await linhas('select id, turma_id, disciplina_id, estado from vinculo where escola_id = $1 order by id'),
      usuarios: await linhas('select id, conta_id, papel, nome, desativado_em from usuario where escola_id = $1 order by id'),
      convites: await linhas('select id, tipo, usuario_id, expira_em, usado_em, revogado_em from convite where escola_id = $1 order by id'),
      lista: await linhas('select id, turma_id, nome, matricula, estado, usuario_id, criado_por from lista_nome where escola_id = $1 order by id'),
      acessos: await linhas('select id, turma_id, token_hash, codigo_hmac, validade_dias, expira_em, revogado_em, criado_por from acesso_turma where escola_id = $1 order by id'),
      pedidos: await linhas(
        'select id, turma_id, lista_nome_id, chave_envio, senha_hash, teve_matricula_errada, estado, decidida_em, decidida_por, decidida_como from reivindicacao where escola_id = $1 order by id',
      ),
      credenciais: await linhas('select id, usuario_id, matricula, senha_hash from credencial_matricula where escola_id = $1 order by id'),
      auditoria: await linhas('select id from auditoria where escola_id = $1 order by id'),
    }
  }

  /** Chama a rota com o id no lugar do parâmetro do caminho, se ela tem um; a anônima, sem token. */
  function pedir(rota: RotaDaA1, sessao: SessaoDeTeste, alvo: string | undefined, corpo?: Record<string, unknown>): Promise<RespostaHttp> {
    const [verbo, caminho] = rota.rota.split(' ') as [string, string]
    const endereco = alvo === undefined ? caminho : caminho.replace(/:[A-Za-z]+/, alvo)
    return chamar(api.url, verbo, endereco, rota.anonima === true ? undefined : sessao.token, corpo, { 'X-Forwarded-For': IP_DO_PEDIDO })
  }

  /** O sucesso da rota por quem a chama (a coordenação, ou o professor na rota dele), com o recurso da escola. */
  const comSucesso = (rota: RotaDaA1, escola: EscolaMontada) => pedir(rota, autorDa(rota, escola), rota.alvo?.(escola), rota.corpo?.(escola))

  /** A resposta de erro sem o id da requisição, que muda a cada chamada: o resto precisa ser idêntico. */
  function semRequisicao(resposta: RespostaHttp): unknown {
    const { requisicaoId: _requisicaoId, ...erro } = (resposta.corpo.erro ?? {}) as Record<string, unknown>
    return { status: resposta.status, corpo: { ...resposta.corpo, erro } }
  }

  const NAO_ENCONTRADO = { status: 404, corpo: { erro: { codigo: ErrorCode.NAO_ENCONTRADO, mensagem: MENSAGENS_DE_ERRO.NAO_ENCONTRADO } } }

  /**
   * Cada resposta que a rota dá na escola montada: o sucesso, o 404 do id sorteado, o 400 do campo a mais no corpo (se
   * a rota lê corpo) e o 409 do conflito (se tem). O status de cada uma é conferido, para a varredura saber que passou
   * por todas.
   */
  async function variantes(rota: RotaDaA1, escola: EscolaMontada): Promise<Array<{ readonly esperado: number; readonly resposta: RespostaHttp }>> {
    const todas: Array<{ esperado: number; resposta: RespostaHttp }> = []
    if (rota.conflito !== undefined) {
      const { alvo, corpo } = rota.conflito(escola)
      todas.push({ esperado: 409, resposta: await pedir(rota, autorDa(rota, escola), alvo, corpo) })
    }
    if (rota.corpo !== undefined) {
      todas.push({ esperado: 400, resposta: await pedir(rota, autorDa(rota, escola), rota.alvo?.(escola), { ...rota.corpo(escola), escolaId: escola.escolaId }) })
    }
    if (rota.alvo !== undefined) todas.push({ esperado: 404, resposta: await pedir(rota, autorDa(rota, escola), randomUUID(), rota.corpo?.(escola)) })
    for (const corpo of rota.inexistentes?.(escola) ?? []) todas.push({ esperado: 404, resposta: await pedir(rota, autorDa(rota, escola), undefined, corpo) })
    for (const corpo of rota.recusas?.(escola) ?? []) todas.push({ esperado: 409, resposta: await pedir(rota, autorDa(rota, escola), undefined, corpo) })
    for (const corpo of rota.outrosSucessos?.(escola) ?? []) todas.push({ esperado: rota.sucesso, resposta: await pedir(rota, autorDa(rota, escola), undefined, corpo) })
    todas.push({ esperado: rota.sucesso, resposta: await comSucesso(rota, escola) })
    for (const { esperado, resposta } of todas) expect(resposta.status, `${rota.rota} ${String(esperado)}`).toBe(esperado)
    return todas
  }

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, { ambiente: { LIMITE_PROXIES_CONFIAVEIS: '127.0.0.1' } }, linhasDeLog)
    b = await montar()
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  it('a lista das rotas é a da spec, sem repetição; a rota com parâmetro de id no caminho tem o alvo, e só ela', () => {
    const rotas = ROTAS_DA_A1.map((rota) => rota.rota)
    expect(new Set(rotas).size).toBe(rotas.length)
    for (const rota of ROTAS_DA_A1) {
      expect(rota.rota, rota.rota).toMatch(/^(GET|POST|PATCH|DELETE) \/v1\/[^ ]*$/)
      expect(/\/:[A-Za-z]+(\/|$)/.test(rota.rota), rota.rota).toBe(rota.alvo !== undefined)
    }
  })

  describe('I3: o recurso da escola B pedido por quem chama a rota em A responde como o id sorteado, e B não muda', () => {
    for (const rota of ROTAS_DA_A1) {
      const alvo = rota.alvo
      if (alvo === undefined) continue
      it(rota.rota, async () => {
        const a = await montar()
        const antesEmB = await estadoDe(b)

        const autor = autorDa(rota, a)
        const comIdDeB = await pedir(rota, autor, alvo(b), rota.corpo?.(a))
        const comSorteado = await pedir(rota, autor, randomUUID(), rota.corpo?.(a))
        const foraDoFormato = await pedir(rota, autor, 'nao-e-um-id', rota.corpo?.(a))
        expect(semRequisicao(comIdDeB)).toEqual(NAO_ENCONTRADO)
        expect(semRequisicao(comSorteado)).toEqual(semRequisicao(comIdDeB))
        expect(semRequisicao(foraDoFormato)).toEqual(semRequisicao(comIdDeB))
        expect(await estadoDe(b)).toEqual(antesEmB)

        expect((await comSucesso(rota, a)).status).toBe(rota.sucesso)
      })
    }
  })

  describe('P1: quem a célula não abre recebe o 404 do inexistente, com o recurso da própria escola, e nada muda', () => {
    for (const rota of ROTAS_DA_A1) {
      if (rota.anonima === true) continue
      it(rota.rota, async () => {
        const a = await montar()
        const antes = await estadoDe(a)

        // Na rota da coordenação, o professor e o aluno; na do professor, a coordenação, o aluno e o professor na turma em
        // que ele não tem vínculo; na aberta ao professor, o aluno e o professor sem vínculo; na do aluno, a coordenação e o
        // professor (P4).
        const semVinculo = (): Array<readonly [string, SessaoDeTeste, string | undefined]> =>
          rota.alvoSemVinculo === undefined ? [] : [['professor sem vínculo na turma', a.professor, rota.alvoSemVinculo(a)]]
        const tentativas: Array<readonly [string, SessaoDeTeste, string | undefined]> =
          rota.autor === 'professor'
            ? [['coordenação', a.coordenacao, rota.alvo?.(a)], ['aluno', a.aluno, rota.alvo?.(a)], ...semVinculo()]
            : rota.autor === 'aluno'
              ? [
                  ['coordenação', a.coordenacao, rota.alvo?.(a)],
                  ['professor', a.professor, rota.alvo?.(a)],
                ]
              : rota.abertaAoProfessor === true
                ? [['aluno', a.aluno, rota.alvo?.(a)], ...semVinculo()]
                : [
                    ['professor', a.professor, rota.alvo?.(a)],
                    ['aluno', a.aluno, rota.alvo?.(a)],
                  ]
        if (rota.alvoDoProfessor !== undefined) tentativas.push(['professor com vínculo confirmado', a.professor, rota.alvoDoProfessor(a)])
        for (const [quem, sessao, alvo] of tentativas) {
          expect(semRequisicao(await pedir(rota, sessao, alvo, rota.corpo?.(a))), quem).toEqual(NAO_ENCONTRADO)
        }
        expect(await estadoDe(a)).toEqual(antes)

        expect((await comSucesso(rota, a)).status).toBe(rota.sucesso)
      })
    }
  })

  describe('A1: o sucesso grava exatamente a auditoria que a spec pede, com autor e escola, só com ids e contagens', () => {
    for (const rota of ROTAS_DA_A1) {
      it(`${rota.rota}: ${rota.auditoria.length === 0 ? 'nenhum registro' : rota.auditoria.join(', ')}`, async () => {
        const a = await montar()
        const { rows: marco } = await bancada.pool.query<{ agora: Date }>('select clock_timestamp() as agora')

        expect((await comSucesso(rota, a)).status).toBe(rota.sucesso)

        const { rows } = await bancada.pool.query<{ acao: string; autor_usuario_id: string | null; antes: Record<string, unknown> | null; depois: Record<string, unknown> | null }>(
          'select acao, autor_usuario_id, antes, depois from auditoria where escola_id = $1 and em >= $2 order by id',
          [a.escolaId, marco[0]?.agora],
        )
        expect(rows.map((linha) => linha.acao)).toEqual(rota.auditoria)
        for (const linha of rows) {
          expect(linha.autor_usuario_id, linha.acao).toBe(autorDa(rota, a).usuarioId)
          const campos = [...Object.keys(linha.antes ?? {}), ...Object.keys(linha.depois ?? {})].map((campo) => campo.toLowerCase())
          for (const proibido of CAMPOS_PROIBIDOS_NA_AUDITORIA) expect(campos.filter((campo) => campo.includes(proibido)), linha.acao).toEqual([])
        }
      })
    }
  })

  describe('A3: nenhuma resposta traz token, matrícula, hash ou e-mail, nem campo fora do contrato', () => {
    for (const rota of ROTAS_DA_A1) {
      it(rota.rota, async () => {
        const a = await montar()
        // O token do convite só sai na resposta que o cria: o do professor convidado na montagem, em nenhuma destas.
        // O link e o código do acesso da montagem também: só a resposta do gerar que os criou os traz.
        const sentinelas = [a.coordenacao.token, a.professor.token, a.aluno.token, a.matricula, a.senhaHash, a.convidado.token, DOMINIO_DO_EMAIL, a.acesso.token, a.acesso.codigo, SENHA_DA_SALA]
        // A página pública da sala (5.0) mostra os nomes livres, e nunca a matrícula de nenhum nem o nome reivindicado; a
        // reivindicação (6.0) não devolve a matrícula, o nome, a chave nem o hash do pedido.
        if (rota.anonima === true) sentinelas.push(a.lista.matriculaLivre, a.lista.matriculaReivindicada, a.nomes.nomeReivindicado, ...a.lista.paraReivindicar.map((nome) => nome.matricula))
        const chavesAntes = CHAVES_DE_ENVIO.length

        const respostas = await variantes(rota, a)
        const { rows: hashesGravados } = await bancada.pool.query<{ senha_hash: string }>('select senha_hash from reivindicacao where escola_id = $1 and senha_hash is not null', [a.escolaId])
        sentinelas.push(...CHAVES_DE_ENVIO.slice(chavesAntes), ...hashesGravados.map((linha) => linha.senha_hash))
        for (const { esperado, resposta } of respostas) {
          const texto = JSON.stringify(resposta.corpo)
          for (const sentinela of sentinelas) expect(texto, `${rota.rota} ${String(esperado)}`).not.toContain(sentinela)
          if (esperado >= 400) {
            expect(Object.keys(resposta.corpo), `${rota.rota} ${String(esperado)}`).toEqual(['erro'])
            expect(Object.keys(resposta.corpo.erro ?? {}).sort(), `${rota.rota} ${String(esperado)}`).toEqual(['codigo', 'mensagem', 'requisicaoId'])
          } else if (rota.resposta === undefined) {
            expect(resposta.corpo, rota.rota).toEqual({})
          } else {
            // Estrito: campo a mais na resposta reprova, em vez de ser descartado.
            expect(rota.resposta.safeParse(resposta.corpo).success, rota.rota).toBe(true)
          }
        }
      })
    }
  })

  it('A4: o log das rotas novas, no sucesso e em cada erro, não tem nome, matrícula, hash, token, código da turma, e-mail, o endereço da escola nem o IP', async () => {
    const escolas = await Promise.all(ROTAS_DA_A1.map(() => montar()))
    linhasDeLog.length = 0
    let erros = 0
    /** Os tokens de convite e de link da sala, e os códigos da turma, que as respostas de sucesso devolveram: nenhum vai a log. */
    const tokensDevolvidos: string[] = []
    const codigosDevolvidos: string[] = []
    for (const [posicao, rota] of ROTAS_DA_A1.entries()) {
      const escola = escolas[posicao]
      if (escola === undefined) throw new Error('escola não montada')
      const respostas = await variantes(rota, escola)
      erros += respostas.filter(({ esperado }) => esperado >= 400).length
      for (const { resposta } of respostas) {
        if (typeof resposta.corpo['token'] === 'string') tokensDevolvidos.push(resposta.corpo['token'])
        if (typeof resposta.corpo['codigo'] === 'string') codigosDevolvidos.push(resposta.corpo['codigo'])
      }
    }
    // As senhas da reivindicação que o banco guardou, em hash: nem elas vão a log.
    const { rows: hashesGravados } = await bancada.pool.query<{ senha_hash: string }>('select senha_hash from reivindicacao where escola_id = any($1::uuid[]) and senha_hash is not null', [
      escolas.map((escola) => escola.escolaId),
    ])
    expect(hashesGravados.length).toBeGreaterThan(escolas.length)
    // O cadastro, o refazer e o gerar acesso devolveram o token deles, e o gerar o código: sem isso, a busca abaixo não
    // teria o que procurar.
    const devolvemToken = [conviteDeProfessorResponseSchema, acessoGeradoResponseSchema] as z.ZodType[]
    expect(tokensDevolvidos.length).toBe(ROTAS_DA_A1.filter((rota) => rota.resposta !== undefined && devolvemToken.includes(rota.resposta)).length)
    expect(codigosDevolvidos.length).toBe(ROTAS_DA_A1.filter((rota) => rota.resposta === acessoGeradoResponseSchema).length)

    const linhas = linhasDeLog.map((linha) => JSON.parse(linha) as Record<string, unknown>)
    // O log capturou os erros: sem isso, a busca abaixo passaria num log mudo.
    expect(linhas.filter((linha) => linha['evento'] === 'http.erro')).toHaveLength(erros)
    const todoOLog = linhasDeLog.join('\n')
    // A chave do HMAC do código da turma na API de teste: o log não tem o código digitado nem o HMAC dele.
    const chaveDoCodigo = configuracaoDeTeste().sala.chaveCodigo
    for (const escola of escolas) {
      for (const sentinela of [
        ...Object.values(escola.nomes),
        escola.matricula,
        escola.lista.matriculaLivre,
        escola.lista.matriculaReivindicada,
        ...escola.lista.paraReivindicar.map((nome) => nome.matricula),
        escola.senhaHash,
        escola.slug,
        escola.coordenacao.token,
        escola.professor.token,
        escola.aluno.token,
        escola.convidado.token,
        escola.acesso.token,
        escola.acesso.codigo,
        escola.semAcesso.token,
        escola.semAcesso.codigo,
        // O `sala` calcula o SHA-256 do token do link e o `AcessoDaSala` o recebe: nem ele vai a log (5.0).
        hashDoToken(escola.acesso.token),
        hashDoToken(escola.semAcesso.token),
        // E o HMAC do código, que o `AcessoDaSala` recebe no lugar do código.
        hmacDoCodigoDaTurma(chaveDoCodigo, escola.acesso.codigo),
        hmacDoCodigoDaTurma(chaveDoCodigo, escola.semAcesso.codigo),
      ]) {
        expect(todoOLog).not.toContain(sentinela)
      }
    }
    for (const sentinela of [
      IP_DO_PEDIDO,
      NOME_RENOMEADO,
      NOME_DO_PROFESSOR,
      DOMINIO_DO_EMAIL,
      NOME_NA_LISTA,
      PREFIXO_DA_MATRICULA,
      SENHA_DA_SALA,
      ...CHAVES_DE_ENVIO,
      ...hashesGravados.map((linha) => linha.senha_hash),
      ...tokensDevolvidos,
      ...codigosDevolvidos,
    ]) {
      expect(todoOLog).not.toContain(sentinela)
    }
  })
})
