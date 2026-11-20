# Tarefa 11.0 — O professor troca a habilidade da questão no artefato, com a trava que aplicar e adaptar também tomam

**Funcionalidade:** classificacao-bncc · **Depende de:** 10.0
**Subagentes obrigatórios:** `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian`, `frontend-reviewer`
**Porte:** grande

## Objetivo

No artefato dele, antes de aplicar, o professor vê a habilidade de cada questão com o capítulo e a troca por outra do
recorte (ou por nenhuma); a base da classificação não muda; aplicar e adaptar tomam a mesma trava, e a troca depois disso
recebe `CONFLITO`.

## Contexto necessário

- `techspec.md` §4 (o `PATCH` da questão, `artefatoId`, a ordem, os tetos), §5 "Troca" e "Suspensão", §9
- `prd.md` RF9
- `cenarios.md` "Troca pelo professor", "Telas" (artefato); P6a, P6b, P7, P8
- `docs/interface.md` §1 (o artefato aberto)
- `.claude/rules/`: 10, 50, 70, 80
- Código: `apps/api/src/artefato/artefato.repository.ts` (`porId`, sem trava hoje), `artefato.service.ts`,
  `adaptacao.command.ts`, `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts`
  (`artefatoParaAplicar`, sem trava no artefato); `apps/web/src/areas/professor/artefatos/ConteudoDoArtefato.tsx` (a
  habilidade, linhas 71-72); o seletor da 8.0 em `apps/web/src/components/habilidades/`

## Subtarefas

- [ ] 11.1 — O `PATCH`, como a §5 "Troca"; `artefato.habilidade_trocada`; teto 100/300
- [ ] 11.2 — Aplicar e adaptar tomam o `for update` no artefato primeiro
- [ ] 11.3 — A tela: a habilidade com o capítulo, "Sem habilidade", "Trocar" com o seletor (as do capítulo primeiro; com a função suspensa, sem a prioridade das `origem: 'ia'`), desabilitado depois da aplicação com o motivo; a Parte A no `docs/interface.md`
- [ ] 11.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/test/troca-de-habilidade.int.test.ts`, `apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.tsx`, `apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx`, `e2e/professor-troca-de-habilidade.spec.ts` | novo |
| `packages/shared/src/assistente/artefato.ts`, `packages/core/src/auditoria/acoes.ts`, `apps/api/src/artefato/artefato.controller.ts`, `apps/api/src/artefato/artefato.service.ts`, `apps/api/src/artefato/artefato.repository.ts`, `apps/api/src/artefato/adaptacao.command.ts`, `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts`, `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts`, `apps/web/src/areas/professor/artefatos/ConteudoDoArtefato.tsx`, `apps/web/src/areas/professor/artefatos/api/artefatos.ts`, `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| troca | I | o diagnóstico usa a trocada; `habilidade_da_secao` intacta; `artefato.habilidade_trocada`, sem título | `troca-de-habilidade.int.test.ts` › "muda a habilidade só da questão pedida…" (a base intacta, a auditoria sem título) e "o diagnóstico usa a trocada…" (a atividade aplicada depois resume pelo código novo) |
| sem componente | I | só `null` aceito | `troca-de-habilidade.int.test.ts` › "só `null` vale na disciplina sem componente da BNCC…" |
| coordenação no `PATCH` | I | recusada | `troca-de-habilidade.int.test.ts` › "a coordenação e o aluno não alcançam a rota (a rede, que só lê agregado, está na matriz de permissão)…"; a rede e as demais, em `matriz.test.ts` |
| aplicado; com versão adaptada | I | `CONFLITO`, um caso cada | `troca-de-habilidade.int.test.ts` › "o artefato já aplicado é `CONFLITO`…" e "o artefato com versão adaptada…é `CONFLITO`…" |
| de outro professor da escola | I | `NAO_ENCONTRADO`, nunca `CONFLITO` | `troca-de-habilidade.int.test.ts` › "o artefato de outro professor da escola…é `NAO_ENCONTRADO`, nunca `CONFLITO`…" |
| artefato da B | I | `NAO_ENCONTRADO`. Mutação: tirar `escola_id` | `troca-de-habilidade.int.test.ts` › "o artefato da outra escola, e o inexistente, respondem igual…". A mutação de `escola_id` não deixa vermelho por si: o `recorteDoArtefato` (7.0) já filtra a escola antes da trava, e a cláusula de `lockParaTrocar` é defesa em profundidade (motivo na seção "Mutações") |
| código de outra disciplina do mesmo professor na mesma turma | I | `ENTRADA_INVALIDA` | `troca-de-habilidade.int.test.ts` › "o código de outra disciplina da mesma professora na mesma turma…é `ENTRADA_INVALIDA`…" |
| índice de questão inexistente | I | recusado sem gravar | `troca-de-habilidade.int.test.ts` › "o índice de questão que a atividade não tem, o plano de aula e o corpo com campo a mais…" |
| 101º da pessoa; 301º da escola | I | 429 | `troca-de-habilidade.int.test.ts` › "a 101ª troca da pessoa recebe 429…" e "a 301ª troca da escola recebe 429…" |
| função suspensa | I | as `origem: 'ia'` não valem na troca | `troca-de-habilidade.int.test.ts` › "o artefato diz o capítulo de cada questão…e a suspensão da função" e "a lista da troca…é a mesma com a função suspensa…" (a API entrega a suspensão e a lista inteira; a prioridade é da tela, provada na linha "lista da troca") |
| P6a | P | aplicar espera e aplica com a trocada. Mutação: tirar a trava da aplicação | `troca-de-habilidade.int.test.ts` › "P6a: a troca que chegou primeiro segura o artefato…" |
| P6b | P | a troca espera e recebe `CONFLITO`. Mutação: tirar a trava da troca | `troca-de-habilidade.int.test.ts` › "P6b: a aplicação que chegou primeiro segura o artefato…" |
| P7 | P | as duas trocas ficam. Mutação: tirar o `for update` | `troca-de-habilidade.int.test.ts` › "P7: duas trocas de questões diferentes ao mesmo tempo ficam as duas…" |
| P8 | P | a troca espera e recebe `CONFLITO`. Mutação: tirar a trava da adaptação | `troca-de-habilidade.int.test.ts` › "P8 (parada %s do insert): a adaptação que chegou primeiro segura o artefato…" (um caso para a parada `before` e outro para a `after`: só a `before` deixa a trava explícita da adaptação observável) e "a troca que chegou antes da adaptação vale na versão…" |
| tela: carregando; erro da troca; habilidade com o capítulo; "Sem habilidade"; depois da aplicação | U | um caso cada; "Trocar" desabilitado, com o motivo | `TrocaDeHabilidade.test.tsx` › "carregando: o texto de espera…", "erro da troca: a frase curta…", "diz o código, o texto e o capítulo…", "a questão sem habilidade diz \"Sem habilidade\"…" e "o artefato aplicado (ou com versão adaptada) desliga o \"Trocar\" e diz por quê…" |
| tela: `CONFLITO`; 429; sem componente no seletor | U | os textos | `TrocaDeHabilidade.test.tsx` › "`CONFLITO`: diz que a atividade já foi aplicada…", "429: diz em quantos minutos tentar de novo…" e "sem componente na disciplina: o seletor diz que a questão fica sem habilidade…" |
| lista da troca; com a função suspensa | U | as do capítulo primeiro; sem prioridade às `origem: 'ia'` | `TrocaDeHabilidade.test.tsx` › "a lista põe as habilidades do capítulo da questão primeiro…" e "com a função suspensa, a sugestão da IA não tem prioridade…" |
| artefato | E | `paginaNaoRola` (no computador), o "Trocar" sem fundo (não é ação cheia: o spec confere o botão, não conta as ações da tela), `VOCABULARIO_DE_NOTA` | `professor-troca-de-habilidade.spec.ts` › "a questão diz a habilidade com o capítulo e \"Sem habilidade\"…" (o botão "Trocar" não é cheio; o vocabulário de nota e o "seção" não aparecem; a página não rola no computador) e "escolher a habilidade troca na hora e devolve o foco ao \"Trocar\"…" (o foco volta ao botão; "Deixar sem habilidade" tira; só a questão pedida muda). Os dois são casos à parte porque o prazo do caso de e2e é de 15 s nesta máquina |
| 360 px; alvo de 24 px; 44 px na ação principal | E | `chromebook` e `celular`, axe | o mesmo caso, nos dois projetos: sem rolagem de lado, alvo de 24 px em todo controle, 44 px em "Deixar sem habilidade" e no "Trocar" no celular, `seriousViolations` vazio |
| teclado | E | o seletor abre, filtra e fecha; foco devolvido | `professor-troca-de-habilidade.spec.ts` › "o teclado: o seletor abre com o foco no filtro, filtra…e o Esc o fecha devolvendo o foco…" |
| recomeço: segunda pessoa; mesmo artefato reaberto; `PATCH` segurado e troca de questão; falha com o seletor aberto | E | um caso cada | `professor-troca-de-habilidade.spec.ts` › "recomeço: a professora seguinte entra na mesma aba…", "recomeço: o mesmo artefato reaberto…", "o `PATCH` no ar: a professora abre o seletor da outra questão…" e "o `CONFLITO`…o 429 e a falha dizem a frase curta e deixam o seletor aberto…" |

