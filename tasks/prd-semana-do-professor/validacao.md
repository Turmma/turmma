# Validação — semana-do-professor (F2b)

## Rodada 1 — 07/11/2026

**Escopo:** funcionalidade completa
**Commit validado:** `04041af2`
**Veredito: APROVADA COM RESSALVAS** — a maior M1 corrigida em `5749137d` (só `docs/interface.md`), por decisão do Joaquim em 07/11/2026; ressalvas menores aceitas por Orquestrador (aviso da D79) em 07/11/2026: vão ao `TODO.md` no fechamento, com dono e data

Fotos: `.processo/vitrine/` (fora do git), tiradas na vitrine montada às 02:13 de 07/11. A escola cheia da vitrine não tem grade
(TODO.md, 8.0). Para ver a Semana com dado, gravei **só no banco de teste**, na escola cheia, dois vínculos confirmados a mais para a
Helena (2ºC Química, 2ºB Física), nove alocações (uma no sábado, das 1h às 5h, para "Hoje" e "Agora" aparecerem às 2h17 de um sábado),
Finados (02/11) e "Conselho de classe" (05/11), dois textos de aula, e mudei o `aplicada_em`, o `encerrada_em` e o `criada_em` das
atividades e lotes do 2ºB para a semana de 02/11. O script está no scratchpad desta sessão, e nada disso entra no repositório. As fotos
dessa escola ficam em `.processo/vitrine/f2b/`. As outras ficam em `.processo/vitrine/` com o nome que a ferramenta dá.

### 1. RF a RF

