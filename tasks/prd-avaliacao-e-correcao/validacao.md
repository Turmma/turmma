# Validação — avaliacao-e-correcao (F6, prova online)

## Rodada 2 — 28/11/2026

**Escopo:** funcionalidade completa (RF1 a RF10; os RF11 a RF20 são a F6d)
**Commit validado:** `da9a83ca`
**Veredito: APROVADA COM RESSALVAS**

Revalidação depois das três correções da rodada 1: `3cf62a54` (o `EXPLAIN` da rotina, só teste), `c83ad085` (o
`professor-prova.spec.ts` perto do prazo, só teste) e `aa21262e` (os textos do Tutor na prova com janela, só tela e a
mensagem de `TUTOR_PAUSADO_EM_AVALIACAO`). De `cb64ca5f` a `da9a83ca` nenhum arquivo de `apps/api`, `apps/worker/src` nem
`packages/core` mudou (`git diff --stat cb64ca5f..da9a83ca`): o código dos RF no servidor é o que a rodada 1 leu, e eu o
reli nos pontos de cada RF (as linhas abaixo conferem com a árvore). O crítico e os dois maiores da rodada 1 estão
resolvidos. Ficam dois maiores, nenhum crítico: um que a rodada 1 não viu (a participação da professora não conta a
tentativa vencida) e um que a correção dos textos deixou (o roteiro da demonstração diz o texto antigo).

### 1. RF a RF

Fotos em `.processo/vitrine/` (fora do git), da web reconstruída da árvore de `da9a83ca` (o e2e abaixo subiu o ambiente às
11:59; a web que estava de pé era das 10:13, de antes da correção dos textos, e não serviu). Escola cheia da vitrine, com
uma prova nova aplicada pela API da professora (`01a222ac-ae5a…`, janela de 11:31 a 15:01, 40 min, embaralhando) e a
"(foco)" da rodada 1, aberta até amanhã, com a tentativa do Caio vencida. Todas lidas como imagem, a 1366 e a 360. Nenhuma
tela da prova rola a 1366 × 768; só `/aluno/atividades` rola (792 px), lista sem RF que exija caber.

| RF | Situação | Código | Teste | Observação |
|---|---|---|---|---|
| RF1 | ATENDIDO | `packages/shared/src/atividade/limite-da-tentativa.ts:109-113` (`limiteBaseDaTentativa`, o `min` com o `fecha_em`); `minha-atividade.service.ts:220-240` (`comecar`: alcance, depois a janela no `now()` do banco, `agora >= fecha_em` já fechou) | `prova-online-aluno.int.test.ts` ("antes de `abre_em` e depois de `fecha_em` é PROVA_FORA_DA_JANELA…", "a 10 min do `fecha_em` com duração 40 o limite é o `fecha_em`…"); `prova-online.int.test.ts` ("a avaliativa nova sem janela é ENTRADA_INVALIDA…") | Mutação nesta rodada (abaixo). Fotos: `professora--professor-artefatos-01a2224c-84e0…--Na-turma-button-name-Aplicar-à-turma-input-value-avaliativa--{computador,celular}.png` (Abre em, Fecha em, "No horário da escola", e o texto novo do Tutor na escolha); `aluno--aluno-atividades-01a222ac-ae5a…--{computador,celular}.png` ("Esta prova tem 40 minutos…", "Ela fecha às 15:01.") |
| RF2 | ATENDIDO | `atividade-aplicada.service.ts:110-151` (`mudarAJanela`: `for update`, relê, `PROVA_JA_COMECOU`) | `prova-online.int.test.ts` ("com uma tentativa iniciada, a mudança é PROVA_JA_COMECOU, em cada campo…", corridas "(b)" e "(k)"); `prova-online-aluno.int.test.ts` "(b) mudar a janela × começar" | Depois do começo o painel só oferece "Estender" (foto `professora--turma-painel-prova-nova--computador.png`, com o Caio fazendo: sem "Mudar janela") |
| RF3 | ATENDIDO | `atividade-aplicada.service.ts:79-101`; `duracaoDoAlunoEmMinutos`; schema `.strictObject` sem motivo | `prova-online.int.test.ts` ("+25%, +50% e +100% sobre 40 min…", "…chave a mais (motivo)…"); `prova-online-aluno.int.test.ts` ("o tempo adicional do aluno vira só a duração dele: 60…, e o colega lê 40") | O painel diz só "1 aluno com tempo adicional", sem nome nem percentual (foto `professora--turma-painel-prova-vencida--computador.png`) |
| RF4 | ATENDIDO | `extensao.service.ts:34` (`estender`, chave por aplicação, `for share`); `limiteDaTentativa` (soma só a do aluno e a da turma), e de novo na consulta do aluno (`minha-atividade.repository.ts:325`) | `extensao.int.test.ts` ("10 min só para a Ana…", "a turma toda…", "(d) estender × estender"); `limite-da-tentativa.test.ts` ("a extensão do aluno e a da turma somam, e a de outro aluno não entra"); `encerrar-provas.int.test.ts` ("não encerra enquanto o aluno estendido tem tempo…"); e2e `professor-prova.spec.ts:90` | Mutação nesta rodada (abaixo). Foto: `professora--turma-painel-prova-nova--{computador,celular}.png` ("Fazendo · termina às 12:41", "Estender", "Estender a turma toda") |
| RF5 | ATENDIDO | `minha-atividade.service.ts:264-279` (PUT, `TEMPO_ESGOTADO` sem gravar); `packages/core/src/atividade/encerramento.ts` (a vencida recebe `enviada_em` = limite e `envio = 'limite'`); a rotina do worker | `prova-online-aluno.int.test.ts` ("um minuto antes do limite grava; depois dele é TEMPO_ESGOTADO, sem linha…"); `encerrar-provas.int.test.ts` ("a vencida sem envio entra na correção com o que salvou…"); `ProvaEmFoco.test.tsx` | O critério do PRD (o item depois do limite fica fora da correção; o aluno vê por quê) está provado. **Mas** a contagem "enviaram" da professora não conta a vencida enquanto a janela não fecha: maior, seção 4. Fotos: `aluno--aluno-atividades--computador.png` (a "(foco)" vencida já em "Entregues"); `professora--turma-painel-prova-vencida--computador.png` ("Tempo esgotado" no acompanhamento, "0 de 1 aluno enviaram" na linha de cima) |
| RF6 | ATENDIDO | `apps/api/src/atividade/pulso/*`; `limiteDaTentativa` (ponto fixo, lacuna aberta); `apps/web/src/areas/aluno/fila-de-respostas.ts`, `respostas.ts` | `pulso.int.test.ts`; `prova-online-aluno.int.test.ts` ("a indisponibilidade fechada de 5 min devolve o tempo…", "a lacuna aberta montada à mão…"); `encerrar-provas.int.test.ts` ("com o pulso velho o job para sem encerrar…", "(l) pulso × rotina"); e2e `aluno-prova.spec.ts:146` (rodado na rodada 1, arquivo sem mudança desde então) | A carga: a rodada de `carga:prova` do `estado.md` (28/11 ~10:15): 42.000 enviadas = 42.000 gravadas, fila vazia em 23,9 s, a queda de 100 s andou o limite em 100 s. Não refeita (nada do caminho mudou depois dela) |
| RF7 | ATENDIDO | `apps/web/src/areas/aluno/routes.tsx` (`/aluno/prova/:id` fora da casca); `ProvaEmFoco.tsx`; `AntesDeComecar.tsx` | `ProvaEmFoco.test.tsx` (rodado: verde); e2e `aluno-prova.spec.ts` (rodada 1) | Fotos: `aluno--aluno-atividades-01a222ac-ae5a…--{computador,celular}.png` ("Antes de começar": duração, a aba, como sair, Começar); `aluno--aluno-prova-01a222ac-ae5a…--{computador,celular}.png` (só a prova, "Faltam 40 min" e "Sair da prova", sem lateral nem Tutor). No celular, com um enunciado de três linhas, o "Enviar a prova" fica pela metade na borda do miolo, que rola (menor, seção 4) |
| RF8 | ATENDIDO | `apps/api/src/atividade/minha-atividade/ordem-da-prova.ts:47-80` (`sortearOrdem`, `naOrdemDoAluno`) | `embaralhamento.int.test.ts` ("sorteio fixo, dois alunos…: acerta nos dois pelo índice original", "o desempenho por habilidade… são os da ordem original", "retomada…") | Mutação nesta rodada (abaixo). Foto: a prova nova embaralhada, a 1ª questão é a 3 do artefato (`aluno--aluno-prova-01a222ac-ae5a…--computador.png`) |
| RF9 | ATENDIDO | `minha-atividade.service.ts:309-319` (`registrarSaida`); `saida-da-aba.repository.ts`; `fila-de-saidas.ts`; `aprovar.ts` (`AVISO_DA_SAIDA_DA_ABA`) e `Aprovar.tsx` | `saida-da-aba.int.test.ts` (19 casos); `arquivo-do-titular.int.test.ts`; e2e `professor-prova.spec.ts:138` ("o lote da prova traz '1' na coluna 'Saiu da aba' e o aviso fixo…", rodado aqui) | A tela do Aprovar não mudou desde a rodada 1 (foto dela lá: a coluna e o aviso fixo, no computador e no celular); nesta rodada a prova é o e2e acima, contra a API real, nos dois projetos |
| RF10 | ATENDIDO | `segunda-chamada.service.ts:23-59`; o alcance pelo convocado em `minha-atividade.repository.ts:140-156` | `segunda-chamada.int.test.ts` (18 casos); e2e `professor-prova.spec.ts:192` (rodado aqui) | Tela sem mudança desde a rodada 1 (foto do diálogo lá) |

