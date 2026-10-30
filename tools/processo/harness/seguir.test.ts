// O `/seguir` partido por passo, lido sob demanda, e as paradas que viram aviso (X7, RF22 e RF26).
//
// O Orquestrador lê, a cada tarefa, o `SKILL.md`, o `protocolo.md` e o `passos/6-tarefa.md`: eram 41 KB (33 do `SKILL.md`, com os dez
// passos juntos, e 8 do protocolo), e o limite agora é de 24.000 B. Os outros passos moram em `passos/` e se leem quando a situação
// pede, apontados por um índice no `SKILL.md`. O que esta conferência segura:
//
//  - o orçamento dos três, e a presença dos três (um que some deixaria a conta fechar sem nada);
//  - o `6-tarefa.md` ser autossuficiente: nada de mandar ler o passo 3, o 9 nem o `time.md`, e com o comando da limpeza, a
//    abertura de linha, o reinício do par (`recruit --replace`) e a saída `VERIFICAÇÃO RECUSADA`; citar o passo 7, o 8 e o 10 pode,
//    porque são os condicionais;
//  - o índice citar todo `passos/*.md` dizendo quando entrar, e não citar arquivo que não existe;
//  - o `SKILL.md` e cada passo abaixo de 500 linhas (RF22);
//  - nada sair sem destino: cada passo do `/seguir` original tem o seu arquivo, e as marcas de cada um estão no texto;
//  - o texto das paradas que viram aviso (D79, revista em 23/10/2026), o censo do e2e e os commits `Fora do processo:`.
//
// Cada checagem é uma função sobre o texto (`Arquivos`: caminho a partir de `.claude/` → conteúdo) e roda sobre o repositório e sobre
// uma amostra quebrada. Limites declarados: o teste prova que o texto está nos arquivos, não que o Orquestrador o segue; e a parte
// "sem o que repete o protocolo" do `6-tarefa.md` (17.2) não tem checagem própria: só o orçamento de bytes a segura, por baixo.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REVISORES_COM_VETO, REVISORES_SEM_VETO } from '../revisoes.ts'

const RAIZ = join(import.meta.dirname, '..', '..', '..')

/** Caminho a partir de `.claude/` → conteúdo. */
type Arquivos = Record<string, string>

const SEGUIR = 'skills/seguir/'
const SKILL = `${SEGUIR}SKILL.md`
const PROTOCOLO = `${SEGUIR}protocolo.md`
const TAREFA = `${SEGUIR}passos/6-tarefa.md`
const PASSOS = `${SEGUIR}passos/`
/** O que o Orquestrador lê por tarefa, e o teto dos três juntos (24 KB; o `/seguir` inteiro tinha 41 KB). */
const OS_TRES = [SKILL, PROTOCOLO, TAREFA]
const TETO_DOS_TRES = 24_000
const LIMITE_DE_LINHAS = 500
/** O que a conferência acha hoje: oito passos, e o índice com uma linha por passo. */
const MINIMO_DE_PASSOS = 8

/** O que o passo 6 não pode mandar ler: cada um é uma ida a outro arquivo no meio da tarefa. */
const PROIBIDOS_NO_PASSO_6 = [
  { nome: 'o passo 3', expressao: /\bpassos?\s+3\b/, amostra: 'o passo 3' },
  { nome: 'o passo 9', expressao: /\bpassos?\s+9\b/, amostra: 'o passo 9' },
  {
    nome: 'o arquivo do passo 3',
    expressao: /passos\/3-/,
    amostra: 'passos/3-time-e-andar.md',
  },
  {
    nome: 'o arquivo do passo 9',
    expressao: /passos\/9-/,
    amostra: 'passos/9-vigia-e-contexto.md',
  },
  { nome: 'o time.md', expressao: /time\.md/, amostra: 'o time.md' },
]
/** O que o passo 6 traz na própria página, com o texto exato que a conferência procura. */
const OBRIGATORIOS_NO_PASSO_6 = [
  {
    nome: 'o comando da limpeza',
    termo: 'maestri routine run "Limpa o Orquestrador"',
  },
  { nome: 'a abertura de linha', termo: 'linhas.ts abrir' },
  { nome: 'o reinício do par (recruit --replace)', termo: 'recruit --replace' },
  { nome: 'a saída VERIFICAÇÃO RECUSADA', termo: 'VERIFICAÇÃO RECUSADA' },
  { nome: 'o comando que solta a linha presa (RF6)', termo: 'linhas.ts abandonar' },
]
/** Os passos que podem ser citados pelo passo 6: são os condicionais. */
const CITAVEIS_NO_PASSO_6 = ['passo 7', 'passo 8', 'passo 10']

