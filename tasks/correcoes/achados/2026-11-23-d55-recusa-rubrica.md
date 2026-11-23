# Achados das revisões — `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-23 13:11:31 · `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A correção mexe só na regra de entrada da D55 (`pedeJulgamentoDeTextoDeAluno`), nas amostras de revisão e nos testes. Não muda migration, schema, DTO, rota nem storage.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: não se aplica, porque o diff não tem endpoint, repository nem query.

Logs: limpos. O diff não acrescenta `logger` nem `console`.

Auditoria: não se aplica. O diff não cria leitura de dado de aluno por coordenação ou rede, exportação, alteração de nota, alteração de permissão nem aprovação de saída de IA.

Envio externo: o caminho ao provedor continua o mesmo, pelo gateway e com `ExecucaoAgente`. O que muda é que pedidos de rubrica e de critérios de até 600 caracteres numa linha só, sem marca de aluno, agora chegam ao modelo. Antes recebiam a recusa fixa.
- A regra continua barrando o pedido que traz nome de pessoa (`citaPessoaPeloNome`), marca de aluno (`DE_ALUNO`), texto apontado ou "aplic…". Por isso a exceção não abre caminho novo para enviar ao provedor dado que identifique um aluno.
- A conferência da saída (`julgaTextoDeAluno`) continua armada nesses pedidos longos, porque `trazTextoColado` segue olhando o tamanho da mensagem.

Seed/fixture: sintético. `TEXTO_DO_LUCAS`, `REDACOES`, "Davi" e "Bianca" são textos e nomes fictícios que o arquivo de amostras já usava. Os quatro pedidos novos do achado são escritos pela professora e não têm dado de pessoa.

Bloqueantes: nenhum.

Recomendações:
1. Uma lacuna ainda não tem teste. Um texto de aluno colado numa linha só, com até 600 caracteres e sem nenhuma marca (por exemplo, "monta critérios pra um texto assim A internet ajudou…"), passa pela exceção nova e chega ao modelo. Hoje só a conferência da saída segura esse caso. Para a regra 20 isso não é dado novo, porque o chat do professor já vai ao provedor pelo gateway. Para a D55 e a regra 70, item 2a, é decisão do `conformidade-reviewer`. Vale um caso de teste que prove o que a saída faz nesse cenário.
2. No relatório ao Orquestrador, deixar explícito que o limite de 600 caracteres é um ajuste fino sem medida por trás. Se ele crescer, cabe mais texto colado sem marca, e por isso deve continuar como constante nomeada, guardada pelos testes de mutação que a correção já tem.

Conferido:
- Os testes de `numeros.test.ts` e da guarda `amostras-da-d55.test.ts` passam (104), e também o único arquivo de teste que consome `AMOSTRAS_DA_REVISAO` (88).
- Arquivos lidos:
  - `packages/core/src/ia/tasks/propor-ferramenta.ts`
  - `packages/core/src/ia/tasks/numeros.test.ts`
  - `packages/core/src/ia/__fixtures__/assistente-review-samples.ts`
  - `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`

Pergunta de fechamento: a correção não altera nada do que o sistema guarda sobre um aluno nem do arquivo do titular, e o registro do que já foi enviado ao provedor continua em `ExecucaoAgente`.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-23 13:11:33 · `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`

VEREDITO: APROVADO
Caminho quente tocado: IA (só a regra de entrada `semModelo` de `propor_ferramenta`, que roda dentro do processo antes de qualquer chamada ao modelo)
Rate limit: ok (a correção não mexe nele. Não cria rota, limite nem bloqueio)
Fila e prioridade: ok (nenhum job novo, e nenhum job muda de fila)
Concorrência: protegida (a mudança é uma função pura sobre a string da mensagem. Não grava nada e não guarda estado entre requests. As regex `/g` novas, `GENERO_DE_OPINIAO` e `DESTINO_DA_RUBRICA`, só aparecem em `.replace`, que zera o `lastIndex` a cada chamada, então duas instâncias ou duas chamadas seguidas não interferem uma na outra)
Índice e paginação: ok (nenhuma query)
Degradação de IA: ok (o caminho continua o mesmo: quando a regra recusa, o professor recebe o texto fixo `RECUSA_DE_CORRECAO_DE_TEXTO_DE_ALUNO`. Quando ela deixa passar, a chamada segue pelo gateway de antes, com o limitador, o timeout e a degradação que já existiam. Nenhum teste chama provedor pago)
Migration: não se aplica
Métrica e alerta: ok (a correção não acrescenta ponto novo de latência nem de erro. Ela só muda a decisão de uma função síncrona que já existia)
Bloqueantes: nenhum
Recomendações:
- Confirmei que as regex novas rodam em tempo linear, sem backtracking catastrófico. `PEDE_RUBRICA_NO_PEDIDO` e as duas de `.replace` levaram cerca de 5 ms numa entrada de 1 MB construída para o pior caso. Mesmo assim, como elas rodam sobre a mensagem inteira do professor, que pode trazer texto colado, vale um teto de tamanho da mensagem antes de `pedeJulgamentoDeTextoDeAluno`, se ele ainda não existir no DTO do assistente. Não verifiquei.
- Quem roda `npx vitest run` de dentro de `packages/core` vê o arquivo de teste quebrar antes de rodar, com "Failed to resolve entry for package `@educa/shared`". Pela configuração da raiz passam `numeros.test.ts` (88 testes) e `tools/guardas/amostras-da-d55.test.ts` (16 testes). A esteira precisa usar a configuração da raiz, ou o `shared` precisa estar compilado antes.

Arquivos auditados:
- packages/core/src/ia/tasks/propor-ferramenta.ts
- packages/core/src/ia/tasks/numeros.test.ts
- packages/core/src/ia/__fixtures__/assistente-review-samples.ts
- tasks/correcoes/2026-11-23-d55-recusa-rubrica.md

## pedagogia-reviewer · 1ª rodada · AJUSTES NECESSÁRIOS · 2026-11-23 13:12:01 · `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`

VEREDITO: AJUSTES NECESSÁRIOS

Amostras avaliadas: 4 pedidos legítimos do achado (mais 2 variações do teste), 11 recusas do teste, 4 amostras de recusa e 4 de legítimo nas fixtures. Também rodei 14 pedidos adversariais meus. A suíte `numeros.test.ts` e a guarda `tools/guardas/amostras-da-d55.test.ts` passam (104 testes).

**Problemas por categoria**
- **Nível e distratores, gabarito, tom:** não se aplicam, porque a correção não tem tela nem questão objetiva.
- **Alinhamento curricular e D55 (a maior preocupação):**
  - Os quatro pedidos reais da professora agora chegam ao modelo. São o artigo de opinião do 9º ano, o relato do 6º, os descritores de Sociologia e a redação no modelo ENEM. O efeito pedagógico é o desejado e o texto das amostras soa como professor real.
  - A exceção alargou a regra de entrada além do que o documento declara, e isso fere a D55 (regra 70, item 2a).

**Exemplos concretos do que saiu errado**

Comparei a regra nova com a de `HEAD`. Usei `T` para um parágrafo de aluno de uma linha só, com menos de 600 caracteres e sem nome nem "aluno".

| Mensagem | `HEAD` | Agora |
|---|---|---|
| `cria uma rubrica de redação: T` | recusa | passa |
| `me ajuda com os critérios: T` | passa | passa |
| `me dá descritores: T` | passa | passa |
| `monta critérios e enquadra o texto abaixo nos níveis T` | passa | passa |
| `monta critérios e diz o nível do texto abaixo T` | passa | passa |

- **Regressão:** a primeira linha é um recuo. A frase "redação + texto colado" recusava antes. Agora a exceção `semTextoDeAluno && eUmPedidoDeRubricaLongo` a deixa passar, porque nada na mensagem diz "do aluno".
- **O que já passava em `HEAD`:** as linhas 2 a 5 eram buracos antigos. O diff tornou "descritores" e "me ajuda com" novas portas de entrada para o mesmo buraco.
- **O que o documento diz:** a seção "O que a regra ainda recusa" lista só falsos positivos, que são o lado seguro. Ela não lista esse falso negativo novo.
- **O que os testes cobrem:** os 11 casos de recusa só provam as guardas por marca (nome, "essa redação", "aplica", "o que você acha", quebra de linha). Nenhum cobre texto de aluno colado numa linha, com pedido de critérios e sem marca. Mutar `eUmPedidoDeRubricaLongo` para só olhar o tamanho não quebra esse cenário.
- **O que impede a pré-correção:** `trazTextoColado` segue ligando `julgaTextoDeAluno` na saída (`conversaTrazTextoDeAluno` deu true em todos os casos acima). A conferência da saída é a única barreira nesse cenário. Nenhum teste prova que ela pega a saída nesse caso.

**Ajuste sugerido no prompt ou na recuperação de contexto**

Distinguir "pedido de rubrica longo" de "texto de aluno colado" é difícil só pelo tamanho. Duas saídas:
- Estreitar a exceção longa. Por exemplo, recusar quando o trecho depois dos dois-pontos, ou o trecho entre aspas, não se parece com enunciado de professor. Também dá para exigir que a mensagem tenha vocabulário de planejamento: turma, série, níveis, "antes de", "pra eu mostrar".
- Manter a exceção como está, mas declarar o falso negativo no documento. Nesse caso, dependo do teste do item 1 abaixo.

**Bloqueantes**
1. `packages/core/src/ia/tasks/propor-ferramenta.ts:262-269`, regra de exceção `PEDE_RUBRICA_NO_PEDIDO` mais `eUmPedidoDeRubricaLongo`.
   - **Problema:** o diff abre uma regressão da D55, e o documento da correção não a declara nem a testa. `cria uma rubrica de redação: <redação do aluno numa linha>` era recusada e agora vai ao modelo. O mesmo vale para `me dá descritores: <texto>` e `monta critérios e diz o nível do texto abaixo <texto>`.
   - **Correção exigida:** escolher uma das duas.
     - Fechar o buraco, de forma que o caso acima volte a ser recusado sem recusar os quatro pedidos do achado.
     - Assumir o buraco por escrito em "O que a regra ainda recusa", como falso negativo coberto só pela saída. Nesse caso é obrigatório o teste do item 2.
2. `packages/core/src/ia/tasks/numeros.test.ts` (novo `it` das recusas):
   - **Problema:** falta o caso que prova a regra no ponto onde o diff a enfraqueceu.
   - **Correção exigida:** adicionar à lista de recusas o texto de aluno de uma linha, com pedido de critérios e sem marca (`cria uma rubrica de redação: ${curto}`).
     - Se o item 1 for o conserto, esse caso entra como recusa.
     - Se for a declaração do buraco, o teste exigido é que `julgaTextoDeAluno` recuse a saída com nota ou nível para esse texto. Isso precisa de um teste de saída, não só da regra de entrada.

**Recomendações**
- O documento da correção não registra que `me dá` e `aju[dr]` só entram na regra de uma mensagem. Isso já está dito, mas vale um teste curto que fixe a diferença entre `PEDE_RUBRICA` e `PEDE_RUBRICA_NO_PEDIDO` nos turnos, para a 007 não voltar a quebrar sem aviso.
- O limite de 600 caracteres é arbitrário. Vale um comentário dizendo por que esse número, e um caso de borda em 600 e 601.
- O falso positivo do "agora faz uma com 3 níveis" é decisão de desenho do Arquiteto, como o documento diz, e está bem levado ao Orquestrador.
- A taxa declarada (1) segue valendo e a guarda das amostras passa.

Arquivos relevantes:
- `packages/core/src/ia/tasks/propor-ferramenta.ts`
- `packages/core/src/ia/tasks/numeros.test.ts`
- `packages/core/src/ia/__fixtures__/assistente-review-samples.ts`
- `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`

