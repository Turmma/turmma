# Achados das revisões — `tasks/correcoes/2026-11-10-verificar-sem-convite.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-10 10:32:35 · `tasks/correcoes/2026-11-10-verificar-sem-convite.md`

VEREDITO: APROVADO
Tela vista: não. A vitrine só fotografa coordenação, professora e aluno, e `/verificar` é tela anônima. Revisei pelo diff, por `VerificarEmail.tsx`, pelos testes e pela seção "Verificar" de `docs/interface.md`. Não rodei os testes nem o e2e. A tela fica para a validação.
Estados: ok. Carregando ("Confirmando…") e erro (link que não vale, e rede com "Tentar de novo") seguem como estavam. "Com dado" é o "E-mail confirmado". O vazio não existe, porque a tela nasce confirmando, como o código já documentava.
Acessibilidade: ok. O foco continua indo para o `role="status"` com `tabIndex={-1}` quando confirma, e o `role="alert"` do aviso foi mantido. Sem os dois links, `VerificarEmail.tsx:72` não deixa campo, botão ou link sem rótulo. O e2e continua verificando violação grave (axe) nos três estados.
Chromebook fraco: não se aplica. A mudança só remove elementos de uma tela pequena.
Celular: ok. A tela perdeu os dois alvos de toque (o "Continuar" de 44 px e o "Abrir o convite"), então não sobra alvo abaixo do mínimo. O e2e a 360 px mantém a checagem de rolagem horizontal e de violação grave. O fluxo não exige celular: quem fechou a aba do convite reabre o link do convite, em qualquer aparelho.
Ação oficial protegida: sim, não se aplica. A tela não aprova, publica, exclui nem exporta, e a verificação não aceita o convite nem abre sessão.
Bloqueantes: nenhum. Conferi os pontos de risco:
- **Imports:** os que saíram (`Link`, `buttonVariants`, `SECONDARY_LINK_CLASSES`, `ROUTES`) não são mais usados em `VerificarEmail.tsx`. No e2e, `ALVO_DE_TOQUE_PRINCIPAL_PX` e `esperarAlvo` ainda são usados (linha 378), e só `ALVO_MINIMO_PX` foi removido.
- **Texto na tela:** está em português do Brasil, diz o que fazer, e sem termo técnico nem id.
- **Documentação:** `docs/interface.md` bate com o código e com os testes, nos três estados. Não restam "Continuar" nem "Abrir o convite" fora dos testes que afirmam a ausência.
- **Privacidade:** o token continua saindo da barra antes de qualquer chamada e indo no corpo.
Recomendações:
- A orientação "Volte à aba do convite e aceite de novo; se a fechou, abra o link do convite outra vez." agora é a única saída e fica como texto simples. Na validação, observe se quem veio pelo link do e-mail entende "o link do convite" sem um botão. Se o piloto mostrar quem se perde, vale abrir um canal que não dependa do token, como o e-mail do convite com a mesma instrução.
- Os dois casos de teste de unidade afirmam `queryAllByRole('link')` vazio no documento inteiro. Isso está certo hoje. Se a `CascaPublica` ganhar um link de rodapé, eles quebram por motivo alheio. Restringir a `main` seria mais estável, como o e2e já faz com `linksDaTela`.

Arquivos principais:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/VerificarEmail.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/VerificarEmail.test.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/verificar-email.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/interface.md`

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-10 10:32:38 · `tasks/correcoes/2026-11-10-verificar-sem-convite.md`

VEREDITO: APROVADO
Tabelas verificadas: nenhuma. O diff não traz migration nem schema.
Queries verificadas: nenhuma. O diff não toca repository, endpoint nem API. A tela `/verificar` continua chamando só `verificarConta`, com o token no corpo, e nenhum `escolaId` sai do cliente.
Teste de isolamento: não se aplica. A tarefa só tira dois links de uma tela anônima e não cria módulo, tabela nem consulta com escopo. A regra 10, item 6, continua valendo: o vencido, o usado, o inventado e o sem token recebem a mesma mensagem, e agora nenhum deles tem link.
Bloqueantes: nenhum.
Recomendações:
- Os testes `linksDaTela(page)` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/verificar-email.spec.ts` buscam os links dentro do `main`. Esse `main` existe hoje em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/components/CascaPublica.tsx:83`. Se a casca deixar de ter `main`, o Playwright acha zero links e o teste passa mesmo com o "Continuar" de volta. Afirmar antes que o `main` está visível tiraria esse falso verde. Não muda nada no isolamento.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-10 10:32:43 · `tasks/correcoes/2026-11-10-verificar-sem-convite.md`

VEREDITO: APROVADO

A tarefa não toca em dado pessoal. Ela só tira dois links de uma tela anônima: "Continuar" no estado confirmado e "Abrir o convite" no estado inválido. Também troca o texto de orientação da tela.

Campos pessoais tocados: nenhum. A mudança fica no texto da tela, nos testes e no `docs/interface.md`. Não há migration, DTO, rota nem tabela nova.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: não se aplica. O endpoint `/v1/conta/verificar` não mudou, e a tela é anônima. O aviso para link vencido, usado, inventado ou sem token continua o mesmo nos quatro casos (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/VerificarEmail.tsx:10`, `:135`). A tela não diz se o token existe, o que mantém a regra 10, item 6.

