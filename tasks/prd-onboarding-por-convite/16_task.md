# Tarefa 16.0 — A escola inteira entra de uma vez, provada de ponta a ponta e sob carga

**Funcionalidade:** onboarding-por-convite · **Depende de:** 14.0, 15.0
**Subagentes obrigatórios:** `infra-guardian`, `frontend-reviewer`
**Porte:** grande

## Objetivo

O e2e do RF18 prova a escola entrando só pela tela, em `chromebook` e `celular`, e o cenário de carga prova que a prévia,
o gravar e o job de 3.000 linhas não derrubam o login, o gerar acesso nem a decisão das 7h30.

## Contexto necessário

- `techspec.md` §7c (Tempo; Métrica e alerta), §10, §13 (o passo (3) contra o gerar acesso das 7h30: falhando o [C], a
  spec volta à revisão)
- `prd.md` RF1, RF15, RF18; §11 (RF15: o teto é 2 s, não 10 s)
- `cenarios.md` E2E; RF2 (os dois [C])
- Regra 40 ("Os fluxos que exigem E2E": onboarding completo, planilha suja); regra 80 itens 1, 10 e 11
- Código: `e2e/escola-montada.spec.ts` (W1); `infra/k6/login-7h30.js`, `infra/scripts/carga-login.ts`,
  `infra/compose.carga.yml`; `docs/roteiro-da-demonstracao.md`

## Subtarefas

- [x] 16.1 — `e2e/escola-por-planilha.spec.ts`: escola vazia → quatro planilhas (a de alunos suja) → o professor aceita o convite copiado e confirma o que a grade definiu → um aluno reivindica com matrícula → aprovação; casos com seed compartilhado
- [x] 16.2 — O modelo servido pela tela, preenchido, entra sem erro
- [x] 16.3 — Cenário k6 `importacao-7h30.js`: prévia e gravar com 3.000 linhas junto da rajada de login; job com transferências contra o gerar acesso e a decisão nessas turmas; job com desligamentos e com a virada; job de professores contra o login deles
- [x] 16.4 — `docs/roteiro-da-demonstracao.md` conferido passo a passo contra `e2e/roteiro-da-demonstracao.spec.ts` (a lista da turma mudou de contrato na 8.0 e de tela na 13.0)
- [x] 16.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `e2e/escola-por-planilha.spec.ts`, `e2e/support/planilhas.ts` | novo |
| `infra/k6/importacao-7h30.js`, `infra/scripts/carga-importacao.ts`, `infra/test/carga-importacao.test.ts` | novo |
| `docs/roteiro-da-demonstracao.md`, `e2e/roteiro-da-demonstracao.spec.ts` | alterado, se o roteiro mudou |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| Escola vazia recebe as quatro planilhas, com a de alunos suja (erro, corrige, grava) | e2e | RF18, RF2 | `e2e/escola-por-planilha.spec.ts › RF18 e RF2 (16.0): a escola vazia recebe as quatro planilhas pela tela › a planilha de alunos suja mostra o erro de cada linha e não grava; corrigida, grava, e a escola vazia ganha as turmas`; `› a planilha de professores cadastra a equipe, …`; `› a grade cria as turmas, …`; `› o calendário do ano entra pela tela …` |
| O professor aceita o convite copiado | e2e | RF18 | `e2e/escola-por-planilha.spec.ts › RF18 (16.0): o professor aceita o convite copiado e confirma o que a grade definiu › o professor abre o link do convite que a coordenação copiou, aceita, cria a senha e entra` |
| O professor confirma o vínculo que a grade definiu, e antes disso não alcança a turma | e2e | RF18, RF8 | `e2e/escola-por-planilha.spec.ts › RF18 (16.0): o professor aceita o convite copiado e confirma o que a grade definiu › o professor confirma o vínculo que a grade definiu: antes não alcança a turma, depois a abre` |
| Um aluno reivindica com matrícula, o professor aprova, e o aluno entra e vê só a turma dele | e2e | RF18 | `e2e/escola-por-planilha.spec.ts › RF18 (16.0): o aluno pede o nome pela matrícula e o professor aprova › a aluna abre a turma pelo código …`; `› o professor aprova o pedido pela tela, …`; `› a aluna aprovada entra com a matrícula e a senha que criou e vê só a turma dela, sem o colega` |
| O fluxo passa em `chromebook` e em `celular`, com axe | e2e | RF18 | os mesmos casos, nos dois projetos; cada um termina em `conferirTela(page)` (axe e sem rolagem horizontal) |
| O modelo servido pela tela, preenchido, entra sem erro | e2e | RF1 | `e2e/escola-por-planilha.spec.ts › RF1 (16.0): o modelo servido pela tela, preenchido, entra sem erro › o modelo de alunos: o botão do painel baixa o arquivo …` (e `professores`, `grade`, `calendario`) |
| Prévia e gravar com 3.000 linhas e a rajada de login: p95 até 2 s | carga | RF15 | `npm run carga:importacao -- --fases previa_e_gravar` (`infra/k6/importacao-7h30.js`, `FASE=previa_e_gravar`: `previa_duracao` e `gravar_duracao` com `p(95)<2000`) |
| Job de 3.000 linhas com transferências contra o gerar acesso e a decisão: zero 503, espera de trava com p95 abaixo de 300 ms, passo (3) abaixo de 1 s | carga | §13 | `npm run carga:importacao -- --fases transferencias` (`FASE=transferencias` contra `transferencias_base`; `julgarEsperaDeTrava` e `julgarPasso3`) |
| Job de 100 e de 300 desligamentos (em três gravares de 100, o teto por gravar) e a virada de 900 alunos (`vinculo.criado` um por um): passo (3) abaixo de 1 s | carga | §7c (10.0) | `npm run carga:importacao -- --fases desligamentos_e_virada` (`FASE=desligamentos_e_virada`, cinco jobs) |
| Gravar com 101 marcas de desligar é recusado, e com 100 o job desliga as 100 e a auditoria diz quem e quando; a tela marca até o teto e diz por quê | integração, unidade | §13 (teto) | `apps/api/test/importacao-alunos.int.test.ts › o desligamento tem teto por gravar`; `packages/shared/src/importacao/contratos.test.ts › o teto de desligamentos por gravar`; `previa-da-planilha.test.ts › 16.0, unidade: o desligamento tem teto por gravar`; `ImportarPlanilha.test.tsx › com mais gente a desligar do que cabe num gravar` |
| Job de professores contra o login deles: zero 503 no login | carga | §7c | `npm run carga:importacao -- --fases professores` (`FASE=professores`, `respostas_503: count==0`) |
| O cenário de carga tem as contas e as linhas que diz ter (modo seco) | unidade | o cenário não mente | `infra/test/carga-importacao.test.ts › as planilhas do cenário "a escola inteira entra de uma vez" › a planilha de alunos tem as 3.000 linhas do teto, em 100 turmas de 30, …` (e os outros casos do mesmo `describe`) |
| O teste de carga não chama provedor pago | unidade | regra 80, item 11 | `infra/test/carga-importacao.test.ts › o que o k6 do cenário chama e exige › o cenário só chama a prévia, o gravar, a leitura da importação, o gerar acesso, o decidir e o login por e-mail: nada de provedor pago (regra 80, item 11)` |

