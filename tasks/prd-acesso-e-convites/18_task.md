# Tarefa 18.0 — A coordenação corrige o e-mail do professor que não entrou (API)

**Funcionalidade:** acesso-e-convites · **Depende de:** 3.0, 11.0
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `test-engineer`
**Porte:** grande

## Objetivo

`POST /v1/professores/:usuarioId/email` liga o professor `pendente` ou `vencido` que nunca entrou à conta do e-mail certo, com o mesmo id,
vínculos e aulas, e refaz o convite (maior 1 da validação).

## Contexto necessário

- `techspec.md` §5 "Corrigir o e-mail" (a ordem dos seis passos é a regra) e "Arquivo do titular"; §3 (`auditoria`); §11
- `prd.md` §7 "E-mail que volta"; RF16, RF17. `cenarios.md`, "Corrigir o e-mail" ([I] e [P]), "Corridas", "Auditoria (RF17)"
- Regras 10 (itens 3, 5, 6), 20 (itens 4, 9, 10), 80 (itens 7, 9)
- Molde: `refazerConviteDeProfessor` e `professorSobATrava` (`convite-de-professor.service.ts`); `convidarProfessor` e `refazerSobATrava` (`convite.service.ts`); a cerca do `contaDoProfessor` (`packages/core/src/estrutura/cadastro-de-professor.ts`); onde entra ação nova (comentário de `acoes-por-alvo.ts`)

## Subtarefas

- [x] 18.1 — `corrigirEmailDoProfessorRequestSchema` (`{ email }`, o `emailConvidadoSchema`, estrito), a matriz `CORRIGIR_EMAIL_DO_PROFESSOR_POR_ESTADO` e a célula `professor.corrigir_email` (`unidade` na coordenação, `nunca` no resto)
- [x] 18.2 — `trocarContaDoProfessor` no `ConviteRepository` (as quatro condições do §5, passo 4), a consulta do convite usado, e o caso de uso na ordem do §5; o 23505 vira `CONFLITO`
- [x] 18.3 — A rota, `no-store`, `IdPipe`
- [x] 18.4 — `usuario.email_corrigido` (entidade `usuario`, sem `antes`, `depois` nem finalidade) em `acoes.ts`; em `ACOES_DO_USUARIO_POR_ALVO` com o papel fixo "coordenação"; `0048_auditoria_por_alvo_email.sql` (índice novo com as sete, `drop` do antigo); `auditoria-por-alvo.int.test.ts` lendo a migration nova
- [x] 18.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `packages/shared/src/professores/professores.ts`, `packages/shared/src/permissao/matriz.ts`, `matriz.test.ts`, `packages/shared/src/index.ts` | alterado |
| `apps/api/src/sessao/convite/convite-de-professor.service.ts`, `convite.repository.ts`; `apps/api/src/professores/professores.controller.ts`, `professores.service.ts` | alterado |
| `packages/core/src/auditoria/acoes.ts`, `acoes-por-alvo.ts`; `packages/core/src/db/schema/auditoria.ts`, `auditoria-por-alvo.int.test.ts`; `packages/core/src/titular/leitura-do-titular.ts`, `leitura-do-titular.test.ts` | alterado |
| `packages/core/drizzle/0048_auditoria_por_alvo_email.sql`, `packages/core/drizzle/meta/`; `apps/api/test/professores-corrigir-email.int.test.ts` | novo |
| `apps/api/test/arquivo-do-titular.int.test.ts` | alterado |

## Testes que provam a regra

