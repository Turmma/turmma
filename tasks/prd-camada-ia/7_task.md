# Tarefa 7.0 — A Operação define o orçamento de IA num diálogo, vendo o antes e o depois

**Funcionalidade:** camada-ia · **Depende de:** 3.0
**Subagentes obrigatórios:** `frontend-reviewer`
**Porte:** pequeno

## Objetivo

Na aba Escolas da Operação, a rede e a escola ganham a ação "Orçamento de IA". O diálogo mostra o que vale hoje e, antes
de "Salvar orçamento", o antes e o depois; na rede, quantas escolas mudam. É o diálogo que a 8.0 abre de "Definir orçamento".

## Contexto necessário

- `techspec.md` §4 (os dois `PUT` e as `GET` estendidas), §9 ("Operação, Escolas")
- `prd.md` RF7
- `cenarios.md` §4 ("Operação, diálogo 'Orçamento de IA'", erro, celular e acessibilidade)
- `.claude/rules/50-frontend.md`, `docs/interface.md` §5a
- Código: `apps/web/src/operacao/pages/Escolas.tsx` (`useDialogState`, as ações por linha), `apps/web/src/operacao/components/DialogoDoConvite.tsx`
  e `DialogoDaOperacao.tsx`, `apps/web/src/operacao/api/painel.ts`, `apps/web/src/operacao/pedidos-do-painel.ts` (o 429)

## Subtarefas

- [x] 7.1 — `apps/web/src/operacao/components/DialogoDoOrcamento.tsx`: os dois campos, "Usar o valor da rede", "Vale hoje",
  a confirmação com antes e depois e, na rede, "Muda o orçamento de N escolas…"
- [x] 7.2 — A ação na linha da rede e na da escola (tabela e cartão do celular); a mutação invalida as listas de redes, escolas e uso
- [x] 7.3 — Os erros: fora do intervalo no campo, `role=alert` e `aria-describedby`; o 429 com os minutos
- [x] 7.4 — `docs/interface.md` §5a (Escolas), com os textos da `cenarios.md` §4
- [x] 7.5 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/operacao/components/DialogoDoOrcamento.tsx`, `apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx` | novo |
| `apps/web/src/operacao/pages/Escolas.tsx`, `apps/web/src/operacao/pages/Escolas.test.tsx` | alterado |
| `apps/web/src/operacao/api/painel.ts`, `apps/web/src/operacao/api/painel.test.ts`, `apps/web/src/operacao/textos.ts` | alterado |
| `apps/web/src/operacao/pedidos-do-painel.ts`, `apps/web/src/operacao/pedidos-do-painel.test.ts`, `apps/web/src/operacao/textos.test.ts` | alterado (o pedido do orçamento, que lê o mesmo contrato estrito da API, e os textos do diálogo) |
| `apps/web/src/operacao/__fixtures__/render-operacao-screen.tsx` | alterado (a rede e a escola de teste com orçamento) |
| `e2e/operacao-escolas.spec.ts`, `e2e/operacao-convite-coordenacao.spec.ts` | alterado (o segundo conta os botões da linha, que ganhou os dois "Orçamento de IA") |
| `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| cada campo com o seu rótulo: "Valor por aluno por mês (R$)", "Teto de segurança (% do orçamento)", "Usar o valor da rede" | U | rótulo por campo | `DialogoDoOrcamento.test.tsx` › "cada campo tem o seu rótulo, e a escola sem valor próprio abre com" |
| "Vale hoje: R$ 5,00 por aluno, da rede." | U | o vigente | `DialogoDoOrcamento.test.tsx` › ""Vale hoje" diz o valor e de quem ele é"; `textos.test.ts` › ""Vale hoje" diz o valor e de quem ele é" |
| antes de salvar: "Antes: R$ 5,00 por aluno, teto 200%. Depois: R$ 4,00 por aluno, teto 200%." | U | a confirmação do efeito | `DialogoDoOrcamento.test.tsx` › "vê o antes e o depois, e o botão a descreve" |
| na rede: "Muda o orçamento de 3 escolas que usam o valor da rede." | U | `escolasQueUsamOValorDaRede` | `DialogoDoOrcamento.test.tsx` › "na rede, "Muda o orçamento de 3 escolas que usam o valor da rede." junto do antes e depois" |
| "Usar o valor da rede" manda `null` | U | a volta à rede | `DialogoDoOrcamento.test.tsx` › ""Usar o valor da rede" manda null no valor" |
| R$ 0,00, R$ 100,01, 99% e 1001%: "Use um valor entre R$ 0,01 e R$ 100,00." / "Use de 100% a 1000%.", com `aria-describedby` e `role=alert`, sem chamar a API; R$ 0,01, R$ 100,00, 100 e 1000 passam | U | os limites e o anúncio | `DialogoDoOrcamento.test.tsx` › "o texto do intervalo no campo, anunciado", "no campo do teto, anunciado" e "passa: o pedido sai com os dois campos"; `pedidos-do-painel.test.ts` › "R$ 0,00, R$ 100,01, texto e mais de duas casas" |
| "Orçamento salvo."; invalida redes, escolas e uso | U | o resultado e o cache | `DialogoDoOrcamento.test.tsx` › ""Orçamento salvo": avisa a tela uma vez"; `Escolas.test.tsx` › "salvar o orçamento da rede fecha o diálogo, anuncia "Orçamento salvo."" e "o `PUT` que responde depois de o diálogo fechar, com outro aberto" |
| dois cliques em "Salvar orçamento": um `PUT` só | U | o clique duplo | `DialogoDoOrcamento.test.tsx` › "dois envios seguidos, antes de a tela mostrar o primeiro" e "o clique duplo no botão também é um" |
| o 429 diz em quantos minutos tentar de novo | U | o limitador | `DialogoDoOrcamento.test.tsx` › "o 429 diz em quantos minutos tentar de novo" |
| carregando; erro "Não foi possível carregar. Tentar de novo"; resposta fora do contrato: "Atualize a página" | U | os estados e a volta do código | `DialogoDoOrcamento.test.tsx` › "carregando: o texto do carregamento", "erro: "Não foi possível carregar." com" e "resposta fora do contrato: "Atualize a página""; `painel.test.ts` › "a resposta do `PUT` fora do contrato sobe como" |
| só com Tab e Enter: abre, preenche, confirma; `Esc` fecha; o foco fica preso no diálogo e volta a quem abriu | E2E | acessibilidade | `operacao-escolas.spec.ts` › "a rede: abre pelo teclado, com o foco preso no diálogo" e "a rede: mostra o antes e o depois, salva só com Tab e Enter" |
| a 360 px, sem rolagem horizontal; "Salvar orçamento" com 44 px; alvo de 24 px nos campos e na caixa; nada só por hover | E2E | celular | `operacao-escolas.spec.ts` › "o erro de cada campo fica no campo, anunciado, sem ir à API", no projeto `celular` |

