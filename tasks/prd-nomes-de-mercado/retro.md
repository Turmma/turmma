# Retrospectiva — nomes-de-mercado (X8)

02/11/2026, pelo Arquiteto, no térreo, depois do pouso (`d39802c8`) com a esteira da `develop` verde (`41552162418`, os doze
jobs, o `infra` com o `jobs.int.test.ts` no compose incluído). Comparação com a retrospectiva da X4
(`tasks/prd-telas-do-aluno-e-primeiro-acesso/retro.md`).

O que pesa nos números:

- é a primeira spec de **rename**: 13 tarefas, duas de ferramenta (1.0 e 2.0, `tools/renomear/`), dez ondas de rename e uma
  guarda (12.0). Nenhuma regra de negócio nova, e quase toda prova é um **bloco de mutação de trava** (`travas.md`, formas A, B
  e C), não um caso novo (RF7);
- três linhas, todas com Sonnet 5.5; quatro adendas do inventário e duas paradas do Joaquim na construção (adendas 4 e 5), mais
  uma no fechamento (adenda 6) e o pouso, todas respondidas com a recomendação;
- o PC desligou ou reiniciou três vezes (01/11 ~00:21, 01/11 no meio da 11.0, 02/11 de manhã).

## Medidas

```
Tarefas: 13 · Rodadas de revisor: 151 · Reprovações: 23 (15,2%)
Por revisor: test-engineer 28/13 · revisor-geral 27/10 · tenancy, privacy, conformidade e infra 22/0 cada
             llm-integrator 4/0 · frontend-reviewer 4/0
Por modelo do implementador: Sonnet 5.5 nas 13; 11,6 rodadas e 1,8 reprovação por tarefa; 3 diagnósticos do Arquiteto
  (3.0, 9.0 e a correção duracao-do-e2e-so-nomes-do-mapa, as três com ESCALADA), nenhum BLOQUEIO
Rodadas por tarefa: média 11,6, pior 9.0 com 16 (três rodadas, três reprovações, escalada do revisor-geral)
Rodadas que caducaram sem reprovação do próprio revisor: 46 de 151 (30%)
Correções fora de tarefa: 26, com 168 rodadas e 17 reprovações (10,1%)
Duração: spec 29/10 19:58 → tarefas 30/10 ~01:30; construção 30/10 03:56 (1.0) → 02/11 00:06 (13.0), ~68 h;
  fechamento 02/11 00:06 → pouso 21:20, ~21 h (três rodadas de validação, sete correções, merge da develop)
  Intervalo entre commits de tarefa: mediana ~4 h 10 (de 34 min a 16 h 47)
Revisão da spec (29/10): 29 rodadas, 21 não aprovadas; o revisor-geral aprovou na 8ª e o test-engineer na 9ª (18 na X4)
Validação: rodada 1 REPROVADA (crítico no RF8), 2 REPROVADA (crítico no RF2), 3 APROVADA com 4 menores
```

Como contei: as tabelas "Revisões" dos 13 `N_task.md`, de `revisao-spec.md` e das 26 correções do período que correram no
andar da X8 ou nas linhas dela (de `2026-10-30-aplicar-lento-no-move` a `2026-11-02-merge-da-develop`; ficaram de fora as seis
de tela e de runbook que correram em outro andar: `contorno-do-campo-de-conversa`, `links-do-runbook`,
`primeira-carga-do-e2e`, `tela-de-entrar`, `onca-na-entrada`, `cenario-da-onca`); os blocos de `achados/` de cada
reprovação; o tempo pelo `git log`; a esteira por `gh run list --branch spec/nomes-de-mercado`.

| | F3 | X3 | X5 | X7 | X4 | X8 |
|---|---|---|---|---|---|---|
| Tarefas | 20 | 14 | 36 | 21 | 11 | 13 |
| Reprovações nas tarefas | 22,9% | 15,3% | 21,3% | 17,3% | 10,4% | 15,2% |
| Rodadas por tarefa | 11,8 | 8,4 | 6,6 | 7,1 | 12,2 | 11,6 |
| Caducadas sem reprovação | 34% | 33% | 29% | 29% | 33% | 30% |
| Correções fora de tarefa | 9 | 19 | 6 | 13 | 19 | 26 |
| Crítico ou maior no 1º /validar | 1 c, 2 M | 4 c, 4 M | 1 c, 1 M | 1 c, 1 M | 1 c | 1 c (e mais 1 c depois) |
| Tarefas sem nenhuma reprovação | 1 de 20 | 4 de 14 | 15 de 36 | 7 de 21 | 2 de 11 | 1 de 13 |