## Como testar

- E2E: `e2e/escola-montada.spec.ts › W1: da escola vazia à aluna aprovada, só pela tela — …`; a planilha suja: o spec da 13.0
- Carga: `infra/k6/login-7h30.js` (os cenários `rajada_primeiro_minuto` e `rajada_resto`); o modo seco: `infra/test/carga-login.test.ts › as contas do cenário "login às 7h30" › a rajada tem as 2.100 contas das três escolas, …`
- Comandos: `node tools/ci/e2e.ts --manter-ambiente e2e/escola-por-planilha.spec.ts`; a carga, pelo `docs/runbook.md` (`infra/compose.carga.yml`), com `flock /tmp/educa-carga.lock`
- Armadilha: o e2e perto de 2/3 do prazo vira dívida da `develop` (X8); divida em casos com seed compartilhado desde o começo
- **Telas:** as das 13.0, 14.0 e 15.0, em sequência; `professora` no aceite e na confirmação; `aluno` na reivindicação

## Autoconferência

As 12 perguntas do modelo, no plano. Na 4, o [C] precisa chegar ao passo (3): a planilha tem transferências nas turmas onde o gerar acesso roda.

**Plano.** (1) `e2e/support/planilhas.ts` e `e2e/escola-por-planilha.spec.ts`: 13 casos (26 com os dois projetos), cada um provando uma etapa **pela tela** e semeando as de
antes pela **rota de verdade** (`POST /v1/importacoes/:tipo` com o token da coordenação, e o job esperado), para nenhum caso passar de 15 s (metade do prazo). (2) `infra/k6/importacao-7h30.js`,
`infra/scripts/carga-importacao.ts` e `conferir-carga-importacao.ts`: cinco fases, cada uma numa escola montada pela API (e, só para o aluno que já está aprovado e para a conta
que ganha senha, pelo banco, como o `carga:login`); a espera de trava por diferença contra a base; o passo (3) pelo Prometheus. (3) `infra/test/carga-importacao.test.ts`: o modo
seco. (4) `docs/roteiro-da-demonstracao.md` (passos 5, 7 e 9) e `docs/runbook.md` ("Rodar o cenário da importação"). Exports novos em `carga-sala.ts` (`chamarApi`, `importarDaApi`) e
`carga-login.ts` (`semearContas`): só a palavra `export`.

