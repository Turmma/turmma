/**
 * Guarda da camada de IA (regra 30, item 1): SDK de provedor só dentro dos adaptadores,
 * `packages/core/src/ia/*-adapter.ts`. O import estático fica com `no-restricted-imports`; esta regra
 * cobre o que ele não vê: `import('openai')`, `require('openai')`, `createRequire(...)('openai')`
 * e `typeof import('openai')`.
 */

/**
 * Pacote exato, ou qualquer subcaminho dele; escopo inteiro onde o escopo é do provedor. Além dos
 * pedidos na tarefa 3.0, os SDKs dos finalistas e dos agregadores mais comuns: um `@ai-sdk/*`
 * ou `langchain` fora do adaptador chama o provedor do mesmo jeito.
 */
const PACOTES_DE_SDK = [
  'openai',
  'ollama',
  '@google/genai',
  '@google/generative-ai',
  '@google-cloud/vertexai',
  '@aws-sdk/client-bedrock-runtime',
  'groq-sdk',
  'cohere-ai',
  'langchain',
  'ai',
]
const ESCOPOS_DE_SDK = ['@anthropic-ai', '@mistralai', '@ai-sdk', '@langchain']
const escapar = (texto) => texto.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
export const REGEX_SDK_DE_IA = `^(?:(?:${PACOTES_DE_SDK.map(escapar).join('|')})(?:/.*)?|(?:${ESCOPOS_DE_SDK.map(escapar).join('|')})/.+)$`

export const PASTA_DOS_ADAPTADORES = 'packages/core/src/ia/*-adapter.ts'

export const MENSAGEM_SDK_DE_IA =
  'SDK de provedor de IA só entra em packages/core/src/ia/*-adapter.ts. O domínio pede a tarefa ao LLMProvider, com perfil (regra 30, item 1).'

const sdkDeIa = new RegExp(REGEX_SDK_DE_IA)

export function especificador(no) {
  if (no === null || no === undefined) return null
  if (no.type === 'Literal' && typeof no.value === 'string') return no.value
  if (no.type === 'TemplateLiteral' && no.expressions.length === 0) return no.quasis[0].value.cooked
  // `typeof import('x')`: o especificador vem embrulhado num tipo literal.
  if (no.type === 'TSLiteralType') return especificador(no.literal)
  return null
}

export const sdkDeIaSoNoAdaptador = {
  meta: {
    type: 'problem',
    docs: { description: 'Proíbe import dinâmico, require e tipo importado de SDK de IA fora dos adaptadores (regra 30, item 1).' },
    schema: [],
    messages: { sdk: MENSAGEM_SDK_DE_IA },
  },
  create(context) {
    const verificar = (no, fonte) => {
      const modulo = especificador(fonte)
      if (modulo !== null && sdkDeIa.test(modulo)) context.report({ node: no, messageId: 'sdk' })
    }
    return {
      ImportExpression: (no) => verificar(no, no.source),
      CallExpression: (no) => {
        const callee = no.callee
        if (callee.type === 'Identifier' && callee.name === 'require') verificar(no, no.arguments[0])
        // `createRequire(import.meta.url)('openai')`
        if (callee.type === 'CallExpression' && callee.callee.type === 'Identifier' && callee.callee.name === 'createRequire') {
          verificar(no, no.arguments[0])
        }
      },
      TSImportType: (no) => verificar(no, no.source ?? no.argument),
    }
  },
}
