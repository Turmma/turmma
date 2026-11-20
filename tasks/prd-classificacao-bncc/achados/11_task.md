# Achados das revisões — `tasks/prd-classificacao-bncc/11_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-20 04:53:18 · `tasks/prd-classificacao-bncc/11_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nem migration nesta tarefa. As tabelas tocadas são `artefato` (`escola_id` e `ano_letivo_id`), `atividade_aplicada` (`escola_id` e `ano_letivo_id`), `secao_do_material`, `capitulo_do_material`, `material`, `habilidade_da_secao`, `suspensao_de_funcao` e `auditoria` (todas com `escola_id`), e `habilidade_bncc`, que é pública e não tem dono pela regra 10, item 1.

Queries verificadas:
- `ArtefatoRepository.lockParaTrocar` filtra escola, ano, vínculo confirmado e `criado_por` da sessão, e toma o `for update`.
- `ArtefatoRepository.porIdTravado` usa `#lidos`, que tem o mesmo escopo de `porId`.
- `ArtefatoRepository.hasAplicacaoOuVersao` e `ArtefatoRepository.saveConteudo` filtram escola e ano pelo contexto, e o `saveConteudo` só roda com a trava tomada na mesma transação.
- `AtividadeAplicadaRepository.artefatoParaAplicar` ganhou só o `for update` e manteve o escopo que já tinha.
- `SecoesRepository.daPagina` filtra a escola do contexto, e todo join usa a `escola_id` da seção. A citação vem do `jsonb`, sem chave estrangeira, e o teste a cobre.
- `SecoesRepository.descricaoDaHabilidade` lê a tabela pública e tem `@Unscoped` com justificativa.
- `SecoesRepository.recorteDoArtefato` é da 7.0 e filtra escola, ano, dono e vínculo.
- `SuspensaoRepository.estaSuspensa` e `AuditoriaRepository.countDaEscolaEDaPessoaDesde` tiram a escola e a pessoa do contexto.
- O `PATCH` não recebe `escolaId` no corpo nem na query. O corpo é estrito (`{ codigo }`), o `:id` passa pelo `IdPipe` (UUID) e o `:indice` fora do formato responde `NAO_ENCONTRADO`.
- O teto conta por pessoa e por escola, nunca por IP, e responde 429 para qualquer id antes de procurar o artefato, então não revela se ele existe.
- A rede tem `nunca` na matriz para `trocar_habilidade`, e `matriz.test.ts` foi atualizado com a célula.

Teste de isolamento: presente e efetivo.
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/troca-de-habilidade.int.test.ts:244`, o artefato da escola B lido na A, o da A lido na B e um id inexistente respondem o mesmo `NAO_ENCONTRADO`, e nada é gravado em B.
- Na linha 232, o colega da mesma escola recebe `NAO_ENCONTRADO`, nunca `CONFLITO`.
- Na linha 345, o artefato da A cita uma página do material da B, que está pronto e tem capítulo próprio. Se a cláusula `eq(secaoDoMaterial.escolaId, escolaId)` de `daPagina` for removida, o capítulo da B aparece e o teste falha.
- Na linha 428, a contagem de 300 é presa à escola: com A acima do teto, B continua trocando.

Bloqueantes: nenhum.

Recomendações:
1. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/artefato/artefato.repository.ts:111`, tirar só a `escola_id` de `lockParaTrocar` não deixa nenhum teste vermelho, porque `recorteDoArtefato` e o filtro de ano e vínculo já barram antes. A própria tarefa reconhece isso. Um caso com uma professora que tem vínculo nas duas escolas (regra 60, item 8a) tornaria as cláusulas de escola e de dono observáveis uma a uma.
2. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/material/secoes.repository.ts:145` e `:268`, há duas consultas `@Unscoped` em `habilidade_bncc` no mesmo módulo, ambas justificadas. Vale juntá-las num só leitor da tabela pública antes que apareça uma terceira, que pela regra 10, item 9, indicaria problema de desenho.
3. O título do caso em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/troca-de-habilidade.int.test.ts:223` cita "a rede", mas o caso só chama a rota como coordenação e como aluno. Ou se acrescenta a chamada da rede, ou o título passa a dizer que a rede está coberta por `matriz.test.ts`.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-20 04:53:25 · `tasks/prd-classificacao-bncc/11_task.md`

VEREDITO: APROVADO
Tela vista: sim (8 fotos lidas: Criados e o artefato aberto, no computador e no celular, na escola cheia e na vazia). As partes novas desta tarefa (o seletor aberto, o "Sem habilidade" e o capítulo ao lado) não aparecem nas fotos e foram julgadas pelo código, pelos testes de tela e pelo e2e. A foto do celular do artefato mostra a habilidade com o código e o "Trocar" desligado com o motivo. Isso contradiz o aviso do prompt, que dizia que a foto não mostraria a habilidade. Vale o que a foto mostra. Não li as fotos "lista-para-trocar" de uma hora atrás, como o prompt mandou.
Estados: ok.
- Carregando: o seletor mostra o texto de espera (`TrocaDeHabilidade.test.tsx:162`).
- Vazio: o seletor diz que a disciplina não tem componente da BNCC e a questão fica sem habilidade, e a lista sem resultado diz o que fazer.
- Erro: o seletor tem "Tentar de novo", e a troca que falha mostra uma frase curta com o seletor aberto (`TrocaDeHabilidade.tsx:115`, `troca-de-habilidade.ts:36-43`).
- Com dado: coberto nas fotos.
- Criados, na escola vazia, convida com "Nada gerado ainda" e "Ir para Ferramentas", no computador e no celular.

Acessibilidade: ok.
- O "Trocar" tem `aria-label="Trocar a habilidade da questão N"`, `aria-expanded` e `aria-describedby` apontando para o motivo quando está desligado.
- O Esc fecha o seletor e devolve o foco ao botão.
- O filtro recebe o foco ao abrir.
- O erro da troca usa `role="alert"`.
- Cada linha de habilidade tem alvo de pelo menos 44 px (`min-h-11`, caixa de 24 px).
- O e2e roda o axe (`seriousViolations`) com o seletor aberto, nos projetos `chromebook` e `celular`.

