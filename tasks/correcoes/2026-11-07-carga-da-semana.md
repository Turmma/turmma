# Correção — o `GET /v1/semana` não está no cenário de carga das 7h30

**Origem:** `TODO.md`, seção "Da semana-do-professor, tarefa 2.0 (`GET /v1/semana`), fora dela" (infra-guardian, 1ª e 2ª rodadas da 2.0): "A rota da Semana entra no cenário de carga das 7h30". O dono era a 6.0 (a tela que chama a rota), que não o fez, e nenhum revisor da 6.0 cobrou.
**Subagentes obrigatórios:** `test-engineer`, `infra-guardian`, `privacy-guardian`
<!-- O PEDIDO do Orquestrador ditou o infra-guardian. test-engineer é obrigatório em toda correção. O privacy-guardian vem do caminho: infra/ pede infra-guardian e privacy-guardian (`tools/processo/guardioes-por-caminho.ts`), e a correção semeia dado sintético de professor (vínculo, grade, texto de aula) no banco da carga. Os arquivos alterados são infra/ (o k6, o script do cenário e o teste dele) e o TODO.md: 4 arquivos fora de tasks/ e nenhum de .github/, tools/ci/ ou tools/processo/, então o revisor-geral não é obrigatório pelo passo 5 do corrigir. -->

## Sintoma

O professor abre a Semana na manhã de segunda, junto com a rajada de login das 7h30, e a rota roda as cinco consultas da semana em sequência, uma
conexão do pool por vez (`SemanaService.ler`). O cenário "login às 7h30" (`infra/k6/login-7h30.js`, fase `rajada`) só fazia, para o professor,
as autenticadas de sempre (`/v1/sistema/contexto`), e a escola da carga não dava ao professor vínculo, grade nem calendário: a rota nunca foi medida
sob carga, e, mesmo se fosse chamada, responderia o vazio de "grade não importada", que não paga a consulta nenhuma.

## Fora desta correção

Nada: o pedido veio sem arquivos da tarefa em curso, e a árvore estava limpa.

## Causa

A linha do `TODO.md` pôs a medida na 6.0, "antes de a tela da 6.0 entrar", mas a 6.0 só trouxe a tela (`apps/web`), e o `N_task.md` dela não a cita: o dono de
item do `TODO.md` posto numa tarefa não chega aos revisores dela. Para o cenário medir de verdade faltavam duas coisas, não uma: o passo do professor no k6 e o
dado que faz a rota trabalhar (vínculos de professor, grade, texto de aulas, calendário e itens do dia).

## Teste que reproduz

A causa é uma lacuna no cenário, e não um defeito de código com entrada e saída; o que prova a correção é o cenário passar a medir a rota, e o que
a protege é o teste de `infra/test/carga-login.test.ts` (dois grupos de casos novos, abaixo) mais a corrida real do k6.

- Os casos novos de `infra/test/carga-login.test.ts` (`a Semana do professor na rajada do cenário "login às 7h30"`) ficam **vermelhos antes** (a rota `/v1/semana` não
  está no script, e o teste de rotas exige exatamente a lista que o script chama) e verdes depois.
- **Medida final (critério completo: aula, texto, evento e item do dia; load 4):** `npm run carga:login -- --fases rajada` (base e rajada), 8 min, passou. Na rajada, `GET /v1/semana`
  p95 = **26 ms** (limite 1 s), `semanas_lidas` = 60 de 60 (200 e completas), `dropped_iterations` = 0, 0 erro final, 0 resposta 429 e 0 resposta 503,
  `login_duracao` p95 = 103 ms, `GET /v1/minhas-atividades` p95 = 11 ms, autenticadas da rajada p95 = 10 ms, atraso do event loop (p99, máximo) 80 ms. Na base, 0 erro. A primeira medida, com o critério só de
  aula e as datas de calendário fixas, deu p95 = 47 ms e 60 de 60, na mesma máquina (load 4): a diferença entre as duas é a oscilação da corrida, e não do critério.