Meus arquivos de sonda foram removidos. A árvore está como a recebi.

## conformidade-reviewer · 1ª rodada · REPROVADO · 2026-11-23 13:12:31 · `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`

VEREDITO: REPROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. O diff mexe só na regra de entrada do `propor_ferramenta`, nas amostras e no teste. Todos com autor humano? sim, nada mudou nesse ponto.

Decisão autônoma sobre aluno: ausente

Aprovação registrada: ok. A correção não toca em entrega nem em aprovação.

Supervisão do tutor: ok. O tutor está fora do diff.

Autonomia declarada e visível: sim. Nada mudou nisso.

**Bloqueantes:**

1. **`packages/core/src/ia/tasks/propor-ferramenta.ts:268` (com `:214-218`): a exceção do pedido longo deixa passar rubrica pedida junto com texto de aluno colado na mesma mensagem.** Basta que o texto colado não tenha nenhuma das marcas listadas: aluno, nome, demonstrativo, "aplic…", "segue", pedido de juízo ou de opinião. A regra 70, item 2a, e a decisão 12 do `ouro` chamam isso de pré-correção, porque a rubrica sai feita para aquele texto. Antes, esses pedidos eram recusados sem chamar o modelo (`colado && REDACAO_OU_DISCURSIVA`). Agora o texto do aluno vai ao modelo e só a conferência da saída (`julgaTextoDeAluno`) segura o resultado. Rodei a regra da árvore atual e estes pedidos passam (o texto colado é o `curto` do próprio teste, a frase sobre a internet):
   - `monta os critérios pra redação: <texto do aluno>`
   - `cria uma rubrica de redação "<texto do aluno>"`
   - `quero critérios pra redação sobre internet. Texto: <texto do aluno>`
   - `me dá uma rubrica pra redação do 9º ano. <texto do aluno>`
   - `cria rubrica pra redação, recebi isto: <texto do aluno>`
   - `cria uma rubrica pra essa produção, o texto é: <texto do aluno>`

   O último chama atenção: "essa produção" deveria valer como texto apontado, mas passou mesmo assim.

   No código de antes, os pedidos que citam redação ou produção caíam em `colado && REDACAO_OU_DISCURSIVA` e eram recusados. Não consegui rodar a cópia do código de antes (a resolução de módulos falhou fora do pacote), então essa parte vem da leitura do código. A mudança vai contra o que a própria função promete em `propor-ferramenta.ts:238`: "Erra para o lado de recusar". O documento da correção também não lista essa perda entre "o que a regra ainda recusa" nem em "Fora desta correção".

   **Correção exigida:** a exceção do pedido longo não pode valer quando a mensagem traz um bloco de texto que não é o pedido do professor, como o trecho depois de dois-pontos ou entre aspas sem vocabulário de planejamento (turma, série, níveis, tema, gênero, competência, enunciado). Se não der para distinguir com segurança, vale o lado seguro e o pedido continua recusado, como era antes.

2. **`packages/core/src/ia/tasks/numeros.test.ts:612`: falta o teste que prova a regra.** Os casos de recusa novos (e os `r(...)` novos em `__fixtures__/assistente-review-samples.ts`) trazem sempre uma marca: "essa", "do Davi", "\n", "o que você acha", "dela", nome próprio, "aplica", "reescreve" ou "segue". Nenhum testa o caso que importa para a D55: rubrica ou critérios mais texto de aluno colado sem marca nenhuma, depois de dois-pontos ou entre aspas. Por isso o bloqueante 1 passa com a suíte verde.

   **Correção exigida:** pôr no teste de recusa e em `AMOSTRAS_DA_REVISAO` pelo menos estes três casos, usando o `curto` do teste, e deixá-los vermelhos antes e verdes depois:
   - `monta os critérios pra redação: ${curto}`
   - `cria uma rubrica de redação "${curto}"`
   - `cria uma rubrica pra essa produção, o texto é: ${curto}`

   Junto, pôr uma mutação no bloco `mutacao` do documento mostrando que esses casos quebram sem a nova guarda.

**Recomendações:**
- O documento da correção deve dizer com todas as letras o que a regra de entrada continua deixando passar depois do conserto. Também deve dizer se a conferência da saída (`isRubricaInteira`/`julgaTextoDeAluno`) segura a rubrica feita sob medida para texto colado na mesma mensagem, com um teste que prove isso.
- Há um arquivo fora do diff na árvore, `packages/core/src/ia/tasks/zz-adv-ling.test.ts`, que não está no documento da correção. Não fui eu que o criei: minha sonda ficou na scratchpad e o arquivo temporário que pus no pacote foi apagado logo depois. Vale confirmar de quem é antes do commit, para que não entre na tarefa.
- `DESTINO_DA_RUBRICA` e `GENERO_DE_OPINIAO` só são tirados do texto dentro do ramo da rubrica, e isso está certo. Vale um caso de teste que mostre que "colar no caderno deles" fora de um pedido de rubrica continua contando como trabalho de aluno.

Arquivos lidos:
- `packages/core/src/ia/tasks/propor-ferramenta.ts`
- `packages/core/src/ia/tasks/numeros.test.ts`
- `packages/core/src/ia/__fixtures__/assistente-review-samples.ts`
- `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`

O script que roda os casos do bloqueante 1 está em `/tmp/claude-1000/-home-joaquimdp-Documents-git--maestri-floors-educaia--specavaliacao-e-correcao--l1/724a896f-64d7-44c0-a983-f4e950bad449/scratchpad/sonda.ts`.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-23 13:12:46 · `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`

VEREDITO: REPROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. É uma correção, e o documento declara o que não muda. Só que uma dessas declarações é falsa, e isso está no bloqueante 3.

Portão local: carimbo válido

Bloqueantes:

1. **`packages/core/src/ia/tasks/propor-ferramenta.ts:265`, junto com a lista de `:204`. A exceção curta passou a aceitar pedido de correção de redação.** A linha 265 (`if (semTextoDeAluno && !colado) return false`) não confere `PEDE_JULGAMENTO` nem `PEDE_OPINIAO`. Antes isso escapava pouco, porque a `PEDE_RUBRICA` era estreita. Agora a `PEDE_RUBRICA_NO_PEDIDO` traz `aju[dr]`, `quer` e "descritores", e com eles qualquer frase de julgamento que tenha um desses verbos antes de "critérios" sai da regra fixa. Rodei a versão do HEAD e a da árvore lado a lado com `conversaPedeJulgamentoDeTextoDeAluno(x, [])`. Todos estes eram recusados e agora passam:
   - "me ajuda a corrigir pelos critérios a redação"
   - "me ajuda a avaliar pelos descritores as redações"
   - "queria saber em que critérios a redação está fraca"
   - "me ajuda nos critérios, a redação ficou boa?"

   Sem texto na conversa, a conferência da saída (`julgaTextoDeAluno`) fica desligada, e nada mais segura o pedido antes do modelo. É pedido explícito de correção de redação, o que a regra 70 (item 2a) e a D55 proíbem.

   Correção exigida: a linha 265 também precisa de `!PEDE_JULGAMENTO.test(doPedido) && !PEDE_OPINIAO.test(doPedido)`, ou algo que dê o mesmo resultado. Os quatro pedidos acima entram como `r(...)` em `AMOSTRAS_DA_REVISAO` e como casos no teste "o pedido de critérios que traz texto de aluno junto…" de `numeros.test.ts`. Também falta uma mutação que tire essa guarda da linha 265 e faça o teste ficar vermelho.

2. **`packages/core/src/ia/tasks/propor-ferramenta.ts:268`. A exceção longa deixa passar texto de aluno colado numa linha só, sem marca.** A guarda de tamanho (600 caracteres e uma linha só) não separa o pedido do professor de "pedido + redação colada". Antes recusados, agora passam:
   - "me ajuda com critérios pra redação sobre internet: <texto de aluno de 160 caracteres>"
   - "queria critérios pra uma redação, tipo assim: <texto>"
   - "cria a rubrica pra discursiva com base na resposta que recebi: \"<texto>\""

   É a rubrica sob medida para um texto que está na conversa, que a decisão 12 do `ouro` classifica como pré-correção. O próprio documento recusa abrir esse caminho na seção "Fora desta correção", quando o problema está no turno seguinte. A conferência da saída também não fecha o buraco: `isRubricaInteira` (`:527`) libera qualquer rubrica com três critérios ou mais, a não ser que a saída diga "a partir do texto".

   Correção exigida: a exceção longa precisa recusar a mensagem que tem redação ou discursiva junto com um bloco depois de dois-pontos, ou entre aspas longas, que não seja enunciado. Precisa recusar também as âncoras de texto recebido ("com base na/no", "que recebi", "tipo assim:"). Os três casos acima entram como recusa nos testes e nas amostras. Se o desenho não conseguir separar os dois casos sem voltar a recusar os quatro pedidos do achado, a correção para e vai ao Orquestrador, como manda o próprio documento, em vez de abrir o caminho em silêncio.

3. **`tasks/correcoes/2026-11-23-d55-recusa-rubrica.md:52-62`. O documento diz que "a lista de recusas" não muda e trata o que sobra só como "falsos positivos do lado seguro".** Isso é falso pelos dois itens acima: a correção cria falsos negativos novos. Depois de consertar os itens 1 e 2, o documento precisa declarar o falso negativo que ainda restar. O bloco "O que a regra ainda não pega" (`propor-ferramenta.ts:346`) precisa ser atualizado junto.

Recomendações:
- A `PEDE_RUBRICA_NO_PEDIDO` (`:204`) começa com `ger`, que também casa com "geral" ("no geral os critérios…"). Vale prender a raiz ao verbo (`ger(a|e|ar)\w*`).
- A docstring de `pedeJulgamentoDeTextoDeAluno` (`:236-252`) ainda descreve a regra antiga e não menciona a exceção longa nem os 600 caracteres.
- A mutação que troca `quer` por `quero` não prova "queria" sozinha se outro termo da mesma frase também casar. Confira se o pedido 2 do achado só passa por "queria".

Arquivos para consultar:
- packages/core/src/ia/tasks/propor-ferramenta.ts
- packages/core/src/ia/tasks/numeros.test.ts
- packages/core/src/ia/__fixtures__/assistente-review-samples.ts
- tasks/correcoes/2026-11-23-d55-recusa-rubrica.md
- Script que compara a versão do HEAD com a da árvore: /tmp/claude-1000/-home-joaquimdp-Documents-git--maestri-floors-educaia--specavaliacao-e-correcao--l1/724a896f-64d7-44c0-a983-f4e950bad449/scratchpad/probe2.ts (roda com `npx tsx --conditions=source <arquivo>` a partir da raiz do andar)

## test-engineer · 1ª rodada · APROVADO · 2026-11-23 13:12:47 · `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:** os quatro pedidos do achado da 10.0 (longos, de uma linha só, com o gênero, a turma, o número de níveis e o enunciado entre aspas) passam pela regra fixa e chegam ao modelo. Pedidos curtos com "me dá", "queria" e "descritores" também passam.
- **Borda: "artigo de opinião"** é o gênero da rubrica, não um pedido de opinião.
- **Borda: "pra colar no caderno deles"** é o destino da rubrica, não trabalho de aluno.
- **Borda: tamanho.** Acima de 600 caracteres, ou com quebra de linha, o pedido volta a contar como texto colado.
- **Borda: guardas da exceção.** Cada uma precisa de um caso isolado: marca de aluno, nome de pessoa, texto apontado, "aplic…", juízo, opinião, várias linhas e tamanho.
- **Recusa mantida:** "texto de opinião" seguido de "o que você acha deste" continua recusado.
- **Permissão:** não se aplica, é regra pura de entrada do Assistente. O "quem não pode" daqui é o pedido de critérios com texto de aluno, que precisa continuar barrado.
- **Isolamento e concorrência:** não se aplicam, porque não há escrita nem dado de escola.
- **IA:** nenhum provedor é chamado; o teste usa `semModelo` e funções puras.