Detalhe de cada linha: `cenarios.md`, "Corrigir o e-mail".

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| caminho feliz | integração | mesmo id; vínculo e aula da grade ficam; conta nova | caminho feliz: o professor da grade, com o envio `falhou`… |
| token | integração | antigo recusado; novo aceito | token: o link do convite anterior é recusado… |
| envio antigo | integração | `na_fila` e `enviando` terminam `cancelado` | envio antigo: o `na_fila` e o `enviando` terminam `cancelado`… |
| "Enviar" depois | integração | destino decifrado é o e-mail novo | "Enviar" de um só logo depois… |
| conta antiga | integração | intacta; sem usuário, limpa de madrugada; com usuário na B, não | intacta: e-mail, senha e verificação ficam…; sem usuário que a segure, a limpeza da madrugada… |
| `vencido` | integração | corrige; 7 dias do relógio falso | `vencido`: corrige, e o convite novo vale os 7 dias… |
| estados fora | integração | quatro estados, `CONFLITO`, nada gravado | estados fora: `%s` responde CONFLITO, sem conta nova nem auditoria (it.each, quatro estados) |
| quem já entrou | integração | convite usado antes: `CONFLITO` | quem já entrou: o professor desligado e chamado de volta… |
| e-mail de outro professor | integração | três estados: `CONFLITO`, nada gravado, sem conta nova | e-mail de outro professor da escola, em `pendente`, `ativo` e `revogado`… |
| mesmo e-mail | integração | outra caixa: `CONFLITO` | o mesmo e-mail de hoje, também em outra caixa… |
| E11 | integração | conta só na B: resposta igual | E11: o e-mail com conta só em outra escola corrige… |
| permissão | integração | professor e aluno recusados | permissão: o professor e o aluno são recusados… |
| isolamento | integração | ids da B, de aluno, de coordenador, inexistente: `NAO_ENCONTRADO`, nada criado | isolamento: o id da outra escola, o de aluno, o de coordenador e o inexistente…; repository: `jaEntrou` e `trocarContaDoProfessor` só alcançam… |
| entrada | integração | campo a mais, e-mail inválido | entrada: campo a mais, e-mail fora do formato ou ausente… |
| auditoria | integração | `usuario.email_corrigido` e `convite.refeito`, sem e-mail nem conta | auditoria: um `usuario.email_corrigido` e um `convite.refeito`… |
| arquivo do professor | integração | papel "coordenação", sem autor | arquivo do professor: o ato chega com o papel "coordenação"… (real, no arquivo novo); `arquivo-do-titular.int.test.ts` › D85: usuario.email_corrigido (18.0) aparece no arquivo do professor… (plantado, com o outro professor e o isolamento) |
| índice | integração | plano usa o índice novo, com sete | `auditoria-por-alvo.int.test.ts` › o índice começa pela escola… sete ações…, e › a leitura do titular (as cinco ações do usuário) e a da lista…; `arquivo-do-titular.int.test.ts` › D85: o índice parcial por alvo tem as sete ações… |
| matriz | unidade | só a coordenação | `matriz.test.ts` › I9: listar, cadastrar, refazer, revogar o convite e corrigir o e-mail de professor… |
| correção × aceite | integração | `emOrdemNaTrava`, duas direções | correção × aceite do convite antigo, nas duas ordens… |
| duas correções | integração | um convite aberto, nunca 500 | duas correções do mesmo professor com e-mails diferentes, abertas juntas… |
| correção × "Enviar" | integração | nunca dois `na_fila` | correção × "Enviar" do mesmo professor, nas duas ordens… |
| log novo | integração | sem e-mail | log novo: a rota só leva ids e código… |

## Como testar

- Molde: `apps/api/test/professores.int.test.ts` › "E8, vencido e aceito…"; corridas › "cadastrar × refazer do mesmo professor…", com `emOrdemNaTrava` (`apps/api/test/escola-lock.ts`)
- Cifra e envio cancelado: `destinoDoEnvio`, `tokenDoEnvio` e os casos do "Copiar link" de `apps/api/test/convites-enviar.int.test.ts`
- Grade: `apps/api/test/grade.int.test.ts` › "reimportar mantém o id da aula…". Arquivo: bloco "D85" de `arquivo-do-titular.int.test.ts` (o `ATOS()` é do aluno)
- Isolado: `npx vitest run --project integracao apps/api/test/professores-corrigir-email.int.test.ts`
- Armadilhas: decifre e confira o destino (3.0, `test-engineer` 1ª); não edite a 0046 e recrie o banco (`EDUCA_BANCO_NOVO=1`); o 23505 aborta a transação

## Autoconferência

As 12 perguntas do `task-template.md`, no plano; pesam a 1 (cada termo do `update`), a 3 (o convite usado antes) e a 4.

## Fora do escopo desta tarefa

A tela (19.0); trocar o e-mail de quem já entrou; mudar `conta.email`.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O convite que a correção devolve vale **7 dias** (`VALIDADE_DO_CONVITE_HORAS_POR_TIPO.professor`, o mesmo do refazer), e não 72 h: as 72 h são as do convite de coordenador. A linha do cenário e a da tabela de testes desta tarefa diziam 72 h | desenho | `cenarios.md`, "Corrigir o e-mail", o caso do professor `vencido`; techspec.md §5, "Corrigir o e-mail", passo (5) ("a do refazer"), que já diz o que o código faz |

## Mutações

**`--faltando`:** 1 linhas (12 blocos, 4 motivos). A linha que sobra é o `if` do estado do passo (1), com o motivo 1; os blocos foram rodados pelo portão, com o `aplicarMutacao`.

