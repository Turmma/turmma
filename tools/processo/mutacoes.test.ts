import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { VARIAVEL_DO_RELATORIO_DO_E2E } from '../ci/duracao-do-e2e.ts'
import {
  aplicarMutacao,
  casoFalhouNoRelatorio,
  avaliarMutacoes,
  comandoDoTeste,
  condicoesDaLinha,
  conferirMutacoes,
  conferirMutacoesDoDocumento,
  documentoDaTarefa,
  ehArquivoDeProducao,
  ehArquivoDoFaltando,
  exigenciaDeMutacao,
  impressaoDasMutacoes,
  lerMutacoes,
  linhasAcrescentadas,
  linhasNovasDaArvore,
  linhasSemBloco,
  MARCA_DO_SUPERVISOR,
  pedeReconstrucao,
  prazoDaMutada,
  prepararRelatorio,
  PROJETOS_DO_E2E,
  reconstruirDepoisDasMutacoes,
  relatorioDoFaltando,
  rodarCalado,
  SAIDA_DO_PRAZO,
  semMutacaoDeclarada,
  sinalAoGrupo,
  testTimeoutDaMutacao,
  testTimeoutDoCaso,
  testTimeoutDoProjeto,
  tipoDoTeste,
  type LinhaNova,
  type Mutacao,
  type Rodar,
} from './mutacoes.ts'

const CERCA = '```'

function bloco(...linhas: string[]): string {
  return [`${CERCA}mutacao`, ...linhas, CERCA].join('\n')
}

const REPOSITORIO = `export function acharPedido(escolaId: string, id: string) {
  return db
    .select()
    .from(pedidos)
    .where(and(
      eq(pedidos.escolaId, escolaId),
      eq(pedidos.id, id),
    ))
}

export function listarPedidos(escolaId: string) {
  return db.select().from(pedidos).where(and(
      eq(pedidos.escolaId, escolaId),
  ))
}
`

const DOCUMENTO = `# Tarefa 3.0

## Mutações

A cláusula de escopo de cada consulta.

${bloco(
  'arquivo: apps/api/src/pedidos.repository.ts',
  'teste: apps/api/test/pedidos.int.test.ts › a coordenação de outra escola não acha o pedido',
  '-   eq(pedidos.escolaId, escolaId),',
  '    eq(pedidos.id, id),',
)}

${bloco('arquivo: apps/web/src/Pedidos.tsx', 'teste: apps/web/src/Pedidos.test.tsx', '- if (pedidos.length === 0)', '+ if (false)')}

## Revisões
`

function mutacao(parcial: Partial<Mutacao> = {}): Mutacao {
  return { arquivo: 'apps/api/src/pedidos.repository.ts', teste: 'apps/api/test/pedidos.int.test.ts', caso: null, antes: ['eq(pedidos.escolaId, escolaId),', 'eq(pedidos.id, id),'], depois: ['eq(pedidos.id, id),'], ...parcial }
}

describe('ler os blocos de mutação do documento', () => {
  it('tira de cada bloco o arquivo, o teste com o caso, o trecho de hoje e o que fica; contexto entra nos dois lados', () => {
    const { mutacoes, erros } = lerMutacoes(DOCUMENTO)
    expect(erros).toEqual([])
    expect(mutacoes).toEqual([
      {
        arquivo: 'apps/api/src/pedidos.repository.ts',
        teste: 'apps/api/test/pedidos.int.test.ts',
        caso: 'a coordenação de outra escola não acha o pedido',
        antes: ['eq(pedidos.escolaId, escolaId),', 'eq(pedidos.id, id),'],
        depois: ['eq(pedidos.id, id),'],
      },
      { arquivo: 'apps/web/src/Pedidos.tsx', teste: 'apps/web/src/Pedidos.test.tsx', caso: null, antes: ['if (pedidos.length === 0)'], depois: ['if (false)'] },
    ])
  })

  it('bloco que não dá para conferir vira erro com o número dele, e não some', () => {
    const { mutacoes, erros } = lerMutacoes(
      [
        bloco('teste: a.test.ts', '- x'),
        bloco('arquivo: a.ts', '- x'),
        bloco('arquivo: a.ts', 'teste: a.test.ts', '  só contexto'),
        bloco('arquivo: a.ts', 'teste: a.test.ts', 'linha sem marca'),
        bloco('arquivo: a.ts', 'teste: a.test.ts', '- igual', '+ igual'),
        bloco('arquivo: a.ts', 'teste: a.test.ts', '- some'),
      ].join('\n\n'),
    )
    expect(mutacoes).toHaveLength(1)
    expect(erros).toEqual([
      'mutação 1: falta a linha "arquivo:"',
      'mutação 2: falta a linha "teste:"',
      'mutação 3: nenhuma linha começa com "-": a mutação precisa tirar ou trocar um trecho que existe',
      'mutação 4: linha "linha sem marca" não começa com "-", "+" nem espaço',
      'mutação 5: o que entra é igual ao que sai',
    ])
  })

  it('documento sem bloco não tem mutação nem erro', () => {
    expect(lerMutacoes('## Mutações\n\n`a.ts` › função › cláusula → teste vermelho\n')).toEqual({ mutacoes: [], erros: [] })
  })
})

describe('aplicar a mutação ao arquivo', () => {
  it('tira a linha marcada e mantém o contexto, sem depender do recuo', () => {
    const resultado = aplicarMutacao(REPOSITORIO, mutacao())
    expect('mutado' in resultado && resultado.mutado).toBe(REPOSITORIO.replace('      eq(pedidos.escolaId, escolaId),\n      eq(pedidos.id, id),', '      eq(pedidos.id, id),'))
  })

  it('troca o trecho pelo que entra, no recuo do que saiu', () => {
    const resultado = aplicarMutacao('function f() {\n  if (a && b) {\n    return 1\n  }\n}\n', mutacao({ antes: ['if (a && b) {'], depois: ['if (a) {'] }))
    expect('mutado' in resultado && resultado.mutado).toBe('function f() {\n  if (a) {\n    return 1\n  }\n}\n')
  })

  it('recusa o trecho que não está mais no arquivo: a linha ficou velha', () => {
    const resultado = aplicarMutacao(REPOSITORIO, mutacao({ antes: ['eq(pedidos.turmaId, turmaId),'], depois: [] }))
    expect('recusa' in resultado && resultado.recusa).toMatch(/o trecho não está em apps\/api\/src\/pedidos\.repository\.ts/)
  })

  it('recusa o trecho que aparece duas vezes, e o contexto é o que desempata', () => {
    const ambigua = aplicarMutacao(REPOSITORIO, mutacao({ antes: ['eq(pedidos.escolaId, escolaId),'], depois: [] }))
    expect('recusa' in ambigua && ambigua.recusa).toMatch(/aparece 2 vezes.*linhas de contexto/)
    expect('mutado' in aplicarMutacao(REPOSITORIO, mutacao())).toBe(true)
  })
})

describe('o comando que roda o teste de uma mutação', () => {
  it('escolhe o projeto pelo caminho do teste', () => {
    expect(tipoDoTeste('apps/api/src/x.test.ts')).toBe('unidade')
    expect(tipoDoTeste('apps/web/src/Tela.test.tsx')).toBe('unidade')
    expect(tipoDoTeste('apps/api/test/x.int.test.ts')).toBe('integracao')
    expect(tipoDoTeste('infra/test/metricas.int.test.ts')).toBe('infra')
    // O teste do git hook roda contra um git de verdade, sem compose: projeto próprio, e o resto de `tools/` fica na integração.
    expect(tipoDoTeste('tools/processo/hook-git.int.test.ts')).toBe('processo')
    expect(tipoDoTeste('tools/guardas/gitleaks.int.test.ts')).toBe('integracao')
    expect(tipoDoTeste('e2e/areas.spec.ts')).toBe('e2e')
    expect(tipoDoTeste('docs/lgpd.md')).toBeNull()
  })

  it('unidade e integração rodam o arquivo no projeto dele, com o caso quando há', () => {
    expect(comandoDoTeste(mutacao({ caso: 'outra escola' }))).toEqual(['npx', 'vitest', 'run', '--project', 'integracao', 'apps/api/test/pedidos.int.test.ts', '-t', 'outra escola'])
    expect(comandoDoTeste(mutacao({ teste: 'apps/web/src/Tela.test.tsx' }))).toEqual(['npx', 'vitest', 'run', '--project', 'unidade', 'apps/web/src/Tela.test.tsx'])
    expect(comandoDoTeste(mutacao({ teste: 'tools/processo/hook-git.int.test.ts', caso: 'o PATH sem node' }))).toEqual(['npx', 'vitest', 'run', '--project', 'processo', 'tools/processo/hook-git.int.test.ts', '-t', 'o PATH sem node'])
    expect(comandoDoTeste(mutacao({ teste: 'README.md' }))).toBeNull()
  })

  it('mutação de fonte provada por e2e reconstrói a web; a de fixture do próprio e2e, não; e roda um projeto só', () => {
    const deTela = mutacao({ arquivo: 'apps/web/src/Tela.tsx', teste: 'e2e/areas.spec.ts', caso: 'o aluno acha' })
    expect(pedeReconstrucao(deTela)).toBe(true)
    expect(comandoDoTeste(deTela)).toEqual(['node', 'tools/ci/e2e.ts', '--manter-ambiente', 'e2e/areas.spec.ts', '--grep=o aluno acha', '--project=chromebook'])
    const deFixture = mutacao({ arquivo: 'e2e/__fixtures__/sessao.ts', teste: 'e2e/areas.spec.ts' })
    expect(pedeReconstrucao(deFixture)).toBe(false)
    expect(comandoDoTeste(deFixture)).toEqual(['npx', 'playwright', 'test', 'e2e/areas.spec.ts', '--project=chromebook'])
  })

  it('o projeto do e2e vem do bloco; sem a linha "projeto:", é o chromebook', () => {
    const escrito = (...cabecalho: string[]) =>
      lerMutacoes(bloco('arquivo: apps/web/src/Tela.tsx', 'teste: e2e/areas.spec.ts › o aluno acha', ...cabecalho, '- <Menu />', '+ <Nada />'))
    const doCelular = escrito('projeto: celular')
    expect(doCelular.erros).toEqual([])
    expect(doCelular.mutacoes[0]?.projeto).toBe('celular')
    expect(comandoDoTeste(doCelular.mutacoes[0] as Mutacao)).toEqual(['node', 'tools/ci/e2e.ts', '--manter-ambiente', 'e2e/areas.spec.ts', '--grep=o aluno acha', '--project=celular'])
    const semLinha = escrito()
    expect(semLinha.mutacoes[0]).not.toHaveProperty('projeto')
    expect(comandoDoTeste(semLinha.mutacoes[0] as Mutacao)).toContain('--project=chromebook')
    // Sem reconstrução (fixture do próprio e2e), o projeto também é o do bloco.
    expect(comandoDoTeste(mutacao({ arquivo: 'e2e/__fixtures__/sessao.ts', teste: 'e2e/areas.spec.ts', projeto: 'celular' }))).toEqual(['npx', 'playwright', 'test', 'e2e/areas.spec.ts', '--project=celular'])
  })

  it('a linha "projeto:" só vale em e2e e só com um projeto que o Playwright tem; o resto é erro do bloco', () => {
    const { mutacoes, erros } = lerMutacoes(
      [
        bloco('arquivo: a.ts', 'teste: e2e/a.spec.ts', 'projeto: tablet', '- x'),
        bloco('arquivo: a.ts', 'teste: apps/api/test/a.int.test.ts', 'projeto: celular', '- x'),
        bloco('arquivo: a.ts', 'teste: e2e/a.spec.ts', 'projeto: chromebook', '- x'),
        bloco('teste: e2e/a.spec.ts', 'projeto: tablet', '- x'),
      ].join('\n\n'),
    )
    // O primeiro erro do bloco é o que vale: projeto inválido não esconde a linha que falta.
    expect(erros).toEqual(['mutação 1: projeto "tablet" não existe (chromebook ou celular)', 'mutação 2: "projeto:" só vale para teste de e2e', 'mutação 4: falta a linha "arquivo:"'])
    expect(mutacoes.map((m) => m.projeto)).toEqual(['chromebook'])
  })

  it('os projetos que o bloco aceita são os do playwright.config.ts', () => {
    const configuracao = readFileSync(join(import.meta.dirname, '../../playwright.config.ts'), 'utf8')
    const projetos = [...configuracao.matchAll(/^\s*name: '([a-z]+)',/gm)].map((achado) => achado[1])
    expect([...PROJETOS_DO_E2E]).toEqual(projetos)
  })

  it('a mesma mutação em dois projetos tem cada uma a sua corrida limpa e a sua corrida mutada', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'mutacoes-projeto-'))
    for (const [arquivo, conteudo] of Object.entries({ 'e2e/__fixtures__/sessao.ts': 'const menu = 1\n', 'e2e/areas.spec.ts': '// teste\n' })) {
      mkdirSync(dirname(join(raiz, arquivo)), { recursive: true })
      writeFileSync(join(raiz, arquivo), conteudo)
    }
    const base = { arquivo: 'e2e/__fixtures__/sessao.ts', teste: 'e2e/areas.spec.ts', antes: ['const menu = 1'], depois: ['const menu = 0'] }
    const corridas: string[] = []
    const avisos: string[] = []
    const resultados = conferirMutacoes(raiz, [mutacao({ ...base, projeto: 'celular' }), mutacao({ ...base, projeto: 'chromebook' })], (comando) => {
      const mutado = readFileSync(join(raiz, base.arquivo), 'utf8').includes('menu = 0')
      corridas.push(`${comando.at(-1) ?? ''}${mutado ? ' mutado' : ''}`)
      // A cláusula só importa no celular: lá o teste cai com ela fora, no computador continua verde.
      return !(mutado && comando.at(-1) === '--project=celular')
    }, (texto) => avisos.push(texto))
    expect(corridas).toEqual(['--project=celular', '--project=celular mutado', '--project=chromebook', '--project=chromebook mutado'])
    expect(resultados.map((resultado) => resultado.veredito)).toEqual(['vermelho', 'verde'])
    // O rótulo diz o projeto: as duas linhas não saem iguais, e dá para saber qual reprovou.
    expect(avisos[0]).toMatch(/^✓ .*\[celular\]: vermelho/)
    expect(avisos[1]).toMatch(/^✗ .*\[chromebook\]: o teste continuou verde/)
  })
})

