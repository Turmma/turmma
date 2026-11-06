# Correção — quatro casos de e2e que a F2 alterou passam de 2/3 do prazo (`areas:279`, `areas:491`, `estrutura:314`, `professores:250`)

**Origem:** esteira run 42210626815 de `205cb0f` (`node tools/processo/esteira.ts --censo`): `e2e/areas.spec.ts:279` (celular 23,3 s e chromebook 21,9 s de 30), `e2e/areas.spec.ts:491` (22,2 e 20,8 de 30), `e2e/estrutura.spec.ts:314` (71,4 e 65,9 de 90) e `e2e/professores.spec.ts:250` (60,5 e 61,9 de 90).
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `frontend-reviewer`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- Os guardiões vieram no PEDIDO do Orquestrador. `revisor-geral` já é obrigatório em toda correção. -->

## Sintoma

Quatro casos de arquivos que a F2 alterou (tarefas 13.0 a 15.0) estão acima de dois terços do próprio prazo na esteira. Nenhum falhou, mas a variação de um runner a outro já derrubou casos nessa faixa (`2026-10-16-galeria-da-onca-estoura-o-prazo`, `2026-10-26-material-sem-licenca-perto-do-prazo`).

## Fora desta correção

Nada: o pedido veio sem arquivos da tarefa em curso.

## Causa

**Tempo, e o tempo é o que antecede o assunto do caso, não o trabalho dele**: a entrada pela tela e as recargas da página sob a rede móvel lenta e a CPU ×4 do perfil.

Medi os quatro no e2e isolado da máquina, com 6 trabalhadores (`node tools/ci/e2e.ts --manter-ambiente`, antes de mexer): `areas:279` 21,1 s (chromebook) e 22,8 s (celular); `areas:491` 19,3 e 20,4 s; `professores:250` 55,6 e 57,9 s; o `estrutura:314` passou, mas a linha do Playwright saiu cortada na largura do terminal e a duração não ficou registrada, então vale a da esteira. É o que a esteira mediu (de 20,8 a 23,3 s de 30; de 60,5 a 71,4 s de 90): a máquina e o runner andam juntos nestes casos.

- **`areas:279` e `areas:491`:** o primeiro entra pela tela de entrada (`entrarComoProfessora`: senha, argon2 e a primeira carga sob a rede lenta) e depois ainda recarrega a página em `/professor/qualquer`; o segundo faz a entrada da coordenação **pela tela com a configuração do segundo fator** (`entrarComoCoordenacaoNaMesmaAba`: duas entradas, a ativação e o código), só para chegar ao Painel com o pedaço da área barrado. O assunto de cada um vem depois da entrada, e a entrada tem os casos dela (`entrar.spec.ts`, `mfa.spec.ts`).
- **`estrutura:314` e `professores:250`:** um caso só, com `test.slow()`, que faz a mesma entrada pela tela (a coordenação, com o segundo fator) e **três ou quatro recargas** da página sob o perfil, uma por estado que o caso afirma (o erro da leitura, o carregando de cada seção, a lista que não acaba). Cada recarga paga a latência do perfil em cada pedido da cascata do `import()` da área, e o caso afirma o que a tela mostra, não quanto ela leva para baixar. O `test.slow()` escondia o tamanho: 60 a 71 s de 90, com a metade do tempo antes do primeiro assunto.

É a mesma causa das correções `2026-10-26-areas-entrar-estoura-o-prazo`, `2026-10-26-tres-casos-do-e2e-perto-do-prazo`, `2026-10-26-material-sem-licenca-perto-do-prazo` e `2026-10-29-primeira-carga-do-e2e`, e a receita é a delas (`abrirPelaApiSemMedirAPrimeiraCarga` e `entrarPelaApiSemMedirAPrimeiraCarga`, no TODO.md, "censo do e2e"), mais uma peça que faltava: a **recarga** também era primeira carga sob a rede lenta.

## Teste que reproduz

Prazo de runner não é determinístico; a evidência é a medida, no mesmo ambiente (`e2e/areas.spec.ts`, `e2e/estrutura.spec.ts` e `e2e/professores.spec.ts`, os casos do censo, 6 trabalhadores), antes e depois, e a estabilidade com os 2 trabalhadores da esteira.