**Cobertos:**
- `numeros.test.ts` › "rubrica e critérios pedidos antes da aplicação passam, longos ou curtos…" cobre os quatro pedidos do achado e mais dois. Afirma sobre o resultado: `conversaPedeJulgamentoDeTextoDeAluno(...) === false` e `semModelo(...)` indefinido.
- `numeros.test.ts` › "o pedido de critérios que traz texto de aluno junto, ou que pede juízo, segue recusado, mesmo longo" tem um caso para cada guarda (dela, Bianca, essa redação, aplica, reescreve, segue, `\n`, mais de 600). Afirma a recusa fixa devolvida por `semModelo`.
- A taxa declarada (1) cobre as amostras novas em `AMOSTRAS_DA_REVISAO`: quatro `l(...)` e quatro `r(...)`.
- **Mutações batem com o diff:**
  - `PEDE_RUBRICA_NO_PEDIDO` tem um bloco por alternativa nova: `aju[dr]`, `quer`, `descritor` nas duas partes e `me da`.
  - `GENERO_DE_OPINIAO` e `DESTINO_DA_RUBRICA` têm bloco cada.
  - Os dois termos de `eUmPedidoDeRubricaLongo` têm bloco.
  - O `if` externo tem bloco, assim como os quatro termos de `semTextoDeAluno` e os 2+4 termos dos dois `if` internos.
  - O documento declara `--faltando: 0`.
- **Rede de segurança na saída:** o documento diz que a conferência da saída continua armada nesses pedidos longos. Isso já é provado por testes que existem:
  - `conversaTrazTextoDeAluno(COLADO_LONGO, [])` é verdadeiro (`numeros.test.ts:547-548`, linha única com mais de 160 caracteres);
  - a rubrica sob medida é barrada com a chave ligada (`numeros.test.ts:505`);
  - a rubrica inteira passa com a chave ligada (`numeros.test.ts:409`).
- `npx vitest run packages/core/src/ia/tasks/numeros.test.ts tools/guardas/amostras-da-d55.test.ts`: 104 testes passaram, inclusive a guarda da amostra `rubrica_de_discursiva-007`.
- Não há `.skip`, teste comentado nem mock que esconda a regra.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Limite de 600 sem teste de fronteira.** O caso `longo` tem cerca de 804 caracteres. Uma mutação que troque `600` por `1000` em `propor-ferramenta.ts:214` sobreviveria. Vale um par de casos no teste de recusa: 600 caracteres passa, 601 é recusado.
2. **Recusa nova que deixou de existir, sem registro.** A seção "O que a regra ainda recusa, dito com franqueza" lista só os falsos positivos. Falta dizer o que a exceção deixa de recusar.
   - Exemplo: `"monta os critérios pra uma redação sobre internet. A internet ajudou muito…"`, numa linha só, até 600 caracteres, sem marca de aluno nem verbo de juízo.
   - Antes era recusado (`colado && REDACAO_OU_DISCURSIVA`). Agora chega ao modelo, e o que segura é só a conferência da saída.
   - Sugiro registrar no documento e fixar num teste: um dos quatro pedidos do achado mais uma saída "critérios a partir desse texto" faz `proporFerramenta.conferir` devolver o problema do julgamento. Assim a rede de segurança fica amarrada a este caminho, e não só às peças separadas. O `conformidade-reviewer` decide se esse buraco é aceitável.
3. **Pedidos duplicados.** Os quatro pedidos do achado estão copiados, iguais, no `it` novo e em `__fixtures__/assistente-review-samples.ts`. Exportar do fixture evita que um mude sem o outro.
4. **Casos de borda sem amostra fixa.** O documento admite que estes continuam recusados: a rubrica pedida depois de outro pedido longo de rubrica, e o pedido com "nota" para os níveis. Uma amostra fixa que mostre esse estado facilita a decisão do Arquiteto e a retro.

Arquivos auditados:
- `packages/core/src/ia/tasks/propor-ferramenta.ts`
- `packages/core/src/ia/tasks/numeros.test.ts`
- `packages/core/src/ia/__fixtures__/assistente-review-samples.ts`
- `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`

## llm-integrator · 1ª rodada · AJUSTES NECESSÁRIOS · 2026-11-23 13:13:42 · `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`

VEREDITO: AJUSTES NECESSÁRIOS

Perfis usados: nenhum novo. A mudança está só na regra fixa `semModelo` de `propor_ferramenta`, antes de qualquer chamada. Não toca em perfil, prompt, adaptador ou schema.

Custo estimado por professor/mês: não se aplica, porque a correção não adiciona chamada de modelo. Ela deixa passar ao modelo pedidos de rubrica que a recusa fixa barrava (13 de 20 na 10.0), no perfil que `propor_ferramenta` já usa. O efeito é um pouco mais de chamadas, sem mudar o perfil.

Prompt versionado: não se aplica (não foi alterado)
Validação de schema: não se aplica
Aprovação humana no caminho: não se aplica. A conferência de saída `julgaTextoDeAluno` continua armada, porque `trazTextoColado` não mudou.

Rodei `numeros.test.ts` e `tools/guardas/amostras-da-d55.test.ts`: 104 testes passam. Também comparei a regra nova com a de `HEAD` em casos adversariais. Usei arquivos temporários, já removidos.

Bloqueantes:

1. `packages/core/src/ia/tasks/propor-ferramenta.ts:261-269` (a exceção nova de `pedeJulgamentoDeTextoDeAluno`) e `numeros.test.ts` (o caso de recusa novo). A exceção reabre, na mesma mensagem, o caminho "texto de aluno numa linha só + pedido de critérios", que o documento diz não admitir (regra 70, item 2a). Medido, com recusa em `HEAD` e passagem ao modelo agora (T é um texto de aluno de uma linha, abaixo de 600 caracteres, sem "opinião" nem marca de aluno):
   - `cria uma rubrica pra redação e diz se esse atende: T` virou `false`. É pedido de juízo, e `PEDE_JULGAMENTO` não conhece "diz se … atende".
   - `monta os critérios pra redação: T` virou `false`.
   - `me ajuda com os critérios pra redação: T` virou `false`.

   O caso de recusa só cobre essas marcas com "essa redação", nome, "aplica", "o que você acha" e semelhantes. Com "pra redação:" mais o texto colado, nada o segura. A única defesa que sobra é `julgaTextoDeAluno`, que o próprio `propor-ferramenta.ts` admite que não pega elogio e crítica em palavra desconhecida ("Excelente!", "Confuso e vago."). Além disso, o diff não traz teste que prove que a saída fica armada para os quatro pedidos longos legítimos. O documento afirma isso em "O que não muda", mas nada na árvore o prova.

   Correção exigida:
   - (a) Ampliar o guarda de juízo da exceção para pedidos como "diz se atende", "vê se atende" e "vê o que falta", só dentro da exceção, e cobrir isso em `numeros.test.ts`, com mutação.
   - (b) Acrescentar teste que prove `conversaTrazTextoDeAluno(pedido, [])` verdadeiro para os quatro pedidos longos, e que uma saída com juízo é barrada por `julgaTextoDeAluno`.
   - (c) Registrar no documento da correção, em "O que a regra ainda recusa", que "pedido de rubrica + texto de aluno colado em uma linha, sem marca" agora passa à conferência de saída. Hoje o texto diz o contrário na parte do turno seguinte. Esse risco residual vai ao Arquiteto e ao Orquestrador, que decidem se a troca é aceitável.

Recomendações:
- Registrar a inconsistência de desenho no relatório. O turno seguinte é recusado pelo argumento do item 2a, mas a mensagem única com texto colado passa pela exceção.
- `eUmPedidoDeRubricaLongo`: o nome sugere "é longo", mas a função testa "não é longo demais". `cabeNumPedidoDeRubrica` diria melhor.
- O bloco `mutacao` do documento tem o cabeçalho `--faltando: 0`, e o conjunto de mutações é bom. Falta mutar `aju[dr]` isoladamente de `quer`. As duas mutações dessas partes já existem, então é só conferir que ambas rodam na esteira.

Arquivos: `packages/core/src/ia/tasks/propor-ferramenta.ts`, `packages/core/src/ia/tasks/numeros.test.ts`, `packages/core/src/ia/__fixtures__/assistente-review-samples.ts`, `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-23 13:36:13 · `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma. O diff da rodada 2 (`34a99a31..ce556217`) não traz migration nem schema.

Queries verificadas: nenhuma. O diff mexe em três arquivos de código:
- `packages/core/src/ia/tasks/propor-ferramenta.ts`: funções puras sobre o texto da mensagem (`PEDE_RUBRICA_NO_PEDIDO`, `FALA_DE_PLANEJAMENTO`, `maiorTrechoForaDoPedido`, `cabeNumPedidoDeRubrica`, `FINALIDADE_DA_RUBRICA`, `PEDE_JUIZO_NO_PEDIDO`, `pedeJulgamentoDeTextoDeAluno`). Não acessam banco nem contexto de escola, não criam endpoint e não leem `escolaId`.
- `packages/core/src/ia/tasks/numeros.test.ts`: só testes unitários.
- `packages/core/src/ia/__fixtures__/assistente-review-samples.ts`: só amostras sintéticas.

O diff também não adiciona `@Unscoped()`, id novo nem consulta da camada de rede.

Teste de isolamento: ausente, e não se exige aqui. A tarefa não cria módulo, repository, tabela nem endpoint. É uma correção da regra de entrada da D55, que está fora do escopo de tenant.

Correções exigidas na rodada anterior: nenhuma, então não havia o que conferir.

Bloqueantes: nenhum.

Recomendações: nenhuma de isolamento. A troca de falso positivo por falso negativo (texto de aluno com menos de uns 120 caracteres no meio de um pedido, e bloco colado sem palavra de redação) está declarada no documento da correção. Ela é assunto do `conformidade-reviewer` (regra 70, item 2a), não desta auditoria.

## pedagogia-reviewer · 2ª rodada · APROVADO · 2026-11-23 13:36:27 · `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`

VEREDITO: APROVADO

Amostras avaliadas: 8 casos novos que rodei por conta própria, mais o diff completo da rodada. O diff inclui os 4 pedidos do achado como legítimos, 19 recusas novas e 4 testes novos. A suíte `numeros.test.ts` passa (92 de 92). Rodei com `npx vitest run` na raiz, porque dentro de `packages/core` o `@educa/shared` não resolve. Usei um arquivo de sondagem temporário, que já removi. Nenhum arquivo do repositório foi alterado.

