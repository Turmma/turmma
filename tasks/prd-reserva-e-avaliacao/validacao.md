# Validação — reserva-e-avaliacao (F5b)

## Rodada 1 — 23/11/2026

**Escopo:** funcionalidade completa (13 tarefas; a 14.0 saiu para a F5c, D37 revista em `04e4b68b`)
**Commit validado:** `d8c0c0a8b8d1676f09f4fe5fa0aa649877439c1d`
**Veredito: APROVADA**

Nenhum RF tem tela (PRD §4: a reserva não aparece a professor, aluno nem coordenação; a aba Uso da Operação é da F5a e não
mudou de forma). Por isso não há foto da vitrine nesta rodada.

### 1. RF a RF

| RF | Situação | Código | Teste | Observação |
|---|---|---|---|---|
| RF1 | ATENDIDO | `packages/core/src/ia/soberania.ts:128` (a conferência da reserva, `daReserva`, que não segura o consumo); `packages/core/src/ia/modelos-aprovados.ts:233` (`reservaElegivel` exige `soberania.conferida`); `apps/api/src/ia/ia-do-worker.module.ts:17-27` (`SOBERANIA_DA_RESERVA`, `LIMITE_DE_TOKENS_DA_RESERVA`); `infra/grafana/alertas/ia-provedor-de-reserva.yaml`; `docs/runbook.md:1571` | `apps/api/src/ia/reserva-na-subida.int.test.ts` ("reserva sem suboperador vigente: o worker consome as filas…, `conferido = 0`", "o suboperador da reserva encerrado depois de conferida: o reinício a recusa, e o principal segue", "cadastro da reserva corrigido sem reiniciar"); `apps/api/src/ia/fila-de-ia.int.test.ts:1029` ("a reserva recusada na conferência e o principal fora: `IA_INDISPONIVEL`, sem chamar a reserva; o cadastro corrigido…"); `packages/core/src/ia/llm-gateway.test.ts:2272` e `:2763`; `infra/test/alertas.test.ts` | As três partes (fora do caminho, sem derrubar o principal, alerta) têm código e teste. Mutação 3 abaixo |
| RF2 | ATENDIDO | `packages/core/src/ia/soberania.ts:58` (`categoriasDasTarefas`) e `:66-74` (Brasil, treinamento, alcance, categorias); `modelos-aprovados.ts:215` (`tarefasAprovadasParaAReserva`) | `packages/core/src/ia/soberania.test.ts` ("as categorias exigidas são as das tarefas aprovadas para ela…", o caso `pais: 'US'` da reserva); `llm-gateway.test.ts:2247` ("aprovação só da geração, principal fora: a geração vai à reserva, o Tutor não…") e `:2742` (o mesmo sem vaga); `reserva-na-subida.int.test.ts:262` | Brasil sempre, treinamento vedado e categoria por tarefa conferidos; o Tutor não chega à reserva sem `conversa_do_aluno`. Mutação 1 abaixo |
| RF3 | ATENDIDO | `packages/core/src/ia/llm-gateway.ts:251` (`isQueda`), `:258` (`isLimite`), `:465-510` (`chamarAteValer`, duas por destino, `:78`), `:518-575` (a reserva nos dois ramos, uma vez, sinal vivo), `:559` (balde dela, sem espera); `resilient-adapter.ts` e `errors.ts` (motivos `limite` e `rejeitada`) | `llm-gateway.test.ts`, blocos 3.0 (`:1840`), 4.0 (`:2116`) e 7.0 (`:2541`): disjuntor, 5xx, conexão, prazo com sinal vivo e abortado, 429 → menor → reserva, 4xx não vai a lugar nenhum, os dois fora sem laço, quatro chamadas no máximo; `resilient-adapter.test.ts`; `apps/api/src/ia/prazo-com-tokens.int.test.ts`; `fila-de-ia.int.test.ts:1059` (lote adiado com `JobAdiadoError`); a fase `reserva` da carga (`docs/runbook.md:1997-2007`) | "Nunca erro cru": todo término é `LLMError` tipado (`IA_INDISPONIVEL` com motivo, `IA_TEMPO_ESGOTADO`, `IA_SAIDA_INVALIDA`) |
| RF4 | ATENDIDO | `modelos-aprovados.ts:207-212` (tarefa, `provedorId` e modelo do perfil; o falso fora de `producao`); `llm-gateway.ts:526-540` (a mesma função nos dois ramos); a regra fixa da D36 antes de qualquer provedor (ordem do `generate`) | `llm-gateway.test.ts:2262` (Tutor aprovado: a reserva atende) e o `it.each` logo abaixo (modelo do `rapido` trocado, o mesmo na classificação, outro `provedorId`: indisponível sem chamar a reserva); `:2247` (a mensagem da D36 sai pela regra fixa, sem provedor); `packages/core/src/ia/modelos-aprovados.test.ts`; `packages/core/src/config/llm-config.test.ts` (reserva falsa em produção, mesma identidade) | Mutação 2 abaixo |
| RF5 | ATENDIDO | `llm-gateway.ts:273` (`destinoDe`) e o `Gasto` por chamada; `packages/core/src/ia/consumo.ts:53`; `apps/api/src/ia/consumo.repository.ts:36` (`pelo_provedor_de_reserva ?? false`) | `fila-de-ia.int.test.ts:968` (duas linhas no banco, o `provedor` de cada uma, a coluna falsa e verdadeira), `:983` (o compartilhamento lista os dois suboperadores), `:997` (só a reserva), `:1009` (isolamento entre escolas); `apps/api/test/arquivo-do-titular.int.test.ts:584` e `:601` (isolamento); `llm-gateway.test.ts:2440` (preço, provedor e modelo de cada linha, `medicao` da reserva) | A lista de compartilhamento do aluno (art. 18, VII) mostra a reserva, com teste de isolamento por escola |
| RF6 | ATENDIDO | `llm-gateway.ts:913-962` (`createLLMGateway` e `variaveisDaReservaSemPreco`); `consumo.ts:97` (`destinosDaInterrompida`), `:110` (a estimada com os dois tetos); `consumo.repository.ts:56`; `varredura-de-execucoes.ts:107`; `execucao.processor.ts:214` | `llm-gateway.test.ts:1690-1721` (`LLM_RESERVA_MODELO` e `LLM_RESERVA_MODELO_<PERFIL>` sem preço recusam citando a variável; o `local` dispensa); `packages/core/src/ia/consumo.test.ts`; `apps/api/src/ia/execucao-interrompida.int.test.ts:945` (varredura, 1.300/5.200 e 2.000/8.000, uma linha por destino com custo), `:964` (duas varreduras em `Promise.all`), `:981` (a gravação que falha desfaz as duas), `:1036`/`:1045` (só o principal sem aprovação); `apps/api/test/painel-leitura.int.test.ts:727` | |
| RF13 | ATENDIDO | `tools/ia/amostras.ts` (`LINHAS_DA_AVALIACAO`, o leitor), `tools/ia/amostras/avaliacao-1.json`, `tools/ia/criterios/`, `tools/ia/medidas-da-avaliacao.ts`, `tools/ia/lotes-retidos.ts`, `packages/core/src/ia/medida-do-ouro.ts`, `tools/guardas/amostras-da-d55.ts` | `tools/ia/amostras.test.ts` ("toda tarefa tem linha", "as que chegam ao modelo", "a cobertura antes do gasto", "o arquivo de hoje"); `tools/ia/avaliar-modelos.test.ts:863` e `:938` (o sha256 de cada arquivo lido e o do lote retido pelo `RETIDOS.json`); `tools/ia/medidas-da-avaliacao.test.ts`; `tools/ia/lotes-retidos.test.ts`; `packages/core/src/ia/medida-do-ouro.test.ts`; `tools/guardas/amostras-da-d55.test.ts` | Tarefa abaixo do limiar sem entrada: a cadeia do RF16 recusa a entrada com linha reprovada |
| RF14 | ATENDIDO | `tools/ia/avaliar-modelos.ts` (chave só por `AVALIACAO_*`, pasta fora do checkout, `--treinamento-vedado`); `tools/guardas/ponto-de-entrada-da-avaliacao.ts`; `tools/guardas/ids-retidos-sem-texto.ts` | `avaliar-modelos.test.ts:231`, `:853` e `:1726` (pasta dentro do checkout recusada), `:918` (a chave em nenhum arquivo gravado), `:1737` e `:2182` (lote retido só com id e resultado); `tools/guardas/ponto-de-entrada-da-avaliacao.test.ts` (inclui os testes que abrem a ferramenta por processo); `tools/guardas/ids-retidos-sem-texto.test.ts` | O gitleaks é da esteira (conferida no fechamento) |
| RF15 | ATENDIDO | `docs/avaliacao-de-modelos.md` §1 (conferida em 22/11/2026, fontes e lacunas; Google fora; Bedrock `sa-east-1` e Magalu a confirmar); `tasks/prd-reserva-e-avaliacao/pesquisa-3-1.md`; `avaliar-modelos.ts:1060-1087` e `:1205-1255` (latência, tokens, custo, TPM oferecido, custo por aluno e por professor) | `avaliar-modelos.test.ts:724` ("as medidas: latência, tokens, custo…"), `:863-881` (o relatório com as três contagens, o TPM oferecido e o custo por professor), com o modelo falso | O relatório por finalista é da F5c. Ver menor sobre a D37 |
| RF16 | ATENDIDO | `modelos-aprovados.ts:52` (sha256 do relatório), `:108-189` (relatório → `resultado.json` → todas as linhas da tarefa → D55 → perfil da classificação → AIA); `docs/avaliacao/falso-reserva/relatorio.md` e `resultado.json` | `packages/core/src/ia/modelos-aprovados.test.ts` (entrada sem relatório, linha reprovada, finalista eliminado, `resultado.json` editado, AIA sem o modelo, classificação no perfil errado) | O registro na D37 revista e nas AIAs é da F5c (PRD RF16, 23/11/2026) |

