# Achados das revisões — `tasks/prd-avaliacao-e-correcao/8_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-26 17:37:32 · `tasks/prd-avaliacao-e-correcao/8_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nesta tarefa. `saida_da_aba` (de `packages/core/src/db/schema/prova-online.ts`, criada na 1.0) tem `escolaId` e `anoLetivoId`. A chave primária é `(escola, ano, aplicação, aluno, chave)`, a FK para a tentativa é composta e não há `id` sequencial. A chave é uuid v4: o banco tem o check `saida_da_aba_chave_v4` e a rota usa `registrarSaidaDaAbaRequestSchema`. A coluna `tentativa_atividade.saidas_da_aba` já existia.

Queries verificadas:
- `SaidaDaAbaRepository.registrar` (`apps/api/src/atividade/minha-atividade/saida-da-aba.repository.ts:22-54`): escola, ano e aluno vêm só do contexto (`requireEscolaId`, `requireAnoEmCurso`, `requestSessao().usuarioId`). O `insert` tira as colunas de escopo da própria tentativa encontrada e nunca do corpo do pedido. O `update` usa o mesmo `where` de escopo. Nada do cliente decide o escopo, só o id da aplicação e a chave.
- `MinhaAtividadeService.registrarSaida`: antes de gravar, passa por `leitura(id)` (`#daMinhaTurma`) e por `tentativa(id)` (`#minha`). Os dois já tinham escopo. Todos os estados (outra escola, outra turma, não avaliativa, encerrada, sem tentativa, enviada, vencida, sem ano em curso) respondem o mesmo `NAO_ENCONTRADO`. O 503 do pulso e o 429 do balde vêm antes de qualquer leitura e não dependem do id, então não confirmam que ele existe.
- `CorrecaoRepository.correcoesDoLote` (`apps/api/src/atividade/correcao/correcao.repository.ts:258-270`): o `leftJoin` da tentativa amarra escola, ano, aplicação e aluno à correção. O `where` de escopo da correção (escola e ano do contexto) continua o mesmo.
- Controller: nenhum `escolaId` no corpo nem na query. O corpo é `strictObject({ chave })`.
- Camada de rede: a matriz dá `registrar_saida` como `nunca` para a rede, e a `correcao` não ganhou leitura agregada nem individual para ela.
- `@Unscoped()`: não aparece nos arquivos alterados.

Teste de isolamento: presente e efetivo.
- Em `apps/api/src/atividade/saida-da-aba.int.test.ts:387-403`, o aluno da escola A e o de outra turma tentam com o id da escola B e recebem `NAO_ENCONTRADO`, e a contagem da B continua 0 com a tentativa dela em andamento.
- Em `:429-458`, o repository é testado direto: escola trocada, ano trocado, aluno sem tentativa e a outra aplicação da mesma aluna. Se eu tiro mentalmente o termo do ano, do aluno ou da aplicação, ou o `where` do `update`, o caso quebra.
- Em `:277-294`, a Ana tem tentativa nas duas provas. Isso quebra se sair o termo da aplicação ou o do aluno da junção do lote.
- Em `:405-416`, o aluno transferido também recebe `NAO_ENCONTRADO`.

Bloqueantes: nenhum.

Recomendações:
1. `apps/api/src/atividade/minha-atividade/saida-da-aba.repository.ts:27`: nenhum caso prova o termo `eq(tentativaAtividade.escolaId, escolaId)`. A justificativa em `8_task.md:106` diz que tirá-lo "dá o mesmo resultado", e isso só vale porque o token nunca traz o ano de outra escola. Com o contexto `(a.escolaId, outra.anoLetivoId, outra.aluno)` e o id da B, sem o termo, a gravação acontece na B. Vale incluir esse contexto no caso do repository e um bloco de mutação para o termo, ou reescrever o motivo para dizer que a equivalência depende de o ano vir sempre da escola do token.
2. `apps/api/src/atividade/saida-da-aba.int.test.ts:316`: para a coordenação e o aluno, o teste só confere que o corpo não tem `saidasDaAba`, e qualquer erro passaria. Vale conferir também o status e o código (`NAO_ENCONTRADO`, igual ao inexistente), para a asserção não passar por qualquer resposta de erro.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-26 17:37:32 · `tasks/prd-avaliacao-e-correcao/8_task.md`