Problemas por categoria:
- **Gabarito, nível e tom:** não se aplicam a esta tarefa. A saída é a recusa da D55 ou a passagem de um pedido de rubrica.
- **Alinhamento com a D55:** as duas correções exigidas foram feitas.
  - **Item 1, escolha da opção "fechar o buraco" para o caso da rodada anterior:** `cria uma rubrica de redação: <texto de aluno de uma linha>` agora é recusado. Conferi na sondagem: `conversaPedeJulgamentoDeTextoDeAluno` devolve `true`. O mecanismo é `cabeNumPedidoDeRubrica`, com o limite de 120 caracteres seguidos que não falam do pedido (`propor-ferramenta.ts`). Os quatro pedidos do achado seguem passando, e o teste fixa a fronteira em 600/601, 120/121 e 190/191.
  - **Item 1, os outros dois casos do achado:** `monta critérios e diz o nível do texto abaixo <texto>` agora é recusado, por `PEDE_JUIZO_NO_PEDIDO`. `me dá descritores: <texto>` não é recusado pela regra. A correção o assume por escrito em "O que a regra ainda deixa passar", item 2, de `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`.
  - **Item 2, teste de recusa:** `cria uma rubrica de redação: ${curto}` entrou na lista de recusas, junto com outras variantes, como `monta os critérios pra redação: ${curto}`.
  - **Item 2, teste de saída para o buraco assumido:** o `it` "o texto de aluno de uma linha que a regra não pega…" afirma o que a rodada pediu. A regra não recusa a entrada, `conversaTrazTextoDeAluno` é `true`, `julgaTextoDeAluno` barra o juízo e `atribuiNotaOuConceito` barra a nota.
  - **Conferência da saída com os pedidos longos:** o `it` novo também cobre os pedidos longos do achado. Em todos eles `conversaTrazTextoDeAluno` é `true` e o juízo escrito pelo modelo seria barrado.
- **Fixture:** `PEDIDOS_DE_RUBRICA_DO_ACHADO` vira fonte única para a amostra da revisão e para o teste. As 15 recusas novas em `AMOSTRAS_DA_REVISAO` cobrem texto colado e juízo na rubrica.

Exemplos concretos do que saiu errado (os que sobram, ambos assumidos):
- `me dá descritores: a internet e boa porque ajuda a estudar mas tem fake news` não é recusado pela regra. A conferência da saída também não está armada nesse caso, porque o texto é curto e `conversaTrazTextoDeAluno` devolve `false`.
- `cria uma rubrica de redação: <mesmo texto curto>` e `quero uma rubrica pra redação. <texto curto>` são recusados pela regra, mas `conversaTrazTextoDeAluno` devolve `false`. Isso não é problema, porque a recusa vale na entrada.

Ajuste sugerido no prompt ou na recuperação de contexto: nenhum. Os limites de 600 e de 120 caracteres são ajuste fino, sem medida atrás, e a própria correção diz isso.

Bloqueantes: nenhum.

Recomendações:
1. O texto de aluno de menos de uns 160 caracteres que vem depois de um pedido sem palavra de redação (`me dá descritores: <texto curto>`) não é recusado na entrada e não arma a conferência da saída. Não era recusado antes, e a D55 continua protegida pelo prompt. Vale registrar em `docs/` ou no TODO como falso negativo conhecido, caso o Arquiteto queira medir.
2. O item 3 dos buracos declarados (enunciados de 100 a 200 caracteres sem palavra de redação, não separáveis de uma redação colada por léxico) fica para decisão do Arquiteto, como o documento já diz. Convém levar essa pergunta ao relatório.
3. Os falsos positivos do lado seguro, que a correção lista como "recusa por excesso", são três: `critérios pra redação da turma`, `vou aplicar` e os níveis de 0 a 100. A professora vai ver a recusa da D55 sem entender o motivo. Vale uma mensagem de recusa que diga que a rubrica é possível se ela tirar o texto do aluno do pedido.

Arquivos relevantes:
- `packages/core/src/ia/tasks/propor-ferramenta.ts`
- `packages/core/src/ia/tasks/numeros.test.ts`
- `packages/core/src/ia/__fixtures__/assistente-review-samples.ts`
- `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-23 13:36:30 · `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`

VEREDITO: APROVADO

Esta é a segunda rodada. Auditei só o diff entre as árvores `34a99a31` e `ce556217`. Na primeira rodada, aprovada, não houve correção exigida.

**Campos pessoais tocados:** nenhum. A mudança fica toda na regra de entrada da D55 (`pedeJulgamentoDeTextoDeAluno`, a regra fixa que recusa pedido de juízo sobre texto de aluno, em `packages/core/src/ia/tasks/propor-ferramenta.ts`), em amostras e em testes. Não há migration, schema, DTO, rota nem storage.

**Fora da tabela de dados do `docs/lgpd.md`:** nada.

**Autorização por objeto:** não se aplica, porque nenhum endpoint nem repository mudou.

**Logs:** limpos. O arquivo alterado não tem `logger` nem `console`, e as funções novas (`maiorTrechoForaDoPedido`, `cabeNumPedidoDeRubrica`) só calculam e devolvem booleano ou número.

**Auditoria:** não se aplica. Nenhuma ação que a regra 20, item 10, manda auditar foi tocada.

**Envio externo:** o caminho não muda e segue pela porta, com `ExecucaoAgente`. O efeito da correção é que alguns pedidos de rubrica do professor deixam de ser recusados sem chamar o modelo e passam a ir para ele. O conteúdo vem da mensagem que o professor escreveu. Para texto de aluno colado que a regra deixa passar, a conferência da saída (`julgaTextoDeAluno`) continua ligada, e dois testes novos provam isso:
- "o pedido longo de rubrica ainda é texto colado para a conferência da saída…"
- "o texto de aluno de uma linha que a regra não pega… chega à conferência da saída"

O provedor e a configuração da porta não mudaram, e a tarefa já declara `levaTextoDeAluno`.

**Seed/fixture:** sintético. `TEXTO_DO_LUCAS`, os nomes "Davi" e "Bia" e os quatro `PEDIDOS_DE_RUBRICA_DO_ACHADO` (os pedidos de rubrica que a regra recusava por engano) estão em `packages/core/src/ia/__fixtures__/assistente-review-samples.ts`. São frases inventadas de professor e de aluno, sem matrícula, sem escola real e sem contato.

**Pergunta de fechamento:** a resposta continua a mesma da primeira rodada. Este diff não cria dado guardado nem destino novo de envio.

**Bloqueantes:** nenhum.

**Recomendações:**
- O documento da correção diz com franqueza o que a regra ainda deixa passar: texto de aluno com menos de uns 120 caracteres no meio de um pedido, ou colado à frase do pedido sem pontuação, e "me dá descritores: <texto>". Pela regra 20 isso não bloqueia, porque a conferência da saída segue ligada e há teste. Mesmo assim, convém manter esses casos no relatório ao Orquestrador. Neles, um trecho curto escrito pelo aluno chega ao modelo dentro do pedido do professor. Hoje isso é aceitável porque o provedor é o local, mas pesa quando a avaliação dos modelos (F5c) escolher provedor externo (D62).
- `FINALIDADE_DA_RUBRICA`, `GENERO_DE_OPINIAO` e `DESTINO_DA_RUBRICA` têm a flag `/g` e hoje só aparecem em `.replace`, o que está correto. Um comentário avisando que não devem ser usadas com `.test`, por causa do `lastIndex`, evitaria um furo silencioso no futuro. É uma recomendação de robustez e não muda o veredito.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-23 13:36:34 · `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`

VEREDITO: APROVADO
Caminho quente tocado: IA (a regra de entrada do Assistente, que roda em memória e de forma síncrona antes da chamada ao modelo)
Rate limit: ok (o diff não toca nisso)
Fila e prioridade: ok (o diff não toca nisso)
Concorrência: protegida (só funções puras, sem estado; as regex com `/g` aparecem só em `.replace`, que zera o `lastIndex`, e `FALA_DE_PLANEJAMENTO` e `PEDE_JUIZO_NO_PEDIDO` não usam `/g`)
Índice e paginação: ok (não há query nova)
Degradação de IA: não se aplica (a recusa continua sendo resposta pronta via `semModelo`, sem erro cru ao professor; não muda timeout, limitador nem caminho do gateway)
Migration: não se aplica
Métrica e alerta: ok (não há rota, job nem chamada externa nova)
Bloqueantes: nenhum
Recomendações:
- `packages/core/src/ia/tasks/propor-ferramenta.ts:218` (`maiorTrechoForaDoPedido`) e as regex novas rodam no event loop a cada mensagem. Medi entradas adversariais de 40 a 100 mil caracteres: cada uma ficou abaixo de 200 ms, sem retrocesso explosivo. O arquivo de medida foi temporário e já foi apagado. Mesmo assim, vale conferir se a mensagem do Assistente tem teto de tamanho no DTO de entrada (`apps/api/src/assistente`). Não achei esse limite com a busca rápida. Um teto de alguns milhares de caracteres prende o custo dessa regra e das que vierem depois.
- Rodada anterior: nenhuma correção exigida, então não há o que conferir.

## llm-integrator · 2ª rodada · APROVADO · 2026-11-23 13:36:57 · `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`

VEREDITO: APROVADO

Perfis usados: nenhum. A correção mexe só na regra fixa de entrada (`semModelo` de `propor_ferramenta`), que roda antes do modelo, e não adiciona chamada de modelo. Os perfis das tarefas existentes não mudaram.

Custo estimado por professor/mês: R$ 0 a mais. Cada pedido de rubrica que antes era recusado na regra fixa passa a chegar ao modelo com o perfil que a tarefa já usa. Isso soma uma chamada por pedido de rubrica ao uso atual, e a estimativa dessa tarefa já cobre essas chamadas.

Prompt versionado: não se aplica (o diff não toca prompt).

Validação de schema: não se aplica.

Aprovação humana no caminho: não se aplica. A conferência da saída, `julgaTextoDeAluno`, continua armada nos pedidos longos.

Verifiquei o diff da rodada, a árvore de trabalho (igual ao commit `ce556217` nos `packages/`) e as três correções exigidas:

- **(a) Guarda de juízo da exceção.**
  - `propor-ferramenta.ts` ganhou `PEDE_JUIZO_NO_PEDIDO` ("diz se", "fala o que", "diz o nível"). Ele conta como juízo só dentro do pedido de rubrica, e as frases de `PEDE_JULGAMENTO` ("vê se", "vê o que") passam a ser lidas sobre `doPedido`.
  - Testei por script os casos "diz se atende", "vê se atende", "vê o que falta", "fala se atende" e "me fala se o texto atende", cada um seguido de texto de aluno de uma linha. Todos são recusados.
  - `numeros.test.ts` tem esses casos na lista de recusa, com e sem texto, e `monta critérios e diz o nível do texto abaixo`.
  - Mutação: `cria uma rubrica pra redação e diz se esse atende` só é recusada por causa de `PEDE_JUIZO_NO_PEDIDO`, então tirar o guarda quebra o teste. A mutação não foi rodada, porque eu não edito arquivo. É conclusão por leitura do código.
- **(b) Conferência da saída.** O teste novo `o pedido longo de rubrica ainda é texto colado para a conferência da saída…` prova duas coisas para os quatro pedidos longos. `conversaTrazTextoDeAluno(pedido, [])` é verdadeiro, e `julgaTextoDeAluno` barra uma saída com juízo. Um segundo teste, `me dá descritores: <texto>`, cobre o que a regra de entrada não pega.
- **(c) Registro do risco residual.** O documento da correção tem a seção "O que a regra ainda deixa passar, dito com todas as letras". Os itens 1 e 2 dizem que texto de aluno de uma linha, sem marca, passa à conferência da saída. Os comentários do código dizem o mesmo.

Testes:

- `numeros.test.ts` passou, 92 de 92, e `tools/guardas/amostras-da-d55.test.ts` passou, 16 de 16.
- Em `packages/core/src/ia` há 26 falhas. Todas são `ECONNREFUSED`, de testes de integração que precisam de Postgres (`orcamento-do-mes.*`, `token-limiter.int.test.ts`). Não têm relação com este diff.
- Nenhum teste da tarefa chama provedor.

Bloqueantes: nenhum.

Recomendações:
1. `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`, itens 1 e 2 de "O que a regra ainda deixa passar": escrever neles a frase que a correção (c) pedia, que a decisão de aceitar esse risco é do Arquiteto e do Orquestrador. Hoje só o item 3 diz "A decisão é do Arquiteto", e o parágrafo final manda ao Orquestrador só os falsos positivos.
2. A lista de verbos de juízo é aberta. Testei "mostra o que falta", "aponta o que falta", "responde se atende" e "enquadra", e todos passam à conferência da saída. É o residual já declarado e o item 1 do documento pode citá-los. Não vale ampliar a lista caso a caso, porque cada verbo novo recusa mais pedido legítimo.
3. O documento da correção ainda diz "dezenove pedidos" de recusa, e a contagem não é a mesma depois da rodada. Convém conferir o número.
4. Para rodar `numeros.test.ts` foi preciso gerar `packages/shared/dist` com `tsc` (a pasta é ignorada pelo git). Ela ficou lá e não suja a árvore.

## test-engineer · 2ª rodada · APROVADO · 2026-11-23 13:36:58 · `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz.** Os quatro pedidos de rubrica do achado passam pela regra de entrada, e também os pedidos curtos ("rubrica pra prova discursiva de História"). Um pedido que diz para que serve a rubrica ("critérios de correção… pra eu corrigir") passa. Uma rubrica para "essa redação do ENEM que eu vou passar" passa, porque o texto é apontado mas nada vem colado.
- **Borda: texto de aluno colado junto do pedido, sem marca de aluno.** Vem depois de dois-pontos, entre aspas, após "recebi isto", "tipo assim" ou "com base na resposta que recebi", ou antes do pedido.
- **Borda: juízo pedido junto da rubrica, com ou sem texto.** Formas como "diz se esse atende", "vê o que falta", "ficou boa?", "corrigir pelos critérios" e "diz o nível do texto abaixo".
- **Borda: os limites de tamanho.** 600 caracteres passam e 601 não. Um trecho fora do pedido de 120 caracteres passa e um de 121 não. Uma frase do pedido de 190 caracteres passa e uma de 191 não.
- **Borda: o que não pode mudar.** "Caderno deles" e "artigo de opinião" continuam contando fora de um pedido de rubrica. "No geral" não conta como o verbo "gerar".
- **Rede de segurança.** O texto de aluno que a regra deixa passar ("me dá descritores: <texto>") chega à conferência da saída, que continua barrando o juízo. Os pedidos longos de rubrica continuam contando como texto colado para essa conferência.
- **Permissão e isolamento:** não se aplicam. É uma função pura, sem dado de escola nem endpoint.
- **Concorrência:** não se aplica.

