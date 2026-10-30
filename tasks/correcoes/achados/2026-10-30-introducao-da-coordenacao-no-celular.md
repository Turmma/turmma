# Achados das revisões — `tasks/correcoes/2026-10-30-introducao-da-coordenacao-no-celular.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-10-30 04:47:34 · `tasks/correcoes/2026-10-30-introducao-da-coordenacao-no-celular.md`

VEREDITO: APROVADO
Tabelas verificadas: nenhuma. A correção não cria nem altera migration, schema ou tabela.
Queries verificadas: nenhuma nova. O único dado lido é o `/v1/eu`, que já existia, e dele só se usa `dados?.usuarioId` para decidir quando a gaveta fecha. Nenhum endpoint novo, e nenhum `escolaId` vem do corpo ou da query.
Teste de isolamento: não se aplica. A mudança é só do frontend e não toca escopo de dado. O que interessa ao isolamento é a gaveta fechar quando a pessoa troca, e isso continua garantido. Quando a sessão passa de A para `undefined` e depois para B, a ref guarda A e fecha a gaveta quando B chega. Quando o `/v1/eu` traz outra pessoa, o efeito de `lembrarQuemEsta` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/componentes/CascaDaEscola.tsx:186-193`) continua navegando para o início. Os testes que já existiam, "a pessoa da sessão troca sob o mesmo caminho" e "a rota troca com a gaveta aberta", seguem cobrindo esses casos, e as mutações do documento da tarefa apontam para eles.
Bloqueantes: nenhum
Recomendações:
- O comentário em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/componentes/CascaDaEscola.tsx:213` diz que a gaveta fecha também na troca de escola, mas as dependências dos efeitos só observam `usuarioId` e `caminho`. Isso já era assim antes desta correção, e o próprio arquivo de teste diz que a troca de escola é coberta por `areas.spec.ts`. Vale deixar no comentário que é a mudança de rota ou de pessoa causada pelo seletor que fecha a gaveta, e não a escola em si.

## privacy-guardian · 1ª rodada · APROVADO · 2026-10-30 04:47:50 · `tasks/correcoes/2026-10-30-introducao-da-coordenacao-no-celular.md`

VEREDITO: APROVADO

A correção mexe só no momento em que a gaveta do menu fecha no celular. Não entra dado novo, rota, campo, log nem envio. A gaveta continua fechando quando uma pessoa dá lugar a outra no mesmo computador, que é a parte que importa para a regra 20.

Campos pessoais tocados: nenhum. A casca já mostrava o nome da própria pessoa logada e continua mostrando, sem campo novo e sem DTO novo.
Fora da tabela de dados do docs/lgpd.md: nada.
Autorização por objeto: não se aplica. Só muda o front, e nenhuma consulta ou endpoint mudou.
Logs: limpos. Não há `console` nem logger em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/componentes/CascaDaEscola.tsx` nem no teste.
Auditoria: não se aplica. A mudança não envolve nenhuma ação que a regra 20, item 10, obrigue a auditar.
Envio externo: nenhum.
Seed/fixture: sintético. O teste usa UUIDs inventados (`PESSOA_A`, `PESSOA_B`) e nomes fictícios ("Camila Souza", "Beatriz Lima"). As fotos mostram "Colégio sintético da vitrine cheia/vazia" e "Coordenadora sintética f9723ba0 / 1045ea74".

O que olhei:
- **Gaveta aberta na troca de pessoa** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/componentes/CascaDaEscola.tsx:217-225`):
  - Quando o `/v1/eu` responde pela primeira vez (`undefined` para A), a gaveta fica aberta. Ainda não havia ninguém antes, então nada de outra pessoa fica à mostra.
  - De uma pessoa para outra (A para B), a gaveta fecha.
  - No caso de sair e outra pessoa entrar (A, depois `undefined`, depois B), o `return` antecipado não muda a última pessoa guardada, que segue sendo A. Quando B chega, a comparação com A dá diferente e a gaveta fecha. Quem senta depois no mesmo computador não pega o menu aberto da anterior.
