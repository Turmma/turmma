# Correção — `entrar-na-escola.spec.ts:94` passa de dois terços do prazo no censo, no celular

**Origem:** esteira run 43989706048 em `37edd16`, `node tools/processo/esteira.ts --censo` (o censo do e2e do fechamento da X6).
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- O PEDIDO do Orquestrador ditou `test-engineer` e `revisor-geral`. A correção toca só `e2e/`, e `tools/processo/guardioes-por-caminho.ts` pede os quatro guardiões para esse caminho (OS_QUATRO): a Mesa os acrescentou na devolução da rodada 1, e o portão confirma seis obrigatórios. -->

## Sintoma

O censo aponta um caso, em arquivo que a spec alterou na 14.0:

| Caso | Projeto celular | Projeto chromebook | Prazo |
|---|---|---|---|
| `e2e/entrar-na-escola.spec.ts:94` "escola sem provedor liberado não mostra botão de conta nenhuma…" | 20,2 s | 5,6 s | 30 s |

O limite do censo é 20 s (dois terços de 30 s).

## Fora desta correção

Nada: o pedido veio sem arquivos da tarefa em curso, e a árvore estava limpa.

## Causa

O caso não é longo: cria um aluno, abre `/e/<slug>` e afirma três coisas sobre o que a tela mostra (o campo da matrícula, nenhum botão "Entrar com a conta", nenhum aviso da TI). No `chromebook` leva 5,6 s, e o caso vizinho de endereço inexistente leva 6,8 s no próprio `celular`.

Os 20,2 s são a primeira carga que travou. O log da execução traz, no mesmo job (`e2e 8/11`), a linha
`##[warning]e2e/entrar-na-escola.spec.ts:94 (celular) /e/e2e-…: sem load em 15000 ms; uma nova tentativa`
(`gotoComNovaTentativa`, `e2e/support/profiles.ts`): o `page.goto` esperou os 15 s do `PRAZO_DA_NAVEGACAO_MS`, passou por `about:blank` e carregou de novo em uns 5 s. A trava rara do `goto` sob a rede emulada, que a correção `2026-10-29-primeira-carga-do-e2e` descreve e não consegue reproduzir, caiu aqui, e 15 s de espera mais a nova carga passaram dos 20 s do censo.

O caso paga essa exposição à toa: o assunto dele é o que a tela mostra, não quanto ela leva para baixar na rede móvel lenta do perfil (1 Mbps, 600 ms), e a rede do perfil custa de 3 a 3,5 s fixos por primeira carga e é onde a trava aparece. Os outros casos da entrada (`:65`, `:106`) afirmam o alvo de toque e a carga sob o perfil; este não.

## Teste que reproduz

Não há vermelho determinístico: a trava não se reproduz (0 em 1.200 cargas na correção de 29/10) e o caso passa, só passa tarde quando ela cai. A evidência que substitui o vermelho é a duração medida antes e depois, no `celular` e no `chromebook`, e a estabilidade do caso repetido (abaixo, em "Correção").

## Correção

Só `e2e/entrar-na-escola.spec.ts`: a primeira carga do caso (`page.goto` e a espera do campo da matrícula) passa a rodar em `loadUnthrottled` (`e2e/support/profiles.ts`), a receita das correções `2026-10-26-areas-entrar-estoura-o-prazo` e `2026-11-10-censo-e2e-convite-mfa`: tira só a rede do perfil dessa carga, a CPU do perfil continua e a rede volta ao fim. Isso **diminui a chance** da trava do `goto`, sem eliminá-la: `gotoComNovaTentativa` continua ativo dentro de `loadUnthrottled`, e se a trava cair também sem a rede do perfil, a anotação `primeira-carga-travou` e o `::warning` da esteira ainda saem. **Nenhuma asserção foi tirada nem mudou**: as três afirmações do caso seguem iguais, na mesma ordem, e a espera do campo da matrícula agora está dentro da função, com o mesmo `timeout`.