1. **Mutação de cada cláusula:** o código de produção da tarefa é só o teto de 100 desligamentos por gravar (`contratos.ts`, `previa-da-planilha.ts` e `ImportarPlanilha.tsx`), e a seção "Mutações" traz um bloco para cada cláusula dele (11). O resto é `e2e/`, `infra/` e documento, sem bloco; e o teste de modo seco
   prova a regra do cenário por conta própria: o veredito reprova na espera de 300 ms, no passo (3) acima de 1 s, na fase que não rodou, na conferência que não rodou.
2. **Texto novo na tela:** só o do teto de desligamentos (`AVISO_DO_TETO_DE_DESLIGAR`, `AVISO_DO_TETO_ATINGIDO` e o rótulo "Marcar os primeiros 100 para desligar", em `previa-da-planilha.ts`), que o teste de tela fixa. O e2e só usa textos que já existem (`grep` nos specs da 13.0, 14.0 e 15.0); o roteiro passa a citar os de hoje.
3. **Segundo dado:** o seed do e2e tem duas turmas (7º A, com a aluna e a colega, e 8º A, com um aluno de outra turma): a aprovada vê só a dela e não vê nem a colega nem o aluno da outra turma; a carga tem 100 turmas, 60 com professora e 40 sem, e nenhuma transferência
   cai só nas turmas com professora (as de destino também existem na planilha).
4. **Checagem anterior que responde antes:** o [C] só vale se o passo (3) chegar a rodar. O cenário pede `PASSO_3_MINIMO` observações do histograma em cada fase e reprova com menos; os
   pedidos pendentes são nomes que a planilha não cita (a assinatura não os vê), então a decisão em paralelo não deixa o job `desatualizada`; e a prévia tem a conta das marcas
   (`marcas_fora_do_esperado`): 300 transferências, 100 desligamentos por gravar (as rodadas do de 300 também), 0 na virada.
5. **Asserção sobre o resultado:** o e2e confere o banco (contagens de vínculo e de lista por estado, aulas da turma) e a tela; a carga confere o banco (importações por estado) e o Prometheus
   (5xx, passo (3), jobs por resultado). Nenhuma só sobre texto de arquivo.
6. **Guarda nova:** nenhuma.
7. **Comentário que afirma o que o código não faz:** conferi os docblocks dos arquivos novos. O de `carga-importacao.ts` diz que a espera de trava é medida **por diferença** (não há métrica
   própria), e o runbook diz o mesmo.
8. **Divergência:** ver a seção "Divergências".
9. **Peça que já existe:** `semearContas` e `argumentosDoK6DeLogin` (a rajada do F1), `chamarApi`, `importarDaApi`, `lerResumoDaFase`, `argumentosDoCompose`; nada copiado. No e2e, `escolaVazia`,
   `conferirTela`, `entrarComEmail`, `ImportarPlanilha`-helpers da 13.0 a 15.0.
10. **Duas ao mesmo tempo / fora de ordem:** a carga é isso: o job, o gerar acesso, a decisão e o login em paralelo; as duas coordenações da mesma escola disputam as duas vagas da planilha; a
    segunda importação com uma `na_fila` responde `CONFLITO` (o k6 conta `gravares_aceitos` e espera o job antes de gravar de novo).
11. **Isolamento e "Caso":** nenhum repository novo. A aluna aprovada não vê o colega (e2e). A coluna "Caso" da tabela de testes está preenchida.
12. **Guardiões:** `infra-guardian` (o cenário de carga, as vagas e o passo (3)) e `frontend-reviewer` (o e2e: os quatro estados, 360 px, axe e o roteiro).

