# Tech Spec — Avaliação e correção (prova online)

**PRD:** `tasks/prd-avaliacao-e-correcao/prd.md` (RF1 a RF10; os RF11 a RF20 são a F6d)
**Status:** em revisão (`revisao-spec.md`)

Decidido pelo Joaquim aqui (23/11/2026): o corte da F6d; a prova **encerra sozinha**; o Tutor trava **só na janela**.

## 1. Resumo da abordagem

A prova é a `atividade_aplicada` avaliativa com janela, duração, embaralhamento e segunda chamada. O tempo de cada aluno
sai de **uma função só**, `limiteDaTentativa`, com as **indisponibilidades** que a API registra, inclusive a em curso.
Uma rotina por minuto encerra a prova vencida. O embaralhamento é só de apresentação: a tela recebe o número original.

## 2. Módulos afetados

| Módulo | O quê |
|---|---|
| `packages/core/src/db/schema` | §3 |
| `packages/shared` (`atividade`, `permissao`, `privacidade`) | contratos, `limiteDaTentativa`, matriz, classificação |
| `apps/api/src/atividade` (`atividade-aplicada`, `minha-atividade`, `pulso` novo) | §4 e §5 |
| `apps/api/src/tutor` | trava por aluno |
| `apps/worker` | a rotina, o job por escola, o expurgo |
| `apps/web` | §9 |

## 3. Modelo de dados

Tudo expansão; nenhuma coluna sai.

```
atividade_aplicada   + abre_em timestamptz?, fecha_em timestamptz?, duracao_min smallint? (5–300),
                       embaralhar_questoes bool (false), embaralhar_alternativas bool (false),
                       segunda_chamada_de uuid? → atividade_aplicada (mesma escola, ano, turma, artefato)
tentativa_atividade  + limite_base_em timestamptz?, ordem jsonb?, saidas_da_aba smallint (0),
                       envio text? (aluno | limite | encerramento)
saida_da_aba         escola*, ano_letivo*, atividade_aplicada*, aluno*, chave* uuid v4    (sem id nem tempo; no arquivo do titular vem agrupada por tentativa, a contagem, com o `id` da tentativa)
                       PK nas cinco; FK → tentativa, on delete cascade
tempo_adicional      id, escola*, ano_letivo*, atividade_aplicada*, aluno*, percentual* (25|50|100),
                       concedido_por*, concedido_em*        unique (escola, atividade_aplicada, aluno)
extensao_de_tempo    id, escola*, ano_letivo*, atividade_aplicada*, aluno? (nulo = a turma), minutos* (1–120),
                       concedida_por*, concedida_em*, chave* uuid   unique (escola, atividade_aplicada, chave)
convocado_da_segunda_chamada  id, escola*, ano_letivo*, atividade_aplicada*, aluno*   unique (escola, aplicação, aluno)
pulso_da_api         id, ultimo_em timestamptz        (linha única, criada pela migration)
indisponibilidade    id, inicio, fim timestamptz      (sem escola, sem pessoa)
```

- Ids uuidv7; checks de janela, duração e embaralhar só em `avaliativa`, `abre_em < fecha_em`. A **API exige janela** na
  avaliativa nova; a antiga segue **lida** como hoje, sem backfill. A exigência mora na conferência compartilhada
  (`camposInvalidosDaProva`), e por isso vale no `aplicar`, no PATCH da janela e na segunda chamada: a prova que sai de uma
  escrita precisa ter janela, e o PATCH de uma avaliativa de antes da F6 só passa se trouxer a janela. Entrou na 10.0, com a
  tela (a 1.0 a deixou opcional porque a tela de A3 mandava `{artefatoId, turmaId, avaliativa}`).
- O índice das abertas exclui a segunda chamada (o novo antes de derrubar o antigo); outro: uma segunda chamada aberta
  por original. Checks em tabela existente com `NOT VALID` e `VALIDATE`.
- FKs compostas com escola e ano; aluno `on delete cascade`; autor pelo gatilho `exigir_equipe_da_escola`.
- As quatro tabelas com aluno são `trabalho_do_aluno` (classificação e expurgo; a extensão da turma sai com elas).
  `pulso_da_api` e `indisponibilidade`: exceções do item 1 de `docs/modelo-de-dados.md`; esta sai aos 13 meses.
- Uma migration, `00NN_prova_online`, escrita à mão.

## 4. API