**Sem mutação (a migration):** `0048_auditoria_por_alvo_email.sql` não é código de `apps/*/src` ou `packages/*/src`; o índice novo, o `drop` do de seis e o `rename` são provados no banco pelo caso "o índice começa pela escola… sete ações… num único índice por alvo" (`auditoria-por-alvo.int.test.ts`, que migra um banco só dele) e pelo "D85: o índice parcial por alvo tem as sete ações…" (`arquivo-do-titular.int.test.ts`).

**Sem bloco, por motivo:**
1. O `if (CORRIGIR_EMAIL_DO_PROFESSOR_POR_ESTADO[estado] === 'conflito')` do passo (1) e a chave `revogado` da matriz são mutantes equivalentes (o portão rodou os dois blocos, e o caso "estados fora" ficou verde): o único estado fora de `pendente` e `vencido` que o resto do caminho deixaria passar é o `revogado`, e o `refazerSobATrava` do passo (5) o recusa com o mesmo `CONFLITO` (o `revogarParaRefazer` só revoga convite em aberto), desfazendo a transação; o `aceito` e o `desativado` caem no `jaEntrou`, e o `ativo` no `desativado_em` do `update`. O `if` fica porque é o passo (1) da spec, a matriz é o que a tela da 19.0 lê, e o aviso cedo evita criar a conta do passo (3) à toa. A chave `pendente` e a `vencido` têm bloco.
2. O `eq(convite.tipo, 'professor')` do `jaEntrou` é mutante equivalente: o usuário que chega ao `jaEntrou` já passou pelo `professorSobATrava` como professor com convite de professor, e só `tipo = 'professor'` é criado para ele (o convite de coordenador nasce só para usuário coordenador). O `escolaId`, o `usuarioId` e o `usadoEm` dele têm bloco.
3. As chaves `aceito`, `ativo` e `desativado` de `CORRIGIR_EMAIL_DO_PROFESSOR_POR_ESTADO` viradas para `corrigir` não mudam resposta nenhuma: o `aceito` e o `desativado` têm convite usado (o `jaEntrou` recusa) e o `ativo` tem `desativado_em` nulo (o `update` condicional dá zero linhas).
4. O 23505 do `usuario_escola_conta_papel_unico` não tem `catch` próprio: quem o traduz é o `mapPostgresError` do filtro global, que já tem teste (`error.int.test.ts`), e o caso "e-mail de outro professor da escola" prova o `CONFLITO`, nada gravado e sem conta nova, pela rota.

```mutacao
arquivo: apps/api/src/sessao/convite/convite-de-professor.service.ts
teste: apps/api/test/professores-corrigir-email.int.test.ts › quem já entrou
-    if (await convites.jaEntrou(usuarioId)) throw new DomainException(ErrorCode.CONFLITO)
     const contaNova = await contaDoProfessor(tx, normalizarEmail(pedido.email))
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite-de-professor.service.ts
teste: apps/api/test/professores-corrigir-email.int.test.ts › o mesmo e-mail de hoje
-    if (!trocou) throw new DomainException(ErrorCode.CONFLITO)
     const refeito = await refazerSobATrava(tx, convites, 'professor', conviteId, token, expiraEm)
```

```mutacao
arquivo: packages/shared/src/professores/professores.ts
teste: apps/api/test/professores-corrigir-email.int.test.ts › `vencido`: corrige
-  vencido: 'corrigir',
+  vencido: 'conflito',
   revogado: 'conflito',
   aceito: 'conflito',
   ativo: 'conflito',
   desativado: 'conflito',
```

