# Achados das revisões — `tasks/correcoes/2026-11-07-carga-da-semana.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-07 01:32:59 · `tasks/correcoes/2026-11-07-carga-da-semana.md`

VEREDITO: APROVADO

A correção só toca o cenário de carga. Não muda nenhum código que roda em produção, e todo dado que ela semeia é inventado, criado direto no banco local da carga.

Campos pessoais tocados: nenhum campo novo. O seed passa a gravar linhas em quatro tabelas que já existem:
- `vinculo` (professor sintético ligado a uma turma)
- `alocacao` (dia, horário e sala; as salas viram "Sala N", sem nome de pessoa)
- `aula`, com o texto fixo "Aula sintética: revisão do conteúdo"
- `evento_calendario`, com as descrições "Feriado sintético" e "Semana de avaliações sintética"

Nenhuma tabela nova de aluno. O k6 só lê `GET /v1/semana`, que o professor da carga chama com o próprio token.

Fora da tabela de dados do docs/lgpd.md: nada. `alocacao`, `aula` e `evento_calendario` estão nas linhas 74 a 76 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/docs/lgpd.md`, com finalidade e retenção. O `vinculo` já estava no mapa antes desta correção.

Autorização por objeto: ok. A correção não cria nem muda rota. O k6 chama a Semana só com o token do próprio professor, e a regra de que só ele a lê (`aula.ler` é `proprio` na matriz) continua no controller, sem mudança.

Logs: limpos.
- O k6 não usa `console.*` e não grava o corpo das respostas. De `/v1/semana` ele só conta quantas aulas vieram (`dias[].aulas.length`).
- As marcações das métricas levam o nome da rota e o grupo. A URL leva só a data da segunda-feira, que não é dado de pessoa.
- A saída do script (`infra/scripts/carga-login.ts:334`) mostra só números de métrica, filtrados pela regex de `descreverFase`. A única chave nova é `semanas_lidas`, uma contagem.

Auditoria: não se aplica. A correção não lê dado de aluno pela coordenação ou pela rede, não exporta, não mexe em nota nem em permissão e não aprova saída de IA.

Envio externo: nenhum. O cenário não chama provedor de IA nem login externo, e o teste de rotas em `infra/test/carga-login.test.ts:392-394` exige a lista exata de rotas chamadas.

Seed/fixture: sintético. Os textos estão em `infra/scripts/carga-login.ts`, de `semearASemanaDosProfessores` em diante, e os e-mails dos professores continuam com o domínio `.invalid`.

Bloqueantes: nenhum.

Recomendações:
- `infra/scripts/carga-login.ts:271`: o comentário "As questões do artefato sintético" ficou separado da constante que ele explica (`QUESTOES_SINTETICAS`), porque as constantes novas entraram entre os dois. Vale mover o bloco novo para antes desse comentário. É só organização.
- `infra/scripts/carga-login.ts`, no insert em `evento_calendario`: as datas estão fixas em novembro de 2026. Em outro mês o calendário da carga cai fora da semana lida, e a consulta de eventos roda vazia. Isso não toca a privacidade e o threshold `semanas_lidas` não depende disso, mas a medida perde parte do peso. Vale gerar as datas a partir de `now()`, como o seed já faz com o texto das aulas.

Pergunta de fechamento: a resposta não muda com esta correção. Ela não acrescenta dado real, tabela nova nem destino novo. O que o seed grava existe só no banco local da carga e já está no mapa de dados.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-07 01:33:17 · `tasks/correcoes/2026-11-07-carga-da-semana.md`

VEREDITO: APROVADO
Caminho quente tocado: login (só o cenário de carga `rajada`; nenhum código de produção mudou)
Rate limit: ok (não foi alterado; a rota entra no cenário com token de professor, por usuário)
Fila e prioridade: ok (não se aplica, nenhum job)
Concorrência: protegida (só o seed sintético mudou; sem operação concorrente nova)
Índice e paginação: ok (a dúvida do índice da `alocacao` continua no `TODO.md`, presa ao `EXPLAIN` do staging)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok. A rota tem limite próprio de p95 abaixo de 1 s e o threshold `semanas_lidas count==60`. Uma Semana sem aula soma em `respostas_inesperadas`, então um seed vazio reprova a fase. A espera do pool (R40) ainda não é exportada e por isso não pode ser medida. A correção deixa isso declarado e registrado no `TODO.md`.
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/infra/scripts/carga-login.ts:139`: o bloco novo entrou entre o JSDoc `/** As questões do artefato sintético... */` e a `const QUESTOES_SINTETICAS`. O comentário ficou solto, acima de `TURMAS_POR_PROFESSOR`. Mover o bloco para antes ou para depois desse par.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/infra/scripts/carga-login.ts` (o `insert into evento_calendario` em `semearASemanaDosProfessores`): os feriados e a semana de avaliações têm data fixa (2026-11-02, 2026-11-09 a 13, 2026-11-15). A partir de 16/11, nenhuma corrida terá evento na semana pedida, e a parte da rota que lê o calendário deixa de pagar alguma coisa sem que o cenário acuse. Calcular as datas a partir de `date_trunc('week', timezone('America/Sao_Paulo', now()))`, como já se faz com as aulas.
- Quando a métrica de espera do pool existir (item novo do `TODO.md`), pôr o threshold de 100 ms na `rajada` ao lado do p95 de `GET /v1/semana`. Hoje o limite de 1 s da rota cobre essa espera só de forma indireta.

Conferi também: `infra/test/carga-login.test.ts` roda local, com 41 de 41 testes passando. A corrida real do k6 (p95 de 47 ms, 60 de 60 leituras, controle negativo reprovando) está registrada na tarefa, mas não a refiz.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-07 01:34:42 · `tasks/correcoes/2026-11-07-carga-da-semana.md`

VEREDITO: REPROVADO

Rodei `npx vitest run infra/test/carga-login.test.ts`: 41 de 41 verdes. As consultas de `/v1/semana` conferem com o contrato em `packages/shared/src/semana/semana.ts`: o parâmetro `segunda` e a lista `dias[].aulas` existem.

**Cenários exigidos:**
- **Caminho feliz:** os 60 professores da rajada abrem a Semana depois do login e recebem 200 com aula, dentro do p95 de 1 s.
- **Casos de borda:**
  - semana sem aula, ou resposta que não é 200;
  - segunda-feira de Brasília pedida de domingo à noite;
  - professor que dá aula em várias turmas;
  - feriado e evento caindo na semana medida;
  - itens do dia nas turmas do professor;
  - seed e k6 rodando em dias ou semanas diferentes.
- **Permissão:** o aluno (conta de matrícula) não lê a Semana.
- **Isolamento:** não se aplica a cenário de carga. O isolamento da rota já é provado na 2.0.
- **Concorrência:** as 60 leituras acontecem juntas, de verdade, dentro da rajada.

**Cobertos:**
- **Caminho feliz:** `só o professor lê a Semana…`, `a rajada julga o p95 da Semana sozinho…` e a corrida do k6 (60 de 60, p95 de 47 ms).
- **Semana vazia ou sem 200:** `a semana sem aula, ou sem 200, conta como resposta inesperada…`, e o controle negativo do k6 com o seed sem grade, que reprovou.
- **Segunda de Brasília:** `a segunda pedida é a de Brasília…`.
- **Professor em várias turmas:** `o professor da carga dá aula em turmas da escola…`.
- **Permissão:** o mesmo teste de "só o professor", com a conta de matrícula presa ao Início.
- **Lista de rotas:** o teste de rotas atualizado.
- **Registro da fase:** `o registro da fase mostra quantos professores leram a Semana…`.
- **Concorrência:** as leituras em paralelo dentro da rajada.

**Bloqueantes:**

1. **A justificativa de "sem bloco" vale para duas das quatro consultas, não para as quatro.**
   - **Onde:** `tasks/correcoes/2026-11-07-carga-da-semana.md:56`, `infra/scripts/carga-login.ts:454` e `:460`, `infra/k6/login-7h30.js:391-398`.
   - **O que está errado:** o documento diz que as consultas de vínculo, alocação, aula e evento são provadas pelo threshold `semanas_lidas == 60`. Isso só vale para vínculo e alocação, porque o k6 conta apenas `dia.aulas.length > 0`, e a aula sai da grade.
     - Sem o `insert into aula` (o texto das aulas), todo `texto` vem `null` e o cenário continua verde.
     - Sem o `insert into evento_calendario`, todo `eventos` vem vazio e o cenário continua verde.
     - Nada confere os itens do dia. Se o vínculo sair em outra disciplina, ou o k6 rodar em outro dia que não o do seed, `itens` vem vazio e o cenário continua verde.
   - **Por que importa:** a seção "Causa" diz que o defeito era justamente faltar esse dado ("vínculos de professor, grade, texto de aulas, calendário e itens do dia"). Do jeito que está, três das cinco partes que a correção diz entregar ficam sem prova nenhuma, nem teste nem threshold. Isso é cláusula nova sem bloco e com justificativa falsa.
   - **Agravante:** os eventos têm data fixa (`'2026-11-02'`, `'2026-11-09'` a `'2026-11-13'`, `'2026-11-15'`). Só caem na semana medida nas semanas de 02/11 e de 09/11. Em qualquer corrida a partir de 16/11, ou depois da virada do ano letivo, a consulta de calendário devolve vazio e ninguém percebe.
   - **Correção exigida:**
     - Gravar os eventos com data relativa à semana em curso, como já é feito na `aula`: `date_trunc('week', timezone('America/Sao_Paulo', now()))::date + n`.
     - Em `leituraDaSemana`, exigir na mesma leitura que pelo menos uma aula tenha `texto !== null`, que pelo menos um dia tenha `eventos.length > 0` e que o dia de hoje tenha `itens.length > 0`. Pode ser um contador próprio, por exemplo `semanas_completas == 60`, ou endurecer o critério de `semanas_lidas`. A semana que falhar em qualquer desses pontos soma em `respostas_inesperadas`.
     - Acrescentar os blocos de mutação dessas condições em `infra/test/carga-login.test.ts`.
     - Corrigir o parágrafo da linha 56 para dizer o que de fato cada threshold prova.
     - Se a escolha for não medir texto, evento ou itens, tirar do documento e do seed a afirmação de que eles entram na medida.

**Recomendações:**
- **O cenário de importação também mudou, e não foi rodado.** `infra/scripts/carga-importacao.ts:581` chama o mesmo `semearContas`, e na linha 589 roda a mesma rajada do k6. Com esta correção, o `carga:importacao` também semeia a Semana, faz as 60 leituras e herda o threshold `semanas_lidas`. Vale registrar isso no documento e rodar a fase `previa_e_gravar` uma vez, ou declarar que fica para a próxima corrida.
- **Seed e k6 em semanas diferentes:** se o seed rodar perto da meia-noite de domingo e o k6 já na segunda, o seed grava uma semana e o k6 pede outra. O cenário fica vermelho, o que é falha segura, mas vale uma linha de aviso no comentário de `segundaDaSemana`.
- **Partes de `leituraDaSemana` sem teste:** o nome do `Counter('semanas_lidas')`, a condição `resposta.status === 200 ? … : undefined` e o `.toISOString().slice(0, 10)` não têm teste de texto. Hoje só a corrida real do k6 os pega. Um `toContain("new Counter('semanas_lidas')")` fecharia o nome.
- **Leitura que falha conta duas vezes:** uma leitura que não volta 200 soma em `respostas_inesperadas` duas vezes, uma em `autenticada` e outra como `semana_vazia`. O threshold continua certo, mas a contagem infla. Basta somar `semana_vazia` só quando o status é 200.
- **Contagem de arquivos no documento:** o comentário da linha 5 diz "3 arquivos fora de tasks/", mas são 4 (o `TODO.md` também conta). A obrigação do `revisor-geral` não muda, porque o limite é mais de 5.
- **Duas disciplinas na mesma turma:** o seed usa uma disciplina só. O caso do professor com duas disciplinas na mesma turma, que é borda do domínio, não entra na carga. Fica como cobertura extra possível.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/tasks/correcoes/2026-11-07-carga-da-semana.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/infra/k6/login-7h30.js
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/infra/scripts/carga-login.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/infra/test/carga-login.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/infra/scripts/carga-importacao.ts

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-07 02:02:22 · `tasks/correcoes/2026-11-07-carga-da-semana.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. O seed da carga continua escrevendo vínculo, alocação, texto de aula, evento de calendário e `aplicada_em` de atividade, sempre com conteúdo fixo e sintético ("Aula sintética: revisão do conteúdo", "Feriado sintético", "Semana de avaliações sintética"). Esta rodada só muda as datas, que agora acompanham a semana em curso, e acrescenta o `update` de `atividade_aplicada.aplicada_em`, um campo que já existia. Nenhuma migration.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: não se aplica, porque a rodada não toca rota nem repository da API. O k6 lê `GET /v1/semana` com o token do próprio professor. O `update` de `atividade_aplicada` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/infra/scripts/carga-login.ts:470`) fica preso a `escola_id` e `ano_letivo_id` e roda só no banco do compose de carga.

Logs: limpos. O `login-7h30.js` não tem `console.*`. As conferências novas de `leituraDaSemana` (`comAula`, `comTexto`, `comEvento`, `comItem`) só testam se existe e somam contadores. Não registram corpo de resposta, texto de aula nem nome. A tag de `respostas_inesperadas` é só `{ grupo, status: 'semana_incompleta' }`.

Auditoria: não se aplica. Não há leitura de dado de aluno por coordenação ou rede, exportação, nota, permissão nem saída de IA.

Envio externo: nenhum. Nada sai para provedor de IA nem para terceiro, e `ExecucaoAgente` não se aplica.

Seed/fixture: sintético. O dado continua gerado e relativo a `now()`. Não há dump nem dado real.

Correções exigidas na rodada anterior: nenhuma. As duas recomendações estão no código:
- O comentário de `QUESTOES_SINTETICAS` voltou para junto da constante, depois do bloco novo (`carga-login.ts:109` no diff).
- As datas do calendário saem de `date_trunc('week', timezone('America/Sao_Paulo', now()))` (`carga-login.ts:463-466`).

Bloqueantes: nenhum.

Recomendações:
- Pela regra 20, vale manter a convenção de deixar "sintético" no próprio texto de toda descrição semeada, como já fazem as duas linhas novas de `evento_calendario`. Assim um dump do banco de carga não se confunde com dado de escola.

Pergunta de fechamento: a correção não cria dado de titular, rota nem envio. O arquivo do titular e a lista de compartilhamento ficam como estavam. A resposta à secretaria não muda.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-07 02:02:34 · `tasks/correcoes/2026-11-07-carga-da-semana.md`

VEREDITO: APROVADO
Caminho quente tocado: login (cenário de carga das 7h30, fase `rajada`, com `GET /v1/semana`)
Rate limit: ok (não foi alterado nesta rodada)
Fila e prioridade: ok (não se aplica, não há job novo)
Concorrência: protegida (não há caminho novo de escrita no produto; o `update` de `aplicada_em` só roda no seed da carga, com filtro `escola_id` e `ano_letivo_id`)
Índice e paginação: ok (nenhuma query nova no produto; a lista do aluno continua ordenada por id, `apps/api/src/atividade/minha-atividade/minha-atividade.repository.ts:149`, então mudar `aplicada_em` não desordena a paginação)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (o threshold `semanas_lidas == 60` agora exige a leitura completa, e o p95 próprio da rota continua; a espera do pool segue no TODO.md, como na 1ª rodada)
Bloqueantes: nenhum

Correções exigidas na 1ª rodada: nenhuma. As duas recomendações da 1ª rodada foram aplicadas:
- O comentário de `QUESTOES_SINTETICAS` voltou para junto da constante, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/infra/scripts/carga-login.ts`.
- O calendário e os itens do dia caem na semana em curso, calculada por `date_trunc('week', timezone('America/Sao_Paulo', now()))`. A data fixa de 2026-11 saiu.

