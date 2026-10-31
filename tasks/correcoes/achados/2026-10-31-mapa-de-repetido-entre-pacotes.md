# Achados das revisões — `tasks/correcoes/2026-10-31-mapa-de-repetido-entre-pacotes.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## revisor-geral · 1ª rodada · REPROVADO · 2026-10-31 12:06:27 · `tasks/correcoes/2026-10-31-mapa-de-repetido-entre-pacotes.md`

VEREDITO: REPROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. A regra nova está na Tech Spec §5 e no `casos.md` (`ec5f9541`, que já está nesta branch). A implementação de `validarMapa` e `seRepetem` faz o que a §5 diz.

Portão local: carimbo válido. O `conferir` diz que vale para o código atual e cobre typecheck, lint, segredo, dependências, unidade e alvo.

Bloqueantes:

1. **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/renomear/texto.ts:129` (`aplicarPasso5`), que esta correção destravou.**
   - **O que está errado.** A Causa do documento diz que "o único que travava era a recusa". Não é verdade. O passo 5 monta `simbolos` como um `Map` pelo `de`: `new Map(entradas.filter(... 'simbolo').map((entrada) => [entrada.de, entrada]))`.
     - Com duas entradas de mesmo `de`, a segunda apaga a primeira. A partir daí, todo comentário de código e todo documento vivo que cita o homônimo recebe o `para` da última entrada, em qualquer pacote.
     - Reproduzi com a mesma montagem do `aplicarPasso5` e as entradas `doApi` e `doWeb` do teste novo. O trecho `` // as `Opcoes` do api `` sai como `` // as `WebOptions` do api ``.
   - **Por que ninguém vê.** O `aplicar` não recusa e o `conferir` não olha comentário. O `restos` também não acusa, porque o nome antigo sumiu. O nome errado entra calado.
   - **Na 8.0.** Hoje nenhum comentário nem documento cita `OpcoesDaMontagem`, então essa onda não é afetada. Mas a regra vale para qualquer onda futura.
   - **O teste novo.** "os dois arquivo em pacotes diferentes" não tem comentário nem documento, por isso não pega o problema.
   - **Correção exigida.** No passo 5, um `de` de símbolo com mais de uma entrada não pode receber um `para` escolhido sozinho.
     - Ou ele vai para a lista de troca à mão (`aMao`) do relatório, em comentário e em documento.
     - Ou, no comentário de código, ele segue a entrada do pacote do arquivo e vai à mão só no documento.
     - O caminho escolhido entra na Tech Spec §5 e no `casos.md`, pelo Arquiteto, como na triagem.
     - Junto vem um caso no mesmo `describe` com comentário nos dois pacotes, e documento se houver, e uma mutação que o deixe vermelho.

Recomendações:
- **Mesmo padrão em outros dois arquivos.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/renomear/referencias.ts:50` (`indiceDe`) e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/renomear/restos.ts:135` (`simbolosDe`) também montam o `Map` pelo `de`. Lá só o `de` e o `comum` são usados, então o efeito é pequeno: se as duas entradas tiverem `comum` diferente, vale o da última. Vale fechar junto com o bloqueante, para o `Map` pelo `de` sair do código de uma vez.
- **Faltou o import entre pacotes.** O caso real da 8.0 tem uma importação de um pacote no outro: `apps/worker/test/queue.fixture.ts:33` importa o `OpcoesDaMontagem` do despachante com `as OpcoesDoDespachante`. O teste novo não cobre esse caso. Um `uso.ts` no web que importe o `Opcoes` do api provaria que a renomeação e o `conferir` (`paraONomeExportado`) seguem a declaração certa.

## test-engineer · 1ª rodada · APROVADO · 2026-10-31 12:06:36 · `tasks/correcoes/2026-10-31-mapa-de-repetido-entre-pacotes.md`

VEREDITO: APROVADO

**Cenários exigidos**, conforme `tasks/prd-nomes-de-mercado/casos.md` (Recusas, desde `ec5f9541`) e a Tech Spec §5:
- **Caminho feliz:** o mesmo `de` de símbolo, com `arquivo` nas duas entradas e cada uma num pacote diferente. O mapa passa, cada declaração sai com o `para` da sua entrada, quem a importa também, e o homônimo do mesmo pacote que não foi mapeado fica como está.
- **Limite 1:** uma das entradas sem `arquivo`. Recusa nas duas ordens.
- **Limite 2:** os dois `arquivo` no mesmo pacote. Recusa, mesmo com destinos diferentes.
- **Limite 3:** o mesmo `de` em tipos diferentes (símbolo e arquivo). Recusa.
- **Regressão:** o `de` repetido simples continua com uma recusa por entrada repetida.
- Não há caso de permissão nem de isolamento entre escolas, porque é ferramenta de `tools/` e não toca dado de escola. Também não há concorrência.

**Cobertos**, todos em `tools/renomear/aplicar.test.ts`, no bloco "o de de símbolo repetido" (linhas 484 a 518):
- `os dois arquivo em pacotes diferentes: cada declaração sai com o para da sua entrada, e quem a importa também`. Compara o texto exato dos cinco arquivos, incluindo `apps/api/src/outro.ts` intacto. Antes da correção dava `de-repetido`.
- `uma das entradas sem arquivo (vale em todo pacote): recusa, nas duas ordens`
- `os dois arquivo no mesmo pacote: recusa, mesmo com destinos diferentes`
- `o mesmo de em tipos diferentes (símbolo e arquivo): recusa`
- `o de se repete`, o teste que já existia, na linha 481.

Rodei esses cinco testes e todos passaram. O `conferir.test.ts` também passou inteiro (59 testes) depois da mudança de lugar do `pacoteDoArquivo`.

**Mutações conferidas contra o `git diff`.** Toda linha nova com condição tem bloco: as duas linhas do `seRepetem`, o `some` do `validarMapa`, o `?? []` e o `pacoteDoArquivo`. Cada bloco cai no teste que de fato chega à cláusula:
- A mutação 4 (sem a checagem de tipo) deixa a entrada de tipo arquivo passar pela validação. O teste então recebe `de-inexistente` no lugar de `de-repetido` e fica vermelho porque a cláusula foi alcançada, que é o motivo certo.
- A mutação 6 (`?? [entrada]`) compara a entrada com ela mesma e recusa toda entrada, o que derruba o caminho feliz.
- A mutação 7 junta tudo em `apps`, o que também derruba o caminho feliz.

Não há `.skip`, teste comentado nem mock: os testes montam um repositório git de verdade. Não há IA envolvida.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **O `conferir` com duas entradas homônimas não tem teste.** A correção faz o `conferir` aceitar, na linha 234 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/renomear/conferir.ts`, um mapa que antes ele recusava. A Tech Spec §5 afirma que "o `conferir` segue cada entrada só no pacote dela", mas os testes de `conferir.test.ts` só provam isso com uma entrada por mapa. Vale um caso em `conferir.test.ts` com as duas entradas (`doApi` e `doWeb`, nas duas ordens), mostrando que a declaração de cada pacote é esperada com o `para` da sua entrada. É exatamente o mapa que a 8.0 vai rodar.
2. **A escolha da entrada no `conferir` depende da ordem do mapa.** O `paraONomeExportado` usa `find` e fica com a primeira entrada que casa (linhas 156 a 162 do mesmo arquivo). Uma reexportação feita num pacote B, vinda do pacote A pelo nome do pacote, casa com a entrada de B pela regra `pacoteDoArquivo(item.arquivo) === pasta` se essa entrada vier primeiro, e o `conferir` esperaria o `para` errado. Não acontece na 8.0, porque worker e despachante só declaram, mas é bom registrar na retro ou cobrir junto com a recomendação 1.
3. **O teste de tipos diferentes usa um caso artificial.** Ele põe `arquivo` numa entrada de tipo `arquivo` (`aplicar.test.ts:516`), coisa que um mapa real não tem. Sem esse campo, a checagem de `undefined` já recusaria e a de tipo nem seria alcançada. O caso é válido para prender a cláusula, mas um comentário curto explicando por que o campo está ali ajudaria quem ler depois.

