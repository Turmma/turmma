// A seção "Revisões" não se perde por script (correção `2026-11-20-revisoes-nao-se-perdem-por-script`, X6 retro M2).
//
// O gancho do `Write` só vê o `Write`: o script que abre o documento e o reescreve (`python3 … open(p,'w')`, `>` no Bash) leva a tabela
// junto, e o hook volta a contar as rodadas do 1. Aqui o documento é reescrito pelo `writeFileSync`, que é o que o script faz, e o que se
// confere é o que o hook e o portão do commit fazem com o que sumiu: devolvem a linha, avisam, e não tocam no que está inteiro.
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  avisoDeRevisoesDevolvidas,
  caminhoDaCopiaDasRevisoes,
  devolverRevisoesPerdidas,
  gravarCopiaDasRevisoes,
  lerRevisoes,
  linhasDaTabelaDeRevisoes,
  portao,
  registrar,
  restaurarRevisoes,
} from './revisoes.ts'

const DOCUMENTO = 'tasks/prd-exemplo/9_task.md'
const TAREFA = `# Tarefa 9.0 — Exemplo

**Funcionalidade:** exemplo · **Depende de:** 7.0
**Subagentes obrigatórios:** \`test-engineer\`

## Critério de conclusão

- [ ] Revisão aprovada
`

const pastas: string[] = []
afterAll(() => {
  for (const pasta of pastas) rmSync(pasta, { recursive: true, force: true })
})

function repositorio(): string {
  const raiz = mkdtempSync(join(tmpdir(), 'revisoes-perdidas-'))
  pastas.push(raiz)
  execFileSync('git', ['init', '-q'], { cwd: raiz })
  mkdirSync(join(raiz, 'tasks/prd-exemplo'), { recursive: true })
  writeFileSync(join(raiz, DOCUMENTO), TAREFA)
  return raiz
}

const transcripts = mkdtempSync(join(tmpdir(), 'transcripts-perdidas-'))
pastas.push(transcripts)

/** Uma rodada do revisor, como o hook do SubagentStop a registra. Devolve os avisos que o hook deu. */
function rodar(raiz: string, revisor: string, veredito: string, fim: string): string[] {
  const caminho = join(transcripts, `${revisor}-${Math.random().toString(36).slice(2)}.jsonl`)
  const inicio = new Date(`${fim.slice(0, 10)}T00:00:00`).toISOString()
  writeFileSync(caminho, JSON.stringify({ type: 'user', timestamp: inicio, message: { content: `Audite.\nTarefa: ${DOCUMENTO}` } }))
  const avisos: string[] = []
  registrar(
    { agent_type: revisor, agent_id: `a-${revisor}`, agent_transcript_path: caminho, last_assistant_message: `VEREDITO: ${veredito}` },
    raiz,
    new Date(fim),
    (texto) => avisos.push(texto),
  )
  return avisos
}

const ler = (raiz: string) => readFileSync(join(raiz, DOCUMENTO), 'utf8')
const COMMIT = { tool_input: { command: 'git add tasks && git commit -m "Implementa x (tarefa 9.0)\n\nRevisões: ok"' } }

/** O que um script faz: lê o documento, tira o que quer e o reescreve inteiro. */
const reescreverSem = (raiz: string, tirar: (conteudo: string) => string) => writeFileSync(join(raiz, DOCUMENTO), tirar(ler(raiz)))
const semASecao = (conteudo: string) => conteudo.slice(0, conteudo.indexOf('\n## Revisões\n')) + '\n'
const semALinha = (revisor: string) => (conteudo: string) =>
  conteudo
    .split('\n')
    .filter((linha) => !linha.includes(`\`${revisor}\``))
    .join('\n')

