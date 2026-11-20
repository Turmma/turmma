# Achados das revisões — `tasks/correcoes/2026-11-20-merge-da-develop-leitura-de-null.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-20 18:29:46 · `tasks/correcoes/2026-11-20-merge-da-develop-leitura-de-null.md`

VEREDITO: APROVADO
Tela vista: não. A vitrine não semeia artefato e a mudança é só um rótulo dentro de um artefato aberto. Revisei pelo código e pelo teste `Artefato.test.tsx`. A tela será vista na validação.
Estados: ok. A mudança não mexe em carregando, vazio ou erro, e o teste novo fica no bloco "os quatro estados".
Acessibilidade: ok. O rótulo é um `<li>` dentro da lista de habilidades que já existia, com `break-words`, a mesma classe das outras linhas. Não cria alvo de toque nem campo.
Chromebook fraco: sem impacto. É uma linha de texto condicional.
Celular: sem impacto. O `<li>` tem `break-words` e `min-w-0` herdado da seção, então não gera rolagem horizontal em 360 px.
Ação oficial protegida: sim. O diff não toca aprovar, publicar nem exportar.
Bloqueantes: nenhum.
- `apps/web/src/areas/professor/artefatos/ConteudoDoArtefato.tsx:149` mostra `ROTULO_SEM_HABILIDADE` quando `habilidades` vem vazia. A constante vem de `@educa/shared` (importada na linha 1). O texto é o mesmo "Sem habilidade" já usado em `Aprovar.tsx`, `TurmaHoje.tsx` e no PDF (`pdf-do-artefato.ts:238`), então a interface fica coerente entre tela e PDF. É português comum, sem termo técnico nem id.
- Os dois testes novos (`Artefato.test.tsx`) provam as duas pontas: plano sem habilidade mostra o rótulo e não mostra código; plano com habilidade lista o código e não mostra o rótulo.

Recomendações:
- Quando faltar habilidade, o rótulo é uma linha cinza solta. Um dia vale uma frase que diga o próximo passo, por exemplo "Sem habilidade da BNCC associada". Isso não bloqueia.
- Os rótulos `Sem habilidade` do plano na tela e no PDF (`pdf-do-artefato.ts:238`) estão alinhados. Se o texto mudar, os dois mudam juntos, porque vêm da mesma constante.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-20 18:29:52 · `tasks/correcoes/2026-11-20-merge-da-develop-leitura-de-null.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova. O diff do merge contra a spec (`git diff --cached HEAD`) não traz migration, schema nem controller.

Queries verificadas:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/governanca/analista.repository.ts:212` e `:299`: as consultas `acertosPorRecorte` e `acertosDaTurma` só ganharam `nulls last` no `orderBy`. O filtro continua em `#lotesAprovados()` (linha 102), que tira `escolaId` e `anoLetivoId` do contexto autenticado por `requireEscolaId()` e `requireAnoEmCurso()`. Nenhum parâmetro de escopo veio do cliente.
- `minha-atividade.service.ts`, `correcao-de-objetiva.ts`, `pdf-do-artefato.ts`, `relatorio-da-correcao.ts` e `ConteudoDoArtefato.tsx`: as mudanças são só comentário, rótulo de apresentação e texto. Nenhuma toca acesso a dado nem escopo.
- Nenhum endpoint novo, nenhum `escolaId` lido do corpo ou da query, nenhum `@Unscoped()` novo, nenhum id novo.
- A camada de rede não muda.

Teste de isolamento: presente e efetivo para o que a mudança alcança. Esta correção não cria módulo, então não precisa de teste de isolamento próprio. O teste novo de `analista.int.test.ts` ("no banco: o `codigo: null`…") lê as consultas reais no contexto da escola `c` e compara o resultado com `toEqual` exato (`[[código, 6, 6], [null, 3, 4]]`). Sem a cláusula de escopo de `#lotesAprovados`, ele quebraria se a bancada tiver lotes aprovados de outra escola, como a escola `a` montada antes no mesmo arquivo.

Bloqueantes: nenhum.