Chromebook fraco: não se aplica à lista longa. As candidatas só são lidas quando o seletor abre (`useQuery` dentro de `PainelDaTroca`), e a lista do seletor da 8.0 é cortada em `MAXIMO_DE_LINHAS_DO_SELETOR`, com filtro. Não há upload nem imagem nesta tarefa. Não vi teste com throttling de CPU nem de rede para esta tela (a regra 50, item 1, pede, e só a revisão garante).
Celular: ok.
- A foto a 360 px não mostra rolagem horizontal nem texto cortado.
- A linha da habilidade vira coluna abaixo de `sm` (`TrocaDeHabilidade.tsx:56`).
- `compacto` tem 44 px no toque e 36 px a partir de `md` (`button-variants.ts:76`).
- O e2e confere 44 px no "Trocar" no celular e em "Deixar sem habilidade", 24 px em todo controle e `horizontalOverflow` zerado.
- Nada depende de hover nem de atalho, porque o Esc é só um atalho a mais e há o "Cancelar".
- Nenhum fluxo exige o celular.

Ação oficial protegida: sim. A troca de habilidade não é ação oficial: não toca em nota nem em publicação. Ela troca só o artefato da professora, fecha depois da aplicação ou da versão adaptada, e a API devolve `CONFLITO` se a tela estiver velha. A troca fica em auditoria (`artefato.habilidade_trocada`). A página mantém a assinatura "IA" na saída gerada.

Bloqueantes: nenhum.
- Em 1366 px, `Rolam` é nenhuma.
- Português, data (20/11/2026, 04:50) e vocabulário estão corretos. Não vi termo técnico, id nem chave de tradução nas fotos.
- O `e2e/professor-troca-de-habilidade.spec.ts` confere que a tela não usa o vocabulário de nota nem "seção".

Recomendações:
1. `troca-de-habilidade.ts:10` e `TrocaDeHabilidade.tsx:74-78`: com o artefato já aplicado, a mesma frase longa ("Esta atividade já foi aplicada…") aparece sob cada questão, quatro vezes na foto celular-1 a celular-3. Seria melhor um aviso só no topo da folha, com o "Trocar" de cada questão desligado e apontando para ele. O `aria-describedby` já permitiria isso.
2. `TrocaDeHabilidade.tsx:107-108`: o seletor da 8.0 mostra "0 de 1 escolhidas" numa troca de uma habilidade só, e não marca a habilidade atual da questão. Vale um modo "trocar" no seletor, que esconda o contador e destaque a atual.
3. `troca-de-habilidade.ts:12`: "Não foi possível trocar a habilidade. Tente de novo" está sem ponto final, diferente do resto dos textos da tela.
4. A foto do artefato vem de uma massa de teste sem habilidade nas questões e com versão adaptada. Na validação, convém fotografar uma questão com "Trocar" ativo e o seletor aberto, no computador e no celular.

Arquivos principais:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/professor/artefatos/troca-de-habilidade.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/professor/artefatos/ConteudoDoArtefato.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/professor-troca-de-habilidade.spec.ts`

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-20 04:53:52 · `tasks/prd-classificacao-bncc/11_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. O diff não toca `nota`, `correcao` nem o lançamento. A única escrita nova é `ArtefatoRepository.saveConteudo` (`apps/api/src/artefato/artefato.repository.ts:167-172`), que grava a habilidade da questão no artefato do próprio professor. Todos com autor humano? sim. A troca só existe pelo `PATCH`, com a sessão do dono (`lockParaTrocar` filtra por `criadoPor = usuarioId`, linha 143). Não há job, seed nem importação que chame essa escrita.

Decisão autônoma sobre aluno: ausente. A troca vale só antes de aplicar e é escolha do professor. O diagnóstico por habilidade continua formativo (D46). O e2e confere que a tela não usa vocabulário de nota (`e2e/professor-troca-de-habilidade.spec.ts:90`), e o aluno continua sem receber o código da habilidade na prova (`apps/api/src/atividade/atividade.int.test.ts:147`).

Aprovação registrada: ok.
- **O ato humano que leva a atividade ao aluno continua sendo "Aplicar".** A troca agora acontece antes dele e fica gravada em `artefato.habilidade_trocada`, com autor, data, entidade e código antes e depois. O teste confere `autor_usuario_id` da professora (`apps/api/test/troca-de-habilidade.int.test.ts:155`).
- **Depois de aplicar, ou com versão adaptada, a troca é recusada com `CONFLITO`.** A regra está em `artefato.service.ts:326`, e a trava em `atividade-aplicada.repository.ts:138` e em `adaptacao.command.ts:47`.
- **A habilidade não muda depois que a versão adaptada foi aprovada.** Ela recebe `CONFLITO` por `origemId`.
- **A exceção do tutor (D47) não aparece em outro agente.**

Supervisão do tutor: ok. A tarefa não toca o tutor.

Autonomia declarada e visível: sim. Nenhum agente mudou de nível nem de função. A troca é ato humano, e a suspensão da classificação é respeitada: com a função suspensa, a sugestão da IA não sobe na lista (`apps/web/src/areas/professor/artefatos/troca-de-habilidade.ts:159`, com teste).

Medir o professor (item 9): ok. O teto de 100 trocas por hora por pessoa usa a auditoria só como contagem para o limite. Não vira indicador, não aparece em tela e não chega à coordenação. A métrica da techspec é por escola, "nunca por professor".

Fotos: o artefato aparece assinado como IA ("Assistente · conversa e ferramentas · IA"). No celular (`...Estequiometria-lista-sintética--celular-1.png`, `-2`, `-3`), cada questão mostra a habilidade, o "Trocar" desligado e o motivo em português comum. Esse texto vem de `TrocaDeHabilidade.tsx:70-78` e `troca-de-habilidade.ts:138`. Não há nota, conceito nem sugestão de nota, e nada induz uso. As telas de Criados, na escola cheia e na vazia, estão sem achado. O aviso que veio com as fotos diz que elas não mostram a habilidade nem o "Trocar", mas as fotos de celular mostram os dois (desligado, porque a atividade tem versão adaptada).

Bloqueantes: nenhum.

Recomendações:
1. **Código antigo some da auditoria.** `artefato.service.ts:332` grava `antes.codigo = null` com `legado: true` quando o código anterior é do catálogo antigo. Num artefato anterior à 10.0, a auditoria deixa de responder qual habilidade a IA tinha posto. Se houver artefato desses fora de dado sintético, vale guardar o código antigo num campo próprio, de lista fechada.
2. **A habilidade trocada continua sob a assinatura da IA.** Depois da troca, a linha da habilidade (`TrocaDeHabilidade.tsx:58-66`) não diz que foi escolha do professor. Isso não viola a regra 70, porque erra para o lado de rotular demais como IA, mas uma marca como "escolhida por você" ajudaria a responder "quem decidiu o quê".
3. **A ordem da lista não diz de onde vem.** As habilidades do capítulo sobem no seletor sem dizer que vêm da classificação do material, feita pela IA ou pela coordenação (`troca-de-habilidade.ts:158-161`). Um cabeçalho "Do capítulo" deixaria clara a origem da ordem.