describe('a cópia da tabela fica fora de tasks/ e do commit', () => {
  it('cada rodada registrada grava a tabela inteira em .processo/', () => {
    const raiz = repositorio()
    rodar(raiz, 'test-engineer', 'REPROVADO', '2026-11-20T10:00:00')
    const copia = caminhoDaCopiaDasRevisoes(DOCUMENTO)
    expect(copia.startsWith('.processo/')).toBe(true)
    expect(copia.startsWith('tasks/')).toBe(false)
    expect(readFileSync(join(raiz, copia), 'utf8').trimEnd().split('\n')).toEqual(linhasDaTabelaDeRevisoes(ler(raiz)))
    rodar(raiz, 'revisor-geral', 'APROVADO', '2026-11-20T10:05:00')
    expect(readFileSync(join(raiz, copia), 'utf8').trimEnd().split('\n')).toHaveLength(4)
  })

  it('o .gitignore do repositório ignora a pasta da cópia', () => {
    const raiz = join(import.meta.dirname, '../..')
    const saida = execFileSync('git', ['check-ignore', caminhoDaCopiaDasRevisoes(DOCUMENTO)], { cwd: raiz, encoding: 'utf8' })
    expect(saida.trim()).toBe(caminhoDaCopiaDasRevisoes(DOCUMENTO))
  })
})

describe('as pontas da cópia', () => {
  const RODADA = '| 2026-11-20 10:00:00 | 2026-11-20 10:01:00 | `test-engineer` | 1 | APROVADO | a1 |'

  it('a cópia é gravada por arquivo novo e renomeado, e nenhum temporário fica', () => {
    // O arquivo que o processo caído deixaria truncado é o do `writeFileSync` direto, que reabre o mesmo inode; o rename troca o inode.
    const raiz = repositorio()
    rodar(raiz, 'test-engineer', 'APROVADO', '2026-11-20T10:00:00')
    const copia = join(raiz, caminhoDaCopiaDasRevisoes(DOCUMENTO))
    const antes = statSync(copia).ino
    rodar(raiz, 'revisor-geral', 'APROVADO', '2026-11-20T10:05:00')
    expect(statSync(copia).ino).not.toBe(antes)
    expect(readdirSync(dirname(copia))).toEqual([basename(copia)])
  })

  it('documento sem tabela: nenhuma cópia é gravada', () => {
    const raiz = repositorio()
    gravarCopiaDasRevisoes(raiz, DOCUMENTO, ler(raiz))
    expect(existsSync(join(raiz, caminhoDaCopiaDasRevisoes(DOCUMENTO)))).toBe(false)
  })

  it('cópia de um documento que já não existe: nada a devolver, e nada é criado', () => {
    const raiz = repositorio()
    rodar(raiz, 'test-engineer', 'APROVADO', '2026-11-20T10:00:00')
    rmSync(join(raiz, DOCUMENTO))
    expect(restaurarRevisoes(raiz, DOCUMENTO)).toEqual([])
    expect(existsSync(join(raiz, DOCUMENTO))).toBe(false)
  })

  it('o aviso conta as linhas no singular e no plural, e diz "a tabela" quando só o cabeçalho sumiu', () => {
    const outra = RODADA.replace('test-engineer', 'revisor-geral')
    expect(avisoDeRevisoesDevolvidas(DOCUMENTO, [RODADA])).toContain('perdido 1 linha da tabela,')
    expect(avisoDeRevisoesDevolvidas(DOCUMENTO, [RODADA, outra])).toContain('perdido 2 linhas da tabela,')
    expect(avisoDeRevisoesDevolvidas(DOCUMENTO, ['| Início | Fim |'])).toContain('perdido a tabela,')
  })
})

