import { InMemoryFileStorage, ArquivoDoTitularRepository, createLogger, type Database, diaDeUso, runInContext, alunoTrailStatement, LEITURAS_DO_ARQUIVO, type Clock } from '@educa/core'
import {
  ErrorCode,
  COLUNAS_FORA_DO_ARQUIVO,
  CLASSIFICACAO_DAS_TABELAS,
  FINALIDADE_DO_ARQUIVO_DO_PROPRIO_TITULAR,
  MENSAGENS_DE_ERRO,
  TIPO_MONTAR_ARQUIVO,
  VALIDADE_DA_URL_DO_ARQUIVO_SEGUNDOS,
  VALIDADE_DO_ARQUIVO_DIAS,
} from '@educa/shared'
import { PgDialect } from 'drizzle-orm/pg-core'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MedidorDeTeste } from '../../../tools/testes/metricas.ts'
import { criarMontagemDoArquivo } from '../../worker/src/processors/montar-arquivo.js'
import { PrivacidadeService } from '../src/privacidade/privacidade.service.js'
import { instrucaoDoTextoDoModelo } from '../src/privacidade/titulares.repository.js'
import { subirApi, type ApiDeTeste } from './test-api.js'
import { montarEscolaComTurma, type EscolaComTurma } from './escola-turma.fixture.js'
import { esperarNaTrava } from './write-block-trigger.js'
import { MONTAGEM_DE_TESTE } from './test-config.js'
import { BancadaDeSessoes, type SessaoDeTeste } from './sessao.fixture.js'
import { execucaoDoJob } from '../../worker/test/job-execution.fixture.js'

/**
 * O arquivo do titular (F3, tarefa 13.0; `tasks/prd-lgpd-e-titular/cenarios.md`, RF11 a RF13 e RF17): o pedido de acesso gera o
 * JSON fora da requisição, e "Meus dados" e a versão da escola entregam a URL de 5 minutos. Os armazéns são o falso
 * (`InMemoryFileStorage`), que o teste entrega à API e ao processador do job, e o relógio é injetado nos dois: a validade de 7 dias se
 * prova sem esperar. A prova do S3 de verdade (a assinatura aceita pelo SeaweedFS) está em `s3-file-storage.int.test.ts`.
 *
 * Cada pessoa leva **uma sentinela por tabela** que o arquivo lê: o `id` da linha, e o texto onde houver. O que nunca pode
 * aparecer leva uma sentinela própria, e a varredura procura todas no JSON gravado.
 */

const MARCA = randomUUID().slice(0, 8)
const HOJE = (): string => diaDeUso(new Date())

const NAO_ENCONTRADO = { status: 404, corpo: { erro: { codigo: ErrorCode.NAO_ENCONTRADO, mensagem: MENSAGENS_DE_ERRO.NAO_ENCONTRADO } } }

/** A resposta sem o `requisicaoId`, que muda a cada chamada: o resto precisa ser idêntico. */
function semRequisicao(resposta: { status: number; corpo: Record<string, unknown> }): unknown {
  const erro = resposta.corpo['erro'] as Record<string, unknown> | undefined
  if (erro === undefined) return resposta
  const { requisicaoId: _requisicaoId, ...resto } = erro
  return { status: resposta.status, corpo: { ...resposta.corpo, erro: resto } }
}

interface RespostaComCabecalhos {
  readonly status: number
  readonly corpo: Record<string, unknown>
  readonly cabecalhos: Headers
}

interface Pessoa {
  readonly sessao: SessaoDeTeste
  readonly id: string
  readonly nome: string
}

/** O que a semeadura gravou: o id da linha de cada tabela e os textos de cada coluna que o arquivo leva. */
interface Semeado {
  readonly ids: Record<string, string>
  readonly textos: Record<string, string>
}