/** O texto que cada passo carrega do `/seguir` original: se uma marca some de todos os arquivos, algo saiu sem destino. */
const MARCAS_DOS_PASSOS: { arquivo: string; marca: string }[] = [
  { arquivo: 'SKILL.md', marca: 'Ler o estado' },
  { arquivo: 'SKILL.md', marca: 'As fases' },
  {
    arquivo: 'passos/3-time-e-andar.md',
    marca: 'maestri floor create "<id> <funcionalidade>" --branch spec/<funcionalidade>',
  },
  { arquivo: 'passos/3-time-e-andar.md', marca: 'Reiniciar a sessão' },
  {
    arquivo: 'passos/4-documentos.md',
    marca: 'Registra o estado de <funcionalidade> antes da validação',
  },
  { arquivo: 'passos/6-tarefa.md', marca: 'linhas.ts partida' },
  {
    arquivo: 'passos/7-paradas.md',
    marca: 'A parada segura só o que depende dela',
  },
  { arquivo: 'passos/8-validacao-e-pouso.md', marca: 'maestri floor land' },
  { arquivo: 'passos/9-vigia-e-contexto.md', marca: 'nohup setsid' },
  { arquivo: 'passos/10-avulsos.md', marca: 'Guardiões obrigatórios' },
  { arquivo: 'passos/estado-md.md', marca: '## Esperando o Joaquim' },
]

/** O texto das paradas que viram aviso, do censo e dos commits `Fora do processo:`, com o lugar de cada um. */
const REQUISITOS_DO_TEXTO = [
  {
    nome: 'o passo 7 diz que a ressalva menor é aviso',
    arquivo: `${PASSOS}7-paradas.md`,
    termo: 'A ressalva menor da validação',
  },
  {
    nome: 'o passo 6 diz que a resposta a um PEDIDO de estado não chega como mensagem',
    arquivo: `${PASSOS}6-tarefa.md`,
    termo: 'Não chega como mensagem: lê-se na saída do `maestri ask` ou no `maestri check`',
  },
  {
    nome: 'o passo 7 diz que a proposta que só muda skill, papel ou modelo é aviso',
    arquivo: `${PASSOS}7-paradas.md`,
    termo: 'só muda skill, papel ou modelo de documento',
  },
  {
    nome: 'o passo 7 mantém como parada a lista de um guardião com veto',
    arquivo: `${PASSOS}7-paradas.md`,
    termo: 'a lista de um guardião com',
  },
  {
    nome: 'o passo 7 mantém como parada as skills que decidem a marcação',
    arquivo: `${PASSOS}7-paradas.md`,
    termo: '`criar-tasks`, `revisar-tarefa` ou `revisar-spec`',
  },
  {
    nome: 'o passo 7 diz que achado das regras 10, 20 e 70 nunca é menor',
    arquivo: `${PASSOS}7-paradas.md`,
    termo: '(que nunca é menor)',
  },
  {
    nome: 'a retro tem o aviso da proposta de skill, papel ou modelo',
    arquivo: 'skills/retro/SKILL.md',
    termo: '**Aviso** é a proposta que muda **só** skill',
  },
  {
    nome: 'a retro espera 30 minutos antes de aplicar o aviso',
    arquivo: 'skills/retro/SKILL.md',
    termo: 'agora mais 30 minutos',
  },
  {
    nome: 'a retro mantém a confirmação para a lista de um guardião com veto',
    arquivo: 'skills/retro/SKILL.md',
    termo: 'a lista "O que verificar" de um guardião com veto',
  },
  {
    nome: 'a retro tira o grupo de confirmação do aviso',
    arquivo: 'skills/retro/SKILL.md',
    termo: 'salvo os da confirmação (abaixo)',
  },
  {
    nome: 'a retro mantém a confirmação para as skills que decidem a marcação',
    arquivo: 'skills/retro/SKILL.md',
    termo: '`criar-tasks`, `revisar-tarefa`, `revisar-spec`',
  },
  {
    nome: 'o validador diz que achado das regras 10, 20 e 70 nunca é menor',
    arquivo: 'agents/validador.md',
    termo: 'Achado das regras 10, 20 e 70 nunca é menor',
  },
  {
    nome: 'o validador lista os commits Fora do processo:',
    arquivo: 'agents/validador.md',
    termo: "--grep='^Fora do processo:'",
  },
  {
    nome: 'o validador tira o Fora do processo: do achado maior',
    arquivo: 'agents/validador.md',
    termo: 'salvo os de `Fora do processo:` (abaixo)',
  },
  {
    nome: 'o SKILL.md chama a fase de ressalvas de parada ou aviso',
    arquivo: SKILL,
    termo: 'parada ou aviso (passo 7)',
  },
  {
    nome: 'o passo 4 tem o commit do aceite pelo aviso da D79',
    arquivo: `${PASSOS}4-documentos.md`,
    termo: 'Registra o aceite das ressalvas menores de <funcionalidade>',
  },
  {
    nome: 'o passo 8 leva os menores ao TODO.md no fechamento',
    arquivo: `${PASSOS}8-validacao-e-pouso.md`,
    termo: 'os achados **menores** do `validacao.md` vão ao `TODO.md`',
  },
  {
    nome: 'o validar lista os commits Fora do processo:',
    arquivo: 'skills/validar/SKILL.md',
    termo: "--grep='^Fora do processo:'",
  },
  {
    nome: 'o validar manda o menor para o TODO.md',
    arquivo: 'skills/validar/SKILL.md',
    termo: 'o achado **menor** do relatório também',
  },
  {
    nome: 'o passo 8 diz quando rodar o censo do e2e',
    arquivo: `${PASSOS}8-validacao-e-pouso.md`,
    termo: 'node tools/processo/esteira.ts --censo',
  },
  {
    nome: 'o passo 8 leva o merge da develop ao nome novo com o reaplicar, enquanto existir a pasta dos mapas',
    arquivo: `${PASSOS}8-validacao-e-pouso.md`,
    termo: 'node tools/renomear/reaplicar.ts',
  },
  {
    nome: 'o passo 8 diz que o reaplicar vale enquanto existir tools/renomear/mapas/',
    arquivo: `${PASSOS}8-validacao-e-pouso.md`,
    termo: 'Enquanto existir `tools/renomear/mapas/`',
  },
  {
    nome: 'o passo 8 manda abrir correção quando a lista não é vazia',
    arquivo: `${PASSOS}8-validacao-e-pouso.md`,
    termo: 'abra uma correção (`corrigir`',
  },
]

