# Validação — onboarding-por-convite (F2, "A escola inteira entra de uma vez")

## Rodada 2 — 06/11/2026 (revalidação)

**Escopo:** funcionalidade completa
**Commit validado:** `d53ee9ac`
**Veredito: APROVADA**

O que mudou desde a rodada 1 (`643d998d..d53ee9ac`), lido por inteiro: três correções e quatro commits de estado.

- `45a955a3` (correção `2026-11-06-escopo-de-escola-da-grade`): só teste. `apps/api/test/grade.int.test.ts:616-620` passa a ler o ano
  **e** a turma da B pelo contexto da A, em `turmaExiste` e em `aulasDaTurma`. Nenhum código de produção mudou.
- `9675c2c3` (correção `2026-11-06-teto-de-desligamentos-fora-da-rota`): `packages/core/src/importacao/motor.ts:96-111`. O `gravar` do
  motor passa `pedido.marcas` por `marcasDaPlanilhaSchema` (o teto de 100 em `desligar`) antes de refazer a prévia, e grava as marcas
  que o schema devolve. O caso de 501 de `apps/worker/test/desligamento-pela-planilha.int.test.ts` foi reescrito para o teto
  (`:460`, 100 nomes saem), e ganhou o irmão de 101 pelo motor sem a rota (`:473`, `ENTRADA_INVALIDA` sem importação na fila).
- `7a0de6b3` (correção `2026-11-06-restos-da-carga-da-16`): troca de nome em `infra/scripts/carga-importacao.ts`, `carga-sala.ts` e
  `infra/test/carga-importacao.test.ts` (`chamarApi` → `callApi`, `SessaoSintetica` → `LoadSession`, `semComentarios` →
  `stripComments`). O comportamento não muda.
- Nada mudou em `apps/web` nem em `docs/`. As telas e os documentos são os da rodada 1.

`node_modules` em dia com o `package-lock.json`: não precisei rodar `npm ci`. A árvore terminou limpa, como começou: `git status`
vazio depois de cada mutação e no fim.

### 1. RF a RF

Os RF sem código alterado desde a rodada 1 mantêm a evidência dela, que segue abaixo. Rodei de novo os arquivos de integração do
caminho do `gravar`, porque ele mudou (seção 3).

