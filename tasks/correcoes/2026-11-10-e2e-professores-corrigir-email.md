# Correção — os casos de `professores.spec.ts` que listam as ações do painel não têm o "Corrigir o e-mail" que a 19.0 pôs

**Origem:** esteira run 42883481508 de `spec/acesso-e-convites` (commit `8811171c`), vermelha nas fatias 5/10 e 10/10, nos dois projetos (`celular` e `chromebook`). Veio da tarefa 19.0 (Tech Spec, seção 5, "Corrigir o e-mail"; `validacao.md`, rodada 2).
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `frontend-reviewer`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- Os três primeiros vêm do PEDIDO do Orquestrador (`test-engineer` é de toda correção). Os quatro últimos a Mesa acrescentou: arquivo de `e2e/` pede os quatro pelo padrão de `guardioes-por-caminho.ts`. -->

## Sintoma

Três casos de `e2e/professores.spec.ts` caem com o mesmo diff em `toHaveText` sobre os botões do painel (`acoesDoPainel`), em `celular` e em `chromebook`:

- `:322` (W4, "o erro com "Tentar de novo" traz a lista; com dado, pelo nome, o estado de cada convite e só as ações que ele permite"), no estado `vencido` (linha 367);
- `:1130` ("a linha inteira abre o painel, no endereço…"), no `vencido` (linha 1151);
- `:1333` (RF6, o "Copiar link" do cadastrado pela planilha), no `pendente` (linha 1355).

Esperado `['Refazer convite', 'Revogar convite']`, recebido `['Corrigir o e-mail', 'Refazer convite', 'Revogar convite']`.

## Fora desta correção

Nada.

## Causa

A 19.0 pôs o botão "Corrigir o e-mail" no painel de quem espera o convite (`pendente` e `vencido`, pela matriz `CORRIGIR_EMAIL_DO_PROFESSOR_POR_ESTADO`, igual à do servidor) e atualizou os testes de Vitest (`Professores.test.tsx`, `PainelDoProfessor.test.tsx`) e o `professores-envio.spec.ts`, mas
não a constante `ACOES_DO_ESTADO` de `e2e/professores.spec.ts`, que lista os botões do painel por estado e é lida nos três casos. O portão local da 19.0 não rodou esses casos (a 19.0 não alterou o `professores.spec.ts`), e a esteira é que pegou.
`revogado`, `aceito`, `ativo` e `desativado` continuam sem ação, porque a matriz os manda ao `CONFLITO`.

## Teste que reproduz

Os próprios três casos, que ficam vermelhos pelo diff acima na esteira (run 42883481508) e, rodados isolados no ambiente do compose, no mesmo ponto: `professores.spec.ts:322`, `:1130` e `:1333`.

## Correção

- `e2e/professores.spec.ts`: `ACOES_DO_ESTADO` passa a dizer `['Corrigir o e-mail', 'Refazer convite', 'Revogar convite']` em `pendente` e `vencido` (a ordem é a do painel, a mesma do `PainelDoProfessor.test.tsx`), e o comentário diz que é a matriz do corrigir e a do convite. O caso `:1130`, que já passa por cada ação com `alvoDeToque`, passa a medir o alvo de toque também do "Corrigir o e-mail".

- Da rodada 1 (`.processo/ordens/2026-11-10-e2e-professores-corrigir-email-r1.md`): o comentário de `ACOES_DO_ESTADO` diz só o que os casos provam (a lista vale para o professor semeado pelo banco, sem envio, numa escola sem turma nem disciplina, e por que o "Acrescentar turma" fica de fora), e o caso do teclado no celular
  (`pendente`) mede também o alvo de toque do "Corrigir o e-mail". Essa cláusula é medida de alvo de toque num teste e2e, sem mutação própria.

O que continua provado: cada caso segue afirmando o conjunto exato de botões do estado, e os quatro estados sem ação seguem vazios.

**Sem mutação:** a correção só altera `e2e/professores.spec.ts` e este documento; não há código de `apps/*/src` nem de `packages/*/src`.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| frontend-reviewer (1ª) | "No painel no computador (`coordenacao--coordenacao-professores--Ana-convidado--computador.png`), os quatro botões do rodapé ocupam duas linhas desalinhadas. Isso é estética e fica fora desta tarefa." | `TODO.md`: ajuste visual do rodapé do painel do professor; esta correção só toca teste e2e |
| privacy-guardian (1ª) | Abrir o diálogo do "Corrigir o e-mail" no `:1130` e afirmar que o e-mail digitado não fica na página nem no endereço, "cobertura extra para outra rodada". | Não aplicar: é caso novo, e não ajuste da constante. O diálogo tem o seu bloco em `e2e/professores-envio.spec.ts:479`, que não afirma o e-mail fora da página e do endereço; destino `TODO.md` |
| conformidade-reviewer (1ª) | "confirmar que `acoesDoPainel` deixa esse botão ("Acrescentar turma") de fora de propósito, e não por acaso." | Já atendida pelo item 1: o comentário passa a dizer o motivo |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-10 16:57:12 | 2026-11-10 16:57:25 | `tenancy-guardian` | 1 | APROVADO | ae29c5ad8fa8b9f10 |
| 2026-11-10 16:57:23 | 2026-11-10 16:57:33 | `infra-guardian` | 1 | APROVADO | a1f863809a6db16e6 |
| 2026-11-10 16:57:04 | 2026-11-10 16:57:36 | `revisor-geral` | 1 | APROVADO | ab8704794f3fa511a |
| 2026-11-10 16:57:08 | 2026-11-10 16:57:36 | `frontend-reviewer` | 1 | APROVADO | a4b11017f2d550f88 |
| 2026-11-10 16:57:01 | 2026-11-10 16:57:37 | `test-engineer` | 1 | APROVADO | a7afdc16cc668538e |
| 2026-11-10 16:57:19 | 2026-11-10 16:57:47 | `conformidade-reviewer` | 1 | APROVADO | ac38ec2b0609f0097 |
| 2026-11-10 16:57:16 | 2026-11-10 16:57:49 | `privacy-guardian` | 1 | APROVADO | a2a0ac5f0a62534ee |
| 2026-11-10 17:09:23 | 2026-11-10 17:10:08 | `revisor-geral` | 2 | APROVADO | aac87987444a76ef3 |
| 2026-11-10 17:09:20 | 2026-11-10 17:10:25 | `test-engineer` | 2 | APROVADO | a67665d32e542fbd5 |