## revisor-geral · 2ª rodada · APROVADO · 2026-10-31 13:32:42 · `tasks/correcoes/2026-10-31-mapa-de-repetido-entre-pacotes.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. O passo 5 da §5 e o caso de "Comentário e documento" no `casos.md` vieram do Arquiteto no `539162fb`. O código segue os dois: o homônimo de pacotes diferentes não é trocado em lugar nenhum, nem composto, nem entre crases, nem em `{@link}`, e cada ocorrência vai para a troca à mão. A divergência está registrada na seção "Divergências resolvidas nesta tarefa".
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

**A correção exigida na 1ª rodada foi feita.**
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/renomear/texto.ts`, a função `aplicarPasso5` (linhas 158-160) monta o conjunto `repetidos`. `trocarNosComentarios` e `trocarNoDocumento` repassam esse conjunto a `trocarTrecho`. Em `trocarTrecho` (linhas 88-91), o token repetido vai para `aMao` antes de qualquer troca, dentro ou fora da proteção de crases e `{@link}`.
- O caso novo fica no mesmo `describe`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/renomear/aplicar.test.ts`, linhas 138-160. Ele cobre um comentário nos dois pacotes (um com crases, outro com `{@link}`) e um `docs/x.md`. Confere que o texto fica intacto nos três, que as três linhas estão na troca à mão e que o símbolo de entrada única no mesmo trecho é trocado. Quatro mutações declaradas atingem o caminho.
- O documento diz que o `restos` libera a ocorrência registrada, e isso confere com o código. Em `restos.ts`, as linhas 182 e 190 liberam por `arquivo` e `de` a linha registrada na troca à mão, só quando ela está em comentário ou documento. A chamada sem `repetidos` (linhas 147 e 161) segue cobrando até a onda registrar a ocorrência.
- O item 2 ficou fora, e o motivo está na seção "Sem aplicar". Ele procede: em `simbolosDe`/`indiceDe` só se usa se o texto mudou ou o `comum`, e esse valor sai do `de`, então não importa qual das duas entradas o `Map` guarda.
- Também entraram duas coisas que eu tinha recomendado: o import entre pacotes com alias (linhas 126 e 135) e o `conferir` com as duas ordens e com o `para` trocado entre pacotes (`conferir.test.ts`, linhas 393-409).

