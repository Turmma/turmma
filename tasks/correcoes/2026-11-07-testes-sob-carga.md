# Correção — três testes dependem da carga e derrubam o portão local

**Origem:** teste intermitente (portão local da tarefa 1.0 de acesso-e-convites, três corridas: `portao7.txt`, `portao8.txt`, `portao9.txt`).
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- `revisor-geral` é obrigatório: a correção toca `tools/ci/` e `tools/processo/`. Os quatro guardiões vieram na DEVOLUÇÃO da Mesa 2,
     que conferiu a linha contra os arquivos alterados (`guardioesDoCaminho`): `chunk-names.test.ts` pede tenancy e infra;
     `revisoes.test.ts` pede privacy, conformidade e infra, por citação no texto; `tamanho-web.test.ts` pede infra. -->

## Sintoma

O portão da tarefa cai na unidade, com a máquina carregada:

- `tools/ci/tamanho-web.test.ts` › "as peças acima de 40 kB em brotli reprovam…": `Test timed out in 5000ms` (5,5 s e 5,7 s
  sob o portão; 2 s isolado).
- `tools/processo/revisoes.test.ts` › "o portão local, rodado como processo, não carimba o que a suíte editou no meio da
  corrida": `expected +0 to be 1`, na linha do `conferir` depois do comentário novo. Uma corrida em três.

Depois da correção dos dois, o portão da correção (`portao-correcao.txt`) caiu num terceiro da mesma família:
`apps/web/chunk-names.test.ts` › "as áreas da escola: uma fachada por papel…": `Test timed out in 5000ms`. Ele entra aqui
porque a causa é a mesma (prazo de 5 s da unidade contra um processo que só o tempo explica) e o portão da correção não passa
sem ele; é arquivo de teste, fora de `apps/web/src`, e não muda o conjunto de guardiões.

## Fora desta correção

Os 54 arquivos da tarefa 1.0 de acesso-e-convites que estão na árvore, alterados ou novos, listados pelo Orquestrador no
PEDIDO: `.env.example`, `apps/api/src/credencial/index.ts`, `apps/api/src/operacao/…`, `apps/api/src/sessao/…`,
`apps/api/test/…`, `apps/worker/src/…`, `apps/worker/test/…`, `docs/arquitetura.md`, `docs/modelo-de-dados.md`, `infra/…`,
`package-lock.json`, `packages/core/…`, `packages/shared/…`, `tasks/prd-acesso-e-convites/…`, `tools/ci/ambiente.test.ts` e os
novos (`enviar-email.ts`, `0042_envio_de_email.sql`, `packages/core/src/email/`, entre outros). O comando para vê-los é
`git status --short`, menos os arquivos desta correção (os três testes, este documento e o `TODO.md`). Ficam na árvore, fora da revisão e do commit.

## Causa

**`tamanho-web`.** O caso das peças roda `sizeLimit` cinco vezes, e cada uma é um `spawnSync('npx', ['size-limit'])`: uns 2 s
no total com a máquina livre, contra o prazo de 5 s da unidade. O portão roda a unidade inteira em paralelo, e o tempo de
processos filhos cresce com a carga. Reproduzido com 36 laços de CPU: a corrida falhou por prazo em dois casos (o das peças e
o da tela, que sobe dois processos). A causa é de fato o tempo.

**`revisoes`.** O `conferir` compara o `mtime` do arquivo com o `inicio` do carimbo, que vem de `Date.now()` do portão
(`avaliarCarimbo`: `alteracao.quando >= inicio`). O `mtime` é do relógio grosso do kernel, e nesta máquina ele fica atrás do
`Date.now()`: medi 20 000 escritas seguidas sob 24 laços de CPU, e o `mtime` ficou até **1 496 ms antes** do `Date.now()`
tomado antes da escrita. O caso escreve o comentário logo depois de um portão que leva menos de um segundo: com o relógio
atrasado, o `mtime` cai antes do `inicio`, o `conferir` não vê alteração e devolve 0 em vez de 1. O teste dependia de a
escrita ficar mais de ~1,5 s depois do início. (A leitura de `mtime` do `avaliarCarimbo` é do produto e não é esta correção:
no uso real o arquivo editado depois do portão leva minutos, não milissegundos.)

**`chunk-names`.** Cada caso de "o build de verdade da web" faz um build do Vite (o maior, 2,3 s livre; 5 s é o prazo da
unidade). Reproduzido com 36 laços de CPU: 5 e 4 dos 14 casos caíram por prazo em duas corridas.

## Teste que reproduz

- `apps/web/chunk-names.test.ts` (o describe "o build de verdade da web"): vermelho no HEAD sob 36 laços de CPU (5 e 4
  falhas, `Test timed out in 5000ms`); verde depois, com o prazo do describe em 60 s.
- `tools/ci/tamanho-web.test.ts` (o describe todo): vermelho no HEAD sob 36 laços de CPU (2 falhas, `Test timed out in
  5000ms`); verde depois, com o prazo do describe em 60 s.
- `tools/processo/revisoes.test.ts` › "o portão local, rodado como processo, não carimba o que a suíte editou no meio da
  corrida": a intermitência do relógio não se produz sob demanda, então o vermelho foi forçado no próprio caso: com o `mtime`
  do arquivo escrito posto uma hora **antes** do início (o que o relógio atrasado faz por um instante), o caso cai com
  `expected +0 to be 1` na mesma linha da corrida do portão. Com o `mtime` fixado uma hora **depois**, o caso não depende mais
  do relógio.