```mutacao
arquivo: packages/shared/src/professores/professores.ts
teste: apps/api/test/professores-corrigir-email.int.test.ts › caminho feliz
-  pendente: 'corrigir',
+  pendente: 'conflito',
   vencido: 'corrigir',
   revogado: 'conflito',
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite.repository.ts
teste: apps/api/test/professores-corrigir-email.int.test.ts › caminho feliz
-      .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.usuarioId, usuarioId), eq(convite.tipo, 'professor'), isNotNull(convite.usadoEm)))
+      .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.usuarioId, usuarioId), eq(convite.tipo, 'professor')))
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite.repository.ts
teste: apps/api/test/professores-corrigir-email.int.test.ts › correção × aceite
-      .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.usuarioId, usuarioId), eq(convite.tipo, 'professor'), isNotNull(convite.usadoEm)))
+      .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.tipo, 'professor'), isNotNull(convite.usadoEm)))
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite.repository.ts
teste: apps/api/test/professores-corrigir-email.int.test.ts › repository:
-      .where(and(eq(convite.escolaId, requireEscolaId()), eq(convite.usuarioId, usuarioId), eq(convite.tipo, 'professor'), isNotNull(convite.usadoEm)))
+      .where(and(eq(convite.usuarioId, usuarioId), eq(convite.tipo, 'professor'), isNotNull(convite.usadoEm)))
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite.repository.ts
teste: apps/api/test/professores-corrigir-email.int.test.ts › repository:
-      .where(and(eq(usuario.escolaId, requireEscolaId()), eq(usuario.id, usuarioId), eq(usuario.papel, 'professor'), isNotNull(usuario.desativadoEm), ne(usuario.contaId, contaId)))
+      .where(and(eq(usuario.id, usuarioId), eq(usuario.papel, 'professor'), isNotNull(usuario.desativadoEm), ne(usuario.contaId, contaId)))
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite.repository.ts
teste: apps/api/test/professores-corrigir-email.int.test.ts › envio antigo
-      .where(and(eq(usuario.escolaId, requireEscolaId()), eq(usuario.id, usuarioId), eq(usuario.papel, 'professor'), isNotNull(usuario.desativadoEm), ne(usuario.contaId, contaId)))
+      .where(and(eq(usuario.escolaId, requireEscolaId()), eq(usuario.papel, 'professor'), isNotNull(usuario.desativadoEm), ne(usuario.contaId, contaId)))
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite.repository.ts
teste: apps/api/test/professores-corrigir-email.int.test.ts › repository:
-      .where(and(eq(usuario.escolaId, requireEscolaId()), eq(usuario.id, usuarioId), eq(usuario.papel, 'professor'), isNotNull(usuario.desativadoEm), ne(usuario.contaId, contaId)))
+      .where(and(eq(usuario.escolaId, requireEscolaId()), eq(usuario.id, usuarioId), isNotNull(usuario.desativadoEm), ne(usuario.contaId, contaId)))
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite.repository.ts
teste: apps/api/test/professores-corrigir-email.int.test.ts › repository:
-      .where(and(eq(usuario.escolaId, requireEscolaId()), eq(usuario.id, usuarioId), eq(usuario.papel, 'professor'), isNotNull(usuario.desativadoEm), ne(usuario.contaId, contaId)))
+      .where(and(eq(usuario.escolaId, requireEscolaId()), eq(usuario.id, usuarioId), eq(usuario.papel, 'professor'), ne(usuario.contaId, contaId)))
```

