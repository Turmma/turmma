# Tarefa 6.0 — A repetição com a reserva: no máximo quatro chamadas, dentro do prazo da execução

**Funcionalidade:** reserva-e-avaliacao · **Depende de:** 4.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`
**Porte:** grande

## Objetivo

Duas inválidas na reserva passam pela saída de reserva da tarefa (`reservaQuandoInvalida`), com os `problemas` da última chamada
da reserva; a quarta chamada que estoura o prazo termina `IA_TEMPO_ESGOTADO` tipado, sem mudar `PRAZO_DA_EXECUCAO_MS`; e o contador
por destino vale também com principal e reserva do mesmo `provedorId`.

## Contexto necessário

- `techspec.md` §5 ("A chamada" (3) e (4), o contador), §7c ("Caminho quente")
- `prd.md` RF3
- `cenarios.md` §1 RF3: "O prazo, no molde de `prazo-com-tokens.int.test.ts`…", "No máximo quatro chamadas…", "Quatro e para…",
  "Duas inválidas na reserva de tarefa com `reservaQuandoInvalida`…"
- `docs/glossario.md`: "saída de reserva" (a 5.0 escreve), o outro sentido de "reserva"
- Código: `llm-gateway.ts` (`TENTATIVAS_MAXIMAS`, a repetição com `RepairHint`, `reservaQuandoInvalida`), `prazo-da-execucao.ts` e o
  comentário dele, `apps/api/src/ia/prazo-com-tokens.int.test.ts` (o relógio falso)

## Subtarefas

- [x] 6.1 e 6.2 — O contador por destino e a repetição na reserva: feitos na 4.0 (`4_task.md`, "Divergências resolvidas", 3.ª
  linha). Daqui fica só o teste de mesmo `provedorId` (6.5)
- [x] 6.3 — Duas inválidas na reserva: a `reservaQuandoInvalida` da tarefa com os `problemas` da última chamada da reserva
- [x] 6.4 — O prazo: a reserva usa o que sobra do prazo da execução; o comentário de `prazo-da-execucao.ts` e `docs/infra.md` (o
  prazo com quatro chamadas)
- [x] 6.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/core/src/ia/llm-gateway.ts`, `packages/core/src/ia/llm-gateway.test.ts` | alterado |
| `packages/core/src/ia/prazo-da-execucao.ts` | alterado (só o comentário) |
| `packages/core/src/ia/prazo-da-execucao.test.ts` | sem mudança (o caso da constante já existe) |
| `apps/api/src/ia/prazo-com-tokens.int.test.ts` | alterado |
| `docs/infra.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| o mesmo que `llm-gateway.test.ts` › "no máximo quatro chamadas…" com principal e reserva de mesmo `provedorId` e modelos diferentes: quatro linhas | U | contador por destino | a chave do contador não é o `provedorId` | llm-gateway.test.ts › no máximo quatro chamadas com principal e reserva do mesmo `provedorId` e modelos diferentes |
| duas inválidas na reserva de tarefa com `reservaQuandoInvalida`: a saída de reserva vale, com os `problemas` da última da reserva | U | a saída de reserva depois da queda | problemas diferentes no principal e na reserva | llm-gateway.test.ts › duas inválidas na reserva: o principal reprovado por outro motivo… a recusa fixa; › o principal reprovado pela D55… os `problemas` do principal não valem; › a última chamada da reserva é que decide; › JSON quebrado duas vezes segue sendo `IA_SAIDA_INVALIDA` |
| a quarta chamada estoura: `IA_TEMPO_ESGOTADO` tipado, execução `falhou`, `fimEm` no prazo do perfil (140.000 no `padrao`, 60.000 no `rapido`) | I | §7c | relógio falso, os dois perfis | prazo-com-tokens.int.test.ts › a quarta chamada, na reserva, estoura o prazo da execução: `padrao` e `rapido` |
| `PRAZO_DA_EXECUCAO_MS` segue abaixo do job menos a folga | U | o prazo não muda | o teste da constante de hoje | prazo-da-execucao.test.ts › todo perfil tem prazo, e ele é menor que o `prazoMs` do job `ia.executar` menos a folga…; › o Tutor (`rapido`) tem 60 s e a ferramenta (`padrao`), 140 s (já existentes, sem mudança) |

Já provados na 4.0, em `llm-gateway.test.ts` (não repetir): "saída inválida do principal não é queda…", "a saída inválida da reserva
repete na reserva…", "no máximo quatro chamadas…" e "a reserva que falha depois de sair…" (a linha estimada).

## Como testar

- O prazo: `prazo-com-tokens.int.test.ts` › "a 2.ª reserva: a 1.ª resposta inválida aos 135 s e sem vaga para a 2.ª termina aos 140 s com
  IA_TEMPO_ESGOTADO, e não aos 143 s" (o relógio falso e o `fimEm`); aqui com a reserva pendurada na quarta. A "reserva" do nome
  desse caso é a reserva de tokens, não o provedor
- A constante: `prazo-da-execucao.test.ts` › "todo perfil tem prazo, e ele é menor que o `prazoMs` do job `ia.executar` menos a folga…"
- Mesmo `provedorId`: copie `llm-gateway.test.ts` › "no máximo quatro chamadas…" (no `describe` da 4.0) e troque a reserva por
  `new ReservaRoteirizada(roteiro, {}, PRINCIPAL)` com `aprovada(…, 'reserva-padrao', PRINCIPAL)`: o modelo continua `reserva-<perfil>`,
  diferente do `roteirizado-padrao` do principal
- A saída de reserva: copie `numeros.test.ts` › "a conferência e a reserva" › "duas saídas julgadoras entregam a recusa…" (o `juizo`,
  a `recusa`, o log `ia.geracao.reserva`), levado ao `describe` da 4.0: principal `[juizo, new LLMError('IA_INDISPONIVEL')]`, reserva
  com duas saídas reprovadas por outro motivo que o do principal, e `aprovada('propor_ferramenta', 'reserva-rapido')` (o perfil dela é
  `rapido`). Só a reprovação **na conferência** chega à `reservaQuandoInvalida` (`reprovadaNaConferencia` em `chamarAteValer`)
- O prazo na int: o `montar` de `prazo-com-tokens.int.test.ts` não tem reserva; acrescente a dependência `reserva` ao `LLMGateway`
  dele, como o `daReserva` de `llm-gateway.test.ts`
- `npx vitest run --project unidade packages/core/src/ia/llm-gateway.test.ts`
- Armadilha: "reserva" é também a vaga de tokens (`ReservaDeTokens`) e a saída de reserva da tarefa; o contador já existe
  (`chamadas.principal`, `chamadas.reserva`) e não se renomeia

## Fora do escopo desta tarefa

O ramo sem vaga (7.0); a interrompida (8.0).

## Autoconferência

Respondidas no plano antes de codar.

1. **Mutação de cada cláusula:** o diff de produção desta tarefa é só o comentário de `prazo-da-execucao.ts`: nenhuma linha com condição, e o `--faltando` sai vazio. O contador por destino, a repetição na reserva e a saída de reserva já eram código da 4.0 (`CHAMADAS_MAXIMAS_POR_DESTINO`, `donoDoAlvo`, `problemasDaUltima`), e esta tarefa os prova com casos novos. Conferido à mão, em vez de bloco de mutação: tirar o sinal da execução da chamada à reserva (`pedido.sinal` trocado por um sinal que nunca aborta) deixa vermelhos os dois casos do prazo (`expected {} to match object { fimEm: … }`), e a restauração os devolve verdes.
2. **Texto na tela:** não toca tela nem texto de `apps/web`; não se aplica.
3. **O que distingue está no teste:** os `problemas` do principal e os da reserva são de motivos diferentes nos dois sentidos (D55 num e citação inválida no outro, e a ordem na própria reserva); o mesmo `provedorId` com modelos diferentes nas quatro linhas; os dois perfis no prazo (140.000 e 60.000), com a quarta chamada começando no instante certo (`reserva.chamadasDe[1].em`).
4. **Checagem anterior que responde antes:** a reserva dos casos é elegível de verdade (`reservaElegivel` com conferência e aprovação por tarefa, provedor e modelo); o prazo roda pelo `ResilientAdapter` real e pelo `prazoPorTemporizador` do `ExecucaoProcessor`.
5. **Asserção olha o resultado:** saída, erro tipado, linhas de consumo, chamadas por adaptador, o log `ia.geracao.reserva` (`tentativas: 4`) e o `fimEm` do relógio falso; nenhuma sobre texto de arquivo.
6. **Guarda nova:** nenhuma.
7. **Comentário que afirma o que o código não faz:** o de `prazo-da-execucao.ts` diz que a reserva leva o `pedido.sinal` e que as quatro chamadas dividem o prazo, e o caso do prazo prova as duas coisas; o de `docs/infra.md` repete.
8. **Divergência:** nenhuma (a 6.1 e a 6.2 que entraram na 4.0 já constam na 4.0).
9. **Peça que já existe:** `ReservaRoteirizada`, `aprovada`, `daReserva`, `montar` (llm-gateway.test.ts), `LentoAdapter`, `LimiteNoRelogio` e `acompanhar` (prazo-com-tokens.int.test.ts, estendidos com identidade, `queda` e a reserva, sem cópia).
10. **Concorrência:** o relógio falso é um só; nenhum caso tem execuções simultâneas.
11. **Isolamento entre escolas:** não cria repository, query nem endpoint; o log segue com o `escolaId` do pedido.
12. **Guardiões:** `llm-integrator` (a reserva só pela porta, a saída de reserva só depois de conferida), `infra-guardian` (o prazo, a regra 80 item 4), `conformidade-reviewer` (D55: a recusa fixa só quando a última reprovação é da D55, nenhuma nota), `privacy-guardian` (o log só com ids e contagem), `tenancy-guardian` (sem query nova).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

`--faltando: 0 linhas (0 blocos, 0 motivos)`

**Sem mutação:** o diff de `packages/*/src` desta tarefa é só o comentário de `packages/core/src/ia/prazo-da-execucao.ts`, sem linha de código nem condição nova; a regra que ela prova (o contador por destino, a saída de reserva com os `problemas` da reserva e o prazo único com a reserva pendurada na quarta) é a do código da 4.0, provada pelos casos novos de `llm-gateway.test.ts` e de `prazo-com-tokens.int.test.ts`. Duas mutações conferidas à mão e revertidas: tirar o sinal da execução da chamada à reserva deixa vermelhos os dois casos do prazo; e deixar `reprovadaNaConferencia` grudada em `true` (`reprovadaNaConferencia = reprovadaNaConferencia || …`, em `chamarAteValer`) deixa vermelho o caso do Tutor com a última da reserva em JSON quebrado (o do Assistente não a pega: a recusa da D55 confere os `problemas`, e o JSON quebrado já a barra).

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian, 1ª | `docs/infra.md`, parágrafo "O balde geral é de todas as escolas": citar a reserva quando a 7.0 pousar (hoje a reserva não reserva vaga no balde dela) | tarefa 7.0 (`7_task.md`, "Contexto": a chamada à reserva passa a reservar no balde `provedor:modelo` dela); o parágrafo é o que a 7.0 muda |
| infra-guardian, 1ª | A 7.0 abre o balde da reserva no caso de prazo (`prazo-com-tokens.int.test.ts`, "Só o balde do principal abre…") e acerta os textos de `docs/infra.md` e de `prazo-da-execucao.ts` sobre o balde | tarefa 7.0 (`7_task.md`, "Como testar": "acrescente o limitador da reserva" ao caso do prazo) |
| llm-integrator, 1ª | Um caso, na 7.0, que prove o prazo com o balde da reserva fechado | tarefa 7.0 (`7_task.md`, "Como testar", o mesmo ponto) |
| privacy-guardian, 1ª | Variante do caso do prazo com adaptador de reserva de envio externo, para a quarta linha cortada guardar o `provedorId` da reserva | recusada: o caso "a reserva que falha depois de sair…" da 4.0 (`llm-gateway.test.ts`) já prova a linha com o `provedorId` da reserva; o do prazo prova o corte, e o `LentoAdapter` sem envio externo é o que o harness dele oferece |
| test-engineer, 2ª (e revisor-geral, 2ª) | `prazo-com-tokens.int.test.ts:233-234`: trocar `toBeGreaterThan(tokensMinimosDeEntrada())` pelo valor exato de `tokensDoPedido` com a correção da resposta anterior | recusada: o harness do prazo não monta a correção da resposta inválida sem código novo de teste que o caso não pede; a D14 manda superestimar, e o que o teste precisa provar (a correção entrou na conta) o `toBeGreaterThan` do pedido sem correção já prova |
| conformidade-reviewer, 1ª | Comparar o problema da D55 com a constante (`PROBLEMA_DO_JULGAMENTO`) em vez do `toContain('julga texto de aluno')` | recusada: a constante não é exportada de `propor-ferramenta.ts` (exportar é mudança de produção, fora desta tarefa), e `numeros.test.ts` (linhas 650 e 671) já usa o mesmo trecho literal |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-22 18:08:52 | 2026-11-22 18:09:05 | `tenancy-guardian` | 1 | APROVADO | a40d724f9243026b0 |
| 2026-11-22 18:08:53 | 2026-11-22 18:09:30 | `privacy-guardian` | 1 | APROVADO | ad4ae0a153b3d3cd1 |
| 2026-11-22 18:08:57 | 2026-11-22 18:09:32 | `llm-integrator` | 1 | APROVADO | a1e4b6b42f6a34f66 |
| 2026-11-22 18:08:54 | 2026-11-22 18:09:33 | `conformidade-reviewer` | 1 | APROVADO | a421a1178857acc8d |
| 2026-11-22 18:08:55 | 2026-11-22 18:09:41 | `infra-guardian` | 1 | APROVADO | aae093d415facc5a7 |
| 2026-11-22 18:08:59 | 2026-11-22 18:09:50 | `revisor-geral` | 1 | APROVADO | aed72551fccba0b5c |
| 2026-11-22 18:08:58 | 2026-11-22 18:10:16 | `test-engineer` | 1 | APROVADO | a5b3b606fbc8b8a24 |
| 2026-11-22 18:26:57 | 2026-11-22 18:27:17 | `revisor-geral` | 2 | APROVADO | ab054b3c6572446eb |
| 2026-11-22 18:26:51 | 2026-11-22 18:27:38 | `test-engineer` | 2 | APROVADO | a2bdc78cc1319ece3 |