## Como testar

- Diálogo com foco preso: `e2e/operacao-escolas.spec.ts` › "W8: criar rede e escola só com Tab e Enter, com o foco preso
  no diálogo e devolvido a quem o abriu"
- Estados: `apps/web/src/operacao/pages/Escolas.test.tsx` › "o 503 mostra a mensagem e a tela fica…" e › "no celular, a
  lista de cartões diz o mesmo texto e oferece as mesmas ações, sem tabela"
- Montagem: `apps/web/src/operacao/__fixtures__/render-operacao-screen.tsx`
- `npx vitest run --project unidade apps/web/src/operacao/` e `npx playwright test e2e/operacao-escolas.spec.ts`
- **Telas:** papel operador (o perfil Operação do roteiro), `/operacao` (`OPERACAO_ROUTES.inicio`, Escolas): clicar em
  "Orçamento de IA" numa rede e numa escola, até a confirmação; sem mockup

## Fora do escopo desta tarefa

A aba Uso (8.0); a API (3.0).

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano antes de codar.

1. **Mutação de cada cláusula.** Cada condição, cada termo de `&&`/`||`, cada ternário e cada guarda do diff tem bloco na seção "Mutações"
   (71 blocos; o `--faltando` sai vazio). Entram também o `find` da rede alvo na lista (dois casos com duas redes, o alvo na segunda), o `daRede` do que está
   gravado (nos dois valores) e o `forDoContrato` (nos dois valores). Entram também o que ele não vê: o `if (noAr.current) return` (o clique duplo, que o botão
   desligado não segura), o `if (!validacao.ok) return`, o foco que vai ao primeiro campo quando a lista de redes chega com o diálogo
   aberto, o `aria-describedby` do botão, a mensagem de "Salvando…" para o leitor de tela, o `lidoPeloContrato` e a rota de cada `PUT`.
   As três invalidações (`ESCOLAS_QUERY_KEY`, `REDES_QUERY_KEY` e `USO_QUERY_KEY`, no `onSuccess` de `useSalvarOrcamento`) são provadas pela contagem
   de leituras de cada lista antes e depois do `PUT`, no caso "Orçamento salvo". O número (R$ 0,01 e R$ 100,00, 100% e 1000%) é provado nos dois lados
   da fronteira, e o caso troca a constante, não tira o critério.
2. **O texto novo já aparece na tela?** `grep -rln 'Orçamento de IA' e2e/`: só `operacao-escolas.spec.ts` e `operacao-convite-coordenacao.spec.ts`.
   O segundo contava os botões da linha (1 em "Sem convite", 0 na escola Ativa) e passou a 3 e 2 (o "Convidar" e os dois "Orçamento de IA"); rodei os
   quatro specs da operação isolados. **Efeito no Nova escola:** a lista de redes (`dasRedesQueryOptions`) passou a ser lida pelo `lidoPeloContrato`,
   e o diálogo Nova escola (`NovaEscola.tsx`, que mostra o erro da lista pelo `textoDaFalha`) passa a dizer "Atualize a página" quando a lista vem fora do
   contrato; o caso é o `painel.test.ts` › "a lista de redes fora do contrato sobe como `RespostaForaDoContrato`".
3. **O segundo dado que torna a cláusula observável.** A escola tem caso com valor próprio **e** sem ele; a rede, com valor e sem valor, com 0, 1 e 3 escolas
   que usam o valor dela, e com o teto mudando sozinho (o valor igual), que é o que separa os dois termos de `mudaOVigente`.
4. **Alguma checagem responde antes?** A tela lê a lista de redes antes do formulário: o caso monta a rede com o orçamento que o `PUT` e o diálogo vão ler, e o
   `PUT` falso devolve o contrato de verdade. O dublê do 429 é o `ApiError` que `operadorAuthedRequest` lança, com `Retry-After`.
