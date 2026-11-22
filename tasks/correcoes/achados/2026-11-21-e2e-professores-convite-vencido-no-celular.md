# Achados das revisões — `tasks/correcoes/2026-11-21-e2e-professores-convite-vencido-no-celular.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-21 20:22:24 · `tasks/correcoes/2026-11-21-e2e-professores-convite-vencido-no-celular.md`

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
- A mudança fica só em `e2e/professores.spec.ts`. Não mexe em código de produto, rota, fila, migration nem gateway de IA. O caso novo não chama provedor nenhum: só segura `GET /v1/disciplinas` com `page.route`. Não muda o comportamento sob carga, e nenhum cenário do teste de carga precisa ser atualizado.
- No caso novo, `setTimeout(segurada.abrir, 300)` fica solto. Se uma asserção anterior falhar, o gate nunca abre e a rota fica pendurada até o fim do teste. Hoje isso não faz mal, porque a página fecha junto com o teste. Fica mais limpo abrir o gate num `finally`, ou chamar `segurada.abrir()` de forma explícita depois de medir `aoCarregar`.
- A correção registra que a folha de baixo cresce sob o dedo de quem toca depressa (`docs/interface.md` 9.3) e que isso é do desenho do painel, por isso não foi mexido aqui. Isso deve ir para a retro, porque o professor de verdade no celular passa pelo mesmo deslocamento.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-21 20:22:31 · `tasks/correcoes/2026-11-21-e2e-professores-convite-vencido-no-celular.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. O caso novo cria um professor de teste com `convidarProfessorNoBanco` (nome "Zuleica <estado> <8 caracteres de UUID>" e e-mail `professor-<uuid>@educa.invalid`). São campos que já existem e pertencem ao professor, que é adulto, e não ao aluno.

Fora da tabela de dados do docs/lgpd.md: nada. Não há migration, schema nem campo novo.

Autorização por objeto: não se aplica. A tarefa não mexe em rota, repository nem endpoint. O caso só segura a resposta de `GET /v1/disciplinas` no navegador com `page.route` e depois a deixa seguir pelo `fallback`, sem trocar o que a API devolve.

Logs: limpos. O diff não acrescenta log, `console` nem anexo com dado.

Auditoria: não se aplica. Não há leitura de dado de aluno pela coordenação, exportação, nota, permissão nem aprovação de saída de IA.

Envio externo: nenhum. A tarefa não envolve IA nem provedor.

Seed/fixture: sintético. O nome tem sufixo de UUID e o e-mail usa o domínio reservado `.invalid`, gerados em `e2e/support/seed.ts:723-748`. Não há dado real.

Bloqueantes: nenhum.

Recomendações: nenhuma da regra 20. A mudança fica só em `e2e/professores.spec.ts`:
- `esperarOPainelAssentar` é nova, e `fecharPainel` agora espera por ela antes de tocar o "Fechar".
- O caso novo mede onde o botão "Fechar" fica no painel.

O código de produto não foi tocado. Para a pergunta de fechamento, a tarefa não muda o que o sistema guarda sobre um aluno nem para onde isso é enviado.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-21 20:22:39 · `tasks/correcoes/2026-11-21-e2e-professores-convite-vencido-no-celular.md`

VEREDITO: APROVADO

Escopo: respeitado. Só `e2e/professores.spec.ts` mudou, mais o documento da correção. O código de produto não foi tocado, e o documento diz isso de propósito: a folha cresce com o que chega, como manda o `docs/interface.md` 9.3.

Aderência à Tech Spec: ok. A correção mexe só no teste, não diverge de nada e não tem o que registrar na `techspec.md` nem no `cenarios.md`.

Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)").

Bloqueantes: nenhum.

O que conferi:
- **A espera pega o carregando certo.** `esperarOPainelAssentar` procura um `role="status"` que comece com "Carregando". O `LoadingState` (`apps/web/src/components/states/LoadingState.tsx:15`) é um `<p role="status">`. O `PainelDoProfessor.tsx:127` mostra "Carregando as turmas…" no mesmo render em que o professor vira alocável, enquanto as turmas e as disciplinas ainda não chegaram. Então o carregando já está na tela quando o caso vê "Convite em aberto", como o documento afirma.
- **O caso novo prova a espera sem depender de sorte.** Ele segura `GET /v1/disciplinas` e mede o botão em vez de tocá-lo. Afirma que, ao sair da espera, o botão está onde fica dois quadros depois. No celular afirma também que o botão subiu, e no computador que não se mexeu. A mutação declarada (`void page`) deixa o caso vermelho no `celular`.
- **Os textos esperados existem.** "Nenhuma turma." está em `PainelDoProfessor.tsx:133` e aparece com a escola vazia. `gate()`, `convidarProfessorNoBanco` e `abrirPelaApiSemMedirAPrimeiraCarga` já existiam.
- **A correção chega a todos os casos.** As 11 chamadas de `fecharPainel` passam pela espera porque ela está dentro da função.

Recomendações:
- `e2e/professores.spec.ts:207-213`: o comentário de `esperarOPainelAssentar` repete o que já está na seção Causa do documento, em cinco linhas. Basta uma frase, por exemplo "no celular a folha cresce para cima quando as turmas chegam; toque no cabeçalho só com ela parada".
- `e2e/professores.spec.ts:472`: o título do caso novo é longo. Algo como `o "Fechar" do painel só é tocado com a folha assentada` já basta, e é o nome que o bloco de mutação usa.
- `e2e/professores.spec.ts:479`: o comentário diz "segurada até o teste abrir", mas quem abre é o `setTimeout` de 300 ms. "Segurada até o teste soltar" fica mais exato.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-21 20:23:56 · `tasks/correcoes/2026-11-21-e2e-professores-convite-vencido-no-celular.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Caminho feliz.** O "Fechar" do painel do professor, tocado no celular depois de refazer o convite vencido, fecha o painel.
- **Borda 1.** A folha de baixo cresce enquanto as turmas e as disciplinas carregam. É o caso de um professor que passou a ser alocável, de vencido para pendente.
- **Borda 2.** Painel aberto direto pelo endereço (`?professor=`), com a página recém-carregada: as quatro leituras partem do zero (anos, vínculos, turmas e disciplinas).
- **Borda 3.** Painel no computador, com o cabeçalho fixo no topo. A espera só pode custar o carregando e não pode mudar o resultado.
- **Permissão e isolamento.** Fora do escopo: a correção não mexe em código de produto. O caso do id de outra escola (`:1227`) continua no arquivo, sem alteração.
- **Concorrência.** Não se aplica. A corrida aqui é de renderização contra o toque, e não há duas operações gravando ao mesmo tempo.

