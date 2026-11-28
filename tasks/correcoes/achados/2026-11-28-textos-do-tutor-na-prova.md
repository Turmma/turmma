# Achados das revisões — `tasks/correcoes/2026-11-28-textos-do-tutor-na-prova.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-28 10:57:44 · `tasks/correcoes/2026-11-28-textos-do-tutor-na-prova.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A mudança fica só na tela (textos e escolha de aviso em `apps/web`) e nos e2e. Não toca API, contrato, job, seed nem importação. Todos com autor humano? sim, porque nenhum caminho foi criado nem alterado.

Decisão autônoma sobre aluno: ausente. A tarefa não cria nenhuma decisão sobre aprovação, reprovação ou encaminhamento. O texto novo de `oQueFazer` (`apps/web/src/areas/professor/atividades/AtividadesDaTurma.tsx:572`) diz que a prova "encerra sozinha" e que "o Assistente corrige". Isso descreve o fim da janela e a correção da objetiva. Não descreve nota nem decisão sobre o aluno. O passo seguinte continua sendo o `para_revisar` ("Revise os destaques e aprove antes de os alunos verem o diagnóstico"), e o teste novo da linha 506 confirma que a prova encerrada cai nesse texto.

Aprovação registrada: ok. A tarefa não muda o fluxo de aprovação. A exceção do tutor (D47) não aparece em outro agente.

Supervisão do tutor: ok. A correção deixa a supervisão mais fiel ao que o servidor faz, que é o que a regra 70, item 4, pede ao falar com professora e aluno:
- A professora deixa de ler "pausado até você encerrar" numa prova de amanhã, quando o Tutor ainda está livre (`aprovar.ts:141`, `:151-156`).
- O aluno passa a ler "durante a prova, da abertura até o fim do seu tempo" (`atividades.ts:24-29`).
- A avaliativa sem janela continua com o texto de antes, que corresponde ao comportamento dela.
- `MinhaAtividade.janela` é `nullable` sem `optional` (`packages/shared/src/atividade/prova.ts:243`). Por isso o `=== null` do lado do aluno basta, e o lado da professora trata também o `undefined` (`atividade-aplicada.ts:229`).

Nenhum texto novo fala em emoção, comportamento ou tempo ocioso. Nenhum cria urgência ou induz uso (D59). O teste de vocabulário (`atividades.test.ts:383`, `AtividadesDaTurma.test.tsx:547`) foi estendido aos textos novos.

Autonomia declarada e visível: sim. A tarefa não muda nada nisso.

Fotos:
- `aluno--aluno-atividades--celular.png` e `professora--professor-turmas--computador.png`: nenhuma nota, conceito ou sugestão de nota. Também não há saída de IA sem rótulo.
- O aviso novo não aparece nas fotos, como a observação já dizia. Conferi o texto pelo código e pelos testes de componente e pelos e2e.

Bloqueantes: nenhum.

