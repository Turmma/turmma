# Achados das revisões — `tasks/prd-onboarding-por-convite/16_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-06 04:52:42 · `tasks/prd-onboarding-por-convite/16_task.md`

VEREDITO: APROVADO
Tela vista: sim (14 fotos lidas, escola cheia e vazia: Turmas, Professores e Grade e calendário, no computador e no celular). O que a 16.0 mudou na tela é o teto de 100 desligamentos na prévia da importação. Nenhuma foto mostra esse estado, porque ele só aparece com mais de 100 pessoas a desligar. Revisei esse trecho pelo código e pelo teste de tela.
Estados: ok. Vazio, com dado, carregando e erro da importação já vinham da 13.0 a 15.0, e a 16.0 não os alterou. O vazio da grade e do calendário convida a "Baixar modelo" e diz o próximo passo, sem se desculpar. Não li o código de carregando e erro, porque a 16.0 não o tocou.
Acessibilidade:
- O grupo de desligamento usa `fieldset` com `legend`. Cada marca é uma `label` com `min-h-11`.
- Os checkboxes excedentes ficam `disabled`, e a tela diz por quê. O aviso do teto atingido e o resumo das marcas têm `aria-live="polite"`.
- Os 13 casos do e2e terminam em `conferirTela` (axe e sem rolagem horizontal).
Chromebook fraco: a lista da prévia continua paginada (`fatiaDaLista`, "Ver mais"). O teto de 100 por gravar foi medido na carga: o passo (3) fica abaixo de 0,75 s.
Celular: nas fotos de 360 px não há rolagem horizontal nem texto cortado. Os botões principais têm 44 px ou mais. As abas quebram em duas linhas e continuam legíveis. Os cartões de Turmas e Professores não perdem nada. O e2e roda também no projeto `celular`. A barra inferior que cobre parte do conteúdo nas fotos longas é artefato da captura de página inteira, porque o elemento é fixo. Nas fotos curtas (Professores) ela fica no rodapé, como deve. Os arquivos `celular-2` da grade são faixas em branco da própria captura.
Ação oficial protegida: sim. O desligamento continua começando desmarcado, "Marcar todos" também. O resumo diz o que as marcas vão fazer antes de "Gravar". O teto de 100 é aplicado no contrato (`packages/shared/src/importacao/contratos.ts`) e na tela.
Bloqueantes: nenhum.
Recomendações:
- `apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx:~503 e ~610`: os dois `<p aria-live>` usam `empty:hidden`, que é `display:none` enquanto estão vazios. Alguns leitores de tela não anunciam texto que sai de uma região oculta. O padrão já existe no repositório (`Turmas.tsx:174`) e atende o item do TODO. Se a validação ouvir com leitor de tela e o aviso do teto não for lido, troque por uma região sempre presente e visualmente neutra.
- Fotografar o estado do teto na validação, com mais de 100 candidatos, a 360 px e a 1366 px. Hoje só o teste de unidade e o de tela o cobrem.
- As fotos da escola "vazia" já têm uma turma e uma professora, porque o e2e semeou antes. O vazio de Turmas e de Professores, sem nenhum registro, só se vê pelo código.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-06 04:52:47 · `tasks/prd-onboarding-por-convite/16_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration nesta tarefa. As inserções diretas de teste e de carga (`lista_nome` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/importacao-alunos.int.test.ts:237`, e `vinculo` e `lista_nome` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/infra/scripts/carga-importacao.ts:470-482`) levam `escola_id` e `ano_letivo_id`.

Queries verificadas:
- Nenhum repository, service ou endpoint novo.
- A única mudança em código de produção é o contrato `marcasDaPlanilhaSchema.desligar`, que ganhou `.max(100)` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/shared/src/importacao/contratos.ts:114`. Ele não recebe `escolaId` e só estreita o que a API aceita.
- As leituras de apoio do e2e (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/support/planilhas.ts:131-177`) e da carga (`carga-importacao.ts:388`, `conferir-carga-importacao.ts:94`) filtram todas por `escola_id` (ou pelo slug da escola). São código de teste e não ficam expostas ao cliente.
- O e2e e o k6 chamam a API com o token da coordenação. Nenhum corpo nem query string leva `escolaId`.
- `@Unscoped()` não aparece.

Teste de isolamento: presente e efetivo dentro do que a tarefa toca. Ela não cria módulo, então a regra 10.5 não pede teste de tenant novo. O e2e prova o isolamento entre turmas: a aluna aprovada vê só a turma dela e não vê a colega (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/escola-por-planilha.spec.ts`, describe RF18 do aluno). Os testes de isolamento já existentes da importação continuam valendo, porque o escopo do repository não mudou.

Bloqueantes: nenhum

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/importacao-alunos.int.test.ts:252` lê `restantes` por `escola_id` e pelo prefixo do nome. Se a contagem filtrar também por `turma_id`, a prova fica presa à turma semeada e não depende do prefixo do nome.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-06 04:53:08 · `tasks/prd-onboarding-por-convite/16_task.md`

**VEREDITO: APROVADO**

```
VEREDITO: APROVADO
Caminho quente tocado: login | fila
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
1. Comentário desatualizado no topo do k6.
2. Transferência sem teto.
3. Virada medida com 900, mas o teto é 3.000.
4. Dois itens da 9.0 seguem abertos.
```

**Por que não há bloqueante.** Só um código de produção mudou: o teto `.max(MAXIMO_DE_DESLIGAMENTOS_POR_GRAVAR)` em `marcas.desligar`, em `packages/shared/src/importacao/contratos.ts:114`.
- A API confere o teto pelo `ZodValidationPipe` antes de criar a importação. O job lê de novo com o mesmo schema (`packages/core/src/importacao/motor.ts:200`).
- O schema ainda não está na `develop` nem na `main`. Por isso não existe job antigo na fila com mais de 100 marcas que passe a falhar.
- Duas gravações seguidas não se somam: com uma importação `na_fila`, a segunda recebe `CONFLITO`. Cada job fica no teto, e a medida deu até 0,75 s no passo (3).
- A tela não deixa marcar o que a API recusaria.
- O alerta do passo (3) já existia (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/infra/grafana/alertas/importacao-passo3-lento.yaml`) e tem parágrafo no runbook.
- O cenário de carga ficou atualizado. Os limites batem com os da Tech Spec e a medida passou: prévia com p95 de 319 ms, gravar com 196 ms, espera de trava de +4 ms e +6 ms, zero 503.
- O modo seco prova que o teto do cenário é o do contrato e que nada chama provedor pago.

