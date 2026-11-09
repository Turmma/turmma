# Correção — o caso "byte alterado" do cookie `educa_conta_provada` troca um caractere, não um byte, e passa um em cada 16 cookies

**Origem:** esteira run 42637397315 em `87186c1` (`gh run view 42637397315 --log-failed`), job `verificar`, passo de unidade: `apps/api/src/sessao/external/cookie-oidc.test.ts` › `cookie educa_conta_provada da conta da escola que o aluno provou na sala (14.0)` › `byte alterado, outra chave, valor ausente, vazio ou sem sentido não valem` — `AssertionError: byte 366: expected { …(5) } to be undefined`.
**Subagentes obrigatórios:** `privacy-guardian`, `test-engineer`, `revisor-geral`
<!-- O PEDIDO do Orquestrador ditou: privacy-guardian, test-engineer, revisor-geral. -->

## Sintoma

Na esteira, o caso falhou na posição 366, a última, de um valor de 367 caracteres: o cookie com o caractere trocado foi lido
como válido. Na máquina o mesmo caso passa quase sempre. É intermitente porque o valor do cookie muda a cada execução (o IV
da cifra é aleatório).

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

Falha da tarefa 14.0 (`c261e2f2`), **no teste, não no cookie**. O caso troca um **caractere** do base64url (`A` ↔ outro) e
espera que o cookie deixe de valer. O valor tem 367 caracteres = 2202 bits = 275 bytes e **2 bits de sobra**: o último
caractere carrega só 4 bits de dado, e os 2 de baixo são enchimento, que o decodificador do Node ignora. O codificador
grava o enchimento sempre zerado, então o último caractere é sempre um de `A E I M Q U Y c g k o s w 0 4 8`; quando é `A` (1
em 16), a troca por `B` só muda o enchimento, os 275 bytes decodificados são os mesmos e o AES-GCM, com razão, decifra.

Não há cookie forjado: a mesma sequência de bytes, com a mesma etiqueta, é o mesmo cookie. O que o cookie promete (e o
`educa_oidc` já testa, no caso `qualquer byte alterado, em qualquer posição, não decifra`) é que **byte** alterado não vale.
O teste da 14.0 afirmava mais do que o cookie promete.

Medido: 2000 cookies com o laço antigo, 106 aceitaram a troca (5,3%), todas na posição 366 e todas `A` → `B`.

## Teste que reproduz

`apps/api/src/sessao/external/cookie-oidc.test.ts` › `educa_conta_provada (14.0)` › `byte alterado, outra chave, valor
ausente, vazio ou sem sentido não valem`, o mesmo caso: o laço passa a alterar o **byte** decodificado (como o do
`educa_oidc`), em todas as posições, sobre vários cookies.

Não dá para ficar vermelho de forma determinística no HEAD sem fixar o IV (`randomBytes` é do módulo de cifra), e fixá-lo
testaria o teste, não o cookie. Evidência no lugar do vermelho: com o laço antigo, em 2000 cookies gerados numa execução
(arquivo temporário, apagado), 106 falharam; com o laço novo, os mesmos 2000, nenhum. Está no passo "Correção".

## Correção

O caso decodifica o valor, inverte um bit de **cada byte**, recodifica e exige `undefined`, em 50 cookies (cada um com IV
novo), para que o resultado não dependa de qual cookie saiu: o laço cobre o IV, a etiqueta e o texto, que é o que "qualquer
byte" quer dizer. O resto do caso (outra chave, valor ausente, vazio, sem sentido) não muda. Nenhum código de produção muda:
o cookie recusa o que deve recusar.

Estabilidade: o arquivo `cookie-oidc.test.ts` rodado sozinho dez vezes seguidas, 17 de 17 verdes em todas. O caso novo cobre
50 cookies de 275 bytes cada, então a chance do cookie "ruim" (último caractere `A`) deixou de importar.

## Mutações

--faltando: 0 linhas (0 blocos, 0 motivos)

Nenhuma cláusula de código: a correção só altera um teste, e nenhum arquivo de produção mudou.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | O laço faz 50 × 275 leituras; 10 a 20 cookies bastariam se o tempo do arquivo crescer | Recusada: o `infra-guardian` mediu o arquivo (17 de 17 verdes em 2,17 s, "custo na esteira desprezível") e o `tenancy-guardian` mesmo diz que não bloqueia. Sem tempo a ganhar, a correção mantém os 50 que o documento escolheu. |
| revisor-geral (1ª), test-engineer (1ª) | O caso vizinho do `educa_oidc` testa um cookie só, sem o controle positivo (o cookie sem alteração volta igual) | Recusada: fora desta correção, que só altera o caso do `educa_conta_provada`; o `revisor-geral` diz "Não precisa mudar" e o caso do `educa_oidc` já altera bytes, então não sofre o defeito. O `test-engineer` deixa para a retro. |
| test-engineer (1ª) | Os números "106 em 2000" e "nenhum com o laço novo" vêm de um arquivo temporário apagado e não se conferem | Recusada: é registro histórico, e o próprio documento diz que o arquivo foi apagado; o `test-engineer` conclui que "o raciocínio do documento basta para sustentar a correção". |
| tenancy-guardian, privacy-guardian, test-engineer (1ª) | "Não rodei o teste" (sem `pnpm` no PATH, ou sem `vitest` no worktree) | Recusada: observação do revisor, não pede mudança. O `test-engineer` e o `infra-guardian` rodaram o arquivo: 17 de 17 verdes. |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-09 13:51:25 | 2026-11-09 13:51:36 | `tenancy-guardian` | 1 | APROVADO | a1a36a316cbbee943 |
| 2026-11-09 13:51:22 | 2026-11-09 13:51:39 | `revisor-geral` | 1 | APROVADO | afb95656cd6c5842a |
| 2026-11-09 13:51:28 | 2026-11-09 13:51:40 | `infra-guardian` | 1 | APROVADO | ac0703c40913c9401 |
| 2026-11-09 13:51:26 | 2026-11-09 13:51:41 | `conformidade-reviewer` | 1 | APROVADO | a803de3c3595d3b84 |
| 2026-11-09 13:51:24 | 2026-11-09 13:51:47 | `privacy-guardian` | 1 | APROVADO | a3d46b4f4722f8fa7 |
| 2026-11-09 13:51:21 | 2026-11-09 13:52:04 | `test-engineer` | 1 | APROVADO | a209a22bd255f9b8e |
| 2026-11-09 13:57:58 | 2026-11-09 13:58:08 | `revisor-geral` | 2 | APROVADO | a7342d2668070e23a |
| 2026-11-09 13:57:54 | 2026-11-09 13:58:10 | `test-engineer` | 2 | APROVADO | a07fbc096be3326f3 |
