# Tarefa 13.0 — Onda dos documentos: o guia com a §9 reescrita, a arquitetura, a interface, os README e `.claude/`

**Funcionalidade:** nomes-de-mercado · **Depende de:** 12.0, e a correção do ouro (Arquiteto, depois da 5.0)
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `test-engineer`, `revisor-geral`
**Porte:** grande

## Objetivo

Os documentos vivos citam só os nomes novos: o `docs/guia-do-desenvolvedor.md` (inteiro, com a §9 reescrita só com o
que ainda é nosso e o padrão que implementa), o `docs/arquitetura.md`, o `docs/interface.md`, o README da camada de IA
e o do kit, as regras, as skills, os papéis e o `CLAUDE.md`. Fecha a X8: o `restos` dá zero com todos os mapas, sem a
isenção do ouro.

## Contexto necessário

- `tasks.md`, "O procedimento de cada onda"
- `techspec.md` §5 (o passo 5, o que fica fora e "O `restos`" na 13.0)
- `prd.md` RF9 e RF10
- `inventario.md` §4, "Documentos"
- Os mapas de `tools/renomear/mapas/` das ondas de linha (7.0 a 11.0), cujos nomes ainda estão nos documentos
- `docs/guia-do-desenvolvedor.md` §9: o que ele chama de padrão próprio, e o nome de mercado que o substitui

## Subtarefas

- [x] 13.1 — O mapa `tools/renomear/mapas/13.json`, só com o nome de documento que não veio de uma onda (o da §9 do
  guia), ou vazio. A existência dele tira a isenção dos mapas de linha e a do ouro (1.0 e 2.0)
- [x] 13.2 — O passo 5 dos mapas das linhas, aplicado só aos documentos (o `reaplicar` reescreve código; Tech Spec §5,
  triagem da divergência da 13.0). A palavra comum da lista de troca à mão de cada relatório vai à mão, frase a frase.
  A frase do avatar em `docs/interface.md` vira `AgentAvatar`, com o literal dos dois testes da onça e os comentários
  da pasta, declarados em `excecoesDoConferir` do `13.json`
- [x] 13.3 — A §9 do guia, reescrita só com o que ainda é nosso e o padrão que implementa
- [x] 13.4 — O `conferir`, com o diff de código vazio. O `restos` sem isenção. O `caminhos.test.ts` da X7 verde.
  `docs/decisoes.md` e `tasks/prd-*` fechados sem diff
- [x] 13.5 — A seção "Mutações"

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `docs/guia-do-desenvolvedor.md`, `docs/arquitetura.md`, `docs/interface.md` | alterado |
| `docs/**` | alterado |
| `packages/core/src/ia/README.md`, `apps/web/src/components/ui/ai/README.md` | alterado |
| `.claude/rules/`, `.claude/skills/`, `.claude/agents/` | alterado |
| `CLAUDE.md`, `README.md` | alterado |
| `apps/web/src/components/ui/onca/Onca.test.tsx`, `CabecaOnca.test.tsx` (o literal do fim da 9.7, uma linha cada) e `CabecaOnca.tsx` (comentário) | alterado |
| `tools/renomear/mapas/13.json`, `tools/renomear/mapas/13.relatorio.md` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| `conferir` | ferramenta | o diff de código é vazio | |
| `restos` sem isenção | ferramenta | zero com todos os mapas: prova que a correção do ouro pousou | |
| nomes antigos no guia, na arquitetura e na interface | `restos` | zero (RF9) | |
| nomes antigos nos dois README da camada de IA e do kit | `grep` | só palavra comum ou nome que fica; o `restos` não lê Markdown fora de `docs/` e `.claude/` (`ehDocumentoVivo`) | |
| nomes antigos em `.claude/` e no `CLAUDE.md` | `restos` | zero (RF10) | |
| `caminhos.test.ts` da X7 | teste | verde (RF24 dela) | |
| `docs/decisoes.md` e `tasks/prd-*` fechados | diff | vazio | |
| §9 do guia | revisão | só a revisão garante: sem teste | |

## Como testar

- `npx vitest run --project unidade tools/processo/harness/caminhos.test.ts` e `tools/renomear/restos.test.ts`.
- A fronteira: `git diff --stat develop... -- docs/decisoes.md tasks/` mostra `tasks/prd-nomes-de-mercado/` e `tasks/correcoes/` (esta só com arquivos novos, das correções da spec).
- Os dois README e o `README.md` da raiz: o `restos` não os lê. A prova é a busca dos `de` de todos os mapas, com palavra inteira, nesses três arquivos. Saída da 13.0: sobram só `Conversa` (título de seção em prosa), `migrar` (serviço do compose), `Tela`, `portao` (nome de arquivo) e `Campo` (prosa), todos palavra comum ou nome que fica
- Um documento citado por um teste de processo (`seguir.test.ts`, `caminhos.test.ts`) é conferido por esse teste: rode
  os de `tools/processo/harness/` depois do `aplicar`.
