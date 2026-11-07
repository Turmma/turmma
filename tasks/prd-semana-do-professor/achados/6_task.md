# Achados das revisões — `tasks/prd-semana-do-professor/6_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-06 22:13:58 · `tasks/prd-semana-do-professor/6_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nem migration nesta tarefa. Não há diff em `apps/api` nem em `packages`. A tabela `aula`, criada na 1.0, aparece só no seed do e2e (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/e2e/support/professor/semana.ts:73`), que grava `escola_id` e `ano_letivo_id` copiados do próprio vínculo.

Queries verificadas:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/api/semana.ts` chama `GET /v1/semana?segunda=` e só manda a data. Escola, ano e professora não vão no pedido. O cliente não manda `escolaId` em lugar nenhum.
- `?turma=` e `?semana=` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/semana/semana.ts:123-165` só filtram e navegam no navegador. Não decidem o que o servidor lê.
- O escopo do servidor é o de `GET /v1/semana`, auditado na 2.0, que esta tarefa não mexe.
- `escolaId` aparece só nos ajudantes de seed do e2e, que escrevem direto no banco de teste. Nenhum endpoint o recebe.

Teste de isolamento: presente e efetivo, na parte do cliente.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/e2e/professor-semana.spec.ts:465` (RF9, P30): troca de escola com a resposta segurada e confere que o nome da turma da escola A não aparece na B. O teste quebraria se o `resetQueries` de `main.tsx:36` saísse ou se a chave guardasse a semana entre escolas.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/e2e/professor-semana.spec.ts:448`: segunda pessoa na mesma aba, mesma prova para a troca de usuário.
- O escopo do servidor já foi provado na 2.0.

Os demais pontos:
- Os ids no endereço são UUID (`?turma=<turmaId>.<disciplinaId>`).
- Turma que não é dela mostra o mesmo vazio, sem confirmar que a turma existe.
- Não há consulta da camada de rede nem `@Unscoped()`.

Bloqueantes: nenhum.

Recomendações:
- `SEMANA_QUERY_KEY` + `segunda` não leva escola nem usuário. Hoje o isolamento do cache depende só do `resetQueries` global de `main.tsx`. Pôr na chave um identificador da sessão ativa protegeria o cache mesmo se esse reset mudar. É o mesmo padrão das outras chaves do professor, então não bloqueia.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-06 22:14:01 · `tasks/prd-semana-do-professor/6_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. A tela só lê o que a tarefa 2.0 já entrega pelo `GET /v1/semana`. Cada aula traz turma, disciplina, sala, horário, `vinculoId` e o texto da aula, que é da própria professora. O cartão não mostra nada de aluno: nem nome, nem matrícula, nem nota.

Fora da tabela de dados do docs/lgpd.md: nada. "Registro da aula" (linha 75) e "Aula da grade" (linha 74) já estão na tabela, com finalidade e retenção, desde a tarefa 1.0. As duas linhas cobrem o texto livre que pode citar aluno e dizem que só a professora o lê.

Autorização por objeto: ok. A tela não manda escola, ano nem professora no pedido: só `?segunda=` (em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/api/semana.ts`). O `?turma=` só filtra no navegador o que a API já devolveu para a sessão, então trocar o id na URL não abre a turma de outra pessoa. O escopo no servidor foi auditado na 2.0.

Logs: limpos. Não há `console`, `localStorage`, `sessionStorage` nem `sendBeacon` na Semana, no `DaySelector` nem nos e2e novos. O endereço só leva ids e datas (`?ver=`, `?semana=`, `?turma=<uuid>.<uuid>`, `?aula=<vinculoId>.<data>.<HHMM>`), nunca o texto da aula. Isso está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/semana/semana.ts` e é testado em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/e2e/professor-semana.spec.ts:47`.

Auditoria: não se aplica. Aqui a professora lê os próprios dados; não há leitura de dado de aluno pela coordenação ou rede, nem exportação, nota, permissão ou saída de IA.

Envio externo: nenhum. Não há IA nesta tarefa.

Seed/fixture: sintético. A cena do e2e (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/e2e/support/professor/semana.ts`) cria as pessoas por `criarEquipeComSenha` e grava textos de aula genéricos. A galeria (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/gallery/sections/fields.tsx`) só usa datas.