VEREDITO: APROVADO
Tela vista: não. As fotos não existem para esta tela (a vitrine não monta o lote de uma prova avaliativa com saídas). Revisei pelo código, pelo `docs/interface.md` e pelos testes de tela, e rodei `npx vitest run --project unidade` em `Aprovar.test.tsx` e `aprovar.test.ts`: 54 testes passam. A tela precisa ser vista na validação, a 1366 e a 360 px, na escola cheia e na vazia.
Estados: ok. Carregando, erro, "não encontrada" e com dado ficam como antes em `Aprovar.tsx:242-255`. A tarefa não mexe no vazio. A aba Destaques sem destaque e a aba Outras sem outras continuam mostrando o texto de convite, e não mostram o aviso sem lista (`Aprovar.tsx:349` e `:357`).
Acessibilidade: ok.
- O aviso usa `Alert tom="info"`: tem ícone próprio, texto em `tinta` e nenhum papel vivo, que é o certo para texto já presente ao abrir a tela.
- Na tabela, "Saiu da aba" é `th scope="col"` e a contagem fica em `td`, alinhada à direita com `tabular-nums`.
- Nos destaques, a contagem entra no nome acessível da linha ("Saiu da aba: 3").
Chromebook fraco: ok. A coluna é um campo a mais na lista, sem nova consulta no cliente. A `Table` monta uma só estrutura por vez, e a página de até 200 alunos já era assim. No servidor, o `leftJoin` da tentativa no lote usa a chave composta da tentativa.
Celular: ok pelo código, a confirmar na foto.
- A 360 px a `Table` vira lista de cartões. A contagem aparece com o rótulo `dt` "Saiu da aba", sem coluna a mais nem rolagem horizontal.
- Nos destaques, o texto vai na segunda linha do `ListItem`, que quebra (`break-words`). A linha continua sendo um botão de 64 px ou mais.
- O aviso fica acima da lista e da tabela, em largura total, e quebra o texto.
- Nada depende de hover ou atalho, e nenhum fluxo exige o celular.
- O teste `Aprovar.test.tsx › a 360 px…` cobre a contagem no cartão e a ordem do aviso, mas não mede largura nem alvo de toque.
Ação oficial protegida: sim.
- Aprovar não mudou. A saída da aba não vira destaque, não entra no contador e não trava o botão (teste com 9 saídas e botão ligado).
- O registro da validação guarda só `saidaDaAbaMostrada: true`, sem a contagem (`lote.ts`, `loteApresentadoSchema`).
- O aviso fixo aprovado (`cenarios.md` §4) está inteiro em `aprovar.ts` e é conferido pela frase completa no teste.

Bloqueantes: nenhum.

Recomendações:
1. `e2e/`: não há spec que passe pelo Aprovar com prova avaliativa e saídas nos projetos `chromebook` e `celular`. A autoconferência 2 só confirma que os specs atuais não contam colunas. Um caso só no `celular` mediria o que o teste de unidade não mede: ausência de rolagem horizontal e alvo de 44 px na linha do destaque com o texto mais longo. Vale para a validação ou para a tarefa 12.0.
2. `docs/interface.md` §1.4 e §1.6 descrevem a coluna e o aviso. Quando a tela sair na vitrine, conviria uma foto do lote avaliativo, escola cheia e vazia, para a retro.
3. `Aprovar.tsx:364`: o tipo da célula é escrito à mão, `(typeof outrasEmOrdem)[number]`. Funciona, mas é frágil. Um tipo nomeado em `aprovar.ts` seria mais legível.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-26 17:38:40 · `tasks/prd-avaliacao-e-correcao/8_task.md`

VEREDITO: APROVADO

Escopo: respeitado. As subtarefas 8.1 a 8.5 estão feitas. O envio pela tela de foco, que é da 12.0, não entrou. O e2e `professor-prova.spec.ts` (`cenarios.md` §4) não foi antecipado.

Aderência à Tech Spec: ok.
- A rota segue a Tech Spec: entrada `chave`, resposta 204 e `NAO_ENCONTRADO` fora de prova em andamento, com o alcance conferido primeiro, depois o estado e depois o limite (§4 e §5.2).
- A gravação é `insert … select … on conflict do nothing` na PK de cinco colunas, e a soma `saidas_da_aba + 1` é feita no banco.
- O lote traz `saidasDaAba` só na avaliativa.
- As duas divergências, a forma de `saidaDaAbaMostrada` e o balde próprio `rl:saida-da-aba`, já estão na `techspec.md` §7 e §7c. O `prd.md` e o `cenarios.md` não dizem o contrário.

Portão local: carimbo válido para o código atual (typecheck, lint, segredo, dependências, unidade, alvo).

Bloqueantes: nenhum.

Recomendações:
1. `apps/api/src/atividade/minha-atividade/saida-da-aba.repository.ts:549`: `registrar` devolve `boolean`, mas `MinhaAtividadeService.registrarSaida` (`minha-atividade.service.ts:269`) descarta o valor. Só o teste do repository usa esse retorno. Ou o service usa o valor (para dizer que a tentativa sumiu entre a leitura e o `insert`), ou o docblock diz que o retorno existe só para o teste.
2. `apps/api/src/atividade/correcao/lote.ts:101`: a marca `saidaDaAbaMostrada` entra no `marcaDoApresentado`.
   - Efeito: se a professora abriu o lote de uma avaliativa pendente antes do deploy e aprovar depois dele, recebe `CONFLITO` uma vez e precisa recarregar.
   - É passageiro, e o comportamento é correto, porque a leitura de quem não viu a coluna não deve valer.
   - Vale uma linha no runbook ou na nota do deploy.
3. A tabela "Arquivos previstos" do `8_task.md` não lista as peças que a tarefa precisou:
   - `packages/core/src/rate-limit/*` (guarda, limitador, chave e decorador);
   - `packages/shared/src/atividade/{correcao,prova}.ts`;
   - `lote.ts`;
   - `minha-atividade.{service,repository}.ts`;
   - `contracts.test.ts`.
   
   Atualizar a tabela ajuda a retro a medir o porte.
4. `apps/web/src/areas/professor/atividades/aprovar.ts:274`: `hasSaidaDaAba` descobre se a prova é avaliativa pela presença do campo. É uma segunda cópia da regra do `comSaidas` do service, já anotada como tal nas mutações. Se outra tela precisar saber se a prova é avaliativa, o melhor é um campo explícito no contrato do lote.

