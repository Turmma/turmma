import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { raizRepositorio } from './executar.ts'

const lerArquivo = (caminho: string) => readFileSync(join(raizRepositorio, caminho), 'utf8')

const DOCKERFILE = 'infra/docker/servico.Dockerfile'
const IMAGEM_DO_NODE = 'node:22.23.2-alpine3.23'
/** Os alvos que o compose escolhe, e os quatro que rodam código de produção do Node (a `web` é o preview do Vite). */
const ALVOS = ['api', 'despachante', 'realtime', 'worker', 'web'] as const
const ALVOS_DE_PRODUCAO = ['api', 'despachante', 'realtime', 'worker'] as const

interface Estagio {
  nome: string
  de: string
  instrucoes: string[]
}

/** Os estágios do Dockerfile (`FROM <de> AS <nome>`) com as instruções de cada um, sem comentário nem linha vazia. */
function estagios(texto: string): Estagio[] {
  const lista: Estagio[] = []
  for (const linha of texto.split('\n')) {
    const instrucao = linha.trim()
    if (instrucao === '' || instrucao.startsWith('#')) continue
    const de = /^FROM\s+(\S+)\s+AS\s+(\S+)$/i.exec(instrucao)
    if (de !== null) lista.push({ nome: de[2] ?? '', de: de[1] ?? '', instrucoes: [] })
    else lista.at(-1)?.instrucoes.push(instrucao)
  }
  return lista
}

/** As instruções de um estágio e as dos que ele herda (`FROM producao AS api`), do mais antigo ao próprio. */
function instrucoesDoAlvo(lista: readonly Estagio[], nome: string): string[] {
  const estagio = lista.find((item) => item.nome === nome)
  if (estagio === undefined) throw new Error(`o Dockerfile não tem o estágio ${nome}`)
  return [...(lista.some((item) => item.nome === estagio.de) ? instrucoesDoAlvo(lista, estagio.de) : []), ...estagio.instrucoes]
}

interface ServicoComBuild {
  image?: string
  build?: { context?: string; dockerfile?: string; target?: string }
}

type Build = NonNullable<ServicoComBuild['build']>

/** Os serviços com `build`, com a âncora resolvida: `api-2` e os outros pares herdam o `build` do primeiro (`<<: *api`). */
function servicosComBuild(): { nome: string; build: Build; imagem: string | undefined }[] {
  const { services } = parse(lerArquivo('infra/compose.yml'), { merge: true }) as { services: Record<string, ServicoComBuild> }
  const lista: { nome: string; build: Build; imagem: string | undefined }[] = []
  for (const [nome, servico] of Object.entries(services)) if (servico.build !== undefined) lista.push({ nome, build: servico.build, imagem: servico.image })
  return lista
}

describe('um Dockerfile só, com um alvo por serviço', () => {
  const dockerfile = estagios(lerArquivo(DOCKERFILE))

  it('todo serviço do compose que constrói imagem usa o servico.Dockerfile', () => {
    const construidos = servicosComBuild()
    // Com a âncora resolvida, os pares (`api-2`, `worker-lote-*`) também têm o `build` do primeiro; o `migrar` usa a imagem da API.
    expect(construidos.map(({ nome }) => nome)).toEqual(
      expect.arrayContaining(['migrar', 'api-1', 'realtime-1', 'despachante-1', 'worker-interativo-1', 'web']),
    )
    for (const { nome, build } of construidos) expect(build.dockerfile, nome).toBe(DOCKERFILE)
  })

  it('todo target citado pelo compose existe como `FROM … AS <alvo>`, e é o da imagem do serviço', () => {
    const existentes = new Set(dockerfile.map((estagio) => estagio.nome))
    for (const { nome, build, imagem } of servicosComBuild()) {
      expect(build.target, `${nome} sem target`).toBeDefined()
      expect(existentes.has(build.target ?? ''), `${nome}: o target ${build.target ?? ''} não existe`).toBe(true)
      // `educa-<alvo>:local`; a `web` não declara imagem e o compose a chama pelo projeto.
      expect(build.target, nome).toBe(imagem === undefined ? 'web' : /^educa-([a-z]+):local$/.exec(imagem)?.[1])
    }
    for (const alvo of ALVOS) expect(existentes.has(alvo), alvo).toBe(true)
  })

  it('infra/docker/ só tem o servico.Dockerfile', () => {
    expect(readdirSync(join(raizRepositorio, 'infra/docker'))).toEqual(['servico.Dockerfile'])
  })

  it('todo alvo final roda como `node`, no diretório e com o comando de antes, e os quatro de produção têm NODE_ENV=production', () => {
    const comandoDeProducao = 'CMD ["node", "dist/main.js"]'
    const comandoDaWeb = 'CMD ["../../node_modules/.bin/vite", "preview", "--host", "0.0.0.0", "--port", "4173", "--strictPort"]'
    for (const alvo of ALVOS) {
      const instrucoes = instrucoesDoAlvo(dockerfile, alvo)
      expect(instrucoes, `${alvo} sem USER node`).toContain('USER node')
      // O último vale: `producao` fixa `/repo`, e o alvo muda para a pasta do app.
      expect(instrucoes.filter((instrucao) => instrucao.startsWith('WORKDIR ')).at(-1), `${alvo}: WORKDIR`).toBe(`WORKDIR /repo/apps/${alvo}`)
      expect(instrucoes.filter((instrucao) => instrucao.startsWith('CMD ')).at(-1), `${alvo}: CMD`).toBe(alvo === 'web' ? comandoDaWeb : comandoDeProducao)
    }
    for (const alvo of ALVOS_DE_PRODUCAO) expect(instrucoesDoAlvo(dockerfile, alvo), `${alvo} sem NODE_ENV=production`).toContain('ENV NODE_ENV=production')
  })

  it('cada alvo de produção instala só o pacote dele, sem as dependências de desenvolvimento', () => {
    for (const alvo of ALVOS_DE_PRODUCAO) {
      const instalacoes = instrucoesDoAlvo(dockerfile, alvo).filter((instrucao) => instrucao.startsWith('RUN npm ci'))
      expect(instalacoes, alvo).toHaveLength(1)
      expect(instalacoes[0], alvo).toContain(' --omit=dev ')
      expect([...(instalacoes[0] ?? '').matchAll(/--workspace (@educa\/[a-z]+)/g)].map((achado) => achado[1]), alvo).toEqual([`@educa/${alvo}`])
    }
  })

  it('o que a imagem tinha antes continua: porta, migrations da API e argumento da galeria da web', () => {
    const portas: Record<string, string[]> = { api: ['EXPOSE 3000'], realtime: ['EXPOSE 3000'], web: ['EXPOSE 4173'], despachante: [], worker: [] }
    for (const alvo of ALVOS) {
      const expostas = instrucoesDoAlvo(dockerfile, alvo).filter((instrucao) => instrucao.startsWith('EXPOSE'))
      expect(expostas, alvo).toEqual(portas[alvo])
    }
    expect(instrucoesDoAlvo(dockerfile, 'api')).toContain('COPY packages/core/drizzle packages/core/drizzle')
    expect(instrucoesDoAlvo(dockerfile, 'web')).toContain('ARG VITE_COM_GALERIA=')
  })

  it('a web não parte do `base`: não constrói o nucleo', () => {
    const web = dockerfile.find((estagio) => estagio.nome === 'web')
    expect(web?.de).toBe(IMAGEM_DO_NODE)
    expect(instrucoesDoAlvo(dockerfile, 'web').join('\n')).not.toContain('@educa/core')
  })

  it('todo estágio que não herda de outro parte da mesma imagem do node, na versão de antes', () => {
    const nomes = new Set(dockerfile.map((estagio) => estagio.nome))
    const deImagem = dockerfile.filter((estagio) => !nomes.has(estagio.de))
    expect(deImagem.map((estagio) => estagio.nome)).toEqual(['base', 'producao', 'web'])
    for (const estagio of deImagem) expect(estagio.de, estagio.nome).toBe(IMAGEM_DO_NODE)
  })

  it('o contexto de build fica fora do que a imagem não usa: mockups e .processo', () => {
    const ignorados = lerArquivo('.dockerignore')
      .split('\n')
      .map((linha) => linha.trim().replace(/^\/|\/$/g, ''))
    for (const pasta of ['mockups', '.processo']) expect(ignorados, pasta).toContain(pasta)
    expect(ignorados, '.reengenharia foi apagada no fechamento da X5 (R64)').not.toContain('.reengenharia')
  })
})