5. **A asserção olha o resultado.** Tudo é texto e atributo da tela e o corpo do `PUT`; a ausência ("sem `Muda o orçamento`", "sem alerta") só vale depois do
   positivo da mesma cena (o "Depois" que apareceu), e os blocos de ausência levam `falha:`.
6. **Guarda nova.** Nenhuma regra de lint nem teste estrutural novos.
7. **Comentário que diz mais que o código.** Os comentários dizem o que o código faz; o foco só vai ao campo quando o diálogo já está aberto (senão o
   `quemAbriu` do `useModalDialog` seria o campo e o foco não voltaria ao botão), e o caso do foco devolvido prova os dois lados. `docs/interface.md` §5a
   traz os textos da tela, e cada um está num caso da tabela.
8. **Divergência.** Nenhuma: os dois `PUT` e as duas `GET` são os da 3.0, e o texto da ajuda do teto é o da recomendação do `frontend-reviewer` (7.1).
9. **Peça que já existe.** `Dialog` e `DialogoDaOperacao`, `useDialogState`, `FormField`, `LoadingState`, `Button` e `SECONDARY_BUTTON_CLASSES`,
   `operadorAuthedRequest`, `textoDaFalha` (o 429), as contas de `@educa/shared` (`orcamentoDaEscolaNoPainel`, `orcamentoDaRedeNoPainel`,
   `centavosParaMicros`, os limites) e `formatNumber`. A tela não tem conta de "vigente" própria.
10. **Duas vezes ao mesmo tempo.** Dois `submit` seguidos e um clique duplo mandam **um** `PUT`: a trava `noAr` (ref) segura o segundo antes de a tela desligar o
    botão, e o `PUT` é idempotente (a API grava e audita só quando difere). A resposta do `PUT` que chega depois de o diálogo fechar só anuncia e fecha a abertura
    dela (`closeSeAinda`).
11. **Isolamento e "Caso".** Não há repository nem rota nova: o escopo é da 3.0 (`PUT` por id, com o operador). Cada linha da tabela de testes tem o caso na
    coluna "Caso", e as que dizem duas coisas têm dois (os limites do valor e os do teto; "salva" e "invalida").
12. **Guardiões.** `frontend-reviewer`: os quatro estados, o alvo de 44 px no "Salvar orçamento" e de 24 px nos campos e na caixa, o erro anunciado e ligado ao
    campo, o antes e o depois antes de confirmar (regra 50, itens 2a, 5, 8 e 11) e a frase de ajuda do teto. `achados/indice.md`: sem linha sobre a 7.0.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

Cada bloco tira uma cláusula, ou um termo de uma linha com vários, e o teste citado tem de ficar vermelho (`apps/web/src/operacao/`).
As guardas `aberta === undefined` e `escola === undefined` de `OrcamentoAberto` (`Escolas.tsx`) são só de tipo: sem diálogo aberto, `aberta?.alvo` já é `undefined`, e o alvo só falta nos diálogos Nova rede e Nova escola, que o `isOrcamento` já deixa de fora.

```mutacao
arquivo: apps/web/src/operacao/api/painel.ts
teste: apps/web/src/operacao/api/painel.test.ts › fora do contrato sobe como
-      if (!lido.success) throw new RespostaForaDoContrato()
```

```mutacao
arquivo: apps/web/src/operacao/api/painel.ts
teste: apps/web/src/operacao/api/painel.test.ts › vão cada um à sua rota
-  const base = alvo.tipo === 'rede' ? CAMINHO_DAS_REDES : CAMINHO_DAS_ESCOLAS
+  const base = alvo.tipo === 'rede' ? CAMINHO_DAS_ESCOLAS : CAMINHO_DAS_REDES
```

```mutacao
arquivo: apps/web/src/operacao/api/painel.ts
teste: apps/web/src/operacao/api/painel.test.ts › vão cada um à sua rota
-  return operadorAuthedRequest(`${base}/${encodeURIComponent(alvo.id)}/orcamento-ia`, lidoPeloContrato(orcamentoDeIaDoPainelSchema), { metodo: 'PUT', corpo: pedido })
+  return operadorAuthedRequest(`${base}/${encodeURIComponent(alvo.id)}/orcamento`, lidoPeloContrato(orcamentoDeIaDoPainelSchema), { metodo: 'PUT', corpo: pedido })
```

```mutacao
arquivo: apps/web/src/operacao/pedidos-do-painel.ts
teste: apps/web/src/operacao/pedidos-do-painel.test.ts › mais de duas casas
-const FORMATO_DO_VALOR_EM_REAIS = /^\d+(?:[.,]\d{1,2})?$/
+const FORMATO_DO_VALOR_EM_REAIS = /^\d+(?:[.,]\d{1,3})?$/
```

```mutacao
arquivo: apps/web/src/operacao/pedidos-do-painel.ts
teste: apps/web/src/operacao/pedidos-do-painel.test.ts › mais de duas casas
-const FORMATO_DO_TETO_EM_PERCENTUAL = /^\d+$/
+const FORMATO_DO_TETO_EM_PERCENTUAL = /^\w+$/
```

