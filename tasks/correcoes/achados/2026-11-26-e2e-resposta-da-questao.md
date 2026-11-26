# Achados das revisões — `tasks/correcoes/2026-11-26-e2e-resposta-da-questao.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-26 16:19:24 · `tasks/correcoes/2026-11-26-e2e-resposta-da-questao.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok

Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

Bloqueantes: nenhum

O que conferi:
- A causa descrita no documento bate com o código. Desde a tarefa 3.0, quem cria a tentativa é o `POST atividades-aplicadas/:id/comecar`, que responde 200 também na primeira vez (`@HttpCode(HttpStatus.OK)`, em `apps/api/src/atividade/minha-atividade/minha-atividade.controller.ts:47-55`). A leitura da prova não grava mais nada (linha 57 do mesmo arquivo).
- O ajudante envia `data: {}`, que passa no `emptyOrMissingBodyRequestSchema`.
- O limite de 30 por minuto por usuário (`rl:comecar-prova`) não é atingido, porque cada aluno do e2e começa a atividade uma única vez.
- O embaralhamento da 4.0 não atrapalha a resposta. O `PUT` da resposta segue pelo número e pelo índice originais (`docs/mvp-contratos.md:116`), então o ajudante pode continuar mandando o índice original da alternativa.
- A mudança fica só em `e2e/support/aluno-api.ts`, sem tocar em `apps/` nem em `packages/`. Os quatro specs citados no documento são os únicos que usam `responderPelaApi`.

Recomendações:
- `e2e/support/aluno-api.ts:23`: o trecho "a leitura da prova não grava mais" conta a história da mudança, e esse registro já está no documento da correção. Basta dizer que o `comecar` cria a tentativa.
- No documento da correção, "(200, corpo vazio)" pode ser lido como se a resposta viesse vazia, mas ela traz a prova (`ProvaOnlineResponse`). O vazio é o corpo do pedido. Vale escrever "pedido de corpo vazio, responde 200 com a prova".

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-26 16:19:27 · `tasks/correcoes/2026-11-26-e2e-resposta-da-questao.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta correção. O ajudante só chama três rotas como aluno: `POST .../comecar`, `PUT .../respostas/:n` e `POST .../enviar`. Nenhuma delas grava `Nota`, e as specs que usam o ajudante continuam passando pela aprovação da professora. Todos com autor humano? Sim, nada mudou nesse ponto.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. O diff não traz saída de IA nem fluxo de aprovação.
Supervisão do tutor: ok. `perguntarAoTutorPelaApi` não foi alterado.
Autonomia declarada e visível: sim. A correção não mexe em governança nem em agente.

Bloqueantes: nenhum.

O que conferi:
- A correção só troca o `GET .../prova` por `POST /v1/atividades-aplicadas/:id/comecar` com corpo `{}`, em `e2e/support/aluno-api.ts:27-28`, e reescreve o comentário que vem antes. Nenhum arquivo de `apps/` ou `packages/` mudou.
- A rota existe e responde como o ajudante espera: está em `apps/api/src/atividade/minha-atividade/minha-atividade.controller.ts:47-55`. Devolve 200 com `@HttpCode(HttpStatus.OK)`, aceita corpo vazio ou ausente, passa pela `RotasDeProvaGuard` e pela permissão `minha_atividade.comecar`. O `expect(...).toBe(200)` bate com o contrato, e a simulação em `e2e/support/aluno.ts:24` e `:142` já tinha a mesma rota.
- Itens 7 e 9: o ajudante não cria medida de navegação, tempo ocioso nem saída da aba, e não toca em indicador de professor.
- Item 8 (D46 e D55): não entra discursiva, redação nem campo de nota sugerida. O ajudante só manda `alternativa` de objetiva.

Recomendações:
- A correção roda sem a leitura da prova que vinha antes. Os e2e da tela (`aluno.ts`) cobrem esse caminho, mas o ajudante não confere o corpo devolvido pelo `comecar`, por exemplo `comecou: true`. Conferir esse campo pegaria mais cedo uma mudança futura no contrato. Isso não bloqueia.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-26 16:19:28 · `tasks/correcoes/2026-11-26-e2e-resposta-da-questao.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A correção muda só a rota que o ajudante de e2e chama: `POST .../comecar` no lugar de `GET .../prova`. Não cria campo, coluna, DTO nem payload de dado pessoal.

