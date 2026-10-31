import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { e2eDosLiteraisRemovidos, e2eQueCitam, literaisDaLinha, literaisDaWeb, literaisRemovidos } from './e2e-que-cita-literal.ts'
import { raizRepositorio } from './executar.ts'

describe('literaisDaLinha: o que uma linha de código da web mostra ou nomeia', () => {
  it('texto entre aspas simples, duplas e de template; o template vale pelas partes fixas', () => {
    expect(literaisDaLinha("  titulo: 'Governança da escola',")).toEqual(['Governança da escola'])
    expect(literaisDaLinha('  <Aviso titulo="Convite vencido" />')).toEqual(['Convite vencido'])
    expect(literaisDaLinha('  const texto = `Refazer o convite de ${nome} agora mesmo`')).toEqual(['Refazer o convite de', 'agora mesmo'])
    expect(literaisDaLinha("  rotulo: 'Sair',")).toEqual(['Sair'])
    expect(literaisDaLinha("  const t = 'Tela d\\'ajuda aberta'")).toEqual(["Tela d'ajuda aberta"])
  })

  it('texto de JSX na mesma linha, e o de linha própria que começa em maiúscula; a expressão entre chaves divide o texto', () => {
    expect(literaisDaLinha('  <h2 className="titulo">Governança</h2>')).toEqual(['Governança'])
    expect(literaisDaLinha('      Refazer o convite de {professor.nome}')).toEqual(['Refazer o convite de'])
    expect(literaisDaLinha('      Convite enviado a {professor.nome} pela coordenação')).toEqual(['Convite enviado a', 'pela coordenação'])
    expect(literaisDaLinha('      Governança')).toEqual(['Governança'])
    expect(literaisDaLinha('  <a title="Governança">Governança</a>')).toEqual(['Governança'])
  })

  it('não conta comentário, import, export from, palavra solta em minúscula, caminho relativo nem o que é curto demais', () => {
    expect(literaisDaLinha("  // troca 'Governança' pelo novo nome")).toEqual([])
    expect(literaisDaLinha("   * ver 'Governança da escola'")).toEqual([])
    expect(literaisDaLinha("  /* 'Governança da escola' */")).toEqual([])
    expect(literaisDaLinha("import { Aviso } from './aviso.tsx'")).toEqual([])
    expect(literaisDaLinha("export { Aviso } from './aviso.tsx'")).toEqual([])
    expect(literaisDaLinha("import './estilo.css'")).toEqual([])
    expect(literaisDaLinha("import { useQuery } from '@tanstack/react-query'")).toEqual([])
    expect(literaisDaLinha("export { Esquema } from 'pacote-de-esquemas'")).toEqual([])
    expect(literaisDaLinha("import 'tailwindcss/base.css'")).toEqual([])
    expect(literaisDaLinha('  Object.keys(tabela)')).toEqual([])
    expect(literaisDaLinha("  type: 'button',")).toEqual([])
    expect(literaisDaLinha("  const origem = '../modelo/escola.ts'")).toEqual([])
    expect(literaisDaLinha("  const a = 'ok'")).toEqual([])
    expect(literaisDaLinha("  const a = 'Ver'")).toEqual([])
    expect(literaisDaLinha("  const prazo = '1234 5678'")).toEqual([])
    expect(literaisDaLinha("  const estilo = './estilo.css'")).toEqual([])
    expect(literaisDaLinha('  Aviso,')).toEqual([])
    expect(literaisDaLinha('  return resultado')).toEqual([])
    expect(literaisDaLinha('  } else {')).toEqual([])
  })

  it('o identificador de teste e a rota contam: o e2e os cita', () => {
    expect(literaisDaLinha('  <div data-testid="sino-da-coordenacao">')).toEqual(['sino-da-coordenacao'])
    expect(literaisDaLinha("  const caminho = '/coordenacao/professores'")).toEqual(['/coordenacao/professores'])
  })
})