- **Controles negativos da medida (corridas de `--fases rajada`, o arquivo restaurado antes do portão):** (1) sem grade (aulas por vínculo trocadas por 0): **reprovou**, `semanas_lidas count==60` (veio 0) e
  `respostas_inesperadas{grupo:rajada} count==0`, com o resto da rajada intacto e `GET /v1/semana` em p95 = 41 ms, que é a rota vazia: sem o threshold de leitura, a rota vazia passaria no p95.
  (2) com as três partes novas fora ao mesmo tempo (nenhum texto de aula, evento cem dias adiante, atividades aplicadas trinta dias atrás): **reprovou** do mesmo jeito, `semanas_lidas count==60` (veio 0)
  e `respostas_inesperadas{grupo:rajada} count==0`, com `GET /v1/semana` em p95 = 18 ms. Não rodei uma corrida por parte (texto, evento e item); cada uma tem a sua conferência em `leituraDaSemana` e o bloco de mutação dela.

## Correção

- `infra/scripts/carga-login.ts`: o seed de cada escola da carga dá a **cada professor** `TURMAS_POR_PROFESSOR` (6) vínculos `confirmado` de professor, na disciplina das
  atividades semeadas, `AULAS_POR_VINCULO_NA_SEMANA` (3) aulas por vínculo na grade (18 por professor), o texto da semana em curso nas aulas de segunda e terça, e dois
  eventos de calendário **nessa mesma semana** (um feriado na sexta e uma semana de avaliações de quarta a quinta). As 60 atividades por turma, que o seed do aluno
  aplica com o instante do seed, passam a ter `aplicada_em` na **segunda** da semana em curso (a lista do aluno ordena pelo id, e não por esse instante): dia útil que
  sempre vem na resposta, mesmo se o seed rodar num fim de semana, e o pior caso dos itens do dia (6 turmas × 60 atividades). Tudo relativo à semana de Brasília, a mesma que o k6
  pede, e nada em data fixa. A função nova é `semearASemanaDosProfessores`; `semearTurmasEAtividades` passou a receber os ids da equipe. O registro da fase mostra `semanas_lidas`.
  Limite conhecido, que já era do seed: o ano letivo semeado é o de 2026 (01/02 a 18/12); fora dele a rota devolve a semana sem dia e o cenário **reprova**, e não passa em silêncio.
- `infra/k6/login-7h30.js`: na `rajada`, a conta de e-mail (o professor) lê `GET /v1/semana?segunda=<segunda de Brasília>` depois do login, uma vez
  (`leituraDaSemana`). A rota ganha limite próprio (`autenticada_duracao{grupo:rajada,name:GET /v1/semana}` com p95 abaixo de 1 s, o mesmo do login e do Início do aluno) e o threshold
  `semanas_lidas == 60`. A leitura só conta quando volta 200 **e completa**: ao menos uma aula, o texto de ao menos uma aula, um evento de calendário em algum dia e um item em algum dia.
  Qualquer parte que falte soma em `respostas_inesperadas` (`semana_incompleta`), e o threshold de `semanas_lidas` reprova. Cada parte do seed tem assim uma conferência: vínculo e grade (aula),
  `insert into aula` (texto), `insert into evento_calendario` (evento) e a disciplina do vínculo mais a data das atividades (item do dia).
- `infra/test/carga-login.test.ts`: as rotas que o cenário chama passam a incluir `/v1/semana`, e os casos novos fecham as cláusulas acima.
- **O `carga:importacao` herda a Semana.** `infra/scripts/carga-importacao.ts` chama o mesmo `semearContas` e a mesma fase `rajada` do k6 (`prepararARajada`, `iniciarARajada`), então o seed e o
  threshold `semanas_lidas` valem também lá. A corrida dele (fase `previa_e_gravar`) **não foi rodada** nesta correção: fica no `TODO.md`.

