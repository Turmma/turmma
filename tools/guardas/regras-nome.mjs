/**
 * Guarda de nome de mercado (X8, 12.0; RF8; D81).
 *
 * Peça técnica nova nasce com o nome que a documentação do framework dá, e não com o prefixo ou o sufixo em português
 * que o rename da X8 tirou: `class AdaptadorX` é recusada e a mensagem diz `XAdapter`. O nome de domínio passa
 * (`TurmaController`, `EliminacaoDoTitular`). A lista, com o tipo de declaração em que cada forma vale e o nome de mercado,
 * está em `nomes-de-mercado.mjs`; a gramática e os casos, em `tasks/prd-nomes-de-mercado/guarda.md`.
 *
 * A regra lê só a declaração de topo do arquivo, exportada ou não, e o nome do arquivo e o das pastas dele. Limite
 * declarado: método, variável local, propriedade, string e declaração dentro de função não são lidos, e a classe
 * guardada em `const` (`const ErroX = class {}`) conta como `const`; a desestruturação de topo (`export const { x } = …`) e a
 * assinatura sem corpo (`declare function f(): void`) não são lidas. O caminho é o relativo ao `cwd` do ESLint, que tem de ser
 * a raiz do repositório: de outra pasta o `apps/web/` e o `packages/` das linhas com `onde` não casam. O escopo (`apps/**`, `packages/**` e `e2e/**`) está em
 * `index.mjs`, e a passada sem comentários (`allowInlineConfig: false`) é a que o `eslint-disable` não fura.
 */
import { relative, sep } from 'node:path'
import { EXCECOES_NOMINAIS, FORMAS, PASTAS_SO_EM_PACKAGES, SEGMENTOS } from './nomes-de-mercado.mjs'

const MAIUSCULA = /^[A-Z]/

const minuscula = (texto) => `${texto.charAt(0).toLowerCase()}${texto.slice(1)}`

/** Troca `{X}` pelo resto do nome e `{x}` pelo mesmo resto com a primeira letra minúscula. */
function sugerir(modelo, resto) {
  return modelo.replaceAll('{X}', resto).replaceAll('{x}', minuscula(resto))
}

/** O resto do nome depois de tirar a forma, ou `null` se a forma não casa. O prefixo exige maiúscula logo depois. */
function restoDoNome(nome, { forma, casa }) {
  if (casa === 'exato') return nome === forma ? '' : null
  if (casa === 'prefixo') return nome.startsWith(forma) && MAIUSCULA.test(nome.slice(forma.length)) ? nome.slice(forma.length) : null
  return nome.length > forma.length && nome.endsWith(forma) ? nome.slice(0, -forma.length) : null
}

/** A linha da lista que recusa `nome` nesse tipo de declaração e nesse caminho, com os nomes sugeridos. */
export function sugestoesDoNome(nome, tipo, caminho) {
  for (const linha of FORMAS) {
    if (!linha.tipos.includes(tipo) || (linha.onde !== undefined && !linha.onde.test(caminho))) continue
    const resto = restoDoNome(nome, linha)
    if (resto !== null) return linha.mercado.map((modelo) => sugerir(modelo, resto))
  }
  return null
}

/** A exceção nominal que cobre o nome nesse arquivo. */
export function temExcecaoNominal(nome, caminho) {
  return EXCECOES_NOMINAIS.some((excecao) => excecao.arquivo === caminho && excecao.nome === nome)
}

const escapar = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** As exceções nominais cujo alvo sumiu: o arquivo não existe, ou existe e não cita mais o nome (não confere que o declara). */
export function excecoesSemAlvo(excecoes, { existe, ler }) {
  return excecoes.filter(({ arquivo, nome }) => !existe(arquivo) || !new RegExp(`\\b${escapar(nome)}\\b`).test(ler(arquivo)))
}

