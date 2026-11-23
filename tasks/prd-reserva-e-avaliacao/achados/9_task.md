# Achados das revisões — `tasks/prd-reserva-e-avaliacao/9_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## llm-integrator · 1ª rodada · APROVADO · 2026-11-22 23:45:17 · `tasks/prd-reserva-e-avaliacao/9_task.md`

VEREDITO: APROVADO
Perfis usados: nenhum. A tarefa não adiciona chamada de modelo ao produto. É carga com adaptador falso, tanto no principal quanto na reserva (`falso-reserva`).
Custo estimado por professor/mês: R$ 0, sem chamada nova em produção. A fase `reserva` roda só com o `FakeAdapter`, sem provedor pago. O custo real da reserva depende do uso que a 7.0 já cobriu: ela só é chamada em queda, em 429 ou sem vaga.
Prompt versionado: não se aplica (nenhum prompt criado ou alterado)
Validação de schema: não se aplica
Aprovação humana no caminho: não se aplica (sem nota, entrega ou saída de IA ao aluno)

Auditei o diff e os pontos de IA da tarefa. Não rodei os testes nem a carga; os números da carga são os registrados em `9_task.md`.

Conferi em `infra/scripts/carga.ts`, `infra/carga.env`, `infra/compose.carga.yml` e `packages/core/src/config/llm-config.test.ts`:
- **Sem SDK nem provedor pago.**
  - `exigirReservaFalsa` (`carga.ts:798-801`) derruba o script se `RESERVA_DA_CARGA_ADAPTADOR` não for `falso`.
  - `IA_FALHA_FALSA` só age no `FakeAdapter`.
  - A configuração (`llm-config.ts:190`) a proíbe com `AMBIENTE=producao`.
- **A `sala` continua comparável à X6.**
  - As variáveis `RESERVA_DA_CARGA_*` não chegam ao worker pelo compose.
  - O script as passa como `IA_RESERVA_*` só nas janelas que ligam a reserva (`variaveisDaReserva`).
  - Fora delas ficam vazias, e vazio vale como ausente.
  - O teste de `llm-config.test.ts` ainda prova a identidade `falso-reserva` e o contratado próprio, agora pelos nomes novos.
- **Controle negativo útil.**
  - `falso-sem-aprovacao` não está em `MODELOS_APROVADOS`, logo a reserva não é elegível.
  - Reprova pelo indisponível (260 na `5xx`, 230 no `prazo`, 260 na `429`, 115 no `balde`), com `provedor_de_reserva` em 0.
- **Medição escopada.** As consultas a `execucao_agente` filtram por `escola_id = any($1)` das escolas sintéticas e pelo intervalo `[de, até)`. São rotina de teste, sem dado pessoal e sem log de conteúdo.
- **Disciplina de custo e de parada.**
  - O limite do p95 é 1 s acima do controle da mesma corrida.
  - Menos de 30 amostras reprova a janela.
  - Contador do Prometheus ausente ou degrau da reserva que não subiu também reprova.
- **Corridas vermelhas.** As duas primeiras ficaram no registro com a causa, e ambas eram defeito da carga, não do produto.

