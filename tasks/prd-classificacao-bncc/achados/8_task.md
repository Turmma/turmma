# Achados das revisões — `tasks/prd-classificacao-bncc/8_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-18 14:41:20 · `tasks/prd-classificacao-bncc/8_task.md`

VEREDITO: APROVADO

Tela vista: sim (8 fotos lidas, escola cheia e vazia, nos dois tamanhos). A cheia cobre a lista, o painel do material e o seletor aberto. A vazia cobre a lista sem material. As fotos batem com o código da árvore.

Estados: ok. Não vi carregando e erro nas fotos, então conferi pelo código.
- Painel de habilidades (`ClassificacaoDoMaterial.tsx:325-340`): "Carregando as habilidades…", erro com `role="alert"` e "Tentar de novo", vazio "Nenhum capítulo classificado ainda. A classificação roda à noite." e lista. O vazio só aparece com a leitura terminada (`:286`).
- Seletor (`SeletorDeHabilidades.tsx`): carregando, erro com "Tentar de novo", sem resultado, sem componente e com dado.
- Tela vazia da lista de materiais: "Nenhum material ainda", com convite e botão "Enviar material". Não se desculpa.

Acessibilidade: ok.
- O foco entra no filtro ao abrir o seletor, e Esc ou "Cancelar" fecham só o seletor e devolvem o foco ao "Corrigir" (`:128-139`, `ClassificacaoDoMaterial.tsx:151-154`). O e2e cobre isso.
- Todo campo tem rótulo: o filtro, o grupo do seletor e as caixas, que ficam dentro de `<label>`. O "Corrigir" e o "Reclassificar" levam texto `sr-only` com o alvo (capítulo ou material).
- A situação do capítulo e a origem da habilidade são texto, não só cor.
- O resultado do pedido vira `role="status"` ou `role="alert"` e recebe o foco.
- O e2e roda axe nos projetos `chromebook` e `celular`.

Chromebook fraco: ok.
- O seletor mostra no máximo 50 linhas e diz "Mostrando 50 de N" (`SeletorDeHabilidades.tsx:116-120`). Em vez de virtualizar, filtra por texto, e as 5 escolhidas ficam sempre à vista.
- A leitura do material usa uma consulta só (`GET /v1/materiais/:id`). As candidatas só são lidas quando o editor abre.
- Não há upload de imagem nesta tarefa.
- A foto a 1366 × 768 não rola ("Rolam: nenhuma"). Não vi o throttling de CPU rodar; o `frontend-reviewer` não pode atestar isso só pela foto.

Celular: ok.
- As fotos de 360 px não mostram rolagem lateral nem corte.
- O texto quebra com `break-words` e `min-w-0`, e as fileiras de botões usam `flex-wrap`.
- O botão padrão tem 44 px (`Button.tsx`), as linhas das caixas de marcar têm `min-h-11` com caixa de 24 px (`:105-106`), e o e2e mede 44 px no projeto `celular` e 24 px no computador.
- Nada depende de hover ou de atalho: o Esc é só um atalho a mais, porque "Cancelar" existe.
- Nenhum fluxo exige o celular.

Ação oficial protegida: sim.
- "Reclassificar" mostra primeiro quantos capítulos serão refeitos à noite e quantos corrigidos ficam como estão, com "Confirmar" e "Cancelar". Durante o pedido tudo fica desligado e o clique duplo manda um só.
- "Salvar correção" tem as habilidades escolhidas à vista (código e descrição), e o aviso "A correção vale no lugar da IA e não é refeita ao reclassificar" aparece antes de salvar.
- Toda habilidade sugerida pela IA leva "Sugerida pela IA" (`classificacao.ts:19-29`). Com a função suspensa, a tela diz que a sugestão não vale. Isso atende à regra 70, item 3 e item 4a.
- A tela não mostra dado de pessoa, e "trecho" e "seção" não aparecem (a tela só diz "capítulo" ou "Páginas X a Y").

Bloqueantes: nenhum.

Recomendações:
1. O painel mostra os capítulos duas vezes, em "Capítulos" e logo abaixo em "Habilidades da BNCC" (`PainelDoMaterial.tsx:207-208`, foto do painel). A seção de habilidades repete nome e páginas. Em 360 px isso rola bastante antes de chegar à primeira habilidade. Vale rever depois se a lista de capítulos antiga pode ceder lugar à nova.
2. A foto do seletor aberto, em 360 px, mostra o rodapé fixo ("Enviar edição nova" e "Excluir material") ocupando mais de um terço da altura útil do painel. Isso deixa pouco espaço para o seletor. Funciona e rola dentro do painel. Se o editor de capítulo crescer na 11.0, vale o rodapé deixar de ser fixo enquanto o seletor está aberto.
3. "Excluir material" fica a um toque do "Enviar edição nova", no rodapé fixo do celular. Já existia antes desta tarefa e abre uma confirmação de perigo, então não bloqueia.
4. O botão "Reclassificar" fica desligado sem mostrar o motivo quando o componente ainda não chegou (`semComponente === undefined`). Dura só o tempo da leitura, mas um texto curto ajudaria.

Arquivos principais:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/components/habilidades/SeletorDeHabilidades.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/classificacao.ts`

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-18 14:41:46 · `tasks/prd-classificacao-bncc/8_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A tarefa é só de tela. Ela grava a correção da classificação da coordenação (`PUT /v1/materiais/:id/secoes/:secaoId/habilidades`) e pede a reclassificação (`POST /v1/materiais/:id/reclassificar`). Nenhum dos dois toca em `Nota`. Todos com autor humano? sim (não se aplica).

Decisão autônoma sobre aluno: ausente. A classificação vale para o material da escola e não para o aluno. A função declarada diz que "Nada chega ao aluno pela classificação: a habilidade de cada questão só vale quando o professor confere e aplica a atividade" (`packages/shared/src/governanca/governanca.test.ts:108`).