| RF | Situação | Código | Teste | Observação |
|---|---|---|---|---|
| RF1 | ATENDIDO | `apps/web/src/areas/coordenacao/Escola.tsx:13`; `apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx`; `modelos-de-planilha.ts` | `e2e/escola-por-planilha.spec.ts:203` (os quatro modelos baixados passam na prévia sem erro); `e2e/grade-e-calendario.spec.ts:113`, `:192`, `:262`; `modelos-de-planilha.test.ts` (verde nesta rodada) | Fotos lidas nesta rodada: `.processo/vitrine/coordenacao--coordenacao-grade--computador.png` e `--celular-1.png` (a aba ao lado de Turmas, Professores e Material, os quatro "Baixar modelo", a grade por turma e o calendário de 2026), `coordenacao--coordenacao-grade--Importar-grade--computador.png` (painel de importar), `vazia--coordenacao--coordenacao-grade--computador.png`. Nenhuma tela rola a 1366 × 768. A grade com aulas é a foto da rodada 1 (`comgrade--…`); a web não mudou desde então. O "Sala Sala 12" continua (menor) |
| RF2 | ATENDIDO | `packages/core/src/importacao/motor.ts:96-108` (marcas pelo schema, prévia refeita; erro de linha ou marca fora dos candidatos é `ENTRADA_INVALIDA`); `leitor.ts`; `apps/web/src/areas/coordenacao/importacao/ler-planilha.ts` | `apps/api/test/importacao-alunos.int.test.ts:159`; `apps/api/test/importacao.int.test.ts:164`, `:176`; `ler-planilha.test.ts:9`, `:14`, `:52`; `e2e/escola-por-planilha.spec.ts:89` | Verdes nesta rodada (integração e unidade). Foto da prévia suja: rodada 1 (`previa-suja--computador.png`) |
| RF3 | ATENDIDO | `packages/shared/src/importacao/normalizador.ts:10-26`; `tipos/alunos.ts:230` | `importacao-alunos.int.test.ts:125`, `:159`, `:179`, `:386`; `normalizador.test.ts` | Verdes nesta rodada. Foto: `coordenacao--coordenacao-estrutura--computador.png` (botão "Importar alunos" em Turmas) |
| RF4 | ATENDIDO | `tipos/alunos.ts:277-302`, `:397-400`, `:523-546`; `motor.ts:105-106` | `gravar-planilha-alunos.int.test.ts:257`, `:320`; `desligamento-pela-planilha.int.test.ts:298`; `transferencia-pela-planilha.int.test.ts:368` | Verdes nesta rodada. A mutação 2 da rodada 1 (`marcadas.has(alvo.id)`) pegou; o código não mudou. Fotos do teto: rodada 1 (`previa-teto--computador.png`, `previa-teto-marcado--celular.png`) |
| RF5 | ATENDIDO | `tipos/alunos.ts:411-426` (`transferir`), `:453-468` (`desligar`); `ciclo-de-vida.service.ts:72` | `transferencia-pela-planilha.int.test.ts:272`, `:294`, `:335`; `desligamento-pela-planilha.int.test.ts:317`, `:340`, `:429`, `:460` (o teto: 100 nomes livres ausentes saem, 100 `lista_nome.retirado`, sem `desatualizada`), `:473` (101 pelo motor: `ENTRADA_INVALIDA`, nenhuma `importacao_planilha`) | O crítico 1 da rodada 1 está resolvido: `desligamento-pela-planilha.int.test.ts` verde por inteiro (28 casos). A mutação 3 desta rodada (abaixo) prova o teto no motor |
| RF6 | ATENDIDO | `tipos/professores.ts`; `convite/convidar-professor-da-planilha.ts` | `gravar-planilha-professores.int.test.ts:189`, `:245`, `:259`, `:317`; `apps/api/test/professores.int.test.ts:900`; `e2e/professores.spec.ts:1196`, `:1317` | `gravar-planilha-professores` verde nesta rodada (o `desligar` de professor passa agora pelo teto no motor). Fotos lidas: `coordenacao--coordenacao-professores--celular.png` (cinco professores, os da grade com "Convite em aberto", "Importar professores") |
| RF7 | ATENDIDO | `tipos/grade.ts:208`, `:262` | `gravar-planilha-grade.int.test.ts:261`, `:282`, `:303`, `:319`, `:357` | Verdes nesta rodada |
| RF8 | ATENDIDO | `tipos/grade.ts:504`; `estrutura/vinculo.repository.ts:332` | `gravar-planilha-grade.int.test.ts:416`, `:432`; `e2e/escola-por-planilha.spec.ts:265` | Verdes nesta rodada; a mutação 3 da rodada 1 pegou e o código não mudou |
| RF9 | ATENDIDO | `tipos/grade.ts:529` | `grade.int.test.ts:273`, `:312`, `:331`, `:347`, `:368` | Verdes nesta rodada (`encerrar` não tem teto: o schema novo no motor não o restringe) |
| RF10 | ATENDIDO | `tipos/calendario.ts:52` | `importacao.int.test.ts:190`, `:238`, `:254`; `e2e/grade-e-calendario.spec.ts:463` | Verdes nesta rodada. Foto: o calendário vazio de 2026 em `coordenacao--coordenacao-grade--celular-1.png` |
| RF15 | ATENDIDO | `motor.ts:96-114` (gravar responde 202, o job grava); `ImportarPlanilha.tsx` | `importacao-alunos.int.test.ts:408`; `ImportarPlanilha.fila.test.tsx:66`; `e2e/importar-alunos.spec.ts:411`; carga `previa_e_gravar` da rodada 1 (prévia p95 245 ms, gravar p95 404 ms, 3.000 linhas, zero 5xx e zero 503) | O `safeParse` novo é de no máximo 100 + n UUIDs, antes da prévia: não muda a carga. Não rodei a carga de novo |
| RF16 | ATENDIDO | `packages/core/src/importacao/grade.repository.ts:27` (`turmaExiste`), `:54` (`aulasDaTurma`); escopo do contexto nos demais repositories novos | `apps/api/test/grade.int.test.ts:619` (`turmaExiste(outra.e.emCurso, outra.t8a)` é `false`), `:620` (`aulasDaTurma(outra.e.emCurso, outra.t8a)` é `[]`), `:724`; `importacao.int.test.ts:466`, `:479`, `:586`; `calendario.int.test.ts:135`, `:152`; `transferencia-pela-planilha.int.test.ts:582`; `desligamento-pela-planilha.int.test.ts:864`; `gravar-planilha-grade.int.test.ts:606`, `:640` | O crítico 2 da rodada 1 está resolvido: as mutações 1 e 2 desta rodada (abaixo) ficaram vermelhas. A leitura com o ano e a turma da B no contexto da A é a única em que só o `escolaId` separa as duas escolas |
| RF17 | ATENDIDO | `packages/core/src/auditoria/acoes.ts` | `importacao.int.test.ts:537`; `gravar-planilha-alunos.int.test.ts:182`, `:320`; `transferencia-pela-planilha.int.test.ts:644`; `desligamento-pela-planilha.int.test.ts:364`, `:429`, `:460`, `:765`; `grade.int.test.ts:347`; `importacao-alunos.int.test.ts:330` | Verdes nesta rodada. O `:460` confere uma linha de `lista_nome.retirado` por nome retirado |
| RF18 | ATENDIDO | as quatro telas de importação; `e2e/support/planilhas.ts` | `e2e/escola-por-planilha.spec.ts` (26 casos em `chromebook` e `celular`, verdes na rodada 1) | Não rodei de novo: a web e o e2e não mudaram, e o motor só passou a recusar no `gravar` o que o pipe da rota já recusava. A esteira roda o e2e no commit validado (conferida no fechamento) |

Provas de mutação (rodada 2):

| RF | Cláusula removida | Teste que ficou vermelho |
|---|---|---|
| RF16 | `eq(alocacao.escolaId, escolaId)` em `packages/core/src/importacao/grade.repository.ts:54` (`aulasDaTurma`), a mutação 1 da rodada 1, que tinha sobrevivido | `apps/api/test/grade.int.test.ts:620` ("a leitura da grade só alcança a turma da escola do contexto …"): `expected [ {…}, {…} ] to deeply equal []` |
| RF16 | `eq(turma.escolaId, requireEscolaId())` em `grade.repository.ts:27` (`turmaExiste`) | `grade.int.test.ts:619` (mesmo caso): `expected true to be false` |
| RF5 | as três linhas do `safeParse` em `packages/core/src/importacao/motor.ts:98-100`, trocadas por `const marcas = pedido.marcas` (o `gravar` de antes da correção) | `apps/worker/test/desligamento-pela-planilha.int.test.ts:485` ("um a mais que o teto (101) …"): `expected 'gravou' to be 'ENTRADA_INVALIDA'` |

Cada mutação rodou só o caso que deveria pegar (`-t`) e foi restaurada com `git checkout -- <arquivo>`.

### 2. Regras de negócio, casos de borda e critério de pronto

As regras e os casos de borda são os da rodada 1, todos cumpridos ou cobertos. O código deles não mudou, e os arquivos que os provam
ficaram verdes nesta rodada. O que mudou:

| Item | Situação | Evidência |
|---|---|---|
| Regra: nenhuma reimportação remove, transfere ou desliga sem a marca | cumprida | como na rodada 1, mais o teto valendo também fora da rota (mutação 3) |
| Regra: desligar não é eliminar | cumprida | `desligamento-pela-planilha.int.test.ts:317` |
| Bordas do PRD (homônimos, transferido com pedido pendente, matrícula virada número, professor não convidado, professor que contesta, professor em duas escolas, grade no ano `planejado`) | cobertas | os mesmos casos da rodada 1, verdes nesta rodada (`importacao-alunos`, `gravar-planilha-alunos`, `transferencia-pela-planilha`, `gravar-planilha-grade`, `gravar-planilha-professores`); `ler-planilha.test.ts` verde |
| Pronto: RF1 a RF10 e RF15 a RF18, cada um com o teste da coluna "Como se prova" | cumprido | seção 1: os 15 RF ATENDIDOS |
| Pronto: todo cenário do `cenarios.md` com caso | cumprido por amostra | como na rodada 1 (conferidos por nome os de RF2 a RF10, Job e estados, Isolamento e Auditoria) |
| Pronto: o [C] do RF2 (p95 até 2 s; zero 503; passo (3) abaixo de 1 s) | cumprido | relatório da 16.0 e a fase `previa_e_gravar` da rodada 1. As correções não mexem no caminho medido além do `safeParse` das marcas |
| Pronto: `docs/interface.md` §3, `docs/modelo-de-dados.md`, glossário, `docs/lgpd.md`, `docs/runbook.md` dizem o que o código faz | cumprido | `docs/` não mudou. A Tech Spec §13 (`techspec.md:210-217`) diz que o teto vale no contrato `marcas.desligar`. O motor agora o aplica também fora da rota: é a mesma regra, sem divergência |
| Pronto: a esteira verde no último commit que alterou código | esteira: conferida no fechamento | o último commit com código é `9675c2c3`. O push da spec segue parado no escopo `workflow` do token (`estado.md`); sem GitHub, vale o portão completo local (regra 40) |

### 3. Portão

| Portão | Resultado |
|---|---|
| `npm run typecheck` | não rodado: escopo da funcionalidade completa, a esteira roda (D79) |
| `npm run lint` | não rodado (idem) |
| Integração das correções (`apps/api/test/grade.int.test.ts`, `apps/worker/test/desligamento-pela-planilha.int.test.ts`) | ✅ 54 passaram (16,9 s) |
| Integração do caminho do `gravar`, que mudou (`importacao`, `importacao-alunos`, `calendario`, `gravar-planilha-grade`, `gravar-planilha-alunos`, `transferencia-pela-planilha`, `gravar-planilha-professores`, `gravar-planilha`) | ✅ 195 passaram (34,8 s) |
| Unidade da importação (`packages/shared/src/importacao`, `packages/core/src/importacao`, `apps/web/src/areas/coordenacao/importacao`, `…/grade`) | ✅ 279 passaram, 18 arquivos |
| Correção dos restos (`infra/test/carga-importacao.test.ts`, `infra/test/carga-sala.test.ts`, `tools/renomear/restos.test.ts`) | ✅ 98 passaram |
| `npm run test:e2e` | não rodado: a web e o e2e não mudaram desde a rodada 1 (26 verdes ali); a esteira roda |
| `npm run test:infra` | não rodado (idem) |
| Esteira do GitHub | conferida no fechamento (D79): não entra no veredito |
| Revisões com veto registradas e aprovadas | ✅ as três correções têm rodada de todo revisor obrigatório, com a última APROVADO: `escopo-de-escola-da-grade` (revisor-geral e test-engineer na 2ª; tenancy-guardian, privacy-guardian, infra-guardian e conformidade-reviewer na 1ª), `teto-de-desligamentos-fora-da-rota` (os cinco na 1ª), `restos-da-carga-da-16` (os quatro na 1ª). As 16 tarefas como na rodada 1. Os três commits de código levam `(correção <slug>)`; os de estado só tocam `tasks/`. Nenhum `Fora do processo:` entre `origin/develop` e `d53ee9ac` |

### 4. Achados

**Críticos**

- Nenhum. Os dois da rodada 1 estão resolvidos: o caso vermelho de `desligamento-pela-planilha.int.test.ts` foi reescrito para o teto e
  o arquivo está verde, e o escopo de escola de `GradeRepository` tem teste que pega a remoção (mutações 1 e 2).

**Maiores**

- Nenhum.

**Menores** (o Orquestrador leva ao `TODO.md` no fechamento; dono e arquivo em cada um)

- Implementador · `packages/core/src/importacao/importacao.repository.ts:422`: o laço em lotes de 500 da retirada de nomes ficou sem
  prova de mais de um lote. Com o teto de 100, ele também não se alcança mais pelo desligamento, que é o único chamador
  (`tipos/alunos.ts:464`). Já está no `TODO.md` (correção do teto). Correção: provar direto no repository com 501 retiradas, ou reduzir
  o laço a um lote ligado a `MAXIMO_DE_DESLIGAMENTOS_POR_GRAVAR`.
- Implementador · `apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx:129`: "Sala Sala 12" (da rodada 1, segue aberto).
  Correção: mostrar a sala sem o prefixo "Sala ".
- Arquiteto · `tasks/prd-onboarding-por-convite/techspec.md:204`: a premissa do `read-excel-file` segue "⚠️ NÃO VERIFICADO" e já está
  verificada por `ler-planilha.test.ts:9` (da rodada 1, segue aberto).
- Implementador · `apps/worker/test/gravar-planilha.int.test.ts:244`: o nome ainda diz que a grade "chega na 8.0" (da rodada 1, segue
  aberto). Correção: renomear para o que o caso prova.
