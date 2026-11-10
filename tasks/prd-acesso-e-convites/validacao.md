# Validação — acesso-e-convites (F2c)

## Rodada 3 — 10/11/2026

**Escopo:** a correção `2026-11-10-e2e-professores-corrigir-email` (`tasks/correcoes/2026-11-10-e2e-professores-corrigir-email.md`), que
muda a asserção das ações do painel em `e2e/professores.spec.ts` depois de a 19.0 pôr o "Corrigir o e-mail". O resto da funcionalidade
segue o que as rodadas 1 e 2 deram; não foi refeito.
**Commit validado:** `83af4e44` (o HEAD `6a559578` só muda o `estado.md`)
**Veredito: APROVADA**

Ambiente: `node_modules` em dia com o `package-lock.json` (sem `npm ci`). Árvore limpa no início e no fim (as duas mutações restauradas
com `git checkout --`, e a web reconstruída com o código do HEAD antes das fotos). Nenhum contêiner de pé no início: o ambiente de teste
subiu com `node tools/ci/e2e.ts --manter-ambiente` e ficou de pé. O `apps/web/dist`, apagado na queda do disco, foi refeito pelo próprio
comando. A 1ª tentativa desta rodada morreu às 17:18 com o disco e não deixou nada escrito; esta recomeçou do zero.

### 1. RF a RF (só o que esta rodada toca)

| RF | Situação | Código | Teste | Observação |
|---|---|---|---|---|
| RF11 Convite por e-mail, a borda "E-mail que volta": o painel oferece "Corrigir o e-mail" só a quem espera o convite | ATENDIDO | `apps/web/src/areas/coordenacao/professores/PainelDoProfessor.tsx:95` (`podeCorrigirOEmail(professor.estado)`) e `:162` (o botão, entre o "Reenviar" e o "Refazer convite"); `packages/shared/src/professores/professores.ts:150` (`CORRIGIR_EMAIL_DO_PROFESSOR_POR_ESTADO`: `corrigir` só em `pendente` e `vencido`, a mesma matriz do servidor) | `e2e/professores.spec.ts:50` (`ACOES_DO_ESTADO`: `pendente` e `vencido` com `['Corrigir o e-mail', 'Refazer convite', 'Revogar convite']`, os outros quatro vazios), lida em › W4 :327 "o erro com \"Tentar de novo\" traz a lista; com dado, pelo nome, o estado de cada convite e só as ações que ele permite" (`:372`, o conjunto exato dos seis estados), › "a linha inteira abre o painel, no endereço…" :1136 (`:1157` o conjunto do `vencido`, `:1161` o alvo de toque de cada ação, o novo incluído), › RF6 :1339 "o \"Copiar link\" do cadastrado pela planilha…" (`:1361`, o `pendente`); e › W12 :619 (`:688`, o alvo de toque do novo botão a 360 px) | Os três casos que a esteira 42883481508 pegou vermelhos e o W12 passaram, 8 de 8 nos dois projetos. As duas mutações abaixo provam os dois lados da regra: sem o botão, o `vencido` cai; com o botão em todo estado, o `aceito` cai. O comentário novo de `ACOES_DO_ESTADO` confere com o código: o "Reenviar" depende de envio (`envio-do-convite.ts:54`, `podeReenviar`), e o "Acrescentar turma" de estado alocável (`professores.ts:113`: `pendente`, `aceito`, `ativo`) e de turma e disciplina na escola (`PainelDoProfessor.tsx:102` a `:109`). Fotos: `.processo/vitrine/coordenacao--coordenacao-professores--Dora-convidado-4065ee92--computador.png` e `…--celular-1.png` (a Dora, `pendente` sem envio, numa escola com turma: "Corrigir o e-mail", "Refazer convite", "Revogar convite" e "Acrescentar turma" no fim, como o comentário diz; "Revogar" com a cor de perigo, os outros secundários); `coordenacao--coordenacao-professores--computador.png` (a lista: o `falhou` da Ana com "Não chegou. Corrija o e-mail e reenvie, ou copie o link"). Nenhuma tela rola a 1366 × 768. O rodapé em duas linhas desalinhadas no computador já está no `TODO.md` (frontend-reviewer, 1ª desta correção); não esconde nem embaralha ação |

Provas de mutação (cada uma aplicada, o caso rodado sozinho em `chromebook` com a web reconstruída, vermelho, e o arquivo restaurado com
`git checkout --`):

| RF | Cláusula removida | Teste que ficou vermelho |
|---|---|---|
| RF11 (borda) | o bloco `{corrigirOEmail && (<Button …>Corrigir o e-mail</Button>)}` de `PainelDoProfessor.tsx:162` | `e2e/professores.spec.ts:327` › W4 "…só as ações que ele permite", no `vencido` (`:372`: `- "Corrigir o e-mail"`, recebido sem ele) |
| RF11 (borda) | a matriz: `const corrigirOEmail = true \|\| podeCorrigirOEmail(professor.estado)` em `PainelDoProfessor.tsx:95` | o mesmo caso, no `aceito` (`:372`: esperado `[]`, recebido `["Corrigir o e-mail"]`) |

### 2. A correção contra o que ela diz

| Item | Situação | Evidência |
|---|---|---|
| Sintoma: os três casos de `professores.spec.ts` com o diff de `toHaveText` | resolvido | :327, :1136 e :1339 verdes em `chromebook` e `celular` (as linhas do documento, :322, :1130 e :1333, são as de antes do comentário novo) |
| "O caso `:1130` passa a medir o alvo de toque também do \"Corrigir o e-mail\"" | cumprido | sem linha nova: o `for` de `:1161` percorre `ACOES_DO_ESTADO.vencido`, e a constante nova o leva |
| Rodada 1: o caso do teclado no celular mede o novo botão | cumprido | `:688`, no W12, verde nos dois projetos |
| "Os quatro estados sem ação seguem vazios" | cumprido | `:372` com `[]` em `revogado`, `aceito`, `ativo` e `desativado`; a mutação 2 o prova |
| Outros e2e com a lista antiga | nenhum | `grep` em `e2e/`: só `professores-envio.spec.ts:456` lista botões do painel, por alvo de toque e não por conjunto exato, e o "Corrigir o e-mail" desse painel já é medido no bloco da 19.0 |
| Prazo do caso tocado | dentro | W12 em 33,1 e 34,0 s e o painel em 19,7 e 20,4 s, os dois com `test.slow()` (prazo 90 s, metade 45 s) |
| "Sem mutação" | justificado | o diff só toca `e2e/`, `TODO.md` e documentos; nenhum `apps/*/src` nem `packages/*/src` |

### 3. Portão

| Portão | Resultado |
|---|---|
| e2e da evidência (isolado) | ✅ `e2e/professores.spec.ts:327`, `:619`, `:1136` e `:1339`: 8 de 8, `chromebook` e `celular`; depois das mutações, `:327` de novo verde em `chromebook` com a web do HEAD |
| `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm run test:infra` inteiros | não rodados aqui (D79): esteira conferida no fechamento |
| Esteira do GitHub | conferida no fechamento pelo Orquestrador: não entra no veredito (o `estado.md` registra a 42893157881 caída por `npm ci` ECONNRESET no runner e o `rerun --failed` pedido) |
| Revisões com veto registradas e aprovadas | ✅ os sete obrigatórios do documento com rodada APROVADO: `tenancy-guardian`, `infra-guardian`, `frontend-reviewer`, `conformidade-reviewer` e `privacy-guardian` na 1ª; `test-engineer` e `revisor-geral` na 1ª e na 2ª |
| Commits | ✅ `83af4e44` marcado `(correção 2026-11-10-e2e-professores-corrigir-email)`; `6a559578` só `estado.md`; nenhum `Fora do processo:` em `origin/develop..HEAD` |

