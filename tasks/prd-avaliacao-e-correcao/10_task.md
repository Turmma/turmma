# Tarefa 10.0 — Tela de aplicar a prova; a API passa a exigir a janela

**Funcionalidade:** avaliacao-e-correcao · **Depende de:** 1.0
**Subagentes obrigatórios:** `privacy-guardian`, `frontend-reviewer`, `test-engineer`, `revisor-geral`, `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian`
**Porte:** grande

## Objetivo

Ao aplicar como avaliativa, o professor define janela, duração, embaralhar e tempo adicional por aluno, vê o resumo
antes de confirmar, e muda a janela antes do primeiro começo; a API passa a recusar avaliativa nova sem janela.

## Contexto necessário

- `techspec.md` §3 (a janela obrigatória na API), §5.1, §9
- `prd.md` RF1, RF2, RF3
- `cenarios.md` §1 (RF1, avaliativa sem janela; RF3), §4 (Aplicar, Mudar janela, 360 px)
- `.claude/rules/50`; `docs/interface.md` §1.7 (a turma aberta) e §10 (as peças)
- `apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx`
- `docs/roteiro-da-demonstracao.md` passo 220 e `e2e/roteiro-da-demonstracao.spec.ts` (perto da linha 470)

## Subtarefas

- [x] 10.1 — Os campos com "avaliativa", cada um com rótulo e erro (`FormField`); o tempo adicional por aluno em lista
  de uma coluna a 360 px, sem motivo; o erro do tempo que não cabe com o texto da §4
- [x] 10.2 — O resumo antes de confirmar; "Mudar janela" no painel da atividade, com resumo, só antes do primeiro início
- [x] 10.3 — A API: avaliativa nova sem janela é `ENTRADA_INVALIDA`; fixtures de teste e de e2e que aplicam avaliativa
  passam a mandar janela
- [x] 10.4 — Roteiro da demonstração (passo 220) e `e2e/roteiro-da-demonstracao.spec.ts`; `docs/interface.md` §1.7
- [x] 10.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx` | alterado |
| `apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx` | novo |
| `apps/web/src/areas/professor/atividades/MudarJanela.tsx` | novo |
| `apps/web/src/areas/professor/atividades/api/atividades.ts` | alterado |
| `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts` | alterado |
| `apps/api/test/atividade.fixture.ts` | alterado |
| `e2e/support/atividade-db.ts` | alterado |
| `e2e/professor-turma-atividades.spec.ts` | alterado |
| `e2e/roteiro-da-demonstracao.spec.ts` | alterado |
| `docs/roteiro-da-demonstracao.md` | alterado |
| `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| Avaliativa nova sem janela | integração | `ENTRADA_INVALIDA` | a não avaliativa sem janela passa; a antiga segue | `apps/api/src/atividade/prova-online.int.test.ts › a avaliativa nova sem janela é ENTRADA_INVALIDA e nada se grava; a que não é avaliativa segue sem janela, e a avaliativa de antes da F6 segue lida como estava`, `… › a avaliativa de antes da F6, aberta e sem janela, ganha a janela pelo PATCH: a auditoria guarda nulo no que ainda não havia` e `packages/shared/src/atividade/prova-online.test.ts › a conferência única diz o campo` |
| Resumo | unidade web | "7ºA · abre 24/11 às 10:00 · fecha às 11:40 · 40 min · 2 alunos com tempo adicional" | fuso do navegador diferente do da escola | `apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › o resumo diz a prova no horário da escola` e `apps/web/src/areas/professor/atividades/prova-online.test.ts › o resumo antes de confirmar` e `… › o horário é o da parede da escola, e não o do computador` (a unidade roda em `Asia/Tokyo`, e o resumo sai no horário de São Paulo) |
| Tempo que não cabe | unidade web | o texto da §4, no campo | com 30 min e +100%, a frase muda os números | `apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › 50 min de janela com 40 de duração e um aluno com +50% recusam no campo "Fecha em", com a frase; com 30 min e +100% a frase muda os números` e `apps/web/src/areas/professor/atividades/prova-online.test.ts › o tempo que não cabe na janela` |
| Campos | unidade web | por `getByLabelText`: "Abre em", "Fecha em", "Duração (minutos)", "Embaralhar questões", "Embaralhar alternativas", "Tempo adicional" (+25/+50/+100); erro ligado ao campo; nenhum outro (sem motivo) | a prática não tem nenhum deles e não lê os alunos | `apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › a prática não tem campo de prova nem lê os alunos; a avaliativa traz os seis campos…`, `… › sem escrever nada, confirmar mostra o erro de cada campo ligado a ele…`, `… › tempo adicional sem duração é erro do campo "Tempo adicional"…` e `… › quem preencheu a prova e voltou a "É prática" aplica como prática…` |
| Mudar janela | unidade web | aparece só antes do primeiro início, com "Ninguém começou ainda"; o resumo antes | com alguém começado, some | `apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › mudar a janela, só antes do primeiro início` (os sete casos: o botão por situação, o diálogo e o PATCH em UTC com dois cliques, a janela com o fim antes da abertura, o erro só depois de confirmar, a prova sem duração, `PROVA_JA_COMECOU` com o diálogo em português e o tempo adicional já marcado), `apps/web/src/areas/professor/atividades/AtividadesDaTurma.test.tsx › se alguém começou entre abrir o painel e confirmar` (a lista lida de novo e o "Mudar janela" que sai do painel) e `apps/web/src/areas/professor/atividades/AtividadesDaTurma.test.tsx › a prova aparece no painel em uma frase…` |
| Quem concedeu o tempo adicional | integração | a auditoria do aplicar com tempo adicional tem a professora como autor e só a contagem | nenhum aluno nem percentual na auditoria | `apps/api/src/atividade/prova-online.int.test.ts › +25%, +50% e +100% sobre 40 min gravam três linhas com quem concedeu` (a frase "fica registrado com o seu nome" da lista) |
| Estados | e2e | carregando, erro com "Tentar de novo", com dado | a primeira leitura dos alunos falha (429) e a segunda vai à API de verdade | `e2e/professor-aplicacao.spec.ts › aplicar pede a escolha "é avaliativa?"…` (a primeira leitura dos alunos fica no ar, falha e é refeita com "Tentar de novo"); e os quatro estados da lista também em `apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › a lista do tempo adicional tem os quatro estados` |
| 360 px, sem rolar de lado; cabe a 1366 × 768 | e2e `celular` e `chromebook` | `paginaNaoRola`; tempo adicional em uma coluna; alvos de 24 px, Confirmar com 44 px | os dois projetos rodam o mesmo caso | `e2e/professor-aplicacao.spec.ts › aplicar pede a escolha "é avaliativa?"…` (a coluna única, os 24 px e os 44 px do Confirmar), o mesmo caso (`paginaNaoRola` com a lista carregada) e `e2e/professor-turma-atividades.spec.ts › a prova que ninguém começou muda a janela pelo painel, com o resumo antes e um pedido só` (os 44 px do botão de confirmar "Mudar a janela" são deste caso; o outro, `… › com alguém começado, o painel diz a prova…`, não tem o botão e só prova o axe do painel) |
| Recomeço | e2e | falha com o diálogo aberto e reaberto: o erro anterior sai | o que foi escrito também sai | `e2e/professor-aplicacao.spec.ts › aplicar pede a escolha "é avaliativa?"…` (o 503 com o diálogo aberto, cancelar, abrir de novo: sem alerta, sem escolha, "Abre em" vazio) e, no componente, `apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › a falha do servidor fica no diálogo; fechar e abrir de novo limpa o erro e o que foi escrito` |
| Roteiro | e2e | o passo de aplicar como avaliativa com a janela | o resumo da prova aparece antes de confirmar | `e2e/roteiro-da-demonstracao.spec.ts` (o passo de aplicar como avaliativa, com `preencherAJanelaDaProva` e o resumo) e `e2e/classificacao-bncc.spec.ts` (a avaliativa pela tela contra a API real) |
| Rótulos e axe | e2e | sem violação | o diálogo de aplicar com os campos, o diálogo de mudar a janela e o painel | `seriousViolations` em `e2e/professor-aplicacao.spec.ts` (nos dois casos) e em `e2e/professor-turma-atividades.spec.ts › a prova que ninguém começou muda a janela pelo painel, com o resumo antes e um pedido só` e `… › com alguém começado, o painel diz a prova e não oferece mudar a janela`; os rótulos pelo `getByLabel` de cada caso |