| Método | Rota | Papel | Entrada | Saída |
|---|---|---|---|---|
| POST | `/v1/atividades-aplicadas` | professor | + `janela`, `duracaoMin?`, `embaralhar`, `tempoAdicional[{alunoId, percentual}]` | aplicação |
| PATCH | `…/:id/janela` | professor | parcial: janela, duração, tempo adicional | aplicação; `PROVA_JA_COMECOU` |
| POST | `…/:id/extensoes` | professor | `alunoId?`, `minutos`, `chave` | acompanhamento |
| GET | `…/:id/acompanhamento` | professor | — | por aluno: id, nome, situação, `limiteEm`; **sem saídas** |
| POST | `…/:id/segunda-chamada` | professor | `alunoIds`, janela, duração, tempo adicional | aplicação nova |
| POST | `…/:id/comecar` | aluno | — | prova; `PROVA_FORA_DA_JANELA` |
| GET | `…/:id/prova` | aluno | — | antes de começar, só janela e `duracaoMin`; depois, questões na ordem dele e o `tempo`. **Não grava** |
| GET | `…/:id/tempo` | aluno | — | `limiteEm`, `agora`, `envio` (releitura de 30 s) |
| PUT | `…/respostas/:questao` | aluno | como hoje (número original) | `TEMPO_ESGOTADO` além do limite |
| POST | `…/saidas-da-aba` | aluno | `chave` | 204; `NAO_ENCONTRADO` fora de prova em andamento |
| GET | `…/:id/correcao` | professor | — | + `saidasDaAba` por aluno, só em avaliativa (opcional no contrato; a 5.0 o preenche) |

`minhas-atividades` traz janela e duração (com o tempo adicional, sem dizer que é adicional); a segunda chamada, só ao
convocado.

## 5. Fluxo

1. **Aplicar.** Alunos do tempo adicional, da extensão e da segunda chamada são da turma. Tempo adicional que não cabe
   na janela (`fecha_em − abre_em < duração × (1 + maior percentual)`) é `ENTRADA_INVALIDA`, também ao mudar a janela e
   na segunda chamada. `tempoAdicional` exige `duracaoMin`, e `duracaoMin` exige `janela` (a mesma
   `camposInvalidosDaProva`, do schema compartilhado, no aplicar, no PATCH e na segunda chamada). O corpo do erro
   `ENTRADA_INVALIDA` leva só o código, sem o nome do campo: o campo é do schema compartilhado, que a tela usa antes de
   enviar. Aplicação, `tempo_adicional` e auditoria numa transação.
2. **Alcance primeiro.** Nas rotas do aluno, uma consulta resolve escola, ano em curso, vínculo aberto na turma e
   convocado; fora, `NAO_ENCONTRADO`. Só depois a janela, e depois o limite.
3. **Começar.** Aplicação `for share`; `insert … on conflict do nothing` com `limite_base_em = min(início + duração ×
   (1 + percentual), fecha_em)` e `ordem` por um sorteador injetável (`crypto.randomInt`), **só na primeira**; quem perde
   lê a gravada.
4. **Limite efetivo** = `limiteDaTentativa`: o base mais as extensões do aluno e da turma e, em ponto fixo, a sobreposição
   com `[iniciada_em, limite]` das indisponibilidades fechadas e da **aberta** (`(pulso.ultimo_em, now())` acima de 30 s).
   Sem duração nem janela, não há limite. Chamam a mesma função o PUT, a saída, `prova`, `tempo`, a rotina e
   o Tutor.
5. **Responder.** Na transação do PUT, com o `now()` do banco: além do limite, `TEMPO_ESGOTADO`, sem gravar. Vencida sem
   envio conta como enviada em toda leitura (RF5). **O encerramento grava o fato**, o da professora e o da rotina (o
   mesmo miolo, na transação do `for update`): toda tentativa em andamento com `limiteDaTentativa ≤ now()` recebe
   `enviada_em = limite`, `envio = 'limite'`; a que ainda tinha tempo fica sem envio, e a leitura diz `encerramento`.
   A leitura **mantém a ordem** (enviada, encerrada, vencida): depois do encerramento, encerrada sem envio é só a que a
   professora cortou antes do limite. Vale o que veio primeiro, gravado uma vez; comparar na leitura o limite com
   `encerrada_em` mudaria depois (uma queda posterior anda o limite). A cortada segue convocável na segunda chamada
   (§5.9); a vencida, não. Decidido na triagem antes da 6.0 (recomendação do revisor-geral na 3.0).
