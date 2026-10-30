import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { arquivosDeCodigoDaWeb } from '../../../__fixtures__/perigo-cheio'
import { especificadoresDe, importadoresDe, semComentarios, type ArquivoDaWeb } from '../../../__fixtures__/importadores'

/**
 * A cadeia fechada da onça (RF10 da X1; `docs/interface.md` 9.7; regra 70, item 4a): o avatar **só existe com o nome da
 * função e o selo "IA" no mesmo bloco**, e isso é garantido por quem pode desenhá-lo, e não por combinado. A pasta
 * `componentes/ui/onca/` — a cabeça, e a onça de corpo inteiro — só é importada pelo `AvatarAgente`, por arquivo da
 * própria pasta e, desde a tarefa 5.0 da X4, pelas peças que desenham o corpo inteiro: a `Introducao`, a `Comemoracao` e a
 * introdução de cada papel (`BemVindo`). A `Onca` traz junto o nome da função e o selo "IA" (`figcaption`), e a pose
 * `comemorando` só a `Comemoracao` pede. Desde a correção `2026-10-28-onca-do-mockup-v3` uma tela que já existia a desenha também, o vazio de
 * Criados (`TELAS_COM_A_ONCA`), assinada pelo Assistente de ensino. O `AvatarAgente`, só a `AssinaturaIA` e a `MensagemIA`. Tela, galeria e peça
 * nova que queiram o **avatar** passam pela `AssinaturaIA`, que traz junto o nome e o selo; a **onça de corpo inteiro** só entra numa tela da
 * lista fechada, com parecer, e só onde a região guarda produção do agente que assina.
 *
 * **A onça da marca** (D80 revista em 30/10/2026; 9.7) é a outra metade: o mesmo desenho (`DesenhoDaOnca`), **sem** nome, selo nem
 * nome acessível (`OncaDaMarca`), porque não é saída de agente nenhum. Só a `CascaPublica` a importa, e só por `import()`
 * tardio: ela não vai para o primeiro carregamento da entrada. Quem quiser a onça sem assinatura em outro lugar entra na lista
 * fechada `QUEM_IMPORTA_A_ONCA_DA_MARCA`, com parecer do `conformidade-reviewer`.
 *
 * **O cenário da onça da marca** (`CenaDaOnca`; D80 revista em 30/10/2026, às 21:45; 9.7) é a peça que a põe sobre uma sala de aula,
 * de 432 × 300 px. Ele importa a `OncaDaMarca` (e só ele, além da `CascaPublica`), e só a `CascaPublica` o importa, por `import()`
 * tardio: ele também fica fora do primeiro carregamento da entrada.
 */
const RAIZ_DA_WEB = join(import.meta.dirname, '..', '..', '..')

const PASTA_DA_ONCA = 'componentes/ui/onca/'
const AVATAR = 'componentes/ui/ia/AvatarAgente'
const ASSINATURA = 'componentes/ui/ia/AssinaturaIA'
const ONCA_INTEIRA = 'componentes/ui/onca/Onca'
const ONCA_DA_MARCA = 'componentes/ui/onca/OncaDaMarca'
const CENA_DA_ONCA = 'componentes/ui/onca/CenaDaOnca'
const DESENHO_DA_ONCA = 'componentes/ui/onca/DesenhoDaOnca'
const COMEMORACAO = 'componentes/ui/Comemoracao'
const PECAS_DA_INTRODUCAO = 'componentes/introducao/'
/** As introduções de cada papel (9.0, 10.0 e 11.0): ainda podem não existir, e a lista é de quem **pode**. */
const BEM_VINDO_DOS_PAPEIS = ['areas/aluno/introducao/BemVindo.tsx', 'areas/professor/introducao/BemVindo.tsx', 'areas/coordenacao/introducao/BemVindo.tsx']
/** A `IntroducaoDoPapel` é a peça comum dos quatro estados das introduções (11.0): ela desenha a onça do carregando, e a `BemVindo` de cada papel só passa os passos. */
/**
 * As telas que já existiam e que ganharam a onça do mockup, uma lista fechada (D73: só em tela que existe; D80, item 3: com parecer do
 * `conformidade-reviewer`). Hoje é uma: o vazio "Nada gerado ainda" de Criados, assinado pelo Assistente de ensino, que é quem gera o que
 * a lista guarda. Tela nova que queira a onça entra aqui, com parecer.
 */