describe('a linha que sumiu volta quando uma rodada nova chega', () => {
  it('documento reescrito por script sem a seção: a 1ª rodada volta, a nova é a 2ª e o hook avisa', () => {
    const raiz = repositorio()
    rodar(raiz, 'test-engineer', 'AJUSTES NECESSÁRIOS', '2026-11-20T10:00:00')
    reescreverSem(raiz, semASecao)
    expect(ler(raiz)).not.toContain('## Revisões')

    const avisos = rodar(raiz, 'test-engineer', 'APROVADO', '2026-11-20T11:00:00')

    expect(lerRevisoes(ler(raiz)).map((r) => [r.revisor, r.rodada, r.veredito])).toEqual([
      ['test-engineer', 1, 'AJUSTES NECESSÁRIOS'],
      ['test-engineer', 2, 'APROVADO'],
    ])
    expect(avisos).toHaveLength(1)
    expect(avisos[0]).toContain(DOCUMENTO)
    expect(avisos[0]).toContain('1 linha da tabela')
  })

  it('documento com a seção, sem uma rodada: só a que sumiu volta, na ordem, e as outras ficam', () => {
    const raiz = repositorio()
    rodar(raiz, 'test-engineer', 'APROVADO', '2026-11-20T10:00:00')
    rodar(raiz, 'revisor-geral', 'AJUSTES NECESSÁRIOS', '2026-11-20T10:05:00')
    const antes = linhasDaTabelaDeRevisoes(ler(raiz))
    reescreverSem(raiz, semALinha('test-engineer'))
    expect(ler(raiz)).toContain('## Revisões')
    expect(lerRevisoes(ler(raiz)).map((r) => r.revisor)).toEqual(['revisor-geral'])

    const avisos = rodar(raiz, 'revisor-geral', 'APROVADO', '2026-11-20T11:00:00')

    expect(linhasDaTabelaDeRevisoes(ler(raiz)).slice(0, antes.length)).toEqual(antes)
    expect(lerRevisoes(ler(raiz)).map((r) => [r.revisor, r.rodada])).toEqual([
      ['test-engineer', 1],
      ['revisor-geral', 1],
      ['revisor-geral', 2],
    ])
    expect(avisos).toHaveLength(1)
  })

  it('tabela inteira: o documento não muda e ninguém é avisado', () => {
    const raiz = repositorio()
    rodar(raiz, 'test-engineer', 'APROVADO', '2026-11-20T10:00:00')
    const antes = ler(raiz)
    const avisos = rodar(raiz, 'revisor-geral', 'APROVADO', '2026-11-20T10:05:00')
    expect(avisos).toEqual([])
    expect(ler(raiz).startsWith(antes)).toBe(true)
    expect(lerRevisoes(ler(raiz))).toHaveLength(2)
  })

  it('documento que nunca teve rodada registrada: nada a devolver', () => {
    const raiz = repositorio()
    expect(rodar(raiz, 'test-engineer', 'APROVADO', '2026-11-20T10:00:00')).toEqual([])
    expect(lerRevisoes(ler(raiz))).toHaveLength(1)
  })
})