| RF | Situação | Código | Teste | Observação |
|---|---|---|---|---|
| RF1 | ATENDIDO | `packages/core/src/semana/semana.repository.ts:98` (`vinculosDaProfessora`: `usuarioId` da sessão, `papel = professor`, `estado = confirmado`), `apps/api/src/semana/montar-dias.ts:73` (uma coluna por dia; sábado e domingo só com aula, `:95`; ordem por horário, `:43`), `Turmas.tsx` (abas `?ver=semana`), `CartaoDaAula.tsx` | `semana.int.test.ts` ("S1", "S2", "S12", "o vínculo de professora que o repository acha é o da sessão"); `e2e/professor-semana.spec.ts` ("T1", "RF1: o fim de semana só aparece quando tem aula"), em chromebook e celular | Fotos `f2b/semana-2026-11-02--computador.png`, `f2b/semana-2026-11-09--computador.png` e `f2b/hoje--computador.png`: cinco colunas, e seis com a aula de sábado. Turma, disciplina, horário e sala estão em cada cartão. Mutação 1 (a do PUT) prova a mesma cláusula de dono no lado da gravação |
| RF2 | ATENDIDO | `semana.repository.ts:86` (`anoEmCurso`), `montar-dias.ts:78` (fora do ano, nenhum dia), `Semana.tsx:198` (barra), `semana.ts:248-258` (presa ao ano), `semana.ts:111` (`emAndamento`) | `semana.int.test.ts` ("S5", "S6, o GET"); `semana.test.ts` ("\"Agora\" só na aula de hoje…"); e2e "T1", "a navegação é presa ao ano", "`?semana=` abre a semana pedida…" | Fotos `f2b/hoje--computador.png` e `f2b/hoje--celular.png`: o sábado leva "Hoje" em texto e a borda azul, a aula das 1h às 5h leva "Agora", e no celular o `DaySelector` abre em hoje, com "hoje" escrito no botão |
| RF3 | ATENDIDO | `montar-dias.ts:80` (cruzamento do evento com o dia), `:97` (feriado e recesso: nenhuma aula), `semana.repository.ts:131` (`fim ≥ segunda` e `inicio ≤ domingo`); `DiaDaSemana.tsx:110` | `semana.int.test.ts` ("S3", "S4", "o cruzamento tem as duas metades…", "R3"); `montar-dias.test.ts`; e2e "RF3: feriado e recesso mostram o tipo e a descrição…" | Foto `f2b/semana-2026-11-02--computador.png`: a segunda diz "Feriado · Finados" e "Sem aulas", e a quinta mostra "Evento · Conselho de classe" com as duas aulas do dia |
| RF4 | ATENDIDO | `semana.ts:137` (`filtroDoEndereco`), `semana.ts:279` (`diasFiltrados`, aulas e itens juntos), `TurmaHoje.tsx` (um link por vínculo confirmado com disciplina, `turmasEDisciplinasDosVinculos`) | `semana.test.ts`; `TurmaHoje.test.tsx`; e2e `professor-semana-itens.spec.ts` ("T5: o link leva…", "T5: a turma aberta com duas disciplinas…", "com `?turma=`, o item de outra turma… some") | Fotos `professora--professor-turmas-01a1b46d-…--computador.png` (dois links, "· Química" e "· Física") e `…--Ver-a-semana-desta-turma-Química--computador.png` / `--celular.png`: a Semana abre com "2ºB · Química" no filtro, e a Física e o 2ºC saem, com aulas e itens |
| RF5 | ATENDIDO | `PainelDaAula.tsx:43` (`Sheet`, dia, horário, turma, disciplina, sala; `rotuloDoTexto`, `semana.ts:106`; `maximo = 500`; `DICA_DO_TEXTO_DA_AULA`); `packages/shared/src/semana/semana.ts` (`gravarAulaRequestSchema`, `.trim().max(500)`); check `aula_conteudo_preenchido` | `aulas.int.test.ts` ("G3: … 501 dá ENTRADA_INVALIDA e não grava", "o texto é aparado antes de medir…"); `aula.int.test.ts` (o check); `PainelDaAula.test.tsx`; e2e "T2: escrever, salvar, reabrir e achar o texto…" | Fotos `f2b/painel-2026-11-09--computador.png` ("O que vou dar", painel ao lado, contador "40 de 500", aviso de não escrever nome de aluno) e `f2b/painel-2026-11-02--celular.png` ("O que foi dado", folha de baixo a 360 px) |
| RF6 | ATENDIDO | `semana.ts:100` (`faltaPreencher`: `data >= hoje && texto === null`), `CartaoDaAula.tsx:64` | `semana.test.ts`; e2e "S14 e T11: \"Falta preencher\" é por aula…" e "T2" (o selo some ao salvar) | Fotos `f2b/semana-2026-11-09--computador.png` (selo cinza em toda aula futura sem texto, nenhum na que tem texto) e `f2b/semana-2026-11-02--computador.png` (aula passada sem texto, sem selo). Nenhum total na tela |
| RF7 | ATENDIDO | `semana.repository.ts:190` (`#daProfessora`: turma da aplicação **e** disciplina do artefato, vínculo confirmado da sessão), `:216-269` (aplicada, encerrada, lote com o estado de hoje, dia no fuso), `montar-dias.ts:109`; `ItensDoDia.tsx` (link, rótulo de `packages/shared`, selo IA na correção) | `semana-itens.int.test.ts` ("S9" ×5, "S10", "a correção aprovada depois da semana…", "R2", "o `EXPLAIN`…"); e2e `professor-semana-itens.spec.ts` ("T6" ×2, "os três itens têm nome acessível…") | Fotos `f2b/hoje--computador.png` e `f2b/hoje--celular.png`: "Atividade aplicada", "Atividade encerrada" e "Correção do Assistente · Aprovada" com o selo "IA", sem nota nem nome de aluno. Mutação 2 |
| RF8 | ATENDIDO | `PainelDaAula.tsx:71` (`CONTEXTO_ESCOLHIDO.guardar` e `navegar(novaConversa)`, sem chamada à API) | `PainelDaAula.test.tsx`; e2e "T4: abre o Início com a turma marcada; o número de conversas é o mesmo…" e "\"Preparar\" não manda o texto a requisição nenhuma, nem grava a aula" | Foto `professora--professor-turmas--data-aula-Preparar-esta-aula--computador.png`: o Início com "2ºB · Química" na caixa e nenhuma conversa aberta |
| RF9 | ATENDIDO | `SemanaRepository` e `AulaRepository` com a escola do contexto em toda consulta; `Semana.tsx:52` (o ano do cache, que o `resetQueries` da troca de sessão esvazia); painel desmontado com a rota | `semana.int.test.ts` ("R2"); `semana-itens.int.test.ts` ("R2"); e2e "RF9, P30: trocar de escola com a Semana aberta…", "T7, RF9: a troca de escola com o painel aberto…", "RF9, regra 10: `?aula=` de aula que não é dela…" | A troca em si não se fotografa: a professora da vitrine tem uma escola só. Vale o e2e, que rodou verde nos dois projetos. Fotos da tela: as de RF1 |
| RF10 | ATENDIDO | `aula.repository.ts:56` (`vinculoDaProfessora`: escola, ano, id, usuário da sessão, professor, confirmado), `:90` (`fimDaAulaGravavel`), `aulas.service.ts:185-189` (todo caso dá `NAO_ENCONTRADO`); FK composta `aula_vinculo_do_ano_da_escola_fk` | `aulas.int.test.ts` ("R1", "o vínculo da própria professora na escola B…", "G4", "R1b (a)", "R1b (b)", "o escopo de cada consulta…"); `semana.int.test.ts` ("o repository só devolve a escola do contexto…") | Mutação 1. A resposta é a mesma para id de outra escola, de colega e inexistente, e nada é gravado |
| RF11 | ATENDIDO | `packages/shared/src/permissao/matriz.ts` (`aula`: professor `proprio`; coordenação, rede e aluno `nunca`); `leitura-do-titular.ts:144` (`naVersao: completa`); nenhum outro código lê a `aula` (busca no `apps/` e no `packages/core/src`: só a Semana, o PUT, o passo da grade, a virada e o arquivo do titular) | `matriz.test.ts`; `leitura-do-titular.test.ts` ("o registro da aula… só entra na versão completa"); `arquivo-do-titular.int.test.ts` (R5); `semana.int.test.ts` e `aulas.int.test.ts` ("R7") | Nenhuma rota devolve contagem de aula preenchida, e "Falta preencher" é selo por aula |
| RF12 | ATENDIDO | `semana.ts:352` (`vazioDaSemana`: as quatro razões), `Semana.tsx:155` (erro, carregando, vazio, com dado; `UmDiaPorVez` abaixo de 768 px), `:271` (aviso do calendário), `DaySelector.tsx` | e2e "T8", "recomeço: a falha seguida de sucesso…", "o aviso do calendário…", "T9", "T10", "os alvos de toque…", "axe", nos projetos `chromebook` e `celular`; `semana.test.ts` e `Semana.test.tsx` (recesso, ano que não começou, sem aulas) | Fotos `professora--professor-turmas--computador.png` e `vazia--professora--professor-turmas--celular.png` (vazio "A coordenação ainda não importou a grade", que diz o que esperar), e `f2b/*--celular.png` (um dia por vez, sem rolagem de lado a 360 px). A vitrine diz "Nenhuma tela rola a 1366 × 768" em todas as chamadas. "Semana de recesso" e "O ano letivo ainda não começou" só têm unidade e jsdom (menor m4) |
| RF13 | ATENDIDO | O texto não tem FK para alocação nem para evento (`aula.ts`); `montar-dias.ts:97` só esconde | `semana-reimportacao.int.test.ts` ("J10: o feriado novo esconde a aula… retirado o feriado, a aula volta com o texto"), com o calendário gravado pelo job real | |
| RF14 | ATENDIDO | `texto-acompanha-a-grade.repository.ts` (`parear`, `rechavear`, `apagarOFuturo` com `data >= hoje`), chamado entre `gravarAulas` e `encerrarOsMarcados` (`importacao.repository.ts`, `tipos/grade.ts`); `montar-dias.ts:91` (o passado sem alocação volta como "fora da grade") | `semana-reimportacao.int.test.ts` ("J1", "J2", "J3", "J4", "J5", "J7", "J8", "J9", "J11a", "J11b", "J12", "J15", "J16", "o mesmo job entregue duas vezes"), com a reimportação real; e2e "RF14: a aula escrita que saiu da grade aparece com a marca \"Fora da grade\"" | Mutação 3. Um caso a mais, rodado e tirado: a aula dupla que anda um horário inteiro troca os dois textos de lugar (menor m1). Nenhum texto se perde |
| RF15 | ATENDIDO | Único `aula_vinculo_data_inicio_unico` e `insert … on conflict do update` (`aula.repository.ts:153`); trava consultiva do vínculo (`:78`); na tela, a trava síncrona de `PainelDaAula.tsx:66` | `aulas.int.test.ts` ("G6: duas gravações da mesma aula ao mesmo tempo…"); e2e "RF15: o clique duplo em \"Salvar\" manda um PUT só" | |

