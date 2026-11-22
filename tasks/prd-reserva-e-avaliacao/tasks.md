# Tarefas — reserva-e-avaliacao (F5b)

**PRD:** `prd.md` · **Tech Spec:** `techspec.md` · **Cenários:** `cenarios.md` · **Anexo do RF13:** `avaliacao.md`
<!-- Quantas estão concluídas não se escreve aqui: `node tools/processo/estado.ts` conta pela lista. -->

Nasce do `rascunho-das-tarefas/` (a 9.0 à 13.0 da F5), refeito contra a spec aprovada na rodada 8 da revisão (`revisao-spec.md`).
A revisão acrescentou a causa da falha no `ResilientAdapter`, a identidade dos adaptadores, o destino por chamada, a bancada com
dois adaptadores, o `TokenLimiter` da reserva e as regras de `avaliacao.md`. Com isso, cada uma das cinco do rascunho teria de 15 a
25 cenários, e elas viraram quatorze: a 9.0 do rascunho virou a 1.0 e a 2.0; a 10.0, da 3.0 à 7.0; a 11.0, a 8.0 e a 9.0; a 12.0,
da 10.0 à 13.0; a 13.0, a 14.0.

**Corte possível (aviso, acima de 12 tarefas):** a reserva (1.0 a 9.0) pousa sozinha: em produção ela não atende nada enquanto
`MODELOS_APROVADOS` não tiver entrada real, que só a 14.0 grava. A avaliação (10.0 a 14.0) pousaria depois, como outra spec. A
recomendação é **não cortar**: as duas metades correm em paralelo (a 10.0 já parte com a 1.0), e a F5b só fecha com a avaliação
(D37, `abertura.md`).

## Lista

- [x] **1.0 — A reserva sobe configurada: identidade, aprovação por tarefa e modelo, e as recusas da subida**
  - [x] 1.1 As variáveis da reserva e `IA_RESERVA_ADAPTADOR`
  - [x] 1.2 A `identidade` de todo adaptador
  - [x] 1.3 `MODELOS_APROVADOS`, a guarda do sha256 e a entrada de `falso-reserva`
  - [x] 1.4 `reservaElegivel` e as categorias das tarefas aprovadas
  - [x] 1.5 As recusas da subida e o preço da reserva
  - [x] 1.6 Testes

- [x] **2.0 — O `main-worker` confere a reserva sem segurar o principal, com limitador próprio e alerta**
  - [x] 2.1 A `SoberaniaNaSubida` da reserva, que confere de novo a cada 5 s
  - [x] 2.2 O `TokenLimiter` da reserva
  - [x] 2.3 `ia.provedor_de_reserva.conferido`, o alerta e o runbook
  - [x] 2.4 Testes

- [x] **3.0 — A causa da falha atravessa o `ResilientAdapter`: o 429 que sobra é falta de vaga, o 4xx não é queda**
  - [x] 3.1 Os motivos `limite` e `rejeitada`
  - [x] 3.2 O `limite` pelo degrau do menor; a `rejeitada` termina
  - [x] 3.3 A estimativa na linha do 429 e da conexão recusada
  - [x] 3.4 Testes

- [x] **4.0 — Com o principal caído, a chamada vai à reserva elegível, e cada chamada leva o seu destino**
  - [x] 4.1 O destino por chamada
  - [x] 4.2 O ramo da queda
  - [x] 4.3 O degrau, o log e os disjuntores por provedor
  - [x] 4.4 `IA_FALHA_FALSA`
  - [x] 4.5 Testes

- [x] **5.0 — A chamada da reserva chega ao banco e ao compartilhamento do aluno, e o worker só a chama conferida**
  - [ ] 5.1 O `ConsumoRepository` grava a coluna
  - [ ] 5.2 A bancada com principal e reserva
  - [ ] 5.3 `docs/lgpd.md` linha 99, os comentários, o glossário e `docs/mvp-contratos.md`
  - [ ] 5.4 Testes

