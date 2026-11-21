import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { avisoDaDivergenciaSoNoDocumento, avisoDeDivergencia, citacoesDaLinha, divergenciasNovas } from './divergencias.ts'

// A M3 da retro da X7: o portão avisa a divergência que ficou só no documento da tarefa. Só informa, como o `--faltando`.

const CABECALHO = '| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |\n|---|---|---|\n'

/** Um `N_task.md` com a seção de divergências e a seção seguinte, que não é dela. */
function documento(linhas: string, depois = '| Isto | não | é divergência |\n'): string {
  return `# Tarefa\n\n## Divergências resolvidas nesta tarefa\n\n${CABECALHO}${linhas}\n## Mutações\n\n${depois}`
}

const UMA = '| O limite passa de 5 para 6 | A medição deu 6 | `techspec.md` §3 |\n'
const OUTRA = '| O nome da função muda | O módulo já tinha um igual | `cenarios.md` C2 |\n'

describe('divergenciasNovas', () => {
  it('a linha que o HEAD já tinha não conta', () => {
    expect(divergenciasNovas(documento(UMA), documento(UMA + OUTRA))).toEqual([OUTRA.trim()])
  })

  it('sem versão no HEAD, toda linha da seção é nova', () => {
    expect(divergenciasNovas(null, documento(UMA + OUTRA))).toEqual([UMA.trim(), OUTRA.trim()])
  })

  it('"nenhuma" não é divergência', () => {
    expect(divergenciasNovas(null, documento('| nenhuma | | |\n'))).toEqual([])
    expect(divergenciasNovas(null, documento('\nNenhuma.\n'))).toEqual([])
  })

  it('o cabeçalho e o separador da tabela não são divergência', () => {
    expect(divergenciasNovas(null, documento(''))).toEqual([])
    expect(divergenciasNovas(null, documento('|---|---|---|\n| : --- | --- |\n'))).toEqual([])
  })

  it('só a seção de divergências conta: a linha da seção seguinte, não', () => {
    expect(divergenciasNovas(documento(UMA), documento(UMA, '| Outra | linha | nova |\n'))).toEqual([])
    // Com a divergência da própria seção ainda nova: a seguinte fica de fora, e a da seção entra.
    expect(divergenciasNovas(null, documento(UMA, '| Outra | linha | nova |\n'))).toEqual([UMA.trim()])
  })

  it('a linha de comentário e a em branco não são divergência', () => {
    expect(divergenciasNovas(null, documento('<!-- escreva aqui -->\n\n'))).toEqual([])
  })

  it('o recuo da linha e o espaço depois do título não escondem a seção nem a divergência', () => {
    // Comentário recuado: sem o `trim` da linha ele passaria por divergência.
    expect(divergenciasNovas(null, documento('  <!-- escreva aqui -->\n'))).toEqual([])
    // A linha recuada que é divergência entra sem o recuo, e a que o HEAD já tinha, com recuo diferente, é a mesma.
    expect(divergenciasNovas(null, documento(`   ${UMA}`))).toEqual([UMA.trim()])
    expect(divergenciasNovas(documento(UMA), documento(`    ${UMA}`))).toEqual([])
    // Título com espaço no fim: sem o `trim` do título a seção some.
    expect(divergenciasNovas(null, documento(UMA).replace('nesta tarefa\n', 'nesta tarefa  \n'))).toEqual([UMA.trim()])
  })

  it('o negrito do "nenhuma" não é divergência', () => {
    expect(divergenciasNovas(null, documento('**Nenhuma.**\n'))).toEqual([])
    expect(divergenciasNovas(null, documento('| **nenhuma** | | |\n'))).toEqual([])
  })

  it('a seção que é a última do documento vai até o fim', () => {
    const ultima = `# Tarefa\n\n## Divergências resolvidas nesta tarefa\n\n${CABECALHO}${UMA.trim()}`
    expect(divergenciasNovas(null, ultima)).toEqual([UMA.trim()])
  })

  it('documento sem a seção não tem divergência', () => {
    expect(divergenciasNovas(null, '# Tarefa\n\n## Mutações\n\n| a | b | c |\n')).toEqual([])
  })

  it('a divergência escrita em texto corrido, e não em tabela, também conta', () => {
    expect(divergenciasNovas(null, documento('O limite passa de 5 para 6.\n'))).toEqual(['O limite passa de 5 para 6.'])
  })
})