**Cobertos:**
- O caso novo, `o "Fechar" do painel só é tocado com a folha assentada…` (`e2e/professores.spec.ts:472`). Ele segura `GET /v1/disciplinas`, mede o botão em vez de tocá-lo, e afirma duas coisas:
  - o botão não se move depois da espera;
  - no celular, a folha cresce, o que é a premissa do caso.

  Por isso é determinístico. A mutação declarada (tirar a espera de `esperarOPainelAssentar`) cai na cláusula certa: sem a espera, a medida sai durante o "Carregando", e a medida tomada depois de "Nenhuma turma." difere dela (347 contra 215).
- A espera em si está certa:
  - Todo carregando do painel (`PainelDoProfessor.tsx:125` e `:127`) é `LoadingState`, que tem `role="status"` e começa com "Carregando".
  - As consultas de turmas e de disciplinas passam a valer no mesmo render em que o estado vira alocável, então não há quadro sem carregando antes de a folha crescer.
  - O `Sheet` não tem transição de altura.
  - `--faltando` dá 0, e a cláusula nova tem o seu bloco.
- O caso original (`:438`) agora passa pela espera.
- Não há `.skip`, mock que esconda a regra nem provedor de IA.

**Bloqueantes:**
1. **`e2e/professores.spec.ts:1240`: o mesmo defeito ficou no mesmo arquivo.**
   - O caso `aberto pelo endereço, sem botão que o tenha aberto…` abre pelo `goto`, com a página nova, o painel de um professor `pendente`, que é alocável.
   - Antes de tocar, ele só espera o texto "Convite em aberto" (`:1239`). Esse texto aparece no mesmo quadro do "Carregando as turmas…".
   - Depois toca o "Fechar" do cabeçalho com `tocar(painel, 'Fechar', hasTouch)`, sem passar por `fecharPainel`.
   - É exatamente a corrida da Causa, e com mais leituras em voo, porque nada está em cache. No celular, o toque pode cair onde o botão estava.
   - O documento da correção diz o contrário (linha 55 do `.md`): "Todo caso do arquivo que fecha o painel … passa por ela". Isso é falso.
   - **Correção exigida:**
     - trocar `:1240` por `await esperarOPainelAssentar(page)` antes do toque, ou usar `fecharPainel(page, hasTouch)` e manter as asserções de URL e de foco que vêm depois;
     - corrigir no documento a contagem e a afirmação sobre "todo caso do arquivo".

