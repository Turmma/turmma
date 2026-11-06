# Tarefa 15.0 — Professores importa a planilha da equipe

**Funcionalidade:** onboarding-por-convite · **Depende de:** 6.0, 13.0
**Subagentes obrigatórios:** `frontend-reviewer`
**Porte:** pequeno

## Objetivo

Na aba Professores, a coordenação sobe a planilha de professores pelo `ImportarPlanilha`, marca quem desligar, e vê os
cadastrados `pendente`, cada um com o convite para copiar (o `convite/refazer`).

## Contexto necessário

- `techspec.md` §9 (o `ImportarPlanilha` em Professores; o convite para copiar do cadastrado pela planilha), §4 (o
  "Copiar link" faz o `convite/refazer`)
- `prd.md` RF6, RF4 (marca)
- `docs/interface.md` §3 (Professores)
- Código: `apps/web/src/areas/coordenacao/professores/Professores.tsx`, `convite-de-professor.ts`, `api/professores.ts`;
  o `ImportarPlanilha` da 13.0

## Subtarefas

- [x] 15.1 — "Importar professores" na aba, com a marca de desligar rotulada com o nome que a API devolve (o `rotulo` do candidato, sem e-mail: E11, 6.0; `techspec.md` §9)
- [x] 15.2 — O cadastrado pela planilha aparece `pendente`, com "Copiar link" pelo `convite/refazer`
- [x] 15.3 — `docs/interface.md` §3 (Professores)
- [x] 15.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/areas/coordenacao/professores/Professores.tsx`, `convite-de-professor.ts`, `api/professores.ts` | alterado |
| `e2e/professores.spec.ts` | alterado |
| `docs/interface.md` | alterado |
| `apps/web/src/areas/coordenacao/professores/PainelDaImportacaoDeProfessores.tsx`, `importar-professores.ts` (e o `.test.ts`), `professores-da-escola.ts` | novo (o painel, as palavras dele, o `?painel=importar`) e alterado |
| `apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx`, `previa-da-planilha.ts` (e os `.test`) | alterado: a peça aceita os textos de marca da planilha (a de professores desliga "professor", e não "aluno") e o aviso do e-mail repetido |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| Importar a planilha de professores com prévia e gravar | e2e | caminho feliz (RF6) | `e2e/professores.spec.ts › RF6 (15.0) › o caminho feliz` |
| A marca de desligar é rotulada com o nome, sem e-mail na tela, e sem marca ninguém sai | e2e | RF4 | `e2e/professores.spec.ts › RF4 e regra 70 (15.0) › a marca chega desmarcada e rotulada só com o nome`; `› só sai quem a coordenação marcou` |
| O cadastrado aparece `pendente` sem recarregar a página | e2e | | `e2e/professores.spec.ts › o caminho feliz` (a lista de trás, pendente, sem recarregar a página) |
| "Copiar link" do cadastrado faz o `convite/refazer` | e2e | §4 | `e2e/professores.spec.ts › o "Copiar link" do cadastrado pela planilha é o convite/refazer` |
| Carregando | e2e | estados | `e2e/professores.spec.ts › o caminho feliz` (o carregando da prévia) |
| Erro com "Tentar de novo" | e2e | estados | `e2e/professores.spec.ts › a prévia que falha diz o que fazer, com "Tentar de novo"` |
| Vazio com "Baixar modelo" | e2e | estados | `e2e/professores.spec.ts › o caminho feliz` (o vazio, com "Baixar modelo") |
| Com dado | e2e | estados | `e2e/professores.spec.ts › o caminho feliz` (com dado); `› a marca chega desmarcada…` |
| Recomeço: a lista recarrega com o diálogo aberto | e2e | | `e2e/professores.spec.ts › a lista que se recarrega com o painel aberto, e que cai` |
| Recomeço: resposta atrasada | e2e | | `e2e/professores.spec.ts › a resposta atrasada da prévia anterior não aparece no lugar da nova` |
| Recomeço: a segunda pessoa na mesma aba | e2e | | `e2e/professores.spec.ts › a pessoa seguinte na mesma aba não vê a prévia` |
| Recomeço: o mesmo arquivo de novo | e2e | | `e2e/professores.spec.ts › a resposta atrasada…` (o mesmo arquivo de novo) |
| 360 px sem rolagem horizontal | e2e | | `e2e/professores.spec.ts › a marca chega desmarcada…` (no `celular`, 360 px, com o diálogo) |
| Cabe em 1366 × 768 sem a página rolar (`paginaNaoRola`) | e2e | | `e2e/professores.spec.ts › a marca chega desmarcada…` (`paginaNaoRola`, no `chromebook`) |
| Alvos de 44 e 24 px | e2e | | `e2e/professores.spec.ts › a marca chega desmarcada…` (o gravar de 44 px; a marca, "Baixar modelo" e "Trocar arquivo" de 24 px; "Importar professores" de 44 px) |
| axe | e2e | | `e2e/professores.spec.ts › a marca chega desmarcada…` e `› o erro e o aviso saem em frase` (axe) |
| Uma ação cheia por tela | e2e | | `e2e/professores.spec.ts › a marca chega desmarcada…` (um `bg-laranja` no painel e um na lista) |

## Como testar

- Estados: `e2e/professores.spec.ts › carregando; o vazio "Nenhum professor ainda" com o Cadastrar; o erro com "Tentar de novo"; …`; o link: `› W14: o resumo antes de enviar, o link uma vez com "Link copiado"; …`; 360 px e alvos: `› sem rolagem horizontal, também no diálogo; cartões e alvos de 44 px; …`
- O componente: o spec da 13.0 (`e2e/importar-alunos.spec.ts`)
- Comando: `node tools/ci/e2e.ts --manter-ambiente e2e/professores.spec.ts`
- **Telas:** `coordenacao`, `/coordenacao/professores`, `text=Professores` → "Importar professores" → prévia com marca; → lista com o cadastrado `pendente`; sem mockup

## Autoconferência

As 12 perguntas do modelo, no plano. Na 2, procure em `e2e/` os textos da lista de professores que contam linhas.

**Plano.** (1) `PainelDaImportacaoDeProfessores` + `importar-professores.ts`: a `ImportarPlanilha` da 13.0 com a configuração dos professores
(`rotasDaPlanilha('professores')`, sem `anoLetivoId` nem `turmaId`). (2) A peça ganha `textosDosGruposDeMarca` e `frasesDoResumoDeMarcas`: a marca de
desligar diz "professor", e não "aluno". (3) `Professores.tsx`: "Importar professores", botão secundário ao lado de "Cadastrar professor" e no vazio;
`?painel=importar` abre o painel fora dos estados da lista; ao gravar, `recarregarAEstrutura` relê a lista e o cadastrado aparece `pendente`, e o link
sai pelo "Refazer convite" do painel, que é o `convite/refazer`. (4) `interface.md` §3. Testes: unidade (textos, a peça, a tela) e o e2e das linhas da tabela.

1. **Mutação de cada cláusula:** os blocos de "Mutações" (cada condição e cada `??` novos, o `focoDeReserva` do painel, os dois botões, o painel, o `aoConcluir` e o `aoFechar`).
2. **Texto novo na tela:** "Importar professores", "Gravar professores", "Estão na escola, mas não aparecem na planilha" e as frases do resultado não existiam em `e2e/`
   (`grep -rn` vazio, fora do próprio spec). Os specs que passam por Professores (`escola-montada`, `roteiro-da-demonstracao`) citam "Cadastrar professor" por nome, e nenhum conta botões.
   `titulo-das-telas.test.tsx` não conta botões. A lista conta linhas por `tbody tr`/`li`, que o botão novo não altera.
3. **Segundo dado:** o seed tem quatro ausentes em quatro estados (ativo, aceito e pendente ausentes, e um ativo que a planilha traz): só `ativo` e `aceito` são candidatos, o pendente não, e o que a planilha traz não. Apagar o filtro da API deixaria a contagem do grupo diferente de 2.
4. **Checagem anterior que responde antes:** o painel abre pelo endereço sem esperar a lista (fica fora dos estados dela); a prévia só chega com o arquivo; o gravar só aparece sem erro. Cada caso chega à linha que prova.
5. **Asserção sobre o resultado:** a lista de trás, os estados em texto, o `POST` de `convite/refazer` e o convite em aberto no banco; nenhuma sobre texto de arquivo.
6. **Guarda nova:** nenhuma regra de lint, teste estrutural nem trava de pasta. Não se aplica.
7. **Comentário que afirma o que o código não faz:** conferi os docblocks de `Professores.tsx`, `PainelDaImportacaoDeProfessores.tsx` e `importar-professores.ts`: dizem o rótulo "só com o nome" e que o link sai pelo "Refazer convite" (a gravação não mostra link).
8. **Divergência:** uma, a do rótulo; a coluna "Onde está na spec" aponta `techspec.md` §9, que o Arquiteto já corrigiu (c48b35d1), e o texto de `interface.md`. `grep -rn "nome e e-mail" tasks/prd-onboarding-por-convite` só acha a frase da planilha e o cadastro, não a marca.
9. **Peça que já existe:** a `ImportarPlanilha`, o `Sheet`, o `enderecoComParametro`, o `recarregarAEstrutura`, o diálogo do `Refazer convite` e `MODELO_DE_CADA_TIPO`; nada copiado.
10. **Duas ao mesmo tempo / fora de ordem:** o clique duplo no gravar (um pedido só, já da 13.0, provado de novo aqui), e a resposta atrasada da prévia com a ordem forçada por `gate()`. Sem corrida de banco nova: a tarefa não toca a API.
11. **Isolamento e "Caso":** a tarefa não toca repository nem API (só a web); o isolamento da planilha de professores é da 6.0. Cada linha da tabela de testes tem o caso na coluna "Caso".
12. **Guardiões:** só `frontend-reviewer`: os quatro estados, 360 px, alvos, uma ação cheia, foco, texto em português com o que fazer, sem e-mail na tela. O `achados/indice.md` já diz da 13.0 e da 14.0: a resposta atrasada, o mesmo arquivo de novo e a segunda pessoa na mesma aba têm caso; o foco devolvido tem teste de unidade e de e2e.

**Link e frase da prévia (observação da 14.0).** A gravação de professores não mostra link (o token é descartado no job). A frase da grade, "professor novo será cadastrado, com convite para copiar",
é verdadeira, mas curta: o link vem pelo "Refazer convite" do painel dele. Na planilha de professores a instrução do painel e o resultado dizem o caminho; a frase da grade não foi mexida (é da 14.0, e a tela de professores a explica).

## Fora do escopo desta tarefa

"Enviar convites" e o estado do envio (F2c).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| A marca de desligar do professor é rotulada só com o nome que a API devolve (o `rotulo` do candidato), e não com nome e e-mail | A API não manda o e-mail do candidato, de propósito (6.0, E11: o e-mail nunca sai da API, e a lista de professores não o traz); mudar isso era reabrir a privacidade e o `core`. Opção (b) do Arquiteto, em resposta à `DIVERGÊNCIA` desta tarefa | `techspec.md` §9 (c48b35d1: "marca rotulada com nome e matrícula (aluno) ou só com o nome (professor…)"); `15_task.md` 15.1 e a linha do teste; `packages/core/src/importacao/tipos/professores.ts:170`; `docs/interface.md` §3 (Professores), nesta tarefa. Nenhum id do `cenarios.md` diz o rótulo |

## Mutações

--faltando: 0 linhas (20 blocos, 0 motivos)

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › 15.0: a planilha que diz as marcas do jeito dela
-{previa.candidatos.length > 0 && (
+{false && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › chegam todas desmarcadas
falha: queryByRole('group', { name: /Saem da grade nova/ })).toBeNull()
-return doGrupo.length === 0 ? null : <GrupoDeMarca key={acao} acao={acao} texto={textoDoGrupoDeMarca(acao, textos)} candidatos={doGrupo} escolhidos={marcas[acao]} aoMarcar={aoMarcar} aoMarcarTodos={aoMarcarTodos} />
+return false ? null : <GrupoDeMarca key={acao} acao={acao} texto={textoDoGrupoDeMarca(acao, textos)} candidatos={doGrupo} escolhidos={marcas[acao]} aoMarcar={aoMarcar} aoMarcarTodos={aoMarcarTodos} />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › o grupo de marca é o da planilha, se ela tem o seu
-export const textoDoGrupoDeMarca = (acao: AcaoDeMarca, proprios?: TextosDosGruposDeMarca): TextoDoGrupoDeMarca => proprios?.[acao] ?? TEXTO_DO_GRUPO_DE_MARCA[acao]
+export const textoDoGrupoDeMarca = (acao: AcaoDeMarca, proprios?: TextosDosGruposDeMarca): TextoDoGrupoDeMarca => TEXTO_DO_GRUPO_DE_MARCA[acao]
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › o grupo de marca é o da planilha, se ela tem o seu
-export const textoDoGrupoDeMarca = (acao: AcaoDeMarca, proprios?: TextosDosGruposDeMarca): TextoDoGrupoDeMarca => proprios?.[acao] ?? TEXTO_DO_GRUPO_DE_MARCA[acao]
+export const textoDoGrupoDeMarca = (acao: AcaoDeMarca, proprios?: TextosDosGruposDeMarca): TextoDoGrupoDeMarca => proprios?.[acao] as TextoDoGrupoDeMarca
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › o resumo das marcas usa a frase da planilha
-const [um, varios] = proprias?.[acao] ?? FRASE_DO_RESUMO_DE_MARCA[acao]
+const [um, varios] = FRASE_DO_RESUMO_DE_MARCA[acao]
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › o resumo das marcas diz o que cada marca vai fazer
-const [um, varios] = proprias?.[acao] ?? FRASE_DO_RESUMO_DE_MARCA[acao]
+const [um, varios] = proprias?.[acao] ?? FRASE_DO_RESUMO_DE_MARCA['transferir']
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › o resumo das marcas diz o que cada marca vai fazer
-return marcas[acao].size === 0 ? [] : [formatQuantity(marcas[acao].size, um, varios)]
+return false ? [] : [formatQuantity(marcas[acao].size, um, varios)]
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/Professores.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › o endereço que pede a planilha e um professor ao mesmo tempo abre só a planilha
falha: expect(screen.getAllByRole('dialog')).toHaveLength(1)
-const doPainel = dados === undefined || importando ? undefined : professorDoEndereco(busca, dados.itens)
+const doPainel = dados === undefined ? undefined : professorDoEndereco(busca, dados.itens)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/Professores.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › o botão abre o painel no endereço
-{importando && <PainelDaImportacaoDeProfessores aoConcluir={recarregarAEstrutura} aoFechar={fecharImportacao} focoDeReserva={focarNaLista} />}
+{false && <PainelDaImportacaoDeProfessores aoConcluir={recarregarAEstrutura} aoFechar={fecharImportacao} focoDeReserva={focarNaLista} />}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/Professores.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › a planilha pede a prévia e o gravar de professores
-{importando && <PainelDaImportacaoDeProfessores aoConcluir={recarregarAEstrutura} aoFechar={fecharImportacao} focoDeReserva={focarNaLista} />}
+{importando && <PainelDaImportacaoDeProfessores aoConcluir={() => undefined} aoFechar={fecharImportacao} focoDeReserva={focarNaLista} />}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/Professores.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › o botão abre o painel no endereço
-{importando && <PainelDaImportacaoDeProfessores aoConcluir={recarregarAEstrutura} aoFechar={fecharImportacao} focoDeReserva={focarNaLista} />}
+{importando && <PainelDaImportacaoDeProfessores aoConcluir={recarregarAEstrutura} aoFechar={() => undefined} focoDeReserva={focarNaLista} />}
```