**Resultado da carga (`npm run carga:importacao`, 06/11/2026, 15 min, passou):** prévia p95 319 ms e gravar p95 196 ms com 3.000 linhas e a rajada de login (p95 107 ms, zero 5xx e 503); transferências: passo (3) 12 vezes até 1 s, espera de trava +4 ms (gerar acesso) e +6 ms (decisão), zero 503; desligamentos (100; 300 em três de 100) e virada de 900: passo (3) 5 vezes até 0,75 s; professores: 11 jobs, 181 logins, zero 503. Números e leitura em `docs/runbook.md`.

## Fora do escopo desta tarefa

O e2e de e-mail, senha e conta da escola (F2c).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| Teto de 100 desligamentos por gravar (contrato, tela e cenário), em vez de só medir | A medida pedida pelo critério falhou: sem teto, 100 desligamentos ficaram abaixo de 0,75 s, 200 entre 1 e 1,5 s e 300 entre 1,5 e 3 s no passo (3), contra o alerta de 1 s. O próprio critério autoriza "teto nas marcas ou comandos em grupo só se falhar"; o teto é a opção menor e não mexe no ciclo de vida. A tela diz o que fazer (gravar e enviar a planilha de novo). Com o teto, 100 e 3 × 100 e a virada de 900 ficam até 0,75 s | `techspec.md` §13 (acrescentado nesta tarefa); `cenarios.md` (dois casos novos); `docs/interface.md` §3; `docs/runbook.md` |
| `infra/scripts/carga-sala.ts` e `carga-login.ts` mudam: só ganharam `export` (`ModulosDaApi`, `importarDaApi`, `chamarApi`, `semearContas`) | O driver novo reaproveita a montagem pela API e a rajada de login do F1, em vez de copiá-las | Arquivos previstos da tarefa (a lista não os cita) |
| `package.json` ganha `carga:importacao`; `docs/runbook.md`, `techspec.md`, `cenarios.md`, `docs/interface.md`, `TODO.md` também mudam | O comando do cenário; os documentos dizem o teto e o resultado medido | Arquivos previstos da tarefa (a lista não os cita) |
| `ImportarPlanilha.tsx`: o resumo das marcas ganha `aria-live="polite"` | Item do `TODO.md` apontado à 16.0 (conformidade-reviewer, 13.0, 2ª) | `TODO.md` |

## Mutações

