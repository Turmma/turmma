# Inventário X8 — `apps/web` e `e2e/` (recorte web + e2e)

Levantado em 29/10/2026 sobre a `spec/nomes-de-mercado` (`f54ee5bd`), só leitura. Escopo: `apps/web` (`src`, `__fixtures__`, testes, mais `nome-dos-chunks.ts` e `rebaixar-cor.ts`, que moram fora de `src`), `e2e/` (inclui `e2e/__fixtures__`) e `playwright.config.ts`. `tools/` não é escopo; os acoplamentos dele estão no fim.

**Como ler a coluna "Usos".** Para arquivo ou componente com arquivo próprio: nº de arquivos (testes inclusos) que importam aquele módulo. Para símbolo exportado: nº de arquivos que o importam pelo nome (um símbolo só usado dentro do arquivo dele dá 0 ou 1). Para pasta: nº de arquivos de fora dela que importam algo de dentro. Linha com várias coisas ("A / B / C") conta pelo primeiro nome. Contagens por script (import resolvido pelo caminho relativo, não por busca de palavra), sujeitas a erro de ±1-2 em barris e reexports. `—` = não se aplica.

**Regras gerais que valem para todas as tabelas:**
1. Arquivo `X.tsx` e o `X.test.tsx` renomeiam juntos (os testes aparecem só quando o nome do teste não decorre do arquivo).
2. Texto de `describe`/`it`/`test`, texto de tela, nomes de props (`aoMudar`, `rotulo`, `desligado`…) e valores de prop (`variante="primario"`) não mudam.
3. Nome em inglês só na peça técnica; conceito de domínio fica em português (turma, nota, aluno, ferramenta, agente, tutor, sino, convite, fila, aprovação…). Nome misto quando os dois convivem (`SinoAnchorContext`).
4. Onde havia duas opções, vale a que está na tabela (decisões em `inventario.md` §2).

Totais: 317 linhas nas tabelas por grupo + 57 `consulta*` + 28 `CHAVE_*` do apêndice = **402 linhas** (várias das 317 agrupam 2 a 6 símbolos do mesmo arquivo).

## 1. Kit visual (`apps/web/src/componentes/ui/`)

**Regra:** o componente toma o nome da peça equivalente do shadcn/Radix/MUI; o arquivo `.tsx` e o `.test.tsx` seguem o componente (`Botao.tsx` → `Button.tsx`); a `interface Props…` interna segue (`PropsDeBotao` → `ButtonProps`); os valores de prop (`variante="primario"`, `tom="atencao"`) e os nomes das props não mudam.

| Atual | Proposto | Tipo | Onde (caminho) | Usos |
|---|---|---|---|---|
| `Botao` | `Button` | componente | `apps/web/src/componentes/ui/Botao.tsx` | 80 |
| `BotaoCopiar` | `CopyButton` | componente | `apps/web/src/componentes/ui/BotaoCopiar.tsx` | 2 |
| `Cartao` | `Card` | componente | `apps/web/src/componentes/ui/Cartao.tsx` | 12 |
| `Abas` | `Tabs` | componente | `apps/web/src/componentes/ui/Abas.tsx` | 7 |
| Aba (interface) | `TabItem` | tipo | `apps/web/src/componentes/ui/Abas.tsx` | 4 |
| `Aviso` | `Alert` | componente | `apps/web/src/componentes/ui/Aviso.tsx` | 9 |
| `TomDeAviso` | `AlertTone` | tipo | `apps/web/src/componentes/ui/Aviso.tsx` | 3 |
| `TONS_DE_AVISO` | `ALERT_TONES` | constante | `apps/web/src/componentes/ui/Aviso.tsx` | 3 |
| `Faixa` | `Banner` | componente | `apps/web/src/componentes/ui/Faixa.tsx` | 7 |
| `BarraPresa` | StickyFooter | componente | `apps/web/src/componentes/ui/BarraPresa.tsx` | 6 |
| `BarraRotulada` | `ProgressBar` | componente | `apps/web/src/componentes/ui/BarraRotulada.tsx` | 11 |
| `Contador` | CountBadge | componente | `apps/web/src/componentes/ui/Contador.tsx` | 14 |
| `FamiliaDeCor` | `ColorFamily` | tipo | `apps/web/src/componentes/ui/Contador.tsx` | 5 |
| `FAMILIAS_DE_COR` | `COLOR_FAMILIES` | constante | `apps/web/src/componentes/ui/Contador.tsx` | 8 |
| SeloDeEstado (arquivo; exporta `Estado`) | StatusBadge (exporta `StatusBadge`) | componente | `apps/web/src/componentes/ui/SeloDeEstado.tsx` | 36 |
| `FamiliaDeEstado` | `StatusFamily` | tipo | `apps/web/src/componentes/ui/SeloDeEstado.tsx` | 8 |
| `FAMILIAS_DE_ESTADO` | `STATUS_FAMILIES` | constante | `apps/web/src/componentes/ui/SeloDeEstado.tsx` | 3 |
| `CORES_DO_ESTADO` | `STATUS_COLORS` | constante | `apps/web/src/componentes/ui/SeloDeEstado.tsx` | 2 |
| `Icone` | `Icon` | componente | `apps/web/src/componentes/ui/Icone.tsx` | 7 |
| `TamanhoDoIcone` | `IconSize` | tipo | `apps/web/src/componentes/ui/Icone.tsx` | 2 |
| `Ladrilho` | `IconTile` | componente | `apps/web/src/componentes/ui/Ladrilho.tsx` | 7 |
| `TamanhoDoLadrilho` | `IconTileSize` | tipo | `apps/web/src/componentes/ui/Ladrilho.tsx` | 3 |
| `Linha` | `ListItem` | componente | `apps/web/src/componentes/ui/Linha.tsx` | 11 |
| `Marca` | Logo | componente | `apps/web/src/componentes/ui/Marca.tsx` | 3 |
| `NumeroPainel` | StatCard | componente | `apps/web/src/componentes/ui/NumeroPainel.tsx` | 7 |
| `Tabela` | `Table` | componente | `apps/web/src/componentes/ui/Tabela.tsx` | 15 |
| `ColunaDaTabela` | `TableColumn` | tipo | `apps/web/src/componentes/ui/Tabela.tsx` | 12 |
| `Tela` | Page | componente | `apps/web/src/componentes/ui/Tela.tsx` | 41 |
| `LarguraDaTela` | `PageWidth` | tipo | `apps/web/src/componentes/ui/Tela.tsx` | 2 |
| `CabecalhoDeSecao` | `SectionHeader` | componente | `apps/web/src/componentes/ui/Tela.tsx` | 23 |
| `NivelDoTitulo` | `HeadingLevel` | tipo | `apps/web/src/componentes/ui/Tela.tsx` | 5 |
| `Toque` | `Toggle` | componente | `apps/web/src/componentes/ui/Toque.tsx` | 3 |
| `classesDoBotao` | `buttonVariants` | função | `apps/web/src/componentes/ui/botao-secundario.ts` | 12 |
| `VarianteDeBotao` | `ButtonVariant` | tipo | `apps/web/src/componentes/ui/botao-secundario.ts` | 4 |
| `VARIANTES_DE_BOTAO` | `BUTTON_VARIANTS` | constante | `apps/web/src/componentes/ui/botao-secundario.ts` | 4 |
| `TamanhoDeBotao` | `ButtonSize` | tipo | `apps/web/src/componentes/ui/botao-secundario.ts` | 3 |
| `TAMANHOS_DE_BOTAO` | `BUTTON_SIZES` | constante | `apps/web/src/componentes/ui/botao-secundario.ts` | 3 |
| `AparenciaDoBotao` | `ButtonVariantProps` | tipo | `apps/web/src/componentes/ui/botao-secundario.ts` | 1 |
| `CLASSES_DO_BOTAO_SECUNDARIO` | `SECONDARY_BUTTON_CLASSES` | constante | `apps/web/src/componentes/ui/botao-secundario.ts` | 22 |
| `CLASSES_DO_LINK_SECUNDARIO` | `SECONDARY_LINK_CLASSES` | constante | `apps/web/src/componentes/ui/botao-secundario.ts` | 15 |
| `CLASSES_DO_BOTAO_PERIGO` | `DANGER_BUTTON_CLASSES` | constante | `apps/web/src/componentes/ui/botao-secundario.ts` | 6 |
| `CLASSES_DO_BOTAO_PERIGO_CHEIO` | `DANGER_SOLID_BUTTON_CLASSES` | constante | `apps/web/src/componentes/ui/botao-secundario.ts` | 4 |
| `CLASSES_DO_BOTAO_OFICIAL` | `OFFICIAL_BUTTON_CLASSES` | constante | `apps/web/src/componentes/ui/botao-secundario.ts` | 4 |
| `useMidia` | `useMediaQuery` | hook | `apps/web/src/componentes/ui/midia.ts` | 11 |
| `PONTEIRO_GROSSO` | `COARSE_POINTER` | constante | `apps/web/src/componentes/ui/midia.ts` | 2 |
| `A_PARTIR_DE_768` | `MEDIA_MD` | constante | `apps/web/src/componentes/ui/midia.ts` | 9 |
| `A_PARTIR_DE_1024` | `MEDIA_LG` | constante | `apps/web/src/componentes/ui/midia.ts` | 2 |
| PropsDeBotao, PropsDaTela, PropsDoDialogo… (131 interfaces `Props…`, só 5 exportadas; no kit, ~45) | `ButtonProps`, `PageProps`, `DialogProps`… (só as do kit e do que for renomeado; as de fora do kit ficam) | tipo | `apps/web/src/toda a web` | — |

## 2. Campos (`componentes/ui/campos/`)

**Regra:** vocabulário de formulário do shadcn/Radix/MUI; a pasta `campos/` vira `fields/`.

| Atual | Proposto | Tipo | Onde (caminho) | Usos |
|---|---|---|---|---|
| `Campo` | `FormField` | componente | `apps/web/src/componentes/ui/campos/Campo.tsx` | 26 |
| `MensagemDeErro` | `FieldError` | componente | `apps/web/src/componentes/ui/campos/Campo.tsx` | 4 |
| `MarcaDeObrigatorio` | `RequiredMark` | componente | `apps/web/src/componentes/ui/campos/Campo.tsx` | 4 |
| `CampoDeSenha` | `PasswordInput` | componente | `apps/web/src/componentes/ui/campos/CampoDeSenha.tsx` | 4 |
| `CampoLongo` | `Textarea` | componente | `apps/web/src/componentes/ui/campos/CampoLongo.tsx` | 5 |
| `Busca` | `SearchInput` | componente | `apps/web/src/componentes/ui/campos/Busca.tsx` | 2 |
| `Interruptor` | `Switch` | componente | `apps/web/src/componentes/ui/campos/Interruptor.tsx` | 3 |
| `Opcao` | OptionCard | componente | `apps/web/src/componentes/ui/campos/Opcao.tsx` | 3 |
| `Segmentado` | `SegmentedControl` | componente | `apps/web/src/componentes/ui/campos/Segmentado.tsx` | 8 |
| OpcaoDoSegmentado / OpcoesDoSegmentado | SegmentedOption / SegmentedOptions | tipo | `apps/web/src/componentes/ui/campos/Segmentado.tsx` | 1 |
| `Selecao` | `Select` | componente | `apps/web/src/componentes/ui/campos/Selecao.tsx` | 9 |
| `OpcaoDeSelecao` | `SelectOption` | tipo | `apps/web/src/componentes/ui/campos/Selecao.tsx` | 1 |
| `FACE_DO_CAMPO` | `FIELD_FACE` | constante | `apps/web/src/componentes/ui/campos/seletor.ts` | 2 |
| `CAIXA_DO_CAMPO` | `FIELD_BOX` | constante | `apps/web/src/componentes/ui/campos/seletor.ts` | 6 |
| `CLASSES_DO_SELETOR` | `SELECT_CLASSES` | constante | `apps/web/src/componentes/ui/campos/seletor.ts` | 5 |
| `LimitesDoTexto` | `TextLimits` | tipo | `apps/web/src/componentes/ui/campos/texto-longo.ts` | 2 |

