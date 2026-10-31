---
name: criar-tasks
description: Gera a lista de tarefas de uma funcionalidade, a partir do PRD e da Tech Spec
argument-hint: <nome-funcionalidade em kebab-case>
user-invocable: false
---

Você vai transformar PRD e Tech Spec em uma lista de tarefas executável.

A razão de as tarefas serem pequenas: cada uma passa por um portão de qualidade, com auditoria de
isolamento, de dado pessoal e de conformidade, e quando uma grande falha, muita coisa já foi
construída em cima dela.

<critical>MOSTRE A LISTA DE ALTO NÍVEL ANTES DE GERAR ARQUIVO. É AVISO, NÃO PARADA (D79): MOSTRE E GERE</critical>
<critical>NÃO IMPLEMENTE NADA</critical>
<critical>CADA TAREFA É UM ENTREGÁVEL FUNCIONAL, NÃO UMA CAMADA</critical>

Funcionalidade alvo: `$ARGUMENTS`

## Pré-requisitos

`tasks/prd-$ARGUMENTS/prd.md`, `tasks/prd-$ARGUMENTS/techspec.md` e `.claude/rules/`. Leia por extenso as regras 00 (`00-arquitetura.md`), 40 (`40-testes.md`), 60 (`60-dominio.md`) e 80 (`80-infra-e-carga.md`), de `.claude/rules/`: têm `paths:` e não carregam sozinhas aqui (a 10, a 20 e a 70 já estão no contexto).

`tasks/prd-$ARGUMENTS/revisao-spec.md` com veredito **APROVADA** (`revisar-spec`). Sem ele, volte à
skill `revisar-spec`: erro na Tech Spec contamina todas as tarefas, e é o momento
mais barato de achá-lo.

Leia também o `achados/indice.md` e o `retro.md` das funcionalidades anteriores, se existirem: o
que os revisores exigiram lá vira cenário de teste ou subtarefa aqui. O índice é uma linha por
rodada; abra o bloco inteiro só das que interessam a esta funcionalidade.

## O que é uma boa tarefa

Uma tarefa entrega **comportamento verificável**, não uma camada técnica.

```
ruim:   1.0 Criar as migrations
        2.0 Criar os repositories
        3.0 Criar os controllers
        (nada funciona até a 3.0, e a auditoria não tem o que auditar até o fim)

bom:    1.0 Coordenação cria turma e a turma aparece na listagem da escola
        2.0 Coordenação sobe lista de nomes por turma, com erro apontado por linha
        3.0 Professor entra por convite e escolhe disciplina
        4.0 Aluno reivindica nome pelo link da sala
        5.0 Professor aprova reivindicação e o aluno vira usuário com senha
```

Cada uma dessas pode ser demonstrada, testada e auditada sozinha.

## Etapas

1. **Extrair** requisitos, decisões técnicas e componentes do PRD e da Tech Spec.

