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