Arquivos principais lidos:
- `apps/api/src/atividade/minha-atividade/saida-da-aba.repository.ts`
- `apps/api/src/atividade/minha-atividade/minha-atividade.service.ts`
- `apps/api/src/atividade/correcao/correcao.service.ts`
- `apps/api/src/atividade/correcao/correcao.repository.ts`
- `apps/web/src/areas/professor/atividades/Aprovar.tsx`
- `tasks/prd-avaliacao-e-correcao/techspec.md`

## infra-guardian · 1ª rodada · APROVADO · 2026-11-26 17:38:42 · `tasks/prd-avaliacao-e-correcao/8_task.md`

```
VEREDITO: APROVADO
Caminho quente tocado: prova
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
1. A carga ainda não cobre a saída da aba. O cenário infra/k6/prova-online.js (6.5) ainda não existe e
   deve incluir saídas-da-aba junto do PUT por item, por exemplo 10% dos alunos saindo da aba de 1 a 3
   vezes. Cada saída faz `update` na mesma linha de `tentativa_atividade` que o `responder` trava em
   `for update` (minha-atividade.repository.ts:286). A espera pela trava entre as duas operações só
   aparece medindo o p95 do PUT com as saídas no mesmo tráfego. Hoje a 8_task.md, item 9, se apoia
   numa medida que ainda não foi feita.
2. Há uma janela entre a saída e o envio em
   apps/api/src/atividade/minha-atividade/minha-atividade.service.ts:266-269. O `enviadaEm` é lido
   sem trava. Se o `enviar` segura a tentativa em `for update`, o `insert` da saída espera por ele e,
   solto, soma 1 na tentativa já enviada. O dano é pequeno, porque a saída aconteceu durante a prova,
   mas contradiz o docblock ("a enviada é NAO_ENCONTRADO"). Para fechar, basta pôr
   `isNull(tentativaAtividade.enviadaEm)` no `where` do select do `insert` em
   apps/api/src/atividade/minha-atividade/saida-da-aba.repository.ts:487. Pode ser isso ou só ajustar
   o docblock.
3. A marca `saidaDaAbaMostrada` agora entra em `marcaDoApresentado`, e a aprovação compara as marcas
   em correcao.service.ts:171. Um lote de avaliativa lido antes do deploy recebe CONFLITO na
   aprovação e pede uma nova leitura. Hoje isso não pega ninguém, porque a avaliativa nasce nesta spec
   e não há lote dela em produção. Vale uma linha nas notas de deploy da F6.
```

Arquivos auditados:
- apps/api/src/atividade/minha-atividade/saida-da-aba.repository.ts
- apps/api/src/atividade/minha-atividade/minha-atividade.service.ts
- apps/api/src/atividade/minha-atividade/minha-atividade.controller.ts
- apps/api/src/atividade/correcao/correcao.repository.ts
- apps/api/src/atividade/correcao/correcao.service.ts
- packages/core/src/rate-limit/rate-limit.guard.ts
- packages/core/src/rate-limit/rate-limiter.ts
- apps/api/src/atividade/saida-da-aba.int.test.ts

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-26 17:38:47 · `tasks/prd-avaliacao-e-correcao/8_task.md`

VEREDITO: APROVADO

**Caminhos de escrita em Nota:** nenhum. A tarefa não grava, não lê e não cria `Nota`. Ela grava duas coisas: a `saida_da_aba` (só a chave) e a soma em `tentativa_atividade.saidas_da_aba`, as duas em `apps/api/src/atividade/minha-atividade/saida-da-aba.repository.ts:594-614`. Na validação, grava a marca `apresentado.saidaDaAbaMostrada`, montada pelo servidor em `lote.ts:101`. Todos com autor humano? Não se aplica, porque não há escrita em Nota. O lote continua sendo aprovado pelo professor, como antes.

**Decisão autônoma sobre aluno:** ausente. A contagem não muda a correção, os destaques, a ordem do lote nem o `podeAprovar`, que continua `estado === 'pendente' && destaquesAbertos === destaques.length` (`correcao.service.ts:130`). Não trava a tentativa nem a prova. Dois testes provam isso:
- integração: `saida-da-aba.int.test.ts:232`, com 0 e 9 saídas, a mesma correção, nenhum destaque e o lote aprovado sem abrir ninguém;
- tela: `Aprovar.test.tsx`, com 9 saídas o botão de aprovar fica ligado.

**Aprovação registrada:** ok. A tarefa não traz saída de IA nova (a saída da aba não usa IA, AIA §1.4). O fluxo do lote pendente e o registro da validação (D56) continuam iguais. A validação ganha só a marca de que a coluna foi mostrada, sem a contagem de ninguém. Isso está provado em três lugares: `lote.test.ts`, `saida-da-aba.int.test.ts:296` e o esquema `z.literal(true).optional()` em `packages/shared/src/atividade/correcao.ts:533`.

**Supervisão do tutor:** não se aplica, a tarefa não toca o Tutor. Quanto ao item 7 e à D70, a exceção está contida como a regra pede:
- **Só em prova avaliativa em andamento:** `minha-atividade.service.ts:265-268` recusa a não avaliativa, a não começada, a enviada, a vencida e a encerrada, todas com o mesmo `NAO_ENCONTRADO`.
- **Sem horário:** a tabela não tem coluna de tempo, e a chave é v4 com `check`.
- **Nunca somada entre provas:** a junção é pela aplicação e pelo aluno, com teste da Ana em duas provas.
- **Só o professor da turma vê:** `contracts.test.ts:296` mostra que só o lote e a abertura do destaque têm o campo, e a matriz põe `registrar_saida` em `nunca` para professor, coordenação e rede.
- **Sem consequência automática.**
- **Aviso fixo:** o texto de `cenarios.md` §4 aparece igual em `aprovar.ts:396` e é conferido pela frase inteira.
- **Não é destaque:** `docs/interface.md` §1.6 foi corrigido e não diz mais "junto dos outros destaques".