## 3. Ícones (`componentes/ui/icones/`)

**Regra:** pasta `icones/` vira `icons/`; o arquivo segue o que contém.

| Atual | Proposto | Tipo | Onde (caminho) | Usos |
|---|---|---|---|---|
| icones/lugares.tsx (arquivo) | `icons/places.tsx` | arquivo | `apps/web/src/componentes/ui/icones/lugares.tsx` | 5 |
| `NomeDoLugar` | `PlaceName` | tipo | `apps/web/src/componentes/ui/icones/lugares.tsx` | 5 |
| `NOMES_DOS_LUGARES` | `PLACE_NAMES` | constante | `apps/web/src/componentes/ui/icones/lugares.tsx` | 4 |
| `DESENHO_DO_LUGAR` | `PLACE_DRAWINGS` | constante | `apps/web/src/componentes/ui/icones/lugares.tsx` | 3 |

## 4. Peças de IA do kit (`componentes/ui/ia/`)

**Regra:** pasta `ia/` vira `ai/`; nome do padrão de chat de IA (Vercel AI Elements / ai-sdk UI: Conversation, Message, PromptInput, Sources, Citation); o conceito do domínio (aprovação, agente, ferramenta, fonte) fica como parte do nome.

| Atual | Proposto | Tipo | Onde (caminho) | Usos |
|---|---|---|---|---|
| `AvatarAgente` | `AgentAvatar` | componente | `apps/web/src/componentes/ui/ia/AvatarAgente.tsx` | 3 |
| `AssinaturaIA` | `AgentSignature` | componente | `apps/web/src/componentes/ui/ia/AssinaturaIA.tsx` | 16 |
| `SeloIA` | `AIBadge` | componente | `apps/web/src/componentes/ui/ia/AssinaturaIA.tsx` | 4 |
| `TextoDaIA` | AIText | componente | `apps/web/src/componentes/ui/ia/TextoDaIA.tsx` | 3 |
| `Conversa` | `Conversation` | componente | `apps/web/src/componentes/ui/ia/Mensagem.tsx` | 11 |
| `MensagemIA` | `AIMessage` | componente | `apps/web/src/componentes/ui/ia/Mensagem.tsx` | 10 |
| `MensagemPessoa` | `UserMessage` | componente | `apps/web/src/componentes/ui/ia/Mensagem.tsx` | 5 |
| `Pensando` | `ThinkingIndicator` | componente | `apps/web/src/componentes/ui/ia/Mensagem.tsx` | 7 |
| Mensagem.tsx (arquivo) | `Message.tsx` | arquivo | `apps/web/src/componentes/ui/ia/Mensagem.tsx` | 9 |
| `CaixaPedido` | `PromptInput` | componente | `apps/web/src/componentes/ui/ia/CaixaPedido.tsx` | 4 |
| `ChipFonte` | `CitationChip` | componente | `apps/web/src/componentes/ui/ia/ChipFonte.tsx` | 4 |
| `Fontes` | `Sources` | componente | `apps/web/src/componentes/ui/ia/Fontes.tsx` | 3 |
| `PaginaMini` | `PageThumbnail` | componente | `apps/web/src/componentes/ui/ia/PaginaMini.tsx` | 3 |
| `LinhaAprovacao` | `ApprovalLine` | componente | `apps/web/src/componentes/ui/ia/LinhaAprovacao.tsx` | 7 |
| `Escolha` | ChoicePrompt | componente | `apps/web/src/componentes/ui/ia/Escolha.tsx` | 3 |
| `OpcaoDeEscolha` | `ChoiceOption` | tipo | `apps/web/src/componentes/ui/ia/Escolha.tsx` | 3 |
| `AvisoFila` | `QueueAlert` | componente | `apps/web/src/componentes/ui/ia/AvisoFila.tsx` | 5 |
| `MotorFormulario` | SchemaForm | componente | `apps/web/src/componentes/ui/ia/MotorFormulario.tsx` | 3 |
| `EstadoDoMotor` | `SchemaFormState` | tipo | `apps/web/src/componentes/ui/ia/MotorFormulario.tsx` | 2 |
| `CampoDoMotor` | `FormFieldDef` | tipo | `apps/web/src/componentes/ui/ia/motor-formulario.ts` | 3 |
| motor-formulario.ts (arquivo) | `schema-form.ts` | arquivo | `apps/web/src/componentes/ui/ia/motor-formulario.ts` | 7 |
| caixa-pedido.ts (arquivo) | `prompt-input.ts` | arquivo | `apps/web/src/componentes/ui/ia/caixa-pedido.ts` | 2 |
| `EstadoDaCaixa` | `PromptInputState` | tipo | `apps/web/src/componentes/ui/ia/caixa-pedido.ts` | 2 |
| aprovacao.ts (arquivo) | `approval.ts` | arquivo | `apps/web/src/componentes/ui/ia/aprovacao.ts` | 7 |
| assinatura.ts (arquivo) | `signature.ts` | arquivo | `apps/web/src/componentes/ui/ia/assinatura.ts` | 4 |
| texto-da-ia.ts (arquivo) | `ai-text.ts` | arquivo | `apps/web/src/componentes/ui/ia/texto-da-ia.ts` | 2 |
| textos-das-fontes.ts (arquivo) | `source-labels.ts` | arquivo | `apps/web/src/componentes/ui/ia/textos-das-fontes.ts` | 6 |

## 5. Sobrepostos do kit (`componentes/ui/sobrepostos/`)

**Regra:** pasta `sobrepostos/` vira `overlays/`; `Dialogo` → `Dialog`, `PainelLado` → `Sheet` (nome do shadcn; `Drawer` fica livre para a gaveta da casca), `Menu` já é o nome de mercado.

| Atual | Proposto | Tipo | Onde (caminho) | Usos |
|---|---|---|---|---|
| `Dialogo` | `Dialog` | componente | `apps/web/src/componentes/ui/sobrepostos/Dialogo.tsx` | 13 |
| `DialogoDeConfirmacao` | ConfirmDialog (Radix: AlertDialog) | componente | `apps/web/src/componentes/ui/sobrepostos/DialogoDeConfirmacao.tsx` | 13 |
| `PainelLado` | Sheet | componente | `apps/web/src/componentes/ui/sobrepostos/PainelLado.tsx` | 11 |
| `ItemDoMenu` | `MenuItem` | tipo | `apps/web/src/componentes/ui/sobrepostos/Menu.tsx` | 3 |
| dialogo-aberto.ts (arquivo) | `dialog-state.ts` | arquivo | `apps/web/src/componentes/ui/sobrepostos/dialogo-aberto.ts` | 11 |
| `useDialogoDaTela` | `useDialogState` | hook | `apps/web/src/componentes/ui/sobrepostos/dialogo-aberto.ts` | 12 |
| `AberturaDeDialogo` | `DialogOpening` | tipo | `apps/web/src/componentes/ui/sobrepostos/dialogo-aberto.ts` | 1 |
| dialogo-modal.ts (arquivo) | `modal-dialog.ts` | arquivo | `apps/web/src/componentes/ui/sobrepostos/dialogo-modal.ts` | 3 |
| `useDialogoModal` | `useModalDialog` | hook | `apps/web/src/componentes/ui/sobrepostos/dialogo-modal.ts` | 3 |
| `prenderOFoco` | `trapFocus` | função | `apps/web/src/componentes/ui/sobrepostos/dialogo-modal.ts` | 2 |
| dialogo-prioritario.ts (arquivo) | `priority-dialog.ts` | arquivo | `apps/web/src/componentes/ui/sobrepostos/dialogo-prioritario.ts` | 4 |
| `useDialogoPrioritario` | `usePriorityDialog` | hook | `apps/web/src/componentes/ui/sobrepostos/dialogo-prioritario.ts` | 2 |
| flutuante.ts (arquivo) | `floating.ts` | arquivo | `apps/web/src/componentes/ui/sobrepostos/flutuante.ts` | 3 |
| `useFlutuante` | `useFloating` | hook | `apps/web/src/componentes/ui/sobrepostos/flutuante.ts` | 3 |
| `useRestoInerte` | `useInertOutside` | hook | `apps/web/src/componentes/ui/sobrepostos/flutuante.ts` | 2 |
| teclado-do-menu.ts (arquivo) | `menu-keyboard.ts` | arquivo | `apps/web/src/componentes/ui/sobrepostos/teclado-do-menu.ts` | 2 |

## 6. Peças técnicas de `componentes/` fora do kit

**Regra:** componente de estado, erro, diálogo-padrão e utilitário de UI que não carrega conceito de domínio toma o nome de mercado; a pasta `estado/` vira `states/`.