Arquivos centrais da auditoria:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/artefato/artefato.service.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/artefato/artefato.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/troca-de-habilidade.int.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/auditoria/acoes.ts`

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-20 04:54:15 · `tasks/prd-classificacao-bncc/11_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo de pessoa. A tarefa mexe em três coisas, e nenhuma é dado de aluno:
- o `conteudo` do artefato, que é trabalho do professor: muda o código e o texto da habilidade de uma questão;
- a nova ação de auditoria `artefato.habilidade_trocada`, que tem o professor como autor e guarda só o id do artefato, a posição da questão e o código da BNCC de antes e de depois;
- a leitura `GET /v1/artefatos/:id`, que agora traz `secoesDasQuestoes` (número e título do capítulo, páginas, código e origem) e `classificacaoSuspensa`.

Fora da tabela de dados do docs/lgpd.md: nada. A ação nova está descrita em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/lgpd.md:101`. O título do capítulo já está classificado ali como texto do PDF da escola, sem dado de pessoa.

Autorização por objeto: ok.
- **A troca:** `lockParaTrocar` (`apps/api/src/artefato/artefato.repository.ts:107-114`) exige três coisas: o artefato estar no alcance do professor (escola, ano e vínculo confirmado na turma e na disciplina), ser dele (`criado_por` igual a quem está logado) e ficar travado com `for update`. Depois, `recorteDoArtefato` confere de novo.
- **Troca de id na URL:** o artefato de um colega, o de outra escola e o inexistente respondem todos `NAO_ENCONTRADO`, nunca `CONFLITO`. Os casos de teste estão em `apps/api/test/troca-de-habilidade.int.test.ts`. Índice fora do formato também responde como inexistente.
- **Papéis:** coordenação, aluno e rede ficam em `nunca` na matriz (`packages/shared/src/permissao/matriz.ts`). A rota entrou no teste de fronteira em `apps/api/test/input-boundary-late-modules.int.test.ts:112`.
- **Saída:** a resposta tem DTO estrito. `secaoDaQuestaoSchema` não leva `corrigida_por` nem `execucao_id`, e `apps/api/test/contracts.test.ts:217-229` trava isso.
- **Leituras auxiliares:** `hasAplicacaoOuVersao` e `saveConteudo` filtram pela escola e pelo ano. `daPagina` filtra pela escola da sessão. `descricaoDaHabilidade` lê sem escopo de escola com `@Unscoped` justificado, porque a tabela da BNCC é pública.
- **Adaptação:** a conclusão (`adaptacao.command.ts:47`) troca `porId` por `porIdTravado`, com o mesmo escopo de antes.

Logs: limpos. O diff não acrescenta nenhum log no backend e nenhum `console` na tela.

Auditoria: presente. A ação `artefato.habilidade_trocada` é gravada na mesma transação da troca (`artefato.service.ts:211`). O contrato dela é estrito: código da lista fechada da BNCC ou `null`, e índice de 0 a 19. `packages/core/src/auditoria/acoes.test.ts` prova que título e texto livre são recusados. Pela regra 20, item 10, a troca não exigia auditoria, porque não é nota, permissão nem leitura por coordenação. Ela foi registrada mesmo assim e também serve para contar o limite de trocas.

Envio externo: nenhum. A troca não chama a IA.

Seed/fixture: sintético. As fotos mostram "Colégio sintético", "Professora Sintética Helena af69da1e" e "Enunciado sintético". Os testes usam "Reações químicas", "Capítulo secreto da B" e códigos e textos da BNCC.

Fotos: nenhuma das telas mostra dado de aluno. Criados e o artefato aberto mostram só o que é da própria professora: título, turma, disciplina, habilidade e material. A tela de escola vazia não expõe nada. Como você avisou, o "Trocar" aparece desligado com o motivo (foto `...celular-2.png`; linha em `TrocaDeHabilidade.tsx`). Isso não toca a minha regra.

Pergunta de fechamento: a troca não cria dado novo sobre aluno, e nada vai para fora. A ação de auditoria, com o professor como autor, entra no arquivo dele como ato, sem o `antes` e o `depois` (D85). O que o sistema guarda de cada aluno, e para onde foi, continua respondido pelo arquivo do titular e por `envio_externo` e `provedor`.

Bloqueantes: nenhum.

Recomendações:
1. Em `docs/lgpd.md:101`, a descrição de `artefato.habilidade_trocada` ficou na linha "Material da escola". Ela cabe melhor na linha "Autoria de artefato e de aplicação" (`docs/lgpd.md:97`). Também falta a ação na lista das que guardam o id depois da eliminação, na coluna de retenção.
2. `porIdTravado` (`artefato.repository.ts:98`) e `artefatoParaAplicar` (`atividade-aplicada.repository.ts:138`) travam o artefato sem exigir o dono, enquanto a troca exige. Para a privacidade está certo, porque o escopo de vínculo continua e só a troca precisa ser do dono. Vale uma linha no comentário dizendo que essa diferença é de propósito, para a próxima revisão não estranhar.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-20 04:54:20 · `tasks/prd-classificacao-bncc/11_task.md`

```
VEREDITO: APROVADO
Caminho quente tocado: prova (aplicar atividade ganhou trava) | fila (conclusão da adaptação no worker ganhou trava)
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/artefato/artefato.repository.ts:117 (`hasAplicacaoOuVersao`): a busca em `atividade_aplicada` por `artefato_id` não tem índice com essa coluna. Ela só aproveita o prefixo `escola_id` do `atividade_aplicada_turma_idx`. O `aplicacoes()` já fazia a mesma busca antes desta tarefa, e a tabela cresce por aplicação do professor, não por aluno. Quando o volume pedir, o índice certo é `(escola_id, artefato_id)`.
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.tsx:37-38: depois do `setQueryData` vem um `invalidateQueries(ARTEFATOS_QUERY_KEY)`. Ele busca de novo o artefato que acabou de ser gravado, a lista de habilidades-bncc e a lista de artefatos, ou seja, cerca de 3 GETs a mais por troca. Com o teto de 100 trocas por hora o custo é baixo. Restringir a invalidação à chave `'lista'` evita esse tráfego.
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/artefato/artefato.service.ts:306: o `Retry-After` manda sempre esperar a janela inteira (3600 s), mesmo quando a janela móvel liberaria antes. Não está errado. Se a tela mostrar o tempo, vale calcular a partir do registro mais antigo da janela.
```

Os itens 1, 2 e 3 de "O que verificar", em detalhe:

- **Rate limit:** conta por pessoa e por escola. A contagem lê a auditoria pelo índice `auditoria_escola_em_idx`, o mesmo padrão já aceito no `PATCH` do material.
- **Request:** nada demorado dentro dele, sem modelo e sem PDF.
- **Travas:** aplicar, adaptar e trocar travam a mesma linha do artefato. Procurei um ciclo de espera entre elas e não achei: nenhuma das três trava outra linha antes do artefato, e a auditoria não tem trava em cadeia.
- **Testes de corrida:** P6a, P6b, P7 e P8 forçam a ordem com `esperarNaTrava`. Nenhum teste chama provedor pago.
- **Migration:** a tarefa não traz nenhuma.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-20 04:54:48 · `tasks/prd-classificacao-bncc/11_task.md`

VEREDITO: APROVADO

Escopo: respeitado
Aderência à Tech Spec: ok. A única divergência é a leitura do artefato (`GET /v1/artefatos/:id`), que passou a trazer `secoesDasQuestoes` e `classificacaoSuspensa`. Ela está registrada nos três lugares: na `techspec.md` §4 (linha nova), no `cenarios.md` ("Troca pelo professor") e na tarefa, em "Divergências resolvidas".
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

Bloqueantes: nenhum

O que conferi:
- **Ordem das respostas:** é a da §4. Primeiro a trava com `NAO_ENCONTRADO`, depois o recorte com `NAO_ENCONTRADO`, depois `ENTRADA_INVALIDA` (tipo ou índice, e o código fora do recorte) e por último `CONFLITO`.
- **Teto:** 100 trocas por pessoa e 300 por escola, contadas na auditoria. A guarda roda antes do corpo ser lido.
- **Trava:** aplicar toma o `for update` no artefato logo na primeira leitura da transação, e a conclusão da adaptação também (`porIdTravado`).
- **Auditoria:** guarda só o índice e o código, nunca título nem descrição.
- **Matriz:** a nova ação `trocar_habilidade` vale só para o professor (`turma_vinculada`); coordenação, aluno e rede ficam em `nunca`.
- **Peças reaproveitadas:** o seletor é o da 8.0, importado. O nome do capítulo e o texto do 429 foram para `components/habilidades/nome-da-secao.ts`, e a coordenação passa a reexportá-los, sem cópia.
- **Fotos:** no artefato com versão adaptada, cada questão mostra "Habilidade EM13CNT10x: texto", o "Trocar" desligado e o motivo. É o que o RF9 e a §9 pedem. A foto não mostra capítulo porque a questão não tem seção; o código faz isso em `TrocaDeHabilidade.tsx:68`.

Recomendações:
1. **Comentário diz algo que o código não faz.** Em `packages/shared/src/assistente/artefato.ts:544-545` e em `apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.tsx:17`, o comentário diz que `secoesDasQuestoes` vem `null` quando "a disciplina não tem componente". Só que `SecoesRepository.daPagina` (`apps/api/src/material/secoes.repository.ts:210`) não olha o componente: a seção da página volta mesmo assim. Corrigir o comentário, ou o comportamento se a intenção for essa.
2. **Troca no meio de uma adaptação.** Se a troca acontece enquanto o modelo gera a versão adaptada (entre `preparar` e `concluir`), `exigirAdaptacaoFiel` falha com `IA_SAIDA_INVALIDA` e nenhuma versão nasce. O resultado é seguro, mas o comentário em `apps/api/src/artefato/adaptacao.command.ts:45-46` só fala da troca que chegou antes ("a versão repete a habilidade trocada") e não cobre esse caso. A professora vê a adaptação falhar sem motivo claro. Sugestões: registrar essa janela no `cenarios.md`, ou desligar o "Trocar" enquanto houver adaptação pendente.
3. **Motivo repetido.** Com o "Trocar" fechado, o motivo aparece abaixo de cada questão (foto `...celular-2.png`; código em `TrocaDeHabilidade.tsx:74-78`). Uma única frase no topo da folha talvez leia melhor. A decisão visual é do `frontend-reviewer`.
4. **Organização.** `ArtefatoTrocarHabilidadeGuard` ficou no arquivo do controller (`apps/api/src/artefato/artefato.controller.ts:46`). As guardas do material moram fora dele, em `apps/api/src/material/material-upload.ts`. Vale seguir o mesmo lugar.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-20 04:56:22 · `tasks/prd-classificacao-bncc/11_task.md`

VEREDITO: REPROVADO

Não alterei nenhum arquivo. Rodei os testes, e todos passam: `troca-de-habilidade.int.test.ts` (24 casos) e os três arquivos de unidade da tela (24 casos). O `mutacoes.ts --faltando` lista as 10 linhas que a seção "Mutações" já explica, e não há `.skip`, `.only` nem teste comentado.

**Cenários exigidos:** troca feliz com a base intacta e o diagnóstico pela trocada · troca por nenhuma e código legado · disciplina sem componente · coordenação, aluno e rede recusados · artefato aplicado e com versão adaptada (`CONFLITO`) · colega da escola e escola B (`NAO_ENCONTRADO`, nunca `CONFLITO`) · código de outra disciplina da mesma professora na mesma turma · índice inexistente e corpo inválido · tetos de 100 por pessoa e 300 por escola, antes do corpo e por escola, nunca por IP · leitura do capítulo isolada (material da B, material excluído, segundo material) · função suspensa · as corridas P6a, P6b, P7 e P8, com ordem forçada · tela (carregando, erro, `CONFLITO`, 429, sem componente, ordem da lista, suspensa, desligado com motivo, foco, `PATCH` no ar) · e2e em chromebook e celular, teclado e recomeços.

**Cobertos:** todas as linhas da tabela de testes têm o caso citado pelo nome, e cada nome confere com um caso que existe. As corridas usam chamadas paralelas de verdade, com `WriteBlockTrigger` e `esperarNaTrava`. O P8 tem um caso para a parada `before` e outro para a `after`, e só a `before` isola a trava da adaptação. O isolamento tem os dois sentidos: o artefato da B lido pela A, o da A lido pela B, e a seção de material da B citada no `jsonb`, com a conferência de que esse material está pronto. O teste de IA usa o adaptador falso. A rede é provada na matriz (`matriz.expectativa.ts`).

**Bloqueantes:**

1. **`apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.tsx:70`: o `disabled={motivo !== undefined}` não tem bloco de mutação.**
   - É a regra central da 11.3: o "Trocar" fica desligado depois da aplicação.
   - O único bloco dessa linha (`11_task.md:598-603`) muta o `aria-describedby`, não o `disabled`. Mesmo assim, a autoconferência 1 (`11_task.md:79`) diz que "o `disabled` do Trocar" tem bloco.
   - O `--faltando` não pega o caso porque não separa os termos de ternário e comparação numa linha que já tem bloco.
   - Correção: acrescentar o bloco `disabled={motivo !== undefined}` → `disabled={false}`, com o teste `TrocaDeHabilidade.test.tsx › desliga o`. O caso da linha 153 (`botao.disabled` igual a `true`) deve ficar vermelho.

2. **`TrocaDeHabilidade.tsx:79`: a cláusula `falha={trocar.isError ? textoDaFalhaDaTroca(trocar.error) : undefined}` não tem bloco nem teste que a derrube.**
   - Com o mutante `falha={textoDaFalhaDaTroca(trocar.error)}`, todo seletor abre com o alerta "Não foi possível trocar a habilidade. Tente de novo", porque `textoDaFalhaDaTroca(null)` devolve essa frase.
   - Nenhum caso confere que o seletor abre sem alerta, nem na unidade nem no e2e.
   - Pior: o caso "erro da troca: a frase curta…" (`TrocaDeHabilidade.test.tsx:288-296`) passaria com esse mutante, porque a frase já estaria na tela antes do clique. Ele não prova que a frase vem da falha.
   - O mesmo vale para o passo da falha 500 no e2e (`e2e/professor-troca-de-habilidade.spec.ts:158`).
   - Correção:
     - num caso que abre o seletor sem falha (por exemplo "a lista põe as habilidades do capítulo…"), depois do `findBy` do positivo, conferir `queryByRole('alert')` sem texto, ou `queryByText(TEXTO_DA_FALHA_DA_TROCA)` igual a `null`;
     - no caso "erro da troca", conferir essa ausência antes do clique;
     - declarar o bloco que tira o `trocar.isError ?`.

**Recomendações:**
- `apps/api/test/troca-de-habilidade.int.test.ts:223`: o nome diz "a coordenação, o aluno e a rede", mas o caso só chama coordenação e aluno. Ou incluir uma sessão de rede, ou tirar "a rede" do nome (ela é provada na matriz).
- P6a, P6b, P7 e P8: sem a trava, quem fica vermelho é o `esperarNaTrava`, por tempo esgotado, e não a asserção sobre o resultado. No P6a, o estado final é o mesmo com e sem a trava da aplicação. Vale deixar isso explícito no caso, por exemplo conferindo que a promessa da aplicação não se resolveu antes do `soltar()`. Assim o vermelho diz qual é a regra.
- O `trocar.reset()` do `close()` (`TrocaDeHabilidade.tsx:49`) não tem caso: falhar, cancelar e reabrir sem o alerta velho.
- O `disabled={gravando}` de "Deixar sem habilidade" (`TrocaDeHabilidade.tsx:119`) não tem caso com o `PATCH` no ar, que seria o clique duplo do lado do "nenhuma".
- A autoconferência 1 também diz que "as chaves da `queryKey`" têm bloco, mas não há bloco sobre a chave de `habilidadesDoArtefatoQueryOptions` (`api/artefatos.ts:61`), que inclui o `artefatoId`. Corrigir o texto ou acrescentar o bloco.
- Faltam casos para o artefato de ano letivo anterior e para a professora com o vínculo encerrado tentando trocar no próprio artefato. Hoje os dois dependem só do `#noAlcance` e do `recorteDoArtefato`, já existentes.
- A linha "artefato" do e2e cita `soOPainelDaAbaRola` e "uma ação cheia". O spec usa `paginaNaoRola` e só confere que o "Trocar" não é cheio, sem contar as ações cheias da tela. Alinhar o texto da tabela ou o caso.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-20 05:30:17 · `tasks/prd-classificacao-bncc/11_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nesta rodada. O diff não tem migration nem schema. As tabelas da rodada anterior (`artefato`, `atividade_aplicada`, `secao_do_material`, `habilidade_da_secao`) não mudaram.

Queries verificadas: nenhuma query mudou. O diff toca três arquivos de código de servidor, e em todos a mudança é só comentário:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/artefato/adaptacao.command.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/artefato/artefato.repository.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts`

