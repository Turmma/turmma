# Achados das revisões — `tasks/prd-onboarding-por-convite/14_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-06 00:17:09 · `tasks/prd-onboarding-por-convite/14_task.md`

VEREDITO: APROVADO

Tela vista: sim (10 fotos lidas, cheia e vazia, no computador e no celular, com e sem o painel "Importar grade"). Faltou fotografar o painel "Importar calendário" e a prévia com aviso ou erro. Li essas partes no código (`PaineisDeImportacao.tsx`, `ImportarPlanilha.tsx`) e no e2e, e a foto não as cobre. Segundo o prompt, nenhuma tela rola a 1366 × 768. Procurei `1366` no `prd.md` e não achei nenhum RF que diga que a tela cabe. O e2e `paginaNaoRola` da tarefa cobre a tela vazia.

Estados: ok. Conferi no código:
- **Grade:** tem carregando, erro com "Tentar de novo", vazio e com dado (`GradeECalendario.tsx:154-168`). O vazio convida com "Baixar modelo", como mostra a foto vazia.
- **Turmas, disciplinas e anos letivos:** cada leitura tem carregando e erro (`GradeECalendario.tsx:201-207` e `:327-328`).
- **Calendário:** tem os quatro estados (`GradeECalendario.tsx:241-250`).
- **Sem turma e sem ano em curso:** o convite diz o próximo passo ("Abra o ano letivo primeiro", com o atalho "Ir para Turmas").
- **Cobertura:** o `GradeECalendario.test.tsx` tem um caso para cada um.

Acessibilidade: ok.
- **Tabela da grade:** tem `caption` para leitor de tela e `th scope` nas colunas e nas linhas.
- **Célula sem aula:** mostra "—" visualmente e "Sem aula" para leitor de tela.
- **Região que rola de lado:** tem `role="region"` e `aria-label`, e só entra no Tab quando a tabela passa da largura (`GradeECalendario.tsx:68-92`).
- **Campos:** o select de turma e o de ano têm `label`.
- **Anúncio:** o "Planilha gravada" sai por `role="status"`.
- **Painel:** o `Sheet` é um `<dialog>` modal, com Esc e botão "Fechar" de 44 px, e devolve o foco a quem abriu.
- **e2e:** inclui o teste de acessibilidade automático (axe).

Chromebook fraco: sem bloqueio.
- **Lista longa:** a grade de uma turma é pequena e o calendário de um ano é curto, então não precisa de virtualização.
- **Peso:** a tela é carregada sob demanda (`lazy`, `routes.tsx:19`).
- **Resposta atrasada:** a leitura da grade tem chave por turma, e o e2e prova que a resposta atrasada de outra turma não toma o lugar.
- **Não verificado:** o teste com throttling de rede e de CPU. Não há evidência dele nos arquivos que li, e a regra 50 item 1 diz que só a revisão o garante.

Celular: ok.
- **Largura:** nas fotos a 360 px não há rolagem horizontal nem texto cortado.
- **Botões:** os modelos empilham, e "Importar grade" cabe ao lado do título.
- **Grade:** rola dentro do cartão, como a Tech Spec §9 prevê.
- **Calendário:** vira cartões (rótulo e valor).
- **Painel:** vira folha de baixo, com a ação principal de 44 px.
- **Alvos:** o e2e mede 24 px nos botões comuns e 44 px na ação cheia, nos projetos `chromebook` e `celular`.
- **Hover e atalho:** nada depende deles.
- **Fotos cortadas:** a barra inferior sobrepõe o select de turma e o corte no pé do painel aparecem só porque a captura é de página inteira com barra fixa. É efeito da captura, não defeito da tela.

Ação oficial protegida: sim. Importar grade ou calendário substitui o do ano.
- **Texto:** o painel avisa "Importar de novo substitui a grade do ano".
- **Prévia:** ela mostra o que entra, o que sai e os avisos de horário antes de "Gravar grade" ou "Gravar calendário" (`previa-da-planilha.ts`, `ImportarPlanilha.tsx`).
- **Erro:** prévia com erro não grava.
- **Calendário do ano planejado:** o botão de importar some, porque o planejado só se lê (`GradeECalendario.tsx:258`).
- **Aviso de IA:** nada na tela é saída de IA.

Bloqueantes: nenhum.

Pele (`docs/interface.md`): sem contradição. Reconheço o `TabbedPage`, a tabela, o `Sheet`, os estados vazios e a paleta de peças existentes. Uma só ação cheia por tela (o laranja só no vazio da grade). O texto na tela é todo em português, sem id nem chave técnica. As datas usam `formatDate`. Os sufixos como "b72894d9" nos nomes são do seed sintético.

Recomendações:
1. **Abas no celular:** a 360 px as quatro abas quebram em duas linhas (Turmas e Professores em cima, Material e Grade e calendário embaixo). Nada se esconde nem se embaralha, mas o traço de seleção fica só na segunda linha. Vem do `TabbedPage` compartilhado (`apps/web/src/areas/coordenacao/comum/moldura`). Vale tratar à parte, com abas que rolam de lado ou rótulo mais curto.
2. **Linhas altas no celular:** na foto `coordenacao--coordenacao-grade--celular-1.png`, as linhas 08:20 e 09:10 ficam com cerca de 170 px, com "—" nas duas colunas visíveis. É efeito de a coluna do professor quebrar em várias linhas nas colunas fora da vista. Pode melhorar com `whitespace-nowrap` ou uma largura mínima maior nas células (`GradeECalendario.tsx:117`).
3. **Calendário vazio:** o vazio (`GradeECalendario.tsx:245-248`) não leva botão, só o texto "use Importar calendário", com o botão logo acima. Funciona e evita uma segunda ação cheia. Um botão secundário "Baixar modelo do calendário" ali deixaria o convite igual ao da grade.
4. **Roteiro da demonstração:** `docs/roteiro-da-demonstracao.md:368` ainda diz que calendário e grade "entram numa fase seguinte". A tarefa 14.5 pede conferir esse arquivo. Confirme se a linha continua certa para o MVP de apresentação ou se precisa de uma nota de que a aba já existe.
5. **Teste com throttling:** registre a medida com throttling de rede e de CPU na validação, porque nada na tarefa a mostra.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-06 00:17:11 · `tasks/prd-onboarding-por-convite/14_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. Ela não grava em `Nota`. A única escrita nova no banco são os auxiliares de teste em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/support/seed.ts` (de 1358 a 1413), que gravam em `alocacao` e `evento_calendario`. Todos com autor humano? Sim, nada a verificar aqui.

