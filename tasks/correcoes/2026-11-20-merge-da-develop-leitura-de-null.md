# Correção — o merge da `develop` na L2 da classificacao-bncc: a leitura de `habilidade`/`codigo` nulos tem duas versões

**Origem:** pedido do Orquestrador (20/11/2026): o merge da `develop` (`e2e3213c`, correção `2026-11-20-leitura-de-habilidade-nula`, já pousada) na linha L2 da classificacao-bncc conflita em ~40 arquivos. Contexto: §7c, linha "Migration", da `techspec.md`.
**Subagentes obrigatórios:** `conformidade-reviewer`, `tenancy-guardian`, `frontend-reviewer`, `llm-integrator`, `privacy-guardian`, `infra-guardian`, `test-engineer`, `revisor-geral`
<!-- Os quatro guardiões vieram no pedido do Orquestrador. `privacy-guardian` e `infra-guardian` entram porque a correção altera arquivos de `apps/` e `packages/`, que pedem os quatro (`tools/processo/guardioes-por-caminho.ts`, apontado pela Mesa 2). `revisor-geral` entra porque a correção passa de 5 arquivos fora de `tasks/`. -->

## Sintoma

`git merge develop` na L2: 40 arquivos em conflito (`UU`), todos de leitura de `habilidade: null`, `habilidades: []` e `codigo: null`. A `develop` ganhou a leitura numa correção; a L2 já a tinha escrito, à sua maneira, na 10.0 (que passa a gravar os três formatos).

## Fora desta correção

nada

## Causa

Duas implementações da mesma leitura, escritas em paralelo, em linhas que a Tech Spec (§7c, "Migration") já previa que se encontrariam: a correção da `develop` (só leitura, a geração continua recusando `null` e `[]`) e a 10.0 da spec (lê e grava).

## Teste que reproduz

Não há defeito de comportamento a reproduzir: é a resolução de um merge. A prova é que os testes dos três formatos da correção rodam **sobre o código da spec**: os que a spec não tinha (plano sem habilidade no PDF e na tela, o relatório que diz "do conteúdo desta questão", a adaptação que não dá nem tira habilidade, o código e a descrição um a um, a ordem da linha sem habilidade no lote e no diagnóstico, o lote e a prova de ponta a ponta com a questão sem habilidade, a chave ausente do Tutor, o SQL real do Analista) e os que a spec já tinha. Os blocos de "Mutações" provam as quatro cláusulas que a correção acrescenta.

## Correção

Esta correção pousou na `develop` (`e2e3213c`), e a `develop` foi trazida para a linha L2 da classificacao-bncc (`git merge develop`), que **já** lê os três formatos desde a 10.0 (a geração passou a gravar `habilidade: null` e `habilidades: []`, e `diagnosticoGravadoSchema` aceita `codigo: null`). Em ~40 arquivos os dois lados tocaram as mesmas linhas de leitura. A regra da resolução: **o comportamento é o da spec (10.0 a 13.0)**, e os testes dos três formatos que vieram da correção ficam, ajustados ao que a spec faz.

- Fontes: ficou o código da spec em todos os leitores (`conferencia`, `lote`, `desempenho`, Analista, `turno.command`, `Atividade`, `Analista.tsx`, `DadoNominal`, `TurmaHoje`, `alunos-da-turma`, `turno-do-tutor`, o schema de `packages/shared`). Do lado da correção entraram só quatro coisas que a spec não tinha: o rótulo `Sem habilidade` na seção "Habilidades" do plano sem habilidade (`pdf-do-artefato.ts` e `ConteudoDoArtefato.tsx`), a frase "do conteúdo desta questão" na revisão rápida do relatório (`relatorio-da-correcao.ts`: a preposição concorda, em vez de "de o conteúdo"), e o `nulls last` escrito nas duas consultas do Analista (`analista.repository.ts`, que é a ordem que o Postgres já dá).
- Testes: os da spec ficaram; vieram os da correção que a spec não cobria (plano sem habilidade no PDF e na tela, a adaptação que não dá nem tira a habilidade, o código e a descrição um a um, a ordem da linha sem habilidade no lote e no diagnóstico da aluna, o lote e a prova abrindo de ponta a ponta com a questão sem habilidade, o Tutor recusando a chave ausente, o SQL real do Analista).
- O que a correção afirmava e a spec **desfez de propósito**: a geração de atividade e de plano deixou de recusar `null` e `[]` (a 10.0 os grava), então os dois casos de `conteudo.test.ts` que os recusavam (o da atividade e o do plano, com três afirmações no total) passaram a afirmar que a conferência os aceita; e o rótulo do gabarito do PDF é o da spec (`sem habilidade da BNCC`), não o `ROTULO_SEM_HABILIDADE`.
- Descartado: `questoesDaHabilidade` (`TurmaHoje.tsx`), que a 12.0 trocou por `EXPLICACAO_SEM_HABILIDADE` e "dessas questões"; `habilidadesParaOTema`, que a 10.0 removeu junto com o catálogo curto; e os nomes antigos da X8 (`gerarPdfDoArtefato`), levados ao nome novo, `generatePdfDoArtefato` (`node tools/renomear/reaplicar.ts`, e `node tools/renomear/restos.ts` limpo: "11 mapas, nenhum nome antigo sobrou").

