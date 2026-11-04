# Correção — o encontro da linha 2 (tarefa 6.0, 993c673) deu conflito em três arquivos de exports com spec/onboarding-por-convite (5.0)

**Origem:** encontro da linha 2 (`tools/processo/linhas.ts`), tarefa 6.0: o merge de `spec/onboarding-por-convite` (a067ca7, com a 5.0) na branch da linha parou em conflito.
**Subagentes obrigatórios:** `revisor-geral`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- O revisor-geral veio no PEDIDO do Orquestrador: o merge traz 49 arquivos fora de `tasks/` e mexe em `tools/` e `infra/`, acima do limite do passo 5 de `corrigir`. Os quatro guardiões vêm dos caminhos que o merge leva (apps/, packages/, infra/), como o portão lista; a Mesa devolveu a rodada 1 por falta deles. O test-engineer é de toda correção. -->

## Nota

O slug do pedido era `encontro-6`, mas `tasks/correcoes/encontro-6.md` já existe, de outra spec (o encontro da linha 2 da
`telas-do-professor`, resolvido em `b90c204`), e `encontro-6-harness.md` também. Reescrever aquele arquivo apagaria a causa e as
revisões daquela correção; por isso este documento e a marca do commit usam `encontro-6-onboarding`, como a correção
`encontro-6-harness` já fez.

## Sintoma

`git merge spec/onboarding-por-convite` na linha 2 traz a 5.0 (calendário pela API, job em três passos, alertas da importação) e
os arquivos que ela mexeu. Quase tudo junta sozinho; três não:
`CONFLITO (conteúdo)` em `packages/core/src/importacao/index.ts`, `packages/core/src/index.ts` e `packages/shared/src/index.ts`.

## Fora desta correção

Nada: o pedido veio sem arquivos da tarefa em curso, e a árvore estava limpa antes do merge.

## Causa

As duas tarefas acrescentaram exports no mesmo ponto de um arquivo de barril (`index.ts`):

- `core/importacao/index.ts`: a 6.0 acrescentou `ContaDaPlanilhaPerdidaError` e `DiferencaNaPlanilhaError`; a 5.0 acrescentou o tipo
  `ImportacaoLida` na mesma linha do `export type`.
- `core/index.ts`: a 6.0 acrescentou `ContaDaPlanilhaPerdidaError`; a 5.0 acrescentou `CalendarioRepository` e o tipo `ImportacaoLida`.
- `shared/index.ts`: a 6.0 acrescentou `MAXIMO_DE_LINHAS_DA_PLANILHA_DE_PROFESSORES`; a 5.0 acrescentou
  `LIMITE_DA_PLANILHA_POR_MINUTO`, `MINUTOS_DA_IMPORTACAO_NA_FILA_PARA_ALERTAR`, `MAXIMO_DE_LINHAS_DA_PLANILHA` e
  `VAGAS_DA_PLANILHA_POR_ESCOLA`.

São exports independentes, de peças diferentes, e o git os devolve com marcadores porque ficam nas mesmas linhas.

## Teste que reproduz

Não se aplica: é a resolução de um conflito de texto em arquivos de exports, sem comportamento novo. O código que veio do merge já
tem os testes das tarefas que o trouxeram (5.0 e 6.0). A prova é a ausência de marcador, a união dos exports das duas tarefas, a
tipagem da raiz, a do `e2e/`, a da `infra/` e a de cada pacote limpas, além do portão da tarefa sobre a árvore que o merge deixou.

A conferência de que nada além da resolução entrou é reproduzível: com o merge aberto e tudo preparado,
`git diff-tree -r --name-only $(git merge-tree --write-tree HEAD MERGE_HEAD | head -1) $(git write-tree)` compara a árvore que o git
junta sozinho (com os marcadores no que não juntou) com a que vai para o commit.

## Correção

Mantidos os exports das duas pontas, sem tirar nem renomear nenhum, e os marcadores `<<<<<<<`, `=======` e `>>>>>>>` saíram:

- `core/importacao/index.ts`: `export type { AnoDeDestino, EventoGravado, EventoNovo, ImportacaoLida, ImportacaoParaExecutar, NovaImportacao }`
  e a linha de `ContaDaPlanilhaPerdidaError, DiferencaNaPlanilhaError`.
- `core/index.ts`: `CalendarioRepository` e `ContaDaPlanilhaPerdidaError` juntos na linha de valores, `ImportacaoLida` e
  `ResultadoDaExecucao` na de tipos.
- `shared/index.ts`: os quatro nomes da 5.0 mais `MAXIMO_DE_LINHAS_DA_PLANILHA_DE_PROFESSORES`.

O merge se fecha com o commit `(correção encontro-6-onboarding)`.

## Mutações

**Sem mutação:** a correção só une exports em três arquivos de barril e não escreve cláusula nova; o código que veio do merge tem as mutações e os testes das tarefas 5.0 e 6.0.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (1ª) | O portão da tarefa só roda os testes de integração que a árvore alterou em relação ao HEAD; por isso `apps/api/test/professores.int.test.ts` e `apps/worker/test/gravar-planilha-professores.int.test.ts` não rodariam antes do commit, embora agora passem pelo guarda de limite e pelas vagas da 5.0. Os encontros de linha devem rodar as suítes de integração do lado que não mudou e que agora passam pelo código do outro, para não deixar isso só para a esteira | Fora desta correção: pede mudança no procedimento de encontro de linha (`tools/processo/`, skill `corrigir`), e a correção só resolve conflito de exports. Vai para a retro da spec (`/retro`). Os dois testes já foram rodados pelo test-engineer nesta rodada e passaram (35/35 e 29/29) |
| test-engineer (1ª) | As regras da 5.0 não dependem do tipo de planilha e passam a valer para `professores`: o limite por usuário, as 2 vagas por escola e o fechamento da importação parada, que apaga `linhas` e `marcas`. Nenhum teste as exercita com o tipo `professores`: uma importação de professores parada na fila deve ter as `marcas.desligar` apagadas pelo expurgo | Tarefa 16.0 (prova de ponta a ponta e sob carga) e validação da spec. Teste novo, comportamento já coberto por tipo diferente; não cabe em correção de conflito de texto |
| infra-guardian (1ª) | A planilha de professores da 6.0 agora passa pelos limites que a 5.0 trouxe, e nenhum teste de integração junta as duas coisas, por exemplo a terceira prévia de professores da mesma escola recusada com `LIMITE_EXCEDIDO`. O teste pode entrar na 16.0, junto com o cenário `importacao-7h30.js` | Tarefa 16.0 (já registrado pelo infra-guardian em `tasks/prd-onboarding-por-convite/6_task.md:901`) |
| infra-guardian (1ª) | `apps/worker/src/processors/gravar-planilha.ts:55`: o processor agora mede o passo (3); o alerta `importacao-passo3-lento` (acima de 1 s) pode disparar com os lotes de professores. Essa medida tem de ser conferida na 16.0, antes de o alerta ir para produção | Tarefa 16.0 (medida sob carga, `infra-guardian` marcado nela). Mudar limite do alerta agora seria mexer em comportamento sem medida |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.
| 2026-11-03 22:18:00 | 2026-11-03 22:18:31 | `revisor-geral` | 1 | APROVADO | ad1f20a12195f91bc |
| 2026-11-03 22:18:13 | 2026-11-03 22:18:48 | `tenancy-guardian` | 1 | APROVADO | a68400de8b8f5627d |
| 2026-11-03 22:18:26 | 2026-11-03 22:18:50 | `conformidade-reviewer` | 1 | APROVADO | ab1da209db6eef0cf |
| 2026-11-03 22:18:19 | 2026-11-03 22:19:15 | `privacy-guardian` | 1 | APROVADO | a449eba2988f88efd |
| 2026-11-03 22:18:06 | 2026-11-03 22:19:54 | `test-engineer` | 1 | APROVADO | a192a0ca5ef1690b7 |
| 2026-11-03 22:18:33 | 2026-11-03 22:20:11 | `infra-guardian` | 1 | APROVADO | ad05f070ea7dc8497 |
