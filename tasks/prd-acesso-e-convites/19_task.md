# Tarefa 19.0 — "Corrigir o e-mail" no painel do professor

**Funcionalidade:** acesso-e-convites · **Depende de:** 18.0, 4.0
**Subagentes obrigatórios:** `frontend-reviewer`, `privacy-guardian`, `test-engineer`
**Porte:** pequeno

## Objetivo

O painel do professor `pendente` ou `vencido` ganha "Corrigir o e-mail": a coordenação digita o e-mail certo, recebe o link uma vez e
reenvia por e-mail ou copia. O texto do `falhou` passa a apontar esse caminho. Fecha, com a 18.0, o maior 1 da validação.

## Contexto necessário

- `techspec.md` §9 (Professores) e §5 "Corrigir o e-mail"; `prd.md` §7 "E-mail que volta", RF18
- `cenarios.md`, "Telas" (linhas "Corrigir o e-mail" e "Professores, envio") e a linha [E] de "Corrigir o e-mail"
- `docs/interface.md`, Professores, item **(4)**, já com o desenho
- Regras 50 e 20 (o link fora do cache, da URL, do log e do armazenamento, como o do refazer)
- Em `apps/web/src/areas/coordenacao/professores/`: `PainelDoProfessor.tsx` ("Reenviar", "Refazer convite" e o link uma vez), `convite-de-professor.ts` (`TEXTO_DO_EMAIL_JA_CADASTRADO`, `TEXTOS_DO_CONVITE_QUE_MUDOU`), `envio-do-convite.ts` (o `falhou`)

## Subtarefas

