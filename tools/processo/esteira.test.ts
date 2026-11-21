import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { RelatorioDoPlaywright } from '../ci/duracao-do-e2e.ts'
import {
  acimaDeDoisTercos,
  argumentosDaListaDeExecucoes,
  argumentosDoDownloadDaFatia,
  baixarORelatorio,
  argumentosDosArtefatos,
  artefatosDoGh,
  branchDoCenso,
  CAMPOS_DA_EXECUCAO,
  casosDoCenso,
  codigoDoCenso,
  ehSoDocumento,
  estadoDaExecucao,
  EVENTOS_DO_VEREDITO,
  execucaoDe,
  execucoesDoGh,
  fatiasSemRelatorio,
  fazerOCenso,
  FATIAS_DO_E2E,
  jobsDoGh,
  jobsQueCairam,
  jobsQueNaoPassaram,
  nomeDoArtefatoDaFatia,
  relatorioDaEsteira,
  relatorioDaFatia,
  relatorioDoCenso,
  situacaoDaTarefa,
  situacaoDoFechamento,
  ultimaComE2eVerde,
  type ArtefatoDoGh,
  type Commit,
  type Execucao,
  type JobDoGh,
} from './esteira.ts'

/** Saída real do `gh`, gravada em 23/10/2026 (`gh run list --branch spec/reengenharia--l2 ...` e `gh run view --json jobs`). */
function fixture(nome: string): string {
  return readFileSync(join(import.meta.dirname, '__fixtures__', 'esteira', nome), 'utf8')
}

function commit(sha: string, soDocumento = false): Commit {
  return { sha, assunto: `commit ${sha}`, soDocumento }
}

function execucao(sha: string, estado: Execucao['estado'], criadaEm = '2026-10-11T10:00:00Z', id = 1, origem: Partial<Pick<Execucao, 'branch' | 'evento'>> = {}): Execucao {
  return { id, sha, estado, criadaEm, branch: 'spec/x', evento: 'push', ...origem }
}

describe('o que conta como commit só de documento', () => {
  it('documento não roda em suíte nenhuma, menos o runbook, que a guarda dos alertas lê', () => {
    expect(ehSoDocumento(['tasks/prd-x/estado.md', 'ROADMAP.md'])).toBe(true)
    expect(ehSoDocumento(['tasks/prd-x/estado.md', 'docs/runbook.md'])).toBe(false)
    expect(ehSoDocumento(['tasks/prd-x/estado.md', 'apps/api/src/x.ts'])).toBe(false)
    expect(ehSoDocumento(['.github/workflows/ci.yml'])).toBe(false)
  })
})

describe('a execução que vale para um commit', () => {
  it('é a mais nova dele: a reexecução de um vermelho troca o veredito', () => {
    const execucoes = [execucao('a', 'vermelha', '2026-10-11T10:00:00Z', 1), execucao('a', 'verde', '2026-10-11T11:00:00Z', 2), execucao('b', 'verde')]
    expect(execucaoDe('a', execucoes)?.id).toBe(2)
    expect(execucaoDe('c', execucoes)).toBeUndefined()
  })

  it('só é verde a que terminou com sucesso: a cancelada espera o veredito de quem a cancelou, a com falha é vermelha, e a que não terminou está rodando', () => {
    expect(estadoDaExecucao({ status: 'completed', conclusion: 'success' })).toBe('verde')
    expect(estadoDaExecucao({ status: 'completed', conclusion: 'failure' })).toBe('vermelha')
    expect(estadoDaExecucao({ status: 'completed', conclusion: 'cancelled' })).toBe('cancelada')
    expect(estadoDaExecucao({ status: 'in_progress', conclusion: null })).toBe('rodando')
    expect(estadoDaExecucao({ status: 'queued', conclusion: null })).toBe('rodando')
  })
})