**Recomendações:**
- **O mesmo risco existe nos arquivos vizinhos, e a seção "Fora desta correção" diz "Nada".**
  - `e2e/professores-envio.spec.ts:112-113` tem a sua própria cópia de `fecharPainel`, sem a espera.
  - `e2e/alocacao.spec.ts:72-73` e `:191` tocam o "Fechar" do painel direto.
  - Ou levar `esperarOPainelAssentar` para um apoio comum (`e2e/support/`) e usar nos três arquivos, ou registrar no documento que ficam fora e por quê.
- **Em `e2e/professores.spec.ts:494`, `:499` e `:503`, o `?? -1` pode tornar as comparações vazias.** Se `boundingBox()` voltar `null` nas duas medidas, o `toBe` do chromebook passa com -1 igual a -1. Afirmar `not.toBeNull()` antes de comparar.
- **A mutação depende de a primeira medida depois da espera sair antes dos 300 ms do `setTimeout`.** Sob carga pesada, ela poderia ficar verde. Isso não afeta o caso com a correção aplicada, mas vale um comentário. Outra opção é abrir a porta só depois da medida, no caminho mutado.
- **O texto do documento não bate com o caso novo.** A Causa (linha 33) cita "Crie uma turma e uma disciplina primeiro", e o caso novo espera "Nenhuma turma.". As duas coisas aparecem no mesmo render, mas citar o mesmo texto no documento e no caso evita leitura errada.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-21 21:30:31 · `tasks/correcoes/2026-11-21-e2e-professores-convite-vencido-no-celular.md`

**VEREDITO: APROVADO**

**Escopo:** respeitado. Desde a rodada 1 só mudaram o `e2e/professores.spec.ts`, o documento da correção e duas linhas no `TODO.md`. Os outros dois arquivos de teste com o mesmo toque (`e2e/professores-envio.spec.ts` e `e2e/alocacao.spec.ts`) ficaram fora, de propósito: estão no `TODO.md` e na tabela de recomendações do documento, com o motivo.

**Aderência à Tech Spec:** ok. A correção só toca teste. O desenho do painel (`docs/interface.md` 9.3) não mudou, e a folha que cresce sob o dedo foi para a retro e para o `TODO.md`.

**Portão local:** carimbo válido para o código atual (typecheck, lint, segredo, dependências, unidade, alvo).

**Bloqueantes:** nenhum.

**O que conferi nas correções exigidas:**
- **Bloqueante do `test-engineer`:** feito. O caso `aberto pelo endereço…` agora fecha o painel por `fecharPainel` (`e2e/professores.spec.ts:1246`). Nenhum outro toque no "Fechar" do painel fica fora dessa função. Os `tocar(noDialogo(page), 'Fechar', …)` são do diálogo do convite, e a linha 749 só mede o tamanho do alvo, não toca. São 12 chamadas de `fecharPainel`, como o documento diz.
- **Medida sem caixa:** feito. `yDoFechar` falha se o "Fechar" não tiver caixa, em vez de comparar -1 com -1 e passar sem medir nada.
- **Leitura segurada:** feito. O `finally` sempre a solta. Chamar `segurada.abrir()` de novo depois do `setTimeout` não faz mal, porque o `gate()` só resolve uma promessa.
- **Recomendações da rodada 1:** as três aplicadas. O comentário de `esperarOPainelAssentar` ficou em uma linha. O título do caso novo é o mesmo do bloco `mutacao` do documento. O texto agora diz "segurada até o teste soltar".
- **Bloco `mutacao` único:** o documento explica bem por que as cláusulas da rodada 1 não têm bloco próprio.

**Recomendações:**
- `e2e/professores.spec.ts`, comentário logo antes do `setTimeout`: a frase sobre a mutação ficar vermelha só porque a primeira medida sai antes dos 300 ms explica como o teste foi validado. O lugar dela é o documento da correção, que já a traz, e não o código.

