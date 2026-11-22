# Correção — dois casos de e2e da operação passam de 2/3 do prazo (`operacao:45`, `operacao:125`)

**Origem:** esteira run 44977538314 de `5899c8c` (`node tools/processo/esteira.ts --censo`): `e2e/operacao.spec.ts:45` (22–23 s de 30, nos dois projetos) e `e2e/operacao.spec.ts:125` (63–67 s de 90, nos dois projetos).
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- `test-engineer` e `revisor-geral` vieram no PEDIDO do Orquestrador; os outros quatro, a Mesa apontou pelo caminho: todo arquivo de `e2e/` pede os quatro guardiões, testes e fixtures inclusive (`tools/processo/guardioes-por-caminho.ts`). -->

## Sintoma

Dois casos de `e2e/operacao.spec.ts` estão acima de dois terços do próprio prazo na esteira. Nenhum falhou, mas a variação de um runner a outro já derrubou casos nessa faixa (`2026-11-06-e2e-perto-do-prazo-da-f2`).

## Fora desta correção

Nada: o pedido veio sem arquivos da tarefa em curso.

## Causa

**Tempo, e o tempo é o que antecede o assunto do caso, não o trabalho dele**: a primeira carga de cada tela sob a rede móvel lenta do perfil (Fast 3G, CPU ×4), e, no `:45`, dois casos num só.

Medi os dois no e2e isolado da máquina (`node tools/ci/e2e.ts --manter-ambiente e2e/operacao.spec.ts`, 4 trabalhadores, antes de mexer): `:45` 27,5 s (chromebook) e 21,0 s (celular), `:125` 1,1 min nos dois. É o que a esteira mediu (22–23 s de 30; 63–67 s de 90): a máquina e o runner andam juntos nestes casos.

- **`operacao:125`** (a barra de topo fora da sessão): um caso só, com `test.setTimeout(90_000)`, que faz **doze** `page.goto` (3 telas × 2 larguras × 2 temas), cada um com a primeira carga sob a rede do perfil (~5 s). O caso afirma a barra (fundo, "Sair" ausente, sem navegação, sem rolagem horizontal, axe no escuro), e não quanto a tela leva para baixar. O prazo de 90 s escondia o tamanho.
- **`operacao:45`** (entrada pela tela, casca, "Sair"): um caso só com três assuntos. Ele paga a primeira carga sob a rede lenta, a senha errada (argon2), a senha certa (argon2) e o segundo fator, e **depois** ainda confere o "Sair" (alvo de 44 px, anel de foco, barra clara, sair, voltar a `/operacao`). O "Sair" não depende de a entrada ser a do caso: ele só precisa estar numa casca aberta.

É a mesma causa e a mesma receita da correção `2026-11-06-e2e-perto-do-prazo-da-f2` (`loadUnthrottled`, de `e2e/support/profiles.ts`), mais a divisão pelos assuntos que o título já listava.

## Teste que reproduz

Prazo de runner não é determinístico; a evidência é a medida, no mesmo ambiente, antes e depois, e a estabilidade com os 2 trabalhadores da esteira. Tempos em chromebook / celular (e2e isolado, 4 trabalhadores):

| Caso | Antes | Depois |
|---|---|---|
| `operacao:45` entra por e-mail, senha e código, chega à casca | 27,5 / 21,0 s (um caso, com o "Sair") | 12,2 / 11,4 s |
| `operacao:96` (novo) na casca, o "Sair" à vista, o anel de foco e sair | (no mesmo caso) | 11,9 / 9,3 s |
| `operacao:136` (novo) a barra fora da sessão, 1366 px, claro | 1,1 min (um caso de 90 s, 12 recargas) | 4,4 / 3,1 s |
| `operacao:136` (novo) 360 px, claro | (no mesmo caso) | 3,9 / 3,1 s |
| `operacao:136` (novo) 1366 px, escuro | (no mesmo caso) | 6,0 / 6,4 s |
| `operacao:136` (novo) 360 px, escuro | (no mesmo caso) | 6,5 / 6,2 s |

Estabilidade: os seis casos, `--repeat-each 5 --workers 2` (os 2 trabalhadores da esteira), nos dois projetos: **60 de 60 verdes**, o mais lento a 8,9 s. O portão mede cada caso que a correção toca contra 15 s (os casos novos não herdam o `test.setTimeout`): todos cabem.

## Correção

Só `e2e/operacao.spec.ts` muda; o produto não, e nenhuma asserção saiu nem mudou de texto (cada uma está no mesmo lugar do mesmo caso, ou no caso novo que herdou o trecho dela).

- **`:45` vira dois casos.** O primeiro fica com a entrada pela tela (a senha errada, a senha certa, o segundo fator, o código) e as asserções da casca, até `semNadaGuardadoNoNavegador`; a primeira carga da tela de entrada passa a correr sem a rede do perfil (`loadUnthrottled`). O segundo, `na casca da operação, o "Sair" está à vista…`, leva o trecho do "Sair" sem mudar uma linha dele; chega à casca por `entrarNaOperacao` dentro do `loadUnthrottled`. A entrada pela tela continua provada no primeiro caso, e o ajudante dele já era o que a entrada da operação usa nos outros casos do arquivo.
- **`:125` vira quatro casos**, um por tema e por largura (3 recargas cada), pelo mesmo laço de antes: o corpo é o mesmo, só que `esquema` e `largura` viram o caso em vez de laços dentro dele. Cada `page.goto` mais a espera do título correm dentro do `loadUnthrottled`; a CPU do perfil continua, e a rede volta ao fim de cada recarga. `test.setTimeout(90_000)` sai: o mais lento leva 6,5 s.
- `loadUnthrottled` entra no import de `./support/profiles.ts`.

