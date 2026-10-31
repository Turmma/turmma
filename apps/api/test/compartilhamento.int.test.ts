import { Compartilhamento, diaDeUso, runInContext } from '@educa/core'
import type { CompartilhamentoRow, PedidoDoTitular, PreviaDoTitularResponse } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.js'
import { chamar, subirApi, type ApiDeTeste } from './api-com-sessao.js'
import { montarEscolaComTurma, type EscolaComTurma } from './escola-com-turma.js'
import { BancadaDeSessoes, type SessaoDeTeste } from './sessao-de-teste.js'

/**
 * A foto do compartilhamento do titular (F3, RF13; `tasks/prd-lgpd-e-titular/cenarios.md`, RF7 e RF13; Tech Spec do
 * F3, seção 5, "Compartilhamento"), pelo `POST pedidos` e pelo detalhe: o aluno pelo rastro com `provedor`, o
 * professor só por período (D64), a reserva por período quando o rastro não responde, a hospedagem sempre, e nada de
 * outra escola (o suboperador só de B, o consumo feito em B).
 *
 * As datas são escritas à mão (escola, suboperador, credencial e consumo), como nos testes da 8.0: `suboperador` é
 * global e o banco de teste acumula, então cada teste apaga as chaves que criou, com chave aleatória por teste. Cada
 * instante é uma constante do teste: a foto devolve as datas como instante, e `ha()` duas vezes não é o mesmo
 * instante.
 */

const PREFIXO = `cp${randomUUID().slice(0, 6)}`
/** A chave do suboperador é global e tem o formato do `IA_PROVEDOR_ID`: aleatória por teste, e limpa no fim dele. */
const chaveNova = (rotulo: string): string => `${PREFIXO}-${rotulo}-${randomUUID().slice(0, 8)}`

const DIA = 86_400_000
const MES = 30 * DIA
const HOJE = (): string => diaDeUso(new Date())
/** `ha` antes de agora: as datas do titular, do suboperador e do consumo, todas num passado controlado. */
const ha = (milissegundos: number): Date => new Date(Date.now() - milissegundos)

