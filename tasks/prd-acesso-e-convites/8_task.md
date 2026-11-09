# Tarefa 8.0 — A tela "Verificar" e o aviso de `VERIFICACAO_PENDENTE` no aceite

**Funcionalidade:** acesso-e-convites · **Depende de:** 7.0
**Subagentes obrigatórios:** `frontend-reviewer`, `test-engineer`
**Porte:** pequeno

## Objetivo

Quem aceita um convite copiado de outra escola lê no aceite que o link foi ao e-mail; o link abre "Verificar", que confirma e leva de volta ao convite.

## Contexto necessário

- `techspec.md` seção 9; `cenarios.md` "Telas" (Verificar, Aceite com `VERIFICACAO_PENDENTE`)
- `prd.md` RF12, RF18
- `apps/web/src/pages/Convite.tsx` (o aceite) e `apps/web/src/pages/url-fragment.ts`

## Subtarefas

- [x] 8.1 — A tela "Verificar"
- [x] 8.2 — O aviso no aceite
- [x] 8.3 — `docs/interface.md`
- [x] 8.4 — O `docs/roteiro-da-demonstracao.md` (seção 2, passo 8) conferido contra `e2e/roteiro-da-demonstracao.spec.ts`
- [x] 8.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/pages/VerificarEmail.tsx` | novo |
| `apps/web/src/pages/Convite.tsx` | alterado |
| `apps/web/src/paths.ts` | alterado |
| `apps/web/src/routes.tsx` | alterado |
| `docs/interface.md` | alterado |
| `e2e/verificar-email.spec.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| verificar pelo Mailpit | e2e | "E-mail confirmado" e "Continuar" leva ao convite | `e2e/verificar-email.spec.ts` › verificar pelo Mailpit (o link do e-mail, o foco, o token fora da barra, "Continuar" em `/convite` e o aceite que segue) |
| carregando | e2e | "Confirmando…" | › carregando: "Confirmando…" |
| link vencido ou usado | e2e | "Peça outro link abrindo o convite de novo" | › link vencido, usado ou inventado (e sem token) e › link usado (o link do e-mail, já gasto) |
| aceite com `VERIFICACAO_PENDENTE` | e2e | o texto de "Telas" | › aceite de convite copiado por quem não provou o e-mail (o texto, o aviso `pendente`, o convite não gasto e o link no Mailpit) e › aceite com outra falha (o vermelho de erro segue para o resto) |
| recomeço: 2ª pessoa | e2e | não se aplica: anônima | não se aplica: a tela é anônima e não guarda nada de quem passou antes |
| recomeço: o mesmo link de novo | e2e | token fora da barra, sem ficar preso | › o mesmo link colado de novo (depois de falha recomeça; depois de confirmar não manda outro pedido) e › link colado sem token |
| recomeço: resposta atrasada | e2e | não troca o estado | › resposta atrasada; no `StrictMode` e no pedido que falha, `apps/web/src/pages/VerificarEmail.test.tsx` |
| recomeço: erro | e2e | o aviso sai na nova tentativa | › falha de rede: o aviso e o "Tentar de novo" saem na nova tentativa e › rede: o aviso diz o que fazer; "Tentar de novo" |
| 360 px | e2e | sem rolagem horizontal; 44 e 24 px | › 360 px: E-mail confirmado, o link que não vale, Confirmando… e o aceite com o aviso |

## Como testar

- Precedente: `e2e/professores.spec.ts:455` (W14, o aceite pelo link); `criarUsuarioEmOutraEscola` e `criarConviteDeProfessor` (`e2e/support/seed.ts:115`, `:704`)
- Comando: `node tools/ci/e2e.ts --manter-ambiente e2e/verificar-email.spec.ts`
- Telas: anônimo, `/convite` (aceite) e o link do e-mail

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 2: o texto do aviso já existe em `e2e/`?

**Plano.** `apps/web/src/api/senha.ts` ganha `verificarConta` (o tipo `VerificarContaRequest` do `@educa/shared`); `paths.ts` e `routes.tsx` ganham `/verificar`;
`pages/VerificarEmail.tsx` (nova) confirma ao abrir o link; `pages/Convite.tsx` põe a verificação pendente no aviso `pendente`; `docs/interface.md` (11.3) e
`docs/roteiro-da-demonstracao.md` (seção 2, passo 8) dizem a tela. Testes: `e2e/verificar-email.spec.ts` (a tabela acima), `apps/web/src/pages/VerificarEmail.test.tsx`
(o que o e2e de produção não alcança: o `StrictMode` e a falha atrasada) e o `desfazerAPosseDoEmail` em `e2e/support/seed.ts`, que devolve a conta de equipe ao
estado de quem não provou o e-mail (o seed já a cria com a posse provada).

