# Tarefa 6.0 — As telas "Esqueci a senha" e "Redefinir"

**Funcionalidade:** acesso-e-convites · **Depende de:** 5.0
**Subagentes obrigatórios:** `frontend-reviewer`, `privacy-guardian`, `test-engineer`
**Porte:** pequeno

## Objetivo

A equipe pede o link pela entrada, recebe o e-mail e define a senha nova; volta à entrada com "Senha trocada. Entre com a nova", sem login automático. As duas telas são formulários de um campo do mesmo link.

## Contexto necessário

- `techspec.md` seções 4 e 9; `cenarios.md` "Telas" (Esqueci, Redefinir) e "E2E (RF18)"
- `prd.md` RF12, RF18
- `.claude/rules/50`
- `apps/web/src/pages/Entrar.tsx` (o link novo), `apps/web/src/pages/url-fragment.ts` (o token no `#`), `apps/web/src/paths.ts`

## Subtarefas

- [x] 6.1 — A tela "Esqueci a senha" e o link na entrada da equipe
- [x] 6.2 — A tela "Redefinir", que lê o token do fragmento e o tira da barra
- [x] 6.3 — `docs/interface.md`: as duas telas e a entrada
- [x] 6.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/pages/EsqueciASenha.tsx` | novo |
| `apps/web/src/pages/RedefinirSenha.tsx` | novo |
| `apps/web/src/pages/Entrar.tsx` | alterado |
| `apps/web/src/paths.ts` | alterado |
| `apps/web/src/routes.tsx` | alterado |
| `apps/web/src/api/senha.ts` | novo |
| `docs/interface.md` | alterado |
| `e2e/esqueci-a-senha.spec.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| esqueci → redefinir pelo Mailpit | e2e | volta à entrada com o aviso, sem login automático | `esqueci → e-mail: o pedido pela tela faz chegar o link da redefinição`; `esqueci → e-mail → senha nova: volta à entrada com o aviso, sem login automático e sem sessão aberta`; `depois de trocada pelo link, a senha nova entra` |
| link na entrada da equipe | e2e | leva ao "Esqueci" | `a entrada da equipe leva ao "Esqueci"; a tela inicial pede o e-mail e manda o aluno ao professor` |
| "Esqueci" inicial | e2e | campo de e-mail e "Aluno: peça a senha provisória ao professor" | o mesmo caso do link na entrada |
| a entrada do aluno não leva "Esqueci" | e2e | o link só existe na entrada da equipe (`docs/interface.md`) | `a entrada do aluno, pelo endereço da escola, não leva "Esqueci a senha"…` |
| "Esqueci" enviado | e2e | a mesma frase para todos | `enviado: a mesma frase para quem tem conta e para quem não tem, sem repetir o e-mail`. O e2e simula o 202: que conta e sem conta recebem a mesma resposta, no mesmo piso, está provado na API da 5.0, em `apps/api/test/senha-esqueci.int.test.ts › e-mail com conta e e-mail sem conta: a mesma resposta, o mesmo piso de 400 ms, e o log só com ids` |
| estados: botão ocupado e rede com "Tentar de novo" | e2e | o texto de "Telas", nas duas | `botão ocupado: "Enviando…"…` e `rede: o aviso diz o que fazer e o e-mail fica…` (Esqueci); `botão ocupado: "Salvando…"…` e `rede: o aviso diz o que fazer e a senha fica…` (Redefinir) |
| "Redefinir" inicial | e2e | regra visível, "mostrar senha", `autocomplete="new-password"` | `tela inicial: a regra à vista, "Mostrar a senha" e o preenchimento de senha nova do navegador` |
| link vencido, usado ou inválido | e2e | "Este link não vale mais…" | `link vencido, usado ou inventado…`; `o mesmo link, aberto de novo depois de usado, não vale…`. O e2e cobre o usado e o inventado; o vencido e o substituído caem na mesma resposta, provado na API da 5.0, em `apps/api/test/senha-esqueci.int.test.ts › o link vencido, o usado e o substituído dão a mesma resposta de link inválido, e o link novo cancela o antigo na hora` |
| senha recusada | e2e | mostra a regra | `senha recusada: a regra aparece no campo, o foco volta a ele e o link continua na tela`. Com token inventado, o e2e prova só que o formulário fica; que o link verdadeiro continua valendo depois da recusa está provado na API da 5.0, em `apps/api/test/senha-esqueci.int.test.ts › a senha curta é recusada antes de tudo, e o corpo com chave a mais também` (o link segue aberto) |
| recomeço: 2ª pessoa | e2e | não se aplica: tela anônima, sem sessão | não se aplica (tela anônima, sem sessão) |
| recomeço: o mesmo link colado de novo | e2e | estado refeito, token fora da barra | `o mesmo link colado de novo: o estado volta ao início, o token fora da barra e o foco no campo` |
| recomeço: resposta atrasada (`page.route`) | e2e | não sobrescreve | `resposta atrasada: o envio do link anterior que responde depois de outro link chegar não troca a tela do link novo` |
| recomeço: falha de rede | e2e | aviso e foco saem na nova tentativa | `falha de rede: o aviso e o botão "Tentar de novo" saem na nova tentativa, que recomeça com o campo vazio e o foco nele` |
| 360 px | e2e | sem rolagem horizontal; 44 e 24 px | os quatro casos de `Esqueci e Redefinir: 360 px` (Entrar com o link, Esqueci, Redefinir e o aviso do link que não vale) |