describe('conferir as mutações: o teste tem de cair sem a cláusula, e o arquivo volta ao que era', () => {
  function arvore(): string {
    const raiz = mkdtempSync(join(tmpdir(), 'mutacoes-'))
    for (const [arquivo, conteudo] of Object.entries({ 'apps/api/src/pedidos.repository.ts': REPOSITORIO, 'apps/api/test/pedidos.int.test.ts': '// teste\n' })) {
      mkdirSync(dirname(join(raiz, arquivo)), { recursive: true })
      writeFileSync(join(raiz, arquivo), conteudo)
    }
    return raiz
  }
  const fonte = (raiz: string) => readFileSync(join(raiz, 'apps/api/src/pedidos.repository.ts'), 'utf8')

  it('vermelho com a cláusula fora é o que passa, e o teste vê o arquivo mutado', () => {
    const raiz = arvore()
    const vistos: boolean[] = []
    const resultados = conferirMutacoes(raiz, [mutacao()], () => {
      const mutado = !fonte(raiz).includes('.where(and(\n      eq(pedidos.escolaId, escolaId),\n      eq(pedidos.id, id),')
      vistos.push(mutado)
      return !mutado
    })
    expect(resultados.map((resultado) => resultado.veredito)).toEqual(['vermelho'])
    // Uma corrida limpa antes, uma mutada depois.
    expect(vistos).toEqual([false, true])
    expect(fonte(raiz)).toBe(REPOSITORIO)
  })

  it('teste que continua verde sem a cláusula reprova: falta o teste que a prove', () => {
    const raiz = arvore()
    const avisos: string[] = []
    const resultados = conferirMutacoes(raiz, [mutacao()], () => true, (texto) => avisos.push(texto))
    expect(resultados[0]).toMatchObject({ veredito: 'verde' })
    expect(avisos.join('')).toContain('continuou verde sem a cláusula')
    expect(fonte(raiz)).toBe(REPOSITORIO)
  })

  it('teste que já não passa limpo é recusado sem mutar nada: vermelho de antes não prova cláusula nenhuma', () => {
    const raiz = arvore()
    let corridas = 0
    const resultados = conferirMutacoes(raiz, [mutacao(), mutacao({ caso: null })], () => {
      corridas += 1
      return false
    })
    expect(resultados.map((resultado) => resultado.veredito)).toEqual(['recusada', 'recusada'])
    expect(resultados[0]?.motivo).toMatch(/não passa sem a mutação/)
    // A corrida limpa do mesmo teste e caso vale para as duas mutações.
    expect(corridas).toBe(1)
  })

  it('recusa arquivo e teste que não existem, e trecho que não está mais lá, sem rodar teste', () => {
    const raiz = arvore()
    let corridas = 0
    const resultados = conferirMutacoes(
      raiz,
      [mutacao({ arquivo: 'apps/api/src/nao-existe.ts' }), mutacao({ teste: 'apps/api/test/nao-existe.int.test.ts' }), mutacao({ antes: ['eq(pedidos.turmaId, turmaId),'], depois: [] })],
      () => {
        corridas += 1
        return true
      },
    )
    expect(resultados.map((resultado) => resultado.veredito)).toEqual(['recusada', 'recusada', 'recusada'])
    expect(corridas).toBe(0)
  })

  it('vermelho por erro de carga (sintaxe, módulo que não carrega, nenhum caso rodou) é recusado com o motivo, e o arquivo volta', () => {
    const raiz = arvore()
    const avisos: string[] = []
    let corridas = 0
    const resultados = conferirMutacoes(
      raiz,
      [mutacao()],
      () => {
        corridas += 1
        return corridas === 1 ? true : 'carga'
      },
      (texto) => avisos.push(texto),
    )
    expect(resultados.map((resultado) => resultado.veredito)).toEqual(['recusada'])
    expect(resultados[0]?.motivo).toMatch(/erro de carga/)
    expect(resultados[0]?.motivo).toMatch(/nenhum caso/)
    // O motivo não diz só "sintaxe": preparo que lançou e ambiente que não subiu caem aqui também.
    expect(resultados[0]?.motivo).toMatch(/preparo/)
    expect(resultados[0]?.motivo).toMatch(/ambiente/)
    expect(avisos.join('')).toMatch(/^✗ .*erro de carga/)
    expect(avisos.join('')).not.toContain('✓')
    expect(fonte(raiz)).toBe(REPOSITORIO)
  })

  it('o erro de carga na corrida limpa não é a mutação provada nem o teste verde: é o teste que não passa', () => {
    const raiz = arvore()
    const resultados = conferirMutacoes(raiz, [mutacao()], () => 'carga')
    expect(resultados.map((resultado) => resultado.veredito)).toEqual(['recusada'])
    expect(resultados[0]?.motivo).toMatch(/não passa sem a mutação/)
  })

  it('restaura o arquivo mesmo quando a corrida do teste estoura', () => {
    const raiz = arvore()
    let corridas = 0
    expect(() =>
      conferirMutacoes(raiz, [mutacao()], () => {
        corridas += 1
        if (corridas === 2) throw new Error('o processo do teste morreu')
        return true
      }),
    ).toThrow(/morreu/)
    expect(fonte(raiz)).toBe(REPOSITORIO)
  })
})

describe('o carimbo vale para as mutações como estão escritas agora', () => {
  const documento = 'tasks/prd-x/3_task.md'
  const { mutacoes } = lerMutacoes(DOCUMENTO)
  const carimbo = { mutacoes: { documento, impressao: impressaoDasMutacoes(mutacoes), total: mutacoes.length } }

  it('conferidas pelo último portão, passa; e mexer no texto em volta dos blocos não invalida', () => {
    expect(avaliarMutacoes(carimbo, documento, DOCUMENTO, [])).toBeNull()
    expect(avaliarMutacoes(carimbo, documento, DOCUMENTO.replace('A cláusula de escopo de cada consulta.', 'Outra frase.'), [])).toBeNull()
  })

  it('bloco novo, trecho trocado ou teste trocado depois do portão bloqueia, com o comando a rodar', () => {
    const comOutroTrecho = DOCUMENTO.replace('- if (pedidos.length === 0)', '- if (pedidos.length < 1)')
    const comOutroTeste = DOCUMENTO.replace('teste: apps/web/src/Pedidos.test.tsx', 'teste: apps/web/src/Outro.test.tsx')
    const comMaisUm = `${DOCUMENTO}\n${bloco('arquivo: a.ts', 'teste: a.test.ts', '- x')}\n`
    for (const conteudo of [comOutroTrecho, comOutroTeste, comMaisUm]) {
      expect(avaliarMutacoes(carimbo, documento, conteudo, [])).toMatch(/mudou depois do último portão\. Rode `node tools\/processo\/portao-local\.ts --tarefa tasks\/prd-x\/3_task\.md` de novo/)
    }
  })

  it('portão que não conferiu este documento, ou não conferiu mutação nenhuma, bloqueia', () => {
    expect(avaliarMutacoes(null, documento, DOCUMENTO, [])).toMatch(/as 2 mutações de tasks\/prd-x\/3_task\.md não foram conferidas/)
    expect(avaliarMutacoes({}, documento, DOCUMENTO, [])).toMatch(/não foram conferidas/)
    expect(avaliarMutacoes({ mutacoes: { ...carimbo.mutacoes, documento: 'tasks/prd-x/4_task.md' } }, documento, DOCUMENTO, [])).toMatch(/não foram conferidas/)
  })

  it('bloco malformado bloqueia mesmo com carimbo, e documento sem bloco não é cobrado', () => {
    expect(avaliarMutacoes(carimbo, documento, `${DOCUMENTO}\n${bloco('arquivo: a.ts', '- x')}\n`, [])).toMatch(/mutação 3: falta a linha "teste:"/)
    expect(avaliarMutacoes(null, documento, '## Mutações\n\nnenhuma cláusula nova\n', [])).toBeNull()
  })
})


