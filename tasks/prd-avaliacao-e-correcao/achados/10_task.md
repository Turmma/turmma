# Achados das revisões — `tasks/prd-avaliacao-e-correcao/10_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-23 21:54:23 · `tasks/prd-avaliacao-e-correcao/10_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela ou migration nova nesta tarefa. `atividade_aplicada` e `tentativa_atividade` não mudaram: continuam como a 1.0 deixou, com `escola_id` e `ano_letivo_id`. Os dois `insert` por SQL em `apps/api/src/atividade/prova-online.int.test.ts` (linhas 130-133 e 241-244) gravam a avaliativa de antes da F6 só no teste, na própria escola e no próprio ano.

Queries verificadas:
- Nenhum repository ou service mudou. A recusa da avaliativa sem janela é uma regra de validação nova em `camposInvalidosDaProva`, na linha 98 de `packages/shared/src/atividade/atividade-aplicada.ts`.
- `aplicarAtividadeRequestSchema` continua estrito e recusa `escolaId`, `aplicadaPor` e `alunos` vindos do corpo (`atividade.test.ts`, linha 139).
- A tela manda só `artefatoId`, `turmaId` e os campos da prova. `PATCH /v1/atividades-aplicadas/:id/janela` leva só a janela e a duração (`api/atividades.ts`).
- A lista do tempo adicional usa `GET /v1/turmas/:id/alunos` (`alunosDaTurmaQueryOptions`), que já tem escopo e autorização por turma.
- O painel e o resumo mostram só a contagem `comTempoAdicional`, nunca quais alunos têm o tempo.
- Ids continuam UUID. Não há consulta agregada da camada de rede nem `@Unscoped()`.

Teste de isolamento: presente e efetivo. A tarefa não cria endpoint nem consulta. Os casos da 1.0 continuam no arquivo sem alteração:
- outra escola, outra turma, id inexistente e vínculo pendente ou desativado respondem igual, com 404 e nada gravado (linha 155);
- o repository com a escola ou o ano trocado não acha nada (linhas 422-434);
- o id que não é UUID responde como o inexistente (linha 266).

Bloqueantes: nenhum.

Recomendações:
- O mock de `mudarJanela` em `e2e/support/assistente.ts` só confere se o id existe e se alguém começou. Não confere se a atividade é avaliativa, se está aberta nem se tem janela. Vale deixá-lo próximo da API de verdade, para o e2e com mock não aceitar o que a API recusa.
- O caso "a avaliativa de antes da F6, aberta e sem janela, ganha a janela pelo PATCH" grava a linha por SQL. Um comentário dizendo que a escola e o ano vêm da bancada `a`, a mesma da sessão, deixaria claro que o caso não testa travessia entre escolas.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-23 21:54:47 · `tasks/prd-avaliacao-e-correcao/10_task.md`

VEREDITO: APROVADO

**Campos pessoais tocados:** nenhum campo novo. A tela passa a escrever o `tempo_adicional`, que já existia desde a 1.0: aluno, percentual, quem concedeu e quando, sem motivo. Para montar a lista do tempo adicional, o diálogo de aplicar lê os nomes da turma pela rota `GET /v1/turmas/:id/alunos`, que já existia e é a mesma da aba Alunos.

**Fora da tabela de dados do docs/lgpd.md:** nenhum. O tempo adicional está em `docs/lgpd.md:60`, com finalidade, base legal e retenção. A tela cumpre o que a linha pede:
- Só o percentual, sem campo de motivo (`AplicacaoDoArtefato.tsx:784-806`). O e2e prova a falta de campo de texto livre com `textarea, input[type="text"]` contando zero.
- O resumo e o painel dizem quantos alunos têm tempo adicional, nunca quais (`prova-online.ts`, `DadosDoResumo.comTempoAdicional`, e `AtividadesDaTurma.tsx:983-990`).
- Mudar a janela não lê nem reescreve o tempo adicional: o PATCH manda só a janela e a duração (`MudarJanela.tsx:61-75`).

**Autorização por objeto:** ok.
- O tempo adicional mandado pela tela passa por `#conferirAlunosDaTurma` no aplicar e no PATCH (`atividade-aplicada.service.ts:84,112`). Aluno de outra turma é recusado.
- A lista de nomes usa a rota da aba Alunos, que já confere escola, ano e vínculo pelo token e não guarda os nomes depois da tela (`gcTime: 0`, `apps/web/src/api/alunos-da-turma.ts`).
- O PATCH da janela segue com `requireEscolaId`/`requireAnoEmCurso` no repository. O id que não é uuid responde como o inexistente (caso já existente em `prova-online.int.test.ts`).

**Logs:** limpos. Nenhum `console` ou `logger` em `AplicacaoDoArtefato.tsx`, `MudarJanela.tsx` ou `prova-online.ts`.

**Auditoria:** presente.
- `atividade.aplicada` e `atividade.janela_alterada` guardam só `comTempoAdicional` como contagem, sem `alunoId` nem percentual (`atividade-aplicada.service.ts:90,118-119`).
- O caso novo da avaliativa sem janela prova que nada se grava nem se audita.
- O PATCH sem janela numa avaliativa antiga deixou de gerar uma auditoria vazia (`prova-online.int.test.ts`, a lista esperada agora tem uma linha só).

**Envio externo:** nenhum. A tarefa não toca IA nem provedor.

**Seed/fixture:** sintético. As fotos mostram "Colégio sintético da vitrine cheia", "Professora Sintética Helena" e "Estequiometria: lista sintética". Os testes usam nomes inventados ("Ana Souza", "Bia Lima", "Zeca Dias"). As janelas das fixtures são relativas a `Date.now()`.

**Fotos:** nada da regra 20 aparece fora do lugar.
- O diálogo de aplicar, com e sem "É avaliativa", no computador e no celular, mostra só atividade, turma, quantidade de questões e os campos da janela.
- A lista do tempo adicional fica abaixo da dobra e não foi fotografada. Conferi pelo código: o rótulo de cada seletor é o nome do aluno, visto só pelo professor da turma, e é o mesmo nome da aba Alunos.
- Criados (cheia e vazia) e Turmas → 2ºB não mostram nome, matrícula nem conteúdo de aluno.

