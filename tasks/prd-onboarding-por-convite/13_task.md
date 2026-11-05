# Tarefa 13.0 — A coordenação sobe a planilha de alunos com prévia, na aba Turmas

**Funcionalidade:** onboarding-por-convite · **Depende de:** 10.0
**Subagentes obrigatórios:** `privacy-guardian`, `frontend-reviewer`, `tenancy-guardian` e `conformidade-reviewer` (pedidos no `TODO.md`)
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

- [x] 13.1 — Leitor no navegador: CSV (`;`, tab, UTF-16, BOM, windows-1252) e a primeira aba do XLSX (`read-excel-file`, sob demanda), devolvendo texto
- [x] 13.2 — `ImportarPlanilha`: prévia paginada de 100, marcas rotuladas com nome e matrícula, código de erro em frase com o que fazer, vazio com "Baixar modelo", falha com "Tentar de novo", gravar uma vez, acompanhar por `GET /v1/importacoes/:id`
- [x] 13.3 — Na aba Turmas, "Importar alunos"; `ListaDaTurma` passa a usar o componente, com o contrato novo; apagar `ponte-da-lista.ts`, `api/lista.test.ts` e, em `api/lista.ts`, `previaDaListaResponseSchema`, `gravacaoDaListaResponseSchema` e `PreviaDaListaResponse`
- [x] 13.4 — `docs/interface.md` §3 (Estrutura); busca pelos nomes antigos que saírem de `apps/web/src` e `e2e/`
- [x] 13.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx`, `ler-planilha.ts`, `previa-da-planilha.ts`, `api/importacao.ts` | novo |
| `apps/web/src/areas/coordenacao/estrutura/Estrutura.tsx`, `ListaDaTurma.tsx`, `ler-arquivo-da-lista.ts`, `previa-da-lista.ts`, `api/lista.ts` | alterado |
| `apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts`, `api/lista.test.ts` | apagado (o leitor copiado da API não sobrevive à tela nova) |
| `tasks/prd-onboarding-por-convite/techspec.md` §4, `cenarios.md` ("Limites"), `16_task.md` | alterado pelo Arquiteto, vai no commit desta tarefa |
| `apps/web/package.json` (`read-excel-file`) | alterado |
| `e2e/importar-alunos.spec.ts`, `e2e/lista-da-turma.spec.ts` | novo; alterado |
| `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| Escolher o CSV, ver a prévia, gravar, e a tela diz quando terminou | e2e | caminho feliz (RF15) | e2e/importar-alunos.spec.ts › o caminho feliz: o vazio com "Baixar modelo", o carregando, a prévia com o foco, gravar uma vez só, o resultado com o foco e nada no armazenamento do navegador |
| O leitor aceita `;` e tab | unidade | RF2 | apps/web/src/areas/coordenacao/importacao/ler-planilha.test.ts › o CSV com ";", o com tabulação e o com BOM vêm do leitor de texto e passam pelos mesmos tetos |
| O leitor aceita UTF-16, BOM e windows-1252 | unidade | RF2 | apps/web/src/areas/coordenacao/estrutura/ler-arquivo-da-lista.test.ts › o "Texto Unicode" do Excel, em UTF-16 com BOM e tabulação, sai com os nomes certos e sem o BOM, nas duas ordens de byte; e2e/lista-da-turma.spec.ts › o arquivo do Excel em windows-1252 e o UTF-8 com BOM e vírgula: a prévia com os nomes certos, erros primeiro e em texto; gravar só sem erro, uma vez só |
| XLSX real: `00123` em célula de texto chega `00123`; em célula numérica, `123`, escrito no teste | unidade | biblioteca real | apps/web/src/areas/coordenacao/importacao/ler-planilha.test.ts › o XLSX de verdade (pela biblioteca) vira linhas com ";" e a matrícula em texto mantém o zero à esquerda; apps/web/src/areas/coordenacao/importacao/ler-planilha.test.ts › a matrícula que o Excel guardou como número sai como o número que a pessoa vê, sem notação científica |
| O XLSX carrega sob demanda, fora do pedaço da entrada | e2e | `interface.md` 10.4 | e2e/importar-alunos.spec.ts › o XLSX só é carregado quando alguém escolhe um, fora do pedaço da entrada; a primeira aba vira a prévia |
| Erros, avisos e marcas primeiro; o resto em contagem paginada de 100 | e2e | §9 | e2e/importar-alunos.spec.ts › com erro, a prévia lista os erros em frase e de cem em cem, o resto fica em contagem, não há como gravar, e a 360 px nada rola de lado |
| A marca é rotulada com nome e matrícula | e2e | §9 | e2e/importar-alunos.spec.ts › transferir e desligar chegam desmarcados, com "marcar todos" desmarcado e nome e matrícula só na marca; gravar sem marca não muda ninguém; a tela cabe, tem alvos e uma ação cheia |
| O código de erro vira frase com o que fazer | unidade | §9 | apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › cada erro de linha tem uma frase própria que diz o que fazer, e o código desconhecido não some em branco |
| Com erro na prévia, não há como gravar | e2e | RF2 | e2e/importar-alunos.spec.ts › com erro, a prévia lista os erros em frase e de cem em cem, o resto fica em contagem, não há como gravar, e a 360 px nada rola de lado |
| Carregando visível | e2e | estados | e2e/importar-alunos.spec.ts › o caminho feliz: o vazio com "Baixar modelo", o carregando, a prévia com o foco, gravar uma vez só, o resultado com o foco e nada no armazenamento do navegador |
| Falha com "Tentar de novo" | e2e | estados | e2e/importar-alunos.spec.ts › a prévia que falha diz o que fazer, com "Tentar de novo"; o arquivo novo tira o aviso e o foco do anterior |
| Vazio com "Baixar modelo" | e2e | estados | e2e/importar-alunos.spec.ts › o caminho feliz: o vazio com "Baixar modelo", o carregando, a prévia com o foco, gravar uma vez só, o resultado com o foco e nada no armazenamento do navegador |
| Com dado, e o foco no resultado | e2e | estados | e2e/importar-alunos.spec.ts › o caminho feliz: o vazio com "Baixar modelo", o carregando, a prévia com o foco, gravar uma vez só, o resultado com o foco e nada no armazenamento do navegador |
| A prévia não fica no armazenamento do navegador | e2e | §7 | e2e/importar-alunos.spec.ts › o caminho feliz: o vazio com "Baixar modelo", o carregando, a prévia com o foco, gravar uma vez só, o resultado com o foco e nada no armazenamento do navegador |
| A lista da turma usa o `ImportarPlanilha` e grava com 202 | e2e | | e2e/lista-da-turma.spec.ts › o arquivo do Excel em windows-1252 e o UTF-8 com BOM e vírgula: a prévia com os nomes certos, erros primeiro e em texto; gravar só sem erro, uma vez só |
| Clique duplo em gravar: um POST | e2e | | e2e/importar-alunos.spec.ts › o caminho feliz: o vazio com "Baixar modelo", o carregando, a prévia com o foco, gravar uma vez só, o resultado com o foco e nada no armazenamento do navegador (e `e2e/lista-da-turma.spec.ts`, mesmo caso do `dblclick`) |
| Recomeço: a segunda coordenação na mesma aba não vê a prévia anterior | e2e | | e2e/importar-alunos.spec.ts › a prévia e o nome do arquivo da coordenação anterior não aparecem para a que entra depois, sem recarregar a página |
| Recomeço: o mesmo arquivo escolhido de novo gera prévia nova | e2e | | e2e/importar-alunos.spec.ts › a resposta atrasada da prévia anterior não aparece no lugar da nova; o mesmo arquivo escolhido de novo pede uma prévia nova |
| Recomeço: a resposta atrasada da prévia anterior (`page.route`) é ignorada | e2e | | e2e/importar-alunos.spec.ts › a resposta atrasada da prévia anterior não aparece no lugar da nova; o mesmo arquivo escolhido de novo pede uma prévia nova |
| Recomeço: falha com a prévia aberta tira o aviso e o foco da tentativa anterior | e2e | | e2e/importar-alunos.spec.ts › a prévia que falha diz o que fazer, com "Tentar de novo"; o arquivo novo tira o aviso e o foco do anterior |
| A prévia com erro, a 360 px, sem rolagem horizontal | e2e | | e2e/importar-alunos.spec.ts › com erro, a prévia lista os erros em frase e de cem em cem, o resto fica em contagem, não há como gravar, e a 360 px nada rola de lado |
| Cabe em 1366 × 768 sem a página rolar (`paginaNaoRola`) | e2e | | e2e/importar-alunos.spec.ts › transferir e desligar chegam desmarcados, com "marcar todos" desmarcado e nome e matrícula só na marca; gravar sem marca não muda ninguém; a tela cabe, tem alvos e uma ação cheia |
| Alvo de 44 px nas ações principais e de 24 px no resto | e2e | | e2e/importar-alunos.spec.ts › transferir e desligar chegam desmarcados, com "marcar todos" desmarcado e nome e matrícula só na marca; gravar sem marca não muda ninguém; a tela cabe, tem alvos e uma ação cheia |
| axe sem violação | e2e | | e2e/importar-alunos.spec.ts › transferir e desligar chegam desmarcados, com "marcar todos" desmarcado e nome e matrícula só na marca; gravar sem marca não muda ninguém; a tela cabe, tem alvos e uma ação cheia |
| Uma ação cheia por tela | e2e | | e2e/importar-alunos.spec.ts › transferir e desligar chegam desmarcados, com "marcar todos" desmarcado e nome e matrícula só na marca; gravar sem marca não muda ninguém; a tela cabe, tem alvos e uma ação cheia |
| As 3.000 linhas do teto, por arquivo, no `chromebook`: prévia e gravação terminam abaixo da metade do prazo do caso | e2e | teto da planilha | e2e/importar-alunos.spec.ts › as 3.000 linhas do teto: a prévia e a gravação terminam abaixo da metade do prazo |
| Candidatos a transferir, desligar e voltar chegam desmarcados, sem "marcar todos" marcado; gravar sem marca não muda ninguém | e2e | regra 70 | e2e/importar-alunos.spec.ts › transferir e desligar chegam desmarcados, com "marcar todos" desmarcado e nome e matrícula só na marca; gravar sem marca não muda ninguém; a tela cabe, tem alvos e uma ação cheia |
| O texto das marcas diz que é conferência a partir da planilha e escolha da coordenação, não resultado automático | unidade | regra 70 | apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › o texto diz que a lista é uma conferência, e que cada pessoa só muda se a coordenação marcar |
| `nome_corrigido` e `muda_de_turma` em frase; a lista com um acento corrigido grava | unidade | a ponte recusava | apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › os erros e os avisos vêm primeiro e na ordem da planilha; o resto vira contagem, com o nome corrigido e a mudança de turma ditos por extenso; apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › só grava com algo novo: o nome corrigido e o aluno que volta gravam; "já existe" sozinho não, a não ser com marca |
| A fila que passa de 60 s: a tela mostra o estado da importação e não desiste | unidade | prazo do job (300 s) | apps/web/src/areas/coordenacao/importacao/api/importacao.test.ts › a fila lenta avisa uma vez depois de 60 s e NÃO desiste: a importação que conclui aos 200 s é concluída, e não "falhou" |
| O 429 na leitura: a próxima espera é o `Retry-After` ou mais; sair da tela aborta a leitura | unidade | regra 80 | apps/web/src/areas/coordenacao/importacao/api/importacao.test.ts › o 429 de uma leitura vale como "ainda na fila" e a próxima espera é o Retry-After ou mais, nunca menos; apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.fila.test.tsx › sair da tela cancela a leitura: depois de desmontar, nenhuma leitura nova da importação sai |
| `CONFLITO` do POST ("outra importação da escola está na fila") e `desatualizada` ("a lista mudou desde a prévia") em textos diferentes; ao concluir, quantas entraram e quantas ficaram de fora | unidade | | apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › a conclusão conta quantas entraram, e as linhas que ficaram de fora, cada uma com o seu porquê; apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › "outra importação em andamento" e "a escola mudou desde a prévia" são textos diferentes, e só o segundo tira a prévia |