Fotos: as quatro mostram a mesma tela vazia ("A coordenação ainda não importou a grade"). Nelas aparecem só a escola sintética, a própria professora sintética e "Todas as turmas", sem nenhum dado de aluno. A troca de escola foi conferida no e2e (`professor-semana.spec.ts:470-495`): `resetQueries` em `apps/web/src/main.tsx:36` limpa o cache, e o nome da turma da escola A não aparece na tela da escola B, nem enquanto carrega nem depois.

Pergunta de fechamento: responde. A tarefa não cria dado novo nem envio, e o registro da aula já entra no arquivo do titular na versão completa (tarefa 1.0).

Bloqueantes: nenhum.

Recomendações:
- `docs/interface.md` 1.8 diz que o painel da aula (7.0) avisa para não escrever nome de aluno. Esse aviso precisa ser conferido na 7.0, porque o texto do cartão aparece aqui inteiro, em duas linhas, e é texto livre.
- `useAnoConhecido` (`Semana.tsx`) lê qualquer semana no cache com a chave `['semana', ...]`. Hoje isso está seguro porque o `resetQueries` global limpa o cache na troca de escola. Valeria registrar no comentário que isso depende do `main.tsx:36`, para ninguém trocar o reset por um escopado sem perceber.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-06 22:14:06 · `tasks/prd-semana-do-professor/6_task.md`

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
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/semana/Semana.tsx`, em `useOpcoesDoFiltro`: o filtro "Turma e disciplina" só oferece os vínculos das páginas de `meusVinculosQueryOptions` que já estão no cache. Turma de uma página que a professora ainda não abriu fica fora do filtro, embora as aulas dela apareçam na semana. Isso não muda a carga, porque não há leitura a mais. Duas saídas possíveis: montar as opções a partir das aulas que `GET /v1/semana` devolveu, ou registrar o limite em `docs/interface.md` 1.8.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/api/semana.ts`: a leitura usa os padrões do `query-client`, que mantêm o dado por 30 s e recarregam quando a janela volta ao foco. Como a semana muda pouco durante a manhã, um `staleTime` maior nesta consulta corta as leituras que a professora faz sempre que volta para a aba do navegador às 7h30. É ajuste fino, não é risco.

O que garante a carga: a tarefa só mexe na tela. A leitura `GET /v1/semana` é do servidor, auditada na 2.0, e só sai com a aba Semana aberta. O código da Semana também só é baixado nessa aba. Há uma leitura por semana, com a chave `['semana', segunda]` e sem consulta repetida em intervalo. Valem as tentativas automáticas do `query-client`: uma só, e nunca quando o limite de requisições foi excedido. A volta para a semana de hoje tem trava contra laço (`segundaDe(resposta.hoje) !== segunda`). O e2e confirma duas coisas: a aba Turmas não chama a semana, e colar o mesmo endereço de novo faz uma leitura só. A tarefa não grava nada.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-06 22:14:17 · `tasks/prd-semana-do-professor/6_task.md`

VEREDITO: APROVADO

Tela vista: sim (4 fotos lidas, escola cheia e vazia, computador e celular). As duas escolas da vitrine não têm grade importada, então todas mostram "A coordenação ainda não importou a grade". Li o código de `Semana.tsx`, `DiaDaSemana.tsx`, `CartaoDaAula.tsx`, `semana.ts` e `DaySelector.tsx`, e a lista de casos do `e2e/professor-semana.spec.ts`. Não rodei o e2e. As telas com dado (colunas, dia por vez, cartão) foram conferidas só pelo código e pelas asserções do spec, não por foto.

Estados: ok.
- **Carregando:** `LoadingState "Carregando a semana…"`, no `Suspense` e no corpo (`Semana.tsx:130`). O vazio e o aviso do calendário só saem depois da leitura.
- **Erro:** `ErrorState` com "Tentar de novo" (`Semana.tsx:117`), e o foco vai ao título da semana quando a nova leitura dá certo.
- **Vazio:** diz por quê (`semana.ts:221-232`): sem ano em curso, sem grade, ano ainda não começou, recesso, ou semana sem aula. Com filtro, oferece "Ver todas as turmas".
- **Com dado:** colunas no computador e um dia por vez no celular.

