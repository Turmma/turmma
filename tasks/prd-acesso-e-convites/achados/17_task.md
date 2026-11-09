# Achados das revisões — `tasks/prd-acesso-e-convites/17_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-09 12:16:28 · `tasks/prd-acesso-e-convites/17_task.md`

VEREDITO: APROVADO

A tarefa 17.0 não toca nada que a regra 70 governa. Ela cria a rota `GET /v1/usuarios/:usuarioId/senha-provisoria`, que é só leitura: devolve nome, turma, matrícula e se o aluno entra pela conta da escola. Não há IA, Nota, tutor, agente nem indicador de professor no diff. O `docs/regulacao.md` não foi alterado.

Caminhos de escrita em Nota: nenhum no diff. Nenhum arquivo alterado escreve em `Nota` ou `lancadaPor`. O repository só lê `usuario`, `credencial_matricula`, `conta_externa`, `vinculo` e `turma`. Todos com autor humano? Sim, porque não há caminho novo.

Decisão autônoma sobre aluno: ausente. A rota só lê e não muda a credencial; o teste em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/test/senha-provisoria.int.test.ts` confirma que não aparece provisória e que a senha antiga continua valendo. Nada mexe em aprovação, reprovação ou encaminhamento.

Aprovação registrada: ok. Não há saída de IA nesta tarefa. A exceção do tutor (D47) não é usada nem estendida.

Supervisão do tutor: ok, porque o tutor não é tocado.

Autonomia declarada e visível: sim, sem mudança. A tarefa não cria nem altera agente.

Os demais itens da auditoria:
- **Auditoria (item 6):** nada de IA para auditar. A nova ação `senha_provisoria.alvo_lido` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/packages/core/src/auditoria/acoes.ts` registra a leitura pela coordenação, na mesma transação da leitura, com finalidade fixa e sem nome nem matrícula. Isso cumpre a regra 20, item 10, e não conflita com a regra 70.
- **Vigilância (item 7):** nenhum dado de comportamento, ociosidade, navegação ou emoção. A resposta tem só quatro chaves e o schema `.strict()` recusa qualquer chave a mais.
- **Sem nota em discursiva e redação (item 8, D55):** nenhum campo, tela ou prompt novo.
- **Medir o professor (item 9, D45):** a leitura feita pelo professor da turma não grava registro e não vira métrica. Não há ranking, contagem por professor nem dado que a coordenação possa usar sobre ele. O registro da coordenação também fica fora do arquivo do titular (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/packages/core/src/titular/leitura-do-titular.ts`), então não forma perfil.

Bloqueantes: nenhum.

Recomendações: nenhuma da regra 70. Escopo e dado pessoal desta tarefa ficam com o `tenancy-guardian` e o `privacy-guardian`, que são os revisores obrigatórios dela.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-09 12:16:29 · `tasks/prd-acesso-e-convites/17_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nem migration. A rota lê `usuario`, `credencial_matricula`, `conta_externa`, `vinculo` e `turma`, e grava em `auditoria`. Todas têm `escolaId`, e `vinculo` e `turma` têm também `anoLetivoId`.

Queries verificadas:
- `CredencialMatriculaRepository.lerAlvo` e `#condicoesDoAlcance` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/src/credencial/credencial-matricula.repository.ts`:
  - A escola vem de `requireEscolaId()` e o ano de `requestSessao()`, ambos do token. Nenhum parâmetro do cliente decide o escopo.
  - Professor e coordenador como alvo são barrados por `papel = 'aluno'`. Aluno desativado ou com eliminação agendada também fica de fora.
  - O professor só alcança o aluno com vínculo `confirmado` dele e do aluno na mesma turma, no ano em curso (`#aTurmaEDoProfessor`).
  - Os joins com `credencial_matricula`, `conta_externa` e a subconsulta de `vinculo` e `turma` são presos por escola, ano e `usuario.id`.
- `#alunoQueAlcanca` (a seleção da geração) passou a reaproveitar as mesmas condições, sem mudar o comportamento.
- `SenhaProvisoriaService.lerAlvo`:
  - `alcanceDaGeracao` responde 404 ao aluno e à rede antes de ler qualquer coisa.
  - Quem não alcança o aluno recebe o mesmo 404 do id inexistente.
  - A auditoria `senha_provisoria.alvo_lido` é gravada só para a coordenação, na mesma transação da leitura, e leva o aluno como alvo e a finalidade fixa.
- Controller: usa `IdPipe` (id é UUID), sai com `no-store` e não aceita `escolaId` no corpo nem na query string.
- `leitura-do-titular.ts`: a `.alvo_lido` saiu da leitura do arquivo do autor e não entrou na lista por alvo. As duas leituras seguem com `t.escola_id = ${escolaId}`.
- Camada de rede: não alcança a rota, porque o `alcanceDe` dela para `senha_provisoria.gerar` não é `unidade` nem `turma_vinculada`, então ela recebe 404. Nenhuma consulta agregada foi tocada.
- `@Unscoped()`: não aparece.

Teste de isolamento: presente e efetivo. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/test/senha-provisoria.int.test.ts`, o caso "escopo: quem não alcança o aluno…" lê o aluno de B pelo contexto de A, pela coordenação e pelo professor. Tirando mentalmente `eq(usuario.escolaId, escolaId)` de `#condicoesDoAlcance`, o caso quebra: na coordenação a condição de turma vira `sql\`true\``, e o join da credencial usa a escola do próprio aluno, não a de quem lê. O aluno de B voltaria com 200 e o caso ficaria vermelho.

O mesmo raciocínio vale para as outras cláusulas:
- Professor de outra turma e vínculo pendente, contestado ou encerrado: cobertos.
- Desativado, eliminação agendada, professor ou coordenador como alvo e id fora do formato: todos comparados ao corpo do 404 do inexistente.
- Auditoria só da coordenação: caso próprio.
- `.alvo_lido` fora dos dois arquivos do titular: caso em `arquivo-do-titular.int.test.ts`.

Bloqueantes: nenhum.

Recomendações:
- `credencial-matricula.repository.ts`, subconsulta da `turma` em `lerAlvo`: o `.limit(1)` não tem `order by`. Se puder existir mais de um vínculo `confirmado` do aluno no mesmo ano (sem índice único que impeça), a turma mostrada é arbitrária. Vale confirmar a restrição única em `vinculo` ou ordenar de forma determinística.
- O caso "B pelo contexto da A" só usa aluno de B com credencial. Um segundo aluno de B só com `conta_externa` cobriria também o ramo `exists (ligada)` sob o mesmo escopo.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-09 12:16:56 · `tasks/prd-acesso-e-convites/17_task.md`

VEREDITO: APROVADO

Escopo: respeitado. As subtarefas 17.1 a 17.5 estão feitas. Não há tela (é da 12.0) e a geração não mudou.

Aderência à Tech Spec: ok. A implementação segue a seção 5 da `techspec.md` ("O alvo da provisória"), a linha 54 da tabela de rotas e o RF13 do `cenarios.md`:
- **Escopo:** a mesma célula `senha_provisoria.gerar` e a mesma seleção do alcance, extraída para `#condicoesDoAlcance` sem cópia.
- **Respostas:** 404 igual ao inexistente, `no-store` e contrato `.strict()` com as quatro chaves.
- **Auditoria:** `.alvo_lido` só para a coordenação, na mesma transação, sem `antes` nem `depois` e com finalidade fixa. Fica fora da lista por alvo e fora do arquivo de quem assina.
- **Proteção de dados:** a linha "Matrícula" do `docs/lgpd.md` já cobre a leitura.
- **Divergências:** a tarefa não declara nenhuma, e a opção A já está na Tech Spec e no `cenarios.md`.

Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)").

