import { TAMANHO_MAXIMO_CODIGO_DIGITADO, TAMANHO_MAXIMO_TOKEN_DE_CONVITE } from '@educa/shared'

/** Por onde a página chegou à turma: o link do professor, com o token, ou o código que o aluno digitou. */
export type Caminho = { readonly tipo: 'link'; readonly token: string } | { readonly tipo: 'codigo'; readonly codigo: string }

/** A chave única, no `sessionStorage` da aba, do caminho da sala que atravessa a ida ao provedor da conta da escola. */
export const CAMINHO_DA_SALA_STORAGE_KEY = 'educa.caminho-da-sala'

/** Quanto o caminho guardado vale: a validade do cookie `educa_conta_provada`, que a API grava na volta do provedor (techspec §5). */
export const VALIDADE_DO_CAMINHO_DA_SALA_MS = 15 * 60_000

/**
 * O caminho da sala que atravessa a ida ao provedor (acesso-e-convites, 16.0; `cenarios.md`, "Conta da escola do aluno"; divergência da 16.0).
 *
 * O token do link vive no `#` e nunca volta do provedor, e o pedido do nome sem senha ainda manda `token` ou `codigo` no corpo: a tela guarda o
 * caminho antes de sair, no `sessionStorage` da aba (morre com ela, e `localStorage` nunca), numa chave só, com o slug e a hora. É o token da sala,
 * que a turma toda recebe — não o bilhete da troca, a senha, o nome escolhido nem nada do provedor.
 *
 * - **Gravar** é no clique, antes de sair. Sem armazenamento (modo privado, bloqueio), devolve `false` e a tela não sai.
 * - **Ler** não apaga: a leitura da primeira renderização precisa ser pura (o `StrictMode` a repete). Vale só no mesmo slug, dentro de 15 min e com a
 *   forma exata; o que não passa é como se não existisse.
 * - **Apagar** é no efeito da primeira renderização da sala, volte ou não o provedor: o colega que abre a sala na mesma aba depois não herda o caminho.
 */
export function guardarCaminhoDaSala(slug: string, caminho: Caminho, agora: number = Date.now()): boolean {
  try {
    const valor = caminho.tipo === 'link' ? caminho.token : caminho.codigo
    window.sessionStorage.setItem(CAMINHO_DA_SALA_STORAGE_KEY, JSON.stringify({ slug, tipo: caminho.tipo, valor, em: agora }))
    return true
  } catch {
    return false
  }
}

/** O que o `sessionStorage` guarda, lido do texto: `undefined` se não há, não é JSON ou não é um objeto. */
function lerObjeto(): Record<string, unknown> | undefined {
  try {
    const texto = window.sessionStorage.getItem(CAMINHO_DA_SALA_STORAGE_KEY)
    const bruto: unknown = texto === null ? undefined : JSON.parse(texto)
    return typeof bruto === 'object' && bruto !== null ? (bruto as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}

/** O valor do caminho, se tem o tamanho que o contrato aceita para o tipo. */
function caminhoDoTipo(tipo: unknown, valor: string): Caminho | undefined {
  if (tipo === 'link') return valor.length >= 1 && valor.length <= TAMANHO_MAXIMO_TOKEN_DE_CONVITE ? { tipo, token: valor } : undefined
  if (tipo === 'codigo') return valor.length >= 1 && valor.length <= TAMANHO_MAXIMO_CODIGO_DIGITADO ? { tipo, codigo: valor } : undefined
  return undefined
}

/** O caminho guardado para esta sala, ou `undefined` se não há, é de outro slug, venceu ou não tem a forma exata. Não apaga. */
export function lerCaminhoDaSala(slug: string, agora: number = Date.now()): Caminho | undefined {
  const guardado = lerObjeto()
  if (guardado === undefined) return undefined
  const { slug: doSlug, tipo, valor, em, ...resto } = guardado
  if (Object.keys(resto).length > 0 || doSlug !== slug || typeof valor !== 'string' || typeof em !== 'number') return undefined
  const idade = agora - em
  if (!(idade >= 0 && idade <= VALIDADE_DO_CAMINHO_DA_SALA_MS)) return undefined
  return caminhoDoTipo(tipo, valor)
}

/** Apaga o caminho guardado. */
export function apagarCaminhoDaSala(): void {
  try {
    window.sessionStorage.removeItem(CAMINHO_DA_SALA_STORAGE_KEY)
  } catch {
    // Sem armazenamento não há o que apagar.
  }
}
