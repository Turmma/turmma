# Peças da web: guia de uso para quem escreve tela

As peças gerais ficam em `apps/web/src/components/ui/` (os campos em `ui/fields/`, o que se abre por cima em
`ui/overlays/`, a cabeça da onça em `ui/onca/` e os ícones dos lugares em `ui/icons/`), e as de IA nesta pasta. Todas aparecem, em todos os estados, na
galeria (`/galeria`, `src/gallery/Gallery.tsx`), que é onde o `e2e/pecas.spec.ts` as prova. Como declarar a tela e de
onde importar está no topo de `src/areas/navigation.ts`. Aqui ficam as regras de uso que a peça sozinha não garante.

## Aprovação e decisão oficial

- **Aprovação de saída de IA é sempre `LinhaAprovacao`**, nunca o `Estado` solto: ela é o mesmo selo, com quem decidiu e
  quando (regra 70, item 6). Na `MensagemIA`, vai na prop `aprovacao`, que tem lugar fixo. Para a coordenação, que não é
  quem aprova, a pendente diz `espera="Esperando o professor"`.
- **`oficial` só em dois lugares:** o botão que abre a confirmação e o que confirma, dentro do `DialogoDeConfirmacao`.
  O `resumo` leva a avaliação, a turma e a quantidade; ao abrir dado nominal, o `aviso` diz que fica na auditoria.
- **Ligue `confirmando` à mutação** (`mutacao.isPending`): é ele que desliga o botão e impede a segunda decisão no
  clique duplo. A `falha` recebe o texto já em português; nunca o erro cru.
- Se o gatilho desliga ou some depois da decisão, passe `focoDeReserva`: sem ele o foco cai no `body`.

## Conversa

- A lista de mensagens é a `Conversa` (anuncia a mensagem que chega). Dentro dela: `MensagemPessoa`, `MensagemIA`,
  `Pensando` enquanto a execução está `pendente` ou `rodando`, e `AvisoFila` quando demora ou falha.
- O texto do modelo entra por `TextoDaIA`, com as `citacoes` da mensagem: os chips e a lista de fontes vêm no fim. Não
  ponha o texto do modelo em `dangerouslySetInnerHTML` nem o interprete como Markdown.
- **Em `aoEnviar` (e em `aoGerar` do `MotorFormulario`), limpe o valor e mude o estado na hora**, sem esperar o
  `isPending` da mutação: é o que impede o segundo envio do mesmo pedido e mostra que o toque foi recebido.
- **Ligue `ocupada` na `Conversa` enquanto a resposta chega** (execução `pendente` ou `rodando`): o registro lê cada nó
  que entra, e com `aria-busy` o leitor de tela espera a resposta ficar pronta e a lê uma vez, inteira. Desligue quando
  a execução terminar, com a resposta ou com o `AvisoFila` de falha já na lista.
- O `TextoDaIA` tira a marcação comum de Markdown (`**`, `#`, cerca de código, marcador de lista) sem interpretá-la; o
  asterisco de uma conta fica. Não limpe o texto antes de entregá-lo à peça.
- A `CaixaPedido` presa no pé da conversa vai dentro de uma `BarraPresa` com `semLinha`, como último filho do bloco que
  rola.

## Barra presa

- A `BarraPresa` é o **último filho do bloco que rola** (a `Tela`, a coluna da conversa, ou uma caixa com
  `overflow-y-auto`). Ela é opaca e fica por cima da lista: para o controle que recebe foco pelo Tab não ficar escondido
  atrás dela (WCAG 2.4.11), a peça reserva a própria altura no bloco que rola (`scroll-padding-bottom`). **Não ponha
  `scroll-padding-bottom` à mão nesse bloco, e não ponha duas barras presas no mesmo bloco**: a segunda apagaria a
  reserva da primeira.
- Um bloco que rola com `overflow: hidden` no meio do caminho, ou a barra fora do bloco que de fato rola, desfaz a
  reserva: confira com o Tab, no meio da lista, que o controle focado para acima da barra.

## Desenho

- **Um `primario` por tela.** O enviar da `CaixaPedido`, a ação do `EstadoVazio` e o "Tentar de novo" do `EstadoErro`
  já são `primario`: na tela que os tem, o resto é `secundario` ou `discreto`.
- `NumeroPainel` formata número (`1412` vira `1.412`); **texto vai como veio** (`"61%"`).
- `BarraRotulada` **não se pinta**: é neutra sempre, e o valor está no texto. Nada de vermelho perto do limite.
- `Menu` e `ChipFonte` abrem em posição fixa na janela, e não são cortados por tabela que rola nem por diálogo. Quando
  algo rola por fora deles, fecham. Um ancestral com `transform` ou `filter` tira a posição do lugar: não ponha.
- Título de `Cartao`, `CabecalhoDeSecao` e `MotorFormulario` tem `nivel`: acerte-o para a ordem dos títulos não pular.

## O que a peça não dá

- **Os quatro estados são de cada consulta** (carregando, vazio, erro, com dado): `EstadoCarregando`, `EstadoVazio` e
  `EstadoErro` de `components/states`. `Tabela`, `Abas` e `Conversa` desenham só o "com dado".
- `Tabela` não pagina nem virtualiza: entregue a página.
- `CampoLongo` conta e limita pelo texto sem o espaço das pontas, como a API; valide com `problemaDoTexto` e não ponha
  `maxLength` por fora.

## Adaptação

- **Adaptação nunca leva texto livre** (D35, D67): ela abre o `MotorFormulario` direto, com a lista de tipos, e não entra
  no menu de ferramenta da `CaixaPedido` nem recebe o que foi escrito na caixa. `CampoLongo` é para justificativa de
  rejeição e de contestação, e nunca vira campo de ferramenta.