describe('ao fechar uma tarefa: a esteira não segura a linha, só o vermelho segura', () => {
  const commits = [commit('c3'), commit('c2'), commit('c1')]

  it('sem execução nenhuma, segue', () => {
    expect(situacaoDaTarefa(commits, []).tipo).toBe('sem-execucao')
  })

  it('a execução do commit novo ainda rodando não segura, mesmo sem nenhuma terminada', () => {
    expect(situacaoDaTarefa(commits, [execucao('c3', 'rodando')]).tipo).toBe('rodando')
  })

  it('o vermelho do commit anterior aparece mesmo com a execução do commit novo no ar, e o relatório diz as duas coisas', () => {
    const situacao = situacaoDaTarefa(commits, [execucao('c3', 'rodando'), execucao('c2', 'vermelha', '2026-10-11T09:00:00Z', 7)])
    expect(situacao).toMatchObject({ tipo: 'vermelha', commit: { sha: 'c2' }, rodandoDepois: { sha: 'c3' } })
    const texto = relatorioDaEsteira(situacao, 'spec/x', false, ['e2e 2/4'])
    expect(texto).toContain('VERMELHA em c2')
    expect(texto).toContain('Jobs que caíram: e2e 2/4')
    expect(texto).toContain('execução mais nova rodando, em c3')
  })

  it('o verde mais novo encerra a conta: vermelho de commit mais antigo já foi corrigido', () => {
    const situacao = situacaoDaTarefa(commits, [execucao('c2', 'verde'), execucao('c1', 'vermelha')])
    expect(situacao).toMatchObject({ tipo: 'verde', commit: { sha: 'c2' } })
  })

  it('verde no anterior e rodando no novo é "rodando": o veredito do novo se lê na tarefa seguinte', () => {
    expect(situacaoDaTarefa(commits, [execucao('c3', 'rodando'), execucao('c2', 'verde')])).toMatchObject({ tipo: 'rodando', commit: { sha: 'c3' } })
  })
})

describe('no fechamento: a esteira precisa estar verde no último commit que alterou código', () => {
  it('o verde de um commit só de documento posterior ao código vale, e o do próprio commit de código também', () => {
    const commits = [commit('doc2', true), commit('doc1', true), commit('codigo'), commit('antes')]
    expect(situacaoDoFechamento(commits, [execucao('doc1', 'verde')]).tipo).toBe('verde')
    expect(situacaoDoFechamento(commits, [execucao('codigo', 'verde')]).tipo).toBe('verde')
  })

  it('o verde de um commit anterior ao último código não vale: o código já é outro', () => {
    const commits = [commit('doc', true), commit('codigo'), commit('antes')]
    const situacao = situacaoDoFechamento(commits, [execucao('antes', 'verde')])
    expect(situacao).toMatchObject({ tipo: 'sem-execucao', commit: { sha: 'codigo' } })
    expect(relatorioDaEsteira(situacao, 'spec/x', true)).toContain('gh workflow run esteira --ref spec/x')
  })

  it('rodando manda esperar, e vermelha não fecha', () => {
    const commits = [commit('doc', true), commit('codigo')]
    const rodando = situacaoDoFechamento(commits, [execucao('doc', 'rodando', '2026-10-11T10:00:00Z', 9)])
    expect(rodando.tipo).toBe('rodando')
    expect(relatorioDaEsteira(rodando, 'spec/x', true)).toContain('gh run watch 9 --exit-status')
    expect(situacaoDoFechamento(commits, [execucao('codigo', 'vermelha')]).tipo).toBe('vermelha')
  })

  it('com um verde e um vermelho entre os candidatos, vale o verde: o que rodou foi o mesmo código', () => {
    const commits = [commit('doc', true), commit('codigo')]
    expect(situacaoDoFechamento(commits, [execucao('doc', 'verde'), execucao('codigo', 'vermelha')]).tipo).toBe('verde')
  })
})

