# Revisão de spec — avaliacao-e-correcao

**Subagentes obrigatórios:** `test-engineer`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `frontend-reviewer`

## Rodada 1 — 23/11/2026

**Veredito: REPROVADA**

Tamanho: PRD 1.269 palavras · Tech Spec 1.999 (o teto é por documento, `criar-prd` e `criar-techspec`).

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | REPROVADO | 15 |
| `tenancy-guardian` | REPROVADO | 2 |
| `privacy-guardian` | REPROVADO | 3 |
| `conformidade-reviewer` | REPROVADO | 5 |
| `infra-guardian` | REPROVADO | 6 |
| `frontend-reviewer` | AJUSTES NECESSÁRIOS | 5 |

### Correções exigidas na Tech Spec

**Tempo e queda**
- §5.3, §5.6: a lacuna aberta do pulso (`now() − ultimo_em > 30 s`) conta como indisponibilidade em curso, com teto declarado; a rotina não encerra com o pulso velho; a instância pulsa antes de aceitar tráfego; o pulso tem conexão própria; alerta "pulso parado com a API respondendo" (`infra-guardian` 1; `test-engineer` 5)
- §5.3: o limite efetivo sai de uma função só, `limiteDaTentativa`, chamada pelo PUT, pela saída, pela leitura, pela rotina e pela trava do Tutor; integração em cada chamador com indisponibilidade (`test-engineer` 4)
- §5.6: o fim efetivo é conferido depois do `for update` da aplicação; `estender` toma a aplicação `for share`; corrida (h) estender × rotina (`infra-guardian` 2)
- §5.6: a rotina lista só aplicações do ano em curso; a aberta na virada fica como hoje; o job chama um `encerrarPeloLimite` sem professor, que confere a suspensão da função na escola do job (`test-engineer` 1; `conformidade-reviewer` 4)
- §5.1: tempo adicional que não cabe na janela (janela menor que duração × (1 + maior percentual)) é recusado ao aplicar, ao mudar a janela e na segunda chamada (`test-engineer` 14)
- §5.8: o cliente manda as saídas em série, a próxima só depois da confirmação; teste A, queda, B, A (`infra-guardian` 3)
- §9: a fila de respostas vive no app, sobrevive ao fim do tempo e ao "Sair"; com fila pendente no fim, a tela diz quantas não chegaram e pede para chamar o professor; a tela segue relendo o limite (`infra-guardian` 4)

**Acesso e isolamento**
- §5.2: a ordem é alcance (escola, turma atual, convocado), depois janela, depois limite, em `comecar`, `prova`, PUT e `saidas-da-aba` (`tenancy-guardian` 1; `privacy-guardian` 3)
- §4, §7: `saidas` sai do DTO do acompanhamento; a contagem fica só no lote (`conformidade-reviewer` 1)
- §5.10: a trava do Tutor vai, por aluno, até o fim da janela ou o limite efetivo dele, o que vier depois (`conformidade-reviewer` 3)

**Dado pessoal**
- §7 e `docs/lgpd.md`: o tempo adicional é adaptação, dado sensível (art. 11, D35), com a base da linha de adaptação; o parágrafo "não existe vínculo entre aluno e adaptação" é reescrito; percentual por aluno nunca em auditoria, log ou métrica (`privacy-guardian` 1)
- §3, §7: `tempo_adicional`, `extensao_de_tempo` e `convocado_da_segunda_chamada` classificadas em `trabalho_do_aluno` e no expurgo dela (`privacy-guardian` 2)

**Conformidade**
- §7b: a etapa 1 da AIA de correção de objetiva (itens 1.4/1 e 1.4/9) é atualizada na tarefa da rotina (`conformidade-reviewer` 5)

**Tela e carga**
- §4, §9: "Antes de começar" lê a duração do aluno (com o tempo adicional, sem dizer que é adicional) de `GET …/prova` sem tentativa, que devolve só o cabeçalho, sem questões (`frontend-reviewer` 1)
- §9: confirmação com resumo em "Mudar janela", "Segunda chamada" e "Encerrar" com alunos fazendo; acessibilidade da tela de foco (anúncio esparso do relógio, foco, `polite`); layout a 360 px das três telas do professor, com e2e `celular` (`frontend-reviewer` 3, 4, 5)
- §7c: carga em escala, junto da `FASE=sala`, com critério (p95 do PUT < 500 ms, enviadas = gravadas, reinício da API sem prova encerrada) e controle negativo; alerta de p95 do PUT e da prova vencida pelo fim efetivo (`infra-guardian` 5, 6)

