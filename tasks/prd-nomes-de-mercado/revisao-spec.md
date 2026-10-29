# Revisão de spec — nomes-de-mercado

**Subagentes obrigatórios:** `test-engineer`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `revisor-geral`, `llm-integrator`

O `frontend-reviewer` fica fora: nenhuma tela muda, e o `conferir` compara o texto de tela, a classe de CSS e o `data-testid` (Tech Spec §5 e §9).

## Rodada 1 — 29/10/2026

**Veredito: REPROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `tenancy-guardian` | REPROVADO | 2: `regras-tenant.mjs` lê o pacote `@educa/nucleo` (e não `Banco`), e `index.mjs` lê `packages/nucleo/src/db/**`; `escopo-dos-repositories.ts` lê seis nomes (`TIPOS_DO_BANCO`, `PROVAS_DE_ESCOPO`, `SemEscopo`), e a troca parcial cala por método |
| `privacy-guardian` | REPROVADO | 3: a guarda de erro tipado (`NOME_DA_CLASSE_DE_INVARIANTE`, `ESCOPO_DO_ERRO_TIPADO`) fora da §7; `contratos.test.ts` escolhe os schemas pelo prefixo `esquemaResposta` e passaria a varrer uma lista vazia; o `this.name` dos erros sem decisão (`erro.int.test.ts:166`) |
| `conformidade-reviewer` | REPROVADO | 2: as travas da regra 70 que citam nome ou caminho dentro de string ou regex em `.ts` (`porta-unica.test.ts`, `Mensagem.test.tsx`, `avatar-so-nas-duas-pecas.test.ts`, `entrega`, `correcao`, `assistente`) não têm caminho; o passo 5 tocaria `docs/aia/ouro/` e quebraria o selo |
| `infra-guardian` | REPROVADO | 2: `infra/scripts/carga-login.ts`, `carga-sala.ts` e `ensaio-alertas.ts` importam o `dist` por caminho em texto e leem a função por chave, e quebram calados; `ops/migrar.ts` renomeado muda o `command` do compose de produção, ao contrário da §7c |
| `test-engineer` | REPROVADO | 6: travas faltando na §6 e §7; referência por texto dentro de TypeScript sem caminho; `this.name`; o RF3 sem prova (falta o comando de restos); o `conferir` sem especificador comparado, regex e chave de objeto; a guarda testada só em três tipos de declaração |
| `revisor-geral` | REPROVADO | 7: a troca por palavra inteira em comentário e documento estraga a prosa (`com`, `Banco`, `Tela`, `Contador`, `Despachante`), e §2 contradiz §5; a guarda reprova nomes que ficam (`DialogoDeAlocacao`, `CartaoDoAgente`, `ErroDaOperacao`) e pega `tools/`; nada prende o diff da linha aos "Arquivos previstos"; o compose muda (`migrar.ts`); `this.name`; a reaplicação depois do merge é recusada pelo próprio mapa; o PRD com 2.007 palavras |
| `llm-integrator` (sem veto) | AJUSTES NECESSÁRIOS | 1: `adaptador.ts` → `model-adapter.ts` casa com o glob `*-adapter.ts` e isentaria da regra 30 o arquivo da interface |

### Correções exigidas na Tech Spec