| Atual | Proposto | Tipo | Onde (caminho) | Usos |
|---|---|---|---|---|
| `EstadoCarregando` | `LoadingState` | componente | `apps/web/src/componentes/estado/EstadoCarregando.tsx` | 61 |
| `EstadoVazio` | `EmptyState` | componente | `apps/web/src/componentes/estado/EstadoVazio.tsx` | 41 |
| `EstadoErro` | `ErrorState` | componente | `apps/web/src/componentes/estado/EstadoErro.tsx` | 51 |
| `FronteiraDaArea` | `AreaErrorBoundary` | classe (error boundary) | `apps/web/src/componentes/FronteiraDaArea.tsx` | 2 |
| NaoEncontrada.tsx (arquivo) | `NotFound.tsx` | arquivo | `apps/web/src/componentes/NaoEncontrada.tsx` | 5 |
| `ConteudoNaoEncontrado` | `NotFoundContent` | componente | `apps/web/src/componentes/NaoEncontrada.tsx` | 6 |
| `PaginaNaoEncontrada` | `NotFoundPage` | componente | `apps/web/src/componentes/NaoEncontrada.tsx` | 2 |
| `LoginPorCima` | ReauthDialog | componente | `apps/web/src/componentes/LoginPorCima.tsx` | 2 |
| `CodigoQr` | `QrCode` | componente | `apps/web/src/componentes/CodigoQr.tsx` | 3 |
| Dica (em itens-da-lateral.tsx) | `Tooltip` | componente | `apps/web/src/componentes/itens-da-lateral.tsx` | 3 |
| `RegiaoQueRola` | ScrollArea | componente | `apps/web/src/componentes/introducao/RegiaoQueRola.tsx` | 4 |
| `RegiaoDaLista` | `ScrollableList` | componente | `apps/web/src/operacao/componentes/RegiaoDaLista.tsx` | 4 |
| `useSobra` | `useOverflow` | hook | `apps/web/src/operacao/componentes/RegiaoDaLista.tsx` | 2 |
| `PaginasDaLista` | `Pagination` | componente | `apps/web/src/operacao/componentes/NavegacaoDaLista.tsx` | 3 |
| `SeletorDeOrdem` | `SortSelect` | componente | `apps/web/src/operacao/componentes/NavegacaoDaLista.tsx` | 3 |
| dialogos.tsx (arquivo) | `dialogs.tsx` | arquivo | `apps/web/src/componentes/dialogos.tsx` | 19 |
| `useEnvioUnico` | `useSingleSubmit` | hook | `apps/web/src/componentes/dialogos.tsx` | 14 |
| `Anuncio` | `StatusAnnouncement` | componente | `apps/web/src/componentes/dialogos.tsx` | 10 |
| `AlertaDaFalha` | `ErrorAlert` | componente | `apps/web/src/componentes/dialogos.tsx` | 4 |
| `AlertaSemFoco` | `ErrorAlertNoAutofocus` | componente | `apps/web/src/componentes/dialogos.tsx` | 2 |
| `DialogoDeFormulario` | `FormDialog` | componente | `apps/web/src/componentes/dialogos.tsx` | 6 |
| `CorpoDaConfirmacaoDePerigo` | `DangerConfirmBody` | componente | `apps/web/src/componentes/dialogos.tsx` | 2 |
| `ConfirmacaoDePerigo` | `DangerConfirmDialog` | componente | `apps/web/src/componentes/dialogos.tsx` | 5 |
| copia-unica.tsx (arquivo) | `copy-once.tsx` | arquivo | `apps/web/src/componentes/copia-unica.tsx` | 4 |
| `useFechamento` | `useGuardedClose` | hook | `apps/web/src/componentes/copia-unica.tsx` | 3 |
| `useCopia` | `useCopyToClipboard` | hook | `apps/web/src/componentes/copia-unica.tsx` | 3 |
| `useFocoDaEtapa` | `useStepFocus` | hook | `apps/web/src/componentes/copia-unica.tsx` | 4 |
| `Pergunta` | `CloseConfirmation` | componente | `apps/web/src/componentes/copia-unica.tsx` | 3 |
| `CampoDoLink` | `LinkField` | componente | `apps/web/src/componentes/copia-unica.tsx` | 3 |
| `AvisoDaCopia` | `CopyStatus` | componente | `apps/web/src/componentes/copia-unica.tsx` | 3 |
| `Falha` | `FailureAlert` | componente | `apps/web/src/componentes/copia-unica.tsx` | 4 |
| `DitosDaCopia` | `CopyMessages` | tipo | `apps/web/src/componentes/copia-unica.tsx` | 2 |
| `AbaDoNavegador` | `BrowserTab` | tipo | `apps/web/src/componentes/pedidos/atualizacao-dos-pedidos.ts` | 6 |
| `SEM_LEITURA_SOZINHA` | `NO_AUTO_REFETCH` | constante | `apps/web/src/componentes/sino/leitura-do-sino.ts` | 3 |
| `LEITURA_DA_FILA` | `QUEUE_QUERY_OPTIONS` | constante | `apps/web/src/componentes/sino/leitura-do-sino.ts` | 3 |

## 6b. Peças técnicas dentro de `areas/*/comum/`

**Regra:** `comum/` é infraestrutura de tela de uma área, sem conceito de domínio; ver Dúvidas.

| Atual | Proposto | Tipo | Onde (caminho) | Usos |
|---|---|---|---|---|
| `Moldura` | TabbedPage | componente | `apps/web/src/areas/coordenacao/comum/moldura.tsx` | 4 |
| `AbaDaMoldura` | `TabbedPageTab` | tipo | `apps/web/src/areas/coordenacao/comum/moldura.tsx` | 3 |
| `useFocarOTituloDaMoldura` | `useFocusPageHeading` | hook | `apps/web/src/areas/coordenacao/comum/moldura.tsx` | 4 |
| Linha (em pecas-da-lista.tsx; homônimo do kit) | `ListRow` | componente | `apps/web/src/areas/coordenacao/comum/pecas-da-lista.tsx` | 6 |

## 7. Cliente HTTP e consultas (`apps/web/src/api/`)

**Regra:** o cliente HTTP e o cache de consultas tomam o nome do fetch-wrapper/TanStack Query; o `consultaX` exportado (um `queryOptions`) vira `xQueryOptions` (convenção da documentação do TanStack, "Query Options"); a chave `CHAVE_X` vira `X_QUERY_KEY`. A lista completa dos 57 `consulta*` e dos 28 `CHAVE_*` está no apêndice.

| Atual | Proposto | Tipo | Onde (caminho) | Usos |
|---|---|---|---|---|
| api/cliente.ts (arquivo) | `api/client.ts` | arquivo | `apps/web/src/api/cliente.ts` | 70 |
| `ErroDaApi` | `ApiError` | classe | `apps/web/src/api/cliente.ts` | 49 |
| `EsquemaDeResposta` | `ResponseSchema` | tipo | `apps/web/src/api/cliente.ts` | 4 |
| `SEM_CORPO` | `EMPTY_BODY` | constante | `apps/web/src/api/cliente.ts` | 11 |
| `OpcoesDaChamada` | `RequestOptions` | tipo | `apps/web/src/api/cliente.ts` | 3 |
| `chamarApi` | `apiRequest` | função | `apps/web/src/api/cliente.ts` | 9 |
| `buscarDaApi` | `apiGet` | função | `apps/web/src/api/cliente.ts` | 4 |
| `mensagemDoErro` | `errorMessage` | função | `apps/web/src/api/cliente.ts` | 19 |
| `chamarComSessao` | `authedRequest` | função | `apps/web/src/api/sessao.ts` | 19 |
| `buscarComSessao` | `authedGet` | função | `apps/web/src/api/sessao.ts` | 23 |
| `OpcoesComSessao` | `AuthedRequestOptions` | tipo | `apps/web/src/api/sessao.ts` | 1 |
| api/cliente-de-consultas.ts (arquivo) | `api/query-client.ts` | arquivo | `apps/web/src/api/cliente-de-consultas.ts` | 27 |
| `criarClienteDeConsultas` | `createQueryClient` | função | `apps/web/src/api/cliente-de-consultas.ts` | 27 |
| `deveTentarDeNovo` | `shouldRetry` | função | `apps/web/src/api/cliente-de-consultas.ts` | 2 |
| `TENTATIVAS_AUTOMATICAS` | `AUTO_RETRIES` | constante | `apps/web/src/api/cliente-de-consultas.ts` | 1 |
| `ESPERA_ENTRE_TENTATIVAS_MS` | `RETRY_DELAY_MS` | constante | `apps/web/src/api/cliente-de-consultas.ts` | 1 |
| api/memoria-da-aba.ts (arquivo) | `api/tab-store.ts` | arquivo | `apps/web/src/api/memoria-da-aba.ts` | 7 |
| `LugarNaAba` | `TabStore` | tipo | `apps/web/src/api/memoria-da-aba.ts` | 3 |
| `criarLugarNaAba` | `createTabStore` | função | `apps/web/src/api/memoria-da-aba.ts` | 4 |
| `useLugarNaAba` | `useTabStore` | hook | `apps/web/src/api/memoria-da-aba.ts` | 4 |
| paginas/reenvio-da-sala.ts (arquivo) | pages/retry-with-backoff.ts | arquivo | `apps/web/src/paginas/reenvio-da-sala.ts` | 2 |

## 8. Providers, contextos e hooks

**Regra:** contexto React = `XContext`; o valor, `XContextValue`; hook genérico em inglês (`useMediaQuery`); hook com conceito de domínio (`useTurmas`, `useFilaDoProfessor`, `useIntroducao`) fica. Não existe provider de auth: a sessão é um store externo em `api/sessao.ts`, lido com `useSyncExternalStore`.

| Atual | Proposto | Tipo | Onde (caminho) | Usos |
|---|---|---|---|---|
| `ContextoDaGaveta` | `DrawerContext` | contexto | `apps/web/src/componentes/gaveta.ts` | 4 |
| Gaveta (interface) | `DrawerContextValue` | tipo | `apps/web/src/componentes/gaveta.ts` | 2 |
| gaveta.ts (arquivo) | `drawer-context.ts` | arquivo | `apps/web/src/componentes/gaveta.ts` | 3 |
| `ContextoDaSaida` | `SignOutContext` | contexto | `apps/web/src/componentes/saida-da-casca.ts` | 10 |
| `SaidaDaCasca` | `SignOutContextValue` | tipo | `apps/web/src/componentes/saida-da-casca.ts` | 2 |
| saida-da-casca.ts (arquivo) | `sign-out-context.ts` | arquivo | `apps/web/src/componentes/saida-da-casca.ts` | 9 |
| `ContextoDaAncoraDoSino` | `SinoAnchorContext` | contexto | `apps/web/src/componentes/ancora-do-sino.ts` | 4 |
| `AncoraDoSino` | `SinoAnchorContextValue` | tipo | `apps/web/src/componentes/ancora-do-sino.ts` | 2 |
| `useAncoraDoSino` | `useSinoAnchor` | hook | `apps/web/src/componentes/ancora-do-sino.ts` | 3 |
| ancora-do-sino.ts (arquivo) | `sino-anchor-context.ts` | arquivo | `apps/web/src/componentes/ancora-do-sino.ts` | 5 |
| `ContextoDoAviso` | `SessionWarningContext` | contexto | `apps/web/src/operacao/componentes/AvisoDeInatividade.tsx` | 3 |
| `AvisoDaSessao` | `SessionWarningContextValue` | tipo | `apps/web/src/operacao/componentes/AvisoDeInatividade.tsx` | 2 |
| `useTituloDaAba` | `useTabTitle` | hook | `apps/web/src/titulo.ts` | 3 |
| `useTituloDaTela` | `usePageTitle` | hook | `apps/web/src/titulo.ts` | 30 |
| `useTituloDaPagina` | useOperacaoPageTitle (ou fundir em `usePageTitle` com sufixo por parâmetro) | hook | `apps/web/src/operacao/titulo.ts` | 8 |
| `useAparencia` | `useThemePreference` | hook | `apps/web/src/tema.ts` | 2 |
| `useLetra` | `useTextSize` | hook | `apps/web/src/letra.ts` | 2 |
| `useTamanhoDaLetra` | `useApplyTextSize` | hook | `apps/web/src/letra.ts` | 3 |
| `useInatividade` | `useIdleTimeout` | hook | `apps/web/src/sessao/inatividade.ts` | 2 |
| `useInatividadeDaOperacao` | `useOperatorIdleTimeout` | hook | `apps/web/src/operacao/inatividade.ts` | 2 |
| `useCicloDeExecucao` | useExecutionLifecycle | hook | `apps/web/src/api/execucoes.ts` | 6 |

