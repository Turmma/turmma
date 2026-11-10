# Achados das revisões — `tasks/correcoes/2026-11-10-vitrine-com-provedor.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-10 10:55:19 · `tasks/correcoes/2026-11-10-vitrine-com-provedor.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo de pessoa. A correção grava duas coisas da instituição no banco de teste. A primeira é uma linha em `provedor_escola` (`google`, domínio `escola-a.educa-sintetica.test`) em cada escola da vitrine. A segunda é um `acesso_turma` vigente na 2ºB da escola cheia, que guarda só hash do token e HMAC do código. O tipo `Acessos` ganha `provedor.dominio` e `sala` (turma, código, token), todos sintéticos.

Fora da tabela de dados do docs/lgpd.md: nada. Não há migration nem coluna nova.

Autorização por objeto: ok, nada mudou na API. O índice único de `provedor_escola` é por `(escola_id, provedor, valor)` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/packages/core/src/db/schema/provedor-escola.ts:32`). Por isso as duas escolas podem liberar o mesmo domínio sem colidir, e nenhuma enxerga a outra. Como não existe `conta_externa`, uma conta do domínio não alcança nenhum usuário de nenhuma das duas.

Logs: limpos. `esperarAsAnimacoes` e `assentar` (`tools/vitrine/foto.ts:414-453`) não registram nada. O resumo de `escola.ts:352-362` escreve no terminal só domínio, assunto sintético do `oidc-falso`, código e link da sala do banco de teste. O arquivo `.processo/vitrine.json` está no `.gitignore` (`.gitignore:26`).

Auditoria: não se aplica. É ferramenta de teste e não muda nenhuma ação auditável.

Envio externo: nenhum. O provedor é o `oidc-falso` local do compose de teste.

Seed/fixture: sintético.
- Os nomes nas fotos ("Colégio sintético da vitrine cheia 66f0d799", "Aluna Sintética Bia Vitrine", "Aluno Sintético Davi Vitrine") são inventados.
- A conta `google-aluna-a` do `infra/oidc-falso/config.json` devolve e-mail, nome e foto fictícios no token.
- O teste de integração prova que nenhuma `conta_externa` é criada nas duas escolas (`tools/vitrine/escola.int.test.ts`, caso "as duas escolas liberam o Google…"). Por isso nada do que o provedor devolve fica no banco pela montagem.

Fotos da tela, conferidas para a regra 20:
- `aluno--e-…-computador.png`, `aluno--e-…-celular.png`, `vazia--aluno--…-computador.png` e `vazia--aluno--…-celular.png` mostram só o nome da escola, os campos vazios e o botão "Entrar com a conta Google da escola". Não aparece nenhum dado de aluno.
- `aluno--e-…-turma--computador.png` e `…-turma--celular.png` mostram a lista de nomes livres da turma, que é o comportamento da página pública da sala de antes desta correção. Os nomes são sintéticos. Não aparece matrícula, nota nem conteúdo.

Pergunta de fechamento: sem efeito. A correção não cria nenhum dado de titular nem envia nada para fora, então não muda o que o sistema guarda sobre um aluno nem para onde isso foi.

Bloqueantes: nenhum.

Recomendações:
1. Para o `frontend-reviewer`, fora da minha regra: em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/.processo/vitrine/aluno--e-e2e-1f4bacce-63f3-4fa5-b2fe-d80e66f0d799-turma--computador.png` a onça ainda aparece translúcida. O sintoma 2 desta mesma correção prometia acabar com isso. Pode ser estado pretendido da tela da sala ou a espera de `tools/vitrine/foto.ts:452` não estar valendo ali, porque o `.catch(() => undefined)` esconde falha do `evaluate`. Vale conferir antes de dar o sintoma 2 por resolvido.
2. Se a vitrine for usada para fotografar o fluxo completo da conta da escola (o login por `google-aluna-a` até "Conta da escola confirmada"), vale uma linha na integração conferindo que a `conta_externa` criada nesse login guarda só provedor e `sujeito`, sem e-mail nem `hd`. Hoje isso está provado pelos testes da 14.0, não pela vitrine.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-10 10:55:24 · `tasks/correcoes/2026-11-10-vitrine-com-provedor.md`

**VEREDITO: APROVADO**

```
VEREDITO: APROVADO
Caminhos de escrita em Nota: nenhum novo — todos com autor humano? sim (nenhum caminho de Nota novo)
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok (nenhuma saída de IA no diff)
Supervisão do tutor: ok (nada do tutor no diff)
Autonomia declarada e visível: sim (nada mudou nela)
Bloqueantes: nenhum
Recomendações: duas, abaixo
```

**O que o diff faz e o que conferi**

A tarefa só mexe na ferramenta que fotografa a tela, em `tools/vitrine/`. As duas escolas de teste passam a liberar o Google sintético, e a escola cheia ganha o acesso aberto da sala. A foto passa a esperar a onça terminar de entrar.

- **Nota (item 1):** as duas funções novas que a vitrine chama gravam só em `provedor_escola` (`e2e/support/seed.ts:323`) e em `acesso_turma` (`e2e/support/seed.ts:1151`). Nenhuma toca em `Nota`, em correção ou em entrega. `escola.ts` não cria nota por nenhum caminho novo.
- **Itens 2, 3, 5, 6, 8 e 9:** o diff não tem agente, saída de IA, aprovação, autonomia, auditoria, discursiva nem indicador de professor. Nenhum deles é afetado.
- **Itens 4 e 7:** não há tutor nem medida de comportamento. A nova espera das animações roda no navegador que tira a foto, não no do aluno. Não mede uso nem navegação de ninguém.
- **Dado de pessoa:** `escola.int.test.ts:285-286` prova que nenhuma `conta_externa` é criada. O provedor liberado é dado da escola e a conta do provedor é inventada (`google-aluna-a`).

**As seis fotos**