Decisão autônoma sobre aluno: ausente. A tarefa trata de grade horária, calendário e modelos de planilha, e nada na tela trata de trajetória de aluno.

Aprovação registrada: ok. Nenhuma saída de IA passa por esta tarefa. A importação da grade e do calendário começa pela coordenação, mostra a prévia e só grava quando ela clica. A prévia diz o que a planilha tira do ano (`aulas_removidas`, `eventos_removidos`, em `apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts`, de 93 a 104). O vínculo de professor que a planilha cria "espera a confirmação dele".

Supervisão do tutor: ok. A tarefa não toca o tutor.

Autonomia declarada e visível: sim, sem mudança. Nenhum agente foi tocado.

Bloqueantes: nenhum.

Nas fotos:
- **Escola cheia, no computador e no celular** (`coordenacao--coordenacao-grade--computador.png`, `-celular-1.png`, `-celular-2.png`): modelos de planilha, grade por turma com disciplina e nome do professor, e calendário com tipo e descrição. Não aparece saída de IA, nota, conceito, sugestão de nota, ranking de professor nem dado de comportamento de aluno.
- **Painel "Importar grade"** (`coordenacao--coordenacao-grade--Importar-grade--computador.png`): é só a instrução da planilha, de `textos-da-grade.ts:14`, e o convite a baixar o modelo. Não há IA no caminho.
- **Escola vazia** (`vazia--coordenacao--coordenacao-grade--computador.png`): o vazio convida a "Baixar modelo" e diz "aqui você só a lê". A grade nasce de planilha humana, não de geração.
- **Indução de uso e saída** (itens 4b e D59): o painel fecha pelo "X" em um clique, e nada induz uso.

A busca por nota, `lancadaPor`, agente, tutor, IA, aprovação, conceito, ranking e comportamento em `apps/web/src/areas/coordenacao/grade/` e em `e2e/grade-e-calendario.spec.ts` não achou nada que toque a regra 70. Os únicos resultados são "nota do planejado" (uma observação de texto, no título de um teste) e `dia.nome`.

Recomendações:
- Nenhuma no escopo da regra 70.
- Uma observação para a validação: a grade passa a encerrar vínculo de professor (`vinculos_encerrados`, em `textos-da-grade.ts:28`). A tela só dá essa contagem na conclusão, e a prévia não a anuncia em `FRASE_DA_CONTAGEM` (`previa-da-planilha.ts`, de 93 a 100). Não envolve IA. Mas o coordenador ver antes de gravar que um professor perde a turma interessa ao `frontend-reviewer` e à regra 10/20 (fim de vínculo), não a mim.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-06 00:17:15 · `tasks/prd-onboarding-por-convite/14_task.md`

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
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx:356`: depois de gravar, a tela recarrega tudo o que está sob a chave da estrutura (`ESTRUTURA_QUERY_KEY`), e não só a grade e o calendário. Hoje o custo é baixo: só a coordenação usa essa tela, a gravação é rara e só as leituras abertas na tela são refeitas. Se mais telas passarem a usar essa chave, convém recarregar só `[...ESTRUTURA_QUERY_KEY, 'grade']` e `[...ESTRUTURA_QUERY_KEY, 'calendario']`.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/grade/api/grade.ts:13`: `GET /v1/grade?turmaId=` não é paginado e conta com o teto de 3.000 linhas da planilha. Por turma isso fica pequeno e é aceitável. Esse teto precisa continuar valendo no servidor, que é trabalho da 12.0 e não desta tarefa.

