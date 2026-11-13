# Correção — o e2e que monta a escola envia o material sem marcar série, e o diálogo "Enviar material" passou a exigir uma

**Origem:** esteira run 43459445014 em `f574324c`: jobs e2e 1/11 e 6/11.
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- `test-engineer` e `revisor-geral` vieram no PEDIDO do Orquestrador; os outros quatro vêm do caminho: todo arquivo de `e2e/` pede os quatro
     guardiões (`tools/processo/guardioes-por-caminho.ts`). `frontend-reviewer` só se a correção tocar `apps/web`, e ela não toca. -->


## Sintoma

Sete casos caem em `e2e/support/professor-flow.ts:60` (`expect(material.getByText('Pronto · 6 páginas')).toBeVisible({ timeout: 45 s })`),
no chromebook e no celular: `e2e/a2-assistente.spec.ts` (:52, :139 e :174) e `e2e/a3-a4-professor.spec.ts:22`. A linha do material
nunca chega a "Pronto · 6 páginas".

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

Falha da **tarefa 7.0** (`f2a0d22b`), vista só na esteira. O diálogo "Enviar material" passou a exigir de 1 a 7 séries
(`material-envio.ts:134`: "Marque ao menos uma série…"), e a 7.0 atualizou `e2e/material.spec.ts` e
`e2e/roteiro-da-demonstracao.spec.ts`, mas não o ajudante `montarEscolaEEntrar` de `e2e/support/professor-flow.ts`, que preenche o
diálogo sem marcar série: o envio é barrado no formulário, nenhum material nasce, e a espera de 45 s esgota. A série que a escola
semeada tem é a de `criarAlocacaoDoProfessor` (7º ano do Ensino Fundamental). Os outros dois usos do diálogo em `e2e/`
(`material.spec.ts` e `roteiro-da-demonstracao.spec.ts`) já marcam a série; o ajudante é o único que faltava.

## Teste que reproduz

Os próprios sete casos: `e2e/a3-a4-professor.spec.ts:22` e `e2e/a2-assistente.spec.ts` (:52, :139, :174), vermelhos na árvore antes
da correção e verdes depois. Não há teste novo: o ajudante é o que o falha, e o que ele prova (o material pronto) já é asserção dele.

- Vermelho (`node tools/ci/e2e.ts --manter-ambiente e2e/a3-a4-professor.spec.ts`, árvore sem a correção): `a3-a4-professor.spec.ts:22`, nos
  projetos `chromebook` e `celular`, cai em `support/professor-flow.ts:60` com "element(s) not found" após 45 s.
- Verde (o mesmo comando, com `e2e/a2-assistente.spec.ts` também, com a correção): 8 passed (2,2 min). Os sete casos da esteira passam, e a2:52 e a3-a4:22
  levam de 52 s a 1,3 min no total, os mesmos de antes: o diff não toca nenhuma linha de caso, só o ajudante.
- Os outros usos do diálogo em `e2e/` (`material.spec.ts`, `roteiro-da-demonstracao.spec.ts`) já marcam a série; nenhum outro spec abre o diálogo
  fora de `montarEscolaEEntrar`.

**Sem mutação:** a correção só altera `e2e/support/professor-flow.ts`, que não é código de `apps/*/src` nem de `packages/*/src`; o teste dela é o próprio e2e, vermelho sem a linha e verde com ela.

## Correção

`e2e/support/professor-flow.ts`: `montarEscolaEEntrar` marca a série da escola (`SERIE_DA_ESCOLA = '7º ano do Ensino Fundamental'`) no
diálogo, entre a disciplina e a titularidade, como os outros dois usos.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª), infra-guardian (1ª), revisor-geral (1ª), test-engineer (1ª), privacy-guardian (1ª) | Exportar uma constante só do nome da série, junto de `criarAlocacaoDoProfessor` em `e2e/support/seed.ts`, em vez do rótulo `'7º ano do Ensino Fundamental'` escrito à mão em `professor-flow.ts`, `material.spec.ts:20`, `roteiro-da-demonstracao.spec.ts`, `acesso-da-turma.spec.ts:64`, `a3-a4-professor.spec.ts:29` e `senha-provisoria.spec.ts:80/426` | `TODO.md`. Não é barata: toca `seed.ts` e pelo menos cinco specs que esta correção não altera, e cada um caduca de novo os seis revisores |
| revisor-geral (1ª), test-engineer (1ª) | Quando uma tarefa faz um formulário exigir campo novo, procurar em `e2e/` (inclusive `e2e/support/`) todo lugar que preenche o diálogo | Retro da spec ingestao-do-material (D86), sobre a 7.0. Não é mudança desta correção |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-13 15:15:46 | 2026-11-13 15:15:58 | `tenancy-guardian` | 1 | APROVADO | a00274e7ef4eefdb2 |
| 2026-11-13 15:15:49 | 2026-11-13 15:16:01 | `infra-guardian` | 1 | APROVADO | a92bf6fdb927a469d |
| 2026-11-13 15:15:45 | 2026-11-13 15:16:01 | `revisor-geral` | 1 | APROVADO | a6614158d1889c1eb |
| 2026-11-13 15:15:47 | 2026-11-13 15:16:00 | `privacy-guardian` | 1 | APROVADO | a281092f0762c7439 |
| 2026-11-13 15:15:48 | 2026-11-13 15:16:01 | `conformidade-reviewer` | 1 | APROVADO | a8f067f0312ff78a1 |
| 2026-11-13 15:15:44 | 2026-11-13 15:16:06 | `test-engineer` | 1 | APROVADO | a9c763af0e1b345cf |
| 2026-11-13 15:26:45 | 2026-11-13 15:26:56 | `revisor-geral` | 2 | APROVADO | a3215ee7c637e8fcf |