- [x] **6.0 — A repetição com a reserva: no máximo quatro chamadas, dentro do prazo da execução**
  - [x] 6.1 O contador por destino (na 4.0; aqui só o teste de mesmo `provedorId`)
  - [x] 6.2 A inválida repete no provedor que respondeu; a queda na repetição vai à reserva (na 4.0)
  - [x] 6.3 A saída de reserva da tarefa depois de duas inválidas na reserva
  - [x] 6.4 O prazo com quatro chamadas
  - [x] 6.5 Testes

- [ ] **7.0 — Sem vaga no principal, a chamada vai ao menor e depois à reserva, no balde dela**
  - [ ] 7.1 O ramo sem vaga
  - [ ] 7.2 O uso do teto por `provedor:modelo`
  - [ ] 7.3 O alerta dos tokens; `docs/infra.md` 5.4
  - [ ] 7.4 Testes

- [ ] **8.0 — A execução interrompida grava a estimada de cada destino, com custo**
  - [ ] 8.1 `destinosDaInterrompida`
  - [ ] 8.2 Os dois tetos ao preço de cada destino
  - [ ] 8.3 `registrarEstimada(execucao, destinos, precos)` na varredura e na reentrega
  - [ ] 8.4 Testes

- [ ] **9.0 — A fase `reserva` da carga prova a queda do principal**
  - [ ] 9.1 A fase e o cenário k6
  - [ ] 9.2 O veredito e o controle negativo
  - [ ] 9.3 Rodar e registrar
  - [ ] 9.4 Testes

- [x] **10.0 — As amostras da avaliação e as guardas que valem antes do gasto**
  - [x] 10.1 Os eliminatórios na fonte (`domain-researcher`)
  - [x] 10.2 As amostras e os critérios, por subagente em contexto limpo
  - [x] 10.3 O leitor e os testes de cobertura
  - [x] 10.4 A guarda da D55 e a dos ids retidos
  - [x] 10.5 Testes

- [x] **11.0 — A ferramenta de avaliação roda as amostras, julga cada resposta crua e escreve o relatório**
  - [x] 11.1 A ferramenta e a guarda do ponto de entrada
  - [x] 11.2 As execuções, as três contagens e as eliminatórias
  - [x] 11.3 O julgamento cego, `resultado.json` e `relatorio.md`
  - [x] 11.4 Testes

- [ ] **12.0 — As medidas da avaliação: limiar em contagem, equidade por pares, números fiéis e a D36 das amostras**
  - [ ] 12.1 Limiar em contagem e gabarito
  - [ ] 12.2 A equidade
  - [ ] 12.3 Os números fiéis
  - [ ] 12.4 A D36
  - [ ] 12.5 Testes

- [ ] **13.0 — Os lotes retidos e a classificação medidos por `medida-do-ouro.ts`, e a guarda que liga aprovação, relatório e AIA**
  - [ ] 13.1 `medida-do-ouro.ts`
  - [ ] 13.2 Os lotes retidos
  - [ ] 13.3 A classificação no `rapido` e no `padrao`
  - [ ] 13.4 A guarda do RF16
  - [ ] 13.5 Testes

- [ ] **14.0 — Principal e reserva saem da avaliação executada, com preço e aprovação no código**
  - [ ] 14.1 Rodar por finalista, com as chaves do Joaquim (os lotes retidos, pelo Arquiteto)
  - [ ] 14.2 Julgar e confirmar
  - [ ] 14.3 Preços e aprovações reais
  - [ ] 14.4 A D37 revista e o contratado de tokens por minuto
  - [ ] 14.5 As AIAs
  - [ ] 14.6 Sem finalista no Brasil para o Tutor: parar
  - [ ] 14.7 Testes

## Dependências e paralelismo