- A palavra comum vai à mão: "a fila do worker" é prosa e fica. "`Fila`" entre crases, como nome de peça, muda.

## Autoconferência

As 12 perguntas do modelo, no plano. Na 7, nenhuma frase do guia afirma um padrão que o código não tem. Na 8, procure
o termo antigo em todos os documentos de uma vez, com `grep`.

## Fora do escopo desta tarefa

`docs/decisoes.md`, as specs fechadas, `mockups/` e o ouro, que é do Arquiteto.

## Divergências resolvidas nesta tarefa

01/11 — Dois pontos, triagem do Arquiteto (Tech Spec §5): (1) o `reaplicar` não serve à 13.2. A `renomearPelaSintaxe` troca o
identificador na árvore inteira, sem o filtro do `arquivo` da entrada: rodado com o `13.json`, reescreveu 182 arquivos de
código (o `portao` de `tools/processo/` virou `gate` e derrubou o hook do Bash). Desfeito com `git checkout`; os documentos
levaram o passo 5 por um script fora do repositório, sem `com`, `portao` e `secao` (e-mail, domínio e nome de arquivo), e a
prova é o `conferir` com o diff de código vazio e o `restos` limpo depois do `git add` (a `Arvore` lê o índice). O conserto
do `reaplicar` é correção própria. (2) A frase `**O avatar** (`AvatarAgente`)` de `docs/interface.md` marca o fim da 9.7 para
`Onca.test.tsx:30` e `CabecaOnca.test.tsx:28`; a opção B: a frase e os dois literais vão para `AgentAvatar` (RF9 em zero),
declarados em quatro `excecoesDoConferir` do `13.json` (RF7), e os comentários de `CabecaOnca.tsx` e `CabecaOnca.test.tsx`
trocam junto. `fidelidade-ao-mockup.test.tsx` fica sem diff e as nove cores lidas são as mesmas.

## Mutações

**Sem mutação:** rename, sem condição nova.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª) | `RateLimiter` do guia diz "Redis, com reserva em memória"; contra o item 5 da regra 80 com duas instâncias | Já era assim antes da tarefa e não muda código. Fica para a medição da N2 da X5 e para a retro |
| infra-guardian (1ª) | `packages/core/src/ia/README.md` mantém "O executor roda no processo da API (`TODO(fila)`, D77)" | Pré-existente; o rename não o altera. Sai quando a D77 deixar de valer |
| conformidade-reviewer (1ª) | `docs/aia/tutor.md:165` diz que "só a `AgentSignature`" desenha a cabeça da onça; o código diz que é o `AgentAvatar` | A AIA é a prova de identidade (D58) e a frase já era imprecisa antes: mudar o sentido de texto de AIA não é rename. `TODO.md`, para tarefa de documento com o Arquiteto |
| privacy-guardian (1ª) | O `reaplicar` não filtra pelo `arquivo`; o conserto precisa pousar antes de ele voltar a ser usado | Correção própria já registrada em "Divergências resolvidas" desta tarefa |
| revisor-geral (1ª) | O conserto do `reaplicar` leva um caso no `casos.md`, na seção `reaplicar (1.0)` | Entra na correção própria do `reaplicar` |
| revisor-geral (1ª) | `estado.md` registra o aviso de pouso da 7.0 e da 8.0 ("levado à 13.0, runbook"): o `tipo` do log mudou em `JobFailureError`, `QueueFacingError` e mais oito classes; `docs/runbook.md` não foi mexido | Fora do `13_task.md` (não há item de runbook nele). Vai ao Orquestrador decidir o destino; está dito na mensagem desta rodada |
| test-engineer (1ª) | `Onca.test.tsx:27-33` sem o `expect(fim).toBeGreaterThan(inicio)` que o `CabecaOnca.test.tsx` tem | Acrescenta cláusula de teste em arquivo cujo diff, nesta tarefa, é só o literal (13.4: diff de código vazio; "Sem mutação"). `TODO.md`, junto da onça |
| test-engineer (1ª) | `ExecucaoScheduler` em `achados/13_task.md:20` mistura português e inglês | Recusada: o nome existe no código (tenancy-guardian e conformidade-reviewer conferiram) e `achados/` é escrito pelo hook, não se edita |

