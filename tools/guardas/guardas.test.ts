import { ESLint, type Linter } from 'eslint'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, matchesGlob } from 'node:path'
import { describe, expect, it } from 'vitest'
import { raizRepositorio } from '../ci/executar.ts'
import { criarEslintDasGuardas, violacoesDasGuardas } from './eslint-das-guardas.ts'
import type { Supressoes } from './catraca.ts'
import { ARQUIVOS_DE_TESTE, EXCECOES_DAS_GUARDAS, REGRAS_DAS_GUARDAS, REGRAS_DE_ERRO, REGRAS_DE_LOG, REGRAS_DE_SDK_DE_IA, REGRAS_DE_TAMANHO, REGRAS_DE_TENANT, REGRAS_DE_TESTE, REGRAS_EM_TODO_ARQUIVO } from './index.mjs'
import { CHAVES_PESSOAIS, ehChaveOperacional, ehNomePessoal } from './regras-log.mjs'

// Cada fixture em __fixtures__ traz, na própria linha, a marca "reprova: <regra>". O teste passa
// a fixture pelo ESLint real do repositório, com um caminho simulado, e exige exatamente as
// marcas: nem guarda que deixa passar, nem guarda que acusa o jeito certo de logar.

const REGRA_DAS_DIRETIVAS = '@eslint-community/eslint-comments/no-restricted-disable'
const regrasObservadas = new Set<string>([...REGRAS_DAS_GUARDAS, REGRA_DAS_DIRETIVAS])

const eslint = new ESLint({ cwd: raizRepositorio })
const eslintDasGuardas = criarEslintDasGuardas()

function lerFixture(nome: string): string {
  return readFileSync(join(raizRepositorio, 'tools/guardas/__fixtures__', nome), 'utf8')
}

/** Marcas da fixture de violação, exigindo que existam: marca e regra apagadas juntas não passam. */
function marcasDeViolacao(fixture: string): string[] {
  const encontradas = marcas(lerFixture(fixture))
  expect(encontradas.length, `a fixture ${fixture} perdeu as marcas`).toBeGreaterThan(0)
  return encontradas
}

/** `"8 guardas/log-sem-dado-pessoal"`, uma entrada por marca, em ordem. */
function marcas(codigo: string): string[] {
  return codigo
    .split('\n')
    .flatMap((linha, indice) => {
      const marca = /reprova: ([^*]+?)\s*(?:\*\/)?$/.exec(linha)
      return marca?.[1] === undefined ? [] : marca[1].split(',').map((regra) => `${indice + 1} ${regra.trim()}`)
    })
    .sort()
}

/** As mensagens das `regras` (por padrão, as das guardas e a das diretivas) que o ESLint deu na fixture, no caminho simulado. */
async function lintar(motor: ESLint, fixture: string, caminhoSimulado: string, regras: ReadonlySet<string> = regrasObservadas): Promise<string[]> {
  const [resultado] = await motor.lintText(lerFixture(fixture), { filePath: join(raizRepositorio, caminhoSimulado) })
  if (resultado === undefined) throw new Error(`o ESLint não devolveu resultado para ${fixture}`)
  const fatais = resultado.messages.filter((mensagem: Linter.LintMessage) => mensagem.fatal === true)
  expect(fatais, `a fixture ${fixture} não compila`).toEqual([])
  return resultado.messages
    .filter((mensagem) => mensagem.ruleId !== null && regras.has(mensagem.ruleId))
    .map((mensagem) => `${mensagem.line} ${mensagem.ruleId}`)
    .sort()
}

/** Arquivos versionados ou prestes a ser, sem os ignorados pelo git. */
function arquivosDoRepositorio(): string[] {
  const resultado = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: raizRepositorio, encoding: 'utf8' })
  expect(resultado.status).toBe(0)
  return resultado.stdout.split('\n').filter(Boolean)
}

describe('processadores do worker: nenhuma afirmação de tipo (totais do expurgo, A0b)', () => {
  it('reprova `{} as T` e o `Partial<T>` afirmado no fim; o objeto literal tipado e o `as const` passam', async () => {
    const fixture = 'afirmacao-de-tipo-no-processador.ts'
    const regras = new Set(['@typescript-eslint/consistent-type-assertions'])
    expect(await lintar(eslint, fixture, 'apps/worker/src/processadores/x.ts', regras)).toEqual(marcasDeViolacao(fixture))
  })

  it('vale só nos processadores: fora deles, a mesma fixture passa (a regra não subiu para o repositório inteiro)', async () => {
    const regras = new Set(['@typescript-eslint/consistent-type-assertions'])
    for (const caminho of ['apps/api/src/sistema/x.ts', 'apps/worker/src/x.ts']) {
      expect(await lintar(eslint, 'afirmacao-de-tipo-no-processador.ts', caminho, regras), caminho).toEqual([])
    }
  })
})

