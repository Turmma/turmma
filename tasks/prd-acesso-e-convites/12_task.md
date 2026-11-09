# Tarefa 12.0 — A tela "Gerar senha provisória"

**Funcionalidade:** acesso-e-convites · **Depende de:** 9.0, 17.0
**Subagentes obrigatórios:** `frontend-reviewer`, `privacy-guardian`, `test-engineer`
**Porte:** pequeno

## Objetivo

No menu da linha do aluno aprovado, na aba Alunos da turma do professor e na seção nova "Alunos aprovados" da turma aberta da coordenação, a confirmação lê o alvo (17.0) e mostra nome, turma, matrícula e a consequência; a senha aparece em dois grupos, grande, com "Copiar" e a validade, e some ao fechar sem ficar em lugar nenhum do navegador.

## Contexto necessário

- `techspec.md` seções 5 ("O alvo da provisória") e 9; `cenarios.md` "Telas" (Gerar provisória) e "E2E (RF18)" (a opção A da divergência da 12.0)
- `prd.md` RF13, RF18
- `.claude/rules/50`; `.claude/rules/20` item 4
- `apps/web/src/areas/professor/turmas/AlunosDaTurma.tsx` e `apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx`

## Subtarefas

- [x] 12.1 — O item no menu da linha e o diálogo de confirmação, que lê o alvo ao abrir (fora do cache de consultas) e o descarta ao fechar; a seção "Alunos aprovados" da coordenação, lida no clique, no lugar da contagem
- [x] 12.2 — A senha fora do cache de consultas, da URL, do log e do armazenamento; "fechar sem copiar" pergunta antes
- [x] 12.3 — `docs/interface.md`
- [x] 12.4 — O `docs/roteiro-da-demonstracao.md` (seção 2, passos 9 e 11) conferido contra `e2e/roteiro-da-demonstracao.spec.ts`
- [x] 12.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx` | novo (na subpasta: `components/` e `api/` já estavam no teto de 25 arquivos da trava de tamanho) |
| `apps/web/src/api/senha-provisoria/senha-provisoria.ts` | novo (idem) |
| `apps/web/src/areas/professor/turmas/AlunosDaTurma.tsx` | alterado |
| `apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx` (a contagem de aprovados sai) e a seção "Alunos aprovados" | alterado |
| `docs/interface.md` | alterado |
| `apps/web/src/components/senha-provisoria/itens-do-menu.ts` | novo (o menu da linha, uma vez só para as duas telas: ordem de correção 1, item 9) |
| `apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts` | novo (as opções da leitura dos aprovados) |
| `e2e/senha-provisoria.spec.ts` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| gerar e mostrar | e2e | dois grupos, lidos grupo a grupo, "Copiar" e a validade | `e2e/senha-provisoria.spec.ts` › gerar e mostrar: nome, turma e matrícula na confirmação; a senha em dois grupos |
| dois alunos de mesmo nome | e2e | a confirmação difere pela matrícula; cancelar não gera nada | `e2e/senha-provisoria.spec.ts` › dois alunos de mesmo nome: a confirmação difere pela matrícula |
| fechar sem copiar | e2e | pergunta antes | `e2e/senha-provisoria.spec.ts` › fechar sem copiar pergunta antes |
| a senha fora do navegador | e2e | nada em `localStorage`, `sessionStorage`, endereço nem cache; sai ao fechar | `e2e/senha-provisoria.spec.ts` › a senha fora do navegador |
| `ENTRA_PELA_CONTA_DA_ESCOLA` | e2e | "Este aluno entra pela conta da escola…" já na confirmação, sem "Gerar" | `e2e/senha-provisoria.spec.ts` › o aluno que entra pela conta da escola |
| `CONFLITO` e 429 | e2e | os textos de "Telas" | `e2e/senha-provisoria.spec.ts` › as falhas: CONFLITO |
| carregando | e2e | confirmação: "Carregando…" com "Gerar" ocupado (`page.route` segura o GET); geração: botão ocupado | `e2e/senha-provisoria.spec.ts` › a confirmação carrega com "Gerar" ocupado |
| alvo que sumiu | e2e | 404 na leitura ou na geração: o aviso de "Telas", a confirmação fecha | `e2e/senha-provisoria.spec.ts` › o aluno que sumiu da turma |
| coordenação, aprovados | e2e | "Mostrar alunos aprovados" só lê no clique; a linha tem o menu; a contagem antiga não aparece | `e2e/senha-provisoria.spec.ts` › a lista só é lida no clique |
| recomeço: 2ª pessoa na mesma aba | e2e | nada da senha anterior | `e2e/senha-provisoria.spec.ts` › recomeço: a segunda pessoa na mesma aba |
| recomeço: reabrir o diálogo | e2e | confirmação de novo, sem a senha velha | `e2e/senha-provisoria.spec.ts` › recomeço: reabrir o diálogo |
| recomeço: resposta atrasada (`page.route`) | e2e | não aparece em outro aluno | `e2e/senha-provisoria.spec.ts` › recomeço: a resposta atrasada da geração |
| recomeço: erro | e2e | o aviso sai na nova tentativa | `e2e/senha-provisoria.spec.ts` › as falhas: CONFLITO |
| 360 px | e2e | sem rolagem horizontal; 44 e 24 px | `e2e/senha-provisoria.spec.ts` › em 360 e em 1366 px |
| 1366 × 768 | e2e | `paginaNaoRola` | `e2e/senha-provisoria.spec.ts` › a lista só é lida no clique |

## Como testar

- Precedente: `e2e/professor-turma-alunos.spec.ts` › "a lista não fica na memória da aba: sai o nome ao deixar a aba…" (a senha fora do navegador) e "resposta atrasada: a lista da primeira turma…"
- Apoio: `criarAlunoComMatricula` (`e2e/support/seed.ts`), `entrarComoProfessora` (`e2e/support/casca.ts`), `paginaNaoRola` (`e2e/support/coordenacao.ts:97`)
- Comando: `node tools/ci/e2e.ts --manter-ambiente e2e/senha-provisoria.spec.ts`
- Telas: `professora`, `/turmas/:turmaId` › aba Alunos › menu da linha; `coordenacao`, `/estrutura/turmas/:turmaId` › "Mostrar alunos aprovados" › o mesmo menu
- Seção da coordenação: a leitura no clique dos pedidos de nome, na mesma tela (`ListaDaTurma.tsx`, "Atualizar"), e os specs que contam a contagem "Aprovados nesta turma" em `e2e/` mudam junto

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), no plano. Na 2: "Copiar" já aparece em `e2e/`? Os specs que contam botões na aba Alunos.

## Fora do escopo desta tarefa

A API (9.0 e 17.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| A confirmação precisa da matrícula do aluno aprovado e nenhuma leitura a entregava à web; a coordenação não tinha linha de aluno aprovado (só a contagem da 16.0). Opção A, escolhida em 09/11: a leitura do alvo, um aluno por vez (17.0), fora do cache de consultas, e a seção "Alunos aprovados" no lugar da contagem | Regra 20, itens 1 e 4: a matrícula só aparece aqui, aluno a aluno, e a leitura da coordenação fica na auditoria | `techspec.md` §5 ("O alvo da provisória") e §9; `cenarios.md` "Telas" (Gerar provisória) e "E2E (RF18)"; `.processo/ordens/divergencia-12.md` |

## Mutações

--faltando: 0 linhas (51 blocos, 0 motivos). Cada bloco foi aplicado e rodado antes do pedido (executor local sobre o mesmo `comandoDoTeste` do portão): os 51 ficaram vermelhos num caso que rodou e falhou. Duas guardas que nenhum teste alcançava saíram do código em vez de ganhar bloco: o `leituraPronta` do `confirmar` (o botão já fica desligado até o aluno ser lido) e o `if (!controle.signal.aborted)` do sucesso da leitura (a leitura abortada rejeita, e o 404 atrasado tem o caso dele).

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › a leitura que falha por outro motivo
-return erro instanceof ApiError && erro.codigo === codigo
+return erro instanceof ApiError
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › com a geração no ar, fechar também pergunta
-? 'A senha ainda está sendo gerada, e aparece uma vez só, aqui. Se fechar agora, ela não aparece, e será preciso gerar outra daqui a alguns segundos.'
+? 'A senha aparece uma vez só. Se fechar agora, ela não aparece de novo, e será preciso gerar outra: a atual deixa de valer.'
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › o 404 da leitura que chega depois de o diálogo fechar
-if (controle.signal.aborted) return
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › o aluno que sumiu na leitura
 if (controle.signal.aborted) return
-if (temCodigo(erro, ErrorCode.NAO_ENCONTRADO)) perderOAluno.current()
+if (!temCodigo(erro, ErrorCode.NAO_ENCONTRADO)) perderOAluno.current()
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › o aluno que sumiu na geração
 onError: (erro) => {
-if (temCodigo(erro, ErrorCode.NAO_ENCONTRADO)) perderOAluno.current()
+if (!temCodigo(erro, ErrorCode.NAO_ENCONTRADO)) perderOAluno.current()
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › o clique duplo em
-if (noAr.current) return
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › sem turma a linha da turma some
-{alvo.turma !== null && (
+{alvo.turma === null && (
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › sem turma a linha da turma some
-{alvo.matricula !== null && (
+{alvo.matricula === null && (
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › o aluno que entra pela conta da escola
-const podeGerar = !entraPelaConta && leitura.estado !== 'falhou'
+const podeGerar = leitura.estado !== 'falhou'
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › a leitura que falhou
-const podeGerar = !entraPelaConta && leitura.estado !== 'falhou'
+const podeGerar = !entraPelaConta
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › o aluno que entra pela conta da escola
-{podeGerar && (
+{!podeGerar && (
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › lê o aluno ao abrir
-<Button onClick={aoGerar} disabled={leitura.estado !== 'lida' || gerar.isPending} aria-busy={leitura.estado === 'lendo' || gerar.isPending}>
+<Button onClick={aoGerar} disabled={gerar.isPending} aria-busy={leitura.estado === 'lendo' || gerar.isPending}>
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › o clique duplo em
-<Button onClick={aoGerar} disabled={leitura.estado !== 'lida' || gerar.isPending} aria-busy={leitura.estado === 'lendo' || gerar.isPending}>
+<Button onClick={aoGerar} disabled={leitura.estado !== 'lida'} aria-busy={leitura.estado === 'lendo' || gerar.isPending}>
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › o clique duplo em
-{gerar.isPending ? 'Gerando…' : TITULO}
+{TITULO}
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › o aluno que entra pela conta da escola
-{entraPelaConta ? 'Fechar' : 'Cancelar'}
+{'Cancelar'}
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › ENTRA_PELA_CONTA_DA_ESCOLA na geração
-const falha = gerar.isError && !entraPelaConta ? errorText(gerar.error, TEXTOS_DA_FALHA_DA_PROVISORIA) : undefined
+const falha = gerar.isError ? errorText(gerar.error, TEXTOS_DA_FALHA_DA_PROVISORIA) : undefined
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › lê o aluno ao abrir
-{leitura.estado === 'lendo' && <LoadingState rotulo="Carregando…" />}
+{leitura.estado !== 'lendo' && <LoadingState rotulo="Carregando…" />}
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › a leitura que falhou
-{leitura.estado === 'falhou' && <ErrorState erro={leitura.erro} aoTentarDeNovo={tentarDeNovo} />}
+{leitura.estado !== 'falhou' && <ErrorState erro={leitura.erro} aoTentarDeNovo={tentarDeNovo} />}
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › lê o aluno ao abrir
-{leitura.estado === 'lida' && <AlunoDaConfirmacao alvo={leitura.alvo} />}
+{leitura.estado !== 'lida' && <AlunoDaConfirmacao alvo={leitura.alvo} />}
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › o aluno que entra pela conta da escola
-{entraPelaConta ? <Alert tom="info">{TEXTO_DO_ALUNO_DA_CONTA_DA_ESCOLA}</Alert> : leitura.estado === 'lida' && <ConsequenciaDaGeracao />}
+{entraPelaConta ? null : leitura.estado === 'lida' && <ConsequenciaDaGeracao />}
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › diz a consequência antes de gerar
-{entraPelaConta ? <Alert tom="info">{TEXTO_DO_ALUNO_DA_CONTA_DA_ESCOLA}</Alert> : leitura.estado === 'lida' && <ConsequenciaDaGeracao />}
+{entraPelaConta ? <Alert tom="info">{TEXTO_DO_ALUNO_DA_CONTA_DA_ESCOLA}</Alert> : leitura.estado === 'lida' && null}
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › CONFLITO diz
-{falha !== undefined && <FailureAlert texto={falha} erro={gerar.error} />}
+{falha === undefined && <FailureAlert texto={falha} erro={gerar.error} />}
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › o clique duplo em
-{gerar.isPending ? 'Gerando a senha provisória…' : ''}
+{''}
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › manda o POST do aluno
-{nome === undefined ? 'Senha provisória' : `Senha provisória de ${nome}`}
+{nome !== undefined ? 'Senha provisória' : `Senha provisória de ${nome}`}
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › lê o aluno ao abrir
-if (leitura.estado === 'lida' && leitura.alvo.entraPelaContaDaEscola) return true
+if (leitura.estado === 'lida') return true
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › CONFLITO diz
-return geracao.isError && temCodigo(geracao.error, ErrorCode.ENTRA_PELA_CONTA_DA_ESCOLA)
+return geracao.isError
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › manda o POST do aluno
-return leitura.estado === 'lida' ? leitura.alvo.nome : undefined
+return leitura.estado !== 'lida' ? leitura.alvo.nome : undefined
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › sem copiar, pergunta antes
-if (perguntando) return 'pergunta'
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › manda o POST do aluno
-return gerada ? 'senha' : 'confirmar'
+return 'confirmar'
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › depois de copiar, fecha na hora
-return geracao.isPending || (geracao.isSuccess && !copiada)
+return geracao.isPending || geracao.isSuccess
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › cancelar a confirmação, sem gerar nada
-return geracao.isPending || (geracao.isSuccess && !copiada)
+return geracao.isPending || !copiada
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › sem copiar, pergunta antes
-{etapa === 'pergunta' && (
+{etapa !== 'pergunta' && (
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › manda o POST do aluno
-{etapa === 'senha' && gerar.data !== undefined && (
+{etapa !== 'senha' && gerar.data !== undefined && (
```