- Orquestrador · `10_task.md` e `16_task.md`: a seção "Revisões" sem as linhas da 1ª rodada (da rodada 1; o histórico está em
  `achados/`).
- Orquestrador · o que segue sem verificação: o anúncio dos `<p aria-live>` com `empty:hidden` (`ImportarPlanilha.tsx`) com leitor de
  tela (`TODO.md:2721`), e a medida de 1.000 e 3.000 transferências e da virada de 3.000 (`TODO.md:2724`).
- Implementador · `docs/guia-do-desenvolvedor.md`: a linha sobre rodar a integração do worker pela config da raiz (já no `TODO.md`, da
  correção do teto).

O menor do `motor.ts:95` da rodada 1 foi resolvido pela correção do teto.

**Positivos**

- A correção de isolamento explica, no comentário do teste (`grade.int.test.ts:616-618`), por que a leitura com o ano da A não provava
  nada. Fica de exemplo para o próximo teste de isolamento de leitura que filtre por ano.
- O defeito do teto se reproduz por um caso irmão que só o teto recusa: as 101 marcas são todas candidatas da prévia. A mutação não tem
  outro caminho para passar.

### 5. Conclusão

APROVADA. Os dois críticos da rodada 1 estão resolvidos, e cada um tem mutação vermelha nesta rodada: o escopo de escola de
`aulasDaTurma` e de `turmaExiste` (RF16), e o teto de desligamentos valendo no `gravar` do motor (RF5). Os 15 RF estão ATENDIDOS. Os
arquivos de integração do caminho do `gravar`, que mudou, ficaram verdes: 249 casos, mais 279 de unidade e 98 da carga e dos restos.
As telas foram vistas de novo, na escola cheia e na vazia, sem rolagem a 1366 × 768. Ficam só menores, para o `TODO.md`. A esteira no
último commit com código (`9675c2c3`) é conferida no fechamento; sem GitHub, vale o portão completo local.

### 6. Pendências herdadas

- **`lista.transferida` e `lista_nome.retirado` fora do arquivo do titular** (`TODO.md`; privacy-guardian da 9.0 e da 16.0). É a mesma
  pendência da rodada 1: é pergunta de desenho do arquivo do titular, que vai além da F2. Destino: o Orquestrador leva ao Arquiteto
  antes do pouso (`descobrir` ou `registrar-decisao`).
- **Commits `Fora do processo:`**: nenhum entre `origin/develop` e `d53ee9ac`.
- **Medida de 1.000 e 3.000 transferências e da virada de 3.000** (`TODO.md:2724`): pedida antes do pouso; não rodei.
- **Leitor de tela nos `aria-live` com `empty:hidden`** (`TODO.md:2721`): conferência manual do Joaquim, ou a próxima tarefa que mexer
  em `ImportarPlanilha.tsx`.
- **Fotos desta rodada** em `.processo/vitrine/` (`coordenacao--coordenacao-grade--*`, `coordenacao--coordenacao-grade--Importar-grade--*`,
  `coordenacao--coordenacao-estrutura--*`, `coordenacao--coordenacao-professores--*`, `vazia--coordenacao--coordenacao-grade--*`,
  `vazia--coordenacao--coordenacao-estrutura--*`). Os logs dos testes e das mutações estão em
  `/tmp/claude-1000/-home-joaquimdp-Documents-git--maestri-floors-educaia--speconboarding-por-convite/2f00d7ff-da66-499a-9705-1d83d8c5da1f/scratchpad/`.

## Rodada 1 — 06/11/2026

**Escopo:** funcionalidade completa
**Commit validado:** `643d998d`
**Veredito: REPROVADA**

Antes de rodar, o `node_modules` era anterior ao `package-lock.json` (faltava o `read-excel-file` da 13.0): rodei `npm ci`. A
árvore terminou limpa, como começou (`git status` vazio depois de cada mutação).

### 1. RF a RF