- [x] 19.1 — O botão secundário "Corrigir o e-mail" só no `pendente` e no `vencido`, e o diálogo com os estados da linha "Corrigir o e-mail" de "Telas"; o `CONFLITO` relê a lista e decide o texto pelo estado relido
- [x] 19.2 — O sucesso: "E-mail corrigido", o link uma vez com "Copiar link", e "Enviar por e-mail", que abre o diálogo do "Reenviar" daquele professor; o texto do `falhou` vira "Não chegou. Corrija o e-mail e reenvie, ou copie o link"
- [x] 19.3 — `docs/interface.md` conferido contra a tela; `grep -rn 'Confira o e-mail e reenvie' apps/web/src e2e/ docs/`, cada ocorrência trocada ou justificada aqui. **Prova:** `docs/interface.md`, Professores, item (4), diz o botão secundário no `pendente` e no `vencido`, o campo vazio, o link uma vez e "Enviar por e-mail"; confere com as fotos da vitrine (seção "Autoconferência", resposta 2). O `grep` com os três caminhos, `apps/web/src`, `e2e/` e `docs/`, **volta vazio**. Fora deles, o texto antigo só sobra em `tasks/prd-acesso-e-convites/validacao.md` (linhas 17 e 73: a validação do F2c, que cita o que o código dizia na data dela, e não se reescreve), em `tasks.md` (a linha desta subtarefa) e neste documento (o próprio `grep`); `apps/web/dist` é build e não entra na busca
- [x] 19.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/areas/coordenacao/professores/PainelDoProfessor.tsx`, `PainelDoProfessor.test.tsx` | alterado |
| `apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx`, `DialogoDeCorrigirEmail.test.tsx` | novo |
| `apps/web/src/areas/coordenacao/professores/convite-de-professor.ts`, `convite-de-professor.test.ts` | alterado |
| `apps/web/src/areas/coordenacao/professores/envio-do-convite.ts`, `envio-do-convite.test.ts` | alterado |
| `apps/web/src/areas/coordenacao/professores/api/` (a chamada nova) | alterado |
| `e2e/professores-envio.spec.ts` | alterado |
| `docs/interface.md` | conferido contra a tela; não mudou (item (4) já descrevia o desenho) |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| ponta a ponta | e2e | `falhou` → corrigir → enviar → Mailpit no e-mail novo → aceita → vê a turma da grade | `professores-envio.spec.ts` › "o envio falhou: a coordenação corrige o e-mail, envia pelo "Reenviar", o e-mail chega ao endereço certo, o professor aceita e vê a turma da grade" |
| botão por estado | unidade | só no `pendente` e no `vencido` | `convite-de-professor.test.ts` › "só o convite em aberto, pendente ou vencido, tem o botão…" (a matriz); `PainelDoProfessor.test.tsx` › "o botão é secundário e só existe no convite em aberto…" (os seis estados, no painel); `Professores.test.tsx` › "só as ações que o estado permite…" |
| e-mail de hoje | unidade | não aparece | `DialogoDeCorrigirEmail.test.tsx` › "abre com o campo vazio, sem o e-mail de hoje…"; `PainelDoProfessor.test.tsx` › "abre o diálogo por cima do painel… o e-mail de hoje não aparece em lugar nenhum" |
| carregando | unidade | botão ocupado; clique duplo, uma chamada | `DialogoDeCorrigirEmail.test.tsx` › "com o pedido no ar o botão fica ocupado…" (o clique duplo) e › "o segundo envio que chega antes de a tela desligar o botão…" (a trava do pedido no ar, no mesmo quadro) |
| `CONFLITO` em aberto | unidade | lista relida; texto do e-mail; foco no campo | `DialogoDeCorrigirEmail.test.tsx` › "`CONFLITO` com o professor ainda esperando o convite…" (o texto e o foco); `PainelDoProfessor.test.tsx` › "`CONFLITO` com o professor ainda `pendente` na lista relida…" (a lista lida de novo) |
| `CONFLITO` com estado mudado, `NAO_ENCONTRADO` | unidade | texto do convite que mudou; fecha; foco no painel | `DialogoDeCorrigirEmail.test.tsx` › "`CONFLITO` com o professor %s na lista relida…" (quatro estados e o fora da lista), › "o estado que a lista relida traz decide depois da resposta…" e › "`NAO_ENCONTRADO`…"; `PainelDoProfessor.test.tsx` › "`CONFLITO` com o professor que saiu de `pendente` e `vencido`…" e › "`NAO_ENCONTRADO` (o professor saiu da escola)…" (a lista relida e o foco); `convite-de-professor.test.ts` › "`CONFLITO` com o estado mudado, ou o professor fora da lista, e `NAO_ENCONTRADO`…" |
| rede | unidade | "Tentar de novo"; a tentativa seguinte apaga o aviso | `DialogoDeCorrigirEmail.test.tsx` › "a rede: o aviso diz o que fazer, com o foco nele…" |
| sucesso | unidade | link uma vez, "Copiar link"; fechar tira o link; `pendente` sem envio | `DialogoDeCorrigirEmail.test.tsx` › "diz "E-mail corrigido"…", › "\"Copiar link\" copia o link inteiro…", › "fechar com o link sem copiar pergunta antes…"; `PainelDoProfessor.test.tsx` › "aceito: a lista é relida e mostra o professor `pendente` sem envio…" |
| link fora do navegador | unidade | fora do cache, da URL e do armazenamento | `DialogoDeCorrigirEmail.test.tsx` › "o link não vai ao endereço nem ao armazenamento do navegador, e fechar o tira…"; `api/professores.test.ts` › "o link e o e-mail novo saem do cache de mutações (`gcTime: 0`)…" |
| "Enviar por e-mail" | e2e | abre o "Reenviar", que diz que o link mostrado caduca | o mesmo caso da ponta a ponta (`Um e-mail novo, com um link novo, para …` e os links anteriores); unidade: `PainelDoProfessor.test.tsx` › ""Enviar por e-mail" troca o diálogo pelo do "Reenviar"…" |
| texto do `falhou` | unidade | o novo | `envio-do-convite.test.ts` › o rótulo do `falhou`; `Professores.test.tsx` › "cada linha tem a região `aria-live="polite"`…" e › "o painel de quem espera o convite e já teve envio…" |
| recomeço | e2e | o estado muda no servidor com o diálogo aberto (a revogação feita por `revogarConvite`, direto no banco); resposta atrasada (`page.route`); falha com o diálogo aberto e lista relida | `professores-envio.spec.ts` › "o e-mail de outro professor da escola não serve e o campo segue com o foco; se o convite é revogado antes…" (a falha com o diálogo aberto, e a lista relida) e › "a resposta atrasada de uma correção com o diálogo já fechado…" (`page.route`) |
| texto da tela (D64) | unidade | fala da conta e do convite, nunca do uso da IA | `DialogoDeCorrigirEmail.test.tsx` › "o texto da tela fala da conta e do convite, nunca do uso da IA (D64)…" (o campo e o aviso do e-mail que não serve) e › "o texto do link fala da conta e do convite, nunca do uso da IA (D64)" |
| 360 px e 1366 × 768 | e2e | `paginaNaoRola`; 44 px nas ações principais, 24 px no resto | `professores-envio.spec.ts` › "a 1366 × 768 a página não rola e a 360 px não rola de lado, no painel e no diálogo…" |

## Como testar

- e2e: `e2e/professores-envio.spec.ts` › "o professor abre o link do e-mail, cria a senha e aceita" (`mensagemChegou`, `mensagemDoMailpit`, `outroNavegador`); recomeço › "a leitura atrasada de antes do "Reenviar"…"; medida › "a 360 px não rola de lado…, no painel e no diálogo "Reenviar""
- Cena (`e2e/support/seed.ts`): `convidarProfessorNoBanco`, `definirOEnvioDoConvite(usuarioId, 'falhou')`, `criarAlocacaoDoProfessor`, `criarAulasNoBanco`
- Unidade: `PainelDoProfessor.test.tsx`, com o `FakeNetwork`
- Isolado: `node tools/ci/e2e.ts --manter-ambiente e2e/professores-envio.spec.ts`
- Armadilhas: a fatia 1 do e2e está no teto (27 de 27 min) e caso novo nela reprova `tools/ci/esteira.test.ts` (`tools/ci/prazo-do-e2e.ts`; `docs/runbook.md`, "Esteira vermelha no e2e"); o texto novo do `falhou` muda fotos e specs que o citam
- Telas: `coordenacao`, `/professores`, abrir a Ana (`falhou`) → "Corrigir o e-mail": vazio, `CONFLITO`, sucesso com o link

## Autoconferência

As 12 perguntas do `task-template.md`, no plano; pesam a 2 (o `falhou`), a 9 (reaproveite o "Reenviar" e o link do refazer) e a 10.

**Plano.** Um diálogo novo, `DialogoDeCorrigirEmail`, montado com as peças de `components/copy-once.tsx` (`useGuardedClose`, `CloseConfirmation`, `useCopyToClipboard`, `LinkField`, `CopyStatus`, `FailureAlert`, `useStepFocus`), o `Dialog`, o `FormField` e o `Button`, como o do refazer; a chamada e a mutação (`gcTime: 0`, `onSettled` que relê a lista) em `api/professores.ts`; o botão no painel e a ligação em `Professores.tsx`, que passa ao diálogo o estado da lista de agora. O link vive só na mutação do diálogo.

1. **Mutações:** a seção "Mutações" tem um bloco por cláusula do diff (a etapa, a pergunta de fechar, a trava `noAr`, o foco do campo, cada `&&` e `?:` do JSX, a matriz, o `CONFLITO` por estado, a rota, o `gcTime: 0` e o `onSettled`, o botão do painel e a ligação em `Professores.tsx`); os que ficaram sem bloco têm motivo escrito lá.
2. **O texto já aparece?** `grep -rln 'Corrigir o e-mail\|E-mail corrigido\|E-mail certo\|Não chegou' e2e/ apps/web/src` só acha `e2e/professores-envio.spec.ts` e a pasta `professores/`; nenhum outro spec conta o botão novo (`toHaveCount` de "Reenviar", "Refazer convite" e "Revogar convite" são de botões que ele não toca). O texto antigo do `falhou` não sobra em `apps/web/src`, `e2e/` nem `docs/` (subtarefa 19.3). A vitrine só clica, não digita (`tools/vitrine/vitrine.ts`): ela não alcança os estados que pedem digitação. Por isso fotografei com um script avulso do Playwright, fora do repositório, sobre a escola da vitrine e a sessão guardada da coordenação, a 1366 × 768 e a 360 px: o painel do `falhou`, o diálogo vazio, o e-mail fora do formato, o `CONFLITO` (o e-mail de outro professor), o link e o painel depois de fechar. As fotos são arquivos locais de `.processo/vitrine/` (`corrigir--*.png`), que não entram no commit; nenhuma rola de lado e as ações cabem. O Validador fotografa cada requisito com tela no fim da spec.
3. **Segundo dado:** a lista tem o professor em cada estado (`pendente`, `vencido`, `revogado`, `aceito`, `ativo`, `desativado`) e o `estadoAgora` do diálogo tem os quatro valores mais o `undefined`; apagar a condição do botão ou a do `CONFLITO` deixa vermelho (os blocos da matriz, de `falhaDaCorrecaoDoEmail` e do `corrigirOEmail` do painel).
4. **Checagem anterior que responde antes:** o e-mail fora do formato volta do cadastro (`pedidoDeCorrecaoDoEmail`) sem pedido; os casos do `CONFLITO` e do sucesso usam e-mail válido, e o teste confere que o pedido saiu (`corposDoPedido`) antes de olhar a resposta.
5. **Resultado, e não a forma:** os casos olham o que a pessoa vê (o texto, o foco, o botão, o link, o cache de mutações, a lista relida), nunca o texto do arquivo.
6. **Guarda nova:** nenhuma regra de lint, teste estrutural nem trava de pasta; não se aplica.
7. **Comentário que afirma o que o código não faz:** os docblocks do diálogo, de `falhaDaCorrecaoDoEmail` e do painel foram relidos contra o código depois da divisão do componente (a trava `noAr` e o diálogo que fica só com "Fechar" estão ditos como são). A recomendação da `conformidade-reviewer` da 18.0 (a frase da tela fala da conta e do convite, nunca do uso da IA; D64, regra 70, item 9) virou teste: dois casos do `DialogoDeCorrigirEmail.test.tsx` varrem o texto de cada etapa atrás de "uso", "usar", "adoção", "IA".
8. **Divergências:** a tabela abaixo; cada uma tem o termo do código no `cenarios.md` e na `techspec.md` (conferido com `grep`, feito depois de a spec ser atualizada).
9. **Peça que já existe:** o diálogo reaproveita `copy-once.tsx` inteiro, o `Dialog`, o `FormField` (`dica`, `erro`), `linkDoConvite`, `TEXTO_DA_VALIDADE_DO_CONVITE`, `falhaDoRefazerConviteDeProfessor` e `TEXTOS_DO_CONVITE_QUE_MUDOU` do refazer; o schema, a matriz e o tipo vêm de `@educa/shared`. O que é novo é só o que a correção tem de próprio: o campo, a falha do campo (`TEXTO_DO_EMAIL_QUE_NAO_SERVE`) e a decisão pelo estado relido.
10. **Duas vezes ao mesmo tempo:** o clique duplo e o segundo envio do mesmo quadro (a referência `noAr`, e não o botão desligado) têm caso de unidade; a resposta atrasada com o diálogo já fechado e o `CONFLITO` com o convite que outra pessoa revogou têm caso de e2e: a resposta atrasada é segurada por `page.route`, e a revogação é feita direto no banco (`revogarConvite`), sem segunda aba; os casos não olham o dia da semana.
11. **Isolamento e "Caso":** é tarefa de tela, sem repository; o isolamento é da 18.0. Cada linha da tabela de testes tem o caso na coluna, e as que dizem duas coisas (o texto e o foco; a lista relida e o foco) citam um caso para cada.
12. **O que os guardiões pedem:** `frontend-reviewer` (quatro estados, 360 px, 44 px nas ações principais, foco, `inputmode` e `autocomplete` certos, texto que diz o que fazer): as fotos do script avulso e o caso de medida; `privacy-guardian` (o link e o e-mail novo fora do cache, da URL, do armazenamento e do log; e-mail de hoje nunca na tela): casos do cache de mutações e do endereço; `test-engineer` (mutações, caso por linha, recomeço). `conformidade-reviewer` (D64, regra 70 item 9): o `achados/indice.md` traz, na 18.0 (rodadas 1 e 2), a recomendação de a tela do "Corrigir o e-mail" falar da conta e do convite, sem contagem, destaque nem filtro de "professor que não usa" e sem estado de uso da IA; o diff desta tarefa acrescenta um botão por professor `pendente` ou `vencido` e um diálogo, e **nenhuma contagem, filtro, ordenação ou destaque novo na lista**; os dois casos do D64 do diálogo guardam o texto. Do `achados/indice.md` li também as linhas da 12.0 (a senha fora do navegador, só em teste de unidade: aqui o cache de mutações é lido em unidade, no caso do link) e a da 3.0 (o estado do convite e do envio é só informação operacional de entrega; a conformidade da 3.0 já pedia isso à tela).

## Fora do escopo desta tarefa

A rota (18.0). Mostrar o e-mail de hoje. Corrigir o e-mail de quem já entrou.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|
| O diálogo, no `CONFLITO` com o estado mudado e no `NAO_ENCONTRADO`, **não fecha sozinho**: mostra o texto do convite que mudou, com a lista já relida, e fica só com "Fechar" (sem o campo nem o botão), que devolve o foco ao painel. A linha dizia "o diálogo fecha". O anúncio verde do painel é de sucesso e não serve para erro, e fechar sozinho engoliria o texto | desenho | `cenarios.md`, "Telas", linha "Corrigir o e-mail" (`o diálogo fica só com "Fechar" (sem o campo nem o botão)`); `techspec.md` §9, Frontend, o trecho do "Corrigir o e-mail" (`só com "Fechar" (como o do refazer)`, `o foco volta ao painel`) |
| A falha de rede e as de resto mostram o aviso do catálogo **com o foco nele** (o `FailureAlert` do refazer), o botão passa a "Tentar de novo" e a tentativa seguinte apaga o aviso. A linha dizia só `rede: "Tentar de novo"` | desenho | `cenarios.md`, "Telas", linha "Corrigir o e-mail" (`rede: o aviso do catálogo com o foco nele, e o botão passa a "Tentar de novo"`); `techspec.md` §9, Frontend (`o aviso do catálogo com o foco nele, o botão passa a "Tentar de novo"`) |
| Fechar com o link na tela e sem cópia **pergunta antes**, com "Voltar ao e-mail" e "Fechar sem copiar" (a peça `CloseConfirmation` do refazer); a linha dizia só "fechar sai do link". O pedido ainda no ar também pergunta | desenho | `cenarios.md`, "Telas", linha "Corrigir o e-mail" (`fechar com o link sem copiar pergunta antes ("Voltar ao e-mail" ou "Fechar sem copiar"), como o refazer`); `techspec.md` §9, Frontend (`pergunta antes ("Voltar ao e-mail" ou "Fechar sem copiar"), como o refazer`) |

## Mutações

**`--faltando`:** 1 linhas (43 blocos, 3 motivos). A linha que sobra é a do rodapé do painel (motivo 1); os blocos foram rodados com o `aplicarMutacao` e a corrida do portão (`conferirMutacoesDoDocumento`), todos vermelhos (os dois últimos, da releitura da lista no `CONFLITO` e no `NAO_ENCONTRADO`, entraram na ordem da rodada 1). Na primeira corrida cinco ficaram verdes e os testes foram apertados: o botão que envia some também com o nome "Tentar de novo" (`NAO_ENCONTRADO`); a ausência de alerta e de erro no campo antes de qualquer pedido; o `CONFLITO` em aberto é provado no caso do campo, e não no do "resto"; o rodapé do painel com o "Acrescentar turma" à vista e sem "Corrigir o e-mail" (professor `ativo`); e o campo e o link que não ficam ao lado da pergunta de fechar.

**Sem bloco, por motivo:**
1. O `!corrigirOEmail` do `acoes.length === 0 && !corrigirOEmail && !podeAcrescentar` do rodapé do painel é mutante equivalente: `corrigirOEmail` e `acoes` saem da mesma matriz de estados (`pendente` e `vencido` corrigem o e-mail e refazem e revogam o convite), e quem tem `corrigirOEmail` tem `acoes.length > 0`. O botão em si tem blocos (a constante, a condição do JSX e o caso do `ativo` com o rodapé à vista).
2. O `corrigir.data !== undefined` da etapa do link só estreita o tipo para o TypeScript: `etapa === 'link'` vale só com `corrigir.isSuccess`, e aí `data` já existe. O termo `etapa === 'link'` do mesmo `&&` tem bloco.
3. O `estadoAgora !== undefined &&` de `falhaDaCorrecaoDoEmail` também só estreita o tipo: `podeCorrigirOEmail(undefined)` é falso (a matriz não tem a chave). O caso do professor que saiu da lista (`estadoAgora` `undefined`) está no caso `it.each` do diálogo, e o termo `podeCorrigirOEmail(estadoAgora)` e a lista de códigos têm bloco.

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx
teste: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.test.tsx › fechar com o link sem copiar pergunta antes
-  return correcao.isPending || (correcao.isSuccess && !copiado)
+  return correcao.isPending
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx
teste: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.test.tsx › fechar com o pedido no ar pergunta antes
-  return correcao.isPending || (correcao.isSuccess && !copiado)
+  return correcao.isSuccess && !copiado
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx
teste: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.test.tsx › fechar com o link sem copiar pergunta antes
-  if (perguntando) return 'pergunta'
   return aceito ? 'link' : 'campo'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx
teste: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.test.tsx › diz "E-mail corrigido"
   if (perguntando) return 'pergunta'
-  return aceito ? 'link' : 'campo'
+  return 'campo'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx
teste: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.test.tsx › fechar com o pedido no ar pergunta antes
-  return pedidoNoAr ? TEXTO_DA_PERGUNTA_COM_O_PEDIDO_NO_AR : TEXTO_DA_PERGUNTA_COM_O_LINK
+  return TEXTO_DA_PERGUNTA_COM_O_LINK
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx
teste: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.test.tsx › e-mail fora do formato
     if (validacao.ok) aoValidar(validacao.pedido)
-    else definirErro(validacao.erro)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx
teste: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.test.tsx › sai com o e-mail sem as pontas
-    if (validacao.ok) aoValidar(validacao.pedido)
+    if (!validacao.ok) aoValidar(validacao.pedido)
     else definirErro(validacao.erro)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx
teste: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.test.tsx › `CONFLITO` com o professor ainda esperando o convite
-    if (doCampo) campo.current?.focus()
+    if (doCampo) campo.current?.blur()
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx
teste: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.test.tsx › `NAO_ENCONTRADO`: o texto do convite que não vale
-      {!soFechar && (
+      {true && (
         <Button type="submit" disabled={pendente}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx
teste: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.test.tsx › `NAO_ENCONTRADO`: o texto do convite que não vale
-      {!soFechar && (
+      {true && (
         <FormField
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx
teste: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.test.tsx › `NAO_ENCONTRADO`: o texto do convite que não vale
-        {soFechar ? 'Fechar' : 'Cancelar'}
+        {'Cancelar'}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx
teste: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.test.tsx › a rede: o aviso diz o que fazer
-          {pendente ? 'Corrigindo…' : tentarDeNovo ? 'Tentar de novo' : 'Corrigir o e-mail'}
+          {pendente ? 'Corrigindo…' : 'Corrigir o e-mail'}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx
teste: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.test.tsx › `CONFLITO` com o professor ainda esperando o convite
-  const avisoFora = falha !== undefined && !doCampo
+  const avisoFora = falha !== undefined
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx
teste: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.test.tsx › `CONFLITO` com o professor ainda esperando o convite
-          erro={digitado.erro ?? (doCampo ? falha.texto : undefined)}
+          erro={digitado.erro}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx
teste: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.test.tsx › e-mail fora do formato
-          erro={digitado.erro ?? (doCampo ? falha.texto : undefined)}
+          erro={doCampo ? falha.texto : undefined}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx
teste: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.test.tsx › a rede: o aviso diz o que fazer
-      {avisoFora && <FailureAlert texto={falha.texto} erro={erro} />}
+      {false && <FailureAlert texto={falha.texto} erro={erro} />}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx
teste: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.test.tsx › com o pedido no ar o botão fica ocupado
-        {pendente ? 'Corrigindo o e-mail…' : ''}
+        {''}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx
teste: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.test.tsx › diz "E-mail corrigido"
-        {email !== undefined && (
+        {false && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx
teste: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.test.tsx › abre com o campo vazio
-  const falha = corrigir.isError ? falhaDaCorrecaoDoEmail(corrigir.error, estadoAgora) : undefined
+  const falha = falhaDaCorrecaoDoEmail(corrigir.error, estadoAgora)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx
teste: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.test.tsx › o segundo envio que chega antes de a tela desligar o botão
-    if (noAr.current) return
     noAr.current = true
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx
teste: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.test.tsx › a rede: o aviso diz o que fazer
-    corrigir.mutate(pedido, { onSettled: () => (noAr.current = false) })
+    corrigir.mutate(pedido)
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx
teste: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.test.tsx › "Enviar por e-mail" entrega a tela ao "Reenviar"
   function enviarPorEmail(): void {
-    corrigir.reset()
     aoEnviarPorEmail()
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx
teste: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.test.tsx › fechar com o link sem copiar pergunta antes
-      {etapa === 'pergunta' && (
+      {false && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/convite-de-professor.ts
teste: apps/web/src/areas/coordenacao/professores/convite-de-professor.test.ts › só o convite em aberto, pendente ou vencido, tem o botão
-  return CORRIGIR_EMAIL_DO_PROFESSOR_POR_ESTADO[estado] === 'corrigir'
+  return CORRIGIR_EMAIL_DO_PROFESSOR_POR_ESTADO[estado] === 'corrigir' || estado === 'revogado'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/convite-de-professor.ts
teste: apps/web/src/areas/coordenacao/professores/convite-de-professor.test.ts › o pedido sai pelo contrato estrito
-  return lido.success ? { ok: true, pedido: lido.data } : { ok: false, erro: TEXTO_DO_EMAIL_INVALIDO }
+  return { ok: true, pedido: { email } }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/convite-de-professor.ts
teste: apps/web/src/areas/coordenacao/professores/convite-de-professor.test.ts › `CONFLITO` com o estado mudado, ou o professor fora da lista
-  if (listChanged(erro, [ErrorCode.CONFLITO]) && estadoAgora !== undefined && podeCorrigirOEmail(estadoAgora)) {
+  if (listChanged(erro, [ErrorCode.CONFLITO]) && estadoAgora !== undefined) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/convite-de-professor.ts
teste: apps/web/src/areas/coordenacao/professores/convite-de-professor.test.ts › `CONFLITO` com o estado mudado, ou o professor fora da lista
-  if (listChanged(erro, [ErrorCode.CONFLITO]) && estadoAgora !== undefined && podeCorrigirOEmail(estadoAgora)) {
+  if (listChanged(erro, [ErrorCode.CONFLITO, ErrorCode.NAO_ENCONTRADO]) && estadoAgora !== undefined && podeCorrigirOEmail(estadoAgora)) {
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/convite-de-professor.ts
teste: apps/web/src/areas/coordenacao/professores/convite-de-professor.test.ts › `CONFLITO` com o professor ainda em aberto na lista relida é do campo do e-mail
-    return { texto: TEXTO_DO_EMAIL_QUE_NAO_SERVE, listaMudou: false, doCampo: true }
+    return { texto: TEXTO_DO_EMAIL_QUE_NAO_SERVE, listaMudou: false, doCampo: false }
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/envio-do-convite.ts
teste: apps/web/src/areas/coordenacao/professores/envio-do-convite.test.ts
-export const TEXTO_DO_ENVIO_QUE_FALHOU = 'Não chegou. Corrija o e-mail e reenvie, ou copie o link'
+export const TEXTO_DO_ENVIO_QUE_FALHOU = 'Confira o e-mail e reenvie'
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/api/professores.ts
teste: apps/web/src/areas/coordenacao/professores/api/professores.test.ts › vai à rota do professor
-  return authedRequest(`${CAMINHO_DOS_PROFESSORES}/${encodeURIComponent(usuarioId)}/email`, conviteDeProfessorResponseSchema, { metodo: 'POST', corpo: pedido })
+  return authedRequest(`${CAMINHO_DOS_PROFESSORES}/${encodeURIComponent(usuarioId)}/convite/refazer`, conviteDeProfessorResponseSchema, { metodo: 'POST', corpo: pedido })
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/api/professores.ts
teste: apps/web/src/areas/coordenacao/professores/api/professores.test.ts › o link e o e-mail novo saem do cache de mutações
     mutationFn: (pedido: CorrigirEmailDoProfessorRequest) => corrigirEmailDoProfessor(usuarioId, pedido),
-    gcTime: 0,
     ...(aoTerminar === undefined ? {} : { onSettled: aoTerminar }),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/api/professores.ts
teste: apps/web/src/areas/coordenacao/professores/api/professores.test.ts › o link e o e-mail novo saem do cache de mutações
     mutationFn: (pedido: CorrigirEmailDoProfessorRequest) => corrigirEmailDoProfessor(usuarioId, pedido),
     gcTime: 0,
-    ...(aoTerminar === undefined ? {} : { onSettled: aoTerminar }),
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/PainelDoProfessor.tsx
teste: apps/web/src/areas/coordenacao/professores/PainelDoProfessor.test.tsx › o botão é secundário e só existe no convite em aberto
-  const corrigirOEmail = podeCorrigirOEmail(professor.estado)
+  const corrigirOEmail = true
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/PainelDoProfessor.tsx
teste: apps/web/src/areas/coordenacao/professores/PainelDoProfessor.test.tsx › no professor `ativo`, com o rodapé do "Acrescentar turma" à vista
-            {corrigirOEmail && (
+            {true && (
               <Button variante="secundario" onClick={aoCorrigirEmail}>
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/Professores.tsx
teste: apps/web/src/areas/coordenacao/professores/PainelDoProfessor.test.tsx › abre o diálogo por cima do painel
-      {aberta?.tipo === 'corrigir_email' && alvo !== undefined && (
+      {false && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/Professores.tsx
teste: apps/web/src/areas/coordenacao/professores/PainelDoProfessor.test.tsx › `CONFLITO` com o professor que saiu de `pendente` e `vencido`
-          estadoAgora={alvoAgora?.estado}
+          estadoAgora={alvo.estado}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/Professores.tsx
teste: apps/web/src/areas/coordenacao/professores/PainelDoProfessor.test.tsx › "Enviar por e-mail" troca o diálogo pelo do "Reenviar"
-          aoEnviarPorEmail={() => abrir('reenviar', alvo)}
+          aoEnviarPorEmail={fechar}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/Professores.tsx
teste: apps/web/src/areas/coordenacao/professores/PainelDoProfessor.test.tsx › aceito: a lista é relida
-          mutacao={mutacaoDaCorrecaoDoEmail(alvo.usuarioId, recarregar)}
+          mutacao={mutacaoDaCorrecaoDoEmail(alvo.usuarioId)}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/Professores.tsx
teste: apps/web/src/areas/coordenacao/professores/PainelDoProfessor.test.tsx › abre o diálogo por cima do painel
-          aoCorrigirEmail={() => abrir('corrigir_email', doPainel)}
+          aoCorrigirEmail={() => undefined}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx
teste: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.test.tsx › fechar com o link sem copiar pergunta antes
-      {etapa === 'link' && corrigir.data !== undefined && (
+      {corrigir.data !== undefined && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx
teste: apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.test.tsx › diz "E-mail corrigido"
-      {etapa === 'campo' && (
+      {true && (
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/Professores.tsx
teste: apps/web/src/areas/coordenacao/professores/PainelDoProfessor.test.tsx › `CONFLITO` com o professor ainda `pendente` na lista relida
-          mutacao={mutacaoDaCorrecaoDoEmail(alvo.usuarioId, recarregar)}
+          mutacao={mutacaoDaCorrecaoDoEmail(alvo.usuarioId)}
```