const ler = (caminho: string): string | null => {
  try {
    return readFileSync(caminho, 'utf8')
  } catch {
    return null
  }
}

/** O termo como expressão: o espaço casa também a quebra de linha, que o texto das skills usa para ficar em 120 colunas. */
const padrao = (termo: string): RegExp => new RegExp(termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'g')
const contem = (texto: string, termo: string): boolean => padrao(termo).test(texto)
const tirar = (texto: string, termo: string): string => texto.replace(padrao(termo), 'x')

const bytes = (texto: string): number => Buffer.byteLength(texto, 'utf8')

const linhasDe = (texto: string): number => texto.split('\n').length - (texto.endsWith('\n') ? 1 : 0)

/** Os arquivos do `/seguir` e os de fora que o texto das paradas toca (`retro`, `validar`, `validador`), lidos de `raiz`. Pasta de passos ausente devolve só o resto. */
export function lerArquivos(raiz: string): Arquivos {
  const arquivos: Arquivos = {}
  const pegar = (caminho: string): void => {
    const texto = ler(join(raiz, '.claude', caminho))
    if (texto !== null) arquivos[caminho] = texto
  }
  for (const caminho of [SKILL, PROTOCOLO, `${SEGUIR}time.md`, 'skills/retro/SKILL.md', 'skills/validar/SKILL.md', 'agents/validador.md']) pegar(caminho)
  for (const nome of nomesDosPassos(raiz)) pegar(`${PASSOS}${nome}`)
  return arquivos
}

/** Os `.md` da pasta de passos, em ordem; pasta ausente devolve lista vazia. */
function nomesDosPassos(raiz: string): string[] {
  try {
    return readdirSync(join(raiz, '.claude', PASSOS))
      .filter((nome) => nome.endsWith('.md'))
      .sort()
  } catch {
    return []
  }
}

/** Os `passos/*.md` presentes, sem o prefixo (`6-tarefa.md`). */
const passosDe = (arquivos: Arquivos): string[] =>
  Object.keys(arquivos)
    .filter((caminho) => caminho.startsWith(PASSOS))
    .map((caminho) => caminho.slice(PASSOS.length))

/** O orçamento de leitura por tarefa: os três presentes e, juntos, até 24.000 B. */
export function orcamento(arquivos: Arquivos): string[] {
  const ausentes = OS_TRES.filter((caminho) => arquivos[caminho] === undefined)
  if (ausentes.length > 0) return ausentes.map((caminho) => `${caminho} ausente: o orçamento por tarefa não se mede sem ele`)
  const total = OS_TRES.reduce((soma, caminho) => soma + bytes(arquivos[caminho] ?? ''), 0)
  return total > TETO_DOS_TRES ? [`SKILL.md, protocolo.md e passos/6-tarefa.md somam ${total} B, acima de ${TETO_DOS_TRES} B`] : []
}