- **Entrada `/e/<slug>`, escola cheia e escola vazia, computador e celular:** mostram matrícula, senha e "Entrar com a conta Google da escola". Não há saída de IA, nota, conceito ou agente falando. Nada puxa o aluno a ficar.
- **Sala `/e/<slug>/turma#…`, escola cheia, computador e celular:** mostram "Entrar com a conta da escola", a escolha do nome, a matrícula com senha e a saída "Não é a sua turma? Usar outro código". Sair continua tão fácil quanto entrar, o que atende a regra 70 item 4b.
- A onça é a mascote da marca e não um agente. Ela não fala nem se passa por pessoa, então a D58 não se aplica.

**Recomendações**

1. **A onça ainda sai apagada numa foto.** Em `aluno--e-e2e-1f4bacce-63f3-4fa5-b2fe-d80e66f0d799-turma--computador.png`, a da sala no computador, a onça aparece translúcida enquanto o quadro ao lado está nítido. A espera nova (`tools/vitrine/foto.ts:701-721`, chamada em `foto.ts:739`) resolve a entrada `/e/<slug>`, mas não esta página. Talvez a cena só monte depois de a sala abrir o link, ou a foto da página inteira (970 px) seja tirada antes de a animação começar. Não é da regra 70: é qualidade de tela e é o `frontend-reviewer` quem decide. Mas o item da TODO que a tarefa marcou como resolvido não está resolvido nesta tela.
2. **A conta confirmada ainda não tem foto.** A vitrine agora deixa chegar a "Conta da escola confirmada…", mas nenhuma das seis fotos mostra essa tela. Ela só aparece depois do passo pelo provedor sintético. O Validador precisa fotografá-la pela sala da escola cheia para fechar o requisito.

**Arquivos**
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tools/vitrine/escola.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tools/vitrine/foto.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/e2e/support/seed.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tasks/correcoes/2026-11-10-vitrine-com-provedor.md`

## frontend-reviewer · 1ª rodada · AJUSTES NECESSÁRIOS · 2026-11-10 10:56:54 · `tasks/correcoes/2026-11-10-vitrine-com-provedor.md`

VEREDITO: AJUSTES NECESSÁRIOS

Tela vista: sim (6 fotos lidas: entrada e sala, no computador e no celular, na escola cheia; entrada da vazia nos dois tamanhos). Também tirei fotos extras com Playwright, na pasta temporária da sessão, e rodei o clique no botão da conta.

Estados: ok para o que a vitrine mostra. Carregando e erro não aparecem na vitrine, e esta tarefa não mexe no `apps/web`. A tela vazia convida: tem o formulário de matrícula e o botão da conta da escola.

Acessibilidade: sem achado. Os rótulos de campo estão presentes e a pele segue o padrão. O foco no título da turma é programático e esperado.

Chromebook fraco: não se aplica à ferramenta. A sala rola a 970 px a 1366 × 768, e essa altura vem da lista de nomes mais o formulário. Nenhum RF dizendo que a tela cabe apareceu nas fotos.

Celular:
- Sem rolagem horizontal e sem texto cortado.
- Os botões têm cerca de 45 px.
- "Não é a sua turma? Usar outro código" quebra em duas linhas. Isso já está no TODO e não é desta tarefa.

Ação oficial protegida: sim. Nenhuma ação oficial é tocada. A vitrine libera só o domínio do provedor, e nenhuma `conta_externa` é criada.

**Resposta à pergunta da Mesa sobre a onça translúcida**

A translucidez não é o desenho da tela e não é animação em andamento na hora da foto. A espera de `foto.ts` não cobre esta tela. A causa é outra.

O que medi no Chromium, contra a vitrine montada, na sala com o link:
- Com a página parada, as animações `onca-entrar` e `onca-acenar` estão `finished` e a opacidade é 1.
- O `page.screenshot({ fullPage: true })` recria as duas animações. Logo depois da chamada ficam `running`, em `currentTime` ≈ 50 ms, e a opacidade da onça fica em ≈ 0,32.
- Isso só aparece com página mais alta que a janela. A sala tem 970 px contra 768. As entradas cabem em 768 e saem opacas.
- Isso explica as três fotos idênticas byte a byte. Cada uma recria a animação e a congela no mesmo ponto. Qualquer espera feita antes da foto é desfeita pela própria foto.
- Redimensionar a janela para a altura da página (1366 × 970), esperar as animações e tirar a foto sem `fullPage` saiu com a onça opaca.

**Bloqueantes**

1. `tools/vitrine/foto.ts:297` e `:305`: o `fullPage: true` recria a animação da onça em toda página que rola a 1366 × 768. A espera nova em `assentar` (`foto.ts:173`) roda antes da foto e não protege nada. A sala, que é a tela que o Validador precisa fotografar, continua com a onça translúcida.
   - O documento afirma o contrário, no Sintoma 2 e na Correção, e o TODO foi marcado `[x]` por isso.
   - Correção exigida: no computador, ajustar a janela à altura medida da página (`setViewportSize` com `alturaDaPagina`), esperar as animações de novo e tirar a foto sem recriá-las. Os pedaços do celular têm o mesmo risco, e a onça de lá é parada.
   - Teste exigido: um caso que prove que nenhuma animação reiniciou depois da foto, na página mais alta que a janela. Hoje os testes usam documento falso e não pegam isso.
   - Reabrir o item do TODO `[x]` "A onça sai translúcida na foto do computador" até a sala sair opaca.

2. `tools/vitrine/foto.ts:259` e `tools/vitrine/escola.ts:331-336`: a vitrine promete a "Conta da escola confirmada", mas o agente não chega nela pela ferramenta.
   - `chromium.launch()` não leva o `--host-resolver-rules` do `playwright.config.ts:41`. O clique em "Entrar com a conta da escola" vai para `http://oidc-falso:8080/...`. Rodei `foto aluno <sala> --clicar 'text=Entrar com a conta da escola'`. A saída foi `a página parou em /`, e a foto em `.processo/vitrine/aluno--e-e2e-…-turma--Entrar-com-a-conta-da-escola--computador.png` saiu em branco. A causa é `net::ERR_NAME_NOT_RESOLVED`.
   - Com a regra do e2e, o fluxo chega à tela do provedor falso, onde é preciso digitar o assunto `google-aluna-a`. `--clicar` só clica, não preenche. O fluxo inteiro a "Conta da escola confirmada" não sai pelo `foto`.
   - O resumo diz que "o botão e 'Conta da escola confirmada' aparecem aqui" na sala. Isso só vale com um navegador montado à mão.
   - Corrigir o `launch` com a mesma regra (lida de `LOGIN_EXTERNO_GOOGLE_EMISSOR` e `OIDC_FALSO_PORTA_HOST`), ou então reescrever a linha do resumo para dizer a verdade. A linha de `escola.ts:331` diz botão "Entrar com a conta da escola" em `/e/<slug>`. O rótulo real nessa entrada é "Entrar com a conta Google da escola" (visto na foto), e o seletor `text=Entrar com a conta da escola` não casa ali. Hoje o resumo leva o agente a um clique que falha. O texto da sala é "Entrar com a conta da escola", e o do resumo vale só para ela.

