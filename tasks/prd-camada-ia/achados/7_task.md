# Achados das revisões — `tasks/prd-camada-ia/7_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-21 07:48:58 · `tasks/prd-camada-ia/7_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa só mexe na web da Operação (`/operacao`, aba Escolas) e no `docs/interface.md`. O único pedido que grava algo é o `PUT /v1/operacao/{redes|escolas}/:id/orcamento-ia`, que muda o orçamento de IA da rede ou da escola. Todos com autor humano? Não se aplica, porque nada escreve em `Nota`.

Decisão autônoma sobre aluno: ausente. O diálogo define quanto se gasta de IA por aluno por mês e o teto de segurança. Ele não decide aprovação, reprovação nem encaminhamento de ninguém. Acima do teto só o trabalho em lote espera e o resto da IA continua (texto em `apps/web/src/operacao/textos.ts`, `DICA_DO_TETO_DA_REDE` e `DICA_DO_TETO_DA_ESCOLA`). Isso vem da tarefa 4.0 e não é decisão sobre a trajetória do aluno.

Aprovação registrada: ok, e não se aplica aqui. Nenhuma saída de IA é criada, mostrada ou aprovada nesta tarefa. A ação é do operador da equipe Turmma, e ele vê o antes e o depois antes de "Salvar orçamento" (`apps/web/src/operacao/components/DialogoDoOrcamento.tsx:207-217` e `:342`). Quem grava a auditoria da troca de orçamento é a API da tarefa 3.0, que não muda aqui.

Supervisão do tutor: ok. O tutor não é tocado.

Autonomia declarada e visível: sim, sem mudança. Nenhum agente foi criado nem teve o nível alterado.

Outros itens:
- **Itens 6 e 7:** a auditoria e a supervisão sem vigilância não mudam. Nada mede comportamento nem infere emoção.
- **Item 8 (D46 e D55):** não há campo, tela nem prompt com nota, conceito ou sugestão de nota. Procurei no diff por nota, conceito, tutor, professor, ranking, `lancadaPor` e aprovação, e só aparece "por aluno" como unidade de dinheiro.
- **Item 9 (D45 e D64):** não há métrica de professor, ranking nem lista nominal de adoção. O que aparece é uma contagem agregada de escolas, "Muda o orçamento de N escolas…" (`textos.ts`, `textoDasEscolasQueMudam`).
- **D59:** "Cancelar" está ao lado de "Salvar orçamento" e não é mais difícil de usar do que ele (`DialogoDoOrcamento.tsx:246-262`). Nada induz uso.

Fotos da tela: não havia. A vitrine não tem o papel de operador, então auditei pelo código e pelos testes de unidade e de e2e (`e2e/operacao-escolas.spec.ts`).

Bloqueantes: nenhum.

Recomendações:
- Quando a tarefa 8.0 abrir este diálogo pela aba Uso, confira de novo que essa aba continua mostrando só números por escola, sem nada por professor nem por aluno com nome.
- Quando a vitrine ganhar o papel de operador, inclua `/operacao` nas fotos, para os próximos revisores verem o diálogo como ele chega à pessoa.