**Pergunta de fechamento:** o código responde. O `tempo_adicional` entra no arquivo do titular (`packages/core/src/titular/leitura-do-titular.ts`, coberto em `apps/api/test/arquivo-do-titular.int.test.ts`), e esta tarefa não cria destino externo.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Minimização: hoje, marcar "É avaliativa" já busca todos os nomes da turma, mesmo quando ninguém terá tempo adicional (`AplicacaoDoArtefato.tsx:810`, chamado por `CamposDaProva` na linha 885). Vale carregar a lista só quando o professor abrir algo como "Marcar tempo adicional". Não bloqueia, porque é o professor da turma lendo a própria turma, sem auditoria exigida.
2. `docs/lgpd.md:60` diz "nunca em auditoria" para o tempo adicional, mas a auditoria guarda `comTempoAdicional` por aplicação. É contagem, sem aluno, então não viola nada. Uma frase no documento dizendo que a contagem é permitida evita a dúvida numa leitura de jurídico.
3. O mock do e2e para `mudarJanela` (`e2e/support/assistente.ts:384-392`) não confere a janela como a API real faz. Não afeta a privacidade; fica para o `test-engineer`.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-23 21:54:48 · `tasks/prd-avaliacao-e-correcao/10_task.md`

VEREDITO: APROVADO

Tela vista: sim (12 fotos lidas, cheia e vazia). Li as 4 do diálogo "Aplicar à turma" (prática e avaliativa, 1366 e 360 px), "Criados" cheia e vazia nos dois tamanhos, e a turma 2ºB nos dois tamanhos. O diálogo "Mudar a janela da prova", a lista do tempo adicional com alunos carregados e o painel da prova na aba Atividades não foram fotografados. Cobri os três pelo código, por `AplicacaoDoArtefato.test.tsx` e pelo e2e.

Estados: ok.
- **Lista do tempo adicional:** carregando ("Carregando os alunos da turma…"), erro (mensagem em português com "Tentar de novo"), vazio ("Esta turma ainda não tem alunos.") e com dado, com "Ver mais alunos" a cada 100. Em `AplicacaoDoArtefato.tsx:105-134`.
- **Cada um tem teste unitário e e2e.** Os testes em `AplicacaoDoArtefato.test.tsx:178-290` e o e2e em `e2e/professor-aplicacao.spec.ts`.
- **Estado vazio de "Criados":** convida, com "Nada gerado ainda" e o botão "Ir para ferramentas".
- **Erro de cada campo:** só aparece depois da primeira tentativa de confirmar e some quando o diálogo reabre.

Acessibilidade: ok.
- **Rótulo e erro:** cada campo usa `FormField`, com rótulo e `aria-describedby` para o erro. O erro do tempo adicional está no `role="group"` "Tempo adicional" e o do tempo que não cabe está em "Fecha em".
- **Foco:** o foco do diálogo começa no resumo, não no botão que confirma. O diálogo é um `alertdialog` nativo com foco de reserva.
- **Sem hover nem atalho:** as escolhas são `radio`, caixas e selects nativos.

Chromebook fraco:
- **Lista de alunos:** não é virtualizada. Vem de 100 em 100 com "Ver mais alunos", e uma turma tem poucas dezenas de alunos. Vejo isso só como recomendação.
- **Peso da tela:** os selects são nativos, sem biblioteca nova.
- **Imagem:** não há upload de imagem nesta tarefa.

Celular:
- **360 px sem rolagem horizontal:** as fotos do diálogo, da lista "Criados" e da turma 2ºB confirmam, e o e2e confere (`paginaNaoRola`, `larguraExcedenteDoDialogo`, axe).
- **Alvos de toque:** as opções de tipo têm `min-h-11`, as caixas de embaralhar têm `min-h-16` e os botões do diálogo passam de 44 px (46 px na foto). O e2e afirma ≥44 px em "Aplicar à turma" e em "Mudar a janela", e ≥24 px nos selects de aluno.
- **Lista do tempo adicional:** uma coluna em qualquer largura. O e2e compara o `x` dos dois selects.
- **Diálogo alto:** a caixa tem `max-h-[calc(100svh-2rem)]` com `overflow-y-auto`, então a página não rola atrás e o botão fica alcançável.
- **Nada exige o celular.**

Ação oficial protegida: sim.
- **Aplicar:** o resumo mostra atividade, turma, questões e, na avaliativa com a prova conferida, a frase "turma · abre dd/mm às hh:mm · fecha … · N min · N alunos com tempo adicional". A frase não diz quais alunos nem quanto, por ser adaptação (D35). O efeito vem antes do botão.
- **Mudar janela:** o diálogo mostra "Ninguém começou ainda" e a "Janela nova" no horário da escola. O botão só existe na prova avaliativa aberta e sem ninguém iniciado. Se alguém começar no meio do caminho, a API responde `PROVA_JA_COMECOU`, com texto em português dizendo o que fazer, e a lista é relida.
- **Envio único:** a trava `decidindo` cobre os dois diálogos, e o e2e testa o duplo clique.
- **Campo de motivo:** não existe.
- **API:** `atividade-aplicada.ts:97-98` agora recusa avaliativa nova sem janela (`ENTRADA_INVALIDA`).
- **Horário:** o horário vira instante pelo fuso da escola (`America/Sao_Paulo`), não pelo do navegador. Os testes unitários de `prova-online.test.ts` e o e2e conferem o UTC enviado.

Verificação: `vitest` em `apps/web/src/areas/professor/atividades` passou, 6 arquivos e 134 testes.

Bloqueantes: nenhum.