Acessibilidade: ok.
- **Cartão:** é um `button` com nome acessível "Terça, 7h30, 7ºA, Matemática"; o resto vai como descrição, lida depois do nome.
- **Estado em texto:** "Hoje", "Agora", "Fora da grade" e "Falta preencher" são texto, nunca só cor.
- **`DaySelector`:** é `radiogroup` com uma parada só no Tab e setas, Home e End.
- **Foco e teste:** o foco é devolvido ao título nas pontas do ano. O spec tem um caso de axe, com dado e no vazio.

Chromebook fraco: ok.
- **Peso:** a Semana é um pedaço baixado só com a aba aberta (`lazy`), e a leitura é uma por semana. Uma semana não passa de umas 50 aulas, então não precisa de virtualização.
- **Altura:** o miolo do documento mantém a página parada a 1366 × 768. Nenhuma tela "Rolam" nas fotos, e há caso e2e T10 com 45 aulas no `chromebook`.

Celular: ok pelas fotos de 360 px e pelo código.
- **Fotos:** sem rolagem horizontal, e os botões da barra quebram em duas linhas sem esconder nenhum.
- **Alvos:** o cartão e o `DaySelector` têm 44 px (`min-h-14`), e o spec mede 24 px nos botões da barra.
- **Hover e atalho:** nada depende de hover (o `hover:` do cartão é só decoração) nem de atalho.

Ação oficial protegida: sim. A tarefa não cria ação oficial, só leitura e navegação. O clique no cartão só põe `?aula=`, com ids e datas no endereço e nunca o texto da aula.

Bloqueantes: nenhum.

Recomendações:
1. **Colunas entre 768 e cerca de 1000 px** (`Semana.tsx:131-136`, `CartaoDaAula.tsx`): a conta aponta aperto, mas não foi medida nem fotografada.
   - **A conta:** a casca vira linha em `md` e a lateral continua aberta a 768 px (`CascaDaEscola.tsx:325`). Sobram cerca de 448 px para 5 a 7 colunas, o que dá uns 35 px de texto por cartão. "Matemática" e "7h30 às 8h20" quebram no meio da palavra.
   - **O que falta:** nenhum caso do e2e cobre essa faixa; o `chromebook` é 1366 e o `celular` é 360. Quem usa tablet em pé ou janela estreita vai ver isso.
   - **Sugestão:** trocar para um dia por vez quando a largura útil não comportar as colunas (por exemplo, ligar o `useMediaQuery` a `lg`), ou pelo menos fotografar a 820 px na validação.