Bloqueantes: nenhum.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/src/credencial/credencial-matricula.repository.ts:249`: a turma sai de uma subconsulta com `.limit(1)` sem `orderBy`. O índice `vinculo_ativo_unico` (`packages/core/src/db/schema/vinculo.ts:64`) inclui `turmaId`. Por isso nada no banco impede dois vínculos `confirmado` de aluno em turmas diferentes no mesmo ano. Se isso acontecer, a turma mostrada muda de uma leitura para outra. Para o professor, pode aparecer uma turma que não é a dele. Vale um `orderBy` determinístico ou uma restrição de domínio declarada.
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/packages/core/src/titular/leitura-do-titular.ts:424`: com duas ações citadas no comentário, o "Ela chega ao aluno, sem o autor, pela leitura por alvo" ficou ambíguo. Pode parecer que a `.alvo_lido` chega ao aluno, e ela não chega. Diga explicitamente que é a `.gerada`.
3. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/test/senha-provisoria.int.test.ts:833`: o laço com `toBeLessThanOrEqual(1)` não prova nada que as três asserções `toEqual([])` logo abaixo já não provem. Remova ou troque pela contagem exata do `deB`, que deve ser 1 por causa da leitura da coordenação de B.
4. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/test/senha-provisoria.int.test.ts:911`: o caso "sem efeito" prova que a leitura não gasta a cota de 5 por dia por aluno. Não prova a de 60 por hora por usuário, que a tabela da tarefa cita: com 8 leituras e 5 gerações, o teste não chega perto do limite de 60. Deixo registrado para o `test-engineer`, porque é da área dele.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-09 12:17:01 · `tasks/prd-acesso-e-convites/17_task.md`

VEREDITO: APROVADO

Caminho quente tocado: nenhum. É uma leitura feita pela coordenação ou pelo professor antes de gerar a senha provisória. Não toca login, tutor, sala, prova, fila nem IA.

Rate limit: ok. A rota nova passa pela guarda global, que limita pelo usuário e pela escola do token (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/src/app.module.ts:155-161`). A leitura não usa a cota de geração e não passa pelo `HashBulkhead`, e o caso "sem efeito" prova as duas coisas.

Fila e prioridade: ok. Nada demorado acontece no request. A transação é curta: um `select` por chave e no máximo um `insert` em `auditoria`.

Concorrência: protegida.
- A leitura não segura trava de linha. O caso com `WriteBlockTrigger` mostra que ela responde enquanto uma geração está parada no meio (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/test/senha-provisoria.int.test.ts:906`).
- Um clique duplo grava dois `senha_provisoria.alvo_lido`. Isso é o comportamento pedido, um registro por leitura, e não há "busca, verifica, grava".

