# Achados das revisões — `tasks/correcoes/2026-11-06-e2e-perto-do-prazo-da-f2.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-06 09:48:13 · `tasks/correcoes/2026-11-06-e2e-perto-do-prazo-da-f2.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma. A correção não cria nem altera migration ou schema. O diff toca só `e2e/areas.spec.ts`, `e2e/estrutura.spec.ts`, `e2e/professores.spec.ts` e `e2e/support/casca.ts`.

Queries verificadas: nenhuma de produto. Nenhum repository, service ou endpoint em `apps/*/src` ou `packages/*/src` mudou. O único acesso ao banco que entrou é o seed de teste (`criarAnoLetivoNoBanco` e `convidarProfessorNoBanco`), sempre com o `coordenadora.escolaId` da própria escola criada no caso. Não abre caminho de leitura entre escolas.

Teste de isolamento: presente e efetivo, e a correção não mexeu nele.
- Os casos de outra escola continuam como estavam: `e2e/areas.spec.ts:637`, que usa `criarUsuarioEmOutraEscola`, e `e2e/professores.spec.ts:1152`, em que o id de outra escola não abre nada nem diz que existe.
- Nenhum dos quatro casos alterados prova isolamento entre escolas. A troca de entrada pela tela por entrada pela API não cai no caso que o aviso de `e2e/support/casca.ts` (logo acima de `entrarPelaApiSemMedirAPrimeiraCarga`) protege, a segunda pessoa na mesma aba.
- O `areas:279` prova a guarda de papel com a mesma resposta para endereço inexistente e para endereço de outro papel (regra 10, item 6). Essa asserção ficou igual.
- As quatro asserções que saíram do diff voltaram iguais dentro do `aguardar` de `recarregarSemMedirAPrimeiraCarga`. Nenhuma foi removida.

Bloqueantes: nenhum.

Recomendações:
- `e2e/areas.spec.ts:279`: o caso ainda recebe `hasTouch`, mas não o usa mais para entrar; ele só serve no toque em "página inicial". Os imports `entrarComoCoordenacaoNaMesmaAba` e `abrirEstrutura` também podem ter sobrado em algum dos specs. Vale conferir no lint para não deixar sobra.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-06 09:48:24 · `tasks/correcoes/2026-11-06-e2e-perto-do-prazo-da-f2.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A correção mexe só em `e2e/`. Nenhuma migration, DTO, tela ou caminho de log mudou. Os casos que foram divididos semeiam professores pelo `convidarProfessorNoBanco` que já existia (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/support/seed.ts:657`). Esse seed grava em `usuario` o nome sintético com uma marca UUID e em `conta` um e-mail do domínio reservado `@educa.invalid`, os dois campos de professor que já estavam na tabela. Nenhum aluno é criado nos casos alterados.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. Nenhuma rota, repository ou guarda mudou. O caso `areas:279` continua provando que um endereço que não existe na área do professor responde igual ao endereço de outro papel. Na foto `.processo/vitrine/professora--professor-qualquer--computador.png` aparece só "Página não encontrada", sem confirmar nada sobre outro papel.

Logs: limpos. O diff não acrescenta `console.*` nem logger.

Auditoria: não se aplica. Nenhuma ação que a regra 20 item 10 exige foi criada ou alterada.

Envio externo: nenhum.

Seed/fixture: sintético. Os nomes novos ("Yara do primeiro cadastro", Zuleica, Bia, Caio, Ana, Érica, Davi e "Professor da página N") recebem sufixo UUID ou são montados no `route.fulfill`. Os e-mails usam `@educa.invalid`. As fotos mostram "Colégio sintético da vitrine", "Professor Sintético Davi 72355819" e "Coordenadora sintética d3bd5c15". Nada ali parece pessoa real.