6. **Encerrar sozinha.** `sistema.encerrar-provas-vencidas` (por minuto, fila `lote`, `naoUrgente: false`, chave do
   minuto; o job por escola também) **não roda com o pulso de mais de 30 s**, conferido de novo na transação do job; lista, `@Unscoped`, pelo índice `(fecha_em) where avaliativa and aberta`, as do ano em curso com
   `fecha_em` passado, e grava um `atividade.encerrar-vencidas` por escola. Por aplicação, numa transação: `for update`,
   o fim efetivo (janela com extensões da turma, limite de cada tentativa em andamento) e `encerrarPeloLimite`: o
   `encerrar` sem o alcance do professor, com a suspensão conferida na escola do job (suspensa: sem lote, como hoje).
   `estender` toma a aplicação `for share`. A aberta na virada do ano fica como hoje.
7. **Pulso.** Cada instância HTTP, com conexão própria que reconecta, a cada 10 s e antes de aceitar tráfego, numa
   instrução com o `now()` do banco: `with antes as (select … for update), novo as (update … returning antes.ultimo_em)
   insert into indisponibilidade select … where lacuna > 30 s`. A instância que não pulsa há 30 s recusa as rotas do
   aluno (503): toda lacuna gravada é queda real, e a aberta e a fechada contam igual. Tique e relógio injetáveis.
8. **Saída da aba.** A tela conta `visibilitychange` e `blur` como uma saída e manda **em série**, numa fila própria (o
   429 não para a de respostas). O servidor soma só com chave nova em `saida_da_aba`, em prova em andamento.
9. **Segunda chamada.** Com a original encerrada, as checagens do aplicar, para alunos da turma atual sem tentativa
   enviada nela: aplicação nova, convocados e tempo adicional; lote próprio.
10. **Tutor.** Por aluno, travado do `abre_em` até o fim da janela (com extensões da turma) ou o limite dele, o que vier
    depois; sem janela, como hoje; a segunda chamada trava só o convocado. Latência medida na tarefa.

## 6. Isolamento

Tabela nova tem `escola_id` e `ano_letivo_id` (fora `pulso_da_api` e `indisponibilidade`), FK composta, e só repository com
`requireEscolaId()` a toca. A rotina é a única `@Unscoped` nova, só ids. Professor de B ou sem vínculo na turma, aluno de
B, não convocado e transferido, mesmo fora da janela: `NAO_ENCONTRADO`. O job de A, com provas vencidas em A e B, não
toca a de B. Repository novo, contexto de A com id de B: vazio. Casos: `cenarios.md` §1b.

## 7. Dado pessoal

| Item | Resposta |
|---|---|
| Campos novos | os da §3, em `docs/lgpd.md`. O tempo adicional é adaptação, **sensível** (art. 11, D35): só o percentual, preso à prova |
| Log, métrica, auditoria | só ids e códigos, nunca percentual nem minutos por aluno; auditoria `atividade.aplicada` (`comTempoAdicional`: a contagem, que a resposta da aplicação também leva), `.janela_alterada` (`antes` e `depois` só com a janela, a duração e a contagem, sem `alunoId` nem percentual), `.tempo_estendido`, `.segunda_chamada_aplicada`, `.encerrada_pelo_limite` |
| Provedor externo | nenhum; nada entra na memória do Tutor |
| Retenção e titular | `trabalho_do_aluno`; no arquivo pelo `aluno_id`, com autor e `chave` `fora`. **Nas duas versões**, também na `coordenacao` (do titular sem conta ativa), por exceção declarada no PRD, §6 (art. 18): `tempo_adicional` com percentual e `concedido_em`, sem `concedido_por`; `saida_da_aba` agrupada por tentativa, a contagem, e `tentativa_atividade.saidas_da_aba`. Um caso na versão `coordenacao` em `apps/api/test/arquivo-do-titular.int.test.ts` prova cada uma |
| Autorização | professor pelo `canAplicarNaTurma`; aluno pela §5.2; ações novas na matriz, coordenação e rede em `nunca` |
| DTO | o aluno não lê colega, saídas nem "tempo adicional"; a coordenação e a rede, nada disto, fora o arquivo do titular sem conta ativa (linha acima) |

A contagem de saídas fica só no lote, fora do `apresentado`: a validação guarda que a coluna foi mostrada (D70, D88).