Aprovação registrada: ok.
- Cada habilidade diz de quem é: "Sugerida pela IA" ou "Corrigida pela coordenação" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/classificacao.ts:19-30`). As fotos `coordenacao--coordenacao-material--Ciências-7-Vitrine-button-has-text-Corrigir-visible-true-nth-0--computador.png` e `--celular.png` mostram isso.
- Com a função suspensa, a tela avisa que a sugestão da IA não vale, e o editor só abre com as habilidades que a coordenação corrigiu.
- A correção é registrada na auditoria pelo backend da 7.0 (`apps/api/src/material/material.service.ts`, `AuditoriaRecorder`), que já foi auditado e não mudou aqui.
- A tela avisa antes de salvar que "A correção vale no lugar da IA e não é refeita ao reclassificar". Antes de confirmar, "Reclassificar" mostra quantos capítulos serão refeitos e quantos ficam como estão.

Supervisão do tutor: não se aplica. A tarefa não toca no tutor.

Autonomia declarada e visível: sim. `classificacao_do_material` é função do Assistente de ensino, com autonomia 1, alto risco e suspensível. Está em `docs/agentes.md:79` e no catálogo de governança. Nada nesta tarefa passa do nível 1.

Demais itens:
- **Vigilância (item 7):** nada a apontar. A tela não mostra dado de pessoa, só capítulo e habilidade.
- **Medir o professor (item 9):** nada a apontar. Não há indicador de professor.
- **Nota proposta em discursiva e redação (item 8, D55):** não se aplica. A classificação é feita sobre o material, nunca sobre texto de aluno. Nenhuma tela fala em nota, conceito ou pontuação. O teste com `VOCABULARIO_DE_NOTA` prova isso em `e2e/material-classificacao.spec.ts:142`, e as fotos confirmam.
- **Fotos:** nenhuma induz uso nem dificulta sair. O estado vazio da escola sem material não mostra a seção.

Bloqueantes: nenhum.

Recomendações:
1. **Origem visível dentro do seletor.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx:76`, o editor abre com as sugestões da IA já marcadas. A lista de caixas (`SeletorDeHabilidades.tsx`) mostra só o código e a descrição, sem dizer qual habilidade veio da IA. Pôr "Sugerida pela IA" ao lado de cada caixa já marcada ajuda a confirmação a não virar clique reflexo. Vale mais ainda porque a 11.0 vai reaproveitar o seletor com o professor.
2. **Confirmar sem mudar nada.** "Salvar correção" sem tocar em nada (`ClassificacaoDoMaterial.tsx:111`) faz a habilidade passar a "Corrigida pela coordenação", mesmo que o texto seja o que a IA sugeriu. A autoria registrada está certa. Ainda assim, a auditoria e a tela poderiam distinguir "confirmada" de "alterada", para responder com mais precisão "o que a IA gerou e quem aprovou". Isso pede mudança no contrato e fica para avaliar na retro.
3. **Selo de IA padrão.** O selo de origem em `ClassificacaoDoMaterial.tsx:180` é um chip feito à mão (`bg-ia-cx text-ia`). Nas fotos ele sai quase cinza. Usar o selo de IA padrão de `components/ui/ai/` deixaria a marca de IA igual à do resto do produto (D58). O contraste é assunto do `frontend-reviewer`.
4. **Painel no celular (fora da minha regra).** Na foto `coordenacao--coordenacao-material--Ciências-7-Vitrine--celular.png`, o conteúdo da página aparece abaixo do rodapé do painel. Fica registrado para o `frontend-reviewer`.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-18 14:41:54 · `tasks/prd-classificacao-bncc/8_task.md`

VEREDITO: APROVADO

Esta tarefa é só de tela. Ela não cria campo de pessoa, não escreve log e não envia nada para fora. O painel mostra capítulo, habilidade da BNCC e a origem da habilidade ("Sugerida pela IA" ou "Corrigida pela coordenação"), sem nome de quem corrigiu.

Campos pessoais tocados: nenhum. O `secaoDoMaterialResponseSchema` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/shared/src/material/material.ts:276`) é um `strictObject` com id, ordem, páginas, capítulo, situação, habilidades e `corrigida` (só sim ou não). Não traz autor nem data de quem corrigiu.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok nesta camada. A tela só chama três rotas da 7.0: `GET /v1/habilidades-bncc?materialId=`, `PUT …/secoes/:secaoId/habilidades` e `POST …/reclassificar`. O escopo é do repository, que já foi auditado na 7.0. O e2e prova que a coordenação da escola B, entrando na mesma aba, não vê o painel da escola A.

Logs: limpos. O `grep` nos arquivos novos não acha `console`, `logger`, `localStorage` nem `sessionStorage`.

Auditoria: presente onde a regra pede. A correção e o pedido de reclassificar ficam registrados no backend da 7.0 (`apps/api/src/material/material.service.ts:83` e `:657`, ação `material.reclassificado`). A tela não faz exportação nem lê dado de aluno.

Envio externo: nenhum nesta tarefa. A classificação pela IA roda no worker da noite e fica registrada em `ExecucaoAgente`, mas isso é de outras tarefas.

Seed/fixture: sintético. As fotos mostram "Colégio sintético da vitrine cheia bb200f56", "Coordenadora sintética e93587cb" e "Ciências sintética 3c115d5b". Os helpers novos de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/support/material.ts:1021-1128` gravam seções, habilidades da tabela pública e execuções com `randomUUID()`, sem dado de pessoa.

Fotos da tela: nas imagens do computador e do celular, da lista, do painel e do seletor aberto, aparece só o que o DTO promete, ou seja, título do capítulo, páginas, código e descrição da habilidade e a origem. Nenhum nome de aluno, professor ou de quem corrigiu aparece no conteúdo da tela. O único nome de pessoa é o da própria coordenadora no menu, que é sintético e já existia antes da tarefa.

