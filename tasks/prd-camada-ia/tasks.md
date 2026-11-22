# Tarefas — camada-ia (F5)

**PRD:** `prd.md` · **Tech Spec:** `techspec.md` · **Cenários:** `cenarios.md`
<!-- Quantas estão concluídas não se escreve aqui: `node tools/processo/estado.ts` conta pela lista. -->

Lista mostrada no terminal do Arquiteto em 20/11/2026, às 23:00, e revista às 23:22. Na revisão, Governança e Painel
viraram uma tarefa só, porque as duas telas leem o mesmo contrato, e a carga da reserva passou da 10.0 para a 11.0, pelo
teto de palavras. São 13, uma acima do teto de 12. O corte possível é em duas specs, que pousam separadas: F5a, da 1.0 à
8.0, custo e orçamento; e F5b, da 9.0 à 13.0, reserva e avaliação. A 13.0 espera as chaves de teste do Joaquim (PRD §10).

## Lista

- [x] **1.0 — Toda chamada ao modelo grava o seu custo, pelo preço vigente, numa linha só dela**
  - [x] 1.1 `PRECO_DOS_MODELOS` por `provedor:modelo`, com `vigenteDesde` e `fonte`; `custoDaChamada`, para cima
  - [x] 1.2 O gateway grava uma linha por chamada enviada; a que caiu depois do envio grava a estimativa
  - [x] 1.3 A subida exige preço de todo modelo com envio externo
  - [x] 1.4 A Governança conta execuções com `count(distinct execucao_id)`
  - [x] 1.5 `docs/runbook.md`, "Voltar o código depois da camada-ia 1.0"
  - [x] 1.6 Testes

- [x] **2.0 — O orçamento de IA existe no banco e na conta: colunas, retrato do mês e a leitura por escola**
  - [x] 2.1 Migration de expansão: colunas da escola e da rede, `orcamento_ia_do_mes`, `pelo_provedor_de_reserva`
  - [x] 2.2 Migration própria do índice do consumo do mês
  - [x] 2.3 A conta pura em `packages/shared`
  - [x] 2.4 `OrcamentoDoMesRepository` em `packages/core`
  - [x] 2.5 Glossário, modelo de dados, LGPD e a classificação de privacidade
  - [x] 2.6 `IA_ORCAMENTO_ESGOTADO` em `packages/shared/src/errors/`
  - [x] 2.7 Runbook da volta
  - [x] 2.8 Testes

- [x] **3.0 — A Operação define o orçamento de IA da escola e da rede, com auditoria**
  - [x] 3.1 Os dois `PUT`, no contexto da escola e pelo `OrcamentoDaRedeRepository`
  - [x] 3.2 A transação com `for update` e a auditoria só quando muda
  - [x] 3.3 As duas ações de auditoria, fora da leitura da coordenação
  - [x] 3.4 `GET /redes` e `/escolas` com o orçamento próprio e o vigente
  - [x] 3.5 As rotas em `ROTAS_DO_PAINEL`
  - [x] 3.6 Testes

- [x] **4.0 — Acima do teto de segurança só o lote espera, e a Operação é avisada a 80%, 100% e no teto**
  - [x] 4.1 `OrcamentoQuery` com `fila`; `IA_ORCAMENTO_ESGOTADO` no lote
  - [x] 4.2 O adiamento com motivo `orcamento`, sem tentativa
  - [x] 4.3 A medida do worker e o retrato
  - [x] 4.4 Os alertas de 80%, 100% e do teto, com runbook
  - [x] 4.5 Runbook da volta
  - [x] 4.6 Nada em `packages/shared`
  - [x] 4.7 Testes

- [x] **5.0 — A Operação lê o uso de IA de cada escola, no dia, no mês e nos 12 meses anteriores**
  - [x] 5.1 A ordem `custo` só no uso
  - [x] 5.2 `uso()` com os trechos do `OrcamentoDoMesRepository`
  - [x] 5.3 `GET …/escolas/:id/uso-ia` pelo retrato
  - [x] 5.4 Contrato estrito e `ROTAS_DO_PAINEL`
  - [x] 5.5 Testes

- [x] **6.0 — A coordenação vê "IA do mês: N% do previsto" no Painel e na Governança, sem reais nem tokens**
  - [x] 6.1 Contrato estrito de `governanca/consumo`
  - [x] 6.2 O serviço pelo `OrcamentoDoMesRepository`
  - [x] 6.3 A auditoria de orçamento fora da leitura da coordenação
  - [x] 6.4 Governança: a `parte` por função
  - [x] 6.5 Painel: a linha "IA do mês" e o aviso
  - [x] 6.6 `docs/interface.md` e o roteiro da demonstração
  - [x] 6.7 Testes