### 4. Achados

**Críticos**
- Nenhum.

**Maiores**
- Nenhum.

**Menores**
1. `e2e/professores.spec.ts:48`: o comentário de `ACOES_DO_ESTADO` diz que, com turmas na escola, "o `pendente` ganha esse botão no fim";
   o `aceito` e o `ativo` também o ganham (`professores.ts:113`), e a condição do "Reenviar" é "sem envio por e-mail", não "semeado pelo
   banco" (o `:1361` é o cadastrado pela planilha). Já no `TODO.md` (test-engineer e revisor-geral, 2ª). Dono: Implementador.
2. `tasks/correcoes/2026-11-10-e2e-professores-corrigir-email.md`, "Recomendações sem aplicar": a tabela só traz as da 1ª rodada; a da 2ª
   (o item 1 acima) foi ao `TODO.md` mas não ao documento. Nada se perdeu; a retro pode lembrar que a tabela leva toda rodada. Dono:
   retro de acesso-e-convites.
3. Ambiente: o ambiente de teste 0 ficou de pé (`--manter-ambiente`), com a vitrine montada. Dono: Orquestrador, ao usar o ambiente.

**Positivos**
- A correção tirou a lista dos botões de uma constante lida em três casos, e por isso uma linha só trouxe os três de volta, com o conjunto
  exato de cada estado; as duas mutações (sem o botão e com ele em todo estado) ficaram vermelhas no mesmo caso.

### 5. Conclusão

A correção faz o que diz: os três casos que a esteira pegou voltaram ao verde, nos dois projetos, e continuam afirmando o conjunto exato
de botões de cada estado, o que as duas mutações provam (o `vencido` sem o botão e o `aceito` com ele ficam vermelhos). O comentário novo
confere com o código, com a imprecisão já levada ao `TODO.md`. A tela não mudou desde a rodada 2, e as fotos de agora mostram o rodapé do
`pendente` na ordem que a constante afirma. Sem crítico nem maior, a funcionalidade segue APROVADA; falta só a esteira verde em
`83af4e44`, que o Orquestrador confere no fechamento.

### 6. Pendências herdadas

- Os menores 1 a 3 acima, com o dono de cada um; o 1 já está no `TODO.md`.
- O que as rodadas 1 e 2 deixaram para o fechamento e a retro segue como elas escreveram.

## Rodada 2 — 10/11/2026

**Escopo:** revalidação dos itens da rodada 1 que reprovaram: o crítico 1 (o [C] da fase `professores`), com a correção
`tasks/correcoes/2026-11-10-carga-professores.md`, e o maior 1 (a borda "E-mail que volta"), com as tarefas 18.0 e 19.0. O resto da
rodada 1 não foi refeito, como ela mesma pediu.
**Commit validado:** `8811171c`
**Veredito: APROVADA**

Ambiente: `node_modules` em dia com o `package-lock.json` (sem `npm ci`). Árvore limpa no início e no fim (as três mutações foram
restauradas com `git checkout --`). Integração e e2e no ambiente de teste 0; a vitrine da rodada 1 seguia montada (`mostrar`), com os
quatro professores semeados nela. Para a carga parei todos os contêineres `educa-teste-*`, os do ambiente 0 e os dos ambientes 1 e 2
das linhas, que estavam paradas (`.processo/linhas.json`: as três com `tarefa: null`); os volumes ficam (menor 3).

### 1. RF a RF (só o que esta rodada toca)

| RF | Situação | Código | Teste | Observação |
|---|---|---|---|---|
| RF11 Convite por e-mail, borda "E-mail que volta" (o maior 1) | ATENDIDO | `apps/api/src/professores/professores.controller.ts:65` (`POST /v1/professores/:usuarioId/email`, `no-store`, `IdPipe`, estrito); `apps/api/src/sessao/convite/convite-de-professor.service.ts:96` (`corrigirEmailDoProfessor`: os seis passos da Tech Spec §5 na ordem, numa transação: `professorSobATrava`, a matriz, `jaEntrou`, `contaDoProfessor`, `trocarContaDoProfessor`, `refazerSobATrava`, `usuario.email_corrigido`); `apps/api/src/sessao/convite/convite.repository.ts:143` (`jaEntrou`) e `:156` (`trocarContaDoProfessor`: escola do contexto, `papel = 'professor'`, `desativado_em` não nulo, conta diferente); `packages/shared/src/professores/professores.ts` (`corrigirEmailDoProfessorRequestSchema`, `CORRIGIR_EMAIL_DO_PROFESSOR_POR_ESTADO`); `apps/web/src/areas/coordenacao/professores/PainelDoProfessor.tsx:162` (o botão só no `pendente` e no `vencido`), `DialogoDeCorrigirEmail.tsx`, `convite-de-professor.ts` (`podeCorrigirOEmail`, `falhaDaCorrecaoDoEmail`), `envio-do-convite.ts:17` ("Não chegou. Corrija o e-mail e reenvie, ou copie o link") | `apps/api/test/professores-corrigir-email.int.test.ts` (25 casos: "caminho feliz: o professor da grade, com o envio `falhou`, fica com o mesmo id, o vínculo e a aula…"; "token: o link do convite anterior é recusado…"; "`vencido`: corrige, e o convite novo vale os 7 dias…"; "envio antigo: o `na_fila` e o `enviando` terminam `cancelado`…"; "\"Enviar\" de um só logo depois: o destino decifrado é o e-mail novo…"; "estados fora" ×4; "quem já entrou…"; "e-mail de outro professor da escola…"; "o mesmo e-mail de hoje…"; "E11…"; "isolamento…"; "repository…"; as três corridas); `e2e/professores-envio.spec.ts` › "o envio falhou: a coordenação corrige o e-mail, envia pelo \"Reenviar\", o e-mail chega ao endereço certo, o professor aceita e vê a turma da grade" (Mailpit e worker de verdade; o e-mail velho não recebe nada), › "o e-mail de outro professor da escola não serve…", › "a resposta atrasada de uma correção…", › "a 1366 × 768 a página não rola e a 360 px não rola de lado, no painel e no diálogo…"; unidade: `DialogoDeCorrigirEmail.test.tsx`, `PainelDoProfessor.test.tsx`, `convite-de-professor.test.ts`, `envio-do-convite.test.ts`, `api/professores.test.ts` | As três partes da borda têm evidência: "corrigir e reenviar" (o e2e de ponta a ponta), "mantém o professor, as turmas e as aulas" (o mesmo id, o vínculo e a aula na mesma linha, na integração; o professor vê a turma da grade, no e2e) e "só para quem nunca entrou" (o caso "quem já entrou", mutação 2). Fotos: `.processo/vitrine/coordenacao--coordenacao-professores--Ana-convidado-ab26e454--computador.png` e `…--celular-1.png` (o painel do `falhou`, com o texto novo e "Corrigir o e-mail" no rodapé, secundário); `…--Ana-convidado-ab26e454-button-name-Corrigir-o-e-mail--computador.png` e `…--celular-1.png` (o diálogo com o nome, "O professor continua o mesmo, com as turmas e as aulas dele", o campo "E-mail certo" vazio e com o foco, e "O link anterior deixa de valer"). Nenhuma tela rola a 1366 × 768. O link uma vez e o `CONFLITO` pedem digitar, o que a vitrine não faz: conferidos pelo e2e e pela unidade, que olham o texto, o foco e o link. O rodapé a 360 px empilha cinco botões à direita, com larguras diferentes: já no `TODO.md` (19.0, `frontend-reviewer`, dono a tarefa do `Sheet`); não esconde nem embaralha a ação |
| RF16 Isolamento (a rota nova) | ATENDIDO | `convite.repository.ts:143` e `:156` (as duas consultas novas com `requireEscolaId()`); a rota passa antes pelo `professorSobATrava` da escola da sessão | `professores-corrigir-email.int.test.ts` › "isolamento: o id da outra escola, o de aluno, o de coordenador e o inexistente respondem o mesmo NAO_ENCONTRADO, sem conta criada e sem `update` no usuário da B"; › "repository: `jaEntrou` e `trocarContaDoProfessor` só alcançam a escola do contexto…"; › "permissão: o professor e o aluno são recusados como o inexistente…"; `packages/shared/src/permissao/matriz.test.ts` (só a coordenação) | Mutação 1 vermelha. Como na provisória da rodada 1, a defesa tem duas camadas: sem a escola no `update`, a rota seguiria 404 pela trava do `professorSobATrava`; quem pega a remoção é o caso do repository |
| RF17 Auditoria e arquivo do titular (a ação nova) | ATENDIDO | `packages/core/src/auditoria/acoes.ts:473` (`usuario.email_corrigido`: entidade `usuario`, sem `antes`, `depois` nem finalidade); `packages/core/src/auditoria/acoes-por-alvo.ts:12` (a sétima ação por alvo); `packages/core/drizzle/0048_auditoria_por_alvo_email.sql` (o índice parcial recriado com as sete); `packages/core/src/titular/leitura-do-titular.ts` (papel fixo "coordenação") | `professores-corrigir-email.int.test.ts` › "auditoria: um `usuario.email_corrigido` e um `convite.refeito`, autora a coordenação, sem e-mail, sem id de conta e sem nome", › "arquivo do professor: o ato chega com o papel \"coordenação\", sem o autor…", › "log novo: a rota só leva ids e código…"; `apps/api/test/arquivo-do-titular.int.test.ts:952` › "D85: usuario.email_corrigido (18.0) aparece no arquivo do professor… e não no de outro professor"; `packages/core/src/db/schema/auditoria-por-alvo.int.test.ts` (o índice com as sete) | Mutação 3 vermelha em dois casos. O PRD (RF17) ganhou "e-mail do professor corrigido" e "nem e-mail" na mesma triagem do Arquiteto (`9741b5f5`), com a escolha do Joaquim registrada |