describe('produção alterada sem mutação não recebe carimbo (RF17)', () => {
  const documento = 'tasks/prd-x/3_task.md'
  const producao = ['apps/api/src/pedidos.repository.ts']
  const SEM_NADA = '# Tarefa 3.0\n\n## Mutações\n\nNenhuma cláusula nova.\n'
  const comLinha = (motivo: string) => `${SEM_NADA}\n**Sem mutação:** ${motivo}\n`
  const comBloco = `${SEM_NADA}\n${bloco('arquivo: apps/api/src/pedidos.repository.ts', 'teste: apps/api/test/pedidos.int.test.ts', '- x', '+ y')}\n`

  it.each([
    { nome: 'de apps', arquivo: 'apps/api/src/pedidos.repository.ts', producao: true },
    { nome: 'de packages', arquivo: 'packages/core/src/ia/port.ts', producao: true },
    { nome: 'de tela', arquivo: 'apps/web/src/areas/Tela.tsx', producao: true },
    { nome: 'teste de unidade em src', arquivo: 'apps/api/src/pedidos.test.ts', producao: false },
    { nome: 'teste de integração em src', arquivo: 'packages/core/src/retencao/retencao.int.test.ts', producao: false },
    { nome: 'teste de tela em src', arquivo: 'apps/web/src/Tela.test.tsx', producao: false },
    { nome: 'spec em src', arquivo: 'apps/web/src/Tela.spec.ts', producao: false },
    { nome: 'fixture em src', arquivo: 'apps/web/src/__fixtures__/tela.tsx', producao: false },
    { nome: 'pasta test de src', arquivo: 'apps/api/src/test/ajuda.ts', producao: false },
    { nome: 'declaração de tipos', arquivo: 'apps/web/src/vite-env.d.ts', producao: false },
    { nome: 'configuração fora de src', arquivo: 'apps/web/vite.config.ts', producao: false },
    { nome: 'teste fora de src', arquivo: 'apps/api/test/pedidos.int.test.ts', producao: false },
    { nome: 'e2e', arquivo: 'e2e/areas.spec.ts', producao: false },
    { nome: 'processo', arquivo: 'tools/processo/mutacoes.ts', producao: false },
  ])('o arquivo $nome é produção ou não', ({ arquivo, producao }) => {
    expect(ehArquivoDeProducao(arquivo)).toBe(producao)
  })

  it('a linha "Sem mutação" vale com motivo, e vazia ou só com o <motivo> do modelo não vale', () => {
    expect(semMutacaoDeclarada(comLinha('só o tipo do retorno mudou'))).toBe('motivo')
    expect(semMutacaoDeclarada(comLinha(''))).toBe('vazia')
    expect(semMutacaoDeclarada(comLinha('<motivo>'))).toBe('vazia')
    expect(semMutacaoDeclarada(SEM_NADA)).toBe('ausente')
    // Uma linha vazia e outra com motivo: vale a que tem motivo.
    expect(semMutacaoDeclarada(`${comLinha('')}\n**Sem mutação:** renomeia um tipo\n`)).toBe('motivo')
    // A regra citada no meio de uma frase não é a linha: sem a âncora do começo, todo documento que a repete no Objetivo se liberaria.
    expect(semMutacaoDeclarada('Sem bloco nem a linha `**Sem mutação:** <motivo>`, e o hook recusa.\n')).toBe('ausente')
    // Aceito: a linha dentro de um bloco cercado (um exemplo copiado para o documento) conta como a linha.
    expect(semMutacaoDeclarada('```\n**Sem mutação:** só um exemplo\n```\n')).toBe('motivo')
  })

  it('produção alterada: sem bloco nem linha, vermelho; linha vazia, vermelho; com motivo ou com bloco, verde', () => {
    expect(exigenciaDeMutacao(producao, SEM_NADA)).toMatch(/altera código de produto \(apps\/api\/src\/pedidos\.repository\.ts\).*não há bloco de mutação nem a linha "\*\*Sem mutação:\*\* <motivo>"/)
    expect(exigenciaDeMutacao(producao, comLinha(''))).toMatch(/a linha "\*\*Sem mutação:\*\*" está sem motivo/)
    expect(exigenciaDeMutacao(producao, comLinha('só o tipo do retorno mudou'))).toBeNull()
    expect(exigenciaDeMutacao(producao, comBloco)).toBeNull()
  })

  it('só teste, .d.ts, configuração fora de src ou documento: não exige', () => {
    const semProducao = ['apps/api/test/pedidos.int.test.ts', 'apps/web/src/vite-env.d.ts', 'apps/web/vite.config.ts', 'e2e/areas.spec.ts', 'tasks/prd-x/3_task.md']
    expect(exigenciaDeMutacao(semProducao, SEM_NADA)).toBeNull()
    expect(exigenciaDeMutacao([], null)).toBeNull()
  })

  it('a lista de arquivos cita os três primeiros e conta o resto', () => {
    const muitos = ['a', 'b', 'c', 'd'].map((nome) => `apps/api/src/${nome}.ts`)
    expect(exigenciaDeMutacao(muitos, SEM_NADA)).toContain('(apps/api/src/a.ts, apps/api/src/b.ts, apps/api/src/c.ts, …)')
    expect(exigenciaDeMutacao(muitos.slice(0, 3), SEM_NADA)).toContain('(apps/api/src/a.ts, apps/api/src/b.ts, apps/api/src/c.ts)')
  })

  it('sem o documento achado, a produção alterada fica vermelha pedindo o documento', () => {
    expect(exigenciaDeMutacao(producao, null)).toMatch(/não achei o documento da tarefa.*portao-local\.ts --tarefa <documento>/)
  })

  it('o documento é achado pela alteração, e não por ter bloco', () => {
    // A tarefa de produção sem bloco é o único documento alterado: é ele, e não um documento que tem bloco e não foi alterado.
    expect(documentoDaTarefa([documento, 'apps/api/src/x.ts', 'tasks/prd-x/tasks.md'])).toBe(documento)
    expect(documentoDaTarefa(['tasks/correcoes/2026-10-23-x.md'])).toBe('tasks/correcoes/2026-10-23-x.md')
    // Dois alterados: sem pedido, não se escolhe; quem roda diz qual. Nenhum alterado: nenhum.
    expect(documentoDaTarefa([documento, 'tasks/prd-x/4_task.md'])).toBeNull()
    expect(documentoDaTarefa(['tasks/prd-x/tasks.md', 'apps/api/src/x.ts'])).toBeNull()
  })

  it('o commit: produção sem bloco nem linha é recusada; com a linha passa só com o carimbo deste documento', () => {
    const doPortao = { documento }
    expect(avaliarMutacoes(doPortao, documento, SEM_NADA, producao)).toMatch(/^portão local: a árvore altera código de produto/)
    expect(avaliarMutacoes(doPortao, documento, comLinha(''), producao)).toMatch(/sem motivo/)
    expect(avaliarMutacoes(doPortao, documento, comLinha('só o tipo mudou'), producao)).toBeNull()
    // Carimbo do portão de outra tarefa, sem carimbo, ou de um portão que não achou documento: recusado.
    const comando = `\`node tools/processo/portao-local.ts --tarefa ${documento}\``
    expect(avaliarMutacoes({ ...doPortao, documento: 'tasks/prd-x/4_task.md' }, documento, comLinha('só o tipo mudou'), producao)).toBe(
      `portão local: o último portão não foi o de ${documento}: a linha "Sem mutação:" só vale com o portão deste documento. Rode ${comando}.`,
    )
    expect(avaliarMutacoes(null, documento, comLinha('só o tipo mudou'), producao)).toMatch(/o último portão não foi o de/)
    expect(avaliarMutacoes({}, documento, comLinha('só o tipo mudou'), producao)).toMatch(/o último portão não foi o de/)
  })

  it('o commit sem produção não cobra bloco, linha nem carimbo do documento', () => {
    expect(avaliarMutacoes(null, documento, SEM_NADA, ['apps/api/test/pedidos.int.test.ts', 'tools/processo/mutacoes.ts'])).toBeNull()
  })

  it('com produção e com bloco, o carimbo das mutações de outro documento não vale', () => {
    const { mutacoes } = lerMutacoes(comBloco)
    const dele = { mutacoes: { documento, impressao: impressaoDasMutacoes(mutacoes), total: 1 } }
    expect(avaliarMutacoes(dele, documento, comBloco, producao)).toBeNull()
    expect(avaliarMutacoes({ mutacoes: { ...dele.mutacoes, documento: 'tasks/prd-x/4_task.md' } }, documento, comBloco, producao)).toMatch(/não foram conferidas/)
  })
})

describe('as linhas novas de produção com condição que nenhum bloco alcança (RF5)', () => {
  const DIFF = `diff --git a/apps/api/src/pedidos.repository.ts b/apps/api/src/pedidos.repository.ts
index 1111111..2222222 100644
--- a/apps/api/src/pedidos.repository.ts
+++ b/apps/api/src/pedidos.repository.ts
@@ -3,0 +4,2 @@ export function acharPedido() {
+    .where(and(
+      eq(pedidos.escolaId, escolaId),
@@ -9 +11 @@ export function listar() {
-  return a
+  if (a) return b
diff --git a/apps/api/src/velho.ts b/apps/api/src/velho.ts
deleted file mode 100644
index 3333333..0000000
--- a/apps/api/src/velho.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-if (x) y
-z
diff --git a/apps/web/src/Nova.tsx b/apps/web/src/Nova.tsx
new file mode 100644
index 0000000..4444444
--- /dev/null
+++ b/apps/web/src/Nova.tsx
@@ -0,0 +1,2 @@
+++ b/aparente.ts
+const a = b ?? c
`

  it('lê do diff só as linhas acrescentadas, com o número delas no arquivo novo', () => {
    expect(linhasAcrescentadas(DIFF)).toEqual([
      { arquivo: 'apps/api/src/pedidos.repository.ts', linha: 4, texto: '    .where(and(' },
      { arquivo: 'apps/api/src/pedidos.repository.ts', linha: 5, texto: '      eq(pedidos.escolaId, escolaId),' },
      { arquivo: 'apps/api/src/pedidos.repository.ts', linha: 11, texto: '  if (a) return b' },
      // Uma linha de conteúdo que parece o cabeçalho de outro arquivo (`+++ b/…`) não troca o arquivo.
      { arquivo: 'apps/web/src/Nova.tsx', linha: 1, texto: '++ b/aparente.ts' },
      { arquivo: 'apps/web/src/Nova.tsx', linha: 2, texto: 'const a = b ?? c' },
    ])
  })

  it('o arquivo de nome entre aspas, que o git escreve com acento, não herda as linhas do anterior', () => {
    const diff = [
      'diff --git a/apps/api/src/a.ts b/apps/api/src/a.ts',
      '--- a/apps/api/src/a.ts',
      '+++ b/apps/api/src/a.ts',
      '@@ -1,0 +2 @@',
      '+const a = 1',
      'diff --git "a/apps/api/src/configura\\303\\247\\303\\243o.ts" "b/apps/api/src/configura\\303\\247\\303\\243o.ts"',
      '--- "a/apps/api/src/configura\\303\\247\\303\\243o.ts"',
      '+++ "b/apps/api/src/configura\\303\\247\\303\\243o.ts"',
      '@@ -1,0 +1 @@',
      '+const b = 2',
    ].join('\n')
    expect(linhasAcrescentadas(diff)).toEqual([{ arquivo: 'apps/api/src/a.ts', linha: 2, texto: 'const a = 1' }])
  })

  it.each([
    { rotulo: 'if', operador: 'if', linha: 'if (pedido === undefined) {' },
    { rotulo: 'if', operador: 'if', linha: '} else if (a) {' },
    { rotulo: 'e lógico', operador: '&&', linha: 'const ok = a && b' },
    { rotulo: 'ou lógico', operador: '||', linha: 'const ok = a || b' },
    { rotulo: 'coalescência', operador: '??', linha: 'const nome = dado ?? padrao' },
    { rotulo: 'ternário', operador: '?:', linha: 'const rotulo = ativo ? "sim" : "não"' },
    { rotulo: 'ternário', operador: '?:', linha: '  ? sim' },
    { rotulo: 'case', operador: 'case', linha: "case 'professor':" },
    { rotulo: 'where', operador: '.where(', linha: '.where(and(' },
    { rotulo: 'expressão regular', operador: 'regex', linha: 'const so = /^\\d+$/.test(texto)' },
    { rotulo: 'expressão regular', operador: 'regex', linha: 'return /[a-z/]+/i.test(x)' },
    { rotulo: 'expressão regular', operador: 'regex', linha: 'const r = new RegExp(padrao)' },
  ])('o operador $rotulo é achado na linha', ({ operador, linha }) => {
    expect(condicoesDaLinha(linha)).toContain(operador)
  })

  it.each([
    { nome: 'import', linha: "import { se } from './if-pronto.ts'" },
    { nome: 'texto entre aspas', linha: "const aviso = 'a && b || c ?? d'" },
    { nome: 'comentário de linha inteira', linha: '// if (a) b && c' },
    { nome: 'comentário no fim', linha: 'const a = 1 // quando x ? y : z' },
    { nome: 'docblock', linha: ' * se a && b, então if (c)' },
    { nome: 'encadeamento opcional', linha: 'const a = b?.c' },
    { nome: 'propriedade opcional de tipo', linha: 'nome?: string' },
    { nome: 'divisão', linha: 'const media = soma / total / 2' },
    { nome: 'caminho em modelo de texto', linha: 'const caminho = `${base}/${nome}`' },
    { nome: 'fecho de JSX', linha: '</div>' },
    { nome: 'linha em branco', linha: '   ' },
  ])('$nome não é condição', ({ linha }) => {
    expect(condicoesDaLinha(linha)).toEqual([])
  })

  const novas = linhasAcrescentadas(DIFF)
  const sobre = (arquivo: string, ...trechos: string[]): Mutacao => ({ arquivo, teste: 'apps/api/test/x.int.test.ts', caso: null, antes: trechos, depois: [] })

  it('sem bloco, a linha com condição é listada; o código sem condição, não', () => {
    const faltando = linhasSemBloco(novas, [])
    expect(faltando.map((linha) => `${linha.arquivo}:${String(linha.linha)} ${linha.condicoes.join('+')}`)).toEqual([
      'apps/api/src/pedidos.repository.ts:4 .where(',
      'apps/api/src/pedidos.repository.ts:11 if',
      'apps/web/src/Nova.tsx:2 ??',
    ])
  })

  it('a mesma linha citada por um bloco do mesmo arquivo não é listada, ainda que seja contexto', () => {
    const doArquivo = sobre('apps/api/src/pedidos.repository.ts', '.where(and(', 'eq(pedidos.escolaId, escolaId),')
    expect(linhasSemBloco(novas, [doArquivo]).map((linha) => linha.texto.trim())).toEqual(['if (a) return b', 'const a = b ?? c'])
    // O espaço do começo e do fim não conta, como na leitura do bloco.
    expect(linhasSemBloco(novas, [sobre('apps/api/src/pedidos.repository.ts', 'if (a) return b')]).map((linha) => linha.linha)).toEqual([4, 2])
  })

  it('bloco de outro arquivo, mesmo com o mesmo texto, não alcança a linha', () => {
    const deOutro = sobre('apps/api/src/outro.repository.ts', 'if (a) return b', '.where(and(')
    expect(linhasSemBloco(novas, [deOutro])).toHaveLength(3)
  })

  it('dois blocos do mesmo arquivo alcançam, juntos, as linhas que cada um cita', () => {
    const primeiro = sobre('apps/api/src/pedidos.repository.ts', '.where(and(')
    const segundo = sobre('apps/api/src/pedidos.repository.ts', 'if (a) return b')
    expect(linhasSemBloco(novas, [primeiro, segundo]).map((linha) => linha.texto.trim())).toEqual(['const a = b ?? c'])
  })

  it('a lista sai por arquivo e por linha, e não na ordem em que o git a deu', () => {
    const desordenadas = [...novas].reverse()
    expect(linhasSemBloco(desordenadas, []).map((linha) => `${linha.arquivo}:${String(linha.linha)}`)).toEqual([
      'apps/api/src/pedidos.repository.ts:4',
      'apps/api/src/pedidos.repository.ts:11',
      'apps/web/src/Nova.tsx:2',
    ])
  })

  it('linha nova em teste, em .d.ts e fora de src não é listada', () => {
    const emTeste: LinhaNova[] = [
      { arquivo: 'apps/api/src/pedidos.test.ts', linha: 1, texto: 'if (a) b' },
      { arquivo: 'apps/web/src/vite-env.d.ts', linha: 1, texto: 'x ? y : z' },
      { arquivo: 'apps/web/vite.config.ts', linha: 1, texto: 'a && b' },
      { arquivo: 'apps/api/test/x.int.test.ts', linha: 1, texto: 'a ?? b' },
    ]
    expect(linhasSemBloco(emTeste, [])).toEqual([])
  })

  it.each([
    { nome: 'produção de apps', arquivo: 'apps/api/src/pedidos.repository.ts', lido: true },
    { nome: 'produção de packages', arquivo: 'packages/core/src/ia/llm-gateway.ts', lido: true },
    { nome: 'script do processo', arquivo: 'tools/processo/mutacoes.ts', lido: true },
    { nome: 'guarda', arquivo: 'tools/guardas/catraca.ts', lido: true },
    { nome: 'ferramenta de ci em módulo', arquivo: 'tools/ci/duracao-do-e2e.mjs', lido: true },
    { nome: 'ajudante de teste que não é teste', arquivo: 'tools/testes/compose.ts', lido: true },
    { nome: 'teste de tools', arquivo: 'tools/processo/mutacoes.test.ts', lido: false },
    { nome: 'spec de tools', arquivo: 'tools/ci/algo.spec.ts', lido: false },
    { nome: 'declaração de tipos de tools', arquivo: 'tools/ci/tipos.d.ts', lido: false },
    { nome: '__fixtures__ de tools', arquivo: 'tools/processo/__fixtures__/esteira/voce.ts', lido: false },
    { nome: 'fixtures de tools', arquivo: 'tools/ci/fixtures/usa-a-fila.ts', lido: false },
    { nome: 'pasta test de tools', arquivo: 'tools/guardas/test/ajuda.ts', lido: false },
    { nome: 'documento de tools', arquivo: 'tools/processo/harness/LEIAME.md', lido: false },
    { nome: 'dado de tools', arquivo: 'tools/ci/resultado.json', lido: false },
    { nome: 'gancho do git, sem extensão', arquivo: 'tools/processo/git-hooks/pre-push', lido: false },
    { nome: 'e2e', arquivo: 'e2e/areas.spec.ts', lido: false },
    { nome: 'configuração de apps fora de src', arquivo: 'apps/web/vite.config.ts', lido: false },
    { nome: 'pasta parecida com tools', arquivo: 'ferramentas/tools/x.ts', lido: false },
  ])('o --faltando lê o arquivo $nome: $lido', ({ arquivo, lido }) => {
    expect(ehArquivoDoFaltando(arquivo)).toBe(lido)
  })

  it('linha nova com condição em tools/ é listada, e o bloco do mesmo arquivo a alcança', () => {
    const deTools: LinhaNova[] = [
      { arquivo: 'tools/processo/mutacoes.ts', linha: 9, texto: '  if (a) return b' },
      { arquivo: 'tools/ci/e2e.ts', linha: 3, texto: 'const a = b ?? c' },
      { arquivo: 'tools/processo/mutacoes.test.ts', linha: 1, texto: 'if (x) y' },
      { arquivo: 'tools/ci/fixtures/usa-a-fila.ts', linha: 1, texto: 'if (x) y' },
    ]
    expect(linhasSemBloco(deTools, []).map((linha) => `${linha.arquivo}:${String(linha.linha)}`)).toEqual(['tools/ci/e2e.ts:3', 'tools/processo/mutacoes.ts:9'])
    expect(linhasSemBloco(deTools, [sobre('tools/processo/mutacoes.ts', 'if (a) return b')]).map((linha) => linha.arquivo)).toEqual(['tools/ci/e2e.ts'])
  })

  it('o relatório lista arquivo, linha, operador e texto, ou diz que não falta nada', () => {
    const lista = relatorioDoFaltando(linhasSemBloco(novas, []), 'tasks/prd-x/3_task.md')
    expect(lista).toBe(
      'Linhas novas de produção com condição que nenhum bloco de tasks/prd-x/3_task.md alcança (3):\n' +
        '  apps/api/src/pedidos.repository.ts:4  [.where(]  .where(and(\n' +
        '  apps/api/src/pedidos.repository.ts:11  [if]  if (a) return b\n' +
        '  apps/web/src/Nova.tsx:2  [??]  const a = b ?? c\n',
    )
    // Duas condições na mesma linha saem separadas por espaço.
    expect(relatorioDoFaltando([{ arquivo: 'apps/api/src/a.ts', linha: 7, texto: '  if (a && b) {', condicoes: ['if', '&&'] }], 'tasks/prd-x/3_task.md')).toBe(
      'Linhas novas de produção com condição que nenhum bloco de tasks/prd-x/3_task.md alcança (1):\n  apps/api/src/a.ts:7  [if &&]  if (a && b) {\n',
    )
    expect(relatorioDoFaltando([], 'tasks/prd-x/3_task.md')).toBe('Nenhuma linha nova de produção com condição fica sem bloco em tasks/prd-x/3_task.md.\n')
  })
})