## 7b. Conformidade CNE

Alto risco, sem IA nova. A saída da aba nunca é destaque nem bloqueio (D70, D88); a rotina só cria o lote pendente. A
tarefa da rotina atualiza a etapa 1 da AIA de correção de objetiva (1.4/1, o gatilho; 1.4/9, a contagem).

## 7c. Carga e falha

| Item | Resposta |
|---|---|
| Caminho quente | prova: 60 turmas × 35 alunos (PUT por item, `tempo` a cada 30 s), ~80 req/s |
| Rate limit | o por usuário de hoje; `saidas-da-aba` e `comecar`, 30/min por usuário (429) |
| Corridas | `cenarios.md` §3, com ordem forçada e mutação |
| Laços | job: até 200 aplicações, 1 por transação, 60 s; acompanhamento a cada 15 s, só à vista |
| Índices | §5.6; `extensao_de_tempo (escola_id, atividade_aplicada_id)`; `indisponibilidade (fim)`; `EXPLAIN` na tarefa |
| Migration | só expansão (§3) |
| Dependência cai | API ou banco: lacuna aberta, nada encerra; worker: o lote atrasa |
| Erro ambíguo | os códigos recusam antes de gravar; o resto, a fila reenvia, idempotente |
| Alerta, com runbook | p95 do PUT de resposta acima de 500 ms; prova aberta 5 min além do fim **efetivo**; pulso parado 2 min com a API de pé |
| Carga | k6 `prova-online.js`, na escala acima, junto da `FASE=sala`: `cenarios.md` §5 |

## 8. Uso de IA

Nenhum.

## 9. Frontend

- **Aplicar** (`AplicacaoDoArtefato.tsx`): janela, duração, embaralhar e "Tempo adicional" por aluno; resumo antes.
- **Painel da atividade** (`acompanhamento`, uma consulta, nunca na tela da sala): situação por aluno; "Estender",
  "Mudar janela" (antes do início) e "Segunda chamada", com resumo antes; "Encerrar" diz quantos fazem.
- **Aprovar**: coluna "Saiu da aba" em avaliativa, sempre com o aviso fixo da D88 acima da tabela.
- **Aluno**: "Antes de começar" (de `prova` sem tentativa) e "Começar"; `/aluno/prova/:id` **fora da casca**, com o relógio
  do servidor (corrigido pelo desvio), "Salvo"/"Salvando" e "Sair da prova", um clique. No celular, relógio e "Sair"
  numa faixa de uma linha no topo.
- A **fila de respostas vive no app**: 503, 5xx e rede mantêm o item; com pendência, relê `tempo` e reenvia mesmo
  depois do "Sair" e do fim; no fim, a tela diz quantas não chegaram.
- Escola ativa (D87), fuso da escola, altura pela casca. Textos, estados, acessibilidade e 360 px:
  `cenarios.md` §4.

## 10. Testes

| Camada | O que será testado |
|---|---|
| Unidade | `limiteDaTentativa`; sorteio; filas; relógio adiantado |
| Integração | cada rota, com indisponibilidade, sem ano em curso e com vínculo encerrado; pulso; rotina; Tutor |
| E2E | rede caindo; professor aplicando e aprovando; `chromebook` e `celular`, com axe |

Cenários: `cenarios.md`.

## 11. Conformidade com as regras

| Regra | Como é atendida | Desvio e justificativa | Onde |
|---|---|---|---|
| 10 | §6; uma rotina `@Unscoped`, só ids | `pulso_da_api` e `indisponibilidade` sem `escola_id`: fato global, sem dono nem pessoa | `docs/modelo-de-dados.md`, item 1 |
| 20, 70, 40 | §7, §7b, §10 | — | — |
| 80, item 6 | relógio do servidor, gravação por item, tempo devolvido, fila no app | a rede da escola caída não devolve tempo (medir a conexão do aluno é vedado, regra 70, item 7); o professor estende e a fila grava; quem não começou durante a queda, o mesmo | PRD §7 |

## 12. Premissas não verificadas

- ⚠️ NÃO VERIFICADO: o `blur` no ChromeOS com teclado virtual e leitor de tela; conta, com o aviso fixo (etapa 5 da AIA, F6d).

## 13. Riscos técnicos

- **Pulso morto com a API de pé**: as rotas de prova param na instância, e o alerta avisa.