## 9. Roteamento e caminhos

**Regra:** `rotas.tsx` (o `<Routes>`) → `routes.tsx`; `caminhos.ts` (constantes e montadores de URL) → `paths.ts`; as chaves das rotas, os parâmetros de busca e os valores da URL não mudam.

| Atual | Proposto | Tipo | Onde (caminho) | Usos |
|---|---|---|---|---|
| rotas.tsx (arquivo) | `routes.tsx` | arquivo | `apps/web/src/rotas.tsx` | 2 |
| `Rotas` | `AppRoutes` | componente | `apps/web/src/rotas.tsx` | 3 |
| areas/{coordenacao,professor,aluno}/rotas.tsx + operacao/rotas.tsx (4 arquivos) | routes.tsx em cada pasta (`RotasDaOperacao` → `OperacaoRoutes`) | arquivo | `apps/web/src/areas/*/rotas.tsx; apps/web/src/operacao/rotas.tsx` | 2 |
| caminhos.ts + operacao/caminhos.ts (2 arquivos) | paths.ts em cada pasta | arquivo | `apps/web/src/caminhos.ts; apps/web/src/operacao/caminhos.ts` | 91 |
| `ROTAS` | `ROUTES` | constante | `apps/web/src/caminhos.ts` | 21 |
| `ROTAS_DO_PROFESSOR` | `PROFESSOR_ROUTES` | constante | `apps/web/src/caminhos.ts` | 24 |
| `ROTAS_DA_COORDENACAO` | `COORDENACAO_ROUTES` | constante | `apps/web/src/caminhos.ts` | 17 |
| `ROTAS_DO_ALUNO` | `ALUNO_ROUTES` | constante | `apps/web/src/caminhos.ts` | 7 |
| `ROTAS_DA_OPERACAO` | `OPERACAO_ROUTES` | constante | `apps/web/src/operacao/caminhos.ts` | 7 |
| `ROTA_DA_ETAPA` | `LOGIN_STEP_ROUTE` | constante | `apps/web/src/caminhos.ts` | 7 |
| BASE\_DA\_AREA / BASE\_DA\_OPERACAO | AREA\_BASE\_PATH / OPERACAO\_BASE\_PATH | constante | `apps/web/src/caminhos.ts; apps/web/src/operacao/caminhos.ts` | 3 |
| PARAMETRO\_DO\_X (12: ABA, ATIVIDADE, ORIGEM, QUESTAO, TURMA, CONVITE, DESTAQUE, ESTADO, MATERIAL, PROFESSOR, TIPO…) | X_PARAM (`PARAMETRO_DA_ORIGEM` → `ORIGEM_PARAM`) | constante | `apps/web/src/caminhos.ts e telas` | 2 |
| caminhoDoX (15 montadores de URL) | xPath (`caminhoDaTurmaDoProfessor` → `professorTurmaPath`) — ver Dúvidas | função | `apps/web/src/caminhos.ts; apps/web/src/api/escola.ts` | 5 |
| areas/navegacao.ts (arquivo) | `areas/navigation.ts` | arquivo | `apps/web/src/areas/navegacao.ts` | 13 |
| NAVEGACAO / RODAPE\_DA\_LATERAL / MENU\_DA\_PESSOA | NAVIGATION / SIDEBAR\_FOOTER / PERSON\_MENU | constante | `apps/web/src/areas/navegacao.ts` | 11 |
| `ItemDaNavegacao` | `NavItem` | tipo | `apps/web/src/areas/navegacao.ts` | 6 |
| `IconeDoItem` | `NavItemIcon` | tipo | `apps/web/src/areas/navegacao.ts` | 2 |
| paginas/fragmento.ts (arquivo) | `pages/url-fragment.ts` | arquivo | `apps/web/src/paginas/fragmento.ts` | 2 |
| tokenDoFragmento / apagarFragmentoDaBarra | readFragmentToken / clearFragment | função | `apps/web/src/paginas/fragmento.ts` | 3 |

## 10. Utilitários

**Regra:** utilitário genérico toma nome de biblioteca-padrão; constantes e chaves de armazenamento cujo valor é persistido (`'educa.aparencia'`) mudam de nome, nunca de valor.

| Atual | Proposto | Tipo | Onde (caminho) | Usos |
|---|---|---|---|---|
| formatar.ts (arquivo) | `format.ts` | arquivo | `apps/web/src/formatar.ts` | 47 |
| formatarData / formatarDataHora / formatarNumero / formatarQuantidade / formatarDiaEHora / formatarDiaDoInstante | formatDate / formatDateTime / formatNumber / formatQuantity / formatDayAndTime / formatDayOfInstant — ver Dúvidas | função | `apps/web/src/formatar.ts` | 9 |
| operacao/formatos.ts (arquivo) | `operacao/format.ts` | arquivo | `apps/web/src/operacao/formatos.ts` | 2 |
| tema.ts (arquivo) | `theme.ts` | arquivo | `apps/web/src/tema.ts` | 6 |
| Aparencia (tipo) | `ThemePreference` | tipo | `apps/web/src/tema.ts` | 7 |
| Tema (tipo; também em `__fixtures__/cor-das-classes.ts`) | `ResolvedTheme` | tipo | `apps/web/src/tema.ts` | 2 |
| CHAVE\_DA\_APARENCIA / CHAVE\_DA\_LETRA / CHAVE\_DA\_LATERAL\_RECOLHIDA | THEME\_STORAGE\_KEY / TEXT\_SIZE\_STORAGE\_KEY / SIDEBAR\_COLLAPSED\_STORAGE\_KEY | constante | `apps/web/src/tema.ts; apps/web/src/letra.ts; apps/web/src/componentes/lateral-recolhida.ts` | 1 |
| resolverTema / aplicarTema / iniciarTema / lerAparencia / escolherAparencia | resolveTheme / applyTheme / initTheme / readThemePreference / setThemePreference | função | `apps/web/src/tema.ts` | 1 |
| letra.ts (arquivo) | `text-size.ts` | arquivo | `apps/web/src/letra.ts` | 6 |
| TamanhoDaLetra (tipo) | `TextSize` | tipo | `apps/web/src/letra.ts` | 6 |
| `ATRIBUTO_DA_LETRA` | `TEXT_SIZE_ATTRIBUTE` | constante | `apps/web/src/letra.ts` | 1 |
| titulo.ts + operacao/titulo.ts (arquivos) | document-title.ts em cada pasta | arquivo | `apps/web/src/titulo.ts; apps/web/src/operacao/titulo.ts` | 39 |
| papeis.ts (arquivo) | `roles.ts` | arquivo | `apps/web/src/papeis.ts` | 3 |
| `NOME_DO_PAPEL` | `ROLE_LABELS` | constante | `apps/web/src/papeis.ts` | 4 |
| baixar-por-url.ts (arquivo) | `download-from-url.ts` | arquivo | `apps/web/src/componentes/baixar-por-url.ts` | 3 |
| `baixarPorUrl` | `downloadFromUrl` | função | `apps/web/src/componentes/baixar-por-url.ts` | 4 |
| id-do-pedido.ts (arquivo) | `request-id.ts` | arquivo | `apps/web/src/componentes/id-do-pedido.ts` | 2 |
| `sortearIdDoPedido` | `newRequestId` | função | `apps/web/src/componentes/id-do-pedido.ts` | 6 |
| texto-da-falha.ts (arquivo) | `error-text.ts` | arquivo | `apps/web/src/componentes/texto-da-falha.ts` | 22 |
| textoDaFalha / listaMudou | errorText / listChanged | função | `apps/web/src/componentes/texto-da-falha.ts` | 27 |
| estilos.css (arquivo) | index.css | arquivo | `apps/web/src/estilos.css` | 14 |
| sessao/inatividade.ts (arquivo) | session/idle-timeout.ts (ver Dúvidas sobre `sessao/`) | arquivo | `apps/web/src/sessao/inatividade.ts` | 1 |
| operacao/inatividade.ts (arquivo) | `operacao/idle-timeout.ts` | arquivo | `apps/web/src/operacao/inatividade.ts` | 2 |

## 11. Fixtures e helpers de teste (web)

**Regra:** a pasta `__fixtures__/` já é nome de mercado (Jest/Vitest) e fica; os arquivos e símbolos genéricos de teste tomam o nome do Testing Library/Vitest (`renderScreen`, `fakeFetch`).

| Atual | Proposto | Tipo | Onde (caminho) | Usos |
|---|---|---|---|---|
| \_\_fixtures\_\_/tela.tsx (arquivo) | \_\_fixtures\_\_/render-screen.tsx | arquivo | `apps/web/src/__fixtures__/tela.tsx` | 48 |
| `redeFalsa` | `fakeNetwork` | função | `apps/web/src/__fixtures__/tela.tsx` | 50 |
| `RedeFalsa` | `FakeNetwork` | tipo | `apps/web/src/__fixtures__/tela.tsx` | 32 |
| `RespostaFalsa` | `FakeResponse` | tipo | `apps/web/src/__fixtures__/tela.tsx` | 37 |
| `ChamadaFeita` | `RecordedCall` | tipo | `apps/web/src/__fixtures__/tela.tsx` | 1 |
| `prepararTela` | `setupScreen` | função | `apps/web/src/__fixtures__/tela.tsx` | 48 |
| `renderizarTela` | `renderScreen` | função | `apps/web/src/__fixtures__/tela.tsx` | 30 |
| TOKEN\_DE\_TESTE / AUTORIZACAO\_DE\_TESTE | TEST\_TOKEN / TEST\_AUTHORIZATION | constante | `apps/web/src/__fixtures__/tela.tsx` | 3 |
| \_\_fixtures\_\_/cor-das-classes.ts (arquivo) | `__fixtures__/class-colors.ts` | arquivo | `apps/web/src/__fixtures__/cor-das-classes.ts` | 30 |
| corDoToken / classesDo / tokenDe / tokenOuFalha | tokenColor / classesOf / tokenOf / tokenOrThrow | função | `apps/web/src/__fixtures__/cor-das-classes.ts` | 5 |
| \_\_fixtures\_\_/importadores.ts (arquivo) | `__fixtures__/importers.ts` | arquivo | `apps/web/src/__fixtures__/importadores.ts` | 3 |
| importadoresDe / especificadoresDe / semComentarios / ArquivoDaWeb | importersOf / importSpecifiers / stripComments / WebFile | função / tipo | `apps/web/src/__fixtures__/importadores.ts` | 2 |
| \_\_fixtures\_\_/perigo-cheio.ts (arquivo) | `__fixtures__/danger-solid.ts` | arquivo | `apps/web/src/__fixtures__/perigo-cheio.ts` | 5 |
| usaOPerigoCheio / arquivosDeCodigoDaWeb / arquivosQueUsamOPerigoCheio / codigoSemComentarioNemTexto | usesDangerSolid / webSourceFiles / filesUsingDangerSolid / codeWithoutCommentsOrText | função | `apps/web/src/__fixtures__/perigo-cheio.ts` | 2 |
| \_\_fixtures\_\_/ids-do-desenho.ts (arquivo) | `__fixtures__/svg-ids.ts` | arquivo | `apps/web/src/__fixtures__/ids-do-desenho.ts` | 3 |
| `semIdsDoDesenho` | `stripSvgIds` | função | `apps/web/src/__fixtures__/ids-do-desenho.ts` | 4 |
| operacao/\_\_fixtures\_\_/tela-da-operacao.tsx (arquivo) | `operacao/__fixtures__/render-operacao-screen.tsx` | arquivo | `apps/web/src/operacao/__fixtures__/tela-da-operacao.tsx` | 9 |
| prepararTelaDaOperacao / renderizarTelaDaOperacao / TelaDaOperacao | setupOperacaoScreen / renderOperacaoScreen / OperacaoScreen | função / tipo | `apps/web/src/operacao/__fixtures__/tela-da-operacao.tsx` | 3 |
| `AUTORIZACAO_DE_OPERADOR_DE_TESTE` | `OPERATOR_TEST_AUTHORIZATION` | constante | `apps/web/src/operacao/__fixtures__/tela-da-operacao.tsx` | 3 |