## Como testar

- E2E: `e2e/lista-da-turma.spec.ts › o arquivo do Excel em windows-1252 e o UTF-8 com BOM e vírgula: a prévia com os nomes certos, erros primeiro e em texto; gravar só sem erro, uma vez só`; entrada: `entrarComoCoordenacaoNaMesmaAba` (`e2e/support/casca.ts`); `paginaNaoRola` (`e2e/support/coordenacao.ts`)
- Unidade: `apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › a coluna que parece CPF ou data segura a gravação com o motivo dela; a matrícula de verdade, não`; estados: `ListaDaTurma.test.tsx › os estados da lista de nomes › o erro da leitura da lista tem "Tentar de novo" na seção dela, …`
- Comando: `node tools/ci/e2e.ts --manter-ambiente e2e/importar-alunos.spec.ts`
- O teto: o arquivo de 3.000 linhas gerado no teste, por `setInputFiles` com `buffer`, como `e2e/lista-da-turma.spec.ts › a lista paginada, …` (o arquivo acima de 512 KB); a API já tem a prova em `apps/api/test/importacao.int.test.ts › 3.000 linhas entram; …`. Pelo arquivo, nunca colando no campo (27 s)
- O polling: `authedGet` aceita sinal (`apps/web/src/api/sessao.ts`); `ApiError.esperaSegundos` é o `Retry-After` (`apps/web/src/api/client.ts`)
- **Telas:** `coordenacao`, `/coordenacao/estrutura`, `text=Turmas` → "Importar alunos" → arquivo → prévia com erro, com marcas, gravando, concluída; sem mockup (o `docs/interface.md` manda)

## Autoconferência

As 12 perguntas do modelo, no plano. Na 2, procure em `e2e/` os textos da lista da A1 que mudam.

## O que o TODO.md guardou para esta tarefa

Seções "Da tarefa 8.0", "Da correção `e2e-contrato-da-lista-8`" e "Da tarefa 10.0". Marque as linhas lá ao fechar.

- `ListaDaTurma.tsx` diz 200 nomes em três textos ("Até 200 nomes por vez", o erro `linhas` e o da leitura): o teto é 3.000 linhas
- Os casos de `e2e/lista-da-turma.spec.ts` que a tarefa reescreve ficam abaixo da metade do prazo no `celular`: "a lista paginada…" (43 s) e "o erro da leitura da lista com 'Tentar de novo'…" (56 a 60 s)
- Revisão: o `rotulo` de candidato só aparece na marca, nunca na contagem do resto, e `candidatos` e `rotulo` vêm só da escola da sessão

## Fora do escopo desta tarefa

Grade e calendário (14.0); professores (15.0).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| As duas rotas da lista da turma têm o limite de 20/min por usuário de `/v1/importacoes` e ocupam as vagas da escola (Arquiteto, triagem antes da 13.0) | a spec não dizia; já implementado e provado em `lista.int.test.ts` (8.0) | `techspec.md` §4; `cenarios.md`, "Limites" |
| `previa-da-lista.ts` e `previa-da-lista.test.ts` apagados, que o plano dava como "alterado" (Implementador) | nada mais os importa depois de `ListaDaTurma` passar ao `ImportarPlanilha`; a prévia e os textos vivem em `importacao/previa-da-planilha.ts`, com o teste dela | `techspec.md` §4 (`/lista/previa` e `/lista` "ficam, com o contrato da importação") e §9 (`ImportarPlanilha`, a peça das telas de planilha; a §9 não nomeia a lista da turma entre elas) |

## Mutações

--faltando: 6 linhas (124 blocos, 6 motivos)

