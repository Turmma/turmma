# Tarefa 6.0 — A mudança de componente ou de séries limpa e reagenda a classificação

**Funcionalidade:** classificacao-bncc · **Depende de:** 5.0
**Subagentes obrigatórios:** `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian`
**Porte:** grande

## Objetivo

O `PATCH` do componente da disciplina (1.0) e o de séries do material (F4) só enfileiram o job de agendar; ele lê o
recorte atual, limpa as seções não corrigidas (sem execução, sem `origem: 'ia'`, `falhas_seguidas` zerada) e, com
componente e a função ativa, agenda de novo. O `preparar` sem candidatas limpa só a própria seção.

## Contexto necessário

- `techspec.md` §5 "Agendar" (b), "Suspensão", "Classificação" (candidatas no `preparar`); §7c
- `prd.md` RF5, RF19
- `cenarios.md` "Seções e agendamento" (recorte, componente apagado, suspensa, sem candidatas); P9, P10a, P10b, P11
- `.claude/rules/`: 10, 70, 80
- Código: `apps/api/src/material/material.service.ts` (`atualizar`, com a auditoria `material.atualizado`),
  `apps/api/src/estrutura/disciplina/disciplina.service.ts` (o `PATCH` da 1.0), `apps/api/src/material/agendar-classificacao.ts`
  e `classificar-secoes.command.ts` (5.0 e 4.0)

## Subtarefas

- [ ] 6.1 — Os dois `PATCH` enfileiram `material.agendar-classificacao` (do material, ou de cada material da disciplina), com a chave do registro de auditoria do `PATCH`, sem criar execução na transação da requisição
- [ ] 6.2 — O job decide pelo recorte atual, não pelo conteúdo do `PATCH`; limpa como a §5 "Agendar" (b); a corrigida fica; suspensa ou sem componente: limpa e não agenda
- [ ] 6.3 — O `preparar` sem candidatas conclui sem modelo e limpa as seções com `execucao_id = :esta` (P11)
- [ ] 6.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/material/agendar-classificacao.ts`, `apps/api/src/material/secoes.repository.ts`, `apps/api/src/material/classificar-secoes.command.ts` | alterado |
| `apps/api/src/material/material.service.ts`, `apps/api/src/estrutura/disciplina/disciplina.service.ts`, `apps/api/src/estrutura/estrutura.module.ts` | alterado |
| `apps/api/src/material/recorte.int.test.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| `PATCH` de séries do 6º para o 9º | I | execução nova com as candidatas do 9º | |
| `PATCH` do componente | I | execução nova | |
| mudança de recorte | I | a corrigida fica; zera `falhas_seguidas`. Mutação: sem zerar | |
| o `PATCH` só enfileira | I | nenhuma execução na transação. Mutação: o `PATCH` com a regra da rotina | |
| `PATCH` durante uma `rodando` | I | a antiga sem efeito, a seção com a nova | |
| `PATCH` de séries com a seção `aguardando` | I | a execução recebe as do 9º. Mutação: gravar as candidatas no agendar | |
| componente apagado | I | nenhuma execução nova. Mutação: o job com a regra do recorte | |
| componente apagado | I | as não corrigidas `nao_agendada`, sem `origem: 'ia'`; a corrigida fica | |
| dois `PATCH` seguidos | I | vale o recorte do segundo | |
| job do componente apagado entregue depois de ele voltar | I | agenda pelo atual. Mutação: decidir pelo conteúdo do `PATCH` | |
| suspensa: `PATCH` que apaga; que troca | I | limpa e não agenda. Mutação: sair antes da limpeza | |
| suspensa e retomada | I | a rotina agenda pelo componente novo | |
| `PATCH` de séries sem componente | I | limpa, sem execução | |
| `preparar` sem candidatas | I | sem modelo nem consumo; `nao_agendada`; `falhas_seguidas` de 2 a 0. Mutação: chamar com a lista vazia | |
| laço do job com mais de 500 | I | um lote por transação | |
| job da A | I | não limpa seção da B. Mutação: tirar `escola_id` | |
| P9, rotina × `PATCH` | P | uma execução | |
| P10a | P | a limpeza espera e apaga os recém-gravados. Mutação: apagar antes da trava | |
| P10b | P | o `concluir` não grava | |
| P11 | P | a execução nova não fica órfã. Mutação: tirar `execucao_id = :esta` da limpeza | |
| log do job | U | sem título, texto nem código | |

## Como testar

- `PATCH` de séries: `apps/api/test/material-patch.int.test.ts` › "título e séries: a resposta traz o material alterado…"; ordem forçada: "[P] dois PATCH do mesmo material, o primeiro preso depois de gravar as séries…"
- Travas: `esperarNaTrava` (`apps/api/test/write-block-trigger.ts`); no job parado num passo de `lock_timeout` curto, o outro lado vai por SQL (autoconferência 10, c)
- Execução e seções semeadas: os helpers que a 4.0 e a 5.0 deixaram em `apps/api/src/material/`
- `npx vitest run --project integracao apps/api/src/material/recorte.int.test.ts`

## Autoconferência

As 12 perguntas do modelo, no plano. Na 10: P10a e P10b são duas direções, dois casos.

## Fora do escopo desta tarefa

Reclassificar e D76 (7.0); a cobertura (13.0).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar

