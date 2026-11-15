# Retrospectiva — ingestao-do-material (F4)

14/11/2026, pelo Arquiteto 2, no térreo, depois do pouso (`cbc3d89f`), ao lado do PRD da X6 (D86). **Completa** (D86): a taxa caiu
(11,3% contra 12,6% da F2c), mas seis causas se repetiram. Comparação com a retro da F2c (`tasks/prd-acesso-e-convites/retro.md`).

O que pesa nos números: 12 tarefas, todas com Sonnet 5.5, em duas linhas (a 3.0 na L2, o resto na L1); a primeira spec com worker
de PDF, varredura do storage e ensaio de alerta novo; e a máquina, com o relógio da VM recuando (timesyncd contra o Hyper-V, desligado
pelo Orquestrador em 13/11).

## Medidas

```
Tarefas: 12 · Rodadas de revisor: 177 · Reprovações: 20 (11,3%) · mais 1 AJUSTES NECESSÁRIOS do frontend-reviewer
Por revisor: revisor-geral 30/6 · test-engineer 29/10 · privacy-guardian 27/1 · infra-guardian 26/3
             tenancy-guardian 26/0 · conformidade-reviewer 26/0 · frontend-reviewer 13/0 (1 AJUSTES)
Por modelo do implementador: Sonnet 5.5 nas 12; 14,8 rodadas e 1,7 reprovação por tarefa; 2 diagnósticos do Arquiteto nas tarefas
  (8.0 e 11.0, as duas escaladas do test-engineer) e 1 numa correção (testes-com-relogio); 0 BLOQUEIO; 6 divergências (3.0 desenho
  e 5.0 ordem, triadas como detalhe; 6.0, 7.0 e duas da 9.0, de portão); pedido → commit com mediana de ~158 min (nas 9 sem parada
  de noite; com as 12, ~203)
Rodadas por tarefa: média 14,8; pior 11.0 com 23 (quatro rodadas)
Rodadas que caducaram sem reprovação: 78 de 177 (44%)
Correções fora de tarefa: 10
Duração: PRD 11/11 09:49; revisão da spec 10:19 → 10:54; tarefas 11:19; construção 11:56 de 11/11 → 04:58 de 14/11 (2 d 17 h)
  fechamento: validação r1 05:21 (APROVADA COM RESSALVAS); duas correções até 13:10; validação r2 13:45 (APROVADA); pedido de pouso
  ~14:40 (hora do estado.md)
Revisão da spec: 6 rodadas, 28 rodadas de revisor com veredito, 21 não aprovadas, em 35 min
Validação: rodada 1 com 0 crítico, 1 maior, 6 menores; rodada 2 APROVADA, 0 crítico, 0 maior, 6 menores
```

Como contei: as seções "Revisões" dos 12 `N_task.md`, mais a 1ª rodada da 9.0, que a seção perdeu (7 linhas, 2 reprovações) e o
`achados/9_task.md` guarda; a seção da 12.0, refeita pelo Implementador a partir dos transcripts, bate com o `achados/12_task.md`
(15 linhas, o mesmo veredito em cada uma), como o Orquestrador pediu para conferir. O pedido de cada tarefa pela primeira mensagem
`PEDIDO … Tarefa:` nas sessões das linhas (`~/.claude/projects/*specingestao-do-material--l1` e `--l2`); três atravessaram a noite
(2.0 e 3.0, de 11/11 15:05 a 12/11 ~19:40; 7.0, de 13/11 01:29 a 13:04) e ficam fora da mediana. A esteira por
`gh run list --branch spec/ingestao-do-material`.