**Recomendações**

1. **Comentário desatualizado.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/infra/k6/importacao-7h30.js:12-13`, o comentário ainda diz "quatro jobs… 100, 200 e 300 desligamentos". Hoje a fase tem três escolas e cinco jobs: 100, depois 3 × 100, depois a virada. O código faz isso; só o texto mente.
2. **Transferência sem teto.** O cenário mediu 300 transferências, mas a planilha aceita até 3.000. O passo (3) cresce com cada aluno transferido, porque a auditoria grava uma linha por vez com as turmas travadas (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/core/src/importacao/tipos/alunos.ts:416`, `:420`, `:427`). Às 10h, uma recomposição grande de turmas pode segurar o gerar acesso e a decisão daquela escola por alguns segundos. Fica dentro da própria escola e não atinge outra. Para a validação: medir 1.000 e 3.000 transferências, e se passar de 1 s, aplicar o mesmo teto ou gravar a auditoria em lote.
3. **Virada medida abaixo do teto.** A virada foi medida com 900 alunos, e a planilha aceita 3.000. O próprio runbook diz que, se a virada estourar, o remédio é comando em grupo, porque não há marca para limitar. O risco é baixo: a virada acontece em janeiro, fora do horário letivo. Vale medir 3.000 uma vez antes do pouso.
4. **Itens abertos da 9.0.** O `EXPLAIN` do `or()` com 500 pares em `vinculo_usuario_idx` e o teste de dois jobs de transferência iguais em paralelo (D49) continuam no `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/TODO.md`, apontados para a validação da spec.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-06 04:53:30 · `tasks/prd-onboarding-por-convite/16_task.md`

VEREDITO: APROVADO

A tarefa não cria campo pessoal novo, não grava dado novo de aluno e não envia nada para fora. O que ela acrescenta de regra é o teto de 100 desligamentos por gravar. O resto é e2e, o cenário de carga e documentação, tudo com dado sintético.

Campos pessoais tocados: nenhum novo. O teto de desligamentos só restringe `marcas.desligar`, que continua sendo uma lista de UUIDs (`packages/shared/src/importacao/contratos.ts:114`). O rótulo do candidato na tela ("nome (matrícula)" para aluno, só o nome para professor) já existia desde a 13.0 e a 15.0, e só a coordenação o vê.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. Nenhuma rota, repository ou query de produção nova. O e2e confere que a aluna aprovada não vê a colega da mesma turma, nem pelo nome nem pela matrícula (`e2e/escola-por-planilha.spec.ts:343-344`). Confere também que o professor com vínculo pendente não abre a turma, nem digitando o endereço.

Logs: limpos.
- `infra/scripts/carga-importacao.ts` escreve só nome de fase, contagens, p95 e o motivo de reprovação (linhas 539-541, 656-693).
- O `compose logs` que roda quando a carga falha (linha 683) mostra o log da API num ambiente só sintético, que é derrubado com os volumes no fim.
- Os textos novos da tela não levam pessoa: `AVISO_DO_TETO_DE_DESLIGAR` e `AVISO_DO_TETO_ATINGIDO`, em `previa-da-planilha.ts:526-529`.

Auditoria: presente. O caso novo em `apps/api/test/importacao-alunos.int.test.ts:255-260` lê `lista_nome.retirado` na auditoria e confirma que há uma linha por marcado, com o autor (a coordenação) e a hora. Isso liga "a sua escolha fica registrada" a um registro consultável e fecha o item do TODO que veio da 13.0.

Envio externo: nenhum. O cenário só chama a prévia, o gravar, a leitura da importação, o gerar acesso, o decidir e o login. Nenhum provedor de IA, e `infra/test/carga-importacao.test.ts` prova isso.

Seed/fixture: sintético.
- e2e: nomes do tipo "Ana Prof <marca>", e-mail em `@educa.invalid`, matrícula `E<marca>n` (`e2e/escola-por-planilha.spec.ts:72-80`, `e2e/support/planilhas.ts:31`).
- Carga: "Aluno N", "Pessoa sintética", matrículas C, D, V e P, senha gerada na hora com `randomBytes`, escolas e rede "sintéticas".
- Roteiro da demonstração: "Ana Demo" e `@demo.invalid`.
- Fotos: as seis telas mostram só "Colégio/Professora/Coordenadora sintética <hash>". Em Professores não aparece e-mail, nem na escola cheia nem na vazia (`coordenacao--coordenacao-professores--computador.png`, `vazia--coordenacao--coordenacao-professores--computador.png`).

Pergunta de fechamento: continua respondida. A tarefa não cria lugar novo onde dado de aluno fica guardado nem destino novo para onde ele vai, e o desligamento pela marca deixa rastro auditado por id.

Bloqueantes: nenhum.