Provas de mutação (cada uma aplicada, o teste rodado sozinho, vermelho, e o arquivo restaurado com `git checkout --`):

| RF | Cláusula removida | Teste que ficou vermelho |
|---|---|---|
| RF16 | `eq(usuario.escolaId, requireEscolaId())` no `update` de `trocarContaDoProfessor` (`apps/api/src/sessao/convite/convite.repository.ts:158`) | `professores-corrigir-email.int.test.ts` › "repository: `jaEntrou` e `trocarContaDoProfessor` só alcançam a escola do contexto…" (`expected true to be false`) |
| RF11 (borda) | `if (await convites.jaEntrou(usuarioId)) throw new DomainException(ErrorCode.CONFLITO)` (`convite-de-professor.service.ts:103`) | › "quem já entrou: o professor desligado e chamado de volta… é CONFLITO, e o `contaId` fica" (`expected { status: 201 … } to deeply equal { status: 409 … }`) |
| RF17 (D85) | `'usuario.email_corrigido'` de `ACOES_DO_USUARIO_POR_ALVO` (`packages/core/src/auditoria/acoes-por-alvo.ts:12`) | › "arquivo do professor: o ato chega com o papel \"coordenação\"…" e `arquivo-do-titular.int.test.ts` › "D85: usuario.email_corrigido (18.0) aparece no arquivo do professor…" (`expected [] to deeply equal [ { … } ]`) |

### 2. Os dois itens da rodada 1

| Item | Situação | Evidência |
|---|---|---|
| Crítico 1: o [C] da fase `professores` (Tech Spec 7c: zero 503 no login e no redefinir, todo redefinir em 204, passo (3) abaixo de 1 s) | **cumprido** | Duas rodadas de `npm run carga:importacao -- --fases professores` no commit validado, nas três condições de `docs/runbook.md:1202` ("Quando a carga vale como registro"), com o hash medido antes e depois e o `cpu.stat` das duas APIs amostrado a cada 5 s (a evidência bruta ficou na área temporária da sessão; os números estão aqui). **R1 (19:22–19:28 UTC):** `docker ps` vazio, nenhum vitest, Playwright, k6 ou portão de pé, load de 1 min 1,89 antes; hash (mediana / p90 / máx.) 29,6 / 35,7 / 41,5 ms antes e 34,2 / 82,0 / 102,1 ms depois; throttling `api-1` 309/3.258 (9,5%), `api-2` 351/3.266 (10,7%); load máximo durante, 4,44. **Passou:** zero 503 e zero 5xx nas rotas do cenário, redefinir 90 de 90 (`redefinicoes_feitas count==90`, nenhum 400/401/403/404/409/429), passo (3) 11 de 11 até 1 s (9 até 0,25 s), rajada `login_duracao{grupo:rajada}` p95 **176 ms** (máx. 661), login dos professores p95 232 ms, redefinir p95 295 ms. **R2 (19:28–19:35 UTC):** as mesmas condições, load 1,87 antes; hash 30,3 / 33,8 / 37,2 ms antes e 35,0 / 40,4 / 43,2 ms depois (no teto de ~35 ms, dentro); throttling `api-1` 308/3.225 (9,6%), `api-2` 309/3.273 (9,4%); load máximo durante, 3,12. **Passou:** zero 503 e zero 5xx, redefinir 90 de 90 (nenhum 400/401/403/404/409/429), passo (3) 11 de 11 até 1 s (9 até 0,25 s), rajada p95 **135 ms** (máx. 559), login dos professores p95 170 ms, redefinir p95 279 ms. O throttling das duas (9,4% a 10,7%) não passa da faixa que o runbook registra para esta fase (9,7% a 11,0%) |
| Crítico 1, a causa da 1ª corrida da rodada 1 | **não provada, e dita assim** | O hash não foi medido naquela corrida, e nada do que ela anotou separa o host do produto. O que existe: cinco rodadas verdes da fase com o hash bom nas duas pontas (`prof1`, `prof2` e `estresse6` da correção, e as duas acima), com a rajada entre 135 e 210 ms contra o teto de 1.000 ms; e a única reprodução da assinatura (503 só em `/v1/sessao/matricula`, rajada acima de 1 s) veio com o hash a 68 ms, com 16 laços disputando 12 núcleos (`estresse16` da correção). Pelo runbook, aquela corrida não cumpria a condição 1 (o ambiente do e2e estava de pé) e por isso é medição, não defeito; ela fica escrita na rodada 1 e não se apaga. O que a correção deu ao processo é o que faltava: o próximo vermelho se separa do host pela medida do hash |
| Crítico 1, (b) a rajada sozinha contra a rajada ao lado da fase | cumprido (pela correção) | `rajada1` da correção: a rajada sozinha, p95 102 ms e zero 503; ao lado da fase, 167 e 187 ms na correção e 135 e 176 ms aqui. A soma custa e não estoura |
| Crítico 1, (c) a condição de máquina e o registro | cumprido | `docs/runbook.md:1202`, com o comando dos 20 hashes, o teto da mediana, o throttling e a regra de repetir uma vez; os ponteiros nos "Se reprovar" do login e da importação; `tasks/prd-acesso-e-convites/10_task.md:70` com a execução que faltava; o hash e as duas fases na VPS de produção no `TODO.md`, dono o Joaquim, antes do piloto |
| Maior 1: a borda "E-mail que volta" | cumprido | RF11 acima: opção (b) do Joaquim (10/11), desenhada pelo Arquiteto na Tech Spec §5 "Corrigir o e-mail", §9 e §11 (linha "PRD, \"E-mail que volta\""), no PRD (a borda e o RF17), no `cenarios.md` ("Corrigir o e-mail"), no `docs/interface.md` (Professores, item (4)), no `docs/lgpd.md` e no `docs/modelo-de-dados.md`; implementada pela 18.0 e pela 19.0. O texto antigo do `falhou` não sobra em `apps/web/src`, `e2e/` nem `docs/` |

