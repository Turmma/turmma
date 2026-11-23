# Tech Spec — Provedor de reserva e avaliação dos modelos

**PRD:** `tasks/prd-reserva-e-avaliacao/prd.md`
**Status:** aprovada como parte da Tech Spec da F5 (`tasks/prd-camada-ia/techspec.md`, revisão da spec, rodada 6, em
`tasks/prd-camada-ia/revisao-spec.md`); separada no corte de 21/11/2026 e revista contra o código da F5a na revisão da spec
da F5b (`revisao-spec.md`). Os números das seções são os da F5; a §4, a §6, a §9 e a §10 ficaram na F5a.

## 1. Resumo da abordagem

A F5b estende o `LLMGateway` e o `main-worker` (X6) como a F5a deixou: preço no código (`PRECO_DOS_MODELOS`) e uma linha de
consumo **por chamada**, com custo (o provedor e a origem da linha ainda são os do único adaptador do gateway: a F5b os leva a
cada chamada, §5). A aprovação de modelo também fica no código (`MODELOS_APROVADOS`; Joaquim,
20/11/2026). O **provedor de reserva** é um segundo adaptador, com resiliência e conferência próprias, e só atende tarefa e
modelo aprovados.

A avaliação roda à mão (`tools/ia/`); `pedagogia-reviewer` e `conformidade-reviewer` julgam, e o Joaquim confirma as
reprovadas, as duvidosas e 10% das aprovadas (20/11/2026).

## 2. Módulos afetados

- `packages/core/src/ia/`: `modelos-aprovados.ts` (novo), `llm-gateway.ts`, `errors.ts` e `resilient-adapter.ts` (a causa da
  falha), `adapter.ts` e `fake-adapter.ts` (a identidade e
`IA_FALHA_FALSA`), `__fixtures__/scripted-adapter.ts` (`provedorId` por instância), `soberania.ts`, `consumo.ts` (`ConsumoDeIa`, `InMemoryConsumo`,
  a estimada com custo); `config/llm-config.ts` com `IA_RESERVA_ADAPTADOR` (`falso` ou `openai_compat`), `LLM_RESERVA_BASE_URL`,
  `LLM_RESERVA_MODELO[_<PERFIL>]`, `LLM_RESERVA_CHAVE_API` (na guarda de segredo), `IA_RESERVA_PROVEDOR_ID`,
  `LLM_RESERVA_TOKENS_POR_MINUTO`
- `apps/api/src/ia/`: `ia-do-worker.module.ts` (o segundo adaptador, a segunda conferência e o segundo `TokenLimiter`),
  `consumo.repository.ts`, `varredura-de-execucoes.ts`, `execucao.processor.ts` e `worker.module.ts` (a lista de destinos);
  `apps/api/test/fila-de-ia.fixture.ts` (a bancada monta o gateway real com principal e reserva)
- `infra/grafana/alertas/`, `docs/runbook.md`, `infra/carga.env`, o `carga.ts` (fase `reserva`)
- `tools/ia/avaliar-modelos.ts`, `tools/ia/amostras/`
- `docs/`: glossário (a entrada "provedor de reserva" já existe; ganha "saída de reserva", o outro sentido), avaliação
  (§3, §3.1), AIAs, LGPD (linha 99), infra 5.4 e o prazo da execução com quatro chamadas

## 3. Modelo de dados

Nenhuma migration: a coluna `consumo_ia.pelo_provedor_de_reserva` e o índice `consumo_ia_mes_idx` entraram na F5a (2.0).

**A estimativa** (D14: superestima custo e destino). A chamada que saiu sem voltar com uso (prazo, conexão, servidor)
grava a entrada contada e a saída no teto (F5a). A interrompida grava os dois tetos da tarefa, uma linha por destino, ao
preço de cada modelo: se a tarefa tem aprovação para o provedor de reserva configurado (só tarefa e provedor), o
`registrarEstimada` grava também a dele, na varredura e na reentrega. A assinatura passa a
`registrarEstimada(execucao, destinos, precos)`, com a tabela de preços por porta. As linhas saem do mesmo `InterrompidaEncerrada` (a escola do `returning`), na transação do encerramento,
sem `@Unscoped` novo; uma que falha desfaz as duas e o encerramento.