describe('a esteira cancelada: superada por um push mais novo na mesma branch, ou vermelha com o job que caiu', () => {
  // A execução 39821519092 foi cancelada pelo `timeout-minutes` do job `e2e 4/7` (45 min); a 39830626582, verde, é o push
  // seguinte na mesma branch. Na época não havia `concurrency`: o fixture só serve de dado real para as duas leituras.
  const POR_PRAZO = 39821519092
  const SUCESSORA = 39830626582
  const lista = execucoesDoGh(fixture('run-list.json'))
  const daLista = (id: number): Execucao => {
    const achada = lista.find((execucao) => execucao.id === id)
    if (!achada) throw new Error(`o fixture não tem a execução ${String(id)}`)
    return achada
  }
  const cancelada = daLista(POR_PRAZO)
  const sucessora = daLista(SUCESSORA)
  const semSucessora = lista.filter((execucao) => execucao.criadaEm.localeCompare(cancelada.criadaEm) <= 0)
  const commits = (...execucoes: Execucao[]): Commit[] => execucoes.map((execucao) => commit(execucao.sha))
  const jobsDoGh = fixture('run-view-jobs-cancelada-por-prazo.json')

  it('o fixture é o que diz ser: a lista traz os campos pedidos ao gh, e o job cancelado durou o prazo do job', () => {
    expect(Object.keys(JSON.parse(fixture('run-list.json'))[0] as object).sort()).toEqual(CAMPOS_DA_EXECUCAO.split(',').sort())
    expect(cancelada).toMatchObject({ estado: 'cancelada', evento: 'push', branch: 'spec/reengenharia--l2' })
    expect(sucessora.estado).toBe('verde')
    const jobs = (JSON.parse(jobsDoGh) as { jobs: { name: string; conclusion: string; startedAt: string; completedAt: string }[] }).jobs
    const [caiu, ...outros] = jobs.filter((job) => job.conclusion === 'cancelled')
    expect(outros).toEqual([])
    const minutos = (Date.parse(caiu?.completedAt ?? '') - Date.parse(caiu?.startedAt ?? '')) / 60_000
    expect(minutos).toBeGreaterThanOrEqual(45)
  })

  it('RF2 (a): a cancelada mais nova, sem push depois dela, é vermelha e o relatório cita o job que o prazo cancelou', () => {
    const situacao = situacaoDaTarefa(commits(cancelada), semSucessora)
    expect(situacao).toMatchObject({ tipo: 'vermelha', execucao: { id: POR_PRAZO } })
    const jobs = jobsQueCairam(situacao, () => jobsQueNaoPassaram(jobsDoGh))
    expect(jobs).toEqual(['e2e 4/7 (compose completo e Playwright)'])
    expect(relatorioDaEsteira(situacao, 'spec/reengenharia--l2', false, jobs)).toContain('Jobs que caíram: e2e 4/7 (compose completo e Playwright)')
    expect(situacaoDoFechamento(commits(cancelada), semSucessora)).toMatchObject({ tipo: 'vermelha', execucao: { id: POR_PRAZO } })
  })

  it('RF2 (b): a vermelha mais nova que uma verde do mesmo commit é vermelha', () => {
    const execucoes = [execucao('c1', 'verde', '2026-10-11T09:00:00Z', 1), execucao('c1', 'vermelha', '2026-10-11T10:00:00Z', 2)]
    expect(situacaoDaTarefa([commit('c1')], execucoes)).toMatchObject({ tipo: 'vermelha', execucao: { id: 2 } })
    expect(situacaoDoFechamento([commit('c1')], execucoes)).toMatchObject({ tipo: 'vermelha', execucao: { id: 2 } })
  })

  it('RF2 (c): a cancelada com push mais novo e concluído na mesma branch está superada, e vale o mais novo', () => {
    const doDia = commits(sucessora, cancelada)
    expect(situacaoDaTarefa(doDia, lista)).toMatchObject({ tipo: 'verde', commit: { sha: sucessora.sha } })
    expect(situacaoDoFechamento(doDia, lista)).toMatchObject({ tipo: 'verde', commit: { sha: sucessora.sha } })
    // Sem o commit do push novo na janela, a cancelada não vira vermelha: a esteira ainda não disse nada sobre o código.
    expect(situacaoDaTarefa(commits(cancelada), lista).tipo).toBe('sem-execucao')
    expect(situacaoDoFechamento(commits(cancelada), lista).tipo).toBe('sem-execucao')
  })

  it('RF2 (d): o mesmo com o push mais novo ainda rodando é rodando, e não vermelho com um "rodando depois"', () => {
    const rodando = lista.map((execucao) => (execucao.id === SUCESSORA ? { ...execucao, estado: 'rodando' as const } : execucao))
    const doDia = commits(sucessora, cancelada)
    expect(situacaoDaTarefa(doDia, rodando)).toMatchObject({ tipo: 'rodando', commit: { sha: sucessora.sha } })
    expect(situacaoDoFechamento(doDia, rodando)).toMatchObject({ tipo: 'rodando', commit: { sha: sucessora.sha } })
  })

  it('RF2 (e): os jobs da superada não entram em jobsVermelhos, e nem são pedidos ao GitHub', () => {
    const pedidos: number[] = []
    const lerJobs = (id: number): string[] => {
      pedidos.push(id)
      return jobsQueNaoPassaram(jobsDoGh)
    }
    const doDia = commits(sucessora, cancelada)
    expect(jobsQueCairam(situacaoDaTarefa(doDia, lista), lerJobs)).toEqual([])
    expect(jobsQueCairam(situacaoDoFechamento(doDia, lista), lerJobs)).toEqual([])
    expect(pedidos).toEqual([])
    jobsQueCairam(situacaoDaTarefa(commits(cancelada), semSucessora), lerJobs)
    expect(pedidos).toEqual([POR_PRAZO])
  })

  it('RF2 (f): o commit só de documento vale pelo de código: a cancelada do documento superado não tira o verde do código', () => {
    const ordem = [commit('doc2', true), commit('doc1', true), commit('codigo')]
    const execucoes = [
      execucao('codigo', 'verde', '2026-10-11T10:00:00Z', 1),
      execucao('doc1', 'cancelada', '2026-10-11T10:05:00Z', 2),
      execucao('doc2', 'rodando', '2026-10-11T10:06:00Z', 3),
    ]
    expect(situacaoDoFechamento(ordem, execucoes)).toMatchObject({ tipo: 'verde', commit: { sha: 'codigo' } })
    // Na tarefa, a superada sai: sem a regra, a cancelada do doc1 seria vermelha, com um "rodando depois" do doc2.
    expect(situacaoDaTarefa(ordem, execucoes)).toMatchObject({ tipo: 'rodando', commit: { sha: 'doc2' } })
    // Sem o push novo, a cancelada do documento é vermelha como qualquer outra: o verde do código continua valendo no fechamento.
    expect(situacaoDoFechamento(ordem, execucoes.slice(0, 2))).toMatchObject({ tipo: 'verde', commit: { sha: 'codigo' } })
    expect(situacaoDaTarefa(ordem, execucoes.slice(0, 2))).toMatchObject({ tipo: 'vermelha', commit: { sha: 'doc1' } })
  })

  it('RF2 (g): push em outra branch, execução de pull_request ou manual, ou no mesmo instante, não supera a cancelada', () => {
    const base = execucao('c1', 'cancelada', '2026-10-11T10:00:00Z', 1)
    const depois = '2026-10-11T10:05:00Z'
    const casos: [string, Execucao][] = [
      ['push em outra branch', execucao('c2', 'verde', depois, 2, { branch: 'spec/y' })],
      ['pull_request da mesma branch', execucao('c2', 'verde', depois, 2, { evento: 'pull_request' })],
      ['execução manual da mesma branch', execucao('c2', 'verde', depois, 2, { evento: 'workflow_dispatch' })],
      ['push da mesma branch no mesmo instante', execucao('c2', 'verde', '2026-10-11T10:00:00Z', 2)],
      ['push da mesma branch mais antigo', execucao('c2', 'verde', '2026-10-11T09:00:00Z', 2)],
    ]
    for (const [nome, outra] of casos) {
      expect(situacaoDaTarefa([commit('c1')], [base, outra]), nome).toMatchObject({ tipo: 'vermelha', execucao: { id: 1 } })
      expect(situacaoDoFechamento([commit('c1')], [base, outra]), nome).toMatchObject({ tipo: 'vermelha', execucao: { id: 1 } })
    }
    // E o push da mesma branch, mais novo, supera, qualquer que seja o resultado dele.
    const vermelha = execucao('c2', 'vermelha', depois, 2)
    expect(situacaoDaTarefa([commit('c2'), commit('c1')], [base, vermelha])).toMatchObject({ tipo: 'vermelha', execucao: { id: 2 } })
    expect(situacaoDaTarefa([commit('c1')], [base, vermelha]).tipo).toBe('sem-execucao')
  })

  it('a execução superada não esconde o verde que o mesmo commit já tinha', () => {
    const execucoes = [execucao('c1', 'verde', '2026-10-11T09:00:00Z', 1), execucao('c1', 'cancelada', '2026-10-11T10:00:00Z', 2), execucao('c2', 'rodando', '2026-10-11T10:05:00Z', 3)]
    expect(situacaoDaTarefa([commit('c1')], execucoes)).toMatchObject({ tipo: 'verde', execucao: { id: 1 } })
  })
})

