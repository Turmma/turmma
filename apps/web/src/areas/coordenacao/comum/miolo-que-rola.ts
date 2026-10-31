/**
 * Quanto a casca e a moldura gastam fora do miolo a partir de 768 px, medido a 1366 × 768: o miolo começa a 226 px do alto
 * (a margem de cima de 20 px, a faixa do sino, o título de 64 px e as abas de 46 px, com os vãos entre eles) e a margem de baixo
 * do `main` é de 32 px, o que dá 258 px, ou 16,1 rem. Com 17 rem sobra uma folga para um título com descrição, e o miolo ocupa o
 * resto da janela e **só ele** rola (Tech Spec da X2, seção 9, "Altura"; RF23). Quem prova a conta é `paginaNaoRola`, em
 * `e2e/support/coordenacao.ts`: a string não prova nada. `md:relative` prende o que for posicionado (os `sr-only`) dentro do miolo, para
 * não aumentar a página por fora dele. Abaixo de 768 px a página rola, como qualquer outra.
 *
 * É o miolo das molduras `Escola` e `Registros` e o da lista da turma, que não tem abas mas tem o "‹ Escola" e o título com a
 * descrição no lugar do título e das abas: a mesma altura de cabeçalho (X2, 9.0). É também o do detalhe do pedido de titular, que
 * tem o "‹ Pedidos" e o título com a descrição (correção `2026-10-17-painel-e-pedido-rolam-a-pagina`).
 */
export const O_MIOLO_QUE_ROLA = 'md:relative md:max-h-[calc(100dvh-17rem-var(--faixa-de-incidente,0px))] md:overflow-y-auto'

/**
 * **A faixa do aviso de incidente** (`AvisoDeIncidente`, depois de "Ver depois") fica acima da tela, fora do miolo, e ocupa altura
 * que as contas acima não previram: sem ela a página rolava inteira (84 px a 1366 × 768, achado da 13.0). Enquanto a faixa existe,
 * ela mede a si mesma e grava a altura, mais o vão de 24 px do `main`, em `--faixa-de-incidente` na raiz; o miolo desconta o valor.
 * Sem faixa a variável não existe e o `0px` do `var()` deixa a conta como era.
 *
 * O miolo da tela **sem abas**: a Analista (correção `2026-10-17-pagina-rola-depois-da-12`) e o Painel (correção
 * `2026-10-17-painel-e-pedido-rolam-a-pagina`), que têm o mesmo título de 64 px e nenhuma aba. Ele começa a 164 px do alto (os 226 px
 * das molduras menos as abas de 46 px e o vão de 16 px que vem com elas, a 1366 × 768) e a margem de baixo é de 32 px: são 196 px,
 * ou 12,25 rem, e com 13 rem sobra uma folga como a das molduras (12 px). Sem o miolo, a página tinha a altura do conteúdo e rolava
 * inteira numa fonte que a fazia passar de 768 px (+10 px no Chromebook); com ele tem a altura da janela, e quem rola é o resumo.
 */
export const O_MIOLO_SEM_ABAS_QUE_ROLA = 'md:relative md:max-h-[calc(100dvh-13rem-var(--faixa-de-incidente,0px))] md:overflow-y-auto'

/**
 * O miolo dos Agentes ("Como cada IA trabalha", X2, 11.0). Acima dele ficam o "‹ Registros" (44 px), o título (64 px) e o seletor
 * "Qual IA" (48 px), com 16 px entre cada um: são 62 px a mais que o título e as abas das molduras, e a conta de 17 rem, que dava
 * 14 px de folga, passa a faltar 48 px (a página rolava 48 px a 1366 × 768, medido por `paginaNaoRola`). Com 21 rem o miolo começa
 * a 320 px do alto e a folga volta a ser de 16 px. A faixa do aviso de incidente desconta do mesmo jeito.
 */
export const O_MIOLO_DOS_AGENTES = 'md:relative md:max-h-[calc(100dvh-21rem-var(--faixa-de-incidente,0px))] md:overflow-y-auto'