## As cinco medidas da D79

**1. Da partida ao commit.** Não legível para todas (as partidas das linhas não ficaram no `estado.md` com hora). O intervalo
entre commits de tarefa tem mediana de ~4 h 10, contra ~99 min na X4 e 38 na X7. Não é a mesma tarefa: cada onda roda o
`aplicar` sobre o repositório inteiro e o portão com o e2e completo (~1 h 10 por tarefa de web), e sete das treze tiveram
divergência no meio. Onde a partida está escrita: 12.0, 16:55 → 20:57 (4 h, com a parada da adenda 5).

**2. Tarefas sem reprovação.** 1 de 13 (11.0). Era 2 de 11 na X4.

**3. O grupo A (mutação).** **9** reprovações por bloco de mutação (grupos A e B abaixo), contra 2 na X4 e 8 na X7. Mas a
natureza mudou: na X4 o bloco faltava, e o `--faltando` o apontava; na X8, em cinco das nove o bloco **existia e ficava
vermelho**, só que pelo motivo errado (o caso caía numa asserção anterior à da trava). Nem o portão nem o `--faltando` veem isso
hoje: os dois só exigem que um caso falhe.

**4. Vermelhos da esteira por push.** Na `spec/nomes-de-mercado`: 80 execuções, **22 verdes, 8 vermelhas, 50 canceladas**
(superadas pelo `concurrency`). Do push ao veredito, mediana de **39 min**, máximo de 75 (igual à X4). Dos 8 vermelhos, **só 1
foi da X8** (`5d6c2e0`: a correção `runbook-tipos-de-erro` escreveu 21 nomes antigos num teste novo, e o `restos` da esteira os
pegou; correção `restos-no-tipo-do-log`). Quatro foram e2e intermitentes de specs anteriores, consertados no andar
(`introducao-da-coordenacao-no-celular`, `gaveta-aberta-na-alocacao`, `conversa-sem-titulo-na-entrada`,
`introducao-pular-grava-a-data`, este com dois vermelhos), e dois não se repetiram ao rodar de novo (`governanca.spec.ts:132`
no celular; o 500 da prova do aluno, com o disco do runner lento).

**5. Do último commit ao pedido de pouso.** Último commit com mudança fora de `tasks/` às 19:37 (`ac0c9831`, merge da
`develop`); pedido de pouso depois da esteira de `ac0c983`, que ficou vermelha (o 500 da prova), teve a correção sem defeito
provado e ficou verde ao rodar de novo: **~2 h**. Era ~1 h na X4.

O número que pesa é o das **26 correções**. Onze foram da própria ferramenta da 1.0 e da 2.0 (grupo F), três da régua de
duração do e2e (que cobrava prazo de caso tocado só pelo rename), quatro de e2e intermitente da dívida, quatro de documento ou
adenda, duas de processo (o encontro da 9.0 com conflito; o portão contava o merge diferente do hook do git) e **duas de regra
10, defeitos reais achados de passagem** pelo `tenancy-guardian` na 13.0 (`mensagemDoAssistente` e `mensagemDoTutor` sem
`requireAnoEmCurso()`).

## Grupos de causa

### Tarefas (23 reprovações)