O que verifiquei além disso:
- **Entrada pela API:** `abrirPelaApiSemMedirAPrimeiraCarga` e o ajudante novo `recarregarSemMedirAPrimeiraCarga` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/support/casca.ts:335`) só desligam a rede lenta do perfil na primeira carga. Não passam token por URL nem guardam segredo em `localStorage`. O segundo fator continua configurado pela API.
- **Testes de exposição:** os casos que já provavam exposição seguem com as mesmas asserções:
  - o corpo do erro não mostra `503` nem `INDISPONIVEL` (`estrutura.spec.ts`);
  - a mensagem de erro é curta e tipada (`MENSAGENS_DE_ERRO`);
  - a lista de professores some quando há erro, em vez de mostrar dado velho.
- **Convite:** os estados vencido, revogado e aceito continuam semeados com `expira_em`, `usado_em` e `revogado_em`. O caso "o convite vencido se refaz pelo painel" mantém as mesmas asserções, então a expiração e a revogação continuam cobertas.
- **Pergunta de fechamento:** a correção não muda o que o sistema guarda sobre um aluno nem para onde isso é enviado. A resposta segue a mesma da rodada aprovada da spec.

Bloqueantes: nenhum.

Recomendações:
- O comentário do terceiro caso de `professores.spec.ts` diz "A lista do caso anterior: a Yara do primeiro cadastro". Ali a Yara leva uma marca extra (`crypto.randomUUID().slice(0, 8)`) que o segundo caso não usa. O seed já põe marca única no nome, então não há colisão nem problema de privacidade. Vale só alinhar os dois para não sugerir que existe uma dependência entre eles.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-06 09:48:25 · `tasks/correcoes/2026-11-06-e2e-perto-do-prazo-da-f2.md`

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
- O caso de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/professores.spec.ts:390` sorteia um sufixo para o nome da Yara, e o caso da linha 345 não sorteia. Os dois rodam com uma escola própria, então não há colisão. Ainda assim, vale usar o mesmo formato nos dois, para ninguém achar depois que a diferença tem motivo.

Por que nenhum dos onze itens se aplica: a mudança fica toda em `e2e/`. Nenhum arquivo de `apps/`, `packages/`, `tools/`, `infra/` ou `.github/` foi alterado, e não há migration nem fila ou chamada de modelo no caminho. A entrada pela API (`e2e/support/mfa.ts`) usa o mesmo `/v1/sessao/mfa` do produto e não leva cabeçalho para pular o rate limit. Cada caso cria a própria escola e o próprio usuário, então os limites por usuário e por escola continuam valendo no teste. O ajudante novo, `recarregarSemMedirAPrimeiraCarga` (`e2e/support/casca.ts:427`), só tira a rede lenta do perfil durante a recarga, devolve a rede no `finally` de `loadUnthrottled` e não muda nenhuma asserção. Nenhum caso chama provedor de IA pago.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-06 09:48:42 · `tasks/correcoes/2026-11-06-e2e-perto-do-prazo-da-f2.md`

VEREDITO: APROVADO

Escopo: respeitado. Só `e2e/` mudou, como o documento pede: o ajudante novo em `casca.ts`, a entrada pela API em `areas:279` e `areas:491`, e os dois casos de 90 s divididos em três cada. Nenhum arquivo de `apps/*/src` nem de `packages/*/src` foi tocado. Comparei o diff caso a caso: nenhuma asserção saiu nem mudou de texto. O que agora acontece fora da rede lenta é só a entrada e a espera da primeira tela de cada recarga. Cliques, diálogos, o axe e as novas tentativas continuam sob o perfil.

Aderência à Tech Spec: ok. É correção de teste, sem arquitetura envolvida. O ajudante novo segue a mesma receita de `entrarPelaApiSemMedirAPrimeiraCarga` e `abrirPelaApiSemMedirAPrimeiraCarga`, e o comentário dele diz o que ele não mede.

Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)").

Bloqueantes: nenhum.