**Recomendações**
- Documentar no resumo que a onça só fica opaca depois da correção 1. Até lá, o agente deve tratar a onça translúcida em página alta como defeito da ferramenta, e não da tela.
- A foto da sala é a mais alta (970 px). Seria útil o `foto` poder preencher campos (`--preencher`), para chegar à conta confirmada num comando só.
- O texto "Não é a sua turma? Usar outro código", que quebra no celular, segue no TODO.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tools/vitrine/foto.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tools/vitrine/escola.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/playwright.config.ts`

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-10 10:57:02 · `tasks/correcoes/2026-11-10-vitrine-com-provedor.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. É correção de `tools/vitrine/`, sem seção de Tech Spec. O provedor e a sala usam as peças do e2e (`liberarProvedorDaEscola`, `gerarAcessoDaSalaNoBanco`), e nenhuma `conta_externa` é criada.
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

Bloqueantes:

1. **`tools/vitrine/foto.ts:297` e `:305`: a foto da página que rola continua saindo com a onça translúcida.** O documento promete, no Sintoma 2 e na Correção, que a foto espera a entrada da onça. Isso não vale para `/e/<slug>/turma`, que é justamente a tela que esta correção abriu.
   - **Causa:** a espera funciona, e o erro está na foto. O `page.screenshot({ fullPage: true, clip })` de uma página mais alta que 768 px faz o Chromium reiniciar as animações CSS. O quadro é tirado com a entrada de 240 ms recomeçando.
   - **Como reproduzi:** rodei um script no Chromium do Playwright contra a vitrine de pé.
     - Depois do `esperarAsAnimacoes`, a opacidade do `.onca-entra` é `1`, com `onca-entrar` e `onca-acenar` em `finished`.
     - Logo depois do `screenshot({ fullPage: true, clip: {…, height: 970} })`, ela cai para `0.32`, com as duas animações de volta a `running` em `currentTime ≈ 50 ms`.
     - A foto que sai é a mesma da vitrine (`aluno--e-e2e-1f4bacce-…-turma--computador.png`, o mesmo tamanho de arquivo em três tiradas).
   - **Por que a entrada `/e/<slug>` sai opaca:** ela cabe na janela de 768 px. É por isso que a correção parecia funcionar nas outras fotos.
   - **Correção exigida:**
     - Passar `animations: 'disabled'` nas duas chamadas de `page.screenshot`. É a opção padrão do Playwright: a animação finita pula para o fim e a infinita é cancelada. Conferi que com ela a mesma página de 970 px sai com a onça opaca.
     - Ver se o `esperarAsAnimacoes` ainda é necessário. Com a opção, ele fica redundante, e manter os dois é um segundo jeito de fazer a mesma coisa.
     - Ter teste que pegue a página que rola. Hoje a mutação "assenta sem esperar as animações" só prova a ordem das chamadas num `page` falso, não o resultado da foto.
     - Corrigir o texto da Correção, que hoje diz "conferido num Chromium de verdade" sem o caso da página inteira.

Recomendações:
- **`foto.ts:173`:** o `.catch(() => undefined)` em volta do `page.evaluate(esperarAsAnimacoes, …)` engole qualquer falha da função no navegador, e a espera some sem aviso. Se ela ficar, escreva o erro no stderr.
- **`escola.ts:390`:** a checagem de vitrine antiga (`provedor === undefined`) é ad hoc. Ela vai crescer a cada campo novo. Um número de versão no arquivo resolveria de uma vez.
- O resumo diz como chegar à "Conta da escola confirmada", mas nada fotografa essa tela. Fica para o Validador, como o documento já assume.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tools/vitrine/foto.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tasks/correcoes/2026-11-10-vitrine-com-provedor.md
- Foto com o problema: /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/.processo/vitrine/aluno--e-e2e-1f4bacce-63f3-4fa5-b2fe-d80e66f0d799-turma--computador.png
- Reprodução: /tmp/claude-1000/-home-joaquimdp-Documents-git--maestri-floors-educaia--specacesso-e-convites--l2/c67842e1-df3a-42b9-9226-abe48b8014f5/scratchpad/sonda.ts. A foto da janela sai opaca (`viewport.png`), a da página inteira translúcida (`full-clip.png`), e a com `animations: 'disabled'` opaca (`full-clip-2.png`), as três na mesma pasta.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-10 10:57:51 · `tasks/correcoes/2026-11-10-vitrine-com-provedor.md`

VEREDITO: REPROVADO