| # | Causa | Ocorrências | Onde | Onde evitar |
|---|---|---|---|---|
| A | **Bloco de mutação vermelho pelo motivo errado**: a mutação quebra uma asserção anterior à da trava, e a trava nunca roda | 5 | 3.0 ×2 (forma B de `erro.int.test.ts`; na 2ª, a reordenação mudou as linhas), 4.0 (`porta-unica.test.ts:74`: cai no `toEqual` da 73), 7.0 (`ZONAS` não prova a volta ao nome antigo), 10.0 (`estados.test.tsx:32`: cai no `toBe` da 30) | portão: o `mutacoes.ts` aceita qualquer caso que falhe; autoconferência: nenhuma pergunta manda ler **qual** `expect` caiu |
| B | **A prova declarada não existe ou não alcança o que a linha diz** | 4 | 6.0 (`ZONAS` mudou sem bloco), 8.0 ×2 ("Sem mutação" com a onda tendo achado travas), 13.0 (a linha cita o `restos` como prova dos README, e ele não os lê) | autoconferência: "Sem mutação" não tem condição escrita; a pergunta 7 (o documento não afirma o que não aconteceu) cobre, mas não foi aplicada à seção "Mutações" |
| C | **Nome antigo que sobra onde o `restos` não olha** | 5 | 3.0 (entrada da 3.3 fora do mapa), 4.0 (a "Troca à mão" do relatório não feita), 5.0 (`package-lock.json` com `@educa/nucleo`), 6.0 (caminho antigo em `apps/web`, `e2e/`, `docs/`, busca da 6.4 marcada feita), 10.0 (dois arquivos de teste com nome antigo) | Tech Spec: os limites do `restos` (nome de arquivo sem a pasta, caminho parcial em comentário, `.md` e JSON, `package-lock.json`, declaração sem uso) só foram escritos no meio das ondas; a busca à mão que os cobre era subtarefa, sem o comando |
| D | **A troca mecânica mudou o sentido** do comentário ou do documento | 4 | 7.0 (`realtime.fixture.ts:21` passou a citar o `loadConfig` de outro pacote), 9.0 (o `<Tela>` da convenção de chunk virou `<Page>`), 9.0 (a amostra `Vizinha.tsx` existia por começar com o nome do alvo, e perdeu a prova), 13.0 (`mvp-rapido.md` apontava ao mockup, que fica fora da X8) | Tech Spec: a regra "palavra inteira estraga a prosa" foi pega na revisão da spec (revisor-geral, rodadas 1 a 6), mas só para palavra comum; nome que cita **outra** peça, ou o mockup, não tinha linha |
| E | Ramo novo da ferramenta sem caso | 3 | 1.0 (ocorrência sem linha no formato certo), 2.0 (`isNoSubstitutionTemplateLiteral`), 12.0 (`.filter(... 'Identifier')`) | autoconferência: o `--faltando` lê `tools/` e lista essas linhas, mas só informa; nos três, o documento não mostra que foi rodado |
| G | Divergência decidida sem registro | 1 | 1.0 (`simbolos.ts:97`) | já coberto: a regra está no `executar-task` |
| H | A exigência de um revisor quebrou a ferramenta do outro | 1 | 9.0 (a correção da amostra pedida pelo test-engineer deixou o `conferir` vermelho; escalada, diagnóstico) | é o que a escalada existe para resolver |

**Falsos positivos.** Nenhum. Os quatro guardiões de caminho rodaram 88 vezes nas tarefas sem reprovar, e não proponho tirá-los
(seção "O que tirar").

### Correções (o que custou a construção)

| # | Causa | Ocorrências | Onde evitar |
|---|---|---|---|
| F | **A ferramenta da 1.0 e da 2.0 só foi provada em fixture**, e o repositório real a quebrou onda a onda | 11 correções (`aplicar-lento-no-move`, de 12 h projetadas a 6,8 s por projeto; `aplicar-perde-simbolos-e-troca-js-por-ts`; `aplicar-lento-com-dependentes`, 3 h 33 projetadas; `conferir-homonimo-de-outro-pacote` e `-no-mesmo-pacote`; `restos-nao-segue-o-move`; `mapa-de-repetido-entre-pacotes`; `mapa-copias-do-mesmo-nome`; `reaplicar-filtra-arquivo`; `restos-no-tipo-do-log`; `guarda-formas-do-inventario`) | Tech Spec: o critério das tarefas de ferramenta não tinha tempo nem resultado medido sobre a árvore real. O `estado.md` registrou a lição duas vezes na 3.0 ("a 1.0 não foi provada sobre o repositório real") |
| R | Rename fora do inventário decidido dentro de uma correção | 1 (`ProcessadorContado` → `CountingProcessor`, chamado de "colisão" na `guarda-formas-do-inventario`) | `corrigir`: nada diz que nome novo fora do mapa é divergência; custou a rodada 2 da validação e uma parada do Joaquim (o menor da rodada 3 da validação, com dono "retro da X8", no `TODO.md`) |