| Caso | Antes (chromebook / celular; o `estrutura`, da esteira) | Depois (chromebook / celular) |
|---|---|---|
| `areas:279` endereço que não existe na área do professor | 21,1 / 22,8 s | 10,3 / 11,4 s |
| `areas:491` área da coordenação que não chega | 19,3 / 20,4 s | 10,7 / 11,1 s |
| `estrutura:314` virada, ano que outra pessoa abriu, erro da estrutura | 71,4 / 65,9 s na esteira (um caso, com `test.slow()`) | 6,5 / 6,3 s |
| `estrutura`, o carregando e o erro de cada seção | (no mesmo caso) | 5,1 / 5,0 s |
| `estrutura`, as seções que falharam se tentam de novo | (no mesmo caso) | 7,0 / 7,4 s |
| `professores:250` carregando, vazio e erro com a lista vazia | 55,6 / 57,9 s (um caso, com `test.slow()`) | 7,9 / 7,8 s |
| `professores`, o erro com dado, pelo nome, o estado de cada convite | (no mesmo caso) | 7,4 / 7,4 s |
| `professores`, o refazer, o revogar com erro e a lista que não acaba | (no mesmo caso) | 8,8 / 8,9 s |

Estabilidade: os oito casos, `--repeat-each=5 --workers=2` (os 2 trabalhadores da esteira), nos dois projetos: **80 de 80 verdes**, o mais lento a 11,5 s. O portão mede cada caso que a correção toca contra 15 s (os novos não herdam o `test.slow()`): todos cabem com folga.

## Correção

Só `e2e/` muda; o produto não, e nenhuma asserção saiu nem mudou de texto.

- `e2e/support/casca.ts`: o ajudante novo `recarregarSemMedirAPrimeiraCarga(page, aguardar)` recarrega a página e espera a primeira tela que o caso afirma sem a rede do perfil (`loadUnthrottled`); a CPU e a rede do perfil voltam quando ele devolve. O comentário diz o que ele não mede, como o das entradas.
- `e2e/areas.spec.ts`: o `:279` entra por `entrarComoProfessoraPelaApi`; o `:491` entra por `abrirPelaApiSemMedirAPrimeiraCarga` (segundo fator pela API) no endereço da raiz, e a espera do endereço do Painel, que estava dentro do ajudante de entrada, passa ao `aguardar`. A falha da área, o foco, o axe e a nova tentativa seguem sob o perfil.
- `e2e/estrutura.spec.ts`: o caso de 90 s vira três, pelos assuntos que o título já listava (a virada e o erro da estrutura; o carregando e o erro de cada seção; a nova tentativa de cada seção e a tela relida). Os dois últimos partem do estado que o anterior deixava (2025 encerrado, 2026 planejado e 2027 em curso), semeado no banco; as três recargas passam pelo ajudante novo. `test.slow()` sai: o primeiro leva 6,5 s.
- `e2e/professores.spec.ts`: o caso de 90 s vira três, também pelos assuntos do título (o carregando, o vazio e o erro com a lista vazia; o erro com dado e o estado de cada convite; o refazer, o revogar com erro e a lista que não acaba). O primeiro faz o cadastro da Yara pela tela, como antes; os dois seguintes a semeiam no banco (`convidarProfessorNoBanco`), para a lista ter os mesmos sete nomes. `test.slow()` sai.

O que **não** muda de lugar e continua sob o perfil: tudo que o caso faz com a página aberta (cliques, diálogos, o axe, as releituras por "Tentar de novo").

## Mutações

Correção só de teste: nenhum arquivo de `apps/*/src` nem de `packages/*/src` muda, e as asserções são as mesmas, então o RF17 não exige mutação. Os blocos abaixo mexem no próprio teste e provam que as esperas que passaram a rodar **dentro** do `aguardar` (fora da rede lenta) estão vivas: não é a regra de produto que eles provam (essa continua nas asserções inalteradas), é que o ajudante não engole a espera. O primeiro, ao trocar o endereço esperado, fica vermelho porque o `toHaveURL` do `aguardar` não vê o Painel; o segundo, ao deixar de recusar a leitura da estrutura, fica vermelho porque o alerta que o `aguardar` espera nunca aparece; o terceiro, ao trocar o texto do teto, fica vermelho pela mesma espera na recarga da lista que não acaba.

```mutacao
arquivo: e2e/areas.spec.ts
teste: e2e/areas.spec.ts › a área da coordenação que não chega mostra a mesma fronteira
     await abrirPelaApiSemMedirAPrimeiraCarga(page, request, coordenadora, '/', () =>
-      expect(page).toHaveURL(/\/coordenacao\/painel$/, { timeout: SIGN_IN_TIMEOUT_MS }),
+      expect(page).toHaveURL(/\/coordenacao\/turmas$/, { timeout: SIGN_IN_TIMEOUT_MS }),
     )
```

```mutacao
arquivo: e2e/estrutura.spec.ts
teste: e2e/estrutura.spec.ts › depois da virada, só o ano planejado se abre
     await fecharPainel(page, doPainel, hasTouch)
-    falhar = true
+    falhar = false
     await recarregarSemMedirAPrimeiraCarga(page, () =>
```