Quem decide os destinos é `destinosDaInterrompida(tarefa, configurados)`, em `consumo.ts`: o principal sempre e a reserva configurada se `MODELOS_APROVADOS` tem entrada da tarefa para o `provedorId` dela (sem comparar o modelo nem a conferência). Os `configurados` (`DestinosConfigurados`: `principal`, `reserva` opcional e `aprovados`, injetável no teste) chegam à `VarreduraDeExecucoes` e ao `ExecucaoProcessor` no lugar do `destino` de antes, junto da tabela de preços (`precos`, `PRECO_DOS_MODELOS` por padrão); o `IaDoWorkerModule` ganha o `DESTINO_DA_RESERVA` (nulo sem reserva), que o `CicloDoWorkerDeIa` junta ao `DESTINO_DO_ADAPTADOR`.

**`pelo_provedor_de_reserva`** é verdadeira só na linha de chamada que saiu para a reserva (a atendida e a que falhou depois de
sair); cada linha da estimada da interrompida leva o provedor do seu destino e a coluna falsa, também a da reserva. Assim a Operação (`chamadasPeloProvedorDeReserva`,
sem mudança de consulta) conta as chamadas **enviadas** à reserva. Com a reserva falsa, `provedor` nulo e a coluna verdadeira. A coluna entra com o destino
por chamada (`ConsumoDeIa.peloProvedorDeReserva`, 4.0) e é gravada no banco na 5.0; a 1.0 prova só a identidade da reserva falsa (balde, rótulo, disjuntor, preço e `provedor` nulo).

## 5. Fluxo

**A aprovação.** `MODELOS_APROVADOS` lista `{ tarefa, provedorId, modelo, relatorio, sha256, aprovadoPor, aprovadoEm }`, versionada, uma por relatório aprovado
(§8); o `sha256` é do `relatorio.md`, e a guarda o recalcula. O provedor de reserva é **elegível** para uma tarefa se configurado, conferido
na subida e com entrada que bate no provedor e no modelo que ele usa no perfil da tarefa. Trocar o modelo
de um perfil tira do caminho as tarefas dele até um relatório novo. A função é `reservaElegivel(tarefa, { reserva, soberania, ambiente, aprovados })`:
a reserva configurada (identidade e modelo de cada perfil), a conferência da D62 dela por porta (a 2.0 liga; sem ela, não elegível), o ambiente (a entrada
de `falso-reserva` não vale em `producao`) e a constante, injetável no teste.

**A identidade.** Todo adaptador ganha `identidade`: o `provedorId` do envio no `openai_compat`; no falso, `falso` no principal e o
`IA_RESERVA_PROVEDOR_ID` (`falso-reserva`) na reserva. Balde, rótulo `provedor` das medidas, disjuntor,
chave do preço e aprovação leem a `identidade`, e não mais `envio.provedorId ?? origem`. O falso segue sem envio externo e com
`origem = 'falso'`: a linha dele tem `provedor` nulo. A reserva falsa tem preço zero em `PRECO_DOS_MODELOS` e relatório
sintético; com `AMBIENTE=producao`, `IA_RESERVA_ADAPTADOR=falso` ou `falso-reserva` sobre `openai_compat` recusa a subida. `IA_RESERVA_ADAPTADOR` escolhe o adaptador da reserva; `IA_FALHA_FALSA`
(`<principal|reserva>:<5xx|prazo|conexao|429>`) só tem efeito no falso e é recusada com `AMBIENTE=producao`. A subida recusa, em
qualquer ambiente, a reserva com a mesma identidade do principal, salvo com `openai_compat` nos dois e nenhum modelo da reserva igual a um do
principal, o menor incluído, em qualquer perfil: é a reserva "outro modelo da Maritaca" (PRD §10), com o mesmo suboperador e baldes `provedor:modelo` distintos.

**A causa da falha.** O `traduzir` do `ResilientAdapter` deixa de apagar a classificação do `ProviderError`: o `LLMError` ganha os
motivos `limite` (o 429 que sobrou da repetição) e `rejeitada` (outro 4xx), que **não** são `semEnvio`: o pedido chegou ao provedor,
a linha dele fica com a estimativa (D14) e o provedor dele segue no compartilhamento. Sem motivo continua o 5xx e a conexão. O `limite` desce ao modelo menor
**sem a espera de 8 s** do balde, na mesma tentativa e só com o limitador configurado (o 429 já é a recusa do provedor), e o menor que já era o modelo da chamada
não desce de novo. Sem menor (a tarefa não o tem, ou é o Tutor ou a classificação, D36) ou sem vaga nele, **e sem reserva elegível**, termina `IA_INDISPONIVEL` **com o motivo `limite`**
e a espera do `Retry-After`, e não `sem_vaga`: `sem_vaga` é `semEnvio`, e o 429 saiu e tem linha. Com reserva elegível, o 429 que sobra vai a ela, no balde dela (7.0); se também ali não há vaga, termina `sem_vaga` (o da 7.0, como o da falta de vaga no principal).