RF: 10 atendidos, 0 parciais, 0 não atendidos, 0 não verificáveis.

Provas de mutação, diferentes das três da rodada 1 (cada uma aplicada, o teste rodado isolado e o arquivo restaurado com
`git checkout --`; a árvore terminou limpa):

| RF | Cláusula removida | Teste que ficou vermelho |
|---|---|---|
| RF4 (só o estendido segue) | o filtro `extensao.alunoId === null \|\| extensao.alunoId === entrada.alunoId` de `limiteDaTentativa` vira `() => true` | `limite-da-tentativa.test.ts` › "a extensão do aluno e a da turma somam, e a de outro aluno não entra" (`expected 1796124300000 to be 1796122500000`); `extensao.int.test.ts` › "10 min só para a Ana…" (`expected 600000 to be +0`). Pelo caminho do aluno (`prova-online-aluno.int.test.ts`, "a extensão do aluno e a da turma somam…") a mesma mutação **passa**: a consulta do aluno já filtra por ele (`minha-atividade.repository.ts:325`). É defesa em dobro, e não teste fraco: a função é que serve a rotina, o acompanhamento e o Tutor, que passam todas as extensões |
| RF1 (quem começa tarde tem só o que sobra) | o `Math.min(…, fechaEm)` de `limiteBaseDaTentativa` | `prova-online-aluno.int.test.ts` › "a 10 min do `fecha_em` com duração 40 o limite é o `fecha_em`…" (`expected '…15:47:18' to be '…15:17:18'`) |
| RF8 (correção pela ordem original) | em `naOrdemDoAluno`, a ordem das alternativas pela **posição** da questão na tela, e não pelo número dela | `embaralhamento.int.test.ts` › "sorteio fixo, dois alunos…" (`expected [ [ 1, 2, +0, 3 ], …(4) ] to deeply equal …`) |

### 2. Regras de negócio, casos de borda e critério de pronto

Sem mudança de código no servidor desde a rodada 1, as linhas dela continuam valendo; abaixo, só o que esta rodada
conferiu de novo ou mudou de situação.

| Item | Situação | Evidência |
|---|---|---|
| Regras de negócio do PRD §6 (as oito) | cumpridas | como na rodada 1; os testes de cada uma rodados de novo aqui (seção 3), verdes |
| Regra: prova aberta trava o Tutor da turma, e a tela diz quando | cumprida | `tutor-trava-da-prova.int.test.ts` (verde); os textos agora dizem "durante a prova, da abertura até ela fechar" na prova com janela e mantêm o de antes da F6 sem janela (`atividades.ts:27`, `aprovar.ts:151`, `avisoDaAvaliacao`, `avisoDaAvaliativaAberta`; `Atividades.test.tsx`, `AtividadesDaTurma.test.tsx`, `atividades.test.ts`). Fotos: `aluno--aluno-atividades--computador.png`, `aluno--aluno-inicio--computador.png`, `professora--turma-painel-prova-nova--computador.png` e o diálogo de aplicar |
| Casos de borda do PRD §7 (os sete) | seis cobertos, um justificado | como na rodada 1 (o leitor de tela segue como premissa da Tech Spec §12, para a etapa 5 da AIA, F6d) |
| Pronto: RF1 a RF10 | cumprido | seção 1 |
| Pronto: o Tutor travado para cada aluno até o fim da prova dele | cumprido | `tutor-trava-da-prova.int.test.ts`; o maior da rodada 1 (os três textos "até você encerrar") resolvido |
| Pronto: o roteiro da demonstração conferido contra `e2e/roteiro-da-demonstracao.spec.ts` | cumprido na 10.0 e na 12.0, e desfeito pela correção dos textos | o e2e passou a esperar "o Tutor fica pausado durante a prova, da abertura até ela fechar" (`roteiro-da-demonstracao.spec.ts:482`), e `docs/roteiro-da-demonstracao.md:226-227` ainda manda ler "até quem dá a aula encerrar": maior, seção 4 |
| Pronto: etapa 1 da AIA da correção de objetiva | cumprido | `docs/aia/correcao-de-objetiva.md`, sem mudança |
| "Pronto quando" do roadmap | cumprido | e2e `aluno-prova.spec.ts:146` (rodada 1); `saida-da-aba.int.test.ts` (verde aqui) |