## Os pontos deixados para esta retro

**Da 6.0 ("Devo ainda (retro, da 6.0)" do `estado.md`):**

- *Fixture `kit-importa-api.ts` sem linha em "Não muda, mas parece".* Já fechada pela triagem da 9.0 (`inventario-web-e2e.md:553`).
- *A regex `IMPORTA_O_LOGIN_SERVICE` nas divergências.* Registro aqui, para o histórico: na 6.0, `\b` virou `(?<![\w-])` em
  `apps/api/test/architecture.test.ts` porque `external-login.service` casava com o padrão; o bloco de "Mutações" da 6.0 já
  descrevia a razão. Sem mudança de arquivo.
- *As listas de `architecture.test.ts` (559, 634, 1394, 1439) no `travas.md`.* Conferi na árvore pousada:
  `QUEM_PODE_CITAR_AS_CHAVES` (hoje na 555) e `FORA_DA_VARREDURA` (197) são listas de permissão e de exclusão: caminho
  envelhecido faz o arquivo do caminho novo ser acusado, ou deixar de ser excluído, e o caso fica vermelho, alto; os seis
  caminhos existem. As listas que só nomeiam (`QUEM_USA_A_ROTINA`, `QUEM_PODE_TOCAR_*`) já têm `existsSync` (312, 392, 499,
  1355). Nada a acrescentar ao `travas.md`, que é anexo histórico da X8.
- *O `restos` cego a nome sem pasta (e a caminho parcial em comentário, `.md` de `apps/` e rótulo de JSON).* É o grupo C. O
  limite fica escrito na seção "Para a próxima spec de rename", abaixo, junto com o menor de `sintaxe.ts:31-34` que já está no
  `TODO.md` (o `restos` não cobra a própria declaração).
- *`docs/decisoes.md` cita `apps/web/src/componentes/ui/onca/`* (hoje na linha 1509, na revisão de 28/10 da D80). O caminho não
  existe desde a 9.0 (`apps/web/src/components/ui/onca/`, como já dizem o `CLAUDE.md` e o `docs/interface.md`). Texto de decisão:
  proposta M2, confirmação.
- *Cinco arquivos só de comentário fora dos previstos* (`metrics.test.ts`, `job-definitions.ts`, `vitest.config.ts`,
  `.size-limit.json`, `infra/compose.yml`). A 7.0 levou à Tech Spec §5 o parágrafo que cobre arquivo fora dos previstos tocado
  só pelo rename. Fechado; a lição vai à seção da próxima spec de rename.
- *Antes do pouso: `infra/test/jobs.int.test.ts` e `carga-login` em modo seco.* O `jobs.int.test.ts` roda no job `infra` da
  esteira, verde em `41552162418` (`d39802c8`, a `develop` pousada). O `carga-login` não tem modo seco nem roda na esteira; o
  que ele carrega do `dist` são quatro caminhos (`infra/scripts/carga-login.ts:336-339`, os mesmos em `carga-sala.ts:247-250`),
  e os quatro fontes existem na árvore pousada (`packages/core/src/index.ts`, `apps/api/src/operacao/escola/escola.ts`,
  `apps/api/src/sessao/tenant/synthetic-sessions.ts`, `apps/api/src/credencial/password-hasher.ts`), assim como o do
  `medir-risco-a-vida.ts:213`. Fechado.

**Da 7.0 e da 9.0 ("Para a retro" no `estado.md`):**

- *Títulos de caso com o nome antigo* (`describe`/`it` com `MensagemIA`, `AvatarAgente`; o RF7 os manteve). Ficam: mudar o
  título é mudar o caso, e a X8 prometeu os mesmos casos. Quem tocar o arquivo depois troca o título junto (sem proposta).
- *`ContaExternalRepository` mistura idiomas* (`inventario-back.md:94`). Segue a regra do §1 do inventário: o substantivo de
  domínio fica em português (`Conta`), o pedaço técnico vai ao inglês. Fica.