- [x] **7.0 — A Operação define o orçamento de IA num diálogo, vendo o antes e o depois**
  - [x] 7.1 O diálogo "Orçamento de IA"
  - [x] 7.2 A ação na rede e na escola
  - [x] 7.3 Os erros anunciados e o 429
  - [x] 7.4 `docs/interface.md` §5a (Escolas)
  - [x] 7.5 Testes

- [ ] **8.0 — A aba Uso da Operação mostra o uso de IA por escola e os 12 meses**
  - [ ] 8.1 O grupo "IA" na tabela e no cartão
  - [ ] 8.2 A ordem por custo, "Definir orçamento" e "sem aluno ativo"
  - [ ] 8.3 "Ver meses"
  - [ ] 8.4 `docs/interface.md` §5a (Uso)
  - [ ] 8.5 Testes

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
| 1.0 | — | 12.0 |
| 2.0 | 1.0 | 12.0 |
| 3.0 | 2.0 | 4.0, 9.0, 12.0 |
| 4.0 | 2.0 | 3.0, 5.0, 6.0, 7.0, 12.0 |
| 5.0 | 3.0 | 4.0, 7.0, 9.0, 12.0 |
| 6.0 | 2.0 | 4.0, 9.0, 12.0 |
| 7.0 | 3.0 | 4.0, 5.0, 9.0, 10.0, 11.0, 12.0 |
| 8.0 | 5.0, 7.0 | 9.0, 10.0, 11.0, 12.0 |
| 9.0 | 2.0 | 3.0, 5.0, 6.0, 7.0, 8.0, 12.0 |
| 10.0 | 9.0 | 7.0, 8.0, 12.0 |
| 11.0 | 10.0 | 7.0, 8.0, 12.0 |
| 12.0 | — | 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0 |
| 13.0 | 11.0, 12.0, as chaves do Joaquim | — |

## Subagentes por tarefa

| Tarefa | Subagentes obrigatórios |
|---|---|
| 1.0 | `privacy-guardian`, `infra-guardian`, `llm-integrator` |
| 2.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian` |
| 3.0 | `tenancy-guardian`, `privacy-guardian` |
| 4.0 | `tenancy-guardian`, `infra-guardian`, `llm-integrator` |
| 5.0 | `tenancy-guardian`, `privacy-guardian` |
| 6.0 | `tenancy-guardian`, `conformidade-reviewer`, `frontend-reviewer` |
| 7.0 | `frontend-reviewer` |
| 8.0 | `frontend-reviewer` |
| 9.0 | `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator` |
| 10.0 | `privacy-guardian`, `infra-guardian`, `llm-integrator` |
| 11.0 | `privacy-guardian`, `infra-guardian` |
| 12.0 | `privacy-guardian`, `conformidade-reviewer`, `llm-integrator`, `pedagogia-reviewer` |
| 13.0 | `privacy-guardian`, `conformidade-reviewer`, `llm-integrator`, `pedagogia-reviewer` |

## Critério de pronto da funcionalidade

Do `ROADMAP.md` (F5), detalhado:

- **Custo por chamada (RF5, RF6).** Toda chamada tem o seu custo em reais, pelo preço vigente, numa linha só dela, com o
  provedor que atendeu.
- **Provedor de reserva (RF1 a RF5).** Ele atende só a tarefa e o modelo aprovados, e só no Brasil. Ele aparece na lista
  de compartilhamento do aluno, inclusive na execução interrompida.
- **Orçamento na Operação (RF7, RF11).** A Operação define o valor e o teto por rede e por escola, e vê o uso de cada
  escola no dia, no mês e nos 12 meses anteriores.
- **Porcentagem na coordenação (RF9, RF12).** A coordenação vê "IA do mês: N% do previsto" e o aviso, sem reais nem tokens.
- **Teto de segurança e alertas (RF10).** Acima do teto, só o lote espera. Os alertas de 80%, 100%, teto e reserva têm runbook.
- **Carga.** A fase `reserva` da carga foi rodada, com o registro em `docs/runbook.md`.
- **Avaliação (RF13 a RF16).** A avaliação foi executada:
  - principal e reserva estão na D37 revista;
  - os preços e as aprovações estão no código;
  - as AIAs foram revistas.
- **Roteiro da demonstração.** Ele foi conferido contra `e2e/roteiro-da-demonstracao.spec.ts`, na 6.0.
