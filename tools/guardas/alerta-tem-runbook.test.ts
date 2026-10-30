import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { raizRepositorio } from '../ci/executar.ts'
import { ancoraDoTitulo, arquivosDeAlertaDoRepositorio, CAMINHO_DO_RUNBOOK, CAMPOS_DA_ENTRADA, ENDERECO_DO_RUNBOOK, problemasDeRunbook, regrasDoArquivo, type ArquivoDeAlerta } from './alerta-tem-runbook.ts'

const runbookDoRepositorio = readFileSync(join(raizRepositorio, CAMINHO_DO_RUNBOOK), 'utf8')

/** Um arquivo de regra mínimo, no formato de provisionamento do Grafana. */
function arquivoDeRegra(titulo: string, runbookUrl: string | undefined, caminho = 'infra/grafana/alertas/fila-parada.yaml'): ArquivoDeAlerta {
  const anotacao = runbookUrl === undefined ? '' : `\n        annotations:\n          runbook_url: ${runbookUrl}`
  return {
    caminho,
    conteudo: `apiVersion: 1\ngroups:\n  - orgId: 1\n    name: teste\n    folder: Educa.ia alertas\n    interval: 10s\n    rules:\n      - uid: teste\n        title: ${titulo}\n        for: 1m${anotacao}\n`,
  }
}

/** Uma entrada completa no formato do runbook, citando a regra. */
function entrada(titulo: string, caminho = 'infra/grafana/alertas/fila-parada.yaml', semCampo?: string): string {
  const campos = CAMPOS_DA_ENTRADA.filter((campo) => campo !== semCampo).map((campo) => `**${campo}:** texto, regra \`${caminho}\`.`)
  return `# Runbook\n\n## ${titulo}\n\n${campos.join('\n\n')}\n\n---\n\n## Como avisar as escolas\n\n*A definir.*\n`
}

