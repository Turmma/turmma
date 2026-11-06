---
name: criar-techspec
description: Cria a Tech Spec de uma funcionalidade, a partir do PRD
argument-hint: <nome-funcionalidade em kebab-case>
user-invocable: false
---

Você vai escrever o documento que responde **como vamos construir**. O PRD já decidiu o quê.

A razão de a Tech Spec existir separada: se a arquitetura for decidida no meio da
implementação, cada tarefa toma uma decisão diferente e o sistema perde unidade. Aqui ela é
decidida uma vez, com calma, por alguém que olhou o código inteiro antes.

<critical>EXPLORE O PROJETO ANTES DE PERGUNTAR</critical>
<critical>NÃO GERE A TECH SPEC SEM PERGUNTAS DE CLARIFICAÇÃO</critical>
<critical>NÃO REPITA OS REQUISITOS DO PRD. AQUI É O COMO.</critical>

Funcionalidade alvo: `$ARGUMENTS`

## Entradas

- PRD obrigatório: `tasks/prd-$ARGUMENTS/prd.md`
- Template: `.claude/skills/criar-techspec/template.md`
- Desenho vigente: `docs/arquitetura.md` e `docs/modelo-de-dados.md`
- Regras: `.claude/rules/` — cada uma explica por que existe; leia o porquê, não só a lista.
  Leia por extenso `00-arquitetura.md`, `40-testes.md`, `60-dominio.md` e `80-infra-e-carga.md`, que têm `paths:` e não
  carregam sozinhas aqui (a 10, a 20 e a 70 já estão no contexto), e a 30 e a 50 se a funcionalidade tem IA ou tela
- Contexto: `CLAUDE.md`, `docs/visao-produto.md` e as decisões citadas no PRD, por extenso, em
  `docs/decisoes.md`
- Tela: `docs/interface.md`
- Carga e operação: `docs/infra.md`
- Pendências herdadas: a seção 6 do `validacao.md` de cada funcionalidade de que esta
  depende. O que ficou recomendado para "a próxima que mexer nisso" entra aqui ou é
  descartado com motivo
- Skills técnicas da stack em `.claude/skills/` (NestJS, Drizzle, Postgres, BullMQ, React,
  TanStack Query, Tailwind, Vitest, Playwright). Use como referência, respeitando os
  conflitos listados em `docs/skills-de-terceiros.md`

## Fluxo

### 1. Ler o PRD inteiro

Não pule. Tech Spec escrita a partir do título da funcionalidade é como nascem os sistemas
que resolvem outra coisa.

### 2. Explorar o projeto

Mapeie módulos existentes, entidades já criadas, pontos de integração e padrões em uso.
Reaproveitar o que existe vale mais do que criar algo novo e mais bonito. Um segundo jeito
de fazer a mesma coisa é dívida permanente.

Tabela que reparte o repositório (caminho → guardião, caminho → suíte, pasta → dono) sai de
`git ls-files | cut -d/ -f1-3 | sort -u`, com cada pasta numa linha ou na lista do que fica fora, e o
motivo. Na X7, a tabela do RF15 foi escrita de memória, e os quatro guardiões reprovaram três rodadas
seguidas apontando pastas que faltavam.

### 3. Pesquisar

- Dúvida sobre biblioteca: documentação oficial, não blog
- Regra externa ou API de terceiro: **acione `domain-researcher`**, no mínimo três buscas
- Toca modelo de IA: acione `llm-integrator`, que vai cobrar perfil e estimativa de custo
- Gera conteúdo pedagógico: acione `pedagogia-reviewer` para definir o critério de qualidade
  antes de existir código

<critical>Premissa não confirmada em fonte oficial entra marcada como `⚠️ NÃO VERIFICADO`,
com interface abstrata e implementação falsa propostas. Não invente endpoint, campo nem
comportamento de terceiro: isso vira uma tarefa que falha na integração real, semanas
depois, quando ninguém lembra de onde veio a suposição.</critical>

### 4. Esclarecer

Pergunte sobre fluxo de dados, interfaces principais, o que é síncrono, o que vai para fila,
e **o que acontece quando cada parte falha**. Essa última é a mais esquecida e a que mais
gera bug em produção.

Não pergunte o que as regras já definem. Cite a regra e siga.

### 5. Seções obrigatórias

Toda Tech Spec deste projeto tem quatro seções que não são opcionais. Elas existem porque
são exatamente os quatro lugares onde este produto pode morrer:

- **Isolamento** — como o escopo de escola e ano letivo é aplicado aqui, e quais testes de
  isolamento serão escritos (`rules/10`)
- **Dado pessoal** — o que é coletado, o que vai para log, o que entra em auditoria, para
  onde é enviado, qual a retenção. Campo novo entra na tabela de `docs/lgpd.md` **nesta
  tarefa**, não numa futura (`rules/20`)
- **Conformidade CNE** — se há IA no caminho do aluno: classificação de risco, onde está a
  aprovação humana, como o professor supervisiona (`rules/70`)
- **Carga e falha** — em que ponto do modelo de carga de `docs/infra.md` esta funcionalidade
  entra, o que ela faz na manhã de segunda, qual fila e prioridade usa, que limite por escola
  aplica, onde há corrida de concorrência, e o que o usuário vê quando cada dependência cai
  (`rules/80`). Funcionalidade fora do caminho quente declara isso em uma linha. Limite de corpo,
  de linhas ou de taxa diz em quais rotas vale e o que o middleware global já cobre
  (`apps/api/src/configure-app.ts`): teto novo no global muda as outras rotas (na F2, o da 5.0
  quebrou o envio de material)