Recomendações:
- Há fotos antigas na pasta da vitrine, de 23/11, anteriores ao código desta tarefa (`aprovar.ts` é de 28/11 10:55). Uma delas, `.processo/vitrine/professora--professor-criados--Estequiometria-lista-sintética-tab-name-Na-turma-button-name-Aplicar-à-turma-radio-name-avaliativa-i--computador.png`, ainda mostra "O Tutor fica pausado para a turma até você encerrar a atividade." Ela não está na lista desta rodada e não reflete o código atual. Vale apagar as fotos antigas a cada rodada (ou regenerá-las), para que nenhum revisor tome o texto velho pelo atual.
- A vitrine sintética poderia ter uma avaliativa aberta com janela. Assim o aviso ao aluno e à professora, que é a parte da regra 70, item 4, tocada aqui, apareceria em foto e não só no teste.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-28 10:57:58 · `tasks/correcoes/2026-11-28-textos-do-tutor-na-prova.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum. A mudança só troca texto nas telas da prova, do aluno e da professora. Não cria request, query, job, chamada de IA, estado no servidor nem migration.
Rate limit: ok. Não entra rota nova; a tela continua usando os mesmos endpoints.
Fila e prioridade: ok. Não entra job novo.
Concorrência: protegida. Não há nada a proteger: o diff não grava nada. A escolha do texto é uma função pura sobre o campo `janela`, que o contrato já devolve (`packages/shared/src/atividade/prova.ts:64` e `:243`, `packages/shared/src/atividade/atividade-aplicada.ts:69`).
Índice e paginação: ok. Não entra query.
Degradação de IA: não se aplica.
Migration: não se aplica.
Métrica e alerta: ok. Nada novo no servidor para medir.
Bloqueantes: nenhum
Recomendações:
- Em `apps/web/src/areas/aluno/atividades.ts`, `avisoDaAvaliacao` testa só `janela === null`. Em `apps/web/src/areas/professor/atividades/aprovar.ts`, `avisoDaAvaliativaAberta` testa `null` e `undefined`. O contrato do aluno não deixa o campo opcional, então hoje isso está correto. Mesmo assim, as duas funções ficam diferentes; vale alinhar a guarda ou anotar o motivo.
- A vitrine sintética não tem avaliativa com janela aberta, por isso o aviso novo não aparece em nenhuma foto. Uma prova com janela no seed da vitrine deixaria esse estado visível nas próximas rodadas.

## frontend-reviewer · 1ª rodada · AJUSTES NECESSÁRIOS · 2026-11-28 10:58:00 · `tasks/correcoes/2026-11-28-textos-do-tutor-na-prova.md`

VEREDITO: AJUSTES NECESSÁRIOS

Tela vista: sim (12 das 24 fotos lidas, cheia e vazia). Li as de Tarefas do aluno, Turmas e Criados da professora, e `/aluno` no computador. Nenhuma foto mostra o texto novo, porque a vitrine sintética não tem avaliativa aberta. O aviso foi conferido pelo código e pelos testes de componente. Não bloqueia: a foto `aluno--aluno--computador.png` (`/aluno`) saiu com "Página não encontrada", endereço errado da vitrine (o Início é `paths.ts:159`), então o Início do aluno ficou sem foto.

Estados: ok. Esta correção só troca texto. Os quatro estados das telas tocadas seguem como estavam, e a vazia de Tarefas convida ("Quando quem dá a aula passar uma atividade para a turma, ela aparece aqui").

Acessibilidade: sem mudança de marcação, foco ou contraste. Os avisos continuam em `<span>` e `<p>` com `break-words`, sem corte nem rolagem horizontal em 360 px nas fotos.

Chromebook fraco: não se aplica (troca de string).

Celular: fotos de 360 px sem rolagem horizontal, alvos e rótulos íntegros. O aviso novo é um pouco mais longo, mas está em bloco com `min-w-0 break-words` e quebra de linha.

Ação oficial protegida: sim. Nada nesta correção toca aprovação, nota ou publicação.

Bloqueantes:

1. `apps/web/src/areas/aluno/tutor.ts:65` (e o teste em `apps/web/src/areas/aluno/tutor.test.ts:68`): a tela do Tutor pausado diz "Ele volta quando quem dá a aula encerrar." Esse é o mesmo texto que a correção veio tirar. O servidor trava o Tutor da abertura até o fim do tempo de cada aluno, e a prova encerra sozinha. Esta é a tela a que o aluno chega ao clicar em "Pedir ajuda ao Tutor" logo abaixo do aviso novo. A rota está no próprio e2e `aluno-fluxo.spec.ts:179-182`. O aluno lê "pausado até o fim do seu tempo" e, um toque depois, "volta quando quem dá a aula encerrar". A correção listou três pontos e deixou este de fora, então a contradição que a validação apontou continua na mesma jornada.
   Correção exigida: o texto da pausa `avaliacao` não pode afirmar que depende de a professora encerrar. Ou passa a dizer algo verdadeiro para os dois casos (por exemplo "Ele volta quando a avaliação terminar"), ou usa a janela (como o `avisoDaAvaliacao`) para escolher entre a prova e a avaliativa sem janela. Atualizar `tutor.test.ts:68` e `e2e/aluno-tutor.spec.ts:295`.

2. `packages/shared/src/errors/messages.ts:30`: `TUTOR_PAUSADO_EM_AVALIACAO` diz "Ele volta quando o professor encerrar a avaliação." É a mensagem de erro tipado que o cliente mostra e que o servidor devolve ao aluno que pergunta durante a prova. Diz a mesma coisa falsa e usa "o professor". Correção exigida: mesmo ajuste do item 1, atualizando o teste que fixa a mensagem, se houver.

Recomendações:
- `AtividadesDaTurma.tsx:56`, `oQueFazer` da avaliativa aberta sem janela: ainda diz "Quando a turma terminar, encerre a atividade…". Está correto para a avaliativa sem janela, que é a intenção declarada. Vale um comentário dizendo que esse é o ramo de antes da F6.
- `apps/web/src/areas/aluno/atividades.ts:28`: `avisoDaAvaliacao` testa `janela === null`. O tipo do aluno é sempre `nullable()` e não opcional (`prova.ts:64,243`), então está certo. Se um dia o tipo virar opcional, `undefined` cairia no aviso da prova. O lado da professora (`aprovar.ts`) já trata `undefined`. Opcional alinhar os dois.
- Na vitrine, corrigir o endereço do Início do aluno (`/aluno/inicio`) e criar uma avaliativa aberta com janela no seed sintético, para a foto mostrar o aviso novo.

Pontos conferidos e sem defeito:
- Os três pontos listados na correção (`aprovar.ts:141/145`, `atividades.ts:21`, `AtividadesDaTurma.tsx:54`) foram corrigidos e usam `janela` corretamente.
- A lista, o Início, a escolha do Tutor, o painel da atividade e "Na turma" usam as funções novas.
- Os e2e foram atualizados de forma coerente com as strings novas.
- Português do Brasil, sem termo técnico vazando.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-28 10:58:05 · `tasks/correcoes/2026-11-28-textos-do-tutor-na-prova.md`

VEREDITO: APROVADO

A correção só troca textos na tela: nenhuma rota, DTO, consulta, log, envio externo ou campo novo. Ela escolhe o aviso do Tutor a partir do campo `janela`, que já vinha no contrato (`AtividadeAplicada`, `MinhaAtividade`).

Campos pessoais tocados: nenhum. Os avisos novos dependem só de `janela` e de `avaliativa`, que não são dado de pessoa.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok, sem mudança. Nenhum endpoint foi criado nem alterado; as telas leem as mesmas rotas de antes (`/v1/minhas-atividades`, `/v1/atividades-aplicadas`).

Logs: limpos. Nenhuma chamada de log entrou no diff.

Auditoria: não se aplica. Não há leitura de dado de aluno por coordenação ou rede, exportação, alteração de nota ou permissão, nem aprovação de saída de IA.

Envio externo: nenhum. A mudança não envia nada a provedor de IA nem registra nada em `ExecucaoAgente`.

Seed/fixture: sintético.
- Os testes novos usam UUID fixo e "Lista sintética NN" (`apps/web/src/areas/aluno/EscolhaDaAtividade.test.tsx`, `Atividades.test.tsx`, `Inicio.test.tsx`, `AplicacaoDoArtefato.test.tsx`, `AtividadesDaTurma.test.tsx`).
- Os e2e só trocaram o texto esperado.
- Nas fotos aparecem só nomes sintéticos ("Aluno Sintético Caio b6d21866", "Professora Sintética Helena b6d21866", "Colégio sintético da vitrine cheia 0f9b0e7f"). Nenhuma mostra matrícula, nota ou dado de outro aluno.

O que conferi nas fotos:
- `aluno--aluno-atividades--computador.png`: a lista do aluno mostra só as tarefas dele, com "Corrigida" e o resumo da disciplina, sem número de acerto.
- `professora--professor-turmas--computador.png`: a lista mostra a turma e a contagem "1 esperando você", sem nome de aluno.

Como a vitrine não tem avaliativa aberta, conferi os avisos novos pelo código e pelos testes de componente. Os textos novos não citam aluno, nota nem colega, e os testes de vocabulário proibido agora também cobrem `AVISO_DA_PROVA` e `AVISO_DA_PROVA_ABERTA`.

Pergunta de fechamento: esta mudança não muda a resposta. Ela não cria dado guardado nem destino de envio.

Bloqueantes: nenhum.

Recomendações:
- Para o `frontend-reviewer`, fora da regra 20: as fotos `aluno--aluno--computador.png` e `aluno--aluno--celular.png` mostram "Página não encontrada" em `/aluno`, na escola cheia. Não vaza dado, mas assim as fotos não servem para ver o aviso do Início. Vale conferir se a vitrine está com a rota errada ou se a rota mudou.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-28 10:58:37 · `tasks/correcoes/2026-11-28-textos-do-tutor-na-prova.md`

VEREDITO: REPROVADO

Escopo: respeitado

Aderência à Tech Spec: divergência no texto novo do aviso do Tutor. Ele descreve uma trava diferente da que a §5.10 define.

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

Bloqueantes:

1. **O texto novo diz quando o Tutor volta, e diz errado.**
   - Onde: `apps/web/src/areas/aluno/atividades.ts:204` (`AVISO_DA_PROVA`), `apps/web/src/areas/professor/atividades/aprovar.ts:407` (`AVISO_DA_PROVA_ABERTA`) e `apps/web/src/areas/professor/atividades/aprovar.ts:141` (descrição de "É avaliativa").
   - Os textos dizem "da abertura até o fim do seu tempo" e "até o fim do tempo de cada aluno".
   - A Tech Spec §5.10 diz outra coisa: o Tutor trava "do `abre_em` até o fim da janela (com extensões da turma) ou o limite dele, **o que vier depois**".
   - O servidor faz o que a §5.10 diz. O caso `apps/api/src/tutor/tutor-trava-da-prova.int.test.ts:198` prova isso: "o aluno cujo limite já passou segue travado até o fim da janela, que vem depois".
   - Como `limite_base_em = min(início + duração, fecha_em)` (§5.3), no caso comum o Tutor fica travado até a janela fechar, e não até o fim do tempo de cada um. Exemplo: prova de 40 min numa janela de 100 min. O aluno lê que o Tutor volta quando o tempo dele acaba, abre o Tutor e encontra o Tutor pausado. Quem não começou também fica travado até o `fecha_em`.
   - É o mesmo defeito que esta correção veio consertar (texto contra o servidor), agora na direção oposta. A frase sugerida na `validacao.md` §4 já vinha imprecisa, mas a referência é a §5.10 e o teste do servidor.
   - **Correção exigida:**
     - Dizer que o Tutor pausa da abertura até a prova fechar. Para quem tem mais tempo, até o fim do tempo dele. Sugestões:
       - aluno: "Avaliação: o Tutor fica pausado durante a prova, da abertura até ela fechar."
       - professora: "…da abertura até a prova fechar (ou até o fim do tempo de quem recebeu mais)."
     - Ajustar as asserções que travam a frase errada:
       - `apps/web/src/areas/aluno/atividades.test.ts:179-180`
       - `apps/web/src/areas/professor/atividades/AtividadesDaTurma.test.tsx:314` e `:321`
     - Ajustar os três e2e: `e2e/aluno-fluxo.spec.ts:177`, `e2e/professor-aplicacao.spec.ts:74` e `:165`, e `e2e/roteiro-da-demonstracao.spec.ts:482`.
     - Corrigir a seção "Sintoma" de `tasks/correcoes/2026-11-28-textos-do-tutor-na-prova.md:9`, que repete a mesma leitura errada da §5.10.
     - Depois, novo carimbo do portão.

Recomendações:
- A mesma checagem "tem janela" (`janela !== null && janela !== undefined`) aparece duas vezes: em `apps/web/src/areas/professor/atividades/AtividadesDaTurma.tsx:374` e em `apps/web/src/areas/professor/atividades/aprovar.ts:411`. Vale extrair um predicado `hasJanela(aplicada)` em `aprovar.ts` e usar nos dois lugares. Assim o aviso e o `oQueFazer` não divergem se o contrato mudar.
- `avisoDaAvaliacao` (`apps/web/src/areas/aluno/atividades.ts:208`) testa só `=== null`. Está correto porque `MinhaAtividade.janela` é `nullable` sem `optional`. Mesmo assim, com o mesmo formato de pergunta do lado do professor, a leitura fica mais uniforme.
- As fotos da vitrine não mostram nenhum dos textos alterados, porque a vitrine não tem avaliativa aberta. A conferência visual dessa mudança fica sem evidência até a vitrine ganhar uma prova com janela.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-28 10:59:40 · `tasks/correcoes/2026-11-28-textos-do-tutor-na-prova.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- **Caminho feliz:** a prova com janela mostra o aviso novo nas cinco telas. São a lista do aluno, o Início, a escolha do Tutor, a lista de "Aplicar" e o painel da professora. Também cobre o texto que diz que a prova "encerra sozinha".
- **Avaliativa de antes da F6, sem janela:** continua com o texto antigo, tanto com `janela: null` quanto com `janela` ausente, que aparece no contrato da professora.
- **Prova de amanhã:** o aviso diz o que vai acontecer, sem prometer pausa agora.
- **Aluno com o tempo dele mais curto que a janela, ou que enviou antes:** o Tutor continua pausado até o `fecha_em`. Este é o caso de borda que faltou.
- **Prática e prova encerrada:** sem aviso.
- **Avaliação já entregue:** sem aviso no aluno.
- **Vocabulário proibido:** nota, colega, pressa (D46, D59).
- **Permissão, isolamento e concorrência:** não se aplicam. A correção mexe só em texto de tela, sem dado, sem rota e sem escrita.

