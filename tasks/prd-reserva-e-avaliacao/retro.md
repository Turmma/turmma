# Retrospectiva — reserva-e-avaliacao (F5b)

23/11/2026, pelo Arquiteto 2, no térreo, depois do pouso (`23761ad6`, 11:26). **Completa** (D86): a taxa subiu (11,8% contra
8,4% da F5a) e três causas se repetiram (a fiação sem teste, cinco reprovações; a guarda estática testada só com o caso fácil,
quatro; a resposta crua que não é JSON, três). Comparação com a retro da F5a (`tasks/prd-camada-ia/retro.md`).

O que pesa nos números: 13 tarefas em três linhas (L1: 1.0, 2.0, 4.0, 5.0, 8.0; L2: 10.0, 11.0, 12.0, 13.0; L3: 3.0, 6.0, 7.0,
9.0), todas com Sonnet; a 14.0 (a avaliação com as chaves) saiu da spec em 23/11 ("tira a 14 dessa spec") e virou a F5c (D37
revista, `04e4b68b`). Quatro tarefas (10.0 a 13.0) são ferramenta em `tools/`, sem banco nem tela; nenhuma tarefa tem tela.

## Medidas

```
Tarefas: 13 · Rodadas de revisor: 170 · Reprovações: 20 (11,8%) — 17 REPROVADO e 3 AJUSTES NECESSÁRIOS
  (sem a "rodada 2 SEM VEREDITO" do llm-integrator no 1_task.md, 22/11 13:20:19, que é a retomada do mesmo agente: M2 abaixo)
Por revisor: test-engineer 28/9 · revisor-geral 27/6 · conformidade-reviewer 23/1 · privacy-guardian 23/0 · tenancy-guardian 21/0
             infra-guardian 21/1 · llm-integrator 20/1 · pedagogia-reviewer 7/2
Por modelo do implementador: Sonnet nas 13; 13,1 rodadas e 1,5 reprovação por tarefa; 2 diagnósticos do Arquiteto (11.0, a regex
  `semImportDeTipo`; 9.0, o bloco de mutação do `.every`), os dois resolvidos na rodada seguinte; 4 divergências triadas (1.0 duas,
  detalhe; 10.0 desenho e ordem; 11.0 ordem, detalhe); mediana do pedido ao commit 83 min
Rodadas por tarefa: média 13,1; pior 11.0 com 24 (três rodadas dos oito revisores)
Rodadas que caducaram sem reprovação: 60 de 170 (35%) — 20 delas em cinco tarefas aprovadas inteiras na 1ª rodada (1.0, 3.0, 6.0,
  7.0, 8.0) e rodadas de novo depois da ordem só com recomendações (revisar-tarefa, "aplicar a barata")
Correções fora de tarefa: 0 (a da operação perto do prazo, `d45c532b`, é da F5a)
Duração: andar 22/11 09:49; revisão da spec 09:53 → 10:48 (55 min); tarefas 11:40 (PRD → tarefas em 1 h 51, com a pergunta do
  custo da avaliação aceita às 11:08); construção do pedido da 1.0 (12:18) ao commit da 9.0 (01:08 de 23/11), 12 h 50, com a parada
  pedida pelo Joaquim (20:50 → 21:4x); validação r1 08:18; pouso 11:26
Revisão da spec: 8 rodadas, 29 vereditos, 19 não aprovados (16 REPROVADO, 3 AJUSTES), em 55 min
Validação: r1 APROVADA, 0 crítico, 0 maior, 6 menores
```

Como contei: a seção "Revisões" dos treze `N_task.md` (171 linhas, menos a retomada), conferida contra o `achados/indice.md`. O
pedido de cada tarefa pela primeira mensagem `PEDIDO de Orquestrador Tarefa:` nas sessões das linhas
(`…specreserva-e-avaliacao--l1`, `--l2`, `--l3`), em UTC, convertida para -03. A esteira por `gh run list --branch
spec/reserva-e-avaliacao`.

