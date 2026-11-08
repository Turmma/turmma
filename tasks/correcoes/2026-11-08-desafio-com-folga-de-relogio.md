# Correção — o desafio de login é recusado quando o `iat` está à frente do relógio de quem o confere

**Origem:** TODO.md (ressalva da 1.0, `acesso-e-convites`: "`challenge.ts` e `operador-challenge.ts` usam o `maxTokenAge` do `jose` sem folga de relógio") e o portão da correção `2026-11-08-segundo-fator-na-casca`, que a viu em ação.
**Subagentes obrigatórios:** `infra-guardian`, `revisor-geral`
<!-- Ditados pelo PEDIDO do Orquestrador. `test-engineer` é de toda correção. A correção altera 7 arquivos fora de `tasks/`, o que também chama o `revisor-geral` (passo 5 de `corrigir`). -->

## Sintoma

No portão da 4.0, `professores.spec.ts` perdia 1 caso de 62 por rodada, no login da coordenação: `POST /v1/conta/mfa/configurar` respondia 401 duas vezes seguidas (e `POST /v1/sessao/mfa`, na entrada). No
traço do caso, o desafio saiu com `iat` 05:54:49 e a `api-1` o conferiu às 05:54:47,69 e às 05:54:48,41. O desafio chegou 1,3 a 2 s **à frente do relógio** de quem o conferiu, e foi recusado.

## Fora desta correção

Os arquivos da tarefa 4.0 em curso (`apps/api/src/professores/professores.repository.ts`, `apps/api/src/professores/professores.service.ts`, `apps/api/test/convites-enviar.int.test.ts`, `apps/api/test/professores.int.test.ts`,
`apps/web/src/areas/coordenacao/painel/fila-da-coordenacao.test.ts`, `apps/web/src/areas/coordenacao/professores/*` (as telas, os testes, `api/` e os três arquivos novos do envio), `docs/interface.md`, `docs/roteiro-da-demonstracao.md`,
`e2e/professores.spec.ts`, `e2e/professores-envio.spec.ts`, `e2e/support/seed.ts`, `packages/shared/src/professores/professores.ts` e `.test.ts`, `tasks/prd-acesso-e-convites/4_task.md`, `cenarios.md` e `techspec.md`) e os da correção
`2026-11-08-segundo-fator-na-casca` (`e2e/support/casca.ts`, `e2e/mfa.spec.ts` e o documento dela). Ficam na árvore, fora da revisão e do commit desta correção.

## Causa

`verifyChallenge` (`credencial/challenge.ts`) e `verifyOperadorChallenge` (`operacao/operador-challenge.ts`) conferem a idade do desafio com o `maxTokenAge` do `jose`. Com ele, o `jose` também recusa o `iat` **à frente** do relógio de
quem confere (`age + tolerance < 0`), e o `clockTolerance` dele é zero. Duas instâncias da API com relógios 1 s fora, ou um relógio que recua (o da máquina de desenvolvimento recua de 0,8 a 1,7 s a cada uns 15 s, `timesyncd`), e o desafio
recém-emitido do segundo fator é recusado com o 401 de qualquer desafio inválido, que a tela mostra como "código incorreto" e a pessoa só resolve entrando de novo. A 1.0 deu a folga só ao bilhete do convite (`convite-ticket.ts`,
`TICKET_CLOCK_TOLERANCE_SECONDS`) e registrou o resto no TODO.md. É padrão de mercado (D81): todo verificador de JWT tem folga de relógio, de poucos segundos.

## Teste que reproduz

- `apps/api/src/credencial/challenge.test.ts` › `folga de relógio: o iat à frente de quem confere passa até a folga…` (3 s e a folga passam, a folga + 2 s e o vencido não, o de 10 s de vida passa);
- `apps/api/src/operacao/operador-challenge.test.ts` › `folga de relógio: …` (o mesmo, para o desafio do operador, mais o sem `iat` e o mais velho que o prazo com `exp` longe);
- `packages/core/src/identidade/verify-token.test.ts` › `iatDoDesafioConfere` (as bordas da função, em segundos inteiros, e o tamanho da folga com valor literal: 10 s é aceito e 30 s não; a borda exata fica só aqui, porque os dois testes de API leem o relógio real e usam a folga menos 2 s);
- `apps/api/src/credencial/challenge.test.ts` › `borda: o desafio sem iat, ou com a validade maior que o prazo do desafio, é recusado`: prova que a idade continua limitada sem o `maxTokenAge` (já estava verde, e segue).

Vermelhos antes: os dois primeiros caíram com `NAO_AUTENTICADO` no primeiro `resolves` (o `iat` 3 s à frente). O terceiro é da função nova e nasceu verde, junto com ela.

## Correção

- `packages/core/src/identidade/verify-token.ts`: `FOLGA_DE_RELOGIO_DO_DESAFIO_SEGUNDOS = 10` e `iatDoDesafioConfere(iat, agora, ttl)`, que confere a idade **em segundos inteiros**: não mais velho que o prazo e não mais que a folga à frente.
  Exportados no `index.ts`.