describe('a saída do gh, lida sem rede', () => {
  it('a execução leva a branch e o evento que o GitHub diz, e o job pulado não conta como job que caiu', () => {
    const [lida] = execucoesDoGh(
      JSON.stringify([{ databaseId: 5, headSha: 'abc', status: 'in_progress', conclusion: null, createdAt: '2026-10-11T10:00:00Z', event: 'pull_request', headBranch: 'spec/y' }]),
    )
    expect(lida).toEqual({ id: 5, sha: 'abc', estado: 'rodando', criadaEm: '2026-10-11T10:00:00Z', branch: 'spec/y', evento: 'pull_request' })
    const jobs = [
      { name: 'verificar', conclusion: 'success' },
      { name: 'infra', conclusion: 'skipped' },
      { name: 'e2e 1/7', conclusion: 'failure' },
      { name: 'e2e 2/7', conclusion: 'cancelled' },
      { name: 'e2e 3/7', conclusion: null },
    ]
    expect(jobsQueNaoPassaram(JSON.stringify({ jobs }))).toEqual(['e2e 1/7', 'e2e 2/7', 'e2e 3/7'])
  })
})

describe('o que se pergunta ao GitHub', () => {
  it('uma chamada por evento do veredito, cada uma com o seu --event, e o pull_request fora', () => {
    expect([...EVENTOS_DO_VEREDITO]).toEqual(['push', 'workflow_dispatch'])
    for (const evento of EVENTOS_DO_VEREDITO) {
      const argumentos = argumentosDaListaDeExecucoes('spec/x', evento)
      expect(argumentos[argumentos.indexOf('--event') + 1]).toBe(evento)
      expect(argumentos[argumentos.indexOf('--branch') + 1]).toBe('spec/x')
      expect(argumentos[argumentos.indexOf('--json') + 1]).toBe(CAMPOS_DA_EXECUCAO)
    }
  })
})

