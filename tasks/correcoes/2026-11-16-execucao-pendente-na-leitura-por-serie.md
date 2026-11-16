# Correção — o reenvio com a execução pendente deixava a execução `pendente` quando o `rodando` ficava preso além do corte da API

**Origem:** esteira run 43789142591 em `5878210` (`gh run view 43789142591 --repo Turmma/turmma --log-failed`): o job `integração`,
`apps/api/test/leitura-por-serie.int.test.ts › plano_de_aula: o reenvio com a execução ainda pendente, depois que o material saiu…`.
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `llm-integrator`, `infra-guardian`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`
<!-- Os quatro primeiros vieram no PEDIDO do Orquestrador; os três últimos entram porque a Mesa conferiu a linha contra os arquivos alterados: `apps/` pede os quatro guardiões (`tools/processo/guardioes-por-caminho.ts`, `OS_QUATRO`). -->

## Sintoma

`expect(await estadoDaExecucao(...)).toEqual([{ estado: 'falhou', erro: 'MATERIAL_INSUFICIENTE' }])` (linha 476) recebeu
`[{ estado: 'pendente', erro: null }]`. Os casos irmãos (`atividade_objetiva`, `chat`, o Tutor) passaram na mesma execução, e o caso passou em
`db2af7a1`.

## Fora desta correção

Nada: o pedido não trouxe arquivos de tarefa em curso, e a árvore estava limpa.

## Causa

O caso segura o `pendente → rodando` com um gatilho que só existe no banco de teste (`WriteBlockTrigger`), muda o material, reenvia e solta. Enquanto
o `update` está parado no gatilho, ele corre contra o **corte de consulta do pool que o executa**. Em `5878210` quem o executava era o executor em
processo da API (tarefa 1.0 da spec anterior ao worker), com o pool da API: `BANCO_TIMEOUT_CONSULTA_MS=2000` (`.env.example`; a API o lê em `packages/core/src/db/database.ts:61` e `:74`, que o põe em `timeoutConsultaMs` do pool). O runner da esteira,
com a integração inteira em paralelo, leva mais de 2 s entre o `esperarParadas`, o `mudar()` e o reenvio; o `statement_timeout` corta o `update`, a
transação desfaz a passagem a `rodando`, e o `marcarFalhou` (`where estado = 'rodando'`) não acha linha. A execução fica `pendente`, com `erro` vazio, e
o `executor.ociosa()` devolve: não há mais nada rodando. É a mesma espera de uma máquina carregada, sem erro nem log do lado do teste.

**Qual tarefa:** a causa é do **desenho do caso** (9.0 e a correção `2026-11-13-reenvio-fora-do-alcance`), que dependia de a máquina chegar ao `soltar` em
menos de 2 s. A 5.0 (A IA roda no worker) já tira o `update` do pool da API: nos testes, quem o executa é o pool da **bancada** do worker
(`apps/api/test/fila-de-ia.fixture.ts`, `TEMPO_DA_CONSULTA_MS = 30_000`, "folgado, porque o teste que segura uma escrita com gatilho a deixa esperar"). Essa folga é **só da
bancada de teste**: o worker de produção usa o mesmo `BANCO_TIMEOUT_CONSULTA_MS` de 2 s da API (`.env.example`), e em produção nada prende o `rodando`, porque o gatilho existe
apenas no banco de teste. O teste, portanto, não prova que a produção aguenta uma espera longa nessa transição. Por isso, nesta árvore, o caso passa
(3 de 3 isolado e 12 de 12 sob carga de CPU, com a espera de 0,5 s do caso antigo): ninguém tinha **posto à prova** esse corte. O caso passava por folga de
tempo, e o teste novo o torna determinístico.

## Teste que reproduz

`apps/api/test/leitura-por-serie.int.test.ts › <ferramenta>: o reenvio com a execução ainda pendente, depois que o material saiu, devolve o mesmo id e a execução falha pelo material sem chamar o modelo`
(os três casos do laço) e, no mesmo arquivo, `o Tutor com a execução ainda pendente no reenvio devolve o mesmo id, e a execução falha pelo material, sem resposta, sem consumo e sem chamar o modelo`: **quatro casos**,
todos pelo ajudante `reenviandoComAExecucaoPendente`. O ajudante agora mantém o `rodando` preso **por mais que o corte da API**
(`ALEM_DO_CORTE_DA_API_MS = testConfig({}).banco.timeoutConsultaMs + 500`, calculada uma vez), a condição que a esteira produzia por lentidão.

- **Vermelho:** com o pool da bancada no corte da API (`TEMPO_DA_CONSULTA_MS = 1_500`, temporário, restaurado), os três casos do laço caíram em
  `expected [ { estado: 'pendente', erro: null } ] to deeply equal [ { estado: 'falhou', … } ]`, o sintoma da esteira. O caso do Tutor usa o mesmo ajudante e a mesma espera; o vermelho
  medido foi o dos três do laço.
- **Verde:** com os 30 s do pool da bancada, os quatro passam. O pool da bancada **não é o de produção**: o caso protege esse valor contra quem um dia o reduza até o corte da API.

## Correção

- `apps/api/test/leitura-por-serie.int.test.ts`: o ajudante prende o `rodando` além do corte da API antes de soltar (`ALEM_DO_CORTE_DA_API_MS`, com o comentário de onde vem a folga); importa `testConfig`. Só teste:
  o código de produção não muda, porque a 5.0 já tirou a execução do pool da API. Não se aumenta timeout para passar: o caso passa a **exigir** que o pool da execução na bancada tenha folga acima do corte da API
  (a folga é da bancada; o worker de produção tem o corte de 2 s).
- Custo: 2,5 s a mais em cada um dos quatro casos, cerca de 10 s no arquivo.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| llm-integrator 1ª | "A prova do vermelho é manual: … Um teste curto que afirme `TEMPO_DA_CONSULTA_MS` maior que `testConfig({}).banco.timeoutConsultaMs` tornaria a folga explícita. Esse valor hoje é constante não exportada." | `TODO.md`: exige exportar constante da bancada e teste novo; sai do escopo de uma correção só do ajudante |
| infra-guardian 1ª, test-engineer 1ª | "O caso em que a passagem a `rodando` é cortada pelo statement_timeout (2 s) no worker de produção não tem teste. Pela D49 … o job deveria ser tentado de novo …" / "Fica uma pergunta de produto para registrar na retro ou na 6.0, não nesta correção." | `TODO.md` e a retro da spec: é comportamento do código de produção (`execucao.processor.ts`, `marcarRodando`) e pede teste de produção, não do ajudante |
| infra-guardian 1ª | "A espera fixa custa 2,5 s em cada um dos três casos … dá para trocar a espera fixa por um corte menor configurado só para esse caso." | Recusada: o `test-engineer` conferiu que o `testTimeout` de 60 s comporta o custo com folga, e um corte menor só para o caso mudaria a bancada que o caso põe à prova; o infra-guardian a marcou "Não bloqueia" |
| conformidade-reviewer 1ª | "Os 2,5 s a mais em cada um dos três casos … Vale olhar na retro se o mesmo efeito sai com um corte de bancada menor e explícito." | Retro da spec |
| revisor-geral 2ª | "o comentário de `ALEM_DO_CORTE_DA_API_MS` repete o que o documento da correção já diz. Pode ficar em duas linhas: de onde vem o valor e qual folga da bancada o caso põe à prova." | Recusada: o comentário foi o que `revisor-geral`, `conformidade-reviewer` e `llm-integrator` pediram na 1ª rodada (citar a bancada e a diferença para a produção); encurtá-lo desfaz o pedido de três revisores |
| revisor-geral 2ª | "o próprio documento admite que o vermelho medido cobre só os três casos do laço, e que o do Tutor herda a prova por usar o mesmo ajudante." (sem pedir mudança) | Registro: o Validador confere |
| test-engineer 2ª | "O vermelho do caso do Tutor foi deduzido de ele usar o mesmo ajudante, não medido." | Registro: o documento já o diz; o Validador confere |
| test-engineer 2ª | "A validação deve rodar o teste com `@educa/core` compilado antes do commit, já que esta rodada não conseguiu executá-lo." | O portão da tarefa (`portao-local.ts --tarefa`) é quem o roda; o Implementador o rodou antes de pedir esta rodada |

## Sem mutação

**Sem mutação:** só teste (`apps/api/test/leitura-por-serie.int.test.ts`); nenhum arquivo de `apps/*/src` nem de `packages/*/src` muda. A prova do vermelho é o
`TEMPO_DA_CONSULTA_MS` da bancada posto no corte da API, descrita em "Teste que reproduz".

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-16 03:26:03 | 2026-11-16 03:26:13 | `tenancy-guardian` | 1 | APROVADO | ac955a09d548f7dae |
| 2026-11-16 03:26:01 | 2026-11-16 03:26:17 | `llm-integrator` | 1 | APROVADO | ab816e39e15a9e8db |
| 2026-11-16 03:26:05 | 2026-11-16 03:26:19 | `privacy-guardian` | 1 | APROVADO | a0119380c2f145891 |
| 2026-11-16 03:26:06 | 2026-11-16 03:26:25 | `conformidade-reviewer` | 1 | APROVADO | aa063fd8490de6c9d |
| 2026-11-16 03:26:00 | 2026-11-16 03:26:38 | `revisor-geral` | 1 | APROVADO | afb4c53d860d60ccb |
| 2026-11-16 03:26:02 | 2026-11-16 03:26:39 | `infra-guardian` | 1 | APROVADO | a6b2d67a8f9686fb5 |
| 2026-11-16 03:25:59 | 2026-11-16 03:27:53 | `test-engineer` | 1 | APROVADO | a1f6a477786c7f46d |
| 2026-11-16 03:36:25 | 2026-11-16 03:36:40 | `revisor-geral` | 2 | APROVADO | a9bfeffdf5677dcb6 |
| 2026-11-16 03:36:20 | 2026-11-16 03:36:45 | `test-engineer` | 2 | APROVADO | a9456e6dbc00bad4a |