- `challenge.ts` e `operador-challenge.ts`: saem o `maxTokenAge`, entram `iat` nas claims exigidas, `currentDate: agora` (o mesmo instante da idade) e a chamada de `exigirIdadeDoDesafio` (uma função pequena em cada arquivo que lança a recusa em cima de `iatDoDesafioConfere`: o ramo dentro de `verifyChallenge` passava a complexidade 10 do lint). O prazo continua exato: o `exp` é conferido pelo `jose` sem folga, e a
  idade continua limitada a 5 min (um desafio emitido há 6 min com `exp` de um dia é recusado).
- Os outros `jwtVerify` não mudam: `verifyToken` e `claimsDeOperador` não usam `maxTokenAge` (conferem só o `exp`, sem folga, e o `iat` nem é exigido), e o bilhete do convite já tem a sua folga (30 s).
- **A folga é de 10 s, e não de 30:** cobre os até 2 s medidos no traço e o relógio que recua 1,7 s com sobra, e fica longe dos 5 min do desafio. Aceitar o `iat` 10 s adiante não deixa ninguém entrar: o desafio continua assinado, de uso único (`jti` consumido
  no Redis) e com `exp` exato.
- TODO.md: a ressalva da 1.0 fica marcada como feita.

## Mutações

--faltando: 3 linhas (2 blocos, 1 motivos)

```mutacao
arquivo: apps/api/src/credencial/challenge.ts
teste: apps/api/src/credencial/challenge.test.ts › folga de relógio: o iat à frente de quem confere passa até a folga, que cobre a outra instância e o relógio que recua, e é recusado além dela; o prazo segue exato
-      requiredClaims: ['exp', 'jti', 'iat'],
-      currentDate: agora,
+      requiredClaims: ['exp', 'jti'],
+      maxTokenAge: CHALLENGE_TTL_SECONDS,
     })
```

```mutacao
arquivo: apps/api/src/operacao/operador-challenge.ts
teste: apps/api/src/operacao/operador-challenge.test.ts › folga de relógio: o iat à frente de quem confere passa até a folga e é recusado além dela; o desafio sem iat, ou mais velho que o prazo, é recusado
-      requiredClaims: ['exp', 'jti', 'sub', 'iat'],
-      currentDate: agora,
+      requiredClaims: ['exp', 'jti', 'sub'],
+      maxTokenAge: OPERADOR_CHALLENGE_TTL_SECONDS,
     })
```

```mutacao
arquivo: packages/core/src/identidade/verify-token.ts
teste: packages/core/src/identidade/verify-token.test.ts › aceita o iat de agora, o de até o prazo atrás e o de até a folga à frente, em segundos inteiros
-  return idade <= ttlSegundos && idade >= -FOLGA_DE_RELOGIO_DO_DESAFIO_SEGUNDOS
+  return idade <= ttlSegundos && idade >= 0
```

```mutacao
arquivo: packages/core/src/identidade/verify-token.ts
teste: packages/core/src/identidade/verify-token.test.ts › recusa o iat um segundo além da folga, um segundo além do prazo, e o que não existe
falha: iat - TTL - 1
-  return idade <= ttlSegundos && idade >= -FOLGA_DE_RELOGIO_DO_DESAFIO_SEGUNDOS
+  return idade >= -FOLGA_DE_RELOGIO_DO_DESAFIO_SEGUNDOS
```

```mutacao
arquivo: apps/api/src/credencial/challenge.ts
teste: apps/api/src/credencial/challenge.test.ts › folga de relógio: o iat à frente de quem confere passa até a folga, que cobre a outra instância e o relógio que recua, e é recusado além dela; o prazo segue exato
falha: emitidoComRelogio(FOLGA_DE_RELOGIO_DO_DESAFIO_SEGUNDOS + 2)
-  if (!iatDoDesafioConfere(iat, agora, CHALLENGE_TTL_SECONDS)) throw new DomainException(ErrorCode.NAO_AUTENTICADO)
 }
```

```mutacao
arquivo: apps/api/src/operacao/operador-challenge.ts
teste: apps/api/src/operacao/operador-challenge.test.ts › folga de relógio: o iat à frente de quem confere passa até a folga e é recusado além dela; o desafio sem iat, ou mais velho que o prazo, é recusado
falha: comIat(FOLGA_DE_RELOGIO_DO_DESAFIO_SEGUNDOS + 2)
-  if (!iatDoDesafioConfere(iat, agora, OPERADOR_CHALLENGE_TTL_SECONDS)) throw new DomainException(ErrorCode.NAO_AUTENTICADO)
 }
```

