# Achados das revisões — `tasks/prd-semana-do-professor/8_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-07 00:12:44 · `tasks/prd-semana-do-professor/8_task.md`

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
- A tarefa só mexe no frontend, sem endpoint, query, job ou migration novos. O que ela acrescenta de carga é um `GET /v1/meus-vinculos` a cada abertura do Hoje da turma, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/web/src/areas/professor/turmas/TurmaHoje.tsx:77`. É uma leitura que já existia e é paginada. Ela usa a mesma chave de cache da Semana (`['meus-vinculos']`), dura 30 s no cache (`staleTime`) e não se repete sozinha. Não pesa às 10h.
- O Hoje e o filtro da Semana leem só a primeira página de vínculos, sem `fetchNextPage`. Uma professora com mais vínculos do que cabem na página padrão ficaria sem link para alguns pares de turma e disciplina. Hoje isso não acontece com ninguém. Vale registrar no TODO, porque o problema vem da 6.0 e esta tarefa passou a depender dele também.
- `e2e/support/atividade-db.ts`: a espera pela correção ao encerrar continua sendo um laço com `setTimeout(500)` e sem prazo próprio. A trava é o tempo-limite do teste. Um teto explícito daria uma mensagem de falha mais clara.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-07 00:12:47 · `tasks/prd-semana-do-professor/8_task.md`

**VEREDITO: APROVADO**

A tarefa só mexe na tela, em cima do contrato da 3.0. Não há endpoint, migration, gravação, log nem envio novo. Não vieram fotos da tela no prompt, então a auditoria se baseou só no código.

- **Campos pessoais tocados:** nenhum campo novo. A tela usa o `ItemDoDia` já existente, um `z.strictObject` com tipo, ids da turma, da disciplina e da atividade, título e estado, definido em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/shared/src/semana/semana.ts:55-63`. Ele não traz nota, acerto, nome de aluno nem autor. O link do Hoje usa só o nome da turma e o da disciplina, lidos dos próprios vínculos da professora (`meus-vinculos`).
- **Fora da tabela de dados do `docs/lgpd.md`:** nada.
- **Autorização por objeto:** ok.
  - Os itens levam a rotas que já existem e já têm autorização por objeto: `/professor/turmas/<id>?aba=atividades&atividade=<id>` e `/professor/aprovar/<id>`. Quem troca o id na URL bate na mesma barreira de antes.
  - O filtro `?turma=` (`diasFiltrados`, `semana.ts:722-727`) só esconde na tela o que a `GET /v1/semana` já devolveu dentro do escopo. Ele não amplia nada.
  - Na URL vão só UUIDs, sem título nem nome (`semana.ts:758-761`).
- **Logs:** limpos. Não há `console`, `logger` nem uso de `localStorage` ou `sessionStorage` no diff.
- **Auditoria:** não é exigida aqui. Quem lê é a professora da turma, não a coordenação nem a rede, e a tarefa não exporta, não altera nota, não altera permissão e não aprova saída de IA. O item só leva à revisão, e a aprovação continua no fluxo que já existe.
- **Envio externo:** nenhum.
- **Seed/fixture:** sintético. O aluno sai de `criarAlunoComMatricula`, com o nome "Aluno sintético <uuid>" (`e2e/support/seed.ts:183`). A mudança em `e2e/support/atividade-db.ts` só separa `encerrar` de `encerrarEAprovar` e não cria dado.
- **Exposição na tela:**
  - O e2e confere que os itens não mostram palavras de nota, acerto ou percentual, e que o nome do aluno não aparece na página (`e2e/professor-semana-itens.spec.ts:105-107`).
  - O teste de unidade confere a ausência de nota, conceito e pontuação (`ItensDoDia.test.tsx:66-70`).
  - A correção do Assistente leva o selo "IA".
- **Pergunta de fechamento:** a tarefa não guarda nem envia nada novo sobre o aluno, então a resposta do sistema continua a mesma de antes.

**Bloqueantes:** nenhum.

**Recomendações:**
1. O `titulo` da atividade é texto livre escrito pela professora e agora aparece também na Semana (`apps/web/src/areas/professor/turmas/semana/ItensDoDia.tsx:30`). Se ela puser o nome de um aluno no título (por exemplo "Recuperação do João"), o nome passa a aparecer aqui também. Hoje só a professora da turma vê essa tela, então o risco é baixo. Vale levar à retro a ideia de um aviso no campo de título, igual ao do painel da aula ("não escreva nome de aluno").
2. O teste de unidade `ItensDoDia.test.tsx` prova a falta de nota, mas não a falta de nome de aluno. Hoje quem garante isso é o contrato `strictObject` e o e2e. Se o schema um dia ganhar um campo, falta um teste de unidade que quebre na hora: um caso que confira que as chaves do `itemDoDiaSchema` são exatamente as atuais.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-07 00:12:48 · `tasks/prd-semana-do-professor/8_task.md`

