import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { raizRepositorio } from '../ci/executar.ts'
import { alcancarPontoDeEntrada, CAMINHO_DA_FERRAMENTA, lerArquivosDeTeste, rodaSoQuandoExecutado, testesQueExecutamAFerramenta, verificarPontoDeEntrada, type ArquivoLido } from './ponto-de-entrada-da-avaliacao.ts'

// O ponto de entrada da avaliação dos modelos não alcança teste, fixture, banco nem `DATABASE_URL`, e nenhum teste o executa (reserva-e-avaliacao, 11.0; RF14; regra 30, item 3).
// Cada fixture é uma árvore pequena, com a ferramenta dentro: a guarda lê a árvore como se fosse o repositório.

const PASTA_DAS_FIXTURES = 'tools/guardas/__fixtures__/ponto-de-entrada-da-avaliacao'
const raizDa = (caso: string): string => join(raizRepositorio, PASTA_DAS_FIXTURES, caso)

describe('o que o ponto de entrada alcança', () => {
  it('a ferramenta que só importa o leitor das amostras passa', () => {
    expect(verificarPontoDeEntrada(raizDa('limpa'))).toEqual([])
  })

  it.each([
    ['import-de-teste', 'tools/ia/ajuda.test.ts', 'teste ou fixture'],
    ['import-de-spec', 'tools/ia/ajuda.spec.ts', 'teste ou fixture'],
    ['import-de-efeito', 'tools/ia/ajuda.test.ts', 'teste ou fixture'],
    ['import-com-require', 'tools/ia/ajuda.test.ts', 'teste ou fixture'],
    ['import-de-fixture-de-teste', 'tools/ia/ajuda.fixture.ts', 'teste ou fixture'],
    ['import-de-pasta-test', 'tools/ia/test/ajuda.ts', 'teste ou fixture'],
    ['import-de-pasta-e2e', 'e2e/ajuda.ts', 'teste ou fixture'],
    ['import-do-golden-com-ponto', 'tools/ia/risco.golden.ts', 'o `golden` do `ouro`'],
    ['import-de-repositories', 'apps/api/src/repositories/aluno.ts', 'banco (`db/` ou repository)'],
    ['import-de-fixture', 'tools/ia/__fixtures__/dados.ts', 'teste ou fixture'],
    ['import-do-golden', 'tools/ia/golden.ts', 'o `golden` do `ouro`'],
    ['import-de-schema', 'packages/core/src/db/schema/escola.ts', 'banco (`db/` ou repository)'],
    ['import-de-repository', 'apps/api/src/aluno/aluno.repository.ts', 'banco (`db/` ou repository)'],
  ])('%s: o import direto de %s quebra', (caso, alvo, motivo) => {
    expect(verificarPontoDeEntrada(raizDa(caso))).toEqual([{ arquivo: alvo, motivo: expect.stringContaining(motivo) }])
  })

  it('o import indireto (a ferramenta importa um arquivo que importa a fixture) quebra, e o import() e o export * from também', () => {
    expect(verificarPontoDeEntrada(raizDa('indireto')).map((violacao) => violacao.arquivo)).toEqual(['tools/ia/__fixtures__/dados.ts'])
    expect(verificarPontoDeEntrada(raizDa('import-dinamico')).map((violacao) => violacao.arquivo)).toEqual(['tools/ia/__fixtures__/dados.ts'])
    expect(verificarPontoDeEntrada(raizDa('reexporta')).map((violacao) => violacao.arquivo)).toEqual(['tools/ia/ajuda.test.ts'])
  })

  it('ler `BANCO_URL` (a variável de verdade) ou `DATABASE_URL` quebra, e o caminho de banco escrito como texto (o import() por variável) também', () => {
    expect(verificarPontoDeEntrada(raizDa('banco-url'))).toEqual([{ arquivo: CAMINHO_DA_FERRAMENTA, motivo: expect.stringContaining('BANCO_URL') }])
    expect(verificarPontoDeEntrada(raizDa('database-url'))).toEqual([{ arquivo: CAMINHO_DA_FERRAMENTA, motivo: expect.stringContaining('DATABASE_URL') }])
    expect(verificarPontoDeEntrada(raizDa('caminho-por-variavel'))).toEqual([{ arquivo: CAMINHO_DA_FERRAMENTA, motivo: expect.stringContaining('caminho de banco') }])
  })

  it.each(['porta-create-pool', 'porta-create-database', 'porta-load-config', 'porta-migrate', 'porta-repository'])('%s: usar a porta de banco do núcleo no texto da ferramenta quebra', (caso) => {
    expect(verificarPontoDeEntrada(raizDa(caso))).toEqual([{ arquivo: CAMINHO_DA_FERRAMENTA, motivo: expect.stringContaining('porta de banco') }])
  })

  it('a porta de banco só é cobrada no texto do ponto de entrada: o nome em outro arquivo não alcança o grafo do banco e não reprova por ele', () => {
    expect(verificarPontoDeEntrada(raizDa('porta-fora-do-ponto-de-entrada'))).toEqual([])
  })

  it('o caminho de `__fixtures__` escrito como texto (o import() por variável) quebra, e o mesmo arquivo alcançado por dois caminhos é acusado uma vez', () => {
    expect(verificarPontoDeEntrada(raizDa('fixture-por-variavel'))).toEqual([{ arquivo: CAMINHO_DA_FERRAMENTA, motivo: expect.stringContaining('`__fixtures__` como texto') }])
    expect(verificarPontoDeEntrada(raizDa('importa-duas-vezes')).map((violacao) => violacao.arquivo)).toEqual(['tools/ia/__fixtures__/dados.ts'])
  })

  it('o que está só em comentário (DATABASE_URL, import de fixture, db/schema) não conta, e o pacote de terceiros não é seguido', () => {
    expect(verificarPontoDeEntrada(raizDa('comentarios'))).toEqual([])
    expect(verificarPontoDeEntrada(raizDa('import-de-pacote'))).toEqual([])
  })

  it('a pasta importada pelo `index.ts` é seguida', () => {
    expect(verificarPontoDeEntrada(raizDa('import-que-existe-como-pasta')).map((violacao) => violacao.arquivo)).toEqual(['tools/ia/__fixtures__/dados.ts'])
  })

  it('o barril do núcleo pelo `dist` (o caminho que `importar` recebe) reprova pelo grafo: alcança `db/` pelo `src`', () => {
    const violacoes = verificarPontoDeEntrada(raizDa('barril-do-dist'))
    expect(violacoes).toEqual([{ arquivo: 'packages/core/src/db/schema/escola.ts', motivo: expect.stringContaining('banco') }])
  })

  it('o barril pelo nome do pacote (`@educa/core`) também reprova, e o subcaminho vai pelo `exports` do `package.json`', () => {
    expect(verificarPontoDeEntrada(raizDa('barril-por-pacote')).map((violacao) => violacao.arquivo)).toEqual(['packages/core/src/db/schema/escola.ts'])
    expect(verificarPontoDeEntrada(raizDa('pacote-subcaminho')).map((violacao) => violacao.arquivo)).toEqual(['packages/core/src/db/schema/escola.ts'])
    expect(verificarPontoDeEntrada(raizDa('pacote-sem-fonte'))).toEqual([{ arquivo: CAMINHO_DA_FERRAMENTA, motivo: expect.stringContaining('@educa/core/sem-fonte não se resolve') }])
    expect(verificarPontoDeEntrada(raizDa('pacote-sem-exports'))).toEqual([{ arquivo: CAMINHO_DA_FERRAMENTA, motivo: expect.stringContaining('@educa/core não se resolve') }])
    // Um `@educa/` que não é pacote do repositório não é seguido.
    expect(verificarPontoDeEntrada(raizDa('pacote-de-fora'))).toEqual([])
  })

  it('o módulo do `dist` que importa `../db/schema/escola.js` reprova (o `.js` vale o `.ts`), e o que só tem `import type` de repository passa', () => {
    expect(verificarPontoDeEntrada(raizDa('modulo-do-dist-que-alcanca-o-banco')).map((violacao) => violacao.arquivo)).toEqual(['packages/core/src/db/schema/escola.ts'])
    expect(verificarPontoDeEntrada(raizDa('modulo-do-dist-limpo'))).toEqual([])
  })

  it('o `import type` de um arquivo de teste some na execução e não entra no grafo', () => {
    expect(verificarPontoDeEntrada(raizDa('import-de-tipo'))).toEqual([])
  })

  it.each(['alias-de-tipo-antes-do-export', 'alias-de-tipo-antes-do-import'])('%s: o `export type X = Y` sem aspas não apaga o import de verdade da linha seguinte, e o arquivo de `db/` é acusado', (caso) => {
    expect(verificarPontoDeEntrada(raizDa(caso)).map((violacao) => violacao.arquivo)).toEqual(['packages/core/src/db/schema/escola.ts'])
  })

  it('o caminho do `dist` sem o `src` que o compila reprova: a guarda não lê o que não acha', () => {
    expect(verificarPontoDeEntrada(raizDa('dist-sem-src'))).toEqual([{ arquivo: CAMINHO_DA_FERRAMENTA, motivo: expect.stringContaining('packages/core/src/ia/nao-existe.ts') }])
  })

  it('o import relativo que não se resolve reprova: a guarda não pode deixar de olhar um arquivo', () => {
    expect(verificarPontoDeEntrada(raizDa('import-que-nao-se-resolve'))).toEqual([{ arquivo: CAMINHO_DA_FERRAMENTA, motivo: expect.stringContaining('não se resolve') }])
  })
})

