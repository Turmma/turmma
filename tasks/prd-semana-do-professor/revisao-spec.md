# Revisão de spec — semana-do-professor

**Subagentes obrigatórios:** `test-engineer`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `frontend-reviewer`

## Rodada 1 — 06/11/2026

**Veredito: REPROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | REPROVADO | 11: sem ano em curso; vínculo encerrado e substituto; outro ano e virada; cláusulas do "Gravar"; corrida com ordem forçada; colisão do RF14; "hoje" no fuso; recesso que atravessa a semana; bordas do PRD; itens do "Como se prova" no e2e; RF11 contra o arquivo do titular |
| `tenancy-guardian` | REPROVADO | 2: o texto no arquivo do titular da versão `coordenacao`; eventos sem teste de isolamento |
| `privacy-guardian` | REPROVADO | 2: o arquivo do titular da versão `coordenacao`; o texto fora da troca de nome, guardado 60 meses |
| `conformidade-reviewer` | REPROVADO | 1: o arquivo do titular da versão `coordenacao` (regra 70, itens 8 e 9) |
| `infra-guardian` | REPROVADO | 1: a gravação do registro fora da grade contra o re-chaveamento do job ("busca, verifica, grava") |
| `frontend-reviewer` | APROVADO | — |

### Correções exigidas na Tech Spec
- §2, §7: `aula` só na versão `completa` do arquivo do titular, classificada em `classificacao.ts`, fora de toda contagem da prévia; teste com texto marcado na versão `coordenacao` (tenancy, privacy, conformidade, test-engineer)
- §3, §7: o texto não pode ficar 60 meses com nome de aluno eliminado: sai na virada do ano, como o complemento da contestação (privacy, opção b)
- §5, §7c: trava por vínculo tomada pela gravação e pelo passo da grade, nos dois ramos; `lock_timeout` curto; corrida 3 (privacy, infra)
- §5: a colisão no início novo não apaga texto passado (infra, test-engineer)
- §4, §5, §9: resposta e tela da escola sem ano em curso; registros só dos vínculos confirmados; eventos que cruzam a semana (test-engineer)
- §6, §10: isolamento dos eventos; vínculo encerrado e substituto; outro ano; cláusulas do "Gravar"; corrida com ordem forçada; relógio falso no fuso; as bordas do PRD; cada item do "Como se prova" (tenancy, test-engineer), num `cenarios.md`

### Recomendações
- §9: erros da gravação, inclusive a aula que saiu da grade com o painel aberto; rascunho só em memória, descartado na troca de escola e na saída; acessibilidade (rótulos, foco, contador, "Hoje" em texto); dia inicial no celular; feriado no dia; rótulos dos itens em português; alvos de toque (frontend, privacy)
- §7c: `EXPLAIN` da consulta dos itens; o encerramento concorrente do vínculo é aceito (infra)
- PRD §9: a métrica da regra 80 às 7h sai, sem cenário de carga (infra)
- §9: "Falta preencher" sem total nem contador (conformidade)
- Substituto que entrou em maio vê as aulas de fevereiro (grade de hoje no passado): aceito, sem limite pela data do vínculo (test-engineer)

## Rodada 2 — 06/11/2026

**Veredito: REPROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | REPROVADO | 3: o "passado" do segundo ramo do "Gravar" sem cenário; aula dupla na leitura e na gravação; a gravação contra a virada do ano |
| `tenancy-guardian` | REPROVADO | 1: a trava tomada antes de conferir o vínculo distingue "não é seu" de "não existe" |
| `privacy-guardian` | APROVADO | — |
| `conformidade-reviewer` | APROVADO | — |
| `infra-guardian` | REPROVADO | 2: a gravação não trava o ano em curso contra o `virarAno`; o J11 não força a ordem em que o job espera a trava da gravação |

