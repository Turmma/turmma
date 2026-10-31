/**
 * Guardas de log (regra 20, item 9): log leva id, nunca dado pessoal.
 *
 * O redact do logger (packages/core/src/log/logger.ts) é a rede de segurança em execução, e
 * só alcança chave com o nome exato até dois níveis. Estas regras pegam antes, no lint, e falham
 * fechadas: o que elas não conseguem provar que é seguro, reprovam.
 *
 * - Chave, variável ou campo com nome pessoal, em qualquer ponto dos argumentos.
 * - Valor não literal só entra sob chave de id (`alunoId`) ou operacional (`evento`, `erro`,
 *   `status`...). `{ aluno }` reprova: o objeto inteiro passaria com o que tiver dentro.
 * - O primeiro argumento é objeto literal, texto fixo ou o erro; os demais, texto fixo ou objeto
 *   literal. Mensagem vinda de variável sai como texto e escapa de qualquer redact.
 */

/** As mesmas chaves do redact do logger. Um teste compara as duas listas. */
export const CHAVES_PESSOAIS = Object.freeze([
  'nome',
  'matricula',
  'email',
  'telefone',
  'cpf',
  'senha',
  'resposta',
  'nota',
  'conversa',
  'prompt',
  'conteudo',
  'adaptacao',
  'diagnostico',
  'laudo',
])

/**
 * Chaves que podem receber valor não literal: dizem o que aconteceu, nunca de quem. Lista
 * fechada de propósito; chave nova entra por revisão, não por conveniência.
 */
export const CHAVES_OPERACIONAIS = Object.freeze([
  'evento',
  'erro',
  'err',
  'causa',
  'status',
  'codigo',
  'origem',
  'servico',
  'ambiente',
  'versao',
  'fila',
  'prioridade',
  'tipo',
  'estado',
  'nivel',
  'rota',
  'metodo',
  'tentativa',
  'tentativas',
  'total',
  'quantidade',
  'tamanho',
  'sqlstate',
  'constraint',
])

/**
 * Última palavra que faz do nome um metadado, e não o dado: `notaId` é id, `promptTokens` é
 * contagem, `respostaStatus` é status, `promptVersao` é versão. `nota`, `prompt` e `resposta`
 * sozinhos são dado. `nomeDaFila` e `nomeDaEscola` continuam reprovando: use `fila` e `escolaId`.
 */
const SUFIXOS_DE_METADADO = new Set(['id', 'ids', 'tokens', 'status', 'versao'])
/** Última palavra que faz do nome um id. */
const SUFIXOS_DE_ID = new Set(['id', 'ids'])
/** Última palavra que libera valor calculado sob a chave: metadado, duração (`duracaoMs`), instante (`criadoEm`) ou contagem. */
const SUFIXOS_OPERACIONAIS = new Set([...SUFIXOS_DE_METADADO, 'ms', 'em', 'total', 'quantidade'])
/** Nome do erro passado direto ao logger: `logger.error(erro)`. */
const NOMES_DE_ERRO = new Set(['erro', 'err', 'error', 'excecao', 'exception', 'causa'])

/** Métodos do pino, do Logger do Nest (`log`, `verbose`), e `child` e `setBindings`, que fixam campos em toda linha. */
export const METODOS_DE_LOG = Object.freeze(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'log', 'verbose', 'child', 'setBindings'])

const chavesPessoais = new Set(CHAVES_PESSOAIS)
const chavesOperacionais = new Set(CHAVES_OPERACIONAIS)
const metodosDeLog = new Set(METODOS_DE_LOG)
/** Objetos globais com método de mesmo nome que não são logger. */
const OBJETOS_QUE_NAO_SAO_LOGGER = new Set(['Math'])

/** `nomeDoAluno`, `NOME_ALUNO` e `nome-aluno` viram `['nome', 'do', 'aluno']`. */
function palavras(identificador) {
  return identificador
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_\-.]+/)
    .filter(Boolean)
    .map((palavra) => palavra.toLowerCase())
}