Recomendações:
1. `infra/scripts/carga-importacao.ts:664-667` e `:583-584`, `:603-604`: a pasta da execução fica com 0777 e os arquivos com tokens e senha com 0644. Isso só é aceitável porque é tudo sintético e a pasta é apagada no `finally`, e o comentário diz isso. Vale uma guarda (por exemplo, recusar rodar sem `AMBIENTE=local` ou carga) para o padrão não ser copiado para um ambiente com dado real.
2. `e2e/support/planilhas.ts:122-178` faz `select` direto no banco de teste para conferir resultados. Dentro do e2e é aceitável, e só faz contagem e busca de id. Os helpers não devem passar a devolver nome ou matrícula.
3. Já está no TODO e não é desta tarefa: `lista.transferida`, gravado com `entidade: 'lista_nome'`, não entra no arquivo do titular que aprova o nome depois. O mesmo vale para `lista_nome.retirado`, agora que o desligamento por marca é auditado nessa entidade. Levar à retro junto com o item da 9.0.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/packages/shared/src/importacao/contratos.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/importacao-alunos.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/escola-por-planilha.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/support/planilhas.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/infra/scripts/carga-importacao.ts`

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-06 04:53:49 · `tasks/prd-onboarding-por-convite/16_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A 16.0 não grava `Nota` em nenhum caminho: o e2e, o k6, o driver de carga e o seed sintético ficam de fora dela. O que o driver grava direto no banco é `lista_nome`, `vinculo` e `conta.senha_hash` (`infra/scripts/carga-importacao.ts:470-483` e `:516-519`), só no ambiente de carga e com dado sintético. Todos com autor humano? sim, por não haver nenhum.

Decisão autônoma sobre aluno: ausente. O teto de desligamentos não decide nada sozinho:
- O contrato só limita o tamanho do pedido, com `marcas.desligar` em `.max(100)` (`packages/shared/src/importacao/contratos.ts:114`).
- Na tela, "Marcar os primeiros 100 para desligar" é um clique da coordenação, e o grupo continua desmarcado por padrão (`apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts:203-245`, `ImportarPlanilha.tsx:605-617`).
- O que passar de 100 fica para outra gravação, também com marca humana. Nada é desligado sem marca.
- O teste de integração `apps/api/test/importacao-alunos.int.test.ts › o desligamento tem teto por gravar` prova que 101 marcas são recusadas sem criar importação nem job. Com 100, só as marcadas saem, e a auditoria `lista_nome.retirado` registra a coordenação como autor e a hora. Isso fecha o item que o `TODO.md` trazia da 13.0 ("a sua escolha fica registrada").

Aprovação registrada: ok. A tarefa não tem saída de IA. A aprovação dos pedidos de nome no e2e e no k6 vem do professor, pela rota `POST /v1/reivindicacoes/decidir` com o token dele.

Supervisão do tutor: ok. A tarefa não toca no tutor.

Autonomia declarada e visível: sim. A tarefa não muda agente nem a declaração de autonomia.

Fotos: li as 16. Nenhuma mostra saída de IA, nota, conceito ou sugestão de nota. A aba Professores não tem métrica nem ranking de professor, nas versões cheia e vazia, no computador e no celular. A aba Turmas e a aba Grade e calendário são só estrutura. Também não há nada que induza uso nem que dificulte sair.

Bloqueantes: nenhum.