VEREDITO: APROVADO
Tela vista: sim (8 fotos lidas, cheia e vazia: Hoje da turma aberta e Semana, no computador e no celular). A Semana com itens do dia não tem foto, porque a vitrine não importa grade. Revisei essa parte pelo código (`ItensDoDia.tsx`, `DiaDaSemana.tsx`, `semana.ts`) e pelo spec `e2e/professor-semana-itens.spec.ts`. Não rodei nenhum teste.
Estados: ok. O vazio da Semana convida ("A coordenação ainda não importou a grade… você não precisa cadastrar nada") e diz o próximo passo. Carregando e erro da Semana são da 6.0 e não mudaram. No Hoje, o link "Ver a semana desta turma" só aparece com vínculo confirmado lido. Enquanto carrega, ou se a leitura falha, a fileira some sem quebrar a tela, e a decisão está documentada no código e coberta por mutação.
Acessibilidade:
- Cada item do dia é um `<Link>` com nome acessível "tipo · estado: título" e alvo `min-h-11` (44 px). O estado é texto, nunca só cor.
- O selo "IA" aparece só na correção do Assistente, e o nome acessível já diz "Correção do Assistente".
- A lista tem rótulo ("O que aconteceu neste dia").
- Os links do Hoje usam `SECONDARY_LINK_CLASSES`, com 44 px e o foco do componente existente.
- Nada de nota, acerto ou nome de aluno no item, e o e2e verifica `VOCABULARIO_DE_NOTA`.
Chromebook fraco: sem peso novo. Os itens são poucos por dia e vêm do mesmo `GET /v1/semana`, sem requisição nova. O Hoje reaproveita `meusVinculosQueryOptions`, que já estava em cache. A caixa de 1366 × 768 está coberta pelo e2e (`soOPainelDaAbaRola` com 45 aulas e itens), e a lista `Rolam` veio vazia.
Celular: nas fotos de 360 px não há rolagem horizontal nem corte. O botão "Ver a semana desta turma" tem 44 px, e o título e o filtro cabem. O item usa `min-w-0`, `break-words` e `flex-wrap`. O e2e mede `horizontalOverflow` com os itens à vista no projeto `celular`. Nada depende de hover: `hover:bg-fundo-suave` é só realce, e o toque funciona por link.
Ação oficial protegida: sim. Os itens só navegam. A correção leva à revisão (`/aprovar/<id>`), onde a aprovação continua explícita, e nada oficial acontece pelo item.
Bloqueantes: nenhum.
Recomendações:
- `TurmaHoje.tsx:137-143` (e o caso e2e das duas disciplinas): com duas ou mais disciplinas, o rótulo vira "VER A SEMANA DESTA TURMA · MATEMÁTICA" em caixa-alta. Em 360 px isso passa de uma linha e quebra para a segunda, o que `FORMA_COM_TEXTO` permite sem estourar. O e2e das duas disciplinas não mede `horizontalOverflow` nem a altura do link, então vale acrescentar essa checagem. Também falta `text-center` para a linha quebrada não ficar à esquerda dentro do botão. É acabamento, e a foto de 360 px com um vínculo está ok.
- `ItensDoDia.tsx:27`: o `aria-label` não contém a palavra "IA" que aparece no selo. Nome acessível que não repete texto visível é pequeno desvio de "label in name" (WCAG 2.5.3), mas o tipo "Correção do Assistente" já diz que é IA. Considere `aria-label` só no tipo e no título, sem esconder o texto visível, ou manter como está.
- Estados de carregando e erro do Hoje não existem para o link da semana (a fileira some em silêncio). É aceitável para ação secundária, mas, se a leitura de vínculos falhar, a professora não sabe por que o atalho não apareceu.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-07 00:12:58 · `tasks/prd-semana-do-professor/8_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum novo. A tarefa só mexe na tela. O único ponto de backend tocado é o suporte de teste `e2e/support/atividade-db.ts`, que ganhou `encerrar`. Esse passo só encerra a atividade e deixa a correção pendente. `encerrarEAprovar` continua aprovando pela API com a sessão da professora (`/v1/entregas/:id/aprovar-lote`). Todos com autor humano? Sim.

Decisão autônoma sobre aluno: ausente. Os itens só levam a outra tela. Nenhum aprova, reprova ou encaminha aluno, nem como sugestão.

Aprovação registrada: ok. O item da correção mostra o estado de hoje da entrega, que vem da tabela de `packages/shared` ("Para revisar", "Aprovada", "Rejeitada"). Ele leva à revisão já existente (`/professor/aprovar/<id>`), onde a aprovação ou a rejeição continua com a professora. Nenhum caminho novo pula essa etapa.

Supervisão do tutor: ok. O tutor não foi tocado.

Autonomia declarada e visível: sim. A governança não foi tocada.

Outros pontos conferidos:
- **Item 7, supervisão não é vigilância:** o item tem só tipo, turma, disciplina, id da atividade, título e estado. O schema fecha os campos com `z.strictObject` em `packages/shared/src/semana/semana.ts:56`. Não há nota, acerto nem nome de aluno.
- **Testes do item 7:** o e2e prova a ausência em `e2e/professor-semana-itens.spec.ts:105-107`, com `VOCABULARIO_DE_NOTA`, `\d+ de \d+|%|acert` e o nome do aluno que respondeu. A unidade prova de novo em `ItensDoDia.test.tsx:103-107`.
- **Item 8, discursiva e redação (D55):** nenhum campo, tela ou texto sugere nota.
- **Item 9 e D64:** a lista não conta itens, e não há métrica de professor.
- **Item 4a, selo de IA:** a correção do Assistente leva o selo "IA" (`ItensDoDia.tsx:27`), e só ela. Isso é provado em `ItensDoDia.test.tsx:89-93`, com mutação registrada.
- **Testes de unidade:** rodei os do diretório `semana` e o `TurmaHoje.test.tsx`: 4 arquivos, 88 testes, todos passaram.

Fotos da tela: o prompt não trouxe fotos, então a conferência visual não foi feita.

Bloqueantes: nenhum.

Recomendações:
1. Em `apps/web/src/areas/professor/turmas/semana/ItensDoDia.tsx:21`, o `aria-label` do link substitui o conteúdo dele. Com isso, quem usa leitor de tela não ouve o "gerado por inteligência artificial" do `AIBadge`, porque o `sr-only` fica dentro de um `span aria-hidden`. O nome "Correção do Assistente" já aponta o agente, por isso não bloqueia. Ainda assim, convém incluir a marca de IA no nome acessível da correção, para alinhar ao item 4a. Uma forma: tirar o `aria-label` e deixar o texto visível formar o nome.
2. A expressão de `ItensDoDia.test.tsx:106` não inclui "acert". Hoje só o e2e cobre essa palavra; vale igualar a unidade ao e2e.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/web/src/areas/professor/turmas/semana/ItensDoDia.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/web/src/areas/professor/turmas/semana/semana.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/web/src/areas/professor/turmas/TurmaHoje.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/e2e/professor-semana-itens.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/e2e/support/atividade-db.ts

## revisor-geral · 1ª rodada · APROVADO · 2026-11-07 00:13:17 · `tasks/prd-semana-do-professor/8_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

