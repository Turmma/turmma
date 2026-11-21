// O hook do portão que não carrega bloqueia o Bash (N7). O comando é LIDO de .claude/settings.json e rodado com
// `sh -c`, como o Claude Code o roda, sobre uma cópia de tools/processo/ que o teste estraga de três jeitos.
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'

interface Gancho {
  matcher: string
  hooks: { type: string; command: string }[]
}

const REPOSITORIO = join(import.meta.dirname, '../..')
const MENSAGEM = 'hook de revisões não carregou: nenhum Bash roda até consertar tools/processo/. Avise o Joaquim.'

function ganchos(evento: 'PreToolUse' | 'SubagentStop'): Gancho[] {
  const configuracao = JSON.parse(readFileSync(join(REPOSITORIO, '.claude/settings.json'), 'utf8')) as { hooks: Record<string, Gancho[]> }
  return configuracao.hooks[evento] ?? []
}

function comandoDe(evento: 'PreToolUse' | 'SubagentStop', modo: 'portao' | 'registrar' | 'escrita'): string {
  const comandos = ganchos(evento).flatMap((gancho) => gancho.hooks.map((hook) => hook.command))
  const achados = comandos.filter((comando) => comando.includes(`hook-revisoes.ts" ${modo}`))
  const [achado] = achados
  // Erro explícito, e chamado de dentro de cada caso: o comando que sumiu do settings.json derruba o caso, com o nome dele.
  if (achados.length !== 1 || achado === undefined) {
    throw new Error(`.claude/settings.json deveria ter um só comando "hook-revisoes.ts ${modo}" em ${evento}, e tem ${String(achados.length)}`)
  }
  return achado
}

const pastas: string[] = []
afterAll(() => {
  for (const pasta of pastas) rmSync(pasta, { recursive: true, force: true })
})

/**
 * Uma cópia de tools/processo/ (sem os testes), pronta para o hook rodar nela. Copia só os `.ts` dessa pasta, que é
 * tudo o que o hook importa hoje: se ele passar a importar arquivo de outra pasta, ou que não seja `.ts`, os casos
 * do hook são saem 2 por falta de módulo, e o conserto é aqui, na cópia, não no hook.
 */
function copia(estragar?: (processo: string) => void): string {
  const raiz = mkdtempSync(join(tmpdir(), 'hook-portao-'))
  pastas.push(raiz)
  const processo = join(raiz, 'tools/processo')
  mkdirSync(processo, { recursive: true })
  for (const arquivo of readdirSync(join(REPOSITORIO, 'tools/processo'))) {
    if (arquivo.endsWith('.ts') && !arquivo.endsWith('.test.ts')) cpSync(join(REPOSITORIO, 'tools/processo', arquivo), join(processo, arquivo))
  }
  estragar?.(processo)
  return raiz
}

function acrescentar(processo: string, arquivo: string, texto: string): void {
  const caminho = join(processo, arquivo)
  writeFileSync(caminho, `${readFileSync(caminho, 'utf8')}\n${texto}\n`)
}

function rodar(comando: string, raiz: string, bash: string, papel?: string) {
  const env: NodeJS.ProcessEnv = { ...process.env, CLAUDE_PROJECT_DIR: raiz }
  delete env['CLAUDE_CODE_AGENT']
  if (papel) env['CLAUDE_CODE_AGENT'] = papel
  const resultado = spawnSync('sh', ['-c', comando], {
    cwd: raiz,
    env,
    encoding: 'utf8',
    input: JSON.stringify({ cwd: raiz, tool_name: 'Bash', tool_input: { command: bash } }),
  })
  return { status: resultado.status, stdout: resultado.stdout, stderr: resultado.stderr }
}

