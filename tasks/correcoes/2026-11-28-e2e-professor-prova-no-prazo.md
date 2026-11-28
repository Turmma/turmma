# Correção — os 6 casos de `e2e/professor-prova.spec.ts` levam 13,6–15,5 s, perto do prazo de 30 s da esteira

**Origem:** validacao.md de `avaliacao-e-correcao` (§4, achado maior): `e2e/professor-prova.spec.ts` (`:87`, `:121`, `:135`, `:172`, `:189`, `:207` na validação; depois desta correção, que acrescentou três linhas ao `montarEscola`, são `:90`, `:124`, `:138`, `:175`, `:192`, `:210`).
**Subagentes obrigatórios:** `test-engineer`, `infra-guardian`, `revisor-geral`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`
<!-- Os guardiões vieram no PEDIDO do Orquestrador (`infra-guardian`, `revisor-geral`); o `test-engineer` é de toda correção; `tenancy-guardian`, `privacy-guardian` e `conformidade-reviewer` vieram do `portao-local.ts revisores`, que lista quem o caminho pede. -->

## Sintoma

Os 6 casos do `professor-prova.spec.ts`, nos dois projetos (`chromebook` e `celular`), levam de 13,6 a 15,5 s na máquina, com o prazo padrão de 30 s. O `tools/ci/duracao-do-e2e.ts` deixa vermelho o caso tocado acima de 15 s, e o runner da esteira leva perto do dobro: ~27 a 31 s contra 30.

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

A carga do aplicativo na rede do perfil, e não o que o caso prova. Cada caso abre a página direto na tela que prova (a montagem da escola e a parte dos alunos já eram feitas pelo banco e pela API, antes de abrir a página), mas o aplicativo chega em uns 40 pedaços (`/assets/…`) pelo `Network.emulateNetworkConditions` do perfil (Fast 3G no `chromebook`, móvel lenta no `celular`, 562 a 600 ms de latência), que os entrega em ondas de 0,5 s, com a CPU ×4 por cima. Só essa carga leva uns 7 a 10 s de cada caso, e o que sobra para provar a tela é pouco. É a mesma causa que o `aluno-prova.spec.ts` já tinha resolvido, e que o `professor-prova.spec.ts` (11.0) não herdou: lá, os `/assets/` vêm direto e a carga na rede lenta fica para o `casca.spec.ts`.

A validação mediu 13,6 a 15,5 s. Na rodada desta correção, com os 6 trabalhadores da máquina, os 12 casos (6 em cada projeto) levaram de **13,6 a 19,9 s**, e 10 dos 12 ficaram acima de 15 s (o limite do `duracao-do-e2e.ts`).

## Teste que reproduz

O próprio `e2e/professor-prova.spec.ts` (os 6 casos, nos dois projetos), e o que reproduz é a **duração**, medida à mão com o `list` do Playwright. O portão **não** a confere com este diff: o `tools/ci/duracao-do-e2e.ts` só mede o caso cujas linhas o diff tocou (`casosAlterados`), e as linhas tocadas (o cabeçalho e a `montarEscola`) estão antes do primeiro `test(`, então nenhum dos 12 casos conta como tocado. Se a carga voltar a ficar lenta, só o prazo de 30 s da esteira acusa. Não há asserção nova: nenhuma foi tirada nem afrouxada, e a lista de casos é a mesma.

- **Vermelho (antes):** `node tools/ci/e2e.ts --manter-ambiente e2e/professor-prova.spec.ts`: 12 passaram, de 13,6 a 19,9 s cada (`chromebook`: 19,1, 18,0, 19,9, 18,6, 14,1, 13,6; `celular`: 15,2, 15,6, 17,3, 18,0, 16,4, 15,2).
- **Verde (depois):** o mesmo comando sobre o ambiente de pé: 12 passaram, de **7,3 a 9,2 s**. Repetido como a esteira roda (`--repeat-each 3 --workers 2`): 36 de 36, a maior com **8,3 s**, metade do limite de 15 s. No portão (`--tarefa`, 4 trabalhadores, com a unidade inteira antes): 12 de 12, a maior com 12,2 s; o `duracao-do-e2e.ts` não reprovou nenhum, mas também não mediu nenhum (ver acima), e por isso a prova da correção são as medidas à mão.

## Correção

Só o teste (`e2e/professor-prova.spec.ts`); nenhum código de produção, nenhuma migration, nenhum caso a menos.

- `montarEscola` passa a servir os `/assets/**` direto (`page.route('**/assets/**', rota => rota.fulfill({ response: await rota.fetch() }))`), igual à `montarCena` do `aluno-prova.spec.ts`. A CPU ×4 e a rede do perfil seguem valendo para tudo o que os casos provam (as chamadas à API e a tela); o `rota.fetch()` usa o contexto da requisição, sem a emulação de rede. Os casos que já interceptam rotas próprias (`:207`, o `acompanhamento` e as `extensoes`) usam outro padrão de endereço e seguem como estavam.
- O comentário de cabeçalho do arquivo diz que os `/assets/` vêm direto.
- Não dividi caso nenhum: nenhum prova duas coisas que só uma divisão separasse, e a carga era a maior parte do tempo.

**Sem mutação:** só `e2e/` mudou, sem arquivo de `apps/*/src` nem de `packages/*/src`, e sem cláusula de regra de negócio: a prova é a duração medida acima.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª), revisor-geral (1ª), privacy-guardian (1ª) | Extrair a interceptação de `/assets/**` (hoje repetida em `e2e/aluno-prova.spec.ts:49-51` e `e2e/professor-prova.spec.ts:42-44`) para um auxiliar comum em `e2e/` | Não aplicar agora: mexe em `aluno-prova.spec.ts`, fora desta correção, e o próprio `revisor-geral` diz que "com dois usos ainda não precisa". Destino: retro da funcionalidade; vira tarefa quando um terceiro spec precisar da mesma linha |
| infra-guardian (1ª) | O caso de indisponibilidade de `extensoes` segue com a rede do perfil; o teste de carga não precisa mudar | Observação, sem ação |
| revisor-geral (1ª) | Os padrões `**/assets/**` e as rotas de `:219` e `:241` não se cruzam | Observação para a validação, sem ação |
| revisor-geral (2ª) | O comentário de `e2e/professor-prova.spec.ts:42` diz que a carga "sozinha leva uns 10 s de um caso de 15 s"; se alguém mexer ali, deixar claro que o número mede a situação de antes, quando os `/assets/` passavam pela rede do perfil | Não aplicar: o próprio revisor diz que "pode ficar" (é o motivo da interceptação), e o comentário já descreve a causa que a correção tirou. Sem destino a mais; fica na tabela do documento |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-28 11:16:45 | 2026-11-28 11:16:59 | `tenancy-guardian` | 1 | APROVADO | a0fe21e89cdb01c5e |
| 2026-11-28 11:16:43 | 2026-11-28 11:17:02 | `infra-guardian` | 1 | APROVADO | ab67a048c36ad57eb |
| 2026-11-28 11:16:44 | 2026-11-28 11:17:05 | `revisor-geral` | 1 | APROVADO | a708b835f24aee55c |
| 2026-11-28 11:16:47 | 2026-11-28 11:17:06 | `conformidade-reviewer` | 1 | APROVADO | ae2452368287daebb |
| 2026-11-28 11:16:46 | 2026-11-28 11:17:06 | `privacy-guardian` | 1 | APROVADO | a92c5d7273d865d00 |
| 2026-11-28 11:16:42 | 2026-11-28 11:17:36 | `test-engineer` | 1 | APROVADO | ab74d420d7e6c61e5 |
| 2026-11-28 11:32:35 | 2026-11-28 11:32:59 | `revisor-geral` | 2 | APROVADO | adbe329d3a57f8780 |
