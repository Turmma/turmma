# Achados das revisões — `tasks/prd-nomes-de-mercado/11_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-01 15:26:11 · `tasks/prd-nomes-de-mercado/11_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: não se aplica. A tarefa não toca `apps/`, `packages/`, `infra/`, `.github/` nem `compose.yaml`.
Fila e prioridade: ok. Não há job, fila nem worker no diff.
Concorrência: protegida. Não há operação nova de "busca, verifica, grava". O diff só renomeia símbolos de e2e e de ferramenta.
Índice e paginação: ok. Não há query nova.
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok. Não há código novo no caminho quente.
Bloqueantes: nenhum
Recomendações:
- O perfil de máquina do e2e, que simula o Chromebook e o celular de entrada, continua igual depois do rename, e esse perfil é o que reproduz a condição de sala.
  - Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/support/profiles.ts`, `CHROMEBOOK_PROFILE` e `MOBILE_PROFILE` mantêm `cpuMaisLenta: 4`, `REDE_FAST_3G` e `REDE_MOVEL_LENTA`.
  - Os prazos mantêm os mesmos valores: `SIGN_IN_TIMEOUT_MS = 20_000` e `AI_TIMEOUT_MS = 45_000`.
  - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/playwright.config.ts` mantém os dois projetos com a chave `profile`.
  - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/ci/playwright.test.ts` cobre essa troca, com as mutações registradas em `tasks/prd-nomes-de-mercado/11_task.md`.
  - Nada a corrigir. A recomendação é só conferir, na esteira do encontro das linhas, que o projeto `celular` continua aplicando a limitação de rede e de CPU.
- O título do caso em `tools/ci/playwright.test.ts` ainda cita `e2e/__fixtures__/perfis.ts` e "test com perfil". Isso fica para a 13.0 (documentos) ou para a guarda, se o nome do arquivo tiver mudado. Não afeta carga.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-01 15:26:24 · `tasks/prd-nomes-de-mercado/11_task.md`

VEREDITO: APROVADO

A tarefa 11.0 só troca nomes de símbolos no e2e. Não muda nenhum dado, texto ou comportamento, então nenhum ponto da regra 20 é afetado.

Campos pessoais tocados: nenhum. Não há migration, DTO, schema nem campo novo. Em `e2e/support/seed.ts` só mudou o nome de um tipo (`LinhaDaAuditoriaDoPedido` → `AuditoriaDoPedidoRow`); os dados do seed são os mesmos.
Fora da tabela de dados do docs/lgpd.md: nenhum, porque nenhum campo foi criado.
Autorização por objeto: ok. Nenhuma rota, repository ou guarda de produção foi tocada. Os casos de isolamento e de "id trocado" do e2e (`acesso-da-turma.spec.ts`, `troca-de-escola.spec.ts`, `privacidade.spec.ts`, `pedidos.spec.ts`, `meus-dados.spec.ts`) mantêm as mesmas asserções; só o ajudante `portao` passou a se chamar `gate`.
Logs: limpos. Nenhum `console.*` ou chamada de logger entrou ou mudou no diff.
Auditoria: presente, sem mudança. A tarefa não cria leitura nova de dado de aluno, exportação, alteração de nota ou permissão, nem aprovação de saída de IA.
Envio externo: nenhum. Os mocks de API (`mockAlunoApi`, `mockAssistenteApi`) só foram renomeados e seguem interceptando dentro do navegador.
Seed/fixture: sintético, inalterado.

Como conferi:
- **Textos:** comparei todos os textos entre aspas de cada arquivo alterado, antes e depois. Títulos de caso, seletores, `toHaveText` e textos esperados são idênticos. As únicas diferenças são nomes de símbolo citados entre crases (`carregarSemRedeLenta` → `loadUnthrottled` e semelhantes) e a mensagem de `e2e/support/profiles.ts` que cita a chave `perfil` → `profile`, como a tarefa prevê.
- **Nomes:** comparei todos os nomes que saíram e entraram nos arquivos. Todos estão nas 67 entradas de `tools/renomear/mapas/11.json`, com uma exceção: a chave `perfil` → `profile`, que a tarefa manda trocar à mão e que tem linha em `tasks/prd-nomes-de-mercado/travas.md:198`.
- **Arquivos novos:** `tools/renomear/mapas/11.json` e `tools/renomear/mapas/11.relatorio.md` não têm e-mail, CPF, telefone nem nome de pessoa real.

Bloqueantes: nenhum.

Recomendações: nenhuma de LGPD.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-01 15:26:31 · `tasks/prd-nomes-de-mercado/11_task.md`

VEREDITO: APROVADO

A tarefa 11.0 é uma onda de rename no `e2e/`: só troca nomes de variáveis e funções, não mexe em produto nem em `docs/regulacao.md`. Conferi isso com um script. Ele aplicou as 67 entradas de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/mapas/11.json`, mais as trocas à mão (`perfil` vira `profile`, `portao` vira `gate`, `secao` vira `gallerySection`), sobre a versão do HEAD dos 105 arquivos alterados em `e2e/`, `playwright.config.ts` e `tools/ci/playwright.test.ts`, e comparou o resultado com a árvore atual. Sobraram 3 diferenças, todas previstas:

- Três títulos de `test` e uma mensagem de `expect` mantêm o nome antigo, como manda a regra geral 2 (`inventario-web-e2e.md:9`). Ficam em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/casca.spec.ts:57` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/components-gallery.spec.ts:71,81,187`.
- A chave `perfil: profile` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/support/profiles.ts` é só a forma escrita por extenso da mesma chave.

Nenhum seletor, texto procurado na tela ou asserção mudou. Por isso, os casos de e2e que provam a regra 70 (aprovação do professor, supervisão do tutor, governança e autonomia, painel do professor) continuam provando o mesmo. `apps/`, `packages/` e `docs/regulacao.md` não têm diff.

Caminhos de escrita em Nota: nenhum nesta tarefa. O `e2e/` não grava `Nota` direto, e a busca por `lancadaPor` e por insert de nota nele não achou nada. Todos com autor humano? sim, porque nenhum caminho foi criado nem alterado.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok (nenhum fluxo alterado)
Supervisão do tutor: ok (nenhum fluxo alterado; os specs do tutor só trocaram nomes)
Autonomia declarada e visível: sim (sem alteração; `e2e/agentes.spec.ts` e `e2e/governanca.spec.ts` só trocaram nomes)
Bloqueantes: nenhum
Recomendações: nenhuma da regra 70. A tarefa não tem tela, então não havia fotos para conferir.

## test-engineer · 1ª rodada · APROVADO · 2026-11-01 15:27:50 · `tasks/prd-nomes-de-mercado/11_task.md`

VEREDITO: APROVADO

**Cenários exigidos.** Esta tarefa é uma onda de rename sem regra de negócio nova, então os cenários de domínio escolar, permissão, isolamento e concorrência não se aplicam. O que precisa ser provado é:
1. A onda só troca nomes e os casos continuam os mesmos (`conferir`, RF7).
2. Nenhum nome antigo sobra no código (`restos`).
3. Os seletores ficam iguais.
4. O `esquemaDeCor` fica intacto.
5. Os casos só renomeados que passam da régua de duração ficam marcados "só rename".
6. O `restos` dá zero sobre todos os mapas e a esteira fica verde no encontro das linhas.
7. A trava nova da opção `perfil` → `profile` (`travas.md:198`) tem um bloco de mutação que fica vermelho pelo motivo certo.

**Cobertos.** Rodei só comandos que leem a árvore.
- **`conferir`:** `node tools/renomear/conferir.ts --mapa tools/renomear/mapas/11.json` deu verde: 210189 itens na foto de antes e nenhuma diferença que o mapa não explique.
- **`restos`:** `node tools/renomear/restos.ts` deu limpo, com 9 mapas e nenhum nome antigo.
- **Seletores e títulos:** fiz um diff palavra por palavra de `e2e/` e `playwright.config.ts`. Todas as trocas são de identificador, nas 49 trocas distintas do mapa mais as da troca à mão (`perfil` → `profile`, `portao` → `gate`, os `PAGINA_*` → `WIDE_PAGE`/`HTML_PAGE_*` conforme a triagem). Nenhum texto de seletor nem título de `test` mudou. Os dois títulos que aparecem no diff só mudam na desestruturação `{ page, profile }`.
- **`esquemaDeCor`:** não aparece em nenhuma linha do diff.
- **Régua de duração:** a seção "Só rename na régua de duração" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/mapas/11.relatorio.md` lista os 51 casos.
- **Mutações:** os dois blocos de `11_task.md:97-109` batem com o `git diff` de `playwright.config.ts`, até na indentação das linhas `profile: CHROMEBOOK_PROFILE` e `profile: MOBILE_PROFILE`. Com a chave antiga `perfil`, as asserções `uso?.profile` dos casos `chromebook: …` e `celular: …` de `tools/ci/playwright.test.ts` leem `undefined` e falham. É o motivo certo, e não um erro de carga.
- **`playwright.test.ts`:** passa na árvore atual, 7 de 7.
- **`--faltando`:** `node tools/processo/mutacoes.ts --faltando` não acha nenhuma linha nova de produção com condição sem bloco.
- **Testes desligados:** nenhum `.skip`, `.only`, `.fixme` ou teste comentado entrou no diff.
- **IA:** nenhum teste chama provedor de IA.