```mutacao
arquivo: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.tsx
teste: apps/web/src/components/senha-provisoria/DialogoDaSenhaProvisoria.test.tsx › lê o aluno ao abrir
-{etapa === 'confirmar' && (
+{etapa !== 'confirmar' && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx
teste: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.test.tsx › dois alunos de mesmo nome são duas linhas
-return a.nome.localeCompare(b.nome, 'pt-BR') || (a.usuarioId < b.usuarioId ? -1 : a.usuarioId > b.usuarioId ? 1 : 0)
+return a.nome.localeCompare(b.nome, 'pt-BR')
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx
teste: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.test.tsx › havendo mais páginas
-<p className="text-sm text-sutil">{alunos.hasNextPage ? `Mostrando os primeiros ${formatQuantity(lidos.length, 'aluno', 'alunos')}` : formatQuantity(lidos.length, 'aluno aprovado', 'alunos aprovados')}</p>
+<p className="text-sm text-sutil">{!alunos.hasNextPage ? `Mostrando os primeiros ${formatQuantity(lidos.length, 'aluno', 'alunos')}` : formatQuantity(lidos.length, 'aluno aprovado', 'alunos aprovados')}</p>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx
teste: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.test.tsx › havendo mais páginas
-{alunos.hasNextPage && (
+{!alunos.hasNextPage && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx
teste: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.test.tsx › vira "Carregando…"
-{alunos.isFetchingNextPage ? 'Carregando…' : 'Ver mais alunos'}
+{'Ver mais alunos'}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx
teste: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.test.tsx › a leitura que falha
-if (alunos.data === undefined)
+if (alunos.data !== undefined)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx
teste: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.test.tsx › a leitura que falha
-return alunos.isError ? (
+return !alunos.isError ? (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx
teste: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.test.tsx › sem aluno aprovado
-if (lidos.length === 0)
+if (lidos.length !== 0)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx
teste: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.test.tsx › "Atualizar" lê a lista de novo
-{mostrando ? (
+{!mostrando ? (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx
teste: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.test.tsx › antes do clique nada é lido
-{mostrando ? <CorpoDosAprovados alunos={alunos} aoGerarASenha={abrirProvisoria} /> : <p className="text-sm text-sutil">{TEXTO_ANTES_DOS_APROVADOS}</p>}
+{!mostrando ? <CorpoDosAprovados alunos={alunos} aoGerarASenha={abrirProvisoria} /> : <p className="text-sm text-sutil">{TEXTO_ANTES_DOS_APROVADOS}</p>}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx
teste: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.test.tsx › no menu da linha abre a confirmação
-{aberta?.tipo === 'provisoria' && aberta.alvo !== undefined && (
+{aberta?.tipo !== 'provisoria' && aberta.alvo !== undefined && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/api/lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.test.tsx › o clique lê uma vez
 queryKey: [...ALUNOS_APROVADOS_QUERY_KEY, turmaId],
 queryFn: ({ pageParam, signal }) => {
 const consulta = new URLSearchParams({ finalidade: FINALIDADE_DA_LISTA_NA_ESTRUTURA, limite: String(NOMES_POR_PAGINA) })
-if (pageParam !== undefined) consulta.set('pagina', pageParam)
+if (pageParam === undefined) consulta.set('pagina', pageParam)
```