Por que não há bloqueante:
- **Só tela:** a tarefa não muda nada em `apps/api`, `packages/core`, `apps/worker`, nem em migration ou infra. Mexe só na tela da coordenação, nos testes e nos documentos.
- **Endpoints da 12.0:** a tela só lê `GET /v1/grade` e `GET /v1/calendario`, que já existiam. Rate limit e índice deles não mudaram e não foram reauditados.
- **Gravação:** a importação continua pelo mesmo caminho da 13.0, sem mexer na fila. A tela usa `useSingleSubmit` contra o clique duplo, e o servidor responde `CONFLITO` quando a escola já tem outra importação em andamento.
- **Modelos:** os modelos de planilha são gerados no navegador, sem nenhum pedido ao servidor.
- **Funções de teste:** as funções novas em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/support/seed.ts` gravam direto no banco, mas só nos testes.

## privacy-guardian · 1ª rodada · REPROVADO · 2026-11-06 00:17:44 · `tasks/prd-onboarding-por-convite/14_task.md`

VEREDITO: REPROVADO

Campos pessoais tocados: nenhum campo novo. A tela lê dados que já existiam: o nome do professor em cada aula da grade (`AulaDaGrade.professor.nome`, sem e-mail, porque o `strictObject` em `packages/shared/src/importacao/contratos.ts:211` não o deixa passar), a sala (texto livre) e a descrição do evento do calendário (texto livre). O modelo da planilha de grade pede o e-mail do professor, que é adulto e já está na linha "Planilha em gravação" do `docs/lgpd.md`. Nenhum campo de aluno muda, e o modelo de alunos continua só com `turma;nome;matricula`.

Fora da tabela de dados do docs/lgpd.md: nenhum campo. Mas a tabela descreve um controle que esta tarefa deveria entregar e não entregou (bloqueante 1).

Autorização por objeto: ok. A tela não monta escopo. A escola vem do token, o `anoLetivoId` só segue para o ano planejado e quem confere é a API da 12.0. A troca de pessoa na mesma aba está coberta pelo caso "a segunda pessoa na mesma aba" do `e2e/grade-e-calendario.spec.ts`.

Logs: limpos. A pasta `grade/` não tem `console.*`, `localStorage` nem `sessionStorage`. O anúncio de conclusão só traz contagens.

Auditoria: não se aplica. A tarefa só lê grade e calendário, que não são dado de aluno. A gravação é auditada na API (`planilha.gravada`).

Envio externo: nenhum. Os modelos nascem no navegador como `Blob` e não passam pelo servidor.

Seed/fixture: sintético. Os e-mails usam o domínio `@educa.invalid` e os nomes levam um sufixo de marca ("Professora Sintética Helena b72894d9"). Os helpers novos em `e2e/support/seed.ts:1358-1413` gravam só no banco de teste. As fotos mostram a mesma coisa.

Bloqueantes:

1. **Falta pedir, na tela, para não escrever nome de pessoa na sala nem na descrição do evento.** Está em `apps/web/src/areas/coordenacao/grade/textos-da-grade.ts:13-17`.
   - **O que o mapa de dados diz.** O `docs/lgpd.md:74`, na linha "Aula da grade", afirma que o modelo da planilha de grade (tarefa 14.0) e a tela pedem para não escrever nome na sala. O `docs/lgpd.md:75` classifica o `evento_calendario` como "nenhum, por desenho" e diz que o modelo e a tela pedem o mesmo para a descrição. A 5.0 (`5_task.md:700`) e a 12.0 (`12_task.md:630`) passaram esse aviso para esta tarefa.
   - **O que o código faz.** `INSTRUCAO_DA_GRADE` diz só "e a sala, se houver". `INSTRUCAO_DO_CALENDARIO` diz só "o tipo e a descrição". Os outros textos da tela também não avisam: o vazio do painel (`PaineisDeImportacao.tsx:397` e `:407`), o vazio da grade (`GradeECalendario.tsx:162`), o do calendário (`GradeECalendario.tsx:247`) e a seção dos modelos (`GradeECalendario.tsx:292`). A foto `coordenacao--coordenacao-grade--Importar-grade--computador.png` confirma: o painel mostra a instrução sem o aviso.
   - **Por que importa.** O mapa de dados promete um controle que não existe. A classificação "sem pessoa" do calendário depende dele. Sem o aviso, nada impede um "Sala da Prof. Ana" ou um "Reunião com a mãe do aluno X". Esses textos aparecem para todo professor da turma e entram no calendário da escola inteira.
   - **Correção exigida, em quatro passos:**
     1. Pôr nas duas instruções, e no vazio de cada painel, um aviso curto de não escrever nome de pessoa: na sala ("Lab 2", "Sala 12") e na descrição do evento.
     2. Como o modelo traz só o cabeçalho, e uma linha de exemplo seria lida como dado, o aviso fica na tela. Ajustar o `docs/lgpd.md:74-75` para dizer "a tela pede", em vez de "o modelo e a tela".
     3. Escrever um teste que prove o aviso, em `textos-da-grade.test.ts` ou no e2e do painel: tirado o aviso do texto, o teste quebra.
     4. Registrar em "Recomendações sem aplicar" do `14_task.md`, hoje vazia, que o item vindo da 5.0 e da 12.0 foi atendido.

Recomendações:
- Confirmar com o `frontend-reviewer` que o e-mail de professor que aparece nos textos de erro da prévia da grade (`previa-da-planilha.ts`, `email_invalido`) nunca leva o valor lido, só o código. Hoje leva só o código. Fica o registro para ninguém incluir o e-mail na frase depois.

Pergunta de fechamento: o código responde. A aula entra no arquivo do titular do professor pelo `vinculo_id` desde a 11.0 e a 12.0. O evento do calendário, por desenho, não tem titular. O que esta tarefa precisa garantir é o aviso do bloqueante 1, porque sem ele esse "por desenho" fica só no papel.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-06 00:18:20 · `tasks/prd-onboarding-por-convite/14_task.md`

**VEREDITO: REPROVADO**

**Cenários exigidos:**
- **Caminho feliz:** a aba fica ao lado das outras três e acende Escola. Os quatro modelos baixam o cabeçalho de `packages/shared`. O modelo baixado e preenchido entra sem erro. A grade aparece por turma (dias × horários) e o calendário do ano em curso também.
- **Casos de borda:**
  - aula conjunta e turma dividida: os dois avisos de horário, e duas aulas na mesma célula;
  - disciplina que saiu do cadastro;
  - turma sem aula, ou turma sem professor alocado;
  - aula no sábado;
  - escola sem ano em curso;
  - virada de ano: o planejado só para ler, e o encerrado fora do seletor;
  - feriado com data fora do ano letivo;
  - planilha que só tira aula ou evento do ano;
  - o mesmo arquivo enviado de novo;
  - planilha suja.
- **Permissão:** o painel de importar não abre sem ano em curso, nem pelo endereço.
- **Isolamento:** a segunda pessoa, de outra escola, na mesma aba.
- **Recomeço e concorrência:** a resposta atrasada da turma anterior, a falha ao gravar com o painel aberto, e o "Tentar de novo" de cada leitura.

**Cobertos:** cada linha da tabela de testes cita um teste que existe com esse nome. Vale também para as linhas com itens juntados por ponto e vírgula: 48, 49, 50, 51, 52, 55, 63 e 65.
- Os 155 casos de unidade e componente das pastas `grade/` e `importacao/`, de `molduras.test.tsx` e de `navigation.test.ts` passam. Rodei com `npx vitest run`.
- Não há `.skip`, `.only` nem teste comentado.
- Os blocos de mutação batem com o `git diff`, linha por linha, e os nomes de teste citados existem.
- As duas linhas sem bloco têm o motivo escrito. Conferi o `?? 'em-curso'`: a mutação é equivalente mesmo, porque `undefined` dentro da chave vira `null` no hash e continua diferente de qualquer id.
- Não há IA nesta tarefa.
- O clique duplo em "Gravar" vem do `useSingleSubmit` da 13.0, que já tem teste lá.

**Bloqueantes:**

1. `e2e/grade-e-calendario.spec.ts:225-228`: o teste da resposta atrasada não espera a resposta atrasada.
   - **O que está errado:** logo depois de `segurada.abrir()`, o teste afirma três coisas: a região da turma B não existe (`toHaveCount(0)`), o seletor está na turma A (`toHaveValue`) e a região A mostra Matemática (`toContainText('Matemática')`). As três já são verdade antes de a resposta de B chegar, e o Playwright aceita na primeira tentativa. A resposta de B ainda precisa passar pelo `rota.continue()` e ir ao servidor. Logo depois vem o `retida.clear()` com a troca para B, e aí a tela mostraria B de qualquer jeito.
   - **Por que bloqueia:** suponha uma tela com o bug que o cenário quer pegar, por exemplo `useState` preenchido por um efeito sem cancelamento, em que a resposta de B sobrescreve A. Esse teste passaria verde. Ele não falha sem a regra.
   - **Um detalhe que muda a correção:** a `queryFn` usa o `signal`. Então o TanStack Query provavelmente cancela o pedido de B quando a turma volta para A, e a resposta pode nem chegar ao cliente.
   - **Correção exigida:**
     - Antes de abrir a porta, registrar a espera pelo fim do pedido de B: `page.waitForEvent('requestfinished')` ou `page.waitForEvent('requestfailed')`, filtrando pela URL com `turmaId` de B. Também serve `page.waitForResponse`, se o cancelamento não acontecer.
     - Abrir a porta, esperar esse fim e só então fazer as três asserções sobre A.
     - Opcional: provar que a região A continua de pé depois de um ciclo de render, por exemplo com uma asserção positiva sobre a célula de A depois da espera.

**Recomendações:**
- `apps/web/src/areas/coordenacao/molduras.test.tsx:154`: o caso de Registros foi renomeado para "as quatro abas", mas Registros continua com três (IA, Pedidos e Privacidade). O nome deveria voltar a "três".
- `GradeECalendario.tsx:236` (`?? anoEmCurso`): um caso de componente pode cobrir esse caminho. O ano escolhido sai da lista depois de um novo pedido dos anos (`anos` volta sem o planejado), e a tela deve voltar ao ano em curso sem quebrar. Isso tiraria a linha da lista "sem bloco".
- Permissão por papel na rota nova: a guarda da área `/coordenacao` cobre a rota pelo prefixo. Mesmo assim, uma linha em `e2e/areas.spec.ts` com o professor batendo em `/coordenacao/grade` deixaria a prova explícita.
- Teste "o vazio convida…" (`e2e/grade-e-calendario.spec.ts:153`): a contagem de `button.bg-laranja` só é feita no vazio. No estado com dado, o "uma ação cheia por tela" não é medido. Isso não bloqueia, porque com dado pode não haver nenhuma ação cheia.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-06 00:18:55 · `tasks/prd-onboarding-por-convite/14_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

