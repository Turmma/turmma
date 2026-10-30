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
| 2026-10-30 03:31:35 | `infra-guardian` | 1ª | APROVADO | `1_task` | `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l1/.claude/skills/seguir/passos/8-validacao-e-pouso.md:69`: o passo manda rodar… |
| 2026-10-30 03:31:37 | `tenancy-guardian` | 1ª | APROVADO | `1_task` | Nas ondas que vão usar esta ferramenta, um mapa que renomeie nome do isolamento entre escolas deve chamar o `tenancy-guardian` na própria onda. Isso vale para… |
| 2026-10-30 03:31:46 | `privacy-guardian` | 1ª | APROVADO | `1_task` | A seção "Sem classificação" do relatório copia a linha do código-fonte (`relatorio.ts`, coluna `Trecho`). Hoje é inofensivo, porque só lê arquivo versionado e… |
| 2026-10-30 03:32:22 | `conformidade-reviewer` | 1ª | APROVADO | `1_task` | Na 2.0, o `conferir` precisa comparar, antes e depois de cada onda, a string do prompt e a da ação auditada (techspec §7b). É o que mantém de pé a regra 70… |
| 2026-10-30 03:33:25 | `revisor-geral` | 1ª | REPROVADO | `1_task` | A Tech Spec mudou sem registro. Está em `tools/renomear/simbolos.ts:97` e no docblock das linhas 9 a 12. |
| 2026-10-30 03:35:09 | `test-engineer` | 1ª | REPROVADO | `1_task` | A ocorrência sem linha no formato certo não tem caso. Fica em `tools/renomear/mapa.ts:172-178`. |
| 2026-10-30 03:53:14 | `tenancy-guardian` | 2ª | APROVADO | `1_task` | As duas recomendações da 1ª rodada estão registradas em "Recomendações sem aplicar" do `tasks/prd-nomes-de-mercado/1_task.md`. A primeira: a onda que renomear… |
| 2026-10-30 03:53:26 | `revisor-geral` | 2ª | APROVADO | `1_task` | `techspec.md` §12, linha 183: a premissa agora diz "✅ VERIFICADO", mas a linha seguinte ainda traz "senão, `getReferencesAtPosition` projeto a projeto. A 1.0… |
| 2026-10-30 03:53:27 | `privacy-guardian` | 2ª | APROVADO | `1_task` | nenhuma nova. A da 1ª rodada (strings do Drizzle, ações de auditoria e chaves de `ExecucaoAgente` mantidas nas ondas) continua valendo para as tarefas 3.0 em… |
| 2026-10-30 03:53:27 | `infra-guardian` | 2ª | APROVADO | `1_task` | Nas ondas seguintes (2.0 em diante), quando o mapa for aplicado em `packages/nucleo/drizzle`, em schema ou em nome de fila do BullMQ, a revisão da onda deve… |
| 2026-10-30 03:53:29 | `conformidade-reviewer` | 2ª | APROVADO | `1_task` | A minha recomendação da 1ª rodada ficou registrada em "Recomendações sem aplicar" de `tasks/prd-nomes-de-mercado/1_task.md`, com destino na tarefa 2.0. A… |
| 2026-10-30 03:55:00 | `test-engineer` | 2ª | APROVADO | `1_task` | `tools/renomear/simbolos.ts:68` (`entrada.arquivo === undefined ? arvore.caminhos().filter(ehCodigo) : [entrada.arquivo]`) e `tools/renomear/simbolos.ts:178`… |
| 2026-10-30 05:45:32 | `tenancy-guardian` | 1ª | APROVADO | `2_task` | tools/guardas/filtros-casam.test.ts:47 — EXCECOES_NOMINAIS isenta '/dist/' e '/node_modules/' da trava contra filtro vazio. Hoje isso não afeta nenhuma guarda… |
| 2026-10-30 05:45:39 | `infra-guardian` | 1ª | APROVADO | `2_task` | Em `tools/renomear/restos.test.ts:244`, o `timeout: 180_000` está muito acima do tempo real: os três arquivos de teste rodaram juntos em 3,2 s, com 111 testes… |
| 2026-10-30 05:45:49 | `privacy-guardian` | 1ª | APROVADO | `2_task` | O `filtros-casam.test.ts` também protege a regra 20: se a onda de rename deixar vazio o filtro de `log-sem-dado-pessoal`, do `ESCOPO_DO_ERRO_TIPADO` ou o… |
| 2026-10-30 05:45:52 | `conformidade-reviewer` | 1ª | APROVADO | `2_task` | O `restos` deixa de olhar `docs/decisoes.md`, `tasks/` e o ouro enquanto não existir `mapas/13.json` (`tools/renomear/texto.ts:19`). Quando uma onda renomear… |
| 2026-10-30 05:47:16 | `revisor-geral` | 1ª | APROVADO | `2_task` | Texto da 2.5 desatualizado. `tasks/prd-nomes-de-mercado/2_task.md:29` diz que o `eslint.config.mjs` foi copiado para a fixture. Ele não foi:… |
| 2026-10-30 05:48:04 | `test-engineer` | 1ª | REPROVADO | `2_task` | Uma regra sem teste nenhum. Em `tools/renomear/foto.ts:87`, o `ts.isNoSubstitutionTemplateLiteral(no)` dentro de `ehTexto` não tem teste. Nenhum teste de… |
| 2026-10-30 06:07:14 | `revisor-geral` | 2ª | APROVADO | `2_task` | A seção "Sem aplicar" da ordem manda seis recomendações para o `TODO.md`: o `timeout` de 180 s, o `maxBuffer` de 1 GiB, o `casos.md`, o `PADRAO` de… |
| 2026-10-30 06:07:40 | `test-engineer` | 2ª | APROVADO | `2_task` | `tools/renomear/conferir.test.ts:382`: `/ENOENT.*mapas\/9\.json/` depende do texto do erro do Node. Se ele mudar entre versões, o teste quebra sem a regra ter… |