O que isto não mede, dito por inteiro: quanto a tela de entrada da escola leva para baixar na rede lenta. Isso é do orçamento do build (`tools/ci/tamanho-web.test.ts`) e dos casos `:65` e `:106` do mesmo arquivo, que carregam a mesma tela sob a rede do perfil.

**Medição** (o spec inteiro isolado, `node tools/ci/e2e.ts --manter-ambiente e2e/entrar-na-escola.spec.ts`, 6 trabalhadores; e o caso repetido, com o ambiente de pé):

| Caso | Antes (chromebook / celular) | Depois (chromebook / celular) |
|---|---|---|
| `entrar-na-escola.spec.ts:94`, o spec inteiro isolado, 6 trabalhadores (a medida **comparável** com a do censo) | 5,6 / 20,2 s (esteira) | 2,1 / 1,9 s |
| o mesmo caso, `--repeat-each 10 --workers 2` (20 execuções): **só prova de estabilidade**, não entra na comparação | — | 20 de 20 verdes, de 0,74 a 1,2 s |

Os números "depois" são da máquina local; o fechamento da X6 cita a execução da esteira que os confirmar.

Os outros 12 casos do arquivo passaram (26 de 26) e não mudaram de tempo: ficam onde estavam no censo, abaixo dos 20 s (o maior, `:218`, 17,8 s no chromebook e 17,7 s no celular; a esteira leu 18,8 e 17,5 s).

As linhas dos casos depois do `:94` deslizaram 2 (`:146` → `:148`, e assim por diante). Nenhum documento vivo as cita: as citações que restam (`validacao.md` da identidade-e-tenancy, `achados/`) já eram de linhas antigas.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| revisor-geral (1ª) | `e2e/entrar-na-escola.spec.ts:102`: esperar um sinal de que a configuração de entrada da escola chegou antes de afirmar o `toHaveCount(0)` do link "Entrar com a conta" | Recusada: `apps/web/src/pages/EntrarNaEscola.tsx:53-54` desenha `FormularioDaMatricula` e `ContasDaEscola` no mesmo `acesso.data`, então com o campo da matrícula visível a lista de provedores já está na tela; o `test-engineer` (1ª) conferiu o mesmo trecho e o caso `:218` é a contraprova (provedor liberado, botão aparece). Mudar a asserção também mudaria o que o caso afirma |
| infra-guardian (1ª) | O `:218` está em 17,8 s, perto dos 20 s do censo; decidir se a nova tentativa do `gotoComNovaTentativa` deve contar menos no censo, em vez de tratar caso a caso | Retro da X6: é decisão sobre o critério do censo (`tools/processo/esteira.ts --censo`), fora desta correção, que só toca o caso `:94` |
| test-engineer (1ª) | Os números "depois" são da máquina local; citar no fechamento a execução da esteira que confirmar | Fechamento da X6: o Orquestrador cita o próximo `esteira.ts --censo` verde que confirme o caso fora da lista |

## Mutações

--faltando: 0 linhas (0 blocos, 0 motivos)

**Sem mutação:** a correção só mexe em `e2e/` e na duração do caso; nenhuma cláusula de código de produção entra, e as asserções do caso ficam as mesmas.

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-16 22:41:26 | 2026-11-16 22:41:35 | `tenancy-guardian` | 1 | APROVADO | acf136e45bb443c6f |
| 2026-11-16 22:41:28 | 2026-11-16 22:41:40 | `conformidade-reviewer` | 1 | APROVADO | ab94c10ecf2be123a |
| 2026-11-16 22:41:27 | 2026-11-16 22:41:41 | `privacy-guardian` | 1 | APROVADO | aa2621a2c376a89b1 |
| 2026-11-16 22:41:25 | 2026-11-16 22:41:41 | `revisor-geral` | 1 | APROVADO | a17152e9d108a3709 |
| 2026-11-16 22:41:29 | 2026-11-16 22:41:43 | `infra-guardian` | 1 | APROVADO | a839bc30bc34d7ee3 |
| 2026-11-16 22:41:24 | 2026-11-16 22:42:00 | `test-engineer` | 1 | APROVADO | a51e4396bd0f0f3a4 |