### 3. Portão

| Portão | Resultado |
|---|---|
| `npm run typecheck` | não rodado: suíte inteira, na esteira (D79) |
| `npm run lint` | não rodado: idem |
| `npm run test` | não rodado inteiro. Rodados isolados, como evidência: `apps/worker/test/encerrar-provas.int.test.ts` **duas vezes seguidas no mesmo banco**, sem `EDUCA_BANCO_NOVO` (38 ✅ e 38 ✅; o banco tinha um ano `encerrado` e um `planejado`, e o arquivo agora planta os dele); `prova-online` (API e schema), `prova-online-aluno`, `extensao`, `embaralhamento`, `saida-da-aba`, `segunda-chamada`, `tutor-trava-da-prova`, `pulso` e `arquivo-do-titular` (10 arquivos, 231 ✅); os testes de unidade da correção dos textos e da tela da prova (`Atividades`, `atividades`, `EscolhaDaAtividade`, `Inicio`, `tutor`, `ProvaEmFoco`, `AtividadesDaTurma`, `AplicacaoDoArtefato`: 204 ✅); 3 mutações, todas vermelhas |
| `npm run test:e2e` | rodado `e2e/professor-prova.spec.ts` (`node tools/ci/e2e.ts --manter-ambiente`): 12 ✅ em chromebook e celular, de 7,4 a 12,3 s por caso (eram 13,6 a 15,5 s na rodada 1; o limite do portão é 15 s) |
| `npm run test:infra` | não rodado (esteira) |
| Esteira do GitHub | conferida no fechamento, pelo Orquestrador: não entra no veredito |
| Revisões com veto registradas e aprovadas | ✅ as 12 tarefas como na rodada 1 (nenhum `N_task.md` mudou); as três correções têm rodada de cada revisor obrigatório, com a última APROVADO (`2026-11-28-encerrar-provas-explain-banco-acumulado`: seis na 1ª e `revisor-geral` na 2ª; `2026-11-28-e2e-professor-prova-no-prazo`: seis na 1ª e `revisor-geral` na 2ª; `2026-11-28-textos-do-tutor-na-prova`: sete na 2ª, depois de duas reprovações e um ajuste na 1ª) |

Dependências: o `node_modules` estava em dia com o `package-lock.json`, e não precisou de `npm ci`. Para a integração rodar,
parei os workers e o despachante do compose de teste que o meu e2e deixou de pé (`docker compose … stop`, os da própria
mensagem do `integracao.setup.ts`); a web e a API ficaram.

### 4. Achados

**Críticos**
- Nenhum. O da rodada 1 (`encerrar-provas.int.test.ts:961`) está resolvido: `removidasNoFiltro` soma só a tabela medida
  (`:42`), o `beforeAll` planta os anos fora de curso (`:951-957`), e o arquivo passou duas vezes no banco acumulado.

**Maiores**
- `apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts:114` (`enviaram` conta só `enviada_em is not
  null`), lido em `apps/web/src/areas/professor/atividades/aprovar.ts:134` (`situacaoDaAplicacao`), em
  `AtividadesDaTurma.tsx:55` ("Os alunos estão respondendo…") e no resumo da confirmação de encerrar
  (`EncerramentoDaAtividade.tsx:91`, "Já enviaram"): a tentativa **vencida** que a rotina ainda não gravou (a rotina só
  grava quando o `fecha_em` passa, Tech Spec §5.6) aparece para a professora como não enviada. Na foto
  `professora--turma-painel-prova-vencida--computador.png` a prova "(foco)", com janela até amanhã e o único aluno em
  "Tempo esgotado" no acompanhamento, diz "Aberta para a turma · avaliativa · 0 de 1 aluno enviaram" e "Os alunos estão
  respondendo", enquanto o aluno já a vê em "Entregues" (`aluno--aluno-atividades--computador.png`). Contradiz a Tech
  Spec §5.5, "vencida sem envio conta como enviada em toda leitura (RF5)", e não está registrado como divergência nem no
  `TODO.md` (a linha 319 trata só da segunda chamada). Em prova curta a diferença dura minutos; em janela de um dia, dura
  o dia, e é o número que a professora lê antes de decidir encerrar. Não muda correção nem nota: no encerramento a vencida
  é gravada com `envio = 'limite'`. **Correção:** a contagem `enviaram` da leitura do professor contar também a tentativa
  em andamento cujo `limiteDaTentativa` já passou (a mesma função, com as extensões e as quedas, como o acompanhamento já
  faz), ou derivar `enviaram` do acompanhamento na prova com janela; teste em `prova-online.int.test.ts` com a tentativa
  vencida e a janela aberta, mais o caso estendido que não conta. A frase "Os alunos estão respondendo" pode dizer o mesmo
  que o acompanhamento quando ninguém mais está fazendo.
- `docs/roteiro-da-demonstracao.md:226-227`: o passo 3 do roteiro manda a pessoa ver e ler, na avaliativa com janela que o
  próprio passo aplica, "Avaliação: o Tutor fica pausado até quem dá a aula encerrar". Desde `aa21262e` a tela diz
  "Avaliação: o Tutor fica pausado durante a prova, da abertura até ela fechar." (`apps/web/src/areas/aluno/atividades.ts:27`),
  e o e2e do roteiro já espera o texto novo (`e2e/roteiro-da-demonstracao.spec.ts:482`). Doc em `docs/` contradizendo o
  código, lido em voz alta na demonstração. Já anotado no `estado.md` ("Devo ainda") e pelo `test-engineer` na 2ª rodada da
  correção, sem destino gravado. **Correção:** trocar o texto do passo 3, item 2, pelo de `AVISO_DA_PROVA`; só `docs/`.

**Menores**
- `apps/web/src/areas/professor/atividades/aprovar.ts:141` e `:151`: "o Tutor fica pausado **para a turma** … (ou até o fim
  do tempo de quem recebeu mais)" sugere que a turma toda fica travada até o último aluno, e a trava é por aluno
  (`tutor.repository.ts:275-276`, Tech Spec §5.10). Erra para o lado seguro. Dono: `TODO.md`, com a redação do `test-engineer` (2ª
  rodada de `2026-11-28-textos-do-tutor-na-prova`). Ainda não está no `TODO.md`.