Se a funcionalidade chama modelo, uma quarta: **perfis de IA e custo estimado**.

Se a funcionalidade **classifica texto livre** contra um alvo (risco à vida, julgamento de texto de
aluno, pedido de resposta pronta), a seção de conformidade diz também: (a) o **lote retido** que mede o
alvo, escrito em contexto limpo antes dos padrões e nunca lido por quem os escreve, com piso nas
categorias que não podem disparar; (b) o que o padrão de texto cobre sozinho e o que o modelo soma, com
a AIA e o `llm-integrator` já na revisão da spec: padrão sozinho é piso, não alvo; (c) a sonda de
frases novas que o `test-engineer` usa na revisão. Na X5 o `ouro` foi lido para escrever os padrões, 75
de 75 viraram 23 de 75 no lote retido, e a 2.0, a 3.0 e a 93.0 somaram 21 reprovações, cada rodada
fechando um furo e abrindo outro, até a decisão de a regra decidir e o modelo somar.

Se a funcionalidade tem **trava, fila ou estado gravado** que mais de um processo lê (quadro das linhas,
job, sessão), a seção de carga traz a **tabela de estados**: cada estado, quem entra nele, quem sai, o
prazo, e o que acontece quando o prazo estoura ou o processo morre no meio. Na X7, a trava das linhas
levou oito reprovações na revisão da spec, porque cada correção do texto criava um estado novo sem saída
nem caso.

Se a funcionalidade tem uma **guarda que lê linguagem aberta** (linha de comando do shell, opções do git,
expressão regular sobre código), a Tech Spec escreve a gramática que a guarda aceita e diz que **o resto
é negado ou é limite declarado**, com a lista dos limites. Lista de formas de escapar é piso, não desenho.
Na X7, a 10.0 levou três reprovações de forma nova, uma por rodada (`$'…'`, `--config-env=`, opção
global), uma escalada e um bloqueio, até a §5(a) ganhar "todo o resto é limite".

Se a funcionalidade cria uma **ferramenta que roda sobre o repositório inteiro** (um rename, uma migração de dado, uma
varredura), a Tech Spec dá o critério medido sobre a árvore real, com tempo e resultado (por exemplo: "o maior mapa roda em
até 20 min sem gravar; `conferir` e `restos` limpos na árvore sã"), e a tarefa que cria a ferramenta o prova antes do
commit, não a primeira que a usa. Na X8, a 1.0 e a 2.0 passaram só em fixture, e onze correções da ferramenta vieram nas
ondas (o `aplicar` com 12 h projetadas na 3.0 e 3 h 33 na 5.0, símbolos perdidos, homônimos, o `reaplicar` sem filtro). Spec
de rename lê também "Para a próxima spec de rename", em `tasks/prd-nomes-de-mercado/retro.md`, e declara os limites do
`restos` que ela lista, cada um com a busca que o cobre.

### 6. Mapear conformidade

Cada decisão contra `.claude/rules/`. Desvio precisa de justificativa escrita e alternativa
considerada. Desvio silencioso é o que faz a regra perder força.

### 7. Salvar e medir

`tasks/prd-$ARGUMENTS/techspec.md`. Depois meça: `wc -w tasks/prd-$ARGUMENTS/techspec.md`.

**Teto de 2.000 palavras.** A Tech Spec do F1 saiu com 5.393, e cada uma das 20 tarefas manda o
implementador e os revisores lerem pedaços dela. Acima do teto:
- tire o que repete o PRD, as regras ou `docs/arquitetura.md` (cite em vez de copiar);
- detalhe de uma tarefa só (nome de arquivo, assinatura de função menor) vai para o `N_task.md`,
  não para a Tech Spec;
- se ainda passar, proponha dividir a funcionalidade e pergunte. Subir o teto só com o usuário
  aceitando, e o motivo escrito no topo do documento.

Conte também as tarefas que a Tech Spec vai pedir, pelo critério do `criar-tasks` (um comportamento
por tarefa, até três guardiões com veto, uma tela por tarefa). Passou de 12, a pergunta do corte em
duas specs vai ao Joaquim aqui, antes da revisão: a revisão de cada spec cobre só a parte dela. Na
F2, o corte veio depois de oito rodadas da revisão, e pelo menos 13 das 27 não aprovadas eram sobre
o que foi para a F2c.

### 8. Próximo passo

Reporte o caminho e as palavras, mostre o resumo do desenho ao Joaquim e siga para a revisão da spec
(`revisar-spec`) sem esperar: é aviso, não parada (D79), e as tarefas só são geradas com a Tech Spec
revisada.

## Checklist

- [ ] PRD lido inteiro
- [ ] Projeto explorado, reaproveitamento considerado
- [ ] `domain-researcher` acionado para toda dependência externa
- [ ] Premissas não verificadas marcadas com ⚠️
- [ ] Seção de isolamento preenchida
- [ ] Seção de dado pessoal preenchida e `docs/lgpd.md` atualizado se houver campo novo
- [ ] Seção de conformidade CNE preenchida, quando aplicável
- [ ] Seção de carga e falha preenchida, e `infra-guardian` consultado se toca caminho quente
- [ ] Perfis de IA e custo estimado, se aplicável
- [ ] Comportamento em falha definido
- [ ] Até 2.000 palavras, medido com `wc -w`, ou teto excedido com aceite escrito
- [ ] Salvo em `tasks/prd-$ARGUMENTS/techspec.md`
- [ ] Próximo passo: a revisão da spec (`revisar-spec`)
