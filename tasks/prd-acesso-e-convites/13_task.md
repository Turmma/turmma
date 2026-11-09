# Tarefa 13.0 — A tela "Trocar a senha provisória"

**Funcionalidade:** acesso-e-convites · **Depende de:** 10.0
**Subagentes obrigatórios:** `frontend-reviewer`, `privacy-guardian`, `test-engineer`
**Porte:** pequeno

## Objetivo

Depois do login com a provisória, o aluno vê as provisórias geradas antes (quem gerou, quando, se usada) e define a senha dele, entrando em seguida; a lista que falha não bloqueia a troca.

## Contexto necessário

- `techspec.md` seção 9; `cenarios.md` "Telas" (Trocar a provisória) e RF13 ([E] da tela)
- `prd.md` RF13, RF18
- `.claude/rules/50`
- `apps/web/src/pages/EntrarNaEscola.tsx` (onde chega a etapa `trocar_senha`)

## Subtarefas

- [x] 13.1 — A tela, com o bilhete só em memória
- [x] 13.2 — A lista: esqueleto, "primeira vez", "Tentar de novo"
- [x] 13.3 — `docs/interface.md`
- [x] 13.4 — O `docs/roteiro-da-demonstracao.md` (seção 2, passo 12) conferido contra `e2e/roteiro-da-demonstracao.spec.ts`
- [x] 13.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/pages/TrocarSenhaProvisoria.tsx` | novo |
| `apps/web/src/pages/EntrarNaEscola.tsx` | alterado |
| `apps/web/src/api/troca-da-provisoria.ts` | novo |
| `docs/interface.md` | alterado |
| `e2e/troca-da-provisoria.spec.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| provisória → troca → entra | e2e | a sessão do aluno | `e2e/troca-da-provisoria.spec.ts › provisória → troca → entra` |
| primeira troca | e2e | "É a primeira vez…", sem tabela vazia | `e2e/troca-da-provisoria.spec.ts › primeira troca` |
| lista falhou | e2e | aviso com "Tentar de novo", o campo segue | `e2e/troca-da-provisoria.spec.ts › lista falhou` |
| bilhete vencido | e2e | "Peça a senha de novo ao professor" | `e2e/troca-da-provisoria.spec.ts › bilhete vencido` |
| datas | e2e | "Gerada pela coordenação em 12/11/2026 às 14:05 · usada" | `e2e/troca-da-provisoria.spec.ts › datas` |
| carregando | e2e | esqueleto | `e2e/troca-da-provisoria.spec.ts › carregando` |
| o bilhete | e2e | fora da URL, do armazenamento e dos cookies legíveis; só no `Authorization` (a chave de consulta sem o bilhete é a asserção estrutural de `api/troca-da-provisoria.test.ts › lê com o bilhete no Authorization`) | `e2e/troca-da-provisoria.spec.ts › o bilhete fica fora da URL` |
| recarregar a tela perde o bilhete | e2e | a tela manda entrar de novo, e a mesma provisória ainda vale | `e2e/troca-da-provisoria.spec.ts › recarregar a tela perde o bilhete de propósito` |
| clique repetido em "Criar a senha e entrar" | e2e | com o pedido em andamento, o botão fica desabilitado e vai uma troca só | `e2e/troca-da-provisoria.spec.ts › clique repetido em "Criar a senha e entrar"` |
| recomeço: o colega no mesmo computador | e2e | nada do anterior | `e2e/troca-da-provisoria.spec.ts › o colega no mesmo computador` |
| recomeço: resposta atrasada | e2e | o resultado: a lista do aluno que saiu, chegando depois, não troca a de quem entrou. Não prova o número na chave (o TanStack também aborta a leitura de quem saiu ao desmontar a tela, pelo `signal`); o número na chave é provado pela asserção estrutural (`queryKey(2)` diferente de `queryKey(1)`) | `e2e/troca-da-provisoria.spec.ts › resposta atrasada` e `TrocarSenhaProvisoria.test.tsx › a resposta da lista do aluno que saiu, chegando depois, não troca a lista de quem entrou`; a chave: `api/troca-da-provisoria.test.ts › lê com o bilhete no Authorization` |
| recomeço: erro | e2e | o aviso sai na nova tentativa | `e2e/troca-da-provisoria.spec.ts › erro: o aviso da senha recusada` |
| 360 px | e2e | sem rolagem horizontal; 44 e 24 px | `e2e/troca-da-provisoria.spec.ts › a troca com a lista` e `› o aviso da lista que falhou`, no projeto `celular` |
| o diálogo "Sua sessão expirou" recebe `trocar_senha` | componente | leva à troca da escola do aluno, com o bilhete em memória | `components/ReauthDialog.test.tsx › o aluno que digita a senha provisória…` |
| o diálogo da equipe, sem o endereço da escola | unidade | a etapa cai na entrada | `paths.test.ts › sem o endereço da escola` |