Bloqueantes: nenhum
Recomendações:
- A janela `balde` depende de `LLM_TOKENS_POR_MINUTO_NO_BALDE_CHEIO` (1,2 milhão) ficar abaixo da carga do pico (1,625 milhão). Se a escala da `sala` mudar, `infra/test/carga.test.ts` deveria falhar ao quebrar essa relação; confirme que há asserção para isso.
- O resultado de `docs/runbook.md` tem a condição da máquina. Convém repetir a corrida quando a esteira de carga mudar de máquina, porque os p95 absolutos (6,2 s) dependem dela, e só a diferença para o controle é o critério.
- Em `docs/infra.md` 5.4, o parágrafo da carga ficou longo dentro do bloco do balde da reserva. Mover para a seção de carga deixaria o contrato de produção mais limpo.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-22 23:45:28 · `tasks/prd-reserva-e-avaliacao/9_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma nova e nenhuma migration. A tarefa só lê `execucao_agente`, que já tem `escola_id`, e semeia escolas, redes, turmas e sessões sintéticas pelas rotinas `ops` que já existiam (`ops:escola`, `ops:sessao-sintetica`).

Queries verificadas:
- `medirTutorNaJanela` (`infra/scripts/carga.ts:303`) filtra por `escola_id = any($1::uuid[])` e pelo intervalo `[de, até)`.
- `falhasNaJanela` (`infra/scripts/carga.ts:314`) usa o mesmo filtro de escola e de intervalo.
- `aguardarOInicioDaCarga` (`infra/scripts/carga.ts:431`) filtra por `escola_id = any($1::uuid[])` e `criada_em >= $2`.
- As três são rotina do script de carga, fora de `apps/api`. A lista de escolas sai das escolas que o próprio script cria em `criarEscolasDaSala` (UUID devolvido pelo `ops`), não de cliente HTTP.
- Não há repository, endpoint nem `@Unscoped()` novos.
- O k6 (`infra/k6/justica-entre-escolas.js`) não manda `escolaId` em corpo nem em query: o escopo vem do token da sessão sintética de cada escola.
- O contador `ia.degradacao` lido do Prometheus é agregado e não tem dado individual.

Teste de isolamento: presente e efetivo. Em `infra/test/carga-da-manha.int.test.ts:194`, a escola B tem 2 execuções concluídas e 1 `IA_SAIDA_INVALIDA` dentro da janela.
- Sem a cláusula `escola_id`, `medirTutorNaJanela(pool, [a])` daria 12 amostras em vez de 10, e o teste quebra.
- Sem a cláusula, `falhasNaJanela(pool, [a])` passaria a contar `IA_SAIDA_INVALIDA: 1`, e o `toEqual` quebra.
- A escola vazia (`[await escola()]`) devolver `{ amostras: 0, p95Ms: null }` também prova o filtro.

Bloqueantes: nenhum.

Recomendações:
- `falhasNaJanela` (`infra/scripts/carga.ts:316`) não filtra por `funcao`. Ela conta falhas da ferramenta e da proposta junto com as do Tutor. Não é questão de isolamento, mas vale deixar isso dito no relatório da janela ou no nome da coluna.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-22 23:45:38 · `tasks/prd-reserva-e-avaliacao/9_task.md`

VEREDITO: APROVADO

A tarefa 9.0 não toca nenhum campo de pessoa nem código de produção. Mexe só no roteiro de carga, no compose e no env da carga, nos testes da carga e na documentação. Nenhum dado sai da máquina.

Campos pessoais tocados: nenhum. Não há migration, repository, endpoint nem DTO novo. As consultas novas, `medirTutorNaJanela` e `falhasNaJanela` em `infra/scripts/carga.ts`, leem de `execucao_agente` só contagem, erro e duração. Leem apenas as escolas sintéticas da corrida, com `escola_id = any($1)`, e nunca leem conteúdo.

Fora da tabela de dados do docs/lgpd.md: nada. As variáveis novas (`RESERVA_DA_CARGA_*`, `IA_FALHA_FALSA`) são de configuração, não de pessoa.

Autorização por objeto: ok. Não há rota nova. O k6 usa as mesmas rotas e os mesmos tokens da fase `sala`, com sessões sintéticas de `ops:sessao-sintetica`, cada uma presa à sua escola.

Logs: limpos. O que `escrever(...)` imprime é nome de janela, falha simulada, contagens, p95 e ids de critério (`carga.ts:1189`, `1235`, `1260-1264`). O `compose logs --tail 100` em caso de falha (`carga.ts:1285`) já existia na fase `sala`, e o ambiente só tem dados sintéticos.

Auditoria: não se aplica. A tarefa não faz leitura de aluno por coordenação ou rede, exportação, alteração de nota ou de permissão, nem aprovação de saída de IA.

Envio externo: nenhum.
- O principal e a reserva usam o adaptador falso. `exigirAdaptadorFalso` e `exigirReservaFalsa` (`carga.ts:799-802`) derrubam o script se `infra/carga.env` apontar outro adaptador.
- O controle negativo troca só o id do provedor (`falso-sem-aprovacao`). O adaptador continua o falso.
- Não houve chamada a provedor real, então não há envio a registrar fora do que o `ExecucaoAgente` já grava.

Seed/fixture: sintético.
- As escolas, alunos e professoras saem de `criarEscolasDaSala`, `sessoesSinteticas` e `semearEscolaDaSala`, todos já existentes.
- O teste de integração (`infra/test/carga-da-manha.int.test.ts`) cria escolas com `randomUUID` e execuções sem conteúdo.
- O compose da carga sobe e cai com `down --volumes`, e a pasta temporária dos tokens é apagada no `finally` (`carga.ts:1286-1290`).

Pergunta de fechamento: a tarefa não muda nada no que o sistema guarda sobre um aluno nem para onde envia. O arquivo do titular e a lista de compartilhamento continuam como estavam, e a carga não cria titular real nem envio real.

Bloqueantes: nenhum.

Recomendações:
1. `carga.ts:1022-1023` e `1269-1270`: o `tokens.json` é gravado com permissão 0o644, numa pasta temporária com 0o777. É o mesmo padrão que a fase `sala` já usa. Os tokens são de sessões sintéticas de um compose que cai no fim da corrida, mas numa máquina compartilhada outro usuário poderia lê-los enquanto a corrida roda. Vale avaliar 0o600 no arquivo, com o k6 rodando no mesmo uid, ou 0o700 na pasta, numa tarefa de infra futura. Não bloqueia.
2. A própria tarefa e o runbook já registram que a corrida 3 não vale como registro de piloto, porque o load estava em 4,24. A repetição com a máquina calma é do `infra-guardian`, não desta regra.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-22 23:45:43 · `tasks/prd-reserva-e-avaliacao/9_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa não cria caminho que grave em `Nota`. A carga só grava estrutura sintética (`ano_letivo`, `serie`, `turma`, `disciplina`, `material`, `trecho`, `vinculo`, em `infra/scripts/carga.ts:542-573`, código que já existia), além das sessões criadas por `ops:sessao-sintetica`. As consultas novas (`medirTutorNaJanela`, `falhasNaJanela`, `aguardarOInicioDaCarga`) só leem `execucao_agente`. Todos com autor humano? Não se aplica, porque não há escrita em `Nota`.

Decisão autônoma sobre aluno: ausente. A fase `reserva` só mede o tempo de resposta e conta as falhas do turno do Tutor, da ferramenta e da proposta. O veredito é sobre infraestrutura e não sobre o aluno.

Aprovação registrada: ok. Nenhum fluxo de aprovação de saída de IA foi tocado. O cenário `salaProposta` do k6 (`infra/k6/justica-entre-escolas.js:503`) já existia, só é reaproveitado e não aprova nada. Quando a reserva atende, a entrega passa pelo mesmo motor e segue nascendo pendente. A exceção da D47 continua só no Tutor.

Supervisão do tutor: ok. A reserva troca o provedor por trás da porta e não troca o caminho do turno. A execução continua em `execucao_agente`, com escopo e política da turma aplicados no servidor. Nenhum caminho novo deixa o Tutor fora da vista do professor.

Autonomia declarada e visível: sim. A tarefa não muda o nível de nenhum agente, e a governança não foi tocada.

Itens 7, 8 e 9:
- Nada mede navegação, tempo ocioso ou estado emocional. A carga usa só a latência, a contagem por código de erro e o degrau do Prometheus.
- Nada mede o professor e não há ranking.
- Nenhuma tela, prompt ou campo propõe nota em discursiva ou redação.

Bloqueantes: nenhum.

Recomendações:
- A palavra "aprovação" aparece em dois sentidos. O controle negativo `falso-sem-aprovacao` e a mensagem "reserva sem aprovação" se referem a `MODELOS_APROVADOS`, a elegibilidade do modelo. Na regra 70, aprovação é a de uma pessoa sobre uma saída de IA. Vale dizer "reserva sem modelo elegível" ou "não homologada" nas mensagens, no runbook e no teste, para quem ler a auditoria ou o dossiê não confundir as duas. Os pontos estão em `infra/scripts/carga.ts` (`PROVEDOR_DA_RESERVA_SEM_APROVACAO` e as mensagens de `encerrarAReserva`) e em `docs/runbook.md` ("Rodar a carga da queda do principal").
- A mudança em `packages/core/src/config/llm-config.test.ts` só ajusta o teste da 1.0 aos novos nomes `RESERVA_DA_CARGA_*`. O teste continua provando que o `.env.example` não liga a reserva. Fica registrado que a regra 70 não depende dele.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-22 23:46:37 · `tasks/prd-reserva-e-avaliacao/9_task.md`