O teto de 100 desligamentos por gravar (Divergências): o contrato, a marcação e os avisos da tela. O que a 16.0 mede (e2e, carga) é teste, e não tem bloco.

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › com mais gente a desligar do que cabe num gravar
-{passaDoTeto(acao, candidatos.length) && <p className="text-sm break-words text-apoio">{AVISO_DO_TETO_DE_DESLIGAR}</p>}
+{false && <p className="text-sm break-words text-apoio">{AVISO_DO_TETO_DE_DESLIGAR}</p>}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › com mais gente a desligar do que cabe num gravar
-{noTeto && passaDoTeto(acao, candidatos.length) ? AVISO_DO_TETO_ATINGIDO : ''}
+{false ? AVISO_DO_TETO_ATINGIDO : ''}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.tsx
teste: apps/web/src/areas/coordenacao/importacao/ImportarPlanilha.test.tsx › com mais gente a desligar do que cabe num gravar
-<input type="checkbox" checked={escolhidos.has(candidato.id)} disabled={noTeto && !escolhidos.has(candidato.id)} onChange={() => aoMarcar(acao, candidato.id)} className="size-5 shrink-0" />
+<input type="checkbox" checked={escolhidos.has(candidato.id)} disabled={false} onChange={() => aoMarcar(acao, candidato.id)} className="size-5 shrink-0" />
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › 16.0, unidade: o desligamento tem teto por gravar
-else if (doGrupo.size < tetoDeMarcas(acao)) doGrupo.add(id)
+else doGrupo.add(id)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › 16.0, unidade: o desligamento tem teto por gravar
-export const tetoDeMarcas = (acao: AcaoDeMarca): number => (acao === 'desligar' ? MAXIMO_DE_DESLIGAMENTOS_POR_GRAVAR : Number.POSITIVE_INFINITY)
+export const tetoDeMarcas = (acao: AcaoDeMarca): number => (acao === 'desligar' ? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › 16.0, unidade: o desligamento tem teto por gravar
-export const tetoDeMarcas = (acao: AcaoDeMarca): number => (acao === 'desligar' ? MAXIMO_DE_DESLIGAMENTOS_POR_GRAVAR : Number.POSITIVE_INFINITY)
+export const tetoDeMarcas = (acao: AcaoDeMarca): number => MAXIMO_DE_DESLIGAMENTOS_POR_GRAVAR
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › 16.0, unidade: o desligamento tem teto por gravar
-return marcaveis.length > 0 && marcaveis.every(({ id }) => escolhidas[acao].has(id))
+return marcaveis.every(({ id }) => escolhidas[acao].has(id))
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › 16.0, unidade: o desligamento tem teto por gravar
-return { ...escolhidas, [acao]: todosMarcados(escolhidas, acao, candidatos) ? new Set<string>() : new Set(marcaveis.map(({ id }) => id)) }
+return { ...escolhidas, [acao]: false ? new Set<string>() : new Set(marcaveis.map(({ id }) => id)) }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.ts
teste: apps/web/src/areas/coordenacao/importacao/previa-da-planilha.test.ts › 16.0, unidade: o desligamento tem teto por gravar
-passaDoTeto(acao, quantos) ? `Marcar os primeiros ${String(MAXIMO_DE_DESLIGAMENTOS_POR_GRAVAR)} para desligar` : rotulo
+false ? `Marcar os primeiros ${String(MAXIMO_DE_DESLIGAMENTOS_POR_GRAVAR)} para desligar` : rotulo
```

```mutacao
arquivo: packages/shared/src/importacao/contratos.ts
teste: packages/shared/src/importacao/contratos.test.ts › o teto de desligamentos por gravar
-desligar: z.array(z.uuid()).max(MAXIMO_DE_DESLIGAMENTOS_POR_GRAVAR).default([]),
+desligar: z.array(z.uuid()).default([]),
```

```mutacao
arquivo: packages/shared/src/importacao/contratos.ts
teste: apps/api/test/importacao-alunos.int.test.ts › o desligamento tem teto por gravar
-desligar: z.array(z.uuid()).max(MAXIMO_DE_DESLIGAMENTOS_POR_GRAVAR).default([]),
+desligar: z.array(z.uuid()).default([]),
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| frontend-reviewer (1ª), revisor-geral (1ª) | `empty:hidden` nos dois `<p aria-live>` de `ImportarPlanilha.tsx` (`display:none` enquanto vazio: o leitor de tela pode não anunciar a primeira mudança) | `TODO.md`, para a validação ouvir com leitor de tela. É código de produção e muda o DOM; o frontend-reviewer condicionou a troca a esse teste |
| frontend-reviewer (1ª), conformidade-reviewer (1ª) | Fotografar na validação o estado do teto (mais de 100 a desligar), a 360 px e a 1366 px | `TODO.md`, para o Validador (ele fotografa cada requisito com tela) |
| frontend-reviewer (1ª) | A escola "vazia" da vitrine já tem turma e professora (o e2e semeou antes); o vazio sem registro só se vê pelo código | Recusada nesta tarefa: é ferramenta (`tools/vitrine/`), fora dos arquivos da 16.0; segue para a validação |
| conformidade-reviewer (1ª), revisor-geral (1ª) | "Marcar os primeiros 100" segue a ordem da API, parte dos marcados fica em "Ver mais"; e descarta as marcas feitas à mão no grupo com mais de 100 | `TODO.md`: muda texto de tela e comportamento, decisão de interface para a validação (D80, `docs/interface.md`) |
| conformidade-reviewer (1ª) | Três fotos em branco (`celular-2` da grade nas duas escolas e `vazia--…professores--celular.png`) | Recusada: o frontend-reviewer leu o mesmo conjunto e explicou como artefato da captura de página inteira (barra fixa); não é defeito da tela |
| infra-guardian (1ª) | Transferência sem teto (medida 300, a planilha aceita 3.000) e virada medida com 900 (aceita 3.000) | `TODO.md`, para a validação medir 1.000 e 3.000 transferências e a virada de 3.000 uma vez antes do pouso; passando de 1 s, aplicar o teto ou gravar a auditoria em lote |
| infra-guardian (1ª), test-engineer (1ª), privacy-guardian (1ª) | `EXPLAIN` do `or()` com 500 pares em `vinculo_usuario_idx`; duas tentativas do mesmo job de transferência em paralelo (D49); `lista.transferida` e `lista_nome.retirado` fora do arquivo do titular | Já no `TODO.md`, apontados para a validação e a retro |
| privacy-guardian (1ª) | Pasta da execução da carga com 0777 e arquivos 0644: guarda para recusar fora de `AMBIENTE` de carga | `TODO.md`: muda comportamento do script; hoje o comentário diz que é sintético e a pasta é apagada no `finally` |
| privacy-guardian (1ª) | Os helpers de `e2e/support/planilhas.ts` não devem passar a devolver nome nem matrícula | Sem ação: é cuidado para o futuro, hoje só contam e buscam id |
| test-engineer (1ª) | Modo seco: exportar `PROFESSORES_QUE_JA_EXISTEM` e `PROFESSORES_NOVOS_POR_VOLTA` e comparar as constantes; a conta 36 não prova "cada lote de uma professora só" | `TODO.md`: toca `infra/scripts/carga-importacao.ts` (caduca todos os revisores) por uma conta que hoje confere |
| test-engineer (1ª) | Os thresholds do k6 são conferidos por `toContain` no texto do arquivo | Recusada: é o padrão do `carga-login` (o próprio revisor o diz); o resultado vem do Prometheus e do banco (Autoconferência 5), e o que o modo seco confere é o veredito |
| revisor-geral (1ª) | O teto de 100 aparece copiado em `infra/scripts/carga-importacao.ts` (`DESLIGAMENTOS_POR_GRAVAR`) | Retro: o modo seco confere que é igual ao do contrato |
| tenancy-guardian (2ª), test-engineer (2ª), revisor-geral (2ª) | A Autoconferência 3 ainda diz "duas alunas na mesma turma"; o seed do e2e tem agora uma segunda turma (8º A), com um aluno que a aprovada não pode ver | Só texto da tarefa: a frase da Autoconferência 3 foi corrigida antes do commit, sem rodada nova |
| test-engineer (2ª), revisor-geral (2ª) | Comentário do caso da planilha suja: "e o da linha com a turma boa não a acusa" não tem asserção direta, e o da planilha corrigida não cita o "8a" | Recusada: a conta "4 linhas lidas · 3 com erro" já prova a linha boa; mexer em comentário de teste só para isso caduca dois revisores |
| test-engineer (2ª) | O caso da tela "Eu" só falharia se a tela passasse a listar colegas; "a aluna não alcança dado de outra turma pela API" fica provado só nos testes de integração | Sem ação: é o que a correção da 1ª rodada pedia; fica registrado para a validação |
| privacy-guardian (2ª) | `lista.transferida` e `lista_nome.retirado` fora do arquivo do titular (pergunta de fechamento da regra 20) | Já no `TODO.md`; o privacy-guardian pede que se resolva antes do pouso da spec: o Validador e o Orquestrador devem lê-lo no pouso |
| privacy-guardian (2ª) | Guarda que recuse rodar a carga fora de `AMBIENTE` de carga (pasta 0777) | Já no `TODO.md` desde a 1ª rodada |
| privacy-guardian (2ª), conformidade-reviewer (2ª) | A linha "(medida da 16.0) Comando em grupo no `desativar` e no `vinculo.criado`" saiu da tabela "Recomendações sem aplicar" | Devolvida aqui: "Só se uma escola real precisar de mais de 100 desligamentos por gravar; a virada de 900 (sem marca) passou com folga" |
| frontend-reviewer (2ª), conformidade-reviewer (2ª) | As da 1ª rodada que seguem para a validação: foto do estado do teto, `aria-live` com `empty:hidden`, "Marcar os primeiros 100", vazio sem registro | Já no `TODO.md` e na tabela do documento |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-06 05:06:39 | 2026-11-06 05:06:57 | `infra-guardian` | 2 | APROVADO | aeddba69d2f57c1a7 |
| 2026-11-06 05:06:49 | 2026-11-06 05:07:16 | `frontend-reviewer` | 2 | APROVADO | ad5bb860d2b5ae63a |
| 2026-11-06 05:07:25 | 2026-11-06 05:07:49 | `tenancy-guardian` | 2 | APROVADO | a0ff075d217c84d42 |
| 2026-11-06 05:07:02 | 2026-11-06 05:07:54 | `test-engineer` | 2 | APROVADO | af53c664dc2fece93 |
| 2026-11-06 05:07:15 | 2026-11-06 05:07:55 | `revisor-geral` | 2 | APROVADO | a604e23189391a615 |
| 2026-11-06 05:07:36 | 2026-11-06 05:08:05 | `privacy-guardian` | 2 | APROVADO | a7de80b89074db599 |
| 2026-11-06 05:07:49 | 2026-11-06 05:08:25 | `conformidade-reviewer` | 2 | APROVADO | a8fe49f87082d71b0 |
