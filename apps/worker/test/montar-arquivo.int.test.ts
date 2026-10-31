import 'reflect-metadata'
import { InMemoryFileStorage, runInContext, type Clock } from '@educa/core'
import { S3FileStorage } from '@educa/core/s3-file-storage'
import { TIPO_MONTAR_ARQUIVO } from '@educa/shared'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, onTestFinished } from 'vitest'
import { lerAmbienteDeTeste, valorObrigatorio } from '../../../tools/ci/compose.ts'
import { compose, PROCESSOS_DA_FILA } from '../../../tools/testes/compose.ts'
import type { ConfiguracaoStorage } from '../src/config.js'
import { montarWorker } from '../src/montagem.js'
import { criarMontagemDoArquivo } from '../src/processadores/montar-arquivo.js'
import { BancadaDeFila, configuracaoDoBanco, LogEmMemoria, urlRedisDeFila, vagasPadraoDoAmbiente } from './fila-de-teste.js'
import { execucaoDoJob } from './execucao-do-job.js'

const ambiente = lerAmbienteDeTeste()
const STORAGE: ConfiguracaoStorage = {
  url: `http://127.0.0.1:${valorObrigatorio(ambiente, 'STORAGE_PORTA_HOST')}`,
  regiao: valorObrigatorio(ambiente, 'STORAGE_REGIAO'),
  bucket: valorObrigatorio(ambiente, 'STORAGE_BUCKET'),
  chaveAcesso: valorObrigatorio(ambiente, 'STORAGE_CHAVE_ACESSO'),
  chaveSecreta: valorObrigatorio(ambiente, 'STORAGE_CHAVE_SECRETA'),
}

beforeAll(() => {
  // Worker do compose de pé poderia executar o job que o teste grava, e disputar o pedido com o worker do próprio teste.
  compose('stop', ...PROCESSOS_DA_FILA)
})

// O job `titular.montar-arquivo` (F3, tarefa 13.0; Tech Spec do F3, seção 5, "Arquivo") contra o Postgres do compose de teste, com
// o armazém falso e o relógio injetado: o que ele grava, o que ele recusa e o que dois jobs do mesmo pedido fazem. O conteúdo do
// arquivo (as tabelas, as colunas, as duas versões) está em `apps/api/test/arquivo-do-titular.int.test.ts`.

const AGORA = new Date('2026-10-09T15:00:00-03:00')
const UM_DIA_MS = 86_400_000