export function ehNomePessoal(identificador) {
  const partes = palavras(identificador)
  if (partes.length === 0 || SUFIXOS_DE_METADADO.has(partes.at(-1))) return false
  return partes.some((palavra) => chavesPessoais.has(palavra) || (palavra.endsWith('s') && chavesPessoais.has(palavra.slice(0, -1))))
}

export function ehChaveOperacional(chave) {
  const partes = palavras(chave)
  if (partes.length === 0 || ehNomePessoal(chave)) return false
  return SUFIXOS_OPERACIONAIS.has(partes.at(-1)) || chavesOperacionais.has(partes.join(''))
}

function ehMetadado(nome) {
  return SUFIXOS_DE_METADADO.has(palavras(nome).at(-1))
}

function textoLiteral(no) {
  if (no.type === 'Literal' && typeof no.value === 'string') return no.value
  if (no.type === 'TemplateLiteral' && no.expressions.length === 0) return no.quasis[0].value.cooked
  return null
}

function nomeDaChave(propriedade) {
  if (!propriedade.computed && propriedade.key.type === 'Identifier') return propriedade.key.name
  return textoLiteral(propriedade.key)
}

function nomeDaPropriedade(membro) {
  if (!membro.computed && membro.property.type === 'Identifier') return membro.property.name
  return textoLiteral(membro.property)
}

function nomeDoObjeto(no) {
  if (no.type === 'Identifier') return no.name
  if (no.type === 'MemberExpression') return nomeDaPropriedade(no)
  return null
}

/** A chamada é de log? Método conhecido, qualquer método de `console`, ou `logger[nivel](...)`. */
function ehChamadaDeLog(chamada) {
  const callee = chamada.callee
  if (callee.type !== 'MemberExpression') return false
  const objeto = nomeDoObjeto(callee.object)
  if (objeto !== null && OBJETOS_QUE_NAO_SAO_LOGGER.has(objeto)) return false
  if (objeto === 'console') return true
  const metodo = nomeDaPropriedade(callee)
  if (metodo !== null) return metodosDeLog.has(metodo)
  // Método escolhido em execução: vale como log quando o objeto se chama logger, log, registrador...
  return objeto !== null && /log|registrador/i.test(objeto)
}

/** `'texto'`, `` `texto` `` ou `'texto ' + 'fixo'`: nenhum valor de execução entra. */
function ehTextoFixo(no) {
  if (textoLiteral(no) !== null) return true
  return no.type === 'BinaryExpression' && no.operator === '+' && ehTextoFixo(no.left) && ehTextoFixo(no.right)
}

function ehTexto(no) {
  return (no.type === 'Literal' && typeof no.value === 'string') || no.type === 'TemplateLiteral'
}

function ehJsonStringify(no) {
  return (
    no.type === 'CallExpression' &&
    no.callee.type === 'MemberExpression' &&
    no.callee.object.type === 'Identifier' &&
    no.callee.object.name === 'JSON' &&
    nomeDaPropriedade(no.callee) === 'stringify'
  )
}

/** Conteúdo montado em execução: sai como texto ou objeto que nenhum redact enxerga. */
function ehMontado(no) {
  switch (no.type) {
    case 'SpreadElement':
    case 'TaggedTemplateExpression':
    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
    case 'ClassExpression':
      return true
    case 'TemplateLiteral':
      return no.expressions.length > 0
    case 'BinaryExpression':
      return no.operator === '+' && (ehTexto(no.left) || ehTexto(no.right)) && !ehTextoFixo(no)
    default:
      return ehJsonStringify(no)
  }
}

/**
 * Percorre um nó e tudo abaixo dele, por todas as chaves de visita do parser: tipo de nó novo
 * não escapa. Reporta nome pessoal e conteúdo montado.
 */