## Como testar

- `apps/web/src/areas/professor/atividades/AtividadesDaTurma.test.tsx` e o e2e `e2e/professor-turma-atividades.spec.ts`
- `paginaNaoRola` de `e2e/support/coordenacao.ts`
- `node tools/ci/e2e.ts --manter-ambiente e2e/professor-turma-atividades.spec.ts`
- **Telas:** professora · `/professor/turmas/…` (a turma aberta) · `text=Atividades` → "Aplicar à turma" → "É avaliativa"

## Autoconferência

As perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas antes de codar e conferidas depois.

1. **A mutação de cada cláusula** está na seção "Mutações": um bloco por condição que o diff acrescenta (a conferência compartilhada, as contas do fuso e do resumo, a conferência do formulário e da mudança de janela, `canMudarAJanela` termo a termo, cada ramo da lista do tempo adicional, o que esconde ou mostra os campos, a trava do clique duplo, a falha do PATCH e a rota dele). O que não tem bloco tem o motivo em prosa na mesma seção (termo equivalente ou só de tipo). Os blocos de JSX com operando (`&& (`) removem o elemento inteiro, e não só o primeiro termo.
2. **O texto na tela:** procurei `Aplicar à turma` em `e2e/` (`professor-aplicacao`, `professor-turma-atividades`, `roteiro-da-demonstracao`, `classificacao-bncc`, `a3-a4-professor`, `aluno-fluxo`, `professor-semana-itens` e o apoio `atividade-db`/`assistente`): os que escolhem "É avaliativa" preenchem a janela (`preencherAJanelaDaProva`) e os que aplicam por API mandam a janela (`atividade-db.aplicar`); a prática segue como era. Nenhum texto antigo saiu de `apps/web/src`.
3. **O segundo dado de cada cláusula:** a conferência da janela tem o texto vazio, o fim igual à abertura, o fim antes e o horário que não existe (o dia 30 de fevereiro e o que pula na virada do horário de verão); a duração tem 4, 5, 300, 301, a vírgula e o texto; o tempo adicional tem 50 min com 40 e +50% (não cabe) e 60 min (cabe), e 30 min com +100% (muda os números da frase); a ordem dos alunos tem dois com o mesmo nome e um nome que vem depois com id menor; o botão "Mudar janela" tem a aberta que ninguém começou e, uma de cada vez, a com alguém começado, a encerrada, a sem janela e a prática.
4. **A checagem anterior que responde antes:** no aplicar, a escolha "é avaliativa?" e a conferência do formulário respondem antes do envio (o caso diz o campo e confere que nenhum POST saiu); na API, a avaliativa sem janela é recusada pelo `aplicarAtividadeRequestSchema`, na entrada, antes da autorização (400 para qualquer id, sem confirmar que o artefato existe), e o caso usa a turma e o artefato certos. O PATCH da janela passa por `requireAnoEmCurso()` e pela matriz: o caso da avaliativa antiga usa o professor da turma.
5. **A asserção olha o resultado:** os casos da tela leem o corpo do `POST`/`PATCH` que saiu (`corposEnviados`), o texto do resumo e o erro ligado ao campo (`aria-describedby`); os da API leem a aplicação e a auditoria no banco. Nenhum olha o texto do código.
6. **Guarda nova:** nenhuma regra de lint nem teste estrutural novo. A catraca do lint (`eslint-suppressions.json`) não ganhou entrada nem a tarefa a aumentou: `AplicacaoDoArtefato.tsx` e `AtividadesDaTurma.tsx` ficaram nas supressões que já tinham.
7. **Comentário que afirma o que o código não faz:** o docblock de `MudarJanela` diz que o pedido sai uma vez só (provado pelos dois cliques no mesmo `act` do componente e pelo `dblclick` do e2e) e que o tempo adicional já marcado "fica como está" (o PATCH só manda a janela e a duração, provado pelo corpo exato do caso `a prova sem duração…`); o de `TempoAdicionalPorAluno` diz que não há campo de motivo (provado pelo `queryAllByRole('textbox')` vazio e pelo `locator('textarea, input[type=\"text\"]')` do e2e). O `docs/interface.md` (§1.7) e o roteiro da demonstração (passo 220) dizem o que a tela faz agora.
8. **Divergências:** as duas da tabela acima, na `techspec.md` §3 e no `cenarios.md` §1; nenhuma muda regra do PRD. Arquivos fora de "Arquivos previstos": `AtividadesDaTurma.tsx`, `api/atividades.ts`, `prova-online.ts` e `prova-online.test.ts` (a tela precisa de uma peça de contas sem tela e de um lugar no painel para o "Mudar janela"), e `atividade-aplicada.service.ts` ficou de fora porque a recusa vem da conferência compartilhada que ele já chamava.
9. **Peça que já existe:** `FormField`, `OptionCard`, `Select`, `ConfirmDialog`, `LoadingState`, `errorText`, `formatQuantity` e `alunosDaTurmaQueryOptions` (a lista de alunos da aba Alunos, lida de cem em cem); `atividadesAplicadasQueryOptions` e `recarregarAtividades` para reler a lista; `camposInvalidosDaProva` e `PERCENTUAIS_DE_TEMPO_ADICIONAL` do `packages/shared`. Nada de peça nova em `components/ui`.
10. **A operação em duas chamadas ao mesmo tempo:** o clique duplo em "Aplicar à turma" e em "Mudar a janela" manda um pedido só (a trava `decidindo`; os dois cliques no mesmo ato nos casos de unidade de cada um e o `dblclick` do e2e); a corrida entre mudar a janela e alguém começar é da 1.0 (a trava no banco), e a tela só relê a lista e tira o botão.
11. **O isolamento quebra sem a cláusula:** a tarefa não cria consulta nem tabela; a lista de alunos do tempo adicional é a `GET /v1/turmas/:id/alunos`, que já tem o isolamento e a autorização por turma da aba Alunos, e a aplicação da avaliativa continua presa à turma do professor (caso da 1.0).
12. **Os guardiões:** `privacy-guardian` (o tempo adicional é só o percentual, sem motivo; o resumo e o painel dizem **quantos** têm, nunca quais; nenhum nome de aluno vai a log nem à auditoria) e `frontend-reviewer` (os quatro estados, 360 px sem rolar de lado, alvos de 24 px e 44 px no Confirmar, rótulo e erro em cada campo, `ConfirmDialog` com o resumo antes de gravar, o horário da escola).

