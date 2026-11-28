# Achados das revisões — `tasks/correcoes/2026-11-28-e2e-decima-segunda-fatia.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-28 06:59:24 · `tasks/correcoes/2026-11-28-e2e-decima-segunda-fatia.md`

VEREDITO: APROVADO

A correção só acrescenta uma fatia ao e2e, de 11 para 12. Ela não mexe em nenhum dado de pessoa, rota, log, storage, exportação ou envio externo.

Campos pessoais tocados: nenhum. O diff staged se resume a isto:
- três trocas de `/11` para `/12` e da matriz de 11 para 12 itens em `.github/workflows/ci.yml`;
- `FATIAS_DO_E2E` com o 12 em `tools/processo/esteira.ts:162`;
- texto no `README.md` e em `docs/runbook.md` ("Esteira vermelha no e2e");
- o documento da correção.

Fora da tabela de dados do docs/lgpd.md: nada. Não há campo novo, migration nem schema.

Autorização por objeto: não se aplica. Nenhuma rota, repository ou query foi tocada.

Logs: limpos. Nenhum log foi acrescentado ou alterado.

Auditoria: não se aplica. A correção não cria leitura de dado de aluno, exportação, alteração de nota, de permissão ou aprovação de saída de IA.

Envio externo: nenhum. Os artefatos do job continuam como estavam, um `traco-do-e2e-<i>` e um censo por fatia, agora 12 em vez de 11. O conteúdo deles não muda e vem de um compose de teste que sobe com banco vazio. O que vai para o artefato do Actions no repositório público é o mesmo que já ia.

Seed/fixture: sintético. A correção não toca seed nem fixture. Os arquivos da 12.0 em `e2e/support/` ficam fora desta revisão, como diz o documento.

Bloqueantes: nenhum.

Recomendações:
- `docs/runbook.md:2173` diz "os 20 do e2e da 12.0 ... (10 casos nos dois projetos)". Dá para ler como 10 no total. Fica mais claro com "10 casos em cada um dos dois projetos". É só texto e não tem efeito de privacidade.
- Confirmei com grep que não sobrou `/11` nem "onze fatias" nos quatro arquivos, fora a menção histórica de propósito em `docs/runbook.md:2173`.
- Para a revisão da 12.0, quando ela vier: os casos novos de `e2e/aluno-prova.spec.ts` passam a gerar traço e contexto de erro no artefato quando uma fatia falha. Vale conferir ali que os helpers de `e2e/support/` só criam aluno e resposta sintéticos.

