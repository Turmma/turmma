import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { webSourceFiles } from '../../../__fixtures__/danger-solid'
import { importSpecifiers, importersOf, stripComments, type WebFile } from '../../../__fixtures__/importers'

/**
 * A cadeia fechada da onça (RF10 da X1; `docs/interface.md` 9.7; regra 70, item 4a): o avatar **só existe com o nome da
 * função e o selo "IA" no mesmo bloco**, e isso é garantido por quem pode desenhá-lo, e não por combinado. A pasta
 * `components/ui/onca/` — a cabeça, e a onça de corpo inteiro — só é importada pelo `AgentAvatar`, por arquivo da
 * própria pasta e, desde a tarefa 5.0 da X4, pelas peças que desenham o corpo inteiro: a `Introducao`, a `Comemoracao` e a
 * introdução de cada papel (`BemVindo`). A `Onca` traz junto o nome da função e o selo "IA" (`figcaption`), e a pose
 * `comemorando` só a `Comemoracao` pede. Desde a correção `2026-10-28-onca-do-mockup-v3` uma tela que já existia a desenha também, o vazio de
 * Criados (`TELAS_COM_A_ONCA`), assinada pelo Assistente de ensino. O `AgentAvatar`, só a `AgentSignature` e a `AIMessage`. Tela, galeria e peça
 * nova que queiram o **avatar** passam pela `AgentSignature`, que traz junto o nome e o selo; a **onça de corpo inteiro** só entra numa tela da
 * lista fechada, com parecer, e só onde a região guarda produção do agente que assina.
 */
const RAIZ_DA_WEB = join(import.meta.dirname, '..', '..', '..')

const PASTA_DA_ONCA = 'components/ui/onca/'
const AVATAR = 'components/ui/ai/AgentAvatar'
const ASSINATURA = 'components/ui/ai/AgentSignature'
const ONCA_INTEIRA = 'components/ui/onca/Onca'
const COMEMORACAO = 'components/ui/Comemoracao'
const PECAS_DA_INTRODUCAO = 'components/introducao/'
/** As introduções de cada papel (9.0, 10.0 e 11.0): ainda podem não existir, e a lista é de quem **pode**. */
const BEM_VINDO_DOS_PAPEIS = ['areas/aluno/introducao/BemVindo.tsx', 'areas/professor/introducao/BemVindo.tsx', 'areas/coordenacao/introducao/BemVindo.tsx']
/** A `IntroducaoDoPapel` é a peça comum dos quatro estados das introduções (11.0): ela desenha a onça do carregando, e a `BemVindo` de cada papel só passa os passos. */
/**
 * As telas que já existiam e que ganharam a onça do mockup, uma lista fechada (D73: só em tela que existe; D80, item 3: com parecer do
 * `conformidade-reviewer`). Hoje é uma: o vazio "Nada gerado ainda" de Criados, assinado pelo Assistente de ensino, que é quem gera o que
 * a lista guarda. Tela nova que queira a onça entra aqui, com parecer.
 */
const TELAS_COM_A_ONCA = ['areas/professor/artefatos/Criados.tsx']
const QUEM_IMPORTA_A_ONCA_INTEIRA = ['components/introducao/Introducao.tsx', 'components/introducao/IntroducaoDoPapel.tsx', 'components/ui/Comemoracao.tsx', ...BEM_VINDO_DOS_PAPEIS, ...TELAS_COM_A_ONCA]
const QUEM_IMPORTA_A_PASTA_DA_ONCA = ['components/ui/ai/AgentAvatar.tsx', ...QUEM_IMPORTA_A_ONCA_INTEIRA]
/** A `Comemoracao` é da tarefa aberta; a galeria é o palco dela até lá (o e2e de movimento precisa de uma página). */
const QUEM_IMPORTA_A_COMEMORACAO = ['areas/aluno/Atividade.tsx', 'gallery/sections/introducao.tsx']
/** As peças da introdução: a galeria as mostra, e a introdução de cada papel as usa. Nenhum arquivo da entrada. */
const QUEM_IMPORTA_AS_PECAS_DA_INTRODUCAO = ['gallery/sections/introducao.tsx', ...BEM_VINDO_DOS_PAPEIS]
const QUEM_IMPORTA_O_AVATAR = ['components/ui/ai/AgentSignature.tsx', 'components/ui/ai/Message.tsx']

function arquivosDaWeb(): WebFile[] {
  return webSourceFiles(RAIZ_DA_WEB).map((nome) => ({ nome, conteudo: readFileSync(join(RAIZ_DA_WEB, nome), 'utf8') }))
}