```mutacao
arquivo: apps/web/src/areas/professor/turmas/AlunosDaTurma.tsx
teste: apps/web/src/areas/professor/turmas/AlunosDaTurma.test.tsx › cada aluno que está na turma tem o menu
-linha.situacao === 'na_turma' ? (
+linha.situacao !== 'na_turma' ? (
```

```mutacao
arquivo: apps/web/src/areas/professor/turmas/AlunosDaTurma.tsx
teste: apps/web/src/areas/professor/turmas/AlunosDaTurma.test.tsx › escolher "Gerar senha provisória" abre
-{aberta?.tipo === 'provisoria' && aberta.alvo !== undefined && (
+{aberta?.tipo !== 'provisoria' && aberta.alvo !== undefined && (
```

```mutacao
arquivo: apps/web/src/areas/professor/turmas/AlunosDaTurma.tsx
teste: apps/web/src/areas/professor/turmas/AlunosDaTurma.test.tsx › o foco vai para o fim da lista
-focoDeReserva={() => (botaoDeVerMais.current ?? fimDaLista.current ?? tituloDoAcesso.current)?.focus()}
+focoDeReserva={() => undefined}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/api/lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › sai do cache ao fechar a tela
 staleTime: Number.POSITIVE_INFINITY,
-gcTime: 0,
+gcTime: 300_000,
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/api/lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › não relê ao voltar para a aba
 staleTime: Number.POSITIVE_INFINITY,
 gcTime: 0,
-refetchOnWindowFocus: false,
+refetchOnWindowFocus: true,
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/api/lista.ts
teste: apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts › não relê ao voltar para a aba
 getNextPageParam: (ultima) => ultima.proxima,
-staleTime: Number.POSITIVE_INFINITY,
+staleTime: 0,
 gcTime: 0,
```


## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| frontend-reviewer (1ª), 1 | O rótulo "Ações" aparece duas vezes no cartão do celular (rótulo da linha e texto do botão), nas duas telas | `TODO.md`: mexe no desenho da `Table` em duas telas, não cabe em poucas linhas |
| frontend-reviewer (1ª), 2 | Foto da coordenação antes do clique em "Mostrar alunos aprovados" e da senha gerada na coordenação | Validação: o Validador fotografa cada requisito com tela |
| frontend-reviewer (1ª), 3; privacy-guardian (1ª), 4; revisor-geral (1ª), 1 | Fotos antigas na pasta (uma delas diz "1 aluno aprovados") | Recusada: `.processo/vitrine/` fica fora do git e não é código; o código e o teste "um aluno só: a contagem diz '1 aluno aprovado'" já dizem o singular, e a rodada seguinte fotografa de novo |
| tenancy-guardian (1ª) | Incluir a escola ativa na chave `['alunos-aprovados-da-turma', turmaId]` | `TODO.md`: com `gcTime: 0` a lista sai do cache ao fechar a tela; mexer na chave pede ver como as outras listas da coordenação tratam a troca de escola |
| infra-guardian (1ª), 1 | A ordenação por nome mistura as linhas novas de "Ver mais alunos" com as que já estavam | `TODO.md`: muda o comportamento da lista (o caso `dois alunos de mesmo nome são duas linhas` prova a ordem de hoje); decisão do `frontend-reviewer` na validação |
| infra-guardian (1ª), 2 | Cada "Atualizar" relê todas as páginas abertas e cada leitura entra na auditoria | Retro: se a auditoria por página é a granularidade pretendida |
| conformidade-reviewer (1ª), 1 e 2 | Trocar o nome "Alunos aprovados" (pode ser lido como aprovação de ano) e alinhar o roteiro | Não é recusa por "a spec não pede": o PRD, a Tech Spec §9, `cenarios.md` "Telas" e o objetivo desta tarefa nomeiam a seção assim. Vai ao Arquiteto na retro, como decisão de nome de produto; `TODO.md` |
| privacy-guardian (1ª), 1 | Incluir `getMutationCache()` no e2e "a senha fora do navegador" | Recusada: `e2e/support/query-cache.ts` não é arquivo desta tarefa, e a unidade (`DialogoDaSenhaProvisoria.test.tsx`, o caso da senha fora do cache de consultas e do cache de mutações) já prova o cache de mutações |
| privacy-guardian (1ª), 2 | Linha na etapa da senha sobre a área de transferência em máquina compartilhada | `TODO.md`: texto de produto, a decisão é do Arquiteto |
| privacy-guardian (1ª), 3 | A leitura do alvo pelo professor não vai para a auditoria | Retro: conforme à regra 20, item 10; só se alguma rede pedir o rastro do professor |
| revisor-geral (1ª), 3 | O callback `aoPerderOAluno` repetido nas duas telas, num hook ao lado do diálogo | `TODO.md`: as duas telas relêem listas diferentes, o hook pede parâmetro e não cabe em poucas linhas |
| revisor-geral (1ª), 4 | `ListaDaTurma.tsx` ficou maior; a seção `AlunosAprovados` poderia ir para arquivo próprio | `TODO.md`, na próxima tarefa que tocar `ListaDaTurma.tsx`: mover arquivo inteiro não é correção barata |
| test-engineer (1ª), 8 | Provar no e2e que, ao cancelar, a senha anterior ainda entra | Recusada: cancelar só deixou a leitura (GET), e `apps/api/test/senha-provisoria.int.test.ts` (o caso "a leitura não grava nada") prova na API que a leitura não troca a senha; o e2e já prova que nenhum POST saiu |
| test-engineer (2ª), 1; revisor-geral (2ª), 1 | `12_task.md`, seção "Mutações": a linha diz "51 blocos" e, na mesma frase, "os 48 ficaram vermelhos" | Texto do documento: o Implementador corrige a contagem antes do commit, se o carimbo continuar valendo; se caducar, fica para a retro |
| test-engineer (2ª), 2 | O título do caso de 360 px da coordenação (`e2e/senha-provisoria.spec.ts`) diz "em 360 px" e talvez rode também no projeto `chromebook` | `TODO.md`: tarefa futura que tocar o arquivo |
| test-engineer (2ª), 3 | `api/lista.test.ts` afirma a configuração (`gcTime`, `staleTime`), não o comportamento | `TODO.md`: a mutação fica vermelha, então não bloqueia; prova de comportamento com `QueryClient` de verdade na próxima tarefa que tocar a leitura dos aprovados |
| revisor-geral (2ª), 2 | Os dois casos novos de Esc e toque fora (`DialogoDaSenhaProvisoria.test.tsx`) não têm bloco de mutação | Recusada: o diálogo não ganhou cláusula nova nesta rodada, e o `test-engineer` confirmou que não falta bloco |
| tenancy-guardian (2ª) | Escola ativa na chave `['alunos-aprovados-da-turma', turmaId]` | Já está em "Recomendações sem aplicar" (1ª rodada), com destino `TODO.md` |
| privacy-guardian (2ª), 1 | Em nenhum e2e a geração pode rodar contra o aluno fixo da vitrine | Registro, sem ação: o e2e cria o próprio cenário |
| frontend-reviewer (2ª), 1 | "Ações" repetido no cartão do celular | Já em "Recomendações sem aplicar" (1ª rodada), com destino `TODO.md` |
| frontend-reviewer (2ª), 2 e 4 | Sem foto do menu aberto a 360 px, da coordenação antes do clique e da senha gerada na coordenação | Validação: o Validador fotografa cada requisito com tela |
| frontend-reviewer (2ª), 3 | O menu aberto a 1366 px passa da borda direita da tabela (na professora chega a 1351 px) | `TODO.md`: conferir o encaixe do `Menu` em tela estreita de Chromebook; cabe na janela |
| conformidade-reviewer (2ª), 1 e 2 | Nome "Alunos aprovados" perto demais da aprovação de ano; manter a senha provisória longe de ato sobre a trajetória do aluno | Já em "Recomendações sem aplicar" (1ª rodada): decisão de nome para o Arquiteto na retro |
| infra-guardian (2ª) | nenhuma nova | As duas da 1ª rodada já têm destino (`TODO.md` e retro) |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-09 16:18:18 | 2026-11-09 16:19:27 | `frontend-reviewer` | 1 | APROVADO | a3bd55646fde04f53 |
| 2026-11-09 16:18:59 | 2026-11-09 16:19:34 | `tenancy-guardian` | 1 | APROVADO | aad3d78a27bfe448c |
| 2026-11-09 16:19:21 | 2026-11-09 16:19:51 | `infra-guardian` | 1 | APROVADO | a10270b87f5a0fec1 |
| 2026-11-09 16:19:09 | 2026-11-09 16:19:54 | `conformidade-reviewer` | 1 | APROVADO | ad96c48444335cab8 |
| 2026-11-09 16:18:28 | 2026-11-09 16:19:55 | `privacy-guardian` | 1 | APROVADO | a3255f1388e047025 |
| 2026-11-09 16:18:49 | 2026-11-09 16:20:15 | `revisor-geral` | 1 | APROVADO | a5f73de4ca860feb9 |
| 2026-11-09 16:18:38 | 2026-11-09 16:21:22 | `test-engineer` | 1 | REPROVADO | a4ac548a03a03c54a |
| 2026-11-09 17:11:43 | 2026-11-09 17:12:28 | `test-engineer` | 2 | APROVADO | a66ac06a5b53e0f2a |
| 2026-11-09 17:11:59 | 2026-11-09 17:12:29 | `revisor-geral` | 2 | APROVADO | ae349ec7e8e9957fc |
| 2026-11-09 17:12:42 | 2026-11-09 17:12:54 | `tenancy-guardian` | 2 | APROVADO | a15ab708e22356ed7 |
| 2026-11-09 17:12:28 | 2026-11-09 17:12:57 | `privacy-guardian` | 2 | APROVADO | ae61be66f72aab39d |
| 2026-11-09 17:12:14 | 2026-11-09 17:13:03 | `frontend-reviewer` | 2 | APROVADO | aab55e9d0d07ba5a5 |
| 2026-11-09 17:12:58 | 2026-11-09 17:13:21 | `conformidade-reviewer` | 2 | APROVADO | a77bcd7a703c079d5 |
| 2026-11-09 17:13:12 | 2026-11-09 17:13:27 | `infra-guardian` | 2 | APROVADO | af2415e4fe9a843d5 |