- `apps/web/src/areas/aluno/atividades.test.ts:42`: o título do caso ainda diz "até o fim do tempo dele"; as asserções já
  são as novas. Dono: `TODO.md` (recomendação do `frontend-reviewer`, 2ª rodada da mesma correção). Ainda não está lá.
- A tela de foco no celular (`aluno--aluno-prova-01a222ac-ae5a…--celular.png`): com um enunciado de três linhas, o
  "Enviar a prova" fica cortado pela metade na borda do miolo, acima da barra de Anterior e Próxima, e o "Para sair, use
  Sair da prova" sai de vista. O miolo rola e o botão é alcançável (o e2e `aluno-prova.spec.ts` envia no projeto
  `celular`), mas a ação principal da prova aparece pela metade na primeira vista. Componente: `ProvaEmFoco.tsx` (a
  barra de baixo). Dono: `TODO.md`, ou a próxima tarefa que tocar a tela de foco.
- `apps/web/src/components/ui/ListItem.tsx:64`: na lista do aluno a 360 px o título vai com reticências
  ("Prova de estequiometr…"), e provas de título parecido ficam iguais na lista (`aluno--aluno-atividades--celular.png`).
  Anterior à F6, e a segunda chamada tem o mesmo título da original. Dono: `TODO.md`.
- `tasks/prd-avaliacao-e-correcao/techspec.md:4`: "Status: em revisão", com a `revisao-spec.md` APROVADA na rodada 4.
  Dono: o Arquiteto, no fechamento.
- Seguem sem destino, da rodada 1 (seção 4, Menores, e seção 6): o PUT com a extensão de B e a fronteira do `>` do tempo
  esgotado; "Ela fecha às 10:16." sem data (`AntesDeComecar.tsx:83`); a pergunta 2 do PRD §10 a riscar; a métrica de
  provas com duração (PRD §9); a saída da aba lida sem trava (aceita); a extensão da turma fora do arquivo do titular; a
  chave da extensão com outro corpo. O `estado.md` já as leva ao `TODO.md` no fechamento.
- As "Recomendações sem aplicar" das três correções com destino `TODO.md` que ainda não estão nele: as duas acima e a da
  vitrine semear uma avaliativa com janela (a linha 266 do `TODO.md` cobre a vitrine, sem a janela). A dos
  `janela.int.test.ts:279` e `slots.int.test.ts:554` já entrou (`TODO.md`, última linha).

**Positivos**
- A correção do `EXPLAIN` não só filtrou pela tabela: plantou no próprio teste o estado que o banco acumulado tinha, e
  provou o vermelho com a soma antiga. É o jeito de tirar a dependência do banco sem afrouxar a asserção.
- O texto do Tutor ficou em duas funções (`avisoDaAvaliacao`, `avisoDaAvaliativaAberta`) decididas pela janela, com o texto
  de antes da F6 mantido para a avaliativa sem janela: os e2e de antes, que montam a atividade sem janela, seguem certos.

### 5. Conclusão

APROVADA COM RESSALVAS. Os dez RF estão atendidos, com código, teste efetivo (três mutações novas, todas vermelhas) e foto
onde há tela; os testes de evidência rodados estão verdes, inclusive o `encerrar-provas` duas vezes no banco acumulado, e o
e2e do professor saiu de perto do prazo. Nenhum crítico.

Os dois maiores são pontuais e não seguram a F6d:
1. A contagem "enviaram" da professora ignorar a vencida (Tech Spec §5.5): uma correção (`corrigir`) na API, com o teste
   da vencida com janela aberta. É o que mais pesa: é o número que a professora lê antes de encerrar.
2. O texto do roteiro da demonstração: uma linha de `docs/`, que o `estado.md` já previa.

### 6. Pendências herdadas

| Pendência | Destino |
|---|---|
| Os dois maiores da seção 4 | correção (`corrigir`), antes ou junto do fechamento |
| Os menores da seção 4, um por linha, mais os da rodada 1 | `TODO.md`, no fechamento, pelo Orquestrador |
| A premissa do `blur` no ChromeOS com leitor de tela (Tech Spec §12) | etapa 5 da AIA, na F6d |
| Commits `Fora do processo:` com código da spec | nenhum (`git log origin/develop..HEAD -i --grep='^Fora do processo:'` sem resultado); de `cb64ca5f` a `da9a83ca`, todo commit com código é `(correção <slug>)`, e os outros são encontros de linha ou registro de estado |
| O ambiente de teste deste andar | os workers e o despachante do compose `educa-teste` ficaram parados (a web e a API, de pé); a vitrine cheia ganhou a prova `01a222ac-ae5a…` e uma tentativa do Caio nela, sintéticas |

## Rodada 1 — 28/11/2026

**Escopo:** funcionalidade completa (RF1 a RF10; os RF11 a RF20 são a F6d)
**Commit validado:** `cb64ca5f`
**Veredito: REPROVADA**

Motivo único do veredito: um teste de evidência ficou vermelho, de forma reproduzível, no banco de teste acumulado
(`apps/worker/test/encerrar-provas.int.test.ts:961`; seção 4, Críticos). Os RF estão todos atendidos, e o código de
produção não tem defeito que reprove. O caminho até APROVADA é uma correção só de teste (seção 5).

### 1. RF a RF

Fotos em `.processo/vitrine/` (fora do git), tiradas na escola cheia da vitrine com três provas aplicadas pela API da
professora: uma não começada, uma em andamento e uma encerrada com 1 saída da aba. Todas foram lidas como imagem, no
computador (1366) e no celular (360). Nenhuma tela da prova rola a 1366 × 768. A única que rola é Aprovar → Outras, com
964 px, uma tela que já existia antes da F6 e da qual nenhum RF exige que só o miolo role.

