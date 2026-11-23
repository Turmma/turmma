# Tarefa 8.0 — Saída da aba registrada sem contar duas vezes, e mostrada só no lote

**Funcionalidade:** avaliacao-e-correcao · **Depende de:** 4.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `frontend-reviewer`
**Porte:** grande

## Objetivo

Cada saída da aba numa prova em andamento conta uma vez na tentativa, e o professor a vê só no lote, na coluna "Saiu da
aba", sempre com o aviso fixo; não é destaque, não trava a aprovação, não soma entre provas.

## Contexto necessário

- `techspec.md` §3 (`saida_da_aba`), §4 (`saidas-da-aba`, `correcao`), §5.8, §7, §7b
- `prd.md` RF9; §7 (leitor de tela)
- `cenarios.md` §1 RF9 (todas), §3 (i), §4 (Aprovar, com o aviso aprovado pelo Joaquim)
- D70 e D88 (`docs/decisoes.md`); `docs/interface.md` §1.4 e §1.6
- `apps/api/src/atividade/correcao/` e `apps/web/src/areas/professor/atividades/Aprovar.tsx`

## Subtarefas

- [ ] 8.1 — `POST …/saidas-da-aba`: alcance, prova avaliativa em andamento; `insert … on conflict do nothing` na
  `saida_da_aba` e soma em `saidas_da_aba` só quando a chave é nova; a saída não trava a tentativa antes do `insert`;
  chave só v4 (a rota usa o schema da 1.0); balde de 30/min; a guarda de pulso
- [ ] 8.2 — `GET …/correcao` com `saidasDaAba` por aluno só em avaliativa; a validação marca que a coluna foi mostrada,
  sem a contagem no `apresentado`
- [ ] 8.3 — Aprovar: a coluna e o aviso fixo (texto de `cenarios.md` §4), também no cartão a 360 px
- [ ] 8.4 — `docs/interface.md` §1.6 (a saída não é destaque; a coluna no lote) e §1.4
- [ ] 8.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/src/atividade/minha-atividade/minha-atividade.controller.ts` | alterado |
| `apps/api/src/atividade/minha-atividade/saida-da-aba.repository.ts` | novo |
| `apps/api/src/atividade/correcao/correcao.service.ts` | alterado |
| `apps/api/src/atividade/correcao/correcao.repository.ts` | alterado |
| `apps/api/src/atividade/saida-da-aba.int.test.ts` | novo |
| `apps/web/src/areas/professor/atividades/Aprovar.tsx` | alterado |
| `apps/web/src/areas/professor/atividades/Aprovar.test.tsx` | alterado |
| `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | O que distingue | Caso |
|---|---|---|---|---|
| Saída nova; a mesma chave; A, B e A | integração | 1; 1; 2 | a chave antiga volta | |
| Não avaliativa; enviada; vencida | integração | `NAO_ENCONTRADO`, nada muda | três estados | |
| Chave v7 na rota | integração | `ENTRADA_INVALIDA` | a v4 passa | |
| Prova 2 começa em 0 | integração | nada somado por aluno | saídas na prova 1 | |
| 0 e 9 saídas | integração | mesma correção e destaques; o lote aprova sem abrir ninguém; o PUT grava | a tentativa sem outro destaque | |
| Saída depois do limite original, com indisponibilidade fechada de 5 min; com lacuna aberta de 3 min; pulso parado 31 s | integração | soma; soma; 503 | sem indisponibilidade, `NAO_ENCONTRADO`; a 29 s aceita | |
| `saidasDaAba` no lote | integração | na avaliativa; ausente na não avaliativa | | |
| A validação | integração | marca a coluna mostrada; sem contagem no `apresentado` | a não avaliativa não marca | |
| Contrato | unidade | nenhuma rota do aluno, da coordenação nem da rede traz `saidas` | a `correcao` do professor traz | |
| Corrida (i) | integração | 2 com chaves diferentes; 1 com a mesma | `WriteBlockTrigger` no `insert` | |
| 31ª saída no minuto | integração | 429; outro aluno no mesmo IP passa | a 30ª passa | |
| Aluno de A na B; transferido; repository da `saida_da_aba` no contexto da A, e de outro ano, com ids da B | integração | `NAO_ENCONTRADO` e a contagem da B segue 0; vazio | a tentativa da B em andamento | |
| Coluna no Aprovar | unidade web | só em avaliativa; o aviso da §4 pela frase inteira (`getByText` exato), acima da tabela; a contagem também no cartão | coluna sem o aviso fica vermelha | |
| Estados do Aprovar | unidade web | carregando, erro, com dado, como hoje | | |

## Como testar

- Lote: `apps/api/src/atividade/correcao/correcao.int.test.ts`; aprovar com `aprovarOLote` (`apps/api/test/atividade.fixture.ts`)
- Tela: `apps/web/src/areas/professor/atividades/Aprovar.test.tsx › carregando, com o título e o caminho de volta…`
- Corrida: `WriteBlockTrigger` (`apps/api/test/write-block-trigger.ts`)
- `npx vitest run --project integracao apps/api/src/atividade/saida-da-aba.int.test.ts`
- **Telas:** professora · `/professor/aprovar/:atividadeAplicadaId` · o lote de uma prova avaliativa com saídas

## Autoconferência

As perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`). A 2: procure "Saiu da aba" em `e2e/`.

## Fora do escopo desta tarefa

O envio pela tela de foco (12.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
