# Achados das revisões — `tasks/correcoes/2026-10-30-gaveta-aberta-na-alocacao.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-10-30 06:43:01 · `tasks/correcoes/2026-10-30-gaveta-aberta-na-alocacao.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/__fixtures__/casca.ts:69`: o código decide que a sessão chegou procurando o primeiro `p` dentro do `banner`. Se alguém mexer no markup da barra do topo, a espera pode olhar outro elemento e voltar a corrida sem dar sinal. Vale trocar por um alvo que identifique a sessão sem ambiguidade, como um `data-testid` ou o papel e o nome acessível do nome da escola.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/casca-no-celular.spec.ts:237`: `page.setDefaultTimeout(PRAZO_DA_ACAO_MS)` vale só para esta página, então não passa para os outros testes. Mesmo assim, uma linha avisando isso evita que alguém copie a chamada para um `beforeEach` e encurte o prazo de outros casos sem perceber.

A correção só muda o e2e (o ajudante de navegação e um caso novo); nenhuma linha de `apps/` nem de `packages/` muda. Com isso, nenhum item da regra 80 se aplica: limite de uso, fila, gateway de IA, estado em memória, índice, prova online, migration e métrica. O teste novo atrasa o `/v1/eu` com `page.route` e não chama provedor de IA.

## privacy-guardian · 1ª rodada · APROVADO · 2026-10-30 06:43:02 · `tasks/correcoes/2026-10-30-gaveta-aberta-na-alocacao.md`

VEREDITO: APROVADO

A correção mexe só no e2e (`e2e/__fixtures__/casca.ts` e `e2e/casca-no-celular.spec.ts`). Não muda nada em `apps/` nem em `packages/`, e por isso não há campo, rota, DTO, log, auditoria ou envio novo para auditar.

Campos pessoais tocados: nenhum. O teste novo só lê se o nome da escola apareceu na barra do topo, para saber que o `/v1/eu` voltou. Ele não grava esse nome e não o compara com nada.
Fora da tabela de dados do docs/lgpd.md: nada.
Autorização por objeto: ok. Nenhuma rota foi criada ou alterada. O `page.route('**/v1/eu')` só atrasa a resposta em 1,5 s e depois a deixa passar sem mudar nada.
Logs: limpos. A mensagem da asserção nova (`casca.ts:69`) é um texto fixo e não leva o nome da escola nem de pessoa.
Auditoria: presente. A tarefa não tem ação que exija registro.
Envio externo: nenhum.
Seed/fixture: sintético. O teste usa `criarEquipeComSenha('coordenador')` (`e2e/__fixtures__/sessao.ts:87-108`), que cria nomes com UUID ("Colégio sintético …", "Coordenadora sintética …"), e-mail em `@educa.invalid` e senha sintética.
Bloqueantes: nenhum.
Recomendações:
- `e2e/__fixtures__/casca.ts:69` acha o nome da escola por `getByRole('banner').locator('p').first()`, ou seja, pela estrutura da página. Se a barra do topo ganhar outro `<p>` antes do nome, a espera pode terminar cedo, antes de a sessão chegar. Isso não expõe dado nenhum. É assunto do `frontend-reviewer` e do `test-engineer`, e vale trocar por um seletor com rótulo próprio.

Pergunta de fechamento: a correção não muda o que o sistema guarda sobre um aluno nem para onde isso vai, então a resposta à secretaria continua a mesma de antes desta tarefa.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-10-30 06:43:07 · `tasks/correcoes/2026-10-30-gaveta-aberta-na-alocacao.md`

