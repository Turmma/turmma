# Achados das revisões — `tasks/correcoes/2026-11-08-credencial-matricula-campo-a-mais.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-08 20:37:03 · `tasks/correcoes/2026-11-08-credencial-matricula-campo-a-mais.md`

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
- A mudança está só nos testes, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/credencial/credencial-matricula.repository.int.test.ts`. Os três `toEqual` passam a esperar o formato que `doAlunoAtivo` devolve hoje (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/credencial/credencial-matricula.repository.ts:86-92`). Como os casos não têm provisória, o valor certo é `provisoriaExpiraEm: null`. As asserções continuam tão rígidas quanto antes, e nenhum código de produção, query, rota, fila ou migration mudou.
- Vale um caso no próprio teste do repository com a provisória ainda válida, conferindo que `provisoriaExpiraEm` volta preenchido. Também falta um caso com a provisória vencida, conferindo que volta `null`. Hoje o arquivo só cobre o `null`.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-08 20:37:03 · `tasks/correcoes/2026-11-08-credencial-matricula-campo-a-mais.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova. A correção só altera `apps/api/src/credencial/credencial-matricula.repository.int.test.ts` e não toca migration nem schema.

Queries verificadas: `CredencialMatriculaRepository.doAlunoAtivo` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/credencial/credencial-matricula.repository.ts:70-93`) não mudou. A escola vem de `requireEscolaId()`, que lê o contexto, e o filtro `eq(credencialMatricula.escolaId, escolaId)` está na linha 82. O join com `usuario` também casa `escolaId` (linha 81). Nenhum parâmetro do cliente decide o escopo. O campo `provisoriaExpiraEm` que o teste agora espera já era devolvido como `null` quando o hash é o da senha do aluno (linha 90), e é esse o caso dos três `toEqual`.

Teste de isolamento: presente e efetivo. Sem a cláusula da linha 82, a busca da matrícula de B com a escola A no contexto acharia a credencial, e o `toBeUndefined()` da linha 25 do teste ficaria vermelho. Se `requireEscolaId()` sair, o `rejects.toThrow('consulta com escopo sem escola no contexto')` da linha 27 também falha. A troca de `toEqual` com 3 campos por `toEqual` com 4 continua sendo igualdade completa, então a asserção não ficou mais fraca. Se o repository passar a devolver um campo a mais, como a matrícula, o teste continua vermelho.

Bloqueantes: nenhum

Recomendações:
- Este arquivo não testa o caminho da provisória vigente, em que `provisoriaExpiraEm` vem preenchido, com contexto forjado de outra escola. Se esse isolamento ainda não estiver nos testes da tarefa 10.0 (`paraATroca`, `trocarProvisoria`), vale um caso aqui: com a escola A no contexto, a provisória de um aluno de B dá `undefined`.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-08 20:37:05 · `tasks/correcoes/2026-11-08-credencial-matricula-campo-a-mais.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum novo. O teste passa a cobrir `provisoriaExpiraEm`, que o `CredencialDoAluno` já devolve desde a tarefa 10.0 (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/credencial/credencial-matricula.repository.ts:24`). Esse campo já está na tabela de dados do `docs/lgpd.md` (linha 81, senha provisória do aluno: validade e quem gerou, com finalidade, base legal e retenção).
Fora da tabela de dados do docs/lgpd.md: nada.
Autorização por objeto: ok. O caso de isolamento continua de pé: com o contexto forjado da escola A, a matrícula da B dá `undefined`, e sem escola no contexto a chamada dá erro. A correção só deixa a igualdade mais completa e não enfraquece nenhuma asserção.
Logs: limpos. A correção não acrescenta log nenhum.
Auditoria: não se aplica. É só teste e não cria ação auditável.
Envio externo: nenhum.
Seed/fixture: sintético. O hash é sintético e declarado como tal, a matrícula é `RA` seguida de um pedaço de UUID ou `3333` e `4444`, e as escolas e alunos saem de `SessaoFixtures`.
Bloqueantes: nenhum.
Recomendações:
- Os três `toEqual` só provam o caso `provisoriaExpiraEm: null`. Vale confirmar que o caminho com provisória vigente (o vencimento em texto e o `null` quando venceu) tem teste em algum lugar, de preferência neste mesmo arquivo do repository, para a esteira não descobrir de novo uma mudança no contrato. Fica para a retro da 10.0, que não rodou este arquivo no portão.

