# Correção — a esteira de `spec/classificacao-bncc` está vermelha desde a 3.0: dois e2e contam três funções do Assistente, e o inventário da fila de IA contava sete tarefas

**Origem:** esteira runs 44184984769 (em `f78d58ae`, a 3.0) e 44193095636 (em `3209137c`): `gh run view <id> --log-failed`. O job `verificar` da segunda
(commit `3209137c` sem `Fora do processo:`) é do Orquestrador e fica fora desta correção.
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `conformidade-reviewer`, `llm-integrator`, `frontend-reviewer`, `tenancy-guardian`, `privacy-guardian`, `infra-guardian`
<!-- Os cinco primeiros vieram no PEDIDO do Orquestrador; `test-engineer` é de toda correção. Os três últimos vieram da DEVOLUÇÃO da Mesa:
     arquivo de `e2e/` pede os quatro guardiões de `guardioes-por-caminho.ts` (`portao-local.ts revisores` os lista). -->

## Sintoma

- Integração, `apps/api/src/ia/fila-de-ia.int.test.ts` › `a IA roda no worker › payload do job › a IA não tem tarefa de discursiva nem de
  redação, e o catálogo e o registro que o worker consome não crescem por fora (D55)`: o catálogo `TAREFAS_DE_IA` tinha 8 tarefas, e o teste esperava 7.
- E2e `e2e/professor-entregas.spec.ts:16` (`await expect(page.locator('[data-funcao]')).toHaveCount(3)`) e `e2e/agentes.spec.ts:91`
  (`toHaveCount(funcoes)`, com `funcoes: 3` para o Assistente de ensino): `Expected: 3`, `Received: 4`, em todos os projetos.

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

Falha da **tarefa 3.0** (`924c6792`), vista só na esteira (D79). A 3.0 criou a função `classificacao_do_material` no catálogo
(`packages/shared/src/time/funcoes.ts`: Assistente de ensino, autonomia 1, alto risco, suspensível) e a tarefa `classificar_secoes` no contrato
da IA. Quem enumera tudo o que existe de um tipo (a "lista fechada" do passo 4 de `executar-task`) ficou com o número velho:

1. `fila-de-ia.int.test.ts` listava as sete tarefas e os seis comandos do worker. **A 4.0 (`0adb2983`) já o atualizou**: no HEAD o caso lista as oito tarefas e os sete comandos, e
   a primeira execução do `fila-de-ia` no HEAD só não foi vista pela esteira porque as duas runs vermelhas são anteriores a ele. Esta correção **não o toca**; confere-se rodando-o.
2. `professor-entregas.spec.ts` e `agentes.spec.ts` escreveram a quantidade de funções do Assistente como **número** (3). A tela do professor
   (`Time.tsx`) e a da coordenação (`Agentes.tsx`) listam `agente.funcoes` do catálogo, e a função nova aparece nas duas: é o que a 3.0
   decidiu (o time a mostra suspensa só quando está, `governanca.test.ts`), e o código está certo. O e2e é que não alcançava o catálogo.

## Teste que reproduz

Os próprios casos que a esteira reprovou: `e2e/professor-entregas.spec.ts › Seu time › Assistente de ensino (11.4) › carregando, erro, e sem entrega nenhuma…` e
`e2e/agentes.spec.ts › Como cada IA trabalha › a página, o seletor "Qual IA" e uma IA por vez…`, rodados isolados no HEAD antes da correção: vermelhos
(`Expected: 3 / Received: 4`, nos projetos `chromebook` e `celular`: 4 casos vermelhos). Depois da correção, os dois arquivos passam inteiros isolados (24 casos) e repetidos três vezes
com dois trabalhadores, como a esteira (`--repeat-each 3 --workers 2`: 72 casos). O `fila-de-ia.int.test.ts` isolado no HEAD passa (27 casos, entre eles o do D55).
Nada novo a escrever: o teste que reproduz já existe e é o que estava com o número velho.

## Correção

Os dois e2e deixam de escrever o número e passam a **ler o catálogo** (`FUNCOES`, de `packages/shared`), como o passo 4 de `executar-task` manda para constante
escrita como número:

- `professor-entregas.spec.ts`: a lista das funções do Assistente (as de `agente === 'assistente_de_ensino'`) é comparada **chave a chave** com os `data-funcao` da tela,
  e não só em quantidade. Mantém o que o comentário já dizia ("só as funções do Assistente: as do Tutor e do Analista não são dele"): uma função de outro agente na lista
  do Assistente quebra o caso, e uma função nova do Assistente passa a ser esperada sem editar o e2e.
- `agentes.spec.ts`: `IAS[].funcoes` deixa de ser `3`, `2`, `1` e passa a ser a lista das chaves de cada agente no catálogo; o cartão é conferido em quantidade **e**
  chave a chave, na ordem do catálogo (ordem da Mesa, rodada 1, item 1). `professor-entregas.spec.ts` ganha o comentário de que a ordem também é contrato (item 2).