VEREDITO: APROVADO
Caminho quente tocado: IA (só o cenário de carga e o compose de carga; nenhuma linha de produção mudou)
Rate limit: ok (não mudou; o k6 da `reserva` mantém `respostas_429{grupo} count==0` e um usuário próprio por escola)
Fila e prioridade: ok
Concorrência: protegida (as dez escolas são preparadas em paralelo no mesmo `pg.Client`, sem transação, e o cliente põe as queries em fila; a corrida roda dentro de `flock /tmp/educa-carga.lock`)
Índice e paginação: ok (as consultas novas leem as escolas sintéticas de `execucao_agente` e não são query de produto)
Degradação de IA: ok (5xx, prazo, 429 e balde cheio caem na reserva falsa sem `IA_INDISPONIVEL`; na janela do prazo o que passa é só `IA_TEMPO_ESGOTADO` tipado; o controle negativo reprova pelo indisponível nas janelas `5xx` e `429`; a carga recusa adaptador principal ou de reserva que não seja o `falso`)
Migration: não se aplica
Métrica e alerta: ok (nenhum alerta novo; o veredito lê `ia.degradacao{degrau="provedor_de_reserva"}` e `{degrau="espera"}`; o runbook ganhou a seção "Rodar a carga da queda do principal")
Bloqueantes: nenhum
Recomendações:
- A corrida verde (22/11, 22:32) e o controle negativo rodaram com load de 1 minuto em 4,24, acima da referência de ~2. Isso já está declarado em `docs/runbook.md`. Repita `carga:reserva` com a máquina calma antes de usar o resultado como registro de piloto. O critério compara cada janela com o `controle` da mesma corrida, então a prova de hoje continua valendo.
- O contador da reserva por janela pode, em tese, herdar o valor da janela anterior. A leitura do Prometheus em `infra/scripts/carga.ts` (`degrauNaJanela` e `medirAsJanelas`) começa 5 s antes da janela. Já o contêiner antigo pode parar até a 65ª s do intervalo de 70 s: 45 s de espera mais até 20 s de graça. Se ele for raspado nesse trecho, o `max_over_time` soma o contador da janela anterior, e um `reserva_nao_atendeu` pode passar sem ter ocorrido. Os números da corrida (260, 240, 260 e 100, e o 0 no controle negativo) mostram que isso não aconteceu agora. Para eliminar o risco, faça a leitura começar no fim da troca do worker em vez de 5 s antes, ou filtre a série pelo id do contêiner.
- O contador `tempos_esgotados_sala` do k6 tem nome de `sala`, mas só existe na fase `reserva`. Vale renomear para ficar mais claro.

Conferi: `infra/test/carga.test.ts` passa nos 78 testes, e o caso "carga liga a falsa" de `packages/core/src/config/llm-config.test.ts` também passa. O caso de integração `infra/test/carga-da-manha.int.test.ts` eu não rodei.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-22 23:46:54 · `tasks/prd-reserva-e-avaliacao/9_task.md`

VEREDITO: REPROVADO
Escopo: incompleto (a 9.3 está marcada como feita, mas a corrida não vale como registro)
Aderência à Tech Spec: ok. As quatro divergências (cinco janelas com troca de worker, o `controle` como referência da `sala`, os nomes `RESERVA_DA_CARGA_*`, o balde a 1,2 milhão) estão em `techspec.md` §7c e em `cenarios.md` §5, além do `9_task.md`.
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

Bloqueantes:

1. **A corrida que fecha a 9.3 não vale como registro pela regra do próprio projeto.**
   - **Onde:** `tasks/prd-reserva-e-avaliacao/9_task.md:81`, `docs/runbook.md:2006`, e as linhas de carga da tabela "Testes que provam a regra" (`9_task.md:49-53`).
   - **O que está errado:** o load de 1 minuto era 4,24 antes da corrida 3, com outras linhas usando a máquina. O `docs/runbook.md:2014-2017` diz que a rodada "só entra como registro de tarefa, de correção ou de validação" com a condição 1 cumprida. A linha que esta tarefa escreveu no runbook diz o mesmo: "Vale como registro com a primeira condição da seção seguinte (máquina calma)". Para fugir disso, a tarefa criou um "registro de piloto" que o runbook não tem.
   - **Por que o argumento da "mesma corrida, mesmo minuto" não segura:** as janelas estão a 100 s umas das outras. O `429` começa uns 6,7 min depois do `controle`. Ruído de outro andar em uma janela e não na outra infla ou esconde a diferença de p95, que é justamente o critério do RF3.
   - **Precedente:** a 9.0 de `ingestao-do-material` foi reprovada pelo mesmo motivo (`tasks/prd-ingestao-do-material/achados/9_task.md:258`).
   - **Correção exigida:** pedir a vez ao Orquestrador e repetir `flock /tmp/educa-carga.lock npm run carga:reserva` e `npm run carga:reserva:controle-negativo` com a máquina calma (load abaixo de ~2 e `docker ps` vazio, os dois anotados ao lado dos números). Depois, trocar a tabela da corrida no `9_task.md` e no `docs/runbook.md`, e a coluna "Caso" das linhas de carga. Os vermelhos 1 e 2 continuam escritos.