```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/Professores.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › o botão abre o painel no endereço
 <div className="flex flex-wrap items-center gap-3">
-<button type="button" onClick={abrirImportacao} className={SECONDARY_BUTTON_CLASSES}>
+<button type="button" onClick={() => undefined} className={SECONDARY_BUTTON_CLASSES}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/Professores.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › o vazio também convida a importar
 <div>
-<button type="button" onClick={abrirImportacao} className={SECONDARY_BUTTON_CLASSES}>
+<button type="button" onClick={() => undefined} className={SECONDARY_BUTTON_CLASSES}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/Professores.tsx
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › pelo endereço, abre já com o painel, e fechado o foco vai ao título da lista
falha: expect(document.activeElement).toBe(titulo)
-{importando && <PainelDaImportacaoDeProfessores aoConcluir={recarregarAEstrutura} aoFechar={fecharImportacao} focoDeReserva={focarNaLista} />}
+{importando && <PainelDaImportacaoDeProfessores aoConcluir={recarregarAEstrutura} aoFechar={fecharImportacao} focoDeReserva={() => undefined} />}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/professores-da-escola.ts
teste: apps/web/src/areas/coordenacao/professores/Professores.test.tsx › pelo endereço, abre já com o painel
-return new URLSearchParams(busca).get('painel') === 'importar'
+return new URLSearchParams(busca).get('painel') !== 'importar'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/importar-professores.ts
teste: apps/web/src/areas/coordenacao/professores/importar-professores.test.ts › ao terminar, "cadastrados" sempre aparece
-const n = (chave: keyof ResumoDaImportacao): number => resumo?.[chave] ?? 0
+const n = (chave: keyof ResumoDaImportacao): number => resumo?.[chave] ?? 1
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/importar-professores.ts
teste: apps/web/src/areas/coordenacao/professores/importar-professores.test.ts › ao terminar, "cadastrados" sempre aparece
-const partes = contagens.flatMap(([quantos, um, varios], posicao) => (posicao === 0 || quantos > 0 ? [`${formatQuantity(quantos, um, varios)}.`] : []))
+const partes = contagens.flatMap(([quantos, um, varios], posicao) => (quantos > 0 ? [`${formatQuantity(quantos, um, varios)}.`] : []))
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/importar-professores.ts
teste: apps/web/src/areas/coordenacao/professores/importar-professores.test.ts › ao terminar, "cadastrados" sempre aparece
-const partes = contagens.flatMap(([quantos, um, varios], posicao) => (posicao === 0 || quantos > 0 ? [`${formatQuantity(quantos, um, varios)}.`] : []))
+const partes = contagens.flatMap(([quantos, um, varios], posicao) => (true ? [`${formatQuantity(quantos, um, varios)}.`] : []))
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/importar-professores.ts
teste: apps/web/src/areas/coordenacao/professores/importar-professores.test.ts › ao terminar, "cadastrados" sempre aparece
-if (n('entram') > 0) partes.push('Para pegar o link de cada um, abra o professor na lista e use “Refazer convite”: o link aparece uma vez.')
+if (true) partes.push('Para pegar o link de cada um, abra o professor na lista e use “Refazer convite”: o link aparece uma vez.')
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/importar-professores.ts
teste: apps/web/src/areas/coordenacao/professores/importar-professores.test.ts › ao terminar, "cadastrados" sempre aparece
-if (n('entram') > 0) partes.push('Para pegar o link de cada um, abra o professor na lista e use “Refazer convite”: o link aparece uma vez.')
+if (false) partes.push('Para pegar o link de cada um, abra o professor na lista e use “Refazer convite”: o link aparece uma vez.')
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| frontend-reviewer (1ª) | "A vitrine não mostra o botão "Importar professores" no estado vazio (`Professores.tsx`, ramo do `EmptyState`), porque a escola "vazia" da vitrine tem 1 professor. O e2e cobre esse caso. Vale conferir na validação que o botão fica bem alinhado ao lado do "Cadastrar professor" do `EmptyState`." | Validador (fotografa cada requisito com tela); o vazio já tem `Professores.test.tsx › o vazio também convida a importar` e o e2e |
| frontend-reviewer (1ª) | "A instrução do painel é um parágrafo longo (5 linhas a 360 px). Dá para quebrar em dois ou três itens, ou encurtar." | Recusada: o próprio revisor disse "Gosto, não defeito"; nenhum RF do PRD trata do tamanho da instrução |
| frontend-reviewer (1ª) | "O cabeçalho do celular trunca o nome da escola ("Colégio s…"). É da moldura, anterior a esta tarefa." | `TODO.md` (a moldura não é desta tarefa) |
| conformidade-reviewer (1ª), privacy-guardian (1ª) | Na foto `…Importar-professores--celular.png`, o painel termina no meio da tela e um cartão da lista aparece abaixo | Recusada: o `frontend-reviewer` viu as mesmas fotos e disse que é efeito da captura da página inteira com a barra fixa, "e não defeito" |
| revisor-geral (1ª) | "O botão é um `<button>` cru com `SECONDARY_BUTTON_CLASSES`, ao lado de um `<Button>` … o componente `Button` com a variante secundária seria o jeito único. Fica para a retro, se valer padronizar." | Retro: o padrão já existe em `GradeECalendario` e `Estrutura` |
| revisor-geral (1ª) | Na foto da escola vazia no celular aparece um professor ativo, e não o vazio "Nenhum professor ainda" | `TODO.md` (a escola "vazia" da vitrine tem um professor; é da ferramenta `tools/vitrine/`, não desta tarefa) |
| test-engineer (1ª) | "Dois professores ausentes com o mesmo nome ficam indistinguíveis na marca. … deve ir à validação e ao Arquiteto, por exemplo com um diferenciador que não seja e-mail" | `TODO.md`, e ao Validador e ao Arquiteto: o rótulo só com o nome é a opção (b) do Arquiteto (divergência resolvida desta tarefa), e a API é da 6.0 |
| test-engineer (1ª) | "O teste antigo "chegam todas desmarcadas" foi reordenado. … fica o registro de que a mudança é só de ordem." | Nada a fazer: o revisor só registra que o comportamento provado é o mesmo |
| infra-guardian (1ª) | "Com 300 professores, são 300 pedidos feitos à mão … A F2c precisa enviar pela fila de lote com limite por escola, e não pela tela." | F2c ("Enviar convites"), a tarefa futura que trata do envio em lote; está no "Fora do escopo" desta tarefa |
| frontend-reviewer (2ª) | "Se a prévia com a marca ganhar um jeito de ser fotografada (o comando de foto ainda não sobe arquivo), conferir a quebra do texto longo de `DESLIGAR_PROFESSOR` a 360 px. … a explicação ficou com quatro frases e vai ocupar umas 8 linhas no celular." | Validador (fotografa cada requisito com tela); o e2e já prova 360 px sem rolagem horizontal no diálogo |
| revisor-geral (2ª) | "Para a validação: a frase nova de `DESLIGAR_PROFESSOR` só aparece na prévia com a marca … Vale conferir na tela a 360 px que o parágrafo, agora com três frases, continua legível." | Validador, junto com a anterior |
| test-engineer (2ª), conformidade-reviewer (2ª) | "Nenhum teste prova a frase nova do `DESLIGAR_PROFESSOR` … Vale uma asserção em `importar-professores.test.ts`, no caso "a marca de desligar diz professor…", algo como `expect(grupo?.explicacao).toMatch(/comparação com a planilha/)`." (conformidade: "…`/não do uso nem do desempenho/)`") | `TODO.md`: ninguém reprovou na rodada, e aplicar caducaria os sete revisores só para guardar uma frase. A frase vem da D64 (regra 70, item 9); o teste fica para a próxima tarefa que toque `importar-professores.test.ts` |
| infra-guardian (2ª) | "As asserções de que o erro e o aviso sumiram usam o nome com a contagem antiga (`'Linhas com erro (2)'`, `'Linhas com aviso (1)'`). Se ainda sobrasse uma região com outra contagem, o teste passaria assim mesmo. Sugiro trocar por `{ name: /^Linhas com erro/ }` e `{ name: /^Linhas com aviso/ }` com `toHaveCount(0)`." | `TODO.md`: o caso vê as duas regiões com a contagem certa (2 e 1) logo antes, na mesma prévia; o risco é só de uma região de outra contagem aparecer depois, e nenhum revisor reprovou |


## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-06 01:55:57 | 2026-11-06 01:56:26 | `frontend-reviewer` | 1 | APROVADO | ade2170c11e1f7f58 |
| 2026-11-06 01:56:12 | 2026-11-06 01:56:33 | `tenancy-guardian` | 1 | APROVADO | a1eb991351a62a07a |
| 2026-11-06 01:56:23 | 2026-11-06 01:56:47 | `infra-guardian` | 1 | APROVADO | a1014dded71b6bc43 |
| 2026-11-06 01:56:20 | 2026-11-06 01:56:55 | `conformidade-reviewer` | 1 | APROVADO | a9f74696e25b21fa6 |
| 2026-11-06 01:56:16 | 2026-11-06 01:57:07 | `privacy-guardian` | 1 | APROVADO | a8abd33c9e0210093 |
| 2026-11-06 01:56:05 | 2026-11-06 01:57:29 | `revisor-geral` | 1 | APROVADO | a8ba014914fbca985 |
| 2026-11-06 01:56:01 | 2026-11-06 01:57:57 | `test-engineer` | 1 | APROVADO | a089cfacc0bda1b8f |
| 2026-11-06 02:08:24 | 2026-11-06 02:08:43 | `frontend-reviewer` | 2 | APROVADO | a2163604dcfc093e8 |
| 2026-11-06 02:08:39 | 2026-11-06 02:09:02 | `revisor-geral` | 2 | APROVADO | acd6194f37b6de45e |
| 2026-11-06 02:08:50 | 2026-11-06 02:09:12 | `tenancy-guardian` | 2 | APROVADO | a789b1c7fc889dd34 |
| 2026-11-06 02:08:32 | 2026-11-06 02:09:13 | `test-engineer` | 2 | APROVADO | a4f35e82c74c3680c |
| 2026-11-06 02:09:12 | 2026-11-06 02:09:27 | `infra-guardian` | 2 | APROVADO | a266b25ca43bb83a6 |
| 2026-11-06 02:08:57 | 2026-11-06 02:09:28 | `privacy-guardian` | 2 | APROVADO | a7774d3b1d5f13eaf |
| 2026-11-06 02:09:05 | 2026-11-06 02:09:36 | `conformidade-reviewer` | 2 | APROVADO | a08fa3a8315d36734 |
