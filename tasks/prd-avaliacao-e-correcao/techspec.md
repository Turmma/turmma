# Tech Spec — Avaliação e correção (prova online)

**PRD:** `tasks/prd-avaliacao-e-correcao/prd.md` (RF1 a RF10; os RF11 a RF20 são a F6d)
**Status:** rascunho

Decidido pelo Joaquim aqui (23/11/2026): o corte da F6d; a prova **encerra sozinha**; o Tutor trava **só na janela**.

## 1. Resumo da abordagem

A prova é a `atividade_aplicada` avaliativa com janela, duração, embaralhamento e segunda chamada, sem entidade nova.
O tempo de cada aluno é uma conta pura no servidor, `limiteDaTentativa`: início, duração com tempo adicional, fim da
janela, extensões e as **indisponibilidades** que a própria API registra. Uma rotina por minuto encerra a prova vencida
pelo `encerrar` de hoje, que corrige. O embaralhamento é só de apresentação: a tela recebe a questão e a alternativa com
o número original, e a correção não muda.

## 2. Módulos afetados

| Módulo | Novo ou alterado | O quê |
|---|---|---|
| `packages/core/src/db/schema` | alterado + novo | §3 |
| `packages/shared/src/atividade` | alterado | contratos da §4; `limiteDaTentativa` |
| `apps/api/src/atividade/atividade-aplicada` | alterado | aplicar, janela, estender, segunda chamada, acompanhar |
| `apps/api/src/atividade/minha-atividade` | alterado | começar, prova sem gravar, limite, saída da aba |
| `apps/api/src/atividade/pulso` | novo | pulso e indisponibilidade |
| `apps/api/src/tutor` | alterado | `avaliativaAberta` pela janela e pelos convocados |
| `apps/worker` | novo | `sistema.encerrar-provas-vencidas` e `atividade.encerrar-vencidas` |
| `apps/web` professor e aluno | alterado + rota | §9 |

## 3. Modelo de dados

Tudo expansão; nenhuma coluna sai.

```
atividade_aplicada   + abre_em timestamptz?, fecha_em timestamptz?, duracao_min smallint? (5–300),
                       embaralhar_questoes bool (false), embaralhar_alternativas bool (false),
                       segunda_chamada_de uuid? → atividade_aplicada (mesma escola, ano, turma, artefato)
tentativa_atividade  + limite_base_em timestamptz?, ordem jsonb?, saidas_da_aba smallint (0),
                       ultima_chave_de_saida uuid?, envio text? (aluno | limite | encerramento)
tempo_adicional      escola*, ano_letivo*, atividade_aplicada*, aluno*, percentual* (25|50|100),
                       concedido_por*, concedido_em*        unique (escola, atividade_aplicada, aluno)
extensao_de_tempo    escola*, ano_letivo*, atividade_aplicada*, aluno? (nulo = a turma), minutos* (1–120),
                       concedida_por*, concedida_em*, chave* uuid   unique (escola, chave)
convocado_da_segunda_chamada  escola*, ano_letivo*, atividade_aplicada*, aluno*   unique (escola, aplicação, aluno)
pulso_da_api         id uuid, ultimo_em timestamptz        (linha única: índice único em `(true)`)
indisponibilidade    id uuid, inicio timestamptz, fim timestamptz        (sem escola, sem pessoa)
```

- Checks: janela, duração e embaralhar só em `avaliativa`; `abre_em < fecha_em`. A **API exige janela** na avaliativa
  nova; a antiga sem janela segue como hoje, sem backfill.
- O índice das abertas passa a excluir a segunda chamada; outro índice parcial: uma segunda chamada aberta por original.
- FKs compostas com escola e ano; aluno com `on delete cascade`; `concedido_por` pelo gatilho `exigir_equipe_da_escola`.
- `pulso_da_api` e `indisponibilidade` entram nas exceções do item 1 das regras transversais de `docs/modelo-de-dados.md`.
- Uma migration, `00NN_prova_online`, escrita à mão (checks, gatilhos, índices parciais).