| RF | Situação | Código | Teste | Observação |
|---|---|---|---|---|
| RF1 | ATENDIDO | `packages/shared/src/atividade/limite-da-tentativa.ts` (`limiteBaseDaTentativa`, o `min` com o `fecha_em`); `apps/api/src/atividade/minha-atividade/minha-atividade.service.ts:220-240` (`comecar`: alcance, depois a janela com `now()` do banco, `agora >= fecha_em` já fechou); `camposInvalidosDaProva` (`atividade-aplicada.ts:96-105`, a janela obrigatória na avaliativa) | `prova-online-aluno.int.test.ts` ("antes de `abre_em` e depois de `fecha_em` é PROVA_FORA_DA_JANELA…", "a 10 min do `fecha_em` com duração 40 o limite é o `fecha_em`…"); `prova-online.int.test.ts` ("a avaliativa nova sem janela é ENTRADA_INVALIDA…") | Foto: `professora--professor-artefatos-…-Aplicar-à-turma-radio-name-É-avaliativa--{computador,celular}.png` (Abre em, Fecha em, Duração) |
| RF2 | ATENDIDO | `atividade-aplicada.service.ts:110-151` (`mudarAJanela`: `for update`, relê o estado, `PROVA_JA_COMECOU`) | `prova-online.int.test.ts` ("com uma tentativa iniciada, a mudança é PROVA_JA_COMECOU, em cada campo…", corridas "(b)" e "(k)"); `prova-online-aluno.int.test.ts` "(b) mudar a janela × começar" | Depois do começo, só "Estender": e2e `professor-turma-atividades.spec.ts` (10.0) |
| RF3 | ATENDIDO | `atividade-aplicada.service.ts:79-101` (o aluno é da turma, a auditoria leva só a contagem); `duracaoDoAlunoEmMinutos`; schema `.strictObject` sem motivo | `prova-online.int.test.ts` ("+25%, +50% e +100% sobre 40 min…", "janela de 50 min com duração 40 e um aluno com +50%…", "…chave a mais (motivo)…"); `prova-online-aluno.int.test.ts` ("o tempo adicional do aluno vira só a duração dele: 60…, e o colega lê 40") | Foto do aluno com +50% em prova de 40 min: "Esta prova tem 60 minutos", sem a palavra "adicional" (`aluno--aluno-atividades-01a2224c-844f…--computador.png`) |
| RF4 | ATENDIDO | `extensao.service.ts:34` (`estender`, chave por aplicação, `for share`); `limiteDaTentativa` (soma só a extensão do aluno e a da turma) | `extensao.int.test.ts` ("10 min só para a Ana…", "a turma toda: todos andam…", "(d) estender × estender", "a mesma chave de novo devolve o gravado…"); `encerrar-provas.int.test.ts` ("não encerra enquanto o aluno estendido tem tempo: o `fecha_em` passou…"); `prova-online-aluno.int.test.ts` ("a extensão do aluno e a da turma somam ao limite, e a de outro aluno não…"); e2e `professor-prova.spec.ts:87` | "Só o estendido segue respondendo": o PUT e o `tempo` usam o mesmo `limiteDaTentativaDoAluno` (`minha-atividade.service.ts:39`). O `tempo` prova a extensão só do aluno, e o PUT prova que usa esse limite (o caso da indisponibilidade). Falta o caso direto do PUT (menor). Foto: `professora--professor-turmas-01a2224c-6faf…--{computador,celular}.png` (Acompanhar, "Fazendo · termina às 11:16", "Estender", "Estender a turma toda") |
| RF5 | ATENDIDO | `minha-atividade.service.ts:264-279` (PUT, `TEMPO_ESGOTADO` sem gravar); `packages/core/src/atividade/encerramento.ts:67-110` (a vencida recebe `enviada_em` = limite e `envio = 'limite'`; a rotina); `apps/worker/src/processors/encerrar-provas-vencidas.ts` | `prova-online-aluno.int.test.ts` ("um minuto antes do limite grava; depois dele é TEMPO_ESGOTADO, sem linha…"); `encerrar-provas.int.test.ts` ("a vencida sem envio entra na correção com o que salvou…", "encerra a prova vencida da escola do job e deixa a de outra…"); `ProvaEmFoco.test.tsx` ("O tempo acabou…") | O lote nasce pendente: `encerrar-provas.int.test.ts` |
| RF6 | ATENDIDO | `apps/api/src/atividade/pulso/*` (pulso numa instrução, 503 com o pulso parado, porta só depois do primeiro pulso); `limiteDaTentativa` (ponto fixo, lacuna aberta); `apps/web/src/areas/aluno/fila-de-respostas.ts`, `respostas.ts` (fila no app, recuo e sorteio na volta) | `pulso.int.test.ts` (16 casos, entre eles "parado 40 min e de volta…", "+29 s e +30 s aceitam…; +31 s recusa as cinco com 503…"); `prova-online-aluno.int.test.ts` ("a indisponibilidade fechada de 5 min devolve o tempo…", "a lacuna aberta montada à mão…"); `encerrar-provas.int.test.ts` ("com o pulso velho o job para sem encerrar…", "(l) pulso × rotina"); e2e `aluno-prova.spec.ts:146` (a rede cai, três respostas gravadas uma vez); `ProvaEmFoco.test.tsx` | Carga: a rodada de `carga:prova` registrada no `estado.md` (28/11, ~10:15, depois da 12.0): 42.000 enviadas = 42.000 gravadas, fila esvaziada em 23,9 s, a queda de 100 s andou o limite em 100 s. **Não refeita aqui** (11 min, pede a máquina calma) |
| RF7 | ATENDIDO | `apps/web/src/areas/aluno/routes.tsx` (`/aluno/prova/:id` fora da casca); `ProvaEmFoco.tsx`; `AntesDeComecar.tsx:80-90` | e2e `aluno-prova.spec.ts:100`, `:115`, `:131`, `:178`, `:212` (chromebook e celular, com axe); `ProvaEmFoco.test.tsx` (50 casos) | Fotos: `aluno--aluno-atividades-01a2224c-844f…` ("Antes de começar": duração, aviso da aba, como sair, Começar) e `aluno--aluno-prova-01a2224c-8489…--{computador,celular}.png` (só a prova, "Faltam 60 min" e "Sair da prova" numa faixa de uma linha, sem lateral nem Tutor) |
| RF8 | ATENDIDO | `apps/api/src/atividade/minha-atividade/ordem-da-prova.ts:47-80` (`sortearOrdem`, `naOrdemDoAluno`); `comecar` grava a ordem só na primeira vez | `embaralhamento.int.test.ts` (10 casos, entre eles "sorteio fixo, dois alunos…: acerta nos dois pelo índice original", "o desempenho por habilidade… são os da ordem original", "retomada…", "(a) começar × começar…"); e2e `aluno-prova.spec.ts:219`, `:243` | Foto da prova embaralhada: a alternativa certa da 1ª questão aparece como "A. 18 g/mol" |
| RF9 | ATENDIDO | `minha-atividade.service.ts:309-319` (`registrarSaida`: só avaliativa, aberta, tentativa em andamento e no limite); `saida-da-aba.repository.ts` (a chave única, a soma no banco); `apps/web/src/areas/aluno/fila-de-saidas.ts`; `aprovar.ts` (`AVISO_DA_SAIDA_DA_ABA`) e `Aprovar.tsx` | `saida-da-aba.int.test.ts` (19 casos: "a não avaliativa… são NAO_ENCONTRADO", "a prova 2 começa em 0…", "a mesma tentativa com 0 e com 9 saídas tem a mesma correção e os mesmos destaques…", "a validação da avaliativa guarda que a coluna foi mostrada, e nenhuma contagem…", "a coordenação e o aluno não leem o lote…"); `contracts.test.ts`; `arquivo-do-titular.int.test.ts` (a exceção do §6); e2e `professor-prova.spec.ts:135` | Foto: `professora--professor-aprovar-01a2224c-84bd…--tab-name-Outras--{computador,celular}.png` (o aviso fixo acima, a coluna "Saiu da aba" = 1 e, no celular, dentro do cartão) |
| RF10 | ATENDIDO | `apps/api/src/atividade/atividade-aplicada/segunda-chamada.service.ts:23-59`; o alcance pelo convocado em `minha-atividade.repository.ts:140-156` | `segunda-chamada.int.test.ts` (18 casos: "a original aberta é ENTRADA_INVALIDA…", "quem enviou e quem venceu sem enviar não são convocáveis…", "o não convocado não vê na lista e recebe NAO_ENCONTRADO em todas as rotas…", "com o lote da original aprovado, a segunda chamada encerra num lote pendente próprio…", "(h) segunda chamada dupla…"); e2e `professor-prova.spec.ts:189` | Foto: `professora--professor-turmas-01a2224c-6faf…--button-name-Segunda-chamada--computador.png` (convocados por nome, janela, duração e o resumo antes de confirmar) |