function varrer(no, reportar, chavesDeVisita) {
  if (no === null || no === undefined || typeof no.type !== 'string') return
  if (ehMontado(no)) reportar('montado', no)
  switch (no.type) {
    case 'Property': {
      const chave = nomeDaChave(no)
      const pessoal = chave !== null && ehNomePessoal(chave)
      if (pessoal) reportar('pessoal', no.key, { nome: chave })
      else if (no.computed) varrer(no.key, reportar, chavesDeVisita)
      // Chave abreviada (`{ nome }`) já foi reportada pela chave: não repete pelo valor.
      if (!(no.shorthand && pessoal)) varrer(no.value, reportar, chavesDeVisita)
      return
    }
    case 'Identifier':
      if (ehNomePessoal(no.name)) reportar('pessoal', no, { nome: no.name })
      return
    case 'MemberExpression':
      varrerCadeia(no, reportar, chavesDeVisita)
      return
    case 'TaggedTemplateExpression':
      // O template já reprovou inteiro: olha só a tag e as expressões, sem repetir o achado.
      varrer(no.tag, reportar, chavesDeVisita)
      for (const expressao of no.quasi.expressions) varrer(expressao, reportar, chavesDeVisita)
      return
    default:
      for (const chave of chavesDeVisita[no.type] ?? []) {
        const filho = no[chave]
        if (Array.isArray(filho)) for (const item of filho) varrer(item, reportar, chavesDeVisita)
        else varrer(filho, reportar, chavesDeVisita)
      }
  }
}

/**
 * `aluno.nome`, `nota.valor.toFixed(1)` e `aluno.nome.trim()` são dado pessoal; `nota.id` e
 * `nota.id.toString()` não. Reprova quando há nome pessoal na cadeia sem metadado depois dele.
 */
function varrerCadeia(membro, reportar, chavesDeVisita) {
  const nomes = []
  let atual = membro
  for (;;) {
    if (atual.type === 'MemberExpression') {
      const nome = nomeDaPropriedade(atual)
      if (nome === null) varrer(atual.property, reportar, chavesDeVisita)
      else nomes.unshift(nome)
      atual = atual.object
    } else if (atual.type === 'CallExpression' && atual.callee.type === 'MemberExpression') {
      if (ehMontado(atual)) reportar('montado', atual)
      for (const argumento of atual.arguments) varrer(argumento, reportar, chavesDeVisita)
      atual = atual.callee
    } else {
      break
    }
  }
  if (atual.type === 'Identifier') nomes.unshift(atual.name)
  else varrer(atual, reportar, chavesDeVisita)

  const indicePessoal = nomes.findLastIndex(ehNomePessoal)
  if (indicePessoal === -1 || nomes.slice(indicePessoal + 1).some(ehMetadado)) return
  reportar('pessoal', membro, { nome: nomes[indicePessoal] })
}

function ehValorLiteral(no) {
  if (no.type === 'Literal' || textoLiteral(no) !== null) return true
  if (no.type === 'Identifier' && no.name === 'undefined') return true
  return no.type === 'UnaryExpression' && no.argument.type === 'Literal'
}

/** Chaves que recebem o erro: só o próprio erro ou o resumo dele (`summarizeError(x)`). */
const CHAVES_DE_ERRO = new Set(['erro', 'err', 'error', 'causa'])
/** Conversões que não mudam o que o valor é: `nota.id.toString()` continua sendo id. */
const CONVERSOES = new Set(['toString', 'toISOString', 'valueOf'])

/** `'erro'`, `'id'`, `'operacional'` ou `null` (não aceita valor calculado). */
function categoriaDaChave(chave) {
  if (chave === null || ehNomePessoal(chave)) return null
  if (CHAVES_DE_ERRO.has(palavras(chave).join(''))) return 'erro'
  if (SUFIXOS_DE_ID.has(palavras(chave).at(-1))) return 'id'
  return ehChaveOperacional(chave) ? 'operacional' : null
}

