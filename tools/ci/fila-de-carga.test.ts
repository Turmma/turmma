import { type ChildProcess, spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ancestraisDe, donosDoTravamento, FILA_DE_CARGA, VARIAVEL_DA_FILA } from './fila-de-carga.ts'
import { raizRepositorio } from './executar.ts'

const FIXTURE = 'tools/ci/fixtures/usa-a-fila.ts'

let pasta = ''
let trava = ''
let diario = ''
const encerrar: Array<() => void> = []

beforeEach(() => {
  pasta = mkdtempSync(join(tmpdir(), 'fila-de-carga-'))
  trava = join(pasta, 'carga.lock')
  diario = join(pasta, 'diario.txt')
})

afterEach(() => {
  // Na ordem inversa: quem espera morre antes de quem segura a trava, e não pega a vez no meio.
  for (const fim of encerrar.splice(0).reverse()) fim()
  rmSync(pasta, { recursive: true, force: true })
})

/** O ambiente do filho: o lugar da trava é o do teste (nunca a trava de verdade, que o portão que roda este teste segura) e sem `CI`. */
function ambiente(extra: Record<string, string> = {}): Record<string, string> {
  const base = Object.fromEntries(Object.entries(process.env).filter((par): par is [string, string] => par[1] !== undefined && par[0] !== 'CI'))
  return { ...base, [VARIAVEL_DA_FILA]: trava, ...extra }
}