```mutacao
arquivo: apps/web/src/operacao/pedidos-do-painel.ts
teste: apps/web/src/operacao/pedidos-do-painel.test.ts › sem valor
-  const centavos = campos.semValor ? null : FORMATO_DO_VALOR_EM_REAIS.test(valor) ? Math.round(Number(valor.replace(',', '.')) * 100) : Number.NaN
+  const centavos = FORMATO_DO_VALOR_EM_REAIS.test(valor) ? Math.round(Number(valor.replace(',', '.')) * 100) : Number.NaN
```

```mutacao
arquivo: apps/web/src/operacao/pedidos-do-painel.ts
teste: apps/web/src/operacao/pedidos-do-painel.test.ts › o valor em reais vira centavos
-  const centavos = campos.semValor ? null : FORMATO_DO_VALOR_EM_REAIS.test(valor) ? Math.round(Number(valor.replace(',', '.')) * 100) : Number.NaN
+  const centavos = campos.semValor ? null : FORMATO_DO_VALOR_EM_REAIS.test(valor) ? Number(valor.replace(',', '.')) * 100 : Number.NaN
```

```mutacao
arquivo: apps/web/src/operacao/pedidos-do-painel.ts
teste: apps/web/src/operacao/pedidos-do-painel.test.ts › mais de duas casas
-  const centavos = campos.semValor ? null : FORMATO_DO_VALOR_EM_REAIS.test(valor) ? Math.round(Number(valor.replace(',', '.')) * 100) : Number.NaN
+  const centavos = campos.semValor ? null : FORMATO_DO_VALOR_EM_REAIS.test(valor) ? Math.round(Number(valor.replace(',', '.')) * 100) : 500
```

```mutacao
arquivo: apps/web/src/operacao/pedidos-do-painel.ts
teste: apps/web/src/operacao/pedidos-do-painel.test.ts › o valor em reais vira centavos
-  const percentual = teto === '' ? null : FORMATO_DO_TETO_EM_PERCENTUAL.test(teto) ? Number(teto) : Number.NaN
+  const percentual = FORMATO_DO_TETO_EM_PERCENTUAL.test(teto) ? Number(teto) : Number.NaN
```

```mutacao
arquivo: apps/web/src/operacao/pedidos-do-painel.ts
teste: apps/web/src/operacao/pedidos-do-painel.test.ts › mais de duas casas
-  const percentual = teto === '' ? null : FORMATO_DO_TETO_EM_PERCENTUAL.test(teto) ? Number(teto) : Number.NaN
+  const percentual = teto === '' ? null : FORMATO_DO_TETO_EM_PERCENTUAL.test(teto) ? Number(teto) : 150
```

```mutacao
arquivo: apps/web/src/operacao/pedidos-do-painel.ts
teste: apps/web/src/operacao/pedidos-do-painel.test.ts › o valor em reais vira centavos
 const lido = orcamentoDeIaRequestSchema.safeParse({ valorPorAlunoCentavos: centavos, tetoDeSegurancaPercentual: percentual })
-  if (lido.success) return { ok: true, pedido: lido.data }
```

```mutacao
arquivo: apps/web/src/operacao/textos.ts
teste: apps/web/src/operacao/textos.test.ts › a resposta fora do contrato manda atualizar a página
-  if (erro instanceof RespostaForaDoContrato) return TEXTO_PARA_ATUALIZAR
```

```mutacao
arquivo: apps/web/src/operacao/textos.ts
teste: apps/web/src/operacao/textos.test.ts › sem valor, diz que não há
-  return micros === null ? 'sem valor por aluno' : `${reais(micros)} por aluno`
+  return `${reais(micros ?? 0)} por aluno`
```

```mutacao
arquivo: apps/web/src/operacao/textos.ts
teste: apps/web/src/operacao/textos.test.ts › sem valor, diz que não há
-  if (vigente.origemDoValor === 'nenhuma') return `Vale hoje: ${valorPorAluno(null)}.`
```

```mutacao
arquivo: apps/web/src/operacao/textos.ts
teste: apps/web/src/operacao/textos.test.ts › singular e no plural
-  return quantas === 1 ? 'Muda o orçamento de 1 escola que usa o valor da rede.' : `Muda o orçamento de ${formatNumber(quantas)} escolas que usam o valor da rede.`
+  return quantas === 2 ? 'Muda o orçamento de 1 escola que usa o valor da rede.' : `Muda o orçamento de ${formatNumber(quantas)} escolas que usam o valor da rede.`
```

```mutacao
arquivo: apps/web/src/operacao/pages/Escolas.tsx
teste: apps/web/src/operacao/pages/Escolas.test.tsx › a linha oferece
-          {tipo === 'orcamento-da-rede' ? `da rede ${escola.rede.nome}` : `da escola ${escola.nome}`}
+          {tipo === 'orcamento-da-escola' ? `da rede ${escola.rede.nome}` : `da escola ${escola.nome}`}
```

```mutacao
arquivo: apps/web/src/operacao/pages/Escolas.tsx
teste: apps/web/src/operacao/pages/Escolas.test.tsx › o botão da escola abre o diálogo da escola
-const isOrcamento = (tipo: TipoDoDialogo): tipo is DialogoDoOrcamentoAberto => tipo === 'orcamento-da-rede' || tipo === 'orcamento-da-escola'
+const isOrcamento = (tipo: TipoDoDialogo): tipo is DialogoDoOrcamentoAberto => tipo === 'orcamento-da-escola'
```