Fora da tabela de dados do docs/lgpd.md: nenhum.

Autorização por objeto: ok. Não muda em `apps/` nem em `packages/`. O ajudante usa a rota `comecar` como ela já existe em `apps/api/src/atividade/minha-atividade/minha-atividade.controller.ts:47-55`, que tem `RequirePermissao('minha_atividade', 'comecar')`, `RotasDeProvaGuard`, limite de uso por usuário e `no-store`. Cada aluno entra com o próprio token. A mudança não abre caminho novo nem relaxa nenhuma guarda.

Logs: limpos. O ajudante não loga nada. As mensagens de `expect` têm só texto fixo e o número da questão (`e2e/support/aluno-api.ts:28` e `:32`), sem nome, matrícula, alternativa escolhida nem nota.

Auditoria: não se aplica. A tarefa não toca leitura por coordenação ou rede, exportação, nota, permissão nem aprovação de saída de IA.

Envio externo: nenhum.

Seed/fixture: sintético. O cabeçalho do ajudante declara matrícula e nome inventados (`aluno-api.ts:8`), e os alunos vêm de `e2e/support/seed.ts` e das cenas dos specs (por exemplo `bruno` e `carla` no roteiro), que também são fictícios.

Bloqueantes: nenhum.

Recomendações:
- O teste de contrato da rota `comecar` fica com a API. Esta correção não diz nada sobre ele, e não precisa. O e2e já mostra que sem `comecar` o `PUT` da resposta devolve 404, e não 403: é o comportamento que as regras 6 e 20 (item 6) pedem.

Pergunta de fechamento: a correção não muda o que o sistema guarda sobre o aluno nem para onde isso vai. A resposta continua a que já existia antes dela.

## test-engineer · 1ª rodada · APROVADO · 2026-11-26 16:19:50 · `tasks/correcoes/2026-11-26-e2e-resposta-da-questao.md`

VEREDITO: APROVADO

**Cenários exigidos:**
Esta tarefa conserta um ajudante de teste e não cria regra nova. Nenhum arquivo de `apps/*/src` nem de `packages/*/src` mudou, então ela não pede caminho feliz, caso de borda, permissão ou isolamento próprios. O que ela precisa provar:
- o ajudante `responderPelaApi` segue o contrato novo da 3.0: quem cria a tentativa é o `POST .../comecar`, e a leitura da prova não grava mais nada;
- os quatro specs que caíam com o 404 (`professor-semana-itens`, `a3-a4-professor`, `classificacao-bncc`, `roteiro-da-demonstracao`) voltam a passar;
- o ajudante não depende de outro comportamento que a 3.0 ou a 4.0 tenham mudado.