describe('o hook do SubagentStop, rodado como processo', () => {
  it('a linha devolvida chega a quem vê o hook, como systemMessage no stdout', () => {
    const raiz = repositorio()
    rodar(raiz, 'test-engineer', 'APROVADO', '2026-11-20T10:00:00')
    reescreverSem(raiz, semASecao)
    const caminho = join(transcripts, 'processo.jsonl')
    writeFileSync(caminho, JSON.stringify({ type: 'user', timestamp: new Date().toISOString(), message: { content: `Audite.\nTarefa: ${DOCUMENTO}` } }))

    const saida = spawnSync('node', [join(import.meta.dirname, 'hook-revisoes.ts'), 'registrar'], {
      cwd: raiz,
      env: { ...process.env, CLAUDE_PROJECT_DIR: raiz },
      encoding: 'utf8',
      input: JSON.stringify({ cwd: raiz, agent_type: 'revisor-geral', agent_id: 'a', agent_transcript_path: caminho, last_assistant_message: 'VEREDITO: APROVADO' }),
    })

    expect(saida.status).toBe(0)
    const { systemMessage } = JSON.parse(saida.stdout) as { systemMessage: string }
    expect(systemMessage).toContain(DOCUMENTO)
    expect(systemMessage).toContain('devolveu')
    // O mesmo aviso sai no stderr, com o prefixo do hook.
    expect(saida.stderr).toContain(`revisoes: ${systemMessage}`)
    expect(lerRevisoes(ler(raiz)).map((r) => r.revisor)).toEqual(['test-engineer', 'revisor-geral'])
  })

  it('nada perdido: o stdout fica vazio', () => {
    const raiz = repositorio()
    rodar(raiz, 'test-engineer', 'APROVADO', '2026-11-20T10:00:00')
    const caminho = join(transcripts, 'processo-inteiro.jsonl')
    writeFileSync(caminho, JSON.stringify({ type: 'user', timestamp: new Date().toISOString(), message: { content: `Audite.\nTarefa: ${DOCUMENTO}` } }))
    const saida = spawnSync('node', [join(import.meta.dirname, 'hook-revisoes.ts'), 'registrar'], {
      cwd: raiz,
      env: { ...process.env, CLAUDE_PROJECT_DIR: raiz },
      encoding: 'utf8',
      input: JSON.stringify({ cwd: raiz, agent_type: 'revisor-geral', agent_id: 'a', agent_transcript_path: caminho, last_assistant_message: 'VEREDITO: APROVADO' }),
    })
    expect(saida.status).toBe(0)
    expect(saida.stdout).toBe('')
  })
})