2. **`docs/interface.md` 1.8** já descreve o painel da aula (7.0) e os itens do dia (8.0) como se existissem. Até lá, o clique no cartão só muda o endereço e nada aparece para a professora. Convém marcar esses dois blocos como "tarefas 7.0 e 8.0" no texto, para o documento não contradizer a tela.
3. **Fotos:** as da vitrine só mostram o vazio. Na validação, fotografar a Semana com a grade importada, em 1366 e em 360 px, com os cartões, o selo "Falta preencher" e o `DaySelector`.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-06 22:14:18 · `tasks/prd-semana-do-professor/6_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa 6.0 só lê `GET /v1/semana` e não grava nada: nem Nota, nem Correção, nem o texto da aula, que fica para a 7.0. Todos com autor humano: não se aplica.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhuma saída de IA chega à tela nesta tarefa. A Semana mostra só a grade, os eventos do calendário e o texto que a própria professora escreveu.
Supervisão do tutor: ok. A tarefa não mexe no Tutor.
Autonomia declarada e visível: sim. Nada mudou aqui; a tarefa não cria agente nem muda nível de autonomia.
Bloqueantes: nenhum

**O que conferi**

- **As quatro fotos** (`.processo/vitrine/professora--professor-turmas--{computador,celular}.png` e as duas `vazia--…`) mostram só as abas "Turmas · Semana", a barra da semana, o filtro "Turma e disciplina" e o vazio "A coordenação ainda não importou a grade". Não há saída de IA, nota, conceito nem indicador. Também não há nada que induza uso: sem sequência, sem recompensa, sem conteúdo que comece sozinho (D59).
- **Medir o professor (D45, D64, regra 70 itens 8 e 9).** O selo "Falta preencher" é por aula, cinza (`info`) e só a professora o vê.
  - `apps/web/src/areas/professor/turmas/semana/CartaoDaAula.tsx:80-84` desenha o selo, e `apps/web/src/areas/professor/turmas/semana/semana.ts:98-100` diz que nenhuma conta soma quantos faltam.
  - O teste `apps/web/src/areas/professor/turmas/semana/semana.test.ts:110` prova a descrição sem soma.
  - Nenhuma leitura da coordenação foi criada.
- **Contrato.** `packages/shared/src/semana/semana.ts:26-70` não traz nome de aluno, nota, acerto nem campo gerado por IA. Os `itens` do dia já declaram "Sem nota, acerto, nome de aluno nem autor".
- **Supervisão não é vigilância.** Não há medição de tempo, navegação nem comportamento. "Agora" é calculado a partir da grade, não da atividade da pessoa.

**Recomendações (não bloqueiam)**

1. **Para a 8.0.** O item "Correção do Assistente" previsto em `docs/interface.md` (seção 1.8, "Os itens do dia") precisa aparecer marcado como saída de IA. O estado ("Para revisar", "Aprovada", "Rejeitada") deve vir da aprovação registrada, e nenhum valor de nota pode ir ao cartão. Na redação e na discursiva, esse item nem deveria existir (D55). Vale um teste que prove que o tipo do item só nasce de correção de objetiva.
2. **Para a 7.0.** "Preparar esta aula" diz que não cria conversa nem escreve o texto. Convém um teste que prove que o texto da aula nunca é preenchido pelo Assistente sem a professora salvar.
3. **Para quando houver tela da coordenação sobre a grade ou os registros de aula.** O texto da aula é da professora. Se um dia a coordenação o alcançar, vale a regra 70, item 8: nominal só com auditoria, e nunca contagem de "falta preencher" por professor (D64).

## revisor-geral · 1ª rodada · APROVADO · 2026-11-06 22:14:30 · `tasks/prd-semana-do-professor/6_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. A única divergência é o `DaySelector` no lugar do `SegmentedControl`. Ela já está na `techspec.md` §9, reescrita pelo Arquiteto, com a decisão do Joaquim de 06/11, e foi registrada na 10.2 do `docs/interface.md` e na galeria. O T9 do `cenarios.md` não cita a peça, então não precisa mudar.
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

Sobre o escopo: o clique no cartão só põe `?aula=` no endereço, e o painel fica para a 7.0. A 1.8 do `docs/interface.md` descreve também o painel e os itens, mas isso foi pedido pela subtarefa 6.4. Nenhum código da 7.0 nem da 8.0 entrou. A nota no roteiro é a que a tarefa pede.

