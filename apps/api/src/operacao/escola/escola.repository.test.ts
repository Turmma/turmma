import { unscopedJustification } from '@educa/nucleo'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { RedeEEscolaRepository } from './escola.repository.js'

const RAIZ = fileURLToPath(new URL('../../../../../', import.meta.url))
const REPOSITORY = 'apps/api/src/operacao/escola/escola.repository.ts'
const CASO_DE_USO = 'apps/api/src/operacao/escola/escola.ts'

function arquivosDeCodigo(): { caminho: string; texto: string }[] {
  return ['apps', 'packages', 'infra', 'tools'].flatMap((pasta) =>
    readdirSync(join(RAIZ, pasta), { recursive: true, encoding: 'utf8' })
      .filter((arquivo) => /\.(ts|tsx|mts)$/.test(arquivo) && !/\.test\.ts$/.test(arquivo))
      .filter((arquivo) => !arquivo.split(sep).some((parte) => parte === 'node_modules' || parte === 'dist'))
      .map((arquivo) => {
        const caminho = relative(RAIZ, join(RAIZ, pasta, arquivo)).split(sep).join('/')
        return { caminho, texto: readFileSync(join(RAIZ, caminho), 'utf8') }
      }),
  )
}

// Drizzle (`insert(escola)`, `insert(schema.rede)`) e SQL (`insert into escola`, `insert into "public"."rede"`).
const CRIACAO_DE_REDE_OU_ESCOLA = /\binsert\s*\(\s*(?:schema\.)?(?:rede|escola)\b|\binsert\s+into\s+(?:"?public"?\.)?"?(?:rede|escola)"?[\s(]/i

/**
 * Quem, fora de arquivo `.test.ts`, importa o caso de uso (`operacao/escola/escola.ts`, que exporta `criarRede` e
 * `criarEscola`): o painel da operação (`painel.service.ts`, A0b), a única rota que cria rede e escola, só com sessão de
 * operador Turmma; o comando `ops:escola` (`ops/escola.ts`), que é o terminal sobre ele; e o que monta escola sintética: a bancada dos testes de integração da API (que desde a tarefa 2.0 exige sessão real), a
 * bancada da fila (desde a tarefa 3.0 `job_registro` tem FK para `escola`), o ensaio de alertas, que só roda com
 * `AMBIENTE=local`, e os cenários de carga "login às 7h30" (16.0) e "reivindicação em sala" (A1, 9.0), que montam as
 * escolas sintéticas no banco do compose de carga. Outra rota que chame a criação, com qualquer nome, entra aqui e a revisão confere.
 */
const IMPORTADORES_PERMITIDOS_DO_CASO_DE_USO: readonly string[] = [
  'apps/api/src/operacao/painel/painel.service.ts',
  'apps/api/src/ops/escola.ts',
  'apps/api/test/sessao-de-teste.ts',
  'apps/worker/test/fila-de-teste.ts',
  'infra/scripts/carga-login.ts',
  'infra/scripts/carga-sala.ts',
  'infra/scripts/ensaio-alertas.ts',
]

/** Os módulos que o arquivo importa por caminho relativo, resolvidos a partir da raiz e com extensão `.ts`. */
function importacoesRelativas(arquivo: { caminho: string; texto: string }): string[] {
  return [...arquivo.texto.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)].map((importacao) =>
    relative(RAIZ, join(RAIZ, dirname(arquivo.caminho), importacao[1] ?? ''))
      .split(sep)
      .join('/')
      .replace(/\.js$/, '.ts'),
  )
}

describe('RedeEEscolaRepository: a criação de rede e escola é só do operador', () => {
  it('só criarRede e criarEscola saem sem escopo, cada um com justificativa que cita o comando ou o painel do operador', () => {
    const metodos = Object.getOwnPropertyNames(RedeEEscolaRepository.prototype).filter((nome) => nome !== 'constructor')
    const semEscopo = metodos.filter((metodo) => unscopedJustification(RedeEEscolaRepository, metodo) !== undefined)
    expect(metodos.sort()).toEqual(['criarEscola', 'criarRede'])
    expect(semEscopo.sort()).toEqual(['criarEscola', 'criarRede'])
    for (const metodo of semEscopo) expect(unscopedJustification(RedeEEscolaRepository, metodo), metodo).toMatch(/comando ou o painel do operador/)
  })

  it('nenhum código fora do repository do operador cria rede ou escola, e só o caso de uso o importa', () => {
    const arquivos = arquivosDeCodigo()
    expect(arquivos.filter((arquivo) => CRIACAO_DE_REDE_OU_ESCOLA.test(arquivo.texto)).map((arquivo) => arquivo.caminho)).toEqual([REPOSITORY])
    // O caminho do arquivo, e não o fim de outro nome: `retencao-da-escola.repository` (F3, tarefa 2.0) é outro repository.
    expect(arquivos.filter((arquivo) => /[/'"]escola\.repository\b/.test(arquivo.texto)).map((arquivo) => arquivo.caminho)).toEqual([CASO_DE_USO])
  })

  it('fora de teste, só o painel da operação, o comando ops:escola e as bancadas importam o caso de uso: criarRede e criarEscola chegam a uma rota só, a do operador', () => {
    const importadores = arquivosDeCodigo()
      .filter((arquivo) => importacoesRelativas(arquivo).includes(CASO_DE_USO))
      .map((arquivo) => arquivo.caminho)
    // A ordem da varredura é a do sistema de arquivos: compara as listas ordenadas.
    expect([...importadores].sort()).toEqual([...IMPORTADORES_PERMITIDOS_DO_CASO_DE_USO].sort())
    // A resolução enxerga importação relativa de verdade: o caso de uso importa o repository.
    const casoDeUso = arquivosDeCodigo().find((arquivo) => arquivo.caminho === CASO_DE_USO)
    expect(casoDeUso && importacoesRelativas(casoDeUso)).toContain(REPOSITORY)
    expect(importacoesRelativas({ caminho: 'apps/api/src/onboarding/nova-escola.controller.ts', texto: "import { criarEscola } from '../operacao/escola/escola.js'" })).toEqual([CASO_DE_USO])
  })

  it('a varredura pega a criação em qualquer forma', () => {
    for (const trecho of ['tx.insert(escola).values(dados)', 'banco.insert( schema.rede )', "pool.query('INSERT INTO escola (rede_id) values ($1)')", 'insert into "rede"(nome)', 'insert into public.escola (nome)', 'INSERT INTO "public"."rede" (nome)']) {
      expect(CRIACAO_DE_REDE_OU_ESCOLA.test(trecho), trecho).toBe(true)
    }
    expect(CRIACAO_DE_REDE_OU_ESCOLA.test('insert into escola_config (x)')).toBe(false)
  })
})