Índice e paginação: ok. Tudo é buscado por chave que começa pela escola, e a resposta é um único aluno, então não há o que paginar.
- `usuario`: por id, preso à escola.
- `credencial_matricula`: pelo único `(escola_id, usuario_id)`.
- `conta_externa`: pelo único `(escola_id, usuario_id)`.
- Turma do aluno: a subconsulta usa `vinculo_usuario_idx` `(escola_id, ano_letivo_id, usuario_id, estado)`.

Degradação de IA: não se aplica.

Migration: não se aplica. A ação nova fica fora da lista do índice parcial `auditoria_por_alvo_idx`, então o índice não muda.

Métrica e alerta: ok. Fora do caminho quente, o histograma HTTP geral basta (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/packages/core/src/telemetry/metrics.ts:239`). A tarefa não cria alerta.

Bloqueantes: nenhum.

Recomendações:
- A subconsulta da turma usa `.limit(1)` sem `order by`. Hoje só um vínculo do aluno fica `confirmado` por ano, e se isso deixar de valer a turma mostrada passa a ser arbitrária. Vale um comentário ou um `order by` estável quando a 12.0 usar o campo na tela.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-09 12:18:53 · `tasks/prd-acesso-e-convites/17_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nome, matrícula e turma do aluno, mais a marca booleana `entraPelaContaDaEscola`. Todos saem na resposta do `GET /v1/usuarios/:usuarioId/senha-provisoria`. A tarefa não cria coluna nem migration.

Fora da tabela de dados do docs/lgpd.md: nenhum. A linha "Matrícula" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/docs/lgpd.md:45`) já descreve esta leitura do jeito que foi implementada: um aluno por vez, coordenação ou professor com vínculo confirmado, `no-store` e auditoria `senha_provisoria.alvo_lido` sem a matrícula. Nenhum campo proibido para aluno aparece. O contrato `.strict()` recusa e-mail, hash, provisória, validade e quem gerou, e há teste que prova isso.

Autorização por objeto: ok.
- A leitura usa a mesma seleção da geração (`#condicoesDoAlcance`, `credencial-matricula.repository.ts:326-336`). A escola vem do contexto, o papel do alvo precisa ser `aluno`, e o desativado e o com eliminação agendada ficam de fora. O professor só lê aluno de turma em que tem vínculo confirmado no ano em curso.
- Fiz a troca de id em cada caso e todos dão 404 com o mesmo corpo do inexistente: aluno da escola B pelo contexto da A (coordenação e professor), professor de outra turma, vínculo pendente, contestado ou encerrado, professor ou coordenador como alvo, a própria pessoa como alvo, aluno lendo colega, id fora do formato (`IdPipe`) e aluno sem credencial nem conta da escola.
- Papel sem a célula (rede, aluno) cai no `alcanceDaGeracao` (`senha-provisoria.service.ts:158-161`), que também responde 404.

Logs: limpos. O diff não tem nenhuma chamada de logger.

Auditoria: presente.
- A leitura pela coordenação grava `senha_provisoria.alvo_lido` na mesma transação da leitura (`senha-provisoria.service.ts:462-471`). O alvo é o aluno, `antes` e `depois` são nulos e a finalidade é fixa (`FINALIDADE_DA_LEITURA_DO_ALVO`). O teste lê a linha inteira do banco e confere que ela não traz nome nem matrícula.
- A leitura pelo professor da turma não grava. A regra 20, item 10 só exige auditoria de leitura pela coordenação ou pela rede, e a leitura da lista de alunos pelo professor já funciona assim.
- A ação fica fora do arquivo do titular nas duas leituras (`leitura-do-titular.ts:427`), como a Tech Spec seção 5 decidiu. O caso usa uma sentinela que prova que o filtro tira só ela.

Envio externo: nenhum. A tarefa não tem IA nem envio a terceiro.

Seed/fixture: sintético ("Maria Sintética", "Joana Sintética", matrículas `prov-<uuid>`).

Pergunta de fechamento: o código responde. A auditoria responde quem leu o aluno, quando e para quê. O arquivo do titular continua trazendo a geração e o uso da provisória e deixa a leitura de fora, que é o que D85 e a Tech Spec definem.

Testes: rodei os testes unitários e de arquitetura (`senha-provisoria.test.ts`, `acoes.test.ts`, `porta-unica.test.ts`, `architecture.test.ts`, `contracts.test.ts`): 122 de 122 passaram. Nos de integração, todos os casos da 17.0 passaram em `senha-provisoria.int.test.ts` e em `arquivo-do-titular.int.test.ts`. Uma falha apareceu em `arquivo-do-titular.int.test.ts:1338` ("Meus dados" lista... no máximo 50). Esse caso não pertence à tarefa e passou nas duas vezes em que rodei o arquivo de novo (59 de 59), então parece instável.

Bloqueantes: nenhum.

Recomendações:
- `packages/core/src/titular/leitura-do-titular.ts:426`: depois que o comentário passou a falar das duas ações, o "Ela chega ao aluno, sem o autor" ficou ambíguo. Só a `.gerada` chega ao aluno; vale dizer isso pelo nome.
- O GET não tem limite por usuário. O enumerar fica preso ao escopo e, na coordenação, cada leitura vai para a auditoria, mas a leitura pelo professor não é registrada nem limitada. Cabe olhar pela regra 80 ou deixar escrito como risco aceito.
- A falha intermitente em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/test/arquivo-do-titular.int.test.ts:1338` (o pedido mais antigo apareceu entre os 50 mais novos) deve ir para o `TODO.md` antes que derrube a esteira.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-09 12:56:24 · `tasks/prd-acesso-e-convites/17_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Caminho feliz:** a coordenação e o professor da turma leem as quatro chaves, com `no-store`.
- **Bordas do domínio:**
  - dois alunos de mesmo nome, que se distinguem pela matrícula;
  - aluno transferido: a turma mostrada é a nova, e o professor da antiga recebe 404;
  - virada de ano: aluno só com vínculo num ano encerrado mostra `turma` nula;
  - escola sem ano em curso: a coordenação lê, o professor recebe 404;
  - conta da escola: só a conta, conta e senha, nenhuma das duas;
  - leitura depois de gerada não traz senha, hash, validade nem quem gerou.
- **Permissão:**
  - professor de outra turma, ou com vínculo pendente, contestado ou encerrado;
  - aluno lendo o colega;
  - professor ou coordenador como alvo;
  - id fora do formato, e chamada sem token (401).
- **Isolamento:** a escola B lida pelo contexto da A, pela coordenação e pelo professor.
- **Auditoria:** um `.alvo_lido` por leitura da coordenação; nenhum do professor nem do 404.
- **Sem efeito:** não gasta cota, não passa pelo semáforo, não toca a credencial e não espera a trava.
- **Concorrência:** a leitura acontece com uma geração parada no gatilho (`WriteBlockTrigger`), em paralelo de verdade.
- **Arquivo do titular:** a ação fica fora do arquivo do aluno e do da coordenação.

**Cobertos:** todas as linhas da tabela "Testes que provam a regra" têm caso com o nome citado.
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/test/senha-provisoria.int.test.ts`: os nove casos do bloco "a leitura do alvo (tarefa 17.0)".
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/packages/shared/src/sessao/senha-provisoria.test.ts`: "não aceita chave a mais". Rodei e passou, 6 de 6.
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/test/arquivo-do-titular.int.test.ts`: o caso da `.alvo_lido`, com a sentinela que mostra que a leitura por autor funciona.
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/test/architecture.test.ts`: a lista fechada.

Conferi os 21 blocos de mutação contra o cenário de cada um, e cada um chega à cláusula que tira. Os desenhos que garantem isso:
- a credencial inserida para professor e coordenador, para o `papel` decidir;
- o colega criado antes, para a junção e o `usuarioId` decidirem;
- o vínculo `encerrado` anterior;
- o aluno só com credencial, que segue com `false`.

Não há `.skip`. O `vi.spyOn` do semáforo só observa e é restaurado pelo `restoreAllMocks`. Não há IA nesta tarefa.

Não consegui rodar a integração aqui: o `docker compose` da infraestrutura de teste não subiu. Confiei na prova do portão.

**Bloqueantes:**
1. **`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/src/credencial/credencial-matricula.repository.ts:213`**, o `.where(this.#condicoesDoAlcance(usuarioId, alcance))` de `#alunoQueAlcanca`. O `--faltando` lista essa linha, e o motivo escrito em `17_task.md:271` está errado.
   - O motivo diz que, pela geração, a mutação não deixa caso vermelho, porque o `estadoDaProvisoria` filtra pela escola. Isso vale só para a cláusula da escola (o motivo da 9.0, `9_task.md:575`).
   - Tirar o `where` inteiro tira também o papel, o desativado, a eliminação agendada e o alcance do professor.
   - Sem ele, `alcancaAluno` e `travarAlunoParaProvisoria` devolvem qualquer linha de `usuario`. O `estadoDaProvisoria` (linha 296) não olha turma nem papel. Assim o professor de outra turma, ou com vínculo pendente, gera a senha.
   - O caso da 9.0 "professor com vínculo pendente, contestado ou encerrado na turma, e professor de outra turma: 404 igual…" ficaria vermelho, então o bloco é possível. Uma linha nova sem bloco e com motivo falso é bloqueante por si.
   - **Correção exigida:** trocar o motivo por este bloco e deixar o portão prová-lo:
     ```mutacao
     arquivo: apps/api/src/credencial/credencial-matricula.repository.ts
     teste: apps/api/test/senha-provisoria.int.test.ts › professor com vínculo pendente, contestado ou encerrado
     -    return this.banco.select({ id: usuario.id }).from(usuario).where(this.#condicoesDoAlcance(usuarioId, alcance)).limit(1)
     +    return this.banco.select({ id: usuario.id }).from(usuario).limit(1)
     ```

O outro motivo que o `--faltando` lista vale: o ramo `? sql null` da linha 235. Sem ele, o `eq(anoLetivoId, null)` não casa nenhuma linha e a turma sai nula do mesmo jeito.

**Recomendações:**
1. **60 por hora não provado:** a linha "sem efeito" (`17_task.md:51`) promete que a geração seguinte ainda tem as 60 por hora. O caso prova só a cota de 5 por dia: 7 leituras mais 5 gerações não chegam a 60. Ou reescrever a linha, ou provar também a cota por hora.
2. **"Em duas escolas":** a coluna "Caso" do escopo diz "cada linha da lista, em duas escolas", mas só a linha da escola B usa duas escolas. Ajustar o texto.
3. **Blocos da 9.0 sem contexto:** a extração para `#condicoesDoAlcance` mudou `.where(` e `and(` para `return and(`. Os blocos de `9_task.md:109-117` não acham mais o contexto. Se algo voltar a aplicar os blocos da 9.0, eles falham por carga. Registrar no `TODO.md` ou atualizar o contexto.
4. **Turma sem ordem:** a subconsulta da turma (`credencial-matricula.repository.ts:236-249`) usa `limit(1)` sem `order by`.
   - Um aluno com dois vínculos `confirmado` no mesmo ano receberia uma turma arbitrária. Se nenhuma restrição única impede isso, ordenar ou documentar.
   - O vermelho da mutação de `estado = 'confirmado'` também depende da ordem física: o vínculo `encerrado` foi inserido primeiro.
5. **Duas disciplinas:** falta um caso de leitura pelo professor que dá duas disciplinas na mesma turma. O `exists` compartilhado já é provado na geração (9.0), mas a leitura não tem o caso dela.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-09 13:11:25 · `tasks/prd-acesso-e-convites/17_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nesta rodada. As que `lerAlvo` lê (`usuario`, `vinculo`, `turma`, `credencial_matricula`, `conta_externa`) estão iguais à rodada 1.

Queries verificadas:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/src/credencial/credencial-matricula.repository.ts:233-251`, a subconsulta da turma em `lerAlvo`. O `.orderBy(asc(turma.nome), asc(turma.id))` só define qual turma aparece. O escopo continua igual: `doAluno.escolaId` e `doAluno.anoLetivoId` saem do token (`requireEscolaId()`, `requestSessao()`), e o join com `turma` exige a mesma escola e o mesmo ano. A consulta externa segue presa a `#condicoesDoAlcance`.
- A correção que pedi na rodada 1 foi feita: o `.limit(1)` agora tem `orderBy` antes, e o desempate por `turma.id` deixa o resultado sempre igual.

Teste de isolamento: presente e efetivo.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/test/senha-provisoria.int.test.ts:848-852`: o teste antes aceitava "no máximo 1" registro por alvo (`toBeLessThanOrEqual(1)` dentro de um laço). Agora exige exatamente uma `.alvo_lido` do aluno de B (`toHaveLength(1)`), e para os outros alvos continua exigindo lista vazia (`toEqual([])`).
- Se a leitura pelo contexto da escola A alcançasse o aluno de B e gravasse auditoria, haveria dois registros e o teste falharia. Os casos de 404 com corpo igual ao do inexistente não mudaram.
- O caso novo (linhas 778-791) testa só a ordem, sem tocar no escopo.

Bloqueantes: nenhum.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/test/senha-provisoria.int.test.ts:778-791`: a mutação que tira o `orderBy` só falha se o Postgres devolver primeiro o vínculo criado antes. Essa ordem física não é garantida. Vale o portão confirmar que o vermelho se repete em várias execuções. Se oscilar, troque a forma de criar os vínculos para que a ausência do `orderBy` dê vermelho sempre, por exemplo criando a turma de nome maior com o id menor.
- A recusa da Mesa à minha recomendação 2 da rodada 1 (caso de B pela A só com conta externa) está registrada com o motivo. Não reabro.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-09 13:11:31 · `tasks/prd-acesso-e-convites/17_task.md`

VEREDITO: APROVADO

Esta foi a 2ª rodada. Auditei só o diff `24f1700…` → `b5a1…` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/.processo/ordens/diff-17-r2.patch`) e o que ele afeta. O resto já tinha sido aprovado na 1ª rodada e não mudou.

Campos pessoais tocados: nenhum novo. A mudança só define qual turma do aluno aparece quando ele tem dois vínculos `confirmado` no ano. O DTO continua com as quatro chaves de antes: `nome`, `turma`, `matricula` e `entraPelaContaDaEscola`.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. O `.orderBy(asc(turma.nome), asc(turma.id))` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/src/credencial/credencial-matricula.repository.ts:249-250`) fica dentro da subconsulta que já está presa à escola, ao ano em curso, ao aluno, ao papel e ao vínculo confirmado. O `where` externo continua passando por `#condicoesDoAlcance`. Trocar o id na URL dá o mesmo 404 de antes.

