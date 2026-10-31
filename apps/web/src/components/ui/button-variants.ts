/**
 * Os seis desenhos do botão da D80 (`docs/interface.md` 10.2, RF5 da X1), e nenhum outro. Todos têm canto de 12 px,
 * rótulo em `t-rotulo` (caixa-alta, 700, uma linha) e, menos o discreto, o degrau (9.3): a faixa sólida embaixo, que
 * desce quando se aperta, no toque também. Peça desligada é outro desenho: sem degrau, face `borda` e texto `apoio`.
 *
 * Os `<button>` e `<a>` escritos à mão usam as constantes `CLASSES_DO_BOTAO_*` e `CLASSES_DO_LINK_SECUNDARIO`. A **cor**
 * (face, borda, texto, degrau e desligado) sai das mesmas peças que a tabela do `Botao` (`classesDoBotao`): nessa parte
 * as duas não têm como dizer botões diferentes. A **forma** é montada de dois jeitos (`FORMA_COM_TEXTO` aqui, e
 * `FORMA_DO_BOTAO` com `TAMANHO_DO_BOTAO` na tabela, que acrescenta o vão de 8 px do ícone), e a igualdade dela é do
 * teste. O botão secundário nasceu na operação e veio para `components/` na A1 (13.0), com a Estrutura da coordenação
 * usando o mesmo.
 */

/** O desligado, igual para todos: o botão que não faz nada não se parece com o que faz, e nunca leva cor de ação. */
const DESLIGADO = 'disabled:border-borda disabled:bg-borda disabled:text-apoio'

/** O canto e a forma do botão com texto. O vão entre o glifo de 20 px e o rótulo só existe no `Botao` (`gap-2`). */
const FORMA_COM_TEXTO = 'inline-flex items-center justify-center rounded-botao t-rotulo px-4 min-h-11 min-w-11'

const COR_DO_SECUNDARIO = 'border-2 border-borda bg-superficie text-apoio degrau degrau-borda'
const COR_DO_PERIGO = 'border-2 border-vermelho-borda bg-superficie text-vermelho-texto degrau degrau-vermelho-borda'
const COR_DO_OFICIAL = 'bg-grafite text-sobre-grafite degrau degrau-grafite'
const COR_DO_PERIGO_CHEIO = 'bg-vermelho text-sobre-cor degrau degrau-vermelho'

/**
 * O botão secundário — "Cancelar", "Nova rede", "Voltar e corrigir", "Anterior", "Nova turma" —: contorno, do mesmo
 * tamanho da ação principal, porque sair ou recusar nunca é menor que seguir (D59). Alvo de toque de 44 px.
 */
export const CLASSES_DO_BOTAO_SECUNDARIO = `${FORMA_COM_TEXTO} ${COR_DO_SECUNDARIO} enabled:hover:bg-fundo-suave ${DESLIGADO}`

/** O mesmo contorno num link (`<a>`), que não tem `enabled`, e por isso não tem desligado: o hover vale sempre. */
export const CLASSES_DO_LINK_SECUNDARIO = `${FORMA_COM_TEXTO} ${COR_DO_SECUNDARIO} hover:bg-fundo-suave`

/**
 * O botão `perigo` de linha e de cartão ("Excluir", "Retirar"; 10.2): texto e borda da família vermelha, com o desenho
 * do secundário. O cheio em `vermelho` fica só dentro do diálogo de confirmação (`CLASSES_DO_BOTAO_PERIGO_CHEIO`).
 */
export const CLASSES_DO_BOTAO_PERIGO = `${FORMA_COM_TEXTO} ${COR_DO_PERIGO} enabled:hover:bg-fundo-suave ${DESLIGADO}`

/** O `perigo` cheio, com o texto em `sobre-cor`: só o botão que confirma a exclusão, dentro do diálogo. O hover não muda a face. */
export const CLASSES_DO_BOTAO_PERIGO_CHEIO = `${FORMA_COM_TEXTO} ${COR_DO_PERIGO_CHEIO} ${DESLIGADO}`

/**
 * O botão `oficial` (10.2 e `docs/interface.md` 8.4, princípio 2): o grafite, reservado à decisão oficial. Aprovar os
 * pedidos de nome cria a conta do aluno, e por isso a face e o degrau dele não são os de nenhum outro botão da tela, nos
 * dois temas (regra 50, item 8; RF6).
 */