**Cobertos:** todos os cenários acima, em `packages/core/src/ia/tasks/numeros.test.ts`.
- "rubrica e critérios pedidos antes da aplicação passam" (linhas 597-612)
- "o pedido longo de rubrica ainda é texto colado para a conferência da saída" (linhas 614-619)
- "o pedido de critérios que traz texto de aluno junto, ou que pede juízo, segue recusado" (linhas 621-668)
- "o limite de um pedido de rubrica: 600/601, 120/121" (linhas 670-683)
- "colar no caderno deles e artigo de opinião…" (linhas 685-689)
- "o texto de aluno de uma linha que a regra não pega…" (linhas 691-698)

O que conferi:
- **Mutações contra o `git diff`.** Cada cláusula nova de `propor-ferramenta.ts` tem o seu bloco no documento. Isso vale para o "ger" preso ao verbo, `FALA_DE_PLANEJAMENTO`, o separador do split, as duas formas de `seguido`, `maior`, as três constantes, as três partes de `cabeNumPedidoDeRubrica` e `FINALIDADE_DA_RUBRICA`. Vale também para os dois ramos de `PEDE_JUIZO_NO_PEDIDO`, os dois lados de `pedeJuizoNaRubrica` e de `julga`, o `if (pedeRubrica)` e os dois lados de `apontado && colado`. Os três termos de `semTextoDeAluno`, os três de `semJuizo` e os cinco da condição final também têm. Cada bloco aponta para um teste que tem um cenário capaz de chegar à cláusula. Por exemplo, "me diz se a redação do ENEM tem cinco competências" fixa `pedeRubrica &&` em `pedeJuizoNaRubrica`, e `${curto} monta os critérios` fixa `Math.max` em `maior`.
- **Asserções sobre o resultado.** O teste confere o valor devolvido e a recusa fixa de `semModelo` (`RECUSA_DE_CORRECAO_DE_TEXTO_DE_ALUNO`), não só que o código rodou.
- **Amostras.** As quatro amostras do achado ficam num lugar só (`PEDIDOS_DE_RUBRICA_DO_ACHADO`) e entram nas duas listas. As 19 recusas de `AMOSTRAS_DA_REVISAO` passam pela taxa declarada de 1, conferida em `numeros.test.ts:303-307`.
- **Testes rodados.**
  - `npx vitest run src/ia/tasks/numeros.test.ts`: 92 de 92 verdes.
  - `npx vitest run tools/guardas/amostras-da-d55.test.ts`: 16 de 16 verdes, então a amostra `rubrica_de_discursiva-007` segue passando.
- **Testes desligados e IA.** Nenhum `.skip`, `.only` ou teste comentado, e nenhum mock esconde a regra. Não há chamada a provedor: só regex e o `ScriptedAdapter` que já existia.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Em `numeros.test.ts:131-138`, a lista de "segue recusado" fixa como certo três pedidos legítimos pela D55: "critérios pra redação da turma do 9º ano…", "e aplica isso na semana que vem…" e o pedido em duas linhas. O documento os chama de falsos positivos do lado seguro. Vale separá-los num `it` próprio, com nome do tipo "falso positivo conhecido, fixado para provar a cláusula X". Assim, quem consertar o falso positivo não vai achar que quebrou uma regra.
2. Em `numeros.test.ts:186`, `pedeJulgamentoDeTextoDeAluno('corrige o que escreveram no caderno deles')` provavelmente dá verdadeiro só por "corrige" e "escreveram", sem depender de "caderno deles". A asserção que de fato prova que "caderno deles" continua contando fora do pedido é a de `conversaTrazTextoDeAluno('o caderno deles')`. Vale trocar a primeira por uma frase em que "caderno deles" seja a única marca de aluno.
3. O falso negativo 1 do documento (texto de aluno colado à frase do pedido, sem pontuação) não tem um teste como o do falso negativo 2 ("me dá descritores: …"), que prova que a conferência da saída fica armada. Um caso com `monta os critérios pra redação A internet ajudou…` levado até `julgaTextoDeAluno` fecharia a lista "o que a regra deixa passar".
4. Em `numeros.test.ts:615`, o `.filter((p) => p.length >= 160)` não muda nada hoje, porque os quatro pedidos têm de 221 a 288 caracteres. Um `expect` sobre o tamanho deixaria explícito o que ele pressupõe.

Documento da correção: `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`. Código: `packages/core/src/ia/tasks/propor-ferramenta.ts`.

## conformidade-reviewer · 2ª rodada · REPROVADO · 2026-11-23 13:37:11 · `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`

**VEREDITO: REPROVADO**

Os dois testes passam (108 de 108), mas a primeira correção exigida só fecha o buraco para o texto `curto` que o teste usa. Se a redação colada tiver palavras comuns como "vou" ou "vai", o pedido ainda chega ao modelo.

**Caminhos de escrita em Nota:** nenhum nesta tarefa. Todos com autor humano? Sim, nada mudou nisso.

**Decisão autônoma sobre aluno:** ausente.

**Aprovação registrada:** ok. A tarefa não toca em entrega nem em aprovação.

**Supervisão do tutor:** ok. O tutor está fora do diff.

**Autonomia declarada e visível:** sim, sem mudança.

**Como ficaram as correções da 1ª rodada**

- **Correção 2 foi feita.** Os três casos exigidos estão nos dois lugares:
  - na lista de recusas de `numeros.test.ts`, em `monta os critérios pra redação: ${curto}`, `cria uma rubrica de redação "${curto}"` e `cria uma rubrica pra essa produção, o texto é: ${curto}`;
  - em `AMOSTRAS_DA_REVISAO`, como `r(...)`.
  - As mutações sobre a guarda nova estão no documento: `FALA_DE_PLANEJAMENTO → zzz`, `seguido + frase.length → frase.length`, `maiorTrechoForaDoPedido(...) → true` e `(!colado || true)`.
  - Também entraram a fronteira 600/601, 120/121 e 190/191, o teste que prova a conferência da saída ligada nos quatro pedidos do achado, `PEDIDOS_DE_RUBRICA_DO_ACHADO` num lugar só, e o caso do "caderno deles" fora da rubrica.
- **Correção 1 foi feita só em parte.** Rodei os casos do `curto` e todos são recusados. O problema é a lista de vocabulário usada para separar o pedido do professor do texto colado, descrito abaixo.

**Bloqueantes**

1. **`packages/core/src/ia/tasks/propor-ferramenta.ts:226`: `FALA_DE_PLANEJAMENTO` aceita palavras que qualquer redação de aluno tem, e o texto colado passa por planejamento.**
   - **O que está errado:** a lista inclui `queria|quero|preciso|vou|vai|vao|antes de`. Quando um trecho tem uma dessas palavras, `maiorTrechoForaDoPedido` zera a contagem. Uma redação comum, com "Eu vou falar…" e "a internet vai mudar…", nunca soma 120 caracteres seguidos, e `cabeNumPedidoDeRubrica` a aceita.
   - **O que eu medi** com a árvore atual, usando uma redação de 260 caracteres que tem "vou", "vai" e "antes de":
     - `monta os critérios pra redação: <redação>`: **passa**.
     - `cria uma rubrica de redação "<redação>"`: **passa**.
     - `queria critérios pra redação do 9º ano com cinco níveis: <redação>`: **passa**.
     - `cria a rubrica pra redação, com níveis, a partir deste: <redação>`: **passa**.
   - **Por que é bloqueante:** é a mesma forma do bloqueante 1 da rodada anterior. No HEAD esses pedidos eram recusados por `colado && REDACAO_OU_DISCURSIVA`. O documento da correção (`tasks/correcoes/2026-11-23-d55-recusa-rubrica.md:61-63`) declara como resto só o texto de menos de uns 120 caracteres, ou colado sem pontuação. Este caso, de 260 caracteres com pontuação, não está declarado. A correção exigida pedia vocabulário de planejamento (turma, série, níveis, tema, gênero, competência, enunciado), não verbos que qualquer prosa tem. Pelo item 2a da regra 70, vale o lado seguro.
   - **Correção exigida:**
     - (a) Tirar de `FALA_DE_PLANEJAMENTO` os verbos e locuções comuns: `queria`, `quero`, `preciso`, `vou`, `vai`, `vao` e `antes de`. Fica só o que é substantivo de planejamento. Medi fora do repositório, com a lista estreita: o maior trecho fora do pedido nos quatro pedidos do achado fica em 53, 77, 90 e 98, ou seja, abaixo de 120, e eles continuam passando. A redação acima sobe para 257 e é recusada. O Implementador precisa rodar a suíte inteira para conferir os outros legítimos.
     - (b) Pôr no teste de recusa (`numeros.test.ts`) e em `AMOSTRAS_DA_REVISAO` ao menos `monta os critérios pra redação: ${comVai}` e `cria uma rubrica de redação "${comVai}"`. `comVai` é um texto de aluno com "vou", "vai" e "antes de". Os dois casos ficam vermelhos antes e verdes depois.
     - (c) Pôr um bloco `mutacao` que devolva um desses verbos à lista e quebre o teste de (b).

**Recomendações**