Recomendações:
- `tasks/prd-semana-do-professor/8_task.md:99`: a segunda divergência diz que está em "`cenarios.md` T6 e S9". O `cenarios.md` só mudou no T5, e nem T6, nem S9, nem T8 dizem que a semana sem aula mas com item não é vazia, nem que o `?turma=` corta os itens. A decisão está na `techspec.md` §9, então não é divergência só no `N_task.md`. Mesmo assim, a citação aponta para onde a decisão não está. Acrescente meia linha ao T6 e ao T8, ou corrija a citação para dizer só `techspec.md` §9.
- `apps/web/src/areas/professor/turmas/TurmaHoje.tsx:153`: o atributo `data-semana-da-turma` só existe para o teste de unidade achar a fileira. O teste pode procurar o contêiner pelos links, e o atributo sai do código de produção.
- `apps/web/src/areas/professor/turmas/semana/Semana.test.tsx`, caso "no celular o item aparece com o dia que o tem": confere só que o link existe. Não confere que ele está no dia mostrado pelo `DaySelector`, nem que some quando se escolhe outro dia. Vale reforçar, ou tirar o caso, que o e2e `celular` já cobre.
- `e2e/professor-semana-itens.spec.ts:110`: o caso do filtro corta um item que é de outra turma e de outra disciplina ao mesmo tempo, e o título promete "outra turma e disciplina". O corte de cada cláusula sozinha está provado em `semana.test.ts`, então não falta prova, mas o título do e2e promete mais do que ele separa.

Conferido sem achado:
- As subtarefas 8.1 a 8.4 foram feitas.
- As mudanças em `semana.ts`, `Semana.tsx` e `atividade-db.ts`, fora dos arquivos previstos, estão declaradas na tabela e são necessárias: `encerrar` foi separado de `encerrarEAprovar` sem mudar o comportamento de quem já o usava.
- Nada da 7.0 foi feito aqui.
- A regra das opções do filtro ficou numa função só, `turmasEDisciplinasDosVinculos`, que o filtro da Semana e o Hoje usam. Antes dela havia um segundo jeito de montar essas opções.
- Os rótulos vêm de `rotuloDoItem` em `packages/shared`, sem texto local.
- O item não leva nota, acerto nem nome de aluno, e a correção leva o selo "IA".
- O endereço dos links leva só ids.
- Não sobrou `any`, `.skip` nem `TODO`.