describe('a restauração concorrente: vários processos sobre o mesmo documento', { timeout: 60_000 }, () => {
  const HOOK = join(import.meta.dirname, 'hook-revisoes.ts')
  const REVISORES = ['revisor-geral', 'tenancy-guardian', 'privacy-guardian', 'conformidade-reviewer', 'infra-guardian']

  interface Saida {
    status: number | null
    stdout: string
    stderr: string
  }

  /** Um hook como processo: o `registrar` de um revisor, ou o `portao` de um commit. Devolve o filho e a promessa do que ele terminou. */
  function hook(raiz: string, modo: 'registrar' | 'portao', entrada: object): { filho: ReturnType<typeof spawn>; fim: Promise<Saida> } {
    const env: NodeJS.ProcessEnv = { ...process.env, CLAUDE_PROJECT_DIR: raiz }
    delete env['CLAUDE_CODE_AGENT']
    const filho = spawn('node', [HOOK, modo], { cwd: raiz, env })
    let stdout = ''
    let stderr = ''
    filho.stdout.on('data', (parte: Buffer) => (stdout += parte.toString()))
    filho.stderr.on('data', (parte: Buffer) => (stderr += parte.toString()))
    filho.stdin.end(JSON.stringify({ cwd: raiz, ...entrada }))
    const fim = new Promise<Saida>((resolver) => filho.on('close', (status) => resolver({ status, stdout, stderr })))
    return { filho, fim }
  }

  function registrarComo(raiz: string, revisor: string) {
    const transcript = join(transcripts, `conc-${revisor}-${Math.random().toString(36).slice(2)}.jsonl`)
    writeFileSync(transcript, JSON.stringify({ type: 'user', timestamp: new Date().toISOString(), message: { content: `Audite.\nTarefa: ${DOCUMENTO}` } }))
    return hook(raiz, 'registrar', { agent_type: revisor, agent_id: `a-${revisor}`, agent_transcript_path: transcript, last_assistant_message: 'VEREDITO: APROVADO' })
  }

  const portaoDoCommit = (raiz: string) => hook(raiz, 'portao', { tool_name: 'Bash', tool_input: COMMIT.tool_input })

  /** O repositório com a 1ª rodada registrada e o documento reescrito por script, sem a seção. */
  function reescrito(): string {
    const raiz = repositorio()
    rodar(raiz, 'test-engineer', 'AJUSTES NECESSÁRIOS', '2026-11-20T00:00:30')
    reescreverSem(raiz, semASecao)
    return raiz
  }

  const poucoDepois = (milissegundos: number) => new Promise((resolver) => setTimeout(resolver, milissegundos))

  it('cinco revisores e um commit ao mesmo tempo, sobre o documento sem a seção: a 1ª rodada volta uma vez e ninguém perde a linha', async () => {
    const raiz = reescrito()
    const processos = [...REVISORES.map((revisor) => registrarComo(raiz, revisor)), portaoDoCommit(raiz)]
    const saidas = await Promise.all(processos.map((processo) => processo.fim))
    expect(saidas.map((saida) => saida.status)).toEqual(processos.map(() => 0))

    const revisoes = lerRevisoes(ler(raiz))
    // A 1ª rodada do primeiro revisor, exatamente uma vez, e ainda a 1ª.
    expect(revisoes.filter((r) => r.revisor === 'test-engineer').map((r) => [r.rodada, r.veredito])).toEqual([[1, 'AJUSTES NECESSÁRIOS']])
    // Cada revisor tem a sua linha, sem duplicata, e a contagem de cada um é a 1ª.
    for (const revisor of REVISORES) expect(revisoes.filter((r) => r.revisor === revisor).map((r) => r.rodada)).toEqual([1])
    expect(revisoes).toHaveLength(1 + REVISORES.length)
    // A cópia tem a tabela final inteira.
    const copia = readFileSync(join(raiz, caminhoDaCopiaDasRevisoes(DOCUMENTO)), 'utf8').trimEnd().split('\n')
    expect(copia).toEqual(linhasDaTabelaDeRevisoes(ler(raiz)))
  })

  it('com a trava do documento tomada, o portão do commit espera: não escreve no documento até ela soltar', async () => {
    const raiz = reescrito()
    const trava = join(raiz, `${DOCUMENTO}.trava`)
    mkdirSync(trava)
    const commit = portaoDoCommit(raiz)
    // O portão sem trava restauraria e sairia em poucas centenas de milissegundos; o que espera a trava continua vivo.
    await Promise.race([commit.fim, poucoDepois(2500)])
    expect(ler(raiz)).not.toContain('## Revisões')
    expect(commit.filho.exitCode).toBeNull()

    rmSync(trava, { recursive: true })
    const saida = await commit.fim
    expect(saida.status).toBe(0)
    expect(lerRevisoes(ler(raiz)).map((r) => [r.revisor, r.rodada])).toEqual([['test-engineer', 1]])
  })

  it('com a trava do documento tomada, o registrar do revisor espera: não devolve a linha até ela soltar', async () => {
    const raiz = reescrito()
    const trava = join(raiz, `${DOCUMENTO}.trava`)
    mkdirSync(trava)
    const revisor = registrarComo(raiz, 'revisor-geral')
    await Promise.race([revisor.fim, poucoDepois(2500)])
    expect(ler(raiz)).not.toContain('## Revisões')
    expect(revisor.filho.exitCode).toBeNull()

    rmSync(trava, { recursive: true })
    const saida = await revisor.fim
    expect(saida.status).toBe(0)
    expect(lerRevisoes(ler(raiz)).map((r) => [r.revisor, r.rodada])).toEqual([
      ['test-engineer', 1],
      ['revisor-geral', 1],
    ])
  })
})

