# Achados das revisões — `tasks/prd-reengenharia-continuacao/11_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## llm-integrator · 1ª rodada · APROVADO · 2026-11-16 20:47:41 · `tasks/prd-reengenharia-continuacao/11_task.md`

VEREDITO: APROVADO

Perfis usados: o `rapido` (turno do Tutor, 6 s no falso) e o `padrao` (ferramenta e proposta do Assistente, 50 s no falso). Nenhuma chamada nova foi acrescentada ao produto. A tarefa só mede a carga com o adaptador falso (`IA_ADAPTADOR=falso`) e nunca chama provedor pago.

Custo estimado por professor/mês: a tarefa não cria chamada de modelo, então não há custo novo. O que ela mediu serve de base para a precificação. No pico, uma professora gera cerca de 2,5 pedidos de IA por minuto, o que dá 9 a 10 mil tokens por minuto de uso (626 mil tokens das 20 professoras em cerca de 3 minutos). O custo em reais depende do preço do modelo real e fica para a D37. O `TODO.md` registra isso e também a escolha entre os dois pisos de contrato, 2,5 milhões (premissa 3.000 + 250 tokens) e 3,7 milhões (premissa 5.000 + 300) de tokens por minuto. Faltou apenas converter isso em um valor por mês, mas é recomendação, não bloqueante.

Prompt versionado: não se aplica. A tarefa não mexe em prompt.

Validação de schema: não se aplica. A configuração nova (`IA_LATENCIA_FALSA_MS_PADRAO`, `IA_TOKENS_FALSOS_ENTRADA` e `IA_TOKENS_FALSOS_SAIDA`) é validada pelo schema zod de `llmEnvSchema`. A latência do `padrao` é conferida contra `LLM_TIMEOUT_MS_PADRAO`, e os tokens ficam entre 0 e 1 milhão.

Aprovação humana no caminho: não se aplica. Nenhuma entrega de agente é criada ou alterada. A fase `sala` mede fila, espera e o `kill -9`, sem gravar nota nem mensagem à família.

Verificações feitas:
- **SDK de provedor fora do adaptador:** as mudanças ficam em `fake-adapter.ts`, `llm-config.ts` e `llm-gateway.ts`. O ramo do provedor continua sendo só o `OpenAICompatAdapter`, e a latência e os tokens falsos só chegam ao `FakeAdapter`.
- **Provedor pago:** `exigirAdaptadorFalso` em `infra/scripts/carga.ts:401` recusa qualquer adaptador que não seja o falso, nas duas fases (`:791` e `:839`). O falso continua proibido em `AMBIENTE=producao` (`llm-config.ts:129`).
- **Testes sem provedor pago:** rodei os testes do falso, da configuração e do gateway (`fake-adapter.test.ts`, `llm-config.test.ts`, `llm-gateway.test.ts`), 153 testes verdes. O `tools/ci/ambiente.test.ts` também passou, 16 verdes, o que confirma que as três variáveis novas estão no compose (com `:?`) e no `.env.example`.
- **Orçamento e teto:** `LLM_TOKENS_POR_MINUTO=1950000` em `infra/carga.env` é só da carga e fica abaixo da carga de 1,625 milhão por minuto na escala do falso (balde de 80 %, 1,56 milhão). A corrida mostrou o balde recusando reservas (93 esperaram) sem nenhum "indisponível". O número está explicado em `infra/carga.env`, em `docs/infra.md` e no `TODO.md`, e não vai para produção.
- **Registro e idempotência:** a fase prova o `kill -9` no `worker-ia-1`. Foram 21 `EXECUCAO_INTERROMPIDA`, abaixo do teto de 60, nenhuma outra falha, e as perguntas seguintes rodaram.

Bloqueantes: nenhum.

Recomendações:
- `docs/infra.md`: acrescentar uma linha com o custo em reais por professor por mês, assim que a D37 trouxer o preço do modelo. Hoje o texto só dá tokens por minuto.
- `docs/infra.md`: a premissa de 1 ferramenta por minuto por escola segue sem fonte, como o texto já diz. A fase `sala` só mostra que o desenho aguenta esse ritmo.
- A máquina não estava calma na corrida (load de 3 a 5 e outras pilhas de pé). O resultado passou com folga de duas ordens de grandeza e vale como conservador. A repetição já está no `TODO.md`.
- `llm-config.ts`: o schema aceita `IA_TOKENS_FALSOS_*` em qualquer `AMBIENTE`, igual à latência falsa que já existia. Isso é inofensivo, porque só o adaptador falso os lê e ele é vedado em produção. Se quiser, o `superRefine` poderia recusar essas variáveis quando `IA_ADAPTADOR` não for `falso`.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-16 20:47:44 · `tasks/prd-reengenharia-continuacao/11_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration nesta tarefa. A semeadura sintética da sala em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/infra/scripts/carga.ts` (l.524-559) grava `escola_id` em `ano_letivo`, `serie`, `turma`, `disciplina`, `material`, `material_serie`, `trecho` e `vinculo`, e grava `ano_letivo_id` em `turma` e `vinculo`. Os ids são UUID, gerados pelo banco ou com cast `uuid[]`.

Queries verificadas:
- **Medida da sala** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/infra/scripts/carga.ts` l.566-575): cada subconsulta em `job_registro` e `execucao_agente` filtra por `j.escola_id = e.id` / `x.escola_id = e.id`.
- **Jobs ativos lidos antes do `kill -9`, falhas por erro e consumo de IA** (mesmo arquivo, l.597, 603-604, 612-614): todas filtram por `escola_id = any($1)`, com a lista das escolas sintéticas que o próprio script criou.
- **Vínculos semeados** (l.548-559): `usuario.escola_id = $1` em todos.

São rotinas de operação nossas, fora de `apps/api`. Não há repository novo, endpoint novo nem `@Unscoped()` novo. O k6 (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/infra/k6/justica-entre-escolas.js`) só chama rotas existentes (`/v1/execucoes/:id`, `/v1/ferramentas/:ferramenta/gerar`, `/v1/assistente/mensagens`). Cada escola usa os tokens das sessões dela, e nenhum `escolaId` vai no corpo ou na query string.