- **Testes:** o caso que já existia, "a pessoa da sessão troca sob o mesmo caminho" (`CascaDaEscola.test.tsx:88`), segue protegendo a troca de A para B. Duas das mutações do documento dependem dele.
- **Fotos:** as seis mostram, para a própria coordenadora, só o nome sintético da escola e o dela. A tela `/coordenacao/agentes` não mostra aluno, nota, matrícula nem conversa. No celular o nome aparece truncado ("Colégio s..."), e isso é visual, fica com o `frontend-reviewer`. Não há foto da gaveta aberta, como o pedido avisou. O conteúdo dela é a mesma lateral do computador, já vista nas fotos de 1366 px.

Bloqueantes: nenhum.

Recomendações:
- Incluir em `CascaDaEscola.test.tsx` um caso de unidade com a pessoa A, depois sessão vazia (`undefined`), depois a pessoa B, conferindo que a gaveta fecha. Esse caminho existe por causa do `return` antecipado e hoje está protegido só pelo e2e `e2e/coordenacao-introducao.spec.ts:201`, de forma indireta. Se alguém mexer no `return` sem esse teste, o menu aberto de uma pessoa pode passar para a seguinte sem que nada quebre.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-10-30 04:47:51 · `tasks/correcoes/2026-10-30-introducao-da-coordenacao-no-celular.md`

VEREDITO: APROVADO

A mudança só altera quando a gaveta do celular se fecha (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/componentes/CascaDaEscola.tsx:215-231`). Não grava nada, não cria rota, campo nem consulta, não chama IA e não mostra dado novo. Antes, a gaveta fechava quando o `/v1/eu` chegava, porque a passagem de "ninguém" para alguém contava como troca de pessoa. Agora ela fecha só quando a rota muda ou quando uma pessoa conhecida é trocada por outra. Na troca de conta, a gaveta continua fechando: no logout o valor fica vazio e o efeito sai sem atualizar a última pessoa guardada. Quando a próxima pessoa chega, ela é diferente da guardada e a gaveta fecha. Por isso o menu da pessoa A não fica aberto na sessão da pessoa B. Enquanto o `/v1/eu` não volta, a gaveta não mostra pessoa nenhuma, então mantê-la aberta não expõe nada.

Caminhos de escrita em Nota: nenhum nesta tarefa. Todos com autor humano? sim (nenhum caminho foi criado nem mudou)
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok (nenhum fluxo de saída de IA foi tocado)
Supervisão do tutor: ok (não foi tocada)
Autonomia declarada e visível: sim. Em todas as seis fotos, `/coordenacao/agentes` mostra em português comum o que cada agente faz sozinho e o que espera aprovação. Também mostra os níveis "Faz e registra", "Faz e avisa" e "Propõe e espera aprovação", o selo de alto risco com avaliação de impacto, o botão "Suspender esta função" e a lista "O que a IA nunca faz". Essa lista cobre decisão sobre aluno, nota em discursiva e redação (D55), inferência emocional, ranking de professor e navegação fora de avaliação. O selo "IA" aparece ao lado do avatar do agente. Nenhuma foto mostra nota, conceito ou sugestão de nota. O "Sair" fica na barra do topo no celular e na lateral no computador, sem caminho mais longo que o de entrar (D59). As fotos da escola cheia e da vazia são iguais nesses pontos.

Bloqueantes: nenhum

Recomendações:
- Não há foto da gaveta aberta no celular, porque o clique da vitrine roda a 1366 px. Para a regra 70, o que importa ali é o rótulo de IA, o "Sair" e o "Rever a introdução" dentro da gaveta. Quando a vitrine aceitar clique na largura do celular, vale tirar essa foto.
- O teste novo (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/componentes/CascaDaEscola.test.tsx:108`) prova que a gaveta continua aberta quando o `/v1/eu` chega depois do toque no menu. A troca de pessoa A para B já era coberta pelo caso "a pessoa da sessão troca sob o mesmo caminho". Não há teste para A, depois logout (nenhuma pessoa), depois B, com a gaveta aberta. Esse caso garante que o menu de uma pessoa não fica aberto na sessão da seguinte. Hoje o código fecha a gaveta corretamente nesse caso, mas vale um teste que o fixe.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-10-30 04:47:59 · `tasks/correcoes/2026-10-30-introducao-da-coordenacao-no-celular.md`