VEREDITO: APROVADO
Tela vista: sim (4 fotos lidas: `/coordenacao/estrutura`, computador e celular, escola cheia e vazia)
Estados: ok. A correção não toca em `apps/`. Na foto vazia, a tela de turmas mostra a turma de uma escola recém-semeada. Os estados de carregando e erro não mudam nesta tarefa.
Acessibilidade: sem mudança. O ajudante localiza a gaveta pelo papel `dialog` "Menu" e a navegação por `navigation "Seções"`, o que confirma o rótulo acessível das duas.
Chromebook fraco: não se aplica ao produto. O teste novo simula a sessão atrasada com `route` de 1,5 s no `/v1/eu`.
Celular: a foto a 360 px não tem rolagem horizontal nem texto cortado. O botão "Nova turma" é laranja e tem altura de cerca de 44 px. A barra de baixo com os quatro lugares (Painel, Analista, Escola, Registros) está à vista. Ela aparece sobre o cartão no meio da foto só porque é uma captura de página inteira com a barra fixa, e isso não é defeito. A tarefa adiciona um teste ao projeto `celular` (`e2e/casca-no-celular.spec.ts`).
Ação oficial protegida: sim, não se aplica. A tarefa só muda o ajudante de e2e, e nenhuma ação oficial é tocada.

Conferi a correção contra o código da árvore.
- **Causa e correção batem com a casca.** `apps/web/src/componentes/CascaDaEscola.tsx:339` desenha o `<p>` com `dados?.escola.nome`. Ele fica vazio até o `/v1/eu` chegar, e a barra do topo com o botão do menu já existe antes disso (linha 327). O localizador `getByRole('banner').locator('p').first()` com `not.toBeEmpty` é portanto um sinal confiável de que a sessão chegou. Só há um `<p>` no `banner`.
- **Ordem do ajudante.** `irPelaNavegacao` (`e2e/__fixtures__/casca.ts:85-90`) só espera a sessão quando está na largura do celular (`naGaveta`) e `Seções` não está à vista. Em seguida olha `Seções` de novo e só então abre a gaveta. No professor e no aluno, `Seções` já está à vista e nada muda.
- **Prazo.** `PRAZO_DA_ENTRADA_MS` é uma `const` do módulo, definida na linha 129 e lida só em tempo de chamada, então não há problema de ordem de inicialização.
- **Teste.** `e2e/casca-no-celular.spec.ts:228-247` segura o `/v1/eu` por 1,5 s depois do `page.reload()`, vai a "Escola" e confere a URL e que a gaveta está fechada. O bloco de mutação troca a espera por `Promise.resolve()`, o que reabre a corrida, então o teste prova a correção.

Bloqueantes: nenhum
Recomendações:
- Os dois comentários de `esperarASessaoNaBarraDoTopo` e `irPelaNavegacao` dizem o mesmo. Um deles basta.
- A espera depende de o nome da escola vir no `<p>` do topo. Se esse elemento ganhar um `aria-label` ou um `data-testid` no futuro, vale usá-lo no ajudante.

## test-engineer · 1ª rodada · APROVADO · 2026-10-30 06:44:05 · `tasks/correcoes/2026-10-30-gaveta-aberta-na-alocacao.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- Caminho feliz: a coordenação no celular recarrega a página com o `/v1/eu` atrasado, chega a "Escola" pelo ajudante e a gaveta não fica aberta.
- Borda 1: a sessão chega antes da primeira olhada em `Seções`. Fica igual a antes, porque `Seções` já está à vista e o ajudante nem espera.
- Borda 2: professor e aluno no celular, que têm a barra de baixo. Se o ajudante for chamado antes de a sessão chegar, ele agora espera e não abre a gaveta à toa.
- Borda 3: a gaveta já aberta por outro motivo continua fechando antes, pelo bloco do `Escape`, que não mudou.
- Borda 4: no trilho e no computador (`naGaveta` falso) o ajudante não espera nada.
- Permissão e isolamento: não se aplicam. Nenhuma linha de `apps/` muda e nenhum dado de escola é tocado.