Arquivos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/credencial/credencial-matricula.repository.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-08-credencial-matricula-campo-a-mais.md`

## revisor-geral · 1ª rodada · APROVADO · 2026-11-08 20:37:09 · `tasks/correcoes/2026-11-08-credencial-matricula-campo-a-mais.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum
Recomendações:
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/credencial/credencial-matricula.repository.int.test.ts`, os três `toEqual` só cobrem a credencial com a senha do aluno, em que `provisoriaExpiraEm` é `null`. Falta, neste arquivo, cobrir os outros casos de `doAlunoAtivo` (`credencial-matricula.repository.ts:87-90`):
  - aluno sem senha e com provisória que ainda vale: `senhaHash` vem com o hash da provisória e `provisoriaExpiraEm` vem preenchido, como texto ISO com microssegundos;
  - provisória vencida: os dois campos vêm `null`.

  Hoje esses casos só aparecem de forma indireta em `apps/api/test/troca-da-provisoria.int.test.ts`. É cobertura extra e fica com o `test-engineer`, não bloqueia esta correção.
- Na seção "Causa" do documento, a 10.0 passou no portão sem rodar este arquivo, porque ele ficou de fora dos testes que a árvore dela alterou. Vale levar isso à retro: mudar o contrato de um repository deveria arrastar para o portão os `*.int.test.ts` vizinhos.

A correção confere com o código. `doAlunoAtivo` devolve `provisoriaExpiraEm: pelaProvisoria ? linha.provisoriaExpiraEm : null` (`credencial-matricula.repository.ts:90`). Os testes gravam `senhaHash` sintético, então `pelaProvisoria` é falso e o `null` esperado está certo. A asserção continua `toEqual` sobre o objeto inteiro e não ficou mais fraca. Nenhum código de produção mudou.

## test-engineer · 1ª rodada · APROVADO · 2026-11-08 20:37:24 · `tasks/correcoes/2026-11-08-credencial-matricula-campo-a-mais.md`

VEREDITO: APROVADO

**Cenários exigidos.** Esta correção só conserta um teste. O código de produção não muda e nenhuma regra nova entra. Por isso o que se exige é que:
- os dois casos que a esteira deu vermelho (run 42525745629) voltem a passar contra o contrato atual de `doAlunoAtivo`;
- a asserção continue tão forte quanto antes (`toEqual` exato, sem `toMatchObject` nem campo retirado);
- `null` seja o valor certo para o caso testado. O aluno tem senha própria, então o hash devolvido não é o da provisória, e `credencial-matricula.repository.ts:90` devolve `null` justamente quando `pelaProvisoria` é falso;
- os testes de isolamento e de eliminação agendada que já existiam continuem provando as regras deles.

**O que está coberto:**
- `apps/api/src/credencial/credencial-matricula.repository.int.test.ts:26`: o teste de isolamento continua provando que a escola A não acha a matrícula de B e que em B ela é achada. O resultado tem agora os quatro campos, e o caso de contexto sem escola continua sendo rejeitado.
- `apps/api/src/credencial/credencial-matricula.repository.int.test.ts:39-40`: o teste da eliminação agendada continua distinguindo `suspenso: true` de `suspenso: false`.
- Rodei `npx vitest run apps/api/src/credencial/credencial-matricula.repository.int.test.ts` e os 4 casos passaram.
- O `toEqual` exato ficou. Se o repository passar a devolver um campo a mais, um a menos ou com valor diferente, o teste quebra outra vez, que é o comportamento certo.
- Não há `.skip`, teste comentado nem mock. O banco é o Postgres real do compose de teste.
- A seção "Mutações" está certa. O diff só mexe em `*.int.test.ts`, então a RF17 não se aplica, e o `--faltando: 0` bate com o diff, que não tem cláusula nova.
- Não há IA nem concorrência envolvidas.

**Bloqueantes:** nenhum.

**Recomendações:**
1. O teste do repository só prova o ramo `provisoriaExpiraEm: null`. Faltam aqui os dois ramos que a tarefa 10.0 criou em `credencial-matricula.repository.ts:76-77,90`:
   - aluno sem senha com provisória vigente, em que o resultado traz o hash da provisória e o vencimento preenchido;
   - aluno sem senha com provisória vencida, em que `senhaHash` e `provisoriaExpiraEm` vêm `null`.

   Esses fluxos aparecem por HTTP em `apps/api/test/senha-provisoria.int.test.ts` e `apps/api/test/troca-da-provisoria.int.test.ts`. Mesmo assim, um caso de borda neste arquivo deixaria o contrato do repository provado na camada dele. Fica para a retro da 10.0, e não bloqueia esta correção.
2. Para a retro: o portão da 10.0 deixou esse vermelho passar porque só roda os testes de integração que o diff alterou. Mudar o tipo de retorno de um repository deveria puxar para o portão o `*.int.test.ts` vizinho, do mesmo nome. Hoje isso só é pego na esteira, como já descrito na seção "Causa" do documento.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-08-credencial-matricula-campo-a-mais.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/credencial/credencial-matricula.repository.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/credencial/credencial-matricula.repository.ts (só lido, para conferir o contrato)

## revisor-geral · 2ª rodada · APROVADO · 2026-11-08 20:49:11 · `tasks/correcoes/2026-11-08-credencial-matricula-campo-a-mais.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum
Recomendações:
- O caso novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/credencial/credencial-matricula.repository.int.test.ts:43-64` faz a correção que a Mesa pediu. Ele cobre os dois ramos do `case when` do repository (`credencial-matricula.repository.ts:76-77`):
  - **Provisória vigente:** o hash vem com o vencimento em texto ISO e microssegundos, e o valor esperado sai do mesmo `to_char` do banco, então não é inventado no teste.
  - **Provisória vencida:** `senhaHash` e `provisoriaExpiraEm` vêm `null`.
  
  Remover a condição `PROVISORIA_VIGENTE` deixaria o segundo `toEqual` vermelho.
- Falta um ramo: o aluno com senha própria e provisória vigente ao mesmo tempo. Hoje `gravarProvisoria` apaga a senha, então esse estado não aparece no fluxo, mas o repository decide qual hash vale. Se a recomendação for aceita, o destino é a retro ou a 10.0, não esta correção.

O documento da tarefa registra o caso novo na seção "Correção". As outras duas recomendações da rodada 1 aparecem em "Recomendações sem aplicar", cada uma com destino ou motivo. Nenhum código de produção mudou.

## test-engineer · 2ª rodada · APROVADO · 2026-11-08 20:49:35 · `tasks/correcoes/2026-11-08-credencial-matricula-campo-a-mais.md`

VEREDITO: APROVADO

**Cenários exigidos:** o pedido da rodada 1 era cobrir no próprio arquivo os dois ramos da provisória que o `doAlunoAtivo` monta:
- **Vigente:** o aluno não tem senha, e vêm o hash da provisória e o vencimento em texto.
- **Vencida:** `senhaHash` e `provisoriaExpiraEm` vêm `null`.

Os casos da rodada 1 continuam valendo: isolamento com contexto forjado, eliminação agendada, aluno desativado, credencial de quem não é aluno e matrícula repetida em outra escola.

**Cobertos:** os dois ramos, no caso `provisória (10.0): sem senha, o aluno vem com o hash e o vencimento da provisória que vale; com a provisória vencida, os dois vêm null`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/api/src/credencial/credencial-matricula.repository.int.test.ts:43-64`. Rodei o arquivo a partir da raiz: 5 de 5 passam.

