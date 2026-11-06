# Tarefa 14.0 — Escola ganha a aba Grade e calendário

**Funcionalidade:** onboarding-por-convite · **Depende de:** 12.0, 13.0
**Subagentes obrigatórios:** `frontend-reviewer`
**Porte:** grande

## Objetivo

Escola ganha a quarta aba, **Grade e calendário**, ao lado de Turmas, Professores e Material: os modelos das quatro
planilhas para baixar, a importação da grade e do calendário pelo `ImportarPlanilha`, a grade por turma (dias ×
horários) e o calendário do ano em curso, com o planejado à escolha.

## Contexto necessário

- `techspec.md` §9 (a aba nova em `Escola.tsx`; a grade, tabela com cabeçalhos, rola no cartão a 360 px), §4 (`GET
  /v1/grade`, `GET /v1/calendario`, o filtro `anoLetivoId`)
- `prd.md` RF1, RF7, RF9, RF10
- `cenarios.md` E2E ("O modelo servido pela tela, preenchido, entra sem erro")
- `docs/interface.md` §3 (Escola: "Grade horária e calendário entram pelo menu de Escola, com o F2"); D73 (o item só
  aparece com a fase dele)
- Código: `apps/web/src/areas/coordenacao/Escola.tsx`, `routes.tsx`; `apps/web/src/paths.ts` (`COORDENACAO_ROUTES`);
  `apps/web/src/areas/navigation.ts` (`tambemEm`); o `ImportarPlanilha` da 13.0; os cabeçalhos em
  `packages/shared/src/importacao/`

## Subtarefas

- [x] 14.1 — Rota e aba: `COORDENACAO_ROUTES.grade`, a aba em `Escola.tsx`, o lugar Escola aceso por `tambemEm`
- [x] 14.2 — Modelos para baixar, gerados dos cabeçalhos de `packages/shared`
- [x] 14.3 — Importar grade (avisos de horário) e calendário (o que entra e o que sai)
- [x] 14.4 — Grade por turma: tabela com cabeçalhos, troca de turma; calendário do ano, com o seletor do planejado
- [x] 14.5 — `docs/interface.md` §3 (a aba nova); `docs/roteiro-da-demonstracao.md` conferido contra `e2e/roteiro-da-demonstracao.spec.ts`, se a aba mexer no que ele percorre
- [x] 14.6 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx`, `modelos-de-planilha.ts`, `api/grade.ts` | novo |
| `apps/web/src/areas/coordenacao/Escola.tsx`, `routes.tsx` | alterado |
| `apps/web/src/paths.ts`, `apps/web/src/areas/navigation.ts` | alterado |
| `e2e/grade-e-calendario.spec.ts` | novo |
| `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| A aba fica ao lado de Turmas, Professores e Material, e acende Escola | e2e | RF1 | e2e/grade-e-calendario.spec.ts › a aba fica ao lado de Turmas, Professores e Material e acende Escola; cada modelo baixa o cabeçalho de packages/shared |
| Os modelos baixados têm os cabeçalhos de `packages/shared` | unidade | RF1 | apps/web/src/areas/coordenacao/grade/modelos-de-planilha.test.ts › baixar entrega o arquivo do tipo com o nome dele, e o conteúdo é o cabeçalho do tipo; e2e/grade-e-calendario.spec.ts › a aba fica ao lado de Turmas, Professores e Material e acende Escola; cada modelo baixa o cabeçalho de packages/shared |
| Importar a grade mostra os avisos de horário e grava | e2e | RF7 | e2e/grade-e-calendario.spec.ts › o modelo baixado e preenchido entra sem erro; os avisos de horário aparecem e a grade grava; o mesmo arquivo de novo não muda nada, e o arquivo sem uma aula a tira do ano |
| Importar o calendário mostra o que entra e o que sai | e2e | RF10 | e2e/grade-e-calendario.spec.ts › a data fora do ano é erro e nada grava; o calendário novo substitui o do ano, e a prévia diz o que entra e o que sai |
| Grade por turma em tabela com cabeçalhos de dias × horários | e2e | RF1 | e2e/grade-e-calendario.spec.ts › a grade é uma tabela com cabeçalhos de dias e horários; trocar de turma mostra a outra, e a resposta atrasada da anterior não toma o lugar; apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › a primeira turma na ordem da escola, com os dias úteis nas colunas e o horário nas linhas |
| A grade rola dentro do cartão a 360 px | e2e | §9 | e2e/grade-e-calendario.spec.ts › a grade é uma tabela com cabeçalhos de dias e horários; trocar de turma mostra a outra, e a resposta atrasada da anterior não toma o lugar |
| O calendário do ano em curso, com o seletor do planejado | e2e | RF1, RF16 | e2e/grade-e-calendario.spec.ts › o calendário do ano em curso lista os eventos, e o seletor mostra o planejado só para ler |
| Carregando | e2e | estados | e2e/grade-e-calendario.spec.ts › a leitura da grade carrega e falha com "Tentar de novo": o servidor volta e a tabela chega; apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › a grade no ar |
| Erro com "Tentar de novo" | e2e | estados | e2e/grade-e-calendario.spec.ts › a leitura da grade carrega e falha com "Tentar de novo": o servidor volta e a tabela chega |
| Vazio com "Baixar modelo" | e2e | estados | e2e/grade-e-calendario.spec.ts › o vazio convida a baixar o modelo; a tela cabe, tem alvos, uma ação cheia e axe limpo |
| Com dado | e2e | estados | e2e/grade-e-calendario.spec.ts › a grade é uma tabela com cabeçalhos de dias e horários; trocar de turma mostra a outra, e a resposta atrasada da anterior não toma o lugar |
| Recomeço: troca de turma com a resposta anterior atrasada: vale a última | e2e | | e2e/grade-e-calendario.spec.ts › a grade é uma tabela com cabeçalhos de dias e horários; trocar de turma mostra a outra, e a resposta atrasada da anterior não toma o lugar |
| Recomeço: a segunda pessoa na mesma aba | e2e | | e2e/grade-e-calendario.spec.ts › a segunda pessoa na mesma aba: a coordenação de outra escola não vê a grade nem o calendário da anterior |
| Recomeço: o mesmo arquivo de novo | e2e | | e2e/grade-e-calendario.spec.ts › o modelo baixado e preenchido entra sem erro; os avisos de horário aparecem e a grade grava; o mesmo arquivo de novo não muda nada, e o arquivo sem uma aula a tira do ano |
| Recomeço: falha com o diálogo de importação aberto | e2e | | e2e/grade-e-calendario.spec.ts › o painel da grade cabe, tem alvos e uma ação cheia; a prévia com erro não grava, e a falha da gravação com o painel aberto deixa gravar de novo |
| 360 px sem rolagem horizontal | e2e | | e2e/grade-e-calendario.spec.ts › a grade é uma tabela com cabeçalhos de dias e horários; trocar de turma mostra a outra, e a resposta atrasada da anterior não toma o lugar; e2e/grade-e-calendario.spec.ts › o painel da grade cabe, tem alvos e uma ação cheia; a prévia com erro não grava, e a falha da gravação com o painel aberto deixa gravar de novo |
| Cabe em 1366 × 768 sem a página rolar (`paginaNaoRola`) | e2e | | e2e/grade-e-calendario.spec.ts › o vazio convida a baixar o modelo; a tela cabe, tem alvos, uma ação cheia e axe limpo |
| Alvos de 44 e 24 px | e2e | | e2e/grade-e-calendario.spec.ts › o vazio convida a baixar o modelo; a tela cabe, tem alvos, uma ação cheia e axe limpo; e2e/grade-e-calendario.spec.ts › o painel da grade cabe, tem alvos e uma ação cheia; a prévia com erro não grava, e a falha da gravação com o painel aberto deixa gravar de novo |
| axe | e2e | | e2e/grade-e-calendario.spec.ts › o vazio convida a baixar o modelo; a tela cabe, tem alvos, uma ação cheia e axe limpo |
| Uma ação cheia por tela | e2e | | e2e/grade-e-calendario.spec.ts › o vazio convida a baixar o modelo; a tela cabe, tem alvos, uma ação cheia e axe limpo |
| A tela pede para não escrever nome de pessoa na sala nem na descrição do evento | unidade | regra 20, item 1 | apps/web/src/areas/coordenacao/grade/textos-da-grade.test.ts › o aviso de não escrever nome de pessoa está nas duas instruções e nos cinco textos de vazio e de modelos; apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › o painel da grade diz na instrução e no vazio para não escrever nome na sala, e o "Baixar modelo" dele entrega modelo-grade.csv |
| O calendário diz o fim antes do início do jeito dele (o evento de um dia só é válido) | unidade | RF10 | apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › a planilha que diz um código do jeito dela usa o texto dela; apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › a prévia da calendario diz o fim antes do início do jeito dela |
| O ano planejado que sai da lista volta ao ano em curso | unidade | RF16 | apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › o ano escolhido sai da lista depois de uma gravação que lê os anos de novo |