**Autonomia declarada e visível:** sim. Nenhum agente ou função nova, e a saída da aba não tem chave em `FUNCOES`, como a AIA §1.7 e §1.9 decidiram.

Também conferi `docs/regulacao.md:112-116`: continua coerente com o que foi implementado. Nada de inferência emocional, de saber para onde o aluno foi, ou de a contagem chegar à coordenação, a Hoje ou a Turmas. Os únicos lugares que leem a contagem são o lote, que é novo, e o arquivo do titular, que já existia (`leitura-do-titular.ts`).

**Bloqueantes:** nenhum.

**Recomendações:**
1. A AIA de correção de objetiva (`docs/aia/correcao-de-objetiva.md`) ficou desatualizada em três pontos:
   - §1.4 item 9 ainda diz "junto dos destaques", o que contradiz a D88;
   - a linha 338 diz "não está no MVP. Não há rota para ela", e agora a rota existe;
   - N11 diz que a validação guarda "só que o destaque foi apresentado e aberto", e agora guarda também a marca da coluna.

   A subtarefa 6.4 já tem a 1.4/9 como destino. Ela precisa levar também a linha 338 e o N11.
2. O teste da coordenação e do aluno (`saida-da-aba.int.test.ts:316`) só confere que o corpo não tem `saidasDaAba`. Um corpo de erro qualquer passaria. Convém também conferir o status, ou `NAO_ENCONTRADO`, para que o teste prove a recusa e não só a ausência do campo.
3. A D70 e o N13 dizem que o aluno é avisado antes de começar. A rota já aceita saídas, mas nenhuma tela as envia até a 12.0 (subtarefas 12.1 e 12.4). Quando a 12.0 chegar, o e2e dela precisa provar que o aviso aparece antes da primeira questão. Não há bloqueante agora, porque nenhum cliente chama a rota.
4. Na linha do destaque (`Aprovar.tsx:294`), "Saiu da aba: N" vem logo depois dos motivos, separado só por " · ". Quem lê rápido pode tomar a contagem por mais um motivo do destaque. Vale separar mais do motivo, por exemplo em outra linha ou com outro peso. Fica registrado para o `frontend-reviewer`.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-26 17:39:28 · `tasks/prd-avaliacao-e-correcao/8_task.md`

VEREDITO: REPROVADO

Cenários exigidos (8_task.md, "Testes que provam a regra", e `cenarios.md` RF9, RF6, §3 (i) e §4):
- **Chave:** saída nova soma 1; a mesma chave não soma; A, B e A dão 2.
- **Estado:** não avaliativa, não começada, enviada, vencida e encerrada respondem `NAO_ENCONTRADO`, e nada muda.
- **Entrada:** a chave v7 e o campo a mais são `ENTRADA_INVALIDA`.
- **Provas separadas:** a prova 2 começa em 0, e o lote de uma prova traz só a contagem dela.
- **Sem consequência:** com 0 e com 9 saídas, a mesma correção e os mesmos destaques; o lote aprova sem abrir ninguém; o PUT segue gravando.
- **Limite:** depois do limite original, a saída conta com a indisponibilidade fechada de 5 min e com a lacuna aberta de 3 min; com o pulso parado, a 29 s passa e a 31 s é 503.
- **Lote e validação:** `saidasDaAba` vem só no lote da avaliativa; a validação marca que a coluna foi mostrada, sem contagem, e a da não avaliativa não marca.
- **Contrato:** nenhuma rota do aluno, da coordenação nem da rede traz saídas.
- **Corrida (i):** chaves diferentes dão 2; a mesma chave dá 1.
- **Balde:** a 31ª saída do minuto é 429; outro aluno no mesmo IP passa.
- **Isolamento:** aluno de outra turma e de outra escola; aluno transferido; escola sem ano em curso; o repository com o contexto errado.
- **Tela:** a coluna e o aviso só na avaliativa, com o aviso acima da lista; a contagem no cartão a 360 px; o aviso só quando há lista abaixo dele.

Cobertos: todas as linhas da tabela têm caso com o nome citado em `apps/api/src/atividade/saida-da-aba.int.test.ts`, `Aprovar.test.tsx`, `aprovar.test.ts`, `lote.test.ts` e `contracts.test.ts`.
- **Concorrência de verdade:** a corrida (i) faz duas chamadas em paralelo nos dois sentidos. O gatilho `after insert` deixa a primeira parada com a linha já no índice, e o `esperarNaTrava(…, 2)` prova a espera na chave única. O caso de chaves diferentes também prova que a tentativa não é travada: com um `for update`, a segunda chamada ficaria esperando.
- **Asserções sobre o resultado:** contagem e chaves lidas do banco, código e status da resposta, `Object.keys` da correção. Cada ausência vem ao lado de uma leitura que traz o campo.
- **Sem dependência de carga:** o pulso parado usa relógio e tique injetados. O balde é por usuário, e a prova contra o IP é o segundo aluno atrás do mesmo IP.
- **Proibidos:** não há `.skip`, teste comentado, mock que esconda a regra nem chamada a provedor de IA.
- **Motivos sem bloco:** os quatro (o termo da escola no repository, a escola e o ano na junção do lote, a permissão, `!anonima` e `token`) conferem com o código. O ano já separa a escola trocada, e a FK composta prende a junção.
- **Os quatro termos do serviço:** chegam à cláusula. A encerrada não fica enviada e tem o limite adiante; a não avaliativa tem tentativa e não está vencida.