describe('o commit devolve a linha que sumiu e recusa uma vez', () => {
  it('sem a seção: devolve ao disco, recusa dizendo o que fez e manda preparar o documento de novo', () => {
    const raiz = repositorio()
    rodar(raiz, 'test-engineer', 'APROVADO', '2026-11-20T10:00:00')
    reescreverSem(raiz, semASecao)

    const motivo = portao(COMMIT, raiz)

    expect(motivo).toContain('devolveu')
    expect(motivo).toContain(DOCUMENTO)
    expect(motivo).toContain('git add')
    expect(lerRevisoes(ler(raiz)).map((r) => [r.revisor, r.rodada, r.veredito])).toEqual([['test-engineer', 1, 'APROVADO']])
  })

  it('depois de devolvida, a segunda tentativa não recusa por isso', () => {
    const raiz = repositorio()
    rodar(raiz, 'test-engineer', 'APROVADO', '2026-11-20T10:00:00')
    reescreverSem(raiz, semASecao)
    portao(COMMIT, raiz)
    expect(portao(COMMIT, raiz) ?? '').not.toContain('devolveu')
  })

  it('tabela inteira: o commit não é recusado por isso e o documento não muda', () => {
    const raiz = repositorio()
    rodar(raiz, 'test-engineer', 'APROVADO', '2026-11-20T10:00:00')
    const antes = ler(raiz)
    expect(portao(COMMIT, raiz) ?? '').not.toContain('devolveu')
    expect(ler(raiz)).toBe(antes)
  })

  it('com a seção e sem uma rodada: só a linha que sumiu volta ao disco, e o commit recusa uma vez', () => {
    const raiz = repositorio()
    rodar(raiz, 'test-engineer', 'APROVADO', '2026-11-20T10:00:00')
    rodar(raiz, 'revisor-geral', 'APROVADO', '2026-11-20T10:05:00')
    const antes = linhasDaTabelaDeRevisoes(ler(raiz))
    reescreverSem(raiz, semALinha('test-engineer'))
    expect(lerRevisoes(ler(raiz)).map((r) => r.revisor)).toEqual(['revisor-geral'])

    const motivo = portao(COMMIT, raiz)

    expect(motivo).toContain('devolveu')
    expect(motivo).toContain('1 linha da tabela')
    expect(linhasDaTabelaDeRevisoes(ler(raiz))).toEqual(antes)
  })

  it('commit sem marca de tarefa nem de correção: o portão não procura documento', () => {
    const raiz = repositorio()
    const chamar = () => portao({ tool_input: { command: 'git commit -m "Ajusta o texto"' } }, raiz)
    expect(chamar).not.toThrow()
    expect(chamar()).toBeNull()
  })

  it('correção que não tem documento: a recusa é a de sempre, e nada é devolvido', () => {
    const raiz = repositorio()
    const chamar = () => portao({ tool_input: { command: 'git commit -m "Corrige x (correção nao-existe)\n\nRevisões: ok"' } }, raiz)
    expect(chamar).not.toThrow()
    expect(chamar()).toContain('A correção nao-existe não tem')
  })

  it('duas funcionalidades com o mesmo 9_task.md: o commit da tarefa 9.0 sem o caminho acha a da árvore alterada e a devolve', () => {
    // O commit de tarefa não cita `tasks/prd-…/`, e o `N_task.md` existe em várias pastas: é a lista dos arquivos alterados que diz de qual.
    const raiz = repositorio()
    mkdirSync(join(raiz, 'tasks/prd-outro'), { recursive: true })
    writeFileSync(join(raiz, 'tasks/prd-outro/9_task.md'), TAREFA)
    execFileSync('git', ['add', 'tasks'], { cwd: raiz })
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'base'], { cwd: raiz })
    rodar(raiz, 'test-engineer', 'APROVADO', '2026-11-20T10:00:00')
    reescreverSem(raiz, semASecao)
    expect(lerRevisoes(ler(raiz))).toEqual([])

    const motivo = portao(COMMIT, raiz)

    expect(motivo).toContain('devolveu')
    expect(motivo).toContain(DOCUMENTO)
    expect(lerRevisoes(ler(raiz)).map((r) => [r.revisor, r.rodada, r.veredito])).toEqual([['test-engineer', 1, 'APROVADO']])
    expect(readFileSync(join(raiz, 'tasks/prd-outro/9_task.md'), 'utf8')).toBe(TAREFA)
  })

  it('documento sem cópia (nunca houve rodada): o commit não o toca', () => {
    const raiz = repositorio()
    const antes = ler(raiz)
    portao(COMMIT, raiz)
    expect(ler(raiz)).toBe(antes)
    expect(existsSync(join(raiz, caminhoDaCopiaDasRevisoes(DOCUMENTO)))).toBe(false)
  })
})