**Pool.** O TODO falava no limite de 100 ms para a espera do pool (R40). Essa espera **não é exportada**: `observeDatabasePool` só publica `db_pool_em_uso` e as conexões
descartadas, e nenhum teste do repositório lê a espera. Esta correção não cria a métrica (seria código de `packages/core`, fora do que o pedido manda); a medida que entra é a do p95
da rota, que inclui a espera do pool, com o limite de 1 s do cenário. Fica no `TODO.md` a métrica de espera do pool, para quem for medir o R40.

## Mutações

--faltando: 0 linhas (19 blocos, 1 motivos)

**Sem bloco, com o motivo, e o que cada coisa prova.** As cinco consultas SQL de `semearASemanaDosProfessores` e de `semearTurmasEAtividades` (vínculo, alocação, aula, evento e a data das atividades) e a passagem de
`equipeIds` rodam contra o Postgres do compose de carga, que o teste de unidade não sobe. Quem as prova é a corrida do k6, cada uma por uma conferência própria em `leituraDaSemana`, e
não só pelo `semanas_lidas == 60` de aula:

- vínculo e alocação → `comAula`; o `insert into aula` → `comTexto`; o `insert into evento_calendario` → `comEvento`; a disciplina do vínculo e o `update` de `aplicada_em` → `comItem`.
- Cada conferência tem bloco abaixo (o texto do k6 que a faz), e o texto do SQL que dá o dado à semana em curso (`semana.segunda + evento.de…`, o `update atividade_aplicada…`, o `date_trunc('week', …)` da aula) tem bloco.
- O que **não** tem prova por mutação de texto é o SQL dar de fato o dado: isso é a corrida real. Rodadas: a da Semana completa (acima) e os dois controles negativos da seção "Teste que reproduz": o da grade e o das três partes juntas.

O professor abre a Semana depois do login, e só ele (a conta de matrícula continua só no Início do aluno).

```mutacao
arquivo: infra/k6/login-7h30.js
teste: infra/test/carga-login.test.ts › só o professor lê a Semana, uma vez, depois do login, e a conta de matrícula continua só no Início do aluno
   if (conta.matricula !== undefined) leituraDoInicio(token, 'rajada')
-  if (conta.email !== undefined) leituraDaSemana(token, 'rajada')
```

A Semana tem o limite de 1 s sozinha: sem a linha, a rota lenta se esconderia na média das outras.

```mutacao
arquivo: infra/k6/login-7h30.js
teste: infra/test/carga-login.test.ts › a rajada julga o p95 da Semana sozinho, no limite de 1 s do login, e exige as leituras de todos os professores
           // falhou, e que a consulta que a Semana paga nem rodou de verdade.
-          [`autenticada_duracao{grupo:rajada,name:${ROTA_DA_SEMANA}}`]: [`p(95)<${P95_MAXIMO_DO_LOGIN_MS}`],
```

Os 60 professores leram a Semana completa: sem o threshold, um seed que não deu a Semana inteira passaria.

```mutacao
arquivo: infra/k6/login-7h30.js
teste: infra/test/carga-login.test.ts › a rajada julga o p95 da Semana sozinho, no limite de 1 s do login, e exige as leituras de todos os professores
           [`autenticada_duracao{grupo:rajada,name:${ROTA_DA_SEMANA}}`]: [`p(95)<${P95_MAXIMO_DO_LOGIN_MS}`],
-          semanas_lidas: [`count==${PROFESSORES_NA_RAJADA}`],
```

O nome do contador é o que o threshold e o registro da fase leem.

```mutacao
arquivo: infra/k6/login-7h30.js
teste: infra/test/carga-login.test.ts › a semana sem aula, ou sem 200, conta como resposta inesperada e não como leitura
-const semanasLidas = new Counter('semanas_lidas')
+const semanasLidas = new Counter('semanas')
```

A leitura só conta quando é completa.