Rodei a parte de unidade (`Aprovar.test.tsx`, `aprovar.test.ts`, `lote.test.ts`, `contracts.test.ts`): 80 de 80 passaram. **O arquivo de integração eu não rodei.** O compose de teste está com despachante e workers de pé, provavelmente de outro revisor, e o setup recusou subir; não derrubei nada. Esta auditoria do `saida-da-aba.int.test.ts` vem da leitura do código e das mutações que o portão já provou.

Bloqueantes:
1. **`apps/web/src/areas/professor/atividades/Aprovar.tsx:294`: condição nova sem bloco de mutação.** É o ternário `${comSaidas ? \` · ${ROTULO_DA_SAIDA_DA_ABA}: ${textoDasSaidas(destaque)}\` : ''}` na linha de cada destaque. É a terceira tela que usa a regra, além do aviso e da coluna, e a seção "Mutações" não tem bloco para ela. O `--faltando: 0` provavelmente não enxerga ternário dentro de template string. A autoconferência, item 1, diz que as duas pontas de cada ternário têm bloco, e esta não tem.
   - **Correção exigida:** dois blocos para esta linha.
   - Com `true ?`: o teste citado é `Aprovar.test.tsx › a atividade sem prova não tem a coluna nem o aviso`, que exige `destaques.textContent` sem "Saiu da aba".
   - Com `false ?`: o teste citado é `› na aba Destaques, a contagem vem na linha`, que espera "Saiu da aba: 0" e "Saiu da aba: 3".
   - Pela leitura, os dois testes já ficam vermelhos com a mutação; falta só declarar os blocos.

Recomendações:
- **Status no caso da coordenação e do aluno:** `saida-da-aba.int.test.ts:316` só confere que o corpo não tem `saidasDaAba`, e um 500 também passaria. Vale exigir o status, 404 ou o de hoje, antes do `not.toMatch`.
- **Saída e envio ao mesmo tempo:** uma saída lida antes do envio pode somar depois que o envio grava. O efeito é pequeno e fica dentro da prova, e o §3 só pede a corrida (i). Vale registrar para a validação.
- **Contagem de casos:** a linha "Coluna no Aprovar" da tabela diz "5 casos", e o `describe` tem 7.
- **Ano trocado no repository:** o caso usa o id da A, não o da B como diz a linha da tabela e `cenarios.md` §2. A prova é a mesma, mas convém alinhar o texto da tabela.
- **RF10 (convocado):** `cenarios.md` exige `NAO_ENCONTRADO` também na rota de saídas para o aluno não convocado. A convocação ainda não existe na `minha-atividade`, e a tarefa que a trouxer precisa incluir `saidas-da-aba` no caso dela.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-26 17:57:54 · `tasks/prd-avaliacao-e-correcao/8_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nesta rodada. `saida_da_aba` e `tentativa_atividade` não mudaram desde a 1ª rodada, que já as conferiu com `escolaId` e `anoLetivoId`.

Queries verificadas:
- `SaidaDaAbaRepository.registrar` (`apps/api/src/atividade/minha-atividade/saida-da-aba.repository.ts:26-52`): a escola, o ano e o aluno vêm do contexto (`requireEscolaId`, `requireAnoEmCurso`, `requestSessao`), e o mesmo `where` vale para o `insert … select` e para o `update`. Nesta rodada só o docblock mudou.
- `MinhaAtividadeService.registrarSaida`: só o docblock mudou. O texto novo descreve uma janela de contagem entre a saída e o envio. Ela não toca o escopo de escola.
- `Aprovar.tsx` e `aprovar.ts`: só trocaram a anotação de tipo da célula por `CorrecaoDeAluno`. Não há efeito no escopo.

Teste de isolamento: presente e efetivo
- Recomendação 1 da 1ª rodada, aplicada. O caso novo, em `apps/api/src/atividade/saida-da-aba.int.test.ts:449-450`, usa o contexto da escola A com o ano, o aluno e a aplicação da B. `requireAnoEmCurso` só lê o ano do contexto e não confere nada. Por isso, sem `eq(tentativaAtividade.escolaId, escolaId)`, o select acharia a tentativa da B e gravaria. O `registrar` devolveria `true` e o `toBe(false)` quebraria. O teste prova o termo da escola, e o bloco de mutação novo em `8_task.md` está correto.
- Recomendação 2 da 1ª rodada, aplicada. Em `saida-da-aba.int.test.ts:316-323`, o teste agora compara o status e o código da recusa à coordenação e ao aluno com os de um id que não existe (`NAO_ENCONTRADO`, 404). Só depois confere que o campo não aparece. Isso cobre a regra 10, item 6: a recusa não confirma que o lote existe.

Bloqueantes: nenhum

Recomendações: nenhuma nova. A janela entre a saída e o envio já está registrada em "Recomendações sem aplicar" para a validação. Ela não é questão de isolamento entre escolas.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-26 17:58:00 · `tasks/prd-avaliacao-e-correcao/8_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum novo nesta rodada. O diff só muda dois docblocks, dois casos de teste, um tipo na tela, o documento da tarefa e uma linha no TODO. A contagem `saidasDaAba` continua como estava na rodada 1, quando foi aprovada.