Recomendações:
1. `AplicacaoDoArtefato.tsx:135-139`: o rótulo de cada select é só o nome do aluno ("Ana Souza"). Dois alunos com o mesmo nome só se distinguem pela ordem de id, que o professor não vê. A leitura de tela diria só "Ana Souza, Sem tempo adicional". Vale rotular "Tempo adicional de Ana Souza" e distinguir homônimos pelo segundo nome ou pela matrícula, como `cenarios.md` §4 pede para o Acompanhar.
2. Turma de mais de 100 alunos (ensino médio em escola grande) gera um diálogo longo com um select por aluno. Considere virtualizar ou filtrar por nome se a medição no Chromebook sob throttling mostrar lentidão.
3. A mensagem de `PROVA_JA_COMECOU` (`packages/shared/src/errors/messages.ts:35`) manda usar "Estender". Garanta que esse botão exista no painel quando a tarefa de estender pousar, para não apontar para uma ação ausente.
4. O vazio da escola nova e a prova avaliativa sem ninguém iniciado não aparecem na vitrine. Fotografe o diálogo "Mudar a janela da prova" na validação.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-23 21:54:55 · `tasks/prd-avaliacao-e-correcao/10_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum novo. Esta tarefa não escreve em `Nota` nem em correção. Ela muda a conferência da prova (`packages/shared/src/atividade/atividade-aplicada.ts`, a janela passa a ser obrigatória), a tela de aplicar, o PATCH da janela e os fixtures. Conferi os fixtures (`apps/api/test/atividade.fixture.ts`, `e2e/support/atividade-db.ts`, `e2e/support/assistente.ts`) e o SQL direto dos testes em `apps/api/src/atividade/prova-online.int.test.ts`: só gravam `atividade_aplicada`, sempre com `aplicada_por` de professora. Todos com autor humano? sim, e nenhum toca em Nota.

Decisão autônoma sobre aluno: ausente. O tempo adicional é escolhido pela professora, aluno por aluno, só com o percentual e sem motivo. Nada é sugerido nem aplicado sozinho. A janela e a duração não geram consequência automática sobre o aluno.

Aprovação registrada: ok. A tarefa não cria saída de IA nova. Aplicar continua sendo ato humano registrado: o efeito "Fica registrado que você aplicou, com a data e a hora" aparece na foto `professora--professor-criados--…-Aplicar-à-turma--computador.png`, vindo de `apps/web/src/areas/professor/atividades/aprovar.ts:165`. A versão adaptada segue barrada até ser aprovada (`apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts:82`, sem mudança). Mudar a janela é ato da professora, com confirmação e resumo antes, e a auditoria `atividade.janela_alterada` guarda o antes e o depois, provada no caso da avaliativa de antes da F6.

Supervisão do tutor: ok. O tutor não muda nesta tarefa. A avaliativa continua pausando o Tutor, com o aviso visível no diálogo nas duas fotos `…radio-name-avaliativa-i--computador.png` e `…--celular.png`.

Autonomia declarada e visível: sim, sem mudança nesta tarefa.

Os outros pontos da lista também passam:
- **Supervisão não é vigilância (7):** a tela não mede tempo ocioso nem navegação e não infere estado do aluno. O resumo e o painel dizem quantos alunos têm tempo adicional, nunca quais (`apps/web/src/areas/professor/atividades/prova-online.ts:76`).
- **Nota em discursiva e redação (8):** nas fotos e no código não há nota, conceito, pontuação nem sugestão de nota. O diálogo mostra atividade, turma, quantidade de questões e a frase da janela. `docs/interface.md` continua dizendo que a aba não mostra nota, média nem conceito.
- **Medir o professor (9):** a tarefa não toca indicador de professor nem a conversa dele com o chat.
- **Fotos:** a escola cheia e a vazia, no computador e no celular, não trazem saída de IA sem marca, nota, nem nada que induza uso. As telas sem foto (o diálogo de mudar a janela e o painel da prova) foram conferidas pelo código: `apps/web/src/areas/professor/atividades/MudarJanela.tsx` e `apps/web/src/areas/professor/atividades/AtividadesDaTurma.tsx:231-239`. Também não têm nada disso.

Bloqueantes: nenhum.

Recomendações:
1. `apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx:104` diz ao professor que o tempo adicional "fica registrado com o seu nome". O service grava a aplicação, o tempo adicional e a auditoria na mesma transação (`atividade-aplicada.service.ts:63`), então a frase parece verdadeira. Mesmo assim, um caso que leia o autor na auditoria do aplicar com tempo adicional prenderia essa frase a um teste.
2. A atividade original gerada pelo Assistente chega ao aluno pelo ato de aplicar, sem uma entrega aprovada antes; só a versão adaptada passa por aprovação. Isso já era assim antes desta tarefa e a professora aplicar é o ato humano registrado. Vale deixar escrito em `docs/regulacao.md` ou na AIA da correção de objetiva que aplicar conta como a aprovação da regra 70, item 3, para a atividade original.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-23 21:55:18 · `tasks/prd-avaliacao-e-correcao/10_task.md`

VEREDITO: APROVADO
Caminho quente tocado: prova (o aplicar e o PATCH da janela, do lado do professor; o lado do aluno não mudou)
Rate limit: ok (a tarefa não cria endpoint. O `PATCH …/janela` veio da 1.0, e a lista do tempo adicional usa a `GET /v1/turmas/:id/alunos`, que já existia)
Fila e prioridade: ok (nada demorado entra no request; a mudança na API é só a validação da janela)
Concorrência: protegida. O clique duplo é barrado pela trava `decidindo` e provado pelo `dblclick` em `e2e/professor-aplicacao.spec.ts:150` e `e2e/professor-turma-atividades.spec.ts:183`. Mudar a janela enquanto alguém começa, ou duas mudanças ao mesmo tempo, fica com o `for update` da 1.0, relido depois da trava e provado em `apps/api/src/atividade/prova-online.int.test.ts:336`
Índice e paginação: ok. A tarefa não cria query. A lista de alunos vem de cem em cem com "Ver mais alunos" (`useInfiniteQuery`) e só é lida quando o professor marca "É avaliativa"
Degradação de IA: não se aplica
Migration: não se aplica. A exigência da janela fica só na validação (`packages/shared/src/atividade/atividade-aplicada.ts:98`). A avaliativa antiga sem janela continua sendo lida, e o teste da integração prova isso. Conferi os caminhos que gravam sem passar pela rota (`infra/scripts/carga-login.ts:443`, `apps/api/test/escola-tutor.fixture.ts:61`): eles inserem direto no banco e não quebram
Métrica e alerta: ok (não há endpoint nem alerta novo; as rotas usadas já tinham métrica)
Bloqueantes: nenhum
Recomendações:
- Durante o deploy, uma aba do professor aberta com o pacote antigo do web manda avaliativa sem janela e recebe `ENTRADA_INVALIDA` com o texto genérico. Como o deploy é fora do horário letivo, isso não bloqueia. Vale um texto em `apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx` (em `TEXTOS_DA_APLICACAO`) que peça para recarregar a página, ou uma linha sobre isso em `docs/runbook.md`.
- O fuso da prova está fixo em `apps/web/src/areas/professor/atividades/prova-online.ts:21` (`America/Sao_Paulo`), igual ao `FUSO_DO_USO` da API. Escola em outro fuso, como uma rede fora do Sul e do Sudeste, veria a janela deslocada. Registre no `TODO.md` antes de vender fora do recorte de Joinville.
- O cenário de carga não mudou, e isso está certo: o aplicar é ação do professor, com pouco volume. O cenário da manhã com prova aberta (vários alunos começando e salvando ao mesmo tempo) precisa entrar na tarefa que mexer no lado do aluno.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-23 21:56:06 · `tasks/prd-avaliacao-e-correcao/10_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

**O que conferi**

- **Escopo.** As subtarefas 10.1 a 10.5 estão feitas, e nada entra no painel "Acompanhar" da 11.0.
  - A frase da prova no painel (`ProvaDaAtividade`) não estava nas subtarefas, mas está na tabela de testes e no `docs/interface.md` §1.7, e é pequena. Não invade tarefa futura.
- **As duas divergências estão na `techspec.md` §3 e no `cenarios.md` §1 (linha RF1):**
  - a exigência da janela fica na conferência compartilhada, e não no service;
  - o PATCH de uma avaliativa de antes da F6 só passa se trouxer a janela.
- **Quem ainda manda avaliativa sem janela.**
  - Os outros testes de integração que chamam o aplicar usam `avaliativa: false`: `atividade.int.test.ts`, `atividade-isolamento.int.test.ts` e `input-boundary-late-modules.int.test.ts`.
  - Os testes do Tutor gravam por SQL (`escola-tutor.fixture.ts`), e o `infra/scripts/carga-login.ts` também. A nova exigência não quebra nenhum deles.
- **O que vi nas fotos.** Os campos da avaliativa aparecem com os nomes do glossário e do `cenarios.md` §4: "Abre em", "Fecha em" com a dica "No horário da escola." e "Duração (minutos)". Não há campo de motivo. Não vi nada fora do que a tarefa pede.

**Recomendações**

1. **`tasks/prd-avaliacao-e-correcao/10_task.md:56`**: a linha "Estados" cita o caso `e2e/professor-aplicacao.spec.ts › a lista do tempo adicional diz que carrega…`, que não existe. A cobertura está dentro do primeiro caso do arquivo (`aplicar pede a escolha "é avaliativa?"…`, linha 16). Corrigir o nome citado.
2. **`packages/shared/src/atividade/atividade-aplicada.ts:97`**: o comentário diz que a avaliativa de antes da F6 "só não passa por aqui". Ela passa, sim, quando recebe o PATCH, e é a própria divergência 2. Além disso, o docblock de `camposInvalidosDaProva` (linhas 76 a 80) não cita a regra nova de que a avaliativa exige janela.
3. **`AplicacaoDoArtefato.tsx:118`**: a ordenação por nome e depois por id refaz o que `ordemDeNome` já faz, em `apps/web/src/areas/professor/turmas/alunos-da-turma.ts:37`. Usar a função que já existe.
4. **`prova-online.ts:21`**: é a terceira constante `'America/Sao_Paulo'` na web; `FUSO_DA_ESCOLA` já existe em `semana/semana.ts` e em `envio-do-convite.ts`. E as funções `partesNaParede` e `diaEHora` repetem o que `partesDoInstante` faz em `apps/web/src/format.ts`. Juntar num lugar só.
5. **`AplicacaoDoArtefato.tsx:145`**: dois alunos com o mesmo nome ficam com dois seletores de rótulo idêntico. O professor não tem como saber em qual dos dois está marcando o tempo adicional, que é uma adaptação. Hoje a aba Alunos também não distingue homônimos, mas o `cenarios.md` §4 já pede essa distinção no Acompanhar. Vale levar o mesmo critério para esta lista, na 11.0 ou numa tarefa à parte.
6. **`MudarJanela.tsx:46`**: o estado inicial, montado a partir da janela gravada, é desnecessário, porque `open()` já refaz os campos a cada abertura.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-23 21:56:30 · `tasks/prd-avaliacao-e-correcao/10_task.md`

VEREDITO: REPROVADO

Cenários exigidos:
- **Caminho feliz:** aplicar como avaliativa com janela, duração, embaralhamento e tempo adicional. O resumo aparece antes de confirmar e o POST sai em UTC. Mudar a janela antes do primeiro início manda o PATCH em UTC.
- **API:** a avaliativa nova sem janela recebe `ENTRADA_INVALIDA` e nada se grava. A prática segue sem janela. A avaliativa de antes da F6 segue lida como estava, e o PATCH nela só passa se trouxer a janela.
- **Casos de borda:**
  - fuso do computador diferente do da escola;
  - prova que passa da meia-noite;
  - hora que não existe (virada do horário de verão, 30/02);
  - dois alunos com o mesmo nome;
  - turma sem alunos;
  - tempo que não cabe, com 40 min e +50% e com 30 min e +100%;
  - tempo adicional sem duração;
  - aluno que perdeu o tempo adicional na lista;
  - professor que volta de "É avaliativa" para "É prática".
- **Permissão:** "Mudar janela" some com alguém começado, na encerrada, na que não tem janela e na prática. A recusa `PROVA_JA_COMECOU` aparece em português.
- **Concorrência:** clique duplo em "Aplicar à turma" e em "Mudar a janela". A corrida entre mudar a janela e alguém começar já tem a trava no banco, que é da 1.0.
- **Estados:** a lista do tempo adicional carregando, com falha 429 e "Tentar de novo", vazia e com dado em várias páginas.
- **Isolamento:** a tarefa não cria consulta nova. A lista de alunos é `GET /v1/turmas/:id/alunos`, que já tem isolamento, e o teste de isolamento do aplicar (`atividade-isolamento.int.test.ts`) segue com `avaliativa: false` e o 404 confirmado.