/** Quem importa `alvo` e não está na lista de quem pode: o que o teste reprova. */
function foraDaLista(importadores: readonly string[], permitidos: readonly string[], pasta = ''): string[] {
  return importadores.filter((nome) => !permitidos.includes(nome) && !(pasta !== '' && nome.startsWith(pasta)))
}

describe('a onça só chega à tela pela assinatura', () => {
  it('`componentes/ui/onca/` só é importado pelo `AvatarAgente`, por arquivo da própria pasta e pelas peças do corpo inteiro', () => {
    const importadores = importersOf(arquivosDaWeb(), PASTA_DA_ONCA)
    // Sem isto o caso passaria vazio no dia em que a varredura deixasse de achar o import.
    expect(importadores, 'o `AgentAvatar` desenha a cabeça: a varredura não o achou').toContain('components/ui/ai/AgentAvatar.tsx')
    expect(foraDaLista(importadores, QUEM_IMPORTA_A_PASTA_DA_ONCA, PASTA_DA_ONCA), 'a onça só entra na tela pelo `AgentAvatar` (e ele só pela `AgentSignature`) ou pelas peças do corpo inteiro').toEqual([])
  })

  it('o `AvatarAgente` só é importado pela `AssinaturaIA` e pela `MensagemIA`', () => {
    const importadores = importersOf(arquivosDaWeb(), AVATAR)
    expect(importadores, 'a `AgentSignature` desenha o avatar: a varredura não a achou').toContain('components/ui/ai/AgentSignature.tsx')
    expect(foraDaLista(importadores, QUEM_IMPORTA_O_AVATAR), 'avatar sem o nome da função e o selo "IA": use a `AgentSignature`').toEqual([])
  })

  it('as telas e a galeria que mostram a onça usam a `AssinaturaIA`, e nenhuma importa o avatar nem a pasta da onça', () => {
    const arquivos = arquivosDaWeb()
    const daAssinatura = importersOf(arquivos, ASSINATURA)
    for (const tela of ['areas/coordenacao/governanca/Agentes.tsx', 'areas/coordenacao/governanca/Analista.tsx', 'gallery/sections/marca-onca.tsx']) expect(daAssinatura, tela).toContain(tela)
    const doAvatarOuDaOnca = [...importersOf(arquivos, AVATAR), ...importersOf(arquivos, PASTA_DA_ONCA)]
    // As únicas exceções em `areas/` são a introdução de cada papel e as telas da lista fechada, que desenham o corpo inteiro; a galeria e a operação, nenhuma.
    expect(doAvatarOuDaOnca.filter((nome) => (nome.startsWith('areas/') && !BEM_VINDO_DOS_PAPEIS.includes(nome) && !TELAS_COM_A_ONCA.includes(nome)) || nome.startsWith('gallery/') || nome.startsWith('operacao/'))).toEqual([])
  })
})