Logs: limpos. O diff não acrescenta nenhum log.

Auditoria: presente. O teste ficou mais forte. Antes, o laço aceitava "no máximo 1" registro por alvo. Agora ele exige `toHaveLength(1)` para o `.alvo_lido` do aluno de B e `[]` para os casos de 404 (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/test/senha-provisoria.int.test.ts:848-852`). Assim, uma leitura da coordenação que não gravasse auditoria agora falha.

Envio externo: nenhum.

Seed/fixture: sintético. O caso novo usa aluno e turma criados pelo próprio teste (`sala.montar()`, "Maria Sintética").

Situação das recomendações da 1ª rodada:
- (1) Comentário ambíguo em `leitura-do-titular.ts`: aplicada. O texto agora diz que só a `.gerada` chega ao aluno e que a `.alvo_lido` não chega a ninguém além de quem a fez (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/packages/core/src/titular/leitura-do-titular.ts:424`). Bate com o filtro `not in (...)` logo abaixo.
- (2) Limite por usuário no GET e leitura do professor sem registro: recusada pela Mesa, com motivo escrito. Aceito o motivo. A regra 20, item 10, pede auditoria para leitura pela coordenação e pela rede, não pelo professor da turma. O limite pelo usuário e pela escola do token vem da guarda global citada pelo `infra-guardian`.
- (3) Falha intermitente em `arquivo-do-titular.int.test.ts:1338`: registrada no `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/TODO.md`.