O comentário novo em `porIdTravado`, `lockParaTrocar` e `artefatoParaAplicar` explica por que só a troca exige o dono do artefato, e isso bate com o código. As travas `porIdTravado` e `artefatoParaAplicar` não exigem o dono, mas continuam presas a escola, ano e vínculo pelo `#noAlcance`.

Teste de isolamento: presente e efetivo.
- Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/troca-de-habilidade.int.test.ts:225`, o título agora diz o que o caso prova: coordenação e aluno recebem `NAO_ENCONTRADO` e a questão não muda. A minha recomendação 3 da rodada anterior foi atendida.
- A rede está coberta onde o título aponta: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/shared/src/permissao/matriz.expectativa.ts:91` tem `['rede', 'artefato', 'trocar_habilidade', 'nunca']`.
- Os casos de outra escola e de outro professor seguem iguais à rodada aprovada.
- Nas corridas P6a, P6b, P7 e P8, o `situacaoDe(...) === 'esperando'` agora falha pela regra quando a trava falta, e não só pelo tempo esgotado. Não afeta o escopo.

Bloqueantes: nenhum.

Recomendações: nenhuma nova. Uma observação sobre o `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/lgpd.md`: a auditoria `artefato.habilidade_trocada` foi para a linha "Autoria de artefato e de aplicação". Ela guarda só ids, a posição da questão e códigos da tabela pública da BNCC, nunca título, enunciado ou texto. Nada disso afeta o isolamento.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-20 05:30:19 · `tasks/prd-classificacao-bncc/11_task.md`