describe('literaisRemovidos: o que o diff de apps/web/src tirou de vez', () => {
  const diffDe = (arquivo: string, removidas: string[], acrescentadas: string[] = []) =>
    [
      `diff --git a/${arquivo} b/${arquivo}`,
      `--- a/${arquivo}`,
      `+++ b/${arquivo}`,
      '@@ -10,2 +10,2 @@',
      ...removidas.map((linha) => `-${linha}`),
      ...acrescentadas.map((linha) => `+${linha}`),
      '',
    ].join('\n')
  const apagado = (arquivo: string, removidas: string[]) =>
    [`diff --git a/${arquivo} b/${arquivo}`, 'deleted file mode 100644', `--- a/${arquivo}`, '+++ /dev/null', '@@ -1,2 +0,0 @@', ...removidas.map((linha) => `-${linha}`), ''].join('\n')
  const naWebNaoHaNada = new Set<string>()

  it('o texto trocado por outro saiu', () => {
    const diff = diffDe('apps/web/src/casca/menu.tsx', ['  <span>Governança</span>'], ['  <span>Gestão</span>'])
    expect(literaisRemovidos(diff, naWebNaoHaNada)).toEqual(['Governança'])
  })

  it('o texto que o diff recoloca em outra linha não saiu; o que a web ainda tem também não', () => {
    const movido = diffDe('apps/web/src/casca/menu.tsx', ['  <span>Governança</span>'], ['  <b>Governança</b>'])
    expect(literaisRemovidos(movido, naWebNaoHaNada)).toEqual([])
    const emOutroArquivo = [
      diffDe('apps/web/src/casca/menu.tsx', ['  <span>Governança</span>']),
      diffDe('apps/web/src/casca/rotulos.ts', [], ["  governanca: 'Governança',"]),
    ].join('')
    expect(literaisRemovidos(emOutroArquivo, naWebNaoHaNada)).toEqual([])
    const aindaNaWeb = diffDe('apps/web/src/casca/menu.tsx', ['  <span>Governança</span>'])
    expect(literaisRemovidos(aindaNaWeb, new Set(['Governança']))).toEqual([])
  })

  it('o texto que sai de um arquivo e outro, que o diff nem toca, ainda tem não saiu da web', () => {
    const diff = diffDe('apps/web/src/a.tsx', ['  <b>Tentar de novo</b>', '  <b>Convite vencido</b>'])
    expect(literaisRemovidos(diff, new Set(['Tentar de novo']))).toEqual(['Convite vencido'])
  })

  it('arquivo apagado tira só o que nenhum outro arquivo da web tem', () => {
    const diff = apagado('apps/web/src/velho.tsx', ['  <h1>Painel antigo</h1>', '  <p>Tentar de novo</p>'])
    expect(literaisRemovidos(diff, naWebNaoHaNada)).toEqual(['Painel antigo', 'Tentar de novo'])
    expect(literaisRemovidos(diff, new Set(['Tentar de novo']))).toEqual(['Painel antigo'])
  })

  it('teste da web não conta: o e2e não o lê', () => {
    const diff = diffDe('apps/web/src/casca/menu.test.tsx', ["  expect(tela.getByText('Governança')).toBeVisible()"])
    expect(literaisRemovidos(diff, naWebNaoHaNada)).toEqual([])
  })

  it('cada literal vem uma vez, de todos os arquivos', () => {
    const diff = [diffDe('apps/web/src/a.tsx', ['  <b>Governança</b>']), diffDe('apps/web/src/b.tsx', ['  <i>Governança</i>', '  <i>Convite vencido</i>'])].join('')
    expect(literaisRemovidos(diff, naWebNaoHaNada)).toEqual(['Governança', 'Convite vencido'])
  })
})

describe('literaisDaWeb: o que a web inteira ainda mostra', () => {
  it('junta os literais de todo .ts e .tsx de apps/web/src, em qualquer pasta, e deixa de fora o teste da web', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'literais-da-web-'))
    try {
      mkdirSync(join(raiz, 'apps/web/src/areas/professor'), { recursive: true })
      writeFileSync(join(raiz, 'apps/web/src/menu.tsx'), '<nav>\n  <a>Governança</a>\n</nav>\n')
      writeFileSync(join(raiz, 'apps/web/src/areas/professor/rotulos.ts'), "export const R = 'Tentar de novo'\n")
      writeFileSync(join(raiz, 'apps/web/src/areas/professor/rotulos.test.ts'), "expect(tela.getByText('Só no teste')).toBeVisible()\n")
      writeFileSync(join(raiz, 'apps/web/src/estilo.css'), '.a::after { content: "Só no estilo" }\n')
      // Uma pasta com nome de arquivo não é arquivo: lê-la como arquivo derrubaria o portão.
      mkdirSync(join(raiz, 'apps/web/src/algo.ts'))
      writeFileSync(join(raiz, 'apps/web/src/algo.ts/dentro.tsx'), '<b>Dentro da pasta</b>\n')
      expect([...literaisDaWeb(raiz)].sort()).toEqual(['Dentro da pasta', 'Governança', 'Tentar de novo'])
    } finally {
      rmSync(raiz, { recursive: true, force: true })
    }
  })

  it('sem apps/web/src, nenhum literal', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'literais-da-web-'))
    try {
      expect([...literaisDaWeb(raiz)]).toEqual([])
    } finally {
      rmSync(raiz, { recursive: true, force: true })
    }
  })
})

