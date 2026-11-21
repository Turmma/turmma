# Rascunho da lista — reserva-e-avaliacao (F5b)

As cinco tarefas que a F5 gerou para a reserva e a avaliação, como estavam no `tasks/prd-camada-ia/tasks.md` no corte de
21/11/2026, com a numeração de lá. **Não é o `tasks.md` desta spec** (por isso o nome): ele nasce no `criar-tasks` da F5b,
que parte daqui (`abertura.md`). Os documentos `9_task.md` a `13_task.md`, nesta pasta, são os da F5, sem mudança.

## Lista

- [ ] **9.0 — O provedor de reserva é configurado, aprovado por tarefa e modelo, e conferido na subida**
  - [ ] 9.1 As variáveis da reserva
  - [ ] 9.2 As recusas da subida
  - [ ] 9.3 `MODELOS_APROVADOS`, a guarda do sha256 e a reserva falsa
  - [ ] 9.4 A elegibilidade
  - [ ] 9.5 A conferência da reserva, que confere de novo a cada 5 s
  - [ ] 9.6 `ia.provedor_de_reserva.conferido` e o alerta
  - [ ] 9.7 Testes

- [ ] **10.0 — Com o principal caído ou sem vaga, a chamada vai ao provedor de reserva**
  - [ ] 10.1 O ramo da queda
  - [ ] 10.2 O ramo sem vaga, no balde da reserva
  - [ ] 10.3 Uma elegibilidade nos dois ramos; quatro chamadas no máximo
  - [ ] 10.4 A linha, a métrica e o log da reserva
    - [ ] 10.5 `IA_FALHA_FALSA`, recusado em produção
  - [ ] 10.6 Testes

- [ ] **11.0 — A execução interrompida registra também o provedor de reserva, e a carga prova a queda do principal**
  - [ ] 11.1 Os destinos da interrompida
  - [ ] 11.2 Os dois tetos ao preço de cada destino
  - [ ] 11.3 `registrarEstimada` com a lista, nos dois caminhos
    - [ ] 11.4 `docs/lgpd.md`, linha 99
  - [ ] 11.5 A fase `reserva` da carga
  - [ ] 11.6 Rodar a fase e o controle negativo, e registrar
  - [ ] 11.7 Testes

- [ ] **12.0 — A ferramenta de avaliação roda as amostras pelas tarefas reais e escreve o relatório do finalista**
  - [ ] 12.1 Os eliminatórios na fonte (`domain-researcher`)
  - [ ] 12.2 As amostras, por subagente em contexto limpo
  - [ ] 12.3 A ferramenta e o que a máquina mede
  - [ ] 12.4 O julgamento e a lista para o Joaquim
  - [ ] 12.5 O relatório
  - [ ] 12.6 A guarda da D55 e a chave fora do repositório
  - [ ] 12.7 Testes

- [ ] **13.0 — Principal e reserva saem da avaliação executada, com preço e aprovação no código**
  - [ ] 13.1 Rodar por finalista, com as chaves do Joaquim
  - [ ] 13.2 Julgar e confirmar
  - [ ] 13.3 Preços e aprovações reais
  - [ ] 13.4 A D37 revista e o contratado de tokens por minuto
  - [ ] 13.5 As AIAs
  - [ ] 13.6 Sem finalista no Brasil para o Tutor: parar
  - [ ] 13.7 Testes

## Dependências e paralelismo

| Tarefa | Depende de | Pode correr em paralelo com |
|---|---|---|
| 9.0 | 2.0 (F5a) | 3.0, 5.0, 6.0, 7.0, 8.0, 12.0 |
| 10.0 | 9.0 | 7.0, 8.0, 12.0 |
| 11.0 | 10.0 | 7.0, 8.0, 12.0 |
| 12.0 | — | 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0 |
| 13.0 | 11.0, 12.0, as chaves do Joaquim | — |

Na F5, a 9.0 e a 12.0 podiam correr ao lado da 1.0 a 8.0; com o corte, as tarefas da F5a saem da coluna e a 9.0 depende só
do que a F5a já pousou.

## Subagentes por tarefa

| Tarefa | Subagentes obrigatórios |
|---|---|
| 9.0 | `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator` |
| 10.0 | `privacy-guardian`, `infra-guardian`, `llm-integrator` |
| 11.0 | `privacy-guardian`, `infra-guardian` |
| 12.0 | `privacy-guardian`, `conformidade-reviewer`, `llm-integrator`, `pedagogia-reviewer` |
| 13.0 | `privacy-guardian`, `conformidade-reviewer`, `llm-integrator`, `pedagogia-reviewer` |

## Critério de pronto (o da F5, na parte da F5b)

- **Provedor de reserva (RF1 a RF5).** Ele atende só a tarefa e o modelo aprovados, e só no Brasil. Ele aparece na lista
  de compartilhamento do aluno, inclusive na execução interrompida.
- **Carga.** A fase `reserva` da carga foi rodada, com o registro em `docs/runbook.md`.
- **Avaliação (RF13 a RF16).** A avaliação foi executada:
  - principal e reserva estão na D37 revista;
  - os preços e as aprovações estão no código;
  - as AIAs foram revistas.