RF: 10 atendidos, 0 parciais, 0 não atendidos, 0 não verificáveis.

Provas de mutação (cada uma aplicada, o teste rodado isolado e o arquivo restaurado com `git checkout --`; a árvore terminou
limpa):

| RF | Cláusula removida | Teste que ficou vermelho |
|---|---|---|
| RF9 (regra 70, item 7; D70) | `!atividade.avaliativa \|\|` em `registrarSaida` (`minha-atividade.service.ts`): a saída passaria a contar fora de prova | `saida-da-aba.int.test.ts` › "a não avaliativa, a que o aluno ainda não começou, a enviada, a vencida e a encerrada pelo professor são NAO_ENCONTRADO…": `expected { status: 204 } to deeply equal { status: 404, … }` |
| RF10 (isolamento do convocado) | o filtro do convocado em `#daMinhaTurma` (`minha-atividade.repository.ts`, `or(sql\`true\`, …)`) | `segunda-chamada.int.test.ts` › "o não convocado não vê na lista e recebe NAO_ENCONTRADO…": "a lista do não convocado: expected [ …(6) ] to not include '<id>'" |
| RF6 (regra 80, item 6: a queda não encerra prova) | `if (pulsoVelho) return 'pulso_velho'` em `encerrarPeloLimite` (`packages/core/src/atividade/encerramento.ts`) | `encerrar-provas.int.test.ts` › "o job gravado antes da queda, rodado com o pulso velho, não encerra": `expected 'encerrada' to be 'aberta'` |

### 2. Regras de negócio, casos de borda e critério de pronto

| Item | Situação | Evidência |
|---|---|---|
| Regra: sem `Nota`, aprova-se diagnóstico formativo (D46) | cumprida | a rotina e o encerramento só criam o lote `pendente`; `encerrar-provas.int.test.ts` "corrida e" e "(f) job × job": um lote, uma auditoria; a 0069 continua recusando à rotina aprovar, rejeitar e validar |
| Regra: o relógio é o do servidor | cumprida | `now()` do banco no PUT, no `comecar` e no `tempo`; `ProvaEmFoco.test.tsx` (o relógio do cliente adiantado 10 min mostra o do servidor) |
| Regra: tempo adicional e extensão com autor e hora, sem motivo, presos à prova | cumprida | `tempo_adicional.concedido_por` e `concedido_em`; `extensao_de_tempo.concedida_por`; auditorias sem aluno nem percentual (`prova-online.int.test.ts`, `extensao.int.test.ts` "a auditoria diz só o escopo…", `segunda-chamada.int.test.ts` "`atividade.segunda_chamada_aplicada` leva… só as contagens") |
| Regra: a saída da aba presa à tentativa, só em prova, só para o professor da turma | cumprida | mutação RF9 acima; `saida-da-aba.int.test.ts` ("a coordenação e o aluno não leem o lote…"); `contracts.test.ts` |
| Regra: a exceção do art. 18 no arquivo do titular sem conta ativa | cumprida | `arquivo-do-titular.int.test.ts` (versão `coordenacao` com percentual e `concedido_em`, sem `concedido_por`; a contagem por tentativa, sem a chave); `docs/lgpd.md:58-60` |
| Regra: embaralhar muda só a ordem que o aluno vê | cumprida | `embaralhamento.int.test.ts` |
| Regra: prova aberta trava o Tutor da turma | cumprida | `tutor-trava-da-prova.int.test.ts` (21 casos: a janela, o estendido, a indisponibilidade, o convocado, a memória sem tempo adicional nem saídas) |
| Regra: tudo por escola e ano letivo, em turma e disciplina de vínculo confirmado | cumprida | os casos "no repository, o id certo com a escola trocada ou o ano trocado…" de cada arquivo; "a escola sem ano em curso…"; o job de A não toca a prova de B |
| Borda: aluno faltou | coberta | `segunda-chamada.int.test.ts` ("…quem faltou e quem a professora cortou antes do limite são [convocáveis]") |
| Borda: feriado no dia | coberta | `prova-online.int.test.ts` ("só a janela e só o tempo adicional, antes do primeiro começo: grava…") |
| Borda: a rede da escola cai | coberta | e2e `aluno-prova.spec.ts:146`; `fila-de-saidas.test.ts`, `respostas.test.ts`; a carga (RF6) |
| Borda: aluno com leitor de tela | justificada | o aviso fixo (D88) na tela, provado em `Aprovar.test.tsx` e no e2e; o `blur` no ChromeOS com leitor de tela é premissa não verificada declarada na Tech Spec §12, e vai para a etapa 5 da AIA (F6d) |
| Borda: aluno transferido com a prova aberta | coberta | `prova-online-aluno.int.test.ts` ("o aluno transferido, com tentativa na turma A, recebe NAO_ENCONTRADO nas rotas de A…"); `saida-da-aba.int.test.ts` |
| Borda: professor encerra antes do fim, com alunos fazendo | coberta | `EncerramentoDaAtividade.test.tsx`; e2e `professor-prova.spec.ts:121`; `prova-online-aluno.int.test.ts` ("a professora encerrando grava a vencida no limite dela… e deixa sem envio a que ainda tinha tempo…") |
| Borda: função de correção suspensa com prova aberta | coberta | `encerrar-provas.int.test.ts` ("a função de correção suspensa na escola: encerra sem lote nem correção…") |
| Pronto: janela e duração no relógio do servidor; quem começa tarde tem só o que sobra (RF1, RF2) | cumprido | RF1, RF2 |
| Pronto: tempo adicional só para o marcado, sem motivo, sensível (RF3) | cumprido | RF3; `docs/lgpd.md:60` |
| Pronto: estender o aluno ou a turma, também além da janela (RF4) | cumprido | RF4 |
| Pronto: no limite vai com o salvo; a vencida encerra sozinha; lote pendente (RF5) | cumprido | RF5 |
| Pronto: nenhuma resposta perdida com a rede caindo; a queda do sistema devolve o tempo e não encerra, medido na carga (RF6) | cumprido | RF6; a mutação RF6; a carga registrada no `estado.md` (não refeita) |
| Pronto: tela de foco, aviso antes, saída de um clique (RF7) | cumprido | RF7, com fotos |
| Pronto: embaralhamento corrigido pela ordem original (RF8) | cumprido | RF8 |
| Pronto: a saída da aba por tentativa, só no lote, com o aviso fixo (RF9) | cumprido | RF9. O texto segue a D88, decidida pelo Joaquim em 23/11; a pergunta 2 do PRD §10 não foi marcada como respondida (menor) |
| Pronto: segunda chamada com lote próprio (RF10) | cumprido | RF10 |
| Pronto: o Tutor travado para cada aluno até o fim da prova dele | cumprido | `tutor-trava-da-prova.int.test.ts`. Atenção: três textos da tela ainda dizem "até você encerrar" (maior) |
| Pronto: roteiro da demonstração conferido na 10.0 e na 12.0 | cumprido | `e2e/roteiro-da-demonstracao.spec.ts` e `docs/roteiro-da-demonstracao.md` alterados nas duas tarefas; o e2e não foi rodado aqui (vai na esteira) |
| Pronto: etapa 1 da AIA da correção de objetiva (6.0) | cumprido | `docs/aia/correcao-de-objetiva.md` (1.4/1, o gatilho; 1.4/9, a contagem) |
| "Pronto quando" do roadmap: a queda de rede não perde resposta nem tempo; a saída da aba não existe fora de avaliação nem somada por aluno | cumprido | e2e `aluno-prova.spec.ts:146`; `saida-da-aba.int.test.ts` ("a prova 2 começa em 0… nenhuma leitura devolve soma por aluno"); a mutação RF9 |

