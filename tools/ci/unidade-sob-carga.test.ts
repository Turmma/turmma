import { readFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import configuracao from '../../vitest.config.ts'
import { limiteDeTrabalhadores } from '../testes/limite-de-trabalhadores.ts'

// A unidade do portão caiu em "Test timed out" quatro corridas seguidas, em conjuntos de casos que mudavam, com a carga da máquina
// entre 7 e 40 em 12 núcleos e só o Vitest rodando. Parte da unidade sobe processo e build de verdade (o build da web, o
// `npm run lint`, o `size-limit`, os CLIs de `tools/`), e cada um já usa vários núcleos: um trabalhador por núcleo satura a máquina, e o
// caso que levava uns segundos livre passava de 5 s. Dois fatos mantêm isso longe: o limite de trabalhadores e o prazo próprio de quem sobe
// processo. O resto da suíte continua no padrão do Vitest (5 s): unidade lenta de verdade tem de aparecer.

const RAIZ = join(import.meta.dirname, '../..')

interface ProjetoDoVitest {
  test?: { name?: string; maxWorkers?: number; fileParallelism?: boolean; sequence?: { groupOrder?: number } }
}

const projetos = (configuracao as { test?: { projects?: ProjetoDoVitest[] } }).test?.projects ?? []
const projeto = (nome: string): ProjetoDoVitest | undefined => projetos.find((candidato) => candidato.test?.name === nome)

describe('a unidade não satura a máquina', () => {
  it('o projeto unidade usa exatamente o limite de trabalhadores da máquina', () => {
    const unidade = projeto('unidade')
    expect(unidade, 'o projeto unidade existe na configuração').toBeDefined()
    expect(unidade?.test?.maxWorkers, 'sem maxWorkers o Vitest usa um trabalhador por núcleo menos um').toBe(limiteDeTrabalhadores(availableParallelism()))
  })

  it('projetos que rodam em paralelo no mesmo groupOrder declaram o mesmo maxWorkers: o Vitest 5 recusa o contrário e o `npm test` nem começa', () => {
    // `integracao` e `infra` têm `fileParallelism: false` (um trabalhador) e ficam de fora; `unidade` e `processo` rodam em paralelo.
    const emParalelo = projetos.filter((candidato) => candidato.test?.fileParallelism !== false)
    expect(emParalelo.map((candidato) => candidato.test?.name)).toEqual(expect.arrayContaining(['unidade', 'processo']))
    const porGrupo = new Map<number, ProjetoDoVitest[]>()
    for (const candidato of emParalelo) {
      const grupo = candidato.test?.sequence?.groupOrder ?? 0
      porGrupo.set(grupo, [...(porGrupo.get(grupo) ?? []), candidato])
    }
    for (const [grupo, doGrupo] of porGrupo) {
      const limites = new Set(doGrupo.map((candidato) => candidato.test?.maxWorkers))
      expect(limites.size, `groupOrder ${String(grupo)}: ${doGrupo.map((candidato) => `${String(candidato.test?.name)}=${String(candidato.test?.maxWorkers)}`).join(', ')}`).toBe(1)
    }
  })
})

describe('quem sobe processo ou build declara o próprio prazo', () => {
  // [arquivo, título do describe]. O prazo é o de um travamento, e não o da velocidade da máquina: 30 s é o piso.
  const QUEM_SOBE_PROCESSO: [string, string][] = [
    ['apps/web/chunk-names.test.ts', 'o build de verdade da web'],
    ['tools/ci/tamanho-web.test.ts', 'teto do bundle da web (.size-limit.json)'],
    ['tools/guardas/guardas.test.ts', 'processadores do worker: nenhuma afirmação de tipo (totais do expurgo, A0b)'],
    ['tools/guardas/guardas.test.ts', 'guarda desligada por comentário'],
    ['tools/guardas/guardas.test.ts', 'configuração das guardas'],
    ['tools/renomear/conferir.test.ts', 'conferir: a linha de comando'],
    ['tools/processo/revisoes.test.ts', 'achados separados por documento, com índice'],
  ]

  const escapar = (texto: string): string => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const numero = (texto: string | undefined): number => Number((texto ?? '0').replaceAll('_', ''))

  it.each(QUEM_SOBE_PROCESSO)('%s › %s', (arquivo, titulo) => {
    const fonte = readFileSync(join(RAIZ, arquivo), 'utf8')
    const declaracao = new RegExp(`describe\\('${escapar(titulo)}', \\{ timeout: ([\\d_]+) \\}`).exec(fonte)
    expect(declaracao, `${arquivo}: o describe "${titulo}" declara { timeout }`).not.toBeNull()
    expect(numero(declaracao?.[1])).toBeGreaterThanOrEqual(30_000)
  })

  // [arquivo, início do título do caso, prazo mínimo]. O prazo está no fim do próprio `it`, e subiu porque o que ele roda (o `npm run lint`
  // inteiro, o `playwright --list` por fatia) estourou o prazo anterior (240 s e 60 s) com a máquina carregada.
  const CASOS_COM_PRAZO_PROPRIO: [string, string, number][] = [
    ['tools/guardas/catraca.test.ts', 'npm run lint está verde com a linha de base', 600_000],
    ['tools/ci/esteira.test.ts', 'o teto do e2e cobre a suíte que existe', 180_000],
  ]

  it.each(CASOS_COM_PRAZO_PROPRIO)('%s › %s', (arquivo, titulo, minimo) => {
    const fonte = readFileSync(join(RAIZ, arquivo), 'utf8')
    const inicio = fonte.indexOf(`it('${titulo}`)
    expect(inicio, `${arquivo}: o caso "${titulo}" existe`).toBeGreaterThanOrEqual(0)
    const doCaso = fonte.slice(inicio).split(/\n {2}(?:it|describe)\(/)[0] ?? ''
    const prazos = [...doCaso.matchAll(/^ {2}\}, ([\d_]+)\)/gm)]
    expect(prazos, `${arquivo}: o caso "${titulo}" termina com o prazo`).toHaveLength(1)
    expect(numero(prazos[0]?.[1])).toBeGreaterThanOrEqual(minimo)
  })
})