Os casos de componente e de unidade (`apps/web/src/pages/TrocarSenhaProvisoria.test.tsx`, `api/troca-da-provisoria.test.ts`, `components/ReauthDialog.test.tsx`, `paths.test.ts`, `format.test.ts`) provam cada ramo da tela e do módulo da troca, e são os que as mutações abaixo derrubam.

## Como testar

- Precedente: `e2e/entrar-na-escola.spec.ts` › "caminho feliz só com teclado…" e "clique repetido em "Entrar" não manda dois logins…"; `e2e/aluno-eu.spec.ts` › "o aluno seguinte no mesmo computador vê o Eu dele…"
- Apoio: `criarAlunoComMatricula` (`e2e/support/seed.ts`); a provisória, de agora e as de antes, é gravada no banco por `gerarProvisoriaNoBanco`, e não gerada pela API como na 10.0: as de antes precisam de datas e de autores que a API não dá (a lista é a das provisórias geradas e usadas em datas fixas, como "12/11/2026 às 14:05", e a geração de agora tem de vir depois da mais nova delas), e o que a 13.0 prova é o que vem **depois** do login com a provisória. O helper não grava `provisoria_gerada_por`, que a troca e a lista não leem. Quem prova a geração pela API é a 10.0, e a geração pela tela é a 12.0
- Comando: `node tools/ci/e2e.ts --manter-ambiente e2e/troca-da-provisoria.spec.ts`
- Telas: `aluno`, `/e/:slug` › login com a provisória › troca

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 2: "Tentar de novo" já aparece em `e2e/`?

## Fora do escopo desta tarefa

