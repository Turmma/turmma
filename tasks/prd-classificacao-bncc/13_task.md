# Tarefa 13.0 — A coordenação vê, por série, as habilidades sem material

**Funcionalidade:** classificacao-bncc · **Depende de:** 11.0
**Subagentes obrigatórios:** `tenancy-guardian`, `infra-guardian`, `frontend-reviewer`
**Porte:** grande

## Objetivo

Na aba Cobertura de Material, a coordenação escolhe a série e vê, por componente (área, no EM), as habilidades da BNCC
que nenhum material em uso cobre, e quantas seções ainda estão sem classificação.

## Contexto necessário

- `techspec.md` §4 (`GET /v1/materiais/cobertura`, antes de `:id`), §5 "Cobertura" e "Suspensão", §7c (`EXPLAIN`), §9
- `prd.md` RF19, RF20
- `cenarios.md` "Cobertura (RF19)", as linhas de cobertura em "Permissão e isolamento" e em "Seções e agendamento"
  (componente apagado), "Telas" (o [U] da cobertura)
- `docs/interface.md` §3, Material (as abas)
- `.claude/rules/`: 10, 50, 80 (itens 3 e 8)
- Código: `apps/api/src/material/material.controller.ts` (`GET /resumo` e `GET /busca` antes de `GET /:id`),
  `material.repository.ts` (o filtro `declaradoParaASerie`, `proprioOuComLicencaVigente`), `COMPONENTES_BNCC` (1.0);
  `apps/web/src/areas/coordenacao/material/Material.tsx` (`abaDoEndereco`), `ResumoDoMaterial.tsx`

## Subtarefas