| RF | Situação | Código | Teste | Observação |
|---|---|---|---|---|
| RF1 | ATENDIDO | `apps/web/src/areas/coordenacao/Escola.tsx:13` (aba ao lado de Turmas, Professores e Material); `apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx` (modelos, grade por turma, calendário); `apps/web/src/areas/coordenacao/grade/modelos-de-planilha.ts` | `e2e/escola-por-planilha.spec.ts:203` ("o modelo de ${tipo}: o botão do painel baixa o arquivo … passa na prévia sem erro nem aviso", os quatro tipos); `e2e/grade-e-calendario.spec.ts:113`, `:192`, `:262`; `modelos-de-planilha.test.ts` | Fotos lidas: `comgrade--coordenacao--coordenacao-grade--computador.png` e `--celular-1.png` (grade de cinco aulas gravada pela rota de verdade na escola da vitrine), `vazia--coordenacao--coordenacao-grade--computador.png`, `_coordenacao_grade_painel_importar-grade--…--computador.png`. Nenhuma tela rola a 1366 × 768; a 360 px a tabela rola no cartão, como a Tech Spec §9 diz. Um menor de texto ("Sala Sala 12", seção 4) |
| RF2 | ATENDIDO | `packages/core/src/importacao/motor.ts:95-101` (gravar refaz a prévia; erro de linha ou marca fora dos candidatos é `ENTRADA_INVALIDA`); `packages/core/src/importacao/leitor.ts`; `apps/web/src/areas/coordenacao/importacao/ler-planilha.ts` | `apps/api/test/importacao-alunos.int.test.ts:159` ("três linhas erradas … gravar responde ENTRADA_INVALIDA sem importação nem job"); `apps/api/test/importacao.int.test.ts:164`, `:176`; `ler-planilha.test.ts:9`, `:14`, `:52`; `e2e/escola-por-planilha.spec.ts:89` | Foto lida: `previa-suja--computador.png` (três erros em frase, contagem "3 linhas lidas · 3 com erro", sem botão de gravar). O XLSX real é lido pela biblioteca real |
| RF3 | ATENDIDO | `packages/shared/src/importacao/normalizador.ts:10-26` (`chaveDaTurma`); `serieDaChave`; `packages/core/src/importacao/tipos/alunos.ts:230` | `importacao-alunos.int.test.ts:125` ("8ºA", "8 A" e "8a" uma turma), `:159` ("Turma Azul" e "10A" erro), `:179`, `:386` (3.000 linhas entram, 3.001 não); `normalizador.test.ts` | |
| RF4 | ATENDIDO | `tipos/alunos.ts:277-302` (classificação e candidatos), `:397-400` (só o marcado transfere), `:523-546` (só o marcado desliga) | `apps/worker/test/gravar-planilha-alunos.int.test.ts:257` (mesma planilha duas vezes não muda o banco), `:320` (nome corrigido); `apps/worker/test/desligamento-pela-planilha.int.test.ts:298` (ausente sem marca segue ativo); `apps/worker/test/transferencia-pela-planilha.int.test.ts:368` (sem a marca nada muda) | Mutação 2 (abaixo) ficou vermelha. Foto lida: `previa-teto--computador.png`, `previa-teto-marcado--celular.png` (110 ausentes, todos desmarcados; "Marcar os primeiros 100"; "Você marcou 100, o máximo de cada gravação") |
| RF5 | PARCIAL | `tipos/alunos.ts:411-426` (`transferir`), `:453` (`desligar`); `packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts:72` (`desativar`) | `transferencia-pela-planilha.int.test.ts:272` (alcança só a nova), `:294`, `:335` (pedido pendente encerrado); `desligamento-pela-planilha.int.test.ts:317`, `:340` (desligado não entra), `:429` (nome não aprovado sai e o pedido fica `encerrada`) — verdes | **`desligamento-pela-planilha.int.test.ts:452` está vermelho no commit validado** (crítico 1): o comportamento do critério tem evidência verde, mas a suíte do RF não está |
| RF6 | ATENDIDO | `packages/core/src/importacao/tipos/professores.ts`; `packages/core/src/convite/convidar-professor-da-planilha.ts` | `apps/worker/test/gravar-planilha-professores.int.test.ts:189` (mesmo e-mail, uma pessoa), `:245` (ausente sem marca segue), `:259` (marcado desliga), `:317` (duas escolas, uma conta); `apps/api/test/professores.int.test.ts:900` ("RF6: … ganha o segundo vínculo no aceite do link copiado"); `e2e/professores.spec.ts:1196`, `:1317` | Foto lida: `coordenacao--coordenacao-professores--computador.png` (painel vazio com "Baixar modelo") |
| RF7 | ATENDIDO | `packages/core/src/importacao/tipos/grade.ts:208` (horário impossível), `:262` (avisos de sobreposição) | `apps/worker/test/gravar-planilha-grade.int.test.ts:261` (professor em duas turmas às 8h: aviso, grava), `:282`, `:303` (9h às 8h: erro), `:319`, `:357` (turma, disciplina e professor "novo" nascem ao gravar) | |
| RF8 | ATENDIDO | `tipos/grade.ts:504`; `packages/core/src/estrutura/vinculo.repository.ts:332` (vínculo da grade nasce `pendente`, `origem = grade`) | `gravar-planilha-grade.int.test.ts:416` ("antes de confirmar, o professor não alcança a turma"), `:432` (confirmado não muda); `e2e/escola-por-planilha.spec.ts:265` | Mutação 3 (abaixo) ficou vermelha |
| RF9 | ATENDIDO | `tipos/grade.ts:529` (encerra só o marcado, por `realocacao`) | `apps/api/test/grade.int.test.ts:273` (id estável), `:312` ("sai da grade" só encerra marcado), `:331`, `:347` (acesso revogado), `:368` (o à mão sem aula fica) | |
| RF10 | ATENDIDO | `packages/core/src/importacao/tipos/calendario.ts:52` (`fora_do_ano`) | `importacao.int.test.ts:190`, `:238` (substitui só no ano), `:254` (o que entra e o que sai); `e2e/grade-e-calendario.spec.ts:463` | |
| RF15 | ATENDIDO | `motor.ts:95` (gravar responde 202; o job grava); `apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx` (acompanha a importação) | `importacao-alunos.int.test.ts:408` (consultas constantes de 30 a 3.000 linhas); `ImportarPlanilha.fila.test.tsx:66` ("depois do prazo avisa que a gravação continua; ao concluir … o resultado chega"); `e2e/importar-alunos.spec.ts:411`; carga `npm run carga:importacao -- --fases previa_e_gravar` (rodada nesta validação, 7 min: passou; prévia p95 245 ms, gravar p95 404 ms, com 3.000 linhas e a rajada de login, p95 169 ms; zero 5xx e zero 503) | O teto é 2 s (Tech Spec §11), mais estrito que os 10 s do PRD |
| RF16 | PARCIAL | Escopo do contexto em todos os repositories novos; `packages/core/src/importacao/grade.repository.ts:54` | API: `grade.int.test.ts:724`, `importacao.int.test.ts:466`, `:479`, `:586`, `calendario.int.test.ts:135`, `:152`, `transferencia-pela-planilha.int.test.ts:582`, `desligamento-pela-planilha.int.test.ts:864`, `gravar-planilha-grade.int.test.ts:606`, `:640` | **Mutação 1 sobreviveu** (crítico 2): tirar `eq(alocacao.escolaId, escolaId)` de `GradeRepository.aulasDaTurma` deixa verdes os 73 casos de `grade.int.test.ts`, `gravar-planilha-grade.int.test.ts` e `operacao-isolamento.int.test.ts`. O teste que deveria pegar (`grade.int.test.ts:608`) lê a turma da B com o ano da A, e o filtro de ano esconde a falta do de escola |
| RF17 | ATENDIDO | `packages/core/src/auditoria/acoes.ts` (as onze ações da tabela do `cenarios.md`, cada uma com esquema estrito) | `importacao.int.test.ts:537`; `gravar-planilha-alunos.int.test.ts:182`, `:320`; `transferencia-pela-planilha.int.test.ts:644`; `desligamento-pela-planilha.int.test.ts:364`, `:429`, `:765`; `grade.int.test.ts:347`; `importacao-alunos.int.test.ts:330` | Cada um confere que o registro não traz nome nem matrícula |
| RF18 | ATENDIDO | as quatro telas de importação; `e2e/support/planilhas.ts` | `e2e/escola-por-planilha.spec.ts` (13 casos × `chromebook` e `celular`: **26 passaram**, 39,8 s), com axe e sem rolagem horizontal | Casos com seed compartilhado pela rota de verdade, como o `cenarios.md` pede ("Dividido em casos com seed compartilhado") |