### Correções exigidas no `cenarios.md`
- Escola sem ano em curso por rota; vínculo encerrado ao lado de aberto (aluno transferido, professor de outra turma); professor da mesma escola sem vínculo; aluno nas rotas do professor; coordenação sem `tempoAdicional`, `limiteEm` nem `saidas` (`test-engineer` 1, 2, 3)
- Job de A com provas vencidas em A e em B (`tenancy-guardian` 2); não convocado fora da janela (`tenancy-guardian` 1)
- Job duas vezes em paralelo, com ordem forçada, e cron duplicado; corridas (d) e (g) com quem segura quem; saída × saída; (c) declarando que cobre o job (`test-engineer` 6, 7)
- Sorteio injetável no RF8; só alternativas embaralhadas (`test-engineer` 8)
- Saída sem consequência: mesma correção e destaques com 0 e N saídas, lote aprova sem abrir, coluna sempre com o aviso; prova 2 começa em 0; PUT segue depois de N saídas (`test-engineer` 9; `conformidade-reviewer` 2)
- 429 por usuário, não por IP; e2e da rede caindo e do professor aplicando; encerrar antes do fim; função suspensa no job; auditoria sem `alunoId`; relógio do cliente adiantado (`test-engineer` 10 a 13, 15; `conformidade-reviewer` 4)
- Expurgo das três tabelas (`privacy-guardian` 2); textos de carregando, erro, sem conexão, fila pendente, fora da janela, abre em (`frontend-reviewer` 2)

### Recomendações
- Ids uuidv7 nas três tabelas; validar `alunoId` e `alunoIds` como no tempo adicional; chave de extensão por aplicação; matriz de permissão das ações novas com coordenação e rede em `nunca` (`tenancy-guardian`, `privacy-guardian`)
- Chave de idempotência da rotina por minuto; índice parcial `(fecha_em) where avaliativa and aberta`; releitura leve do limite; separar a fila de saídas da de respostas; migration com `NOT VALID` e o índice novo antes de derrubar o antigo (`infra-guardian`)
- Segunda chamada com as checagens do aplicar; métrica do PRD §9 agregada (`conformidade-reviewer`)
- Horário no fuso da escola; "Tempo esgotado" distinto por texto; fechar a pergunta 3 do PRD (`frontend-reviewer`)

## Rodada 2 — 23/11/2026

**Veredito: REPROVADA**

Os bloqueantes da rodada 1 foram resolvidos, salvo o 4 e o 11 do `test-engineer` (em parte). Os novos vêm das correções.

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | REPROVADO | 8 |
| `tenancy-guardian` | REPROVADO | 1 |
| `privacy-guardian` | REPROVADO | 2 |
| `conformidade-reviewer` | REPROVADO | 1 |
| `infra-guardian` | REPROVADO | 3 |
| `frontend-reviewer` | APROVADO | 0 |

### Correções exigidas na Tech Spec
- §3: `saida_da_aba` com escola, ano, aplicação, aluno e `chave`, FK composta para a tentativa com `on delete cascade`, **sem `em`** nem outra coluna de tempo (`tenancy-guardian` 1; `privacy-guardian` 1, 2; `conformidade-reviewer` 1)
- §5.6, §7c: a rotina e o job por escola com `naoUrgente: false`, senão o despachante os segura no horário letivo; pulso velho é mais de 30 s, conferido também na transação do job (`infra-guardian` 1)
- §5.7, §13: a instância que não pulsa há 30 s recusa as rotas de prova e a conexão do pulso reconecta, então toda lacuna gravada é queda real e sai o teto de 15 min; o `update` do pulso e o `insert` da indisponibilidade numa instrução (`infra-guardian` 2, 3; `test-engineer` 2)
- §6: nomear as duas exceções (`tenancy-guardian` 1)