function desembrulhar(no) {
  let atual = no
  while (['TSAsExpression', 'TSNonNullExpression', 'TSSatisfiesExpression', 'ChainExpression'].includes(atual.type)) atual = atual.expression
  return atual
}

/** O último nome que diz o que o valor é: `aluno.id` → `id`, `nota.id.toString()` → `id`, `fila` → `fila`. */
function nomeFinal(no) {
  let atual = desembrulhar(no)
  if (atual.type === 'CallExpression' && atual.arguments.length === 0 && atual.callee.type === 'MemberExpression') {
    const metodo = nomeDaPropriedade(atual.callee)
    if (metodo !== null && CONVERSOES.has(metodo)) atual = desembrulhar(atual.callee.object)
  }
  if (atual.type === 'Identifier') return atual.name
  if (atual.type === 'MemberExpression') return nomeDaPropriedade(atual)
  return null
}

function ehInstante(no) {
  const atual = desembrulhar(no)
  if (atual.type === 'NewExpression') return atual.callee.type === 'Identifier' && atual.callee.name === 'Date'
  return (
    atual.type === 'CallExpression' &&
    atual.callee.type === 'MemberExpression' &&
    atual.callee.object.type === 'Identifier' &&
    ['Date', 'performance'].includes(atual.callee.object.name) &&
    nomeDaPropriedade(atual.callee) === 'now'
  )
}

/**
 * A chave libera só a forma de valor que combina com ela. Id recebe o que termina em id; erro,
 * o erro ou o resumo dele; chave operacional, o que também é operacional, uma conta ou um
 * instante. `{ erro: err.message }`, `{ alunoId: aluno }` e `{ status: dados }` reprovam.
 */
function valorCombinaComChave(no, categoria) {
  const atual = desembrulhar(no)
  if (ehValorLiteral(atual)) return true
  if (atual.type === 'ConditionalExpression') {
    return valorCombinaComChave(atual.consequent, categoria) && valorCombinaComChave(atual.alternate, categoria)
  }
  if (atual.type === 'LogicalExpression') {
    return valorCombinaComChave(atual.left, categoria) && valorCombinaComChave(atual.right, categoria)
  }
  if (categoria === 'erro') {
    if (atual.type === 'CallExpression' && atual.callee.type === 'Identifier' && atual.callee.name === 'summarizeError') return true
    // O próprio erro (`erro`, `err`) ou uma variável derivada do resumo (`erroSemPilha`).
    return atual.type === 'Identifier' && NOMES_DE_ERRO.has(palavras(atual.name)[0])
  }
  const nome = nomeFinal(atual)
  if (categoria === 'id') return nome !== null && SUFIXOS_DE_ID.has(palavras(nome).at(-1))
  if (nome !== null) return categoriaDaChave(nome) === 'operacional' || categoriaDaChave(nome) === 'id'
  if (ehInstante(atual)) return true
  if (atual.type === 'BinaryExpression' && ['-', '+', '*', '/', '%'].includes(atual.operator)) {
    return valorCombinaComChave(atual.left, categoria) && valorCombinaComChave(atual.right, categoria)
  }
  return atual.type === 'UnaryExpression' && valorCombinaComChave(atual.argument, categoria)
}

/** Objeto e lista literais são abertos e conferidos; o resto precisa combinar com a chave. */
function verificarValor(no, categoria, reportar) {
  if (no.type === 'ObjectExpression') {
    for (const propriedade of no.properties) {
      if (propriedade.type !== 'Property') continue
      const chave = nomeDaChave(propriedade)
      // Chave pessoal já reprova pela própria chave.
      if (chave !== null && ehNomePessoal(chave)) continue
      verificarValor(propriedade.value, categoriaDaChave(chave), reportar)
    }
    return
  }
  if (no.type === 'ArrayExpression') {
    for (const elemento of no.elements) if (elemento !== null) verificarValor(elemento, categoria, reportar)
    return
  }
  if (no.type === 'SpreadElement' || ehValorLiteral(no)) return
  if (categoria !== null && valorCombinaComChave(no, categoria)) return
  reportar('opaco', no)
}