```mutacao
arquivo: apps/api/src/sessao/convite/convite.repository.ts
teste: apps/api/test/professores-corrigir-email.int.test.ts › o mesmo e-mail de hoje
-      .where(and(eq(usuario.escolaId, requireEscolaId()), eq(usuario.id, usuarioId), eq(usuario.papel, 'professor'), isNotNull(usuario.desativadoEm), ne(usuario.contaId, contaId)))
+      .where(and(eq(usuario.escolaId, requireEscolaId()), eq(usuario.id, usuarioId), eq(usuario.papel, 'professor'), isNotNull(usuario.desativadoEm)))
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | O "Corrigir o e-mail" com o e-mail de um coordenador da mesma escola cria uma linha de professor na conta dele (a unicidade é por escola, conta e papel). "Vale decidir na 19.0 se isso deve ser `CONFLITO`." | Muda comportamento e contrato: não é barata. Destino: `TODO.md`, com dono a 19.0. Não vaza entre escolas |
| tenancy-guardian (1ª), revisor-geral (1ª), infra-guardian (1ª), privacy-guardian (1ª) | `CREATE INDEX` da 0048 sem `CONCURRENTLY` | Aplicada na ordem da rodada 1: o `TODO.md` "antes do staging" passou a citar a 0046 e a 0048; a Tech Spec do F3, seção 7c, cobre até haver staging |
| conformidade-reviewer (1ª) | A tela da 19.0 não pode virar contagem nem destaque de "professor que não usa"; a frase da tela fala da conta e do convite, nunca do uso da IA | Destino: tarefa 19.0 (a tela), regra 70, item 9 (D64) |
| test-engineer (1ª) | O `enviando` do caso "envio antigo" é simulado por `update`; o cenário pedia SMTP falso numa barreira | Destino: Validador, que confere o `cancelar-envio` e o `convites-enviar.int.test.ts` (já cobrem o lado do worker). Cobre a linha da tabela de testes da tarefa |
| privacy-guardian (1ª) | Citar a correção na linha "E-mail de login na conta global" de `docs/lgpd.md` | Já está: a linha 65 traz "O "Corrigir o e-mail" da coordenação (acesso-e-convites, 18.0) …" |
| test-engineer (1ª) | "Arquivos previstos" lista `leitura-do-titular.ts` como alterado e ele não mudou | Atendida: o arquivo teve os dois comentários atualizados (seis para sete ações; o papel fixo da coordenação) |
| infra-guardian (1ª) | A rota não ganhou cota própria | Por decisão da spec (Tech Spec, seção 5: "Sem cota própria, como o cadastro e o refazer"): fica só com o limite global por `sub` e `esc` do `RateLimitGuard` (regra 80, item 1) |
| revisor-geral (1ª) | O comentário de `CORRIGIR_EMAIL_DO_PROFESSOR_POR_ESTADO` dizia que um teste prova que a matriz é igual à do refazer | Nenhum teste compara as duas matrizes: o comentário só diz que têm de ficar iguais. Comparar as duas num teste de unidade fica para quem mexer em uma delas |
| tenancy-guardian (2ª), infra-guardian (2ª), revisor-geral (2ª), privacy-guardian (2ª) | O título do caso "e-mail de outro professor da escola…" diz que a conta criada que a transação desfaz é a do `revogado` de "estados fora": o `revogado` para no passo (1) e nenhum caminho real cria conta e a desfaz | Só prosa do título; mudar o teste caduca `test-engineer` e `revisor-geral`. Destino: `TODO.md`, dono: quem abrir o teste da 18.0 |
| tenancy-guardian (2ª), infra-guardian (2ª), privacy-guardian (2ª) | Teste de unidade com `toEqual` entre `CORRIGIR_EMAIL_DO_PROFESSOR_POR_ESTADO` e `REFAZER_CONVITE_DE_PROFESSOR_POR_ESTADO` | Já na linha do revisor-geral (1ª), acima: fica para quem mexer em uma das duas |
| conformidade-reviewer (2ª) | A recomendação da 19.0 (a frase da tela fala da conta e do convite, nunca do uso da IA; D64) precisa entrar no texto da 19.0 | Destino: tarefa 19.0 (`19_task.md`); a Mesa não edita o documento da 19.0 |
| conformidade-reviewer (2ª), privacy-guardian (2ª) | Se a 19.0 decidir `CONFLITO` para o e-mail de coordenador da mesma escola, a resposta continua sem revelar de quem é o e-mail (E11) | Já no `TODO.md` com dono a 19.0 |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-10 14:42:24 | 2026-11-10 14:43:11 | `tenancy-guardian` | 1 | APROVADO | ab60c3411c4cb14ce |
| 2026-11-10 14:42:39 | 2026-11-10 14:43:12 | `conformidade-reviewer` | 1 | APROVADO | a98cc635a497f25fe |
| 2026-11-10 14:42:35 | 2026-11-10 14:43:24 | `revisor-geral` | 1 | APROVADO | abc3141a666d8fa22 |
| 2026-11-10 14:42:28 | 2026-11-10 14:43:43 | `infra-guardian` | 1 | APROVADO | a8788b6ca24fbb6c3 |
| 2026-11-10 14:42:26 | 2026-11-10 14:43:49 | `privacy-guardian` | 1 | APROVADO | ac1d094ad56f01a4f |
| 2026-11-10 14:42:32 | 2026-11-10 14:44:42 | `test-engineer` | 1 | APROVADO | a3eda1f2cf916b87e |
| 2026-11-10 14:55:36 | 2026-11-10 14:56:01 | `tenancy-guardian` | 2 | APROVADO | a422bc1afdfa4a320 |
| 2026-11-10 14:55:51 | 2026-11-10 14:56:10 | `infra-guardian` | 2 | APROVADO | a9e1460794f01c1d8 |
| 2026-11-10 14:56:11 | 2026-11-10 14:56:31 | `conformidade-reviewer` | 2 | APROVADO | a4b4a689f5c10d2af |
| 2026-11-10 14:56:04 | 2026-11-10 14:56:37 | `revisor-geral` | 2 | APROVADO | a6f4d031fc78c51ac |
| 2026-11-10 14:55:56 | 2026-11-10 14:56:46 | `test-engineer` | 2 | APROVADO | aff633e7cbdea1d28 |
| 2026-11-10 14:55:43 | 2026-11-10 14:57:07 | `privacy-guardian` | 2 | APROVADO | a774f4ef24ae9d1a0 |
