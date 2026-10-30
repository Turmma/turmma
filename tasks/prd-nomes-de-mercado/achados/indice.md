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
| 2026-10-29 22:58:10 | `infra-guardian` | 3ª | APROVADO | `revisao-spec` | `travas.md:73-74`. A prova do caminho do `dist` (os scripts de `infra/scripts/` e `tools/ia/medir-risco-a-vida.ts`) é o `restos` e o `tsc`, não "um caso que já… |
| 2026-10-29 22:58:20 | `tenancy-guardian` | 3ª | APROVADO | `revisao-spec` | travas.md:32, a metade de caminho da regex na 6.0: até a 7.0, o caso "a varredura acha as três classes dentro da zona" (`arquitetura.test.ts:66-74`) continua… |
| 2026-10-29 22:58:25 | `privacy-guardian` | 3ª | APROVADO | `revisao-spec` | Passo 6, arquivos da raiz que ficaram de fora. O passo 6 deixou de fora `.size-limit.json`, `compose.yaml` e `.env.example`, que eu tinha listado na rodada 2.… |
| 2026-10-29 22:59:04 | `test-engineer` | 3ª | REPROVADO | `revisao-spec` | A trava negativa não se prova pela forma geral (techspec.md 161–164; travas.md 12–15, contra as linhas 43, 45 e 87). |
| 2026-10-29 22:59:32 | `revisor-geral` | 3ª | REPROVADO | `revisao-spec` | techspec.md:55-60 (passo 6) e :38-40: o `aplicar` ainda não roda numa onda que tenha `de` de palavra comum. |
| 2026-10-29 23:04:21 | `revisor-geral` | 4ª | REPROVADO | `revisao-spec` | `inventario.md:34` contradiz o anexo core-shared, e a contradição entrou nesta rodada. |
| 2026-10-29 23:04:22 | `test-engineer` | 4ª | REPROVADO | `revisao-spec` | A base de busca do filtro vazio deixa a trava vermelha já na árvore sã da 2.0 (`casos.md:71`, junto com `techspec.md:83-86`). |
| 2026-10-30 01:25:20 | `revisor-geral` | 5ª | REPROVADO | `revisao-spec` | `tasks/prd-nomes-de-mercado/inventario-back.md:306` e `:329`. O meu bloqueante da rodada 4 foi resolvido só em parte. A adenda 3 (`inventario.md:195`) diz que… |
| 2026-10-30 01:26:34 | `test-engineer` | 5ª | REPROVADO | `revisao-spec` | A techspec, §5, passo 6 (linhas 60 e 61), tem três condições para listar a palavra comum que nenhum caso do `casos.md` prova: |
| 2026-10-30 01:27:59 | `revisor-geral` | 6ª | REPROVADO | `revisao-spec` | `tasks/prd-nomes-de-mercado/casos.md:30`. O caso `'./fila/x'` (segmento de caminho) não prova a condição que diz provar, e contradiz o parêntese que esta mesma… |
| 2026-10-30 01:28:13 | `test-engineer` | 6ª | REPROVADO | `revisao-spec` | `tasks/prd-nomes-de-mercado/casos.md:30` choca com `techspec.md:61-62`: o caso de "segmento de caminho" não chega à condição. |
| 2026-10-30 01:29:13 | `test-engineer` | 7ª | APROVADO | `revisao-spec` | `casos.md:38`: dizer quais entradas o mapa de teste desse caso leva. Para o caso pegar a busca sem caixa, o mapa precisa ter a entrada de símbolo `Fila` e a… |
| 2026-10-30 01:30:03 | `revisor-geral` | 7ª | REPROVADO | `revisao-spec` | `tasks/prd-nomes-de-mercado/casos.md:30`. O caso `'apps/x/Tela/y'` não prova a condição "segmento de caminho" da palavra comum. |
| 2026-10-30 01:31:52 | `revisor-geral` | 8ª | APROVADO | `revisao-spec` | da rodada 7: |
| 2026-10-30 01:32:19 | `test-engineer` | 8ª | REPROVADO | `revisao-spec` | A pasta pela pasta-mãe e nome não tem caso que a prove (`casos.md:31`). |
| 2026-10-30 01:33:21 | `test-engineer` | 9ª | APROVADO | `revisao-spec` | `travas.md:25`, frase contraditória. O texto diz "O que o relatório achar dessa forma ganha linha aqui". Mas o limite existe justamente porque o passo 6 não… |
