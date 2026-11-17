# Índice dos achados das revisões

Uma linha por rodada que exigiu alguma coisa. O texto inteiro está no arquivo do documento, nesta
pasta (`<documento>.md`), no bloco com o mesmo fim. Escrito pelo hook `tools/processo/revisoes.ts`.
Não edite à mão.

Leia este índice antes de codar, e abra só os blocos que interessam à tarefa de agora.

| Fim | Revisor | Rodada | Veredito | Documento | O que exigiu |
|---|---|---|---|---|---|
| 2026-11-17 08:57:38 | `frontend-reviewer` | 1ª | AJUSTES NECESSÁRIOS | `revisao-spec` | Seção 9, em referência a `cenarios.md` (ausente em `tasks/prd-classificacao-bncc/`): os textos, os testes e as ordens de concorrência apontam para um arquivo… |
| 2026-11-17 08:57:53 | `llm-integrator` | 1ª | AJUSTES NECESSÁRIOS | `revisao-spec` | `techspec.md` §10 e cabeçalho, `cenarios.md` ausente. |
| 2026-11-17 08:58:19 | `pedagogia-reviewer` | 1ª | AJUSTES NECESSÁRIOS | `revisao-spec` | §7b, critério de qualidade que não prova o efeito no diagnóstico. Exigido: |
| 2026-11-17 08:58:51 | `tenancy-guardian` | 1ª | REPROVADO | `revisao-spec` | Tech Spec §3 e §5 ("Seções" e "Classificação"): a execução nasce sem ano letivo definido. |
| 2026-11-17 08:59:28 | `privacy-guardian` | 1ª | REPROVADO | `revisao-spec` | §3 (FK de corrigida_por "on delete set null") somada à §5 (concluir com "corrigida_por is null"; reclassificar "cada seção não corrigida") e à §7c ("corrigida… |
| 2026-11-17 09:01:00 | `revisor-geral` | 1ª | REPROVADO | `revisao-spec` | §3 e §5 "Classificação": a execução da rotina não tem ano letivo, mas a tabela de execuções exige um. |
| 2026-11-17 09:01:01 | `conformidade-reviewer` | 1ª | REPROVADO | `revisao-spec` | §7b, "suspensível": falta dizer o que a suspensão faz com as classificações que a IA já fez. A spec diz só que a suspensão é conferida antes do modelo (§5) e… |
| 2026-11-17 09:02:34 | `infra-guardian` | 1ª | REPROVADO | `revisao-spec` | §5 "Classificação", §7c "Limite por escola" e §7c "Quando cada dependência cai": o job de lote herda a degradação do Tutor. |
| 2026-11-17 09:03:12 | `test-engineer` | 1ª | REPROVADO | `revisao-spec` | A seção sem execução (`execucao_id` nulo) não tem estado nem saída. Ela nasce na migration 2 e no material de disciplina sem componente. A Tech Spec também não… |
| 2026-11-17 09:58:46 | `frontend-reviewer` | 2ª | APROVADO | `revisao-spec` | `cenarios.md`, "Telas": o vazio do Painel ("Nenhum capítulo classificado ainda") diz o que acontece, mas não o próximo passo. Sugestão: "Nenhum capítulo… |
| 2026-11-17 09:59:11 | `pedagogia-reviewer` | 2ª | APROVADO | `revisao-spec` | §7b, lote conferido pelo professor. O professor confere o lote depois da medida (a medida vem antes da troca do catálogo). Se ele alterar `referencia` ou… |
| 2026-11-17 09:59:20 | `privacy-guardian` | 2ª | APROVADO | `revisao-spec` | §5 "Seções" (linha 82): a edição nova herda corrigida_por junto com corrigida_em. Com isso, o arquivo do titular atribui ao coordenador a correção de uma seção… |
| 2026-11-17 09:59:45 | `conformidade-reviewer` | 2ª | APROVADO | `revisao-spec` | cenarios.md, "Correção e reclassificação": somar dois casos com a função suspensa, o comando D76 recusado e a cobertura sem as habilidades com origem 'ia'.… |
| 2026-11-17 09:59:48 | `llm-integrator` | 2ª | AJUSTES NECESSÁRIOS | `revisao-spec` | Techspec §5, "Agendar" (linha 84-86), contra `cenarios.md`, "Seções e agendamento" (linha 30) e §7c, "Estados da seção" (linha 191). |
| 2026-11-17 09:59:51 | `tenancy-guardian` | 2ª | REPROVADO | `revisao-spec` | `tasks/prd-classificacao-bncc/techspec.md:64` e `tasks/prd-classificacao-bncc/cenarios.md:97-103`. A correção trouxe uma entrada nova vinda do cliente na… |
| 2026-11-17 10:00:20 | `revisor-geral` | 2ª | REPROVADO | `revisao-spec` | novos |
| 2026-11-17 10:01:36 | `infra-guardian` | 2ª | REPROVADO | `revisao-spec` | `techspec.md:96-98` (§5, "Degradação do lote") e `cenarios.md:52`: o texto diz que "a janela fechada às 5h o segura até a noite seguinte". Isso não existe no… |
| 2026-11-17 10:02:22 | `test-engineer` | 2ª | REPROVADO | `revisao-spec` | A §5, "Agendar" (`techspec.md:84-86`), agenda de novo o que já foi classificado e não reclassifica o que mudou de recorte. O texto diz "seções não corrigidas e… |
| 2026-11-17 10:05:30 | `llm-integrator` | 3ª | AJUSTES NECESSÁRIOS | `revisao-spec` | techspec.md §5 "Degradação do lote" (linha 105), §7c "Estados da seção" (linha 194) e cenarios.md linha 33. O teto de "três noites seguidas" não tem onde viver… |
| 2026-11-17 10:05:55 | `tenancy-guardian` | 3ª | APROVADO | `revisao-spec` | `cenarios.md:30`: o teste da rotina das 19h só tem a escola A. Falta um cenário com uma seção `nao_agendada` da B: o job da A agenda só as da A e não toca a da… |
| 2026-11-17 10:06:13 | `revisor-geral` | 3ª | REPROVADO | `revisao-spec` | `techspec.md` §5 "Agendar" (linha 86), §5 "Degradação do lote" (linhas 104–105), §3 (linhas 28–31) e §7c "Estados" (linha 194). |
| 2026-11-17 10:07:14 | `infra-guardian` | 3ª | REPROVADO | `revisao-spec` | `tasks/prd-classificacao-bncc/techspec.md:104-105` (§5, "Degradação do lote") e `techspec.md:194` (§7c, estados), com o teste em… |
| 2026-11-17 10:07:34 | `test-engineer` | 3ª | REPROVADO | `revisao-spec` | Techspec §4 e §5 "Agendar" (b); `cenarios.md`, "Seções e agendamento", cenário "Mudança de recorte". A correção abriu um caminho que não está definido nem… |
| 2026-11-17 10:09:17 | `llm-integrator` | 4ª | APROVADO | `revisao-spec` | §5 "Classificação" e "Degradação do lote": uma saída inválida derruba a execução de 12 seções inteira, e todas somam 1. Uma seção "venenosa" leva as 11… |
| 2026-11-17 10:10:02 | `infra-guardian` | 4ª | APROVADO | `revisao-spec` | §5 "Degradação do lote": escrever que a soma de `falhas_seguidas` fica na mesma transação da passagem `rodando → falhou` e só acontece quando o `update`… |
| 2026-11-17 10:10:10 | `revisor-geral` | 4ª | APROVADO | `revisao-spec` | §3, linha 29. Escrever `falhas_seguidas smallint not null default 0`. Se a coluna aceitar nulo, `null < 3` sai nulo e a rotina deixa de pegar a seção sem… |
| 2026-11-17 10:10:23 | `test-engineer` | 4ª | REPROVADO | `revisao-spec` | O componente apagado continua com caminhos sem efeito definido (`techspec.md:84-90`, §5 "Agendar"; `:94-96`, "Classificação"; `:114-115`, "Suspensão";… |
| 2026-11-17 10:14:17 | `test-engineer` | 5ª | REPROVADO | `revisao-spec` | cenarios.md:184, P10a. Uma das mutações listadas não tem cenário que a mate. |
| 2026-11-17 10:16:38 | `test-engineer` | 6ª | APROVADO | `revisao-spec` | P10a, texto da linha (`cenarios.md:186`). A coluna "Ordem forçada" diz "`concluir` parado depois do `for update`", e a coluna "Perdedor" diz "o `concluir` já… |
| 2026-11-17 12:31:43 | `tenancy-guardian` | 1ª | APROVADO | `1_task` | `packages/core/src/db/schema/habilidade-bncc.ts`: a chave é `codigo` (texto), não UUID. Para tabela pública de referência isso se justifica, porque o código é… |
| 2026-11-17 12:32:04 | `infra-guardian` | 1ª | APROVADO | `1_task` | `packages/shared/src/estrutura/disciplina.ts`: `disciplinaSchema` é `.strict()` e ganhou `componenteBncc`. Uma aba da coordenação que ainda tenha o bundle… |
| 2026-11-17 12:32:05 | `frontend-reviewer` | 1ª | APROVADO | `1_task` | `apps/web/src/areas/coordenacao/comum/pecas-da-lista.tsx:11-16`, visto em `.processo/vitrine/coordenacao--coordenacao-estrutura--Disciplinas--computador.png`. |
| 2026-11-17 12:32:36 | `conformidade-reviewer` | 1ª | APROVADO | `1_task` | Na escola cheia e na vazia, as fotos mostram "Física" e "Química" com "Sem componente" (`vazia--coordenacao--coordenacao-estrutura--Disciplinas--computador.png`… |
| 2026-11-17 12:32:42 | `privacy-guardian` | 1ª | APROVADO | `1_task` | Quando a 6.0 criar o job que refaz a classificação do material a partir de `disciplina.componente_alterado`, auditar de novo: aí sim pode haver envio de… |
| 2026-11-17 12:33:22 | `revisor-geral` | 1ª | APROVADO | `1_task` | Foto da escola cheia sem o estado "com componente". Nas fotos, a disciplina "Química" aparece com "Sem componente". A causa é a vitrine, que insere direto no… |
| 2026-11-17 12:33:35 | `test-engineer` | 1ª | REPROVADO | `1_task` | "`PATCH` segurado com troca de disciplina" está na tabela (linha 59 do `1_task.md`) e não tem teste. |
| 2026-11-17 13:13:52 | `tenancy-guardian` | 2ª | APROVADO | `1_task` | nenhuma nova. As da rodada 1 viraram linhas no `TODO.md` ou estão justificadas na tabela "Recomendações sem aplicar" do `1_task.md`. |
| 2026-11-17 13:14:10 | `frontend-reviewer` | 2ª | APROVADO | `1_task` | `AnoEDisciplinas.tsx` (linha da disciplina, foto cheia a 1366 px): com o componente definido, os três botões empilham ao lado do nome, que fica com uns 100 px… |
| 2026-11-17 13:14:11 | `infra-guardian` | 2ª | APROVADO | `1_task` | A recomendação da 1ª rodada de usar `NOT VALID` e depois `VALIDATE` foi recusada, e o motivo serve hoje, porque a tabela tem só dezenas de linhas por escola.… |
| 2026-11-17 13:14:55 | `privacy-guardian` | 2ª | APROVADO | `1_task` | A linha do `TODO.md` sobre `tools/vitrine/foto.ts` reaproveitar `sessao-<papel>.json` depois de `montar` merece prioridade. Uma sessão velha tira a foto de… |
| 2026-11-17 13:15:03 | `revisor-geral` | 2ª | APROVADO | `1_task` | `tasks/prd-classificacao-bncc/1_task.md`, seção "Recomendações sem aplicar": a frase "As cinco primeiras viraram linha no `TODO.md`" não bate com a tabela. As… |
| 2026-11-17 13:15:11 | `test-engineer` | 2ª | APROVADO | `1_task` | O teste novo não confere que o aviso da Y não aparece e que o campo da Y não muda depois da resposta da X. Hoje isso é coberto de forma indireta, porque o… |
| 2026-11-17 13:15:14 | `conformidade-reviewer` | 2ª | APROVADO | `1_task` | O texto do diálogo diz "Sem componente, o material não é classificado" (`apps/web/src/areas/coordenacao/estrutura/AnoEDisciplinas.tsx` e `docs/interface.md`).… |
| 2026-11-17 14:27:32 | `tenancy-guardian` | 1ª | APROVADO | `2_task` | `packages/core/src/material/extracao.repository.ts`, no fim de `herdarClassificacao`: a função devolve `pares.length`, e não o número de linhas que o `update`… |
| 2026-11-17 14:27:50 | `conformidade-reviewer` | 1ª | APROVADO | `2_task` | A herança põe na edição nova habilidades com `origem: 'coordenacao'` (`packages/core/src/material/extracao.repository.ts:152`) e `corrigida_em`, em conteúdo… |
| 2026-11-17 14:28:05 | `privacy-guardian` | 1ª | APROVADO | `2_task` | O teste `migracao-f4b.int.test.ts:301` apaga o usuário direto com `delete from usuario`. Seria bom ter um caso que passe pelo `CicloDeVidaService.eliminar` (o… |
| 2026-11-17 14:28:36 | `revisor-geral` | 1ª | REPROVADO | `2_task` | Duas divergências estão na `techspec.md` e faltam no `cenarios.md`. Arquivos: `tasks/prd-classificacao-bncc/2_task.md:105-106` e… |
| 2026-11-17 14:29:04 | `infra-guardian` | 1ª | REPROVADO | `2_task` | `packages/core/drizzle/0061_secao_do_material_backfill.sql:13-40`, junto com `docs/runbook.md` (falta uma seção depois da linha 1111). |
| 2026-11-17 14:29:55 | `test-engineer` | 1ª | APROVADO | `2_task` | `packages/core/src/titular/leitura-do-titular.ts:432`: o termo `t.escola_id = ${escolaId}` está na mesma linha mutada pelo bloco de `corrigida_por`, mas nenhum… |
| 2026-11-17 15:11:46 | `privacy-guardian` | 2ª | APROVADO | `2_task` | O cenário do `0061` e da volta da 2.0 continua em aberto no `TODO.md`: o material que ficar `pronto` pelo código anterior fica sem seção até alguém rodar o… |
| 2026-11-17 15:12:07 | `conformidade-reviewer` | 2ª | APROVADO | `2_task` | Quando a 7.0 mostrar a classificação, ela precisa distinguir a seção que a coordenação corrigiu da que a rotina herdou pelo mesmo número e título. Hoje as duas… |
| 2026-11-17 15:12:27 | `revisor-geral` | 2ª | APROVADO | `2_task` | `cenarios.md:77-78`: o `[I]` da volta do código é o único entre os novos sem "Mutação". Vale acrescentar uma, por exemplo tirar o `not exists` da seção que já… |
| 2026-11-17 15:12:30 | `infra-guardian` | 2ª | APROVADO | `2_task` | `docs/runbook.md:115-130`: abrir o bloco com `SET LOCAL lock_timeout = '5s';`, como faz a `0061`. Ele lê `material` e `capitulo_do_material` com `FOR KEY… |
| 2026-11-17 15:12:42 | `test-engineer` | 2ª | APROVADO | `2_task` | Metade do bloco do runbook fica sem prova. Em `packages/core/src/db/volta-da-2-0.int.test.ts:237-238`, os materiais `excluido` e `processando` nascem sem… |
| 2026-11-17 16:22:36 | `infra-guardian` | 1ª | APROVADO | `3_task` | Separar o `VALIDATE` em outra migration antes do piloto. Em `packages/core/drizzle/0062_execucao_classificacao.sql`, o `VALIDATE` de `consumo_ia` e de… |
| 2026-11-17 16:22:39 | `privacy-guardian` | 1ª | APROVADO | `3_task` | 4.0: gravar só ids no registro de consumo. Hoje o gateway grava a entrada inteira em `consumo_ia.entrada` quando `levaTextoLivreDePessoa` é `false`. Na… |
| 2026-11-17 16:22:44 | `conformidade-reviewer` | 1ª | REPROVADO | `3_task` | A AIA e `docs/agentes.md` descrevem a autonomia de outro jeito que o código (regra 70, itens 5 e 6a). |
| 2026-11-17 16:22:45 | `llm-integrator` | 1ª | APROVADO | `3_task` | Estimativa de custo desatualizada. `techspec.md:209` e o `TODO.md` corrigiram a vazão para ~31 mil tokens, mas a linha de custo continua de ~12 mil. Reescrever… |
| 2026-11-17 16:22:57 | `pedagogia-reviewer` | 1ª | APROVADO | `3_task` | `tools/ia/medir-classificacao.ts:217-221` e `:229-233`: a categoria `injecao` entra em `porCategoria` duas vezes, uma como acerto de referência e outra como… |
| 2026-11-17 16:23:10 | `tenancy-guardian` | 1ª | APROVADO | `3_task` | O comentário em `packages/core/src/db/schema/execucao-agente.ts:21-23` e o da `0062` dizem que o que a classificação grava aponta para a execução por… |
| 2026-11-17 16:23:18 | `test-engineer` | 1ª | REPROVADO | `3_task` | `tools/ia/medir-classificacao.test.ts:303-308`: o piso de 80 % dos códigos aceitáveis não está provado. |
| 2026-11-17 16:24:15 | `revisor-geral` | 1ª | REPROVADO | `3_task` | `docs/agentes.md:79`: a linha nova abre com "Faz e avisa; a coordenação corrige, e a correção vence." No próprio `docs/agentes.md` (linhas 17-22) e em… |
| 2026-11-17 18:51:44 | `privacy-guardian` | 2ª | APROVADO | `3_task` | Na tarefa 4.0, o `consumo_ia` tem de gravar só ids e a saída, sem o texto do material, como a Tech Spec §7 pede. Hoje ele grava a entrada inteira. A pendência… |
| 2026-11-17 18:51:59 | `conformidade-reviewer` | 2ª | APROVADO | `3_task` | O pedagogia-reviewer apontou que `EFEITO_COMUM_DA_SUSPENSAO` fala em "o que está esperando o professor", o que não existe na classificação. Quando a frase for… |
| 2026-11-17 18:51:59 | `infra-guardian` | 2ª | APROVADO | `3_task` | `TODO.md:9`: os `VALIDATE` da `0062` sobre `consumo_ia` e `execucao_agente` precisam ir para uma migration à parte antes do staging ou do piloto. Já está… |
| 2026-11-17 18:52:06 | `llm-integrator` | 2ª | APROVADO | `3_task` | Abrir o `4_task.md` cobrando o que a 1ª rodada já deixou registrado: gravar só ids no `consumo_ia` quando `levaTextoLivreDePessoa` é `false`, a fila `lote` na… |
| 2026-11-17 18:52:16 | `pedagogia-reviewer` | 2ª | APROVADO | `3_task` | `EFEITO_COMUM_DA_SUSPENSAO` fala em "o que está esperando o professor", que não existe na classificação. Já está registrado, com dono, na tabela de… |
| 2026-11-17 18:52:21 | `tenancy-guardian` | 2ª | APROVADO | `3_task` | as da 1ª rodada continuam valendo e já estão no `3_task.md` com destino. |
| 2026-11-17 18:52:45 | `revisor-geral` | 2ª | APROVADO | `3_task` | `tasks/prd-classificacao-bncc/3_task.md:143`: o cabeçalho diz "109 blocos", mas a frase seguinte ainda diz "As 106 mutações abaixo foram corridas". Acertar a… |
| 2026-11-17 18:52:48 | `test-engineer` | 2ª | APROVADO | `3_task` | `tasks/prd-classificacao-bncc/3_task.md:144`: a linha diz "109 blocos", mas a frase seguinte continua com "As 106 mutações abaixo foram corridas". Acertar para… |
