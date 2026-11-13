# Achados das revisões — `tasks/correcoes/2026-11-13-e2e-envio-sem-serie.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-13 15:15:58 · `tasks/correcoes/2026-11-13-e2e-envio-sem-serie.md`

VEREDITO: APROVADO
Tabelas verificadas: nenhuma tabela nova nem migration. A correção só altera o ajudante de teste `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/e2e/support/professor-flow.ts`. A série que ele marca é a que `criarAlocacaoDoProfessor` grava em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/e2e/support/seed.ts:523-528`, com `escola_id` da própria escola do teste (7º ano do Ensino Fundamental).
Queries verificadas: nenhuma query, repository ou endpoint foi alterado. O diff só acrescenta a marcação da série no diálogo pela interface, como usuário autenticado da própria escola. Nenhum `escolaId` sai do cliente e não há `@Unscoped()`.
Teste de isolamento: não se aplica. Não há módulo, repository nem endpoint novo. O isolamento do envio por série é da tarefa 7.0 e não mudou aqui.
Bloqueantes: nenhum
Recomendações:
- `SERIE_DA_ESCOLA` repete por texto o nome que `seed.ts:523-528` grava. Se o seed mudar a série, o teste quebra sem mostrar a causa. Vale exportar o nome da série junto com a alocação, como `criarTurmaComNomeNoBanco` já faz com `serieNome`.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-13 15:16:01 · `tasks/correcoes/2026-11-13-e2e-envio-sem-serie.md`

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
- O rótulo `'7º ano do Ensino Fundamental'` agora está escrito à mão em três lugares: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/e2e/support/professor-flow.ts:18` (`SERIE_DA_ESCOLA`), `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/e2e/material.spec.ts:20` (`SERIE_DA_ESTRUTURA`) e a constante `SERIE` de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/e2e/roteiro-da-demonstracao.spec.ts`. Vale exportar uma constante só do ajudante de `e2e/support` que cria a série com `criarAlocacaoDoProfessor`. Assim, quando a série semeada mudar, os três testes acompanham juntos.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-13 15:16:01 · `tasks/correcoes/2026-11-13-e2e-envio-sem-serie.md`

VEREDITO: APROVADO

Escopo: respeitado. A correção só altera `montarEscolaEEntrar` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/e2e/support/professor-flow.ts`, como o documento descreve. Nenhum outro spec de `e2e/` abre o diálogo "Enviar material" por fora desse ajudante. Os que abrem o diálogo diretamente (`material.spec.ts:144`, `:368`, `:718` e `roteiro-da-demonstracao.spec.ts:350`) já marcam a série.

Aderência à Tech Spec: ok. A correção não toma decisão nova. Ela só acompanha no ajudante a exigência de série que a tarefa 7.0 já criou. O rótulo `'7º ano do Ensino Fundamental'` é o mesmo que `material.spec.ts:20` usa e o mesmo que o seed cria (`e2e/support/seed.ts:608`).

Portão local: carimbo válido (`node tools/processo/portao-local.ts conferir` aceitou o código atual com typecheck, lint, segredo, dependências, unidade e alvo).

Bloqueantes: nenhum.

Recomendações:
- `e2e/support/professor-flow.ts:17` e `:57`: a mesma explicação aparece duas vezes, no JSDoc da constante e no comentário da linha que marca a caixa. Basta uma.
- `e2e/support/professor-flow.ts:18`: o mesmo rótulo de série agora está em três constantes separadas (`SERIE_DA_ESCOLA` aqui, `SERIE_DA_ESTRUTURA` em `material.spec.ts:20` e `SERIE` no roteiro). Vale exportar uma só de `e2e/support/seed.ts`, junto de quem cria a série. Assim, se o nome mudar, a correção é feita num lugar só.
- No processo: a 7.0 alterou o diálogo e atualizou dois specs, mas não o ajudante comum, e o problema só apareceu na esteira. Para a retro: quando uma tarefa muda um formulário, vale procurar em `e2e/` todo lugar que o preenche, incluindo os ajudantes em `support/`.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-13 15:16:00 · `tasks/correcoes/2026-11-13-e2e-envio-sem-serie.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A correção acrescenta uma constante de texto com o nome de uma série ('7º ano do Ensino Fundamental'), que é um dado de estrutura da escola e não de pessoa. Também acrescenta um clique no checkbox da série dentro do ajudante `montarEscolaEEntrar` do e2e. Nenhuma migration, DTO, rota, repository nem código de `apps/*/src` ou `packages/*/src` foi alterado.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. Nenhuma rota foi criada ou alterada. O ajudante só preenche o diálogo como a professora da própria escola semeada.

Logs: limpos. O diff não acrescenta log.

Auditoria: presente. Nenhuma ação desta correção a exige: não há leitura de aluno por coordenação ou rede, exportação, nota, permissão nem aprovação de saída de IA.

Envio externo: nenhum. A correção não chama provedor de IA nem serviço de terceiro.

Seed/fixture: sintético. A série vem de `criarAlocacaoDoProfessor` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/e2e/support/seed.ts:525`, `'ef_anos_finais', 7`), e o nome confere com a constante `SERIE_DA_ESCOLA` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/e2e/support/professor-flow.ts:18`). O material enviado é o PDF de demonstração, com licença "Autoria da escola ou de professor dela" e a declaração marcada, como já era antes. Não entra dado real.

Bloqueantes: nenhum.

Recomendações:
- O texto `'7º ano do Ensino Fundamental'` está fixo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/e2e/support/professor-flow.ts:18`, separado do insert em `seed.ts:525`. Se `criarAlocacaoDoProfessor` devolvesse o nome da série, como `governanca.ts` já faz com `serieNome`, a constante e o seed não poderiam ficar diferentes sem ninguém perceber. Não afeta a privacidade; fica registrado para a retro.