1. **Mutação de cada cláusula:** os blocos abaixo cobrem cada `if` do hook `useLinkDeVerificar` (o mesmo link de novo, `novo !== undefined`, a vez, o token, a guarda do
   pedido feito, o token gasto, as duas guardas de resposta atrasada, o `NAO_ENCONTRADO`), cada ramo do JSX, o foco, o "Tentar de novo", os dois destinos dos links, o
   caminho da API, a rota e `falhaPedeVerificacao`. O `--faltando` está no começo de "Mutações".
2. **O texto já aparece em `e2e/`?** O aviso do aceite (`Mandamos um link para o seu e-mail`) não existia em nenhum spec (a 7.0 provou o `VERIFICACAO_PENDENTE` na API); "E-mail
   confirmado", "Confirmando…" e "Abrir o convite" são novos. `grep -rln` em `e2e/` só acha o spec novo.
3. **O segundo dado:** o caso do link que não vale tem o link inventado (a API real devolve `NAO_ENCONTRADO`) e o link usado (verificado pela API antes); o do aviso `pendente`
   tem o do erro comum (rede) ao lado, para a cor provar a escolha e não só o texto.
4. **Checagem anterior que responde antes:** o aceite só chega ao `VERIFICACAO_PENDENTE` com conta com senha, sem posse e com usuário em outra escola; `criarEquipeComSenha` +
   `desfazerAPosseDoEmail` + `criarConviteDeProfessor({ conta })` cumprem as três, e o caso afirma o 409 pela API antes de abrir a tela.
5. **Resultado, não forma:** os casos olham o texto na tela, o foco, a cor da borda, o endereço depois do clique e o número de pedidos que saíram.
6. **Guarda nova:** não há regra de lint, teste estrutural nem trava de pasta nesta tarefa.
7. **Comentário que afirma o que o código não faz:** relidos o docblock de `VerificarEmail` (o `StrictMode`, o mesmo link, a falha) e o de `Convite` (o aviso `pendente`) contra o código.
8. **Divergência:** nenhuma. O destino de "Continuar" é o do `cenarios.md` ("para o convite"): `/convite`, sem token, porque o token do convite só vive na aba que o abriu.
9. **Peça que já existe:** `readFragmentToken`/`clearFragment`, `CascaPublica`, `LoadingState`/`ErrorState`, `buttonVariants`, `SECONDARY_LINK_CLASSES`; `apiRequest` e o padrão do `redefinirSenha`. O
   hook `useLinkColado` do `RedefinirSenha` não serve: ele recomeça sempre, e aqui o link é de uso único.
10. **Corrida e resposta fora de ordem:** o pedido do link anterior que volta depois do link novo é segurado com `page.route` (e-mail) e com `segurar()` (unidade); o mesmo link
    colado com o pedido no ar e depois de confirmado conta os pedidos que saíram. Não há operação de banco nova.
11. **Isolamento:** a tarefa não cria repository nem consulta; a coluna "Caso" da tabela tem o caso de cada linha.
12. **"O que verificar" dos guardiões e o `achados/indice.md`:** `frontend-reviewer`: os quatro estados, 360 px com alvo de 44 e 24 px, foco, `status` e `alert`, sem token em URL
    nem em armazenamento (o token só vive na memória da tela e sai da barra antes da chamada). O índice, lido: a 6.0 reprovou o corpo da chamada escrito à mão (aqui é o
    `VerificarContaRequest` do `@educa/shared`), a asserção que sempre passa (nenhuma aqui) e a linha de comentário comprida (quebrada); a 7.0 reprovou o e2e que quebrava com a
    regra nova, e eles já passaram a usar a conta com a posse provada.

## Fora do escopo desta tarefa