```mutacao
arquivo: apps/web/src/areas/coordenacao/professores/Professores.tsx
teste: apps/web/src/areas/coordenacao/professores/PainelDoProfessor.test.tsx › o texto do convite que não vale, a lista relida sem ele
-          mutacao={mutacaoDaCorrecaoDoEmail(alvo.usuarioId, recarregar)}
+          mutacao={mutacaoDaCorrecaoDoEmail(alvo.usuarioId)}
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| tenancy-guardian (1ª), conformidade-reviewer (2ª), privacy-guardian (2ª) da 18.0 | "Decidir na 19.0 se o e-mail de um coordenador da mesma escola deve ser `CONFLITO`" (a resposta, se mudar, não revela quem é o dono do e-mail, E11) | Não decidido aqui: muda o contrato da rota, que é da 18.0 (esta tarefa é a tela, "Fora do escopo"). Destino: `TODO.md`, o mesmo item, com o dono trocado para o Joaquim, na validação do F2c. A tela já serve aos dois lados (mesmo código e mesmo texto) |
| conformidade-reviewer (1ª e 2ª) da 18.0 | A tela do "Corrigir o e-mail" fala da conta e do convite, sem contagem, destaque nem filtro de "professor que não usa" (D64, regra 70, item 9) | **Atendida nesta tarefa**, não é "sem aplicar": o diálogo e o botão não acrescentam contagem, filtro nem destaque à lista, e dois casos de `DialogoDeCorrigirEmail.test.tsx` guardam o texto (tabela de testes, linha "texto da tela (D64)") |
| revisor-geral (1ª) | `DialogoDeCorrigirEmail.tsx:125`: o texto do e-mail que não serve continua no campo enquanto a pessoa digita outro; só sai no envio seguinte | Muda comportamento e pede linha no `cenarios.md` (a linha "Corrigir o e-mail" de "Telas" não diz quando o texto sai). Destino: `TODO.md`, decisão de desenho na validação do F2c |
| revisor-geral (1ª), infra-guardian (1ª) | A fatia 1 do e2e está no teto (27 de 27) e a tarefa acrescenta quatro casos | Fora do portão (D52): a esteira mostra. Destino: o Orquestrador olha `tools/ci/prazo-do-e2e.ts` na primeira esteira depois do pouso (`docs/runbook.md`, "Esteira vermelha no e2e"); o "Como testar" do documento já avisa |
| infra-guardian (1ª) | "Enviar por e-mail" leva ao "Reenviar", que refaz o convite: a correção seguida de envio gasta dois tokens e duas gravações | Não pesa (ação rara da coordenação, fora da sala) e mudar é mudar o contrato do envio. Destino: retrospectiva do F2c (`/retro`) |
| frontend-reviewer (1ª) | No celular, o rodapé do painel empilha quatro botões alinhados à direita, com larguras diferentes | O rodapé é o do `Sheet`, componente compartilhado (`apps/web/src/components/ui/`), e o quarto botão só entrou na pilha que já existia. Destino: `TODO.md`, tarefa visual do `Sheet` |
| frontend-reviewer (1ª), privacy-guardian (1ª) | Faltam fotos do estado `falhou` do painel e das etapas com digitação | A vitrine não digita. Destino: o Validador fotografa cada requisito com tela no fim da spec; os casos de unidade e de e2e cobrem os textos (as fotos do script avulso estão em `.processo/vitrine/corrigir--*.png`, locais) |
| test-engineer (1ª) | `PainelDoProfessor.test.tsx:94`: o `not.toMatch(/@/)` no `body` é fraco, porque as fixtures não têm e-mail | Recusada pelo próprio revisor ("Pode ficar"): a prova do "e-mail de hoje" é a do contrato (E8) e a do diálogo |
| revisor-geral (2ª) | `TODO.md:2835`: o registro do `privacy-guardian` termina em "Decidir junto com o e-mail de coordenador", sem ponto e sem dizer o que se decide; fechar a frase ("… se o `CONFLITO` muda") | Só prosa de `TODO.md`, e o item é o do e-mail de coordenador, que o Joaquim fecha na validação do F2c: quem o fechar lê e completa a frase. Sem rodada nova só para isto |
| revisor-geral (2ª) | `PainelDoProfessor.test.tsx:108`, `:123` e `:136`: o `vezes(...) > leiturasAntes` prova que houve releitura depois do envio, mas não de onde ela veio; com o envio em curso (`na_fila` ou `enviando`) a releitura de 5 s pode deixar o caso verde sem o `onSettled` | Recusada como ordem: hoje está provado (os dois blocos de mutação novos, `mutacaoDaCorrecaoDoEmail(alvo.usuarioId)` sem `recarregar`, saem vermelhos) e os casos usam o envio `falhou`, que não relê. Vale para quem montar caso novo com envio em curso |
| test-engineer (2ª) | `PainelDoProfessor.test.tsx:663`, caso "Enviar por e-mail": `corrigirComOEmail` é chamado sem a rede, e `leiturasAntes` vale 0 sem ser usado; tornar o parâmetro obrigatório, ou devolver `undefined` sem a rede, evita que um caso futuro compare com esse 0 | Muda arquivo de teste e caduca `test-engineer` e `revisor-geral`: um ciclo só para isto, e é inofensivo hoje. Destino: `TODO.md`, dono: quem tocar `PainelDoProfessor.test.tsx` na próxima tarefa de Professores |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-10 15:47:00 | 2026-11-10 15:47:29 | `tenancy-guardian` | 1 | APROVADO | a6689fce36cfc7bb7 |
| 2026-11-10 15:47:07 | 2026-11-10 15:47:39 | `conformidade-reviewer` | 1 | APROVADO | a9e418c53d3eb182a |
| 2026-11-10 15:46:42 | 2026-11-10 15:47:39 | `privacy-guardian` | 1 | APROVADO | ab29b8ac03d187fd3 |
| 2026-11-10 15:46:35 | 2026-11-10 15:47:40 | `frontend-reviewer` | 1 | APROVADO | a76fcdf108165c8f2 |
| 2026-11-10 15:47:14 | 2026-11-10 15:48:09 | `infra-guardian` | 1 | APROVADO | a6845dd7ebe66bf68 |
| 2026-11-10 15:46:53 | 2026-11-10 15:48:13 | `revisor-geral` | 1 | APROVADO | aca92b959599c157d |
| 2026-11-10 15:46:49 | 2026-11-10 15:49:30 | `test-engineer` | 1 | REPROVADO | a2407cd46b03a1aea |
| 2026-11-10 16:10:55 | 2026-11-10 16:11:23 | `revisor-geral` | 2 | APROVADO | a2ad5aa6d2178d3da |
| 2026-11-10 16:10:48 | 2026-11-10 16:11:31 | `test-engineer` | 2 | APROVADO | a1556f09066dacd3a |
