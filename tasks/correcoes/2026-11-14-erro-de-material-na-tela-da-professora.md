# Correção — a professora recebe o texto da coordenação ("vá a Licenças") ao adaptar, e a tela dela não trata os dois códigos do material

**Origem:** validacao.md de ingestao-do-material, "Recomendações sem aplicar" de `tasks/correcoes/2026-11-14-adaptacao-com-licenca-vencida.md` (conformidade-reviewer, llm-integrator, test-engineer), e a decisão 2(a) do Joaquim
**Subagentes obrigatórios:** `frontend-reviewer`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`
<!-- test-engineer é obrigatório em toda correção, marcado ou não. Os guardiões implícitos vêm do pedido do Orquestrador. -->

## Sintoma

A adaptação de uma atividade cujo material saiu de uso é recusada com `LICENCA_VENCIDA` ou `EDICAO_SUBSTITUIDA` (correção
`2026-11-14-adaptacao-com-licenca-vencida`), no `POST` ou na execução. A tela da professora (`FalhaDoPedido`, em
`areas/professor/comum/avisos.tsx`, que o cartão da Adaptação e a conversa usam) mostrava o texto do catálogo:

- `LICENCA_VENCIDA`: "A licença deste material não está vigente. Atualize a vigência em Licenças e envie de novo." É texto da
  coordenação, escrito para o envio de material; a professora não tem "Licenças" nem o que atualizar.
- `EDICAO_SUBSTITUIDA`: o catálogo já mandava gerar a atividade de novo, mas por acaso, e com outra frase.

## Fora desta correção

nada

## Causa

Só `areas/coordenacao/material/` trata os dois códigos. O resto da web cai em `MENSAGENS_DE_ERRO[erro]`, o catálogo geral,
e o texto de `LICENCA_VENCIDA` nele foi escrito para o envio de material. A correção da adaptação passou a devolver o código
à professora sem que a tela dela tivesse texto próprio.

## Teste que reproduz

`apps/web/src/areas/professor/ferramentas/CartaoDeFerramenta.test.tsx`, no `describe` "a Adaptação de uma atividade cujo
material saiu de uso":

- "LICENCA_VENCIDA na recusa do pedido" e "EDICAO_SUBSTITUIDA na recusa do pedido": o texto da professora, sem "Licenças",
  sem "Tentar de novo" e sem o código
- "LICENCA_VENCIDA que aparece na execução" e "EDICAO_SUBSTITUIDA que aparece na execução" (`it.each`, depois do 202, quando o material saiu de uso no meio): o mesmo texto

Vermelho antes (os três mostravam o catálogo), verde depois: 15 casos do arquivo.

## Correção

`FalhaDoPedido` mostra `TEXTO_DO_MATERIAL_FORA_DE_USO` ("O material que esta atividade cita saiu de uso. Gere a atividade de
novo para poder adaptá-la.") para `LICENCA_VENCIDA` e `EDICAO_SUBSTITUIDA`, nas duas falhas (a do `POST` e a da execução, que
chegam ao mesmo lugar). Os dois são `explicada` em `aparenciaDaFalha`: sem "Tentar de novo", porque repetir o pedido não
adianta. **O catálogo (`MENSAGENS_DE_ERRO`) não mudou**: o texto de `LICENCA_VENCIDA` continua certo para quem envia o
material (coordenação), e `EDICAO_SUBSTITUIDA` já servia à professora.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| conformidade-reviewer (1ª), test-engineer (1ª) | "As fotos não mostram o estado de falha, e o próprio aviso já diz que a vitrine não chega a ele." Fotografar a falha quando a vitrine puder forçar uma recusa | Recusada: o estado só nasce com uma atividade que cita material vencido, e a vitrine (`tools/vitrine/`) não monta isso; mexer nela está fora desta correção, que não altera `tools/`. O texto é provado pelo teste de componente, com mutação |
| conformidade-reviewer (1ª), test-engineer (1ª) | Escolher o texto pela função do pedido, em vez de comentar o limite | Recusada: muda comportamento. Hoje só a Adaptação devolve os dois códigos à professora (`artefato.service.ts:77-78`), e o limite fica escrito no comentário (item 2) |
| infra-guardian (1ª) | Observações: a troca de `type ErrorCode` por import de valor está certa; os dois códigos já caem em `explicada` porque não estão em `PASSAGEIROS` (o teste pega quem os puser lá); a mudança não cria requisição, polling, job, query nem métrica | Sem ação: são constatações, sem o que mudar |
| tenancy-guardian (1ª) | Observação: o texto igual para `LICENCA_VENCIDA` e `EDICAO_SUBSTITUIDA` faz o caso de outra escola (que vem como `EDICAO_SUBSTITUIDA`) aparecer igual ao de licença vencida da própria escola | Sem ação: é o efeito desejado, menos o que se distingue na tela |
| test-engineer (2ª) | "O caso da execução (`CartaoDeFerramenta.test.tsx:248-249`) não repete as asserções sem "Licenças" e sem o código que o caso da recusa tem. A comparação exata com `toBe(TEXTO_DA_PROFESSORA)` já cobre as duas, então é só simetria entre os dois casos." | Recusada: o revisor aprovou, e a recomendação entra em ordem uma vez por documento (já entrou na rodada 1). O `toBe` do texto exato já falha se "Licenças" ou o código aparecerem, e as três mutações do documento provam isso: nada deixa de ser provado |

## Mutações

--faltando: 0 linhas (0 blocos, 0 motivos)

```mutacao
arquivo: apps/web/src/areas/professor/comum/avisos.tsx
teste: apps/web/src/areas/professor/ferramentas/CartaoDeFerramenta.test.tsx › LICENCA_VENCIDA na recusa do pedido
falha: toBe(TEXTO_DA_PROFESSORA)
-const MATERIAL_FORA_DE_USO: readonly ErrorCode[] = [ErrorCode.LICENCA_VENCIDA, ErrorCode.EDICAO_SUBSTITUIDA]
+const MATERIAL_FORA_DE_USO: readonly ErrorCode[] = [ErrorCode.EDICAO_SUBSTITUIDA]
```

```mutacao
arquivo: apps/web/src/areas/professor/comum/avisos.tsx
teste: apps/web/src/areas/professor/ferramentas/CartaoDeFerramenta.test.tsx › EDICAO_SUBSTITUIDA na recusa do pedido
falha: toBe(TEXTO_DA_PROFESSORA)
-const MATERIAL_FORA_DE_USO: readonly ErrorCode[] = [ErrorCode.LICENCA_VENCIDA, ErrorCode.EDICAO_SUBSTITUIDA]
+const MATERIAL_FORA_DE_USO: readonly ErrorCode[] = [ErrorCode.LICENCA_VENCIDA]
```

```mutacao
arquivo: apps/web/src/areas/professor/comum/avisos.tsx
teste: apps/web/src/areas/professor/ferramentas/CartaoDeFerramenta.test.tsx › LICENCA_VENCIDA que aparece na execução
falha: toBe(TEXTO_DA_PROFESSORA)
-      {MATERIAL_FORA_DE_USO.includes(erro) ? TEXTO_DO_MATERIAL_FORA_DE_USO : MENSAGENS_DE_ERRO[erro]}
+      {MENSAGENS_DE_ERRO[erro]}
```

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-14 13:01:54 | 2026-11-14 13:02:14 | `frontend-reviewer` | 1 | APROVADO | a59fad8e28490c0fe |
| 2026-11-14 13:02:01 | 2026-11-14 13:02:18 | `tenancy-guardian` | 1 | APROVADO | ac65dae86a50e57e0 |
| 2026-11-14 13:02:10 | 2026-11-14 13:02:24 | `infra-guardian` | 1 | APROVADO | aa6c61413a6a4657e |
| 2026-11-14 13:02:04 | 2026-11-14 13:02:25 | `privacy-guardian` | 1 | APROVADO | a2f7df389be0d6c4d |
| 2026-11-14 13:02:07 | 2026-11-14 13:02:39 | `conformidade-reviewer` | 1 | APROVADO | a2ddabb2fb714b5b7 |
| 2026-11-14 13:01:58 | 2026-11-14 13:02:41 | `test-engineer` | 1 | APROVADO | a551dfb1d317bac6e |
| 2026-11-14 13:09:41 | 2026-11-14 13:10:03 | `test-engineer` | 2 | APROVADO | a699d38281b0b8adb |