Recomendações:
- **Preparação repetida em `estrutura.spec.ts`.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/estrutura.spec.ts:369-373` e `:417-421`, a preparação dos três anos (2025 encerrado, 2026 planejado, 2027 em curso) é a mesma, junto com a entrada e a espera de "Turmas de 2027". Um ajudante local, por exemplo `escolaDepoisDaVirada(page, request)`, deixaria explícito que os dois casos partem do mesmo ponto.
- **Preparação repetida em `professores.spec.ts`.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/professores.spec.ts:334-339` e `:403-406`, o mapa `nomes` e o laço que semeia os sete professores aparecem duas vezes. Vale tirar para um ajudante.
- **Sufixo duplicado no nome da Yara.** Em `professores.spec.ts:403`, o caso acrescenta `crypto.randomUUID().slice(0, 8)` ao nome, mas `convidarProfessorNoBanco` (`e2e/support/seed.ts:659`) já acrescenta o estado e uma marca própria. Na linha `:334` o mesmo nome entra sem o sufixo. Melhor usar a mesma forma nos dois lugares, sem o sufixo.
- **`cadastrar` declarado longe do uso.** Em `professores.spec.ts:341`, a variável é declarada antes da recarga com erro e só é usada perto do fim do caso. Ficaria mais legível declarada junto do uso.
- **Fotos da tela.** Olhei duas: a lista de professores no computador, com a escola cheia, e a Estrutura no celular, com a escola vazia. A tela não mudou e não há achado na minha área.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/correcoes/2026-11-06-e2e-perto-do-prazo-da-f2.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/support/casca.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/areas.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/estrutura.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/professores.spec.ts`

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-06 09:48:49 · `tasks/correcoes/2026-11-06-e2e-perto-do-prazo-da-f2.md`

VEREDITO: APROVADO

Tela vista: sim (16 fotos lidas, cheia e vazia, computador e celular, nas três telas da coordenação e na do professor). O produto não mudou nesta correção. Só `e2e/` mudou, e as fotos são as telas que os casos exercitam.

Estados: ok. Nenhuma asserção de carregando, vazio, erro ou com dado saiu nem mudou de texto. Os três casos novos de `estrutura` e os três de `professores` mantêm cada estado que o caso antigo afirmava. Carregando e erro não aparecem na vitrine, então conferi pelo diff.

Acessibilidade: sem mudança. As asserções de axe (`seriousViolations`), foco (`toBeFocused`), alvo de toque (`alvoDeToque`) e rolagem horizontal (`horizontalOverflow`, `paginaNaoRola`) seguem no código, sob o perfil de CPU e rede.

Chromebook fraco: a mudança é de teste. O perfil de CPU ×4 e a rede lenta continuam em tudo o que o caso faz com a página aberta (cliques, diálogos, axe, nova tentativa). Só a entrada e a primeira carga depois do `reload` saem da rede lenta. O comentário de `recarregarSemMedirAPrimeiraCarga` (`e2e/support/casca.ts:246-260`) diz o que isso deixa de medir, e o orçamento do build e os specs de carga continuam com esse assunto. O `test.slow()` saiu dos casos que ele escondia, e os medidos ficam entre 5 e 11 s, contra os 60 a 71 s de 90 de antes.

Celular: as fotos a 360 px não têm rolagem horizontal. Os alvos principais ("Nova turma", "Cadastrar professor") passam de 44 px. Os casos continuam rodando nos dois projetos, e a tabela do relatório traz chromebook e celular.

Ação oficial protegida: sim. Não há ação oficial nova nem alterada. Aprovar, publicar e excluir não aparecem nas telas tocadas.

Conferi no código:
- `tsc -p e2e/tsconfig.json` e `eslint` nos quatro arquivos saem limpos, com `--max-warnings=0`.
- Nenhum import ficou sem uso. Os ajudantes novos existem: `esperarEstrutura`, `recarregarSemMedirAPrimeiraCarga`, `convidarProfessorNoBanco` e `abrirPelaApiSemMedirAPrimeiraCarga`, que é o de `mfa.ts`.
- Ao dividir o caso de `professores` em três, a ordem esperada ficou certa. A Yara, semeada com o nome "Yara do primeiro cadastro", cai entre a Érica e a Zuleica, como a asserção da lista de sete nomes espera.
- O terceiro caso de `professores` usa um sufixo aleatório no nome da Yara, e o resto da lista não depende da ordem dela.
- Os casos novos de `estrutura` partem de 2025 encerrado, 2026 planejado e 2027 em curso, semeado no banco, que é o estado que o caso anterior deixava.
- As três mutações do relatório mexem na espera que passou para dentro do `aguardar`, e cada uma deixa o caso vermelho. Isso prova que o ajudante não engole a espera.

Bloqueantes: nenhum.

Recomendações:
1. Foto `.processo/vitrine/professora--professor-qualquer--celular.png` (e a vazia equivalente): na barra de baixo do professor a 360 px, o rótulo "Ferramentas" aparece como "FERRAME…". A causa é o `truncate` em `apps/web/src/components/BarraDeBaixo.tsx:83`, e `BarraDeBaixo.test.tsx:142` exige a classe. Já era assim antes desta correção, que não altera a tela, e o nome de uma das quatro abas principais fica cortado para a professora no celular. Vale tratar em tarefa própria de produto, por exemplo com `text-[0.6875rem]` ou `tracking` menor para caber, ou revendo a regra do `truncate`. Não bloqueia esta correção.
2. Nas fotos de página inteira a barra de baixo aparece sobre o conteúdo (o card "Rejeitado" do Painel e as linhas de turma). É efeito da captura de página inteira com barra fixa, não defeito de tela, e o código da árvore prevalece. Só registro.
3. Os casos novos de `estrutura` e `professores` repetem a semeadura de ano e de professores. Se aparecer um quarto caso com o mesmo ponto de partida, extrair um ajudante de semeadura em `e2e/support/seed.ts` evitaria a cópia. Não mexa nisso agora.

## test-engineer · 1ª rodada · APROVADO · 2026-11-06 09:49:26 · `tasks/correcoes/2026-11-06-e2e-perto-do-prazo-da-f2.md`

VEREDITO: APROVADO

Cenários exigidos: esta correção mexe só no `e2e/` e não muda regra de produto. Por isso o que ela precisava provar era outra coisa:
(a) nenhuma asserção dos quatro casos se perdeu ao dividir os casos e trocar a entrada pela tela pela entrada pela API;
(b) cada linha da tabela "Teste que reproduz" tem o seu caso;
(c) as esperas que agora rodam dentro do `aguardar`, fora da rede lenta, continuam sendo esperadas, e não engolidas;
(d) cada caso tocado cabe na metade do prazo no portão, sem `test.slow()`;
(e) os casos que nasceram da divisão partem, semeados no banco, do mesmo estado que o caso anterior deixava;
(f) nenhum `.skip`, nenhum teste comentado e nenhum mock que esconda a regra.
Isolamento, permissão e concorrência não se aplicam: nenhum repository, rota ou operação dupla muda.

Cobertos:
- **(a)** Conferi no `git diff HEAD` todas as linhas `expect` removidas. São quatro, e cada uma reaparece sem mudar de texto dentro do `aguardar` de `recarregarSemMedirAPrimeiraCarga` (`estrutura.spec.ts:351`, `:448`; `professores.spec.ts:343`, `:446`). As asserções de `areas:279` e `areas:491` ficaram como estavam; em `areas:491`, a espera do Painel saiu do ajudante de entrada e passou ao `aguardar` (`areas.spec.ts:499-501`).
- **(b)** Cada linha da tabela tem o seu caso:
  - `areas:279` e `:492`
  - `estrutura:319`, `:363` e `:414`
  - `professores:255`, `:320` e `:381`
- **(c)** Os três blocos de mutação batem com as linhas da árvore: `areas.spec.ts:499-500`, `estrutura.spec.ts:349-351` e `professores.spec.ts:446-447`. Cada um fica vermelho na própria espera de dentro do `aguardar`, que é o motivo certo. O `.processo/portao.json` registra 3 mutações para este documento, com a impressão `b6486b619a571d63`. O RF17 não exige mutação aqui, porque nenhum arquivo de `apps/*/src` nem de `packages/*/src` mudou.
- **(d)** O `.processo/e2e-duracao.json` do portão mostra os 16 resultados verdes (8 casos nos 2 projetos), sem nenhum flaky. O mais lento é `areas:492` no celular, com 11,4 s; os demais ficam entre 5,7 e 11,1 s. O limite é 15 s. O `test.slow()` saiu dos dois casos de 90 s.
- **(e)** O estado de partida de cada caso novo é o que o anterior deixava:
  - `estrutura:363` e `:414` semeiam 2025 encerrado, 2026 planejado e 2027 em curso. O `:414` chega ao erro das seções com uma recarga que falha e confirma o alerta de cada seção antes do "Tentar de novo", então o ponto de partida é afirmado, não suposto.
  - `professores:320` e `:381` semeiam a Yara e os seis estados, e esperam as sete linhas antes da primeira ação.
  - A ordem por nome (`professores.spec.ts:358`) continua valendo com a Yara semeada: "Yara do primeiro cadastro Convite em aberto …" fica entre Érica e Zuleica.
  - O carregando segue com o gate determinístico (`estrutura.spec.ts:378-401`, `professores.spec.ts:262-280`), não depende da rede lenta.
- **(f)** Não há `.skip`, `.only` nem teste comentado. Os mocks são de rota (`page.route`) e simulam a falha da rede ou da API, que é exatamente o que os casos afirmam.

Bloqueantes: nenhum.

Recomendações (não bloqueiam):
1. `e2e/professores.spec.ts:403`: a Yara recebe um sufixo aleatório no nome passado ao `convidarProfessorNoBanco`, e o seed já acrescenta outro (`seed.ts:659`). Em `:334` ela vai sem esse sufixo extra. Não quebra nada, mas é bom deixar os dois casos iguais.
2. `e2e/areas.spec.ts:276-278`: o comentário diz que "cada teste começa da entrada da professora". O `:279` agora entra pela API, e vale ajustar o texto.
3. `e2e/areas.spec.ts:492`: o caso deixou de exercitar a falha do chunk da coordenação logo depois da entrada pela tela com o segundo fator, na mesma aba. A entrada tem os casos dela em `mfa.spec.ts` e a fronteira do `import()` continua provada, então não é lacuna de regra. Fica registrado para a validação.
4. `areas:279` e `:492` são agora os casos mais perto do limite do portão, com 10,8 a 11,4 s de 15. Vale observá-los no próximo censo da esteira.

Não rodei o e2e: os números acima vêm do registro do portão.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/correcoes/2026-11-06-e2e-perto-do-prazo-da-f2.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/areas.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/estrutura.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/professores.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/support/casca.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/.processo/portao.json
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/.processo/e2e-duracao.json

## revisor-geral · 2ª rodada · APROVADO · 2026-11-06 10:03:47 · `tasks/correcoes/2026-11-06-e2e-perto-do-prazo-da-f2.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. A correção mexe só em `e2e/`, no `TODO.md` e no documento. Não toca produto.

