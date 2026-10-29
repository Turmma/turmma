# Índice dos achados das revisões

Uma linha por rodada que exigiu alguma coisa. O texto inteiro está no arquivo do documento, nesta
pasta (`<documento>.md`), no bloco com o mesmo fim. Escrito pelo hook `tools/processo/revisoes.ts`.
Não edite à mão.

Leia este índice antes de codar, e abra só os blocos que interessam à tarefa de agora.

| Fim | Revisor | Rodada | Veredito | Documento | O que exigiu |
|---|---|---|---|---|---|
| 2026-10-29 21:35:31 | `llm-integrator` | 1ª | AJUSTES NECESSÁRIOS | `revisao-spec` | B1. Tech Spec §7 e §5, mais inventário core-shared §17 (linha `ia/adaptador.ts` para `ia/model-adapter.ts`): a guarda de SDK da regra 30 fica incoerente com o… |
| 2026-10-29 21:35:54 | `tenancy-guardian` | 1ª | REPROVADO | `revisao-spec` | §6, linha `regras-tenant.mjs`. A Tech Spec diz que a guarda lê `Banco`, mas lá `Banco` só aparece em comentário. O que ela lê de fato é o nome do pacote:… |
| 2026-10-29 21:36:29 | `infra-guardian` | 1ª | REPROVADO | `revisao-spec` | §2, §5 (passo 1 e `conferir`) e §7c: o harness de carga e o ensaio de alertas quebram em silêncio. Três scripts carregam o código compilado por caminho em… |
| 2026-10-29 21:36:37 | `privacy-guardian` | 1ª | REPROVADO | `revisao-spec` | Incluir os literais de expressão regular no `conferir` (§5). Hoje ele compara só strings, partes de template e `JsxText`, e as detecções de CPF e as varreduras… |
| 2026-10-29 21:37:42 | `conformidade-reviewer` | 1ª | REPROVADO | `revisao-spec` | B1 e B2, abaixo |
| 2026-10-29 21:38:48 | `test-engineer` | 1ª | REPROVADO | `revisao-spec` | `tools/guardas/regras-erro.mjs:21`, `NOME_DA_CLASSE_DE_INVARIANTE = 'ErroDeInvariante'`, onda 2.0. Depois de virar `InvariantException`, `new… |
| 2026-10-29 21:38:56 | `revisor-geral` | 1ª | REPROVADO | `revisao-spec` | A troca por palavra inteira em comentário e documento estraga a prosa (§1, §5 passos 2 e 5, §2). |