**15 de 15 ATENDIDOS.**

Provas de mutação (cada uma restaurada com `git checkout --`; a árvore terminou limpa, `git status` vazio):

| RF | Cláusula removida | Teste que ficou vermelho |
|---|---|---|
| RF10, RF11 | `eq(vinculo.usuarioId, requestSessao().usuarioId)` em `AulaRepository.vinculoDaProfessora` (`aula.repository.ts:65`) | `aulas.int.test.ts` "R1: vínculo de outra escola, de colega, pendente…" (o vínculo da colega passou a gravar) |
| RF7 | `eq(vinculo.disciplinaId, disciplinaId)` em `#daProfessora` (`semana.repository.ts:200`) | `semana-itens.int.test.ts` "S9: a atividade de Química do 2ºB não aparece para a professora de Física da mesma turma…" (`expected [ {tipo: 'aplicada'…}, …] to deeply equal []`) |
| RF14 | `and a.data >= ${hoje}::date` em `apagarOFuturo` (`texto-acompanha-a-grade.repository.ts:153`) | `semana-reimportacao.int.test.ts` "J3: a que sai sem par apaga os registros de hoje em diante… e os passados ficam" (o passado sumiu) |

### 2. Regras de negócio, casos de borda e critério de pronto

| Item | Situação | Evidência |
|---|---|---|
| Regra: a semana deriva da estrutura, a professora não toca a grade | cumprida | Nenhuma rota da F2b escreve em `alocacao` nem em `evento_calendario`; o `PUT` só grava `aula` |
| Regra: P12, só a escola ativa, sem aviso da outra | cumprida | Escola do contexto em toda consulta; `R2` (leitura e itens) e e2e "RF9, P30" |
| Regra: só vínculo confirmado gera aula | cumprida | `S1`, `S8`, `R1` (pendente, contestado, encerrado) |
| Regra: o registro é da professora, e nenhum número sai dele | cumprida | Matriz; `R5`, `R7`; "Falta preencher" sem total (`T11`) |
| Regra: o registro pertence à escola e ao ano da aula | cumprida | `escola_id` e `ano_letivo_id` com FK composta; `virarAno` apaga as do ano (`virada-do-ano.int.test.ts`, S7) |
| Regra: duas disciplinas na mesma turma são aulas distintas | cumprida | `S11`, `S9` (duas disciplinas, uma vez cada), mutação 2 |
| Regra: "hoje" e "agora" no fuso da escola | cumprida | `S13`, `J8`, item das 22h de domingo (`semana-itens.int.test.ts`) |
| Borda: feriado no dia da prova | coberta | `S10` |
| Borda: duas disciplinas na mesma turma | coberta | `S11`; e2e T5 com dois links |
| Borda: aula dupla | coberta | `S16` (GET e PUT), `J5` |
| Borda: professor que saiu em março | coberta | `S8`; `R1` (encerrado); `R4` (antecessor) |
| Borda: substituto na mesma turma e disciplina | coberta | `R4` (GET e PUT), com a reimportação real |
| Borda: turma sem professor alocado | coberta | `S12` |
| Borda: virada de ano letivo | coberta | `S5`, `S7`, `J14`, `virada-do-ano.int.test.ts` (inclusive o vínculo encerrado antes e a escola B intacta) |
| Borda: texto com nome de aluno | coberta | aviso no painel (foto RF5); `G5` e "o texto da aula não vai a log" (`semana.int.test.ts`); nada em auditoria |
| Pronto: os 15 RF com a prova da coluna "Como se prova" | cumprido | seção 1 |
| Pronto: cada id do `cenarios.md` com o caso numa tarefa | cumprido | S1–S17, G1–G7, R1–R7 e R1b, J1–J16, T1–T11 nos nomes dos casos de `semana.int`, `aulas.int`, `semana-itens.int`, `semana-reimportacao.int`, `aula.int`, `montar-dias.test`, `semana.test`, `matriz.test`, `leitura-do-titular.test` e dos três e2e |
| Pronto: nenhuma rota da coordenação, da rede ou do aluno devolve o texto ou contagem; o arquivo `coordenacao` não traz a `aula` | cumprido | RF11 |
| Pronto: reimportar grade e calendário não apaga texto passado | cumprido | `J3`, `J4`, `J10`, mutação 3 |
| Pronto: cabe a 1366 × 768 sem a página rolar e funciona a 360 px | cumprido | e2e "T10" e "a 1366 × 768 só o painel da aba rola…" verdes; a vitrine diz "Nenhuma tela rola a 1366 × 768" em todas as fotos; fotos de celular sem rolagem de lado |
| Pronto: `docs/lgpd.md`, `docs/modelo-de-dados.md` e `docs/interface.md` 1.8 descrevem o que foi feito | cumprido, com ressalva | `lgpd.md` tem a linha "Registro da aula"; `modelo-de-dados.md` tem a `Aula` nova; `interface.md` 1.8 não tem os dois links do Hoje (maior M1) |
| Pronto: roteiro da demonstração conferido na 6.0 | cumprido | `docs/roteiro-da-demonstracao.md` alterado na 6.0 |
| Pronto do roadmap: o professor vê a semana sem cadastrar nada; feriado e recesso tiram a aula; nenhuma tela mostra dado de outra escola | cumprido | RF1, RF3, RF9 e RF10 |