describe('a onça de corpo inteiro e a comemoração', () => {
  it('só a `Introducao`, a `Comemoracao`, a introdução de cada papel e o vazio de Criados importam a `Onca`; a entrada e a casca não', () => {
    const arquivos = arquivosDaWeb()
    const importadores = importersOf(arquivos, ONCA_INTEIRA)
    expect(importadores, 'a `Introducao` desenha a onça: a varredura não a achou').toContain('components/introducao/Introducao.tsx')
    expect(importadores, 'a `Comemoracao` desenha a onça: a varredura não a achou').toContain('components/ui/Comemoracao.tsx')
    for (const tela of TELAS_COM_A_ONCA) expect(importadores, `${tela} desenha a onça: a varredura não a achou`).toContain(tela)
    expect(foraDaLista(importadores, QUEM_IMPORTA_A_ONCA_INTEIRA)).toEqual([])
    // A entrada baixa a casca e a página de entrada: nenhuma delas leva a onça nem as peças da introdução para o primeiro carregamento.
    for (const entrada of ['components/CascaDaEscola.tsx', 'components/CascaPublica.tsx', 'pages/Inicio.tsx', 'main.tsx']) {
      const conteudo = arquivos.find(({ nome }) => nome === entrada)?.conteudo
      // Arquivo da entrada que mudou de nome faria o laço passar vazio: aqui ele reprova.
      expect(conteudo, `${entrada} mudou de nome: atualize a lista da entrada`).toBeDefined()
      if (conteudo === undefined) continue
      expect(importersOf([{ nome: entrada, conteudo }], PASTA_DA_ONCA), entrada).toEqual([])
      expect(importersOf([{ nome: entrada, conteudo }], PECAS_DA_INTRODUCAO), entrada).toEqual([])
    }
  })

  it('a pose `comemorando` só é escrita pela `Onca` e pela `Comemoracao`', () => {
    const queEscrevem = arquivosDaWeb()
      .filter(({ conteudo }) => /\bcomemorando\b/.test(stripComments(conteudo)))
      .map(({ nome }) => nome)
    expect(queEscrevem).toEqual(['components/ui/Comemoracao.tsx', 'components/ui/onca/Onca.tsx'])
  })

  it('a `Comemoracao` só é importada pela tarefa aberta (e pela galeria, que a mostra)', () => {
    const importadores = importersOf(arquivosDaWeb(), COMEMORACAO)
    expect(importadores, 'a galeria mostra a comemoração: a varredura não a achou').toContain('gallery/sections/introducao.tsx')
    expect(foraDaLista(importadores, QUEM_IMPORTA_A_COMEMORACAO)).toEqual([])
  })

  it('as peças da introdução só chegam pela galeria e pela introdução de cada papel', () => {
    const importadores = importersOf(arquivosDaWeb(), PECAS_DA_INTRODUCAO).filter((nome) => !nome.startsWith(PECAS_DA_INTRODUCAO))
    expect(importadores, 'a galeria mostra a introdução: a varredura não a achou').toContain('gallery/sections/introducao.tsx')
    expect(foraDaLista(importadores, QUEM_IMPORTA_AS_PECAS_DA_INTRODUCAO)).toEqual([])
  })
})

describe('o atributo do avatar', () => {
  it('`data-agente` é só do avatar: nenhum outro arquivo o escreve, e o cartão do agente usa o dele', () => {
    const arquivos = arquivosDaWeb()
    const queEscrevem = arquivos.filter(({ conteudo }) => /\bdata-agente\b/.test(stripComments(conteudo))).map(({ nome }) => nome)
    expect(queEscrevem, 'o teste confere cada `data-agente` pelo bloco dele: o cartão da tela não pode levá-lo').toEqual(['components/ui/ai/AgentAvatar.tsx'])
    expect(arquivos.find(({ nome }) => nome === 'areas/coordenacao/governanca/Agentes.tsx')?.conteudo).toMatch(/data-cartao-do-agente=/)
  })
})