describe('devolverRevisoesPerdidas', () => {
  const CABECALHO = ['| Início | Fim | Revisor | Rodada | Veredito | Agente |', '|---|---|---|---|---|---|']
  const A = '| 2026-11-20 10:00:00 | 2026-11-20 10:01:00 | `test-engineer` | 1 | APROVADO | a1 |'
  const B = '| 2026-11-20 10:02:00 | 2026-11-20 10:03:00 | `revisor-geral` | 1 | APROVADO | a2 |'

  it('linha que o documento tem e a cópia não: fica, depois das da cópia', () => {
    const conteudo = `# T\n\n## Revisões\n\ntexto\n\n${[...CABECALHO, B, A].join('\n')}\n`
    const { conteudo: novo, devolvidas } = devolverRevisoesPerdidas(conteudo, [...CABECALHO, A])
    expect(devolvidas).toEqual([])
    expect(novo).toBe(conteudo)
  })

  it('texto da seção e o que vem antes da tabela ficam como estavam', () => {
    const conteudo = `# T\n\ncorpo\n\n## Revisões\n\nTexto da seção.\n\nNota.\n\n${[...CABECALHO, B].join('\n')}\n`
    const { conteudo: novo, devolvidas } = devolverRevisoesPerdidas(conteudo, [...CABECALHO, A, B])
    expect(devolvidas).toEqual([A])
    expect(novo).toContain('Texto da seção.\n\nNota.\n\n| Início')
    expect(linhasDaTabelaDeRevisoes(novo)).toEqual([...CABECALHO, A, B])
  })

  it('o texto depois da tabela não se perde', () => {
    const conteudo = `# T\n\n## Revisões\n\n${[...CABECALHO, B].join('\n')}\n\nrodapé\n`
    const { conteudo: novo } = devolverRevisoesPerdidas(conteudo, [...CABECALHO, A, B])
    expect(novo).toContain('\nrodapé\n')
    expect(linhasDaTabelaDeRevisoes(novo)).toEqual([...CABECALHO, A, B])
  })

  it('documento sem a seção e sem quebra de linha no fim: a seção nasce numa linha só dela', () => {
    const { conteudo } = devolverRevisoesPerdidas('# T\n\ncorpo', [...CABECALHO, A])
    expect(conteudo.startsWith('# T\n\ncorpo\n\n## Revisões\n')).toBe(true)
    expect(linhasDaTabelaDeRevisoes(conteudo)).toEqual([...CABECALHO, A])
  })

  it('cabeçalho da seção reescrito: não vira linha de rodada, e o da cópia volta uma vez só', () => {
    const outro = ['| Hora | Quem |', '|---|---|']
    const conteudo = `# T\n\n## Revisões\n\n${[...outro, B].join('\n')}\n`
    const { conteudo: novo } = devolverRevisoesPerdidas(conteudo, [...CABECALHO, A, B])
    expect(linhasDaTabelaDeRevisoes(novo)).toEqual([...CABECALHO, A, B])
  })

  it('seção sem nenhuma linha de tabela: a tabela entra no fim da seção', () => {
    const conteudo = '# T\n\n## Revisões\n\nTexto da seção.\n'
    const { conteudo: novo, devolvidas } = devolverRevisoesPerdidas(conteudo, [...CABECALHO, A])
    expect(devolvidas).toEqual([...CABECALHO, A])
    expect(novo).toContain('Texto da seção.\n\n| Início')
    expect(novo.match(/Texto da seção\./g)).toHaveLength(1)
    expect(linhasDaTabelaDeRevisoes(novo)).toEqual([...CABECALHO, A])
  })
})