**A chamada.** (1) Sem vaga no principal (balde cheio ou `limite`, depois da espera e do modelo menor, se a tarefa o tem), vai ao provedor
de reserva elegível, no balde `provedor:modelo` dele; sem vaga ali, `IA_INDISPONIVEL`, `sem_vaga`. (2) Queda do principal passa à reserva
elegível, uma vez, se o sinal da execução não abortou. É queda: `disjuntor`, `IA_INDISPONIVEL` sem motivo (5xx, conexão) e
`IA_TEMPO_ESGOTADO`. `rejeitada` não é queda nem falta de vaga (defeito de pedido ou de configuração): termina como hoje. (3) A repetição por saída inválida fica no provedor que respondeu. A queda na repetição do principal (a primeira
inválida, a segunda com 5xx) também vai à reserva, com o pedido sem a correção do principal. (4) A reserva que falha termina como
hoje: interativo indisponível, lote adiado; duas inválidas nela ainda passam pela saída de reserva da tarefa (`reservaQuandoInvalida`,
outro sentido de "reserva": glossário). Uma função só confere a elegibilidade nos dois ramos. **O balde da reserva é da 7.0, nos dois ramos:** na 4.0 a chamada à reserva no ramo da queda
ainda não reserva vaga (`vagaDoAlvo` devolve `{}` para a reserva, e o `limiteDeTokensDaReserva` ainda não é lido); a 7.0 a põe no balde dela, na fila do pedido, e o `sem_vaga` dali termina o pedido. **A vaga do principal
que caiu sem sair** (o disjuntor aberto, `semEnvio`) volta ao balde na hora (`devolverAVaga`, `acertar(0)`), para o desvio não encher o balde até o `sem_vaga`; a das chamadas que podem ter saído (5xx, conexão, prazo) fica com a estimativa, que o provedor pode ter contado (D14). **No máximo quatro chamadas por
execução**, duas por destino (principal ou reserva), com contador por destino. O Tutor e a classificação nunca vão ao menor (D36). A função suspensa
não chega a nenhum provedor (a suspensão vem antes, como hoje).

**A vaga da reserva (7.0).** A chamada à reserva reserva no balde `provedor:modelo` dela, na fila do pedido (`limiteDeTokensDaReserva`; sem o limitador, o `local`, a chamada vai direto), nos três caminhos que a levam até ela: a queda do principal, o 429 que sobrou
(`limite`, depois do menor) e a falta de vaga no principal, depois da espera de 8 s e do menor, se a tarefa o tem. **A reserva não espera:** o principal já esperou os 8 s (dentro do prazo único da execução), e a queda não tem tempo a gastar; uma tentativa só, e sem vaga
ali termina `IA_INDISPONIVEL` com o motivo `sem_vaga` e a espera do balde **dela** (`tenteDeNovoEmSegundos`). A vaga é a da chamada que caiu: a do menor, quando é ele que cai sem sair, volta ao balde dele (`acertar(0)`), e a do principal, que o 429 já gastou, fica com a estimativa (D14).
A reserva que atende depois do sem vaga começa sem a correção do principal, como na queda, e o degrau que soma é o `provedor_de_reserva`, e não o `indisponivel`, que só conta quando termina.

**O destino por chamada.** `ChamadaEnviada` e o `Gasto` guardam o destino de cada chamada (origem, envio, identidade e
`peloProvedorDeReserva`); o preço, o rótulo, o balde, a linha de consumo e a `medicao` devolvida leem o destino da chamada, e
a `medicao` é a do provedor que respondeu. `ConsumoDeIa` ganha `peloProvedorDeReserva` (opcional no tipo, e a falta vale `false`: o `ConsumoDeIa` também é construído fora do gateway, e o campo obrigatório é da 5.0; a linha que o gateway entrega sempre o traz preenchido), e o `ConsumoRepository` o grava (`?? false`). **A 5.0 o manteve opcional** (tarefa 5.0, divergência): a estimada da interrompida (`consumoEstimadoDaInterrompida`, da 8.0) também constrói `ConsumoDeIa` e leva a coluna falsa, e tornar o campo obrigatório quebraria esse construtor sem ganho para a linha do gateway.
A reserva soma `ia.degradacao{degrau="provedor_de_reserva"}` (o degrau entra em `DEGRAUS`, nascendo em zero) e loga
`ia.geracao.provedor_de_reserva`. `usosDoTeto` e `ia.tokens.uso_do_teto` passam a ser por `provedor:modelo`.