A tela não muda, e o catálogo não muda.

## Mutações

O diff desta correção é só de e2e (`e2e/agentes.spec.ts` e `e2e/professor-entregas.spec.ts`); o `node tools/processo/mutacoes.ts --faltando` dela está abaixo.

--faltando: 0 linhas (0 blocos, 0 motivos)

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| implementador | O título do caso `agentes.spec.ts:186` diz "três funções no Assistente", e são quatro | Fica: o título é citado por nome em `tasks/correcoes/2026-10-17-agentes-tres-funcoes-perto-do-prazo.md` e em `…-agentes-carregando-estoura-o-prazo.md`, e renomeá-lo as deixa órfãs. O corpo do caso não conta funções |
| llm-integrator (1ª), infra-guardian (1ª) | Comparar sem ordem em `professor-entregas.spec.ts` ("ordene os dois lados antes do `toEqual`") | Recusada: contradiz a recomendação 2 do test-engineer, e a ordem é contrato: a tela sai de `montarTime`, que filtra `CHAVES_DE_FUNCAO` (`packages/shared/src/time/time.ts:45`, de `Object.keys(FUNCOES)`), como o revisor-geral conferiu. Fica a ordem, com o comentário do item 2 |
| test-engineer (1ª), revisor-geral (1ª), llm-integrator (1ª), infra-guardian (1ª), conformidade-reviewer (1ª), privacy-guardian (1ª), frontend-reviewer (1ª) | O título do caso `agentes.spec.ts:186` diz "três funções no Assistente", e são quatro | Já está em "Recomendações sem aplicar" do documento, com o motivo (duas correções citam o título por nome). Renomear é da retro, junto com as citações |
| frontend-reviewer (1ª) | No celular, o nome da escola no cabeçalho aparece cortado ("Colé…") | `TODO.md`, como item de tela: é anterior a esta correção, que não toca `apps/web`. O Implementador acrescenta a linha |
| conformidade-reviewer (1ª) | A tela do professor não mostra o nível de autonomia de cada função | Recusada: regra 70 item 5 pede o nível visível ao coordenador, e a coordenação já o vê (`Agentes.tsx`). Anterior à correção e fora dela |
| frontend-reviewer (1ª) | Texto longo no celular passa sob a barra de navegação fixa | Sem ação: o próprio revisor diz ser o esperado, e a última linha não fica escondida (fotos `celular-2` e `celular-3`) |
| tenancy-guardian (1ª) | `tasks/correcoes/achados/indice.md` não está na lista de arquivos da tarefa | Sem ação: quem o escreve é o hook (`protocolo.md`, item 5), e ele não entra na linha de arquivos da correção |
| test-engineer (2ª), revisor-geral (2ª) | Levar para `e2e/support/` a função que filtra as chaves do catálogo de um agente (e a leitura de `data-funcao` por `evaluateAll`), hoje escritas nos dois e2e | Recusada nesta correção: as duas aprovaram, e a regra da Mesa só aplica recomendação de quem reprovou depois da primeira ordem. Cabe numa passada futura por `e2e/support/`; fica registrada aqui, sem item de TODO |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-17 22:57:50 | 2026-11-17 22:58:00 | `llm-integrator` | 1 | APROVADO | aed2be401010defa1 |
| 2026-11-17 22:57:44 | 2026-11-17 22:58:08 | `revisor-geral` | 1 | APROVADO | ac8f278ebc7be5fa5 |
| 2026-11-17 22:57:57 | 2026-11-17 22:58:09 | `tenancy-guardian` | 1 | APROVADO | af379b8ad546d8a79 |
| 2026-11-17 22:58:04 | 2026-11-17 22:58:14 | `infra-guardian` | 1 | APROVADO | aedc2507db81e9f14 |
| 2026-11-17 22:57:47 | 2026-11-17 22:58:18 | `conformidade-reviewer` | 1 | APROVADO | a67f27dab078b9a04 |
| 2026-11-17 22:58:00 | 2026-11-17 22:58:19 | `privacy-guardian` | 1 | APROVADO | a762c3e5ba62c36da |
| 2026-11-17 22:57:54 | 2026-11-17 22:58:24 | `frontend-reviewer` | 1 | APROVADO | a4b119834db400b5e |
| 2026-11-17 22:57:40 | 2026-11-17 22:58:37 | `test-engineer` | 1 | APROVADO | a43f9898b685abd2a |
| 2026-11-17 23:10:48 | 2026-11-17 23:11:15 | `test-engineer` | 2 | APROVADO | a844f5d486d89e64a |
| 2026-11-17 23:10:54 | 2026-11-17 23:11:19 | `revisor-geral` | 2 | APROVADO | a0052294917cc9f3b |
