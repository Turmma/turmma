import { DomainException, runInContext, type DatabaseTransaction } from '@educa/core'
import { CicloDeVidaRepository, CicloDeVidaService } from '@educa/core/ciclo-de-vida'
import { ErrorCode, decisaoResponseSchema, type PapelDeUsuario } from '@educa/shared'
import { sql } from 'drizzle-orm'
import type { Redis } from 'ioredis'
import { randomBytes, randomUUID } from 'node:crypto'
import { Secret, TOTP } from 'otpauth'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { CifraDoSegredo, CLIENTE_REDIS_LOGIN, gerarCodigosDeRecuperacao, gerarSegredo, HashDeSenha, hmacDaRecuperacao } from '../src/credencial/index.js'
import { chamar, subirApi, type ApiDeTeste } from './api-com-sessao.js'
import { configuracaoDeTeste } from './configuracao-de-teste.js'
import { montarEscolaComTurma, type EscolaComTurma } from './escola-com-turma.js'
import { FerramentasDaSala, pedidoDaSala, type NomeDaLista, type SalaDeTeste } from './sala-de-teste.js'
import { BancadaDeSessoes, type SessaoDeTeste } from './sessao-de-teste.js'

/** Senha sintética das contas e dos alunos deste teste: nenhuma é de pessoa real. */
const SENHA = 'senha-sintetica-correta-1'
const OPERADOR = 'operador-teste'

interface Resposta {
  status: number
  corpo: Record<string, unknown> & { erro?: { codigo?: string } }
}

/** Uma pessoa da equipe: a conta global (e-mail e senha) e o usuário dela na primeira escola. */
interface Pessoa {
  email: string
  nome: string
  contaId: string
  usuarioId: string
  escolaId: string
}

interface ContaNoBanco {
  email: string | null
  senha: boolean
  mfaAtivo: boolean
  segredo: boolean
  codigos: number
}

async function clientePronto(cliente: Redis): Promise<void> {
  const prazo = performance.now() + 15_000
  while (cliente.status !== 'ready') {
    if (performance.now() > prazo) throw new Error('o cliente do Redis de fila do login não conectou')
    await new Promise((resolver) => setTimeout(resolver, 20))
  }
}

