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
| 2026-10-29 22:19:34 | `llm-integrator` | 2ª | APROVADO | `revisao-spec` | `travas.md`, linha "Regra 30", frase "Os arquivos isentos são os mesmos de hoje". Não é exata. |
| 2026-10-29 22:20:03 | `tenancy-guardian` | 2ª | REPROVADO | `revisao-spec` | A cerca `cerca-resolucao-de-tenant` desliga calada na 6.0, e nenhuma linha do anexo a cobre (regra 10, item 9). |
| 2026-10-29 22:20:09 | `infra-guardian` | 2ª | REPROVADO | `revisao-spec` | Tech Spec §5 (passo 6 do `aplicar` e o `restos`), §2 e `travas.md` "Regra 80" e "Processo e configuração": os arquivos da raiz que citam nome por texto ficam… |
| 2026-10-29 22:20:10 | `conformidade-reviewer` | 2ª | APROVADO | `revisao-spec` | `travas.md`:36 (`porta-unica.test.ts`) tem linhas erradas. A tabela cita as linhas "11, 12 e 31". A 31 não tem caminho. O que lê caminho ou nome são: |
| 2026-10-29 22:20:49 | `test-engineer` | 2ª | REPROVADO | `revisao-spec` | A forma da prova vermelha das travas está indefinida e se contradiz (§10, "Mutação"; travas.md, todas as colunas "Prova vermelha"). |
| 2026-10-29 22:21:04 | `privacy-guardian` | 2ª | REPROVADO | `revisao-spec` | Tech Spec §5, passo 6, e "A trava contra filtro vazio". Os arquivos de configuração da raiz e o `.github/` ficaram fora da busca por referências em texto. O… |
| 2026-10-29 22:21:22 | `revisor-geral` | 2ª | REPROVADO | `revisao-spec` | O `restos` e o passo 6 do `aplicar` buscam a palavra comum como palavra inteira, e ficam vermelhos para sempre (Tech Spec §5, "O `restos`" e passo 6). |