### 3. Portão

| Portão | Resultado |
|---|---|
| Testes de evidência, integração (isolados) | ✅ `apps/api/test/professores-corrigir-email.int.test.ts`: 25 de 25; `apps/api/test/arquivo-do-titular.int.test.ts` e `packages/core/src/db/schema/auditoria-por-alvo.int.test.ts`: 62 de 62 |
| Testes de evidência, unidade (isolados) | ✅ `packages/shared/src/permissao/matriz.test.ts`, `packages/core/src/titular/leitura-do-titular.test.ts` e `apps/web/src/areas/coordenacao/professores/`: 11 arquivos, 232 casos |
| e2e da tela (isolado) | ✅ `e2e/professores-envio.spec.ts`: 30 de 30, `chromebook` e `celular` (os quatro casos novos do "Corrigir o e-mail" nos dois projetos, de 3,9 a 10,3 s) |
| Carga [C] `npm run carga:importacao -- --fases professores` | ✅ duas rodadas nas condições do runbook (seção 2) |
| `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm run test:infra` inteiros | não rodados aqui (D79): esteira conferida no fechamento |
| Esteira do GitHub | conferida no fechamento pelo Orquestrador: não entra no veredito |
| Revisões com veto registradas e aprovadas | ✅ 18.0: os seis revisores com rodada 2 APROVADO (os quatro obrigatórios, `revisor-geral` e `conformidade-reviewer`); 19.0: `frontend-reviewer`, `privacy-guardian`, `tenancy-guardian`, `conformidade-reviewer` e `infra-guardian` APROVADO na 1ª, `test-engineer` REPROVADO na 1ª e APROVADO na 2ª, `revisor-geral` APROVADO nas duas; correção `carga-professores`: `infra-guardian`, `test-engineer` e `revisor-geral` APROVADO na 3ª (o `revisor-geral` reprovou a 2ª) |

### 4. Achados

**Críticos**
- Nenhum.

**Maiores**
- Nenhum novo. O maior 2 da rodada 1 (o template da tarefa exigir a linha do resultado de todo [C]) segue com destino na retro, fora do escopo desta rodada.

**Menores**
1. `tasks/prd-acesso-e-convites/techspec.md:145` ("Corrigir o e-mail"): o desenho novo entrou na Tech Spec pela triagem do Arquiteto (`9741b5f5`) sem uma rodada de `revisar-spec`; os guardiões o leram só pela 18.0 (seis APROVADO na 2ª). O processo não pede `revisar-spec` para triagem de validação, e nada se perdeu aqui; vale a retro decidir se desenho novo com rota e migration pede a rodada da spec. Dono: retro de acesso-e-convites.
2. `apps/web/src/areas/coordenacao/professores/envio-do-convite.ts:54` (`podeReenviar`): depois do "Corrigir o e-mail" o convite é `copiado` (envio nulo) e o "Reenviar" some do painel. Quem fecha o diálogo sem "Enviar por e-mail" só manda o e-mail a esse professor pelo "Enviar convites", que vai a todos os que esperam e refaz os links deles. Não quebra a borda (o diálogo oferece os dois caminhos na hora, e o e2e o anda), e o professor `copiado` já era assim antes. Dono: Arquiteto, na próxima mexida em Professores (`TODO.md`).
3. Ambiente: para a carga parei os contêineres `educa-teste-*` dos ambientes 0, 1 e 2 (volumes mantidos). O próximo `node tools/ci/e2e.ts --manter-ambiente`, portão ou teste de integração os sobe de novo; `node tools/vitrine/vitrine.ts mostrar` só responde com a web de pé. Dono: Orquestrador, ao usar o ambiente.
4. As recomendações sem aplicar da correção `carga-professores` (os scripts de carga medirem o hash e o throttling e recusarem o registro sozinhos; o laço de hashes durante a repetição) estão com destino o Arquiteto, por decisão do Orquestrador, e não estão no `TODO.md`. Dono: Orquestrador, no fechamento, para não se perderem.

**Positivos**
- A correção da carga disse o que não sabia ("a causa da validação é a melhor hipótese, não um fato") em vez de arredondar, e trocou o palpite por uma medida que o próximo a rodar repete.
- O "Corrigir o e-mail" mantém o mesmo `usuario`, e por isso o vínculo e a aula que a grade deu ao professor sobrevivem sem migração de dado: a integração prova a mesma linha, e o e2e prova o professor vendo a turma.

### 5. Conclusão

Os dois itens que reprovaram a rodada 1 estão fechados. O [C] da fase `professores` passou duas vezes no commit validado, nas condições
que o runbook agora escreve, com o hash medido nas duas pontas e o throttling na faixa da fase: zero 503 no login e no redefinir, 90
de 90 redefinir, passo (3) 11 de 11 até 1 s e a rajada a 135 e 176 ms contra o teto de 1.000. A causa do vermelho da 1ª corrida da
rodada 1 não está provada, e este relatório não a dá por provada: aquela corrida não cumpria a condição de máquina, fica escrita, e
o critério para separar o host do produto passou a existir. A borda "E-mail que volta" ganhou o caminho que faltava, com as três
partes do texto do PRD provadas por integração e e2e, três mutações vermelhas nos pontos de risco (o escopo da troca, quem já entrou
e o arquivo do titular) e a tela vista nas fotos.

Com os sete RF da rodada 1 atendidos e o que esta rodada tocou atendido, sem crítico nem maior novo e nenhum teste vermelho entre os
que rodei, o veredito é APROVADA. Os menores vão ao `TODO.md` no fechamento, e o maior 2 da rodada 1 à retro.

### 6. Pendências herdadas

| Pendência | Destino |
|---|---|
| O "Corrigir o e-mail" com o e-mail de um coordenador da mesma escola liga o professor à conta dele, e o `CONFLITO` deixa a coordenação saber se um e-mail é de professor da escola | `TODO.md` (18.0, `tenancy-guardian`; 19.0, `privacy-guardian`), dono o Joaquim, decisão de produto |
| O texto do e-mail que não serve fica no campo enquanto a pessoa digita outro | `TODO.md` (19.0, `revisor-geral`), dono o Joaquim |
| Hash `t=12`, rajada e fase `professores` na VPS de produção (D82), antes do piloto | `TODO.md`, dono o Joaquim |
| O template da tarefa exigir a linha do resultado de todo [C] (maior 2 da rodada 1) | retro de acesso-e-convites |
| As pendências da seção 6 da rodada 1 | como lá |
| Menores 1 a 4 desta rodada | `TODO.md` (o 1 à retro), pelo Orquestrador no fechamento |

Fora do escopo desta rodada, pelo prompt: a correção `2026-11-10-alertas-503` (`f7904bfc`, `infra/scripts/ensaio-alertas.ts` e
`infra/test/alertas*.ts`), que entrou depois da rodada 1; as quatro revisões obrigatórias dela têm rodada APROVADO. Commits fora do
processo: nenhum (`git log origin/develop..HEAD -i --grep='^Fora do processo:'` não devolve nada); todo commit com código desde a
rodada 1 tem `(tarefa N.0)`, `(correção <slug>)` ou é merge de linha.

## Rodada 1 — 10/11/2026

**Escopo:** funcionalidade completa
**Commit validado:** `87f87836`
**Veredito: REPROVADA**