Logs: limpos. O `VerificarEmail.tsx` não tem `console` nem `logger`.

Auditoria: não se aplica. A tarefa não tem leitura de dado de aluno, exportação, nota, permissão nem aprovação de saída de IA.

Envio externo: nenhum.

Seed/fixture: sintético. O e2e continua usando `TOKEN_QUE_NUNCA_EXISTIU`, as equipes criadas pelos helpers de teste e respostas de erro com `requisicaoId` fixo.

Conferências da regra 20 sobre o token, item 8:
- O token ainda sai da barra antes de qualquer chamada, com `clearFragment()` em `VerificarEmail.tsx:120` e `:106`. Ele vai no corpo do pedido (`verificarConta({ token })`, `:126`), nunca na URL.
- A mudança reduz a superfície em vez de aumentar. Nenhum link novo leva token a outra rota. Hoje o token do convite fica só na aba que o abriu, e a tela não tenta reconstruí-lo nem guardá-lo, nem em `localStorage` nem na URL.
- O uso único do link de verificação continua igual (`tokenGasto`, `pedidoFeito`). Os testes de uso único e de recomeço seguem no e2e.

Bloqueantes: nenhum.

Recomendações:
- Fica a cargo do `frontend-reviewer`, não desta regra: o estado inválido agora não tem nenhuma ação. A pessoa só tem o texto "abrindo o convite de novo" para saber o que fazer. Do lado da LGPD está certo, porque a tela não tem o token do convite e não deve inventar caminho para ele.

Pergunta de fechamento: a tarefa não muda o que o sistema guarda sobre um aluno nem para onde isso é enviado. O que o código já responde sobre isso continua como estava antes da tarefa.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/VerificarEmail.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/VerificarEmail.test.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/verificar-email.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/interface.md` (seção Verificar)
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-10-verificar-sem-convite.md`

## infra-guardian · 1ª rodada · APROVADO · 2026-11-10 10:32:44 · `tasks/correcoes/2026-11-10-verificar-sem-convite.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok. Não há rota nova e nenhum limite mudou. `/v1/conta/verificar` continua sendo chamado uma vez só, com a trava contra o StrictMode mantida.
Fila e prioridade: ok. Não há job novo. O e-mail de verificação continua saindo pelo worker, como antes.
Concorrência: protegida. Nada novo pode ser disparado duas vezes. A tela perdeu os dois links e não ganhou nenhuma ação.
Índice e paginação: ok. Não há query nova.
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok. Não há código novo no caminho quente.
Bloqueantes: nenhum
Recomendações:
- A tela deixa de mandar a pessoa para `/convite` sem token, um beco sem saída que levava a tentar de novo à toa. A carga às 10h não muda. Fica só como registro na retro, sem nada a fazer.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/VerificarEmail.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/VerificarEmail.test.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/verificar-email.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/docs/interface.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-10-verificar-sem-convite.md

## revisor-geral · 1ª rodada · APROVADO · 2026-11-10 10:32:50 · `tasks/correcoes/2026-11-10-verificar-sem-convite.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