VEREDITO: APROVADO
Tela vista: sim (9 fotos lidas: Criados no computador e no celular, o artefato "Estequiometria: lista sintética" no computador e em 3 pedaços no celular, e Criados vazia no computador e no celular).
Estados: ok. A leitura é pelo código e pelo e2e, porque carregando e erro não aparecem na vitrine. Os estados da troca já foram aprovados na 1ª rodada e o diff não os mexeu. Vazio: Criados vazia convida ("Nada gerado ainda… IR PARA FERRAMENTAS") e a marca de IA está presente. Com dado: lista e artefato renderizam.
Acessibilidade: ok. Nada mudou no código de tela além de um comentário de tipo e o ponto final de `TEXTO_DA_FALHA_DA_TROCA`. O diff reforça os testes de que o seletor abre sem o aviso de falha e de que o aviso velho não volta depois de cancelar. O e2e confere o alerta.
Chromebook fraco: sem mudança no diff. Rolam a 1366 × 768: nenhuma.
Celular: ok. A 360 px não há rolagem horizontal nem texto cortado. O "Trocar", mesmo desligado, tem altura de cerca de 40 px e largura de linha inteira. A barra de baixo aparece no meio da página só porque a foto é de página inteira, o que é artefato da captura. O seletor aberto não está nas fotos e é julgado pelos testes e pelo e2e do projeto `celular`, já aprovados.
Ação oficial protegida: sim. A troca de habilidade não é ato oficial. Ela leva trava no banco, auditoria e recusa depois da aplicação. Os novos `situacaoDe` provam que a segunda chamada espera a primeira, o que fecha a lacuna de teste que existia. O "Aplicar à turma" continua com diálogo de confirmação.
Bloqueantes: nenhum.
Recomendações:
- A tela fechada repete "Esta atividade já foi aplicada (ou tem versão adaptada)…" sob cada questão (fotos celular-1 a celular-3). Fica longa no celular. O `TODO.md` já registra a ideia de um aviso só no topo.
- A frase de erro agora termina com ponto e bate com `cenarios.md`, o teste e o e2e. Sem sobra do texto antigo, conferido por grep no código e no e2e.
- Os comentários novos (`adaptacao.command.ts`, `artefato.repository.ts`, `atividade-aplicada.repository.ts`, `artefato.ts`) batem com o comportamento. As diferenças entre `lockParaTrocar` (só o dono) e `porIdTravado` e `artefatoParaAplicar` (por vínculo) estão registradas. A linha nova de `docs/lgpd.md` lista a auditoria `artefato.habilidade_trocada` só com ids, posição e códigos. Todos os itens novos do `TODO.md` têm dono.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-20 05:30:21 · `tasks/prd-classificacao-bncc/11_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum (nesta rodada só mudaram comentários, documentação, o texto de uma constante e testes; a rota da troca e as travas não mudaram desde a 1ª rodada, que foi aprovada)
Rate limit: ok (não mudou desde a 1ª rodada)
Fila e prioridade: ok (não mudou)
Concorrência: protegida. As três corridas da troca (com a aplicação, com outra troca e com a adaptação) agora têm teste que prova que quem chega depois fica esperando a trava. Antes o teste só mostrava que o tempo de espera tinha acabado. A checagem nova está em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/troca-de-habilidade.int.test.ts:452`, `:473`, `:494` e `:521`. A falta de `criado_por` em `porIdTravado` e em `artefatoParaAplicar` é intencional, e agora o código diz isso em comentário.
Índice e paginação: ok (nenhuma query nova nesta rodada)
Degradação de IA: ok. Existe uma janela: a professora troca a habilidade enquanto o modelo ainda gera a versão adaptada. Nesse caso a adaptação falha com o erro tipado `IA_SAIDA_INVALIDA`, nenhuma versão é criada e nada vai à turma. Isso está registrado em `adaptacao.command.ts:47-48` e em `cenarios.md`.
Migration: não se aplica
Métrica e alerta: ok (nada novo no caminho quente)
Bloqueantes: nenhum
Recomendações:
- Um índice `(escola_id, artefato_id)` em `atividade_aplicada`, quando o volume do piloto pedir. Já está no `TODO.md` e não bloqueia.
- Desligar o "Trocar" enquanto houver adaptação pendente. Na janela descrita acima, uma geração inteira de tokens se perde e a professora vê a falha sem entender o motivo. Num dia comum o custo é pequeno, mas o item que já está no `TODO.md` também resolve isso.
- O teste de integração da troca ficou cerca de 2 s mais lento: são quatro esperas fixas de 500 ms em `situacaoDe`. Se a suíte de integração apertar o prazo, dá para trocar essas esperas por uma consulta a `pg_stat_activity`, como o `esperarNaTrava` já faz.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-20 05:30:27 · `tasks/prd-classificacao-bncc/11_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta rodada. O diff da 2ª rodada (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/.processo/ordens/diff-11_task-r2.txt`) só traz comentários, testes, docs e o ponto final de uma frase. Não toca `Nota`, correção nem `lancadaPor`. Na 1ª rodada a tarefa já não abria nenhum caminho de escrita em Nota. Todos com autor humano? sim.
Decisão autônoma sobre aluno: ausente.
Aprovação registrada: ok. A troca de habilidade é ato do professor, com autor, e fica na auditoria `artefato.habilidade_trocada`. A versão adaptada continua nascendo pendente ("Esperando você" na foto de Criados). A janela da troca enquanto o modelo gera a adaptação não leva nada à turma: `exigirAdaptacaoFiel` recusa e nenhuma versão nasce. O caso agora está escrito em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/artefato/adaptacao.command.ts:47-48` e em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/cenarios.md:160-163`. A exceção da D47 não aparece em outro agente.
Supervisão do tutor: ok. A tarefa não mexe no tutor.
Autonomia declarada e visível: sim. Nada mudou nesta rodada. O cabeçalho do artefato mostra o agente com o selo "IA" no computador e no celular.