Provas de mutação (cada uma rodou só o teste citado e foi restaurada com `git checkout -- <arquivo>`; a árvore terminou limpa):

| RF | Cláusula removida | Teste que ficou vermelho |
|---|---|---|
| RF2 | `soberania.ts:128`: a conferência da reserva exige `[]` em vez de `categoriasDasTarefas(daReserva.tarefas)` | `soberania.test.ts` › "as categorias exigidas são as das tarefas aprovadas para ela: a mesma instância confere sem a conversa do aluno só se o Tutor não está aprovado" (1 de 43 vermelho) |
| RF4 | `modelos-aprovados.ts:210`: a aprovação sem `entrada.modelo === modelo` | `llm-gateway.test.ts` › "o modelo do `rapido` da reserva trocado…" e "o mesmo na classificação do material" (2 de 208 vermelhos) |
| RF1 | `modelos-aprovados.ts:235`: `reservaElegivel` sem `contexto.soberania?.conferida !== true` | `llm-gateway.test.ts` › "a reserva só atende o que a subida conferiu na D62…" e "a D62 da reserva vale nos três caminhos…" (2 de 208 vermelhos) |

### 2. Regras de negócio, casos de borda e critério de pronto

| Item | Situação | Evidência |
|---|---|---|
| Regra: texto de aluno só em provedor com Brasil em contrato, também na reserva e na falha | cumprida | RF1, RF2; mutação 1; `soberania.test.ts` (reserva com `pais: 'US'`); a reserva não conferida não é elegível (mutação 3) |
| Regra: o custo superestima (D14), a interrompida leva o teto em cada destino | cumprida | RF6; `execucao-interrompida.int.test.ts:945` e `:1018` (com outro modelo, as duas mesmo assim) |
| Regra: função de alto risco abaixo da taxa mínima não liga (D60) | cumprida no escopo da F5b (a reserva, pela cadeia do RF16) | `modelos-aprovados.test.ts`; para o **principal** não há guarda em código, e a Tech Spec §13 aponta um item do `TODO.md` que não existe (menor 1) |
| Borda: principal fora às 10h com seis turmas no Tutor | coberta | a carga, janelas `5xx`, `prazo` e `429` com zero indisponível (`docs/runbook.md:1971-2005`); `llm-gateway.test.ts:2262` |
| Borda: principal e reserva fora juntos | coberta | `llm-gateway.test.ts:2297` e `:2524`; `fila-de-ia.int.test.ts:1059`; `resilient-adapter.test.ts` e `infra/test/alertas.test.ts` (o "Provedor de IA fora" por `provedor`) |
| Borda: contrato da reserva vence no meio do mês | coberta | `reserva-na-subida.int.test.ts:245` ("encerrado depois de conferida: o reinício a recusa, e o principal segue") |
| Pronto: provedor de reserva (RF1 a RF5) | cumprido | seção 1 |
| Pronto: custo (RF6) | cumprido | seção 1 |
| Pronto: carga, a fase `reserva` rodada com registro em `docs/runbook.md` | cumprido | corrida de 22/11/2026, verde, load 0,70 e `docker ps` vazio; controle negativo reprovando pelo indisponível (`docs/runbook.md:1997-2007`) |
| Pronto: avaliação pronta para rodar (RF13 a RF16), provada com o modelo falso | cumprido | seção 1 |
| Pronto: pendências do `TODO.md` desta spec (linha 99 de `docs/lgpd.md`; o teste de que `provedor` guarda o id da reserva; o 429 e a conexão recusada com estimativa; `docs/mvp-contratos.md:213`) | cumprido | `docs/lgpd.md:99` cita `IA_RESERVA_PROVEDOR_ID` e `pelo_provedor_de_reserva`; `arquivo-do-titular.int.test.ts:584`; `TODO.md:4301`, `:4408` e `:4409` marcados `[x]`; `docs/mvp-contratos.md` lista `provedor?` e `pelo_provedor_de_reserva` |
| Pronto quando (roadmap): texto de aluno não sai fora do Brasil, também na reserva | cumprido | RF2 |
| Pronto quando (roadmap): com o principal fora, a reserva aprovada atende | cumprido | RF3, RF4, carga |
| Pronto quando (roadmap): avaliação pronta para rodar, com amostras, ferramenta, medidas e a guarda do RF16 | cumprido | RF13 a RF16 |