Recomendações:
- **Tabela vazia:** `9_task.md:481-484` tem a tabela "Recomendações sem aplicar" vazia, mas a linha 81 diz "Fica como recomendação, sem aplicar". Ou a recomendação entra na tabela, ou o texto sai.
- **Controle negativo, "e" contra "ou":** o `docs/runbook.md` diz que ele só sai verde se reprovar "pelo `IA_INDISPONIVEL` das janelas `5xx` e `429`". Já o `reprovadoPeloIndisponivel` (`infra/scripts/carga.ts`, uso de `.some`) aceita uma das duas. Alinhe o texto ao código, ou exija as duas.
- **Duração no runbook:** a seção nova diz "Leva uns 10 min", mas as corridas registradas levaram 13 min.
- **Variáveis da reserva fora da `sala`:** o `ambienteDaSala` zera as variáveis da reserva, mas o `executar` (fases `base` e `carga`) não passa pelo mesmo filtro. Um shell que exporte `IA_RESERVA_ADAPTADOR` ou `IA_FALHA_FALSA` chega ao `worker-ia` por `${...:-}` do `compose.carga.yml`. Vale aplicar `variaveisDaReserva(undefined, doArquivo)` também no ambiente do `executar`.
- **Comentário solto:** em `infra/scripts/carga.ts`, o comentário de `executarAReserva` ficou acima do `type ComposeCom`, separado da função que ele descreve.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-22 23:49:09 · `tasks/prd-reserva-e-avaliacao/9_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- Caminho feliz: queda por 5xx atendida pela reserva.
- Queda por prazo, com `IA_TEMPO_ESGOTADO` tipado e contado no relatório.
- 429 no meio da aula, quando o provedor de IA recusa por limite.
- Balde cheio no pico, com o transbordo indo à reserva (o caso da escola barulhenta ao lado).
- O limite exato do p95 em relação ao controle, mais 1 ms.
- Janela com poucos turnos, ou sem p95.
- Controle sem referência.
- A `sala` sem reserva, mesmo com o shell exportando as variáveis do worker.
- Controle negativo reprovando pelo indisponível e não pela subida, incluindo o worker que nem sobe.
- Os dois `worker-ia` reconfigurados juntos.
- Isolamento: a leitura da janela fica nas escolas da sala e no intervalo [de, até).
- A reserva da carga é sempre a falsa, nunca provedor pago.
- Queda de rede (`principal:conexao`).

**Cobertos:**
- Todos os de veredito, por unidade em `infra/test/carga.test.ts`. Os nomes citados na tabela existem.
- A leitura por janela e por escola, por comportamento, em `infra/test/carga-da-manha.int.test.ts`. Ele mostra que o que fica antes, depois, na outra escola e na ferramenta não entra.
- A `sala` sem reserva, com `vi.stubEnv`.
- O compose passando as variáveis aos dois workers.
- `exigirReservaFalsa`.
- O caso da 1.0 em `llm-config.test.ts`, refeito com os nomes novos.
- As corridas de carga verde e de controle negativo, registradas com a condição da máquina (load 4,24, não vale como registro de piloto, e o documento diz isso).
- Rodei os três arquivos: 149 e 7 testes, todos verdes. Não há `.skip`, nenhum mock esconde a regra, e a carga não chama provedor pago.
- Falta só a queda de rede (`principal:conexao`): o enunciado não a pede, e ela vai para as recomendações.

**Bloqueantes:**

1. **O worker que não sobe não tem teste no caminho de verdade.** Está em `infra/scripts/carga.ts:1259`, em `encerrarAReserva`: `if (reprovacoes === undefined) return 1`.
   - Quando o worker não sobe com a reserva sem aprovação, `trocarOsWorkersEntreAsJanelas` lança o erro, `reprovacoes` fica `undefined`, e é essa linha que impede o controle negativo de sair 0.
   - A função não é exportada, não tem teste, não tem bloco de mutação e não está na lista do que "só a corrida prova". Trocar por `return 0` não derruba nenhum teste.
   - O teste "o worker que nem subiu reprova por outro motivo" cobre outro caminho: o script segue com zero amostras. O caminho do erro lançado fica sem cobertura, e é justamente o que a 9.2 exige ("não pela subida").
   - Correção: levar o caso `undefined` para uma função pura exportada, por exemplo `codigoDeSaidaDaReserva(reprovacoes: Reprovacao[] | undefined, controleNegativo)`. Testar que `undefined` dá 1 nos dois modos, e abrir um bloco de mutação para essa linha.

2. **A seção "Mutações" está incompleta.** Cláusula nova sem bloco é bloqueante por si.
   - Cláusulas que o teste já pega, mas sem bloco:
     - `carga.ts:409`, o termo `|| fase === 'reserva'` em `ambienteDoFalso`.
     - `carga.ts:900`, o termo `nome === '5xx'` na condição de "sem amostra". Os blocos só tiram `controle` e `429`.
     - `carga.ts:939`, a guarda `if (controleNegativo)`.
     - `carga.ts:957`, o termo `estado = 'falhou'`. O teste de unidade o confere, mas não há bloco.
   - `carga.ts:951`: o mapeamento do p95 `null` só é provado pelo teste `.int`, que a corrida de mutações não alcança. O teste de unidade em `carga.test.ts:374` não confere o retorno. Exige uma asserção (`{ amostras: 0, p95Ms: null }` com `rows: []`, e um p95 numérico) e o bloco.
   - Sem bloco e fora da lista de exceções ("ficam sem bloco") da pergunta 1. Cada uma pede um bloco, ou entra nessa lista com o motivo:
     - `carga.ts:275`, o `semBuild ?`.
     - `carga.ts:969`, `degrauNaJanela`. É exportada e não tem teste nenhum, e é a leitura que prova que a reserva atendeu.
     - `carga.ts:1150`, `esperarAte`.
     - `carga.ts:1430`, a escolha da fase e a validação do `--so`.
     - Os ternários de `descreverReserva`.
     - No k6, `justica-entre-escolas.js`: `:39` (validação da `FASE`), `:41` (`NA_SALA`), `:307` (o intervalo depois da última janela) e `:326` (a escolha entre `sala` e `reserva`).

**Recomendações:**
- **Comando errado no "Como testar".** Está em `9_task.md:91`: `npx vitest run --project infra infra/test/carga.test.ts` diz "No test files found", porque o projeto `infra` só inclui `*.int.test.ts`. O certo é `npx vitest run infra/test/carga.test.ts`.
- **O teste dos 10 min do token promete mais do que confere.** Está em `carga.test.ts:141`.
  - A conta usa o prazo do turno (90 s). Não entra a espera da ferramenta, que o k6 aceita até 170 s, nem a subida do contêiner do k6.
  - No pior caso dá 460 + 170 + 30 = 660 s, acima dos 600 s do token. Hoje passa porque a ferramenta falsa leva 50 s.
  - Usar o maior dos dois prazos, ou reescrever o nome e o comentário do teste.
- **A leitura do degrau no Prometheus não tem margem.** Está em `degrauNaJanela` e `medirAsJanelas`.
  - A janela de leitura começa 65 s depois do fim da carga anterior.
  - O worker antigo pode viver até 45 s de espera + 20 s de graça + o tempo do docker, e os dois têm o mesmo rótulo de instância.
  - Uma coleta tardia dele levaria o contador da janela anterior para a seguinte e esconderia o `reserva_nao_atendeu_<janela>`.
  - Nesta corrida não vazou: o balde leu 100, abaixo dos 260 do 429. Ainda assim é melhor começar a leitura no instante em que o `--wait` da troca retornou.
- **A prova citada para "o worker sobe" é a errada.** Na linha 5 da tabela do controle negativo, a prova citada são os 220 turnos do `controle`, que roda com a reserva desligada. O que prova que o worker subiu com `falso-sem-aprovacao` são os indisponíveis gravados nas janelas `5xx` e `429`.
- **O relatório não tem teste.** `descreverReserva` não é testado, e é onde a 9.2 manda contar o `IA_TEMPO_ESGOTADO`. Um teste da coluna "prazo esgotado" fixaria isso.
- **Nenhuma janela de queda de rede.** O falso aceita `principal:conexao`, e o próprio teste em `carga.test.ts:218` admite esse valor, mas nenhuma janela o usa. Registrar como cenário de borda ainda não coberto.
- **As outras fases não limpam as variáveis da reserva.** Só `ambienteDaSala` deixa vazias `IA_RESERVA_*` e `IA_FALHA_FALSA`. Nos outros cenários que usam `compose.carga.yml`, um shell que as exporte as levaria ao `worker-ia`. Vale conferir `executar()`.
- **A `sala` não confere a idade do token.** `executarASala` ignora a idade que `prepararAsEscolasDaSala` devolve, e o teto de 30 s só vale na fase `reserva`.
- **A corrida ainda não vale como registro.** Ela precisa ser repetida com a máquina calma. Já está registrado, e deve continuar no `TODO.md` ou na validação.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-23 00:53:13 · `tasks/prd-reserva-e-avaliacao/9_task.md`

VEREDITO: APROVADO

Esta é a segunda rodada da tarefa 9.0. Olhei só o que mudou desde a primeira (o diff entre as árvores `74613830` e `373a7e9e`) e as correções da ordem `.processo/ordens/9_task-r1.md` que tocam a regra 20. Não editei nenhum arquivo.

Campos pessoais tocados: nenhum. O diff mexe só no script e no teste da carga, no k6, no `docs/runbook.md`, no `docs/infra.md` e na própria tarefa. Não há migration, DTO, rota nem tela.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: não se aplica. Nenhuma rota nem repository mudou.

Logs: limpos. A linha nova do relatório em `infra/scripts/carga.ts` (em `descreverReserva`) é texto fixo. Os `escrever(...)` mudados no diff, em `trocarOsWorkersEntreAsJanelas` e `encerrarAReserva`, escrevem nome de janela, contagens, p95 e critério de reprovação. Não sai nome, matrícula, resposta nem conteúdo de prompt.

Auditoria: não se aplica. Nenhuma ação da regra 20, item 10, foi tocada.

Envio externo: nenhum. O principal e a reserva seguem no adaptador falso, e o script continua recusando reserva que não seja `falso`. A leitura nova do degrau (`degrauNaJanela`) consulta o Prometheus local do compose de carga e só manda o nome do degrau e um instante. O item 6 fecha um caminho que antes ficava aberto: `ambienteDaBase` agora esvazia as variáveis da reserva e da falha falsa também nas fases `base` e `carga`. Assim, um `IA_RESERVA_ADAPTADOR` exportado no shell não chega mais ao worker. O teste "as fases `base` e `carga` também levam a reserva e a falha falsa desligadas" prova isso e tem bloco em "Mutações".

Seed/fixture: sintético. As dez escolas e as sessões são sintéticas (`ops:sessao-sintetica`). Os stubs novos em `infra/test/carga.test.ts` usam ids `e1`, URL `http://prom` e contagens, sem nenhum dado de pessoa.