**Cobertos:**
- `atividades.test.ts` cobre a escolha `null` contra janela e o vocabulário proibido.
- `Atividades.test.tsx` cobre a prova de amanhã, a que está em andamento e a sem janela.
- `Inicio.test.tsx` cobre a prova com janela e a antiga.
- `EscolhaDaAtividade.test.tsx`, que é novo, cobre a prova, a antiga, a comum e a entregue.
- `AplicacaoDoArtefato.test.tsx` cobre a prova, a antiga, a prática e a encerrada.
- `AtividadesDaTurma.test.tsx` cobre `oQueFazer` com e sem janela e a prova encerrada. Cobre também `avisoDaAvaliativaAberta` com `null` e com `janela` ausente, a descrição da escolha, o painel com a frase da prova e o vocabulário.
- Os 20 blocos de mutação batem com o `git diff` e alcançam cada condição nova.
- Não há `.skip`, nem teste comentado, nem mock da regra.
- Rodei os 6 arquivos: 128 de 128 passam.

**Bloqueantes:**

1. **O texto novo contradiz a regra do servidor, e o teste grava a contradição como se fosse a regra.**
   - **Onde:** `apps/web/src/areas/professor/atividades/aprovar.ts:141` e `:151` dizem "da abertura até o fim do tempo de cada aluno". `apps/web/src/areas/aluno/atividades.ts:24` diz "da abertura até o fim do seu tempo".
   - **O que o servidor faz:** trava o Tutor até `max(fim da janela com extensões, limite do aluno)`. Está em `apps/api/src/tutor/tutor.repository.ts:305` e na Tech Spec §5.10, item 10: "até o fim da janela … ou o limite dele, o que vier depois". O teste `tutor-trava-da-prova.int.test.ts:198` prova isso: "o aluno cujo limite já passou segue travado até o fim da janela".
   - **O problema na prática:** numa prova de 40 min com janela de 100 min, o aluno que termina ou cujo tempo acaba leu que o Tutor voltaria no fim do tempo dele. Ele abre o Tutor e encontra o Tutor pausado. É a mesma classe de defeito que esta correção existe para fechar: um texto da tela que o servidor desmente.
   - **Os testes que fixam o erro:** `apps/web/src/areas/professor/atividades/AtividadesDaTurma.test.tsx:169` e `:176` exigem `toContain('da abertura até o fim do tempo de cada aluno')`. `apps/web/src/areas/aluno/atividades.test.ts:46` exige `toContain('fim do seu tempo')`.
   - **Correção exigida, no texto:** os três textos passam a dizer que o Tutor fica pausado da abertura até a prova fechar. Para o estendido, basta algo como "ou até o fim do seu tempo, se for depois".
   - **Correção exigida, nos testes:** as asserções passam a exigir que o texto fale do fechamento da janela, e não só do tempo do aluno.
   - **Correção exigida, no documento:** a seção "Sintoma" de `tasks/correcoes/2026-11-28-textos-do-tutor-na-prova.md` tem a mesma leitura errada ("até o fim do tempo de cada aluno") e precisa ser corrigida também.