### 3. Portão

| Portão | Resultado |
|---|---|
| `npm run typecheck` | não rodado: suíte inteira, na esteira (D79) |
| `npm run lint` | não rodado: idem |
| `npm run test` | não rodado inteiro. Rodados isolados, como evidência: `prova-online.int.test.ts` e `prova-online-aluno.int.test.ts` (42 ✅); `extensao`, `embaralhamento`, `saida-da-aba`, `segunda-chamada`, `tutor-trava-da-prova`, `pulso`, `encerrar-provas` e `arquivo-do-titular` (212 ✅, **1 ❌**: `encerrar-provas.int.test.ts:961`, reproduzido de novo isolado); 3 mutações, todas vermelhas |
| `npm run test:e2e` | rodados `e2e/aluno-prova.spec.ts` e `e2e/professor-prova.spec.ts` (`node tools/ci/e2e.ts --manter-ambiente`): 32 ✅ em chromebook e celular. Os 6 casos do `professor-prova.spec.ts`, nos dois projetos, levaram de 13,6 a 15,5 s (maior) |
| `npm run test:infra` | não rodado (esteira) |
| Esteira do GitHub | conferida no fechamento, pelo Orquestrador: não entra no veredito |
| Revisões com veto registradas e aprovadas | ✅ as 12 tarefas têm rodada de todo revisor obrigatório da tabela do `tasks.md`, mais `test-engineer` e `revisor-geral`, e a última rodada de cada um é APROVADO. A `revisao-spec.md` foi APROVADA na rodada 4 |

Dependências: o `node_modules` estava em dia com o `package-lock.json`, e não precisou de `npm ci`.

### 4. Achados

**Críticos**
- `apps/worker/test/encerrar-provas.int.test.ts:961` (e a mesma conta em `:966`; o somatório em `:36`): o caso "a escolha das
  escolas com prova vencida e a lista de uma escola descem pelo índice da prova aberta, sem varrer as encerradas" falha
  com `AssertionError: expected 2 to be less than or equal to 1`, nas duas vezes em que rodou (no lote e isolado com `-t`).
  A causa está confirmada no plano: `removidasNoFiltro` soma o `Rows Removed by Filter` de **todos os nós**, e a consulta
  global junta `ano_letivo` com `situacao = 'em_curso'`. No banco que a integração deixa, o `Seq Scan on ano_letivo` descarta
  os anos que não estão em curso, e são 2 aqui (`select situacao, count(*) from ano_letivo`): um `encerrado`, que o próprio
  arquivo deixa no caso de ":836" (encerra o ano da escola A e abre outro), e um `planejado`, de outro arquivo. Basta rodar
  este arquivo uma vez no mesmo banco para a contagem do seguinte passar de 1. O índice da prova aberta é usado (o `toContain` passa), e o
  código de produção não tem defeito. O teste é que depende do que o banco acumulou, a mesma classe da correção
  `2026-11-28-extensao-explain-banco-acumulado` (`ec28edad`), e a regra 40 exige que ele passe no banco novo, no acumulado e
  na esteira. **Correção:** contar as linhas removidas só nos nós de `atividade_aplicada` (filtrar `nosDoPlano` por
  `'Relation Name' === 'atividade_aplicada'` ou pelo `Index Name` do índice da prova aberta), nas duas asserções do caso.
  Depois, rodar o arquivo duas vezes seguidas no mesmo banco, a segunda sem `EDUCA_BANCO_NOVO`, para provar que ficou
  independente.