Sobre as fotos: as quatro mostram a "Semana de 2 a 8 de novembro" com o vazio "A coordenação ainda não importou a grade". Hoje é 06/11, então a semana está certa. Os textos estão em português, sem rolagem de lado a 360 px, e a tela não mostra nada fora do pedido.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/semana/semana.ts:74`: o comentário de `tituloDaSemana` dá o exemplo "9 a 13 de novembro", mas a função soma 6 dias e devolve "9 a 15". Isso também contradiz a 1.8 do `docs/interface.md`. Corrigir o exemplo.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/semana/Semana.tsx:193`: o comentário diz que "Semana anterior" **some** na ponta do ano, mas o botão fica desligado (`disabled`). Trocar "some" por "fica desligada".
- `Semana.tsx:180`: com `?turma=` de uma turma que não é dela, o valor do filtro não está entre as opções. O `<select>` nativo então mostra "Todas as turmas" enquanto a tela mostra o vazio do filtro, e as duas coisas se contradizem. Vale incluir uma opção para esse valor, ou tirar o filtro inválido do endereço com `replace`.
- `Semana.tsx:241`: "Ver todas as turmas" navega sem `replace`, e a troca de filtro na linha 228 usa `replace`. Como as duas mexem no mesmo parâmetro, deviam empilhar o histórico do mesmo jeito.
- `Semana.tsx:134`: no vazio "A coordenação ainda não importou a grade" e no "O ano letivo ainda não começou", o botão "Ver todas as turmas" aparece sempre que há filtro, e tirar o filtro não muda nada nesses casos. O mais limpo é oferecer o botão só no vazio "Sem aulas nesta semana".
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/Turmas.tsx:70`: `useTopoDoPainel(true)` mede e grava `--topo-do-painel` também na aba Turmas, onde o miolo não é usado. Não quebra nada; daria para passar `aba === 'semana'`.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-06 22:16:39 · `tasks/prd-semana-do-professor/6_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- T1: aulas de três turmas; anterior, seguinte e "Hoje" mudam a semana e o endereço; hoje marcado em texto.
- T8: carregando, os quatro vazios, o aviso do calendário, o erro com "Tentar de novo".
- T9: um dia por vez no celular, abrindo em hoje ou no primeiro dia, sem rolagem a 360 px; alvos de toque.
- T10: 40 aulas no Chromebook a 1366 × 768, só o painel rola; axe.
- T11 e S14: "Falta preencher" por aula, neutro, sem total; não aparece na aula passada nem na que tem texto.
- RF1: fim de semana só com aula. RF3: feriado, recesso e evento. RF14: aula fora da grade.
- Endereço: `?ver=semana` com `replace`; `?semana=` inválido ou fora do ano abre a de hoje; `?turma=`; só ids e datas.
- Navegação presa ao ano, com o foco nas pontas.
- Corrida: a semana A segurada não substitui a B; o mesmo endereço colado de novo faz uma leitura só.
- Isolamento e recomeço: P30 (segunda professora na mesma aba) e RF9 (troca de escola).
- Borda: a professora que dá duas disciplinas na mesma turma.

**Cobertos:**
- Cada linha da tabela tem o caso citado, e os nomes conferem com os títulos dos testes, inclusive os itens juntados por ponto e vírgula (linhas 49, 51 e 58).
- `--faltando`: as 16 linhas que nenhum bloco alcança têm motivo, e o motivo se sustenta. As cláusulas novas com condição têm bloco.
- Os quatro arquivos de unidade passam: 78 casos.
- Sem `.skip`, sem teste comentado, sem IA na tarefa.
- A corrida é testada de verdade: a leitura da semana A fica segurada no ar com `page.route`. A troca de escola (RF9) segura a leitura na mesma semana: é um teste de isolamento que funciona.
- As duas disciplinas na mesma turma estão no teste do filtro, em `Semana.test.tsx`.
- O Chromebook já roda com a CPU e a rede limitadas, pelo `profiles.ts`.

**Bloqueantes:**

1. **Três casos do e2e falham em todo sábado e domingo.**
   - Onde: `e2e/professor-semana.spec.ts:112` e `:116` (o caso do `?semana=` que abre a semana pedida), e `:423`, `:440` e `:444` (o caso da semana A segurada no ar).
   - O que está errado: esses casos esperam ver o dia de hoje na tela (`[data-dia="${cena.hoje}"]`). Mas a grade padrão de `montarASemana` só tem aulas na terça e na quarta. A API não manda sábado nem domingo sem aula (`apps/api/src/semana/montar-dias.ts:82`). Então, no fim de semana:
     - no computador, a coluna de hoje não existe;
     - no celular, a tela abre no primeiro dia, que é a segunda.

     Hoje é sexta (06/11): o primeiro push de sábado deixa a esteira vermelha sem defeito nenhum no código.
   - Correção exigida: nesses dois casos, a cena precisa ter uma aula no dia da semana de hoje, como o caso T9 já faz (`grade: () => [{ dia: diaDeHoje, … }]`). A outra saída é afirmar a semana de hoje pelo título (`Semana de …`), e não pela coluna de hoje.

**Recomendações:**
1. **O caso P30** (`e2e/professor-semana.spec.ts:448`, a segunda professora na mesma aba) não alcança o cache da semana.
   - A segunda professora abre a semana de hoje, que é outra chave (`['semana', segunda]`) da que a primeira deixou no cache (`proxima`). Hoje o caso só pegaria vazamento pela lista de vínculos, e só se ela entrar antes de vencer o `staleTime` de 30 s.
   - O certo é abrir `caminhoDaSemana(primeira.proxima)` com a leitura segurada e afirmar durante o "Carregando", como o caso RF9 já faz.