**Recomendações:**
- O `oQueFazer` da prova aberta (`AtividadesDaTurma.tsx:55`) diz "encerra sozinha quando o tempo de todos acabar". O fim efetivo é o `fecha_em` com extensões, ou o limite mais tardio de quem está em andamento (Tech Spec §5.10, item 6). Se todos terminam às 10:40 e a janela fecha às 11:40, ela encerra às 11:40. Vale citar o fechamento da janela na mesma rodada do bloqueante.
- A seção "Teste que reproduz" do documento não cita pelo nome os testes novos de `Inicio.test.tsx`, `EscolhaDaAtividade.test.tsx` e `AplicacaoDoArtefato.test.tsx`. Eles existem e os blocos de mutação os usam, mas a lista fica incompleta para a validação.
- O banner de `Atividade.tsx:162` continua com `AVISO_DA_AVALIACAO`. Hoje ele não aparece numa prova com janela em resposta, porque a entrada (`AntesDeComecar.tsx:137-138`) manda essa prova para "Antes de começar" ou para `ProvaEmFoco`, já que o `limiteEm` não é nulo com janela. Só que nenhum teste prende isso. Um caso em `Atividade.test.tsx` provaria que o banner antigo não aparece com janela.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-28 11:49:47 · `tasks/correcoes/2026-11-28-textos-do-tutor-na-prova.md`