### 3. Portão

| Portão | Resultado |
|---|---|
| `npm run typecheck` | não rodado: suíte inteira, fica para a esteira |
| `npm run lint` | não rodado: suíte inteira, fica para a esteira |
| Integração que serve de evidência, isolada | ✅ `semana.int`, `aulas.int`, `semana-itens.int`, `semana-reimportacao.int`, `aula.int`: 116 passaram; `virada-do-ano.int`, `arquivo-do-titular.int`, `eliminar-titular.int` (worker), `migracao-f2.int`: 103 passaram |
| Unidade que serve de evidência, isolada | ✅ 29 arquivos (`apps/api/src/semana`, `packages/shared` semana, permissão e privacidade, `packages/core` titular, semana e `grade.test.ts`, `apps/web` turmas, `DaySelector`, `Textarea`): 409 passaram |
| e2e da funcionalidade | ✅ `professor-semana.spec.ts`, `professor-semana-painel.spec.ts`, `professor-semana-itens.spec.ts`: 96 passaram (48 em `chromebook` e 48 em `celular`), 1,3 min |
| `npm run test:infra` | não rodado (a carga da Semana foi medida na correção `carga-da-semana`: p95 de 26 ms) |
| Esteira do GitHub | conferida no fechamento: não entra no veredito |
| Revisões com veto registradas e aprovadas | ✅ |