describe('guarda: alerta tem runbook', () => {
  it('no repositório, cada arquivo de `infra/grafana/alertas/` tem entrada correspondente em `docs/runbook.md`, completa', () => {
    const arquivos = arquivosDeAlertaDoRepositorio()
    expect(arquivos.map((arquivo) => arquivo.caminho)).toEqual([
      'infra/grafana/alertas/arquivo-em-preparacao.yaml',
      'infra/grafana/alertas/eliminacao-vencida.yaml',
      'infra/grafana/alertas/expurgo-noites-incompletas.yaml',
      'infra/grafana/alertas/incidente-sem-confirmacao.yaml',
      'infra/grafana/alertas/job-falhou-de-vez.yaml',
      'infra/grafana/alertas/job-interativo-esperando.yaml',
      'infra/grafana/alertas/login-email-limite-ip.yaml',
      'infra/grafana/alertas/login-hash-recusado.yaml',
      'infra/grafana/alertas/login-lento.yaml',
      'infra/grafana/alertas/login-rebaixado-por-escola.yaml',
      'infra/grafana/alertas/reuso-de-refresh.yaml',
      'infra/grafana/alertas/sala-codigo-errado-por-escola.yaml',
      'infra/grafana/alertas/seguro-limite-ativo.yaml',
      'infra/grafana/alertas/taxa-5xx.yaml',
    ])
    expect(problemasDeRunbook(arquivos, runbookDoRepositorio)).toEqual([])
    expect(arquivos.flatMap(regrasDoArquivo).map((regra) => regra.titulo)).toEqual([
      'Arquivo do titular em preparação há mais de 2 h',
      'Eliminação do titular agendada há mais de 48 h do prazo',
      'Expurgo incompleto por duas noites numa escola',
      'Incidente sem confirmação em 24 h',
      'Job que falhou de vez',
      'Job interativo esperando',
      'Login por e-mail acima do limite por IP',
      'Login recusado pelo semáforo do hash',
      'Login lento',
      'Login rebaixado numa escola',
      'Reuso de refresh',
      'Código da turma errado em massa numa escola',
      'Seguro de limite ativo',
      'Taxa de erro 5xx',
    ])
  })

  it('o endereço do runbook é o do repositório atual, na organização Turmma', () => {
    expect(ENDERECO_DO_RUNBOOK).toBe('https://github.com/Turmma/turmma/blob/main/docs/runbook.md#')
  })

  it('reprova: runbook_url com o endereço antigo do repositório, mesmo com a entrada certa no runbook', () => {
    for (const antigo of ['https://github.com/LitzGab/Educa.ia', 'https://github.com/LitzGab/Turmma.ai']) {
      const arquivo = arquivoDeRegra('Fila parada', `${antigo}/blob/main/docs/runbook.md#fila-parada`)
      expect(problemasDeRunbook([arquivo], entrada('Fila parada'))).toEqual([`infra/grafana/alertas/fila-parada.yaml (Fila parada): runbook_url precisa apontar para ${ENDERECO_DO_RUNBOOK}<entrada>`])
    }
  })

  it('reprova: regra nova sem entrada no runbook', () => {
    const arquivo = arquivoDeRegra('Fila parada', `${ENDERECO_DO_RUNBOOK}fila-parada`)
    expect(problemasDeRunbook([...arquivosDeAlertaDoRepositorio(), arquivo], runbookDoRepositorio)).toEqual([
      'infra/grafana/alertas/fila-parada.yaml (Fila parada): sem entrada "## Fila parada" em docs/runbook.md',
    ])
  })

  it('reprova: regra sem `runbook_url`, ou apontando para fora do runbook', () => {
    const esperado = [`infra/grafana/alertas/fila-parada.yaml (Fila parada): runbook_url precisa apontar para ${ENDERECO_DO_RUNBOOK}<entrada>`]
    expect(problemasDeRunbook([arquivoDeRegra('Fila parada', undefined)], entrada('Fila parada'))).toEqual(esperado)
    expect(problemasDeRunbook([arquivoDeRegra('Fila parada', 'https://exemplo.invalid/runbook#fila-parada')], entrada('Fila parada'))).toEqual(esperado)
  })

  it('reprova: `runbook_url` apontando para a entrada de outro alerta, que existe', () => {
    const problemas = problemasDeRunbook([arquivoDeRegra('Fila parada', `${ENDERECO_DO_RUNBOOK}job-interativo-esperando`)], `${entrada('Fila parada')}\n${runbookDoRepositorio}`)
    expect(problemas).toContain(
      'infra/grafana/alertas/fila-parada.yaml (Fila parada): runbook_url aponta para #job-interativo-esperando, e a entrada precisa ter o nome da regra (#fila-parada)',
    )
  })

  it('reprova: entrada ainda "a preencher", ou sem um dos campos do formato, ou sem citar a regra', () => {
    const arquivo = arquivoDeRegra('Fila parada', `${ENDERECO_DO_RUNBOOK}fila-parada`)
    expect(problemasDeRunbook([arquivo], entrada('Fila parada'))).toEqual([])
    expect(problemasDeRunbook([arquivo], '## Fila parada\n\n*A preencher no F5.*\n')).toEqual(expect.arrayContaining([expect.stringContaining('"a preencher"')]))
    for (const campo of CAMPOS_DA_ENTRADA) {
      expect(problemasDeRunbook([arquivo], entrada('Fila parada', arquivo.caminho, campo)), campo).toEqual([`${arquivo.caminho} (Fila parada): a entrada do runbook não tem "${campo}:"`])
    }
    expect(problemasDeRunbook([arquivo], entrada('Fila parada', 'infra/grafana/alertas/outra.yaml'))).toEqual([`${arquivo.caminho} (Fila parada): a entrada do runbook não cita a regra (${arquivo.caminho})`])
  })

  it('reprova: regra em .json na pasta, que o Grafana provisionaria sem a guarda ler', () => {
    const regraEmJson = { caminho: 'infra/grafana/alertas/taxa-4xx.json', conteudo: '{"apiVersion":1,"groups":[{"name":"http","rules":[{"uid":"x","title":"Taxa 4xx"}]}]}' }
    expect(problemasDeRunbook([...arquivosDeAlertaDoRepositorio(), regraEmJson], runbookDoRepositorio)).toEqual([
      'infra/grafana/alertas/taxa-4xx.json: a pasta de alertas só aceita regra em .yaml, que a guarda confere',
    ])
  })

  it('reprova: arquivo na pasta de alertas sem regra nenhuma', () => {
    expect(problemasDeRunbook([{ caminho: 'infra/grafana/alertas/vazio.yaml', conteudo: 'apiVersion: 1\ngroups: []\n' }], runbookDoRepositorio)).toEqual(['infra/grafana/alertas/vazio.yaml: nenhuma regra no arquivo'])
  })

  it('a âncora é a do GitHub para os títulos em português', () => {
    expect(ancoraDoTitulo('Taxa de erro 5xx')).toBe('taxa-de-erro-5xx')
    expect(ancoraDoTitulo('Login recusado pelo semáforo do hash')).toBe('login-recusado-pelo-semáforo-do-hash')
    expect(ancoraDoTitulo('Salvamento de resposta de prova lento ou falhando')).toBe('salvamento-de-resposta-de-prova-lento-ou-falhando')
    expect(ancoraDoTitulo('Rotina do sistema sem rodar (consolidação de uso, expurgo de jobs)')).toBe('rotina-do-sistema-sem-rodar-consolidação-de-uso-expurgo-de-jobs')
  })
})
