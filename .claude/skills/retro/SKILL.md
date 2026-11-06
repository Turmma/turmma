---
name: retro
description: Retrospectiva de uma funcionalidade concluída — mede rodadas e reprovações, agrupa o que os revisores exigiram e propõe mudanças nos templates, agentes e regras para o erro não voltar
argument-hint: <nome-funcionalidade em kebab-case>
user-invocable: false
---

Você transforma o histórico de revisões de uma funcionalidade em mudança de processo.

Este comando existe porque o processo reprovava o mesmo tipo de erro tarefa após tarefa: no F0 e
no começo do F1, 31 de 119 rodadas reprovaram, 16 delas do `test-engineer`, e nada fazia a
tarefa seguinte aprender com a anterior. Cada reprovação evitada é uma rodada inteira de
revisores a menos.

<critical>Proponha, não aplique. Mudança em código de processo, regra, decisão, na lista de um guardião com
veto ou em `criar-tasks`, `revisar-tarefa` e `revisar-spec` só com confirmação do usuário, num bloco só
com a recomendação de cada uma. A que muda só skill, papel ou modelo de documento é aviso (seção 5).</critical>
<critical>Regra 10, 20 e 70 não são afrouxadas por retrospectiva. Se o achado é "o guardião é
rigoroso demais", a proposta é deixar o requisito mais claro para quem implementa, não tirá-lo.</critical>

Funcionalidade: `$ARGUMENTS`

**Você corre ao lado da spec seguinte** (D86). A retro roda no térreo, no terminal `Arquiteto 2`, enquanto o
`Arquiteto` escreve o PRD da próxima spec no andar dela. Ela não espera você até o `criar-tasks`, que lê o seu
`retro.md`: o Arquiteto de lá para antes dele até o seu commit chegar à branch da spec (o Orquestrador faz o merge).
Ao perguntar, o status do térreo leva o nome do seu terminal: `maestri floor status "Arquiteto 2: <a pergunta>" --state blocked`.

## 1. Ler

- As regras 00 (`00-arquitetura.md`), 40 (`40-testes.md`), 60 (`60-dominio.md`) e 80 (`80-infra-e-carga.md`), de `.claude/rules/`, por extenso: têm `paths:` e não carregam sozinhas aqui (a 10, a 20 e a 70 já estão no contexto)
- `tasks/prd-$ARGUMENTS/*_task.md`: a seção "Revisões" de cada um
- `tasks/prd-$ARGUMENTS/achados/indice.md`: uma linha por rodada com o que cada revisor exigiu.
  Agrupe pelo índice e abra `achados/<documento>.md` só onde precisar do texto inteiro
- `tasks/prd-$ARGUMENTS/revisao-spec.md` e `validacao.md`, se existirem
- `tasks/prd-$ARGUMENTS/estado.md`: a tabela "Concluídas" traz o modelo que implementou cada tarefa,
  as escaladas e o que o Orquestrador decidiu sem perguntar
- `tasks/correcoes/*.md` com data dentro do período da funcionalidade
- `git log --format='%h %ad %s' --date=iso` dos commits da funcionalidade

## 2. Medir

```
Tarefas: <n> · Rodadas de revisor: <n> · Reprovações: <n> (<%>)
Por revisor: <revisor: rodadas / reprovações>
Por modelo do implementador: <modelo: tarefas / rodadas por tarefa / reprovações / diagnósticos do Arquiteto / tempo por tarefa>
Rodadas por tarefa: média <n>, pior <tarefa> com <n>
Rodadas que caducaram sem reprovação (revisor aprovou e teve de rodar de novo): <n>
Correções fora de tarefa: <n>
Duração: primeira tarefa → último commit, e mediana por tarefa (intervalo entre commits)
Ressalvas da validação: <n críticos, n maiores>
```

Compare com a retrospectiva anterior (`tasks/prd-*/retro.md` mais recente), se houver.

O modelo de cada tarefa está na coluna "Modelo" do `estado.md`. Repita as medidas da seção "As medidas
que a D78 deixou para esta retrospectiva" da retro do F3 (`tasks/prd-lgpd-e-titular/retro.md`) que ainda
valem, com o número de agora ao lado do de lá, e proponha com o número, ou diga que ele não sustenta.
A D79 deixou cinco para a primeira spec depois dela: a mediana do pedido ao commit (era 99 min); as
tarefas sem reprovação (1 de 20); as reprovações do grupo A, agora que o portão prova as mutações (17);
os vermelhos da esteira por push e quanto cada um custou; e do último commit ao pedido de pouso (5 h 29).

## 3. Agrupar causas