Arquivos revisados:
- apps/web/src/operacao/components/DialogoDoOrcamento.tsx
- apps/web/src/operacao/pages/Escolas.tsx
- apps/web/src/operacao/textos.ts
- apps/web/src/operacao/api/painel.ts
- docs/interface.md

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-21 07:49:01 · `tasks/prd-camada-ia/7_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A tarefa mexe só no frontend da Operação e lida com o orçamento de IA da rede e da escola: valor por aluno em micros e centavos, teto em %, de onde vem cada valor e `escolasQueUsamOValorDaRede`, que é só um número. Os dados são da instituição, não de pessoa. O nome da rede e o da escola aparecem no rótulo acessível do botão (`apps/web/src/operacao/pages/Escolas.tsx`, `AcaoDoOrcamento`) e no cabeçalho do diálogo. São nomes de instituição e o papel operador já os via na lista.

Fora da tabela de dados do docs/lgpd.md: nada. Nenhum campo novo, nenhuma migration.

Autorização por objeto: ok. Não há rota nova. Os dois `PUT /v1/operacao/{redes|escolas}/:id/orcamento-ia` e as `GET` estendidas vêm da 3.0, já auditada. O cliente monta o caminho com `encodeURIComponent(alvo.id)` (`apps/web/src/operacao/api/painel.ts`, `definirOrcamentoNoPainel`) e a autorização continua no servidor, com o operador.

Logs: limpos. Não há `console` nem logger nos arquivos novos ou alterados. A resposta fora do contrato vira `RespostaForaDoContrato` (`ERRO_INTERNO`) sem levar o erro do zod nem o corpo da resposta, e a tela mostra só "Atualize a página…". O 429 e o 503 passam pelo `textoDaFalha` que já existia.

Auditoria: presente. A alteração de orçamento é registrada pela API da 3.0, que grava e audita só quando o valor muda. Nesta tarefa não há ação nova que a regra 20, item 10, obrigue a auditar: nenhuma leitura de dado de aluno, exportação, nota, permissão ou aprovação de saída de IA.

Envio externo: nenhum. A tarefa não chama provedor de IA e não manda nada para fora.

Seed/fixture: sintético. `apps/web/src/operacao/__fixtures__/render-operacao-screen.tsx` usa "Rede Sintética", "Escola Sintética N" e UUIDs gerados. O e2e semeia redes e escolas próprias pelo `e2e/support/painel.ts`, que já existia.

Pergunta de fechamento: a tarefa não muda o que o sistema guarda sobre um aluno nem para onde isso vai. A resposta à secretaria continua a mesma de antes.

Bloqueantes: nenhum.

Recomendações:
- `apps/web/src/operacao/api/painel.ts`: `lidoPeloContrato` passou a valer também para `dasRedesQueryOptions`, que o diálogo Nova escola usa. O efeito é bom: a web desatualizada pede para atualizar a página. Mas a JSDoc diz "Só as chamadas do orçamento de IA o usam", e isso já não é verdade. Vale corrigir o comentário para não confundir uma auditoria futura.
- Quando houver o papel operador em `tools/vitrine`, vale conferir pela tela que o diálogo e a linha não mostram nada além de nome de instituição e números. Nesta rodada não houve fotos; revisei pelo código e pelos testes de unidade e de e2e.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-21 07:49:09 · `tasks/prd-camada-ia/7_task.md`

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
- `apps/web/src/operacao/components/DialogoDoOrcamento.tsx:158`: o `onSuccess` espera as três invalidações (`await Promise.all(...invalidateQueries)`) antes de chamar `aoSalvar()`. Com a lista de escolas ou o Uso lentos, o diálogo fica em "Salvando…" depois de o `PUT` já ter gravado. Há duas saídas: chamar `aoSalvar()` antes e invalidar sem esperar, ou garantir que o refetch tem o mesmo timeout do cliente. Não bloqueia, porque a Operação é tela interna, fora do horário de aula da escola.
- `apps/web/src/operacao/api/painel.ts:50`: o `GET /v1/operacao/redes` continua sem paginação e agora também é lido em cada abertura do diálogo de orçamento. Para dez escolas e poucas redes está dentro do modelo de carga da D25. Vale registrar no `TODO.md` que essa lista precisa ser paginada antes de crescer o número de redes. Também é preciso confirmar que a contagem `escolasQueUsamOValorDaRede`, que vem da 3.0, não é feita com uma consulta por rede.
- Dois operadores salvando o mesmo orçamento ao mesmo tempo: vale o último que salvou. O `PUT` manda o estado inteiro e é idempotente, então nada fica pela metade. Se a Operação crescer, vale pensar num controle por versão do registro (`If-Match`), para que o segundo operador veja que o valor mudou desde que abriu o diálogo.

Notas da auditoria:
- O diff só mexe no `apps/web`, no `e2e` e no `docs`. Nada em `apps/api` nem em `packages`, então não há query, migration, fila nem chamada de IA nova.
- O clique duplo está protegido de duas formas. No front, a trava `noAr` (ref) em `DialogoDoOrcamento.tsx:312-316` segura o segundo envio antes de o botão ser desligado, e há teste para dois envios seguidos e para o clique duplo. Do lado da API, o `PUT` é idempotente.
- O 429 aparece com os minutos tirados do `Retry-After`, coberto por `DialogoDoOrcamento.test.tsx:420`. O limitador em si é da 3.0 e não muda aqui.
- Nenhum teste chama provedor pago. Os dois arquivos de e2e (`e2e/operacao-escolas.spec.ts` e `e2e/operacao-convite-coordenacao.spec.ts`) só interceptam as rotas da própria API.
- Não rodei os testes de unidade nem o Playwright. A auditoria foi feita pela leitura do código e dos testes.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-21 07:49:10 · `tasks/prd-camada-ia/7_task.md`

VEREDITO: APROVADO

Tela vista: não. A vitrine não tem o papel operador (`/operacao`), então revisei pelo código e pelos testes. Não rodei o e2e (`operacao-escolas.spec.ts`, projetos `chromebook` e `celular`), porque ele precisa da API de verdade. Rodei `npx vitest run --project unidade apps/web/src/operacao/` (14 arquivos, 173 testes, todos verdes) e `tsc --noEmit` na web, sem erro. A tela será vista na validação: o diálogo Orçamento de IA, aberto na rede e na escola, em 1366 px e em 360 px.

Estados: ok. Em `DialogoDoOrcamento.tsx:91-113` há carregando (`LoadingState` "Carregando o orçamento…"), erro ("Não foi possível carregar." com "Tentar de novo" e "Cancelar") e o caso da web antiga com a API nova ("Atualize a página", sem "Tentar de novo"). O formulário é o estado com dado. Os casos de unidade correspondentes existem. O "vazio" não se aplica: o diálogo sempre tem formulário. A rede ou a escola sem orçamento abre com "Vale hoje: sem valor por aluno." e campos em branco, ou com a caixa marcada.

Acessibilidade: ok.
- Todo campo tem rótulo visível, e a dica fica ligada por `aria-describedby`.
- O erro de campo é `role="alert"`, com `aria-invalid` e `aria-describedby` apontando para ele (`:190-193`). Nada vai à API enquanto o campo está inválido (`:314`).
- "Salvar orçamento" é descrito pelo antes e depois (`:250`) e anuncia "Salvando o orçamento…" por `role="status"`.
- O `Dialog` prende o foco e o devolve a quem abriu. O foco vai ao primeiro campo quando a lista chega com o diálogo já aberto (`:301-304`).
- O nome acessível do botão da linha diz de quem é o orçamento: "da rede X" ou "da escola Y" (`Escolas.tsx`, `AcaoDoOrcamento`).
- Os textos de erro usam `text-erro` sobre `bg-erro-cx`, o mesmo padrão de outras telas do produto.
- O e2e cobre Tab e Enter do começo ao fim, Esc, foco preso e `seriousViolations`.

Chromebook fraco: ok. O diálogo é pequeno e não traz lista, então a virtualização e a compressão de imagem não se aplicam. A lista de redes reaproveita o cache do Nova escola. O clique duplo é segurado pela trava `noAr` (`:293`, `:312`) e o `PUT` é idempotente. Não houve teste com throttling de CPU e de rede, mas não há lista longa nem upload nesta tela.

Celular: ok pelo código; falta ver a tela.
- Os botões usam `min-h-11` e `min-w-11` (44 px), a caixa "Usar o valor da rede" tem 24 px dentro de linha `min-h-11`, e os campos têm 48 px.
- Os textos usam `wrap-anywhere`, e `inputMode` decimal e numérico, com `autoComplete="off"`.
- Nada depende de hover ou de atalho.
- A ação está na tabela e no cartão do celular, e Salvar e Cancelar têm o mesmo tamanho (D59).
- O e2e `operacao-escolas.spec.ts` › "o erro de cada campo…" mede o botão, a caixa e os campos, e confere `horizontalOverflow` e `larguraExcedenteDoDialogo`. Ele roda nos dois projetos, mas eu não o executei.

Ação oficial protegida: sim. O antes e o depois aparecem antes de "Salvar orçamento" (`:342`). Na rede, aparece também "Muda o orçamento de N escolas…". O botão só envia depois de o pedido passar pelo mesmo contrato estrito da API. O resultado é anunciado ("Orçamento salvo.").

Bloqueantes: nenhum.

Recomendações:
1. `DialogoDoOrcamento.tsx:55-62`: `ErroDoCampo` repete o desenho do `FieldError` (`components/ui/fields/FormField.tsx`), só para pôr `role="alert"`. Convém dar ao `FieldError` uma propriedade `anunciado`, para o desenho ficar numa só peça. Não bloqueia: o `role="alert"` vem do cenário e o visual é idêntico.
2. `DialogoDoOrcamento.tsx:210`, `textos.ts` (`textoDasEscolasQueMudam`): a contagem é de escolas "que usam o valor da rede". Quando só o teto muda, a frase fala de "valor" e deixa de fora as escolas que têm valor próprio e usam o teto da rede. Vale reformular ou ajustar a contagem para ela dizer a verdade nos dois casos.
3. Na tabela, as duas ações da mesma linha têm o mesmo texto visível, "Orçamento de IA". Só a posição (sob o nome da rede ou sob o nome da escola) e o nome acessível as distinguem. Um complemento visível curto, como "da rede" e "da escola", ajudaria quem enxerga.
4. Quando a tela da Operação entrar na vitrine, fotografar o diálogo em 1366 e 360 px, na rede e na escola, vazio e cheio.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-21 07:49:55 · `tasks/prd-camada-ia/7_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