Pergunta de fechamento: a tarefa não muda a resposta. A classificação diz respeito ao material da escola, não ao aluno, e nada aqui guarda ou envia dado de aluno.

Bloqueantes: nenhum.

Recomendações:
- O helper de teste `corrigirSecaoNoBanco` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/support/material.ts:1114`) grava a correção direto no banco e não passa pela auditoria. Para um seed de e2e isso serve, mas o comentário deveria dizer que ele simula a correção por fora e não é caminho do produto, para ninguém copiá-lo para código de verdade.
- A chave de cache `habilidadesDoMaterialQueryOptions` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/api/material.ts:986`) leva só o id do material. Hoje o isolamento depende de o cache ser limpo na troca de sessão, e o e2e de recomeço prova que é. Pôr a escola na chave seria uma segunda defesa, mas não é exigência.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-18 14:42:01 · `tasks/prd-classificacao-bncc/8_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum. É uma tela da coordenação, fora da sala, sem login, tutor, prova, fila nem chamada de modelo.
Rate limit: ok. As duas escritas novas da tela já passam pelos limites por hora do backend da 7.0 (`MaterialCorrigirGuard` e `MaterialReclassificarGuard` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/material.controller.ts:85` e `:98`). A tela mostra o 429 com o `Retry-After`.
Fila e prioridade: ok. "Reclassificar" só pede, e o backend responde 202 e manda o trabalho para a classificação da noite. A tela não faz nada demorado dentro do request.
Concorrência: protegida. O clique duplo em "Salvar correção" e em "Confirmar" passa pelo `useSingleSubmit`, e o teste do `fakeNetwork` prova que sai um `PUT` só. O `PUT` grava o conjunto de códigos, então repetir dá o mesmo resultado. A correção feita por outra pessoa com o editor aberto fecha o editor pela assinatura da seção (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx:138-149`). O `CONFLITO` e o `NAO_ENCONTRADO` mandam ler o material de novo.
Índice e paginação: ok. Não há query nova no banco. A seção usa o mesmo `GET /v1/materiais/:id` dos capítulos, com a mesma chave de cache, sem leitura a mais e sem polling novo. A lista de candidatas vem da tabela pública da BNCC, que tem tamanho limitado, e o seletor desenha no máximo 50 linhas.
Degradação de IA: não se aplica.
Migration: não se aplica.
Métrica e alerta: ok. Não há código novo no backend nem alerta novo.
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/api/material.ts:144-148`: `habilidadesDoMaterialQueryOptions` está sem `staleTime` e sem `refetchOnWindowFocus: false`. Ler de novo a cada abertura do editor é de propósito, mas também lê de novo toda vez que a pessoa volta para a aba com o editor aberto. Um `staleTime` curto, de uns 30 segundos, mantém o "recorte atual" sem essas leituras extras.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx:292-306`: a lista de capítulos desenha todas as seções sem virtualizar. Com uma apostila comum isso é aceitável. Vale anotar para quando a 11.0 ou a 13.0 medirem um material com muitas seções no Chromebook (regra 50, item 1).

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-18 14:42:34 · `tasks/prd-classificacao-bncc/8_task.md`

VEREDITO: REPROVADO
Escopo: invadiu tarefa futura
Aderência à Tech Spec: divergência em "Textos dos erros da API", registrada só no `8_task.md`
Portão local: carimbo válido

Bloqueantes:

1. **A ordem "as do capítulo primeiro" pertence à 11.0.** Arquivo: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/components/habilidades/SeletorDeHabilidades.tsx`, linhas 45-46, 50-54, 71 e 141.
   - **O que está errado:** a prop `primeiras` e a ordenação que ela faz em `linhasDoSeletor` são a regra da 11.3 ("as do capítulo primeiro; com a função suspensa, sem a prioridade das `origem: 'ia'`"). O teste dela é a linha 59 do `11_task.md`.
   - **Por que pesa:** nenhum caller da 8.0 passa `primeiras`, então hoje é código morto. Além disso, ele foi testado sem o contexto da troca da questão.
   - **Correção exigida:** tirar `primeiras` do seletor, de `EntradaDasLinhas` e do caso em `SeletorDeHabilidades.test.tsx:125-131`, que hoje cobre também "as `primeiras` vêm depois das escolhidas". A 11.0 acrescenta a prop quando chegar.

2. **Uma divergência ficou registrada só no `8_task.md`.** Arquivo: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/8_task.md:98`, item "Textos dos erros da API".
   - **O que está errado:** a tela ganhou textos que o `cenarios.md` não traz, todos em `classificacao.ts:443-444, 454-455`:
     - `ENTRADA_INVALIDA` e `NAO_ENCONTRADO` da correção;
     - `CONFLITO` e `NAO_ENCONTRADO` do reclassificar;
     - o `FUNCAO_SUSPENSA` do reclassificar, que repete o aviso da suspensão.
   - **O que falta também:** a regra de que essas falhas fazem a tela ler o material de novo (`falhaMudouAClassificacao`) não está na `techspec.md` §9. As outras divergências da lista entraram na techspec ou no cenarios; esta não.
   - **Correção exigida:** pôr esses textos no `cenarios.md`, "Telas", e uma linha na `techspec.md` §9 dizendo que NAO_ENCONTRADO, CONFLITO, ENTRADA_INVALIDA e FUNCAO_SUSPENSA fazem a tela ler o material de novo.

3. **O "Reclassificar" da linha continua ligado durante o pedido.** Arquivo: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx:167`.
   - **O que está errado:** o botão do capítulo que não terminou só desliga com `semComponente !== false`. O `docs/interface.md` que esta tarefa escreveu diz que, durante o pedido, tudo fica desligado.
   - **O bug, passo a passo:**
     1. A coordenação clica em "Confirmar", e o POST vai para a API.
     2. Antes da resposta, ela clica no "Reclassificar" da linha.
     3. Isso chama `pedir()`, e `pedir()` chama `mutacao.reset()` com o pedido ainda no ar.
     4. O observador da mutação se desliga: "Pedindo…" volta a "Confirmar", e o botão parece ligado mas não faz nada, porque a trava `noAr` do `useSingleSubmit` segura o clique.
     5. Quando a API responde, `mutacao.isSuccess` nunca fica verdadeiro. O resultado "Pedido feito. N capítulos…" não aparece e o foco não vai para ele.
   - **Correção exigida:** desligar o botão da linha enquanto `reclassificar.confirmando || reclassificar.mutacao.isPending`. Isso pode vir numa prop nova ou passando o estado do `useReclassificar` à linha. Também precisa de um caso unitário que clique no botão da linha com o pedido no ar e prove que o resultado aparece.

Recomendações:
- `classificacao.ts:472-474` (`codigosIniciaisDaCorrecao`): a habilidade que deixou de ser candidata sai do editor sem aviso. Se a pessoa clicar em "Salvar correção" sem mexer em nada, ela é apagada, mesmo continuando à vista na linha. Vale dizer na tela que ela não vale mais para o material.
- `Material.tsx:174-177`: se a lista de disciplinas falhar ou não trouxer a disciplina, `semComponente` fica `undefined` para sempre. "Corrigir" e "Reclassificar" ficam desligados sem nenhum texto que explique por quê.
- `api/material.ts` (`corrigirSecaoDoMaterial`): o cast `codigos as CorrigirSecaoRequest['codigos']` esconde do tipo o teto de 5 códigos. Seria melhor receber o tipo do contrato já na assinatura.
- Foto `coordenacao--coordenacao-material--Ciências-7-Vitrine--computador.png`: o painel lista os capítulos duas vezes, em "Capítulos" e de novo em "Habilidades da BNCC" (`PainelDoMaterial.tsx:207-208`). A tech spec e o `interface.md` pedem isso, mas a repetição pesa no celular. Fica para o `frontend-reviewer` e a retro.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-18 14:44:33 · `tasks/prd-classificacao-bncc/8_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:** os quatro estados do painel e do seletor; os cinco rótulos, mais o capítulo que a coordenação deixou sem habilidade; a origem com e sem suspensão; o nome do capítulo; o seletor de 0 a 5, com filtro por código e por texto; o "Corrigir" e o "Reclassificar" desligados sem componente e com a disciplina ainda não lida; a confirmação com N e M e o "Cancelar"; a falha do `PUT` (`CONFLITO`, 429) e do reclassificar (429, `FUNCAO_SUSPENSA`); o clique duplo; 1366 × 768, 360 px, axe e alvos; teclado e Esc; os quatro recomeços (B na mesma aba, X-Y-X, X segurada, `PUT` que falha).

**Cobertos:** todas as linhas da tabela têm teste com o nome citado. Rodei os três unitários (`ClassificacaoDoMaterial.test.tsx`, `classificacao.test.ts`, `SeletorDeHabilidades.test.tsx`): 57 passaram. Não há `.skip`, não há chamada de IA, e o clique duplo do `PUT` é concorrência de verdade (`dblClick` com o `PUT` pendente). Os 96 blocos, na maior parte, ficam vermelhos pelo motivo certo. Os bloqueantes abaixo são cláusulas novas sem bloco e dois blocos que só ficam vermelhos porque a tela quebra.

**Bloqueantes:**
1. **Bloco vermelho pelo motivo errado** em `tasks/prd-classificacao-bncc/8_task.md:512-517`. Trocar por `editando.assinatura === assinatura` lê `.assinatura` de `undefined` na primeira renderização e a linha lança erro, então a cláusula `aberta &&` (`ClassificacaoDoMaterial.tsx:138`) não é provada.
   - A mutação que roda é `editando?.assinatura === assinatura`, e ela sobrevive: no teste do clique duplo, `secao(1)` e `secao(2)` têm a mesma assinatura, os dois editores abrem e as asserções olham só dentro de cada linha.
   - A definição `aberta = editando?.secaoId === secao.id` (`ClassificacaoDoMaterial.tsx:137`) também não tem bloco.
   - Correção: um teste com dois capítulos de mesma assinatura, provando que "Corrigir" no primeiro não abre o seletor do segundo, e blocos para `:137` e para `editando?.assinatura === assinatura` citando esse teste.
2. **Bloco vermelho pelo motivo errado** em `8_task.md:802-807`. `return achada.componenteBncc === null` lança erro com a lista de disciplinas ainda não lida e derruba a tela inteira. Correção: usar `achada?.componenteBncc === null` (o "Corrigir" passa a ligar e o teste `Material.test.tsx` › "a lista de disciplinas ainda não lida" fica vermelho pelo motivo certo).
3. **"Corrigir" desligado sem componente, sem bloco:** `ClassificacaoDoMaterial.tsx:186`, `disabled={semComponente !== false}`. É linha da tabela ("sem componente, 'Corrigir' desabilitado"). Correção: um bloco `disabled={semComponente === true}`, que o caso "com a disciplina ainda não lida" pega, e um `disabled={false}` citando "sem componente: o aviso nomeia…".
4. **O "Reclassificar o material" da linha, sem bloco:** `ClassificacaoDoMaterial.tsx:167`, `disabled={semComponente !== false}`. Correção: um bloco citando "sem componente: o aviso nomeia…", que já checa esse botão na linha 211.
5. **Desligado durante o pedido, sem bloco:** `ClassificacaoDoMaterial.tsx:265` e `:268`, `disabled={mutacao.isPending}` no "Confirmar" e no "Cancelar". É linha da tabela ("desabilitado durante o pedido"). Correção: um bloco para cada um, citando "\"Confirmar\" manda o pedido uma vez…" (linhas 435 e 438 do teste).
6. **O teto do seletor, sem bloco:** `SeletorDeHabilidades.tsx:85`, `cheio = selecionados.length >= maximo`. É o limite do "o sexto bloqueado", e `>=` para `>` é a mutação clássica de limite. Correção: um bloco `>` citando "de 0 a 5: com cinco escolhidas…".
7. **`primeiras` sem bloco e sem teste pela peça:** `SeletorDeHabilidades.tsx:141`, `primeiras === undefined ? {} : { primeiras }`. Trocar por `{}` não deixa nenhum teste vermelho: `primeiras` só é testado em `linhasDoSeletor`, nunca passado ao componente. Correção: um teste que monta a peça com `primeiras` e confere a ordem das caixas, mais o bloco; ou tirar a prop até a 11.0.
8. **A ordem das linhas, sem bloco:** `SeletorDeHabilidades.tsx:51-53`, os filtros de `linhasDoSeletor` (`selecionados.includes`, `!selecionados.includes`, `primeiras.includes`, `!primeiras.includes`). É a regra "o que a pessoa escolheu fica sempre à vista". Correção: um bloco por negação, citando "o que a pessoa escolheu fica à vista no alto…".
9. **A seção não pede nada fora do pronto, sem bloco:** `ClassificacaoDoMaterial.tsx:320`, `enabled` com `material.estado === 'pronto'`. Correção: um bloco `true` citando "não pede nada à API e não desenha a seção".
10. **A leitura das candidatas, sem bloco e sem prova no unitário:** `api/material.ts`, `habilidadesDoMaterialQueryOptions`. Nem o `?materialId=` na rota nem o `id` na chave têm bloco, e a rede falsa responde a `/v1/habilidades-bncc` sem olhar a busca (`ClassificacaoDoMaterial.test.tsx:72`). O documento diz "a rota nos dois métodos", mas há três rotas novas. Correção: no "abre com o que o capítulo já tem", conferir que o `GET` leva `materialId=<id>`, e um bloco que tira o parâmetro.
11. **Plural do minuto, sem bloco:** `classificacao.ts:92`, `minutos === 1 ? 'minuto' : 'minutos'`. Correção: um bloco citando "o 429 diz em quantos minutos…".

**Recomendações:**
- `e2e/material-classificacao.spec.ts:398-400`: a ausência das habilidades do 7º ano é conferida logo depois de `segurada.abrir()`, e o `expect.poll(...).toBe(0)` passa na primeira volta, antes de a resposta de X chegar. É a armadilha que a própria tarefa cita. O teste se sustenta pela parte de antes da liberação; mesmo assim, esperar o `requestfinished` ou `requestfailed` do pedido de X antes de conferir.
- `e2e/material-classificacao.spec.ts:330`: depois do `pushState`, conferir com `toHaveURL` que o endereço do material de A está mesmo na aba de B, para as ausências não passarem sem a navegação ter acontecido.
- Um `dblClick` no "Confirmar" do reclassificar, como já existe no "Salvar correção" (regra 80, clique duplo).
- No e2e de "Reclassificar", o comentário diz que "a corrigida não foi tocada", mas nada confere isso. Falta conferir com `secoesNoBanco`.
- Medir também o alvo da linha do seletor (`min-h-11`) no projeto `celular`.
- `ClassificacaoDoMaterial.tsx:114`: o "Cancelar" do editor é desligado durante o `PUT`, sem teste nem bloco.
- `classificacao.ts:91`: com `Retry-After: 0`, o `Math.max(1, …)` não tem caso.
- `e2e/material-classificacao.spec.ts:139-142`: a indentação está quebrada dentro de `conferirOsRotulos`.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/components/habilidades/SeletorDeHabilidades.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/classificacao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/api/material.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/material-classificacao.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/8_task.md

## revisor-geral · 2ª rodada · APROVADO · 2026-11-18 15:16:03 · `tasks/prd-classificacao-bncc/8_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

As três correções da 1ª rodada foram feitas:

1. **Ordem "as do capítulo primeiro" (era da 11.0).** A prop `primeiras` saiu do `SeletorDeHabilidades`, de `EntradaDasLinhas` e de `linhasDoSeletor`. O caso de teste agora prova só o que é da 8.0: as escolhidas ficam no alto, sem repetir entre as achadas, e o `total` está certo. Nada mais no código usa `primeiras`.
2. **Textos dos erros da API.** O `cenarios.md`, em "Telas", agora traz os cinco textos. Conferi um por um contra `classificacao.ts:100-101` e `classificacao.ts:111-112`, e batem: `ENTRADA_INVALIDA` e `NAO_ENCONTRADO` da correção, `FUNCAO_SUSPENSA`, `CONFLITO` e `NAO_ENCONTRADO` do reclassificar. A `techspec.md` §9 ganhou a linha que diz que os quatro códigos fazem a tela ler o material de novo, e ela corresponde a `falhaMudouAClassificacao` (`classificacao.ts:118-123`).
3. **"Reclassificar" da linha durante o pedido.** O botão agora fica desligado com `semComponente !== false || reclassificando`, ligado a `reclassificar.confirmando` (`ClassificacaoDoMaterial.tsx:169` e `:305`). Isso cobre o pedido no ar. O `confirmando` só volta a falso no `onSuccess`, depois do `recarregar()`, ou no `onError` (`:212-219`). Então o botão segue desligado enquanto `isPending` for verdadeiro e o `mutacao.reset()` não roda com o pedido no ar. O caso unitário (`ClassificacaoDoMaterial.test.tsx:449-457`) clica no botão da linha com o pedido no ar. Depois disso confere que "Pedido feito. 2 capítulos…" aparece e recebe o foco.

O resto do diff fica dentro do escopo da 8.0: o e2e mede o alvo da linha do seletor e confere a seção corrigida no banco, há o caso da chave das candidatas por material, o texto do `Retry-After: 0`, o `Cancelar` do editor desligado durante o `PUT`, e as linhas novas no `TODO.md`. Na foto do seletor aberto aparecem "Sugerida pela IA", o aviso da correção e "1 de 5 escolhidas", com os nomes do `cenarios.md`. A foto não mostra nada fora do que a tarefa pede.

Recomendações:
- `apps/web/src/areas/coordenacao/material/api/material.ts:165`: o `corrigirSecaoRequestSchema.parse` lança `ZodError` no cliente, e não `ApiError`. Se um dia passar código fora do contrato, a tela cai no texto genérico de erro, e não no de `ENTRADA_INVALIDA`. Hoje os códigos vêm da lista de candidatas e isso não acontece. Vale registrar, ou converter para o erro tipado, quando a 11.0 reaproveitar o caminho.
- O nome `reclassificando` (prop de `CapituloRow`) recebe `confirmando`, que também cobre a confirmação aberta antes do pedido. O comentário JSDoc explica isso. Um nome como `reclassificarAberto` deixaria a leitura mais direta.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-18 15:16:23 · `tasks/prd-classificacao-bncc/8_task.md`

VEREDITO: APROVADO
Tela vista: sim (10 fotos lidas: lista, painel e seletor aberto, no computador e no celular, na escola cheia; lista vazia, no computador e no celular). O painel não abre na escola vazia, então não há foto dele nesse caso.
Estados: ok. Com dado, vazio ("Nenhum material ainda" com o próximo passo "Enviar material") e erro com "Tentar de novo" estão cobertos. Carregando e erro só conferi pelo código e pelo e2e, como o processo prevê. O seletor segue com carregando, erro e sem componente.
Acessibilidade: ok. O seletor é um grupo rotulado, com foco no filtro ao abrir (anel azul visível na foto). O Esc fecha. Os botões "Reclassificar" e "Corrigir" têm nome acessível, e o e2e roda axe. O e2e novo mede a altura da linha do seletor: 24 px no computador e 44 px no celular.
Chromebook fraco: ok. A lista do seletor mostra no máximo 50 linhas e diz quantas há. A tela não tem imagem nem upload novo.
Celular: ok. As fotos de 360 px não têm rolagem horizontal, nem texto cortado ou sobreposto. As ações principais ("Reclassificar", "Corrigir", "Excluir material") têm pelo menos 44 px. Nada depende de hover. O fluxo não exige o celular. A medida do e2e (sem rolagem lateral, axe e alvo de toque) continua no projeto `celular`.
Ação oficial protegida: sim. O "Reclassificar" pede confirmação com a contagem de capítulos que refaz e dos que ficam. Com a confirmação aberta ou o pedido no ar, os dois botões "Reclassificar" ficam desligados, e o teste prova isso com `dblClick`. "Salvar correção" desliga com o pedido no ar e não repete. A origem "Sugerida pela IA" aparece nas fotos, então a marca de IA está presente.

A rodada anterior não pediu correção. Auditei só o diff desta rodada:

- **Botão do capítulo** (`ClassificacaoDoMaterial.tsx:94` e `:305`): a nova prop `reclassificando` desliga o "Reclassificar" do capítulo enquanto a confirmação está aberta ou o pedido está no ar. Os testes `ClassificacaoDoMaterial.test.tsx:421-452` cobrem os dois casos.
- **Corpo do `PUT`** (`material.ts:164`): `corrigirSecaoRequestSchema.parse` substitui o `as`. Os códigos vêm da lista da API, então não vi caminho em que a validação lance erro na tela.
- **Seletor** (`SeletorDeHabilidades.tsx`): a prop `primeiras` saiu e nada mais a usa (conferi com grep). O teste foi ajustado.
- **Retry-After 0:** o texto diz "1 minuto", e há teste para isso.
- **e2e:** o novo aguarda a liberação da rota de X, confere a URL antes das ausências e confere no banco que a seção corrigida não foi tocada.
- **Documentos:** `cenarios.md` e `techspec.md` ganharam os textos das falhas do `PUT` e do "Reclassificar".

Bloqueantes: nenhum.

Recomendações (já estão no `TODO.md`, nenhuma bloqueia):
- O painel mostra os capítulos duas vezes, em "Capítulos" e em "Habilidades da BNCC" (foto `…Ciências-7-Vitrine--celular.png`). A `techspec.md` §9 e o `docs/interface.md` pedem as duas listas, então a decisão é de produto.
- O rodapé fixo do painel ocupa cerca de um terço da altura a 360 px com o seletor aberto (foto `…nth-0--celular.png`: o campo de filtro fica quase escondido atrás dele). Vale rever quando a 11.0 mexer no painel.
- Enquanto a lista de disciplinas não chega, "Reclassificar" e "Corrigir" ficam desligados sem texto explicando.

Arquivos principais:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/api/material.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/components/habilidades/SeletorDeHabilidades.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/material-classificacao.spec.ts`

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-18 15:16:39 · `tasks/prd-classificacao-bncc/8_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta rodada. O diff só toca a tela do material, o seletor de habilidades, os testes e a documentação. O único caminho novo de escrita fica no helper de e2e `corrigirSecaoNoBanco` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/support/material.ts:340-349`). Ele grava em `habilidade_da_secao`, não em `Nota`, e agora diz por escrito que é só o seed do teste e que pula a auditoria do produto. Todos com autor humano? Sim, não há nenhum.

Decisão autônoma sobre aluno: ausente. A classificação BNCC trata do material, não do aluno.

Aprovação registrada: ok.
- A sugestão da IA aparece rotulada "Sugerida pela IA" nas fotos `coordenacao--coordenacao-material--Ciências-7-Vitrine-button-has-text-Corrigir-visible-true-nth-0--computador.png` e `--celular.png`.
- A correção da coordenação vale no lugar da IA, e o texto da tela diz isso ("A correção vale no lugar da IA e não é refeita ao reclassificar").
- O `PUT` agora passa por `corrigirSecaoRequestSchema.parse` (`apps/web/src/areas/coordenacao/material/api/material.ts:140`). Esse schema é `strictObject` só com `codigos` (`packages/shared/src/material/material.ts:303-308`), então a coordenação não consegue mandar `artefatoId`. Isso fecha o item do `TODO.md` que a 7.0 deixou para a 8.0.

Supervisão do tutor: ok. O tutor não é tocado.

Autonomia declarada e visível: sim. Nada mudou nesta rodada.

O resto do que eu verifico:
- **Sem nota nem conceito na tela.** Nenhuma foto mostra nota, conceito ou sugestão de nota, inclusive a da escola vazia. O e2e confere isso de fato contra `VOCABULARIO_DE_NOTA`: a correção da indentação em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/material-classificacao.spec.ts:139-241` pôs a checagem de volta dentro de `conferirOsRotulos`. Antes ela estava fora da função.
- **Uso excessivo e saída (D59).** Nenhuma tela induz uso nem dificulta sair.
- **Supervisão e indicador de professor.** Nada no diff cria vigilância nem indicador de professor.
- **Auditoria.** O novo assert do e2e (`e2e/material-classificacao.spec.ts:291-295`) prova que, depois de reclassificar, a seção corrigida pela coordenação continua com `origem: 'coordenacao'` e `corrigida: true`. Assim, a pergunta "quem decidiu, a IA ou a coordenação" continua com resposta.

Bloqueantes: nenhum.

Recomendações:
- Fica a que já está no `TODO.md`: distinguir "confirmada" de "alterada" na correção e na auditoria. A retro decide. Hoje o selo some depois do "Salvar correção" mesmo quando nada mudou, e isso não se distingue de uma troca.
- A habilidade que deixa de ser candidata sai do editor sem aviso, e salvar sem mexer em nada a apaga. Já está registrado no `TODO.md`. Para a regra 70 importa porque a sugestão da IA é descartada sem a coordenação perceber. Convém resolver antes da 11.0 reaproveitar o seletor com o professor.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-18 15:16:56 · `tasks/prd-classificacao-bncc/8_task.md`

VEREDITO: APROVADO

Esta segunda rodada auditou o diff desde a primeira (`f8d13c90` até `c9b5b097`) e as oito fotos refeitas. A primeira rodada não exigiu correção nenhuma, então não havia nada pendente a conferir.

Campos pessoais tocados: nenhum. O diff só mexe no frontend (`ClassificacaoDoMaterial.tsx`, `SeletorDeHabilidades.tsx`, `api/material.ts`), nos testes, no e2e e nos documentos da tarefa. Não há migration, DTO de saída nem campo novo. O que circula são id do material, id do capítulo e códigos da BNCC, que são tabela pública.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok.
- Nenhuma rota nova nesta rodada.
- O e2e de recomeço (`e2e/material-classificacao.spec.ts:340-344`) agora confere que o endereço do material da escola A está mesmo na aba da coordenação de B antes de checar que nada aparece. Antes, o teste podia passar sem ter navegado.
- A chave de cache das candidatas leva o id do material, e há teste novo provando isso (`apps/web/src/areas/coordenacao/material/api/material.test.ts`).

Logs: limpos. O diff não acrescenta log nem console. O `corrigirSecaoRequestSchema.parse` em `api/material.ts:164-165`, se falhar, só carrega códigos da BNCC.

Auditoria: presente no caminho do produto (o `PUT` e o reclassificar da 7.0 não mudaram). O helper de e2e `corrigirSecaoNoBanco` (`e2e/support/material.ts:336-339`) grava direto no banco, sem auditoria. Agora isso está escrito no comentário dele: só simula uma correção feita por outra aba e não serve de exemplo para código de verdade.

Envio externo: nenhum novo nesta rodada.

Seed/fixture: sintético. As fotos mostram "Colégio sintético da vitrine cheia bb200f56", "Coordenadora sintética e93587cb" e "Ciências sintética 3c115d5b". Os ids dos testes também são sintéticos.

Fotos:
- Nenhuma mostra dado de aluno.
- O painel do material só mostra capítulo, páginas, código e descrição da BNCC, o selo "Sugerida pela IA" e o seletor.
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/.processo/vitrine/coordenacao--coordenacao-material--Ciências-7-Vitrine-button-has-text-Corrigir-visible-true-nth-0--computador.png` e na versão `--celular.png`, o seletor aberto não oferece `artefatoId` à coordenação.
- A escola vazia (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/.processo/vitrine/vazia--coordenacao--coordenacao-material--celular.png`) mostra só o estado vazio.