describe('o censo do prazo do e2e (RF9, M4 da retro da F4b): o caso acima de dois terços do prazo na execução mais nova com o e2e verde', () => {
  /** O formato do repórter `json` do Playwright, com um caso por linha pedida. */
  function relatorioDe(...casos: { linha: number; titulo: string; duracaoMs: number; timeout?: number; projeto?: string }[]): RelatorioDoPlaywright {
    return {
      suites: [
        {
          title: 'material.spec.ts',
          specs: casos.map((caso) => ({
            title: caso.titulo,
            file: 'material.spec.ts',
            line: caso.linha,
            tests: [{ projectName: caso.projeto ?? 'chromebook', status: 'expected', timeout: caso.timeout ?? 30_000, results: [{ duration: caso.duracaoMs }] }],
          })),
        },
      ],
    }
  }
  const dasFatias = (relatorios: Record<number, RelatorioDoPlaywright>) => (_execucao: number, fatia: number) => relatorios[fatia] ?? relatorioDe()
  const completos: ArtefatoDoGh[] = FATIAS_DO_E2E.map((fatia) => ({ name: nomeDoArtefatoDaFatia(fatia), expired: false }))
  const verde = execucao('abc', 'verde', '2026-10-23T10:00:00Z', 10)
  /** Os jobs como o `ci.yml` os nomeia: o `verificar` e uma fatia de e2e por número, cada um com a conclusão que o caso pede. */
  const VERIFICAR = 'verificar (tipos, lint e guardas, segredo, dependências, git hook)'
  const jobsDe = (verificar: string | null, e2e: (fatia: number) => string | null = () => 'success'): JobDoGh[] => [
    { name: VERIFICAR, conclusion: verificar },
    { name: 'unidade 1/2 (Vitest)', conclusion: 'success' },
    ...FATIAS_DO_E2E.map((fatia) => ({ name: `e2e ${String(fatia)}/${String(FATIAS_DO_E2E.length)} (compose completo e Playwright)`, conclusion: e2e(fatia) })),
  ]
  const jobsVerdes = () => jobsDe('success')

  it('o caso a 70% do prazo é listado, com a fatia e o prazo; o a 60% não', () => {
    const censo = fazerOCenso(
      [verde],
      () => completos,
      dasFatias({
        3: relatorioDe({ linha: 5, titulo: 'a 70%', duracaoMs: 21_000 }, { linha: 9, titulo: 'a 60%', duracaoMs: 18_000 }),
      }),
      jobsVerdes,
    )
    expect(censo).toMatchObject({ tipo: 'lista', execucao: { id: 10 } })
    const casos = censo.tipo === 'lista' ? censo.casos : []
    expect(casos.map((caso) => [caso.titulo, caso.fatia, caso.prazoMs])).toEqual([['a 70%', 3, 30_000]])
    const texto = relatorioDoCenso(censo, 'spec/x')
    expect(texto).toContain('e2e/material.spec.ts:5 (chromebook, fatia 3) levou 21,0 s de 30,0 s')
    expect(texto).toContain('1 caso(s)')
    expect(texto).not.toContain('a 60%')
    expect(texto).not.toContain('vermelho fora do e2e')
    expect(codigoDoCenso(censo)).toBe(1)
  })

  it('exatamente dois terços ainda cabe, e o prazo é o que a corrida deu ao caso: 63 s de 90 s é listado, 50 s de 90 s não', () => {
    expect(acimaDeDoisTercos({ duracaoMs: 20_000, prazoMs: 30_000 })).toBe(false)
    expect(acimaDeDoisTercos({ duracaoMs: 20_001, prazoMs: 30_000 })).toBe(true)
    const casos = casosDoCenso([
      {
        fatia: 1,
        relatorio: relatorioDe(
          { linha: 1, titulo: 'slow a 70%', duracaoMs: 63_000, timeout: 90_000 },
          { linha: 2, titulo: 'slow a 55%', duracaoMs: 50_000, timeout: 90_000 },
        ),
      },
    ])
    expect(casos.map((caso) => caso.titulo)).toEqual(['slow a 70%'])
  })

  it('a lista vem do caso mais perto do prazo para o mais longe, reunindo as fatias, e vazia dá código 0', () => {
    const casos = casosDoCenso([
      { fatia: 2, relatorio: relatorioDe({ linha: 1, titulo: 'a 75%', duracaoMs: 22_500 }) },
      { fatia: 5, relatorio: relatorioDe({ linha: 1, titulo: 'a 95%', duracaoMs: 28_500 }, { linha: 2, titulo: 'a 80%', duracaoMs: 24_000 }) },
    ])
    expect(casos.map((caso) => [caso.titulo, caso.fatia])).toEqual([
      ['a 95%', 5],
      ['a 80%', 5],
      ['a 75%', 2],
    ])
    const vazio = fazerOCenso([verde], () => completos, dasFatias({}), jobsVerdes)
    expect(codigoDoCenso(vazio)).toBe(0)
    expect(relatorioDoCenso(vazio, 'spec/x')).toContain('nenhum caso acima de dois terços do prazo')
  })

  it('fatia sem artefato sai 2 e diz qual; o censo não lê as outras', () => {
    const lidas: number[] = []
    const semAQuarta = completos.filter((artefato) => artefato.name !== nomeDoArtefatoDaFatia(4))
    const censo = fazerOCenso([verde], () => semAQuarta, (_id, fatia) => (lidas.push(fatia), relatorioDe()), jobsVerdes)
    expect(censo).toMatchObject({ tipo: 'incompleto', faltando: [4], expiradas: [] })
    expect(codigoDoCenso(censo)).toBe(2)
    const texto = relatorioDoCenso(censo, 'spec/x')
    expect(texto).toContain('Fatia(s) sem artefato: 4.')
    expect(texto).not.toContain('expirado')
    expect(lidas).toEqual([])
  })

  it('artefato expirado sai 2 e diz qual, separado do que falta', () => {
    const comAQuintaExpirada = completos.map((artefato) => (artefato.name === nomeDoArtefatoDaFatia(5) ? { ...artefato, expired: true } : artefato))
    const censo = fazerOCenso([verde], () => comAQuintaExpirada, dasFatias({}), jobsVerdes)
    expect(censo).toMatchObject({ tipo: 'incompleto', faltando: [], expiradas: [5] })
    expect(codigoDoCenso(censo)).toBe(2)
    const texto = relatorioDoCenso(censo, 'spec/x')
    expect(texto).toContain('Fatia(s) com artefato expirado: 5.')
    expect(texto).not.toContain('sem artefato')
  })

  it('o artefato de outro nome não vale pela fatia, e todas as fatias da matriz são pedidas', () => {
    expect(fatiasSemRelatorio([{ name: 'traco-do-e2e-1', expired: false }])).toEqual({ faltando: [...FATIAS_DO_E2E], expiradas: [] })
    expect(fatiasSemRelatorio(completos)).toEqual({ faltando: [], expiradas: [] })
    expect(nomeDoArtefatoDaFatia(3)).toBe('censo-do-e2e-3')
  })

  it('a rodando e a cancelada ficam de fora, e a vermelha com uma fatia de e2e vermelha também: o censo lê a mais nova com o e2e verde', () => {
    const execucoes = [
      execucao('d', 'vermelha', '2026-10-23T12:00:00Z', 13),
      execucao('c', 'rodando', '2026-10-23T11:30:00Z', 12),
      execucao('b', 'verde', '2026-10-23T11:00:00Z', 11),
      execucao('a', 'verde', '2026-10-23T10:00:00Z', 10),
      execucao('z', 'cancelada', '2026-10-23T11:45:00Z', 14),
    ]
    const lidasDosJobs: number[] = []
    const dosJobs = (id: number) => (lidasDosJobs.push(id), id === 13 ? jobsDe('failure', (fatia) => (fatia === 4 ? 'failure' : 'success')) : jobsVerdes())
    expect(ultimaComE2eVerde(execucoes, dosJobs)?.execucao.id).toBe(11)
    // a rodando e a cancelada nem têm os jobs perguntados; a vermelha do e2e vermelho é perguntada e passada
    expect(lidasDosJobs).toEqual([13, 11])
    const lidas: number[] = []
    const baixadas: [number, number][] = []
    const censo = fazerOCenso(
      execucoes,
      (id) => (lidas.push(id), completos),
      (id, fatia) => (baixadas.push([id, fatia]), relatorioDe()),
      dosJobs,
    )
    expect(censo).toMatchObject({ tipo: 'lista', execucao: { id: 11 }, foraDoE2e: [] })
    expect(new Set(lidas)).toEqual(new Set([11]))
    // cada fatia da matriz, e só da execução lida: nem a vermelha mais nova, nem uma fatia pulada
    expect(baixadas).toEqual(FATIAS_DO_E2E.map((fatia) => [11, fatia]))
  })

  it('a execução vermelha só no verificar, com o e2e todo verde, é a lida: o topo diz qual leu e o que estava vermelho nela', () => {
    const vermelha = execucao('d', 'vermelha', '2026-10-23T12:00:00Z', 13)
    const antiga = execucao('a', 'verde', '2026-10-23T10:00:00Z', 10)
    const lidas: number[] = []
    const censo = fazerOCenso(
      [antiga, vermelha],
      (id) => (lidas.push(id), completos),
      dasFatias({ 2: relatorioDe({ linha: 7, titulo: 'a 80%', duracaoMs: 24_000 }) }),
      (id) => (id === 13 ? jobsDe('failure') : jobsVerdes()),
    )
    expect(censo).toMatchObject({ tipo: 'lista', execucao: { id: 13 }, foraDoE2e: [VERIFICAR] })
    expect(new Set(lidas)).toEqual(new Set([13]))
    expect(codigoDoCenso(censo)).toBe(1)
    const texto = relatorioDoCenso(censo, 'spec/x')
    const [topo = ''] = texto.split('\n')
    expect(topo).toContain('leu a execução 13 (d)')
    expect(topo).toContain('com o e2e verde')
    expect(topo).toContain(`vermelho fora do e2e: ${VERIFICAR}`)
    expect(texto).toContain('a 80%')
  })

  it('o job de e2e pulado ou cancelado não vale pela fatia, e fatia que falta na lista de jobs também não', () => {
    const vermelha = execucao('d', 'vermelha', '2026-10-23T12:00:00Z', 13)
    for (const conclusao of ['skipped', 'cancelled', null, 'failure']) {
      expect(ultimaComE2eVerde([vermelha], () => jobsDe('success', (fatia) => (fatia === 7 ? conclusao : 'success')))).toBeUndefined()
    }
    expect(ultimaComE2eVerde([vermelha], () => jobsDe('success').filter((job) => !job.name.startsWith('e2e 11/')))).toBeUndefined()
    expect(ultimaComE2eVerde([vermelha], () => jobsVerdes())?.execucao.id).toBe(13)
  })

  it('a execução com o e2e verde sem o artefato de uma fatia sai 2 e diz qual, vermelho fora do e2e incluído', () => {
    const vermelha = execucao('d', 'vermelha', '2026-10-23T12:00:00Z', 13)
    const semAQuarta = completos.filter((artefato) => artefato.name !== nomeDoArtefatoDaFatia(4))
    const censo = fazerOCenso([vermelha], () => semAQuarta, dasFatias({}), () => jobsDe('failure'))
    expect(censo).toMatchObject({ tipo: 'incompleto', execucao: { id: 13 }, faltando: [4], foraDoE2e: [VERIFICAR] })
    expect(codigoDoCenso(censo)).toBe(2)
    const texto = relatorioDoCenso(censo, 'spec/x')
    expect(texto).toContain('Fatia(s) sem artefato: 4.')
    expect(texto.split('\n')[0]).toContain(`vermelho fora do e2e: ${VERIFICAR}`)
  })

  it('sem nenhuma execução com o e2e verde não há o que ler: sai 2', () => {
    const censo = fazerOCenso([execucao('d', 'vermelha')], () => completos, dasFatias({}), () => jobsDe('success', (fatia) => (fatia === 1 ? 'failure' : 'success')))
    expect(censo).toEqual({ tipo: 'sem-verde' })
    expect(codigoDoCenso(censo)).toBe(2)
    expect(relatorioDoCenso(censo, 'spec/x')).toContain('nenhuma execução com o e2e verde')
  })

  it('os jobs do gh vêm com nome e conclusão, e o job que não passou é o que a lista de jobs caídos já dava', () => {
    const jobs = [
      { name: 'verificar', conclusion: 'failure' },
      { name: 'infra 1/3', conclusion: 'skipped' },
    ]
    expect(jobsDoGh(JSON.stringify({ jobs, outro: 1 }))).toEqual(jobs)
    expect(jobsQueNaoPassaram(JSON.stringify({ jobs }))).toEqual(['verificar'])
  })

  it('o relatório de uma fatia gravado pela esteira é lido: o caso a 70% do fixture aparece, o a 30% não, e JSON quebrado diz de qual fatia', () => {
    const relatorio = relatorioDaFatia(fixture('censo-do-e2e-fatia.json'), 3)
    const casos = casosDoCenso([{ fatia: 3, relatorio }])
    expect(casos.map((caso) => [caso.arquivo, caso.linha, caso.projeto, caso.titulo, caso.fatia])).toEqual([
      ['e2e/material.spec.ts', 12, 'chromebook', 'material da coordenação › sobe o PDF licenciado', 3],
    ])
    expect(() => relatorioDaFatia('{ quebrado', 6)).toThrow('fatia 6')
  })

  it('o que se pergunta ao GitHub: os artefatos da execução, e o download de uma fatia pelo nome, numa pasta à parte', () => {
    expect(argumentosDosArtefatos(77)).toEqual(['api', 'repos/{owner}/{repo}/actions/runs/77/artifacts?per_page=100'])
    expect(argumentosDoDownloadDaFatia(77, 2, '/tmp/x')).toEqual(['run', 'download', '77', '--name', 'censo-do-e2e-2', '--dir', '/tmp/x'])
    expect(artefatosDoGh(JSON.stringify({ total_count: 1, artifacts: [{ id: 1, name: 'censo-do-e2e-1', expired: true, size_in_bytes: 9 }] }))).toEqual([
      { name: 'censo-do-e2e-1', expired: true },
    ])
  })

  it('o download traz o relatório da fatia pelo arquivo do artefato, na pasta que o gh recebe, e apaga a pasta depois', () => {
    let pasta = ''
    const relatorio = baixarORelatorio(77, 4, (argumentos) => {
      expect(argumentos.slice(0, 5)).toEqual(['run', 'download', '77', '--name', 'censo-do-e2e-4'])
      pasta = argumentos[argumentos.indexOf('--dir') + 1] ?? ''
      writeFileSync(join(pasta, 'censo-do-e2e.json'), fixture('censo-do-e2e-fatia.json'))
    })
    expect(casosDoCenso([{ fatia: 4, relatorio }]).map((caso) => caso.linha)).toEqual([12])
    expect(pasta).not.toBe('')
    expect(existsSync(pasta)).toBe(false)
    // O gh que falha também não deixa a pasta para trás.
    expect(() =>
      baixarORelatorio(77, 4, (argumentos) => {
        pasta = argumentos[argumentos.indexOf('--dir') + 1] ?? ''
        throw new Error('artefato expirado')
      }),
    ).toThrow('artefato expirado')
    expect(existsSync(pasta)).toBe(false)
  })

  it('a branch do censo é a do argumento, ou a atual quando não vem nenhuma', () => {
    expect(branchDoCenso(['node', 'esteira.ts', '--censo', 'spec/outra'], 'spec/x')).toBe('spec/outra')
    expect(branchDoCenso(['node', 'esteira.ts', '--censo'], 'spec/x')).toBe('spec/x')
    expect(branchDoCenso(['node', 'esteira.ts', '--censo', '--fechamento'], 'spec/x')).toBe('spec/x')
  })
})