O que conferi: os dois `PUT` em `/v1/operacao/{redes|escolas}/:id/orcamento-ia` usam o contrato de `packages/shared` (`orcamentoDeIaRequestSchema` e `orcamentoDeIaDoPainelSchema`). O "Depois" é calculado por `orcamentoDaRedeNoPainel` e `orcamentoDaEscolaNoPainel`, sem conta própria na tela. As três listas são invalidadas ao salvar. Os textos são os da `cenarios.md` §4, e os limites saem das constantes do contrato. A aba Uso (8.0) e a API (3.0) não foram tocadas. Não achei `.skip`, `any`, `TODO` nem `eslint-disable` no diff.

Recomendações:
1. `apps/web/src/operacao/api/painel.ts:95`: o comentário diz "Só as chamadas do orçamento de IA o usam", mas `lidoPeloContrato` também passou a envolver `dasRedesQueryOptions`, que o Nova escola usa (`apps/web/src/operacao/pages/NovaEscola.tsx:47`). Com isso, o Nova escola também passa a dizer "Atualize a página" quando a lista de redes vem fora do contrato. O efeito é aceitável, mas o comentário está errado e o efeito colateral não aparece no `7_task.md`.
2. `apps/web/src/operacao/textos.ts:51`: `RespostaForaDoContrato` é uma segunda forma de tratar a resposta fora do contrato. `apps/web/src/api/client.ts:157` já lança `ApiError(ERRO_INTERNO)` nesse caso. A classe ficou num módulo de textos e só vale para a Operação, e a 6.0 e a 8.0 pedem o mesmo "Atualize a página". O melhor é levá-la para a camada de `api/` (ou para o próprio `client.ts`) antes que outra linha crie uma terceira forma.
3. `apps/web/src/operacao/textos.ts:210`: `textoDoErroAoSalvar` só repassa para `textoDaFalha`, sem fazer mais nada. Dá para tirá-la e chamar `textoDaFalha` direto em `DialogoDoOrcamento.tsx:233`.
4. `apps/web/src/operacao/pages/Escolas.tsx:280-303`: os dois blocos do `DialogoDoOrcamento` repetem o mesmo `aoSalvar` e o mesmo `focoDeReserva`. Basta um bloco, com o `alvo` calculado pelo tipo.
5. A "linha da rede" virou um botão na coluna Rede de cada escola, porque a tela não tem linha de rede. Uma rede com N escolas mostra N botões iguais. A escolha está documentada em `docs/interface.md` §5a, mas convém registrá-la também na tabela de divergências do `7_task.md`, já que a Tech Spec §9 só diz "(rede e escola)".