describe('compartilhamento do titular (F3, tarefa 12.0): o pedido guarda por quais empresas o dado passou', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  const linhasDeLog: string[] = []
  let api: ApiDeTeste

  beforeAll(async () => {
    api = await subirApi(medidor.medidor, { ambiente: { LIMITE_REQ_USUARIO_MIN: '1000', LIMITE_REQ_ESCOLA_MIN: '1000' } }, linhasDeLog)
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  /** Apaga os suboperadores criados no teste quando ele terminar: `todas` atende toda escola e ficaria na foto alheia. */
  function limparSuboperadores(): (id: string) => void {
    const ids: string[] = []
    onTestFinished(async () => {
      if (ids.length === 0) return
      await bancada.pool.query('delete from suboperador_escola where suboperador_id = any($1::uuid[])', [ids])
      await bancada.pool.query('delete from suboperador where id = any($1::uuid[])', [ids])
    })
    return (id: string) => ids.push(id)
  }

  /** A escola da foto, com o `criada_em` no passado: a vigência do suboperador nunca é anterior a ela (correção da 8.0). */
  async function escolaDeAntes(inicio: Date): Promise<EscolaComTurma> {
    const escola = await montarEscolaComTurma(api, bancada)
    await bancada.pool.query('update escola set criada_em = $2 where id = $1', [escola.coordenacao.escolaId, inicio])
    return escola
  }

  /** Um suboperador da operação, com a vigência escrita à mão: `todas` (a hospedagem), ou `lista` com a ligação. */
  async function suboperador(
    registrar: (id: string) => void,
    { chave, alcance, inicio, fim = null, escolas = [], fimDaLigacao = null }: { chave: string; alcance: 'todas' | 'lista'; inicio: Date; fim?: Date | null; escolas?: readonly string[]; fimDaLigacao?: Date | null },
  ): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into suboperador (chave, nome, finalidade, categorias, pais, contrato, veda_treinamento, alcance, inicio, fim, registrado_por)
       values ($1, $2, 'Empresa sintética do compartilhamento', array['cadastro', 'conversa_do_aluno'], 'BR', 'DPA-TESTE', true, $3, $4, $5, 'equipe-de-teste') returning id`,
      [chave, `Empresa sintética ${chave}`, alcance, inicio, fim],
    )
    const id = rows[0]?.id ?? ''
    registrar(id)
    for (const escolaId of escolas) {
      await bancada.pool.query('insert into suboperador_escola (escola_id, suboperador_id, inicio, fim) values ($1, $2, $3, $4)', [escolaId, id, inicio, fimDaLigacao])
    }
    return id
  }

  /** A credencial do aluno, criada `em`: é a entrada dele na escola (`escolaNova` nasce sem credencial). */
  async function credencialCriadaEm(escolaId: string, alunoId: string, em: Date): Promise<void> {
    await bancada.pool.query('insert into credencial_matricula (escola_id, usuario_id, matricula, senha_hash, criada_em) values ($1, $2, $3, $4, $5)', [
      escolaId,
      alunoId,
      `m${randomUUID().slice(0, 8)}`,
      'hash-sintetico',
      em,
    ])
  }

  /** Uma execução do titular, para o consumo sem `aluno_id` casar pela execução que ele pediu. */
  async function execucaoDe(escola: EscolaComTurma, solicitadaPor: string, funcao: 'tutor_com_o_aluno' | 'conversa_e_ferramentas', tarefa: string): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada) values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [escola.coordenacao.escolaId, escola.anoLetivoId, funcao, tarefa, solicitadaPor, randomUUID(), JSON.stringify({ tarefa })],
    )
    return rows[0]?.id ?? ''
  }

  /**
   * Uma chamada de IA gravada `em`. Com `provedor`, é o rastro de quem recebeu o conteúdo; sem ele, é a linha antiga,
   * anterior à migration da 7.0, que só diz que o dado saiu. `envioExterno` falso não sai de casa.
   */
  async function consumo({
    escolaId,
    alunoId = null,
    execucaoId = null,
    provedor = null,
    em,
    envioExterno = true,
    funcao = 'tutor_com_o_aluno',
    tarefa = 'turno_do_tutor',
  }: {
    escolaId: string
    alunoId?: string | null
    execucaoId?: string | null
    provedor?: string | null
    em: Date
    envioExterno?: boolean
    funcao?: 'tutor_com_o_aluno' | 'conversa_e_ferramentas'
    tarefa?: string
  }): Promise<void> {
    await bancada.pool.query(
      `insert into consumo_ia (escola_id, aluno_id, execucao_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida,
         custo_micros, duracao_ms, envio_externo, provedor, tentativas, estado, em)
       values ($1, $2, $3, $4, $5, 'padrao', $6, 'modelo-falso', 'v1', 120, 80, 0, 900, $7, $8, 1, 'concluida', $9)`,
      [escolaId, alunoId, execucaoId, tarefa, funcao, envioExterno ? 'openai_compat' : 'falso', envioExterno, provedor, em],
    )
  }

  /** Um vínculo de professor com o `criado_em` escrito: é a entrada dele, e os dois do D64 precisam ser iguais. */
  async function vinculoDeProfessor(escola: EscolaComTurma, professorId: string, criadoEm: Date, encerradoEm: Date | null = null, disciplinaId: string = escola.quimica): Promise<void> {
    await bancada.pool.query(
      `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, criado_por, criado_em, decidido_em, motivo_encerramento, encerrado_em)
       values ($1, $2, $3, $4, $5, 'professor', $6, $7, $8, $8, $9, $10)`,
      [escola.coordenacao.escolaId, escola.anoLetivoId, professorId, escola.turma, disciplinaId, encerradoEm === null ? 'confirmado' : 'encerrado', escola.coordenacao.usuarioId, criadoEm, encerradoEm === null ? null : 'desligamento', encerradoEm],
    )
  }

  const pedir = (sessao: SessaoDeTeste, metodo: string, caminho: string, corpo?: unknown) => chamar(api.url, metodo, caminho, sessao.token, corpo)

  /** Registra o pedido pela API e devolve o detalhe: é no `POST` que a foto é calculada e gravada. */
  async function registrarPedido(sessao: SessaoDeTeste, titularId: string): Promise<{ noPost: PedidoDoTitular; noDetalhe: PedidoDoTitular }> {
    const post = await pedir(sessao, 'POST', '/v1/privacidade/pedidos', { titularId, tipo: 'acesso', solicitante: 'titular', chegouEm: HOJE(), chaveEnvio: randomUUID() })
    if (post.status !== 201) throw new Error(`POST pedidos: ${post.status} ${JSON.stringify(post.corpo)}\n${linhasDeLog.slice(-6).join('\n')}`)
    expect(post.status).toBe(201)
    const noPost = post.corpo as unknown as PedidoDoTitular
    const detalhe = await pedir(sessao, 'GET', `/v1/privacidade/pedidos/${noPost.id}`)
    expect(detalhe.status).toBe(200)
    return { noPost, noDetalhe: detalhe.corpo as unknown as PedidoDoTitular }
  }

  const previa = async (sessao: SessaoDeTeste, titularId: string): Promise<PreviaDoTitularResponse> => {
    const resposta = await pedir(sessao, 'GET', `/v1/privacidade/titulares/${titularId}/previa`)
    expect(resposta.status).toBe(200)
    return resposta.corpo as unknown as PreviaDoTitularResponse
  }

  /**
   * As linhas da foto, por origem, chave e id: o que cada cenário confere primeiro. O banco de teste acumula
   * `suboperador`, e o de `alcance = 'todas'` atende toda escola: o conjunto positivo é o das chaves do teste, e a
   * proibição (nenhuma linha de rastro, nenhuma empresa de IA) vale para a foto inteira.
   */
  const chavesDe = (foto: readonly CompartilhamentoRow[], origem: 'rastro' | 'periodo', doTeste: ReadonlySet<string>): string[] =>
    foto
      .filter((linha) => linha.origem === origem && doTeste.has(linha.chave))
      .map((linha) => `${linha.chave}:${String(linha.suboperadorId)}`)
      .sort()

  it('escopo: a chave de um suboperador só de B aparece como "não cadastrado" em A, e a reserva não lista o de B', async () => {
    const registrar = limparSuboperadores()
    const a = await escolaDeAntes(ha(3 * 12 * MES))
    const escolaA = a.coordenacao.escolaId
    const b = await bancada.escola()
    const chaveDeA = chaveNova('so-de-a')
    const chaveDeB = chaveNova('so-de-b')
    const doTeste = new Set([chaveDeA, chaveDeB])
    const soDeA = await suboperador(registrar, { chave: chaveDeA, alcance: 'lista', inicio: ha(12 * MES), escolas: [escolaA] })
    await suboperador(registrar, { chave: chaveDeB, alcance: 'lista', inicio: ha(12 * MES), escolas: [b] })

    const [aluno] = await bancada.sessoes(escolaA, { papel: 'aluno' })
    if (aluno === undefined) throw new Error('aluno de teste não criado')
    await credencialCriadaEm(escolaA, aluno.usuarioId, ha(2 * 12 * MES))
    // O consumo de A aponta a chave de um suboperador que só atende B: em A ela não casa com ninguém.
    const em = ha(MES)
    await consumo({ escolaId: escolaA, alunoId: aluno.usuarioId, provedor: chaveDeB, em })

    const { noPost, noDetalhe } = await registrarPedido(a.coordenacao, aluno.usuarioId)
    expect(noDetalhe.compartilhamento).toEqual(noPost.compartilhamento)
    const foto = noDetalhe.compartilhamento
    // O rastro diz a chave e "não cadastrado" (`suboperadorId: null`): a escola não conhece essa empresa.
    expect(foto.filter((linha) => linha.chave === chaveDeB)).toEqual([{ suboperadorId: null, chave: chaveDeB, primeiroEm: em.toISOString(), ultimoEm: em.toISOString(), origem: 'rastro' }])
    // A reserva lista o suboperador de A e nunca o de B: nada de outra escola entra (regra 10).
    expect(foto.filter((linha) => linha.suboperadorId === soDeA).map((linha) => linha.origem)).toEqual(['periodo'])
    expect(foto.filter((linha) => linha.chave === chaveDeB && linha.origem === 'periodo')).toEqual([])
    expect(foto.filter((linha) => doTeste.has(linha.chave) && linha.suboperadorId !== null && linha.suboperadorId !== soDeA)).toEqual([])
  })

  it('com e sem provedor: agrupa por provedor no rastro, pelas duas vias de atribuição, e as linhas antigas caem na reserva', async () => {
    const registrar = limparSuboperadores()
    const inicio = ha(12 * MES)
    const a = await escolaDeAntes(ha(3 * 12 * MES))
    const escolaA = a.coordenacao.escolaId
    const chaveX = chaveNova('provedor-x')
    const chaveY = chaveNova('provedor-y')
    const chaveHospedagem = chaveNova('hospedagem')
    const doTeste = new Set([chaveX, chaveY, chaveHospedagem])
    const provedorX = await suboperador(registrar, { chave: chaveX, alcance: 'lista', inicio, escolas: [escolaA] })
    const provedorY = await suboperador(registrar, { chave: chaveY, alcance: 'lista', inicio, escolas: [escolaA] })
    const hospedagem = await suboperador(registrar, { chave: chaveHospedagem, alcance: 'todas', inicio: ha(3 * 12 * MES) })

    // O aluno entrou há três meses, dentro do rastro: a reserva, aqui, só entra pelas linhas antigas.
    const [aluno] = await bancada.sessoes(escolaA, { papel: 'aluno' })
    if (aluno === undefined) throw new Error('aluno de teste não criado')
    // Ele entra há três meses, e já tinha chamada antes de a credencial existir: nenhuma data vai antes da entrada.
    const entrada = ha(3 * MES)
    await credencialCriadaEm(escolaA, aluno.usuarioId, entrada)
    const execucao = await execucaoDe(a, aluno.usuarioId, 'tutor_com_o_aluno', 'turno_do_tutor')
    const antesDaEntrada = ha(5 * MES)
    const recente = ha(2 * MES)
    const pelaExecucao = ha(MES)
    await consumo({ escolaId: escolaA, alunoId: aluno.usuarioId, provedor: chaveX, em: antesDaEntrada })
    await consumo({ escolaId: escolaA, alunoId: aluno.usuarioId, provedor: chaveX, em: recente })
    // A segunda via de atribuição: a chamada sem `aluno_id`, pela execução que o aluno pediu.
    await consumo({ escolaId: escolaA, execucaoId: execucao, provedor: chaveY, em: pelaExecucao })
    // A linha antiga, sem `provedor`: o dado saiu, mas não diz para quem.
    await consumo({ escolaId: escolaA, alunoId: aluno.usuarioId, provedor: null, em: ha(3 * MES) })
    // Chamadas de um provedor sem suboperador, todas antes da entrada: o grupo cai todo fora do período e não entra.
    const chaveZ = chaveNova('provedor-z')
    await consumo({ escolaId: escolaA, alunoId: aluno.usuarioId, provedor: chaveZ, em: ha(5 * MES) })
    await consumo({ escolaId: escolaA, alunoId: aluno.usuarioId, provedor: chaveZ, em: ha(4 * MES) })

    const { noDetalhe } = await registrarPedido(a.coordenacao, aluno.usuarioId)
    const foto = noDetalhe.compartilhamento
    expect(foto.filter((linha) => linha.chave === chaveZ)).toEqual([])
    expect(chavesDe(foto, 'rastro', doTeste)).toEqual([`${chaveX}:${provedorX}`, `${chaveY}:${provedorY}`].sort())
    expect(chavesDe(foto, 'periodo', doTeste)).toEqual([`${chaveX}:${provedorX}`, `${chaveY}:${provedorY}`, `${chaveHospedagem}:${hospedagem}`].sort())
    // As duas chamadas do X viram uma linha só, com o primeiro e o último uso — e o primeiro, que é anterior à
    // entrada, aparece recortado nela.
    expect(foto.find((linha) => linha.suboperadorId === provedorX && linha.origem === 'rastro')).toEqual({
      suboperadorId: provedorX,
      chave: chaveX,
      primeiroEm: entrada.toISOString(),
      ultimoEm: recente.toISOString(),
      origem: 'rastro',
    })
  })

  it('chave recadastrada: o mesmo provedor em duas empresas rende duas linhas, e a chamada depois do fim da ligação é "não cadastrado"', async () => {
    const registrar = limparSuboperadores()
    const a = await escolaDeAntes(ha(3 * 12 * MES))
    const escolaA = a.coordenacao.escolaId
    const chaveX = chaveNova('recadastrada')
    const doTeste = new Set([chaveX])
    // A mesma chave em duas empresas: a encerrada, e a que a recadastrou (o único vigente por chave é só onde `fim is null`).
    const velho = await suboperador(registrar, { chave: chaveX, alcance: 'lista', inicio: ha(12 * MES), fim: ha(6 * MES), escolas: [escolaA] })
    const novo = await suboperador(registrar, { chave: chaveX, alcance: 'lista', inicio: ha(6 * MES), fimDaLigacao: ha(2 * MES), escolas: [escolaA] })

    const [aluno] = await bancada.sessoes(escolaA, { papel: 'aluno' })
    if (aluno === undefined) throw new Error('aluno de teste não criado')
    // Dentro do horizonte, para a reserva não entrar: o que a foto mostra é só o rastro.
    await credencialCriadaEm(escolaA, aluno.usuarioId, ha(11 * MES))
    const antes = ha(9 * MES)
    const depois = ha(4 * MES)
    const aposALigacao = ha(MES)
    await consumo({ escolaId: escolaA, alunoId: aluno.usuarioId, provedor: chaveX, em: antes })
    await consumo({ escolaId: escolaA, alunoId: aluno.usuarioId, provedor: chaveX, em: depois })
    await consumo({ escolaId: escolaA, alunoId: aluno.usuarioId, provedor: chaveX, em: aposALigacao })

    const { noDetalhe } = await registrarPedido(a.coordenacao, aluno.usuarioId)
    const linhas = noDetalhe.compartilhamento.filter((linha) => linha.chave === chaveX && linha.origem === 'rastro')
    expect(linhas).toHaveLength(3)
    expect(linhas.find((linha) => linha.suboperadorId === velho)).toEqual({ suboperadorId: velho, chave: chaveX, primeiroEm: antes.toISOString(), ultimoEm: antes.toISOString(), origem: 'rastro' })
    expect(linhas.find((linha) => linha.suboperadorId === novo)).toEqual({ suboperadorId: novo, chave: chaveX, primeiroEm: depois.toISOString(), ultimoEm: depois.toISOString(), origem: 'rastro' })
    // Depois do fim da ligação, não há empresa vigente: "não cadastrado".
    expect(linhas.find((linha) => linha.suboperadorId === null)).toEqual({ suboperadorId: null, chave: chaveX, primeiroEm: aposALigacao.toISOString(), ultimoEm: aposALigacao.toISOString(), origem: 'rastro' })
    expect(chavesDe(noDetalhe.compartilhamento, 'periodo', doTeste)).toEqual([])
  })

  it('rastro expirado: depois de 12 meses a foto lista os suboperadores do período do titular, sem data anterior à entrada', async () => {
    const registrar = limparSuboperadores()
    const inicioDaEscola = ha(3 * 12 * MES)
    const a = await escolaDeAntes(inicioDaEscola)
    const escolaA = a.coordenacao.escolaId
    // A entrada dele é a mais antiga entre a conta externa e a credencial: a da conta, dois meses antes.
    const entrada = ha(2 * 12 * MES + 2 * MES)
    const chaveHospedagem = chaveNova('hospedagem')
    const chaveAntes = chaveNova('antes-do-aluno')
    const chaveDepois = chaveNova('depois')
    const chaveDeSempre = chaveNova('desde-sempre')
    const doTeste = new Set([chaveHospedagem, chaveAntes, chaveDepois, chaveDeSempre])
    const hospedagem = await suboperador(registrar, { chave: chaveHospedagem, alcance: 'todas', inicio: inicioDaEscola })
    // Encerrada antes de o aluno entrar: nunca recebeu dado dele.
    await suboperador(registrar, { chave: chaveAntes, alcance: 'todas', inicio: inicioDaEscola, fim: ha(2 * 12 * MES + 4 * MES) })
    const depois = await suboperador(registrar, { chave: chaveDepois, alcance: 'lista', inicio: ha(12 * MES), escolas: [escolaA] })
    // A empresa que atende a escola desde antes de o aluno entrar: com a reserva, aparece; sem ela, não.
    const deSempre = await suboperador(registrar, { chave: chaveDeSempre, alcance: 'lista', inicio: ha(30 * MES), escolas: [escolaA] })

    const [aluno] = await bancada.sessoes(escolaA, { papel: 'aluno' })
    if (aluno === undefined) throw new Error('aluno de teste não criado')
    await bancada.pool.query("insert into conta_externa (escola_id, usuario_id, provedor, sujeito, ligada_em) values ($1, $2, 'google', $3, $4)", [escolaA, aluno.usuarioId, `sub-${randomUUID().slice(0, 8)}`, entrada])
    await credencialCriadaEm(escolaA, aluno.usuarioId, ha(2 * 12 * MES))
    // O uso de antes do prazo, já expirado: o expurgo anula `aluno_id` e a execução, e o rastro não diz mais quem era.
    await consumo({ escolaId: escolaA, alunoId: aluno.usuarioId, provedor: chaveDepois, em: ha(13 * MES) })
    await bancada.pool.query('update consumo_ia set aluno_id = null where escola_id = $1', [escolaA])

    const { noDetalhe } = await registrarPedido(a.coordenacao, aluno.usuarioId)
    const foto = noDetalhe.compartilhamento
    expect(foto.filter((linha) => doTeste.has(linha.chave)).every((linha) => linha.origem === 'periodo')).toBe(true)
    expect(chavesDe(foto, 'periodo', doTeste)).toEqual([`${chaveDepois}:${depois}`, `${chaveDeSempre}:${deSempre}`, `${chaveHospedagem}:${hospedagem}`].sort())
    expect(chavesDe(foto, 'rastro', doTeste)).toEqual([])
    // Nenhuma data é anterior à entrada do titular: a hospedagem, que já existia, começa nele.
    expect(foto.every((linha) => new Date(linha.primeiroEm).getTime() >= entrada.getTime())).toBe(true)
    expect(foto.find((linha) => linha.suboperadorId === hospedagem)?.primeiroEm).toBe(entrada.toISOString())

    // O relógio é injetado, como no job da eliminação: com o horário de volta a vinte meses atrás, o período dele
    // ainda está dentro do rastro, a reserva não entra, e a hospedagem é tudo o que a foto mostra.
    const noPassado = await runInContext({ requisicaoId: randomUUID(), escolaId: escolaA }, () =>
      new Compartilhamento(bancada.banco, { agora: () => ha(20 * MES) }).doTitular({ titularId: aluno.usuarioId, papel: 'aluno' }),
    )
    expect(chavesDe(noPassado, 'periodo', doTeste)).toEqual([`${chaveHospedagem}:${hospedagem}`])
    expect(chavesDe(noPassado, 'rastro', doTeste)).toEqual([])
  })

  it('D64: os dois professores, o que usou o Assistente com provedor externo e o que não usou, têm foto e detalhe iguais', async () => {
    const registrar = limparSuboperadores()
    const a = await escolaDeAntes(ha(12 * MES))
    const escolaA = a.coordenacao.escolaId
    const chaveX = chaveNova('provedor-x')
    const chaveHospedagem = chaveNova('hospedagem')
    const doTeste = new Set([chaveX, chaveHospedagem])
    // A empresa de IA encerra com a escola quinze dias atrás: ainda assim, quem saiu antes dela não a alcança até o fim.
    const provedorX = await suboperador(registrar, { chave: chaveX, alcance: 'lista', inicio: ha(12 * MES), fimDaLigacao: ha(15 * DIA), escolas: [escolaA] })
    const hospedagem = await suboperador(registrar, { chave: chaveHospedagem, alcance: 'todas', inicio: ha(12 * MES) })

    const [usou, naoUsou] = await bancada.sessoes(escolaA, { papel: 'professor', quantidade: 2 })
    if (usou === undefined || naoUsou === undefined) throw new Error('professor de teste não criado')
    // O mesmo vínculo para os dois: a foto não pode depender de quem usou, e as datas têm de bater.
    const criadoEm = ha(6 * MES)
    await vinculoDeProfessor(a, usou.usuarioId, criadoEm)
    await vinculoDeProfessor(a, naoUsou.usuarioId, criadoEm)
    const execucao = await execucaoDe(a, usou.usuarioId, 'conversa_e_ferramentas', 'gerar_plano_de_aula')
    await consumo({ escolaId: escolaA, execucaoId: execucao, provedor: chaveX, em: ha(MES), funcao: 'conversa_e_ferramentas', tarefa: 'gerar_plano_de_aula' })

    const doQueUsou = await registrarPedido(a.coordenacao, usou.usuarioId)
    const doQueNaoUsou = await registrarPedido(a.coordenacao, naoUsou.usuarioId)
    // A foto é só por período, e o uso real (a chamada do colega) não aparece em nenhuma das duas.
    expect(doQueUsou.noDetalhe.compartilhamento).toEqual(doQueNaoUsou.noDetalhe.compartilhamento)
    expect(chavesDe(doQueUsou.noDetalhe.compartilhamento, 'periodo', doTeste)).toEqual([`${chaveX}:${provedorX}`, `${chaveHospedagem}:${hospedagem}`].sort())
    expect(doQueUsou.noDetalhe.compartilhamento.filter((linha) => linha.origem === 'rastro')).toEqual([])
    // O detalhe inteiro, menos o id do pedido, e a prévia: iguais.
    expect({ ...doQueUsou.noDetalhe, id: null }).toEqual({ ...doQueNaoUsou.noDetalhe, id: null })
    expect({ ...(await previa(a.coordenacao, usou.usuarioId)), id: null }).toEqual({ ...(await previa(a.coordenacao, naoUsou.usuarioId)), id: null })

    // Quem saiu tem o período fechado no `encerrado_em`: a foto não estende a empresa até o fim dela.
    const [saiu] = await bancada.sessoes(escolaA, { papel: 'professor', quantidade: 1 })
    if (saiu === undefined) throw new Error('professor de teste não criado')
    const encerradoEm = ha(30 * DIA)
    await vinculoDeProfessor(a, saiu.usuarioId, criadoEm, encerradoEm)
    const doQueSaiu = await registrarPedido(a.coordenacao, saiu.usuarioId)
    expect(doQueSaiu.noDetalhe.compartilhamento.filter((linha) => linha.origem === 'rastro')).toEqual([])
    // Só o que o teste criou: o banco acumula `todas`, e um laço pela foto inteira ficaria vermelho por foto alheia.
    expect(doQueSaiu.noDetalhe.compartilhamento.filter((l) => doTeste.has(l.chave))).not.toHaveLength(0)
    for (const linha of doQueSaiu.noDetalhe.compartilhamento.filter((l) => doTeste.has(l.chave))) expect(linha.ultimoEm).toBe(encerradoEm.toISOString())
  })

  it('professor com dois vínculos: o encerrado do ano passado e o aberto deste, e a foto vai até o fim do dia, não até o encerrado_em', async () => {
    const registrar = limparSuboperadores()
    const inicio = ha(12 * MES)
    const criadoDoAnoPassado = ha(10 * MES)
    const encerradoDoAnoPassado = ha(4 * MES)
    const criadoDeste = ha(3 * MES)
    const umMesAtras = ha(MES)
    const a = await escolaDeAntes(inicio)
    const escolaA = a.coordenacao.escolaId
    const chaveHospedagem = chaveNova('hospedagem')
    const hospedagem = await suboperador(registrar, { chave: chaveHospedagem, alcance: 'todas', inicio })

    const [prof] = await bancada.sessoes(escolaA, { papel: 'professor' })
    if (prof === undefined) throw new Error('professor de teste não criado')
    // Química no ano passado, encerrado; Física neste, aberto: é o professor depois da virada de ano (regra 60, item 5).
    await vinculoDeProfessor(a, prof.usuarioId, criadoDoAnoPassado, encerradoDoAnoPassado)
    await vinculoDeProfessor(a, prof.usuarioId, criadoDeste, null, a.fisica)

    const { noDetalhe } = await registrarPedido(a.coordenacao, prof.usuarioId)
    const linha = noDetalhe.compartilhamento.find((de) => de.suboperadorId === hospedagem)
    // O período começa no `criado_em` mais antigo, e não no do vínculo aberto.
    expect(linha?.primeiroEm).toBe(criadoDoAnoPassado.toISOString())
    // E vai até o fim do dia de uso, e não até o `encerrado_em` do vínculo antigo.
    expect(linha?.ultimoEm).not.toBe(encerradoDoAnoPassado.toISOString())
    expect(new Date(linha?.ultimoEm ?? 0).getTime()).toBeGreaterThan(umMesAtras.getTime())
  })

  it('mesma conta: o consumo feito em B não entra na foto do pedido de A', async () => {
    const registrar = limparSuboperadores()
    const a = await escolaDeAntes(ha(12 * MES))
    const b = await bancada.escola()
    const escolaA = a.coordenacao.escolaId
    const chaveHospedagem = chaveNova('hospedagem')
    const chaveDeB = chaveNova('so-de-b')
    const hospedagem = await suboperador(registrar, { chave: chaveHospedagem, alcance: 'todas', inicio: ha(12 * MES) })

    const [alunoDeA] = await bancada.sessoes(escolaA, { papel: 'aluno' })
    if (alunoDeA === undefined) throw new Error('aluno de teste não criado')
    // A mesma conta, um usuário em A e outro em B: é a pessoa que estuda nas duas escolas.
    const email = `aluno-${randomUUID().slice(0, 8)}@compartilhamento.invalid`
    await bancada.pool.query('insert into conta (email) values ($1)', [email])
    const { rows: criada } = await bancada.pool.query<{ id: string }>('select id from conta where email = $1', [email])
    const contaId = criada[0]?.id ?? ''
    await bancada.pool.query('update usuario set conta_id = $2 where id = $1', [alunoDeA.usuarioId, contaId])
    const { rows: emB } = await bancada.pool.query<{ id: string }>("insert into usuario (escola_id, conta_id, papel, nome) values ($1, $2, 'aluno', 'Aluno sintético da mesma conta') returning id", [b, contaId])
    const alunoDeB = emB[0]?.id ?? ''
    // O uso dele em B, com o provedor de lá: não pode aparecer na foto do pedido de A.
    await consumo({ escolaId: b, alunoId: alunoDeB, provedor: chaveDeB, em: ha(MES) })

    const { noDetalhe } = await registrarPedido(a.coordenacao, alunoDeA.usuarioId)
    const foto = noDetalhe.compartilhamento
    expect(foto.filter((linha) => linha.chave === chaveDeB)).toEqual([])
    expect(foto.filter((linha) => linha.origem === 'rastro')).toEqual([])
    expect(chavesDe(foto, 'periodo', new Set([chaveHospedagem]))).toEqual([`${chaveHospedagem}:${hospedagem}`])
  })

  it('sem uso e vigência: o aluno sem uso externo mostra só a hospedagem, e o provedor fora da vigência não casa', async () => {
    const registrar = limparSuboperadores()
    const inicio = ha(12 * MES)
    const a = await escolaDeAntes(inicio)
    const escolaA = a.coordenacao.escolaId
    const chaveHospedagem = chaveNova('hospedagem')
    const chaveX = chaveNova('provedor-x')
    const chaveFora = chaveNova('fora-da-vigencia')
    const doTeste = new Set([chaveHospedagem, chaveX, chaveFora])
    const hospedagem = await suboperador(registrar, { chave: chaveHospedagem, alcance: 'todas', inicio })
    await suboperador(registrar, { chave: chaveX, alcance: 'lista', inicio, escolas: [escolaA] })
    // Cadastrada, mas só depois da chamada: na data dela, a empresa ainda não atendia a escola.
    await suboperador(registrar, { chave: chaveFora, alcance: 'lista', inicio: ha(15 * DIA), escolas: [escolaA] })

    const [semUso, usouFora] = await bancada.sessoes(escolaA, { papel: 'aluno', quantidade: 2 })
    if (semUso === undefined || usouFora === undefined) throw new Error('aluno de teste não criado')
    // O uso local não sai de casa: não é rastro de compartilhamento nem reserva.
    await consumo({ escolaId: escolaA, alunoId: semUso.usuarioId, provedor: null, em: ha(MES), envioExterno: false })
    const em = ha(MES)
    await consumo({ escolaId: escolaA, alunoId: usouFora.usuarioId, provedor: chaveFora, em })

    const doSemUso = await registrarPedido(a.coordenacao, semUso.usuarioId)
    // Só a hospedagem: sem rastro nenhum, e nenhuma empresa de IA (o X, vigente, não entra sem reserva).
    expect(doSemUso.noDetalhe.compartilhamento.filter((linha) => linha.origem === 'rastro')).toEqual([])
    expect(chavesDe(doSemUso.noDetalhe.compartilhamento, 'periodo', doTeste)).toEqual([`${chaveHospedagem}:${hospedagem}`])
    expect(doSemUso.noDetalhe.compartilhamento.find((linha) => linha.chave === chaveHospedagem)).toMatchObject({ suboperadorId: hospedagem, primeiroEm: inicio.toISOString(), origem: 'periodo' })
    const doUsouFora = await registrarPedido(a.coordenacao, usouFora.usuarioId)
    // O provedor que estava fora da vigência não casa com o suboperador: "não cadastrado", e sem linha da empresa.
    expect(chavesDe(doUsouFora.noDetalhe.compartilhamento, 'rastro', doTeste)).toEqual([`${chaveFora}:null`])
    expect(doUsouFora.noDetalhe.compartilhamento.find((linha) => linha.chave === chaveFora)).toEqual({ suboperadorId: null, chave: chaveFora, primeiroEm: em.toISOString(), ultimoEm: em.toISOString(), origem: 'rastro' })
    expect(chavesDe(doUsouFora.noDetalhe.compartilhamento, 'periodo', doTeste)).toEqual([`${chaveHospedagem}:${hospedagem}`])
  })

  it('fim do dia: a chamada de hoje depois das 21h UTC entra no rastro, e a hospedagem vai até 23h59 de São Paulo', async () => {
    const registrar = limparSuboperadores()
    // 20h30 em São Paulo: o dia de uso ainda é o de ontem em UTC.
    const agora = new Date('2026-03-10T23:30:00.000Z')
    const a = await escolaDeAntes(new Date('2024-01-01T00:00:00.000Z'))
    const escolaA = a.coordenacao.escolaId
    const chaveHospedagem = chaveNova('hospedagem')
    const chaveX = chaveNova('provedor-x')
    const hospedagem = await suboperador(registrar, { chave: chaveHospedagem, alcance: 'todas', inicio: new Date('2025-01-01T00:00:00.000Z') })
    const provedorX = await suboperador(registrar, { chave: chaveX, alcance: 'lista', inicio: new Date('2025-01-01T00:00:00.000Z'), escolas: [escolaA] })

    const [aluno] = await bancada.sessoes(escolaA, { papel: 'aluno' })
    if (aluno === undefined) throw new Error('aluno de teste não criado')
    await credencialCriadaEm(escolaA, aluno.usuarioId, new Date('2025-06-01T12:00:00.000Z'))
    const em = new Date('2026-03-10T22:00:00.000Z')
    await consumo({ escolaId: escolaA, alunoId: aluno.usuarioId, provedor: chaveX, em })

    const foto = await runInContext({ requisicaoId: randomUUID(), escolaId: escolaA }, () =>
      new Compartilhamento(bancada.banco, { agora: () => agora }).doTitular({ titularId: aluno.usuarioId, papel: 'aluno' }),
    )
    expect(foto.filter((linha) => linha.chave === chaveX && linha.origem === 'rastro')).toEqual([{ suboperadorId: provedorX, chave: chaveX, primeiroEm: em.toISOString(), ultimoEm: em.toISOString(), origem: 'rastro' }])
    expect(foto.find((linha) => linha.suboperadorId === hospedagem)?.ultimoEm).toBe('2026-03-11T02:59:59.999Z')
  })

  it('sem data de entrada: o período do aluno começa no horizonte do rastro, sem reserva e sem data antiga', async () => {
    const registrar = limparSuboperadores()
    const agora = new Date('2026-03-10T15:00:00.000Z')
    const a = await escolaDeAntes(new Date('2020-01-01T00:00:00.000Z'))
    const escolaA = a.coordenacao.escolaId
    const chaveHospedagem = chaveNova('hospedagem')
    const chaveDaLista = chaveNova('da-lista')
    const doTeste = new Set([chaveHospedagem, chaveDaLista])
    const hospedagem = await suboperador(registrar, { chave: chaveHospedagem, alcance: 'todas', inicio: new Date('2023-03-01T00:00:00.000Z') })
    await suboperador(registrar, { chave: chaveDaLista, alcance: 'lista', inicio: new Date('2023-03-01T00:00:00.000Z'), escolas: [escolaA] })

    const [aluno] = await bancada.sessoes(escolaA, { papel: 'aluno' })
    if (aluno === undefined) throw new Error('aluno de teste não criado')

    const foto = await runInContext({ requisicaoId: randomUUID(), escolaId: escolaA }, () =>
      new Compartilhamento(bancada.banco, { agora: () => agora }).doTitular({ titularId: aluno.usuarioId, papel: 'aluno' }),
    )
    // Sem credencial e sem conta externa não há período anterior ao rastro: a reserva não entra, e só a hospedagem aparece.
    expect(chavesDe(foto, 'periodo', doTeste)).toEqual([`${chaveHospedagem}:${hospedagem}`])
    // O período começa no horizonte do rastro (`agora` menos o prazo de `consumo_por_aluno`), e não em 2023.
    expect(foto.find((linha) => linha.suboperadorId === hospedagem)?.primeiroEm).toBe('2025-03-10T15:00:00.000Z')
  })
})