| | F3 | X8 | F2 | F2b | F2c | F4 | X6 | F4b | F5a | F5b |
|---|---|---|---|---|---|---|---|---|---|---|
| Tarefas | 20 | 13 | 16 | 8 | 19 | 12 | 14 | 13 | 8 | 13 |
| Reprovações nas tarefas | 22,9% | 15,2% | 15,4% | 2,2% | 12,6% | 11,3% | 10,1% | 14,4% | 8,4% | **11,8%** |
| Rodadas por tarefa | 11,8 | 11,6 | 12,2 | 11,3 | 13,4 | 14,8 | 14,1 | 13,4 | 10,4 | **13,1** |
| Caducadas sem reprovação | 34% | 30% | 33% | 41% | 39% | 44% | 41% | 35% | 28% | **35%** |
| Correções fora de tarefa | 9 | 26 | 13 | 4 | 25 | 10 | 16 | 9 | 14 | **0** |
| Crítico ou maior no 1º /validar | 1 c, 2 M | 1 c (+1 c) | 2 c | 1 M | 1 c, 2 M | 1 M | nenhum | 2 M | nenhum | **nenhum** |
| Tarefas sem nenhuma reprovação | 1 de 20 | 1 de 13 | 1 de 16 | 6 de 8 | 3 de 19 | 2 de 12 | 4 de 14 | 0 de 13 | 1 de 8 | **5 de 13** |
| Rodadas da revisão da spec (não aprovadas) | — | 29 (21) | 35 (27) | 19 (13) | 17 (11) | 28 (21) | 31 (18) | 29 (20) | 27 (19) | **29 (19)** |

## As cinco medidas da D79

**1. Do pedido ao commit.** Mediana de **83 min**, contra 112 na F5a, 163 na F4b e 99 no F3. Por tarefa: 6.0 (32), 8.0 (68), 3.0
(70), 7.0 (80), 1.0 (81), 5.0 (82), 4.0 (83), 12.0 (99), 2.0 (141), 10.0 (143, a divergência de desenho), 13.0 (159, com a parada
do Joaquim dentro), 11.0 (173, a escalada), 9.0 (289, a escalada e a carga refeita com a máquina calma).

**2. Tarefas sem reprovação.** **5 de 13** (1.0, 3.0, 6.0, 7.0, 8.0), contra 1 de 8 na F5a. É o melhor número desde a F2b.

**3. O grupo A (cláusula sem prova).** **5** (2.0, 4.0, 9.0 duas, 13.0), contra 2 na F5a. Três são linha **sem condição** (a fiação
da factory, a montagem da resiliência, a recusa fixa), que o `--faltando` não vê por desenho; uma (o `.every` da 9.0) tem condição,
mas mora em `infra/scripts/`, que o `--faltando` não lê. Ver grupo 1.

**4. Vermelhos da esteira por push.** 38 execuções: **15 verdes, 0 vermelhas, 23 canceladas** por push mais novo. Primeira spec
sem vermelho desde que a medida existe (7 na F5a). Pesa que nenhuma tarefa tem tela nem e2e novo.

**5. Do último commit ao pedido de pouso.** Último código à 01:08 de 23/11 (`1d7d54b5`); o pedido de pouso saiu com a validação,
~08:20: **~7 h 10**, contra 35 min na F5a. Não é processo: a parada das chaves da 14.0 (01:11), a resposta do Joaquim (~01:3x,
"tira a 14"), a D37 revista (06:48) e a validação (08:18). Do pedido ao pouso, ~3 h.

## O que as propostas da F5a fizeram

| Proposta | Resultado na F5b |
|---|---|
| Aviso 1, a entrada que distingue | voltou uma vez (5.0, três linhas seguidas que não se distinguem), contra quatro na F5a |
| Aviso 2 e M1, o `revisores` antes de pedir e a Mesa sem devolver por guardião | funcionou: **nenhuma** `DEVOLUÇÃO de Mesa` nas sessões das três linhas, contra 11 na F5a |
| Aviso 3, a recomendação da rodada final ao `TODO.md` | funcionou: a validação não achou recomendação perdida |
| Aviso 4, o toque no celular | sem ocorrência (nenhuma tela) |
| Aviso 5, o pouso sem o `floor land` | funcionou: pouso por `git merge --ff-only` às 11:26 |
| M2, a escalada sem a conferência das tarefas | funcionou: as duas escaladas (11.0, 9.0) eram reais |
| M3 e M4 | ainda abertas, por correção (`TODO.md`, "Da retrospectiva da F5a") |

## As causas

### 1. A fiação e a linha que o `--faltando` não vê, sem teste — 5 ocorrências (2.0, 4.0, 9.0 duas, 13.0)

- 2.0 (`test-engineer`, 1ª): a factory de `SOBERANIA_DA_RESERVA` passa `tarefas: tarefasAprovadasParaAReserva(...)`; trocar por
  `tarefas: []` passava em todos os testes, porque toda reserva dos testes era a falsa ou sem entrada em `MODELOS_APROVADOS`.
- 4.0 (`test-engineer`, 1ª): a montagem da resiliência da reserva (`llm-gateway.ts:837`) sem teste nem bloco.
- 13.0 (`test-engineer`, 1ª): a recusa fixa dentro de `saidaRecusa` (`lotes-retidos.ts:140`) sem teste.
- 9.0 (`test-engineer`, 1ª e 2ª, escalada): o worker que não sobe sem teste no caminho de verdade; depois, o `.some` → `.every` de
  `reprovadoPeloIndisponivel` (`infra/scripts/carga.ts:934`) sem bloco. O `--faltando` não lê `infra/scripts/`
  (`ehArquivoDoFaltando`, `tools/processo/mutacoes.ts`): a linha tinha condição e a ferramenta calou.