describe('a entrada do controller passa pelo pipe (no-restricted-syntax, D81)', () => {
  /** Os módulos em que a requisição inteira também é barrada: todos os que têm controller e não leem cookie nem IP. */
  const MODULOS_SEM_REQUISICAO = ['sistema', 'ia', 'entrega', 'assistente', 'professores', 'estrutura', 'sala', 'governanca', 'atividade', 'artefato', 'material', 'tutor', 'privacidade']
  /** Os módulos que leem cookie, `Authorization` e IP da requisição (16.0): o `@Req()` passa, a entrada continua barrada. */
  const MODULOS_COM_REQUISICAO = ['sessao', 'operacao']
  const MODULOS_MIGRADOS = [...MODULOS_SEM_REQUISICAO, ...MODULOS_COM_REQUISICAO]
  const regras = new Set(['no-restricted-syntax'])

  it.each(MODULOS_SEM_REQUISICAO)('reprova @Body(), @Query(), @Param(), @Param(\'id\'), @Query(\'termo\'), @Req() e requisicao.body|query|params no controller de %s', async (modulo) => {
    const fixture = 'entrada-sem-esquema.ts'
    expect(await lintar(eslint, fixture, `apps/api/src/${modulo}/x.controller.ts`, regras)).toEqual(marcasDeViolacao(fixture))
  })

  it.each(MODULOS_COM_REQUISICAO)('no controller de %s o @Req() e o @Request() passam, e o corpo, a consulta, o caminho e requisicao.body|query|params continuam reprovados', async (modulo) => {
    const fixture = 'entrada-sem-esquema.ts'
    const linhas = lerFixture(fixture).split('\n')
    const comRequisicao = new Set(linhas.flatMap((linha, indice) => (/@(Req|Request)\(/.test(linha) ? [indice + 1] : []).map(String)))
    expect(comRequisicao.size, 'a fixture perdeu o @Req() ou o @Request()').toBe(2)
    const esperadas = marcasDeViolacao(fixture).filter((marca) => !comRequisicao.has(marca.split(' ')[0] ?? ''))
    expect(esperadas.length).toBeLessThan(marcasDeViolacao(fixture).length)
    expect(await lintar(eslint, fixture, `apps/api/src/${modulo}/x.controller.ts`, regras)).toEqual(esperadas)
  })

  it('o controller de um módulo que ainda não existe já nasce barrado: o files do bloco é o glob de todo controller, e não a lista de módulos', async () => {
    const fixture = 'entrada-sem-esquema.ts'
    expect(await lintar(eslint, fixture, 'apps/api/src/modulo-que-ainda-nao-existe/x.controller.ts', regras)).toEqual(marcasDeViolacao(fixture))
  })

  it('o controller em subpasta do módulo é barrado como o da raiz: sessao/login/x.controller.ts e operacao/escola/x.controller.ts (34.0)', async () => {
    const fixture = 'entrada-sem-esquema.ts'
    const linhas = lerFixture(fixture).split('\n')
    const comRequisicao = new Set(linhas.flatMap((linha, indice) => (/@(Req|Request)\(/.test(linha) ? [indice + 1] : []).map(String)))
    const semRequisicao = marcasDeViolacao(fixture).filter((marca) => !comRequisicao.has(marca.split(' ')[0] ?? ''))
    // O `@Req()` passa em `sessao/` e `operacao/`, a qualquer profundidade (o segundo bloco do `eslint.config.mjs`).
    for (const caminho of ['apps/api/src/sessao/login/x.controller.ts', 'apps/api/src/operacao/escola/x.controller.ts']) {
      expect(await lintar(eslint, fixture, caminho, regras), caminho).toEqual(semRequisicao)
    }
    // Em módulo que não lê a requisição, a subpasta barra tudo, inclusive o `@Req()` (o primeiro bloco, `apps/api/src/**`).
    expect(await lintar(eslint, fixture, 'apps/api/src/estrutura/turma/x.controller.ts', regras)).toEqual(marcasDeViolacao(fixture))
  })

  it('o jeito certo passa: o pipe no parâmetro, o IdPipe com e sem invalidAsUndefined, o errorCode, @UploadedFile() e @Res()', async () => {
    for (const modulo of MODULOS_MIGRADOS) {
      expect(await lintar(eslint, 'entrada-com-esquema.ts', `apps/api/src/${modulo}/x.controller.ts`, regras), modulo).toEqual([])
    }
  })

  it('vale só no controller: o mesmo arquivo como service, como teste do controller ou fora de apps/api/src, passa', async () => {
    for (const caminho of ['apps/api/src/ia/x.service.ts', 'apps/api/src/tutor/x.service.ts', 'apps/api/src/ia/x.controller.test.ts', 'apps/api/test/x.controller.ts']) {
      expect(await lintar(eslint, 'entrada-sem-esquema.ts', caminho, regras), caminho).toEqual([])
    }
  })

  it('o eslint-disable-next-line de uma violação só esconde essa violação do ESLint comum, e a passada sem comentários as reprova todas', async () => {
    const caminho = join(raizRepositorio, 'apps/api/src/ia/x.controller.ts')
    const linhas = lerFixture('entrada-sem-esquema.ts').split('\n')
    const escondida = linhas.findIndex((linha) => linha.includes('criar(@Body()'))
    expect(escondida, 'a fixture perdeu a linha de criar(@Body())').toBeGreaterThan(0)
    const texto = [...linhas.slice(0, escondida), '    // eslint-disable-next-line no-restricted-syntax', ...linhas.slice(escondida)].join('\n')
    const doRegra = (resultado: ESLint.LintResult | undefined) =>
      (resultado?.messages ?? []).filter((mensagem) => mensagem.ruleId === 'no-restricted-syntax').map((mensagem) => `${mensagem.line} no-restricted-syntax`).sort()
    const todas = marcas(texto)
    const [comum] = await eslint.lintText(texto, { filePath: caminho })
    expect(doRegra(comum)).toEqual(todas.filter((marca) => marca !== `${escondida + 2} no-restricted-syntax`))
    const [dasGuardas] = await eslintDasGuardas.lintText(texto, { filePath: caminho })
    expect(doRegra(dasGuardas)).toEqual(todas)
  })

  it('o eslint-disable não fura: o ESLint comum aceita o comentário, e a passada sem comentários do npm run lint reprova do mesmo jeito', async () => {
    const caminho = join(raizRepositorio, 'apps/api/src/ia/x.controller.ts')
    const comComentario = ['/* eslint-disable no-restricted-syntax */', lerFixture('entrada-sem-esquema.ts')].join('\n')
    const [comum] = await eslint.lintText(comComentario, { filePath: caminho })
    expect(comum?.messages.filter((mensagem) => mensagem.ruleId === 'no-restricted-syntax')).toEqual([])
    const [dasGuardas] = await eslintDasGuardas.lintText(comComentario, { filePath: caminho })
    const achadas = (dasGuardas?.messages ?? []).filter((mensagem) => mensagem.ruleId === 'no-restricted-syntax').map((mensagem) => `${mensagem.line} no-restricted-syntax`)
    expect(achadas.sort()).toEqual(marcas(comComentario))
  })
})

describe('o kit visual não importa api, áreas nem sessão (no-restricted-imports, D81, R56)', () => {
  const regras = new Set(['no-restricted-imports', 'no-restricted-syntax'])
  const NO_KIT = 'apps/web/src/componentes/ui/x.tsx'

  it('reprova import, import type, export … from e export *, e o import() também; o irmão, o formatar e o pacote passam', async () => {
    const fixture = 'kit-importa-api.ts'
    expect(await lintar(eslint, fixture, NO_KIT, regras)).toEqual(marcasDeViolacao(fixture))
  })

  it('vale em toda pasta do kit, e só nele: a mesma fixture em estado/, na tela e nos pacotes passa', async () => {
    const fixture = 'kit-importa-api.ts'
    for (const caminho of ['apps/web/src/componentes/ui/campos/x.tsx', 'apps/web/src/componentes/ui/ia/x.ts'])
      expect(await lintar(eslint, fixture, caminho, regras), caminho).toEqual(marcasDeViolacao(fixture))
    for (const caminho of ['apps/web/src/componentes/estado/x.tsx', 'apps/web/src/componentes/x.tsx', 'apps/web/src/areas/professor/x.tsx', 'apps/web/src/api/x.ts'])
      expect(await lintar(eslint, fixture, caminho, regras), caminho).toEqual([])
  })

  it('o eslint-disable-next-line de um import só o esconde do ESLint comum, e a passada sem comentários o reprova', async () => {
    const caminho = join(raizRepositorio, NO_KIT)
    const linhas = lerFixture('kit-importa-api.ts').split('\n')
    const escondida = linhas.findIndex((linha) => linha.includes('{ clienteDaApi }'))
    expect(escondida, 'a fixture perdeu a linha do clienteDaApi').toBeGreaterThan(0)
    const texto = [...linhas.slice(0, escondida), '// eslint-disable-next-line no-restricted-imports', ...linhas.slice(escondida)].join('\n')
    const doKit = (resultado: ESLint.LintResult | undefined) =>
      (resultado?.messages ?? []).filter((mensagem) => mensagem.ruleId === 'no-restricted-imports').map((mensagem) => `${mensagem.line} no-restricted-imports`).sort()
    const todas = marcas(texto).filter((marca) => marca.endsWith('no-restricted-imports'))
    const [comum] = await eslint.lintText(texto, { filePath: caminho })
    expect(doKit(comum)).toEqual(todas.filter((marca) => marca !== `${escondida + 2} no-restricted-imports`))
    const [dasGuardas] = await eslintDasGuardas.lintText(texto, { filePath: caminho })
    expect(doKit(dasGuardas)).toEqual(todas)
  })

  it('o eslint-disable-next-line de uma importação dinâmica só a esconde do ESLint comum, e a passada sem comentários a reprova', async () => {
    const caminho = join(raizRepositorio, NO_KIT)
    const linhas = lerFixture('kit-importa-api.ts').split('\n')
    const escondida = linhas.findIndex((linha) => linha.includes("import('../../../api/cliente')"))
    expect(escondida, 'a fixture perdeu a linha do import() de api/').toBeGreaterThan(0)
    const texto = [...linhas.slice(0, escondida), '// eslint-disable-next-line no-restricted-syntax', ...linhas.slice(escondida)].join('\n')
    const doImport = (resultado: ESLint.LintResult | undefined) =>
      (resultado?.messages ?? []).filter((mensagem) => mensagem.ruleId === 'no-restricted-syntax').map((mensagem) => `${mensagem.line} no-restricted-syntax`).sort()
    const todas = marcas(texto).filter((marca) => marca.endsWith('no-restricted-syntax'))
    expect(todas, 'a fixture tem um import() de api/, de areas/ e de sessao/').toHaveLength(3)
    const [comum] = await eslint.lintText(texto, { filePath: caminho })
    expect(doImport(comum)).toEqual(todas.filter((marca) => marca !== `${escondida + 2} no-restricted-syntax`))
    const [dasGuardas] = await eslintDasGuardas.lintText(texto, { filePath: caminho })
    expect(doImport(dasGuardas)).toEqual(todas)
  })
})

describe('guarda de espera do serviço do compose', () => {
  it('reprova subir serviço e medir sem esperar, e deixa passar quem espera ou usa --wait', async () => {
    expect(await lintar(eslint, 'esperar-servico.ts', 'apps/despachante/test/fila.int.test.ts')).toEqual(marcasDeViolacao('esperar-servico.ts'))
  })

  it('não vale fora de teste: cenário de carga derruba e religa serviço de propósito', async () => {
    expect(await lintar(eslint, 'esperar-servico.ts', 'infra/scripts/carga-login.ts')).toEqual([])
  })

  it('fica ligada como erro em teste, e desligada fora dele', async () => {
    const configuracaoDe = async (caminho: string) =>
      (await eslint.calculateConfigForFile(join(raizRepositorio, caminho))) as { rules: Record<string, [number, ...unknown[]]> }
    for (const regra of REGRAS_DE_TESTE) {
      expect((await configuracaoDe('apps/despachante/test/fila.int.test.ts')).rules[regra]?.[0], `${regra} em teste`).toBe(2)
      expect((await configuracaoDe('e2e/entrar.spec.ts')).rules[regra]?.[0], `${regra} em e2e`).toBe(2)
      expect((await configuracaoDe('apps/api/src/main.ts')).rules[regra]?.[0] ?? 0, `${regra} fora de teste`).toBe(0)
    }
  })
})

describe('guarda do teste desligado', () => {
  it.each(['apps/api/test/correcao.int.test.ts', 'apps/web/src/componentes/tela.test.tsx', 'e2e/entrar.spec.ts'])(
    'reprova .skip, .only, .fixme, .todo, .skipIf e .runIf em %s, em qualquer ponto da cadeia, e deixa passar o teste que roda',
    async (caminho) => {
      expect(await lintar(eslint, 'teste-desligado.ts', caminho)).toEqual(marcasDeViolacao('teste-desligado.ts'))
    },
  )

  it('não vale fora de teste: `skip` e `only` são nomes comuns de método', async () => {
    expect(await lintar(eslint, 'teste-desligado.ts', 'apps/api/src/fila/paginacao.ts')).toEqual([])
  })
})

describe('guarda de log com dado pessoal', () => {
  it.each([
    'apps/api/src/sistema/correcao.service.ts',
    'packages/core/src/ia/openai-compat-adapter.ts',
    'apps/api/test/correcao.int.test.ts',
    'apps/web/src/logica.ts',
    'packages/core/src/queue/worker.ts',
    'tools/ci/etapa.ts',
  ])('reprova dado pessoal em qualquer nível e forma de expressão, objeto inteiro e toda forma de chamar o logger, em %s', async (caminho) => {
    expect(await lintar(eslint, 'log-dado-pessoal.ts', caminho)).toEqual(marcasDeViolacao('log-dado-pessoal.ts'))
  })

  it('reprova spread, template, concatenação, interpolação, JSON.stringify, função, mensagem variável e logger desestruturado', async () => {
    const obtidas = await lintar(eslint, 'log-conteudo-montado.ts', 'packages/core/src/queue/despachante.ts')
    expect(obtidas).toEqual(marcasDeViolacao('log-conteudo-montado.ts'))
  })

  it('deixa passar o log com evento fixo, ids, durações, contagem de tokens e erro', async () => {
    expect(marcas(lerFixture('log-permitido.ts'))).toEqual([])
    expect(await lintar(eslint, 'log-permitido.ts', 'apps/api/src/sistema/correcao.service.ts')).toEqual([])
  })

  it.each([
    ['nome', true],
    ['nomeDoAluno', true],
    ['NOME_ALUNO', true],
    ['emailsDoResponsavel', true],
    ['conteudoDaMensagem', true],
    ['notaId', false],
    ['notaIds', false],
    ['promptTokens', false],
    ['respostaStatus', false],
    ['promptVersao', false],
    ['anotacao', false],
    ['evento', false],
    // Decisão: reprovam, mesmo sem ser de pessoa. O nome certo no log é `fila`, `escolaId`,
    // `promptVersao`; nota máxima é configuração, não vai para log.
    ['nomeDaFila', true],
    ['nomeDaEscola', true],
    ['versaoDoPrompt', true],
    ['notaMaxima', true],
  ])('%s é nome pessoal: %s', (nome, esperado) => {
    expect(ehNomePessoal(nome)).toBe(esperado)
  })

  it.each([
    ['evento', true],
    ['alunoId', true],
    ['duracaoMs', true],
    ['criadoEm', true],
    ['promptTokens', true],
    ['aluno', false],
    ['dados', false],
    ['detalhe', false],
    ['notaEm', false],
  ])('%s aceita valor calculado no log: %s', (chave, esperado) => {
    expect(ehChaveOperacional(chave)).toBe(esperado)
  })

  it('a guarda conhece as mesmas chaves que o redact do logger remove', async () => {
    // Import por variável: o tsconfig de tools não compila o código do núcleo, só o Vitest o carrega.
    // O prazo de 60 s é deste import: o índice do núcleo puxa o banco, a fila e o storage, e a primeira transformação,
    // com a máquina cheia de outros arquivos da unidade, passa dos 5 s do Vitest.
    const nucleo = '@educa/core'
    const { CHAVES_PESSOAIS: chavesDoRedact } = (await import(nucleo)) as { CHAVES_PESSOAIS: readonly string[] }
    expect([...CHAVES_PESSOAIS].sort()).toEqual([...chavesDoRedact].sort())
  }, 60_000)
})

describe('guarda de SDK de provedor de IA', () => {
  it.each([
    'apps/api/src/sistema/modelo.ts',
    'apps/api/src/ia/porta.ts',
    'apps/api/src/ia/adapters.ts',
    'apps/api/src/ia/adapters/x.ts',
    'apps/web/src/modelo.ts',
    'packages/core/src/modelo.ts',
    'packages/core/src/ia/port.ts',
    'packages/core/src/ia/adapter.ts',
  ])('reprova import, alias, subcaminho, export, require, import() e typeof import() em %s', async (caminho) => {
    expect(await lintar(eslint, 'sdk-de-ia.ts', caminho)).toEqual(marcasDeViolacao('sdk-de-ia.ts'))
  })

  it.each(['packages/core/src/ia/openai-compat-adapter.ts', 'packages/core/src/ia/fake-adapter.ts'])(
    'deixa o mesmo código passar dentro dos adaptadores: %s',
    async (caminho) => {
      expect(await lintar(eslint, 'sdk-de-ia.ts', caminho)).toEqual([])
    },
  )
})

describe('guarda de tabela fora do repository (regra 00, item 3; regra 10, item 3)', () => {
  const FIXTURE = 'tabela-fora-do-repository.ts'
  const REGRA = 'guardas/tabela-so-no-repository'
  const regras = new Set([REGRA])

  it.each([
    'apps/api/src/x/x.service.ts',
    'apps/api/src/x/x.controller.ts',
    'apps/worker/src/x.ts',
    'packages/core/src/x/x.service.ts',
    'infra/scripts/x.ts',
    'tools/x.ts',
  ])('reprova trazer do núcleo a tabela, o schema, o módulo inteiro e o texto do pacote em %s', async (caminho) => {
    expect(await lintar(eslint, FIXTURE, caminho, regras)).toEqual(marcasDeViolacao(FIXTURE))
  })

  it.each([
    'apps/api/src/x/x.repository.ts',
    'packages/core/src/titular/x.repository.ts',
    'apps/api/src/x/x.int.test.ts',
    'apps/web/src/x.test.ts',
    'e2e/x.spec.ts',
    'packages/core/src/db/schema/x.ts',
    'packages/core/src/db/database.ts',
  ])('deixa a mesma fixture passar onde a tabela mora: %s', async (caminho) => {
    expect(await lintar(eslint, FIXTURE, caminho, regras)).toEqual([])
  })

  // A fixture tem a afirmação `<string>x`, que um .tsx não compila: o teste de .tsx confere a exceção com código próprio.
  it('deixa passar a tabela num teste .tsx, onde a fixture não compila, e reprova no componente .tsx', async () => {
    const codigo = "import { escola } from '@educa/core'\nexport const x = escola\n"
    const de = async (caminho: string) => {
      const [resultado] = await eslint.lintText(codigo, { filePath: join(raizRepositorio, caminho) })
      return (resultado?.messages ?? []).filter((mensagem) => mensagem.ruleId === REGRA).map((mensagem) => mensagem.line)
    }
    expect(await de('apps/web/src/x.test.tsx')).toEqual([])
    expect(await de('apps/web/src/x.tsx')).toEqual([1])
  })

  it('o eslint-disable do arquivo inteiro não fura: o ESLint comum aceita o comentário, e a passada sem comentários do npm run lint reprova do mesmo jeito', async () => {
    const caminho = join(raizRepositorio, 'apps/api/src/x/x.service.ts')
    const comComentario = [`/* eslint-disable ${REGRA} */`, lerFixture(FIXTURE)].join('\n')
    const [comum] = await eslint.lintText(comComentario, { filePath: caminho })
    expect(comum?.messages.filter((mensagem) => mensagem.ruleId === REGRA)).toEqual([])
    expect(comum?.messages.some((mensagem) => mensagem.ruleId === REGRA_DAS_DIRETIVAS), 'o ESLint comum deixou de reprovar a diretiva').toBe(true)
    const [dasGuardas] = await eslintDasGuardas.lintText(comComentario, { filePath: caminho })
    const achadas = (dasGuardas?.messages ?? []).filter((mensagem) => mensagem.ruleId === REGRA).map((mensagem) => `${mensagem.line} ${REGRA}`)
    expect(achadas.sort()).toEqual(marcas(comComentario))
  })

  it('o eslint-disable-next-line de um import só o esconde do ESLint comum, e a passada sem comentários o reprova', async () => {
    const caminho = join(raizRepositorio, 'apps/api/src/x/x.service.ts')
    const linhas = lerFixture(FIXTURE).split('\n')
    const escondida = linhas.findIndex((linha) => linha.startsWith("import { escola } from '@educa/core'"))
    expect(escondida, 'a fixture perdeu a linha do import de escola').toBeGreaterThan(0)
    const texto = [...linhas.slice(0, escondida), `// eslint-disable-next-line ${REGRA}`, ...linhas.slice(escondida)].join('\n')
    const doRegra = (resultado: ESLint.LintResult | undefined) =>
      (resultado?.messages ?? []).filter((mensagem) => mensagem.ruleId === REGRA).map((mensagem) => `${mensagem.line} ${REGRA}`).sort()
    const todas = marcas(texto)
    const [comum] = await eslint.lintText(texto, { filePath: caminho })
    expect(doRegra(comum)).toEqual(todas.filter((marca) => marca !== `${escondida + 2} ${REGRA}`))
    const [dasGuardas] = await eslintDasGuardas.lintText(texto, { filePath: caminho })
    expect(doRegra(dasGuardas)).toEqual(todas)
  })

  it('o repositório de hoje não tem violação: nenhum arquivo fora de *.repository.ts, de teste e de db/ importa tabela do núcleo', async () => {
    const importam = arquivosDoRepositorio()
      .filter((arquivo) => /\.(?:[cm]?[jt]s|[jt]sx)$/.test(arquivo) && !arquivo.startsWith('tools/guardas/__fixtures__/') && !arquivo.startsWith('mockups/'))
      .filter((arquivo) => readFileSync(join(raizRepositorio, arquivo), 'utf8').includes('@educa/core'))
    expect(importam.length, 'a varredura não achou os arquivos que importam o núcleo').toBeGreaterThan(50)
    const resultados = await eslintDasGuardas.lintFiles(importam.map((arquivo) => join(raizRepositorio, arquivo)))
    const violacoes = violacoesDasGuardas(resultados).flatMap((resultado) =>
      resultado.messages.filter((mensagem) => mensagem.ruleId === REGRA).map((mensagem) => `${resultado.filePath.replace(`${raizRepositorio}`, '')}:${mensagem.line}`),
    )
    expect(violacoes).toEqual([])
  }, 120_000)
})

describe('guarda de erro tipado (RF13; regra 00, item 9; regra 20, item 11)', () => {
  const FIXTURE = 'erro-sem-tipo.ts'
  const regras = new Set(['guardas/erro-tipado'])

  it.each([
    'apps/api/src/x/x.service.ts',
    'apps/worker/src/x.ts',
    'apps/realtime/src/x.ts',
    'apps/despachante/src/x.ts',
    'apps/web/src/x.ts',
    'packages/core/src/x/x.ts',
  ])('reprova Error genérico, texto e literal lançados e o motivo do ErroDeInvariante que não é texto fixo, em %s', async (caminho) => {
    expect(await lintar(eslint, FIXTURE, caminho, regras)).toEqual(marcasDeViolacao(FIXTURE))
  })

  it('reprova `throw new Error(…)`, `throw Error(…)` e o `globalThis.Error`: o atalho sem `new` não escapa', async () => {
    const dos = (trecho: string) => marcasDeViolacao(FIXTURE).filter((marca) => lerFixture(FIXTURE).split('\n')[Number(marca.split(' ')[0]) - 1]?.includes(trecho))
    expect(dos('throw Error(').length, 'a fixture perdeu o `throw Error(`').toBe(1)
    expect(dos('globalThis.Error').length, 'a fixture perdeu o `globalThis.Error`').toBe(1)
    expect(await lintar(eslint, FIXTURE, 'apps/api/src/x.ts', regras)).toEqual(expect.arrayContaining(dos('throw Error(')))
  })

  it('o jeito certo passa: ErroDeInvariante com texto fixo, ErroDeDominio, classe do módulo, relançamento e subclasse com campo', async () => {
    expect(marcas(lerFixture('erro-tipado-permitido.ts'))).toEqual([])
    for (const caminho of ['apps/api/src/x.ts', 'packages/core/src/x.ts']) {
      expect(await lintar(eslint, 'erro-tipado-permitido.ts', caminho, regras), caminho).toEqual([])
    }
  })

  it.each([
    'apps/api/src/x/x.test.ts',
    'apps/api/src/x/x.int.test.ts',
    'apps/web/src/x.test.tsx',
    'packages/core/src/x/x.test.ts',
    'apps/web/src/__fixtures__/tela.ts',
    'packages/core/src/ia/__fixtures__/inputs.ts',
  ])('em teste e em __fixtures__ a mesma fixture passa: %s', async (caminho) => {
    expect(await lintar(eslint, FIXTURE, caminho, regras)).toEqual([])
  })

  it('a exceção única é o main.tsx da web: nele passa, e em qualquer outro arquivo da web reprova', async () => {
    expect(await lintar(eslint, FIXTURE, 'apps/web/src/main.tsx', regras)).toEqual([])
    expect(await lintar(eslint, FIXTURE, 'apps/web/src/rotas.tsx', regras)).toEqual(marcasDeViolacao(FIXTURE))
  })

  it.each(['apps/api/test/x.ts', 'e2e/x.spec.ts', 'tools/ci/x.ts', 'infra/scripts/x.ts', 'packages/shared/src/x.ts'])(
    'fora de apps/*/src e de packages/nucleo/src a regra não vale: %s',
    async (caminho) => {
      expect(await lintar(eslint, FIXTURE, caminho, regras)).toEqual([])
    },
  )

  it('o eslint-disable não fura: o ESLint comum aceita o comentário e reprova a diretiva, e a passada sem comentários reprova o throw', async () => {
    const fixture = 'erro-sem-tipo-desligado.ts'
    const diretivas = new Set(['@eslint-community/eslint-comments/no-restricted-disable', 'guardas/erro-tipado'])
    expect(await lintar(eslint, fixture, 'apps/api/src/x.ts', diretivas)).toEqual(marcasDeViolacao(fixture))
    expect(await lintar(eslintDasGuardas, fixture, 'apps/api/src/x.ts', regras)).toEqual(['4 guardas/erro-tipado'])
  })

  it('o repositório de hoje não tem violação: nenhum arquivo de produção lança Error genérico ou literal', async () => {
    const eslintDoRepositorio = criarEslintDasGuardas()
    const resultados = await eslintDoRepositorio.lintFiles(['apps/*/src/**/*.{ts,tsx}', 'packages/core/src/**/*.{ts,tsx}'])
    const violacoes = resultados.flatMap((resultado) => resultado.messages.filter((mensagem) => mensagem.ruleId === 'guardas/erro-tipado').map((mensagem) => `${resultado.filePath}:${mensagem.line}`))
    expect(violacoes).toEqual([])
  }, 120_000)
})

describe('guarda desligada por comentário', () => {
  it.each(['desabilitar-na-linha.ts', 'desabilitar-tudo.ts'])(
    'o ESLint reprova a diretiva que desliga uma guarda: %s',
    async (fixture) => {
      expect(await lintar(eslint, fixture, 'apps/api/src/sistema/x.ts')).toEqual(marcasDeViolacao(fixture))
    },
  )

  it.each([
    ['desabilitar-na-linha.ts', ['7 guardas/log-sem-dado-pessoal', '8 guardas/log-sem-dado-pessoal', '10 @typescript-eslint/no-restricted-imports']],
    ['desabilitar-tudo.ts', ['6 guardas/log-sem-dado-pessoal']],
    ['desabilitar-a-propria-vigia.ts', ['7 guardas/log-sem-dado-pessoal']],
    ['configurar-por-comentario.ts', ['7 guardas/log-sem-dado-pessoal']],
  ])('a passada sem comentários do npm run lint ainda pega a violação: %s', async (fixture, esperadas) => {
    expect(await lintar(eslintDasGuardas, fixture, 'apps/api/src/sistema/x.ts')).toEqual([...esperadas].sort())
  })

  it.each([
    ['desabilitar-a-propria-vigia.ts', 1],
    ['configurar-por-comentario.ts', 1],
    ['log-permitido.ts', 0],
  ])('o script da passada sem comentários sai com código de falha quando há violação: %s', (fixture, codigoEsperado) => {
    const resultado = spawnSync(process.execPath, ['tools/guardas/lint.ts', '--texto', 'apps/api/src/sistema/x.ts'], {
      cwd: raizRepositorio,
      input: lerFixture(fixture),
      encoding: 'utf8',
    })
    expect(resultado.status, resultado.stdout + resultado.stderr).toBe(codigoEsperado)
    if (codigoEsperado === 1) expect(resultado.stdout).toContain('guardas/log-sem-dado-pessoal')
  })

  it('o relatório da passada só conta violação de guarda, não aviso de diretiva ignorada nem outra regra', () => {
    const mensagem = (ruleId: string | null): Linter.LintMessage => ({ ruleId, message: 'x', line: 1, column: 1, severity: 2 })
    const resultado = {
      filePath: 'x.ts',
      messages: [mensagem(null), mensagem('no-console'), mensagem('guardas/log-sem-dado-pessoal')],
      suppressedMessages: [],
      errorCount: 3,
      fatalErrorCount: 0,
      warningCount: 0,
      fixableErrorCount: 0,
      fixableWarningCount: 0,
      usedDeprecatedRules: [],
    } satisfies ESLint.LintResult
    const limpo = { ...resultado, messages: [mensagem('no-console')] }
    const violacoes = violacoesDasGuardas([resultado, limpo])
    expect(violacoes).toHaveLength(1)
    expect(violacoes[0]?.messages.map((item) => item.ruleId)).toEqual(['guardas/log-sem-dado-pessoal'])
  })

  it('npm run lint roda a passada sem comentários depois do ESLint, e falha se qualquer uma falhar', () => {
    const { scripts } = JSON.parse(readFileSync(join(raizRepositorio, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
    // A guarda de camadas vem depois das duas (X5, 12.0): o comando inteiro é fixado em `camadas.test.ts › guarda:camadas é o comando…`.
    expect(scripts['lint']).toMatch(/^eslint \. --max-warnings=0 && node tools\/guardas\/lint\.ts( && .+)?$/)
  })
})

describe('tamanho com catraca (RF11, R37)', () => {
  const regras = new Set<string>(REGRAS_DE_TAMANHO)
  const PRODUCAO = 'apps/api/src/x/x.service.ts'
  const EM_PRODUCAO = [PRODUCAO, 'apps/web/src/x.tsx', 'apps/worker/src/x.ts', 'packages/core/src/x.ts', 'infra/scripts/x.ts', 'tools/x.ts']
  const EM_TESTE = ['apps/api/src/x.test.ts', 'apps/api/src/x.int.test.ts', 'apps/web/src/x.test.tsx', 'apps/api/test/x.ts', 'e2e/x.spec.ts', 'e2e/__fixtures__/x.ts']
  const FIXTURES = ['tamanho/complexidade.ts', 'tamanho/linhas.ts', 'tamanho/aninhamento.ts']
  const umaPorLinha = (quantidade: number): string => Array.from({ length: quantidade }, (_, i) => `export const v${i} = ${i}`).join('\n')
  const dasRegras = (resultado: ESLint.LintResult | undefined, regra: string): string[] =>
    (resultado?.messages ?? []).filter((mensagem) => mensagem.ruleId === regra).map((mensagem) => `${mensagem.line} ${regra}`).sort()
  const configuracaoDe = async (caminho: string) =>
    (await eslint.calculateConfigForFile(join(raizRepositorio, caminho))) as { rules: Record<string, [number, ...unknown[]] | undefined> }

  it.each(FIXTURES.flatMap((fixture) => EM_PRODUCAO.map((caminho) => [fixture, caminho] as const)))(
    'na produção, a fronteira reprova só o que passa do limite: complexidade 11, 81 linhas de código (brancos e comentários não contam) e aninhamento 5: %s em %s',
    async (fixture, caminho) => {
      expect(await lintar(eslint, fixture, caminho, regras)).toEqual(marcasDeViolacao(fixture))
    },
  )

  it.each(['tools/x.js', 'tools/guardas/x.mjs', 'infra/x.cjs', 'tools/x.mts', 'tools/x.cts', 'apps/web/src/x.jsx'])('o limite de complexidade vale também no JavaScript: %s', async (caminho) => {
    const ifs = (quantidade: number) => Array.from({ length: quantidade }, (_, i) => `  if (n === ${i}) r += 1`).join('\n')
    const funcao = (quantidade: number) => `function f(n) {\n  let r = 0\n${ifs(quantidade)}\n  return r\n}\n`
    const complexidade = async (texto: string) => dasRegras((await eslint.lintText(texto, { filePath: join(raizRepositorio, caminho) }))[0], 'complexity')
    expect(await complexidade(funcao(9))).toEqual([])
    expect(await complexidade(funcao(10))).toEqual(['1 complexity'])
  })

  it.each(EM_TESTE)('em teste (%s) o limite de linhas da função não vale (R39): a função de 81 linhas passa', async (caminho) => {
    expect(marcasDeViolacao('tamanho/linhas.ts')).toHaveLength(1)
    expect(await lintar(eslint, 'tamanho/linhas.ts', caminho, regras)).toEqual([])
  })

  it.each(['tamanho/complexidade.ts', 'tamanho/aninhamento.ts'])('em teste a complexidade e o aninhamento valem como na produção: %s', async (fixture) => {
    for (const caminho of EM_TESTE) expect(await lintar(eslint, fixture, caminho, regras), caminho).toEqual(marcasDeViolacao(fixture))
  })

  it('o e2e tem o teto de 800 linhas por spec: 800 passa e 801 reprova, e só o spec do e2e tem o teto', async () => {
    const maxLines = async (texto: string, caminho: string) => dasRegras((await eslint.lintText(texto, { filePath: join(raizRepositorio, caminho) }))[0], 'max-lines')
    expect(await maxLines(umaPorLinha(800), 'e2e/x.spec.ts')).toEqual([])
    expect(await maxLines(umaPorLinha(801), 'e2e/x.spec.ts')).toEqual(['801 max-lines'])
    for (const caminho of ['e2e/__fixtures__/x.ts', 'apps/api/src/x.ts', 'apps/api/src/x.test.ts']) expect(await maxLines(umaPorLinha(801), caminho), caminho).toEqual([])
  })

  /** O nível de cada regra por caminho: 2 é `error`, 0 é desligada. */
  const NIVEIS: [string, string, number][] = [
    ...['apps/api/src/main.ts', 'apps/web/src/paginas/Casca.tsx', 'tools/ci/verificar.ts'].flatMap((caminho): [string, string, number][] => [
      [caminho, 'complexity', 2],
      [caminho, 'max-depth', 2],
      [caminho, 'max-lines-per-function', 2],
      [caminho, 'max-lines', 0],
    ]),
    ...['apps/api/src/x.test.ts', 'e2e/entrar.spec.ts'].flatMap((caminho): [string, string, number][] => [
      [caminho, 'complexity', 2],
      [caminho, 'max-depth', 2],
      [caminho, 'max-lines-per-function', 0],
    ]),
    ['e2e/entrar.spec.ts', 'max-lines', 2],
    ['apps/api/src/x.test.ts', 'max-lines', 0],
  ]

  it.each(NIVEIS)('o nível em %s de %s é %s (2 é error, 0 desligada): as quatro estão em error onde valem', async (caminho, regra, nivel) => {
    expect((await configuracaoDe(caminho)).rules[regra]?.[0] ?? 0).toBe(nivel)
  })

  it.each([
    ['complexity', 'tamanho/complexidade.ts'],
    ['max-lines-per-function', 'tamanho/linhas.ts'],
    ['max-depth', 'tamanho/aninhamento.ts'],
  ])('o eslint-disable-next-line de %s só esconde a violação do ESLint comum, e a passada sem comentários a reprova', async (regra, fixture) => {
    const caminho = join(raizRepositorio, PRODUCAO)
    const linhas = lerFixture(fixture).split('\n')
    const marcada = linhas.findIndex((linha) => linha.includes(`reprova: ${regra}`))
    expect(marcada, `a fixture ${fixture} perdeu a marca de ${regra}`).toBeGreaterThan(0)
    const texto = [...linhas.slice(0, marcada), `// eslint-disable-next-line ${regra}`, ...linhas.slice(marcada)].join('\n')
    const todas = marcas(texto)
    expect(todas).toHaveLength(1)
    expect(dasRegras((await eslint.lintText(texto, { filePath: caminho }))[0], regra)).toEqual([])
    expect(dasRegras((await eslintDasGuardas.lintText(texto, { filePath: caminho }))[0], regra)).toEqual(todas)
  })

  it('o eslint-disable do arquivo inteiro não esconde o teto de linhas do spec do e2e na passada sem comentários', async () => {
    const caminho = join(raizRepositorio, 'e2e/x.spec.ts')
    const texto = `/* eslint-disable max-lines */\n${umaPorLinha(801)}`
    expect(dasRegras((await eslint.lintText(texto, { filePath: caminho }))[0], 'max-lines')).toEqual([])
    expect(dasRegras((await eslintDasGuardas.lintText(texto, { filePath: caminho }))[0], 'max-lines')).toEqual(['801 max-lines'])
  })

  it.each([
    ['complexity', 'tamanho/complexidade.ts', '["error", 99]'],
    ['max-lines-per-function', 'tamanho/linhas.ts', '["error", 999]'],
    ['max-depth', 'tamanho/aninhamento.ts', '["error", 9]'],
  ])('/* eslint %s: %s */ afrouxa o ESLint comum, e a passada sem comentários mantém o limite', async (regra, fixture, configuracao) => {
    const caminho = join(raizRepositorio, PRODUCAO)
    const texto = [`/* eslint ${regra}: ${configuracao} */`, lerFixture(fixture)].join('\n')
    expect(dasRegras((await eslint.lintText(texto, { filePath: caminho }))[0], regra)).toEqual([])
    expect(dasRegras((await eslintDasGuardas.lintText(texto, { filePath: caminho }))[0], regra)).toEqual(marcas(texto))
  })

  /** A primeira regra suprimida do primeiro arquivo da linha de base: um caso real, que acompanha o corte. */
  function primeiraSupressao(): { arquivo: string; regra: string } {
    const base = JSON.parse(readFileSync(join(raizRepositorio, 'eslint-suppressions.json'), 'utf8')) as Supressoes
    const [arquivo, regrasDoArquivo] = Object.entries(base)[0] ?? ['', {}]
    const regra = Object.keys(regrasDoArquivo)[0] ?? ''
    expect(arquivo !== '' && regra !== '', 'a linha de base esvaziou: o corte acabou, e esta conferência e a catraca saem junto').toBe(true)
    return { arquivo, regra }
  }

  it('a função da linha de base passa na passada sem comentários, que aplica as supressões; sem elas, a mesma passada a reprova', async () => {
    const { arquivo, regra } = primeiraSupressao()
    const caminho = join(raizRepositorio, arquivo)
    const semSupressoes = new ESLint({ cwd: raizRepositorio, overrideConfigFile: join(raizRepositorio, 'eslint.config.mjs'), allowInlineConfig: false, ruleFilter: ({ ruleId }) => ruleId === regra })
    expect(dasRegras((await semSupressoes.lintFiles([caminho]))[0], regra).length, 'o arquivo da linha de base deixou de violar a regra: rode eslint . --prune-suppressions').toBeGreaterThan(0)
    expect(dasRegras((await eslintDasGuardas.lintFiles([caminho]))[0], regra)).toEqual([])
  })
})

describe('configuração das guardas', () => {
  it('as únicas exceções são o SDK nos adaptadores, a tabela no repository, no teste e no db/ do núcleo, a própria guarda de tabela, o erro tipado em teste, em __fixtures__ e no main.tsx da web, o teste do redact e a mensagem repassada pelo LoggerDoNest', () => {
    expect(EXCECOES_DAS_GUARDAS).toEqual([
      { files: ['packages/core/src/ia/*-adapter.ts'], regras: REGRAS_DE_SDK_DE_IA },
      { files: ['**/*.repository.ts'], regras: REGRAS_DE_TENANT },
      { files: ARQUIVOS_DE_TESTE, regras: REGRAS_DE_TENANT },
      { files: ['packages/core/src/db/**'], regras: REGRAS_DE_TENANT },
      { files: ['tools/guardas/regras-tenant.mjs'], regras: REGRAS_DE_TENANT },
      { files: [...ARQUIVOS_DE_TESTE, '**/__fixtures__/**'], regras: REGRAS_DE_ERRO },
      { files: ['apps/web/src/main.tsx'], regras: REGRAS_DE_ERRO },
      { files: ['packages/core/src/log/logger.test.ts'], regras: REGRAS_DE_LOG },
      { files: ['packages/core/src/log/nest-logger.ts'], regras: ['guardas/log-sem-conteudo-montado'] },
    ])
  })

  it('a guarda de tabela fica entre as de todo arquivo e entre as que a passada sem comentários roda', () => {
    expect(REGRAS_DE_TENANT).toEqual(['guardas/tabela-so-no-repository'])
    for (const regra of REGRAS_DE_TENANT) {
      expect(REGRAS_EM_TODO_ARQUIVO, regra).toContain(regra)
      expect(REGRAS_DAS_GUARDAS, regra).toContain(regra)
    }
  })

  it('a guarda de erro tipado fica entre as que a passada sem comentários roda, e está em erro na produção e desligada em teste, em __fixtures__ e no main.tsx', async () => {
    expect(REGRAS_DE_ERRO).toEqual(['guardas/erro-tipado'])
    expect(REGRAS_DAS_GUARDAS).toContain('guardas/erro-tipado')
    const nivelEm = async (caminho: string) =>
      ((await eslint.calculateConfigForFile(join(raizRepositorio, caminho))) as { rules: Record<string, [number, ...unknown[]]> }).rules['guardas/erro-tipado']?.[0] ?? 0
    expect(await nivelEm('apps/api/src/x/x.service.ts')).toBe(2)
    expect(await nivelEm('packages/core/src/x/x.ts')).toBe(2)
    expect(await nivelEm('apps/web/src/rotas.tsx')).toBe(2)
    expect(await nivelEm('apps/api/src/x/x.test.ts')).toBe(0)
    expect(await nivelEm('apps/web/src/__fixtures__/tela.tsx')).toBe(0)
    expect(await nivelEm('apps/web/src/main.tsx')).toBe(0)
  })

  it('não existe eslint.config fora da raiz: numa subpasta ele substituiria a configuração e as guardas', () => {
    const configuracoes = arquivosDoRepositorio().filter((arquivo) => /(?:^|\/)eslint\.config\.[cm]?[jt]s$/.test(arquivo))
    expect(configuracoes).toEqual(['eslint.config.mjs'])
  })

  // O protótipo de interface do Gabriel: só front-end, dado sintético, projeto e lint próprios
  // (mockups/README.md). Fica fora do lint da raiz porque quebra regra de propósito para ver como
  // fica; o que impede isso de virar buraco são os dois testes abaixo, que o prendem na pasta.
  const PROTOTIPO = 'mockups/'
  const ehCodigo = (arquivo: string) => /\.(?:[cm]?[jt]s|[jt]sx)$/.test(arquivo)

  it('nenhum código versionado fica fora do lint, exceto as fixtures de violação e o protótipo de mockups/', async () => {
    const codigo = arquivosDoRepositorio().filter(
      (arquivo) => ehCodigo(arquivo) && !arquivo.startsWith('tools/guardas/__fixtures__/') && !arquivo.startsWith(PROTOTIPO),
    )
    expect(codigo.length).toBeGreaterThan(20)
    const ignorados: string[] = []
    for (const arquivo of codigo) {
      if (await eslint.isPathIgnored(join(raizRepositorio, arquivo))) ignorados.push(arquivo)
    }
    expect(ignorados).toEqual([])
  })

  it('o protótipo de mockups/ não é workspace do monorepo', () => {
    const { workspaces } = JSON.parse(readFileSync(join(raizRepositorio, 'package.json'), 'utf8')) as { workspaces: string[] }
    expect(workspaces.length).toBeGreaterThan(0)
    expect(workspaces.filter((glob) => matchesGlob('mockups', glob))).toEqual([])
  })

  // Pela palavra, e não por um padrão de import: alias do Vite, `paths` do tsconfig, `import.meta.glob`,
  // `new URL(...)` e template literal chegam ao protótipo sem escrever `from '.../mockups/'`. Documento
  // (`.md`) pode citar a pasta; os arquivos abaixo são os que declaram a exceção. O `.dockerignore` a deixa fora do
  // contexto de build das imagens, e o teste dele (`dockerfile.test.ts`) confere que ela está lá.
  const CITAM_O_PROTOTIPO = ['eslint.config.mjs', 'vitest.config.ts', 'tools/guardas/guardas.test.ts', '.dockerignore', 'tools/ci/dockerfile.test.ts', 'tools/renomear/ast.ts']

  it('nada fora de mockups/ aponta para o protótipo: o que não passa pelo lint não entra no produto', () => {
    const citam = arquivosDoRepositorio()
      .filter((arquivo) => !arquivo.startsWith(PROTOTIPO) && !arquivo.endsWith('.md') && !CITAM_O_PROTOTIPO.includes(arquivo))
      .filter((arquivo) => readFileSync(join(raizRepositorio, arquivo), 'utf8').includes('mockups'))
    expect(citam).toEqual([])
  })

  it('não existe symlink versionado: por um deles o protótipo entraria sem aparecer no caminho', () => {
    const resultado = spawnSync('git', ['ls-files', '--stage'], { cwd: raizRepositorio, encoding: 'utf8' })
    expect(resultado.status).toBe(0)
    const links = resultado.stdout.split('\n').filter((linha) => linha.startsWith('120000 '))
    expect(links).toEqual([])
  })

  it.each([
    'apps/api/src/main.ts',
    'apps/api/src/sistema/saude.controller.ts',
    'apps/web/src/paginas/Casca.tsx',
    'packages/core/src/log/logger.ts',
    'packages/shared/src/index.ts',
    'tools/ci/verificar.ts',
    'eslint.config.mjs',
  ])('todas as guardas e a vigia de diretiva ficam ligadas como erro em %s', async (caminho) => {
    const configuracao = (await eslint.calculateConfigForFile(join(raizRepositorio, caminho))) as {
      rules: Record<string, [number, ...unknown[]]>
    }
    for (const regra of [...REGRAS_EM_TODO_ARQUIVO, REGRA_DAS_DIRETIVAS]) {
      expect(configuracao.rules[regra]?.[0], `${regra} em ${caminho}`).toBe(2)
    }
  })
})