## Mutações

`--faltando: 0 linhas (7 blocos, 1 motivo)`. Os blocos abaixo são os do que o merge acrescenta ao código da spec (as outras mutações da correção estavam escritas contra o código da `develop` e já não se aplicam: o código que elas mutavam é o da spec, coberto pelas mutações da 10.0 a 13.0).

```mutacao
arquivo: apps/api/src/artefato/pdf-do-artefato.ts
teste: apps/api/src/artefato/pdf-do-artefato.test.ts › a questão sem habilidade sai com o rótulo
-  if (conteudo.habilidades.length === 0) folha.escrever(`• ${ROTULO_SEM_HABILIDADE}`, { ...estilos.item, depois: 14 })
+  if (false) folha.escrever(`• ${ROTULO_SEM_HABILIDADE}`, { ...estilos.item, depois: 14 })
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/ConteudoDoArtefato.tsx
teste: apps/web/src/areas/professor/artefatos/Artefato.test.tsx › o plano sem habilidade
-              {conteudo.habilidades.length === 0 && <li className="break-words">{ROTULO_SEM_HABILIDADE}</li>}
+              {false && <li className="break-words">{ROTULO_SEM_HABILIDADE}</li>}
```

```mutacao
arquivo: apps/web/src/areas/professor/artefatos/ConteudoDoArtefato.tsx
teste: apps/web/src/areas/professor/artefatos/Artefato.test.tsx › o plano sem habilidade
-              {conteudo.habilidades.length === 0 && <li className="break-words">{ROTULO_SEM_HABILIDADE}</li>}
+              {conteudo.habilidades.length === 0 && null}
```

```mutacao
arquivo: packages/core/src/ia/tasks/relatorio-da-correcao.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › manda retomar o conteúdo da questão
-const revisaoDaQuestao = (questao: QuestaoCorrigida): string => (questao.habilidade === null ? 'do conteúdo desta questão' : `de “${questao.habilidade.descricao}”`)
+const revisaoDaQuestao = (questao: QuestaoCorrigida): string => (false ? 'do conteúdo desta questão' : `de “${questao.habilidade.descricao}”`)
```

```mutacao
arquivo: packages/core/src/ia/tasks/relatorio-da-correcao.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › manda retomar o conteúdo da questão
-  else partes.push(`A maioria acertou; os erros pedem uma revisão rápida ${revisaoDaQuestao(questao)}.`)
+  else partes.push(`A maioria acertou; os erros pedem uma revisão rápida de ${assuntoDaQuestao(questao)}.`)
```

```mutacao
arquivo: packages/core/src/ia/tasks/relatorio-da-correcao.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › manda retomar o conteúdo da questão
-const revisaoDaQuestao = (questao: QuestaoCorrigida): string => (questao.habilidade === null ? 'do conteúdo desta questão' : `de “${questao.habilidade.descricao}”`)
+const revisaoDaQuestao = (questao: QuestaoCorrigida): string => (true ? 'do conteúdo desta questão' : `de “${questao.habilidade.descricao}”`)
```

```mutacao
arquivo: apps/api/src/artefato/pdf-do-artefato.ts
teste: apps/api/src/artefato/pdf-do-artefato.test.ts › o plano de aula sai com a duração
falha: not.toContain(ROTULO_SEM_HABILIDADE)
-  if (conteudo.habilidades.length === 0) folha.escrever(`• ${ROTULO_SEM_HABILIDADE}`, { ...estilos.item, depois: 14 })
+  if (true) folha.escrever(`• ${ROTULO_SEM_HABILIDADE}`, { ...estilos.item, depois: 14 })
```