Cobertos:
- Rodei a unidade `AplicacaoDoArtefato.test.tsx`, `prova-online.test.ts` (da web e do shared), `AtividadesDaTurma.test.tsx` e `atividade.test.ts`: 112 casos verdes.
- Os 72 blocos de mutação batem com o diff, e cada nome de teste citado existe.
- As cláusulas sem bloco têm motivo plausível: termo equivalente ou só de tipo.
- As asserções olham o resultado: o corpo do `POST`/`PATCH` enviado, o texto do resumo, o `aria-describedby`, e a linha e a auditoria no banco.
- O `TZ: 'Asia/Tokyo'` da unidade está mesmo em `vitest.config.ts:56`.
- O clique duplo em "Mudar a janela" é uma corrida de verdade: os dois `click()` caem no mesmo `act`, e quem segura o segundo é a trava `decidindo`. O e2e repete isso com `dblclick`.
- Os fixtures da API e do e2e mandam janela na avaliativa. Nenhum outro chamador aplica avaliativa pela rota sem janela: os testes do Tutor gravam direto no banco.
- Sem `.skip` e sem provedor de IA. O mock do e2e (`assistente.ts`) repete a recusa da API e não a esconde: a regra de verdade é provada na integração.

Bloqueantes:
1. **`e2e/professor-turma-atividades.spec.ts:152`, o caso "com alguém começado, o painel diz a prova e não oferece mudar a janela".** Duas linhas da tabela de testes citam este caso por uma prova que ele não faz:
   - a linha "Rótulos e axe" diz que ele roda `seriousViolations` no painel, e o caso não chama `seriousViolations`;
   - a linha "360 px" diz que ele prova os 44 px do "Mudar janela", e o botão nem existe nesse caso.

   Com isso, o painel com a frase nova da prova (`data-prova-da-atividade`, `text-sutil`) não tem axe sem um diálogo aberto por cima.
   - **Correção exigida:** pôr `expect(await seriousViolations(page)).toEqual([])` neste caso, com o painel aberto e sem diálogo.
   - Na tabela, tirar os "44 px do 'Mudar janela'" deste caso. A medida que existe é a do botão de confirmar "Mudar a janela", na linha 181, e o texto precisa dizer isso. Ou então medir o botão "Mudar janela" do painel no caso da linha 161.
2. **`apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx:542`, o caso "se alguém começou entre abrir a tela e confirmar… e a lista é relida".** O nome promete que a lista é relida, e nada confere isso.
   - O `MudarJanela` está montado sozinho, sem ninguém lendo a lista. O `recarregarAtividades` (`api/atividades.ts:59`) só invalida as consultas, e sem quem as leia nenhum GET sai.
   - Apagar o `onError: () => recarregarAtividades(cliente)` (`MudarJanela.tsx:57`) não deixa nenhum teste vermelho. Ficam sem prova o que o docblock e a autoconferência 10 afirmam: depois da corrida, a lista é relida e o botão sai.
   - O comentário da linha 553 ("quem dobra o clique não manda um segundo pedido") descreve um clique duplo que o caso não faz.
   - **Correção exigida:** provar isso no painel (`AtividadesDaTurma.test.tsx`), onde a lista está sendo lida. O PATCH responde 409 `PROVA_JA_COMECOU`, a segunda leitura de `/v1/atividades-aplicadas?turmaId=…` devolve `iniciaram: 1`, e o teste confere a nova leitura e que, fechado o diálogo, o botão "Mudar janela" sumiu.
   - Acrescentar o bloco de mutação que tira o `onError`. Fazer o clique duplo de verdade no caso, ou tirar o comentário.

Recomendações:
- A linha "Mudar janela" da tabela fala em "os oito casos", e o `describe` tem sete.
- A autoconferência 4 diz que `canAplicarNaTurma` responde antes da conferência da prova. Pelo `prova-online.test.ts` do shared, a recusa sai do `aplicarAtividadeRequestSchema`, na entrada, antes da autorização. Não vaza nada, porque é 400 para qualquer id, mas o texto não corresponde ao código.
- Vale um caso de unidade com `dblClick` em "Aplicar à turma" no componente. Hoje só o e2e prova o pedido único no aplicar, e essa trava já existia antes da tarefa.

Arquivos citados:
- e2e/professor-turma-atividades.spec.ts
- apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx
- apps/web/src/areas/professor/atividades/MudarJanela.tsx
- apps/web/src/areas/professor/atividades/AtividadesDaTurma.test.tsx
- tasks/prd-avaliacao-e-correcao/10_task.md

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-23 22:23:58 · `tasks/prd-avaliacao-e-correcao/10_task.md`

VEREDITO: APROVADO

**Campos pessoais tocados:** nenhum campo novo nesta rodada. A lista do tempo adicional continua lendo `nome` e `usuarioId` dos alunos da turma do professor pela `GET /v1/turmas/:id/alunos`, que já existia. Só a ordenação mudou: agora usa `ordemDeNome`, de `apps/web/src/areas/professor/turmas/alunos-da-turma.ts:38`. Ordena por nome e, no empate, por id, só no navegador. Não lê nem expõe campo novo.

**Fora da tabela de dados do docs/lgpd.md:** nada.

**Autorização por objeto:** ok. O diff não cria rota nem consulta. O comentário novo em `apps/api/src/atividade/prova-online.int.test.ts:241-242` deixa explícito que esse caso só testa a conferência da prova. A troca de escola continua coberta pelo caso de isolamento já existente.

**Logs:** limpos. O diff não acrescenta nenhum log.

**Auditoria:** presente, e o teste ficou mais forte. Em `apps/api/src/atividade/prova-online.int.test.ts:110-115`, ele agora confere que quem aparece como autor de `atividade.aplicada` é a professora. Confere também que `depois` guarda só a contagem `comTempoAdicional: 3`, sem id de aluno e sem percentual. Isso mostra que a frase da tela "fica registrado com o seu nome" é verdadeira sem levar dado de aluno para a auditoria.

**Envio externo:** nenhum. O diff não toca IA nem provedor.

**Seed/fixture:** sintético. O mock `e2e/support/assistente.ts` só passou a fazer a mesma conferência da API (`ATIVIDADE_ENCERRADA` e `camposInvalidosDaProva`) e não guarda dado de pessoa. As fotos mostram "Colégio sintético da vitrine cheia", "Professora Sintética Helena 98104fd1" e "2ºB 98104fd1".