| Tarefa | Depende de | Pode correr em paralelo com |
|---|---|---|
| 1.0 | — | 10.0 |
| 2.0 | 1.0 | 3.0, 4.0, 10.0, 11.0, 12.0, 13.0 |
| 3.0 | 1.0 | 2.0, 10.0, 11.0, 12.0, 13.0 |
| 4.0 | 3.0 | 2.0, 10.0, 11.0, 12.0, 13.0 |
| 5.0 | 2.0, 4.0 | 6.0, 10.0, 11.0, 12.0, 13.0 |
| 6.0 | 4.0 | 5.0, 8.0, 10.0, 11.0, 12.0, 13.0 |
| 7.0 | 6.0 | 5.0, 8.0, 10.0, 11.0, 12.0, 13.0 |
| 8.0 | 5.0 | 6.0, 7.0, 9.0, 10.0, 11.0, 12.0, 13.0 |
| 9.0 | 7.0 | 8.0, 10.0, 11.0, 12.0, 13.0 |
| 10.0 | — | 1.0 a 9.0 |
| 11.0 | 1.0, 10.0 | 2.0 a 9.0 |
| 12.0 | 11.0 | 2.0 a 9.0 |
| 13.0 | 12.0 | 2.0 a 9.0 |
| 14.0 | 8.0, 9.0, 13.0, as chaves do Joaquim | — |

Em fila pelo mesmo arquivo: `llm-gateway.ts` (1.0, 3.0, 4.0, 6.0, 7.0); `consumo.ts` e `consumo.repository.ts` (4.0, 5.0, 8.0);
`fila-de-ia.fixture.ts` (2.0, 5.0); `tools/ia/avaliar-modelos.ts` (11.0 a 13.0). A 13.0 altera `modelos-aprovados.ts`, que só a
1.0 cria. O `linhas.ts` confere pelos "Arquivos previstos".

## Subagentes por tarefa

Toda tarefa que altera `apps/`, `packages/` ou `tools/guardas/` pede os quatro guardiões pelo caminho
(`tools/processo/guardioes-por-caminho.ts`), e eles estão marcados mesmo onde a natureza pediria menos (retro da F5a, grupo B).

| Tarefa | Subagentes obrigatórios |
|---|---|
| 1.0 a 7.0 | `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator` |
| 8.0 | `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian` |
| 9.0 | `privacy-guardian`, `infra-guardian`, `llm-integrator` |
| 10.0 | `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `pedagogia-reviewer` |
| 11.0 | `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`, `pedagogia-reviewer` |
| 12.0 | `privacy-guardian`, `conformidade-reviewer`, `llm-integrator`, `pedagogia-reviewer` |
| 13.0 | `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator` |
| 14.0 | `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`, `pedagogia-reviewer` |

## Critério de pronto da funcionalidade

Do `ROADMAP.md` (F5b) e do rascunho:

- **Provedor de reserva (RF1 a RF5).** Atende só a tarefa e o modelo aprovados, e só no Brasil; quando não confere, fica fora do
  caminho sem derrubar o principal. Aparece na lista de compartilhamento do aluno, também na execução interrompida. Queda e falta
  de vaga terminam tipadas, nunca em erro cru.
- **Custo (RF6).** Modelo da reserva sem preço não sobe fora do `local`; a interrompida grava uma linha por destino, com custo.
- **Carga.** A fase `reserva` rodada, com o registro em `docs/runbook.md` ("Quando a carga vale como registro").
- **Avaliação (RF13 a RF16).** Executada por finalista, com o relatório, o `resultado.json` e as três contagens; principal e
  reserva na D37 revista; preços e aprovações no código, conferidos pela guarda do RF16; as AIAs revistas.
- **Pendências do `TODO.md` que são desta spec:** a linha 99 de `docs/lgpd.md` com `pelo_provedor_de_reserva` e o teste de que
  `provedor` guarda o id da reserva (5.0); o 429 e a conexão recusada com a estimativa pelo `ResilientAdapter` (3.0);
  `docs/mvp-contratos.md:213` (5.0). A tarefa que fecha uma pendência a marca como feita no próprio commit.