/** O passo 6 sem ida ao passo 3, ao 9 nem ao `time.md`, e com na própria página o que se usa em toda tarefa. */
export function passoDaTarefa(arquivos: Arquivos): string[] {
  const texto = arquivos[TAREFA]
  if (texto === undefined) return [`${TAREFA} ausente`]
  const manda = PROIBIDOS_NO_PASSO_6.filter(({ expressao }) => expressao.test(texto)).map(({ nome }) => `passos/6-tarefa.md manda ler ${nome}`)
  const falta = OBRIGATORIOS_NO_PASSO_6.filter(({ termo }) => !contem(texto, termo)).map(({ nome }) => `passos/6-tarefa.md não traz ${nome}`)
  return [...manda, ...falta]
}

/** O índice do `SKILL.md`: todo passo citado, com a condição de entrada, e nenhum citado que não exista. */
export function indice(arquivos: Arquivos): string[] {
  const texto = arquivos[SKILL]
  if (texto === undefined) return [`${SKILL} ausente`]
  const existentes = passosDe(arquivos)
  const citados = [...new Set([...texto.matchAll(/passos\/([\w.-]+\.md)/g)].map((achado) => achado[1] ?? ''))]
  const problemas: string[] = []
  for (const citado of citados) {
    if (!existentes.includes(citado)) problemas.push(`o índice do SKILL.md cita passos/${citado}, que não existe`)
  }
  for (const nome of existentes) {
    if (!citados.includes(nome)) problemas.push(`passos/${nome} não é citado pelo índice do SKILL.md`)
    else if (!dizQuando(texto, nome)) problemas.push(`o índice do SKILL.md cita passos/${nome} sem dizer quando entrar`)
  }
  return problemas
}

/** A linha da tabela do índice que cita o passo traz, na segunda célula, ao menos uma frase de quando entrar. */
function dizQuando(texto: string, nome: string): boolean {
  return texto.split('\n').some((linha) => linha.startsWith('|') && linha.includes(`passos/${nome}`) && (linha.split('|')[2] ?? '').trim().length >= 10)
}

/** O `SKILL.md` e cada passo abaixo de 500 linhas (RF22). */
export function tamanhoDasPaginas(arquivos: Arquivos): string[] {
  return Object.entries(arquivos)
    .filter(([caminho]) => caminho === SKILL || caminho.startsWith(PASSOS))
    .filter(([, texto]) => linhasDe(texto) >= LIMITE_DE_LINHAS)
    .map(([caminho, texto]) => `${caminho} tem ${linhasDe(texto)} linhas, e o limite é abaixo de ${LIMITE_DE_LINHAS}`)
}

/** Nada sai sem destino: o número do passo bate com o do arquivo, os dez passos existem, e as marcas de cada um estão no texto. */
export function destinos(arquivos: Arquivos): string[] {
  const { problemas, numeros } = titulosDosPassos(arquivos)
  for (let passo = 1; passo <= 10; passo += 1) {
    if (!numeros.has(passo)) problemas.push(`o passo ${passo} do /seguir não está em nenhum arquivo`)
  }
  for (const { arquivo, marca } of MARCAS_DOS_PASSOS) {
    const caminho = `${SEGUIR}${arquivo}`
    if (!contem(arquivos[caminho] ?? '', marca)) problemas.push(`${arquivo} perdeu "${marca}"`)
  }
  return problemas
}