```mutacao
arquivo: infra/k6/login-7h30.js
teste: infra/test/carga-login.test.ts › a semana sem aula, ou sem 200, conta como resposta inesperada e não como leitura
   const completa = comAula && comTexto && comEvento && comItem
-  semanasLidas.add(completa ? 1 : 0)
```

A semana incompleta, ou sem 200, é resposta inesperada.

```mutacao
arquivo: infra/k6/login-7h30.js
teste: infra/test/carga-login.test.ts › a semana sem aula, ou sem 200, conta como resposta inesperada e não como leitura
   semanasLidas.add(completa ? 1 : 0)
-  inesperadas.add(resposta.status !== 200 || completa ? 0 : 1, { grupo, status: 'semana_incompleta' })
```

Só lê o corpo quando volta 200.

```mutacao
arquivo: infra/k6/login-7h30.js
teste: infra/test/carga-login.test.ts › a semana sem aula, ou sem 200, conta como resposta inesperada e não como leitura
-  const dias = resposta.status === 200 ? resposta.json('dias') : undefined
+  const dias = resposta.json('dias')
```

Sem aula na semana, o vínculo ou a grade não vieram do seed.

```mutacao
arquivo: infra/k6/login-7h30.js
teste: infra/test/carga-login.test.ts › a leitura só é completa com aula, texto de aula, evento de calendário e item do dia: cada parte do seed tem a sua conferência
-  const comAula = lista.some((dia) => dia.aulas.length > 0)
+  const comAula = true
```

Sem o texto de nenhuma aula, o `insert into aula` do seed pode ter sumido e a leitura do registro nem rodou.

```mutacao
arquivo: infra/k6/login-7h30.js
teste: infra/test/carga-login.test.ts › a leitura só é completa com aula, texto de aula, evento de calendário e item do dia: cada parte do seed tem a sua conferência
-  const comTexto = lista.some((dia) => dia.aulas.some((aula) => aula.texto !== null))
+  const comTexto = true
```

Sem evento em nenhum dia, o `insert into evento_calendario` pode ter sumido (ou caído em outra semana) e a consulta do calendário nem rodou.

```mutacao
arquivo: infra/k6/login-7h30.js
teste: infra/test/carga-login.test.ts › a leitura só é completa com aula, texto de aula, evento de calendário e item do dia: cada parte do seed tem a sua conferência
-  const comEvento = lista.some((dia) => dia.eventos.length > 0)
+  const comEvento = true
```

Sem item em nenhum dia, a disciplina do vínculo ou a data das atividades aplicadas saiu do seed e os itens do dia nem rodaram.

```mutacao
arquivo: infra/k6/login-7h30.js
teste: infra/test/carga-login.test.ts › a leitura só é completa com aula, texto de aula, evento de calendário e item do dia: cada parte do seed tem a sua conferência
-  const comItem = lista.some((dia) => dia.itens.length > 0)
+  const comItem = true
```

A segunda é a de Brasília (UTC-3), a mesma que o seed grava: sem o fuso, de domingo à noite a rota pediria a segunda errada.

```mutacao
arquivo: infra/k6/login-7h30.js
teste: infra/test/carga-login.test.ts › a segunda pedida é a de Brasília, a mesma que o seed grava
-  const hoje = new Date(Date.now() - 3 * 3_600_000)
+  const hoje = new Date(Date.now() - 0 * 3_600_000)
```

A data sai no formato `AAAA-MM-DD`, o único que a consulta aceita.

```mutacao
arquivo: infra/k6/login-7h30.js
teste: infra/test/carga-login.test.ts › a segunda pedida é a de Brasília, a mesma que o seed grava
-  return new Date(hoje.getTime() - ((hoje.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10)
+  return new Date(hoje.getTime() - ((hoje.getUTCDay() + 6) % 7) * 86_400_000).toISOString()
```

O professor da carga dá aula em mais de uma turma.