VEREDITO: APROVADO

Esta segunda rodada mexe só em texto de tela e numa mensagem de erro. Nenhum caminho de escrita, contrato ou API mudou, e a 1ª rodada não deixou correção exigida.

Caminhos de escrita em Nota: nenhum mudou nesta rodada (o diff toca só textos do front, `hasJanela`, uma mensagem em `packages/shared/src/errors/messages.ts`, testes e e2e). Todos com autor humano? sim, como na rodada aprovada.

Decisão autônoma sobre aluno: ausente. Os textos novos descrevem quando o Tutor pausa e quando a prova encerra. A prova que encerra sozinha quando a janela fecha só para as respostas: a correção vai para a fila do professor ("O Assistente corrigiu, e a correção espera você…", em `AtividadesDaTurma.tsx`). Não decide nada sobre a trajetória do aluno.

Aprovação registrada: ok, não mudou. Na foto `professora--professor-criados--computador.png`, a versão adaptada aparece como "Esperando você".

Supervisão do tutor: ok. O que mudou foi só o texto da pausa, em `apps/web/src/areas/aluno/tutor.ts:65` e em `TUTOR_PAUSADO_EM_AVALIACAO`: "Ele volta quando a avaliação terminar." Vale para a prova com janela e para a avaliativa sem janela, e o teste confere que nenhum dos dois manda o aluno esperar a professora. Na foto `aluno--aluno-inicio--computador.png` continuam a faixa "Quem dá a aula acompanha como você usa o Tutor." e o selo IA no avatar.

Autonomia declarada e visível: sim, não mudou.

Bloqueantes: nenhum.

O resto, conferido pelos itens da regra 70:
- **D55, nota em discursiva e redação:** nenhum texto, campo ou tela sugere nota. A lista "Corrigidas" do aluno (`aluno--aluno-atividades--celular.png`) fala em acertos por habilidade, sem nota nem conceito.
- **D35, adaptação:** o aviso do aluno (`apps/web/src/areas/aluno/atividades.ts:27`) deixou de dizer "o fim do seu tempo", e quem tem tempo adicional lê o mesmo texto que a turma. "Ou até o fim do tempo de quem recebeu mais" só aparece para a professora (`apps/web/src/areas/professor/atividades/aprovar.ts:141` e `:151`), que já conhece a adaptação. O texto não diz quem recebeu nem por quê.
- **4b, uso excessivo e saída:** nenhum texto induz uso nem dificulta sair.
- **Itens 7 e 8, vigilância:** nada de comportamento, emoção ou métrica de professor.
- **Fotos:** a vitrine não tem prova aberta, então os textos novos não aparecem nelas. Conferi pelo código, pelos testes de componente (`tutor.test.ts`, `atividades.test.ts`, `AtividadesDaTurma.test.tsx`, `ProvaEmFoco.test.tsx`) e pelos e2e. Nas oito fotos que olhei (aluno e professora, computador e celular), o que é da regra 70 está em ordem.

Recomendações:
- `tasks/correcoes/2026-11-28-textos-do-tutor-na-prova.md:41` e `:43`: a seção "Correção" abre com duas frases quase iguais ("Só a tela; nenhum contrato…" e "Só a tela e uma mensagem de erro; …"). Apagar a primeira.
- A vitrine sintética ganhar uma avaliativa aberta com janela, para o aviso e a pausa do Tutor aparecerem em foto. Já está registrada no `TODO.md` desde a 1ª rodada; repito porque, sem ela, este trecho da regra 70 nunca é conferido pela tela.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-28 11:50:01 · `tasks/correcoes/2026-11-28-textos-do-tutor-na-prova.md`

VEREDITO: APROVADO
Tela vista: sim (16 fotos lidas, cheia e vazia, professora em /professor/criados e /professor/turmas, aluno em /aluno/inicio e /aluno/atividades, computador e celular). Nenhuma delas mostra os textos desta correção: a vitrine não tem avaliativa aberta. Os textos novos foram conferidos pelo código, pelos testes de componente e pelos e2e.
Estados: ok. A mudança só troca texto. Nas fotos, o estado vazio convida ("Nada gerado ainda" com "Ir para ferramentas", "Nenhuma tarefa por agora", "Nada para fazer agora"). O estado com dado também está presente. Carregando e erro não mudaram nesta rodada.
Acessibilidade: sem alteração. O diff não toca marcação, foco nem contraste.
Chromebook fraco: sem impacto. São só constantes de texto e o predicado `hasJanela`.
Celular: as fotos a 360 px não têm rolagem horizontal, as abas e a navegação inferior estão íntegras, e os botões principais passam de 44 px. Nenhuma tela rola a 1366 × 768 (a lista `Rolam` veio vazia).
Ação oficial protegida: sim, e não foi tocada.