## Como testar

- Aplicar em paralelo: `apps/api/src/atividade/atividade.int.test.ts` › "a mesma atividade aberta duas vezes na mesma turma é CONFLITO, e dois cliques ao mesmo tempo gravam uma aplicação e uma auditoria"
- Adaptar: `apps/api/src/artefato/artefato.int.test.ts` › "a saída que muda o gabarito é recusada…"
- Ordem forçada: `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`), esperando o processo certo (autoconferência 10, b)
- Tela: `Artefato.test.tsx` › "com dado: o título, a linha de dados, a assinatura da IA e a folha…"
- e2e: `gerarAtividade` e `montarEscolaEEntrar` (`e2e/support/professor-flow.ts`); `paginaNaoRola` (`e2e/support/coordenacao.ts`)
- `npx vitest run --project integracao apps/api/test/troca-de-habilidade.int.test.ts`; `node tools/ci/e2e.ts --manter-ambiente e2e/professor-troca-de-habilidade.spec.ts`
- Telas: `professora`, `/professor/artefatos/<id>`, a questão com "Trocar" aberto

## Autoconferência

As 12 perguntas do modelo, no plano. Na 9: o seletor é o da 8.0, importado.

1. **Mutação de cada cláusula:** a seção "Mutações" abaixo, um bloco por cláusula do diff (os tetos de 100 e de 300, a ordem lock → recorte → `ENTRADA_INVALIDA` → `CONFLITO`, o `for update` da troca, da aplicação e da adaptação, a reconstrução da questão só no índice pedido, a leitura do capítulo por `materialId:pagina`, a prioridade do capítulo e da `origem`, o `disabled` do "Trocar", o foco devolvido, as chaves da `queryKey`). O que não ganha bloco leva o motivo na própria seção: é cláusula de escopo que o `recorteDoArtefato` (7.0) já aplica antes, ou ramo que só o e2e do `PATCH` segurado alcança.
2. **O texto novo já aparece na tela:** "Trocar a habilidade da questão N", "Sem habilidade", "Capítulo N · título (Páginas X a Y)" e o motivo do "Trocar" desligado são novos; `grep -rln` em `e2e/` mostra que só o spec novo os cita, e os specs que contam as questões do artefato (`professor-artefato.spec.ts`, `artefato-fontes.spec.ts`, `a2-assistente.spec.ts`) rodam isolados antes do portão.
3. **O segundo dado que torna a cláusula observável:** o recorte tem duas disciplinas da mesma professora na mesma turma (a troca por código da outra é `ENTRADA_INVALIDA`), duas escolas (A e B), duas questões (a troca só muda a pedida), três estados do artefato (solto, aplicado, com versão adaptada) e duas pessoas na mesma escola (o teto de 100 por pessoa e o de 300 por escola se separam).
4. **Checagem anterior que responde antes da regra:** a ordem da Tech Spec é a do teste (404 antes de 400 antes de 409), e cada caso de recusa chega à sua linha: `CONFLITO` só com o código válido e dentro do recorte; o 429 antes do corpo (o corpo do caso é inválido de propósito, para provar que o teto vem antes); a condição (aplicação, versão) é criada pelo caso, não herdada de fixture.
5. **A asserção olha o resultado:** lê a linha do banco depois da troca (a questão certa mudou, as outras não, a `habilidade_da_secao` igual à de antes) e o que a tela mostra, não o texto do código. A ausência na tela (`not.toContain`, `toHaveCount(0)`) só vem depois do `findBy` do positivo na mesma cena.
6. **Guarda nova:** nenhuma regra de lint, teste estrutural nem trava de pasta. A guarda de arquitetura já cobre a tabela só no repository; `repositories-com-escopo` roda isolada.
7. **Comentário ou nota que afirma o que o código não faz:** conferidos o docblock de `trocarHabilidade`, o de `lockParaTrocar`, `docs/interface.md` (Parte A), `docs/mvp-contratos.md` e `docs/lgpd.md` (a ação `artefato.habilidade_trocada` e o que ela guarda: índice e código, sem título nem texto); nome de rota, ação e constante saiu de `grep` na árvore.
8. **A divergência cria regra?** Uma: a leitura do artefato ganhou `secoesDasQuestoes` e `classificacaoSuspensa` (o capítulo da questão e a suspensão não vinham da API); está em "Divergências resolvidas", com a linha na tabela de testes (a leitura) e a resposta do `privacy-guardian` (sem `corrigida_por` nem `execucao_id`, só código e origem). O `prd.md` (RF9) não diz o contrário.
9. **Peça que já existe:** o seletor é o da 8.0 (`SeletorDeHabilidades`), importado; o nome do capítulo e a frase do 429 foram para `components/habilidades/nome-da-secao.ts` e a coordenação os reexporta (não há cópia); `recorteDoArtefato` e `habilidadeEhCandidata` são da 7.0; a contagem do teto usa `AuditoriaRepository.countDaEscolaEDaPessoaDesde`; a corrida usa `WriteBlockTrigger` e `esperarNaTrava`.
10. **Operação simultânea com ordem forçada:** P6a, P6b, P7 e P8 seguram um lado com `WriteBlockTrigger` e esperam o processo certo com `esperarNaTrava` (o padrão `'%"artefato"%"entrega"%for update%'` só o lado da aplicação casa; `'%"artefato"%for update%'` serve à troca e à adaptação); nenhum usa `Promise.all` solto. Na tela, o `PATCH` segurado com `gate()` e a troca de questão no ar.
11. **Isolamento e coluna "Caso":** no caso de isolamento todo id é da B, lido no contexto da A; a coluna "Caso" está preenchida, um caso por coisa que a linha diz (a linha "troca" tem dois: a base intacta e o diagnóstico).
12. **"O que verificar" dos guardiões e o `achados/indice.md`:** lidas as linhas da 7.0, 8.0 e 10.0 que tocam o artefato e o seletor (a falta de `lock` na aplicação, a lista vazia que vira `or(undefined)`, a divergência registrada só na tarefa e não nos `cenarios.md`); o plano atende: a trava vem antes de qualquer leitura da questão, `paginas.length === 0` volta cedo, e a divergência desta tarefa vai também para o `cenarios.md` (ver "Divergências resolvidas").