Cenários exigidos:
1. Caminho feliz: as duas escolas liberam o Google para o domínio do `oidc-falso`. O botão aparece em `/e/<slug>`, a cheia abre a sala pelo link e pelo código, e a foto sai com a onça opaca.
2. Borda: tela que rola a 1366 × 768. A foto sai em página inteira, além da janela, e a `/e/<slug>/turma` dá 970 px.
3. Borda: animação infinita, pausada, já acabada com `fill: both`, sem efeito, e a que começa depois da primeira (o aceno).
4. Borda: vitrine antiga no arquivo, sem `provedor` em uma das escolas ou nas duas.
5. Borda: escola sem nome livre não ganha sala nem promete sala.
6. Borda: sala vencida (o acesso dura 7 dias) e lista de nomes esgotada pelo próprio Validador.
7. Permissão e dado de pessoa: nenhuma `conta_externa` criada, e o segredo do segundo fator fora do resumo.
8. Isolamento: o provedor e a sala de uma escola não aparecem na outra, contados por `escola_id`.
9. Caminho completo prometido: do botão da sala ao provedor sintético e à "Conta da escola confirmada…".

Cobertos:
- 1, sem a foto: `escola.int.test.ts` (as duas escolas liberam o Google; a cheia tem o acesso da sala vigente) e `escola.test.ts` (o resumo diz onde está o botão).
- 3, só com documento falso: os sete casos de "a espera das animações".
- 4: "trata como não montada a vitrine de antes do provedor" e "sem arquivo, não há vitrine".
- 5 e 8: o caso da sala vigente conta `acesso_turma` por `escola_id`, e o do provedor confere a lista exata de cada escola.
- 7: `conta_externa` com total 0 em cada escola.
- As 17 mutações batem com o diff. Os blocos chegam às cláusulas, e não há `.skip` nem provedor pago.

Bloqueantes:

1. **Nenhum teste prova que a foto da tela real espera a onça, e a foto real mostra que não espera.**
   - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tools/vitrine/foto.test.ts:346-403` usa um `documento` falso.
   - `foto.test.ts:405-429` usa uma `Page` falsa. O `evaluate` dela devolve `0` sem rodar a função, então o teste só confere a ordem das chamadas. Não prova que `esperarAsAnimacoes` roda dentro do Chromium, nem que vê a animação da onça (SVG, `.onca-animada .onca-entra`), nem que a captura sai opaca.
   - `foto.ts:173` cala toda falha do `evaluate` com `.catch(() => undefined)`, então uma falha no navegador também passaria sem aviso.
   - O "conferido num Chromium de verdade" do documento (linhas 48-49) não é teste e não se repete.
   - A foto `aluno--e-...-turma--computador.png` saiu com a onça translúcida três vezes seguidas. É justamente a tela da sala, que esta correção quer fotografar.
   - A `/e/<slug>` opaca não prova a correção. O `alturaDaPagina` (`foto.ts:177-186`) já espera pelo menos 250 ms antes da foto, mais que os 240 ms da entrada.
   - O que distingue as duas telas é que a da turma rola. Ela vai para `page.screenshot({ fullPage: true, clip })` além da janela (`foto.ts:297`), e o Chromium captura isso com `captureBeyondViewport`. Hipótese, não provada: algo nessa captura recomeça ou recalcula a animação, e uma espera feita antes dela não alcança esse momento.

   Correção exigida:
   - Um teste de integração com Chromium de verdade (`chromium.launch`, `page.setContent`) e uma página mais alta que 768 px, com animação de opacidade de 240 ms com `both`.
   - O teste passa pelo mesmo caminho do `fotografar`: `assentar`, depois a captura com `fullPage` e `clip`, e confere o pixel do elemento animado (ou a opacidade calculada no instante da captura).
   - O teste fica vermelho sem a correção.
   - Pela D81, considerar `page.screenshot({ animations: 'disabled' })`: o Playwright adianta até o fim as animações finitas, que é o padrão de mercado para isto. Isso também tira a necessidade do mecanismo próprio.
   - O item de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/TODO.md:3342` não pode ficar `[x]` enquanto a foto da sala sair translúcida.