A recomendação do threshold de 100 ms foi para o TODO.md, junto do item da métrica de espera do pool.

O que conferi no diff:
- O `insert` de `evento_calendario` usa `tipo` vindo de `VALUES`. A coluna é `text` com check em `('feriado', 'recesso', 'evento')` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/packages/core/src/db/schema/evento-calendario.ts`), e não um enum, então o insert passa. A soma `date + int` também está certa.
- O k6 fixa UTC-3 e o seed usa `America/Sao_Paulo`. Como não há horário de verão, as duas segundas coincidem, e o caso de semanas diferentes (seed no domingo, k6 na segunda) reprova o cenário, como está escrito no comentário.
- As quatro conferências (`comAula`, `comTexto`, `comEvento`, `comItem`) têm cada uma um bloco de mutação. O controle negativo com as três partes novas fora ao mesmo tempo reprovou o cenário.
- `infra/test/carga-login.test.ts` passou aqui: 43 de 43. Nenhum teste chama provedor pago.

Recomendações:
- Fazer uma corrida de controle negativo para cada parte (só sem texto, só sem evento, só sem item). Hoje a única prova de que cada conferência derruba o cenário sozinha é a mutação de texto. É cobertura extra, não bloqueia.
- O `update atividade_aplicada` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/infra/scripts/carga-login.ts` também vale para o `carga:importacao`, que usa o mesmo seed. Quando o item do TODO.md que pede para rodar a fase `previa_e_gravar` for feito, conferir que nada daquele cenário depende de `aplicada_em` ser o instante do seed.