## test-engineer · 1ª rodada · APROVADO · 2026-11-07 00:13:49 · `tasks/prd-semana-do-professor/8_task.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- Caminho feliz: um item por tipo (atividade aplicada, atividade encerrada, correção do Assistente) no dia em que aconteceu. O item da atividade abre o painel dela na aba Atividades da turma certa. O item da correção abre a revisão (T6).
- "Ver a semana desta turma" no Hoje leva à Semana filtrada por turma e disciplina (T5).
- Casos de borda:
  - professor com duas disciplinas na mesma turma: um link por disciplina, cada um com o nome dela;
  - vínculo pendente ou sem disciplina não vira link nem opção do filtro;
  - vínculo de outra turma não vira link no Hoje desta;
  - semana sem aula mas com item não mostra "Sem aulas nesta semana";
  - dia sem item não ganha lista vazia;
  - os três estados da correção;
  - leitura de vínculos carregando ou em erro: sem link e sem derrubar o Hoje.
- Filtro `?turma=`: some o item de outra turma e o de outra disciplina da mesma turma.
- Permissão e regra 70, item 7: o item não mostra nota, acerto nem nome de aluno, e só a correção leva o selo "IA".
- Isolamento: a tarefa não lê nada novo. `/v1/semana` é da 3.0 e o recomeço do `GET` foi provado na 6.0. `meus-vinculos` já existia e é escopado pelo token.
- Concorrência: clique duplo no item abre o painel uma vez e cria uma entrada só no histórico.
- Medidas: 1366 × 768 (só o painel da aba rola) e 360 px sem rolagem para o lado.

**Cobertos:**
- **As 11 linhas da tabela têm caso com o nome citado.** Conferi cada nome em `e2e/professor-semana-itens.spec.ts`, `ItensDoDia.test.tsx`, `semana.test.ts`, `Semana.test.tsx` e `TurmaHoje.test.tsx`. As linhas juntadas por ponto e vírgula (vocabulário com nome acessível, clique duplo com T6) afirmam as duas coisas no mesmo caso. A linha de 360 px vale porque `playwright.config.ts:23` roda todo spec nos projetos `chromebook` e `celular`, e o caso trata o celular em `noCelular`.
- **As 22 mutações cobrem cada cláusula nova do `git diff`**, com `--faltando` em 0. Conferi que cada mutação cai num caso que chega à cláusula:
  - filtro: o item de outra turma e o de outra disciplina, cada um testado sozinho em `semana.test.ts:193`;
  - `?? []` no Hoje e na Semana;
  - os três ramos do `?:` e do `&&` no Hoje;
  - endereço do item e endereço da Semana filtrada;
  - `vazioDaSemana` contando os itens;
  - `aria-label`, `rotuloDoItem` e `to` em `ItensDoDia`;
  - selo IA;
  - a guarda `dia.itens.length > 0` em `DiaDaSemana`.

  Os nomes de teste citados nos blocos existem.
- **Clique duplo:** `dblclick()`, um diálogo, e depois `goBack()` volta à Semana (`e2e/professor-semana-itens.spec.ts:71-78`). Se o clique gravasse duas entradas, o Voltar cairia na turma e o teste ficaria vermelho.
- **Sem `.skip` nem teste comentado.** Nenhum mock esconde a regra: os testes de unidade usam a rede falsa e o e2e usa API, banco e sessão de verdade. A tarefa não chama IA.
- **Rodei a unidade:** `npx vitest run` em `semana/` mais `TurmaHoje.test.tsx` deu 4 arquivos e 88 casos verdes. O e2e não rodei.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `apps/web/src/areas/professor/turmas/semana/ItensDoDia.test.tsx:66-70` ("o item não diz nota, conceito, pontuação…") não falha com nenhuma mudança plausível do componente. Ele só renderiza o rótulo e o título, então o caso guarda os textos de `ROTULOS_DA_SEMANA`, não o componente. Vale renomear para dizer isso, ou movê-lo para o teste da tabela em `packages/shared`. O mesmo vale para `not.toContainText(aluno.nome)` no e2e: é guarda de regressão, não prova de cláusula. Os dois são aceitáveis porque a regra 70, item 7 é negativa.
2. O e2e depende do relógio real ("os itens são sempre de hoje", `e2e/professor-semana-itens.spec.ts:15`). Se o caso cruzar a meia-noite, principalmente de domingo para segunda, a semana muda entre criar a atividade e abrir a Semana. É raro, mas vale registrar para a retro, junto da nota de e2e perto do prazo.
3. Caso de domínio fora do escopo desta tarefa, para a 3.0 ou o achados: atividade aplicada num sábado ou domingo sem aula. A API só manda o fim de semana quando há aula (`e2e/support/professor/semana.ts:39-40`), então esse item não aparece em lugar nenhum da Semana.
4. A chave `${item.tipo}-${item.atividadeAplicadaId}` (`ItensDoDia.tsx:18`) assume uma correção por atividade por dia. Se a 3.0 puder mandar duas (lote rejeitado e refeito no mesmo dia), a chave se repete. Vale confirmar no contrato.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/tasks/prd-semana-do-professor/8_task.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/e2e/professor-semana-itens.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/web/src/areas/professor/turmas/semana/ItensDoDia.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/web/src/areas/professor/turmas/semana/ItensDoDia.test.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/web/src/areas/professor/turmas/semana/semana.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/web/src/areas/professor/turmas/semana/semana.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/web/src/areas/professor/turmas/semana/Semana.test.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/web/src/areas/professor/turmas/semana/DiaDaSemana.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/web/src/areas/professor/turmas/TurmaHoje.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx`

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-07 00:46:15 · `tasks/prd-semana-do-professor/8_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. O diff desta rodada mexe só na tela (`apps/web`), no e2e, no `TODO.md` e nos documentos da tarefa. Não cria endpoint, job, seed, importação nem webhook. Todos com autor humano? Sim, porque nenhum caminho novo grava Nota.

