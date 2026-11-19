/**
 * Guarda de verbo de mercado (correção 2026-11-19-metodos-de-mercado; D81).
 *
 * O método e a função nascem com o verbo técnico em inglês, o que a documentação do framework e quem chega ao código
 * reconhecem: `findByTurma`, `create`, `listAtivos`, `isAtivo`. O domínio continua em português, no resto do nome e no verbo
 * de domínio (`aprovar`, `lancar`, `corrigir`, `matricular`, `encerrar`, `registrar`), que esta lista não toca.
 *
 * A regra lê o nome de: função declarada, `const` com função ou arrow, método de classe, de interface e de objeto, e
 * propriedade cujo valor ou tipo é função, inclusive a privada com `#` (`#lerTurma`: o nome é lido sem o `#`). O verbo casa sozinho (`ler`) ou seguido de maiúscula ou número (`lerTurma`),
 * então `listagem`, `temporada` e `eholder` passam. O nome entre aspas e o computado (`['ler']`) não são lidos.
 * O escopo (`src` de `apps/*` e `packages/*`, fora teste e `__fixtures__`) está em `index.mjs`.
 */

/** O verbo técnico em português e o de mercado que a mensagem sugere. */
export const VERBOS_DE_MERCADO = {
  ler: 'read', buscar: 'find', obter: 'get', consultar: 'find', listar: 'list', contar: 'count', criar: 'create', inserir: 'insert',
  gravar: 'save', salvar: 'save', atualizar: 'update', alterar: 'update', apagar: 'delete', excluir: 'delete', travar: 'lock',
  montar: 'build', gerar: 'generate', formatar: 'format', ordenar: 'sort', filtrar: 'filter', normalizar: 'normalize', validar: 'validate',
  verificar: 'verify', executar: 'run', iniciar: 'start', parar: 'stop', tentar: 'try', esperar: 'wait', enviar: 'send', publicar: 'publish',
  consumir: 'consume', liberar: 'release', limpar: 'clear', abrir: 'open', fechar: 'close', eh: 'is', tem: 'has', pode: 'can',
}

const VERBO = new RegExp(`^(${Object.keys(VERBOS_DE_MERCADO).join('|')})(?=$|[A-Z0-9])`)

/** O nome sugerido para `nome`, ou `null` se ele não começa por verbo técnico em português. */
export function verboDeMercado(nome) {
  const achado = VERBO.exec(nome)
  if (achado?.[1] === undefined) return null
  return `${VERBOS_DE_MERCADO[achado[1]]}${nome.slice(achado[1].length)}`
}

const FUNCOES = new Set(['FunctionExpression', 'ArrowFunctionExpression'])
const isFuncao = (no) => FUNCOES.has(no?.type)
const isTipoDeFuncao = (anotacao) => anotacao?.typeAnnotation?.type === 'TSFunctionType'

/** A chave nomeada, se não é computada (`['ler']`, `[chave]`): a computada não tem nome que se leia. */
const chave = (no) => (no.computed ? null : no.key)

export const verboDeMercadoRegra = {
  meta: {
    type: 'problem',
    docs: { description: 'Recusa método ou função com verbo técnico em português: o verbo vai em inglês e o domínio fica em português (D81).' },
    schema: [],
    messages: {
      verbo: '`{{nome}}` começa por verbo técnico em português. Use o de mercado: `{{sugestao}}`. O domínio fica em português (`findByTurma`, `listAtivos`) e o verbo de domínio também (`aprovar`, `lancar`); D81.',
    },
  },
  create(context) {
    /** Só o identificador, comum ou privado (`#lerTurma`), tem nome: a função anônima (`export default function () {}`), a chave entre aspas e a desestruturação ficam de fora. */
    const conferir = (no) => {
      if (no?.type !== 'Identifier' && no?.type !== 'PrivateIdentifier') return
      const sugestao = verboDeMercado(no.name)
      if (sugestao !== null) context.report({ node: no, messageId: 'verbo', data: { nome: no.name, sugestao } })
    }
    return {
      FunctionDeclaration: (no) => conferir(no.id),
      VariableDeclarator: (no) => {
        if (isFuncao(no.init)) conferir(no.id)
      },
      MethodDefinition: (no) => conferir(chave(no)),
      TSAbstractMethodDefinition: (no) => conferir(chave(no)),
      TSMethodSignature: (no) => conferir(chave(no)),
      PropertyDefinition: (no) => {
        if (isFuncao(no.value) || isTipoDeFuncao(no.typeAnnotation)) conferir(chave(no))
      },
      TSPropertySignature: (no) => {
        if (isTipoDeFuncao(no.typeAnnotation)) conferir(chave(no))
      },
      Property: (no) => {
        if (isFuncao(no.value)) conferir(chave(no))
      },
    }
  },
}