## 4. API

| Método | Rota | Papel | Entrada | Saída |
|---|---|---|---|---|
| POST | `/v1/atividades-aplicadas` | professor | + `janela`, `duracaoMin?`, `embaralhar`, `tempoAdicional[{alunoId, percentual}]` | aplicação |
| PATCH | `/v1/atividades-aplicadas/:id/janela` | professor | janela, duração, tempo adicional | aplicação; `PROVA_JA_COMECOU` |
| POST | `/v1/atividades-aplicadas/:id/extensoes` | professor | `alunoId?`, `minutos`, `chave` | acompanhamento |
| GET | `/v1/atividades-aplicadas/:id/acompanhamento` | professor | — | por aluno: situação, limite, saídas (nome só aqui) |
| POST | `/v1/atividades-aplicadas/:id/segunda-chamada` | professor | `alunoIds`, janela, duração, tempo adicional | aplicação nova |
| POST | `/v1/atividades-aplicadas/:id/comecar` | aluno | — | prova; `PROVA_FORA_DA_JANELA` |
| GET | `/v1/atividades-aplicadas/:id/prova` | aluno | — | questões na ordem dele, `limiteEm`, `agora`, `envio`; **não grava** |
| PUT | `…/respostas/:questao` | aluno | como hoje (número original) | `TEMPO_ESGOTADO` além do limite |
| POST | `…/saidas-da-aba` | aluno | `chave` | 204; `NAO_ENCONTRADO` fora de prova em andamento |
| GET | `/v1/atividades-aplicadas/:id/correcao` | professor | — | + `saidasDaAba` por aluno, só em avaliativa |

`GET /v1/minhas-atividades` traz janela e duração; a segunda chamada só aparece ao convocado.

## 5. Fluxo

1. **Aplicar.** Valida janela, duração e alunos do tempo adicional; grava aplicação, `tempo_adicional` e auditoria numa
   transação.
2. **Começar.** Aplicação `for share`; fora da janela, `PROVA_FORA_DA_JANELA`; não convocado, inexistente.
   `insert … on conflict do nothing` com `limite_base_em = min(início + duração × (1 + percentual), fecha_em)` e `ordem`
   sorteada (`crypto.randomInt`), **só na primeira**; quem perde lê a gravada.
3. **Limite efetivo** = `limiteDaTentativa`: o limite base mais as extensões do aluno e da turma e, em ponto fixo, a
   sobreposição das indisponibilidades com `[iniciada_em, limite]`. Sem duração nem janela, não há limite.
4. **Responder.** A recusa sai na mesma instrução, com o `now()` do banco: `TEMPO_ESGOTADO` não grava. O cliente relê a
   prova e, se o limite andou, reenvia a fila.
5. **Enviar no limite.** Vencida sem envio conta como enviada em toda leitura; a rotina grava `enviada_em = limite`,
   `envio = 'limite'`.
6. **Encerrar sozinha.** `sistema.encerrar-provas-vencidas` (cron `* * * * *`, urgente) lista, `@Unscoped`, os pares
   (escola, aplicação) avaliativos abertos com `fecha_em` passado e grava um `atividade.encerrar-vencidas` por escola, que
   confere o fim efetivo e as tentativas e chama o `encerrar` de hoje. O lote nasce pendente e chega ao sino.
7. **Pulso.** Cada instância da API, a cada 10 s: `with antes as (select ultimo_em … for update) update … returning
   antes.ultimo_em`; lacuna acima de 30 s vira `indisponibilidade(antes, agora)`. API ou banco fora aparecem no primeiro
   pulso de volta; a rede da escola caída, não.
8. **Saída da aba.** A tela de foco conta `visibilitychange` para `hidden` e o `blur`, uma vez por saída, com chave nova;
   o servidor soma só em tentativa em andamento de avaliativa, `where ultima_chave_de_saida is distinct from $chave`.