**Onde evitar:** na autoconferência (pergunta 1 do `task-template.md`), que já cita "as linhas sem condição que protegem" mas não
o argumento que a fiação passa adiante; e na ferramenta, para `infra/scripts/`.

### 2. A guarda estática testada só com o caso fácil — 4 ocorrências (10.0 duas, 11.0 duas)

- 10.0 (`revisor-geral`, 1ª): a guarda dos ids retidos pulava toda pasta chamada `achados`, `__fixtures__` ou `fixtures`, em
  qualquer lugar, e o teste só experimentava `tools/guardas/__fixtures__`.
- 10.0 (`test-engineer`, 1ª): a guarda deixava passar a cópia do lote "no lugar mais provável dela".
- 11.0 (`test-engineer`, 1ª): a guarda do ponto de entrada não via o jeito real de abrir o banco (o `dist`, o barril, `BANCO_URL`).
- 11.0 (`test-engineer`, 2ª, escalada): a cláusula nova "o `import type` não conta" apagava o import de verdade que vinha depois.

**Onde evitar:** na autoconferência: a fixture da violação tem de estar na forma do repositório real, com o vizinho legítimo que a
guarda não pode calar.

### 3. A resposta crua do modelo que não é JSON fora da conta — 3 ocorrências (11.0 duas, 13.0)

- 11.0 (`pedagogia-reviewer` e `llm-integrator`, 1ª, AJUSTES): a resposta crua que não é JSON nunca era julgada nem contada como
  falha, contra `avaliacao.md:21-24`.
- 13.0 (`conformidade-reviewer`, 1ª): a D55 dos lotes retidos deixava passar nota numa resposta que não é JSON válido — a mesma causa,
  na mesma linha (L2), duas tarefas depois.

**Onde evitar:** no `N_task.md` (criar-tasks): o anexo dizia, a tabela de testes da tarefa não tinha a linha. Saída de modelo fora do
esquema é borda de toda tarefa que lê, julga ou confere saída de modelo.

### Uma vez só (sem proposta)

- 4.0 (`infra-guardian`): a vaga do principal não voltava ao balde antes do desvio à reserva (desenho do balde; a Tech Spec não
  dizia). 4.0 (`revisor-geral`): a tarefa fez parte da 6.0 sem avisar. 5.0 (`test-engineer`): três linhas seguidas que não se
  distinguem. 9.0 (`revisor-geral`): a corrida fora da condição de registro. 11.0, 12.0 e 13.0 (`revisor-geral`): erros de lógica da
  ferramenta (a falha contada como "a conferência segurou", o número sem `%` comparado com as contagens, o lote conferido depois do
  gasto).
- O que falhou (`estado.md`, 13.0): o Implementador 2 imprimiu no terminal o `contexto.mensagemDoProfessor` de uma amostra do lote
  retido. Nada gravado nem enviado; o risco é contaminar o lote. Vira o aviso 4, porque a F5c roda a avaliação de verdade.
- A revisão da spec levou 55 min (26 na F5a) e 8 rodadas: cinco revisores reprovaram na 1ª o mesmo ponto (o 429 que sobra não se
  distingue de queda, no código de então), e o anexo da avaliação (equidade, D36 nos lotes retidos) foi até a 5ª. Não se repete
  como causa de tarefa.
- A 14.0 pedia as chaves do Joaquim e saiu da spec. Já decidido (D37 revista; "modelo real por último").

## Pedidos do Orquestrador

- **O balde da reserva na parte por escola** (`tenancy-guardian`, 7.0, recomendação): feito no `TODO.md`. O item "O balde geral de
  tokens é de todas as escolas" (reengenharia-continuacao 10.0) passou a citar o balde da reserva (`provedor:modelo`), para os dois
  se tratarem juntos. Os três itens da 4.0 com dono "Arquiteto, junto da 7.0" (a 7.0 passou sem eles, e o terceiro dizia que a 7.0
  punha o balde da reserva por escola, o que não aconteceu) ganharam dono certo.
- **O menor 5 da validação** (o hook grava "rodada 2 SEM VEREDITO" ao retomar o mesmo subagente): confirmação M2.

## O que tirar

Nada. `tenancy-guardian` (21/0) e `privacy-guardian` (23/0) não reprovaram nenhuma vez, mas são o veto das regras 10 e 20, e a
retro não os afrouxa. As 20 rodadas caducadas nas tarefas aprovadas inteiras são o preço de aplicar a recomendação barata
(`revisar-tarefa`), que a A0b escolheu de propósito; cada ciclo levou ~20 min, e não proponho mudar.