## Como testar

- Precedente: `e2e/entrar-na-escola.spec.ts` › "caminho feliz só com teclado: o aluno vê o nome da escola, digita matrícula e senha e entra, com foco visível"; o token no `#`: como o `Convite.tsx`
- Apoio: `criarEquipeComSenha` (`e2e/support/seed.ts:87`), `horizontalOverflow` e `seriousViolations` (`e2e/support/checks.ts`); o e-mail pela API do Mailpit
- Comando: `node tools/ci/e2e.ts --manter-ambiente e2e/esqueci-a-senha.spec.ts`
- Telas: anônimo, `/entrar` › "Esqueci a senha"; o "Redefinir" pelo link do e-mail

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 2: "Tentar de novo" e "Esqueci" já aparecem em `e2e/`?

## Fora do escopo desta tarefa

A API (5.0); o "Verificar" (8.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

--faltando: 0 linhas (33 blocos, 0 motivos). Cada bloco foi pensado contra a linha que ele tira; o portão aplica, roda o caso e exige vermelho.

Duas linhas sem bloco, com o motivo: `definirSenha('')` em `if (trocada)` e `definirSenha('')` no ramo `NAO_ENCONTRADO` de `RedefinirSenha.tsx`. A tela sai dali (navega, ou troca para `LinkQueNaoVale`) na mesma renderização, e nenhum caso observa um estado que já não está montado; a senha sai da memória porque o componente é desmontado, e o `definirSenha('')` é a segunda garantia.

```mutacao
arquivo: apps/web/src/pages/EsqueciASenha.tsx
teste: e2e/esqueci-a-senha.spec.ts › enviado: a mesma frase
  useEffect(() => {
-    if (enviado) confirmacao.current?.focus()
  }, [enviado])
```

```mutacao
arquivo: apps/web/src/pages/EsqueciASenha.tsx
teste: e2e/esqueci-a-senha.spec.ts › botão ocupado: "Enviando…"
  async function pedir(deNovo: boolean): Promise<void> {
-    if (noAr.current) return
    noAr.current = true
```

```mutacao
arquivo: apps/web/src/pages/EsqueciASenha.tsx
teste: e2e/esqueci-a-senha.spec.ts › rede: o aviso diz o que fazer e o e-mail fica
    definirEnviando(true)
-    if (!deNovo) definirFalha(undefined)
+    definirFalha(undefined)
    try {
```

```mutacao
arquivo: apps/web/src/pages/EsqueciASenha.tsx
teste: e2e/esqueci-a-senha.spec.ts › rede: o aviso diz o que fazer e o e-mail fica
falha: toHaveCount(0)
    definirEnviando(true)
-    if (!deNovo) definirFalha(undefined)
+    if (false) definirFalha(undefined)
    try {
```

```mutacao
arquivo: apps/web/src/pages/EsqueciASenha.tsx
teste: e2e/esqueci-a-senha.spec.ts › enviado: a mesma frase
-  if (enviado) {
+  if (false) {
    return (
      <CascaPublica titulo="Esqueci a senha">
```

```mutacao
arquivo: apps/web/src/pages/EsqueciASenha.tsx
teste: e2e/esqueci-a-senha.spec.ts › rede: o aviso diz o que fazer e o e-mail fica
-        {falha !== undefined && <ErrorState erro={falha} aoTentarDeNovo={() => void pedir(true)} tentando={enviando} />}
+        {false && <ErrorState erro={falha} aoTentarDeNovo={() => void pedir(true)} tentando={enviando} />}
        <Button type="submit" disabled={enviando} className="w-full">
```

```mutacao
arquivo: apps/web/src/pages/EsqueciASenha.tsx
teste: e2e/esqueci-a-senha.spec.ts › botão ocupado: "Enviando…"
-          {enviando ? 'Enviando…' : 'Enviar o link'}
+          {'Enviar o link'}
        </Button>
```

```mutacao
arquivo: apps/web/src/pages/EsqueciASenha.tsx
teste: e2e/esqueci-a-senha.spec.ts › botão ocupado: "Enviando…"
        <span role="status" className="sr-only">
-          {enviando ? 'Enviando…' : ''}
+          {''}
        </span>
```

```mutacao
arquivo: apps/web/src/pages/EsqueciASenha.tsx
teste: e2e/esqueci-a-senha.spec.ts › botão ocupado: "Enviando…"
-        <Button type="submit" disabled={enviando} className="w-full">
+        <Button type="submit" disabled={false} className="w-full">
```

```mutacao
arquivo: apps/web/src/pages/RedefinirSenha.tsx
teste: e2e/esqueci-a-senha.spec.ts › link vencido, usado ou inventado
  const { token, vez, vezAtual } = useLinkColado()
-  if (token === undefined) return <LinkQueNaoVale />
  return <FormularioDaSenha key={vez} token={token} vez={vez} vezAtual={vezAtual} />
```

```mutacao
arquivo: apps/web/src/pages/RedefinirSenha.tsx
teste: e2e/esqueci-a-senha.spec.ts › o mesmo link colado de novo: o estado volta
-  return <FormularioDaSenha key={vez} token={token} vez={vez} vezAtual={vezAtual} />
+  return <FormularioDaSenha token={token} vez={vez} vezAtual={vezAtual} />
```

```mutacao
arquivo: apps/web/src/pages/RedefinirSenha.tsx
teste: e2e/esqueci-a-senha.spec.ts › o mesmo link colado de novo: o estado volta
  useEffect(() => {
-    campo.current?.focus()
  }, [])
```

```mutacao
arquivo: apps/web/src/pages/RedefinirSenha.tsx
teste: e2e/esqueci-a-senha.spec.ts › botão ocupado: "Salvando…"
  async function salvar(deNovo: boolean): Promise<void> {
-    if (noAr.current) return
    noAr.current = true
```

```mutacao
arquivo: apps/web/src/pages/RedefinirSenha.tsx
teste: e2e/esqueci-a-senha.spec.ts › rede: o aviso diz o que fazer e a senha fica
    definirRecusada(false)
-    if (!deNovo) definirFalha(undefined)
+    definirFalha(undefined)
    let trocada = false
```

```mutacao
arquivo: apps/web/src/pages/RedefinirSenha.tsx
teste: e2e/esqueci-a-senha.spec.ts › rede: o aviso diz o que fazer e a senha fica
falha: toHaveCount(0)
    definirRecusada(false)
-    if (!deNovo) definirFalha(undefined)
+    if (false) definirFalha(undefined)
    let trocada = false
```

```mutacao
arquivo: apps/web/src/pages/RedefinirSenha.tsx
teste: e2e/esqueci-a-senha.spec.ts › resposta atrasada: o envio do link anterior
    // Outro link chegou enquanto o envio estava no ar: a tela já é a dele, e nada daqui muda.
-    if (vezAtual() !== vez) return
    definirSalvando(false)
```

```mutacao
arquivo: apps/web/src/pages/RedefinirSenha.tsx
teste: e2e/esqueci-a-senha.spec.ts › botão ocupado: "Salvando…"
-    if (trocada) {
+    if (false) {
      // A senha sai da memória da tela assim que a resposta chega.
```

```mutacao
arquivo: apps/web/src/pages/RedefinirSenha.tsx
teste: e2e/esqueci-a-senha.spec.ts › link vencido, usado ou inventado
-    const codigo = erro instanceof ApiError ? erro.codigo : undefined
+    const codigo = undefined
    if (codigo === ErrorCode.NAO_ENCONTRADO) {
```

```mutacao
arquivo: apps/web/src/pages/RedefinirSenha.tsx
teste: e2e/esqueci-a-senha.spec.ts › link vencido, usado ou inventado
-    if (codigo === ErrorCode.NAO_ENCONTRADO) {
+    if (false) {
      definirSenha('')
```

```mutacao
arquivo: apps/web/src/pages/RedefinirSenha.tsx
teste: e2e/esqueci-a-senha.spec.ts › senha recusada: a regra aparece
-    } else if (codigo === ErrorCode.ENTRADA_INVALIDA) {
+    } else if (false) {
      definirRecusada(true)
```

```mutacao
arquivo: apps/web/src/pages/RedefinirSenha.tsx
teste: e2e/esqueci-a-senha.spec.ts › senha recusada: a regra aparece
      definirRecusada(true)
-      campo.current?.focus()
    } else definirFalha(erro)
```

```mutacao
arquivo: apps/web/src/pages/RedefinirSenha.tsx
teste: e2e/esqueci-a-senha.spec.ts › link vencido, usado ou inventado
-  if (invalido) return <LinkQueNaoVale />
```

```mutacao
arquivo: apps/web/src/pages/RedefinirSenha.tsx
teste: e2e/esqueci-a-senha.spec.ts › senha recusada: a regra aparece
-          erro={recusada ? `A senha precisa ter pelo menos ${String(TAMANHO_MINIMO_SENHA_NOVA)} caracteres.` : undefined}
+          erro={undefined}
          name="senha"
```

```mutacao
arquivo: apps/web/src/pages/RedefinirSenha.tsx
teste: e2e/esqueci-a-senha.spec.ts › senha recusada: a regra aparece
falha: toHaveCount(0)
            definirSenha(evento.target.value)
-            definirRecusada(false)
          }}
```

```mutacao
arquivo: apps/web/src/pages/RedefinirSenha.tsx
teste: e2e/esqueci-a-senha.spec.ts › rede: o aviso diz o que fazer e a senha fica
-        {falha !== undefined && <ErrorState erro={falha} aoTentarDeNovo={() => void salvar(true)} tentando={salvando} />}
+        {false && <ErrorState erro={falha} aoTentarDeNovo={() => void salvar(true)} tentando={salvando} />}
        <Button type="submit" disabled={salvando} className="w-full">
```

```mutacao
arquivo: apps/web/src/pages/RedefinirSenha.tsx
teste: e2e/esqueci-a-senha.spec.ts › botão ocupado: "Salvando…"
-          {salvando ? 'Salvando…' : 'Definir a senha'}
+          {'Definir a senha'}
        </Button>
```

```mutacao
arquivo: apps/web/src/pages/RedefinirSenha.tsx
teste: e2e/esqueci-a-senha.spec.ts › botão ocupado: "Salvando…"
        <span role="status" className="sr-only">
-          {salvando ? 'Salvando…' : ''}
+          {''}
        </span>
```

```mutacao
arquivo: apps/web/src/pages/RedefinirSenha.tsx
teste: e2e/esqueci-a-senha.spec.ts › o mesmo link colado de novo: o estado volta
  useEffect(() => {
-    clearFragment()
  }, [token, vez])
```

```mutacao
arquivo: apps/web/src/pages/RedefinirSenha.tsx
teste: e2e/esqueci-a-senha.spec.ts › resposta atrasada: o envio do link anterior
      vezDoLink.current++
-      definirToken(readFragmentToken())
      definirVez(vezDoLink.current)
```

```mutacao
arquivo: apps/web/src/pages/Entrar.tsx
teste: e2e/entrar.spec.ts › "Sair" que a API não confirma avisa na entrada
-      {saidaPendente() && (
+      {false && (
        <p role="alert" className="rounded-controle border border-pendente bg-pendente-cx p-4 text-pendente">
          Não foi possível encerrar a sessão anterior neste computador. Entre e saia de novo, ou feche o navegador antes
```

```mutacao
arquivo: apps/web/src/pages/Entrar.tsx
teste: e2e/esqueci-a-senha.spec.ts › esqueci → e-mail → senha nova
-      {avisoDaEntrada() !== undefined && (
+      {false && (
        <p role="alert" className="rounded-controle border border-pendente bg-pendente-cx p-4 text-pendente">
          {avisoDaEntrada()}
```

```mutacao
arquivo: apps/web/src/pages/Entrar.tsx
teste: e2e/esqueci-a-senha.spec.ts › a entrada da equipe leva ao
      </form>
-      <LinkEsqueciASenha />
    </CascaPublica>
```

```mutacao
arquivo: apps/web/src/pages/EntrarNaEscola.tsx
teste: e2e/esqueci-a-senha.spec.ts › a entrada do aluno, pelo endereço da escola, não leva
falha: toHaveCount(0)
        {entrando ? 'Entrando…' : ''}
      </span>
-    </form>
+      <a href="/esqueci">Esqueci a senha</a>
+    </form>
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| frontend-reviewer (1ª) | "Esqueci a senha" na entrada com a mesma aparência de botão que "Entrar"; link de texto mais discreto | Recusada: o `docs/interface.md` define o botão e o revisor diz que "é só gosto" |
| frontend-reviewer (1ª), privacy-guardian (1ª), revisor-geral (1ª) | Derivar "Ele vale 1 hora." de uma constante em `@educa/shared`; dar nome genérico ao `TAMANHO_MAXIMO_TOKEN_DE_CONVITE`, hoje usado também pelos links de redefinir e verificar | `TODO.md`: toca `packages/shared`, fora dos arquivos desta tarefa |
| revisor-geral (1ª) | Tirar os avisos de `Entrar.tsx` para `AvisosDaEntrada` não estava pedido | Sem mudança: "é inofensivo e as mutações cobrem" |
| test-engineer (1ª) | `RedefinirSenha.tsx`, `definirFalha(undefined)` depois da resposta, sem caso (depois de "Tentar de novo", a API recusa a senha e o aviso de rede deve sair com a regra no campo) | `TODO.md`: caso novo de e2e; não é condição e o portão não cobra bloco |
| infra-guardian (1ª) | O balde de 10 pedidos por minuto por IP da 5.0 descarta sem aviso o excedente da equipe de uma escola que sai pelo mesmo IP | Retro da funcionalidade: medir se o descarte acontece; a 5.0 já está commitada |
| privacy-guardian (1ª) | Na falha de rede do "Redefinir" a senha fica no campo para o "Tentar de novo" | Retro: registrar que foi escolha da spec; o revisor diz que não é furo |
| frontend-reviewer (2ª), revisor-geral (2ª) | `apps/web/src/api/senha.ts`: linhas do comentário acima de 130 colunas depois da edição; "(regra 50, item 4)" cita a regra para o contrato em `packages/shared`, que é a regra 00 | `TODO.md`: comentário, e mexer nele caduca os sete revisores; entra na próxima tarefa que tocar o arquivo |
| frontend-reviewer (2ª) | Em `/redefinir` sem token, "Esqueci a senha" é o único caminho; um "Voltar para entrar" ao lado ajudaria | `TODO.md`: o texto da tela vem de `cenarios.md` "Telas"; mudar é decisão da spec, não desta tarefa |
| infra-guardian (2ª) | `e2e/esqueci-a-senha.spec.ts`: o bloco "Redefinir" gasta 8 dos 10 pedidos por minuto do balde; zerar o balde no seed do e2e ou deixar o limite configurável no ambiente de teste | `TODO.md`: o comentário do teto já está no arquivo; mexer no seed ou no limite é tarefa própria de infra de teste |
| test-engineer (2ª) | `e2e/esqueci-a-senha.spec.ts:96` e `:153` usam o heading com o nome da escola para saber que a tela montou | Sem mudança: o revisor diz que não bloqueia, e o portão já conferiu o motivo da falha |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-08 18:31:22 | 2026-11-08 18:31:55 | `frontend-reviewer` | 1 | APROVADO | a85c24962f7435da0 |
| 2026-11-08 18:31:38 | 2026-11-08 18:31:56 | `conformidade-reviewer` | 1 | APROVADO | a0a2434997de524a9 |
| 2026-11-08 18:31:32 | 2026-11-08 18:31:57 | `tenancy-guardian` | 1 | APROVADO | a4abb1df76da046bb |
| 2026-11-08 18:31:40 | 2026-11-08 18:32:11 | `infra-guardian` | 1 | APROVADO | a4c2e609463339691 |
| 2026-11-08 18:31:24 | 2026-11-08 18:32:22 | `privacy-guardian` | 1 | APROVADO | a2c11c5dff46e56d3 |
| 2026-11-08 18:31:30 | 2026-11-08 18:32:46 | `revisor-geral` | 1 | REPROVADO | ac21f9dc246ff56e1 |
| 2026-11-08 18:31:27 | 2026-11-08 18:33:33 | `test-engineer` | 1 | REPROVADO | a2bdfdb8032a6c8b6 |
| 2026-11-08 19:56:49 | 2026-11-08 19:57:10 | `frontend-reviewer` | 2 | APROVADO | a74a25a14a2cff267 |
| 2026-11-08 19:56:54 | 2026-11-08 19:57:23 | `privacy-guardian` | 2 | APROVADO | a9a29760fbd783d1e |
| 2026-11-08 19:57:06 | 2026-11-08 19:57:28 | `revisor-geral` | 2 | APROVADO | a8bf0138dca045aaa |
| 2026-11-08 19:57:11 | 2026-11-08 19:57:30 | `tenancy-guardian` | 2 | APROVADO | adc3075a9ded996d6 |
| 2026-11-08 19:57:18 | 2026-11-08 19:57:33 | `conformidade-reviewer` | 2 | APROVADO | abaa16dc23f0fc2a5 |
| 2026-11-08 19:57:23 | 2026-11-08 19:57:40 | `infra-guardian` | 2 | APROVADO | a5edff4d8cf4bc456 |
| 2026-11-08 19:57:00 | 2026-11-08 19:57:41 | `test-engineer` | 2 | APROVADO | ac7fa64e2a05233d2 |