Ambiente: banco de teste recriado (`EDUCA_BANCO_NOVO=1`) antes do primeiro migrar, pelo e2e de `professores-envio.spec.ts`
com `--manter-ambiente`; vitrine montada de novo depois dele. `node_modules` em dia com o `package-lock.json` (sem `npm ci`).
Árvore limpa no início e no fim (as três mutações foram restauradas com `git checkout --`).

### 1. RF a RF

| RF | Situação | Código | Teste | Observação |
|---|---|---|---|---|
| RF11 Convite por e-mail | ATENDIDO | `apps/api/src/sessao/convite/convite-de-professor.service.ts:139` (`enviarConvitesDeProfessores`: filtro pela matriz do refazer, cota de 300/h atômica, refazer com cifrados, job, `convite.enviado`); `apps/worker/src/processors/enviar-email.ts` (reserva, envio fora da transação, `enviado` só com a minha reserva, 4xx/5xx); `packages/core/src/email/mensagem-do-convite.ts:19` (escola e link, token depois do `#`, nenhum nome); `packages/core/src/convite/cancelar-envio.ts`; `apps/web/src/areas/coordenacao/professores/envio-do-convite.ts:32` (rótulo) | `apps/api/test/convites-enviar.int.test.ts` ("40 pendentes: os 40 ficam `na_fila`, a resposta volta sem esperar nenhum envio"; "\"Copiar link\" depois do \"Enviar\": … o link antigo é recusado"; "\"Enviar\" e \"Reenviar\" sobre convite copiado de 2 dias: id novo, token copiado recusado"; "seleção que mistura pendente, vencido, revogado…"); `apps/worker/test/enviar-email.int.test.ts` ("leva a escola e o link com o token depois do `#`, nenhum nome…"; "[P] duas execuções ao mesmo tempo…"; "5xx: … `falhou`"); `apps/worker/test/enviar-email-adiamento.int.test.ts`; `e2e/professores-envio.spec.ts` ("o professor abre o link do e-mail, cria a senha e aceita", pelo Mailpit e pelo worker de verdade) | Fotos: `.processo/vitrine/coordenacao--coordenacao-professores--computador.png` (os quatro rótulos: "Não chegou. Confira o e-mail e reenvie, ou copie o link", "Enviado em 12/11 às 14:05", "Enviando", e o pendente sem envio), `…--celular-1.png`, `…--button-name-Enviar-convites--celular-1.png` (o diálogo diz "a 4 professores" e que os links anteriores deixam de valer). A vitrine não tinha professor pendente: semeei quatro no banco de teste com `convidarProfessorNoBanco` e `definirOEnvioDoConvite` do `e2e/support/seed.ts`. Nenhuma tela rola a 1366 × 768. A borda "E-mail que volta" tem uma parte sem caminho (achado maior 1) |
| RF12 Esqueci a senha | ATENDIDO | `apps/api/src/sessao/senha/senha.service.ts` (`esqueci`: os dois contadores antes de olhar a conta, piso de 400 ms; `redefinir`: token antes do argon2, conta travada, `usado_em is null`, sessões encerradas com `senha_redefinida`, MFA intocado, `emailVerificadoEm`); `packages/core/src/email/mensagem-do-link-da-conta.ts` (1 hora, token no fragmento) | `apps/api/test/senha-esqueci.int.test.ts` ("e-mail com conta e e-mail sem conta: a mesma resposta, o mesmo piso de 400 ms, e o log só com ids"; "o link vencido, o usado e o substituído dão a mesma resposta…"; "troca a senha, derruba as sessões da conta em todas as escolas e o MFA segue; o link não serve duas vezes"; "o MFA segue exigido: entrar com a senha nova pede o segundo fator"; "dois \"redefinir\" com o mesmo token… um só troca"); `e2e/esqueci-a-senha.spec.ts` ("esqueci → e-mail → senha nova: volta à entrada com o aviso, sem login automático e sem sessão aberta") | Fotos: `.processo/vitrine/aluno--esqueci--computador.png`, `aluno--esqueci--celular.png` (a linha "Aluno: peça a senha provisória ao professor"), `aluno--redefinir--computador.png`, `aluno--redefinir--celular.png`, `aluno--verificar--celular.png` (link que não vale, com o próximo passo) |
| RF13 Senha provisória | ATENDIDO | `apps/api/src/credencial/senha-provisoria.service.ts:118` (`gerar`: conferência sem trava, hash pelo semáforo, transação com a trava da linha, `CONFLITO` em 10 s, cotas depois do escopo, sessões encerradas, `.gerada` com o papel); `apps/api/src/credencial/credencial-matricula.repository.ts:198` (`#condicoesDoAlcance`, a mesma seleção na leitura do alvo, na conferência e na trava) e `:264` (`#aTurmaEDoProfessor`); `:130` (`trocarProvisoria`: `update` condicionado ao vencimento do bilhete, `clock_timestamp()`, aluno ativo); `apps/api/src/credencial/bilhete-da-troca.ts`; `packages/core/src/auditoria/auditoria.repository.ts` (`provisoriasAnterioresDoAluno`) | `apps/api/test/senha-provisoria.int.test.ts` ("professor com vínculo pendente, contestado ou encerrado na turma, e professor de outra turma: 404 igual ao inexistente"; "isolamento: a coordenação e o professor da escola A não alcançam o aluno da escola B"; "gerar derruba a senha, a provisória anterior … e as sessões do aluno"; "aluno só com a conta ligada …: `ENTRA_PELA_CONTA_DA_ESCOLA`"; "uma provisória não usada de menos de 10 s … é `CONFLITO`"); `apps/api/test/troca-da-provisoria.int.test.ts` ("devolve o bilhete e nenhuma sessão"; "[P] duas trocas com o mesmo bilhete… uma grava"; "a provisória vence em 24 h"; "lista as geradas antes da de agora…"); `e2e/senha-provisoria.spec.ts`, `e2e/troca-da-provisoria.spec.ts` ("provisória → troca → entra") | Mutações 1 e 2 vermelhas (abaixo). Fotos: `.processo/vitrine/professora--professor-turmas-01a1c5fc-44ab-7f6d-81f2-cae364593c70--button-name-Ações-Gerar-senha-provisória--computador.png` e `…--celular.png` (nome, turma, matrícula e a consequência antes de gerar), `…-dialog-role-button-name-Gerar-senha-provisória--celular.png` (a senha em dois grupos, "Copiar" e a validade), `coordenacao--coordenacao-estrutura-turmas-01a1c5fc-…--button-name-Mostrar-alunos-aprovados--computador.png` e `…--celular-2.png` (a seção "Alunos aprovados" com o menu "Ações"). A tela de troca, que a vitrine não alcança (pede o bilhete), fotografei com um script Playwright do scratchpad entrando com a provisória gerada pela tela, digitada em minúsculas e com hífen: `troca-computador.png` e `troca-celular.png` ("É a primeira vez que você troca a senha", sem tabela; sem rolagem horizontal a 360 px). A troca, com a senha original do aluno da vitrine, levou a `/aluno/inicio`: a vitrine ficou como estava |
| RF14 Conta da escola do aluno | ATENDIDO | `apps/api/src/sessao/external/external-login.service.ts` (`intencao=reivindicar` e `ligar`, `educa_conta_provada`, `max_age=0` e `prompt` só no ligar, `auth_time` de até 120 s); `apps/api/src/sessao/external/cookie-oidc.ts`; `apps/api/src/sala/reivindicacao/reivindicacao.service.ts` (pedido sem senha grava `contaExterna`, sem hash); `packages/core/src/estrutura/decisao.repository.ts` (aprovação liga a conta; conta já ligada: `CONFLITO`, a transação desfaz); `packages/core/drizzle/0047_reivindicacao_conta.sql` (único parcial e o check) | `apps/api/test/reivindicacao-com-conta.int.test.ts` ("pedido pendente: o login pela conta é a credencial inválida (recusa)…; aprovar liga, o aluno entra pela conta"; "aprovar com a conta já ligada a outro aluno …: CONFLITO sem nome nem id"; "o banco não guarda e-mail, nome nem foto do provedor"); `apps/api/test/ligar-conta.int.test.ts` ("o aluno que entrou por matrícula liga a conta, e passa a entrar por ela"; "a conta ligada a outro aluno: `conflito` sem nome nem id"; "o aluno que já tem uma conta ligada tenta ligar outra: `conflito`"); `e2e/conta-da-escola-na-sala.spec.ts` ("aprovado o pedido de conta, o aluno entra pela conta da escola, sem matrícula nem senha"); `e2e/conta-da-escola-no-eu.spec.ts` | Fotos: `.processo/vitrine/aluno--aluno-eu--computador.png` e `…--celular.png` (a seção "Conta da escola" com "Ligar a conta da escola"), `aluno--e-e2e-226df41a-1a1b-421d-9192-31f5692be2dc-turma--computador.png` e `…--celular.png` ("Tem a conta da escola?" com "Entrar com a conta da escola"). A página pública da sala rola a 1366 × 768 (970 px): nenhum RF pede que ela caiba, e o que se vê está inteiro (menor 4) |
| RF16 Isolamento e ano em curso | ATENDIDO | escopo no repository em todas as leituras novas (`credencial-matricula.repository.ts`, `convite.repository.ts`, `envio.repository.ts`, `auditoria.repository.ts`, `leitura-do-titular.ts`); `link_da_conta` sem escola, cercado (`ZONAS_DAS_CLASSES_CERCADAS`, `cerca-envio`), com o desvio registrado na Tech Spec §11 e em `docs/modelo-de-dados.md:43` | `convites-enviar.int.test.ts` ("isolamento: os `usuarioIds` da escola B são tratados como inexistentes…"); `senha-provisoria.int.test.ts` ("escopo: quem não alcança o aluno recebe o 404 do inexistente, com o mesmo corpo…"); `troca-da-provisoria.int.test.ts` ("com o contexto da escola A, a credencial e a auditoria do aluno da B: a troca atualiza zero linhas…"); `ligar-conta.int.test.ts` ("isolamento: a mesma conta do provedor liga em duas escolas…"); `enviar-email.int.test.ts` ("o id do convite da escola B num job da escola A: nada é enviado") | Mutação 2 vermelha: sem a escola no escopo, a coordenação da A leria o aluno da B na confirmação. A geração seguiu 404 pelas cláusulas de escola de `estadoDaProvisoria` e `gravarProvisoria`: a defesa tem duas camadas |
| RF17 Auditoria e arquivo do titular (D85) | ATENDIDO | `packages/core/src/auditoria/acoes.ts` (`convite.enviado`, `senha.redefinida`, `conta.email_verificado`, `senha_provisoria.gerada`/`.usada`/`.alvo_lido` com `depois` estrito, sem nome nem matrícula; `conta_externa.ligada`); `packages/core/src/auditoria/acoes-por-alvo.ts` (a lista fechada de seis); `packages/core/src/titular/leitura-do-titular.ts:427-447` (leitura por alvo só com o papel) | `convites-enviar.int.test.ts` ("`convite.enviado`: um registro por convite novo, com a coordenação como autora…"); `senha-esqueci.int.test.ts` ("grava `senha.redefinida` em cada escola com usuário ativo…"); `posse-do-email.int.test.ts` ("`conta.email_verificado` pelo verificar: um por escola…"); `troca-da-provisoria.int.test.ts` ("senha_provisoria.usada: um registro, com o aluno por autor e por alvo"); `reivindicacao-com-conta.int.test.ts` ("conta_externa.ligada: um registro na aprovação, de quem decidiu"); `apps/api/test/arquivo-do-titular.int.test.ts` (os seis "D85: <ação> aparece no arquivo do alvo com o papel de quem fez, sem o autor, o antes nem o depois, e não no de outro aluno") | Mutação 3 vermelha em sete casos |
| RF18 e2e da entrada | ATENDIDO | — | `e2e/professores-envio.spec.ts`, `esqueci-a-senha.spec.ts`, `verificar-email.spec.ts`, `conta-da-escola-na-sala.spec.ts`, `senha-provisoria.spec.ts`, `troca-da-provisoria.spec.ts`, `conta-da-escola-no-eu.spec.ts`: **198 de 198** nos projetos `chromebook` e `celular` (22 + 176), com axe, 360 px sem rolagem horizontal e os alvos de 44 e 24 px | Os quatro caminhos do PRD estão pela tela: convites pelo Mailpit → aceite; esqueci → redefinir; reivindicação pela conta (`oidc-falso`) → aprovação → entrada pela conta; provisória → troca → entra |