Pergunta de fechamento: a correção não muda o que o sistema guarda sobre um aluno nem para onde isso é enviado. A resposta continua a mesma de antes, pelo `arquivo-do-titular`.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-28 06:59:28 · `tasks/correcoes/2026-11-28-e2e-decima-segunda-fatia.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta correção. O diff só muda `.github/workflows/ci.yml`, `tools/processo/esteira.ts`, `README.md`, `docs/runbook.md` e o documento da correção, e nenhum desses arquivos grava `Nota`. Todos com autor humano? Sim, porque nenhum caminho foi criado nem alterado.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok, nenhum fluxo de saída de IA foi tocado
Supervisão do tutor: ok, nada do tutor foi tocado
Autonomia declarada e visível: sim, sem alteração (governança e agentes ficaram fora do diff)
Bloqueantes: nenhum

O que conferi:
- A correção só aumenta o número de fatias do e2e de 11 para 12. A mudança está nos quatro lugares que a correção lista: a matriz, o `name` do job e o `--shard` em `.github/workflows/ci.yml`, e `FATIAS_DO_E2E` em `tools/processo/esteira.ts`. O runbook e o README foram ajustados para "doze" e `/12`.
- O `timeout-minutes` não mudou, as constantes do prazo do e2e também não, e o `fail-fast` continua desligado. Nenhum teste de regra foi afrouxado. Isso importa para a regra 40, porque a regra 70 se apoia nos testes do e2e para ser provada.
- As contas do runbook batem: 2176 casos em 11 fatias dá 198 por fatia, e em 12 dá 182. Doze fatias com no máximo 197 casos cabem 2364, ou seja, 188 a mais que os 2176 de hoje.
- Fotos da tela: o prompt não trouxe nenhuma, e a correção não mexe em tela.
- `docs/regulacao.md` não foi alterado. As menções a Nota, tutor e regulação que a busca encontrou no README e no runbook estão em linhas antigas, fora do diff.

Recomendações:
- Os 33 arquivos da tarefa 12.0 em curso (`ProvaEmFoco`, `AntesDeComecar`, `fila-de-saidas`, `e2e/aluno-prova.spec.ts` e os outros) mexem em prova online e na contagem de saídas da aba (D70, regra 70 item 7). Não entraram nesta revisão, como a tarefa pediu, mas precisam passar por auditoria própria da regra 70 quando a 12.0 for revisada. Pontos a ver: a contagem presa àquela avaliação e nunca somada por aluno, o aviso ao aluno antes da prova, e nenhuma consequência automática.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-28 06:59:28 · `tasks/correcoes/2026-11-28-e2e-decima-segunda-fatia.md`

VEREDITO: APROVADO

Escopo: respeitado. A correção mexe só no que o documento pede, nos quatro lugares em que o total de fatias está escrito: a matriz, o `name` e o `--shard` em `.github/workflows/ci.yml`, e `FATIAS_DO_E2E` em `tools/processo/esteira.ts`. Além deles, o texto do `README.md` e do `docs/runbook.md`. O `timeout-minutes`, o `fail-fast`, o artefato por fatia e as constantes de `tools/ci/prazo-do-e2e.ts` continuam como estavam. Os arquivos da 12.0 que aparecem na árvore não entram na correção.

Aderência à Tech Spec: ok. O remédio é o que o runbook manda, acrescentar uma fatia, e segue o precedente `2026-11-12-e2e-fatia-acima-do-teto`.

Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)").

Bloqueantes: nenhum.

As contas do runbook batem com `minutosEstimadosDoE2e`, que arredonda para cima:
- Em onze fatias, 196 casos dão uns 27 min e 198 dão uns 28.
- Em doze, 182 casos dão uns 26 min.
- O teto em doze fatias é 197 × 12 = 2364 casos, 188 acima dos 2176 de hoje.

Não sobrou nenhum `/11` nem "onze fatias" em código, workflow, README ou runbook.

Recomendações:
- `TODO.md:1866`, item (e), ainda diz "onze fatias", "teto de 2167 casos" e "uns 190 de margem sobre os 1974". Não é código nem guarda, mas o número ficou velho. Na correção anterior esse mesmo ajuste ficou em "Sem aplicar" e não foi feito. Atualize para doze fatias e 2364 casos, ou leve isso ao relatório ao Orquestrador.
- A primeira mutação, a da matriz, só fica vermelha pelo teto com o spec da 12.0 na árvore. O documento já avisa isso. Vale repetir o aviso no relatório para quem refizer as mutações depois do commit isolado.
- Ideia para a retro, já registrada no estado da F4: tirar o `/N` do `name` e do `--shard` de `strategy.job-total`. Com isso o total ficaria em dois lugares em vez de quatro.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-28 06:59:50 · `tasks/correcoes/2026-11-28-e2e-decima-segunda-fatia.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum (só a esteira de CI: matriz do e2e, `FATIAS_DO_E2E`, runbook e README)
Rate limit: ok (não se aplica, a correção não mexe em rota)
Fila e prioridade: ok (não se aplica)
Concorrência: protegida (não se aplica)
Índice e paginação: ok (não se aplica)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok. O alerta "e2e perto do teto" continua apontando para o runbook "Esteira vermelha no e2e", que foi atualizado para `/12`. O teto continua 45 min. `FRACAO_DE_FOLGA_DO_E2E`, `MINUTOS_FIXOS_DO_E2E` e `SEGUNDOS_POR_CASO_DO_E2E` não mudaram.
Bloqueantes: nenhum
Recomendações:
- `docs/runbook.md:2173`: a frase "os 20 do e2e da 12.0 (10 casos nos dois projetos)" pode ser lida como 10 no total. Melhor escrever "10 casos em cada um dos dois projetos", como está no documento da correção.
- Os três avisos da seção "Correção" do documento precisam chegar ao Orquestrador junto com o relatório. São eles: o escopo `workflow` no token do gh, a lista de verificações obrigatórias da proteção de branch (`e2e 1/12` a `12/12`) e o censo "incompleto" até a primeira execução verde com doze fatias. O primeiro e o segundo ficam fora do repositório e podem deixar o merge preso sem nenhum vermelho no código.