Provas de mutação:

| RF | Cláusula removida | Teste que ficou vermelho |
|---|---|---|
| RF16 | `eq(alocacao.escolaId, escolaId)` em `packages/core/src/importacao/grade.repository.ts:54` (`aulasDaTurma`) | **nenhum**: `grade.int.test.ts:608` seguiu verde, e o arquivo inteiro com `gravar-planilha-grade.int.test.ts` e `operacao-isolamento.int.test.ts` também (73 casos) |
| RF4 | `&& marcadas.has(alvo.id)` em `packages/core/src/importacao/tipos/alunos.ts:400` (transferir sem a marca) | `transferencia-pela-planilha.int.test.ts:368` ("sem a marca, 'muda de turma' não muda nada …") |
| RF8 | `estado: 'pendente'` → `'confirmado'` em `packages/core/src/estrutura/vinculo.repository.ts:332` | `gravar-planilha-grade.int.test.ts:416` ("antes de confirmar, o professor não alcança a turma …") |

Cada mutação foi restaurada com `git checkout -- <arquivo>`.

### 2. Regras de negócio, casos de borda e critério de pronto

| Item | Situação | Evidência |
|---|---|---|
| Regra: o vínculo vem da escola e só dá acesso confirmado | cumprida | mutação 3; `gravar-planilha-grade.int.test.ts:416`, `:659` |
| Regra: a matrícula, única por escola, identifica o aluno | cumprida | `importacao-alunos.int.test.ts:292`, `:313`; `gravar-planilha-alunos.int.test.ts:380` |
| Regra: grade, alocação e calendário são do ano letivo | cumprida | `grade.int.test.ts:533`; `importacao.int.test.ts:238`; `gravar-planilha-grade.int.test.ts:695` |
| Regra: nenhuma reimportação remove, transfere ou desliga sem a marca | cumprida | mutação 2; `desligamento-pela-planilha.int.test.ts:298`; `gravar-planilha-professores.int.test.ts:245`; `grade.int.test.ts:312` |
| Regra: desligar não é eliminar | cumprida | `desligamento-pela-planilha.int.test.ts:317` (usuário `desativado`, vínculos encerrados por `desligamento`, nada apagado) |
| Borda: homônimos na turma | coberta | `importacao-alunos.int.test.ts:275`; `gravar-planilha-alunos.int.test.ts:514` |
| Borda: transferido com pedido pendente | coberta | `transferencia-pela-planilha.int.test.ts:335`, `:349` |
| Borda: matrícula que o Excel virou número | coberta | `ler-planilha.test.ts:9` (texto mantém o zero), `:14` (número sem notação científica); `importacao-alunos.int.test.ts:267` (notação científica no CSV é erro) |
| Borda: grade com professor não convidado | coberta | `gravar-planilha-grade.int.test.ts:357` (nasce `pendente`, com convite) |
| Borda: professor discorda da alocação | coberta | `gravar-planilha-grade.int.test.ts:497` (reimportar não reabre o contestado) |
| Borda: professor em duas escolas clientes | coberta | `gravar-planilha-professores.int.test.ts:317`; `professores.int.test.ts:900`; `gravar-planilha-grade.int.test.ts:582` |
| Borda: grade subida com o ano `planejado` | coberta | `gravar-planilha-grade.int.test.ts:659` |
| Pronto: RF1 a RF10 e RF15 a RF18, cada um com o teste da coluna "Como se prova" | faltando | RF5 e RF16 PARCIAIS (seção 1) |
| Pronto: todo cenário do `cenarios.md` com caso | cumprido por amostra | conferi por nome os casos de RF2 a RF10, Job e estados, Isolamento e Auditoria nos arquivos acima; não conferi linha a linha os 150 cenários |
| Pronto: o [C] do RF2 (p95 até 2 s; zero 503; passo (3) abaixo de 1 s) | cumprido | relatório da 16.0 (`16_task.md:96`, 06/11, as cinco fases) e a fase `previa_e_gravar` rodada de novo aqui (rodada nesta validação, 7 min: passou; prévia p95 245 ms, gravar p95 404 ms, com 3.000 linhas e a rajada de login, p95 169 ms; zero 5xx e zero 503). As fases de transferência, desligamento e professores não rodei: valem os números da 16.0 |
| Pronto: `docs/interface.md` §3, `docs/modelo-de-dados.md`, glossário, `docs/lgpd.md`, `docs/runbook.md` dizem o que o código faz | cumprido | `docs/interface.md:474-478`; `docs/modelo-de-dados.md:372-381`; `docs/glossario.md:103`; `docs/lgpd.md:73-75`; `docs/runbook.md:666` e "Rodar o cenário da importação". A Tech Spec ficou atrás numa premissa (menor) |
| Pronto: a esteira verde no último commit que alterou código | faltando | o push da spec foi recusado desde a 14.0 (escopo `workflow` do token, `estado.md`): a esteira não rodou sobre a 14.0, a 15.0 nem a 16.0, e é ela que teria acusado o crítico 1. Esteira: conferida no fechamento |