Conferi três pontos e nenhum deu problema:
- Os códigos de erro e de aviso que a tela traduz existem em `packages/core/src/importacao/tipos/grade.ts` e `calendario.ts`, e nenhum código desses dois arquivos ficou sem texto.
- A mudança no `podeGravar` não abre gravação indevida. A planilha que só tira aulas ou eventos grava. O mesmo arquivo de novo continua "Nada novo para gravar", porque o core marca `ja_existe` só quando a aula é igual e marca `entra` quando muda o fim ou a sala.
- A aba nova não mexe no que o roteiro da demonstração percorre.

Recomendações:
1. **Nome de teste errado.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/molduras.test.tsx:154`, o caso de Registros virou "as quatro abas", mas Registros continua com três (IA, Pedidos e Privacidade), e o próprio teste confere três. Voltar para "as três abas".
2. **Direção da dependência.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx:9` importa `baixarModelo` de `../grade/modelos-de-planilha`. Com isso a peça genérica da importação passa a depender da aba Grade. O `baixarModelo` e o `textoDoModelo` deveriam morar em `importacao/` ou em `comum/`, e a grade os importaria de lá.
3. **Nome do arquivo em dois lugares.** O nome do modelo está tanto em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/grade/PaineisDeImportacao.tsx:15,25` (`'modelo-grade.csv'`, `'modelo-calendario.csv'`) quanto em `MODELOS_DE_PLANILHA` (`modelos-de-planilha.ts:14-15`). O botão "Baixar modelo" do painel e o da lista de modelos podem acabar com nomes diferentes. O painel deveria ler o nome de `MODELOS_DE_PLANILHA`.
4. **Ramo que nunca roda.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/grade/modelos-de-planilha.ts:32-33`, o `find` seguido de `if (modelo !== undefined)` trata um caso impossível, porque o tipo da planilha é uma lista fechada de quatro. Um `Record<TipoDePlanilha, …>` resolve sem esse ramo.
5. **Texto de erro errado para o calendário.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts:45` (`fim_antes_do_inicio`) serve à grade e ao calendário. No calendário, o "ou no mesmo horário" está errado: lá as linhas são datas, e o evento de um dia só (início igual ao fim) é válido. Dar um texto próprio para cada tipo.
6. **Frase que promete o que ainda não existe.** Em `previa-da-planilha.ts:96`, a prévia diz "professor novo será cadastrado, com convite para copiar". O convite para copiar do professor cadastrado pela planilha só chega com a 15.0 (15.2). Até lá essa frase descreve algo que a aba Professores ainda não entrega.
7. **RF16, o ano planejado.** A tela recusa importar sem ano em curso ("Abra o ano letivo primeiro") e grava só no ano em curso, embora o `cenarios.md` (seção "Isolamento e ano letivo") diga que a prévia e o gravar aceitam o filtro do planejado sem ano em curso. A tarefa só pede o planejado para leitura no calendário, então isso não invade nem diverge. Mas o item que já existe no `TODO.md:2699`, aberto na 13.0 só para a planilha de alunos, deveria passar a citar também a grade e o calendário, para o Arquiteto decidir tudo de uma vez.
8. **Mudança fora do tema.** A divisão do caso do aluno em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/areas.spec.ts:399-412` não tem relação com a aba nova e entrou para caber no prazo do portão. Deixar isso registrado na mensagem do commit.

