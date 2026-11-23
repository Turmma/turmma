# Correção — a regra fixa da D55 recusa rubrica e critérios pedidos antes da aplicação, que a D55 permite

**Origem:** `tasks/prd-reserva-e-avaliacao/achado-d55-recusa-rubrica.md` (achado na 10.0 de reserva-e-avaliacao, 22/11/2026): defeito da spec em curso.
**Subagentes obrigatórios:** `conformidade-reviewer`, `llm-integrator`, `pedagogia-reviewer`, `test-engineer`, `revisor-geral`, `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
<!-- Os cinco primeiros vieram no PEDIDO do Orquestrador. Os três últimos são os que `portao-local.ts revisores` pede para o caminho do diff (`packages/core/src/ia/`), acrescentados como a skill manda. -->

## Sintoma

`conversaPedeJulgamentoDeTextoDeAluno` (`packages/core/src/ia/tasks/propor-ferramenta.ts`, o `semModelo` de `propor_ferramenta`)
devolve a recusa fixa a pedidos de rubrica e de critérios escritos antes da aplicação, sem texto de aluno: o professor não chega
ao modelo. Dos 20 pedidos da 10.0, 13 e depois 7 recusados; os quatro do achado recusam hoje.

## Fora desta correção

Nada: a árvore estava limpa. Fica de fora, e vai no relatório ao Orquestrador (decisão do Arquiteto): o pedido de rubrica **num turno
seguinte** a um turno longo do professor ("agora faz uma com 3 níveis", "pode montar os critérios agora?") segue pela regra de turnos
(`conversaPedeJulgamentoDeTextoDeAluno`, `doProfessor.some(trazTextoColado)` e `pedeRubricaSobreOAnterior`), que lê o turno longo como
texto colado. Um turno longo de planejamento não se distingue de uma redação colada, e a `PEDE_RUBRICA` dessa regra segue sem "descritores"
justamente para a amostra `rubrica_de_discursiva-007` de `tools/ia/amostras/avaliacao-1.json` seguir passando.

## Causa

Em `pedeJulgamentoDeTextoDeAluno`, a exceção da rubrica (`PEDE_RUBRICA && !colado && …`) só vale sem texto colado, e
`trazTextoColado` toma por colado qualquer mensagem de 160 caracteres ou mais, ou com aspas de 60 ou mais, ou com dois-pontos
seguido de 80 ou mais: é como o professor escreve um pedido de verdade (turma, gênero, número de níveis, o enunciado entre
aspas). Em seguida, `colado && REDACAO_OU_DISCURSIVA` recusa. Os três pedidos que passam do tamanho que não citam "redação"
caem ainda antes, porque `PEDE_RUBRICA` não conhece "me ajuda com os critérios", "queria critérios" nem "me dá descritores de
níveis".

## Teste que reproduz

`packages/core/src/ia/tasks/numeros.test.ts › a entrada: as formas de pedir que escapavam › rubrica e critérios pedidos antes da aplicação
passam, longos ou curtos…` e as amostras `l(...)` novas de `__fixtures__/assistente-review-samples.ts` (`PEDIDOS_DE_RUBRICA_DO_ACHADO`, um
lugar só): vermelhos antes, verdes depois. Os de recusa (`… segue recusado, mesmo longo`, e as `r(...)` novas) ficam no mesmo arquivo; os que a
ordem de correção da rodada 1 acrescentou (rubrica com juízo, "essa produção", "diz se atende") ficaram vermelhos antes do conserto.

## Correção

A regra de entrada (`pedeJulgamentoDeTextoDeAluno`, `packages/core/src/ia/tasks/propor-ferramenta.ts`) ganha uma exceção estreita para o
pedido de rubrica. O que ela faz, e o que não faz:

- **Vocabulário do pedido (só numa mensagem):** `PEDE_RUBRICA_NO_PEDIDO` conhece "me ajuda com os critérios" (`aju[dr]`), "queria critérios"
  (`quer`), "me dá …" (`me da`) e "descritores", e prende `ger` ao verbo (`ger(?=ar?\b|e\b)`: "no geral" não é pedido). A `PEDE_RUBRICA` de
  antes fica como está para os turnos: com "descritores" nela, a amostra `rubrica_de_discursiva-007` ("Pode montar os descritores agora?",
  depois de um turno longo de planejamento) passou a ser recusada, e a guarda `tools/guardas/amostras-da-d55.test.ts` a acusou.
- **Tamanho não é texto colado, mas bloco de texto é:** o pedido de rubrica sem marca de aluno (`DE_ALUNO`, pessoa pelo nome, "aplic…") e sem
  juízo (`PEDE_JULGAMENTO`, `PEDE_OPINIAO`, `PEDE_JUIZO_NO_PEDIDO`: "diz se atende", "diz o nível") passa **sem colado**, e **com colado só se
  couber num pedido** (`cabeNumPedidoDeRubrica`): uma linha, até 600 caracteres (o dobro do maior dos quatro pedidos do achado, 288), e nenhum
  trecho seguido de mais de 120 caracteres que não fale de rubrica, nível, turma ou de quem pede (o enunciado entre aspas do maior pedido tem
  90). O que não cabe segue o caminho de antes: é recusado se tiver palavra de redação, de juízo ou de opinião.
- **Juízo na rubrica:** o juízo pedido com verbo de dizer ("cria uma rubrica e diz se esse atende", "diz o nível do texto abaixo") conta como
  julgamento, só dentro do pedido de rubrica. A finalidade ("critérios de correção", "pra eu corrigir"), o gênero ("artigo de opinião") e o
  destino ("colar no caderno deles") saem do texto só aí; fora dele valem como antes (teste do "caderno deles").
- **Texto apontado e colado:** rubrica pedida sobre "essa produção, o texto é: …" é recusada.
- **Texto recebido, dito com a expressão:** dentro do pedido de rubrica, "que recebi", "recebi isto/isso/esta/este/essa/esse", "tipo assim:" e
  "base n[ao] texto/resposta/redação/produção/que" (de "com base n…") tiram a mensagem da exceção (`TEXTO_RECEBIDO`, em `semTextoDeAluno`): a regra de
  baixo decide, e recusa o bloco com palavra de redação. Presa ao objeto: "com base na BNCC" segue passando (teste com o pedido de mais de 160
  caracteres, que é o que a guarda mede). A expressão recusa mesmo o texto de 60 caracteres.
- **`semTextoDeAluno` já não confere `apontado`:** a exceção do pedido de rubrica deixou de olhar `TEXTO_APONTADO` e passou a recusar só o
  "apontado **e** colado" (`if (apontado && colado) return true`, antes do cálculo de `semTextoDeAluno`). Sem texto colado o resultado é o do
  HEAD: "essa resposta" sozinho, sem bloco, passa na rubrica como passava; com texto colado, é recusado.
- **`FALA_DE_PLANEJAMENTO` só tem substantivo de planejamento** (rodada 2 da conformidade): "queria", "quero", "preciso", "vou", "vai", "vao" e
  "antes de" saíram, porque qualquer redação de aluno os tem ("Eu vou falar…", "a internet vai mudar…") e zeravam a contagem do trecho seguido.
  Com a lista estreita, o maior trecho fora do pedido nos quatro pedidos do achado é 53, 77, 90 e 98: eles continuam passando. O comentário do
  código diz por que os verbos saíram, para ninguém os devolver.
- **A conferência da saída liga em todo pedido de rubrica de redação ou discursiva com dois-pontos ou aspas** (`pedeRubricaDeRedacaoComBloco`,
  em `mensagemTrazTextoDeAluno`), qualquer que seja o tamanho. Antes ela só ligava na mensagem de 160 caracteres ou mais (`trazTextoColado`):
  `monta os critérios pra redação: <texto de 90 caracteres>` passava **com a conferência desligada**, já no HEAD. A rubrica em geral continua
  passando com a conferência ligada (teste `rubrica e critérios, em geral e antes da aplicação, passam mesmo com texto de aluno na conversa`).
- **Fica como estava:** a regra dos turnos anteriores e a conferência da saída (`julgaTextoDeAluno`), que segue **armada** nesses pedidos
  longos, porque `trazTextoColado` segue lendo o tamanho (teste dos quatro pedidos). **A lista de recusas muda, e para menos:** o texto de aluno
  curto (menos de uns 120 caracteres) dentro de um pedido de rubrica de uma linha, que o HEAD recusava quando a mensagem passava de 160
  caracteres (`colado && REDACAO_OU_DISCURSIVA`), agora passa à regra e chega à conferência da saída. É a troca que a correção faz, declarada
  em "Resto aceito".

Os quatro pedidos do achado entram em `AMOSTRAS_DA_REVISAO` como legítimos, e vinte e seis pedidos de critérios com texto de aluno junto, com
as expressões de texto recebido ou com juízo, como recusa; a taxa declarada do arquivo (1) segue valendo.

## Resto aceito

**Decisão do Joaquim, 23/11/2026 14:54, no terminal do Arquiteto (alternativa A; `.processo/ordens/diagnostico-d55-recusa-rubrica.md`).** A
regra de entrada é um filtro por vocabulário, e **pelo vocabulário não dá para separar um enunciado de 90 caracteres entre aspas de uma
resposta de aluno de 90 caracteres no mesmo lugar**: qualquer exceção que deixe o pedido 3 do achado passar deixa passar a resposta de aluno do
mesmo tamanho. O que fica aceito, e a Mesa julga a correção contra este limite:

1. **Um trecho livre de até 120 caracteres, numa mensagem de rubrica de uma linha, chega ao modelo**, e o texto colado à frase do pedido
   **sem pontuação** (`monta os critérios pra redação A internet ajudou muito…`, em que a frase do pedido conta até 70 caracteres como pedido
   e o resto soma ao que vem), sob o prompt e sob a conferência da saída **ligada** (`pedeRubricaDeRedacaoComBloco`): a saída que julgasse o texto, desse nota ou conceito é barrada e substituída pela recusa fixa.
2. **Isso era recusado antes da correção** quando a mensagem passava de 160 caracteres, e **passava sem conferência** quando era mais curta
   (o furo que o HEAD já tinha, medido na sonda do Arquiteto). A correção troca uma coisa pela outra: o pedido de rubrica de verdade passa; o
   texto curto passa também, mas agora com a barreira armada.
3. **O resto que sobra depois da lista estreita:** redação de aluno que usa "turma", "série", "nível", "gênero", "enunciado", "critérios" ou
   "rubrica" no próprio texto zera a contagem do trecho em que aparece, e **passa à regra mesmo com mais de 120 caracteres**. O caso medido
   na 3ª rodada da conformidade: `monta os critérios pra redação: Na minha turma todo mundo usa celular… O nivel de atencao caiu… para a nossa
   serie…` (271 caracteres) era recusado no HEAD (`colado && REDACAO_OU_DISCURSIVA`) e agora chega ao modelo. **Decisão do Joaquim,
   23/11/2026, no terminal do Orquestrador: o caso fica.** Ele chega com a conferência da saída ligada, porque é pedido de rubrica de redação
   com dois-pontos (`pedeRubricaDeRedacaoComBloco`) e passa de 160 caracteres (`trazTextoColado`); a conferência é a barreira que fica.
4. **O bloco colado sem palavra de redação, de juízo nem de opinião** ("me dá descritores: <texto>"): não era recusado antes, e chega ao
   modelo. A conferência da saída **só fica armada quando a mensagem tem dois-pontos ou aspas e o bloco passa do tamanho de texto colado**
   (`trazTextoColado`: 80 caracteres depois dos dois-pontos, 60 entre aspas, ou a mensagem inteira de 160 ou mais). Sem palavra de redação,
   `pedeRubricaDeRedacaoComBloco` não liga: `me dá descritores: <texto de 60 caracteres>` (79 no total) chega ao modelo **com a conferência
   desligada**, como no HEAD. As amostras `rubrica_de_discursiva-004`, `-005`, `-012` e `-018` (enunciados de 100 a 200 caracteres) só passam
   por isso: recusar o bloco por tamanho as recusaria.
5. **Pesa na escolha do provedor externo (F5c, D62):** um texto curto de aluno pode chegar ao modelo, que hoje é o Ollama local. Contra a
   rubrica feita sob medida para esse texto, a defesa é `rubricaSobMedida`, que também trabalha pelo vocabulário.
6. **O desenho que separa de verdade** é a alternativa C do diagnóstico: a rubrica sai da conversa livre e vai para o cartão da ferramenta, com o
   enunciado num campo próprio, declarado pelo professor. Entra como requisito no **PRD da F7 mínima** (rubrica, D84).

A Mesa não procura outro furo **dentro** deste limite: falso negativo dentro dele não é bloqueante. Fora dele (texto de aluno acima de 120
caracteres seguidos sem palavra de planejamento, com pontuação, sem expressão de texto recebido, e que passe) é bloqueante, como antes.

O que a regra recusa por excesso: a rubrica pedida em várias linhas ou em mais de 600 caracteres **com** palavra de redação; "critérios pra
redação da turma" (`DE_ALUNO` lê "da turma"); "vou aplicar" no pedido; e os níveis "de 0 a 100" (`PEDE_NOTA`). São falsos positivos do lado
seguro, e vão ao Orquestrador no relatório junto com o item "Fora desta correção" e com o item 3 acima.

## Recomendações sem aplicar

Da ordem da rodada 2 (`.processo/ordens/2026-11-23-d55-recusa-rubrica-r2.md`):

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| pedagogia-reviewer (2ª) | Registrar em `docs/` ou no TODO o falso negativo `me dá descritores: <texto curto>` | `TODO.md`, com o item 4 de "Resto aceito" |
| pedagogia-reviewer (2ª) | Levar ao relatório a decisão do Arquiteto sobre enunciados de 100 a 200 caracteres | Vai no relatório do Implementador, no item 4 de "Resto aceito" |
| pedagogia-reviewer (2ª) | Mensagem de recusa que diga que a rubrica é possível sem o texto do aluno no pedido | Decisão de produto (texto de tela do Assistente), do Arquiteto; não é desta correção |
| privacy-guardian (2ª) | Manter no relatório os casos de texto curto de aluno que chegam ao modelo; pesa quando a F5c escolher provedor externo (D62) | Vai no relatório ao Orquestrador (item 5 de "Resto aceito") |
| privacy-guardian (2ª) | Comentário avisando que as regex `/g` (`FINALIDADE_DA_RUBRICA`, `GENERO_DE_OPINIAO`, `DESTINO_DA_RUBRICA`) não servem para `.test` (`lastIndex`) | Barata, mas robustez: esta correção não editou essas constantes; vai ao `TODO.md` |
| infra-guardian (2ª) | Teto de tamanho da mensagem do Assistente no DTO | `TODO.md`: o revisor mediu abaixo de 200 ms em 100 mil caracteres; o DTO está fora desta correção |
| llm-integrator (2ª) | Frase do documento: a decisão de aceitar o risco é do Arquiteto e do Orquestrador | Atendida: a decisão é do Joaquim, registrada em "Resto aceito" |
| llm-integrator (2ª) | Ampliar a lista de verbos de juízo ("mostra o que falta", "aponta o que falta", "responde se atende") | Recusada, pelo próprio revisor: cada verbo novo recusa mais pedido legítimo; o resíduo está declarado |
| llm-integrator (2ª) | Conferir a contagem de pedidos do documento | Conferida: 26 recusas `r(...)` novas e 2 entradas de legítimos novas (os quatro do achado e a BNCC) |
| test-engineer (2ª) | Separar em um `it` próprio os três falsos positivos fixados na lista de recusa | `TODO.md`: organização de teste, sem mudar comportamento |
| test-engineer (2ª) | `corrige o que escreveram no caderno deles` dá verdadeiro só por "corrige" e "escreveram" | `TODO.md`: o caso `conversaTrazTextoDeAluno('o caderno deles', [])` já prova a marca |
| test-engineer (2ª) | Teste do falso negativo 1 (texto colado à frase sem pontuação) até `julgaTextoDeAluno` | `TODO.md`; o falso negativo do bloco sem palavra de redação já tem esse teste |
| test-engineer (2ª) | `expect` sobre o tamanho dos quatro pedidos no `.filter((p) => p.length >= 160)` | `TODO.md` |

## Mutações

--faltando: 0 linhas (0 blocos, 0 motivos)

O limite de 600 e o de 120 caracteres são ajuste fino, sem medida atrás: as mutações abaixo os fixam pelos testes de fronteira (600/601,
120/121 e 190/191).

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › rubrica e critérios pedidos antes da aplicação passam
falha: pedido).toBe(false)
-const PEDE_RUBRICA_NO_PEDIDO = /\b(mont|cri|faz|fac|elabor|ger(?=ar?\b|e\b)|prepar|quer|preciso|sugir|suger|escrev|defin|aju[dr])\w* (\w+ ){0,3}(rubricas?|criterios?|descritor(es)?|barema|grade de correcao)\b|\bme da (\w+ ){0,3}(rubricas?|criterios?|descritor(es)?)\b/
+const PEDE_RUBRICA_NO_PEDIDO = /\b(mont|cri|faz|fac|elabor|prepar|quer|preciso|sugir|suger|escrev|defin|aju[dr])\w* (\w+ ){0,3}(rubricas?|criterios?|descritor(es)?|barema|grade de correcao)\b|\bme da (\w+ ){0,3}(rubricas?|criterios?|descritor(es)?)\b/
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › rubrica e critérios pedidos antes da aplicação passam
falha: pedido).toBe(false)
-const PEDE_RUBRICA_NO_PEDIDO = /\b(mont|cri|faz|fac|elabor|ger(?=ar?\b|e\b)|prepar|quer|preciso|sugir|suger|escrev|defin|aju[dr])\w* (\w+ ){0,3}(rubricas?|criterios?|descritor(es)?|barema|grade de correcao)\b|\bme da (\w+ ){0,3}(rubricas?|criterios?|descritor(es)?)\b/
+const PEDE_RUBRICA_NO_PEDIDO = /\b(mont|cri|faz|fac|elabor|ger(?=ar?\b|e\b)|prepar|quero|preciso|sugir|suger|escrev|defin|aju[dr])\w* (\w+ ){0,3}(rubricas?|criterios?|descritor(es)?|barema|grade de correcao)\b|\bme da (\w+ ){0,3}(rubricas?|criterios?|descritor(es)?)\b/
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › rubrica e critérios pedidos antes da aplicação passam
falha: pedido).toBe(false)
-const PEDE_RUBRICA_NO_PEDIDO = /\b(mont|cri|faz|fac|elabor|ger(?=ar?\b|e\b)|prepar|quer|preciso|sugir|suger|escrev|defin|aju[dr])\w* (\w+ ){0,3}(rubricas?|criterios?|descritor(es)?|barema|grade de correcao)\b|\bme da (\w+ ){0,3}(rubricas?|criterios?|descritor(es)?)\b/
+const PEDE_RUBRICA_NO_PEDIDO = /\b(mont|cri|faz|fac|elabor|ger(?=ar?\b|e\b)|prepar|quer|preciso|sugir|suger|escrev|defin)\w* (\w+ ){0,3}(rubricas?|criterios?|descritor(es)?|barema|grade de correcao)\b|\bme da (\w+ ){0,3}(rubricas?|criterios?|descritor(es)?)\b/
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › rubrica e critérios pedidos antes da aplicação passam
falha: pedido).toBe(false)
-const PEDE_RUBRICA_NO_PEDIDO = /\b(mont|cri|faz|fac|elabor|ger(?=ar?\b|e\b)|prepar|quer|preciso|sugir|suger|escrev|defin|aju[dr])\w* (\w+ ){0,3}(rubricas?|criterios?|descritor(es)?|barema|grade de correcao)\b|\bme da (\w+ ){0,3}(rubricas?|criterios?|descritor(es)?)\b/
+const PEDE_RUBRICA_NO_PEDIDO = /\b(mont|cri|faz|fac|elabor|ger(?=ar?\b|e\b)|prepar|quer|preciso|sugir|suger|escrev|defin|aju[dr])\w* (\w+ ){0,3}(rubricas?|criterios?|barema|grade de correcao)\b|\bme da (\w+ ){0,3}(rubricas?|criterios?|descritor(es)?)\b/
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › rubrica e critérios pedidos antes da aplicação passam
falha: pedido).toBe(false)
-const PEDE_RUBRICA_NO_PEDIDO = /\b(mont|cri|faz|fac|elabor|ger(?=ar?\b|e\b)|prepar|quer|preciso|sugir|suger|escrev|defin|aju[dr])\w* (\w+ ){0,3}(rubricas?|criterios?|descritor(es)?|barema|grade de correcao)\b|\bme da (\w+ ){0,3}(rubricas?|criterios?|descritor(es)?)\b/
+const PEDE_RUBRICA_NO_PEDIDO = /\b(mont|cri|faz|fac|elabor|ger(?=ar?\b|e\b)|prepar|quer|preciso|sugir|suger|escrev|defin|aju[dr])\w* (\w+ ){0,3}(rubricas?|criterios?|descritor(es)?|barema|grade de correcao)\b/
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › rubrica e critérios pedidos antes da aplicação passam
falha: pedido).toBe(false)
-const PEDE_RUBRICA_NO_PEDIDO = /\b(mont|cri|faz|fac|elabor|ger(?=ar?\b|e\b)|prepar|quer|preciso|sugir|suger|escrev|defin|aju[dr])\w* (\w+ ){0,3}(rubricas?|criterios?|descritor(es)?|barema|grade de correcao)\b|\bme da (\w+ ){0,3}(rubricas?|criterios?|descritor(es)?)\b/
+const PEDE_RUBRICA_NO_PEDIDO = /\b(mont|cri|faz|fac|elabor|ger(?=ar?\b|e\b)|prepar|quer|preciso|sugir|suger|escrev|defin|aju[dr])\w* (\w+ ){0,3}(rubricas?|criterios?|descritor(es)?|barema|grade de correcao)\b|\bme da (\w+ ){0,3}(rubricas?|criterios?)\b/
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o pedido de critérios que traz texto de aluno junto
-const PEDE_RUBRICA_NO_PEDIDO = /\b(mont|cri|faz|fac|elabor|ger(?=ar?\b|e\b)|prepar|quer|preciso|sugir|suger|escrev|defin|aju[dr])\w* (\w+ ){0,3}(rubricas?|criterios?|descritor(es)?|barema|grade de correcao)\b|\bme da (\w+ ){0,3}(rubricas?|criterios?|descritor(es)?)\b/
+const PEDE_RUBRICA_NO_PEDIDO = /\b(mont|cri|faz|fac|elabor|ger|prepar|quer|preciso|sugir|suger|escrev|defin|aju[dr])\w* (\w+ ){0,3}(rubricas?|criterios?|descritor(es)?|barema|grade de correcao)\b|\bme da (\w+ ){0,3}(rubricas?|criterios?|descritor(es)?)\b/
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › rubrica e critérios pedidos antes da aplicação passam
falha: pedido).toBe(false)
-const GENERO_DE_OPINIAO = /\b(?:artigos?|textos?|generos?|paragrafos?|redacao|redacoes|producao|producoes)(?: \w+)? (?:de|d[ao]s?) opiniao\b/g
+const GENERO_DE_OPINIAO = /\b(?:artigos?|textos?|generos?|paragrafos?|redacao|redacoes|producao|producoes)(?: \w+)? (?:de|d[ao]s?) opiniao_\b/g
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › rubrica e critérios pedidos antes da aplicação passam
falha: pedido).toBe(false)
-const DESTINO_DA_RUBRICA = /\b(?:n[oa]s?|pr[oa]s?|para (?:o|a|os|as)) (?:caderno|cadernos|quadro|mural|lousa)(?: \w+)? (?:del[ea]s?|d[oa]s? (?:alun\w+|estudante\w*|turma))\b/g
+const DESTINO_DA_RUBRICA = /\b(?:n[oa]s?|pr[oa]s?|para (?:o|a|os|as)) (?:quadro|mural|lousa)(?: \w+)? (?:del[ea]s?|d[oa]s? (?:alun\w+|estudante\w*|turma))\b/g
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › rubrica e critérios pedidos antes da aplicação passam
falha: pedido).toBe(false)
-const FALA_DE_PLANEJAMENTO = /\b(criterios?|rubricas?|descritor\w*|nivel|niveis|competencias?|turma|serie|genero|enunciado|pra eu)\b/
+const FALA_DE_PLANEJAMENTO = /\b(zzz)\b/
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o limite de um pedido de rubrica
-for (const trecho of mensagem.split(/[.?!:;,\n"“”]+/)) {
+for (const trecho of mensagem.split(/[.?!:;,\n]+/)) {
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o pedido de critérios que traz texto de aluno junto
-seguido = FALA_DE_PLANEJAMENTO.test(frase) ? Math.max(0, frase.length - CARACTERES_DE_UMA_FRASE_DO_PEDIDO) : seguido + frase.length
+seguido = FALA_DE_PLANEJAMENTO.test(frase) ? Math.max(0, frase.length - CARACTERES_DE_UMA_FRASE_DO_PEDIDO) : frase.length
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o limite de um pedido de rubrica
-seguido = FALA_DE_PLANEJAMENTO.test(frase) ? Math.max(0, frase.length - CARACTERES_DE_UMA_FRASE_DO_PEDIDO) : seguido + frase.length
+seguido = FALA_DE_PLANEJAMENTO.test(frase) ? 0 : seguido + frase.length
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o pedido de critérios que traz texto de aluno junto
-maior = Math.max(maior, seguido)
+maior = seguido
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o limite de um pedido de rubrica
-const CARACTERES_DE_UM_PEDIDO_DE_RUBRICA = 600
+const CARACTERES_DE_UM_PEDIDO_DE_RUBRICA = 700
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o limite de um pedido de rubrica
-const CARACTERES_DE_ENUNCIADO_NO_PEDIDO = 120
+const CARACTERES_DE_ENUNCIADO_NO_PEDIDO = 130
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o limite de um pedido de rubrica
-const CARACTERES_DE_UMA_FRASE_DO_PEDIDO = 70
+const CARACTERES_DE_UMA_FRASE_DO_PEDIDO = 80
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o limite de um pedido de rubrica
-return cru.length <= CARACTERES_DE_UM_PEDIDO_DE_RUBRICA && !cru.includes('\n') && maiorTrechoForaDoPedido(cru) <= CARACTERES_DE_ENUNCIADO_NO_PEDIDO
+return true && !cru.includes('\n') && maiorTrechoForaDoPedido(cru) <= CARACTERES_DE_ENUNCIADO_NO_PEDIDO
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o pedido de critérios que traz texto de aluno junto
-return cru.length <= CARACTERES_DE_UM_PEDIDO_DE_RUBRICA && !cru.includes('\n') && maiorTrechoForaDoPedido(cru) <= CARACTERES_DE_ENUNCIADO_NO_PEDIDO
+return cru.length <= CARACTERES_DE_UM_PEDIDO_DE_RUBRICA && true && maiorTrechoForaDoPedido(cru) <= CARACTERES_DE_ENUNCIADO_NO_PEDIDO
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o limite de um pedido de rubrica
-return cru.length <= CARACTERES_DE_UM_PEDIDO_DE_RUBRICA && !cru.includes('\n') && maiorTrechoForaDoPedido(cru) <= CARACTERES_DE_ENUNCIADO_NO_PEDIDO
+return cru.length <= CARACTERES_DE_UM_PEDIDO_DE_RUBRICA && !cru.includes('\n') && true
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › rubrica e critérios pedidos antes da aplicação passam
falha: pedido).toBe(false)
-const FINALIDADE_DA_RUBRICA = /\b(?:pra|para|de|da) (?:eu |a gente |o professor |a professora )?(?:correc\w+|corrig\w+|avali\w+|julg\w+|analis\w+|classific\w+|pontu\w+)\b/g
+const FINALIDADE_DA_RUBRICA = /\b(?:zz) (?:eu |a gente |o professor |a professora )?(?:correc\w+|corrig\w+|avali\w+|julg\w+|analis\w+|classific\w+|pontu\w+)\b/g
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o pedido de critérios que traz texto de aluno junto
-const PEDE_JUIZO_NO_PEDIDO = /\b(diz|diga|dize|fala|fale|conta|me conta|me diz) (\w+ ){0,2}(se|o que|quanto|qual|quais|em que)\b|\b(diz|diga|dize) o nivel\b/
+const PEDE_JUIZO_NO_PEDIDO = /\b(zzz) (\w+ ){0,2}(se|o que|quanto|qual|quais|em que)\b|\b(diz|diga|dize) o nivel\b/
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o pedido de critérios que traz texto de aluno junto
-const PEDE_JUIZO_NO_PEDIDO = /\b(diz|diga|dize|fala|fale|conta|me conta|me diz) (\w+ ){0,2}(se|o que|quanto|qual|quais|em que)\b|\b(diz|diga|dize) o nivel\b/
+const PEDE_JUIZO_NO_PEDIDO = /\b(diz|diga|dize|fala|fale|conta|me conta|me diz) (\w+ ){0,2}(se|o que|quanto|qual|quais|em que)\b/
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › rubrica e critérios pedidos antes da aplicação passam
falha: pedido).toBe(false)
-const pedeJuizoNaRubrica = pedeRubrica && PEDE_JUIZO_NO_PEDIDO.test(doPedido)
+const pedeJuizoNaRubrica = true && PEDE_JUIZO_NO_PEDIDO.test(doPedido)
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o pedido de critérios que traz texto de aluno junto
-const pedeJuizoNaRubrica = pedeRubrica && PEDE_JUIZO_NO_PEDIDO.test(doPedido)
+const pedeJuizoNaRubrica = pedeRubrica && false
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o pedido de critérios que traz texto de aluno junto
-const julga = PEDE_JULGAMENTO.test(texto) || pedeJuizoNaRubrica
+const julga = false || pedeJuizoNaRubrica
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o pedido de critérios que traz texto de aluno junto
-const julga = PEDE_JULGAMENTO.test(texto) || pedeJuizoNaRubrica
+const julga = PEDE_JULGAMENTO.test(texto) || false
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › rubrica e critérios pedidos antes da aplicação passam
falha: pedido).toBe(false)
-if (pedeRubrica) {
+if (false) {
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › rubrica e critérios pedidos antes da aplicação passam
falha: pedido).toBe(false)
-if (apontado && colado) return true
+if (true && colado) return true
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › rubrica e critérios pedidos antes da aplicação passam
falha: pedido).toBe(false)
-if (apontado && colado) return true
+if (apontado && true) return true
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o pedido de critérios que traz texto de aluno junto
-const semTextoDeAluno = !DE_ALUNO.test(doPedido) && !citaPessoaPeloNome(mensagem) && !/\baplic\w*/.test(texto) && !TEXTO_RECEBIDO.test(texto)
+const semTextoDeAluno = true && !citaPessoaPeloNome(mensagem) && !/\baplic\w*/.test(texto) && !TEXTO_RECEBIDO.test(texto)
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o pedido de critérios que traz texto de aluno junto
-const semTextoDeAluno = !DE_ALUNO.test(doPedido) && !citaPessoaPeloNome(mensagem) && !/\baplic\w*/.test(texto) && !TEXTO_RECEBIDO.test(texto)
+const semTextoDeAluno = !DE_ALUNO.test(doPedido) && true && !/\baplic\w*/.test(texto) && !TEXTO_RECEBIDO.test(texto)
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o pedido de critérios que traz texto de aluno junto
-const semTextoDeAluno = !DE_ALUNO.test(doPedido) && !citaPessoaPeloNome(mensagem) && !/\baplic\w*/.test(texto) && !TEXTO_RECEBIDO.test(texto)
+const semTextoDeAluno = !DE_ALUNO.test(doPedido) && !citaPessoaPeloNome(mensagem) && true && !TEXTO_RECEBIDO.test(texto)
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o pedido de critérios que traz texto de aluno junto
-const semJuizo = !PEDE_JULGAMENTO.test(doPedido) && !PEDE_OPINIAO.test(doPedido) && !pedeJuizoNaRubrica
+const semJuizo = true && !PEDE_OPINIAO.test(doPedido) && !pedeJuizoNaRubrica
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o pedido de critérios que traz texto de aluno junto
-const semJuizo = !PEDE_JULGAMENTO.test(doPedido) && !PEDE_OPINIAO.test(doPedido) && !pedeJuizoNaRubrica
+const semJuizo = !PEDE_JULGAMENTO.test(doPedido) && true && !pedeJuizoNaRubrica
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o pedido de critérios que traz texto de aluno junto
-const semJuizo = !PEDE_JULGAMENTO.test(doPedido) && !PEDE_OPINIAO.test(doPedido) && !pedeJuizoNaRubrica
+const semJuizo = !PEDE_JULGAMENTO.test(doPedido) && !PEDE_OPINIAO.test(doPedido) && true
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o pedido de critérios que traz texto de aluno junto
-if (semTextoDeAluno && semJuizo && (!colado || cabeNumPedidoDeRubrica(mensagem))) return false
+if (true && semJuizo && (!colado || cabeNumPedidoDeRubrica(mensagem))) return false
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o pedido de critérios que traz texto de aluno junto
-if (semTextoDeAluno && semJuizo && (!colado || cabeNumPedidoDeRubrica(mensagem))) return false
+if (semTextoDeAluno && true && (!colado || cabeNumPedidoDeRubrica(mensagem))) return false
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o pedido de critérios que traz texto de aluno junto
-if (semTextoDeAluno && semJuizo && (!colado || cabeNumPedidoDeRubrica(mensagem))) return false
+if (semTextoDeAluno && semJuizo && true) return false
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o pedido de critérios que traz texto de aluno junto
-if (semTextoDeAluno && semJuizo && (!colado || cabeNumPedidoDeRubrica(mensagem))) return false
+if (semTextoDeAluno && semJuizo && (true || cabeNumPedidoDeRubrica(mensagem))) return false
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o pedido de critérios que traz texto de aluno junto
-if (semTextoDeAluno && semJuizo && (!colado || cabeNumPedidoDeRubrica(mensagem))) return false
+if (semTextoDeAluno && semJuizo && (!colado || true)) return false
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o pedido de critérios que traz texto de aluno junto
-const FALA_DE_PLANEJAMENTO = /\b(criterios?|rubricas?|descritor\w*|nivel|niveis|competencias?|turma|serie|genero|enunciado|pra eu)\b/
+const FALA_DE_PLANEJAMENTO = /\b(criterios?|rubricas?|descritor\w*|nivel|niveis|competencias?|turma|serie|genero|enunciado|vai|pra eu)\b/
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o pedido de critérios que traz texto de aluno junto
-const FALA_DE_PLANEJAMENTO = /\b(criterios?|rubricas?|descritor\w*|nivel|niveis|competencias?|turma|serie|genero|enunciado|pra eu)\b/
+const FALA_DE_PLANEJAMENTO = /\b(criterios?|rubricas?|descritor\w*|nivel|niveis|competencias?|turma|serie|genero|enunciado|queria|quero|preciso|vou|vai|vao|pra eu|antes de)\b/
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o pedido de critérios que traz texto de aluno junto
-const semTextoDeAluno = !DE_ALUNO.test(doPedido) && !citaPessoaPeloNome(mensagem) && !/\baplic\w*/.test(texto) && !TEXTO_RECEBIDO.test(texto)
+const semTextoDeAluno = !DE_ALUNO.test(doPedido) && !citaPessoaPeloNome(mensagem) && !/\baplic\w*/.test(texto) && true
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › rubrica e critérios pedidos antes da aplicação passam
falha: pedido).toBe(false)
-const TEXTO_RECEBIDO = /\bque (?:eu )?recebi\b|\brecebi (?:isto|isso|esta|este|essa|esse)\b|\btipo assim\s*:|\bbase n[ao]s? (?:texto|resposta|redac\w*|producao|que)\b/
+const TEXTO_RECEBIDO = /\bbase\b/
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o pedido de rubrica de redação ou discursiva com dois-pontos ou aspas liga a conferência da saída
-return trazTextoColado(mensagem) || DE_ALUNO.test(texto) || pessoaDonaDoTexto(mensagem) || TEXTO_APONTADO.test(texto) || pedeRubricaDeRedacaoComBloco(mensagem, texto)
+return trazTextoColado(mensagem) || DE_ALUNO.test(texto) || pessoaDonaDoTexto(mensagem) || TEXTO_APONTADO.test(texto) || false
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o pedido de rubrica de redação ou discursiva com dois-pontos ou aspas liga a conferência da saída
falha: pedido).toBe(false)
-return PEDE_RUBRICA_NO_PEDIDO.test(texto) && REDACAO_OU_DISCURSIVA.test(texto) && /[:"“]/.test(mensagem)
+return true && REDACAO_OU_DISCURSIVA.test(texto) && /[:"“]/.test(mensagem)
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o pedido de rubrica de redação ou discursiva com dois-pontos ou aspas liga a conferência da saída
falha: pedido).toBe(false)
-return PEDE_RUBRICA_NO_PEDIDO.test(texto) && REDACAO_OU_DISCURSIVA.test(texto) && /[:"“]/.test(mensagem)
+return PEDE_RUBRICA_NO_PEDIDO.test(texto) && true && /[:"“]/.test(mensagem)
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › o pedido de rubrica de redação ou discursiva com dois-pontos ou aspas liga a conferência da saída
falha: pedido).toBe(false)
-return PEDE_RUBRICA_NO_PEDIDO.test(texto) && REDACAO_OU_DISCURSIVA.test(texto) && /[:"“]/.test(mensagem)
+return PEDE_RUBRICA_NO_PEDIDO.test(texto) && REDACAO_OU_DISCURSIVA.test(texto) && true
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › cada marca da mensagem, sozinha, liga a chave
-return trazTextoColado(mensagem) || DE_ALUNO.test(texto) || pessoaDonaDoTexto(mensagem) || TEXTO_APONTADO.test(texto) || pedeRubricaDeRedacaoComBloco(mensagem, texto)
+return false || DE_ALUNO.test(texto) || pessoaDonaDoTexto(mensagem) || TEXTO_APONTADO.test(texto) || pedeRubricaDeRedacaoComBloco(mensagem, texto)
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › cada marca da mensagem, sozinha, liga a chave
-return trazTextoColado(mensagem) || DE_ALUNO.test(texto) || pessoaDonaDoTexto(mensagem) || TEXTO_APONTADO.test(texto) || pedeRubricaDeRedacaoComBloco(mensagem, texto)
+return trazTextoColado(mensagem) || false || pessoaDonaDoTexto(mensagem) || TEXTO_APONTADO.test(texto) || pedeRubricaDeRedacaoComBloco(mensagem, texto)
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › cada marca da mensagem, sozinha, liga a chave
-return trazTextoColado(mensagem) || DE_ALUNO.test(texto) || pessoaDonaDoTexto(mensagem) || TEXTO_APONTADO.test(texto) || pedeRubricaDeRedacaoComBloco(mensagem, texto)
+return trazTextoColado(mensagem) || DE_ALUNO.test(texto) || false || TEXTO_APONTADO.test(texto) || pedeRubricaDeRedacaoComBloco(mensagem, texto)
```