| | F3 | X8 | F2 | F2b | F2c | F4 |
|---|---|---|---|---|---|---|
| Tarefas | 20 | 13 | 16 | 8 | 19 | 12 |
| Reprovações nas tarefas | 22,9% | 15,2% | 15,4% | 2,2% | 12,6% | **11,3%** |
| Rodadas por tarefa | 11,8 | 11,6 | 12,2 | 11,3 | 13,4 | 14,8 |
| Caducadas sem reprovação | 34% | 30% | 33% | 41% | 39% | 44% |
| Correções fora de tarefa | 9 | 26 | 13 | 4 | 25 | **10** |
| Crítico ou maior no 1º /validar | 1 c, 2 M | 1 c (+1 c) | 2 c | 1 M | 1 c, 2 M | 1 M |
| Tarefas sem nenhuma reprovação | 1 de 20 | 1 de 13 | 1 de 16 | 6 de 8 | 3 de 19 | 2 de 12 |
| Rodadas da revisão da spec (não aprovadas) | — | 29 (21) | 35 (27) | 19 (13) | 17 (11) | 28 (21) |

## As cinco medidas da D79

**1. Do pedido ao commit.** Mediana de **~158 min** nas 9 sem noite, contra 108 na F2c, 87 na F2b e 99 no F3. As longas: 9.0 (339,
duas divergências de portão pelo relógio e pela carga), 11.0 (222, a escalada), 1.0 (184). As tarefas da F4 são maiores (14,8
rodadas de revisor cada, a mais alta da série) e cada rodada ficou mais cara com sete revisores.

**2. Tarefas sem reprovação.** **2 de 12** (4.0 e 5.0), contra 3 de 19 na F2c.

**3. O grupo A (cláusula sem prova).** **6**, contra 12 na F2c (grupo B abaixo). Das seis, três são linhas que o `--faltando` não
lista e que o aviso 1 da F2c já mandava listar à mão (o termo dentro do `and` da 8.0, as duas chamadas do efeito da 6.0, a constante
e a opção `refetchOnMount` da 7.0). A M1 da F2c, que faria a ferramenta listá-las, não foi feita.

**4. Vermelhos da esteira por push.** 36 execuções: **11 verdes, 6 vermelhas, 19 canceladas**, e uma das canceladas (`03454faf`) era
vermelho de fato, cortada no teto de 45 min do job `infra`. As causas: o `apt` do runner (`8fbf3b29`, externo); o catálogo de FKs do
MVP (`6b2611b8` e `e5a99cec`, 5.0, a mesma causa duas vezes); o envio sem série no e2e (`f574324c`, 7.0); três causas da 9.0
(`b942d266` e `2c3e0ebc`); a soma das durações do job `infra` (3.0). Três são do grupo E (inventário fora do diff), que a F2c já tinha.

**5. Do último commit ao pedido de pouso.** Último código às 13:10 de 14/11 (`7d4e4f7b`), validação r2 às 13:45, pedido de pouso
às ~14:40 pelo `estado.md`: **~1 h 30**, contra 55 min na F2c. A diferença é a rodada 2 da validação, que as duas correções do maior 1
exigiram.

## Grupos de causa