Nas fotos não há achado da minha regra. A tela traz as quatro abas com "Grade e calendário" acesa sob Escola, os quatro modelos, a grade em tabela com os dias nas colunas e os horários nas linhas, o calendário de 2026 e o vazio com "Baixar modelo". Os nomes seguem o glossário, e não aparece nada que a tarefa não pediu.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-06 01:08:02 · `tasks/prd-onboarding-por-convite/14_task.md`

VEREDITO: APROVADO
Tela vista: sim (12 fotos lidas: `/coordenacao/grade` e o painel "Importar grade", no computador e no celular, com escola cheia e vazia). O painel "Importar calendário" não foi fotografado; li o código dele e o teste que o cobre.
Estados: ok. O vazio da grade, o do calendário e o do painel convidam a baixar o modelo e dizem o próximo passo. Carregando e erro não aparecem na vitrine, então os conferi pelo código e pelos testes da rodada anterior. O diff desta rodada não os altera.
Acessibilidade: ok. O diálogo tem nome, o campo do arquivo tem rótulo e os textos novos são parágrafos comuns.
Chromebook fraco: sem mudança nesta rodada. O diff só troca texto e uma tabela de nomes de arquivo.
Celular: ok a 360 px. Não há rolagem horizontal e o texto novo quebra dentro do bloco. Os botões de baixar modelo têm cerca de 44 px, e o "Baixar modelo" do vazio é o botão principal, com cerca de 44 px. O painel abre como folha, com o botão de fechar visível.
Ação oficial protegida: sim. Gravar grade e Gravar calendário continuam depois da prévia. A única mudança de texto no caminho é o erro de linha do calendário.

Nenhuma tela passa da janela a 1366 × 768, e o PRD não pede que a tela caiba.

**Correção exigida na ordem: feita**
O aviso de não escrever nome de pessoa aparece em cinco lugares, e eu vi cada um:
- Seção "Modelos de planilha": computador e celular.
- Instrução do painel "Importar grade", com o aviso da sala.
- Vazio do painel "Importar grade", com o aviso da sala.
- Vazio da grade, com o aviso da sala.
- Vazio do calendário, com o aviso da descrição. Vi na foto do celular da escola vazia.

O aviso da descrição na instrução e no vazio do painel do calendário está em `textos-da-grade.ts:17-32` e tem teste em `GradeECalendario.test.tsx`. O painel não foi fotografado.

Os textos vêm de uma fonte única, `AVISO_DA_SALA` e `AVISO_DA_DESCRICAO` (`textos-da-grade.ts:17-18`). `textos-da-grade.test.ts` confere que todos os cinco textos de vazio e de modelos os contêm.

O texto do erro `fim_antes_do_inicio` do calendário não fala mais em horário. Fica em `ERROS_DA_LINHA_DO_CALENDARIO` (`textos-da-grade.ts:35`) e entra pelo `textoDoErro(codigo, proprios)` (`previa-da-planilha.ts`). Os demais códigos seguem os textos gerais, e há teste de unidade e de componente para isso.

`docs/lgpd.md` foi atualizado e agora diz que a tela é que pede para não escrever nome.

Bloqueantes: nenhum.

Recomendações (já estão no `TODO.md`, nenhuma bloqueia):
- A 360 px as quatro abas de Escola quebram em duas linhas. O traço da aba ativa fica só na segunda linha. Isso é do `TabbedPage`, que é compartilhado.
- As fotos de celular de página inteira mostram a barra inferior fixa no meio da página. É efeito da captura, não defeito da tela.
- `ImportarPlanilha.tsx` importa `baixarModelo` de `../grade/modelos-de-planilha`. A peça genérica fica dependente da aba Grade. Mover `baixarModelo` para `importacao/` ou `comum/` resolve.
- A prévia da grade não anuncia `vinculos_encerrados`. O coordenador só vê que um professor perde a turma depois de gravar.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-06 01:08:27 · `tasks/prd-onboarding-por-convite/14_task.md`