```mutacao
arquivo: e2e/professores.spec.ts
teste: e2e/professores.spec.ts › o convite vencido se refaz pelo painel
     await recarregarSemMedirAPrimeiraCarga(page, () =>
-      expect(principal(page)).toContainText('A lista é maior do que esta tela mostra: aparecem só os primeiros.', { timeout: SIGN_IN_TIMEOUT_MS }),
+      expect(principal(page)).toContainText('A lista é maior do que esta tela mostra: aparecem todos.', { timeout: SIGN_IN_TIMEOUT_MS }),
     )
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral 1ª, frontend-reviewer 1ª | Extrair um ajudante para a semeadura repetida de `estrutura.spec.ts` (os três anos e a entrada) e de `professores.spec.ts` (o mapa `nomes` e o laço dos sete professores) | Recusada por ora: são dois usos em cada arquivo e o ajudante é refatoração de mais de poucas linhas. Se aparecer um quarto caso com o mesmo ponto de partida, extrair um ajudante de semeadura em `e2e/support/seed.ts` |
| tenancy-guardian 1ª | Conferir sobra de `hasTouch` e de imports (`entrarComoCoordenacaoNaMesmaAba`, `abrirEstrutura`) | Sem ação: `tsc -p e2e/tsconfig.json` e `eslint --max-warnings=0` limpos e nenhum import sem uso; o `hasTouch` do `areas:279` segue usado no toque em "página inicial" |
| frontend-reviewer 1ª | Rótulo "Ferramentas" cortado como "FERRAME…" na barra de baixo do professor a 360 px (`apps/web/src/components/BarraDeBaixo.tsx:83`, `truncate`; `BarraDeBaixo.test.tsx:142` exige a classe) | `TODO.md`, uma linha "Da correção 2026-11-06-e2e-perto-do-prazo-da-f2". Já era assim antes desta correção, que só mexe em `e2e/` |
| frontend-reviewer 1ª | Barra de baixo sobre o conteúdo nas fotos de página inteira | Sem ação: efeito da captura de página inteira com barra fixa, não defeito de tela |
| test-engineer 1ª | O `areas:492` deixou de exercitar a falha do chunk da coordenação logo depois da entrada pela tela com o segundo fator | Sem ação: a entrada tem os casos dela em `mfa.spec.ts` e a fronteira do `import()` segue provada; fica registrado para o Validador |
| test-engineer 1ª | `areas:279` e `:492` são os casos mais perto do limite do portão (10,8 a 11,4 s de 15) | Destino: o próximo censo da esteira (`node tools/processo/esteira.ts --censo`); sem mudança de código |
| revisor-geral 2ª, test-engineer 2ª | `e2e/areas.spec.ts`, o comentário antes do caso `areas:279` e o comentário dentro dele dizem a mesma coisa (a entrada é pela API e a entrada pela tela tem os casos dela em `entrar.spec.ts`); manter um dos dois e quebrar a linha mais longa | Recusada: é texto de comentário, não muda o que o caso prova, e aplicá-la caducaria os dois revisores por uma linha |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-06 09:47:53 | 2026-11-06 09:48:13 | `tenancy-guardian` | 1 | APROVADO | a63d3897288fd2431 |
| 2026-11-06 09:47:56 | 2026-11-06 09:48:24 | `privacy-guardian` | 1 | APROVADO | aabcf506bb974c305 |
| 2026-11-06 09:48:03 | 2026-11-06 09:48:25 | `infra-guardian` | 1 | APROVADO | a755f7c562ab86644 |
| 2026-11-06 09:48:00 | 2026-11-06 09:48:26 | `conformidade-reviewer` | 1 | APROVADO | a7385049a36d69edc |
| 2026-11-06 09:47:46 | 2026-11-06 09:48:42 | `revisor-geral` | 1 | APROVADO | a237eac7a8ee3ef21 |
| 2026-11-06 09:47:49 | 2026-11-06 09:48:49 | `frontend-reviewer` | 1 | APROVADO | ab3b8193445e7970d |
| 2026-11-06 09:47:43 | 2026-11-06 09:49:26 | `test-engineer` | 1 | APROVADO | af9c8763bc4f17015 |
| 2026-11-06 10:03:25 | 2026-11-06 10:03:47 | `revisor-geral` | 2 | APROVADO | a7a149c61c96968af |
| 2026-11-06 10:03:20 | 2026-11-06 10:03:50 | `test-engineer` | 2 | APROVADO | a4dc3847d36734e08 |