O que conferi:
- O total de fatias está trocado de 11 para 12 nos quatro lugares: a matriz, o `name` do job e o `--shard` em `.github/workflows/ci.yml`, e `FATIAS_DO_E2E` em `tools/processo/esteira.ts:162`. Em `.github/`, `tools/`, `README.md` e no runbook não sobrou nenhum `/11` fora das fixtures; as menções a "onze" que restam no runbook são o histórico das fatias.
- As contas do runbook batem com `minutosEstimadosDoE2e`. Com 182 casos por fatia a estimativa é 26 min, com 197 é 27 min (no limite) e com 198 é 28 min. Em doze fatias cabem 2364 casos, 188 a mais que os 2176 de hoje.
- `npx vitest run tools/ci/esteira.test.ts`, rodado com a árvore da 12.0: 25 de 25 testes passaram, inclusive "o teto do e2e cobre a suíte que existe".

## test-engineer · 1ª rodada · APROVADO · 2026-11-28 07:00:15 · `tasks/correcoes/2026-11-28-e2e-decima-segunda-fatia.md`

VEREDITO: APROVADO

**Cenários exigidos**

Esta correção só mexe na esteira. Os cenários do domínio escolar (transferência, mesmo nome, virada de ano), de permissão e de isolamento entre escolas não se aplicam: a correção não toca `apps/` nem `packages/`. O que precisa estar provado:
1. Com a suíte que existe hoje (2176 casos com a 12.0), nenhuma fatia passa de 60% do teto de 45 min, ou seja, 27 min.
2. A matriz, o `--shard=<i>/N` do passo, o `/N` do `name` do job e `FATIAS_DO_E2E` dizem o mesmo total.
3. O que não devia mudar continua igual: `fail-fast: false`, um artefato de traço e um de censo por fatia, e o prefixo do nome que o censo procura vale para toda fatia, inclusive a 12.
4. O censo lê as mesmas fatias que a matriz.

**Cobertos**
- Rodei `npx vitest run tools/ci/esteira.test.ts`: 25 de 25 verdes.
- Conferi os quatro blocos de mutação contra o `git diff --cached` e contra o código do teste. Cada um ficaria vermelho pelo motivo certo:
  - **Matriz voltando a 11:** `tools/ci/esteira.test.ts:515-538`. Com o `e2e/aluno-prova.spec.ts` na árvore, uma fatia de onze tem 198 casos, uns 28 min, acima de 27. Cai em `toBeLessThanOrEqual(limite)`, como o bloco declara. O documento avisa que, com a correção commitada sozinha, esse bloco não fica vermelho (196 casos ficam no limite). Nesse estado a matriz continua protegida pelos outros três blocos, que pegam a diferença contra o `/12`.
  - **`--shard` voltando a `/11`:** `esteira.test.ts:352-355`. O teste monta o comando esperado com o tamanho da matriz, que é 12, então o `toEqual` falha.
  - **`name` voltando a `/11`:** `esteira.test.ts:365`. O `toContain('${{ matrix.fatia }}/12')` falha.
  - **`FATIAS_DO_E2E` voltando a 11:** `esteira.test.ts:493`. O `toEqual(fatiasDoE2e())` falha.
