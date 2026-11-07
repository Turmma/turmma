# Tarefa 6.0 — Turmas ganha a aba Semana

**Funcionalidade:** semana-do-professor · **Depende de:** 2.0
**Subagentes obrigatórios:** `frontend-reviewer`, `privacy-guardian`, `test-engineer`
**Porte:** grande

## Objetivo

Em Turmas, a aba **Semana** mostra as aulas da professora na escola ativa, semana a semana, e um dia por vez no celular.

## Contexto necessário

- `techspec.md` seção 9; `cenarios.md` T1, T8 a T11, S14; `prd.md` RF1 a RF4, RF6, RF9, RF12
- `.claude/rules/50`; `docs/interface.md` 1.7 e 6
- `apps/web/src/components/ui/Tabs.tsx`; `Turma.tsx`: a aba no endereço com `replace` e a altura pelo `miolo-do-documento.ts`
- `docs/roteiro-da-demonstracao.md`: os passos que passam por **Turmas**

## Subtarefas

- [x] 6.1 — `Tabs` "Turmas · Semana" com `?ver=semana` (`replace`); a semana só é lida com a aba aberta
- [x] 6.2 — A semana da seção 9; o clique no cartão põe `?aula=` (o painel é da 7.0)
- [x] 6.3 — Os estados e os vazios do RF12
- [x] 6.4 — `docs/interface.md` 1.8 inteira, painel e itens incluídos; o roteiro conferido contra `e2e/roteiro-da-demonstracao.spec.ts`
- [x] 6.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/areas/professor/turmas/Turmas.tsx`, `apps/web/src/areas/professor/turmas/Turmas.test.tsx` | alterado |
| `apps/web/src/areas/professor/turmas/semana/Semana.tsx`, `apps/web/src/areas/professor/turmas/semana/DiaDaSemana.tsx`, `apps/web/src/areas/professor/turmas/semana/CartaoDaAula.tsx` | novo |
| `apps/web/src/areas/professor/turmas/semana/semana.ts`, `apps/web/src/areas/professor/turmas/semana/semana.test.ts` | novo |
| `apps/web/src/areas/professor/turmas/api/semana.ts` | novo |
| `e2e/professor-semana.spec.ts`, `e2e/support/professor/semana.ts` | novo |
| `docs/interface.md`, `docs/roteiro-da-demonstracao.md` | alterado (o roteiro, uma nota: Turmas abre na aba Turmas) |
| `apps/web/src/components/ui/fields/DaySelector.tsx`, `apps/web/src/components/ui/fields/DaySelector.test.tsx`, `apps/web/src/gallery/sections/fields.tsx` | novo, novo, alterado (divergência do seletor de dia: `.processo/ordens/divergencia-6.md`, opção A) |
| `apps/web/src/areas/professor/turmas/semana/Semana.test.tsx` | novo (a Semana em jsdom: colunas e dia por vez, estados, pontas do ano, filtro) |
| `apps/web/src/api/chaves-do-professor.ts` | alterado (`SEMANA_QUERY_KEY`) |
| `tasks/prd-semana-do-professor/techspec.md` | alterado (§9, reescrita pelo Arquiteto) |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| T1 | e2e | aulas de três turmas; navegação e endereço | e2e/professor-semana.spec.ts › e2e/professor-semana.spec.ts › T1: as aulas de três turmas aparecem cada uma com o nome acessível, e "Semana seguinte", "Hoje" e "Semana anterior" levam a semana ao endereço |
| a aba Turmas não chama `GET /v1/semana` | e2e | sob demanda | e2e/professor-semana.spec.ts › e2e/professor-semana.spec.ts › a aba Turmas não lê a semana; abrir a Semana lê, guarda ?ver=semana com replace e o Voltar sai de Turmas |
| `?ver=semana` com `replace` | e2e | histórico | o mesmo caso da linha acima (a leitura e o `replace` são duas asserções dele); `Turmas.test.tsx › as abas Turmas e Semana` |
| `?semana=` abre a semana; inválido ou fora do ano, a de hoje | e2e | endereço | e2e/professor-semana.spec.ts › e2e/professor-semana.spec.ts › ?semana= abre a semana pedida; data inválida e semana fora do ano abrem a de hoje |
| `?turma=` só aquela turma e disciplina; a que não é dela, vazio | e2e | filtro | e2e/professor-semana.spec.ts › e2e/professor-semana.spec.ts › ?turma= mostra só aquela turma e disciplina, e o endereço leva só ids e datas; ?turma= de uma turma que não é dela mostra o vazio, com "Ver todas as turmas" |
| o endereço leva só ids e datas | e2e | regra 50, item 7 | e2e/professor-semana.spec.ts › e2e/professor-semana.spec.ts › ?turma= mostra só aquela turma e disciplina, e o endereço leva só ids e datas |
| anterior desabilitada em `ano.inicio`, seguinte em `ano.fim` | e2e | presa ao ano | e2e/professor-semana.spec.ts › e2e/professor-semana.spec.ts › a navegação é presa ao ano: "Semana anterior" desligada na semana do começo, "Semana seguinte" na do fim; chegar à ponta do ano pelo botão leva o foco ao título da semana, e não o perde |
| cartão com nome acessível "Terça, 7h30, 7ºA, Matemática" | e2e | acessibilidade | e2e/professor-semana.spec.ts › e2e/professor-semana.spec.ts › T1 (o nome acessível de cada cartão) |
| texto do cartão em duas linhas | e2e | line-clamp | e2e/professor-semana.spec.ts › e2e/professor-semana.spec.ts › o texto do cartão ocupa duas linhas, não mais |
| S14 e T11: "Falta preencher" por aula, token neutro, sem total | unidade e e2e | D59, D64 | e2e/professor-semana.spec.ts › S14 e T11: "Falta preencher" é por aula, num selo neutro, sem total; a aula com texto e a passada sem texto não o levam; semana.test.ts › S14 e T11 |
| fora da grade, com marca | e2e | RF14 | e2e/professor-semana.spec.ts › e2e/professor-semana.spec.ts › RF14: a aula escrita que saiu da grade aparece com a marca "Fora da grade" |
| feriado e recesso com tipo e descrição; evento junto das aulas | e2e | RF3 | e2e/professor-semana.spec.ts › e2e/professor-semana.spec.ts › RF3: feriado e recesso mostram o tipo e a descrição e tiram as aulas do dia; o evento aparece junto das aulas |
| fim de semana só com aula | e2e | RF1 | e2e/professor-semana.spec.ts › e2e/professor-semana.spec.ts › RF1: o fim de semana só aparece quando tem aula |
| T8, com o vazio e o aviso só depois da leitura | e2e | quatro estados | e2e/professor-semana.spec.ts › e2e/professor-semana.spec.ts › T8: carregando não mostra vazio nem aviso; depois da leitura, o vazio diz por quê; o aviso do calendário aparece com a grade importada e sem calendário, junto das aulas |
| depois de "Tentar de novo", o foco tem lugar | e2e | foco | e2e/professor-semana.spec.ts › e2e/professor-semana.spec.ts › recomeço: a falha seguida de sucesso não deixa erro na tela, e o foco vai ao título da semana |
| T9: um dia por vez, dia inicial, 360 px sem rolagem | e2e (`celular`) | D51 | e2e/professor-semana.spec.ts › e2e/professor-semana.spec.ts › T9: o celular mostra um dia por vez, abrindo em hoje, sem rolagem de lado; o computador mostra as colunas |
| alvos de 24 × 24, e 44 × 44 na ação principal | e2e (`celular`) | regra 50, 2a | e2e/professor-semana.spec.ts › e2e/professor-semana.spec.ts › os alvos de toque: 24 × 24 nos botões da barra e nos dias, 44 × 44 no cartão, a ação principal |
| T10: 40 aulas no `chromebook`; `soOPainelDaAbaRola` e `paginaNaoRola` a 1366 × 768 | e2e | RF22 | e2e/professor-semana.spec.ts › e2e/professor-semana.spec.ts › T10: 45 aulas num Chromebook: a página fica parada a 1366 × 768 e só o painel da aba rola |
| axe sem violação com dado e no vazio | e2e | acessibilidade | e2e/professor-semana.spec.ts › e2e/professor-semana.spec.ts › axe: sem violação grave com dado e no vazio |
| recomeço: segunda professora na mesma aba | e2e | P30 | e2e/professor-semana.spec.ts › e2e/professor-semana.spec.ts › P30: a segunda professora na mesma aba não vê a semana da primeira |
| recomeço: o mesmo endereço colado de novo | e2e | mesma entrada | e2e/professor-semana.spec.ts › e2e/professor-semana.spec.ts › o mesmo endereço colado de novo abre a mesma entrada: as mesmas aulas, uma leitura só, sem laço |
| recomeço: semana A segurada (`page.route`), B não é substituída | e2e | `queryKey` | e2e/professor-semana.spec.ts › e2e/professor-semana.spec.ts › a semana A segurada no ar não substitui a B, que a professora já abriu |
| recomeço: falha seguida de sucesso não deixa erro nem foco preso | e2e | falha | e2e/professor-semana.spec.ts › e2e/professor-semana.spec.ts › recomeço: a falha seguida de sucesso não deixa erro na tela, e o foco vai ao título da semana |
| RF9: troca de escola, nada da primeira | e2e | P30 | e2e/professor-semana.spec.ts › e2e/professor-semana.spec.ts › RF9, P30: trocar de escola com a Semana aberta não deixa nada da primeira escola na tela da segunda |

## Como testar

- 360 px, toque, axe: `e2e/professor-turmas.spec.ts › a contestação abre num painel…` (`horizontalOverflow`, `seriousViolations`)
- Aba no endereço: `e2e/professor-turma-aberta.spec.ts › trocar de aba guarda a aba no endereço e não empilha histórico…`
- Altura: `e2e/professor-turma-aberta.spec.ts › Hoje mantém a página parada a 1366 × 768…`
- Troca de escola: `e2e/escola-e-vinculos.spec.ts › isolamento: trocar de escola pelo seletor não leva a turma da escola anterior…`
- Resposta segurada: `e2e/acesso-da-turma.spec.ts:924`
- Dados: `criarAlocacaoDoProfessor`, `confirmarVinculosNoBanco`, `criarEventoDoCalendarioNoBanco` (`e2e/support/seed.ts`), em `e2e/support/professor/semana.ts`; relógio com `page.clock`
- Entrada: `entrarPelaApiSemMedirAPrimeiraCarga` (`e2e/support/casca.ts:233`)
- Comando: `node tools/ci/e2e.ts --manter-ambiente e2e/professor-semana.spec.ts`
- Telas: `professora`, `/professor/turmas?ver=semana`

## Autoconferência

As 12 perguntas do modelo, respondidas antes de codar.

1. **Mutação de cada cláusula:** os blocos de "Mutações" (104), um por cláusula: a aba e o `replace`, a guarda da Semana só montar com a aba
   aberta (`aba === 'semana'` em `Turmas.tsx`, que é o que faz a leitura só começar com ela), cada termo de `semanaToca`/
   `haSemanaAnterior`/`haSemanaSeguinte`, o filtro (`valorDoFiltro`), a escolha do dia inicial, o vazio de cada razão, o `Falta preencher`
   por aula, o foco devolvido nas pontas, a guarda do `DaySelector`. **Sem bloco, e dito:** a `queryKey` `['semana', segunda]`
   (`areas/professor/turmas/api/semana.ts`): não há `enabled` na consulta (a leitura só começa porque a Semana só monta com a aba aberta), e a
   chave não tem bloco; quem a protege são os casos de navegação do e2e (a semana A segurada que não substitui a B, "Semana seguinte",
   `?semana=`) e, entre pessoas e escolas, o P30 e o RF9. As 16 linhas que o `--faltando` lista e nenhum bloco alcança levam o motivo
   (reindentadas, guarda de tipo, `noUncheckedIndexedAccess`).
2. **O texto já aparece em `e2e/`?** `grep -rln "Semana" e2e/`: só o spec novo. "Turmas" aparece em vários, mas a aba "Turmas" mantém o
   rótulo e a lista; os specs de Turmas e o roteiro rodam isolados (passo "Roteiro" abaixo).
3. **Segundo dado:** a grade tem três turmas em dias diferentes (o filtro `?turma=` esconde as outras duas), uma segunda professora (P30), uma
   segunda escola (RF9), um ano que termina na semana seguinte (a ponta), um feriado e um evento no mesmo dia.
4. **Checagem anterior que responde antes:** a Semana só monta com `ver=semana`, e a leitura só começa com a aba aberta; o caso da aba
   Turmas conta as chamadas a `/v1/semana`. A leitura exige ano em curso: o caso do ano `null` chega nela (vazio "sem ano").
5. **Resultado, não forma:** os casos olham nome acessível, texto visível, endereço e `aria-disabled`, nunca classe ou nome de função.
6. **Guarda nova:** nenhuma regra de lint, teste estrutural ou trava de pasta nova nesta tarefa.
7. **Comentários que afirmam o que o código não faz:** relidos; o do `estavaNoBotao` diz as duas cláusulas e a terceira que só o Chrome alcança.
8. **Divergência:** o seletor de dia (opção A). Antes do código, `techspec.md` §9 já traz o `DaySelector`; `grep -n DaySelector` em
   `techspec.md` acha a §9 (linhas 136 e 138); o `cenarios.md` não cita o `SegmentedControl` para o celular (T9 diz "um dia por vez", em botões).
9. **Peça que já existe:** `Tabs`, `Select`, `StatusBadge`, `LoadingState`, `ErrorState`, `useMediaQuery`, `O_MIOLO_DO_DOCUMENTO`,
   `useTopoDoPainel`, o `queryClient` e a `apiGet` do professor; a peça nova é só o `DaySelector`, pela divergência.
10. **Corrida:** a semana A segurada no ar não substitui a B (`page.route`, a ordem forçada), e o mesmo endereço colado de novo faz uma
    leitura só. Não há escrita nesta tarefa.
11. **Isolamento e coluna "Caso":** a tela não escopa nada (o servidor é que escopa, tarefa 2.0); o caso de isolamento da tela é a troca de
    escola (RF9) e a segunda professora (P30), em que nada da primeira aparece. Cada linha da tabela tem o caso.
12. **Achados dos guardiões:** `achados/indice.md` só tem rodadas da spec e da 1.0/2.0 (servidor); nada toca a tela. O `frontend-reviewer`:
    quatro estados, 360 px, alvos de 24/44 px, foco, axe, teclado do `DaySelector`; o `privacy-guardian`: o endereço leva só ids e datas, o
    texto da aula não vai a log nem a URL; o `test-engineer`: um caso por linha e as mutações acima.

## Fora do escopo desta tarefa

Painel (7.0), itens e link do Hoje (8.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O seletor de dia do celular é uma peça nova, `DaySelector`, e não o `SegmentedControl` | O `SegmentedControl` aceita até quatro opções e a semana tem de cinco a sete dias (RF1); `Tabs` aceita até três. Decisão do Joaquim, opção A: a peça entra no catálogo, com teste, linha (N) em `docs/interface.md` 10.2 e entrada na galeria | `techspec.md` §9 (reescrita pelo Arquiteto); `cenarios.md` T9 não muda; `.processo/ordens/divergencia-6.md` |

## Mutações

**Sem bloco, com o motivo.** (1) **`Turmas.tsx`, as linhas 187 a 229** só foram reindentadas: a lista de turmas (`listaDeTurmas`) é o JSX que já
existia, agora dentro da aba, sem condição nova; o que ela mostra (o aviso da turma confirmada, os quatro estados, as faixas, os cartões, "Ver
mais turmas") tem os casos de `Turmas.test.tsx` desde a 9.0. A condição nova de `Turmas.tsx` (a aba e o `replace`) tem bloco. (2) **`Semana.tsx:91`**,
`dia !== undefined &&`: `dias` nunca chega vazio ao `UmDiaPorVez`, porque o vazio da semana sai antes (`vazioDaSemana`), e `marcado` é sempre um dia
dele; a guarda serve ao tipo do `find`. (3) **`semana.ts:21`**, o `texto === null || !regex.test(texto)` de `ehDataValida`: o resto da função já recusa
tudo o que ele recusa (`new Date('nullT00:00:00Z')` e '09/11/2026T…' dão `NaN`, e a ida e volta do `toISOString` pega o que sobra); ficou como
guarda do tipo `string | null` e de leitura mais barata, sem comportamento que só ele dê (mutação rodada na mão, ficou verde). (4) **Os `?? ''` de
`semana.ts` (linhas 29, 47, 52, 61 e 221)** existem para o `noUncheckedIndexedAccess`: o índice vem do `getUTCDay()` (0 a 6), do mês de uma data
já validada, ou de `diasDeAula[0]`, que o `every` anterior garante ter recesso; nenhum ramo de `''` é alcançável por dado. (5) **`DaySelector.tsx:45`**,
`if (dia === undefined) return`: `escolher` só recebe índice de dentro da lista (o clique do próprio botão, ou o destino de uma seta, que é módulo do
tamanho), então a guarda é do tipo. (6) Duas cláusulas da mesma linha de `Semana.tsx` (`estavaNoBotao`) **têm** bloco, a de "Semana anterior" e a de
"Semana seguinte": o jsdom deixa o foco no botão que desliga. A terceira, `ativo === document.body`, é o que o Chrome faz com o foco do botão que
desliga; ela não tem bloco, porque nenhum dos dois navegadores se reproduz no outro, e o foco no título nas pontas é afirmado no navegador de
verdade por `chegar à ponta do ano pelo botão leva o foco ao título da semana` (`e2e/professor-semana.spec.ts`).

--faltando: 16 linhas (0 blocos, 16 motivos)

Trocar de aba usa `replace`: sem ele o Voltar passaria por cada aba.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/Turmas.tsx
teste: apps/web/src/areas/professor/turmas/Turmas.test.tsx › tocar em Semana guarda
-          <Tabs rotulo="Seções de Turmas" abas={ABAS_DE_TURMAS} ativa={aba} aoMudar={(id) => navegar(enderecoDaAbaDeTurmas(caminho, id), { replace: true })} classeDoPainel={aba === 'semana' ? O_MIOLO_DO_DOCUMENTO : ''}>
+          <Tabs rotulo="Seções de Turmas" abas={ABAS_DE_TURMAS} ativa={aba} aoMudar={(id) => navegar(enderecoDaAbaDeTurmas(caminho, id))} classeDoPainel={aba === 'semana' ? O_MIOLO_DO_DOCUMENTO : ''}>
```