Arquivos revisados:
- apps/web/src/operacao/components/DialogoDoOrcamento.tsx
- apps/web/src/operacao/pages/Escolas.tsx
- apps/web/src/operacao/api/painel.ts
- apps/web/src/operacao/pedidos-do-painel.ts
- apps/web/src/operacao/textos.ts
- docs/interface.md

## test-engineer · 1ª rodada · REPROVADO · 2026-11-21 07:51:21 · `tasks/prd-camada-ia/7_task.md`

**VEREDITO: REPROVADO**

**Cenários exigidos:**
- **Caminho feliz:** a rede e a escola definem o orçamento, veem o antes e o depois, salvam, e a tela anuncia "Orçamento salvo." e lê de novo as listas de redes, de escolas e de uso.
- **Bordas:**
  - escola sem valor próprio e escola com valor próprio;
  - "Usar o valor da rede" manda `null`;
  - na rede, o valor em branco é "sem valor";
  - os limites dos dois lados (R$ 0,00 e R$ 0,01, R$ 100,00 e R$ 100,01, 99% e 100%, 1000% e 1001%);
  - mais de duas casas decimais, e texto no campo;
  - na rede, 0, 1 e 3 escolas que usam o valor dela;
  - só o teto muda;
  - a rede some da lista;
  - a web antiga lendo a API nova;
  - 429 com `Retry-After`.
- **Concorrência:** dois envios seguidos e clique duplo; a resposta do `PUT` que chega depois de o diálogo fechar.
- **Permissão:** o `PUT` vai com a sessão do operador. O resto da permissão é da API (3.0).
- **Isolamento:** não há repository nem rota nova. O que esta tarefa tem de "isolamento" é o diálogo ler o orçamento da rede certa e não de outra.
- **Acessibilidade e celular:** Tab e Enter, foco preso no diálogo, `Esc`, foco devolvido a quem abriu, sem rolagem horizontal a 360 px, alvos de 44 px e de 24 px.

**Cobertos:** cada linha da tabela de testes tem o seu teste, achado pelo nome em `DialogoDoOrcamento.test.tsx`, `Escolas.test.tsx`, `painel.test.ts`, `pedidos-do-painel.test.ts`, `textos.test.ts` e `e2e/operacao-escolas.spec.ts`.
- `npx vitest run --project unidade apps/web/src/operacao/`: 14 arquivos, 173 testes, todos verdes.
- `mutacoes.ts --faltando`: sai vazio.
- O clique duplo tem um teste de verdade: dois `fireEvent.submit` no mesmo instante, que passam por cima do botão desligado e chegam à trava `noAr`.
- As três invalidações são provadas pela contagem de leituras antes e depois do `PUT`.
- Não há `.skip` nem teste comentado. A rede falsa só substitui o `fetch`, e o resto é o código de verdade. Nenhum teste chama IA.

**Bloqueantes:**