## 12. e2e: fixtures, helpers e page objects (`e2e/` e `playwright.config.ts`)

**Regra:** a pasta `e2e/__fixtures__/` guarda helpers e page objects, e só `perfis.ts` é fixture no sentido do Playwright (`test.extend`): o nome da pasta muda; arquivos e símbolos genéricos tomam o vocabulário do Playwright (`gate`, `mockApi`, `profile`); helpers de dado de domínio (`criarEscolaSintetica`, `semearPainel`, `montarEscolaComEntregas`) ficam. O texto do `describe`/`test` fica em português.

| Atual | Proposto | Tipo | Onde (caminho) | Usos |
|---|---|---|---|---|
| e2e/\_\_fixtures\_\_ (pasta) | e2e/support | pasta | `e2e/__fixtures__/` | 81 |
| perfis.ts (arquivo; a `test.extend`) | profiles.ts | arquivo | `e2e/__fixtures__/perfis.ts` | 91 |
| PerfilDeMaquina / CondicaoDeRede / OpcoesDoPerfil | MachineProfile / NetworkCondition / ProfileOptions | tipo | `e2e/__fixtures__/perfis.ts` | 2 |
| PERFIL\_CHROMEBOOK / PERFIL\_CELULAR | CHROMEBOOK\_PROFILE / MOBILE\_PROFILE | constante | `e2e/__fixtures__/perfis.ts` | 2 |
| opção `perfil` (use do projeto; 2 arquivos: playwright.config.ts e perfis.ts) | `profile` | opção Playwright | `playwright.config.ts; e2e/__fixtures__/perfis.ts` | — |
| `carregarSemRedeLenta` | `loadUnthrottled` | helper | `e2e/__fixtures__/perfis.ts` | 13 |
| verificacoes.ts (arquivo) | checks.ts | arquivo | `e2e/__fixtures__/verificacoes.ts` | 79 |
| violacoesGraves / larguraExcedente / focoVisivel / codigoCru | seriousViolations / horizontalOverflow / isFocusVisible / rawCodePattern | helper | `e2e/__fixtures__/verificacoes.ts` | 70 |
| ViolacaoGrave / TAGS\_WCAG / IMPACTOS\_QUE\_REPROVAM | SeriousViolation / WCAG\_TAGS / FAILING\_IMPACTS | tipo / constante | `e2e/__fixtures__/verificacoes.ts` | 1 |
| paginas.ts (arquivo) | `html-pages.ts` | arquivo | `e2e/__fixtures__/paginas.ts` | 1 |
| PAGINA\_\* (9 páginas HTML de teste) | PAGE_* → HTML_PAGE_* (`PAGINA_MAIS_LARGA` → `WIDE_PAGE`) | constante | `e2e/__fixtures__/paginas.ts` | 2 |
| consultas.ts (arquivo) | `query-cache.ts` | arquivo | `e2e/__fixtures__/consultas.ts` | 5 |
| cacheDeConsultas / ConsultaNoCache | queryCache / CachedQuery | helper / tipo | `e2e/__fixtures__/consultas.ts` | 6 |
| galeria.ts (arquivo) | `gallery.ts` | arquivo | `e2e/__fixtures__/galeria.ts` | 14 |
| abrirGaleria / PRAZO\_DA\_GALERIA\_MS / medirBlocosDaGaleria / secao | openGallery / GALLERY\_TIMEOUT\_MS / measureGalleryBlocks / gallerySection | helper | `e2e/__fixtures__/galeria.ts` | 13 |
| segundo-fator.ts (arquivo) | `mfa.ts` | arquivo | `e2e/__fixtures__/segundo-fator.ts` | 13 |
| SegundoFatorConfigurado / configurarSegundoFator / entrarComSegundoFator | ConfiguredMfa / setUpMfa / signInWithMfa | tipo / helper | `e2e/__fixtures__/segundo-fator.ts` | 3 |
| sessao.ts (arquivo; 1327 linhas de fábricas/seed) | seed.ts | arquivo | `e2e/__fixtures__/sessao.ts` | 67 |
| a2.ts (arquivo) | db-assertions.ts (a2 é código de fatia) | arquivo | `e2e/__fixtures__/a2.ts` | 3 |
| a3.ts (arquivo) | atividade-db.ts (a3 é código de fatia) | arquivo | `e2e/__fixtures__/a3.ts` | 3 |
| dado-na-tela.ts (arquivo) | `screen-data-watch.ts` | arquivo | `e2e/__fixtures__/dado-na-tela.ts` | 1 |
| vigiarODado / instanteGravado | watchData / recordedInstant | helper | `e2e/__fixtures__/dado-na-tela.ts` | 2 |
| ApiDoAluno / simularAluno | AlunoApiMock / mockAlunoApi | classe / helper | `e2e/__fixtures__/aluno.ts` | 6 |
| ApiDoAssistente / simularAssistente | AssistenteApiMock / mockAssistenteApi | classe / helper | `e2e/__fixtures__/assistente.ts` | 9 |
| `ProfessoraPelaApi` | `ProfessoraApiClient` | classe | `e2e/__fixtures__/a3.ts` | 3 |
| `erroDaApi` | `apiError` | helper | `e2e/__fixtures__/assistente.ts` | 12 |
| `portao` | gate (cópia em `professor/sino.ts`) | helper | `e2e/__fixtures__/assistente.ts` | 16 |
| `acionar` | activate (cópias em galeria.ts, fluxo-do-professor.ts, tela-da-operacao.ts, professor/cena.ts) | helper | `e2e/__fixtures__/fluxo-do-professor.ts` | 32 |
| PRAZO\_DA\_ENTRADA\_MS / PRAZO\_DA\_IA\_MS / PRAZO\_DA\_TELA\_MS | SIGN\_IN\_TIMEOUT\_MS / AI\_TIMEOUT\_MS / SCREEN\_TIMEOUT\_MS | constante | `e2e/__fixtures__/casca.ts, tela-da-operacao.ts, fluxo-do-professor.ts, professor/cena.ts` | 64 |
| professor/cena.ts (arquivo) | `professor/scenario.ts` | arquivo | `e2e/__fixtures__/professor/cena.ts` | 18 |
| Cena / CenaDoSino / prepararCena | Scenario / SinoScenario / setupScenario | tipo / helper | `e2e/__fixtures__/professor/sino.ts e cena.ts` | 1 |
| fluxo-do-professor.ts (arquivo) | `professor-flow.ts` | arquivo | `e2e/__fixtures__/fluxo-do-professor.ts` | 14 |
| aluno-pela-api.ts (arquivo) | `aluno-api.ts` | arquivo | `e2e/__fixtures__/aluno-pela-api.ts` | 3 |
| tela-da-operacao.ts (arquivo) | `operacao-screen.ts` | arquivo | `e2e/__fixtures__/tela-da-operacao.ts` | 9 |
| memoria-do-aluno.ts (arquivo) | `tutor-memory.ts` | arquivo | `e2e/__fixtures__/memoria-do-aluno.ts` | 2 |
| pecas-\*.spec.ts (9 specs do kit: botoes, campos, estado, galeria, ia, marca-icones, marca-onca, sobrepor, superficies) | components-*.spec.ts (`pecas-botoes` → `components-button.spec.ts`…) | arquivo | `e2e/pecas-*.spec.ts` | 35 |
| introducao-pecas.spec.ts (arquivo) | `introducao-components.spec.ts` | arquivo | `e2e/introducao-pecas.spec.ts` | — |

## 13. Pastas

**Regra:** pasta técnica ganha o nome de mercado; pasta de domínio (as de `areas/`, `meus-dados/`, `pedidos/`, `introducao/`, `sino/`, `operacao/`) fica.

| Atual | Proposto | Tipo | Onde (caminho) | Usos |
|---|---|---|---|---|
| `apps/web/src/componentes/` | `components/` | pasta | `apps/web/src/componentes/` | 151 |
| `componentes/estado/` | `components/states/` | pasta | `apps/web/src/componentes/estado/` | 61 |
| `componentes/ajustes/` | `components/settings/` | pasta | `apps/web/src/componentes/ajustes/` | 3 |
| `componentes/ui/campos/` | `components/ui/fields/` | pasta | `apps/web/src/componentes/ui/campos/` | 39 |
| `componentes/ui/ia/` | `components/ui/ai/` | pasta | `apps/web/src/componentes/ui/ia/` | 27 |
| `componentes/ui/icones/` | `components/ui/icons/` | pasta | `apps/web/src/componentes/ui/icones/` | 4 |
| `componentes/ui/sobrepostos/` | `components/ui/overlays/` | pasta | `apps/web/src/componentes/ui/sobrepostos/` | 42 |
| `apps/web/src/paginas/` | pages/ (inclui `operacao/paginas/` → `operacao/pages/`) | pasta | `apps/web/src/paginas/; apps/web/src/operacao/paginas/` | 3 |
| `operacao/componentes/` | `operacao/components/` | pasta | `apps/web/src/operacao/componentes/` | 9 |
| `apps/web/src/sessao/` | fica (`sessao` é domínio; §2 do inventário) | pasta | `apps/web/src/sessao/` | 1 |
| apps/web/src/galeria/ (+ `secoes/`) | gallery/ (+ `sections/`) | pasta | `apps/web/src/galeria/` | 1 |
| `areas/*/comum/` | fica (`areas/` não muda; §2 do inventário) | pasta | `apps/web/src/areas/coordenacao/comum/; apps/web/src/areas/professor/comum/` | 38 |

## 14. Arquivos (renomeação própria, sem símbolo equivalente)

**Regra:** o `.test.ts(x)` acompanha o arquivo; `knip.json`, `eslint-suppressions.json`, `nome-dos-chunks.ts` e `tools/` citam estes caminhos (ver "Não muda, mas parece").