Fora da tabela de dados do docs/lgpd.md: nenhum.

Autorização por objeto: ok. A rodada deixou o teste mais forte em dois pontos:
- `apps/api/src/atividade/saida-da-aba.int.test.ts:316-323`: a coordenação e o aluno pedem a `correcao` do lote e recebem a mesma recusa (status e código) que o professor recebe para um id que não existe. Só depois o teste confere que a resposta não traz `saidasDaAba`. Isso prova a regra 10, item 6 (e regra 20, item 6), em vez de olhar só a falta do campo.
- `apps/api/src/atividade/saida-da-aba.int.test.ts:449-450`: um caso novo no repository usa a escola da A com o ano, o aluno e a aplicação da B. Nesse caso só o termo `eq(tentativaAtividade.escolaId, escolaId)` impede a gravação, e esse termo agora tem bloco de mutação no `8_task.md`. Na rodada 1 ele ficava sem bloco, só com um motivo escrito.

Logs: limpos. Nada novo foi logado.

Auditoria: presente onde a regra exige. A rodada não toca em leitura por coordenação ou rede, exportação, nota, permissão nem aprovação de saída de IA.

Envio externo: nenhum.

Seed/fixture: sintético. Os nomes do teste são gerados, como `Aluna Sintética Sem ${randomUUID()}`, e o caso novo monta a escola B com `montarEscolaComAssistente`.

Bloqueantes: nenhum. A rodada 1 não exigiu correção. A recomendação 2 dela (a nota de deploy da marca `saidaDaAbaMostrada`) foi feita em `TODO.md:21-23`.

Recomendações:
- A janela documentada em `apps/api/src/atividade/minha-atividade/minha-atividade.service.ts:306-308` permite somar uma saída depois do envio. Para a LGPD é inofensiva: é um fato que aconteceu durante a prova e fica preso a ela. Mas o professor pode ver uma contagem que inclui um instante já depois do envio. Se a validação decidir fechar a janela, `isNull(enviadaEm)` no `where` do `update` resolve sem tocar no escopo.
- Continua da rodada 1: quando houver foto do lote avaliativo, conferir no celular (360 px) que a contagem nunca aparece sem o aviso fixo.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-26 17:58:03 · `tasks/prd-avaliacao-e-correcao/8_task.md`

VEREDITO: APROVADO
Tela vista: não. As fotos estão indisponíveis: a vitrine não monta o lote de prova avaliativa com saídas da aba. A revisão foi pelo código e pelos testes de tela. A tela será vista na validação e na 12.0.
Estados: ok. O diff desta rodada não mexe em carregando, vazio, erro nem com dado. Confirmei só o que mudou.
Acessibilidade: sem mudança nesta rodada. A coluna "Saiu da aba" continua na tabela existente, com título de coluna e alinhamento ao fim.
Chromebook fraco: sem mudança. É só tipagem.
Celular: não reavaliado, pois o diff não toca em layout. A recomendação 1 da rodada anterior (e2e no celular) continua para a validação e a 12.0.
Ação oficial protegida: sim. O diff não toca no diálogo de aprovação.
Bloqueantes: nenhum.

A correção da rodada anterior foi feita. `CorrecaoDeAluno` é declarado em `apps/web/src/areas/professor/atividades/aprovar.ts:265` como `CorrecaoDoLoteResponse['outras'][number]`. `Aprovar.tsx:37` o importa e `Aprovar.tsx:365` o usa na célula da tabela, no lugar do `typeof outrasEmOrdem[number]`. A mudança só afeta o tipo, o comportamento é o mesmo. Em `Aprovar.tsx:295` e `:365` o rótulo "Saiu da aba" vem de `ROTULO_DA_SAIDA_DA_ABA`, então não há texto técnico na tela.

Os demais arquivos do diff (comentários, o teste `saida-da-aba.int.test.ts`, o documento da tarefa e a nota de deploy no `TODO.md`) estão fora da tela e não precisam de revisão de interface.