Bloqueantes: nenhum.

Recomendações:
- Quando quem lê é o professor e o aluno está em duas turmas no ano, a turma mostrada é a primeira por nome, que pode não ser a turma desse professor. Não é vazamento: é dado da mesma escola e de um aluno que ele já alcança, e antes o resultado dependia da ordem física das linhas. Mesmo assim, mostrar ao professor a turma dele seria mais mínimo e mais útil para confirmar a identidade do aluno. Fica para a validação decidir.
- O caso novo confere a premissa `nomes[0] === nomeDaTurma(s.turma)` antes de testar a ordem. Isso é bom: se a fixture mudar os nomes, ele falha de forma explícita em vez de passar sem testar nada. Nada a corrigir.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-09 13:11:36 · `tasks/prd-acesso-e-convites/17_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. O contrato de `GET /v1/usuarios/:usuarioId/senha-provisoria` continua `{ nome, turma, matricula, entraPelaContaDaEscola }`, com `turma` como um único texto. Ordenar a subconsulta só torna essa escolha previsível e não muda a forma da resposta.
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

As quatro recomendações da 1ª rodada foram aplicadas:
- **(1)** Na subconsulta da turma, `.limit(1)` agora vem depois de `.orderBy(asc(turma.nome), asc(turma.id))`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/src/credencial/credencial-matricula.repository.ts:249-251`. O desempate pelo `id` garante uma única resposta mesmo com duas turmas de mesmo nome. O caso novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/test/senha-provisoria.int.test.ts:778-791` cria primeiro o vínculo da "2ºC" e depois o da "2ºB". Ele próprio confere que `s.turma` é a primeira por nome, então não depende de como o banco devolve as linhas sem ordem. O bloco de mutação que tira o `orderBy` está no documento.
- **(2)** O comentário em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/packages/core/src/titular/leitura-do-titular.ts:424` agora diz que só a `.gerada` chega ao aluno.
- **(3)** O laço com `toBeLessThanOrEqual(1)` virou `toHaveLength(1)` para o aluno de B, mantendo `toEqual([])` para os outros três alvos.
- **(4)** A linha "sem efeito" do documento agora promete só o que o caso prova: a cota de 5 por dia por aluno. A de 60 por hora saiu da promessa.