| Atual | Proposto | Tipo | Onde (caminho) | Usos |
|---|---|---|---|---|
| `ui/barra.ts` | `ui/progress.ts` | arquivo | `apps/web/src/componentes/ui/barra.ts` | 2 |
| `ui/teclado-das-abas.ts` | `ui/tabs-keyboard.ts` | arquivo | `apps/web/src/componentes/ui/teclado-das-abas.ts` | 2 |
| `ui/campos/seletor.ts` | `ui/fields/field-styles.ts` | arquivo | `apps/web/src/componentes/ui/campos/seletor.ts` | 9 |
| `ui/campos/texto-longo.ts` | `ui/fields/text-limits.ts` | arquivo | `apps/web/src/componentes/ui/campos/texto-longo.ts` | 6 |
| `ui/botao-secundario.ts` | `ui/button-variants.ts` | arquivo | `apps/web/src/componentes/ui/botao-secundario.ts` | 45 |
| `ui/midia.ts` | `ui/media-query.ts` | arquivo | `apps/web/src/componentes/ui/midia.ts` | 10 |
| `estado/index.ts` | `states/index.ts` | arquivo | `apps/web/src/componentes/estado/index.ts` | — |
| `componentes/lateral-recolhida.ts` | (fica: lateral é termo da casca) | arquivo | `apps/web/src/componentes/lateral-recolhida.ts` | — |
| `galeria/Galeria.tsx` | gallery/Gallery.tsx (`Galeria` → `Gallery`) | arquivo | `apps/web/src/galeria/Galeria.tsx` | 2 |
| `galeria/Secao.tsx` | gallery/GallerySection.tsx (`Secao` → `GallerySection`) | arquivo | `apps/web/src/galeria/Secao.tsx` | 11 |
| `galeria/dados.ts` | `gallery/sample-data.ts` | arquivo | `apps/web/src/galeria/dados.ts` | 4 |
| `galeria/secoes/{botoes,campos,estado,ia,marca-icones,sobrepor,superficies,tamanho-da-letra}.tsx` | `sections/{buttons,fields,states,ai,brand-icons,overlays,surfaces,text-size}.tsx` | arquivo | `apps/web/src/galeria/secoes/` | — |
| apps/web/nome-dos-chunks.ts (+ `.test.ts`) | `chunk-names.ts` | arquivo | `apps/web/nome-dos-chunks.ts` | 14 |
| apps/web/rebaixar-cor.ts (+ `.test.ts`); `pluginRebaixarCor` / `rebaixarColorMix` | downlevel-color.ts; `downlevelColorPlugin` / `downlevelColorMix` | arquivo | `apps/web/rebaixar-cor.ts` | 4 |
| nome-dos-chunks.ts: AREAS\_DA\_ESCOLA / AreaDaEscola / PECAS\_FORA\_DA\_ENTRADA / nomeDoChunk / TETO\_DE\_UMA\_TELA\_EM\_BYTES / TETO\_DO\_PRIMEIRO\_CARREGAMENTO\_EM\_BYTES | SCHOOL\_AREAS / SchoolArea / LAZY\_COMPONENTS / chunkFileName / SCREEN\_BUDGET\_BYTES / FIRST\_LOAD\_BUDGET\_BYTES | constante | `apps/web/nome-dos-chunks.ts` | 4 |
## 15. Apêndice — consultas e chaves do TanStack Query (em `api/` e em `areas/**/api/`, 85 exports)

Os 57 `consultaX` são `queryOptions(...)` (ou função que devolve um) e viram `xQueryOptions`, o nome da documentação do TanStack ("Query Options"). As 28 `CHAVE_X` viram `X_QUERY_KEY`; o **valor** da chave (`['alunos-da-turma']`) não muda. Pasta `api/` já tem nome de mercado e fica; os arquivos por recurso dentro dela (`alunos-da-turma.ts`, `pedidos.ts`…) são domínio e ficam.

### `consulta*` → `*QueryOptions`

| Atual | Proposto | Tipo | Onde (caminho) | Usos |
|---|---|---|---|---|
| `consultaAlunosDaTurma` | `alunosDaTurmaQueryOptions` | queryOptions | `apps/web/src/api/alunos-da-turma.ts` | 2 |
| `consultaMinhasAtividades` | `minhasAtividadesInfiniteQueryOptions` | queryOptions | `apps/web/src/api/atividades-do-aluno.ts` | 5 |
| `consultaProva` | `provaQueryOptions` | queryOptions | `apps/web/src/api/atividades-do-aluno.ts` | 3 |
| `consultaMeuDiagnostico` | `meuDiagnosticoQueryOptions` | queryOptions | `apps/web/src/api/atividades-do-aluno.ts` | 2 |
| `consultarConvite` | fica (`fetch` comum, não `queryOptions`; 10.0) | função (`fetch`) | `apps/web/src/api/convite.ts` | 2 |
| `consultaAcessoDaEscola` | `acessoDaEscolaQueryOptions` | queryOptions | `apps/web/src/api/escola.ts` | 2 |
| `consultaAnosLetivos` | `anosLetivosQueryOptions` | queryOptions | `apps/web/src/api/estrutura.ts` | 8 |
| `consultaSeries` | `seriesQueryOptions` | queryOptions | `apps/web/src/api/estrutura.ts` | 4 |
| `consultaDisciplinas` | `disciplinasQueryOptions` | queryOptions | `apps/web/src/api/estrutura.ts` | 6 |
| `consultaTurmas` | `turmasQueryOptions` | queryOptions | `apps/web/src/api/estrutura.ts` | 9 |
| `consultaVinculos` | `vinculosQueryOptions` | queryOptions | `apps/web/src/api/estrutura.ts` | 8 |
| `consultaTurmaAberta` | `turmaAbertaQueryOptions` | queryOptions | `apps/web/src/api/estrutura.ts` | 4 |
| `consultaEu` | `euQueryOptions` | queryOptions | `apps/web/src/api/eu.ts` | 18 |
| `consultaExecucao` | `execucaoQueryOptions` | queryOptions | `apps/web/src/api/execucoes.ts` | 1 |
| `consultaMemoriaDoTutor` | `memoriaDoTutorQueryOptions` | queryOptions | `apps/web/src/api/memoria-do-tutor.ts` | 2 |
| `consultaMeusDados` | `meusDadosQueryOptions` | queryOptions | `apps/web/src/api/meus-dados.ts` | 2 |
| `consultaMinhaTurma` | `minhaTurmaQueryOptions` | queryOptions | `apps/web/src/api/minha-turma.ts` | 2 |
| `consultaPedidosDaTurma` | `pedidosDaTurmaQueryOptions` | queryOptions | `apps/web/src/api/pedidos.ts` | 5 |
| `consultaContagemDePedidos` | `contagemDePedidosQueryOptions` | queryOptions | `apps/web/src/api/pedidos.ts` | 3 |
| `consultaAvisos` | `avisosQueryOptions` | queryOptions | `apps/web/src/api/sistema.ts` | 2 |
| `consultaEstado` | `estadoQueryOptions` | queryOptions | `apps/web/src/api/sistema.ts` | 2 |
| `consultaConversaDoTutor` | `conversaDoTutorQueryOptions` | queryOptions | `apps/web/src/api/tutor.ts` | 2 |
| `consultaListaDaTurma` | `listaDaTurmaQueryOptions` | queryOptions | `apps/web/src/areas/coordenacao/estrutura/api/lista.ts` | 4 |
| `consultaResumoDoAnalista` | `resumoDoAnalistaQueryOptions` | queryOptions | `apps/web/src/areas/coordenacao/governanca/api/governanca.ts` | 2 |
| `consultaResumoDaGovernanca` | `resumoDaGovernancaQueryOptions` | queryOptions | `apps/web/src/areas/coordenacao/governanca/api/governanca.ts` | 3 |
| `consultaResumoPorEstado` | `resumoPorEstadoQueryOptions` | queryOptions | `apps/web/src/areas/coordenacao/governanca/api/governanca.ts` | 2 |
| `consultaPrimeiraPaginaDoResumo` | `primeiraPaginaDoResumoQueryOptions` | queryOptions | `apps/web/src/areas/coordenacao/governanca/api/governanca.ts` | 2 |
| `consultaConsumo` | `consumoQueryOptions` | queryOptions | `apps/web/src/areas/coordenacao/governanca/api/governanca.ts` | 3 |
| `consultaFuncoesDaGovernanca` | `funcoesDaGovernancaQueryOptions` | queryOptions | `apps/web/src/areas/coordenacao/governanca/api/governanca.ts` | 3 |
| `consultaMateriais` | `materiaisQueryOptions` | queryOptions | `apps/web/src/areas/coordenacao/material/api/material.ts` | 5 |
| `consultaPreviaDoTitular` | `previaDoTitularQueryOptions` | queryOptions | `apps/web/src/areas/coordenacao/privacidade/api/privacidade.ts` | 2 |
| `consultaPedidoDoTitular` | `pedidoDoTitularQueryOptions` | queryOptions | `apps/web/src/areas/coordenacao/privacidade/api/privacidade.ts` | 2 |
| `consultaRetencao` | `retencaoQueryOptions` | queryOptions | `apps/web/src/areas/coordenacao/privacidade/api/privacidade.ts` | 2 |
| `consultaSuboperadores` | `suboperadoresQueryOptions` | queryOptions | `apps/web/src/areas/coordenacao/privacidade/api/privacidade.ts` | 3 |
| `consultaIncidentes` | `incidentesQueryOptions` | queryOptions | `apps/web/src/areas/coordenacao/privacidade/api/privacidade.ts` | 5 |
| `consultaPedidosDoTitular` | `pedidosDoTitularQueryOptions` | queryOptions | `apps/web/src/areas/coordenacao/privacidade/api/privacidade.ts` | 4 |
| `consultaProfessores` | `professoresQueryOptions` | queryOptions | `apps/web/src/areas/coordenacao/professores/api/professores.ts` | 7 |
| `consultaArtefatos` | `artefatosQueryOptions` | queryOptions | `apps/web/src/areas/professor/artefatos/api/artefatos.ts` | 3 |
| `consultaArtefato` | `artefatoQueryOptions` | queryOptions | `apps/web/src/areas/professor/artefatos/api/artefatos.ts` | 4 |
| `consultaEntregasPendentes` | `entregasPendentesQueryOptions` | queryOptions | `apps/web/src/areas/professor/artefatos/api/entregas.ts` | 2 |
| `consultaEntregas` | `entregasQueryOptions` | queryOptions | `apps/web/src/areas/professor/artefatos/api/entregas.ts` | 3 |
| `consultaEntregasDaTurma` | `entregasDaTurmaQueryOptions` | queryOptions | `apps/web/src/areas/professor/artefatos/api/entregas.ts` | 2 |
| `consultaTitulosDosMateriais` | `titulosDosMateriaisQueryOptions` | queryOptions | `apps/web/src/areas/professor/artefatos/api/titulos-dos-materiais.ts` | 5 |
| `consultaConversaDoAssistente` | `conversaDoAssistenteQueryOptions` | queryOptions | `apps/web/src/areas/professor/assistente/api/assistente.ts` | 2 |
| `consultaTime` | `timeQueryOptions` | queryOptions | `apps/web/src/areas/professor/assistente/api/time.ts` | 7 |
| `consultaAtividadesAplicadas` | `atividadesAplicadasQueryOptions` | queryOptions | `apps/web/src/areas/professor/atividades/api/atividades.ts` | 8 |
| `consultaCorrecaoDoLote` | `correcaoDoLoteQueryOptions` | queryOptions | `apps/web/src/areas/professor/atividades/api/atividades.ts` | 2 |
| `consultaDesempenhoDaTurma` | `desempenhoDaTurmaQueryOptions` | queryOptions | `apps/web/src/areas/professor/atividades/api/atividades.ts` | 3 |
| `consultaMeusVinculos` | `meusVinculosQueryOptions` | queryOptions | `apps/web/src/areas/professor/comum/api/vinculos.ts` | 13 |
| `consultaAcessoDaTurma` | `acessoDaTurmaQueryOptions` | queryOptions | `apps/web/src/areas/professor/turmas/api/acesso.ts` | 4 |
| `consultaSinais` | `sinaisQueryOptions` | queryOptions | `apps/web/src/areas/professor/turmas/api/tutor-da-turma.ts` | 3 |
| `consultaUsoDoTutor` | `usoDoTutorQueryOptions` | queryOptions | `apps/web/src/areas/professor/turmas/api/tutor-da-turma.ts` | 2 |
| `consultarConviteDeOperador` | fica (`fetch` comum, não `queryOptions`; 10.0) | função (`fetch`) | `apps/web/src/operacao/api/convite.ts` | 2 |
| `consultaEuDoOperador` | `euDoOperadorQueryOptions` | queryOptions | `apps/web/src/operacao/api/eu.ts` | 2 |
| `consultaDasEscolas` | `dasEscolasQueryOptions` | queryOptions | `apps/web/src/operacao/api/painel.ts` | 2 |
| `consultaDoUso` | `doUsoQueryOptions` | queryOptions | `apps/web/src/operacao/api/painel.ts` | 2 |
| `consultaDasRedes` | `dasRedesQueryOptions` | queryOptions | `apps/web/src/operacao/api/painel.ts` | 2 |

