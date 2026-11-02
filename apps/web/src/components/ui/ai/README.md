# Peças da web: guia de uso para quem escreve tela

As peças gerais ficam em `apps/web/src/components/ui/` (os campos em `ui/fields/`, o que se abre por cima em
`ui/overlays/`, a cabeça da onça em `ui/onca/` e os ícones dos lugares em `ui/icons/`), e as de IA nesta pasta. Todas aparecem, em todos os estados, na
galeria (`/galeria`, `src/gallery/Gallery.tsx`), que é onde o `e2e/components-gallery.spec.ts` as prova. Como declarar a tela e de
onde importar está no topo de `src/areas/navigation.ts`. Aqui ficam as regras de uso que a peça sozinha não garante.

## Aprovação e decisão oficial

- **Aprovação de saída de IA é sempre `ApprovalLine`**, nunca o `StatusBadge` solto: ela é o mesmo selo, com quem decidiu e
  quando (regra 70, item 6). Na `AIMessage`, vai na prop `aprovacao`, que tem lugar fixo. Para a coordenação, que não é
  quem aprova, a pendente diz `espera="Esperando o professor"`.
- **`oficial` só em dois lugares:** o botão que abre a confirmação e o que confirma, dentro do `ConfirmDialog`.
  O `resumo` leva a avaliação, a turma e a quantidade; ao abrir dado nominal, o `aviso` diz que fica na auditoria.
- **Ligue `confirmando` à mutação** (`mutacao.isPending`): é ele que desliga o botão e impede a segunda decisão no
  clique duplo. A `falha` recebe o texto já em português; nunca o erro cru.
- Se o gatilho desliga ou some depois da decisão, passe `focoDeReserva`: sem ele o foco cai no `body`.

## Conversa

- A lista de mensagens é a `Conversation` (anuncia a mensagem que chega). Dentro dela: `UserMessage`, `AIMessage`,
  `ThinkingIndicator` enquanto a execução está `pendente` ou `rodando`, e `QueueAlert` quando demora ou falha.
- O texto do modelo entra por `AIText`, com as `citacoes` da mensagem: os chips e a lista de fontes vêm no fim. Não
  ponha o texto do modelo em `dangerouslySetInnerHTML` nem o interprete como Markdown.
- **Em `aoEnviar` (e em `aoGerar` do `SchemaForm`), limpe o valor e mude o estado na hora**, sem esperar o
  `isPending` da mutação: é o que impede o segundo envio do mesmo pedido e mostra que o toque foi recebido.
- **Ligue `ocupada` na `Conversation` enquanto a resposta chega** (execução `pendente` ou `rodando`): o registro lê cada nó
  que entra, e com `aria-busy` o leitor de tela espera a resposta ficar pronta e a lê uma vez, inteira. Desligue quando
  a execução terminar, com a resposta ou com o `QueueAlert` de falha já na lista.
- O `AIText` tira a marcação comum de Markdown (`**`, `#`, cerca de código, marcador de lista) sem interpretá-la; o
  asterisco de uma conta fica. Não limpe o texto antes de entregá-lo à peça.
- A `PromptInput` presa no pé da conversa vai dentro de uma `StickyFooter` com `semLinha`, como último filho do bloco que
  rola.

## Barra presa

- A `StickyFooter` é o **último filho do bloco que rola** (a `Page`, a coluna da conversa, ou uma caixa com
  `overflow-y-auto`). Ela é opaca e fica por cima da lista: para o controle que recebe foco pelo Tab não ficar escondido
  atrás dela (WCAG 2.4.11), a peça reserva a própria altura no bloco que rola (`scroll-padding-bottom`). **Não ponha
  `scroll-padding-bottom` à mão nesse bloco, e não ponha duas barras presas no mesmo bloco**: a segunda apagaria a
  reserva da primeira.
- Um bloco que rola com `overflow: hidden` no meio do caminho, ou a barra fora do bloco que de fato rola, desfaz a
  reserva: confira com o Tab, no meio da lista, que o controle focado para acima da barra.

## Desenho

- **Um `primario` por tela.** O enviar da `PromptInput`, a ação do `EmptyState` e o "Tentar de novo" do `ErrorState`
  já são `primario`: na tela que os tem, o resto é `secundario` ou `discreto`.
- `StatCard` formata número (`1412` vira `1.412`); **texto vai como veio** (`"61%"`).
- `ProgressBar` **não se pinta**: é neutra sempre, e o valor está no texto. Nada de vermelho perto do limite.
- `Menu` e `CitationChip` abrem em posição fixa na janela, e não são cortados por tabela que rola nem por diálogo. Quando
  algo rola por fora deles, fecham. Um ancestral com `transform` ou `filter` tira a posição do lugar: não ponha.
- Título de `Card`, `SectionHeader` e `SchemaForm` tem `nivel`: acerte-o para a ordem dos títulos não pular.

## O que a peça não dá

- **Os quatro estados são de cada consulta** (carregando, vazio, erro, com dado): `LoadingState`, `EmptyState` e
  `ErrorState` de `components/states`. `Table`, `Tabs` e `Conversation` desenham só o "com dado".
- `Table` não pagina nem virtualiza: entregue a página.
- `Textarea` conta e limita pelo texto sem o espaço das pontas, como a API; valide com `problemaDoTexto` e não ponha
  `maxLength` por fora.

## Adaptação

- **Adaptação nunca leva texto livre** (D35, D67): ela abre o `SchemaForm` direto, com a lista de tipos, e não entra
  no menu de ferramenta da `PromptInput` nem recebe o que foi escrito na caixa. `Textarea` é para justificativa de
  rejeição e de contestação, e nunca vira campo de ferramenta.