## Fora do escopo desta tarefa

O painel "Acompanhar" (11.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec |
|---|---|---|
| A exigência da janela mora na conferência compartilhada (`camposInvalidosDaProva`), e não no `atividade-aplicada.service.ts` | O service já chamava a conferência no aplicar, no PATCH e na segunda chamada; o `if (prova.janela === undefined)` entrou lá, e as três escritas passam a recusar a avaliativa sem janela com o mesmo código, sem cópia da regra. O service e o repository não mudaram | `techspec.md` §3 ("A **API exige janela** na avaliativa nova") e §4 (a conferência única); divergência 1 da 1.0 ("A exigência entra na 10.0, com a tela") |
| O PATCH da janela numa avaliativa de antes da F6 (sem janela) só passa se trouxer a janela | A prova que sairia da mudança precisa ser válida, e a conferência é a mesma do aplicar. `{ tempoAdicional: [] }` num caso sem janela era um no-op que respondia 200 e deixa de responder; a tela não o faz (o botão "Mudar janela" só existe com janela), e dar janela a uma avaliativa antiga continua possível pelo PATCH | `techspec.md` §3 ("a antiga segue como hoje, sem backfill": ela segue **lida** como estava; a escrita nova nela pede a janela); o caso `a avaliativa de antes da F6, aberta e sem janela, ganha a janela pelo PATCH` |

## Mutações

--faltando: nenhuma linha nova de produção com condição fica sem bloco (`node tools/processo/mutacoes.ts --faltando` confere): 72 blocos e os motivos abaixo.

Cada bloco aplica a mutação, roda o caso citado e exige vermelho. Os blocos do contrato (`atividade-aplicada.ts`) têm dois testes: o da conferência única, na unidade, e o da API (`ENTRADA_INVALIDA` com nada gravado), na integração: o service não mudou, porque a recusa vem da conferência que ele já chamava (`camposInvalidosDaProva`).

**Sem bloco, com o motivo (cláusula equivalente ou sem como chegar nela):**

- `artefato.conteudo.tipo === 'atividade_objetiva'` (condição da linha das questões do resumo; a linha tem bloco, que troca o valor inteiro por `—`): a linha já existia no diálogo de aplicar (a mesma, só mudou de lugar para `resumoDaAplicacao`); o ramo `—` é do tipo que a tela não oferece aplicar (`canAplicar` só aceita a atividade objetiva), e o resumo com as questões é provado nos casos do resumo.
- `conferida.pedido !== undefined` (segundo termo do `aplicar.mutate`): a linha de cima já devolve quando a avaliativa não tem pedido; é o estreitamento de tipo que deixa espalhar `conferida.pedido`. O primeiro termo (`escolhida.avaliativa`) tem bloco.
- `aplicada.comTempoAdicional ?? 0` (no `MudarJanela`): o campo é opcional no contrato e a API sempre o devolve; sem o `?? 0` o `undefined > 0` dá falso, o mesmo que o zero. O número só decide o texto da falha e a contagem do resumo, e os dois casos com e sem tempo adicional têm bloco.
- `falha === undefined ? {} : { falha }` (no `ConfirmDialog` do `MudarJanela`): passar `falha: undefined` e não passar são o mesmo para o diálogo; o ternário existe por causa de `exactOptionalPropertyTypes`, e a falha com texto tem blocos nos dois ramos do `errorText`.
- `aplicada.avaliativa` (primeiro termo de `canMudarAJanela`): o banco recusa janela fora da avaliativa (`atividade_aplicada_prova_so_na_avaliativa`, da 1.0), então `janela != null` já implica avaliativa, e nenhum dado deixa o termo sozinho decidir; ele fica por clareza de quem lê. Os outros três termos têm bloco.
- `?? 0` da escolha do aluno no seletor (`valor[aluno.usuarioId] ?? 0`): sem ele o valor do seletor é o texto `undefined`, que não casa com nenhuma opção, e o navegador mostra a primeira, a mesma "Sem tempo adicional"; a linha tem bloco que troca o valor por `0` fixo (o seletor deixa de refletir a escolha).
- `canMudarAJanela(aplicada)` (primeiro termo do `&&` que desenha o botão "Mudar janela"): o conferidor não casa um termo com parênteses pelo bloco; o bloco que o troca por `true &&` existe (o botão apareceria em toda atividade, e o caso do botão fica vermelho), e os quatro termos de dentro da função têm um bloco cada.
- `valor = (tipo: Intl.DateTimeFormatPartTypes): number => Number(formatador.formatToParts(instante).find((parte) => parte.type === tipo)?.value ?? Number.NaN)` e o seu `?? Number.NaN`: a parte pedida sempre existe no formato `en-CA` com `year`, `month`, `day`, `hour` e `minute`; o `NaN` só entra para o tipo fechar.
- `Number.isNaN(lido.getTime())` (citada como contexto do bloco da hora que não existe): com o texto já casado pelo `HORARIO_LOCAL` (campos de dois e quatro dígitos), `Date.UTC` nunca devolve data inválida; a defesa fica por causa do tipo.
- `volta.ano !== ano`, `volta.mes !== mes`, `volta.dia !== dia` e `volta.minuto !== minuto` (conferência de ida e volta do horário): todo estouro de campo (`02-30`, `13-01`, `T24:00`, `T10:75`) muda ao mesmo tempo outros dois campos (o mês e o dia, ou a hora e o dia), então cada um desses termos é coberto pelos irmãos; só a hora tem caso que a isola (o horário que pula na virada do horário de verão), e o termo `volta.hora !== hora` tem bloco.
- `fechaEm === undefined` (segundo termo do retorno antecipado de `conferirOsHorarios`): os erros dos dois horários já foram escritos nas duas linhas de cima, e quem chama (`conferirAJanela`) olha os erros antes da janela; sem o termo a janela sai com a ponta `undefined` e ninguém a lê.
- `horarios.janela === undefined` e `janela === undefined` (segundos termos dos retornos de `conferirAJanela` e de `conferirAProva`): sem erro nenhum a janela existe; os termos estreitam o tipo. O primeiro termo de cada um tem bloco.
- `duracaoMin !== undefined` (primeiro termo da conferência do tempo que não cabe): com duração vazia o tempo adicional já saiu como erro uma linha acima, e sem tempo adicional a conferência compartilhada não recusa a prova; tirar o termo não muda nenhum retorno. O segundo termo tem bloco.

```mutacao
arquivo: packages/shared/src/atividade/atividade-aplicada.ts
teste: packages/shared/src/atividade/prova-online.test.ts › a conferência única diz o campo
-if (prova.janela === undefined) campos.push('janela')
 if (prova.duracaoMin !== undefined && prova.janela === undefined) campos.push('duracaoMin')
```

```mutacao
arquivo: packages/shared/src/atividade/atividade-aplicada.ts
teste: apps/api/src/atividade/prova-online.int.test.ts › a avaliativa nova sem janela é ENTRADA_INVALIDA
-if (prova.janela === undefined) campos.push('janela')
 if (prova.duracaoMin !== undefined && prova.janela === undefined) campos.push('duracaoMin')
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › o que não é horário
 const partes = HORARIO_LOCAL.exec(texto)
-if (partes === null) return undefined
 const [ano, mes, dia, hora, minuto] = partes.slice(1).map(Number) as [number, number, number, number, number]
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › o que não é horário
-const HORARIO_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
+const HORARIO_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › o que não é horário
-const HORARIO_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
+const HORARIO_LOCAL = /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › o fim em outro dia leva o dia
-if (duracaoMin !== undefined) partes.push(`${String(duracaoMin)} min`)
+partes.push(`${String(duracaoMin)} min`)
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › o fim em outro dia leva o dia
-if (comTempoAdicional > 0) partes.push(`${formatQuantity(comTempoAdicional, 'aluno', 'alunos')} com tempo adicional`)
+partes.push(`${formatQuantity(comTempoAdicional, 'aluno', 'alunos')} com tempo adicional`)
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › sem nada escrito
 const erros: { abre?: string; fecha?: string } = {}
-if (abreEm === undefined) erros.abre = TEXTO_DO_ABRE_VAZIO
 if (fechaEm === undefined) erros.fecha = TEXTO_DO_FECHA_VAZIO
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › sem nada escrito
 if (abreEm === undefined) erros.abre = TEXTO_DO_ABRE_VAZIO
-if (fechaEm === undefined) erros.fecha = TEXTO_DO_FECHA_VAZIO
 if (abreEm === undefined || fechaEm === undefined) return { erros }
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › o fim antes da abertura
-if (Date.parse(fechaEm) <= Date.parse(abreEm)) return { erros: { fecha: TEXTO_DO_FECHA_ANTES_DE_ABRIR } }
 return { erros, janela: { abreEm, fechaEm } }
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › o fim antes da abertura
-if (Date.parse(fechaEm) <= Date.parse(abreEm)) return { erros: { fecha: TEXTO_DO_FECHA_ANTES_DE_ABRIR } }
+if (Date.parse(fechaEm) < Date.parse(abreEm)) return { erros: { fecha: TEXTO_DO_FECHA_ANTES_DE_ABRIR } }
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › a duração vale de 5 a 300
-if (texto.trim() === '') return {}
 const duracao = Number(texto)
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › a duração vale de 5 a 300
-if (!Number.isInteger(duracao) || duracao < DURACAO_MINIMA_DA_PROVA_MIN || duracao > DURACAO_MAXIMA_DA_PROVA_MIN) return { erro: TEXTO_DA_DURACAO_FORA }
+if (duracao < DURACAO_MINIMA_DA_PROVA_MIN || duracao > DURACAO_MAXIMA_DA_PROVA_MIN) return { erro: TEXTO_DA_DURACAO_FORA }
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › a duração vale de 5 a 300
-if (!Number.isInteger(duracao) || duracao < DURACAO_MINIMA_DA_PROVA_MIN || duracao > DURACAO_MAXIMA_DA_PROVA_MIN) return { erro: TEXTO_DA_DURACAO_FORA }
+if (!Number.isInteger(duracao) || duracao > DURACAO_MAXIMA_DA_PROVA_MIN) return { erro: TEXTO_DA_DURACAO_FORA }
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › a duração vale de 5 a 300
-if (!Number.isInteger(duracao) || duracao < DURACAO_MINIMA_DA_PROVA_MIN || duracao > DURACAO_MAXIMA_DA_PROVA_MIN) return { erro: TEXTO_DA_DURACAO_FORA }
+if (!Number.isInteger(duracao) || duracao < DURACAO_MINIMA_DA_PROVA_MIN) return { erro: TEXTO_DA_DURACAO_FORA }
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › sem horário escrito, ou com a duração fora
-const erros: ErrosDaProva = { ...horarios.erros, ...(duracao.erro === undefined ? {} : { duracao: duracao.erro }) }
+const erros: ErrosDaProva = { ...horarios.erros }
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › sem horário escrito, ou com a duração fora
-if (Object.keys(erros).length > 0 || horarios.janela === undefined) return { erros }
+if (horarios.janela === undefined) return { erros }
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › sem horário escrito, ou com a duração fora
-return { erros, janela: horarios.janela, ...(duracao.duracaoMin === undefined ? {} : { duracaoMin: duracao.duracaoMin }) }
+return { erros, janela: horarios.janela, duracaoMin: duracao.duracaoMin }
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › a prova que já tem duração não a deixa vazia
-if (tinhaDuracao && campos.duracao.trim() === '') return { erros: { ...conferida.erros, duracao: TEXTO_DA_DURACAO_OBRIGATORIA } }
+if (campos.duracao.trim() === '') return { erros: { ...conferida.erros, duracao: TEXTO_DA_DURACAO_OBRIGATORIA } }
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › confere o horário e a duração como o aplicar
-if (tinhaDuracao && campos.duracao.trim() === '') return { erros: { ...conferida.erros, duracao: TEXTO_DA_DURACAO_OBRIGATORIA } }
+if (tinhaDuracao) return { erros: { ...conferida.erros, duracao: TEXTO_DA_DURACAO_OBRIGATORIA } }
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › sem horário escrito, ou com a duração fora
-if (conferida.janela === undefined) return { erros: conferida.erros }
 return { erros: conferida.erros, pedido: { janela: conferida.janela, ...(conferida.duracaoMin === undefined ? {} : { duracaoMin: conferida.duracaoMin }) } }
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › a prova que já tem duração não a deixa vazia
-return { erros: conferida.erros, pedido: { janela: conferida.janela, ...(conferida.duracaoMin === undefined ? {} : { duracaoMin: conferida.duracaoMin }) } }
+return { erros: conferida.erros, pedido: { janela: conferida.janela, duracaoMin: conferida.duracaoMin } }
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › o formulário da prova conferido antes de enviar
-if (tempoAdicional.length > 0 && formulario.duracao.trim() === '') erros.tempoAdicional = TEXTO_DO_TEMPO_ADICIONAL_SEM_DURACAO
+if (formulario.duracao.trim() === '') erros.tempoAdicional = TEXTO_DO_TEMPO_ADICIONAL_SEM_DURACAO
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › o formulário da prova conferido antes de enviar
-if (tempoAdicional.length > 0 && formulario.duracao.trim() === '') erros.tempoAdicional = TEXTO_DO_TEMPO_ADICIONAL_SEM_DURACAO
+if (tempoAdicional.length > 0) erros.tempoAdicional = TEXTO_DO_TEMPO_ADICIONAL_SEM_DURACAO
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › tempo adicional sem duração é erro
-if (Object.keys(erros).length > 0 || janela === undefined) return { erros }
+if (janela === undefined) return { erros }
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › o formulário da prova conferido antes de enviar
-if (duracaoMin !== undefined && camposInvalidosDaProva(prova).length > 0) {
+if (duracaoMin !== undefined) {
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › a prática não tem campo de prova
-<div role="group" aria-labelledby={idDoTitulo} {...(erro === undefined ? {} : { 'aria-describedby': idDoErro })} className="flex min-w-0 flex-col gap-2">
+<div role="group" aria-labelledby={idDoTitulo} {...{ 'aria-describedby': idDoErro }} className="flex min-w-0 flex-col gap-2">
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › a prática não tem campo de prova
-{erro !== undefined && (
+{(
 <p id={idDoErro} className="text-sm font-bold break-words text-vermelho-texto">
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › tempo adicional sem duração é erro do campo
-{erro !== undefined && (
-<p id={idDoErro} className="text-sm font-bold break-words text-vermelho-texto">
-{erro}
-</p>
-)}
+{erro !== undefined && null}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › a lista vai em ordem de nome
-const lidos = (alunos.data?.pages.flatMap((pagina) => pagina.itens) ?? []).sort(ordemDeNome)
+const lidos = (alunos.data?.pages.flatMap((pagina) => pagina.itens) ?? []).sort((a, b) => a.usuarioId.localeCompare(b.usuarioId))
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › a lista vai em ordem de nome
-const lidos = (alunos.data?.pages.flatMap((pagina) => pagina.itens) ?? []).sort(ordemDeNome)
+const lidos = (alunos.data?.pages.flatMap((pagina) => pagina.itens) ?? []).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › o aluno que perdeu o tempo adicional
-aoMudar(percentual === undefined ? resto : { ...resto, [alunoId]: percentual })
+aoMudar({ ...resto, [alunoId]: percentual })
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › carregando: a lista diz que lê os alunos
-if (alunos.isPending) return <LoadingState rotulo="Carregando os alunos da turma…" />
 if (alunos.isError) {
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › erro: diz a falha em português
-if (alunos.isError) {
+if (false as boolean) {
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › vazio: a turma sem alunos
-if (lidos.length === 0) return <p className="text-sm text-sutil">Esta turma ainda não tem alunos.</p>
 return (
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › a lista vai em ordem de nome
-<Select rotulo={aluno.nome} opcoes={OPCOES_DE_TEMPO_ADICIONAL} valor={String(valor[aluno.usuarioId] ?? 0)} aoMudar={(texto) => escolher(aluno.usuarioId, texto)} desligada={desligado} />
+<Select rotulo={aluno.nome} opcoes={OPCOES_DE_TEMPO_ADICIONAL} valor="0" aoMudar={(texto) => escolher(aluno.usuarioId, texto)} desligada={desligado} />
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › com dado e mais páginas
-{alunos.hasNextPage && (
+{(
 <Button variante="secundario" disabled={alunos.isFetchingNextPage} onClick={() => void alunos.fetchNextPage()}>
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › com dado e mais páginas
-{alunos.hasNextPage && (
-<Button variante="secundario" disabled={alunos.isFetchingNextPage} onClick={() => void alunos.fetchNextPage()}>
-{alunos.isFetchingNextPage ? 'Carregando…' : 'Ver mais alunos'}
-</Button>
-)}
+{alunos.hasNextPage && null}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › fica desligado enquanto lê
-<Button variante="secundario" disabled={alunos.isFetchingNextPage} onClick={() => void alunos.fetchNextPage()}>
+<Button variante="secundario" onClick={() => void alunos.fetchNextPage()}>
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › fica desligado enquanto lê
-{alunos.isFetchingNextPage ? 'Carregando…' : 'Ver mais alunos'}
+{'Ver mais alunos'}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › a prática sai como sempre saiu
-if (prova !== undefined) resumo.push({ rotulo: 'Prova', valor: resumoDaProva({ turma, janela: prova.janela, duracaoMin: prova.duracaoMin, comTempoAdicional: prova.tempoAdicional.length }) })
+resumo.push({ rotulo: 'Prova', valor: resumoDaProva({ turma, janela: prova!.janela, duracaoMin: prova!.duracaoMin, comTempoAdicional: prova!.tempoAdicional.length }) })
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › o resumo diz a prova no horário da escola
-if (prova !== undefined) resumo.push({ rotulo: 'Prova', valor: resumoDaProva({ turma, janela: prova.janela, duracaoMin: prova.duracaoMin, comTempoAdicional: prova.tempoAdicional.length }) })
 return resumo
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › a prática sai como sempre saiu
-if (escolhida.avaliativa && conferida.pedido === undefined) return
+if (conferida.pedido === undefined) return
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › o resumo diz a prova no horário da escola
-if (escolhida.avaliativa && conferida.pedido === undefined) return
+if (escolhida.avaliativa) return
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › sem escrever nada, confirmar mostra o erro
-if (escolhida.avaliativa && conferida.pedido === undefined) return
 decidindo.current = true
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › quem preencheu a prova e voltou
-aplicar.mutate(escolhida.avaliativa && conferida.pedido !== undefined ? { avaliativa: true, ...conferida.pedido } : { avaliativa: false })
+aplicar.mutate(conferida.pedido !== undefined ? { avaliativa: true, ...conferida.pedido } : { avaliativa: false })
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › quem preencheu a prova e voltou
-resumo={resumoDaAplicacao(artefato, turma, ehAvaliativa ? conferida.pedido : undefined)}
+resumo={resumoDaAplicacao(artefato, turma, conferida.pedido)}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › a prática não tem campo de prova
-{ehAvaliativa && <CamposDaProva turmaId={artefato.turmaId} formulario={formulario} aoMudar={definirFormulario} erros={tentou ? conferida.erros : {}} desligados={aplicar.isPending} />}
+{<CamposDaProva turmaId={artefato.turmaId} formulario={formulario} aoMudar={definirFormulario} erros={tentou ? conferida.erros : {}} desligados={aplicar.isPending} />}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › a prática não tem campo de prova
-{ehAvaliativa && <CamposDaProva turmaId={artefato.turmaId} formulario={formulario} aoMudar={definirFormulario} erros={tentou ? conferida.erros : {}} desligados={aplicar.isPending} />}
+{ehAvaliativa && null}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › sem escrever nada, confirmar mostra o erro
-{ehAvaliativa && <CamposDaProva turmaId={artefato.turmaId} formulario={formulario} aoMudar={definirFormulario} erros={tentou ? conferida.erros : {}} desligados={aplicar.isPending} />}
+{ehAvaliativa && <CamposDaProva turmaId={artefato.turmaId} formulario={formulario} aoMudar={definirFormulario} erros={conferida.erros} desligados={aplicar.isPending} />}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AtividadesDaTurma.tsx
teste: apps/web/src/areas/professor/atividades/AtividadesDaTurma.test.tsx › a prova aparece no painel em uma frase
-if (aplicada.janela == null) return null
 return (
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AtividadesDaTurma.tsx
teste: apps/web/src/areas/professor/atividades/AtividadesDaTurma.test.tsx › a prova aparece no painel em uma frase
-{resumoDaProva({ turma: nomeDaTurma, janela: aplicada.janela, duracaoMin: aplicada.duracaoMin ?? undefined, comTempoAdicional: aplicada.comTempoAdicional ?? 0 })}
+{resumoDaProva({ turma: nomeDaTurma, janela: aplicada.janela, duracaoMin: aplicada.duracaoMin as number | undefined, comTempoAdicional: aplicada.comTempoAdicional ?? 0 })}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › dois cliques no mesmo instante em "Aplicar à turma" mandam um pedido só
 const escolhida = ESCOLHA_DE_AVALIATIVA.find((opcao) => opcao.valor === escolha)
-if (escolhida === undefined || decidindo.current) return
+if (escolhida === undefined) return
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/MudarJanela.tsx
teste: apps/web/src/areas/professor/atividades/AtividadesDaTurma.test.tsx › se alguém começou entre abrir o painel e confirmar
-onError: () => recarregarAtividades(cliente),
+onError: () => undefined,
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/MudarJanela.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › o botão existe na prova avaliativa aberta
-return aplicada.avaliativa && aplicada.estado === 'aberta' && aplicada.janela != null && aplicada.participacao.iniciaram === 0
+return aplicada.avaliativa && aplicada.janela != null && aplicada.participacao.iniciaram === 0
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/MudarJanela.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › o botão existe na prova avaliativa aberta
-return aplicada.avaliativa && aplicada.estado === 'aberta' && aplicada.janela != null && aplicada.participacao.iniciaram === 0
+return aplicada.avaliativa && aplicada.estado === 'aberta' && aplicada.participacao.iniciaram === 0
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/MudarJanela.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › o botão existe na prova avaliativa aberta
-return aplicada.avaliativa && aplicada.estado === 'aberta' && aplicada.janela != null && aplicada.participacao.iniciaram === 0
+return aplicada.avaliativa && aplicada.estado === 'aberta' && aplicada.janela != null
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/MudarJanela.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › o botão existe na prova avaliativa aberta
-abre: aplicada.janela == null ? '' : paredeDaEscolaDoInstante(aplicada.janela.abreEm),
+abre: paredeDaEscolaDoInstante(aplicada.janela!.abreEm),
 fecha: aplicada.janela == null ? '' : paredeDaEscolaDoInstante(aplicada.janela.fechaEm),
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/MudarJanela.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › o botão existe na prova avaliativa aberta
 abre: aplicada.janela == null ? '' : paredeDaEscolaDoInstante(aplicada.janela.abreEm),
-fecha: aplicada.janela == null ? '' : paredeDaEscolaDoInstante(aplicada.janela.fechaEm),
+fecha: paredeDaEscolaDoInstante(aplicada.janela!.fechaEm),
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/MudarJanela.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › a prova sem duração abre com o campo vazio
-duracao: aplicada.duracaoMin == null ? '' : String(aplicada.duracaoMin),
+duracao: String(aplicada.duracaoMin),
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/MudarJanela.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › a janela com o fim antes da abertura
-if (pedido === undefined || decidindo.current) return
+if (decidindo.current) return
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/MudarJanela.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › abre com a janela de agora no horário da escola
-if (pedido === undefined || decidindo.current) return
+if (pedido === undefined) return
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/MudarJanela.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › abre com a janela de agora no horário da escola
-if (pedido !== undefined) resumo.push({ rotulo: 'Janela nova', valor: resumoDaProva({ turma: nomeDaTurma, janela: pedido.janela, duracaoMin: pedido.duracaoMin, comTempoAdicional }) })
 // A janela que não comporta
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/MudarJanela.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › a janela nova que o tempo adicional já marcado
-const falha = mudar.isError ? errorText(mudar.error, comTempoAdicional > 0 ? { [ErrorCode.ENTRADA_INVALIDA]: TEXTO_DO_TEMPO_ADICIONAL_JA_MARCADO } : {}) : undefined
+const falha = mudar.isError ? errorText(mudar.error, { [ErrorCode.ENTRADA_INVALIDA]: TEXTO_DO_TEMPO_ADICIONAL_JA_MARCADO }) : undefined
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/MudarJanela.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › a janela nova que o tempo adicional já marcado
-const falha = mudar.isError ? errorText(mudar.error, comTempoAdicional > 0 ? { [ErrorCode.ENTRADA_INVALIDA]: TEXTO_DO_TEMPO_ADICIONAL_JA_MARCADO } : {}) : undefined
+const falha = mudar.isError ? errorText(mudar.error, {}) : undefined
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/MudarJanela.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › abre com a janela de agora no horário da escola
-const falha = mudar.isError ? errorText(mudar.error, comTempoAdicional > 0 ? { [ErrorCode.ENTRADA_INVALIDA]: TEXTO_DO_TEMPO_ADICIONAL_JA_MARCADO } : {}) : undefined
+const falha = errorText(mudar.error, comTempoAdicional > 0 ? { [ErrorCode.ENTRADA_INVALIDA]: TEXTO_DO_TEMPO_ADICIONAL_JA_MARCADO } : {})
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/MudarJanela.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › o botão existe na prova avaliativa aberta
-{aberto && (
+{(
 <ConfirmDialog
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/MudarJanela.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › o erro de um campo só aparece depois de tentar confirmar
-<CamposDaJanela valor={campos} aoMudar={definirCampos} erros={tentou ? erros : {}} desligados={mudar.isPending} />
+<CamposDaJanela valor={campos} aoMudar={definirCampos} erros={erros} desligados={mudar.isPending} />
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/api/atividades.ts
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › abre com a janela de agora no horário da escola
-return authedRequest(`${CAMINHO}/${encodeURIComponent(id)}/janela`, atividadeAplicadaResponseSchema, { metodo: 'PATCH', corpo: pedido })
+return authedRequest(`${CAMINHO}/${encodeURIComponent(id)}/janelas`, atividadeAplicadaResponseSchema, { metodo: 'PATCH', corpo: pedido })
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/MudarJanela.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › o botão existe na prova avaliativa aberta
-{canMudarAJanela(aplicada) && (
+{true && (
 <Button variante="secundario" onClick={open}>
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › o formulário da prova conferido antes de enviar
-return { erros, pedido: { janela, ...(duracaoMin === undefined ? {} : { duracaoMin }), embaralhar: formulario.embaralhar, tempoAdicional } }
+return { erros, pedido: { janela, duracaoMin, embaralhar: formulario.embaralhar, tempoAdicional } as PedidoDaProva }
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/MudarJanela.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › abre com a janela de agora no horário da escola
-{aberto && (
-<ConfirmDialog
-titulo="Mudar a janela da prova"
-familia="oficial"
-resumo={resumo}
-efeito="Os alunos passam a começar a prova dentro da janela nova. Depois que o primeiro aluno começar, a janela não muda mais: só dá para estender o tempo."
-rotuloDeConfirmar="Mudar a janela"
-rotuloConfirmando="Mudando…"
-aoConfirmar={confirmar}
-aoFechar={() => definirAberto(false)}
-confirmando={mudar.isPending}
-focoDeReserva={focoDeReserva}
-{...(falha === undefined ? {} : { falha })}
->
-<CamposDaJanela valor={campos} aoMudar={definirCampos} erros={tentou ? erros : {}} desligados={mudar.isPending} />
-</ConfirmDialog>
-)}
+{aberto && null}
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › o resumo diz a prova no horário da escola
-{ rotulo: 'Questões', valor: artefato.conteudo.tipo === 'atividade_objetiva' ? String(artefato.conteudo.questoes.length) : '—' },
+{ rotulo: 'Questões', valor: '—' },
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/MudarJanela.tsx
teste: apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx › a janela nova que o tempo adicional já marcado
-const comTempoAdicional = aplicada.comTempoAdicional ?? 0
+const comTempoAdicional = 0
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › 10:00 em São Paulo é 13:00 em UTC
-const valor = (tipo: Intl.DateTimeFormatPartTypes): number => Number(formatador.formatToParts(instante).find((parte) => parte.type === tipo)?.value ?? Number.NaN)
+const valor = (tipo: Intl.DateTimeFormatPartTypes): number => Number(formatador.formatToParts(instante).find((parte) => parte.type === 'year')?.value ?? Number.NaN)
```

```mutacao
arquivo: apps/web/src/areas/professor/atividades/prova-online.ts
teste: apps/web/src/areas/professor/atividades/prova-online.test.ts › a hora que não existe na parede do fuso
 const lido = new Date(instante)
 if (Number.isNaN(lido.getTime())) return undefined
 const volta = partesNaParede(instante, fuso)
 // `2026-02-30T10:00` não existe: o instante achado volta como outro dia, e o horário é recusado.
-if (volta.ano !== ano || volta.mes !== mes || volta.dia !== dia || volta.hora !== hora || volta.minuto !== minuto) return undefined
+if (volta.ano !== ano || volta.mes !== mes || volta.dia !== dia || volta.minuto !== minuto) return undefined
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian (1ª) | Carregar os nomes da turma só quando o professor abrir "Marcar tempo adicional", e não ao marcar "É avaliativa" (`AplicacaoDoArtefato.tsx:810`) | `TODO.md`: muda o desenho do diálogo e o contrato dos casos que contam a lista carregada (o RF3 do `prd.md` pede marcar os alunos ao aplicar); o revisor diz que não bloqueia |
| privacy-guardian (1ª) | `docs/lgpd.md:60` diz "nunca em auditoria", e a auditoria guarda `comTempoAdicional` como contagem: escrever que a contagem é permitida | `TODO.md`: o documento não é da tarefa, e a contagem não é dado de aluno |
| frontend-reviewer (1ª), revisor-geral (1ª) | Rótulo "Tempo adicional de <nome>" e distinguir homônimos pela matrícula ou segundo nome na lista do tempo adicional | tarefa 11.0: o `cenarios.md` §4 já pede a distinção no Acompanhar; trocar o rótulo agora reescreve os `getByLabelText` de todos os casos da tarefa |
| frontend-reviewer (1ª) | Virtualizar ou filtrar por nome a lista de turma com mais de 100 alunos, se a medição no Chromebook com throttling mostrar lentidão | `TODO.md`: depende de medição; hoje a lista vem de cem em cem |
| frontend-reviewer (1ª) | Garantir que o botão "Estender" exista quando o texto de `PROVA_JA_COMECOU` o citar | tarefa 11.0 (11.1 entrega o Estender no painel) |
| frontend-reviewer (1ª) | Fotografar o diálogo "Mudar a janela da prova" | Validação da funcionalidade: a vitrine não tem prova avaliativa aberta que ninguém começou |
| conformidade-reviewer (1ª) | Escrever em `docs/regulacao.md` ou na AIA da correção de objetiva que aplicar conta como a aprovação da regra 70, item 3, para a atividade original | `TODO.md` (AIA da correção de objetiva): o revisor diz que é anterior à tarefa |
| infra-guardian (1ª) | Texto que peça para recarregar a página quando uma aba antiga recebe `ENTRADA_INVALIDA` no deploy, ou linha no `docs/runbook.md` | recusada: o deploy é fora do horário letivo (regra 80, item 9) e o revisor diz que não bloqueia |
| infra-guardian (1ª) | O fuso fixo `America/Sao_Paulo` em `prova-online.ts:21`: registrar antes de vender fora do recorte de Joinville | `TODO.md` |
| infra-guardian (1ª) | O cenário de carga da manhã com prova aberta (vários alunos começando e salvando) | tarefa 3.0, que mexe no lado do aluno |
| revisor-geral (1ª) | Juntar as três constantes `'America/Sao_Paulo'` e as funções `partesNaParede` e `diaEHora` com `FUSO_DA_ESCOLA` (`semana/semana.ts`, `envio-do-convite.ts`) e `partesDoInstante` (`format.ts`) | `TODO.md`: toca arquivos de fora da tarefa e os blocos de mutação de `prova-online.ts` |
| revisor-geral (1ª) | `MudarJanela.tsx:46`: tirar o estado inicial montado de `camposDaJanelaGravada` | recusada: sem efeito visível (`open()` refaz os campos a cada abertura) e o valor vazio equivalente não ganha nada |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-23 21:53:55 | 2026-11-23 21:54:23 | `tenancy-guardian` | 1 | APROVADO | ade06e0b36cbd1874 |
| 2026-11-23 21:53:27 | 2026-11-23 21:54:47 | `privacy-guardian` | 1 | APROVADO | a523c4b45301466cd |
| 2026-11-23 21:53:34 | 2026-11-23 21:54:48 | `frontend-reviewer` | 1 | APROVADO | ad00a82ad9c10325e |
| 2026-11-23 21:54:01 | 2026-11-23 21:54:55 | `conformidade-reviewer` | 1 | APROVADO | af6b3ae06a7eb60f6 |
| 2026-11-23 21:54:08 | 2026-11-23 21:55:18 | `infra-guardian` | 1 | APROVADO | a2f571af734935c6c |
| 2026-11-23 21:53:48 | 2026-11-23 21:56:06 | `revisor-geral` | 1 | APROVADO | a212078394b7a71ee |
| 2026-11-23 21:53:41 | 2026-11-23 21:56:30 | `test-engineer` | 1 | REPROVADO | aee3645e98328b3ee |
| 2026-11-23 22:23:35 | 2026-11-23 22:23:58 | `privacy-guardian` | 2 | APROVADO | a2c8f1ff12cd32d74 |
| 2026-11-23 22:24:13 | 2026-11-23 22:24:28 | `tenancy-guardian` | 2 | APROVADO | a3cfefa33e91b42a8 |
| 2026-11-23 22:23:44 | 2026-11-23 22:24:29 | `frontend-reviewer` | 2 | APROVADO | a274d1514704747c7 |
| 2026-11-23 22:24:04 | 2026-11-23 22:24:40 | `revisor-geral` | 2 | APROVADO | ab9a2368284fd3a6a |
| 2026-11-23 22:24:22 | 2026-11-23 22:24:45 | `conformidade-reviewer` | 2 | APROVADO | adba090c1a88892d1 |
| 2026-11-23 22:23:55 | 2026-11-23 22:24:48 | `test-engineer` | 2 | APROVADO | a5b91e248b6d69c02 |
| 2026-11-23 22:24:31 | 2026-11-23 22:24:57 | `infra-guardian` | 2 | APROVADO | a4400d70c2d6da43a |