VEREDITO: APROVADO
Tela vista: sim (6 fotos lidas, escola cheia e vazia, computador e celular). A gaveta aberta não está nas fotos, porque o comando clica a 1366 px, onde o botão não existe. Quem prova a gaveta aberta é o teste de unidade novo, e o e2e `coordenacao-introducao.spec.ts:201` [celular] confirma na esteira.
Estados: ok. Carregando, vazio, erro e com dado não mudam. A correção só mexe no momento em que a gaveta fecha.
Acessibilidade: sem regressão. O `dialog` modal, o foco devolvido ao botão pelo `close()` e o `aria-expanded` continuam como estavam. O teste novo confere `aria-expanded="true"` depois do `/v1/eu`.
Chromebook fraco: a correção é exatamente do caso CPU lenta e rede de escola, em que o `/v1/eu` chega depois do toque no menu. Não acrescenta render nem consulta.
Celular: nas fotos de 360 px não há rolagem horizontal nem texto cortado. O topo tem o menu, a escola, o sino e o Sair; a barra de baixo tem os quatro itens e o item ativo fica destacado. O botão do menu é alvo grande, o título das abas quebra em três linhas sem esconder nada, e as duas fotos (cheia e vazia) são iguais porque a tela não depende de dado. Nenhuma rolagem a 1366 × 768. O conserto devolve ao coordenador no celular um menu que abria e sumia.
Ação oficial protegida: sim. Não há ação oficial nesta tela nem na correção.
Bloqueantes: nenhum.
- `apps/web/src/componentes/CascaDaEscola.tsx:215-230`: a lógica está correta. Só a troca de uma pessoa por outra fecha a gaveta. Ninguém para alguém não fecha. Alguém para ninguém para outra pessoa continua fechando, porque a ref guarda a última pessoa conhecida. O efeito da rota ficou separado, com a rota anterior guardada.
- `apps/web/src/componentes/CascaDaEscola.test.tsx:108-125`: o teste segura o `/v1/eu`, abre a gaveta, libera a consulta, espera "Camila Souza" na lateral e confere que a gaveta segue aberta. Os 16 testes do arquivo passam na árvore atual.
- As quatro mutações do documento têm teste que as pega: a que tira o `!== undefined` é pega pelo caso novo, e as outras três pelos casos de troca de rota e de pessoa.

Recomendações:
- O comentário do cabeçalho de `CascaDaEscola.tsx:9-13` fala em "a coordenação, com sete" itens, mas a foto mostra quatro itens na barra de baixo. Convém conferir o texto em outra tarefa.
- O comentário da linha 213 ainda diz "pessoa ou escola". A troca de escola só fecha a gaveta se o `usuarioId` mudar entre as escolas, e o e2e `areas.spec.ts › troca de escola pelo seletor…` é quem cobre isso. Vale uma linha no comentário dizendo que a escola está coberta por esse e2e.

## test-engineer · 1ª rodada · REPROVADO · 2026-10-30 04:49:24 · `tasks/correcoes/2026-10-30-introducao-da-coordenacao-no-celular.md`

VEREDITO: REPROVADO

**Cenários exigidos**
- Caminho feliz: no celular, o menu é tocado antes de o `/v1/eu` voltar, a consulta chega e a gaveta continua aberta.
- Borda: a gaveta é aberta com a pessoa A conhecida, a sessão troca do jeito que a aplicação troca de verdade, e chega a pessoa B no mesmo caminho. A gaveta tem de fechar.
- Borda: a gaveta é aberta durante essa troca, entre a consulta esvaziada e a resposta de B. Ela tem de fechar quando B chega.
- Borda: a rota troca com a gaveta aberta. A gaveta fecha.
- Permissão: nenhum caso novo, a correção não mexe em quem pode o quê.
- Isolamento: a troca de escola pelo seletor não pode deixar a gaveta da sessão anterior aberta por cima da tela da escola nova.