## Fora do escopo desta tarefa

As outras leituras e o e2e do fluxo (12.0).

## Divergências resolvidas nesta tarefa

| O que mudou | Por quê | Onde está na spec |
|---|---|---|
| `GET /v1/artefatos/:id` ganhou `secoesDasQuestoes` e `classificacaoSuspensa` | A tela precisa do capítulo de cada questão e da suspensão, e a §4 não os trazia na leitura do artefato (só `GET /v1/habilidades-bncc` e o `PATCH`). Sem eles, a tela teria de adivinhar o capítulo ou pedir o material inteiro | `techspec.md` §4 (linha nova do `GET /v1/artefatos/:id`) e `cenarios.md` "Troca pelo professor" (a linha da leitura) |
| `apps/api/src/atividade/atividade.int.test.ts` teve uma expectativa alinhada | Estava vermelha desde a 10.0: os códigos do fixture mudaram (catálogo próprio → BNCC) e a expectativa citava os antigos; a regra que o caso prova não mudou | `10_task.md` (a troca do catálogo) |

## Mutações

`--faltando: 10 linhas (92 blocos, 22 motivos)`. As 10 que o comando ainda lista são as de linha sem termos (um ternário, um `??` ou uma guarda que poupa consulta), cada uma com o motivo no fim da seção: a saída é a mesma sem elas, e nenhum teste pode ficar vermelho (mutante equivalente). Os 22 termos de linha com vários termos têm cada um o motivo escrito, com a crase igual ao termo. Todo bloco foi rodado à parte com o runner do portão (`conferirMutacoes`) e deixou vermelho um caso que rodou e falhou; os que ficaram verdes na primeira corrida (P8 sem a trava da adaptação, o artefato solto ao lado de um aplicado, a questão sem habilidade, a isca de outro artefato, o `PATCH` no ar, a releitura segurada, o `CONFLITO` com a releitura a caminho, o `NAO_ENCONTRADO`, o segundo material da escola) ganharam o caso que os derruba. O nome do caso em `teste:` vai sem parênteses nem `.` de regex, porque o `-t` do Vitest o lê como expressão regular.

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › a 101ª troca da pessoa
-    if (feitas.doUsuario >= TROCAS_POR_USUARIO_NA_JANELA || feitas.daEscola >= TROCAS_POR_ESCOLA_NA_JANELA) throw new DomainException(ErrorCode.LIMITE_EXCEDIDO, undefined, JANELA_DA_TROCA_DE_HABILIDADE_MS / 1_000)
+    if (feitas.daEscola >= TROCAS_POR_ESCOLA_NA_JANELA) throw new DomainException(ErrorCode.LIMITE_EXCEDIDO, undefined, JANELA_DA_TROCA_DE_HABILIDADE_MS / 1_000)
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › a 301ª troca da escola
-    if (feitas.doUsuario >= TROCAS_POR_USUARIO_NA_JANELA || feitas.daEscola >= TROCAS_POR_ESCOLA_NA_JANELA) throw new DomainException(ErrorCode.LIMITE_EXCEDIDO, undefined, JANELA_DA_TROCA_DE_HABILIDADE_MS / 1_000)
+    if (feitas.doUsuario >= TROCAS_POR_USUARIO_NA_JANELA) throw new DomainException(ErrorCode.LIMITE_EXCEDIDO, undefined, JANELA_DA_TROCA_DE_HABILIDADE_MS / 1_000)
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › o artefato da outra escola, e o inexistente
       const alvo = await artefatos.lockParaTrocar(id)