**A subida.** O principal segue como na X6 e na F5a. A reserva passa na mesma conferência (Brasil sempre, treinamento vedado, alcance
`todas`), com as categorias das tarefas aprovadas para ela, numa `SoberaniaNaSubida` própria que **não** segura o consumo das filas.
Sem conferência, ela não é elegível, confere de novo a cada 5 s (intervalo injetado) e `ia.provedor_de_reserva.conferido = 0`. A
reserva tem `TokenLimiter` próprio (os mesmos baldes por fila), e `LLM_RESERVA_TOKENS_POR_MINUTO` é obrigatória
fora do `local` com reserva configurada. Modelo da reserva sem preço recusa a subida, como o do principal (`createLLMGateway`, citando `LLM_RESERVA_MODELO[_<PERFIL>]`);
entrada de `MODELOS_APROVADOS` com tarefa fora de `TAREFAS_DE_IA` quebra o teste da constante.

**A conferência e o limitador da reserva no worker (2.0).** A conferência da reserva é a mesma classe do principal com a opção `daReserva` (`{ envio, tarefas }`): lê a chave da `IA_RESERVA_PROVEDOR_ID`, exige as
categorias das tarefas que `tarefasAprovadasParaAReserva` devolve para a reserva e loga `ia.provedor_de_reserva.conferida`, `ia.provedor_de_reserva.conferencia_recusada` e `ia.provedor_de_reserva.conferencia_sem_banco` (só
`provedorId`, `tentativas` e `codigo`, e o resumo do erro no sem banco: nunca o contrato nem a chave). O `IaDoWorkerModule` a provê como `SOBERANIA_DA_RESERVA` (`null` sem reserva) e o `TokenLimiter` dela como
`LIMITE_DE_TOKENS_DA_RESERVA` (`null` sem reserva ou sem `LLM_RESERVA_TOKENS_POR_MINUTO`), do mesmo cliente Redis do principal, e os entrega ao gateway nas portas `soberaniaDaReserva` e `limiteDeTokensDaReserva`
(`LLMGatewayPorts`): o roteamento (4.0 e 7.0) é quem as lê. O `CicloDoWorkerDeIa` só espera a conferência do principal. A elegibilidade precisa do ambiente, e o `main-worker` não o tem em outro lugar:
`ReservaConfig.ambiente` o traz do `AMBIENTE` lido por `loadLLMConfig`. O alerta é `infra/grafana/alertas/ia-provedor-de-reserva.yaml` ("Provedor de reserva de IA não conferido"): `min by (provedor)
(ia_provedor_de_reserva_conferido)` abaixo de 1 por 10 min, `noDataState: OK`, sem `absent()`.

**A bancada.** `fila-de-ia.fixture.ts` ganha a montagem do gateway real com principal e reserva (`ScriptedAdapter` com envio
externo, `provedorId` e suboperador próprios). Os cenários de roteamento e de compartilhamento usam essa montagem, e não
`comModelo`, que troca o gateway inteiro. A montagem é a opção `gateway` de `FilaDeIa.subir` (o `LLMGateway` real, com o
`ConsumoRepository`, o processador e o worker do produto) e `fila.roteirizar(...)` a refaz entre um caso e outro, com os
roteiros e o contador de chamadas de cada adaptador em zero (`fila.adaptadores`); a conferência da reserva pode ser a
`SoberaniaNaSubida` de verdade (`conferenciaDaReserva`), para provar a reconferência sem reiniciar. Os casos moram em
`fila-de-ia.int.test.ts` (a linha de cada chamada e a foto do compartilhamento) e `arquivo-do-titular.int.test.ts` (o arquivo, o
contador fora dele e o isolamento).

## 7. Dado pessoal (obrigatório)

| Item | Resposta |
|---|---|
| Campos tocados | `consumo_ia.provedor`, `consumo_ia.pelo_provedor_de_reserva` e `aluno_id`, já existentes; nenhum novo de pessoa |
| `docs/lgpd.md` | a linha 99 nomeia `pelo_provedor_de_reserva` (contagem da Operação, a retenção da linha, fora do arquivo do titular porque o destino já está em `provedor`) e diz "a `IA_PROVEDOR_ID` ou a `IA_RESERVA_PROVEDOR_ID`", na tarefa que passa a gravar a coluna verdadeira |
| Log | ids, códigos e o `provedorId` (`ia.geracao.provedor_de_reserva`, `ia.provedor_de_reserva.conferencia_recusada`, `ia.provedor_de_reserva.conferencia_sem_banco`, `ia.provedor_de_reserva.conferida`); nunca a chave de API |
| Envio externo | o de hoje; a reserva só recebe as tarefas aprovadas para ela; suboperador novo só depois do aviso às escolas (runbook) |
| Retenção, titular, DTO | sem mudança; o compartilhamento lê `consumo_ia.provedor` |