2. **Nada prova que da vitrine se chega à "Conta da escola confirmada…", que é o que o documento promete (linhas 1, 11, 41).**
   - `escola.test.ts:112` só confere o texto do resumo.
   - `escola.int.test.ts:40-72` confere as linhas no banco.
   - A única foto de hoje depois do clique, `aluno--e-...-turma--Entrar-com-a-conta-da-escola--computador.png` (10:55, 4,8 KB, e a do celular com 2,4 KB), é uma página toda branca. Não se sabe se o provedor sintético abriu.

   Correção exigida: um e2e (ou um teste de integração com navegador) que monte a vitrine e faça o caminho inteiro: `/e/<slug>/turma#<token>`, o clique no botão, a escolha de `google-aluna-a` no `oidc-falso` e o texto "Conta da escola confirmada" na sala. A outra saída é o documento e o resumo pararem de prometer esse caminho.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tools/vitrine/escola.int.test.ts:49`: `expect(CONTA_DO_PROVEDOR_SINTETICO).toBe('google-aluna-a')` compara a constante com ela mesma. Melhor ler `infra/oidc-falso/config.json` e conferir que o `match` e o `hd` existem lá. Hoje os dois batem (linhas 31 e 34 do config).
- No documento da tarefa, linha 33, o teste `assentar espera as animações depois da rede e do carregando` não existe. O nome real é `espera a rede, a sessão e o carregando, e só depois as animações, para a onça não sair translúcida`.
- `foto.test.ts:356-402` mede prazo com relógio real. As margens são folgadas, mas pela regra o prazo se prova com `vi.useFakeTimers()`.
- A sala da vitrine vence em 7 dias (`seed.ts:1164`) e `lerVitrine` não olha o vencimento. A lista também se esgota se o Validador reivindicar os dois nomes livres, e o botão some. Vale o `mostrar` avisar nos dois casos.
- `esperarAsAnimacoes` não registra nada quando bate no teto. Uma linha de aviso ajudaria a ver a foto tirada no teto.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-10 11:25:38 · `tasks/correcoes/2026-11-10-vitrine-com-provedor.md`

VEREDITO: APROVADO
Tela vista: sim (6 fotos lidas: a entrada `/e/<slug>` e a sala `/e/<slug>/turma`, na escola cheia, em 1366 e 360 px, mais a entrada da escola vazia nos dois tamanhos; a sala vazia não existe, porque a vazia não tem sala)
Estados: ok. Esta correção não toca `apps/web`. Carregando e erro seguem pelo código e pelo e2e da 16.0, e eu não os reconferi. As duas escolas têm tela, e a vazia mostra o login e o botão da conta Google da escola.
Acessibilidade: sem mudança de código de tela. Na foto da sala há foco visível no título "Turma 2ºB…" (anel azul), campos rotulados e botões com texto.
Chromebook fraco: a correção só afeta a ferramenta de foto, não o produto.
Celular: a 360 px não há rolagem horizontal nem texto cortado. "Entrar com a conta Google da escola" tem 44 px de altura, "Enviar pedido" e "Mostrar" também. "Entrar com a conta da escola" tem cerca de 42 px e quebra em duas linhas, e "Não é a sua turma? Usar outro código" também quebra. Os dois funcionam e já estão no TODO.md como recomendação.
Ação oficial protegida: sim. Não há ação oficial nesta correção.

Verificação das duas correções exigidas:
1. A onça opaca. `tools/vitrine/captura.ts:21` passa `animations: 'disabled'` ao `page.screenshot` com `fullPage` e `clip`.
   - `tools/vitrine/foto.ts:251` e `:259` chamam `tirarAFoto` nas duas capturas: o recorte e a página inteira do `catch`. Nenhum outro `screenshot` ficou em `tools/vitrine`.
   - Na foto `aluno--e-e2e-84f65f55-…-turma--computador.png` (970 px de altura) a onça sai opaca e com o aceno completo. Na rodada anterior saía translúcida.
   - `e2e/vitrine-foto.spec.ts` prova isso na sala real, nos dois projetos (`chromebook` e `celular`). Ele confere que a altura do PNG é a do recorte e que as animações não voltam a `running`. A mutação documentada tira a opção e o teste quebra. Não rodei o e2e, mas a foto desta árvore confirma o resultado.
   - A espera própria (`esperarAsAnimacoes`) saiu junto com o teste de relógio dela. Nenhuma referência sobrou.
2. O resumo não promete mais a "Conta da escola confirmada".
   - `tools/vitrine/escola.ts` diz agora que o botão leva ao provedor sintético, "que o `foto` ainda não alcança: da vitrine só se vê o botão".
   - O rótulo da entrada passou a ser "Entrar com a conta Google da escola", igual ao da foto. O da sala continua "Entrar com a conta da escola", e o resumo diz isso.
   - `tools/vitrine/escola.test.ts` cobre o resumo e confere a conta `google-aluna-a` e o domínio contra `infra/oidc-falso/config.json`.
   - O que falta para o `foto` chegar à conta confirmada (`--host-resolver-rules` e `--preencher`) está no TODO.md com dono.

Bloqueantes: nenhum.
Recomendações:
- A foto da conta confirmada continua impossível pela ferramenta. A Validação deve fotografar o botão e a sala, e usar o e2e `conta-da-escola-na-sala.spec.ts` como prova da conta confirmada, até o `--preencher` existir. Isso já está no TODO.md.
- "Não é a sua turma? Usar outro código" e "Entrar com a conta da escola" quebram em duas linhas no celular, em `apps/web/src/pages/TurmaPublica.tsx`. Texto mais curto na próxima tarefa que tocar a tela.
- A mensagem do resumo ("que o \`foto\` ainda não alcança") é texto para o agente e não aparece ao usuário final. Se o `foto` ganhar o `--preencher`, o resumo precisa mudar junto.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-10 11:25:55 · `tasks/correcoes/2026-11-10-vitrine-com-provedor.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum novo nesta rodada. O diff mexe só em `tools/vitrine/`, no e2e `e2e/vitrine-foto.spec.ts`, no `TODO.md` e no documento da correção. O e2e novo grava escola, estrutura, lista da turma e acesso da sala, e nada em `nota`. As montagens da vitrine que já existiam não mudaram desde a 1ª rodada. Todos com autor humano? sim, porque não há caminho novo.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nesta rodada não entra nenhuma saída de IA.
Supervisão do tutor: ok. O tutor não foi tocado.
Autonomia declarada e visível: sim. Nada mudou aqui, e nenhum agente aparece nas telas fotografadas.
Bloqueantes: nenhum

Conferência das correções pedidas na 1ª rodada:
- **Onça translúcida (item 1 da ordem): feita.** `tools/vitrine/captura.ts:339` passa `animations: 'disabled'` às duas capturas de `fotografar` (`tools/vitrine/foto.ts:251` e `:259`). Na foto `aluno--e-e2e-84f65f55-f9b1-4030-9db3-6a8ddd8e2010-turma--computador.png`, que é a sala de 970 px que rola, a onça agora sai opaca. O caso que prova isso é `e2e/vitrine-foto.spec.ts:41`. Ele roda na sala real e tem mutação declarada para a opção e para o recorte.
- **Resumo prometia a "Conta da escola confirmada" (item 3): feita.** `tools/vitrine/escola.ts:430` passou a dizer que o `foto` ainda não chega ao provedor sintético. `:435` não cita mais a conta confirmada. O caminho que falta (`--host-resolver-rules` e `--preencher`) está registrado no `TODO.md`, com dono.

As seis fotos, pela regra 70:
- **`/e/<slug>`, cheia e vazia, no computador e no celular:** são telas de entrada, com matrícula, senha e "Entrar com a conta Google da escola". Não há saída de IA, nota, conceito nem sugestão de nota.
- **`/e/<slug>/turma`, cheia, no computador e no celular:** o pedido de entrada na turma, com conta da escola, escolha do nome e "Se o seu nome não aparece, chame o professor.". Nenhuma decisão automática sobre o aluno: o pedido vai a um humano. Também não há indicador de comportamento.
- **Uso excessivo e saída:** nada induz uso excessivo. "Não é a sua turma? Usar outro código" fica visível nas duas telas, então sair não é mais difícil que entrar.
- **Onça:** aparece como ilustração da marca e não fala como agente. Não se passa por pessoa (D58).