| # | Causa | Ocorrências | Onde evitar |
|---|---|---|---|
| A | **O documento afirma o que a árvore não tem.** A divergência decidida e não escrita na spec (1.0, que prometia a varredura da 2.0; 3.0; 9.0, a decisão da adaptação "em silêncio"; 10.0). A tabela de testes citando o caso renomeado ou dividido numa rodada, ou que não prova o que a linha diz (1.0, 6.0, 8.0 r2). A linha de "Recomendações sem aplicar" com destino `TODO.md` que não foi ao `TODO.md` (12.0 r2; e, sem reprovação, a 7.0, a 9.0 r2, a 5.0 e o menor 3 da validação r2). O `docs/lgpd.md` dizendo o contrário do desenho novo (1.0 r2). O comentário com a conta que não fecha (2.0). E o maior 1 da validação: a 9.0 registrou como detalhe uma escolha da adaptação que o RF7, o RF11 e um caso de borda do PRD diziam ao contrário | 10 itens bloqueantes em 8 tarefas; o maior 1 (duas correções, duas paradas do Joaquim, validação r2) | a conferência antes de **cada** rodada (`executar-task`, passo 5), que hoje só olha a divergência e só uma vez; a ferramenta (M1); a triagem da divergência (`arquiteto.md`) |
| B | **Cláusula sem teste que caia sem ela** (o grupo A da D79): lock e stalled sem teste (1.0), as duas chamadas do efeito (6.0), o teto de campos e o `refetchOnMount` (7.0), os termos do `and` e a mutação declarada sem bloco (8.0 r1), o vermelho que vem de um `TypeError` e não da regra (9.0), o laço que nenhum caso provoca (11.0 r3) | 6, em 6 tarefas | autoconferência 1 (já diz); a M1 da F2c, pendente |
| C | **O teste herda a condição de que depende.** A asserção que sempre passa porque o fixture não roda o job sem objeto (1.0); o dublê que lança `new Error`, que o storage de produção nunca lança, e esconde que a regra deixou de valer (2.0 r2); o `alertas.int.test.ts` que só passa porque outro arquivo deixou o `worker-pdf` parado (3.0, com infra, revisor-geral e test-engineer) | 5 itens em 3 tarefas | autoconferência 4 (aviso 3) |
| D | **A conta do laço e do ritmo não foi feita.** A varredura com lote × prazo do `apagar` × passadas de 10.000 s contra `prazoMs` de 600 s, sem ouvir o `sinal` (2.0, infra e revisor-geral); o resumo que se relê a cada 1,5 s junto da lista e passa do limite de 120 pedidos por minuto da coordenadora numa escola de 300 apostilas (11.0, infra); o laço de invalidação que iria a 429 (11.0 r3); e o ensaio novo que somou o job `infra` acima de 45 min (3.0, correção `job-de-infra-passa-de-45-min`) | 4 itens em 2 tarefas, 1 correção | Tech Spec §7c (aviso 4) |
| E | **O acréscimo que quebra o teste de inventário fora do diff** (o grupo D da F2c, de novo): a FK nova no catálogo do MVP (5.0, dois vermelhos), o campo obrigatório no diálogo que o `e2e/support/professor-flow.ts` percorre (7.0), o teste com o teto antigo escrito em número (9.0) | 3 vermelhos (4 execuções), 3 correções | o portão (M2); `executar-task`, "Quem usa o que mudou" (aviso 5) |
| F | **A integração rodada à mão com os workers do compose de pé dá vermelho falso** nos testes que extraem PDF: o Implementador na correção `esteira-vermelha-b942d26`, a correção `reenvio-fora-do-alcance` ("workers de pé disputavam a extração"), o Validador na rodada 2 (menor 5) | 3 | o `globalSetup` da integração (M3) |
| G | **A seção "Revisões" apagada por `Write`**: a 9.0 perdeu a 1ª rodada inteira (7 linhas, 2 reprovações), e a 12.0 a refez à mão. É a M2 da F2c, aceita em 11/11 e ainda `[ ]` no `TODO.md` | 2 | a M2 da F2c (item P) |
| H | **A fatia do e2e acima do teto no meio de uma tarefa**: a 6.0 parou em divergência de portão e virou a correção `e2e-fatia-acima-do-teto` (11ª fatia, onze nomes `e2e N/10` trocados à mão); na F2c foi a `e2e-decima-fatia` | 2 specs seguidas | a esteira (M4) |
| I | **O relógio da máquina**: a correção `testes-com-relogio`, a ordem da auditoria no e2e da 7.0, a carga da 9.0 com duração negativa (duas divergências de portão) | 4 | sem proposta: a causa era o timesyncd, desligado em 13/11; a autoconferência 10 já diz como o teste não depende do relógio, e nenhum revisor reprovou por isso. As quatro rotas de produção com `now()` contra `defaultNow()` (menor da validação r1) são defeito de produto e vão ao `TODO.md` pelo Orquestrador |
| — | Uma vez só, sem proposta: o Implementador esperando o próprio portão com `pgrep -f` que casava com o próprio bash (o aviso do passo 6 não chegou); o `maestri ask` com a opção `--timeout` mal posta, que deixou a 11.0 uma hora parada; a varredura por amostragem na correção `testes-com-relogio` (duas reprovações na mesma correção); o vermelho pelo motivo errado (9.0, `TypeError`) | 1 cada | — |

