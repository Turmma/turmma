# Correção — dois casos de e2e passam de dois terços do prazo no censo (`convite.spec.ts` W14 e `mfa.spec.ts` "cinco códigos errados")

**Origem:** esteira run 42913443769, `node tools/processo/esteira.ts --censo` (passo 8 do `/seguir`, "O censo do e2e").
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- O PEDIDO do Orquestrador ditou `test-engineer` e `revisor-geral` (e `infra-guardian` só se a correção tocasse algo fora de `e2e/`). A correção toca só `e2e/`, e `guardioes-por-caminho.ts` pede os quatro guardiões para esse caminho: a Mesa os acrescentou na devolução da rodada 1, e o portão confirma seis obrigatórios. -->

## Sintoma

O censo aponta dois casos, nos dois projetos, em arquivos que a spec alterou:

| Caso | Projeto celular | Projeto chromebook | Prazo |
|---|---|---|---|
| `e2e/convite.spec.ts:155` "W14: o professor com a conta nova cria a senha, vai à entrada sem segundo fator, entra e chega a Turmas" | 23,2 s | 22,8 s | 30 s |
| `e2e/mfa.spec.ts:232` "cinco códigos errados gastam o desafio…" | 20,3 s | 20,2 s | 30 s |

O limite do censo é 20 s (dois terços de 30 s): o runner da esteira leva perto do dobro do tempo do portão.

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

Os dois casos gastam o prazo em coisa que não é o assunto deles. Medido isolado na base (`node tools/ci/e2e.ts --manter-ambiente`, os dois specs): W14 20,1 s (chromebook) e 21,0 s (celular); "cinco códigos errados" 19,3 s e 18,9 s.

- **MFA, `mfa.spec.ts:232`:** o caso prova que o quinto código errado gasta o desafio, e começava configurando o segundo fator **pela tela** (`setUpMfa`), que o ajudante do próprio `support/mfa.ts` registra como "uns 8 s de um prazo de 30 s" e que tem os casos dela. Depois ainda abria a entrada e a tela do código sob a rede lenta do perfil.
- **W14, `convite.spec.ts:155`:** um caso só percorria o aceite pela tela, a entrada com a senha criada, a abertura em Nova conversa e o toque em Turmas: quatro telas carregadas sob a CPU ×4 e a rede do perfil. Medido por etapa no caso de Turmas: 3,4 s até o `goto` voltar e 8,8 s até o botão aparecer, de uma primeira carga que o caso não tem por assunto.

Falha de acabamento da 7.0 e da 8.0 (acesso-e-convites), que escreveram os dois casos: o prazo só aparece no censo do runner, que leva perto do dobro do portão.

## Teste que reproduz

O defeito é de duração, e a prova é a duração do caso, medida antes e depois, isolada, nos dois projetos (`npx playwright test e2e/convite.spec.ts e2e/mfa.spec.ts --workers 1`, o ambiente de pé). "Antes" é a medição de base acima, e o censo do run 42913443769 (23,2 s e 22,8 s; 20,3 s e 20,2 s). Não há vermelho a reproduzir: o caso passa, só passa tarde.

| Caso | Antes (chromebook / celular) | Depois (chromebook / celular) |
|---|---|---|
| W14 da conta nova, tela até a entrada (`convite.spec.ts:156`) | 20,1 / 21,0 s | 9,1 / 9,4 s |
| W14, entra com a senha criada (`:203`, novo) | — | 8,4 / 8,8 s |
| W14, Nova conversa a Turmas (`:224`, novo) | — | 2,5 / 2,7 s |
| cinco códigos errados (`mfa.spec.ts:232`) | 19,3 / 18,9 s | 9,1 / 9,2 s |

Todos abaixo de 12 s, com folga para o limite de 15 s do portão e para os 20 s do censo.

## Correção

Só `e2e/`, uma linha de `tasks/prd-acesso-e-convites/cenarios.md` e uma linha do `TODO.md`. As asserções do W14 original e do caso dos cinco códigos continuam todas, cada uma em um caso; o que a divisão faz de diferente está dito abaixo, sem esconder o que se perdeu.

- **`mfa.spec.ts`:** a configuração do segundo fator passa a ser `configurarSegundoFatorPelaApi(request, renata)`, em vez de `setUpMfa`. O segredo e o passo do relógio são os mesmos (a ativação gasta o passo de agora, e o código do passo seguinte do fim do caso continua o mesmo), e a tela de configuração segue provada pelos casos dela. A primeira carga e a entrada com a senha rodam em `loadUnthrottled`. O `setUpMfa` deixou de ser importado neste spec.
- **`convite.spec.ts`:** o W14 se divide em três casos:
  1. `:156`, o aceite pela tela, do convite à `/entrar` com o aviso, o `segundo fator` ausente e as verificações de que o token não passou por endereço nem por `localStorage`/`sessionStorage`. Essas últimas vinham no fim do caso inteiro e foram para o fim deste, que é onde o token passa pela aba. **Acrescenta** a asserção de que o corpo do aceite com a senha leva o que foi digitado (`SENHA_NOVA`), que o "Mostrar" não altera (ordem da rodada 1, item 3).
  2. `:203`, a entrada com a senha criada e a abertura em Nova conversa, com o nome e a escola na casca. O aceite é pela API (`aceitarConvitePelaApi`), e a primeira carga de `/entrar` roda em `loadUnthrottled`. **Acrescenta** a asserção de que a resposta da entrada é `pronta`, o que sustenta o "sem segundo fator" do título (item 4).
  3. `:224`, o toque em "Ir para Turmas" e a tela de Turmas sem alocação. O aceite é pela API e a sessão vem de `entrarPelaApi` (`support/casca.ts`), que falha se a etapa não é `pronta`; a primeira carga roda em `loadUnthrottled`. O nome e a escola na casca já são afirmados no caso 2.