describe('no repositório: o e2e que cita o literal que saiu', () => {
  const pastas: string[] = []
  afterEach(() => {
    for (const pasta of pastas.splice(0)) rmSync(pasta, { recursive: true, force: true })
  })

  const git = (raiz: string, ...argumentos: string[]) => execFileSync('git', argumentos, { cwd: raiz, encoding: 'utf8' })

  function repositorio(): string {
    const raiz = mkdtempSync(join(tmpdir(), 'e2e-literal-'))
    pastas.push(raiz)
    git(raiz, 'init', '-q')
    git(raiz, 'config', 'user.email', 'teste@educa.invalid')
    git(raiz, 'config', 'user.name', 'teste')
    // O repositório temporário herda o git global: numa máquina que assina todo commit, o `git commit` do teste falharia.
    git(raiz, 'config', 'commit.gpgsign', 'false')
    mkdirSync(join(raiz, 'apps/web/src'), { recursive: true })
    mkdirSync(join(raiz, 'e2e/support'), { recursive: true })
    writeFileSync(join(raiz, 'apps/web/src/menu.tsx'), '<nav>\n  <a>Governança</a>\n  <a>Turmas</a>\n</nav>\n')
    writeFileSync(join(raiz, 'e2e/casca.spec.ts'), "await page.getByRole('link', { name: /governança/i }).click()\n")
    writeFileSync(join(raiz, 'e2e/turmas.spec.ts'), "await page.getByRole('link', { name: 'Turmas' }).click()\n")
    writeFileSync(join(raiz, 'e2e/outro.spec.ts'), "await page.goto('/entrar')\n")
    writeFileSync(join(raiz, 'e2e/support/casca.ts'), "export const secao = 'Governança'\n")
    mkdirSync(join(raiz, 'packages/shared/src'), { recursive: true })
    writeFileSync(join(raiz, 'packages/shared/src/rotulos.ts'), "export const SECAO = 'Governança'\n")
    git(raiz, 'add', '.')
    git(raiz, 'commit', '-q', '-m', 'base')
    return raiz
  }

  it('o spec que cita o texto trocado entra, sem diferenciar maiúscula; o que cita o texto que ficou, e o ajudante, não', () => {
    const raiz = repositorio()
    writeFileSync(join(raiz, 'apps/web/src/menu.tsx'), '<nav>\n  <a>Gestão</a>\n  <a>Turmas</a>\n</nav>\n')
    expect(e2eDosLiteraisRemovidos(raiz)).toEqual([{ arquivo: 'e2e/casca.spec.ts', literais: ['Governança'] }])
  })

  it('o texto que sai de fora de apps/web/src não conta', () => {
    const raiz = repositorio()
    writeFileSync(join(raiz, 'packages/shared/src/rotulos.ts'), "export const SECAO = 'Gestão'\n")
    expect(e2eDosLiteraisRemovidos(raiz)).toEqual([])
  })

  it('a mudança já preparada no índice também conta', () => {
    const raiz = repositorio()
    writeFileSync(join(raiz, 'apps/web/src/menu.tsx'), '<nav>\n  <a>Gestão</a>\n  <a>Turmas</a>\n</nav>\n')
    git(raiz, 'add', 'apps/web/src/menu.tsx')
    expect(e2eDosLiteraisRemovidos(raiz).map((citado) => citado.arquivo)).toEqual(['e2e/casca.spec.ts'])
  })

  it('sem mudança em apps/web/src, ou só com texto acrescentado, nenhum spec entra', () => {
    const raiz = repositorio()
    expect(e2eDosLiteraisRemovidos(raiz)).toEqual([])
    writeFileSync(join(raiz, 'apps/web/src/menu.tsx'), '<nav>\n  <a>Governança</a>\n  <a>Turmas</a>\n  <a>Material</a>\n</nav>\n')
    expect(e2eDosLiteraisRemovidos(raiz)).toEqual([])
  })

  it('o arquivo da web apagado puxa os specs que citam o que ele tinha', () => {
    const raiz = repositorio()
    rmSync(join(raiz, 'apps/web/src/menu.tsx'))
    expect(e2eDosLiteraisRemovidos(raiz).map((citado) => citado.arquivo).sort()).toEqual(['e2e/casca.spec.ts', 'e2e/turmas.spec.ts'])
  })

  it('o texto que sai de um arquivo da web mas fica em outro, que a árvore não tocou, não puxa o spec', () => {
    const raiz = repositorio()
    writeFileSync(join(raiz, 'apps/web/src/rodape.tsx'), '<footer>\n  <a>Governança</a>\n</footer>\n')
    git(raiz, 'add', '.')
    git(raiz, 'commit', '-q', '-m', 'o rodapé também tem')
    writeFileSync(join(raiz, 'apps/web/src/menu.tsx'), '<nav>\n  <a>Gestão</a>\n  <a>Turmas</a>\n</nav>\n')
    expect(e2eDosLiteraisRemovidos(raiz)).toEqual([])
  })

  it('o arquivo apagado puxa só os specs do texto que nenhum outro arquivo da web tem', () => {
    const raiz = repositorio()
    writeFileSync(join(raiz, 'apps/web/src/lateral.tsx'), '<aside>\n  <a>Turmas</a>\n</aside>\n')
    git(raiz, 'add', '.')
    git(raiz, 'commit', '-q', '-m', 'a lateral também tem Turmas')
    rmSync(join(raiz, 'apps/web/src/menu.tsx'))
    expect(e2eDosLiteraisRemovidos(raiz)).toEqual([{ arquivo: 'e2e/casca.spec.ts', literais: ['Governança'] }])
  })

  it('o texto que sai de um arquivo para um arquivo novo, ainda fora do índice, não saiu da web', () => {
    const raiz = repositorio()
    writeFileSync(join(raiz, 'apps/web/src/menu.tsx'), '<nav>\n  <a>Gestão</a>\n  <a>Turmas</a>\n</nav>\n')
    writeFileSync(join(raiz, 'apps/web/src/novo.tsx'), '<footer>\n  <a>Governança</a>\n</footer>\n')
    expect(git(raiz, 'status', '--short')).toContain('?? apps/web/src/novo.tsx')
    expect(e2eDosLiteraisRemovidos(raiz)).toEqual([])
  })

  it('o texto que só um teste da web ainda tem conta como removido: o teste não aparece na tela', () => {
    const raiz = repositorio()
    writeFileSync(join(raiz, 'apps/web/src/menu.test.tsx'), "expect(tela.getByText('Governança')).toBeVisible()\n")
    git(raiz, 'add', '.')
    git(raiz, 'commit', '-q', '-m', 'o teste da web cita')
    writeFileSync(join(raiz, 'apps/web/src/menu.tsx'), '<nav>\n  <a>Gestão</a>\n  <a>Turmas</a>\n</nav>\n')
    expect(e2eDosLiteraisRemovidos(raiz)).toEqual([{ arquivo: 'e2e/casca.spec.ts', literais: ['Governança'] }])
  })

  it('e2eQueCitam lista cada spec uma vez, com os literais que ele cita', () => {
    const raiz = repositorio()
    const citados = e2eQueCitam(raiz, ['Governança', 'Turmas', 'Nada disso'])
    expect(citados).toHaveLength(2)
    expect(citados).toEqual(expect.arrayContaining([{ arquivo: 'e2e/casca.spec.ts', literais: ['Governança'] }, { arquivo: 'e2e/turmas.spec.ts', literais: ['Turmas'] }]))
    // Maiúscula não diferencia dos dois lados: o spec escreve `Turmas`, e o literal chega em minúscula.
    expect(e2eQueCitam(raiz, ['turmas'])).toEqual([{ arquivo: 'e2e/turmas.spec.ts', literais: ['turmas'] }])
    expect(e2eQueCitam(raiz, [])).toEqual([])
  })
})

// Prova por leitura do fonte, como as demais ligações do repositório (`duracao-do-e2e.test.ts`): nenhuma função sozinha prova que o
// portão chama o módulo, e rodar o portão inteiro num teste de unidade custa minutos. O preço é a fragilidade: reformatar essas duas
// linhas quebra o teste sem quebrar a regra, e então é o teste que se ajusta ao fonte.
describe('a ligação que nenhuma função sozinha prova', () => {
  const portao = readFileSync(join(raizRepositorio, 'tools/processo/portao-local.ts'), 'utf8')

  it('o portão da tarefa soma os specs achados aos alvos, e só ele', () => {
    expect(portao).toMatch(/const citados = daTarefa \? e2eDosLiteraisRemovidos\(raiz\) : \[\]/)
    expect(portao).toMatch(/alvosDoPortao\(\[\.\.\.arquivosAlterados\(raiz\), \.\.\.extras, \.\.\.citados\.map\(\(citado\) => citado\.arquivo\)\]\)/)
  })
})