- Mesmo com a lista estreita, sobra um resto: redação de aluno que usa "turma", "série", "nível" ou "gênero" no próprio texto ainda zera a contagem. Nas minhas sondas esses textos foram recusados por outra marca, mas o documento deve declarar esse resto no item 1 de "O que a regra ainda deixa passar", com a conferência da saída como a barreira que fica.
- O comentário de `FALA_DE_PLANEJAMENTO` diz que "quem pede" ("queria", "pra eu", "vou") é trecho do professor. Depois do conserto, deve dizer por que os verbos saíram, para ninguém os devolver.

**Arquivos**
- packages/core/src/ia/tasks/propor-ferramenta.ts
- packages/core/src/ia/tasks/numeros.test.ts
- packages/core/src/ia/__fixtures__/assistente-review-samples.ts
- tasks/correcoes/2026-11-23-d55-recusa-rubrica.md

**Sondas**, que rodam com `npx tsx --conditions=source <arquivo>` a partir da raiz do andar:
- /tmp/claude-1000/-home-joaquimdp-Documents-git--maestri-floors-educaia--specavaliacao-e-correcao--l1/724a896f-64d7-44c0-a983-f4e950bad449/scratchpad/sonda-r2.ts mostra o bloqueante.
- /tmp/claude-1000/-home-joaquimdp-Documents-git--maestri-floors-educaia--specavaliacao-e-correcao--l1/724a896f-64d7-44c0-a983-f4e950bad449/scratchpad/sonda-r2b.ts mede a lista estreita contra os quatro pedidos do achado.

Não editei nenhum arquivo do repositório.

## revisor-geral · 2ª rodada · REPROVADO · 2026-11-23 13:37:55 · `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. É uma correção, e o documento ainda afirma duas coisas que não são verdade (bloqueante 2).
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")

**Correções da 1ª rodada, uma a uma**
- **Correção 1: feita.** `semJuizo` agora vale também no ramo sem texto colado (`propor-ferramenta.ts:311`). Os quatro pedidos estão nos testes e nas amostras `r(...)`, e há mutação para cada termo de `semJuizo`. Comparei com o HEAD: os quatro voltam a ser recusados.
- **Correção 2: feita em parte.** Os três casos com o texto de 160 caracteres voltaram a ser recusados, mas só pelo tamanho do bloco. As expressões que indicam texto recebido ("tipo assim:", "recebi isto:", "com base na resposta que recebi"), que a correção mandava recusar, não foram tratadas. A correção também mandava parar e ir ao Orquestrador se não desse para separar os casos. Nada disso foi feito.
- **Correção 3: feita em parte.** A lista de falsos negativos foi escrita, mas duas frases continuam falsas.

**Bloqueantes**

1. **`packages/core/src/ia/tasks/propor-ferramenta.ts:228-311`: quem diz "tipo assim:" ou "com base na resposta que recebi:" ainda passa, se o texto do aluno tiver menos de 120 caracteres.** O código não reconhece essas expressões. Só `maiorTrechoForaDoPedido` mede o tamanho do bloco. Rodei a regra do HEAD e a da árvore lado a lado. `base` é um pedido de planejamento de 134 caracteres que cita redação, e o texto do aluno tem 60 caracteres: "A internet ajuda a estudar mas tem fake news e cyberbullying". Os cinco eram recusados no HEAD e agora vão ao modelo:
   - `${base}, com base na resposta que recebi: ${s}`
   - `${base}, tipo assim: ${s}`
   - `${base}. Recebi isto: "${s}"`
   - `${base}. Com base no texto que recebi: ${s}`
   - `Queria critérios pra uma redação do 9º ano com base nesta que recebi: ${s}. Com 4 critérios e 3 níveis cada…`

   O comentário de `numeros.test.ts:638` diz que os casos cobrem "recebi isto", "tipo assim" e "com base na resposta que recebi". Só que eles passam a ser recusados pelo tamanho do `curto` (160 caracteres), não pela expressão. Apagar qualquer regra sobre essas expressões não deixaria nenhum teste vermelho, porque essa regra não existe.
   Essas expressões dá para separar pelo vocabulário: nenhum dos quatro pedidos do achado tem "recebi", "tipo assim:" ou "com base n[ao] <texto|resposta|redação>". Não serve a desculpa de que o desenho não separa os casos.

   **Correção exigida:**
   - Dentro do pedido de rubrica, a expressão de texto recebido tira a mensagem da exceção: "que recebi", "recebi isto/isso", "tipo assim:", "com base n[ao] (texto|resposta|redação|produção)". Prenda a expressão ao objeto, para "com base na BNCC" seguir passando.
   - Os cinco casos acima, com o texto curto, entram como recusa no teste "o pedido de critérios que traz texto de aluno junto…" e como `r(...)` em `AMOSTRAS_DA_REVISAO`.
   - Entra também uma mutação que tire essa guarda e deixe o teste vermelho.
   - "Critérios com base na BNCC" entra como caso que passa.

2. **O documento e o comentário ainda dizem que a correção não tirou nada da lista de recusas, e tirou.**
   - `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md:55-56` ainda diz que a lista de recusas fica como estava. Era exatamente essa a afirmação que a correção 3 mandava tirar.
   - `propor-ferramenta.ts:284-286` diz "Nada disso era recusado antes por esta regra". É falso no item 1: o texto de aluno de menos de 120 caracteres num pedido longo que cita redação ou discursiva era recusado no HEAD por `colado && REDACAO_OU_DISCURSIVA`, e agora passa (a sonda acima mostra "antes true, agora false").
   - O item 1 da lista do documento (`:63`) também não diz que esse falso negativo é novo.

   **Correção exigida:**
   - Tirar "a lista de recusas" de "Fica como estava".
   - No item 1 do documento e no comentário de `:284`, dizer com todas as letras que esse caso era recusado antes da correção e deixou de ser.
   - Levar essa troca ao Orquestrador no relatório, junto com o item "Fora desta correção".

**Recomendações**
- O pedido de 600 caracteres só cabe porque `FALA_DE_PLANEJAMENTO` contém "turma". Isso deixa a fronteira de 600/601 frágil a uma mudança nessa lista. Vale um comentário no teste de fronteira.
- `semTextoDeAluno` deixou de conferir `apontado` e passou a recusar só "apontado e colado". Conferi que sem texto colado o resultado é o mesmo do HEAD, mas a mudança não está descrita no documento.

Arquivos:
- `packages/core/src/ia/tasks/propor-ferramenta.ts`
- `packages/core/src/ia/tasks/numeros.test.ts`
- `packages/core/src/ia/__fixtures__/assistente-review-samples.ts`
- `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`
- A sonda do bloqueante 1 está em `/tmp/claude-1000/-home-joaquimdp-Documents-git--maestri-floors-educaia--specavaliacao-e-correcao--l1/724a896f-64d7-44c0-a983-f4e950bad449/scratchpad/rg-r2c.ts`. Roda com `npx tsx --conditions=source <arquivo>` a partir da raiz do andar.

## infra-guardian · 3ª rodada · APROVADO · 2026-11-23 15:19:09 · `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`

VEREDITO: APROVADO
Caminho quente tocado: IA (só a regra síncrona de entrada do Assistente, em `packages/core/src/ia/tasks/propor-ferramenta.ts`. A chamada ao modelo, a fila, o banco e a rota não mudaram.)
Rate limit: ok (não muda nesta rodada)
Fila e prioridade: ok (não muda nesta rodada)
Concorrência: protegida. Não há estado novo. `TEXTO_RECEBIDO`, `PEDE_RUBRICA_NO_PEDIDO` e `REDACAO_OU_DISCURSIVA` são regex de módulo sem `/g` e usadas com `.test`, então não guardam `lastIndex` entre um request e outro.
Índice e paginação: ok (não se aplica: não há query)
Degradação de IA: ok. O diff só mexe no filtro de entrada. Uma consequência: `pedeRubricaDeRedacaoComBloco` liga a conferência da saída em mais casos (pedido curto com dois-pontos ou aspas), e o caminho que barra a saída já existia.
Migration: não se aplica
Métrica e alerta: ok. Não há caminho novo para medir: é a mesma chamada síncrona, com três `.test` a mais por mensagem.
Bloqueantes: nenhum
Recomendações:
- `propor-ferramenta.ts:346`: `mensagemTrazTextoDeAluno` roda em cada turno anterior do professor (`:370`) e agora soma `pedeRubricaDeRedacaoComBloco`. Todas as regex novas são lineares (`(\w+ ){0,3}` tem limite e `\s*:` não volta atrás), então às 10h o custo continua desprezível. Mesmo assim, o teto de tamanho da mensagem no DTO, já anotado no `TODO.md`, continua sendo a defesa certa contra mensagem enorme repetida em vários turnos, e convém que ele limite também o total do histórico, não só a última mensagem.

## revisor-geral · 3ª rodada · APROVADO · 2026-11-23 15:19:16 · `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. As mudanças desta rodada (`TEXTO_RECEBIDO` e `pedeRubricaDeRedacaoComBloco`) estão descritas no documento da correção, em "Correção" (linhas 55-58 e 66-69), e ficam dentro de "Resto aceito".
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

Bloqueantes: nenhum.

As duas correções exigidas na 2ª rodada foram feitas:

1. **Expressão de texto recebido.** Foi feita.
   - `packages/core/src/ia/tasks/propor-ferramenta.ts:255` cria `TEXTO_RECEBIDO`, presa ao objeto. A linha `:324` a usa em `semTextoDeAluno`.
   - Os cinco casos com texto curto (60 caracteres) entraram como recusa no teste "o pedido de critérios que traz texto de aluno junto…" (`numeros.test.ts:656-660`). Entraram também como `r(...)` em `AMOSTRAS_DA_REVISAO`.
   - "Com base na BNCC" entrou como caso que passa, no teste e como `l(...)`.
   - A mutação `&& true` sobre `!TEXTO_RECEBIDO.test(texto)` está declarada.
   - Conferi que `normalize` mantém o `:`, então `tipo assim\s*:` funciona sobre `paraARegra`.
2. **Documento e comentário.** Foram corrigidos.
   - O comentário em `propor-ferramenta.ts:294-297` agora diz, com todas as letras, que esse caso "era recusado antes da correção e deixou de ser".
   - No documento, as linhas 71-74 e o item 2 de "Resto aceito" (linhas 89-91) declaram a troca.

As duas recomendações da rodada anterior também foram atendidas: o comentário de fronteira está em `numeros.test.ts:691-692`, e o tópico sobre `semTextoDeAluno` sem `apontado` está nas linhas 59-61 do documento.

Recomendações:
- `TEXTO_RECEBIDO` (`propor-ferramenta.ts:255`) cobre só `n[ao]s?`. Por isso "com base nessa redação: …", "nesta resposta" e "neste texto" sem "que recebi" não são pegos. Esses casos ficam dentro de "Resto aceito", item 1: são curtos, e a conferência da saída fica ligada por `pedeRubricaDeRedacaoComBloco`. Mesmo assim, vale incluir `ness[ae]|nest[ae]` ou registrar o caso no TODO.md.
- No documento (`tasks/correcoes/2026-11-23-d55-recusa-rubrica.md:70-74`), a frase "A lista de recusas muda, e para menos" continua dentro do tópico "Fica como estava". Ela deveria virar um tópico próprio, para o título não contradizer o texto.
- No documento, linha 108: a frase que lista o que vai ao relatório do Orquestrador cita "Fora desta correção" e o item 3, mas não a troca dos itens 1 e 2 de "Resto aceito". A ordem pedia que essa troca fosse ao relatório. Falta incluí-la na frase e no relatório do Implementador.
- A tabela de recomendações do documento, linha 124, diz "26 recusas `r(...)` novas e 2 entradas de legítimos novas (os quatro do achado e a BNCC)". O diff contra o HEAD confere com 26, mas a contagem foi feita na 2ª rodada, antes dos sete `r(...)` desta rodada. Vale reconferir as duas contagens e corrigir o texto se não baterem.