Conferi se o caso novo falharia sem cada parte da regra:
- **Sem o `case when PROVISORIA_VIGENTE`** (`credencial-matricula.repository.ts:76-77`): o aluno da provisória vencida passaria a trazer o hash e o vencimento dela, e o `toEqual` da linha 63 fica vermelho.
- **Sem a escolha da provisória quando falta a senha** (`:86-90`): o aluno da provisória vigente viria com `senhaHash: null`, e a linha 62 fica vermelha. Se `provisoriaExpiraEm` fosse sempre `null`, a linha 62 também falha.
- **Se o `update` da bancada não achar a linha:** a senha sintética continua lá, e o `toEqual` cai do mesmo jeito. O `rows[0]?.texto` indefinido não deixa o caso passar à toa.
- **O vencimento:** o teste lê o texto com o mesmo `to_char` que o repository usa (`:10`), então a comparação é exata, até o microssegundo.
- **Relógio:** a margem é de +1 hora na vigente e de −1 minuto na vencida, contra o `clock_timestamp()` do repository. Não depende de máquina folgada nem de relógio falso.

O resto do documento:
- **Mutações:** nenhum código de produção mudou, e a linha `**Sem mutação:**` traz o motivo escrito, que vale (o arquivo alterado é só de teste).
- **Documento da correção:** a seção "Correção" cita o caso novo, e a tabela "Recomendações sem aplicar" diz o destino de cada uma das outras duas.
- **Proibições:** nenhum `.skip`, nenhum teste comentado, nenhum mock. A tarefa não envolve IA, e não há operação concorrente que pedisse teste em paralelo.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Gerar a provisória vigente pelo `gravarProvisoria`** (`credencial-matricula.repository.ts:259`) em vez do `update` direto da linha 53. Hoje o teste refaz à mão o efeito do `gravarProvisoria` (apagar `senha_hash`). Se esse método deixar de apagar a senha, este caso não percebe. A vencida continua precisando do `update` direto, porque o método fixa o vencimento sozinho. A correção cabe à tarefa 10.0, não a esta.
2. **Senha do aluno e provisória vigente ao mesmo tempo:** a regra de que a senha vale sozinha (`:89`) não tem caso. O comentário do teste diz que gerar a provisória apaga a senha, então esse estado não deveria acontecer. Mesmo assim, um caso curto mostraria que a provisória não entra quando o aluno tem senha. Vale como cobertura a mais, não bloqueia.