Recomendações:
- A foto da "Conta da escola confirmada" continua sem existir. Quando o `foto` ganhar `--host-resolver-rules` e `--preencher` (o item já está no `TODO.md`), vale fotografar essa tela.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tools/vitrine/captura.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tools/vitrine/foto.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tools/vitrine/escola.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/e2e/vitrine-foto.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/.processo/vitrine/aluno--e-e2e-84f65f55-f9b1-4030-9db3-6a8ddd8e2010-turma--computador.png

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-10 11:25:55 · `tasks/correcoes/2026-11-10-vitrine-com-provedor.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. O e2e novo, `e2e/vitrine-foto.spec.ts`, grava no banco de teste uma escola sintética e uma lista de seis nomes ("Aluna sintética N <marca>"), com matrícula `M<N>-<marca>`. Ele usa as funções que já existiam em `e2e/support/seed.ts` (`criarEscolaSintetica`, `porNaListaDaTurma`, `gerarAcessoDaSalaNoBanco`). Nesta rodada não mudou nenhuma migration nem o schema.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. O diff não traz rota nem endpoint, só `tools/vitrine/` e um e2e. As fotos mostram as telas que já existiam, com o comportamento que as tarefas 14.0 e 16.0 já aprovaram:
- Em `/e/<slug>`, nas duas escolas, aparecem só o nome da escola, o formulário e o botão "Entrar com a conta Google da escola". Nenhum dado de aluno.
- Em `/e/<slug>/turma#<link>`, só os nomes livres da 2ºB aparecem, e só para quem tem o link vigente. Os dois nomes são sintéticos ("Aluna Sintética Bia Vitrine", "Aluno Sintético Davi Vitrine"). Nenhuma matrícula aparece.

Logs: limpos. `tools/vitrine/captura.ts` e o que mudou em `tools/vitrine/foto.ts` não registram nada. A função `esperarAsAnimacoes` foi removida.

Auditoria: não se aplica. O diff não lê dado de aluno pela coordenação ou pela rede, não exporta, não altera nota nem permissão e não aprova saída de IA.

Envio externo: nenhum. O botão só leva ao `oidc-falso` local, e o `foto` não chega até lá, como o resumo agora diz. A vitrine continua sem criar `conta_externa`: a contagem de zero linhas segue em `tools/vitrine/escola.int.test.ts:126-127`. A mudança nesse arquivo só tirou a afirmação sobre a constante, que passou a ser conferida contra `infra/oidc-falso/config.json` em `tools/vitrine/escola.test.ts:115-124`.

Seed/fixture: sintético. A escola é "Colégio sintético da vitrine cheia/vazia", o domínio é `escola-a.educa-sintetica.test` e a conta é `google-aluna-a`. Os nomes do e2e levam a palavra "sintética" e um sufixo aleatório. Não há dado real nem dump.

Bloqueantes: nenhum.

O que a rodada anterior deixou, e o que aconteceu:
- **A onça translúcida:** resolvida. Em `aluno--e-e2e-84f65f55-…-turma--computador.png` ela sai opaca. A causa era o `fullPage` reiniciar as animações, e quem conserta é o `animations: 'disabled'` em `tools/vitrine/captura.ts:339`. O e2e prova isso na sala real.
- **A `conta_externa` pela vitrine:** foi recusada com motivo que aceito, porque a vitrine não cria conta e o teste de integração confirma isso.

Recomendações:
- A sala mostra os nomes livres a quem tem o link. Pela regra 20 isso está certo e foi aprovado na 14.0 e na 16.0, mas o link da vitrine vale 7 dias e circula no resumo. O item do `test-engineer` que já está no `TODO.md`, de o `mostrar` avisar quando o acesso vence, cobre a parte operacional. Fica registrado só para a retro.
- O e2e grava a escola sintética no banco de teste e não apaga. Isso segue o padrão dos outros specs e não é dado real, então não bloqueia.

Arquivos que conferi:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/.processo/ordens/diff-vitrine-r2.txt`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tools/vitrine/captura.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/e2e/vitrine-foto.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/.processo/vitrine/` (as seis fotos indicadas)

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-10 11:26:20 · `tasks/correcoes/2026-11-10-vitrine-com-provedor.md`

VEREDITO: APROVADO

Tabelas verificadas: `provedor_escola` e `acesso_turma`, onde a vitrine grava. As duas já existiam e esta correção não mexe nelas. Também `conta_externa`, `lista_nome` e `turma`, que os testes só leem. As duas tabelas gravadas têm `escola_id`, e `acesso_turma` também tem `ano_letivo_id`, que vem da própria turma (`select ano_letivo_id from turma where escola_id = $1 and id = $2`). O índice único de `provedor_escola` é por escola (`escolaId, provedor, valor`). Por isso as duas escolas podem liberar o mesmo domínio `escola-a.educa-sintetica.test` sem conflito.

Queries verificadas:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/e2e/support/seed.ts:323` (`liberarProvedorDaEscola`): o insert leva o `escolaId` que a vitrine recebeu ao criar a própria escola.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/e2e/support/seed.ts:1151` (`gerarAcessoDaSalaNoBanco`): a turma é lida com `escola_id = $1 and id = $2`, o acesso vigente é revogado com `escola_id` e `turma_id`, e o insert leva `escola_id`. Turma de outra escola dá erro, não gera acesso.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tools/vitrine/escola.int.test.ts`: as consultas novas filtram por `escola_id`, e a subconsulta de `lista_nome` amarra `escola_id` e `turma_id` ao acesso.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/e2e/vitrine-foto.spec.ts`: cria uma escola nova a cada execução e abre só a sala dela, pelo link público. Não toca dado de outra escola.
- Do lado da API, a leitura que põe o botão na tela já filtra pela escola da rota: `apps/api/src/credencial/acesso-publico.repository.ts:22` e `apps/api/src/sessao/external/conta-externa.repository.ts:48,59,76` usam `requireEscolaId()`. Liberar o mesmo domínio nas duas escolas não deixa uma alcançar a outra.