Bloqueantes: nenhum

Recomendações:
- A seção "Teste que reproduz" do documento da correção ainda lista só os casos do `validarMapa`. O caso novo do passo 5 (`o de repetido em comentário e em documento`) aparece só em "Correção" e nas mutações, e devia ser listado também ali.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/renomear/texto.ts:160` faz `filter` dentro de `filter`, que é quadrático no tamanho do mapa. Contar os `de` num `Map` numa única passada é mais simples de ler e escala melhor. Hoje não pesa.
- A escolha da entrada por `paraONomeExportado` com `find` foi mandada para a retro, e não deve se perder lá. O motivo registrado ("o `conferir` fica vermelho, nunca verde") só vale enquanto o `conferir` continuar procurando cada entrada no pacote dela.

## test-engineer · 2ª rodada · REPROVADO · 2026-10-31 13:32:59 · `tasks/correcoes/2026-10-31-mapa-de-repetido-entre-pacotes.md`

VEREDITO: REPROVADO

Cenários exigidos (o que muda nesta rodada):
- O `de` de símbolo repetido no passo 5 não recebe nenhum `para`, em comentário de cada pacote e em documento, e cada ocorrência vai para a troca à mão. Isso vale para o `de` comum entre crases ou em `{@link}` e também para o `de` composto, como diz a Tech Spec §5 ("nem composto, nem entre crases, nem em `{@link}`").
- O símbolo de entrada única no mesmo trecho continua trocando.
- Um pacote importa o homônimo do outro com alias, e a troca segue a declaração certa.
- O `conferir` com as duas entradas homônimas, nas duas ordens, aceita o certo e recusa os `para` trocados de pacote.
- As 4 mutações novas em `texto.ts` derrubam o teste citado.

Cobertos:
- `aplicar.test.ts` › "o de repetido em comentário e em documento: nenhum para é escolhido, os três vão para a troca à mão, e o símbolo de entrada única troca". Confere o texto exato dos três arquivos e as três linhas do relatório (api:4, web:3, docs/x.md:1). As 4 mutações novas chegam à cláusula pelo motivo certo. Se a guarda some, ou se o `repetidos` não é passado ao comentário ou ao documento, o comentário e o documento recebem o `para` da última entrada. Com `> 0`, o `UnicoDoMapa` deixa de trocar.
- `aplicar.test.ts` › "os dois arquivo em pacotes diferentes", com a nova asserção de `apps/web/src/de-fora.ts`, de texto exato.
- `conferir.test.ts:393` › "as duas entradas de mesmo de, uma por pacote (o mapa da 8.0)", com o caso certo e o trocado nas duas ordens.
- O comentário do caso de tipos diferentes (`aplicar.test.ts:543-544`) foi feito.
- `npx vitest run tools/renomear/aplicar.test.ts tools/renomear/conferir.test.ts` deu 106 de 106 verdes. Não há `.skip`, mock nem provedor.

Bloqueantes:
1. `tools/renomear/aplicar.test.ts:138-160`: só o `de` comum está provado, e o caso real da 8.0 é composto.
   - **O que está errado:** o único `de` repetido do teste é `Opcoes`, que é comum: `ehComum` em `tools/renomear/mapa.ts:74-76` aceita uma palavra só, sem maiúscula interna. O caso real da 8.0 é `OpcoesDaMontagem`, que é composto, e o passo 5 troca o `de` composto mesmo solto na prosa (`texto.ts:93`, ramo `!entrada.comum`). A Tech Spec §5 diz que o repetido não se troca "nem composto". Essa parte da regra fica sem teste.
   - **Mutação que sobreviveria:** em `tools/renomear/texto.ts:88`, trocar `if (repetidos.has(entrada.de)) {` por `if (repetidos.has(entrada.de) && entrada.comum) {`. Os três `Opcoes` do teste continuam indo para a troca à mão e o teste fica verde. Já um `OpcoesDaMontagem` solto num comentário do worker sairia com o `para` da última entrada, sem recusa de ninguém. É o defeito que esta correção existe para fechar, no símbolo que a motivou.
   - **Correção exigida:**
     - Pôr no teste, ou num caso irmão, um par homônimo composto, por exemplo `OpcoesDaMontagem` com `arquivo` em `apps/api` e em `apps/web`. Ele deve aparecer solto, sem crase, num comentário de código e num `docs/*.md`.
     - Conferir que o texto fica com o nome antigo e que as ocorrências entram na troca à mão do relatório.
     - Declarar no documento o bloco ` ```mutacao ` acima (`&& entrada.comum`) apontando para esse caso.

Recomendações:
- `tasks/correcoes/2026-10-31-mapa-de-repetido-entre-pacotes.md`, seção "Teste que reproduz": falta citar pelo nome os dois casos novos. O de comentário e documento ("vermelho antes, verde depois") e o do `conferir` hoje só aparecem descritos em "Correção".
- `conferir.test.ts:394-395`: o caso trocado confere só `.not.toEqual([])`. Seria mais forte conferir as divergências esperadas, uma por pacote, para não passar por uma divergência alheia.
- O par `{@link}` com documento cobre a faixa protegida. Um caso com o `de` repetido fora da faixa, num `.md`, ficaria coberto pelo bloqueante acima, se o caso composto for solto também no documento.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/renomear/texto.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/renomear/aplicar.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/renomear/conferir.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/renomear/mapa.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tasks/correcoes/2026-10-31-mapa-de-repetido-entre-pacotes.md

## revisor-geral · 3ª rodada · APROVADO · 2026-10-31 13:39:15 · `tasks/correcoes/2026-10-31-mapa-de-repetido-entre-pacotes.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo), conferido sobre a árvore atual
Bloqueantes: nenhum
Recomendações: nenhuma nova. As da 2ª rodada continuam valendo para a validação e a retro, sem bloquear.

Nesta 3ª rodada, auditei só o que mudou desde a rodada aprovada. Não havia correção exigida a conferir. `texto.ts`, `mapa.ts` e `conferir.ts` não mudaram. Mudaram dois arquivos de teste e o documento da tarefa:

- **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/renomear/aplicar.test.ts`**, linha 533 em diante. O caso novo cobre um nome composto repetido (`OpcoesDaMontagem`) solto em comentário e em documento. O teste confere o arquivo inteiro: a declaração de cada pacote recebe o nome da sua entrada, o nome solto continua como estava, e o símbolo de entrada única é trocado na mesma passada. Também confere as três linhas que vão para a troca à mão. A mutação que o documento declara (`&& entrada.comum`, na linha 88 de `texto.ts`) fica de fato presa por esse caso, porque o caso que já existia só usava `Opcoes`, que é um nome comum.
- **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/renomear/conferir.test.ts`**, linhas 407 a 409. O `not.toEqual([])` virou a lista exata das quatro divergências, conferida nas duas ordens. A lista passa por `dos` (linha 41), que ordena o resultado, então a comparação não depende da ordem das entradas. É a asserção fraca da rodada anterior, agora endurecida.
- **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tasks/correcoes/2026-10-31-mapa-de-repetido-entre-pacotes.md`**. Entraram os dois casos novos na lista de testes, a mutação nova e a condição que eu apontei na rodada anterior: deixar `paraONomeExportado` com `find` só é seguro enquanto o `conferir` procurar cada entrada no pacote dela. Nenhuma divergência nova de arquitetura apareceu.

Não há `.skip`, `.only` nem `any` nos testes alterados.

## test-engineer · 3ª rodada · APROVADO · 2026-10-31 13:39:25 · `tasks/correcoes/2026-10-31-mapa-de-repetido-entre-pacotes.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- Caminho feliz: o mesmo `de` em dois pacotes, com `arquivo` em cada um. Cada declaração sai com o `para` da sua entrada, e quem a importa também, inclusive com alias vindo do outro pacote.
- `de` comum repetido, entre crases e em `{@link}`: fica, e vai para a troca à mão.
- `de` composto repetido, solto na prosa de um comentário e de um `.md` (o `OpcoesDaMontagem` da 8.0): fica, e vai para a troca à mão.
- Um símbolo de entrada única, no mesmo texto, continua trocando.
- O `conferir` segue cada entrada no pacote dela, nas duas ordens do mapa.
- Recusas que prendem os limites da regra: entrada sem `arquivo`, os dois `arquivo` no mesmo pacote, o mesmo `de` em tipos diferentes.
- Permissão, isolamento e concorrência não se aplicam: é ferramenta de `tools/`, sem dado de escola e sem nada que rode duas vezes ao mesmo tempo.

**Cobertos:** todos. A correção exigida na 2ª rodada foi feita.
- O caso novo está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l3/tools/renomear/aplicar.test.ts:533-552`. Ele monta o par homônimo `OpcoesDaMontagem`, com `arquivo` em `apps/api` e em `apps/web`, solto num comentário de cada pacote e em `docs/y.md`.
- O caso confere o texto exato que sai: o nome antigo fica e o `UnicoDoMapa` vira `SingleOfMap`. Confere também as três linhas da troca à mão no relatório, com arquivo e linha.
- O bloco de mutação `&& entrada.comum` foi declarado no documento e aponta para esse caso.
- Conferi pelo código que essa mutação mata o caso. `ehComum('OpcoesDaMontagem')` dá falso (`mapa.ts:74-76`). Com a mutação, o composto sai do ramo de `repetidos` (`texto.ts:88`) e cai na troca de `texto.ts:93`. Ali ele recebe o `para` de uma das duas entradas, então o texto muda e a lista da troca à mão fica vazia. As duas asserções ficam vermelhas pelo motivo certo.
- As três recomendações da rodada anterior também foram feitas:
  - os casos novos estão citados em "Teste que reproduz";
  - o caso trocado do `conferir.test.ts:407-409` agora confere as quatro divergências exatas, nas duas ordens;
  - o `de` repetido aparece fora da faixa protegida num `.md` (`docs/y.md`, no caso composto).
- Rodei `npx vitest run tools/renomear/aplicar.test.ts tools/renomear/conferir.test.ts`: 107 de 107 verdes.
- Não há `.skip`, teste comentado nem mock no caminho da regra.

**Bloqueantes:** nenhum.

**Recomendações:**
- No caso de `conferir.test.ts:404-410`, vale um comentário dizendo que a ordem de `esperadas` é a ordem ordenada que `dos` devolve. Assim, quem ler não toma a lista como a ordem em que as divergências acontecem.