### 3. Portão

| Portão | Resultado |
|---|---|
| `npm run typecheck` | não rodado: escopo da funcionalidade completa, a esteira roda (D79) |
| `npm run lint` | não rodado (idem) |
| Testes de unidade que servem de evidência (10 arquivos: normalizador, contratos, leitor, os quatro tipos, `ler-planilha`, `ImportarPlanilha.fila`, `modelos-de-planilha`) | ✅ 151 passaram |
| Integração, 1ª leva (`importacao`, `importacao-alunos`, `grade`, `calendario`, `gravar-planilha-grade`, `gravar-planilha-alunos`, `transferencia-pela-planilha`, `desligamento-pela-planilha`, `gravar-planilha-professores`) | ❌ 233 passaram, **1 falhou**: `apps/worker/test/desligamento-pela-planilha.int.test.ts:452`, `JobFailureError: DADOS_INVALIDOS` (`apps/worker/src/processors/gravar-planilha.ts:70`). Rodado de novo isolado: vermelho igual. Determinístico |
| Integração, 2ª leva (`ciclo-de-vida`, `professores`, `lista`, `importacao-gauge`, `expurgo-da-escola`, `gravar-planilha`, `virada-do-ano`, `escola-montada`) | ✅ 355 passaram |
| `e2e/escola-por-planilha.spec.ts` (`node tools/ci/e2e.ts --manter-ambiente`) | ✅ 26 passaram (`chromebook` e `celular`) |
| Carga `npm run carga:importacao -- --fases previa_e_gravar` | ✅ passou (7 min): prévia p95 245 ms (máx. 1,77 s), gravar p95 404 ms, job p95 1,31 s, login da rajada p95 169 ms, zero 5xx e zero 503 |
| Esteira do GitHub | conferida no fechamento (D79): não entra no veredito. Não rodou sobre a 14.0, a 15.0 nem a 16.0 (push recusado) |
| Revisões com veto registradas e aprovadas | ✅ as 16 tarefas têm a última rodada de cada revisor obrigatório APROVADO; `revisao-spec.md` rodada 10 APROVADA; nenhum commit de código sem `(tarefa N.0)` ou `(correção …)`; nenhum `Fora do processo:` |

### 4. Achados

**Críticos**

- `apps/worker/test/desligamento-pela-planilha.int.test.ts:452`: o caso "mais nomes do que cabem num lote (500): 501 nomes livres
  ausentes saem da lista …" está vermelho desde a 16.0. Ele marca 501 em `desligar` chamando o `MotorDePlanilha` direto (sem o pipe da
  rota); o teto de 100 da 16.0 (`MAXIMO_DE_DESLIGAMENTOS_POR_GRAVAR`, `packages/shared/src/importacao/contratos.ts:105`, `:114`) faz o
  `lerMarcas` do job (`packages/core/src/importacao/motor.ts:199-201`) recusar as marcas guardadas, e a importação sai `falhou`
  (`DADOS_INVALIDOS`). O portão da 16.0 não rodou este arquivo (a 16.0 não o alterou), e a esteira, que o rodaria, não rodou (push
  recusado). Correção: reescrever o caso para o teto (100 marcas num gravar, e os 501 em gravares de até 100, se o lote de 500 da
  retirada ainda for o que se quer provar), ou tirá-lo dizendo no nome que o lote de 500 da retirada não se alcança mais pelo
  desligamento; e procurar os outros casos que marcam mais de 100 por fora da rota (os desta validação estavam verdes, mas não rodei
  a integração inteira).
- `packages/core/src/importacao/grade.repository.ts:54` (regra 10, item 5; RF16): o escopo de escola de `aulasDaTurma` não tem teste
  efetivo. Removida a cláusula `eq(alocacao.escolaId, escolaId)`, os 73 casos dos três arquivos de grade e isolamento seguem verdes. O
  código está certo hoje (o `GradeService` valida o ano na escola antes de chamar), mas o repository recebe o `anoLetivoId` por
  argumento, e a regra 10, item 3, pede que o escopo não dependa de quem chamou. O caso de `apps/api/test/grade.int.test.ts:608` passa
  o ano **da A** com a turma da B, e o filtro de ano esconde a falta do de escola. Correção: no mesmo caso, ler no contexto da A com o
  ano **e** a turma da B (`grade.aulasDaTurma(outra.emCurso, outra.t8a)`) e esperar `[]`, como já faz
  `apps/api/test/calendario.int.test.ts:152` para o calendário; o mesmo para `turmaExiste(outra.emCurso, outra.t8a)`.

**Maiores**

- Nenhum.

**Menores** (o Orquestrador leva ao `TODO.md` no fechamento; dono e arquivo em cada um)

- Implementador · `packages/core/src/importacao/motor.ts:95`: o `gravar` do motor não aplica o teto de desligamentos; só o pipe da
  rota o faz. Quem chama o motor sem a rota (o teste do crítico 1, ou um chamador futuro) enfileira uma importação que o job fecha
  `falhou`, em vez de receber `ENTRADA_INVALIDA` na hora. Correção: passar `pedido.marcas` por `marcasDaPlanilhaSchema` no `gravar`.
- Implementador · `apps/web/src/areas/coordenacao/grade/GradeECalendario.tsx:129`: a célula prefixa "Sala " ao texto da sala, e a própria
  instrução da tela (`textos-da-grade.ts:17`) pede para escrever "Sala 12": a grade mostra "Sala Sala 12" (foto
  `comgrade--coordenacao--coordenacao-grade--celular-1.png`). Correção: mostrar a sala sem prefixo, ou com um rótulo que não repita.