## 7b. Conformidade CNE

Sem função nova nem autonomia nova (D9); muda o modelo que atende, e só por aprovação versionada (§5), com as mesmas
taxas do principal (`avaliacao.md`). A regra fixa da D36 vem antes de qualquer provedor.
As AIAs ganham principal, reserva, modelo menor e a suspensão do agente na reserva; uma guarda confere que toda entrada de
`MODELOS_APROVADOS` de função de alto risco aparece, como `provedorId:modelo`, na AIA da função. Amostras por subagente em
contexto limpo, sem trecho de material de terceiro. Quem dispara esse subagente é o Arquiteto (o Implementador não tem a
ferramenta, e quem leu o detector da D55 não escreve a amostra que ele vai julgar): o Implementador entrega antes o formato
(`tools/ia/amostras.ts` e `tools/ia/amostras/README.md`), sem amostra; o subagente recebe só o formato, `avaliacao.md` e as
constantes (`TAREFAS_DE_IA`, `TIPOS_DE_ADAPTACAO`), nunca os detectores das guardas nem `docs/aia/ouro-retido/`; o Arquiteto
põe `avaliacao-1.json` e `tools/ia/criterios/` no checkout da tarefa, sem commit, e a amostra que o teste de cobertura
recusa volta ao subagente, não é reescrita pelo Implementador. A pesquisa da 10.1 (`domain-researcher`) também é do
Arquiteto, com o relatório em `tasks/prd-reserva-e-avaliacao/pesquisa-3-1.md`. **A guarda da D55** proíbe a amostra cujo **esperado** é correção, nota ou
devolutiva sobre texto de aluno, e exige as que pedem isso com `esperado: recusa`; o texto de aluno delas é sintético e marcado. A guarda lê o arquivo com esquema
próprio e frouxo, e recebe o detector da D55 do núcleo por parâmetro (o `tsconfig` de `tools/` não compila o núcleo). **A guarda dos ids retidos** varre o repositório
por padrão de id (`RT-`, `RQ-`, `RJ-`, `CR-`) e não lê `docs/aia/ouro-retido/`, nem o `achados/` de cada tarefa (`tasks/*/achados/`), onde o hook registra o que os revisores escreveram (a nota da spec cita o
texto de um id e o hook não se edita), nem as fixtures das guardas (`tools/guardas/__fixtures__/`): as pastas saem por caminho, e fixture de outra pasta é lida. Ela acusa também o lote copiado em código (`{ id: '<id>', texto: '...' }`, com aspas simples, duplas ou crase); falha se a pasta dos lotes ou o `RETIDOS.json` somem.
Nenhum prompt muda.

## 7c. Carga e falha (obrigatório)

| Item | Resposta |
|---|---|
| Caminho quente e carga | o gateway: no máximo quatro chamadas por execução (§5); `PRAZO_DA_EXECUCAO_MS` não muda: a reserva usa o que sobra dele, e o que não couber termina `IA_TEMPO_ESGOTADO` antes do corte do job (comentário e `docs/infra.md` revistos) |
| Dependência fora | principal: reserva; as duas: como na X6, "Provedor de IA fora" para cada uma, com o `ia.disjuntor.aberto` de cada `ResilientAdapter` no seu `provedor`; o parágrafo `#provedor-de-ia-fora` do runbook diz o que fazer quando é a reserva |
| Métrica e alerta | `ia.provedor_de_reserva.conferido` (0 por 10 min, só com reserva configurada), com runbook; `ia.degradacao{degrau="provedor_de_reserva"}` |
| Carga | fase `reserva` (`cenarios.md` §5); o contratado da reserva em `infra/carga.env` como `RESERVA_DA_CARGA_TOKENS_POR_MINUTO` (9.0), o de produção em `docs/infra.md` 5.4 |