### 3. Portão

| Portão | Resultado |
|---|---|
| `npm run typecheck` | não rodado aqui (esteira, D79) |
| `npm run lint` | não rodado aqui (esteira, D79) |
| Testes de evidência, unidade (isolados) | ✅ 1.553 passaram: `packages/core/src/ia/` (`modelos-aprovados`, `soberania`, `llm-gateway`, `consumo`, `resilient-adapter`, `fake-adapter`, `medida-do-ouro`, `golden`, `tasks/turno-do-tutor`), `config/llm-config`; `tools/ia/` inteiro; as guardas `amostras-da-d55`, `ids-retidos-sem-texto`, `ponto-de-entrada-da-avaliacao`, `alerta-tem-runbook`; `infra/test/alertas` e `infra/test/carga` |
| Testes de evidência, integração (isolados) | ✅ 189 passaram em 6 arquivos: `reserva-na-subida`, `fila-de-ia`, `execucao-interrompida`, `prazo-com-tokens` (`apps/api/src/ia/`), `arquivo-do-titular` e `painel-leitura` (`apps/api/test/`) |
| `npm run test:e2e` | não se aplica (sem tela) |
| Esteira do GitHub | conferida no fechamento, pelo Orquestrador (D79): não entra no veredito |
| Revisões com veto registradas e aprovadas | ✅ nas 13 tarefas, todo revisor obrigatório tem rodada e a última de cada revisor com veto é APROVADO; `revisao-spec.md` APROVADA na rodada 8 (22/11/2026) |