Motivo da linha que nenhum bloco alcança (mutante equivalente: a saída é a mesma sem a cláusula): `analista.repository.ts`, ``.orderBy(sql`habilidade.codigo nulls last`)`` nas duas consultas. O Postgres já põe o `null` por último na ordem crescente, e escrever `nulls last` só deixa a intenção na consulta; tirá-lo deixa a saída igual, e nenhum teste pode ficar vermelho (a ordem fica provada por `analista.int.test.ts`, que lê a consulta real).

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| frontend-reviewer (1ª) | "Quando faltar habilidade, o rótulo é uma linha cinza solta. Um dia vale uma frase que diga o próximo passo, por exemplo "Sem habilidade da BNCC associada"." | Muda texto de tela, e o rótulo da tela é o da spec (`ROTULO_SEM_HABILIDADE`, §7c, linha "Migration", da `techspec.md`). Destino: o Validador, na fotografia da tela, com a tela de plano sem habilidade. |
| revisor-geral (1ª) | "**Dois rótulos no mesmo PDF.** O gabarito diz "sem habilidade da BNCC" (`pdf-do-artefato.ts:225`, texto fixo) e a seção do plano diz "Sem habilidade" (`:238`, a constante). […] Vale o Validador decidir se o gabarito também passa a usar a constante." | O documento registra que o rótulo do gabarito é o da spec, desfeito de propósito pela 10.0, e mudar texto do PDF muda contrato. Destino: o Validador. |
| conformidade-reviewer (1ª) | "Vale renomear uma das duas funções (`habilidadesDaAtividade`, em `lote.ts:30` e em `turno.command.ts:66`) numa tarefa futura." | Renomear toca arquivos fora desta correção e muda nome de função de uma das duas linhas da spec. Destino: `TODO.md`. |
| privacy-guardian (1ª) | `tasks/correcoes/achados/2026-11-20-leitura-de-habilidade-nula.md` cita um caminho absoluto com o usuário da máquina; "prefira o caminho relativo ao repositório". | O arquivo é `achados/`, escrito pelo hook e já pousado na `develop`; ninguém o edita (`protocolo.md`, item 5). Recusada, com esse motivo. Destino: `TODO.md`, para o dono do hook. |
| infra-guardian (1ª) | `nulls last` "não muda o plano nem o custo das duas consultas": registro, não pede mudança. | Já entra no item 4 como comentário do teste. |
| revisor-geral (2ª) | O comentário de `analista.int.test.ts` diz que o caso do espião "depende" do seguinte; "complementa" diria que não há ordem de execução entre os dois. | Recusada: só a escolha de uma palavra num comentário; aplicá-la caducaria as aprovações de teste de novo. |
| test-engineer (2ª) | Em `numeros.test.ts`, escrever a descrição por extenso, sem `primeira.habilidade?.descricao ?? ''`. | Recusada, com o motivo do revisor: a afirmação está correta, e o `?? ''` falha do mesmo jeito se a habilidade sumir da entrada. |
| test-engineer (2ª) | Não rodou `correcao.int.test.ts` (precisa do Postgres); "conto com o portão". | Sem ação: o portão já o rodou ao provar os sete blocos, e o carimbo está válido. |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-20 18:29:37 | 2026-11-20 18:29:46 | `frontend-reviewer` | 1 | APROVADO | ab4642d959567a279 |
| 2026-11-20 18:29:32 | 2026-11-20 18:29:52 | `tenancy-guardian` | 1 | APROVADO | a02e28eb3cb9df62a |
| 2026-11-20 18:29:42 | 2026-11-20 18:30:01 | `llm-integrator` | 1 | APROVADO | acfad164cadbe708c |
| 2026-11-20 18:29:27 | 2026-11-20 18:30:04 | `conformidade-reviewer` | 1 | APROVADO | a860ddfb614a3ea4e |
| 2026-11-20 18:29:51 | 2026-11-20 18:30:17 | `infra-guardian` | 1 | APROVADO | a20f2f85f1ad9b1fa |
| 2026-11-20 18:29:46 | 2026-11-20 18:30:19 | `privacy-guardian` | 1 | APROVADO | a2d3da6fbbacb2dd7 |
| 2026-11-20 18:30:01 | 2026-11-20 18:30:59 | `revisor-geral` | 1 | APROVADO | ab41ae2fa4ee7e48c |
| 2026-11-20 18:29:56 | 2026-11-20 18:32:35 | `test-engineer` | 1 | REPROVADO | a1bdb6113613b046b |
| 2026-11-20 18:46:50 | 2026-11-20 18:47:11 | `revisor-geral` | 2 | APROVADO | a9c5fdb9ce9b6dd49 |
| 2026-11-20 18:46:43 | 2026-11-20 18:47:26 | `test-engineer` | 2 | APROVADO | adcf30f73d74e062a |