**Maiores**
- `apps/web/src/areas/professor/atividades/aprovar.ts:141` ("O Tutor fica pausado para a turma até você encerrar a atividade."),
  `aprovar.ts:145` ("É avaliativa: o Tutor está pausado para a turma até você encerrar.", que aparece no painel da atividade e
  em "Na turma") e `apps/web/src/areas/aluno/atividades.ts:21` ("Avaliação: o Tutor fica pausado até quem dá a aula
  encerrar.", na lista do aluno): os três textos ficaram contra o comportamento que a F6 criou (Tech Spec §5.10, decisão do
  Joaquim de 23/11, "o Tutor trava só na janela"). Na prova com janela, o Tutor só trava a partir do `abre_em` e destrava no
  fim efetivo de cada aluno, mesmo com a atividade ainda aberta. A prova também encerra sozinha. A professora lê que o Tutor
  está pausado numa prova de amanhã, quando ele ainda está livre para a turma (`tutor-trava-da-prova.int.test.ts`, "prova de
  amanhã não trava"). Os três textos estão nas fotos `professora--professor-turmas-…--computador.png`,
  `…Aplicar-à-turma-radio-name-É-avaliativa…png` e `aluno--aluno-atividades--celular.png`. **Correção:** na avaliativa com
  janela, dizer "O Tutor fica pausado para a turma durante a prova (da abertura até o fim do tempo de cada aluno)". A
  avaliativa sem janela, a de antes da F6, mantém o texto de hoje. O mesmo vale para o `AtividadesDaTurma.tsx:54` ("Quando a
  turma terminar, encerre a atividade…"), que pode dizer que a prova encerra sozinha no fim. Os testes de unidade que fixam
  esses textos também mudam.
- `e2e/professor-prova.spec.ts` (`:87`, `:121`, `:135`, `:172`, `:189`, `:207`): nos dois projetos, cada caso levou de
  13,6 a 15,5 s nesta máquina, com o prazo padrão de 30 s. O `tools/ci/duracao-do-e2e.ts` vermelha o caso tocado acima de
  15 s, e o runner leva perto do dobro, o que põe esses casos entre 27 e 31 s na esteira. É o teste frágil que o
  Orquestrador já tinha anotado na 11.0. **Correção:** aplicar a prova e fazer a parte dos alunos antes de abrir a página,
  como o `aluno-prova.spec.ts` já faz com os `/assets/` (é a mesma causa: a carga do app no Chromebook com CPU ×4), ou dividir
  os casos que provam duas coisas. No lote de e2e perto do prazo, como diz o `estado.md`, se não couber nesta correção.

**Menores**
- `apps/api/src/atividade/prova-online-aluno.int.test.ts:367`: o cenário RF4 do `cenarios.md` ("A grava depois do limite
  antigo e B recebe `TEMPO_ESGOTADO`") não tem caso pelo PUT. Hoje vale pela função comum (`minha-atividade.service.ts:39`).
  A fronteira exata do `>` do tempo esgotado também ficou sem caso. As duas vieram do "Sem aplicar" do `5_task.md` para esta
  validação. Dono: o `TODO.md`, ou a mesma correção do crítico, se couber.
- `apps/web/src/areas/aluno/AntesDeComecar.tsx:83`: "Ela fecha às 10:16." vem sem data. Na foto, a janela fecha em 29/11 e a
  aluna lê só a hora, como se fosse hoje. Dono: `TODO.md` (dizer a data quando não for o dia de hoje na escola).
- `tasks/prd-avaliacao-e-correcao/prd.md` §10, pergunta 2 (o texto do aviso fixo): continua aberta no PRD, embora o texto
  siga a D88 e o `8_task.md` o dê como aprovado. Dono: o Arquiteto, riscar no fechamento.
- PRD §9, métrica "provas com duração por mês, por escola": não existe métrica nem painel. Sai do banco
  (`atividade_aplicada.duracao_min`). Dono: `TODO.md`, ou a F12, junto dos indicadores.
- `apps/api/src/atividade/minha-atividade/minha-atividade.service.ts:301-319`: a saída da aba lê o envio sem trava, e uma
  saída pode somar 1 depois de o `enviar` gravar. A janela está declarada no comentário, que passa a decisão à validação. O
  efeito é uma contagem a mais de uma saída que aconteceu durante a prova, e nada mais lê a contagem. Aceito como está, e
  registrado aqui para não se perder.
- As pendências que o `estado.md` manda levar ao `TODO.md` no fechamento, sem destino ainda: o D56 "o lote mostrar a
  tentativa enviada pelo limite" (F6d); as 3 linhas de `tasks/correcoes/2026-11-27-pool-503.md`; a alternativa C da d55
  (F7 mínima); as 2 linhas de `tasks/correcoes/2026-11-23-explain-semana-itens.md`; o `rowCount` como mensagem do `expect`
  em `extensao.int.test.ts`; a extensão da turma fora do arquivo do titular (`leitura-do-titular.ts:345`, privacy-guardian
  na 5.0); a chave da extensão com outro corpo, que devolve o gravado em silêncio (decisão do Arquiteto pendente).

**Positivos**
- Uma função só para o limite (`limiteDaTentativa`), pura e de ponto fixo, chamada pelos seis chamadores. Isso fez o RF6
  valer igual no PUT, na saída, no `tempo`, na rotina e no Tutor, e deixou as três mutações sem caminho de escape.
- A corrida de cada trava provada com ordem forçada (`WriteBlockTrigger`), com as letras do `cenarios.md` §3 no nome do caso.
  Na validação, achar o teste de cada corrida foi direto.

### 5. Conclusão

REPROVADA por um teste vermelho: `encerrar-provas.int.test.ts:961` depende dos anos letivos que o banco de teste acumulou.
Os dez RF estão atendidos, com código, teste efetivo e foto onde há tela. As regras de negócio, os casos de borda e o
critério de pronto estão cumpridos, e as três mutações nos pontos de maior risco ficaram vermelhas.

O caminho até APROVADA:
1. Uma correção (`corrigir`) só de teste em `apps/worker/test/encerrar-provas.int.test.ts`: contar as linhas removidas só
   nos nós de `atividade_aplicada`, e rodar o arquivo duas vezes seguidas no mesmo banco.
2. Na mesma correção, ou numa segunda, os três textos do Tutor "até você encerrar" (maior). Eles não bloqueiam a próxima
   funcionalidade, mas desinformam a professora sobre a supervisão do Tutor.
3. O `professor-prova.spec.ts` perto do prazo pode ir ao lote de e2e perto do prazo. Se a esteira o derrubar antes, vira
   correção.

Revalidação: rodar de novo `encerrar-provas.int.test.ts`, duas vezes, e conferir os textos pela foto.

### 6. Pendências herdadas

| Pendência | Destino |
|---|---|
| Os menores da seção 4, um por linha | `TODO.md`, no fechamento, pelo Orquestrador |
| As linhas que o `estado.md` (seção "Devo ainda") manda levar ao `TODO.md` | `TODO.md`, no fechamento |
| A premissa do `blur` no ChromeOS com leitor de tela (Tech Spec §12) | etapa 5 da AIA, na F6d |
| Commits `Fora do processo:` com código da spec | nenhum (`git log origin/develop..HEAD -i --grep='^Fora do processo:'` sem resultado); todo commit com código tem `(tarefa N.0)` ou `(correção <slug>)` |