A API (7.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

--faltando: 0 linhas (32 blocos, 1 motivos). Cada bloco foi pensado contra a linha que ele tira; o portão aplica, roda o caso e exige vermelho.

Um termo sem bloco, com o motivo: o `erro instanceof ApiError &&` de `useLinkDeVerificar` e o `falha instanceof ApiError &&` de `falhaPedeVerificacao`. Quem não é `ApiError` (a rede que cai chega como `ApiError` de `INDISPONIVEL_TENTE_DE_NOVO`, e qualquer outro valor não tem `.codigo`) dá `undefined === <código>`, falso do mesmo jeito: o termo só estreita o tipo para o compilador, e nenhum caso o distingue. O segundo termo de cada um (o código) tem bloco.

```mutacao
arquivo: apps/web/src/pages/Convite.tsx
teste: e2e/verificar-email.spec.ts › aceite de convite copiado por quem não provou o e-mail
-        <p role="alert" className={falhaPedeVerificacao(falha) ? CLASSES_DO_AVISO_PENDENTE : CLASSES_DO_AVISO_DE_ERRO}>
+        <p role="alert" className={CLASSES_DO_AVISO_DE_ERRO}>
          {falha instanceof ApiError ? mensagemDoConvite(falha.codigo) : mensagemDoConvite(ErrorCode.ERRO_INTERNO)}
```

```mutacao
arquivo: apps/web/src/pages/Convite.tsx
teste: e2e/verificar-email.spec.ts › aceite com outra falha
-        <p role="alert" className={falhaPedeVerificacao(falha) ? CLASSES_DO_AVISO_PENDENTE : CLASSES_DO_AVISO_DE_ERRO}>
+        <p role="alert" className={CLASSES_DO_AVISO_PENDENTE}>
          {falha instanceof ApiError ? mensagemDoConvite(falha.codigo) : mensagemDoConvite(ErrorCode.ERRO_INTERNO)}
```

```mutacao
arquivo: apps/web/src/pages/Convite.tsx
teste: e2e/verificar-email.spec.ts › aceite de convite copiado por quem não provou o e-mail
-  return falha instanceof ApiError && falha.codigo === ErrorCode.VERIFICACAO_PENDENTE
+  return falha instanceof ApiError && falha.codigo !== ErrorCode.VERIFICACAO_PENDENTE
```

```mutacao
arquivo: apps/web/src/api/senha.ts
teste: e2e/verificar-email.spec.ts › verificar pelo Mailpit
-const CAMINHO_DO_VERIFICAR = '/v1/conta/verificar'
+const CAMINHO_DO_VERIFICAR = '/v1/conta/verificar-x'
```

```mutacao
arquivo: apps/web/src/paths.ts
teste: e2e/verificar-email.spec.ts › carregando: "Confirmando…"
-  verificar: '/verificar',
+  verificar: '/verificar-x',
```

```mutacao
arquivo: apps/web/src/routes.tsx
teste: e2e/verificar-email.spec.ts › carregando: "Confirmando…"
      {/* O link de verificar o e-mail (8.0): tela anônima, como o redefinir. */}
-      <Route path={ROUTES.verificar} component={VerificarEmail} />
```

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: e2e/verificar-email.spec.ts › carregando: "Confirmando…"
-  if (etapa.nome === 'confirmando') {
+  if (false) {
    return (
      <CascaPublica titulo="Verificar o e-mail">
        <LoadingState rotulo="Confirmando…" />
```

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: e2e/verificar-email.spec.ts › rede: o aviso diz o que fazer; "Tentar de novo"
-  if (etapa.nome === 'falhou') {
+  if (false) {
    return (
      <CascaPublica titulo="Verificar o e-mail">
        <ErrorState erro={etapa.erro} aoTentarDeNovo={tentarDeNovo} />
```

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: e2e/verificar-email.spec.ts › verificar pelo Mailpit
-  if (etapa.nome === 'confirmado') {
+  if (false) {
    return (
      <CascaPublica titulo="Verificar o e-mail">
        <p ref={confirmacao} role="status" tabIndex={-1} className="rounded-controle border border-ok bg-ok-cx p-4 text-ok">
```

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: e2e/verificar-email.spec.ts › verificar pelo Mailpit
  useEffect(() => {
-    if (etapa.nome === 'confirmado') confirmacao.current?.focus()
  }, [etapa.nome])
```

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: e2e/verificar-email.spec.ts › verificar pelo Mailpit
        <p className="text-apoio">Volte ao convite e aceite de novo.</p>
-        <Link className={`${buttonVariants({ variante: 'primario' })} w-full`} to={ROUTES.convite}>
+        <Link className={`${buttonVariants({ variante: 'primario' })} w-full`} to={ROUTES.entrar}>
          Continuar
```

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: e2e/verificar-email.spec.ts › link vencido, usado ou inventado
-        <Link className={SECONDARY_LINK_CLASSES} to={ROUTES.convite}>
+        <Link className={SECONDARY_LINK_CLASSES} to={ROUTES.entrar}>
          Abrir o convite
```

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: e2e/verificar-email.spec.ts › link vencido, usado ou inventado
-  const [etapa, definirEtapa] = useState<Etapa>(token === undefined ? { nome: 'sem-token' } : { nome: 'confirmando' })
+  const [etapa, definirEtapa] = useState<Etapa>({ nome: 'confirmando' })
```

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: e2e/verificar-email.spec.ts › o mesmo link colado de novo
-      if (novo !== undefined && novo === tokenGasto.current) {
+      if (false) {
        clearFragment()
        return
```

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: e2e/verificar-email.spec.ts › link colado sem token
-      if (novo !== undefined && novo === tokenGasto.current) {
+      if (novo === tokenGasto.current) {
        clearFragment()
        return
```

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: e2e/verificar-email.spec.ts › o mesmo link colado de novo
      if (novo !== undefined && novo === tokenGasto.current) {
-        clearFragment()
        return
```

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: e2e/verificar-email.spec.ts › resposta atrasada
      }
-      vezDoLink.current++
      definirToken(novo)
```

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: e2e/verificar-email.spec.ts › resposta atrasada
      vezDoLink.current++
-      definirToken(novo)
      definirVez(vezDoLink.current)
```

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: e2e/verificar-email.spec.ts › resposta atrasada
      definirToken(novo)
-      definirVez(vezDoLink.current)
      definirEtapa(novo === undefined ? { nome: 'sem-token' } : { nome: 'confirmando' })
```

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: e2e/verificar-email.spec.ts › link colado sem token
      definirVez(vezDoLink.current)
-      definirEtapa(novo === undefined ? { nome: 'sem-token' } : { nome: 'confirmando' })
+      definirEtapa({ nome: 'confirmando' })
```

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: e2e/verificar-email.spec.ts › carregando: "Confirmando…"
  useEffect(() => {
-    clearFragment()
    if (token === undefined) return
```

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: e2e/verificar-email.spec.ts › link vencido, usado ou inventado
    clearFragment()
-    if (token === undefined) return
+    if (token === undefined && false) return
    const chave = `${String(vez)}:${String(tentativa)}`
```

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: apps/web/src/pages/VerificarEmail.test.tsx › o pedido do link sai uma vez só
-    if (pedidoFeito.current === chave) return
    pedidoFeito.current = chave
```

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: apps/web/src/pages/VerificarEmail.test.tsx › o pedido do link sai uma vez só
    if (pedidoFeito.current === chave) return
-    pedidoFeito.current = chave
    tokenGasto.current = token
```

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: e2e/verificar-email.spec.ts › o mesmo link colado de novo
    pedidoFeito.current = chave
-    tokenGasto.current = token
    verificarConta({ token }).then(
```

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: e2e/verificar-email.spec.ts › resposta atrasada
falha: confirmado(page)).toHaveCount(0)
      () => {
-        if (vezDoLink.current === vez) definirEtapa({ nome: 'confirmado' })
+        definirEtapa({ nome: 'confirmado' })
      },
```

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: apps/web/src/pages/VerificarEmail.test.tsx › o pedido do link anterior que falha
falha: queryByRole('alert')
        // Outro link chegou enquanto o pedido estava no ar: a tela já é a dele, e nada daqui muda.
-        if (vezDoLink.current !== vez) return
        // Não deu certo, então o link não foi gasto aqui: colá-lo de novo recomeça.
```

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: e2e/verificar-email.spec.ts › o mesmo link colado de novo
        // Não deu certo, então o link não foi gasto aqui: colá-lo de novo recomeça.
-        tokenGasto.current = undefined
        definirEtapa(erro instanceof ApiError
```

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: e2e/verificar-email.spec.ts › link vencido, usado ou inventado
-        definirEtapa(erro instanceof ApiError && erro.codigo === ErrorCode.NAO_ENCONTRADO ? { nome: 'invalido' } : { nome: 'falhou', erro })
+        definirEtapa({ nome: 'falhou', erro })
```

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: e2e/verificar-email.spec.ts › rede: o aviso diz o que fazer; "Tentar de novo"
-        definirEtapa(erro instanceof ApiError && erro.codigo === ErrorCode.NAO_ENCONTRADO ? { nome: 'invalido' } : { nome: 'falhou', erro })
+        definirEtapa({ nome: 'invalido' })
```

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: e2e/verificar-email.spec.ts › rede: o aviso diz o que fazer; "Tentar de novo"
  function tentarDeNovo(): void {
-    definirEtapa({ nome: 'confirmando' })
    definirTentativa((anterior) => anterior + 1)
```

```mutacao
arquivo: apps/web/src/pages/VerificarEmail.tsx
teste: e2e/verificar-email.spec.ts › rede: o aviso diz o que fazer; "Tentar de novo"
    definirEtapa({ nome: 'confirmando' })
-    definirTentativa((anterior) => anterior + 1)
  }
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| frontend-reviewer (1ª) | `Convite.tsx:22-23` mantém duas constantes de classe para os avisos; se uma terceira tela precisar do aviso `pendente`, tirar o aviso para um componente comum | Recusada: o próprio revisor diz que "hoje isso não pede mudança". Vale só se uma terceira tela usar o aviso `pendente` |
| frontend-reviewer (1ª) | A falha de rede ("Tentar de novo") não tem foto, a vitrine não fotografa erro; "na validação, vale olhar uma vez com a rede derrubada" | Validador, no fim da spec: fotografar o requisito com tela |
| tenancy-guardian (1ª) | Teste de contrato no backend fixando que token vencido, usado e de formato inválido chegam todos em `NAO_ENCONTRADO` (`VerificarEmail.tsx:278`) | `TODO.md`: toca a API da 7.0, fora desta tarefa (`Fora do escopo`: "A API (7.0)") |
| privacy-guardian (1ª) | Decidir de propósito se a diferença de resposta `VERIFICACAO_PENDENTE` (a conta tem senha e não provou o e-mail) é aceitável | Retro da spec, para o Arquiteto: é decisão da resposta da API da 7.0 |
| infra-guardian (1ª) | Registrar que não há limite pelo hash do token em `conta.controller.ts:7` (só por IP) | `TODO.md`: é da 7.0, fora desta tarefa |
| infra-guardian (1ª) | Guarda `etapa.nome !== 'falhou'` em `tentarDeNovo` contra dois cliques no mesmo quadro | Recusada: o próprio revisor diz que o backend já protege e que "não bloqueia"; o uso único do link é resolvido no banco (`usarLinkPorHash`) |
| revisor-geral (1ª) | "Continuar" leva a `/convite` sem token, que mostra "O endereço do convite está incompleto…" a quem acabou de confirmar o e-mail | `TODO.md`, para o Arquiteto decidir o que `/convite` sem token mostra a quem vem de "Verificar". A tarefa segue `cenarios.md` "Telas" (Verificar: "Continuar" para o convite), que o próprio revisor chama de "defensável" |
| revisor-geral (1ª) | `corDaPaleta` (`e2e/verificar-email.spec.ts:106`) repete o ajudante de `e2e/support/checks.ts` | `TODO.md`: juntar os dois quando a renomeação (X8) fechar; o motivo já está escrito no spec |
| revisor-geral (1ª) | Caso extra com token fora do formato, para provar que a tela trata as duas recusas do mesmo jeito | Recusada: `verificarContaRequestSchema` (`packages/shared/src/sessao/senha.ts`) diz que token "de outro formato é `NAO_ENCONTRADO`, igual para todos", e a 7.0 já provou a igualdade na API |
| test-engineer (1ª) | `e2e/verificar-email.spec.ts:204`: o título diz "vencido", mas nenhum caso abre um link realmente vencido | Recusada: `cenarios.md` "Telas" (Verificar) chama o estado de "link vencido ou usado", e a tela não distingue vencido de inventado (a API responde `NAO_ENCONTRADO` para os dois, provado na 7.0) |
| test-engineer (1ª) | `e2e/verificar-email.spec.ts:139-141`: "o convite não é gasto" só pelo botão habilitado; consultar `usado_em` pelo seed | Recusada: o caso seguinte (`:162-166`) prova o convite não gasto pelo novo aceite, que é o resultado e não a coluna |
| test-engineer (1ª) | `test.slow()` dos três casos com Mailpit: registrar a folga medida | Retro da spec: a esteira já vale 90 s; é medida de tempo, não de código |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-08 22:46:11 | 2026-11-08 22:46:34 | `frontend-reviewer` | 1 | APROVADO | ad685cee02b1e89be |
| 2026-11-08 22:46:26 | 2026-11-08 22:46:49 | `tenancy-guardian` | 1 | APROVADO | aef82bd61619835e3 |
| 2026-11-08 22:46:34 | 2026-11-08 22:46:59 | `conformidade-reviewer` | 1 | APROVADO | ab4d20bc5d53bfd8b |
| 2026-11-08 22:46:30 | 2026-11-08 22:47:07 | `privacy-guardian` | 1 | APROVADO | a391d10c6473eef62 |
| 2026-11-08 22:46:38 | 2026-11-08 22:47:13 | `infra-guardian` | 1 | APROVADO | a0cf26c608b6e5320 |
| 2026-11-08 22:46:22 | 2026-11-08 22:47:33 | `revisor-geral` | 1 | APROVADO | af9efc508e858afdc |
| 2026-11-08 22:46:18 | 2026-11-08 22:47:55 | `test-engineer` | 1 | APROVADO | ab412c9cf6a358409 |