describe('citacoesDaLinha', () => {
  const DOC = 'tasks/prd-x/3_task.md'
  const linha = (onde: string) => `| Divergência | Motivo | ${onde} |`

  it('lê a última célula: cada .md citado, na pasta do documento (techspec.md e cenarios.md) ou na raiz (o que tem caminho)', () => {
    expect(citacoesDaLinha(linha('`techspec.md` §3; `cenarios.md` (C2); `docs/runbook.md` ("Classificação")'), DOC)).toEqual([
      { arquivo: 'tasks/prd-x/techspec.md' },
      { arquivo: 'tasks/prd-x/cenarios.md' },
      { arquivo: 'docs/runbook.md' },
    ])
  })

  it('o .md com letra ou número colado depois (cenarios.mdx, x.md5) não é citação', () => {
    expect(citacoesDaLinha(linha('`cenarios.mdx`; `docs/x.md5`'), DOC)).toBeNull()
    // O .md de verdade, na mesma célula, continua citado.
    expect(citacoesDaLinha(linha('`cenarios.mdx`; `cenarios.md`'), DOC)).toEqual([{ arquivo: 'tasks/prd-x/cenarios.md' }])
  })

  it('URL, caminho absoluto, // , placeholder e glob na última célula não são citação', () => {
    expect(citacoesDaLinha(linha('`https://github.com/x/y/blob/main/docs/a.md`'), DOC)).toBeNull()
    expect(citacoesDaLinha(linha('`/home/u/repo/docs/runbook.md`'), DOC)).toBeNull()
    expect(citacoesDaLinha(linha('`foo//x.md`'), DOC)).toBeNull()
    expect(citacoesDaLinha(linha('`<spec>/cenarios.md`'), DOC)).toBeNull()
    expect(citacoesDaLinha(linha('`prd-*/techspec.md`'), DOC)).toBeNull()
    // O nome de verdade, ao lado do que não vale, continua citado.
    expect(citacoesDaLinha(linha('`https://github.com/x/y/blob/main/docs/a.md`; `docs/runbook.md`'), DOC)).toEqual([{ arquivo: 'docs/runbook.md' }])
  })

  it('o ./ do começo do caminho sai', () => {
    expect(citacoesDaLinha(linha('`./docs/runbook.md`'), DOC)).toEqual([{ arquivo: 'docs/runbook.md' }])
  })

  it('só a última célula conta: o .md citado na divergência ou no motivo não é cobrado', () => {
    expect(citacoesDaLinha('| Muda o `docs/lgpd.md` | O `docs/arquitetura.md` dizia outra coisa | `techspec.md` §3 |', DOC)).toEqual([{ arquivo: 'tasks/prd-x/techspec.md' }])
  })

  it('a linha citada, e o intervalo, ficam na citação', () => {
    expect(citacoesDaLinha(linha('`cenarios.md:140`'), DOC)).toEqual([{ arquivo: 'tasks/prd-x/cenarios.md', de: 140, ate: 140 }])
    expect(citacoesDaLinha(linha('`tasks/prd-x/cenarios.md:140-150`'), DOC)).toEqual([{ arquivo: 'tasks/prd-x/cenarios.md', de: 140, ate: 150 }])
  })

  it('o mesmo arquivo com duas linhas são duas citações; sem a linha, uma só', () => {
    expect(citacoesDaLinha(linha('`cenarios.md:10` e `cenarios.md:20`'), DOC)).toHaveLength(2)
    expect(citacoesDaLinha(linha('`cenarios.md` (C1) e `cenarios.md` (C2)'), DOC)).toHaveLength(1)
  })

  it('o que não é .md (código, yaml, teste) e o .md sem caminho que não é da spec não são cobrados', () => {
    expect(citacoesDaLinha(linha('`infra/grafana/alertas/x.yaml`; `packages/core/src/a.ts`; `README.md`; `uso.int.test.ts` › caso'), DOC)).toBeNull()
  })

  it('sem coluna (linha em texto corrido) ou sem nada citado na última célula, não há citação: vale o "um dos dois"', () => {
    expect(citacoesDaLinha('- **O limite passa de 5 para 6.** A Tech Spec §3 dizia 5.', DOC)).toBeNull()
    expect(citacoesDaLinha(linha('§3 da Tech Spec'), DOC)).toBeNull()
    // Texto corrido com barras no meio não é tabela: só a linha que começa por `|` tem células.
    expect(citacoesDaLinha('A Tech Spec | dizia 5 | e passa a 6 | `techspec.md` §3', DOC)).toBeNull()
    // Uma tabela de duas colunas não tem a "Onde está na spec": a segunda é o motivo.
    expect(citacoesDaLinha('| Divergência | `techspec.md` |', DOC)).toBeNull()
  })
})