```mutacao
arquivo: apps/web/src/operacao/pages/Escolas.tsx
teste: apps/web/src/operacao/pages/Escolas.test.tsx › o botão da escola abre o diálogo da escola
-const isOrcamento = (tipo: TipoDoDialogo): tipo is DialogoDoOrcamentoAberto => tipo === 'orcamento-da-rede' || tipo === 'orcamento-da-escola'
+const isOrcamento = (tipo: TipoDoDialogo): tipo is DialogoDoOrcamentoAberto => tipo === 'orcamento-da-rede'
```

```mutacao
arquivo: apps/web/src/operacao/pages/Escolas.tsx
teste: apps/web/src/operacao/pages/Escolas.test.tsx › o botão da escola abre o diálogo da escola
-  if (tipo === 'orcamento-da-rede') return { tipo: 'rede', id: escola.rede.id, nome: escola.rede.nome }
```

```mutacao
arquivo: apps/web/src/operacao/pages/Escolas.tsx
teste: apps/web/src/operacao/pages/Escolas.test.tsx › responde depois de o diálogo fechar
-  if (!isOrcamento(aberta.tipo)) return null
```

```mutacao
arquivo: apps/web/src/operacao/pages/Escolas.tsx
teste: apps/web/src/operacao/pages/Escolas.test.tsx › responde depois de o diálogo fechar
-          dialogo.closeSeAinda(abertura)
+          dialogo.close()
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › a escola com valor próprio abre
-  const redeId = alvo.tipo === 'rede' ? alvo.id : alvo.redeId
+  const redeId = alvo.tipo === 'rede' ? alvo.id : alvo.id
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › o foco vai para a reserva ao fechar o diálogo
-    <DialogoDaOperacao titulo="Orçamento de IA" aoFechar={aoFechar} {...(focoDeReserva === undefined ? {} : { focoDeReserva })}>
+    <DialogoDaOperacao titulo="Orçamento de IA" aoFechar={aoFechar}>
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › cada campo tem o seu rótulo
-        {alvo.tipo === 'rede' ? 'Rede ' : 'Escola '}
+        {alvo.tipo === 'rede' ? 'Escola ' : 'Rede '}
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › cada campo tem o seu rótulo
-      {rede !== undefined ? (
+      {rede === undefined ? (
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › carregando: o texto do carregamento
-      ) : redes.isPending ? (
+      ) : !redes.isPending ? (
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › resposta fora do contrato: "Atualize a página"
-            {forDoContrato ? TEXTO_PARA_ATUALIZAR : TEXTO_DO_CARREGAMENTO_QUE_FALHOU}
+            {TEXTO_DO_CARREGAMENTO_QUE_FALHOU}
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › resposta fora do contrato: "Atualize a página"
-            {!forDoContrato && (
+            {true && (
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › erro: "Não foi possível carregar."
-            {!forDoContrato && (
-              <Button onClick={() => void redes.refetch()} disabled={redes.isFetching}>
-                Tentar de novo
-              </Button>
-            )}
+            {!forDoContrato && null}
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › na rede, o valor em branco é "sem valor"
-    valorPorAlunoMicros: valorPorAlunoCentavos === null ? null : centavosParaMicros(valorPorAlunoCentavos),
+    valorPorAlunoMicros: centavosParaMicros(valorPorAlunoCentavos ?? 0),
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › mostra o valor da rede no
-  return (alvo.tipo === 'rede' ? orcamentoDaRedeNoPainel(definido) : orcamentoDaEscolaNoPainel(definido, definidoPelaRede(rede))).vigente
+  return (alvo.tipo === 'rede' ? orcamentoDaEscolaNoPainel(definido, definidoPelaRede(rede)) : orcamentoDaRedeNoPainel(definido)).vigente
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › junto do antes e depois
-  return depois.valorPorAlunoMicros !== antes.valorPorAlunoMicros || depois.tetoDeSegurancaPercentual !== antes.tetoDeSegurancaPercentual
+  return depois.tetoDeSegurancaPercentual !== antes.tetoDeSegurancaPercentual
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › só o teto muda
-  return depois.valorPorAlunoMicros !== antes.valorPorAlunoMicros || depois.tetoDeSegurancaPercentual !== antes.tetoDeSegurancaPercentual
+  return depois.valorPorAlunoMicros !== antes.valorPorAlunoMicros
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › o texto do intervalo no campo, anunciado
-        descritoTambemPor={erro === undefined ? '' : idDoErro}
+        descritoTambemPor=""
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › o texto do intervalo no campo, anunciado
-        {...(erro === undefined ? {} : { 'aria-invalid': true })}
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › o texto do intervalo no campo, anunciado
falha: findByRole('alert')
-      {erro !== undefined && <ErroDoCampo id={idDoErro}>{erro}</ErroDoCampo>}
+      {<ErroDoCampo id={idDoErro}>{erro}</ErroDoCampo>}
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › o texto do intervalo no campo, anunciado
-      {erro !== undefined && <ErroDoCampo id={idDoErro}>{erro}</ErroDoCampo>}
+      {erro !== undefined && null}
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › vê o antes e o depois, e o botão a descreve
falha: Muda o orçamento
-  const quantas = escolasDaRede ?? 0
+  const quantas = escolasDaRede ?? 1
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › na rede sem escola que use
-  const escolasQueMudam = quantas > 0 && mudaOVigente(antes, depois)
+  const escolasQueMudam = mudaOVigente(antes, depois)
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › uma escola só diz
-  const escolasQueMudam = quantas > 0 && mudaOVigente(antes, depois)
+  const escolasQueMudam = quantas > 0
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › na rede sem escola que use
-      {escolasQueMudam && <p className="wrap-anywhere">{textoDasEscolasQueMudam(quantas)}</p>}
+      {<p className="wrap-anywhere">{textoDasEscolasQueMudam(quantas)}</p>}
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › junto do antes e depois
-      {escolasQueMudam && <p className="wrap-anywhere">{textoDasEscolasQueMudam(quantas)}</p>}
+      {escolasQueMudam && null}
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › enquanto o pedido está no ar
-        {salvando ? 'Salvando…' : 'Salvar orçamento'}
+        {'Salvar orçamento'}
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › enquanto o pedido está no ar
-        {salvando ? 'Salvando o orçamento…' : ''}
+        {''}
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › na rede, o valor em branco é "sem valor"
-  return alvo.tipo === 'escola' ? daRede : valor.trim() === ''
+  return daRede
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › deixa o valor em branco não passa
falha: toBeNull
-  return tentou && !validacao.ok ? validacao.erros : {}
+  return !validacao.ok ? validacao.erros : {}
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › sai em centavos
-  return tentou && !validacao.ok ? validacao.erros : {}
+  return tentou ? validacao.erros : {}
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › cada campo tem o seu rótulo
-    valor: proprio.valorPorAlunoMicros === null ? '' : valorDoCampoEmReais(proprio.valorPorAlunoMicros),
+    valor: valorDoCampoEmReais(proprio.valorPorAlunoMicros ?? 0),
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › a rede não tem a caixa
-    teto: proprio.tetoDeSegurancaPercentual === null ? '' : String(proprio.tetoDeSegurancaPercentual),
+    teto: String(proprio.tetoDeSegurancaPercentual ?? 200),
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › a escola com valor próprio abre
-  const atual = alvo.tipo === 'rede' ? rede.orcamento : alvo.orcamento
+  const atual = alvo.tipo === 'rede' ? rede.orcamento : rede.orcamento
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › a lista de redes chega com o diálogo já aberto
-    if (aberto) formulario.current?.querySelector<HTMLElement>('input:not(:disabled)')?.focus()
+    if (!aberto) formulario.current?.querySelector<HTMLElement>('input:not(:disabled)')?.focus()
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › vê o antes e o depois, e o botão a descreve
falha: toBeNull
-  const depois = validacao.ok ? vigenteDepoisDe(alvo, rede, validacao.pedido) : undefined
+  const depois = validacao.ok ? vigenteDepoisDe(alvo, rede, validacao.pedido) : atual.vigente
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › deixa o valor em branco não passa
-  const depois = validacao.ok ? vigenteDepoisDe(alvo, rede, validacao.pedido) : undefined
+  const depois = true ? vigenteDepoisDe(alvo, rede, validacao.pedido) : undefined
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › dois envios seguidos
-    if (noAr.current) return
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › o texto do intervalo no campo, anunciado
-    if (!validacao.ok) return
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › da rede sem valor diz que não há
-        desligado={alvo.tipo === 'escola' && daRede}
+        desligado={daRede}
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › a escola com valor próprio abre
-        desligado={alvo.tipo === 'escola' && daRede}
+        desligado={alvo.tipo === 'escola'}
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › a rede não tem a caixa
-      {alvo.tipo === 'escola' && <CaixaDoValorDaRede marcada={daRede} aoMudar={definirDaRede} />}
+      {<CaixaDoValorDaRede marcada={daRede} aoMudar={definirDaRede} />}
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › cada campo tem o seu rótulo
-      {alvo.tipo === 'escola' && <CaixaDoValorDaRede marcada={daRede} aoMudar={definirDaRede} />}
+      {alvo.tipo === 'escola' && null}
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › deixa o valor em branco não passa
-      {depois !== undefined && <AntesEDepois id={idDoAntesEDepois} antes={atual.vigente} depois={depois} escolasDaRede={alvo.tipo === 'rede' ? rede.escolasQueUsamOValorDaRede : undefined} />}
+      {<AntesEDepois id={idDoAntesEDepois} antes={atual.vigente} depois={depois} escolasDaRede={alvo.tipo === 'rede' ? rede.escolasQueUsamOValorDaRede : undefined} />}
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › vê o antes e o depois, e o botão a descreve
-      {depois !== undefined && <AntesEDepois id={idDoAntesEDepois} antes={atual.vigente} depois={depois} escolasDaRede={alvo.tipo === 'rede' ? rede.escolasQueUsamOValorDaRede : undefined} />}
+      {depois !== undefined && null}
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › vê o antes e o depois, e o botão a descreve
falha: Muda o orçamento
-      {depois !== undefined && <AntesEDepois id={idDoAntesEDepois} antes={atual.vigente} depois={depois} escolasDaRede={alvo.tipo === 'rede' ? rede.escolasQueUsamOValorDaRede : undefined} />}
+      {depois !== undefined && <AntesEDepois id={idDoAntesEDepois} antes={atual.vigente} depois={depois} escolasDaRede={rede.escolasQueUsamOValorDaRede} />}
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › o texto do intervalo no campo, anunciado
-      {salvar.isError && <FalhaAoSalvar erro={salvar.error} />}
+      {<FalhaAoSalvar erro={salvar.error} />}
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › o 429 diz em quantos minutos
-      {salvar.isError && <FalhaAoSalvar erro={salvar.error} />}
+      {salvar.isError && null}
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › vê o antes e o depois, e o botão a descreve
falha: toBeNull
-      <AcoesDoOrcamento salvando={salvar.isPending} descritoPor={depois === undefined ? undefined : idDoAntesEDepois} aoFechar={aoFechar} />
+      <AcoesDoOrcamento salvando={salvar.isPending} descritoPor={idDoAntesEDepois} aoFechar={aoFechar} />
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › são os da rede do alvo
-  const rede = redes.data?.itens.find((candidata) => candidata.id === redeId)
+  const rede = redes.data?.itens.find(() => true)
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › o valor da rede dela, e não o da primeira da lista
-  const rede = redes.data?.itens.find((candidata) => candidata.id === redeId)
+  const rede = redes.data?.itens.find(() => true)
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › a escola com valor próprio abre
-    daRede: proprio.valorPorAlunoMicros === null,
+    daRede: true,
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › cada campo tem o seu rótulo
-    daRede: proprio.valorPorAlunoMicros === null,
+    daRede: false,
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › resposta fora do contrato: "Atualize a página"
-  const forDoContrato = redes.error instanceof RespostaForaDoContrato
+  const forDoContrato = false
```