- Contas do runbook (4 min fixos mais 7 s por caso, arredondado para cima):
  - 196 casos dão uns 27 min, 198 dão 28 e 182 dão 26.
  - O limite é 197 por fatia: 197 × 12 = 2364 casos, 188 a mais que 2176.
  - Bate com o texto em `docs/runbook.md:2172-2176`.
- Não há `.skip`, teste comentado, mock nem chamada a provedor de IA. A operação não tem concorrência a provar.
- Não existe tabela de testes a conferir linha a linha. O documento declara que não há teste novo: o teste da regra já existe, e a correção muda o que ele lê. Isso está certo para esta correção.

**Bloqueantes:** nenhum.

**Recomendações**
1. `TODO.md:1866`, item (e), ficou desatualizado. Ainda diz "são onze fatias", teto de 2167 casos e "o ponto em que a 12ª fatia passa a ser pedida". Deve passar a dizer doze fatias, teto de 2364 casos e margem de 188 sobre 2176. A correção anterior (`2026-11-12`) já deixou o mesmo resto no `TODO.md`. Não bloqueia porque nenhum teste nem guarda lê essa linha.
2. Continua de pé o que a retro anterior registrou: o total está escrito à mão em quatro lugares, e daria para tirar o `/N` do `name` e do `--shard` de `strategy.job-total`. Isso deixaria um lugar só para errar. Fica para a retro, não para esta correção.
3. Os avisos para o relatório estão corretos (escopo `workflow` do token, proteção de branch, censo incompleto até a primeira execução verde com doze fatias). Pelo registro de 13/11 em `tasks/prd-ingestao-do-material/estado.md:5`, `develop`, `release` e `main` não têm proteção de branch. Portanto o aviso de trocar `e2e N/11` na proteção provavelmente não se aplica, e vale dizer isso ao Orquestrador.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-28 07:23:31 · `tasks/correcoes/2026-11-28-e2e-decima-segunda-fatia.md`

```
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
Recomendações: nenhuma nova. Na 1ª rodada não exigi correção nenhuma. As recomendações ainda abertas estão em
tasks/correcoes/2026-11-28-e2e-decima-segunda-fatia.md,
na seção "Recomendações sem aplicar", cada uma com destino (TODO.md item (e), retro, relatório ao Orquestrador,
revisão da 12.0). Concordo com esses destinos.
```

Conferi o patch da 2ª rodada e o que está em stage nos cinco arquivos da correção:

- **`docs/runbook.md`:** a única mudança é a frase, que agora diz "10 casos em cada um dos dois projetos". Ela confere com "os 20 do e2e da 12.0" na mesma linha.
- **`.github/workflows/ci.yml`, `README.md` e `tools/processo/esteira.ts`:** não mudaram desde a 1ª rodada e continuam batendo entre si. O total 12 aparece igual na matriz `fatia`, no `name`, no `--shard=<i>/12`, na linha do README e em `FATIAS_DO_E2E`.
- **Documento da tarefa:** ganhou só as seções "Recomendações sem aplicar" e "Revisões". A tabela de "Revisões" é escrita pelo hook. Fora isso, o documento não toca em código.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-28 07:23:33 · `tasks/correcoes/2026-11-28-e2e-decima-segunda-fatia.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. Desde a 1ª rodada mudaram só dois documentos: uma frase de contagem de casos em `docs/runbook.md` e duas seções de processo na tarefa de correção, a tabela de recomendações e a de revisões escrita pelo hook.
Fora da tabela de dados do docs/lgpd.md: nenhum campo novo
Autorização por objeto: ok. Nenhuma rota, repository ou query foi tocada.
Logs: limpos. Nenhum código de log mudou.
Auditoria: presente. Nenhuma ação que a regra 20 item 10 cobre foi tocada.
Envio externo: nenhum
Seed/fixture: sintético. Nesta correção não entrou seed nem fixture.
Bloqueantes: nenhum
Recomendações:
- A recomendação da 1ª rodada continua valendo e já está na seção "Recomendações sem aplicar" de `tasks/correcoes/2026-11-28-e2e-decima-segunda-fatia.md`. Ela vai para a revisão da 12.0. Quando essa rodada for pedida, o privacy-guardian precisa auditar estes arquivos:
  - `e2e/support/atividade-db.ts` e `e2e/support/aluno-api.ts`, para confirmar que a fixture é sintética.
  - `apps/web/src/api/atividades-do-aluno.ts`, para conferir o DTO e o escopo.
  - `apps/web/src/areas/aluno/fila-de-saidas.ts`, para garantir que a contagem de saídas da aba fica presa àquela avaliação e nunca é somada por aluno (D70).

Conferência do pedido desta rodada: a 1ª rodada não exigiu correções. A recomendação aplicada, "10 casos em cada um dos dois projetos" no runbook, conferi no patch `.processo/ordens/2026-11-28-e2e-decima-segunda-fatia-diff-r2.patch`. `.github/workflows/ci.yml`, `README.md` e `tools/processo/esteira.ts` não mudaram desde a rodada aprovada, então não auditei de novo. A pergunta de fechamento não muda com esta correção, porque ela não cria, guarda nem envia dado de titular.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-28 07:23:34 · `tasks/correcoes/2026-11-28-e2e-decima-segunda-fatia.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum
Recomendações:
- Não há recomendação nova nesta rodada. As pendentes da 1ª rodada estão na tabela "Recomendações sem aplicar" de `tasks/correcoes/2026-11-28-e2e-decima-segunda-fatia.md`, cada uma com destino. São três: o item (e) do `TODO.md:1866`, que ainda fala em onze fatias, o `/N` de `strategy.job-total` e os avisos ao Orquestrador.

Sobre o diff desta rodada: a única mudança de conteúdo é a frase em `docs/runbook.md:2173`, que agora diz "10 casos em cada um dos dois projetos". A frase bate com os 20 casos somados à suíte (2156 + 20 = 2176). Era a recomendação da 1ª rodada, e foi aplicada. As duas seções novas do documento da correção só registram o que já foi decidido e não mexem em código. Os arquivos `ci.yml`, `README.md` e `esteira.ts` não mudaram desde a rodada aprovada.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-28 07:23:37 · `tasks/correcoes/2026-11-28-e2e-decima-segunda-fatia.md`

VEREDITO: APROVADO
Tabelas verificadas: nenhuma. A correção não cria migration nem schema.
Queries verificadas: nenhuma. Esta rodada mudou só uma frase de `docs/runbook.md` (linha 2173) e duas seções de `tasks/correcoes/2026-11-28-e2e-decima-segunda-fatia.md`. Os arquivos `ci.yml`, `README.md` e `tools/processo/esteira.ts` não mudaram desde a 1ª rodada, que foi aprovada.
Teste de isolamento: não se aplica. Não há repository, endpoint nem tabela nova.
Bloqueantes: nenhum. A 1ª rodada não exigiu correção de isolamento.
Recomendações: a ressalva da 1ª rodada continua valendo. Os 33 arquivos da 12.0 não foram auditados aqui, em especial `e2e/support/atividade-db.ts`, `e2e/support/aluno-api.ts` e `apps/web/src/api/atividades-do-aluno.ts`. Eles precisam de rodada própria do tenancy-guardian, que deve conferir o escopo por escola e se as fixtures são sintéticas.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-28 07:23:42 · `tasks/correcoes/2026-11-28-e2e-decima-segunda-fatia.md`