describe('o hook do portão que não carrega bloqueia o Bash', () => {
  const portao = () => comandoDe('PreToolUse', 'portao')

  it('import de módulo que não existe: sai 2 e diz o que fazer', () => {
    const raiz = copia((processo) => acrescentar(processo, 'hook-revisoes.ts', "import './modulo-que-nao-existe.ts'"))
    const saida = rodar(portao(), raiz, 'ls')
    expect(saida.status).toBe(2)
    expect(saida.stderr).toContain(MENSAGEM)
  })

  it('erro de sintaxe em revisoes.ts: sai 2', () => {
    const raiz = copia((processo) => acrescentar(processo, 'revisoes.ts', 'export const quebrado = {{{'))
    const saida = rodar(portao(), raiz, 'ls')
    expect(saida.status).toBe(2)
    expect(saida.stderr).toContain(MENSAGEM)
  })

  it('módulo que lança ao carregar: sai 2', () => {
    const raiz = copia((processo) => acrescentar(processo, 'mutacoes.ts', "throw new Error('lançou na carga')"))
    const saida = rodar(portao(), raiz, 'ls')
    expect(saida.status).toBe(2)
    expect(saida.stderr).toContain(MENSAGEM)
  })

  it('hook são, Bash comum: sai 0 e não diz nada no stdout', () => {
    const saida = rodar(portao(), copia(), 'ls')
    expect(saida.status).toBe(0)
    expect(saida.stdout).toBe('')
    // A mensagem de falha de carga só aparece na falha de carga.
    expect(saida.stderr).not.toContain(MENSAGEM)
  })

  it('hook são, push do time para a develop: sai 0 e o deny da regra passa intacto no stdout', () => {
    const saida = rodar(portao(), copia(), 'git push origin develop', 'implementador')
    expect(saida.status).toBe(0)
    const resposta = JSON.parse(saida.stdout) as { hookSpecificOutput: { permissionDecision: string; permissionDecisionReason: string } }
    expect(resposta.hookSpecificOutput.permissionDecision).toBe('deny')
    // O deny é o da regra, não o do `catch` do hook (que diria "o portão de revisões falhou").
    expect(resposta.hookSpecificOutput.permissionDecisionReason).toContain('Push bloqueado')
    expect(resposta.hookSpecificOutput.permissionDecisionReason).not.toContain('o portão de revisões falhou')
  })

  it('portão que lança com o hook de pé: nega num Bash que não é commit, sai 0 e não diz "Commit bloqueado"', () => {
    const raiz = copia((processo) => {
      const caminho = join(processo, 'comando-git.ts')
      const origem = 'export function desvioDoHook(comando: string): string | null {'
      const texto = readFileSync(caminho, 'utf8')
      expect(texto).toContain(origem)
      writeFileSync(caminho, texto.replace(origem, `${origem}\n  throw new Error('lançou ao ler o comando')`))
    })
    const saida = rodar(portao(), raiz, 'ls', 'implementador')
    expect(saida.status).toBe(0)
    const razao = (JSON.parse(saida.stdout) as { hookSpecificOutput: { permissionDecisionReason: string } }).hookSpecificOutput.permissionDecisionReason
    expect(razao).toContain('Comando bloqueado: o portão de revisões falhou (lançou ao ler o comando)')
    expect(razao).not.toContain('Commit bloqueado')
  })
})

