# Correção — as duas rotas de orçamento de IA do painel da operação faltam na lista conferida do teste de "ninguém cria rede nem escola"

**Origem:** esteira run 44903191816 (integração 3/3, branch `spec/camada-ia` em `0e85765`): `apps/api/test/ops-escola.int.test.ts › lista as rotas registradas no Nest e nenhuma de escrita fala de rede ou escola, fora da lista conferida` ficou vermelho.
**Subagentes obrigatórios:** `tenancy-guardian`, `test-engineer`, `revisor-geral`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- Os três primeiros vieram no PEDIDO do Orquestrador; os outros três vêm do caminho: todo arquivo de `apps/`, testes inclusive, pede os quatro guardiões (`tools/processo/guardioes-por-caminho.ts`), e a Mesa os conferiu (`portao-local.ts revisores` lista seis). -->

## Sintoma

O teste lista as rotas registradas no Nest e exige que nenhuma de escrita com `rede(s)` ou `escola(s)` num segmento fixo esteja fora de `ROTAS_PERMITIDAS`. A esteira o pegou vermelho com
`PUT /v1/operacao/escolas/:id/orcamento-ia` e `PUT /v1/operacao/redes/:id/orcamento-ia` (`apps/api/src/operacao/painel/painel.controller.ts`, `definirOrcamentoDaEscola` e `definirOrcamentoDaRede`, da tarefa 3.0 da camada-ia).
Até a correção `2026-11-21-integracao-no-teto-da-esteira`, a integração estourava o teto de 30 min antes de chegar neste arquivo, e a falha ficava escondida.

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

**A tarefa 3.0 criou duas rotas de escrita com `escolas` e `redes` no caminho e não as declarou na lista conferida do teste** (`ROTAS_PERMITIDAS`), que é a "lista fechada" do passo 4 de `executar-task`; o arquivo do teste não era alvo do portão, e a esteira só o rodou quando a integração passou a caber no teto.
Conferido no código que as duas **não criam rede nem escola**:

- `PUT /v1/operacao/escolas/:id/orcamento-ia`: `PainelService.definirOrcamentoDaEscola` trava e grava a linha de `configuracao_operacional_escola` da escola do caminho (`OrcamentoDoMesRepository.lockConfiguracaoDaEscola`/`saveConfiguracaoDaEscola`); o único `insert … onConflictDoNothing` é dessa linha de configuração, nunca de `escola`. Escola inexistente é a chave estrangeira recusada (`23503`) e vira `NAO_ENCONTRADO`.
- `PUT /v1/operacao/redes/:id/orcamento-ia`: `OrcamentoDaRedeRepository.definir` faz `select … for update` e `update` de `rede` pelo `id` do caminho, sem `insert`; rede inexistente é `NAO_ENCONTRADO`.

As duas são `@OperacaoRoute()`: só a sessão de operador Turmma as alcança.

## Teste que reproduz

`apps/api/test/ops-escola.int.test.ts › lista as rotas registradas no Nest e nenhuma de escrita fala de rede ou escola, fora da lista conferida`: vermelho no HEAD, com as duas rotas na lista de achadas; verde com a correção.
O filtro `criaRedeOuEscola` não muda, e o caso do filtro ganha duas asserções: as duas rotas passam só com o método conferido (`PUT`), e `POST` na mesma rota continua pega.

## Correção

`ROTAS_PERMITIDAS` ganha as duas entradas, e o comentário acima dela ganha as duas linhas de justificativa, como as outras. O filtro e o teste que enumera as rotas ficam como estão.

## Mutações

--faltando: 0 linhas (0 blocos, 0 motivos)

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-21 10:23:52 | 2026-11-21 10:24:08 | `infra-guardian` | 1 | APROVADO | ad75ce58a2082a4d8 |
| 2026-11-21 10:23:51 | 2026-11-21 10:24:10 | `conformidade-reviewer` | 1 | APROVADO | aa119f75d885f3699 |
| 2026-11-21 10:23:47 | 2026-11-21 10:24:14 | `tenancy-guardian` | 1 | APROVADO | a52dbc5719a9eb189 |
| 2026-11-21 10:23:49 | 2026-11-21 10:24:15 | `revisor-geral` | 1 | APROVADO | aa2e6179e55365a84 |
| 2026-11-21 10:23:50 | 2026-11-21 10:24:16 | `privacy-guardian` | 1 | APROVADO | aa9a94299b3126fe4 |
| 2026-11-21 10:23:48 | 2026-11-21 10:24:45 | `test-engineer` | 1 | APROVADO | a05e59cf248714e1c |

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian (1ª) | "vale registrar na retro que rota nova com `escolas` ou `redes` no caminho precisa atualizar `ROTAS_PERMITIDAS` na mesma tarefa. Assim o portão local pega isso antes da esteira." | Retro da camada-ia: é mudança de processo, fora do arquivo e do escopo desta correção |
| test-engineer (1ª) | "estudar um caminho para o portão da tarefa rodar esse teste sempre que o diff tocar `@Post`, `@Put`, `@Patch` ou `@Delete` em controller" (`ops-escola.int.test.ts` não estava no diff da 3.0) | Retro da camada-ia: muda `tools/processo/` e o portão, não cabe em correção só de teste |
| 2026-11-21 11:25:53 | 2026-11-21 11:26:09 | `revisor-geral` | 2 | APROVADO | a7ebe3d728f655807 |
| 2026-11-21 11:25:50 | 2026-11-21 11:26:17 | `test-engineer` | 2 | APROVADO | a8a3077983679495a |