**Sem bloco (motivo):** (1) `ImportarPlanilha.tsx`, `useFocoNaResposta`: `if (alvo === null) return`. O pedido de foco só é feito depois de `mudar(...)` e o alvo entra no mesmo render que o efeito lê; o `null` é o caso de o pedido ser atendido antes de o título existir, que a ordem de `mudar` e `pedir` não deixa acontecer, e o efeito sem lista de dependências tenta de novo no render seguinte. Tirada a linha, os 20 casos do componente seguem verdes (testada à mão); fica como defesa de ref ainda não montada. (2) `useArquivoEPrevia`: `numero !== contador.current` no `onSuccess` da prévia e `numero === contador.current && !daPrevia.signal.aborted` no `onError`. O TanStack Query descarta o callback do `mutate()` que não é o último (o arquivo novo chama `mutate` de novo e `pedido.reset()`), então a resposta ou a falha da prévia antiga nunca chega a esses dois lugares: com a guarda tirada (testado, as duas) os casos "a resposta da prévia do arquivo antigo" e "a falha da prévia do arquivo antigo" seguem verdes, e o que os prova é o conjunto. As guardas ficam como dupla defesa, para a tela não depender do detalhe da biblioteca; a de depois da leitura do arquivo (`const lida = await lerPlanilha`) **tem** bloco, porque ali não há `mutate` ainda. (3) `falhaDaPreviaDe`: `pedido.variables?.numero === escolha?.numero` é a mesma coisa que o `pedido.reset()` de `recomecar`: depois de um arquivo novo o `isError` do anterior já saiu. (4) `PreviaDaEscolha`: `escolha?.texto === undefined` e, em `ImportarPlanilha`, o `escolha?.texto === undefined` de `tentarDeNovo`: a prévia só existe depois de o texto ter sido lido, então a parte nunca muda o resultado; ela está ali para o compilador estreitar `texto` para `string`. (5) `ListaDeLinhas`: `tom === 'erro' ? … : …` só escolhe a classe de cor; o tipo da linha já está no título ("Linhas com erro" e "Linhas com aviso") e na frase. (6) `ler-planilha.ts`: o `?? 0` de `colunas` só vale para a aba toda em branco, e então `aproveitadas` é vazia e a largura não é usada. `previa-da-planilha.ts`, `alternarTodos`: `doGrupo.length > 0 &&` devolve `Set` vazio nos dois jeitos para o grupo sem candidato. Os testes de apoio (`__fixtures__/xlsx.ts`, que monta o XLSX de verdade para o teste do leitor) não são código de produto e ficam fora do `--faltando`.