**Fotos:**
- Diálogo de aplicar com "É avaliativa" marcada, no computador e no celular: aparecem só atividade, turma, número de questões e os campos da janela. Não há dado de aluno.
- `/professor/turmas` com a 2ºB aberta: só nome da turma e disciplina.
- O diálogo "Mudar a janela da prova" e a lista do tempo adicional com alunos não foram fotografados. Pelo código, a lista aparece só para o professor da própria turma, mostra nome e seletor de percentual e não tem campo de motivo. O resumo e o painel dizem quantos alunos têm tempo adicional, nunca quais.

**Bloqueantes:** nenhum.

**Recomendações:**
- As da 1ª rodada estão registradas no `TODO.md` com dono: a lista de nomes carregada só ao abrir "Marcar tempo adicional", e a frase do `docs/lgpd.md:60` sobre a contagem na auditoria. Nada a acrescentar.
- Fotografar a lista do tempo adicional com alunos e o diálogo "Mudar a janela da prova" na validação da funcionalidade, quando a vitrine tiver uma prova avaliativa aberta que ninguém começou.

Pergunta de fechamento: o diff não muda o arquivo do titular nem cria envio novo. A contagem do tempo adicional fica na auditoria do aplicar, e as linhas de `tempo_adicional`, com quem concedeu, seguem sendo dado da escola ligado ao aluno, como na 1ª rodada.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-23 22:24:29 · `tasks/prd-avaliacao-e-correcao/10_task.md`

VEREDITO: APROVADO

Tela vista: sim (12 fotos de tela lidas, mais as 2 de sessão ignoradas por serem JSON). Cobrem o diálogo "Aplicar à turma" fechado e com "É avaliativa" marcada, a lista de Criados, e a turma 2ºB, no computador e no celular. A lista de Criados está nas duas escolas: cheia e vazia. Pela lista `Rolam`, nenhuma tela passa de 768 px a 1366 px de largura. O diálogo "Mudar a janela da prova", a lista do tempo adicional com alunos e o painel da prova avaliativa não estão nas fotos, e os cobri pelo código e pelos testes, como o prompt indicou.

Estados: ok.
- A lista do tempo adicional tem os quatro estados em `AplicacaoDoArtefato.tsx:127-140`: carregando (`LoadingState`), erro com "Tentar de novo", vazio ("Esta turma ainda não tem alunos.") e com dado.
- A seção "Na turma" também tem os quatro estados em `AplicacaoDoArtefato.tsx:289-300`.
- O estado vazio de Criados convida: "Nada gerado ainda… Escolha uma ferramenta" e o botão "Ir para ferramentas".
- Carregando e erro eu conferi só pelo código e pelo e2e.

Acessibilidade: ok.
- O diálogo é `alertdialog` e o foco começa no texto, não no botão que confirma.
- Cada campo tem rótulo e erro ligado ao campo (`FormField`). O `fieldset` com `legend` agrupa a escolha prática/avaliativa.
- Os alvos de radio têm 24 px (`size-6`) dentro de uma linha de 44 px (`min-h-11`).
- Não há campo de motivo, e o e2e confere isso.

Chromebook fraco: ok.
- O diálogo rola dentro de si (`Dialog.tsx:54`, `max-h-[calc(100svh-2rem)] overflow-y-auto`), e a lista de alunos vem de cem em cem com "Ver mais alunos".
- Virtualizar ou filtrar essa lista para turma com mais de 100 alunos depende de medição com throttling. Isso já está no `TODO.md`, com dono, e não bloqueia.

Celular: ok.
- A 360 px o diálogo cabe, sem rolagem horizontal nem texto cortado, e os botões "Cancelar" e "Aplicar à turma" ficam empilhados com altura de 44 px ou mais.
- O tempo adicional é uma coluna só.
- Nada depende de hover. O e2e roda nos projetos `celular` e `chromebook`.

Ação oficial protegida: sim.
- O "Aplicar à turma" mostra atividade, turma, questões e, na avaliativa, a frase da prova (janela no fuso da escola, duração, quantos têm tempo adicional), mais o efeito, antes de confirmar.
- O "Mudar a janela da prova" mostra "Ninguém começou ainda" e a janela nova antes de gravar.
- A trava `decidindo` impede o segundo pedido (`AplicacaoDoArtefato.tsx:261`, `MudarJanela.tsx:70`). O caso novo prova isso com dois cliques no mesmo ato.

Diff da rodada 2, conferido:
- A lista do tempo adicional usa `ordemDeNome` (`AplicacaoDoArtefato.tsx:119`). A função em `alunos-da-turma.ts:38` tem a mesma semântica de antes (pt-BR, desempate por id) e ordena por nome, nunca por acerto.
- O mock `e2e/support/assistente.ts` agora segue a API real no `mudarJanela`: recusa aplicação encerrada, `PROVA_JA_COMECOU` e janela inválida.
- Os testes novos são o clique duplo e o `PROVA_JA_COMECOU` pelo painel. Este último confere que o diálogo diz em português, que a lista é relida e que o botão sai do painel.
- A auditoria passou a ter o autor conferido.
- Os itens novos de `TODO.md` têm dono.

Bloqueantes: nenhum.