/** Os números de passo que têm título (no `SKILL.md` e em cada arquivo de `passos/`), e o que está errado nos títulos. */
function titulosDosPassos(arquivos: Arquivos): {
  problemas: string[]
  numeros: Set<number>
} {
  const problemas: string[] = []
  const numeros = new Set<number>()
  for (const achado of (arquivos[SKILL] ?? '').matchAll(/^## (\d+)\. /gm)) numeros.add(Number(achado[1]))
  for (const nome of passosDe(arquivos)) {
    const titulo = (arquivos[`${PASSOS}${nome}`] ?? '').split('\n')[0] ?? ''
    const problema = problemaDoTitulo(nome, titulo)
    if (problema !== null) problemas.push(problema)
    else if (/^\d+-/.test(nome)) numeros.add(Number(/^(\d+)-/.exec(nome)?.[1]))
  }
  return { problemas, numeros }
}

/** O que há de errado no título de um arquivo de `passos/`: o de número começa pelo `## N. ` dele, o outro por qualquer `## `. */
function problemaDoTitulo(nome: string, titulo: string): string | null {
  const numero = /^(\d+)-/.exec(nome)?.[1]
  if (numero === undefined) return titulo.startsWith('## ') ? null : `passos/${nome} não começa por um título "## "`
  return titulo.startsWith(`## ${numero}. `) ? null : `passos/${nome} começa por "${titulo}", e o título deveria ser o do passo ${numero}`
}

/** Cada texto de aviso, do censo e do `Fora do processo:` está no arquivo que o diz. */
export function textoDasParadas(arquivos: Arquivos): string[] {
  return REQUISITOS_DO_TEXTO.filter(({ arquivo, termo }) => !contem(arquivos[arquivo] ?? '', termo)).map(({ nome }) => `falta no texto: ${nome}`)
}

/**
 * A lista de guardiões com veto que a `retro` manda confirmar é a do código (`REVISORES_COM_VETO`): nenhum a menos, e nenhum que não
 * tenha veto. Uma lista escrita à mão já saiu errada uma vez (`llm-integrator`, sem veto, no lugar do `infra-guardian`, com).
 */
export function revisoresDaRetro(
  arquivos: Arquivos,
  comVeto: readonly string[] = REVISORES_COM_VETO,
  semVeto: readonly string[] = REVISORES_SEM_VETO,
): string[] {
  const secao = /## 5\.[\s\S]*?(?=\n## 6\.)/.exec(arquivos['skills/retro/SKILL.md'] ?? '')?.[0]
  if (secao === undefined) return ['a retro não tem a seção 5, onde ficam os grupos de aviso e de confirmação']
  const faltam = comVeto.filter((nome) => !secao.includes(`\`${nome}\``)).map((nome) => `a retro não lista ${nome} entre os revisores com veto`)
  const sobram = semVeto.filter((nome) => secao.includes(`\`${nome}\``)).map((nome) => `a retro lista ${nome}, que não tem veto`)
  return [...faltam, ...sobram]
}

const todas = (arquivos: Arquivos): string[] => [
  ...orcamento(arquivos),
  ...passoDaTarefa(arquivos),
  ...indice(arquivos),
  ...tamanhoDasPaginas(arquivos),
  ...destinos(arquivos),
  ...textoDasParadas(arquivos),
  ...revisoresDaRetro(arquivos),
]

/** Uma cópia dos arquivos com um deles mudado; o texto precisa mudar, ou o caso não prova nada. */
function estragar(arquivos: Arquivos, caminho: string, mudar: (texto: string) => string): Arquivos {
  const antes = arquivos[caminho]
  expect(antes, `${caminho} precisa existir no repositório`).toBeDefined()
  const depois = mudar(antes ?? '')
  expect(depois, 'a amostra precisa mudar o arquivo, ou o caso não prova nada').not.toBe(antes)
  return { ...arquivos, [caminho]: depois }
}

const sem = (arquivos: Arquivos, caminho: string): Arquivos => Object.fromEntries(Object.entries(arquivos).filter(([nome]) => nome !== caminho))

const hoje = lerArquivos(RAIZ)

describe('o orçamento de leitura por tarefa (RF26)', () => {
  it('o repositório de hoje passa, com os três presentes e os passos contados', () => {
    expect(orcamento(hoje)).toEqual([])
    for (const caminho of OS_TRES) expect(bytes(hoje[caminho] ?? '')).toBeGreaterThan(1_000)
    expect(passosDe(hoje).length).toBeGreaterThanOrEqual(MINIMO_DE_PASSOS)
    const total = OS_TRES.reduce((soma, caminho) => soma + bytes(hoje[caminho] ?? ''), 0)
    expect(total).toBeLessThanOrEqual(TETO_DOS_TRES)
  })

  it('os três acima de 24.000 B: vermelho, e no limite exato ainda passa', () => {
    const sobra = TETO_DOS_TRES - bytes(hoje[PROTOCOLO] ?? '') - bytes(hoje[TAREFA] ?? '')
    const noLimite = estragar(hoje, SKILL, () => 'x'.repeat(sobra))
    expect(orcamento(noLimite)).toEqual([])
    const acima = estragar(hoje, SKILL, () => 'x'.repeat(sobra + 1))
    expect(orcamento(acima)).toEqual([`SKILL.md, protocolo.md e passos/6-tarefa.md somam ${TETO_DOS_TRES + 1} B, acima de ${TETO_DOS_TRES} B`])
  })

  it('a conta é de bytes, e o acento pesa dois', () => {
    const sobra = TETO_DOS_TRES - bytes(hoje[PROTOCOLO] ?? '') - bytes(hoje[TAREFA] ?? '')
    const acentuado = estragar(hoje, SKILL, () => 'ã'.repeat(Math.floor(sobra / 2) + 1))
    expect(orcamento(acentuado)).toHaveLength(1)
  })

  it.each(OS_TRES.map((caminho) => [caminho] as const))('um dos três ausente: vermelho, %s', (caminho) => {
    expect(orcamento(sem(hoje, caminho))).toEqual([`${caminho} ausente: o orçamento por tarefa não se mede sem ele`])
  })

  it('pasta de passos ausente: vermelho no orçamento, no índice e nos destinos', () => {
    const semPasso = Object.fromEntries(Object.entries(hoje).filter(([caminho]) => !caminho.startsWith(PASSOS)))
    expect(orcamento(semPasso)).toHaveLength(1)
    expect(passoDaTarefa(semPasso)).toEqual([`${TAREFA} ausente`])
    expect(destinos(semPasso).length).toBeGreaterThan(5)
  })
})

describe('o passo 6 se basta (RF26)', () => {
  it('o repositório de hoje passa, e cita os passos condicionais', () => {
    expect(passoDaTarefa(hoje)).toEqual([])
    for (const citado of ['passo 7', 'passo 10']) expect(hoje[TAREFA]).toContain(citado)
  })

  it.each(PROIBIDOS_NO_PASSO_6.map(({ nome, expressao, amostra }) => [nome, expressao, amostra] as const))(
    'mandar ler %s: vermelho',
    (nome, expressao, citado) => {
      const amostra = estragar(hoje, TAREFA, (texto) => `${texto}\nAntes de partir, leia ${citado}.\n`)
      expect(expressao.test(amostra[TAREFA] ?? '')).toBe(true)
      expect(passoDaTarefa(amostra)).toEqual([`passos/6-tarefa.md manda ler ${nome}`])
    },
  )

  it('o passo 3 quebrado em duas linhas para caber nas 120 colunas também é ida ao passo 3: vermelho', () => {
    const amostra = estragar(hoje, TAREFA, (texto) => `${texto}\nLeia o passo\n3 antes.\nLeia o passo\n9 depois.\n`)
    expect(passoDaTarefa(amostra)).toEqual(['passos/6-tarefa.md manda ler o passo 3', 'passos/6-tarefa.md manda ler o passo 9'])
  })

  it('os passos 3 e 4 no plural também são ida ao passo 3: vermelho', () => {
    const amostra = estragar(hoje, TAREFA, (texto) => `${texto}\nLeia os passos 3 e 4 antes.\n`)
    expect(passoDaTarefa(amostra)).toEqual(['passos/6-tarefa.md manda ler o passo 3'])
  })

  it.each(CITAVEIS_NO_PASSO_6.map((citado) => [citado] as const))('citar o %s passa', (citado) => {
    const amostra = estragar(hoje, TAREFA, (texto) => `${texto}\nVeja o ${citado}, se a situação pedir.\n`)
    expect(passoDaTarefa(amostra)).toEqual([])
  })

  it('o passo 30 e o passo 39 não são o passo 3 nem o 9', () => {
    const amostra = estragar(hoje, TAREFA, (texto) => `${texto}\nO passo 30 e o passo 39 não existem.\n`)
    expect(passoDaTarefa(amostra)).toEqual([])
  })

  it.each(OBRIGATORIOS_NO_PASSO_6.map(({ nome, termo }) => [nome, termo] as const))('sem %s: vermelho', (nome, termo) => {
    const amostra = estragar(hoje, TAREFA, (texto) => tirar(texto, termo))
    expect(passoDaTarefa(amostra)).toEqual([`passos/6-tarefa.md não traz ${nome}`])
  })

  it('a saída de código 5 pede a mesma correção que o CONFLITO, na própria linha', () => {
    const texto = hoje[TAREFA] ?? ''
    expect(texto).toMatch(/`CONFLITO` e `VERIFICAÇÃO RECUSADA` pedem a mesma coisa/)
    expect(texto).toContain('(código 5)')
  })
})

describe('o índice do SKILL.md (RF22 e RF26)', () => {
  it('o repositório de hoje passa: todo passo citado, com a condição de entrada', () => {
    expect(indice(hoje)).toEqual([])
    const citados = new Set([...(hoje[SKILL] ?? '').matchAll(/passos\/([\w.-]+\.md)/g)].map((achado) => achado[1]))
    expect(citados.size).toBeGreaterThanOrEqual(MINIMO_DE_PASSOS)
  })

  it.each(passosDe(hoje).map((nome) => [nome] as const))('o índice sem o passo %s: vermelho', (nome) => {
    const amostra = estragar(hoje, SKILL, (texto) =>
      texto
        .split('\n')
        .filter((linha) => !linha.includes(`passos/${nome}`))
        .join('\n'),
    )
    expect(indice(amostra)).toEqual([`passos/${nome} não é citado pelo índice do SKILL.md`])
  })

  it('um passo novo que o índice não cita: vermelho', () => {
    const amostra: Arquivos = {
      ...hoje,
      [`${PASSOS}11-novo.md`]: '## 11. Novo\n',
    }
    expect(indice(amostra)).toEqual(['passos/11-novo.md não é citado pelo índice do SKILL.md'])
  })

  it('um passo citado que não existe: vermelho', () => {
    const amostra = estragar(hoje, SKILL, (texto) => `${texto}\n| \`passos/12-fantasma.md\` | quando houver fantasma |\n`)
    expect(indice(amostra)).toEqual(['o índice do SKILL.md cita passos/12-fantasma.md, que não existe'])
  })

  it('o passo citado sem dizer quando entrar: vermelho', () => {
    const amostra = estragar(hoje, SKILL, (texto) => texto.replace(/^\| `passos\/7-paradas\.md` \|.*$/m, '| `passos/7-paradas.md` | |'))
    expect(indice(amostra)).toEqual(['o índice do SKILL.md cita passos/7-paradas.md sem dizer quando entrar'])
  })

  it('o passo citado fora da tabela, no meio do texto, não vale como índice', () => {
    const amostra = estragar(hoje, SKILL, (texto) =>
      texto.replace(/^\| `passos\/7-paradas\.md` \|.*$/m, 'Veja passos/7-paradas.md | quando quiser | sem tabela nenhuma.'),
    )
    expect(indice(amostra)).toEqual(['o índice do SKILL.md cita passos/7-paradas.md sem dizer quando entrar'])
  })

  it('SKILL.md ausente: vermelho', () => {
    expect(indice(sem(hoje, SKILL))).toEqual([`${SKILL} ausente`])
  })
})

describe('o tamanho das páginas (RF22)', () => {
  it('o repositório de hoje passa: o SKILL.md e cada passo abaixo de 500 linhas', () => {
    expect(tamanhoDasPaginas(hoje)).toEqual([])
    expect(linhasDe(hoje[SKILL] ?? '')).toBeLessThan(LIMITE_DE_LINHAS)
  })

  it('o SKILL.md com 500 linhas: vermelho, e com 499 passa', () => {
    const com = (linhas: number): Arquivos => estragar(hoje, SKILL, () => `${Array.from({ length: linhas }, () => 'linha').join('\n')}\n`)
    expect(tamanhoDasPaginas(com(LIMITE_DE_LINHAS - 1))).toEqual([])
    expect(tamanhoDasPaginas(com(LIMITE_DE_LINHAS))).toEqual([`${SKILL} tem ${LIMITE_DE_LINHAS} linhas, e o limite é abaixo de ${LIMITE_DE_LINHAS}`])
  })

  it('um passo com 500 linhas: vermelho', () => {
    const amostra = estragar(hoje, TAREFA, () => `${Array.from({ length: LIMITE_DE_LINHAS }, () => 'linha').join('\n')}\n`)
    expect(tamanhoDasPaginas(amostra)).toEqual([`${TAREFA} tem ${LIMITE_DE_LINHAS} linhas, e o limite é abaixo de ${LIMITE_DE_LINHAS}`])
  })

  it('o protocolo e o time.md não entram na conta das páginas', () => {
    const amostra = estragar(hoje, PROTOCOLO, () => `${Array.from({ length: LIMITE_DE_LINHAS + 10 }, () => 'linha').join('\n')}\n`)
    expect(tamanhoDasPaginas(amostra)).toEqual([])
  })
})

describe('nada sai sem destino (RF22)', () => {
  it('o repositório de hoje passa: os dez passos, cada um no arquivo do seu número, e as marcas todas', () => {
    expect(destinos(hoje)).toEqual([])
    expect(MARCAS_DOS_PASSOS.length).toBeGreaterThanOrEqual(10)
  })

  it.each(MARCAS_DOS_PASSOS.map(({ arquivo, marca }) => [arquivo, marca] as const))('%s sem a marca "%s": vermelho', (arquivo, marca) => {
    const caminho = `${SEGUIR}${arquivo}`
    const amostra = estragar(hoje, caminho, (texto) => tirar(texto, marca))
    expect(destinos(amostra)).toEqual([`${arquivo} perdeu "${marca}"`])
  })

  it.each([3, 4, 6, 7, 8, 9, 10])('o passo %i sem arquivo: vermelho', (passo) => {
    const nome = passosDe(hoje).find((candidato) => candidato.startsWith(`${passo}-`))
    expect(nome, `há um arquivo para o passo ${passo}`).toBeDefined()
    expect(destinos(sem(hoje, `${PASSOS}${nome ?? ''}`))).toContain(`o passo ${passo} do /seguir não está em nenhum arquivo`)
  })

  it('o arquivo cujo título é o de outro passo: vermelho', () => {
    const amostra = estragar(hoje, TAREFA, (texto) => texto.replace('## 6. O ciclo de uma tarefa', '## 5. O ciclo de uma tarefa'))
    expect(destinos(amostra)).toEqual([
      'passos/6-tarefa.md começa por "## 5. O ciclo de uma tarefa", e o título deveria ser o do passo 6',
      'o passo 6 do /seguir não está em nenhum arquivo',
    ])
  })

  it('o passo sem número que não começa por título: vermelho', () => {
    const amostra = estragar(hoje, `${PASSOS}estado-md.md`, (texto) => `Sem título.\n${texto}`)
    expect(destinos(amostra)).toEqual(['passos/estado-md.md não começa por um título "## "'])
  })

  it('o passo 1, 2 ou 5 que sai do SKILL.md: vermelho', () => {
    const amostra = estragar(hoje, SKILL, (texto) => texto.replace('## 2. Ler o estado', '## Ler o estado'))
    expect(destinos(amostra)).toEqual(['o passo 2 do /seguir não está em nenhum arquivo'])
  })
})

describe('as paradas que viram aviso, o censo e o Fora do processo: (RF9, D79 revista)', () => {
  it('o repositório de hoje passa, com todos os requisitos contados', () => {
    expect(textoDasParadas(hoje)).toEqual([])
    expect(REQUISITOS_DO_TEXTO.length).toBeGreaterThanOrEqual(20)
  })

  it.each(REQUISITOS_DO_TEXTO.map(({ nome, arquivo, termo }) => [nome, arquivo, termo] as const))('%s: sem o texto, vermelho', (nome, arquivo, termo) => {
    const amostra = estragar(hoje, arquivo, (texto) => tirar(texto, termo))
    expect(textoDasParadas(amostra)).toEqual([`falta no texto: ${nome}`])
  })

  it('arquivo ausente: todos os requisitos dele ficam vermelhos', () => {
    const faltando = textoDasParadas(sem(hoje, 'agents/validador.md'))
    expect(faltando).toHaveLength(REQUISITOS_DO_TEXTO.filter(({ arquivo }) => arquivo === 'agents/validador.md').length)
  })
})

describe('a lista de guardiões com veto da retro (D79 revista)', () => {
  const retro = 'skills/retro/SKILL.md'

  it('o repositório de hoje passa, e o código tem os seis com veto e os três sem', () => {
    expect(revisoresDaRetro(hoje)).toEqual([])
    expect(REVISORES_COM_VETO.length).toBeGreaterThanOrEqual(6)
    expect(REVISORES_SEM_VETO.length).toBeGreaterThanOrEqual(3)
  })

  it.each(REVISORES_COM_VETO.map((nome) => [nome] as const))('a retro sem %s na lista: vermelho', (nome) => {
    const amostra = estragar(hoje, retro, (texto) => texto.replaceAll(`\`${nome}\``, 'x'))
    expect(revisoresDaRetro(amostra)).toEqual([`a retro não lista ${nome} entre os revisores com veto`])
  })

  it.each(REVISORES_SEM_VETO.map((nome) => [nome] as const))('a retro com %s na lista, que não tem veto: vermelho', (nome) => {
    const amostra = estragar(hoje, retro, (texto) => texto.replace('`revisor-geral`)', `\`revisor-geral\`, \`${nome}\`)`))
    expect(revisoresDaRetro(amostra)).toEqual([`a retro lista ${nome}, que não tem veto`])
  })

  it('a lista errada de antes (llm-integrator no lugar do infra-guardian): vermelho nos dois sentidos', () => {
    const amostra = estragar(hoje, retro, (texto) => texto.replaceAll('`infra-guardian`', '`llm-integrator`'))
    expect(revisoresDaRetro(amostra)).toEqual([
      'a retro não lista infra-guardian entre os revisores com veto',
      'a retro lista llm-integrator, que não tem veto',
    ])
  })

  it('a lista fora da seção 5 não vale: o nome citado só na seção 1 é vermelho', () => {
    const amostra = estragar(hoje, retro, (texto) => texto.replaceAll('`tenancy-guardian`', 'x').replace('## 1. Ler', '## 1. Ler `tenancy-guardian`'))
    expect(revisoresDaRetro(amostra)).toEqual(['a retro não lista tenancy-guardian entre os revisores com veto'])
  })

  it('a retro sem a seção 5: vermelho', () => {
    const amostra = estragar(hoje, retro, (texto) => texto.replace('## 5. Aplicar', '## Aplicar'))
    expect(revisoresDaRetro(amostra)).toEqual(['a retro não tem a seção 5, onde ficam os grupos de aviso e de confirmação'])
  })

  it('a retro ausente: vermelho', () => {
    expect(revisoresDaRetro(sem(hoje, retro))).toEqual(['a retro não tem a seção 5, onde ficam os grupos de aviso e de confirmação'])
  })
})

describe('o repositório inteiro', () => {
  it('as cinco conferências juntas não acham nada, e há o que conferir', () => {
    expect(todas(hoje)).toEqual([])
    expect(Object.keys(hoje).length).toBeGreaterThanOrEqual(MINIMO_DE_PASSOS + 6)
  })
})