Recomendações:
- As fotos não mostram o estado que a tarefa muda: a prévia de alunos com mais de 100 pessoas a desligar, com o aviso do teto e o rótulo "Marcar os primeiros 100". Para a validação da spec, vale uma foto desse estado, sobretudo no celular, onde a coordenação precisa enxergar quem ficou marcado antes de gravar.
- "Marcar os primeiros 100" segue a ordem em que a API devolve a lista, e parte dos marcados fica em páginas que a tela ainda não abriu ("Ver mais"). O resumo perto de "Gravar planilha" diz quantos serão desligados, mas não quem. Uma frase como "os primeiros 100 da lista, abra para conferir" deixaria mais claro que a escolha é dela, na linha da recomendação da 10.0 e da 13.0 de que desligar é escolha da coordenação.
- Três fotos são uma faixa branca, sem conteúdo: `coordenacao--coordenacao-grade--celular-2.png` e `vazia--coordenacao--coordenacao-grade--celular-2.png` (as duas em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/.processo/vitrine/`) e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/.processo/vitrine/vazia--coordenacao--coordenacao-professores--celular.png`. O defeito é da vitrine e pertence ao `frontend-reviewer` ou à ferramenta, não à regra 70.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-06 04:54:09 · `tasks/prd-onboarding-por-convite/16_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido

Bloqueantes: nenhum

**Por que não há bloqueante:**
- **O teto de 100 desligamentos por gravar não é divergência calada.** A linha original da tabela de testes do `16_task.md` já autorizava "teto nas marcas ou comandos em grupo só se passar". A medida passou de 1 s com 200 e com 300 desligamentos num gravar. O teto está registrado na `techspec.md` §13, nos dois casos novos do `cenarios.md`, no `docs/runbook.md` e no `docs/interface.md`. Tem mutação declarada no contrato, na tela e na regra pura.
- **Os itens do `TODO.md` que a 16.0 fechou estão feitos.** A auditoria de quem desligou e quando aparece no caso de integração. O resumo das marcas ganhou `aria-live`. O roteiro saiu de "Lista colada".
- **O roteiro (16.4) confere com o spec.** Os passos 5, 7 e 9 de `docs/roteiro-da-demonstracao.md` batem com `e2e/roteiro-da-demonstracao.spec.ts:224-297`: "Arquivo da planilha (Excel ou CSV)", "Gravar lista", "Acrescentar turma", "Convidar alunos" e "Fechar sem copiar".
- **As fotos não mostram nada desta tarefa.** O aviso do teto só aparece com mais de 100 candidatos, e as fotos não têm esse caso. Também não há texto fora do glossário.

Recomendações:
1. **Autoconferência desatualizada.** `tasks/prd-onboarding-por-convite/16_task.md`, item 1 da Autoconferência, ainda diz que "a tarefa não toca `apps/*/src` nem `packages/*/src`" e que a seção Mutações traz `Sem mutação`. As duas coisas são falsas desde que o teto entrou. Corrigir o texto para a validação não ler errado.
2. **Live region com `empty:hidden`.** `apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx:502` e `:195`: a região `aria-live` some com `display:none` enquanto está vazia. A primeira mudança, ao marcar a primeira pessoa ou ao chegar ao teto, pode não ser anunciada, porque a região entra na árvore de acessibilidade junto com o texto. É justamente o anúncio que o item do `TODO.md` pedia. Deixar a região sempre presente, ou conferir no teste com leitor de tela, que ficou para a validação. Isso é da área do `frontend-reviewer` e do `conformidade-reviewer`.
3. **Comentário que promete mais que o teste.** `e2e/escola-por-planilha.spec.ts:265` diz que a turma não abre "nem pelo endereço", mas o caso só confere que o link não existe. Ou o caso tenta `/professor/turmas/<id>` antes de confirmar, ou o comentário sai. Isso é da área do `test-engineer`.
4. **Teto não descrito na tela de alunos.** O `docs/interface.md:513-514`, no parágrafo de "Importar alunos" (aba Turmas), não fala do teto. Só o parágrafo de Professores (`:503-505`) fala, e foi na planilha de alunos que a medida criou o teto (Tech Spec §9: "cada tela atualiza o `docs/interface.md`").
5. **"Marcar os primeiros 100" descarta marcas à mão.** No grupo com mais de 100 candidatos, a coordenação que marcou pessoas à mão e depois usa "Marcar os primeiros 100 para desligar" perde as marcas dela, trocadas pelas 100 primeiras, sem aviso (`previa-da-planilha.ts:336-342`). O rótulo é honesto, mas vale olhar na validação.
6. **Teto copiado no driver de carga.** `infra/scripts/carga-importacao.ts:77` repete o 100 em `DESLIGAMENTOS_POR_GRAVAR`. O motivo está escrito e o modo seco confere que é igual ao contrato. Fica registrado só para a retro.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/16_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/escola-por-planilha.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/docs/interface.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/infra/scripts/carga-importacao.ts

## test-engineer · 1ª rodada · REPROVADO · 2026-11-06 04:54:27 · `tasks/prd-onboarding-por-convite/16_task.md`

VEREDITO: REPROVADO

**Cenários exigidos** (pela tarefa 16.0 e pela seção E2E do `cenarios.md`):
- **Caminho feliz:** a escola vazia recebe as quatro planilhas, com a de alunos suja (aparece o erro, a coordenação corrige e grava). O professor aceita o convite copiado e confirma o vínculo que a grade criou. A aluna pede o nome pela matrícula, o professor aprova e ela entra.
- **Modelos:** o modelo baixado pela tela, preenchido, entra sem erro. Vale para os quatro tipos.
- **Bordas:** turma escrita de mais de um jeito, matrícula repetida na planilha, turma que não se lê ("Turma Azul"), duas alunas na mesma turma. Teto de 100 desligamentos por gravar: 101 recusado e 100 aceito, com auditoria; na tela, "marcar todos" para no teto, o restante fica travado e a tela diz por quê.
- **Permissão:** o professor com vínculo pendente não alcança a turma.
- **Isolamento:** a aluna aprovada vê só a turma dela, sem o colega.
- **Carga:** prévia e gravar com 3.000 linhas junto da rajada de login (p95 até 2 s). Transferências contra o gerar acesso e a decisão (zero 503, espera de trava abaixo de 300 ms, passo (3) abaixo de 1 s). 100 e 300 desligamentos e a virada (passo (3) abaixo de 1 s). Job de professores contra o login deles (zero 503). O cenário não chama provedor pago.

**Cobertos:**
- **Mutações:** todas as cláusulas novas de produção têm bloco, e cada bloco cai em asserção que pega a mutação. São `contratos.ts` (`.max`), `previa-da-planilha.ts` (`alternarMarca`, `tetoDeMarcas` nas duas direções, `todosMarcados` com `length > 0`, `alternarTodos`, `rotuloDoTodosDoGrupo`) e `ImportarPlanilha.tsx` (aviso, aviso de teto atingido, `disabled`).
- **Teto de desligamentos:** o teste de integração `importacao-alunos.int.test.ts:353` confere 101 recusado sem importação nem job. Com 100, o job desliga 100, o 101º continua na lista e a auditoria traz autor e data.
- **Testes de unidade, tela e cenário:** os de `contratos.test.ts`, `previa-da-planilha.test.ts`, `ImportarPlanilha.test.tsx` e `infra/test/carga-importacao.test.ts` passaram aqui: 81 nos três primeiros e 27 no último.
- **Veredito da carga:** o modo seco testa de verdade o veredito (300 ms, passo (3), fase ou conferência que não rodou), além das contas das planilhas e das rotas sem provedor pago.
- **e2e:** existem todos os casos citados na tabela, sem `.skip` nem `.only`.

**Bloqueantes:**

1. **"Vê só a turma dela" não tem como falhar.**
   - Onde: `e2e/escola-por-planilha.spec.ts:326-346`, com o seed em `:277-290`.
   - O que está errado: a escola do caso tem uma turma só (7º A). A colega está na mesma turma, ainda `livre`, e a tela "Eu" nunca listaria o nome dela. A parte "só a turma dela" da linha 45 da tabela e o "segundo dado" da Autoconferência 3 não exercitam nada. O W1 tem o dado que falta (`e2e/escola-montada.spec.ts:233-234`, `outraTurma`).
   - Correção exigida: em `escolaComSalaAberta`, gravar na mesma planilha de alunos uma segunda turma com um aluno (por exemplo `8º A;<nome>;<matrícula>`). Depois afirmar `not.toContainText('8º A')` e o nome e a matrícula desse aluno. Ou então tirar "só a turma dela" do nome do caso e da tabela.

2. **"Antes não alcança a turma" só confere a falta do link, e o comentário afirma o que o teste não faz.**
   - Onde: `e2e/escola-por-planilha.spec.ts:265-266`.
   - O que está errado: o comentário diz "a turma não abre (…), nem pelo endereço", e a linha 44 da tabela diz "antes disso não alcança a turma". O caso nunca abre `/professor/turmas/${turmaId}` antes de confirmar. Só confere que o link "Abrir a turma 8º A" não aparece, que é uma decisão da tela.
   - Correção exigida: antes de confirmar, abrir `/professor/turmas/${turmaId}` e afirmar o mesmo estado de turma inexistente, depois voltar a `/professor/turmas` e confirmar. Ou então tirar "nem pelo endereço" do comentário e reescrever a linha 44 como "a tela não oferece a turma", citando o teste de integração que prova a regra na API.

**Recomendações:**
- **Autoconferência 1 contradiz o documento.** Ela diz que a tarefa não toca `apps/*/src` nem `packages/*/src` e que a seção "Mutações" traz "Sem mutação". A tarefa altera `contratos.ts`, `previa-da-planilha.ts` e `ImportarPlanilha.tsx`, e a seção tem 11 blocos. Corrigir o texto.
- **Linha 46 da tabela.** Ela diz que "cada um termina em `conferirTela`", mas dois casos não terminam. O da planilha suja confere só o estado de erro, e o estado gravado fica sem axe. O da confirmação confere só antes de confirmar, e a turma aberta fica sem axe. Acrescentar a chamada no fim dos dois.
- **Nome do caso da planilha suja.** Ele diz "mostra o erro de cada linha", mas só confere a região "Linhas com erro (3)". Conferir o texto de pelo menos uma linha, a da turma ilegível. A turma aparece de dois jeitos ("8º A" e "8A"); um terceiro ("8a" ou "8º ano A") cobre o caso de domínio "turma escrita de três jeitos".
- **RF1, o modelo que "entra".** O caso para na prévia sem erro e no botão visível. Gravar ao menos em um dos tipos fecharia o "entra".
- **Modo seco, constantes e textos.**
  - Em `infra/test/carga-importacao.test.ts:180-182`, a conta `200 + 100` é feita com números escritos à mão e regex no código-fonte. Exportar `PROFESSORES_QUE_JA_EXISTEM` e `PROFESSORES_NOVOS_POR_VOLTA` e comparar as constantes.
  - Em `:134`, a conta 36 não prova "cada lote de uma professora só", que o comentário promete.
  - Os thresholds são conferidos por `toContain` no texto do k6. É o padrão do `carga-login`, mas contradiz a Autoconferência 5 ("nenhuma só sobre texto de arquivo").
- **Duas tentativas do mesmo job de transferência em paralelo (D49).** Seguem no `TODO.md` sem tarefa. Registrado, mas a validação da spec precisa fechar isso com um teste de barreira de verdade, com as duas tentativas em paralelo.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/16_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/escola-por-planilha.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/support/planilhas.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/infra/test/carga-importacao.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/infra/k6/importacao-7h30.js
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/importacao-alunos.int.test.ts

## infra-guardian · 2ª rodada · APROVADO · 2026-11-06 05:06:57 · `tasks/prd-onboarding-por-convite/16_task.md`

VEREDITO: APROVADO
Caminho quente tocado: fila (a importação enfileirada; nesta rodada só mudaram testes, docs e um comentário do k6, nenhum código de produção)
Rate limit: ok (não mudou desde a rodada 1)
Fila e prioridade: ok (não mudou desde a rodada 1)
Concorrência: protegida (não mudou desde a rodada 1)
Índice e paginação: ok (nenhuma query nova em produção)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (não mudou desde a rodada 1)
Bloqueantes: nenhum
Recomendações: nenhuma nova. As da rodada 1 já estão no `TODO.md`, entre elas medir 1.000 e 3.000 transferências e a virada de 3.000 antes do pouso.

A rodada 1 não exigiu nenhuma correção, então não havia nada a conferir nesse sentido. O que verifiquei no diff desta rodada:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/infra/k6/importacao-7h30.js:12-15`: o comentário novo bate com o que `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/infra/scripts/carga-importacao.ts` faz (linhas 77-79, 490-503 e 544). São cinco jobs em três escolas: 100 desligamentos num gravar só, 300 em três gravares de 100 e a virada de 900.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/importacao-alunos.int.test.ts:373-376`: o teste agora confere pelo id que o 101º candidato, o único sem marca, continua na turma, em vez de contar pelo nome. A query filtra por `escola_id` e `turma_id`, e o teste ficou mais forte.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/escola-por-planilha.spec.ts`: entraram três casos.
  - A turma escrita de três jeitos ("8º A", "8A" e "8a"), um dos casos que a regra 40 lista.
  - O modelo de alunos preenchido e gravado de ponta a ponta.
  - Uma segunda turma no seed, que a aluna não pode ver, e o endereço da turma com vínculo pendente, que responde como turma que não existe.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/docs/interface.md:514` descreve o teto de 100 desligamentos por gravar como foi auditado na rodada 1.

Nenhum desses testes chama provedor pago.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-06 05:07:16 · `tasks/prd-onboarding-por-convite/16_task.md`

VEREDITO: APROVADO
Tela vista: sim (14 fotos lidas, escola cheia e vazia). São as da rodada 1. Nenhum arquivo de `apps/web` mudou desde então. Entre elas, as duas `celular-2` da grade e a `vazia--…professores--celular.png` já saíram em branco na rodada 1 (a segunda `celular-2` entra nessa conta, não só a cheia). O hook lista a `vazia--…professores--celular.png` entre as 3 em branco, mas ela não está em branco nesta leitura: mostra a lista de professores inteira. O que se repete é a barra de navegação fixa sobre o conteúdo nas fotos de página inteira. As fotos em branco são artefato da captura, não defeito da tela.

Estados: ok. Carregando e erro não aparecem na vitrine e não mudaram nesta rodada. Os estados vazios convidam: "Baixar modelo" na grade e no calendário. A escola "vazia" da vitrine já tem uma turma e uma professora, por causa do e2e que semeou antes. O vazio sem registro só se confere pelo código, e isso já está registrado como recomendação.

Acessibilidade: sem mudança de código nesta rodada. Fica a pendência dos dois `aria-live` com `empty:hidden`, que já está no `TODO.md` para a validação.

Chromebook fraco: sem mudança. O diff desta rodada é só e2e, teste de integração, comentário do k6, docs e TODO.

Celular: as fotos a 360 px não mostram rolagem horizontal nem texto cortado. As ações principais ("Nova turma", "Cadastrar professor", "Baixar modelo") têm altura de toque de 44 px ou mais. A barra de abas quebra em duas linhas sem esconder nenhuma ação.

Ação oficial protegida: sim. O desligamento só vale pelas marcas que a coordenação escolhe. O teto de 100 por gravação está no texto, e o teste de integração confere o 101º por id (`apps/api/test/importacao-alunos.int.test.ts:373`). O texto novo de `docs/interface.md` bate com o do código: `AVISO_DO_TETO_DE_DESLIGAR`, `AVISO_DO_TETO_ATINGIDO` e o rótulo "Marcar os primeiros 100 para desligar" (`previa-da-planilha.ts:235-242`).

Bloqueantes: nenhum. Nenhuma correção era exigida na rodada 1.

Recomendações (já no `TODO.md` e na seção de revisões da tarefa; todas para a validação):
- Fotografar o estado do teto de desligamentos (mais de 100 a desligar, 360 px e 1366 px). A vitrine não tem escola com mais de 100 ausentes.
- Ouvir os `aria-live` com leitor de tela antes de trocar o `empty:hidden`.
- Decidir o comportamento de "Marcar os primeiros 100": ele segue a ordem da API e descarta as marcas feitas à mão no grupo com mais de 100.
- Na foto vazia, a escola já tem turma e professora. O estado sem nenhum registro só se vê pelo código.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-06 05:07:49 · `tasks/prd-onboarding-por-convite/16_task.md`

VEREDITO: APROVADO

**Tabelas verificadas:** nenhuma tabela nova nesta rodada. O diff desde a rodada 1 mexe só em teste de integração, e2e, comentário do k6, `docs/interface.md`, `TODO.md` e o documento da tarefa. Nenhum arquivo em `apps/*/src` ou `packages/*/src` mudou.

**Queries verificadas:**
- **Item 7 da ordem, feito.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/importacao-alunos.int.test.ts:374-376` a contagem de "restantes" agora filtra por `escola_id` e `turma_id`, não depende mais do prefixo do nome e exige que o 101º candidato (`ids[MAXIMO_DE_DESLIGAMENTOS_POR_GRAVAR]`) continue na turma. Se o desligamento passasse do teto ou pegasse o candidato errado, o teste falharia.
- **Pela URL, antes de confirmar.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/escola-por-planilha.spec.ts:117-119` o professor com vínculo pendente abre `/professor/turmas/${turmaId}` antes de confirmar. Recebe "Esta turma não está disponível", o mesmo texto genérico de `apps/web/src/areas/professor/turmas/acesso/acesso-da-turma.ts:116` que serve tanto para turma inexistente quanto para vínculo não confirmado, então a resposta não confirma que a turma existe (regra 10, itens 4 e 6).
- **Aluna aprovada.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/escola-por-planilha.spec.ts:146-147` e `:176-178` o cenário ganhou uma segunda turma (8º A, com um aluno). O teste afirma que a aluna aprovada não vê "8º A", nem o nome, nem a matrícula desse aluno. Agora o caso exercita "só a turma dela".

**Teste de isolamento:** presente e efetivo. É o teste entre escolas da rodada 1, que não mudou e segue aprovado. Os dois e2e novos e o teste de integração do teto falham se o escopo por turma ou o filtro de vínculo pendente forem removidos.

**Bloqueantes:** nenhum.

**Recomendações:**
- `tasks/prd-onboarding-por-convite/16_task.md`, item 3 da Autoconferência: o texto ainda diz "duas alunas na mesma turma". Desde esta rodada o cenário tem também uma terceira aluna em outra turma, e o texto deveria dizer isso.

## test-engineer · 2ª rodada · APROVADO · 2026-11-06 05:07:54 · `tasks/prd-onboarding-por-convite/16_task.md`

VEREDITO: APROVADO

Cenários exigidos: os mesmos da 1ª rodada. Nesta rodada conferi o diff e as duas correções exigidas:
1. "Vê só a turma dela": a aluna precisa ter uma segunda turma da mesma escola que não pode ver.
2. "Antes não alcança a turma": a turma tem que ser recusada também pelo endereço, e não só pela falta do link.

Cobertos:
- **Correção 1, feita.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/escola-por-planilha.spec.ts:299`, `escolaComSalaAberta` grava agora `8º A;<deOutraTurma>` na mesma planilha dos alunos. As linhas 360-362 afirmam que a página não mostra `'8º A'`, nem o nome nem a matrícula desse aluno. Houve um ganho que não estava pedido: o `toHaveCount(2)` dos rádios (linha 314) passou a provar de verdade que a lista da sala mostra só os nomes da turma do código. Se a lista não filtrasse por turma, ela teria 3 rádios e o teste quebraria. A contagem `{ aprovado: 1, livre: 2 }` (linha 337) foi ajustada e continua coerente.
- **Correção 2, feita.** As linhas 273-275 abrem `/professor/turmas/${turmaId}` com o vínculo ainda pendente e esperam "Esta turma não está disponível". Conferi a origem desse estado em `apps/web/src/areas/professor/turmas/Turma.tsx:68` e `acesso/acesso-da-turma.ts:118-119`: a tela só o mostra quando a API responde `NAO_ENCONTRADO`. Ela não esconde nada por conta própria, então o caso cai se a API passar a devolver a turma com o vínculo pendente. Depois o caso volta por "Voltar para Turmas" e confirma. O comentário agora diz o que o teste faz.
- **Recomendações aplicadas:**
  - A Autoconferência 1 foi corrigida.
  - O caso da confirmação ganhou `conferirTela` no fim (linha 286), e o da planilha suja também (linha 95 do diff).
  - O erro da turma ilegível é conferido pelo texto, que existe em `previa-da-planilha.ts`.
  - A turma aparece escrita de três jeitos ("8º A", "8A" e "8a"). O "8a" ser lido fica provado pela conta "4 linhas lidas · 3 com erro".
  - O modelo de alunos agora é gravado e vira `{ livre: 1 }`.
  - O caso do teto em `apps/api/test/importacao-alunos.int.test.ts:374-376` conta pela turma e pelo id do 101º candidato, e não depende mais do prefixo do nome.
  - `docs/interface.md` e o comentário do k6 foram corrigidos.
- **Mutações:** o diff desta rodada não traz cláusula nova de código de produção. Só mudaram testes, documentos e comentário, e nada em `apps/*/src` nem em `packages/*/src`.
- Não há `.skip`, teste comentado, mock da regra nem chamada a provedor pago.

Bloqueantes: nenhum.

Recomendações:
- A Autoconferência 3 do documento da tarefa (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/16_task.md:78`) ainda diz "duas alunas na mesma turma (a aprovada vê só a dela e não vê a colega)". O seed agora tem a segunda turma (8º A, com um aluno), e o texto deveria dizer isso para o Validador não ler um dado menor do que o que existe.
- O comentário de `e2e/escola-por-planilha.spec.ts:79` diz "e o da linha com a turma boa não a acusa", mas nada afirma isso diretamente. Hoje quem prova é a conta de erros: 3 erros em 4 linhas. Vale dizer isso no comentário, ou afirmar que a região de erros não contém o nome de `dani`.
- O caso da tela "Eu" (linhas 358-362) só falharia se essa tela passasse a listar colegas ou outras turmas. A regra de que a aluna não alcança dado de outra turma pela API continua provada só nos testes de integração, e não por este e2e. Isso é aceitável, porque é o que a correção pedia; fica registrado para a validação.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-06 05:07:55 · `tasks/prd-onboarding-por-convite/16_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. O teto de 100 desligamentos agora está na `techspec.md` (§ dos riscos) e no `cenarios.md` (linhas [C] e [I]). A linha removida da tabela de recomendações, "comandos em grupo", continua registrada na Tech Spec.
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

Bloqueantes: nenhum. As duas correções exigidas foram feitas:
- **Bloqueante 1, "vê só a turma dela".** `escolaComSalaAberta` grava agora uma segunda turma, `8º A`, com um aluno, e o caso afirma que nem `8º A` nem o nome e a matrícula desse aluno aparecem na tela. Se o escopo sumir, o teste falha.
- **Bloqueante 2, "antes não alcança a turma".** Antes de confirmar, o caso abre `/professor/turmas/${turmaId}` pelo endereço e afirma o estado indisponível (o texto existe em `apps/web/src/areas/professor/turmas/acesso/acesso-da-turma.ts:116`). Depois volta por "Voltar para Turmas" (`Turma.tsx:80`). O comentário agora corresponde ao que o teste faz.

As recomendações 3 a 9 também foram aplicadas: Autoconferência 1, `conferirTela` no fim dos dois casos, texto do erro com a turma escrita de três jeitos, gravação no caso do modelo de alunos, contagem pela turma e pelo id no teste de integração, teto no parágrafo "Importar alunos" do `docs/interface.md` e comentário do k6. Os itens que ficaram sem aplicar estão no `TODO.md` e na tabela do documento.

Nada mudou em `apps/web` desde a rodada 1, então as fotos e o que conferi nelas continuam valendo.

Recomendações:
- `e2e/escola-por-planilha.spec.ts`, caso da planilha suja: o comentário "e o da linha com a turma boa não a acusa" não tem asserção direta. Hoje quem prova é a contagem `4 linhas lidas · 3 com erro`. Vale afirmar isso ou tirar a frase. Ainda no mesmo caso, o comentário da planilha corrigida cita só "8º A" e "8A" como a mesma turma, e falta o "8a".
- `tasks/prd-onboarding-por-convite/16_task.md`, Autoconferência 3: ainda descreve o seed como "duas alunas na mesma turma". Falta dizer que agora há uma segunda turma, com um aluno que a aprovada não pode ver.

Arquivos auditados nesta rodada:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/escola-por-planilha.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/importacao-alunos.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/16_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/docs/interface.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/infra/k6/importacao-7h30.js
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/TODO.md

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-06 05:08:05 · `tasks/prd-onboarding-por-convite/16_task.md`

VEREDITO: APROVADO

Esta rodada auditou só o diff desde a 1ª, que foi aprovada sem correção exigida da minha parte. Nada mudou em `apps/*/src` nem em `packages/*/src`. Mudaram só e2e, um teste de integração, um comentário do k6, documentos e o `TODO.md`. Revi duas das fotos (Professores e Turmas, escola cheia, no computador) e estão iguais às da 1ª rodada. Professores, turmas e coordenadora aparecem como "Sintético/Sintética" com sufixo aleatório. A tela não mostra e-mail de professor nem nome ou matrícula de aluno.

Campos pessoais tocados: nenhum campo novo. O e2e passou de três para quatro alunos sintéticos (`Aluno N <marca>`, matrícula `E<marca>N`) e ganhou um aluno de outra turma, `8º A`.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok, e agora com prova melhor.
- `e2e/escola-por-planilha.spec.ts`: o professor com vínculo pendente abre `/professor/turmas/${turmaId}` direto pelo endereço e recebe "Esta turma não está disponível para você agora". É a mesma frase genérica de `apps/web/src/areas/professor/turmas/acesso/acesso-da-turma.ts:116`, que não diz se a turma existe. Portanto "não encontrado" e "sem permissão" continuam iguais.
- A aluna aprovada não vê `8º A` nem o nome ou a matrícula do aluno da outra turma. Antes a escola do caso tinha uma turma só e essa parte não provava nada; agora prova.

Logs: limpos. Nenhum log foi acrescentado.

Auditoria: presente. O caso do teto em `apps/api/test/importacao-alunos.int.test.ts:373-376` agora conta os alunos que ficam pelo `id` e por `turma_id`, não pelo prefixo do nome. A prova da auditoria `lista_nome.retirado` (autor e data) não mudou.

Envio externo: nenhum nesta rodada.

Seed/fixture: sintético.

Bloqueantes: nenhum.

Recomendações:
- Já estava no `TODO.md` e na tabela "Recomendações sem aplicar": `lista.transferida` e `lista_nome.retirado` ainda não entram no arquivo do titular. Isso toca a pergunta de fechamento (tudo o que o sistema guarda sobre um aluno). Precisa ser resolvido antes do pouso da spec, não só lembrado na retro.
- Também já anotado: a pasta da execução da carga fica com 0777. Uma guarda que recuse rodar fora do `AMBIENTE` de carga continua desejável, mesmo com dado sintético.
- Sem efeito sobre a regra 20: no `16_task.md`, a linha "Comando em grupo no `desativar` e no `vinculo.criado`" saiu da tabela "Recomendações sem aplicar" sem destino novo. Vale o revisor-geral conferir se ela foi perdida.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/.processo/ordens/16_task-diff-r2.diff
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/escola-por-planilha.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/importacao-alunos.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/web/src/areas/professor/turmas/acesso/acesso-da-turma.ts

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-06 05:08:25 · `tasks/prd-onboarding-por-convite/16_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta rodada. O diff mexe em um teste de integração, no e2e, num comentário do k6, em `docs/interface.md`, no `TODO.md` e no `16_task.md`. Nenhum desses arquivos grava em `Nota`. Todos com autor humano? sim, porque não há caminho novo.