```mutacao
arquivo: packages/core/src/ia/tasks/propor-ferramenta.ts
teste: packages/core/src/ia/tasks/numeros.test.ts › cada marca da mensagem, sozinha, liga a chave
-return trazTextoColado(mensagem) || DE_ALUNO.test(texto) || pessoaDonaDoTexto(mensagem) || TEXTO_APONTADO.test(texto) || pedeRubricaDeRedacaoComBloco(mensagem, texto)
+return trazTextoColado(mensagem) || DE_ALUNO.test(texto) || pessoaDonaDoTexto(mensagem) || false || pedeRubricaDeRedacaoComBloco(mensagem, texto)
```

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-23 13:10:53 | 2026-11-23 13:11:02 | `tenancy-guardian` | 1 | APROVADO | a4fac976f751bb3ea |
| 2026-11-23 13:10:54 | 2026-11-23 13:11:31 | `privacy-guardian` | 1 | APROVADO | a82b304081825740a |
| 2026-11-23 13:10:56 | 2026-11-23 13:11:33 | `infra-guardian` | 1 | APROVADO | a9de7c597f13280bd |
| 2026-11-23 13:10:49 | 2026-11-23 13:12:01 | `pedagogia-reviewer` | 1 | AJUSTES NECESSÁRIOS | afc0a1c3050c08542 |
| 2026-11-23 13:10:46 | 2026-11-23 13:12:31 | `conformidade-reviewer` | 1 | REPROVADO | ad12002e6d691d385 |
| 2026-11-23 13:10:52 | 2026-11-23 13:12:46 | `revisor-geral` | 1 | REPROVADO | aedbe9bf29a811d7c |
| 2026-11-23 13:10:50 | 2026-11-23 13:12:47 | `test-engineer` | 1 | APROVADO | a7cdc04fd29779459 |
| 2026-11-23 13:10:48 | 2026-11-23 13:13:42 | `llm-integrator` | 1 | AJUSTES NECESSÁRIOS | a6a13e87df7667e04 |
| 2026-11-23 13:35:57 | 2026-11-23 13:36:13 | `tenancy-guardian` | 2 | APROVADO | a089733d49320f767 |
| 2026-11-23 13:35:39 | 2026-11-23 13:36:27 | `pedagogia-reviewer` | 2 | APROVADO | afdc0bb3a25a7db0d |
| 2026-11-23 13:36:01 | 2026-11-23 13:36:30 | `privacy-guardian` | 2 | APROVADO | a47b1adda60a61a7f |
| 2026-11-23 13:36:06 | 2026-11-23 13:36:34 | `infra-guardian` | 2 | APROVADO | ab85fd907aa18c19b |
| 2026-11-23 13:35:33 | 2026-11-23 13:36:57 | `llm-integrator` | 2 | APROVADO | a70a2235ce6e85f4c |
| 2026-11-23 13:35:52 | 2026-11-23 13:36:58 | `test-engineer` | 2 | APROVADO | a5e48907d3290113d |
| 2026-11-23 13:35:26 | 2026-11-23 13:37:11 | `conformidade-reviewer` | 2 | REPROVADO | a0de4ada2db64d0fe |
| 2026-11-23 13:35:47 | 2026-11-23 13:37:55 | `revisor-geral` | 2 | REPROVADO | a8f50c504f08e24d2 |
| 2026-11-23 15:18:43 | 2026-11-23 15:18:52 | `tenancy-guardian` | 3 | APROVADO | a3d31cd36574ac628 |
| 2026-11-23 15:18:52 | 2026-11-23 15:19:09 | `infra-guardian` | 3 | APROVADO | af430298319a8904e |
| 2026-11-23 15:18:23 | 2026-11-23 15:19:16 | `revisor-geral` | 3 | APROVADO | add1e9b395bbc9de8 |
| 2026-11-23 15:18:28 | 2026-11-23 15:19:16 | `llm-integrator` | 3 | APROVADO | a5d80ebaffb8da02d |
| 2026-11-23 15:18:33 | 2026-11-23 15:19:21 | `pedagogia-reviewer` | 3 | APROVADO | af549a478c67bd8dc |
| 2026-11-23 15:18:48 | 2026-11-23 15:19:49 | `privacy-guardian` | 3 | APROVADO | a71ee037a3da426ba |
| 2026-11-23 15:18:16 | 2026-11-23 15:20:04 | `conformidade-reviewer` | 3 | APROVADO | ad095c6d158d625ce |
| 2026-11-23 15:18:38 | 2026-11-23 15:20:06 | `test-engineer` | 3 | APROVADO | aa230409db48f9668 |
