import { type ChildProcess, execFileSync, spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ULTIMO_AMBIENTE_DE_TESTE } from '../ci/compose.ts'
import {
  abandonar,
  abrir,
  avisoDoAmbiente,
  branchDaLinha,
  CAMINHO_DA_TRAVA,
  CAMINHO_DO_QUADRO,
  conferir,
  CODIGO_DA_VERIFICACAO,
  COMANDO_DA_VERIFICACAO,
  conferirEntrega,
  distribuir,
  ehDoTronco,
  encontro as encontroDeVerdade,
  ESPERA_ATE_SIGKILL_MS,
  fechar,
  lerArquivosPrevistos,
  lerPlano,
  lerQuadro,
  marcarTarefaFeita,
  MAXIMO_DE_LINHAS,
  type Opcoes,
  opcoesDoAmbiente,
  partida,
  PRAZO_DA_TRAVA_MS,
  PRAZO_DA_VERIFICACAO_COM_NPM_CI_MS,
  PRAZO_DA_VERIFICACAO_MS,
  prazoDaVerificacao,
  porQueNaoJuntas,
  quadro,
  seSobrepoem,
  situacaoDasPendentes,
  textoDoQuadro,
  type TarefaDoPlano,
} from './linhas.ts'
import { arquivosAlterados } from './revisoes.ts'

/**
 * O encontro dos testes. Num repositório de brinquedo não há `npm run typecheck`, e por isso a verificação é injetada: o
 * que passa, `true`, quando o caso não é sobre ela. Quem prova a verificação passa a sua em `comandoSobATrava`, e a
 * padrão tem o caso próprio (`COMANDO_DA_VERIFICACAO`).
 */
const encontro = (raiz: string, numero: number, opcoes: Opcoes = {}) => encontroDeVerdade(raiz, numero, { comandoSobATrava: 'true', ...opcoes })

// Tarefas da mesma spec ao mesmo tempo. O que este arquivo prova é o que custaria caro errado: duas tarefas que se
// tocam correndo juntas, um encontro que leva à spec um commit sem revisão, e um conflito resolvido calado.

const tarefa = (numero: number, campos: Partial<TarefaDoPlano> = {}): TarefaDoPlano => ({
  numero,
  titulo: `tarefa ${String(numero)}`,
  feita: false,
  dependeDe: [],
  paralelaCom: [],
  arquivos: [`apps/web/src/areas/a${String(numero)}/Tela.tsx`],
  ...campos,
})

describe('arquivos previstos', () => {
  it('lê só o que é caminho, entre crases ou solto, e ignora a descrição em prosa', async () => {
    const documento = [
      '# Tarefa 3.0',
      '',
      '## Arquivos previstos',
      '',
      '| Arquivo | Novo ou alterado |',
      '|---|---|',
      '| `apps/api/src/pedidos/pedidos.repository.ts` | alterado |',
      '| apps/web/src/areas/coordenacao/pedidos/ | novo |',
      '| casca do aluno, `MenuDaPessoa`, navegação | alterado |',
      '| `e2e/pedidos.spec.ts` e `apps/api/test/pedidos.int.test.ts` | novo |',
      '| e2e | novo |',
      '',
      '## Testes que provam a regra',
      '',
      '| `apps/fora/da-secao.ts` | novo |',
    ].join('\n')
    expect(lerArquivosPrevistos(documento)).toEqual([
      'apps/api/src/pedidos/pedidos.repository.ts',
      'apps/web/src/areas/coordenacao/pedidos/',
      'e2e/pedidos.spec.ts',
      'apps/api/test/pedidos.int.test.ts',
    ])
    expect(lerArquivosPrevistos('# Tarefa sem a seção\n')).toEqual([])
  })

  it('lê a pasta de primeiro nível (`apps/`) e o arquivo da raiz (`package.json`), e continua sem ler a prosa', async () => {
    const documento = [
      '# Tarefa 5.0',
      '',
      '## Arquivos previstos',
      '',
      '| Arquivo | Novo ou alterado |',
      '|---|---|',
      '| `apps/`, `packages/` | alterado |',
      '| `package.json`, `knip.json` e `eslint.config.mjs` | alterado |',
      '| package-lock.json | alterado |',
      '| a raiz, em geral. | alterado |',
      '| e2e | alterado |',
      '| apps | alterado |',
      '| `1.0`, `v1.2` e `2.3.4` | alterado |',
    ].join('\n')
    expect(lerArquivosPrevistos(documento)).toEqual(['apps/', 'packages/', 'package.json', 'knip.json', 'eslint.config.mjs', 'package-lock.json'])
    expect(seSobrepoem('apps/', 'apps/api/src/x.ts')).toBe(true)
    expect(seSobrepoem('package.json', 'apps/api/package.json')).toBe(false)
  })

  it('pasta cobre o que está dentro dela, e arquivo de nome parecido não', async () => {
    expect(seSobrepoem('apps/web/src/areas/x/', 'apps/web/src/areas/x/Tela.tsx')).toBe(true)
    expect(seSobrepoem('apps/web/src/areas/x/**', 'apps/web/src/areas/x/Tela.tsx')).toBe(true)
    expect(seSobrepoem('apps/web/src/rotas.tsx', 'apps/web/src/rotas.tsx')).toBe(true)
    expect(seSobrepoem('apps/web/src/areas/x/', 'apps/web/src/areas/xis/Tela.tsx')).toBe(false)
    expect(seSobrepoem('apps/web/src/rotas.ts', 'apps/web/src/rotas.tsx')).toBe(false)
  })

  it('migration, schema e contrato compartilhado são do tronco', async () => {
    expect(['packages/core/drizzle/0037_x.sql', 'packages/core/src/db/schema/pedidos.ts', 'packages/shared/src/pedidos.ts'].every(ehDoTronco)).toBe(true)
    expect(['apps/api/src/pedidos/pedidos.service.ts', 'apps/web/src/areas/x/Tela.tsx', 'e2e/pedidos.spec.ts'].some(ehDoTronco)).toBe(false)
  })
})