describe('--faltando, sobre uma árvore de verdade', () => {
  const script = join(dirname(fileURLToPath(import.meta.url)), 'mutacoes.ts')

  /** Um repositório com um arquivo de produção versionado, um de teste e o documento da tarefa. */
  function repositorio(documento: string, comTools = false): string {
    const raiz = mkdtempSync(join(tmpdir(), 'faltando-'))
    const git = (...argumentos: string[]) => execFileSync('git', argumentos, { cwd: raiz, stdio: 'pipe' })
    git('init', '-q')
    git('config', 'user.email', 'teste@exemplo.com')
    git('config', 'user.name', 'Teste')
    for (const [arquivo, conteudo] of Object.entries({ 'apps/api/src/velho.ts': 'export const a = 1\n', 'apps/api/test/velho.int.test.ts': '// teste\n', 'tasks/prd-x/3_task.md': documento })) {
      mkdirSync(dirname(join(raiz, arquivo)), { recursive: true })
      writeFileSync(join(raiz, arquivo), conteudo)
    }
    if (comTools) {
      for (const arquivo of ['tools/ci/velho.ts', 'tools/ci/velho.test.ts', 'tools/ci/__fixtures__/velho.ts']) {
        mkdirSync(dirname(join(raiz, arquivo)), { recursive: true })
        writeFileSync(join(raiz, arquivo), 'export const a = 1\n')
      }
    }
    git('add', '-A')
    git('commit', '-q', '-m', 'base')
    writeFileSync(join(raiz, 'apps/api/src/velho.ts'), 'export const a = 1\nexport const b = a && 2\n')
    // No índice, como na hora do commit: `git diff` sem o HEAD não o veria.
    git('add', 'apps/api/src/velho.ts')
    writeFileSync(join(raiz, 'apps/api/test/velho.int.test.ts'), '// teste\nif (x) y\n')
    writeFileSync(join(raiz, 'apps/api/src/novo.ts'), 'export function f(x: number) {\n  if (x > 1) return 1\n  return 0\n}\n')
    if (comTools) {
      // Versionado e no índice, como na hora do commit; o teste e a fixture versionados também mudam, e não entram.
      writeFileSync(join(raiz, 'tools/ci/velho.ts'), 'export const a = 1\nexport const c = a || 3\n')
      git('add', 'tools/ci/velho.ts')
      writeFileSync(join(raiz, 'tools/ci/velho.test.ts'), 'export const a = 1\nif (x) y\n')
      writeFileSync(join(raiz, 'tools/ci/__fixtures__/velho.ts'), 'export const a = 1\nif (x) y\n')
      // Arquivos novos: o código entra; o teste, a fixture, o documento e o dado não.
      writeFileSync(join(raiz, 'tools/ci/novo.ts'), 'export function g(x: number) {\n  if (x > 1) return 1\n  return 0\n}\n')
      writeFileSync(join(raiz, 'tools/ci/novo.test.ts'), 'if (x) y\n')
      mkdirSync(join(raiz, 'tools/ci/fixtures'), { recursive: true })
      writeFileSync(join(raiz, 'tools/ci/fixtures/novo.ts'), 'if (x) y\n')
      writeFileSync(join(raiz, 'tools/ci/LEIAME.md'), 'se a && b, então if (c)\n')
    }
    return raiz
  }

  const rodar = (raiz: string) =>
    spawnSync(process.execPath, [...process.execArgv, script, '--faltando', 'tasks/prd-x/3_task.md'], { cwd: raiz, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: raiz } })

  it('lê o diff dos versionados e as linhas dos arquivos novos, e deixa o teste de fora', () => {
    const raiz = repositorio('# Tarefa\n')
    expect(linhasNovasDaArvore(raiz).map((linha) => `${linha.arquivo}:${String(linha.linha)}`)).toEqual([
      'apps/api/src/velho.ts:2',
      'apps/api/src/novo.ts:1',
      'apps/api/src/novo.ts:2',
      'apps/api/src/novo.ts:3',
      'apps/api/src/novo.ts:4',
    ])
  })

  it('lê também tools/: o diff dos versionados e as linhas dos arquivos novos, fora teste, fixture e documento', () => {
    const raiz = repositorio('# Tarefa\n', true)
    expect(linhasNovasDaArvore(raiz).map((linha) => `${linha.arquivo}:${String(linha.linha)}`)).toEqual([
      'apps/api/src/velho.ts:2',
      'tools/ci/velho.ts:2',
      'apps/api/src/novo.ts:1',
      'apps/api/src/novo.ts:2',
      'apps/api/src/novo.ts:3',
      'apps/api/src/novo.ts:4',
      'tools/ci/novo.ts:1',
      'tools/ci/novo.ts:2',
      'tools/ci/novo.ts:3',
      'tools/ci/novo.ts:4',
    ])
  })

  it('lista a condição nova de tools/ e sai 0; o bloco do arquivo de tools/ a tira da lista', () => {
    const sem = rodar(repositorio('# Tarefa\n', true))
    expect(sem.status).toBe(0)
    expect(sem.stdout).toBe(
      'Linhas novas de produção com condição que nenhum bloco de tasks/prd-x/3_task.md alcança (4):\n' +
        '  apps/api/src/novo.ts:2  [if]  if (x > 1) return 1\n' +
        '  apps/api/src/velho.ts:2  [&&]  export const b = a && 2\n' +
        '  tools/ci/novo.ts:2  [if]  if (x > 1) return 1\n' +
        '  tools/ci/velho.ts:2  [||]  export const c = a || 3\n',
    )
    const documento = `# Tarefa\n\n${bloco('arquivo: tools/ci/velho.ts', 'teste: tools/ci/velho.test.ts', '- export const c = a || 3', '+ export const c = a')}\n\n${bloco('arquivo: tools/ci/novo.ts', 'teste: tools/ci/velho.test.ts', '- if (x > 1) return 1')}\n`
    const com = rodar(repositorio(documento, true))
    expect(com.stdout).toBe(
      'Linhas novas de produção com condição que nenhum bloco de tasks/prd-x/3_task.md alcança (2):\n' +
        '  apps/api/src/novo.ts:2  [if]  if (x > 1) return 1\n' +
        '  apps/api/src/velho.ts:2  [&&]  export const b = a && 2\n',
    )
  })

  it('lista o que nenhum bloco alcança e sai 0', () => {
    const raiz = repositorio('# Tarefa\n')
    const saida = rodar(raiz)
    expect(saida.status).toBe(0)
    const lista =
      'Linhas novas de produção com condição que nenhum bloco de tasks/prd-x/3_task.md alcança (2):\n' +
      '  apps/api/src/novo.ts:2  [if]  if (x > 1) return 1\n' +
      '  apps/api/src/velho.ts:2  [&&]  export const b = a && 2\n'
    expect(saida.stdout).toBe(lista)
    // Sem a variável do projeto, a árvore é a do diretório onde o comando roda.
    const semVariavel = spawnSync(process.execPath, [...process.execArgv, script, '--faltando', 'tasks/prd-x/3_task.md'], { cwd: raiz, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: undefined } })
    expect(semVariavel.stdout).toBe(lista)
  })

  it('rodado sem --faltando, o módulo não faz nada', () => {
    const raiz = repositorio('# Tarefa\n')
    const saida = spawnSync(process.execPath, [...process.execArgv, script], { cwd: raiz, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: raiz } })
    expect(saida.status).toBe(0)
    expect(saida.stdout).toBe('')
    expect(saida.stderr).toBe('')
  })

  it('com um bloco que cita as linhas, não falta nada, e sai 0', () => {
    const documento = `# Tarefa\n\n${bloco('arquivo: apps/api/src/velho.ts', 'teste: apps/api/test/velho.int.test.ts', '- export const b = a && 2', '+ export const b = a')}\n\n${bloco('arquivo: apps/api/src/novo.ts', 'teste: apps/api/test/velho.int.test.ts', '- if (x > 1) return 1')}\n`
    const raiz = repositorio(documento)
    const saida = rodar(raiz)
    expect(saida.status).toBe(0)
    expect(saida.stdout).toBe('Nenhuma linha nova de produção com condição fica sem bloco em tasks/prd-x/3_task.md.\n')
  })

  it('importado por outro script, o módulo não roda o --faltando, ainda que o argumento seja o dele', () => {
    const raiz = repositorio('# Tarefa\n')
    const importador = join(mkdtempSync(join(tmpdir(), 'importador-')), 'importador.ts')
    writeFileSync(importador, `import ${JSON.stringify(script)}\n`)
    const saida = spawnSync(process.execPath, [...process.execArgv, importador, '--faltando', 'tasks/prd-x/3_task.md'], { cwd: raiz, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: raiz } })
    expect(saida.status).toBe(0)
    expect(saida.stdout).toBe('')
  })

  it('sem o documento, o uso sai 2; documento que não existe, avisa e sai 0', () => {
    const raiz = repositorio('# Tarefa\n')
    const semDocumento = spawnSync(process.execPath, [...process.execArgv, script, '--faltando'], { cwd: raiz, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: raiz } })
    expect(semDocumento.status).toBe(2)
    expect(semDocumento.stderr).toMatch(/^uso: node tools\/processo\/mutacoes\.ts --faltando/)
    const inexistente = spawnSync(process.execPath, [...process.execArgv, script, '--faltando', 'tasks/nao-existe.md'], { cwd: raiz, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: raiz } })
    expect(inexistente.status).toBe(0)
    expect(inexistente.stdout).toMatch(/^não foi possível listar as linhas sem bloco/)
  })
})