```mutacao
arquivo: packages/core/src/identidade/verify-token.ts
teste: packages/core/src/identidade/verify-token.test.ts › a folga é de 10 s, e não mais: 30 s à frente já é recusado
falha: toBe(10)
-export const FOLGA_DE_RELOGIO_DO_DESAFIO_SEGUNDOS = 10
+export const FOLGA_DE_RELOGIO_DO_DESAFIO_SEGUNDOS = 300
```

**Sem bloco (motivo):** o `if (iat === undefined) return false` de `iatDoDesafioConfere` (`verify-token.ts:55`) é a guarda de tipo (`iat` é opcional no `JWTPayload`); sem ela a conta dá `NaN` e a comparação devolve `false` do mesmo jeito, então o mutante é equivalente, e o comportamento (o desafio sem `iat` é recusado) está provado pelo caso `iatDoDesafioConfere(undefined, …)` e pelos de `challenge.test.ts` e `operador-challenge.test.ts`.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian (1ª); infra-guardian (1ª, segundo caminho); test-engineer (1ª, item 2) | `verifyChallenge` e `verifyOperadorChallenge` tiram `agora` de `new Date()`; receber o `Clock` injetado como os emissores tornaria os testes de borda determinísticos | `TODO.md`, entrada nova. Muda a assinatura dos dois verificadores e dos chamadores deles, o que passa de "poucas linhas sem mudar contrato". O item 2 da ordem já tira do relógio real a borda que podia falhar; o caso "folga + 2 s" segue com 2 s de margem |
| revisor-geral (1ª) | Três cópias da mesma conta de idade com folga (`iatDoDesafioConfere` com 10 s fixos, a conta à mão em `convite-ticket.ts:68-69` com 30 s, e `exigirIdadeDoDesafio` repetida em `challenge.ts` e `operador-challenge.ts`); passar a folga como parâmetro da função do core | `TODO.md`, na mesma entrada. Toca `convite-ticket.ts`, fora dos arquivos desta correção, e muda a assinatura da função exportada |
| revisor-geral (1ª) | Lugar da função: `iatDoDesafioConfere` e a constante estão em `verify-token.ts`, que trata do token de acesso; um arquivo próprio do desafio no core seria mais fácil de achar | `TODO.md`, na mesma entrada. É reorganização de arquivo, sem defeito de comportamento, e mexeria nos imports de quem já usa o `index.ts` |
| infra-guardian (1ª) | Uma linha em `docs/infra.md` exigindo NTP nas instâncias da API, com um limite de diferença, porque a folga de 10 s parte desse pressuposto (o `jti` no Redis dura `exp - agora` no relógio de quem consumiu) | `TODO.md`, entrada nova. `docs/infra.md` não é arquivo desta correção, e o limite de diferença entre relógios é decisão de operação, não de teste. Dono: Arquiteto, na retro da spec |
| revisor-geral (2ª) | Os dois testes de API aceitam a folga menos 2 s e recusam a folga mais 2 s, então nenhum quebraria com a folga em 9 s ou 11 s; a borda só é provada em `verify-token.test.ts` | Já está na entrada do `TODO.md` do `Clock` injetado nos verificadores (dono: Implementador): é ela que fecha a lacuna. Aplicar agora seria voltar à borda exata com o relógio real, que a rodada 1 tirou |
| test-engineer (2ª) | Os verificadores leem `new Date()` por dentro; "folga + 2 s" e "folga − 2 s" dependem de o relógio real não recuar mais de 1 s entre emitir e conferir | A mesma entrada do `TODO.md` (o `Clock` injetado) |
| test-engineer (2ª) | Observações menores: três cópias da conta de idade, lugar da função, NTP em `docs/infra.md` | Já estão no `TODO.md`, com dono, desde a rodada 1; nada a acrescentar |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-08 06:29:48 | 2026-11-08 06:30:05 | `tenancy-guardian` | 1 | APROVADO | aea7b17ba8bf3d05d |
| 2026-11-08 06:29:50 | 2026-11-08 06:30:10 | `conformidade-reviewer` | 1 | APROVADO | a7b2e6c04b65be6b5 |
| 2026-11-08 06:29:50 | 2026-11-08 06:30:15 | `privacy-guardian` | 1 | APROVADO | a8e95033de14496df |
| 2026-11-08 06:29:44 | 2026-11-08 06:30:17 | `revisor-geral` | 1 | APROVADO | ae04aa3d1a8d6bfa4 |
| 2026-11-08 06:29:42 | 2026-11-08 06:30:45 | `infra-guardian` | 1 | APROVADO | a160ea7264bb4f202 |
| 2026-11-08 06:29:46 | 2026-11-08 06:31:11 | `test-engineer` | 1 | APROVADO | a1996407cd1a19cf9 |
| 2026-11-08 07:44:06 | 2026-11-08 07:44:33 | `revisor-geral` | 2 | APROVADO | a06dce352a726024d |
| 2026-11-08 07:44:01 | 2026-11-08 07:44:39 | `test-engineer` | 2 | APROVADO | a6a67e274ecf23b00 |