- *O portão não roda o `conferir`* e *portão de 1,2 h por tarefa de web.* Os dois são do rename: o `conferir` rodou pela mão de
  quem implementou e dos revisores em toda onda, e o portão longo é o e2e inteiro que toda onda de web puxa (ela toca quase
  todo spec). Vão à seção "Para a próxima spec de rename" (item 7), sem mudança no portão de agora.

**Do `TODO.md` (validação, rodada 3, dono "retro da X8"):** o rename fora do inventário que passou como "colisão" é o grupo R:
proposta P5. Com ela aplicada, a linha sai do `TODO.md`.

## Para a próxima spec de rename

A renomeação técnica de `educa` para `turmma` (`CLAUDE.md`) vai usar `tools/renomear/`. O que a X8 aprendeu e que a Tech Spec
dela precisa dizer desde o começo:

1. **Os limites do `restos`**, com a busca à mão que cobre cada um, como comando, não como subtarefa: nome de arquivo sem a
   pasta-mãe; caminho parcial em comentário, em `.md` dentro de `apps/` e em rótulo de JSON; regex com pedaço do caminho ou
   alternância que parte o nome; `package-lock.json`; a própria declaração sem uso (`sintaxe.ts:31-34`, no `TODO.md`).
2. **A prosa que cita outra peça.** A troca mecânica em comentário e documento erra quando o texto fala de uma peça homônima de
   outro pacote (o `loadConfig` do realtime), de um marcador de modelo (`<Tela>`), ou do mockup, que fica fora: a revisão da onda
   lê cada comentário trocado com essa pergunta.
3. **A amostra de teste que existe pelo nome** (`Vizinha.tsx`, que provava o prefixo): o inventário a lista em "Não muda, mas
   parece", ou ela muda junto com a mesma relação ao nome novo.
4. **A ferramenta é provada sobre a árvore real antes da primeira onda** (proposta P6): tempo do `aplicar` do maior mapa sem
   gravar, e `conferir` e `restos` limpos na árvore sã.
5. **A régua de duração do e2e** já tira da cobrança o caso tocado só por nome de mapa (`duracao-do-e2e-so-nomes-do-mapa`);
   rename que trocar texto de caso (`it(`) precisa da mesma isenção pensada antes.
6. **Os avisos de pouso de operação:** o campo `tipo` do log mudou de nome em vinte classes de erro, e busca de log salva com o
   nome antigo deixa de achar (`docs/runbook.md`, correção `runbook-tipos-de-erro`). Rename de classe de erro leva a linha ao
   runbook na mesma onda.
7. **O `conferir` no portão.** Na X8 ele rodou à mão; numa spec de rename, o portão da onda o roda com o mapa da tarefa, e o
   e2e inteiro que cada onda de web puxa (~1 h 10) entra na conta do prazo das tarefas.

## Propostas

### Aviso (só skill; aplico às 22:35 de 02/11 se o Joaquim não objetar)

**P1. Ler qual `expect` caiu na mutação** (grupo A, 5)

```
Mudança: .claude/skills/executar-task/SKILL.md, autoconferência, depois do parágrafo "O portão da tarefa aplica cada bloco…",
  e .claude/skills/corrigir/SKILL.md, no passo do portão: "Vermelho não basta: tem de ser o da cláusula. Se o caso tem mais de
  um `expect`, em especial uma negativa (`not.toContain`, `not.toMatch`) depois de uma positiva, rode o caso mutado uma vez,
  isolado, e leia na saída a linha do `expect` que caiu: tem de ser a da cláusula que o bloco diz provar. Se caiu antes, troque
  a mutação por uma que deixe as asserções anteriores verdes. Na X8, a 3.0, a 4.0, a 7.0 e a 10.0 reprovaram por bloco vermelho
  pelo motivo errado."
Efeito esperado: as cinco reprovações do grupo A vistas por quem implementa (e pelo portão, com a M1)
```

**P2. "Sem mutação" e a prova citada** (grupo B, 4)