A prévia, o leitor e o acompanhamento (lógica pura):

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › cada erro de linha tem uma frase própria
-export const textoDoErro = (codigo: string | undefined): string => (codigo === undefined ? undefined : TEXTO_DO_ERRO_DA_LINHA[codigo]) ?? TEXTO_DO_ERRO_DESCONHECIDO
+export const textoDoErro = (codigo: string | undefined): string => (codigo === undefined ? undefined : TEXTO_DO_ERRO_DA_LINHA[codigo]) as string
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › os erros e os avisos vêm primeiro
-for (const { resultado } of linhas) contagem[resultado] = (contagem[resultado] ?? 0) + 1
+for (const { resultado } of linhas) contagem[resultado] = (contagem[resultado] as number) + 1
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › os erros e os avisos vêm primeiro
-const quantas = contagem[resultado] ?? 0
+const quantas = contagem[resultado] as number
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › os erros e os avisos vêm primeiro
-return quantas === 0 ? [] : [formatQuantity(quantas, `linha ${FRASE_DO_RESULTADO[resultado][0]}`, `linhas ${FRASE_DO_RESULTADO[resultado][1]}`)]
+return false ? [] : [formatQuantity(quantas, `linha ${FRASE_DO_RESULTADO[resultado][0]}`, `linhas ${FRASE_DO_RESULTADO[resultado][1]}`)]
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › os erros e os avisos vêm primeiro
-avisos: linhas.filter((linha) => linha.resultado !== 'erro' && linha.aviso !== undefined).sort(pelaLinha),
+avisos: linhas.filter((linha) => linha.resultado !== 'erro').sort(pelaLinha),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › marcar um é só dele
-if (doGrupo.has(id)) doGrupo.delete(id)
+if (false) doGrupo.delete(id)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › "marcar todos" marca só os candidatos da ação
-return { ...escolhidas, [acao]: todos ? new Set<string>() : new Set(doGrupo.map(({ id }) => id)) }
+return { ...escolhidas, [acao]: false ? new Set<string>() : new Set(doGrupo.map(({ id }) => id)) }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › com erro, não
-if (erros.length > 0) return { pode: false, motivo: erros.every((linha) => linha.erro === 'matricula_parece_documento') ? MOTIVO_DO_DOCUMENTO : MOTIVO_DO_ERRO_NA_PLANILHA }
+if (false) return { pode: false, motivo: erros.every((linha) => linha.erro === 'matricula_parece_documento') ? MOTIVO_DO_DOCUMENTO : MOTIVO_DO_ERRO_NA_PLANILHA }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › a coluna que parece CPF ou data segura a gravação
-if (erros.length > 0) return { pode: false, motivo: erros.every((linha) => linha.erro === 'matricula_parece_documento') ? MOTIVO_DO_DOCUMENTO : MOTIVO_DO_ERRO_NA_PLANILHA }
+if (erros.length > 0) return { pode: false, motivo: MOTIVO_DO_ERRO_NA_PLANILHA }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › só grava com algo novo
-const grava = previa.linhas.some((linha) => linha.resultado === 'entra' || linha.resultado === 'nome_corrigido' || linha.resultado === 'volta' || linha.resultado === 'novo')
+const grava = previa.linhas.some((linha) => linha.resultado === 'entra' || linha.resultado === 'nome_corrigido' || linha.resultado === 'novo')
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › só grava com algo novo
-const grava = previa.linhas.some((linha) => linha.resultado === 'entra' || linha.resultado === 'nome_corrigido' || linha.resultado === 'volta' || linha.resultado === 'novo')
+const grava = previa.linhas.some((linha) => linha.resultado === 'entra' || linha.resultado === 'volta' || linha.resultado === 'novo')
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › só grava com algo novo
-if (!grava && marcas === 0) return { pode: false, motivo: MOTIVO_DE_NADA_NOVO }
+if (!grava) return { pode: false, motivo: MOTIVO_DE_NADA_NOVO }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › a conclusão conta quantas entraram
-const n = (chave: keyof ResumoDaImportacao): number => resumo?.[chave] ?? 0
+const n = (chave: keyof ResumoDaImportacao): number => resumo?.[chave] as number
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › a conclusão conta quantas entraram
-const partes = contagens.flatMap(([quantos, um, varios], posicao) => (posicao === 0 || quantos > 0 ? [`${formatQuantity(quantos, um, varios)}.`] : []))
+const partes = contagens.flatMap(([quantos, um, varios], posicao) => (quantos > 0 ? [`${formatQuantity(quantos, um, varios)}.`] : []))
```




```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › "outra importação em andamento"
-if (erro instanceof ImportacaoNaoConcluidaError) return erro.estado === 'desatualizada' ? TEXTO_DA_IMPORTACAO_DESATUALIZADA : TEXTO_DA_IMPORTACAO_QUE_FALHOU[erro.erro ?? 'erro_interno']
+if (erro instanceof ImportacaoNaoConcluidaError) return erro.estado !== 'desatualizada' ? TEXTO_DA_IMPORTACAO_DESATUALIZADA : TEXTO_DA_IMPORTACAO_QUE_FALHOU[erro.erro ?? 'erro_interno']
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › a importação que falhou diz a causa
-if (erro instanceof ImportacaoNaoConcluidaError) return erro.estado === 'desatualizada' ? TEXTO_DA_IMPORTACAO_DESATUALIZADA : TEXTO_DA_IMPORTACAO_QUE_FALHOU[erro.erro ?? 'erro_interno']
+if (erro instanceof ImportacaoNaoConcluidaError) return erro.estado === 'desatualizada' ? TEXTO_DA_IMPORTACAO_DESATUALIZADA : TEXTO_DA_IMPORTACAO_QUE_FALHOU[erro.erro as ErroDaImportacao]
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › "outra importação em andamento"
 export function previaEnvelheceu(erro: unknown): boolean {
-if (erro instanceof ImportacaoNaoConcluidaError) return erro.estado === 'desatualizada'
+if (erro instanceof ImportacaoNaoConcluidaError) return true
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › "outra importação em andamento"
-return erro instanceof ApiError && (erro.codigo === ErrorCode.ENTRADA_INVALIDA || erro.codigo === ErrorCode.NAO_ENCONTRADO)
+return erro instanceof ApiError && (erro.codigo === ErrorCode.ENTRADA_INVALIDA)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › "outra importação em andamento"
-return erro instanceof ApiError && (erro.codigo === ErrorCode.ENTRADA_INVALIDA || erro.codigo === ErrorCode.NAO_ENCONTRADO)
+return erro instanceof ApiError && (erro.codigo === ErrorCode.NAO_ENCONTRADO)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ler-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/ler-planilha.test.ts › a data vira aaaa-mm-dd
-if (celula instanceof Date) return celula.toISOString().slice(0, 10)
+if (false) return celula.toISOString().slice(0, 10)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ler-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/ler-planilha.test.ts › o nome com ponto e vírgula ou aspas
-return /[;"]/.test(limpo) ? `"${limpo.replace(/"/g, '""')}"` : limpo
+return false ? `"${limpo.replace(/"/g, '""')}"` : limpo
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ler-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/ler-planilha.test.ts › o nome com ponto e vírgula ou aspas
-return /[;"]/.test(limpo) ? `"${limpo.replace(/"/g, '""')}"` : limpo
+return /[;"]/.test(limpo) ? `"${limpo}"` : limpo
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ler-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/ler-planilha.test.ts › quebra de linha e tabulação dentro da célula
-const limpo = texto.replace(/[\r\n\t]+/g, ' ')
+const limpo = texto
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ler-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/ler-planilha.test.ts › linha em branco no meio continua em branco
-return aproveitadas.map((linha) => (vazia(linha) ? '' : Array.from({ length: Math.max(colunas, linha.length) }, (_, posicao) => textoDaCelula(linha[posicao])).join(';'))).join('\n')
+return aproveitadas.map((linha) => (Array.from({ length: Math.max(colunas, linha.length) }, (_, posicao) => textoDaCelula(linha[posicao])).join(';'))).join('\n')
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ler-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/ler-planilha.test.ts › as do fim saem
-while (fim > 0 && vazia(linhas[fim - 1] ?? [])) fim -= 1
+while (false) fim -= 1
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ler-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/ler-planilha.test.ts › a linha curta é completada
-return aproveitadas.map((linha) => (vazia(linha) ? '' : Array.from({ length: Math.max(colunas, linha.length) }, (_, posicao) => textoDaCelula(linha[posicao])).join(';'))).join('\n')
+return aproveitadas.map((linha) => (vazia(linha) ? '' : Array.from({ length: linha.length }, (_, posicao) => textoDaCelula(linha[posicao])).join(';'))).join('\n')
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ler-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/ler-planilha.test.ts › o XLSX acima do teto
-if (arquivo.size > MAXIMO_DE_BYTES_DO_XLSX) return { ok: false, motivo: 'grande' }
+if (false) return { ok: false, motivo: 'grande' }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ler-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/ler-planilha.test.ts › as 3.000 linhas passam
-if (teto !== undefined) return { ok: false, motivo: teto === 'bytes' ? 'grande' : 'linhas' }
+if (teto !== undefined) return { ok: false, motivo: 'grande' }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ler-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/ler-planilha.test.ts › as 3.000 linhas passam
-if (teto !== undefined) return { ok: false, motivo: teto === 'bytes' ? 'grande' : 'linhas' }
+if (false) return { ok: false, motivo: teto === 'bytes' ? 'grande' : 'linhas' }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ler-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/ler-planilha.test.ts › o .xls antigo
-if (comecaCom(comeco, COMECO_DO_XLS)) return { ok: false, motivo: 'formato' }
+if (false) return { ok: false, motivo: 'formato' }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ler-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/ler-planilha.test.ts › o XLSX de verdade
-if (comecaCom(comeco, COMECO_DO_ZIP)) return await lerXlsx(arquivo)
+if (false) return await lerXlsx(arquivo)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ler-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/ler-planilha.test.ts › o CSV com ";"
-return csv.ok ? depoisDosTetos(csv.texto) : csv
+return csv
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/api/importacao.ts
teste: apps/web/src/areas/coordenacao/importacao/api/importacao.test.ts › a planilha da escola usa a rota por tipo
-return { previa: `/v1/importacoes/${tipo}/previa`, gravar: `/v1/importacoes/${tipo}` }
+return { previa: `/v1/importacoes/previa`, gravar: `/v1/importacoes/${tipo}` }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/api/importacao.ts
teste: apps/web/src/areas/coordenacao/importacao/api/importacao.test.ts › o sinal já abortado quando a leitura termina
-if (sinal?.aborted === true) {
+if (false) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/api/importacao.ts
teste: apps/web/src/areas/coordenacao/importacao/api/importacao.test.ts › o 429 de uma leitura vale como "ainda na fila"
-const ehEsperavel = (erro: unknown): erro is ApiError => erro instanceof ApiError && (erro.codigo === ErrorCode.LIMITE_EXCEDIDO || erro.codigo === ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
+const ehEsperavel = (erro: unknown): erro is ApiError => erro instanceof ApiError && (erro.codigo === ErrorCode.LIMITE_EXCEDIDO)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/api/importacao.ts
teste: apps/web/src/areas/coordenacao/importacao/api/importacao.test.ts › o 429 de uma leitura vale como "ainda na fila"
-const ehEsperavel = (erro: unknown): erro is ApiError => erro instanceof ApiError && (erro.codigo === ErrorCode.LIMITE_EXCEDIDO || erro.codigo === ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
+const ehEsperavel = (erro: unknown): erro is ApiError => erro instanceof ApiError && (erro.codigo === ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/api/importacao.ts
teste: apps/web/src/areas/coordenacao/importacao/api/importacao.test.ts › lê até concluir
-if (lida.estado === 'concluida') return { concluida: lida }
+if (false) return { concluida: lida }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/api/importacao.ts
teste: apps/web/src/areas/coordenacao/importacao/api/importacao.test.ts › "desatualizada" e "falhou"
-if (lida.estado !== 'na_fila') throw new ImportacaoNaoConcluidaError(lida.estado, lida.erro)
+if (false) throw new ImportacaoNaoConcluidaError(lida.estado, lida.erro)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/api/importacao.ts
teste: apps/web/src/areas/coordenacao/importacao/api/importacao.test.ts › outro erro de leitura
-if (!ehEsperavel(erro) || sinal?.aborted === true) throw erro
+if (sinal?.aborted === true) throw erro
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/api/importacao.ts
teste: apps/web/src/areas/coordenacao/importacao/api/importacao.test.ts › a leitura que cai com o 429 quando a tela já saiu
-if (!ehEsperavel(erro) || sinal?.aborted === true) throw erro
+if (!ehEsperavel(erro)) throw erro
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/api/importacao.ts
teste: apps/web/src/areas/coordenacao/importacao/api/importacao.test.ts › o 429 de uma leitura vale como "ainda na fila"
-return { esperaMinimaMs: Math.max(espera, (erro.esperaSegundos ?? 0) * 1000) }
+return { esperaMinimaMs: espera }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/api/importacao.ts
teste: apps/web/src/areas/coordenacao/importacao/api/importacao.test.ts › o 429 de uma leitura vale como "ainda na fila"
-return { esperaMinimaMs: Math.max(espera, (erro.esperaSegundos ?? 0) * 1000) }
+return { esperaMinimaMs: Math.max(espera, (erro.esperaSegundos as number) * 1000) }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/api/importacao.ts
teste: apps/web/src/areas/coordenacao/importacao/api/importacao.test.ts › lê até concluir
-if ('concluida' in leitura) return leitura.concluida
+if (false) return leitura.concluida
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/api/importacao.ts
teste: apps/web/src/areas/coordenacao/importacao/api/importacao.test.ts › a fila lenta avisa uma vez
-if (!avisou && agora() - comeco >= avisarDepoisDeMs) {
+if (agora() - comeco >= avisarDepoisDeMs) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/api/importacao.ts
teste: apps/web/src/areas/coordenacao/importacao/api/importacao.test.ts › a fila lenta avisa uma vez
-if (!avisou && agora() - comeco >= avisarDepoisDeMs) {
+if (!avisou && true) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › o aviso de uma linha que grava assim mesmo
-export const textoDoAviso = (codigo: string | undefined): string => (codigo === undefined ? undefined : TEXTO_DO_AVISO_DA_LINHA[codigo]) ?? TEXTO_DO_AVISO_DESCONHECIDO
+export const textoDoAviso = (codigo: string | undefined): string => (codigo === undefined ? undefined : TEXTO_DO_AVISO_DA_LINHA[codigo]) as string
```

O componente e as duas telas que o usam:

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › com erro: as linhas com erro em frase
-if (pedido === undefined) return
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › a escola que mudou desde a prévia
-mudar(previaEnvelheceu(erro) ? { demorando: false, previa: undefined } : { demorando: false })
+mudar(false ? { demorando: false, previa: undefined } : { demorando: false })
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › é outro texto, e a prévia continua valendo
-mudar(previaEnvelheceu(erro) ? { demorando: false, previa: undefined } : { demorando: false })
+mudar(true ? { demorando: false, previa: undefined } : { demorando: false })
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › fechar a janela de escolha sem arquivo
-if (arquivo === undefined) return
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › fechar a janela de escolha sem arquivo
 const lida = await lerPlanilha(arquivo)
-if (numero !== contador.current) return
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › a planilha grande demais ou ilegível
-if (!lida.ok) {
+if (false) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › a planilha grande demais ou ilegível
-if (recusa !== undefined) return TEXTO_DA_PLANILHA_RECUSADA[recusa]
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › a prévia que falha diz o que fazer
-if (falhaDaPrevia !== null) return textoDaFalhaDaPrevia(falhaDaPrevia, configuracao.textosDaFalhaDaPrevia)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › a prévia que falha diz o que fazer
-return falhaDaGravacao === null ? undefined : textoDaFalhaDaGravacao(falhaDaGravacao, configuracao.textosDaFalhaDoGravar)
+return textoDaFalhaDaGravacao(falhaDaGravacao, configuracao.textosDaFalhaDoGravar)
```




```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › o convite do começo, o carregando
-if (estaVazia(estado)) return <EmptyState titulo={configuracao.vazio.titulo} descricao={configuracao.vazio.descricao} />
+if (false) return <EmptyState titulo={configuracao.vazio.titulo} descricao={configuracao.vazio.descricao} />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › o convite do começo, o carregando
-if (!estaLendo(estado, previaNoAr)) return null
+if (false) return null
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › o convite do começo, o carregando
-return <LoadingState rotulo={estado.escolha?.texto === undefined ? 'Lendo a planilha…' : 'Conferindo a planilha com a escola…'} />
+return <LoadingState rotulo={'Lendo a planilha…'} />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › o convite do começo, o carregando
-if (previa === undefined || escolha?.texto === undefined) return null
+if (escolha?.texto === undefined) return null
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › a planilha grande demais ou ilegível
-const tentarDeNovo = falhaDaPrevia === null || escolha?.texto === undefined ? undefined : () => enviar(escolha.numero, escolha.texto ?? '')
+const tentarDeNovo = () => enviar(escolha.numero, escolha.texto ?? '')
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › com erro: as linhas com erro em frase
-lido={escolha?.texto === undefined ? undefined : escolha.nome}
+lido={undefined}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › a falha da prévia do arquivo antigo
-{alerta !== undefined && <AlertaDaPlanilha texto={alerta} alvo={foco.alerta} aoTentarDeNovo={tentarDeNovo} tentando={pedido.isPending} />}
+{<AlertaDaPlanilha texto={alerta} alvo={foco.alerta} aoTentarDeNovo={tentarDeNovo} tentando={pedido.isPending} />}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › o convite do começo, o carregando
-{estado.conclusao !== undefined && <ConclusaoDaPlanilha texto={estado.conclusao} tituloRef={foco.conclusao} />}
+{<ConclusaoDaPlanilha texto={estado.conclusao} tituloRef={foco.conclusao} />}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › o convite do começo, o carregando
-{lido !== undefined && `Arquivo lido: ${lido}.`}
+{`Arquivo lido: ${lido}.`}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › a planilha grande demais ou ilegível
-{aoTentarDeNovo !== undefined && (
+{(
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › escolher o mesmo arquivo de novo
-{erros.length > 0 && <ListaDeLinhas titulo="Linhas com erro" linhas={erros} textoDe={(linha) => textoDoErro(linha.erro)} tom="erro" />}
+{<ListaDeLinhas titulo="Linhas com erro" linhas={erros} textoDe={(linha) => textoDoErro(linha.erro)} tom="erro" />}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › o aviso, as turmas novas e o resto
-{avisos.length > 0 && <ListaDeLinhas titulo="Linhas com aviso" linhas={avisos} textoDe={(linha) => textoDoAviso(linha.aviso)} tom="aviso" />}
+{<ListaDeLinhas titulo="Linhas com aviso" linhas={avisos} textoDe={(linha) => textoDoAviso(linha.aviso)} tom="aviso" />}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › com erro: as linhas com erro em frase
-{previa.candidatos.length > 0 && <MarcasDaPrevia candidatos={previa.candidatos} marcas={marcas} aoMarcar={aoMarcar} aoMarcarTodos={aoMarcarTodos} />}
+{<MarcasDaPrevia candidatos={previa.candidatos} marcas={marcas} aoMarcar={aoMarcar} aoMarcarTodos={aoMarcarTodos} />}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › o aviso, as turmas novas e o resto
-<RestoDaPlanilha linhas={previa.linhas} turmasNovas={previa.contagens.turmas_novas ?? 0} />
+<RestoDaPlanilha linhas={previa.linhas} turmasNovas={previa.contagens.turmas_novas as number} />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › o aviso, as turmas novas e o resto
-if (resto.length === 0 && turmasNovas === 0) return null
+if (false) return null
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › o aviso, as turmas novas e o resto
-{resto.length > 0 && <p className="break-words text-apoio">{resto.join(' · ')}</p>}
+{<p className="break-words text-apoio">{resto.join(' · ')}</p>}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › o aviso, as turmas novas e o resto
-{turmasNovas > 0 && <p className="text-apoio">{formatQuantity(turmasNovas, 'turma nova será criada', 'turmas novas serão criadas')}.</p>}
+{<p className="text-apoio">{formatQuantity(turmasNovas, 'turma nova será criada', 'turmas novas serão criadas')}.</p>}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › com erro: as linhas com erro em frase
-if (!gravacao.pode) return <p className="break-words text-apoio">{gravacao.motivo}</p>
+if (false) return <p className="break-words text-apoio">{gravacao.motivo}</p>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › enquanto grava, o botão diz
-{gravando ? 'Gravando…' : rotulo}
+{rotulo}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › enquanto grava, o botão diz
-{gravando && 'Gravando a planilha. Pode levar alguns segundos.'}
+{'Gravando a planilha. Pode levar alguns segundos.'}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.fila.test.tsx › depois do prazo avisa
-{gravando && demorando && ' A fila está mais cheia que o normal: a gravação continua e você pode esperar aqui. Se sair desta tela, ela termina sozinha.'}
+{gravando && ' A fila está mais cheia que o normal: a gravação continua e você pode esperar aqui. Se sair desta tela, ela termina sozinha.'}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › os erros vêm de cem em cem
 </ol>
-{escondidos > 0 && (
+{(
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › as marcas de um grupo vêm de cem em cem
 </ul>
-{escondidos > 0 && (
+{(
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › chegam todas desmarcadas
-return doGrupo.length === 0 ? null : <GrupoDeMarca key={acao} acao={acao} candidatos={doGrupo} escolhidos={marcas[acao]} aoMarcar={aoMarcar} aoMarcarTodos={aoMarcarTodos} />
+return <GrupoDeMarca key={acao} acao={acao} candidatos={doGrupo} escolhidos={marcas[acao]} aoMarcar={aoMarcar} aoMarcarTodos={aoMarcarTodos} />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/Estrutura.tsx
teste: apps/web/src/areas/coordenacao/estrutura/Estrutura.test.tsx › sem ano em curso: o texto de hoje
 </button>
-{anoEmCurso !== undefined && (
+{(
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/Estrutura.tsx
teste: apps/web/src/areas/coordenacao/estrutura/Estrutura.test.tsx › sem ano em curso, o endereço do painel
-{painel === 'importar' && anoEmCurso !== undefined && (
+{painel === 'importar' && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/Estrutura.tsx
teste: apps/web/src/areas/coordenacao/estrutura/Estrutura.test.tsx › "Ano letivo e disciplinas" abre o painel no endereço
-{painel === 'importar' && anoEmCurso !== undefined && (
+{anoEmCurso !== undefined && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx
teste: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.test.tsx › gravar a lista leva o foco ao resultado
-rotas: { previa: `/v1/turmas/${encodeURIComponent(turmaId)}/lista/previa`, gravar: `/v1/turmas/${encodeURIComponent(turmaId)}/lista` },
+rotas: { previa: `/v1/turmas/${encodeURIComponent(turmaId)}/lista/previa-x`, gravar: `/v1/turmas/${encodeURIComponent(turmaId)}/lista` },
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx
teste: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.test.tsx › gravar a lista leva o foco ao resultado
-rotas: { previa: `/v1/turmas/${encodeURIComponent(turmaId)}/lista/previa`, gravar: `/v1/turmas/${encodeURIComponent(turmaId)}/lista` },
+rotas: { previa: `/v1/turmas/${encodeURIComponent(turmaId)}/lista/previa`, gravar: `/v1/turmas/${encodeURIComponent(turmaId)}/lista-x` },
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ler-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/ler-planilha.test.ts › a linha curta é completada
-if (typeof celula !== 'string' && typeof celula !== 'number' && typeof celula !== 'boolean') return ''
+if (false) return ''
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ler-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/ler-planilha.test.ts › linha em branco no meio continua em branco
-const vazia = (linha: Linha): boolean => linha.every((celula) => celula === null || celula === undefined || celula === '')
+const vazia = (linha: Linha): boolean => linha.every((celula) => celula === null || celula === undefined)
```

A ordem de correção da rodada 1 (`.processo/ordens/13_task-r1.md`): a conclusão que conta as linhas de fora e diz por quê, o resumo das marcas, o seletor em português, o controlador da gravação que nasce no efeito, o "sair da tela" e o texto da volta.

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › a conclusão conta quantas entraram
-partes.push(...(deForaDitas.length === 0 ? ['Nenhuma linha ficou de fora.'] : deForaDitas))
+partes.push(...(deForaDitas.length === 0 ? ['Nada ficou de fora.'] : deForaDitas))
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › a conclusão conta quantas entraram
-partes.push(...(deForaDitas.length === 0 ? ['Nenhuma linha ficou de fora.'] : deForaDitas))
+partes.push(...(deForaDitas.length >= 0 ? ['Nenhuma linha ficou de fora.'] : deForaDitas))
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › a conclusão conta quantas entraram
-[deFora.semMarca, 'o aluno aparece em outra turma e você não marcou a transferência.'],
+[0, 'o aluno aparece em outra turma e você não marcou a transferência.'],
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › a conclusão conta quantas entraram
-[deFora.mudaram, 'a escola mudou entre a prévia e o gravar (a matrícula passou a ser de outra turma ou de outro aluno). Veja a lista e envie a planilha de novo, se precisar.'],
+[0, 'a escola mudou entre a prévia e o gravar (a matrícula passou a ser de outra turma ou de outro aluno). Veja a lista e envie a planilha de novo, se precisar.'],
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › a conclusão conta quantas entraram
-const deForaDitas = deForaPorQue.flatMap(([quantas, porque]) => (quantas === 0 ? [] : [`${formatQuantity(quantas, 'linha ficou de fora', 'linhas ficaram de fora')}: ${porque}`]))
+const deForaDitas = deForaPorQue.flatMap(([quantas, porque]) => (quantas < 0 ? [] : [`${formatQuantity(quantas, 'linha ficou de fora', 'linhas ficaram de fora')}: ${porque}`]))
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › as linhas "em outra turma" que a coordenação não marcou
-semMarca: Math.max(0, naPrevia('muda_de_turma') - marcas.transferir.size),
+semMarca: Math.max(0, naPrevia('muda_de_turma')),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › as linhas "em outra turma" que a coordenação não marcou
-semMarca: Math.max(0, naPrevia('muda_de_turma') - marcas.transferir.size),
+semMarca: naPrevia('muda_de_turma') - marcas.transferir.size,
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › a linha que a prévia dava como gravada e o resumo não contou
-mudaram: Math.max(0, naPrevia('entra', 'volta', 'nome_corrigido') - noResumo('entram', 'voltam', 'nomes_corrigidos')),
+mudaram: Math.max(0, naPrevia('entra', 'nome_corrigido') - noResumo('entram', 'voltam', 'nomes_corrigidos')),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › a linha que a prévia dava como gravada e o resumo não contou
-mudaram: Math.max(0, naPrevia('entra', 'volta', 'nome_corrigido') - noResumo('entram', 'voltam', 'nomes_corrigidos')),
+mudaram: Math.max(0, naPrevia('entra', 'volta') - noResumo('entram', 'voltam', 'nomes_corrigidos')),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › a linha que a prévia dava como gravada e o resumo não contou
-mudaram: Math.max(0, naPrevia('entra', 'volta', 'nome_corrigido') - noResumo('entram', 'voltam', 'nomes_corrigidos')),
+mudaram: Math.max(0, naPrevia('volta', 'nome_corrigido') - noResumo('entram', 'voltam', 'nomes_corrigidos')),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › a linha que a prévia dava como gravada e o resumo não contou
-mudaram: Math.max(0, naPrevia('entra', 'volta', 'nome_corrigido') - noResumo('entram', 'voltam', 'nomes_corrigidos')),
+mudaram: Math.max(0, naPrevia('entra', 'volta', 'nome_corrigido') - noResumo('entram', 'nomes_corrigidos')),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › a linha que a prévia dava como gravada e o resumo não contou
-mudaram: Math.max(0, naPrevia('entra', 'volta', 'nome_corrigido') - noResumo('entram', 'voltam', 'nomes_corrigidos')),
+mudaram: Math.max(0, naPrevia('entra', 'volta', 'nome_corrigido') - noResumo('voltam', 'nomes_corrigidos')),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › a linha que a prévia dava como gravada e o resumo não contou
-mudaram: Math.max(0, naPrevia('entra', 'volta', 'nome_corrigido') - noResumo('entram', 'voltam', 'nomes_corrigidos')),
+mudaram: Math.max(0, naPrevia('entra', 'volta', 'nome_corrigido') - noResumo('entram', 'voltam')),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › a linha que a prévia dava como gravada e o resumo não contou
-mudaram: Math.max(0, naPrevia('entra', 'volta', 'nome_corrigido') - noResumo('entram', 'voltam', 'nomes_corrigidos')),
+mudaram: naPrevia('entra', 'volta', 'nome_corrigido') - noResumo('entram', 'voltam', 'nomes_corrigidos'),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › a linha que a prévia dava como gravada e o resumo não contou
-const naPrevia = (...resultados: ResultadoDaLinhaDaPlanilha[]): number => resultados.reduce((soma, resultado) => soma + (contagem[resultado] ?? 0), 0)
+const naPrevia = (...resultados: ResultadoDaLinhaDaPlanilha[]): number => resultados.reduce((soma, resultado) => soma + (contagem[resultado] ?? 1), 0)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › a linha que a prévia dava como gravada e o resumo não contou
-const noResumo = (...chaves: (keyof ResumoDaImportacao)[]): number => chaves.reduce((soma, chave) => soma + (resumo?.[chave] ?? 0), 0)
+const noResumo = (...chaves: (keyof ResumoDaImportacao)[]): number => chaves.reduce((soma, chave) => soma + (resumo?.[chave] ?? 1), 0)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › o resumo das marcas diz o que cada marca vai fazer
-const ditas = frases.flatMap(([quantos, um, varios]) => (quantos === 0 ? [] : [formatQuantity(quantos, um, varios)]))
+const ditas = frases.flatMap(([quantos, um, varios]) => (quantos < 0 ? [] : [formatQuantity(quantos, um, varios)]))
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › o resumo das marcas diz o que cada marca vai fazer
-return ditas.length === 0 ? undefined : `Ao gravar, com as suas marcas: ${ditas.join('; ')}.`
+return ditas.length < 0 ? undefined : `Ao gravar, com as suas marcas: ${ditas.join('; ')}.`
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › perto do "Gravar planilha" a tela diz o que as marcas vão fazer
-{resumoDasMarcas !== undefined && <p className="break-words font-medium text-tinta">{resumoDasMarcas}</p>}
+{resumoDasMarcas === undefined && <p className="break-words font-medium text-tinta">{resumoDasMarcas}</p>}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › perto do "Gravar planilha" a tela diz o que as marcas vão fazer
-<GravarDaPrevia gravacao={podeGravar(previa, totalDeMarcas(marcas))} resumoDasMarcas={resumoDasMarcas(marcas)} rotulo={rotuloDoGravar} gravando={gravando} demorando={demorando} aoGravar={aoGravar} />
+<GravarDaPrevia gravacao={podeGravar(previa, totalDeMarcas(marcas))} resumoDasMarcas={undefined} rotulo={rotuloDoGravar} gravando={gravando} demorando={demorando} aoGravar={aoGravar} />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › os erros e os avisos vêm primeiro e na ordem da planilha
-volta: ['volta de um ano anterior, para a turma que a linha escreve', 'voltam de um ano anterior, para a turma que cada linha escreve'],
+volta: ['volta de um ano anterior', 'voltam de um ano anterior'],
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.test.tsx › a gravação conclui e a lista de nomes mostra o que entrou
-mudar({ demorando: false, previa: undefined, conclusao: textoDaConclusao(importacao.resumo, linhasDeFora(linhas, marcadas, importacao.resumo)) })
+mudar({ demorando: false, previa: undefined, conclusao: textoDaConclusao(importacao.resumo, { semMarca: 0, mudaram: 0 }) })
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.test.tsx › a gravação conclui e a lista de nomes mostra o que entrou
-aoGravar={() => gravar({ texto, marcadas: marcas, linhas: previa.resposta.linhas })}
+aoGravar={() => gravar({ texto, marcadas: marcas, linhas: [] })}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › o convite do começo, o carregando
-const estaVazia = ({ escolha, recusa }: PlanilhaState): boolean => escolha === undefined && recusa === undefined
+const estaVazia = ({ escolha, recusa }: PlanilhaState): boolean => escolha === undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › o convite do começo, o carregando
-const estaVazia = ({ escolha, recusa }: PlanilhaState): boolean => escolha === undefined && recusa === undefined
+const estaVazia = ({ escolha, recusa }: PlanilhaState): boolean => recusa === undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › o convite do começo, o carregando
-const estaLendo = ({ escolha }: PlanilhaState, previaNoAr: boolean): boolean => escolha !== undefined && (escolha.texto === undefined || previaNoAr)
+const estaLendo = ({ escolha }: PlanilhaState, previaNoAr: boolean): boolean => escolha !== undefined && (escolha.texto === undefined)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › a prévia que falha diz o que fazer
-const estaLendo = ({ escolha }: PlanilhaState, previaNoAr: boolean): boolean => escolha !== undefined && (escolha.texto === undefined || previaNoAr)
+const estaLendo = ({ escolha }: PlanilhaState, previaNoAr: boolean): boolean => escolha !== undefined && true
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › em StrictMode
-const daTela = new AbortController()
+const daTela = controle.current ?? new AbortController()
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.fila.test.tsx › sair da tela cancela a leitura
-return () => daTela.abort()
+return () => undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.fila.test.tsx › sair da tela cancela a leitura
-return acompanharImportacao((sinal) => lerImportacao(id, sinal), { sinal: controle.current?.signal, aoDemorar: () => mudar({ demorando: true }) })
+return acompanharImportacao((sinal) => lerImportacao(id, sinal), { aoDemorar: () => mudar({ demorando: true }) })
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › o seletor de arquivo é um botão em português
-<button type="button" disabled={desligado} aria-describedby={`${id}-rotulo`} onClick={() => campo.current?.click()} className={SECONDARY_BUTTON_CLASSES}>
+<button type="button" disabled={desligado} aria-describedby={`${id}-rotulo`} onClick={() => undefined} className={SECONDARY_BUTTON_CLASSES}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › o seletor de arquivo é um botão em português
-<button type="button" disabled={desligado} aria-describedby={`${id}-rotulo`} onClick={() => campo.current?.click()} className={SECONDARY_BUTTON_CLASSES}>
+<button type="button" disabled={desligado} onClick={() => campo.current?.click()} className={SECONDARY_BUTTON_CLASSES}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › enquanto grava, o botão diz
-<button type="button" disabled={desligado} aria-describedby={`${id}-rotulo`} onClick={() => campo.current?.click()} className={SECONDARY_BUTTON_CLASSES}>
+<button type="button" aria-describedby={`${id}-rotulo`} onClick={() => campo.current?.click()} className={SECONDARY_BUTTON_CLASSES}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › o seletor de arquivo é um botão em português
-{escolhido ? 'Trocar arquivo' : 'Escolher arquivo'}
+{escolhido ? 'Escolher arquivo' : 'Trocar arquivo'}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › o seletor de arquivo é um botão em português
-{!escolhido && <span className="text-apoio">Nenhum arquivo escolhido.</span>}
+{escolhido && <span className="text-apoio">Nenhum arquivo escolhido.</span>}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › o seletor de arquivo é um botão em português
-hidden
 tabIndex={-1}
 disabled={desligado}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › enquanto grava, o botão diz
 tabIndex={-1}
-disabled={desligado}
 onChange={aoEscolher}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx
teste: apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.test.tsx › turma sem nenhum nome
-descricao="Escolha o arquivo com o nome e a matrícula de cada aluno, um por linha, na seção acima."
+descricao="Escolha o arquivo com o nome e a matrícula de cada aluno, um por linha, no campo acima."
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian (1ª) | `ImportarPlanilha.tsx:140-155`: o pedido de gravar guarda o texto da planilha como `variables`; "vale passar `gcTime: 0`" | Recusada: `useSingleSubmit` já fixa `gcTime: 0` (`apps/web/src/components/dialogs.tsx:28`: `useMutation({ ...opcoes, gcTime: 0 })`) |
| privacy-guardian (1ª) | `ler-planilha.ts:46-53`: o navegador manda todas as colunas da primeira aba; "seria melhor cortar as colunas fora do modelo, ou recusar o cabeçalho errado já no navegador" | `TODO.md` (minimização no navegador; muda o que a tela envia, e a API já recusa o arquivo inteiro com coluna fora do modelo) |
| privacy-guardian (1ª) | Cinco arquivos de teste não carregaram no checkout do revisor ("Failed to resolve entry for package @educa/shared") | Recusada: é o build de `@educa/shared` que faltava no checkout do revisor; o portão da tarefa roda verde e o `test-engineer` rodou os 7 arquivos de unidade e de componente (94 casos) |
| infra-guardian (1ª) | `api/importacao.ts:145-155`: a leitura da importação não tem fim; passado o prazo do job (300 s), "ler bem menos vezes … ou parar e oferecer "verificar de novo"; também vale não ler com a aba escondida" | `TODO.md` (muda a cadência de leitura, que a tarefa provou com o prazo de 60 s e o 429; decisão de infra, com teste próprio) |
| infra-guardian (1ª) | `ler-planilha.ts:15` e `:65`: teto do XLSX de 8 MB, "baixar o teto para 1 ou 2 MB, ou fazer a leitura num Web Worker" | `TODO.md` (o teto é contrato da spec, e a leitura num Web Worker é desenho novo; o Arquiteto decide) |
| tenancy-guardian (1ª) | Um caso de backend em `apps/api/test/importacao-alunos.int.test.ts` que monte um candidato a desligar com aluno da escola B e afirme que o rótulo dele não aparece na prévia da A | `TODO.md` (tarefa de backend; a 13.0 não toca `apps/api`) |
| tenancy-guardian (1ª) | `?painel=importar` só abre o painel; "não deixe que algum dia leve id de importação ou nome de arquivo no endereço" | Recusada: não é defeito, é um cuidado para o futuro; o e2e `importar-alunos.spec.ts` já confere o endereço depois de gravar |
| conformidade-reviewer (1ª) | O texto promete que "a sua escolha fica registrada", e nenhum teste desta tarefa liga a frase à auditoria do que foi marcado | `16_task.md` (um caso de integração que leia, pela auditoria, quem marcou cada desligamento e quando) |
| revisor-geral (1ª) | O RF16 diz "ou o planejado que a coordenação escolhe", e o painel "Importar alunos" não manda `anoLetivoId` e some sem ano em curso; a volta do aluno na virada não tem caminho pela tela | `TODO.md`, para o Arquiteto antes do pouso (`prd.md` RF16; a `14_task.md` traz o seletor do planejado só para o calendário). Se o Arquiteto entender que é divergência de desenho, o Orquestrador a abre |
| revisor-geral (1ª) | `docs/roteiro-da-demonstracao.md` ainda diz "Lista colada" | `16_task.md` (a 16.4 confere esse documento) |
| revisor-geral (1ª) | `previa-da-planilha.ts` já traz textos de `encerrar` e `sai_da_grade`, que são da 14.0 | `14_task.md` (a 14.0 revisa os textos no contexto da grade) |
| revisor-geral (1ª) | As fotos mostram "Choose File / No file chosen" | Atendida pelo item 1 |
| tenancy-guardian (2ª) | Um caso de backend com candidato a desligar de mesmo nome na escola B, afirmando que o rótulo dele não some na prévia da A (a da 1ª rodada, ainda aberta) | `TODO.md` (já está lá, desde a 1ª rodada) |
| tenancy-guardian (2ª) | Se o painel passar a mandar `anoLetivoId` (RF16, o planejado), o backend verifica que o ano é da escola do token e responde igual a ano de outra escola e a ano que não existe; volta à auditoria de isolamento | `TODO.md`, no item do RF16 que já vai ao Arquiteto |
| infra-guardian (2ª) | `api/importacao.ts`: a leitura da importação não tem fim (passado o prazo do job, ler menos ou parar e oferecer "verificar de novo"; pausar com a aba escondida) | `TODO.md` (já está lá, desde a 1ª rodada) |
| infra-guardian (2ª) | `ImportarPlanilha.tsx` › `controle.current?.signal` aceita `undefined` em silêncio; "melhor falhar alto quando o controlador não existir" | Recusada: o controlador nasce no efeito da montagem, e o gravar só é pedido por um clique depois dela; falhar alto seria código para um caminho que a tela não alcança |
| infra-guardian (2ª) | `ler-planilha.ts:15`: teto de 8 MB do XLSX no Chromebook | `TODO.md` (já está lá, desde a 1ª rodada) |
| frontend-reviewer (2ª) | A frase "Ao gravar, com as suas marcas…" em `font-medium text-tinta` pode pesar mais que o botão | `TODO.md`, para o Validador olhar a hierarquia na foto do fim da spec |
| frontend-reviewer (2ª) | `docs/roteiro-da-demonstracao.md` ainda diz "Lista colada" | `16_task.md` (a 16.4 confere esse documento; já está lá) |
| conformidade-reviewer (2ª) | O texto "a sua escolha fica registrada" sem teste que ligue a frase à auditoria de quem marcou cada desligamento | `16_task.md` (já está lá, desde a 1ª rodada) |
| conformidade-reviewer (2ª) | O resumo das marcas (`ImportarPlanilha.tsx`, `GravarDaPrevia`) muda a cada marca e não está em região anunciada: `aria-live="polite"` ou `aria-describedby` do botão | `TODO.md` (acessibilidade do painel, para a 16.0 junto do teste com leitor de tela) |
| privacy-guardian (2ª) | `ler-planilha.ts:46-53`: o navegador manda todas as colunas da primeira aba; cortar as colunas fora do modelo | `TODO.md` (já está lá, desde a 1ª rodada) |
| revisor-geral (2ª) | O comentário do caso em `StrictMode` de `ImportarPlanilha.test.tsx` diz que o provider não monta duas vezes; o que falta no `renderScreen` é o `StrictMode` (test-engineer (2ª) diz o mesmo: "isso não está provado") | `TODO.md` (é só texto de comentário em arquivo de teste; a próxima tarefa que tocar o arquivo corrige) |
| revisor-geral (2ª) | `linhasDeFora`: a linha que vira `ja_existe` entre a prévia e o gravar cai em "a matrícula passou a ser de outra turma ou de outro aluno", causa que pode não ser a real; "a escola mudou entre a prévia e o gravar. Veja a lista…" | `TODO.md` (texto de tela; a frase não diz o que não aconteceu, só nomeia uma causa a mais) |
| revisor-geral (2ª) | A ordem alfabética das importações de `ImportarPlanilha.tsx` ficou fora (`resumoDasMarcas` antes de `previaEnvelheceu`) | Recusada: só arrumação, e o lint do portão não a cobra |
| test-engineer (2ª) | `e2e/importar-alunos.spec.ts:380` e `:403` conferem a conclusão por prefixo (`toContainText`); usar `toHaveText` com a frase inteira | `TODO.md` (e2e perto de 90% do prazo se conserta em lote; as linhas `:127` e `lista-da-turma.spec.ts:156/174` já pegam o caminho sem marca) |
| test-engineer (2ª) | `linhasDeFora`: transferência marcada que deixa de valer entre a prévia e o gravar não entra em nenhuma das duas contas; contar `muda_de_turma` marcadas menos `transferidos` | `TODO.md` (caso raro; muda a conta da conclusão, com teste próprio) |
| test-engineer (2ª) | Acrescentar à tabela "Testes que provam a regra" do `13_task.md` o seletor em português, o resumo das marcas e a gravação em `StrictMode` | `TODO.md`, para o Arquiteto/Implementador acrescentarem antes da validação (a validação confere o caso da tabela, e os três casos existem nos testes) |
| test-engineer (2ª) | `escolhido={escolha !== undefined}` sem bloco próprio de mutação | `TODO.md` (o caso do seletor já pega as duas trocas) |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-05 14:19:09 | 2026-11-05 14:19:43 | `tenancy-guardian` | 1 | APROVADO | a6463f707543b0b41 |
| 2026-11-05 14:19:02 | 2026-11-05 14:20:07 | `frontend-reviewer` | 1 | AJUSTES NECESSÁRIOS | a69cab1e589a61562 |
| 2026-11-05 14:19:16 | 2026-11-05 14:20:22 | `conformidade-reviewer` | 1 | APROVADO | a0534585e25505715 |
| 2026-11-05 14:19:37 | 2026-11-05 14:20:26 | `infra-guardian` | 1 | APROVADO | a60799e548343463a |
| 2026-11-05 14:18:55 | 2026-11-05 14:20:38 | `privacy-guardian` | 1 | APROVADO | aa8aca471ba0239c3 |
| 2026-11-05 14:19:30 | 2026-11-05 14:22:30 | `revisor-geral` | 1 | REPROVADO | a9f7665b472165599 |
| 2026-11-05 14:19:23 | 2026-11-05 14:23:16 | `test-engineer` | 1 | REPROVADO | ab77c8b036cade848 |
| 2026-11-05 17:02:05 | 2026-11-05 17:02:27 | `tenancy-guardian` | 2 | APROVADO | ad19753aa9d04c70b |
| 2026-11-05 17:02:24 | 2026-11-05 17:02:52 | `infra-guardian` | 2 | APROVADO | a4325c54e48df62f0 |
| 2026-11-05 17:02:32 | 2026-11-05 17:03:04 | `frontend-reviewer` | 2 | APROVADO | ad1b2ff13d63e6969 |
| 2026-11-05 17:02:18 | 2026-11-05 17:03:08 | `conformidade-reviewer` | 2 | APROVADO | a0b628483fa58d7cd |
| 2026-11-05 17:02:10 | 2026-11-05 17:03:16 | `privacy-guardian` | 2 | APROVADO | afc6cb43640474793 |
| 2026-11-05 17:02:38 | 2026-11-05 17:04:12 | `revisor-geral` | 2 | APROVADO | a9d785ea2e1a1452e |
| 2026-11-05 17:02:50 | 2026-11-05 17:05:01 | `test-engineer` | 2 | APROVADO | a84091a8bc1a1f276 |
