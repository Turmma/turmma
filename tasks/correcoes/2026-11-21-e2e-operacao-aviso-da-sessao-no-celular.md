# Correção — o E3 da operação pulava o relógio com a lista de Escolas ainda no ar, e o aviso de inatividade sumia antes do toque no celular

**Origem:** esteira run 44915770834 da `spec/camada-ia` em `7d86caed` (`e2e 10/11`), `e2e/operacao.spec.ts:350` (E3), só no projeto `celular`, também na repetição; passou na 44906515032. Falha de teste que já existia antes da tarefa 7.0 (o diálogo do orçamento): o teste é da A0 e o defeito é dele, não do diálogo
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`, `infra-guardian`, `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`

## Sintoma
`page.waitForResponse` (linha 373) e `locator.tap` (linha 374) estouram os 30 s do caso. O `tap` fica em "waiting for … getByRole('button', { name: 'Continuar na sessão' })": o aviso já tinha aparecido (as três conferências anteriores passaram) e saiu antes do toque. Nenhum `/v1/operacao/eu` sai depois, porque o aviso que sumiu era o que o clique ia resolver.

## Fora desta correção
nada

## Causa
O trace da esteira (`traco-do-e2e-10`) mostra, depois do salto do relógio, a sequência `POST /sessao/renovar` e um segundo `GET /escolas`, e nenhum `/eu`. O E3 entra na operação e só espera o banner, que aparece com o `GET /eu`; o `GET /escolas` da tela de Escolas, que parte junto com ele, ainda estava no ar (675 ms na esteira, e o `fastForward(26:30)` caiu 14 ms antes de ele chegar). O que acontece, na ordem:

1. o salto de 27 min estoura o prazo da chamada (`comPrazo` em `apps/web/src/api/client.ts`: um `setTimeout` de 20 s do **relógio falso**), e a chamada é abortada (`net::ERR_ABORTED`, visto no log do teste);
2. `TEMPO_ESGOTADO` é repetível (`shouldRetry`, uma vez, um segundo depois), e o TanStack repete a consulta;
3. a repetição passa por `operadorAuthedRequest`: o token de 10 min está vencido **no relógio falso** (`expiraEm <= Date.now()`), então renova (`POST /renovar`) e envia o `GET`;
4. a resposta aceita chama `registrarUso`, o relógio de inatividade (`useOperatorIdleTimeout`) é reagendado a partir de um uso que é de "agora", e o aviso, que acabara de aparecer, sai.

O aviso some entre as conferências do teste (caixa, `axe`, que levam de 1 a 2 s no celular da esteira) e o toque, e o toque não acha mais o botão. É corrida do teste com a lista: no Chromebook e na máquina rápida a lista chega antes do salto e nada disso acontece, por isso só o celular, e só às vezes. **Não é o diálogo do orçamento da 7.0:** ele só consulta as redes quando abre, e o trace não tem nada dele. O produto está certo: uma requisição aceita **é** uso (RF5), e o aviso sair com ela é o desenho.

## Teste que reproduz
`e2e/operacao.spec.ts › E3: o aviso aparece 2 min antes do fim da sessão parada, e no fim a aba vai à entrada com a mensagem`, projeto `celular`. A corrida não é determinística na máquina, então a prova é a corrida forçada, feita à mão e **não** deixada no arquivo:

- na cópia de trabalho, o E3 como estava, com o **primeiro** `GET /v1/operacao/escolas` seguro por 3 s (`page.route`, a repetição passa direto) e, depois de o aviso aparecer, `page.waitForTimeout(4_000)` seguido de `expect(aviso).toBeVisible({ timeout: 500 })`: o log do teste mostra `escolas ERR_ABORTED`, `renovar`, `GET /escolas`, e o caso cai nos mesmos 30 s com a **mesma assinatura da esteira** (`page.waitForResponse` e `locator.tap` estourados);
- a mesma cópia **com o conserto**: 1 passou (22 s).

Sem o ajudante e sem o atraso o caso passa na máquina (nas corridas de investigação passou todas as vezes): a falha só aparece com a lista lenta, que é o que a esteira tem.

## Correção
`esperarAListaDeEscolas(page)`, nova em `e2e/support/operacao-screen.ts`: espera o sinal **positivo** de que a consulta terminou, a região "Lista de escolas" (com dado) ou o estado vazio "Nenhuma escola ainda." (`toBeVisible`, com `.or`). O E3 a chama logo depois de `entrarNaOperacao`, antes do primeiro `fastForward`. Com a lista assentada nada fica no ar para o salto estourar, e o aviso só sai por um uso de verdade (o toque no "Continuar"). Não mudei o produto nem o prazo do teste. (A 1ª versão esperava o "Carregando as escolas…" sumir, com `toHaveCount(0)`; a 1ª rodada apontou que ela passaria sem esperar nada se a tela ainda não tivesse montado, e ela foi trocada pelo sinal positivo. O comentário que o E3 repetia do JSDoc do ajudante saiu.)

**Estabilidade:** o E3 rodado sozinho, no `celular`, dez vezes seguidas com a 1ª versão do conserto e sem o atraso: 10 de 10 (`--repeat-each=10`). Com o sinal positivo da 2ª versão, o arquivo inteiro passa nos dois projetos (ver o portão).

Outros casos de e2e que saltam o relógio logo depois de entrar na operação não foram alterados: `E2: a sessão encerrada…` (`operacao.spec.ts:302`) espera uma recusa `SESSAO_ENCERRADA`, que vem igual com ou sem a repetição, e `o aviso de inatividade com um diálogo aberto…` (`operacao-escolas.spec.ts:657`) só salta depois de abrir o diálogo e de o campo "Rede" aparecer. Se a esteira cair em um deles com a mesma assinatura, o ajudante já existe.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (1ª), infra-guardian (1ª) | Aplicar `esperarAListaDeEscolas` também em `operacao.spec.ts:302` (E2) e `operacao-escolas.spec.ts:657`, ou em todo caso que chama `fastForward` depois de `entrarNaOperacao` | Recusada por ora: a seção "Correção" do documento mostra que o E2 espera uma recusa `SESSAO_ENCERRADA`, que vem igual com ou sem a repetição, e que o caso de `operacao-escolas.spec.ts:657` só salta depois de o campo "Rede" aparecer. Se a esteira cair em um deles com a mesma assinatura, o ajudante já existe |
| test-engineer (1ª) | Teste de unidade de `useOperatorIdleTimeout` (qualquer requisição aceita reagenda o aviso), para documentar o mecanismo sem o atraso de 3 s no e2e | `TODO.md`, e lembrete para a retro |
| test-engineer (1ª) | Olhar a duração que o portão registrar para o E3 (os 22 s do documento são da corrida forçada, com atraso injetado, e não medem o caso normal) | Sem ação no código: o portão mede e cobra o prazo do caso alterado (metade de 30 s) |
| revisor-geral (2ª) | O caso de erro e o caso fora da última página travam o ajudante: com a lista em erro sem dado anterior (`Escolas.tsx:246`) ou no vazio de uma página além da última (`Escolas.tsx:252`) nenhum dos dois sinais aparece, e o ajudante espera o `SIGN_IN_TIMEOUT_MS` e falha sem apontar a causa; citar isso no JSDoc para quem reusar o ajudante | `TODO.md`, para quem reusar `esperarAListaDeEscolas` em outro caso. Hoje só o E3 a chama, e ele não passa por esses estados; o test-engineer (2ª) conferiu que a falha por timeout, nesse caso, deixa a causa à vista |
| revisor-geral (2ª) | O texto 'Nenhuma escola ainda.' está escrito à mão em `operacao-screen.ts` e também em `TEXTO_DA_LISTA_VAZIA` (`apps/web/src/operacao/textos.ts:156`); se mudar, o ajudante quebra por timeout | `TODO.md`: trocar pela constante na próxima vez que alguém tocar o ajudante. O e2e já importa de `apps/web/src` (`operacao-escolas.spec.ts:4`), então a convenção permite |

## Mutações

--faltando: 0 linhas (0 blocos, 0 motivos)

O conserto é só de teste (`e2e/operacao.spec.ts` e `e2e/support/operacao-screen.ts`), sem código de produção: o `--faltando` não lista nada. A chamada do ajudante não tem bloco: o vermelho dela só existe com a lista lenta, que o caso não força (forçar o atraso no arquivo custaria 3 s a cada corrida e um `page.route`, para provar uma corrida de relógio), e a prova está na seção "Teste que reproduz".

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-21 19:17:44 | 2026-11-21 19:17:58 | `tenancy-guardian` | 1 | APROVADO | ac1058bf5364afa40 |
| 2026-11-21 19:17:45 | 2026-11-21 19:18:02 | `privacy-guardian` | 1 | APROVADO | ae4c36a34e6b0ce9a |
| 2026-11-21 19:17:46 | 2026-11-21 19:18:10 | `conformidade-reviewer` | 1 | APROVADO | a052e373ed874af66 |
| 2026-11-21 19:17:43 | 2026-11-21 19:18:11 | `infra-guardian` | 1 | APROVADO | a66d406a2769177a0 |
| 2026-11-21 19:17:42 | 2026-11-21 19:18:13 | `revisor-geral` | 1 | APROVADO | a2f56ffbba42ebbba |
| 2026-11-21 19:17:40 | 2026-11-21 19:18:40 | `test-engineer` | 1 | APROVADO | a2073dc444dadb179 |
| 2026-11-21 20:09:42 | 2026-11-21 20:10:07 | `revisor-geral` | 2 | APROVADO | a359df33fb86451d8 |
| 2026-11-21 20:09:39 | 2026-11-21 20:10:16 | `test-engineer` | 2 | APROVADO | aa6d6b3e9760237ed |