9. **Segunda chamada.** Com a original encerrada, para alunos sem tentativa enviada nela: aplicação nova do mesmo
   artefato, convocados e tempo adicional; lote próprio.
10. **Tutor.** Travado com avaliativa da turma dentro da janela efetiva (sem janela, aberta, como hoje); a segunda
    chamada trava só o convocado.

## 6. Isolamento

Tabela nova tem `escola_id` e `ano_letivo_id` (fora as duas operacionais), FK composta com a aplicação, e só repository
com `requireEscolaId()` a toca. A rotina por minuto é a única `@Unscoped` nova e devolve só ids. Testes: professor de A
não estende, não reabre, não muda janela nem lê o acompanhamento da B (`NAO_ENCONTRADO`); aluno de A não começa nem
manda saída na B; o não convocado não vê a segunda chamada; o job de A não encerra prova de B. Tirar o `escola_id` do
`where` de cada repository novo deixa o caso vermelho.

## 7. Dado pessoal

| Item | Resposta |
|---|---|
| Campos tocados e novos | tentativa (limite, ordem, envio, saídas), tempo adicional, extensão, convocado: em `docs/lgpd.md` nesta Tech Spec |
| O que vai para log | só ids e códigos; nunca minutos por aluno junto do nome |
| Auditoria | `atividade.aplicada` (com janela e quantos com tempo adicional, sem quem), `atividade.janela_alterada`, `atividade.tempo_estendido`, `atividade.segunda_chamada_aplicada`, `atividade.encerrada_pelo_limite` |
| Provedor externo | nada: não há IA nesta fase |
| Retenção | a da tentativa (trabalho do aluno); `indisponibilidade`, 13 meses |
| Arquivo do titular | colunas novas da tentativa e `tempo_adicional`/`extensao_de_tempo`/`convocado…` entram nas duas versões, sem `concedido_por` nem `chave` (`fora`) |
| Autorização por objeto | professor pelo `canAplicarNaTurma` de hoje; aluno pela turma atual e pelos convocados |
| DTO | acompanhamento: aluno (id, nome), situação, `limiteEm`, saídas; a prova do aluno não traz colega nem saídas |

A contagem de saídas não entra no `apresentado` da validação: o registro guarda só que a coluna foi mostrada (D70, D88).

## 7b. Conformidade CNE

Alto risco (correção de objetiva), sem IA nova: correção determinística, lote só com os destaques abertos e o registro da
validação. A saída da aba é fato, nunca destaque nem bloqueio (D70, D88). O encerramento sozinho só cria o lote
pendente; aprovar continua do professor.

## 7c. Carga e falha

| Item | Resposta |
|---|---|
| Caminho quente | prova |
| Manhã de segunda | 60 turmas × 35 alunos (PUT por item, releitura a cada 30 s): ~80 req/s; rotina: 1 consulta por minuto |
| Fila e limite | `sistema.*` urgente; `atividade.encerrar-vencidas` normal, na vaga por escola |
| Rate limit | o por usuário de hoje; `saidas-da-aba` e `comecar` com balde por usuário de 30/min, que recusa (429), com teste |
| Corridas | começar × começar; mudar janela × começar (`for update` × `for share`); resposta × encerrar (como hoje); estender × estender (`chave`); job × professor encerrando; pulso × pulso (`for update`); segunda chamada dupla (índice parcial). Ordem forçada e mutação de cada uma: `cenarios.md` §3 |
| Laços | job por escola: até 200 aplicações, 1 por transação, prazo 60 s; aluno relê a cada 30 s, acompanhamento a cada 15 s, só à vista |
| Índices | `atividade_aplicada (escola_id, estado, fecha_em) where avaliativa`; `extensao_de_tempo (escola_id, atividade_aplicada_id)`; `indisponibilidade (fim)` |
| Migration e volta | só expansão; o código anterior ignora as colunas novas, e a prova com janela gravada por ele não existe |
| Dependência cai | banco ou API: fila do cliente e tempo devolvido; Redis: como hoje; worker parado: a prova não encerra, mas ninguém responde além do limite |
| Erro que não diz se gravou | `TEMPO_ESGOTADO`, `PROVA_FORA_DA_JANELA`, `PROVA_JA_COMECOU`: recusa antes de gravar, e a tela diz. Prazo do navegador ou conexão caída: pode ter gravado; a fila reenvia, idempotente |
| Métrica e alerta | `prova.encerrada_pelo_limite`; idade da prova vencida aberta (alerta acima de 5 min, com runbook); `api.indisponibilidade_registrada` |
| Carga | k6 novo, `prova-online.js`: 35 alunos × 20 itens, com rede que cai |