**Cobertos:**
- **A rota existe como o ajudante espera.** No `apps/api/src/atividade/minha-atividade/minha-atividade.controller.ts:47-54`, o `comecar` é `POST` com `@HttpCode(HttpStatus.OK)`, então o 200 que o ajudante espera está certo (o padrão do NestJS para `POST` seria 201). A rota aceita corpo vazio (`emptyOrMissingBodyRequestSchema`), e o ajudante manda `data: {}`. O comentário da linha 57 confirma que o `GET .../prova` "não grava".
- **O teste que reproduz é o próprio e2e,** vermelho antes (8 falhas com o 404 em `professor-semana-itens` rodado sozinho) e verde depois (30 casos nos quatro specs), segundo o documento. Não rodei o e2e. Ele sobe o ambiente inteiro, e o meu papel é não pôr a máquina sob carga.
- **Nenhum outro ajudante do e2e dependia da leitura da prova para abrir tentativa.** O único outro uso dessas rotas é a simulação em `e2e/support/aluno.ts`, que a 3.0 já atualizou. O `e2e/support/atividade-db.ts` só usa as rotas da professora.
- **O embaralhamento da 4.0 não atrapalha o ajudante.** A aplicação nasce sem embaralhar por padrão (`packages/shared/src/atividade/atividade-aplicada.ts:126`, `SEM_EMBARALHAR`), e o `sortearOrdem` devolve nulo nesse caso (`apps/api/src/atividade/minha-atividade/ordem-da-prova.ts:48`). Por isso o índice `respostas/${indice + 1}` continua sendo a questão original.
- **A ausência de mutação está justificada.** Nenhuma cláusula nova entrou em código de produto, só no ajudante de teste.
- Nenhum `.skip`, nenhum teste comentado e nenhum mock que esconda a regra. A mudança está no ajudante que fala com a API de verdade.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Embaralhamento.** O `e2e/support/aluno-api.ts:29-32` supõe que a ordem de apresentação é a original. Se um spec futuro aplicar uma prova com `embaralhar` ligado e responder por este ajudante, as respostas vão para posições diferentes das que ele imagina. Vale uma linha no JSDoc do `responderPelaApi`: "só para aplicação sem embaralhar".
2. **Campo `sequencia`.** O ajudante grava a resposta sem `sequencia`, enquanto a tela manda `sequencia: 1` (`e2e/aluno-atividade.spec.ts:193`). Pelo e2e verde, o campo hoje é opcional na API. Se um dia ficar obrigatório, este ajudante cai do mesmo jeito que caiu agora. Vale registrar isso no comentário do ajudante.
3. **Para a retro.** A causa foi a 3.0 trocar o contrato de uma rota e atualizar só a simulação (`e2e/support/aluno.ts`), não o ajudante que fala com a API de verdade. Isso só apareceu na esteira. Uma conferência no portão da tarefa, do tipo "mudou o contrato de uma rota, procure `e2e/support/*-api.ts`", pegaria o problema antes.

Arquivos auditados:
- `e2e/support/aluno-api.ts`
- `tasks/correcoes/2026-11-26-e2e-resposta-da-questao.md`
- `apps/api/src/atividade/minha-atividade/minha-atividade.controller.ts`

## revisor-geral · 2ª rodada · APROVADO · 2026-11-26 16:27:35 · `tasks/correcoes/2026-11-26-e2e-resposta-da-questao.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. O ajudante usa o contrato da 3.0: `POST .../comecar` cria a tentativa, depois vem o `PUT .../respostas/:questao`. Nada mudou em `apps/` nem em `packages/`.

Portão local: carimbo válido. O `conferir` passou para o código atual, com typecheck, lint, segredo, dependências, unidade e alvo.

Bloqueantes: nenhum

As duas correções pedidas na 1ª rodada foram feitas:
- O JSDoc de `e2e/support/aluno-api.ts:23` agora só diz que o `comecar` cria a tentativa. A frase que contava a história da mudança saiu.
- Em `tasks/correcoes/2026-11-26-e2e-resposta-da-questao.md`, seção "Correção", o texto ficou "pedido de corpo vazio, responde 200 com a prova".

A tabela "Recomendações sem aplicar" registra cada recomendação com o motivo ou o destino dela, e as referências que cita existem.

Recomendações:
- `e2e/support/aluno-api.ts:25-26`: a ressalva nova, "Só para aplicação sem embaralhar", restringe mais do que o código. O `PUT .../respostas/:questao` recebe o número original da questão e o índice original da alternativa (`packages/shared/src/atividade/prova.ts:75-76`; `minha-atividade.service.ts:264`). Então o ajudante grava certo também numa prova embaralhada: ele só não segue a ordem em que o aluno vê as questões. Vale escrever assim: "as alternativas são dadas pelo número e pelo índice originais, não pela ordem de apresentação do aluno". Hoje o texto sugere que o ajudante quebra em prova embaralhada, e isso não acontece. Não bloqueia: é comentário, e o comportamento está certo.