- §2 e §5: **referência por texto em qualquer arquivo, também dentro de string, template e regex de TypeScript.** O `aplicar` lista cada ocorrência de cada `de` (símbolo, trecho de caminho, pacote), e o mapa classifica cada uma como `fica` (string de fora) ou `trava` (atualizada à mão, com a prova vermelha). Ocorrência sem classificação deixa o relatório vermelho (test-engineer B2, conformidade B1, privacy B2)
- Novo anexo `travas.md`: cada trava, o que lê pelo nome, a onda e a prova vermelha com o nome novo, com tudo o que os revisores apontaram (tenancy B1 e B2, privacy B1 a B3, conformidade B1, infra B1, test-engineer B1, llm B1)
- §5: comentário e documento só trocam sozinhos o identificador composto ou entre crases; a palavra comum vai para a mão; §2 deixa de contradizer o §5 (revisor-geral 1)
- §5: o `conferir` compara o especificador de módulo depois do mapa, os literais de regex, as chaves de objeto e os nomes exportados, e conta também os casos de `tools/guardas` e `tools/processo` (test-engineer B5)
- §5 e §10: o comando `restos`, que busca cada `de` de todos os mapas no código e nos documentos vivos (test-engineer B4)
- §5: o `aplicar` recebe o escopo de caminhos da tarefa e recusa edição fora dele (revisor-geral 3)
- §5 e §13: o merge da `develop` que traz nome antigo vira correção, com o modo `--reaplicar`, que só pega a ocorrência nova (revisor-geral 6)
- §5 e §7: o `this.name` acompanha a classe, como exceção de grupo do `conferir`, e o `tipo` do log muda; nenhum alerta o lê (privacy B3, test-engineer B3, revisor-geral 5)
- §7c: os arquivos de `apps/api/src/ops/` ficam com o nome, e o compose de produção não muda (infra B2, revisor-geral 4). Toca o inventário aprovado: parada do Joaquim
- §5: a guarda vale só em `apps/`, `packages/` e `e2e/`, com a lista em `tools/guardas/nomes-de-mercado.mjs`, os nomes do kit como nome exato, cada prefixo com os tipos de declaração em que vale, e entra em `REGRAS_DAS_GUARDAS` (revisor-geral 2, test-engineer B6)
- §5: o passo 5 deixa de fora `docs/aia/ouro/` e `docs/aia/ouro-retido/`; as citações de lá vão por correção do Arquiteto depois da 4.0, com o selo regravado (conformidade B2)
- `inventario-core-shared.md`: `adaptador.ts` → `adapter.ts`, e `AdaptadorDeIa` → `LLMAdapterKind`; a Tech Spec dá o valor novo de `PASTA_DOS_ADAPTADORES` (llm B1)
- `prd.md`: abaixo de 2.000 palavras; o RF7 diz "salvo o nome ou caminho renomeado que a trava cita, declarado no mapa", o que toca critério de aceite: parada do Joaquim (revisor-geral 7, test-engineer B3)

### Recomendações

- Uma trava contra filtro vazio: todo glob e caminho das configurações de guarda casa com ao menos um arquivo (privacy)
- Os tipos literais dos três scripts de `infra/scripts/` passam a sair de `typeof import(<fonte>)`, e o typecheck pega o nome que ficou para trás (infra)
- O gerador de migration roda na 3.0 e na 4.0, e o `_journal` não muda; a base é verde antes da 1.0 (test-engineer, revisor-geral)
- O `paths:` das regras passa a `packages/core/**`, provado pelo teste do harness da X7 (infra)
- A régua de duração do e2e cobra casos que só foram renomeados: declarado na §13 (test-engineer)
- Alias de propósito como campo do mapa; o relatório do `aplicar` num arquivo por onda; o motivo de não usar ts-morph nem `naming-convention` (revisor-geral)
- Na guarda, casos de domínio da regra 70 que passam (`CorrecaoService`, `ValidacaoDoLote`) (conformidade)

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-29 21:33:07 | 2026-10-29 21:35:31 | `llm-integrator` | 1 | AJUSTES NECESSÁRIOS | afec0cef71b2bf7f2 |
| 2026-10-29 21:32:49 | 2026-10-29 21:35:54 | `tenancy-guardian` | 1 | REPROVADO | a7c24f756090cbdc7 |
| 2026-10-29 21:32:59 | 2026-10-29 21:36:29 | `infra-guardian` | 1 | REPROVADO | a89955fd478d59aa7 |
| 2026-10-29 21:32:52 | 2026-10-29 21:36:37 | `privacy-guardian` | 1 | REPROVADO | a16bb3ef8ee94aebc |
| 2026-10-29 21:32:55 | 2026-10-29 21:37:42 | `conformidade-reviewer` | 1 | REPROVADO | a49666c913785f46c |
| 2026-10-29 21:32:45 | 2026-10-29 21:38:48 | `test-engineer` | 1 | REPROVADO | aa4219059e5bde119 |
| 2026-10-29 21:33:03 | 2026-10-29 21:38:56 | `revisor-geral` | 1 | REPROVADO | a1589db3cbc602630 |