### Correções exigidas na Tech Spec
- §5 "Gravar": a ordem passa a ser `travarAnoEmCurso()` (`for share`), o vínculo conferido, a trava do vínculo (duas chaves, com a escola do contexto), a aula; `55P03` vira `INDISPONIVEL_TENTE_DE_NOVO` (tenancy, infra, test-engineer)
- §5 "Reimportar": o passo trava num comando só, em ordem de id, os vínculos que já existiam, e só então lê a `aula` (infra)
- `cenarios.md`: G1 com o registro sob feriado novo; aula dupla na leitura e na gravação; J11 nas duas ordens, com o ponto da pausa; J14, a virada; R1 com pendente, contestado e o vínculo de outra escola com a trava presa (tenancy, infra, test-engineer)

### Recomendações
- O registro passado num dia que virou feriado não é gravável, como na leitura (test-engineer)
- Coordenação e aluno direto nas duas rotas; S7 com a escola B e com o vínculo encerrado antes da virada; T7 com o armazenamento do navegador e a saída; T8 com o carregando; a grade do ano planejado não toca o texto do ano em curso (test-engineer, privacy, tenancy)
- Comentário do critério 5 do arquivo do titular com a `aula`; a chave nova de prazo fixo em `classificacao.ts`; a `aula` não vira categoria da prévia do professor (privacy, conformidade)

## Rodada 3 — 06/11/2026

**Veredito: REPROVADA** (só os três revisores com bloqueante na rodada 2)

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | REPROVADO | 2: o "passado" do G1 ainda não falsificável; a trava presa do R1 com outra escola nunca coincide de chave |
| `tenancy-guardian` | REPROVADO | 1: o R1 precisa da trava presa por colega da mesma escola |
| `infra-guardian` | REPROVADO | 2: deadlock possível entre o passo da `aula` e o `FOR UPDATE` de `encerrarOsMarcados`; o J11b não segura a trava até o job esperar |

### Correções exigidas na Tech Spec
- §5 "Reimportar": o passo roda entre `gravarAulas` e `encerrarOsMarcados`, com a escola do registro da importação, travando na ordem da chave; §7c ganha a ordem global ano → trava do vínculo → linha do vínculo (infra)
- `cenarios.md`: G1 com data futura, dia útil, sem alocação e registro gravado direto; R1b com a trava presa por colega da mesma escola e pela chave de A com o vínculo de B; J11b com a trava presa numa transação aberta até o job esperar; J16, a gravação contra o vínculo que sai da grade; J11a, J12 e J14 com o ponto da pausa e a soltura por `pg_stat_activity` (test-engineer, tenancy, infra)

## Rodada 4 — 06/11/2026

**Veredito: REPROVADA** (só os três revisores com bloqueante na rodada 3)

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | REPROVADO | 1: o J16 não força a ordem que produz o `40P01` com o passo no lugar errado |
| `tenancy-guardian` | APROVADO | — |
| `infra-guardian` | REPROVADO | 1: o mesmo J16 |

### Correções exigidas
- `cenarios.md`, J16 no formato do J11b: a transação do teste segura a trava do vínculo marcado, o job para nela, só então o insert novo (que passa pela FK) e o commit; nenhum `40P01` nem `55P03`, nem na primeira tentativa do job; vermelho com o passo depois de `encerrarOsMarcados` (test-engineer, infra)

### Recomendações aplicadas
- Tech Spec §5: a conferência do vínculo lê sem trava de linha, nunca `VinculoRepository.travar`; as travas do passo na ordem de `hashtext`; o `fim` copiado não acompanha a troca só do fim (infra). §6: a escola do passo é a do `requireEscolaId()` do job; R1b e R7 citados (tenancy)
- `cenarios.md`: cada caso do G1 cumpre as outras cláusulas, e o G4 tem alocação; "hoje" não é passado (G1, S14); `esperarNaTrava` com padrão em `pg_advisory_xact_lock` (J11b, J16); J13 pela fila da trava e pelo código, não pelo tempo (test-engineer)

## Rodada 5 — 06/11/2026