- [x] 13.1 — `GET /v1/materiais/cobertura?serieId=`: candidatas da série menos as habilidades das seções de material no filtro da F4; com a função suspensa, só as corrigidas; `secoesSemClassificacao`
- [x] 13.2 — A aba Cobertura (`?aba=cobertura`), com a escolha da série e os quatro estados; a Parte A no `docs/interface.md`
- [x] 13.3 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/shared/src/material/cobertura.ts`, `packages/shared/src/index.ts` | novo e alterado |
| `apps/api/src/material/material.controller.ts`, `apps/api/src/material/cobertura.repository.ts`, `apps/api/src/material/material.service.ts` | novo e alterado |
| `apps/api/test/cobertura.int.test.ts` | novo |
| `apps/web/src/areas/coordenacao/material/Material.tsx`, `apps/web/src/areas/coordenacao/material/Cobertura.tsx`, `apps/web/src/areas/coordenacao/material/Cobertura.test.tsx`, `apps/web/src/areas/coordenacao/material/api/cobertura.ts`, `apps/web/src/paths.ts` | novo e alterado |
| `e2e/material-cobertura.spec.ts`, `docs/interface.md` | novo e alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| excluído o único material de uma habilidade | I | ela aparece | `cobertura.int.test.ts` › a série sem material lista todas as habilidades dela; o material que a cobre as tira, e excluído o único material, a habilidade volta |
| licença vencida; `processando`; `falhou`; substituído; seção `aguardando` | I | não cobrem, um caso cada | `cobertura.int.test.ts` › o material de que a escola ainda não pode ou não deve se valer não cobre, um por vez; › o material em uso e o que não está em uso na mesma escola; › `materiaisEmUso` conta só o material em uso da série |
| não classificada | I | conta em `secoesSemClassificacao` | `cobertura.int.test.ts` › a seção que não terminou conta em `secoesSemClassificacao` do componente do material |
| `EF69LP01` num material só do 6º | I | não cobre o 7º | `cobertura.int.test.ts` › `EF69LP01` num material só do 6º não cobre o 7º |
| EM | I | por área | `cobertura.int.test.ts` › no Médio a cobertura é por área; › o material do Fundamental e do Médio juntos |
| material de duas séries | I | cobre nas duas | `cobertura.int.test.ts` › o material de duas séries cobre nas duas |
| componente apagado | I | deixa de contar o código | `cobertura.int.test.ts` › o componente apagado deixa de contar o código; › no Médio, o componente apagado não derruba a cobertura |
| suspensa | I | só as corrigidas contam | `cobertura.int.test.ts` › com a classificação pela IA suspensa › só as habilidades corrigidas contam |
| suspensa e retomada, no componente apagado | I | não conta o código antigo | `cobertura.int.test.ts` › com a classificação pela IA suspensa › suspensa e retomada, com o componente apagado no meio |
| professor; rede | I | recusados | `cobertura.int.test.ts` › o professor e o aluno recebem `NAO_ENCONTRADO`; a rede: `matriz.test.ts` › MVP: só a coordenação envia e exclui material (a rede nunca alcança `material.resumir`) |
| `serieId` da B | I | `NAO_ENCONTRADO` igual ao inexistente. Mutação: tirar `escola_id` da série | `cobertura.int.test.ts` › a série da outra escola, e a que não existe, respondem o mesmo `NAO_ENCONTRADO` |
| material da B que cobriria a habilidade da A | I | não cobre. A garantia é estrutural: tirar o `escola_id` do `materialEmUso` não deixa nada vermelho (a chave composta `(escola_id, id)` das junções já separa as escolas), e a prova é este caso mais o motivo escrito em "Sem bloco, com o motivo" | `cobertura.int.test.ts` › o material da B que cobriria a habilidade que falta à A não cobre |
| `/cobertura` | I | não é capturada por `:id` | `cobertura.int.test.ts` › a rota `/cobertura` não é capturada por `:id` |
| `EXPLAIN` | I | usa os índices da §7c no cenário da carga | `cobertura.int.test.ts` › o plano da consulta no volume do cenário da carga |
| série | U | a escolha | `Cobertura.test.tsx` › a escolha da série (a lista em ordem, a troca sem a resposta da anterior, a pessoa seguinte sem série) |
| carregando; erro; vazio da escola sem material; com dado | U | um caso cada; `secoesSemClassificacao` ao lado | `Cobertura.test.tsx` › os quatro estados da tela (e o Médio, as séries carregando e com erro, e o aviso que some sem capítulo pendente) |
| 1366 × 768; ação cheia; vocabulário; 360 px | E | `paginaNaoRola`; nenhuma ação cheia (`botoesCheios` igual a `[]`); `VOCABULARIO_DE_NOTA`; 44 px no `celular` | `material-cobertura.spec.ts` › a série escolhida mostra, por componente, as habilidades sem material… (nos projetos `chromebook` e `celular`) |
| axe | E | nenhuma violação grave no seletor e em um grupo | `material-cobertura.spec.ts` › o seletor da série e o grupo de habilidades não têm violação de acessibilidade grave… (o axe na página inteira leva 5 s nas habilidades da série e estourava a metade do prazo) |
| vazio da escola sem material | E | convite a enviar, sem lista e sem aviso de capítulo | `material-cobertura.spec.ts` › a série sem material em uso convida a enviar… |
| recomeço: 6º segurado e troca para o 7º; falha e "Tentar de novo" | E | um caso cada | `material-cobertura.spec.ts` › recomeço: a cobertura do 6º segurada com o 7º escolhido…; › a leitura que falha mostra o erro curto… |
| recomeço: segunda pessoa; mesma série, outra escola | U | a série escolhida some com a sessão, e a cobertura lida da anterior some da tela | `Cobertura.test.tsx` › a pessoa seguinte do mesmo computador começa sem série escolhida (a escolha some no `aoTrocarDeSessao` de `Cobertura.tsx`). **Sem caso de e2e próprio:** o `resetQueries` de `main.tsx`, comum a toda tela, é provado em `material-licencas.spec.ts` › segunda pessoa…; o caso de e2e que trocava de pessoa na Cobertura passou de 15 s no portão em três versões (12 a 15 s em máquina calma: duas entradas pela tela e a carga fria da coordenação) e foi retirado |

## Como testar

- Filtro da F4: `apps/api/test/material-resumo.int.test.ts` (o resumo por série já usa o mesmo filtro)
- Rota antes de `:id`: como `GET /resumo` em `material.controller.ts`
- Isolamento: `material-isolamento.int.test.ts` › "ler material de B responde o mesmo 404 do inexistente…"
- Tela: `Material.test.tsx` › "vazio: \"Nenhum material ainda\"…" e o `describe` "os quatro estados da tela"
- e2e: `e2e/material.spec.ts` › "os estados sem dado: carregando, erro com \"Tentar de novo\", e o vazio que convida a enviar"; `paginaNaoRola`
- Comandos: `npx vitest run --project integracao apps/api/test/cobertura.int.test.ts`; `node tools/ci/e2e.ts --manter-ambiente e2e/material-cobertura.spec.ts`
- Telas: `coordenacao`, `/coordenacao/material?aba=cobertura`, com a série escolhida

## Autoconferência

As 12 perguntas do modelo, no plano. Na 3: uma habilidade coberta e uma não, na mesma série.

1. **Mutação de cada cláusula:** a seção "Mutações" tem um bloco por cláusula do diff (`--faltando`: nenhuma linha sem bloco ou sem motivo). São 72 blocos: o repository (a série e o recorte, as junções por id, o `where` e cada argumento dele, a função suspensa, os termos de `terminouAClassificacao` e de `secoesSemClassificacao`), o service (a série que não existe, o grupo, o que cobre, a soma das seções por grupo), as duas tabelas de grupo de `packages/shared`, `Cobertura.tsx`, `cobertura.ts` e as duas conduções de aba de `Material.tsx`. As que o resultado não distingue (a igualdade de `escola_id` na junção, as duas cópias do escopo no `where`, o `isNotNull(disciplina.componenteBncc)` da consulta das cobertas) vão com o motivo escrito, depois de eu as ter tirado uma a uma e visto o caso de resultado e o do plano seguirem verdes. Duas cláusulas que eram unkillable (o laço das seções por grupo e a tabela do Médio por sigla) viraram código sem a cláusula: um mapa de pendentes por grupo e uma tabela `GRUPO_NO_MEDIO`. Depois da rodada 1 entraram os blocos que o `--faltando` não vê: os quatro termos de `materialEmUso` com teste que os mata (o `escolaId` dele, que nada distingue, vai com o motivo), o `habilidadeEhCandidata` do service, o `coalesce` da área, o ternário `Área`/`Componente` do `aria-label` (dentro de um template literal) e o `sort` da ordem dos grupos, com a asserção da ordem.
2. **O texto que a tela ganha já aparece em `e2e/`?** `grep -rln "Cobertura da BNCC\|Escolha uma série\|Nenhum material desta série" e2e/`: só o spec novo (`material-cobertura.spec.ts`). Nenhum spec existente conta as abas de Material (a `grep` de `getByRole('tab'` em `material*.spec.ts` só acha o `toHaveCount(0)` da aba Licenças para o professor); rodei `material.spec.ts` e `material-licencas.spec.ts` isolados mesmo assim: ver "Telas vistas". O spec novo tem 5 casos e passa nos dois projetos (10 execuções, o mais lento com 8 s sozinho); o portão, que mede cada caso alterado contra 15 s, passou com ele.
3. **Segundo dado:** o caso de resultado tem a habilidade coberta e a que não está no mesmo grupo e na mesma série (`EF07CI01` coberta, `EF07CI02` não), um material em uso e outro `processando` na mesma escola (o que prende a junção por id), a Química e a Física somando as seções sem classificação do mesmo grupo (5, e não 4), e a série do 6º ao lado da do 7º. Na tela, o grupo com habilidade em falta e o sem (Ciências e Língua Portuguesa).
4. **Checagem anterior que responde antes:** a coordenação passa por `material.resumir` e pela série da escola antes da consulta; o caso de `NAO_ENCONTRADO` da B usa uma série que existe na B (o `404` vem de `serieDaEscola`, e não da validação do UUID), e o do `ENTRADA_INVALIDA` usa os três erros de contrato. O e2e do 6º segurado segura a resposta **do 6º** (a primeira), escolhe o 7º, e só então a libera.
5. **A asserção olha o resultado:** a cobertura do 6º atrasada é conferida depois de a leitura ter sido liberada (`liberada.aberta`), com `expect.poll` na ausência e o positivo do 7º antes; a falha do "Tentar de novo" conta os pedidos (2) e o `alerta` some depois; na unidade, a contagem de `p` do grupo sem pendência (1) e do com pendência (2) pega o parágrafo vazio.
6. **Guarda nova:** não se aplica (nenhuma regra de lint nem teste estrutural nova); a `escopo-dos-repositories` já cobre o `CoberturaRepository` (`@Unscoped` só em `habilidadesDaSerie`, com o motivo).
7. **Comentário que afirma o que o código não faz:** conferidos o docblock da rota, os do repository (a série "do contexto", a função suspensa) e o de `Cobertura.tsx` (a série fora do endereço, sem laço); o da `techspec.md` §4 e o do `cenarios.md` receberam o `materiaisEmUso`. A Parte A do `docs/interface.md` cita só o que a tela faz (os textos vêm de `Cobertura.tsx`, `cobertura.ts` e do caso de tela).
8. **A divergência cria ou muda uma regra?** `materiaisEmUso` na resposta: o vazio "escola sem material da série" não se distingue só por `grupos` (o universo vem da BNCC, nunca vazio). Está na seção "Divergências", na `techspec.md` §4 e no `cenarios.md`, com o caso. Não toca o `prd.md`.
9. **Qual peça que já existe faz isto?** `declaradoParaASerie` e `proprioOuComLicencaVigente` (o filtro da F4, uma cópia só, em `cobertura.repository.ts` pela leitura do `material.repository.ts`); `habilidadeEhCandidata` e `situacaoDaSecao` (a regra dos estados); `Select`, `EmptyState`, `ErrorState`, `Alert` e `LoadingState` da casca; o padrão de aba de `Licencas.tsx`.
10. **Operação concorrente:** a leitura é só leitura, sem escrita. A corrida que existe na tela é a resposta de uma série chegando sob outra, e tem caso de e2e com a resposta segurada (a do 6º) e de unidade (o 7º sem `placeholderData`, `key` por série).
11. **Isolamento e "Caso":** o caso de isolamento usa uma série da B lida no contexto da A; a coluna "Caso" da tabela de testes está preenchida, um para cada coisa que a linha diz.
12. **O que os guardiões pedem:** `tenancy-guardian` (escopo no repository, `NAO_ENCONTRADO` igual, UUID, o material da B), `infra-guardian` (índices pela escola e `EXPLAIN` com as 300 apostilas, rota sem laço, uma leitura por série) e `frontend-reviewer` (os quatro estados, 360 px, alvo de 44 px, o caminho de sair) estão na tabela e nas mutações. O `achados/indice.md` não tem item aberto da 13.0.

## Fora do escopo desta tarefa

Paginar a cobertura além da escolha da série (a lista de uma série cabe em ~200).

## Divergências resolvidas nesta tarefa

- **`materiaisEmUso` na resposta de `GET /v1/materiais/cobertura`.** A Tech Spec §4 dava `grupos` com `semMaterial[]`, `total` e `secoesSemClassificacao`; o vazio da tela ("Envie material desta série para ver a cobertura") precisa saber se a série tem material em uso, e `grupos` não o diz: o universo vem da BNCC e nunca é vazio, e uma série sem material tem todas as habilidades em falta, igual a uma com material que não cobre nada. A resposta ganhou `materiaisEmUso` (a contagem de material `pronto`, não excluído, de licença vigente e declarado para a série, a mesma `materialEmUso` das duas outras leituras) e, para a tela, `serieId`, `etapa` (o "componente" ou a "área" do título) e `classificacaoSuspensa` (o aviso); nenhum é dado de pessoa nem título de material. Registrado na `techspec.md` §4 e no `cenarios.md` ("Cobertura (RF19)"), com o caso `materiaisEmUso` conta só o material em uso da série.
- **A cobertura mostra todos os componentes da série, não só os que têm material.** O universo é a BNCC da série (RF19: "as habilidades que nenhum material em uso cobre"); o grupo de um componente sem material aparece com tudo em falta. A tela não esconde o grupo "inteiro em falta": é a informação que a coordenação procurava.
- **O caso de e2e da pessoa seguinte na Cobertura foi retirado.** Com duas entradas pela tela ele levava de 12 a 15 s e reprovou o portão da duração três vezes (15,1 a 15,2 s, limite 15,0 s), mesmo depois de eu tirar o `axe` dele. A escolha da série que some com a sessão fica no caso de unidade com o `aoTrocarDeSessao` (e na mutação dele), e o esvaziamento do cache por `main.tsx` no caso da Licenças. O `axe` da página inteira também saiu do caso principal: ele analisa o seletor e um grupo, em caso próprio.
- **A série escolhida não vai ao endereço.** A Tech Spec fala em `?aba=cobertura`; a escolha da série é estado da tela e some com a sessão (`aoTrocarDeSessao`), para a pessoa seguinte do mesmo computador começar sem série. O endereço leva só a aba, como as outras duas.

## Mutações

--faltando: 0 linhas (72 blocos, 5 motivos)

**Sem bloco, com o motivo** (cláusula que o resultado não distingue: tirada, o `cobertura.int.test.ts` e o plano seguem verdes, e nenhum dado de teste a prova):

- `eq(secaoDoMaterial.escolaId, habilidadeDaSecao.escolaId)`, `eq(material.escolaId, secaoDoMaterial.escolaId)`, `eq(disciplina.escolaId, material.escolaId)` e `eq(execucaoAgente.escolaId, secaoDoMaterial.escolaId)` (nas duas consultas, `consultaDasCobertas` e `secoesSemClassificacao`): a igualdade de `escola_id` na junção é a forma da chave estrangeira composta e dá ao planner o índice que começa pela escola. O id é UUID, e a chave estrangeira já impede que a linha ligue a outra escola, então tirar a igualdade deixa o resultado igual: tentei, bloco a bloco, contra o caso do plano (`o plano da consulta no volume do cenário da carga`) e contra os de resultado, e todos seguiram verdes. A parte que decide o resultado, a igualdade do **id**, tem bloco (as junções por `eq(secaoDoMaterial.id, …)`, `eq(material.id, …)`, `eq(disciplina.id, …)` e `eq(execucaoAgente.id, …)`).
- `eq(habilidadeDaSecao.escolaId, escolaId)` e `eq(secaoDoMaterial.escolaId, requireEscolaId())`: o escopo da escola chega à seção e à habilidade por três caminhos que se repetem (o `where`, a junção por `escola_id` e o `materialEmUso`, que prende o material à escola do contexto e a série declarada a ela), de modo que tirar um só não muda o resultado. A prova de que o escopo vale é a da série (`eq(serie.escolaId, requireEscolaId())`, com bloco) e a do caso `o material da B que cobriria a habilidade que falta à A não cobre`, que passa pelos três juntos; a guarda `escopo-dos-repositories` exige o `requireEscolaId()` em todo método público.
- `isNotNull(secaoDoMaterial.corrigidaEm)` na `terminouAClassificacao` e `isNull(secaoDoMaterial.corrigidaEm)` na seção sem classificação: o termo se repete na linha 127 (o ramo da função suspensa e o `and` do ramo normal), e cada ocorrência tem bloco, um por vez; o teste de termo único da ferramenta não distingue as duas.
- `eq(material.escolaId, requireEscolaId())` do `materialEmUso`: tirado, o `cobertura.int.test.ts` segue verde (mutação rodada e vista verde em 20/11). O filtro por escola está também em `declaradoParaASerie`, cuja série declarada pertence à escola do contexto pela chave composta `(escola_id, id)` de `material_serie`: o material de outra escola não é declarado para a série desta, e nenhum dado de teste cria essa linha (a FK composta a recusa). A prova da outra escola é o caso `o material da B que cobriria a habilidade…`; a do termo sozinho vai ao `TODO.md` ("um caso do repository com o `serieId` da B").
- `isNotNull(disciplina.componenteBncc)` (nas duas consultas, `consultaDasCobertas` e `secoesSemClassificacao`): o par sem componente chega ao service, e `habilidadeEhCandidata` o recusa (nas cobertas), ou `grupoDaCoberturaDoComponente` o põe numa chave que nenhum grupo da série lê (nas seções sem classificação); a cláusula só poupa a linha e mantém o tipo `ComponenteBncc` do `select` verdadeiro. Tirada de cada uma, o caso `o componente apagado deixa de contar o código` e o do Médio seguem verdes.

```mutacao
arquivo: apps/api/src/material/cobertura.repository.ts
teste: apps/api/test/cobertura.int.test.ts › só as habilidades corrigidas contam
-const terminouAClassificacao = or(isNotNull(secaoDoMaterial.corrigidaEm), eq(execucaoAgente.estado, 'concluida'))
+const terminouAClassificacao = or(eq(execucaoAgente.estado, 'concluida'))
```

```mutacao
arquivo: apps/api/src/material/cobertura.repository.ts
teste: apps/api/test/cobertura.int.test.ts › o material de que a escola ainda não pode ou não deve se valer
-const terminouAClassificacao = or(isNotNull(secaoDoMaterial.corrigidaEm), eq(execucaoAgente.estado, 'concluida'))
+const terminouAClassificacao = or(isNotNull(secaoDoMaterial.corrigidaEm))
```

```mutacao
arquivo: apps/api/src/material/cobertura.repository.ts
teste: apps/api/test/cobertura.int.test.ts › a série da outra escola, e a que não existe
-      .where(and(eq(serie.escolaId, requireEscolaId()), eq(serie.id, serieId)))
+      .where(and(eq(serie.id, serieId)))
```

```mutacao
arquivo: apps/api/src/material/cobertura.repository.ts
teste: apps/api/test/cobertura.int.test.ts › a série da outra escola, e a que não existe
-      .where(and(eq(serie.escolaId, requireEscolaId()), eq(serie.id, serieId)))
+      .where(and(eq(serie.escolaId, requireEscolaId())))
```

```mutacao
arquivo: apps/api/src/material/cobertura.repository.ts
teste: apps/api/test/cobertura.int.test.ts › no Médio a cobertura é por área
-      .where(and(eq(habilidadeBncc.etapa, recorte.etapa), recorte.etapa === 'em' ? undefined : sql`${habilidadeBncc.anos} @> array[${recorte.ano}]::smallint[]`))
+      .where(and(recorte.etapa === 'em' ? undefined : sql`${habilidadeBncc.anos} @> array[${recorte.ano}]::smallint[]`))
```

```mutacao
arquivo: apps/api/src/material/cobertura.repository.ts
teste: apps/api/test/cobertura.int.test.ts › `EF69LP01` num material só do 6º
-      .where(and(eq(habilidadeBncc.etapa, recorte.etapa), recorte.etapa === 'em' ? undefined : sql`${habilidadeBncc.anos} @> array[${recorte.ano}]::smallint[]`))
+      .where(and(eq(habilidadeBncc.etapa, recorte.etapa), undefined))
```

```mutacao
arquivo: apps/api/src/material/cobertura.repository.ts
teste: apps/api/test/cobertura.int.test.ts › o material em uso e o que não está em uso na mesma escola
-      .innerJoin(secaoDoMaterial, and(eq(secaoDoMaterial.escolaId, habilidadeDaSecao.escolaId), eq(secaoDoMaterial.id, habilidadeDaSecao.secaoId)))
+      .innerJoin(secaoDoMaterial, and(eq(secaoDoMaterial.escolaId, habilidadeDaSecao.escolaId)))
```

```mutacao
arquivo: apps/api/src/material/cobertura.repository.ts
teste: apps/api/test/cobertura.int.test.ts › o material de que a escola ainda não pode ou não deve se valer
       .innerJoin(secaoDoMaterial, and(eq(secaoDoMaterial.escolaId, habilidadeDaSecao.escolaId), eq(secaoDoMaterial.id, habilidadeDaSecao.secaoId)))
-      .innerJoin(material, and(eq(material.escolaId, secaoDoMaterial.escolaId), eq(material.id, secaoDoMaterial.materialId)))
+      .innerJoin(material, and(eq(material.escolaId, secaoDoMaterial.escolaId)))
```

```mutacao
arquivo: apps/api/src/material/cobertura.repository.ts
teste: apps/api/test/cobertura.int.test.ts › no Médio a cobertura é por área
       .innerJoin(secaoDoMaterial, and(eq(secaoDoMaterial.escolaId, habilidadeDaSecao.escolaId), eq(secaoDoMaterial.id, habilidadeDaSecao.secaoId)))
       .innerJoin(material, and(eq(material.escolaId, secaoDoMaterial.escolaId), eq(material.id, secaoDoMaterial.materialId)))
-      .innerJoin(disciplina, and(eq(disciplina.escolaId, material.escolaId), eq(disciplina.id, material.disciplinaId)))
+      .innerJoin(disciplina, and(eq(disciplina.escolaId, material.escolaId)))
```

```mutacao
arquivo: apps/api/src/material/cobertura.repository.ts
teste: apps/api/test/cobertura.int.test.ts › o material de que a escola ainda não pode ou não deve se valer
       .innerJoin(secaoDoMaterial, and(eq(secaoDoMaterial.escolaId, habilidadeDaSecao.escolaId), eq(secaoDoMaterial.id, habilidadeDaSecao.secaoId)))
       .innerJoin(material, and(eq(material.escolaId, secaoDoMaterial.escolaId), eq(material.id, secaoDoMaterial.materialId)))
       .innerJoin(disciplina, and(eq(disciplina.escolaId, material.escolaId), eq(disciplina.id, material.disciplinaId)))
-      .leftJoin(execucaoAgente, and(eq(execucaoAgente.escolaId, secaoDoMaterial.escolaId), eq(execucaoAgente.id, secaoDoMaterial.execucaoId)))
+      .leftJoin(execucaoAgente, and(eq(execucaoAgente.escolaId, secaoDoMaterial.escolaId)))
```

```mutacao
arquivo: apps/api/src/material/cobertura.repository.ts
teste: apps/api/test/cobertura.int.test.ts › a seção que não terminou conta em
       .from(secaoDoMaterial)
-      .innerJoin(material, and(eq(material.escolaId, secaoDoMaterial.escolaId), eq(material.id, secaoDoMaterial.materialId)))
+      .innerJoin(material, and(eq(material.escolaId, secaoDoMaterial.escolaId)))
```

```mutacao
arquivo: apps/api/src/material/cobertura.repository.ts
teste: apps/api/test/cobertura.int.test.ts › a seção que não terminou conta em
       .from(secaoDoMaterial)
       .innerJoin(material, and(eq(material.escolaId, secaoDoMaterial.escolaId), eq(material.id, secaoDoMaterial.materialId)))
-      .innerJoin(disciplina, and(eq(disciplina.escolaId, material.escolaId), eq(disciplina.id, material.disciplinaId)))
+      .innerJoin(disciplina, and(eq(disciplina.escolaId, material.escolaId)))
```

```mutacao
arquivo: apps/api/src/material/cobertura.repository.ts
teste: apps/api/test/cobertura.int.test.ts › a seção que não terminou conta em
       .from(secaoDoMaterial)
       .innerJoin(material, and(eq(material.escolaId, secaoDoMaterial.escolaId), eq(material.id, secaoDoMaterial.materialId)))
       .innerJoin(disciplina, and(eq(disciplina.escolaId, material.escolaId), eq(disciplina.id, material.disciplinaId)))
-      .leftJoin(execucaoAgente, and(eq(execucaoAgente.escolaId, secaoDoMaterial.escolaId), eq(execucaoAgente.id, secaoDoMaterial.execucaoId)))
+      .leftJoin(execucaoAgente, and(eq(execucaoAgente.escolaId, secaoDoMaterial.escolaId)))
```

```mutacao
arquivo: apps/api/src/material/cobertura.repository.ts
teste: apps/api/test/cobertura.int.test.ts › o material de que a escola ainda não pode ou não deve se valer
       .where(
-        and(
+        or(
```

```mutacao
arquivo: apps/api/src/material/cobertura.repository.ts
teste: apps/api/test/cobertura.int.test.ts › o material de que a escola ainda não pode ou não deve se valer
         and(
           eq(habilidadeDaSecao.escolaId, escolaId),
-          materialEmUso(this.banco, serieId, hoje),
```

```mutacao
arquivo: apps/api/src/material/cobertura.repository.ts
teste: apps/api/test/cobertura.int.test.ts › o material de que a escola ainda não pode ou não deve se valer
           isNotNull(disciplina.componenteBncc),
-          terminouAClassificacao,
```

```mutacao
arquivo: apps/api/src/material/cobertura.repository.ts
teste: apps/api/test/cobertura.int.test.ts › só as habilidades corrigidas contam
           // A função suspensa: vale só a correção da coordenação, a `origem: 'ia'` não conta (Tech Spec, seção 5, "Suspensão").
-          soDaCoordenacao ? eq(habilidadeDaSecao.origem, 'coordenacao') : undefined,
+          undefined,
```

```mutacao
arquivo: apps/api/src/material/cobertura.repository.ts
teste: apps/api/test/cobertura.int.test.ts › só as habilidades corrigidas contam
-    const sem = soDaCoordenacao ? isNull(secaoDoMaterial.corrigidaEm) : and(isNull(secaoDoMaterial.corrigidaEm), or(isNull(execucaoAgente.estado), ne(execucaoAgente.estado, 'concluida')))
+    const sem = soDaCoordenacao ? undefined : and(isNull(secaoDoMaterial.corrigidaEm), or(isNull(execucaoAgente.estado), ne(execucaoAgente.estado, 'concluida')))
```

```mutacao
arquivo: apps/api/src/material/cobertura.repository.ts
teste: apps/api/test/cobertura.int.test.ts › a seção que não terminou conta em
-    const sem = soDaCoordenacao ? isNull(secaoDoMaterial.corrigidaEm) : and(isNull(secaoDoMaterial.corrigidaEm), or(isNull(execucaoAgente.estado), ne(execucaoAgente.estado, 'concluida')))
+    const sem = soDaCoordenacao ? isNull(secaoDoMaterial.corrigidaEm) : or(isNull(execucaoAgente.estado), ne(execucaoAgente.estado, 'concluida'))
```

```mutacao
arquivo: apps/api/src/material/cobertura.repository.ts
teste: apps/api/test/cobertura.int.test.ts › a seção que não terminou conta em
-    const sem = soDaCoordenacao ? isNull(secaoDoMaterial.corrigidaEm) : and(isNull(secaoDoMaterial.corrigidaEm), or(isNull(execucaoAgente.estado), ne(execucaoAgente.estado, 'concluida')))
+    const sem = soDaCoordenacao ? isNull(secaoDoMaterial.corrigidaEm) : and(isNull(secaoDoMaterial.corrigidaEm))
```

```mutacao
arquivo: apps/api/src/material/cobertura.repository.ts
teste: apps/api/test/cobertura.int.test.ts › a seção que não terminou conta em
-    const sem = soDaCoordenacao ? isNull(secaoDoMaterial.corrigidaEm) : and(isNull(secaoDoMaterial.corrigidaEm), or(isNull(execucaoAgente.estado), ne(execucaoAgente.estado, 'concluida')))
+    const sem = soDaCoordenacao ? isNull(secaoDoMaterial.corrigidaEm) : and(isNull(secaoDoMaterial.corrigidaEm), or(ne(execucaoAgente.estado, 'concluida')))
```

```mutacao
arquivo: apps/api/src/material/cobertura.repository.ts
teste: apps/api/test/cobertura.int.test.ts › a seção que não terminou conta em
-    const sem = soDaCoordenacao ? isNull(secaoDoMaterial.corrigidaEm) : and(isNull(secaoDoMaterial.corrigidaEm), or(isNull(execucaoAgente.estado), ne(execucaoAgente.estado, 'concluida')))
+    const sem = soDaCoordenacao ? isNull(secaoDoMaterial.corrigidaEm) : and(isNull(secaoDoMaterial.corrigidaEm), or(isNull(execucaoAgente.estado)))
```

```mutacao
arquivo: apps/api/src/material/cobertura.repository.ts
teste: apps/api/test/cobertura.int.test.ts › o material em uso e o que não está em uso na mesma escola
-      .where(and(eq(secaoDoMaterial.escolaId, requireEscolaId()), materialEmUso(this.banco, serieId, hoje), isNotNull(disciplina.componenteBncc), sem))
+      .where(and(eq(secaoDoMaterial.escolaId, requireEscolaId()), isNotNull(disciplina.componenteBncc), sem))
```

```mutacao
arquivo: apps/api/src/material/cobertura.repository.ts
teste: apps/api/test/cobertura.int.test.ts › a seção que não terminou conta em
-      .where(and(eq(secaoDoMaterial.escolaId, requireEscolaId()), materialEmUso(this.banco, serieId, hoje), isNotNull(disciplina.componenteBncc), sem))
+      .where(and(eq(secaoDoMaterial.escolaId, requireEscolaId()), materialEmUso(this.banco, serieId, hoje), isNotNull(disciplina.componenteBncc)))
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/cobertura.int.test.ts › a série da outra escola, e a que não existe
     const recorte = await cobertura.serieDaEscola(serieId)
-    if (recorte === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+    if (recorte === undefined && recorte !== undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/cobertura.int.test.ts › a série sem material lista todas as habilidades
-      const atual = grupos.get(grupo) ?? { chave: grupo, total: 0, semMaterial: [], secoesSemClassificacao: semClassificacaoPorGrupo.get(grupo) ?? 0 }
+      const atual = { chave: grupo, total: 0, semMaterial: [], secoesSemClassificacao: semClassificacaoPorGrupo.get(grupo) ?? 0 }
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/cobertura.int.test.ts › o material de que a escola ainda não pode ou não deve se valer
-      grupos.set(grupo, { ...atual, total: atual.total + 1, semMaterial: codigosCobertos.has(codigo) ? atual.semMaterial : [...atual.semMaterial, { codigo, descricao }] })
+      grupos.set(grupo, { ...atual, total: atual.total + 1, semMaterial: [...atual.semMaterial, { codigo, descricao }] })
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/cobertura.int.test.ts › a série sem material lista todas as habilidades
-      grupos.set(grupo, { ...atual, total: atual.total + 1, semMaterial: codigosCobertos.has(codigo) ? atual.semMaterial : [...atual.semMaterial, { codigo, descricao }] })
+      grupos.set(grupo, { ...atual, total: atual.total + 1, semMaterial: atual.semMaterial })
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/cobertura.int.test.ts › a seção que não terminou conta em
-      semClassificacaoPorGrupo.set(grupo, (semClassificacaoPorGrupo.get(grupo) ?? 0) + total)
+      semClassificacaoPorGrupo.set(grupo, total)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/cobertura.int.test.ts › a seção que não terminou conta em
-      semClassificacaoPorGrupo.set(grupo, (semClassificacaoPorGrupo.get(grupo) ?? 0) + total)
+      semClassificacaoPorGrupo.set(grupo, (semClassificacaoPorGrupo.get(grupo) ?? 0))
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/cobertura.int.test.ts › a seção que não terminou conta em
-      semClassificacaoPorGrupo.set(grupo, (semClassificacaoPorGrupo.get(grupo) ?? 0) + total)
+      semClassificacaoPorGrupo.set(grupo, (semClassificacaoPorGrupo.get(grupo) ?? 1) + total)
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/cobertura.int.test.ts › a seção que não terminou conta em
-      const atual = grupos.get(grupo) ?? { chave: grupo, total: 0, semMaterial: [], secoesSemClassificacao: semClassificacaoPorGrupo.get(grupo) ?? 0 }
+      const atual = grupos.get(grupo) ?? { chave: grupo, total: 0, semMaterial: [], secoesSemClassificacao: semClassificacaoPorGrupo.get(grupo) ?? 1 }
```

```mutacao
arquivo: packages/shared/src/material/cobertura.ts
teste: apps/api/test/cobertura.int.test.ts › a seção que não terminou conta em
-  return (etapa === 'ef_anos_finais' ? GRUPO_NO_FUNDAMENTAL : GRUPO_NO_MEDIO)[componente]
+  return (GRUPO_NO_MEDIO)[componente]
```

```mutacao
arquivo: packages/shared/src/material/cobertura.ts
teste: apps/api/test/cobertura.int.test.ts › no Médio, o componente apagado não derruba a cobertura
-  return (etapa === 'ef_anos_finais' ? GRUPO_NO_FUNDAMENTAL : GRUPO_NO_MEDIO)[componente]
+  return (GRUPO_NO_FUNDAMENTAL)[componente]
```

```mutacao
arquivo: packages/shared/src/material/cobertura.ts
teste: apps/web/src/areas/coordenacao/material/Cobertura.test.tsx › no Médio o grupo é a área
-  if (etapa === 'em') return NOME_DA_AREA_DA_BNCC[chave as AreaDoConhecimento]
+  if (false) return NOME_DA_AREA_DA_BNCC[chave as AreaDoConhecimento]
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/cobertura.ts
teste: apps/web/src/areas/coordenacao/material/Cobertura.test.tsx › as habilidades sem material, no singular
-  if (semMaterial === 0) return total === 1 ? 'A habilidade da série tem material' : `Todas as ${String(total)} habilidades têm material`
+  if (semMaterial === 0) return false ? 'A habilidade da série tem material' : `Todas as ${String(total)} habilidades têm material`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/cobertura.ts
teste: apps/web/src/areas/coordenacao/material/Cobertura.test.tsx › as habilidades sem material, no singular
-  if (semMaterial === 0) return total === 1 ? 'A habilidade da série tem material' : `Todas as ${String(total)} habilidades têm material`
+  if (semMaterial === 99) return total === 1 ? 'A habilidade da série tem material' : `Todas as ${String(total)} habilidades têm material`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/cobertura.ts
teste: apps/web/src/areas/coordenacao/material/Cobertura.test.tsx › as habilidades sem material, no singular
-  if (secoes === 0) return null
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/cobertura.ts
teste: apps/web/src/areas/coordenacao/material/Cobertura.test.tsx › as habilidades sem material, no singular
-  return secoes === 1 ? '1 capítulo ainda sem classificação' : `${String(secoes)} capítulos ainda sem classificação`
+  return false ? '1 capítulo ainda sem classificação' : `${String(secoes)} capítulos ainda sem classificação`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Cobertura.tsx
teste: apps/web/src/areas/coordenacao/material/Cobertura.test.tsx › lista as séries da escola
-  return [...series].sort((a, b) => (a.etapa === b.etapa ? a.ano - b.ano : a.etapa === 'ef_anos_finais' ? -1 : 1))
+  return [...series].sort((a, b) => (a.etapa === b.etapa ? b.ano - a.ano : a.etapa === 'ef_anos_finais' ? -1 : 1))
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Cobertura.tsx
teste: apps/web/src/areas/coordenacao/material/Cobertura.test.tsx › lista as séries da escola
-  return [...series].sort((a, b) => (a.etapa === b.etapa ? a.ano - b.ano : a.etapa === 'ef_anos_finais' ? -1 : 1))
+  return [...series].sort((a, b) => (a.etapa === b.etapa ? a.ano - b.ano : a.etapa === 'ef_anos_finais' ? 1 : -1))
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Cobertura.tsx
teste: apps/web/src/areas/coordenacao/material/Cobertura.test.tsx › com dado: por componente
-      {pendentes !== null && <p className="t-apoio text-apoio">{pendentes}</p>}
+      <p className="t-apoio text-apoio">{pendentes}</p>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Cobertura.tsx
teste: apps/web/src/areas/coordenacao/material/Cobertura.test.tsx › com dado: por componente
-      {pendentes !== null && <p className="t-apoio text-apoio">{pendentes}</p>}
+      {pendentes === null && <p className="t-apoio text-apoio">{pendentes}</p>}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Cobertura.tsx
teste: apps/web/src/areas/coordenacao/material/Cobertura.test.tsx › com dado: por componente
-      {grupo.semMaterial.length > 0 && <HabilidadesSemMaterial habilidades={grupo.semMaterial} />}
+      {<HabilidadesSemMaterial habilidades={grupo.semMaterial} />}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Cobertura.tsx
teste: apps/web/src/areas/coordenacao/material/Cobertura.test.tsx › com dado: por componente
-      {grupo.semMaterial.length > 0 && <HabilidadesSemMaterial habilidades={grupo.semMaterial} />}
+      {grupo.semMaterial.length > 0 && null}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Cobertura.tsx
teste: apps/web/src/areas/coordenacao/material/Cobertura.test.tsx › com dado: por componente
-      {pendentes !== null && <p className="t-apoio text-apoio">{pendentes}</p>}
+      {pendentes !== null && null}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Cobertura.tsx
teste: apps/web/src/areas/coordenacao/material/Cobertura.test.tsx › carregando: a cobertura no ar
-  if (cobertura.isPending) return <LoadingState rotulo="Carregando a cobertura…" />
+  if (false) return <LoadingState rotulo="Carregando a cobertura…" />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Cobertura.tsx
teste: apps/web/src/areas/coordenacao/material/Cobertura.test.tsx › erro: a mensagem curta
-  if (dados === undefined) return <ErrorState erro={cobertura.error} tentando={cobertura.isFetching} aoTentarDeNovo={() => void cobertura.refetch({ cancelRefetch: false })} />
+  if (false) return <ErrorState erro={cobertura.error} tentando={cobertura.isFetching} aoTentarDeNovo={() => void cobertura.refetch({ cancelRefetch: false })} />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Cobertura.tsx
teste: apps/web/src/areas/coordenacao/material/Cobertura.test.tsx › vazio: a série sem material
-  if (dados.materiaisEmUso === 0) {
+  if (dados.materiaisEmUso === -1) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Cobertura.tsx
teste: apps/web/src/areas/coordenacao/material/Cobertura.test.tsx › com dado: por componente
-      {dados.classificacaoSuspensa && <Alert tom="atencao">{AVISO_DA_SUSPENSAO}</Alert>}
+      <Alert tom="atencao">{AVISO_DA_SUSPENSAO}</Alert>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Cobertura.tsx
teste: apps/web/src/areas/coordenacao/material/Cobertura.test.tsx › no Médio o grupo é a área
-      {dados.classificacaoSuspensa && <Alert tom="atencao">{AVISO_DA_SUSPENSAO}</Alert>}
+      {dados.classificacaoSuspensa && null}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Cobertura.tsx
teste: apps/web/src/areas/coordenacao/material/Cobertura.test.tsx › sem capítulo pendente
-      {faltaClassificar && <Alert tom="info">{AVISO_DAS_SECOES_SEM_CLASSIFICACAO}</Alert>}
+      <Alert tom="info">{AVISO_DAS_SECOES_SEM_CLASSIFICACAO}</Alert>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Cobertura.tsx
teste: apps/web/src/areas/coordenacao/material/Cobertura.test.tsx › com dado: por componente
-      {faltaClassificar && <Alert tom="info">{AVISO_DAS_SECOES_SEM_CLASSIFICACAO}</Alert>}
+      {faltaClassificar && null}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Cobertura.tsx
teste: apps/web/src/areas/coordenacao/material/Cobertura.test.tsx › as séries carregando
-      {series.isPending ? (
+      {false ? (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Cobertura.tsx
teste: apps/web/src/areas/coordenacao/material/Cobertura.test.tsx › as séries com erro
-      ) : series.data === undefined ? (
+      ) : false ? (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Cobertura.tsx
teste: apps/web/src/areas/coordenacao/material/Cobertura.test.tsx › a escola sem série
-      ) : series.data.itens.length === 0 ? (
+      ) : series.data.itens.length === -1 ? (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Cobertura.tsx
teste: apps/web/src/areas/coordenacao/material/Cobertura.test.tsx › lista as séries da escola
-          {serieId === '' ? <p className="t-apoio text-apoio">Escolha uma série para ver as habilidades que ainda não têm material.</p> : <CoberturaDaSerie key={serieId} serieId={serieId} />}
+          {serieId !== '' ? <p className="t-apoio text-apoio">Escolha uma série para ver as habilidades que ainda não têm material.</p> : <CoberturaDaSerie key={serieId} serieId={serieId} />}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Material.tsx
teste: apps/web/src/areas/coordenacao/material/Cobertura.test.tsx › `?aba=cobertura` abre a Cobertura
-  return aba === 'licencas' || aba === 'cobertura' ? aba : 'materiais'
+  return aba === 'cobertura' ? aba : 'materiais'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Material.tsx
teste: apps/web/src/areas/coordenacao/material/Cobertura.test.tsx › `?aba=cobertura` abre a Cobertura
-  return aba === 'licencas' || aba === 'cobertura' ? aba : 'materiais'
+  return aba === 'licencas' ? aba : 'materiais'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Material.tsx
teste: apps/web/src/areas/coordenacao/material/Cobertura.test.tsx › a aba "Cobertura" existe
-      aoMudar={(id) => navegar(enderecoComParametro(caminho, busca, ABA_DO_MATERIAL_PARAM, id === 'licencas' || id === 'cobertura' ? id : undefined), { replace: true })}
+      aoMudar={(id) => navegar(enderecoComParametro(caminho, busca, ABA_DO_MATERIAL_PARAM, id === 'cobertura' ? id : undefined), { replace: true })}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Material.tsx
teste: apps/web/src/areas/coordenacao/material/Cobertura.test.tsx › a aba "Cobertura" existe
-      aoMudar={(id) => navegar(enderecoComParametro(caminho, busca, ABA_DO_MATERIAL_PARAM, id === 'licencas' || id === 'cobertura' ? id : undefined), { replace: true })}
+      aoMudar={(id) => navegar(enderecoComParametro(caminho, busca, ABA_DO_MATERIAL_PARAM, id === 'licencas' ? id : undefined), { replace: true })}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Material.tsx
teste: apps/web/src/areas/coordenacao/material/Cobertura.test.tsx › a aba "Cobertura" existe
-      {ativa === 'licencas' ? <Licencas /> : ativa === 'cobertura' ? <Cobertura /> : <MateriaisDaEscola />}
+      {false ? <Licencas /> : ativa === 'cobertura' ? <Cobertura /> : <MateriaisDaEscola />}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Material.tsx
teste: apps/web/src/areas/coordenacao/material/Cobertura.test.tsx › a aba "Cobertura" existe
-      {ativa === 'licencas' ? <Licencas /> : ativa === 'cobertura' ? <Cobertura /> : <MateriaisDaEscola />}
+      {ativa === 'licencas' ? <Licencas /> : false ? <Cobertura /> : <MateriaisDaEscola />}
```

```mutacao
arquivo: apps/api/src/material/cobertura.repository.ts
teste: apps/api/test/cobertura.int.test.ts › o material de que a escola ainda não pode ou não deve se valer
     eq(material.escolaId, requireEscolaId()),
-    eq(material.estado, 'pronto'),
```

```mutacao
arquivo: apps/api/src/material/cobertura.repository.ts
teste: apps/api/test/cobertura.int.test.ts › a série sem material lista todas as habilidades
     eq(material.estado, 'pronto'),
-    isNull(material.excluidoEm),
```

```mutacao
arquivo: apps/api/src/material/cobertura.repository.ts
teste: apps/api/test/cobertura.int.test.ts › `EF69LP01` num material só do 6º
     isNull(material.excluidoEm),
-    declaradoParaASerie(banco, serieId),
```

```mutacao
arquivo: apps/api/src/material/cobertura.repository.ts
teste: apps/api/test/cobertura.int.test.ts › o material de que a escola ainda não pode ou não deve se valer
     declaradoParaASerie(banco, serieId),
-    proprioOuComLicencaVigente(banco, hoje),
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/cobertura.int.test.ts › no Médio a cobertura é por área
-    const codigosCobertos = new Set(cobertas.filter(({ componente, codigo }) => habilidadeEhCandidata(codigo, componente, [recorte])).map(({ codigo }) => codigo))
+    const codigosCobertos = new Set(cobertas.map(({ codigo }) => codigo))
```

```mutacao
arquivo: apps/api/src/material/cobertura.repository.ts
teste: apps/api/test/cobertura.int.test.ts › no Médio a cobertura é por área
-        grupo: sql<GrupoDaCobertura>`coalesce(${habilidadeBncc.area}, ${habilidadeBncc.componente})`,
+        grupo: sql<GrupoDaCobertura>`coalesce(${habilidadeBncc.componente}, ${habilidadeBncc.area})`,
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/material/Cobertura.tsx
teste: apps/web/src/areas/coordenacao/material/Cobertura.test.tsx › no Médio o grupo é a área
-    <section aria-label={`${etapa === 'em' ? 'Área' : 'Componente'}: ${nome}`} className="flex min-w-0 flex-col gap-2 rounded-cartao border-2 border-borda bg-superficie p-4">
+    <section aria-label={`${false ? 'Área' : 'Componente'}: ${nome}`} className="flex min-w-0 flex-col gap-2 rounded-cartao border-2 border-borda bg-superficie p-4">
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/cobertura.int.test.ts › a série sem material lista todas as habilidades
-    const ordenados = [...grupos.values()].sort((a, b) => nomeDoGrupoDaCobertura(a.chave, recorte.etapa).localeCompare(nomeDoGrupoDaCobertura(b.chave, recorte.etapa), 'pt-BR'))
+    const ordenados = [...grupos.values()]
```

```mutacao
arquivo: apps/api/src/material/material.service.ts
teste: apps/api/test/cobertura.int.test.ts › a série sem material lista todas as habilidades
-    const ordenados = [...grupos.values()].sort((a, b) => nomeDoGrupoDaCobertura(a.chave, recorte.etapa).localeCompare(nomeDoGrupoDaCobertura(b.chave, recorte.etapa), 'pt-BR'))
+    const ordenados = [...grupos.values()].sort((a, b) => nomeDoGrupoDaCobertura(b.chave, recorte.etapa).localeCompare(nomeDoGrupoDaCobertura(a.chave, recorte.etapa), 'pt-BR'))
```

## Telas vistas

Por mim, em computador (1366 × 768) e celular (360 px), com a série do 7º ano escolhida, numa escola sintética do ambiente de teste: a aba Cobertura com o seletor "Série", o aviso de capítulos ainda sem classificação e o primeiro grupo (Arte, 35 de 35 habilidades sem material, com o código e a descrição de cada uma). As duas fotos saíram do próprio spec de e2e (`page.screenshot`, no fim de `paginaNaoRola`), pelo mesmo caminho do teste. Não rodei a vitrine: ela só escolhe a série por clique, e o spec já a escolhe.

## Recomendações sem aplicar

**Rodada 1** (`.processo/ordens/13_task-r1.md`):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian (1ª), conformidade-reviewer (1ª) | Um caso de rota com sessão de `rede` em `cobertura.int.test.ts` | Recusada. O suporte do teste emite sessão por papel de pessoa da escola (`bancada.sessao(escolaId, papel)`, `apps/api/test/sessao.fixture.ts:120`), e a rede não entra por ali. A prova que a regra 10, item 8 pede é a matriz: `packages/shared/src/permissao/matriz.test.ts:172-173` (a rede nunca alcança `material.resumir`), que a tarefa já cita |
| privacy-guardian (1ª) | Escrever "nenhum título de material" no docblock de `grupoDaCoberturaSchema`, conferido por teste | Recusada: já há teste que confere o contrato. `cobertura.int.test.ts` compara as chaves da resposta (`['classificacaoSuspensa', 'etapa', 'grupos', 'materiaisEmUso', 'serieId']`) e `coberturaResponseSchema` é `strictObject`; título de material não passa nem pelo schema |
| frontend-reviewer (1ª) | Recolher a lista atrás de "Mostrar todas" perto das 300 habilidades | `TODO.md`, condicionada à medida em Chromebook: o `infra-guardian` calculou o maior grupo em cerca de 100 habilidades, e o schema corta em 300 |
| frontend-reviewer (1ª) | Foto da tela com a série escolhida e medida com throttling de CPU e de rede | Validador: ele fotografa cada requisito com tela no fim da spec. A vitrine só clica e não escolhe a opção do `select` nativo |
| frontend-reviewer (1ª) | Trocar o `aria-label` do grupo por `aria-labelledby` ao `h3` | Recusada: o nome da região ("Componente: Ciências", "Área: Ciências da Natureza") é o que `Cobertura.test.tsx:158-264`, o `grupoDe` do e2e (`e2e/material-cobertura.spec.ts:25`) e o axe (linha 142) consultam, e a distinção Componente/Área é o que o item 4 prova. Trocar muda o nome acessível e a prova |
| tenancy-guardian (1ª) | Caso que chame o repository num contexto da A com o `serieId` da B, para provar `eq(material.escolaId, requireEscolaId())` de `materialEmUso` | `TODO.md`. A outra alternativa que ele deu (dizer que a garantia é estrutural) entra pelo motivo do item 1 e pela linha do item 11 |
| tenancy-guardian (1ª) | Levar à retro que o escopo de `escola_id` sem teste que o mate depende só da revisão e da guarda `escopo-dos-repositories` | Retro da spec (D86): item para a pauta, sem mudança nesta tarefa |
| infra-guardian (1ª), test-engineer (1ª) | Estender o `EXPLAIN` a `secoesSemClassificacao` e a `materiaisEmUso`, no mesmo volume | `TODO.md`. `consultaDasCobertas` devolve o construtor da consulta e o teste lê o `.toSQL()` dele; `secoesSemClassificacao` e `materiaisEmUso` executam direto, e expor o `.toSQL()` muda código de produção (e as mutações) |
| infra-guardian (1ª) | Conferir a espera do pool quando o `Promise.all` das quatro consultas entrar num cenário de carga | `TODO.md`, junto do item de `infra/scripts/carga-classificacao.ts` abaixo (R40, `observeDatabasePool`) |
| revisor-geral (1ª) | Mover três itens de "Divergências resolvidas" para "decisões de implementação" | Recusada nesta tarefa: o título dessa seção é lido por `tools/processo/divergencias.ts` (`TITULO_DA_SECAO`), e não há seção "decisões de implementação" no modelo. Vai para a retro, como pergunta ao modelo do documento |
| revisor-geral (1ª) | `infra/scripts/carga-classificacao.ts` (`medirOsPlanos`) ainda mede a forma antiga da consulta | `TODO.md`, item novo, com dono: o script ler o `.toSQL()` de `CoberturaRepository.consultaDasCobertas`, para o cenário da carga medir a mesma consulta que o teste de integração |
| test-engineer (1ª) | O e2e da resposta atrasada (`e2e/material-cobertura.spec.ts:173-195`): o `signal` do `queryFn` provavelmente aborta a leitura do 6º, e o `.catch(() => undefined)` engole o aborto | `TODO.md`. O caso é medido contra 15 s no portão e já passou três versões do outro caso no limite; afirmar se a leitura terminou ou foi abortada pede conferir o `signal` em `api/cobertura.ts` e muda o caso por inteiro |

## Depois de aplicar
- Cada cláusula nova ganha o seu bloco em "Mutações" (os itens 1 a 4 e o 8); o termo `eq(material.escolaId, requireEscolaId())` do item 1 entra em "Sem bloco, com o motivo", com o termo exato entre crases
- Escreva em `TODO.md` as linhas dos destinos acima (recolher a lista; caso do repository com a série da B; `EXPLAIN` das outras duas consultas; espera do pool e `carga-classificacao.ts`; e2e da resposta atrasada)
- Rode o teste de cada item isolado, até ficar verde, e depois o portão da tarefa, uma vez:
  `node tools/processo/portao-local.ts --tarefa tasks/prd-classificacao-bncc/13_task.md`
- Peça rodada nova à Mesa. Mudou código de `apps/web` (o subtítulo): o `frontend-reviewer` e os outros caducam junto com o `test-engineer`, e a Mesa fotografa de novo

**Rodada 2** (`.processo/ordens/13_task-r2.md`):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (2ª) | A tabela de cenários e o "Sem bloco, com o motivo" citam `o plano da consulta no volume do cenário da carga`, e esse nome "não existe"; o caso de hoje é `a consulta das cobertas entra pelos índices…` | Recusada: o nome citado é o título do `describe` (`apps/api/test/cobertura.int.test.ts:500`), que contém o caso da linha 501; o portão rodou as mutações dos blocos que o citam e elas ficaram vermelhas por esse caso. Citar o `describe` é o padrão dos outros blocos |
| revisor-geral (2ª) | O subtítulo da Cobertura diz "em Material", e a pessoa já está numa aba de Material; "na aba Materiais, no painel do material" diria onde clicar | Recusada: texto de tela que o `conformidade-reviewer` (regra 70, item 4a) e o `frontend-reviewer` aprovaram nesta rodada; "Material" é o nome do item de navegação (Escola › Material). Sem exigência, e a Mesa não dita texto |
| revisor-geral (2ª) | O comentário "excluído um, o outro ainda o cobre" (`cobertura.int.test.ts:191`) repete a asserção de baixo e pode sair | Não aplicada: só comentário de teste, sem efeito. Sai na próxima tarefa que tocar `cobertura.int.test.ts` |
| test-engineer (2ª) | O bloco do `coalesce` invertido fica vermelho por outro caminho: o `EM13LP*` vira `lingua_portuguesa` numa série do Médio, `nomeDoGrupoDaCobertura` devolve `undefined` para a chave, o `localeCompare` do `sort` quebra, e a rota responde 500; quem falha é o `expect(resposta.status).toBe(200)` de `coberturaDe`, e não o `toEqual` dos grupos. Corrigir o texto da pergunta 1 da Autoconferência, ou tratar a chave fora do recorte | `TODO.md`, uma linha só, dono: a próxima tarefa que mexer em `material.service.ts` ou em `packages/shared/src/material/cobertura.ts`. O vermelho é de um caso que rodou e falhou, e o portão o aceitou; o código de produção não tem a chave fora do recorte (o `coalesce` é o certo) |
| test-engineer (2ª) | A primeira linha do bloco do `escolaId` fala em "três caminhos que se repetem", e o `materialEmUso` deixou de valer por si só para o termo da escola | `TODO.md`, junto da linha acima: acertar o texto do motivo ao reler o documento. Não muda código nem prova |
| frontend-reviewer (2ª) | Fotografar a tela com a série escolhida (`--clicar`), para a validação ver os grupos e o aviso de capítulos sem classificação a 360 px | Validador, que fotografa cada requisito com tela no fim da spec. O `select` nativo não se escolhe pelo `foto` da vitrine |
| frontend-reviewer (2ª) | Se a tela passar a exibir a classificação por capítulo, o selo de IA deve ir junto | Recusada para esta tarefa: a tela mostra só códigos, descrições e contagens, e o subtítulo diz que a classificação é da IA. Fica de condição para a tarefa que mostrar a classificação por capítulo |
| frontend-reviewer (2ª) | Recolher a lista atrás de "Mostrar todas" quando o Chromebook da F4b for medido | Já está no `TODO.md` (1ª rodada) |
| infra-guardian (2ª), tenancy-guardian (2ª), privacy-guardian (2ª) | O `carga-classificacao.ts`, a espera do pool, o e2e da resposta atrasada e o caso de `materialEmUso` com a série da B | Já estão no `TODO.md`, com dono (1ª rodada) |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-20 08:52:29 | 2026-11-20 08:53:03 | `privacy-guardian` | 1 | APROVADO | a0adc9929555c1215 |
| 2026-11-20 08:52:36 | 2026-11-20 08:53:06 | `frontend-reviewer` | 1 | APROVADO | a83b38fd388886be7 |
| 2026-11-20 08:52:24 | 2026-11-20 08:53:09 | `tenancy-guardian` | 1 | APROVADO | a111c238ec32e37e6 |
| 2026-11-20 08:52:27 | 2026-11-20 08:53:13 | `infra-guardian` | 1 | APROVADO | ad43f8ded5e22ee8a |
| 2026-11-20 08:52:32 | 2026-11-20 08:53:16 | `conformidade-reviewer` | 1 | APROVADO | a7eb528205e17274f |
| 2026-11-20 08:52:22 | 2026-11-20 08:53:23 | `revisor-geral` | 1 | APROVADO | a44fc20f887e1b101 |
| 2026-11-20 08:52:20 | 2026-11-20 08:55:41 | `test-engineer` | 1 | REPROVADO | a5bedd57812d3ffe0 |
| 2026-11-20 09:26:58 | 2026-11-20 09:27:14 | `tenancy-guardian` | 2 | APROVADO | a60cbf54abea5ef80 |
| 2026-11-20 09:27:03 | 2026-11-20 09:27:18 | `infra-guardian` | 2 | APROVADO | a164719c6b41c091c |
| 2026-11-20 09:27:08 | 2026-11-20 09:27:29 | `privacy-guardian` | 2 | APROVADO | a3a9233342675c85e |
| 2026-11-20 09:27:13 | 2026-11-20 09:27:30 | `conformidade-reviewer` | 2 | APROVADO | a223165550d187c77 |
| 2026-11-20 09:26:53 | 2026-11-20 09:27:30 | `revisor-geral` | 2 | APROVADO | af323b26085608505 |
| 2026-11-20 09:27:21 | 2026-11-20 09:27:42 | `frontend-reviewer` | 2 | APROVADO | a0d958cae7a526054 |
| 2026-11-20 09:26:48 | 2026-11-20 09:27:54 | `test-engineer` | 2 | APROVADO | a4ce9d24fa89a5ef1 |