const MIN = 60_000

describe('o prazo da mutada', () => {
  it('é o maior entre 3 × a limpa, o testTimeout e 60 s, e nunca passa de 10 min', () => {
    expect(prazoDaMutada(30_000, 5_000)).toBe(90_000)
    expect(prazoDaMutada(1_000, 120_000)).toBe(120_000)
    expect(prazoDaMutada(1_000, 2_000)).toBe(60_000)
    expect(prazoDaMutada(4 * MIN, 5_000)).toBe(10 * MIN)
    expect(prazoDaMutada(1_000, 20 * MIN)).toBe(10 * MIN)
  })
})

describe('o testTimeout que o projeto e o caso declaram', () => {
  it('o projeto: unidade fica no padrão do Vitest, integração e infra leem o da configuração, e e2e e arquivo sem tipo ficam no do Playwright', () => {
    const configuracao = 'const integracao = {\n  testTimeout: 90_000,\n  hookTimeout: 180_000,\n}\n'
    expect(testTimeoutDoProjeto(configuracao, 'unidade')).toBe(5_000)
    expect(testTimeoutDoProjeto(configuracao, 'integracao')).toBe(90_000)
    expect(testTimeoutDoProjeto(configuracao, 'infra')).toBe(90_000)
    expect(testTimeoutDoProjeto('', 'integracao')).toBe(5_000)
    expect(testTimeoutDoProjeto(configuracao, 'e2e')).toBe(30_000)
    expect(testTimeoutDoProjeto(configuracao, null)).toBe(30_000)
  })

  it('o do vitest.config.ts de verdade é o que o portão usa: 60 s na integração e na infra', () => {
    const configuracao = readFileSync(join(import.meta.dirname, '../../vitest.config.ts'), 'utf8')
    expect(testTimeoutDoProjeto(configuracao, 'integracao')).toBe(60_000)
    expect(testTimeoutDoProjeto(configuracao, 'infra')).toBe(60_000)
  })

  it('o da mutação: o do caso quando ele declara, senão o do projeto na árvore, e o padrão sem configuração nem tipo', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'mutacoes-timeout-'))
    writeFileSync(join(raiz, 'a.int.test.ts'), "it('o lento', async () => {}, 120_000)\nit('o comum', async () => {})\n")
    writeFileSync(join(raiz, 'b.spec.ts'), '// e2e\n')
    writeFileSync(join(raiz, 'README.md'), '# x\n')
    const de = (teste: string, caso: string | null) => testTimeoutDaMutacao(raiz, { ...mutacao(), teste, caso })
    expect(de('a.int.test.ts', 'o lento')).toBe(120_000)
    // Sem configuração na árvore, o projeto fica no padrão do Vitest.
    expect(de('a.int.test.ts', 'o comum')).toBe(5_000)
    writeFileSync(join(raiz, 'vitest.config.ts'), 'const integracao = { testTimeout: 75_000 }\n')
    expect(de('a.int.test.ts', 'o comum')).toBe(75_000)
    expect(de('b.spec.ts', null)).toBe(30_000)
    expect(de('README.md', null)).toBe(30_000)
  })

  it('o caso: o último argumento do it, { timeout }, test.setTimeout e test.slow, e só o trecho dele', () => {
    const fonte = [
      "it('a lenta', async () => {",
      '  await x()',
      '}, 120_000)',
      '',
      "it('a com objeto', { timeout: 90_000 }, async () => {})",
      '',
      "test('a do e2e', async () => {",
      '  test.setTimeout(45_000)',
      '})',
      '',
      "test('a lenta do e2e', async () => {",
      '  test.slow()',
      '})',
      '',
      "it('a sem prazo', async () => {",
      '  expect(f({ a: 1 }, 2)).toBe(3)',
      '})',
      '',
      "it('a última', async () => {}, 7_000)",
    ].join('\n')
    expect(testTimeoutDoCaso(fonte, 'a lenta')).toBe(120_000)
    expect(testTimeoutDoCaso(fonte, 'a com objeto')).toBe(90_000)
    expect(testTimeoutDoCaso(fonte, 'a do e2e')).toBe(45_000)
    expect(testTimeoutDoCaso(fonte, 'a lenta do e2e')).toBe(90_000)
    // O prazo do caso seguinte não vaza para o que não declara.
    expect(testTimeoutDoCaso(fonte, 'a sem prazo')).toBeNull()
    expect(testTimeoutDoCaso(fonte, 'a última')).toBe(7_000)
    expect(testTimeoutDoCaso(fonte, 'não existe')).toBeNull()
    expect(testTimeoutDoCaso(fonte, null)).toBeNull()
  })
})

describe('a mutada que passa do prazo, com o relógio injetado', () => {
  function arvore(configuracao?: string, fonteDoTeste = '// teste\n'): string {
    const raiz = mkdtempSync(join(tmpdir(), 'mutacoes-prazo-'))
    const arquivos: Record<string, string> = { 'apps/api/src/pedidos.repository.ts': REPOSITORIO, 'apps/api/test/pedidos.int.test.ts': fonteDoTeste }
    if (configuracao !== undefined) arquivos['vitest.config.ts'] = configuracao
    for (const [arquivo, conteudo] of Object.entries(arquivos)) {
      mkdirSync(dirname(join(raiz, arquivo)), { recursive: true })
      writeFileSync(join(raiz, arquivo), conteudo)
    }
    return raiz
  }
  const fonte = (raiz: string) => readFileSync(join(raiz, 'apps/api/src/pedidos.repository.ts'), 'utf8')

  /** A corrida limpa leva `limpaMs`; a mutada, `mutadaMs`, e cai (ou passa, se `mutadaPassa`). */
  function conferir(raiz: string, limpaMs: number, mutadaMs: number, opcoes: { mutadaPassa?: boolean; testTimeoutMs?: number; caso?: string | null } = {}) {
    let agora = 0
    const prazos: (number | undefined)[] = []
    const avisos: string[] = []
    let corridas = 0
    const rodar: Rodar = (_comando, prazo) => {
      corridas += 1
      prazos.push(prazo)
      if (corridas === 1) {
        agora += limpaMs
        return true
      }
      agora += mutadaMs
      return opcoes.mutadaPassa ?? false
    }
    const resultados = conferirMutacoes(raiz, [mutacao({ caso: opcoes.caso ?? null })], rodar, (texto) => avisos.push(texto), {
      agora: () => agora,
      ...(opcoes.testTimeoutMs !== undefined ? { testTimeoutMs: () => opcoes.testTimeoutMs ?? 0 } : {}),
    })
    return { resultados, prazos, avisos, corridas }
  }

  it('(e) limpa de 1 s e mutada de 61 s: recusada, e o arquivo volta', () => {
    const raiz = arvore()
    const { resultados, avisos } = conferir(raiz, 1_000, 61_000)
    expect(resultados.map((resultado) => resultado.veredito)).toEqual(['recusada'])
    expect(resultados[0]?.motivo).toMatch(/passou do prazo de 60 s/)
    expect(avisos.join('')).toMatch(/^✗ .*passou do prazo/)
    expect(fonte(raiz)).toBe(REPOSITORIO)
  })

  it('(f) limpa de 4 min: o prazo é 10 min, e não 12, e a mutada de 11 min é recusada', () => {
    const { resultados, prazos } = conferir(arvore(), 4 * MIN, 11 * MIN)
    expect(resultados.map((resultado) => resultado.veredito)).toEqual(['recusada'])
    expect(prazos).toEqual([10 * MIN, 10 * MIN])
    expect(resultados[0]?.motivo).toMatch(/prazo de 600 s.*até 10 min/)
  })

  it('o prazo vai à corrida: o teto na limpa, e o calculado na mutada', () => {
    const { prazos } = conferir(arvore(), 30_000, 1_000, { testTimeoutMs: 5_000 })
    expect(prazos).toEqual([10 * MIN, 90_000])
  })

  it('(d) a limpa acima do teto falha dizendo isso, e nada é mutado', () => {
    const raiz = arvore()
    const { resultados, corridas } = conferir(raiz, 11 * MIN, 1_000, { mutadaPassa: false })
    expect(resultados.map((resultado) => resultado.veredito)).toEqual(['recusada'])
    expect(resultados[0]?.motivo).toMatch(/corrida limpa.*passou do teto de 10 min/)
    // Só a limpa correu: a mutada não chegou a rodar.
    expect(corridas).toBe(1)
    expect(fonte(raiz)).toBe(REPOSITORIO)
  })

  it('a limpa que a corrida diz que foi morta no teto também falha como estourada, mesmo com o relógio no prazo', () => {
    const raiz = arvore()
    let corridas = 0
    const resultados = conferirMutacoes(raiz, [mutacao()], () => {
      corridas += 1
      return 'estourou'
    })
    expect(resultados[0]).toMatchObject({ veredito: 'recusada' })
    expect(resultados[0]?.motivo).toMatch(/passou do teto/)
    expect(corridas).toBe(1)
  })

  it('a mutada que a corrida diz que foi morta é recusada, mesmo com o relógio abaixo do prazo', () => {
    const raiz = arvore()
    let corridas = 0
    const resultados = conferirMutacoes(raiz, [mutacao()], () => {
      corridas += 1
      return corridas === 1 ? true : 'estourou'
    })
    expect(resultados[0]).toMatchObject({ veredito: 'recusada' })
    expect(resultados[0]?.motivo).toMatch(/passou do prazo/)
    expect(fonte(raiz)).toBe(REPOSITORIO)
  })

  it('mutada que falha rápido é vermelha, e a que passa é verde', () => {
    expect(conferir(arvore(), 1_000, 2_000).resultados.map((resultado) => resultado.veredito)).toEqual(['vermelho'])
    expect(conferir(arvore(), 1_000, 2_000, { mutadaPassa: true }).resultados.map((resultado) => resultado.veredito)).toEqual(['verde'])
  })

  it('limpa de 1 s, testTimeout de 2 s e mutada que falha em 5 s: vermelha, pelo piso de 60 s', () => {
    expect(conferir(arvore(), 1_000, 5_000, { testTimeoutMs: 2_000 }).resultados.map((resultado) => resultado.veredito)).toEqual(['vermelho'])
  })

  it('limpa de 30 s e mutada que falha em 80 s: vermelha, pelas 3 vezes a limpa', () => {
    expect(conferir(arvore(), 30_000, 80_000).resultados.map((resultado) => resultado.veredito)).toEqual(['vermelho'])
    expect(conferir(arvore(), 30_000, 91_000).resultados.map((resultado) => resultado.veredito)).toEqual(['recusada'])
  })

  it('limpa de 1 s, testTimeout do projeto de 120 s e mutada que falha em 90 s: vermelha, o prazo é o da configuração', () => {
    const raiz = arvore('const integracao = {\n  testTimeout: 120_000,\n}\n')
    expect(conferir(raiz, 1_000, 90_000).resultados.map((resultado) => resultado.veredito)).toEqual(['vermelho'])
  })

  it('o testTimeout injetado vale mais que o da árvore', () => {
    const raiz = arvore('const integracao = {\n  testTimeout: 5_000,\n}\n')
    expect(conferir(raiz, 1_000, 90_000, { testTimeoutMs: 120_000 }).resultados.map((resultado) => resultado.veredito)).toEqual(['vermelho'])
    expect(conferir(raiz, 1_000, 90_000).resultados.map((resultado) => resultado.veredito)).toEqual(['recusada'])
  })

  it('limpa de 1 s, projeto com 5 s e caso que declara 120 s: a mutada que falha em 90 s é vermelha, vale o do caso', () => {
    const raiz = arvore('const integracao = {\n  testTimeout: 5_000,\n}\n', "it('o caso lento', async () => {}, 120_000)\n")
    expect(conferir(raiz, 1_000, 90_000, { caso: 'o caso lento' }).resultados.map((resultado) => resultado.veredito)).toEqual(['vermelho'])
    // Sem o caso, ou com outro nome, o prazo é o piso, e os mesmos 90 s estouram.
    expect(conferir(raiz, 1_000, 90_000, { caso: 'outro caso' }).resultados.map((resultado) => resultado.veredito)).toEqual(['recusada'])
  })
})

const MUTACOES_TS = fileURLToPath(new URL('./mutacoes.ts', import.meta.url))

/** O pid do neto que o "teste" gravou em `neto.pid`, ou `null` enquanto o arquivo não existe ou ainda está vazio. */
function pidDoNeto(raiz: string): number | null {
  try {
    const texto = readFileSync(join(raiz, 'neto.pid'), 'utf8').trim()
    return texto === '' ? null : Number(texto)
  } catch {
    return null
  }
}

/** O neto morreu: o `kill -0` diz `ESRCH`. Espera até dois segundos, porque quem o recolhe é o init. */
async function morreu(pid: number): Promise<boolean> {
  for (let tentativa = 0; tentativa < 40; tentativa += 1) {
    try {
      process.kill(pid, 0)
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code === 'ESRCH') return true
    }
    await new Promise((resolver) => setTimeout(resolver, 50))
  }
  return false
}