**Bloqueantes.** Nenhum.

**Recomendações.**
1. Só o compilador (`tsc`) protege a chave `profile` do `base.extend` em `e2e/support/profiles.ts:68-69`, pelo tipo `ProfileOptions`. Nenhum bloco de mutação de runtime a cobre. Isso basta enquanto o `typecheck` estiver no portão. A `travas.md:198` já registra que é o `tsc` que pega.
2. A linha "encontro das linhas na spec" da tabela de testes só se prova na `spec/nomes-de-mercado`, com o `restos` sobre todos os mapas e a esteira com `infra` e e2e. A validação deve conferir o veredito da esteira no encontro, porque esta tarefa não consegue prová-lo.
3. `tools/ci/codigo-do-autenticador.test.ts` está nos arquivos previstos e ficou sem diff. Isso está correto, porque ele só importa de `e2e/support/seed.ts` nomes que o mapa não renomeia. Vale anotar isso na tabela de previstos, como já foi feito para `EmptyState.tsx`.
4. Em `e2e/support/profiles.ts:48`, o campo interno do `WeakMap` ainda se chama `perfil` (`{ sessao, perfil: MachineProfile }`). É o "outro `perfil` fica" do anexo, item 11.0 c, e está certo. Um comentário curto ali evitaria que a próxima onda o confunda com a opção do Playwright.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-01 15:28:07 · `tasks/prd-nomes-de-mercado/11_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

Recomendações:
- O documento `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/11_task.md:52` lista `tools/ci/codigo-do-autenticador.test.ts` como "alterado", mas o arquivo ficou sem diff. Está certo assim: ele importa de `seed.ts` só nomes que o mapa não troca (`codigoDoAutenticador`, `codigoDoPassoAnterior`, `esperaPelaViradaDoPasso`). Vale corrigir a linha para "sem diff" e dizer por quê, como já foi feito com o `EmptyState.tsx`.
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/guardas.spec.ts:2-13`, os nomes importados de `html-pages.ts` e `checks.ts` perderam a ordem alfabética depois da troca (`WIDE_PAGE` entre os `HTML_PAGE_*`, `rawCodePattern` antes de `horizontalOverflow`). Não muda o comportamento e o lint passa, então não bloqueia. Fica para quando alguém mexer nesse arquivo.
- A seção "Troca à mão" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tools/renomear/mapas/11.relatorio.md:79-106` lista o "acionar" e o "portão" que aparecem como palavra comum em comentários de `apps/` e `tools/` (por exemplo `ListItem.tsx:41`, "ler não é acionar"). Ninguém mexeu neles, e está certo: não são símbolo da onda. Só que o relatório não diz isso, e quem ler depois pode achar que é pendência. Uma linha dizendo que ficam, por serem prosa, resolve.

O que conferi:
- **Só nome mudou.** Desfiz a troca no texto atual de cada arquivo alterado, com o mapa e a troca `profile` → `perfil` feita à mão, e comparei com o `HEAD`. Sobrou uma única diferença, em `e2e/support/profiles.ts:75`: o atalho `{ perfil }` virou `perfil: profile`, que é o campo interno que fica (anexo, item 11.0 c). Seletores, títulos de caso e `esquemaDeCor` estão iguais.
- **As duas ferramentas da onda estão verdes.** O `conferir` deu "verde. 210189 itens, nenhuma diferença que o mapa não explique", e o `restos` deu "limpo. 9 mapas, nenhum nome antigo sobrou".
- **Nenhum nome antigo do inventário sobrou em `e2e/`.** O que restou é o que deve ficar: o `vigiarODado`, o `medirBlocosDaGaleria` e o `carregarSemRedeLenta` que aparecem em título de caso (regra geral 2), e os `PRAZO_*` que o inventário não lista.
- **O mapa segue a triagem do Arquiteto.** Tem `"linha": true`, 20 entradas de `portao` (3 de `e2e/support/` e 17 de specs, cada uma com o seu arquivo), `acionar`, `PRAZO_*` e `Cena` sem arquivo, os `PAGINA_*` com os nomes da triagem e `entrarComSegundoFator` fora. `apps/` e `packages/` ficaram sem diff, e o `EmptyState.tsx` também.
- **A trava achada está registrada e provada.** Tem a linha nova em `travas.md:198`, os dois blocos de mutação em `playwright.config.ts` apontando para casos que leem `uso?.profile`, e as entradas em `excecoesDoConferir`.
- **Os casos lentos estão marcados.** O relatório traz os 51 casos acima da régua de duração marcados "só rename".

## test-engineer · 2ª rodada · APROVADO · 2026-11-01 16:48:54 · `tasks/prd-nomes-de-mercado/11_task.md`

VEREDITO: APROVADO

Cenários exigidos: a tabela "Testes que provam a regra" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/11_task.md` tem seis linhas: `conferir` (RF7, só nomes mudam, os mesmos casos), `restos` sem sobra em código, seletores iguais, `esquemaDeCor` intacto, caso só renomeado acima da régua marcado "só rename", e encontro das linhas com a esteira verde. Esta tarefa é um rename de nomes do e2e, sem regra de domínio nova. Por isso permissão e isolamento não se aplicam. A regra que importa é que só nomes mudam, mais a trava `travas.md:198`, a opção `profile` do Playwright.

