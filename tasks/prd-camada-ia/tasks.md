# Tarefas — camada-ia (F5a)

**PRD:** `prd.md` · **Tech Spec:** `techspec.md` · **Cenários:** `cenarios.md`
<!-- Quantas estão concluídas não se escreve aqui: `node tools/processo/estado.ts` conta pela lista. -->

Lista mostrada no terminal do Arquiteto em 20/11/2026, às 23:00, e revista às 23:22. Na revisão, Governança e Painel
viraram uma tarefa só, porque as duas telas leem o mesmo contrato, e a carga da reserva passou da 10.0 para a 11.0, pelo
teto de palavras. Eram 13, uma acima do teto de 12.

**Corte de 21/11/2026 (Joaquim):** esta spec é a F5a, da 1.0 à 8.0, custo e orçamento, e pousa sozinha. A 9.0 à 13.0,
reserva e avaliação, foram para a F5b (`tasks/prd-reserva-e-avaliacao/`, com a lista e os documentos delas em
`rascunho-das-tarefas/`), que espera as chaves de teste dos finalistas (PRD §10 de lá).

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

- [ ] **6.0 — A coordenação vê "IA do mês: N% do previsto" no Painel e na Governança, sem reais nem tokens**
  - [ ] 6.1 Contrato estrito de `governanca/consumo`
  - [ ] 6.2 O serviço pelo `OrcamentoDoMesRepository`
  - [ ] 6.3 A auditoria de orçamento fora da leitura da coordenação
  - [ ] 6.4 Governança: a `parte` por função
  - [ ] 6.5 Painel: a linha "IA do mês" e o aviso
  - [ ] 6.6 `docs/interface.md` e o roteiro da demonstração
  - [ ] 6.7 Testes

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

## Dependências e paralelismo

| Tarefa | Depende de | Pode correr em paralelo com |
|---|---|---|
| 1.0 | — | — |
| 2.0 | 1.0 | — |
| 3.0 | 2.0 | 4.0 |
| 4.0 | 2.0 | 3.0, 5.0, 6.0, 7.0 |
| 5.0 | 3.0 | 4.0, 7.0 |
| 6.0 | 2.0 | 4.0 |
| 7.0 | 3.0 | 4.0, 5.0 |
| 8.0 | 5.0, 7.0 | — |

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

## Critério de pronto da funcionalidade

Do `ROADMAP.md` (F5a), detalhado:

- **Custo por chamada (RF5, RF6).** Toda chamada tem o seu custo em reais, pelo preço vigente, numa linha só dela, com o
  provedor e o modelo que atenderam. O modelo do principal sem preço não sobe fora do ambiente local.
- **Orçamento na Operação (RF7, RF8, RF11).** A Operação define o valor e o teto por rede e por escola, e vê o uso de cada
  escola no dia, no mês e nos 12 meses anteriores.
- **Porcentagem na coordenação (RF9, RF12).** A coordenação vê "IA do mês: N% do previsto" e o aviso, sem reais nem tokens.
- **Teto de segurança e alertas (RF10).** Acima do teto, só o lote espera. Os alertas de 80%, 100% e teto têm runbook.
- **Roteiro da demonstração.** Ele foi conferido contra `e2e/roteiro-da-demonstracao.spec.ts`, na 6.0.

Fora daqui, na F5b: o provedor de reserva (RF1 a RF4, e a parte da reserva do RF5 e do RF6), a fase `reserva` da carga e a
avaliação dos modelos (RF13 a RF16).