**Escopo e aderência**
- A correção faz o que a triagem da 16.0 decidiu, e não passa disso. No estado confirmado saiu o "Continuar" e entrou a orientação nova (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/VerificarEmail.tsx:72`). No estado do link que não vale saiu o "Abrir o convite" e o aviso continua o mesmo (`VerificarEmail.tsx:79-81`).
- Os imports que sobraram foram removidos. API, rota e dado não mudaram.
- O texto bate letra por letra com `cenarios.md:299` e com o item do `TODO.md:3220-3222`.
- A `techspec.md` não citava o "Continuar", então não havia o que atualizar nela.
- `docs/interface.md` foi atualizado na seção do Verificar.
- O `8_task.md` ainda cita o "Continuar", mas é o registro de uma tarefa já feita e não precisa mudar.

**Testes**
- Os dois testes de unidade novos afirmam três coisas: o texto, nenhum link na tela e a ausência de "Continuar" e de "Abrir o convite".
- `queryAllByRole('link')` vale de verdade como prova, porque a `CascaPublica` não tem nenhum link.
- O e2e usa `getByRole('main').getByRole('link')`. A `CascaPublica` renderiza o `main` (`CascaPublica.tsx:83`), então o localizador encontra o que deve.
- `activate`, `esperarAlvo` e `ALVO_DE_TOQUE_PRINCIPAL_PX` continuam em uso em outros casos do spec. O `ALVO_MINIMO_PX`, que ficou sem uso, foi removido. Não sobrou código morto.

**Recomendações**
- O item do `TODO.md` (linha 3218) continua `[ ]`. Feche-o no commit desta correção ou no pouso, para ele não voltar como pendência.
- A frase do bloco de comentário do e2e (`e2e/verificar-email.spec.ts:12`) ficou muito mais longa que as vizinhas. Quebrar a linha ajuda a ler, embora o lint tenha passado.
- `VOLTE_AO_CONVITE` aparece copiado em três lugares: o componente, o teste de unidade e o e2e. O projeto escreve os textos esperados por extenso nos testes, então isso está de acordo com a casa e fica só como registro.

Sem fotos da tela: a vitrine não tem papel anônimo, e a conferência foi feita pelo código e pelos testes.

## test-engineer · 1ª rodada · APROVADO · 2026-11-10 10:33:02 · `tasks/correcoes/2026-11-10-verificar-sem-convite.md`

VEREDITO: APROVADO

Cenários exigidos:
- Caminho feliz: o e-mail é confirmado, aparece "E-mail confirmado" com a orientação nova, e não há "Continuar" nem link para `/convite`.
- Borda 1: o link que não vale (vencido, usado ou inventado) mostra o aviso de sempre, sem "Abrir o convite" nem outro link.
- Borda 2: o endereço sem token (link colado pela metade) mostra o mesmo aviso, sem pedido à API e sem link.
- Borda 3: o aceite que vem depois de verificar continua de pé, na aba do convite, sem a tela de verificar levar até ela.
- Permissão: não se aplica. A tela é anônima e a correção não mexe em autorização, rota nem API.
- Isolamento: não se aplica. A correção não toca dado de escola.
- Concorrência: a correção não muda o uso único do link nem o recomeço pelo `#`. Os testes do StrictMode e do link anterior que responde tarde seguem no arquivo e passam.

Cobertos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/VerificarEmail.test.tsx:43`, o teste "e-mail confirmado: diz para voltar à aba do convite e não leva a `/convite`". Confere o texto exato da orientação, que não há nenhum link (`queryAllByRole('link')` com tamanho 0) e que não há "Continuar".
- `VerificarEmail.test.tsx:55`, o teste "link que não vale: o aviso diz a saída e não há link para `/convite`". Confere o `textContent` exato do alerta, nenhum link e nenhum "Abrir o convite".
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/verificar-email.spec.ts:144`, `:180` e `:202`. Cobrem o fluxo pelo Mailpit, o link usado, o link inventado e o endereço sem token. Os links são procurados dentro de `main`, que existe de fato na `CascaPublica.tsx:83`, então a contagem zero não é vazia por falta de `main`. No fluxo do Mailpit, o aceite seguinte continua conferido.
- `e2e/verificar-email.spec.ts:341`, o caso de 360 px de "E-mail confirmado": sem rolagem horizontal, sem violação grave e sem link.
- Mutações, conferidas contra o `git diff`: os três blocos alcançam as três mudanças de produção.
  - Os links reintroduzidos fazem `toHaveLength(0)` falhar.
  - O texto antigo de volta faz `getByText(VOLTE_AO_CONVITE)` falhar, porque o teste guarda o texto novo numa constante própria.
  - Tirar os imports não leva cláusula. O `--faltando` diz 0 linhas.
- `npx vitest run apps/web/src/pages/VerificarEmail.test.tsx` passou, 4 de 4.
- Não há `.skip` nem teste comentado. A rede falsa (`fakeNetwork`) só faz o papel da API e não esconde a regra testada, que é o que a tela mostra. `esperarAlvo` e `ALVO_DE_TOQUE_PRINCIPAL_PX` continuam em uso no e2e (linha 378), então nada ficou sem uso depois das remoções.

Bloqueantes: nenhum.

Recomendações:
1. `e2e/verificar-email.spec.ts:214-217`: o trecho do endereço sem token não confere a ausência de links depois do `goto('/verificar')`. Hoje o caminho de render é o mesmo do link inválido, que já está coberto. Um `await expect(linksDaTela(page)).toHaveCount(0)` ali deixaria explícita a linha do `cenarios.md`, que cita o caso "sem token".
2. `e2e/verificar-email.spec.ts:353-358`: o caso de 360 px do link que não vale perdeu a conferência de alvo de toque e não ganhou nada no lugar. Para ficar simétrico ao caso de "E-mail confirmado", vale acrescentar `linksDaTela(page)` com contagem 0.
3. O terceiro bloco de mutação, a troca do texto, não traz a linha `falha:`. Não é obrigatória, mas os outros dois a têm, e com ela o portão mostraria a causa do vermelho.

## revisor-geral · 2ª rodada · REPROVADO · 2026-11-10 10:53:37 · `tasks/correcoes/2026-11-10-verificar-sem-convite.md`

**VEREDITO: REPROVADO**

**Escopo:** respeitado. As duas recomendações da 1ª rodada foram feitas: o item do `TODO.md` está fechado e a frase do comentário do e2e foi quebrada. A recomendação 3 era só registro. A asserção `main` visível do test-engineer e a linha `falha:` do terceiro bloco também estão lá.

**Aderência à Tech Spec:** ok. Nada nesta rodada mexe em `apps/web`, na API ou no `cenarios.md`.

**Portão local:** carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)").