Conferência das duas correções exigidas:
1. A pausa do Tutor em avaliação, em `apps/web/src/areas/aluno/tutor.ts:65`, agora diz "Ele volta quando a avaliação terminar." Esse texto vale para a prova com janela e para a avaliativa sem janela, e não faz o aluno esperar pela professora. O teste em `tutor.test.ts:68` e o e2e em `e2e/aluno-tutor.spec.ts:295` foram atualizados.
2. `TUTOR_PAUSADO_EM_AVALIACAO`, em `packages/shared/src/errors/messages.ts:30`, agora diz "O Tutor fica pausado durante a avaliação. Ele volta quando a avaliação terminar." Saiu a menção ao "professor". `tutor.test.ts:71-72` fixa a mensagem e proíbe `encerr`, `quem dá a aula` e `professor`.

O que o diff acrescentou também está correto:
- `AVISO_DA_PROVA` virou "…da abertura até ela fechar", sem "fim do seu tempo". Quem tem tempo adicional lê o mesmo texto, e a tela não revela a adaptação (D35).
- Os textos da professora (`aprovar.ts:141,151` e o `oQueFazer`) acompanham o §5.10, itens 6 e 10.
- Os três e2e que citam o aviso e a descrição foram atualizados.
- Fiz um grep nos fontes e e2e por "fim do tempo", "professor/professora encerrar", "quem dá a aula encerrar", "até você encerrar" e "Ele volta quando". Sobraram só os textos da avaliativa sem janela, que são intencionais e continuam como antes: `AVISO_DA_AVALIACAO`, `AVISO_DA_AVALIATIVA_ABERTA` e os e2e `aluno-inicio`, `aluno-atividade` e `professor-turma-atividades`.
- O novo teste de `ProvaEmFoco` garante que a prova com janela não mostra o aviso sem janela, nem em "Antes de começar" nem na tela de foco.

Bloqueantes: nenhum.