Pergunta de fechamento: esta correção não muda o que o sistema guarda sobre aluno nem para onde isso é enviado. A resposta continua sendo a do arquivo do titular, que já existia.

## test-engineer · 1ª rodada · APROVADO · 2026-11-13 15:16:06 · `tasks/correcoes/2026-11-13-e2e-envio-sem-serie.md`

VEREDITO: APROVADO

**Cenários exigidos:** esta correção não cria regra nova. O ajudante `montarEscolaEEntrar` precisa preencher o diálogo "Enviar material" do jeito que a tarefa 7.0 passou a exigir, com pelo menos uma série marcada, para que os sete casos de `e2e/a2-assistente.spec.ts` (:52, :139, :174) e `e2e/a3-a4-professor.spec.ts:22` voltem a chegar a "Pronto · 6 páginas", no chromebook e no celular.

**Cobertos:**
- **Teste que falharia sem a linha:** o próprio e2e. O documento registra o vermelho sem a correção (`professor-flow.ts:60`, "element(s) not found" após 45 s, nos dois projetos) e o verde com ela (8 passed). Não rodei o e2e: ele é pesado e a regra desta auditoria é não pôr a máquina sob carga. A causa é coerente com o código. O diálogo barra o envio sem série, e o ajudante era o único uso do diálogo em `e2e/` que não marcava série. `material.spec.ts:144/368/718` e `roteiro-da-demonstracao.spec.ts:350` já marcam.
- **Série certa:** `criarAlocacaoDoProfessor` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/e2e/support/seed.ts:523-527`) cria a série `ef_anos_finais`, ano 7. O rótulo "7º ano do Ensino Fundamental" é o mesmo que `material.spec.ts:20` e `acesso-da-turma.spec.ts:64` usam para essa série.
- **Asserção sobre o resultado:** continua a de `professor-flow.ts:60`, o material pronto com 6 páginas. Não é só conferir que o código rodou.
- **Ausência de mutação:** está justificada. A correção não toca `apps/*/src` nem `packages/*/src`, então não há cláusula nova sem bloco.
- Nenhum `.skip`, nenhum teste comentado, nenhum mock novo e nenhum provedor de IA envolvido.
- Isolamento, permissão e concorrência não se aplicam: o diff só acrescenta um clique num ajudante de teste.

**Bloqueantes:** nenhum.

**Recomendações:**
1. O mesmo rótulo de série está escrito à mão em vários lugares de `e2e/`: `SERIE_DA_ESCOLA` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/e2e/support/professor-flow.ts:18`), `SERIE_DA_ESTRUTURA` (`material.spec.ts:20`), `SERIE_DA_TURMA` (`acesso-da-turma.spec.ts:64`), além dos literais em `a3-a4-professor.spec.ts:29` e `senha-provisoria.spec.ts:80/426`. Uma constante exportada junto de `criarAlocacaoDoProfessor` em `seed.ts` deixaria a série semeada e o rótulo da tela num lugar só. Se a semente mudar de série, hoje o e2e falha por timeout em vários arquivos, em vez de falhar num lugar só.
2. Para a retro da 7.0: a tarefa mudou uma exigência do formulário e atualizou só os specs que abrem o diálogo diretamente, sem procurar os ajudantes de `e2e/support/` que também o preenchem. Vale pôr na lista de conferência da tarefa uma busca pelo nome do diálogo em `e2e/` quando um formulário passa a exigir campo novo.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-13 15:26:56 · `tasks/correcoes/2026-11-13-e2e-envio-sem-serie.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. Nesta rodada só mudou o comentário que explica a série em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/e2e/support/professor-flow.ts`, e isso não toca a arquitetura.
Portão local: carimbo válido. O `conferir` passou com typecheck, lint, segredo, dependências, unidade e alvo.
Bloqueantes: nenhum
Recomendações: nenhuma nova.
- A recomendação barata da 1ª rodada foi aplicada. A explicação da série aparecia duas vezes e agora fica só no JSDoc de `SERIE_DA_ESCOLA`, em `professor-flow.ts:17`. O comentário de linha antes do `.check()` saiu.
- As outras duas recomendações estão na seção "Recomendações sem aplicar" de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/tasks/correcoes/2026-11-13-e2e-envio-sem-serie.md`, com destino. Exportar a constante única da série a partir de `seed.ts` vai para o `TODO.md`. Procurar em `e2e/` todo lugar que preenche um formulário quando ele passa a exigir campo novo vai para a retro da spec. Os dois destinos são adequados.
