# Tarefa 10.0 — A geração usa a BNCC da seção citada, e o catálogo próprio sai

**Funcionalidade:** classificacao-bncc · **Depende de:** 8.0, 9.0 e a medida do Arquiteto no lote retido
**Subagentes obrigatórios:** `tenancy-guardian`, `conformidade-reviewer`, `infra-guardian`, `llm-integrator`, `pedagogia-reviewer`
**Porte:** grande

## Objetivo

A busca da ferramenta e do chat devolve, com cada trecho, as habilidades da seção da página (pelo recorte atual da turma);
a questão leva uma delas, ou nenhuma, e a de fora é anulada na gravação; o Tutor não recebe as habilidades da seção; o
catálogo `QUI.EM.*` sai do código e do seed; e o diagnóstico conta a questão sem habilidade com `codigo: null`.

## Contexto necessário

- `techspec.md` §5 "Geração" e "Suspensão", §7c, §7b
- `prd.md` RF2, RF7
- `cenarios.md` "Geração e Tutor", "Permissão e isolamento" (busca), "Carga" (`EXPLAIN`)
- A medida do lote retido já está registrada: o Orquestrador confere antes de pedir a tarefa. Não abra `docs/aia/ouro-retido/`
- `.claude/rules/`: 10, 30, 70, 80
- Código: os arquivos da tabela abaixo; `habilidadesParaOTema` (`conferencia.ts`), `habilidadeMaisProxima`
  (`gerar-atividade-objetiva.ts`), `habilidadeSchema` (`conteudo.ts`)

## Subtarefas

- [ ] 10.1 — A busca junta `habilidade_da_secao` pela seção da página (`escola_id` no join), filtrada pelo recorte atual da turma; com a função suspensa, só `origem: 'coordenacao'`
- [ ] 10.2 — Atividade, plano, adaptação e chat: a questão escolhe uma das da página citada, ou `null`; o plano, a união das seções citadas; fora da seção, anulada na gravação, com `ia.habilidade_anulada`
- [ ] 10.3 — O Tutor segue com `materialId`, `pagina` e `texto`; saem `habilidades.ts`, `habilidadesParaOTema` e o seed `QUI.EM.*`; `por_habilidade` com `codigo: null`; a leitura aceita `null` e código antigo (conferir a produção, D82)
- [ ] 10.4 — O passo 1 do `docs/roteiro-da-demonstracao.md` ganha a correção do capítulo 7 no painel (8.0); o `e2e/roteiro-da-demonstracao.spec.ts` acompanha
- [ ] 10.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/api/test/geracao-pela-secao.int.test.ts` | novo |
| `packages/shared/src/assistente/habilidades.ts` | sai |
| `apps/api/src/material/trecho-search.ts`, `apps/api/src/artefato/conferencia.ts`, `apps/api/src/artefato/ferramentas.command.ts`, `apps/api/src/artefato/adaptacao.command.ts`, `apps/api/src/assistente/proposta.command.ts`, `packages/core/src/ia/tasks/gerar-atividade-objetiva.ts`, `packages/core/src/ia/tasks/gerar-plano-de-aula.ts`, `packages/core/src/ia/tasks/adaptar-atividade.ts`, `packages/core/src/ia/tasks/conteudo.test.ts`, `packages/core/src/ia/__fixtures__/inputs.ts`, `packages/shared/src/assistente/conteudo.ts`, `packages/shared/src/atividade/desempenho.ts`, `packages/shared/src/index.ts`, `packages/shared/src/assistente/assistente.test.ts`, `apps/api/src/atividade/correcao/correcao-de-objetiva.ts`, `apps/api/src/atividade/desempenho/desempenho.service.ts`, `apps/api/src/tutor/turno.command.ts`, `apps/api/src/artefato/artefato.int.test.ts`, `apps/api/src/tutor/tutor-modelo.int.test.ts`, `e2e/support/seed.ts`, `docs/roteiro-da-demonstracao.md`, `e2e/roteiro-da-demonstracao.spec.ts` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| questão do capítulo 7; com habilidade do 3 | I | a do 7; gravada `null`, `ia.habilidade_anulada` soma. Mutação: tirar a conferência | |
| seção `aguardando`; `sem_habilidade`; páginas antes do capítulo 1 | I | `null`, um caso cada | |
| questão `null` | I | no `por_habilidade` com `codigo: null` | |
| função suspensa | I | só `origem: 'ia'` dá `null`. Mutação: ler `origem: 'ia'` | |
| a correção da coordenação | I | vale na geração seguinte | |
| plano com os capítulos 3 e 7; questão que cita dois | I | a união; escolhe nela | |
| material passado do 6º ao 9º | I | a turma do 9º não recebe `EF06…` | |
| virada do ano | I | a turma do ano novo usa a classificação de antes | |
| `QUI.EM.05` do `ScriptedAdapter`: atividade; plano; adaptação; chat; Tutor | U | recusado ou anulado, um caso cada | |
| entrada do Tutor | I | sem habilidade da seção. Mutação: passar as habilidades | |
| seed | I | todo código existe em `habilidade_bncc` | |
| atividade antiga com `QUI.EM.05`; questão `null` | I | a leitura aceita | |
| busca da A | I | sem a `habilidade_da_secao` da B. Mutação: tirar `escola_id` do join | |
| `EXPLAIN` do join | I | usa o índice da §7c | |
| roteiro | E | o passo 1 com a correção, conferido passo a passo | |

## Como testar

- Geração: `apps/api/src/artefato/artefato.int.test.ts` › "a professora pede no chat, aceita a proposta, gera a atividade com a página citada…" e "o plano de aula sai com a duração padrão da aula…"
- Tutor: `apps/api/src/tutor/tutor-modelo.int.test.ts` › "a questão vai sem gabarito e sem explicação, a memória só com lote aprovado, e nenhum nome de pessoa"
- Saída do modelo: `packages/core/src/ia/tasks/conteudo.test.ts` › "citar página que não veio nos trechos é saída inválida, mesmo com o material certo"
- Roteiro: `e2e/roteiro-da-demonstracao.spec.ts` › "a turma mostra o acerto por habilidade, e a aluna vê o diagnóstico…"
- `npx vitest run --project integracao apps/api/test/geracao-pela-secao.int.test.ts`
- Armadilha: os testes que citam `QUI.EM` (`grep -rln "QUI\.EM" apps packages e2e`), cada um trocado ou justificado no plano

## Autoconferência

As 12 perguntas do modelo, no plano. Na 8: `habilidade` vira `null` em contratos de leitura; procure quem a lê com `.codigo`.

## Fora do escopo desta tarefa

"Sem habilidade" nas telas (12.0); a troca (11.0).

## Divergências resolvidas nesta tarefa

## Mutações

## Recomendações sem aplicar