describe('avisoDeDivergencia', () => {
  const DOC = 'tasks/prd-x/3_task.md'
  const OS_DOIS = '| O limite passa de 5 para 6 | A medição deu 6 | `techspec.md` §3; `cenarios.md` (C2) |'
  const TEXTO_CORRIDO = 'O limite passa de 5 para 6.'

  it('com linha nova e a spec parada, avisa e diz o documento, a quantidade e o arquivo que falta', () => {
    const aviso = avisoDeDivergencia([UMA.trim(), OUTRA.trim()], DOC, ['tools/a.ts', DOC])
    expect(aviso?.startsWith(`Atenção: a seção "Divergências resolvidas nesta tarefa" de ${DOC} ganhou 2 linhas`)).toBe(true)
    expect(aviso).toContain(DOC)
    expect(aviso).toContain('2 linhas')
    expect(aviso).toContain('tasks/prd-x/techspec.md')
    expect(aviso).toContain('tasks/prd-x/cenarios.md')
    expect(aviso).toMatch(/só informa/)
    expect(aviso?.endsWith('\n')).toBe(true)
    expect(aviso).not.toContain('undefined')
  })

  it('uma linha só, no singular', () => {
    expect(avisoDeDivergencia([UMA.trim()], DOC, [])).toContain('1 linha ')
  })

  it('sem linha nova, sem aviso', () => {
    expect(avisoDeDivergencia([], DOC, [])).toBeNull()
  })

  it('a linha em texto corrido entra no aviso sem o marcador da lista e sem o negrito', () => {
    const aviso = avisoDeDivergencia(['- **O limite passa de 5 para 6.** A Tech Spec §3 dizia 5.'], DOC, [])
    expect(aviso).toContain('- "O limite passa de 5 para 6. A Tech Spec §3 dizia 5.": falta mudar')
  })

  it('a linha que cita só a techspec.md fica quite com ela; o cenarios.md mudado não a livra', () => {
    expect(avisoDeDivergencia([UMA.trim()], DOC, ['tasks/prd-x/techspec.md'])).toBeNull()
    const aviso = avisoDeDivergencia([UMA.trim()], DOC, ['tasks/prd-x/cenarios.md'])
    expect(aviso).toContain('falta mudar tasks/prd-x/techspec.md')
    expect(aviso).not.toContain('falta mudar tasks/prd-x/cenarios.md')
  })

  it('a linha que cita só o cenarios.md fica quite com ele; a techspec.md mudada não a livra', () => {
    expect(avisoDeDivergencia([OUTRA.trim()], DOC, ['tasks/prd-x/cenarios.md'])).toBeNull()
    expect(avisoDeDivergencia([OUTRA.trim()], DOC, ['tasks/prd-x/techspec.md'])).toContain('falta mudar tasks/prd-x/cenarios.md')
  })

  it('a linha que cita os dois, com só um mudado, avisa e diz qual falta', () => {
    const soTech = avisoDeDivergencia([OS_DOIS], DOC, ['tasks/prd-x/techspec.md'])
    expect(soTech).toContain('falta mudar tasks/prd-x/cenarios.md')
    expect(soTech).not.toContain('falta mudar tasks/prd-x/techspec.md')
    const soCenarios = avisoDeDivergencia([OS_DOIS], DOC, ['tasks/prd-x/cenarios.md'])
    expect(soCenarios).toContain('falta mudar tasks/prd-x/techspec.md')
    expect(avisoDeDivergencia([OS_DOIS], DOC, ['tasks/prd-x/techspec.md', 'tasks/prd-x/cenarios.md'])).toBeNull()
  })

  it('a linha que cita o documento da seção 11 cobra também esse documento', () => {
    const tres = '| O alerta lê a métrica | A spec não dizia de onde | `techspec.md` §7c; `docs/runbook.md` ("Classificação atrasada") |'
    expect(avisoDeDivergencia([tres], DOC, ['tasks/prd-x/techspec.md'])).toContain('falta mudar docs/runbook.md')
    expect(avisoDeDivergencia([tres], DOC, ['tasks/prd-x/techspec.md', 'docs/runbook.md'])).toBeNull()
  })

  it('cada linha com o que falta dela: a que está quite não entra, e a contagem é das pendentes', () => {
    const aviso = avisoDeDivergencia([UMA.trim(), OUTRA.trim()], DOC, ['tasks/prd-x/techspec.md'])
    expect(aviso).toContain('1 linha ')
    expect(aviso).toContain('O nome da função muda')
    expect(aviso).not.toContain('O limite passa de 5 para 6')
  })

  it('linha em texto corrido, sem coluna: basta um dos dois', () => {
    expect(avisoDeDivergencia([TEXTO_CORRIDO], DOC, [])).toContain('tasks/prd-x/techspec.md ou tasks/prd-x/cenarios.md')
    expect(avisoDeDivergencia([TEXTO_CORRIDO], DOC, ['tasks/prd-x/cenarios.md'])).toBeNull()
    expect(avisoDeDivergencia([TEXTO_CORRIDO], DOC, ['tasks/prd-x/techspec.md'])).toBeNull()
  })

  it('a techspec.md de outra spec não vale', () => {
    expect(avisoDeDivergencia([UMA.trim()], DOC, ['tasks/prd-y/techspec.md', 'tasks/prd-y/cenarios.md', 'techspec.md'])).not.toBeNull()
  })

  it('a linha citada (cenarios.md:140) com o diff em outro trecho avisa; com o diff nela, não', () => {
    const naLinha140 = '| Divergência | Motivo | `cenarios.md:140` |'
    const alterados = ['tasks/prd-x/cenarios.md']
    const aviso = avisoDeDivergencia([naLinha140], DOC, alterados, () => false)
    expect(aviso).toContain('tasks/prd-x/cenarios.md:140')
    expect(aviso).toMatch(/mudou, mas não nessa linha/)
    expect(avisoDeDivergencia([naLinha140], DOC, alterados, (arquivo, de, ate) => arquivo === 'tasks/prd-x/cenarios.md' && de === 140 && ate === 140)).toBeNull()
  })

  it('o intervalo citado vai inteiro ao aviso', () => {
    const intervalo = '| Divergência | Motivo | `cenarios.md:140-150` |'
    expect(avisoDeDivergencia([intervalo], DOC, ['tasks/prd-x/cenarios.md'], () => false)).toContain('tasks/prd-x/cenarios.md:140-150:')
  })

  it('a divergência longa vai ao aviso cortada em 80 caracteres, com reticências', () => {
    const longa = `| ${'a'.repeat(100)} | Motivo | \`techspec.md\` §3 |`
    const aviso = avisoDeDivergencia([longa], DOC, [])
    expect(aviso).toContain(`"${'a'.repeat(80)}…"`)
    expect(aviso).not.toContain('a'.repeat(81))
  })

  it('o arquivo que não mudou nada não é perguntado ao diff: falta mudar, sem "mas não nessa linha"', () => {
    const naLinha140 = '| Divergência | Motivo | `cenarios.md:140` |'
    const aviso = avisoDeDivergencia([naLinha140], DOC, [], () => true)
    expect(aviso).toContain('falta mudar tasks/prd-x/cenarios.md:140')
    expect(aviso).not.toMatch(/mas não nessa linha/)
  })
})

describe('avisoDaDivergenciaSoNoDocumento', () => {
  const DOC = 'tasks/prd-x/3_task.md'

  /** Um repositório com a spec e a tarefa já commitadas, sem divergência. */
  const criados: string[] = []
  afterEach(() => {
    for (const raiz of criados.splice(0)) rmSync(raiz, { recursive: true, force: true })
  })

  function repositorio(): { raiz: string; git: (...argumentos: string[]) => string; escrever: (arquivo: string, conteudo: string) => void } {
    const raiz = mkdtempSync(join(tmpdir(), 'divergencias-'))
    criados.push(raiz)
    const git = (...argumentos: string[]) => execFileSync('git', argumentos, { cwd: raiz, encoding: 'utf8', stdio: 'pipe' })
    const escrever = (arquivo: string, conteudo: string) => {
      mkdirSync(dirname(join(raiz, arquivo)), { recursive: true })
      writeFileSync(join(raiz, arquivo), conteudo)
    }
    git('init', '-q')
    git('config', 'user.email', 'teste@exemplo.com')
    git('config', 'user.name', 'Teste')
    escrever('tasks/prd-x/techspec.md', '# Tech Spec\n')
    escrever('tasks/prd-x/cenarios.md', '# Cenários\n')
    escrever(DOC, documento(''))
    git('add', '-A')
    git('commit', '-q', '-m', 'base')
    return { raiz, git, escrever }
  }

  it('divergência só no documento: avisa', () => {
    const { raiz, escrever } = repositorio()
    escrever(DOC, documento(UMA))
    expect(avisoDaDivergenciaSoNoDocumento(raiz, DOC, [DOC])).toContain('1 linha ')
  })

  it('divergência no documento e na techspec.md: não avisa', () => {
    const { raiz, escrever } = repositorio()
    escrever(DOC, documento(UMA))
    escrever('tasks/prd-x/techspec.md', '# Tech Spec\n\nO limite passa de 5 para 6.\n')
    expect(avisoDaDivergenciaSoNoDocumento(raiz, DOC, [DOC, 'tasks/prd-x/techspec.md'])).toBeNull()
  })

  it('documento sem alteração na seção: não avisa', () => {
    const { raiz } = repositorio()
    expect(avisoDaDivergenciaSoNoDocumento(raiz, DOC, [])).toBeNull()
  })

  it('a linha que o HEAD já tinha não avisa de novo', () => {
    const { raiz, git, escrever } = repositorio()
    escrever(DOC, documento(UMA))
    git('add', '-A')
    git('commit', '-q', '-m', 'divergência registrada')
    expect(avisoDaDivergenciaSoNoDocumento(raiz, DOC, [])).toBeNull()
    escrever(DOC, documento(UMA + OUTRA))
    expect(avisoDaDivergenciaSoNoDocumento(raiz, DOC, [DOC])).toContain('1 linha ')
  })

  const DOIS = '| O limite passa de 5 para 6 | A medição deu 6 | `techspec.md` §3; `cenarios.md:3` |\n'

  it('cita os dois e só um mudou: avisa o que falta', () => {
    const { raiz, escrever } = repositorio()
    escrever(DOC, documento(DOIS))
    escrever('tasks/prd-x/techspec.md', '# Tech Spec\n\nO limite passa de 5 para 6.\n')
    const aviso = avisoDaDivergenciaSoNoDocumento(raiz, DOC, [DOC, 'tasks/prd-x/techspec.md'])
    expect(aviso).toContain('falta mudar tasks/prd-x/cenarios.md:3')
    expect(aviso).not.toContain('falta mudar tasks/prd-x/techspec.md')
  })

  it('cita cenarios.md:3 e o diff está em outro trecho: avisa; o diff na linha 3 cala', () => {
    const { raiz, git, escrever } = repositorio()
    escrever('tasks/prd-x/techspec.md', '# Tech Spec\n')
    escrever('tasks/prd-x/cenarios.md', '# Cenários\n\nC1\n\nC2\n\nC3\n')
    git('add', '-A')
    git('commit', '-q', '-m', 'cenários')
    escrever(DOC, documento(DOIS))
    escrever('tasks/prd-x/techspec.md', '# Tech Spec\n\nO limite passa de 5 para 6.\n')
    // O diff do cenarios.md cai na linha 7, e a citada é a 3.
    escrever('tasks/prd-x/cenarios.md', '# Cenários\n\nC1\n\nC2\n\nC3\n\nC4\n')
    const alterados = [DOC, 'tasks/prd-x/techspec.md', 'tasks/prd-x/cenarios.md']
    expect(avisoDaDivergenciaSoNoDocumento(raiz, DOC, alterados)).toMatch(/cenarios\.md:3.*mudou, mas não nessa linha/)
    // O diff cai na linha 1, antes da citada.
    escrever('tasks/prd-x/cenarios.md', '# Cenários da spec\n\nC1\n\nC2\n\nC3\n')
    expect(avisoDaDivergenciaSoNoDocumento(raiz, DOC, alterados)).toMatch(/cenarios\.md:3.*mudou, mas não nessa linha/)
    // Agora o diff cai na linha 3.
    escrever('tasks/prd-x/cenarios.md', '# Cenários\n\nC1 e o limite de 6\n\nC2\n\nC3\n')
    expect(avisoDaDivergenciaSoNoDocumento(raiz, DOC, alterados)).toBeNull()
  })

  it('a linha só removida dentro do intervalo citado não é trecho tocado', () => {
    const { raiz, git, escrever } = repositorio()
    escrever('tasks/prd-x/cenarios.md', '# Cenários\n\nC1\n\nC2\n\nC3\n')
    git('add', '-A')
    git('commit', '-q', '-m', 'cenários')
    escrever(DOC, documento('| O limite passa de 5 para 6 | A medição deu 6 | `cenarios.md:1-7` |\n'))
    // Só tira a linha 4 em branco: o diff é `@@ -4 +3,0 @@`, e nada do que a divergência diz entrou no arquivo.
    escrever('tasks/prd-x/cenarios.md', '# Cenários\n\nC1\nC2\n\nC3\n')
    expect(avisoDaDivergenciaSoNoDocumento(raiz, DOC, [DOC, 'tasks/prd-x/cenarios.md'])).toMatch(/cenarios\.md:1-7.*mudou, mas não nessa linha/)
    // Com uma linha acrescentada dentro do intervalo, está tocado.
    escrever('tasks/prd-x/cenarios.md', '# Cenários\n\nC1\nC2 com o limite de 6\n\nC3\n')
    expect(avisoDaDivergenciaSoNoDocumento(raiz, DOC, [DOC, 'tasks/prd-x/cenarios.md'])).toBeNull()
  })

  it('o cenarios.md novo (fora do HEAD) vale como tocado em qualquer linha citada', () => {
    const { raiz, escrever } = repositorio()
    escrever(DOC, documento('| O limite passa de 5 para 6 | A medição deu 6 | `cenarios.md:3` |\n'))
    escrever('tasks/prd-x/cenarios.md', '# Cenários\n\nC1\n')
    // Um arquivo que o HEAD não tem não deixa trecho no diff: todo o texto dele é novo.
    execFileSync('git', ['rm', '-q', '--cached', 'tasks/prd-x/cenarios.md'], { cwd: raiz })
    execFileSync('git', ['commit', '-q', '-m', 'sem cenários'], { cwd: raiz })
    escrever('tasks/prd-x/cenarios.md', '# Cenários\n\nC1\n')
    expect(avisoDaDivergenciaSoNoDocumento(raiz, DOC, [DOC, 'tasks/prd-x/cenarios.md'])).toBeNull()
  })

  it('documento novo: toda linha da seção é nova', () => {
    const { raiz, escrever } = repositorio()
    escrever('tasks/prd-x/4_task.md', documento(UMA + OUTRA))
    expect(avisoDaDivergenciaSoNoDocumento(raiz, 'tasks/prd-x/4_task.md', ['tasks/prd-x/4_task.md'])).toContain('2 linhas')
  })
})