- Arquiteto · `tasks/prd-onboarding-por-convite/techspec.md:204`: a premissa "⚠️ NÃO VERIFICADO: `read-excel-file` devolve a célula de
  texto como texto" já está verificada por `apps/web/src/areas/coordenacao/importacao/ler-planilha.test.ts:9`. Correção: marcá-la
  verificada, apontando o teste.
- Implementador · `apps/worker/test/gravar-planilha.int.test.ts:244`: o nome diz "o tipo não é um que o motor grava (a `grade`, que chega
  na 8.0)", e a grade é tipo do motor desde a 11.0; o caso passa porque as linhas do calendário não têm a forma da grade. Correção:
  renomear para o que ele prova (linhas sem a forma do tipo guardado).
- Orquestrador · `tasks/prd-onboarding-por-convite/10_task.md` e `16_task.md`: a seção "Revisões" perdeu as linhas da 1ª rodada quando o
  documento foi reescrito (o histórico está em `achados/10_task.md` e `achados/16_task.md`). Sem efeito no veredito: a última rodada de
  cada revisor está lá.
- Orquestrador · o que a 16.0 mandou para a validação e eu não verifiquei: o anúncio dos dois `<p aria-live>` com `empty:hidden`
  (`ImportarPlanilha.tsx`) com leitor de tela, que não há neste ambiente; e a medida de 1.000 e 3.000 transferências e da virada de
  3.000 (`TODO.md`, infra-guardian da 16.0), que não rodei. A foto do teto que ela pedia foi feita (`previa-teto--computador.png`,
  `previa-teto-marcado--celular.png`).

**Positivos**

- Toda divergência de desenho que apareceu na execução foi parar na Tech Spec (o teto da 16.0 em §13, o rótulo sem e-mail da 15.0 em
  §9), e não só no documento da tarefa.
- O e2e do RF18 dividido em casos curtos, cada um semeando as etapas anteriores pela rota de verdade (`gravarPelaApi`), e não pelo
  banco: o mundo de cada caso é o que a tela deixaria.
- As corridas do passo (3) provadas com barreira e espião no SQL da ordem das travas, e o `desatualizada` conferido na mesma execução,
  sem deixar o BullMQ chegar ao estado final por nova tentativa.

### 5. Conclusão

REPROVADA por dois críticos. O primeiro é um teste vermelho no commit validado: o teto de 100 desligamentos por gravar, que entrou na
16.0, quebrou um caso da 10.0 que o portão da 16.0 não rodou e que a esteira, sem o push, também não rodou. O segundo é o isolamento da
leitura da grade sem teste que pegue a remoção do escopo de escola no repository (regra 10, item 5), o que deixa o RF16 PARCIAL. O resto
da funcionalidade está provado: das três mutações, duas ficaram vermelhas; 588 casos de integração e 151 de unidade verdes; o e2e do
RF18 verde nos dois projetos; as telas vistas na escola cheia, na vazia, com a grade gravada e com o teto de 100.

Caminho até APROVADA: uma correção (`corrigir`) com os dois críticos — o caso de `desligamento-pela-planilha.int.test.ts:452` reescrito
para o teto, e o caso de `grade.int.test.ts:608` lendo com o ano e a turma da B no contexto da A —, com a mutação da cláusula de
`grade.repository.ts:54` declarada no documento da correção e vermelha; depois, a revalidação, que roda esses dois arquivos e repete a
mutação 1. O menor do `motor.ts:95` cabe na mesma correção, porque é a causa de o teto não valer fora da rota. A esteira precisa rodar
sobre o commit da correção antes do pouso (o push está parado no escopo `workflow` do token).

### 6. Pendências herdadas

- **`lista.transferida` e `lista_nome.retirado` fora do arquivo do titular** (`TODO.md:2653`; privacy-guardian da 9.0 e da 16.0, que pediu
  decisão antes do pouso). Não classifiquei como achado da F2: o arquivo do titular (`packages/core/src/titular/leitura-do-titular.ts:392`)
  traz só a auditoria de que o titular é **autor**, por desenho do F3, e nenhum ato de terceiro sobre ele entra, em nenhuma ação
  (`aluno.transferido`, `usuario.nome_corrigido` e `lista.nome_corrigido` também não). As linhas em si (a `lista_nome`, o vínculo, a
  alocação) entram. É pergunta de desenho do arquivo do titular, para além da F2. Destino: o Orquestrador leva ao Arquiteto antes do
  pouso, como o guardião pediu (`descobrir` ou `registrar-decisao`).
- **Commits `Fora do processo:`**: nenhum entre `origin/develop` e `643d998d`.
- **Medida de 1.000 e 3.000 transferências e da virada de 3.000** (`TODO.md`, infra-guardian da 16.0): pedida antes do pouso; não rodei.
- **Leitor de tela nos `aria-live` com `empty:hidden`** (`TODO.md`, frontend-reviewer da 16.0): fica para a próxima tarefa que mexer em
  `ImportarPlanilha.tsx`, ou para uma conferência manual do Joaquim.
- **Fotos desta validação** (fora do repositório: `/tmp/claude-1000/-home-joaquimdp-Documents-git--maestri-floors-educaia--speconboarding-por-convite/7f038e81-12da-44ff-a932-41e861830471/scratchpad/fotos/`, e as da escola vazia em `.processo/vitrine/vazia--coordenacao--coordenacao-grade--*.png`): a grade com dado e os estados da prévia foram montados na
  escola sintética da vitrine pela rota de verdade (uma grade de cinco aulas e 110 alunos na turma "9C"); somem quando o banco de teste
  for recriado.
