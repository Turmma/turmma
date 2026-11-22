# Tarefa 1.0 — A reserva sobe configurada: identidade, aprovação por tarefa e modelo, e as recusas da subida

**Funcionalidade:** reserva-e-avaliacao · **Depende de:** nenhuma (a F5a já pousou)
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`
**Porte:** grande

## Objetivo

A configuração monta um segundo adaptador, o provedor de reserva, com `identidade` própria; `MODELOS_APROVADOS` diz para que
tarefa e modelo ele vale; `reservaElegivel` responde se ele pode atender uma tarefa; a subida recusa a reserva mal configurada.
Nenhuma chamada vai à reserva ainda (4.0).

## Contexto necessário

- `techspec.md` §2, §5 ("A aprovação", "A identidade", "A subida"), §7, §11
- `prd.md` RF1, RF2, RF4, RF6, §8b
- `cenarios.md` §1: as linhas RF1, RF2, RF4 e RF6 da tabela abaixo
- Código: `llm-config.ts` (`MOTIVO_ADAPTADOR_FALSO_EM_PRODUCAO`, `exigePreco`), os adaptadores, `soberania.ts` (`motivosDaD62`),
  `llm-gateway.ts` (`chaveDoBalde`, `chamadaFeita`, `exigirPrecoDosModelos`)

## Subtarefas

- [x] 1.1 — `IA_RESERVA_ADAPTADOR`, `LLM_RESERVA_BASE_URL`, `LLM_RESERVA_MODELO[_<PERFIL>]`, `LLM_RESERVA_CHAVE_API` (sem lista de
  variáveis secretas no repositório: a proteção é o gitleaks do portão, que lê qualquer arquivo, mais o caso "nunca na mensagem de erro"), `IA_RESERVA_PROVEDOR_ID`, `LLM_RESERVA_TOKENS_POR_MINUTO`; `.env.example` e `infra/carga.env` (`falso-reserva`)
- [x] 1.2 — `identidade` em todo adaptador; cada leitura de `envio.provedorId ?? origem` passa a ela
  (`grep -rn "provedorId ?? " packages/core/src/ia`), sem mudar o que o principal grava
- [x] 1.3 — `modelos-aprovados.ts`: a constante (injetável), a guarda que recalcula o sha256 do `relatorio.md`, a entrada de
  `falso-reserva` com o relatório sintético em `docs/avaliacao/falso-reserva/`
- [x] 1.4 — `reservaElegivel(tarefa, ambiente)`: configurada, conferida (por porta; a 2.0 liga) e com a entrada que bate em provedor
  e modelo do perfil; o falso só fora de produção; as categorias exigidas são as das tarefas aprovadas
- [x] 1.5 — As recusas da subida e o preço da reserva no `exigirPrecoDosModelos`; a chave nunca na mensagem
- [x] 1.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/config/llm-config.ts`, `packages/core/src/config/llm-config.test.ts`, `.env.example`, `infra/carga.env` | alterado |
| `packages/core/src/ia/adapter.ts`, `packages/core/src/ia/fake-adapter.ts`, `packages/core/src/ia/fake-adapter.test.ts`, `packages/core/src/ia/openai-compat-adapter.ts`, `packages/core/src/ia/__fixtures__/scripted-adapter.ts` | alterado |
| `packages/core/src/ia/resilient-adapter.ts`, `packages/core/src/ia/llm-gateway.ts`, `packages/core/src/ia/llm-gateway.test.ts` | alterado |
| `packages/core/src/ia/modelos-aprovados.ts`, `packages/core/src/ia/modelos-aprovados.test.ts`, `docs/avaliacao/falso-reserva/relatorio.md` | novo |
| `packages/core/src/ia/soberania.ts`, `packages/core/src/ia/soberania.test.ts`, `packages/core/src/index.ts` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| fora do Brasil, aprovada só para `relatorio_da_correcao`, e outra só para a geração: não elegível | U | Brasil sempre | tarefas sem texto de aluno | `soberania.test.ts` › "fora do Brasil não é elegível, qualquer que seja a tarefa aprovada: a de trabalho do aluno sem texto de aluno e a só de material" |
| só `material_da_escola`, aprovada para a geração e o Tutor: `categoria_faltando:conversa_do_aluno` | U | as categorias das aprovadas | o Tutor aprovado | `soberania.test.ts` › "controle negativo: contrato só do material da escola, reserva aprovada para a geração e para o Tutor: a categoria da conversa do aluno falta" |
| a mesma, aprovada só para a geração: conferida | U | controle positivo | o catálogo exigiria a conversa | `soberania.test.ts` › "controle positivo: o mesmo contrato, reserva aprovada só para a geração: conferida" (e › "as categorias saem das tarefas, sem repetir, na ordem em que aparecem; sem tarefa, nenhuma") |
| tarefa fora de `TAREFAS_DE_IA`, sem `relatorio`, `sha256` ou `aprovadoPor`, relatório ausente, sha256 errado, também no falso: quebra | U | a guarda | um campo por caso | `modelos-aprovados.test.ts` › "cada defeito quebra, um por caso, também na entrada do falso" (e › "a guarda recalcula o hash do texto que o leitor devolve…") |
| `producao` recusa a entrada de `falso-reserva` e aceita outra; `local` e `staging` aceitam o falso | U | o falso fora de produção | três ambientes | `modelos-aprovados.test.ts` › "a entrada do `falso-reserva` não vale em produção e vale em `local` e em `staging`; a de outro provedor vale nos três" |
| `reservaElegivel`: outro `provedorId` com o mesmo modelo; o mesmo provedor com outro modelo: não elegível | U | provedor e modelo, na função | um campo trocado | `modelos-aprovados.test.ts` › "outro provedorId com o mesmo modelo não é elegível, e o mesmo provedor com outro modelo também não" (e › "o modelo que conta é o do perfil da tarefa…") |
| `producao` com a reserva falsa, ou `falso-reserva` sobre `openai_compat`: recusa citando a variável | U | a subida | os dois caminhos | `llm-config.test.ts` › "em produção a reserva falsa é recusada, e a identidade `falso-reserva` sobre `openai_compat` também; fora dela, as duas sobem" |
| mesma identidade, também em `local`: recusa; `openai_compat` nos dois e modelos todos diferentes: sobe; um perfil igual, o `rapido` da reserva igual ao `padrao` do principal, um igual ao menor: recusa | U | "outro modelo da Maritaca" | perfis cruzados e o menor | `llm-config.test.ts` › "a mesma identidade do principal recusa em qualquer ambiente…", › "`openai_compat` nos dois e nenhum modelo da reserva igual a um do principal…" e › "com a mesma identidade, modelo repetido recusa citando a variável do perfil: o mesmo perfil, o perfil cruzado e o menor do principal" |
| `LLM_RESERVA_TOKENS_POR_MINUTO` ausente fora do `local`: recusa; no `local`, sobe | U | regra 80.4 | os dois ambientes | `llm-config.test.ts` › "LLM_RESERVA_TOKENS_POR_MINUTO é obrigatória fora de `local` com a reserva configurada, e no `local` a reserva sobe sem ela" |
| `LLM_RESERVA_MODELO` e `LLM_RESERVA_MODELO_<PERFIL>` sem preço: recusa citando cada um | U | RF6 | um perfil com preço, outro sem | `llm-gateway.test.ts` › "createLLMGateway: fora de `local`, o modelo da reserva precisa de preço, na identidade dela" (os seis casos do describe) |
| reserva meio configurada: recusa citando a que falta | U | a subida | uma variável por vez | `llm-config.test.ts` › "reserva meio configurada recusa citando a variável que falta, uma por vez" e › "variável da reserva sem IA_RESERVA_ADAPTADOR recusa citando-o…" |
| `LLM_RESERVA_CHAVE_API` nunca na mensagem | U | regra 20 | valor reconhecível | `llm-config.test.ts` › "a chave da reserva entra na configuração e nunca na mensagem de erro"; `llm-gateway.test.ts` › "`LLM_RESERVA_MODELO` sem preço recusa citando a variável, nunca o valor" |
| `falso-reserva`: balde, rótulo, disjuntor e chave do preço dela; na linha, `provedor` nulo, `pelo_provedor_de_reserva = true` e o preço dela | U | a identidade | dois falsos, o mesmo modelo, preços injetados diferentes | `llm-gateway.test.ts` › "a identidade do adaptador: a reserva falsa é outro provedor para o balde, o rótulo, o disjuntor e o preço" › "o mesmo falso com a identidade da reserva: tudo é `falso-reserva`, o preço é o dela, e na linha o provedor continua nulo (nada saiu)" (a coluna `pelo_provedor_de_reserva`: Divergência 1) |
| sem reserva, as linhas do principal como hoje | U | sem regressão | o caso de envio externo | `llm-gateway.test.ts` › "o balde, o rótulo `provedor` das medidas, o disjuntor e a chave do preço são os do falso do principal: `falso`" e › "o balde e a linha do adaptador com envio externo leem a identidade de cada instância, e não um provedor fixo" |