Pergunta de fechamento: nesta rodada não há dado novo de aluno nem envio novo, então nada muda na resposta que o código já dava sobre o que guarda de um aluno e para onde enviou.

Bloqueantes: nenhum.

Recomendações:
- Manter a recusa já registrada sobre não pôr a escola na chave de cache das candidatas. A troca de sessão limpa o cache, e o e2e de recomeço, agora mais forte, prova isso. Se um dia o cache sobreviver à troca de sessão, a escola entra na chave de todas as consultas da tela.
- `corrigirSecaoNoBanco` (`e2e/support/material.ts:340`) poderia ficar num módulo de suporte de e2e com nome que diga que pula a auditoria (por exemplo `semAuditoria`), para ninguém copiá-lo para fora do e2e.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-18 15:17:03 · `tasks/prd-classificacao-bncc/8_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- A 1ª rodada não exigiu correção, e o diff desta rodada só mexe na tela da coordenação, no e2e e nos documentos. Não toca API, fila, gateway de IA, migration nem query.
- O clique duplo no "Reclassificar" está fechado. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx:94` e `:305`, o botão do capítulo agora fica desligado pelo mesmo `confirmando` do botão do alto, e esse `confirmando` só volta a `false` depois do `recarregar()` em `:212-215`. Com isso, nenhum botão manda um segundo `POST` enquanto o primeiro está no ar. A prova é o `dblClick` no "Confirmar" em `ClassificacaoDoMaterial.test.tsx`, que conta um `POST` só. Isso protege só a tela. A guarda contra job duplicado continua sendo a idempotência do lado da API, que foi auditada na 7.0.
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/api/material.ts:165`, o `corrigirSecaoRequestSchema.parse` barra antes de sair um pedido que a API recusaria (mais de 5 códigos, ou código fora da BNCC). Isso tira carga inútil da API e não tem efeito colateral. A falha do `parse` volta como erro da mutação, e o texto que a tela mostra nesse caso não é coberto por teste. É coisa do `frontend-reviewer`, não bloqueia aqui.
- Continua valendo a recomendação da 1ª rodada que ficou sem aplicar, com destino registrado na 13.0: virtualizar a lista de capítulos quando o material tiver muitas seções.

## test-engineer · 2ª rodada · APROVADO · 2026-11-18 15:17:44 · `tasks/prd-classificacao-bncc/8_task.md`

VEREDITO: APROVADO

Cenários exigidos: as 11 correções da 1ª rodada. Desta vez audito só o diff da f8d13c90 à c9b5b097 e o que ele afeta: o `reclassificando` novo na linha do capítulo, o `.parse` no `PUT` e os ajustes do e2e.

Cobertos (as 11 correções foram feitas):
1. **Dois capítulos de mesma marca.** Em "o clique duplo em…", `secao(1)` e `secao(2)` dão a mesma assinatura, porque `assinaturaDaSecao` só junta situação, corrigida e habilidades. O teste confere que o segundo capítulo fica sem `group` e com `aria-expanded="false"`. Os dois blocos novos deixam o segundo editor aberto e ficam vermelhos na linha 322, pelo motivo certo.
2. **`achada?.componenteBncc === null`.** Com a lista ainda não lida, o "Corrigir" liga e `Material.test.tsx:1816` fica vermelho pelo motivo certo.
3. **"Corrigir" desligado.** Há dois blocos: `disabled={false}` (cai na linha 209) e `semComponente === true` (cai na linha 218).
4. **"Reclassificar o material" da linha.** O bloco `disabled={reclassificando}` cai na linha 211.
5. **Botões desligados durante o pedido.** "Confirmar" e "Cancelar" da confirmação caem nas linhas 444 e 447. O "Cancelar" do editor tem asserção nova (linha 319) e bloco. O `dblClick` no "Confirmar" agora prova um `POST` só.
6. **O teto do seletor.** O bloco `>` cai em `SeletorDeHabilidades.test.tsx:102`.
7. **`primeiras`.** A prop saiu da peça, de `EntradaDasLinhas` e do teste. O grep não acha mais uso no código.
8. **Ordem das linhas.** Há um bloco por negação (`escolhidas` e `achadas`), e os dois caem na ordem `['EF06CI07','EF06CI05']`.
9. **Fora do pronto.** O bloco `enabled: true` cita "não pede nada à API…".
10. **Leitura das candidatas.** A asserção da linha 262 confere `?materialId=<id>` no caminho registrado (o `pedidosDe` corta a busca, mas o `caminho` a guarda), com um bloco que tira o parâmetro. O `api/material.test.ts` prova o id na chave, com bloco, e virou linha da tabela de testes.
11. **Plural do minuto.** Há o bloco do plural, mais o do `Math.max`, provado pelo caso novo `textoDoLimiteDaClassificacao(0)`.

Também conferi:
- **O `reclassificando` novo.** Tem três blocos: tirar o termo, tirar o `semComponente` e a fiação `reclassificando={false}`. Os testes conferem o botão da linha desligado com a confirmação aberta (linha 425) e com o pedido no ar (linhas 450 a 453).
- **`--faltando`.** Diz: "Nenhuma linha nova de produção com condição fica sem bloco".
- **Testes rodados.** `npx vitest run` em `apps/web/src/areas/coordenacao/material` e `apps/web/src/components/habilidades` deu 15 arquivos e 331 testes verdes, sem `.skip` e sem mock da regra.
- **e2e.** Três asserções novas:
  - o alvo da linha do seletor: 24 px no `chromebook`, 44 px no `celular`;
  - o capítulo corrigido continua intacto no banco depois do reclassificar;
  - a URL do material de A está mesmo na aba de B.

  A corrida de X e Y agora espera a liberação de X (`liberadoDeX`) antes de conferir o seletor de Y, em vez de depender do tempo.

Bloqueantes: nenhum.

Recomendações:
- `apps/web/src/areas/coordenacao/material/api/material.ts:165`: o `corrigirSecaoRequestSchema.parse({ codigos })` é validação nova no cliente (teto de 5, código da tabela, sem repetição), e nenhum teste nem bloco a prova. Trocar por `{ codigos }` não deixa nada vermelho. A tela não chega a esse caso, porque o seletor trava em 5 e as candidatas vêm da tabela, e quem decide é o servidor. Por isso não bloqueia. Vale um teste que mande 6 códigos e confira que nenhum `PUT` sai, ou a linha `**Sem mutação:**` com o motivo.
- `e2e/material-classificacao.spec.ts:417`: o `rota.fallback().catch(() => undefined)` engole qualquer erro, não só o do pedido cancelado. Melhor aceitar só o erro de rota já tratada ou cancelada.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.test.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/ClassificacaoDoMaterial.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/api/material.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/coordenacao/material/api/material.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/components/habilidades/SeletorDeHabilidades.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/8_task.md`