Provas de mutação (cada uma aplicada, o teste rodado sozinho, vermelho, e o arquivo restaurado com `git checkout --`):

| RF | Cláusula removida | Teste que ficou vermelho |
|---|---|---|
| RF13 | `eq(doProfessor.usuarioId, professorId)` em `apps/api/src/credencial/credencial-matricula.repository.ts:284` (o vínculo da turma ser do professor da sessão) | `senha-provisoria.int.test.ts` › "professor com vínculo pendente, contestado ou encerrado na turma, e professor de outra turma: 404…" (`pendente: expected { status: 200 } to deeply equal { status: 404 }`) |
| RF16 | `eq(usuario.escolaId, escolaId)` em `credencial-matricula.repository.ts:202` (`#condicoesDoAlcance`) | `senha-provisoria.int.test.ts` › "escopo: quem não alcança o aluno recebe o 404 do inexistente…" (`B pelo contexto da A (coordenação): expected { status: 200 } to deeply equal { status: 404 }`) |
| RF17 (D85) | `and t.entidade_id = ${titularId}` em `packages/core/src/titular/leitura-do-titular.ts:439` | `arquivo-do-titular.int.test.ts`: os seis "D85: <ação> aparece no arquivo do alvo … e não no de outro aluno" e "a senha_provisoria.gerada feita pelo professor mostra \"professor\"…" |

### 2. Regras de negócio, casos de borda e critério de pronto