/** Higiene do teste que falhou: o neto que dorme 600 s não fica vivo depois dele. */
function limpar(raiz: string): void {
  const pid = pidDoNeto(raiz)
  if (pid === null) return
  try {
    process.kill(pid, 'SIGKILL')
  } catch {
    // já morreu
  }
}

describe('o supervisor da corrida, como processo de verdade', () => {
  const arquivosDe = (raiz: string) => ({ neto: join(raiz, 'neto.pid'), marcador: join(raiz, 'tratou.txt') })
  const pasta = () => mkdtempSync(join(tmpdir(), 'supervisor-'))


  /**
   * O supervisor sozinho, com prazo e espera de verdade e um limite do lado do teste: supervisor que não termina volta
   * `travou` em vez de prender o teste (e, no portão, a mutação inteira até o prazo dela).
   */
  async function supervisionado(comando: string[], opcoes: { prazoMs: number; esperaMs: number; sinalQuando?: { quando: () => boolean; sinal: NodeJS.Signals }; limiteMs?: number }) {
    const supervisor = spawn(process.execPath, [...process.execArgv, MUTACOES_TS, MARCA_DO_SUPERVISOR, String(opcoes.prazoMs), String(opcoes.esperaMs), '--', ...comando], { stdio: 'ignore' })
    const inicio = Date.now()
    const saida = new Promise<number | 'travou'>((resolver) => {
      supervisor.on('close', (codigo) => resolver(codigo ?? 255))
      setTimeout(() => resolver('travou'), opcoes.limiteMs ?? 6_000)
    })
    // O sinal só sai quando `quando` diz que o grupo já está de pé (o `sh` gravou o neto): os handlers do supervisor são
    // registrados no mesmo tick do `spawn` do teste, então esse arquivo prova que eles existem, e o teste não depende de
    // quanto o Node leva para subir.
    if (opcoes.sinalQuando) {
      const { quando, sinal } = opcoes.sinalQuando
      const espiar = setInterval(() => {
        if (!quando()) return
        clearInterval(espiar)
        supervisor.kill(sinal)
      }, 25)
    }
    const codigo = await saida
    supervisor.kill('SIGKILL')
    return { codigo, durouMs: Date.now() - inicio }
  }

  it('o comando que passa sai 0, o que cai sai 1, e o programa que nem abre sai 127', async () => {
    expect((await supervisionado(['sh', '-c', 'exit 0'], { prazoMs: 30_000, esperaMs: 500 })).codigo).toBe(0)
    expect((await supervisionado(['sh', '-c', 'exit 3'], { prazoMs: 30_000, esperaMs: 500 })).codigo).toBe(1)
    expect((await supervisionado(['programa-que-nao-existe-xyz'], { prazoMs: 30_000, esperaMs: 500 })).codigo).toBe(127)
  }, 40_000)

  it('passado o prazo, mata o grupo e sai com o código do prazo, e o neto morre', async () => {
    const raiz = pasta()
    try {
      const { codigo, durouMs } = await supervisionado(['sh', '-c', `sleep 600 & echo $! > ${arquivosDe(raiz).neto}; wait`], { prazoMs: 700, esperaMs: 500 })
      expect(codigo).toBe(SAIDA_DO_PRAZO)
      expect(durouMs).toBeLessThan(5_000)
      expect(await morreu(Number(readFileSync(arquivosDe(raiz).neto, 'utf8')))).toBe(true)
    } finally {
      limpar(raiz)
    }
  }, 40_000)

  it('o SIGTERM chega primeiro, e o SIGKILL só depois da espera: quem trata o sinal tem tempo de acabar', async () => {
    const raiz = pasta()
    const { marcador, neto } = arquivosDe(raiz)
    try {
      const tratador = `trap 'sleep 0.4; echo tratou > ${marcador}; exit 0' TERM; sleep 600 & echo $! > ${neto}; wait`
      const { codigo, durouMs } = await supervisionado(['sh', '-c', tratador], { prazoMs: 700, esperaMs: 20_000, limiteMs: 30_000 })
      expect(codigo).toBe(SAIDA_DO_PRAZO)
      expect(existsSync(marcador)).toBe(true)
      // O grupo acabou com o tratador: não esperou os 20 s da espera.
      expect(durouMs).toBeLessThan(10_000)
    } finally {
      limpar(raiz)
    }
  }, 40_000)

  it('o prazo e um sinal que chega depois mandam um SIGTERM só: o terminar roda uma vez', async () => {
    const raiz = pasta()
    const { marcador, neto } = arquivosDe(raiz)
    try {
      // O tratador não sai: o grupo só acaba no SIGKILL, e cada SIGTERM que chega deixa uma linha.
      const tratador = `trap 'echo tratou >> ${marcador}' TERM; sleep 600 & echo $! > ${neto}; while :; do sleep 0.1; done`
      // Depois do prazo (a primeira linha existe), um SIGINT no supervisor: sem a guarda, abriria outro terminar e outro SIGTERM.
      const { codigo } = await supervisionado(['sh', '-c', tratador], { prazoMs: 700, esperaMs: 1_500, sinalQuando: { quando: () => existsSync(marcador), sinal: 'SIGINT' } })
      expect(codigo).toBe(SAIDA_DO_PRAZO)
      expect(readFileSync(marcador, 'utf8').trim().split('\n')).toEqual(['tratou'])
    } finally {
      limpar(raiz)
    }
  }, 40_000)

  it('o neto que ignora o SIGTERM morre pelo SIGKILL, e o supervisor sai passada a espera', async () => {
    const raiz = pasta()
    const { neto } = arquivosDe(raiz)
    try {
      const { codigo, durouMs } = await supervisionado(['sh', '-c', `trap '' TERM; sleep 600 & echo $! > ${neto}; wait`], { prazoMs: 700, esperaMs: 600 })
      expect(codigo).toBe(SAIDA_DO_PRAZO)
      expect(durouMs).toBeLessThan(5_000)
      expect(await morreu(Number(readFileSync(neto, 'utf8')))).toBe(true)
    } finally {
      limpar(raiz)
    }
  }, 40_000)

  it.each(['SIGINT', 'SIGTERM', 'SIGHUP'] as const)('o %s no supervisor leva o grupo do teste junto: o Ctrl-C do portão não deixa neto', async (sinal) => {
    const raiz = pasta()
    const { neto } = arquivosDe(raiz)
    try {
      const { codigo } = await supervisionado(['sh', '-c', `sleep 600 & echo $! > ${neto}; wait`], { prazoMs: 60_000, esperaMs: 500, sinalQuando: { quando: () => pidDoNeto(raiz) !== null, sinal } })
      expect(codigo).toBe(SAIDA_DO_PRAZO)
      expect(await morreu(Number(readFileSync(neto, 'utf8')))).toBe(true)
    } finally {
      limpar(raiz)
    }
  }, 40_000)

  it('o teste que sai e deixa um neto vivo leva o grupo junto: o neto morre, e o código continua o do teste (M5 da retro da X7)', async () => {
    const raiz = pasta()
    const { neto } = arquivosDe(raiz)
    try {
      // O `sh` sai 0 na hora e o `sleep` fica no grupo: sem isso o neto segura o `flock` da fila de carga depois do teste que passou.
      const passou = await supervisionado(['sh', '-c', `sleep 600 & echo $! > ${neto}; exit 0`], { prazoMs: 30_000, esperaMs: 500 })
      expect(passou.codigo).toBe(0)
      expect(await morreu(Number(readFileSync(neto, 'utf8')))).toBe(true)
      rmSync(neto)
      const caiu = await supervisionado(['sh', '-c', `sleep 600 & echo $! > ${neto}; exit 3`], { prazoMs: 30_000, esperaMs: 500 })
      expect(caiu.codigo).toBe(1)
      expect(await morreu(Number(readFileSync(neto, 'utf8')))).toBe(true)
    } finally {
      limpar(raiz)
    }
  }, 40_000)

  it('o neto que ignora o SIGTERM no fim do teste também morre, pelo SIGKILL depois da espera, e o código continua o do teste', async () => {
    const raiz = pasta()
    const { neto } = arquivosDe(raiz)
    try {
      const { codigo, durouMs } = await supervisionado(['sh', '-c', `(trap '' TERM; sleep 600) & echo $! > ${neto}; exit 0`], { prazoMs: 30_000, esperaMs: 600 })
      expect(codigo).toBe(0)
      expect(durouMs).toBeLessThan(5_000)
      expect(await morreu(Number(readFileSync(neto, 'utf8')))).toBe(true)
    } finally {
      limpar(raiz)
    }
  }, 40_000)

  it('o sinal que chega no primeiro instante, mandado pelo próprio teste, já encontra o tratador: o grupo morre e o supervisor sai com o código do prazo (M5 da retro da X7)', async () => {
    const raiz = pasta()
    const { neto } = arquivosDe(raiz)
    try {
      // O `sh` manda o SIGINT ao supervisor no primeiro instante, logo depois de abrir o neto: o tratador tem de existir antes de o
      // grupo existir, e não logo depois (a janela entre o `spawn` e o `process.on`, em que o sinal mata o supervisor e deixa o grupo vivo).
      const { codigo } = await supervisionado(['sh', '-c', `sleep 600 & echo $! > ${neto}; kill -INT $PPID; wait`], { prazoMs: 60_000, esperaMs: 500 })
      expect(codigo).toBe(SAIDA_DO_PRAZO)
      // E o grupo do filho acabou: o neto que o `sh` abriu antes do sinal não sobrevive ao supervisor.
      expect(await morreu(Number(readFileSync(neto, 'utf8')))).toBe(true)
    } finally {
      limpar(raiz)
    }
  }, 40_000)

  it('o arquivo chamado sem a marca não roda supervisor nenhum', () => {
    expect(spawnSync(process.execPath, [...process.execArgv, MUTACOES_TS], { timeout: 20_000 }).status).toBe(0)
  }, 40_000)

  it('o sinal ao grupo diz se ele existe: o grupo vivo recebe, o que acabou não', () => {
    const vivo = spawn('sleep', ['30'], { detached: true, stdio: 'ignore' })
    try {
      expect(sinalAoGrupo(vivo.pid ?? 0, 0)).toBe(true)
    } finally {
      vivo.kill('SIGKILL')
    }
    expect(sinalAoGrupo(spawnSync('true').pid, 'SIGTERM')).toBe(false)
  })
})

describe('o Ctrl-C no portão devolve o arquivo mutado (M5 da retro da X7)', () => {
  const FONTE = "const modo = 'normal'\n"
  const mutacaoDaFonte: Mutacao = { arquivo: 'fonte.ts', teste: 'fonte.test.ts', caso: null, antes: ["const modo = 'normal'"], depois: ["const modo = 'trava'"] }

  /** O que o portão faz com uma mutação, como processo: o "teste" passa com a fonte intacta e, mutada, dorme com um neto. */
  function montar() {
    const raiz = mkdtempSync(join(tmpdir(), 'ctrl-c-'))
    writeFileSync(join(raiz, 'fonte.ts'), FONTE)
    // Executável, como o hook de shell que o portão muta: devolver a fonte não pode tirar o bit.
    chmodSync(join(raiz, 'fonte.ts'), 0o755)
    writeFileSync(join(raiz, 'fonte.test.ts'), '// teste\n')
    const neto = join(raiz, 'neto.pid')
    const script = `if grep -q trava ${join(raiz, 'fonte.ts')}; then sleep 600 & echo $! > ${neto}; wait; fi`
    const ponte = join(raiz, 'ponte.ts')
    // `conferirMutacoes` e `rodarCalado` do arquivo vivo: o que o `portao-local.ts` chama, sem as suítes.
    writeFileSync(
      ponte,
      [
        `import { conferirMutacoes, rodarCalado } from ${JSON.stringify(pathToFileURL(MUTACOES_TS).href)}`,
        `const real = rodarCalado(${JSON.stringify(raiz)})`,
        `conferirMutacoes(${JSON.stringify(raiz)}, [${JSON.stringify(mutacaoDaFonte)}], (_comando, prazo, restaurar) => real(['sh', '-c', ${JSON.stringify(script)}], prazo, restaurar), () => undefined, { prazoDaMutada: () => 60_000, testTimeoutMs: () => 0 })`,
      ].join('\n'),
    )
    return { raiz, neto, ponte }
  }

  async function esperarAte(condicao: () => boolean, ms: number): Promise<boolean> {
    for (let tentativa = 0; tentativa < ms / 50 && !condicao(); tentativa += 1) await new Promise((resolver) => setTimeout(resolver, 50))
    return condicao()
  }

  it('o caminho normal do rodarCalado com a restauração: a fonte volta como era, com o modo dela', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'restaura-'))
    try {
      const fonte = join(raiz, 'fonte.sh')
      writeFileSync(fonte, 'original\n')
      chmodSync(fonte, 0o755)
      // O que a mutada deixa no disco: o conteúdo muda, o modo não (o `writeFileSync` mantém o do arquivo que já existe).
      writeFileSync(fonte, 'mutada\n')
      expect(rodarCalado(raiz)(['sh', '-c', 'exit 0'], 30_000, { arquivo: fonte, original: 'original\n' })).toBe(true)
      expect(readFileSync(fonte, 'utf8')).toBe('original\n')
      expect(statSync(fonte).mode & 0o777).toBe(0o755)
      // Fonte 0644 continua 0644: o supervisor não escolhe o modo.
      chmodSync(fonte, 0o644)
      writeFileSync(fonte, 'mutada\n')
      expect(rodarCalado(raiz)(['sh', '-c', 'exit 1'], 30_000, { arquivo: fonte, original: 'original\n' })).toBe(false)
      expect(statSync(fonte).mode & 0o777).toBe(0o644)
      expect(readFileSync(fonte, 'utf8')).toBe('original\n')
    } finally {
      rmSync(raiz, { recursive: true, force: true })
    }
  }, 40_000)

  it.each(['SIGINT', 'SIGHUP'] as const)('o %s no grupo do portão (o que o terminal manda): o supervisor mata o grupo do teste, devolve a fonte e o neto morre', async (sinal) => {
    const { raiz, neto, ponte } = montar()
    // O grupo próprio faz da ponte o "portão" e do supervisor um colega de grupo, como no terminal: o sinal vai a ambos, e não ao grupo do teste.
    const portao = spawn(process.execPath, [...process.execArgv, ponte], { detached: true, stdio: 'ignore' })
    try {
      expect(await esperarAte(() => existsSync(neto) && readFileSync(neto, 'utf8').trim() !== '', 20_000)).toBe(true)
      // A fonte está mutada enquanto o teste dorme: é o que o Ctrl-C encontra.
      expect(readFileSync(join(raiz, 'fonte.ts'), 'utf8')).toContain('trava')
      process.kill(-(portao.pid ?? 0), sinal)
      expect(await esperarAte(() => readFileSync(join(raiz, 'fonte.ts'), 'utf8') === FONTE, 15_000)).toBe(true)
      expect(statSync(join(raiz, 'fonte.ts')).mode & 0o777).toBe(0o755)
      expect(await morreu(Number(readFileSync(neto, 'utf8')))).toBe(true)
    } finally {
      portao.kill('SIGKILL')
      limpar(raiz)
      rmSync(raiz, { recursive: true, force: true })
    }
  }, 60_000)
})