### Correções exigidas no `cenarios.md`
- Integração com indisponibilidade em cada chamador de `limiteDaTentativa` (saída, `prova`, `tempo`, Tutor) e o limiar de 30 s da lacuna aberta (`test-engineer` 1)
- Pulso que volta depois de 40 min; reconexão depois de `pg_terminate_backend`; rotas de prova recusando com o pulso impedido; falha forçada entre o `update` e o `insert`; corrida (l) pulso × rotina (`test-engineer` 2; `infra-guardian` 2, 3)
- Ordem forçada que só a trava separa em (i), (j) e (k) (`test-engineer` 3, 4, 5)
- E2E `aluno-prova.spec.ts` (rede cai, volta, gravadas uma vez) e `professor-prova.spec.ts` (aplica, aluno faz, encerra, aprova com a coluna) (`test-engineer` 6)
- Contrato dividido: o aluno lê só o próprio `limiteEm`; coordenação e rede, nada (`test-engineer` 7)
- A validação marca a coluna mostrada; o 429 das saídas não para as respostas (`test-engineer` 8)
- Rotina no horário letivo encerra no minuto; eliminação do aluno apaga `saida_da_aba`; schema da `saida_da_aba` sem coluna de tempo (`infra-guardian` 1; `privacy-guardian` 1; `conformidade-reviewer` 1)

### Recomendações
- Tutor travado durante o tempo devolvido; aviso fixo no layout de 360 px; a fila relê `tempo` depois de "Sair"; o acompanhamento numa consulta só; o desvio de quem não começou por causa da queda na §11; a queda de 90 s na carga; erro de carregamento da prova e do "Antes de começar"; segunda chamada em 360 px (`conformidade-reviewer`, `infra-guardian`, `frontend-reviewer`)
- "Fazendo · termina às" revela o tempo adicional numa tela projetada: o Acompanhar não vai à tela da sala (`privacy-guardian`, `conformidade-reviewer`)
- O texto do aviso fixo (pergunta 2 do PRD) precisa da palavra do Joaquim antes da tarefa de tela

## Rodada 3 — 23/11/2026

**Veredito: REPROVADA**

Só os que reprovaram na rodada 2. Os bloqueantes dela foram resolvidos, salvo o 1 e o 5 do `test-engineer`.

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | REPROVADO | 4 |
| `tenancy-guardian` | APROVADO | 0 |
| `privacy-guardian` | REPROVADO | 1 |
| `conformidade-reviewer` | APROVADO | 0 |
| `infra-guardian` | APROVADO | 0 |

### Correções exigidas
- §3: `saida_da_aba` **sem `id`**, com chave primária composta igual ao único; a `chave` é uuid v4 gerada no cliente, e outra versão é `ENTRADA_INVALIDA`; o cenário de schema afirma a lista exata das cinco colunas, sem default `uuidv7()`; `docs/lgpd.md`: "sem horário, nem no id" (`privacy-guardian` 1; recomendação do `conformidade-reviewer`)
- §5.7: o tique do pulso e o relógio da recusa são injetáveis; os cenários de reconexão e de 503 não dependem de tempo real (`test-engineer` 2)
- §9: 503 e 5xx mantêm o item na fila e reenviam; cenário de unidade web (`test-engineer` 3)
- §4: o PATCH da janela é parcial e valida o estado relido depois do `for update`; a (k) manda só o tempo adicional na segunda (`test-engineer` 4)
- `cenarios.md`: a variante com a lacuna aberta, montada à mão, ao menos no Tutor; como montar o "pulso parado há 3 min" do PUT (`test-engineer` 1)

### Recomendações
- `limiteDaTentativa` lê o pulso e as indisponibilidades numa consulta só; a migration cria a linha do pulso; `ultimo_em = now()` do banco; só as instâncias HTTP pulsam; nomear as rotas de prova; alerta por instância e prontidão ligada ao pulso dela (`infra-guardian`, `test-engineer`)
- A mutação certa do pulso é "commits separados"; na (l), a prova vencida só sem o minuto de queda; a (i) não trava a tentativa antes do `insert`; o e2e do professor encerra pelo botão e afirma "1" na coluna (`test-engineer`)
- O `contracts.test.ts` sabe quais contratos chegam ao aluno pelo mecanismo que já tem (`test-engineer`)

## Rodada 4 — 23/11/2026

**Veredito: APROVADA**

Só os que reprovaram na rodada 3; os demais aprovaram nas rodadas 2 (`frontend-reviewer`) e 3.

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | APROVADO | 0 |
| `privacy-guardian` | APROVADO | 0 |