-      if (alvo === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
+      if (alvo === undefined) throw new DomainException(ErrorCode.CONFLITO)
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › o índice de questão que a atividade não tem
-      if (conteudo.tipo !== 'atividade_objetiva' || indice >= conteudo.questoes.length) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
+      if (conteudo.tipo !== 'atividade_objetiva') throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › o índice de questão que a atividade não tem
-      if (conteudo.tipo !== 'atividade_objetiva' || indice >= conteudo.questoes.length) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
+      if (indice >= conteudo.questoes.length) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › só `null` vale na disciplina sem componente
-      if (codigo !== null && (recorte.componente === null || !habilidadeEhCandidata(codigo, recorte.componente, recorte.series))) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
+      if (codigo !== null && (!habilidadeEhCandidata(codigo, recorte.componente ?? 'x', recorte.series))) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › o código de outra disciplina da mesma professora
-      if (codigo !== null && (recorte.componente === null || !habilidadeEhCandidata(codigo, recorte.componente, recorte.series))) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
+      if (codigo !== null && (recorte.componente === null)) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › troca por nenhuma
-      if (codigo !== null && (recorte.componente === null || !habilidadeEhCandidata(codigo, recorte.componente, recorte.series))) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
+      if ((recorte.componente === null || !habilidadeEhCandidata(codigo ?? '', recorte.componente, recorte.series))) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › o artefato com versão adaptada
-      if (alvo.origemId !== null || (await artefatos.hasAplicacaoOuVersao(id))) throw new DomainException(ErrorCode.CONFLITO)
+      if (await artefatos.hasAplicacaoOuVersao(id)) throw new DomainException(ErrorCode.CONFLITO)
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › o artefato já aplicado é
-      if (alvo.origemId !== null || (await artefatos.hasAplicacaoOuVersao(id))) throw new DomainException(ErrorCode.CONFLITO)
+      if (alvo.origemId !== null) throw new DomainException(ErrorCode.CONFLITO)
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › muda a habilidade só da questão pedida
-      const questoes = conteudo.questoes.map((questao, posicao) => (posicao === indice ? { ...questao, habilidade: codigo === null || descricao === undefined ? null : { codigo, descricao } } : questao))
+      const questoes = conteudo.questoes.map((questao, posicao) => (posicao >= indice ? { ...questao, habilidade: codigo === null || descricao === undefined ? null : { codigo, descricao } } : questao))
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › muda a habilidade só da questão pedida
-      const questoes = conteudo.questoes.map((questao, posicao) => (posicao === indice ? { ...questao, habilidade: codigo === null || descricao === undefined ? null : { codigo, descricao } } : questao))
+      const questoes = conteudo.questoes.map((questao, posicao) => (posicao === indice ? { ...questao, habilidade: codigo === null || descricao === undefined ? null : { codigo, descricao: codigo } } : questao))
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › troca por nenhuma
-        antes: { indice, codigo: antes !== null && daLista(antes.codigo) ? antes.codigo : null, legado: antes !== null && !daLista(antes.codigo) },
+        antes: { indice, codigo: antes !== null && daLista(antes.codigo) ? antes.codigo : null, legado: false },
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › muda a habilidade só da questão pedida
-        antes: { indice, codigo: antes !== null && daLista(antes.codigo) ? antes.codigo : null, legado: antes !== null && !daLista(antes.codigo) },
+        antes: { indice, codigo: null, legado: antes !== null && !daLista(antes.codigo) },
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › o artefato diz o capítulo de cada questão
-  if (conteudo.tipo !== 'atividade_objetiva') return []
+  if (conteudo.tipo !== 'atividade_objetiva') return [null]
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › o artefato diz o capítulo de cada questão
-      classificacaoSuspensa,
+      classificacaoSuspensa: false,
```

```mutacao
arquivo: apps/api/src/artefato/artefato.controller.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › a 101ª troca da pessoa
-  @UseGuards(ArtefatoTrocarHabilidadeGuard)
+  @Header('X-Sem-Teto', 'sim')
```

```mutacao
arquivo: apps/api/src/artefato/artefato.controller.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › o índice de questão que a atividade não tem
-    @Param('indice', new ZodValidationPipe(indiceDaQuestaoSchema, { errorCode: ErrorCode.NAO_ENCONTRADO })) indice: number,
+    @Param('indice', new ZodValidationPipe(indiceDaQuestaoSchema, { errorCode: ErrorCode.ENTRADA_INVALIDA })) indice: number,
```

```mutacao
arquivo: apps/api/src/artefato/artefato.repository.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › P6b
       .where(and(this.#noAlcance(), eq(artefato.id, id), eq(artefato.criadoPor, requestSessao().usuarioId)))
-      .for('update', { of: artefato })
+      .limit(1)
```

```mutacao
arquivo: apps/api/src/artefato/artefato.repository.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › P7
       .where(and(this.#noAlcance(), eq(artefato.id, id), eq(artefato.criadoPor, requestSessao().usuarioId)))
-      .for('update', { of: artefato })
+      .limit(1)
```

```mutacao
arquivo: apps/api/src/artefato/artefato.repository.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › P8
-    const [linha] = await this.#lidos(eq(artefato.id, id)).for('update', { of: artefato })
+    const [linha] = await this.#lidos(eq(artefato.id, id))
```

```mutacao
arquivo: apps/api/src/artefato/adaptacao.command.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › P8
-    const origem = await new ArtefatoRepository(tx).porIdTravado(lido.artefatoId)
+    const origem = await new ArtefatoRepository(tx).porId(lido.artefatoId)
```

```mutacao
arquivo: apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › P6a
       )
-      .for('update', { of: artefato })
+      .limit(1)
```

```mutacao
arquivo: apps/api/src/artefato/artefato.repository.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › o artefato já aplicado é
-    if (aplicada !== undefined) return true
+    if (aplicada !== undefined) return false
```

```mutacao
arquivo: apps/api/src/artefato/artefato.repository.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › o artefato com versão adaptada
-    return versao !== undefined
+    return false
```

```mutacao
arquivo: apps/api/src/artefato/artefato.repository.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › de outro artefato não fecham a troca deste
-      .where(and(eq(atividadeAplicada.escolaId, escolaId), eq(atividadeAplicada.anoLetivoId, anoLetivoId), eq(atividadeAplicada.artefatoId, id)))
+      .where(and(eq(atividadeAplicada.escolaId, escolaId), eq(atividadeAplicada.anoLetivoId, anoLetivoId)))
```

```mutacao
arquivo: apps/api/src/artefato/artefato.repository.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › de outro artefato não fecham a troca deste
-      .where(and(eq(artefato.escolaId, escolaId), eq(artefato.anoLetivoId, anoLetivoId), eq(artefato.origemId, id)))
+      .where(and(eq(artefato.escolaId, escolaId), eq(artefato.anoLetivoId, anoLetivoId), isNotNull(artefato.origemId)))
```

```mutacao
arquivo: apps/api/src/artefato/artefato.repository.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › muda a habilidade só da questão pedida
-      .set({ conteudo, atualizadoEm: sql`now()` })
+      .set({ atualizadoEm: sql`now()` })
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › a página que o `jsonb` cita
falha: not.toContain('Capítulo secreto da B')
-          eq(secaoDoMaterial.escolaId, escolaId),
+          eq(secaoDoMaterial.escolaId, secaoDoMaterial.escolaId),
           eq(material.estado, 'pronto'),
           isNull(material.excluidoEm),
           or(...paginas.map((pagina) => and(eq(secaoDoMaterial.materialId, pagina.materialId), lte(secaoDoMaterial.paginaInicial, pagina.pagina), gte(secaoDoMaterial.paginaFinal, pagina.pagina)))),
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › a página que o `jsonb` cita
          eq(material.estado, 'pronto'),
-          isNull(material.excluidoEm),
+          eq(material.estado, 'pronto'),
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › o artefato diz o capítulo de cada questão
-      if (secao === undefined) continue
+      if (secao === undefined) throw new Error('sem seção')
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › o artefato diz o capítulo de cada questão
-        capitulo: secao.capituloTitulo === null ? null : { numero: secao.capituloNumero, titulo: secao.capituloTitulo },
+        capitulo: null,
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › o artefato diz o capítulo de cada questão
-        habilidades: habilidades.filter((habilidade) => habilidade.secaoId === secao.id).map(({ codigo, origem }) => ({ codigo, origem })),
+        habilidades: [],
```

```mutacao
arquivo: packages/core/src/auditoria/acoes.ts
teste: packages/core/src/auditoria/acoes.test.ts › a troca da habilidade da questão leva a posição e o código da BNCC
-    depois: z.strictObject({ indice: z.number().int().min(0).max(19), codigo: z.enum(CODIGOS_DA_BNCC).nullable() }),
+    depois: z.strictObject({ indice: z.number().int().min(0).max(99), codigo: z.enum(CODIGOS_DA_BNCC).nullable() }),
```

```mutacao
arquivo: packages/shared/src/permissao/matriz.ts
teste: packages/shared/src/permissao/matriz.test.ts
-    artefato: { listar: 'turma_vinculada', ler: 'turma_vinculada', renomear: 'turma_vinculada', exportar: 'turma_vinculada', adaptar: 'turma_vinculada', trocar_habilidade: 'turma_vinculada' },
+    artefato: { listar: 'turma_vinculada', ler: 'turma_vinculada', renomear: 'turma_vinculada', exportar: 'turma_vinculada', adaptar: 'turma_vinculada', trocar_habilidade: 'unidade' },
```

```mutacao
arquivo: packages/shared/src/assistente/artefato.ts
teste: packages/shared/src/assistente/assistente.test.ts › a troca da habilidade da questão
-  .regex(/^\d{1,2}$/)
+  .regex(/^\d+$/)
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/troca-de-habilidade.ts
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › a troca fecha com a versão adaptada
-  if (artefato.origemId !== null) return TEXTO_DA_TROCA_DA_VERSAO_ADAPTADA
+  if (artefato.origemId === null) return TEXTO_DA_TROCA_DA_VERSAO_ADAPTADA
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/troca-de-habilidade.ts
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › desliga o "Trocar" e diz por quê
-  if (artefato.aplicacoes.length > 0 || artefato.versoesAdaptadas.length > 0) return TEXTO_DA_TROCA_FECHADA
+  if (artefato.aplicacoes.length > 0) return TEXTO_DA_TROCA_FECHADA
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/troca-de-habilidade.ts
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › desliga o "Trocar" e diz por quê
-  if (artefato.aplicacoes.length > 0 || artefato.versoesAdaptadas.length > 0) return TEXTO_DA_TROCA_FECHADA
+  if (artefato.versoesAdaptadas.length > 0) return TEXTO_DA_TROCA_FECHADA
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/troca-de-habilidade.ts
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › com a função suspensa, a sugestão da IA não tem prioridade
-  const doCapitulo = new Set((secao?.habilidades ?? []).filter((habilidade) => !suspensa || habilidade.origem === 'coordenacao').map((habilidade) => habilidade.codigo))
+  const doCapitulo = new Set((secao?.habilidades ?? []).map((habilidade) => habilidade.codigo))
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/troca-de-habilidade.ts
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › a lista põe as habilidades do capítulo
-  return [...itens.filter((item) => doCapitulo.has(item.codigo)), ...itens.filter((item) => !doCapitulo.has(item.codigo))]
+  return [...itens.filter((item) => !doCapitulo.has(item.codigo)), ...itens.filter((item) => doCapitulo.has(item.codigo))]
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/troca-de-habilidade.ts
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › 429: diz em quantos minutos
-    if (erro.codigo === ErrorCode.LIMITE_EXCEDIDO) return textoDoLimiteDeAlteracoesSeguidas(erro.esperaSegundos)
+    if (erro.codigo === ErrorCode.LIMITE_EXCEDIDO) return TEXTO_DA_FALHA_DA_TROCA
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/troca-de-habilidade.ts
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › com a releitura ainda a caminho
-    if (erro.codigo === ErrorCode.CONFLITO) return TEXTO_DA_TROCA_FECHADA
+    if (erro.codigo === ErrorCode.CONFLITO) return TEXTO_DA_FALHA_DA_TROCA
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/troca-de-habilidade.ts
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › `CONFLITO`: diz que a atividade
-  return erro instanceof ApiError && erro.codigo === ErrorCode.CONFLITO
+  return false
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.tsx
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › `CONFLITO`: diz que a atividade
-      {aberta && motivo === undefined && <PainelDaTroca artefato={artefato} numero={numero} secao={secao} aoEscolher={(codigo) => trocar.mutate(codigo)} aoFechar={close} gravando={trocar.isPending} falha={trocar.isError ? textoDaFalhaDaTroca(trocar.error) : undefined} />}
+      {aberta && <PainelDaTroca artefato={artefato} numero={numero} secao={secao} aoEscolher={(codigo) => trocar.mutate(codigo)} aoFechar={close} gravando={trocar.isPending} falha={trocar.isError ? textoDaFalhaDaTroca(trocar.error) : undefined} />}
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.tsx
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › a questão sem habilidade diz
-          {secao !== null && <p className="min-w-0">{capituloDaQuestao(secao)}</p>}
+          {<p className="min-w-0">{capituloDaQuestao(secao as never)}</p>}
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.tsx
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › sem componente na disciplina
-        semComponente={candidatas.data?.semComponente === true}
+        semComponente={false}
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.tsx
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › escolher a habilidade troca na hora
-      cliente.setQueryData(artefatoQueryOptions(artefato.id).queryKey, trocado)
+      cliente.setQueryData(artefatoQueryOptions(artefato.id).queryKey, undefined)
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/api/artefatos.ts
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › escolher a habilidade troca na hora
-  return authedRequest(`${CAMINHO_DOS_ARTEFATOS}/${encodeURIComponent(id)}/questoes/${String(indice)}/habilidade`, artefatoResponseSchema, { metodo: 'PATCH', corpo: { codigo } })
+  return authedRequest(`${CAMINHO_DOS_ARTEFATOS}/${encodeURIComponent(id)}/questoes/${String(indice)}/habilidade`, artefatoResponseSchema, { metodo: 'PATCH', corpo: { codigo: null } })
```

```mutacao
arquivo: apps/web/src/components/habilidades/nome-da-secao.ts
teste: apps/web/src/components/habilidades/nome-da-secao.test.ts › as páginas
-  return capitulo.paginaInicial === capitulo.paginaFinal ? `Página ${String(capitulo.paginaInicial)}` : `Páginas ${String(capitulo.paginaInicial)} a ${String(capitulo.paginaFinal)}`
+  return `Páginas ${String(capitulo.paginaInicial)} a ${String(capitulo.paginaFinal)}`
```

```mutacao
arquivo: apps/web/src/components/habilidades/nome-da-secao.ts
teste: apps/web/src/components/habilidades/nome-da-secao.test.ts › a espera do 429
-  if (esperaSegundos === undefined) return 'Muitas alterações seguidas. Tente de novo em instantes.'
+  if (esperaSegundos === undefined) return 'Muitas alterações seguidas.'
```

```mutacao
arquivo: apps/api/src/artefato/artefato.repository.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › com outro artefato da mesma professora
       .from(artefato)
-      .where(and(this.#noAlcance(), eq(artefato.id, id), eq(artefato.criadoPor, requestSessao().usuarioId)))
+      .where(and(this.#noAlcance(), eq(artefato.criadoPor, requestSessao().usuarioId)))
```

```mutacao
arquivo: apps/api/src/artefato/artefato.repository.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › de outro artefato não fecham a troca deste
       .set({ conteudo, atualizadoEm: sql`now()` })
-      .where(and(eq(artefato.escolaId, requireEscolaId()), eq(artefato.anoLetivoId, requireAnoEmCurso()), eq(artefato.id, id)))
+      .where(and(eq(artefato.escolaId, requireEscolaId()), eq(artefato.anoLetivoId, requireAnoEmCurso()), eq(artefato.id, artefato.id)))
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › troca por nenhuma
-      if (codigo !== null && (recorte.componente === null || !habilidadeEhCandidata(codigo, recorte.componente, recorte.series))) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
+      if ((recorte.componente === null || !habilidadeEhCandidata(codigo, recorte.componente, recorte.series))) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › vale na disciplina sem componente
-      if (codigo !== null && (recorte.componente === null || !habilidadeEhCandidata(codigo, recorte.componente, recorte.series))) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
+      if (codigo !== null && (!habilidadeEhCandidata(codigo, recorte.componente, recorte.series))) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › com outro artefato da mesma professora
-      const antes = conteudo.questoes[indice]?.habilidade ?? null
+      const antes = conteudo.questoes[indice]?.habilidade ?? undefined
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › troca por nenhuma
-        antes: { indice, codigo: antes !== null && daLista(antes.codigo) ? antes.codigo : null, legado: antes !== null && !daLista(antes.codigo) },
+        antes: { indice, codigo: antes !== null ? antes.codigo : null, legado: antes !== null && !daLista(antes.codigo) },
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › com outro artefato da mesma professora
-        antes: { indice, codigo: antes !== null && daLista(antes.codigo) ? antes.codigo : null, legado: antes !== null && !daLista(antes.codigo) },
+        antes: { indice, codigo: antes !== null && daLista(antes.codigo) ? antes.codigo : null, legado: !daLista(antes.codigo) },
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › muda a habilidade só da questão pedida
-        antes: { indice, codigo: antes !== null && daLista(antes.codigo) ? antes.codigo : null, legado: antes !== null && !daLista(antes.codigo) },
+        antes: { indice, codigo: antes !== null && daLista(antes.codigo) ? antes.codigo : null, legado: antes !== null },
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › muda a habilidade só da questão pedida
-    const [linha] = await this.banco.select({ descricao: habilidadeBncc.descricao }).from(habilidadeBncc).where(eq(habilidadeBncc.codigo, codigo))
+    const [linha] = await this.banco.select({ descricao: habilidadeBncc.descricao }).from(habilidadeBncc)
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › de um material da outra escola não traz o capítulo dela
       .innerJoin(material, and(eq(material.escolaId, secaoDoMaterial.escolaId), eq(material.id, secaoDoMaterial.materialId)))
       .leftJoin(capituloDoMaterial, and(eq(capituloDoMaterial.escolaId, secaoDoMaterial.escolaId), eq(capituloDoMaterial.id, secaoDoMaterial.capituloId)))
       .where(
         and(
-          eq(secaoDoMaterial.escolaId, escolaId),
+          eq(secaoDoMaterial.escolaId, secaoDoMaterial.escolaId),
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/ConteudoDoArtefato.tsx
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › diz o código, o texto e o capítulo
-                  {habilidadeDaQuestao === undefined ? (
+                  {true ? (
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/ConteudoDoArtefato.tsx
teste: apps/web/src/areas/professor/artefatos/ConteudoDoArtefato.test.tsx
-                      {questao.habilidade === null ? (
+                      {false ? (
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/ConteudoDoArtefato.tsx
teste: apps/web/src/areas/professor/artefatos/ConteudoDoArtefato.test.tsx › com quem desenhe a linha
-      {conteudo.tipo === 'atividade_objetiva' ? <Atividade conteudo={conteudo} materiais={materiais} resumido={resumido} comGabarito={comGabarito} habilidadeDaQuestao={habilidadeDaQuestao} /> : <Plano conteudo={conteudo} materiais={materiais} resumido={resumido} />}
+      {conteudo.tipo === 'atividade_objetiva' ? <Atividade conteudo={conteudo} materiais={materiais} resumido={resumido} comGabarito={comGabarito} habilidadeDaQuestao={undefined} /> : <Plano conteudo={conteudo} materiais={materiais} resumido={resumido} />}
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.tsx
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › a leitura refeita desliga
-      if (falhaMudouOArtefato(erro)) void cliente.invalidateQueries({ queryKey: artefatoQueryOptions(artefato.id).queryKey })
+      if (false) void cliente.invalidateQueries({ queryKey: artefatoQueryOptions(artefato.id).queryKey })
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.tsx
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › e sem seção não diz capítulo nenhum
-            {questao.habilidade === null ? (
+            {false ? (
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.tsx
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › e sem seção não diz capítulo nenhum
-          {secao !== null && <p className="min-w-0">{capituloDaQuestao(secao)}</p>}
+          {true && <p className="min-w-0">{capituloDaQuestao(secao)}</p>}
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.tsx
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › diz o código, o texto e o capítulo
-          {secao !== null && <p className="min-w-0">{capituloDaQuestao(secao)}</p>}
+          {secao !== null && null}
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.tsx
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › desliga o
-        <Button ref={botao} variante="discreto" tamanho="compacto" disabled={motivo !== undefined} aria-describedby={motivo === undefined ? undefined : idDoMotivo} aria-expanded={aberta} aria-label={`${ROTULO_DE_TROCAR} a habilidade da questão ${String(numero)}`} onClick={() => definirAberta(true)}>
+        <Button ref={botao} variante="discreto" tamanho="compacto" disabled={motivo !== undefined} aria-describedby={undefined} aria-expanded={aberta} aria-label={`${ROTULO_DE_TROCAR} a habilidade da questão ${String(numero)}`} onClick={() => definirAberta(true)}>
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.tsx
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › o Esc fecha o seletor sem trocar nada
-      {aberta && motivo === undefined && <PainelDaTroca artefato={artefato} numero={numero} secao={secao} aoEscolher={(codigo) => trocar.mutate(codigo)} aoFechar={close} gravando={trocar.isPending} falha={trocar.isError ? textoDaFalhaDaTroca(trocar.error) : undefined} />}
+      {true && motivo === undefined && <PainelDaTroca artefato={artefato} numero={numero} secao={secao} aoEscolher={(codigo) => trocar.mutate(codigo)} aoFechar={close} gravando={trocar.isPending} falha={trocar.isError ? textoDaFalhaDaTroca(trocar.error) : undefined} />}
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.tsx
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › escolher a habilidade troca na hora
-      {aberta && motivo === undefined && <PainelDaTroca artefato={artefato} numero={numero} secao={secao} aoEscolher={(codigo) => trocar.mutate(codigo)} aoFechar={close} gravando={trocar.isPending} falha={trocar.isError ? textoDaFalhaDaTroca(trocar.error) : undefined} />}
+      {aberta && motivo === undefined && null}
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.tsx
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › com o PATCH no ar
-          if (codigo !== undefined && !gravando) aoEscolher(codigo)
+          if (codigo !== undefined) aoEscolher(codigo)
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/troca-de-habilidade.ts
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › a lista põe as habilidades do capítulo da questão primeiro
-  const doCapitulo = new Set((secao?.habilidades ?? []).filter((habilidade) => !suspensa || habilidade.origem === 'coordenacao').map((habilidade) => habilidade.codigo))
+  const doCapitulo = new Set((secao?.habilidades ?? []).filter((habilidade) => habilidade.origem === 'coordenacao').map((habilidade) => habilidade.codigo))
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/troca-de-habilidade.ts
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › com a função suspensa
-  const doCapitulo = new Set((secao?.habilidades ?? []).filter((habilidade) => !suspensa || habilidade.origem === 'coordenacao').map((habilidade) => habilidade.codigo))
+  const doCapitulo = new Set((secao?.habilidades ?? []).filter((habilidade) => !suspensa || true).map((habilidade) => habilidade.codigo))
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/troca-de-habilidade.ts
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › diz a frase do código
-    if (erro.codigo === ErrorCode.NAO_ENCONTRADO) return errorMessage(erro)
+    if (false) return errorMessage(erro)
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/troca-de-habilidade.ts
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › leitura do artefato não é refeita
-  return erro instanceof ApiError && erro.codigo === ErrorCode.CONFLITO
+  return erro instanceof ApiError
```

```mutacao
arquivo: apps/web/src/components/habilidades/nome-da-secao.ts
teste: apps/web/src/components/habilidades/nome-da-secao.test.ts › o título leva o número
-  return capitulo.numero === null ? capitulo.titulo : `Capítulo ${String(capitulo.numero)} · ${capitulo.titulo}`
+  return false ? capitulo.titulo : `Capítulo ${String(capitulo.numero)} · ${capitulo.titulo}`
```

```mutacao
arquivo: apps/web/src/components/habilidades/nome-da-secao.ts
teste: apps/web/src/components/habilidades/nome-da-secao.test.ts › o bloco de páginas
-  return secao.capitulo === null ? paginasDoCapitulo(secao) : tituloDoCapitulo(secao.capitulo)
+  return false ? paginasDoCapitulo(secao) : tituloDoCapitulo(secao.capitulo)
```

```mutacao
arquivo: apps/web/src/components/habilidades/nome-da-secao.ts
teste: apps/web/src/components/habilidades/nome-da-secao.test.ts › o bloco de páginas
-  return secao.capitulo === null ? undefined : paginasDoCapitulo(secao)
+  return paginasDoCapitulo(secao)
```

```mutacao
arquivo: apps/web/src/components/habilidades/nome-da-secao.ts
teste: apps/web/src/components/habilidades/nome-da-secao.test.ts › a linha da questão junta
-  return paginas === undefined ? tituloDaSecao(secao) : `${tituloDaSecao(secao)} (${paginas})`
+  return false ? tituloDaSecao(secao) : `${tituloDaSecao(secao)} (${paginas})`
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.tsx
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › desliga o
-      {motivo !== undefined && (
-        <p id={idDoMotivo} className="min-w-0 text-sm break-words text-sutil">
-          {motivo}
-        </p>
-      )}
+      {false && null}
```

```mutacao
arquivo: apps/api/src/artefato/artefato.service.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › troca por nenhuma
-        antes: { indice, codigo: antes !== null && daLista(antes.codigo) ? antes.codigo : null, legado: antes !== null && !daLista(antes.codigo) },
+        antes: { indice, codigo: antes !== null ? antes.codigo : null, legado: antes !== null },
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › o material excluído da própria escola deixa a questão sem capítulo
-      .innerJoin(material, and(eq(material.escolaId, secaoDoMaterial.escolaId), eq(material.id, secaoDoMaterial.materialId)))
+      .innerJoin(material, and(eq(material.escolaId, secaoDoMaterial.escolaId)))
       .leftJoin(capituloDoMaterial, and(eq(capituloDoMaterial.escolaId, secaoDoMaterial.escolaId), eq(capituloDoMaterial.id, secaoDoMaterial.capituloId)))
       .where(
         and(
           eq(secaoDoMaterial.escolaId, escolaId),
           eq(material.estado, 'pronto'),
           isNull(material.excluidoEm),
```

```mutacao
arquivo: apps/api/src/material/secoes.repository.ts
teste: apps/api/test/troca-de-habilidade.int.test.ts › o artefato diz o capítulo de cada questão
       .from(secaoDoMaterial)
       .innerJoin(material, and(eq(material.escolaId, secaoDoMaterial.escolaId), eq(material.id, secaoDoMaterial.materialId)))
-      .leftJoin(capituloDoMaterial, and(eq(capituloDoMaterial.escolaId, secaoDoMaterial.escolaId), eq(capituloDoMaterial.id, secaoDoMaterial.capituloId)))
+      .leftJoin(capituloDoMaterial, and(eq(capituloDoMaterial.escolaId, secaoDoMaterial.escolaId)))
       .where(
         and(
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.tsx
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › diz o código, o texto e o capítulo
-      {motivo !== undefined && (
+      {true && (
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.tsx
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › desliga o
-      {motivo !== undefined && (
-        <p id={idDoMotivo} className="min-w-0 text-sm break-words text-sutil">
-          {motivo}
-        </p>
-      )}
+      {motivo !== undefined && null}
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.tsx
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › desliga o
-disabled={motivo !== undefined} aria-describedby
+disabled={false} aria-describedby
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.tsx
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › erro da troca
-falha={trocar.isError ? textoDaFalhaDaTroca(trocar.error) : undefined}
+falha={textoDaFalhaDaTroca(trocar.error)}
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.tsx
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › a lista põe as habilidades do capítulo da questão primeiro
-falha={trocar.isError ? textoDaFalhaDaTroca(trocar.error) : undefined}
+falha={textoDaFalhaDaTroca(trocar.error)}
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.tsx
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › cancelar depois de uma falha e abrir de novo
-trocar.reset()
+void 0
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.tsx
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › com o PATCH no ar
-disabled={gravando} onClick={() => aoEscolher(null)}
+disabled={false} onClick={() => aoEscolher(null)}
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/api/artefatos.ts
teste: apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx › as candidatas são de cada artefato
-queryKey: [...ARTEFATOS_QUERY_KEY, 'habilidades-bncc', artefatoId],
+queryKey: [...ARTEFATOS_QUERY_KEY, 'habilidades-bncc'],
```

**Motivos (mutantes equivalentes: a saída é a mesma sem o termo, e nenhum teste pode ficar vermelho)**

- **A trava da troca**, `artefato.repository.ts:115`: `this.#noAlcance()` e `eq(artefato.criadoPor, requestSessao().usuarioId)`. O `lockParaTrocar` só trava; a primeira leitura que decide alguma coisa é a do `recorteDoArtefato` (7.0), na mesma transação, que prende escola, ano, `criado_por` e vínculo e responde `NAO_ENCONTRADO` antes de qualquer gravação. Sem o termo, o artefato do colega ou da outra escola é travado por instantes e a resposta é a mesma; o isolamento é provado pelo caso da outra escola e pelo do colega, que ficam vermelhos se o `recorteDoArtefato` perde a cláusula (7.0). O termo `eq(artefato.id, id)` desta linha tem bloco.
- **O artefato já achado e travado**, `artefato.repository.ts:127`, `:133` e `:143`: `eq(atividadeAplicada.escolaId, escolaId)`, `eq(atividadeAplicada.anoLetivoId, anoLetivoId)`, `eq(artefato.escolaId, escolaId)`, `eq(artefato.anoLetivoId, anoLetivoId)`, `eq(artefato.escolaId, requireEscolaId())` e `eq(artefato.anoLetivoId, requireAnoEmCurso())`. O `id` é um UUID v7 de artefato que o `lockParaTrocar` acabou de achar no alcance e de travar; escola e ano repetem o escopo (regra 10, item 3) como defesa em profundidade, e o `id` já basta para a consulta devolver a mesma linha. O termo que escolhe a linha (`eq(artefato.id, id)`, `eq(atividadeAplicada.artefatoId, id)`, `eq(artefato.origemId, id)`) tem bloco.
- **A descrição e o código**, `artefato.service.ts:113` e `:209`: `codigo !== null`, `descricao === undefined` e `habilidade: codigo === null`. A linha 111 (`descricaoDaHabilidadeDoRecorte`) já recusou o código fora do recorte (e o recorte sai da tabela da BNCC), então `descricao` só falta se o código é nulo; sem a guarda da 113 o ramo não é alcançável, e na 209 as duas formas dão o mesmo valor (`null` para código nulo, `{ codigo, descricao }` para os outros). O termo `codigo !== null` e o `recorte.componente === null` da 111 têm bloco.
- **A junção e a página**, `secoes.repository.ts:239`, `:240`, `:246` e `:252`: `eq(material.escolaId, secaoDoMaterial.escolaId)` e `eq(capituloDoMaterial.escolaId, secaoDoMaterial.escolaId)` repetem uma junção que o `id` (UUID) já amarra, e a escola do contexto entra no `where` (o bloco da `eq(secaoDoMaterial.escolaId, …)` prova esse); `eq(secaoDoMaterial.materialId, pagina.materialId)`, `lte(secaoDoMaterial.paginaInicial, pagina.pagina)` e `gte(secaoDoMaterial.paginaFinal, pagina.pagina)` dizem no SQL o mesmo que `(candidata) => candidata.materialId === materialId`, `candidata.paginaInicial <= pagina` e `pagina <= candidata.paginaFinal` dizem no `find`: tirar um dos dois lados deixa a saída igual, porque o outro a repete.
- **Os tipos da tela**, `TrocaDeHabilidade.tsx:111` e `troca-de-habilidade.ts:47`: `codigo !== undefined` e `erro instanceof ApiError`. O seletor é de escolha única com `selecionados` vazio, então quem chama `aoMudar` manda ao menos um código, e o `undefined` só estreita o tipo (`noUncheckedIndexedAccess`); o `erro` que não é `ApiError` não tem `codigo`, e a comparação seguinte dá a mesma resposta.
- **As dez linhas que o comando ainda lista**, sem termo a separar: `artefato.service.ts:86` (`?? null`: o `undefined` de um item do array vai como `null` no JSON), `:100` (`recorte === undefined`: o `recorteDoArtefato` e o `lockParaTrocar` já responderam `NAO_ENCONTRADO` para o mesmo conjunto), `:112` (`descricaoDaHabilidade(null)` devolveria `undefined` do mesmo jeito); `secoes.repository.ts:227` e `:249` (`paginas.length === 0` e `secoes.length === 0` só poupam a consulta, e o retorno vazio é o mesmo) e `:271` (o `undefined` não acontece, porque o recorte já conferiu o código); `Artefato.tsx:279` (`secoesDasQuestoes` traz uma posição por questão, e o `?? null` só estreita o tipo); `TrocaDeHabilidade.tsx:97` (`carregando` e `erro` vão ao seletor à parte, e `itens` só vale com dado), `:116` (`{falha ?? ''}`: `{undefined}` não escreve nada, e o `empty:hidden` esconde o parágrafo do mesmo jeito); `troca-de-habilidade.ts:37` (`if (erro instanceof ApiError)`: sem ele, `erro.codigo` de um erro qualquer é `undefined` e cai na frase da falha).

## Recomendações sem aplicar

Da ordem `.processo/ordens/11_task-r1.md` (1ª rodada), como a Mesa as deixou. Os destinos `TODO.md` estão no `TODO.md` da árvore (linhas `classificacao-bncc, 11.0`). Fora da tabela, um item da própria ordem: desligar o "Trocar" enquanto houver adaptação pendente (item 10) também foi para o `TODO.md`.

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | Caso com professora com vínculo nas duas escolas, para tornar observáveis as cláusulas de escola e de dono de `lockParaTrocar` | Recusada: o `recorteDoArtefato` (7.0) já barra antes, e o motivo está na seção "Mutações"; a cláusula é defesa em profundidade. O caso de duas escolas com a mesma professora é de tarefa que mexa no vínculo (regra 60 item 8a), não da 11.0 |
| tenancy-guardian (1ª) | Juntar as duas consultas `@Unscoped` em `habilidade_bncc` de `secoes.repository.ts` | Recusada por ora: são duas, e a regra 10 item 9 só aponta problema de desenho na terceira no mesmo módulo; cada uma tem a justificativa |
| frontend-reviewer (1ª) e revisor-geral (1ª, recomendação 3) | Um aviso só no topo da folha, no lugar do motivo repetido sob cada questão | `TODO.md` (é decisão de tela: muda o `ConteudoDoArtefato`, o `docs/interface.md` e o e2e). Não conflita com RF9 nem com `cenarios.md` "Telas" |
| frontend-reviewer (1ª) | Modo "trocar" no seletor da 8.0: esconder "0 de 1 escolhidas" e marcar a habilidade atual | `TODO.md`: o seletor é componente da 8.0, usado também pela coordenação |
| frontend-reviewer (1ª) | Na validação, fotografar uma questão com "Trocar" ativo e o seletor aberto | Vai ao Validador, no fim da spec. As fotos desta rodada não mostram o seletor aberto |
| conformidade-reviewer (1ª) | Guardar o código antigo (`legado`) num campo próprio da auditoria | `TODO.md`: muda o contrato de `artefato.habilidade_trocada` e o `lgpd.md`; só vale se houver artefato anterior à 10.0 fora de dado sintético |
| conformidade-reviewer (1ª) | Marca "escolhida por você" na habilidade trocada | `TODO.md`: muda a tela; o rótulo atual erra para o lado de rotular demais como IA (a própria recomendação diz que não viola a regra 70) |
| conformidade-reviewer (1ª) | Cabeçalho "Do capítulo" na lista da troca | `TODO.md`: muda o seletor da 8.0 e a tela |
| infra-guardian (1ª) | Índice `(escola_id, artefato_id)` em `atividade_aplicada` | `TODO.md`: é migration, e a busca já existia antes da tarefa; só quando o volume pedir |
| infra-guardian (1ª) | Restringir o `invalidateQueries` à chave `'lista'` | Recusada: cerca de 3 GETs a mais por troca, com teto de 100 por hora; a chave `artefatos` é a que a tela já usa e tem bloco de mutação |
| infra-guardian (1ª) | `Retry-After` calculado pelo registro mais antigo da janela | Recusada: a espera de uma janela inteira não está errada, e a tela diz o tempo pelo valor que a API manda |
| revisor-geral (1ª) | Mover `ArtefatoTrocarHabilidadeGuard` do controller para um arquivo próprio | `TODO.md`: a guarda do material mora em `material-upload.ts` por ser do módulo material; mover é refatoração de arquivo fora da lista de "Arquivos previstos" |
| test-engineer (1ª) | Casos do artefato de ano letivo anterior e da professora com vínculo encerrado | `TODO.md`: dependem só do `#noAlcance` e do `recorteDoArtefato` (7.0), que já têm os casos de fim de vínculo e de virada do ano; não ficou provado que cobrem esta rota |

Da `.processo/ordens/11_task-r2.md` (2ª rodada, aprovada por todos):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| frontend-reviewer (2ª) | Aviso único no topo da folha, no lugar do motivo repetido sob cada questão | Já está no `TODO.md` (1ª rodada) |
| infra-guardian (2ª) | Índice `(escola_id, artefato_id)` em `atividade_aplicada` | Já está no `TODO.md` (1ª rodada) |
| infra-guardian (2ª) | Desligar o "Trocar" enquanto houver adaptação pendente | Já está no `TODO.md` (o Implementador o registrou ao atender o item 10) |
| infra-guardian (2ª), revisor-geral (2ª), test-engineer (2ª) | Trocar a espera fixa de 500 ms do `situacaoDe` por consulta ao `pg_stat_activity` (soma cerca de 2 s à suíte), ou dizer no comentário que numa máquina lenta o vermelho volta a vir do `esperarNaTrava` | Recusada por ora: o teste continua vermelho sem a trava, só pelo motivo menos claro; rever se a suíte de integração apertar o prazo |
| conformidade-reviewer (2ª) | Marca "escolhida por você" na habilidade trocada; o `legado` em campo próprio da auditoria | Já estão no `TODO.md` (1ª rodada) |
| revisor-geral (2ª) | Usar em `TrocaDeHabilidade.tsx:17` o texto do comentário de `artefato.ts` ("excluído, ainda não pronto ou de outra escola"), no lugar do "o material saiu ou foi excluído" | Recusada: redação de comentário, sem efeito no código; ambos dizem o que o código faz |
| test-engineer (2ª) | Uma linha na tabela de testes do documento para os três casos novos (falha, reabrir e cache por artefato; "Deixar sem habilidade" com o `PATCH` no ar) | Recusada: os três casos já estão nomeados nos blocos da seção "Mutações" |
| test-engineer (2ª) | Casos de ano letivo anterior e de vínculo encerrado na rota da troca | Já estão no `TODO.md` (1ª rodada) |


## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-20 04:52:12 | 2026-11-20 04:53:18 | `tenancy-guardian` | 1 | APROVADO | a39fa1dc13457278b |
| 2026-11-20 04:52:40 | 2026-11-20 04:53:25 | `frontend-reviewer` | 1 | APROVADO | a8d05229f73d62bfb |
| 2026-11-20 04:52:21 | 2026-11-20 04:53:52 | `conformidade-reviewer` | 1 | APROVADO | ae269583e14bbf82b |
| 2026-11-20 04:53:10 | 2026-11-20 04:54:15 | `privacy-guardian` | 1 | APROVADO | a5a3c67e829d9dd6a |
| 2026-11-20 04:52:31 | 2026-11-20 04:54:20 | `infra-guardian` | 1 | APROVADO | ad7ae1fb3d8871d00 |
| 2026-11-20 04:53:00 | 2026-11-20 04:54:48 | `revisor-geral` | 1 | APROVADO | a82accf295e2484b3 |
| 2026-11-20 04:52:50 | 2026-11-20 04:56:22 | `test-engineer` | 1 | REPROVADO | aa12897672dd9899b |
| 2026-11-20 05:29:54 | 2026-11-20 05:30:17 | `tenancy-guardian` | 2 | APROVADO | a1ed04638412919a9 |
| 2026-11-20 05:29:58 | 2026-11-20 05:30:19 | `frontend-reviewer` | 2 | APROVADO | aabc5264f55f66177 |
| 2026-11-20 05:29:57 | 2026-11-20 05:30:21 | `infra-guardian` | 2 | APROVADO | a1b57aa76601171b7 |
| 2026-11-20 05:29:56 | 2026-11-20 05:30:27 | `conformidade-reviewer` | 2 | APROVADO | a62f8b15fb014b6a2 |
| 2026-11-20 05:30:03 | 2026-11-20 05:30:42 | `privacy-guardian` | 2 | APROVADO | a938be234260e265b |
| 2026-11-20 05:30:02 | 2026-11-20 05:30:43 | `revisor-geral` | 2 | APROVADO | afce172a30517a8cc |
| 2026-11-20 05:30:00 | 2026-11-20 05:31:56 | `test-engineer` | 2 | APROVADO | ae2d6406b69b8d29f |
