# Correção — a integração rodada à mão não recusa os workers de pé no compose de teste

**Origem:** retro da F4 (`tasks/prd-ingestao-do-material/retro.md`, M3, aceita em 15/11/2026, e repetida pela retro da X6, item P); `TODO.md`, "(F4, retro, M3)".
**Subagentes obrigatórios:** `infra-guardian`, `revisor-geral`, `test-engineer`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`
<!-- O PEDIDO do Orquestrador ditou `infra-guardian`, `revisor-geral` e `test-engineer`; a Mesa conferiu a linha contra os arquivos
     alterados: `tools/testes/**` pede os quatro guardiões (`guardioes-por-caminho.ts`, padrão), e o portão
     (`portao-local.ts revisores`) cobra também `tenancy-guardian`, `privacy-guardian` e `conformidade-reviewer`.
     `revisor-geral` também por tocar `tools/processo/` (um `export`). -->

## Sintoma

A integração rodada à mão (`npx vitest run --project integracao …`) com despachante ou worker do compose de teste de pé (o
`tools/ci/e2e.ts --manter-ambiente` e a vitrine os deixam assim) dá vermelho falso nos testes que enfileiram job: o worker de pé
consome o job, e o teste não vê o efeito. Na F4 foram três vermelhos falsos: a correção `esteira-vermelha-b942d26`, a correção
`reenvio-fora-do-alcance` ("workers de pé disputavam a extração") e o menor 5 da r2 da validação. O portão local já os para antes
(`sequencia-do-portao.ts`); quem roda à mão não tinha nada que avisasse.

## Fora desta correção

Nada: o pedido não trouxe arquivos de tarefa em curso, e a árvore estava limpa.

## Causa

O `globalSetup` da integração (`tools/testes/integracao.setup.ts`) sobe só a infra (`up --detach --wait` dos serviços de dados e
do `oidc-falso`) e é idempotente: não olha o que mais está de pé no projeto. O `stop` dos workers só existia na sequência do portão.

## Teste que reproduz

`tools/testes/workers-de-pe.test.ts` (a regra: quem está de pé, a mensagem, o `stop`, o `ps` que falha) e
`tools/testes/integracao.setup.test.ts` (a fiação: a integração recusa, o infra não, nada é derrubado), os dois contra um Docker falso
na fronteira (regra 40). Sem a correção os dois arquivos não carregam (`workers-de-pe.ts` não existia). Prova de ponta a ponta, na
máquina, com os nove despachantes e workers do `educa-teste-1` de pé: `npx vitest run --project integracao
apps/api/test/acesso-da-escola.int.test.ts` sai antes de qualquer teste com a lista dos nove e o `docker compose … stop …` que
os para; os nove seguiram de pé depois.

## Correção

- `tools/testes/workers-de-pe.ts` (novo): `jobsDePe` (dos serviços de pé, os de `servicosDeJob`), `mensagemDosJobsDePe` e
  `recusarJobDePe`, que chama um `ps` injetado e lança com a mensagem. O comando de parar é o `derrubarJob` da sequência do portão,
  o mesmo `stop`, e não uma cópia.
- `tools/testes/integracao.setup.ts`: depois da subida (com `EDUCA_BANCO_NOVO=1` o `down --volumes` já os levou), antes da
  migration, confere com `docker compose ps --status running --services`. **Só no projeto `integracao`**: o `infra` roda depois do
  e2e, que deixa o ambiente completo de pé (`--manter-ambiente`), e recusaria o portão da tarefa que altera `infra/`. O Vitest 5
  entrega o projeto ao `globalSetup` (`project.name`, conferido num projeto de brinquedo); sem ele, recusa (o lado que não deixa
  passar). `ps` que nem rodou (status nulo) é falha, e não "nada de pé".
- `jobsDePe` apara cada linha do `ps` (`\r\n` ou espaço sobrando não deixam um worker de pé passar), e o erro do `ps` que falhou leva o
  `stderr` dele (daemon fora, permissão); `ResultadoDoPs` é um tipo só, importado pelo setup.
- `tools/processo/sequencia-do-portao.ts`: `derrubarJob` passa a ser exportada, e o comentário de `mutacaoDeIntegracao` diz o motivo
  de hoje do `stop` antes das mutações (a integração recusaria).
- O teste da fiação fixa `EDUCA_BANCO_NOVO` (o `npm run test` do portão o roda com `1`), prova que o `down` vem antes do `ps` e
  que nada é derrubado depois dele; o caso "só o `ps` é chamado" saiu de `workers-de-pe.test.ts`, que nenhuma mutação derrubava.
- Não derruba sozinha, como a retro pediu: o ambiente de pé pode ser a vitrine ou o e2e de alguém.

## Mutações

--faltando: 0 linhas (12 blocos, 0 motivos)

```mutacao
arquivo: tools/testes/workers-de-pe.ts
teste: tools/testes/workers-de-pe.test.ts › não confunde serviço de nome parecido
falha: toEqual([])
   const dePe = new Set(saidaDoPs.split('\n').map((linha) => linha.trim()))
-  return servicosDeJob.filter((servico) => dePe.has(servico))
+  return servicosDeJob.filter((servico) => saidaDoPs.includes(servico))
```

```mutacao
arquivo: tools/testes/workers-de-pe.ts
teste: tools/testes/workers-de-pe.test.ts › guarda só os serviços de job
   const dePe = new Set(saidaDoPs.split('\n').map((linha) => linha.trim()))
-  return servicosDeJob.filter((servico) => dePe.has(servico))
+  return [...servicosDeJob]
```

```mutacao
arquivo: tools/testes/workers-de-pe.ts
teste: tools/testes/workers-de-pe.test.ts › não toma o `ps` que falhou
   const resultado = ps()
-  if (resultado.codigo !== 0) {
-    throw new Error(`Não foi possível listar os serviços de pé no compose de teste: \`docker compose ps\` falhou.\n${resultado.erro.trim()}`)
-  }
   const dePe = jobsDePe(resultado.saida, servicosDeJob)
```

```mutacao
arquivo: tools/testes/workers-de-pe.ts
teste: tools/testes/workers-de-pe.test.ts › recusa, nomeia quem está de pé
-  if (dePe.length > 0) throw new Error(mensagemDosJobsDePe(dePe, derrubarJob(docker, servicosDeJob)))
+  if (dePe.length < 0) throw new Error(mensagemDosJobsDePe(dePe, derrubarJob(docker, servicosDeJob)))
```

```mutacao
arquivo: tools/testes/workers-de-pe.ts
teste: tools/testes/workers-de-pe.test.ts › recusa, nomeia quem está de pé
-    `Há despachante ou worker de pé no compose de teste: ${dePe.join(', ')}.`,
+    `Há despachante ou worker de pé no compose de teste: ${dePe.length}.`,
```

```mutacao
arquivo: tools/testes/workers-de-pe.ts
teste: tools/testes/workers-de-pe.test.ts › recusa, nomeia quem está de pé
-  if (dePe.length > 0) throw new Error(mensagemDosJobsDePe(dePe, derrubarJob(docker, servicosDeJob)))
+  if (dePe.length > 0) throw new Error(mensagemDosJobsDePe(dePe, docker.join(' ')))
```

```mutacao
arquivo: tools/testes/integracao.setup.ts
teste: tools/testes/integracao.setup.test.ts › no infra convive com os workers
-  if (projeto?.name !== NOME_DO_PROJETO_DA_INFRA) recusarJobDePe({ ps: listarServicosDePe, servicosDeJob: servicosDeJob(), docker: ['docker', ...ARGUMENTOS_COMPOSE] })
+  recusarJobDePe({ ps: listarServicosDePe, servicosDeJob: servicosDeJob(), docker: ['docker', ...ARGUMENTOS_COMPOSE] })
```

```mutacao
arquivo: tools/testes/integracao.setup.ts
teste: tools/testes/integracao.setup.test.ts › na integração recusa com worker de pé
-  if (projeto?.name !== NOME_DO_PROJETO_DA_INFRA) recusarJobDePe({ ps: listarServicosDePe, servicosDeJob: servicosDeJob(), docker: ['docker', ...ARGUMENTOS_COMPOSE] })
+  if (projeto?.name === NOME_DO_PROJETO_DA_INFRA) recusarJobDePe({ ps: listarServicosDePe, servicosDeJob: servicosDeJob(), docker: ['docker', ...ARGUMENTOS_COMPOSE] })
```

```mutacao
arquivo: tools/testes/integracao.setup.ts
teste: tools/testes/integracao.setup.test.ts › sem o projeto no argumento recusa do mesmo jeito
-  if (projeto?.name !== NOME_DO_PROJETO_DA_INFRA) recusarJobDePe({ ps: listarServicosDePe, servicosDeJob: servicosDeJob(), docker: ['docker', ...ARGUMENTOS_COMPOSE] })
+  if (projeto !== undefined && projeto.name !== NOME_DO_PROJETO_DA_INFRA) recusarJobDePe({ ps: listarServicosDePe, servicosDeJob: servicosDeJob(), docker: ['docker', ...ARGUMENTOS_COMPOSE] })
```

```mutacao
arquivo: tools/testes/integracao.setup.ts
teste: tools/testes/integracao.setup.test.ts › o `ps` que o sinal matou
-  return { codigo: resultado.status ?? 1, saida: resultado.stdout, erro: resultado.stderr ?? '' }
+  return { codigo: resultado.status ?? 0, saida: resultado.stdout, erro: resultado.stderr ?? '' }
```

```mutacao
arquivo: tools/testes/integracao.setup.ts
teste: tools/testes/integracao.setup.test.ts › o Docker ausente
-  return { codigo: resultado.status ?? 1, saida: resultado.stdout, erro: resultado.stderr ?? '' }
+  return { codigo: resultado.status ?? 1, saida: resultado.stdout, erro: resultado.stderr }
```

```mutacao
arquivo: tools/testes/workers-de-pe.ts
teste: tools/testes/workers-de-pe.test.ts › acha o worker mesmo com fim de linha do Windows
-  const dePe = new Set(saidaDoPs.split('\n').map((linha) => linha.trim()))
+  const dePe = new Set(saidaDoPs.split('\n'))
```

A linha de `sequencia-do-portao.ts` só ganha `export`: não há cláusula nova a mutar.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (1ª) | Marcar o item "(F4, retro, M3)" do `TODO.md` (linha 2878), que segue `[ ]` | Fechamento da correção, quando ela pousar: não é edição de código desta rodada |
| test-engineer (1ª) | Teste do `project.name` que o Vitest 5 entrega ao `globalSetup`: se a assinatura mudar, o `infra` passaria a recusar depois do e2e | `TODO.md`: o lado que recusa é o seguro para a integração, e um teste da assinatura do Vitest é trabalho próprio, fora desta correção |
| infra-guardian (2ª) | `workers-de-pe.ts:44`: com o `stderr` vazio, a mensagem do `ps` que falhou termina com uma quebra de linha sobrando; acrescentar a linha do motivo só quando `resultado.erro.trim()` não for vazio | Recusada: é detalhe de texto; a mensagem só aparece no terminal de quem rodou a integração e não muda comportamento nem contrato |
| revisor-geral (2ª) | O caso "o Docker ausente" (`integracao.setup.test.ts:83`) simula um Docker que some entre o `up` e o `ps`; sem Docker o `up` falha antes (`integracao.setup.ts:33`). Ajustar o nome do teste ou o comentário de `integracao.setup.ts:17` | `TODO.md`, numa linha só com as outras quatro de `tools/testes/` abaixo |
| revisor-geral (2ª) | O mesmo caso usa `stdout: null`, que contradiz `saida: string` de `ResultadoDoPs`; um `?? ''` em `saida`, como já há em `erro`, deixaria o contrato coerente | `TODO.md`, na mesma linha |
| test-engineer (2ª) | Falta bloco de mutação para o `${resultado.erro.trim()}` na mensagem do `ps` que falhou (`workers-de-pe.ts:44`), provado hoje por `workers-de-pe.test.ts` | `TODO.md`, na mesma linha: não é cláusula nova, e o teste existe |
| test-engineer (2ª) | Falta bloco que mova a recusa para antes do laço da subida (`integracao.setup.ts:31-37`), para provar o caso "o `down` vem antes do `ps`" (`integracao.setup.test.ts:46`) | `TODO.md`, na mesma linha |
| test-engineer (2ª) | O caso "o Docker ausente" (`integracao.setup.test.ts:83-89`) poderia afirmar também que `migrate` não é chamado, como o caso do sinal | `TODO.md`, na mesma linha |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-17 10:11:41 | 2026-11-17 10:11:52 | `tenancy-guardian` | 1 | APROVADO | a27608c32f50b6179 |
| 2026-11-17 10:11:43 | 2026-11-17 10:11:54 | `conformidade-reviewer` | 1 | APROVADO | a431945670ace057b |
| 2026-11-17 10:11:42 | 2026-11-17 10:11:56 | `privacy-guardian` | 1 | APROVADO | ac33a3099dd529a77 |
| 2026-11-17 10:11:37 | 2026-11-17 10:12:18 | `infra-guardian` | 1 | APROVADO | adff12527c7ac311f |
| 2026-11-17 10:11:38 | 2026-11-17 10:12:45 | `revisor-geral` | 1 | APROVADO | ad2bdb9f73e896fb3 |
| 2026-11-17 10:11:39 | 2026-11-17 10:13:04 | `test-engineer` | 1 | REPROVADO | a6d0976b70ef0d793 |
| 2026-11-17 10:29:24 | 2026-11-17 10:29:29 | `tenancy-guardian` | 2 | APROVADO | a56791e46cdad89b4 |
| 2026-11-17 10:29:21 | 2026-11-17 10:29:34 | `infra-guardian` | 2 | APROVADO | a1f375d673c24a6f0 |
| 2026-11-17 10:29:17 | 2026-11-17 10:29:41 | `revisor-geral` | 2 | APROVADO | a29dda07cb1df1519 |
| 2026-11-17 10:29:32 | 2026-11-17 10:29:43 | `conformidade-reviewer` | 2 | APROVADO | a0e5876613124976e |
| 2026-11-17 10:29:28 | 2026-11-17 10:29:44 | `privacy-guardian` | 2 | APROVADO | acd62b19c20f1be14 |
| 2026-11-17 10:29:12 | 2026-11-17 10:29:47 | `test-engineer` | 2 | APROVADO | af556d4eaeb9afc04 |