As mudanças em `llm-config.ts`, `fake-adapter.ts` e `llm-gateway.ts` (latência do perfil `padrao` e tokens informados pelo adaptador falso) não mexem em escopo de escola.

Teste de isolamento: presente e efetivo. A tarefa não cria módulo de domínio, então o item 5 da regra 10 não exige um teste novo. Mesmo assim, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/infra/test/carga-da-manha.int.test.ts` (l.76-99) prova que a espera p95 de uma escola não leva o job de 7 s da outra. Sem `j.escola_id = e.id`, o p95 da escola A passaria a incluir esse job, e o teste quebraria.

Bloqueantes: nenhum

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/infra/scripts/carga.ts` l.548: o autor dos vínculos é escolhido com `order by id limit 1`, que é arbitrário. Vale um comentário dizendo que qualquer professora da mesma escola serve.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-16 20:48:00 · `tasks/prd-reengenharia-continuacao/11_task.md`

VEREDITO: APROVADO

Esta tarefa é só da carga da manhã (a `FASE=sala`, o `kill -9` num `worker-ia`, a latência por perfil e os tokens que o adaptador falso informa). Nenhum caminho da regra 70 mudou. `apps/`, `docs/regulacao.md` e `.claude/rules/` ficaram como estavam.

- **Caminhos de escrita em Nota:** nenhum novo. A carga (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/infra/scripts/carga.ts`, `semearEscolaDaSala`) e o teste novo (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/infra/test/carga-da-manha.int.test.ts`) gravam só ano letivo, série, turma, disciplina, material, trecho, vínculo, `job_registro` e `execucao_agente`. Nenhum dos dois grava `nota`. Todos com autor humano? Sim, porque não há escrita em Nota.
- **Decisão autônoma sobre aluno:** ausente.
- **Aprovação registrada:** ok. O k6 (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/infra/k6/justica-entre-escolas.js`, `salaFerramenta` e `salaProposta`) só pede à ferramenta e ao Assistente pelas rotas normais (`/v1/ferramentas/atividade_objetiva/gerar`, `/v1/assistente/mensagens`) e espera a execução terminar. Ele nunca aprova o que foi gerado, então a entrega continua pendente pelo fluxo de sempre. A exceção da D47 não passou para outro agente.
- **Supervisão do tutor:** ok. O turno passa pela rota de verdade (`POST /v1/tutor/mensagens`), sem atalho que fuja do registro.
- **Autonomia declarada e visível:** sim, sem mudança. Nenhum agente novo e nenhum nível alterado.
- **Discursiva e redação (D55):** nada novo. A ferramenta que a carga usa é a atividade objetiva.
- **Vigilância e medir o professor:** nada novo. As medidas são de infra (espera p95 por escola e por fila, RSS, pool, balde de tokens), agregadas por escola sintética. Não há inferência emocional nem métrica nominal de professor.
- **Mudanças no `core`:** a latência e os tokens novos do `FakeAdapter`, a configuração em `llm-config.ts` e o repasse em `llm-gateway.ts` são só do adaptador falso e não tocam nota, aprovação, auditoria nem governança. O script também recusa qualquer adaptador que não seja o falso (`exigirAdaptadorFalso`).

Bloqueantes: nenhum.

Recomendações:
1. "Custo de base por professor" aparece no `TODO.md` e no relatório de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/infra.md` §3.2. Hoje é uma média de custo de infra sobre 20 professoras sintéticas e está certo assim. Quando o custo em reais entrar com a D37, vale deixar escrito que é unidade de custo agregada. Ele não pode virar indicador por professor, que esbarra na regra 70 itens 8 e 9 e na D45.
2. `semearEscolaDaSala` (`carga.ts`) grava o vínculo do aluno já `confirmado`, direto no banco, com uma professora sintética como `criado_por`. No cenário sintético isso é aceitável. Um comentário dizendo que é atalho só da carga e não o caminho da D4 evita que alguém copie o padrão para seed ou importação. Quem decide isso é o `privacy-guardian` ou o `tenancy-guardian`, não esta regra.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-16 20:48:07 · `tasks/prd-reengenharia-continuacao/11_task.md`

VEREDITO: APROVADO

A tarefa 11.0 é carga de infraestrutura com o adaptador falso e dado sintético. Ela não cria campo de pessoa, rota, DTO, log de conteúdo nem envio para provedor externo. Nenhum item da regra 20 foi violado.

Campos pessoais tocados: nenhum campo novo. As variáveis novas (`IA_LATENCIA_FALSA_MS_PADRAO`, `IA_TOKENS_FALSOS_ENTRADA`, `IA_TOKENS_FALSOS_SAIDA`) só configuram o adaptador falso (`packages/core/src/config/llm-config.ts`, `packages/core/src/ia/fake-adapter.ts`). Elas mudam quanto o falso demora e quantos tokens ele informa, e não mudam o que vai na chamada.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: não se aplica. Não há rota nova. O k6 usa `/v1/tutor/mensagens` e a rota da ferramenta, com sessões sintéticas de cada escola.

Logs: limpos. O relatório de `infra/scripts/carga.ts` mostra contagens, códigos de erro agrupados (`group by erro`), percentis, RSS e tokens por função. As escolas aparecem como `e1` a `e10`. O k6 não tem nenhum `console.*`. O `compose logs --tail 100` em caso de falha só mostra o que os serviços já registram, e esses registros seguem as guardas de log.

Auditoria: não se aplica. A tarefa não tem leitura de dado de aluno por coordenação ou rede, nem exportação, nota, permissão ou aprovação de saída de IA.

Envio externo: nenhum. `exigirAdaptadorFalso` (`infra/scripts/carga.ts:401`) recusa qualquer adaptador que não seja o falso, e `ambienteDaSala` e o ambiente das fases de sempre forçam `IA_ADAPTADOR: 'falso'`, sem deixar entrar o que o shell exporta. Em `adaptadorInterno` (`packages/core/src/ia/llm-gateway.ts:541`), com modelo configurado, a chamada vai ao `OpenAICompatAdapter` e as opções do falso não chegam a ele.

Seed/fixture: sintético.
- `prepararAsEscolasDaSala` e `idDoOpsEscola` criam "Rede sintética da carga da manhã", "Escola sintética eN", as turmas "2ºSn sintética da sala" e um material de Química escrito para o teste.
- A pergunta do aluno no k6 é "Pergunta sintética de carga sobre o assunto da aula.".
- `infra/test/carga-da-manha.int.test.ts` grava aluno sem e-mail ("Aluno da carga"). A professora tem e-mail `professora-<uuid>@carga.invalid`, que é domínio reservado, e o teste apaga tudo no `afterAll`.
- Nenhum dump nem dado real.

Bloqueantes: nenhum.

Recomendações:
- O `tokens.json` da sala (`infra/scripts/carga.ts`, `prepararAsEscolasDaSala`, `chmodSync(..., 0o644)`) fica numa pasta temporária com permissão 0777, como já fazia a fase de sempre, para o contêiner do k6 conseguir ler. São sessões sintéticas de um compose descartável, então não bloqueia. Se a carga um dia rodar fora da máquina de desenvolvimento, vale apagar a pasta no `finally` e não deixá-la legível por todos.
- `IA_TOKENS_FALSOS_*` e `IA_LATENCIA_FALSA_MS_PADRAO` existem em todo ambiente (`.env.example`, `infra/compose.yml`), com zero por padrão. Hoje o `MOTIVO_ADAPTADOR_FALSO_EM_PRODUCAO` já impede o falso em produção. Um caso de teste mostrando que essas variáveis, preenchidas com o `openai_compat`, não chegam a nenhum adaptador real deixaria isso escrito.

Pergunta de fechamento: a tarefa não muda o que o sistema guarda sobre um aluno nem para onde isso vai. O arquivo do titular e o `ExecucaoAgente` continuam respondendo como antes.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/infra/scripts/carga.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/infra/k6/justica-entre-escolas.js
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/infra/test/carga-da-manha.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/fake-adapter.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/llm-gateway.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/config/llm-config.ts

## infra-guardian · 1ª rodada · REPROVADO · 2026-11-16 20:48:40 · `tasks/prd-reengenharia-continuacao/11_task.md`

```
VEREDITO: REPROVADO
Caminho quente tocado: IA | deploy
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ok
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/infra/compose.yml:548-550
  O que está errado: o `worker-ia` agora lê `IA_LATENCIA_FALSA_MS_PADRAO`, `IA_TOKENS_FALSOS_ENTRADA` e `IA_TOKENS_FALSOS_SAIDA` com `:?`. O `.env` da produção não tem essas três variáveis. No primeiro deploy pela `main` (D31), o compose para na interpolação e nenhum serviço sobe na versão nova. Enquanto ninguém editar o `.env` à mão, isso vale também para uma correção urgente. É o mesmo caso que o runbook já registra para `VAGAS_ESCOLA_FERRAMENTA` e `LLM_TOKENS_POR_MINUTO`, nas linhas 80 e 85 de /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/runbook.md. Esta tarefa não acrescentou o aviso nem um item no `TODO.md`.
  Correção exigida: em /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/runbook.md, acrescentar o parágrafo "Variável nova no ambiente de produção (adaptador falso, 11.0)". Ele diz que antes do pouso na `main` é preciso pôr no `.env` da produção `IA_LATENCIA_FALSA_MS_PADRAO=0`, `IA_TOKENS_FALSOS_ENTRADA=0` e `IA_TOKENS_FALSOS_SAIDA=0`, com deploy fora do horário letivo. Acrescentar também o item correspondente em /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/TODO.md.
Recomendações:
- O teto do contador do `kill -9` é frouxo. Em /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/infra/scripts/carga.ts:597 ele soma as execuções `rodando` das duas réplicas (60 no teto contra 21 interrompidas na corrida). Se a réplica viva interromper execuções por engano, o contador não percebe enquanto o total ficar abaixo do teto. Separar a contagem por réplica (o worker que pegou o job) tornaria o critério `interrompidas_acima_do_teto` efetivo.
- O serviço `api` (/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/infra/compose.yml:236) recebe `IA_LATENCIA_FALSA_MS`, mas não as três variáveis novas. Se a API ainda monta o gateway para algum caminho, o falso dela estima os tokens pelo texto e não usa a latência do `padrao`. Vale tirar a `IA_LATENCIA_FALSA_MS` da API, se ela não chama mais o modelo, ou passar as três para manter a paridade.
- A corrida de 16/11 foi feita com a máquina agitada (load de 3 a 5). Repita com a máquina calma antes de tratar os números como registro. Já está no `TODO.md`.
- A espera por conexão do pool, que a regra 80 pede no item 5, segue sem métrica. Já está no `TODO.md`. Convém fazer isso antes da medida da N2.
```

Rodei os testes de unidade dos arquivos alterados, de `infra/test/carga.test.ts` e de `tools/ci/ambiente.test.ts`, e todos passaram. Não rodei o teste de banco `infra/test/carga-da-manha.int.test.ts` nem a corrida de carga. Nenhum teste chama provedor pago: o script recusa qualquer adaptador que não seja o falso, e o falso fica barrado em produção pela configuração.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-16 20:49:51 · `tasks/prd-reengenharia-continuacao/11_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. As divergências da tabela já estão no `techspec.md` §5, item "Como a 11.0 ficou" (1) a (6), e a do `LLM_TOKENS_POR_MINUTO` também no `cenarios.md` §8.
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

Recomendações:

1. **A fase passa sem provar que o teto mordeu.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/infra/scripts/carga.ts`, o `julgarSala` (critério `balde_nao_recusou`) só reprova com `reservasRecusadas === 0`. Se o Prometheus não responder, o valor fica `undefined` e a fase passa. O teste `carga.test.ts` › "o balde que não recusou…" grava isso como o comportamento certo. Só que o `docs/infra.md` §10 e o runbook dizem que a fase "passa quando… o balde de tokens recusou reservas". Na corrida de 16/11 o número foi lido (93), então o registro vale. Mesmo assim, o código e o texto do critério deveriam dizer a mesma coisa: ou o `undefined` vira "não lido" e reprova, ou o documento diz que sem Prometheus o critério fica de fora.

2. **O limite das interrompidas é conferido só pelo que o k6 viu.** No `lerASala` de `infra/scripts/carga.ts`, o valor de `interrompidas` vem do contador do k6. As `EXECUCAO_INTERROMPIDA` do banco (`falhasDaSala`) aparecem no relatório, mas não entram no julgamento. Quando o k6 desiste de uma execução, ela conta como `sem_conclusao`, e o banco pode ter mais interrompidas que o limite sem nenhuma reprovação. Vale julgar pelo maior dos dois números, ou exigir que os dois batam.

3. **A carga não foi repetida com a máquina calma.** A seção "Como testar" do `11_task.md`, linha 65, manda repetir quando a regra do runbook não vale. A corrida foi com o load entre 3 e 5 e com as pilhas de teste de outros andares de pé, e a repetição foi para o `TODO.md`. O argumento de que carga extra só piora a latência, e por isso o resultado é conservador, se sustenta para as esperas e para o +18 ms da base. Quem decide se basta é o `infra-guardian`, e por isso não reprovo aqui.

4. **Um item do plano não está no relatório nem registrado como divergência.** O `onda-3a.md`, em "Latência e carga (47.0)", pede no relatório "o falso stalled das duas filas" (jobs dados como travados sem estarem). O relatório não traz esse número, e ele também não está na tabela de divergências nem no `TODO.md`. Quem não leva em conta é a 11.4, onde a tarefa lista o que o relatório tem e esse item não aparece. Mesmo assim, vale uma linha na tabela de divergências ou no `TODO.md`, porque esse número detecta reentrega duplicada sob carga.

5. **Organização do `carga.ts`.** O arquivo ganhou cerca de 500 linhas, e o `executarASala` repete a montagem do `executar`: a pasta temporária, o ambiente sem as variáveis do shell e o `compose`. O projeto já põe cada cenário num script próprio (`carga-sala.ts`, `carga-login.ts`, `carga-ingestao.ts`). Levar a fase `sala` para um módulo próprio, com a montagem compartilhada, deixaria o arquivo legível. A tarefa pediu "`npm run carga` ganha a `FASE=sala`", então isso não bloqueia.

6. **O `npm run carga` completo não rodou depois da mudança.** A variante sem `--so` (base, expurgo e carga) passou a forçar `IA_ADAPTADOR=falso` com o `ambienteDoFalso('base')`, e o `LLM_TOKENS_POR_MINUTO=1950000` de `infra/carga.env` agora vale para todas as fases. A tarefa rodou só a `--so=base` e a `--so=sala`. Uma corrida completa confirmaria que a fase `carga` não chega perto do novo teto.

7. **Detalhes de texto.**
   - Na tabela de divergências, a linha do nome do arquivo de teste aponta para "este documento, 'Como testar'", mas a divergência está no `techspec.md` §5 (5). Vale corrigir a coluna.
   - O comentário de `PRAZO_DO_TURNO_DA_SALA_MS` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/infra/k6/justica-entre-escolas.js` fala em "60 s do prazo dele", mas o prazo do perfil `rapido` é 20 s. Diga a que prazo se refere.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-16 20:50:06 · `tasks/prd-reengenharia-continuacao/11_task.md`

VEREDITO: REPROVADO

Cenários exigidos:
- Caminho feliz: a `FASE=sala` com dez escolas dentro do RF6.
- O `kill -9` no meio da fase: os interrompidos ficam dentro do teto, a próxima pergunta roda, e o aluno vê "Tentar de novo" sem gastar a troca.
- O teto de tokens morde, e mesmo assim ninguém vê "indisponível".
- Nenhum provedor pago.
- Latência por perfil e os tokens do adaptador falso, validados contra o prazo de cada perfil.
- Escola barulhenta ao lado de escola usando o Tutor: a espera de uma não entra no p95 da outra.
- Escola sem amostra não passa em branco.
- Limite exato e um abaixo do limite.
- RSS do `worker-ia` contra a memória da VPS.
- A base comparada com o build anterior.

Cobertos:
- Todos os testes citados existem pelo nome e passam. Rodei os três arquivos do `core` (153 casos), `infra/test/carga.test.ts` (47) e `infra/test/carga-da-manha.int.test.ts` (3).
- `julgarSala` tem o caso limpo ao lado de cada falha, com o limite exato e o valor logo abaixo.
- O falso é provado por sinal de prazo, e não pelo relógio da máquina.
- O isolamento da espera entre escolas é provado: os 7 s da escola B não mudam o p95 da A, e o job antigo fica de fora.
- O falso e a recusa de outro adaptador estão provados.
- A corrida está registrada com comando, data, números, limites e a máquina, que não estava calma, e o documento diz isso.
- Nenhum `.skip`, nenhum mock que esconda a regra, nenhum provedor pago.

Bloqueantes:

1. **`infra/scripts/carga.ts:748-765` (`lerASala`): a montagem do `ResultadoDaSala` não tem teste nem bloco.**
   - A função não está entre as que o documento isenta (`executarASala`, `amostrarASala`, `telemetriaDaSala`).
   - Ela decide o veredito pelo lado do banco. Na l.761, o filtro `erro !== 'EXECUCAO_INTERROMPIDA' && erro !== 'IA_INDISPONIVEL'` calcula `falhasForaDoKill`. Na l.763 sai `indisponiveis`, na l.758 `interrompidas ?? 0`, na l.764 `reservasRecusadas: telemetria.espera`.
   - Uma mutação que mascara passaria nos testes e na corrida: por exemplo `.filter(() => false)` ou `reservasRecusadas: 1`. É o lado do banco que garante "nenhuma outra falha", já que a separação do k6 (`justica-entre-escolas.js:410-415`) também não tem teste.
   - Correção exigida: extrair para uma função pura exportada, com caso unitário. Por exemplo, as falhas `{EXECUCAO_INTERROMPIDA:3, IA_INDISPONIVEL:1, IA_SAIDA_INVALIDA:2}` dão `falhasForaDoKill` 2 e `indisponiveis` 1; `k6.interrompidas` ausente dá 0; `reservasRecusadas` vem de `telemetria.espera`. E um bloco por termo.

2. **`infra/scripts/carga.ts:710` (`julgarSoABase`): o critério `k6_base` não tem caso.**
   - Os três casos de "o k6 lê o contador das interrompidas…" passam com `if (false)`.
   - Correção exigida: o caso `julgarSoABase({ codigo: 107, cruzados: [], esperaBP95Ms: 40 })` deve dar `['k6_base']`, com o bloco correspondente.

3. **`infra/test/carga-da-manha.int.test.ts:128`: "…e o consumo da janela por função" só confere `[]`.**
   - Nada prova a soma de tokens e custo, o agrupamento por função, o filtro de escola nem o `em >= $2` de `consumoDaSala` (`carga.ts:611-617`).
   - O "custo de base por professor" da seção "A corrida" (11.4) sai dessa função.
   - Correção exigida: semear linhas em `consumo_ia` com duas funções, uma linha antes de `desde` e uma de outra escola, e conferir chamadas, tokens e custo por função. A alternativa é tirar "o consumo" do nome do teste e do que ele afirma.

4. **Cláusulas que o teste alcança e que ficaram sem bloco.** A autoconferência, item 1, diz "um por cláusula do diff que o teste alcança", e não é o caso.
   - Em `carga.ts`:
     - l.443: o `saidaEsperada` de `julgarSala`.
     - l.137: `typeof interrompidas === 'number'`.
     - l.469: `Number.isFinite`, que também não tem caso; falta um como `'1.2.3MiB / 4GiB'`.
     - No `MEDIDA_DA_SALA` (l.565-575): `j.escola_id = e.id`, `j.fila`, `j.iniciado_em is not null` e `j.criado_em >= $2`.
     - l.597: `estado = 'rodando'`.
     - l.604: `estado = 'falhou'` e `criada_em >= $2`.
     - O rodízio `% $5` de `semearEscolaDaSala`.
   - Sem caso nenhum:
     - `j.tipo = 'ia.executar'`: nenhum job de outro tipo na fila `interativa`.
     - O `escola_id = any($1)` de `falhasDaSala`: falta uma execução `falhou` numa segunda escola. Hoje só um banco vazio protege, e isso não é determinístico com outros testes rodando em paralelo.
   - Correção exigida: acrescentar os dois casos e um bloco para cada cláusula.

5. **`11_task.md:51`, linha "o kill -9": o item "o aluno vê 'Tentar de novo' sem gastar a troca" não é provado pelo que a coluna "Caso" cita.**
   - Nem a corrida nem o teste de banco provam isso. A prova existe em outro lugar.
   - Correção exigida: citar `apps/api/src/tutor/sem-resposta.int.test.ts` › "a reentrega interrompida (EXECUCAO_INTERROMPIDA)…" e `apps/web/src/areas/aluno/Tutor.test.tsx` › "D36 junto: … (a execução `falhou EXECUCAO_INTERROMPIDA`) e vem **acima** do "Tentar de novo"".

Recomendações:
- `justica-entre-escolas.js:410` (`fecharExecucaoDaSala`): a separação de `IA_INDISPONIVEL`, `EXECUCAO_INTERROMPIDA` e das outras falhas não tem teste. Depois do bloqueante 1, o banco cobre esse lado, mas vale um teste de estrutura. O mesmo vale para a checagem de alunos e professoras por escola na l.118.
- O `turnoDoTutorP95Ms` só é conferido como `null`. Falta um caso positivo; o valor vai para o relatório.
- `carga.ts:966` (a leitura de `--so`) e `:918` (o `soABase`) não têm teste. Uma função `faseDoArgumento` resolveria.
- `llm-gateway.test.ts`: o `rapidoNaoEspera` só ficaria vermelho pelo timeout do Vitest. Melhor usar um sinal curto, como no `fake-adapter.test.ts`.
- `memoriaEmMiB`: falta um caso para a unidade `B`.
- A repetição da corrida com a máquina calma já está no `TODO.md`. Ela precisa sair antes de o número virar registro.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-16 21:15:41 · `tasks/prd-reengenharia-continuacao/11_task.md`

```
VEREDITO: APROVADO
Caminho quente tocado: deploy
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- O `docs/runbook.md` e o `TODO.md` só registram o passo do `.env` da VPS. O deploy pela `main` continua parando na interpolação se o passo for esquecido. Um aviso automático (o deploy comparar o `.env` da VPS com as chaves `:?` do `infra/compose.yml` antes do `up`) tiraria a dependência de memória. Isso vale para esta variável e para a próxima.
- Não rodei `infra/test/carga-da-manha.int.test.ts` nesta rodada porque ele precisa de banco. O portão da tarefa precisa dele verde antes do pouso.
```

**A correção exigida na 1ª rodada foi feita.**
- **Runbook:** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/runbook.md`, linhas 89-92, traz o parágrafo "Variável nova no ambiente de produção (adaptador falso, 11.0)". Ele manda pôr no `.env` da VPS `IA_LATENCIA_FALSA_MS_PADRAO=0`, `IA_TOKENS_FALSOS_ENTRADA=0` e `IA_TOKENS_FALSOS_SAIDA=0` antes do pouso na `main`, com deploy fora do horário letivo.
- **TODO:** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/TODO.md` tem o item correspondente, marcado "ordem 1".
- **Os dois `worker-ia`:** o `worker-ia-2` herda o bloco do `worker-ia-1` pela âncora `&worker-ia` (`infra/compose.yml:509` e `:569-570`). As três variáveis estão no bloco nas linhas 548-550, então o "nos dois `worker-ia`" do runbook está certo.
- **O zero:** `packages/core/src/config/llm-config.ts:193-197` trata 0 como ausente, então pôr 0 em produção não muda nada no adaptador real.

**O resto do diff não toca código que roda no horário de aula.**
- Só mexe em teste, no script e no k6 da carga, em comentário e em documentação.
- Em `infra/scripts/carga.ts`, `montarResultadoDaSala` foi extraída como função pura, sem mudar o que calcula.
- O caso novo de `packages/core/src/ia/llm-gateway.test.ts` usa o servidor falso local (`startFakeLlamaServer`) e não chama provedor pago.
- `infra/test/carga.test.ts` e `packages/core/src/ia/llm-gateway.test.ts` passam: 143 testes verdes.

## llm-integrator · 2ª rodada · APROVADO · 2026-11-16 21:15:47 · `tasks/prd-reengenharia-continuacao/11_task.md`

VEREDITO: APROVADO
Perfis usados: `rapido` (turno do Tutor) e `padrao` (ferramenta e propostas) na carga, sempre com o adaptador falso. Nenhuma chamada nova a modelo real. O diff desta rodada não troca nenhum perfil.
Custo estimado por professor/mês: não mudou nesta rodada. Continua o que a 1ª rodada registrou: cerca de 9 a 10 mil tokens por minuto de uso no pico, e `custo_micros` 0 porque o falso não cobra. O custo em reais depende do preço do modelo real (D37) e está no `TODO.md`. A linha agora diz que é unidade de custo agregada e nunca indicador por professor.
Prompt versionado: sim (nenhum prompt foi tocado).
Validação de schema: sim (nenhum caminho de saída estruturada foi tocado).
Aprovação humana no caminho: não se aplica (o diff é infraestrutura de carga e documentação, e nenhuma entrega de agente muda).
Bloqueantes: nenhum.

O que conferi no diff contra as correções exigidas:
- **Ordem 1 (variáveis do `.env` de produção):** o parágrafo "Variável nova no ambiente de produção (adaptador falso, 11.0)" está em `docs/runbook.md`, com as três variáveis em `=0`, o deploy fora do horário letivo e a referência à D31. O item correspondente está em `TODO.md`.
- **Ordem 10 (variáveis do falso não chegam ao provedor):** o caso novo está em `packages/core/src/ia/llm-gateway.test.ts` (l.232). Ele preenche as três opções com `IA_ADAPTADOR=openai_compat` e confere que a medição vem do provedor (`origem: 'openai_compat'`, tokens 1.234 e 56) e que não há espera de 60 s. Em `packages/core/src/ia/llm-gateway.ts:546-547` as opções só alimentam o adaptador falso. Rodei `llm-gateway.test.ts` e `fake-adapter.test.ts`: 99 testes verdes.
- **Ordem 15 (`rapidoNaoEspera`):** agora usa `AbortSignal.timeout(1_000)` e falha na hora, sem depender do timeout do Vitest.
- **Ordem 2 (`lerASala`):** a lógica de veredito foi extraída para `montarResultadoDaSala`, uma função pura exportada em `infra/scripts/carga.ts`, sem mudar o comportamento. Os testes novos estão em `infra/test/carga.test.ts` e `infra/test/carga-da-manha.int.test.ts`. A cobertura em si cabe ao `test-engineer`.
- **Ordens 7, 8, 9, 11, 12 e 13:** são texto e comentário (`carga.ts`, k6, `techspec.md`, `TODO.md`) e foram aplicados como exigido. Não afetam a camada de IA.

Recomendações:
- O `TODO.md` já registra o `superRefine` de `llm-config.ts` para recusar `IA_TOKENS_FALSOS_*` e `IA_LATENCIA_FALSA_MS_PADRAO` fora do `IA_ADAPTADOR=falso`. É a defesa estrutural que falta. Hoje o falso é vedado em produção e só ele lê essas variáveis.
- O serviço `api` do compose ainda recebe `IA_LATENCIA_FALSA_MS` sem as outras variáveis do falso. Decidir se a API monta o falso ou não. Já está no `TODO.md`.
- A premissa de 1 ferramenta por minuto por escola segue sem fonte medida. Só uma escola real (D37) resolve isso.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-16 21:16:08 · `tasks/prd-reengenharia-continuacao/11_task.md`

VEREDITO: APROVADO

Esta é a 2ª rodada. Auditei só o diff entre a árvore `9ed06fa0` e a `a10f9bdd`, cruzado com `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/.processo/ordens/11_task-r1.md`. Na 1ª rodada eu não exigi nenhuma correção. Das minhas recomendações, uma entrou como teste (ordem 10) e outra foi registrada no `TODO.md`, como a Mesa decidiu.

Campos pessoais tocados: nenhum. O diff só mexe em teste, comentário, documentação e na extração da função pura `montarResultadoDaSala`. Nenhuma migration nem DTO mudou.
Fora da tabela de dados do docs/lgpd.md: nada.
Autorização por objeto: ok, sem rota nova nem alterada. `falhasDaSala`, `contarExecucoesRodando` e `consumoDaSala` continuam filtrando por `escola_id = any($1)`. Agora os testes com uma segunda escola (`infra/test/carga-da-manha.int.test.ts`) provam esse filtro. Antes, quem o protegia era só o banco vazio.
Logs: limpos. `descreverSala` não mudou e só escreve agregados por função e por código de erro. O `lerASala` refatorado não acrescenta nenhuma saída.
Auditoria: não se aplica. O diff não tem leitura de aluno por coordenação, exportação, nota, permissão nem aprovação de saída de IA.
Envio externo: nenhum. O caso novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/llm-gateway.test.ts` (ordem 10, a minha recomendação) usa `openai_compat` contra o servidor falso local (`startFakeLlamaServer`, `processamentoLocal: true`). Ele prova duas coisas: os tokens falsos (3.000 + 250) não chegam ao adaptador do provedor, porque a medição sai 1.234 e 56, os números do próprio provedor; e a latência falsa de 60 s não é esperada (o caso termina em menos de 1,5 s). Com isso fica escrito que as opções do falso não alcançam nenhum adaptador real.
Seed/fixture: sintético. As escolas, alunos, execuções e linhas de `consumo_ia` saem dos helpers do teste (`escola()`, `usuarios()`, `semearEscolaDaSala`). O `entrada` das execuções é `{"tarefa": ...}`, sem conteúdo de aluno. O comentário novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/infra/scripts/carga.ts` (ordem 8) marca o vínculo `confirmado` direto no banco como atalho só da carga, e não como o caminho da D4. Isso evita que o padrão seja copiado para seed ou importação.
Bloqueantes: nenhum.
Recomendações:
- O parágrafo novo de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/runbook.md` manda pôr as três variáveis do falso com valor `0` no `.env` da VPS. Hoje isso não traz risco: o adaptador falso é vedado em produção e só ele as lê. Quando a validação do `superRefine` for feita (linha nova do `TODO.md`, vinda do `llm-integrator`), a recusa precisa aceitar o `0` ou o runbook precisa mudar junto. Se não, o deploy para outra vez.
- A minha recomendação da 1ª rodada sobre o `tokens.json` da sala (pasta 0777, arquivo 0644) ficou no `TODO.md` e não foi aplicada. Vale fazê-la antes de a fase `sala` rodar em qualquer máquina compartilhada.

Pergunta de fechamento: o diff não muda o que o sistema guarda sobre o aluno nem para onde envia. A resposta continua a da 1ª rodada, pelo arquivo do titular e pela `ExecucaoAgente`/`consumo_ia`.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-16 21:16:12 · `tasks/prd-reengenharia-continuacao/11_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta rodada. O diff mexe na carga (`carga.ts`, k6, testes de infra), no teste do gateway, em `TODO.md`, `runbook.md` e `techspec.md`. Nenhum desses arquivos grava em `nota` nem cita `lancadaPor`. Todos com autor humano? Não se aplica.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. O diff não traz nenhum fluxo novo de saída de IA para o aluno. As execuções `concluida` com `resultado` `{"tipo":"mensagem"}` em `infra/test/carga-da-manha.int.test.ts` são só dado sintético de teste.
Supervisão do tutor: ok. Nada mudou no caminho do Tutor. O item "Tentar de novo sem gastar a troca" da tabela agora cita a prova que existe: `apps/api/src/tutor/sem-resposta.int.test.ts:180` e `apps/web/src/areas/aluno/Tutor.test.tsx:103`. As duas existem com o texto citado.
Autonomia declarada e visível: sim. Nada mudou aqui desde a rodada aprovada.
Bloqueantes: nenhum

O que conferi das ordens que tocam a regra 70:
- **Ordem 8 (minha, da 1ª rodada):** feita. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/infra/scripts/carga.ts:551-552` agora diz que o vínculo `confirmado` direto no banco é atalho só da carga, aponta a D4 como o caminho real e proíbe copiar o padrão para seed ou importação.
- **Ordem 9 (minha):** feita. A linha "Custo em reais por professor" do `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/TODO.md` diz agora que é unidade de custo agregada (por escola ou por turma) e nunca indicador por professor, com a regra 70 itens 8 e 9 e a D45.
- **Ordem 7:** feita, só um comentário (`carga.ts:548`). Não afeta a regra 70.
- **Item 7 da regra 70 (supervisão não é vigilância):** `consumoDaSala` e `montarResultadoDaSala` agregam por função e por escola, sem usuário. As medidas de espera e de turno são por escola e por fila. O teste novo de consumo (`carga-da-manha.int.test.ts`) confere o agrupamento por `funcao`, sem ninguém nominal. Não há métrica de professor nem de aluno.
- **Ordem 10:** o caso novo de `llm-gateway.test.ts` mostra que as opções do adaptador falso não chegam ao `openai_compat`. A medição sai com os tokens do próprio provedor (1.234 e 56), e nada espera a latência falsa. Não toca a regra 70.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/prd-reengenharia-continuacao/11_task.md:140`, na linha "custo de base por professor" de "A corrida": vale a mesma frase que entrou no `TODO.md`, dizendo que é unidade agregada das 20 professoras sintéticas e não indicador por professor. É lá que um leitor futuro vai buscar o número da 11.4.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-16 21:16:35 · `tasks/prd-reengenharia-continuacao/11_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. A divergência nova, o falso `stalled` fora do relatório, está em `techspec.md` §5 "Como a 11.0 ficou" (4), na tabela de divergências do `11_task.md` e no `TODO.md`. A coluna "Onde está na spec" da linha do arquivo de teste agora aponta para `techspec.md` §5 (5).

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

Bloqueantes: nenhum

As 16 ordens de `.processo/ordens/11_task-r1.md` foram cumpridas no diff:
- **Item 1:** o parágrafo novo está em `docs/runbook.md`, antes de "Se nada disso resolver", e o item correspondente está no `TODO.md`.
- **Item 2:** `montarResultadoDaSala` virou função pura exportada. Tem caso com `{EXECUCAO_INTERROMPIDA:3, IA_INDISPONIVEL:1, IA_SAIDA_INVALIDA:2, IA_TEMPO_ESGOTADO:4}`, caso com o contador do k6 ausente e o `reservasRecusadas` vindo da telemetria. Há um bloco de mutação por termo.
- **Item 3:** `julgarSoABase({ codigo: 107, … })` dá `['k6_base']`.
- **Item 4:** o teste semeia `consumo_ia` com duas funções, uma linha fora da janela e uma de outra escola.
- **Item 5:** existe job `ingestao.processar` na mesma fila, execução que falhou numa segunda escola e um bloco para cada cláusula do SQL. A isenção de `j.iniciado_em is not null` nas linhas do p95 tem justificativa correta: o `percentile_cont` ignora nulo, então a mutação é equivalente.
- **Item 13:** o comentário do k6 confere com `PRAZO_DA_EXECUCAO_MS` (60 s no `rapido`, 140 s no `padrao`).
- **Item 14:** `turnoDoTutorP95Ms` tem caso positivo (9.550 ms).
- **Itens 6–12, 15 e 16:** também foram aplicados.
- **Tabela "Sem aplicar":** foi copiada para o documento, e cada linha com destino `TODO.md` está lá.

Recomendações:
- `TODO.md`, seção da 11.0, linhas novas: a etiqueta "ordem 1" está em linhas que vêm de itens diferentes da ordem.
  - "O falso `stalled`…" vem do item 11.
  - A linha do test-engineer diz "o lado do banco passa a ser coberto pela ordem 1", mas é o item 2.
  - As outras linhas usam "1ª".
  - Usar "rodada 1, item N" deixa claro de onde cada linha vem.
- `packages/core/src/ia/llm-gateway.test.ts`, caso "as opções do adaptador falso … não chegam a ele": o `expect(performance.now() - inicio).toBeLessThan(1_500)` depende do relógio da máquina, que foi justamente a crítica do item 15. A prova real já está no `origem: 'openai_compat'` e nos tokens 1.234/56. Vale tirar a asserção de tempo ou trocá-la por um `sinal: AbortSignal.timeout(…)`, como foi feito no `rapidoNaoEspera`.
- `infra/test/carga-da-manha.int.test.ts`, `inserirJob` e `execucaoDaEscola`: o `clock_timestamp()` é avaliado mais de uma vez na mesma instrução, e por isso a duração ganha alguns microssegundos. Hoje o `Math.round` absorve essa diferença. Calcular `criadoEm` uma vez só, num CTE ou como parâmetro, deixaria os valores exatos.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/infra/scripts/carga.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/infra/test/carga-da-manha.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/infra/test/carga.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/packages/core/src/ia/llm-gateway.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/infra/k6/justica-entre-escolas.js
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/docs/runbook.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/TODO.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/prd-reengenharia-continuacao/11_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/prd-reengenharia-continuacao/techspec.md

## test-engineer · 2ª rodada · APROVADO · 2026-11-16 21:17:31 · `tasks/prd-reengenharia-continuacao/11_task.md`

VEREDITO: APROVADO

**Cenários exigidos** (os cinco bloqueantes da 1ª rodada, conferidos contra o diff `9ed06fa0..a10f9bdd`):
1. O `ResultadoDaSala` sai de uma função pura, com caso unitário e um bloco por termo.
2. O critério `k6_base` de `julgarSoABase` tem caso e bloco.
3. O consumo da janela é conferido com linhas semeadas: duas funções, uma linha antes de `desde` e uma de outra escola.
4. As cláusulas alcançadas que estavam sem bloco ganharam bloco, e entraram os dois casos que faltavam: um job de outro tipo e uma execução `falhou` numa segunda escola.
5. A linha "o `kill -9`" da tabela cita a prova de "Tentar de novo" sem gastar a troca.

**Cobertos:**
1. `montarResultadoDaSala` foi extraída (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/infra/scripts/carga.ts:751`). O caso fica em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/infra/test/carga.test.ts:493`: as falhas `{EXECUCAO_INTERROMPIDA:3, IA_INDISPONIVEL:1, IA_SAIDA_INVALIDA:2, IA_TEMPO_ESGOTADO:4}` dão 6 e 1, o `interrompidas` ausente dá 0, e `reservasRecusadas` sai do argumento. Os dez blocos derrubam o caso pela conta, inclusive os dois do `?? 1` (o caso `semNada` espera 0).
2. `julgarSoABase({ codigo: 107, … })` dá `['k6_base']` (`carga.test.ts:489`), e o caso inverso, zero com um cruzado, também está lá (l.490). O bloco `if (false)` existe.
3. O teste "o consumo da janela soma chamadas, tokens e custo por função…" (`carga-da-manha.int.test.ts:194`) tem quatro blocos: sem o filtro de escola, janela de 2 h, `sum` de entrada só, `max` no custo e `count(distinct tarefa)`. Pelos números semeados, cada um fica vermelho.
4. Todos os blocos pedidos existem:
   - `saidaEsperada` de `julgarSala`, com os dois casos contraditórios novos (l.452 e l.453);
   - `typeof`, com o caso `'12'`;
   - `Number.isFinite`: o `'1.2.3MiB'` passa no `[\d.]+` e vira `NaN`;
   - a unidade `B`;
   - no `MEDIDA_DA_SALA`, `escola_id`, `tipo`, `fila` e `criado_em`, nas contagens e nos p95, mais o `iniciado_em` das contagens;
   - o turno: escola, função, estado e janela;
   - `estado = 'rodando'`, `estado = 'falhou'` e `criada_em >= $2`;
   - o rodízio `% ($5 - 1)`, que deixa a 6ª turma vazia e quebra o `[2,2,2,2,2,2]`.
   
   Os dois casos sem caso nenhum também entraram: o `ingestao.processar` e a escola B com `IA_TEMPO_ESGOTADO` em `falhasDaSala`. A isenção do `iniciado_em is not null` nos p95 se sustenta, porque o `percentile_cont` ignora o nulo e a mutação é equivalente.
5. A linha da tabela cita os dois casos pedidos, e confirmei que existem: `apps/api/src/tutor/sem-resposta.int.test.ts:180`, que confere `trocasHoje: 0`, e `apps/web/src/areas/aluno/Tutor.test.tsx:103`.

O que rodei e o que conferi:
- `infra/test/carga.test.ts`: 49 verdes.
- `infra/test/carga-da-manha.int.test.ts`: 6 verdes.
- `packages/core/src/ia/llm-gateway.test.ts`: 94 verdes.
- `node tools/processo/mutacoes.ts --faltando` sobre o documento: nenhuma linha sem bloco.
- Sem `.skip` e sem mock de coisa nossa. A IA dos testes é só o adaptador falso ou o servidor falso local.

**Bloqueantes:** nenhum.

**Recomendações:**
- **`lerASala` (`carga.ts:773`)** agora só liga as peças, mas o `reservasRecusadas: telemetria.espera` segue sem prova fora da corrida. Vale incluir `lerASala` na lista do documento das funções que só a corrida usa (`11_task.md:81`, ao lado de `executarASala`, `amostrarASala` e `telemetriaDaSala`), para a isenção ficar escrita.
- **`julgarSoABase`, `carga.ts:712`:** a linha do `saidaEsperada` não tem bloco, embora os casos novos da l.489 e da l.490 derrubem as duas mutações. Vale acrescentar os dois blocos, iguais aos de `julgarSala`.
- **`llm-gateway.test.ts`, caso "as opções do adaptador falso…":** o `expect(performance.now() - inicio).toBeLessThan(1_500)` mede o relógio da máquina e repete o que o prazo de 2 s da configuração já prova: se a latência de 60 s chegasse ao provedor, a chamada terminaria em `IA_TEMPO_ESGOTADO`. Vale tirar essa asserção. Com a máquina sob carga, ela poderia falhar entre 1,5 s e 2 s.
- **`medirEscolasDaSala`:** o caso "a outra escola mede só os jobs dela, na ordem em que a sala as nomeia" prova a ordem e a correspondência de cada escola com o seu id, mas não tem bloco. Seria um bloco que troque o `rows.find(...)` por `rows[indice]`. É cobertura extra: a função não mudou nesta rodada.