Recomendações:
- Rodei `vitest` em `tutor.test.ts` e ele falhou na linha 71. O teste lê `MENSAGENS_DE_ERRO` de `@educa/shared` pelo `packages/shared/dist`, que é ignorado pelo git e estava desatualizado: ainda trazia "…enquanto a avaliação está aberta… quando o professor encerrar". O fonte está certo, então vale o código. Reconstrua o pacote (`build` do `@educa/shared`) antes do teste, para a conferência da validação não falhar por isso.
- O título do teste em `apps/web/src/areas/aluno/atividades.test.ts:42` ainda diz "até o fim do tempo dele". As asserções já são as novas. Vale ajustar o título para "até ela fechar".
- Duas pendências da rodada anterior continuam: a vitrine sintética precisa de uma avaliativa aberta com janela para o aviso aparecer em foto, e `tools/vitrine/` já está no `TODO.md`.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-28 11:50:31 · `tasks/correcoes/2026-11-28-textos-do-tutor-na-prova.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum

**A correção exigida na 1ª rodada foi feita**

- **Texto do aluno**, em `apps/web/src/areas/aluno/atividades.ts:65`: agora diz "Avaliação: o Tutor fica pausado durante a prova, da abertura até ela fechar." Não diz mais "o fim do seu tempo". Assim o aluno com tempo adicional lê o mesmo texto que os colegas, e a tela não revela a adaptação (D35).
- **Textos da professora**, em `apps/web/src/areas/professor/atividades/aprovar.ts:141` e `:151`: dizem "da abertura até a prova fechar (ou até o fim do tempo de quem recebeu mais)".
- **Linha da prova aberta**, em `oQueFazer` (`AtividadesDaTurma.tsx:174`): diz que a prova "encerra sozinha quando a janela fecha (ou quando acaba o tempo de quem recebeu mais)", como manda o §5.10, item 6.
- **Os textos batem com o servidor.** Conferi em `apps/api/src/tutor/tutor.repository.ts:242-299`. O Tutor fica travado do `abre_em` até o fim da janela ou até o limite do aluno, o que vier depois. A consulta só considera aplicação com `estado = 'aberta'`, então o Tutor também volta quando a professora encerra antes da hora. "Até ela fechar" e "volta quando a avaliação terminar" valem nos dois casos.
- **Testes e e2e acompanharam:**
  - As asserções que travavam a frase errada foram trocadas (`atividades.test.ts`, `AtividadesDaTurma.test.tsx`).
  - `atividades.test.ts` agora proíbe `/seu tempo|adicional/`.
  - Os três e2e pedidos foram ajustados (`aluno-fluxo`, `professor-aplicacao`, `roteiro-da-demonstracao`), e mais o `aluno-tutor`.
  - Não sobrou nenhuma ocorrência de "fim do seu tempo", "fim do tempo de cada aluno" nem "tempo de todos acabar" em `apps`, `packages` ou `e2e`.
- **A seção "Sintoma" do documento da tarefa foi corrigida** e cita o §5.10, itens 6 e 10.
- **As mudanças em `tutor.ts` e em `TUTOR_PAUSADO_EM_AVALIACAO` (`packages/shared/src/errors/messages.ts`) cabem no escopo.** Era a mesma contradição, apontada pelo `frontend-reviewer`, e só o texto mudou: o código do erro e o contrato ficaram iguais. Nenhum teste da API trava o texto antigo.
- **As recomendações da 1ª rodada** viraram `hasJanela`, e o motivo de não aplicar a outra a `avisoDaAvaliacao` está registrado no documento da tarefa.
- **Fotos:** o Início do aluno agora abre certo, e a vitrine não tem avaliativa aberta com janela. Por isso os textos novos não aparecem em nenhuma foto, e nada na tela contradiz a tarefa.

Recomendações:
- O documento da tarefa (`tasks/correcoes/2026-11-28-textos-do-tutor-na-prova.md`, seção "Correção") ainda tem a frase antiga "Só a tela; nenhum contrato, nenhuma API." logo antes da nova "Só a tela e uma mensagem de erro; …". As duas se contradizem; apague a primeira.
- `AtividadesDaTurma.tsx:163` importa `hasJanela` fora da ordem alfabética, entre `situacaoDaAplicacao` e `TEXTO_SEM_CORRECAO`. É só estética, e o lint passou.
- Repito o que já está no `TODO.md`: a vitrine sintética precisa de uma avaliativa aberta com janela, para o aviso novo aparecer em foto na validação da spec.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-28 11:50:34 · `tasks/correcoes/2026-11-28-textos-do-tutor-na-prova.md`

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
Recomendações: a vitrine sintética (`tools/vitrine/`) precisa de uma avaliativa aberta com janela, para que os textos novos apareçam em foto. Isso já está no `TODO.md`.

Desde a 1ª rodada, o diff (`.processo/ordens/diff-textos-r1-r2.patch`) muda os textos de quatro arquivos: `apps/web/src/areas/aluno/atividades.ts`, `apps/web/src/areas/aluno/tutor.ts`, `apps/web/src/areas/professor/atividades/aprovar.ts` e `apps/web/src/areas/professor/atividades/AtividadesDaTurma.tsx`. Também muda a mensagem `TUTOR_PAUSADO_EM_AVALIACAO` em `packages/shared/src/errors/messages.ts`. A única lógica nova é o predicado `hasJanela`, que não chama nada. Os testes e os e2e mudaram junto com os textos.

O diff não toca rota, request, fila, gateway de IA, estado em memória, query nem migration. Nenhum teste novo chama provedor pago. Sobre a mensagem compartilhada, nenhum teste de API ou e2e procura o texto antigo, "enquanto a avaliação está aberta". O texto antigo de `AVISO_DA_AVALIACAO` continua de propósito em `e2e/aluno-inicio.spec.ts` e `e2e/aluno-atividade.spec.ts`, que usam avaliativa sem janela.

A rodada anterior não deixou correções exigidas, então não havia nada a conferir.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-28 11:50:38 · `tasks/correcoes/2026-11-28-textos-do-tutor-na-prova.md`

VEREDITO: APROVADO

Esta é a 2ª rodada. Na 1ª não houve correção exigida. Auditei o diff 55e824f7 → 03198871 e as fotos.

**Campos pessoais tocados:** nenhum. O diff muda só textos de tela, a mensagem `TUTOR_PAUSADO_EM_AVALIACAO` em `packages/shared/src/errors/messages.ts:30` e o predicado `hasJanela` em `apps/web/src/areas/professor/atividades/aprovar.ts:153`. Não há migration, DTO, rota nem consulta.

**Fora da tabela de dados do docs/lgpd.md:** nada.

**Autorização por objeto:** ok. Nenhuma rota nova ou alterada.

**Logs:** limpos. O diff não tem nenhum log.

**Auditoria:** a regra não pede nenhuma nesta mudança. Não há leitura de dado de aluno por coordenação, exportação, mudança de nota ou permissão, nem aprovação de saída de IA.

**Envio externo:** nenhum.

**Seed/fixture:** sintético. Os testes novos usam ids gerados (`idDaProva(90)`, `idDaProva(91)`) e títulos fictícios como "Prova de estequiometria".

**Fotos:** todas as 16 telas estão nas pastas, e conferi oito delas (aluno e professora, escola cheia e vazia, computador e celular). Só aparecem nomes "Sintético" com sufixo hexadecimal: "Aluno Sintético Caio b6d21866", "Professora Sintética Helena b6d21866" e "2ºB b6d21866". Nada pessoal aparece onde a regra 20 pede id ou agregado. A versão adaptada em /professor/criados mostra "Fonte ampliada", que é a adaptação e não o diagnóstico (D35); isso já existia antes desta tarefa. Como a vitrine não tem avaliativa aberta, os textos novos não aparecem nas fotos.

**Bloqueantes:** nenhum.

**Recomendações:**
- Ponto positivo, para a retro: `AVISO_DA_PROVA` (`apps/web/src/areas/aluno/atividades.ts:27`) deixou de dizer "o fim do seu tempo". Antes, o texto mudava conforme o aluno tivesse ou não tempo adicional, e deixava perceber uma adaptação registrada. Agora todos leem a mesma frase (D35). O teste em `apps/web/src/areas/aluno/atividades.test.ts:47` garante isso com `not.toMatch(/seu tempo|adicional/i)`.
- Do lado da professora, o texto "ou até o fim do tempo de quem recebeu mais" (`apps/web/src/areas/professor/atividades/aprovar.ts:188` e `:199`, `apps/web/src/areas/professor/atividades/AtividadesDaTurma.tsx:174`) não nomeia ninguém e aparece só para quem aplica a prova. Não é vazamento. Se um dia esse texto for para o aluno ou a família, precisa ser revisto.
- Repito o que já ficou em `TODO.md`: a vitrine precisa de uma avaliativa aberta com janela para que o aviso novo apareça nas fotos da próxima vez.

## test-engineer · 2ª rodada · APROVADO · 2026-11-28 11:51:14 · `tasks/correcoes/2026-11-28-textos-do-tutor-na-prova.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Prova com janela:**
  - O professor lê que o Tutor fica pausado da abertura até a prova fechar. Isso aparece na escolha "É avaliativa", no painel e na lista de "Aplicar".
  - O aluno lê "da abertura até ela fechar" na lista, no Início e na escolha do Tutor.
  - A tela do Tutor pausado e o `TUTOR_PAUSADO_EM_AVALIACAO` não mandam o aluno esperar a professora.