VEREDITO: APROVADO
Tabelas verificadas: nenhuma tabela nova ou alterada nesta rodada. O diff de `65a5eb36` a `88097d64` não toca `apps/api` nem `packages`. Os arquivos ainda não versionados da árvore de trabalho são iguais aos de `88097d64`. A única mudança de mapa de dados está em `docs/lgpd.md:71-72` (linhas de `alocacao` e `evento_calendario`): o texto agora diz que o aviso de não escrever nome de pessoa fica na tela, não no modelo. Não há campo novo.
Queries verificadas: nenhuma query ou repository nova. As mudanças em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/grade/` e em `importacao/` são de texto e de tela:
- Aviso de sala e de descrição sem nome de pessoa.
- `MODELO_DE_CADA_TIPO` como fonte única dos nomes de arquivo.
- `textosDoErroDaLinha` para o `fim_antes_do_inicio` do calendário.

Nenhuma dessas mudanças envia `escolaId` pelo corpo ou pela query. O `anoLetivoId` continua sendo um filtro do cliente. O escopo pela escola segue no backend, a partir do token, como foi aprovado na 1ª rodada. O novo caso "o ano planejado que some da lista" mostra que, quando o ano sai da lista, a tela volta ao ano em curso e não fica num ano que a resposta do servidor já não traz.
Teste de isolamento: presente e efetivo. O da 1ª rodada não mudou. Esta rodada não muda nenhuma cláusula de escopo que exija teste novo. A mudança em `e2e/grade-e-calendario.spec.ts:193-240` só deixa mais confiável o caso da resposta atrasada da turma B (`rota.fetch` e `fulfill`, mais dois quadros antes de conferir).
Bloqueantes: nenhum. A 1ª rodada não exigiu correções.
Recomendações:
- O item do `TODO.md` que estende a pendência do RF16 à grade e ao calendário (os painéis gravam só no ano em curso) tem uma consequência para o isolamento. Se o Arquiteto liberar o envio de `anoLetivoId` pela prévia e pelo gravar, o repository do backend precisa conferir que esse ano é da escola do token. Também precisa de um caso de integração com o `anoLetivoId` de outra escola, que deve responder 404, nunca 403.
- Continua aberta a pendência da 13.0: o caso de backend em `apps/api/test/importacao-alunos.int.test.ts` em que um candidato a desligar da escola B não aparece na prévia da A.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-06 01:08:34 · `tasks/prd-onboarding-por-convite/14_task.md`

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
Recomendações: nenhuma nova. A recomendação da minha 1ª rodada (recarregar só as chaves `'grade'` e `'calendario'`, e não toda a estrutura, em `GradeECalendario.tsx` `recarregar`) segue registrada em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/TODO.md`, na linha 21 do diff. Continua sendo recomendação, não bloqueante.