2. **O cenário T1 pede e2e**, mas o e2e só passa por "Semana seguinte". "Semana anterior", "Hoje" levando ao endereço e o "Hoje" escrito no dia só são provados no `Semana.test.tsx` (jsdom). Vale juntar ao caso T1 do e2e.
3. **O cenário T8 pede e2e**, mas três vazios só aparecem na unidade e no jsdom: "Semana de recesso", "O ano letivo ainda não começou" e "Sem aulas nesta semana" para a semana fora do ano.
4. **A Autoconferência, item 1, diz que há blocos que não existem**: para "o `enabled` da leitura" (não há `enabled` no código) e para "a `queryKey` com a segunda" (não há bloco em `apps/web/src/areas/professor/turmas/api/semana.ts`). A chave está protegida de fato pelos casos de navegação, mas o texto precisa dizer isso, e não citar blocos que não existem.
5. **Alvos de toque**: o caso não mede o seletor "Turma e disciplina" nem o botão "Ver todas as turmas" no celular.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/tasks/prd-semana-do-professor/6_task.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/e2e/professor-semana.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/e2e/support/professor/semana.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/semana/Semana.test.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/semana/semana.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/components/ui/fields/DaySelector.test.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/apps/web/src/areas/professor/turmas/Turmas.test.tsx`

## revisor-geral · 2ª rodada · APROVADO · 2026-11-06 22:48:57 · `tasks/prd-semana-do-professor/6_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

Esta rodada audita só o diff `581191ce` → `bcd44bad` e o que ele afeta. Nada novo invade outra tarefa.

- **Comentários em `apps/web`:** os três batem com o código.
  - Semana.tsx:196: "fica desligada" corresponde ao `disabled={!podeAnterior}` e ao `disabled={!podeSeguinte}` das linhas 171 e 177. O texto antigo, "some", estava errado.
  - semana.ts:74: o título vai de segunda a domingo, que é o que `somarDias(segunda, 6)` calcula.
  - Semana.tsx:42-44: o aviso sobre o `resetQueries` global está certo. `main.tsx:35-36` liga `aoTrocarDeSessao` a `clienteConsultas.resetQueries()`, e a chave `['semana', segunda]` não leva a escola nem a pessoa.
- **e2e:**
  - O T1 agora testa "Hoje", que tira `?semana=` do endereço, e "Semana anterior", que põe `semana=<anterior>` no endereço.
  - O P30 segura a leitura da semana já em cache e confere que o nome da turma da primeira professora não aparece durante "Carregando" nem depois. É essa prova que o tenancy-guardian e o documento usam para recusar a sessão na `queryKey`.
  - `gradeDeHoje` dá aula no dia de hoje para o caso não quebrar no fim de semana, porque a API só manda sábado e domingo quando têm aula (RF1).
- **6_task.md:** o item 1 agora diz que a consulta não tem `enabled` e que a `queryKey` não tem bloco de mutação, com o motivo. O código confirma: não há `enabled` em `api/semana.ts`, e a Tech Spec não o pede, então não há divergência.
- **Recomendações recusadas ou adiadas:** cada uma tem destino ou motivo na tabela. As que vão para o `TODO.md` estão lá, na seção da 6.0.

Recomendações:
- `e2e/professor-semana.spec.ts:39-43`: `GRADE_DE_T1` copia linha por linha o `GRADE_PADRAO` de `e2e/support/professor/semana.ts:127-131`. Exportar o `GRADE_PADRAO` e usá-lo no T1, para as duas grades não se separarem quando uma mudar.
- `e2e/professor-semana.spec.ts`, caso P30: o `page.route('**/v1/semana?*')` fica ativo até o fim do caso. Hoje não atrapalha, mas um `page.unroute` depois do `liberar()` evita surpresa se o caso ganhar mais passos.

## test-engineer · 2ª rodada · APROVADO · 2026-11-06 22:49:42 · `tasks/prd-semana-do-professor/6_task.md`

VEREDITO: APROVADO