## Como testar

- Aba de Escola: `e2e/estrutura.spec.ts › uma tabela por série, a marca "Sem professor" e o filtro no endereço, a linha inteira abre a lista da turma, e a página não rola` (`entrarComoCoordenacaoNaMesmaAba`, `abrirEstrutura` de `e2e/support/casca.ts`; `paginaNaoRola`, `irPelaCoordenacao` de `e2e/support/coordenacao.ts`)
- Importação: o spec da 13.0 (`e2e/importar-alunos.spec.ts`)
- Resposta atrasada: `page.route` segurando o `GET /v1/grade` da turma anterior
- Comando: `node tools/ci/e2e.ts --manter-ambiente e2e/grade-e-calendario.spec.ts`
- **Telas:** `coordenacao`, `/coordenacao/grade` (o endereço novo), `text=Grade e calendário` → grade de uma turma; → calendário; → importar grade com aviso; vazio; sem mockup

## Autoconferência

As 12 perguntas do modelo, no plano. Na 2, "Grade e calendário" ainda não aparece em `e2e/`; confira os specs que contam as abas de Escola (`toHaveCount`).

## Fora do escopo desta tarefa

A visão Semana do professor (F2b).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

--faltando: 1 linhas (79 blocos, 1 motivos)

**Sem bloco (motivo):** `api/grade.ts`: o `?? 'em-curso'` da chave de `calendarioQueryOptions`. Ele só escolhe a chave de cache do ano em curso; tirado, a chave leva `undefined`, que continua diferente da de qualquer ano planejado (um id) e não muda o pedido nem o que a tela mostra: a mutação é equivalente. O pedido, que é o que importa (`anoLetivoId === undefined ? '/v1/calendario' : …`), tem bloco. (O `?? anoEmCurso` de `CalendarioDoAno`, que estava aqui, ganhou caso e bloco na rodada 1: o ano escolhido sai da lista depois de uma gravação que lê os anos de novo.)