### Recomendações (entram como subtarefa ou cenário em `criar-tasks`)
- §5.7: "rotas do aluno" é "rotas de prova" (`comecar`, `prova`, `tempo`, PUT, envio, `saidas-da-aba`), como a §13 e o `cenarios.md`; o Tutor e `minhas-atividades` seguem com o pulso parado; o limiar de 29 s ainda aceita (`test-engineer`)
- O PATCH parcial valida sobre o estado relido depois do `for update`, e `tempoAdicional` parcial substitui a lista (`test-engineer`)
- Nos cenários da lacuna aberta, o limite original é o `fecha_em` e já passou, e o PUT vem a menos de 3 min dele (`test-engineer`)
- Texto da tela quando "Enviar" recebe 503 (`test-engineer`)
- A chave v4 provada também na rota (integração com uma v7) ou num `check` do banco; a mutação da corrida (i) é "tirar a chave primária" (`privacy-guardian`, `test-engineer`)
- Das rodadas anteriores: `limiteDaTentativa` lê o pulso e as indisponibilidades numa consulta só; alerta por instância; só as instâncias HTTP pulsam; `pulso_da_api` e `indisponibilidade` nas exceções do `architecture.test.ts`; o texto do aviso fixo (pergunta 2 do PRD) com o Joaquim antes da tarefa de tela

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-23 12:59:11 | 2026-11-23 12:59:54 | `frontend-reviewer` | 1 | AJUSTES NECESSÁRIOS | a8cfe6af9ddcca241 |
| 2026-11-23 12:59:00 | 2026-11-23 13:01:09 | `tenancy-guardian` | 1 | REPROVADO | a9740a7e89b8f7d4d |
| 2026-11-23 12:58:57 | 2026-11-23 13:02:14 | `test-engineer` | 1 | REPROVADO | ac188c6e6b53f828f |
| 2026-11-23 12:59:02 | 2026-11-23 13:02:15 | `privacy-guardian` | 1 | REPROVADO | a49ebff11ef936847 |
| 2026-11-23 12:59:06 | 2026-11-23 13:02:37 | `conformidade-reviewer` | 1 | REPROVADO | a40b14a61b6657ed8 |
| 2026-11-23 12:59:08 | 2026-11-23 13:02:50 | `infra-guardian` | 1 | REPROVADO | a407233341d09dd16 |
| 2026-11-23 13:08:35 | 2026-11-23 13:09:02 | `frontend-reviewer` | 2 | APROVADO | a2c1c2dc58e08b601 |
| 2026-11-23 13:08:21 | 2026-11-23 13:09:16 | `tenancy-guardian` | 2 | REPROVADO | abd69a1c0e95292a0 |
| 2026-11-23 13:08:28 | 2026-11-23 13:10:15 | `conformidade-reviewer` | 2 | REPROVADO | a73c37bf63e20f880 |
| 2026-11-23 13:08:25 | 2026-11-23 13:10:21 | `privacy-guardian` | 2 | REPROVADO | a713339fc2549fc3f |
| 2026-11-23 13:08:18 | 2026-11-23 13:10:43 | `test-engineer` | 2 | REPROVADO | afc5c7a3457f45998 |
| 2026-11-23 13:08:32 | 2026-11-23 13:12:02 | `infra-guardian` | 2 | REPROVADO | aab0479a757db120f |
| 2026-11-23 13:13:51 | 2026-11-23 13:14:35 | `tenancy-guardian` | 3 | APROVADO | a829759887f82c2ff |
| 2026-11-23 13:13:54 | 2026-11-23 13:15:12 | `privacy-guardian` | 3 | REPROVADO | a43ee71f523236f2a |
| 2026-11-23 13:13:56 | 2026-11-23 13:15:20 | `conformidade-reviewer` | 3 | APROVADO | ab741d20ca874e703 |
| 2026-11-23 13:13:59 | 2026-11-23 13:16:49 | `infra-guardian` | 3 | APROVADO | add7021b7d587abbe |
| 2026-11-23 13:13:49 | 2026-11-23 13:17:11 | `test-engineer` | 3 | REPROVADO | a184f3e0ed16e1e20 |
| 2026-11-23 13:18:18 | 2026-11-23 13:19:18 | `privacy-guardian` | 4 | APROVADO | a842cc1caa7a2d2cf |
| 2026-11-23 13:18:15 | 2026-11-23 13:20:17 | `test-engineer` | 4 | APROVADO | a483a7a108feff7f1 |