Recomendações:
- A janela da prova usa `datetime-local`, e nas fotos o campo aparece como `mm/dd/yyyy, --:-- --`. É o idioma do navegador da vitrine, e o controle nativo segue o navegador. Num Chromebook em pt-BR sai "dd/mm/aaaa", mas vale uma olhada na validação da funcionalidade num navegador em português (`AplicacaoDoArtefato.tsx:65-66`).
- A mensagem de `PROVA_JA_COMECOU` manda usar "Estender" (`packages/shared/src/errors/messages.ts:35`), que só existe na tarefa 11.0. Já está registrada para a 11.0, mas até lá o texto remete a um botão que não existe.
- Em Criados, a 360 px, os títulos longos ficam cortados com "…". Isso é anterior à tarefa, e o `aria` e o resumo não dependem deles.
- O rótulo do seletor é só o nome do aluno, o que deixa dois homônimos iguais na lista. Isso já foi levado para a 11.0.
- Fotografar na validação o "Mudar a janela da prova", a lista com alunos e o painel da prova avaliativa.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-23 22:24:40 · `tasks/prd-avaliacao-e-correcao/10_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

A 1ª rodada não exigiu correções. Nesta rodada li só o diff entre as rodadas e o que ele afeta.

- **Ordem dos alunos** (`AplicacaoDoArtefato.tsx:119`): a lista do tempo adicional agora usa a `ordemDeNome` da aba Alunos (`alunos-da-turma.ts:38`). O resultado é o mesmo de antes: primeiro o nome em pt-BR, depois o id. Como os ids são UUID em minúsculas, o desempate por `<` dá o mesmo que o `localeCompare` antigo. Com isso, a tela deixa de ter uma segunda forma de ordenar. Os dois blocos de mutação foram atualizados para a linha nova.
- **Mock do PATCH da janela** (`e2e/support/assistente.ts:283-192`): segue a ordem da API de verdade (`atividade-aplicada.service.ts:141-145` e `:136`): aplicação encerrada, depois alguém já começou, depois a mesma conferência do aplicar. Ele não confere o tempo adicional, e o comentário diz isso.
- **Comentário de `atividade-aplicada.ts`**: agora diz o que o código faz. A avaliativa sem janela de antes da F6 continua sendo lida, mas a prova que sai de um PATCH precisa ter janela.
- **Testes novos**:
  - O clique duplo em "Aplicar à turma" manda um pedido só. A mutação que tira `decidindo.current` faria o caso quebrar.
  - O erro `PROVA_JA_COMECOU` no painel faz a lista ser lida de novo e tira o botão "Mudar janela". Se o `onError` não fizesse nada, o caso quebraria.
  - A auditoria do aplicar tem a professora como autor e guarda só a contagem.
  - Há um axe novo no painel da prova já começada.

Os dois primeiros mudam o comportamento que provam e têm bloco de mutação. Nada no diff vai além da tarefa nem diverge da Tech Spec.

Não abri as fotos de novo: entre as rodadas, a única mudança na tela é a ordenação, e ela continua a mesma.

Recomendações:
- `e2e/support/assistente.ts:169`: o import aponta direto para `packages/shared/src/atividade/atividade-aplicada.ts`, e o resto do arquivo importa de `packages/shared/src/index.ts`. Se `camposInvalidosDaProva` já sai pelo índice, use o mesmo caminho.
- `10_task.md`: o bloco de mutação nomeia o caso como `dois cliques no mesmo instante em`, um prefixo cortado antes das aspas. Funciona se a busca é por prefixo, mas o nome inteiro evita achar o caso errado no futuro.
- Ficam as da 1ª rodada, já levadas ao `TODO.md`: juntar as constantes `'America/Sao_Paulo'` e as funções de fuso de `prova-online.ts`.

Arquivos relevantes:
- tasks/prd-avaliacao-e-correcao/10_task.md
- apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
- e2e/support/assistente.ts
- apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-23 22:24:45 · `tasks/prd-avaliacao-e-correcao/10_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum novo nesta rodada. O diff entre as rodadas 1 e 2 não toca `Nota`, `Correcao`, jobs, seed nem webhook. Os caminhos já existentes não mudaram e seguem todos com autor humano: sim.

Decisão autônoma sobre aluno: ausente. Aplicar e mudar a janela são atos do professor. O tempo adicional é marcado por ele, aluno a aluno, sem sugestão automática.

Aprovação registrada: ok. O teste de integração `apps/api/src/atividade/prova-online.int.test.ts:110-112` agora prova que a auditoria de `atividade.aplicada` tem a professora como `autor_usuario_id`. A auditoria guarda só a contagem `comTempoAdicional`, sem id de aluno e sem percentual. Isso sustenta a frase da tela "Fica registrado que você aplicou, com a data e a hora", que aparece nas fotos de computador e de celular. Nenhuma saída de IA ganhou exceção à aprovação.

Supervisão do tutor: ok. O diff não toca o Tutor. Nas fotos, a escolha avaliativa diz "O Tutor fica pausado para a turma até você encerrar a atividade" (`professora--professor-criados--...radio-name-avaliativa-i--computador.png`). É informação ao professor, não vigilância.

Autonomia declarada e visível: sim. Nada mudou nesta rodada. Na tela, o artefato aparece marcado como saída de IA: o avatar e o rótulo "Assistente" na foto do computador.

Bloqueantes: nenhum.

O que conferi no diff:
- **`AplicacaoDoArtefato.tsx:117`:** a ordenação passou a usar `ordemDeNome` (`apps/web/src/areas/professor/turmas/alunos-da-turma.ts:38`). É só ordem por nome, com o id para desempatar. Não toca a regra 70.
- **Mock `e2e/support/assistente.ts:280-292`:** agora replica a conferência da API, nesta ordem: aplicação aberta, ninguém começou e `camposInvalidosDaProva`. Não há escrita de nota nem saída de IA.
- **Comentário de `packages/shared/src/atividade/atividade-aplicada.ts:98-99`:** ficou coerente com o código. A avaliativa que passa por escrita precisa ter janela.
- **Testes novos:**
  - o clique duplo em "Aplicar à turma" manda um pedido só;
  - quando alguém começou a prova antes da confirmação, chega `PROVA_JA_COMECOU`, a lista é relida e o botão "Mudar janela" sai do painel;
  - o axe roda no painel da prova já começada.
- **Fotos:** nenhuma mostra nota, conceito ou sugestão de nota. O resumo da prova diz quantos alunos têm tempo adicional, nunca quais. Nenhum elemento induz uso.

Recomendações:
- Fica a da 1ª rodada, já registrada no `TODO.md`: escrever na AIA da correção de objetiva (ou em `docs/regulacao.md`) que "Aplicar" conta como a aprovação da regra 70, item 3, para a atividade original.
- Fotografar o diálogo "Mudar a janela da prova" e o painel da prova na validação da funcionalidade. Esta rodada cobriu os dois só pelo código e pelos testes.

## test-engineer · 2ª rodada · APROVADO · 2026-11-23 22:24:48 · `tasks/prd-avaliacao-e-correcao/10_task.md`

VEREDITO: APROVADO

**Cenários exigidos:** as duas correções da 1ª rodada, mais o que o diff r1→r2 afeta: a ordem da lista do tempo adicional (`ordemDeNome`), o mock `mudarJanela` do e2e, o autor da auditoria do aplicar, o clique duplo em "Aplicar à turma" e em "Mudar a janela", e a tabela de testes e as mutações do documento.