describe('arquivo do titular (F3, tarefa 13.0): do pedido ao download', () => {
  const bancada = new BancadaDeSessoes()
  const medidor = new MedidorDeTeste()
  const armazem = new InMemoryFileStorage()
  const relogio: Clock & { atual: Date } = { atual: new Date(), agora: () => relogio.atual }
  const linhasDeLog: string[] = []
  let api: ApiDeTeste

  beforeAll(async () => {
    api = await subirApi(
      medidor.medidor,
      { ambiente: { LIMITE_REQ_USUARIO_MIN: '1000', LIMITE_REQ_ESCOLA_MIN: '1000' } },
      linhasDeLog,
      { ...MONTAGEM_DE_TESTE, armazemDeArquivos: armazem, relogioDaPrivacidade: relogio },
    )
  })

  // O relógio volta à hora real antes de cada caso: um caso que falha no meio de uma data do futuro não contamina o seguinte.
  beforeEach(() => {
    relogio.atual = new Date()
  })

  afterAll(async () => {
    await api.app.close()
    await bancada.fechar()
    await medidor.encerrar()
  })

  /** Uma chamada com os cabeçalhos da resposta, que o `chamar` do harness não devolve. */
  async function pedir(sessao: SessaoDeTeste, metodo: string, caminho: string, corpo?: unknown): Promise<RespostaComCabecalhos> {
    const resposta = await fetch(`${api.url}${caminho}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${sessao.token}`, ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
    })
    const texto = await resposta.text()
    return { status: resposta.status, corpo: texto === '' ? {} : (JSON.parse(texto) as Record<string, unknown>), cabecalhos: resposta.headers }
  }

  const registrar = (coordenacao: SessaoDeTeste, titularId: string, extras: Record<string, unknown> = {}) =>
    pedir(coordenacao, 'POST', '/v1/privacidade/pedidos', { titularId, tipo: 'acesso', solicitante: 'titular', chegouEm: HOJE(), chaveEnvio: randomUUID(), ...extras })
  const arquivoDaEscola = (coordenacao: SessaoDeTeste, pedidoId: string, finalidade = 'entregar_ao_titular') =>
    pedir(coordenacao, 'POST', `/v1/privacidade/pedidos/${pedidoId}/arquivo`, { finalidade })
  const meusDados = (sessao: SessaoDeTeste) => pedir(sessao, 'GET', '/v1/meus-dados')
  const baixar = (sessao: SessaoDeTeste, pedidoId: string) => pedir(sessao, 'POST', `/v1/meus-dados/${pedidoId}/baixar`, {})

  /** O job, como o worker o roda: no contexto da escola do pedido, com o armazém e o relógio do teste. */
  async function montar(escolaId: string, pedidoId: string): Promise<void> {
    const processador = criarMontagemDoArquivo({ banco: bancada.banco, armazem, relogio, logger: createLogger({ servico: 'teste', nivel: 'silent' }) })
    const jobId = randomUUID()
    await runInContext({ requisicaoId: randomUUID(), escolaId }, () => processador({ pedidoId }, execucaoDoJob(jobId)))
  }

  /** O JSON que o job gravou para o pedido e a versão, já lido. */
  function documento(escolaId: string, pedidoId: string, versao: 'completa' | 'coordenacao'): Record<string, unknown> {
    const texto = armazem.objetos.get(`titular/${escolaId}/${pedidoId}/${versao}.json`)
    if (texto === undefined) throw new Error(`arquivo ${versao} do pedido não gravado`)
    return JSON.parse(texto) as Record<string, unknown>
  }

  const textoDoObjeto = (escolaId: string, pedidoId: string, versao: 'completa' | 'coordenacao'): string => armazem.objetos.get(`titular/${escolaId}/${pedidoId}/${versao}.json`) ?? ''

  async function inserir(texto: string, parametros: readonly unknown[]): Promise<string> {
    const { rows } = await bancada.pool.query<{ id: string }>(texto, [...parametros])
    const id = rows[0]?.id
    if (id === undefined) throw new Error('a inserção de teste não devolveu o id')
    return id
  }

  interface Cenario {
    readonly escola: EscolaComTurma
    readonly escolaId: string
    readonly coordenacao: SessaoDeTeste
  }

  async function novaEscola(): Promise<Cenario> {
    const escola = await montarEscolaComTurma(api, bancada)
    return { escola, escolaId: escola.coordenacao.escolaId, coordenacao: escola.coordenacao }
  }

  /** Uma pessoa da escola com nome sentinela, e o vínculo confirmado dela na turma (aluno) ou na turma e disciplina (professor). */
  async function pessoa(cenario: Cenario, papel: 'aluno' | 'professor', rotulo: string): Promise<Pessoa> {
    const [sessao] = await bancada.sessoes(cenario.escolaId, { papel, quantidade: 1 })
    if (sessao === undefined) throw new Error('sessão de teste não criada')
    const nome = `${rotulo}-${MARCA}-${randomUUID().slice(0, 6)}`
    await bancada.pool.query('update usuario set nome = $1 where id = $2', [nome, sessao.usuarioId])
    await bancada.pool.query(
      `insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, criado_por, decidido_em) values ($1, $2, $3, $4, $5, $6, 'confirmado', $7, now())`,
      [cenario.escolaId, cenario.escola.anoLetivoId, sessao.usuarioId, cenario.escola.turma, papel === 'professor' ? cenario.escola.quimica : null, papel, cenario.coordenacao.usuarioId],
    )
    return { sessao, id: sessao.usuarioId, nome }
  }

  /** Uma atividade aplicada com artefato próprio: o banco só aceita uma aberta por turma e artefato. */
  async function atividadeAplicada(cenario: Cenario, criadoPor: string, titulo = 'Atividade da turma'): Promise<{ artefato: string; aplicada: string }> {
    const { escolaId, escola } = cenario
    const artefato = await inserir(
      `insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, criado_por) values ($1, $2, $3, $4, 'atividade_objetiva', $5, '{"tipo":"atividade_objetiva","questoes":[]}'::jsonb, $6) returning id`,
      [escolaId, escola.anoLetivoId, escola.turma, escola.quimica, titulo, criadoPor],
    )
    const aplicada = await inserir(`insert into atividade_aplicada (escola_id, ano_letivo_id, turma_id, artefato_id, avaliativa, aplicada_por) values ($1, $2, $3, $4, false, $5) returning id`, [
      escolaId,
      escola.anoLetivoId,
      escola.turma,
      artefato,
      criadoPor,
    ])
    return { artefato, aplicada }
  }

  /**
   * Aprova o lote como o produto aprova: o registro da validação entra antes, e só então a entrega passa a `aprovada` (o gatilho
   * `entrega_lote_aprovado_com_validacao` recusa o lote aprovado sem ele).
   */
  async function aprovarLote(cenario: Cenario, entregaId: string, aplicadaId: string, professorId: string, marca: string, alunoDestacado?: string): Promise<string> {
    const { escolaId, escola } = cenario
    // O aluno destacado, se houver, consta do que foi apresentado e do que foi aberto (o gatilho dos destaques do lote).
    const destaques = alunoDestacado === undefined ? [] : [{ alunoId: alunoDestacado, motivos: ['em_branco'] }]
    const abertos = alunoDestacado === undefined ? [] : [{ alunoId: alunoDestacado }]
    const validacao = await inserir(
      `insert into validacao_do_lote (escola_id, ano_letivo_id, entrega_id, atividade_aplicada_id, apresentado, aberto, confirmada_por)
       values ($1, $2, $3, $4, jsonb_build_object('resumo', jsonb_build_object('marca', $5::text), 'destaques', $7::jsonb), $8::jsonb, $6) returning id`,
      [escolaId, escola.anoLetivoId, entregaId, aplicadaId, marca, professorId, JSON.stringify(destaques), JSON.stringify(abertos)],
    )
    await bancada.pool.query(`update entrega set estado = 'aprovada', decidida_por = $2, decidida_em = now() where id = $1`, [entregaId, professorId])
    return validacao
  }

  const sentinela = (quem: string): string => `sentinela-${quem}-${MARCA}-${randomUUID().slice(0, 8)}`

  /**
   * Uma linha em cada tabela do arquivo que o **aluno** tem, com as colunas proibidas preenchidas com sentinela. As
   * tabelas de professor ficam para `semearProfessor`: o gatilho `exigir_equipe_da_escola` só aceita gente da equipe na
   * conversa do Assistente, no artefato e no material.
   */
  async function semearAluno(cenario: Cenario, aluno: Pessoa): Promise<Semeado> {
    const { escolaId, escola } = cenario
    const { anoLetivoId, turma } = escola
    const ids: Record<string, string> = { usuario: aluno.id }
    const textos: Record<string, string> = {}
    const professor = cenario.coordenacao.usuarioId

    textos['credencial_matricula.matricula'] = `mat-${MARCA}-${randomUUID().slice(0, 6)}`
    ids['credencial_matricula'] = await inserir('insert into credencial_matricula (escola_id, usuario_id, matricula, senha_hash) values ($1, $2, $3, $4) returning id', [
      escolaId,
      aluno.id,
      textos['credencial_matricula.matricula'],
      sentinela('senha-hash-da-matricula'),
    ])
    ids['conta_externa'] = await inserir(`insert into conta_externa (escola_id, usuario_id, provedor, tenant, sujeito) values ($1, $2, 'microsoft', $3, $4) returning id`, [
      escolaId,
      aluno.id,
      sentinela('tenant-da-conta-externa'),
      sentinela('sujeito-da-conta-externa'),
    ])
    ids['lista_nome'] = await inserir(`insert into lista_nome (escola_id, ano_letivo_id, turma_id, estado, usuario_id, criado_por) values ($1, $2, $3, 'aprovado', $4, $5) returning id`, [
      escolaId,
      anoLetivoId,
      turma,
      aluno.id,
      professor,
    ])
    ids['reivindicacao'] = await inserir(
      `insert into reivindicacao (escola_id, ano_letivo_id, turma_id, lista_nome_id, estado, decidida_em, decidida_por, decidida_como) values ($1, $2, $3, $4, 'aprovada', now(), $5, 'coordenacao') returning id`,
      [escolaId, anoLetivoId, turma, ids['lista_nome'], professor],
    )
    ids['registro_acesso'] = await inserir(`insert into registro_acesso (escola_id, usuario_id, evento, ip) values ($1, $2, 'login', '203.0.113.9') returning id`, [escolaId, aluno.id])
    await bancada.pool.query('update sessao set refresh_hash = $1, refresh_hash_anterior = $2 where id = $3', [sentinela('refresh-hash'), sentinela('refresh-hash-anterior'), aluno.sessao.sessaoId])
    ids['sessao'] = aluno.sessao.sessaoId

    // A execução do Tutor, o texto do modelo e a conversa.
    ids['execucao_agente'] = await inserir(
      `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada) values ($1, $2, 'tutor_com_o_aluno', 'turno_do_tutor', $3, $4, '{"tarefa":"turno_do_tutor"}'::jsonb) returning id`,
      [escolaId, anoLetivoId, aluno.id, randomUUID()],
    )
    // A chamada do Tutor não guarda texto (o check `consumo_ia_sem_conversa_de_pessoa`): a conversa está em `mensagem_tutor`.
    ids['consumo_ia'] = await inserir(
      `insert into consumo_ia (escola_id, aluno_id, execucao_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, duracao_ms, envio_externo, provedor, tentativas, estado)
       values ($1, $2, $3, 'turno_do_tutor', 'tutor_com_o_aluno', 'padrao', 'openai_compat', 'modelo-sintetico', 'v1', 10, 20, 30, true, 'provedor-sintetico', 1, 'concluida') returning id`,
      [escolaId, aluno.id, ids['execucao_agente']],
    )
    textos['mensagem_tutor.texto'] = sentinela('pergunta-ao-tutor')
    ids['mensagem_tutor'] = await inserir(
      `insert into mensagem_tutor (escola_id, ano_letivo_id, turma_id, aluno_id, execucao_id, autor, texto) values ($1, $2, $3, $4, $5, 'aluno', $6) returning id`,
      [escolaId, anoLetivoId, turma, aluno.id, ids['execucao_agente'], textos['mensagem_tutor.texto']],
    )
    ids['sinal_tutor'] = await inserir(`insert into sinal_tutor (escola_id, ano_letivo_id, turma_id, aluno_id, tipo) values ($1, $2, $3, $4, 'travou') returning id`, [escolaId, anoLetivoId, turma, aluno.id])

    // O trabalho: três atividades aplicadas, com a tentativa, a resposta e a correção do aluno em lote pendente, aprovado e rejeitado.
    for (const [estado, rotulo] of [['aprovada', 'aprovado'], ['pendente', 'pendente'], ['rejeitada', 'rejeitado']] as const) {
      const { aplicada } = await atividadeAplicada(cenario, professor)
      ids[`tentativa_atividade.${rotulo}`] = await inserir(`insert into tentativa_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id) values ($1, $2, $3, $4) returning id`, [escolaId, anoLetivoId, aplicada, aluno.id])
      ids[`resposta_atividade.${rotulo}`] = await inserir(`insert into resposta_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, questao, alternativa) values ($1, $2, $3, $4, 1, 2) returning id`, [
        escolaId,
        anoLetivoId,
        aplicada,
        aluno.id,
      ])
      // A aprovada nasce pendente e é aprovada depois, com a validação (o gatilho a exige).
      const decisao = estado === 'rejeitada' ? [professor, new Date().toISOString(), 'Rejeitada por causa de teste sintético'] : [null, null, null]
      const entrega = await inserir(
        `insert into entrega (escola_id, ano_letivo_id, turma_id, funcao, tipo, atividade_aplicada_id, estado, decidida_por, decidida_em, justificativa)
         values ($1, $2, $3, 'correcao_de_objetiva', 'lote_de_correcao', $4, $5, $6, $7, $8) returning id`,
        [escolaId, anoLetivoId, turma, aplicada, estado === 'aprovada' ? 'pendente' : estado, ...decisao],
      )
      textos[`correcao.${rotulo}`] = sentinela(`diagnostico-${rotulo}`)
      ids[`correcao.${rotulo}`] = await inserir(
        `insert into correcao (escola_id, ano_letivo_id, entrega_id, atividade_aplicada_id, aluno_id, acertos, total, em_branco, por_habilidade)
         values ($1, $2, $3, $4, $5, 7, 10, 1, jsonb_build_array(jsonb_build_object('habilidade', $6::text, 'acertos', 7, 'total', 10))) returning id`,
        [escolaId, anoLetivoId, entrega, aplicada, aluno.id, textos[`correcao.${rotulo}`]],
      )
      if (estado === 'aprovada') await aprovarLote(cenario, entrega, aplicada, professor, sentinela('lote-do-aluno'))
    }
    // Tabelas do arquivo que só têm uma linha por aluno: o primeiro dos três vale.
    ids['tentativa_atividade'] = ids['tentativa_atividade.aprovado'] ?? ''
    ids['resposta_atividade'] = ids['resposta_atividade.aprovado'] ?? ''
    ids['correcao'] = ids['correcao.aprovado'] ?? ''
    return { ids, textos }
  }

  /** Uma linha em cada tabela do arquivo que o **professor** tem, com as colunas proibidas preenchidas com sentinela. */
  async function semearProfessor(cenario: Cenario, professor: Pessoa): Promise<Semeado> {
    const { escolaId, escola } = cenario
    const { anoLetivoId, turma, quimica } = escola
    const ids: Record<string, string> = { usuario: professor.id }
    const textos: Record<string, string> = {}

    textos['conta.email'] = `${sentinela('email')}@escola.invalid`
    const { rows: contas } = await bancada.pool.query<{ conta_id: string }>('select conta_id from usuario where id = $1', [professor.id])
    const contaId = contas[0]?.conta_id
    if (contaId === undefined) throw new Error('o professor de teste não tem conta')
    await bancada.pool.query('update conta set email = $1, senha_hash = $2, mfa_ultimo_passo = 42 where id = $3', [textos['conta.email'], sentinela('senha-hash-da-conta'), contaId])
    ids['conta'] = contaId
    textos['credencial_matricula.matricula'] = `mat-${MARCA}-${randomUUID().slice(0, 6)}`
    ids['credencial_matricula'] = await inserir('insert into credencial_matricula (escola_id, usuario_id, matricula, senha_hash) values ($1, $2, $3, $4) returning id', [
      escolaId,
      professor.id,
      textos['credencial_matricula.matricula'],
      sentinela('senha-hash-da-matricula'),
    ])
    ids['conta_externa'] = await inserir(`insert into conta_externa (escola_id, usuario_id, provedor, tenant, sujeito) values ($1, $2, 'microsoft', $3, $4) returning id`, [
      escolaId,
      professor.id,
      sentinela('tenant-da-conta-externa'),
      sentinela('sujeito-da-conta-externa'),
    ])
    ids['registro_acesso'] = await inserir(`insert into registro_acesso (escola_id, usuario_id, evento, ip) values ($1, $2, 'login', '203.0.113.10') returning id`, [escolaId, professor.id])
    await bancada.pool.query('update sessao set refresh_hash = $1, refresh_hash_anterior = $2 where id = $3', [sentinela('refresh-hash'), sentinela('refresh-hash-anterior'), professor.sessao.sessaoId])
    ids['sessao'] = professor.sessao.sessaoId
    const { rows: vinculos } = await bancada.pool.query<{ id: string }>("select id from vinculo where usuario_id = $1 and escola_id = $2 and papel = 'professor'", [professor.id, escolaId])
    ids['vinculo'] = vinculos[0]?.id ?? ''

    // O que ele pediu à IA: o tema, o texto do modelo, a conversa e o material gerado.
    textos['execucao_agente.entrada'] = sentinela('tema-da-aula')
    ids['execucao_agente'] = await inserir(
      `insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada)
       values ($1, $2, 'conversa_e_ferramentas', 'gerar_atividade_objetiva', $3, $4, jsonb_build_object('tarefa', 'gerar_atividade_objetiva', 'tema', $5::text)) returning id`,
      [escolaId, anoLetivoId, professor.id, randomUUID(), textos['execucao_agente.entrada']],
    )
    textos['consumo_ia.entrada'] = sentinela('texto-enviado-ao-modelo')
    textos['consumo_ia.saida'] = sentinela('texto-do-modelo')
    ids['consumo_ia'] = await inserir(
      `insert into consumo_ia (escola_id, execucao_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, duracao_ms, envio_externo, provedor, tentativas, estado, entrada, saida)
       values ($1, $2, 'gerar_atividade_objetiva', 'conversa_e_ferramentas', 'padrao', 'openai_compat', 'modelo-sintetico', 'v1', 10, 20, 30, true, $3, 1, 'concluida', to_jsonb($4::text), to_jsonb($5::text)) returning id`,
      [escolaId, ids['execucao_agente'], PROVEDOR_DO_USO, textos['consumo_ia.entrada'], textos['consumo_ia.saida']],
    )
    ids['thread_agente'] = await inserir(`insert into thread_agente (escola_id, ano_letivo_id, usuario_id, agente) values ($1, $2, $3, 'assistente_de_ensino') returning id`, [escolaId, anoLetivoId, professor.id])
    textos['mensagem_agente.conteudo'] = sentinela('o-que-escrevi-ao-assistente')
    ids['mensagem_agente'] = await inserir(
      `insert into mensagem_agente (escola_id, ano_letivo_id, thread_id, execucao_id, autor, conteudo, turma_id, disciplina_id)
       values ($1, $2, $3, $4, 'usuario', jsonb_build_object('tipo', 'texto', 'texto', $5::text), $6, $7) returning id`,
      [escolaId, anoLetivoId, ids['thread_agente'], ids['execucao_agente'], textos['mensagem_agente.conteudo'], turma, quimica],
    )
    textos['artefato.titulo'] = sentinela('titulo-do-material')
    textos['artefato.conteudo'] = sentinela('gabarito-do-artefato')
    ids['artefato'] = await inserir(
      `insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, criado_por, execucao_id)
       values ($1, $2, $3, $4, 'atividade_objetiva', $5, jsonb_build_object('tipo', 'atividade_objetiva', 'questoes', jsonb_build_array(), 'gabarito', $6::text), $7, $8) returning id`,
      [escolaId, anoLetivoId, turma, quimica, textos['artefato.titulo'], textos['artefato.conteudo'], professor.id, ids['execucao_agente']],
    )
    ids['atividade_aplicada'] = (await atividadeAplicada(cenario, professor.id)).aplicada
    // O professor rejeitou um lote de correção (com justificativa) e aprovou outro (com a validação registrada).
    textos['entrega.justificativa'] = sentinela('porque-rejeitei-o-lote')
    ids['entrega'] = await inserir(
      `insert into entrega (escola_id, ano_letivo_id, turma_id, funcao, tipo, atividade_aplicada_id, estado, decidida_por, decidida_em, justificativa)
       values ($1, $2, $3, 'correcao_de_objetiva', 'lote_de_correcao', $4, 'rejeitada', $5, now(), $6) returning id`,
      [escolaId, anoLetivoId, turma, ids['atividade_aplicada'], professor.id, textos['entrega.justificativa']],
    )
    const aplicadaDoLoteAprovado = (await atividadeAplicada(cenario, professor.id)).aplicada
    const loteAprovado = await inserir(
      `insert into entrega (escola_id, ano_letivo_id, turma_id, funcao, tipo, atividade_aplicada_id, estado)
       values ($1, $2, $3, 'correcao_de_objetiva', 'lote_de_correcao', $4, 'pendente') returning id`,
      [escolaId, anoLetivoId, turma, aplicadaDoLoteAprovado],
    )
    // Quem abre o destaque: a correção é de um aluno, e só o ato entra no arquivo do professor.
    const aluno = await pessoa(cenario, 'aluno', 'AlunoDoDestaque')
    ids['aluno_do_destaque'] = aluno.id
    textos['aluno_do_destaque.nome'] = aluno.nome
    textos['correcao.do_aluno'] = sentinela('diagnostico-de-outro-aluno')
    await inserir(`insert into tentativa_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id) values ($1, $2, $3, $4) returning id`, [escolaId, anoLetivoId, aplicadaDoLoteAprovado, aluno.id])
    ids['correcao'] = await inserir(
      `insert into correcao (escola_id, ano_letivo_id, entrega_id, atividade_aplicada_id, aluno_id, acertos, total, em_branco, por_habilidade, destaques, destaque_aberto_em, destaque_aberto_por)
       values ($1, $2, $3, $4, $5, 3, 10, 2, jsonb_build_array(jsonb_build_object('habilidade', $6::text)), array['em_branco']::text[], now(), $7) returning id`,
      [escolaId, anoLetivoId, loteAprovado, aplicadaDoLoteAprovado, aluno.id, textos['correcao.do_aluno'], professor.id],
    )
    textos['validacao_do_lote.resumo'] = sentinela('resumo-do-lote-validado')
    ids['validacao_do_lote'] = await aprovarLote(cenario, loteAprovado, aplicadaDoLoteAprovado, professor.id, textos['validacao_do_lote.resumo'], aluno.id)
    // O professor decidiu a reivindicação de outro aluno: só o ato entra no arquivo dele.
    const listaDoOutro = await inserir(`insert into lista_nome (escola_id, ano_letivo_id, turma_id, estado, usuario_id, criado_por) values ($1, $2, $3, 'aprovado', $4, $5) returning id`, [
      escolaId,
      anoLetivoId,
      turma,
      aluno.id,
      cenario.coordenacao.usuarioId,
    ])
    ids['lista_do_outro'] = listaDoOutro
    ids['reivindicacao'] = await inserir(
      `insert into reivindicacao (escola_id, ano_letivo_id, turma_id, lista_nome_id, estado, decidida_em, decidida_por, decidida_como) values ($1, $2, $3, $4, 'aprovada', now(), $5, 'professor') returning id`,
      [escolaId, anoLetivoId, turma, listaDoOutro, professor.id],
    )
    ids['material'] = await inserir(
      `insert into material (escola_id, disciplina_id, titulo, titularidade, licenca, declaracao, sha256, tamanho_bytes, estado, paginas, enviado_por, licenciante)
       values ($1, $2, 'Material de teste', 'terceiro_com_licenca', 'licenca_aberta', true, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 1024, 'pronto', 3, $3, $4) returning id`,
      [escolaId, quimica, professor.id, sentinela('licenciante')],
    )
    textos['material.licenciante'] = (await bancada.pool.query<{ licenciante: string }>('select licenciante from material where id = $1', [ids['material']])).rows[0]?.licenciante ?? ''
    // Retomada na hora, por outra pessoa: o banco só aceita uma suspensão vigente por função, e dois professores da escola semeiam.
    ids['suspensao_de_funcao'] = await inserir(
      `insert into suspensao_de_funcao (escola_id, funcao, motivo, suspensa_por, retomada_por, retomada_em) values ($1, 'adaptacao', 'revisao_pedagogica', $2, $3, now() + interval '1 second') returning id`,
      [escolaId, professor.id, cenario.coordenacao.usuarioId],
    )
    ids['auditoria'] = await inserir(
      `insert into auditoria (escola_id, autor_usuario_id, acao, entidade, entidade_id, requisicao_id) values ($1, $2, 'teste.sentinela', 'escola', $1, $3) returning id`,
      [escolaId, professor.id, randomUUID()],
    )
    // Os atos do professor sobre outro aluno, com o `depois` que a auditoria de verdade grava: o id do aluno e o motivo.
    await bancada.pool.query(
      `insert into auditoria (escola_id, autor_usuario_id, acao, entidade, entidade_id, requisicao_id, depois) values
         ($1, $2, 'correcao.destaque_aberto', 'entrega', $3, $5, jsonb_build_object('atividadeAplicadaId', $4::text, 'alunoId', $6::text, 'motivos', jsonb_build_array('em_branco'))),
         ($1, $2, 'reivindicacao.decidida', 'reivindicacao', $7, $8, jsonb_build_object('turmaId', $9::text, 'estado', 'aprovada', 'decididaComo', 'professor', 'alunoId', $6::text))`,
      [escolaId, professor.id, loteAprovado, aplicadaDoLoteAprovado, randomUUID(), aluno.id, ids['reivindicacao'], randomUUID(), turma],
    )
    return { ids, textos }
  }

  /** O provedor externo do uso de um professor nos testes de D64. */
  const PROVEDOR_DO_USO = `provedor-${MARCA}`

  /** Registra o pedido, roda o job e devolve o id. */
  async function pedidoPronto(cenario: Cenario, titular: Pessoa, extras: Record<string, unknown> = {}): Promise<string> {
    const criado = await registrar(cenario.coordenacao, titular.id, extras)
    expect(criado.status).toBe(201)
    const id = criado.corpo['id'] as string
    await tirarDaFila(cenario.escolaId, id)
    await montar(cenario.escolaId, id)
    return id
  }

  /**
   * Tira da fila o job `titular.montar-arquivo` que a API enfileirou para o pedido, e deixa o teste como o único que monta
   * o arquivo. Sem isso, um worker de pé na pilha (o `test:e2e --manter-ambiente` os deixa) roda o mesmo job e regrava a
   * linha com a hora real, em momento que o teste não controla.
   *
   * O `update` só pega o job ainda `aguardando`: o despachante reserva só `aguardando`, com a mesma condição no `update`, e o
   * executor não roda job `concluido`. Então ou o teste ganha a linha e nenhum worker vai rodá-lo, ou o despachante já a
   * tinha; nesse caso o teste espera o job terminar e desfaz o que ele fez (a linha do arquivo e o estado `pronto`), e o
   * pedido volta a ser o de quem acabou de registrar. Depois desta chamada, a linha só muda pela mão do próprio teste.
   */
  async function tirarDaFila(escolaId: string, pedidoId: string): Promise<void> {
    const filtro = `escola_id = $1 and tipo = '${TIPO_MONTAR_ARQUIVO}' and dados->>'pedidoId' = $2`
    const { rowCount } = await bancada.pool.query(`update job_registro set estado = 'concluido', concluido_em = now() where ${filtro} and estado = 'aguardando'`, [escolaId, pedidoId])
    if (rowCount === 1) return
    const limite = Date.now() + 15_000
    for (;;) {
      const { rows } = await bancada.pool.query<{ estado: string }>(`select estado from job_registro where ${filtro}`, [escolaId, pedidoId])
      const estado = rows[0]?.estado
      if (estado === 'concluido' || estado === 'falhou') break
      if (Date.now() > limite) throw new Error(`o job do pedido ficou em '${estado ?? 'sem linha'}': há um despachante sem worker na pilha`)
      await new Promise((pronto) => setTimeout(pronto, 100))
    }
    await bancada.pool.query('delete from arquivo_titular where escola_id = $1 and pedido_id = $2', [escolaId, pedidoId])
    await bancada.pool.query(`update pedido_titular set estado = 'em_preparacao' where escola_id = $1 and id = $2`, [escolaId, pedidoId])
  }

  const UM_DIA_MS = 86_400_000

  /**
   * A validade do arquivo como a linha a tem agora: o instante em que ficou pronto e o em que vence. A linha tem um escritor só, o
   * `montar` do teste, depois de `tirarDaFila`; lida uma vez, ela vale para o resto do caso.
   */
  async function validadeDoArquivo(pedidoId: string, versao: 'completa' | 'coordenacao' = 'completa'): Promise<{ prontoEm: Date; expiraEm: Date }> {
    const { rows } = await bancada.pool.query<{ pronto_em: Date; expira_em: Date }>('select pronto_em, expira_em from arquivo_titular where pedido_id = $1 and versao = $2', [pedidoId, versao])
    const linha = rows[0]
    if (linha === undefined) throw new Error('o pedido não tem o arquivo gravado')
    return { prontoEm: linha.pronto_em, expiraEm: linha.expira_em }
  }

  describe('conteúdo (RF11): uma sentinela por tabela, nada de outro titular nem de outra escola', () => {
    it('o aluno: cada tabela que ele tem aparece, e a linha de outro aluno e a de outra escola não', async () => {
      const cenario = await novaEscola()
      const aluno = await pessoa(cenario, 'aluno', 'Aluno')
      const semeado = await semearAluno(cenario, aluno)
      // Outro aluno da mesma escola, e uma escola B com o mesmo tipo de linha: nada disso entra no arquivo do primeiro.
      const outro = await pessoa(cenario, 'aluno', 'OutroAluno')
      const doOutro = await semearAluno(cenario, outro)
      const escolaB = await novaEscola()
      const alunoB = await pessoa(escolaB, 'aluno', 'AlunoDeB')
      const deB = await semearAluno(escolaB, alunoB)

      // O pedido de outro aluno da mesma escola, no mesmo estado: não entra no arquivo do primeiro.
      const pedidoDoOutro = await pedidoPronto(cenario, outro)
      const pedidoId = await pedidoPronto(cenario, aluno)
      const arquivo = documento(cenario.escolaId, pedidoId, 'completa')
      const tabelas = arquivo['tabelas'] as Record<string, Array<{ id: string }>>
      expect((tabelas['pedido_titular'] ?? []).map(({ id }) => id)).toEqual([pedidoId])
      expect(textoDoObjeto(cenario.escolaId, pedidoId, 'completa')).not.toContain(pedidoDoOutro)
      // Tabela sem linha do titular não vira chave vazia, nem linha do resumo; o aluno não tem conversa de professor nem uso real.
      expect(Object.values(tabelas).every((linhas) => linhas.length > 0)).toBe(true)
      // A chamada do Tutor casa pelo `aluno_id` e pela execução que ele pediu, e entra uma vez só.
      expect((tabelas['consumo_ia'] ?? []).map(({ id }) => id)).toEqual([semeado.ids['consumo_ia']])
      expect(tabelas['thread_agente']).toBeUndefined()
      expect(tabelas['mensagem_agente']).toBeUndefined()
      expect((arquivo['resumo'] as Array<{ registros: number }>).every(({ registros }) => registros > 0)).toBe(true)
      expect(Object.keys(arquivo['compartilhamento'] as object)).toEqual(['empresas'])
      const tabelasDoAluno = ['usuario', 'credencial_matricula', 'conta_externa', 'lista_nome', 'reivindicacao', 'sessao', 'registro_acesso', 'mensagem_tutor', 'sinal_tutor', 'execucao_agente', 'consumo_ia', 'tentativa_atividade', 'resposta_atividade', 'correcao']
      for (const tabela of tabelasDoAluno) {
        expect(tabelas[tabela]?.map(({ id }) => id), `${tabela} sem a linha do aluno`).toContain(semeado.ids[tabela])
      }
      const texto = textoDoObjeto(cenario.escolaId, pedidoId, 'completa')
      for (const tabela of tabelasDoAluno) expect(texto, `${tabela} do outro aluno entrou`).not.toContain(doOutro.ids[tabela] ?? 'nada')
      for (const id of Object.values(deB.ids)) expect(texto, 'linha de outra escola no arquivo').not.toContain(id)
      for (const valor of [...Object.values(doOutro.textos), ...Object.values(deB.textos), outro.nome, alunoB.nome]) expect(texto, valor).not.toContain(valor)
      // O texto da conversa do Tutor e o texto do modelo, nas colunas que levam texto.
      expect(texto).toContain(semeado.textos['mensagem_tutor.texto'])
      expect(texto).toContain(aluno.nome)
      // Quem tem conta ativa nesta escola não tem a versão da escola.
      expect(armazem.objetos.has(`titular/${cenario.escolaId}/${pedidoId}/coordenacao.json`)).toBe(false)
      // O resumo diz, em linguagem comum, o que o arquivo leva.
      const resumo = arquivo['resumo'] as Array<{ conteudo: string; registros: number }>
      expect(resumo.find(({ conteudo }) => conteudo === 'Sua conversa com o Tutor')).toEqual({ conteudo: 'Sua conversa com o Tutor', registros: 1 })
    })

    it('o professor: cada tabela que ele tem aparece, com o e-mail da conta, e nada do colega nem de outra escola da mesma conta', async () => {
      const cenario = await novaEscola()
      const professor = await pessoa(cenario, 'professor', 'Professor')
      const semeado = await semearProfessor(cenario, professor)
      const colega = await pessoa(cenario, 'professor', 'Colega')
      const doColega = await semearProfessor(cenario, colega)
      // O mesmo professor, na mesma conta, também dá aula na escola B: o que é de B não entra no arquivo de A.
      const escolaB = await novaEscola()
      const emB = await bancada.sessaoDaMesmaConta(professor.id, escolaB.escolaId)
      void emB
      const { rows: usuarioDeB } = await bancada.pool.query<{ id: string }>('select id from usuario where escola_id = $1 and conta_id = $2', [escolaB.escolaId, semeado.ids['conta']])
      const idDeB = usuarioDeB[0]?.id ?? ''
      const artefatoDeB = await inserir(
        `insert into artefato (escola_id, ano_letivo_id, turma_id, disciplina_id, tipo, titulo, conteudo, criado_por) values ($1, $2, $3, $4, 'atividade_objetiva', $5, '{"tipo":"atividade_objetiva","questoes":[]}'::jsonb, $6) returning id`,
        [escolaB.escolaId, escolaB.escola.anoLetivoId, escolaB.escola.turma, escolaB.escola.quimica, sentinela('titulo-em-B'), idDeB],
      )

      const pedidoId = await pedidoPronto(cenario, professor)
      const arquivo = documento(cenario.escolaId, pedidoId, 'completa')
      const tabelas = arquivo['tabelas'] as Record<string, Array<{ id: string }>>
      const tabelasDoProfessor = [
        'usuario', 'conta', 'credencial_matricula', 'conta_externa', 'vinculo', 'sessao', 'registro_acesso', 'thread_agente', 'mensagem_agente', 'execucao_agente', 'consumo_ia', 'artefato',
        'entrega', 'atividade_aplicada', 'validacao_do_lote', 'correcao', 'reivindicacao', 'material', 'suspensao_de_funcao', 'auditoria',
      ]
      for (const tabela of tabelasDoProfessor) expect(tabelas[tabela]?.map(({ id }) => id), `${tabela} sem a linha do professor`).toContain(semeado.ids[tabela])
      const texto = textoDoObjeto(cenario.escolaId, pedidoId, 'completa')
      expect(texto).toContain(semeado.textos['conta.email'])
      // O nome do dono do direito do material é de terceiro e não é do titular.
      expect(texto).not.toContain(semeado.textos['material.licenciante'])
      for (const id of Object.values(doColega.ids)) expect(texto, 'linha do colega no arquivo').not.toContain(id)
      expect(texto).not.toContain(artefatoDeB)
      expect(texto).not.toContain('titulo-em-B')
      // O pedido sobre ele mesmo: o `pedido_titular` do arquivo é o dele.
      expect((tabelas['pedido_titular'] ?? []).map(({ id }) => id)).toEqual([pedidoId])
    })

    it('o ato do professor sobre outro aluno entra sem o dado do aluno, nas duas versões', async () => {
      const cenario = await novaEscola()
      const professor = await pessoa(cenario, 'professor', 'Professor')
      const semeado = await semearProfessor(cenario, professor)
      await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [professor.id])
      const pedidoId = await pedidoPronto(cenario, professor)
      for (const versao of ['completa', 'coordenacao'] as const) {
        const texto = textoDoObjeto(cenario.escolaId, pedidoId, versao)
        for (const valor of [
          semeado.textos['correcao.do_aluno'],
          semeado.textos['validacao_do_lote.resumo'],
          semeado.ids['aluno_do_destaque'],
          semeado.textos['aluno_do_destaque.nome'],
          semeado.ids['lista_do_outro'],
        ]) {
          expect(texto, `${versao}: ${String(valor)}`).not.toContain(String(valor))
        }
        // O ato entra: o professor sabe que abriu o destaque.
        expect(texto, versao).toContain('correcao.destaque_aberto')
      }
    })

    it('a data da introdução vista sai no arquivo do próprio titular; a versão da coordenação não traz a do professor (D64), e traz a do aluno', async () => {
      const cenario = await novaEscola()
      const professor = await pessoa(cenario, 'professor', 'Professor')
      const aluno = await pessoa(cenario, 'aluno', 'Aluno')
      const vista = '2020-01-02T03:04:05.678Z'
      for (const titular of [professor, aluno]) {
        await bancada.pool.query('update usuario set introducao_vista_em = $1, desativado_em = now() where id = $2', [vista, titular.id])
      }
      const pedidoDoProfessor = await pedidoPronto(cenario, professor)
      const pedidoDoAluno = await pedidoPronto(cenario, aluno)
      const dataNoArquivo = (pedidoId: string, versao: 'completa' | 'coordenacao') => {
        const tabelas = documento(cenario.escolaId, pedidoId, versao)['tabelas'] as Record<string, Array<Record<string, unknown>>>
        const [linha] = tabelas['usuario'] ?? []
        if (linha === undefined) throw new Error('o arquivo não tem a linha do usuário')
        // O JSON do banco traz o instante com o deslocamento do servidor: compara-se o instante, e não o texto.
        const data = linha['introducao_vista_em']
        return typeof data === 'string' ? new Date(data).toISOString() : null
      }

      expect(dataNoArquivo(pedidoDoProfessor, 'completa')).toBe(vista)
      expect(dataNoArquivo(pedidoDoProfessor, 'coordenacao')).toBeNull()
      expect(dataNoArquivo(pedidoDoAluno, 'completa')).toBe(vista)
      expect(dataNoArquivo(pedidoDoAluno, 'coordenacao')).toBe(vista)
    })

    it('o arquivo do aluno não leva o id da coordenação nem a leitura que ela fez do titular, nas duas versões', async () => {
      const cenario = await novaEscola()
      const aluno = await pessoa(cenario, 'aluno', 'Aluno')
      await semearAluno(cenario, aluno)
      await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [aluno.id])
      const criado = await registrar(cenario.coordenacao, aluno.id)
      expect(criado.status).toBe(201)
      const pedidoId = criado.corpo['id'] as string
      // A coordenação lê a prévia e o pedido antes do job: as duas leituras ficam na auditoria, com o id dela.
      expect((await pedir(cenario.coordenacao, 'GET', `/v1/privacidade/titulares/${aluno.id}/previa`)).status).toBe(200)
      expect((await pedir(cenario.coordenacao, 'GET', `/v1/privacidade/pedidos/${pedidoId}`)).status).toBe(200)
      await montar(cenario.escolaId, pedidoId)
      for (const versao of ['completa', 'coordenacao'] as const) {
        const texto = textoDoObjeto(cenario.escolaId, pedidoId, versao)
        expect(texto.length, versao).toBeGreaterThan(100)
        expect(texto, versao).not.toContain(cenario.coordenacao.usuarioId)
        expect(texto, versao).not.toContain('titular.previa_lida')
        expect(texto, versao).not.toContain('pedido.lido')
      }
    })
  })

  describe('colunas proibidas (RF11, RF17)', () => {
    it('nenhuma coluna de COLUNAS_FORA_DO_ARQUIVO aparece, em nenhuma das duas versões', async () => {
      const cenario = await novaEscola()
      const professor = await pessoa(cenario, 'professor', 'Professor')
      const semeado = await semearProfessor(cenario, professor)
      await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [professor.id])
      const pedidoId = await pedidoPronto(cenario, professor)
      const { rows: pedido } = await bancada.pool.query<{ chave_envio: string }>('select chave_envio from pedido_titular where id = $1', [pedidoId])
      const { rows: segredos } = await bancada.pool.query<{ refresh_hash: string; refresh_hash_anterior: string }>('select refresh_hash, refresh_hash_anterior from sessao where id = $1', [professor.sessao.sessaoId])
      const { rows: contas } = await bancada.pool.query<{ senha_hash: string }>('select senha_hash from conta where id = $1', [semeado.ids['conta']])
      const { rows: credencial } = await bancada.pool.query<{ senha_hash: string }>('select senha_hash from credencial_matricula where id = $1', [semeado.ids['credencial_matricula']])
      const { rows: externa } = await bancada.pool.query<{ tenant: string; sujeito: string }>('select tenant, sujeito from conta_externa where id = $1', [semeado.ids['conta_externa']])
      const { rows: execucao } = await bancada.pool.query<{ chave_envio: string }>('select chave_envio from execucao_agente where id = $1', [semeado.ids['execucao_agente']])
      const proibidos = [
        pedido[0]?.chave_envio,
        segredos[0]?.refresh_hash,
        segredos[0]?.refresh_hash_anterior,
        contas[0]?.senha_hash,
        credencial[0]?.senha_hash,
        externa[0]?.tenant,
        externa[0]?.sujeito,
        execucao[0]?.chave_envio,
      ]
      expect(proibidos.every((valor) => typeof valor === 'string' && valor.length > 10)).toBe(true)
      expect(COLUNAS_FORA_DO_ARQUIVO).toContain('conta.senha_hash')
      for (const versao of ['completa', 'coordenacao'] as const) {
        const texto = textoDoObjeto(cenario.escolaId, pedidoId, versao)
        expect(texto.length, versao).toBeGreaterThan(100)
        for (const proibido of proibidos) expect(texto, `${versao}: ${String(proibido)}`).not.toContain(String(proibido))
        // A chave do objeto nunca está dentro do próprio objeto.
        expect(texto).not.toContain('chave_objeto')
        expect(texto).not.toContain(`titular/${cenario.escolaId}`)
        // O e-mail da conta global entra nas duas versões.
        expect(texto, versao).toContain(semeado.textos['conta.email'])
      }
    })

    it('o aluno não leva o conteúdo do artefato aplicado, e o professor também não: só o título', async () => {
      const cenario = await novaEscola()
      const professor = await pessoa(cenario, 'professor', 'Professor')
      const semeado = await semearProfessor(cenario, professor)
      const aluno = await pessoa(cenario, 'aluno', 'Aluno')
      await semearAluno(cenario, aluno)
      // O artefato com o gabarito sentinela é aplicado à turma, e o aluno tem a tentativa e a resposta nele: é o caminho por
      // onde o conteúdo chegaria ao arquivo dele, se alguma leitura o trouxesse.
      const aplicadaComGabarito = await inserir(
        'insert into atividade_aplicada (escola_id, ano_letivo_id, turma_id, artefato_id, avaliativa, aplicada_por) values ($1, $2, $3, $4, false, $5) returning id',
        [cenario.escolaId, cenario.escola.anoLetivoId, cenario.escola.turma, semeado.ids['artefato'], professor.id],
      )
      await inserir('insert into tentativa_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id) values ($1, $2, $3, $4) returning id', [
        cenario.escolaId,
        cenario.escola.anoLetivoId,
        aplicadaComGabarito,
        aluno.id,
      ])
      await inserir('insert into resposta_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, questao, alternativa) values ($1, $2, $3, $4, 1, 2) returning id', [
        cenario.escolaId,
        cenario.escola.anoLetivoId,
        aplicadaComGabarito,
        aluno.id,
      ])
      // O aluno desativado tem as duas versões.
      await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [aluno.id])
      const pedidoDoAluno = await pedidoPronto(cenario, aluno)
      const pedidoDoProfessor = await pedidoPronto(cenario, professor)
      for (const versao of ['completa', 'coordenacao'] as const) {
        const doAluno = textoDoObjeto(cenario.escolaId, pedidoDoAluno, versao)
        expect(doAluno.length, versao).toBeGreaterThan(100)
        expect(doAluno, versao).not.toContain(semeado.textos['artefato.conteudo'])
        expect(doAluno, versao).not.toContain('gabarito')
      }
      const arquivoDoProfessor = textoDoObjeto(cenario.escolaId, pedidoDoProfessor, 'completa')
      expect(arquivoDoProfessor).toContain(semeado.textos['artefato.titulo'])
      expect(arquivoDoProfessor).not.toContain(semeado.textos['artefato.conteudo'])
    })

    it('toda coluna das tabelas lidas que a classificação manda ficar de fora está em `fora` da leitura', () => {
      // A conferência por coluna contra as migrations está em `architecture.test.ts`; aqui, o que a leitura declara.
      for (const proibida of COLUNAS_FORA_DO_ARQUIVO) {
        const [tabela = '', coluna = ''] = proibida.split('.')
        if (CLASSIFICACAO_DAS_TABELAS[tabela]?.arquivo.entra !== true) continue
        expect(Object.keys(LEITURAS_DO_ARQUIVO[tabela]?.fora ?? {}), proibida).toContain(coluna)
      }
    })
  })

  describe('versão da escola (RF12)', () => {
    it('sem conta ativa, a versão da escola traz o Tutor e não traz a conversa, o tema, o texto do modelo nem a justificativa; a completa traz tudo', async () => {
      const cenario = await novaEscola()
      const professor = await pessoa(cenario, 'professor', 'Professor')
      const doProfessor = await semearProfessor(cenario, professor)
      await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [professor.id])
      const aluno = await pessoa(cenario, 'aluno', 'Aluno')
      const doAluno = await semearAluno(cenario, aluno)
      await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [aluno.id])

      const pedidoDoProfessor = await pedidoPronto(cenario, professor)
      const daEscola = textoDoObjeto(cenario.escolaId, pedidoDoProfessor, 'coordenacao')
      const completa = textoDoObjeto(cenario.escolaId, pedidoDoProfessor, 'completa')
      for (const proibido of [
        doProfessor.textos['mensagem_agente.conteudo'],
        doProfessor.textos['execucao_agente.entrada'],
        doProfessor.textos['consumo_ia.entrada'],
        doProfessor.textos['consumo_ia.saida'],
        doProfessor.textos['entrega.justificativa'],
        doProfessor.ids['mensagem_agente'],
        doProfessor.ids['thread_agente'],
      ]) {
        expect(daEscola, `a versão da escola traz ${String(proibido)}`).not.toContain(String(proibido))
        expect(completa, `a completa não traz ${String(proibido)}`).toContain(String(proibido))
      }
      // O registro de uso (execução, consumo sem texto e artefato) fica, por exceção declarada no PRD (D64).
      for (const tabela of ['execucao_agente', 'consumo_ia', 'artefato'] as const) expect(daEscola, tabela).toContain(String(doProfessor.ids[tabela]))

      const pedidoDoAluno = await pedidoPronto(cenario, aluno)
      const doTutor = textoDoObjeto(cenario.escolaId, pedidoDoAluno, 'coordenacao')
      // A conversa do Tutor vai na versão da escola, por exceção declarada no PRD (seção 6).
      expect(doTutor).toContain(String(doAluno.textos['mensagem_tutor.texto']))
      expect(doTutor).toContain(String(doAluno.ids['mensagem_tutor']))
    })

    it('com conta ativa nesta escola a versão da escola não existe, e a rota responde como o id inexistente', async () => {
      const cenario = await novaEscola()
      const aluno = await pessoa(cenario, 'aluno', 'Aluno')
      await semearAluno(cenario, aluno)
      const pedidoId = await pedidoPronto(cenario, aluno)
      const inexistente = await arquivoDaEscola(cenario.coordenacao, randomUUID())
      const comContaAtiva = await arquivoDaEscola(cenario.coordenacao, pedidoId)
      expect(semRequisicao(comContaAtiva)).toEqual(semRequisicao(inexistente))
      expect(semRequisicao(comContaAtiva)).toEqual(NAO_ENCONTRADO)
      expect(armazem.urlsAssinadas.filter(({ chave }) => chave.includes(pedidoId))).toEqual([])
    })

    it('a versão da escola apagada ou vencida responde como o id inexistente, e o pedido ainda em preparação não serve o arquivo de outro pedido da escola', async () => {
      const cenario = await novaEscola()
      const quemTem = await pessoa(cenario, 'aluno', 'AlunoComArquivo')
      const quemEspera = await pessoa(cenario, 'aluno', 'AlunoEsperando')
      for (const aluno of [quemTem, quemEspera]) await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [aluno.id])
      const comArquivo = await pedidoPronto(cenario, quemTem)
      // O titular desativado cujo job ainda não rodou: a escola tem a versão da escola de outro pedido, e não é a deste.
      const emPreparacao = (await registrar(cenario.coordenacao, quemEspera.id)).corpo['id'] as string
      await tirarDaFila(cenario.escolaId, emPreparacao)
      expect(semRequisicao(await arquivoDaEscola(cenario.coordenacao, emPreparacao))).toEqual(NAO_ENCONTRADO)
      expect((await arquivoDaEscola(cenario.coordenacao, comArquivo)).status).toBe(200)

      // Passados os 7 dias, e com o objeto marcado como apagado, a escola também não o alcança.
      // A fronteira é o `expira_em` da versão da escola: um segundo depois vence, um segundo antes ainda vale.
      const { expiraEm } = await validadeDoArquivo(comArquivo, 'coordenacao')
      relogio.atual = new Date(expiraEm.getTime() + 1_000)
      expect(semRequisicao(await arquivoDaEscola(cenario.coordenacao, comArquivo))).toEqual(NAO_ENCONTRADO)
      relogio.atual = new Date(expiraEm.getTime() - 1_000)
      expect((await arquivoDaEscola(cenario.coordenacao, comArquivo)).status).toBe(200)
      await bancada.pool.query('update arquivo_titular set apagado_em = now() where pedido_id = $1', [comArquivo])
      expect(semRequisicao(await arquivoDaEscola(cenario.coordenacao, comArquivo))).toEqual(NAO_ENCONTRADO)
    })

    it('ativo em B e desativado em A: em A ele não tem conta ativa, e a versão da escola existe', async () => {
      const cenario = await novaEscola()
      const professor = await pessoa(cenario, 'professor', 'Professor')
      await semearProfessor(cenario, professor)
      const escolaB = await novaEscola()
      await bancada.sessaoDaMesmaConta(professor.id, escolaB.escolaId)
      await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [professor.id])
      const pedidoId = await pedidoPronto(cenario, professor)
      expect(armazem.objetos.has(`titular/${cenario.escolaId}/${pedidoId}/coordenacao.json`)).toBe(true)
      expect((await arquivoDaEscola(cenario.coordenacao, pedidoId)).status).toBe(200)
    })
  })

  describe('eliminação agendada (14.0): o acesso suspenso é o mesmo que não ter conta ativa', () => {
    it('com a eliminação agendada o titular não tem conta ativa: o job faz a versão da escola, e ela vale enquanto a eliminação segue agendada', async () => {
      const cenario = await novaEscola()
      const professor = await pessoa(cenario, 'professor', 'Professor')
      await semearProfessor(cenario, professor)
      await bancada.pool.query('update usuario set eliminacao_agendada_em = now() where id = $1', [professor.id])
      const pedidoId = await pedidoPronto(cenario, professor)
      expect(armazem.objetos.has(`titular/${cenario.escolaId}/${pedidoId}/coordenacao.json`)).toBe(true)

      const durante = await arquivoDaEscola(cenario.coordenacao, pedidoId)
      // Cancelada a eliminação, ele volta a ter conta ativa: a versão da escola deixa de ser entregue por ela.
      await bancada.pool.query('update usuario set eliminacao_agendada_em = null where id = $1', [professor.id])
      const depois = await arquivoDaEscola(cenario.coordenacao, pedidoId)

      expect(durante.status).toBe(200)
      expect(depois.status).toBe(404)
    })
  })

  describe('correção de lote (RF11, regra 70, item 3)', () => {
    it('o lote pendente ou rejeitado sai só como estado, sem acertos nem diagnóstico, nas duas versões; o aprovado traz o resultado', async () => {
      const cenario = await novaEscola()
      const aluno = await pessoa(cenario, 'aluno', 'Aluno')
      const semeado = await semearAluno(cenario, aluno)
      await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [aluno.id])
      const pedidoId = await pedidoPronto(cenario, aluno)
      for (const versao of ['completa', 'coordenacao'] as const) {
        const texto = textoDoObjeto(cenario.escolaId, pedidoId, versao)
        const tabelas = (JSON.parse(texto) as { tabelas: Record<string, Array<Record<string, unknown>>> }).tabelas
        const correcoes = new Map((tabelas['correcao'] ?? []).map((linha) => [linha['id'], linha]))
        const aprovada = correcoes.get(semeado.ids['correcao.aprovado'])
        const pendente = correcoes.get(semeado.ids['correcao.pendente'])
        const rejeitada = correcoes.get(semeado.ids['correcao.rejeitado'])
        expect(aprovada, versao).toMatchObject({ situacao: 'aprovada_pelo_professor', acertos: 7, total: 10, em_branco: 1 })
        expect(texto).toContain(String(semeado.textos['correcao.aprovado']))
        expect(pendente, versao).toEqual({ id: semeado.ids['correcao.pendente'], ano_letivo_id: expect.any(String), entrega_id: expect.any(String), atividade_aplicada_id: expect.any(String), situacao: 'em_validacao_pelo_professor' })
        expect(rejeitada, versao).toEqual({ id: semeado.ids['correcao.rejeitado'], ano_letivo_id: expect.any(String), entrega_id: expect.any(String), atividade_aplicada_id: expect.any(String), situacao: 'rejeitada_pelo_professor' })
        expect(texto, versao).not.toContain(String(semeado.textos['correcao.pendente']))
        expect(texto, versao).not.toContain(String(semeado.textos['correcao.rejeitado']))
      }
    })
  })

  describe('quem baixa (RF12)', () => {
    it('o aluno baixa a própria versão completa; o colega, a coordenação e a escola B respondem como o id inexistente', async () => {
      const cenario = await novaEscola()
      const aluno = await pessoa(cenario, 'aluno', 'Aluno')
      const colega = await pessoa(cenario, 'aluno', 'Colega')
      await semearAluno(cenario, aluno)
      const pedidoId = await pedidoPronto(cenario, aluno)
      const escolaB = await novaEscola()
      const deB = await pessoa(escolaB, 'aluno', 'AlunoDeB')

      const dele = await baixar(aluno.sessao, pedidoId)
      expect(dele.status).toBe(200)
      const inexistente = semRequisicao(await baixar(aluno.sessao, randomUUID()))
      expect(inexistente).toEqual(NAO_ENCONTRADO)
      expect(semRequisicao(await baixar(colega.sessao, pedidoId))).toEqual(inexistente)
      expect(semRequisicao(await baixar(deB.sessao, pedidoId))).toEqual(inexistente)
      // A coordenação não é titular: a célula dela é `nunca`, e a resposta é a do inexistente (regra 10, item 6).
      expect(semRequisicao(await baixar(cenario.coordenacao, pedidoId))).toEqual(inexistente)
      expect(semRequisicao(await meusDados(cenario.coordenacao))).toEqual(NAO_ENCONTRADO)
      // A coordenação também não alcança a versão completa pela rota da escola: só a da coordenação, e ela não existe aqui.
      expect((await arquivoDaEscola(cenario.coordenacao, pedidoId)).status).toBe(404)
    })

    it('o repository lê a escola do contexto: no contexto de A, o arquivo do pedido de B não vem; no de B, vem (regra 10, item 5)', async () => {
      const a = await novaEscola()
      const b = await novaEscola()
      const alunoDeB = await pessoa(b, 'aluno', 'AlunoDeB')
      const pedidoDeB = await pedidoPronto(b, alunoDeB)
      const noContexto = <T>(escolaId: string, consulta: (repository: ArquivoDoTitularRepository) => Promise<T>): Promise<T> =>
        runInContext({ requisicaoId: randomUUID(), escolaId }, () => consulta(new ArquivoDoTitularRepository(bancada.banco)))

      // O pedido e a versão são os mesmos nas duas leituras: só a escola do contexto muda.
      expect(await noContexto(a.escolaId, (repository) => repository.doPedido(pedidoDeB, 'completa'))).toBeUndefined()
      const deB = await noContexto(b.escolaId, (repository) => repository.doPedido(pedidoDeB, 'completa'))
      expect(deB).toMatchObject({ versao: 'completa', chaveObjeto: `titular/${b.escolaId}/${pedidoDeB}/completa.json` })
    })

    it('a coordenação de B não alcança, pela rota da escola, o arquivo do pedido de A', async () => {
      const a = await novaEscola()
      const b = await novaEscola()
      const aluno = await pessoa(a, 'aluno', 'Aluno')
      await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [aluno.id])
      const pedidoId = await pedidoPronto(a, aluno)
      expect(armazem.objetos.has(`titular/${a.escolaId}/${pedidoId}/coordenacao.json`)).toBe(true)
      const auditorias = async (escolaId: string): Promise<number> =>
        Number((await bancada.pool.query<{ total: string }>(`select count(*) as total from auditoria where escola_id = $1 and acao = 'titular.arquivo_baixado'`, [escolaId])).rows[0]?.total)
      const [deA, deB, assinadas] = [await auditorias(a.escolaId), await auditorias(b.escolaId), armazem.urlsAssinadas.length]
      const resposta = await arquivoDaEscola(b.coordenacao, pedidoId)
      expect(semRequisicao(resposta)).toEqual(NAO_ENCONTRADO)
      expect(resposta.corpo['url']).toBeUndefined()
      expect([await auditorias(a.escolaId), await auditorias(b.escolaId), armazem.urlsAssinadas.length]).toEqual([deA, deB, assinadas])
    })

    it('"Meus dados" lista só os pedidos da própria pessoa na escola ativa, com a validade, e a escola B não lista os de A', async () => {
      const cenario = await novaEscola()
      const aluno = await pessoa(cenario, 'aluno', 'Aluno')
      const colega = await pessoa(cenario, 'aluno', 'Colega')
      await semearAluno(cenario, aluno)
      const pedidoId = await pedidoPronto(cenario, aluno)
      await pedidoPronto(cenario, colega)
      const outraEscola = await novaEscola()
      const deB = await pessoa(outraEscola, 'aluno', 'AlunoDeB')

      // O vencimento da linha é movido de propósito (+1 h): a lista tem de ler o `expira_em` da linha, e não calcular relógio ou `pronto_em` + 7 dias.
      const { rows: movida } = await bancada.pool.query<{ pronto_em: Date; expira_em: Date }>(
        `update arquivo_titular set expira_em = pronto_em + interval '7 days 1 hour' where pedido_id = $1 and versao = 'completa' returning pronto_em, expira_em`,
        [pedidoId],
      )
      expect(movida).toHaveLength(1)
      const [movido] = movida
      if (movido === undefined) throw new Error('o update não achou a linha do arquivo')
      const linha = { prontoEm: movido.pronto_em, expiraEm: movido.expira_em }
      const lista = await meusDados(aluno.sessao)
      expect(lista.status).toBe(200)
      const pedidos = lista.corpo['pedidos'] as Array<Record<string, unknown>>
      expect(pedidos).toHaveLength(1)
      expect(pedidos[0]).toMatchObject({ id: pedidoId, tipo: 'acesso', estado: 'pronto', chegouEm: HOJE(), arquivo: { situacao: 'disponivel' } })
      const listado = Date.parse(((pedidos[0]?.['arquivo'] ?? {}) as { expiraEm: string }).expiraEm)
      expect(listado).toBe(linha.expiraEm.getTime())
      expect(listado).not.toBe(linha.prontoEm.getTime() + VALIDADE_DO_ARQUIVO_DIAS * UM_DIA_MS)
      expect(listado).not.toBe(relogio.atual.getTime() + VALIDADE_DO_ARQUIVO_DIAS * UM_DIA_MS)
      expect(lista.corpo['categorias']).toEqual(expect.arrayContaining([{ categoria: 'conversa_tutor', quantidade: 1 }]))
      expect(((await meusDados(deB.sessao)).corpo['pedidos'] as unknown[]).length).toBe(0)
    })

    it('só a versão da escola existe: o titular não baixa a versão que não é a dele, e com as duas versões a lista traz um pedido só e cada rota assina a chave da sua', async () => {
      const cenario = await novaEscola()
      const aluno = await pessoa(cenario, 'aluno', 'Aluno')
      await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [aluno.id])
      const pedidoId = await pedidoPronto(cenario, aluno)
      // O job rodou com ele desativado (as duas versões existem); ele volta a ter conta ativa e passa a chamar a API.
      expect((await arquivoDaEscola(cenario.coordenacao, pedidoId)).status).toBe(200)
      await bancada.pool.query('update usuario set desativado_em = null where id = $1', [aluno.id])
      // Com a conta de volta, a versão da escola existe no armazém e na tabela, e a escola não a baixa mais: ele baixa a dele.
      expect(semRequisicao(await arquivoDaEscola(cenario.coordenacao, pedidoId))).toEqual(NAO_ENCONTRADO)
      const lista = (await meusDados(aluno.sessao)).corpo['pedidos'] as unknown[]
      expect(lista).toHaveLength(1)
      expect((await baixar(aluno.sessao, pedidoId)).status).toBe(200)
      const assinadas = armazem.urlsAssinadas.filter(({ chave }) => chave.includes(pedidoId)).map(({ chave }) => chave.split('/').at(-1))
      expect(assinadas).toEqual(['coordenacao.json', 'completa.json'])
      expect(armazem.objetos.has(`titular/${cenario.escolaId}/${pedidoId}/coordenacao.json`)).toBe(true)

      // Sem a versão completa (a linha some), o titular não alcança a da escola pela rota dele.
      await bancada.pool.query(`delete from arquivo_titular where pedido_id = $1 and versao = 'completa'`, [pedidoId])
      expect(semRequisicao(await baixar(aluno.sessao, pedidoId))).toEqual(NAO_ENCONTRADO)
    })

    it('"Meus dados" lista do pedido mais novo para o mais antigo, e no máximo 50', async () => {
      const cenario = await novaEscola()
      const aluno = await pessoa(cenario, 'aluno', 'Aluno')
      const primeiro = await pedidoPronto(cenario, aluno)
      const segundo = await pedidoPronto(cenario, aluno)
      const ordem = ((await meusDados(aluno.sessao)).corpo['pedidos'] as Array<{ id: string }>).map(({ id }) => id)
      expect(ordem).toEqual([segundo, primeiro])
      // 60 pedidos a mais (de correção: sem job nem arquivo), registrados direto: a lista corta nos 50 mais novos.
      await bancada.pool.query(
        `insert into pedido_titular (escola_id, titular_id, papel_titular, tipo, solicitante, chegou_em, estado, compartilhamento, registrado_por, chave_envio)
         select $1, $2, 'aluno', 'correcao', 'titular', current_date, 'recebido', '[]'::jsonb, $3, gen_random_uuid() from generate_series(1, 60)`,
        [cenario.escolaId, aluno.id, cenario.coordenacao.usuarioId],
      )
      const lista = (await meusDados(aluno.sessao)).corpo['pedidos'] as Array<{ id: string }>
      expect(lista).toHaveLength(50)
      expect(lista.map(({ id }) => id)).not.toContain(primeiro)
    })

    it('o pedido do responsável legal sai na conta do aluno', async () => {
      const cenario = await novaEscola()
      const aluno = await pessoa(cenario, 'aluno', 'Aluno')
      const pedidoId = await pedidoPronto(cenario, aluno, { solicitante: 'responsavel_legal' })
      const lista = (await meusDados(aluno.sessao)).corpo['pedidos'] as Array<Record<string, unknown>>
      expect(lista.map((pedido) => pedido['id'])).toEqual([pedidoId])
      expect((await baixar(aluno.sessao, pedidoId)).status).toBe(200)
    })
  })

  describe('permissão (RF20)', () => {
    it('"Meus dados" é do aluno e do professor: a coordenação com ou sem segundo fator e quem não tem token não chegam', async () => {
      const cenario = await novaEscola()
      const aluno = await pessoa(cenario, 'aluno', 'Aluno')
      const professor = await pessoa(cenario, 'professor', 'Professor')
      const pedidoId = await pedidoPronto(cenario, aluno)
      for (const [verbo, caminho, corpo] of [
        ['GET', '/v1/meus-dados', undefined],
        ['POST', `/v1/meus-dados/${pedidoId}/baixar`, {}],
      ] as const) {
        const pedirComo = async (token: string | undefined) => {
          const resposta = await fetch(`${api.url}${caminho}`, {
            method: verbo,
            headers: { ...(token === undefined ? {} : { Authorization: `Bearer ${token}` }), ...(corpo === undefined ? {} : { 'Content-Type': 'application/json' }) },
            ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
          })
          return resposta.status
        }
        expect(await pedirComo(undefined), `sem token ${caminho}`).toBe(401)
        expect(await pedirComo(cenario.coordenacao.token), `coordenação ${caminho}`).toBe(404)
        // O professor chega à rota (a célula dele é `proprio`), e o pedido do aluno responde como o inexistente.
        expect(await pedirComo(professor.sessao.token), `professor ${caminho}`).toBe(caminho === '/v1/meus-dados' ? 200 : 404)
        expect(await pedirComo(aluno.sessao.token), `aluno ${caminho}`).toBe(200)
      }
    })
  })

  describe('D64: o que a coordenação não vê do professor', () => {
    it('as datas reais de uso saem só na versão completa: a versão da escola do professor que usou e a do que não usou têm o mesmo compartilhamento', async () => {
      const cenario = await novaEscola()
      const quemUsou = await pessoa(cenario, 'professor', 'ProfessorQueUsou')
      const quemNaoUsou = await pessoa(cenario, 'professor', 'ProfessorQueNaoUsou')
      const doQueUsou = await semearProfessor(cenario, quemUsou)
      // A data real da chamada, distinta de qualquer outra data do teste.
      await bancada.pool.query(`update consumo_ia set em = '2026-03-04T10:20:30Z' where id = $1`, [doQueUsou.ids['consumo_ia']])
      // Uma segunda chamada externa, depois, para o mesmo provedor: o último é este, e o primeiro não muda. E uma chamada local (sem
      // envio externo, sem provedor), ANTES das duas: não entra no uso real nem muda o primeiro.
      for (const [envioExterno, provedor, em] of [
        [true, PROVEDOR_DO_USO, '2026-03-09T08:00:00Z'],
        [false, null, '2026-01-01T00:00:00Z'],
      ] as const) {
        await bancada.pool.query(
          `insert into consumo_ia (escola_id, execucao_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, duracao_ms, envio_externo, provedor, tentativas, estado, em)
           values ($1, $2, 'gerar_atividade_objetiva', 'conversa_e_ferramentas', 'padrao', 'openai_compat', 'modelo-sintetico', 'v1', 10, 20, 30, $3, $4, 1, 'concluida', $5)`,
          [cenario.escolaId, doQueUsou.ids['execucao_agente'], envioExterno, provedor, em],
        )
      }
      for (const professor of [quemUsou, quemNaoUsou]) await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [professor.id])
      const pedidoDoQueUsou = await pedidoPronto(cenario, quemUsou)
      const pedidoDoQueNaoUsou = await pedidoPronto(cenario, quemNaoUsou)

      const daEscolaDoQueUsou = documento(cenario.escolaId, pedidoDoQueUsou, 'coordenacao')['compartilhamento']
      const daEscolaDoQueNaoUsou = documento(cenario.escolaId, pedidoDoQueNaoUsou, 'coordenacao')['compartilhamento']
      expect(daEscolaDoQueUsou).toEqual(daEscolaDoQueNaoUsou)
      // Só a foto do pedido (por período, a mesma para os dois): sem `usoReal`, que é da versão completa.
      expect(Object.keys(daEscolaDoQueUsou as object)).toEqual(['empresas'])
      const completaDoQueUsou = documento(cenario.escolaId, pedidoDoQueUsou, 'completa')['compartilhamento'] as { usoReal: unknown[] }
      expect(completaDoQueUsou.usoReal).toEqual([{ provedor: PROVEDOR_DO_USO, primeiroEm: '2026-03-04T10:20:30.000Z', ultimoEm: '2026-03-09T08:00:00.000Z' }])
      expect((documento(cenario.escolaId, pedidoDoQueNaoUsou, 'completa')['compartilhamento'] as { usoReal: unknown[] }).usoReal).toEqual([])
      // A data real nunca sai pelo compartilhamento da escola. O texto inteiro da versão da escola leva o `em` de cada chamada em
      // `consumo_ia` (o registro de uso, por exceção do PRD, seção 6), então a prova é do campo `usoReal` e do compartilhamento.
      expect(JSON.stringify(daEscolaDoQueUsou)).not.toMatch(/2026-0[13]-/)
      const textoDaEscola = textoDoObjeto(cenario.escolaId, pedidoDoQueUsou, 'coordenacao')
      expect(textoDaEscola).not.toContain('usoReal')
      expect(textoDoObjeto(cenario.escolaId, pedidoDoQueUsou, 'completa')).toContain('usoReal')
    })
  })

  describe('validade (RF12): 7 dias de arquivo e 5 minutos de URL', () => {
    it('a URL vale 300 s, o arquivo vale até o 7º dia, e no 8º a rota responde como o id inexistente', async () => {
      const cenario = await novaEscola()
      const aluno = await pessoa(cenario, 'aluno', 'Aluno')
      // O relógio do teste fica uma hora antes da hora real: só o relógio injetado dá esse `pronto_em`, e a prova não depende de a hora real ter andado.
      relogio.atual = new Date(Date.now() - 3_600_000)
      const pedidoId = await pedidoPronto(cenario, aluno)
      const { prontoEm, expiraEm } = await validadeDoArquivo(pedidoId)
      expect(expiraEm.getTime()).toBe(prontoEm.getTime() + VALIDADE_DO_ARQUIVO_DIAS * UM_DIA_MS)
      expect(VALIDADE_DO_ARQUIVO_DIAS).toBe(7)
      // O job gravou com o relógio injetado (o caso o pôs uma hora antes da hora real, logo antes do `pedidoPronto`, e o `montar` do teste é o único escritor): a hora real é sempre posterior.
      expect(prontoEm).toEqual(relogio.atual)

      // O instante do 6º dia (meio-dia de Brasília, 15:00Z, do dia `pronto_em` + 6) cai entre 5 dias e 15 h e 6 dias e 14 h depois do `pronto_em`: o que se prova é "antes dos 7 dias", e a hora fixa tira o nome do arquivo (o dia de uso) da dependência da hora em que o teste roda.
      const meioDia = new Date(prontoEm.getTime() + 6 * UM_DIA_MS)
      meioDia.setUTCHours(15, 0, 0, 0)
      relogio.atual = meioDia
      const sexto = await baixar(aluno.sessao, pedidoId)
      expect(sexto.status).toBe(200)
      const assinada = armazem.urlsAssinadas.at(-1)
      expect(assinada).toMatchObject({ chave: `titular/${cenario.escolaId}/${pedidoId}/completa.json`, validadeSegundos: VALIDADE_DA_URL_DO_ARQUIVO_SEGUNDOS, nome: `meus-dados-${diaDeUso(meioDia)}.json` })
      expect(VALIDADE_DA_URL_DO_ARQUIVO_SEGUNDOS).toBe(300)
      expect(sexto.corpo['validaAte']).toBe(new Date(meioDia.getTime() + 300_000).toISOString())

      // A fronteira é o `expira_em` da linha: um segundo antes baixa, um segundo depois responde como o id inexistente.
      relogio.atual = new Date(expiraEm.getTime() - 1_000)
      expect((await baixar(aluno.sessao, pedidoId)).status).toBe(200)
      relogio.atual = new Date(expiraEm.getTime() + 1_000)
      expect(semRequisicao(await baixar(aluno.sessao, pedidoId))).toEqual(NAO_ENCONTRADO)
      const lista = (await meusDados(aluno.sessao)).corpo['pedidos'] as Array<{ arquivo: { situacao: string } }>
      expect(lista[0]?.arquivo.situacao).toBe('expirado')
    })

    it('o arquivo marcado `apagado_em` (a eliminação do titular) não baixa, mesmo dentro dos 7 dias', async () => {
      const cenario = await novaEscola()
      const aluno = await pessoa(cenario, 'aluno', 'Aluno')
      const pedidoId = await pedidoPronto(cenario, aluno)
      expect((await baixar(aluno.sessao, pedidoId)).status).toBe(200)
      await bancada.pool.query('update arquivo_titular set apagado_em = now() where pedido_id = $1', [pedidoId])
      expect(semRequisicao(await baixar(aluno.sessao, pedidoId))).toEqual(NAO_ENCONTRADO)
      const lista = (await meusDados(aluno.sessao)).corpo['pedidos'] as Array<{ arquivo: { situacao: string } }>
      expect(lista[0]?.arquivo.situacao).toBe('expirado')
    })

    it('o corpo do `baixar` não leva campo: o que vier é entrada inválida, e nada é assinado', async () => {
      const cenario = await novaEscola()
      const aluno = await pessoa(cenario, 'aluno', 'Aluno')
      const pedidoId = await pedidoPronto(cenario, aluno)
      const antes = armazem.urlsAssinadas.length
      const resposta = await pedir(aluno.sessao, 'POST', `/v1/meus-dados/${pedidoId}/baixar`, { escolaId: randomUUID() })
      expect(resposta.status).toBe(400)
      expect(armazem.urlsAssinadas.length).toBe(antes)
    })
  })

  describe('cabeçalhos e respostas (RF17)', () => {
    it('as respostas de `arquivo` e de `baixar` levam no-store, o nome do arquivo e nenhuma chave de objeto, e cada download audita a finalidade', async () => {
      const cenario = await novaEscola()
      const professor = await pessoa(cenario, 'professor', 'Professor')
      await semearProfessor(cenario, professor)
      await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [professor.id])
      const pedidoId = await pedidoPronto(cenario, professor)
      const dia = diaDeUso(relogio.atual)

      const daEscola = await arquivoDaEscola(cenario.coordenacao, pedidoId, 'entregar_ao_responsavel_legal')
      expect(daEscola.status).toBe(200)
      expect(daEscola.cabecalhos.get('cache-control')).toBe('no-store')
      expect(daEscola.corpo['nome']).toBe(`meus-dados-${dia}.json`)
      // Só a URL, o nome e a validade: a chave do objeto não é campo de nenhuma resposta (a URL assinada leva o caminho do
      // objeto, como toda URL de storage, e nele só há ids).
      expect(Object.keys(daEscola.corpo).sort()).toEqual(['nome', 'url', 'validaAte'])

      // Todo DTO que alcança o pedido: nenhum traz a chave do objeto nem o caminho dele.
      const respostas = [await pedir(cenario.coordenacao, 'GET', `/v1/privacidade/pedidos/${pedidoId}`), await pedir(cenario.coordenacao, 'GET', '/v1/privacidade/pedidos')]
      for (const resposta of respostas) {
        const texto = JSON.stringify(resposta.corpo)
        expect(texto).not.toContain('chave_objeto')
        expect(texto).not.toContain('chaveObjeto')
        expect(texto).not.toContain(`titular/${cenario.escolaId}`)
      }
      const { rows } = await bancada.pool.query<{ autor_usuario_id: string; entidade: string; entidade_id: string; depois: unknown; finalidade: string }>(
        `select autor_usuario_id, entidade, entidade_id, depois, finalidade from auditoria where escola_id = $1 and acao = 'titular.arquivo_baixado' order by id`,
        [cenario.escolaId],
      )
      expect(rows).toEqual([{ autor_usuario_id: cenario.coordenacao.usuarioId, entidade: 'pedido_titular', entidade_id: pedidoId, depois: { versao: 'coordenacao' }, finalidade: 'entregar_ao_responsavel_legal' }])
      // A finalidade fora da lista fechada e o corpo sem finalidade são entrada inválida, e nada é assinado.
      const antes = armazem.urlsAssinadas.length
      expect((await arquivoDaEscola(cenario.coordenacao, pedidoId, 'curiosidade')).status).toBe(400)
      expect((await pedir(cenario.coordenacao, 'POST', `/v1/privacidade/pedidos/${pedidoId}/arquivo`, {})).status).toBe(400)
      expect(armazem.urlsAssinadas.length).toBe(antes)
    })

    it('o titular baixa e a auditoria registra a finalidade do próprio titular, com a versão completa', async () => {
      const cenario = await novaEscola()
      const aluno = await pessoa(cenario, 'aluno', 'Aluno')
      const pedidoId = await pedidoPronto(cenario, aluno)
      const resposta = await baixar(aluno.sessao, pedidoId)
      expect(resposta.status).toBe(200)
      expect(resposta.cabecalhos.get('cache-control')).toBe('no-store')
      const { rows } = await bancada.pool.query<{ autor_usuario_id: string; depois: unknown; finalidade: string }>(
        `select autor_usuario_id, depois, finalidade from auditoria where escola_id = $1 and acao = 'titular.arquivo_baixado' order by id`,
        [cenario.escolaId],
      )
      expect(rows).toEqual([{ autor_usuario_id: aluno.id, depois: { versao: 'completa' }, finalidade: FINALIDADE_DO_ARQUIVO_DO_PROPRIO_TITULAR }])
    })

    it('a URL e a chave do objeto nunca vão ao log da API', async () => {
      const cenario = await novaEscola()
      const aluno = await pessoa(cenario, 'aluno', 'Aluno')
      const pedidoId = await pedidoPronto(cenario, aluno)
      const resposta = await baixar(aluno.sessao, pedidoId)
      // Um erro também deixa linha no log: o varrido não pode estar vazio.
      expect((await baixar(aluno.sessao, randomUUID())).status).toBe(404)
      const log = linhasDeLog.join('\n')
      expect(log).toContain('http.erro')
      expect(log).not.toContain(String(resposta.corpo['url']))
      expect(log).not.toContain(`titular/${cenario.escolaId}`)
    })
  })

  describe('falha do armazém (RF12 e a Tech Spec, seção 7c)', () => {
    it('com o armazém fora o pedido fica em preparação e o download dá INDISPONIVEL_TENTE_DE_NOVO; ele volta, o job conclui e o arquivo baixa', async () => {
      const cenario = await novaEscola()
      const aluno = await pessoa(cenario, 'aluno', 'Aluno')
      armazem.fora = true
      try {
        const criado = await registrar(cenario.coordenacao, aluno.id)
        const pedidoId = criado.corpo['id'] as string
        expect(criado.corpo['estado']).toBe('em_preparacao')
        // Tira o job da API da fila: com um worker de pé ele montaria o arquivo (o armazém dele não é este) e as asserções abaixo correriam contra ele.
        await tirarDaFila(cenario.escolaId, pedidoId)
        await expect(montar(cenario.escolaId, pedidoId)).rejects.toMatchObject({ name: 'FileStorageUnavailableError' })
        const { rows: depois } = await bancada.pool.query<{ estado: string }>('select estado from pedido_titular where id = $1', [pedidoId])
        expect(depois[0]?.estado).toBe('em_preparacao')
        const { rows: linhas } = await bancada.pool.query('select 1 from arquivo_titular where pedido_id = $1', [pedidoId])
        expect(linhas).toHaveLength(0)
        expect(semRequisicao(await baixar(aluno.sessao, pedidoId))).toEqual(NAO_ENCONTRADO)

        armazem.fora = false
        await montar(cenario.escolaId, pedidoId)
        armazem.fora = true
        const indisponivel = await baixar(aluno.sessao, pedidoId)
        expect(indisponivel.status).toBe(503)
        expect((indisponivel.corpo['erro'] as { codigo: string }).codigo).toBe(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
        expect(JSON.stringify(indisponivel.corpo)).not.toContain('titular/')
        armazem.fora = false
        expect((await baixar(aluno.sessao, pedidoId)).status).toBe(200)
      } finally {
        armazem.fora = false
      }
    })

    it('a consulta ao storage não acontece com transação aberta: o storage lento não prende conexão do banco', async () => {
      const cenario = await novaEscola()
      const aluno = await pessoa(cenario, 'aluno', 'Aluno')
      await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [aluno.id])
      const pedidoId = await pedidoPronto(cenario, aluno)
      await bancada.pool.query('update usuario set desativado_em = null where id = $1', [aluno.id])

      // O banco que sabe se há transação em andamento, e o armazém que olha isso a cada chamada.
      let dentro = false
      const banco = new Proxy(bancada.banco, {
        get(alvo, propriedade) {
          if (propriedade === 'transaction') {
            return async (...argumentos: unknown[]) => {
              dentro = true
              try {
                return await (alvo.transaction as (...args: unknown[]) => Promise<unknown>).apply(alvo, argumentos)
              } finally {
                dentro = false
              }
            }
          }
          const valor = Reflect.get(alvo, propriedade) as unknown
          return typeof valor === 'function' ? (valor as (...args: unknown[]) => unknown).bind(alvo) : valor
        },
      }) as Database
      const consultas: boolean[] = []
      class ArmazemQueOlha extends InMemoryFileStorage {
        override async existe(chave: string): Promise<boolean> {
          consultas.push(dentro)
          return super.existe(chave)
        }
        override async urlDeDownload(...argumentos: Parameters<InMemoryFileStorage['urlDeDownload']>): Promise<string> {
          consultas.push(dentro)
          return super.urlDeDownload(...argumentos)
        }
      }
      const olhador = new ArmazemQueOlha()
      for (const versao of ['completa', 'coordenacao'] as const) {
        const chave = `titular/${cenario.escolaId}/${pedidoId}/${versao}.json`
        await olhador.guardar(chave, armazem.objetos.get(chave) ?? '{}')
      }
      const servico = new PrivacidadeService(banco, { enfileirador: { enfileirar: () => Promise.reject(new Error('sem fila neste teste')) }, armazem: olhador, relogio })
      const comoCoordenacao = { requisicaoId: randomUUID(), escolaId: cenario.escolaId, usuarioId: cenario.coordenacao.usuarioId, papel: 'coordenador' as const, sessaoId: cenario.coordenacao.sessaoId, anoLetivoId: null }
      const comoAluno = { requisicaoId: randomUUID(), escolaId: cenario.escolaId, usuarioId: aluno.id, papel: 'aluno' as const, sessaoId: aluno.sessao.sessaoId, anoLetivoId: null }

      // O aluno baixa o dele; a coordenação, a da escola (para isso o titular precisa estar sem conta ativa de novo).
      expect((await runInContext(comoAluno, () => servico.baixarMeuArquivo(pedidoId))).url).toContain('/completa.json')
      await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [aluno.id])
      expect((await runInContext(comoCoordenacao, () => servico.arquivoDaEscola(pedidoId, 'entregar_ao_titular'))).url).toContain('/coordenacao.json')

      // Quatro consultas ao armazém (`existe` e `urlDeDownload`, nas duas rotas), e nenhuma com transação aberta.
      expect(consultas).toEqual([false, false, false, false])
      const { rows } = await bancada.pool.query<{ depois: { versao: string } }>(`select depois from auditoria where escola_id = $1 and acao = 'titular.arquivo_baixado' order by id`, [cenario.escolaId])
      expect(rows.map(({ depois }) => depois.versao)).toEqual(['completa', 'coordenacao'])
    })

    it('o objeto que a linha diz que existe e o storage perdeu também dá INDISPONIVEL_TENTE_DE_NOVO, sem assinar nada', async () => {
      const cenario = await novaEscola()
      const aluno = await pessoa(cenario, 'aluno', 'Aluno')
      const pedidoId = await pedidoPronto(cenario, aluno)
      armazem.objetos.delete(`titular/${cenario.escolaId}/${pedidoId}/completa.json`)
      const antes = armazem.urlsAssinadas.length
      const resposta = await baixar(aluno.sessao, pedidoId)
      expect(resposta.status).toBe(503)
      expect(armazem.urlsAssinadas.length).toBe(antes)
    })
  })

  describe('registro do pedido e estados', () => {
    it('acesso e portabilidade nascem em preparação e enfileiram o job na mesma transação; compartilhamento e correção nascem recebidos, sem job', async () => {
      const cenario = await novaEscola()
      const aluno = await pessoa(cenario, 'aluno', 'Aluno')
      const porTipo: Record<string, { estado: unknown; jobs: number }> = {}
      for (const tipo of ['acesso', 'portabilidade', 'compartilhamento', 'correcao']) {
        const criado = await registrar(cenario.coordenacao, aluno.id, { tipo })
        expect(criado.status, tipo).toBe(201)
        const { rows } = await bancada.pool.query<{ total: number }>(
          `select count(*)::int as total from job_registro where escola_id = $1 and tipo = 'titular.montar-arquivo' and dados->>'pedidoId' = $2 and fila = 'normal'`,
          [cenario.escolaId, criado.corpo['id']],
        )
        porTipo[tipo] = { estado: criado.corpo['estado'], jobs: rows[0]?.total ?? -1 }
      }
      expect(porTipo).toEqual({
        acesso: { estado: 'em_preparacao', jobs: 1 },
        portabilidade: { estado: 'em_preparacao', jobs: 1 },
        compartilhamento: { estado: 'recebido', jobs: 0 },
        correcao: { estado: 'recebido', jobs: 0 },
      })
    })

    it('o reenvio da mesma chave não enfileira um segundo job', async () => {
      const cenario = await novaEscola()
      const aluno = await pessoa(cenario, 'aluno', 'Aluno')
      const chaveEnvio = randomUUID()
      const primeira = await registrar(cenario.coordenacao, aluno.id, { chaveEnvio })
      const segunda = await registrar(cenario.coordenacao, aluno.id, { chaveEnvio })
      expect(segunda.corpo['id']).toBe(primeira.corpo['id'])
      const { rows } = await bancada.pool.query<{ total: number }>(`select count(*)::int as total from job_registro where escola_id = $1 and tipo = 'titular.montar-arquivo'`, [cenario.escolaId])
      expect(rows[0]?.total).toBe(1)
    })

    it('o job que roda depois de a coordenação concluir o pedido grava o arquivo e deixa o pedido `concluido`', async () => {
      const cenario = await novaEscola()
      const aluno = await pessoa(cenario, 'aluno', 'Aluno')
      const criado = await registrar(cenario.coordenacao, aluno.id)
      const pedidoId = criado.corpo['id'] as string
      expect((await pedir(cenario.coordenacao, 'POST', `/v1/privacidade/pedidos/${pedidoId}/concluir`, {})).status).toBe(204)
      await montar(cenario.escolaId, pedidoId)
      const { rows } = await bancada.pool.query<{ estado: string }>('select estado from pedido_titular where id = $1', [pedidoId])
      expect(rows[0]?.estado).toBe('concluido')
      expect((await baixar(aluno.sessao, pedidoId)).status).toBe(200)
    })

    it('o `antes` da auditoria do concluir é o estado que o `update` trocou, mesmo com o job passando o pedido para `pronto` entre a leitura e a escrita', async () => {
      const cenario = await novaEscola()
      const aluno = await pessoa(cenario, 'aluno', 'Aluno')
      const criado = await registrar(cenario.coordenacao, aluno.id)
      const pedidoId = criado.corpo['id'] as string
      // O "job": a transação que passa o pedido para `pronto` e ainda não confirmou. O `select` da API (MVCC) não espera
      // por ela e lê `em_preparacao`; o `update` do concluir espera na trava da linha, e confere o estado de novo quando ela sai.
      const job = await bancada.pool.connect()
      try {
        await job.query('begin')
        await job.query(`update pedido_titular set estado = 'pronto' where id = $1`, [pedidoId])
        const concluir = pedir(cenario.coordenacao, 'POST', `/v1/privacidade/pedidos/${pedidoId}/concluir`, {})
        await esperarNaTrava(bancada.pool, '%update pedido_titular p%')
        await job.query('commit')
        expect((await concluir).status).toBe(204)
      } finally {
        job.release()
      }
      const { rows } = await bancada.pool.query<{ antes: unknown }>(`select antes from auditoria where escola_id = $1 and acao = 'pedido.concluido' and entidade_id = $2`, [cenario.escolaId, pedidoId])
      expect(rows).toEqual([{ antes: { estado: 'pronto' } }])
    })
  })

  describe('banco: o que o código não deixaria passar, a tabela recusa', () => {
    it('a chave do objeto amarrada à escola, ao pedido e à versão; uma linha por versão; o pedido da própria escola', async () => {
      const cenario = await novaEscola()
      const outra = await novaEscola()
      const aluno = await pessoa(cenario, 'aluno', 'Aluno')
      const doOutra = await pessoa(outra, 'aluno', 'AlunoDeOutra')
      const pedidoId = await pedidoPronto(cenario, aluno)
      const pedidoDeOutra = await pedidoPronto(outra, doOutra)
      const inserirArquivo = (escolaId: string, pedido: string, versao: string, chave: string, expira = `now() + interval '7 days'`) =>
        bancada.pool.query(`insert into arquivo_titular (escola_id, pedido_id, versao, chave_objeto, bytes, pronto_em, expira_em) values ($1, $2, $3, $4, 10, now(), ${expira})`, [escolaId, pedido, versao, chave])
      const chave = (escolaId: string, pedido: string, versao: string) => `titular/${escolaId}/${pedido}/${versao}.json`

      // A versão da escola de outra pessoa, com a chave do objeto de outra escola: o check a recusa.
      await expect(inserirArquivo(cenario.escolaId, pedidoId, 'coordenacao', chave(outra.escolaId, pedidoDeOutra, 'completa'))).rejects.toMatchObject({ constraint: 'arquivo_titular_chave_da_escola' })
      // Uma linha por pedido e versão.
      await expect(inserirArquivo(cenario.escolaId, pedidoId, 'completa', chave(cenario.escolaId, pedidoId, 'completa'))).rejects.toMatchObject({ constraint: 'arquivo_titular_pedido_versao_unico' })
      // Versão fora da lista, e validade que acaba antes de começar.
      await expect(inserirArquivo(cenario.escolaId, pedidoId, 'outra', chave(cenario.escolaId, pedidoId, 'outra'))).rejects.toMatchObject({ constraint: 'arquivo_titular_versao_valida' })
      await expect(inserirArquivo(cenario.escolaId, pedidoId, 'coordenacao', chave(cenario.escolaId, pedidoId, 'coordenacao'), `now() - interval '1 day'`)).rejects.toMatchObject({
        constraint: 'arquivo_titular_expira_depois_de_pronto',
      })
      // O pedido de outra escola: a FK composta o recusa, mesmo com a chave coerente com a escola.
      await expect(inserirArquivo(cenario.escolaId, pedidoDeOutra, 'coordenacao', chave(cenario.escolaId, pedidoDeOutra, 'coordenacao'))).rejects.toMatchObject({
        constraint: 'arquivo_titular_pedido_da_escola_fk',
      })
    })

    it('a leitura da auditoria do titular desce por índice que começa na escola e na pessoa', async () => {
      const cenario = await novaEscola()
      const professor = await pessoa(cenario, 'professor', 'Professor')
      const outros = (
        await bancada.pool.query<{ id: string }>("insert into usuario (escola_id, papel, nome) select $1, 'aluno', 'Aluno sintético ' || n from generate_series(1, 30) as n returning id", [cenario.escolaId])
      ).rows.map(({ id }) => id)
      const cliente = await bancada.pool.connect()
      try {
        await cliente.query('begin')
        await cliente.query(
          `insert into auditoria (escola_id, autor_usuario_id, acao, entidade, entidade_id, requisicao_id, em)
           select $1, autor, 'teste.volume', 'escola', $1, gen_random_uuid(), now() - n * interval '1 minute' from unnest($2::uuid[]) as autor cross join generate_series(1, 100) as n`,
          [cenario.escolaId, [...outros, professor.id]],
        )
        await cliente.query('analyze auditoria')
        await cliente.query('set local enable_seqscan = off')
        await cliente.query('set local enable_bitmapscan = off')
        const consulta = LEITURAS_DO_ARQUIVO['auditoria']?.consultas({ escolaId: cenario.escolaId, titularId: professor.id, versao: 'completa' })[0]
        if (consulta === undefined) throw new Error('a leitura da auditoria não existe')
        const { sql: texto, params } = new PgDialect({ casing: 'snake_case' }).sqlToQuery(consulta)
        const { rows } = await cliente.query<{ 'QUERY PLAN': Array<{ Plan: Record<string, unknown> }> }>(`explain (format json) select to_jsonb(x) from (${texto}) x`, params)
        const nos: Array<Record<string, unknown>> = []
        const andar = (no: Record<string, unknown> | undefined): void => {
          if (no === undefined) return
          nos.push(no)
          for (const filho of (no['Plans'] as Array<Record<string, unknown>> | undefined) ?? []) andar(filho)
        }
        andar(rows[0]?.['QUERY PLAN'][0]?.Plan)
        const resumo = nos.map((no) => `${String(no['Node Type'])} ${String(no['Index Name'] ?? '-')}`).join(' > ')
        expect(nos.map((no) => no['Index Name']).filter(Boolean), resumo).toContain('auditoria_escola_autor_idx')
        expect(nos.map((no) => no['Node Type']), resumo).not.toContain('Seq Scan')
      } finally {
        await cliente.query('rollback')
        cliente.release()
      }
    })

    it('as leituras do arquivo em tabelas que crescem com o aluno descem pelo índice da pessoa: respostas, acessos e destaques abertos', async () => {
      const cenario = await novaEscola()
      const professor = await pessoa(cenario, 'professor', 'Professor')
      const alunos = (
        await bancada.pool.query<{ id: string }>("insert into usuario (escola_id, papel, nome) select $1, 'aluno', 'Aluno sintético ' || n from generate_series(1, 30) as n returning id", [cenario.escolaId])
      ).rows.map(({ id }) => id)
      const cliente = await bancada.pool.connect()
      try {
        await cliente.query('begin')
        // O volume sem montar as FKs (tentativa, entrega, atividade): só dentro desta transação, que termina em `rollback`.
        await cliente.query('set local session_replication_role = replica')
        await cliente.query(
          `insert into resposta_atividade (escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, questao, alternativa)
           select $1, $2, atividade, aluno, 1, 1 from unnest($3::uuid[]) as aluno cross join (select gen_random_uuid() as atividade from generate_series(1, 100)) as a`,
          [cenario.escolaId, cenario.escola.anoLetivoId, alunos],
        )
        await cliente.query(
          `insert into registro_acesso (escola_id, usuario_id, evento, ip)
           select $1, aluno, 'login', '203.0.113.1' from unnest($2::uuid[]) as aluno cross join generate_series(1, 100)`,
          [cenario.escolaId, [...alunos, professor.id]],
        )
        await cliente.query(
          `insert into correcao (escola_id, ano_letivo_id, entrega_id, atividade_aplicada_id, aluno_id, acertos, total, em_branco, por_habilidade, destaques, destaque_aberto_em, destaque_aberto_por)
           select $1, $2, gen_random_uuid(), gen_random_uuid(), aluno, 1, 2, 0, '[]'::jsonb,
                  case when n % 10 = 0 then array['em_branco']::text[] else '{}'::text[] end,
                  case when n % 10 = 0 then now() end, case when n % 10 = 0 then $3::uuid end
           from unnest($4::uuid[]) as aluno cross join generate_series(1, 100) as n`,
          [cenario.escolaId, cenario.escola.anoLetivoId, professor.id, alunos],
        )
        for (const tabela of ['resposta_atividade', 'registro_acesso', 'correcao']) await cliente.query(`analyze ${tabela}`)
        await cliente.query('set local enable_seqscan = off')
        await cliente.query('set local enable_bitmapscan = off')
        const dialeto = new PgDialect({ casing: 'snake_case' })
        const alvo = { escolaId: cenario.escolaId, titularId: alunos[0] ?? professor.id, versao: 'completa' } as const
        for (const [tabela, posicao, indice] of [
          ['resposta_atividade', 0, 'resposta_atividade_aluno_idx'],
          ['registro_acesso', 0, 'registro_acesso_usuario_idx'],
          // A segunda consulta da correção é a do professor que abriu o destaque.
          ['correcao', 1, 'correcao_destaque_aberto_por_idx'],
        ] as const) {
          const consulta = LEITURAS_DO_ARQUIVO[tabela]?.consultas(alvo)[posicao]
          if (consulta === undefined) throw new Error(`a leitura de ${tabela} não existe`)
          const { sql: texto, params } = dialeto.sqlToQuery(consulta)
          const { rows } = await cliente.query<{ 'QUERY PLAN': Array<{ Plan: Record<string, unknown> }> }>(`explain (format json) select to_jsonb(x) from (${texto}) x`, params)
          const nos: Array<Record<string, unknown>> = []
          const andar = (no: Record<string, unknown> | undefined): void => {
            if (no === undefined) return
            nos.push(no)
            for (const filho of (no['Plans'] as Array<Record<string, unknown>> | undefined) ?? []) andar(filho)
          }
          andar(rows[0]?.['QUERY PLAN'][0]?.Plan)
          const resumo = `${tabela}: ${nos.map((no) => `${String(no['Node Type'])} ${String(no['Index Name'] ?? '-')}`).join(' > ')}`
          expect(nos.map((no) => no['Index Name']).filter(Boolean), resumo).toContain(indice)
          expect(nos.map((no) => no['Node Type']), resumo).not.toContain('Seq Scan')
        }
      } finally {
        await cliente.query('rollback')
        cliente.release()
      }
    })
  })

  describe('plano (regra 80, item 8)', () => {
    it('o rastro (dois ramos) e a contagem do texto do modelo descem por índice que começa na escola, e não leem o consumo inteiro', async () => {
      const cenario = await novaEscola()
      const aluno = await pessoa(cenario, 'aluno', 'Aluno')
      // Volume: 3.000 chamadas de 40 alunos, metade pelas execuções que eles pediram, para o plano não ser o de tabela vazia.
      const alunos = (
        await bancada.pool.query<{ id: string }>("insert into usuario (escola_id, papel, nome) select $1, 'aluno', 'Aluno sintético ' || n from generate_series(1, 40) as n returning id", [cenario.escolaId])
      ).rows.map(({ id }) => id)
      const cliente = await bancada.pool.connect()
      try {
        await cliente.query('begin')
        // As chamadas do Tutor, com o `aluno_id` (o ramo do aluno), e as das ferramentas, com texto, que só chegam ao aluno pela
        // execução que ele pediu (o ramo da execução e a contagem do texto do modelo).
        await cliente.query(
          `with execucoes as (
             insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada)
             select $1, $2, 'tutor_com_o_aluno', 'turno_do_tutor', aluno, gen_random_uuid(), '{"tarefa":"turno_do_tutor"}'::jsonb
             from unnest($3::uuid[]) as aluno cross join generate_series(1, 75) returning id, solicitada_por
           )
           insert into consumo_ia (escola_id, aluno_id, execucao_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, duracao_ms, envio_externo, tentativas, estado)
           select $1, solicitada_por, id, 'turno_do_tutor', 'tutor_com_o_aluno', 'padrao', 'openai_compat', 'm', 'v1', 1, 1, 1, true, 1, 'concluida' from execucoes`,
          [cenario.escolaId, cenario.escola.anoLetivoId, alunos],
        )
        await cliente.query(
          `with execucoes as (
             insert into execucao_agente (escola_id, ano_letivo_id, funcao, tarefa, solicitada_por, chave_envio, entrada)
             select $1, $2, 'conversa_e_ferramentas', 'gerar_atividade_objetiva', aluno, gen_random_uuid(), '{"tarefa":"gerar_atividade_objetiva"}'::jsonb
             from unnest($3::uuid[]) as aluno cross join generate_series(1, 75) returning id
           )
           insert into consumo_ia (escola_id, execucao_id, tarefa, funcao, perfil, origem, modelo, prompt_versao, tokens_de_entrada, tokens_de_saida, duracao_ms, envio_externo, tentativas, estado, entrada)
           select $1, id, 'gerar_atividade_objetiva', 'conversa_e_ferramentas', 'padrao', 'openai_compat', 'm', 'v1', 1, 1, 1, true, 1, 'concluida', '"x"'::jsonb from execucoes`,
          [cenario.escolaId, cenario.escola.anoLetivoId, alunos],
        )
        for (const tabela of ['usuario', 'execucao_agente', 'consumo_ia']) await cliente.query(`analyze ${tabela}`)
        // O teste afirma que os índices SERVEM à consulta, e não que o planejador os prefere pelo custo (com a escola de teste, o
        // custo do hash sobre o bitmap empata): sem varredura sequencial, bitmap, hash nem merge, o único plano sem nó
        // desabilitado é o laço aninhado que desce pelos índices que começam na escola.
        await cliente.query('set local enable_seqscan = off')
        await cliente.query('set local enable_bitmapscan = off')
        await cliente.query('set local enable_hashjoin = off')
        await cliente.query('set local enable_mergejoin = off')
        const dialeto = new PgDialect({ casing: 'snake_case' })
        const titular = alunos[0] ?? aluno.id
        for (const [rotulo, instrucao] of [
          ['rastro', await runInContext({ requisicaoId: randomUUID(), escolaId: cenario.escolaId }, async () => alunoTrailStatement(titular))],
          ['texto_do_modelo', await runInContext({ requisicaoId: randomUUID(), escolaId: cenario.escolaId }, async () => instrucaoDoTextoDoModelo(titular))],
        ] as const) {
          const { sql: texto, params } = dialeto.sqlToQuery(instrucao)
          const { rows } = await cliente.query<{ 'QUERY PLAN': Array<{ Plan: Record<string, unknown> }> }>(`explain (format json) ${texto}`, params)
          const nos: Array<Record<string, unknown>> = []
          const andar = (no: Record<string, unknown> | undefined): void => {
            if (no === undefined) return
            nos.push(no)
            for (const filho of (no['Plans'] as Array<Record<string, unknown>> | undefined) ?? []) andar(filho)
          }
          andar(rows[0]?.['QUERY PLAN'][0]?.Plan)
          const resumo = `${rotulo}: ${nos.map((no) => `${String(no['Node Type'])} ${String(no['Index Name'] ?? '-')}`).join(' > ')}`
          const indices = nos.map((no) => no['Index Name']).filter(Boolean)
          expect(nos.map((no) => no['Node Type']), resumo).not.toContain('Seq Scan')
          expect(indices, resumo).toContain('consumo_ia_execucao_idx')
          expect(indices, resumo).toContain('execucao_agente_solicitada_por_idx')
          if (rotulo === 'rastro') expect(indices, resumo).toContain('consumo_ia_aluno_idx')
        }
      } finally {
        await cliente.query('rollback')
        cliente.release()
      }
    })
  })
})