Leia cada achado e agrupe pela **causa**, não pelo revisor. Exemplos de causa: "teste de
concorrência em sequência em vez de paralelo", "DTO devolvendo campo da entidade", "N_task sem o
caso de borda que o revisor cobrou", "Tech Spec não dizia o índice". Para cada grupo:

- quantas vezes, em quais tarefas;
- **onde o erro deveria ter sido evitado**: no PRD, na Tech Spec, no `N_task.md` (criar-tasks),
  na autoconferência do implementador (executar-task, passo 2), ou é falso positivo do revisor.

## 4. Propor

**Curta ou completa** (D86). A retro é **curta** quando a spec foi bem: a taxa de reprovação da seção 2 ficou abaixo
da retro anterior **e** nenhum grupo da seção 3 tem duas ou mais ocorrências. Aí você só mede e registra: pula o resto
desta seção e a seção 5, sem proposta e sem pergunta, e salva (seção 6) com a linha
`**Retro curta** (D86): <taxa de agora> contra <taxa da anterior>, nenhuma causa repetida`. Sem retro anterior, ou
com uma das duas condições falhando, ela é **completa**: siga daqui.

Uma proposta por grupo com duas ou mais ocorrências, no formato:

```
Causa: <grupo> — <n> ocorrências (<tarefas>)
Onde evitar: <etapa>
Mudança: <arquivo> — <o texto exato a acrescentar ou trocar>
Efeito esperado: <qual reprovação deixa de acontecer>
```

Destinos típicos: pergunta nova na autoconferência do `executar-task`; linha nova na tabela de
testes do `task-template.md`; item mais claro no "O que verificar" do agente; seção obrigatória
na Tech Spec; caso de borda novo na regra 40. Falso positivo do revisor vira ajuste no texto do
agente, com o exemplo que ele reprovou sem motivo.

Proponha também o que **tirar**: item de checklist que nunca pegou nada em toda a funcionalidade
e custa leitura em toda tarefa.

## 5. Aplicar: confirmação ou aviso

Separe as propostas em dois grupos (D79, revista em 23/10/2026):

- **Aviso** é a proposta que muda **só** skill (`.claude/skills/`), papel (`.claude/agents/`) ou modelo
  de documento (`task-template.md`, `template.md` e parecidos), salvo os da confirmação (abaixo). Mostre-a no terminal, com a hora de
  agora mais 30 minutos, e siga: aplique depois dessa hora, se o Joaquim não objetou. Com a objeção,
  ela passa para a confirmação.
- **Confirmação** é todo o resto: código de processo (`tools/`, `.claude/hooks/`, `.claude/settings.json`),
  regra, decisão, a lista "O que verificar" de um guardião com veto e o resto do arquivo de cada revisor com
  veto, o `mesa-de-revisao.md` e a seção 6 do `validador.md` (os revisores com veto são os de `REVISORES_COM_VETO`, em
  `tools/processo/documento-de-revisao.ts`: `tenancy-guardian`, `privacy-guardian`,
  `conformidade-reviewer`, `infra-guardian`, `test-engineer` e `revisor-geral`) e as skills que decidem a marcação de
  guardião (`criar-tasks`, `revisar-tarefa`, `revisar-spec`). Pergunte uma vez só (D86).

**O bloco.** Uma mensagem, no terminal, com todas as propostas numeradas: primeiro os avisos, com a hora; depois as
confirmações, cada uma com o arquivo, a mudança e a sua recomendação (aplicar ou não, e por quê). O Joaquim responde
"aprovo", que vale a recomendação de cada uma, ou os números que recusa ou muda. Aplique só as aceitas. A confirmação de
regra e de guardião com veto não muda: quem aplica é a palavra dele, e o "aprovo" sobre o bloco, com a recomendação
de cada uma escrita, é essa palavra.

Proposta que afrouxa a regra 10, a 20 ou a 70 não existe (aviso crítico acima). Na dúvida de qual grupo,
é confirmação.

## 6. Salvar

`tasks/prd-$ARGUMENTS/retro.md`, com as medidas, os grupos, as propostas e o que foi aceito ou
recusado (com o motivo), marcando as que foram aviso. O `criar-tasks` da próxima funcionalidade lê esse arquivo.

Commit na `develop`, no térreo, depois do pouso da funcionalidade (D78), sem push (o push é do
Orquestrador), e antes de a spec seguinte chegar ao `criar-tasks` (D86): `Faz a retrospectiva de <funcionalidade> e ajusta o processo`,
só com `retro.md` e os arquivos de processo alterados.

## 7. Relatório

```
Retro — <funcionalidade> (curta | completa)

Reprovações: <n de n rodadas (%)> · antes: <% da retro anterior ou "primeira">
Maior causa: <grupo, n ocorrências>
Aceitas: <n propostas> · Recusadas: <n>
Arquivos alterados: <lista>
```