**Cobertos:**
- O caso que a correção pede tem o seu teste, citado pelo nome exato: `e2e/casca-no-celular.spec.ts:228`, "a coordenação chega a uma seção pelo ajudante mesmo com o /v1/eu atrasado depois do recarregamento: a gaveta não fica aberta por cima da barra de baixo".
- O teste segura o `/v1/eu` por `page.route` com atraso, que é um servidor de teste que demora, e não depende de carga na máquina.
- A asserção é sobre o resultado. A coordenação entra em `/coordenacao/painel` (`casca.ts:292`), e o teste exige a URL `/coordenacao/estrutura` (o "Escola" de `apps/web/src/areas/navegacao.ts:56`) e a gaveta escondida. Ele não passaria de graça.
- O bloco de mutação troca exatamente a linha nova (`casca.ts:88`) por `Promise.resolve()`. Sem a espera, o ajudante toca no menu antes de a sessão chegar, a barra de baixo aparece por baixo da gaveta e o toque em "Escola" é interceptado. O teste fica vermelho em 15 s (`setDefaultTimeout`), que é o motivo certo.
- A espera usa o primeiro `<p>` do `banner`. Conferi na casca: esse `<p>` é o `{dados?.escola.nome}` em `CascaDaEscola.tsx:341`, que fica vazio até o `/v1/eu` voltar.
- Não há `.skip`, nem teste comentado, nem mock que esconda a regra. Não há IA envolvida.
- Concorrência: o caso é uma corrida de UI contra a resposta da rede e está reproduzido com atraso real. Não há operação que precise de duas chamadas em paralelo.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `e2e/casca-no-celular.spec.ts:24`: o atraso de 1.500 ms só deixa uma margem pequena para a mutação dar vermelho. Com a correção, o verde não depende de tempo, porque o ajudante espera a sessão. Já o vermelho sem a correção exige que o toque no menu aconteça antes de a resposta voltar, contado do pedido e não do fim do `page.reload()`. Num runner carregado a mutação pode passar verde, e o teste deixaria de pegar a volta do defeito sem ninguém notar. Subir o atraso para uns 4 a 5 s cabe no `test.slow()` e fecha essa janela.
2. `e2e/__fixtures__/casca.ts:89`: o segundo `if (!(await secoes(...).isVisible()))` não tem bloco próprio. Trocá-lo por um `abrirNavegacao` incondicional também deixaria o teste vermelho, então ele está coberto de fato. Isso é código de `__fixtures__/` e o RF17 não exige o bloco; fica só como registro.
3. O sintoma original, `e2e/alocacao.spec.ts:85` no projeto celular, não está entre os testes que a árvore alterou, então o portão da tarefa não o roda. Vale confirmar no veredito da esteira da spec que ele ficou verde, e não só o caso novo que o reproduz.
4. `esperarASessaoNaBarraDoTopo` acha a sessão pelo primeiro `<p>` do `banner`, que é posicional. Se alguém puser outro `<p>` antes do nome da escola na barra do topo, a espera passa a olhar o lugar errado sem avisar. Um nome acessível ou um seletor mais preso ao nome da escola deixaria isso mais firme.

Não rodei o e2e. Ele precisa da pilha no ar, e o vermelho da mutação já foi provado pelo portão.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/correcoes/2026-10-30-gaveta-aberta-na-alocacao.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/__fixtures__/casca.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/casca-no-celular.spec.ts

## test-engineer · 2ª rodada · APROVADO · 2026-10-30 07:03:56 · `tasks/correcoes/2026-10-30-gaveta-aberta-na-alocacao.md`

**VEREDITO: APROVADO**

**Cenários exigidos:** o ajudante de navegação, depois de um `page.reload()` com o `/v1/eu` atrasado no celular, não abre a gaveta antes de a sessão chegar, e chega à seção pela barra de baixo com a gaveta fechada. O documento declara uma mutação, que precisa deixar esse caso vermelho pelo motivo certo. Esta é uma correção de ajudante de e2e, sem `apps/`: não há caso de permissão, de isolamento nem de concorrência a cobrar.

**Cobertos:**