Decisão autônoma sobre aluno: ausente. O item da correção só leva à revisão humana (`/aprovar/<id>`), em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/web/src/areas/professor/turmas/semana/semana.ts`, na função `enderecoDoItem`.

Aprovação registrada: ok. A tarefa não cria saída de IA nova. Ela só mostra o estado da correção, que segue pendente até alguém aprovar.

Supervisão do tutor: ok. O tutor não é tocado nesta rodada.

Autonomia declarada e visível: sim. Nada mudou nisso.

Conferi cada correção da ordem `.processo/ordens/8_task-r1.md` que é da minha regra:
- **Item 1 (marca de IA no nome acessível): feito.**
  - A função `nomeDoItem` (`apps/web/src/areas/professor/turmas/semana/semana.ts:243`) acrescenta ", gerado por inteligência artificial" só à correção. É o mesmo texto que o selo IA dá ao leitor de tela (`apps/web/src/components/ui/ai/AgentSignature.tsx:18`).
  - O link do item usa essa função (`apps/web/src/areas/professor/turmas/semana/ItensDoDia.tsx:21`).
  - O teste de unidade em `semana.test.ts:228-232` prova os três tipos de item. Um bloco de "Mutações" quebra se a cláusula sair, e o `ItensDoDia.test.tsx`, o `Semana.test.tsx` e o e2e já esperam o nome novo.
- **Item 7 (a palavra "acert"): feito.** A expressão de `ItensDoDia.test.tsx` agora barra também "acert", igual ao e2e.
- **Item 8 (nome do caso): feito.** O caso agora diz que é "guarda de regressão da regra 70, item 7", em vez de prometer que prova uma cláusula.

O resto do diff não toca a regra 70: tirar o `data-semana-da-turma`, o `text-center`, a medida dos links no celular, o caso do celular na Semana e os ajustes na tarefa, nos cenários e no `TODO.md`. Nada do diff diz nota, conceito, pontuação ou acerto. Também não há nada sobre comportamento do aluno nem indicador de professor.

Bloqueantes: nenhum

Recomendações:
- O selo visível diz "IA", e o nome acessível diz "inteligência artificial". Pela WCAG 2.5.3 ("label in name"), é um desvio pequeno, e quem decide é o `frontend-reviewer`. Para a minha regra, a marca de IA chega ao leitor de tela, e isso basta.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-07 00:46:19 · `tasks/prd-semana-do-professor/8_task.md`

VEREDITO: APROVADO
Tabelas verificadas: nenhuma. O diff entre as árvores `5d786996` e `77c9f0c3` não traz migration nem schema.
Queries verificadas: nenhuma nova nem alterada. O diff toca só a interface em `apps/web/src/areas/professor/turmas/`, o e2e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/e2e/professor-semana-itens.spec.ts`, o `TODO.md` e os documentos da tarefa. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/web/src/areas/professor/turmas/semana/semana.ts`, a função nova `nomeDoItem` monta só o nome acessível do item, com o rótulo e o título. Ela não usa `escolaId` nem nenhum outro parâmetro de escopo. Os endereços dos itens continuam levando só ids (UUID). Nenhum endpoint passou a aceitar `escolaId` no corpo ou na query string.
Teste de isolamento: presente e efetivo. Nesta rodada não mudou repository, query nem endpoint, então não há teste de isolamento novo a exigir. O filtro `?turma=` na tela é recorte dentro da própria escola, não escopo de tenant.
Bloqueantes: nenhum.
Recomendações: nenhuma nova. A 1ª rodada aprovou sem bloqueante, então não havia correção exigida a conferir; os itens 1 a 8 da ordem `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/.processo/ordens/8_task-r1.md` eram recomendações, e nenhum deles tem efeito sobre o isolamento entre escolas.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-07 00:46:20 · `tasks/prd-semana-do-professor/8_task.md`

VEREDITO: APROVADO
Tela vista: sim (8 fotos lidas: Hoje da turma aberta e Semana, cada uma no computador e no celular, na escola cheia e na vazia). A tela com itens do dia não tem foto, e eu a revisei pelo código e pelo spec e2e, como o prompt indicou.
Estados: ok. A Semana vazia convida: "A coordenação ainda não importou a grade", com o próximo passo dito. O Hoje não mostra link de semana quando não há vínculo lido, e isso está testado e decidido na divergência 1. Carregando e erro só confiro por código e e2e, e o diff desta rodada não os altera.
Acessibilidade: ok.
- O nome acessível do item agora vem de `nomeDoItem` (`apps/web/src/areas/professor/turmas/semana/semana.ts`). A correção do Assistente diz "gerado por inteligência artificial", porque o `aria-label` esconderia o selo "IA" do leitor de tela (regra 70, item 4a). Isso está coberto por teste de unidade, de componente, da Semana e pelo e2e.
- O rótulo vem de `rotuloDoItem`, em `packages/shared`.
- O estado é texto, nunca só cor.
- O link do item tem `min-h-11`.
Chromebook fraco: sem mudança nesta rodada. A lista de itens do dia é curta, e não há imagem nem upload.
Celular:
- Pelas fotos a 360 px, não há rolagem horizontal nem texto cortado, e "Ver a semana desta turma" tem cerca de 44 px de altura.
- Na foto do Hoje no celular, a barra inferior fica sobre o conteúdo, mas isso vem da captura de página inteira com barra fixa, não é defeito da tela.
- O link com disciplina, que é mais longo, ganhou `text-center`. O e2e das duas disciplinas agora mede `horizontalOverflow`, se o link cabe na largura e se a altura é de pelo menos 44 px.
- O caso de unidade do celular passou a provar que o item aparece só no dia mostrado e que escolher outro dia troca os itens.
Ação oficial protegida: sim. A tarefa só navega: o item da correção leva à revisão (`/aprovar/<id>`) e não aprova nada.
Bloqueantes: nenhum.
Rolagem a 1366 × 768: nenhuma tela da lista.
Correções da rodada 1 conferidas no diff, itens 1 a 8:
- Item 1: nome acessível da correção, com bloco de mutação e e2e atualizados.
- Item 2: `text-center` e e2e de medida.
- Item 3: o atributo `data-semana-da-turma` saiu do código de produção, e o teste procura as fileiras vazias pela estrutura.
- Item 4: o caso do celular foi reforçado.
- Item 5: o título do e2e do filtro e a linha da tabela foram ajustados juntos.
- Item 6: a citação da divergência foi corrigida, e o T6 do `cenarios.md` ganhou a meia linha.
- Item 7: a palavra "acert" entrou na regex.
- Item 8: o caso foi renomeado como guarda de regressão.
- Os destinos para o TODO entraram em `TODO.md`.
Recomendações:
- A leitura de vínculos sem `fetchNextPage` (já registrada no TODO) é o ponto mais sério. Quem tem vínculos além da primeira página perde o link do Hoje e as opções do filtro, em silêncio.
- A chave `${item.tipo}-${item.atividadeAplicadaId}` do item pode repetir se o lote de correção refeito no mesmo dia mandar duas correções da mesma atividade. Está no TODO.
- O e2e depende do relógio real, o que dá risco na virada de domingo para segunda. Está no TODO.
- Quando houver grade importada na vitrine, fotografar a Semana com itens, para a tela com itens do dia ser vista e não só provada pelo e2e.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/web/src/areas/professor/turmas/semana/ItensDoDia.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/web/src/areas/professor/turmas/semana/semana.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/web/src/areas/professor/turmas/TurmaHoje.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/e2e/professor-semana-itens.spec.ts`