2. **Acionar `test-engineer`** para definir, por tarefa, os cenários que provam a regra,
   incluindo os casos de borda do domínio escolar. Os testes saem daí, não de improviso na
   hora de implementar. Em tarefa de tela, cada medida, token ou atributo que a subtarefa, a Tech
   Spec ou o `docs/interface.md` nomeia para a peça (48 px, borda de 2, `t-cartao`, "o mesmo
   `autoComplete`") ganha a sua linha na tabela, com o teste que o lê. Na X1, seis das onze
   reprovações por cláusula sem prova foram uma medida escrita na subtarefa ou na spec e ausente
   da tabela.

3. **Montar a estrutura**: sequenciamento, dependências, os subagentes obrigatórios marcados em
   cada tarefa, e o porte de cada uma.

4. **Mostrar a lista de alto nível**, com a hora. É o momento mais barato para o Joaquim corrigir o
   desenho, e ele tem até 30 minutos depois de os arquivos existirem: o Orquestrador só começa a
   primeira tarefa passado esse prazo (`/seguir`, passo 7).

5. **Gerar os arquivos**, sem esperar.

## Subagentes obrigatórios por natureza da tarefa

Esta é a única tabela por natureza: `revisar-spec` e `revisar-tarefa` apontam para cá. O que o **caminho** do arquivo
pede, o hook soma sozinho (`tools/processo/guardioes-por-caminho.ts`, descrito em `tasks/prd-harness/tabela-de-guardioes.md`).

| Se a tarefa... | Marque |
|---|---|
| cria migration, repository, query ou endpoint com dado de escola | `tenancy-guardian` (veto) |
| toca dado de aluno, responsável, log, storage, exportação ou envio externo | `privacy-guardian` (veto) |
| envolve nota, correção, tutor, autonomia de agente, decisão sobre aluno ou indicador de professor | `conformidade-reviewer` (veto) |
| mexe em login, tutor, modo sala, prova online, fila, gateway de IA, migration em tabela grande, deploy ou ambiente | `infra-guardian` (veto) |
| chama modelo ou cria agente | `llm-integrator` |
| gera ou corrige conteúdo pedagógico | `pedagogia-reviewer` |
| cria ou altera tela | `frontend-reviewer` |
| depende de regra externa ou API de terceiro | `domain-researcher` |
| qualquer tarefa | `test-engineer` e `revisor-geral`, implícitos: o hook os exige mesmo sem marca |

Na dúvida, marque. Auditoria a mais custa minutos; auditoria a menos custa o contrato.

## Porte da tarefa

Toda tarefa leva `**Porte:** pequeno` ou `**Porte:** grande` no cabeçalho do `N_task.md`. O porte
diz quanto a tarefa deve levar, e é por ele que a vigia do `/seguir` sabe quando uma tarefa está presa.
Marque **grande** quando qualquer um destes vale:

- três ou mais guardiões com veto marcados (`tenancy-guardian`, `privacy-guardian`,
  `conformidade-reviewer`, `infra-guardian`);
- migration em tabela que cresce com aluno, ou índice e restrição que pedem `EXPLAIN` ou prova de
  concorrência;
- corrida entre operações, trava, ou transação que atravessa mais de um repository;
- mais de dez arquivos de código previstos, ou mudança que atravessa API, worker e web.

O resto é pequena: uma tela que lê um endpoint pronto, um endpoint de leitura, um comando de
operação simples, um documento. Na dúvida, grande. Sem a linha, `tools/processo/estado.ts`
infere o porte pela contagem de guardiões e avisa que inferiu.

## Diretrizes

- Ordene dependência antes de dependente: migration antes de repository, backend antes de
  frontend, ambos antes de e2e
- Testes são subtarefas dentro da tarefa, nunca uma tarefa separada no fim
- Cada desvio da seção 11 da Tech Spec vira subtarefa de documento na tarefa que o cria: a exceção ao
  `escolaId` no `docs/modelo-de-dados.md`, o módulo global no `docs/arquitetura.md`. Na A0 os dois
  ficaram de fora, e um deles foi o único achado maior da validação
- **Tarefa que tira, move ou renomeia um lugar leva a busca pelo nome antigo** em `apps/web/src`,
  `e2e/` e `docs/` (`grep -rn '<nome antigo>'`), com cada ocorrência trocada ou justificada no
  documento. E **toda tarefa que muda uma tela que o `docs/interface.md` descreve leva a subtarefa da
  Parte A daquela tela**: o critério de pronto da spec não tem dono. Na X3 a busca por "Seu time" foi só
  nos textos de tela (2.3), e só a 2.0 tinha a subtarefa do `interface.md`; a validação achou os dois
- **Tarefa que cria guarda (regra de lint, teste estrutural, trava) leva duas linhas fixas na tabela
  de testes**: "quem contorna é acusado", uma por forma (reexportação, `import()`, o caminho como
  texto), e "a guarda reprova quando o alvo dela não existe". Na X5, a 9.0 e a 12.0 somaram oito
  reprovações por escape e por cerca que se calava
- **Tarefa que cria comando, hook ou script de processo leva duas subtarefas fixas**: (a) pôr o
  comando no passo do `/seguir` ou no papel que o usa, com o termo no teste do passo; (b) gravar a
  entrada real como fixture (a mensagem colada como chega, com o embrulho; a saída do terminal de
  quem roda o comando), e o teste lê a fixture, não um exemplo escrito à mão. Na X7, o aviso da
  mensagem colada testava a forma imaginada (crítico da validação), o `abandonar` não estava em passo
  nenhum (maior), e a fixture do `maestri list` veio do terminal errado
- **Uma linha da tabela de testes, um comportamento.** O que a célula junta com ponto e vírgula se
  perde: na X3, "100 ou mais", "decidir tira o item" e "vínculo encerrado tira a página" estavam numa
  célula com outros, ninguém escreveu o teste, e três dos oito achados da validação foram eles
- **O RF que vale para toda tela vira linha na tabela de testes de cada tarefa que cria ou altera
  tela**: cabe a 1366 × 768 sem a página rolar, uma ação cheia por tela, o vocabulário proibido. Com a
  peça que mede: `paginaNaoRola` (`e2e/support/coordenacao.ts`), `soOPainelDaAbaRola` e
  `VOCABULARIO_DE_NOTA` (`e2e/support/professor/scenario.ts`). Na X3 o RF22 estava no "Contexto" de
  oito tarefas e na tabela de nenhuma, que só diziam "sem rolar de lado" a 360 px; quatro telas rolavam
  a página, e só a validação mediu
- O leitor é um desenvolvedor júnior que não participou das conversas. Seja explícito sobre
  o contexto que ele precisa ler
- **Toda tarefa diz como testar**, na seção "Como testar" do modelo: o teste existente a copiar e a
  peça de apoio, achados abrindo o código, e não de memória
- **Mire em até 12 tarefas, e nunca mais de 20.** Passou de 12, mostre junto com a lista o corte em
  duas specs que pousam separadas
- **O "Contexto necessário" aponta a seção da Tech Spec e o requisito do PRD pelo número.** É só o que
  o Implementador lê dos dois (`executar-task`, passo 1)
- **Tarefa cabe numa rodada de revisão: um comportamento, e até três guardiões com veto.** A que
  marcaria os quatro vira duas, cortada por comportamento. Contar arquivo não serve de teto: a previsão erra (a
  13.0 previa seis linhas de arquivo e alterou 60). Tarefa de tela conta as telas: uma tela, ou um
  diálogo grande, por tarefa. O `N_task.md` nasce com até 800 palavras
- Formato `X.0` para tarefa principal, `X.Y` para subtarefa
- **Autorize o paralelo**, na coluna "Pode correr em paralelo com" do `tasks.md`: as tarefas
  autorizadas correm ao mesmo tempo, em linhas (`/seguir`, passo 3), e é o que mais encurta a spec.
  Autorize o par que não depende um do outro nem toca o mesmo arquivo. `tools/processo/linhas.ts`
  confere pelos "Arquivos previstos" das duas, que por isso levam **caminho de verdade**, com o
  arquivo de registro que as duas editariam (rotas, navegação, módulo): sem caminho, a tarefa corre
  sozinha. Duas tarefas com migration, schema ou `packages/shared` não correm juntas: ponha o tronco
  cedo, em poucas tarefas, e deixe as telas e os endpoints de folha para o paralelo

## Tarefas geradas antes

Spec retomada, congelada ou com o `tasks.md` mais velho que o último `tasks/prd-*/retro.md`: a conferência do
Arquiteto, além de caminhos e nomes, passa por `git log -p --since=<data do tasks.md> -- .claude/skills/criar-tasks/` e
aplica a cada `N_task.md` pendente cada diretriz e cada seção do modelo que entrou depois (a linha do RF de toda tela, a
Autoconferência, a coluna "Caso"), sem mudar objetivo, subtarefa de comportamento nem critério de conclusão. Na X4, a 3.0,
a 6.0 e a 7.0 nasceram em 13/10 sem a linha "cabe em 1366" que a retro da X3 pôs em 20/10; a conferência de 24/10 só
alinhou caminhos, e a validação reprovou duas vezes pelo RF20.

## Saída

- `tasks/prd-$ARGUMENTS/tasks.md`, seguindo `.claude/skills/criar-tasks/tasks-template.md`
- `tasks/prd-$ARGUMENTS/[N]_task.md`, seguindo `.claude/skills/criar-tasks/task-template.md`

Antes de reportar, meça: `wc -w tasks/prd-$ARGUMENTS/*_task.md`. `N_task.md` acima de 800
palavras: corte repetição da Tech Spec (aponte a seção em vez de copiar) ou divida a tarefa.

<critical>NÃO IMPLEMENTE NADA. O FOCO É A LISTA E O DETALHAMENTO.</critical>