O `node_modules` estava em dia com o `package-lock.json` (sem `npm ci`). O Docker Desktop estava parado e foi iniciado para a
integração; nenhum teste ficou vermelho.

### 4. Achados

**Críticos**
- Nenhum.

**Maiores**
- Nenhum.

**Menores**
1. `tasks/prd-reserva-e-avaliacao/techspec.md:242`: "Aprovação do principal: `TODO.md`" aponta um item que não existe, e a
   `revisao-spec.md:253-254` passou à validação "a aprovação do principal sem prova no código". Hoje nada no código impede um
   principal de produção sem relatório aprovado (só a reserva passa pela cadeia do RF16). Não fere RF desta spec, porque nenhum
   principal real é escolhido aqui, mas é a regra de negócio da D60 para o principal. Correção: um item no `TODO.md`, dono a F5c
   (ou o portão da primeira escola real), dizendo se o principal também passa por `MODELOS_APROVADOS` ou por outra prova. Dono:
   Orquestrador, no fechamento.
2. `docs/decisoes.md:448`: a D37, revista em 23/11/2026, ainda lista "Google (Gemini Flash-Lite e Flash)" entre os finalistas,
   enquanto `docs/avaliacao-de-modelos.md` §1 (RF15, pesquisa de 22/11) diz "Google fora" e põe Bedrock `sa-east-1` e Magalu a
   confirmar. Correção: alinhar a lista de finalistas da D37 com a §1 (`registrar-decisao`). Dono: Arquiteto.