Cenários exigidos: os mesmos da 1ª rodada. Nesta rodada eu conferi três coisas: a correção exigida (os casos que olham o dia de hoje não podem quebrar no sábado e no domingo), as três recomendações que a ordem aplicou (P30, T1 e o item 1 da Autoconferência) e o diff `581191ce..bcd44bad` em `apps` e `e2e`.

Cobertos:
- **A correção exigida foi feita.**
  - O caso do `?semana=` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/e2e/professor-semana.spec.ts:127`) e o da semana A segurada (`:442`) agora montam a cena com `montarASemana({ grade: gradeDeHoje })`.
  - O `gradeDeHoje` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/e2e/support/professor/semana.ts:42`) põe uma aula no dia da semana de hoje para cada turma. Assim a API sempre manda a coluna de hoje, também no sábado e no domingo. No computador, a coluna aparece; no celular, a tela abre em hoje.
  - Conferi o resto dos dois casos, e nada quebra com a grade nova:
    - `:130` continua a valer, porque a semana seguinte não contém hoje.
    - `:133` e `:137` mostram hoje depois da volta à semana atual.
    - `:461`, `:465` e `:466` continuam válidos.
  - O T9 passou a usar o mesmo ajudante, e nada mudou nele.
- **P30 (`:469-497`) agora prova o que diz.**
  - A segunda professora abre `primeira.proxima`, a mesma chave `['semana', segunda]` que a primeira deixou no cache. A leitura fica segurada por `page.route`, e o caso exige "Carregando a semana…" sem o nome da turma da primeira.
  - `irPara` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/e2e/support/professor/scenario.ts:39`) navega por `pushState` e não recarrega a página. A saída também não recarrega: não há `location.reload` nem `location.assign` em `api/sessao.ts`. Então o cache em memória sobrevive à troca de pessoa, a não ser pelo `resetQueries` de `main.tsx:36`.
  - Se esse reset for removido, a tela mostra as aulas da primeira e o caso falha em `:491` e `:492`. A mutação chega à cláusula.
  - O comentário novo em `Semana.tsx` registra que a chave depende desse reset global, e isso está certo.
- **T1 (`:73-103`) agora passa por "Hoje" e por "Semana anterior".**
  - A cena acrescenta uma aula às 12h30 no dia de hoje para a turma 0. Então "Hoje" tem coluna na tela também no fim de semana.
  - O caso exige três coisas: o endereço sem `?semana=`, o selo "Hoje" escrito dentro de `[data-dia=hoje]` (vem de `DiaDaSemana.tsx:29`) e o endereço com `semana=${cena.anterior}`.
  - "Semana anterior" fica ligada nesse ponto, porque o ano da cena começa 63 dias antes da segunda de hoje.
  - A aula extra não deixa dois cartões com o mesmo nome, nem mesmo quando hoje é terça (o 12h30 tem nome próprio).
  - A linha T1 da tabela do documento cita o nome novo do caso.
- **O item 1 da Autoconferência agora é verdadeiro.** O texto antigo citava um bloco do `enabled` e da `queryKey`, que nunca existiu. O novo diz que a `queryKey` não tem bloco e aponta os casos de e2e que a protegem.
- **O `irPelaNavegacao` saiu dos imports e não ficou nenhum uso dele no arquivo.**
- **O diff não acrescenta nenhuma cláusula de produção.** Em `apps/web` mudaram só dois comentários (`Semana.tsx`, `semana.ts`), então não falta bloco de mutação.

Bloqueantes: nenhum.

Recomendações:
- `GRADE_DE_T1` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/e2e/professor-semana.spec.ts:39`) copia à mão o `GRADE_PADRAO` de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l3/e2e/support/professor/semana.ts:127`. Se a grade padrão mudar, o T1 passa a testar outra cena sem que ninguém perceba. Exportar o `GRADE_PADRAO` e estendê-lo resolve.
- No T1, depois de "Semana anterior", o caso olha só o endereço e um título qualquer (`:101-102`). Afirmar `[data-dia="${cena.anterior}"]` visível, ou o texto do título da semana anterior, provaria que a tela também mudou, e não só o endereço.

Os e2e não rodaram nesta rodada: eles pedem a pilha inteira, e quem os prova é o portão da tarefa. Esta rodada foi leitura do diff e dos casos.