describe('a ligação no portão', () => {
  // `portao-local.ts` executa ao ser importado e rodar o portão num teste custa minutos: a ligação se prova pela leitura do fonte,
  // como as demais (`duracao-do-e2e.test.ts`, `e2e-que-cita-literal.test.ts`).
  const portao = readFileSync(join(import.meta.dirname, 'portao-local.ts'), 'utf8')

  it('o portão imprime o aviso, só informa, e antes de qualquer suíte', () => {
    expect(portao).toContain('  const aviso = avisoDaDivergenciaSoNoDocumento(raiz, documento, arquivosAlterados(raiz))')
    expect(portao).toContain('  if (aviso !== null) process.stdout.write(`\\n${aviso}`)')
    expect(portao.indexOf('const aviso = avisoDaDivergenciaSoNoDocumento(raiz')).toBeLessThan(portao.indexOf('const dependencias = rodar('))
    // Só informa: o aviso não sai do processo nem grava recusa.
    const trecho = portao.slice(portao.indexOf('const aviso = avisoDaDivergenciaSoNoDocumento(raiz'), portao.indexOf('const dependencias = rodar('))
    expect(trecho).not.toContain('process.exit')
  })

  it('o subcomando revisores imprime o mesmo aviso, depois das linhas dos revisores, e não muda o código de saída (M1 da retro da F4b)', () => {
    const revisores = portao.slice(portao.indexOf("if (argumentos[0] === 'revisores')"), portao.indexOf('// Daqui em diante o portão roda suíte'))
    expect(revisores).toContain('const divergencia = avisoDaDivergenciaSoNoDocumento(raiz, documento, alterados)')
    expect(revisores).toContain('if (divergencia !== null) process.stdout.write(`\\n${divergencia}`)')
    expect(revisores.indexOf('avisoDaDivergenciaSoNoDocumento(raiz')).toBeGreaterThan(revisores.indexOf('nada pendente'))
    expect(revisores.indexOf('avisoDaDivergenciaSoNoDocumento(raiz')).toBeLessThan(revisores.indexOf('process.exit(bloqueios.length > 0 ? 1 : 0)'))
  })
})