Nenhum endpoint, repository, migration ou `@Unscoped()` novo. Nada lê `escolaId` vindo do cliente. Os ids são UUID, gerados pelo banco ou por `randomUUID`. A camada de rede não é tocada.

Fotos: a sala da escola cheia mostra só a turma e os nomes sintéticos dela ("Turma 2ºB …", "… Vitrine"). A escola vazia mostra só o nome dela e o botão Google. Nenhuma tela mostra dado da outra escola.

Teste de isolamento: ausente, e esta correção não precisa de um, porque não cria módulo, repository nem endpoint. Ela só gera dado de teste por peças do e2e que já existiam e que já filtram por escola. O teste de integração confere, por `escola_id`, que a escola vazia tem zero linhas em `acesso_turma` e que nenhuma das duas tem `conta_externa`.

Bloqueantes: nenhum

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tools/vitrine/escola.int.test.ts`: falta conferir que o acesso da sala gravado na escola cheia não aparece com o `escola_id` da vazia. Hoje a separação vem só de `gerarAcessoDaSalaNoBanco`, sem prova na vitrine. Basta uma linha.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-10 11:26:38 · `tasks/correcoes/2026-11-10-vitrine-com-provedor.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum (a correção mexe só na ferramenta de teste `tools/vitrine/` e no e2e `e2e/vitrine-foto.spec.ts`; nada em `apps/`, `packages/core/` nem `infra/`)
Rate limit: ok (nenhum limite novo nem alterado. O spec abre a sala anônima de uma escola só dele, com slug `e2e-<uuid>`, então não divide o balde por escola com outro spec)
Fila e prioridade: ok (não se aplica: nenhum job novo)
Concorrência: protegida (cada execução cria escola, turma e acesso próprios. `gerarAcessoDaSalaNoBanco` revoga e insere só na turma da própria escola, e `liberarProvedorDaEscola` grava em escola recém-criada, sem disputa entre workers do `fullyParallel`)
Índice e paginação: ok (não se aplica: nenhuma query nova no produto. As consultas novas de `escola.int.test.ts` filtram por `escola_id`)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (não se aplica: nada novo no caminho quente)
Bloqueantes: nenhum

O que conferi no ambiente de teste:
- **Prazo:** pela última execução gravada em `.processo/e2e-duracao.json`, o caso leva 5.534 ms no chromebook e 5.511 ms no celular. O prazo padrão é de 30 s, e o limite da régua local é de 15 s (`LIMITE_DO_CASO_DE_E2E_MS`). O caso fica abaixo dos dois e não usa `test.slow` nem `setTimeout`, o que está certo para ele.
- **Banco compartilhado:** cada conexão que `comBanco` abre é fechada no `finally`. A escola de cada caso é isolada e nenhum dado global é mexido.
- **Estabilidade:** as esperas são `expect.poll` sobre `document.getAnimations()`, sem pausa fixa. As animações da onça têm `fill: both`, então continuam na lista depois de acabar, e a espera não fica pendurada.
- **Recurso preso:** a vitrine só cria linhas que somem quando o portão recria o banco: o acesso da sala vale 7 dias e o provedor fica em `provedor_escola`. Não abre conexão persistente, processo nem porta.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/e2e/vitrine-foto.spec.ts`: no projeto `celular` a onça é parada, então `antes` pode sair `[]`. Nesse caso `expect(await estados()).toEqual(antes)` compara lista vazia com lista vazia e não prova nada, salvo a altura do recorte. Vale afirmar que ali não há animação nenhuma, ou deixar escrito que o caso do celular confere só o recorte. É assunto do `test-engineer` e não bloqueia.
- O `foto` não leva o `--host-resolver-rules` nem tem `--preencher`, e a sala vence em 7 dias sem que o `mostrar` avise. Os dois itens já estão no `TODO.md` e não precisam de ação nesta correção.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-10 11:26:41 · `tasks/correcoes/2026-11-10-vitrine-com-provedor.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok (a correção mexe só na ferramenta `tools/vitrine/` e num e2e próprio, sem tocar arquitetura de produto)
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