**Revisão da spec.** As 21 não aprovadas: o PDF órfão quando o commit falha (infra, test-engineer, revisor-geral), o filtro de
série e licença só na busca por texto (revisor-geral, tenancy, infra), a ordem da checagem de material diante da D36 (conformidade), a
licença sem retenção (privacy), o 429 sem tela (frontend), a edição sem `for update`, e o `infra-guardian` em seis rodadas pelos
tetos de envio e pelo cenário de carga das 300 apostilas. É o desenho que a revisão existe para pegar.

**Falsos positivos.** Nenhum.

**Pendências marcadas para a retro**

| Pendência | Destino |
|---|---|
| Derivar o `/N` do `name` e do `--shard` de `strategy.job-total` (ordem r1 da correção `e2e-fatia-acima-do-teto`) | M4 |
| O portão rodar `mvp-tables.int.test.ts` quando há migration (recomendação do `test-engineer`, correção `fk-a-mais-no-catalogo-do-mvp`) | M2 |
| A integração à mão com os workers de pé (o Implementador, a correção do reenvio, o menor 5 da validação r2) | M3 |
| As quatro rotas com `now()` contra `defaultNow()` (correção `testes-com-relogio`, menor da validação r1) | `TODO.md`, pelo Orquestrador (produto, não processo) |
| A varredura por amostragem custou duas reprovações | uma ocorrência; sem proposta |
| O aviso do passo 6 não chega ao Implementador (o laço de `pgrep`) | uma ocorrência; sem proposta |
| O `--timeout` mal posto no `maestri ask` (11.0) | uma ocorrência; sem proposta |
| Conferir a seção "Revisões" da 12.0 contra o hook | conferida: bate com o `achados/12_task.md`, 15 linhas |
| 12.0: o rascunho de `CorrecaoDoMaterial` que nasce uma vez; o `seriesDaEscola` fora da transação | defeitos de produto, já no `TODO.md` (`TODO.md:3599` e `:3604`) |

## Propostas

### Aviso (só skill, papel ou modelo de documento), mostradas às 15:13, com hora para aplicar às 15:43

**Aviso 1. A conferência do documento antes de cada rodada** (grupo A, 10)

```
Mudança: .claude/skills/executar-task/SKILL.md, passo 5, o parágrafo "Antes de pedir, para cada linha de Divergências resolvidas…"
  passa a valer antes de cada rodada, a primeira e as seguintes, com mais três conferências:
  (a) cada caso citado na tabela "Testes que provam a regra" está no arquivo com esse nome (grep -F do começo do nome) e prova o que a
      linha diz: caso renomeado ou dividido numa rodada leva a linha junto (a 6.0 e a 8.0 da F4 reprovaram por isso);
  (b) cada linha de "Recomendações sem aplicar" com destino TODO.md está no TODO.md da árvore (a 12.0 reprovou; a 5.0, a 7.0 e a 9.0
      deixaram o trabalho para o Orquestrador);
  (c) a rodada que mudou o desenho procura o termo antigo em docs/ (lgpd.md, runbook.md, infra.md) e nos comentários (a 1.0 e a 2.0).
Efeito esperado: as reprovações do revisor-geral e do test-engineer por documento que diz o que a árvore não tem.
```

**Aviso 2. A divergência que o PRD contradiz não é detalhe** (grupo A, o maior 1 da validação)