describe('rodar calado: a corrida pelo supervisor, e a mutada que trava até o prazo', () => {
  const FONTE = "const modo = 'normal'\n"
  const arquivos = (raiz: string) => ({ fonte: join(raiz, 'fonte.ts'), neto: join(raiz, 'neto.pid'), trava: join(raiz, 'carga.lock') })

  function arvore(): string {
    const raiz = mkdtempSync(join(tmpdir(), 'mutacoes-processo-'))
    writeFileSync(join(raiz, 'fonte.ts'), FONTE)
    writeFileSync(join(raiz, 'fonte.test.ts'), '// teste\n')
    return raiz
  }
  const mutacaoDaFonte: Mutacao = { arquivo: 'fonte.ts', teste: 'fonte.test.ts', caso: null, antes: ["const modo = 'normal'"], depois: ["const modo = 'trava'"] }

  /** O "teste": passa com a fonte intacta e, mutada, abre um neto que dorme e espera por ele. */
  function scriptQueTrava(raiz: string, trava = false): string {
    const { fonte, neto, trava: arquivoDaTrava } = arquivos(raiz)
    const dorme = trava ? `flock ${arquivoDaTrava} sh -c 'sleep 600 & echo $! > ${neto}; wait'` : `sleep 600 & echo $! > ${neto}; wait`
    return `if grep -q trava ${fonte}; then ${dorme}; fi`
  }


  /** O prazo da mutada é o injetado de 2 s: quem não o repassa à corrida volta vermelho já aqui, e não depois de esperar o prazo inteiro. */
  function conferirComProcesso(raiz: string, script: string) {
    const real = rodarCalado(raiz)
    const inicio = Date.now()
    const resultados = conferirMutacoes(
      raiz,
      [mutacaoDaFonte],
      (_comando, prazo) => {
        if (prazo !== 10 * MIN && prazo !== 2_000) throw new Error(`prazo inesperado: ${String(prazo)}`)
        return real(['sh', '-c', script], prazo)
      },
      () => undefined,
      { prazoDaMutada: () => 2_000, testTimeoutMs: () => 0 },
    )
    return { resultados, durouMs: Date.now() - inicio }
  }

  it('(a), (b) e (c): sai no prazo, recusada, com o neto morto e o arquivo de volta', async () => {
    const raiz = arvore()
    try {
      const { resultados, durouMs } = conferirComProcesso(raiz, scriptQueTrava(raiz))
      expect(resultados.map((resultado) => resultado.veredito)).toEqual(['recusada'])
      expect(resultados[0]?.motivo).toMatch(/passou do prazo/)
      // O teste dormiria 600 s: voltou em poucos.
      expect(durouMs).toBeLessThan(20_000)
      // O neto: o `sleep` que o `sh` abriu, e não o `sh`.
      expect(await morreu(Number(readFileSync(arquivos(raiz).neto, 'utf8')))).toBe(true)
      expect(readFileSync(arquivos(raiz).fonte, 'utf8')).toBe(FONTE)
    } finally {
      limpar(raiz)
    }
  }, 40_000)

  it('depois do prazo, uma segunda corrida pega o flock', () => {
    const raiz = arvore()
    try {
      const { resultados } = conferirComProcesso(raiz, scriptQueTrava(raiz, true))
      expect(resultados.map((resultado) => resultado.veredito)).toEqual(['recusada'])
      expect(spawnSync('flock', ['-n', arquivos(raiz).trava, 'true']).status).toBe(0)
    } finally {
      limpar(raiz)
    }
  }, 40_000)

  it('o teste que passa dentro do prazo não é morto: passou é verdadeiro, caiu é falso, e estourou diz que estourou', () => {
    const real = rodarCalado(arvore())
    expect(real(['sh', '-c', 'exit 0'], 30_000)).toBe(true)
    expect(real(['sh', '-c', 'exit 3'], 30_000)).toBe(false)
    expect(real(['sh', '-c', 'sleep 30'], 500)).toBe('estourou')
  }, 40_000)

  it('a espera até o SIGKILL é a injetada: o teste que ignora o SIGTERM é morto em segundos, e não nos 5 s do padrão', () => {
    const inicio = Date.now()
    const corrida = rodarCalado(arvore(), { esperaAteSigkillMs: 300 })(['sh', '-c', "trap '' TERM; sleep 600 & wait"], 500)
    expect(corrida).toBe('estourou')
    // Prazo de 0,5 s, mais 0,3 s de espera, mais o Node: bem antes dos 5 s do padrão.
    expect(Date.now() - inicio).toBeLessThan(3_000)
  }, 40_000)

  it('sem o prazo, a corrida vale o teto de 10 min, e não estoura em segundos', () => {
    expect(rodarCalado(arvore())(['sh', '-c', 'sleep 0.3'])).toBe(true)
  }, 40_000)

  it('o supervisor que roda é a cópia do arquivo, e não o arquivo vivo que a mutação altera', () => {
    const raiz = arvore()
    const saida = join(raiz, 'supervisor.txt')
    expect(rodarCalado(raiz)(['sh', '-c', `tr '\\0' ' ' < /proc/$PPID/cmdline > ${saida}`], 30_000)).toBe(true)
    const linhaDeComando = readFileSync(saida, 'utf8')
    expect(linhaDeComando).toMatch(/educa-supervisor-[0-9a-f]{16}\.ts --supervisionar-corrida/)
    expect(linhaDeComando).not.toContain('tools/processo/mutacoes.ts')
  }, 40_000)
})

describe('o portão confere as mutações do documento, e a web reconstruída é parte da conferência', () => {
  const documento = 'tasks/prd-x/3_task.md'
  const TELA = 'export const Tela = () => <Menu />\n'
  const deTela: Mutacao = { arquivo: 'apps/web/src/Tela.tsx', teste: 'e2e/areas.spec.ts', caso: 'o aluno acha', antes: ['<Menu />'], depois: ['<Nada />'] }
  const deRepositorio = mutacao()

  function arvore(): string {
    const raiz = mkdtempSync(join(tmpdir(), 'mutacoes-documento-'))
    const arquivos: Record<string, string> = {
      'apps/web/src/Tela.tsx': TELA,
      'e2e/areas.spec.ts': '// e2e\n',
      'apps/api/src/pedidos.repository.ts': REPOSITORIO,
      'apps/api/test/pedidos.int.test.ts': '// teste\n',
    }
    for (const [arquivo, conteudo] of Object.entries(arquivos)) {
      mkdirSync(dirname(join(raiz, arquivo)), { recursive: true })
      writeFileSync(join(raiz, arquivo), conteudo)
    }
    return raiz
  }
  const texto = (...mutacoes: Mutacao[]) =>
    mutacoes
      .map((m) =>
        bloco(
          `arquivo: ${m.arquivo}`,
          `teste: ${m.teste}${m.caso ? ` › ${m.caso}` : ''}`,
          ...m.antes.map((linha, indice) => (m.depois[indice] === linha ? ` ${linha}` : `-${linha}`)),
          ...m.depois.filter((linha) => !m.antes.includes(linha)).map((linha) => `+${linha}`),
        ),
      )
      .join('\n\n')

  /** A web mutada cai no teste; a corrida de reconstrução (a última, com o fonte de volta) devolve o que o teste manda. */
  function conferir(raiz: string, conteudo: string, reconstrucao: boolean | 'estourou', aoRodar: (corrida: string) => void = () => undefined) {
    const avisos: string[] = []
    const corridas: string[] = []
    const resultado = conferirMutacoesDoDocumento(
      raiz,
      documento,
      conteudo,
      (comando) => {
        const tela = readFileSync(join(raiz, 'apps/web/src/Tela.tsx'), 'utf8')
        const mutada = !tela.includes('<Menu />') || !readFileSync(join(raiz, 'apps/api/src/pedidos.repository.ts'), 'utf8').includes('eq(pedidos.escolaId, escolaId),\n      eq(pedidos.id, id),')
        const rotulo = `${comando.includes('tools/ci/e2e.ts') ? 'e2e' : 'vitest'}${mutada ? ' mutado' : ''}`
        corridas.push(rotulo)
        aoRodar(rotulo)
        if (!mutada && comando.includes('tools/ci/e2e.ts') && corridas.filter((corrida) => corrida === 'e2e').length > 1) return reconstrucao
        return !mutada
      },
      (aviso) => avisos.push(aviso),
    )
    return { resultado, avisos, corridas }
  }

  it('documento sem bloco não tem carimbo nem corrida; bloco malformado é o vermelho, sem corrida', () => {
    const raiz = arvore()
    const semBloco = conferir(raiz, '## Mutações\n\nnenhuma\n', true)
    expect(semBloco.resultado).toEqual({})
    expect(semBloco.corridas).toEqual([])
    const malformado = conferir(raiz, bloco('arquivo: a.ts', '- x'), true)
    expect(malformado.resultado).toEqual({ vermelho: 'mutação 1: falta a linha "teste:"' })
    expect(malformado.corridas).toEqual([])
  })

  it('mutação que deixa o teste vermelho por erro de carga reprova o portão: sem carimbo', () => {
    const raiz = arvore()
    const avisos: string[] = []
    let corridas = 0
    const resultado = conferirMutacoesDoDocumento(
      raiz,
      documento,
      texto(deRepositorio),
      () => {
        corridas += 1
        return corridas === 1 ? true : 'carga'
      },
      (aviso) => avisos.push(aviso),
    )
    expect(resultado).toEqual({ vermelho: '1 de 1 mutações não deixaram o teste vermelho ou foram recusadas' })
    expect(avisos.join('')).toContain('erro de carga')
  })

  it('todas vermelhas e sem tela: o carimbo, sem reconstruir nada', () => {
    const raiz = arvore()
    const { resultado, corridas, avisos } = conferir(raiz, texto(deRepositorio), true)
    const { mutacoes } = lerMutacoes(texto(deRepositorio))
    expect(resultado).toEqual({ carimbo: { documento, impressao: impressaoDasMutacoes(mutacoes), total: 1 } })
    expect(corridas).toEqual(['vitest', 'vitest mutado'])
    expect(avisos.join('')).toContain(`▶ mutações de ${documento} (1)`)
  })

  it('a tela mutada é reconstruída do fonte de volta, e reconstruída é o carimbo', () => {
    const raiz = arvore()
    const { resultado, corridas } = conferir(raiz, texto(deTela), true)
    expect(resultado).toMatchObject({ carimbo: { documento, total: 1 } })
    // A limpa, a mutada e a reconstrução, com o fonte restaurado.
    expect(corridas).toEqual(['e2e', 'e2e mutado', 'e2e'])
    expect(readFileSync(join(raiz, 'apps/web/src/Tela.tsx'), 'utf8')).toBe(TELA)
  })

  it('a reconstrução que passa do teto deixa o portão vermelho, sem carimbo, dizendo o teto', () => {
    const raiz = arvore()
    const { resultado } = conferir(raiz, texto(deTela), 'estourou')
    expect(resultado).toEqual({ vermelho: 'a web não reconstruiu depois das mutações: a corrida passou do teto de 10 min' })
  })

  it('a reconstrução que cai deixa o portão vermelho, sem carimbo', () => {
    const raiz = arvore()
    expect(conferir(raiz, texto(deTela), false).resultado).toEqual({ vermelho: 'a web não reconstruiu depois das mutações' })
  })

  it('mutação que reprovou é o vermelho, e a web é reconstruída mesmo assim', () => {
    const raiz = arvore()
    const { resultado, corridas } = conferirComTesteVerde(raiz)
    expect(resultado).toEqual({ vermelho: '1 de 1 mutações não deixaram o teste vermelho ou foram recusadas' })
    // limpa, mutada (continuou verde) e a reconstrução.
    expect(corridas).toEqual(['e2e', 'e2e mutado', 'e2e'])
  })

  function conferirComTesteVerde(raiz: string) {
    const corridas: string[] = []
    const resultado = conferirMutacoesDoDocumento(
      raiz,
      documento,
      texto(deTela),
      (comando) => {
        const mutada = !readFileSync(join(raiz, 'apps/web/src/Tela.tsx'), 'utf8').includes('<Menu />')
        corridas.push(`${comando.includes('tools/ci/e2e.ts') ? 'e2e' : 'vitest'}${mutada ? ' mutado' : ''}`)
        // Verde em todas: a mutada não derruba o teste.
        return true
      },
      () => undefined,
    )
    return { resultado, corridas }
  }

  it('reconstruir: sem mutação de tela não roda nada, e só a corrida verdadeira é reconstrução', () => {
    const corridas: string[][] = []
    const com = (devolve: boolean | 'estourou', ...mutacoes: Mutacao[]) =>
      reconstruirDepoisDasMutacoes(mutacoes, (comando) => {
        corridas.push(comando)
        return devolve
      })
    expect(com(false, deRepositorio)).toBeNull()
    expect(corridas).toEqual([])
    expect(com(true, deRepositorio, deTela)).toBeNull()
    expect(com(false, deTela)).toBe('a web não reconstruiu depois das mutações')
    expect(com('estourou', deTela)).toMatch(/passou do teto de 10 min/)
    // A última mutação de tela é a que dá o comando da reconstrução.
    const outra: Mutacao = { ...deTela, caso: 'outro caso' }
    corridas.length = 0
    com(true, deTela, outra, deRepositorio)
    expect(corridas).toHaveLength(1)
    expect(corridas[0]).toContain('--grep=outro caso')
  })
})