## Como testar

- Subida: `llm-config.test.ts` › "em produção o adaptador falso é recusado…", › "a chave do provedor entra na configuração e nunca na
  mensagem de erro", › "LLM_TOKENS_POR_MINUTO é obrigatória fora de local…" e › "fora de `local`, com `openai_compat`, o preço do modelo é
  exigido na subida…"
- D62: `soberania.test.ts` › "cada campo errado ao mesmo tempo aparece…" e › "o cadastro sem uma categoria que uma tarefa envia não confere…"
- Hash: `tools/ia/medir-classificacao.test.ts` › "mudar a referência de uma linha, ou os aceitáveis dela, muda o hash…"
- Identidade: `llm-gateway.test.ts` › "com envio externo, o id do provedor que atendeu vai junto…"; `token-limiter.test.ts` › "o balde é
  de cada provedor:modelo…"
- `npx vitest run --project unidade packages/core/src/ia/ packages/core/src/config/`

## Fora do escopo desta tarefa

A conferência no worker e o alerta (2.0); o roteamento (4.0 a 7.0); a guarda do RF16 (13.0).

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano antes de codar.

1. **Mutação de cada cláusula:** são 59 blocos em "Mutações", um por termo de cada `&&`/`||` e um por condição, `??` e ternário que o diff acrescenta em `llm-config.ts`, `fake-adapter.ts`, `openai-compat-adapter.ts`, `llm-gateway.ts` e `modelos-aprovados.ts`; as linhas sem condição que protegem (a leitura de `adaptador.identidade` no balde, no rótulo e na chave do preço) caem nos testes de identidade do `llm-gateway.test.ts`. O `--faltando` está vazio, e os 59 blocos foram aplicados um a um fora do portão: todos ficaram vermelhos. Um termo só estreita o tipo e tem motivo escrito.
2. **Texto na tela:** a tarefa não tem tela nem texto novo de interface; nenhum `e2e/` a cita.
3. **"O que distingue" no teste:** cada linha da tabela tem o segundo dado na coluna "Caso": dois provedores com o mesmo modelo, perfil cruzado e menor do principal, três ambientes, um perfil com preço e outro sem, dois falsos com o mesmo modelo e preços diferentes.
4. **Checagem anterior que responde antes:** os testes de configuração passam por `loadLLMConfig` de verdade e os de subida por `createLLMGateway`, e cada recusa é lida pelas variáveis e pelos motivos (não pela mensagem); o caso "preço da reserva" fixa o principal com preço, para a recusa vir da reserva e não do principal. O dublê da conferência é a porta `DeclaracaoDeSoberania` com `conferida`, como a 2.0 a entrega.
5. **Asserção sobre o resultado:** o balde, o rótulo e o disjuntor são lidos nos pedidos do limitador e nas medidas emitidas (`MedidorDeTeste`), e o custo na linha gravada, com preços diferentes por identidade; nenhuma asserção sobre texto de arquivo, salvo a de `.env.example` e `infra/carga.env`, que carregam pela configuração.
6. **Guarda nova:** `problemasDosModelosAprovados` é a guarda do `sha256`: um caso por defeito (seis), um que recalcula o hash do texto devolvido pelo leitor, e o da constante de hoje contra o disco; relatório que some vira `relatorio_ausente`, e não passa em silêncio.
7. **Comentário que afirma o que o código não faz:** conferi os docblocks de `llm-config.ts`, `llm-gateway.ts` e `modelos-aprovados.ts` contra o código: nenhum diz que a reserva atende chamada (nenhuma atende antes da 4.0), e o do `adaptadorDaReserva` diz que quem o põe no caminho é o `main-worker` (2.0). `docs/glossario.md` ganhou "Identidade do adaptador", com os nomes lidos do código (`falso`, `falso-reserva`, `IA_PROVEDOR_ID`).
8. **Divergência:** são duas, nenhuma muda regra nem cria trava; a coluna "Onde está na spec" cita o `grep` da palavra (`pelo_provedor_de_reserva`, `reservaElegivel`) em `techspec.md`, `cenarios.md`, `4_task.md`, `5_task.md` e `2_task.md`, e o `prd.md` não diz o contrário (RF5 e RF6 só pedem o provedor na linha e o preço).
9. **Peça que já existe:** `motivosDaD62` e `SoberaniaNaSubida` são reaproveitadas (só ganhou `categoriasDasTarefas`), o `OpenAICompatAdapter` e o `FakeAdapter` montam a reserva, e `exigirPrecoDosModelos` ganhou um grupo em vez de uma função paralela; `IDENTIDADE_DA_RESERVA_FALSA` mora em `llm-config.ts`, onde `modelos-aprovados.ts` e `consumo.ts` a importam.
10. **Concorrência:** a tarefa não tem operação concorrente (configuração, constante e função pura); a corrida da reserva com o principal é da 4.0.
11. **Isolamento e coluna "Caso":** nenhuma tabela, repository ou endpoint (sem `escolaId` a testar); a coluna "Caso" da tabela tem o teste de cada linha, um por coisa que ela diz.
12. **"O que verificar" dos guardiões:** `tenancy-guardian` e `privacy-guardian`: sem tabela, query, campo de pessoa nem log novo; a chave `LLM_RESERVA_CHAVE_API` só entra em `ModelConfig.chaveApi` e nunca em mensagem de erro (caso próprio). `conformidade-reviewer`: a reserva só atende tarefa aprovada (por tarefa, provedor e modelo), o Tutor só com aprovação própria (RF4), e o falso não vale em produção. `infra-guardian`: o contratado da reserva é obrigatório fora de `local` (regra 80.4) e o limitador dela é da 2.0. `llm-integrator`: nenhuma chamada nova, então a estimativa de custo não se aplica; o preço da reserva é exigido fora de `local`. O `achados/indice.md` só tem rodadas de `revisao-spec` (nenhuma exigência de tarefa ainda).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| A coluna `pelo_provedor_de_reserva = true` da linha de `falso-reserva` (linha 13 da tabela de testes) não é provada nesta tarefa: a 1.0 prova que a linha leva o `provedor` nulo e o preço da reserva, e a coluna fica para a 4.0 e a 5.0 | `ConsumoDeIa` ainda não tem `peloProvedorDeReserva`, e nenhuma chamada vai à reserva antes da 4.0: a coluna só é verdadeira na linha de chamada que saiu para ela, e quem a põe é o destino por chamada | `techspec.md` §3 (`pelo_provedor_de_reserva`: "Com a reserva falsa, `provedor` nulo e a coluna verdadeira") e §5 "O destino por chamada" (`ConsumoDeIa` ganha `peloProvedorDeReserva`); `cenarios.md` linha 38 (RF4, "A reserva falsa com `IA_RESERVA_PROVEDOR_ID=falso-reserva`"); `4_task.md` 4.1 (a coluna no tipo e no `InMemoryConsumo`) e `5_task.md` 5.1 (a gravação no banco) |
| `reservaElegivel(tarefa, ambiente)`, como a 1.4 a escreve, vira `reservaElegivel(tarefa, { reserva, soberania, ambiente, aprovados })` | A elegibilidade lê quatro coisas: a reserva configurada (identidade e modelo de cada perfil), a conferência da D62 dela por porta (a 2.0 liga), o ambiente e a constante, injetável para o teste; com só o ambiente, a função leria o módulo e não daria como provar "o mesmo provedor com outro modelo" | `techspec.md` §5 "A aprovação" ("O provedor de reserva é **elegível** para uma tarefa se configurado, conferido…", sem assinatura); `2_task.md` linha 28 (a conferência liga a porta da `reservaElegivel`) |