O bloco de mutação novo sobre `#alunoQueAlcanca` substitui o motivo falso que foi removido. As duas linhas novas no `TODO.md` vêm com dono e motivo.

Recomendações:
- Na tabela de cenários do `17_task.md` (linha "escopo" ou uma linha própria), citar o caso "o aluno com dois vínculos confirmados…". Hoje ele só aparece no bloco de mutação, e quem lê a tabela não vê que existe uma regra para escolher a turma mostrada.
- No `cenarios.md` e na techspec, registrar numa frase que, com dois vínculos confirmados no ano, a leitura do alvo mostra a primeira turma por nome. O contrato não muda, mas a regra hoje só existe no código e no teste.

## test-engineer · 2ª rodada · REPROVADO · 2026-11-09 13:12:34 · `tasks/prd-acesso-e-convites/17_task.md`

VEREDITO: REPROVADO

Cenários exigidos (o que esta rodada mudou):
- A correção exigida na 1ª: um bloco de mutação no `.where(this.#condicoesDoAlcance(...))` de `#alunoQueAlcanca`.
- A ordem da turma quando o aluno tem dois vínculos `confirmado` no ano em curso.
- A asserção mais forte do `.alvo_lido` no caso de escopo.
- O comentário de `leitura-do-titular.ts`.

