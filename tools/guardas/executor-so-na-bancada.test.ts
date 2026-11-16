import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { raizRepositorio } from '../ci/executar.ts'
import { ALVOS_DA_BANCADA, alvosQueSumiram, CAMINHO_DA_BANCADA, lerArquivosDeTeste, MODULOS_DA_BANCADA, verificarExecutorNaBancada, type ArquivoLido } from './executor-so-na-bancada.ts'

// O provedor, o processador e o worker de IA só se montam na bancada (reengenharia-continuacao, 5.0).

const PASTA_DAS_FIXTURES = 'tools/guardas/__fixtures__/executor-na-bancada'

/** Uma fixture lida como se fosse um arquivo de teste do caminho dado: o que se prova é o que o texto dela faz. */
function fixtureComo(nome: string, caminho: string): ArquivoLido {
  return { caminho, texto: lerFixture(nome) }
}

function lerFixture(nome: string): string {
  return readFileSync(join(raizRepositorio, PASTA_DAS_FIXTURES, nome), 'utf8')
}

const DE_TESTE = 'apps/api/src/ia/uma-suite.int.test.ts'

describe('quem contorna a bancada', () => {
  it.each([
    ['override-provider.int.test.ts', 'LLM_PROVIDER'],
    ['use-value.int.test.ts', 'LLM_PROVIDER'],
    ['reexporta.ts', 'ExecucaoProcessor'],
    ['import-dinamico.int.test.ts', 'worker-de-ia'],
    ['importa-do-mesmo-lugar.int.test.ts', 'execucao.processor'],
    ['token-como-texto.int.test.ts', 'LLM_PROVIDER'],
    ['executor-antigo.int.test.ts', 'InProcessAgenteExecutor'],
  ])('%s reprova pelo alvo %s', (nome, alvo) => {
    const violacoes = verificarExecutorNaBancada([fixtureComo(nome, DE_TESTE)])
    expect(violacoes.map((violacao) => violacao.alvo)).toContain(alvo)
  })

  it('a suíte que só usa a bancada passa, e o nome só no comentário não conta', () => {
    expect(verificarExecutorNaBancada([fixtureComo('limpa.int.test.ts', DE_TESTE), fixtureComo('so-no-comentario.int.test.ts', DE_TESTE)])).toEqual([])
  })

  it('a bancada é o único arquivo que pode ter os alvos, e arquivo de produção não é cobrado', () => {
    expect(verificarExecutorNaBancada([fixtureComo('override-provider.int.test.ts', CAMINHO_DA_BANCADA)])).toEqual([])
    expect(verificarExecutorNaBancada([fixtureComo('override-provider.int.test.ts', 'apps/api/src/ia/ia-do-worker.module.ts')])).toEqual([])
  })

  it('um arquivo `.fixture.ts` conta como teste, em qualquer pasta, e o de produção com nome parecido, não', () => {
    expect(verificarExecutorNaBancada([fixtureComo('reexporta.ts', 'apps/api/src/ia/outra.fixture.ts')]).map((violacao) => violacao.alvo)).toContain('ExecucaoProcessor')
    expect(verificarExecutorNaBancada([fixtureComo('reexporta.ts', 'apps/api/src/ia/fixture.ts')])).toEqual([])
  })

  it('um arquivo de pasta `test/` conta como teste, mesmo sem o sufixo', () => {
    expect(verificarExecutorNaBancada([fixtureComo('reexporta.ts', 'apps/api/test/auxiliar.ts')]).map((violacao) => violacao.alvo)).toContain('ExecucaoProcessor')
  })
})

describe('o alvo some', () => {
  function raizCom(arquivos: Record<string, string>): string {
    const raiz = mkdtempSync(join(tmpdir(), 'executor-na-bancada-'))
    for (const [caminho, texto] of Object.entries(arquivos)) {
      mkdirSync(dirname(join(raiz, caminho)), { recursive: true })
      writeFileSync(join(raiz, caminho), texto)
    }
    return raiz
  }
  const completos = (): Record<string, string> => ({
    [CAMINHO_DA_BANCADA]: '',
    ...Object.fromEntries(MODULOS_DA_BANCADA.map((modulo) => [`apps/api/src/ia/${modulo}.ts`, ''])),
    ...Object.fromEntries(ALVOS_DA_BANCADA.filter((alvo) => alvo.definidoEm !== '').map((alvo) => [alvo.definidoEm, `export const ${alvo.nome} = 1`])),
  })

  it('com tudo no lugar, nada sumiu; sem a bancada, ou com o token renomeado na fonte, a guarda reprova em vez de passar em branco', () => {
    const raiz = raizCom(completos())
    try {
      expect(alvosQueSumiram(raiz)).toEqual([])
      const { [CAMINHO_DA_BANCADA]: _bancada, ...semBancada } = completos()
      const raizSemBancada = raizCom(semBancada)
      expect(alvosQueSumiram(raizSemBancada)).toEqual([CAMINHO_DA_BANCADA])
      rmSync(raizSemBancada, { recursive: true })
      const renomeado = raizCom({ ...completos(), 'apps/api/src/ia/ia.module.ts': 'export const PROVEDOR_DE_LLM = 1' })
      expect(alvosQueSumiram(renomeado)).toEqual(['LLM_PROVIDER em apps/api/src/ia/ia.module.ts'])
      rmSync(renomeado, { recursive: true })
    } finally {
      rmSync(raiz, { recursive: true })
    }
  })

  it('o arquivo que define o alvo, ou o módulo da bancada, apagado: a guarda reprova nomeando os dois, e não lança', () => {
    const { 'apps/api/src/ia/execucao.processor.ts': _processador, ...semProcessador } = completos()
    const raiz = raizCom(semProcessador)
    try {
      expect(alvosQueSumiram(raiz)).toEqual(['ExecucaoProcessor em apps/api/src/ia/execucao.processor.ts', 'execucao.processor'])
    } finally {
      rmSync(raiz, { recursive: true })
    }
  })
})

describe('o repositório de verdade', () => {
  it('nenhum teste, fora a bancada, monta o provedor, o processador ou o worker de IA', () => {
    const arquivos = lerArquivosDeTeste(raizRepositorio)
    // A lista vazia não é "nada a cobrar": é a leitura que não achou os testes.
    expect(arquivos.length).toBeGreaterThan(100)
    expect(verificarExecutorNaBancada(arquivos)).toEqual([])
  })

  it('a bancada e os alvos estão onde a guarda espera', () => {
    expect(alvosQueSumiram(raizRepositorio)).toEqual([])
  })
})
