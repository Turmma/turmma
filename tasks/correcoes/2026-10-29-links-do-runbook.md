# Correção — o `runbook_url` dos 14 alertas e a guarda apontam para o repositório antigo (`LitzGab/Educa.ia`)

**Origem:** uso (pedido do Orquestrador, depois da mudança do repositório para a organização `Turmma`, `CLAUDE.md`, commit `f54ee5bd`); já anotado em `tasks/prd-reengenharia/diagnostico/U12.md` (U12-10).
**Subagentes obrigatórios:** `test-engineer`, `infra-guardian`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `revisor-geral`
<!-- `infra-guardian` veio no PEDIDO do Orquestrador. A correção leva 16 arquivos fora de `tasks/` (14 alertas, a guarda e o teste dela), mais
     de 5, e o passo 5 de `corrigir` torna o `revisor-geral` obrigatório. Os outros três guardiões (`tenancy-guardian`, `privacy-guardian`,
     `conformidade-reviewer`) vieram da DEVOLUÇÃO da Mesa: a pasta `tools/guardas/` os pede. -->

## Sintoma

O Grafana mostra, junto de cada um dos 14 alertas de `infra/grafana/alertas/`, um link para
`https://github.com/LitzGab/Educa.ia/blob/main/docs/runbook.md#<entrada>`. O repositório agora é
`https://github.com/Turmma/turmma` (`origin` já aponta para ele). Quem abre o alerta às 7h40 de uma segunda depende de um
redirecionamento do GitHub que não se deve contar como garantido, e do repositório `Educa.ia`, que já não é o nosso.
A guarda `tools/guardas/alerta-tem-runbook.ts` (`ENDERECO_DO_RUNBOOK`) exige o prefixo antigo, então hoje ela aprova o endereço velho
e reprovaria o novo.

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

`ENDERECO_DO_RUNBOOK` é uma constante com o endereço do repositório escrito por extenso, e os 14 arquivos de alerta repetem o
mesmo prefixo por extenso (o provisionamento do Grafana não aceita referência a constante). Quando o repositório mudou de dono e de nome
(`LitzGab/Educa.ia` → `LitzGab/Turmma.ai` → `Turmma/turmma`), nada ligava o endereço do repositório ao desses 15 lugares.
Os testes da guarda importam a própria constante, por isso passavam com qualquer endereço: nenhum teste fixava qual é o certo
nem provava que o antigo é reprovado.

## Teste que reproduz

`tools/guardas/alerta-tem-runbook.test.ts`:
- `o endereço do runbook é o do repositório atual, na organização Turmma`: vermelho antes (a constante tinha o endereço antigo).
- `reprova: runbook_url com o endereço antigo do repositório, mesmo com a entrada certa no runbook`: vermelho antes (a guarda aprovava
  o endereço antigo, pois ele era o esperado).

## Correção

Troca do prefixo `https://github.com/LitzGab/Educa.ia/blob/main/docs/runbook.md#` por
`https://github.com/Turmma/turmma/blob/main/docs/runbook.md#` em `ENDERECO_DO_RUNBOOK` (`tools/guardas/alerta-tem-runbook.ts`) e
no `runbook_url` dos 14 arquivos de `infra/grafana/alertas/` (a âncora de cada um ficou igual). Os dois testes novos fixam o endereço
atual por extenso e provam que a guarda reprova os dois antigos (`LitzGab/Educa.ia` e `LitzGab/Turmma.ai`), com a entrada certa no runbook.

### Busca do endereço antigo no resto do repositório

`grep -rIn LitzGab` (fora `node_modules` e `.git`) deixou, de propósito:
- `CLAUDE.md:12`: é a frase que diz que o repositório antigo `LitzGab/Turmma.ai` não recebe mais push.
- `tools/guardas/alerta-tem-runbook.test.ts`: os dois endereços antigos, que o teste novo usa para provar a reprovação.
- `docs/mvp-rapido.md:23`: link do PR #1, fato histórico de 05/10 que o GitHub redireciona; o documento registra o que aconteceu.
- `tools/processo/__fixtures__/esteira/run-view-jobs-cancelada-por-prazo.json` e `censo-do-e2e-fatia.json` (`Turmma.ai` no `rootDir`): amostras
  de saída real da esteira, usadas por teste; mexer nelas falsifica o dado.
- `tasks/prd-reengenharia/diagnostico/U10.md`, `U12.md`, `tasks/prd-identidade-e-tenancy/validacao.md`, `tasks/correcoes/2026-09-20-*.md` e
  `tasks/correcoes/achados/*`: registro de revisão e diagnóstico, que cita o endereço como estava na época (o U12-10 é este defeito).

## Mutações

```mutacao
arquivo: tools/guardas/alerta-tem-runbook.ts
teste: tools/guardas/alerta-tem-runbook.test.ts › o endereço do runbook é o do repositório atual, na organização Turmma
-export const ENDERECO_DO_RUNBOOK = 'https://github.com/Turmma/turmma/blob/main/docs/runbook.md#'
+export const ENDERECO_DO_RUNBOOK = 'https://github.com/LitzGab/Educa.ia/blob/main/docs/runbook.md#'
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (1ª), revisor-geral (1ª) | O ajudante `arquivoDeRegra` (`tools/guardas/alerta-tem-runbook.test.ts:14`) ainda gera `folder: Educa.ia alertas`. Não é link nem afeta a regra | X8 (nomes de mercado, renomeação técnica) |
| revisor-geral (1ª) | `tasks/prd-reengenharia/diagnostico/U12.md:110` fala em "13 regras" quando são 14; se o U12-10 for marcado como resolvido, anotar lá esta correção | quem fechar o U12-10 (Orquestrador ou Arquiteto); documento fora desta correção |
| infra-guardian (1ª) | A âncora com acento (`#login-recusado-pelo-semáforo-do-hash`, `#incidente-sem-confirmação-em-24-h`) depende do slug que o GitHub gera: abrir um dos links depois do push para a `main` do repositório novo | `TODO.md` (conferência pós-pouso); só dá para fazer depois de o runbook estar na `main` de `Turmma/turmma`. A linha ainda não está lá e o `TODO.md` não é arquivo desta correção: o Orquestrador a inclui no pouso, junto dos documentos que ele commita |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-10-29 20:08:02 | 2026-10-29 20:08:10 | `tenancy-guardian` | 1 | APROVADO | a3e6649d13fe8a259 |
| 2026-10-29 20:07:59 | 2026-10-29 20:08:17 | `infra-guardian` | 1 | APROVADO | a530258798bb91642 |
| 2026-10-29 20:08:04 | 2026-10-29 20:08:20 | `privacy-guardian` | 1 | APROVADO | a5bacba3547e36b60 |
| 2026-10-29 20:08:07 | 2026-10-29 20:08:21 | `conformidade-reviewer` | 1 | APROVADO | a280a54ade37bb81e |
| 2026-10-29 20:07:56 | 2026-10-29 20:08:27 | `test-engineer` | 1 | APROVADO | a23b5ac2378d6d666 |
| 2026-10-29 20:08:09 | 2026-10-29 20:08:29 | `revisor-geral` | 1 | APROVADO | a91b2ad2b8d94d61c |
| 2026-10-29 20:13:08 | 2026-10-29 20:13:28 | `test-engineer` | 2 | APROVADO | a9672058cd0d0fb68 |
| 2026-10-29 20:13:14 | 2026-10-29 20:13:30 | `revisor-geral` | 2 | APROVADO | a7792e7e082da423b |