/** `[tipo, nome]` de cada declaração que o nó de topo introduz. */
function declaracoesDe(no) {
  switch (no.type) {
    case 'ClassDeclaration':
      return no.id === null ? [] : [['classe', no.id.name]]
    case 'TSInterfaceDeclaration':
      return [['interface', no.id.name]]
    case 'TSTypeAliasDeclaration':
      return [['tipo', no.id.name]]
    case 'TSEnumDeclaration':
      return [['enum', no.id.name]]
    case 'FunctionDeclaration':
      return no.id === null ? [] : [['funcao', no.id.name]]
    case 'VariableDeclaration':
      return no.declarations.filter((item) => item.id.type === 'Identifier').map((item) => ['const', item.id.name])
    default:
      return []
  }
}

/** A declaração de topo, exportada (nomeada ou `default`) ou não. */
function declaracoesDoTopo(no) {
  if (no.type === 'ExportNamedDeclaration' || no.type === 'ExportDefaultDeclaration') return no.declaration ? declaracoesDe(no.declaration) : []
  return declaracoesDe(no)
}

/** Os segmentos do caminho: as pastas e, por último, o arquivo sem extensão (a extensão começa no primeiro ponto). */
function segmentosDoCaminho(caminho) {
  const partes = caminho.split('/')
  const arquivo = partes.pop() ?? ''
  return { pastas: partes, arquivo: arquivo.split('.')[0] ?? arquivo }
}

/** O problema de nome do segmento (`adaptador-*`, `guarda-*`, `*-em-memoria`), ou `null`. */
function sugestaoDoSegmento(segmento) {
  for (const { padrao, mercado } of SEGMENTOS) {
    const achado = padrao.exec(segmento)
    if (achado?.[1] !== undefined) return sugerir(mercado, achado[1])
  }
  return null
}

export const nomeDeMercado = {
  meta: {
    type: 'problem',
    docs: { description: 'Recusa, em código novo, o nome técnico em português que a X8 trocou pelo de mercado (RF8; D81).' },
    schema: [],
    messages: {
      declaracao:
        '`{{nome}}` é nome técnico em português. Use o de mercado, o que a documentação do framework usa: {{sugestoes}}. O domínio fica em português e o sufixo técnico vai em inglês (`TurmaController`); regra 60 e D81.',
      arquivo:
        'O arquivo `{{nome}}` tem nome técnico em português. Use o de mercado: `{{sugestao}}`. O domínio fica em português e o sufixo técnico vai em inglês; regra 60 e D81.',
      pasta:
        'A pasta `{{nome}}/` tem nome técnico em português. Use o de mercado: `{{sugestao}}/`. O domínio fica em português e o sufixo técnico vai em inglês; regra 60 e D81.',
    },
  },
  create(context) {
    const caminho = relative(context.cwd, context.filename).split(sep).join('/')
    return {
      Program(programa) {
        const { pastas, arquivo } = segmentosDoCaminho(caminho)
        const inicio = { line: 1, column: 0 }
        for (const pasta of pastas) {
          const sugestao = sugestaoDoSegmento(pasta) ?? PASTAS_SO_EM_PACKAGES.find((item) => item.pasta === pasta && caminho.startsWith('packages/'))?.mercado
          if (sugestao) context.report({ loc: inicio, messageId: 'pasta', data: { nome: pasta, sugestao } })
        }
        const sugestaoDoArquivo = sugestaoDoSegmento(arquivo)
        if (sugestaoDoArquivo) context.report({ loc: inicio, messageId: 'arquivo', data: { nome: arquivo, sugestao: sugestaoDoArquivo } })

        for (const no of programa.body) {
          for (const [tipo, nome] of declaracoesDoTopo(no)) {
            const sugestoes = sugestoesDoNome(nome, tipo, caminho)
            if (sugestoes === null || temExcecaoNominal(nome, caminho)) continue
            context.report({ node: no, messageId: 'declaracao', data: { nome, sugestoes: sugestoes.map((item) => `\`${item}\``).join(' ou ') } })
          }
        }
      },
    }
  },
}