## llm-integrator · 3ª rodada · APROVADO · 2026-11-23 15:19:16 · `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`

VEREDITO: APROVADO

Perfis usados: nenhum novo. O diff mexe só em regex e heurística da regra de entrada e da conferência da saída da D55 em `propor-ferramenta.ts`, mais fixtures e testes. Não adiciona chamada de modelo, não troca o perfil de nenhuma e não toca em SDK.

Custo estimado por professor/mês: sem custo novo por chamada. A correção só deixa chegar ao modelo, no perfil que o `propor_ferramenta` já usa, os pedidos legítimos de rubrica que a recusa fixa barrava antes. Esse efeito é de poucas chamadas por professor ao mês e não foi medido. Cada chamada que deixou de ser recusa fixa passa a custar uma chamada normal desse perfil. Estimativa de volume por professor não houve nesta tarefa.

Prompt versionado: não se aplica. O diff não altera prompt.

Validação de schema: não se aplica. O diff não altera saída estruturada nem o schema.

Aprovação humana no caminho: não se aplica. Não há entrega de agente nem nota neste diff. A barreira D55 de saída (`julgaTextoDeAluno`, `atribuiNotaOuConceito`) continua e ficou mais ampla.

Bloqueantes: nenhum. Não havia correção exigida na rodada anterior. Conferi o diff contra o limite "Resto aceito" do documento da correção (decisão do Joaquim, 23/11/2026, alternativa A).
- Os falsos negativos que sobram caem dentro do limite declarado. São texto de até 120 caracteres numa mensagem de rubrica de uma linha, texto colado à frase sem pontuação, redação de aluno com "turma", "série", "nível" ou "gênero" no próprio texto, e o bloco sem palavra de redação (por exemplo `me dá descritores: <texto>`).
- O diff estreita o filtro e arma a barreira de saída:
  - `FALA_DE_PLANEJAMENTO` perdeu os verbos "vou", "vai", "queria", "quero", "preciso", "vao" e "antes de". Isso fecha o caso de uma redação de 260 caracteres que "cabia num pedido".
  - `TEXTO_RECEBIDO` recusa "que recebi", "recebi isto" e "tipo assim:". "Com base na BNCC" continua passando, e há teste para isso.
  - `pedeRubricaDeRedacaoComBloco` liga a conferência da saída em todo pedido de rubrica de redação ou discursiva com dois-pontos ou aspas, de qualquer tamanho. Antes ela ficava desligada abaixo de 160 caracteres.
- O comentário do código e a seção "Resto aceito" descrevem o mesmo limite. Cada item aceito tem teste ou amostra de fronteira.
- `packages/core/src/ia/tasks/numeros.test.ts` passa: 93 de 93.
- Em `src/ia` inteiro há 26 falhas, nenhuma desta correção.
  - 25 são testes de integração sem Postgres nem Redis no ambiente (`ECONNREFUSED`): `orcamento-do-mes.*` e `token-limiter.int`.
  - 1 é `src/ia/tasks/zz-sonda.test.ts`, que não existe no checkout (`Cannot find module`). Parece resíduo de sonda de outra sessão e não está no git status. Convém conferir que ele não entre no commit.

Recomendações:
- Os pendentes menores já estão no `TODO.md`: o falso negativo `me dá descritores: <texto curto>`, um `it` próprio para os três falsos positivos, o teste do texto colado sem pontuação até `julgaTextoDeAluno`, o `expect` sobre o tamanho no `.filter((p) => p.length >= 160)`, o comentário sobre as regex `/g` e o teto de tamanho da mensagem no DTO.
- Armar a conferência em todo pedido de rubrica com aspas pode barrar uma rubrica legítima que o modelo escreva sob medida para o enunciado. Se não houver teste que passe o pedido do achado com enunciado entre aspas e uma saída de rubrica inteira por `conferir` (`rubricaInteira` deve liberar), vale acrescentar. Não verifiquei se existe.
- O PRD da F7 mínima deve levar o desenho definitivo, em que a rubrica vira cartão da ferramenta e o enunciado vai em campo próprio. O item 5 do "Resto aceito" (texto curto de aluno chegando ao modelo) precisa pesar na escolha do provedor externo da F5c (D62).
- O documento da correção mudou no disco depois da minha leitura. Não o reli, e meu julgamento usa a versão que li.

Arquivos: `packages/core/src/ia/tasks/propor-ferramenta.ts`, `packages/core/src/ia/tasks/numeros.test.ts`, `packages/core/src/ia/__fixtures__/assistente-review-samples.ts`, `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`.

## pedagogia-reviewer · 3ª rodada · APROVADO · 2026-11-23 15:19:21 · `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`

VEREDITO: APROVADO

Amostras avaliadas: 13 pedidos que sondei à mão, mais os testes e fixtures do diff. Rodei `numeros.test.ts` e `tools/guardas/amostras-da-d55.test.ts`: 109 testes passam. O arquivo de sonda que criei foi apagado e não sobrou nada no `git status`.

Problemas por categoria:
- **Gabarito e D55 (regra fixa de entrada):** sem problema dentro do limite de "Resto aceito".
- **Nível e alinhamento:** os quatro pedidos do achado, os de rubrica com BNCC e os de critérios em geral passam. Isso era o sintoma da correção.
- **Tutor:** a mudança não toca o tutor.

Exemplos concretos do que saiu errado:
- **Correção da rodada 2 conferida.** O texto de aluno com "vou", "vai" e "antes de" (`REDACAO_COM_VERBOS_COMUNS`) agora é recusado. Na sonda, três variantes foram recusadas: `critérios pra redação: <t2>`, `rubrica de redação "<t2>"` e `rubrica de redação, <t2>`.
- **Furo fora do limite:** nenhum achado. Todos estes foram recusados:
  - Textos de 180 a 250 caracteres, sem palavra de planejamento, com pontuação, com dois-pontos, aspas, ponto ou quebra de linha, e com "quero falar…".
  - Texto de aluno com "Querido diário…".
  - Texto de aluno entre aspas com vírgulas seguidas.
- **O que passou na sonda cai nos itens declarados:**
  - `me dá descritores: <texto de 190 caracteres>` é o item 4 de "Resto aceito". É um bloco colado sem palavra de redação, de juízo ou de opinião. Sob o limite declarado, não bloqueia.
  - O texto de aluno que usa "nível", "turma" e "critério" no próprio texto é o item 3. O texto da sonda, que foi aceito, traz essas três palavras. Também não bloqueia.
- **Conferência da saída:** `pedeRubricaDeRedacaoComBloco` fecha o furo que o HEAD já tinha. Pedido curto com dois-pontos ou aspas passava com a conferência desligada, e agora liga. Há teste para isso (`julgaTextoDeAluno` verdadeiro) e mutação que o prende.

Ajuste sugerido no prompt ou na recuperação de contexto: nenhum nesta rodada. O desenho que separa de verdade, com a rubrica no cartão da ferramenta e o enunciado em campo próprio, já está registrado para o PRD da F7 mínima (item 6 de "Resto aceito" e `TODO.md`).

Bloqueantes: nenhum.

Recomendações:
1. Confirmar que a mensagem de recusa fixa diz ao professor que a rubrica é possível sem o texto do aluno no pedido. A correção deixou isso como decisão de produto, e é o que o professor lê quando cai num falso positivo do lado seguro ("critérios pra redação da turma", "vou aplicar", níveis "de 0 a 100").
2. Manter os itens do `TODO.md` que a correção já listou:
   - o falso negativo `me dá descritores: <texto>`;
   - o `it` próprio para os três falsos positivos;
   - o teste de texto colado sem pontuação até `julgaTextoDeAluno`;
   - o comentário sobre `lastIndex` nas regex `/g`;
   - o teto de tamanho da mensagem no DTO.
3. Na F5c (D62), pesar que texto curto de aluno, de até 120 caracteres, pode chegar ao modelo. Hoje o modelo é o Ollama local, mas um provedor externo muda o peso do item 5 de "Resto aceito".

Arquivos relevantes (todos em ``):
- `packages/core/src/ia/tasks/propor-ferramenta.ts`
- `packages/core/src/ia/tasks/numeros.test.ts`
- `packages/core/src/ia/__fixtures__/assistente-review-samples.ts`
- `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`

## privacy-guardian · 3ª rodada · APROVADO · 2026-11-23 15:19:49 · `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`

VEREDITO: APROVADO

**Campos pessoais tocados:** nenhum. O diff só muda o filtro por vocabulário da entrada (`propor-ferramenta.ts`), as amostras sintéticas e os testes. Não há migration, DTO, rota nem log novo.

**Fora da tabela de dados do docs/lgpd.md:** nenhum campo.

**Autorização por objeto:** não se aplica, porque o diff não cria rota nem repository.

**Logs:** limpos. `propor-ferramenta.ts` não tem `logger` nem `console`.

**Auditoria:** não se aplica. A correção não cria ação auditável e a aprovação de saída de IA continua como estava.

**Envio externo:**
- O que pode chegar ao modelo é o pedido de rubrica com um trecho curto de aluno, dentro do "Resto aceito" (itens 1, 3 e 4).
- O modelo hoje é o Ollama local. A regra de provedor do gateway e o registro em `ExecucaoAgente` não mudaram.
- As três mudanças do diff só fecham o filtro, nenhuma abre:
  - `FALA_DE_PLANEJAMENTO` ficou mais estreita (linha 168).
  - `TEXTO_RECEBIDO` passa a recusar o texto recebido (linhas 255 e 322).
  - `pedeRubricaDeRedacaoComBloco` (linhas 225 a 227) liga a conferência da saída em pedidos que antes passavam sem ela.
- As regex novas usadas com `.test` não têm a flag `/g`, então não há o problema de `lastIndex`.

**Seed/fixture:** sintético. `REDACAO_COM_VERBOS_COMUNS` e `TEXTO_CURTO_DE_ALUNO` são textos inventados, sem nome real nem identificador.

**Bloqueantes:** nenhum.

O que conferi:
- **Árvore igual à auditada:** os três arquivos de `packages/` no disco são idênticos aos da árvore `f5d227e3`.
- **Testes:** `numeros.test.ts` passa inteiro (93 de 93).
- **Sonda fora do limite:** escrevi casos com texto de aluno de 134 caracteres seguidos, com pontuação e sem palavra de planejamento. Para isso pus um teste temporário em `src/ia/tasks/` e apaguei logo depois; o `git status` voltou ao que era.
  - `monta os critérios pra redação: <134>`, `cria uma rubrica de discursiva "<134>"` e `queria critérios pra redação. <134> Com quatro níveis.` são recusados.
  - Dois casos passam, e os dois estão dentro do "Resto aceito", com a conferência da saída ligada:
    - `me dá descritores: <134>`, o bloco sem palavra de redação (item 4).
    - Texto de aluno com "série", "turma" e "nível" dentro dele (item 3).
- **Correções exigidas na rodada anterior:** não havia nenhuma.

**Recomendações:**
1. Os itens 4 e 5 do "Resto aceito" deixam o filtro de entrada sem papel de barreira de privacidade: o bloco sem palavra de redação passa de qualquer tamanho, e a conferência da saída barra o juízo, não o envio. Quando a F5c escolher provedor externo (D62), o PRD dela precisa tratar isso como requisito de envio mínimo. Hoje só está no relatório e no `TODO.md`.
2. O comentário sobre as regex `/g` (`FINALIDADE_DA_RUBRICA`, `GENERO_DE_OPINIAO`, `DESTINO_DA_RUBRICA`, linhas 206, 208 e 248) continua pendente no `TODO.md`. Vale fazer antes que alguém as use com `.test`.