Itens 6, 7 e 9 da regra 70:
- **Auditoria (item 6):** `docs/lgpd.md` agora põe `artefato.habilidade_trocada` na linha "Autoria de artefato e de aplicação" e diz que ela fica depois da eliminação só com ids e códigos. Isso deixa mais firme o "quem trocou e quando". A ação saiu da linha "Material da escola".
- **Vigilância (item 7):** nada novo de comportamento, emoção ou navegação.
- **Professor (item 8 da regra 70, D45):** nada novo de métrica ou ranking de professor.

Fotos: nas 7, nenhuma nota, conceito ou sugestão de nota aparece. As que mostram o artefato (`...Estequiometria-lista-sintética--computador.png`, `--celular-1/2/3.png`) só têm gabarito de objetiva, habilidade BNCC e o "Trocar" desligado com o motivo em português comum. A escola vazia (`vazia--professora--professor-criados--computador.png`) mostra o agente pela função e com o selo IA. Nada empurra o uso nem dificulta sair: "Sair" fica visível na lateral e no topo do celular.

Bloqueantes: nenhum.

Recomendações:
- Fica a da 1ª rodada, já no `TODO.md:4111`: a marca "escolhida por você" na habilidade trocada. Hoje a linha "Habilidade …" sob cada questão não distingue a habilidade que a IA escolheu da que a professora escolheu. O selo IA do cabeçalho cobre o artefato inteiro, então a tela erra para o lado de rotular demais como IA, e isso não viola a regra 70.
- Fica também o `legado` em campo próprio da auditoria (`TODO.md:4110`), sem urgência enquanto só houver dado sintético.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-20 05:30:42 · `tasks/prd-classificacao-bncc/11_task.md`