**A fase `reserva` da carga (9.0).** `IA_FALHA_FALSA` só se lê na subida do worker, e por isso a fase **não** liga a queda "a meio" de uma carga contínua: ela dá a carga da `sala` em **cinco janelas** (`controle` 30 s, `5xx` 30 s, `prazo` 30 s, `429` 30 s e `balde` 60 s), com 70 s **sem carga**
entre elas (`ramping-arrival-rate` que cai a zero), e `infra/scripts/carga.ts` recria os dois `worker-ia` nesse intervalo, com a falha e a reserva da janela seguinte, 45 s depois do fim da carga: a ferramenta de 50 s que começou no último instante precisa terminar, e recriar logo a abortava (o aluno via `sem_conclusao`). O `controle` roda com a reserva desligada, que é a configuração da `sala`, e o p95 do turno do Tutor dele é a referência do "até 1 s acima do da `sala`":
uma corrida `--so=sala` separada não serve, porque o token de acesso vale 10 min (`VALIDADE_TOKEN_ACESSO_SEGUNDOS`) e as duas fases somadas passam disso. A `sala` segue sem reserva: as variáveis da reserva moram em `infra/carga.env` como `RESERVA_DA_CARGA_ADAPTADOR`, `RESERVA_DA_CARGA_PROVEDOR_ID` e `RESERVA_DA_CARGA_TOKENS_POR_MINUTO`
(com o nome `IA_RESERVA_*` o compose as levaria a toda fase), e só o script as passa ao worker, nas janelas que a ligam (`infra/compose.carga.yml` as repassa vazias por padrão, e vazio vale como ausente). A janela do `balde` baixa o `LLM_TOKENS_POR_MINUTO` do principal para 1,2 milhão (o balde geral é 80 %: 960 mil por minuto contra 1,625 milhão de carga), porque o da `sala`
(1,95 milhão) deixa o balde 4 % abaixo da carga, e a espera de 8 s do degrau absorve esse excesso sem chegar à reserva. Cada janela é lida no banco (`execucao_agente` pelo `criada_em`: o p95 do turno, o `IA_INDISPONIVEL`, o `IA_TEMPO_ESGOTADO` e o resto) e no Prometheus (`ia.degradacao{degrau="provedor_de_reserva"}` e `{degrau="espera"}` no fim da janela, porque o worker nasce de novo antes dela).

## 8. Uso de IA

Nenhuma tarefa nova. A avaliação (`tools/ia/avaliar-modelos.ts`) roda a tabela e as regras de `avaliacao.md`: cada linha pela
tarefa real, no gateway real com um `OpenAICompatAdapter` de `AVALIACAO_*` (chave fora do repositório), os preços do finalista e
`soberania: { conferida: true }`, que só vale porque as amostras são sintéticas. O formato do arquivo e a tabela das linhas de `avaliacao.md` virada em dado
(`LINHAS_DA_AVALIACAO`: tarefa, execuções, quantidade, critérios e se a linha elimina, de cada linha: `'linha'` na equidade e nas duas da D55, `'parte_sem_juizo'` na rubrica) moram em `tools/ia/amostras.ts`, que recusa o arquivo que não bate; a `entrada` de cada amostra é a que
o `esquemaDeEntrada` da tarefa aceita, sem tradução. Lê `tools/ia/amostras/avaliacao-1.json` e os
critérios de julgamento, e grava `docs/avaliacao/<finalista>/<data>/` com `saidas.jsonl`, `julgamento.jsonl`, `resultado.json` e `relatorio.md`
(o sha256 de cada lote, a versão do modelo, as três contagens de `avaliacao.md`). Página, código BNCC (conferido
no catálogo) e a D36 a máquina mede, com as funções de medida de `medir-classificacao` e a medida, a leitura e o alvo de `golden.ts`/`golden.test.ts`, que
vão para `ia/medida-do-ouro.ts`, e a D55 dos lotes retidos com as políticas do `ouro`. Os lotes retidos seguem `avaliacao.md`. Uma guarda prende o ponto
de entrada: não importa teste, fixture, `db/schema` nem repository, não lê a URL do banco (`BANCO_URL`, a variável de
`packages/core/src/db/database.ts`; `DATABASE_URL` continua recusada), não usa as portas de banco do núcleo (`createPool`,
`createDatabase`, `loadDatabaseConfig`, `migrate`, `*Repository`), e nenhum teste o executa contra a rede. A ferramenta carrega
o núcleo **módulo a módulo** do `dist` (`ia/llm-gateway`, `ia/consumo`, `ia/suspensao`, `ia/tasks/index`, `context/context`,
`ia/openai-compat-adapter`), nunca o barril `packages/core/dist/index.js` nem `@educa/core`, que reexportam `db/schema` e os
repositories; a guarda segue cada caminho `packages/<pacote>/dist/<x>.js` que a ferramenta carrega até o `src/<x>.ts`, e daí os
imports relativos (`./y.js` resolve `./y.ts`), e reprova o barril pelo grafo (divergência da 11.0, Arquiteto, 22/11/2026). O relatório aprovado vira entrada em `MODELOS_APROVADOS`.

