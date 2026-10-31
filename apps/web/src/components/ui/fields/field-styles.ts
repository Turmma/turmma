/**
 * A caixa de todo campo de formulário da D80 (`docs/interface.md` 10.2): canto 12, borda de 2 px em `borda-campo`, que é a
 * única pista de onde o campo começa e por isso tem 3:1 contra o chão e contra o próprio campo nos dois temas (9.1), e
 * fundo `campo`. Três coisas dizem o estado, sem depender só de cor:
 *
 * - **Foco:** o anel de 3 px do `:focus-visible` global, **colado na borda** (afastamento 0), e não só a borda mais clara
 *   do mockup; a borda continua a de antes, e o anel vem a mais;
 * - **Inválido** (`aria-invalid`): a borda vira `vermelho-texto`, e quem usa a caixa mostra o texto do erro com o ícone;
 * - **Desligado:** `fundo-suave`, com o texto `apoio` (4,5:1 nos dois temas; o `inativo` de antes não chega a isso).
 *
 * `FACE_DO_CAMPO` é a parte sem o canto, para a seleção em pílula da caixa de pedido, que tem o canto dela. Fica aqui, e
 * não em `Campo.tsx`, porque o `Campo`, o `CampoLongo`, a `Selecao` e a `Busca` a dividem, e a seleção é a peça que a
 * Estrutura e o "Acrescentar turma" já usam sem o `Campo`. A altura, o enchimento e o tamanho da letra são de cada peça.
 */
export const FACE_DO_CAMPO =
  'border-2 border-borda-campo bg-campo text-tinta focus-visible:outline-offset-0 aria-invalid:border-vermelho-texto disabled:bg-fundo-suave disabled:text-apoio'

/** A face do campo com o canto de 12 px: a caixa do `Campo`, do `CampoLongo`, da `Selecao` e da `Busca`. */
export const CAIXA_DO_CAMPO = `rounded-controle ${FACE_DO_CAMPO}`

/**
 * O `select` dos formulários, com a altura de 48 px do campo e a caixa dele (regra 50, itens 2a e 11). A largura é de
 * quem usa.
 */
export const CLASSES_DO_SELETOR = `min-h-12 min-w-0 px-3.5 py-2 t-corpo ${CAIXA_DO_CAMPO}`