```
Mudança: .claude/skills/executar-task/SKILL.md, no mesmo trecho: "'Sem mutação' só vale com o `--faltando` vazio e sem trava
  achada (no relatório da ferramenta ou no anexo de travas da spec). E a prova que a tabela cita, ferramenta ou caso, tem de ler
  os arquivos da linha: abra o que ela lê antes de citá-la. Na X8, a 8.0 escreveu 'Sem mutação' com travas achadas, e a 13.0
  citou o `restos` como prova de dois README que ele não lê."
Efeito esperado: as quatro reprovações do grupo B
```

**P3. A saída do `--faltando` no documento** (grupo E, 3)

```
Mudança: .claude/skills/executar-task/SKILL.md, no parágrafo "Antes de pedir a rodada, rode … --faltando": acrescentar "e
  escreva no começo de 'Mutações' a linha `--faltando: <n> linhas (<n> blocos, <n> motivos)`. Vale para `tools/` também:
  na X8, a 1.0, a 2.0 e a 12.0 reprovaram por ramo de ferramenta que ele listava." O mesmo em .claude/skills/corrigir/SKILL.md.
Efeito esperado: as três do grupo E; o test-engineer vê de saída se o `--faltando` rodou
```

**P5. Nome novo fora do pedido é divergência** (grupo R, 1, e o menor da validação com dono nesta retro)

```
Mudança: .claude/skills/corrigir/SKILL.md, passo 4, e .claude/skills/executar-task/SKILL.md, seção 3: "Renomear peça que o
  documento não nomeia (fora do mapa, da adenda aprovada ou da lista de arquivos) é DIVERGÊNCIA de desenho, nunca 'colisão'
  resolvida no próprio commit. Na X8, `ProcessadorContado` → `CountingProcessor` entrou numa correção como colisão, reprovou a
  rodada 2 da validação e virou parada do Joaquim (adenda 6)."
Efeito esperado: a rodada de validação e a parada que a adenda 6 custou; a linha do TODO.md sai
```

**P6. Ferramenta provada sobre a árvore real** (grupo F, 11 correções)

```
Mudança: .claude/skills/criar-techspec/SKILL.md, "Seções obrigatórias": "Ferramenta que a spec cria para rodar sobre o
  repositório inteiro (um rename, uma migração de dado, uma varredura): a Tech Spec dá o critério medido sobre a árvore real,
  com tempo e resultado (ex.: 'o maior mapa roda em até 20 min sem gravar; `conferir` e `restos` limpos na árvore sã'), e a
  tarefa que cria a ferramenta o prova antes do commit, não a primeira que a usa. Na X8, a 1.0 e a 2.0 passaram só em fixture,
  e onze correções da ferramenta vieram nas ondas (o `aplicar` com 12 h projetadas na 3.0 e 3 h 33 na 5.0, símbolos perdidos,
  homônimos, o `reaplicar` sem filtro)."
Efeito esperado: a maior parte das 11 correções do grupo F antes da 3.0, não espalhadas por três dias
```

### Confirmação, item a item

**M1. O bloco de mutação diz qual `expect` tem de cair** (`tools/processo/mutacoes.ts`, código de processo; grupo A)

```
Mudança: tools/processo/mutacoes.ts — uma linha de cabeçalho opcional, `falha: <trecho da linha do expect>` (ex.:
  `falha: not.toContain('insertAuditoria')`). Com ela, a corrida lê a mensagem de falha do caso no relatório do Vitest ou do
  Playwright (o trecho de código que os dois imprimem junto do erro) e recusa o bloco com "vermelho em outra asserção" quando
  o trecho não está lá. Sem a linha, nada muda. Teste em mutacoes.test.ts (o trecho certo passa; o caso que cai numa asserção
  anterior é recusado) e bloco de mutação da própria cláusula. O executar-task (P1) passa a pedir a linha em toda asserção
  negativa.
Custo: uma corrida a menos de revisor por reprovação evitada; nenhum tempo de portão a mais
Efeito esperado: as cinco reprovações do grupo A vistas pelo portão, antes da Mesa
```

**M2. O caminho da onça na D80** (`docs/decisoes.md`, texto de decisão)

```
Mudança: docs/decisoes.md:1509, na revisão de 28/10 da D80, depois de "`apps/web/src/componentes/ui/onca/`": acrescentar
  "(desde a X8, `apps/web/src/components/ui/onca/`)". Só o caminho; o texto da decisão não muda.
Efeito esperado: quem lê a D80 acha a pasta; o CLAUDE.md e o interface.md já dizem o caminho novo
```