## test-engineer · 2ª rodada · APROVADO · 2026-11-07 02:03:09 · `tasks/correcoes/2026-11-07-carga-da-semana.md`

VEREDITO: APROVADO

**Cenários exigidos:** Uma leitura da Semana só conta quando volta 200 e traz as cinco partes: aula (vínculo e grade), texto de aula, evento de calendário e item do dia. Se qualquer parte faltar, `semanas_lidas == 60` reprova e a leitura soma em `respostas_inesperadas`. Os eventos e os itens do dia têm data relativa à semana em curso em Brasília, e não data fixa. A segunda que o k6 pede sai no formato `AAAA-MM-DD`. O nome do contador é o que o threshold lê.

**Cobertos (cada correção exigida na 1ª rodada):**
1. **Eventos com data relativa:** feito. O `insert into evento_calendario` usa `date_trunc('week', timezone('America/Sao_Paulo', now()))::date + n` (`infra/scripts/carga-login.ts:462-468`). O bloco de mutação troca essa expressão pela data fixa '2026-11-02'.
2. **Texto, evento e item exigidos na mesma leitura:** feito com `comAula`, `comTexto`, `comEvento`, `comItem` e `completa` em `infra/k6/login-7h30.js`, cada um com bloco `= true`.
   - Conferi que o contrato tem os campos com esses nomes: `texto` é `z.string().nullable()`, e `eventos` e `itens` são arrays (`packages/shared/src/semana/semana.ts:36,68,70`). Então `aula.texto !== null` não fica verdadeiro sempre por campo inexistente.
   - A correção pedia item no dia de hoje; a escolha foi item em algum dia, com as atividades aplicadas passando a cair na segunda da semana. A cobertura é a mesma. A montagem põe cada item no dia do seu `data` (`apps/api/src/semana/montar-dias.ts:109`), e a segunda sempre vem na resposta. Assim o risco que apontei (k6 em outro dia que não o do seed, itens vazios sem ninguém ver) fica fechado, sem reprovar nos dias sem atividade aplicada.