1. **`apps/web/src/operacao/components/DialogoDoOrcamento.tsx:82`**: `redes.data?.itens.find((candidata) => candidata.id === redeId)` não tem bloco de mutação, e nenhum teste de unidade o prova.
   - Todos os testes montam a lista de redes com **uma** rede só (`DA_REDE([redeDoPainel()])`, ou a lista vazia). Por isso `find(() => true)` passa em todos.
   - O defeito que isso esconde: o diálogo mostra o "Vale hoje", o "Antes" e o "Muda o orçamento de N escolas" de **outra rede**. O "Depois" da escola com "Usar o valor da rede" também sai da rede errada. É justamente a confirmação que a regra 50, item 8, exige antes de salvar.
   - O `--faltando` não pegou a linha. No e2e só falharia por acaso, conforme a ordem das redes no banco.
   - **Correção exigida:**
     - um caso com duas redes na lista, sendo o alvo a segunda, para a rede e para a escola. Ele confere o "Vale hoje", o "Antes", a contagem e o "Depois" com "Usar o valor da rede";
     - um bloco ` ```mutacao ` com `candidata.id === redeId` trocado por `true`, citando esse caso.

2. **`apps/web/src/operacao/components/DialogoDoOrcamento.tsx:279`**: `daRede: proprio.valorPorAlunoMicros === null` é cláusula nova e não tem bloco.
   - O `--faltando` sai vazio só porque o texto é igual ao da condição da linha 277, que tem bloco. É a mesma coincidência de texto que o achado da 3.0 já tinha registrado.
   - Os testes já existem: "cada campo tem o seu rótulo… marcada" confere a caixa marcada, e "a escola com valor próprio abre… a caixa desmarcada" confere a desmarcada.
   - **Correção exigida:** um bloco com `daRede: true` e outro com `daRede: false`, citando esses dois casos.

**Recomendações:**
- **Nome do teste:** `DialogoDoOrcamento.test.tsx:495` promete "com o botão que o abriu, ele volta ao botão", mas só prova a reserva. A volta ao botão está provada em `Escolas.test.tsx` e no e2e: o nome deveria dizer só o que este caso prova.
- **Bloco para a linha 84:** `forDoContrato = redes.error instanceof RespostaForaDoContrato` não tem bloco próprio. Os dois lugares que a usam (linhas 100 e 103) têm, e os testes de "erro" e "fora do contrato" pegariam a troca, mas um bloco direto deixaria isso explícito.
- **Cancelar com o `PUT` no ar:** o "Cancelar" continua ativo enquanto o pedido está no ar. Não há caso para "Cancelar com o `PUT` no ar, abrir outro diálogo, e a resposta chegar": a resposta não pode fechar o diálogo novo (`closeSeAinda`), e "Orçamento salvo." deveria aparecer mesmo assim. Vale um caso em `Escolas.test.tsx` e, para o `frontend-reviewer`, decidir se o Cancelar fica desligado enquanto salva.
- **Dois operadores editando o mesmo orçamento:** o último a salvar vence, e o "Antes" de quem salva por último pode estar velho. A regra é da 3.0 (o `PUT` não tem versão). Fica registrado para a validação.
- **A contagem quando só o teto muda:** `escolasQueUsamOValorDaRede` conta valor **ou** teto vindo da rede (definição da techspec). Então, quando só o teto muda, a frase "Muda o orçamento de N escolas que usam o valor da rede" conta também a escola que tem teto próprio e só usa o valor da rede, e essa não muda. O texto do cenário foi seguido; fica para o PRD ou a retro.
- **e2e, escolas que ficam no banco:** as escolas semeadas pelo novo `describe` em `e2e/operacao-escolas.spec.ts` (`semearEscolaDoConvite`) não são removidas no `afterEach`. É o mesmo precedente da `operacao-convite-coordenacao.spec.ts`, e o banco do e2e acumula.
- **"Nada só por hover":** nenhuma asserção prova isso no e2e do celular. É difícil de provar, e hoje fica só com o `frontend-reviewer`.

Arquivos citados:
- `apps/web/src/operacao/components/DialogoDoOrcamento.tsx`
- `apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx`
- `apps/web/src/operacao/pages/Escolas.test.tsx`
- `e2e/operacao-escolas.spec.ts`
- `tasks/prd-camada-ia/7_task.md`

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-21 08:18:58 · `tasks/prd-camada-ia/7_task.md`

VEREDITO: APROVADO
Tela vista: não. As fotos estão indisponíveis porque a vitrine não tem o papel operador (`/operacao`). A revisão foi pelo diff da rodada, pelo código e pelos testes de unidade e de e2e. A tela deve ser fotografada na validação da funcionalidade.
Estados: ok. O carregando está em `DialogoDoOrcamento.tsx:93`. O erro com "Tentar de novo" e o erro de contrato com "Atualize a página" estão em `DialogoDoOrcamento.tsx:99-103`. O vazio e o com dado seguem como na rodada aprovada.
Acessibilidade: ok. O diff não mexe em rótulo, foco ou `role`. O teste de foco foi só renomeado, para dizer o que prova: o foco vai para a reserva quando quem abriu o diálogo já saiu da página. O novo teste de `Escolas.test.tsx` confere que o "Orçamento salvo." é anunciado numa região `status` mesmo se o diálogo já fechou.
Chromebook fraco: sem mudança nesta rodada. O diff não traz lista nova, imagem nem custo de CPU.
Celular: sem mudança de layout. Esta rodada não tocou nos e2e do celular. O diálogo continua o mesmo componente aprovado na 1ª rodada.
Ação oficial protegida: sim. O diálogo mostra o antes e o depois, e na rede mostra quantas escolas mudam, antes de "Salvar orçamento". O novo caso de `Escolas.test.tsx` mostra que o `PUT` que responde tarde não fecha o diálogo de outra abertura. O `closeSeAinda` é chamado com a abertura em que o pedido saiu, e não pelo tipo.
Bloqueantes: nenhum.

O que o diff mudou, e como conferi:
- **Refatoração em `Escolas.tsx:66-80` (`OrcamentoAberto`)**: os dois blocos do diálogo viraram um componente. O comportamento é o mesmo: `key={aberta.numero}`, o foco de reserva, e `aoSalvar` que passa a abertura capturada (linha 322). A guarda `isOrcamento` deixa de fora os diálogos Nova rede e Nova escola.
- **Rede certa da lista (`DialogoDoOrcamento.tsx:82`)**: o `find` por `redeId` já existia, e agora há dois casos com duas redes e o alvo na segunda (`DialogoDoOrcamento.test.tsx:252-284`). Eles provam que o "Vale hoje", o "Antes", o "Depois" e a contagem são os da rede do alvo.
- **Nova escola (efeito colateral)**: a lista de redes passou pelo `lidoPeloContrato`, então o Nova escola também diz "Atualize a página" quando a resposta vem fora do contrato. É coerente com a tela e está registrado no documento da tarefa. Não há texto técnico vazando.

Recomendações:
- A coluna Rede e a coluna Escola têm dois botões com o mesmo texto visível, "Orçamento de IA". A distinção fica só no nome acessível. Já está registrada para a validação, que vê a tela.
- Fotografar o diálogo do Orçamento de IA, nos 1366 px e nos 360 px, quando a vitrine tiver o papel operador.
- "Teto de segurança" é jargão para o operador. O destino já está registrado: 7.1, com uma frase de ajuda abaixo do campo.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-21 08:19:09 · `tasks/prd-camada-ia/7_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A rodada 2 mexe só no frontend da Operação. Ela tira o diálogo Orçamento de IA de dentro do `Escolas.tsx` e o põe num componente próprio (`OrcamentoAberto`). Ela também muda comentários em `painel.ts` e `textos.ts` e acrescenta testes de unidade. Os dados que a tela usa continuam os mesmos: id e nome da rede e da escola, valor por aluno, teto de segurança e `escolasQueUsamOValorDaRede`. Nada disso é dado de aluno nem de professor.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. Nada mudou no servidor. O alvo do diálogo continua saindo da linha da lista, que a API já entregou filtrada. Quem autoriza é o `PUT` da 3.0, que não mudou. Também confiei a correção que trava o lugar dos dados da lista nos testes novos: o "Vale hoje", o "Antes" e a contagem saem da rede certa, mesmo com duas redes na lista, em `apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx:252-284`. Eu só li o código, não rodei os testes.