Decisão autônoma sobre aluno: ausente. O teto de 100 desligamentos continua sendo uma ação da coordenação, que marca quem desliga. O teste de integração ficou mais forte: agora prova pelo id que o 101º candidato, que ninguém marcou, continua na turma, sem depender do nome (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/apps/api/test/importacao-alunos.int.test.ts:373-376`). A auditoria `lista_nome.retirado`, que guarda o autor e a data, continua sendo conferida na linha 379.

Aprovação registrada: ok. Esta rodada não traz saída de IA. A aprovação da aluna pelo professor (D4) continua no e2e, e o caso "vê só a turma dela" agora prova isso com uma segunda turma (8º A), conforme a correção 1 da ordem.

Supervisão do tutor: ok, porque o diff não toca no tutor.

Autonomia declarada e visível: sim, sem mudança desde a rodada 1.

Bloqueantes: nenhum.

O que conferi nesta rodada:
- Comparei o diff com a árvore de trabalho. Os hashes de `e2e/escola-por-planilha.spec.ts` e de `infra/k6/importacao-7h30.js` são os do lado novo do diff. Nada em `apps/web` nem em `packages/` mudou desde a rodada 1, então as fotos da rodada 1, que aprovei, continuam valendo. Não as reli.
- Minhas duas recomendações da rodada 1 foram tratadas:
  - O comportamento de "Marcar os primeiros 100" e a foto do estado do teto foram para o `TODO.md` (linhas novas da 16.0), para a validação.
  - As três fotos em branco foram recusadas com o motivo dado pelo frontend-reviewer (artefato da captura de página inteira). Aceito o motivo.
- O texto novo de `docs/interface.md:514` está de acordo com a regra 70. Ele mantém "só muda quem a coordenação marca". Nada é marcado sozinho além do botão que a própria coordenação aciona. Os candidatos acima de 100 ficam sem marca, e é preciso enviar a planilha de novo.

Recomendações:
- A linha "(medida da 16.0) Comando em grupo no `desativar` e no `vinculo.criado`" saiu da tabela "Recomendações sem aplicar" do `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/prd-onboarding-por-convite/16_task.md` e não foi para o `TODO.md` nem para a Tech Spec. Isso não é da regra 70, mas o registro se perdeu. Vale devolver a linha à tabela ou mandá-la para o `TODO.md`.
- Seguem as recomendações já registradas para a validação: fotografar o estado do teto a 360 px e a 1366 px, e decidir a ordem e o descarte das marcas no "Marcar os primeiros 100".