```mutacao
arquivo: infra/scripts/carga-login.ts
teste: infra/test/carga-login.test.ts › o professor da carga dá aula em turmas da escola, com grade e texto de aulas: a rota não responde o vazio de "grade não importada"
-export const TURMAS_POR_PROFESSOR = 6
+export const TURMAS_POR_PROFESSOR = 1
```

E cada vínculo tem mais de uma aula na semana.

```mutacao
arquivo: infra/scripts/carga-login.ts
teste: infra/test/carga-login.test.ts › o professor da carga dá aula em turmas da escola, com grade e texto de aulas: a rota não responde o vazio de "grade não importada"
-export const AULAS_POR_VINCULO_NA_SEMANA = 3
+export const AULAS_POR_VINCULO_NA_SEMANA = 1
```

O texto das aulas é o da semana de Brasília: a mesma segunda que o k6 pede.

```mutacao
arquivo: infra/scripts/carga-login.ts
teste: infra/test/carga-login.test.ts › a segunda pedida é a de Brasília, a mesma que o seed grava
-     select escola_id, ano_letivo_id, vinculo_id, date_trunc('week', timezone('America/Sao_Paulo', now()))::date + dia_semana - 1, inicio, fim, 'Aula sintética: revisão do conteúdo'
+     select escola_id, ano_letivo_id, vinculo_id, date_trunc('day', timezone('America/Sao_Paulo', now()))::date + dia_semana - 1, inicio, fim, 'Aula sintética: revisão do conteúdo'
```

Os eventos caem na semana em curso, e não numa data fixa que a corrida de outra semana não alcança.

```mutacao
arquivo: infra/scripts/carga-login.ts
teste: infra/test/carga-login.test.ts › o calendário e os itens do dia do seed caem na semana em curso de Brasília, e não em data fixa
-     select $1, $2, evento.tipo, semana.segunda + evento.de, semana.segunda + evento.ate, evento.descricao
+     select $1, $2, evento.tipo, date '2026-11-02' + evento.de, date '2026-11-02' + evento.ate, evento.descricao
```

Os itens do dia caem na segunda da semana em curso, e não no instante em que o seed rodou (que num fim de semana não aparece na resposta).

```mutacao
arquivo: infra/scripts/carga-login.ts
teste: infra/test/carga-login.test.ts › o calendário e os itens do dia do seed caem na semana em curso de Brasília, e não em data fixa
-    `update atividade_aplicada set aplicada_em = date_trunc('week', timezone('America/Sao_Paulo', now())) at time zone 'America/Sao_Paulo'
+    `update atividade_aplicada set aplicada_em = now()
```

O registro da fase mostra as leituras da Semana.