### O que tirar

Nada. Os quatro guardiões de caminho rodaram 88 vezes nas tarefas e 76 nas correções com uma reprovação só (a do
`tenancy-guardian` na `mensagem-do-assistente-por-ano`), e a medida sugeriria tirá-los de onda de rename. Não sustenta: numa
spec que renomeia as travas da regra 10 e da 20 (`escopo-dos-repositories.ts`, `regras-tenant.mjs`, a porta única da
auditoria), são eles que conferem que a trava renomeada continua guardando; as recomendações deles deram o aviso de pouso do
`tipo` do log (infra) e as duas correções de regra 10 que a 13.0 achou (tenancy). Tirar guardião de onde ele pode provar
isolamento não entra por retrospectiva.

## Decisão

Perguntei ao Joaquim em 02/11/2026, às ~22:05, no terminal do Arquiteto. Ele respondeu às ~22:13: "M1 sim, M2 sim caso for o
melhor", sem objetar aos avisos; apliquei os avisos junto com as confirmações, sem esperar as 22:35. O M1 muda código de
processo e vira correção no `TODO.md`, como na X4 e na X7.

**O M2 é o melhor?** Conferi antes de aplicar. A linha 1509 é o **único** caminho de código envelhecido pela X8 em todo o
`docs/decisoes.md` (busquei cada `de` dos mapas da X8 no arquivo: os outros achados são palavra comum em prosa, como "Conversa"
e "Estado", ou `Enfileirador` e `ContadorEmJanela` dentro da D81, que a revisão de 24/10 da própria D81 já explica). Com um
caminho só, uma nota geral no topo do arquivo seria mais texto que o problema; reescrever o caminho apagaria o que a revisão de
28/10 disse naquele dia. O parêntese guarda o histórico e leva o leitor à pasta. Nenhum teste lê o arquivo (o `restos` o deixa
de fora, `tools/renomear/texto.ts:20`). Aplicado.

| Proposta | Decisão | Onde |
|---|---|---|
| P1. Ler qual `expect` caiu na mutação (aviso) | aplicada; o caso foi para `docs/processo-licoes.md` (o `executar-task` não guarda diário, X7 RF22) | `executar-task/SKILL.md`, passo 2; `corrigir/SKILL.md`, passo 4 |
| P2. "Sem mutação" e a prova citada (aviso) | aplicada, no mesmo parágrafo da P1 | `executar-task/SKILL.md`, passo 2 |
| P3. A linha `--faltando:` no começo de "Mutações" (aviso) | aplicada | `executar-task/SKILL.md`, passo 2; `corrigir/SKILL.md`, passo 4 |
| P5. Nome novo fora do pedido é divergência (aviso) | aplicada; fecha o item do `TODO.md` com dono nesta retro | `executar-task/SKILL.md`, passo 3; `corrigir/SKILL.md`, passo 4 |
| P6. Ferramenta provada sobre a árvore real (aviso) | aplicada, com o apontamento para "Para a próxima spec de rename" | `criar-techspec/SKILL.md`, "Seções obrigatórias" |
| M1. O bloco de mutação diz qual `expect` tem de cair | aceita, como correção (código de `tools/processo/`) | `TODO.md`, "Do fechamento da X8", item (X8, retro, M1) |
| M2. O caminho da onça na D80 | aplicada | `docs/decisoes.md:1509` |

Depois das mudanças rodei `tools/processo/harness/` inteiro, `tools/processo/estado.test.ts` e `tools/renomear/restos.test.ts`
(695 casos, verdes) e a guarda `tools/guardas/nomes-de-mercado.mjs` (sai 0). A primeira corrida do `restos` acusou
`corrigir/SKILL.md:82`: a linha da P3 dizia `<n> com bloco` entre crases, e `com` é um `de` de mapa (o `static com(` da 7.0),
que o `restos` lê como código no `.md`. A forma ficou `--faltando: <n> linhas (<n> blocos, <n> motivos)`, nos dois
procedimentos e aqui.