### `CHAVE_*` → `*_QUERY_KEY`

| Atual | Proposto | Tipo | Onde (caminho) | Usos |
|---|---|---|---|---|
| `CHAVE_DOS_ALUNOS_DA_TURMA` | `ALUNOS_DA_TURMA_QUERY_KEY` | query key | `apps/web/src/api/alunos-da-turma.ts` | 2 |
| `CHAVE_DAS_MINHAS_ATIVIDADES` | `MINHAS_ATIVIDADES_QUERY_KEY` | query key | `apps/web/src/api/chaves-do-aluno.ts` | 5 |
| `CHAVE_DA_PROVA` | `PROVA_QUERY_KEY` | query key | `apps/web/src/api/chaves-do-aluno.ts` | 2 |
| `CHAVE_DO_MEU_DIAGNOSTICO` | `MEU_DIAGNOSTICO_QUERY_KEY` | query key | `apps/web/src/api/chaves-do-aluno.ts` | 2 |
| `CHAVE_DA_CONVERSA_DO_TUTOR` | `CONVERSA_DO_TUTOR_QUERY_KEY` | query key | `apps/web/src/api/chaves-do-aluno.ts` | 3 |
| `CHAVE_DA_MEMORIA_DO_TUTOR` | `MEMORIA_DO_TUTOR_QUERY_KEY` | query key | `apps/web/src/api/chaves-do-aluno.ts` | 3 |
| `CHAVE_DAS_ATIVIDADES` | `ATIVIDADES_QUERY_KEY` | query key | `apps/web/src/api/chaves-do-professor.ts` | 2 |
| `CHAVE_DA_CORRECAO` | `CORRECAO_QUERY_KEY` | query key | `apps/web/src/api/chaves-do-professor.ts` | 2 |
| `CHAVE_DO_DESEMPENHO` | `DESEMPENHO_QUERY_KEY` | query key | `apps/web/src/api/chaves-do-professor.ts` | 2 |
| `CHAVE_DOS_SINAIS` | `SINAIS_QUERY_KEY` | query key | `apps/web/src/api/chaves-do-professor.ts` | 2 |
| `CHAVE_DO_USO_DO_TUTOR` | `USO_DO_TUTOR_QUERY_KEY` | query key | `apps/web/src/api/chaves-do-professor.ts` | 3 |
| `CHAVE_DO_TIME` | `TIME_QUERY_KEY` | query key | `apps/web/src/api/chaves-do-professor.ts` | 2 |
| `CHAVE_DA_CONVERSA` | `CONVERSA_QUERY_KEY` | query key | `apps/web/src/api/chaves-do-professor.ts` | 3 |
| `CHAVE_DOS_ARTEFATOS` | `ARTEFATOS_QUERY_KEY` | query key | `apps/web/src/api/chaves-do-professor.ts` | 6 |
| `CHAVE_DAS_ENTREGAS` | `ENTREGAS_QUERY_KEY` | query key | `apps/web/src/api/chaves-do-professor.ts` | 4 |
| `CHAVE_DAS_EXECUCOES` | `EXECUCOES_QUERY_KEY` | query key | `apps/web/src/api/chaves-do-professor.ts` | 2 |
| `CHAVE_DA_ESTRUTURA` | `ESTRUTURA_QUERY_KEY` | query key | `apps/web/src/api/estrutura.ts` | 5 |
| `CHAVE_DE_MEUS_DADOS` | `MEUS_DADOS_QUERY_KEY` | query key | `apps/web/src/api/meus-dados.ts` | 1 |
| `CHAVE_DA_GOVERNANCA` | `GOVERNANCA_QUERY_KEY` | query key | `apps/web/src/areas/coordenacao/governanca/api/governanca.ts` | 1 |
| `CHAVE_DO_ANALISTA` | `ANALISTA_QUERY_KEY` | query key | `apps/web/src/areas/coordenacao/governanca/api/governanca.ts` | 1 |
| `CHAVE_DO_MATERIAL` | `MATERIAL_QUERY_KEY` | query key | `apps/web/src/areas/coordenacao/material/api/material.ts` | 1 |
| `CHAVE_DA_PRIVACIDADE` | `PRIVACIDADE_QUERY_KEY` | query key | `apps/web/src/areas/coordenacao/privacidade/api/privacidade.ts` | 1 |
| `CHAVE_DA_LATERAL_RECOLHIDA` | fica neste §15 (vale o §10: `SIDEBAR_COLLAPSED_STORAGE_KEY`) | query key | `apps/web/src/componentes/lateral-recolhida.ts` | 2 |
| `CHAVE_DA_LETRA` | fica neste §15 (vale o §10: `TEXT_SIZE_STORAGE_KEY`) | query key | `apps/web/src/letra.ts` | 3 |
| `CHAVE_DAS_ESCOLAS` | `ESCOLAS_QUERY_KEY` | query key | `apps/web/src/operacao/api/painel.ts` | 4 |
| `CHAVE_DAS_REDES` | `REDES_QUERY_KEY` | query key | `apps/web/src/operacao/api/painel.ts` | 2 |
| `CHAVE_DO_USO` | `USO_QUERY_KEY` | query key | `apps/web/src/operacao/api/painel.ts` | 2 |
| `CHAVE_DA_APARENCIA` | fica neste §15 (vale o §10: `THEME_STORAGE_KEY`) | query key | `apps/web/src/tema.ts` | 1 |

## Dúvidas

Fechadas em `inventario.md` §2. Onde a decisão de lá difere do que estava proposto, a tabela acima já traz o nome decidido.

## Ficam (casca e telas)

CascaDaEscola, CascaPublica, CascaEmFoco, CascaDaOperacao, Casca (paginas/), MenuDaPessoa, BarraDeBaixo, SeletorDeEscola, TurmaIndisponivel, LateralRecolhida/itens-da-lateral (a lateral é termo da casca), Sino (Sino, SinoDoProfessor, SinoDaCoordenacao), Comemoracao, Balao, Introducao, IntroducaoDoPapel, OndeFicaCadaCoisa, TelaDeFoco, Linhas (passos da introdução), BemVindo, Onca, CabecaOnca (a mascote: `componentes/ui/onca/` inteira), MeusDados, ListaDePedidos, as telas de `paginas/` (Entrar, EntrarNaEscola, EscolherEscola, Inicio, Convite, Mfa, ConfigurarMfa, SemDesafio, AcessoSuspenso, TurmaPublica), as telas e pastas de `areas/{aluno,professor,coordenacao}/**` (Atividade, Atividades, Tutor, Eu, Inicio, Turmas, Turma, Aprovar, Ferramentas, Ferramenta, Criados, Artefato, Time, Home, Escola, Registros, Estrutura, Governanca, Privacidade, Material, Professores, Painel…), as telas e pastas de `operacao/` (Escolas, Uso, NovaEscola, NovaRede, Entrar, Mfa, ConfigurarMfa, Convite), os hooks de domínio (`useIntroducao`, `useFilaDoProfessor`, `useFilaDaCoordenacao`, `useCorrigirDeNovo`, `useConfirmarIncidente`, `useIdDoDesenho`, `useAcenarNaPrimeiraVez`), os arquivos de API por recurso (`alunos-da-turma.ts`, `pedidos.ts`, `salas.ts`, `tutor.ts`, `convite.ts`, `escola.ts`, `estrutura.ts`, `minha-turma.ts`, `meus-dados.ts`, `mfa.ts`, `eu.ts`, `sistema.ts`, `atividades-do-aluno.ts`, `memoria-do-tutor.ts`), `link-do-convite.ts`, `pedido-de-convite.ts`, `textos-do-convite.ts`, `meus-dados/regras.ts`, `pedidos/*`, os `textos*.ts`, `galeria/secoes/{introducao,sino,marca-onca}.tsx`, e no e2e os arquivos de domínio de `e2e/__fixtures__` (`aluno.ts`, `assistente.ts`, `casca.ts`, `coordenacao.ts`, `governanca.ts`, `material.ts`, `operacao.ts`, `painel.ts`, `pedidos-do-titular.ts`, `roteiro.ts`, `avatar.ts`, `professor/{aprovar,criados,entregas,sino,tutor}.ts`) e os 100+ `*.spec.ts` de tela (só os `pecas-*.spec.ts` entram, por serem do kit).

## Não muda, mas parece