A Semana só existe com a aba aberta: invertida, a aba Turmas leria a semana.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/Turmas.tsx
teste: apps/web/src/areas/professor/turmas/Turmas.test.tsx › abre em Turmas e a Semana nem é lida
-            {aba === 'semana' ? (
+            {aba !== 'semana' ? (
```

Sem o miolo do documento a página inteira rola, e não o painel da aba (RF22).

```mutacao
arquivo: apps/web/src/areas/professor/turmas/Turmas.tsx
teste: e2e/professor-semana.spec.ts › T10: 45 aulas
-          <Tabs rotulo="Seções de Turmas" abas={ABAS_DE_TURMAS} ativa={aba} aoMudar={(id) => navegar(enderecoDaAbaDeTurmas(caminho, id), { replace: true })} classeDoPainel={aba === 'semana' ? O_MIOLO_DO_DOCUMENTO : ''}>
+          <Tabs rotulo="Seções de Turmas" abas={ABAS_DE_TURMAS} ativa={aba} aoMudar={(id) => navegar(enderecoDaAbaDeTurmas(caminho, id), { replace: true })} classeDoPainel={''}>
```

Sem o ano da última semana lida, os dois botões se desligam enquanto a nova semana carrega.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › com a semana nova ainda a caminho
-  const lida = atual ?? cliente.getQueriesData<SemanaResponse>({ queryKey: SEMANA_QUERY_KEY }).find(([, dados]) => dados !== undefined)?.[1]
+  const lida = atual
```

`ano: null` (sem ano em curso) tem de virar `undefined`: com o `null`, a conta do ano quebra.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › sem ano letivo em curso
-  return lida?.ano ?? undefined
+  return lida?.ano
```

Só o "Tentar de novo" leva o foco ao título: a primeira leitura não pode roubá-lo.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › no computador, uma coluna por dia da semana de hoje
-    if (novaTentativaDe.current !== segunda || !lida) return
+    if (!lida) return
```

O foco vai ao título só quando o botão acaba de se desligar: a primeira leitura não o leva.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › no computador, uma coluna por dia da semana de hoje
-    const chegouNaPonta = (podia: boolean, pode: boolean) => podia && !pode
+    const chegouNaPonta = (podia: boolean, pode: boolean) => !pode
```

O foco que estava em "Semana seguinte" vai ao título quando ela desliga.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › chegar à ponta do ano
-    const estavaNoBotao = ativo === document.body || ativo === botaoAnterior.current || ativo === botaoSeguinte.current
+    const estavaNoBotao = ativo === document.body || ativo === botaoAnterior.current
```

O foco que estava em "Semana anterior" vai ao título quando ela desliga.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › chegar à ponta do ano
-    const estavaNoBotao = ativo === document.body || ativo === botaoAnterior.current || ativo === botaoSeguinte.current
+    const estavaNoBotao = ativo === document.body ||  ativo === botaoSeguinte.current
```

O foco que está em outro lugar (o filtro) não é levado ao título.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › chegar à ponta do ano
-    if ((chegouNaPonta(podiaAnterior.current, podeAnterior) || chegouNaPonta(podiaSeguinte.current, podeSeguinte)) && estavaNoBotao) titulo.current?.focus()
+    if ((chegouNaPonta(podiaAnterior.current, podeAnterior) || chegouNaPonta(podiaSeguinte.current, podeSeguinte)) && true) titulo.current?.focus()
```

A semana que não tem hoje abre no primeiro dia.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › no celular, um dia por vez
-  const inicial = dias.find((dia) => dia.data === hoje)?.data ?? dias[0]?.data ?? ''
+  const inicial = dias.find((dia) => dia.data === hoje)?.data ?? ''
```

Escolher outro dia no seletor troca o dia mostrado.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › no celular, um dia por vez
-  const marcado = escolhido !== undefined && dias.some((dia) => dia.data === escolhido) ? escolhido : inicial
+  const marcado = escolhido !== undefined && dias.some((dia) => dia.data === escolhido) ? inicial : inicial
```

Antes de a lista de turmas chegar, o filtro só tem "Todas as turmas".

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › as opções são "Todas as turmas"
-  const confirmados = (vinculos.data?.pages.flatMap((pagina) => pagina.itens) ?? []).flatMap((vinculo) =>
+  const confirmados = (vinculos.data?.pages.flatMap((pagina) => pagina.itens)).flatMap((vinculo) =>
```

Só o vínculo confirmado dá aula: o pendente e o contestado não entram no filtro.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › as opções são "Todas as turmas"
-    vinculo.estado === 'confirmado' && vinculo.disciplina !== undefined ? [{ valor: `${vinculo.turma.id}.${vinculo.disciplina.id}`, rotulo: `${vinculo.turma.nome} · ${vinculo.disciplina.nome}` }] : [],
+    vinculo.disciplina !== undefined ? [{ valor: `${vinculo.turma.id}.${vinculo.disciplina.id}`, rotulo: `${vinculo.turma.nome} · ${vinculo.disciplina.nome}` }] : [],
```

O vínculo sem disciplina não vira opção.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › as opções são "Todas as turmas"
-    vinculo.estado === 'confirmado' && vinculo.disciplina !== undefined ? [{ valor: `${vinculo.turma.id}.${vinculo.disciplina.id}`, rotulo: `${vinculo.turma.nome} · ${vinculo.disciplina.nome}` }] : [],
+    vinculo.estado === 'confirmado' ? [{ valor: `${vinculo.turma.id}.${vinculo.disciplina.id}`, rotulo: `${vinculo.turma.nome} · ${vinculo.disciplina.nome}` }] : [],
```

Falha na leitura mostra o erro com "Tentar de novo".

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › o erro oferece "Tentar de novo"
-  if (semana.isError) {
+  if (false) {
```

Sem a resposta, a tela carrega; não mostra vazio.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › carregando não mostra vazio nem aviso
-  if (dados === undefined || aguardandoHoje) return <LoadingState rotulo="Carregando a semana…" />
+  if (aguardandoHoje) return <LoadingState rotulo="Carregando a semana…" />
```

Durante a troca para a semana de hoje, a de fora do ano não mostra o vazio dela.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › a semana de fora do ano não pisca
-  if (dados === undefined || aguardandoHoje) return <LoadingState rotulo="Carregando a semana…" />
+  if (dados === undefined) return <LoadingState rotulo="Carregando a semana…" />
```

O vazio que diz por quê.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › carregando não mostra vazio nem aviso
-  if (vazio !== undefined) {
+  if (false) {
```

Com filtro, o vazio oferece "Ver todas as turmas".

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › sem filtro, o vazio da semana não oferece
-    return <EmptyState titulo={vazio.titulo} descricao={vazio.descricao} {...(filtro === undefined ? {} : { acao: { rotulo: 'Ver todas as turmas', aoAcionar: aoVerTodas } })} />
+    return <EmptyState titulo={vazio.titulo} descricao={vazio.descricao} {...(false ? {} : { acao: { rotulo: 'Ver todas as turmas', aoAcionar: aoVerTodas } })} />
```

Sem filtro, não há o que tirar: o botão não aparece.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › sem filtro, o vazio da semana não oferece
-    return <EmptyState titulo={vazio.titulo} descricao={vazio.descricao} {...(filtro === undefined ? {} : { acao: { rotulo: 'Ver todas as turmas', aoAcionar: aoVerTodas } })} />
+    return <EmptyState titulo={vazio.titulo} descricao={vazio.descricao} {...(true ? {} : { acao: { rotulo: 'Ver todas as turmas', aoAcionar: aoVerTodas } })} />
```

Abaixo de 768 px a Semana mostra um dia por vez.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › no celular, um dia por vez
-  if (!noComputador) return <UmDiaPorVez key={dias[0]?.data} dias={dias} hoje={dados.hoje} agora={dados.agora} aoAbrirAula={aoAbrirAula} />
+  if (false) return <UmDiaPorVez key={dias[0]?.data} dias={dias} hoje={dados.hoje} agora={dados.agora} aoAbrirAula={aoAbrirAula} />
```

`?semana=` abre a semana pedida.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › "Semana anterior" e "Hoje" levam
-  const segunda = pedida ?? segundaDe(hojeNoFusoDaEscola(new Date()))
+  const segunda = segundaDe(hojeNoFusoDaEscola(new Date()))
```

"Semana anterior" presa ao começo do ano.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › "Semana anterior" desliga na semana do começo
-  const podeAnterior = ano !== undefined && haSemanaAnterior(segunda, ano)
+  const podeAnterior = ano !== undefined && true
```

"Semana seguinte" presa ao fim do ano.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › "Semana anterior" desliga na semana do começo
-  const podeSeguinte = ano !== undefined && haSemanaSeguinte(segunda, ano)
+  const podeSeguinte = ano !== undefined && true
```

Sem o ano lido, o botão não decide: a conta do ano não roda sobre `undefined`.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › sem ano letivo em curso
-  const podeAnterior = ano !== undefined && haSemanaAnterior(segunda, ano)
+  const podeAnterior = haSemanaAnterior(segunda, ano)
```

A semana de fora do ano abre a de hoje.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › a semana pedida fora do ano
-    if (irParaHoje) navegar(enderecoDaSemana(caminho, busca, { semana: undefined }), { replace: true })
+    if (false) navegar(enderecoDaSemana(caminho, busca, { semana: undefined }), { replace: true })
```

A volta para hoje usa `replace`.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › a semana pedida fora do ano
-    if (irParaHoje) navegar(enderecoDaSemana(caminho, busca, { semana: undefined }), { replace: true })
+    if (irParaHoje) navegar(enderecoDaSemana(caminho, busca, { semana: undefined }))
```

O aviso do calendário.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › o aviso do calendário aparece
-      {faltaOCalendario(dados) && (
+      {false && (
```

O aviso não aparece enquanto a semana carrega.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › carregando não mostra vazio nem aviso
-      {faltaOCalendario(dados) && (
+      {true && (
```

O filtro corta as aulas das outras turmas.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/Semana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › escolher a turma põe
-        dias={dados === undefined ? [] : diasFiltrados(dados.dias, filtro)}
+        dias={dados === undefined ? [] : dados.dias}
```

"Hoje" em texto no dia de hoje.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/DiaDaSemana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › no computador, uma coluna por dia da semana de hoje
-        {ehHoje && (
+        {false && (
```

"Hoje" só no dia de hoje.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/DiaDaSemana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › no computador, uma coluna por dia da semana de hoje
-        {ehHoje && (
+        {true && (
```

Feriado e evento aparecem no dia.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/DiaDaSemana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › o feriado é mostrado
-      {dia.eventos.length > 0 && (
+      {false && (
```

Dia sem evento não leva lista vazia.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/DiaDaSemana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › o cartão diz a sala
-      {dia.eventos.length > 0 && (
+      {true && (
```

Dia sem aula diz "Sem aulas".

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/DiaDaSemana.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › o cartão diz a sala
-      {dia.aulas.length > 0 ? (
+      {true ? (
```

A sala só aparece quando há.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/CartaoDaAula.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › o cartão diz a sala
-        {aula.sala !== null && (
+        {true && (
```

"Agora" e "Fora da grade" são texto do cartão.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/CartaoDaAula.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › o cartão diz a sala
-        {(emAndamento || aula.foraDaGrade) && (
+        {false && (
```

"Agora" só na aula que está no ar.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/CartaoDaAula.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › o cartão diz a sala
-            {emAndamento && <StatusBadge familia="info">Agora</StatusBadge>}
+            {true && <StatusBadge familia="info">Agora</StatusBadge>}
```

"Fora da grade" só na aula que saiu dela.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/CartaoDaAula.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › o cartão diz a sala
-            {aula.foraDaGrade && <StatusBadge familia="info">Fora da grade</StatusBadge>}
+            {true && <StatusBadge familia="info">Fora da grade</StatusBadge>}
```

O texto só aparece quando a professora escreveu.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/CartaoDaAula.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › o cartão diz a sala
-        {aula.texto !== null && (
+        {true && (
```

"Falta preencher" só na aula de hoje ou futura sem texto.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/CartaoDaAula.tsx
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › o cartão diz a sala
-        {falta && (
+        {true && (
```

O filtro só vale com UUIDs inteiros.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › `?turma=` só vale
-const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
+const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
```

Data impossível ("2026-13-45") não vira data.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › só aceita data que existe
-  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === texto
+  return data.toISOString().slice(0, 10) === texto
```

"2026-02-30" não é data.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › só aceita data que existe
-  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === texto
+  return !Number.isNaN(data.getTime())
```

O domingo pertence à semana que termina nele.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › a semana vai de segunda a domingo
-  return somarDias(data, diaDaSemana === 0 ? -6 : 1 - diaDaSemana)
+  return somarDias(data, diaDaSemana === 0 ? 1 : 1 - diaDaSemana)
```

O título da semana que atravessa o mês cita os dois meses.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › os textos
-  return mesDe(segunda) === mesDe(domingo) ? `${diaDoMes(segunda)} a ${diaEMes(domingo)}` : `${diaEMes(segunda)} a ${diaEMes(domingo)}`
+  return true ? `${diaDoMes(segunda)} a ${diaEMes(domingo)}` : `${diaEMes(segunda)} a ${diaEMes(domingo)}`
```

Hora cheia sem minutos.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › os textos
-  return m === '00' ? `${String(Number(h))}h` : `${String(Number(h))}h${m}`
+  return false ? `${String(Number(h))}h` : `${String(Number(h))}h${m}`
```

A aula passada sem texto não leva "Falta preencher".

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › S14 e T11
-  return data >= hoje && aula.texto === null
+  return aula.texto === null
```

A aula com texto não leva "Falta preencher".

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › S14 e T11
-  return data >= hoje && aula.texto === null
+  return data >= hoje
```

"O que foi dado" depois do dia da aula.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › o rótulo do texto
-  return data >= hoje ? 'O que vou dar' : 'O que foi dado'
+  return true ? 'O que vou dar' : 'O que foi dado'
```

"Agora" só no dia de hoje.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › "Agora" só na aula
-  return data === hoje && aula.inicio <= agora && agora < aula.fim
+  return aula.inicio <= agora && agora < aula.fim
```

"Agora" só depois do começo.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › "Agora" só na aula
-  return data === hoje && aula.inicio <= agora && agora < aula.fim
+  return data === hoje && agora < aula.fim
```

"Agora" só até o fim, que não conta.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › "Agora" só na aula
-  return data === hoje && aula.inicio <= agora && agora < aula.fim
+  return data === hoje && aula.inicio <= agora
```

`?semana=` vira a segunda-feira da semana.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › `?semana=` vira a segunda
-  return ehDataValida(pedida) ? segundaDe(pedida) : undefined
+  return ehDataValida(pedida) ? pedida : undefined
```

Sem `?turma=`, não há filtro (e nada quebra).

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › `?turma=` só vale
-  const [turmaId, disciplinaId, resto] = (new URLSearchParams(busca).get('turma') ?? '').split('.')
+  const [turmaId, disciplinaId, resto] = (new URLSearchParams(busca).get('turma')).split('.')
```

Mais de duas partes não é filtro.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › `?turma=` só vale
-  if (resto !== undefined || turmaId === undefined || disciplinaId === undefined || !UUID.test(turmaId) || !UUID.test(disciplinaId)) return undefined
+  if (turmaId === undefined || disciplinaId === undefined || !UUID.test(turmaId) || !UUID.test(disciplinaId)) return undefined
```

A turma tem de ser UUID.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › `?turma=` só vale
-  if (resto !== undefined || turmaId === undefined || disciplinaId === undefined || !UUID.test(turmaId) || !UUID.test(disciplinaId)) return undefined
+  if (resto !== undefined || turmaId === undefined || disciplinaId === undefined || !UUID.test(disciplinaId)) return undefined
```

A disciplina tem de ser UUID.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › `?turma=` só vale
-  if (resto !== undefined || turmaId === undefined || disciplinaId === undefined || !UUID.test(turmaId) || !UUID.test(disciplinaId)) return undefined
+  if (resto !== undefined || turmaId === undefined || disciplinaId === undefined || !UUID.test(turmaId)) return undefined
```

Sem filtro, o valor do seletor é vazio.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/Semana.test.tsx › as opções são
-  return filtro === undefined ? '' : `${filtro.turmaId}.${filtro.disciplinaId}`
+  return `${filtro.turmaId}.${filtro.disciplinaId}`
```

Trocar de semana não apaga o filtro.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › trocar de semana ou de filtro mantém o resto
-    if (!(chave in mudanca)) continue
+    if (false) continue
```

`undefined` tira o parâmetro.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › trocar de semana ou de filtro mantém o resto
-    if (valor === undefined || valor === '') parametros.delete(chave)
+    if (valor === '') parametros.delete(chave)
```

"Todas as turmas" tira o filtro, e não deixa `turma=`.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › trocar de semana ou de filtro mantém o resto
-    if (valor === undefined || valor === '') parametros.delete(chave)
+    if (valor === undefined) parametros.delete(chave)
```

A semana antes do começo do ano não toca o ano.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › o ano que começa no meio da semana
-  return somarDias(segunda, 6) >= ano.inicio && segunda <= ano.fim
+  return segunda <= ano.fim
```

A semana depois do fim do ano não toca o ano.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › o ano que começa no meio da semana
-  return somarDias(segunda, 6) >= ano.inicio && segunda <= ano.fim
+  return somarDias(segunda, 6) >= ano.inicio
```

Sem semana pedida, a de hoje já é a aberta.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › semana pedida fora do ano
-  if (pedida === undefined || resposta === undefined || resposta.ano === null) return false
+  if (resposta === undefined || resposta.ano === null) return false
```

Sem a resposta não se sabe o ano.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › semana pedida fora do ano
-  if (pedida === undefined || resposta === undefined || resposta.ano === null) return false
+  if (pedida === undefined || resposta.ano === null) return false
```

Sem ano em curso não há para onde voltar.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › semana pedida fora do ano
-  if (pedida === undefined || resposta === undefined || resposta.ano === null) return false
+  if (pedida === undefined || resposta === undefined) return false
```

A semana de hoje fora do ano não é redirecionada (sem laço).

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › semana pedida fora do ano
-  return !semanaToca(segunda, resposta.ano) && segundaDe(resposta.hoje) !== segunda
+  return !semanaToca(segunda, resposta.ano)
```

Sem resposta, sem aviso.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › o aviso do calendário só aparece
-  return resposta !== undefined && resposta.ano !== null && resposta.gradeImportada && !resposta.calendarioImportado
+  return resposta.ano !== null && resposta.gradeImportada && !resposta.calendarioImportado
```

Sem ano em curso, sem aviso.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › o aviso do calendário só aparece
-  return resposta !== undefined && resposta.ano !== null && resposta.gradeImportada && !resposta.calendarioImportado
+  return resposta !== undefined && resposta.gradeImportada && !resposta.calendarioImportado
```

Sem grade, o vazio é o da grade, e não o aviso.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › o aviso do calendário só aparece
-  return resposta !== undefined && resposta.ano !== null && resposta.gradeImportada && !resposta.calendarioImportado
+  return resposta !== undefined && resposta.ano !== null && !resposta.calendarioImportado
```

Com calendário, sem aviso.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › o aviso do calendário só aparece
-  return resposta !== undefined && resposta.ano !== null && resposta.gradeImportada && !resposta.calendarioImportado
+  return resposta !== undefined && resposta.ano !== null && resposta.gradeImportada
```

Sem filtro, os dias vêm como a API os mandou.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › o filtro corta
-  if (filtro === undefined) return dias
+  if (false) return dias
```

O filtro vale para a disciplina.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › o filtro corta
-  return dias.map((dia) => ({ ...dia, aulas: dia.aulas.filter((aula) => aula.turmaId === filtro.turmaId && aula.disciplinaId === filtro.disciplinaId) }))
+  return dias.map((dia) => ({ ...dia, aulas: dia.aulas.filter((aula) => aula.turmaId === filtro.turmaId) }))
```

O filtro vale para a turma.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › o filtro corta
-  return dias.map((dia) => ({ ...dia, aulas: dia.aulas.filter((aula) => aula.turmaId === filtro.turmaId && aula.disciplinaId === filtro.disciplinaId) }))
+  return dias.map((dia) => ({ ...dia, aulas: dia.aulas.filter((aula) => aula.disciplinaId === filtro.disciplinaId) }))
```

Só fim de semana na tela não é semana de recesso.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › a semana inteira de recesso
-  if (diasDeAula.length === 0 || !diasDeAula.every((dia) => dia.eventos.some((evento) => evento.tipo === 'recesso'))) return undefined
+  if (!diasDeAula.every((dia) => dia.eventos.some((evento) => evento.tipo === 'recesso'))) return undefined
```

Um dia de recesso não faz a semana de recesso.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › a semana inteira de recesso
-  if (diasDeAula.length === 0 || !diasDeAula.every((dia) => dia.eventos.some((evento) => evento.tipo === 'recesso'))) return undefined
+  if (diasDeAula.length === 0 ) return undefined
```

Recesso sem descrição ainda diz que é recesso.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › a semana inteira de recesso
-  return { titulo: 'Semana de recesso', descricao: descricao === '' ? 'A escola está em recesso nesta semana.' : `${descricao}: a escola está em recesso nesta semana.` }
+  return { titulo: 'Semana de recesso', descricao: false ? 'A escola está em recesso nesta semana.' : `${descricao}: a escola está em recesso nesta semana.` }
```

Antes do ano: "ainda não começou"; depois dele, "sem aulas".

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › sem ano em curso, sem grade
-  return hoje < ano.inicio
+  return true
```

A frase do ano que ainda não começou diz quando ele começa.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › sem ano em curso, sem grade
-    ? { titulo: 'O ano letivo ainda não começou', descricao: `As aulas aparecem aqui a partir de ${diaEMes(ano.inicio)}.` }
+    ? { titulo: 'O ano letivo ainda não começou', descricao: `As aulas aparecem aqui a partir de ${diaEMes(ano.fim)}.` }
```

Sem ano em curso.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › sem ano em curso, sem grade
-  if (resposta.ano === null) return { titulo: 'O ano letivo ainda não começou', descricao: 'Quando a coordenação abrir o ano letivo, as suas aulas aparecem aqui, semana a semana.' }
+  if (false) return { titulo: 'O ano letivo ainda não começou', descricao: 'Quando a coordenação abrir o ano letivo, as suas aulas aparecem aqui, semana a semana.' }
```

Sem grade importada.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › sem ano em curso, sem grade
-  if (!resposta.gradeImportada) {
+  if (false) {
```

Semana sem nenhum dia dentro do ano.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › sem ano em curso, sem grade
-  if (dias.length === 0) return vazioForaDoAno(resposta.ano, resposta.hoje)
+  if (false) return vazioForaDoAno(resposta.ano, resposta.hoje)
```

A semana de recesso tem a frase dela.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › a semana inteira de recesso
-  if (recesso !== undefined) return recesso
+  if (false) return recesso
```

Dia com evento e sem aula não é vazio.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › a semana inteira de recesso
-  if (dias.some((dia) => dia.aulas.length > 0 || dia.eventos.length > 0)) return undefined
+  if (dias.some((dia) => dia.eventos.length > 0)) return undefined
```

Dia com aula não é vazio.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › a semana inteira de recesso
-  if (dias.some((dia) => dia.aulas.length > 0 || dia.eventos.length > 0)) return undefined
+  if (dias.some((dia) => dia.aulas.length > 0)) return undefined
```

A aula passada sem texto não leva "Falta preencher".

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › a descrição diz o horário
-  const texto = aula.texto === null ? (faltaPreencher(data, hoje, aula) ? 'Falta preencher' : undefined) : `${rotuloDoTexto(data, hoje)}: ${aula.texto}`
+  const texto = aula.texto === null ? ('Falta preencher') : `${rotuloDoTexto(data, hoje)}: ${aula.texto}`
```

"Em andamento" só quando está no ar.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › a descrição diz o horário
-  return [horarioDaAula(aula), aula.sala === null ? undefined : `Sala ${aula.sala}`, andamento ? 'Em andamento' : undefined, aula.foraDaGrade ? 'Fora da grade' : undefined, texto]
+  return [horarioDaAula(aula), aula.sala === null ? undefined : `Sala ${aula.sala}`, 'Em andamento', aula.foraDaGrade ? 'Fora da grade' : undefined, texto]
```

"Fora da grade" só quando saiu da grade.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › a descrição diz o horário
-  return [horarioDaAula(aula), aula.sala === null ? undefined : `Sala ${aula.sala}`, andamento ? 'Em andamento' : undefined, aula.foraDaGrade ? 'Fora da grade' : undefined, texto]
+  return [horarioDaAula(aula), aula.sala === null ? undefined : `Sala ${aula.sala}`, andamento ? 'Em andamento' : undefined, 'Fora da grade', texto]
```

Sem sala, a descrição não diz "Sala null".

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › a descrição diz o horário
-  return [horarioDaAula(aula), aula.sala === null ? undefined : `Sala ${aula.sala}`, andamento ? 'Em andamento' : undefined, aula.foraDaGrade ? 'Fora da grade' : undefined, texto]
+  return [horarioDaAula(aula), false ? undefined : `Sala ${aula.sala}`, andamento ? 'Em andamento' : undefined, aula.foraDaGrade ? 'Fora da grade' : undefined, texto]
```

`?ver=semana` abre a Semana; o resto abre Turmas.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › as abas de Turmas guardam só
-  return new URLSearchParams(busca).get('ver') === 'semana' ? 'semana' : 'turmas'
+  return new URLSearchParams(busca).get('ver') === 'semana' ? 'semana' : 'semana'
```

Turmas é o caminho sem nada.

```mutacao
arquivo: apps/web/src/areas/professor/turmas/semana/semana.ts
teste: apps/web/src/areas/professor/turmas/semana/semana.test.ts › as abas de Turmas guardam só
-  return id === 'semana' ? `${caminho}?ver=semana` : caminho
+  return true ? `${caminho}?ver=semana` : caminho
```

Escolher o dia que já está marcado não avisa de novo.

```mutacao
arquivo: apps/web/src/components/ui/fields/DaySelector.tsx
teste: apps/web/src/components/ui/fields/DaySelector.test.tsx › clicar escolhe
-    if (indice !== marcado) aoMudar(dia.valor)
+    if (true) aoMudar(dia.valor)
```

A tecla ArrowRight escolhe.

```mutacao
arquivo: apps/web/src/components/ui/fields/DaySelector.tsx
teste: apps/web/src/components/ui/fields/DaySelector.test.tsx › as setas escolhem
-      case 'ArrowRight':
+      case 'ArrowRightX':
```

A tecla ArrowDown escolhe.

```mutacao
arquivo: apps/web/src/components/ui/fields/DaySelector.tsx
teste: apps/web/src/components/ui/fields/DaySelector.test.tsx › as setas escolhem
-      case 'ArrowDown':
+      case 'ArrowDownX':
```

A tecla ArrowLeft escolhe.

```mutacao
arquivo: apps/web/src/components/ui/fields/DaySelector.tsx
teste: apps/web/src/components/ui/fields/DaySelector.test.tsx › as setas escolhem
-      case 'ArrowLeft':
+      case 'ArrowLeftX':
```

A tecla ArrowUp escolhe.

```mutacao
arquivo: apps/web/src/components/ui/fields/DaySelector.tsx
teste: apps/web/src/components/ui/fields/DaySelector.test.tsx › as setas escolhem
-      case 'ArrowUp':
+      case 'ArrowUpX':
```

A tecla Home escolhe.

```mutacao
arquivo: apps/web/src/components/ui/fields/DaySelector.tsx
teste: apps/web/src/components/ui/fields/DaySelector.test.tsx › as setas escolhem
-      case 'Home':
+      case 'HomeX':
```

A tecla End escolhe.

```mutacao
arquivo: apps/web/src/components/ui/fields/DaySelector.tsx
teste: apps/web/src/components/ui/fields/DaySelector.test.tsx › as setas escolhem
-      case 'End':
+      case 'EndX':
```

Só o dia de hoje tem descrição.

```mutacao
arquivo: apps/web/src/components/ui/fields/DaySelector.tsx
teste: apps/web/src/components/ui/fields/DaySelector.test.tsx › hoje é marcado em texto
-            aria-describedby={dia.hoje === true ? idDoHoje : undefined}
+            aria-describedby={idDoHoje}
```

Uma parada só no Tab.

```mutacao
arquivo: apps/web/src/components/ui/fields/DaySelector.tsx
teste: apps/web/src/components/ui/fields/DaySelector.test.tsx › uma parada só no Tab
-            tabIndex={indice === naOrdemDoTab ? 0 : -1}
+            tabIndex={0}
```

O dia marcado leva a borda e o fundo.

```mutacao
arquivo: apps/web/src/components/ui/fields/DaySelector.tsx
teste: apps/web/src/components/ui/fields/DaySelector.test.tsx › o dia marcado não é só cor
-              ativo ? 'border-azul-borda bg-azul-claro text-azul-texto' : 'border-fundo text-apoio hover:border-fundo-suave hover:bg-fundo-suave hover:text-tinta'
+              false ? 'border-azul-borda bg-azul-claro text-azul-texto' : 'border-fundo text-apoio hover:border-fundo-suave hover:bg-fundo-suave hover:text-tinta'
```

"hoje" escrito só no botão de hoje.

```mutacao
arquivo: apps/web/src/components/ui/fields/DaySelector.tsx
teste: apps/web/src/components/ui/fields/DaySelector.test.tsx › hoje é marcado em texto
-            {dia.hoje === true && (
+            {true && (
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | Pôr na `queryKey` da semana um identificador da sessão ativa | Recusada: muda o contrato da chave, que segue o padrão das outras chaves do professor (`apps/web/src/api/chaves-do-professor.ts`); o isolamento é provado por RF9 e P30 (item 2 desta ordem reforça o P30) |
| privacy-guardian (1ª) | O aviso "não escreva nome de aluno" do painel (`docs/interface.md` 1.8) precisa ser conferido, porque o texto do cartão aparece inteiro | Tarefa 7.0 (o painel é dela) |
| infra-guardian (1ª) | O filtro só oferece os vínculos das páginas já no cache; montar as opções a partir das aulas, ou registrar o limite em `docs/interface.md` 1.8 | `TODO.md`: muda o que o filtro lista |
| infra-guardian (1ª) | `staleTime` maior na consulta da semana | Recusada: muda comportamento; os 30 s e a releitura ao voltar ao foco são o padrão do `query-client`, e o aviso de grade nova depende dela |
| frontend-reviewer (1ª) | Colunas entre 768 e cerca de 1000 px podem apertar o texto do cartão; trocar para um dia por vez numa largura maior, ou fotografar a 820 px | Validação: o Validador fotografa a 820 px com a grade importada; se apertar, vira correção. A mudança de breakpoint altera o desenho da §9 da Tech Spec (768 px) |
| frontend-reviewer (1ª) | `docs/interface.md` 1.8 descreve o painel e os itens como se existissem; marcar "tarefas 7.0 e 8.0" | Recusada: a subtarefa 6.4 manda escrever a 1.8 inteira, "painel e itens incluídos" |
| frontend-reviewer (1ª) | Fotografar a Semana com a grade importada, em 1366 e em 360 px | Validação (Validador), com o dado que a vitrine ainda não tem |
| conformidade-reviewer (1ª) | O item "Correção do Assistente" do dia marcado como saída de IA, estado vindo da aprovação, sem nota no cartão, e nunca em redação ou discursiva (D55), com teste | Tarefa 8.0 |
| conformidade-reviewer (1ª) | Teste de que o texto da aula nunca é preenchido pelo Assistente sem a professora salvar | Tarefa 7.0 |
| conformidade-reviewer (1ª) | Se a coordenação um dia alcançar a grade ou os registros de aula: nominal só com auditoria, nunca contagem de "falta preencher" por professor (D64) | `TODO.md` (tela futura da coordenação) |
| revisor-geral (1ª) | `?turma=` de turma que não é dela: o `<select>` mostra "Todas as turmas" enquanto a tela mostra o vazio do filtro | `TODO.md`: muda o que o filtro mostra e tem caso e2e próprio; o vazio com "Ver todas as turmas" é o que o RF12 pede |
| revisor-geral (1ª) | "Ver todas as turmas" navega sem `replace`, e a troca de filtro usa `replace` | `TODO.md`: muda o histórico do navegador, que o caso de `?turma=` e o Voltar já exercitam |
| revisor-geral (1ª) | O botão "Ver todas as turmas" aparece nos vazios "grade não importada" e "ano não começou", onde tirar o filtro não muda nada | `TODO.md`: muda comportamento |
| revisor-geral (1ª) | `useTopoDoPainel(true)` em `Turmas.tsx` mede também na aba Turmas; passar `aba === 'semana'` | `TODO.md`: a medida do topo é da casca da aba, e a mudança pede o caso de altura da aba Turmas |
| test-engineer (1ª) | T8 pede e2e e três vazios só têm unidade e jsdom: recesso, ano ainda não começou, semana fora do ano sem aula | `TODO.md`: o vazio de cada razão tem caso em `semana.test.ts` e `Semana.test.tsx`; o e2e pede cena com ano e evento próprios |
| test-engineer (1ª) | Os alvos de toque do seletor "Turma e disciplina" e do botão "Ver todas as turmas" no celular não são medidos | `TODO.md`: a medida vai com a revisão do filtro (as linhas do `revisor-geral` acima) |
| test-engineer (2ª) | `GRADE_DE_T1` (`e2e/professor-semana.spec.ts:39`) copia à mão o `GRADE_PADRAO` de `e2e/support/professor/semana.ts:127`; exportar o `GRADE_PADRAO` e estendê-lo | `TODO.md`: duas grades que podem se separar; mexe no suporte de e2e, junto com a próxima tarefa que o tocar (7.0) |
| revisor-geral (2ª) | O mesmo achado: `GRADE_DE_T1` copia linha por linha o `GRADE_PADRAO` | `TODO.md`, o mesmo item da linha acima (dois revisores, um achado) |
| test-engineer (2ª) | No T1, depois de "Semana anterior" o caso olha só o endereço e um título qualquer (`:101-102`); afirmar `[data-dia="${cena.anterior}"]` visível ou o texto do título da semana anterior | `TODO.md`: reforço de asserção; a mudança da semana na tela já tem caso em `Semana.test.tsx` ("Semana anterior" e "Hoje" levam) |
| revisor-geral (2ª) | No caso P30, o `page.route('**/v1/semana?*')` fica ativo até o fim; um `page.unroute` depois do `liberar()` | `TODO.md`: o caso não tem mais passos, e a rota vive só dentro do caso |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-06 22:13:33 | 2026-11-06 22:13:58 | `tenancy-guardian` | 1 | APROVADO | a1a7447f1df0ddcf8 |
| 2026-11-06 22:13:21 | 2026-11-06 22:14:01 | `privacy-guardian` | 1 | APROVADO | a57b7153067671cb0 |
| 2026-11-06 22:13:41 | 2026-11-06 22:14:06 | `infra-guardian` | 1 | APROVADO | a29506b90d8f36921 |
| 2026-11-06 22:13:17 | 2026-11-06 22:14:17 | `frontend-reviewer` | 1 | APROVADO | a1d762fd2ebe4921f |
| 2026-11-06 22:13:37 | 2026-11-06 22:14:18 | `conformidade-reviewer` | 1 | APROVADO | ae83cfc7fcf1501e8 |
| 2026-11-06 22:13:29 | 2026-11-06 22:14:30 | `revisor-geral` | 1 | APROVADO | ad4715d866f55089c |
| 2026-11-06 22:13:25 | 2026-11-06 22:16:39 | `test-engineer` | 1 | REPROVADO | a1f3984dc7fbd6f19 |
| 2026-11-06 22:48:31 | 2026-11-06 22:48:57 | `revisor-geral` | 2 | APROVADO | a93f7d1396f231509 |
| 2026-11-06 22:48:24 | 2026-11-06 22:49:42 | `test-engineer` | 2 | APROVADO | ab8424279359d42a0 |
