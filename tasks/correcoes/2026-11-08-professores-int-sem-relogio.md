# Correção — três casos de `professores.int.test.ts` dependem de o relógio de parede não recuar

**Origem:** teste intermitente (rodadas do portão das correções `2026-11-08-segundo-fator-na-casca` e `2026-11-08-desafio-com-folga-de-relogio`: `E12 (13.0) … o NAO_ENCONTRADO do inexistente`, `C7 … dois refazer … ordem forçada na trava` e `E11 … também depois do aceite`).
**Subagentes obrigatórios:** `test-engineer`
<!-- O PEDIDO do Orquestrador não ditou guardião para esta correção, que é do Implementador (caso antigo que a 4.0 não tocou). `test-engineer` é de toda correção. A correção altera 1 arquivo fora de `tasks/` e não toca `.github/`, `tools/ci/` nem `tools/processo/`. -->

## Sintoma

Portão, integração: `E12`: `expected 404 to be 200` em `aceitar(desligado.token, SENHA_NOVA)` (`professores.int.test.ts:576`); `C7`: a auditoria `convite.refeito` veio na ordem `[segundo, primeiro]` em vez de `[primeiro, segundo]` (`:773`); `E11`: `expected [ 'desativado', 'aceito' ] to deeply equal [ 'aceito', 'aceito' ]` na lista depois do aceite. Os três passaram 63 de 63 em outra rodada, e cada rodada caiu em um diferente.

## Fora desta correção

O resto de `apps/api/test/professores.int.test.ts` (a 4.0 alterou as linhas 160 e 925 do arquivo; o commit desta correção leva só os trechos dela) e os arquivos das outras correções e da tarefa 4.0 em curso (`apps/api/src/professores/`, `apps/web/src/areas/coordenacao/professores/` e o mais que a lista da 4.0 traz, `packages/core/`, `apps/api/src/credencial/challenge*`, `apps/api/src/operacao/operador-challenge*`, `tools/ci/`, `TODO.md`, `e2e/`, `tasks/`).

## Causa

O relógio de parede desta máquina recua de 0,8 a 1,7 s a cada uns 15 s (`systemd-timesyncd`; `relogio-que-recua.ts`), e a 1.0 já tinha tirado os casos de `convite.int.test.ts` e `ciclo-de-vida.int.test.ts` da dependência dele. Estes dois ficaram de fora:

- **E11 e E12:** o professor é convidado (nasce inativo, com `desativado_em = now()`) e aceita o convite; o aceite só ativa se `convite.usado_em >= usuario.desativado_em`. Com o recuo entre os dois, `usado_em` fica antes: no E12 o aceite responde 404, o do convite
  inexistente (que o caso prova **em outro lugar**), e no E11 a lista diz `desativado` onde o caso espera `aceito`. O E12 desativa depois do aceite com `now() + 1 s`, que também depende do relógio. Qualquer caso do arquivo que cadastra e aceita tem a mesma exposição.
- **C7:** `auditoriaDe` ordena por `id`, um UUID v7 que segue o relógio (regra 40: "o id, que é v7, segue o instante da criação: não é a ordem de negócio"). Com o relógio recuado entre as duas transações, as duas linhas de `convite.refeito` saem trocadas.

## Teste que reproduz

E11 e E12: reproduzem de forma determinística **simulando o recuo**: sem o ajudante, com `desativado_em` empurrado 5 s à frente do convidar, o E12 cai com `expected 404 to be 200` (igual ao portão) e o E11 cai em `aceitar` (`expected undefined to be 'entrar'`); com o ajudante e o mesmo empurrão, os dois passam (rodado à mão em rascunhos do teste, que não ficam no repositório).
C7: o recuo entre duas transações não se simula sem mexer no relógio do banco; a evidência que substitui o vermelho é a causa (a regra 40 e a ordem por `id` que o caso lê) e as dez execuções seguidas abaixo.

## Correção

Só `apps/api/test/professores.int.test.ts`, nos dois casos e no leitor da auditoria:

- `cadastrar` (o ajudante de todo cadastro do arquivo) passa a chamar `anteciparODesativado(pool, usuarioId)` quando a resposta é 201: o `desativado_em` do recém-convidado um minuto no passado, para o aceite que vier ser, por construção, posterior. É a raiz do E11 e do E12 e cobre os outros casos que cadastram e aceitam. E o E12 passa a desativar com
  `desativarDepoisDoUltimoAceite`, no lugar do `now() + 1 s`. São os ajudantes de `relogio-que-recua.ts`, os mesmos de `convite.int.test.ts`.