**Arquivos lidos:**
- e2e/professores.spec.ts
- tasks/correcoes/2026-11-21-e2e-professores-convite-vencido-no-celular.md
- TODO.md

## test-engineer · 2ª rodada · APROVADO · 2026-11-21 21:30:46 · `tasks/correcoes/2026-11-21-e2e-professores-convite-vencido-no-celular.md`

VEREDITO: APROVADO

**Cenários exigidos**
- O toque no "Fechar" do painel só sai quando a folha parou de crescer. Na rodada 1 isso foi conferido no celular, com as turmas ainda carregando.
- Todo fechamento do painel do professor em `e2e/professores.spec.ts` passa pela espera, inclusive o caso que abre o painel pelo endereço.
- As medidas do "Fechar" não podem passar quando o botão não tem caixa na tela.
- A leitura segurada é sempre solta, mesmo quando uma asserção cai antes.

**Cobertos**
- **Correção exigida 1, feita.** Em `e2e/professores.spec.ts:1246`, o caso `aberto pelo endereço…` agora fecha com `await fecharPainel(page, hasTouch)`. As asserções de URL (`:1247`) e de foco no título da lista (`:1248`) continuam. A espera está dentro de `fecharPainel` (`:214`), então esse fechamento também passa por ela.
- **Contagem do documento, certa.** O arquivo tem 12 `await fecharPainel(`, nas linhas 379, 432, 447, 454, 515, 638, 908, 952, 965, 978, 1149 e 1246, como o documento diz. Não sobrou nenhum toque no "Fechar" do painel fora de `fecharPainel`:
  - os `tocar(noDialogo(page), 'Fechar', …)` são do diálogo do convite;
  - o `:749` é `alvoDeToque`, que mede o tamanho do botão e não toca nele.
  
  A frase errada sobre "todo caso do arquivo" saiu do documento.
- **Recomendações da rodada 1, aplicadas.**
  - `yDoFechar` afirma `not.toBeNull()` antes de cada medida (`:489-493`). Antes, a comparação podia ser de -1 com -1 e passar sem medir nada.
  - A leitura segurada se solta num `finally` com `clearTimeout` e `segurada.abrir()` (`:511-513`). Chamar o `abrir` duas vezes não faz mal, porque ele só resolve uma promise.
  - O comentário diz que a mutação só fica vermelha porque a primeira medida sai antes dos 300 ms (`:497-498`).
- **A mutação continua alcançando a cláusula.** O bloco troca o corpo de `esperarOPainelAssentar` por `void page`. O texto que ele procura não mudou, só o comentário acima, e o `falha: toBe(aoAssentar)` aparece em `expect(await yDoFechar()).toBe(aoAssentar)`. Sem a espera, a medida logo depois dela sai no estado "Carregando", e a de dois quadros depois sai com a folha crescida. Então o caso fica vermelho no `celular` pelo motivo certo.
- **As cláusulas da rodada 1 sem bloco próprio, justificadas.** O documento explica as três:
  - a troca no `:1246` usa a mesma espera que o bloco já tira;
  - o `not.toBeNull()` é pré-condição;
  - o `finally` só solta a leitura que ficaria presa.
  
  Concordo: nenhuma delas fica vermelha sozinha de forma determinística.
- **Sem `.skip`, sem mock que esconda a regra, sem IA nem provedor pago.** O `page.route` só segura a resposta de `/v1/disciplinas` até o teste soltar, e isso é a condição que o caso precisa criar.
- O que ficou de fora de propósito tem destino no `TODO.md`, com duas linhas novas e o motivo: os outros dois arquivos de e2e e a folha que cresce sob o dedo.

**Bloqueantes**
Nenhum.

**Recomendações**
1. `tasks/correcoes/2026-11-21-e2e-professores-convite-vencido-no-celular.md:41` ainda cita o caso novo com "…" no fim (`…só é tocado com a folha assentada…`). O título ficou curto e sem continuação, então o texto do documento deveria ser igual ao do caso, sem o "…".
2. Os outros arquivos com o mesmo toque sem espera, `e2e/professores-envio.spec.ts` e `e2e/alocacao.spec.ts`, continuam como estão. Isso é de propósito e está no `TODO.md`. Quem os tocar deve levar `esperarOPainelAssentar` para `e2e/support/`.

Não rodei o e2e: o portão da tarefa já rodou as mutações, e não alterei nenhum arquivo.