Correções exigidas na rodada 1: nenhuma vinda de mim. As que tocam a regra 20 foram feitas:
- **Item 6 (variáveis da reserva pelo shell):** feito, com teste e bloco de mutação.
- **Item 16 ("reserva sem aprovação" virou "sem modelo elegível"):** feito no script, no runbook e no `docs/infra.md`. O valor `falso-sem-aprovacao` foi mantido, como a ordem pedia.
- **Item 17 (falhas de qualquer função):** feito no comentário de `falhasNaJanela`, no relatório e no runbook. As colunas agora deixam claro que um "indisponível" pode não ser do Tutor.
- **Minha recomendação da rodada 1 (`tokens.json` com modo 0o644 numa pasta 0o777):** está na tabela "Recomendações sem aplicar" do `9_task.md`, com destino `TODO.md`. O item já existe em `TODO.md:4106`, vindo da X6. Os tokens são de sessão sintética, num compose descartável que cai no fim da corrida.

Pergunta de fechamento: não muda nesta tarefa. A carga não cria dado de titular real, e o que ela grava em `execucao_agente` é de escolas sintéticas num projeto que é derrubado no fim.

Bloqueantes: nenhum.

Recomendações:
- O texto da ordem (item 6) diz que o `executar` usaria `variaveisDaReserva(undefined, doArquivo)`, e `ambienteDaBase` faz exatamente isso. Fica só a observação de que a `sala` e a `base` agora montam o ambiente em duas funções parecidas. Juntar as duas numa só tiraria o risco de uma divergir da outra mais adiante. Não bloqueia.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-23 00:53:31 · `tasks/prd-reserva-e-avaliacao/9_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. O diff só mexe no script de carga, no k6 da fase `reserva`, nos testes de infra e nos documentos `docs/infra.md`, `docs/runbook.md` e `9_task.md`. Nenhum código grava em `Nota`, e o adaptador falso atende principal e reserva. Todos com autor humano? Não se aplica, porque não há escrita.
Decisão autônoma sobre aluno: ausente.
Aprovação registrada: ok. Nenhum fluxo de saída de IA para o aluno foi criado ou alterado, e a exceção do tutor (D47) não aparece em outro agente.
Supervisão do tutor: ok. O diff não toca sala, casa, registro nem resumo. As colunas novas do relatório contam execuções e falhas por janela, das escolas sintéticas. Não há medida de comportamento, tempo ocioso ou navegação.
Autonomia declarada e visível: sim, nada mudou nesta rodada.

Conferi a correção que veio da minha rodada (item 16 da ordem):
- A mensagem de `encerrarAReserva` agora diz "com a reserva sem modelo elegível" (`infra/scripts/carga.ts:290`).
- O comentário de `codigoDeSaidaDaReserva` (`carga.ts:156`) e o cabeçalho do uso (`carga.ts:44`) também foram trocados.
- No `docs/runbook.md`, "Rodar a carga da queda do principal", o texto agora explica que é a elegibilidade do modelo em `MODELOS_APROVADOS`, "nada a ver com a aprovação de uma pessoa sobre uma saída de IA". O mesmo vale para `docs/infra.md`, no parágrafo que foi movido para os cenários de carga.
- O valor `falso-sem-aprovacao` e a constante `PROVEDOR_DA_RESERVA_SEM_APROVACAO` continuam com o nome antigo, como a ordem mandava.

O resto do diff (itens 1 a 15, 17 e 18) é carga, mutação e texto de operação. Nada disso alcança Nota, aprovação humana, tutor, autonomia, D46 ou D55, nem indicador de professor.

Bloqueantes: nenhum.

Recomendações:
- `infra/test/carga.test.ts:676`: o nome do teste ainda diz "o worker sobe com uma reserva que nenhuma aprovação cobre". A ordem do item 16 pedia a troca também "no teste". Sugestão: "uma reserva sem modelo elegível", no mesmo termo das mensagens. É só texto e não muda a asserção.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-23 00:53:44 · `tasks/prd-reserva-e-avaliacao/9_task.md`

**VEREDITO: APROVADO**

**Escopo:** respeitado.

**Aderência à Tech Spec:** ok. A troca de `.some` por `.every` em `reprovadoPeloIndisponivel` deixa a regra mais rígida que `cenarios.md:123` ("indisponível acima de zero na janela da queda"). Continua reprovando pelo critério e era uma das duas saídas que a recomendação 7 oferecia. Não abre divergência.

**Portão local:** carimbo válido. Cobre typecheck, lint, segredo, dependências, unidade e alvo.

**Bloqueantes:** nenhum.

A correção que eu exigi foi feita. A corrida 5 (23:57 de 22/11) partiu com load de 1 minuto 0,70 e `docker ps` vazio, anotados ao lado dos números. As tabelas foram trocadas em três lugares: `tasks/prd-reserva-e-avaliacao/9_task.md` ("Corridas de carga", item 5), `docs/runbook.md` (a corrida de 22/11) e a coluna "Caso" das cinco linhas de carga. Os vermelhos 1 e 2 continuam escritos, e a corrida 3 ficou marcada como "não vale como registro". A leitura do Prometheus a partir da volta da troca do worker (item 14) entrou antes da repetição, como a ordem pedia.

Conferi os outros itens da ordem no diff, e todos foram atendidos:
- **2:** `codigoDeSaidaDaReserva` trata o `undefined`, tem teste nos dois modos e bloco de mutação.
- **6:** `ambienteDaBase` desliga a reserva nas fases `base` e `carga`.
- **7:** o runbook e o código dizem a mesma coisa: "nas duas" janelas.
- **8 a 13:** a duração (13 min), o comentário de `executarAReserva` de volta acima da função, o comando de "Como testar", o teste dos 10 min do token, a prova na linha do controle negativo e o teste de `descreverReserva`.
- **15 a 18:** o contador `tempos_esgotados_reserva`, "sem modelo elegível" no lugar de "sem aprovação", o aviso de que as falhas contam qualquer função, e o parágrafo movido para a seção de carga em `docs/infra.md`.

Os blocos de mutação dos itens 3 a 5 são do `test-engineer`, e não os reaudito.

**Recomendações:**
1. **O controle negativo partiu acima do limite.** A corrida 6 começou com load de 1 minuto 2,41, acima do "abaixo de ~2" da condição 1 (`docs/runbook.md`, "Quando a carga vale como registro") e do que a correção pedia para as duas corridas. Não reprovo, por três motivos:
   - o veredito dele é contagem, não latência;
   - máquina ocupada não produz `IA_INDISPONIVEL` nas janelas `5xx` e `429` nem zera o degrau `provedor_de_reserva`;
   - o `docker ps` estava vazio e o load era o rastro da própria corrida 5.

   A tarefa declara isso por escrito (`tasks/prd-reserva-e-avaliacao/9_task.md`, item 6 e "Condição da máquina"). Vale escrever no runbook que um controle negativo de contagem aceita o rastro da corrida anterior, ou repeti-lo depois de alguns minutos parado, para a próxima tarefa não reabrir o assunto.
2. **A contagem das corridas está errada.** `tasks/prd-reserva-e-avaliacao/9_task.md:64` diz "Cinco corridas (as três de `npm run carga:reserva` e os dois controles negativos) … em 22/11/2026". A lista tem seis: quatro de `carga:reserva` (1, 2, 3 e 5) e dois controles negativos (4 e 6), e a 6 é de 23/11. Corrigir para "Seis corridas (quatro … e dois …), em 22 e 23/11/2026".
3. **A frase da "Condição da máquina" junta as corridas.** Ela diz que "As corridas 3 e 4 (máquina ocupada) e a 5 deram a mesma coisa" e cita só as diferenças da 5 (+74, +17 e +453 ms). A 3 deu +48, +13 e +443 ms. Pôr os dois conjuntos lado a lado deixaria a afirmação verificável.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-23 00:53:57 · `tasks/prd-reserva-e-avaliacao/9_task.md`

VEREDITO: APROVADO
Caminho quente tocado: IA (só a carga: `infra/scripts/carga.ts`, `infra/k6/justica-entre-escolas.js`; nenhum código de produção mudou nesta rodada)
Rate limit: ok (nada mudou; o limite por pessoa segue como threshold do k6)
Fila e prioridade: ok
Concorrência: protegida (a troca dos `worker-ia` espera a drenagem de 45 s antes de recriar, e a leitura de uma janela termina 20 s depois da carga, antes da troca seguinte)
Índice e paginação: ok (não se aplica: as consultas da carga leem `execucao_agente` por escola e intervalo, sem query nova de produção)
Degradação de IA: ok (a corrida 5, com máquina calma, deu zero `IA_INDISPONIVEL` nas cinco janelas; `provedor_de_reserva` subiu 260, 240, 260 e 100; o controle negativo reprovou nas duas janelas exigidas)
Migration: não se aplica
Métrica e alerta: ok (não há alerta novo; o relatório agora diz que as colunas de falha contam todas as funções)
Bloqueantes: nenhum

O que conferi das correções desta rodada:
- **Item 1 (corrida repetida):** a corrida 5 teve load de 1 minuto 0,70 e `docker ps` vazio. Esses números estão anotados em `tasks/prd-reserva-e-avaliacao/9_task.md` e em `docs/runbook.md`.
- **Item 14 (leitura do Prometheus):** `inicioDaLeituraDaJanela` faz a leitura começar quando o `--wait` da troca volta. O contêiner antigo já parou nesse instante, e o novo só nasce pelo menos 45 s depois do fim da carga, enquanto a leitura fecha aos 20 s. A série de um contêiner não entra na janela de outro.
- **Item 2:** `codigoDeSaidaDaReserva(undefined, ...)` devolve 1 nos dois modos e tem teste e bloco de mutação.
- **Item 7:** o `.every` agora bate com o runbook ("nas duas").
- **Item 6:** `ambienteDaBase` deixa a reserva e a falha falsa vazias nas fases `base` e `carga`, mesmo com o shell exportando essas variáveis, e tem teste.
- Os 79 testes de `infra/test/carga.test.ts` passam.

Recomendações:
- `tasks/prd-reserva-e-avaliacao/9_task.md:64` ainda diz "Cinco corridas (as três de `npm run carga:reserva` e os dois controles negativos)". Agora são seis: quatro da fase e dois controles negativos. É preciso atualizar a contagem.
- O controle negativo (corrida 6) partiu com load 2,41, acima da referência de ~2. Isso não muda o veredito: o resultado é de contagem, não de latência, o degrau ficou em 0 em todas as janelas e houve 260 indisponíveis na `5xx` e no `429`. Mesmo assim, a próxima corrida de registro deve esperar o load de 1 minuto baixar antes de começar.

## test-engineer · 2ª rodada · REPROVADO · 2026-11-23 00:54:03 · `tasks/prd-reserva-e-avaliacao/9_task.md`

VEREDITO: REPROVADO

**Cenários exigidos (9.0, a queda do principal):**
- queda por `5xx`, por prazo e por `429`, sem aluno sem resposta, com o p95 até 1 s acima do controle
- balde cheio que transborda à reserva
- controle negativo que reprova pelo indisponível das janelas de queda, e não pela subida
- fase que não terminou porque o worker não subiu
- `sala`, `base` e `carga` sem reserva, mesmo com o shell exportando as variáveis dela
- leitura do degrau no Prometheus sem herdar a série do worker antigo
- relatório com a coluna "prazo esgotado"

**Cobertos (rodada 2: o diff `74613830..373a7e9e` e as cinco correções exigidas):**
1. **O worker que não sobe está feito.** `codigoDeSaidaDaReserva` aceita `undefined` e devolve 1 (`infra/scripts/carga.ts:940`). O teste "a fase que não terminou, porque o compose ou o worker não subiu, sai 1 também no controle negativo" confere os dois modos, e há bloco `return 1` → `return 0`.
2. **Os quatro termos sem bloco estão feitos.** Cada um agora tem bloco, e o teste citado derruba o mutante:
   - `|| fase === 'reserva'`: o teste das durações tem `toEqual(ambienteDoFalso('sala'))`.
   - `nome === '5xx'`: `sem_amostra_5xx` está em `carga.test.ts:738`.
   - `if (controleNegativo)`: `codigoDeSaidaDaReserva(reprovacoes, true)` deve dar 0, em `:810`.
   - `estado = 'falhou'`: em `:849`.
3. **O p95 `null` está feito.** O teste novo "o turno do Tutor e as falhas da janela viram o que o banco devolve" confere `rows: []`, `p95: null` e um p95 numérico. Os dois blocos (`Number(linha?.p95)` e `?? 1`) caem nele.
4. **Os trechos sem bloco estão feitos.**
   - `degrauNaJanela` tem teste com `fetch` falso e três blocos: `increase`, `inicio` e `Math.max(1, …)`.
   - `inicioDaLeituraDaJanela` tem dois blocos.
   - `faseDaLinhaDeComando` tem quatro blocos.
   - `ambienteDaBase` tem dois blocos.
   - Os ternários de `descreverReserva` têm três blocos.
   - O k6 tem os blocos `:39`, `:41`, `:307` e `:326`, presos ao texto do script pelo `toContain`.
   - `esperarAte`, o `semBuild ?` e a linha final do `--so` entraram em "ficam sem bloco", com motivo aceitável.
5. **O resto confere.** `npx vitest run infra/test/carga.test.ts` passou: 79 testes, nenhum `.skip`. O adaptador é sempre o falso. As corridas 5 e 6 foram refeitas com a máquina calma, e o load e o `docker ps` estão anotados.

**Bloqueantes:**
- **`infra/scripts/carga.ts:934`: a troca de `.some` por `.every` em `reprovadoPeloIndisponivel` não tem bloco em "Mutações".**
  - É a cláusula nova desta rodada (ordem, item 7: o controle negativo exige o indisponível nas duas janelas). O teste novo "o controle negativo exige o indisponível nas duas janelas de queda, e o de uma só não basta" (`infra/test/carga.test.ts:800`) a prova.
  - O único bloco da linha (`9_task.md:420`) só troca o critério para `startsWith('indisponivel_')`. Não volta o `.every` para `.some`, que é justamente o que a correção mudou.
  - Correção exigida: abrir em `tasks/prd-reserva-e-avaliacao/9_task.md` o bloco abaixo, citando o teste da linha 800.
    ```
    -return JANELAS_DO_CONTROLE_NEGATIVO_DA_RESERVA.every((nome) => reprovacoes.some((reprovacao) => reprovacao.criterio === `indisponivel_${nome}`))
    +return JANELAS_DO_CONTROLE_NEGATIVO_DA_RESERVA.some((nome) => reprovacoes.some((reprovacao) => reprovacao.criterio === `indisponivel_${nome}`))
    ```

**Recomendações:**
- **`infra/scripts/carga.ts:1290`, `encerrarAReserva`.** A guarda `if (reprovacoes === undefined) return codigo` sobrou. A decisão já está na função pura testada. Mesmo assim, trocar esse retorno por `return 0` não derruba teste nenhum. Há duas saídas:
  - inverter a guarda (`if (reprovacoes !== undefined) { …escreve… }` e depois `return codigo`), para não sobrar um retorno mutável;
  - ou pô-la em "ficam sem bloco", com o motivo: ela só estreita o tipo para a escrita.
- **Tabela "Testes que provam a regra".** Os testes novos de unidade do controle negativo não aparecem em linha nenhuma: a fase que não terminou e as duas janelas exigidas. Vale citá-los, ao lado da linha de carga do controle negativo.

Arquivos citados:
- `infra/scripts/carga.ts`
- `infra/test/carga.test.ts`
- `tasks/prd-reserva-e-avaliacao/9_task.md`

## llm-integrator · 2ª rodada · APROVADO · 2026-11-23 00:54:18 · `tasks/prd-reserva-e-avaliacao/9_task.md`

VEREDITO: APROVADO

Perfis usados: nenhum. A tarefa roda a carga com o adaptador falso, principal e reserva. O script recusa `RESERVA_DA_CARGA_ADAPTADOR` diferente de `falso`. Nenhuma chamada de modelo nova entra no produto.

Custo estimado por professor/mês: R$ 0. Não há chamada nova a provedor pago, nem na carga, nem nos testes. O custo real da reserva continua pendente na 14.0 (contratado real de tokens por minuto).

Prompt versionado: não se aplica. O diff não toca prompt.

Validação de schema: não se aplica. O diff não toca saída de modelo.

Aprovação humana no caminho: não se aplica. O diff é ferramenta de carga e documentação, sem nota, sem entrega de agente e sem saída ao aluno. A mudança de texto do item 16 tira "aprovação" do sentido de elegibilidade do modelo, e a regra 70 ganha com isso.

Os 18 itens da ordem, conferidos contra o diff:

- **Item 1, corrida repetida com máquina calma:** feita.
  - A corrida 5 partiu com load 0,70 e `docker ps` vazio. Os p95 saíram 6.128 / 6.202 / 6.145 / 6.581 / 14.086 ms, e a tabela do `9_task.md` e a do runbook foram trocadas. A corrida 3 ficou escrita como "não vale", sem apagar.
  - O controle negativo (corrida 6) partiu com load 2,41, acima do "~2" da condição 1. O texto declara isso, e o veredito dele é de contagem de indisponíveis, sem latência. CPU disputada só faria o controle reprovar mais, então não produz falso verde. Aceito, mas está em recomendação.
- **Item 2, worker que não sobe:** `codigoDeSaidaDaReserva` agora recebe `undefined` e devolve 1 nos dois modos, com teste e bloco de mutação.
- **Itens 3 a 5, blocos faltantes:** o `9_task.md` passou de 50 para 75 blocos. Cobrem `ambienteDoFalso`, o `5xx` da amostra, `if (controleNegativo)`, `estado = 'falhou'`, o p95 `null`, `degrauNaJanela`, `faseDaLinhaDeComando` e os quatro trechos do k6. Também cobrem `inicioDaLeituraDaJanela`, o relatório e `ambienteDaBase`.
  - Entraram na lista do "só a corrida prova", com o motivo: `esperarAte`, o `semBuild ?`, a linha final do `--so=reserva` e `trocadasEmMs`.
  - O teste de `carga.test.ts` do p95 agora afirma o retorno.
- **Item 6:** `ambienteDaBase` aplica `variaveisDaReserva(undefined, …)` nas fases `base` e `carga`. O teste exporta as variáveis no shell e confere que chegam vazias.
- **Item 7:** `reprovadoPeloIndisponivel` passou de `.some` para `.every`, com teste de uma janela só. O runbook diz "nas duas".
- **Item 8:** o runbook diz "uns 13 min".
- **Item 9:** o comentário de `executarAReserva` ficou acima da função.
- **Item 10:** o comando de "Como testar" foi corrigido. Rodei `npx vitest run infra/test/carga.test.ts` e deu 79 testes verdes.
- **Item 11:** a conta dos 10 min usa a ferramenta de 50 s, o passo da consulta e a idade do token: 460 + 50 + passo + 30 abaixo de 600. Há uma asserção de que o prazo da ferramenta no k6 é maior que a latência.
- **Item 12:** a linha do controle negativo passou a citar os indisponíveis das janelas `5xx` e `429` como prova de que o worker subiu.
- **Item 13:** há teste de `descreverReserva` com a coluna "prazo esgotado", o `-`, o "não lido" e o limite da queda.
- **Item 14:** a leitura do Prometheus começa na volta do `--wait` da troca (`trocadasEmMs`), por `inicioDaLeituraDaJanela`. Há teste e blocos. O contador do worker antigo não entra mais na janela seguinte.
- **Item 15:** o contador do k6 virou `tempos_esgotados_reserva`, com o bloco, o teste de leitura e o comentário acompanhando.
- **Item 16:** as mensagens passaram a dizer "sem modelo elegível". O valor `falso-sem-aprovacao` ficou como estava.
- **Item 17:** o comentário de `falhasNaJanela`, uma linha no relatório e o runbook dizem que as falhas são de qualquer função.
- **Item 18:** o parágrafo da carga saiu do bloco do balde em `docs/infra.md` 5.4 e foi para a seção de carga, na linha 519.

Bloqueantes: nenhum.

Recomendações:
1. `infra/k6/justica-entre-escolas.js:107` e `infra/scripts/carga.ts:139`: nenhum teste liga o nome do contador declarado no k6 ao nome que o `carga.ts` lê. Os testes conferem só o lado do `carga.ts`. Se um lado for renomeado sozinho, o relatório mostra "0 execuções com IA_TEMPO_ESGOTADO" sem avisar. Basta um `expect(roteiro()).toContain("new Counter('tempos_esgotados_reserva')")` no teste do k6 da `reserva`. O número que julga a janela sai do banco, então não bloqueia.
2. Corrida 6 (controle negativo) com load 2,41. Se for repetida por outro motivo, vale rodar com load abaixo de 2, para não depender da justificativa escrita.
3. Os arquivos `carga.ts` e o k6 têm mtime de 00:51, depois das duas corridas, e não consegui dizer se a causa foi edição ou restauração pelo runner de mutações. Se foi edição, a árvore final não é exatamente a corrida, e o `9_task.md` deveria dizer quais mudanças vieram depois. As mudanças do item 15, o nome do contador no k6 e no `carga.ts`, são consistentes entre si por inspeção.
4. Sobram os `TODO.md` já combinados na ordem: `tokens.json` com 0o644, a janela de queda de rede e a idade do token na `executarASala`.

Arquivos relevantes, todos em `.`:
- `infra/scripts/carga.ts`
- `infra/k6/justica-entre-escolas.js`
- `infra/test/carga.test.ts`
- `docs/runbook.md`
- `docs/infra.md`
- `tasks/prd-reserva-e-avaliacao/9_task.md`

## test-engineer · 3ª rodada · APROVADO · 2026-11-23 01:07:31 · `tasks/prd-reserva-e-avaliacao/9_task.md`

VEREDITO: APROVADO

**Cenários exigidos (rodada 3, só a correção):** o bloco de mutação que volta o `.every` para `.some` em `reprovadoPeloIndisponivel`, mais as duas recomendações da rodada 2.

**Cobertos:**
- **O bloco novo bate com o código e com o teste.** O `-return …every(…)` copia letra por letra a linha 934 de `infra/scripts/carga.ts`. O teste citado tem o nome exato e está em `infra/test/carga.test.ts:800`. Com o `.some`, a asserção da linha 801 espera `false` para "indisponível só na `5xx`" e recebe `true`. O teste fica vermelho pela cláusula certa, sem erro de carga.
- **A contagem de blocos confere.** A seção "Mutações" tem 76 blocos, como dizem a pergunta 1 e a abertura da seção.
- **A justificativa de `encerrarAReserva` em "ficam sem bloco" vale.** A função não é exportada. O código de saída vem de `codigoDeSaidaDaReserva` (linhas 938 a 943), e cada uma das três decisões dela tem bloco: o `undefined`, o `if (controleNegativo)` e o `.every`. As mensagens são texto que a corrida mostra.
- **A tabela "Testes que provam a regra" ganhou a linha do controle negativo de unidade.** Os quatro testes que ela cita existem em `infra/test/carga.test.ts`, nas linhas 795, 800, 806 e 817.
- **Os testes passam na árvore de agora.** `npx vitest run infra/test/carga.test.ts -t "controle negativo"` deu 16 passaram e nenhum falhou.
- **Só o documento mudou.** O diff entre as duas árvores toca apenas `9_task.md`, então o código e os testes auditados na rodada 2 seguem como estavam. As correções de texto ("Seis corridas" e os deltas da corrida 3 e da 5) não mexem em teste.

**Bloqueantes:** nenhum.

**Recomendações:**
- **A frase sobre a guarda não está exata.** O motivo diz que `if (reprovacoes === undefined) return codigo` (`infra/scripts/carga.ts:1290`) "só estreita o tipo para a escrita". Sem a guarda, a fase que não terminou chega a `reprovacoes.length` na linha 1291 e lança `TypeError`, ou seja, o processo quebra em vez de escrever. O código de saída continua diferente de zero, então o resultado não muda e não é bloqueante. Vale reescrever a frase para dizer isso: sem a guarda o processo quebra e sai com código diferente de zero de qualquer jeito.