- C7: `auditoriaDe` passa a ordenar por `xmin::text::bigint, id` (a ordem das transações; o `id` desempata linhas da mesma transação), como `convite.int.test.ts` e `ciclo-de-vida.int.test.ts` já fazem. Vale para todo caso do arquivo que lê a auditoria.

A regra que cada caso prova não muda: E11 continua afirmando que cadastrar com e sem conta dá a mesma resposta e a mesma lista depois do aceite; E12, que o desativado depois do aceite recebe o `NAO_ENCONTRADO` do inexistente; C7, que o segundo refaz o convite que o primeiro criou.

## Mutações

**Sem mutação:** a correção altera só um teste (`apps/api/test`), nenhuma linha de `apps/*/src` nem de `packages/*/src`.

## Estabilidade

Os três casos (mais um vizinho, que o filtro `-t` pega), rodados dez vezes seguidas, sozinhos: 10 de 10 verdes. O arquivo inteiro: 35 de 35.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª) | Deixar a função crua à disposição de um caso que precise do `desativado_em` exato, ou dar ao ajudante um nome que diga o que ele faz | Recusada nesta forma: renomear o `cadastrar` mexe em todas as chamadas do arquivo, muitas em linhas que a 4.0 também altera. O item 1 põe no comentário o que o nome não diz; o caso futuro que precisar do valor exato chama `pedir('POST', '/v1/professores', …)` direto |
| tenancy-guardian (1ª) | Se os ajudantes de `relogio-que-recua.ts` passarem a ser usados fora de `apps/api/test`, precisam de filtro por `escola_id` | Recusada: condição que não existe hoje, e o arquivo não é desta correção (não mudou). Quem o importar de outro lugar passa pela revisão do `tenancy-guardian` nessa tarefa |
| privacy-guardian (1ª) | Confirmar que nenhum caso do arquivo afirma algo sobre o valor exato de `desativado_em` logo depois do convidar | Atendida pela própria rodada: o `test-engineer` leu o arquivo inteiro e aprovou sem apontar caso assim |
| revisor-geral (1ª) | Ajudante que force duas transações com o `id` v7 invertido, para o próximo leitor de auditoria ordenada | Retro da spec (dono: Arquiteto). Seria código novo de teste, em arquivo que a correção não toca (`relogio-que-recua.ts`) |
| infra-guardian (1ª), test-engineer (1ª), revisor-geral (1ª) | O C7 segue sem um teste que mostre o vermelho | Já escrito no "Teste que reproduz" do documento: o recuo entre duas transações não se simula sem mexer no relógio do banco. Fica para a validação, sem ação |
| revisor-geral (2ª) | A seção "Fora desta correção" cita as linhas 160 e 925 do arquivo de teste; os comentários novos as empurraram, e os dois `enviadoEm: null` estão hoje em `:174` e `:939`. Corrigir os números ou citar o trecho | Sem ação no documento: as linhas mudam a cada edição da 4.0, e o trecho já está identificado pelo conteúdo (`enviadoEm: null`) no PEDIDO do Orquestrador e na seção "Fora". Quem separa o commit reconhece o hunk pelo `git diff`, não pelo número |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-08 08:34:37 | 2026-11-08 08:34:54 | `conformidade-reviewer` | 1 | APROVADO | a19d62828d73754c7 |
| 2026-11-08 08:34:34 | 2026-11-08 08:34:59 | `privacy-guardian` | 1 | APROVADO | a0f0fdf90352d38eb |
| 2026-11-08 08:34:30 | 2026-11-08 08:35:04 | `revisor-geral` | 1 | APROVADO | a42e694afe811526f |
| 2026-11-08 08:34:32 | 2026-11-08 08:35:05 | `tenancy-guardian` | 1 | APROVADO | aa2b82c1c151ed93e |
| 2026-11-08 08:34:39 | 2026-11-08 08:35:16 | `infra-guardian` | 1 | APROVADO | acae2fe7f7391e6e0 |
| 2026-11-08 08:34:27 | 2026-11-08 08:36:19 | `test-engineer` | 1 | APROVADO | aad1a23fdbbee479c |
| 2026-11-08 08:48:53 | 2026-11-08 08:49:12 | `revisor-geral` | 2 | APROVADO | a12040e2669b560f8 |