As condições da tela são provadas no teste de componente `GradeECalendario.test.tsx`, com a rede falsa; o e2e `grade-e-calendario` prova o que só o navegador mede (a largura, o alvo, o arquivo baixado, a resposta atrasada, o axe) e o fluxo inteiro com o banco. Onde o único vermelho é uma asserção negativa (a sala que não aparece, o botão que some, o painel que não abre, o anúncio da outra seção), o bloco leva `falha:` com o trecho da linha.

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › lista os eventos com o período
-{ chave: 'periodo', titulo: 'Período', celula: (evento) => (evento.inicio === evento.fim ? formatDate(evento.inicio) : `${formatDate(evento.inicio)} a ${formatDate(evento.fim)}`) },
+{ chave: 'periodo', titulo: 'Período', celula: (evento) => (false ? formatDate(evento.inicio) : `${formatDate(evento.inicio)} a ${formatDate(evento.fim)}`) },
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › a região da grade só entra no Tab quando a tabela passa
-if (elemento === null) return
+if (elemento !== null) return
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › a região da grade só entra no Tab quando a tabela passa
-if (elemento.firstElementChild !== null) observador.observe(elemento.firstElementChild)
+if (false) observador.observe(elemento.firstElementChild)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › a região da grade só entra no Tab quando a tabela passa
-tabIndex={sobra ? 0 : undefined}
+tabIndex={undefined}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › cabendo na largura, a região fica fora do Tab
falha: getAttribute('tabindex')).toBeNull()
-tabIndex={sobra ? 0 : undefined}
+tabIndex={0}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › a primeira turma na ordem da escola
-{aulas.length === 0 ? (
+{aulas.length === 99 ? (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › a primeira turma na ordem da escola
falha: queryByText(/^Sala/)).toBeNull()
-{aula.sala !== null && <span className="block text-apoio">Sala {aula.sala}</span>}
+{true && <span className="block text-apoio">Sala {aula.sala}</span>}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › a falha das disciplinas também é erro da grade
-const nomes = new Map((disciplinas.data?.itens ?? []).map((disciplina) => [disciplina.id, disciplina.nome]))
+const nomes = new Map((disciplinas.data?.itens).map((disciplina) => [disciplina.id, disciplina.nome]))
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › a grade que falha mostra o erro
-if (falhou !== undefined) {
+if (false) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › a tabela só sai com as disciplinas lidas
-} else if (grade.data === undefined || disciplinas.isPending) {
+} else if (grade.data === undefined) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › a grade no ar
-} else if (grade.data === undefined || disciplinas.isPending) {
+} else if (disciplinas.isPending) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › a turma sem aula
-} else if (grade.data.aulas.length === 0) {
+} else if (false) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › a primeira turma na ordem da escola
-corpo = <TabelaDaGrade nomeDaTurma={escolhida.nome} grade={montarGrade(grade.data.aulas, (id) => (id === null ? undefined : nomes.get(id)))} />
+corpo = <TabelaDaGrade nomeDaTurma={escolhida.nome} grade={montarGrade(grade.data.aulas, (id) => (undefined))} />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › as turmas no ar
-if (turmas.data === undefined) {
+if (false) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › carregando as turmas, e a falha delas
-{turmas.isError ? <ErrorState erro={turmas.error} tentando={turmas.isFetching} aoTentarDeNovo={() => void turmas.refetch({ cancelRefetch: false })} /> : <LoadingState rotulo="Carregando as turmas…" />}
+{false ? <ErrorState erro={turmas.error} tentando={turmas.isFetching} aoTentarDeNovo={() => void turmas.refetch({ cancelRefetch: false })} /> : <LoadingState rotulo="Carregando as turmas…" />}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › a primeira turma na ordem da escola
-const turma = emOrdem.find((candidata) => candidata.id === escolhida) ?? emOrdem[0]
+const turma = emOrdem.find((candidata) => candidata.id === escolhida) ?? undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › sem turma, o vazio convida
-if (turma === undefined) {
+if (false) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › com o planejado, o seletor lista
-const ehLegivel = (ano: AnoLetivo): boolean => ano.situacao === 'em_curso' || ano.situacao === 'planejado'
+const ehLegivel = (ano: AnoLetivo): boolean => ano.situacao === 'em_curso' || ano.situacao === 'encerrado'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › escolher o planejado pede o calendário dele
-const calendario = useQuery(calendarioQueryOptions(noPlanejado ? ano.id : undefined))
+const calendario = useQuery(calendarioQueryOptions(undefined))
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › carregando o calendário, e a falha dele
-if (calendario.isError) corpo = <ErrorState erro={calendario.error} tentando={calendario.isFetching} aoTentarDeNovo={() => void calendario.refetch({ cancelRefetch: false })} />
+if (false) corpo = <ErrorState erro={calendario.error} tentando={calendario.isFetching} aoTentarDeNovo={() => void calendario.refetch({ cancelRefetch: false })} />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › o calendário no ar
-else if (calendario.isPending) corpo = <LoadingState rotulo="Carregando o calendário…" />
+else if (false) corpo = <LoadingState rotulo="Carregando o calendário…" />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › vazio no ano em curso
-else if (calendario.data.eventos.length === 0) {
+else if (false) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › escolher o planejado pede o calendário dele
-descricao={noPlanejado ? 'O calendário do ano planejado ainda não foi gravado.' : VAZIO_DO_CALENDARIO}
+descricao={false ? 'O calendário do ano planejado ainda não foi gravado.' : VAZIO_DO_CALENDARIO}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › escolher o planejado pede o calendário dele
falha: queryByRole('button', { name: 'Importar calendário' })).toBeNull()
-noPlanejado ? undefined : (
+false ? undefined : (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › o ano em curso pede o calendário sem consulta
falha: queryByLabelText('Ano letivo')).toBeNull()
-{legiveis.length > 1 && (
+{true && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › com o planejado, o seletor lista
-{candidato.ano} ({candidato.situacao === 'em_curso' ? 'em curso' : 'planejado'})
+{candidato.ano} ({candidato.situacao === 'planejado' ? 'em curso' : 'planejado'})
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › vazio no ano em curso
falha: queryByText(/só para ler/)).toBeNull()
-{noPlanejado && <p className="text-apoio">Este é o calendário do ano planejado, só para ler. A importação grava no ano em curso.</p>}
+{true && <p className="text-apoio">Este é o calendário do ano planejado, só para ler. A importação grava no ano em curso.</p>}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › erro: a mensagem curta e
-if (anos.isError) return <ErrorState erro={anos.error} tentando={anos.isFetching} aoTentarDeNovo={() => void anos.refetch({ cancelRefetch: false })} />
+if (false) return <ErrorState erro={anos.error} tentando={anos.isFetching} aoTentarDeNovo={() => void anos.refetch({ cancelRefetch: false })} />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › carregando: a leitura dos anos
-if (anos.data === undefined) return <LoadingState rotulo="Carregando a grade e o calendário…" />
+if (false) return <LoadingState rotulo="Carregando a grade e o calendário…" />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › sem ano em curso, o convite
-if (anoEmCurso === undefined) return <SemAnoEmCurso />
+if (false) return <SemAnoEmCurso />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › ao gravar o calendário, o anúncio
falha: not.toContain('Planilha gravada')
-<GradeDaEscola anuncio={anuncio?.de === 'grade' ? anuncio.texto : undefined} tituloRef={tituloDaGrade} aoImportar={() => aoImportar('importar-grade')} />
+<GradeDaEscola anuncio={anuncio !== undefined ? anuncio.texto : undefined} tituloRef={tituloDaGrade} aoImportar={() => aoImportar('importar-grade')} />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › ao gravar a grade, o anúncio
falha: queryByText(/Planilha gravada/)).toBeNull()
-anuncio={anuncio?.de === 'calendario' ? anuncio.texto : undefined}
+anuncio={anuncio !== undefined ? anuncio.texto : undefined}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › sem ano em curso, o convite
falha: queryByRole('dialog')).toBeNull()
-{podeImportar && painel === 'importar-grade' && (
+{painel === 'importar-grade' && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › sem ano em curso, o painel do calendário
falha: queryByRole('dialog')).toBeNull()
-{podeImportar && painel === 'importar-calendario' && (
+{painel === 'importar-calendario' && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/api/grade.ts
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › o ano em curso pede o calendário sem consulta
-queryFn: ({ signal }): Promise<CalendarioResponse> => authedGet(anoLetivoId === undefined ? '/v1/calendario' : `/v1/calendario?anoLetivoId=${encodeURIComponent(anoLetivoId)}`, calendarioResponseSchema, signal),
+queryFn: ({ signal }): Promise<CalendarioResponse> => authedGet(false ? '/v1/calendario' : `/v1/calendario?anoLetivoId=${encodeURIComponent(anoLetivoId)}`, calendarioResponseSchema, signal),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/grade-da-turma.ts
teste: apps/web/src/areas/coordenacao/grade/grade-da-turma.test.ts › mostra segunda a sexta sempre
-const dias = [1, 2, 3, 4, 5, 6, 7].filter((dia) => (DIAS_DA_SEMANA_LETIVA as readonly number[]).includes(dia) || diasComAula.has(dia)).map((numero) => ({ numero, nome: NOME_DO_DIA[numero] ?? String(numero) }))
+const dias = [1, 2, 3, 4, 5, 6, 7].filter((dia) => (DIAS_DA_SEMANA_LETIVA as readonly number[]).includes(dia) || false).map((numero) => ({ numero, nome: NOME_DO_DIA[numero] ?? String(numero) }))
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/grade-da-turma.ts
teste: apps/web/src/areas/coordenacao/grade/grade-da-turma.test.ts › um horário por par início-fim
-a.inicio === b.inicio ? a.fim.localeCompare(b.fim) : a.inicio.localeCompare(b.inicio),
+a.inicio.localeCompare(b.inicio),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/grade-da-turma.ts
teste: apps/web/src/areas/coordenacao/grade/grade-da-turma.test.ts › duas aulas no mesmo dia e horário
-const daCelula = celulas.get(chave) ?? []
+const daCelula = (celulas.get(chave) as AulaDaCelula[])
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/grade-da-turma.ts
teste: apps/web/src/areas/coordenacao/grade/grade-da-turma.test.ts › a disciplina que a escola já não tem
-daCelula.push({ id: aula.id, disciplina: nomeDaDisciplina(aula.disciplinaId) ?? NOME_DA_DISCIPLINA_QUE_SAIU, professor: aula.professor.nome, sala: aula.sala })
+daCelula.push({ id: aula.id, disciplina: nomeDaDisciplina(aula.disciplinaId) ?? '', professor: aula.professor.nome, sala: aula.sala })
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/grade-da-turma.ts
teste: apps/web/src/areas/coordenacao/grade/grade-da-turma.test.ts › se desempatam pelo nome do professor
-for (const daCelula of celulas.values()) daCelula.sort((a, b) => a.disciplina.localeCompare(b.disciplina, 'pt-BR') || a.professor.localeCompare(b.professor, 'pt-BR'))
+for (const daCelula of celulas.values()) daCelula.sort((a, b) => a.disciplina.localeCompare(b.disciplina, 'pt-BR') )
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/grade-da-turma.ts
teste: apps/web/src/areas/coordenacao/grade/grade-da-turma.test.ts › a aula cai no dia e no horário dela
-return { dias, horarios, aulasEm: (dia, horario) => celulas.get(`${String(dia)}|${horario.chave}`) ?? [] }
+return { dias, horarios, aulasEm: (dia, horario) => celulas.get(`${String(dia)}|${horario.chave}`) ?? [{ id: 'x', disciplina: 'x', professor: 'x', sala: null }] }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/textos-da-grade.ts
teste: apps/web/src/areas/coordenacao/grade/textos-da-grade.test.ts › a grade conta as aulas
 export function textoDaConclusaoDaGrade(resumo: ResumoDaImportacao | null): string {
-const n = (chave: keyof ResumoDaImportacao): number => resumo?.[chave] ?? 0
+const n = (chave: keyof ResumoDaImportacao): number => resumo?.[chave] ?? 1
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/textos-da-grade.ts
teste: apps/web/src/areas/coordenacao/grade/textos-da-grade.test.ts › o calendário conta os eventos
 export function textoDaConclusaoDoCalendario(resumo: ResumoDaImportacao | null): string {
-const n = (chave: keyof ResumoDaImportacao): number => resumo?.[chave] ?? 0
+const n = (chave: keyof ResumoDaImportacao): number => resumo?.[chave] ?? 1
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/textos-da-grade.ts
teste: apps/web/src/areas/coordenacao/grade/textos-da-grade.test.ts › a grade conta as aulas
 [n('vinculos_encerrados'), 'vínculo de professor foi encerrado', 'vínculos de professor foram encerrados'],
 ]
-return contagens.flatMap(([quantos, um, varios], posicao) => (posicao === 0 || quantos > 0 ? [`${formatQuantity(quantos, um, varios)}.`] : [])).join(' ')
+return contagens.flatMap(([quantos, um, varios], posicao) => (quantos > 0 ? [`${formatQuantity(quantos, um, varios)}.`] : [])).join(' ')
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/textos-da-grade.ts
teste: apps/web/src/areas/coordenacao/grade/textos-da-grade.test.ts › o calendário conta os eventos
 [n('eventos_removidos'), 'evento saiu do calendário', 'eventos saíram do calendário'],
 ]
-return contagens.flatMap(([quantos, um, varios], posicao) => (posicao === 0 || quantos > 0 ? [`${formatQuantity(quantos, um, varios)}.`] : [])).join(' ')
+return contagens.flatMap(([quantos, um, varios], posicao) => (quantos > 0 ? [`${formatQuantity(quantos, um, varios)}.`] : [])).join(' ')
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › 14.0: a grade que só tira aula
-conclusao: configuracao.textoDaConclusao?.(importacao.resumo) ?? textoDaConclusao(importacao.resumo, linhasDeFora(linhas, marcadas, importacao.resumo)),
+conclusao: textoDaConclusao(importacao.resumo, linhasDeFora(linhas, marcadas, importacao.resumo)),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › o convite do começo, o carregando, a prévia, a recusa e o resultado se revezam
-conclusao: configuracao.textoDaConclusao?.(importacao.resumo) ?? textoDaConclusao(importacao.resumo, linhasDeFora(linhas, marcadas, importacao.resumo)),
+conclusao: configuracao.textoDaConclusao!(importacao.resumo) ?? textoDaConclusao(importacao.resumo, linhasDeFora(linhas, marcadas, importacao.resumo)),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › o aviso, as turmas novas e o resto só aparecem quando há o que dizer
-if (resto.length === 0 && efeitos.length === 0) return null
+if (resto.length === 0 || efeitos.length === 0) return null
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › as contagens dizem o que nasce e o que sai
-return FRASE_DA_CONTAGEM.flatMap(([chave, singular, plural]) => ((contagens[chave] ?? 0) === 0 ? [] : [`${formatQuantity(contagens[chave] ?? 0, singular, plural)}.`]))
+return FRASE_DA_CONTAGEM.flatMap(([chave, singular, plural]) => ((contagens[chave] ?? 0) === 99 ? [] : [`${formatQuantity(contagens[chave] ?? 0, singular, plural)}.`]))
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › as contagens dizem o que nasce e o que sai
-return FRASE_DA_CONTAGEM.flatMap(([chave, singular, plural]) => ((contagens[chave] ?? 0) === 0 ? [] : [`${formatQuantity(contagens[chave] ?? 0, singular, plural)}.`]))
+return FRASE_DA_CONTAGEM.flatMap(([chave, singular, plural]) => ((contagens[chave]) === 0 ? [] : [`${formatQuantity(contagens[chave] ?? 0, singular, plural)}.`]))
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › a planilha que só tira aula ou evento
-const tira = (previa.contagens?.aulas_removidas ?? 0) + (previa.contagens?.eventos_removidos ?? 0) > 0
+const tira = (previa.contagens?.eventos_removidos ?? 0) > 0
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › a planilha que só tira aula ou evento
-const tira = (previa.contagens?.aulas_removidas ?? 0) + (previa.contagens?.eventos_removidos ?? 0) > 0
+const tira = (previa.contagens?.aulas_removidas ?? 0) > 0
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › a planilha que só tira aula ou evento
-if (!grava && !tira && marcas === 0) return { pode: false, motivo: MOTIVO_DE_NADA_NOVO }
+if (!grava && marcas === 0) return { pode: false, motivo: MOTIVO_DE_NADA_NOVO }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › a planilha que só tira aula ou evento
-if (!grava && !tira && marcas === 0) return { pode: false, motivo: MOTIVO_DE_NADA_NOVO }
+if (!grava && !tira) return { pode: false, motivo: MOTIVO_DE_NADA_NOVO }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/textos-da-grade.ts
teste: apps/web/src/areas/coordenacao/grade/textos-da-grade.test.ts › o aviso de não escrever nome de pessoa está nas duas instruções e nos cinco textos de vazio e de modelos
-export const AVISO_DA_SALA = 'Na sala, escreva só o lugar, como “Lab 2” ou “Sala 12”, nunca o nome de uma pessoa.'
+export const AVISO_DA_SALA = ''
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/textos-da-grade.ts
teste: apps/web/src/areas/coordenacao/grade/textos-da-grade.test.ts › o aviso de não escrever nome de pessoa está nas duas instruções e nos cinco textos de vazio e de modelos
-export const AVISO_DA_DESCRICAO = 'Na descrição, escreva só o que acontece, como “Feriado municipal”, nunca o nome de uma pessoa.'
+export const AVISO_DA_DESCRICAO = ''
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/textos-da-grade.ts
teste: apps/web/src/areas/coordenacao/grade/textos-da-grade.test.ts › o aviso de não escrever nome de pessoa está nas duas instruções e nos cinco textos de vazio e de modelos
-`Uma linha por aula, com a turma, a disciplina, o nome e o e-mail do professor, o dia, o início e o fim, e a sala, se houver. ${AVISO_DA_SALA} Escolha o CSV ou o Excel (.xlsx), até ${formatNumber(maximo)} linhas. Turma, disciplina e professor que ainda não existem nascem ao gravar. Importar de novo substitui a grade do ano.`
+`Uma linha por aula, com a turma, a disciplina, o nome e o e-mail do professor, o dia, o início e o fim, e a sala, se houver. Escolha o CSV ou o Excel (.xlsx), até ${formatNumber(maximo)} linhas. Turma, disciplina e professor que ainda não existem nascem ao gravar. Importar de novo substitui a grade do ano.`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/textos-da-grade.ts
teste: apps/web/src/areas/coordenacao/grade/textos-da-grade.test.ts › o aviso de não escrever nome de pessoa está nas duas instruções e nos cinco textos de vazio e de modelos
-`Uma linha por feriado, recesso ou evento, com o início, o fim, o tipo e a descrição. ${AVISO_DA_DESCRICAO} Escolha o CSV ou o Excel (.xlsx), até ${formatNumber(maximo)} linhas. Importar de novo substitui os eventos do ano: o que a planilha não traz sai, e a prévia diz quantos.`
+`Uma linha por feriado, recesso ou evento, com o início, o fim, o tipo e a descrição. Escolha o CSV ou o Excel (.xlsx), até ${formatNumber(maximo)} linhas. Importar de novo substitui os eventos do ano: o que a planilha não traz sai, e a prévia diz quantos.`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/textos-da-grade.ts
teste: apps/web/src/areas/coordenacao/grade/textos-da-grade.test.ts › o aviso de não escrever nome de pessoa está nas duas instruções e nos cinco textos de vazio e de modelos
-export const VAZIO_DO_PAINEL_DA_GRADE = `Baixe o modelo da grade, preencha uma linha por aula e escolha o arquivo para ver a prévia. ${AVISO_DA_SALA}`
+export const VAZIO_DO_PAINEL_DA_GRADE = `Baixe o modelo da grade, preencha uma linha por aula e escolha o arquivo para ver a prévia.`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/textos-da-grade.ts
teste: apps/web/src/areas/coordenacao/grade/textos-da-grade.test.ts › o aviso de não escrever nome de pessoa está nas duas instruções e nos cinco textos de vazio e de modelos
-export const VAZIO_DO_PAINEL_DO_CALENDARIO = `Baixe o modelo do calendário, preencha uma linha por evento e escolha o arquivo para ver a prévia. ${AVISO_DA_DESCRICAO}`
+export const VAZIO_DO_PAINEL_DO_CALENDARIO = `Baixe o modelo do calendário, preencha uma linha por evento e escolha o arquivo para ver a prévia.`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/textos-da-grade.ts
teste: apps/web/src/areas/coordenacao/grade/textos-da-grade.test.ts › o aviso de não escrever nome de pessoa está nas duas instruções e nos cinco textos de vazio e de modelos
-export const VAZIO_DA_GRADE = `Baixe o modelo da grade, preencha uma linha por aula e use “Importar grade”. A grade nasce da planilha: aqui você só a lê. ${AVISO_DA_SALA}`
+export const VAZIO_DA_GRADE = `Baixe o modelo da grade, preencha uma linha por aula e use “Importar grade”. A grade nasce da planilha: aqui você só a lê.`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/textos-da-grade.ts
teste: apps/web/src/areas/coordenacao/grade/textos-da-grade.test.ts › o aviso de não escrever nome de pessoa está nas duas instruções e nos cinco textos de vazio e de modelos
-export const VAZIO_DO_CALENDARIO = `Baixe o modelo do calendário, preencha uma linha por feriado, recesso ou evento e use “Importar calendário”. ${AVISO_DA_DESCRICAO}`
+export const VAZIO_DO_CALENDARIO = `Baixe o modelo do calendário, preencha uma linha por feriado, recesso ou evento e use “Importar calendário”.`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/textos-da-grade.ts
teste: apps/web/src/areas/coordenacao/grade/textos-da-grade.test.ts › o aviso de não escrever nome de pessoa está nas duas instruções e nos cinco textos de vazio e de modelos
-export const TEXTO_DOS_MODELOS = `Os quatro modelos trazem só o cabeçalho. Preencha, salve como Excel ou CSV e importe: o modelo preenchido entra sem erro. ${AVISO_DA_SALA} ${AVISO_DA_DESCRICAO}`
+export const TEXTO_DOS_MODELOS = `Os quatro modelos trazem só o cabeçalho. Preencha, salve como Excel ou CSV e importe: o modelo preenchido entra sem erro. ${AVISO_DA_SALA}`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/textos-da-grade.ts
teste: apps/web/src/areas/coordenacao/grade/textos-da-grade.test.ts › o calendário diz o fim antes do início do jeito dele: o evento de um dia só é válido, e não fala em horário
-export const ERROS_DA_LINHA_DO_CALENDARIO: Readonly<Record<string, string>> = { fim_antes_do_inicio: 'O fim vem antes do início. Confira as duas colunas: o evento de um dia só tem o mesmo dia nas duas.' }
+export const ERROS_DA_LINHA_DO_CALENDARIO: Readonly<Record<string, string>> = { fim_antes_do_inicio: 'O fim vem antes do início, ou no mesmo horário. Confira as duas colunas.' }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › a turma sem aula: o vazio diz qual é a turma
-descricao={VAZIO_DA_GRADE}
+descricao=""
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › vazio no ano em curso
-descricao={noPlanejado ? 'O calendário do ano planejado ainda não foi gravado.' : VAZIO_DO_CALENDARIO}
+descricao={noPlanejado ? 'O calendário do ano planejado ainda não foi gravado.' : ''}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › a seção dos modelos pede, para a sala e para a descrição do evento, que não se escreva nome de pessoa
-<p className="text-apoio">{TEXTO_DOS_MODELOS}</p>
+<p className="text-apoio"></p>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › o ano escolhido sai da lista depois de uma gravação
-const ano = legiveis.find((candidato) => candidato.id === escolhido) ?? anoEmCurso
+const ano = legiveis.find((candidato) => candidato.id === escolhido) ?? undefined as never
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/PaineisDeImportacao.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › o painel da grade diz na instrução e no vazio
-vazio: { titulo: 'Nenhuma planilha escolhida', descricao: VAZIO_DO_PAINEL_DA_GRADE },
+vazio: { titulo: 'Nenhuma planilha escolhida', descricao: '' },
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/PaineisDeImportacao.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › o painel do calendário diz na instrução e no vazio
-vazio: { titulo: 'Nenhuma planilha escolhida', descricao: VAZIO_DO_PAINEL_DO_CALENDARIO },
+vazio: { titulo: 'Nenhuma planilha escolhida', descricao: '' },
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/PaineisDeImportacao.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › o painel da grade diz na instrução e no vazio
-nomeDoModelo: MODELO_DE_CADA_TIPO.grade.arquivo,
+nomeDoModelo: MODELO_DE_CADA_TIPO.calendario.arquivo,
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/PaineisDeImportacao.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › o painel do calendário diz na instrução e no vazio
-nomeDoModelo: MODELO_DE_CADA_TIPO.calendario.arquivo,
+nomeDoModelo: MODELO_DE_CADA_TIPO.grade.arquivo,
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/PaineisDeImportacao.tsx
teste: apps/web/src/areas/coordenacao/grade/GradeECalendario.test.tsx › a prévia da calendario diz o fim antes do início do jeito dela
-textosDoErroDaLinha: ERROS_DA_LINHA_DO_CALENDARIO,
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/modelos-de-planilha.ts
teste: apps/web/src/areas/coordenacao/grade/modelos-de-planilha.test.ts › baixar entrega o arquivo do tipo com o nome dele, e o conteúdo é o cabeçalho do tipo
-baixarModelo(CABECALHOS_DA_PLANILHA[tipo], MODELO_DE_CADA_TIPO[tipo].arquivo)
+baixarModelo(CABECALHOS_DA_PLANILHA.alunos, MODELO_DE_CADA_TIPO[tipo].arquivo)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/modelos-de-planilha.ts
teste: apps/web/src/areas/coordenacao/grade/modelos-de-planilha.test.ts › baixar entrega o arquivo do tipo com o nome dele, e o conteúdo é o cabeçalho do tipo
-baixarModelo(CABECALHOS_DA_PLANILHA[tipo], MODELO_DE_CADA_TIPO[tipo].arquivo)
+baixarModelo(CABECALHOS_DA_PLANILHA[tipo], 'modelo.csv')
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/grade/modelos-de-planilha.ts
teste: apps/web/src/areas/coordenacao/grade/modelos-de-planilha.test.ts › há um modelo para cada tipo de planilha, na ordem em que a escola se monta, cada um com o nome do arquivo e o rótulo
-export const MODELOS_DE_PLANILHA = (['alunos', 'professores', 'grade', 'calendario'] as const satisfies readonly TipoDePlanilha[]).map((tipo) => ({ tipo, ...MODELO_DE_CADA_TIPO[tipo] }))
+export const MODELOS_DE_PLANILHA = (['alunos', 'professores', 'calendario', 'grade'] as const satisfies readonly TipoDePlanilha[]).map((tipo) => ({ tipo, ...MODELO_DE_CADA_TIPO[tipo] }))
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › 14.0: o erro que a planilha diz do jeito dela usa o texto dela, e os outros seguem os gerais
-textosDoErroDaLinha={configuracao.textosDoErroDaLinha}
+textosDoErroDaLinha={undefined}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › 14.0: o erro que a planilha diz do jeito dela usa o texto dela, e os outros seguem os gerais
-{erros.length > 0 && <ListaDeLinhas titulo="Linhas com erro" linhas={erros} textoDe={(linha) => textoDoErro(linha.erro, textosDoErroDaLinha)} tom="erro" />}
+{erros.length > 0 && <ListaDeLinhas titulo="Linhas com erro" linhas={erros} textoDe={(linha) => textoDoErro(linha.erro)} tom="erro" />}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › a planilha que diz um código do jeito dela usa o texto dela
-(codigo === undefined ? undefined : (proprios?.[codigo] ?? TEXTO_DO_ERRO_DA_LINHA[codigo])) ?? TEXTO_DO_ERRO_DESCONHECIDO
+(codigo === undefined ? undefined : TEXTO_DO_ERRO_DA_LINHA[codigo]) ?? TEXTO_DO_ERRO_DESCONHECIDO
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| frontend-reviewer (1ª) | Abas no celular: a 360 px as quatro abas quebram em duas linhas, e o traço da selecionada fica só na segunda (`TabbedPage` compartilhado) | `TODO.md`: o componente é das outras áreas, e mexer nele muda todas as telas com abas |
| frontend-reviewer (1ª) | Linhas altas da grade no celular (cerca de 170 px nas colunas fora de vista, `GradeECalendario.tsx:117`) | `TODO.md`: ajuste visual que pede ver a foto de novo em várias larguras; não é bloqueio do RF |
| frontend-reviewer (1ª) | Calendário vazio sem botão "Baixar modelo do calendário" (`GradeECalendario.tsx:245-248`) | Recusada: o botão do modelo do calendário já está na seção "Modelos de planilha", logo acima, e uma segunda ação no vazio disputa com a "uma ação cheia por tela" |
| frontend-reviewer (1ª) | `docs/roteiro-da-demonstracao.md:368` ainda diz que calendário e grade "entram numa fase seguinte" | Recusada: o `revisor-geral` (1ª) conferiu que a aba não mexe no que o `e2e/roteiro-da-demonstracao.spec.ts` percorre, e a frase fala do roteiro do MVP de apresentação (tarefa 14.5 pede só conferir) |
| frontend-reviewer (1ª) | Registrar a medida com throttling de rede e de CPU | Validador, no fim da spec (regra 50, item 1: só a revisão garante) |
| conformidade-reviewer (1ª) | A prévia não anuncia `vinculos_encerrados` (a conclusão anuncia, `textos-da-grade.ts`); o coordenador não vê antes de gravar que um professor perde a turma | `TODO.md`: depende de o resumo da prévia trazer essa contagem (core, 12.0); o Arquiteto vê se é divergência |
| infra-guardian (1ª) | Depois de gravar, recarregar só `[...ESTRUTURA_QUERY_KEY, 'grade']` e `'calendario'`, e não toda a estrutura (`GradeECalendario.tsx:356`) | `TODO.md`: custo baixo hoje (só a coordenação usa a chave); passa a valer quando outra tela usar a mesma chave |
| infra-guardian (1ª) | `GET /v1/grade?turmaId=` sem paginação, conta com o teto de 3.000 linhas da planilha | Sem ação: o teto vale no servidor, que é da 12.0 |
| revisor-geral (1ª) | `ImportarPlanilha.tsx:9` importa `baixarModelo` de `../grade/modelos-de-planilha`: a peça genérica depende da aba Grade; mover `baixarModelo` e `textoDoModelo` para `importacao/` ou `comum/` | `TODO.md`: refatoração que mexe em `ImportarPlanilha.tsx` e nos imports dos testes da 13.0 e da 14.0; não cabe em poucas linhas |
| revisor-geral (1ª) | `previa-da-planilha.ts:96`: a frase "professor novo será cadastrado, com convite para copiar" descreve o que só chega na 15.0 (15.2) | Tarefa futura: `15_task.md`, subtarefa 15.2 (`TODO.md` também, para a 15.0 conferir a frase ao entregar o "Copiar link") |
| revisor-geral (1ª) | `e2e/areas.spec.ts`: a divisão do caso do aluno não tem relação com a aba nova | Mensagem do commit: dizer que o caso foi dividido para caber no prazo do portão (`Obs` do pedido) |
| test-engineer (1ª) | Uma linha em `e2e/areas.spec.ts` com o professor batendo em `/coordenacao/grade` | Recusada: a guarda da área `/coordenacao` vale pelo prefixo e é a mesma das outras abas de Escola; a aba nova não cria regra de papel |
| test-engineer (1ª) | "Uma ação cheia por tela" só é medida no vazio | Recusada: com dado a tela pode não ter nenhuma ação cheia; a regra é no máximo uma |
| privacy-guardian (1ª) | Garantir que o e-mail do professor nunca entre na frase de `email_invalido` (hoje só o código) | Sem ação: hoje está certo, e o item 1 não mexe nisso; fica o registro |
| privacy-guardian (1ª) | O aviso de não escrever nome de pessoa na sala e na descrição do evento, vindo da 5.0 (`5_task.md`) e da 12.0 (`12_task.md`) | Atendido na rodada 1 (item 1 da ordem): a instrução e o vazio de cada painel, o vazio da grade e do calendário e a seção dos modelos o trazem; `docs/lgpd.md` diz "a tela pede"; o teste está em `textos-da-grade.test.ts` e em `GradeECalendario.test.tsx` |
| revisor-geral (2ª) | A linha "convite para copiar" (frase da prévia) só recebeu o `TODO.md`; o `15_task.md` não foi tocado | `TODO.md` já tem a linha. O lembrete na subtarefa 15.2 é do Arquiteto: o Orquestrador o leva, pois o Implementador da 14.0 não edita o documento da 15.0 |
| revisor-geral (2ª) | `e2e/grade-e-calendario.spec.ts` repete a função `gate()` que existe em `e2e/support/assistente.ts` | `TODO.md`: ajuste de e2e sem efeito de comportamento; fica para a próxima tarefa que toca esse spec |
| revisor-geral (2ª) | A mensagem do commit precisa dizer que o caso do aluno em `e2e/areas.spec.ts` foi dividido para caber no prazo do portão | Mensagem do commit da 14.0 |
| test-engineer (2ª) | `e2e/grade-e-calendario.spec.ts`: esperar dois quadros resolve na prática, mas não é garantia formal; uma prova sem tempo leria um marcador na página | `TODO.md`: o teste já espera a entrega de B e passou 3 vezes seguidas com 2 trabalhadores; endurecer fica para quando houver intermitência |
| test-engineer (2ª) | A linha "A tela pede para não escrever nome de pessoa" cita o teste do painel da grade e não o do painel do calendário | Validador: confere RF a RF a cobertura de cada linha (o teste existe e está nos arquivos, só a citação fica curta) |
| tenancy-guardian (2ª) | Se o Arquiteto liberar `anoLetivoId` na prévia e no gravar da grade e do calendário (RF16), o repository precisa conferir que o ano é da escola do token, com caso de integração do ano de outra escola (404, nunca 403) | `TODO.md`, junto do item do RF16 que já cita a grade e o calendário |
| tenancy-guardian (2ª) | Continua aberto o caso de backend da 13.0 (candidato a desligar da escola B não aparece na prévia da A) | `TODO.md` já tem a linha (da 13.0) |
| conformidade-reviewer (2ª) | A prévia da grade não anuncia `vinculos_encerrados` | `TODO.md` já tem a linha desta 14.0 (1ª rodada); o Arquiteto decide se vira divergência de desenho |
| privacy-guardian (2ª) | O aviso só pede: nada no servidor impede "Sala da Prof. Ana"; se a escola pedir garantia mais forte, cabe um aviso na prévia quando a sala ou a descrição parecer nome de pessoa | `TODO.md`: tarefa de backend futura, só se a escola pedir |
| privacy-guardian (2ª) | O painel aparece cortado sobre a página na foto de página inteira do celular | Sem ação: efeito da captura, já registrado pelo `frontend-reviewer` na 1ª rodada |
| frontend-reviewer (2ª) | As quatro recomendações repetem as da 1ª rodada (abas no celular, dependência de `ImportarPlanilha`, `vinculos_encerrados`, foto de página inteira) | Já estão no `TODO.md` ou na tabela, com destino |
| infra-guardian (2ª) | Nenhuma nova | A da 1ª (recarregar só `grade` e `calendario`) segue no `TODO.md` |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-06 00:16:29 | 2026-11-06 00:16:58 | `tenancy-guardian` | 1 | APROVADO | a6c3da01aa745a9a9 |
| 2026-11-06 00:16:08 | 2026-11-06 00:17:09 | `frontend-reviewer` | 1 | APROVADO | afdc6b915ba3b043d |
| 2026-11-06 00:16:41 | 2026-11-06 00:17:11 | `conformidade-reviewer` | 1 | APROVADO | a19342ca71d8291ff |
| 2026-11-06 00:16:51 | 2026-11-06 00:17:15 | `infra-guardian` | 1 | APROVADO | a736e311e82543c8e |
| 2026-11-06 00:16:35 | 2026-11-06 00:17:44 | `privacy-guardian` | 1 | REPROVADO | a5af20ac50ec8372d |
| 2026-11-06 00:16:17 | 2026-11-06 00:18:20 | `test-engineer` | 1 | REPROVADO | a155a64892e4cefb5 |
| 2026-11-06 00:16:23 | 2026-11-06 00:18:55 | `revisor-geral` | 1 | APROVADO | a2ad2961740d265bb |
| 2026-11-06 01:07:33 | 2026-11-06 01:08:02 | `frontend-reviewer` | 2 | APROVADO | a1a6afd172ff37d61 |
| 2026-11-06 01:07:58 | 2026-11-06 01:08:27 | `tenancy-guardian` | 2 | APROVADO | a90cbe9e819255f36 |
| 2026-11-06 01:08:21 | 2026-11-06 01:08:34 | `infra-guardian` | 2 | APROVADO | a50e6a998b2f99ea5 |
| 2026-11-06 01:07:52 | 2026-11-06 01:08:35 | `revisor-geral` | 2 | APROVADO | ae64e5d8850541a30 |
| 2026-11-06 01:07:44 | 2026-11-06 01:08:39 | `test-engineer` | 2 | APROVADO | a86b5e9978b4229be |
| 2026-11-06 01:08:15 | 2026-11-06 01:08:43 | `conformidade-reviewer` | 2 | APROVADO | a73ea8cde9770b758 |
| 2026-11-06 01:08:06 | 2026-11-06 01:08:52 | `privacy-guardian` | 2 | APROVADO | a22fd90626a054532 |