As quatro partes da correção exigida na 1ª rodada foram feitas:
- **As duas capturas.** Passam por `tirarAFoto`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tools/vitrine/captura.ts:338-340`, com `animations: 'disabled'`. Uma é o recorte (`foto.ts:251`) e a outra é a página inteira do `catch` (`foto.ts:259`). Nenhum `page.screenshot` direto sobrou em `foto.ts`.
- **A espera.** `esperarAsAnimacoes` saiu, junto com os tipos e os testes de relógio dela. Nada mais a importa. `assentar` deixou de ser exportado.
- **O teste.** `e2e/vitrine-foto.spec.ts` cobre a página que rola na sala real. Ele confere que a página é mais alta que a janela, que nenhuma animação recomeça depois da foto e que o recorte é respeitado pela altura gravada no PNG. Duas mutações em `captura.ts` ficam registradas com a linha que falha.
- **O texto.** O documento agora diz onde a espera falhava (o reinício das animações no `fullPage`) e não diz mais "conferido num Chromium de verdade" sem o caso da página inteira. O resumo deixou de prometer a "Conta da escola confirmada" (`escola.ts:430`), e o caminho que falta foi para o `TODO.md`.

Nas fotos, a onça sai opaca nos dois casos que conferi:
- a sala que rola, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/.processo/vitrine/aluno--e-e2e-84f65f55-f9b1-4030-9db3-6a8ddd8e2010-turma--computador.png`;
- a entrada, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/.processo/vitrine/aluno--e-e2e-84f65f55-f9b1-4030-9db3-6a8ddd8e2010--computador.png`.

Os botões aparecem com os mesmos textos que o resumo dá: "Entrar com a conta Google da escola" na entrada e "Entrar com a conta da escola" na sala.

Recomendações:
- `e2e/vitrine-foto.spec.ts:57`: o mapa de `estados()` mistura `playState` com o marcador `'infinita'`. Uma função com nome próprio, ou um objeto `{ infinita, estado }`, deixaria a comparação `antes`/depois mais fácil de ler.
- `e2e/vitrine-foto.spec.ts:66-71`: a leitura da altura do PNG nos bytes 20 a 23 depende do formato do arquivo. Vale uma função auxiliar com nome (`alturaDoPng`) em `e2e/support/`, se outro spec precisar dela.

## test-engineer · 2ª rodada · APROVADO · 2026-11-10 11:28:00 · `tasks/correcoes/2026-11-10-vitrine-com-provedor.md`

VEREDITO: APROVADO

Cenários exigidos:
- Caminho feliz: a foto da sala real (`/e/<slug>/turma`, 970 px a 1366 × 768) sai com a onça opaca no computador.
- Borda: a página é mais alta que a janela, e é isso que a manda para o `fullPage` com recorte.
- Borda: o aceno começa quando a entrada de 240 ms acaba, e nenhum dos dois pode recomeçar na foto.
- Borda: o recorte tem de sair com a altura do pedaço pedido, e não com a da página inteira.
- Borda: no celular a onça é parada e nada recomeça.
- Promessa do resumo: ele mostra o botão e a sala e não promete mais a "Conta da escola confirmada".
- A conta sintética do resumo existe no `oidc-falso`, no domínio que a vitrine libera.
- Permissão e isolamento: não se aplicam a este diff de ferramenta. A rodada anterior já cobre a parte de banco (`provedor_escola`, `acesso_turma`, zero `conta_externa`), e este diff não mexe nela.

Cobertos:
- **Correção 1, atendida.** O teste fica em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/e2e/vitrine-foto.spec.ts`, caso `a foto da página que rola não recomeça a entrada da onça`, e responde às duas perguntas da Mesa:
  - **Fica vermelho sem a opção?** Sim. Ele roda no Chromium de verdade, na sala real, e confere que a página é mais alta que a janela. Espera as animações terminarem, guarda o estado delas, fotografa e exige o mesmo estado depois. Sem `animations: 'disabled'` a entrada e o aceno recomeçam e ficam rodando cerca de 1.040 ms (`Onca.css:17` e `:24`). A conferência vem milissegundos depois da foto, então o vermelho não depende de folga da máquina. O portão provou as duas mutações de `captura.ts`: sem a opção falha em `expect(await estados()).toEqual(antes)`, e sem o recorte falha na altura do PNG.
  - **Passa pelo mesmo caminho do `fotografar`?** Pela mesma função de captura, sim. As duas chamadas de `foto.ts` (`:251` e `:259`) vão para `tirarAFoto`, e é ela que o e2e chama, com `fullPage` e recorte. O teste não passa pelo `assentar`, mas a espera dele pelas animações é mais rigorosa, e o `assentar` não cuida mais de animação. A foto de agora (`aluno--e-…-turma--computador.png`) sai com a onça opaca.
- **Correção 2, atendida pela saída "parar de prometer".** O resumo diz que o `foto` ainda não alcança o provedor. A sala diz o rótulo certo ("Entrar com a conta da escola"). A entrada `/e/<slug>` diz "Entrar com a conta Google da escola". O documento tem a seção "O que o resumo promete, e o que não", e o caminho inteiro foi para o `TODO.md`. Tudo isso é conferido por `o resumo diz onde está o botão da conta da escola, sem prometer o provedor, e só a escola com sala mostra a sala`, com três mutações.
- **Recomendação 5 (constante comparada com ela mesma), atendida.** O teste se chama `é uma conta que o \`oidc-falso\` conhece, e do domínio que a vitrine libera`. Ele lê `infra/oidc-falso/config.json`, acha a conta e confere o domínio (`hd`).
- **Recomendação 6 (nome do teste no documento), atendida.** Os nomes em "Teste que reproduz" e nos blocos de "Mutações" são os que estão nos arquivos.
- **Recomendações 4 e 7 (erro calado na espera, prazo com relógio real), deixaram de existir.** A função `esperarAsAnimacoes` saiu, e os testes dela saíram junto. Isso segue a D81 (padrão de mercado antes de mecanismo próprio).
- Não há `.skip` nem mock escondendo a regra, e nenhum teste chama provedor de IA.
- `escola.test.ts` e `foto.test.ts` passam, 32 de 32. O e2e eu não rodei: ele precisa do ambiente de teste no ar, e o portão já o rodou com as mutações.

Bloqueantes: nenhum.

Recomendações:
1. As duas chamadas de `foto.ts` (`:251` e `:259`) não têm bloco de mutação, e o `--faltando` não as lista porque não têm condição. Se alguém trocar `tirarAFoto` de volta por `page.screenshot` em `fotografar`, nada fica vermelho, e a onça volta a sair translúcida. O conserto mais barato é um caso de guarda afirmando que `tools/vitrine/foto.ts` não chama `page.screenshot` direto, com um bloco para cada chamada.
2. `e2e/vitrine-foto.spec.ts:73`: conferir `estados()` logo depois de `tirarAFoto`, antes do `devicePixelRatio` e do `readFileSync`, encurta o tempo entre a foto e a conferência.
3. O e2e confere o estado das animações depois da foto, e não o pixel da onça dentro do PNG. É uma prova indireta, mas suficiente. Ler um pixel do SVG no PNG provaria direto o que a foto mostra.
4. No projeto `celular` o caso passa mesmo sem a opção, porque lá a onça não anima. O comentário do spec diz isso, e o vermelho que conta é o do `chromebook`. Vale citar no documento que a primeira mutação só falha nesse projeto.
5. `tools/vitrine/escola.ts:32`: o comentário de `DOMINIO_DO_PROVEDOR_SINTETICO` ainda diz que "a sala mostra 'Conta da escola confirmada'". Isso vale no e2e, não na vitrine. Vale escrever "no e2e" para não reabrir a promessa.

Arquivos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/e2e/vitrine-foto.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tools/vitrine/captura.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tools/vitrine/foto.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tools/vitrine/escola.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tools/vitrine/escola.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l2/tasks/correcoes/2026-11-10-vitrine-com-provedor.md`