const TELAS_COM_A_ONCA = ['areas/professor/artefatos/Criados.tsx']
const QUEM_IMPORTA_A_ONCA_INTEIRA = ['componentes/introducao/Introducao.tsx', 'componentes/introducao/IntroducaoDoPapel.tsx', 'componentes/ui/Comemoracao.tsx', ...BEM_VINDO_DOS_PAPEIS, ...TELAS_COM_A_ONCA]
/** O cenário da onça da marca: só a casca pública, e só por `import()` tardio (a prova está no caso da entrada, abaixo). */
const QUEM_IMPORTA_A_CENA_DA_ONCA = ['componentes/CascaPublica.tsx']
/** A onça sem assinatura: a casca pública, por `import()` tardio (a de 88 px do celular), e o cenário, que a põe sobre a sala. */
const QUEM_IMPORTA_A_ONCA_DA_MARCA = ['componentes/CascaPublica.tsx', 'componentes/ui/onca/CenaDaOnca.tsx']
const QUEM_IMPORTA_A_PASTA_DA_ONCA = ['componentes/ui/ia/AvatarAgente.tsx', ...QUEM_IMPORTA_A_ONCA_INTEIRA, ...QUEM_IMPORTA_A_ONCA_DA_MARCA]
/** A `Comemoracao` é da tarefa aberta; a galeria é o palco dela até lá (o e2e de movimento precisa de uma página). */
const QUEM_IMPORTA_A_COMEMORACAO = ['areas/aluno/Atividade.tsx', 'galeria/secoes/introducao.tsx']
/** As peças da introdução: a galeria as mostra, e a introdução de cada papel as usa. Nenhum arquivo da entrada. */
const QUEM_IMPORTA_AS_PECAS_DA_INTRODUCAO = ['galeria/secoes/introducao.tsx', ...BEM_VINDO_DOS_PAPEIS]
const QUEM_IMPORTA_O_AVATAR = ['componentes/ui/ia/AssinaturaIA.tsx', 'componentes/ui/ia/Mensagem.tsx']

function arquivosDaWeb(): ArquivoDaWeb[] {
  return arquivosDeCodigoDaWeb(RAIZ_DA_WEB).map((nome) => ({ nome, conteudo: readFileSync(join(RAIZ_DA_WEB, nome), 'utf8') }))
}