Cobertos:
- **Correção 1, feita.** O bloco está em `17_task.md` e aponta o teste "professor com vínculo pendente, contestado ou encerrado…" (`senha-provisoria.int.test.ts:235`). Sem o `where`, `alcancaAluno` e a trava devolvem verdadeiro para qualquer usuário. O professor pendente da mesma escola passa pelo `estadoDaProvisoria`, gera, recebe 200 e não o 404 do inexistente. O vermelho vem da cláusula certa. O motivo falso saiu da lista.
- **O `toHaveLength(1)` de `deB`** (`senha-provisoria.int.test.ts:849`) é mais forte que o laço `<= 1` de antes. Ele prova a gravação do registro na leitura da coordenação de B, e os outros três alvos continuam com `toEqual([])`.
- **TODO.md** recebeu as duas linhas da tabela "Recomendações sem aplicar". As recusas têm motivo e eu as aceito.
- Rodei `npx vitest run apps/api/test/senha-provisoria.int.test.ts -t "dois vínculos confirmados no ano em curso"`: passou (1 passou, 43 pulados). Não confirmei o vermelho da mutação com o banco. Segundo o Implementador, o portão deu vermelho, e não repeti a mutação.

Bloqueantes:
1. **`apps/api/test/senha-provisoria.int.test.ts:778-791`** ("o aluno com dois vínculos confirmados…"). O teste não separa o critério "por nome" de "por id". O vermelho do bloco novo depende de qual índice o banco escolhe.
   - **Por quê:** `escola-turma.fixture.ts:31-32` cria a "2ºB" antes da "2ºC". O id é UUID v7, então a ordem por id e a ordem por nome coincidem.
   - **Primeiro efeito:** trocar `.orderBy(asc(turma.nome), asc(turma.id))` (`credencial-matricula.repository.ts:250`) por `.orderBy(asc(turma.id))` deixa o teste verde. A cláusula `asc(turma.nome)`, que é a regra que o nome do caso promete ("a primeira turma por nome"), fica sem prova.
   - **Segundo efeito:** o vermelho do bloco que tira a linha inteira só acontece se o banco ler o vínculo em ordem de inserção. Isso acontece por varredura sequencial ou pelo `vinculo_usuario_idx`, em que as chaves iguais saem em ordem física de gravação. Se o banco escolher o índice parcial `vinculo_ativo_unico` (`vinculo.ts:64-66`), que termina em `turma_id`, ou entrar pela chave primária da turma, a "2ºB" sai primeiro mesmo sem `orderBy`, e a mutação fica verde. Com o banco de teste acumulando milhares de escolas, a escolha pode mudar entre o portão local e a esteira. A regra 40 já avisa que o id v7 "não é a ordem de negócio".
   - **Correção exigida:**
     - No caso, criar uma terceira turma no mesmo ano depois das outras, com nome que venha antes por nome (por exemplo "2ºA"). O id dela é o maior, e o vínculo dela deve entrar no meio ou por último. Assim nem a ordem de inserção nem a ordem por id dão a resposta certa, e o caso espera "2ºA".
     - Manter o bloco que tira a linha.
     - Acrescentar um segundo bloco em `17_task.md` que troque a linha por `.orderBy(asc(turma.id))`, com o mesmo teste, e deixar o portão provar os dois.

Recomendações:
- **`packages/core/src/titular/leitura-do-titular.ts:82`:** o comentário novo diz que a `.alvo_lido` "não chega a ninguém além de quem a fez". Mas a consulta por autor logo abaixo também a exclui do arquivo do próprio coordenador, e o teste da tabela "arquivo do titular" prova justamente isso. Texto mais fiel: "não chega ao arquivo de ninguém; fica só na auditoria".

Arquivos citados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/test/senha-provisoria.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/src/credencial/credencial-matricula.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/test/escola-turma.fixture.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/packages/core/src/db/schema/vinculo.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/tasks/prd-acesso-e-convites/17_task.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/packages/core/src/titular/leitura-do-titular.ts`

## revisor-geral · 3ª rodada · APROVADO · 2026-11-09 13:29:51 · `tasks/prd-acesso-e-convites/17_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

Nesta rodada o código de produção não mudou. A ordem que a leitura usa continua em `credencial-matricula.repository.ts:250` (`.orderBy(asc(turma.nome), asc(turma.id))`). O caso novo de três turmas em `senha-provisoria.int.test.ts:778-798` prova que a turma mostrada é a primeira por nome, e não a primeira criada nem a de menor id. Os vínculos entram na ordem 2ºC, 2ºA, 2ºB, então as duas mutações dão vermelho por motivos diferentes:
- sem o `orderBy`, a leitura devolve a 2ºC;
- com o `orderBy(asc(turma.id))` do bloco novo, devolve a turma de menor id (`s.turma`).