Arquivos auditados:
- packages/core/src/ia/tasks/propor-ferramenta.ts
- packages/core/src/ia/tasks/numeros.test.ts
- packages/core/src/ia/__fixtures__/assistente-review-samples.ts
- tasks/correcoes/2026-11-23-d55-recusa-rubrica.md
- TODO.md

## conformidade-reviewer · 3ª rodada · APROVADO · 2026-11-23 15:20:04 · `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A correção mexe só na regra de entrada da D55, nas amostras e nos testes. Todos com autor humano? sim, nada mudou nisso.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. A tarefa não toca em entrega nem em aprovação.
Supervisão do tutor: ok. O tutor está fora do diff.
Autonomia declarada e visível: sim, sem mudança.

**A correção que exigi na 2ª rodada foi feita, nas três partes:**
- **(a) Feita.** `propor-ferramenta.ts:231`: `FALA_DE_PLANEJAMENTO` ficou só com substantivos de planejamento e "pra eu". O comentário em `:225-230` explica por que os verbos saíram.
- **(b) Feita.** `REDACAO_COM_VERBOS_COMUNS` (o texto de aluno com "vou", "vai" e "antes de") está nos casos de recusa de `numeros.test.ts` e em `AMOSTRAS_DA_REVISAO`. Na lista de recusa entraram os dois casos exigidos e mais dois.
- **(c) Feita.** Há dois blocos `mutacao`: um devolve só "vai" à lista e o outro devolve a lista inteira.
- **Provei por sonda**, com cópias de `propor-ferramenta.ts` na scratchpad:
  - Com a árvore atual, os quatro casos com `REDACAO_COM_VERBOS_COMUNS` são recusados.
  - Com "vai" de volta, ou com a lista antiga inteira, os quatro passam. Logo, as duas mutações deixam o teste vermelho.
  - Os quatro pedidos do achado seguem passando.
- **Testes:** `numeros.test.ts` e `tools/guardas/amostras-da-d55.test.ts` passam, 109 de 109.

**O que a rodada mudou e eu conferi:**
- `TEXTO_RECEBIDO` (`:255`, sem `/g`) só entra em `semTextoDeAluno`. Ele recusa as cinco expressões que o revisor-geral exigiu, mesmo com o texto de 60 caracteres. "com base na BNCC" segue passando, e existe mutação para isso.
- `pedeRubricaDeRedacaoComBloco` (`:355`) só liga a conferência da saída, que antes ficava desligada abaixo de 160 caracteres. A regra dos turnos seguintes continua usando `trazTextoColado` e não mudou. O efeito, portanto, é só do lado seguro. Exemplo: `monta os critérios pra redação: <texto de 60 caracteres>` antes passava com a conferência desligada e agora passa com ela ligada.
- Fora do limite declarado em "Resto aceito", não achei falso negativo novo. O que ainda passa é do mesmo tipo que já passava no HEAD, cabe nos itens 3 e 4, e chega com a conferência ligada.

Bloqueantes: nenhum

Recomendações:
1. **Uma frase do item 3 de "Resto aceito" não se confirma.** O documento diz que "Nas sondas da conformidade esses textos foram recusados por outra marca". Medi um contraexemplo:
   - `monta os critérios pra redação: Na minha turma todo mundo usa celular… O nivel de atencao caiu… para a nossa serie…` (271 caracteres)
   - O HEAD **recusava** esse pedido. Agora ele **passa**, com a conferência ligada.
   - Está dentro do item 3, então não bloqueia. Mas a frase deve sair do documento, e o caso deve ir ao relatório ao Orquestrador como troca do HEAD.
2. **Duas promessas sobre a conferência "armada" valem em parte só.** Uma está no item 4 de "Resto aceito". A outra está no comentário de `propor-ferramenta.ts:300` ("Todo texto assim chega à conferência da saída…"). O caso que as desmente:
   - `me dá descritores: <texto de 60 caracteres>` (79 caracteres no total) chega ao modelo **com a conferência desligada**.
   - É o mesmo comportamento do HEAD, e o pendente já está no `TODO.md`. O texto deve dizer "armada quando o bloco passa de 160 caracteres, ou de 80 depois dos dois-pontos".
3. **O comentário cita um teste com nome que não existe.** `propor-ferramenta.ts:229` fala no "teste `comVai`", mas o teste usa `REDACAO_COM_VERBOS_COMUNS`. Trocar o nome no comentário.

Sondas, que rodam com `npx tsx --conditions=source <arquivo>` a partir da raiz do andar:
- /tmp/claude-1000/-home-joaquimdp-Documents-git--maestri-floors-educaia--specavaliacao-e-correcao--l1/724a896f-64d7-44c0-a983-f4e950bad449/scratchpad/r3/sonda.ts compara a árvore atual com as duas mutações, nos casos de `REDACAO_COM_VERBOS_COMUNS` e nos quatro pedidos do achado.
- /tmp/claude-1000/-home-joaquimdp-Documents-git--maestri-floors-educaia--specavaliacao-e-correcao--l1/724a896f-64d7-44c0-a983-f4e950bad449/scratchpad/r3/sonda2.ts compara o HEAD com a árvore atual nos casos das recomendações.

Arquivos auditados:
- packages/core/src/ia/tasks/propor-ferramenta.ts
- packages/core/src/ia/tasks/numeros.test.ts
- packages/core/src/ia/__fixtures__/assistente-review-samples.ts
- tasks/correcoes/2026-11-23-d55-recusa-rubrica.md

Não editei nenhum arquivo do repositório, e a árvore está como a recebi.

## test-engineer · 3ª rodada · APROVADO · 2026-11-23 15:20:06 · `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`

VEREDITO: APROVADO

Cenários exigidos (3ª rodada, só o diff `ce55621..f5d227e` e o que ele toca):
- caminho feliz: o pedido de rubrica de verdade continua passando, mesmo depois que `FALA_DE_PLANEJAMENTO` ficou mais estreita. Isso vale para os quatro pedidos do achado e para o pedido longo "com base na BNCC".
- borda 1: uma redação de aluno com "vou", "vai" e "antes de" (260 caracteres) já não "cabe num pedido".
- borda 2: o texto de aluno dito com "que recebi", "recebi isto", "tipo assim:" ou "com base no texto" é recusado mesmo curto (60 caracteres).
- borda 3: o pedido curto de rubrica de redação ou discursiva com dois-pontos ou aspas liga a conferência da saída. Sem esses sinais, ou sem a palavra de redação ou discursiva, ou sem o verbo de pedir rubrica, a conferência não liga.
- falso positivo da saída: com a conferência ligada, a rubrica em si (descritores por nível e por critério) continua passando.
- permissão e isolamento: não se aplicam, porque é função pura de `packages/core/src/ia/tasks/`, sem dado de escola.
- concorrência: não se aplica, porque é regra pura e sem estado.
- adaptador de IA: nenhum teste do diff chama modelo.

Cobertos:
- **"vou", "vai", "antes de":** quatro pedidos com `REDACAO_COM_VERBOS_COMUNS` no `it` "o pedido de critérios que traz texto de aluno junto…" (`numeros.test.ts:651-654`). Dois blocos de mutação devolvem "vai" e os verbos todos à lista, e o comentário do código explica por que eles saíram.
- **`TEXTO_RECEBIDO`:**
  - Os cinco pedidos curtos estão em `numeros.test.ts:656-660`.
  - "Recebi isto", "tipo assim:" e "nesta que recebi" são, cada um, a única marca do seu caso, então cada um prova uma das três primeiras alternativas.
  - O bloco `&& true` derruba a cláusula inteira.
  - O bloco `/\bbase\b/` é provado pelo caso da BNCC em `numeros.test.ts:606`, com mais de 160 caracteres.
- **`pedeRubricaDeRedacaoComBloco`:** `it` próprio (`numeros.test.ts:722-738`) com três casos positivos de menos de 160 caracteres, que chegam até `julgaTextoDeAluno`. Os quatro casos negativos derrubam, um a um, as três condições da função, e há um bloco para cada condição e um para a ligação em `mensagemTrazTextoDeAluno`. Os quatro blocos novos do `cada marca da mensagem, sozinha, liga a chave` cobrem a linha reescrita.
- **Falso positivo da saída:** o teste de `numeros.test.ts:409`, que roda com a conferência ligada, já cobria a rubrica.
- **Amostras:** as sete `r(...)` e a `l(...)` novas em `AMOSTRAS_DA_REVISAO` passam com a taxa declarada.
- **Execuções:** `npx vitest run src/ia/tasks/numeros.test.ts` deu 93/93 verdes. `tools/guardas/amostras-da-d55.test.ts` deu 16/16, com as amostras `rubrica_de_discursiva-004/005/012/018/007` intactas.
- **Limite do "Resto aceito":** nenhum caso fora dele passa. O texto de mais de 120 caracteres seguidos, com pontuação e sem palavra de planejamento, é recusado e tem teste.
- Sem `.skip`, sem teste comentado e sem mock que esconda a regra.

Bloqueantes: nenhum.

Recomendações:
1. **A quarta alternativa de `TEXTO_RECEBIDO`** (`\bbase n[ao]s? (?:texto|resposta|redac\w*|producao|que)\b`, `propor-ferramenta.ts:180`) nunca é a única marca de um caso. Os dois pedidos com "com base n…" (`numeros.test.ts:656` e `:659`) também têm "que recebi", e "base nesta" não casa. Se a alternativa for removida, nenhum teste falha. O caso que ela pegaria sozinha é texto curto, então está dentro do item 1 do "Resto aceito" e não bloqueia. Mesmo assim o documento afirma esse comportamento. Sugestão: acrescentar `${PLANEJAMENTO_DO_PEDIDO}. Com base no texto: ${TEXTO_CURTO_DE_ALUNO}` à lista de recusa e o bloco de mutação que tira a alternativa.
2. **O `it` novo prova a chave por `conversaTrazTextoDeAluno` + `julgaTextoDeAluno`**, e não pela `proporFerramenta.conferir`. A ligação entre as duas já está provada em `numeros.test.ts:763`. Mesmo assim, um caso que passe `conferir(entradaDoAssistente('cria critérios pra discursiva: …'), juízo)` e espere `toHaveLength(1)` fecharia o caminho inteiro do pedido curto.
3. **Falta um caso de pedido legítimo curto com dois-pontos** (por exemplo `cria uma rubrica de redação: dissertativo-argumentativa, quatro níveis`) passando pela `conferir` com a saída de rubrica do `falso`, no formato do `it` de `numeros.test.ts:774`. O pedido curto com dois-pontos é agora o professor que mais vai ver a conferência ligada, e o caso fixaria que essa saída não é recusada por excesso.
4. **As pendências da rodada 2 estão no `TODO.md` e não exigem nada aqui.** São estas: o `it` próprio para os três falsos positivos, `corrige o que escreveram no caderno deles`, o texto colado sem pontuação até `julgaTextoDeAluno`, o `expect` de tamanho no `.filter`, o aviso das regex `/g` e o teto do DTO.

Arquivos auditados:
- `packages/core/src/ia/tasks/propor-ferramenta.ts`
- `packages/core/src/ia/tasks/numeros.test.ts`
- `packages/core/src/ia/__fixtures__/assistente-review-samples.ts`
- `tasks/correcoes/2026-11-23-d55-recusa-rubrica.md`
- `TODO.md`