describe('como o importador é reconhecido', () => {
  const arquivo = (nome: string, conteudo: string): WebFile => ({ nome, conteudo })
  const AMOSTRA = [
    arquivo('components/ui/ai/AgentAvatar.tsx', "import { CabecaOnca } from '../onca/CabecaOnca'"),
    arquivo('components/ui/onca/OncaInteira.tsx', "import { CabecaOnca } from './CabecaOnca'"),
    arquivo('components/ui/ai/AgentSignature.tsx', "import { AgentAvatar, type TamanhoDoAvatar } from './AgentAvatar'"),
    arquivo('areas/professor/Painel.tsx', "import { AgentAvatar } from '../../components/ui/ai/AgentAvatar'"),
    arquivo('areas/aluno/Saudacao.tsx', "import { CabecaOnca } from '../../components/ui/onca/CabecaOnca'"),
    arquivo('gallery/sections/solta.tsx', "import type { TamanhoDoAvatar } from '../../components/ui/ai/AgentAvatar'"),
    arquivo('areas/aluno/Tardia.tsx', "const Peca = lazy(() => import('../../components/ui/ai/AgentAvatar'))"),
    arquivo('areas/aluno/Reexporta.tsx', "export { AgentAvatar } from '../../components/ui/ai/AgentAvatar'"),
    arquivo('areas/aluno/PorIndice.tsx', "import { Qualquer } from '../../components/ui/onca'"),
    arquivo('areas/aluno/Comentada.tsx', "// import { AgentAvatar } from '../../components/ui/ai/AgentAvatar'\n/* import { CabecaOnca } from '../../components/ui/onca/CabecaOnca' */\nexport const x = 1"),
    arquivo('areas/aluno/Vizinha.tsx', "import { AvatarDoAluno } from '../../components/ui/ai/AgentAvatarDoAluno'\nimport { Outra } from '../../components/oncas/Outra'"),
    arquivo('areas/aluno/ComExtensao.tsx', "import { AgentAvatar } from '../../components/ui/ai/AgentAvatar.tsx'"),
    arquivo('areas/aluno/Pasta.tsx', "import { AgentAvatar } from '../../components/ui/ai/AgentAvatar/index'"),
    arquivo('areas/aluno/Pacote.tsx', "import { useQuery } from '@tanstack/react-query'\nimport { x } from 'react'"),
    arquivo('areas/aluno/OncaSolta.tsx', "import { Onca } from '../../components/ui/onca/Onca'"),
    arquivo('areas/aluno/OncaReexportada.tsx', "export { Onca } from '../../components/ui/onca/Onca'"),
    arquivo('areas/aluno/OncaTardia.tsx', "const Peca = lazy(() => import('../../components/ui/onca/Onca'))"),
    arquivo('areas/aluno/PoseSolta.tsx', "import { Comemoracao } from '../../components/ui/Comemoracao'"),
    arquivo('areas/aluno/PecasSoltas.tsx', "import { Introducao } from '../../components/introducao/Introducao'"),
  ]

  it('acha o import estático, o de tipo, o dinâmico e a reexportação, e a pasta pelo arquivo e pelo `index`', () => {
    expect(importersOf(AMOSTRA, AVATAR)).toEqual([
      'components/ui/ai/AgentSignature.tsx',
      'areas/professor/Painel.tsx',
      'gallery/sections/solta.tsx',
      'areas/aluno/Tardia.tsx',
      'areas/aluno/Reexporta.tsx',
      'areas/aluno/ComExtensao.tsx',
      'areas/aluno/Pasta.tsx',
    ])
    expect(importersOf(AMOSTRA, PASTA_DA_ONCA)).toEqual([
      'components/ui/ai/AgentAvatar.tsx',
      'components/ui/onca/OncaInteira.tsx',
      'areas/aluno/Saudacao.tsx',
      'areas/aluno/PorIndice.tsx',
      'areas/aluno/OncaSolta.tsx',
      'areas/aluno/OncaReexportada.tsx',
      'areas/aluno/OncaTardia.tsx',
    ])
  })

  it('a amostra com outro importador reprova, e a lista de quem pode não a deixa passar', () => {
    expect(foraDaLista(importersOf(AMOSTRA, AVATAR), QUEM_IMPORTA_O_AVATAR)).toEqual([
      'areas/professor/Painel.tsx',
      'gallery/sections/solta.tsx',
      'areas/aluno/Tardia.tsx',
      'areas/aluno/Reexporta.tsx',
      'areas/aluno/ComExtensao.tsx',
      'areas/aluno/Pasta.tsx',
    ])
    expect(foraDaLista(importersOf(AMOSTRA, PASTA_DA_ONCA), QUEM_IMPORTA_A_PASTA_DA_ONCA, PASTA_DA_ONCA)).toEqual([
      'areas/aluno/Saudacao.tsx',
      'areas/aluno/PorIndice.tsx',
      'areas/aluno/OncaSolta.tsx',
      'areas/aluno/OncaReexportada.tsx',
      'areas/aluno/OncaTardia.tsx',
    ])
    // O corpo inteiro, pelo arquivo: o import, a reexportação e o `import()` contam.
    expect(foraDaLista(importersOf(AMOSTRA, ONCA_INTEIRA), QUEM_IMPORTA_A_ONCA_INTEIRA)).toEqual(['areas/aluno/OncaSolta.tsx', 'areas/aluno/OncaReexportada.tsx', 'areas/aluno/OncaTardia.tsx'])
    expect(foraDaLista(importersOf(AMOSTRA, COMEMORACAO), QUEM_IMPORTA_A_COMEMORACAO)).toEqual(['areas/aluno/PoseSolta.tsx'])
    expect(foraDaLista(importersOf(AMOSTRA, PECAS_DA_INTRODUCAO), QUEM_IMPORTA_AS_PECAS_DA_INTRODUCAO)).toEqual(['areas/aluno/PecasSoltas.tsx'])
  })

  it('não confunde comentário, nome parecido nem pacote com o import', () => {
    const importadores = [...importersOf(AMOSTRA, AVATAR), ...importersOf(AMOSTRA, PASTA_DA_ONCA)]
    for (const sem of ['areas/aluno/Comentada.tsx', 'areas/aluno/Vizinha.tsx', 'areas/aluno/Pacote.tsx']) expect(importadores, sem).not.toContain(sem)
    // O `//` de um endereço não come o resto da linha: o import depois dele continua sendo lido.
    expect(importSpecifiers("const u = 'https://exemplo.test'; import { A } from './A'")).toEqual(['./A'])
  })
})