describe('ciclo de vida da conta: desativação, limpeza da conta global e eliminação por escola (17.1)', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  const configuracao = configuracaoDeTeste()
  const cifra = new CifraDoSegredo(configuracao.login.mfa.versaoCifra, configuracao.login.mfa.chavesCifra)
  const servico = new CicloDeVidaService(bancada.banco)
  let api: ApiDeTeste
  let hashDaSenha: string

  beforeAll(async () => {
    api = await subirApi(medidor.medidor)
    const hash = api.app.get(HashDeSenha)
    await clientePronto(api.app.get<Redis>(CLIENTE_REDIS_LOGIN, { strict: false }))
    hashDaSenha = await hash.gerar(SENHA)
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  /** Como a coordenação chamaria pela tela do F2: no contexto da sessão dela, com a escola e o autor. */
  const pela = <T>(coordenacao: SessaoDeTeste, acao: () => Promise<T>): Promise<T> =>
    runInContext({ requisicaoId: randomUUID(), escolaId: coordenacao.escolaId, usuarioId: coordenacao.usuarioId, papel: 'coordenador' }, acao)

  /** Como o operador chamaria por comando, a pedido formal da escola: sem usuário no contexto. */
  const peloOperador = <T>(escolaId: string, acao: () => Promise<T>): Promise<T> => runInContext({ requisicaoId: randomUUID(), escolaId }, acao)

  async function esperarNaoEncontrado(acao: Promise<unknown>): Promise<void> {
    const erro: unknown = await acao.then(
      () => undefined,
      (motivo: unknown) => motivo,
    )
    expect(erro).toBeInstanceOf(DomainException)
    expect((erro as DomainException).codigo).toBe(ErrorCode.NAO_ENCONTRADO)
  }

  async function pessoa(escolaId: string, papel: PapelDeUsuario = 'professor'): Promise<Pessoa> {
    const email = `equipe-${randomUUID()}@escola.invalid`
    const nome = `Pessoa sintética ${randomUUID().slice(0, 8)}`
    const { rows: contas } = await bancada.pool.query<{ id: string }>('insert into conta (email, senha_hash) values ($1, $2) returning id', [email, hashDaSenha])
    const contaId = contas[0]?.id ?? ''
    const { rows } = await bancada.pool.query<{ id: string }>('insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, $3, $4) returning id', [escolaId, contaId, papel, nome])
    return { email, nome, contaId, usuarioId: rows[0]?.id ?? '', escolaId }
  }

  /** O usuário da mesma conta em outra escola: a professora que dá aula em duas. */
  async function naOutraEscola(quem: Pessoa, escolaId: string, papel: PapelDeUsuario = 'professor'): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>('insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, $3, $4) returning id', [escolaId, quem.contaId, papel, quem.nome])
    return rows[0]?.id ?? ''
  }

  async function alunoComMatricula(escolaId: string, matricula: string): Promise<string> {
    const [usuarioId] = await bancada.alunosComMatricula(escolaId, [{ matricula, senhaHash: hashDaSenha }])
    if (usuarioId === undefined) throw new Error('aluno não criado')
    return usuarioId
  }

  async function ligarContaExterna(escolaId: string, usuarioId: string): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>("insert into conta_externa (escola_id, usuario_id, provedor, sujeito) values ($1, $2, 'google', $3) returning id", [
      escolaId,
      usuarioId,
      `sujeito-${randomUUID()}`,
    ])
    return rows[0]?.id ?? ''
  }

  async function comMfaAtivo(quem: Pessoa): Promise<string> {
    const novo = gerarSegredo()
    const { cifrado, versao } = cifra.cifrar(novo.bytes, quem.contaId)
    await bancada.pool.query('update conta set mfa_segredo_cifrado = $1, mfa_chave_versao = $2, mfa_ativado_em = now(), mfa_ultimo_passo = null where id = $3', [cifrado, versao, quem.contaId])
    for (const codigo of gerarCodigosDeRecuperacao()) {
      await bancada.pool.query('insert into codigo_recuperacao (conta_id, hmac) values ($1, $2)', [quem.contaId, hmacDaRecuperacao(configuracao.login.mfa.chaveRecuperacao, codigo)])
    }
    return novo.base32
  }

  async function postar(caminho: string, corpo: unknown, autorizacao?: string): Promise<Resposta> {
    const resposta = await fetch(`${api.url}${caminho}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(autorizacao === undefined ? {} : { Authorization: `Bearer ${autorizacao}` }) },
      body: JSON.stringify(corpo),
    })
    const texto = await resposta.text()
    return { status: resposta.status, corpo: texto === '' ? {} : (JSON.parse(texto) as Resposta['corpo']) }
  }

  const entrarPorEmail = (email: string) => postar('/v1/sessao/email', { email, senha: SENHA })
  const entrarPorMatricula = async (escolaId: string, matricula: string) => postar('/v1/sessao/matricula', { slug: await bancada.slugDe(escolaId), matricula, senha: SENHA })

  /** A pessoa entra por e-mail e, com mais de uma escola, escolhe o usuário: devolve o token de acesso. */
  async function entrarComo(quem: Pessoa, usuarioId: string): Promise<string> {
    const login = await entrarPorEmail(quem.email)
    expect(login.status).toBe(200)
    if (login.corpo['etapa'] === 'pronta') return String(login.corpo['token'])
    expect(login.corpo['etapa']).toBe('escolher')
    const escolhido = await postar('/v1/sessao/escola', { usuarioId }, String(login.corpo['desafio']))
    expect(escolhido.corpo['etapa']).toBe('pronta')
    return String(escolhido.corpo['token'])
  }

  async function tokenDoAluno(escolaId: string, matricula: string): Promise<string> {
    const login = await entrarPorMatricula(escolaId, matricula)
    expect(login.corpo['etapa']).toBe('pronta')
    return String(login.corpo['token'])
  }

  const statusDoEu = async (token: string) => (await chamar(api.url, 'GET', '/v1/eu', token)).status

  async function contaNoBanco(contaId: string): Promise<ContaNoBanco> {
    const { rows } = await bancada.pool.query<{ email: string | null; senha: boolean; mfa_ativo: boolean; segredo: boolean; codigos: string }>(
      `select email, senha_hash is not null as senha, mfa_ativado_em is not null as mfa_ativo, mfa_segredo_cifrado is not null as segredo,
              (select count(*) from codigo_recuperacao c where c.conta_id = conta.id) as codigos
       from conta where id = $1`,
      [contaId],
    )
    const [linha] = rows
    if (linha === undefined) throw new Error('conta não encontrada')
    return { email: linha.email, senha: linha.senha, mfaAtivo: linha.mfa_ativo, segredo: linha.segredo, codigos: Number(linha.codigos) }
  }

  async function sessoesDe(escolaId: string, usuarioId: string): Promise<Array<{ encerrada: boolean; motivo: string | null }>> {
    const { rows } = await bancada.pool.query<{ encerrada: boolean; motivo: string | null }>(
      'select encerrada_em is not null as encerrada, motivo from sessao where escola_id = $1 and usuario_id = $2 order by id',
      [escolaId, usuarioId],
    )
    return rows
  }

  async function contar(tabela: 'usuario' | 'credencial_matricula' | 'conta_externa' | 'vinculo' | 'sessao' | 'registro_acesso', escolaId: string, usuarioId: string): Promise<number> {
    const coluna = tabela === 'usuario' ? 'id' : 'usuario_id'
    const { rows } = await bancada.pool.query<{ total: string }>(`select count(*) as total from ${tabela} where escola_id = $1 and ${coluna} = $2`, [escolaId, usuarioId])
    return Number(rows[0]?.total)
  }

  async function auditoriaDoCiclo(escolaId: string): Promise<Array<Record<string, unknown>>> {
    const { rows } = await bancada.pool.query(
      `select acao, entidade, entidade_id, autor_usuario_id, autor_operador, antes, depois, finalidade, em from auditoria
       where escola_id = $1 and acao in ('usuario.desativado', 'usuario.eliminado', 'conta_externa.desligada') order by em, id`,
      [escolaId],
    )
    return rows
  }

  /** O vínculo de professor pela API: a coordenação cria, e o professor confirma com o token dele. */
  async function vinculoConfirmado(escola: EscolaComTurma, usuarioId: string, tokenDoProfessor: string, coordenacao = escola.coordenacao): Promise<string> {
    const criado = await chamar(api.url, 'POST', '/v1/vinculos', coordenacao.token, { usuarioId, turmaId: escola.turma, disciplinaId: escola.quimica, papel: 'professor' })
    expect(criado.status).toBe(201)
    const id = String(criado.corpo['id'])
    expect((await chamar(api.url, 'POST', `/v1/vinculos/${id}/confirmar`, tokenDoProfessor)).status).toBe(200)
    return id
  }

  it('caminho feliz (RF5; regra 20, item 18): o aluno desativado tem o hash da senha apagado, a sessão aberta dá 401 na requisição seguinte, e o colega segue entrando', async () => {
    const escolaId = await bancada.escola()
    const coordenacao = await bancada.sessao(escolaId, 'coordenador')
    const matricula = `RA${randomBytes(4).toString('hex')}`
    const enzo = await alunoComMatricula(escolaId, matricula)
    const matriculaDoColega = `RA${randomBytes(4).toString('hex')}`
    await alunoComMatricula(escolaId, matriculaDoColega)
    const contaExterna = await ligarContaExterna(escolaId, enzo)
    const tokenDoEnzo = await tokenDoAluno(escolaId, matricula)
    const tokenDoColega = await tokenDoAluno(escolaId, matriculaDoColega)
    expect(await statusDoEu(tokenDoEnzo)).toBe(200)

    await pela(coordenacao, () => servico.desativar(enzo))

    expect(await statusDoEu(tokenDoEnzo)).toBe(401)
    expect(await statusDoEu(tokenDoColega)).toBe(200)
    expect(await sessoesDe(escolaId, enzo)).toEqual([{ encerrada: true, motivo: 'desativacao' }])
    // A matrícula fica (registro escolar); o hash sai, e a conta Google ligada também.
    const { rows: credencial } = await bancada.pool.query('select matricula, senha_hash from credencial_matricula where escola_id = $1 and usuario_id = $2', [escolaId, enzo])
    expect(credencial).toEqual([{ matricula, senha_hash: null }])
    expect(await contar('conta_externa', escolaId, enzo)).toBe(0)
    expect((await bancada.pool.query('select 1 from conta_externa where id = $1', [contaExterna])).rowCount).toBe(0)
    // A senha certa não entra mais: a mesma resposta da senha errada.
    const deNovo = await entrarPorMatricula(escolaId, matricula)
    expect(deNovo.status).toBe(401)
    expect(deNovo.corpo.erro?.codigo).toBe(ErrorCode.NAO_AUTENTICADO)
    expect((await entrarPorMatricula(escolaId, matriculaDoColega)).corpo['etapa']).toBe('pronta')
    // Desativar de novo não acha ninguém, e não grava outro registro.
    await esperarNaoEncontrado(pela(coordenacao, () => servico.desativar(enzo)))
    expect(await auditoriaDoCiclo(escolaId)).toHaveLength(1)
  })

  it('borda: o aluno transferido é desativado em A, e a conta nova dele em B, com a mesma matrícula, entra normalmente', async () => {
    const escolaA = await bancada.escola()
    const escolaB = await bancada.escola()
    const coordenacaoDeA = await bancada.sessao(escolaA, 'coordenador')
    const matricula = `RA${randomBytes(4).toString('hex')}`
    const emA = await alunoComMatricula(escolaA, matricula)
    const emB = await alunoComMatricula(escolaB, matricula)
    const tokenEmB = await tokenDoAluno(escolaB, matricula)

    await pela(coordenacaoDeA, () => servico.desativar(emA))

    expect((await entrarPorMatricula(escolaA, matricula)).status).toBe(401)
    expect((await entrarPorMatricula(escolaB, matricula)).corpo['etapa']).toBe('pronta')
    expect(await statusDoEu(tokenEmB)).toBe(200)
    const { rows } = await bancada.pool.query<{ senha: boolean }>('select senha_hash is not null as senha from credencial_matricula where escola_id = $1 and usuario_id = $2', [escolaB, emB])
    expect(rows).toEqual([{ senha: true }])
  })

  it('isolamento: a professora desativada em A, com usuário ativo em B, mantém e-mail e senha e continua entrando em B; desativada também em B, a conta perde e-mail, senha, segredo, códigos e as sessões abertas', async () => {
    const escolaA = await bancada.escola()
    const escolaB = await bancada.escola()
    const coordenacaoDeA = await bancada.sessao(escolaA, 'coordenador')
    const coordenacaoDeB = await bancada.sessao(escolaB, 'coordenador')
    const camila = await pessoa(escolaA)
    const camilaEmB = await naOutraEscola(camila, escolaB)
    const tokenEmA = await entrarComo(camila, camila.usuarioId)
    const tokenAbertoEmB = await entrarComo(camila, camilaEmB)

    // O usuário dela em B, pedido pela coordenação de A: a mesma resposta do id de ninguém, e B segue ativo.
    await esperarNaoEncontrado(pela(coordenacaoDeA, () => servico.desativar(camilaEmB)))
    expect((await bancada.pool.query('select 1 from usuario where id = $1 and desativado_em is null', [camilaEmB])).rowCount).toBe(1)
    await pela(coordenacaoDeA, () => servico.desativar(camila.usuarioId))

    expect(await statusDoEu(tokenEmA)).toBe(401)
    expect(await sessoesDe(escolaA, camila.usuarioId)).toEqual([{ encerrada: true, motivo: 'desativacao' }])
    // A sessão que ela já tinha aberta em B não cai: a conta ainda serve a B.
    expect(await statusDoEu(tokenAbertoEmB)).toBe(200)
    expect(await contaNoBanco(camila.contaId)).toEqual({ email: camila.email, senha: true, mfaAtivo: false, segredo: false, codigos: 0 })
    // Com um usuário ativo só, o login vai direto a B.
    const tokenEmB = await entrarComo(camila, camilaEmB)
    expect((await chamar(api.url, 'GET', '/v1/eu', tokenEmB)).corpo).toMatchObject({ usuarioId: camilaEmB, escola: { id: escolaB } })

    // Em B ela é da coordenação agora, com o MFA e os códigos: tudo isso sai quando a conta não serve a mais ninguém.
    await comMfaAtivo(camila)
    expect(await contaNoBanco(camila.contaId)).toMatchObject({ mfaAtivo: true, segredo: true, codigos: 10 })
    await pela(coordenacaoDeB, () => servico.desativar(camilaEmB))

    expect(await contaNoBanco(camila.contaId)).toEqual({ email: null, senha: false, mfaAtivo: false, segredo: false, codigos: 0 })
    for (const token of [tokenEmB, tokenAbertoEmB]) expect(await statusDoEu(token)).toBe(401)
    const { rows: abertas } = await bancada.pool.query('select 1 from sessao where conta_id = $1 and encerrada_em is null', [camila.contaId])
    expect(abertas).toEqual([])
    expect((await entrarPorEmail(camila.email)).status).toBe(401)
    // Cada escola só diz se a conta foi limpa no registro dela, sem nada da outra.
    expect((await auditoriaDoCiclo(escolaA)).map((linha) => (linha['depois'] as Record<string, unknown>)['contaLimpa'])).toEqual([false])
    expect((await auditoriaDoCiclo(escolaB)).map((linha) => (linha['depois'] as Record<string, unknown>)['contaLimpa'])).toEqual([true])
  })

  it('concorrência: a mesma conta desativada em A e em B ao mesmo tempo termina limpa, uma vez só, em cada uma de cinco contas', async () => {
    const escolaA = await bancada.escola()
    const escolaB = await bancada.escola()
    const coordenacaoDeA = await bancada.sessao(escolaA, 'coordenador')
    const coordenacaoDeB = await bancada.sessao(escolaB, 'coordenador')
    const pessoas = await Promise.all(Array.from({ length: 5 }, async () => {
      const quem = await pessoa(escolaA)
      return { quem, emB: await naOutraEscola(quem, escolaB) }
    }))

    await Promise.all(pessoas.flatMap(({ quem, emB }) => [pela(coordenacaoDeA, () => servico.desativar(quem.usuarioId)), pela(coordenacaoDeB, () => servico.desativar(emB))]))

    const limpas = [...(await auditoriaDoCiclo(escolaA)), ...(await auditoriaDoCiclo(escolaB))].filter((linha) => (linha['depois'] as Record<string, unknown>)['contaLimpa'] === true)
    expect(limpas).toHaveLength(5)
    for (const { quem } of pessoas) expect((await contaNoBanco(quem.contaId)).email).toBeNull()
  })

  it('borda: a conta com um convite ainda válido em outra escola não é limpa quando o último usuário ativo sai; com o convite revogado, expirado ou já usado, é', async () => {
    const escolaA = await bancada.escola()
    const escolaB = await bancada.escola()
    const coordenacaoDeA = await bancada.sessao(escolaA, 'coordenador')
    /** O coordenador convidado em B, inativo, com um convite no estado pedido. O usado é o aceito de quem foi desativado depois. */
    const convidar = async (quem: Pessoa, estado: 'valido' | 'revogado' | 'expirado' | 'usado') => {
      const { rows } = await bancada.pool.query<{ id: string }>(
        "insert into usuario (escola_id, conta_id, papel, nome, desativado_em) values ($1, $2, 'coordenador', $3, now()) returning id",
        [escolaB, quem.contaId, quem.nome],
      )
      await bancada.pool.query(
        `insert into convite (escola_id, token_hash, tipo, usuario_id, expira_em, revogado_em, usado_em)
         values ($1, $2, 'coordenador', $3, now() + $4::interval, $5, $6)`,
        [
          escolaB,
          randomBytes(32).toString('hex'),
          rows[0]?.id,
          estado === 'expirado' ? '-1 hour' : '72 hours',
          estado === 'revogado' ? new Date() : null,
          estado === 'usado' ? new Date(Date.now() - 60 * 60 * 1000) : null,
        ],
      )
    }
    const pessoas = { valido: await pessoa(escolaA), revogado: await pessoa(escolaA), expirado: await pessoa(escolaA), usado: await pessoa(escolaA) }
    for (const [estado, quem] of Object.entries(pessoas) as Array<[keyof typeof pessoas, Pessoa]>) await convidar(quem, estado)

    for (const quem of Object.values(pessoas)) await pela(coordenacaoDeA, () => servico.desativar(quem.usuarioId))

    expect(await contaNoBanco(pessoas.valido.contaId)).toMatchObject({ email: pessoas.valido.email, senha: true })
    for (const estado of ['revogado', 'expirado', 'usado'] as const) expect(await contaNoBanco(pessoas[estado].contaId), estado).toMatchObject({ email: null, senha: false })
  })

  it('concorrência: dois cliques em desativar o mesmo usuário desativam uma vez, com um registro só; o outro recebe NAO_ENCONTRADO', async () => {
    const escolaId = await bancada.escola()
    const coordenacao = await bancada.sessao(escolaId, 'coordenador')
    const professor = await pessoa(escolaId)
    const resultados = await Promise.allSettled([pela(coordenacao, () => servico.desativar(professor.usuarioId)), pela(coordenacao, () => servico.desativar(professor.usuarioId))])
    expect(resultados.map((resultado) => resultado.status).sort()).toEqual(['fulfilled', 'rejected'])
    const recusa = resultados.find((resultado) => resultado.status === 'rejected')
    await esperarNaoEncontrado(Promise.reject(recusa?.reason))
    expect(await auditoriaDoCiclo(escolaId)).toHaveLength(1)
  })

  it('borda: o coordenador desativado enquanto tinha o desafio do MFA na mão não entra com o código certo, e nenhuma sessão nasce', async () => {
    const escolaId = await bancada.escola()
    const outraCoordenacao = await bancada.sessao(escolaId, 'coordenador')
    const renata = await pessoa(escolaId, 'coordenador')
    const segredo = await comMfaAtivo(renata)
    const login = await entrarPorEmail(renata.email)
    expect(login.corpo['etapa']).toBe('mfa')

    await pela(outraCoordenacao, () => servico.desativar(renata.usuarioId))

    const codigo = TOTP.generate({ secret: Secret.fromBase32(segredo), algorithm: 'SHA1', digits: 6, period: 30 })
    const comCodigo = await postar('/v1/sessao/mfa', { codigo }, String(login.corpo['desafio']))
    expect(comCodigo.status).toBe(401)
    expect(comCodigo.corpo.erro?.codigo).toBe(ErrorCode.NAO_AUTENTICADO)
    expect(await sessoesDe(escolaId, renata.usuarioId)).toEqual([])
  })

  it('isolamento: a eliminação pedida por A apaga usuário, credencial, conta externa, vínculos e sessões de A, preserva tudo de B e o login em B, e mantém o registro de acesso e a auditoria de A', async () => {
    const a = await montarEscolaComTurma(api, bancada)
    const b = await montarEscolaComTurma(api, bancada)
    const escolaA = a.coordenacao.escolaId
    const escolaB = b.coordenacao.escolaId
    const camila = await pessoa(escolaA)
    const camilaEmB = await naOutraEscola(camila, escolaB)
    const vinculoEmA = await vinculoConfirmado(a, camila.usuarioId, await entrarComo(camila, camila.usuarioId))
    const tokenEmB = await entrarComo(camila, camilaEmB)
    const vinculoEmB = await vinculoConfirmado(b, camilaEmB, tokenEmB)
    const externaEmA = await ligarContaExterna(escolaA, camila.usuarioId)
    const externaEmB = await ligarContaExterna(escolaB, camilaEmB)
    // O aluno de A, com matrícula, conta Google, vínculo na turma e sessão aberta.
    const matricula = `RA${randomBytes(4).toString('hex')}`
    const enzo = await alunoComMatricula(escolaA, matricula)
    await ligarContaExterna(escolaA, enzo)
    await bancada.pool.query("insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())", [
      escolaA,
      a.anoLetivoId,
      enzo,
      a.turma,
      a.coordenacao.usuarioId,
    ])
    const tokenDoEnzo = await tokenDoAluno(escolaA, matricula)
    const registrosAntes = { camila: await contar('registro_acesso', escolaA, camila.usuarioId), enzo: await contar('registro_acesso', escolaA, enzo) }
    expect(registrosAntes.camila).toBeGreaterThan(0)
    expect(registrosAntes.enzo).toBeGreaterThan(0)

    // Id de B pedido por A: a mesma resposta do id de ninguém, e nada muda em B.
    await esperarNaoEncontrado(pela(a.coordenacao, () => servico.eliminar(camilaEmB)))
    await esperarNaoEncontrado(pela(a.coordenacao, () => servico.eliminar(randomUUID())))
    await pela(a.coordenacao, () => servico.eliminar(camila.usuarioId))
    await pela(a.coordenacao, () => servico.eliminar(enzo))

    for (const [usuarioId, nome] of [
      [camila.usuarioId, 'camila'],
      [enzo, 'enzo'],
    ] as const) {
      for (const tabela of ['usuario', 'credencial_matricula', 'conta_externa', 'vinculo', 'sessao'] as const) expect(await contar(tabela, escolaA, usuarioId), `${nome}: ${tabela}`).toBe(0)
      // O registro de acesso fica pela retenção legal (Marco Civil), com o id.
      expect(await contar('registro_acesso', escolaA, usuarioId), `${nome}: registro_acesso`).toBe(registrosAntes[nome])
    }
    expect(await statusDoEu(tokenDoEnzo)).toBe(401)
    expect((await bancada.pool.query('select 1 from vinculo where id = $1', [vinculoEmA])).rowCount).toBe(0)
    expect((await bancada.pool.query('select 1 from conta_externa where id = $1', [externaEmA])).rowCount).toBe(0)
    // A auditoria de A fica, inclusive o que a professora eliminada fez: confirmar o vínculo.
    const { rows: feitoPorCamila } = await bancada.pool.query('select acao from auditoria where escola_id = $1 and autor_usuario_id = $2', [escolaA, camila.usuarioId])
    expect(feitoPorCamila).toEqual([{ acao: 'vinculo.confirmado' }])

    // Em B, tudo continua: o usuário ativo, o vínculo, a conta Google, a sessão aberta e o login.
    expect(await contar('usuario', escolaB, camilaEmB)).toBe(1)
    expect((await bancada.pool.query("select 1 from vinculo where id = $1 and estado = 'confirmado'", [vinculoEmB])).rowCount).toBe(1)
    expect((await bancada.pool.query('select 1 from conta_externa where id = $1', [externaEmB])).rowCount).toBe(1)
    expect(await statusDoEu(tokenEmB)).toBe(200)
    expect(await contaNoBanco(camila.contaId)).toMatchObject({ email: camila.email, senha: true })
    const loginEmB = await entrarPorEmail(camila.email)
    expect(loginEmB.corpo['etapa']).toBe('pronta')
    expect((await chamar(api.url, 'GET', '/v1/eu', String(loginEmB.corpo['token']))).corpo).toMatchObject({ usuarioId: camilaEmB, escola: { id: escolaB } })
    expect(await auditoriaDoCiclo(escolaB)).toEqual([])

    // O último usuário da conta eliminado, agora em B: a mesma limpeza da desativação.
    await pela(b.coordenacao, () => servico.eliminar(camilaEmB))
    expect(await contaNoBanco(camila.contaId)).toEqual({ email: null, senha: false, mfaAtivo: false, segredo: false, codigos: 0 })
    expect((await auditoriaDoCiclo(escolaB)).map((linha) => linha['depois'])).toEqual([
      { sessoesApagadas: 2, vinculosApagados: 1, credencialApagada: false, contaExternaApagada: true, linhaDaListaApagada: false, pedidosApagados: 0, contaLimpa: true },
    ])
  })

  it('na transação de quem chama (F3, tarefa 1.0): eliminar e desativar entram nela; a falha de quem chama depois desfaz as duas, com a conta e a auditoria; sem falha, saem no commit dela', async () => {
    const escolaId = await bancada.escola()
    const paula = await pessoa(escolaId)
    const rui = await pessoa(escolaId)
    const usuarioNoBanco = async (usuarioId: string) =>
      (await bancada.pool.query<{ desativado: boolean }>('select desativado_em is not null as desativado from usuario where id = $1', [usuarioId])).rows[0]
    const eliminadaNaTransacao = async (tx: DatabaseTransaction) =>
      (await tx.execute<{ total: number }>(sql`select count(*)::int as total from usuario where id = ${paula.usuarioId}`)).rows[0]?.total
    const falhaDeQuemChama = new Error('quem chama falhou depois do ciclo de vida')

    await expect(
      peloOperador(escolaId, () =>
        bancada.banco.transaction(async (tx) => {
          await servico.eliminar(paula.usuarioId, { autorOperador: OPERADOR }, tx)
          await servico.desativar(rui.usuarioId, { autorOperador: OPERADOR }, tx)
          // Dentro da transação de quem chama, o efeito já está lá; fora dela, por outra conexão, ainda não.
          expect(await eliminadaNaTransacao(tx)).toBe(0)
          expect(await usuarioNoBanco(paula.usuarioId)).toEqual({ desativado: false })
          expect(await usuarioNoBanco(rui.usuarioId)).toEqual({ desativado: false })
          throw falhaDeQuemChama
        }),
      ),
    ).rejects.toBe(falhaDeQuemChama)

    // A falha de quem chama desfez tudo: os dois usuários, a conta da Paula e nenhuma auditoria.
    expect(await usuarioNoBanco(paula.usuarioId)).toEqual({ desativado: false })
    expect(await usuarioNoBanco(rui.usuarioId)).toEqual({ desativado: false })
    expect(await contaNoBanco(paula.contaId)).toMatchObject({ email: paula.email, senha: true })
    expect(await contaNoBanco(rui.contaId)).toMatchObject({ email: rui.email, senha: true })
    expect(await auditoriaDoCiclo(escolaId)).toEqual([])

    await peloOperador(escolaId, () =>
      bancada.banco.transaction(async (tx) => {
        await servico.eliminar(paula.usuarioId, { autorOperador: OPERADOR }, tx)
        await servico.desativar(rui.usuarioId, { autorOperador: OPERADOR }, tx)
      }),
    )
    expect(await usuarioNoBanco(paula.usuarioId)).toBeUndefined()
    expect(await usuarioNoBanco(rui.usuarioId)).toEqual({ desativado: true })
    expect(await contaNoBanco(paula.contaId)).toMatchObject({ email: null, senha: false })
    expect(await contaNoBanco(rui.contaId)).toMatchObject({ email: null, senha: false })
    expect((await auditoriaDoCiclo(escolaId)).map((linha) => [linha['acao'], linha['entidade_id'], linha['autor_operador']])).toEqual([
      ['usuario.eliminado', paula.usuarioId, OPERADOR],
      ['usuario.desativado', rui.usuarioId, OPERADOR],
    ])
  })

  it('borda (F3, tarefa 1.0): a desativação encerra só as sessões ainda abertas; a que já tinha saído fica com o motivo dela e não conta', async () => {
    const escolaId = await bancada.escola()
    const matricula = `RA${randomBytes(4).toString('hex')}`
    const aluno = await alunoComMatricula(escolaId, matricula)
    await tokenDoAluno(escolaId, matricula)
    await tokenDoAluno(escolaId, matricula)
    const { rows } = await bancada.pool.query<{ id: string }>('select id from sessao where escola_id = $1 and usuario_id = $2 order by id limit 1', [escolaId, aluno])
    await bancada.pool.query("update sessao set encerrada_em = now(), motivo = 'saida' where id = $1", [rows[0]?.id])

    await peloOperador(escolaId, () => servico.desativar(aluno, { autorOperador: OPERADOR }))

    expect((await sessoesDe(escolaId, aluno)).map((sessao) => sessao.motivo).sort()).toEqual(['desativacao', 'saida'])
    expect((await auditoriaDoCiclo(escolaId)).map((linha) => linha['depois'])).toEqual([expect.objectContaining({ sessoesEncerradas: 1 })])
  })

  it('borda (F3, tarefa 1.0): eliminar quem já foi desativado, com a conta já limpa, não a limpa de novo: a auditoria diz contaLimpa falso', async () => {
    const escolaId = await bancada.escola()
    const lia = await pessoa(escolaId)
    await peloOperador(escolaId, () => servico.desativar(lia.usuarioId, { autorOperador: OPERADOR }))
    await peloOperador(escolaId, () => servico.eliminar(lia.usuarioId, { autorOperador: OPERADOR }))
    expect((await auditoriaDoCiclo(escolaId)).map((linha) => [linha['acao'], (linha['depois'] as Record<string, unknown>)['contaLimpa']])).toEqual([
      ['usuario.desativado', true],
      ['usuario.eliminado', false],
    ])
  })

  it('borda (F3, tarefa 1.0): limpar a conta encerra também a sessão aberta que tenha escapado em outra escola, com o motivo conta_limpa', async () => {
    const escolaA = await bancada.escola()
    const escolaB = await bancada.escola()
    const paula = await pessoa(escolaA)
    const paulaEmB = await naOutraEscola(paula, escolaB)
    await entrarComo(paula, paula.usuarioId)
    // A sessão de A escapou: o usuário de A saiu pelo banco, sem passar pelo ciclo de vida, e a sessão dele ficou aberta.
    await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [paula.usuarioId])
    expect(await sessoesDe(escolaA, paula.usuarioId)).toEqual([{ encerrada: false, motivo: null }])

    await peloOperador(escolaB, () => servico.desativar(paulaEmB, { autorOperador: OPERADOR }))

    expect(await contaNoBanco(paula.contaId)).toMatchObject({ email: null, senha: false })
    expect(await sessoesDe(escolaA, paula.usuarioId)).toEqual([{ encerrada: true, motivo: 'conta_limpa' }])
  })

  it('borda (F3, tarefa 1.0): a eliminação trava só as turmas em que o usuário é professor; a do vínculo de aluno e a turma em que ele não tem vínculo ficam livres', async () => {
    const a = await montarEscolaComTurma(api, bancada)
    const escolaId = a.coordenacao.escolaId
    const aluno = await alunoComMatricula(escolaId, `RA${randomBytes(4).toString('hex')}`)
    const professora = await pessoa(escolaId)
    await bancada.pool.query("insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, 'aluno', 'confirmado', $5, now())", [
      escolaId,
      a.anoLetivoId,
      aluno,
      a.turma,
      a.coordenacao.usuarioId,
    ])
    await bancada.pool.query("insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, criado_por) values ($1, $2, $3, $4, $5, 'professor', 'pendente', $6)", [
      escolaId,
      a.anoLetivoId,
      professora.usuarioId,
      a.turma,
      a.quimica,
      a.coordenacao.usuarioId,
    ])
    /** Elimina com a turma travada por outra transação (o gerar do professor no meio), e espera no máximo 1 s pela trava. */
    const eliminarComATurmaTravada = async (usuarioId: string, turmaTravada = a.turma): Promise<void> => {
      const outra = await bancada.pool.connect()
      try {
        await outra.query('begin')
        await outra.query('select id from turma where id = $1 for no key update', [turmaTravada])
        await pela(a.coordenacao, () =>
          bancada.banco.transaction(async (tx) => {
            await tx.execute(sql`set local lock_timeout = '1s'`)
            await servico.eliminar(usuarioId, {}, tx)
          }),
        )
      } finally {
        await outra.query('rollback')
        outra.release()
      }
    }

    await eliminarComATurmaTravada(aluno)
    expect(await contar('usuario', escolaId, aluno)).toBe(0)
    // A professora, com vínculo só pendente na mesma turma, espera a trava: a eliminação dela não passa enquanto o gerar segura a turma.
    await expect(eliminarComATurmaTravada(professora.usuarioId)).rejects.toMatchObject({ cause: expect.objectContaining({ code: '55P03' }) })
    expect(await contar('usuario', escolaId, professora.usuarioId)).toBe(1)
    // A outra turma do mesmo ano, em que ela não tem vínculo, travada pelo gerar de outro professor: a eliminação não a espera.
    await eliminarComATurmaTravada(professora.usuarioId, a.outraTurma)
    expect(await contar('usuario', escolaId, professora.usuarioId)).toBe(0)
  })

  it('borda: a eliminação do coordenador que criou o vínculo de outra pessoa mantém o vínculo e a auditoria dele, e o banco continua recusando autor de outra escola na escrita', async () => {
    const a = await montarEscolaComTurma(api, bancada)
    const escolaA = a.coordenacao.escolaId
    const b = await bancada.escola()
    const segundaCoordenacao = await bancada.sessao(escolaA, 'coordenador')
    const professora = await pessoa(escolaA)
    const vinculo = await vinculoConfirmado(a, professora.usuarioId, await entrarComo(professora, professora.usuarioId), segundaCoordenacao)

    await pela(a.coordenacao, () => servico.eliminar(segundaCoordenacao.usuarioId))

    expect(await contar('usuario', escolaA, segundaCoordenacao.usuarioId)).toBe(0)
    const { rows: vinculos } = await bancada.pool.query('select estado, criado_por from vinculo where id = $1', [vinculo])
    expect(vinculos).toEqual([{ estado: 'confirmado', criado_por: segundaCoordenacao.usuarioId }])
    const { rows: feitos } = await bancada.pool.query('select acao from auditoria where escola_id = $1 and autor_usuario_id = $2', [escolaA, segundaCoordenacao.usuarioId])
    expect(feitos).toEqual([{ acao: 'vinculo.criado' }])

    // Na escrita, o gatilho guarda o que a FK guardava: autor de outra escola, ou que não existe mais, é recusado.
    const deOutraEscola = (await bancada.sessao(b, 'coordenador')).usuarioId
    const inserirVinculo = (criadoPor: string) =>
      bancada.pool.query("insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, criado_por) values ($1, $2, $3, $4, 'professor', 'pendente', $5)", [
        escolaA,
        a.anoLetivoId,
        professora.usuarioId,
        a.outraTurma,
        criadoPor,
      ])
    const inserirAuditoria = (autor: string) =>
      bancada.pool.query("insert into auditoria (escola_id, autor_usuario_id, acao, entidade, entidade_id, requisicao_id) values ($1, $2, 'teste.gatilho', 'escola', $1, $3)", [escolaA, autor, randomUUID()])
    for (const autor of [deOutraEscola, segundaCoordenacao.usuarioId]) {
      await expect(inserirVinculo(autor)).rejects.toMatchObject({ code: '23503', constraint: 'vinculo_criado_por_da_escola_fk' })
      await expect(inserirAuditoria(autor)).rejects.toMatchObject({ code: '23503', constraint: 'auditoria_autor_da_escola_fk' })
    }
    await expect(inserirVinculo(a.coordenacao.usuarioId)).resolves.toMatchObject({ rowCount: 1 })
    // Na troca do autor de um registro que já existe, também.
    const trocarAutor = (autor: string) =>
      bancada.pool.query('update auditoria set autor_usuario_id = $1 where id = (select id from auditoria where escola_id = $2 and autor_usuario_id = $3 limit 1)', [autor, escolaA, a.coordenacao.usuarioId])
    await expect(trocarAutor(deOutraEscola)).rejects.toMatchObject({ code: '23503', constraint: 'auditoria_autor_da_escola_fk' })
  })

  it('auditoria (RF19): desativação e eliminação gravam registro com autor e data, pela coordenação ou pelo operador, sem e-mail, nome nem matrícula em antes e depois', async () => {
    const escolaId = await bancada.escola()
    const coordenacao = await bancada.sessao(escolaId, 'coordenador')
    const matricula = `RA${randomBytes(4).toString('hex')}`
    const lara = await alunoComMatricula(escolaId, matricula)
    await bancada.pool.query('update usuario set nome = $1 where id = $2', ['Lara Sintética', lara])
    await ligarContaExterna(escolaId, lara)
    await tokenDoAluno(escolaId, matricula)
    const professor = await pessoa(escolaId)
    const inicio = new Date(Date.now() - 1_000)

    await pela(coordenacao, () => servico.desativar(lara))
    await peloOperador(escolaId, () => servico.eliminar(professor.usuarioId, { autorOperador: OPERADOR }))

    const linhas = await auditoriaDoCiclo(escolaId)
    expect(linhas.map(({ em: _em, ...resto }) => resto)).toEqual([
      {
        acao: 'usuario.desativado',
        entidade: 'usuario',
        entidade_id: lara,
        autor_usuario_id: coordenacao.usuarioId,
        autor_operador: null,
        antes: { papel: 'aluno' },
        depois: { desativadoEm: expect.any(String), sessoesEncerradas: 1, credencialApagada: true, contaExternaDesligada: true, contaLimpa: false },
        finalidade: null,
      },
      {
        acao: 'usuario.eliminado',
        entidade: 'usuario',
        entidade_id: professor.usuarioId,
        autor_usuario_id: null,
        autor_operador: OPERADOR,
        antes: { papel: 'professor', desativadoEm: null },
        depois: { sessoesApagadas: 0, vinculosApagados: 0, credencialApagada: false, contaExternaApagada: false, linhaDaListaApagada: false, pedidosApagados: 0, contaLimpa: true },
        finalidade: null,
      },
    ])
    for (const { em } of linhas) expect((em as Date).getTime()).toBeGreaterThanOrEqual(inicio.getTime())
    const texto = JSON.stringify(linhas)
    for (const proibido of [matricula, 'Lara Sintética', professor.email, professor.nome]) expect(texto.includes(proibido), proibido).toBe(false)
  })

  it('borda: a coordenação desliga a conta Google de uma professora ativa, que continua ativa; o próprio usuário, id inválido, sem ligação ou de outra escola dão NAO_ENCONTRADO', async () => {
    const escolaA = await bancada.escola()
    const escolaB = await bancada.escola()
    const coordenacao = await bancada.sessao(escolaA, 'coordenador')
    const camila = await pessoa(escolaA)
    const ligacao = await ligarContaExterna(escolaA, camila.usuarioId)
    const deB = await pessoa(escolaB)
    await ligarContaExterna(escolaB, deB.usuarioId)

    await pela(coordenacao, () => servico.desligarContaExterna(camila.usuarioId))

    expect(await contar('conta_externa', escolaA, camila.usuarioId)).toBe(0)
    const { rows: ativa } = await bancada.pool.query('select desativado_em from usuario where id = $1', [camila.usuarioId])
    expect(ativa).toEqual([{ desativado_em: null }])
    expect(await auditoriaDoCiclo(escolaA)).toEqual([
      expect.objectContaining({ acao: 'conta_externa.desligada', entidade_id: ligacao, antes: { usuarioId: camila.usuarioId, provedor: 'google' }, depois: null }),
    ])
    await esperarNaoEncontrado(pela(coordenacao, () => servico.desligarContaExterna(camila.usuarioId)))
    await esperarNaoEncontrado(pela(coordenacao, () => servico.desligarContaExterna(deB.usuarioId)))
    await esperarNaoEncontrado(pela(coordenacao, () => servico.desligarContaExterna('1837')))
    await esperarNaoEncontrado(pela(coordenacao, () => servico.desativar(coordenacao.usuarioId)))
    await esperarNaoEncontrado(pela(coordenacao, () => servico.eliminar(coordenacao.usuarioId)))
    expect(await contar('conta_externa', escolaB, deB.usuarioId)).toBe(1)
    expect(await contar('usuario', escolaA, coordenacao.usuarioId)).toBe(1)
  })

  describe('V3 e V4 (A1, tarefa 10.0): a eliminação alcança a lista de nomes e os pedidos', () => {
    let sala: FerramentasDaSala

    beforeAll(() => {
      sala = new FerramentasDaSala(api, bancada)
    })

    const decidir = async (s: SalaDeTeste, ids: readonly string[], decisao: 'aprovar' | 'recusar' = 'aprovar') => {
      const resposta = await chamar(api.url, 'POST', '/v1/reivindicacoes/decidir', s.professor.token, { ids, decisao })
      expect(resposta.status).toBe(200)
      expect(decisaoResponseSchema.parse(resposta.corpo).resultados.map((linha) => linha.resultado)).toEqual(ids.map(() => 'decidida'))
    }

    /** O aluno reivindica o nome pela sala, com a matrícula certa, e o id do pedido pendente que nasceu. */
    async function pedir(s: SalaDeTeste, nome: NomeDaLista): Promise<string> {
      expect((await sala.reivindicar(pedidoDaSala(s, nome))).status).toBe(200)
      const { rows } = await bancada.pool.query<{ id: string }>(`select id from reivindicacao where escola_id = $1 and lista_nome_id = $2 and estado = 'pendente'`, [s.escolaId, nome.id])
      const id = rows[0]?.id
      if (id === undefined) throw new Error('pedido não gravado')
      return id
    }

    /** Quais destes ids ainda existem na tabela. */
    async function existentes(tabela: 'lista_nome' | 'reivindicacao' | 'usuario', ids: readonly string[]): Promise<string[]> {
      return (await bancada.pool.query<{ id: string }>(`select id from ${tabela} where id = any($1::uuid[]) order by id`, [ids])).rows.map(({ id }) => id)
    }

    /** Em quantas linhas da escola o texto aparece, por tabela: o usuário, a credencial, as três da A1 e a auditoria. */
    async function ondeAparece(escolaId: string, texto: string): Promise<Record<string, number>> {
      const contagem: Record<string, number> = {}
      for (const tabela of ['usuario', 'credencial_matricula', 'lista_nome', 'reivindicacao', 'acesso_turma', 'vinculo', 'auditoria']) {
        const { rows } = await bancada.pool.query<{ total: number }>(`select count(*)::int as total from ${tabela} t where t.escola_id = $1 and row_to_json(t)::text like $2`, [
          escolaId,
          `%${texto}%`,
        ])
        contagem[tabela] = rows[0]?.total ?? -1
      }
      return contagem
    }

    it('V3: eliminar o aluno aprovado apaga, antes do usuário e na mesma transação, a linha dele da lista e os pedidos dela (o recusado e o aprovado); o marcador não sobra; a falha no meio não apaga nada', async () => {
      const s = await sala.montar()
      const marcador = `marcador${randomUUID().slice(0, 8)}`
      const nomeDoAluno = `Aluna ${marcador}`
      const matricula = `${marcador}-m`
      expect((await chamar(api.url, 'POST', `/v1/turmas/${s.turma}/lista`, s.coordenacao.token, { texto: `${nomeDoAluno};${matricula}` })).status).toBe(201)
      const { rows } = await bancada.pool.query<{ id: string }>('select id from lista_nome where escola_id = $1 and matricula = $2', [s.escolaId, matricula])
      const nome: NomeDaLista = { id: rows[0]?.id ?? '', nome: nomeDoAluno, matricula }
      // Alguém pede o nome antes e é recusado; depois o aluno pede e é aprovado: os dois pedidos apontam para a linha.
      const recusado = await pedir(s, nome)
      await decidir(s, [recusado], 'recusar')
      const aprovado = await pedir(s, nome)
      await decidir(s, [aprovado])
      const alunoId = (await bancada.pool.query<{ usuario_id: string }>('select usuario_id from lista_nome where id = $1', [nome.id])).rows[0]?.usuario_id ?? ''
      // Um colega da mesma turma, também aprovado, com a linha e o pedido dele: nada dele sai.
      const colega = await sala.umNome(s)
      const pedidoDoColega = await pedir(s, colega)
      await decidir(s, [pedidoDoColega])
      const antesDoColega = await ondeAparece(s.escolaId, colega.matricula)
      expect(await ondeAparece(s.escolaId, marcador)).toMatchObject({ usuario: 1, credencial_matricula: 1 })

      // A falha injetada no último passo (a auditoria) desfaz tudo: nada foi apagado.
      const gatilho = `falha_eliminacao_${randomUUID().replaceAll('-', '')}`
      await bancada.pool.query(`
        create function ${gatilho}() returns trigger language plpgsql as $$
        begin
          if new.acao = 'usuario.eliminado' and new.escola_id = '${s.escolaId}' then raise exception 'falha forçada da eliminação'; end if;
          return new;
        end $$`)
      await bancada.pool.query(`create trigger ${gatilho} before insert on auditoria for each row execute function ${gatilho}()`)
      try {
        await expect(pela(s.coordenacao, () => servico.eliminar(alunoId))).rejects.toThrow()
      } finally {
        await bancada.pool.query(`drop trigger ${gatilho} on auditoria`)
        await bancada.pool.query(`drop function ${gatilho}()`)
      }
      expect(await existentes('lista_nome', [nome.id])).toEqual([nome.id])
      expect(await existentes('reivindicacao', [recusado, aprovado])).toEqual([recusado, aprovado].sort())
      expect(await existentes('usuario', [alunoId])).toEqual([alunoId])

      await pela(s.coordenacao, () => servico.eliminar(alunoId))

      expect(await existentes('lista_nome', [nome.id])).toEqual([])
      expect(await existentes('reivindicacao', [recusado, aprovado])).toEqual([])
      expect(await existentes('usuario', [alunoId])).toEqual([])
      expect(await ondeAparece(s.escolaId, marcador)).toEqual({ usuario: 0, credencial_matricula: 0, lista_nome: 0, reivindicacao: 0, acesso_turma: 0, vinculo: 0, auditoria: 0 })
      expect(await existentes('lista_nome', [colega.id])).toEqual([colega.id])
      expect(await existentes('reivindicacao', [pedidoDoColega])).toEqual([pedidoDoColega])
      expect(await ondeAparece(s.escolaId, colega.matricula)).toEqual(antesDoColega)
      const [eliminacao] = (await auditoriaDoCiclo(s.escolaId)).filter((linha) => linha['entidade_id'] === alunoId)
      expect(eliminacao?.['depois']).toEqual({ sessoesApagadas: 0, vinculosApagados: 1, credencialApagada: true, contaExternaApagada: false, linhaDaListaApagada: true, pedidosApagados: 2, contaLimpa: false })
    })

    it('V3, borda da virada: o aluno aprovado em 2026, eliminado com 2026 encerrado e 2027 em curso, leva a linha aprovada e os pedidos dela, que só sobrevivem ao ano pela linha aprovada', async () => {
      const s = await sala.montar()
      const nome = await sala.umNome(s)
      const recusado = await pedir(s, nome)
      await decidir(s, [recusado], 'recusar')
      const aprovado = await pedir(s, nome)
      await decidir(s, [aprovado])
      const alunoId = (await bancada.pool.query<{ usuario_id: string }>('select usuario_id from lista_nome where id = $1', [nome.id])).rows[0]?.usuario_id ?? ''
      const post = (caminho: string, corpo?: unknown) => chamar(api.url, 'POST', caminho, s.coordenacao.token, corpo)
      expect((await post(`/v1/anos-letivos/${s.anoLetivoId}/encerrar`)).status).toBe(200)
      const de2027 = await post('/v1/anos-letivos', { ano: 2027, inicio: '2027-02-01', fim: '2027-12-15' })
      expect(de2027.status).toBe(201)
      expect((await post(`/v1/anos-letivos/${String(de2027.corpo['id'])}/abrir`)).status).toBe(200)
      // A linha aprovada e os dois pedidos dela atravessaram a virada, no ano encerrado.
      expect(await existentes('lista_nome', [nome.id])).toEqual([nome.id])
      expect(await existentes('reivindicacao', [recusado, aprovado])).toEqual([recusado, aprovado].sort())

      await pela(s.coordenacao, () => servico.eliminar(alunoId))

      expect(await existentes('lista_nome', [nome.id])).toEqual([])
      expect(await existentes('reivindicacao', [recusado, aprovado])).toEqual([])
      expect(await existentes('usuario', [alunoId])).toEqual([])
      const [eliminacao] = (await auditoriaDoCiclo(s.escolaId)).filter((linha) => linha['entidade_id'] === alunoId)
      expect(eliminacao?.['depois']).toMatchObject({ linhaDaListaApagada: true, pedidosApagados: 2 })
    })

    it('isolamento: num contexto de A, `apagarDaListaDeNomes` com o aluno aprovado de B não apaga nada em B; com a escola de B, apaga', async () => {
      const a = await sala.montar()
      const b = await sala.montar()
      const nome = await sala.umNome(b)
      await decidir(b, [await pedir(b, nome)])
      const alunoDeB = (await bancada.pool.query<{ usuario_id: string }>('select usuario_id from lista_nome where id = $1', [nome.id])).rows[0]?.usuario_id ?? ''
      const pedidosDeB = async () => (await bancada.pool.query<{ id: string }>('select id from reivindicacao where escola_id = $1 order by id', [b.escolaId])).rows
      const antes = await pedidosDeB()
      expect(antes).toHaveLength(1)
      const contexto = (escolaId: string) => ({ requisicaoId: randomUUID(), escolaId, usuarioId: a.coordenacao.usuarioId, papel: 'coordenador' as const })
      const desfeita = new Error('desfazer')
      const apagarEm = (escolaId: string) =>
        runInContext(contexto(escolaId), () =>
          bancada.banco
            .transaction(async (tx) => {
              const apagados = await new CicloDeVidaRepository(tx).apagarDaListaDeNomes(alunoDeB)
              throw Object.assign(desfeita, { apagados })
            })
            .catch((erro: unknown) => (erro === desfeita ? (desfeita as Error & { apagados?: unknown }).apagados : Promise.reject(erro))),
        )
      expect(await apagarEm(a.escolaId)).toEqual({ linhaDaListaApagada: false, pedidosApagados: 0 })
      // O controle: com a escola de B, a mesma chamada alcança a linha e o pedido. As duas transações são desfeitas.
      expect(await apagarEm(b.escolaId)).toEqual({ linhaDaListaApagada: true, pedidosApagados: 1 })
      expect(await pedidosDeB()).toEqual(antes)
      expect(await existentes('lista_nome', [nome.id])).toEqual([nome.id])
    })

    it('V4: eliminar o professor que gerou o acesso e decidiu pedidos não falha; `criado_por` e `decidida_por` ficam nulos, e a auditoria guarda o id dele', async () => {
      const s = await sala.montar()
      const [primeiro, segundo] = await sala.nomes(s, s.turma, 2)
      if (primeiro === undefined || segundo === undefined) throw new Error('nomes')
      const aprovado = await pedir(s, primeiro)
      await decidir(s, [aprovado])
      const recusado = await pedir(s, segundo)
      await decidir(s, [recusado], 'recusar')
      const acessoId = await sala.acessoVigente(s.turma)
      const professorId = s.professor.usuarioId
      const autoriaAntes = (await bancada.pool.query<{ acao: string }>('select acao from auditoria where escola_id = $1 and autor_usuario_id = $2 order by acao', [s.escolaId, professorId])).rows
      expect(autoriaAntes.map(({ acao }) => acao)).toEqual(expect.arrayContaining(['acesso_turma.gerado', 'reivindicacao.decidida', 'reivindicacao.decidida']))

      await pela(s.coordenacao, () => servico.eliminar(professorId))

      expect(await existentes('usuario', [professorId])).toEqual([])
      expect((await bancada.pool.query('select criado_por from acesso_turma where id = $1', [acessoId])).rows).toEqual([{ criado_por: null }])
      const { rows: pedidos } = await bancada.pool.query('select id, estado, decidida_por, decidida_como from reivindicacao where id = any($1::uuid[]) order by id', [[aprovado, recusado]])
      expect(pedidos).toEqual(
        [
          { id: aprovado, estado: 'aprovada', decidida_por: null, decidida_como: 'professor' },
          { id: recusado, estado: 'recusada', decidida_por: null, decidida_como: 'professor' },
        ].sort((x, y) => x.id.localeCompare(y.id)),
      )
      // A autoria fica na auditoria, com o id do professor, e o vínculo do aluno que ele aprovou continua com ele em `criado_por`.
      expect((await bancada.pool.query<{ acao: string }>('select acao from auditoria where escola_id = $1 and autor_usuario_id = $2 order by acao', [s.escolaId, professorId])).rows).toEqual(autoriaAntes)
      const { rows: vinculosDoAluno } = await bancada.pool.query("select criado_por from vinculo where escola_id = $1 and papel = 'aluno'", [s.escolaId])
      expect(vinculosDoAluno).toEqual([{ criado_por: professorId }])
    })
  })
})