describe('o que corre junto', () => {
  it('só com a autorização do Arquiteto, com caminho declarado nas duas, sem arquivo em comum e sem dois troncos', async () => {
    const [a, b] = [tarefa(1, { paralelaCom: [2] }), tarefa(2, { paralelaCom: [1] })]
    expect(porQueNaoJuntas(a, b)).toBeNull()
    expect(porQueNaoJuntas(tarefa(1), tarefa(2))).toMatch(/não autoriza a 1\.0 em paralelo com a 2\.0/)
    expect(porQueNaoJuntas(a, { ...b, arquivos: [] })).toMatch(/a 2\.0 não declara caminho/)
    expect(porQueNaoJuntas({ ...a, arquivos: ['apps/web/src/rotas.tsx', 'apps/web/src/areas/a1/'] }, { ...b, arquivos: ['apps/web/src/rotas.tsx'] })).toMatch(/preveem apps\/web\/src\/rotas\.tsx/)
    expect(porQueNaoJuntas({ ...a, arquivos: ['apps/web/src/areas/a1/'] }, { ...b, arquivos: ['apps/web/src/areas/a1/Tela.tsx'] })).toMatch(/preveem apps\/web\/src\/areas\/a1\//)
    expect(
      porQueNaoJuntas({ ...a, arquivos: ['packages/core/drizzle/0037_a.sql'] }, { ...b, arquivos: ['packages/shared/src/b.ts'] }),
    ).toMatch(/migration, schema ou contrato compartilhado/)
    // Uma do tronco com uma folha corre.
    expect(porQueNaoJuntas({ ...a, arquivos: ['packages/core/drizzle/0037_a.sql'] }, b)).toBeNull()
  })

  it('pendente só é livre com as dependências concluídas e correndo junto com tudo o que está em curso', async () => {
    const plano = [
      tarefa(1, { feita: true }),
      tarefa(2, { dependeDe: [1], paralelaCom: [3, 4] }),
      tarefa(3, { dependeDe: [1], paralelaCom: [2] }),
      tarefa(4, { dependeDe: [1], paralelaCom: [2], arquivos: ['apps/web/src/areas/a2/Tela.tsx'] }),
      tarefa(5, { dependeDe: [2] }),
    ]
    const comADoisEmCurso = situacaoDasPendentes(plano, [2])
    expect(comADoisEmCurso.livres.map(({ numero }) => numero)).toEqual([3])
    expect(comADoisEmCurso.presas).toEqual([
      { numero: 4, motivo: 'a 4.0 e a 2.0 preveem apps/web/src/areas/a2/Tela.tsx' },
      { numero: 5, motivo: 'espera 2.0' },
    ])
    // Sem nada em curso, toda pendente com a dependência concluída é livre: correr sozinha não pede autorização.
    expect(situacaoDasPendentes(plano, []).livres.map(({ numero }) => numero)).toEqual([2, 3, 4])
  })

  it('a distribuição não põe juntas duas livres que não correm uma com a outra', async () => {
    // A 3.0 e a 4.0 correm com a 2.0, mas não entre si: o Arquiteto não autorizou o par.
    const plano = [tarefa(2, { paralelaCom: [3, 4] }), tarefa(3), tarefa(4)]
    expect(distribuir(plano, [], [1, 2, 3])).toEqual({ partidas: [{ linha: 1, tarefa: 2 }, { linha: 2, tarefa: 3 }], semLinha: [] })
    // Com a 4.0 autorizada com a 3.0 e uma linha ociosa só, as outras ficam sem linha: é o que pede abrir mais.
    const todas = [tarefa(2, { paralelaCom: [3, 4] }), tarefa(3, { paralelaCom: [4] }), tarefa(4)]
    expect(distribuir(todas, [], [2])).toEqual({ partidas: [{ linha: 2, tarefa: 2 }], semLinha: [3, 4] })
    expect(distribuir(todas, [2], [1, 3])).toEqual({ partidas: [{ linha: 1, tarefa: 3 }, { linha: 3, tarefa: 4 }], semLinha: [] })
  })

  it('sem autorização nenhuma, é uma tarefa por vez, como sempre foi', async () => {
    const plano = [tarefa(1), tarefa(2), tarefa(3)]
    expect(distribuir(plano, [], [1, 2, 3]).partidas).toEqual([{ linha: 1, tarefa: 1 }])
    expect(distribuir(plano, [1], [2, 3])).toEqual({ partidas: [], semLinha: [] })
  })

  it('o teto de linhas é o de ambientes de teste da máquina', async () => {
    expect(MAXIMO_DE_LINHAS).toBe(ULTIMO_AMBIENTE_DE_TESTE)
  })
})

describe('marcar a tarefa na lista', () => {
  it('marca a tarefa e as subtarefas dela, e nenhuma outra', async () => {
    const lista = ['- [ ] **1.0 — a**', '  - [ ] 1.1 um', '  - [ ] 1.2 Testes', '', '- [ ] **11.0 — b**', '  - [ ] 11.1 um', '', '- [x] **2.0 — c**', ''].join('\n')
    expect(marcarTarefaFeita(lista, 1)).toBe(
      ['- [x] **1.0 — a**', '  - [x] 1.1 um', '  - [x] 1.2 Testes', '', '- [ ] **11.0 — b**', '  - [ ] 11.1 um', '', '- [x] **2.0 — c**', ''].join('\n'),
    )
  })
})

describe('partida, encontro e fechamento, em repositórios de verdade', () => {
  const pastas: string[] = []
  afterEach(() => {
    for (const pasta of pastas.splice(0)) rmSync(pasta, { recursive: true, force: true })
  })

  const TASKS = [
    '# Tarefas — exemplo',
    '',
    '## Lista',
    '',
    '- [x] **1.0 — a base**',
    '  - [x] 1.1 um',
    '- [ ] **2.0 — a tela A**',
    '  - [ ] 2.1 um',
    '- [ ] **3.0 — a tela B**',
    '  - [ ] 3.1 um',
    '- [ ] **4.0 — o que depende da A**',
    '  - [ ] 4.1 um',
    '',
    '## Dependências e paralelismo',
    '',
    '| Tarefa | Depende de | Pode correr em paralelo com |',
    '|---|---|---|',
    '| 1.0 | nenhuma | — |',
    '| 2.0 | 1.0 | 3.0 |',
    '| 3.0 | 1.0 | — |',
    '| 4.0 | 2.0 | — |',
    '',
  ].join('\n')
  const documento = (numero: number, arquivo: string) => `# Tarefa ${String(numero)}.0\n\n## Arquivos previstos\n\n| Arquivo | Novo ou alterado |\n|---|---|\n| \`${arquivo}\` | novo |\n\n## Testes\n`

  async function andares(linhas = [1, 2]) {
    const base = mkdtempSync(join(tmpdir(), 'linhas-'))
    pastas.push(base)
    const spec = join(base, 'spec')
    mkdirSync(spec)
    const git = (raiz: string, ...args: string[]) => execFileSync('git', args, { cwd: raiz, encoding: 'utf8', stdio: 'pipe' }).trim()
    const escrever = (raiz: string, arquivo: string, conteudo: string) => {
      mkdirSync(dirname(join(raiz, arquivo)), { recursive: true })
      writeFileSync(join(raiz, arquivo), conteudo)
    }
    git(spec, 'init', '-q', '-b', 'spec/exemplo')
    git(spec, 'config', 'user.name', 'teste')
    git(spec, 'config', 'user.email', 'teste@exemplo.invalid')
    escrever(spec, '.gitignore', '.processo/\n')
    escrever(spec, 'tasks/prd-exemplo/tasks.md', TASKS)
    escrever(spec, 'tasks/prd-exemplo/estado.md', '# Estado\n')
    escrever(spec, 'tasks/prd-exemplo/2_task.md', documento(2, 'apps/web/a.ts'))
    escrever(spec, 'tasks/prd-exemplo/3_task.md', documento(3, 'apps/web/b.ts'))
    escrever(spec, 'tasks/prd-exemplo/4_task.md', documento(4, 'apps/web/c.ts'))
    escrever(spec, 'apps/web/registro.ts', 'export const telas = [\n  // fim\n]\n')
    git(spec, 'add', '-A')
    git(spec, 'commit', '-q', '-m', 'Abre exemplo')
    const checkouts = new Map<number, string>()
    for (const numero of linhas) {
      const checkout = join(base, `l${String(numero)}`)
      git(spec, 'worktree', 'add', '-q', '-b', branchDaLinha('spec/exemplo', numero), checkout)
      // O que o Maestri copia do andar de origem e não vale na linha.
      escrever(checkout, '.processo/portao.json', '{}')
      escrever(checkout, '.processo/linhas.json', '{}')
      checkouts.set(numero, checkout)
      expect((await abrir(spec, numero, checkout, { instalar: false })).codigo).toBe(0)
    }
    /** O que o Implementador entrega: o código, a lista marcada e o commit com a marca e as revisões. */
    const entregar = (numero: number, tarefaFeita: number, arquivos: Record<string, string>, marca = `(tarefa ${String(tarefaFeita)}.0)`) => {
      const checkout = checkouts.get(numero) ?? ''
      for (const [arquivo, conteudo] of Object.entries(arquivos)) escrever(checkout, arquivo, conteudo)
      const lista = join(checkout, 'tasks/prd-exemplo/tasks.md')
      if (marca.startsWith('(tarefa')) writeFileSync(lista, marcarTarefaFeita(readFileSync(lista, 'utf8'), tarefaFeita))
      git(checkout, 'add', '-A')
      git(checkout, 'commit', '-q', '-m', `Entrega ${marca}\n\nRevisões: test-engineer APROVADO (1ª rodada), revisor-geral APROVADO (1ª rodada)`)
    }
    return { base, spec, checkouts, git, escrever, entregar, lista: (raiz: string) => readFileSync(join(raiz, 'tasks/prd-exemplo/tasks.md'), 'utf8') }
  }

  it('abrir dá à linha o ambiente de teste dela e tira o carimbo e o quadro que vieram copiados', async () => {
    const { spec, checkouts } = await andares()
    const l2 = checkouts.get(2) ?? ''
    expect(readFileSync(join(l2, '.processo/ambiente'), 'utf8')).toBe('2\n')
    expect(existsSync(join(l2, '.processo/portao.json'))).toBe(false)
    expect(existsSync(join(l2, '.processo/linhas.json'))).toBe(false)
    expect(lerQuadro(spec)?.linhas.map(({ numero, tarefa: emCurso }) => [numero, emCurso])).toEqual([[1, null], [2, null]])
    // A linha termina aberta, e livre: é a branch da spec que ela grava como a base de onde parte.
    expect(lerQuadro(spec)?.linhas.map(({ base, abrindo }) => [base, abrindo])).toEqual([['spec/exemplo', false], ['spec/exemplo', false]])
    expect((await abrir(spec, 4, l2, { instalar: false })).texto).toMatch(/inteiro de 1 a 3/)
    expect((await abrir(spec, 3, l2, { instalar: false })).texto).toMatch(/a linha 3 é a spec\/exemplo--l3/)
    // Do checkout de uma linha, nada: o quadro mora no andar da spec.
    expect((await abrir(l2, 1, l2, { instalar: false })).texto).toMatch(/roda no andar da spec/)
    expect(quadro(l2)).toEqual({ codigo: 1, texto: expect.stringMatching(/^RECUSADO: este comando roda no andar da spec/) as string })
    expect(quadro(spec).codigo).toBe(0)
  })

  it('o quadro diz quem parte, e a partida recusa o que não corre junto', async () => {
    const { spec } = await andares()
    expect(lerPlano(spec, 'exemplo').map(({ numero, paralelaCom, arquivos }) => [numero, paralelaCom, arquivos])).toEqual([
      [1, [], []],
      [2, [3], ['apps/web/a.ts']],
      [3, [2], ['apps/web/b.ts']],
      [4, [], ['apps/web/c.ts']],
    ])
    expect(textoDoQuadro(spec)).toContain('Partem agora: linha 1 → 2.0; linha 2 → 3.0')
    expect(textoDoQuadro(spec)).toContain('Presas: 4.0 (espera 2.0)')
    expect((await partida(spec, 1, '2')).texto).toContain('terminais: Implementador e Mesa')
    expect((await partida(spec, 2, '4.0')).texto).toMatch(/a 4\.0 não parte agora: espera 2\.0/)
    expect((await partida(spec, 2, '2')).texto).toMatch(/já corre em outra linha/)
    expect((await partida(spec, 1, '3')).texto).toMatch(/a linha 1 está com a tarefa 2\.0/)
    expect((await partida(spec, 2, '1')).texto).toMatch(/já está concluída/)
    expect((await partida(spec, 2, '3')).texto).toContain('terminais: Implementador 2 e Mesa 2')
    expect(textoDoQuadro(spec)).toContain('linha 2: tarefa 3.0')
    expect(textoDoQuadro(spec)).toMatch(/linha 1: tarefa 2\.0 desde \d\d:\d\d/)
    expect(textoDoQuadro(spec)).not.toContain('Partem agora')
  })

  it('duas linhas se encontram na spec: cada commit de tarefa chega inteiro, e a segunda traz a primeira', async () => {
    const { spec, checkouts, git, escrever, entregar, lista } = await andares()
    await partida(spec, 1, '2')
    await partida(spec, 2, '3')
    entregar(1, 2, { 'apps/web/a.ts': 'a\n' })
    entregar(2, 3, { 'apps/web/b.ts': 'b\n' })
    // O diário é o único arquivo que o Orquestrador mexe no andar da spec, e o encontro o leva.
    escrever(spec, 'tasks/prd-exemplo/estado.md', '# Estado\n\n2.0 concluída\n')
    // Um documento a meio, do Arquiteto, fica como está: o encontro não o leva nem para por ele.
    escrever(spec, 'tasks/prd-exemplo/techspec.md', 'a meio\n')

    const primeiro = await encontro(spec, 1, { push: false })
    expect(primeiro.codigo, primeiro.texto).toBe(0)
    expect(primeiro.texto).toContain('linha 1: ociosa')
    // A 4.0 já tem a dependência concluída, mas o Arquiteto não a autorizou com a 3.0, que ainda corre.
    expect(primeiro.texto).toContain('Presas: 4.0 (o tasks.md não autoriza a 4.0 em paralelo com a 3.0)')
    expect(git(spec, 'status', '--porcelain')).toBe('?? tasks/prd-exemplo/techspec.md')
    expect(git(spec, 'log', '-1', '--format=%s')).toBe('Registra o estado de exemplo depois da tarefa 2.0')
    expect(git(spec, 'show', '--name-only', '--format=', 'HEAD')).toBe('tasks/prd-exemplo/estado.md')

    const segundo = await encontro(spec, 2, { push: false })
    expect(segundo.codigo, segundo.texto).toBe(0)
    expect(existsSync(join(spec, 'apps/web/a.ts')) && existsSync(join(spec, 'apps/web/b.ts'))).toBe(true)
    expect(lista(spec)).toContain('- [x] **2.0 — a tela A**')
    expect(lista(spec)).toContain('- [x] **3.0 — a tela B**')
    expect(lista(spec)).toContain('  - [x] 3.1 um')
    expect(lista(spec)).toContain('- [ ] **4.0 — o que depende da A**')
    // Os dois commits de tarefa estão na spec como foram feitos, com as revisões.
    const titulos = git(spec, 'log', '--format=%s').split('\n')
    expect(titulos).toEqual(expect.arrayContaining(['Entrega (tarefa 2.0)', 'Entrega (tarefa 3.0)']))
    expect(lerQuadro(spec)?.linhas.every((linha) => linha.tarefa === null)).toBe(true)

    // A linha 1 parte de novo já com o que a 2 entregou.
    expect((await partida(spec, 1, '4')).codigo).toBe(0)
    expect(existsSync(join(checkouts.get(1) ?? '', 'apps/web/b.ts'))).toBe(true)
  })

  it('o encontro recusa o que não é commit de tarefa revisado, e nada muda', async () => {
    const { spec, checkouts, git, escrever, entregar } = await andares([1])
    const l1 = checkouts.get(1) ?? ''
    expect((await encontro(spec, 1, { push: false })).texto).toMatch(/não tem trabalho em curso/)
    await partida(spec, 1, '2')
    expect((await encontro(spec, 1, { push: false })).texto).toMatch(/nenhum commit novo/)
    escrever(l1, 'apps/web/a.ts', 'a\n')
    expect((await encontro(spec, 1, { push: false })).texto).toMatch(/árvore da linha 1 não está limpa/)
    git(l1, 'add', '-A')
    git(l1, 'commit', '-q', '-m', 'Entrega (tarefa 3.0)\n\nRevisões: test-engineer APROVADO (1ª rodada)')
    expect((await encontro(spec, 1, { push: false })).texto).toMatch(/leva código sem \(tarefa 2\.0\) no título: "Entrega \(tarefa 3\.0\)"/)
    git(l1, 'commit', '-q', '--amend', '-m', 'Entrega (tarefa 2.0)')
    expect((await encontro(spec, 1, { push: false })).texto).toMatch(/não tem a linha "Revisões:"/)
    git(l1, 'commit', '-q', '--amend', '-m', 'Arruma (correção 2026-10-11-outra)\n\nRevisões: test-engineer APROVADO (1ª rodada)')
    expect((await encontro(spec, 1, { push: false })).texto).toMatch(/falta o commit com \(tarefa 2\.0\) no título/)
    // Commit só de documento não precisa de marca; o de código, sim, cada um.
    escrever(l1, 'tasks/prd-exemplo/nota.md', 'nota\n')
    git(l1, 'add', '-A')
    git(l1, 'commit', '-q', '-m', 'Anota')
    entregar(1, 2, { 'apps/web/a2.ts': 'a\n' })
    escrever(spec, 'apps/web/solto.ts', 'código no andar da spec\n')
    expect((await encontro(spec, 1, { push: false })).texto).toMatch(/andar da spec tem código alterado, e nele ninguém implementa:\n\?\? apps\/web\/solto\.ts/)
    expect(git(spec, 'log', '-1', '--format=%s')).toBe('Abre exemplo')
    expect(lerQuadro(spec)?.linhas[0]?.tarefa).toBe(2)
  })

  it('conflito de código para o encontro: nada muda, e o conserto custa só os arquivos em conflito', async () => {
    const { spec, checkouts, git, escrever, entregar } = await andares()
    const l2 = checkouts.get(2) ?? ''
    await partida(spec, 1, '2')
    await partida(spec, 2, '3')
    entregar(1, 2, { 'apps/web/a.ts': 'a\n', 'apps/web/registro.ts': 'export const telas = [\n  a,\n]\n' })
    entregar(2, 3, { 'apps/web/b.ts': 'b\n', 'apps/web/registro.ts': 'export const telas = [\n  b,\n]\n' })
    expect((await encontro(spec, 1, { push: false })).codigo).toBe(0)

    const antes = git(l2, 'rev-parse', 'HEAD')
    const parado = await encontro(spec, 2, { push: false })
    expect(parado.codigo).toBe(4)
    expect(parado.texto).toContain('CONFLITO no encontro da linha 2 (tarefa 3.0): apps/web/registro.ts')
    expect(parado.texto).toContain('slug encontro-3')
    expect(git(l2, 'rev-parse', 'HEAD')).toBe(antes)
    expect(git(l2, 'status', '--porcelain')).toBe('')
    expect(lerQuadro(spec)?.linhas.find((linha) => linha.numero === 2)?.tarefa).toBe(3)

    // O conserto, como o Implementador da linha faz: traz a spec, resolve, e o hook cobra só o que divergiu.
    expect(() => git(l2, 'merge', '--no-edit', 'spec/exemplo')).toThrow()
    expect(arquivosAlterados(l2).filter((arquivo) => arquivo.startsWith('apps/'))).toEqual(['apps/web/registro.ts'])
    escrever(l2, 'apps/web/registro.ts', 'export const telas = [\n  a,\n  b,\n]\n')
    git(l2, 'add', '-A')
    git(l2, 'commit', '-q', '-m', 'Junta as telas A e B no registro (correção 2026-10-11-encontro-3)\n\nRevisões: test-engineer APROVADO (1ª rodada), revisor-geral APROVADO (1ª rodada)')

    // O conserto é mais um commit da linha: o da tarefa continua lá, e o encontro leva os dois.
    const depois = await encontro(spec, 2, { push: false })
    expect(depois.codigo, depois.texto).toBe(0)
    expect(readFileSync(join(spec, 'apps/web/registro.ts'), 'utf8')).toBe('export const telas = [\n  a,\n  b,\n]\n')
    expect(git(spec, 'log', '--format=%s')).toContain('Entrega (tarefa 3.0)')
  })

  it('conflito só na lista de tarefas é resolvido pelo encontro: a lista da spec, com a tarefa da linha marcada', async () => {
    const { spec, git, entregar, lista } = await andares()
    await partida(spec, 1, '2')
    await partida(spec, 2, '3')
    entregar(1, 2, { 'apps/web/a.ts': 'a\n' })
    entregar(2, 3, { 'apps/web/b.ts': 'b\n' })
    expect((await encontro(spec, 1, { push: false })).codigo).toBe(0)
    // As tarefas 2.0 e 3.0 são vizinhas na lista, sem linha em branco entre elas: o merge do git para aí.
    const resultado = await encontro(spec, 2, { push: false })
    expect(resultado.codigo, resultado.texto).toBe(0)
    expect(lista(spec)).toBe(marcarTarefaFeita(marcarTarefaFeita(TASKS, 2), 3))
    expect(git(spec, 'status', '--porcelain')).toBe('')
  })

  it('correção corre numa linha e encontra a spec com a marca de correção', async () => {
    const { spec, entregar } = await andares([1])
    expect((await partida(spec, 1, 'correcao:esteira-vermelha')).texto).toContain('correção esteira-vermelha')
    entregar(1, 0, { 'apps/web/conserto.ts': 'c\n' }, '(correção 2026-10-11-esteira-vermelha)')
    const resultado = await encontro(spec, 1, { push: false })
    expect(resultado.codigo, resultado.texto).toBe(0)
    expect(existsSync(join(spec, 'apps/web/conserto.ts'))).toBe(true)
    expect((await partida(spec, 1, 'qualquer')).texto).toMatch(/não é tarefa \(5 ou 5\.0\) nem correção/)
  })

  it('a linha que traz outra linha por merge só é cobrada pelo que o merge resolveu à mão', async () => {
    const limpo = await andares()
    const l2 = limpo.checkouts.get(2) ?? ''
    await partida(limpo.spec, 1, 'correcao:base')
    await partida(limpo.spec, 2, '3')
    limpo.entregar(1, 0, { 'apps/web/base.ts': 'base\n' }, '(correção 2026-10-22-base)')
    limpo.escrever(l2, 'tasks/prd-exemplo/nota.md', 'nota\n')
    limpo.git(l2, 'add', '-A')
    limpo.git(l2, 'commit', '-q', '-m', 'Anota')
    // A tarefa da linha 2 precisa da correção da linha 1: o Orquestrador manda trazê-la, e o merge é limpo.
    limpo.git(l2, 'merge', '--no-edit', branchDaLinha('spec/exemplo', 1))
    expect(limpo.git(l2, 'rev-list', '--merges', 'spec/exemplo..HEAD')).not.toBe('')
    limpo.entregar(2, 3, { 'apps/web/b.ts': 'b\n' })
    const resultado = await encontro(limpo.spec, 2, { push: false })
    expect(resultado.codigo, resultado.texto).toBe(0)
    expect(existsSync(join(limpo.spec, 'apps/web/base.ts'))).toBe(true)

    // O merge que resolve conflito de código à mão, sem marca, continua recusado.
    const resolvido = await andares()
    const r2 = resolvido.checkouts.get(2) ?? ''
    await partida(resolvido.spec, 1, 'correcao:base')
    await partida(resolvido.spec, 2, '3')
    resolvido.entregar(1, 0, { 'apps/web/registro.ts': 'export const telas = [\n  a,\n]\n' }, '(correção 2026-10-22-base)')
    resolvido.entregar(2, 3, { 'apps/web/registro.ts': 'export const telas = [\n  b,\n]\n' })
    expect(() => resolvido.git(r2, 'merge', '--no-edit', branchDaLinha('spec/exemplo', 1))).toThrow()
    resolvido.escrever(r2, 'apps/web/registro.ts', 'export const telas = [\n  a,\n  b,\n]\n')
    resolvido.git(r2, 'add', '-A')
    resolvido.git(r2, 'commit', '-q', '--no-edit')
    expect((await encontro(resolvido.spec, 2, { push: false })).texto).toMatch(/leva código sem \(tarefa 3\.0\) no título: "Merge branch/)
  })

  it('a correção avulsa se confere no andar dela: marca, revisões, árvore limpa e push', async () => {
    const base = mkdtempSync(join(tmpdir(), 'conferir-'))
    pastas.push(base)
    const [origem, andar] = [join(base, 'origem.git'), join(base, 'andar')]
    const git = (raiz: string, ...args: string[]) => execFileSync('git', args, { cwd: raiz, encoding: 'utf8', stdio: 'pipe' }).trim()
    execFileSync('git', ['init', '-q', '--bare', '-b', 'develop', origem])
    execFileSync('git', ['clone', '-q', origem, andar], { stdio: 'pipe' })
    git(andar, 'config', 'user.name', 'teste')
    git(andar, 'config', 'user.email', 'teste@exemplo.invalid')
    git(andar, 'commit', '-q', '--allow-empty', '-m', 'base')
    git(andar, 'push', '-q', 'origin', 'HEAD:develop')
    git(andar, 'checkout', '-q', '-b', 'correcao/2026-10-11-fuso')
    expect(conferir(andar).texto).toMatch(/nenhum commit novo/)
    mkdirSync(join(andar, 'apps'))
    writeFileSync(join(andar, 'apps/fuso.ts'), 'a\n')
    git(andar, 'add', '-A')
    git(andar, 'commit', '-q', '-m', 'Corrige o fuso (correção 2026-10-11-fuso)\n\nRevisões: test-engineer APROVADO (1ª rodada)')
    expect(conferir(andar).texto).toMatch(/o push não foi feito/)
    git(andar, 'push', '-q', '-u', 'origin', 'HEAD')
    expect(conferir(andar).codigo).toBe(0)
    writeFileSync(join(andar, 'apps/da-tarefa.ts'), 'em curso\n')
    expect(conferir(andar).texto).toMatch(/a árvore não está limpa/)
    expect(conferir(andar, { emCurso: true }).texto).toMatch(/árvore com 1 arquivo\(s\) da tarefa em curso e push feito/)
  })

  describe('conferir na branch da spec', () => {
    const REVISOES = '\n\nRevisões: test-engineer APROVADO (1ª rodada), revisor-geral APROVADO (1ª rodada)'

    /** Um andar de spec com a `develop` no GitHub, e o que o Implementador faz nele: o commit, com ou sem marca e revisões. */
    function andarDaSpec(branch = 'spec/exemplo') {
      const base = mkdtempSync(join(tmpdir(), 'conferir-spec-'))
      pastas.push(base)
      const [origem, andar] = [join(base, 'origem.git'), join(base, 'andar')]
      const git = (...args: string[]) => execFileSync('git', args, { cwd: andar, encoding: 'utf8', stdio: 'pipe' }).trim()
      execFileSync('git', ['init', '-q', '--bare', '-b', 'develop', origem])
      execFileSync('git', ['clone', '-q', origem, andar], { stdio: 'pipe' })
      git('config', 'user.name', 'teste')
      git('config', 'user.email', 'teste@exemplo.invalid')
      git('commit', '-q', '--allow-empty', '-m', 'base')
      git('push', '-q', 'origin', 'HEAD:develop')
      git('checkout', '-q', '-b', branch)
      const commit = (arquivo: string, titulo: string, corpo = REVISOES) => {
        mkdirSync(join(andar, 'apps'), { recursive: true })
        writeFileSync(join(andar, 'apps', arquivo), `${titulo}\n`)
        git('add', '-A')
        git('commit', '-q', '-m', `${titulo}${corpo}`)
      }
      return { andar, git, commit, enviar: () => git('push', '-q', '-u', 'origin', 'HEAD') }
    }

    it('aceita a correção que vem depois das tarefas da spec, que a develop ainda não tem', async () => {
      const { andar, commit, enviar } = andarDaSpec()
      commit('a.ts', 'Entrega a tela A (tarefa 2.0)')
      commit('b.ts', 'Entrega a tela B (tarefa 3.0)')
      commit('conserto.ts', 'Corrige o conserto (correção 2026-10-18-conserto)')
      enviar()
      const resultado = conferir(andar)
      expect(resultado.codigo, resultado.texto).toBe(0)
      expect(resultado.texto).toContain('árvore limpa e push feito')
    })

    it('recusa quando o último commit com código é de tarefa, e não a correção que se esperava', async () => {
      const { andar, commit, enviar } = andarDaSpec()
      commit('conserto.ts', 'Corrige o conserto (correção 2026-10-18-conserto)')
      commit('a.ts', 'Entrega a tela A (tarefa 2.0)')
      enviar()
      expect(conferir(andar).texto).toMatch(/falta o commit com \(correção <slug>\) no título, e ele tem de ser o último com código/)
    })

    it('um commit de documento depois do código não esconde que o último commit com código era de tarefa', async () => {
      const { andar, commit, enviar, git } = andarDaSpec()
      commit('a.ts', 'Entrega a tela A (tarefa 2.0)')
      mkdirSync(join(andar, 'tasks'))
      writeFileSync(join(andar, 'tasks', 'estado.md'), 'estado\n')
      git('add', '-A')
      git('commit', '-q', '-m', 'Registra o estado')
      enviar()
      expect(conferir(andar).texto).toMatch(/falta o commit com \(correção <slug>\) no título, e ele tem de ser o último com código/)
    })

    it('commit com código sem marca, ou sem a linha Revisões, continua recusado na spec', async () => {
      const semMarca = andarDaSpec()
      semMarca.commit('a.ts', 'Entrega a tela A (tarefa 2.0)')
      semMarca.commit('solto.ts', 'Conserta sem marca')
      semMarca.commit('conserto.ts', 'Corrige o conserto (correção 2026-10-18-conserto)')
      semMarca.enviar()
      expect(conferir(semMarca.andar).texto).toMatch(/leva código sem \(tarefa N\.0\) nem \(correção <slug>\) no título: "Conserta sem marca"/)

      const semRevisoes = andarDaSpec()
      semRevisoes.commit('a.ts', 'Entrega a tela A (tarefa 2.0)', '')
      semRevisoes.commit('conserto.ts', 'Corrige o conserto (correção 2026-10-18-conserto)')
      semRevisoes.enviar()
      expect(conferir(semRevisoes.andar).texto).toMatch(/não tem a linha "Revisões:"/)
    })

    it('uma spec só com documento e um commit sem marca é recusada: não há commit com código, e portanto nenhuma correção', async () => {
      const { andar, git, enviar } = andarDaSpec()
      mkdirSync(join(andar, 'tasks'))
      writeFileSync(join(andar, 'tasks', 'prd.md'), 'prd\n')
      git('add', '-A')
      git('commit', '-q', '-m', 'Abre o PRD')
      enviar()
      expect(conferir(andar).texto).toBe('RECUSADO: falta o commit com (correção <slug>) no título, e ele tem de ser o último com código')
    })

    it('o merge do encontro não é cobrado pelo código que trouxe do outro lado, mas o que ele resolveu à mão é', async () => {
      const lado = (marca: string) => {
        const spec = andarDaSpec()
        spec.commit('a.ts', 'Entrega a tela A (tarefa 2.0)')
        spec.git('checkout', '-q', '-b', 'lado', 'develop')
        spec.commit('a.ts', 'Entrega a tela B (tarefa 3.0)')
        spec.git('checkout', '-q', 'spec/exemplo')
        expect(() => spec.git('merge', '--no-edit', 'lado')).toThrow()
        writeFileSync(join(spec.andar, 'apps', 'a.ts'), 'resolvido\n')
        spec.git('add', '-A')
        spec.git('commit', '-q', '-m', `Junta as telas${marca}${marca === '' ? '' : REVISOES}`)
        spec.commit('conserto.ts', 'Corrige o conserto (correção 2026-10-18-conserto)')
        spec.enviar()
        return spec.andar
      }
      expect(conferir(lado('')).texto).toMatch(/leva código sem \(tarefa N\.0\) nem \(correção <slug>\) no título: "Junta as telas"/)
      const marcado = conferir(lado(' (correção 2026-10-18-encontro-3)'))
      expect(marcado.codigo, marcado.texto).toBe(0)
    })

    it('o merge que resolve o conflito ficando com um lado é cobrado, porque descartou o código do outro', async () => {
      const spec = andarDaSpec()
      spec.commit('a.ts', 'Entrega a tela A (tarefa 2.0)')
      spec.git('checkout', '-q', '-b', 'lado', 'develop')
      spec.commit('a.ts', 'Entrega a tela B (tarefa 3.0)')
      spec.git('checkout', '-q', 'spec/exemplo')
      expect(() => spec.git('merge', '--no-edit', 'lado')).toThrow()
      spec.git('checkout', '--ours', 'apps/a.ts')
      spec.git('add', '-A')
      spec.git('commit', '-q', '-m', 'Junta as telas')
      spec.commit('conserto.ts', 'Corrige o conserto (correção 2026-10-18-conserto)')
      spec.enviar()
      expect(conferir(spec.andar).texto).toMatch(/leva código sem \(tarefa N\.0\) nem \(correção <slug>\) no título: "Junta as telas"/)
    })

    it('com duas linhas que mexem em trechos diferentes do mesmo arquivo, o merge limpo do encontro não é cobrado', async () => {
      const { spec, entregar, git, escrever } = await andares()
      const base = mkdtempSync(join(tmpdir(), 'conferir-linhas-'))
      pastas.push(base)
      execFileSync('git', ['init', '-q', '--bare', '-b', 'spec/exemplo', join(base, 'origem.git')])
      // O arquivo comum entra antes da `develop`, e por isso o `conferir` não o vê; a partida leva o arquivo às linhas.
      // Há espaço entre os trechos: mudança em linhas vizinhas vira conflito, e aqui o merge tem de ser limpo.
      const comum = (trocas: Record<number, string> = {}) =>
        `${Array.from({ length: 12 }, (_, i) => trocas[i + 1] ?? `linha ${String(i + 1)}`).join('\n')}\n`
      escrever(spec, 'apps/web/comum.ts', comum())
      git(spec, 'add', '-A')
      git(spec, 'commit', '-q', '-m', 'Abre o comum')
      git(spec, 'branch', 'develop')
      git(spec, 'remote', 'add', 'origin', join(base, 'origem.git'))
      expect((await partida(spec, 1, '2')).codigo).toBe(0)
      expect((await partida(spec, 2, '3')).codigo).toBe(0)
      entregar(1, 2, { 'apps/web/comum.ts': comum({ 2: 'da linha 1' }) })
      entregar(2, 3, { 'apps/web/comum.ts': comum({ 9: 'da linha 2' }) })
      expect((await encontro(spec, 1, { push: false })).codigo).toBe(0)
      expect((await encontro(spec, 2, { push: false })).codigo).toBe(0)
      // O encontro da linha 2 é um merge que juntou o arquivo sozinho, e o conflito do tasks.md ele resolveu.
      expect(git(spec, 'rev-list', '--merges', 'develop..HEAD')).not.toBe('')
      expect(readFileSync(join(spec, 'apps/web/comum.ts'), 'utf8')).toBe(comum({ 2: 'da linha 1', 9: 'da linha 2' }))
      escrever(spec, 'apps/web/conserto.ts', 'c\n')
      git(spec, 'add', '-A')
      git(spec, 'commit', '-q', '-m', 'Corrige o conserto (correção 2026-10-18-conserto)\n\nRevisões: test-engineer APROVADO (1ª rodada), revisor-geral APROVADO (1ª rodada)')
      git(spec, 'push', '-q', '-u', 'origin', 'spec/exemplo')
      const resultado = conferir(spec)
      expect(resultado.codigo, resultado.texto).toBe(0)
    })

    it('com duas linhas, o merge que o encontro faz não derruba a conferência da correção que vem depois', async () => {
      const { spec, entregar, git, escrever } = await andares()
      const base = mkdtempSync(join(tmpdir(), 'conferir-linhas-'))
      pastas.push(base)
      execFileSync('git', ['init', '-q', '--bare', '-b', 'spec/exemplo', join(base, 'origem.git')])
      git(spec, 'branch', 'develop')
      git(spec, 'remote', 'add', 'origin', join(base, 'origem.git'))
      expect((await partida(spec, 1, '2')).codigo).toBe(0)
      expect((await partida(spec, 2, '3')).codigo).toBe(0)
      entregar(1, 2, { 'apps/web/a.ts': 'a\n' })
      entregar(2, 3, { 'apps/web/b.ts': 'b\n' })
      expect((await encontro(spec, 1, { push: false })).codigo).toBe(0)
      expect((await encontro(spec, 2, { push: false })).codigo).toBe(0)
      // O histórico de verdade: o encontro da linha 2 é um merge, cujo primeiro pai é a linha, sem o código da linha 1.
      expect(git(spec, 'rev-list', '--merges', 'develop..HEAD')).not.toBe('')
      escrever(spec, 'apps/web/conserto.ts', 'c\n')
      git(spec, 'add', '-A')
      git(spec, 'commit', '-q', '-m', 'Corrige o conserto (correção 2026-10-18-conserto)\n\nRevisões: test-engineer APROVADO (1ª rodada), revisor-geral APROVADO (1ª rodada)')
      git(spec, 'push', '-q', '-u', 'origin', 'spec/exemplo')
      const resultado = conferir(spec)
      expect(resultado.codigo, resultado.texto).toBe(0)
    })

    it('fora da spec, na correção avulsa, a marca de tarefa continua não valendo', async () => {
      const { andar, commit, enviar } = andarDaSpec('correcao/2026-10-18-conserto')
      commit('a.ts', 'Entrega a tela A (tarefa 2.0)')
      commit('conserto.ts', 'Corrige o conserto (correção 2026-10-18-conserto)')
      enviar()
      expect(conferir(andar).texto).toMatch(/leva código sem \(correção <slug>\) no título: "Entrega a tela A \(tarefa 2\.0\)"/)

      // Nem o merge limpo é isentado lá: a isenção é do merge do encontro, que só existe na spec.
      const comMerge = andarDaSpec('correcao/2026-10-18-com-merge')
      comMerge.commit('conserto.ts', 'Corrige o conserto (correção 2026-10-18-com-merge)')
      comMerge.git('checkout', '-q', '-b', 'lado', 'develop')
      comMerge.commit('outro.ts', 'Corrige o outro (correção 2026-10-18-com-merge)')
      comMerge.git('checkout', '-q', 'correcao/2026-10-18-com-merge')
      comMerge.git('merge', '--no-edit', 'lado')
      comMerge.enviar()
      expect(conferir(comMerge.andar).texto).toMatch(/leva código sem \(correção <slug>\) no título: "Merge branch 'lado'/)

      // E a ausência da correção, lá, não pede que ela seja a última com código: só que exista.
      const semCorrecao = andarDaSpec('correcao/2026-10-18-outro')
      writeFileSync(join(semCorrecao.andar, 'nota.md'), 'nota\n')
      semCorrecao.git('add', '-A')
      semCorrecao.git('commit', '-q', '-m', 'Registra a nota')
      semCorrecao.enviar()
      expect(conferir(semCorrecao.andar).texto).toBe('RECUSADO: falta o commit com (correção <slug>) no título')
    })
  })

  it('fechar só com tudo encontrado, e desfaz o quadro', async () => {
    const { spec, entregar } = await andares([1])
    await partida(spec, 1, '2')
    expect((await fechar(spec, { push: false })).texto).toMatch(/a linha 1 está com a tarefa 2\.0/)
    entregar(1, 2, { 'apps/web/a.ts': 'a\n' })
    await encontro(spec, 1, { push: false })
    const fechado = await fechar(spec, { push: false })
    expect(fechado.codigo, fechado.texto).toBe(0)
    expect(fechado.texto).toContain('maestri floor delete')
    expect(existsSync(join(spec, CAMINHO_DO_QUADRO))).toBe(false)
  })
  // Cada caso sobe de dois a quatro processos e espera arquivos-sinal: a margem é para a máquina carregada da esteira.
  describe('o quadro sob uma trava só, com comandos ao mesmo tempo', { timeout: 30_000 }, () => {
    const CLI = join(import.meta.dirname, 'linhas.ts')
    /**
     * Quanto esperar para ver que um comando continua parado: a espera de verdade, por definição, não acaba. Sem a trava o
     * comando termina em uns 300 ms aqui (um processo do Node e alguns `git`); a janela é várias vezes isso, e uma máquina
     * carregada ainda o deixa sair dentro dela, que é o lado em que o teste falha.
     */
    const JANELA_MS = 1500
    const REVISADO = 'Revisões: test-engineer APROVADO (1ª rodada), revisor-geral APROVADO (1ª rodada)'

    interface Saida {
      codigo: number | null
      texto: string
    }

    // O caso que falha antes de soltar um comando preso não deixa processo para trás.
    const filhos: ChildProcess[] = []
    afterEach(() => {
      for (const filho of filhos.splice(0)) filho.kill('SIGKILL')
    })

    /** O comando como o Orquestrador o roda: `node tools/processo/linhas.ts …` no andar da spec, em outro processo. */
    function rodar(raiz: string, argumentos: string[], ambiente: Record<string, string | undefined> = {}) {
      const filho = spawn(process.execPath, [CLI, ...argumentos], { cwd: raiz, env: { ...process.env, EDUCA_ENCONTRO_SOB_A_TRAVA: 'true', ...ambiente }, stdio: ['ignore', 'pipe', 'pipe'] })
      filhos.push(filho)
      let texto = ''
      const estado: { saida: Saida | null } = { saida: null }
      for (const fluxo of [filho.stdout, filho.stderr]) fluxo.on('data', (pedaco: Buffer) => (texto += pedaco.toString()))
      const terminou = new Promise<Saida>((resolver) =>
        filho.once('close', (codigo) => {
          estado.saida = { codigo, texto }
          resolver(estado.saida)
        }),
      )
      return { terminou, jaSaiu: () => estado.saida !== null, sinal: (sinal: NodeJS.Signals) => filho.kill(sinal) }
    }

    const dormir = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms))
    async function aguardarArquivo(caminho: string): Promise<void> {
      const limite = Date.now() + 20_000
      while (!existsSync(caminho)) {
        if (Date.now() > limite) throw new Error(`o arquivo-sinal ${caminho} não apareceu`)
        await dormir(20)
      }
    }

    /**
     * Um comando que avisa que chegou, conta a vez num arquivo fora do checkout e espera o arquivo-sinal, sem dormir um
     * tempo fixo, e desiste sozinho em 30 s: o `sh` que sobra de um caso que falhou não fica girando para sempre.
     * `depois` é o que ele faz ao ser solto: `exit 1` é o `npm ci` que falha.
     */
    function preso(pasta: string, nome: string, depois = 'true') {
      const [chegou, sinal, contador] = ['chegou', 'sinal', 'vezes'].map((sufixo) => join(pasta, `${nome}.${sufixo}`)) as [string, string, string]
      return {
        chegou,
        contador,
        soltar: () => writeFileSync(sinal, ''),
        comando: `echo x >> '${contador}'; : > '${chegou}'; n=0; while [ ! -e '${sinal}' ] && [ $n -lt 1500 ]; do sleep 0.02; n=$((n+1)); done; ${depois}`,
        vezes: () => (existsSync(contador) ? readFileSync(contador, 'utf8').split('\n').filter((linha) => linha !== '').length : 0),
      }
    }

    /** O encontro da linha `numero`, parado sob a trava pelo comando injetado, até `soltar()`. */
    async function encontroPreso(base: string, spec: string, numero: number) {
      const parada = preso(base, `encontro${String(numero)}`)
      const execucao = rodar(spec, ['encontro', String(numero)], { EDUCA_ENCONTRO_SOB_A_TRAVA: parada.comando })
      await aguardarArquivo(parada.chegou)
      return { ...execucao, soltar: parada.soltar }
    }

    /** O GitHub da spec: o encontro que roda como processo, sem a opção do teste, faz o push de verdade. */
    async function andaresComOrigem(linhas = [1, 2]) {
      const montado = await andares(linhas)
      execFileSync('git', ['init', '-q', '--bare', join(montado.base, 'origem.git')])
      montado.git(montado.spec, 'remote', 'add', 'origin', join(montado.base, 'origem.git'))
      return montado
    }

    const linhaDoQuadro = (spec: string, numero: number) => lerQuadro(spec)?.linhas.find((linha) => linha.numero === numero)
    const numerosDoQuadro = (spec: string) => lerQuadro(spec)?.linhas.map((linha) => linha.numero)

    /** Linhas 1 e 2 com a tarefa 2.0 e a 3.0 entregues, prontas para o encontro. */
    async function comDuasEntregas() {
      const montado = await andaresComOrigem()
      await partida(montado.spec, 1, '2')
      await partida(montado.spec, 2, '3')
      montado.entregar(1, 2, { 'apps/web/a.ts': 'a\n' })
      montado.entregar(2, 3, { 'apps/web/b.ts': 'b\n' })
      return montado
    }

    it('dois encontros ao mesmo tempo: o segundo espera o primeiro, e o quadro final tem as duas linhas certas', async () => {
      const { base, spec, git } = await comDuasEntregas()
      const primeiro = await encontroPreso(base, spec, 1)
      const segundo = rodar(spec, ['encontro', '2'])
      await dormir(JANELA_MS)
      expect(segundo.jaSaiu()).toBe(false)
      primeiro.soltar()
      expect([(await primeiro.terminou).codigo, (await segundo.terminou).codigo]).toEqual([0, 0])
      expect(lerQuadro(spec)?.linhas.map((linha) => [linha.numero, linha.tarefa])).toEqual([[1, null], [2, null]])
      expect(git(spec, 'log', '--format=%s').split('\n')).toEqual(expect.arrayContaining(['Entrega (tarefa 2.0)', 'Entrega (tarefa 3.0)']))
    })

    it('a partida da linha 2 durante o encontro da linha 1 espera, e o quadro final tem a 2 ocupada e a 1 livre', async () => {
      const { base, spec, entregar } = await andaresComOrigem()
      await partida(spec, 1, '2')
      entregar(1, 2, { 'apps/web/a.ts': 'a\n' })
      const encontro1 = await encontroPreso(base, spec, 1)
      const partida2 = rodar(spec, ['partida', '2', '3'])
      await dormir(JANELA_MS)
      expect(partida2.jaSaiu()).toBe(false)
      encontro1.soltar()
      expect([(await encontro1.terminou).codigo, (await partida2.terminou).codigo]).toEqual([0, 0])
      expect(lerQuadro(spec)?.linhas.map((linha) => [linha.numero, linha.tarefa])).toEqual([[1, null], [2, 3]])
    })

    it('quem espera a trava além do prazo sai com "encontro em curso", e não mexe no quadro', async () => {
      const { base, spec, entregar } = await andaresComOrigem()
      await partida(spec, 1, '2')
      entregar(1, 2, { 'apps/web/a.ts': 'a\n' })
      const encontro1 = await encontroPreso(base, spec, 1)
      const impaciente = await rodar(spec, ['partida', '2', '3'], { EDUCA_QUADRO_PRAZO_DA_TRAVA_MS: '300' }).terminou
      expect(impaciente.codigo).toBe(1)
      expect(impaciente.texto).toMatch(/encontro em curso/)
      expect(linhaDoQuadro(spec, 2)?.tarefa).toBeNull()
      encontro1.soltar()
      expect((await encontro1.terminou).codigo).toBe(0)
    })

    it('sem o flock na máquina o comando recusa, e não muda o quadro sem trava', async () => {
      const { spec } = await andaresComOrigem()
      const sem = await rodar(spec, ['partida', '1', '2'], { PATH: join(spec, 'nao-existe') }).terminou
      expect(sem.codigo).toBe(1)
      expect(sem.texto).toMatch(/flock não rodou/)
      expect(linhaDoQuadro(spec, 1)?.tarefa).toBeNull()
    })

    it('o abrir preso no npm ci não segura a trava, e a linha dele já está em uso: abrir e partida de novo são recusados', async () => {
      const { base, spec, checkouts } = await andaresComOrigem()
      const l1 = checkouts.get(1) ?? ''
      const npm = preso(base, 'npm')
      const ambiente = { EDUCA_COMANDO_DE_INSTALACAO: npm.comando }
      const abertura = rodar(spec, ['abrir', '1', l1], ambiente)
      await aguardarArquivo(npm.chegou)
      // A trava está solta: a partida da linha 2 termina com o npm ci da 1 ainda rodando.
      expect((await rodar(spec, ['partida', '2', '3']).terminou).codigo).toBe(0)
      expect(linhaDoQuadro(spec, 1)).toMatchObject({ abrindo: true, base: 'spec/exemplo' })
      expect(quadro(spec).texto).toMatch(/linha 1: abertura em curso desde \d\d:\d\d/)
      const outraAbertura = await rodar(spec, ['abrir', '1', l1], ambiente).terminou
      expect([outraAbertura.codigo, outraAbertura.texto]).toEqual([1, expect.stringMatching(/a linha 1 está em uso: a abertura dela ainda roda \(npm ci\)\. Se o abrir morreu, rode `node tools\/processo\/linhas\.ts abandonar 1`/) as string])
      const partidaNaLinha = await rodar(spec, ['partida', '1', '2']).terminou
      expect([partidaNaLinha.codigo, partidaNaLinha.texto]).toEqual([1, expect.stringMatching(/a linha 1 está em uso/) as string])
      // Linha que ainda abre não tem trabalho a encontrar, e a spec não se fecha com ela de pé.
      expect((await encontro(spec, 1, { push: false })).texto).toMatch(/a linha 1 não tem trabalho em curso/)
      expect((await fechar(spec, { push: false })).texto).toMatch(/a linha 1 está com a abertura em curso/)
      expect(npm.vezes()).toBe(1)
      npm.soltar()
      expect((await abertura.terminou).codigo).toBe(0)
      expect(linhaDoQuadro(spec, 1)).toMatchObject({ abrindo: false, tarefa: null, desde: null })
      // A volta relê o quadro: a partida da linha 2, feita durante o npm ci, não se perde.
      expect(linhaDoQuadro(spec, 2)).toMatchObject({ tarefa: 3 })
      expect((await rodar(spec, ['partida', '1', '2']).terminou).codigo).toBe(0)
    })

    it('a abertura que termina deixa a linha livre sem a marca dela: a marca só vale enquanto a abertura corre (M5 da retro da X7)', async () => {
      const { spec, checkouts } = await andaresComOrigem()
      const l1 = checkouts.get(1) ?? ''
      const preso = rodar(spec, ['abrir', '1', l1], { EDUCA_COMANDO_DE_INSTALACAO: 'true' })
      expect((await preso.terminou).codigo).toBe(0)
      expect(linhaDoQuadro(spec, 1)).toMatchObject({ abrindo: false, tarefa: null, desde: null })
      expect(linhaDoQuadro(spec, 1)).not.toHaveProperty('abertura')
      expect(readFileSync(join(spec, CAMINHO_DO_QUADRO), 'utf8')).not.toContain('abertura')
    })

    it('o CLI diz na saída quando um ponto de injeção está ligado, e não diz nada quando não está (M5 da retro da X7)', async () => {
      const raiz = mkdtempSync(join(tmpdir(), 'linhas-aviso-'))
      try {
        const desligado = { EDUCA_ENCONTRO_SOB_A_TRAVA: undefined, EDUCA_COMANDO_DE_INSTALACAO: undefined }
        expect((await rodar(raiz, [], desligado).terminou).texto).not.toContain('EDUCA_')
        const daTrava = (await rodar(raiz, [], { ...desligado, EDUCA_ENCONTRO_SOB_A_TRAVA: 'true' }).terminou).texto
        expect(daTrava).toContain('EDUCA_ENCONTRO_SOB_A_TRAVA')
        expect(daTrava).not.toContain('EDUCA_COMANDO_DE_INSTALACAO')
        const daInstalacao = (await rodar(raiz, [], { ...desligado, EDUCA_COMANDO_DE_INSTALACAO: 'true' }).terminou).texto
        expect(daInstalacao).toContain('EDUCA_COMANDO_DE_INSTALACAO')
        expect(daInstalacao).not.toContain('EDUCA_ENCONTRO_SOB_A_TRAVA')
      } finally {
        rmSync(raiz, { recursive: true, force: true })
      }
    })

    it('o npm ci que falha tira a linha do quadro e manda abrir de novo, sem tocar nas outras', async () => {
      const { spec, checkouts } = await andaresComOrigem()
      const l1 = checkouts.get(1) ?? ''
      const daLinha2 = linhaDoQuadro(spec, 2)
      const falhou = await rodar(spec, ['abrir', '1', l1], { EDUCA_COMANDO_DE_INSTALACAO: 'exit 1' }).terminou
      expect(falhou.codigo).not.toBe(0)
      expect(falhou.texto).toMatch(/Abra de novo/)
      expect(numerosDoQuadro(spec)).toEqual([2])
      expect(linhaDoQuadro(spec, 2)).toEqual(daLinha2)
      expect((await rodar(spec, ['abrir', '1', l1], { EDUCA_COMANDO_DE_INSTALACAO: 'true' }).terminou).codigo).toBe(0)
      expect(numerosDoQuadro(spec)).toEqual([1, 2])
    })

    for (const instalou of [true, false]) {
      it(`a volta do abrir à trava espera o encontro que a segura, com o npm ci ${instalou ? 'passando' : 'falhando'}`, async () => {
        const { base, spec, checkouts, entregar } = await andaresComOrigem()
        await partida(spec, 2, '3')
        entregar(2, 3, { 'apps/web/b.ts': 'b\n' })
        const npm = preso(base, 'npm', instalou ? 'true' : 'exit 1')
        const abertura = rodar(spec, ['abrir', '1', checkouts.get(1) ?? ''], { EDUCA_COMANDO_DE_INSTALACAO: npm.comando })
        await aguardarArquivo(npm.chegou)
        const encontro2 = await encontroPreso(base, spec, 2)
        npm.soltar()
        await dormir(JANELA_MS)
        expect(abertura.jaSaiu()).toBe(false)
        expect(linhaDoQuadro(spec, 1)).toMatchObject({ abrindo: true })
        encontro2.soltar()
        const saida = await abertura.terminou
        expect(saida.codigo === 0).toBe(instalou)
        expect(linhaDoQuadro(spec, 1)?.abrindo).toBe(instalou ? false : undefined)
        expect((await encontro2.terminou).codigo).toBe(0)
      })
    }

    it('a volta do abrir à trava com prazo menor que o encontro deixa a linha em uso e manda abandoná-la', async () => {
      const { base, spec, checkouts, entregar } = await andaresComOrigem()
      await partida(spec, 2, '3')
      entregar(2, 3, { 'apps/web/b.ts': 'b\n' })
      const npm = preso(base, 'npm')
      const l1 = checkouts.get(1) ?? ''
      const abertura = rodar(spec, ['abrir', '1', l1], { EDUCA_COMANDO_DE_INSTALACAO: npm.comando, EDUCA_QUADRO_PRAZO_DA_TRAVA_MS: '300' })
      await aguardarArquivo(npm.chegou)
      const encontro2 = await encontroPreso(base, spec, 2)
      npm.soltar()
      const saida = await abertura.terminou
      expect(saida.codigo).not.toBe(0)
      expect(saida.texto).toMatch(/abandonar 1/)
      expect(linhaDoQuadro(spec, 1)).toMatchObject({ abrindo: true })
      // O encontro termina antes do abandonar, que também pega a trava.
      encontro2.soltar()
      expect((await encontro2.terminou).codigo).toBe(0)
      expect((await rodar(spec, ['abandonar', '1']).terminou).codigo).toBe(0)
      expect(numerosDoQuadro(spec)).toEqual([2])
      expect((await rodar(spec, ['abrir', '1', l1], { EDUCA_COMANDO_DE_INSTALACAO: 'true' }).terminou).codigo).toBe(0)
    })

    it('o abrir da linha 1 durante o encontro da linha 2 espera a trava, e só então prepara e instala', async () => {
      const { base, spec, checkouts, entregar } = await andaresComOrigem()
      await partida(spec, 2, '3')
      entregar(2, 3, { 'apps/web/b.ts': 'b\n' })
      const encontro2 = await encontroPreso(base, spec, 2)
      const npm = preso(base, 'npm')
      const abertura = rodar(spec, ['abrir', '1', checkouts.get(1) ?? ''], { EDUCA_COMANDO_DE_INSTALACAO: npm.comando })
      await dormir(JANELA_MS)
      expect(abertura.jaSaiu()).toBe(false)
      expect(npm.vezes()).toBe(0)
      encontro2.soltar()
      await aguardarArquivo(npm.chegou)
      npm.soltar()
      expect([(await encontro2.terminou).codigo, (await abertura.terminou).codigo]).toEqual([0, 0])
      expect(npm.vezes()).toBe(1)
      expect(linhaDoQuadro(spec, 1)).toMatchObject({ abrindo: false, tarefa: null })
    })

    it('o abrir que volta depois de a linha ser abandonada e aberta de novo não toca na abertura do outro', async () => {
      const { base, spec, checkouts } = await andaresComOrigem()
      const l1 = checkouts.get(1) ?? ''
      const [npmA, npmB] = [preso(base, 'npmA'), preso(base, 'npmB')] as const
      const aberturaA = rodar(spec, ['abrir', '1', l1], { EDUCA_COMANDO_DE_INSTALACAO: npmA.comando })
      await aguardarArquivo(npmA.chegou)
      expect((await rodar(spec, ['abandonar', '1']).terminou).codigo).toBe(0)
      const aberturaB = rodar(spec, ['abrir', '1', l1], { EDUCA_COMANDO_DE_INSTALACAO: npmB.comando })
      await aguardarArquivo(npmB.chegou)
      npmA.soltar()
      const saidaA = await aberturaA.terminou
      expect([saidaA.codigo, saidaA.texto]).toEqual([1, expect.stringMatching(/foi abandonada enquanto o npm ci rodava/) as string])
      // A abertura de B segue em curso: a linha continua em uso, e a partida a recusa.
      expect(linhaDoQuadro(spec, 1)).toMatchObject({ abrindo: true })
      expect((await rodar(spec, ['partida', '1', '2']).terminou).texto).toMatch(/a linha 1 está em uso/)
      npmB.soltar()
      expect((await aberturaB.terminou).codigo).toBe(0)
      expect(linhaDoQuadro(spec, 1)).toMatchObject({ abrindo: false, tarefa: null })
    })

    it('a linha abandonada durante o npm ci não volta quando ele termina', async () => {
      const { base, spec, checkouts } = await andaresComOrigem()
      const npm = preso(base, 'npm')
      const abertura = rodar(spec, ['abrir', '1', checkouts.get(1) ?? ''], { EDUCA_COMANDO_DE_INSTALACAO: npm.comando })
      await aguardarArquivo(npm.chegou)
      const abandono = await rodar(spec, ['abandonar', '1']).terminou
      expect([abandono.codigo, abandono.texto]).toEqual([0, expect.stringMatching(/tirada do quadro: a abertura dela não terminou/) as string])
      npm.soltar()
      const saida = await abertura.terminou
      expect([saida.codigo, saida.texto]).toEqual([1, expect.stringMatching(/foi abandonada enquanto o npm ci rodava/) as string])
      expect(numerosDoQuadro(spec)).toEqual([2])
    })

    it('RF6: abandonar solta a linha, deixa a branch e não mexe nas outras', async () => {
      const { spec, git } = await andaresComOrigem()
      await partida(spec, 1, '2')
      await partida(spec, 2, '3')
      const daLinha1 = linhaDoQuadro(spec, 1)
      const solta = await abandonar(spec, 2)
      expect(solta.codigo, solta.texto).toBe(0)
      expect(solta.texto).toMatch(/a tarefa 3\.0 deixou de ser dela/)
      expect(linhaDoQuadro(spec, 2)).toMatchObject({ tarefa: null, correcao: null, desde: null })
      expect(linhaDoQuadro(spec, 1)).toEqual(daLinha1)
      expect(git(spec, 'branch', '--list', 'spec/exemplo--l2')).toContain('spec/exemplo--l2')
      expect(textoDoQuadro(spec)).toContain('linha 2: ociosa')
      expect(textoDoQuadro(spec)).toContain('linha 1: tarefa 2.0')
      // O que ela fazia volta a ser pendente: parte de novo.
      expect((await partida(spec, 2, '3')).codigo).toBe(0)
      expect((await abandonar(spec, 1)).codigo).toBe(0)
      expect((await abandonar(spec, 1)).texto).toMatch(/a linha 1 já está livre/)
      // A correção solta como a tarefa.
      await partida(spec, 1, 'correcao:fuso')
      expect((await abandonar(spec, 1)).texto).toMatch(/a correção fuso deixou de ser dela/)
      expect(linhaDoQuadro(spec, 1)).toMatchObject({ tarefa: null, correcao: null, desde: null })
      expect((await abandonar(spec, 3)).texto).toMatch(/a linha 3 não está aberta/)
      expect(linhaDoQuadro(spec, 2)).toMatchObject({ tarefa: 3 })
    })

    it('RF6: abandonar a linha 3 durante o encontro da linha 1 espera, e a 3 fica livre e não volta', async () => {
      const { base, spec, entregar } = await andaresComOrigem([1, 2, 3])
      await partida(spec, 1, '2')
      await partida(spec, 3, '3')
      entregar(1, 2, { 'apps/web/a.ts': 'a\n' })
      const encontro1 = await encontroPreso(base, spec, 1)
      const abandono = rodar(spec, ['abandonar', '3'])
      await dormir(JANELA_MS)
      expect(abandono.jaSaiu()).toBe(false)
      encontro1.soltar()
      expect([(await encontro1.terminou).codigo, (await abandono.terminou).codigo]).toEqual([0, 0])
      expect(lerQuadro(spec)?.linhas.map((linha) => [linha.numero, linha.tarefa])).toEqual([[1, null], [2, null], [3, null]])
    })

    it('o fechar durante o encontro espera, e fecha o quadro quando tudo se encontrou', async () => {
      const { base, spec, entregar } = await andaresComOrigem([1])
      await partida(spec, 1, '2')
      entregar(1, 2, { 'apps/web/a.ts': 'a\n' })
      const encontro1 = await encontroPreso(base, spec, 1)
      const fechamento = rodar(spec, ['fechar'])
      await dormir(JANELA_MS)
      expect(fechamento.jaSaiu()).toBe(false)
      expect(existsSync(join(spec, CAMINHO_DO_QUADRO))).toBe(true)
      encontro1.soltar()
      expect([(await encontro1.terminou).codigo, (await fechamento.terminou).codigo]).toEqual([0, 0])
      expect(existsSync(join(spec, CAMINHO_DO_QUADRO))).toBe(false)
    })

    describe('RF3: o encontro verifica o merge antes de avançar a spec', () => {
      const git2 = (...argumentos: string[]) => execFileSync('git', argumentos, { encoding: 'utf8', stdio: 'pipe' }).trim()
      const naOrigem = (base: string) => git2('--git-dir', join(base, 'origem.git'), 'rev-parse', 'spec/exemplo')
      /** A verificação que o lint do exemplo faria: vermelha quando o marcador está nos dois arquivos, que só juntos o têm. */
      const MARCADOR_NOS_DOIS = "if grep -qs MARCA apps/web/a.ts && grep -qs MARCA apps/web/b.ts; then exit 1; fi"
      const processoVivo = (pid: string) => {
        try {
          // `Z` é o que morreu e ainda não foi recolhido: já não escreve em nada.
          return !readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1]?.startsWith('Z')
        } catch {
          return false
        }
      }

      it('duas linhas verdes que juntas quebram o lint: código próprio, a spec não anda, a linha volta, sem push, linha ocupada', async () => {
        const { base, spec, git, checkouts, entregar } = await andaresComOrigem()
        const l2 = checkouts.get(2) ?? ''
        await partida(spec, 1, '2')
        await partida(spec, 2, '3')
        entregar(1, 2, { 'apps/web/a.ts': 'MARCA a\n' })
        entregar(2, 3, { 'apps/web/b.ts': 'MARCA b\n' })
        const primeiro = await encontro(spec, 1, { comandoSobATrava: MARCADOR_NOS_DOIS })
        expect(primeiro.codigo, primeiro.texto).toBe(0)
        const [specDepoisDoPrimeiro, antes] = [git(spec, 'rev-parse', 'HEAD'), git(l2, 'rev-parse', 'HEAD')]
        expect(naOrigem(base)).toBe(specDepoisDoPrimeiro)

        const vermelho = await encontro(spec, 2, { comandoSobATrava: MARCADOR_NOS_DOIS })
        expect(vermelho.codigo).toBe(CODIGO_DA_VERIFICACAO)
        expect(CODIGO_DA_VERIFICACAO).toBe(5)
        expect(git(spec, 'rev-parse', 'HEAD')).toBe(specDepoisDoPrimeiro)
        expect(naOrigem(base)).toBe(specDepoisDoPrimeiro)
        expect(git(l2, 'rev-parse', 'HEAD')).toBe(antes)
        expect(git(l2, 'status', '--porcelain')).toBe('')
        expect(existsSync(join(l2, 'apps/web/a.ts'))).toBe(false)
        // A linha segue ocupada pela tarefa dela: o conserto é dela.
        expect(linhaDoQuadro(spec, 2)).toMatchObject({ tarefa: 3 })
        expect(textoDoQuadro(spec)).toContain('linha 2: tarefa 3.0')
        expect(vermelho.texto).toContain(`a linha 2 voltou ao commit ${antes.slice(0, 7)}, de antes do merge`)
        expect(vermelho.texto).toContain('a spec/exemplo não andou e não houve push')
        expect(vermelho.texto).toContain('slug encontro-3')
        expect(vermelho.texto).toContain('o Implementador 2 roda `git merge spec/exemplo`')
        expect(vermelho.texto).toContain(`Comando: ${MARCADOR_NOS_DOIS}`)
        expect(vermelho.texto).toMatch(/a tipagem ou o lint .* falhou/)
      })

      it('as duas verdes que juntas passam: a verificação roda no checkout da linha, depois do merge, e a spec avança por --ff-only', async () => {
        const { spec, git, checkouts, entregar } = await andaresComOrigem()
        const l2 = checkouts.get(2) ?? ''
        await partida(spec, 1, '2')
        await partida(spec, 2, '3')
        entregar(1, 2, { 'apps/web/a.ts': 'a\n' })
        entregar(2, 3, { 'apps/web/b.ts': 'b\n' })
        // Só o checkout da linha 2, com o merge feito, tem os dois arquivos: o cwd e a ordem estão neste comando.
        const comandoDaLinha2 = 'test -e apps/web/a.ts && test -e apps/web/b.ts'
        expect((await encontro(spec, 1)).codigo).toBe(0)
        const passou = await encontro(spec, 2, { comandoSobATrava: comandoDaLinha2 })
        expect(passou.codigo, passou.texto).toBe(0)
        expect(passou.texto).toContain(`Verificação do merge: passou (${comandoDaLinha2}), com prazo de 180 s.`)
        expect(git(spec, 'rev-parse', 'HEAD')).toBe(git(l2, 'rev-parse', 'HEAD'))
        expect(git(spec, 'log', '--merges', '--format=%s', '-1')).toMatch(/^Merge branch 'spec\/exemplo' into spec\/exemplo--l2/)
        expect(linhaDoQuadro(spec, 2)).toMatchObject({ tarefa: null })
      })

      describe('o npm ci, quando o lock mudou', () => {
        /** O `npm ci` e a verificação injetados contam a vez e a ordem num arquivo fora do checkout. */
        const comandos = (base: string, instalar = 'true') => {
          const registro = join(base, 'ordem.txt')
          return {
            lido: () => (existsSync(registro) ? readFileSync(registro, 'utf8').split('\n').filter((linha) => linha !== '') : []),
            comandoDeInstalacao: `echo npm-ci >> '${registro}'; ${instalar}`,
            comandoSobATrava: `echo verificacao >> '${registro}'`,
          }
        }

        it('lock alterado pela spec: o npm ci roda antes da verificação, com o prazo de 6 min; lock igual: não roda, com o de 3', async () => {
          const { base, spec, entregar } = await andaresComOrigem()
          await partida(spec, 1, '2')
          await partida(spec, 2, '3')
          entregar(1, 2, { 'apps/web/a.ts': 'a\n', 'package-lock.json': '{"versao":1}\n' })
          entregar(2, 3, { 'apps/web/b.ts': 'b\n' })
          const { lido, ...injetados } = comandos(base)
          // Na linha 1 o lock é dela, e a spec não traz nada dele: a árvore dela já tem o que o lock manda.
          const semLock = await encontro(spec, 1, injetados)
          expect(semLock.codigo, semLock.texto).toBe(0)
          expect(lido()).toEqual(['verificacao'])
          expect(semLock.texto).toContain('com prazo de 180 s')
          // Na linha 2 a spec traz o lock da linha 1: o ambiente da linha 2 não o tem.
          const comLock = await encontro(spec, 2, injetados)
          expect(comLock.codigo, comLock.texto).toBe(0)
          expect(lido()).toEqual(['verificacao', 'npm-ci', 'verificacao'])
          expect(comLock.texto).toContain('com prazo de 360 s')
          expect(comLock.texto).toContain(`Verificação do merge: passou ((${injetados.comandoDeInstalacao}) && (${injetados.comandoSobATrava}))`)
        })

        it('lock da própria linha e código novo da spec: a árvore dela já tem o lock, e o npm ci não roda', async () => {
          const { base, spec, entregar } = await andaresComOrigem()
          await partida(spec, 1, '2')
          await partida(spec, 2, '3')
          entregar(1, 2, { 'apps/web/a.ts': 'a\n' })
          entregar(2, 3, { 'apps/web/b.ts': 'b\n', 'package-lock.json': '{"versao":1}\n' })
          const { lido, ...injetados } = comandos(base)
          expect((await encontro(spec, 1, injetados)).codigo).toBe(0)
          // A spec traz o a.ts da linha 1 e nenhum lock: o merge muda a árvore, e o lock fica como o da linha 2 o deixou.
          const comCodigo = await encontro(spec, 2, injetados)
          expect(comCodigo.codigo, comCodigo.texto).toBe(0)
          expect(lido()).toEqual(['verificacao', 'verificacao'])
        })

        it('o npm ci que falha é vermelho, e a verificação nem roda: a linha volta e a spec não anda', async () => {
          const { base, spec, git, checkouts, entregar } = await andaresComOrigem()
          const l2 = checkouts.get(2) ?? ''
          await partida(spec, 1, '2')
          await partida(spec, 2, '3')
          entregar(1, 2, { 'apps/web/a.ts': 'a\n', 'package-lock.json': '{"versao":1}\n' })
          entregar(2, 3, { 'apps/web/b.ts': 'b\n' })
          const { lido, ...injetados } = comandos(base, 'exit 1')
          expect((await encontro(spec, 1, injetados)).codigo).toBe(0)
          const [specAntes, linhaAntes] = [git(spec, 'rev-parse', 'HEAD'), git(l2, 'rev-parse', 'HEAD')]
          const vermelho = await encontro(spec, 2, injetados)
          expect(vermelho.codigo).toBe(CODIGO_DA_VERIFICACAO)
          expect(vermelho.texto).toContain('o npm ci, se o lock mudou')
          expect(lido()).toEqual(['verificacao', 'npm-ci'])
          expect(git(spec, 'rev-parse', 'HEAD')).toBe(specAntes)
          expect(git(l2, 'rev-parse', 'HEAD')).toBe(linhaAntes)
        })
      })

      describe('o comando padrão, com um npm de mentira no PATH que conta o que recebeu', () => {
        /** O `npm` do PATH: grava os argumentos que recebeu e sai 1 no que `falha` diz. Nenhum `npm` de verdade roda. */
        function npmDeMentira(base: string, falha = '') {
          const bin = join(base, 'bin')
          const registro = join(base, 'npm.txt')
          mkdirSync(bin)
          writeFileSync(join(bin, 'npm'), `#!/bin/sh\necho "$*" >> '${registro}'\n[ "$*" != '${falha}' ]\n`, { mode: 0o755 })
          return { bin, lido: () => (existsSync(registro) ? readFileSync(registro, 'utf8').split('\n').filter((linha) => linha !== '') : []) }
        }
        async function comNpm<T>(bin: string, corpo: () => Promise<T>): Promise<T> {
          const antes = process.env['PATH']
          process.env['PATH'] = `${bin}:${antes ?? ''}`
          try {
            return await corpo()
          } finally {
            if (antes === undefined) delete process.env['PATH']
            else process.env['PATH'] = antes
          }
        }

        it('sem lock novo: npm run typecheck e npm run lint, nessa ordem, e o encontro avança', async () => {
          const { base, spec, git, entregar } = await andaresComOrigem([1])
          await partida(spec, 1, '2')
          entregar(1, 2, { 'apps/web/a.ts': 'a\n' })
          const { bin, lido } = npmDeMentira(base)
          expect(COMANDO_DA_VERIFICACAO).toBe('npm run typecheck && npm run lint')
          const passou = await comNpm(bin, () => encontroDeVerdade(spec, 1, { push: false }))
          expect(passou.codigo, passou.texto).toBe(0)
          expect(lido()).toEqual(['run typecheck', 'run lint'])
          expect(passou.texto).toContain(`Verificação do merge: passou (${COMANDO_DA_VERIFICACAO}), com prazo de 180 s.`)
          expect(git(spec, 'log', '-1', '--format=%s', '--', 'apps/web/a.ts')).toBe('Entrega (tarefa 2.0)')
        })

        it('com o lock novo da spec: npm ci antes, e o lint vermelho recusa o encontro depois da tipagem', async () => {
          const { base, spec, git, checkouts, entregar } = await andaresComOrigem()
          const l2 = checkouts.get(2) ?? ''
          await partida(spec, 1, '2')
          await partida(spec, 2, '3')
          entregar(1, 2, { 'apps/web/a.ts': 'a\n', 'package-lock.json': '{"versao":1}\n' })
          entregar(2, 3, { 'apps/web/b.ts': 'b\n' })
          const { bin, lido } = npmDeMentira(base, 'run lint')
          expect((await comNpm(bin, () => encontro(spec, 1))).codigo).toBe(0)
          const [specAntes, linhaAntes] = [git(spec, 'rev-parse', 'HEAD'), git(l2, 'rev-parse', 'HEAD')]
          const vermelho = await comNpm(bin, () => encontroDeVerdade(spec, 2, { push: false }))
          expect(vermelho.codigo, vermelho.texto).toBe(CODIGO_DA_VERIFICACAO)
          expect(lido()).toEqual(['ci', 'run typecheck', 'run lint'])
          expect(vermelho.texto).toContain(`Comando: (npm ci) && (${COMANDO_DA_VERIFICACAO})`)
          expect(git(spec, 'rev-parse', 'HEAD')).toBe(specAntes)
          expect(git(l2, 'rev-parse', 'HEAD')).toBe(linhaAntes)
        })
      })

      it('verificação acima do prazo injetado é tratada como vermelha: o SIGTERM vem primeiro e o grupo que o atende sai sem esperar o SIGKILL', async () => {
        const { base, spec, git, checkouts, entregar } = await andaresComOrigem()
        const l1 = checkouts.get(1) ?? ''
        await partida(spec, 1, '2')
        entregar(1, 2, { 'apps/web/a.ts': 'a\n' })
        const [specAntes, antes] = [git(spec, 'rev-parse', 'HEAD'), git(l1, 'rev-parse', 'HEAD')]
        const termo = join(base, 'termo.txt')
        const ouvintes = ['SIGINT', 'SIGTERM', 'SIGHUP'].map((sinal) => process.listenerCount(sinal))
        const comeco = Date.now()
        // Atender o SIGTERM leva 300 ms: a espera até o SIGKILL (10 s) tem de esperar por ele, e não o dispensar.
        const lenta = await encontro(spec, 1, {
          comandoSobATrava: `trap "sleep 0.3; echo atendi > '${termo}'; exit 0" TERM; sleep 8 & wait`,
          prazoDaVerificacaoMs: 400,
          esperaAteSigkillMs: 10_000,
        })
        expect(Date.now() - comeco).toBeLessThan(8_000)
        expect(lenta.codigo, lenta.texto).toBe(CODIGO_DA_VERIFICACAO)
        expect(lenta.texto).toContain('a verificação passou de 0.4 s e foi morta: vale como vermelha')
        expect(readFileSync(termo, 'utf8')).toBe('atendi\n')
        expect(git(spec, 'rev-parse', 'HEAD')).toBe(specAntes)
        expect(git(l1, 'rev-parse', 'HEAD')).toBe(antes)
        expect(linhaDoQuadro(spec, 1)).toMatchObject({ tarefa: 2 })
        // Os ouvintes de sinal só existem durante a verificação.
        expect(['SIGINT', 'SIGTERM', 'SIGHUP'].map((sinal) => process.listenerCount(sinal))).toEqual(ouvintes)
      })

      it('a linha de correção que não passa diz o slug dela', async () => {
        const { spec, checkouts, entregar } = await andaresComOrigem([1])
        await partida(spec, 1, 'correcao:fuso')
        entregar(1, 0, { 'apps/web/fuso.ts': 'f\n' }, '(correção fuso)')
        expect(checkouts.get(1)).toBeDefined()
        const vermelho = await encontro(spec, 1, { comandoSobATrava: 'exit 1' })
        expect(vermelho.codigo, vermelho.texto).toBe(CODIGO_DA_VERIFICACAO)
        expect(vermelho.texto).toContain('slug encontro-fuso')
        expect(vermelho.texto).toContain('(correção fuso)')
      })

      it('o reset que falha não esconde: a saída diz que a linha não voltou e o comando para desfazer', async () => {
        const { spec, git, checkouts, entregar } = await andaresComOrigem()
        const l1 = checkouts.get(1) ?? ''
        await partida(spec, 1, '2')
        entregar(1, 2, { 'apps/web/a.ts': 'a\n' })
        const antes = git(l1, 'rev-parse', 'HEAD')
        // O `index.lock` da árvore da linha faz o `git reset --hard` falhar.
        const trava = join(git(l1, 'rev-parse', '--absolute-git-dir'), 'index.lock')
        const preso = await encontro(spec, 1, { comandoSobATrava: `: > '${trava}'; exit 1` })
        rmSync(trava, { force: true })
        expect(preso.codigo).toBe(CODIGO_DA_VERIFICACAO)
        expect(preso.texto).toContain('A LINHA NÃO VOLTOU')
        expect(preso.texto).toContain(`git reset --hard ${antes}`)
        expect(preso.texto).not.toContain('Nada avançou')
      })

      describe('a ordem: o grupo morre, a linha volta, e só então a trava se solta', () => {
        /**
         * A verificação abre um neto que ignora o SIGTERM e escreve no arquivo versionado até o SIGKILL. `termina` é o que o
         * líder faz depois de o neto estar de pé: `exit 1` é o vermelho, `sleep 60` é o que passa do prazo.
         */
        function verificacaoComNeto(base: string, termina: string, alvo = 'versionado.txt') {
          const pid = join(base, 'neto.pid')
          // Desiste sozinho em uns 30 s: o neto que sobra de um caso que falhou não gira para sempre.
          const neto = `trap "" TERM; echo $$ > '${pid}'; n=0; while [ $n -lt 1500 ]; do echo x >> '${alvo}'; sleep 0.02; n=$((n+1)); done`
          return { pid, comando: `echo saida-da-verificacao-$((40+2)); echo erro-da-verificacao-$((50+3)) >&2; sh -c '${neto}' & while [ ! -e '${pid}' ]; do sleep 0.02; done; ${termina}` }
        }

        /** Quem pega a trava logo que o encontro a solta, e só lê o disco: a ref do HEAD da linha e o estado do neto. */
        function espiaDaTrava(base: string, spec: string, checkout: string, pid: string) {
          const programa = join(base, 'espia.mjs')
          const saida = join(base, 'espia.json')
          writeFileSync(
            programa,
            [
              "import { existsSync, readFileSync, writeFileSync } from 'node:fs'",
              "import { join, resolve } from 'node:path'",
              'const [checkout, ramo, pid, saida] = process.argv.slice(2)',
              // O checkout é um worktree: `.git` é um arquivo com `gitdir:`, e a ref da branch fica no diretório comum.
              "const gitdir = readFileSync(join(checkout, '.git'), 'utf8').trim().replace(/^gitdir: /, '')",
              "const comum = resolve(gitdir, readFileSync(join(gitdir, 'commondir'), 'utf8').trim())",
              "const solto = join(comum, 'refs/heads', ramo)",
              'const ref = existsSync(solto)',
              "  ? readFileSync(solto, 'utf8').trim()",
              "  : readFileSync(join(comum, 'packed-refs'), 'utf8').split('\\n').find((linha) => linha.endsWith(` refs/heads/${ramo}`)).split(' ')[0]",
              "let estado = 'sumiu'",
              "try { estado = readFileSync(`/proc/${readFileSync(pid, 'utf8').trim()}/stat`, 'utf8').split(') ')[1].split(' ')[0] } catch {}",
              'writeFileSync(saida, JSON.stringify({ ref, estado }))',
            ].join('\n'),
          )
          const filho = spawn('flock', [join(spec, CAMINHO_DA_TRAVA), process.execPath, programa, checkout, branchDaLinha('spec/exemplo', 1), pid, saida], { stdio: 'ignore' })
          filhos.push(filho)
          const terminou = new Promise<{ ref: string; estado: string }>((resolver) => filho.once('close', () => resolver(JSON.parse(readFileSync(saida, 'utf8')) as { ref: string; estado: string })))
          return { terminou }
        }

        for (const [nome, termina, ambiente, limiteMs] of [
          // Com a espera de 400 ms até o SIGKILL, e não os 5 s do padrão, o vermelho acaba em uns 500 ms.
          ['vermelho', 'exit 1', {}, 3_500],
          ['prazo', 'sleep 60', { EDUCA_ENCONTRO_PRAZO_DA_VERIFICACAO_MS: '3000' }, 7_500],
        ] as const) {
          it(`${nome}: quem pega a trava lê a ref já no commit de antes do merge, o neto morto e o checkout limpo`, async () => {
            const { base, spec, git, checkouts, entregar } = await andaresComOrigem()
            const l1 = checkouts.get(1) ?? ''
            await partida(spec, 1, '2')
            entregar(1, 2, { 'apps/web/a.ts': 'a\n', 'versionado.txt': 'v\n' })
            const antes = git(l1, 'rev-parse', 'HEAD')
            const { pid, comando } = verificacaoComNeto(base, termina)
            const encontroDaLinha1 = rodar(spec, ['encontro', '1'], { EDUCA_ENCONTRO_SOB_A_TRAVA: comando, EDUCA_ENCONTRO_ESPERA_ATE_SIGKILL_MS: '400', ...ambiente })
            await aguardarArquivo(pid)
            const comeco = Date.now()
            // A trava está com o encontro; este espera nela, e só lê o disco quando a pega.
            const espia = espiaDaTrava(base, spec, l1, pid)
            // A espia tem de pegar a trava enquanto o encontro a segura; se ele já saiu, o teste não provaria a ordem.
            expect(encontroDaLinha1.jaSaiu()).toBe(false)
            const saida = await encontroDaLinha1.terminou
            expect(saida.codigo, saida.texto).toBe(CODIGO_DA_VERIFICACAO)
            expect(Date.now() - comeco).toBeLessThan(limiteMs)
            // O que a verificação escreve vai para o erro do encontro: quem lê vê o que quebrou. O 42 só existe na saída dela.
            expect(saida.texto).toContain('saida-da-verificacao-42')
            expect(saida.texto).toContain('erro-da-verificacao-53')
            const visto = await espia.terminou
            expect(visto.ref).toBe(antes)
            expect(['sumiu', 'Z']).toContain(visto.estado)
            expect(processoVivo(readFileSync(pid, 'utf8').trim())).toBe(false)
            // Matar veio antes de voltar: o neto escrevia no arquivo versionado até o SIGKILL, e o reset veio depois.
            expect(git(l1, 'status', '--porcelain')).toBe('')
            expect(readFileSync(join(l1, 'versionado.txt'), 'utf8')).toBe('v\n')
          })
        }

        it('a verificação que passa e deixa um neto de pé também não o deixa: o grupo morre, e a spec avança', async () => {
          const { base, spec, git, checkouts, entregar } = await andaresComOrigem()
          const l1 = checkouts.get(1) ?? ''
          await partida(spec, 1, '2')
          entregar(1, 2, { 'apps/web/a.ts': 'a\n' })
          const { pid, comando } = verificacaoComNeto(base, 'exit 0', join(base, 'neto.log'))
          const passou = await encontro(spec, 1, { comandoSobATrava: comando, esperaAteSigkillMs: 400, push: false })
          expect(passou.codigo, passou.texto).toBe(0)
          expect(processoVivo(readFileSync(pid, 'utf8').trim())).toBe(false)
          expect(git(spec, 'rev-parse', 'HEAD')).toBe(git(l1, 'rev-parse', 'HEAD'))
        })

        for (const sinal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
        it(`o encontro que recebe ${sinal} mata o grupo, volta a linha e sai com o código da verificação`, async () => {
          const { base, spec, git, checkouts, entregar } = await andaresComOrigem()
          const l1 = checkouts.get(1) ?? ''
          await partida(spec, 1, '2')
          entregar(1, 2, { 'apps/web/a.ts': 'a\n', 'versionado.txt': 'v\n' })
          const antes = git(l1, 'rev-parse', 'HEAD')
          const { pid, comando } = verificacaoComNeto(base, 'sleep 60')
          const encontroDaLinha1 = rodar(spec, ['encontro', '1'], { EDUCA_ENCONTRO_SOB_A_TRAVA: comando, EDUCA_ENCONTRO_ESPERA_ATE_SIGKILL_MS: '400' })
          await aguardarArquivo(pid)
          encontroDaLinha1.sinal(sinal)
          const saida = await encontroDaLinha1.terminou
          expect([saida.codigo, saida.texto]).toEqual([CODIGO_DA_VERIFICACAO, expect.stringContaining('recebeu um sinal de fim') as string])
          expect(processoVivo(readFileSync(pid, 'utf8').trim())).toBe(false)
          expect(git(l1, 'rev-parse', 'HEAD')).toBe(antes)
          expect(git(l1, 'status', '--porcelain')).toBe('')
          expect(linhaDoQuadro(spec, 1)).toMatchObject({ tarefa: 2 })
        })
        }
      })

      it('o prazo da verificação é de 3 min, ou 6 com o npm ci, e quem espera a trava espera mais que isso e o SIGKILL', () => {
        expect([PRAZO_DA_VERIFICACAO_MS, PRAZO_DA_VERIFICACAO_COM_NPM_CI_MS, ESPERA_ATE_SIGKILL_MS]).toEqual([3 * 60_000, 6 * 60_000, 5_000])
        expect([prazoDaVerificacao(false), prazoDaVerificacao(true)]).toEqual([PRAZO_DA_VERIFICACAO_MS, PRAZO_DA_VERIFICACAO_COM_NPM_CI_MS])
        expect([prazoDaVerificacao(false, { prazoDaVerificacaoMs: 400 }), prazoDaVerificacao(true, { prazoDaVerificacaoMs: 400 })]).toEqual([400, 400])
        expect(PRAZO_DA_TRAVA_MS).toBeGreaterThan(PRAZO_DA_VERIFICACAO_COM_NPM_CI_MS + ESPERA_ATE_SIGKILL_MS)
      })
    })

    it('o prazo da trava é o de 7 min, e o ambiente só o troca por um número', () => {
      expect(PRAZO_DA_TRAVA_MS).toBe(7 * 60 * 1000)
      expect(
        opcoesDoAmbiente({
          EDUCA_QUADRO_PRAZO_DA_TRAVA_MS: '300',
          EDUCA_ENCONTRO_PRAZO_DA_VERIFICACAO_MS: '400',
          EDUCA_ENCONTRO_ESPERA_ATE_SIGKILL_MS: '500',
          EDUCA_COMANDO_DE_INSTALACAO: 'true',
          EDUCA_ENCONTRO_SOB_A_TRAVA: 'false',
        }),
      ).toEqual({ prazoDaTravaMs: 300, prazoDaVerificacaoMs: 400, esperaAteSigkillMs: 500, comandoDeInstalacao: 'true', comandoSobATrava: 'false' })
      for (const nome of ['EDUCA_QUADRO_PRAZO_DA_TRAVA_MS', 'EDUCA_ENCONTRO_PRAZO_DA_VERIFICACAO_MS', 'EDUCA_ENCONTRO_ESPERA_ATE_SIGKILL_MS']) {
        for (const valor of ['logo', '0', '-5', 'Infinity']) expect(opcoesDoAmbiente({ [nome]: valor }), `${nome}=${valor}`).toEqual({})
      }
      expect(CAMINHO_DA_TRAVA).toBe('.processo/linhas.lock')
    })

    it('avisoDoAmbiente: um aviso por ponto de injeção ligado, com o nome dele, e nenhum quando nenhum está', () => {
      expect(avisoDoAmbiente({})).toBeNull()
      expect(avisoDoAmbiente({ EDUCA_QUADRO_PRAZO_DA_TRAVA_MS: '300' })).toBeNull()
      expect(avisoDoAmbiente({ EDUCA_ENCONTRO_SOB_A_TRAVA: 'true' })).toMatch(/^aviso: EDUCA_ENCONTRO_SOB_A_TRAVA está ligada.*no lugar d[ao] .*verificação/)
      expect(avisoDoAmbiente({ EDUCA_COMANDO_DE_INSTALACAO: 'true' })).toMatch(/^aviso: EDUCA_COMANDO_DE_INSTALACAO está ligada.*no lugar do npm ci/)
      const dois = avisoDoAmbiente({ EDUCA_ENCONTRO_SOB_A_TRAVA: 'true', EDUCA_COMANDO_DE_INSTALACAO: 'true' }) ?? ''
      expect(dois.split('\n')).toHaveLength(2)
      expect(dois).toContain('EDUCA_ENCONTRO_SOB_A_TRAVA')
      expect(dois).toContain('EDUCA_COMANDO_DE_INSTALACAO')
      // Variável vazia também troca o comando (`sh -c ''` passa): ligada é "definida", como o `opcoesDoAmbiente` lê.
      expect(avisoDoAmbiente({ EDUCA_ENCONTRO_SOB_A_TRAVA: '' })).toContain('EDUCA_ENCONTRO_SOB_A_TRAVA')
    })

    describe('RF10: o conferir compara com a base gravada, e não sempre com a develop', () => {
      /** A spec com uma tarefa entregue que a `develop` ainda não tem, e o andar de uma correção que nasce de `partirDe`. */
      async function andarDeCorrecao(partirDe: string, slug: string) {
        const montado = await andaresComOrigem([1])
        const { base, spec, git, escrever } = montado
        git(spec, 'branch', 'develop')
        escrever(spec, 'apps/web/a.ts', 'a\n')
        git(spec, 'add', '-A')
        git(spec, 'commit', '-q', '-m', `Entrega (tarefa 2.0)\n\n${REVISADO}`)
        const andar = join(base, `correcao-${slug}`)
        git(spec, 'worktree', 'add', '-q', '-b', `correcao/${slug}`, andar, partirDe)
        // O Maestri copia o que o git ignora do andar de onde o novo nasce: o quadro vai junto, ou não existe.
        if (partirDe !== 'develop') {
          mkdirSync(join(andar, '.processo'), { recursive: true })
          copyFileSync(join(spec, CAMINHO_DO_QUADRO), join(andar, CAMINHO_DO_QUADRO))
        }
        const corrigir = (titulo: string, arquivo: string) => {
          escrever(andar, arquivo, `${titulo}\n`)
          git(andar, 'add', '-A')
          git(andar, 'commit', '-q', '-m', titulo.includes('(correção') ? `${titulo}\n\n${REVISADO}` : titulo)
          git(andar, 'push', '-q', '-u', 'origin', 'HEAD')
        }
        return { ...montado, andar, corrigir }
      }

      it('a correção que nasceu da spec compara com a spec: as tarefas dela não pedem a marca de correção', async () => {
        const { andar, corrigir } = await andarDeCorrecao('spec/exemplo', 'fuso')
        corrigir('Corrige o fuso (correção fuso)', 'apps/web/fuso.ts')
        // Contra a develop, a tarefa 2.0 da spec seria código sem marca de correção.
        expect(conferirEntrega(andar, 'develop', null)).toMatch(/leva código sem \(correção <slug>\) no título/)
        const conferido = conferir(andar)
        expect(conferido.codigo, conferido.texto).toBe(0)
        expect(conferido.texto).toContain('Conferido em correcao/fuso')
      })

      it('o quadro de antes da base gravada ainda diz a spec de onde o andar nasceu', async () => {
        const { andar, corrigir } = await andarDeCorrecao('spec/exemplo', 'antigo')
        const antigo = JSON.parse(readFileSync(join(andar, CAMINHO_DO_QUADRO), 'utf8')) as { linhas: Record<string, unknown>[] }
        for (const linha of antigo.linhas) delete linha['base']
        writeFileSync(join(andar, CAMINHO_DO_QUADRO), JSON.stringify(antigo))
        corrigir('Corrige o antigo (correção antigo)', 'apps/web/antigo.ts')
        const conferido = conferir(andar)
        expect(conferido.codigo, conferido.texto).toBe(0)
      })

      it('a correção que nasceu da develop compara com a develop', async () => {
        const certa = await andarDeCorrecao('develop', 'certa')
        certa.corrigir('Corrige a certa (correção certa)', 'apps/web/certa.ts')
        expect(conferir(certa.andar).codigo).toBe(0)
        const errada = await andarDeCorrecao('develop', 'errada')
        errada.corrigir('Mexe sem a marca', 'apps/web/errada.ts')
        expect(conferir(errada.andar).texto).toMatch(/leva código sem \(correção <slug>\) no título: "Mexe sem a marca"/)
      })

      it('no andar da própria spec, com o quadro, o que se confere continua sendo o que a develop não tem', async () => {
        const { spec, git, escrever } = await andarDeCorrecao('spec/exemplo', 'qualquer')
        escrever(spec, 'apps/web/conserto.ts', 'c\n')
        git(spec, 'add', '-A')
        git(spec, 'commit', '-q', '-m', `Corrige o conserto (correção conserto)\n\n${REVISADO}`)
        git(spec, 'push', '-q', '-u', 'origin', 'HEAD')
        const conferido = conferir(spec)
        expect(conferido.codigo, conferido.texto).toBe(0)
      })
    })
  })
})