**Cobertos:**

1. **Correção 1 feita.**
   - O caso "com alguém começado, o painel diz a prova e não oferece mudar a janela" agora roda o axe com o painel aberto e sem diálogo por cima (`e2e/professor-turma-atividades.spec.ts:157`).
   - Na tabela, a linha "360 px" diz que os 44 px do botão de confirmar "Mudar a janela" são do caso que muda a janela, e que o outro caso só prova o axe do painel.

2. **Correção 2 feita.**
   - O caso novo `AtividadesDaTurma.test.tsx › se alguém começou entre abrir o painel e confirmar…` monta o painel. O PATCH responde 409 `PROVA_JA_COMECOU` e passa a lista para `iniciaram: 1`. O caso confere que:
     - o diálogo diz o erro em português;
     - houve mais leituras GET de `/v1/atividades-aplicadas` do que antes;
     - o "Mudar janela" sai do painel, e continua fora depois de fechar o diálogo;
     - saiu um PATCH só.
   - O bloco de mutação `onError: () => undefined` aponta para esse caso (`10_task.md:505-510`). No `MudarJanela.tsx:57`, é o único caminho que relê a lista depois do erro.
   - O comentário sobre clique duplo saiu do caso de `AplicacaoDoArtefato.test.tsx`, cujo nome agora manda a releitura para o painel.

3. **Clique duplo de verdade.** Os dois casos clicam duas vezes dentro do mesmo `act`, antes de o botão ser desligado:
   - "Aplicar à turma": `AplicacaoDoArtefato.test.tsx:404-406`, com o bloco de mutação de `decidindo` em `10_task.md:497-503`;
   - "Mudar a janela": `AplicacaoDoArtefato.test.tsx:498-500`, com o bloco em `10_task.md:563-568`.
   - Os dois conferem que saiu um pedido só, então quem segura o segundo clique é a trava, e não o `disabled`.

4. **`ordemDeNome`.** Os dois blocos de mutação da ordem foram reescritos para a linha nova (`10_task.md` na seção Mutações) e continuam apontando para `› a lista vai em ordem de nome`.

5. **Auditoria do aplicar.** `prova-online.int.test.ts:110-113` agora confere que o autor é a professora. O teste de "nenhum aluno, nenhum percentual" olha só o `depois`, para o id da professora não se confundir com o de um aluno. A nova linha "Quem concedeu o tempo adicional" da tabela cita esse caso pelo nome.

6. **Mock do e2e.** `e2e/support/assistente.ts:283-187` agora recusa a atividade encerrada (`ATIVIDADE_ENCERRADA`) e passa a prova mudada pela mesma conferência `camposInvalidosDaProva` da API. Isso aproxima o mock da API e não esconde regra.

7. **Rodei os testes.** `npx vitest run` de `AtividadesDaTurma.test.tsx` e `AplicacaoDoArtefato.test.tsx`: 67 de 67 passaram.
   - Nenhum `.skip` e nenhum teste comentado no diff.
   - Nada de IA nesta tarefa.

**Bloqueantes:** nenhum.

**Recomendações:**
- `10_task.md:80` (item 7): o texto ainda diz que o pedido único do `MudarJanela` é "provado pelo `dblClick` do componente". Agora são dois cliques dentro do mesmo `act`, como já diz o item 10. Ajustar a palavra para não mandar o leitor procurar um `dblClick` que não existe.
- `AtividadesDaTurma.test.tsx`, no caso novo: o filtro das leituras GET de `/v1/atividades-aplicadas` aparece duas vezes. Uma função `leituras()` deixaria o caso mais curto.

Arquivos auditados:
- apps/web/src/areas/professor/atividades/AtividadesDaTurma.test.tsx
- apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.test.tsx
- apps/web/src/areas/professor/atividades/MudarJanela.tsx
- e2e/professor-turma-atividades.spec.ts
- apps/api/src/atividade/prova-online.int.test.ts
- tasks/prd-avaliacao-e-correcao/10_task.md

## infra-guardian · 2ª rodada · APROVADO · 2026-11-23 22:24:57 · `tasks/prd-avaliacao-e-correcao/10_task.md`

VEREDITO: APROVADO
Caminho quente tocado: prova (só a tela do professor, o mock do e2e e os testes; nada mudou no servidor)
Rate limit: ok (o diff não toca rate limit)
Fila e prioridade: ok (o diff não toca fila)
Concorrência: protegida. O clique duplo em "Aplicar à turma" agora tem teste com dois cliques antes de o botão desligar, e a mutação que tira a trava `decidindo` (`AplicacaoDoArtefato.tsx:261`) faz esse teste falhar. A corrida entre mudar a janela e um aluno começar continua presa no banco (`atividade-aplicada.service.ts:141-145`, trava `for update` e nova leitura depois dela), e a tela só relê a lista, o que o novo caso de `AtividadesDaTurma.test.tsx` prova com a mutação do `onError`.
Índice e paginação: ok (nenhuma consulta nova; a lista de alunos continua a `GET /v1/turmas/:id/alunos`, de cem em cem)
Degradação de IA: não se aplica
Migration: não se aplica (nenhuma migration nova nesta rodada)
Métrica e alerta: ok (nenhum código novo de servidor no caminho quente)
Bloqueantes: nenhum
Recomendações:
- `e2e/support/assistente.ts:179-186`: o mock agora responde na mesma ordem da API de verdade (`ATIVIDADE_ENCERRADA`, depois `PROVA_JA_COMECOU`, depois `ENTRADA_INVALIDA`, como em `atividade-aplicada.service.ts:144-145` e `:136`). Ele não confere o tempo adicional contra a janela nova, porque guarda só a contagem. Se algum e2e passar a mudar a janela de uma prova com tempo adicional, esse caso tem de ir contra a API de verdade, e não contra o mock.
- O cenário de carga da manhã com prova aberta continua com a tarefa 3.0, como ficou registrado na 1ª rodada. Confirmar que ele entra lá.

Arquivos relevantes:
- .processo/ordens/diff-10-r1-r2.patch
- apps/web/src/areas/professor/atividades/AplicacaoDoArtefato.tsx
- apps/web/src/areas/professor/atividades/MudarJanela.tsx
- apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
- e2e/support/assistente.ts