## 8. Uso de IA

Nenhum; o relatório do lote é o de hoje.

## 9. Frontend

- **Aplicar** (`AplicacaoDoArtefato.tsx`): com "avaliativa", janela, duração, os dois embaralhar e "Tempo adicional" (os
  alunos da turma, pela leitura de Alunos de hoje, com o percentual); resumo antes de confirmar (regra 50, item 8).
- **Painel da atividade** (`?atividade=`, lê `acompanhamento`): por aluno em ordem de nome, a situação em texto ("Não
  começou", "Fazendo · termina às 10:42", "Enviou"); "Estender" (aluno ou turma), "Mudar janela" antes do primeiro
  início, "Segunda chamada" depois de encerrada.
- **Aprovar**: coluna "Saiu da aba" em avaliativa, com o aviso fixo da D88 uma vez acima da tabela.
- **Aluno**: "Antes de começar" (duração, saída da aba, como sair) e "Começar"; `/aluno/prova/:id` **fora da casca**, com o
  relógio do servidor (`limiteEm − agora`, corrigido pelo desvio), "Salvo"/"Salvando" e "Sair da prova", um clique. No
  celular, relógio e "Sair" numa faixa de uma linha no topo, sem cobrir a questão.
- A altura é da casca da prova (coluna flexível, `min-h-0`), sem `calc(100dvh − N)`. Textos: `cenarios.md` §4; peças:
  `docs/interface.md` §10.

## 10. Testes

| Camada | O que será testado |
|---|---|
| Unidade | `limiteDaTentativa`; sorteio da ordem; contagem de saídas na tela |
| Integração | cada rota da §4, o pulso, o encerramento sozinho e a trava do Tutor |
| E2E | prova com tempo, com a rede caindo (regra 40), em `chromebook` e `celular` |
| Isolamento | §6 |

Cenários e mutações: `cenarios.md`.

## 11. Conformidade com as regras

| Regra | Como é atendida | Desvio e justificativa | Onde |
|---|---|---|---|
| 10 | §6; uma rotina `@Unscoped`, só ids | `pulso_da_api` e `indisponibilidade` sem `escola_id`: fato global, sem dono nem pessoa | `docs/modelo-de-dados.md`, item 1 |
| 20, 70, 40 | §7, §7b, §10 | — | — |
| 80, item 6 | relógio do servidor, gravação por item, tempo devolvido | a rede da escola caída não devolve tempo: medir a conexão do aluno é vedado (regra 70, item 7); o professor estende | PRD §7 |

## 12. Premissas não verificadas

- ⚠️ NÃO VERIFICADO: o `blur` no ChromeOS com teclado virtual e leitor de tela. A contagem segue a D70, com o aviso
  fixo; a medida vai à etapa 5 da AIA (F6d).

## 13. Riscos técnicos

- **Pulso perdido sob carga** (pool cheio) vira indisponibilidade falsa, a favor do aluno; a métrica mostra, e o pulso
  ganha conexão própria se aparecer.
- **Rotina parada**: ninguém responde além do limite; só o lote atrasa, e o alerta avisa.