Rodada 2:

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (2ª) | `apps/api/src/ia/execucao.repository.ts:150-156` (`mensagemDoAssistente`) não filtra `mensagemAgente.anoLetivoId` por `requireAnoEmCurso()`; o join só iguala o ano da mensagem ao da thread. Pré-existente, fora do diff | Correção própria (skill `corrigir`), com teste de isolamento por ano. Vai ao Orquestrador na mensagem desta rodada. Não é parte de um rename |
| privacy-guardian (2ª) | Os dois README ficam fora do `restos` (`ehDocumentoVivo`); incluí-los quando o `reaplicar` for consertado | Correção própria do `reaplicar`, já registrada em "Divergências resolvidas" |
| privacy-guardian (2ª) | O `reaplicar` não filtra pelo `arquivo`; o conserto precisa entrar antes de a ferramenta voltar a ser usada | A mesma correção própria |
| conformidade-reviewer (2ª) | `docs/aia/tutor.md:165`: quem desenha a cabeça da onça (`AgentSignature` ou `AgentAvatar`); corrigir antes de a AIA do Tutor ir ao dossiê (D61) | `TODO.md`, tarefa de documento com o Arquiteto (já na tabela do `13_task.md`) |
| infra-guardian (2ª) | `RateLimiter` com "reserva em memória" (regra 80, item 5) e `TODO(fila)` da D77 no README da IA | Já na tabela do `13_task.md`: medição da N2 da X5 e retro |
| infra-guardian (2ª) | O `tipo` do log mudou em `JobFailureError`, `QueueFacingError` e mais oito classes; o `docs/runbook.md` não acompanhou, e alerta ou busca pelo `tipo` antigo deixa de casar sem erro. Precisa pousar antes da `main` | Orquestrador decide o destino (já na tabela do `13_task.md`); repetido na mensagem desta rodada |
| revisor-geral (2ª) | `trecho` de vários `fica` novos do `13.json` cita outra peça da mesma linha (`AvisoFila` na 540, `MotorFormulario` e `Estado` na 541, `Cartao` e `Tela` na 542); quebra se a lista for reordenada | Não aplicada: funciona hoje, e o `13.json` tem 168 linhas novas. `TODO.md`, junto da correção própria do `reaplicar` |
| revisor-geral (2ª) | `PaginaMini` na §9.3 de `docs/mvp-rapido.md:541` não existe em `mockups/src`; já era assim antes da X8 | `TODO.md`, com as outras imprecisões de documento sobre o mockup. Não é rename |
| test-engineer (2ª) | `13_task.md:65` descreve a busca em prosa, sem o comando literal | Não aplicada: não é bloqueio, e o texto diz o que a busca faz e o que ela devolve. `TODO.md` |
| test-engineer (2ª) | A saída listada nessa linha omite `com` (palavra comum) | Não aplicada: o motivo está em "Divergências resolvidas". `TODO.md`, junto da anterior |
| test-engineer (2ª) | Mesma recomendação dos `trecho` do `13.json` do revisor-geral | O mesmo destino |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-01 22:37:24 | 2026-11-01 22:37:50 | `infra-guardian` | 1 | APROVADO | a35cd5e6e60a62792 |
| 2026-11-01 22:37:16 | 2026-11-01 22:37:54 | `tenancy-guardian` | 1 | APROVADO | af4ad258e226d2848 |
| 2026-11-01 22:37:21 | 2026-11-01 22:38:04 | `conformidade-reviewer` | 1 | APROVADO | a5a31ddddadfa61c7 |
| 2026-11-01 22:37:19 | 2026-11-01 22:38:15 | `privacy-guardian` | 1 | APROVADO | a7a234515748f23d5 |
| 2026-11-01 22:37:29 | 2026-11-01 22:40:16 | `revisor-geral` | 1 | REPROVADO | ad67eaa58d885c660 |
| 2026-11-01 22:37:27 | 2026-11-01 22:40:27 | `test-engineer` | 1 | REPROVADO | aabf38684f84edf7a |
| 2026-11-02 00:03:59 | 2026-11-02 00:04:23 | `tenancy-guardian` | 2 | APROVADO | ae8faafb791c5b82d |
| 2026-11-02 00:04:03 | 2026-11-02 00:04:24 | `privacy-guardian` | 2 | APROVADO | acef16981e4871b7b |
| 2026-11-02 00:04:06 | 2026-11-02 00:04:29 | `conformidade-reviewer` | 2 | APROVADO | a26cde0379682f488 |
| 2026-11-02 00:04:10 | 2026-11-02 00:04:30 | `infra-guardian` | 2 | APROVADO | a2f2f6d28b3acf4ce |
| 2026-11-02 00:03:49 | 2026-11-02 00:05:17 | `revisor-geral` | 2 | APROVADO | afb0878ad3590fbde |
| 2026-11-02 00:03:55 | 2026-11-02 00:05:33 | `test-engineer` | 2 | APROVADO | ae7156659bac34672 |