**Bloqueantes:**

1. `tasks/correcoes/2026-11-10-verificar-sem-convite.md:89-111`
   - **O que está errado:** os dois blocos `mutacao` do e2e (o do link "Abrir o convite" e o do `CascaPublica` sem `main`) e a frase "Os dois blocos do e2e…" foram escritos dentro de `## Revisões`, abaixo da tabela. Essa seção diz "Não edite à mão", e o hook depende disso. O `acrescentarRevisao` (`tools/processo/documento-de-revisao.ts:156-164`) cola cada linha nova no fim do arquivo. A partir desta rodada, as linhas da 2ª rodada caem depois do bloco que fecha na linha 111, separadas da tabela e sem cabeçalho. O registro das revisões, que é o que se consulta na validação e na retro, sai partido.
   - **O que funciona assim mesmo:** o hook de commit continua lendo as linhas, porque o `lerRevisoes` filtra tudo de `## Revisões` em diante. O portão conta os 5 blocos, porque o `lerMutacoes` lê o documento inteiro. O que quebra é o documento.
   - **Correção exigida:** mover os dois blocos, com a frase que os apresenta, para `## Mutações`, logo depois do terceiro bloco (linha 71). Assim `## Revisões` fica só com o texto do hook e a tabela, e as linhas que o hook gravou depois da linha 111 nesta rodada se juntam à tabela.
   - **Depois de mover:** rodar `node tools/processo/portao-local.ts conferir tasks/correcoes/2026-11-10-verificar-sem-convite.md` de novo. Se ele disser que a seção "Mutações" mudou depois do último portão, rodar o comando que a mensagem indicar.

**Recomendações:**

- `e2e/verificar-email.spec.ts:86`: o JSDoc do `esperarSemLinks` é uma linha só, bem mais longa que as vizinhas. Vale quebrá-la como foi feito na linha 12.

O documento revisado é `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-10-verificar-sem-convite.md`.

## test-engineer · 2ª rodada · REPROVADO · 2026-11-10 10:53:53 · `tasks/correcoes/2026-11-10-verificar-sem-convite.md`

VEREDITO: REPROVADO

Cenários exigidos:
- Caminho feliz: quem confirma o e-mail vê "E-mail confirmado", a orientação de voltar à aba do convite e nenhum link para `/convite`. Depois o aceite segue.
- Link que não vale (vencido, usado, inventado): o mesmo aviso e nenhum link.
- Endereço sem token: o aviso aparece na hora, sem nenhum pedido à API, e sem link.
- Os mesmos dois estados em 360 px: nada a tocar, sem rolagem horizontal, sem violação grave.
- Casca sem `main`: não pode dar um falso verde na contagem de links.
- Permissão e isolamento: não se aplicam. A tela é anônima e a correção não mexe em API, dado nem rota.

Cobertos:
- As três recomendações da 1ª rodada foram feitas:
  - A ausência de links é afirmada depois do `goto('/verificar')`, em `e2e/verificar-email.spec.ts:222`.
  - O caso de 360 px do link que não vale agora chama `esperarSemLinks`.
  - O terceiro bloco ganhou a linha `falha: getByText(VOLTE_AO_CONVITE)`.