3. `TODO.md:4418`: "Anexar na validação a taxa de 429 medida na subida" não tem como acontecer sem provedor real. Correção: dono
   passa à F5c. `TODO.md:4423` e `:4431`: "Dono: a 14.5 (as AIAs)", tarefa que saiu desta spec e cujo documento
   (`para-a-f5c/14_task.md`) não cita os dois itens. Correção: dono "F5c, 14.5". Dono: Orquestrador.
4. `tasks/prd-reserva-e-avaliacao/achado-d55-recusa-rubrica.md`: a correção da D55 decidida pelo Joaquim (22/11 12:55, "corrige
   a D55 depois da F5b") só está no `estado.md` ("Devo ainda"), sem item no `TODO.md`. Correção: um item no `TODO.md` ou o
   `/corrigir` aberto logo depois do pouso. Dono: Orquestrador.
5. `tasks/prd-reserva-e-avaliacao/1_task.md:558`: uma "rodada 2" do `llm-integrator` com "SEM VEREDITO", 5 s depois da
   rodada 1 e com o mesmo agente (`ac41795adf81f1214`): rastro do hook ao retomar o mesmo subagente, não uma revisão. O
   `llm-integrator` não tem veto e aprovou na rodada 1. Correção: o hook ignorar a retomada do mesmo agente sem saída nova.
   Dono: retro.
6. `docs/runbook.md:2007`: o controle negativo da carga rodou com load de 1 minuto 2,41, acima do "~2" da condição de
   registro. Como o controle precisa reprovar, a máquina cheia não o favorece, e o texto diz isso; só fica anotado. Dono: nenhum.

**Positivos**
- Os testes de roteamento derrubam a mutação na primeira cláusula que se tira: as três provas ficaram vermelhas nos casos
  certos, e cada caso diz no nome a cláusula que prende.
- O relatório sintético da reserva falsa (`docs/avaliacao/falso-reserva/`) passa pela mesma cadeia do RF16 que um relatório
  real: a guarda é exercida desde já, e não só quando chegar a primeira aprovação de verdade.
- A guarda dos ids retidos e a do ponto de entrada da ferramenta transformam o "não copiar o lote" e o "nenhum teste chama a
  rede" em teste, com fixture que viola cada cláusula.

### 5. Conclusão

Os dez RF estão atendidos, com código e teste para cada parte do critério de aceite; os RF de maior risco (RF1, RF2 e RF4:
soberania, contrato e o Tutor na reserva) passaram por mutação. O critério de pronto do `tasks.md` e o "Pronto quando" do
roadmap estão cumpridos, com a carga registrada em máquina calma. Não há crítico nem maior, e nenhum teste rodado ficou
vermelho: o veredito é APROVADA, com os seis menores listados para o `TODO.md`. O de maior peso é o primeiro: a F5c precisa
decidir como o principal prova a sua aprovação antes de ligar o Tutor numa escola real.

### 6. Pendências herdadas

| Pendência | Dono | Arquivo |
|---|---|---|
| Como o principal prova a aprovação (D60) antes da escola real; o item que a Tech Spec §13 diz estar no `TODO.md` | Orquestrador → F5c | `techspec.md:242`, `revisao-spec.md:253` |
| D37 com Google entre os finalistas, contra a §1 revista | Arquiteto (`registrar-decisao`) | `docs/decisoes.md:448` |
| Taxa de 429 medida na subida e as duas linhas das AIAs com dono "a 14.5" | Orquestrador → F5c | `TODO.md:4418`, `:4423`, `:4431` |
| A correção da D55 que recusa rubrica legítima, depois do pouso | Orquestrador (`/corrigir`) | `achado-d55-recusa-rubrica.md`, `estado.md` |
| A "rodada 2 SEM VEREDITO" que o hook gravou ao retomar o mesmo subagente | retro | `1_task.md:558`, `tools/processo/revisoes.ts` |
| As recomendações dos revisores das tarefas que já estão no `TODO.md` ("Da reserva-e-avaliacao, tarefa N.0") | seguem com os donos de lá | `TODO.md:7-211`, `:4414-4446` |
| Commits `Fora do processo:` com código | nenhum nesta spec | `git log origin/develop..HEAD -i --grep='^Fora do processo:'` vazio |