Recomendações, todas já registradas:
- Fazer o e2e do lote avaliativo no celular a 360 px (recomendação 1 da rodada anterior).
- Fotografar o lote com saídas da aba, o que exige a vitrine montar uma prova avaliativa aplicada (recomendação 2 da rodada anterior).

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-26 17:58:12 · `tasks/prd-avaliacao-e-correcao/8_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum novo nesta rodada. O diff só mexe em comentários de código, em testes, num tipo da tela e em documentos. Os caminhos da 1ª rodada continuam iguais. Todos com autor humano? sim.
Decisão autônoma sobre aluno: ausente. A contagem de saídas da aba só aparece no lote: entra pelo `correcao.service.ts:41`, e o `lote.ts:101` só acrescenta a marca `saidaDaAbaMostrada`. Ela não entra nos destaques, na correção nem na aprovação, e isso continua valendo depois da rodada.
Aprovação registrada: ok. O efeito de "aprovar o lote" e a marca no `apresentado` seguem como na 1ª rodada.
Supervisão do tutor: ok. A tarefa não toca o tutor.
Autonomia declarada e visível: sim. A tarefa não muda nada nisso.
Bloqueantes: nenhum.

O que conferi no diff da rodada, pela regra 70:
- **Item 7 (D70).** O docblock novo de `registrarSaida` em `apps/api/src/atividade/minha-atividade/minha-atividade.service.ts` documenta a janela entre a leitura e o envio. Pode sair uma contagem a mais, mas de uma saída que passou pela leitura antes do `enviar`, ou seja, que aconteceu durante a prova. Continua presa à tentativa daquela avaliação, sem soma por aluno e sem consequência automática. Pela regra, a janela não leva a uma decisão.
- **Leitura restrita ao professor da turma.** O caso `a coordenação e o aluno não leem o lote` de `apps/api/src/atividade/saida-da-aba.int.test.ts` agora compara status e código com os de um id que não existe, antes de checar que o campo está ausente. Isso atende a minha recomendação 2 da 1ª rodada. A asserção olha o resultado de verdade, e a leitura que traz o campo (a do professor) está na mesma cena.
- **Escola trocada no repository.** O caso novo usa a escola da A com o ano da B, e o termo `escolaId` passou a ter mutação. Isso reforça que a contagem nunca alcança outra escola.
- **Tela.** O `CorrecaoDeAluno` em `aprovar.ts` e `Aprovar.tsx` só troca um tipo, sem efeito no que aparece. As duas mutações novas da linha do destaque provam que a contagem só aparece na avaliativa.
- **Fotos.** Não havia fotos, como o prompt avisou. Revisei pelo código e pelos testes de tela.

Recomendações:
1. A janela de envio ficou para a validação. Se ela decidir fechá-la, o `isNull(enviadaEm)` no `update` fecha a janela sem mudar o que a rota responde, que segue 204. Hoje a regra 70 não exige.
2. Continuam com destino registrado no `8_task.md`, e conferi que estão lá: a AIA (6.4), o e2e do aviso antes da primeira questão (12.0) e o separador "Saiu da aba: N" na linha do destaque (validação, com foto).

## revisor-geral · 2ª rodada · APROVADO · 2026-11-26 17:58:42 · `tasks/prd-avaliacao-e-correcao/8_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade e alvo, para o código atual)
Bloqueantes: nenhum

Nesta rodada só auditei o diff desde a 1ª. A 1ª não exigiu correção, e as recomendações que a Mesa aplicou estão no código:

- **`saida-da-aba.int.test.ts:313-323`**: a recusa à coordenação e ao aluno agora é comparada com a resposta a um id que não existe, pelo status e pelo código, e só depois se confere que o campo não aparece. Isso cobre o item 6 da regra 10. `erro`, `NAO_ENCONTRADO` e `randomUUID` já estavam no arquivo (linhas 3, 39 e 40).
- **`saida-da-aba.int.test.ts:446-447`**: o caso "escola da A com o ano da B" é o que pega a retirada de `eq(tentativaAtividade.escolaId, escolaId)`. Sem o termo, a gravação devolve `true` ou falha na FK composta, e o teste quebra nos dois casos. O motivo antigo de deixar esse termo sem bloco de mutação saiu do `8_task.md`, e o bloco novo cobre o termo.
- **`Aprovar.tsx:362` e `aprovar.ts:264-265`**: a anotação de tipo `(typeof outrasEmOrdem)[number]` virou o tipo nomeado `CorrecaoDeAluno`. Os blocos de mutação da coluna acompanharam o texto novo da linha. Não muda comportamento.
- **Os dois docblocks**: o de `registrarSaida` agora descreve a janela entre a saída e o envio, e o de `registrar` diz que o service não usa o `boolean` devolvido. Os dois batem com o código, e a janela também está registrada em "Recomendações sem aplicar".
- **`8_task.md`**: a tabela "Arquivos previstos" agora lista todos os arquivos que aparecem no `git status`. O contador foi para 7 casos e 43 blocos com 3 motivos, e a linha do destaque, que o `--faltando` não enxerga dentro do template string, ganhou blocos para as duas pontas do ternário.
- **`TODO.md`**: a nota de deploy sobre a marca `saidaDaAbaMostrada` tem dono e motivo.

Recomendações:
- A janela entre a saída e o envio continua aberta: uma saída lida antes do envio ainda pode somar 1 depois que o `enviar` grava. A decisão ficou para a validação, e quem valida precisa saber que pôr `isNull(enviadaEm)` no `where` da soma muda o comportamento.
- A 4 da rodada anterior segue sem aplicar: um campo explícito no contrato do lote no lugar de `hasSaidaDaAba`, que hoje descobre se a prova é avaliativa pela presença da contagem. Fica para a tarefa que precisar disso em outra tela.

Arquivos revistos:
- apps/api/src/atividade/saida-da-aba.int.test.ts
- apps/web/src/areas/professor/atividades/Aprovar.tsx
- apps/web/src/areas/professor/atividades/aprovar.ts
- tasks/prd-avaliacao-e-correcao/8_task.md
- .processo/ordens/diff-8-r1-r2.patch

## infra-guardian · 2ª rodada · APROVADO · 2026-11-26 17:58:45 · `tasks/prd-avaliacao-e-correcao/8_task.md`