- A recomendação do tenancy-guardian também foi feita: `esperarSemLinks`, em `e2e/verificar-email.spec.ts:41-44`, confere que o `main` está visível antes de contar os links.
- Os dois blocos novos chegam à cláusula pelo motivo certo:
  - O 4º reintroduz "Abrir o convite" no estado que não vale. Cai em `getByRole('link')).toHaveCount(0)`, que existe no spec.
  - O 5º troca `<main>` por `<div>` em `CascaPublica.tsx:83/86`, que tem um `main` só. Cai em `getByRole('main')).toBeVisible()`.
  - O caso citado existe com o nome exato (`e2e/verificar-email.spec.ts:207`).
- O portão leu os 5 blocos: `.processo/portao.json` mostra `total: 5` e impressão `e1b3a49e3d04360d`, porque `lerMutacoes` lê o documento inteiro.
- Não há `.skip` nem mock de coisa nossa, e não há IA nem operação concorrente nesta correção.

Bloqueantes:
1. `tasks/correcoes/2026-11-10-verificar-sem-convite.md:89-111`: os dois blocos de mutação novos estão dentro de `## Revisões`, e não em `## Mutações` (linha 42).
   - **O que está errado:** essa seção é do hook e diz "Não edite à mão". O hook acrescenta cada rodada no fim do arquivo (`documento-de-revisao.ts:163`, `` `${conteudo}| ${revisao.inicio} | ... ``). Por isso as linhas desta 2ª rodada vão cair depois do fecho do 5º bloco, separadas da tabela. Quem lê `## Mutações` vê 3 blocos, enquanto a linha `--faltando` diz 5.
   - **Correção exigida:** mover os dois blocos, com a frase "Os dois blocos do e2e…", para o fim de `## Mutações`, logo depois do 3º bloco, na mesma ordem. `## Revisões` volta a ser só o texto do hook e a tabela. Com a ordem mantida, a impressão continua a mesma e o carimbo do portão segue valendo, então não é preciso rodar o portão de novo.

Recomendações:
- A unidade cobre o link "Continuar" no estado confirmado (1º bloco), mas nenhum bloco do e2e reintroduz esse link. Um 6º bloco citando o caso de `e2e/verificar-email.spec.ts:149` daria ao e2e a mesma prova que o 4º dá ao estado que não vale. É cobertura extra, não bloqueia.

## test-engineer · 3ª rodada · APROVADO · 2026-11-10 11:06:11 · `tasks/correcoes/2026-11-10-verificar-sem-convite.md`

VEREDITO: APROVADO

**Cenários exigidos:** estes não mudaram desde a 2ª rodada.
- E-mail confirmado: diz para voltar ao convite e não tem link para `/convite`.
- Link vencido, usado ou inventado: mostra o aviso e não tem link.
- Link usado depois de confirmar o e-mail.
- A casca perde o `main`, e "zero links" passaria por engano.
- Rede caída e "Tentar de novo".
- Resposta atrasada de um link anterior.

Esta tela não tem caso de permissão nem de isolamento: é anônima, e a correção não mexe em API nem em dado.

**Cobertos:**
- **Correção exigida 1, feita.** Os três blocos do e2e agora estão no fim de `## Mutações`, logo depois do 3º bloco, na mesma ordem (linhas 73-104 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-10-verificar-sem-convite.md`). `## Revisões` (linhas 106-123) voltou a ter só o texto do hook e a tabela.
- **Recomendação aplicada.** O 6º bloco (linhas 97-104) põe de volta `<a href="/convite">Continuar</a>` no estado confirmado. Ele cita o teste do Mailpit pelo nome exato, que confere com a linha 152 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/verificar-email.spec.ts`. Nesse teste, `esperarSemLinks(page)` (linha 166) roda depois do "E-mail confirmado" e da orientação (linhas 161-165). A mutação fica vermelha no `getByRole('link')).toHaveCount(0)` que o bloco declara, ou seja, pelo motivo certo.
- **O cabeçalho conta 6 blocos**, de acordo com o documento.
- **O diff em `e2e/verificar-email.spec.ts`** só quebra em várias linhas o comentário de `esperarSemLinks`. O comportamento do teste não muda.
- `apps/web` não mudou nesta rodada. O resto vale como aprovado na 1ª rodada.

**Bloqueantes:** nenhum.

**Recomendações:**
- Pelo prompt, o carimbo do portão continua valendo porque a ordem dos blocos não mudou. Só que o 6º bloco é novo e eu não tenho como ver se o portão o provou. A linha `--faltando: 0 linhas (6 blocos, 0 motivos)` no cabeçalho sugere que sim. Vale a validação conferir que o portão (`tools/processo/mutacoes.ts`) rodou depois que o 6º bloco entrou, e não só antes.