Logs: limpos. O diff não acrescenta nenhum log.

Auditoria: presente. O orçamento só é alterado pelo `PUT` da 3.0, auditado e sem mudança nesta rodada. A única mudança no `apps/web/src/operacao/api/painel.ts` é o comentário sobre o `lidoPeloContrato`.

Envio externo: nenhum.

Seed/fixture: sintético. A rede "Outra Rede" usa um UUID de teste e valores inventados. A escola vem da fábrica `escolaDoPainel(1)`.

Bloqueantes: nenhum.

Recomendações:
- Continua em aberto fotografar o diálogo quando a vitrine tiver o papel operador. A recomendação já está no `TODO.md`, e o Validador deve fazer isso na validação da funcionalidade.
- O teste novo em `apps/web/src/operacao/pages/Escolas.test.tsx:328-353` prova que o `PUT` que responde tarde não fecha o diálogo de convite aberto depois. Isso é correção da tela, sem efeito sobre exposição de dado. Fica registrado só como confirmação de que o diálogo novo não recebe o resultado do pedido anterior.

Arquivos lidos:
- `.processo/ordens/diff-7-r2-codigo.patch`
- `.processo/ordens/diff-7-r2-documento.patch`

## revisor-geral · 2ª rodada · APROVADO · 2026-11-21 08:19:12 · `tasks/prd-camada-ia/7_task.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

Bloqueantes: nenhum

Esta rodada mudou cinco coisas, e conferi cada uma.