- **Aluno com tempo adicional ou extensão (borda):** o texto continua verdadeiro e não revela a adaptação (D35).
- **Avaliativa sem janela (de antes da F6):** mantém "até quem dá a aula encerrar" / "até você encerrar".
- **Contrato com `janela` ausente (`undefined`) ou nula:** cai no texto de antes.
- **Prova com janela:** não mostra o banner antigo nem em "Antes de começar" nem na tentativa em andamento.
- **Permissão e isolamento:** não se aplicam, porque a correção mexe só em texto de tela, sem rota nem dado novo.

**Cobertos (as três correções exigidas na 1ª rodada foram feitas):**
1. **Textos.**
   - `aprovar.ts:141` e `:151` passaram a dizer "da abertura até a prova fechar (ou até o fim do tempo de quem recebeu mais)".
   - `atividades.ts:27` passou a dizer "da abertura até ela fechar." Ficou sem a cláusula do estendido, de propósito, para não revelar a adaptação (D35). Para o próprio aluno o texto é verdadeiro: a trava dele vai até `max(fim da janela, limite dele)` (`tutor.repository.ts:305`), e "ela fechar" é o fim da prova para ele.
2. **Testes.**
   - `AtividadesDaTurma.test.tsx` exige "da abertura até a prova fechar" no aviso e na descrição da escolha, e "encerra sozinha quando a janela fecha" no `oQueFazer`.
   - `atividades.test.ts:46-47` exige "da abertura até ela fechar" e proíbe `/seu tempo|adicional/`.
   - `tutor.test.ts` fixa o texto novo da pausa e o `TUTOR_PAUSADO_EM_AVALIACAO`, e proíbe `/encerr|quem dá a aula|professor/`.
   - `ProvaEmFoco.test.tsx` traz o caso novo: o banner antigo não aparece em "Antes de começar" nem no redirecionamento para `/prova/:id`.
3. **Documento.** A seção "Sintoma" passou a citar o §5.10, item 10 ("o que vier depois") e o item 6. A seção "Teste que reproduz" ficou completa, com os oito testes.

**Mutações:** a cláusula nova `hasJanela` tem dois blocos, um para `null` e outro para `undefined`. Cada um aponta a asserção que falha, e as asserções existem no teste. Os blocos de `avisoDaAvaliativaAberta` e de `oQueFazer` foram refeitos contra o código novo, inclusive o que tira a condição `estado === 'aberta'` (ou seja, a janela) da cláusula. As outras mudanças são constantes de texto, presas por `toBe` ou `toContain`. Rodei os 9 arquivos afetados: 204 testes verdes. Não há `.skip`, mock que esconda a regra nem provedor de IA.

**Bloqueantes:** nenhum.

**Recomendações:**
- **Texto do professor diz mais do que o servidor faz.** `apps/web/src/areas/professor/atividades/aprovar.ts:141` e `:151` dizem "o Tutor fica pausado **para a turma** … (ou até o fim do tempo de quem recebeu mais)". A trava, porém, é por aluno (`apps/api/src/tutor/tutor.repository.ts:294-305`): a extensão individual e o tempo adicional prendem só aquele aluno, e os colegas ficam livres quando a janela fecha (a extensão da turma conta para todos). O texto erra para o lado seguro, porque a professora espera mais pausa do que há, então não bloqueia. Uma redação mais exata seria "…até a prova fechar (para quem tem mais tempo, até o fim do tempo dele)". O teste de `AtividadesDaTurma.test.tsx:176` acompanharia a mudança.
- **Roteiro da demonstração desatualizado.** `docs/roteiro-da-demonstracao.md:226-227` ainda manda o apresentador esperar "Avaliação: o Tutor fica pausado até quem dá a aula encerrar". Essa é uma avaliativa com janela, e `e2e/roteiro-da-demonstracao.spec.ts:482` já prova o texto novo ("…da abertura até ela fechar."). O documento lido ao vivo vai contradizer a tela. Isso é do `revisor-geral`, mas vale corrigir nesta mesma correção.
- **Vitrine sem prova com janela.** Já está no `TODO.md`, como registrado: a vitrine ganhar uma avaliativa aberta com janela, para os textos aparecerem em foto.