**Cobertos**
- O caminho feliz tem teste novo em `CascaDaEscola.test.tsx:108`. A rede segura o `/v1/eu`, então a corrida é provada sem depender de tempo. As asserções são sobre o resultado: o atributo `open` e o `aria-expanded`.
- A rota tem teste em `CascaDaEscola.test.tsx:127`.
- A troca de A para B por `refetchQueries` tem teste em `CascaDaEscola.test.tsx:88`.
- Os quatro blocos de mutação citam testes que existem, pelo nome exato. Os blocos 1, 2 e 3 deixam o teste vermelho pelo motivo certo.
- Não há `.skip` nem teste comentado. A rede falsa não esconde a regra. O arquivo roda verde: 16 de 16.

**Bloqueantes**

1. **A troca de pessoa como a aplicação faz não tem teste de unidade.** Linhas `apps/web/src/componentes/CascaDaEscola.tsx:220-222`, testes em `apps/web/src/componentes/CascaDaEscola.test.tsx:88` e `:127`.
   - **Como a troca acontece.** O `aoTrocarDeSessao` em `apps/web/src/main.tsx:35-37` chama `resetQueries()`. Então `dados` passa de A para `undefined` e depois para B. O teste da linha 88 usa `refetchQueries`, que vai de A direto para B e nunca passa pelo `undefined`.
   - **O que a cláusula nova protege.** O `if (usuarioDaSessao === undefined) return` vem antes de `usuarioDaGaveta.current = usuarioDaSessao`. Isso guarda A como a última pessoa conhecida durante o esvaziamento. Nenhum teste de unidade passa por esse caminho.
   - **Duas mudanças que passam despercebidas.** Pela leitura do código, os 16 testes continuariam verdes com qualquer uma delas:
     - (a) apagar a linha 220 inteira;
     - (b) subir a atribuição da linha 222 para antes do `return`.
   - **O efeito da (b).** A referência vira `undefined` no esvaziamento. Quando B chega, `trocouDePessoa` dá falso, e a gaveta da pessoa anterior fica aberta sobre a sessão de B. Na troca de escola pelo seletor, a gaveta fica aberta por cima da escola nova.
   - **Por que o bloco 4 não prova a cláusula.** O bloco inverte a condição para `!==` e fica vermelho porque desliga todo fechamento por pessoa. É vermelho pelo motivo errado, porque o cenário não chega ao que a cláusula garante.
   - **A única proteção hoje.** É o e2e `e2e/areas.spec.ts:623` ("troca de escola pelo seletor..."). Esse arquivo não foi alterado, então não roda no portão da tarefa, só na esteira.
   - **Correção exigida.** Um caso novo em `CascaDaEscola.test.tsx`:
     1. Abrir a casca com A, na largura `'media'` ou `'estreita'`.
     2. Fazer `const b = rede.segurar()` e depois `void cliente.resetQueries()`, como o `main.tsx` faz.
     3. Esperar a consulta ficar vazia e só então tocar em "Abrir o menu". Conferir que a gaveta abriu.
     4. Fazer `b.liberar(respostaEu('coordenador', PESSOA_B, 'Beatriz Lima'))`.
     5. Exigir a gaveta fechada e `aria-expanded="false"`.

     O bloco de mutação da linha 220 (ou um bloco novo) passa a citar esse caso, com uma mutação que apague a linha ou suba a atribuição da linha 222 para antes dela. As duas deixam esse caso vermelho. Opcional: trocar o `refetchQueries` do teste da linha 88 por `resetQueries`, para o caso existente seguir o caminho real.