- **Diálogo do orçamento extraído:** os dois blocos de `DialogoDoOrcamento` em `Escolas.tsx` viraram um componente só, `OrcamentoAberto`. Ele usa `isOrcamento` e `alvoDoOrcamento`, e o comportamento é o mesmo de antes. A abertura em que o `PUT` saiu fica guardada em `aoSalvar={() => aoSalvar(aberta)}` e vai para `closeSeAinda(abertura)`. Assim, só o diálogo que pediu o `PUT` fecha.
- **Resposta que chega depois:** um caso novo em `Escolas.test.tsx` prova que o `PUT` que responde com o diálogo já fechado, e outro aberto no lugar, anuncia "Orçamento salvo." e não fecha o diálogo novo.
- **Rede certa da lista:** dois casos novos em `DialogoDoOrcamento.test.tsx` usam duas redes, com o alvo na segunda. Eles tornam observável o `find((candidata) => candidata.id === redeId)`, o que faltava na rodada 1.
- **Efeito no Nova escola:** a lista de redes já era lida pelo `lidoPeloContrato` desde a rodada 1. Agora isso está escrito no JSDoc de `painel.ts:94-96` e na pergunta 2 do `7_task.md`. Com a lista fora do contrato, `NovaEscola.tsx` passa a mostrar "Atualize a página". O caso que prova isso é o de `painel.test.ts:288`.
- **Registro das recomendações:** a recomendação de tirar `textoDoErroAoSalvar` foi recusada com motivo no JSDoc de `textos.ts:237-241`, e o homônimo aparece de fato em `tools/renomear/mapas/10.json`. As demais recomendações da rodada 1 estão em "Recomendações sem aplicar", cada uma com destino.

Recomendações:
- `tasks/prd-camada-ia/7_task.md`, nas mutações: o bloco que tira `if (tipo === 'orcamento-da-rede') return ...` cita "o botão da escola abre o diálogo da escola". Sem essa linha, o diálogo da rede passa a montar o alvo da escola, e quem fica vermelho é o caso do botão da rede, não o da escola. Vale citar o caso que de fato pega a mutação, o que o `test-engineer` pode conferir.
- `apps/web/src/operacao/pages/Escolas.tsx`: em `OrcamentoAberto`, as guardas `aberta === undefined || escola === undefined` e `!isOrcamento(aberta.tipo)` podem virar uma linha só. São três retornos `null` seguidos para uma única condição de saída.
- `tasks/prd-camada-ia/7_task.md`, na pergunta 2: o Nova escola agora dizer "Atualize a página" é uma mudança visível numa tela fora da tarefa. Está documentada e é pequena. Vale a validação olhar quando fotografar o papel operador.

Arquivos auditados:
- apps/web/src/operacao/pages/Escolas.tsx
- apps/web/src/operacao/pages/Escolas.test.tsx
- apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx
- apps/web/src/operacao/api/painel.ts
- apps/web/src/operacao/textos.ts
- tasks/prd-camada-ia/7_task.md

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-21 08:19:19 · `tasks/prd-camada-ia/7_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. Esta rodada mexe só na tela de Operação (`apps/web/src/operacao/`), no diálogo do orçamento de IA da rede e da escola. Não há caminho novo para gravar Nota, e nenhum foi alterado. Todos com autor humano? Não se aplica.
Decisão autônoma sobre aluno: ausente.
Aprovação registrada: ok. Esta rodada não cria saída de IA que chegue ao aluno.
Supervisão do tutor: ok. A rodada não toca no tutor.
Autonomia declarada e visível: sim. A rodada não muda a autonomia de nenhum agente nem a tela que a mostra.
Bloqueantes: nenhum.

Revisei só o diff da rodada anterior (aprovada, sem correções exigidas) e o que ele afeta:
- **`apps/web/src/operacao/pages/Escolas.tsx`:** os dois blocos do diálogo de orçamento viraram um componente só, `OrcamentoAberto`, com `isOrcamento` e `alvoDoOrcamento`. O `closeSeAinda(abertura)` faz com que uma resposta atrasada do `PUT` não feche outro diálogo que já esteja aberto. É organização da interface, sem efeito na regra 70.
- **`apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx`:** casos novos com duas redes na lista, que provam que a tela lê a rede certa.
- **`apps/web/src/operacao/pages/Escolas.test.tsx`:** caso novo do `PUT` que responde depois de o diálogo fechar.
- **`apps/web/src/operacao/api/painel.ts` e `apps/web/src/operacao/textos.ts`:** só o JSDoc mudou.
- **`tasks/prd-camada-ia/7_task.md`:** mutações e recomendações registradas.

O diálogo só mostra valor em reais por aluno e o teto de segurança, por escola ou por rede. Não aparece nada nominal de professor ou de aluno, nada que sugira nota (D55) e nenhum indicador ligado a professor (D45, D64). Sobre D59: a pessoa continua podendo cancelar com o `PUT` no ar, e o teste novo confirma isso. A recomendação do `test-engineer` de desligar o "Cancelar" foi levada ao Arquiteto, como deve ser.

Não houve fotos da tela: a vitrine não tem o papel operador. Revisei pelo código e pelos testes.

Recomendações:
- Ficam as mesmas da 1ª rodada, já registradas na tarefa: fotografar o diálogo quando a vitrine tiver o papel operador, e na 8.0 conferir que a aba Uso mostra só número por escola, sem nada por professor nem aluno com nome.
- Se o Arquiteto decidir sobre o "Cancelar" com o `PUT` no ar, o botão deve continuar habilitado (D59, regra 70 item 4b).

## infra-guardian · 2ª rodada · APROVADO · 2026-11-21 08:19:21 · `tasks/prd-camada-ia/7_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum. A rodada 1 não exigiu correção. O diff desta rodada mexe só no painel interno da Operação: as duas aberturas do diálogo viraram um componente `OrcamentoAberto`, entraram testes novos e mudaram comentários. Nada disso cria request, job, query, migration ou estado de servidor.
- O `aoSalvar` em `apps/web/src/operacao/pages/Escolas.tsx` passou a usar `closeSeAinda(abertura)`. Quando a resposta do `PUT` chega tarde, ele não fecha o diálogo que foi aberto depois, e o caso novo em `apps/web/src/operacao/pages/Escolas.test.tsx` cobre isso.
- O clique duplo continua protegido pelo `noAr` do diálogo.
- A busca `find(candidata.id === redeId)` em `apps/web/src/operacao/components/DialogoDoOrcamento.tsx:82` acontece na lista que o navegador já tem e não gera chamada nova.
- O `lidoPeloContrato` na lista de redes (`apps/web/src/operacao/api/painel.ts:111`) só valida o que chega e não faz requisição nova.
Recomendações:
- Siguem as da rodada 1, já anotadas no `TODO.md`: `GET /v1/operacao/redes` sem paginação, e confirmar que `escolasQueUsamOValorDaRede` não faz uma consulta para cada rede. As duas são código da 3.0 e cabem nas dez escolas da D25.
- Também da rodada 1: dois operadores salvando o mesmo orçamento, o último a salvar ganha e não há `If-Match`.

