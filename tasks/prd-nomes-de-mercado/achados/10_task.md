# Achados das revisões — `tasks/prd-nomes-de-mercado/10_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-10-31 23:01:36 · `tasks/prd-nomes-de-mercado/10_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma. A tarefa não toca migration nem schema. O diff fica em `apps/web/src`, `apps/web/chunk-names.test.ts`, `e2e/`, `eslint-suppressions.json`, nos documentos da spec e em `tools/renomear/mapas/10.*`.

Queries verificadas: nenhuma do lado do servidor, porque não há repository, endpoint nem `@Unscoped()` no diff. Do lado da web, conferi o seguinte:
- **Rotas e corpos das chamadas:** as rotas `/v1/...` são as mesmas antes e depois. O que muda são os nomes das funções que fazem a chamada: `chamarApi`/`buscarDaApi` passam a `apiRequest`/`apiGet`, e `chamarComSessao`/`buscarComSessao` passam a `authedRequest`/`authedGet`. Nenhum corpo ou query string passou a levar `escolaId`. O `POST` de troca de escola continua mandando só `{ usuarioId }`.
- **Token da sessão:** `apps/web/src/api/sessao.ts` e `apps/web/src/api/client.ts` só mudaram de nome. O token continua vindo da sessão e não do chamador (`AuthedRequestOptions = Omit<RequestOptions, 'token'>`).
- **Valores das chaves:** comparei todos os textos literais das linhas removidas com os das adicionadas. Os valores das chaves do TanStack Query são idênticos (`CHAVE_*` → `*_QUERY_KEY`). As chaves de `localStorage` e `sessionStorage` também, e o prefixo `educa.escolhas-pendentes.` está intacto. Os únicos literais que mudaram são nomes de arquivo de componente, nomes de classe e textos de lint.

Teste de isolamento: não se aplica. A tarefa não cria módulo nem consulta.

Bloqueantes: nenhum.

Recomendações:
- `apps/web/src/api/client.ts`: o `this.name` da classe de erro trocou de valor, de `'ErroDaApi'` para `'ApiError'`. Não afeta o isolamento, mas é um valor visto em tempo de execução, não só um identificador. Vale o `conferir` registrar a troca, para ninguém tomar isso por mudança de caso no RF7.

## infra-guardian · 1ª rodada · APROVADO · 2026-10-31 23:02:05 · `tasks/prd-nomes-de-mercado/10_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/web/src/api/client.ts:16` é o único texto que o código de produção da web vê em execução e que mudou: `this.name` passou de `'ErroDaApi'` para `'ApiError'`. Nada no código de produção compara `error.name`. A repetição automática (`shouldRetry`) e a mensagem de erro usam `instanceof`, então o comportamento não muda. Se um dia alguma telemetria agrupar erro pelo `name`, essa troca separa a série histórica em duas. Vale uma linha no relatório.