describe('titular.montar-arquivo', () => {
  const bancada = new BancadaDeFila()
  const log = new LogEmMemoria('worker-teste')
  const relogio: Clock & { atual: Date } = { atual: AGORA, agora: () => relogio.atual }

  afterAll(async () => {
    await bancada.fechar()
  })

  /** A escola, um aluno e uma professora que registra, e o pedido de acesso `em_preparacao` do aluno. */
  async function pedidoNovo(opcoes: { tipo?: string; estado?: string } = {}): Promise<{ escolaId: string; pedidoId: string; alunoId: string }> {
    const escolaId = await bancada.escola()
    const { rows: alunos } = await bancada.pool.query<{ id: string }>("insert into usuario (escola_id, papel, nome) values ($1, 'aluno', 'Aluno sintético do arquivo') returning id", [escolaId])
    const { rows: contas } = await bancada.pool.query<{ id: string }>('insert into conta (email) values ($1) returning id', [`coordenacao-${randomUUID()}@arquivo.invalid`])
    const { rows: equipe } = await bancada.pool.query<{ id: string }>(
      "insert into usuario (escola_id, papel, nome, conta_id) values ($1, 'coordenador', 'Coordenação sintética do arquivo', $2) returning id",
      [escolaId, contas[0]?.id],
    )
    const alunoId = alunos[0]?.id ?? ''
    const { rows } = await bancada.pool.query<{ id: string }>(
      `insert into pedido_titular (escola_id, titular_id, papel_titular, tipo, solicitante, chegou_em, estado, compartilhamento, registrado_por, chave_envio)
       values ($1, $2, 'aluno', $3, 'titular', current_date, $4, '[]'::jsonb, $5, $6) returning id`,
      [escolaId, alunoId, opcoes.tipo ?? 'acesso', opcoes.estado ?? 'em_preparacao', equipe[0]?.id, randomUUID()],
    )
    return { escolaId, pedidoId: rows[0]?.id ?? '', alunoId }
  }

  function job(armazem: InMemoryFileStorage) {
    return criarMontagemDoArquivo({ banco: bancada.banco, armazem, relogio, logger: log.logger })
  }

  function rodar(escolaId: string | undefined, armazem: InMemoryFileStorage, dados: { pedidoId: string }): Promise<void> {
    const jobId = randomUUID()
    const processador = job(armazem)
    const executar = () => processador(dados, execucaoDoJob(jobId))
    return escolaId === undefined ? executar() : runInContext({ requisicaoId: randomUUID(), escolaId }, executar)
  }

  async function estadoDo(pedidoId: string): Promise<string | undefined> {
    return (await bancada.pool.query<{ estado: string }>('select estado from pedido_titular where id = $1', [pedidoId])).rows[0]?.estado
  }

  async function linhasDoArquivo(pedidoId: string): Promise<Array<{ versao: string; chave_objeto: string; bytes: number; expira_em: Date; pronto_em: Date }>> {
    const { rows } = await bancada.pool.query<{ versao: string; chave_objeto: string; bytes: number; expira_em: Date; pronto_em: Date }>(
      'select versao, chave_objeto, bytes, expira_em, pronto_em from arquivo_titular where pedido_id = $1 order by versao',
      [pedidoId],
    )
    return rows
  }

  it('grava o JSON no armazém, uma linha por versão, a validade de 7 dias do instante em que ficou pronto, e passa o pedido para `pronto`', async () => {
    const { escolaId, pedidoId, alunoId } = await pedidoNovo()
    const armazem = new InMemoryFileStorage()
    await rodar(escolaId, armazem, { pedidoId })

    expect(await estadoDo(pedidoId)).toBe('pronto')
    const linhas = await linhasDoArquivo(pedidoId)
    // O aluno tem conta ativa nesta escola: só a versão completa.
    expect(linhas.map(({ versao }) => versao)).toEqual(['completa'])
    const [linha] = linhas
    expect(linha?.chave_objeto).toBe(`titular/${escolaId}/${pedidoId}/completa.json`)
    expect(linha?.pronto_em.getTime()).toBe(AGORA.getTime())
    expect(linha?.expira_em.getTime()).toBe(AGORA.getTime() + 7 * UM_DIA_MS)
    const objeto = armazem.objetos.get(linha?.chave_objeto ?? '')
    expect(objeto).toBeDefined()
    expect(linha?.bytes).toBe(Buffer.byteLength(objeto ?? '', 'utf8'))
    expect(JSON.parse(objeto ?? '')).toMatchObject({ versao: 'completa', geradoEm: AGORA.toISOString(), titular: { id: alunoId, papel: 'aluno' } })
  })

  it('o titular desativado nesta escola ganha também a versão da escola', async () => {
    const { escolaId, pedidoId, alunoId } = await pedidoNovo()
    await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [alunoId])
    const armazem = new InMemoryFileStorage()
    await rodar(escolaId, armazem, { pedidoId })
    expect((await linhasDoArquivo(pedidoId)).map(({ versao }) => versao)).toEqual(['completa', 'coordenacao'])
    expect([...armazem.objetos.keys()].sort()).toEqual([`titular/${escolaId}/${pedidoId}/completa.json`, `titular/${escolaId}/${pedidoId}/coordenacao.json`])
  })

  it('[P] dois jobs do mesmo pedido ao mesmo tempo deixam uma linha por versão, o mesmo objeto e o pedido `pronto`', async () => {
    const { escolaId, pedidoId, alunoId } = await pedidoNovo()
    await bancada.pool.query('update usuario set desativado_em = now() where id = $1', [alunoId])
    const armazem = new InMemoryFileStorage()
    await Promise.all([rodar(escolaId, armazem, { pedidoId }), rodar(escolaId, armazem, { pedidoId })])
    expect((await linhasDoArquivo(pedidoId)).map(({ versao }) => versao)).toEqual(['completa', 'coordenacao'])
    expect(armazem.objetos.size).toBe(2)
    // O segundo job ou sobrescreveu o objeto do primeiro (as duas leituras do estado vieram antes de qualquer gravação) ou nem chegou a
    // montar (viu o pedido já `pronto`): nos dois casos, nenhum erro subiu e a linha de cada versão é a de um job só. Os dois jobs usam o
    // mesmo relógio, então este caso prova a unicidade da linha e não a validade: quem prova que o job que perde a disputa não a renova é
    // o caso `o job que perde a disputa pelo pedido…`, mais abaixo.
    expect(armazem.guardadas).toBeGreaterThanOrEqual(2)
    for (const linha of await linhasDoArquivo(pedidoId)) {
      expect(linha.pronto_em.getTime()).toBe(AGORA.getTime())
      expect(linha.expira_em.getTime()).toBe(AGORA.getTime() + 7 * UM_DIA_MS)
    }
    expect(await estadoDo(pedidoId)).toBe('pronto')
  })

  it('o job repetido depois de pronto e concluído não regrava a linha nem o objeto: o `pronto_em` e a validade seguem os do primeiro job', async () => {
    const { escolaId, pedidoId } = await pedidoNovo()
    const armazem = new InMemoryFileStorage()
    await rodar(escolaId, armazem, { pedidoId })
    await bancada.pool.query(`update pedido_titular set estado = 'concluido', concluido_em = now(), concluido_por = registrado_por where id = $1`, [pedidoId])
    relogio.atual = new Date(AGORA.getTime() + UM_DIA_MS)
    try {
      await rodar(escolaId, armazem, { pedidoId })
    } finally {
      relogio.atual = AGORA
    }
    const linhas = await linhasDoArquivo(pedidoId)
    expect(linhas).toHaveLength(1)
    expect(linhas[0]?.pronto_em.getTime()).toBe(AGORA.getTime())
    expect(linhas[0]?.expira_em.getTime()).toBe(AGORA.getTime() + 7 * UM_DIA_MS)
    expect(armazem.guardadas).toBe(1)
    expect(await estadoDo(pedidoId)).toBe('concluido')
    // O log diz que o arquivo já estava montado: nada foi montado.
    expect(log.registros().filter((linha) => String(linha['evento']).startsWith('titular.arquivo_')).at(-1)).toMatchObject({ evento: 'titular.arquivo_ja_montado' })
  })

  it('a reentrega de um pedido `pronto` cujo objeto e cuja linha já foram apagados pela validade vencida não recria nenhum dos dois', async () => {
    const { escolaId, pedidoId } = await pedidoNovo()
    const armazem = new InMemoryFileStorage()
    await rodar(escolaId, armazem, { pedidoId })
    // O que a rotina da escola faz com o arquivo vencido: o objeto, e só depois a linha.
    armazem.objetos.clear()
    await bancada.pool.query('delete from arquivo_titular where pedido_id = $1', [pedidoId])
    await rodar(escolaId, armazem, { pedidoId })
    expect(armazem.objetos.size).toBe(0)
    expect(armazem.guardadas).toBe(1)
    expect(await linhasDoArquivo(pedidoId)).toEqual([])
    expect(await estadoDo(pedidoId)).toBe('pronto')
  })

  it('o pedido que a coordenação concluiu antes de o job rodar é montado: a linha nasce, e o pedido continua `concluido`', async () => {
    const { escolaId, pedidoId } = await pedidoNovo()
    await bancada.pool.query(`update pedido_titular set estado = 'concluido', concluido_em = now(), concluido_por = registrado_por where id = $1`, [pedidoId])
    const armazem = new InMemoryFileStorage()
    await rodar(escolaId, armazem, { pedidoId })
    const linhas = await linhasDoArquivo(pedidoId)
    expect(linhas).toHaveLength(1)
    expect(linhas[0]?.pronto_em.getTime()).toBe(AGORA.getTime())
    expect(armazem.objetos.size).toBe(1)
    expect(await estadoDo(pedidoId)).toBe('concluido')
  })

  it('o job que perde a disputa pelo pedido porque o outro terminou enquanto ele montava deixa o `pronto_em`, a validade e o `apagado_em` de quem gravou primeiro', async () => {
    const { escolaId, pedidoId } = await pedidoNovo()
    const armazem = new InMemoryFileStorage()
    const original = armazem.guardar.bind(armazem)
    let ganhador = false
    armazem.guardar = async (chave, conteudo) => {
      await original(chave, conteudo)
      if (ganhador) return
      // Enquanto o job de fora monta, o outro job do mesmo pedido termina inteiro, no instante AGORA.
      ganhador = true
      relogio.atual = AGORA
      await rodar(escolaId, armazem, { pedidoId })
      // A eliminação do titular marca o arquivo que o outro job acabou de gravar; o job de fora grava a seguir e não pode desmarcá-lo.
      await bancada.pool.query('update arquivo_titular set apagado_em = now() where pedido_id = $1', [pedidoId])
    }
    relogio.atual = new Date(AGORA.getTime() + UM_DIA_MS)
    try {
      await rodar(escolaId, armazem, { pedidoId })
    } finally {
      relogio.atual = AGORA
    }
    const linhas = await linhasDoArquivo(pedidoId)
    expect(linhas).toHaveLength(1)
    expect(linhas[0]?.pronto_em.getTime()).toBe(AGORA.getTime())
    expect(linhas[0]?.expira_em.getTime()).toBe(AGORA.getTime() + 7 * UM_DIA_MS)
    expect([...armazem.objetos.keys()]).toEqual([`titular/${escolaId}/${pedidoId}/completa.json`])
    expect(await estadoDo(pedidoId)).toBe('pronto')
    const { rows } = await bancada.pool.query<{ apagado_em: Date | null }>('select apagado_em from arquivo_titular where pedido_id = $1', [pedidoId])
    expect(rows[0]?.apagado_em).not.toBeNull()
  })

  it('o arquivo que a eliminação marcou `apagado_em` não é ressuscitado pelo job repetido', async () => {
    const { escolaId, pedidoId } = await pedidoNovo()
    const armazem = new InMemoryFileStorage()
    await rodar(escolaId, armazem, { pedidoId })
    await bancada.pool.query('update arquivo_titular set apagado_em = now() where pedido_id = $1', [pedidoId])
    await rodar(escolaId, armazem, { pedidoId })
    const { rows } = await bancada.pool.query<{ apagado_em: Date | null }>('select apagado_em from arquivo_titular where pedido_id = $1', [pedidoId])
    expect(rows[0]?.apagado_em).not.toBeNull()
  })

  it('o armazém fora: o erro sobe, o pedido fica `em_preparacao` e nenhuma linha é gravada; com ele de volta, o job conclui', async () => {
    const { escolaId, pedidoId } = await pedidoNovo()
    const armazem = new InMemoryFileStorage()
    armazem.fora = true
    await expect(rodar(escolaId, armazem, { pedidoId })).rejects.toMatchObject({ name: 'FileStorageUnavailableError' })
    expect(await estadoDo(pedidoId)).toBe('em_preparacao')
    expect(await linhasDoArquivo(pedidoId)).toEqual([])
    armazem.fora = false
    await rodar(escolaId, armazem, { pedidoId })
    expect(await estadoDo(pedidoId)).toBe('pronto')
  })

  it('o objeto é gravado antes da linha: no instante em que o armazém recebe os bytes, nenhuma linha do pedido existe ainda', async () => {
    const { escolaId, pedidoId } = await pedidoNovo()
    const armazem = new InMemoryFileStorage()
    const original = armazem.guardar.bind(armazem)
    const semLinhaNaHora: boolean[] = []
    armazem.guardar = async (chave, conteudo) => {
      semLinhaNaHora.push((await linhasDoArquivo(pedidoId)).length === 0)
      await original(chave, conteudo)
    }
    await rodar(escolaId, armazem, { pedidoId })
    expect(semLinhaNaHora).toEqual([true])
    expect(await linhasDoArquivo(pedidoId)).toHaveLength(1)
  })

  it('o pedido que não gera arquivo (compartilhamento), o titular que já não existe e o pedido de outra escola terminam sem efeito', async () => {
    const semArquivo = await pedidoNovo({ tipo: 'compartilhamento', estado: 'recebido' })
    const armazem = new InMemoryFileStorage()
    await rodar(semArquivo.escolaId, armazem, { pedidoId: semArquivo.pedidoId })
    expect(await estadoDo(semArquivo.pedidoId)).toBe('recebido')
    expect(await linhasDoArquivo(semArquivo.pedidoId)).toEqual([])

    const semTitular = await pedidoNovo()
    await bancada.pool.query('delete from usuario where id = $1', [semTitular.alunoId])
    await rodar(semTitular.escolaId, armazem, { pedidoId: semTitular.pedidoId })
    expect(await estadoDo(semTitular.pedidoId)).toBe('em_preparacao')

    // O id do pedido de B no job de A: nada é lido nem gravado (regra 10).
    const deA = await pedidoNovo()
    const deB = await pedidoNovo()
    await rodar(deA.escolaId, armazem, { pedidoId: deB.pedidoId })
    expect(await estadoDo(deB.pedidoId)).toBe('em_preparacao')
    expect(await linhasDoArquivo(deB.pedidoId)).toEqual([])
    expect(armazem.objetos.size).toBe(0)
  })

  it('sem escola no contexto o processador não monta nada: a escola vem do contexto, nunca dos dados', async () => {
    const { pedidoId } = await pedidoNovo()
    const armazem = new InMemoryFileStorage()
    await expect(rodar(undefined, armazem, { pedidoId })).rejects.toThrow('sem escola no contexto')
    expect(await estadoDo(pedidoId)).toBe('em_preparacao')
    expect(armazem.objetos.size).toBe(0)
  })

  it('o log do job leva só contagens e o nome do evento', async () => {
    const { escolaId, pedidoId } = await pedidoNovo()
    const armazem = new InMemoryFileStorage()
    await rodar(escolaId, armazem, { pedidoId })
    const linhas = log.registros().filter((linha) => String(linha['evento']).startsWith('titular.arquivo_'))
    expect(linhas.length).toBeGreaterThan(0)
    expect(linhas.find((linha) => linha['evento'] === 'titular.arquivo_pronto')).toMatchObject({ versoesTotal: 1, status: 'pronto' })
    for (const linha of linhas) {
      expect(Object.keys(linha).filter((chave) => !['level', 'time', 'servico', 'requisicaoId', 'escolaId', 'evento', 'versoesTotal', 'status'].includes(chave))).toEqual([])
    }
    expect(log.linhas.join('\n')).not.toContain(pedidoId)
    expect(log.linhas.join('\n')).not.toContain('Aluno sintético')
  })

  it('trilha: o job sai do banco pelo despachante, roda no worker montado da fila normal e grava o JSON no SeaweedFS de verdade', async () => {
    const { escolaId, pedidoId } = await pedidoNovo()
    const worker = montarWorker(
      { banco: configuracaoDoBanco(), redisFilaUrl: urlRedisDeFila(), pools: { normal: 2 }, vagasPadrao: vagasPadraoDoAmbiente(), threadsMaximo: 1, storage: STORAGE },
      log.logger,
      { prefixo: bancada.prefixo, relogio },
    )
    onTestFinished(() => worker.encerrar())
    const armazem = S3FileStorage.criar(STORAGE)
    onTestFinished(() => armazem.encerrar())
    bancada.despachante(log, { relogio }).iniciar()
    const chave = `titular/${escolaId}/${pedidoId}/completa.json`
    onTestFinished(() => armazem.armazem.apagar(chave))
    const jobId = await runInContext({ requisicaoId: randomUUID(), escolaId }, () =>
      bancada.banco.transaction((tx) => bancada.enfileirador.enfileirar(tx, TIPO_MONTAR_ARQUIVO, { pedidoId })),
    )
    await expect.poll(async () => (await bancada.estado(jobId))?.estado, { timeout: 20_000, interval: 100 }).toBe('concluido')
    expect(await estadoDo(pedidoId)).toBe('pronto')
    expect(await armazem.armazem.existe(chave)).toBe(true)
    const url = await armazem.armazem.urlDeDownload(chave, { nome: 'meus-dados-2026-10-09.json', validadeSegundos: 60 })
    const baixado = (await (await fetch(url)).json()) as { versao: string; titular: { papel: string } }
    expect(baixado).toMatchObject({ versao: 'completa', titular: { papel: 'aluno' } })
  })
})