function ehErroDireto(no) {
  return no.type === 'Identifier' && NOMES_DE_ERRO.has(palavras(no.name).join(''))
}

/** Chama `reportar(tipo, no, dados)` para cada achado numa chamada de log. */
function analisarChamada(chamada, reportar, chavesDeVisita) {
  if (!ehChamadaDeLog(chamada)) return
  chamada.arguments.forEach((argumento, indice) => {
    varrer(argumento, reportar, chavesDeVisita)
    if (argumento.type === 'ObjectExpression' || argumento.type === 'ArrayExpression') {
      verificarValor(argumento, null, reportar)
      return
    }
    if (ehMontado(argumento) || ehTextoFixo(argumento)) return
    if (indice === 0 && ehErroDireto(argumento)) return
    if (argumento.type === 'Literal' && indice > 0) return
    reportar('mensagem', argumento)
  })
}

/** `const { info } = logger` tira o método do objeto, e a chamada `info({ nome })` deixa de ser reconhecida. */
function analisarDesestruturacao(declaracao, reportar) {
  if (declaracao.id.type !== 'ObjectPattern' || declaracao.init === null) return
  const objeto = nomeDoObjeto(declaracao.init)
  if (objeto !== null && (objeto === 'console' || /log|registrador/i.test(objeto))) reportar('desestruturado', declaracao.id)
}

function criarRegra(tiposDaRegra, meta) {
  return {
    meta,
    create(context) {
      const chavesDeVisita = context.sourceCode.visitorKeys
      const reportar = (tipo, no, dados) => {
        if (tiposDaRegra.includes(tipo)) context.report({ node: no, messageId: tipo, data: dados })
      }
      return {
        CallExpression: (chamada) => analisarChamada(chamada, reportar, chavesDeVisita),
        VariableDeclarator: (declaracao) => analisarDesestruturacao(declaracao, reportar),
      }
    },
  }
}

export const logSemDadoPessoal = criarRegra(['pessoal', 'opaco'], {
  type: 'problem',
  docs: { description: 'Proíbe dado pessoal e valor não verificável em chamada de log (regra 20, item 9).' },
  schema: [],
  messages: {
    pessoal:
      'Log não leva "{{nome}}": dado pessoal fica fora do log (nome, matrícula, contato, senha, resposta, nota, conversa, prompt, conteúdo, adaptação). Registre só ids (regra 20, item 9).',
    opaco:
      'Log não leva este valor sob esta chave. Id recebe o que termina em id (`aluno.id`); erro, o erro ou `summarizeError(erro)`; chave operacional (evento, status, duracaoMs, criadoEm...), outro valor operacional, conta ou instante. Objeto inteiro ou `err.message` levariam o que tiverem dentro (regra 20, item 9).',
  },
})

export const logSemConteudoMontado = criarRegra(['montado', 'mensagem', 'desestruturado'], {
  type: 'problem',
  docs: { description: 'Proíbe conteúdo montado e mensagem variável em chamada de log (regra 20, item 9).' },
  schema: [],
  messages: {
    montado:
      'Log não leva objeto espalhado, texto montado com variável, JSON.stringify nem função: o conteúdo escapa do redact. Use um objeto literal só com ids e um evento fixo (regra 20, item 9).',
    mensagem:
      'O log recebe um objeto literal, um texto fixo ou o erro. Mensagem vinda de variável sai como texto, fora do redact: passe os ids num objeto literal (regra 20, item 9).',
    desestruturado:
      'Não tire o método do logger (`const { info } = logger`): a chamada solta escapa da guarda. Chame `logger.info(...)` (regra 20, item 9).',
  },
})