describe('o hook nega o desvio do git hook e a linha Fora do processo (RF14)', () => {
  const portao = () => comandoDe('PreToolUse', 'portao')

  /** A cópia do hook num repositório git: o commit que passa pelo desvio precisa de árvore para a decisão ler. */
  function copiaComGit(): string {
    const raiz = copia()
    execFileSync('git', ['init', '-q'], { cwd: raiz })
    writeFileSync(join(raiz, 'msg.txt'), 'Corrige x\n\nFora do processo: ajuste do Joaquim\n')
    writeFileSync(join(raiz, 'msg-com-desvio.txt'), 'Explica o que o hook nega: --no-verify e CLAUDE_CODE_AGENT=\n')
    return raiz
  }

  /** A decisão que o hook escreveu no stdout, ou `null` quando ele não disse nada. */
  function decisao(saida: { stdout: string }) {
    if (saida.stdout === '') return null
    return (JSON.parse(saida.stdout) as { hookSpecificOutput: { permissionDecision: string; permissionDecisionReason: string } }).hookSpecificOutput
  }

  const negados = [
    { etiqueta: 'no-verify', comando: 'git commit --no-verify -m "x"', motivo: /--no-verify/ },
    { etiqueta: 'no-verify abreviado em verif', comando: 'git commit --no-verif -m "x"', motivo: /--no-verify/ },
    { etiqueta: 'no-verify abreviado em ver', comando: 'git commit --no-ver -m "x"', motivo: /--no-verify/ },
    { etiqueta: 'n no commit', comando: 'git commit -n -m "x"', motivo: /-n, que é --no-verify/ },
    { etiqueta: 'n junto do m', comando: 'git commit -nm "x"', motivo: /-n, que é --no-verify/ },
    // O `-a` leva o `tools/` da cópia: é o único que, fora de papel, o `PreToolUse` recusa, e como código sem marca (M3 da retro da F4b), não como desvio.
    { etiqueta: 'n no meio do bloco', comando: 'git commit -anm "x"', motivo: /-n, que é --no-verify/, levaOTools: true },
    { etiqueta: 'hookspath por c', comando: 'git -c core.hooksPath=/dev/null commit -m "x"', motivo: /core\.hooksPath/ },
    { etiqueta: 'hookspath em maiúsculas', comando: 'git -c core.HOOKSPATH=x commit -m "x"', motivo: /core\.hooksPath/ },
    { etiqueta: 'hookspath por config', comando: 'git config core.hookspath /tmp/x', motivo: /core\.hooksPath/ },
    { etiqueta: 'hookspath desarmado por config', comando: 'git config --unset core.hooksPath', motivo: /core\.hooksPath/ },
    { etiqueta: 'variável do papel vazia', comando: 'CLAUDE_CODE_AGENT= git commit -m "x"', motivo: /mexe em CLAUDE_CODE_AGENT/ },
    { etiqueta: 'unset do papel', comando: 'unset CLAUDE_CODE_AGENT', motivo: /mexe em CLAUDE_CODE_AGENT/ },
    { etiqueta: 'env que tira o papel', comando: 'env -u CLAUDE_CODE_AGENT git commit -m "x"', motivo: /mexe em CLAUDE_CODE_AGENT/ },
    { etiqueta: 'GIT_CONFIG_COUNT', comando: 'GIT_CONFIG_COUNT=1 git commit -m "x"', motivo: /mexe em GIT_CONFIG_COUNT/ },
  ]

  it.each(negados)('com papel, o deny sai no stdout e o hook sai 0: $etiqueta', ({ comando, motivo }) => {
    const saida = rodar(portao(), copiaComGit(), comando, 'implementador')
    expect(saida.status).toBe(0)
    const razao = decisao(saida)?.permissionDecisionReason ?? ''
    expect(decisao(saida)?.permissionDecision).toBe('deny')
    expect(razao).toContain('Comando bloqueado')
    expect(razao).toMatch(motivo)
    // O deny é o da regra, não o do `catch` do hook.
    expect(razao).not.toContain('o portão de revisões falhou')
  })

  it.each(negados.filter(({ levaOTools }) => levaOTools !== true))('sem papel, passa calado: $etiqueta', ({ comando }) => {
    const saida = rodar(portao(), copiaComGit(), comando)
    expect(saida.status).toBe(0)
    expect(saida.stdout).toBe('')
    // Um papel que não é do time também passa: o orquestrador e o subagente de fora do time não têm hook a pular.
    expect(rodar(portao(), copiaComGit(), comando, 'general-purpose').stdout).toBe('')
  })

  it.each([undefined, 'general-purpose'])('sem papel (%s), o desvio com -a não é negado como desvio: o commit leva o tools/ da cópia e é recusado como código sem marca', (papel) => {
    const comando = negados.find(({ levaOTools }) => levaOTools === true)?.comando ?? ''
    expect(comando).toContain('-anm')
    const saida = rodar(portao(), copiaComGit(), comando, papel)
    expect(saida.status).toBe(0)
    expect(decisao(saida)?.permissionDecision).toBe('deny')
    const razao = decisao(saida)?.permissionDecisionReason ?? ''
    expect(razao).toMatch(/^Commit bloqueado: ele leva código \(tools\//)
    expect(razao).not.toContain('Comando bloqueado')
  })

  it.each([
    { etiqueta: 'git log com n', comando: 'git log -n 3' },
    { etiqueta: 'git diff com no-ext-diff', comando: 'git diff --no-ext-diff' },
    { etiqueta: 'git com c de outra chave', comando: 'git -c user.name=x commit -m "x"' },
    { etiqueta: 'git com atribuição de outra variável', comando: 'GIT_AUTHOR_DATE=x git commit -m "x"' },
    { etiqueta: 'grep na variável do papel', comando: 'grep CLAUDE_CODE_AGENT .claude/settings.json' },
    { etiqueta: 'printenv da variável do papel', comando: 'printenv CLAUDE_CODE_AGENT' },
    { etiqueta: 'mensagem em arquivo com o desvio dentro', comando: 'git commit -F msg-com-desvio.txt' },
    { etiqueta: 'leitura do hooksPath', comando: 'git config --get core.hooksPath' },
  ])('com papel, passa calado: $etiqueta', ({ comando }) => {
    const saida = rodar(portao(), copiaComGit(), comando, 'implementador')
    expect(saida.status).toBe(0)
    expect(saida.stdout).toBe('')
  })

  it.each([
    { etiqueta: 'no -m', comando: 'git commit -m "x\n\nFora do processo: ajuste"', dica: true },
    { etiqueta: 'em F separado', comando: 'git commit -F msg.txt', dica: false },
    { etiqueta: 'em F colado', comando: 'git commit -Fmsg.txt', dica: false },
    { etiqueta: 'em file com igual', comando: 'git commit --file=msg.txt', dica: false },
  ])('Fora do processo: negado com e sem papel: $etiqueta', ({ comando, dica }) => {
    for (const papel of [undefined, 'implementador']) {
      const saida = rodar(portao(), copiaComGit(), comando, papel)
      expect(saida.status).toBe(0)
      const razao = decisao(saida)?.permissionDecisionReason ?? ''
      expect(decisao(saida)?.permissionDecision).toBe('deny')
      expect(razao).toContain('Fora do processo:')
      expect(razao).not.toContain('o portão de revisões falhou')
      // Só o termo dentro do -m traz a dica do -F.
      expect(razao.includes('git commit -F <arquivo>')).toBe(dica)
    }
  })
})

describe('o registrar (SubagentStop) fica como está', () => {
  it('não ganha o exit 2: ele impediria o revisor de terminar', () => {
    const registrar = comandoDe('SubagentStop', 'registrar')
    expect(registrar).not.toContain('exit 2')
    expect(registrar).not.toContain('||')
  })

  it('o exit 2 está só nos comandos do portão e da escrita', () => {
    const comandos = [...ganchos('PreToolUse'), ...ganchos('SubagentStop')].flatMap((gancho) => gancho.hooks.map((hook) => hook.command))
    expect(comandos.filter((comando) => comando.includes('exit 2'))).toEqual([comandoDe('PreToolUse', 'portao'), comandoDe('PreToolUse', 'escrita')])
  })
})

describe('o Write não reescreve documento que já tem a seção "Revisões"', () => {
  const escrita = () => comandoDe('PreToolUse', 'escrita')
  const DOCUMENTO = 'tasks/prd-exemplo/3_task.md'
  const TABELA = [
    '| Início | Fim | Revisor | Rodada | Veredito | Agente |',
    '|---|---|---|---|---|---|',
    '| 2026-11-01 10:00:00 | 2026-11-01 10:05:00 | `test-engineer` | 1 | REPROVADO | a1 |',
    '| 2026-11-01 11:00:00 | 2026-11-01 11:05:00 | `test-engineer` | 2 | APROVADO | a2 |',
  ]
  const COM_SECAO = `# Tarefa\n\nTexto antigo.\n\n## Revisões\n\nNota do hook.\n\n${TABELA.join('\n')}\n`

  /** A raiz com o documento já escrito (e o que mais o caso pedir) e o `Write` rodado pelo comando do settings.json. */
  function escrever(arquivos: Record<string, string>, alvo: string | undefined | ((raiz: string) => string), content: string | undefined, papel?: string) {
    const raiz = copia()
    for (const [caminho, texto] of Object.entries(arquivos)) {
      mkdirSync(join(raiz, caminho, '..'), { recursive: true })
      writeFileSync(join(raiz, caminho), texto)
    }
    const env: NodeJS.ProcessEnv = { ...process.env, CLAUDE_PROJECT_DIR: raiz }
    delete env['CLAUDE_CODE_AGENT']
    if (papel) env['CLAUDE_CODE_AGENT'] = papel
    const resultado = spawnSync('sh', ['-c', escrita()], {
      cwd: raiz,
      env,
      encoding: 'utf8',
      input: JSON.stringify({ cwd: raiz, tool_name: 'Write', tool_input: { file_path: typeof alvo === 'function' ? alvo(raiz) : alvo, content } }),
    })
    return { raiz, status: resultado.status, stdout: resultado.stdout, stderr: resultado.stderr }
  }

  it('o gancho do settings.json é do Write', () => {
    const gancho = ganchos('PreToolUse').find((candidato) => candidato.hooks.some((hook) => hook.command === escrita()))
    expect(gancho?.matcher).toBe('Write')
  })

  it('com a tabela inteira, passa calado, também com papel e com o texto em volta mudado', () => {
    const novo = `# Tarefa\n\nTexto novo, bem diferente.\n\n## Revisões\n\n${TABELA.join('\n')}\n`
    for (const papel of [undefined, 'implementador']) {
      const saida = escrever({ [DOCUMENTO]: COM_SECAO }, DOCUMENTO, novo, papel)
      expect(saida.status).toBe(0)
      expect(saida.stderr).toBe('')
    }
  })

  it('sem a seção, recusa com saída 2, diz "Edit" e conta as linhas que somem', () => {
    const saida = escrever({ [DOCUMENTO]: COM_SECAO }, DOCUMENTO, '# Tarefa\n\nSó o texto.\n')
    expect(saida.status).toBe(2)
    expect(saida.stderr).toContain('Write bloqueado')
    expect(saida.stderr).toContain(DOCUMENTO)
    expect(saida.stderr).toContain('não traz 4 de 4 linhas')
    expect(saida.stderr).toContain('Edit')
  })

  it('com a seção sem a primeira rodada, recusa (a 3.0 perdeu a 1ª rodada assim)', () => {
    const novo = `# Tarefa\n\n## Revisões\n\n${[TABELA[0], TABELA[1], TABELA[3]].join('\n')}\n`
    const saida = escrever({ [DOCUMENTO]: COM_SECAO }, DOCUMENTO, novo)
    expect(saida.status).toBe(2)
    expect(saida.stderr).toContain('não traz 1 de 4 linhas')
  })

  it('com a linha de uma rodada alterada, recusa', () => {
    const novo = `# Tarefa\n\n## Revisões\n\n${TABELA.join('\n').replace('REPROVADO', 'APROVADO')}\n`
    const saida = escrever({ [DOCUMENTO]: COM_SECAO }, DOCUMENTO, novo)
    expect(saida.status).toBe(2)
    expect(saida.stderr).toContain('não traz 1 de 4 linhas')
  })

  it('com a tabela acima do título da seção, recusa: o hook acrescenta rodada no fim da seção', () => {
    const novo = `# Tarefa\n\n${TABELA.join('\n')}\n\n## Revisões\n`
    const saida = escrever({ [DOCUMENTO]: COM_SECAO }, DOCUMENTO, novo)
    expect(saida.status).toBe(2)
    expect(saida.stderr).toContain('não traz 4 de 4 linhas')
  })

  it('o caminho absoluto e o relativo à raiz valem igual', () => {
    const alvos = [DOCUMENTO, (raiz: string) => join(raiz, DOCUMENTO), `./${DOCUMENTO}`, 'tasks/prd-exemplo/../prd-exemplo/3_task.md']
    for (const alvo of alvos) {
      const saida = escrever({ [DOCUMENTO]: COM_SECAO }, alvo, 'só texto')
      expect(saida.status, String(alvo)).toBe(2)
      expect(saida.stderr).toContain('não traz 4 de 4 linhas')
    }
  })

  it('arquivo novo, e arquivo que existe sem a seção, passam', () => {
    expect(escrever({}, DOCUMENTO, '# Tarefa nova\n').status).toBe(0)
    expect(escrever({ [DOCUMENTO]: '# Tarefa\n\nSem seção.\n' }, DOCUMENTO, '# Outra\n').status).toBe(0)
  })

  it('arquivo com a seção fora de tasks/ passa, e tasks/ de outra raiz também', () => {
    expect(escrever({ 'docs/exemplo.md': COM_SECAO }, 'docs/exemplo.md', 'só texto').status).toBe(0)
    expect(escrever({ 'tasks-antigas/x.md': COM_SECAO }, 'tasks-antigas/x.md', 'só texto').status).toBe(0)
    // Outra raiz, com o mesmo `tasks/` e a seção: o caminho absoluto dela não é da raiz do hook.
    const outra = copia()
    mkdirSync(join(outra, 'tasks'), { recursive: true })
    writeFileSync(join(outra, 'tasks/x.md'), COM_SECAO)
    expect(escrever({}, join(outra, 'tasks/x.md'), 'só texto').status).toBe(0)
  })

  it('Write sem conteúdo sobre documento com a seção recusa pela tabela que falta, em vez de apagá-la', () => {
    const saida = escrever({ [DOCUMENTO]: COM_SECAO }, DOCUMENTO, undefined)
    expect(saida.status).toBe(2)
    expect(saida.stderr).toContain('não traz 4 de 4 linhas')
  })

  it('entrada sem caminho de arquivo passa: não há documento a proteger', () => {
    expect(escrever({ [DOCUMENTO]: COM_SECAO }, undefined, 'x').status).toBe(0)
  })

  it('falha ao ler o documento recusa e diz que o hook falhou', () => {
    const saida = escrever({ 'tasks/pasta.md/dentro.txt': 'x' }, 'tasks/pasta.md', 'texto')
    expect(saida.status).toBe(2)
    expect(saida.stderr).toContain('o hook de escrita falhou')
  })

  it('hook que não carrega recusa o Write com saída 2 e a mensagem do conserto, e a recusa de verdade não a leva junto', () => {
    const raiz = copia((processo) => acrescentar(processo, 'revisoes.ts', 'export const quebrado = {{{'))
    const saida = spawnSync('sh', ['-c', escrita()], {
      cwd: raiz,
      env: { ...process.env, CLAUDE_PROJECT_DIR: raiz },
      encoding: 'utf8',
      input: JSON.stringify({ cwd: raiz, tool_name: 'Write', tool_input: { file_path: 'tasks/novo.md', content: 'x' } }),
    })
    expect(saida.status).toBe(2)
    expect(saida.stderr).toContain('hook de escrita não carregou')
    const recusa = escrever({ [DOCUMENTO]: COM_SECAO }, DOCUMENTO, 'só texto')
    expect(recusa.stderr).not.toContain('não carregou')
  })
})