**Veredito: APROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | APROVADO | — |
| `tenancy-guardian` | APROVADO (rodada 4) | — |
| `privacy-guardian` | APROVADO (rodada 2) | — |
| `conformidade-reviewer` | APROVADO (rodada 2) | — |
| `infra-guardian` | APROVADO | — |
| `frontend-reviewer` | APROVADO (rodada 1) | — |

### Recomendações aplicadas
- J11b e J16: o prazo é o `lock_timeout` de 1 s do job, e o insert e o commit vêm logo depois da espera; o `esperarNaTrava` casa a classe própria da trava do vínculo e `wait_event = 'advisory'` (a do convite da escola também é consultiva); o vermelho do J16 é `40P01` ou `55P03`; "o erro de `executarPlanilha` na primeira chamada" (infra, test-engineer)

Nenhuma correção mudou o desenho nem critério de aceite do PRD: só o RF15 ganhou "com um dos dois textos" e a retenção da seção 8 passou a "até a virada do ano letivo", as duas no sentido do que o Joaquim aprovou (aviso, D79).

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-06 13:18:22 | 2026-11-06 13:18:54 | `frontend-reviewer` | 1 | APROVADO | a12b1b770aad02628 |
| 2026-11-06 13:18:12 | 2026-11-06 13:19:51 | `tenancy-guardian` | 1 | REPROVADO | aaa2659e379723dc8 |
| 2026-11-06 13:18:17 | 2026-11-06 13:20:06 | `conformidade-reviewer` | 1 | REPROVADO | ad43a563e5ed71af4 |
| 2026-11-06 13:18:20 | 2026-11-06 13:20:55 | `infra-guardian` | 1 | REPROVADO | a4597bc76467dcb74 |
| 2026-11-06 13:18:14 | 2026-11-06 13:21:16 | `privacy-guardian` | 1 | REPROVADO | a856f7170a66ea33e |
| 2026-11-06 13:18:08 | 2026-11-06 13:21:16 | `test-engineer` | 1 | REPROVADO | a696ae22b339c700b |
| 2026-11-06 13:24:38 | 2026-11-06 13:25:20 | `conformidade-reviewer` | 2 | APROVADO | ad70e7d2c193c6062 |
| 2026-11-06 13:24:31 | 2026-11-06 13:25:20 | `tenancy-guardian` | 2 | REPROVADO | af363cc3fc8b6ffd1 |
| 2026-11-06 13:24:35 | 2026-11-06 13:25:46 | `privacy-guardian` | 2 | APROVADO | a2d317742948a042a |
| 2026-11-06 13:24:42 | 2026-11-06 13:27:22 | `infra-guardian` | 2 | REPROVADO | a79b81912e3b9339b |
| 2026-11-06 13:24:27 | 2026-11-06 13:27:38 | `test-engineer` | 2 | REPROVADO | afe0d7e4062650f22 |
| 2026-11-06 13:28:46 | 2026-11-06 13:29:30 | `tenancy-guardian` | 3 | REPROVADO | a0ac9c51efd093ff6 |
| 2026-11-06 13:28:54 | 2026-11-06 13:31:08 | `test-engineer` | 3 | REPROVADO | a4db4ca725f865ae2 |
| 2026-11-06 13:28:50 | 2026-11-06 13:31:27 | `infra-guardian` | 3 | REPROVADO | a25f990c49b6892e4 |
| 2026-11-06 13:33:26 | 2026-11-06 13:34:06 | `tenancy-guardian` | 4 | APROVADO | a30180c9d596d7379 |
| 2026-11-06 13:33:32 | 2026-11-06 13:36:20 | `infra-guardian` | 4 | REPROVADO | a70eb53934953167c |
| 2026-11-06 13:33:37 | 2026-11-06 13:36:47 | `test-engineer` | 4 | REPROVADO | a195ddb76018520c6 |
| 2026-11-06 13:37:10 | 2026-11-06 13:38:53 | `infra-guardian` | 5 | APROVADO | a1c821e838af3fda8 |
| 2026-11-06 13:37:14 | 2026-11-06 13:39:28 | `test-engineer` | 5 | APROVADO | a648f645fc1ac5913 |