VEREDITO: APROVADO
Caminho quente tocado: prova (rodada 2: só o docblock do service e do repository, testes, o tipo na tela e documentos. Nenhuma linha executável do caminho quente mudou)
Rate limit: ok (o balde `rl:saida-da-aba` é por usuário, ficou como na rodada 1 e não mudou)
Fila e prioridade: ok (não se aplica, nada entra na fila)
Concorrência: protegida (a soma é feita pelo banco com `on conflict do nothing` na chave, e isso não mudou. A janela entre a saída da aba e o envio da prova está documentada no docblock de `registrarSaida` e vai para a validação. O efeito máximo é uma saída contada a mais, e nada que corrige, destaca ou aprova lê essa contagem)
Índice e paginação: ok (nenhuma query nova nesta rodada)
Degradação de IA: não se aplica
Migration: não se aplica (nenhuma migration nesta rodada)
Métrica e alerta: ok (não mudou desde a rodada 1)
Bloqueantes: nenhum
Recomendações:
- Na rodada 1 não houve correção exigida. As três recomendações foram tratadas assim:
  - A 1 (o cenário `prova-online.js` não inclui a saída da aba) foi para a tarefa 6.5 e está registrada na tabela de recomendações de `tasks/prd-avaliacao-e-correcao/8_task.md`.
  - A 2 (a janela entre saída e envio) ficou documentada em `apps/api/src/atividade/minha-atividade/minha-atividade.service.ts:306-308`, para a validação decidir.
  - A 3 (a nota de deploy da marca `saidaDaAbaMostrada`) está em `TODO.md:21-23`.
- O caso novo do repository, com a escola da A e o ano da B, em `apps/api/src/atividade/saida-da-aba.int.test.ts:449-450`, cobre de fato o termo `escolaId`. Sem esse termo, a tentativa da B seria encontrada e o caso ficaria vermelho. Nada a corrigir.
- Se a validação fechar a janela da recomendação 2, a forma barata é condicionar o `update` da soma a `enviadaEm is null` no mesmo comando, sem trava e sem custo novo às 10h. Isso muda o comportamento e pede o caso de corrida correspondente.

## test-engineer · 2ª rodada · APROVADO · 2026-11-26 17:59:11 · `tasks/prd-avaliacao-e-correcao/8_task.md`

VEREDITO: APROVADO

**Cenários exigidos:** os mesmos da 1ª rodada. Nesta rodada conferi três coisas:
- os dois lados do ternário que põe a contagem na linha de cada destaque;
- o termo da escola no `where` da tentativa do repository, que antes não tinha bloco e agora tem;
- a recusa à coordenação e ao aluno com o mesmo status e código do id que não existe (regra 10, item 6).

**Cobertos:**
- **Correção 1, feita.** O ternário está em `apps/web/src/areas/professor/atividades/Aprovar.tsx:295`, e o documento tem os dois blocos.
  - Com `true ?`, o caso `Aprovar.test.tsx › a atividade sem prova não tem a coluna nem o aviso` (linha 574, `destaques.textContent` não contém "Saiu da aba") fica vermelho pelo motivo certo. A asserção da coluna, que vem antes no mesmo caso, continua passando com essa mutação, então é a linha do destaque que falha.
  - Com `false ?`, o caso `› na aba Destaques, a contagem vem na linha` (linha 525, espera "Saiu da aba: 0" e "Saiu da aba: 3") fica vermelho.
- **Bloco novo do termo da escola** (`apps/api/src/atividade/saida-da-aba.int.test.ts:450`). O contexto é o da escola A com o ano, o aluno e a aplicação da B. Sem `eq(tentativaAtividade.escolaId, escolaId)`, o `insert … select` acha a tentativa da B e grava, porque usa a escola da própria tentativa e a FK aceita. O `registrar` devolve `true` e o caso fica vermelho. O caso da linha 448 continua `false` com a mutação, porque o ano da A o separa, e por isso é o caso novo que prova o termo. O motivo que dispensava esse bloco saiu do documento.
- **Recusa à coordenação e ao aluno** (`saida-da-aba.int.test.ts:316-323`). O teste agora compara o status e o código com os do id inexistente, que dá 404 `NAO_ENCONTRADO`, antes de checar que o campo não aparece. A professora da turma continua recebendo `saidasDaAba` no mesmo caso. Assim a ausência do campo vem sempre depois de uma leitura que o traria.
- **O resto do diff** são tipos e comentários: `CorrecaoDeAluno`, os docblocks de `registrarSaida` e de `registrar` e a nota no `TODO.md`. Não há condição nova, e nada disso pede bloco.
- **Testes rodados nesta rodada:**
  - `npx vitest run apps/web/src/areas/professor/atividades/Aprovar.test.tsx`: 31 passaram.
  - `npx vitest run apps/api/src/atividade/saida-da-aba.int.test.ts`: 19 passaram.
  - `node tools/processo/mutacoes.ts --faltando tasks/prd-avaliacao-e-correcao/8_task.md`: nenhuma linha nova sem bloco. O documento lembra que esse comando não enxerga o ternário dentro do template string, e esse ternário tem os dois blocos conferidos à mão acima.
- **A tabela de testes do documento** agora tem 7 casos na linha "Coluna no Aprovar", e os sete existem em `Aprovar.test.tsx:497-590`. A linha do repository lista os três contextos, e cada um tem a sua asserção nas linhas 448, 450 e 452.

**Bloqueantes:** nenhum.

**Recomendações:**
- **A janela entre a saída e o envio** está só no docblock de `registrarSaida` (`apps/api/src/atividade/minha-atividade/minha-atividade.service.ts:303-309`). Se a validação decidir fechá-la com `isNull(enviadaEm)` no `where` da soma, essa condição precisa vir com um teste de corrida de verdade: a saída e o `enviar` em paralelo, com o `WriteBlockTrigger` que o caso (i) já usa. Duas chamadas em sequência não provam a corrida.
- **O caso do aluno não convocado (RF10)** foi para a tarefa que trouxer a convocação. Está registrado na tabela "Recomendações sem aplicar", e nada mais a fazer nesta tarefa.