**Recomendações**
- Em `CascaDaEscola.test.tsx:108`, o `waitFor` sobre o `textContent` da gaveta funciona como ponto de sincronia, porque o `textContent` lê também conteúdo de `dialog` fechado. Seria mais explícito esperar `rede.chamadas` ter o `/v1/eu` respondido, ou o nome aparecer na barra visível.
- Deixar escrito no documento que A, depois `undefined`, depois A de novo (a mesma pessoa voltando) não fecha mais a gaveta. Antes fechava, na passagem pelo `undefined`. A mudança parece aceitável, mas é comportamento novo e merece ficar registrada.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/componentes/CascaDaEscola.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/componentes/CascaDaEscola.test.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/main.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/e2e/areas.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/tasks/correcoes/2026-10-30-introducao-da-coordenacao-no-celular.md`

## test-engineer · 2ª rodada · APROVADO · 2026-10-30 05:01:03 · `tasks/correcoes/2026-10-30-introducao-da-coordenacao-no-celular.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- Caminho feliz: a gaveta abre no celular e continua aberta.
- Borda 1: o `/v1/eu` volta depois do toque no menu (a pessoa passa de ninguém a alguém), e a gaveta não fecha.
- Borda 2: a troca de pessoa feita como a aplicação faz, de A para `undefined` (pelo `resetQueries` do `aoTrocarDeSessao`) e de `undefined` para B. A gaveta aberta no meio fecha.
- Borda 3: A troca direto por B sob o mesmo caminho, e a gaveta fecha.
- Borda 4: a rota troca com a gaveta aberta, e ela fecha.
- Permissão e isolamento: não se aplicam. A correção só muda o momento em que a gaveta fecha, sem dado, rota ou campo novo. A troca de escola fica com o e2e `e2e/areas.spec.ts:623`.

**Cobertos:**
- A correção exigida na rodada 1 foi feita, passo a passo. O caso novo está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/apps/web/src/componentes/CascaDaEscola.test.tsx:126`. Ele abre a casca com A na largura `'estreita'`, segura o pedido com `rede.segurar()`, chama `void cliente.resetQueries()` e espera `getQueryData` ficar `undefined`. Depois toca em "Abrir o menu", confere a gaveta aberta, libera B e exige a gaveta fechada com `aria-expanded="false"`.
- O documento passou a citar esse caso em dois blocos de mutação:
  - O bloco 4 apaga o `if (usuarioDaSessao === undefined) return`.
  - O bloco 5 sobe a atribuição da última pessoa para antes do `return`.
- Fiz o raciocínio das duas mutações. Em ambas a referência vira `undefined` no esvaziamento, B chega com `trocouDePessoa` falso e a asserção da gaveta fechada (linhas 143 a 145) fica vermelha. O vermelho vem pelo motivo certo, a cláusula que protege a última pessoa conhecida, e não por desligar todo fechamento, como acontecia com o bloco 4 da rodada 1. O portão já tinha provado as mutações.
- A ordem dos eventos não depende de corrida. A notificação do esvaziamento entra na fila antes do `liberar`, e a de B só entra depois dele. Por isso o desenho com `undefined` sempre acontece antes de B chegar.
- As duas recomendações da rodada 1 foram feitas:
  - No caso do `/v1/eu` tardio, a espera agora é pelo nome que vem da consulta (`findByText('Camila Souza')`, linha 121), e não pelo `textContent` da gaveta.
  - O documento registra que A, depois `undefined`, depois A de novo já não fecha a gaveta (seção "Correção", linhas 40 a 43).
- `npx vitest run src/componentes/CascaDaEscola.test.tsx` passou duas vezes: 17 de 17.
- Não há `.skip`, teste comentado nem mock que esconda a regra. A rede é falsa, e a casca, o cliente de consultas e as rotas são os de verdade.
- O comentário novo diz que a troca de escola pelo seletor fecha a gaveta porque muda a pessoa. O e2e `e2e/areas.spec.ts:623` sustenta isso: ele confere a gaveta escondida depois da troca, na mesma rota.

**Bloqueantes:** nenhum.

**Recomendações:**
- O comportamento A, depois `undefined`, depois A de novo (a gaveta continua aberta) está escrito no documento, mas nenhum teste o fixa. Um caso curto, igual ao da linha 126 mas liberando A em vez de B, guardaria esse comportamento contra uma volta ao jeito antigo.
- A seção "Teste que reproduz" do documento cita só o primeiro caso novo. O segundo só aparece na "Correção" e nos blocos de mutação. Vale citá-lo também nessa seção, pelo nome.