## test-engineer · 2ª rodada · APROVADO · 2026-11-21 08:19:29 · `tasks/prd-camada-ia/7_task.md`

VEREDITO: APROVADO

**Cenários exigidos (2ª rodada):** as duas correções da 1ª rodada e o que o diff novo mexe: o `OrcamentoAberto` e o `alvoDoOrcamento` em `Escolas.tsx`, a resposta do `PUT` que chega depois de o diálogo fechar, e os blocos novos de `find`, `daRede` e `forDoContrato`.

**Cobertos:**
- **Correção 1, a rede certa da lista.** O novo describe "a rede certa da lista" (`apps/web/src/operacao/components/DialogoDoOrcamento.test.tsx:252-284`) monta duas redes, e o alvo é a segunda. A primeira tem R$ 9,00, teto 400% e 7 escolas.
  - Na rede, o caso confere o "Vale hoje", o "Antes", a contagem de 3 escolas e a ausência de "R$ 9,00".
  - Na escola, confere o "Depois" com "Usar o valor da rede", e depois de mudar o teto.
  - Com `find(() => true)` sai a rede de R$ 9,00, e os dois casos ficam vermelhos no ponto certo. Há um bloco para cada um.
- **Correção 2, o `daRede`.** Há os dois blocos. `daRede: true` cai na asserção da caixa desmarcada do caso "a escola com valor próprio abre". `daRede: false` cai em `caixa.checked === true` do caso "cada campo tem o seu rótulo". Os dois casos chegam à cláusula.
- **`forDoContrato`, nos dois valores.** Os casos "Atualize a página" e "Não foi possível carregar… Tentar de novo" distinguem um valor do outro.
- **A refatoração de `Escolas.tsx`:**
  - O caso "o botão da escola abre o diálogo da escola" (linhas 292-306) prova os dois termos de `isOrcamento` e a linha do ramo da rede. Sem essa linha, o botão da rede abre o diálogo com a caixa, e a linha 304 fica vermelha.
  - O caso novo "o `PUT` que responde depois de o diálogo fechar…" segura o `PUT`, cancela e abre o Convidar na mesma linha, depois solta a resposta. Ele confere que "Orçamento salvo." é anunciado e que o diálogo aberto continua sendo o do convite.
  - Esse caso prova o `closeSeAinda(abertura)` (trocado por `close()`, o convite fecharia) e o `if (!isOrcamento(...)) return null` (sem ele, haveria dois `dialog` na tela).
- **A nota do documento.** Ela diz que as guardas `aberta === undefined` e `escola === undefined` são só de tipo. Está correta: o `isOrcamento` já deixa de fora os diálogos Nova rede e Nova escola, que são os únicos sem alvo.
- **O que rodei.** Os dois arquivos de teste passam: 61 casos. O `node tools/processo/mutacoes.ts --faltando` diz que nenhuma linha nova fica sem bloco. Não há `.skip` nem mock que esconda a regra, e a rede falsa só está na borda do `fetch`.
- **Linha da tabela "Orçamento salvo."** Ela passou a citar o caso novo de `Escolas.test.tsx`, e o nome bate.

**Bloqueantes:** nenhum.

**Recomendações:**
- No caso da escola em "a rede certa da lista" (linhas 276-283), conferir também a contagem de `PUT` e o caminho com o `redeId` certo. Isso amarraria o pedido, além do texto, à rede do alvo.
- O caso do `PUT` atrasado prova uma resposta que chega fora de ordem, não dois pedidos ao mesmo tempo. O clique duplo já está coberto em outro lugar. Os dois operadores salvando o mesmo orçamento seguem registrados no `TODO.md`, como na 1ª rodada.