O que **não** muda de lugar e continua sob o perfil: tudo que o caso faz com a página aberta (cliques, medidas, o axe).

## Mutações

`--faltando: 0 linhas (3 blocos, 0 motivos)`

Correção só de teste: nenhum arquivo de `apps/*/src` nem de `packages/*/src` muda, e as asserções são as mesmas, então o RF17 não exige mutação. Os blocos abaixo provam que as esperas que passaram a rodar **dentro** do `loadUnthrottled` estão vivas, e que o caso novo do "Sair" chega mesmo à casca e afirma o anel: o primeiro, ao trocar o título esperado do segundo fator, fica vermelho porque a espera do `loadUnthrottled` não vê a tela; o segundo, ao trocar o título da entrada, fica vermelho pela mesma espera na primeira carga do `:45`; o terceiro, ao trocar a largura do anel, fica vermelho no caso do "Sair", **só no projeto `chromebook`**: o anel de foco está dentro de `if (!hasTouch)`, e no `celular` essa asserção não roda (o bloco roda no `chromebook`, que é o projeto padrão do portão).

```mutacao
arquivo: e2e/operacao.spec.ts
teste: e2e/operacao.spec.ts › a barra de topo é clara e tem a marca à vista na entrada, no segundo fator e no convite, a 1366 px, no tema escuro
           { endereco: '/operacao/entrar', titulo: 'Entrar na operação' },
-          { endereco: '/operacao/mfa', titulo: 'Segundo fator' },
+          { endereco: '/operacao/mfa', titulo: 'Segundo fator do operador' },
           { endereco: '/operacao/convite', titulo: 'Convite para a operação' },
```

```mutacao
arquivo: e2e/operacao.spec.ts
teste: e2e/operacao.spec.ts › entra por e-mail, senha e código e chega à casca da operação
       await page.goto('/operacao/entrar')
-      await expect(page.getByRole('heading', { name: 'Entrar na operação' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
+      await expect(page.getByRole('heading', { name: 'Entrar na operação agora' })).toBeVisible({ timeout: SIGN_IN_TIMEOUT_MS })
     })
```

```mutacao
arquivo: e2e/operacao.spec.ts
teste: e2e/operacao.spec.ts › na casca da operação, o "Sair" está à vista, com o anel de foco do sistema, e sai a um clique
-      expect(anel).toEqual({ visivel: true, estilo: 'solid', largura: '3px', cor: FOCO })
+      expect(anel).toEqual({ visivel: true, estilo: 'solid', largura: '4px', cor: FOCO })
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (2ª), revisor-geral (2ª) | `e2e/operacao.spec.ts:114`: falta um espaço em `tecla < 10 &&!(await ...`; o certo é `&& !(`. O lint não pega, é só aparência | Recusada nesta rodada: as recomendações entram em ordem uma vez por documento, e as dos revisores que aprovam vão para cá. Destino: `TODO.md`, para quem tocar a linha de novo; corrigir agora mudaria código e caducaria o carimbo e duas rodadas por um espaço |
| revisor-geral (2ª) | `e2e/operacao.spec.ts:112-113`: o 10 do laço de `Tab` virar constante com nome (ex.: `MAXIMO_DE_TAB_ATE_O_SAIR`), e o comentário encolher | Recusada: o comentário novo já diz a causa, e a constante é refatoração de teste sem efeito na prova. Destino: `TODO.md` |

A rodada 1 não deixou nada sem aplicar (`.processo/ordens/2026-11-22-e2e-operacao-perto-do-prazo-r1.md`).

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-22 00:48:57 | 2026-11-22 00:49:11 | `tenancy-guardian` | 1 | APROVADO | aaf9e11dc761d1691 |
| 2026-11-22 00:48:58 | 2026-11-22 00:49:15 | `privacy-guardian` | 1 | APROVADO | af08ca5e65136ef5a |
| 2026-11-22 00:48:59 | 2026-11-22 00:49:16 | `conformidade-reviewer` | 1 | APROVADO | a6248d879912d190a |
| 2026-11-22 00:48:56 | 2026-11-22 00:49:21 | `revisor-geral` | 1 | APROVADO | a9d48495720dca103 |
| 2026-11-22 00:49:00 | 2026-11-22 00:49:22 | `infra-guardian` | 1 | APROVADO | ad7f5ee67519c5055 |
| 2026-11-22 00:48:55 | 2026-11-22 00:49:55 | `test-engineer` | 1 | APROVADO | a1a6fd7e2231ce197 |
| 2026-11-22 01:04:33 | 2026-11-22 01:04:53 | `revisor-geral` | 2 | APROVADO | a1952ad5985b39322 |
| 2026-11-22 01:04:30 | 2026-11-22 01:04:57 | `test-engineer` | 2 | APROVADO | a1dc170c1082cb4cf |