- **Valores de prop em português**, usados nos testes e no e2e: `variante` (`primario`, `oficial`, `secundario`, `discreto`, `perigo`), `tamanho` (`principal`, `compacto`, `icone`), `tom` (`info`, `atencao`, `erro`, `certo`), `familia` (`pendente`, `ok`, `erro`, `info`; e as dez de cor: `laranja`, `azul`, `verde`, `amarelo`, `vermelho`, `roxo`, `turquesa`, `anil`, `lima`, `rosa`), `largura` da `Tela` (`conversa`, `leitura`, `formulario`, `grade`), `alinhamento` (`inicio`, `fim`), `variante` da `Selecao` (`campo`, `pilula`), `estado` da `CaixaPedido` (`pronta`, `gerando`, `desligada`), `estado` do `MotorFormulario` (`formulario`, `gerando`, `pronto`), `nivel`.
- **Props em português** (`aoMudar`, `aoFechar`, `aoEnviar`, `rotulo`, `desligado`, `selecionado`, `marcada`, `refDoTitulo`, `tituloSoParaLeitor`, `emDuasColunasNoCelular`, `focoDeReserva`…): ficam, como mandou o recorte.
- **CSS e tokens** (mexer muda o CSS): as ~119 variáveis de `estilos.css` (`--color-borda-campo`, `--color-azul-texto`, `--color-fundo-suave`…, `--barra-baixo`, `--lado`, `--altura-degrau`, `--faixa-de-incidente`), as utilidades do Tailwind geradas por elas (`bg-fundo-suave`, `text-tinta`, `text-sutil`, `text-apoio`, `border-borda-campo`, `rounded-cartao`, `rounded-controle`, `rounded-botao`, `rounded-selo`, `shadow-flutua`) e as classes do projeto (`t-corpo`, `t-cartao`, `t-selo`, `t-rotulo`, `t-apoio`, `t-titulo`, `t-numero`, `degrau`, `degrau-azul`, `degrau-borda`…). O arquivo `estilos.css` em si muda de nome (tabela); o conteúdo não.
- **Atributos `data-*` que o e2e usa como seletor**: `data-galeria`, `data-estado`, `data-icone`, `data-comemoracao`, `data-tabela="lista"`, `data-selo-ia`, `data-sessao-vencida`, `data-letra`, `data-tema`, `data-ladrilho`, `data-aviso`, `data-aviso-fila`, `data-contador`, `data-tela`, `data-tela-de-foco`, `data-barra-de-baixo`, `data-cartao-de-ferramenta`, `data-assinatura`, `data-agente`, `data-onca`, `data-pose`, `data-motor`, `data-escolha`, `data-aprovacao`, `data-campo`, `data-parte`, `data-ancora-do-sino`, `data-pe-do-sino`, `data-funcao-suspensa`, `data-resumo-do-analista`. Vários levam o nome do componente (`data-ladrilho`, `data-contador`, `data-tabela`, `data-motor`): **não acompanham o rename** (mudar exige mexer em ~100 specs).
- **Nomes acessíveis e textos usados em `getByRole`/`getByLabel`/`getByText`** no e2e (`'Seções'`, `'Menu'`, `'Esperando você'`, `'Acompanhar a IA'`, `'Pedido ao Assistente de ensino'`, `'Conversa com o Assistente de ensino'`, `'Ano letivo e disciplinas'`, `'O que falta'`, `'O que o Tutor viu'`, `'Registrar pedido de titular'`): são texto de tela.
- **Valores de chave persistida e endereços**: `'educa.aparencia'`, `'educa.letra'`, `'educa.lateral-recolhida'`, o lock `'educa-renovacao'`, os valores das query keys (`['alunos-da-turma']`, `['minha-atividade','prova']`…), os caminhos `/v1/…` (`CAMINHO_DA_SESSAO` e os outros `CAMINHO_DO_…` de `api/`), as rotas `/nova-conversa`, `/turmas/:turmaId`, `/galeria`, `/operacao`, e os nomes de papel (`coordenador`, `professor`, `aluno`). Mudam as constantes (`CHAVE_…` → `…_QUERY_KEY`), não o valor.
- **Palavras de domínio que parecem técnicas**: `Fila` (fila de respostas do aluno, fila "Esperando você" do sino), `Execucao`, `Sessao`, `Entrega`, `Artefato`, `Ferramenta` (D74), `Time`, `Analista`, `Moldura` (só se `comum/` ficar), `Conversa` das telas (`areas/professor/assistente/Conversa.tsx`; só o `Conversa` do kit vira `Conversation`), `Registros`, `Escola`.
- **O `Estado` exportado por `SeloDeEstado.tsx`** não é o `estado/` (EstadoVazio…): o comentário do arquivo explica que foi o homônimo que impediu o nome do arquivo.
- **A fixture `tools/guardas/__fixtures__/kit-importa-api.ts`**: os imports irmãos (`./Botao`, `./campos/Campo`, `./sobrepostos/Dialogo`) e os nomes que eles trazem são virtuais e não resolvem a arquivo. A regra do kit olha só a forma do caminho (`../../../api/`, irmão `./`). Ficam, como `fica`, nas ondas 6.0 e 9.0.
- **Homônimo e texto virtual na 9.0**: (a) o mesmo nome de uma peça do kit em outra declaração, como o parâmetro de tipo `Linha` de `Table<Linha>` e de `paginar<Linha>`, a variável local `Icone`, o tipo `Aviso` de `@educa/shared`, o `Estado` e a `Escolha` locais, o componente `Linha` de `areas/*/comum/pecas-da-lista` e as `PropsDo…` de peças fora do kit; (b) o comentário que cita o nome do arquivo de tela, como `import('./Tela')` e `tela-<pasta>-<Tela>-*.js`; (c) `apps/web/src/Tela.tsx` e `areas/x/Tela.tsx` em `tools/processo/{linhas,mutacoes}.test.ts`, arquivos inventados; (d) o comentário e o `'**O avatar** (`AvatarAgente`)'` de `onca/*.test.tsx`, que procura essa linha em `docs/interface.md` (os testes da onça ficam sem diff, RF5, e o documento é da 13.0; o único diff da pasta é o import do kit em `Onca.tsx`, Tech Spec §5); (e) o comentário de `tools/ci/duracao-do-e2e.test.ts` que cita a troca `Campo` → `FormField` da 9.0 como exemplo de comentário trocado, texto de um caso de teste da correção `duracao-do-e2e-so-comentario`. Ficam, como `fica`, na 9.0.
- **Homônimo e texto na 10.0**: (a) o componente `Aparencia` e o componente `TamanhoDaLetra` (decisão 26 de `inventario.md`) têm o nome do tipo de `theme.ts` e de `text-size.ts` que a onda renomeia: o import do componente, o caminho `settings/TamanhoDaLetra`, o `describe` e o nome entre crases em comentário de e2e são do componente e ficam; (b) o rótulo `Tema` do campo de formulário (a ferramenta do professor, o `schema-form`, a conversa, os specs de e2e) é texto de tela, e não o tipo `Tema` de `theme.ts`; (c) o `semComentarios` de `tools/ci/duracao-do-e2e.ts`, com os testes dele, é outra função, que tem o nome do ajudante da web; (d) o título de `describe`/`it` e a mensagem de um `expect` que citam o nome antigo (regra geral 2); (e) `consultarConvite` e `consultarConviteDeOperador` (linhas 448 e 496), que são `fetch` comum e não `queryOptions`; (f) o mesmo nome em outra declaração, que o `aplicar` não renomeia por ser de outro arquivo ou pacote: `Falha` de `FronteiraDaArea`, `Moldura` e `textoDaFalha` de `DialogoDoConvite` e de `operacao/textos.ts`, `ItemDaNavegacao` de `CascaDaOperacao`, `tokenDoFragmento` de `operacao/pages/Convite.tsx`, `LinhaDoResumo` do kit, `BASE_DA_OPERACAO` de `routes.tsx`, `TOKEN_DE_TESTE` da fixture da operação, `SEM_CORPO` e `RespostaFalsa` locais de teste, `Tema` local de teste e o de `class-colors.ts` (o `aplicar` não aceita dois `Tema` no mesmo pacote), `semComentarios`, `tokenDe`, `ROTAS`, `Rotas` e `RotasDaOperacao` de `apps/api`, de `packages/core`, de `tools/` e de `e2e/`, `chamarApi` de `infra/scripts/carga-sala.ts`, `ESPERA_ENTRE_TENTATIVAS_MS` de `tools/testes/compose.ts`, e o import virtual de `tools/guardas/__fixtures__/kit-importa-api.ts`. Ficam, como `fica`, na 10.0.
- **Homônimo e texto na 11.0**: (a) o `portao` de `tools/processo/portao.ts` (o `PreToolUse`), o reexport em `revisoes.ts`, quem o importa em `tools/`, e o argumento `portao` do hook em `.claude/settings.json` e em `tools/processo/hook-revisoes.ts`: é o portão de revisões, não o ajudante do e2e; (b) a variável local `portao` de `apps/api/test/*.int.test.ts` e a palavra `portao` da regex de `packages/core/src/ia/tasks/turno-do-tutor.ts`; (c) o `perfil` que não é a opção do Playwright: o campo do valor de `sessoesDoPerfil` em `profiles.ts`, o parâmetro de `tempoMinimoDoPerfil` em `components-gallery.spec.ts` e a coluna `perfil` de `consumo_ia` em `e2e/support/governanca.ts`; (d) a classe `t-secao` citada no comentário de `apps/web/src/components/states/EmptyState.tsx` (CSS, item acima), que o passo 5 alcança pelo `secao` de `gallery.ts`; (e) `entrarComSegundoFator` (linha 374) é nome da web (`apps/web/src/api/sessao.ts`, onda 10.0) e não existe em `e2e/`: a 11.0 renomeia só `SegundoFatorConfigurado` e `configurarSegundoFator`. Ficam, como `fica`, na 11.0; a pasta inteira (`tools/`, `apps/api/test/`) pode ser a do `fica`.

## Acoplamentos fora do recorte (precisam acompanhar, mas são de `tools/`, `docs/` e configuração)

- `apps/web/nome-dos-chunks.ts` (no recorte) tem **strings de caminho**: `PASTA_DAS_PECAS_DE_IA = '/apps/web/src/componentes/ui/ia/'`, `PASTA_DOS_COMPONENTES`, `PASTA_DA_GALERIA`, a regex `…/areas/<pasta>/rotas\.tsx?$` e a lista `PECAS_FORA_DA_ENTRADA` (38 caminhos como `ui/Abas`, `ui/sobrepostos/Menu`). O rename do kit e de `rotas.tsx` quebra o nome dos chunks (`pecas-*.js`, `<pasta>-*.js`) e o teto do primeiro carregamento se isto não acompanhar, e `.size-limit.json` casa pelo nome do chunk (`operacao-*.js`, `coordenacao-*.js`, `pecas-*.js`, `galeria-*.js`).
- `tools/processo/guardioes-por-caminho.ts` (prefixos `apps/web/src/componentes/ui/` e `…/ui/ia/`), `tools/guardas/{camadas,guardas,tamanho-das-pastas}.test.ts` e `tools/guardas/__fixtures__/kit-importa-api.ts`, `tools/ci/{playwright,e2e-que-cita-literal,duracao-do-e2e,prazo-do-e2e}*.ts` (guarda de `perfis.ts`, nomes de projeto), `knip.json`, `eslint-suppressions.json` (82 menções a `apps/web/…`) e a configuração do `dependency-cruiser`.
- `VITE_COM_GALERIA` (`.env.example`, `tools/ci/dockerfile.test.ts`, `tools/ci/prazo-do-e2e.ts`): se `galeria` virar `gallery`, a variável deve acompanhar (`VITE_WITH_GALLERY`) ou ficar como está por ser nome de ambiente; decisão do dono.
- Docs que citam os nomes: `docs/interface.md` (seção 10 inteira lista o kit por nome), `docs/guia-do-desenvolvedor.md` §4, `componentes/ui/ia/README.md`, `docs/mvp-rapido.md`, `TODO.md`, e os comentários de código (que citam `Botao`, `Cartao`, `Dialogo`… centenas de vezes, em português, e não fazem parte das tabelas).