- **`support/roteiro.ts`:** `aceitarConvitePelaApi`, o aceite com a senha pela API, que os dois casos novos e `professorAceitaEConfirmaPelaApi` usam (item 5).
- **`support/casca.ts`:** `entrarPelaApi` afirma o status da entrada antes de ler o corpo, para que a falha aponte a recusa e não uma `etapa` indefinida (item 5).
- **`tasks/prd-acesso-e-convites/cenarios.md:299`:** as linhas de `convite.spec.ts` que o `/validar` lê (`:211`, `:229`, `:355`) deslizaram 30 linhas com a divisão e passam a `:241`, `:259` e `:385` (item 1).

**O que a divisão tira, dito por inteiro.** Nenhum e2e percorre mais o aceite pela tela e a entrada com a senha criada **na mesma aba**: a conta nova que digita a senha, alterna "Mostrar" e entra com ela, de ponta a ponta. O que o caso `:156` prova do token (barra, chamadas, `localStorage`, `sessionStorage`) é verdadeiro até a `/entrar`; não vale para o estado em memória da aplicação, nem para a navegação da `/entrar` até a área do professor. O envio da senha digitada está provado pelo corpo do aceite (acima), e a entrada com a senha criada, pelo caso `:203`; o que não há é a prova de que a tela de entrada e a navegação seguinte nunca recebem o token. Isso vai ao `TODO.md`, para a retro (a recomendação de um caso que aceite pela tela e prove isso).

`loadUnthrottled` é a receita das correções `2026-10-26-areas-entrar-estoura-o-prazo` e vizinhas (`support/mfa.ts`): tira só a rede do perfil da primeira carga, e a CPU do perfil continua. O que ela não mede é quanto a aplicação leva para abrir na rede lenta, e nenhum dos três casos tem isso por assunto.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| privacy-guardian, test-engineer e revisor-geral (1ª) | Um caso que aceite pela tela e prove que a tela de entrada e a navegação até a área logada não recebem o token | `TODO.md`, para a retro; a limitação está escrita acima |
| infra-guardian (1ª) | Conferir que contas novas da mesma escola do seed não somam no mesmo balde se o limite de tentativas de entrada ficar mais apertado no e2e | Recusada pela Mesa: os casos não chegam perto do limite, e não há código nem teste a mudar aqui |

## Mutações

--faltando: 0 linhas (2 blocos, 0 motivos)

O aceite com a senha leva o que foi digitado: se a tela alterasse a senha no corpo, o caso `:156` cai na asserção do corpo do aceite.

```mutacao
arquivo: apps/web/src/api/convite.ts
teste: e2e/convite.spec.ts › W14: o professor com a conta nova cria a senha
-    resposta = await apiRequest(CAMINHO_DO_ACEITE_DE_CONVITE, aceitarConviteResponseSchema, { metodo: 'POST', corpo: pedido })
+    resposta = await apiRequest(CAMINHO_DO_ACEITE_DE_CONVITE, aceitarConviteResponseSchema, { metodo: 'POST', corpo: pedido.senha === undefined ? pedido : { ...pedido, senha: `${pedido.senha}x` } })
```

O professor entra sem segundo fator: se a API pedisse o segundo fator ao professor, o caso `:203` cai na asserção da `etapa`.

```mutacao
arquivo: apps/api/src/sessao/completion/login-completion.ts
teste: e2e/convite.spec.ts › W14: o professor com a conta nova entra com a senha que criou
-  if (usuarios[0]?.papel === 'coordenador' && !mfaCumprido) return mfaAtivo ? 'mfa' : 'configurar_mfa'
+  if (usuarios[0] !== undefined && !mfaCumprido) return mfaAtivo ? 'mfa' : 'configurar_mfa'
```

Sem bloco, de propósito: o `aceitarConvitePelaApi` e o status afirmado em `entrarPelaApi` são ajudantes de `e2e/support/`, e não código de produção; o que eles afirmam (o aceite e a entrada deram certo) só aparece quando falham.

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-10 20:44:28 | 2026-11-10 20:44:44 | `tenancy-guardian` | 1 | APROVADO | aa8503b54e249b6b3 |
| 2026-11-10 20:44:35 | 2026-11-10 20:44:51 | `conformidade-reviewer` | 2 | APROVADO | a43a655564b2922c7 |
| 2026-11-10 20:44:38 | 2026-11-10 20:44:54 | `infra-guardian` | 2 | APROVADO | ae9e359c0a4026284 |
| 2026-11-10 20:44:31 | 2026-11-10 20:44:55 | `privacy-guardian` | 2 | APROVADO | a2a9c3dbd593dd40a |
| 2026-11-10 20:44:27 | 2026-11-10 20:44:56 | `revisor-geral` | 2 | APROVADO | ac5199200abb876f8 |
| 2026-11-10 20:44:22 | 2026-11-10 20:45:01 | `test-engineer` | 2 | APROVADO | ab1831a7f9ad48503 |