Portão local: carimbo válido. O `conferir` respondeu "portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)".

Bloqueantes: nenhum.

Conferi cada item da ordem `.processo/ordens/2026-11-06-e2e-perto-do-prazo-da-f2-r1.md`:
1. **A Yara do terceiro caso:** `e2e/professores.spec.ts:403` agora usa `'Yara do primeiro cadastro'` sem o sufixo, igual à linha `:334`. O sufixo sobrava porque `convidarProfessorNoBanco` (`e2e/support/seed.ts`) já põe uma marca única no nome. A ordem pedia que a asserção da ordem dos sete nomes continuasse valendo: ela está só no segundo caso (`:357`), usa o `nome` que a semeadura devolve e não mudou. O terceiro caso não afirma nada sobre a ordem, então a troca não altera o que ele prova.
2. **O comentário do `areas:279`:** `e2e/areas.spec.ts:277` agora diz que a entrada é pela API.
3. **`cadastrar` junto do uso:** a declaração foi para `e2e/professores.spec.ts:367`, logo antes do primeiro uso. Nada a usa antes da recarga com erro.
4. **A tabela "Recomendações sem aplicar":** está no documento nas linhas 85 a 94, com as seis linhas da tabela "Sem aplicar" da ordem e o mesmo destino ou motivo em cada uma. A redação foi encurtada (a citação do frontend-reviewer e o "o revisor só registra" saíram), mas o sentido não mudou.
5. **A linha do TODO.md:** é a última da lista, "Da correção 2026-11-06-e2e-perto-do-prazo-da-f2 (frontend-reviewer, 1ª)". Ela traz o `BarraDeBaixo.tsx:83`, o `BarraDeBaixo.test.tsx:142`, diz que já era assim antes da correção e que é tarefa de produto, como a ordem mandou. Também amarra a linha ao item (a) da X3, que trata do mesmo corte, para não virar duas tarefas.