As premissas também são conferidas no caso: o menor id é `s.turma` e a `outraTurma` se chama "2ºC". A mudança em `leitura-do-titular.ts` é só um comentário, e o que ele diz bate com o filtro `not in (...)` da consulta. A linha nova do `TODO.md` vem do achado do `privacy-guardian`, com dono, e não muda o contrato agora.

Recomendações:
- `apps/api/test/senha-provisoria.int.test.ts:778`: o título diz "dois vínculos confirmados", mas o caso agora cria três. Trocar por "três vínculos confirmados" (ou "mais de um"). A mudança vale também para o seletor do bloco de mutação no `17_task.md`, que casa pelo prefixo do título.
- `apps/api/test/senha-provisoria.int.test.ts:785`: o comentário diz que `s.turma` é a "2ºB", mas o nome dela não é conferido como o da `outraTurma` (linha 795). Basta incluir `expect(await nomeDaTurma(s.turma)).toBe('2ºB')` entre as premissas para o comentário não mentir se a fixture mudar.
- As da 2ª rodada continuam valendo (citar o caso na tabela de cenários; registrar a regra no `cenarios.md` e na Tech Spec). Já estão em "Recomendações sem aplicar", com destino.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/test/senha-provisoria.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/src/credencial/credencial-matricula.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/packages/core/src/titular/leitura-do-titular.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/tasks/prd-acesso-e-convites/17_task.md

## test-engineer · 3ª rodada · APROVADO · 2026-11-09 13:30:07 · `tasks/prd-acesso-e-convites/17_task.md`

VEREDITO: APROVADO

Cenários exigidos (nesta rodada, a correção 1 da 2ª): o aluno tem dois ou mais vínculos confirmados no ano em curso. A leitura do alvo tem de mostrar a primeira turma por nome. Não serve a primeira linha física, nem a primeira criada, nem a de menor id. Cada critério errado tem de deixar o teste vermelho por conta própria.

Cobertos:
- **O caso das três turmas** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/test/senha-provisoria.int.test.ts:778-798`) cumpre a correção 1.
  - A "2ºA" é criada pela API depois das turmas da fixture, então tem o maior id (UUID v7).
  - Os vínculos entram na ordem 2ºC, 2ºA, 2ºB. A primeira linha física é a 2ºC, o menor id é a 2ºB, e só a ordem por nome dá a 2ºA, cujo vínculo fica no meio.
  - O teste confere as premissas antes de conferir o resultado: o menor id é o da `s.turma` (linha 789, com asserção na 794) e a `outraTurma` se chama "2ºC" (linha 795). Se a fixture ou o gerador de id mudarem, ele falha nessas linhas e não passa sem provar nada.
  - A asserção final é sobre o resultado (`turma` igual a "2ºA"), e não sobre o código ter rodado.
- **O bloco que tira a linha do `orderBy`** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/tasks/prd-acesso-e-convites/17_task.md:276-281`) continua, e o vermelho dele já não depende da sorte. A ordem física possível devolve a 2ºC (pela tabela de vínculos) ou a 2ºB (pela tabela de turmas), e nenhuma das duas é a 2ºA esperada.
- **O segundo bloco, que troca a ordem por `.orderBy(asc(turma.id))`** (`17_task.md:283-288`), foi acrescentado. Ele devolve a 2ºB, que a premissa da linha 794 garante ser a de menor id, então fica vermelho pelo motivo certo: o cenário chega à cláusula. O contexto do bloco bate com `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/apps/api/src/credencial/credencial-matricula.repository.ts:250`.
- **A recomendação da 2ª foi aplicada.** O comentário em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l3/packages/core/src/titular/leitura-do-titular.ts:424` agora diz que a `.alvo_lido` não chega ao arquivo de ninguém e fica só na auditoria da escola.
- O código de produção não mudou nesta rodada. Não há `.skip`, teste comentado nem mock novo.

Não consegui rodar o teste aqui. O vitest parou antes de abrir o arquivo, com "Failed to resolve entry for package @educa/core", porque o `@educa/core` não está compilado neste andar. Não compilei, porque isso escreveria arquivos na árvore que os outros revisores estão usando. O verde do caso e o vermelho das 24 mutações ficam pela palavra do portão (`tools/processo/mutacoes.ts`), segundo o Implementador.

Bloqueantes: nenhum.

Recomendações:
- O caso não confere que a `s.turma` se chama "2ºB". A ordem esperada só se sustenta porque nenhuma das duas turmas da fixture tem nome antes de "2ºA". Um `expect(await nomeDaTurma(s.turma)).toBe('2ºB')`, junto às outras premissas, deixaria a dependência escrita.
- O teste não fixa o vermelho do bloco que tira o `orderBy` em todas as execuções. Ele só ficaria verde se o banco percorresse as turmas por um índice de nome, o que é improvável com tabelas tão pequenas. O desenho já é o que a rodada anterior exigiu, e não reprovo por isso.
- A linha que o `privacy-guardian` pôs no `TODO.md` ("a turma do professor") está registrada para a validação decidir. A decisão muda o contrato da leitura, e quando ela sair o caso precisa ganhar a variante com o professor lendo.