describe('a guarda não se cala', () => {
  it('sem a ferramenta (o caminho do alvo apagado), a guarda reprova em vez de passar em branco, nas duas conferências', () => {
    const esperado = [{ arquivo: CAMINHO_DA_FERRAMENTA, motivo: expect.stringContaining('não existe') }]
    expect(verificarPontoDeEntrada(raizDa('sem-a-ferramenta'))).toEqual(esperado)
    expect(rodaSoQuandoExecutado(raizDa('sem-a-ferramenta'))).toEqual(esperado)
  })

  it('a ferramenta que chama o `principal` ao ser importada reprova; a que só o chama quando é o arquivo executado, passa', () => {
    expect(rodaSoQuandoExecutado(raizDa('sem-guarda-de-execucao'))).toEqual([{ arquivo: CAMINHO_DA_FERRAMENTA, motivo: expect.stringContaining('roda ao ser importada') }])
    expect(rodaSoQuandoExecutado(raizDa('limpa'))).toEqual([])
  })
})

describe('nenhum teste a executa contra a rede', () => {
  const lido = (nome: string, caminho = 'tools/ia/avaliar-modelos.exec.test.ts'): ArquivoLido => ({ caminho, texto: readFileSync(join(raizRepositorio, PASTA_DAS_FIXTURES, 'testes', nome), 'utf8') })

  it('o teste que abre a ferramenta por `child_process` quebra; o que só importa as funções, o que abre outra coisa e o que só a cita num comentário, passam', () => {
    expect(testesQueExecutamAFerramenta([lido('abre-por-processo.test.ts')])).toEqual([{ arquivo: 'tools/ia/avaliar-modelos.exec.test.ts', motivo: expect.stringContaining('por processo') }])
    expect(testesQueExecutamAFerramenta([lido('so-importa.test.ts'), lido('outro-processo.test.ts'), lido('comentario.test.ts')])).toEqual([])
  })

  it('arquivo que não é de teste não é cobrado: o script que chama a ferramenta é de produção', () => {
    expect(testesQueExecutamAFerramenta([lido('abre-por-processo.test.ts', 'tools/ia/rodar-a-avaliacao.ts')])).toEqual([])
  })
})