```
Mudança 1: .claude/agents/arquiteto.md, "Divergência", antes das três saídas: "Antes de dar como detalhe, procure o termo no prd.md
  (RF e casos de borda). Se o PRD fala do caso, é a terceira, mesmo que a Tech Spec cale." Com o caso da 9.0 da F4 (a adaptação com
  licença vencida, contra o RF7, o RF11 e um caso de borda; duas correções e duas paradas do Joaquim no fim).
Mudança 2: .claude/skills/criar-tasks/task-template.md, autoconferência 8, no fim: "e o prd.md não diz o contrário (procure o termo
  nos RF e nos casos de borda): se diz, é DIVERGÊNCIA de desenho, não linha da tabela".
Efeito esperado: a decisão contra o PRD chega ao Joaquim na tarefa, e não na validação.
```

**Aviso 3. O teste cria a condição de que depende** (grupo C, 5)

```
Mudança: task-template.md, autoconferência 4, no fim: "E o teste cria a condição de que depende (o serviço parado, o job que roda,
  o objeto que existe), em vez de herdá-la de outro arquivo ou de um fixture que pula o caso; e o dublê lança o erro que a produção
  lança (o tipo que o adaptador traduz, como FileStorageUnavailableError), não new Error. Na F4, a 1.0, a 2.0 e a 3.0."
Efeito esperado: as cinco reprovações da 1.0, 2.0 e 3.0.
```

**Aviso 4. A conta do laço e do ritmo na Tech Spec** (grupo D, 4 e uma correção)

```
Mudança: .claude/skills/criar-techspec/template.md, §7c, linha nova "Laços e ritmo": job em laço, lote × prazo de cada passo ×
  passadas ≤ prazoMs, e o laço para no sinal; tela que se relê sozinha, pedidos por minuto da aba inteira (todas as leituras que ligam
  juntas) na maior escola do dimensionamento (docs/infra.md §3.5) contra LIMITE_REQ_USUARIO_MIN; suíte nova no projeto infra, a soma
  das durações contra o timeout-minutes do job.
Efeito esperado: as reprovações da 2.0 e da 11.0 e a correção do job de 45 min, pegas na revisão da spec.
```

**Aviso 5. O formulário que muda quebra quem o percorre** (grupo E, a parte do e2e)

```
Mudança: executar-task/SKILL.md, "Quem usa o que mudou", depois de "Acrescentar também conta": "Campo novo obrigatório num formulário
  quebra quem o percorre em e2e/support/ (professor-flow.ts, na 7.0 da F4); e o teste que escreveu a constante em número fica com o
  valor antigo (9.0): importe a constante."
Efeito esperado: o vermelho da 7.0 e um dos três da 9.0.
```

### Confirmação

**M1. O portão confere o que o documento cita** (grupo A; código de processo em `tools/processo/`, ao lado de `divergencias.ts`)

```
Mudança: aviso informativo do portão, como o --faltando e o de divergências: (a) cada `arquivo` › "nome…" da tabela "Testes que provam
  a regra" cujo começo do nome não está no arquivo; (b) linha nova de "Recomendações sem aplicar" com destino TODO.md quando o TODO.md
  não mudou desde a base. Caso de teste para cada lado.
Recomendo: aplicar, como correção. O texto do passo 5 já mandava conferir a divergência e o erro voltou quatro vezes; as duas
  conferências são mecânicas e cabem num grep.
```

**M2. O portão roda o inventário quando o diff toca o inventariado** (grupo E; `tools/processo/sequencia-do-portao.ts`)

```
Mudança: migration nova em packages/core/drizzle/ puxa packages/core/src/db/schema/mvp/mvp-tables.int.test.ts; infra/compose.yml puxa
  tools/ci/compose.int.test.ts. A tabela de "caminho → inventário" fica num lugar só, com teste.
Recomendo: aplicar, como correção. O aviso 4 da F2c era texto e o grupo voltou três vezes; o test-engineer pediu o mesmo na correção
  da FK. Custo: um arquivo de integração a mais só na tarefa com migration.
```

**M3. A integração à mão recusa os workers de pé** (grupo F; `tools/testes/integracao.setup.ts`)