Recomendações:
- O documento da correção (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/tasks/correcoes/2026-11-20-merge-da-develop-leitura-de-null.md:71`) diz que a ordem fica provada por `analista.int.test.ts`. O que o teste prova é a ordem com o padrão do Postgres, não a cláusula `nulls last`, que é um mutante equivalente. Não bloqueia. Vale deixar escrito no teste que ele não distingue as duas versões, para ninguém contar com ele se a ordem um dia passar a ser decrescente.

## llm-integrator · 1ª rodada · APROVADO · 2026-11-20 18:30:01 · `tasks/correcoes/2026-11-20-merge-da-develop-leitura-de-null.md`

VEREDITO: APROVADO
Perfis usados: nenhum novo. O merge não adiciona nem altera chamada de modelo, prompt, perfil ou provedor. A única mudança no `packages/core/src/ia/tasks/` que não é teste é `relatorio-da-correcao.ts`. Nele, `revisaoDaQuestao` só escolhe a preposição ("do conteúdo desta questão" ou "de “…”") no texto determinístico do `falso`, e o `relatorioInputSchema` já aceitava `habilidade: null` desde a 10.0. Não há SDK de provedor fora do adaptador. Não rodei os testes: a revisão é só de leitura do diff, e as mutações e os testes ficaram como o documento da correção os descreve.
Custo estimado por professor/mês: não se aplica, porque nenhuma chamada nova. O custo por professor e por perfil das tarefas envolvidas (`relatorio_da_correcao`, `gerar_atividade_objetiva`, `gerar_plano_de_aula`, `adaptar_atividade`, `resumo_do_analista`, `turno_do_tutor`) segue o das tarefas 10.0 a 13.0 da spec. O merge não muda número de chamadas, tamanho de entrada nem perfil.
Prompt versionado: sim (`PROMPT_RELATORIO_DA_CORRECAO` e os demais continuam em arquivo, e o diff não os toca)
Validação de schema: sim. Os testes novos cobrem o seguinte:
- `conteudo.test.ts` mostra que a conferência aceita `habilidade: null` e `habilidades: []`, e que a adaptação que perde ou ganha habilidade é recusada.
- `turno-do-tutor.test.ts` mostra que o Tutor recusa a chave `habilidade` ausente e aceita `null`.
- `numeros.test.ts` confere o `resumoDoAnalista` contra `conteudoDoResumoDoAnalistaSchema` e contra a conferência.
Aprovação humana no caminho: não se aplica. Esta tarefa não altera entrega, nota nem o que chega ao aluno, e o rótulo "Sem habilidade" é só leitura do plano.
Bloqueantes: nenhum.

O que conferi no diff:
- Os quatro acréscimos da correção batem com o descrito no documento. São o rótulo no PDF (`apps/api/src/artefato/pdf-do-artefato.ts:237`), o rótulo na tela (`apps/web/src/areas/professor/artefatos/ConteudoDoArtefato.tsx:149`), a concordância no relatório (`packages/core/src/ia/tasks/relatorio-da-correcao.ts:58`, mais o uso na linha 73) e o `nulls last` nas duas consultas do Analista (`apps/api/src/governanca/analista.repository.ts:212` e `:299`).
- O `ROTULO_SEM_HABILIDADE` vem de `@educa/shared` (`packages/shared/src/assistente/conteudo.ts:42`) e está importado nos dois arquivos que o usam, sem duplicação.
- Não entra dado pessoal novo nem log novo.
- Nenhuma consulta nova perde o escopo de escola. A mudança no repository é só a ordem do `ORDER BY`, e o filtro `#lotesAprovados` não foi tocado.
- O texto novo do relatório continua só com número agregado, sem aluno identificado.
- Os blocos de mutação têm teste nomeado, e o mutante equivalente do `nulls last` está justificado.

Recomendações:
- Só o documento da correção diz que o texto "A maioria acertou; os erros pedem uma revisão rápida do conteúdo desta questão" foi concordado. Um teste que também fixe a forma com habilidade ("de “…”") em `numeros.test.ts` protegeria o outro ramo de `revisaoDaQuestao`, caso alguém simplifique a função.
- O comentário em `minha-atividade.service.ts:150` descreve um comportamento (`habilidade: null` quando `codigo` é nulo) que depende de `habilidades.get(null)` devolver `undefined`, e por isso hoje devolve `[]`, não uma linha com `habilidade: null`. Vale conferir se o comentário diz o que o código faz, ou se a linha sem habilidade chega de outro modo. Ao ler o diff, o texto do comentário e a saída do `flatMap` parecem divergir. Não bloqueia, porque o comportamento é o da spec e está coberto pelos testes de `minha-atividade`.

Arquivo revisado: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/tasks/correcoes/2026-11-20-merge-da-develop-leitura-de-null.md`

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-20 18:30:04 · `tasks/correcoes/2026-11-20-merge-da-develop-leitura-de-null.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum neste diff. O merge não toca `Nota`, aprovação de lote, job, seed, importação nem webhook. A única linha de fluxo que mudou de lugar foi no teste `apps/api/src/atividade/correcao/correcao.int.test.ts:141-150`: agora o resumo do lote é lido antes de `aprovarOLote`, e a aprovação humana continua acontecendo antes de lermos o desempenho e o diagnóstico. Todos os caminhos têm autor humano? Sim (nada mudou).

Decisão autônoma sobre aluno: ausente. As mudanças são de leitura e de texto:
- o rótulo "Sem habilidade" no plano;
- a preposição no relatório da objetiva;
- `nulls last` nas duas consultas do Analista.

Nenhuma delas aprova, reprova ou encaminha aluno.

Aprovação registrada: ok.
- **Plano.** O rótulo no plano (`apps/api/src/artefato/pdf-do-artefato.ts:237-238` e `apps/web/src/areas/professor/artefatos/ConteudoDoArtefato.tsx:149`) só muda o que o professor lê no artefato. O artefato continua nascendo pendente.
- **Relatório.** A frase do relatório (`packages/core/src/ia/tasks/relatorio-da-correcao.ts:58-59,73`) fica dentro do relatório da correção de objetiva, que é o que o professor confere antes de aprovar o lote.
- **Discursiva e redação.** Nada toca discursiva ou redação (D55).
- **Adaptação.** A adaptação ficou mais presa, não mais solta. `conferencia.test.ts` e `conteudo.test.ts` provam duas coisas: a versão adaptada não dá habilidade a uma questão que não tinha e não tira a de uma que tinha, e o código e a descrição são conferidos um a um.

Supervisão do tutor: ok. A única mudança é um teste novo (`packages/core/src/ia/tasks/turno-do-tutor.test.ts:1122-1124`), e ele aperta o esquema de entrada: a chave `habilidade` ausente é recusada. O escopo, o registro e o resumo não mudaram.

Autonomia declarada e visível: sim (não foi alterada).

Itens 7 a 9 (supervisão não é vigilância, medir o professor, recusar a ferramenta):
- **Item 7, vigilância.** Nenhum campo de comportamento ou de emoção entra.
- **Item 8, medir o professor.** O teste novo do Analista (`apps/api/src/governanca/analista.int.test.ts:218-279`) mexe só em agregado de acerto por série e disciplina, num recorte com `professores: 2`. A leitura nominal da turma passa pelo `nominal()` já existente, com finalidade e auditoria. Não aparece ranking nem métrica sobre o professor.
- **Item 9, recusar a ferramenta.** Nada no diff gera indicador de quem não usa a ferramenta.

Tela: não houve fotos. Revisei pelo código e por `apps/web/src/areas/professor/artefatos/Artefato.test.tsx:218-237`. O rótulo é um texto fixo do sistema, e não uma saída de IA nova. Não aparece nota, conceito nem sugestão de nota.

Bloqueantes: nenhum.

Recomendações:
- `apps/api/src/atividade/correcao/correcao-de-objetiva.ts:114-119` explica a mesma regra duas vezes: no JSDoc, citando a correção da develop, e no comentário logo abaixo, citando a 10.0. Basta uma explicação, com as duas referências.
- `apps/api/src/atividade/minha-atividade/minha-atividade.service.ts:150`: o comentário novo depende de `habilidadesDaAtividade` (de `apps/api/src/atividade/correcao/lote.ts:30`) guardar `null → null`. Se alguém trocar pela versão homônima de `apps/api/src/tutor/turno.command.ts:66`, que descarta o `null`, a linha sem habilidade some do diagnóstico da aluna sem nenhum aviso. O teste de ponta a ponta em `correcao.int.test.ts` pegaria isso, mas os dois nomes iguais convidam ao engano. Vale renomear uma das duas funções numa tarefa futura.
- `docs/regulacao.md` não foi tocado e não precisava ser.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-20 18:30:17 · `tasks/correcoes/2026-11-20-merge-da-develop-leitura-de-null.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/atividade/correcao/correcao-de-objetiva.ts:21-24`: o comentário de cima da função repete o comentário dentro dela (linha 26), e os dois citam uma origem diferente (a correção da develop num, a 10.0 no outro). Basta um.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/governanca/analista.repository.ts:212` e `:299`: o `nulls last` não muda o plano nem o custo das duas consultas. A ordenação é feita sobre o resultado já agrupado dos lotes aprovados, então não há o que medir com `EXPLAIN`. Fica registrado só para que ninguém trate essa linha como otimização.

O que sustenta o veredito:
- **Código:** o merge muda só leitura e texto. Entram o rótulo "Sem habilidade" no plano (no PDF e na tela), a frase "do conteúdo desta questão" no relatório, o `nulls last` nas duas consultas do Analista e um comentário em `minha-atividade.service.ts`. Esse comentário está certo: em `lote.ts:30`, `habilidadesDaAtividade` guarda a chave `null` apontando para `null`.
- **Nada que a auditoria barra:** nenhuma chamada de modelo, job, migration, estado em memória ou nova gravação concorrente.
- **Testes:** nenhum chama provedor pago. O teste novo do Analista roda a consulta real no banco, com chamadas à API interna.
- **Prova:** o caminho do aluno ganhou só um comentário. Salvar resposta, relógio e retomada não mudaram.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-20 18:30:19 · `tasks/correcoes/2026-11-20-merge-da-develop-leitura-de-null.md`

VEREDITO: APROVADO

O merge mexe só na leitura dos três formatos de habilidade (`habilidade: null`, `habilidades: []`, `codigo: null`). Não cria campo de pessoa, rota nova, log nem envio novo.

Campos pessoais tocados: nenhum. Os campos alterados (`habilidade`, `habilidades`, `codigo` do diagnóstico) são da BNCC, não de pessoa. O diagnóstico por aluno (`porHabilidade`) já existia e mudou só a ordem e a leitura da linha `null`.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok.
- Nenhuma rota ou repository ganhou escopo novo. Em `analista.repository.ts:212` e `:299` mudou só o `orderBy` (`nulls last`); filtro, agrupamento e escopo continuam iguais.
- O teste novo em `correcao.int.test.ts` lê a prova como aluno da turma e confere que o corpo não leva o gabarito.

Logs: limpos. O diff não tem `logger` nem `console`.

Auditoria: presente. Não há ação nova que a exija. O teste novo do Analista usa a rota nominal que já existe (`/v1/analista/nominal` com `finalidade`), que continua registrando `analista.nominal_lido`. O relatório da correção e o resumo do Analista continuam sendo só agregado.

Envio externo: nada muda.
- `relatorio-da-correcao.ts:58-73` troca só a preposição de um texto que o domínio monta, sem dado de aluno.
- O teste novo do Tutor (`turno-do-tutor.test.ts:1122-1124`) só confirma que a entrada sem a chave `habilidade` é recusada. A entrada do modelo não ganha campo.

Seed/fixture: sintético. Os nomes novos dos testes ("Aluna Sintética Cecília Lopes", "Aluno Sintético Dante Alves", "Ana Beatriz", "Camila Duarte") seguem o padrão sintético da casa. O diff não tem CPF, e-mail nem telefone.

Tela, revista pelo código porque não houve foto: `ConteudoDoArtefato.tsx:149` mostra o texto fixo "Sem habilidade" no plano do professor e nenhum dado de pessoa. `Artefato.test.tsx:218-237` cobre os dois casos.

Pergunta de fechamento: o merge não muda a resposta. Ele não acrescenta dado guardado nem destino de envio, e o arquivo do titular e o registro em `ExecucaoAgente` continuam como estavam.

Bloqueantes: nenhum.

Recomendações:
- `tasks/correcoes/achados/2026-11-20-leitura-de-habilidade-nula.md` (por volta da linha 875 do diff) cita um caminho absoluto com o usuário da máquina (`/home/joaquimdp/...`). O repositório é público. Prefira o caminho relativo ao repositório. Não é dado de titular, por isso não bloqueia.
- `minha-atividade.service.ts:150`: o comentário novo diz que a linha `codigo: null` vai com `habilidade: null`. Isso só é verdade porque `habilidadesDaAtividade` (`lote.ts:30-37`) registra a chave `null`. Vale citar essa função no comentário, para que ninguém troque o `flatMap` achando que a linha some.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-20 18:30:59 · `tasks/correcoes/2026-11-20-merge-da-develop-leitura-de-null.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

O merge segue a regra que o documento da correção escreve. A `develop` só trouxe um commit (`e2e3213c`). Dos 50 arquivos dele, os que ficaram iguais ao HEAD são os leitores que a spec já tinha escrito nas tarefas 10.0 a 13.0.

Conferi os seis arquivos de teste da `develop` que não entraram no merge: `turno.command.test.ts`, `Atividade.test.tsx`, `Analista.test.tsx`, `Aprovar.test.tsx`, `TurmaHoje.test.tsx` e `alunos-da-turma.test.ts`. A spec já cobre, em cada um, o caso equivalente: "Sem habilidade", `habilidade: null` e `codigo: null`. Nenhum teste dos três formatos se perdeu.

Do lado da correção entraram só as quatro mudanças descritas:
- o rótulo do plano sem habilidade no PDF (`pdf-do-artefato.ts:238`) e na tela (`ConteudoDoArtefato.tsx:149`), com a mesma constante `ROTULO_SEM_HABILIDADE`, como pede a §7c, linha "Migration", da Tech Spec;
- a concordância "do conteúdo desta questão" (`relatorio-da-correcao.ts:58` e `:73`);
- o `nulls last` (`analista.repository.ts:212` e `:299`), registrado como mutante equivalente e com o motivo escrito.

O comentário novo em `minha-atividade.service.ts:150` diz a verdade: `habilidadesDaAtividade` (`lote.ts:30`) põe `null` na chave `null`, então a linha sai com `habilidade: null` e não é descartada.

O caso que a spec desfez de propósito ficou registrado no documento: a geração agora aceita `null` e `[]`, e `conteudo.test.ts` passou a afirmar a aceitação.

Recomendações:
- **Dois rótulos no mesmo PDF.** O gabarito diz "sem habilidade da BNCC" (`apps/api/src/artefato/pdf-do-artefato.ts:225`, texto fixo) e a seção do plano diz "Sem habilidade" (`:238`, a constante). O documento registra que a diferença é escolha da spec. Vale o Validador decidir se o gabarito também passa a usar a constante, para o texto não divergir quando ela mudar.
- **Comentário em dobro.** Em `apps/api/src/atividade/correcao/correcao-de-objetiva.ts:21-24`, o JSDoc repete o comentário de dentro da função (linha 26), cada um citando uma origem diferente. Deixe um só.
- **O teste não prova o `nulls last`.** O teste de ordem em `apps/api/src/governanca/analista.int.test.ts` passa com o `nulls last` e sem ele. Uma linha no teste dizendo isso evita que alguém conte com ele se a ordem um dia virar decrescente.
- **Desvio de nome na X8.** `generatePdfDoArtefato` (`pdf-do-artefato.test.ts:37`) é o nome que a X8 deixou, já existente na spec. O documento fala em "levados ao nome novo" sem dizer qual é. Basta conferir que `restos` está limpo, como o documento afirma.

Documento revisado: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/tasks/correcoes/2026-11-20-merge-da-develop-leitura-de-null.md`

## test-engineer · 1ª rodada · REPROVADO · 2026-11-20 18:32:35 · `tasks/correcoes/2026-11-20-merge-da-develop-leitura-de-null.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- O plano sem habilidade (`habilidades: []`) mostra o rótulo "Sem habilidade", no PDF e na tela, e o plano com habilidade não o mostra.
- Na revisão rápida do relatório, a questão sem habilidade diz "do conteúdo desta questão", e a com habilidade diz "de “descrição”".
- A linha `codigo: null` segue a ordem da atividade no lote e no diagnóstico da aluna, e vem por último no Analista (`nulls last`).
- A adaptação não dá habilidade a quem não tinha nem tira de quem tinha, e confere o código e a descrição um a um.
- O Tutor recusa a chave ausente, porque `null` precisa vir explícito.
- O lote e a prova abrem de ponta a ponta com questão sem habilidade.
- O SQL real do Analista agrupa o `null` numa linha só.
- Concorrência e isolamento: não se aplicam. A mudança é só de leitura e texto, sem consulta nova com escopo; as duas consultas do Analista só ganharam `nulls last`.

**Cobertos:**
- `pdf-do-artefato.test.ts:197` cobre o plano sem habilidade no PDF.
- `Artefato.test.tsx:218` e `:227` cobrem a tela, com e sem habilidade.
- `numeros.test.ts:721` cobre o caso sem habilidade da revisão rápida.
- `lote.test.ts:185` e `correcao-de-objetiva.test.ts:93` cobrem a ordem.
- `conferencia.test.ts:102` e `:110` e `conteudo.test.ts:383` cobrem a adaptação.
- `turno-do-tutor.test.ts:1123` cobre a chave ausente.
- `assistente.test.ts:472` e `atividade.test.ts:502` cobrem os schemas.
- `correcao.int.test.ts:607` cobre o caminho de ponta a ponta, e `analista.int.test.ts:218` cobre o Analista com o SQL real.
- Os 10 arquivos de unidade passaram (769 casos).
- Os dois de integração eu não rodei. Despachantes e workers estão de pé no compose de teste, provavelmente da vitrine, e eu não os derrubo. Para eles vale o portão.
- Nenhum `.skip`, e nenhum provedor pago.

**Bloqueantes:**
1. **`packages/core/src/ia/tasks/relatorio-da-correcao.ts:59`**: a condição de `revisaoDaQuestao` só foi provada de um lado.
   - O bloco `false ?` prova o caso sem habilidade. Nenhum teste verifica a frase "revisão rápida de “…”" da questão com habilidade.
   - Por isso o mutante `questao.habilidade === null ? 'do conteúdo desta questão' : …` → `'do conteúdo desta questão'` (sempre o texto sem habilidade) sobrevive. Esse é o comportamento que o merge acabou de reescrever.
   - O nome do caso em `numeros.test.ts:715` promete "e a com habilidade, o texto da habilidade", mas a terceira questão tem 100% de acerto e cai em "Todos acertaram".
   - Correção exigida: em `numeros.test.ts`, afirmar que a questão com habilidade e maioria acertando contém `os erros pedem uma revisão rápida de “<descrição>”.` (por exemplo, `questoes[0]` de `entradaDoRelatorio()` sem anular a habilidade). Depois, acrescentar o bloco de mutação do lado contrário (`true ?`).
2. **`apps/api/src/artefato/pdf-do-artefato.ts:238`**: o mesmo problema no PDF.
   - `if (conteudo.habilidades.length === 0)` → `if (true)` sobrevive. O caso do plano com habilidade (`pdf-do-artefato.test.ts:165`) só usa `toContain` e não afirma a ausência do rótulo.
   - Na tela o lado contrário existe (`Artefato.test.tsx:227`), mas no PDF não, embora o documento afirme que o PDF e a tela têm o mesmo comportamento.
   - Correção exigida: em `pdf-do-artefato.test.ts:180-195`, `expect(texto).not.toContain(ROTULO_SEM_HABILIDADE)`, com o bloco `if (true)` ligado a esse caso.

**Recomendações:**
- **`correcao.int.test.ts:626`**: o comentário diz que o lote abre "antes e depois da aprovação", mas o caso só o lê antes.
  - Na versão da spec (HEAD) o lote era lido depois de `aprovarOLote`. Isso passava por `validacaoParaATela`, que relê com `loteApresentadoSchema` o `apresentado` gravado em jsonb com `habilidade: null` (`correcao.service.ts:40` e `:118`).
  - O merge ficou com o lado da `develop` e esse caminho deixou de ser exercido.
  - Pedido: um segundo `lerCorrecao` depois da aprovação, afirmando `validacao.apresentado.resumo.porHabilidade` com a linha `habilidade: null`.
  - O documento diz "os [testes] da spec ficaram", e este foi alterado.
- **`analista.int.test.ts:221`**: o primeiro caso novo espiona o próprio repositório com `vi.spyOn`. Isso é aceitável só porque o segundo caso (`:246`) cobre o SQL real. Vale registrar a dependência entre os dois no comentário.
- **Documento, seção "Correção"**: fala em "três casos de `conteudo.test.ts`" que passaram a aceitar `null`/`[]`. No diff aparecem dois pontos, a atividade em `:150` e o plano em `:204`. Conferir a contagem.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/packages/core/src/ia/tasks/relatorio-da-correcao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/packages/core/src/ia/tasks/numeros.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/artefato/pdf-do-artefato.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/artefato/pdf-do-artefato.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/atividade/correcao/correcao.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/governanca/analista.int.test.ts

## revisor-geral · 2ª rodada · APROVADO · 2026-11-20 18:47:11 · `tasks/correcoes/2026-11-20-merge-da-develop-leitura-de-null.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

A 1ª rodada não exigiu correções. Cada recomendação dela foi aplicada ou está registrada, com motivo, na tabela "Recomendações sem aplicar":
- O comentário duplicado em `apps/api/src/atividade/correcao/correcao-de-objetiva.ts` saiu do corpo da função. A referência à 10.0 passou para o JSDoc.
- O limite do teste quanto ao `nulls last` ficou escrito como comentário em `apps/api/src/governanca/analista.int.test.ts:401-404`. O documento continua tratando a cláusula como mutante equivalente, com o motivo.
- O nome novo da X8 (`generatePdfDoArtefato`) e a execução do `restos.ts` estão registrados no documento, na linha 30.

O que mudou nesta rodada:
- **`pdf-do-artefato.test.ts:196-197`:** o teste do plano com habilidade passou a afirmar que o `ROTULO_SEM_HABILIDADE` não aparece. A fixture tem `habilidades` não vazio (linha 171), e o bloco novo de mutação (`if (true)`) fica vermelho com essa afirmação.
- **`numeros.test.ts:724-726`:** cobre o caso em que a questão 1 tem habilidade, com a frase "de “…”", e mata o mutante `true ?` do bloco novo. A `entrada` sem alteração mantém a habilidade da primeira questão.
- **`correcao.int.test.ts:634-639`:** prova a releitura, depois da aprovação, do que ficou gravado em jsonb com `habilidade: null`, passando por `validacaoParaATela` (`correcao.service.ts:37`).
- **`minha-atividade.service.ts:151`:** o comentário confere com o código. `habilidadesDaAtividade` (`lote.ts:30-37`) grava a chave `null` apontando para `null`, então `get(null)` não volta `undefined` e o `flatMap` mantém a linha.
- **Documento:** o número de casos de `conteudo.test.ts` foi corrigido para "dois casos, três afirmações", e a contagem de mutações passou para "7 blocos".

Recomendações:
- O comentário em `apps/api/src/governanca/analista.int.test.ts:401-404` diz que este caso "depende" do seguinte. Ele não depende para rodar, só para a cobertura da ordem. "Complementa" diria isso sem dar a entender que há ordem de execução entre os dois.
- Vale lembrar que a 1ª rodada do `test-engineer` está REPROVADO na tabela de Revisões. Isso é dele e não conta neste veredito, mas o hook segura o commit até haver uma rodada dele APROVADO para o código atual.

## test-engineer · 2ª rodada · APROVADO · 2026-11-20 18:47:26 · `tasks/correcoes/2026-11-20-merge-da-develop-leitura-de-null.md`

VEREDITO: APROVADO

Cenários exigidos (2ª rodada, só as duas correções exigidas e o que elas afetam):
- Na revisão rápida do relatório, a questão com habilidade fala da habilidade, e a sem habilidade fala do conteúdo da questão. A condição precisa estar provada dos dois lados (`relatorio-da-correcao.ts:59`).
- No PDF, o plano com habilidade não leva o rótulo de sem habilidade, e o plano sem habilidade leva. O lado contrário de `pdf-do-artefato.ts:238` precisa estar provado.
- As três recomendações da 1ª rodada que foram aplicadas.

Cobertos:
1. **Correção 1, feita.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/packages/core/src/ia/tasks/numeros.test.ts:725-726`, o teste roda o relatório com a entrada original. Nessa entrada, a questão 1 tem a habilidade `habilidades[0]` e 25 de 30 acertos (`__fixtures__/inputs.ts:76`). O teste afirma a frase exata `os erros pedem uma revisão rápida de “<descrição>”.`.
   - Se o código passasse a escrever sempre "do conteúdo desta questão" (o bloco `true ?` do documento), o teste ficaria vermelho.
   - O `?? ''` não deixa passar nada: sem habilidade na entrada, a frase esperada vira `de “”.` e o teste falha do mesmo jeito.
   - O `teste:` do bloco ("manda retomar o conteúdo da questão") aponta para o caso certo. Esse caso passa aqui (1 passado).
2. **Correção 2, feita.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l2/apps/api/src/artefato/pdf-do-artefato.test.ts:197`, o teste do plano com habilidade afirma `expect(texto).not.toContain(ROTULO_SEM_HABILIDADE)`.
   - O bloco `if (true)` aponta para o caso "o plano de aula sai com a duração", com `falha: not.toContain(ROTULO_SEM_HABILIDADE)`. Esse é o motivo certo: com o mutante, o plano com habilidade passa a imprimir o rótulo.
   - O lado do plano sem habilidade continua provado em `:220`. O arquivo passa aqui (21 de 21).
3. **Recomendações da 1ª rodada, aplicadas.**
   - Em `correcao.int.test.ts:634-639`, o teste lê de novo pelo `lerCorrecao` depois da aprovação. Ele afirma `validacao.apresentado.resumo.porHabilidade`, com a linha `habilidade: null` separada da linha com código, o que prova a leitura do que ficou gravado no jsonb.
   - Em `analista.int.test.ts:401-404`, há o comentário que registra a dependência entre os dois casos do Analista e diz que o `nulls last` não é distinguível por teste.
   - Na seção "Mutações" do documento, a contagem diz "dois casos, três afirmações" e "7 blocos".
4. **O resto do diff é só comentário.** Em `correcao-de-objetiva.ts`, um comentário foi movido para o JSDoc. Em `minha-atividade.service.ts:151`, entrou um comentário sobre a chave `null` de `habilidadesDaAtividade`. Nenhum dos dois cria condição nova sem bloco.
5. O documento continua registrando o motivo da linha que nenhum bloco alcança, o `nulls last`, que é um mutante equivalente. Ele não tem `.skip`, mock que esconda a regra nem provedor pago: o relatório usa o `falso` da tarefa.

Bloqueantes: nenhum.

Recomendações:
- Não rodei `correcao.int.test.ts`, porque precisa do Postgres. Conto com o portão, que já o rodou ao provar os sete blocos.
- Em `numeros.test.ts:726`, a afirmação seria mais direta com a descrição escrita por extenso, sem `primeira.habilidade?.descricao ?? ''`. Hoje ela está correta, só fica menos legível.