3. **Blocos de mutação:** acrescentados para as quatro conferências, para o `semanasLidas.add`, para o `inesperadas.add` com `semana_incompleta`, para o nome do Counter, para a leitura do corpo só com 200, para o `.slice(0, 10)` e para os dois SQL relativos (eventos e `update atividade_aplicada`).
4. **Parágrafo das Mutações:** corrigido. Agora liga cada SQL à sua conferência: vínculo e alocação a `comAula`, `insert into aula` a `comTexto`, `insert into evento_calendario` a `comEvento`, disciplina e `aplicada_em` a `comItem`. Diz também que o SQL dar de fato o dado só a corrida real prova.
   - Há duas corridas de controle negativo: uma sem grade e outra com as três partes novas fora ao mesmo tempo. Ambas reprovaram com `semanas_lidas` em 0.
5. **Recomendações da 1ª rodada:** aplicadas (Counter, `status === 200`, `toISOString().slice`, aviso em `segundaDaSemana`, contagem de arquivos). As que não foram aplicadas estão no `TODO.md`, com o motivo.

Rodei `npx vitest run infra/test/carga-login.test.ts`: 43 de 43 verdes. Não há `.skip` nem mock, e nada chama provedor de IA.

**Bloqueantes:** nenhum.

**Recomendações:**
- `infra/k6/login-7h30.js`, linha `const lista = Array.isArray(dias) ? dias : []`: não tem `toContain` nem bloco. A falha é segura: com `[]` tudo vira falso e o cenário reprova; com `dias` puro, a corrida estoura numa resposta que não é 200. Mesmo assim, vale fixar com um `toContain`.
- `infra/scripts/carga-login.ts:466`: as tuplas dos eventos (`'feriado', 4, 4` e `'evento', 2, 3`) não são conferidas uma a uma. `comEvento` passa se só uma das duas cair na semana, porque ele só exige um evento em algum dia. Não é defeito da medida; seria cobertura do caminho do feriado (o dia de sexta sem aula), se quiserem.
- A mudança de `aplicada_em` para a segunda da semana não muda o cenário do aluno. O único repository que lê `aplicadaEm` é o da Semana (`packages/core/src/semana/semana.repository.ts:250`), e a corrida final passou com o Início do aluno intacto. Fica só o registro, caso alguma rota futura passe a ordenar por esse instante.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/infra/k6/login-7h30.js`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/infra/scripts/carga-login.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/infra/test/carga-login.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specsemana-do-professor--l1/tasks/correcoes/2026-11-07-carga-da-semana.md`