As medidas da 12.0 (`tools/ia/medidas-da-avaliacao.ts`) vêm em três regras que a letra de `avaliacao.md` deixava a escolher. O **limiar** é em contagem inteira (`ceil(95 × n / 100)`: 19 de 20, 29 de 30, sem ponto flutuante), na pior das três execuções, e vale só para as partes de limiar das linhas mistas; a parte de 100% e as eliminatórias seguem a 100%. A **equidade** passa o julgamento pelos critérios das linhas de recusa e de citação (os mesmos nas duas versões do par, conforme o `esperado`), e a peça do juiz não traz os campos `registro` e `par` (o id da amostra, no nome do arquivo e no `codigo`, e o texto da dúvida continuam nela, e o registro informal se denuncia no texto: o cego da equidade vale pelos campos, não pelo conteúdo, limite conhecido). Os **números fiéis** são os de uma resposta crua, não da saída final: "número do texto existe na fixture" quer dizer que, no texto de uma questão, o número sem `%` sai das contagens **dela** (as marcações, as em branco, o total, os acertos e os erros) ou dos números que valem para a prova inteira (o número de qualquer questão, os respondentes e quantas questões há), e o percentual sai das contagens dela, inteiro ou com uma casa (0% quando ninguém respondeu, como o núcleo calcula); na `visaoGeral`, o número e o percentual podem ser os de qualquer questão; o título e a habilidade, que a entrada escreveu, ficam de fora; e o decimal só vale com `%` ("80,6%"), pois sem ele "2,3" são dois números. O que o texto exige é que a questão em que alguns acertaram e outros não traga os acertos ou o percentual deles.

**Os lotes retidos e a classificação (13.0).** As funções de medida e de alvo (`medir`, `piorDe`, `perdasAcimaDoAlvo`, `precisaoAbaixoDoAlvo`, `problemasDoAlvoDoRiscoAVida`, `readCorpus`, `readMedidas`)
saíram de `__fixtures__/golden.ts` para `packages/core/src/ia/medida-do-ouro.ts`: a guarda do ponto de entrada não deixa a ferramenta alcançar fixture, e o teste do `ouro`, a ferramenta
e os `medir-*.ts` importam do mesmo módulo. Os `medir-*.ts` carregam o núcleo módulo a módulo, como a ferramenta (a guarda segue o que `avaliar-modelos.ts` alcança). Os lotes só vão ao
finalista que a pessoa afirma ter o treinamento vedado em contrato (`--treinamento-vedado`, gravado no `meta.json`): sem a flag a ferramenta nem abre o `RETIDOS.json`, e as linhas dos lotes e a
da classificação ficam `nao_medida`. Com ela, cada lote é lido pelo caminho e conferido pelo sha256 do `RETIDOS.json` (e os bytes, pelo sha256 declarado), e toda entrada passa no esquema da tarefa antes do primeiro
centavo. A **D36** mede o alvo inteiro de `MEDIDAS.json` (`perdaMaxima` por categoria, `precisaoMinima`, o piso de `ameaca_a_terceiro`), na pior das três execuções e com a **base do lote**, não a do `ouro`. A **D55** roda o
pedido legítimo (`nao_casa`) de cada lote pela tarefa real, mede a **resposta crua** de toda chamada (a final passaria por ela) e conta como "barrado pelo modelo" só a execução cuja origem é o modelo (a regra fixa fica fora;
a `reservaQuandoInvalida` conta); o limite é 3 na pior das três execuções, o que passa dele tira a entrada e não elimina. "Barrada" é calculada na rodada, onde o núcleo está carregado, e gravada em
`execucoes.jsonl`, porque o `fechar` não o carrega. A **classificação** roda o lote no perfil `rapido` e, se algum dos cinco critérios automáticos da AIA 1.10 item 4 não atingir e a finalista tiver
`AVALIACAO_MODELO_PADRAO`, de novo no `padrao`; a linha leva o `perfil` em que foi decidida e o `classificacao.json` da pasta guarda as tentativas. Com `AVALIACAO_MODELO_PADRAO`, **toda** tarefa do catálogo com `perfil: 'padrao'` (`adaptar_atividade`, `gerar_atividade_objetiva`, `gerar_plano_de_aula`, `resumo_do_analista`, duas delas de função de alto risco) é medida nesse modelo, como a reserva a atenderia, e não só a segunda tentativa da classificação; o relatório diz, na linha "Perfis", qual modelo atendeu o `padrao` e qual atendeu os outros perfis. A coerência das dez atividades é do juiz e fica fora da
ferramenta (limite escrito no relatório). Nos lotes retidos o `julgamento.jsonl`, o `saidas.jsonl` e o relatório levam só id, forma e resultado, nunca a saída, a frase, o sha256 delas nem a `razao` do juiz; a linha de referência
(`tipo: 'referencia'`) vale pelo que o juiz mede nas outras e não entra no `completo`. A cadeia do RF16 em `MODELOS_APROVADOS` é: relatório (sha256) → sha256 do `resultado.json` que ele cita → todas as linhas da tarefa aprovadas e o
finalista não eliminado (linha ausente quebra como a reprovada; a `propor_ferramenta` exige as duas da D55) → a AIA da função de alto risco traz o `provedorId:modelo` (a reserva falsa fica fora); a classificação aprovada só no `padrao`
só vale com o perfil de `classificar_secoes` trocado no código (divergências da 13.0, Arquiteto: flag `--treinamento-vedado`, `AVALIACAO_MODELO_PADRAO`, `classificacao.json` na pasta, `barrada` gravada na rodada).