A API (10.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O diálogo "Sua sessão expirou" (`ReauthDialog.tsx`) é um segundo chamador de `entrarPorMatricula`, e o plano só citava `EntrarNaEscola.tsx`: com a provisória, ele também recebe `trocar_senha` e, sem tratamento, navegaria para uma rota que não existe. Os dois passam pelo mesmo `caminhoDaEtapaDaEntrada` (`paths.ts`); sem o endereço da escola (o diálogo da equipe), a etapa cai na entrada | O mesmo caminho para os dois chamadores evita duas tabelas de rota; o bilhete segue só em memória | `techspec.md` §9 (último parágrafo); `cenarios.md` RF13, o [E] do bilhete da troca e o [U] do diálogo |

## Mutações

--faltando: 1 linha (57 blocos, 2 motivos). Cada bloco de unidade e de componente foi aplicado e rodado antes do pedido (executor local sobre o mesmo `comandoDoTeste` do portão): todos ficaram vermelhos num caso que rodou e falhou, e o `falha:` de cada negativa caiu na linha dela. Os da rota (`routes.tsx`) e da chamada com o endereço da escola (`EntrarNaEscola.tsx`) são de e2e e só o portão os roda.

```mutacao
arquivo: apps/web/src/api/sessao.ts
teste: apps/web/src/api/troca-da-provisoria.test.ts › guarda o bilhete em memória
-  if (resposta.etapa === ETAPA_TROCAR_SENHA) {
+  if (resposta.etapa !== ETAPA_TROCAR_SENHA) {
```

```mutacao
arquivo: apps/web/src/api/sessao.ts
teste: apps/web/src/api/troca-da-provisoria.test.ts › sem bilhete nesta aba
-  if (guardado === undefined) return Promise.reject(new ApiError(ErrorCode.NAO_AUTENTICADO))
```

```mutacao
arquivo: apps/web/src/api/sessao.ts
teste: apps/web/src/api/troca-da-provisoria.test.ts › manda o bilhete só no Authorization
-  if (guardado === undefined) return Promise.reject(new ApiError(ErrorCode.NAO_AUTENTICADO))
+  if (guardado !== undefined) return Promise.reject(new ApiError(ErrorCode.NAO_AUTENTICADO))
```

```mutacao
arquivo: apps/web/src/api/sessao.ts
teste: apps/web/src/api/troca-da-provisoria.test.ts › o aluno seguinte no mesmo computador
-  numeroDoUltimoBilhete += 1
+  numeroDoUltimoBilhete = 1
```

```mutacao
arquivo: apps/web/src/api/sessao.ts
teste: apps/web/src/api/troca-da-provisoria.test.ts › o login comum que abre a sessão
falha: expect(sessao.bilheteDaTroca()).toBeUndefined()
   bilheteDeConvite = undefined
-  bilheteDaTrocaGuardado = undefined
```

```mutacao
arquivo: apps/web/src/api/sessao.ts
teste: apps/web/src/api/troca-da-provisoria.test.ts › esquece o bilhete
falha: expect(sessao.bilheteDaTroca()).toBeUndefined()
 export function esquecerBilheteDaTroca(): void {
-  bilheteDaTrocaGuardado = undefined
```

```mutacao
arquivo: apps/web/src/api/sessao.ts
teste: apps/web/src/api/troca-da-provisoria.test.ts › manda o bilhete só no Authorization
   return comFilaDoSemaforo(() => apiRequest(CAMINHO_DA_TROCA_DA_PROVISORIA, loginResponseSchema, { metodo: 'POST', corpo: { senha }, token: guardado.valor })).then((resposta) => {
-    guardarEtapa(resposta)
     return resposta
```

```mutacao
arquivo: apps/web/src/api/troca-da-provisoria.ts
teste: apps/web/src/api/troca-da-provisoria.test.ts › sem bilhete, a leitura falha
-      if (bilhete === undefined) return Promise.reject(new ApiError(ErrorCode.NAO_AUTENTICADO))
```

```mutacao
arquivo: apps/web/src/api/troca-da-provisoria.ts
teste: apps/web/src/api/troca-da-provisoria.test.ts › lê com o bilhete no Authorization
falha: expect(troca.trocasDaProvisoriaQueryOptions(2).queryKey).not.toEqu
-    queryKey: ['troca-da-provisoria', 'anteriores', numeroDoBilhete] as const,
+    queryKey: ['troca-da-provisoria', 'anteriores'] as const,
```

```mutacao
arquivo: apps/web/src/api/troca-da-provisoria.ts
teste: apps/web/src/api/troca-da-provisoria.test.ts › lê com o bilhete no Authorization
-      return apiRequest(CAMINHO_DAS_TROCAS, trocasDaProvisoriaResponseSchema, { sinal: signal, token: bilhete.valor })
+      return apiRequest(CAMINHO_DAS_TROCAS, trocasDaProvisoriaResponseSchema, { sinal: signal })
```

```mutacao
arquivo: apps/web/src/api/troca-da-provisoria.ts
teste: apps/web/src/api/troca-da-provisoria.test.ts › lê com o bilhete no Authorization
-    gcTime: 0,
+    gcTime: 300_000,
```

```mutacao
arquivo: apps/web/src/api/troca-da-provisoria.ts
teste: apps/web/src/api/troca-da-provisoria.test.ts › lê com o bilhete no Authorization
falha: expect(opcoes.staleTime).toBe(Infinity)
-    staleTime: Infinity,
+    staleTime: 0,
```

```mutacao
arquivo: apps/web/src/api/troca-da-provisoria.ts
teste: apps/web/src/api/troca-da-provisoria.test.ts › lê com o bilhete no Authorization
falha: expect(opcoes.refetchOnWindowFocus).toBe(false)
-    refetchOnWindowFocus: false,
+    refetchOnWindowFocus: true,
```

```mutacao
arquivo: apps/web/src/api/troca-da-provisoria.ts
teste: apps/web/src/api/troca-da-provisoria.test.ts › cada linha diz quem gerou
-const QUEM_GEROU: Readonly<Record<PapelQueGeraASenhaProvisoria, string>> = { coordenador: 'pela coordenação', professor: 'pelo professor' }
+const QUEM_GEROU: Readonly<Record<PapelQueGeraASenhaProvisoria, string>> = { coordenador: 'pelo professor', professor: 'pela coordenação' }
```

```mutacao
arquivo: apps/web/src/api/troca-da-provisoria.ts
teste: apps/web/src/api/troca-da-provisoria.test.ts › cada linha diz quem gerou
-  return `Gerada ${QUEM_GEROU[anterior.papel]} em ${formatDayAtTime(anterior.geradaEm)} · ${anterior.usada ? 'usada' : 'não usada'}`
+  return `Gerada ${QUEM_GEROU[anterior.papel]} em ${formatDayAtTime(anterior.geradaEm)} · ${anterior.usada ? 'não usada' : 'usada'}`
```

```mutacao
arquivo: apps/web/src/api/troca-da-provisoria.ts
teste: apps/web/src/api/troca-da-provisoria.test.ts › cada linha diz quem gerou
-  return `Gerada ${QUEM_GEROU[anterior.papel]} em ${formatDayAtTime(anterior.geradaEm)} · ${anterior.usada ? 'usada' : 'não usada'}`
+  return `Gerada ${QUEM_GEROU[anterior.papel]} em ${anterior.geradaEm} · ${anterior.usada ? 'usada' : 'não usada'}`
```

```mutacao
arquivo: apps/web/src/components/ReauthDialog.tsx
teste: apps/web/src/components/ReauthDialog.test.tsx › o aluno que digita a senha provisória
-      if (resposta.etapa !== 'pronta') navegar(caminhoDaEtapaDaEntrada(resposta.etapa, escolaSlug), { replace: true })
+      if (resposta.etapa === 'pronta') navegar(caminhoDaEtapaDaEntrada(resposta.etapa, escolaSlug), { replace: true })
```

```mutacao
arquivo: apps/web/src/components/ReauthDialog.tsx
teste: apps/web/src/components/ReauthDialog.test.tsx › o aluno que digita a senha provisória
-      if (resposta.etapa !== 'pronta') navegar(caminhoDaEtapaDaEntrada(resposta.etapa, escolaSlug), { replace: true })
+      if (resposta.etapa !== 'pronta') navegar(caminhoDaEtapaDaEntrada(resposta.etapa, undefined), { replace: true })
```

```mutacao
arquivo: apps/web/src/format.ts
teste: apps/web/src/format.test.ts › a data com o ano e a hora por extenso
-  return `${day}/${month}/${year} às ${hour}:${minute}`
+  return `${day}/${month} às ${hour}:${minute}`
```

```mutacao
arquivo: apps/web/src/format.ts
teste: apps/web/src/format.test.ts › a data com o ano e a hora por extenso
-  return `${day}/${month}/${year} às ${hour}:${minute}`
+  return `${day}/${month}/${year} ${hour}:${minute}`
```

```mutacao
arquivo: apps/web/src/format.ts
teste: apps/web/src/format.test.ts › a data com o ano e a hora por extenso
-  return `${day}/${month}/${year} às ${hour}:${minute}`
+  return `${month}/${day}/${year} às ${hour}:${minute}`
```

```mutacao
arquivo: apps/web/src/paths.ts
teste: apps/web/src/paths.test.ts › o login de matrícula com a provisória leva à troca
-  if (etapa !== ETAPA_TROCAR_SENHA) return LOGIN_STEP_ROUTE[etapa]
+  if (etapa === ETAPA_TROCAR_SENHA) return LOGIN_STEP_ROUTE[etapa]
```

```mutacao
arquivo: apps/web/src/paths.ts
teste: apps/web/src/paths.test.ts › o login de matrícula com a provisória leva à troca
-  if (etapa !== ETAPA_TROCAR_SENHA) return LOGIN_STEP_ROUTE[etapa]
```

```mutacao
arquivo: apps/web/src/paths.ts
teste: apps/web/src/paths.test.ts › sem o endereço da escola
-  return slug === undefined ? ROUTES.entrar : caminhoDaTrocaDaProvisoria(slug)
+  return slug !== undefined ? ROUTES.entrar : caminhoDaTrocaDaProvisoria(slug)
```

```mutacao
arquivo: apps/web/src/paths.ts
teste: apps/web/src/paths.test.ts › sem o endereço da escola
-  return slug === undefined ? ROUTES.entrar : caminhoDaTrocaDaProvisoria(slug)
+  return slug === undefined ? ROUTES.inicio : caminhoDaTrocaDaProvisoria(slug)
```

```mutacao
arquivo: apps/web/src/paths.ts
teste: apps/web/src/paths.test.ts › o endereço leva a escola no caminho
-  return ROUTES.trocarSenha.replace(':slug', encodeURIComponent(slug))
+  return ROUTES.trocarSenha.replace(':slug', slug)
```

```mutacao
arquivo: apps/web/src/pages/EntrarNaEscola.tsx
teste: e2e/troca-da-provisoria.spec.ts › provisória → troca → entra
-      navegar(caminhoDaEtapaDaEntrada(resposta.etapa, slug))
+      navegar(caminhoDaEtapaDaEntrada(resposta.etapa, undefined))
```

```mutacao
arquivo: apps/web/src/pages/TrocarSenhaProvisoria.tsx
teste: apps/web/src/pages/TrocarSenhaProvisoria.test.tsx › a tela aberta sem o bilhete
-  if (bilhete === undefined) return <SemBilhete slug={slug} />
```

```mutacao
arquivo: apps/web/src/pages/TrocarSenhaProvisoria.tsx
teste: apps/web/src/pages/TrocarSenhaProvisoria.test.tsx › a tela aberta sem o bilhete
-  if (bilhete === undefined) return <SemBilhete slug={slug} />
+  if (bilhete !== undefined) return <SemBilhete slug={slug} />
```

```mutacao
arquivo: apps/web/src/pages/TrocarSenhaProvisoria.tsx
teste: apps/web/src/pages/TrocarSenhaProvisoria.test.tsx › o bilhete vencido na hora de trocar
-  if (naoVale || ehNaoAutenticado(anteriores.error)) return <ProvisoriaQueNaoVale slug={slug} />
+  if (ehNaoAutenticado(anteriores.error)) return <ProvisoriaQueNaoVale slug={slug} />
```

```mutacao
arquivo: apps/web/src/pages/TrocarSenhaProvisoria.tsx
teste: apps/web/src/pages/TrocarSenhaProvisoria.test.tsx › a lista recusada pelo bilhete
-  if (naoVale || ehNaoAutenticado(anteriores.error)) return <ProvisoriaQueNaoVale slug={slug} />
+  if (naoVale) return <ProvisoriaQueNaoVale slug={slug} />
```

```mutacao
arquivo: apps/web/src/pages/TrocarSenhaProvisoria.tsx
teste: apps/web/src/pages/TrocarSenhaProvisoria.test.tsx › dois envios seguidos
-    if (noAr.current) return
```

```mutacao
arquivo: apps/web/src/pages/TrocarSenhaProvisoria.tsx
teste: apps/web/src/pages/TrocarSenhaProvisoria.test.tsx › a rede caiu
falha: expect(screen.queryByRole('alert')).toBeNull()
-    if (!deNovo) definirFalha(undefined)
```

```mutacao
arquivo: apps/web/src/pages/TrocarSenhaProvisoria.tsx
teste: apps/web/src/pages/TrocarSenhaProvisoria.test.tsx › a rede caiu
-    if (!deNovo) definirFalha(undefined)
+    definirFalha(undefined)
```

```mutacao
arquivo: apps/web/src/pages/TrocarSenhaProvisoria.tsx
teste: apps/web/src/pages/TrocarSenhaProvisoria.test.tsx › senha curta
     definirSalvando(true)
-    definirRecusada(false)
     if (!deNovo) definirFalha(undefined)
```

```mutacao
arquivo: apps/web/src/pages/TrocarSenhaProvisoria.tsx
teste: apps/web/src/pages/TrocarSenhaProvisoria.test.tsx › a senha nova abre a sessão
       // A senha sai da memória da tela assim que a resposta chega.
-      definirSenha('')
```

```mutacao
arquivo: apps/web/src/pages/TrocarSenhaProvisoria.tsx
teste: apps/web/src/pages/TrocarSenhaProvisoria.test.tsx › a senha nova abre a sessão
-      navegar(LOGIN_STEP_ROUTE[resposta.etapa], { replace: true })
```

```mutacao
arquivo: apps/web/src/pages/TrocarSenhaProvisoria.tsx
teste: apps/web/src/pages/TrocarSenhaProvisoria.test.tsx › o bilhete vencido na hora de trocar
-      if (codigo === ErrorCode.NAO_AUTENTICADO) aoNaoValer()
+      if (false) aoNaoValer()
```

```mutacao
arquivo: apps/web/src/pages/TrocarSenhaProvisoria.tsx
teste: apps/web/src/pages/TrocarSenhaProvisoria.test.tsx › senha curta
-      else if (codigo === ErrorCode.ENTRADA_INVALIDA) {
+      else if (false) {
```

```mutacao
arquivo: apps/web/src/pages/TrocarSenhaProvisoria.tsx
teste: apps/web/src/pages/TrocarSenhaProvisoria.test.tsx › senha curta
         definirRecusada(true)
-        campo.current?.focus()
```

```mutacao
arquivo: apps/web/src/pages/TrocarSenhaProvisoria.tsx
teste: apps/web/src/pages/TrocarSenhaProvisoria.test.tsx › senha curta
-        erro={recusada ? `A senha precisa ter pelo menos ${String(TAMANHO_MINIMO_SENHA_NOVA)} caracteres.` : undefined}
+        erro={undefined}
```

```mutacao
arquivo: apps/web/src/pages/TrocarSenhaProvisoria.tsx
teste: apps/web/src/pages/TrocarSenhaProvisoria.test.tsx › senha curta
falha: expect(screen.queryByText(`A senha precisa ter pelo menos ${String
-        erro={recusada ? `A senha precisa ter pelo menos ${String(TAMANHO_MINIMO_SENHA_NOVA)} caracteres.` : undefined}
+        erro={`A senha precisa ter pelo menos ${String(TAMANHO_MINIMO_SENHA_NOVA)} caracteres.`}
```

```mutacao
arquivo: apps/web/src/pages/TrocarSenhaProvisoria.tsx
teste: apps/web/src/pages/TrocarSenhaProvisoria.test.tsx › senha curta
falha: expect(screen.queryByText(`A senha precisa ter pelo menos ${String
           definirSenha(evento.target.value)
-          definirRecusada(false)
```

```mutacao
arquivo: apps/web/src/pages/TrocarSenhaProvisoria.tsx
teste: apps/web/src/pages/TrocarSenhaProvisoria.test.tsx › a rede caiu
-      {falha !== undefined &&
+      {false &&
```

```mutacao
arquivo: apps/web/src/pages/TrocarSenhaProvisoria.tsx
teste: apps/web/src/pages/TrocarSenhaProvisoria.test.tsx › a conta segurada diz quanto esperar
falha: expect(screen.queryByRole('button', { name: 'Tentar de novo' })).t
-        (ehContaSegurada(falha) ? (
+        (false ? (
```

```mutacao
arquivo: apps/web/src/pages/TrocarSenhaProvisoria.tsx
teste: apps/web/src/pages/TrocarSenhaProvisoria.test.tsx › a conta segurada diz quanto esperar
falha: expect(screen.queryByRole('button', { name: 'Tentar de novo' })).t
-        (ehContaSegurada(falha) ? (
+        (!ehContaSegurada(falha) ? (
```

```mutacao
arquivo: apps/web/src/pages/TrocarSenhaProvisoria.tsx
teste: apps/web/src/pages/TrocarSenhaProvisoria.test.tsx › dois envios seguidos
-        {salvando ? 'Salvando…' : 'Criar a senha e entrar'}
+        {'Criar a senha e entrar'}
```

```mutacao
arquivo: apps/web/src/pages/TrocarSenhaProvisoria.tsx
teste: apps/web/src/pages/TrocarSenhaProvisoria.test.tsx › dois envios seguidos
-        {salvando ? 'Salvando…' : ''}
+        {''}
```

```mutacao
arquivo: apps/web/src/pages/TrocarSenhaProvisoria.tsx
teste: apps/web/src/pages/TrocarSenhaProvisoria.test.tsx › dois envios seguidos
-      <Button type="submit" disabled={salvando} className="w-full">
+      <Button type="submit" className="w-full">
```

```mutacao
arquivo: apps/web/src/pages/TrocarSenhaProvisoria.tsx
teste: apps/web/src/pages/TrocarSenhaProvisoria.test.tsx › carregando
-  if (anteriores.isPending) return <EsqueletoDaLista />
```

```mutacao
arquivo: apps/web/src/pages/TrocarSenhaProvisoria.tsx
teste: apps/web/src/pages/TrocarSenhaProvisoria.test.tsx › a lista falhou
-  if (anteriores.isError) return <ErrorState erro={anteriores.error} aoTentarDeNovo={() => void anteriores.refetch({ cancelRefetch: false })} tentando={anteriores.isFetching} />
```

```mutacao
arquivo: apps/web/src/pages/TrocarSenhaProvisoria.tsx
teste: apps/web/src/pages/TrocarSenhaProvisoria.test.tsx › primeira troca
-  if (anteriores.data.anteriores.length === 0) return <p className="text-apoio">É a primeira vez que você troca a senha.</p>
```

```mutacao
arquivo: apps/web/src/pages/TrocarSenhaProvisoria.tsx
teste: apps/web/src/pages/TrocarSenhaProvisoria.test.tsx › a lista falhou
-  return erro instanceof ApiError && erro.codigo === ErrorCode.NAO_AUTENTICADO
+  return erro instanceof ApiError
```

```mutacao
arquivo: apps/web/src/pages/TrocarSenhaProvisoria.tsx
teste: apps/web/src/pages/TrocarSenhaProvisoria.test.tsx › a lista recusada pelo bilhete
-  return erro instanceof ApiError && erro.codigo === ErrorCode.NAO_AUTENTICADO
+  return erro instanceof ApiError && erro.codigo !== ErrorCode.NAO_AUTENTICADO
```

```mutacao
arquivo: apps/web/src/pages/TrocarSenhaProvisoria.tsx
teste: apps/web/src/pages/TrocarSenhaProvisoria.test.tsx › a rede caiu
-  return erro instanceof ApiError && erro.codigo === ErrorCode.CONTA_SEGURADA
+  return erro instanceof ApiError
```

```mutacao
arquivo: apps/web/src/pages/TrocarSenhaProvisoria.tsx
teste: apps/web/src/pages/TrocarSenhaProvisoria.test.tsx › com dado
-          {textoDaProvisoriaAnterior(anterior)}
+          {anterior.geradaEm}
```

```mutacao
arquivo: apps/web/src/routes.tsx
teste: e2e/troca-da-provisoria.spec.ts › provisória → troca → entra
-      <Route path={ROUTES.trocarSenha}>{(parametros) => <TrocarSenhaProvisoria slug={parametros.slug} />}</Route>
```

Linhas novas sem bloco, com o motivo de cada uma:

- `TrocarSenhaProvisoria.tsx`, `erro instanceof ApiError ? erro.codigo : undefined` (o `catch` da troca): o erro que não é `ApiError` (um `TypeError` de código) cai no mesmo `definirFalha(erro)` com ou sem o `instanceof`, porque `undefined` não é nenhum dos dois códigos tratados; tirar o teste só muda o tipo, não o resultado.
- `TrocarSenhaProvisoria.tsx`, o primeiro termo (`erro instanceof ApiError &&`) de `ehNaoAutenticado` e de `ehContaSegurada`: o `erro.codigo` de um valor que não é `ApiError` é `undefined` e nunca igual ao código; o termo fecha o tipo (`unknown`) e não há caminho que o alcance com resultado diferente. O segundo termo, que decide, tem bloco.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian (1ª) | O bilhete sobrevive ao botão "voltar" do navegador: só o link "Voltar à entrada", novo login ou recarregar o apagam; sugere `esquecerBilheteDaTroca()` ao montar `EntrarNaEscola`, caso e2e e ajuste do `docs/interface.md` | `TODO.md`: muda comportamento e acrescenta e2e, não é barata. O Orquestrador leva ao Arquiteto, que a trata como tarefa própria (o bilhete vale 10 min, na mesma aba) |
| privacy-guardian (1ª) | A chave dos itens da lista (`geradaEm-papel`) é estável e sem dado pessoal; "Não precisa mudar nada" | Nada a fazer: o revisor não pede mudança |
| infra-guardian (1ª) | Reenvio depois de falha de rede com a troca já gravada mostra "Peça a senha de novo ao professor"; sugere acrescentar "Se você já criou a sua senha, entre com ela" | `TODO.md`: muda o texto e o fluxo da tela, e o texto é do `cenarios.md`; decisão de produto |
| infra-guardian (1ª) | Não mexer no cenário de carga `login às 7h30`; registrar na Tech Spec | A Tech Spec é do Arquiteto: o Orquestrador leva o achado a ele (`achados/13_task.md`) |
| frontend-reviewer (1ª) | Frase "Não reconhece alguma? Avise o professor" sob o título da lista ("Só vale se o produto quiser esse caminho") | `TODO.md`: texto de produto novo, o revisor mesmo condiciona |
| frontend-reviewer (1ª) | A lista cheia rola 39 px a 1366 × 768 e o "Voltar à entrada" sai da primeira dobra | `TODO.md`: o revisor diz que nenhum RF pede que a tela caiba; é ajuste de layout, não barato |
| frontend-reviewer (1ª) | Onça esmaecida na foto da lista cheia | Nada a fazer no código: é a foto, tirada no meio da entrada de 240 ms; a Mesa espera a animação nas próximas fotos |
| conformidade-reviewer (1ª) | O aviso "Peça a senha de novo ao professor" aparece mesmo quando a coordenação gerou a provisória | Recusada: o texto é o que o `cenarios.md` pede (`[E]` Tela de troca: "bilhete vencido: "peça a senha de novo ao professor""), e o próprio revisor diz que não é tema da regra 70 |
| revisor-geral (1ª) | Conferir `bilhete.numero !== numeroDoBilhete → NAO_AUTENTICADO` em `troca-da-provisoria.ts:21` antes da leitura | `TODO.md`: muda código de produção; o revisor diz que hoje está protegido pelo `signal` do TanStack |
| revisor-geral (1ª) | Dois botões "Tentar de novo" com o mesmo nome acessível quando a lista e a troca falham juntas | `TODO.md`: ajuste de acessibilidade com texto novo; o `frontend-reviewer` aprovou sem exigi-lo |
| revisor-geral (1ª) | `techspec.md` §9 (linha 208) também diz "o número do aluno do bilhete" | A Tech Spec é do Arquiteto: o Orquestrador leva a troca do texto a ele, junto com o item 10 |
| test-engineer (2ª) | `e2e/troca-da-provisoria.spec.ts:115`: o `dispatchEvent('click')` sobre o botão já desabilitado repete o que o `toBeDisabled()` prova; uma trava no envio que não dependa do `disabled` teria mutação própria | Recusada: a trava do envio (`if (noAr.current) return`) tem bloco em "Mutações" e o caso `dois envios seguidos` do componente a derruba; o e2e prova o botão desabilitado e `pedidos === 1`, que é o que o título diz |
| test-engineer (2ª) | A tabela cita `ReauthDialog.test.tsx › o aluno que digita a senha provisória…` com reticências; o nome inteiro ajudaria a busca | Recusada: a busca acha pelo começo do nome; só vale se a linha for tocada de novo |
| privacy-guardian (2ª) | `TrocarSenhaProvisoria.test.tsx:209`: o título "a senha digitada sai da tela" devia dizer "o campo da senha sai da tela", que é o que a asserção que restou prova | `TODO.md`: só título de teste; entra na próxima vez que o arquivo for tocado |
| privacy-guardian (2ª) | O bilhete sobrevive ao botão "voltar" do navegador | O mesmo item da rodada 1, já na tabela, com destino `TODO.md` |
| infra-guardian (2ª) | Teste de integração da API com duas chamadas simultâneas a `trocar-senha` | Já existe: `apps/api/test/troca-da-provisoria.int.test.ts:810` (`[P] duas trocas com o mesmo bilhete…`, com `Promise.all`), da 10.0 |
| infra-guardian (2ª) | Registrar na Tech Spec que o cenário `login às 7h30` não muda | O mesmo item da rodada 1: é do Arquiteto, levado pelo Orquestrador |
| revisor-geral (2ª) | `techspec.md:208` ainda diz "o número do aluno do bilhete" e "nunca no cache de consultas", e o título do e2e deixou de afirmar o cache: ao corrigir o texto, alinhar as duas coisas | Do Arquiteto, levado pelo Orquestrador, junto com o item da rodada 1 |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-09 13:21:48 | 2026-11-09 13:22:24 | `frontend-reviewer` | 1 | APROVADO | a06136942dfe696d8 |
| 2026-11-09 13:22:06 | 2026-11-09 13:22:31 | `tenancy-guardian` | 1 | APROVADO | a46d6e643ab005535 |
| 2026-11-09 13:22:10 | 2026-11-09 13:22:41 | `conformidade-reviewer` | 1 | APROVADO | adfb843aafba9ce5f |
| 2026-11-09 13:21:52 | 2026-11-09 13:23:00 | `privacy-guardian` | 1 | APROVADO | a19d67d7cde71a0ae |
| 2026-11-09 13:22:15 | 2026-11-09 13:23:08 | `infra-guardian` | 1 | APROVADO | a0f63e2eeda7d21f1 |
| 2026-11-09 13:22:01 | 2026-11-09 13:24:11 | `revisor-geral` | 1 | APROVADO | ac352de32f0ee90b1 |
| 2026-11-09 13:21:57 | 2026-11-09 13:24:26 | `test-engineer` | 1 | REPROVADO | a1f7bd02900f2702e |
| 2026-11-09 14:14:48 | 2026-11-09 14:15:08 | `frontend-reviewer` | 2 | APROVADO | aaaf66c69f8e60679 |
| 2026-11-09 14:15:07 | 2026-11-09 14:15:21 | `tenancy-guardian` | 2 | APROVADO | a489539c81949a22f |
| 2026-11-09 14:14:41 | 2026-11-09 14:15:23 | `test-engineer` | 2 | APROVADO | aba806c682d18f9a4 |
| 2026-11-09 14:14:54 | 2026-11-09 14:15:23 | `privacy-guardian` | 2 | APROVADO | ac25d29553333c07d |
| 2026-11-09 14:15:13 | 2026-11-09 14:15:31 | `conformidade-reviewer` | 2 | APROVADO | a87152998bbb9f16e |
| 2026-11-09 14:15:18 | 2026-11-09 14:15:35 | `infra-guardian` | 2 | APROVADO | aad1e4744b454f226 |
| 2026-11-09 14:15:01 | 2026-11-09 14:15:54 | `revisor-geral` | 2 | APROVADO | a23621116ef1d7eda |
