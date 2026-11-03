# Tarefa 13.0 — A coordenação sobe a planilha de alunos com prévia, na aba Turmas

**Funcionalidade:** onboarding-por-convite · **Depende de:** 10.0
**Subagentes obrigatórios:** `privacy-guardian`, `frontend-reviewer`
**Porte:** grande

## Objetivo

Na aba Turmas de Escola, a coordenação escolhe o CSV ou o XLSX da escola inteira, vê a prévia (erros, avisos e marcas
primeiro, o resto em contagem), marca transferências e desligamentos, grava e acompanha até o fim. O componente
`ImportarPlanilha` nasce aqui, e a lista da turma da A1 passa a usá-lo.

## Contexto necessário

- `techspec.md` §9 (o componente, a prévia, os estados), §7 (a prévia fora do armazenamento do navegador), §1 (o navegador
  lê o arquivo e manda texto)
- `prd.md` RF2, RF3, RF4, RF15
- `cenarios.md` RF2 ([U] do leitor e do XLSX), E2E (prévia carregando e falha; 360 px)
- `docs/interface.md` §3 (Escola, Estrutura) e 10.4 (o XLSX carrega sob demanda, fora do pedaço da entrada)
- Código: `apps/web/src/areas/coordenacao/estrutura/ler-arquivo-da-lista.ts`, `previa-da-lista.ts`, `ListaDaTurma.tsx`,
  `Estrutura.tsx`, `api/lista.ts`

## Subtarefas

- [ ] 13.1 — Leitor no navegador: CSV (`;`, tab, UTF-16, BOM, windows-1252) e a primeira aba do XLSX (`read-excel-file`, sob demanda), devolvendo texto
- [ ] 13.2 — `ImportarPlanilha`: prévia paginada de 100, marcas rotuladas com nome e matrícula, código de erro em frase com o que fazer, vazio com "Baixar modelo", falha com "Tentar de novo", gravar uma vez, acompanhar por `GET /v1/importacoes/:id`
- [ ] 13.3 — Na aba Turmas, "Importar alunos"; `ListaDaTurma` passa a usar o componente, com o contrato novo
- [ ] 13.4 — `docs/interface.md` §3 (Estrutura); busca pelos nomes antigos que saírem de `apps/web/src` e `e2e/`
- [ ] 13.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx`, `ler-planilha.ts`, `previa-da-planilha.ts`, `api/importacao.ts` | novo |
| `apps/web/src/areas/coordenacao/estrutura/Estrutura.tsx`, `ListaDaTurma.tsx`, `ler-arquivo-da-lista.ts`, `previa-da-lista.ts`, `api/lista.ts` | alterado |
| `apps/web/package.json` (`read-excel-file`) | alterado |
| `e2e/importar-alunos.spec.ts`, `e2e/lista-da-turma.spec.ts` | novo; alterado |
| `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| Escolher o CSV, ver a prévia, gravar, e a tela diz quando terminou | e2e | caminho feliz (RF15) | |
| O leitor aceita `;` e tab | unidade | RF2 | |
| O leitor aceita UTF-16, BOM e windows-1252 | unidade | RF2 | |
| XLSX real: `00123` em célula de texto chega `00123`; em célula numérica, `123`, escrito no teste | unidade | biblioteca real | |
| O XLSX carrega sob demanda, fora do pedaço da entrada | e2e | `interface.md` 10.4 | |
| Erros, avisos e marcas primeiro; o resto em contagem paginada de 100 | e2e | §9 | |
| A marca é rotulada com nome e matrícula | e2e | §9 | |
| O código de erro vira frase com o que fazer | unidade | §9 | |
| Com erro na prévia, não há como gravar | e2e | RF2 | |
| Carregando visível | e2e | estados | |
| Falha com "Tentar de novo" | e2e | estados | |
| Vazio com "Baixar modelo" | e2e | estados | |
| Com dado, e o foco no resultado | e2e | estados | |
| A prévia não fica no armazenamento do navegador | e2e | §7 | |
| A lista da turma usa o `ImportarPlanilha` e grava com 202 | e2e | | |
| Clique duplo em gravar: um POST | e2e | | |
| Recomeço: a segunda coordenação na mesma aba não vê a prévia anterior | e2e | | |
| Recomeço: o mesmo arquivo escolhido de novo gera prévia nova | e2e | | |
| Recomeço: a resposta atrasada da prévia anterior (`page.route`) é ignorada | e2e | | |
| Recomeço: falha com a prévia aberta tira o aviso e o foco da tentativa anterior | e2e | | |
| A prévia com erro, a 360 px, sem rolagem horizontal | e2e | | |
| Cabe em 1366 × 768 sem a página rolar (`paginaNaoRola`) | e2e | | |
| Alvo de 44 px nas ações principais e de 24 px no resto | e2e | | |
| axe sem violação | e2e | | |
| Uma ação cheia por tela | e2e | | |

## Como testar

- E2E: `e2e/lista-da-turma.spec.ts › o arquivo do Excel em windows-1252 e o UTF-8 com BOM e vírgula: a prévia com os nomes certos, erros primeiro e em texto; gravar só sem erro, uma vez só`; entrada: `entrarComoCoordenacaoNaMesmaAba` (`e2e/support/casca.ts`); `paginaNaoRola` (`e2e/support/coordenacao.ts`)
- Unidade: `apps/web/src/areas/coordenacao/estrutura/previa-da-lista.test.ts › a coluna que parece CPF ou data segura a gravação; a matrícula de verdade, não`; estados: `ListaDaTurma.test.tsx › os estados da lista de nomes › o erro da leitura da lista tem "Tentar de novo" na seção dela, …`
- Comando: `node tools/ci/e2e.ts --manter-ambiente e2e/importar-alunos.spec.ts`
- **Telas:** `coordenacao`, `/coordenacao/estrutura`, `text=Turmas` → "Importar alunos" → arquivo → prévia com erro, com marcas, gravando, concluída; sem mockup (o `docs/interface.md` manda)

## Autoconferência

As 12 perguntas do modelo, no plano. Na 2, procure em `e2e/` os textos da lista da A1 que mudam.

## Fora do escopo desta tarefa

Grade e calendário (14.0); professores (15.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