```mutacao
arquivo: infra/scripts/carga-login.ts
teste: infra/test/carga-login.test.ts › o registro da fase mostra quantos professores leram a Semana e o p95 dela
-    .filter(([chave]) => /^(atacante:)?(login_duracao\{grupo:[^}]+\} (p\(95\)|max)|ate_entrar_[a-z_]+ (p\(95\)|max)|autenticada_duracao\{grupo:[^}]+\} p\(95\)|(respostas_429|respostas_503|login_erro_final|contas_que_entraram|semanas_lidas|renovacao_409|renovacao_recusada|ataque_enviado)(\{grupo:[^}]+\})? count|dropped_iterations count)$/.test(chave))
+    .filter(([chave]) => /^(atacante:)?(login_duracao\{grupo:[^}]+\} (p\(95\)|max)|ate_entrar_[a-z_]+ (p\(95\)|max)|autenticada_duracao\{grupo:[^}]+\} p\(95\)|(respostas_429|respostas_503|login_erro_final|contas_que_entraram|renovacao_409|renovacao_recusada|ataque_enviado)(\{grupo:[^}]+\})? count|dropped_iterations count)$/.test(chave))
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (1ª) | O `carga:importacao` também semeia a Semana (`carga-importacao.ts:581`, `semearContas`) e herda o threshold `semanas_lidas`; rodar a fase `previa_e_gravar` uma vez | `TODO.md`: rodar a fase e registrar. Corrida de minutos que toca outro cenário; a seção "Correção" diz que ele herda a Semana e que a corrida dele ficou pendente |
| test-engineer (1ª) | Leitura que não volta 200 soma duas vezes em `respostas_inesperadas` (`autenticada` e `semana_incompleta`) | `TODO.md`: o threshold continua certo, só a contagem infla; mudar a soma muda a métrica e o bloco de mutação |
| test-engineer (1ª) | Professor com duas disciplinas na mesma turma não entra no seed | `TODO.md`: cobertura extra, não é defeito da medida |
| infra-guardian (1ª) | Quando a métrica de espera do pool existir, pôr o threshold de 100 ms (R40) na `rajada` ao lado do p95 de `GET /v1/semana` | `TODO.md`: entra no item "Exportar a espera do pool de conexões do banco"; depende da métrica, que não existe |
| test-engineer (2ª) | `login-7h30.js`, `const lista = Array.isArray(dias) ? dias : []`: sem `toContain` nem bloco; a falha é segura (com `[]` tudo vira falso e o cenário reprova) | `TODO.md`: cobertura extra, a falha já reprova o cenário |
| test-engineer (2ª) | `carga-login.ts`: as tuplas dos eventos (`'feriado', 4, 4` e `'evento', 2, 3`) não são conferidas uma a uma; `comEvento` passa com um evento só | `TODO.md`: cobertura do caminho do feriado (sexta sem aula); não é defeito da medida |
| test-engineer (2ª) | `aplicada_em` na segunda da semana não muda o cenário do aluno; só registro, caso uma rota futura ordene por esse instante | Só registro, sem ação: hoje o único leitor de `aplicadaEm` é o repository da Semana |
| infra-guardian (2ª) | Corrida de controle negativo para cada parte nova (só sem texto, só sem evento, só sem item); hoje a única prova isolada é a mutação de texto | `TODO.md`: corrida de minutos por parte; as duas corridas feitas (sem grade e sem as três partes) cobrem o conjunto |
| infra-guardian (2ª) | O `update atividade_aplicada` também vale para o `carga:importacao`; ao rodar a fase `previa_e_gravar`, conferir que nada dali depende de `aplicada_em` ser o instante do seed | `TODO.md`: junto do item que já pede rodar a fase `previa_e_gravar` |
| privacy-guardian (2ª) | Manter "sintético" no texto de toda descrição semeada, como as duas linhas novas de `evento_calendario` | Convenção, sem ação: já cumprida |

Aplicadas (1ª rodada): as datas do calendário relativas à semana em curso, com as conferências de texto, evento e item do dia (test-engineer, infra-guardian e privacy-guardian); o comentário de
`QUESTOES_SINTETICAS` junto da constante (infra-guardian e privacy-guardian); o aviso de semanas diferentes no comentário de `segundaDaSemana`, os `toContain` do nome do contador, da leitura do corpo e do
`toISOString().slice(0, 10)` (test-engineer) e a contagem de arquivos do comentário do documento (test-engineer).

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-07 01:32:29 | 2026-11-07 01:32:59 | `privacy-guardian` | 1 | APROVADO | abf6b2cec676493fa |
| 2026-11-07 01:32:28 | 2026-11-07 01:33:17 | `infra-guardian` | 1 | APROVADO | a1a159592198a3ecc |
| 2026-11-07 01:32:27 | 2026-11-07 01:34:42 | `test-engineer` | 1 | REPROVADO | a2490bdb7aa44621f |
| 2026-11-07 02:02:06 | 2026-11-07 02:02:22 | `privacy-guardian` | 2 | APROVADO | abcdbb562675b964c |
| 2026-11-07 02:02:01 | 2026-11-07 02:02:34 | `infra-guardian` | 2 | APROVADO | af46665dac05f4523 |
| 2026-11-07 02:01:57 | 2026-11-07 02:03:09 | `test-engineer` | 2 | APROVADO | abf60729dbe08e0bf |