describe('a leitura dos testes do repositório', () => {
  it('lê só `.test.ts` e `.spec.ts`: fora node_modules, as fixtures das guardas, o que não é teste e o que não é TypeScript', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'ponto-de-entrada-'))
    try {
      for (const caminho of ['apps/web/a.test.tsx', 'packages/core/src/b.spec.ts', 'tools/ia/c.ts', 'tools/ia/d.test.md', 'apps/web/node_modules/pacote/e.test.ts', 'tools/guardas/__fixtures__/f.test.ts', 'e2e/g.spec.ts', 'apps/web/test/dados.json']) {
        mkdirSync(dirname(join(raiz, caminho)), { recursive: true })
        writeFileSync(join(raiz, caminho), 'export {}\n')
      }
      expect(lerArquivosDeTeste(raiz).map((arquivo) => arquivo.caminho).sort()).toEqual(['apps/web/a.test.tsx', 'e2e/g.spec.ts', 'packages/core/src/b.spec.ts'])
    } finally {
      rmSync(raiz, { recursive: true, force: true })
    }
  })
})

describe('o repositório de verdade', () => {
  it('a ferramenta existe, não alcança teste nem banco, só roda quando executada, e nenhum teste a executa', () => {
    expect(verificarPontoDeEntrada(raizRepositorio)).toEqual([])
    expect(rodaSoQuandoExecutado(raizRepositorio)).toEqual([])
    const testes = lerArquivosDeTeste(raizRepositorio)
    // A lista vazia não é "nada a cobrar": é a leitura que não achou os testes.
    expect(testes.length).toBeGreaterThan(100)
    expect(testesQueExecutamAFerramenta(testes)).toEqual([])
  })

  it('a guarda vê o grafo do `src` do núcleo e do `shared`, e não só o de `tools/`: os seis módulos do `dist` e nada de `db/`', () => {
    const { arquivos } = alcancarPontoDeEntrada(raizRepositorio)
    for (const modulo of ['ia/llm-gateway', 'ia/consumo', 'ia/suspensao', 'ia/tasks/index', 'context/context', 'ia/openai-compat-adapter']) expect(arquivos).toContain(`packages/core/src/${modulo}.ts`)
    expect(arquivos).toContain('packages/shared/src/index.ts')
    expect(arquivos.filter((arquivo) => /(?:^|\/)db\/|\.repository\.|\/repositories?\//u.test(arquivo))).toEqual([])
    expect(arquivos).not.toContain('packages/core/src/index.ts')
  })

  it('o script `avaliar-modelos` do package.json aponta para a ferramenta', () => {
    const scripts = (JSON.parse(readFileSync(join(raizRepositorio, 'package.json'), 'utf8')) as { scripts: Record<string, string> }).scripts
    expect(scripts['avaliar-modelos']).toContain(CAMINHO_DA_FERRAMENTA)
  })
})