VEREDITO: APROVADO

Esta rodada só mudou comentários, documentação e testes. Nenhuma rota, DTO, query, migration ou log mudou. As duas recomendações que fiz na 1ª rodada (itens 11 e 12 da ordem) foram aplicadas.

**Campos pessoais tocados:** nenhum campo novo. A única mudança é onde a auditoria `artefato.habilidade_trocada` aparece no `docs/lgpd.md`. Ela guarda o id de quem trocou, o id do artefato, a posição da questão e os códigos da BNCC de antes e de depois, mais o sinal de que o código de antes era do catálogo antigo. O que o doc diz confere com o contrato da ação em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/packages/core/src/auditoria/acoes.ts:746-751`: `antes` guarda `{ indice, codigo, legado }`, `depois` guarda `{ indice, codigo }`, e não há título, enunciado nem texto da habilidade.

**Fora da tabela de dados do docs/lgpd.md:** nada. A recomendação 11 foi feita:
- A descrição da ação saiu da linha "Material da escola" e foi para a linha "Autoria de artefato e de aplicação" (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/docs/lgpd.md:97`).
- A coluna de retenção dessa linha agora diz que a auditoria fica depois da eliminação, só com os ids, a posição e os códigos.

**Autorização por objeto:** ok, sem mudança de código. A recomendação 12 foi feita como comentário. A diferença entre `lockParaTrocar` (exige o dono) e `porIdTravado` / `artefatoParaAplicar` (exigem só o vínculo) agora está escrita como intencional:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/artefato/artefato.repository.ts:97-99`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/artefato/artefato.repository.ts:109`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/src/atividade/atividade-aplicada/atividade-aplicada.repository.ts:124`

O teste de isolamento mudou só de nome: "a rede" saiu do título, porque essa parte é provada em `matriz.test.ts`. Os testes da coordenação e do aluno continuam esperando 404 `NAO_ENCONTRADO`.

**Logs:** limpos. O diff não acrescenta nenhum log.

**Auditoria:** presente. `artefato.habilidade_trocada` não mudou e agora está registrada na linha certa do mapa de dados.

**Envio externo:** nenhum novo. O comentário novo em `adaptacao.command.ts:47-48` explica uma situação. Se o professor troca a habilidade enquanto o modelo gera a versão adaptada, a versão é recusada com `IA_SAIDA_INVALIDA` e nada chega à turma. Isso não manda dado novo para fora. O envio da adaptação continua registrado em `ExecucaoAgente`, como antes.

**Seed/fixture:** sintético. As fotos mostram "Colégio sintético da vitrine cheia", "Professora Sintética Helena", enunciados, alternativas e trechos todos sintéticos. Os testes novos usam ids gerados e códigos da BNCC.

**Fotos:** não há dado de aluno nas telas da professora (Criados e o artefato, no computador e no celular). Aparecem só o nome da própria professora no menu dela, os códigos e textos da BNCC (tabela pública) e o rótulo do material. Não aparece matrícula, nota nem conversa.

**Pergunta de fechamento:** o que a troca de habilidade guarda está mapeado no `docs/lgpd.md`, com retenção e com o que sobra depois da eliminação. Essa parte do pedido da secretaria tem resposta. A troca não envia nada a terceiro.

Bloqueantes: nenhum.

Recomendações: nenhuma nova. As da 1ª rodada que ficaram em aberto estão no `TODO.md` com dono. Uma delas é guardar o código `legado` num campo próprio da auditoria. Se isso for feito, muda o `acoes.ts` e a linha 97 do `lgpd.md` na mesma tarefa.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-20 05:30:43 · `tasks/prd-classificacao-bncc/11_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (`portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)`)
Bloqueantes: nenhum

Nesta rodada conferi só o que mudou no diff. A rodada anterior não exigiu nenhuma correção minha. Os 13 itens da ordem `.processo/ordens/11_task-r1.md` estão aplicados:

- **Itens 1, 2, 5, 6 e 7:** os blocos de mutação novos estão em `tasks/prd-classificacao-bncc/11_task.md`, cada um com o caso de teste que o derruba:
  - `disabled={false}` no "Trocar";
  - `falha=` sem o `trocar.isError ?`, com dois casos;
  - `trocar.reset()` trocado por `void 0`;
  - `disabled={gravando}` de "Deixar sem habilidade";
  - `queryKey` sem o `artefatoId`.

  Os casos que derrubam cada um estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx`. O caso da falha confere que o aviso não aparece antes do clique, e só depois de o seletor aparecer na tela.
- **Item 3:** o nome do caso em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/troca-de-habilidade.int.test.ts` agora diz que a rede é provada em `matriz.test.ts`. A tabela de testes do documento (linha 45) traz o mesmo nome.
- **Item 4:** os casos P6a, P6b, P7 e P8 agora conferem com `situacaoDe(...) === 'esperando'` antes do `soltar()`. Sem a trava, quem fica vermelho é a asserção da regra, e não o tempo esgotado.
- **Item 8:** a linha "artefato" da tabela do documento agora cita `paginaNaoRola` e diz que o "Trocar" não é cheio.
- **Item 9:** os comentários de `packages/shared/src/assistente/artefato.ts` e `TrocaDeHabilidade.tsx` batem com `SecoesRepository.daPagina` (`apps/api/src/material/secoes.repository.ts:225-262`): a função filtra por escola, `pronto` e não excluído, e não lê o componente da disciplina.
- **Item 10:** a janela da troca que chega durante a geração está escrita em `adaptacao.command.ts` e em `cenarios.md` como janela conhecida. Não é divergência de arquitetura, e desligar o botão nesse caso ficou no `TODO.md`.
- **Item 11:** em `docs/lgpd.md`, `artefato.habilidade_trocada` saiu da linha "Material da escola" e foi para a linha "Autoria de artefato e de aplicação", com o que fica depois da eliminação.
- **Item 12:** a diferença entre as travas está escrita nos comentários de `porIdTravado`, `lockParaTrocar` e `artefatoParaAplicar`: só a troca exige o dono.
- **Item 13:** a frase de falha agora tem ponto final na constante, no e2e e em `cenarios.md`. Não sobrou nenhuma cópia literal sem o ponto.
- **"Sem aplicar":** as recomendações recusadas ou adiadas foram para o `TODO.md` com dono.