| Item | Situação | Evidência |
|---|---|---|
| Regra: a provisória não se vê de novo e não vira a senha do aluno | cumprida | só a resposta da geração a traz, com `no-store` (`senha-provisoria.int.test.ts` › "`no-store` na resposta; a senha não aparece na lista de alunos da turma, na credencial nem na auditoria"); a leitura do alvo nunca a traz ("depois de gerada, a leitura segue sem trazer a senha…"); o login com ela devolve só o bilhete, e a troca exige a senha nova (`troca-da-provisoria.int.test.ts` › "devolve o bilhete e nenhuma sessão…") |
| Regra: e-mail só à equipe, sem dado de aluno | cumprida | não há caminho de e-mail a aluno: o convite é só de professor e o link da conta é da `conta` da equipe; `mensagem-do-convite.ts` e `mensagem-do-link-da-conta.ts` não recebem nome; `enviar-email.int.test.ts` › "leva a escola e o link…, nenhum nome de usuário da escola" |
| Regra: conta da escola do aluno só se liga com aprovação humana (D4) | cumprida | o pedido guarda a conta no lugar do hash e o login pela conta é recusado até a aprovação (`reivindicacao-com-conta.int.test.ts` › "pedido pendente: o login pela conta é a credencial inválida…"); o "ligar" em "Eu" exige a sessão do próprio aluno já aprovado e a prova de novo no provedor (`ligar-conta.int.test.ts` › "o `iniciar` da ligação leva `max_age=0` e o `prompt`…") |
| Borda: e-mail que volta | coberta em parte | "Falhou" na lista (`convites-enviar.int.test.ts` › "depois de o envio falhar (5xx, ou 4xx esgotado), o professor continua pendente e a lista mostra `falhou`"; foto acima); "reenviar" e "copiar o link" existem e estão no e2e. A devolução tardia está justificada na Tech Spec §11 (webhook no `TODO.md`). **"Corrigir" o e-mail não tem caminho nem justificativa** (achado maior 1) |
| Borda: aluno com conta da escola pede senha provisória | coberta | `ENTRA_PELA_CONTA_DA_ESCOLA` na leitura do alvo e na geração; `e2e/senha-provisoria.spec.ts` › "o aluno que entra pela conta da escola: o aviso já na confirmação, sem \"Gerar\", e nenhuma geração" |
| Borda: conta de link copiado aceita convite de outra escola | coberta | `posse-do-email.int.test.ts` › "conta com senha e sem posse: `VERIFICACAO_PENDENTE`…" e "depois de verificar, o aceite segue"; `e2e/verificar-email.spec.ts` |
| Borda: professor cadastrado pela grade ou pela planilha (F2) | coberta | todo convite nasce pelo mesmo insert do core (`packages/core/src/convite/convite-da-escola.repository.ts:71`), com `canal = 'copiado'`; o "Enviar" sem seleção inclui o copiado (`convites-enviar.int.test.ts` › "\"Enviar\" sem seleção exclui quem aceitou, inclui o vencido e o copiado…"). Não há caso que importe pela planilha antes do "Enviar" (menor 2) |
| Pronto: o convite sai uma vez pelo worker, com o estado na tela; revogar ou refazer cancela na hora; o limite por minuto adia sem gastar tentativa | cumprido | `enviar-email.int.test.ts` ("[P] duas execuções ao mesmo tempo…: o e-mail sai uma vez só"; "[P] revogado com o job na barreira…"); `enviar-email-adiamento.int.test.ts` ("estourado, o job é adiado mais vezes que as tentativas…"); foto da lista |
| Pronto: "Esqueci" e "Redefinir" sem dizer se o e-mail tem conta; a conta só cruza escolas com o e-mail verificado | cumprido | RF12 e a borda do link copiado, acima |
| Pronto: a provisória só por quem alcança o aluno, vence em 24 h, obriga a troca, o aluno vê quem a gerou; o arquivo traz os atos sem o autor (D85) | cumprido | RF13 e RF17, com as três mutações |
| Pronto: o aluno pede o nome com a conta e entra por ela depois da aprovação, ou a liga em "Eu" | cumprido | RF14 |
| Pronto: os e2e do RF18 a 360 px e a 1366 × 768 | cumprido | 198 de 198, acima |
| Pronto: o `docs/roteiro-da-demonstracao.md` conferido nas telas que ele percorre | cumprido | o roteiro percorre Professores com "Cadastrar professor" e "Copiar link" (passo 6), que seguem na tela como ele diz (foto da lista: os dois botões e o "Enviar convites" ao lado, só quando alguém espera) |
| Pronto: esteira verde no último commit que alterou código | esteira: conferida no fechamento | — |
| Pronto: antes do portão de produção, o provedor de e-mail escolhido e registrado como suboperador | pendente, fora desta validação | `docs/decisoes-em-aberto.md:13`, dono o Joaquim, "antes do portão da F2c"; segura o portão de produção, não o pouso |
| Carga [C] da fase `professores` (Tech Spec 7c: zero 503 no login e no redefinir, todo redefinir em 204, passo (3) abaixo de 1 s) | **vermelho na 1ª corrida**, verde na 2ª | `npm run carga:importacao -- --fases professores`, duas corridas no commit validado. **1ª (15:11 UTC, load 3,1 a 4,1 em 12 núcleos, com o ambiente de teste do e2e de pé): reprovou**, "283 resposta(s) 5xx da API nas rotas do cenário" (`/v1/sessao/matricula` 279, `/v1/sessao/matricula/trocar-senha` 4, todas 503) e `rajada_professores: login_duracao{grupo:rajada} p(95) = 2123` contra o teto `p(95)<1000`; o lado dos professores passou (zero 503, 90 de 90 redefinir, passo (3) 10 de 10 até 1 s). **2ª (15:18 UTC, ambiente de teste parado, load 1,8 a 2,5): passou**, rajada p95 168 ms, zero 503, redefinir p95 256 ms, passo (3) 11 de 11 até 1 s. Nenhuma tarefa tinha rodado este [C]: a 10.0 o deu por coberto com os testes do script (`10_task.md:70`, "A execução … é manual") e não há registro de execução (crítico 1) |
| Carga [C] da sala com a conta da escola (16.0) | cumprida | `16_task.md:103` e `tasks/correcoes/2026-11-10-medidor-do-balde-anonimo.md:40`: `k2_conta` passou, pico do `rl:ip` 3.678 de 6.000 (61%); K2 calmo na correção `2026-11-10-k2-calmo` |

### 3. Portão

| Portão | Resultado |
|---|---|
| Testes de evidência, integração (isolados) | ✅ `convites-enviar`, `senha-esqueci`, `posse-do-email`, `troca-da-provisoria`, `reivindicacao-com-conta`, `ligar-conta` (API) e `enviar-email`, `enviar-email-da-conta`, `enviar-email-adiamento`, `expurgo-da-escola`, `expurgo-de-acesso` (worker): 11 arquivos, 404 casos; `senha-provisoria` e `arquivo-do-titular`: 2 arquivos, 103 casos |
| Testes de evidência, unidade (isolados) | ✅ `packages/core/src/email/`, `bilhete-da-troca.test.ts`, `senha-provisoria.test.ts`, `apps/web/src/areas/coordenacao/professores/`: 16 arquivos, 191 casos; `apps/api/test/contracts.test.ts` e `leitura-do-titular.test.ts`: 29 casos |
| e2e do RF18 (isolados) | ✅ 7 arquivos, 198 casos, `chromebook` e `celular` |
| Carga [C] `npm run carga:importacao -- --fases professores` | ❌ 1ª corrida reprovou (283 × 503 no login da rajada, p95 2.123 ms); ✅ 2ª passou (p95 168 ms, zero 503) |
| `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:e2e`, `npm run test:infra` inteiros | não rodados aqui (D79): esteira conferida no fechamento |
| Esteira do GitHub | conferida no fechamento pelo Orquestrador: não entra no veredito |
| Revisões com veto registradas e aprovadas | ✅ as 17 tarefas têm rodada de todo revisor obrigatório da tabela do `tasks.md`, e a última rodada de cada revisor com veto é APROVADO; a spec tem `revisao-spec.md` com veredito APROVADA (rodada 5) |

### 4. Achados

**Críticos**
1. `infra/scripts/carga-importacao.ts` (fase `professores`) com `infra/k6/importacao-7h30.js` e `infra/k6/login-7h30.js` (a rajada): **teste vermelho**, regra 80. O [C] da Tech Spec 7c ("zero 503 no login, rajada e equipe, e no redefinir") reprovou na primeira corrida: 283 respostas 503 no login do aluno da rajada (279 em `/v1/sessao/matricula`, 4 em `/v1/sessao/matricula/trocar-senha`) e p95 da rajada em 2.123 ms, contra 1.000 ms, com o host em load ~3,5 a 4 (12 núcleos) e o ambiente de teste do e2e de pé; passou na segunda, com o host em load ~2 (p95 168 ms, zero 503). O resultado depende de quanta CPU o host deixa às duas APIs de `cpus: 1` do compose de carga: é o mesmo padrão do K2 da 16.0 ("CPU negada", correção `2026-11-10-k2-calmo`, throttling de 27%), agora no login das 7h30, que é o caminho mais quente do produto. E este [C] nunca tinha sido executado por nenhuma tarefa: a 10.0 o marcou como coberto pelos testes do script (`tasks/prd-acesso-e-convites/10_task.md:70`). Correção sugerida, por `/corrigir`: (a) rodar a fase `professores` com a máquina calma, mais de uma vez, e registrar o resultado no `10_task.md` ou no documento da correção, como o K2 calmo fez; (b) medir no mesmo host a rajada sozinha (`npm run carga:login -- --fases rajada`) para saber se os 503 vêm da soma da fase `professores` (o argon2 dos 300 logins e dos 90 redefinir no mesmo semáforo) ou só do host; (c) escrever no `docs/runbook.md` (ou no `docs/infra.md` 5.1) a condição de máquina em que a carga vale como registro, e levar ao `TODO.md` do Joaquim, junto do hash `t=12` na VPS (D82), a medida desta fase na máquina de produção antes do piloto.