/** Os módulos da pasta da onça que o arquivo importa **estaticamente** (`import … from`, `export … from`, `import '…'`), como estão escritos. */
function importacoesEstaticasDaPasta(conteudo: string): string[] {
  const codigo = semComentarios(conteudo)
  return [...codigo.matchAll(/(?:^|\s)(?:import|export)\s(?:[^'"()]*?\sfrom\s+)?['"]([^'"\n]+)['"]/g)].map(([, especificador = '']) => especificador).filter((especificador) => /(?:^|\/)onca\//.test(especificador))
}

/** Os módulos da pasta da onça que o arquivo busca por `import()`, como estão escritos. */
function importacoesTardiasDaPasta(conteudo: string): string[] {
  return [...semComentarios(conteudo).matchAll(/\bimport\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g)].map(([, especificador = '']) => especificador).filter((especificador) => /(?:^|\/)onca\//.test(especificador))
}

/** Quem importa `alvo` e não está na lista de quem pode: o que o teste reprova. */
function foraDaLista(importadores: readonly string[], permitidos: readonly string[], pasta = ''): string[] {
  return importadores.filter((nome) => !permitidos.includes(nome) && !(pasta !== '' && nome.startsWith(pasta)))
}

describe('a onça só chega à tela pela assinatura', () => {
  it('`componentes/ui/onca/` só é importado pelo `AvatarAgente`, por arquivo da própria pasta e pelas peças do corpo inteiro', () => {
    const importadores = importadoresDe(arquivosDaWeb(), PASTA_DA_ONCA)
    // Sem isto o caso passaria vazio no dia em que a varredura deixasse de achar o import.
    expect(importadores, 'o `AvatarAgente` desenha a cabeça: a varredura não o achou').toContain('componentes/ui/ia/AvatarAgente.tsx')
    expect(foraDaLista(importadores, QUEM_IMPORTA_A_PASTA_DA_ONCA, PASTA_DA_ONCA), 'a onça só entra na tela pelo `AvatarAgente` (e ele só pela `AssinaturaIA`) ou pelas peças do corpo inteiro').toEqual([])
  })

  it('o `AvatarAgente` só é importado pela `AssinaturaIA` e pela `MensagemIA`', () => {
    const importadores = importadoresDe(arquivosDaWeb(), AVATAR)
    expect(importadores, 'a `AssinaturaIA` desenha o avatar: a varredura não a achou').toContain('componentes/ui/ia/AssinaturaIA.tsx')
    expect(foraDaLista(importadores, QUEM_IMPORTA_O_AVATAR), 'avatar sem o nome da função e o selo "IA": use a `AssinaturaIA`').toEqual([])
  })

  it('as telas e a galeria que mostram a onça usam a `AssinaturaIA`, e nenhuma importa o avatar nem a pasta da onça', () => {
    const arquivos = arquivosDaWeb()
    const daAssinatura = importadoresDe(arquivos, ASSINATURA)
    for (const tela of ['areas/coordenacao/governanca/Agentes.tsx', 'areas/coordenacao/governanca/Analista.tsx', 'galeria/secoes/marca-onca.tsx']) expect(daAssinatura, tela).toContain(tela)
    const doAvatarOuDaOnca = [...importadoresDe(arquivos, AVATAR), ...importadoresDe(arquivos, PASTA_DA_ONCA)]
    // Fora de `areas/`, da galeria e da operação, só a `CascaPublica` desenha a onça da marca; a galeria só a mostraria com parecer. As únicas exceções em `areas/` são a introdução de cada papel e as telas da lista fechada, que desenham o corpo inteiro; a galeria e a operação, nenhuma.
    expect(doAvatarOuDaOnca.filter((nome) => (nome.startsWith('areas/') && !BEM_VINDO_DOS_PAPEIS.includes(nome) && !TELAS_COM_A_ONCA.includes(nome)) || nome.startsWith('galeria/') || nome.startsWith('operacao/'))).toEqual([])
  })
})

describe('a onça de corpo inteiro e a comemoração', () => {
  it('só a `Introducao`, a `Comemoracao`, a introdução de cada papel e o vazio de Criados importam a `Onca`; a entrada e a casca não', () => {
    const arquivos = arquivosDaWeb()
    const importadores = importadoresDe(arquivos, ONCA_INTEIRA)
    expect(importadores, 'a `Introducao` desenha a onça: a varredura não a achou').toContain('componentes/introducao/Introducao.tsx')
    expect(importadores, 'a `Comemoracao` desenha a onça: a varredura não a achou').toContain('componentes/ui/Comemoracao.tsx')
    for (const tela of TELAS_COM_A_ONCA) expect(importadores, `${tela} desenha a onça: a varredura não a achou`).toContain(tela)
    expect(foraDaLista(importadores, QUEM_IMPORTA_A_ONCA_INTEIRA)).toEqual([])
    // A entrada baixa a casca e a página de entrada: nenhuma delas leva a onça nem as peças da introdução para o primeiro carregamento.
    for (const entrada of ['componentes/CascaDaEscola.tsx', 'componentes/CascaPublica.tsx', 'paginas/Inicio.tsx', 'main.tsx']) {
      const conteudo = arquivos.find(({ nome }) => nome === entrada)?.conteudo
      // Arquivo da entrada que mudou de nome faria o laço passar vazio: aqui ele reprova.
      expect(conteudo, `${entrada} mudou de nome: atualize a lista da entrada`).toBeDefined()
      if (conteudo === undefined) continue
      // A `CascaPublica` é a única que toca a pasta, e só pela onça da marca e pelo cenário dela, por `import()`: o import estático reprova.
      const daPasta = importadoresDe([{ nome: entrada, conteudo }], PASTA_DA_ONCA)
      if (QUEM_IMPORTA_A_ONCA_DA_MARCA.includes(entrada)) {
        expect(daPasta, `${entrada} desenha a onça da marca: a varredura não a achou`).toEqual([entrada])
        expect(importacoesEstaticasDaPasta(conteudo), `${entrada}: a onça da marca vem por \`import()\` tardio, e não por import estático`).toEqual([])
        expect(importacoesTardiasDaPasta(conteudo), entrada).toEqual(['./ui/onca/OncaDaMarca', './ui/onca/CenaDaOnca'])
      } else {
        expect(daPasta, entrada).toEqual([])
      }
      expect(importadoresDe([{ nome: entrada, conteudo }], PECAS_DA_INTRODUCAO), entrada).toEqual([])
      // Nenhuma delas importa a onça assinada, nem o desenho cru: o desenho sem figura é de quem o põe numa figura.
      expect(importadoresDe([{ nome: entrada, conteudo }], ONCA_INTEIRA), entrada).toEqual([])
      expect(importadoresDe([{ nome: entrada, conteudo }], DESENHO_DA_ONCA), entrada).toEqual([])
    }
  })

  it('a onça da marca só é importada pela `CascaPublica`, e o desenho cru só pela `Onca` e por ela', () => {
    const arquivos = arquivosDaWeb()
    const daMarca = importadoresDe(arquivos, ONCA_DA_MARCA)
    expect(daMarca, 'a `CascaPublica` desenha a onça da marca: a varredura não a achou').toContain('componentes/CascaPublica.tsx')
    expect(foraDaLista(daMarca, QUEM_IMPORTA_A_ONCA_DA_MARCA), 'a onça sem assinatura só entra onde a lista fechada diz, com parecer').toEqual([])
    // Nem a galeria, nem a operação, nem `areas/`: a onça sem nome não vira avatar de agente.
    expect(daMarca.filter((nome) => nome.startsWith('areas/') || nome.startsWith('galeria/') || nome.startsWith('operacao/'))).toEqual([])
    // O desenho sem figura: só as duas peças que o põem numa figura, a assinada e a da marca.
    const doDesenho = importadoresDe(arquivos, DESENHO_DA_ONCA)
    expect(doDesenho.sort()).toEqual(['componentes/ui/onca/Onca.tsx', 'componentes/ui/onca/OncaDaMarca.tsx'])
  })

  it('o cenário da onça só é importado pela `CascaPublica`, e a `OncaDaMarca` só por ela e pelo cenário', () => {
    const arquivos = arquivosDaWeb()
    const doCenario = importadoresDe(arquivos, CENA_DA_ONCA)
    expect(doCenario, 'a `CascaPublica` desenha o cenário: a varredura não a achou').toEqual(QUEM_IMPORTA_A_CENA_DA_ONCA)
    const daMarca = importadoresDe(arquivos, ONCA_DA_MARCA)
    expect(daMarca, 'o cenário desenha a onça da marca: a varredura não o achou').toContain('componentes/ui/onca/CenaDaOnca.tsx')
    expect(daMarca.sort()).toEqual([...QUEM_IMPORTA_A_ONCA_DA_MARCA].sort())
    // O cenário vem por `import()`, nunca estático, e o que ele importa é a onça da marca, e não a assinada nem o desenho cru.
    const cenario = arquivos.find(({ nome }) => nome === 'componentes/ui/onca/CenaDaOnca.tsx')?.conteudo ?? ''
    expect(importadoresDe([{ nome: 'componentes/ui/onca/CenaDaOnca.tsx', conteudo: cenario }], ONCA_DA_MARCA)).toEqual(['componentes/ui/onca/CenaDaOnca.tsx'])
    expect(importadoresDe([{ nome: 'componentes/ui/onca/CenaDaOnca.tsx', conteudo: cenario }], ONCA_INTEIRA)).toEqual([])
    expect(importadoresDe([{ nome: 'componentes/ui/onca/CenaDaOnca.tsx', conteudo: cenario }], DESENHO_DA_ONCA)).toEqual([])
    // Nem a galeria, nem a operação, nem `areas/`.
    expect(doCenario.filter((nome) => nome.startsWith('areas/') || nome.startsWith('galeria/') || nome.startsWith('operacao/'))).toEqual([])
  })

  it('a pose `comemorando` só é escrita pelo `DesenhoDaOnca` (que a `Onca` e a `OncaDaMarca` usam) e pela `Comemoracao`', () => {
    const queEscrevem = arquivosDaWeb()
      .filter(({ conteudo }) => /\bcomemorando\b/.test(semComentarios(conteudo)))
      .map(({ nome }) => nome)
    // A `OncaDaMarca` não a escreve: a pose dela é `acenando`, fixa.
    expect(queEscrevem).toEqual(['componentes/ui/Comemoracao.tsx', 'componentes/ui/onca/DesenhoDaOnca.tsx'])
  })

  it('a `Comemoracao` só é importada pela tarefa aberta (e pela galeria, que a mostra)', () => {
    const importadores = importadoresDe(arquivosDaWeb(), COMEMORACAO)
    expect(importadores, 'a galeria mostra a comemoração: a varredura não a achou').toContain('galeria/secoes/introducao.tsx')
    expect(foraDaLista(importadores, QUEM_IMPORTA_A_COMEMORACAO)).toEqual([])
  })

  it('as peças da introdução só chegam pela galeria e pela introdução de cada papel', () => {
    const importadores = importadoresDe(arquivosDaWeb(), PECAS_DA_INTRODUCAO).filter((nome) => !nome.startsWith(PECAS_DA_INTRODUCAO))
    expect(importadores, 'a galeria mostra a introdução: a varredura não a achou').toContain('galeria/secoes/introducao.tsx')
    expect(foraDaLista(importadores, QUEM_IMPORTA_AS_PECAS_DA_INTRODUCAO)).toEqual([])
  })
})

describe('o atributo do avatar', () => {
  it('`data-agente` é só do avatar: nenhum outro arquivo o escreve, e o cartão do agente usa o dele', () => {
    const arquivos = arquivosDaWeb()
    const queEscrevem = arquivos.filter(({ conteudo }) => /\bdata-agente\b/.test(semComentarios(conteudo))).map(({ nome }) => nome)
    expect(queEscrevem, 'o teste confere cada `data-agente` pelo bloco dele: o cartão da tela não pode levá-lo').toEqual(['componentes/ui/ia/AvatarAgente.tsx'])
    expect(arquivos.find(({ nome }) => nome === 'areas/coordenacao/governanca/Agentes.tsx')?.conteudo).toMatch(/data-cartao-do-agente=/)
  })
})

describe('como o importador é reconhecido', () => {
  const arquivo = (nome: string, conteudo: string): ArquivoDaWeb => ({ nome, conteudo })
  const AMOSTRA = [
    arquivo('componentes/ui/ia/AvatarAgente.tsx', "import { CabecaOnca } from '../onca/CabecaOnca'"),
    arquivo('componentes/ui/onca/OncaInteira.tsx', "import { CabecaOnca } from './CabecaOnca'"),
    arquivo('componentes/ui/ia/AssinaturaIA.tsx', "import { AvatarAgente, type TamanhoDoAvatar } from './AvatarAgente'"),
    arquivo('areas/professor/Painel.tsx', "import { AvatarAgente } from '../../componentes/ui/ia/AvatarAgente'"),
    arquivo('areas/aluno/Saudacao.tsx', "import { CabecaOnca } from '../../componentes/ui/onca/CabecaOnca'"),
    arquivo('galeria/secoes/solta.tsx', "import type { TamanhoDoAvatar } from '../../componentes/ui/ia/AvatarAgente'"),
    arquivo('areas/aluno/Tardia.tsx', "const Peca = lazy(() => import('../../componentes/ui/ia/AvatarAgente'))"),
    arquivo('areas/aluno/Reexporta.tsx', "export { AvatarAgente } from '../../componentes/ui/ia/AvatarAgente'"),
    arquivo('areas/aluno/PorIndice.tsx', "import { Qualquer } from '../../componentes/ui/onca'"),
    arquivo('areas/aluno/Comentada.tsx', "// import { AvatarAgente } from '../../componentes/ui/ia/AvatarAgente'\n/* import { CabecaOnca } from '../../componentes/ui/onca/CabecaOnca' */\nexport const x = 1"),
    arquivo('areas/aluno/Vizinha.tsx', "import { AvatarDoAluno } from '../../componentes/ui/ia/AvatarAgenteDoAluno'\nimport { Outra } from '../../componentes/oncas/Outra'"),
    arquivo('areas/aluno/ComExtensao.tsx', "import { AvatarAgente } from '../../componentes/ui/ia/AvatarAgente.tsx'"),
    arquivo('areas/aluno/Pasta.tsx', "import { AvatarAgente } from '../../componentes/ui/ia/AvatarAgente/index'"),
    arquivo('areas/aluno/Pacote.tsx', "import { useQuery } from '@tanstack/react-query'\nimport { x } from 'react'"),
    arquivo('areas/aluno/OncaSolta.tsx', "import { Onca } from '../../componentes/ui/onca/Onca'"),
    arquivo('areas/aluno/OncaReexportada.tsx', "export { Onca } from '../../componentes/ui/onca/Onca'"),
    arquivo('areas/aluno/OncaTardia.tsx', "const Peca = lazy(() => import('../../componentes/ui/onca/Onca'))"),
    arquivo('areas/aluno/PoseSolta.tsx', "import { Comemoracao } from '../../componentes/ui/Comemoracao'"),
    arquivo('areas/aluno/PecasSoltas.tsx', "import { Introducao } from '../../componentes/introducao/Introducao'"),
  ]

  it('acha o import estático, o de tipo, o dinâmico e a reexportação, e a pasta pelo arquivo e pelo `index`', () => {
    expect(importadoresDe(AMOSTRA, AVATAR)).toEqual([
      'componentes/ui/ia/AssinaturaIA.tsx',
      'areas/professor/Painel.tsx',
      'galeria/secoes/solta.tsx',
      'areas/aluno/Tardia.tsx',
      'areas/aluno/Reexporta.tsx',
      'areas/aluno/ComExtensao.tsx',
      'areas/aluno/Pasta.tsx',
    ])
    expect(importadoresDe(AMOSTRA, PASTA_DA_ONCA)).toEqual([
      'componentes/ui/ia/AvatarAgente.tsx',
      'componentes/ui/onca/OncaInteira.tsx',
      'areas/aluno/Saudacao.tsx',
      'areas/aluno/PorIndice.tsx',
      'areas/aluno/OncaSolta.tsx',
      'areas/aluno/OncaReexportada.tsx',
      'areas/aluno/OncaTardia.tsx',
    ])
  })

  it('a amostra com outro importador reprova, e a lista de quem pode não a deixa passar', () => {
    expect(foraDaLista(importadoresDe(AMOSTRA, AVATAR), QUEM_IMPORTA_O_AVATAR)).toEqual([
      'areas/professor/Painel.tsx',
      'galeria/secoes/solta.tsx',
      'areas/aluno/Tardia.tsx',
      'areas/aluno/Reexporta.tsx',
      'areas/aluno/ComExtensao.tsx',
      'areas/aluno/Pasta.tsx',
    ])
    expect(foraDaLista(importadoresDe(AMOSTRA, PASTA_DA_ONCA), QUEM_IMPORTA_A_PASTA_DA_ONCA, PASTA_DA_ONCA)).toEqual([
      'areas/aluno/Saudacao.tsx',
      'areas/aluno/PorIndice.tsx',
      'areas/aluno/OncaSolta.tsx',
      'areas/aluno/OncaReexportada.tsx',
      'areas/aluno/OncaTardia.tsx',
    ])
    // O corpo inteiro, pelo arquivo: o import, a reexportação e o `import()` contam.
    expect(foraDaLista(importadoresDe(AMOSTRA, ONCA_INTEIRA), QUEM_IMPORTA_A_ONCA_INTEIRA)).toEqual(['areas/aluno/OncaSolta.tsx', 'areas/aluno/OncaReexportada.tsx', 'areas/aluno/OncaTardia.tsx'])
    expect(foraDaLista(importadoresDe(AMOSTRA, COMEMORACAO), QUEM_IMPORTA_A_COMEMORACAO)).toEqual(['areas/aluno/PoseSolta.tsx'])
    expect(foraDaLista(importadoresDe(AMOSTRA, PECAS_DA_INTRODUCAO), QUEM_IMPORTA_AS_PECAS_DA_INTRODUCAO)).toEqual(['areas/aluno/PecasSoltas.tsx'])
  })

  it('não confunde comentário, nome parecido nem pacote com o import', () => {
    const importadores = [...importadoresDe(AMOSTRA, AVATAR), ...importadoresDe(AMOSTRA, PASTA_DA_ONCA)]
    for (const sem of ['areas/aluno/Comentada.tsx', 'areas/aluno/Vizinha.tsx', 'areas/aluno/Pacote.tsx']) expect(importadores, sem).not.toContain(sem)
    // O `//` de um endereço não come o resto da linha: o import depois dele continua sendo lido.
    expect(especificadoresDe("const u = 'https://exemplo.test'; import { A } from './A'")).toEqual(['./A'])
  })

  it('separa o import estático do tardio na pasta da onça: o estático reprova a casca, o `import()` não', () => {
    const tardio = "const Onca = lazy(() => import('./ui/onca/OncaDaMarca').then((m) => ({ default: m.OncaDaMarca })))"
    expect(importacoesTardiasDaPasta(tardio)).toEqual(['./ui/onca/OncaDaMarca'])
    expect(importacoesEstaticasDaPasta(tardio)).toEqual([])
    for (const estatico of ["import { OncaDaMarca } from './ui/onca/OncaDaMarca'", "import type { Pose } from './ui/onca/Onca'", "export { Onca } from './ui/onca/Onca'", "import './ui/onca/Onca.css'"]) {
      expect(importacoesEstaticasDaPasta(estatico), estatico).toHaveLength(1)
      expect(importacoesTardiasDaPasta(estatico), estatico).toEqual([])
    }
    // Outra pasta e comentário não contam; o `import()` de uma peça que não é da onça também não.
    expect(importacoesEstaticasDaPasta("import { Marca } from './ui/Marca'\n// import { Onca } from './ui/onca/Onca'")).toEqual([])
    expect(importacoesTardiasDaPasta("const x = () => import('./ui/Marca')")).toEqual([])
  })
})