export const CLASSES_DO_BOTAO_OFICIAL = `${FORMA_COM_TEXTO} ${COR_DO_OFICIAL} enabled:hover:bg-noite-alto ${DESLIGADO}`

/**
 * Os seis desenhos de botão, que são cinco variantes e o `cheio` do `perigo`:
 *
 * - `primario`: **a** ação da tela (enviar, gerar, salvar), na face laranja. No máximo um por tela.
 * - `oficial`: o grafite, **só** para decisão oficial (aprovar, publicar, confirmar envio). Não se parece com nenhum
 *   outro botão de propósito: é o que combate o clique reflexo (regra 50, item 8).
 * - `secundario`: a alternativa, e as duas opções de uma escolha de peso igual (D59).
 * - `discreto`: ação de linha, de barra, de cartão. Sem face e sem degrau.
 * - `perigo`: rejeitar, excluir, revogar. O cheio existe só dentro do diálogo de confirmação (`cheio`).
 */
export const VARIANTES_DE_BOTAO = ['primario', 'oficial', 'secundario', 'discreto', 'perigo'] as const
export type VarianteDeBotao = (typeof VARIANTES_DE_BOTAO)[number]

/**
 * `principal` tem a face de 44 px da ação principal (regra 50, item 2a). `compacto` é o controle secundário de barra e
 * de linha (`docs/interface.md` 9.3): face de 36 px no computador e de 44 px abaixo de 768 px, onde tudo se toca com o
 * dedo, com a letra de 14 px. `icone` é o botão só de ícone: círculo de 44 px, degrau de 3 px, com `aria-label`. O
 * degrau fica fora da caixa medida: a face é a que tem 44 px.
 */
export const TAMANHOS_DE_BOTAO = ['principal', 'compacto', 'icone'] as const
export type TamanhoDeBotao = (typeof TAMANHOS_DE_BOTAO)[number]

const FORMA_DO_BOTAO = 'inline-flex items-center justify-center gap-2 t-rotulo'

const TAMANHO_DO_BOTAO: Readonly<Record<TamanhoDeBotao, string>> = {
  principal: 'rounded-botao min-h-11 min-w-11 px-4',
  compacto: 'rounded-botao min-h-11 min-w-11 px-3 text-[14px] md:min-h-9 md:min-w-9',
  icone: 'rounded-full size-11 shrink-0 [--altura-degrau:3px]',
}

/** O que cada variante pinta, com o hover. O apertado não troca cor: a peça desce (`.degrau:active`), no toque também. */
const COR_DO_BOTAO: Readonly<Record<VarianteDeBotao, string>> = {
  primario: `bg-laranja text-sobre-cor degrau degrau-laranja enabled:hover:bg-caramelo-claro ${DESLIGADO}`,
  oficial: `${COR_DO_OFICIAL} enabled:hover:bg-noite-alto ${DESLIGADO}`,
  secundario: `${COR_DO_SECUNDARIO} enabled:hover:bg-fundo-suave ${DESLIGADO}`,
  discreto: `text-azul-texto enabled:hover:bg-fundo-suave ${DESLIGADO}`,
  perigo: `${COR_DO_PERIGO} enabled:hover:bg-fundo-suave ${DESLIGADO}`,
}

const COR_DO_PERIGO_CHEIO_COM_DESLIGADO = `${COR_DO_PERIGO_CHEIO} ${DESLIGADO}`

export interface AparenciaDoBotao {
  readonly variante?: VarianteDeBotao
  readonly tamanho?: TamanhoDeBotao
  /** Só com `perigo`, e só dentro do diálogo de confirmação: o botão que confirma a exclusão ou a rejeição. */
  readonly cheio?: boolean
}

/** As classes de um botão da 10.2. Sem nada, é o `primario` de 44 px, que é o que o `Botao` sempre foi. */
export function classesDoBotao({ variante = 'primario', tamanho = 'principal', cheio = false }: AparenciaDoBotao = {}): string {
  const cor = variante === 'perigo' && cheio ? COR_DO_PERIGO_CHEIO_COM_DESLIGADO : COR_DO_BOTAO[variante]
  return `${FORMA_DO_BOTAO} ${TAMANHO_DO_BOTAO[tamanho]} ${cor}`
}