**Estabilidade:** o caso de `revisoes` rodado sozinho dez vezes seguidas: 10 verdes. O `tamanho-web` inteiro, três vezes sob
os mesmos 36 laços de CPU: 3 verdes (no HEAD, uma das três falhou). O `chunk-names` inteiro (31 casos), depois da correção, sob
36 laços de CPU: 5 corridas, 5 verdes (duas na primeira medição e três depois da ordem r1); no HEAD, 2 corridas, 2 vermelhas.

## Correção

- `tamanho-web.test.ts`: `describe(…, { timeout: 60_000 }, …)`. Nenhum caso fica sem prazo; todos sobem processo.
- `chunk-names.test.ts`: `describe('o build de verdade da web', { timeout: 60_000 }, …)`.
- `revisoes.test.ts`: depois de escrever o comentário, `utimesSync` fixa o `mtime` no futuro. O que o caso prova (comentário
  conta para o carimbo, que não tem a exceção) continua sendo o conteúdo: o `mtime` só deixa de ser sorteado.

## Mutações

--faltando: 0 linhas (0 blocos, 0 motivos) desta correção. O comando lista 47 linhas de `apps/` e `packages/`, todas da tarefa
1.0 de acesso-e-convites, que está na mesma árvore (`apps/worker/src/…`, `packages/core/src/email/…`,
`packages/core/src/retencao/…`); nenhuma é de `tools/`, e as três mudanças desta correção são em arquivo de teste.

**Sem mutação:** a correção só altera `tools/ci/tamanho-web.test.ts` (prazo do describe), `apps/web/chunk-names.test.ts` (prazo do
describe) e `tools/processo/revisoes.test.ts` (o `mtime` fixado), mais este documento e o `TODO.md`; nenhuma linha de produção. As linhas de `apps/*/src` e `packages/*/src` que a árvore carrega são da tarefa
1.0, que as cobre no documento dela. A prova é o vermelho forçado e o sob carga do "Teste que reproduz".

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª), test-engineer (1ª) | "o prazo de 60 s cobre o build e o `size-limit` sob carga, mas também esconde uma regressão de tempo do build. O tempo do portão local precisa continuar à vista na retro. Se o portão passar a demorar, a saída é rodar esses describes fora do paralelismo, não subir o prazo de novo." / "Vale registrar para a retro a ideia de separar os testes que sobem processo num projeto do vitest com paralelismo limitado, antes que o quarto teste dessa família apareça." | `TODO.md` (uma linha): muda a configuração da unidade e o paralelismo do portão, o que passa de uma correção de prazo de três describes; a retro da spec lê o `TODO.md` |
| infra-guardian (1ª), test-engineer (1ª) | "No uso real esse atraso pode deixar passar uma edição feita logo depois do portão. O próprio documento já deixa isso fora do escopo; o item fica para a retro, não para esta correção." / "a premissa `quando >= inicio` do `avaliarCarimbo` fica registrada como frágil se um dia o portão encurtar." | `TODO.md` (uma linha): a seção "Causa" do documento já deixa a leitura de `mtime` do `avaliarCarimbo` (código de produto) fora desta correção |
| infra-guardian (1ª) | "`tools/processo/revisoes.test.ts:762`: o `mtime` agora fica uma hora no futuro. Se o `conferir` vier a rejeitar `mtime` no futuro como sinal de relógio errado, o caso quebra por um motivo que não é o que ele prova. Vale um caso próprio no teste do `avaliarCarimbo` para essa borda." | Recusada: é condicional (hoje o `avaliarCarimbo` só compara `quando >= inicio`, `tools/processo/portao.ts:164`, como revisor-geral e test-engineer conferiram) e pede teste novo em outro arquivo, fora desta correção. Se o `conferir` passar a rejeitar `mtime` no futuro, o caso de `revisoes` fica vermelho e a causa aparece na hora |
| revisor-geral (2ª) | "`TODO.md:1115` diz que a correção subiu o prazo de "três describes", mas só dois tiveram o prazo levantado: `tools/ci/tamanho-web.test.ts:95` e `apps/web/chunk-names.test.ts:338`. A terceira mudança, em `revisoes.test.ts`, fixa o `mtime` e não mexe em prazo. Trocar por "dois describes"." | Aplicada no commit: o `TODO.md` agora diz "dois describes" (não caduca nenhum revisor) |
| revisor-geral (2ª) | "`tasks/correcoes/2026-11-07-testes-sob-carga.md:77` diz que nenhuma das 47 linhas listadas "é de `tools/`". A frase é verdadeira, mas uma das três mudanças desta correção está em `apps/web/`. Vale dizer que nenhuma das 47 linhas é de arquivo tocado por esta correção." | Não aplicada: a frase é verdadeira como está e o restante do parágrafo já diz que as 47 linhas são da tarefa 1.0; sem destino futuro |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-07 16:02:54 | 2026-11-07 16:03:03 | `tenancy-guardian` | 1 | APROVADO | abd3b50d957e0aa0f |
| 2026-11-07 16:02:56 | 2026-11-07 16:03:10 | `privacy-guardian` | 1 | APROVADO | a15f8a695e643e80b |
| 2026-11-07 16:02:56 | 2026-11-07 16:03:14 | `conformidade-reviewer` | 1 | APROVADO | a50a3dea214cbcb36 |
| 2026-11-07 16:02:58 | 2026-11-07 16:03:16 | `infra-guardian` | 1 | APROVADO | a4cd0eda887b9fcb8 |
| 2026-11-07 16:02:52 | 2026-11-07 16:03:19 | `revisor-geral` | 1 | APROVADO | a746479920f8871a7 |
| 2026-11-07 16:02:50 | 2026-11-07 16:04:19 | `test-engineer` | 1 | APROVADO | af4b692b653015266 |
| 2026-11-07 18:48:49 | 2026-11-07 18:49:06 | `revisor-geral` | 2 | APROVADO | a7f5a139b1c156607 |