- **(a) A professora reproduz a mesma corrida da coordenação.** O caminho do código é o mesmo:
  - Antes da sessão, a casca desenha `itens = []` (`apps/web/src/componentes/CascaDaEscola.tsx:265`). Não há `navigation "Seções"` em lugar nenhum: a gaveta só desenha o `<nav>` com `itens.length > 0` (`CascaDaEscola.tsx:87`), e a barra de baixo só aparece com `naBarraDeBaixo` (`:267`, `:383`). O botão "Abrir o menu" já está no `header` (`:327-337`).
  - A professora tem 4 itens (`apps/web/src/areas/navegacao.ts:64-68`), a coordenação também tem 4 (`:53-57`), e `MAXIMO_NA_BARRA = 4`. As duas vão para a barra de baixo quando a sessão chega. A diferença de papel não muda nada na corrida.
  - `criarEquipeComSenha()` grava `introducao_vista_em = now()` por padrão (`e2e/__fixtures__/sessao.ts:62`). A professora abre em `/professor/nova-conversa`, que não é tela de foco, e o `header` e a gaveta existem.
  - O sintoma original (`irPelaCoordenacao` → `irPelaNavegacao`, `e2e/__fixtures__/coordenacao.ts:76`) passa pelo mesmo ajudante.
- **A mutação continua vermelha pelo motivo certo.** Com `Promise.resolve()` no lugar da espera, `irPelaNavegacao` não vê `Seções` e toca no menu, e o `showModal()` abre a gaveta. Quando o `/v1/eu` volta, a gaveta não fecha: `usuarioDaGaveta` começou `undefined`, então de ninguém para alguém não conta como troca de pessoa (`CascaDaEscola.tsx:219-226`). A barra de baixo aparece por baixo do `dialog` modal, e o toque em "Criados" é interceptado até o prazo de 15 s do `setDefaultTimeout`. O vermelho vem de a gaveta interceptar o toque, não de erro de carga. Com a correção, o ajudante espera o nome da escola no `banner` (`casca.ts:72-76`), vê `Seções` na barra e não abre a gaveta. As asserções finais são sobre o resultado: a URL é `/professor/criados$` e a gaveta está escondida.
- **(b) Os 3 s ainda fecham a janela da recomendação 1.** O atraso conta a partir do pedido do `/v1/eu`, que nasce quando a casca monta, junto com o botão do menu. O toque precisa só de duas checagens `isVisible` e de um `tap`, e a rede móvel lenta do projeto `celular` ainda soma tempo à resposta. A margem é o dobro da 1ª rodada. Se um runner perder a janela, a consequência fica à vista: a mutação passaria verde e o portão a recusaria. Não há falso verde escondido na esteira, porque com a correção o caso fica verde de qualquer jeito. A troca de 4 a 5 s por 3 s está justificada no documento pela metade do prazo que o portão cobra.
- **(c) A troca de cenário não deixa caso do documento sem teste.** O nome do caso em `e2e/casca-no-celular.spec.ts:232` é o mesmo de "Teste que reproduz" e do bloco de mutação. A linha de contexto do bloco bate com `casca.ts:89`. O cenário da coordenação não perde nada que lhe seja próprio: nenhum papel passa hoje de 4 itens, e o caminho "Seções continua na gaveta" não existe. O `entrarComoCoordenacaoNaMesmaAba` continua importado e é usado na linha 213, então não sobra import solto.

**Bloqueantes:** nenhum.

**Recomendações:**

1. **A margem na esteira ficou menor.** `e2e/casca-no-celular.spec.ts:232`: tirar o `test.slow()` não muda nada no portão, que o ignora porque o caso é novo, mas tira margem na esteira. O caso leva de 12 a 13 s na máquina, perto de 25 s no runner, e o teto lá volta a ser 30 s (cerca de 83%). Recolocar `test.slow()` vale só para a esteira e não custa nada no portão.
2. **A recomendação 3 da 1ª rodada continua aberta.** Falta ver `e2e/alocacao.spec.ts:85` [celular] verde na esteira, porque o caso novo prova o ajudante e não o spec do sintoma. O documento já entrega isso ao Orquestrador.
3. **O seletor posicional `getByRole('banner').locator('p').first()`** já está registrado no `TODO.md`. Nada a acrescentar.

Arquivos conferidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/casca-no-celular.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/__fixtures__/casca.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/componentes/CascaDaEscola.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/areas/navegacao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/correcoes/2026-10-30-gaveta-aberta-na-alocacao.md