## Mutações

--faltando: 60 linhas (59 blocos, 1 motivos)

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-LLM_RESERVA_BASE_URL: opcional(z.url({ protocol: /^https?$/ }).optional()),
+LLM_RESERVA_BASE_URL: opcional(z.url().optional()),
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-if (valores.IA_ADAPTADOR === 'falso') return 'falso'
+// sem a identidade do falso
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-return valores.LLM_PROCESSAMENTO_LOCAL === 'true' ? 'openai_compat' : valores.IA_PROVEDOR_ID
+return valores.LLM_PROCESSAMENTO_LOCAL === 'true' ? valores.IA_PROVEDOR_ID : 'openai_compat'
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-if (adaptador === undefined) {
+if (adaptador !== undefined) {
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-if (definidas.some((valor) => valor !== undefined)) problema('IA_RESERVA_ADAPTADOR', MOTIVO_RESERVA_SEM_ADAPTADOR)
+if (definidas.some((valor) => valor === undefined)) problema('IA_RESERVA_ADAPTADOR', MOTIVO_RESERVA_SEM_ADAPTADOR)
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-if (valores.AMBIENTE === 'producao' && adaptador === 'falso') problema('IA_RESERVA_ADAPTADOR', MOTIVO_RESERVA_FALSA_EM_PRODUCAO)
+if (adaptador === 'falso') problema('IA_RESERVA_ADAPTADOR', MOTIVO_RESERVA_FALSA_EM_PRODUCAO)
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-if (valores.AMBIENTE === 'producao' && adaptador === 'falso') problema('IA_RESERVA_ADAPTADOR', MOTIVO_RESERVA_FALSA_EM_PRODUCAO)
+if (valores.AMBIENTE === 'producao') problema('IA_RESERVA_ADAPTADOR', MOTIVO_RESERVA_FALSA_EM_PRODUCAO)
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-if (valores.AMBIENTE !== 'local' && valores.LLM_RESERVA_TOKENS_POR_MINUTO === undefined) problema('LLM_RESERVA_TOKENS_POR_MINUTO', MOTIVO_SEM_TOKENS_POR_MINUTO_DA_RESERVA)
+if (valores.LLM_RESERVA_TOKENS_POR_MINUTO === undefined) problema('LLM_RESERVA_TOKENS_POR_MINUTO', MOTIVO_SEM_TOKENS_POR_MINUTO_DA_RESERVA)
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-if (valores.AMBIENTE !== 'local' && valores.LLM_RESERVA_TOKENS_POR_MINUTO === undefined) problema('LLM_RESERVA_TOKENS_POR_MINUTO', MOTIVO_SEM_TOKENS_POR_MINUTO_DA_RESERVA)
+if (valores.AMBIENTE !== 'local') problema('LLM_RESERVA_TOKENS_POR_MINUTO', MOTIVO_SEM_TOKENS_POR_MINUTO_DA_RESERVA)
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-if (adaptador === 'openai_compat') conferirOEnvioDaReserva(valores, problema)
+if (adaptador === 'falso') conferirOEnvioDaReserva(valores, problema)
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-if (valores.LLM_RESERVA_BASE_URL === undefined) problema('LLM_RESERVA_BASE_URL', MOTIVO_RESERVA_SEM_ENDERECO)
+if (valores.LLM_RESERVA_BASE_URL !== undefined) problema('LLM_RESERVA_BASE_URL', MOTIVO_RESERVA_SEM_ENDERECO)
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-if (valores.IA_RESERVA_PROVEDOR_ID === undefined) problema('IA_RESERVA_PROVEDOR_ID', MOTIVO_RESERVA_SEM_PROVEDOR_ID)
+if (valores.IA_RESERVA_PROVEDOR_ID !== undefined) problema('IA_RESERVA_PROVEDOR_ID', MOTIVO_RESERVA_SEM_PROVEDOR_ID)
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-if (valores.LLM_RESERVA_MODELO === undefined && Object.values(modelosDaReservaPorPerfil(valores)).includes(undefined)) problema('LLM_RESERVA_MODELO', MOTIVO_RESERVA_SEM_MODELO)
+if (Object.values(modelosDaReservaPorPerfil(valores)).includes(undefined)) problema('LLM_RESERVA_MODELO', MOTIVO_RESERVA_SEM_MODELO)
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-if (valores.LLM_RESERVA_MODELO === undefined && Object.values(modelosDaReservaPorPerfil(valores)).includes(undefined)) problema('LLM_RESERVA_MODELO', MOTIVO_RESERVA_SEM_MODELO)
+if (valores.LLM_RESERVA_MODELO === undefined) problema('LLM_RESERVA_MODELO', MOTIVO_RESERVA_SEM_MODELO)
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-if (valores.AMBIENTE === 'producao' && valores.IA_RESERVA_PROVEDOR_ID === IDENTIDADE_DA_RESERVA_FALSA) problema('IA_RESERVA_PROVEDOR_ID', MOTIVO_RESERVA_COM_IDENTIDADE_FALSA_EM_PRODUCAO)
+if (valores.IA_RESERVA_PROVEDOR_ID === IDENTIDADE_DA_RESERVA_FALSA) problema('IA_RESERVA_PROVEDOR_ID', MOTIVO_RESERVA_COM_IDENTIDADE_FALSA_EM_PRODUCAO)
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-if (valores.AMBIENTE === 'producao' && valores.IA_RESERVA_PROVEDOR_ID === IDENTIDADE_DA_RESERVA_FALSA) problema('IA_RESERVA_PROVEDOR_ID', MOTIVO_RESERVA_COM_IDENTIDADE_FALSA_EM_PRODUCAO)
+if (valores.AMBIENTE === 'producao') problema('IA_RESERVA_PROVEDOR_ID', MOTIVO_RESERVA_COM_IDENTIDADE_FALSA_EM_PRODUCAO)
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-const modelosDoPrincipal = new Set<string | undefined>([...PERFIS.map((perfil) => doPrincipal[perfil] ?? valores.LLM_MODELO), ...menores])
+const modelosDoPrincipal = new Set<string | undefined>([...PERFIS.map((perfil) => doPrincipal[perfil]), ...menores])
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-return PERFIS.filter((perfil) => modelosDoPrincipal.has(daReserva[perfil] ?? valores.LLM_RESERVA_MODELO ?? ''))
+return PERFIS.filter((perfil) => modelosDoPrincipal.has(valores.LLM_RESERVA_MODELO ?? ''))
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-const identidadeDaReserva = adaptador === 'falso' ? (valores.IA_RESERVA_PROVEDOR_ID ?? IDENTIDADE_DA_RESERVA_FALSA) : valores.IA_RESERVA_PROVEDOR_ID
+const identidadeDaReserva = adaptador === 'falso' ? (valores.IA_RESERVA_PROVEDOR_ID ?? 'sem-id') : valores.IA_RESERVA_PROVEDOR_ID
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-const identidadeDaReserva = adaptador === 'falso' ? (valores.IA_RESERVA_PROVEDOR_ID ?? IDENTIDADE_DA_RESERVA_FALSA) : valores.IA_RESERVA_PROVEDOR_ID
+const identidadeDaReserva = adaptador !== 'falso' ? (valores.IA_RESERVA_PROVEDOR_ID ?? IDENTIDADE_DA_RESERVA_FALSA) : valores.IA_RESERVA_PROVEDOR_ID
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-if (identidadeDaReserva !== identidadeDoPrincipal(valores)) return
+if (identidadeDaReserva === identidadeDoPrincipal(valores)) return
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-if (valores.IA_ADAPTADOR !== 'openai_compat' || adaptador !== 'openai_compat') {
+if (adaptador !== 'openai_compat') {
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-if (valores.IA_ADAPTADOR !== 'openai_compat' || adaptador !== 'openai_compat') {
+if (valores.IA_ADAPTADOR !== 'openai_compat') {
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-return doPerfil[perfil] === undefined ? comum : `${comum}_${perfil.toUpperCase()}`
+return doPerfil[perfil] !== undefined ? comum : `${comum}_${perfil.toUpperCase()}`
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-return reserva === undefined ? {} : { reserva }
+return reserva !== undefined ? {} : { reserva }
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-if (adaptador === undefined) return undefined
+if (adaptador !== undefined) return undefined
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-const identidade = valores.IA_RESERVA_PROVEDOR_ID ?? IDENTIDADE_DA_RESERVA_FALSA
+const identidade = valores.IA_RESERVA_PROVEDOR_ID ?? 'sem-id'
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-...(exigeOPreco({ AMBIENTE: valores.AMBIENTE, IA_ADAPTADOR: adaptador }) ? { exigePreco: true as const } : {}),
+...(exigeOPreco({ AMBIENTE: valores.AMBIENTE, IA_ADAPTADOR: adaptador }) ? {} : { exigePreco: true as const }),
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-...(valores.LLM_RESERVA_TOKENS_POR_MINUTO === undefined ? {} : { tokensPorMinuto: valores.LLM_RESERVA_TOKENS_POR_MINUTO }),
+...(valores.LLM_RESERVA_TOKENS_POR_MINUTO !== undefined ? {} : { tokensPorMinuto: valores.LLM_RESERVA_TOKENS_POR_MINUTO }),
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-if (adaptador !== 'openai_compat' || valores.LLM_RESERVA_BASE_URL === undefined) return base
+if (valores.LLM_RESERVA_BASE_URL === undefined) return base
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-modelos: Object.fromEntries(PERFIS.map((perfil) => [perfil, doPerfil[perfil] ?? comum])) as Record<Perfil, string>,
+modelos: Object.fromEntries(PERFIS.map((perfil) => [perfil, comum])) as Record<Perfil, string>,
```

```mutacao
arquivo: packages/core/src/config/llm-config.ts
teste: packages/core/src/config/llm-config.test.ts
-...(valores.LLM_RESERVA_CHAVE_API === undefined ? {} : { chaveApi: valores.LLM_RESERVA_CHAVE_API }),
+...(valores.LLM_RESERVA_CHAVE_API !== undefined ? {} : { chaveApi: valores.LLM_RESERVA_CHAVE_API }),
```

```mutacao
arquivo: packages/core/src/ia/fake-adapter.ts
teste: packages/core/src/ia/fake-adapter.test.ts
-this.identidade = opcoes.identidade ?? 'falso'
+this.identidade = opcoes.identidade ?? 'sem-id'
```

```mutacao
arquivo: packages/core/src/ia/openai-compat-adapter.ts
teste: packages/core/src/ia/openai-compat-adapter.test.ts
-this.identidade = this.envio.provedorId ?? this.origem
+this.identidade = this.envio.provedorId ?? 'sem-origem'
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts
-if (variaveis.length === 0) return
+if (variaveis.length === 1) return
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts
-if (reserva?.exigePreco !== true) return []
+if (reserva?.exigePreco === true) return []
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts
-...(identidade === undefined ? {} : { identidade }),
+...(identidade !== undefined ? {} : { identidade }),
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts
-...(config.latenciaFalsaMs === undefined ? {} : { latenciaMs: config.latenciaFalsaMs }),
+...(config.latenciaFalsaMs !== undefined ? {} : { latenciaMs: config.latenciaFalsaMs }),
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts
-...(config.latenciaFalsaMsPadrao === undefined ? {} : { latenciaMsPadrao: config.latenciaFalsaMsPadrao }),
+...(config.latenciaFalsaMsPadrao !== undefined ? {} : { latenciaMsPadrao: config.latenciaFalsaMsPadrao }),
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts
-...(config.tokensFalsos === undefined ? {} : { tokens: config.tokensFalsos }),
+...(config.tokensFalsos !== undefined ? {} : { tokens: config.tokensFalsos }),
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts
 const { reserva } = config
-if (reserva === undefined) return undefined
+if (reserva !== undefined) return undefined
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts
-if (reserva.modelo !== undefined) return new OpenAICompatAdapter(reserva.modelo)
+if (reserva.modelo === undefined) return new OpenAICompatAdapter(reserva.modelo)
```

```mutacao
arquivo: packages/core/src/ia/modelos-aprovados.ts
teste: packages/core/src/ia/modelos-aprovados.test.ts
-if (!(TAREFAS_DE_IA as readonly string[]).includes(entrada.tarefa)) problema('tarefa_fora_de_TAREFAS_DE_IA')
+if ((TAREFAS_DE_IA as readonly string[]).includes(entrada.tarefa)) problema('tarefa_fora_de_TAREFAS_DE_IA')
```

```mutacao
arquivo: packages/core/src/ia/modelos-aprovados.ts
teste: packages/core/src/ia/modelos-aprovados.test.ts
-if (entrada.aprovadoPor === '') problema('sem_aprovadoPor')
+if (entrada.aprovadoPor !== '') problema('sem_aprovadoPor')
```

```mutacao
arquivo: packages/core/src/ia/modelos-aprovados.ts
teste: packages/core/src/ia/modelos-aprovados.test.ts
-if (entrada.sha256 === '') problema('sem_sha256')
+if (entrada.sha256 !== '') problema('sem_sha256')
```

```mutacao
arquivo: packages/core/src/ia/modelos-aprovados.ts
teste: packages/core/src/ia/modelos-aprovados.test.ts
-if (entrada.relatorio === '') {
+if (entrada.relatorio !== '') {
```

```mutacao
arquivo: packages/core/src/ia/modelos-aprovados.ts
teste: packages/core/src/ia/modelos-aprovados.test.ts
-if (texto === undefined) problema(`relatorio_ausente:${entrada.relatorio}`)
+if (texto !== undefined) problema(`relatorio_ausente:${entrada.relatorio}`)
```

```mutacao
arquivo: packages/core/src/ia/modelos-aprovados.ts
teste: packages/core/src/ia/modelos-aprovados.test.ts
-else if (entrada.sha256 !== '' && createHash('sha256').update(texto).digest('hex') !== entrada.sha256) problema(`sha256_diferente:${entrada.relatorio}`)
+else if (createHash('sha256').update(texto).digest('hex') !== entrada.sha256) problema(`sha256_diferente:${entrada.relatorio}`)
```

```mutacao
arquivo: packages/core/src/ia/modelos-aprovados.ts
teste: packages/core/src/ia/modelos-aprovados.test.ts
-else if (entrada.sha256 !== '' && createHash('sha256').update(texto).digest('hex') !== entrada.sha256) problema(`sha256_diferente:${entrada.relatorio}`)
+else if (entrada.sha256 !== '') problema(`sha256_diferente:${entrada.relatorio}`)
```

```mutacao
arquivo: packages/core/src/ia/modelos-aprovados.ts
teste: packages/core/src/ia/modelos-aprovados.test.ts
-(entrada) => entrada.tarefa === tarefa.nome && entrada.provedorId === reserva.identidade && entrada.modelo === modelo && (ambiente !== 'producao' || entrada.provedorId !== IDENTIDADE_DA_RESERVA_FALSA),
+(entrada) => entrada.provedorId === reserva.identidade && entrada.modelo === modelo && (ambiente !== 'producao' || entrada.provedorId !== IDENTIDADE_DA_RESERVA_FALSA),
```

```mutacao
arquivo: packages/core/src/ia/modelos-aprovados.ts
teste: packages/core/src/ia/modelos-aprovados.test.ts
-(entrada) => entrada.tarefa === tarefa.nome && entrada.provedorId === reserva.identidade && entrada.modelo === modelo && (ambiente !== 'producao' || entrada.provedorId !== IDENTIDADE_DA_RESERVA_FALSA),
+(entrada) => entrada.tarefa === tarefa.nome && entrada.modelo === modelo && (ambiente !== 'producao' || entrada.provedorId !== IDENTIDADE_DA_RESERVA_FALSA),
```

```mutacao
arquivo: packages/core/src/ia/modelos-aprovados.ts
teste: packages/core/src/ia/modelos-aprovados.test.ts
-(entrada) => entrada.tarefa === tarefa.nome && entrada.provedorId === reserva.identidade && entrada.modelo === modelo && (ambiente !== 'producao' || entrada.provedorId !== IDENTIDADE_DA_RESERVA_FALSA),
+(entrada) => entrada.tarefa === tarefa.nome && entrada.provedorId === reserva.identidade && (ambiente !== 'producao' || entrada.provedorId !== IDENTIDADE_DA_RESERVA_FALSA),
```

```mutacao
arquivo: packages/core/src/ia/modelos-aprovados.ts
teste: packages/core/src/ia/modelos-aprovados.test.ts
-(entrada) => entrada.tarefa === tarefa.nome && entrada.provedorId === reserva.identidade && entrada.modelo === modelo && (ambiente !== 'producao' || entrada.provedorId !== IDENTIDADE_DA_RESERVA_FALSA),
+(entrada) => entrada.tarefa === tarefa.nome && entrada.provedorId === reserva.identidade && entrada.modelo === modelo,
```

```mutacao
arquivo: packages/core/src/ia/modelos-aprovados.ts
teste: packages/core/src/ia/modelos-aprovados.test.ts
-(entrada) => entrada.tarefa === tarefa.nome && entrada.provedorId === reserva.identidade && entrada.modelo === modelo && (ambiente !== 'producao' || entrada.provedorId !== IDENTIDADE_DA_RESERVA_FALSA),
+(entrada) => entrada.tarefa === tarefa.nome && entrada.provedorId === reserva.identidade && entrada.modelo === modelo && (entrada.provedorId !== IDENTIDADE_DA_RESERVA_FALSA),
```

```mutacao
arquivo: packages/core/src/ia/modelos-aprovados.ts
teste: packages/core/src/ia/modelos-aprovados.test.ts
-(entrada) => entrada.tarefa === tarefa.nome && entrada.provedorId === reserva.identidade && entrada.modelo === modelo && (ambiente !== 'producao' || entrada.provedorId !== IDENTIDADE_DA_RESERVA_FALSA),
+(entrada) => entrada.tarefa === tarefa.nome && entrada.provedorId === reserva.identidade && entrada.modelo === modelo && (ambiente !== 'producao'),
```

```mutacao
arquivo: packages/core/src/ia/modelos-aprovados.ts
teste: packages/core/src/ia/modelos-aprovados.test.ts
-if (reserva === undefined || contexto.soberania?.conferida !== true) return false
+if (contexto.soberania?.conferida !== true) return false
```

```mutacao
arquivo: packages/core/src/ia/modelos-aprovados.ts
teste: packages/core/src/ia/modelos-aprovados.test.ts
-if (reserva === undefined || contexto.soberania?.conferida !== true) return false
+if (reserva === undefined) return false
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts
-? PERFIS.filter((perfil) => semPreco(adaptador.identidade, config.modelo?.modelos[perfil] ?? '')).map((perfil) => config.modelo?.variaveisDosModelos?.[perfil] ?? 'LLM_MODELO')
+? PERFIS.filter((perfil) => semPreco(adaptador.identidade, config.modelo?.modelos[perfil] ?? '')).map(() => 'LLM_MODELO')
```

```mutacao
arquivo: packages/core/src/ia/llm-gateway.ts
teste: packages/core/src/ia/llm-gateway.test.ts
-return PERFIS.filter((perfil) => semPreco(reserva.identidade, reserva.modelo?.modelos[perfil] ?? '')).map((perfil) => reserva.modelo?.variaveisDosModelos?.[perfil] ?? 'LLM_RESERVA_MODELO')
+return PERFIS.filter((perfil) => semPreco(reserva.identidade, reserva.modelo?.modelos[perfil] ?? '')).map(() => 'LLM_RESERVA_MODELO')
```

Motivos, sem bloco: `valores.LLM_RESERVA_BASE_URL === undefined` (a segunda metade da condição que devolve só a base) só estreita o tipo de `baseUrl`: com `openai_compat`, o endereço ausente já foi recusado por `conferirOEnvioDaReserva` (mutação do `LLM_RESERVA_BASE_URL` sem endereço), e a configuração nunca chega a `reservaConfigurada` sem ele.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| `infra-guardian`, F5, rodada 5 | recusar `falso-reserva` sobre `openai_compat` em todo ambiente | a §5 decidiu: só em produção |
| `conformidade-reviewer` (1ª), `privacy-guardian` (1ª) | `problemasDosModelosAprovados` recusar `'sintetico'` fora de `falso-reserva` e conferir o formato de `aprovadoEm` (`AAAA-MM-DD`) | muda comportamento da guarda: fica para a 13.0 (a guarda que liga aprovação, relatório e AIA), ou para a primeira entrada real |
| `conformidade-reviewer` (1ª) | caso de integração provando que a resposta do Tutor vinda da reserva aparece ao professor como a do principal | 4.0 e 7.0, que ligam o roteamento (nada vai à reserva antes) |
| `privacy-guardian` (1ª) | a 2.0 e a 4.0 mantêm `ExecucaoAgente` da chamada à reserva e `consumo_ia.provedor` vindo de `envio.provedorId`, com caso próprio | 2.0 e 4.0 |
| `privacy-guardian` (1ª) | lista de suboperadores de `docs/lgpd.md` e do dossiê atualizada na primeira reserva real | a tarefa que inscrever a primeira entrada real em `MODELOS_APROVADOS` (13.0) |
| `revisor-geral` (1ª) | com `IA_RESERVA_ADAPTADOR=falso`, recusar (ou registrar) `LLM_RESERVA_BASE_URL`, `LLM_RESERVA_MODELO*` e `LLM_RESERVA_CHAVE_API` que sobram | muda comportamento da subida; só vale fora de produção, onde o falso já não sobe (§5) e o teste "a reserva falsa ignora o endereço que sobrou no ambiente" prova que o sobrado é ignorado. Recusada: sem regra que o peça |
| `revisor-geral` (1ª) | a reserva falsa aceitar só `IA_RESERVA_PROVEDOR_ID=falso-reserva` | mesmo achado do `infra-guardian` da F5, rodada 5 (já na tabela): a §5 decidiu "só em produção" |
| `revisor-geral` (1ª) | renomear `ReservaDoGateway` para `ReservaParaAprovacao` | o tipo é exportado por `packages/core/src/index.ts`: renomear muda contrato público. Recusada, sem destino |
| `test-engineer` (1ª) | o relógio de `AbortSignal.timeout(50)` em `llm-gateway.test.ts` (perto da linha 1802) trocado pelo falso | o próprio revisor diz que não é frágil (5 s contra 50 ms). Recusada |
| `test-engineer` (1ª) | a 2.0 liga a conferência da D62 à elegibilidade com teste próprio (a linha "fora do Brasil" prova `motivosDaD62`, não `reservaElegivel`) | 2.0 |
| `infra-guardian` (1ª) | `infra/carga.env` traz a reserva e o compose ainda não a repassa; ligar a fase `reserva` e conferir que a carga da manhã continua igual | 9.0 |
| `infra-guardian` (1ª) | o limitador da reserva divide `LLM_RESERVA_TOKENS_POR_MINUTO` por `IA_REPLICAS`; o balde nasce com `identidade:modelo`; esgotar o principal não reduz o da reserva | 2.0 (e 7.0 para o balde no roteamento) |
| `llm-integrator` (1ª) | a mensagem de falha do teste da constante mostrar o `sha256` esperado | só conveniência de teste e a constante já é conferida contra o disco. Recusada |
| `llm-integrator` (1ª) | estimativa de chamadas por professor por mês, por perfil, da reserva; o revisor da 4.0 confere a coluna `pelo_provedor_de_reserva` | 4.0 |
| `test-engineer` (2ª) | no laço de staging e produção de `llm-config.test.ts` (perto da linha 441), conferir também `motivos: [MOTIVO_RESERVA_COM_MODELO_DO_PRINCIPAL]`, e não só `variaveis` | `TODO.md` ou a próxima tarefa que reabrir `llm-config.test.ts`: reforço de asserção em caso que já prova a cláusula pelo controle positivo; não bloqueia |
| `revisor-geral` (2ª) | provar que o principal falso sobe em staging, e separar o `it` da identidade repetida em casos por ambiente quando voltar a crescer | a próxima tarefa que mexer nesse `it` (2.0 não o toca): `TODO.md` |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-22 13:12:41 | 2026-11-22 13:13:02 | `tenancy-guardian` | 1 | APROVADO | ad5fe5864a39b6141 |
| 2026-11-22 13:12:48 | 2026-11-22 13:13:30 | `conformidade-reviewer` | 1 | APROVADO | ab208350a13a113a6 |
| 2026-11-22 13:12:44 | 2026-11-22 13:13:40 | `privacy-guardian` | 1 | APROVADO | a0299a1629a946418 |
| 2026-11-22 13:13:03 | 2026-11-22 13:14:23 | `revisor-geral` | 1 | APROVADO | aebfd5491973e1642 |
| 2026-11-22 13:12:59 | 2026-11-22 13:15:37 | `test-engineer` | 1 | APROVADO | a783e52ea7c0e77a6 |
| 2026-11-22 13:12:52 | 2026-11-22 13:20:06 | `infra-guardian` | 1 | APROVADO | a9382185bb8b57c94 |
| 2026-11-22 13:12:56 | 2026-11-22 13:20:08 | `llm-integrator` | 1 | APROVADO | ac41795adf81f1214 |
| 2026-11-22 13:20:14 | 2026-11-22 13:20:19 | `llm-integrator` | 2 | SEM VEREDITO | ac41795adf81f1214 |
| 2026-11-22 13:38:07 | 2026-11-22 13:38:26 | `revisor-geral` | 2 | APROVADO | a0f74e7f6f7f692ab |
| 2026-11-22 13:37:58 | 2026-11-22 13:38:33 | `test-engineer` | 2 | APROVADO | aec17086613fc310b |
