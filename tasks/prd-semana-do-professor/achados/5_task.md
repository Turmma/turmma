# Achados das revisões — `tasks/prd-semana-do-professor/5_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-06 23:29:17 · `tasks/prd-semana-do-professor/5_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova e nenhuma migration nesta tarefa. A tabela `aula` já existia (tarefa 4.0) e tem `escola_id`, `ano_letivo_id` e `vinculo_id`, com FK composta.

Queries verificadas (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/semana/texto-acompanha-a-grade.repository.ts`):
- `acompanhar`: a escola vem de `requireEscolaId()`, isto é, do contexto do job. Nenhum método recebe escola. O ano é o de destino da planilha, que o motor resolve.
- `travarVinculos`: a chave da trava é `hashtext(escolaId || vinculoId)` e a classe é `CHAVE_DA_TRAVA_DO_VINCULO_DA_AULA`. Ela só serializa e não lê dado. Uma colisão de hash entre escolas só faria uma esperar pela outra, sem vazar nada.
- `rechavear` (`update aula`): filtra por `escola_id` vindo do contexto, `ano_letivo_id`, `vinculo_id`, dia da semana e início velho. O `not exists` fica preso a `ocupada.escola_id = a.escola_id`.
- `apagarOFuturo` (`delete from aula`): filtra por `escola_id` vindo do contexto, `ano_letivo_id`, `vinculo_id`, dia, início velho e `data >= hoje`.
- `ImportacaoRepository.acompanharOTextoDaAula` exige `requireEscolaId()` e repassa a transação do passo (3).
- A tarefa não cria endpoint nem rota, então nenhum `escolaId` entra por corpo ou query string. Não há `@Unscoped()`, e o diff não toca consulta da camada de rede.
- O guarda `tools/guardas/repositories-com-escopo.test.ts` e a unidade `packages/core/src/semana/texto-acompanha-a-grade.repository.test.ts` passaram (58 casos).

Teste de isolamento: presente e efetivo. Está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/apps/api/test/semana-reimportacao.int.test.ts`.
- J6 (linha 500) usa duas escolas reais. Ele também planta, com `session_replication_role = replica`, linhas com a escola de B sobre o vínculo e o ano de A. Sem `a.escola_id = escolaId` no `update` ou no `delete`, essas linhas se moveriam ou seriam apagadas, e o `toEqual` das linhas 522 a 526 quebraria.
- J15 (linha 534) faz o mesmo para o ano: planta linhas com o ano em curso sobre o vínculo do planejado. Sem o `ano_letivo_id`, o teste quebraria.
- J2, J3 e J4 provam a cláusula do vínculo com uma colega no mesmo dia e horário.
- O documento da tarefa declara as mutações de cada uma dessas cláusulas.

Bloqueantes: nenhum.

Recomendações:
- `texto-acompanha-a-grade.repository.ts:920`: o `not exists` não filtra `ocupada.ano_letivo_id`. Não causa dano hoje, porque o vínculo pertence a um ano só e `(vinculo_id, data, inicio)` é único. Mesmo assim, incluir o ano deixaria a cláusula coerente com as outras, caso essa unicidade mude um dia.
- `importacao.repository.ts` (`acompanharOTextoDaAula`): o `requireEscolaId()` está ali só como guarda, porque o repository chamado já resolve a escola sozinho. Vale um comentário de uma linha dizendo isso, ou tirar a chamada, para ninguém ler que o escopo vem desse ponto.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-06 23:29:17 · `tasks/prd-semana-do-professor/5_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. O diff não toca `Nota`, correção nem `lancadaPor`. O passo novo só faz `update` e `delete` na tabela `aula`, que guarda o texto livre da professora sobre a aula. Todos com autor humano? Não se aplica, porque não há escrita em `Nota`.

Decisão autônoma sobre aluno: ausente. O passo muda o horário do texto da aula ou apaga as datas de hoje em diante quando a aula sai da grade. Ele roda por causa de uma reimportação que a coordenação assinou, com a prévia sem erro e a mesma assinatura (`packages/core/src/importacao/motor.ts:266`). Nada nele decide sobre a trajetória de aluno.

Aprovação registrada: ok. Nesta tarefa não há saída de IA. O `aula.conteudo` é escrito pela professora e, pelo `packages/core/src/db/schema/aula.ts:19-20`, nunca vai à IA. A exceção do tutor (D47) não aparece.

Supervisão do tutor: ok. O tutor não é tocado.

Autonomia declarada e visível: sim, sem mudança. Nenhum agente é criado ou alterado.

Itens 7 a 9:
- **Item 7:** nenhuma medição de comportamento, tempo ou navegação.
- **Item 8 (D45):** o texto da professora não vai à coordenação. O J9 prova que o resumo, a prévia e a auditoria da reimportação não citam o registro nem contam quantos foram mexidos (`apps/api/test/semana-reimportacao.int.test.ts`, caso `J9:`). O docblock em `packages/core/src/semana/texto-acompanha-a-grade.repository.ts:79-80` diz o mesmo.
- **Item 8 (D46/D55):** não há nota, campo ou prompt sobre discursiva ou redação.

Bloqueantes: nenhum.

Recomendações:
- Fora da regra 70, para produto: quando a coordenação reimporta a grade, o job apaga o texto que a professora já escreveu para as próximas datas de uma aula que saiu sem par. Pelo J9, nenhum resumo menciona isso. É o certo para não expor o texto à coordenação (D45), mas a professora também não fica sabendo que perdeu o que escreveu. Vale avaliar um aviso só a ela na Semana, sem contagem para a coordenação, porque perder trabalho sem ver é o tipo de coisa que tira a confiança dela no produto.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/semana/texto-acompanha-a-grade.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/importacao/tipos/grade.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/importacao/importacao.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/importacao/motor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/importacao/tipo.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/apps/api/test/semana-reimportacao.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/tasks/prd-semana-do-professor/5_task.md

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-06 23:29:40 · `tasks/prd-semana-do-professor/5_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: só `aula.conteudo`, o texto da professora, que pode citar aluno por ser texto livre. O passo re-chaveia `inicio` e `fim` e apaga linhas. Não lê o conteúdo, não o devolve e não o copia para outro lugar. Nenhuma coluna nem tabela nova. `MudancaDaGrade` e `AulaDaGrade` levam só o id do vínculo, o dia da semana e o horário (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/semana/texto-acompanha-a-grade.repository.ts:7-18`).

Fora da tabela de dados do docs/lgpd.md: nenhum campo. A linha de `aula` já existe em `docs/lgpd.md:75`, mas a retenção dela está incompleta (primeira recomendação).

Autorização por objeto: ok. A tarefa não cria rota. O passo roda dentro do job. A escola vem de `requireEscolaId()` e o ano é o de destino da planilha. O `update` e o `delete` filtram por escola, ano, vínculo, dia e início. O conjunto travado e a mudança só levam vínculos que já existiam (`vinculo?.tipo !== 'existente'` em `grade.ts`). J6 e J15 plantam linhas com a escola de B e com o ano em curso sobre o vínculo de A, e as mutações que tiram a escola e o ano de cada comando estão declaradas. Os casos J11a e J12 confirmam que o PUT (da 4.0) continua respondendo `NAO_ENCONTRADO` quando a aula já saiu.

Logs: limpos. Não há linha de log nova em nenhum arquivo do diff.

Auditoria: presente onde a regra exige. A ação auditada continua a mesma: `planilha.gravada`, mais as do vínculo. O J9 compara duas escolas, uma com texto e outra sem, e prova que prévia, resumo e auditoria saem iguais e sem o texto-sentinela (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/apps/api/test/semana-reimportacao.int.test.ts:578-609`). Isso segue o que o PRD e a Tech Spec decidiram (D64, techspec §7 e §11).

Envio externo: nenhum. O passo não chama IA nem fila externa.

Seed/fixture: sintético. Nomes e e-mails são gerados com `PREFIXO` e terminam em `@professores.invalid`. Os textos são rótulos como "plantada", "quarta futura" e o sentinela.

Pergunta de fechamento: o código responde. A `aula` já entra no arquivo do titular, só na versão completa, pelo `vinculo_id`. O passo novo só apaga ou move registros e não cria destino novo para o dado.

Bloqueantes: nenhum.

Recomendações:
1. `docs/lgpd.md:75`, coluna de retenção da `aula`, e `tasks/prd-semana-do-professor/techspec.md`, §7, linha "Retenção e expurgo": falta um caminho de eliminação antecipada. Ao reimportar a grade, a aula que sai sem par perde o texto das datas de hoje em diante (hoje no fuso de Brasília). O texto das datas passadas fica até a virada do ano. Hoje o mapa só cita a virada e a cascata com o vínculo. Com isso, a resposta à secretaria sobre por que um texto deixou de existir fica sem base no documento. Não bloqueia: o dado sai antes do previsto, não fica mais tempo, e RF14 e techspec §5 já registram a decisão.
2. A §11 da Tech Spec registra o desvio do item 10 da regra 20, mas não o do item 15: o `delete` do passo apaga de fato e não é auditado linha a linha. A justificativa é a mesma do J9 e da D64, e vale escrevê-la junto do desvio que já está lá.
3. Dois comentários dizem "o dia do fuso da escola": `importacao.repository.ts`, no docblock de `acompanharOTextoDaAula`, e `texto-acompanha-a-grade.repository.ts:88`. Mas `diaDeUso` usa um fuso fixo, `America/Sao_Paulo` (`packages/core/src/usage/usage-day.ts:5`). Trocar para "o dia de Brasília", como já dizem a Tech Spec e o J8.

Arquivos auditados (todos em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/`):
- `packages/core/src/semana/texto-acompanha-a-grade.repository.ts`
- `packages/core/src/importacao/tipos/grade.ts`
- `packages/core/src/importacao/importacao.repository.ts`
- `packages/core/src/importacao/motor.ts`
- `packages/core/src/importacao/tipo.ts`
- `apps/api/test/semana-reimportacao.int.test.ts`

## revisor-geral · 1ª rodada · APROVADO · 2026-11-06 23:29:53 · `tasks/prd-semana-do-professor/5_task.md`

**VEREDITO: APROVADO**

**Escopo:** respeitado. As subtarefas 5.1 a 5.4 estão feitas. A tarefa não mexe no PUT, não tem tela e não toca no `index.ts` do `core`. Ela altera três arquivos que não estão em "Arquivos previstos": `motor.ts`, `tipo.ts` e `importacao.repository.ts`. A mudança está declarada como divergência.

**Aderência à Tech Spec:** ok. A divergência (o "hoje" vem de `ExecucaoOptions.relogio`, entregue no `AmbienteDaGravacao`, e a classificação entrega `aulasQueSaemGravadas`) está registrada em três lugares:
- no `5_task.md`;
- na `techspec.md`, §2 (tabela de módulos) e §5 ("Reimportar a grade");
- no `cenarios.md`, J8.

O código segue a §5 e a §7c:
- **Posição e escopo:** o passo fica entre `gravarAulas` e `encerrarOsMarcados`. A escola vem de `requireEscolaId()` e o ano é o de destino.
- **Trava:** todas as travas saem num comando só, na ordem de `hashtext(escolaId‖vinculoId)`. Essa chave casa com a de `AulaRepository.travarVinculo` (os dois converteem o id com `::uuid::text`).
- **Pareamento:** por (vínculo, dia), na ordem de início.
- **Re-chaveamento:** move o início e o fim, com `not exists` para o início novo já ocupado.
- **Apagar:** usa `data >= hoje` com o dia de Brasília.
- **Lotes:** de 500.
- **Assinatura:** continua a de antes.

O `fim` que fica velho na aula que só mudou de fim é o que a §3 manda ("a troca só do fim na grade não a atualiza").

**Portão local:** carimbo válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo). O `mutacoes.ts --faltando` responde que nenhuma linha nova de produção com condição fica sem bloco.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/importacao/importacao.repository.ts:544`, o `requireEscolaId()` de `acompanharOTextoDaAula` repete o que `TextoAcompanhaAGradeRepository.acompanhar` já faz na primeira linha. A própria tarefa diz (motivo 5) que a chamada só serve de escopo. Pode sair, ou ficar com uma linha que diga por que fica.
2. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/semana/texto-acompanha-a-grade.repository.ts:110-111`, a ordem das travas depende do `order by` de uma subconsulta que o select de fora lê. O Postgres a mantém na prática, mas o padrão SQL não garante isso. Há um teste que prova a ordem ("as travas saem na ordem da chave"). Mesmo assim, vale uma linha no docblock dizendo que a ordem depende desse comportamento do planejador e que esse teste a guarda.
3. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/importacao/tipos/grade.ts:521`, o comentário cita a "ordem global" pela seção 7c. Seria mais fácil de achar se citasse também o caso J16, que é o teste que prova essa ordem.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-06 23:30:32 · `tasks/prd-semana-do-professor/5_task.md`

```
VEREDITO: APROVADO
Caminho quente tocado: fila
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/tasks/prd-semana-do-professor/5_task.md:103 — a autoconferência remete ao "EXPLAIN da próxima seção", e essa seção não existe. Rodei o EXPLAIN do `update` (texto-acompanha-a-grade.repository.ts:122) no banco de teste, com `seqscan` e `bitmapscan` desligados. O plano é nested loop sobre o VALUES. A busca da linha e o `not exists` descem pelo índice `aula_vinculo_data_inicio_unico (vinculo_id, data, inicio)`. Escola e ano entram como filtro, sem índice próprio. Não bloqueia: o vínculo já pertence a uma só escola pela FK composta, e o `aula_semana_idx` começa pelo escopo. Vale registrar esse plano na tarefa ou na §7c da techspec, ou trocar a frase por "não há EXPLAIN novo".
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/semana/texto-acompanha-a-grade.repository.ts:110 — cada vínculo afetado toma uma trava consultiva, e todas ficam na mesma transação, ocupando a tabela de travas compartilhada (`max_locks_per_transaction` × conexões). Com dez escolas de 300 vínculos isso cabe com folga. Falta escrever na techspec qual é o teto de vínculos por reimportação, para a rede pública não estourar sem ninguém ver (erro 53200, que atinge todas as escolas).
- O comando que toma as travas espera cada uma até 1 s (`lock_timeout`), mas o comando inteiro só pode durar 1,5 s (`statement_timeout`). Se duas esperas se somarem, sai `57014`. O job repete do mesmo jeito, mas na última tentativa o erro é gravado como `erro_interno`, não como `trava_esgotada` (apps/worker/src/processors/gravar-planilha.ts:66). Vale classificar o `57014` desse passo como falha de trava.
```

## test-engineer · 1ª rodada · APROVADO · 2026-11-06 23:32:12 · `tasks/prd-semana-do-professor/5_task.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:** J1 (a aula que continua mantém o texto) e J2 (a que só muda de horário leva o texto, com o fim novo).
- **Borda:** J3 (sai sem par: apaga de hoje em diante, o passado fica), a aula que continua com o fim mudado ao lado de uma que sai, J4 (colisão com um registro fora da grade), J5 (aula dupla em ordem invertida), saem duas e entra uma, a aula que muda de dia, J7 (a mesma grade duas vezes), J8 (22h de Brasília), J10 (feriado novo no calendário) e J15 (ano planejado, para a virada).
- **Lote:** 504 aulas que mudam de horário e 504 que saem, ou seja, mais de um lote de 500.
- **Privacidade:** J9 (resumo, prévia e auditoria iguais aos de uma escola sem registro, e o texto-sentinela ausente).
- **Isolamento:** J6, com a escola B real e as linhas plantadas com a escola de B sobre o vínculo de A.
- **Transação única:** a falha injetada em `encerrarOsMarcados`.
- **Concorrência:** J11a, J11b, J12 e J16 com a ordem forçada, um caso por direção; o mesmo job entregue duas vezes (D49); o conjunto travado; a ordem das travas.
- **Permissão:** a tarefa não cria rota nem endpoint. O passo roda com a escola do job (`requireEscolaId()`), e a permissão do `PUT` é da 4.0. J13 e J14 também são da 4.0 (`4_task.md:61-62`).

**Cobertos:**
- **Tabela de testes:** as 22 linhas têm o seu caso, achado pelo nome em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/apps/api/test/semana-reimportacao.int.test.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/semana/texto-acompanha-a-grade.repository.test.ts` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/packages/core/src/importacao/tipos/grade.test.ts`. Os itens juntados por ponto e vírgula também estão todos lá: o caso do fim mudado no J3, os testes de unidade de dia e de vínculo, e o caso da ordem das travas.
- **Mutações contra o `git diff`:** cada termo novo tem bloco. Isso cobre:
  - a chave e as ordenações de `parear`;
  - o conjunto travado, dos dois lados;
  - a classe, a chave e a ordem da trava;
  - cada termo do `where` do `update` e do `delete`, os campos do `set` e os três termos do `not exists`;
  - o `>=` de hoje, os dois lotes e o "hoje" de UTC;
  - a ordem do passo contra a trava e contra `encerrarOsMarcados`;
  - os dois termos de `mudancaDaGrade`, `aulasQueSaemGravadas` e o relógio do motor.
- **`--faltando`:** `node tools/processo/mutacoes.ts --faltando` diz que nenhuma linha nova fica sem bloco.
- **Os seis termos sem bloco:** cada um tem o motivo escrito e eu concordo com eles. O efeito da transação única é provado pelo caso da falha injetada.
- **Motivo do vermelho:** conferi cada cenário. Todos chegam à cláusula e ficam vermelhos pelo motivo certo, inclusive o J16: `executarPlanilha` lança o erro, e quem repete é a fila (`apps/worker/src/processors/gravar-planilha.ts:40`), então "a primeira tentativa" fica de fato provada.
- **Asserções:** todas leem o resultado. São as linhas de `aula` e de `alocacao`, o estado do vínculo e da importação, a resposta do `PUT` e as travas em `pg_locks`. Nenhuma confere só que o código rodou.
- **Proibidos:** não há `.skip`, nem teste comentado, nem mock que esconda a regra. O `gravacaoFalsa` do `grade.test.ts` só testa a classificação, e todo o resto é integração com Postgres real e o job real.
- **IA:** a tarefa não chama IA.
- **Unidade:** rodei os dois arquivos de teste de unidade (o de `parear` e o `grade.test.ts`): 44 de 44 verdes.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **O conjunto travado lê as travas do banco inteiro.** O `travasConcedidas()` (`semana-reimportacao.int.test.ts:229-232`) pega toda trava concedida daquela classe, de qualquer escola, e o caso das linhas 786-819 compara com `toEqual` exato. A integração roda um arquivo por vez, mas qualquer outro processo no mesmo banco de teste segurando essa classe (outra linha do Maestri, outro revisor rodando a integração) deixa o caso vermelho por acaso. Melhor filtrar pelas chaves dos vínculos daquela escola, ou pelo `pid` do job parado no gatilho.
2. **A janela de 1 s do `lock_timeout`.** J11a e J12 fazem um `PUT` por HTTP dentro dessa janela, com o job parado numa espera de trava. O J16 faz o insert e o commit também dentro dela. Se falhar, o teste fica vermelho, nunca verde por engano. É o padrão prescrito (`importacao-alunos.int.test.ts:455-470`), mas fica registrado como fonte possível de falha intermitente com a máquina carregada.
3. **D49 em sequência.** O caso do job entregue duas vezes roda as duas entregas uma depois da outra. A corrida de verdade já está provada no motor (`apps/worker/test/gravar-planilha.int.test.ts:134`). Uma variante com `Promise.all` sobre `rodar` daria a mesma prova no passo novo, com custo baixo.
4. **Aula dupla deslocada um tempo.** Exemplo: 07:30 e 08:20 viram 08:20 e 09:10. Pela Tech Spec, a das 08:20 "continua" e o texto das 07:30 vai para as 09:10, então os textos trocam de ordem. É o comportamento da spec, mas não tem caso que o declare. Fica para a validação decidir se é o esperado e, se for, ganhar um caso.
5. **Professora com duas disciplinas na mesma turma.** São dois vínculos no mesmo dia e início, e falta um caso de integração que mostre que o texto de um não vai para o outro. Segue aberto no `TODO.md`, como a própria tarefa registra.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-06 23:51:56 · `tasks/prd-semana-do-professor/5_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (`portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)`)
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/apps/api/test/semana-reimportacao.int.test.ts:815`: o caso "só os vínculos que já existiam" agora só olha as travas da escola dele (o filtro `daEscola`). A lista inclui a trava da Wanda, então o caso ainda pega a trava de um vínculo que não muda. Já o vínculo que a reimportação cria (Xuxa na 8º B) ficou fora do filtro: se ele tomasse uma trava com o id de verdade, o caso não veria mais. Isso não fura a regra hoje. O bloco de mutação da tarefa para esse caso troca o id pela chave da tripla (o vínculo novo ainda não tem uuid), e o SQL recusa a chave como `uuid`. O job falha e o caso fica vermelho do mesmo jeito. A sugestão que o test-engineer deu na 1ª rodada, filtrar pelo `pid` do job parado no gatilho, provaria as duas coisas sem depender desse erro. Fica para quando alguém mexer no caso.

O que conferi nesta rodada:
- As sete partes da ordem `.processo/ordens/5_task-r1.md` foram feitas como a ordem pediu:
  - o comentário do `requireEscolaId()`;
  - "dia de Brasília" nos dois docblocks;
  - a linha que liga a ordem das travas ao `order by` e ao caso que a prova;
  - a citação do J16 em `grade.ts`;
  - o parágrafo do EXPLAIN no `5_task.md`;
  - a retenção na `docs/lgpd.md` e na §7 da techspec, mais a linha nova do item 15 da regra 20 na §11;
  - o filtro de `travasConcedidas`.
- A nova linha da §11 só diz o que J9 e D64 já dizem e aponta para o J9 do `cenarios.md`. Não cria divergência nova.
- As recomendações que mandaram para o `TODO.md` estão lá: as três da 5.0 e o acréscimo na linha da 4.0. A tabela "Recomendações sem aplicar" do `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/tasks/prd-semana-do-professor/5_task.md` é a mesma da ordem.
- Nenhuma cláusula de produção nova; o diff mexe em código só em comentários e no teste.

## test-engineer · 2ª rodada · APROVADO · 2026-11-06 23:51:58 · `tasks/prd-semana-do-professor/5_task.md`

VEREDITO: APROVADO

**Cenários exigidos (2ª rodada, só o diff):** o filtro novo em `travasConcedidas` tinha de manter vermelhas as mutações do "conjunto travado" e da "ordem da chave", sem deixar o banco compartilhado entre execuções sujar o resultado. As correções exigidas na 1ª rodada eram nenhuma, e a recomendação 1 (filtrar pelas chaves da escola) foi aplicada.

**Cobertos:**
- **Lista das chaves da escola** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l2/apps/api/test/semana-reimportacao.int.test.ts:232-238` e `:815`). O teste passa à consulta as chaves dos quatro vínculos que já existiam: Xuxa, Yuri e Zezé, que devem travar, e Wanda, que não deve. Se a Wanda travar, o resultado traz a chave dela e o `toEqual(esperadas)` falha. Se Yuri ou Zezé ficarem de fora (blocos em 5_task.md:202 e :211), falta uma chave e o caso fica vermelho. Os dois casos continuam provados.
- **Travas de outras escolas** no mesmo banco de teste deixam de entrar na comparação. A chave inclui o `escolaId` no `hashtext`, então só uma colisão de 32 bits confundiria duas escolas, o que é desprezível.
- **Ordem da chave** (`:847`). Com o filtro em `[menor, maior]`, a mutação de 5_task.md:258, que tira `distinct` e `order by`, continua vermelha: a maior espera e a menor não chega a ser concedida.
- **Rodei** `npx vitest run apps/api/test/semana-reimportacao.int.test.ts -t "o conjunto travado"`: 2 casos verdes.
- O resto do diff é comentário, a nova linha do registro da aula em `docs/lgpd.md` e a Tech Spec com o `EXPLAIN`. Não há cláusula nova sem bloco, nem `.skip` ou teste comentado.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **A parte "o vínculo que a reimportação cria não toma trava" ficou com uma prova a menos.** Fica em `semana-reimportacao.int.test.ts:815`. A chave do vínculo novo da Xuxa na 8º B não está em `daEscola`. Antes do filtro, uma trava nesse vínculo aparecia na lista sem filtro; agora não aparece.
   - Hoje isso não deixa buraco. A `mudancaDaGrade` é calculada antes de o vínculo existir. E a mutação de 5_task.md:488 continua vermelha, só que porque o SQL recusa a chave da tripla como `uuid`, e não pela asserção da trava.
   - Para devolver a prova direta: com o job parado, guardar a lista concedida sem filtro. Depois do `await rodando`, buscar o id do vínculo criado na 8º B e filtrar essa lista por `daEscola` mais a chave dele. O teste continua imune a outras escolas e volta a cobrir o vínculo criado.
2. As recomendações da 1ª rodada que ficaram sem aplicar estão registradas em 5_task.md:540-545 com destino ou motivo. Não tenho nada a acrescentar.