## Propostas

### Avisos (aplicados depois das 13:05 de 23/11, sem objeção)

**A1.** Causa 1 (fiação). `.claude/skills/criar-tasks/task-template.md`, pergunta 1 da autoconferência, depois de "o campo de um
esquema zod.": "E o argumento que a fiação passa adiante (a `useFactory` de um módulo Nest, a montagem de um adaptador): o bloco troca
o argumento pelo vazio (`[]`, `undefined`, o padrão), e o teste precisa de um dado em que o vazio dá outro resultado (2.0 e 4.0 da
F5b: `tarefas: []` e a reserva montada sem resiliência passavam em todos os testes)."
Efeito esperado: as três reprovações de linha sem condição.

**A2.** Causa 2 (guarda). Mesmo arquivo, pergunta 3, no fim: "Na guarda estática (`tools/guardas/`, varredura de código ou de
arquivo), a fixture da violação está na forma mais provável no repositório real (o jeito de abrir o banco que o código usa de fato;
a cópia do lote na pasta em que ela cairia), há o vizinho legítimo que a guarda não pode calar (o `import type` seguido de um import
real), e a exclusão é por caminho a partir da raiz, nunca por nome de pasta (10.0 e 11.0 da F5b, quatro reprovações)."
Efeito esperado: as quatro reprovações da guarda.

**A3.** Causa 3 (saída fora do esquema). Mesmo arquivo, tabela "Testes que provam a regra": a linha
`| saída do modelo fora do esquema: [a resposta crua que não é JSON, ou JSON truncado] | unidade | é julgada, contada e conferida como as outras, a D55 inclusive; não some da conta | | |`,
e, depois do parágrafo da linha de log: "A linha da saída fora do esquema vale para tarefa que lê, julga, mede ou confere a saída
de um modelo, e sai quando a tarefa não faz isso. Na F5b, a 11.0 e a 13.0 reprovaram três vezes pela resposta que não era JSON e
sumia do julgamento e da D55."
Efeito esperado: as três reprovações, e a mesma falha na F5c, que roda essa ferramenta com modelo real.

**A4.** O que falhou na 13.0. `.claude/skills/executar-task/SKILL.md`, passo 3, um item: "Lote retido (`*-retido-*.json`,
`RETIDOS.json`, `docs/aia/ouro-retido/`) se inspeciona só pela forma (`jq 'keys'`, `jq length`), nunca pelo conteúdo: o texto que
passa pelo terminal entra no contexto do modelo e contamina o lote (13.0 da F5b)."

### Confirmações

**M1.** Causa 1 (o `.every` da 9.0). `tools/processo/mutacoes.ts`, `ehArquivoDoFaltando`: ler também `infra/scripts/**/*.ts`
(fora teste e `.d.ts`), como já lê `tools/`, com caso em `mutacoes.test.ts`. Só o `--faltando` e o relatório do portão mudam; o RF17
continua só com `apps/*/src` e `packages/*/src`. Recomendo aplicar, por correção (código de processo, com revisores): a carga é onde
a regra 80 se prova, e a escalada da 9.0 nasceu de uma linha que a ferramenta já saberia apontar.

**M2.** Menor 5 da validação. `tools/processo/documento-de-revisao.ts`, `registrar`: quando o agente (`agent_id`) é o mesmo da
última rodada daquele revisor no documento **e** a mensagem não traz veredito, não gravar rodada nem achado (é a retomada do mesmo
subagente, como a do `llm-integrator` na 1.0, 5 s depois e sem saída nova). Com veredito, segue gravando como hoje. Caso em
`revisoes.test.ts`. Recomendo aplicar, por correção: a linha falsa conta rodada, pode escalar (a escalada falsa da 6.0 na F5a veio
de rodada que não era revisão) e sujou esta medida.

## O que foi aceito ou recusado

Mostradas ao Joaquim em 23/11 às 12:40, no terminal do `Arquiteto 2`. Resposta: "aprovo" (vale a recomendação de cada uma; os
avisos, aprovados antes do prazo das 13:05, aplicados junto).

| Proposta | Resultado | Onde |
|---|---|---|
| A1 (aviso) | aplicado | `task-template.md`, autoconferência 1 |
| A2 (aviso) | aplicado | `task-template.md`, autoconferência 3 |
| A3 (aviso) | aplicado | `task-template.md`, tabela "Testes que provam a regra" e o parágrafo depois da linha de log |
| A4 (aviso) | aplicado | `executar-task`, passo 3 |
| M1 | aceita, por correção | `TODO.md`, "Da retrospectiva da F5b" |
| M2 | aceita, por correção | `TODO.md`, "Da retrospectiva da F5b" |