Cobertos: esta rodada só auditou o diff desde a 1ª rodada aprovada.
- `e2e/guardas.spec.ts`: só a ordem dos imports mudou (ordem alfabética dos `HTML_PAGE_*` e dos nomes de `checks.ts`). Os nomes importados são os mesmos e nenhum caso mudou.
- `e2e/support/profiles.ts:47-50`: só um comentário novo, que separa o campo interno `perfil` do WeakMap da opção `profile` do Playwright. O código não mudou.
- `11_task.md:52`: a linha de `tools/ci/codigo-do-autenticador.test.ts` agora diz "sem diff no fim", com o motivo. Bate com a árvore: o `git diff` desse arquivo vem vazio.
- `11_task.md:111-118`: a tabela "Recomendações sem aplicar" registra as 5 recomendações da 1ª rodada, cada uma com destino ou motivo. Isso inclui as duas que eu dei.
- As duas mutações de `playwright.config.ts` não mudaram e continuam alcançando a cláusula. Hoje elas leem `uso?.profile` em `tools/ci/playwright.test.ts`, que rodei agora: 7 de 7 verdes.
- Não há `.skip`, teste comentado, mock que esconda a regra nem chamada a provedor de IA no que mudou.

Bloqueantes: nenhum.

Recomendações:
- `11_task.md:116` cita `e2e/support/profiles.ts:68-69` para a chave `profile` do `base.extend`. O comentário novo deslocou o código em 3 linhas, e o ponto certo agora é `e2e/support/profiles.ts:71-72`. Vale acertar a citação quando o documento for tocado de novo.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-01 16:49:07 · `tasks/prd-nomes-de-mercado/11_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/prd-nomes-de-mercado/11_task.md`, seção "Como testar": o texto ainda diz que `tools/ci/codigo-do-autenticador.test.ts` importa `e2e/__fixtures__/sessao.ts`, e que "por isso está nos previstos". Essa pasta não existe. O arquivo importa de `e2e/support/seed.ts` (linha 2), como a tabela de previstos já diz depois da correção. Trocar a frase para o caminho real, para o documento não se contradizer.

Nesta rodada só mudaram três arquivos:
- `e2e/guardas.spec.ts`: os imports estão em ordem alfabética, sem nome perdido nem duplicado.
- `e2e/support/profiles.ts:47-50`: só entrou um comentário que separa o campo interno `perfil` da opção `profile` do Playwright. O código não mudou.
- A linha "sem diff" da tabela de previstos confere: `git diff` não mostra nada em `codigo-do-autenticador.test.ts` nem em `EmptyState.tsx`.

A recomendação que a rodada anterior deixou sem aplicar, a do `11.relatorio.md`, ficou registrada com motivo em "Recomendações sem aplicar". Não pede mais nada nesta tarefa.