VEREDITO: APROVADO
Caminhos de escrita em Nota: nenhum nesta correção — todos com autor humano? sim (não há caminho novo)
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok (nenhum fluxo de saída de IA é tocado)
Supervisão do tutor: ok (não é tocada)
Autonomia declarada e visível: sim (não é tocada)
Bloqueantes: nenhum
Recomendações:
- Fica a recomendação da minha 1ª rodada, já registrada na seção "Recomendações sem aplicar" de `tasks/correcoes/2026-11-28-e2e-decima-segunda-fatia.md`. Quando a 12.0 for revisada, a regra 70 item 7 e a D70 precisam ser auditadas nos 33 arquivos dela, principalmente `apps/web/src/areas/aluno/fila-de-saidas.ts`, `apps/web/src/areas/aluno/ProvaEmFoco.tsx`, `apps/web/src/areas/aluno/AntesDeComecar.tsx` e `e2e/aluno-prova.spec.ts`. Nessa auditoria, confirmar três coisas:
  - a contagem de saídas da aba vale só para aquela avaliação e nunca é somada por aluno;
  - o aluno é avisado antes da prova;
  - nenhuma consequência acontece sozinha por causa da contagem.

Nesta rodada li o patch `.processo/ordens/2026-11-28-e2e-decima-segunda-fatia-diff-r2.patch`. Ele muda só duas coisas:
- **`docs/runbook.md:2173`:** a frase passou a "10 casos em cada um dos dois projetos". É texto de operação da esteira e não diz respeito à regra 70.
- **O documento da correção:** ganhou as seções "Recomendações sem aplicar" e "Revisões". A tabela de revisões é preenchida pelo hook, e a recomendação desta auditoria está ali com o destino certo, que é a revisão da 12.0.

`.github/workflows/ci.yml`, `README.md` e `tools/processo/esteira.ts` não mudaram desde a 1ª rodada, que foi aprovada. A rodada anterior não pediu nenhuma correção, então não havia nada a conferir.

## test-engineer · 2ª rodada · APROVADO · 2026-11-28 07:23:48 · `tasks/correcoes/2026-11-28-e2e-decima-segunda-fatia.md`

VEREDITO: APROVADO

**Cenários exigidos:** os mesmos da 1ª rodada. A matriz do e2e passa a ter doze fatias. Os quatro lugares que guardam o total (`ci.yml`, `README.md`, `docs/runbook.md` e `FATIAS_DO_E2E` em `tools/processo/esteira.ts`) andam juntos. O teto por fatia é provado pela mutação que volta a matriz para onze.

**Cobertos:** na 1ª rodada todos foram cobertos e o resultado foi APROVADO. Nesta rodada mudaram só dois textos:
- **`docs/runbook.md:2173`:** a frase agora diz "10 casos em cada um dos dois projetos", que é a recomendação aplicada. A conta bate: 20 casos do e2e da 12.0, 10 por projeto, e 2156 + 20 = 2176. Nenhum teste nem guarda lê essa frase: procurei "dois projetos" em `tools/` e `infra/test/`, e o que aparece são nomes de teste sem relação com ela.
- **`tasks/correcoes/2026-11-28-e2e-decima-segunda-fatia.md`:** entraram a seção "Recomendações sem aplicar", em que cada item tem destino, e a seção "Revisões", escrita pelo hook. Não mexe em código nem em teste.

`ci.yml`, `README.md` e `esteira.ts` não mudaram desde a 1ª rodada. Por isso o bloco de mutação e os testes que aprovei lá continuam valendo e não os rodei de novo.

**Bloqueantes:** nenhum.

**Recomendações:**
- O `TODO.md:1866`, item (e), ainda diz "onze fatias", "2167" e "190 sobre 1974". Deve passar a dizer doze fatias, 2364 casos e 188 sobre 2176. O documento já manda isso ao Orquestrador. Repito aqui só para não se perder.
- Ao pedir a revisão da 12.0, inclua os pontos da tabela que vão para ela: o escopo e a fixture sintética em `e2e/support/atividade-db.ts`, `e2e/support/aluno-api.ts` e `apps/web/src/api/atividades-do-aluno.ts`, e a D70, que pede contagem de saídas presa à avaliação, nunca somada por aluno, com aviso antes da prova e sem consequência automática.