`node_modules` estava em dia com o `package-lock.json`: não precisei de `npm ci`. Nenhum teste rodado ficou vermelho, fora as três mutações
e o caso m1, que eram para ficar vermelhos.

### 4. Achados

**Críticos**
- nenhum

**Maiores**
- **M1** `docs/interface.md:414-416` (1.8, "Os itens do dia"): o texto diz que o Hoje ganha **um** link "Ver a semana desta turma". O código
  (`TurmaHoje.tsx`, desde a divergência da 8.0) põe um link por vínculo confirmado com disciplina na turma, e com dois ou mais cada um
  mostra a disciplina ("Ver a semana desta turma · Química"). A foto `professora--professor-turmas-01a1b46d-…--computador.png` mostra os dois.
  A Tech Spec §9 e o `cenarios.md` T5 foram atualizados, mas a interface, que vale desde 30/10, não: quem desenhar outra tela pela 1.8 faz um
  link só, sem saber qual disciplina filtrar. O critério de pronto pede que a 1.8 descreva o que foi feito. Correção: trazer à 1.8 a frase da
  §9 (um link por vínculo com disciplina; com dois ou mais, a disciplina no texto visível, pelo 2.4.4; nenhum link sem vínculo lido). Dono: Arquiteto.

**Menores** (o Orquestrador leva ao `TODO.md` no fechamento)
- **m1** `packages/core/src/semana/texto-acompanha-a-grade.repository.ts:45` (`parear`), Arquiteto/produto: a aula dupla que anda um horário
  inteiro (7h30 e 8h20 passam a 8h20 e 9h10) troca os textos de lugar. A das 8h20 "continua" e fica com o texto da segunda aula, e o da
  primeira vai para as 9h10. Rodei esse caso dentro de `semana-reimportacao.int.test.ts` e depois tirei: recebido `[08:20 'segunda aula',
  09:10 'primeira aula']`. É o que o RF14 escreve ("a que continua fica com o texto"), e nenhum texto se perde, mas o planejamento da aula
  dupla fica na ordem trocada. Decidir no PRD se o pareamento de um vínculo e dia que muda mais de uma aula deveria ser por posição.
- **m2** `docs/interface.md:1739` (10.2, `Textarea`), Arquiteto: a prop nova `contadorAnunciado` (7.0, `Textarea.tsx`) não está no catálogo.
  Já está no `estado.md` como pendência para a retro.