```mutacao
arquivo: apps/web/src/operacao/components/DialogoDoOrcamento.tsx
teste: apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx › erro: "Não foi possível carregar." com
-  const forDoContrato = redes.error instanceof RespostaForaDoContrato
+  const forDoContrato = true
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| `frontend-reviewer`, rodada 2 | "Teto de segurança" é jargão para o operador | 7.1: uma frase de ajuda abaixo do campo, fixada em `docs/interface.md` |
| `revisor-geral`, 1ª (ordem r1, item 6) | `textoDoErroAoSalvar` só repassa para `textoDaFalha`: tirar e chamar `textoDaFalha` direto | O `textoDaFalha` da operação é homônimo que o mapa da onda de nomes libera só nos arquivos que lista (`tools/renomear/mapas/10.json`), e o `restos` fica vermelho com ele num arquivo novo; o auxiliar fica, com a razão no JSDoc. `TODO.md`: o `restos` liberar o homônimo pela declaração, ou renomear o `textoDaFalha` da operação numa correção |
| `test-engineer`, 1ª | Decidir se o "Cancelar" fica desligado enquanto o `PUT` está no ar | Muda comportamento da tela (D59: sair nunca é mais difícil que entrar); `TODO.md`, para o Arquiteto decidir |
| `test-engineer`, 1ª, e `infra-guardian`, 1ª | Dois operadores salvando o mesmo orçamento: vale o último, o "Antes" de quem salva por último pode estar velho; talvez `If-Match` | O `PUT` é da 3.0 e não tem versão; `TODO.md`, para a validação e a retro |
| `test-engineer`, 1ª, e `frontend-reviewer`, 1ª | A contagem "Muda o orçamento de N escolas que usam o valor da rede" também conta a escola que só usa o teto da rede quando só o teto muda | O texto e a definição de `escolasQueUsamOValorDaRede` são os de `cenarios.md` §4 e da `techspec.md` §4; mudar é mudar contrato. `TODO.md`, para o Arquiteto |
| `test-engineer`, 1ª | As escolas semeadas pelo novo describe de `e2e/operacao-escolas.spec.ts` não são removidas no `afterEach` | Mesmo precedente de `operacao-convite-coordenacao.spec.ts`; `TODO.md` (limpeza do banco do e2e, as duas juntas) |
| `test-engineer`, 1ª | "Nada só por hover" sem asserção no e2e do celular | Recusada: difícil de provar por asserção, e o `frontend-reviewer` conferiu o código (nada depende de hover) |
| `frontend-reviewer`, 1ª | `ErroDoCampo` repete o desenho do `FieldError`; dar a ele uma propriedade `anunciado` | Mexe em `components/ui/fields/FormField.tsx`, fora desta tarefa; `TODO.md` |
| `frontend-reviewer`, 1ª | As duas ações da mesma linha têm o mesmo texto visível, "Orçamento de IA"; um complemento visível ("da rede", "da escola") | Muda o texto de `cenarios.md` §4 e o `e2e` que conta os botões; fica para a validação, que vê a tela |
| `frontend-reviewer`, 1ª; `conformidade-reviewer`, 1ª; `privacy-guardian`, 1ª | Fotografar o diálogo quando a vitrine tiver o papel operador | `TODO.md` (a vitrine); o Validador fotografa na validação da funcionalidade |
| `conformidade-reviewer`, 1ª | Na 8.0, conferir que a aba Uso mostra só número por escola, sem nada por professor nem por aluno com nome | Tarefa `8_task.md` |
| `infra-guardian`, 1ª | O `onSuccess` espera as três invalidações antes de `aoSalvar()`; o diálogo fica em "Salvando…" se a lista for lenta | Muda a ordem do fechamento e os casos de "Orçamento salvo"; tela interna, fora do horário de aula. `TODO.md` |
| `infra-guardian`, 1ª | `GET /v1/operacao/redes` sem paginação; confirmar que `escolasQueUsamOValorDaRede` não é uma consulta por rede | Código da 3.0 (API); dentro da D25 para dez escolas. `TODO.md` |
| `revisor-geral`, 1ª | Levar `RespostaForaDoContrato` para a camada `api/` (ou `client.ts`), antes de a 6.0 e a 8.0 criarem outra forma | Mexe em `api/client.ts`, fora desta tarefa; tarefas `6_task.md` e `8_task.md` |
| `revisor-geral`, 1ª | Registrar na tabela "Divergências resolvidas" que a "linha da rede" virou um botão na coluna Rede de cada escola | Recusada: a `techspec.md` §9 diz "o diálogo "Orçamento de IA" (rede e escola)" e a tela cumpre; não há divergência. A escolha já está em `docs/interface.md` §5a |
| `revisor-geral`, 2ª (e 1ª, item 6 da ordem 1) | Manter `textoDoErroAoSalvar` (a ordem pedia tirá-la) | Recusada, com motivo no JSDoc de `textos.ts`: `textoDaFalha` é homônimo liberado pelo mapa de nomes (`tools/renomear/mapas/10.json`) só nos arquivos que ele lista, e um arquivo novo que o citasse deixa o `restos` vermelho. O `revisor-geral` conferiu e aprovou |
| `revisor-geral`, 2ª | O bloco de mutação que tira `if (tipo === 'orcamento-da-rede') return …` cita "o botão da escola abre o diálogo da escola"; quem fica vermelho é o caso do botão da rede | `TODO.md` (a citação do bloco); o portão já provou o bloco vermelho |
| `revisor-geral`, 2ª | Juntar as guardas `aberta === undefined \|\| escola === undefined` e `!isOrcamento(aberta.tipo)` de `OrcamentoAberto` numa linha | Recusada: só estética, e o `test-engineer` conferiu que cada uma tem o seu motivo (a primeira é de tipo) |
| `revisor-geral`, 2ª | O Nova escola passa a dizer "Atualize a página" com a lista de redes fora do contrato: mudança visível fora da tarefa | Validação da funcionalidade, quando fotografar o papel operador; já está dito na pergunta 2 do documento |
| `test-engineer`, 2ª | No caso da escola de "a rede certa da lista", conferir também a contagem de `PUT` e o caminho com o `redeId` certo | `TODO.md` (reforço de teste) |
| `test-engineer`, 2ª | O caso do `PUT` atrasado prova resposta fora de ordem, não dois pedidos ao mesmo tempo; dois operadores salvando | O clique duplo já tem caso; dois operadores segue em `TODO.md`, da rodada 1 |
| `conformidade-reviewer`, 2ª | Fotografar o diálogo com o papel operador; na 8.0, a aba Uso só com número por escola; se o Arquiteto decidir sobre o "Cancelar", ele continua habilitado (D59) | `TODO.md` (a vitrine), `8_task.md` e o Arquiteto; as mesmas da rodada 1 |
| `frontend-reviewer`, 2ª; `privacy-guardian`, 2ª; `infra-guardian`, 2ª | O mesmo texto visível nas duas ações da linha; "Teto de segurança" como jargão (já na 7.1); fotos com o papel operador; paginação de `GET /v1/operacao/redes`; `If-Match` | As mesmas da rodada 1, com os destinos da ordem 1 |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-21 07:48:19 | 2026-11-21 07:48:51 | `tenancy-guardian` | 1 | APROVADO | add4b93cecb0e3517 |
| 2026-11-21 07:48:24 | 2026-11-21 07:48:58 | `conformidade-reviewer` | 1 | APROVADO | ab266dbc517768db8 |
| 2026-11-21 07:48:22 | 2026-11-21 07:49:01 | `privacy-guardian` | 1 | APROVADO | aa3b4e3a28efa59f1 |
| 2026-11-21 07:48:27 | 2026-11-21 07:49:09 | `infra-guardian` | 1 | APROVADO | aeeb83db12dce971d |
| 2026-11-21 07:48:11 | 2026-11-21 07:49:10 | `frontend-reviewer` | 1 | APROVADO | a9d11aeda8abcbd75 |
| 2026-11-21 07:48:16 | 2026-11-21 07:49:55 | `revisor-geral` | 1 | APROVADO | a874317cf7d8ae648 |
| 2026-11-21 07:48:14 | 2026-11-21 07:51:21 | `test-engineer` | 1 | REPROVADO | add349f63156d56d6 |
| 2026-11-21 08:18:44 | 2026-11-21 08:18:58 | `frontend-reviewer` | 2 | APROVADO | af2c3dceb0d106f82 |
| 2026-11-21 08:18:49 | 2026-11-21 08:19:04 | `tenancy-guardian` | 2 | APROVADO | aabeba5777d3b544c |
| 2026-11-21 08:18:53 | 2026-11-21 08:19:09 | `privacy-guardian` | 2 | APROVADO | a77f2da08951d131d |
| 2026-11-21 08:18:39 | 2026-11-21 08:19:12 | `revisor-geral` | 2 | APROVADO | a7b402a01c87d50de |
| 2026-11-21 08:18:58 | 2026-11-21 08:19:19 | `conformidade-reviewer` | 2 | APROVADO | a56ed5a4dbcf2a53d |
| 2026-11-21 08:19:02 | 2026-11-21 08:19:21 | `infra-guardian` | 2 | APROVADO | a4575b6246fc5192d |
| 2026-11-21 08:18:34 | 2026-11-21 08:19:29 | `test-engineer` | 2 | APROVADO | aa8f781a1cb13be25 |
