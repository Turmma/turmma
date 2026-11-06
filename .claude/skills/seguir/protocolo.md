# Protocolo do time no Maestri

Vale para todo agente de terminal deste repositório: Orquestrador, Arquiteto, Implementador, Mesa de
revisão e Validador. Os revisores (`test-engineer`, `revisor-geral`, guardiões) não são terminais:
continuam subagentes, chamados pela Mesa de revisão ou pelo Arquiteto.

O processo mora no git (`.claude/`, `tools/processo/`, `tasks/`). O Maestri guarda só os terminais
e quem está ligado a quem (D78).

## 1. Onde você roda

- **Os terminais são fixos, no térreo; a sessão é que muda.** A cada tarefa ou fase o Orquestrador
  reinicia a sua sessão já apontada para o checkout em que você vai trabalhar: o andar da spec, uma
  linha dela, o de uma correção, ou o térreo. Você começa sem memória da sessão anterior, de propósito
- **Na raiz do checkout.** `pwd` tem de ser igual a `git rev-parse --show-toplevel`. Se não for,
  PARE e avise o Orquestrador. Agente criado com uma *responsabilidade* do Maestri nasce em
  `.maestri/roles/<id>/`, e ali **nenhum hook dispara**: o commit sem revisão passa e a rodada do
  revisor não é registrada. Por isso o papel vem de
  `.claude/agents/<papel>.md`, com `claude --agent <papel>`, e nunca de responsabilidade do Maestri
- **O contexto é compactado sozinho** perto de 400 mil tokens (`autoCompactWindow`, em
  `.claude/settings.json`): a sessão continua com um resumo no lugar da conversa, e o hook de início de
  sessão diz a cada papel o que reler. Por isso o que importa fica em arquivo (o documento da tarefa, a
  ordem de correção, o `estado.md`), nunca só na conversa; depois de compactar, releia o que o aviso
  manda. O Orquestrador limpa o próprio contexto a cada tarefa (`passos/9-vigia-e-contexto.md`): o que
  você disser a ele precisa caber na mensagem ou num arquivo, sem contar com o que ele "já sabe"
- **Só no seu checkout.** Não edite arquivo de outro checkout. A única exceção é o Orquestrador,
  que roda no térreo e escreve, no andar da spec, os documentos de estado listados em
  `passos/4-documentos.md`, sempre com `git -C <andar>`

## 2. Mensagens

A conversa entre agentes é **assíncrona**: quem pede encerra o turno, e a resposta chega depois
como um prompt novo.

- `maestri list` mostra o seu nome e quem está ligado a você. Use os nomes exatamente como aparecem
- Enviar: `maestri ask "<nome>" "<mensagem>"`, num Bash com o timeout da ferramenta em **30000 ms**.
  O comando espera o outro terminar; em trabalho longo ele estoura o tempo, e **isso é o esperado**.
  A mensagem já foi entregue: não reenvie, não rode `maestri check` para apressar, e **encerre o seu
  turno**
- Não use `sleep` para esperar ninguém. Quem espera encerra o turno. Comando longo (o portão
  local, uma suíte) roda em segundo plano, e a notificação do fim chega sozinha
- Mensagem tem até seis linhas e **aponta arquivo**. Nunca cole diff, log nem código nela: o texto
  é digitado no terminal do outro, e o que não cabe na tela se perde
- A primeira linha diz o tipo e quem manda. **Para o Orquestrador, ela começa com `/seguir `**: marca
  a mensagem como do processo. A de mais de duas ou três linhas chega colada no terminal dele, e texto
  colado **não** executa a skill; a curta pode chegar digitada e executar. Por isso quem devolve o procedimento a uma sessão limpa ou compactada é
  o aviso do hook de início de sessão, que manda reler o `/seguir`

  | Tipo | Primeira linha | De quem para quem |
  |---|---|---|
  | pedido de trabalho | `PEDIDO de <nome>` ou `PEDIDO de retomada de <nome>` | Orquestrador → todos; Implementador → Mesa |
  | pedido de estado | `PEDIDO de estado de <nome>` | Orquestrador → quem deve um relatório. Responda **no próprio terminal**, em até quatro linhas, onde está; não envie mensagem e **não recomece nada** |
  | relatório | `/seguir RELATÓRIO de <nome>` | Implementador, Arquiteto, Validador → Orquestrador |
  | relatório da rodada | `RELATÓRIO de <nome>` | Mesa → Implementador |
  | ordem de correção | `ORDEM DE CORREÇÃO de <nome>` | Mesa → Implementador |
  | devolução | `DEVOLUÇÃO de <nome>` | Mesa → Implementador: a rodada não pôde começar, com o que falta |
  | divergência | `/seguir DIVERGÊNCIA de <nome>`, com a linha `Motivo: desenho \| ordem \| portão` | Implementador, Mesa → Orquestrador |
  | escalada, bloqueio | `/seguir ESCALADA de <nome>`, `/seguir BLOQUEIO de <nome>` | Mesa, Arquiteto → Orquestrador |