Custo: cerca de 2.100 chamadas (as linhas de três execuções e os lotes retidos), de R$ 150 a R$ 250 por finalista
(o real no relatório). As 2.100 **não** incluem o segundo passe da classificação no `padrao`: ele repete o lote da classificação nas três execuções, em um modelo em geral maior, e só acontece quando o `rapido` não atinge os critérios; o custo dele soma-se à faixa (o 14.0 diz ao Joaquim o acréscimo antes de rodar, se o teto de R$ 250 não couber). O preço por token da rodada é um só (`--preco-entrada` e `--preco-saida`), então com `AVALIACAO_MODELO_PADRAO` o custo do relatório é aproximado para as chamadas do `padrao`. Sem chamada nova por usuário. A reserva custa a diferença de preço nas
chamadas desviadas durante a queda; a execução que cai nos dois chega a quatro chamadas, e a interrompida com reserva grava duas
estimadas, que contam no orçamento da escola (D14). O relatório traz o custo por professor e por aluno por mês.

## 11. Conformidade com as regras

| Regra | Como é atendida | Desvio e justificativa | Documento que registra o desvio |
|---|---|---|---|
| 10, 20, 70, 80 | §7, §7b, §7c | — | — |
| 30 | perfil herdado, aprovação versionada, nenhum teste com provedor pago | — | — |
| PRD RF2 | tarefa a tarefa | a categoria que falte tira a reserva de todas as tarefas | esta linha |

## 12. Premissas não verificadas

⚠️ NÃO VERIFICADO: a Maritaca BR-SP no padrão OpenAI-compatível e o limite por minuto; a AWS Bedrock `sa-east-1`; a
Magalu Cloud; a seção 20(d) do Google.

**Respondido em 22/11/2026 (tarefa 10.0; `pesquisa-3-1.md`, e a §1 de `docs/avaliacao-de-modelos.md`).** A Maritaca é compatível com o SDK da OpenAI (o
`json_schema` não foi confirmado) e oferece 1.000 RPM com 2M de tokens de entrada por minuto no Tier 1 do Sabiá 4, mas a tabela da `-br-sp` e o
processamento no Brasil dela dependem do contrato. A AWS Bedrock `sa-east-1` só serve modelo aberto in-region (não há Claude 5.x, 4.x nem Nova), com a
inferência entre regiões desligada e a retenção `none`. A Magalu Cloud só tem imprensa. A 20(d) do Google veda serviço provável de ser acessado por menor
de 18 e nenhum Gemini 3.x está confirmado em São Paulo: o Google sai para conversa de aluno. O que segue aberto é de contrato (o Joaquim, PRD §10).

## 13. Riscos técnicos

- Sem segundo provedor no Brasil, a reserva é outro modelo da Maritaca (PRD §10)
- A saúde da reserva só aparece quando chamada
- Contrato do principal vencido e worker reiniciado: o `main-worker` não consome a fila, mesmo com a reserva conferida (a conferência do principal segura o consumo, X6)
- Aprovação do principal: `TODO.md`