/** Um processo em grupo próprio, para o teste matar o `flock` e o que ele segura de uma vez. */
function iniciar(comando: string, argumentos: string[], extra: Record<string, string> = {}): { filho: ChildProcess; saida: () => string; terminou: Promise<number> } {
  const filho = spawn(comando, argumentos, { cwd: raizRepositorio, env: ambiente(extra), detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let texto = ''
  filho.stdout?.on('data', (pedaco: Buffer) => (texto += pedaco.toString()))
  filho.stderr?.on('data', (pedaco: Buffer) => (texto += pedaco.toString()))
  const terminou = new Promise<number>((resolver) => filho.on('close', (codigo) => resolver(codigo ?? 1)))
  encerrar.push(() => {
    try {
      if (filho.pid !== undefined) process.kill(-filho.pid, 'SIGKILL')
    } catch {
      // já tinha terminado
    }
  })
  return { filho, saida: () => texto, terminou }
}

/** Os eventos do diário na ordem em que foram escritos, `<nome> <evento>`: a ordem das linhas, que não depende do relógio. */
function ordemDoDiario(): string[] {
  return readFileSync(diario, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((linha) => linha.split(' ').slice(0, 2).join(' '))
}

function lerDiario(): Map<string, number> {
  const marcas = new Map<string, number>()
  for (const linha of readFileSync(diario, 'utf8').split('\n').filter(Boolean)) {
    const [nome, evento, instante] = linha.split(' ')
    marcas.set(`${nome ?? ''} ${evento ?? ''}`, Number(instante))
  }
  return marcas
}

async function esperar(condicao: () => boolean, ate = 8_000): Promise<void> {
  const limite = Date.now() + ate
  while (!condicao()) {
    if (Date.now() > limite) throw new Error('a condição não veio a tempo')
    await new Promise((resolver) => setTimeout(resolver, 50))
  }
}

/** A trava está segurada por outro processo? `flock -n` falha (código 1) quando está. */
function travaOcupada(): boolean {
  return spawnSync('flock', ['-n', trava, 'true']).status === 1
}

/** Alguém segura a trava, como a outra linha que está no portão. */
async function segurarATravaComoOutraLinha(): Promise<void> {
  iniciar('flock', [trava, 'sleep', '60'])
  await esperar(travaOcupada)
}

describe('fila de carga (tools/ci/fila-de-carga.ts)', () => {
  it('a trava é a mesma que as skills digitam na frente do npx playwright', () => {
    expect(FILA_DE_CARGA).toBe('/tmp/educa-carga.lock')
  })

  it('lê /proc/locks: só o dono do inode, nunca quem espera na fila nem outro arquivo', () => {
    const locks = [
      '1: FLOCK  ADVISORY  WRITE 1111 08:01:4242 0 EOF',
      '1: -> FLOCK  ADVISORY  WRITE 2222 08:01:4242 0 EOF',
      '2: FLOCK  ADVISORY  WRITE 3333 08:01:9999 0 EOF',
      '3: POSIX  ADVISORY  WRITE 4444 08:01:4242 0 EOF',
    ].join('\n')
    expect([...donosDoTravamento(locks, 4242)]).toEqual([1111])
  })

  it('os ancestrais vêm do pai de cada processo, até a raiz, sem repetir', () => {
    const pais = new Map([[30, 20], [20, 10], [10, 1], [1, 0]])
    expect(ancestraisDe(30, (pid) => pais.get(pid) ?? null)).toEqual([30, 20, 10, 1])
    // Um laço no /proc não prende o teste.
    expect(ancestraisDe(5, () => 5)).toEqual([5])
  })

  it('dois portões ao mesmo tempo não se sobrepõem: o segundo espera a saída do primeiro', async () => {
    const a = iniciar(process.execPath, [FIXTURE, diario, 'a', '900'])
    const b = iniciar(process.execPath, [FIXTURE, diario, 'b', '900'])
    expect(await Promise.all([a.terminou, b.terminou])).toEqual([0, 0])
    const marcas = lerDiario()
    const [primeiro, segundo] = (marcas.get('a entrou') ?? 0) < (marcas.get('b entrou') ?? 0) ? ['a', 'b'] : ['b', 'a']
    expect(marcas.get(`${segundo ?? ''} entrou`)).toBeGreaterThanOrEqual(marcas.get(`${primeiro ?? ''} saiu`) ?? Infinity)
  }, 30_000)

  it('o processo que o portão inicia por dentro (npm run test:e2e) herda o lugar, e não espera por ele', async () => {
    const pai = iniciar(process.execPath, [FIXTURE, diario, 'pai', '300', '--filho'])
    expect(await pai.terminou).toBe(0)
    const marcas = lerDiario()
    expect([...marcas.keys()].sort()).toEqual(['pai entrou', 'pai saiu', 'pai-filho entrou', 'pai-filho saiu'])
  }, 30_000)

  it('quem já veio dentro de um `flock` digitado, como mandavam as skills, não trava de novo e passa', async () => {
    const digitado = iniciar('flock', [trava, process.execPath, FIXTURE, diario, 'digitado', '300'])
    expect(await digitado.terminou).toBe(0)
    expect([...lerDiario().keys()].sort()).toEqual(['digitado entrou', 'digitado saiu'])
  }, 30_000)

  it('na esteira (CI=true) não há fila: cada job tem a máquina inteira', async () => {
    // Cada um só sai depois de ver o outro entrar, e o segundo chega 3 s depois do primeiro: se houvesse fila, o primeiro seguraria o lugar,
    // o segundo nunca entraria e o primeiro sairia com 4. A sobreposição vale por construção, e não por os dois estarem vivos no mesmo
    // instante, que dependia de o processo do segundo subir antes de o primeiro soltar o lugar (e de o relógio de parede, que recua, concordar).
    const a = iniciar(process.execPath, [FIXTURE, diario, 'a', '0', '--espera-por=b'], { CI: 'true' })
    await new Promise((resolver) => setTimeout(resolver, 3_000))
    const b = iniciar(process.execPath, [FIXTURE, diario, 'b', '0', '--espera-por=a'], { CI: 'true' })
    expect(await Promise.all([a.terminou, b.terminou])).toEqual([0, 0])
    // A ordem é a das linhas do diário (o que cada um escreveu depois do outro), e não a das horas que elas levam.
    const ordem = ordemDoDiario()
    expect([...ordem].sort()).toEqual(['a entrou', 'a saiu', 'b entrou', 'b saiu'])
    // Sobrepostos: cada um entrou antes de o outro sair. As duas ordens abaixo valem por construção sempre que os dois saem com 0 (cada um só escreve
    // `saiu` depois de ver o `entrou` do outro): quem prova a regra é o `[0, 0]` acima, e esta checagem não o substitui.
    expect(ordem.indexOf('a entrou')).toBeLessThan(ordem.indexOf('b saiu'))
    expect(ordem.indexOf('b entrou')).toBeLessThan(ordem.indexOf('a saiu'))
  }, 30_000)

  it('quem falha lá dentro devolve o mesmo código ao shell: o portão vermelho continua vermelho', async () => {
    const falha = iniciar(process.execPath, [FIXTURE, diario, 'falha', '0', '--falha'])
    expect(await falha.terminou).toBe(3)
  }, 30_000)

  it('matar o comando de fora derruba o relançado e solta a fila, em vez de deixar o portão órfão segurando a vez', async () => {
    const longo = iniciar(process.execPath, [FIXTURE, diario, 'longo', '30000'])
    // A marca só sai depois de o relançado ter o lugar: `travaOcupada()` sozinha ficaria verdadeira também na sondagem.
    await esperar(() => existsSync(diario) && readFileSync(diario, 'utf8').includes('longo entrou'))
    // Só o processo de fora, como um `kill <pid>`: o grupo inteiro não leva o sinal.
    process.kill(longo.filho.pid ?? 0, 'SIGTERM')
    await esperar(() => !travaOcupada(), 5_000)
  }, 30_000)

  it('sem o flock na máquina o comando segue sem fila e diz isso', async () => {
    const semFlock = iniciar(process.execPath, [FIXTURE, diario, 'sem-flock', '0'], { PATH: join(pasta, 'vazio') })
    expect(await semFlock.terminou).toBe(0)
    expect(semFlock.saida()).toContain('sem o flock')
    expect([...lerDiario().keys()].sort()).toEqual(['sem-flock entrou', 'sem-flock saiu'])
  }, 30_000)

  it('o aviso de espera diz que a fila está ocupada, e só quando está', async () => {
    const livre = iniciar(process.execPath, [FIXTURE, diario, 'livre', '100'])
    expect(await livre.terminou).toBe(0)
    expect(livre.saida()).not.toContain('fila de carga')

    await segurarATravaComoOutraLinha()
    const espera = iniciar(process.execPath, [FIXTURE, diario, 'espera', '100'])
    await esperar(() => espera.saida().includes('fila de carga'))
    expect(espera.saida()).toContain(trava)
  }, 30_000)

  describe('os dois comandos que a linha digita já entram na fila sozinhos', () => {
    /**
     * Espera o aviso da fila ou a primeira etapa real, o que vier antes, e devolve. Com a chamada da fila fora do comando,
     * a primeira etapa (`▶`) sai na hora e o teste a vê em 50 ms, sem deixar o comando rodar: o afterEach o mata.
     */
    async function veAvisoOuEtapa(comando: { saida: () => string }): Promise<void> {
      await esperar(() => comando.saida().includes('fila de carga') || comando.saida().includes('▶'))
    }

    it('node tools/processo/portao-local.ts --tarefa espera a outra linha e não começa nada antes', async () => {
      await segurarATravaComoOutraLinha()
      const portao = iniciar(process.execPath, ['tools/processo/portao-local.ts', '--tarefa'])
      await veAvisoOuEtapa(portao)
      expect(portao.saida()).toContain('fila de carga')
      await new Promise((resolver) => setTimeout(resolver, 1_500))
      // `▶` é a primeira linha de qualquer etapa que ele rodaria (`npm ci`, tipos, lint…).
      expect(portao.saida()).not.toContain('▶')
    }, 30_000)

    it('node tools/ci/e2e.ts espera a outra linha e não constrói nem sobe nada antes', async () => {
      await segurarATravaComoOutraLinha()
      const e2e = iniciar(process.execPath, ['tools/ci/e2e.ts', '--manter-ambiente'])
      await veAvisoOuEtapa(e2e)
      expect(e2e.saida()).toContain('fila de carga')
      await new Promise((resolver) => setTimeout(resolver, 1_500))
      expect(e2e.saida()).not.toContain('▶')
    }, 30_000)

    it('o portão que confere o carimbo ou os revisores não entra na fila: é leitura, e a Mesa o roda enquanto outra linha testa', async () => {
      await segurarATravaComoOutraLinha()
      for (const subcomando of ['conferir', 'revisores']) {
        const leitura = iniciar(process.execPath, ['tools/processo/portao-local.ts', subcomando])
        // Sem documento ele sai com o uso, na hora: se esperasse a trava, passaria dos 60 s da outra linha.
        expect(await leitura.terminou).toBe(2)
        expect(leitura.saida()).not.toContain('fila de carga')
      }
    }, 30_000)
  })
})