Para quem for decidir, eis o que o diff da 2ª rodada (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/.processo/ordens/14_task-diff-r2.diff`) mudou:
- Textos de tela: o aviso de não escrever nome de pessoa na sala e na descrição, e o texto próprio do calendário para "fim antes do início".
- Uma prop opcional nova, `textosDoErroDaLinha`, que vai do `PlanilhaConfig` até o `textoDoErro`. Ela só troca o texto mostrado.
- O nome do modelo vem de uma fonte única, `MODELO_DE_CADA_TIPO`.
- Testes de unidade e de componente, mais o ajuste do e2e da resposta retida (`rota.fetch` e `fulfill`).

Nada disso cria request, leitura, polling, job, query, migration, estado de servidor ou chamada de IA, nem mexe na cadência de leitura da importação. Nenhum teste chama provedor pago.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-06 01:08:35 · `tasks/prd-onboarding-por-convite/14_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok

Portão local: carimbo válido. O `conferir` diz: "portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)".

Bloqueantes: nenhum.

As oito correções da ordem `.processo/ordens/14_task-r1.md` foram feitas.

1. **Aviso de não escrever nome de pessoa (privacy-guardian).** O aviso está em seis lugares: nas duas instruções, no vazio de cada painel, no vazio da grade e do calendário e na seção dos modelos.
   - Os textos ficam em `apps/web/src/areas/coordenacao/grade/textos-da-grade.ts`, nas constantes `AVISO_DA_SALA` e `AVISO_DA_DESCRICAO`.
   - O `docs/lgpd.md` diz agora "a tela pede".
   - Há testes de texto e de componente, e um bloco de mutação que esvazia os avisos.
   - A tabela "Recomendações sem aplicar" registra que o aviso vindo da 5.0 e da 12.0 foi atendido.
   - As fotos confirmam o aviso no computador e no celular, na escola cheia e na vazia (`coordenacao--coordenacao-grade--computador.png`, `coordenacao--coordenacao-grade--Importar-grade--computador.png`, `vazia--coordenacao--coordenacao-grade--computador.png`, `vazia--coordenacao--coordenacao-grade--Importar-grade--celular-1.png`).
2. **Espera da resposta atrasada no e2e (test-engineer).** Em `e2e/grade-e-calendario.spec.ts:196-217`, a resposta de B agora é buscada no servidor e entregue à página antes das asserções sobre A. O teste espera essa entrega e mais dois quadros de pintura. Também ganhou a asserção sobre a célula de A depois da espera, que a ordem dava como opcional. Se a tela já tiver cancelado o pedido, a entrega falha em silêncio, como deve. A palavra final sobre a eficácia desse teste é do test-engineer.
3. O nome do caso de Registros voltou para "as três abas".
4. O painel lê o nome do arquivo do modelo de `MODELO_DE_CADA_TIPO`.
5. O `Record` substituiu o `find` e o ramo que nunca rodava.
6. O calendário tem texto próprio para `fim_antes_do_inicio`, passado pela configuração `textosDoErroDaLinha`. Há casos de unidade e de componente.
7. O `?? anoEmCurso` ganhou caso de componente e bloco de mutação, e saiu da lista "sem bloco".
8. O item do RF16 no `TODO.md` agora cita também a grade e o calendário. As seis linhas novas da 14.0 entraram no `TODO.md`.

Recomendações:
- O destino da frase "convite para copiar" era "`15_task.md`, subtarefa 15.2, e `TODO.md` também", mas só o `TODO.md` recebeu a linha. O `15_task.md` não foi tocado. Um lembrete curto na 15.2 evita depender só do `TODO.md`.
- `e2e/grade-e-calendario.spec.ts:43` repete a função `gate()`, que já existe em `e2e/support/assistente.ts:95`. Vale importar a de `support` em vez de manter uma segunda cópia.
- A mensagem do commit ainda precisa dizer que o caso do aluno em `e2e/areas.spec.ts` foi dividido para caber no prazo do portão, como manda a tabela "Recomendações sem aplicar".

## test-engineer · 2ª rodada · APROVADO · 2026-11-06 01:08:39 · `tasks/prd-onboarding-por-convite/14_task.md`

VEREDITO: APROVADO

**Cenários exigidos (rodada 2):**
- a correção exigida da rodada 1: o e2e da resposta atrasada da turma B;
- as cláusulas novas do diff:
  - o aviso de não escrever nome de pessoa na sala e na descrição (regra 20, item 1);
  - o texto próprio do calendário para `fim_antes_do_inicio`, onde o evento de um dia só é válido (RF10);
  - o ano planejado que sai da lista volta ao ano em curso (RF16);
  - `MODELO_DE_CADA_TIPO` como fonte única do nome do arquivo baixado.

**Cobertos:**
- **Correção 1, feita.** Arquivo: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/grade-e-calendario.spec.ts:198-208` e `:234-240`.
  - A rota retida agora busca a resposta de B no servidor e a entrega à página depois que a porta abre (`rota.fetch()` e depois `rota.fulfill`). O `.catch` cobre o pedido que a tela já cancelou pelo `signal`.
  - Um segundo portão, `entregue`, só abre depois dessa entrega. O teste espera esse portão e mais dois quadros de pintura antes das três asserções sobre A.
  - Entrou também a asserção positiva sobre a célula de A (`Matemática${professora.nome}`).
  - Com isso, um bug em que a resposta de B toma o lugar de A já teria chegado à página quando as asserções rodam.
- **Recomendações da rodada 1, aplicadas.** O nome "as três abas" está em `molduras.test.tsx`. O `?? anoEmCurso` ganhou o caso "o ano escolhido sai da lista depois de uma gravação que lê os anos de novo" e um bloco de mutação. Tirar o `??` deixa `ano` indefinido, a tela não monta a tabela de 2026 e o caso fica vermelho pelo motivo certo.
- **Aviso de nome de pessoa.**
  - `textos-da-grade.test.ts` exige o aviso nas duas instruções, nos quatro textos de vazio e no texto dos modelos.
  - `GradeECalendario.test.tsx` confere o aviso na tela: na seção dos modelos, na instrução e no vazio de cada painel, no vazio da grade da turma e no vazio do calendário.
  - Os dois lados têm mutação: cada constante de texto e cada uso na tela (`descricao=""`, `<p>` vazio).
- **Erro de linha próprio do calendário.** Três níveis de teste:
  - unidade em `textoDoErro`: o texto próprio, o código que a planilha não troca e o código desconhecido;
  - componente genérico em `ImportarPlanilha.test.tsx`: o texto próprio e o geral na mesma prévia;
  - `it.each` da tela: a grade mantém "ou no mesmo horário" e o calendário usa o texto dele.
  
  As três ligações têm mutação: o `proprios?.[codigo]`, a prop passada adiante e o `textosDoErroDaLinha` da configuração.
- **`MODELO_DE_CADA_TIPO`.** O nome do arquivo baixado pelo painel tem prova na tela (`modelo-grade.csv` e `modelo-calendario.csv`), com mutação que troca um pelo outro. O `baixarModeloDoTipo` tem duas mutações (cabeçalho e nome) e a ordem dos quatro modelos tem uma.
- **Cláusulas novas contra a seção "Mutações".** Toda cláusula nova do diff tem bloco. O único "sem bloco" que restou é o `?? 'em-curso'` da chave de cache, com o motivo de mutação equivalente, que já tinha sido aceito.
- **Tabela de testes.** As três linhas novas citam testes que existem, pelo nome.
- **Rodei os 7 arquivos de teste do diff** (`grade/` inteira, `previa-da-planilha.test.ts`, `ImportarPlanilha.test.tsx`): 114 de 114 verdes. Nenhum `.skip`, nenhum teste comentado e nenhum mock que esconda a regra. Não há chamada de IA.

**Bloqueantes:** nenhum.

**Recomendações:**
- `e2e/grade-e-calendario.spec.ts:236`: esperar dois quadros resolve na prática, mas não é uma garantia formal. O TanStack Query avisa a tela por `setTimeout(0)`, e numa máquina carregada a pintura de B poderia cair depois de `toHaveCount(0)`, que passa logo na primeira tentativa. Uma prova sem depender de tempo seria um marcador lido na página, por exemplo esperar o cache da chave de B estar preenchido antes de afirmar sobre A. Não bloqueia: o teste agora espera de fato a entrega.
- `tasks/prd-onboarding-por-convite/14_task.md`, linha "A tela pede para não escrever nome de pessoa": cita o teste do painel da grade e não cita "o painel do calendário diz na instrução e no vazio...", que existe e é o que prova o lado da descrição na tela. Vale acrescentá-lo à linha.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-06 01:08:43 · `tasks/prd-onboarding-por-convite/14_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. O diff desta rodada só muda texto da tela e mensagens de erro da grade e do calendário, além de testes e do `docs/lgpd.md`. Nada aqui grava em `Nota` nem chega perto dela. Todos com autor humano? Não se aplica.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Não há saída de IA nesta tarefa. A importação é feita pela coordenação, com prévia e gravação confirmada por ela.
Supervisão do tutor: ok. Nada nesta tarefa toca o tutor.
Autonomia declarada e visível: sim, e nada mudou nesta tarefa. Nenhum agente foi criado ou alterado.
Bloqueantes: nenhum

O que conferi nesta rodada:
- **Correções exigidas:** a 1ª rodada não exigiu nenhuma, então não havia o que conferir.
- **O que mudou desde a 1ª rodada:**
  - A tela passou a pedir que ninguém escreva nome de pessoa na sala e na descrição. Os textos estão em `apps/web/src/areas/coordenacao/grade/textos-da-grade.ts:320-337`, com teste em `textos-da-grade.test.ts` e em `GradeECalendario.test.tsx`.
  - O calendário ganhou um texto próprio para o erro de fim antes do início (`textosDoErroDaLinha`, em `ImportarPlanilha.tsx:70` e `previa-da-planilha.ts:440`).
  - Os modelos de planilha agora saem de uma lista única, `MODELO_DE_CADA_TIPO`.
  - A tela volta ao ano em curso quando o ano planejado some da lista, com teste.
  - O e2e da troca de turma ficou mais estável.

  Nada disso cria campo, prompt ou tela de nota, conceito ou sugestão de nota (D55). Também não cria decisão sobre aluno, agente de IA, indicador ou ranking de professor (D45, D64), nem medição de comportamento (item 7).
- **Fotos:** olhei a escola cheia e a vazia, a seção, o painel "Importar grade", o computador e o celular. A tela só mostra a estrutura da escola: grade, calendário, modelos e importação. Não aparece nenhuma saída de IA sem marca, nenhuma nota ou sugestão de nota, e nada que induza uso ou dificulte sair. O botão de fechar o painel está à vista e "Sair" continua no menu. Nas fotos `coordenacao--coordenacao-grade--computador.png`, `coordenacao--coordenacao-grade--Importar-grade--computador.png`, `vazia--coordenacao--coordenacao-grade--computador.png` e `vazia--coordenacao--coordenacao-grade--Importar-grade--celular-1.png` (pasta `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/.processo/vitrine/`), o aviso sobre nome de pessoa aparece na instrução do painel, no vazio do painel, no vazio da grade e do calendário e na seção dos modelos, como o `docs/lgpd.md` agora diz.

Recomendações:
- Continua aberta a da 1ª rodada, registrada no `TODO.md`. A prévia da grade não diz quantos vínculos serão encerrados, e por isso o coordenador só fica sabendo depois de gravar que um professor perdeu a turma. Não é saída de IA, então não bloqueia pela regra 70, mas é uma decisão humana tomada sem tudo à vista. O Arquiteto decide se vira divergência de desenho.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-06 01:08:52 · `tasks/prd-onboarding-por-convite/14_task.md`

VEREDITO: APROVADO

A correção exigida na 1ª rodada foi feita nos quatro passos. Nesta rodada vi o diff desde a 1ª, as 12 fotos e rodei `textos-da-grade.test.ts` e `GradeECalendario.test.tsx`: 44 casos, todos verdes.

**Os quatro passos da correção:**
1. **Aviso na tela.** Há dois avisos, `AVISO_DA_SALA` e `AVISO_DA_DESCRICAO`, em `apps/web/src/areas/coordenacao/grade/textos-da-grade.ts:320-321`. Eles entram nas duas instruções (`:325`, `:328`), no vazio de cada painel (`:333-334`, ligados em `PaineisDeImportacao.tsx`), no vazio da grade (`:335`), no vazio do calendário (`:336`) e na seção dos modelos (`:337`). Esses três lugares são ligados em `GradeECalendario.tsx:162`, `:247` e `:292`.
   - Nas fotos o aviso aparece na seção dos modelos, na instrução e no vazio do painel, e no vazio da grade da escola vazia.
   - Arquivos: `coordenacao--coordenacao-grade--computador.png`, `coordenacao--coordenacao-grade--Importar-grade--computador.png`, `coordenacao--coordenacao-grade--Importar-grade--celular-1.png`, `vazia--coordenacao--coordenacao-grade--computador.png`, `vazia--coordenacao--coordenacao-grade--Importar-grade--computador.png`.
   - O vazio do calendário não aparece em nenhuma foto, porque `vazia--...--celular-2.png` está em branco. Ele é provado por `GradeECalendario.test.tsx`, no caso do calendário vazio.
2. **`docs/lgpd.md`.** As linhas "Aula da grade" e "Evento do calendário" agora dizem "a tela pede" e explicam que o modelo traz só o cabeçalho.
3. **Testes.** `textos-da-grade.test.ts` usa `toContain(AVISO_...)` nos sete textos, então tirar o aviso de qualquer um quebra o teste. `GradeECalendario.test.tsx` confere a frase literal na instrução e no vazio de cada painel, no vazio da grade, no vazio do calendário e na seção dos modelos.
4. **Registro na tarefa.** Está em "Recomendações sem aplicar" de `tasks/prd-onboarding-por-convite/14_task.md`, na linha do privacy-guardian (1ª) que vem da 5.0 e da 12.0.

**O resto do diff:** traz o texto de erro próprio do calendário (`ERROS_DA_LINHA_DO_CALENDARIO`, `textoDoErro(codigo, proprios)`), o `MODELO_DE_CADA_TIPO`, o ajuste de corrida no e2e e as linhas no `TODO.md`. Nada disso toca campo pessoal, log, DTO, autorização ou envio externo. O texto de erro devolve só o código ou uma frase fixa, nunca o valor da célula.

Campos pessoais tocados: nenhum novo. Só textos de tela sobre os campos livres `alocacao.sala` e `evento_calendario.descricao`, que já estão no mapa.
Fora da tabela de dados do docs/lgpd.md: nenhum.
Autorização por objeto: ok. O diff não muda rota nem leitura. Nas fotos a coordenação vê o nome do professor na grade e nunca o e-mail, como o mapa descreve.
Logs: limpos.
Auditoria: presente. O diff não cria ação nova que a exija.
Envio externo: nenhum.
Seed/fixture: sintético ("Colégio sintético da vitrine", "Professora Sintética Helena", "Coordenadora sintética").
Bloqueantes: nenhum.
Recomendações:
- O aviso só pede; nada no servidor impede que alguém escreva "Sala da Prof. Ana". Se um dia a escola pedir garantia mais forte, cabe um aviso na prévia quando a sala ou a descrição parecer nome de pessoa. Isso fica para uma tarefa de backend, não para esta.
- Na foto `coordenacao--coordenacao-grade--Importar-grade--celular-1.png`, o painel aparece cortado sobre o resto da página no print de página inteira. Isso é do `frontend-reviewer`; registro só porque vi.