Recomendações:
- Os comentários de `e2e/areas.spec.ts:277` e `:280` dizem a mesma coisa: a entrada é pela API e tem os casos dela em `entrar.spec.ts`. Basta um dos dois. Além disso, a linha `:277` ficou bem mais comprida que as do bloco à volta e pode ser quebrada como as outras.

## test-engineer · 2ª rodada · APROVADO · 2026-11-06 10:03:50 · `tasks/correcoes/2026-11-06-e2e-perto-do-prazo-da-f2.md`

VEREDITO: APROVADO

Cenários exigidos: só os desta rodada nova. São as três recomendações que a ordem `.processo/ordens/2026-11-06-e2e-perto-do-prazo-da-f2-r1.md` mandou aplicar, mais a tabela "Recomendações sem aplicar" e a linha no `TODO.md`. Os cenários da 1ª rodada, aprovada, não mudaram e não reauditei.

Cobertos:
- **A Yara do terceiro caso sem o sufixo** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/professores.spec.ts:403`). Está feito, e nenhuma asserção muda.
  - Quem gera o sufixo único é o `convidarProfessorNoBanco` (`e2e/support/seed.ts:658-659`): o nome gravado é `primeiroNome + estado + 8 caracteres de UUID`. O nome segue único, e cada teste cria a própria escola.
  - O terceiro caso não confere a ordem da lista. Só exige 7 linhas (`:407`) e acha a Bia e a Zuleica pelo nome que o banco devolveu (`:410`, `:424`). A Yara só entra nessa contagem.
  - A ordem dos sete nomes é conferida no segundo caso (`:353-357`), onde a Yara já estava sem o sufixo (`:334`) desde a 1ª rodada. A ordem continua Ana, Bia, Caio, Davi, Érica, Yara e Zuleica: a Yara fica entre a Érica e a Zuleica, como diz o comentário de `:355`. Esta rodada não mexeu nesse caso.
- **`cadastrar` declarado junto do uso no segundo caso** (`professores.spec.ts:369`). Está feito. No segundo caso ele só é usado em `:370-371`, depois da declaração. O `cadastrar` de `:284`, usado em `:298`, pertence ao primeiro caso e fica no escopo dele. As duas declarações estão em funções `test` diferentes, então não há sombra entre elas nem uso antes da declaração.
- **O comentário que antecede `areas:279`** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/e2e/areas.spec.ts:278`). Está feito: agora diz que a entrada é pela API e que a entrada pela tela tem os casos dela em `entrar.spec.ts`. Isso bate com `entrarComoProfessoraPelaApi` em `:282`.
- **A tabela "Recomendações sem aplicar"** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l1/tasks/correcoes/2026-11-06-e2e-perto-do-prazo-da-f2.md:85-94`). Cada recomendação da 1ª rodada que não foi aplicada tem destino ou motivo escrito.
- **A linha no `TODO.md`.** Ela aponta para o arquivo e a linha do "FERRAME…" cortado a 360 px e diz que o defeito já existia antes desta correção.
- A correção não toca código de produto, então não há cláusula nova que precise de bloco de mutação. Não há `.skip`, teste comentado nem mock novo.

Bloqueantes: nenhum.

Recomendações:
- `areas.spec.ts:278` e `:281` dizem a mesma coisa duas vezes: que a entrada é pela API e que a entrada pela tela tem os casos dela em `entrar.spec.ts`. Basta manter uma das duas. A linha 278 também ficou mais longa que as do bloco de comentário acima dela. Isso é só texto e não muda o veredito.