**Maiores**
1. `tasks/prd-acesso-e-convites/prd.md:56` × `apps/web/src/areas/coordenacao/professores/envio-do-convite.ts:37` e `apps/api/src/professores/professores.controller.ts:30-62`: a borda "E-mail que volta" diz "corrigir e reenviar, ou copiar o link", e a lista diz "Confira o e-mail e reenvie". Não há rota nem tela que corrija o e-mail do professor: as rotas são cadastrar, listar, enviar, refazer e revogar, e o "Reenviar" manda de novo ao mesmo endereço que falhou. O caminho que resta, revogar e cadastrar com o e-mail certo, cria outro usuário e não está escrito em lugar nenhum; a Tech Spec §11 só justifica a devolução tardia. Correção: escolher no Arquiteto entre (a) registrar na Tech Spec §11 que "corrigir" é revogar e cadastrar de novo, e dizer isso no texto do "falhou" e no `docs/interface.md`, com um caso de e2e ou de integração; ou (b) um "Corrigir o e-mail" do professor pendente, com tarefa própria.
2. `tasks/prd-acesso-e-convites/10_task.md:70`: o cenário [C] da fase `professores` (`cenarios.md`, "Carga") foi dado por coberto com `infra/test/carga-importacao.test.ts` e `carga-login.test.ts`, que provam o roteiro, e não o critério (zero 503, passo (3) abaixo de 1 s). A Mesa aprovou assim. É a mesma lacuna que o K2 da 16.0 teve até a correção: o [C] cujo critério só se mede rodando sai da tarefa sem ser rodado. Correção sugerida: na retro, exigir no template da tarefa que o [C] tenha a linha do resultado da execução (data, load do host, números), ou a justificativa de por que não rodou, como condição do carimbo.

**Menores**
1. `tasks/prd-acesso-e-convites/{5,6,12}_task.md` e `.processo/ordens/5_task-r*.md`, `12_task-r2.md`: recomendações com destino `TODO.md` nas tabelas "Sem aplicar" ainda não levadas ao `TODO.md`; o `estado.md` ("Devo ainda") já as lista para o fechamento. Dono: Orquestrador, no fechamento.
2. `apps/api/test/convites-enviar.int.test.ts:174`: a borda "professor cadastrado pela grade ou pela planilha entra no Enviar seguinte" é provada pela equivalência do convite copiado (o mesmo insert de `convite-da-escola.repository.ts:71`), e não importando pela planilha. Vale enquanto o insert for um só. Dono: test-engineer, na próxima funcionalidade que mexer na planilha de professores (`TODO.md`).
3. `apps/web/src/pages/TrocarSenhaProvisoria.tsx`: a 360 px, na foto do script (`troca-celular.png`), "Criar a senha e entrar" aparece num laranja mais claro que a 1366 px, com o campo ainda vazio. Conferir se é o estado desabilitado de propósito ou o contraste do botão; não bloqueia (a e2e de axe passou a 360 px). Dono: frontend-reviewer, na próxima tela do aluno (`TODO.md`).
4. `apps/web/src/pages/TurmaPublica.tsx`: a página pública da sala rola a 1366 × 768 (970 px), agora com a seção "Tem a conta da escola?" acima dos nomes. Nenhum RF pede que caiba e nada fica cortado; anotar no `docs/interface.md` se a entrada da sala deve caber. Dono: Arquiteto (`TODO.md`).
5. Ambiente: para a segunda corrida da carga parei os contêineres `educa-teste-*` (o banco e a vitrine ficam nos volumes). O próximo `node tools/ci/e2e.ts --manter-ambiente` ou portão os sobe de novo; `node tools/vitrine/vitrine.ts mostrar` só responde com a web de pé. Dono: Orquestrador, ao usar o ambiente 0.

**Positivos**
- Mutação do escopo da provisória (RF16) mostrou defesa em duas camadas: sem a escola na seleção comum, a geração seguiu 404 pelas cláusulas de escola das leituras seguintes; só a leitura do alvo, que não tem segunda camada, caiu, e o teste dela pegou.
- O escopo de quem gera é uma função só (`#condicoesDoAlcance`), usada pela leitura do alvo, pela conferência e pela trava: o alvo mostrado na confirmação nunca diverge de quem pode gerar.
- O e2e do convite anda o caminho real (worker, Mailpit, aceite em outro navegador), e não um atalho pelo banco.

### 5. Conclusão

Os sete RF estão atendidos, com código, teste efetivo e, nos que têm tela, foto lida: as três mutações nos pontos de maior risco (o escopo do professor, a escola no escopo da provisória e o alvo do arquivo do titular) ficaram vermelhas, os 198 e2e do RF18 passaram nos dois projetos, e a integração de evidência deu 507 casos verdes. As revisões estão completas e não há commit fora do processo.

O veredito é REPROVADA por um teste vermelho entre os que rodei: o [C] de carga da fase `professores` reprovou na primeira corrida (283 × 503 no login da rajada) e passou na segunda, com o host mais calmo. Pela regra do validador, intermitência é achado e não desculpa, e aqui ela está no login das 7h30 (regra 80), num cenário que nenhuma tarefa tinha rodado.

O caminho até APROVADA: (1) uma correção que rode o [C] com a máquina calma e registre o resultado, separe a rajada sozinha da soma com a fase `professores`, e escreva a condição de máquina em que a carga vale (crítico 1); (2) a triagem do Arquiteto para o "corrigir o e-mail" da borda do PRD (maior 1); (3) o processo do [C] na retro (maior 2). Depois, revalidação com escopo nos itens 1 e 2: a carga outra vez e o caso do e-mail corrigido; o resto desta rodada não precisa ser refeito.

### 6. Pendências herdadas

| Pendência | Destino |
|---|---|
| Provedor de e-mail de produção e registro como suboperador | Joaquim, antes do portão de produção da F2c (`docs/decisoes-em-aberto.md:13`) |
| Devolução tardia do e-mail (webhook do provedor) | `TODO.md` (Tech Spec §11) |
| "Eu" não mostra a conta já ligada numa visita seguinte | `TODO.md` (divergência 3 da 15.0) |
| O `auth_time` passa a ser exigido quando a escola conferir que o provedor o traz | `TODO.md` (Tech Spec §5) |
| Hash `t=12` medido na VPS de produção e o 429 por IP na entrada pela conta | `TODO.md`, dono Joaquim, antes do piloto (do K2 calmo e do diagnóstico da 16.0; levados pelo Orquestrador no fechamento) |
| Menores 1 a 5 desta rodada | `TODO.md`, pelo Orquestrador no fechamento |

Commits fora do processo: nenhum. Todo commit desde a `develop` que levou código a `apps`, `packages`, `infra`, `e2e` ou
`tools` tem `(tarefa N.0)` ou `(correção <slug>)`, e `git log origin/develop..HEAD -i --grep='^Fora do processo:'` não devolve nada.