describe('o relatório da corrida: só o caso que rodou e falhou prova a cláusula', () => {
  const RAIZ = fileURLToPath(new URL('../..', import.meta.url))
  // As pastas que os casos criam saem no fim de cada um, o symlink de `node_modules` junto (o `rmSync` não segue link).
  const criadas: string[] = []
  const temporaria = (prefixo: string): string => {
    const dir = mkdtempSync(join(tmpdir(), prefixo))
    criadas.push(dir)
    return dir
  }
  afterEach(() => {
    for (const dir of criadas.splice(0)) rmSync(dir, { recursive: true, force: true })
  })
  // As formas abaixo são as que o Vitest 5 e o Playwright 1.63 gravaram em 24/10/2026 (cortadas ao que a leitura usa).
  const vitest = (falhos: number, suitesFalhas: number, total = falhos) => JSON.stringify({ numTotalTests: total, numFailedTests: falhos, numFailedTestSuites: suitesFalhas, success: false })
  const playwright = (inesperados: number, erros: number) => JSON.stringify({ stats: { expected: 1, unexpected: inesperados, skipped: 0, flaky: 0 }, errors: Array.from({ length: erros }, () => ({ message: 'x' })) })

  describe('casoFalhouNoRelatorio', () => {
    it('vitest: um caso que falhou é a asserção; o arquivo que não carrega tem suite falha e nenhum caso', () => {
      expect(casoFalhouNoRelatorio('vitest', vitest(2, 1, 3))).toBe(true)
      // sintaxe e módulo que não existe: numFailedTests 0 e numFailedTestSuites 1
      expect(casoFalhouNoRelatorio('vitest', vitest(0, 1, 0))).toBe(false)
      // nenhum arquivo achado
      expect(casoFalhouNoRelatorio('vitest', vitest(0, 0, 0))).toBe(false)
    })

    it('playwright: caso inesperado é a asserção; a sintaxe tem errors preenchido e nenhum caso inesperado', () => {
      expect(casoFalhouNoRelatorio('playwright', playwright(1, 0))).toBe(true)
      expect(casoFalhouNoRelatorio('playwright', playwright(0, 2))).toBe(false)
      // um caso caiu e houve também erro global: o caso que caiu basta
      expect(casoFalhouNoRelatorio('playwright', playwright(1, 1))).toBe(true)
    })

    it('relatório que não existe, vazio, ilegível ou de outra forma não prova caso nenhum', () => {
      for (const leitor of ['vitest', 'playwright'] as const) {
        expect(casoFalhouNoRelatorio(leitor, null)).toBe(false)
        expect(casoFalhouNoRelatorio(leitor, '')).toBe(false)
        expect(casoFalhouNoRelatorio(leitor, '{"truncado')).toBe(false)
        expect(casoFalhouNoRelatorio(leitor, 'null')).toBe(false)
        expect(casoFalhouNoRelatorio(leitor, '[]')).toBe(false)
        expect(casoFalhouNoRelatorio(leitor, '{}')).toBe(false)
      }
      // a forma de um não vale no outro
      expect(casoFalhouNoRelatorio('vitest', playwright(1, 0))).toBe(false)
      expect(casoFalhouNoRelatorio('playwright', vitest(2, 1))).toBe(false)
      // contagem que não é número
      expect(casoFalhouNoRelatorio('vitest', '{"numFailedTests":"2"}')).toBe(false)
    })
  })

  describe('prepararRelatorio: o que cada corrida recebe para gravar o relatório', () => {
    it('vitest: o repórter json e o arquivo, depois de tudo o que o comando já tinha, inclusive o -t do caso', () => {
      const comando = ['npx', 'vitest', 'run', '--project', 'unidade', 'a.test.ts', '-t', 'o caso']
      expect(prepararRelatorio(comando, '/tmp/r.json')).toEqual({ comando: [...comando, '--reporter=json', '--outputFile=/tmp/r.json'], env: {}, leitor: 'vitest' })
    })

    it('playwright direto e e2e.ts: o comando não muda, o arquivo vai na variável que o playwright.config.ts já lê', () => {
      for (const comando of [['npx', 'playwright', 'test', 'e2e/a.spec.ts', '--project=chromebook'], ['node', 'tools/ci/e2e.ts', '--manter-ambiente', 'e2e/a.spec.ts', '--project=celular']]) {
        expect(prepararRelatorio(comando, '/tmp/r.json')).toEqual({ comando, env: { [VARIAVEL_DO_RELATORIO_DO_E2E]: '/tmp/r.json' }, leitor: 'playwright' })
      }
    })

    it('comando de outro programa não tem relatório: vale o código de saída', () => {
      expect(prepararRelatorio(['sh', '-c', 'exit 1'], '/tmp/r.json')).toBeNull()
      expect(prepararRelatorio(['npx', 'tsc'], '/tmp/r.json')).toBeNull()
    })

    it('todo comando que comandoDoTeste monta tem relatório', () => {
      const casos: Mutacao[] = [
        mutacao({ teste: 'a/b.test.ts', caso: 'um caso' }),
        mutacao({ teste: 'a/b.int.test.ts' }),
        mutacao({ teste: 'e2e/a.spec.ts', arquivo: 'e2e/__fixtures__/f.ts' }),
        mutacao({ teste: 'e2e/a.spec.ts', arquivo: 'apps/web/src/T.tsx', projeto: 'celular' }),
      ]
      for (const alvo of casos) expect(prepararRelatorio(comandoDoTeste(alvo) ?? [], '/tmp/r.json')).not.toBeNull()
    })
  })

  describe('rodarCalado lê o relatório de um teste que caiu', () => {
    /** O "teste" é um `sh` que grava o que o teste mandar no arquivo que a corrida pediu e sai com o código dado. */
    function corrida(script: string, leitor: 'vitest' | 'playwright' = 'vitest') {
      const arquivos: string[] = []
      const rodar = rodarCalado(temporaria('relatorio-'), {
        preparar: (comando, arquivo) => {
          arquivos.push(arquivo)
          return { comando, env: { RELATORIO: arquivo }, leitor }
        },
      })
      return { resultado: rodar(['sh', '-c', script], 30_000), arquivos }
    }

    it('saiu 1 com um caso que falhou no relatório: caiu (false); sem caso nenhum, ou sem relatório: carga', () => {
      expect(corrida(`printf '%s' '${vitest(1, 1)}' > "$RELATORIO"; exit 1`).resultado).toBe(false)
      expect(corrida(`printf '%s' '${vitest(0, 1, 0)}' > "$RELATORIO"; exit 1`).resultado).toBe('carga')
      expect(corrida('exit 1').resultado).toBe('carga')
      expect(corrida(`printf '%s' '${playwright(1, 0)}' > "$RELATORIO"; exit 1`, 'playwright').resultado).toBe(false)
      expect(corrida(`printf '%s' '${playwright(0, 2)}' > "$RELATORIO"; exit 1`, 'playwright').resultado).toBe('carga')
    })

    it('passou (0) é verdadeiro, qualquer que seja o relatório; e o prazo estourado segue sendo estourou', () => {
      expect(corrida(`printf '%s' '${vitest(0, 0, 0)}' > "$RELATORIO"; exit 0`).resultado).toBe(true)
      const rodar = rodarCalado(temporaria('relatorio-'), { preparar: (comando, arquivo) => ({ comando, env: { RELATORIO: arquivo }, leitor: 'vitest' }) })
      expect(rodar(['sh', '-c', 'sleep 30'], 500)).toBe('estourou')
    })

    it('a pasta do relatório não sobra depois da corrida', () => {
      const { arquivos } = corrida(`printf '%s' '${vitest(1, 1)}' > "$RELATORIO"; exit 1`)
      expect(arquivos).toHaveLength(1)
      expect(existsSync(dirname(arquivos[0] ?? ''))).toBe(false)
    })

    it('comando sem relatório: o código de saída decide, como antes', () => {
      const rodar = rodarCalado(temporaria('relatorio-'))
      expect(rodar(['sh', '-c', 'exit 3'], 30_000)).toBe(false)
      expect(rodar(['sh', '-c', 'exit 0'], 30_000)).toBe(true)
    })
  })

  describe('com o Vitest e o Playwright de verdade', () => {
    function pasta(arquivos: Record<string, string>): string {
      const dir = temporaria('relatorio-real-')
      for (const [nome, conteudo] of Object.entries(arquivos)) writeFileSync(join(dir, nome), conteudo)
      return dir
    }

    it('vitest: a asserção que falha cai; sintaxe, módulo que não existe e arquivo que não existe são carga', () => {
      const dir = pasta({
        'passa.test.ts': "it('passa', () => { expect(1).toBe(1) })\n",
        'asserta.test.ts': "it('passa', () => { expect(1).toBe(1) })\nit('cai', () => { expect(1).toBe(2) })\n",
        'sintaxe.test.ts': "it('x', () => { const = })\n",
        'modulo.test.ts': "import './nao-existe.ts'\nit('x', () => {})\n",
      })
      const rodar = rodarCalado(RAIZ)
      const comando = (arquivo: string) => ['npx', 'vitest', 'run', '--root', dir, '--globals', arquivo]
      expect(rodar(comando('passa.test.ts'))).toBe(true)
      expect(rodar(comando('asserta.test.ts'))).toBe(false)
      expect(rodar(comando('sintaxe.test.ts'))).toBe('carga')
      expect(rodar(comando('modulo.test.ts'))).toBe('carga')
      expect(rodar(comando('nao-existe.test.ts'))).toBe('carga')
    }, 120_000)

    it('playwright, com a configuração que lê a mesma variável do playwright.config.ts: asserção cai, sintaxe é carga', () => {
      const dir = pasta({
        'pw.config.ts': `import { relatoriosDoPlaywright } from ${JSON.stringify(join(RAIZ, 'tools/ci/duracao-do-e2e.ts'))}\nexport default { testDir: '.', reporter: relatoriosDoPlaywright(false, process.env[${JSON.stringify(VARIAVEL_DO_RELATORIO_DO_E2E)}]) }\n`,
        'passa.spec.ts': "import { test, expect } from '@playwright/test'\ntest('passa', () => { expect(1).toBe(1) })\n",
        'asserta.spec.ts': "import { test, expect } from '@playwright/test'\ntest('cai', () => { expect(1).toBe(2) })\n",
        'sintaxe.spec.ts': "import { test } from '@playwright/test'\ntest('x', () => { const = })\n",
      })
      symlinkSync(join(RAIZ, 'node_modules'), join(dir, 'node_modules'))
      const rodar = rodarCalado(RAIZ)
      const comando = (arquivo: string) => ['npx', 'playwright', 'test', '-c', join(dir, 'pw.config.ts'), join(dir, arquivo)]
      expect(rodar(comando('passa.spec.ts'))).toBe(true)
      expect(rodar(comando('asserta.spec.ts'))).toBe(false)
      expect(rodar(comando('sintaxe.spec.ts'))).toBe('carga')
    }, 120_000)
  })
})