- **m3** `docs/modelo-de-dados.md` (parágrafo da `Aula`), Arquiteto: "Quem o grava é a rota `PUT /v1/aulas` (F2b, 2.0)". A rota é da 4.0.
- **m4** `e2e/professor-semana.spec.ts:288` (T8), test-engineer: "Semana de recesso" e "O ano letivo ainda não começou" só têm caso em
  `semana.test.ts` e `Semana.test.tsx`. O `cenarios.md` T8 pede e2e. Já está no `TODO.md` (6.0, test-engineer, 1ª). Fica listado para não sumir.
- **m5** `tasks/prd-semana-do-professor/estado.md`, "Devo ainda", Orquestrador: os quatro destinos da ordem r1 da 1.0 (volume do `delete`
  no encerramento do ano, reserva do expurgo da `aula`, rótulo em `Retencao.tsx`, S7 do `cenarios.md`) ainda não estão no `TODO.md`.
  Sobre o rótulo: `Retencao.tsx` já mostra "registro_da_aula" pela descrição de `PRAZOS_FIXOS` (`packages/shared/src/privacidade/retencao.ts`),
  então o item pode fechar sem código.
- **m6** `tools/vitrine/foto.ts:234`, dono do processo: `--clicar` espera o clique nos dois tamanhos, e um controle que só existe no celular
  (o `DaySelector`) estoura o prazo no computador e a chamada morre. Não deu para fotografar a quarta com os itens a 360 px. A escola
  da vitrine também não tem grade (já está no `TODO.md`, 8.0): por isso gravei a grade à mão no banco de teste.
- **m7** `CartaoDaAula.tsx:50` e `PainelDaAula.tsx:101`, frontend-reviewer: "Sala {sala}" vira "Sala Laboratório de Ciências" quando a
  planilha traz o nome do ambiente (foto `f2b/semana-2026-11-02--computador.png`). Gosto, não defeito.

**Positivos**
- O caso de corrida com a ordem forçada (`esperarNaTrava`, a pausa por gatilho, nunca `sleep`) virou padrão em J11a, J11b, J12, J14 e J16,
  e cada um diz qual troca de ordem o deixa vermelho.
- A reimportação é provada com o job real do F2, e não com escrita direta na `alocacao`: J1–J16 e R4.
- O `select` dos itens é a lista exata do contrato, e o teste confere as chaves exatas: nota e nome de aluno não têm como vazar.

### 5. Conclusão

Os 15 RF estão atendidos, com código e teste efetivo, e as telas foram vistas no computador e a 360 px. Nenhum crítico. As três provas de
mutação, nas cláusulas de dono, de disciplina e de "hoje em diante", ficaram vermelhas. Todos os testes rodados passaram: 116 + 103 de
integração, 409 de unidade e 96 de e2e. Todo revisor obrigatório tem rodada, e a última de cada um é APROVADO. A revisão da spec está
APROVADA na rodada 5. Não há commit de código sem a marca de tarefa ou de correção, nem commit `Fora do processo:`.

A ressalva é uma maior pontual de documentação, M1: a `docs/interface.md` 1.8 não acompanhou a divergência da 8.0. Ela não bloqueia a
próxima funcionalidade. Corrigi-la é uma frase na 1.8, e com isso a funcionalidade fica APROVADA.

### 6. Pendências herdadas

| Pendência | Dono | Destino |
|---|---|---|
| M1: os links do Hoje na `docs/interface.md` 1.8 | Arquiteto | correção de documento antes do pouso, ou `TODO.md` |
| m1: a ordem do pareamento da aula dupla que anda um horário inteiro | Arquiteto, Joaquim | `TODO.md` (produto), PRD da próxima fase que mexer na reimportação |
| m2: `contadorAnunciado` na 10.2 | Arquiteto | `TODO.md` / retro (já no `estado.md`) |
| m3: "F2b, 2.0" → "F2b, 4.0" no `modelo-de-dados.md` | Arquiteto | `TODO.md` |
| m4: T8 em e2e para recesso e ano que não começou | test-engineer | já no `TODO.md` (6.0) |
| m5: os quatro destinos da ordem r1 da 1.0 | Orquestrador | `TODO.md`, no fechamento |
| m6: `--clicar` da vitrine só num tamanho; vitrine sem grade | processo | `TODO.md` (a parte da grade já está lá) |
| m7: "Sala" antes do nome do ambiente | frontend-reviewer | `TODO.md` |
| Commits `Fora do processo:` com código da spec | — | nenhum |
| Esteira de `04041af2` | Orquestrador | conferida no fechamento |