Recomendações:
- `TrocaDeHabilidade.tsx:17`: o comentário diz "o material saiu ou foi excluído", que é redundante. O de `artefato.ts` é mais preciso ("excluído, ainda não pronto ou de outra escola"); vale usar o mesmo texto nos dois.
- `troca-de-habilidade.int.test.ts`: a espera de 500 ms do `situacaoDe` soma cerca de 2 s à suíte, porque roda em 4 casos. Não é problema agora; se a suíte apertar o prazo, vale rever.

## test-engineer · 2ª rodada · APROVADO · 2026-11-20 05:31:56 · `tasks/prd-classificacao-bncc/11_task.md`

VEREDITO: APROVADO

**Cenários exigidos:** troca pela dona, com o diagnóstico usando a habilidade trocada e a base intacta · disciplina sem componente · coordenação, aluno e rede barrados · artefato aplicado e artefato com versão adaptada (`CONFLITO`) · colega da escola e artefato da escola B (`NAO_ENCONTRADO`) · código de outra disciplina da mesma professora na mesma turma · índice inexistente · limites de 100 por pessoa e 300 por escola · função suspensa · corridas P6a, P6b, P7 e P8 · tela: carregando, falha, `CONFLITO`, 429, sem componente, troca fechada com o motivo, clique duplo com o `PATCH` no ar, Esc e foco · e2e no `chromebook` e no `celular`, com teclado e recomeço.

**Cobertos:** todos os itens acima. As duas correções que exigi na rodada 1 estão feitas e conferidas contra a árvore de agora:
1. **O `disabled` do "Trocar":** o bloco `disabled={motivo !== undefined} aria-describedby` → `disabled={false} aria-describedby` está em `11_task.md:742-747`, citando "desliga o". O caso `TrocaDeHabilidade.test.tsx:153` (`expect(botao.disabled).toBe(true)`) fica vermelho com esse mutante. O trecho aparece uma vez só no arquivo.
2. **A cláusula `falha={trocar.isError ? …}`:** há dois blocos (`11_task.md:749-761`). O mutante faz a frase da falha aparecer em todo seletor aberto, porque `textoDaFalhaDaTroca(null)` devolve `TEXTO_DA_FALHA_DA_TROCA`. Os dois testes citados pegam isso:
   - No caso "erro da troca", o `tentar` (`:321`) agora confere que a frase não está na tela antes do clique.
   - No caso "a lista põe…", a conferência (`:195`) vem depois de o seletor abrir com a lista certa.
   - O e2e faz o mesmo (`e2e/professor-troca-de-habilidade.spec.ts:157-159`): confirma que o seletor está visível e depois que não há alerta. A busca é por trecho do texto (`filter({ hasText })`), então pega o alerta do mutante.

As recomendações que a Mesa mandou aplicar também foram feitas:
- **Nome do caso de isolamento:** não cita mais "a rede", e a tabela usa o mesmo nome.
- **P6a, P6b, P7 e P8:** cada um ganhou o `situacaoDe(...)` igual a `'esperando'`, com uma mensagem que diz a regra. O vermelho agora vem dessa asserção, e não só do tempo esgotado do `esperarNaTrava`. Com a trava no lugar, o resultado é sempre o mesmo, porque o pedido que chega depois fica parado na trava.
- **`trocar.reset()`:** tem bloco e caso, "cancelar depois de uma falha e abrir de novo".
- **`disabled={gravando}` de "Deixar sem habilidade":** tem bloco e asserção direta (`:257`).
- **Chave da consulta das candidatas:** o bloco que tira o `artefatoId` da `queryKey` tem o caso "as candidatas são de cada artefato". Os dois artefatos usam o mesmo cliente de consultas; o segundo precisa mostrar "carregando" e nenhuma caixa de marcar, o que deixa o mutante vermelho.
- **Autoconferência 1 e linha "artefato" do e2e:** batem com a seção "Mutações" e com o spec, que usa `paginaNaoRola`.

**Execução:** `TrocaDeHabilidade.test.tsx` passou (19 de 19) e `troca-de-habilidade.int.test.ts` passou (24 de 24). Não há `.skip`, teste comentado nem mock nosso escondendo a regra. Nenhum teste chama provedor de IA.

**Bloqueantes:** nenhum.

**Recomendações:**
- **O `situacaoDe` espera um tempo fixo de 500 ms** (`apps/api/test/troca-de-habilidade.int.test.ts:77`). Com a trava, o resultado não depende de tempo. Sem a trava, numa máquina lenta o pedido pode levar mais de 500 ms; aí o vermelho volta a vir do tempo esgotado do `esperarNaTrava`, e não da asserção. Continua vermelho, só pelo motivo menos claro. Basta deixar isso escrito no comentário.
- **A tabela de testes do documento não cita três casos novos:** "cancelar depois de uma falha e abrir de novo", "as candidatas são de cada artefato" e o "Deixar sem habilidade" no caso do `PATCH` no ar. Uma linha "tela: falha, reabrir e cache por artefato" deixaria a tabela completa.
- **Do `TODO.md`, continua aberto o que ficou da rodada 1:** um caso de ano letivo anterior e outro de vínculo encerrado na rota da troca.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.test.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/web/src/areas/professor/artefatos/TrocaDeHabilidade.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/apps/api/test/troca-de-habilidade.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/e2e/professor-troca-de-habilidade.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specclassificacao-bncc--l1/tasks/prd-classificacao-bncc/11_task.md