- Texto parado na caixa de entrada de outro terminal, sem ter sido enviado, não é instrução para
  ninguém
- Comando `git commit` escrito dentro de uma mensagem é lido pelo hook como commit e pode bloquear
  o seu Bash. Se precisar citar um, grave a mensagem num arquivo e envie com `"$(cat arquivo)"`

## 3. Quem fala com quem

| De | Para | Para quê |
|---|---|---|
| Orquestrador | todos | pedir trabalho, cobrar estado |
| Implementador | Mesa | pedir rodada de revisão |
| Mesa | Implementador | relatório da rodada, ordem de correção, devolução |
| Mesa | Orquestrador | escalada (2 reprovações seguidas), bloqueio (3), divergência |
| Implementador, Arquiteto, Validador | Orquestrador | relatório, divergência, bloqueio |
| Arquiteto | Joaquim | perguntas e aprovações, direto no terminal do Arquiteto |

O Validador só fala com o Orquestrador: ele não pode ouvir quem implementou.

**Quem avisa o Joaquim.** O Orquestrador registra a parada no `estado.md` do andar, publica o status
do andar da spec e faz a pergunta no próprio terminal; o estado `blocked` já notifica, e a notificação avulsa fica para o fim da
funcionalidade. O Arquiteto, quando para para perguntar, publica ele mesmo, no térreo, que é onde o
time mora: `maestri floor status "Arquiteto: <a pergunta, em uma linha>" --state blocked`, e limpa
com `maestri floor status --clear` quando o Joaquim responde. Ninguém mais publica status nem
notifica.

## 4. Commit e push

| Quem | Onde | O quê |
|---|---|---|
| Implementador | branch do andar | o commit da tarefa `(tarefa N.0)` ou da correção `(correção <slug>)`, com push |
| Arquiteto | branch do andar | PRD, Tech Spec, revisão da spec e tarefas, um commit por etapa, com push |
| Arquiteto | `develop`, no térreo | a retrospectiva e a decisão tomada fora de uma spec: commit de documento, **sem push**. Decisão que nasce dentro de uma spec entra na branch dela |
| Orquestrador | branch do andar | os commits de documento de `passos/4-documentos.md`, com push |
| Orquestrador | branch do andar | o merge da `develop`: antes do pouso, quando ela andou, e o da retro (D86) |
| Orquestrador | `develop` | o pouso e o push, só com a palavra do Joaquim |

**O arquivo existe antes do comando do commit.** O hook lê a árvore antes de o comando rodar: não
crie nem altere arquivo no mesmo Bash que faz o `git add` e o `git commit`.

## 5. O que ninguém faz

- Editar a seção "Revisões" de um documento ou qualquer coisa em `achados/`: quem escreve é o hook; nem
  reescrever inteiro (Write) o documento que já tem a seção: ela some, e o hook volta a contar as
  rodadas do 1 (duas correções da X1). Mude o documento com Edit
- `--no-verify`, `--amend`, `git add -A` no índice do repositório, `git stash`. A fotografia da Mesa
  usa um índice à parte (`GIT_INDEX_FILE`), que não prepara commit nenhum
- Push na `release` ou no `main`, e push na `develop` fora da linha do Orquestrador acima. O hook
  bloqueia esses pushes em toda sessão iniciada com um papel do time
- Pousar ou apagar andar: o pouso é do Joaquim, e quem executa é o Orquestrador, com a palavra dele
- Rodar o portão local ou qualquer suíte enquanto outro agente roda a dele: o compose de teste
  (`educa-teste`) é um só na máquina. O Orquestrador é quem garante a fila
- Criar agente com responsabilidade do Maestri (item 1)