```
Mudança: o globalSetup da integração confere se há worker de pé no compose de teste e, havendo, recusa com a mensagem e o comando
  que os para (o mesmo stop da sequência do portão). Não derruba sozinho: o ambiente de pé pode ser a vitrine ou o e2e de alguém.
Recomendo: aplicar, como correção. Três vermelhos falsos nesta spec, um deles na validação.
```

**M4. A fatia do e2e vem da conta** (grupo H; `.github/workflows/ci.yml` e `tools/ci/esteira.test.ts`)

```
Mudança: um passo curto conta os casos (playwright test --list) e gera a matriz com N = teto(casos / 180) por fromJSON; o name e o
  --shard derivam de strategy.job-total. O teste do teto passa a provar a conta, e não um N escrito.
Recomendo: aplicar, como correção. Foram duas specs seguidas com a tarefa parada no portão por uma fatia a mais; a matriz gerada é o
  padrão do GitHub Actions (D81). Custo: um job de ~1 min antes do e2e.
```

**P. A M1 e a M2 da F2c, aceitas e não feitas** (grupos B e G)

```
Seguem [ ] no TODO.md desde 11/11. Voltaram na F4: 3 das 6 do grupo B são o que a M1 listaria, e a 9.0 perdeu a 1ª rodada inteira.
Recomendo: o Orquestrador as fazer como correções antes das tarefas da X6. Já estão aceitas; não pedem palavra nova.
```

## O que tirar

Nada. O `tenancy-guardian` e o `conformidade-reviewer` rodaram 26 vezes cada sem reprovar, e o `frontend-reviewer` 13, mas os três
deixaram recomendações que viraram decisão (a escolha 1(a) da adaptação partiu do `conformidade-reviewer`) e correm em paralelo.
Tirar o guardião de isolamento de uma spec que abre licença e material de terceiro seria ler o número ao contrário (regra 10).

## Decisão

Mostrei o bloco ao Joaquim em 14/11/2026, às 15:13, no terminal do Arquiteto 2. Ele respondeu "aprovo" em 15/11/2026, às 11:38, que vale a
recomendação de cada uma. Os avisos foram aplicados depois da resposta; nenhum teve objeção.

| Proposta | Tipo | Resultado | Onde |
|---|---|---|---|
| 1. Conferência do documento antes de cada rodada | aviso | aceita, aplicada | `.claude/skills/executar-task/SKILL.md`, passo 5 |
| 2. Divergência que o PRD contradiz não é detalhe | aviso | aceita, aplicada | `.claude/agents/arquiteto.md`, "Divergência"; `task-template.md`, autoconferência 8 |
| 3. O teste cria a condição de que depende | aviso | aceita, aplicada | `task-template.md`, autoconferência 4 |
| 4. A conta do laço e do ritmo | aviso | aceita, aplicada | `.claude/skills/criar-techspec/template.md`, §7c, linha "Laços e ritmo" |
| 5. O formulário que muda quebra quem o percorre | aviso | aceita, aplicada | `executar-task/SKILL.md`, "Quem usa o que mudou" |
| M1. O portão confere o que o documento cita | confirmação | aceita, como correção | `TODO.md`, "Da retrospectiva da F4" |
| M2. O portão roda o inventário | confirmação | aceita, como correção | idem |
| M3. A integração à mão recusa os workers de pé | confirmação | aceita, como correção | idem |
| M4. A fatia do e2e vem da conta | confirmação | aceita, como correção | idem |
| P. M1 e M2 da F2c antes das tarefas da X6 | já aceitas | recomendado ao Orquestrador | `TODO.md`, cabeçalho da seção da F4 |

Recusadas: nenhuma.

Itens do `TODO.md` que esperavam esta retro: o segundo chamador de `fontesDosMateriais` (sem mudança enquanto houver um), os dois
vazios e o texto do aviso da migração na aba Material (mudam tela e `cenarios.md`: vão à próxima spec que tocar a aba, com o
Joaquim) e o rascunho de `CorrecaoDoMaterial` (defeito de produto, correção própria). Cada linha ganhou a anotação.