## infra-guardian · 2ª rodada · APROVADO · 2026-11-07 00:46:33 · `tasks/prd-semana-do-professor/8_task.md`

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
Recomendações: a de paginar `GET /v1/meus-vinculos` com `fetchNextPage` em `turmasEDisciplinasDosVinculos` continua em aberto. Ela está anotada em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/TODO.md`, com origem na 6.0. Resolver esse ponto antes do piloto, porque o Hoje passou a depender dessa leitura.

Esta rodada só olhou o que mudou desde a 1ª, que foi aprovada. O diff mexe só na tela, nos testes e na documentação. Não muda API, fila, job, chamada de modelo, migration nem estado no servidor. Também não cria leitura nova: o Hoje continua com a mesma leitura de vínculos da 1ª rodada, que é paginada e fica em cache por 30 s.

As oito recomendações da ordem `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/.processo/ordens/8_task-r1.md` foram feitas, e nenhuma muda o que acontece às 10h. A troca do atributo `data-semana-da-turma` por `fileirasVazias()` ainda faz o teste falhar se a condição `semanasDaTurma.length > 0` for tirada. O motivo é que a fileira vazia continua sendo uma `div` sem filhos, filha direta da raiz em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/web/src/areas/professor/turmas/TurmaHoje.tsx:136`.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-07 00:46:34 · `tasks/prd-semana-do-professor/8_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

As oito correções da ordem `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/.processo/ordens/8_task-r1.md` foram feitas:

1. **Nome acessível da correção.** A nova função `nomeDoItem` (`semana.ts:243`) monta o nome e acrescenta "gerado por inteligência artificial" só na correção. Ela tem teste em `semana.test.ts`, um bloco de mutação próprio, e o texto novo aparece na unidade, no teste da Semana e no e2e.
2. **Link de Hoje com duas disciplinas no celular.** O link ganhou `text-center`. O e2e T5 mede a rolagem de lado e confere que o link cabe na tela e tem pelo menos 44 px de altura.
3. **Atributo só para o teste.** `data-semana-da-turma` saiu de `TurmaHoje.tsx`. O teste agora procura a fileira que ficou vazia. A mutação `{true && (` desenha a fileira sem nenhum link, e o teste novo pega isso.
4. **Caso do celular.** Agora prova que o item aparece só no dia mostrado e que trocar o dia troca os itens.
5. **Título do e2e do filtro.** O título e a linha da tabela foram ajustados juntos, e a tabela aponta `semana.test.ts` para o corte de cada cláusula sozinha.
6. **Citação da divergência.** A linha da tarefa e `cenarios.md` T6 agora dizem que o `?turma=` corta os itens e que a semana só com item não é vazia. Isso bate com `techspec.md:158-159`.
7. **Palavra "acert".** Entrou na expressão do teste de unidade.
8. **Nome do caso "sem nota".** Agora diz que o caso é guarda de regressão da regra 70, item 7.

O que ficou sem aplicar está no `TODO.md` e na tabela "Recomendações sem aplicar", com o destino da ordem.

Recomendações:
- **Concordância.** `semana.ts:244` diz "Correção do Assistente · …, gerado por inteligência artificial". O certo seria "gerada", concordando com "correção". Se o texto foi copiado do selo IA de propósito, para soar igual, vale um comentário dizendo isso.
- **Texto visível e nome acessível (WCAG 2.5.3).** O que se vê é o selo "IA", e o nome acessível diz "inteligência artificial" por extenso. É um desvio pequeno e aceitável. Fica para o `frontend-reviewer` decidir.
- **Formatação do `TODO.md`.** A seção nova, na linha 2824, entra sem linha em branco antes do título. Isso já vinha da linha 2823: o item P30 está cortado desde o `HEAD`, e a 8.0 não causou isso. Vale reparar quando alguém mexer ali.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-07 00:46:35 · `tasks/prd-semana-do-professor/8_task.md`

VEREDITO: APROVADO

Esta rodada auditou só o diff `5d786996` → `77c9f0c3` e o que ele afeta. Nada na tarefa mudou desde a 1ª rodada fora desse diff.

Campos pessoais tocados: nenhum novo. O item do dia continua mostrando só tipo, estado, título da atividade e ids. O nome acessível agora vem de `nomeDoItem` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/apps/web/src/areas/professor/turmas/semana/semana.ts:243`) e usa os mesmos três campos. A correção ganha ", gerado por inteligência artificial" no nome. Não aparece nome de aluno, matrícula, nota nem resposta.
Fora da tabela de dados do docs/lgpd.md: nada. Não há migration, schema nem campo novo.
Autorização por objeto: ok. O diff não mexe em rota, API nem contrato. O link do Hoje continua montado a partir de `GET /v1/meus-vinculos` da própria professora, e o atributo `data-semana-da-turma` saiu sem mudar o escopo.
Logs: limpos. Não há `console`, logger, `localStorage` nem `sessionStorage` em `ItensDoDia.tsx`, `semana.ts` ou `TurmaHoje.tsx`.
Auditoria: não se aplica. A professora lê só a própria turma, e a tela não exporta, não altera nota, não altera permissão e não aprova nada.
Envio externo: nenhum. A tarefa é só de tela.
Seed/fixture: sintético. O e2e só ganhou a checagem de medida a 360 px (`esperarLinkInteiroEComAlvoGrande`), e `e2e/support/atividade-db.ts` não mudou nesta rodada.
Bloqueantes: nenhum.

O que veio da minha 1ª rodada:
- Aviso "não escreva nome de aluno" no campo de título: foi para o `TODO.md` como item para a retro, porque o campo é de outra tarefa. O destino é adequado: o título da atividade aparece nos itens do dia, mas quem o escreve é a ferramenta que gera a atividade.
- Teste das chaves exatas do `itemDoDiaSchema`: foi recusado porque já está em `cenarios.md` S9 (contrato com as chaves exatas), que é da 3.0, e a 8.0 não toca `packages/shared`. Aceito o motivo, já que nenhuma chave nova pode entrar por esta tarefa.

Pergunta de fechamento: o diff não cria dado guardado nem envio novo sobre o aluno. Por isso a resposta à secretaria continua a mesma da 1ª rodada.

Recomendações:
- O aviso do título continua sendo a principal proteção contra nome de aluno escrito à mão aparecer nos itens do dia. Vale tirá-lo da retro e pôr na fila da tarefa dona do campo, para não ficar perdido no `TODO.md`.

## test-engineer · 2ª rodada · APROVADO · 2026-11-07 00:46:49 · `tasks/prd-semana-do-professor/8_task.md`

VEREDITO: APROVADO

Cenários exigidos: nesta segunda rodada, os oito itens da ordem `.processo/ordens/8_task-r1.md`.
1. O nome acessível da correção diz que é gerada por IA (regra 70, item 4a).
2. O link de Hoje com duas disciplinas tem a medida provada a 360 px.
3. O atributo de teste sai do código de produção, e o teste continua provando que sem vínculo a fileira não existe.
4. O caso do celular prova que o item fica preso ao dia mostrado.
5. O título do e2e do filtro bate com a tabela.
6. A divergência cita o lugar certo.
7. A unidade também procura a palavra "acert".
8. O caso de "sem nota" foi renomeado para guarda de regressão.

Cobertos:
- **1:** a regra nova `nomeDoItem` (`apps/web/src/areas/professor/turmas/semana/semana.ts:243-245`) tem caso próprio, `semana.test.ts › o nome acessível do item do dia`. O caso cobre aplicada, encerrada e correção, e prova que só a correção leva a marca de IA. A cláusula nova tem o seu bloco em "Mutações", que tira o ternário e por isso quebra o caso. O bloco antigo do `aria-label` foi conferido contra o código atual (`aria-label={nomeDoItem(item)}`). O nome do caso que ele cita (`cada item é um link com o nome`) continua sendo o começo do nome novo. `ItensDoDia.test.tsx`, `Semana.test.tsx` e o e2e (`correcao`) foram atualizados para o nome novo.
- **2:** o caso T5 das duas disciplinas agora afirma `horizontalOverflow` zero, que o link cabe na largura da tela e que o alvo tem pelo menos 44 px. O `text-center` é só acabamento visual e não precisa de bloco. O bloco do destino do link foi atualizado com a `className` nova.
- **3:** `data-semana-da-turma` saiu de `TurmaHoje.tsx`, e o teste passou a usar `fileirasVazias()`. Com a mutação `{true && (`, a fileira aparece sem nenhum link dentro, o helper encontra uma fileira vazia e o caso fica vermelho pelo motivo certo.
- **4:** o caso do celular agora tem um item em hoje e outro na quarta. Ele confere que só o item de hoje aparece, clica no rádio "Quarta, 11 de novembro" e confere que os itens trocam. Assim prova que os itens ficam presos ao dia, e não só que o link existe.
- **5 e 6:** o título do e2e e a linha da tabela foram trocados juntos e o nome confere. A divergência agora cita `techspec.md` §9 (`diasFiltrados`, `vazioDaSemana`) e `cenarios.md` T6, e o T6 ganhou o texto correspondente.
- **7 e 8:** a expressão da unidade agora inclui `acert`, e o caso foi renomeado como guarda de regressão da regra 70, item 7.
- Os destinos que foram para o `TODO.md` entraram lá, e a tabela "Recomendações sem aplicar" foi copiada para o documento.
- Rodei `npx vitest run` na pasta da semana e no `TurmaHoje.test.tsx`: 4 arquivos e 89 casos, todos verdes. Nenhum `.skip`, e nenhum mock esconde a regra testada. O diff não tem IA nem operação concorrente nova.

Bloqueantes: nenhum.

Recomendações:
- Em `apps/web/src/areas/professor/turmas/TurmaHoje.test.tsx:620-623`, `fileirasVazias()` passa sem testar nada se a estrutura mudar. Se a região "Sinais da turma" for embrulhada em outro contêiner, o `parentElement` deixa de ser o pai da fileira e o helper devolve uma lista vazia mesmo com a fileira vazia na tela. Uma correção possível é afirmar, antes, que `raiz` contém o `div[aria-live]` (por exemplo, `expect(raiz?.querySelector(':scope > [aria-live]')).not.toBeNull()`). Assim o caso falha alto quando a estrutura muda.
- O e2e de T5 com duas disciplinas (`e2e/professor-semana-itens.spec.ts:188-190`) roda nos dois projetos, mas o comentário fala só do celular. Fica melhor dizer que a medida vale também no `chromebook`, ou usar o `noCelular` para deixar a intenção clara.
- Não rodei o e2e (`node tools/ci/e2e.ts --manter-ambiente e2e/professor-semana-itens.spec.ts`), porque precisa do ambiente e fica com o portão da tarefa.