O que verifiquei:
- Comparei todos os textos fixos de produção que saíram e que entraram em `apps/web/src`, `chunk-names.ts` e `vite.config.ts`, arquivo por arquivo. Fora o `name` acima, são os mesmos. Nenhuma chave do TanStack Query mudou de valor. As chaves de `localStorage` (tema, tamanho da letra, lateral) também ficaram iguais, e o mesmo vale para o armazenamento da fila de respostas da prova (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/web/src/areas/aluno/fila-de-respostas.ts`) e do espelho dela. Resposta guardada no navegador antes do deploy continua sendo achada depois, e a retomada da prova após queda segue intacta.
- Os textos entre crases que mudaram estão todos em comentário.
- O diff do e2e é só comentário. Em `eslint-suppressions.json` muda só a chave do arquivo renomeado.
- A verificação de tipos da web (`tsc --noEmit`) passa sem erro.
- Não há mudança em API, worker, fila, gateway de IA, migration nem infra.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-10-31 23:03:12 · `tasks/prd-nomes-de-mercado/10_task.md`

VEREDITO: APROVADO

Tela vista: não. A tarefa é renomeação técnica sem mudança de tela e o prompt traz "Fotos da tela: indisponíveis por desenho". Eu não fotografei nada, porque a linha "Telas" do documento está vazia. Revisei pelo código e comparei o `HEAD` com a árvore.

Estados: ok. Nenhum estado mudou. Os componentes `EstadoCarregando`, `EstadoErro` e `EstadoVazio` viraram `LoadingState`, `ErrorState` e `EmptyState` (renomeações RM). Os textos `titulo`, `descricao` e `rotulo` que eles recebem estão idênticos.

Acessibilidade: sem mudança. Nenhum `aria-*`, `role`, `tabIndex`, `className`, `data-testid` ou ordem de JSX mudou. Comparei todas as strings entre `HEAD` e a árvore, nos 370 arquivos de `apps/web` e `e2e`, e nenhuma classe ou rótulo difere. Em todo arquivo de `apps/web` e `e2e` as linhas somadas e removidas são iguais (`git diff --numstat`), então nenhuma linha de JSX foi criada ou apagada.

Chromebook fraco: não afetado. Não houve mudança de lógica nem de renderização. O `chunk-names.test.ts` só acompanha os nomes dos arquivos movidos.

Celular: não afetado. Nenhuma classe responsiva mudou.

Ação oficial protegida: sim, inalterada. Nada em aprovar, publicar ou excluir mudou além do nome. O único literal de interface que mudou é o texto de lint de `perigo-cheio.test.ts`, que cita `DangerConfirmDialog`.

O que conferi:
- **Texto da tela:** nenhuma string, template literal ou texto de JSX em português mudou. As diferenças que sobraram são só nomes de tipo, de função e de arquivo.
- **Valores das chaves do TanStack Query:** os `*_QUERY_KEY` têm exatamente os mesmos arrays das antigas `CHAVE_*` (por exemplo `['tutor','memoria']`, `['operacao','escolas']`). As três constantes de `localStorage` mantêm o valor (`educa.letra`, `educa.aparencia`, `educa.lateral-recolhida`).
- **Rotas e caminhos:** os literais de URL e de `paths` estão iguais.
- **Único valor de execução que mudou:** `this.name` de `ErroDaApi` passou a `'ApiError'`, em `client.ts` e `eu.test.ts`. Não aparece na tela e tem trava (`estados.test.tsx:32`). Registro a observação do `tenancy-guardian` de que o `conferir` deve anotar essa troca.
- **Testes:** `npx vitest run --project unidade apps/web/` passou, com 197 arquivos e 2648 testes.

Bloqueantes: nenhum.

Recomendações, que não bloqueiam:
1. `apps/web/src/operacao/api/sessao.ts:340` ainda exporta `chamarComSessaoDeOperador`, usado em `eu.ts`, `painel.ts` e `sessao.test.ts`. A função-irmã `chamarComSessao` virou `authedRequest`. O símbolo não está em `inventario-web-e2e.md` nem no mapa 10, então foi lacuna do inventário e não erro do `aplicar`. Vale decidir se vira `operatorAuthedRequest` ou se entra como `fica` justificado.
2. `apps/web/src/components/introducao/ScrollArea.tsx:6` tem `interface PropsDaRegiaoQueRola` e o arquivo `RegiaoQueRola.test.tsx` não foi renomeado (o relatório o registra como `fica`, linha 45). O componente é `ScrollArea`, então o nome do teste e do `describe` ficou desencontrado. Vale confirmar se é intencional (RF6, `describe` igual).
3. Constantes locais não exportadas ainda usam o nome antigo:
   - `CHAVE_DO_ACESSO`, em `apps/web/src/areas/professor/turmas/api/acesso.ts:15`;
   - `CHAVE_DOS_PEDIDOS` e `CHAVE_DA_CONTAGEM_DE_PEDIDOS`, em `apps/web/src/api/pedidos.ts:34` e `:64`.
   Não vi essas três no §15 do anexo. É coerência de nome, não de comportamento.

## test-engineer · 1ª rodada · REPROVADO · 2026-10-31 23:03:50 · `tasks/prd-nomes-de-mercado/10_task.md`

VEREDITO: REPROVADO

Cenários exigidos: o documento é uma renomeação técnica da web, sem regra de negócio, tela, dado de escola, permissão nem operação concorrente. Por isso os cenários são os da tabela do documento:
- `conferir`: só o nome muda, com os mesmos casos (RF7)
- `restos`: nenhum nome antigo sobra
- a esteira da spec fica verde depois do encontro
- os valores das chaves do TanStack Query não mudam
- `CascaDaEscola`, `MenuDaPessoa` e as telas mantêm o nome
- o texto dos `describe` não muda (RF6)
- um bloco de mutação para cada trava achada (`travas.md:95`, `:101`, `:140`, `:188`, `:189` e `:190`)

Isolamento, permissão e concorrência não se aplicam.

Cobertos:
- **`conferir`:** rodei `node tools/renomear/conferir.ts --mapa tools/renomear/mapas/10.json` e deu verde, com 209587 itens e nenhuma diferença que o mapa não explique.
- **`restos`:** rodei `node tools/renomear/restos.ts` e deu limpo nos 8 mapas.
- **Chaves do TanStack Query:** comparei no `git diff` as 25 declarações `CHAVE_*` → `*_QUERY_KEY`, e os valores são idênticos. `REDES_QUERY_KEY` continua derivada de `.queryKey`. As três chaves de `localStorage` (`*_STORAGE_KEY`) mantêm `'educa.lateral-recolhida'`, `'educa.letra'` e `'educa.aparencia'`.
- **Textos de `describe`, `it` e `test`:** nenhuma linha mudou no diff de `apps/web` e `e2e`.
- **`CascaDaEscola` e `MenuDaPessoa`:** o nome do componente fica. O diff troca só imports e usos.
- **Os testes que as mutações citam:** rodei `estados.test.tsx`, `eu.test.ts`, `estilos.test.ts`, `chunk-names.test.ts`, `perigo-cheio.test.ts` e `restos.test.ts`, e os 130 casos passaram.
- **Proibidos:** nenhum `.skip`, `.only`, `.todo` ou `any` foi acrescentado.
- **Blocos de mutação:** os 13 blocos correspondem às travas de `travas.md`. As de forma C citam `restos.test.ts`, como pede `tasks.md` passo 5.
- **Esteira:** não pude conferir agora. Pelo Tech Spec §7c ela é lida no encontro.

Bloqueantes:
1. O bloco de mutação de `estados.test.tsx:32` (`travas.md:190`, forma B) está em `tasks/prd-nomes-de-mercado/10_task.md:111-117`. Ele fica vermelho pelo motivo errado e não alcança a trava que diz provar.
   - **O que acontece:** a mutação põe `{erro instanceof Error ? erro.name : ''}` logo depois de `{errorMessage(erro)}`, dentro do `<p role="alert">` de `apps/web/src/components/states/ErrorState.tsx:26-28`. Assim o caso quebra antes, em `estados.test.tsx:30` (`expect(alerta.textContent).toBe(MENSAGENS_DE_ERRO.INDISPONIVEL_TENTE_DE_NOVO)`), e a asserção da linha 32 (`not.toMatch(/INDISPONIVEL|503|ApiError/)`) nem chega a rodar.
   - **Por que importa:** com a regex ainda no nome antigo (`ErroDaApi`), o bloco ficaria vermelho do mesmo jeito. Ele não prova que a negativa foi atualizada, que é justamente o que `travas.md:190` afirma.
   - **Correção exigida:** pôr o texto da mutação fora do `alert`, por exemplo logo depois do `</p>`, dentro do `<div>` de fora: `+      {erro instanceof Error ? <span>{erro.name}</span> : null}`. Assim a linha 30 passa e só a linha 32 fica vermelha.
   - **Alternativa:** reclassificar a trava como forma C, que é o `restos` acusando `ErroDaApi` na regex, e citar `tools/renomear/restos.test.ts › a árvore não tem resto dos mapas aplicados`.
   - Em qualquer dos dois casos, a coluna "Prova" de `tasks/prd-nomes-de-mercado/travas.md:190` precisa acompanhar a correção.

Recomendações:
- Em `tasks/prd-nomes-de-mercado/inventario-web-e2e.md:448` e `:496`, as linhas de `consultarConvite` e `consultarConviteDeOperador` passaram a dizer "fica (`fetch` comum, não `queryOptions`)", mas a coluna Tipo continua "queryOptions". Vale corrigir a coluna para não contradizer a própria linha.
- Os nomes `dasEscolasQueryOptions`, `dasRedesQueryOptions` e `doUsoQueryOptions` seguem o anexo aprovado, mas carregam a preposição do nome antigo. Fica o registro para a retro do inventário.
- `e2e/operacao-escolas.spec.ts` está nos previstos como "alterado", mas não tem diff. Ajustar a tabela "Arquivos previstos" para "sem diff no fim", ou explicar por quê.
- A linha "esteira" da tabela de testes só pode ser conferida no encontro. A validação deve lê-la com `tools/processo/esteira.ts` antes de fechar a spec.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tasks/prd-nomes-de-mercado/10_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tasks/prd-nomes-de-mercado/travas.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/web/src/components/states/ErrorState.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/web/src/components/states/estados.test.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tasks/prd-nomes-de-mercado/inventario-web-e2e.md

## revisor-geral · 1ª rodada · REPROVADO · 2026-10-31 23:05:09 · `tasks/prd-nomes-de-mercado/10_task.md`

VEREDITO: REPROVADO
Escopo: incompleto
Aderência à Tech Spec: há divergência no §5 (linha 153), porque o `.test.tsx` não acompanhou o componente movido
Portão local: carimbo válido

**Bloqueantes:**

1. **Dois arquivos de teste ficaram com o nome antigo.**
   - Onde: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tools/renomear/mapas/10.json:112` e `:125`.
   - O que está errado: o mapa move `RegiaoQueRola.tsx` para `ScrollArea.tsx` e `RegiaoDaLista.tsx` para `ScrollableList.tsx`, mas não move os testes. Ficaram `apps/web/src/components/introducao/RegiaoQueRola.test.tsx` e `apps/web/src/operacao/components/RegiaoDaLista.test.tsx`, e os dois já importam `./ScrollArea` e `./ScrollableList`.
   - Isso contraria o Tech Spec §5 ("o `.tsx` com o nome do componente, e o `.test.tsx` dele, acompanha o componente na onda de linha dele (9.0, 10.0)") e a regra geral 1 de `inventario-web-e2e.md:8`.
   - A 9.0 seguiu essa regra: `Botao.test.tsx` virou `Button.test.tsx`, `Linha.test.tsx` virou `ListItem.test.tsx`, e assim por diante.
   - Nem o `conferir` nem o `restos` pegam o erro, porque olham conteúdo e não nome de arquivo.
   - Correção exigida: acrescentar ao mapa as duas entradas `arquivo`:
     - `.../introducao/RegiaoQueRola.test.tsx` → `.../introducao/ScrollArea.test.tsx`
     - `.../components/RegiaoDaLista.test.tsx` → `.../components/ScrollableList.test.tsx`

     Depois, aplicar e regenerar o relatório. A linha `RegiaoQueRola.test.tsx:32` das ocorrências passa a apontar para o arquivo novo, e o `describe` continua `fica`.

2. **Ficou nome antigo em comentário dentro de `apps/web/src`, que a subtarefa 10.4 manda buscar.**
   - Onde: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/web/src/index.css:303`.
   - O que está errado: o comentário cita `` `useTamanhoDaLetra()` ``, que esta onda renomeou para `useApplyTextSize`. O passo 5 não lê CSS, e a busca manual da 10.4 não pegou.
   - Há precedente: a 9.0 trocou no mesmo arquivo `BarraPresa` por `StickyFooter` (`0f7353cb`).
   - Correção exigida: trocar para `` `useApplyTextSize()` ``.

3. **Ficou nome antigo em comentário fora dos arquivos previstos.**
   - Onde: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/web/index.html:16`.
   - O que está errado: o comentário diz `` `src/theme.ts` repete esta conta em `resolverTema` ``, mas a função agora se chama `resolveTheme`. O passo 6 não lê HTML.
   - Correção exigida: como o arquivo não está nos previstos, parar e reportar a divergência ao Arquiteto, que o acrescenta aos previstos como fez com `e2e/casca.spec.ts`. Depois, trocar para `` `resolveTheme` ``.

**Recomendações:**
- Em `tasks/prd-nomes-de-mercado/10_task.md:89`, a frase "O rename não acrescenta condição (o `conferir` prova que só o nome mudou)" repete a primeira frase do parágrafo. Corte uma das duas.
- `tools/renomear/mapas/10.relatorio.md` mostra `estados.test.tsx:169` como `fica` (`inventario-web-e2e.md:9`). O mapa tem as duas classificações para essa linha (`fica` pelo `describe` e `trava` por `travas.md:188`), e a tabela mostra só a primeira. Quem lê o relatório vê `fica` onde o `travas.md` diz trava. Vale anotar para a ferramenta (`relatorio.ts`) e para a retro.
- Em `apps/web/src/components/casca-sem-import.test.ts:68`, o texto de entrada `import { Dica } from './itens-da-lateral'` cita o nome antigo `Dica`, que virou `Tooltip`. É inofensivo, porque o caso só confere o caminho, mas pode ser trocado na mesma passada.

O resto foi conferido e está certo:
- Os valores das chaves do TanStack Query não mudaram. As únicas strings alteradas são especificadores de import, as travas e o `this.name`.
- O inventário está coberto: §6 a §11, §15 e as linhas da adenda 2. As linhas de `arquivo` ficaram com a 6.0, e as leituras da triagem estão registradas como `fica`.
- As três travas novas estão no `travas.md` com bloco de mutação.
- Os arquivos de e2e mudaram só nos comentários previstos.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-10-31 23:59:46 · `tasks/prd-nomes-de-mercado/10_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma. O diff da 2ª rodada não tem migration nem schema.

Queries verificadas: nenhuma do servidor. O diff não tem repository, endpoint nem `@Unscoped()`. Do lado da web:
- **`chamarComSessaoDeOperador` → `operadorAuthedRequest`**: só o nome muda, em `apps/web/src/operacao/api/sessao.ts:340`, `eu.ts`, `painel.ts`, `sessao.test.ts` e `textos.ts`. Rotas, métodos e corpos são os mesmos, e nenhuma chamada passa a levar `escolaId` no corpo ou na query.
- **As três chaves de cache**: `ACESSO_QUERY_KEY`, `PEDIDOS_QUERY_KEY` e `CONTAGEM_DE_PEDIDOS_QUERY_KEY`, em `apps/web/src/areas/professor/turmas/api/acesso.ts` e `apps/web/src/api/pedidos.ts`. Os valores (`['acesso-da-turma']`, `['pedidos-da-turma']`, `[..., 'contagem']`) ficaram iguais. Por isso a limpeza do cache na troca de escola e na troca de pessoa (`main.tsx`) segue alcançando as mesmas consultas. A contagem do sino continua com chave diferente da lista nominal de pedidos.
- **Renomeações e comentários**: `ScrollArea.test.tsx` e `ScrollableList.test.tsx` são renomeações puras (similarity 100%). Em `index.html` e `index.css` só mudam comentários.
- **Nomes antigos**: não sobra nenhum dos quatro nomes da adenda 4 em `apps/web` nem em `e2e`.

Teste de isolamento: não se aplica. A tarefa não cria módulo nem consulta.

Correção exigida na 1ª rodada: nenhuma. A recomendação (o `this.name` de `ErroDaApi` virar `'ApiError'`) está registrada em `travas.md:189`.

Bloqueantes: nenhum.

Recomendações:
- Fora do isolamento: dois nomes antigos ficaram dentro dos arquivos renomeados. Um é o `describe('RegiaoQueRola')` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/web/src/components/introducao/ScrollArea.test.tsx:32`. O outro é a interface `PropsDaRegiaoQueRola` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/web/src/components/introducao/ScrollArea.tsx:6`. Vale conferir com o inventário se ficam ou se o `restos` deveria pegá-los.

## infra-guardian · 2ª rodada · APROVADO · 2026-10-31 23:59:58 · `tasks/prd-nomes-de-mercado/10_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- O diff desta rodada só troca nomes na web: `chamarComSessaoDeOperador` passa a `operadorAuthedRequest`, e as três constantes locais passam a `*_QUERY_KEY`. Os valores das chaves continuam os mesmos (`['acesso-da-turma']`, `['pedidos-da-turma']` e `[..., 'contagem']`), então não há cache novo nem invalidação diferente com duas abas ou duas instâncias. O caminho da sessão de operador mudou só de nome: a renovação pelo cookie e a regra do 503 que não manda ninguém para a entrada ficaram iguais em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/web/src/operacao/api/sessao.ts:340`. Não há correção exigida da rodada 1 para conferir.
- Dois nomes antigos ficaram dentro de arquivos já renomeados: `PropsDaRegiaoQueRola` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/web/src/components/introducao/ScrollArea.tsx:6` e `describe('RegiaoQueRola'` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/apps/web/src/components/introducao/ScrollArea.test.tsx:32`. Não tem efeito sobre carga. Vale o revisor-geral conferir se o inventário os põe em "Ficam".

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-01 00:00:24 · `tasks/prd-nomes-de-mercado/10_task.md`

VEREDITO: APROVADO
Tela vista: não. A tarefa é renomeação técnica sem mudança de tela, o documento diz "Telas: nenhuma muda", então não há foto. Revisei pelo diff da rodada (`.processo/ordens/10_task-r2-diff.patch`) e pelo código.
Estados: ok. Nenhum JSX, estado de carregando, vazio ou erro, nem texto de tela foi tocado. O diff da web só mexe em identificadores e comentários.
Acessibilidade: sem mudança. Os dois testes movidos continuam apontando para os componentes certos: `ScrollArea.test.tsx` importa `ScrollArea`, e `ScrollableList.test.tsx` importa `ScrollableList`.
Chromebook fraco: sem mudança.
Celular: sem mudança.
Ação oficial protegida: sim, intocada.

Conferi três pontos pelo código:
- **Chaves do TanStack Query:** os valores continuam os mesmos. `['pedidos-da-turma']`, `['pedidos-da-turma', 'contagem']` e `['acesso-da-turma']` só trocaram o nome da constante em `apps/web/src/api/pedidos.ts` e `apps/web/src/areas/professor/turmas/api/acesso.ts`. Quem esvazia o cache por prefixo na troca de escola segue funcionando.
- **`operadorAuthedRequest`:** a troca de `chamarComSessaoDeOperador` está completa. Não sobrou nenhum uso do nome antigo em `apps`, `e2e` ou `packages`, e `tsc --noEmit` em `apps/web` passa sem erro.
- **Textos:** as mudanças em `index.html`, `index.css` e `operacao/textos.ts` são só comentário.

Bloqueantes: nenhum.

Recomendações (a rodada anterior pediu o tratamento de `chamarComSessaoDeOperador`, das três constantes `CHAVE_` e dos testes desencontrados; os três estão tratados):
- Sobrou nome em português dentro de dois arquivos de teste e de um tipo local. Não aparece ao usuário e não bloqueia.
  - `apps/web/src/components/introducao/ScrollArea.test.tsx:32` tem `describe('RegiaoQueRola', …)`.
  - `apps/web/src/components/introducao/ScrollArea.tsx:6` tem a interface `PropsDaRegiaoQueRola`.
  - `apps/web/src/theme.test.ts:55` e `:120` citam `resolverTema`.
  - `apps/web/src/text-size.test.ts:233` cita `useTamanhoDaLetra`.
  - Vale alinhar com `ScrollAreaProps`, `resolveTheme` e `useApplyTextSize` na próxima passagem, ou registrar na adenda do inventário.

## test-engineer · 2ª rodada · APROVADO · 2026-11-01 00:00:41 · `tasks/prd-nomes-de-mercado/10_task.md`

VEREDITO: APROVADO

Cenários exigidos: os da tabela "Testes que provam a regra" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tasks/prd-nomes-de-mercado/10_task.md`. São seis: o `conferir` (só o nome muda, os casos ficam os mesmos, RF7), o `restos`, a esteira, os valores das chaves do TanStack Query, a casca e as telas intactas, e o texto de `describe` do apoio de teste (RF6). Somam-se as três travas novas (`travas.md:188` a `:190`) e as travas reusadas `:101`, `:140` e `:95`. Por ser rodada nova, audito só o diff desde a 1ª rodada e o que ele afeta.

Cobertos:
- **Correção exigida 1, feita.** O bloco de `10_task.md:116-122` agora troca `      </p>` por `      </p>` seguido de `{erro instanceof Error ? <span>{erro.name}</span> : null}`. O `</p>` aparece uma vez só em `ErrorState.tsx` (linha 28), com o mesmo recuo. O `<span>` fica fora do `<p role="alert">`. Com isso:
  - a asserção de `estados.test.tsx:30`, sobre o texto do alerta, continua verde;
  - só a negativa da linha 32 (`container.textContent` contra `/INDISPONIVEL|503|ApiError/`) fica vermelha;
  - com a regex ainda no nome antigo (`ErroDaApi`), o caso passaria, porque o texto da tela traria `ApiError`. A mutação agora prova o que a trava diz.

  A coluna "Prova" de `travas.md:190` acompanhou a correção, e o texto do bloco também (`10_task.md:114`).
- **Os quatro nomes da adenda 4.** São `chamarComSessaoDeOperador`, `CHAVE_DO_ACESSO`, `CHAVE_DOS_PEDIDOS` e `CHAVE_DA_CONTAGEM_DE_PEDIDOS`. Mudou só o identificador: os valores das chaves (`['acesso-da-turma']`, `['pedidos-da-turma']`, `'contagem'`) estão iguais no diff. Não entra condição nova, então nenhum bloco de mutação novo é exigido. As entradas de `10.json` apontam para `inventario-adenda-4.md:20` a `:23`.
- **Testes movidos com o componente.** `ScrollArea.test.tsx` e `ScrollableList.test.tsx` têm 100% de similaridade, e o `10.json` e o relatório ganharam as entradas de arquivo.
- **Comentários.** Os de `index.html` e de `index.css` estão registrados como troca à mão no relatório, e `index.html` entrou nos previstos.
- **Testes rodados nesta rodada.** `estados.test.tsx`, `operacao/api/sessao.test.ts`, `ScrollArea.test.tsx`, `ScrollableList.test.tsx` e `pedidos.test.ts` deram 5 arquivos e 70 casos, todos verdes.
- **Nomes antigos que sobram.** A busca por eles em `apps/web` e `e2e` achou só textos de `describe` e de caso: `theme.test.ts:55` e `:120` (`resolverTema`), e `text-size.test.ts:233` (`useTamanhoDaLetra`). Ficam assim de propósito, pelo RF6 e RF7.
- **Mutações.** O documento tem 13 blocos, que batem com as 13 mutações vermelhas do portão.
- Não há `.skip` nem mock novo, e o diff não toca IA nem concorrência.

Bloqueantes: nenhum.

Recomendações: nenhuma nova.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-01 00:01:33 · `tasks/prd-nomes-de-mercado/10_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

As três correções da 1ª rodada foram feitas:

1. **Testes que tinham ficado com o nome antigo.** O mapa `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tools/renomear/mapas/10.json` ganhou as duas entradas `arquivo`. Os testes passaram a `ScrollArea.test.tsx` e `ScrollableList.test.tsx`, sem mudança de conteúdo no do `ScrollArea`. A ocorrência `fica` do `describe('RegiaoQueRola')` acompanhou o caminho novo no mapa e no relatório.
2. **Comentário de `apps/web/src/index.css`.** Agora cita `useApplyTextSize()`, que existe em `text-size.ts:121`.
3. **Comentário de `apps/web/index.html:16`.** Agora cita `resolveTheme`, que existe em `theme.ts:26`. O arquivo está nos previstos (`10_task.md:48`), a Tech Spec §5 registra que o passo 5 não lê HTML, e a troca à mão está no relatório.

A adenda 4 também está completa:
- Está aprovada e registrada em `inventario.md`, `inventario-adenda-4.md` (linhas 20 a 23 batem com as referências), `techspec.md` e `tasks.md`.
- As quatro entradas estão no mapa com `linhaDoAnexo` certa.
- Os valores das chaves não mudaram (`['acesso-da-turma']`, `['pedidos-da-turma']` e `[..., 'contagem']`).
- Nenhum nome antigo sobra em `apps/`, `e2e/`, `packages/` nem `tools/`. Os que aparecem são os títulos de `describe`, que ficam pelo RF7, e a `PropsDaRegiaoQueRola`, que fica porque as `Props…` de fora do kit ficam (`inventario-web-e2e.md:68`).

Recomendações:
- A linha `apps/web/index.html | resolverTema | 16` foi escrita à mão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specnomes-de-mercado--l2/tools/renomear/mapas/10.relatorio.md:115`, dentro de um arquivo que o `aplicar` gera. Se o relatório for gerado de novo, a linha some, e o `restos` usa essa tabela (`restos.ts:54`) para saber o que já foi trocado à mão. Vale uma linha para a retro da X8: o mapa ou a ferramenta deveriam aceitar troca à mão declarada.
- "Recomendações sem aplicar" (`10_task.md:203`) ainda está vazia. Pela skill `executar-task` ela só é preenchida na aprovação final, então não bloqueia agora. Ao fechar, copie para lá a tabela "Sem aplicar" de `.processo/ordens/10_task-r1.md`, com as duas linhas do revisor-geral (`relatorio.ts` e `Dica` em `casca-sem-import.test.ts:68`) e o destino delas.
