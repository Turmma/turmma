# Achados das revisões — `tasks/prd-camada-ia/revisao-spec.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · AJUSTES NECESSÁRIOS · 2026-11-20 22:33:57 · `tasks/prd-camada-ia/revisao-spec.md`

VEREDITO: AJUSTES NECESSÁRIOS
Tela vista: não. A revisão é de spec, não existe código e não há foto. A tela precisa ser vista na validação, nos projetos `chromebook` e `celular`.

**Estados:** faltando. O estado vazio das telas novas não tem texto definido.
- A Tech Spec §9 não cita estado nenhum. O `cenarios.md` §4 fecha com uma frase genérica ("carregando, vazio, erro com 'Tentar de novo', com dado"), que cobre os quatro de forma implícita.
- Os textos de `sem_orcamento` e `sem_aluno_ativo` existem, mas eles são estado de dado, não estado vazio de tela.
- Falta o texto de erro e de vazio de duas telas: a lista "Ver meses", quando a escola ainda não tem mês anterior, e a aba Uso, quando não há escola.
- Algumas células da Operação estão em tom de desculpa e sem próximo passo: "sem orçamento definido" e "sem aluno ativo". O próximo passo ("Definir orçamento", ligando ao diálogo) deveria aparecer.
- O texto da coordenação "O previsto de IA da escola ainda não foi definido" também não diz o que fazer.
- Isso é recomendação, não bloqueante: a coordenação não muda o orçamento, e o aviso pode apenas informar.

**Acessibilidade:** implícita. A Tech Spec §9 não diz nada sobre ela. O diálogo "Orçamento de IA" é a única entrada de dado e precisa de:
- rótulo em cada campo (os rótulos do `cenarios.md` §4 existem);
- foco devolvido ao gatilho ao fechar;
- erro de intervalo ligado ao campo e anunciado (`aria-describedby` ou `role=alert`);
- barra de porcentagem com texto, não só cor;
- aviso de 80% e de 100% que não dependa só de cor.

Nada disso está escrito.

**Chromebook fraco:** parcial.
- Não há leitura que se relê sozinha, e a Operação pagina (`?pagina=`).
- Isso garante a lista, e a virtualização não é necessária com poucas escolas.
- O comportamento sob throttling de CPU e de rede não é citado. As fotos no projeto `chromebook` são citadas, mas não o throttling.
- A medida é "uma soma por escola a cada 5 min", sem custo no navegador.
- Imagem comprimida não se aplica: não há upload.

**Celular:** implícita, com um ponto bloqueante.
- A Tech Spec §9 diz "no celular, cartão" só para a aba Uso.
- O diálogo "Orçamento de IA", a lista "Ver meses" e o Painel e a Governança da coordenação não têm desenho para 360 px.
- O alvo de toque (24 px, 44 px na ação principal) e a ausência de hover não são citados.
- O e2e está em `computador` e `celular`, o que conta a favor.
- A paridade de ação para o operador no celular não é dita, mas nenhum fluxo exige o celular.

**Ação oficial protegida:** sim, com ressalva.
- Não há ação oficial no sentido de nota, publicação ou exclusão.
- O `PUT` do orçamento é uma ação administrativa e auditada (RF7, `cenarios.md` §1 e §3).
- Falta definir a confirmação. O diálogo mostra "Vale hoje: R$ 5,00 por aluno, da rede" antes de salvar, mas não mostra o efeito da mudança: a escola, o valor antes e o valor depois.
- Uma mudança de valor em rede muda o orçamento de todas as escolas dela e não tem revisão antes de confirmar.
- Isso é bloqueante, pelo critério de ação sem o que está sendo decidido à vista.

**Bloqueantes:**

1. Tech Spec §9 e `cenarios.md` §4, diálogo "Orçamento de IA": o `PUT` de rede altera o orçamento de todas as escolas dela sem etapa de confirmação.
   - Correção: o diálogo mostra a escola ou rede, o valor e o teto de antes e de depois, quantas escolas a mudança atinge (no caso de rede) e um botão "Salvar orçamento", com o resultado auditado. Fixar o texto em `docs/interface.md` 5.
2. Tech Spec §9: o desenho de 360 px só existe para a aba Uso. Faltam o diálogo, a lista "Ver meses", o Painel e a Governança.
   - Correção: declarar sem rolagem horizontal a partir de 360 px, alvo de toque de 24 px (44 px em "Salvar orçamento"), e nada que dependa de hover. A Tech Spec §9 precisa ter as fotos citadas nos dois projetos, para essas quatro telas.
3. Tech Spec §9: a acessibilidade do diálogo e do aviso não é escrita. Declarar rótulo por campo, erro de intervalo ligado ao campo e anunciado, foco devolvido ao gatilho e aviso com texto e não só cor. Cada ponto entra no e2e do `computador`.

**Recomendações:**
- Texto de vazio e de erro para "Ver meses" e para a aba Uso, e a ação "Definir orçamento" nas células "sem orçamento definido" e "sem aluno ativo".
- Aviso de 80% e de 100% com próximo passo (para a coordenação, o que dizer à equipe).
- A mensagem do 429 deve dizer o tempo em minutos, como já previsto. Garantir que o `ErrorState` da web antiga (§7c) fale "Atualize a página" e não mostre erro técnico.
- Formato local: R$ com vírgula, "5,00", e data em pt-BR (§9 não cita; o exemplo "R$ 5,00" sugere que sim).
- O `parte` da Governança é fatia dos tokens e a tela diz "do que a IA trabalhou". Isso evita o termo técnico "token" para a coordenação, o que é coerente com o RF12. Fixar o teste de que nenhuma tela de coordenação escreve "R$" nem "token".
- Dizer em tela que "hoje" da infra segue no último dia fechado (já previsto na §4).

Arquivos lidos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/prd.md`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/techspec.md`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/cenarios.md`.

## llm-integrator · 1ª rodada · AJUSTES NECESSÁRIOS · 2026-11-20 22:34:25 · `tasks/prd-camada-ia/revisao-spec.md`

VEREDITO: AJUSTES NECESSÁRIOS

Perfis usados: nenhum novo. A reserva herda o perfil da tarefa. O modelo menor só entra na espera por vaga e nunca atende o Tutor (D36). A avaliação roda cada amostra pela tarefa real, no perfil dela.

Custo estimado por professor/mês: a Tech Spec não traz esse número. Ela não cria chamada de produto nova. A reserva só atende quando o principal cai. O custo por aluno "não muda; passa a ser medido", contra os R$ 5 da D39 (§8). A única chamada nova é a avaliação: cerca de 325 chamadas × 3.250 tokens, em torno de R$ 30 por finalista no Sabiá 4 BR-SP, rodada à mão e uma vez. Como a precificação depende disso, falta uma linha com a diferença de preço entre reserva e principal por mês de queda.

Prompt versionado: não se aplica. Nenhum prompt novo ou alterado (§7b). As amostras são versionadas, com sha256 no relatório (§8).

Validação de schema: sim, e não muda. A repetição por saída inválida fica no provedor que respondeu, e a reserva valida igual (§5 item 3; cenário RF3, "repete na reserva").

Aprovação humana no caminho: sim. Não há função nova nem autonomia nova (§7b). A entrega de cada tarefa continua nascendo pendente. A alteração do orçamento tem auditoria com operador, `antes` e `depois` (§7).

Itens da lista:
1. SDK só no adaptador: a reserva é um segundo `OpenAICompatAdapter` e a ferramenta de avaliação usa o mesmo. Garantido (§1, §8).
2. Perfil: herdado. Garantido.
3. Prompt: não se aplica.
4. Schema com caminho de erro: garantido.
5. Timeout, retry e limite de custo por escola:
   - O timeout e o retry da X6 se estendem à reserva, que tem `ResilientAdapter` próprio.
   - O teto de segurança só trava a fila de lote.
   - O não corte do uso interativo é desvio declarado da 30.8, pela D40 (§11).
   - Está registrado, então aceito.
6. Registro por chamada: garantido (§3, uma linha por chamada, com custo, provedor, tokens e `pela_reserva`). O custo da interrompida leva o teto da tarefa (D14).
7. Teste sem provedor pago: garantido. Os cenários usam `FakeAdapter` com `provedorId` distintos. A ferramenta de avaliação é manual, e nenhum teste a executa contra a rede.
8. Fila, idempotência e reinício: `JobAdiadoError(orcamento)` não consome tentativa, e o lote volta a `pendente`. A contagem por `count(distinct execucao_id)` e a soma por chamada sobrevivem ao reenvio do job.
9. Entrega pendente: não se aplica, nada muda.
10. O agente sabe parar:
    - O teto da tarefa já existe desde a X6.
    - Com a reserva, uma execução pode fazer principal, repetição, modelo menor, reserva e repetição na reserva.
    - A Tech Spec não declara o máximo de chamadas por execução (ver recomendação).

Bloqueantes:
- Tech Spec §5 (A chamada, ramos (1) e (2)) e `cenarios.md` §1, linhas RF2 e RF4. O Tutor leva texto de aluno, e a regra 20.13 e a D62 têm veto. O envio para a reserva tem dois caminhos distintos: "sem vaga" (1) e "queda" (2). Os cenários que provam que o Tutor não chega à reserva fora da lista só exercitam o caminho da queda ("principal fora" e "disjuntor aberto"). O caminho de 429 e `sem_vaga` só é testado com tarefa genérica e balde cheio, sem o Tutor. Se `elegivel()` for aplicado só no ramo (2), ou o ramo (1) tiver verificação própria, texto de aluno pode sair para um modelo da reserva não aprovado ou sem a categoria `conversa_do_aluno`, e nenhum teste fica vermelho. Correção exigida: acrescentar em `llm-gateway.test.ts`, e na tabela RF2/RF4, o caso "principal sem vaga, `turno_do_tutor` fora de `IA_RESERVA_TAREFAS`: termina `IA_INDISPONIVEL` sem chamar a reserva", com a mutação "pertença à lista só no ramo da queda". Acrescentar também o caso espelho com `gerar_atividade_objetiva` na lista, que vai à reserva pelo ramo (1).

Recomendações:
- §5 e §7c: declarar o número máximo de chamadas por execução somando principal, reserva e repetições (item 10). Um cenário deve provar que a execução para nesse limite, inclusive com os dois provedores falhando.
- §7b e RF4: a regra "só entra em `IA_RESERVA_TAREFAS` com relatório aprovado" é só processo, porque a lista vem de variável de ambiente. Para a função de alto risco (D60), considerar uma trava na subida. Por exemplo, `turno_do_tutor` na lista exigiria uma referência ao relatório, ou um teste de configuração que falhe com o Tutor na lista sem o relatório no repositório.
- §7: "a chave do provedor" no log pode ser lida como a chave de API. Escrever "`provedorId`" e acrescentar um teste de guarda de log sem segredo.
- §8 e RF9: incluir a estimativa de chamadas por professor por mês (item da lista de estimativa), mesmo que seja "zero chamada nova, custo por aluno medido".
- `cenarios.md` RF9: o requisito "aviso uma vez por limiar por mês" não tem cenário. A Tech Spec o deriva em leitura (`aviso: 80|100|null`), então vale dizer isso e testar a virada do mês.
- §3: `entrada` e `saida` só na última linha significa que a primeira saída inválida fica sem conteúdo para depuração. É coerente com a regra 20, mas registrar a escolha.

Arquivos lidos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/prd.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/cenarios.md`

## conformidade-reviewer · 1ª rodada · REPROVADO · 2026-11-20 22:35:04 · `tasks/prd-camada-ia/revisao-spec.md`

VEREDITO: REPROVADO

Caminhos de escrita em Nota: nenhum novo. A F5 não mexe em `Nota`, `Correcao` nem aprovação. A Tech Spec §8 diz que, na reserva, cada tarefa mantém "o mesmo perfil, schema, conferência e aprovação humana de hoje". Os caminhos que já existem não mudam. Todos com autor humano? sim, no que esta spec alcança.

Decisão autônoma sobre aluno: ausente. A spec só troca quem atende a chamada (§1, §7b: "Sem função nova nem autonomia nova"). O teto de segurança (§5) só adia o lote e não decide nada sobre aluno.

Aprovação registrada: ok. Entregas, artefatos e auditoria continuam lendo `execucao_agente` e `entrega`, que não mudam. Confirmei no código: nenhum leitor de `consumo_ia` serve à aprovação. A exceção da D47 continua só no Tutor. Mas ela fica com uma lacuna de garantia, que é o bloqueante abaixo.

Supervisão do tutor: ok no desenho. O registro da conversa (`mensagem_tutor`) não depende do provedor que respondeu. A regra fixa da D36 vem antes de qualquer provedor (§7b), e o Tutor nunca vai ao modelo menor (§5). A lacuna é o modelo que responde sem aprovação, e está no bloqueante.

Autonomia declarada e visível: sim, sem mudança (§7b). Os avisos de orçamento que a coordenação recebe não são saída de IA.

Os outros itens da lista:
- **Item 6 (auditoria):** não muda. Passar a gravar uma linha de consumo por chamada não quebra a consulta "o que a IA gerou, quem aprovou, quando".
- **Item 7 (vigilância):** nada novo. O consumo não tem aluno na Governança nem pessoa na Operação (§4, §7).
- **Item 8 (D55):** não se aplica à produção. As amostras seguem a seção 3 de `docs/avaliacao-de-modelos.md`, que já tirou a devolutiva de discursiva e só avalia a rubrica.
- **Item 9 (D45, D64):** ok. `consumo_ia` não tem coluna de usuário. A Governança soma por função e escola (§4) e a Operação só por escola. O PRD §6 proíbe indicador de professor feito com consumo.

Bloqueantes:
1. **Tech Spec §5 ("A subida"), §7b e §3 (configuração `IA_RESERVA_TAREFAS`), mais `cenarios.md` §1 na linha do RF4.**
   - **O que está errado:** a aprovação da avaliação vale para um par, tarefa e modelo. A configuração guarda só o nome da tarefa. `LLM_RESERVA_MODELO[_<PERFIL>]` é outra variável. Se alguém trocar o modelo da reserva no perfil `rapido`, `turno_do_tutor` continua na lista e um modelo nunca avaliado responde ao aluno.
   - **Por que bloqueia:** a resposta do Tutor é a única saída de IA que chega ao aluno sem aprovação (D47). Essa exceção só se sustenta porque o modelo passou nas amostras (D60, D58, D36). O PRD RF4 e o §8b dizem "o modelo dela passou", mas a §7b deixa isso por disciplina ("só entra … com o relatório aprovado"). O cenário do RF4 tem mutação "—": nenhum teste prova que o modelo é o avaliado. Vale também para a classificação, que também é alto risco.
   - **Correção exigida:**
     - O vínculo vira estrutura, como o preço em `PRECO_DOS_MODELOS`. Por exemplo, uma constante versionada de aprovações `{ tarefa, provedorId, modelo, relatorio (caminho ou sha256), aprovadoEm }`, ou entradas `tarefa@modelo` na lista.
     - A reserva só fica elegível para a tarefa se o provedor e o modelo configurados para o perfil dela batem com uma aprovação registrada.
     - Fora do ambiente local, uma tarefa de alto risco na lista sem aprovação que bata recusa a subida ou deixa a tarefa não elegível.
     - Cenário novo: `turno_do_tutor` na lista, o modelo `rapido` da reserva trocado por um sem aprovação e o principal fora. O turno termina indisponível sem chamar a reserva. A mutação que o derruba é conferir só o nome da tarefa.
     - Mesmo cenário para `classificar_*`.

Recomendações:
- O mesmo vínculo para o principal. Hoje `LLM_MODELO` também só depende de disciplina, como antes. Vale anotar no `TODO.md` ou fazer junto.
- Mostrar na Governança, em português comum, que um agente pode ser atendido por um modelo de reserva e qual. É a transparência que o dossiê (D61) e a AIA vão pedir. Não é exigência do item 5.
- Pedir que a AIA do Tutor, na revisão do RF16, descreva a queda para a reserva e a suspensão do agente na reserva, não só os nomes dos modelos.
- Escola com um único usuário do Assistente: "128 execuções" por função na Governança aponta para a pessoa. Isso já existia antes da F5, mas vale um piso de grupo, nos moldes da D45 revista, no recorte por função.
- Um teste de guarda de que `tools/ia/amostras/` não tem amostra de correção, nota ou devolutiva sobre texto de aluno em discursiva ou redação (D55). Assim a ausência fica escrita e testada (D57).

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/cenarios.md

## tenancy-guardian · 1ª rodada · REPROVADO · 2026-11-20 22:35:34 · `tasks/prd-camada-ia/revisao-spec.md`

VEREDITO: REPROVADO

Tabelas verificadas:
- `configuracao_operacional_escola`: ganha duas colunas (Tech Spec §3). A tabela já tem `escola_id` como PK. Ela não varia por período, então não precisa de `anoLetivoId`.
- `rede`: ganha as mesmas duas colunas. A tabela fica acima do tenant, que é a exceção da operação já declarada. Só a Operação grava nela.
- `consumo_ia`: ganha `pela_reserva` e o índice `consumo_ia_mes_idx (escola_id, em)`. A tabela já tem `escola_id`, e o índice começa por ele. Ela não tem ano letivo, e isso está correto: o consumo é medido por mês civil, não por período letivo.
- `auditoria`: entram `escola.orcamento_ia_alterado` (com a escola) e `rede.orcamento_ia_alterado` (com `escola_id` nulo, como `rede.criada`).
- Ids: todos são UUID, e o `:id` passa pelo `IdPipe` já existente (item 6 garantido).

Queries verificadas:
- `OrcamentoDoMesRepository` (§6): lê pela escola do contexto (`requireEscolaId()`) e acha a rede pela escola. Garantido.
- Teto do lote (§5, `OrcamentoQuery` com `fila`): usa o mesmo repository, no contexto do job. Garantido.
- `GET /v1/governanca/consumo`: a entrada continua sendo só `mes` (`consumoQuerySchema` estrito), sem `escolaId` vindo do cliente (item 3 garantido). A resposta não traz custo nem tokens.
- Rotas `/v1/operacao/*` (§4): `OperadorGuard`, painel `@Unscoped` com justificativa prometida (item 8 garantido). O `:id` no caminho é escolha do operador, não de usuário de escola, como no padrão D76/A0b.
- Medida dos alertas (`orcamento-gauge.ts`, §7c): está implícita. O §1 diz que ela usa "a mesma soma do mês", e o padrão existente é a `EscolaGauge`, que roda uma escola por contexto.
- Camada rede (item 7): não se aplica. A matriz tem `rede.governanca.ler_consumo = 'nunca'`, a rede não tem usuário, e o orçamento da rede é só da Operação.
- Item 5 (não revelar existência): garantido. A sessão de escola nas rotas da Operação recebe 404 com o mesmo corpo da rota inexistente. O `operacao-isolamento.int.test.ts` percorre todas as rotas `@OperacaoRoute` registradas, o que cobre também `GET …/escolas/:id/uso-ia`, que não aparece na lista dos cenários.

Teste de isolamento: presente mas inútil (efetivo só para uma das três cláusulas de escopo do repository novo)

Bloqueantes:
1. Tech Spec §6 e cenários §2, "A soma do mês". O `OrcamentoDoMesRepository` faz três leituras com escopo: a soma de `consumo_ia`, a contagem de alunos ativos em `vinculo` e o valor por aluno e teto em `configuracao_operacional_escola` ou na `rede` da escola. O cenário só remove `eq(consumoIa.escolaId, …)`.
   - Se a cláusula de escola sair da contagem de alunos, o teste não quebra: o cenário não semeia aluno ativo em B.
   - Se a cláusula de escola sair da leitura do valor da escola ou da rede, o teste também não quebra: o cenário não dá a B um valor próprio diferente do de A.
   - Nos dois casos, o orçamento e a porcentagem que a coordenação de A vê, e o teto que decide se o lote de A espera, passam a depender de dado de B sem nenhum teste ficar vermelho.

   Correção exigida: o cenário de isolamento deve semear em B consumo, alunos ativos e valor por aluno próprio, todos diferentes dos de A, com a rede de B diferente da de A. Deve conferir o orçamento e a porcentagem exatos de A, tanto em `GET /v1/governanca/consumo` quanto na decisão do teto. E deve listar a mutação de cada uma das três cláusulas (consumo, vínculo, configuração ou rede) como o que derruba o teste.

Recomendações:
- Há uma contradição sobre a aba Uso da Operação. O §1 diz que o painel usa "a mesma soma do mês" (com escopo); o §6 diz que o painel é `@Unscoped`. Defina qual dos dois vale. O `PainelRepository` já tem três `@Unscoped`, e a regra 10.9 trata a terceira como sinal de desenho errado. Duas formas de não somar mais:
  - estender a consulta `uso()` existente em vez de criar outra `@Unscoped`;
  - fazer `GET …/escolas/:id/uso-ia` rodar no contexto da escola, pelo repository com escopo.
- Escreva no §6 que a `orcamento-gauge` estende a `EscolaGauge` (uma escola por contexto) e não faz uma soma entre escolas.
- A idempotência por `chaveEnvio` dos dois `PUT` não diz onde a chave é guardada. Ela deve ficar presa ao alvo, (escola, chave) ou (rede, chave), para que a mesma chave usada numa rede não devolva o orçamento de outra escola.
- O check `auditoria_escola_nula` (ou equivalente) precisa aceitar `rede.orcamento_ia_alterado` com `escola_id` nulo. Diga isso na tarefa da migration.
- Inclua `GET /v1/operacao/escolas/:id/uso-ia` e os dois `PUT` novos na lista `ROTAS_DO_PAINEL` de `apps/api/test/registered-routes.ts`. É ela que mantém a varredura de 404 completa.

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/apps/api/src/operacao/painel/painel.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/apps/api/test/operacao-isolamento.int.test.ts

## privacy-guardian · 1ª rodada · REPROVADO · 2026-11-20 22:35:39 · `tasks/prd-camada-ia/revisao-spec.md`

VEREDITO: REPROVADO

O desenho está quase todo coberto. Ficou um furo: a lista de compartilhamento pode deixar de mostrar a reserva quando o worker cai no meio de uma chamada a ela.

Campos pessoais tocados: `consumo_ia.provedor` e `consumo_ia.aluno_id`, que já existem (§7). A coluna nova `consumo_ia.pela_reserva` não é dado de pessoa. O operador Turmma aparece na auditoria de `escola.orcamento_ia_alterado` e de `rede.orcamento_ia_alterado`. Nenhum campo novo de aluno ou de professor, e nenhum campo proibido para aluno.

Fora da tabela de dados do docs/lgpd.md: nada, se a tarefa fizer o que a §7 promete: a linha de `consumo_ia` passa a citar a reserva e entra a linha do orçamento de IA, com finalidade e retenção no PRD §8. A linha 99 do `docs/lgpd.md` tem de ser reescrita de qualquer forma (ver o bloqueante).

Autorização por objeto: ok.
- As rotas da Operação ficam atrás do `OperadorGuard`. A sessão de escola recebe 404 com o mesmo corpo do id inexistente (cenários §2), e o `PUT` de id inexistente responde `NAO_ENCONTRADO` (§4).
- `GET /v1/governanca/consumo` lê a escola do contexto, e o teste com a escola B semeada está nos cenários §2.
- Os DTOs da §4 são estritos. A coordenação recebe sem custo e sem tokens, com teste de contrato (RF12).

Logs: limpos no desenho. Os três eventos novos levam ids, códigos e o provedor (§7). Na §7, "a chave do provedor" quer dizer o `provedorId`, e não a `LLM_RESERVA_CHAVE_API` (ver recomendações).

Auditoria: presente onde a regra exige. A mudança de orçamento é auditada com `antes`, `depois` e o operador, sem segunda auditoria na mesma `chaveEnvio` (§7 e §7c, cenários RF7 e §3). Não há leitura de dado de aluno por coordenação ou rede, nem exportação, nota, permissão ou aprovação nova.

Envio externo:
- O que vai à reserva é o mesmo de hoje, e só nas tarefas de `IA_RESERVA_TAREFAS`.
- Para onde: um suboperador com a mesma conferência da D62. Ela é feita por provedor e pelas categorias das tarefas da lista, e continua exigindo Brasil, treinamento vedado e alcance para todas as escolas (§5, RF1 e RF2).
- Registro: uma linha de consumo por chamada, com `provedor = IA_RESERVA_PROVEDOR_ID` e `pela_reserva`. O teste novo em `arquivo-do-titular.int.test.ts` (RF5) prova que a reserva entra na lista de compartilhamento do aluno.
- A avaliação manda só amostras sintéticas aos finalistas, à mão e fora da esteira (§8, RF13 e RF14).
- Falha: o caso da execução interrompida, no bloqueante.

Seed/fixture: sintético. As amostras são sintéticas, as saídas brutas ficam no repositório e a chave fica fora dele (§8, RF14). Nenhum cenário chama provedor pago.

**Pergunta de fechamento.** Hoje o código responde por onde passou o dado de um aluno pelo rastro `consumo_ia` e `execucao_agente`, com o provedor gravado em cada linha. Com a reserva, deixa de responder no caso descrito abaixo.

Bloqueantes:

1. **Tech Spec §3, a frase "A regra fixa e a interrompida não mudam."**
   - **O que está errado.** A linha estimada da execução interrompida é montada por `consumoEstimadoDaInterrompida` (`packages/core/src/ia/consumo.ts:70`) e gravada em `apps/api/src/ia/consumo.repository.ts:51`. Ela grava o provedor do adaptador configurado, que é o principal.
   - **O cenário.** O principal cai e passa a chamada à reserva, como manda a §5. O worker morre durante a chamada à reserva. A conversa ou o material do aluno já saiu para a reserva, mas o rastro tem só o principal: a linha `falhou` dele e a estimada.
   - **A consequência.** A lista de compartilhamento do titular (art. 18, VII) não mostra a reserva. Isso contradiz a linha 99 do `docs/lgpd.md` ("superestima o custo e o destino, nunca os subestima") e a regra de negócio do PRD §6.
   - **Correção exigida.**
     - A §3 diz como a interrompida registra a reserva. Uma forma: quando a reserva estava elegível para a tarefa, a varredura e a reentrega gravam também uma linha estimada com o provedor da reserva e `pela_reserva = true`. Outra forma: a linha da reserva é gravada antes do envio a ela.
     - A linha 99 do `docs/lgpd.md` passa a dizer isso.
     - Os cenários §1 (RF5) ganham este caso: interrompida com a reserva elegível, e o compartilhamento do aluno lista o suboperador da reserva. O teste fica vermelho se a estimada usar só o destino do principal.

Recomendações:
- **§7, "o que vai para log".** Escrever `provedorId` em vez de "a chave do provedor", para não ser lido como `LLM_RESERVA_CHAVE_API`. Confirmar que a nova chave segue o mesmo tratamento da `LLM_CHAVE_API` em `packages/core/src/config/llm-config.ts` e entra na guarda de segredo.
- **Auditoria do orçamento vista pela escola.** `escola.orcamento_ia_alterado` fica na auditoria da escola com os valores em micros. Se a coordenação lê essa auditoria, ela passa a ver reais, contra o RF12 e a D40. Não é dado pessoal, mas vale fechar: tirar a ação da leitura da coordenação, ou levar só a porcentagem.
- **Suboperador novo.** AWS Bedrock ou Magalu como reserva é suboperador novo da escola, que é a controladora. A D37 revista ou o runbook deve trazer o aviso às escolas antes de a reserva entrar no caminho, e não só o cadastro em `ops:suboperador`.
- **§8 e RF13.** Dizer de forma explícita que o lote retido da classificação (`docs/aia/ouro-retido/classificacao-retido-1.json`) não traz trecho de material licenciado de terceiro, porque ele vai a provedor sem contrato durante a avaliação (D5).

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/packages/core/src/ia/consumo.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/packages/core/src/ia/soberania.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/apps/api/src/ia/consumo.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/packages/core/src/titular/compartilhamento.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/docs/lgpd.md (linha 99)

## test-engineer · 1ª rodada · REPROVADO · 2026-11-20 22:37:22 · `tasks/prd-camada-ia/revisao-spec.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- Os 16 RFs do PRD (§5) e os 8 casos de borda (§7).
- Isolamento das cinco rotas da §4 e das duas leituras escopadas: a soma do mês e os alunos ativos.
- Rotas novas na escola sem ano letivo em curso. A contagem de alunos ativos com um vínculo encerrado e outro aberto, e com vínculo do ano anterior.
- Corrida do `PUT`, com chaves diferentes e com a mesma `chaveEnvio`, em ordem forçada.
- Ordem da degradação (espera, modelo menor, reserva) e cada tipo de queda que passa à reserva.
- Teto do lote no limite exato e na virada do mês.
- Avisos da coordenação a 80% e 100%.
- Alertas novos da §7c, com runbook.
- Carga com controle negativo.
- Nenhum provedor pago: os cenários usam `FakeAdapter` e a avaliação roda fora da esteira.

**Cobertos:**
- RF1: subida sem suboperador vigente, e conferência corrigida sem reiniciar.
- RF2: categoria faltando na reserva, e o Tutor fora da lista.
- RF3: disjuntor aberto; sinal já abortado; balde próprio da reserva; repetição na reserva.
- RF4.
- RF5: uma linha por chamada; provedor da reserva no arquivo do titular; `count(distinct)`.
- RF6: conta com `ceil`, e a interrompida com o teto.
- RF7: precedência escola sobre rede.
- RF8: mês civil de São Paulo, e vínculo encerrado contra vínculo aberto.
- RF9: Tutor e ferramenta acima de 100%.
- RF10: adiamento acima do teto; `sem_orcamento` e `sem_aluno_ativo` no lote.
- RF12: contrato sem custo nem tokens.
- Isolamento da soma, do teto, da Operação (3 das 4 rotas) e da coordenação.
- Corrida do `PUT` da escola, com o `WriteBlockTrigger`.
- Carga com controle negativo (`IA_RESERVA_TAREFAS` vazia).
- Adaptador falso em todos os cenários.

**Bloqueantes:**

1. **Nenhuma rota nova tem cenário na escola sem ano letivo em curso** (Tech Spec §4, §5 "Alunos ativos"; cenarios.md §1 RF8 e RF11). A regra da aba Escolas conta zero sem ano `em_curso`, então isso cai na borda do PRD §7 "montagem, virada do ano letivo".
   - Exigido, para `GET /v1/operacao/uso-ia`, `GET …/escolas/:id/uso-ia` e `GET /v1/governanca/consumo`: `situacao = sem_aluno_ativo`, `porcentagem` nula, `aviso` nulo e os reais visíveis à Operação.
   - Exigido, para o `PUT …/orcamento-ia`: grava, porque o orçamento não depende de ano.
   - Exigido, na contagem: o aluno com vínculo não encerrado do ano anterior não conta, e o aluno em duas turmas do ano conta uma vez. Mutações: tirar o filtro `ano.situacao = 'em_curso'` e tirar o `distinct`.

2. **Isolamento dos alunos ativos sem teste** (Tech Spec §6; cenarios.md §2). Só a soma de custo tem caso. Se a cláusula de escola sair da contagem de alunos, nenhum teste fica vermelho.
   - Exigido: A com 100 alunos e B com 900; o orçamento de A conta 100.

3. **`GET /v1/operacao/escolas/:id/uso-ia` não tem cenário nenhum** (Tech Spec §4; cenarios.md §1 RF11 e §2 "A Operação").
   - Faltam: os 12 meses anteriores; a sessão de coordenação recebendo 404; o id inexistente com `NAO_ENCONTRADO`.
   - A Tech Spec também não diz que número de alunos ativos e que valor por aluno valem para um mês passado. A §5 só fala na "contagem de hoje", e com isso a porcentagem histórica sai errada.
   - Exigido: definir essa regra e escrever o cenário dela.

4. **Bordas "sem aluno ativo" e "sem valor nem na rede" sem cenário nas leituras** (PRD §7; cenarios.md §1 RF11 e RF12). Hoje só o teto do lote (RF10) cobre esses dois estados.
   - Exigido, em `uso-ia`: `situacao`, `origemDoValor`, reais presentes e porcentagem nula.
   - Exigido, em `governanca/consumo`: sem porcentagem e sem aviso.

5. **O aviso da coordenação (RF9) não tem cenário de API** (Tech Spec §4, campo `aviso: 80|100|null`; cenarios.md §1 RF9). As duas linhas de RF9 testam só a medida no Grafana e o "nada é cortado".
   - Exigido: a 79% o aviso é `null`, a 80% exatos é `80`, a 100% é `100`, e no mês seguinte volta a `null`.
   - Mutação: trocar `>=` por `>`.

6. **RF6, "preço novo vale só para as chamadas seguintes", sem cenário** (PRD §5 RF6 e §7 "Preço sobe no meio do mês"; Tech Spec §2, `vigenteDesde`).
   - Exigido: duas vigências; a chamada anterior e a posterior gravam cada uma o seu preço; o mês soma as duas; a linha antiga não muda.
   - Mutações: usar sempre o último preço; recalcular o custo na leitura.

7. **Cláusulas da subida sem cenário** (Tech Spec §5 "A subida"):
   - Modelo da reserva sem preço (inclusive `LLM_RESERVA_MODELO_<PERFIL>`) recusa a subida.
   - Nome fora de `TAREFAS_DE_IA` na lista recusa a subida.
   - O cenário de RF6 (cenarios.md linha 24) cobre só o modelo principal.

8. **Degradação e queda incompletas** (Tech Spec §5 "A chamada", itens 1, 2 e 4; PRD §7 "Principal e reserva fora juntos"). Faltam:
   - Com modelo menor disponível e reserva elegível, a chamada vai ao menor e não à reserva. Mutação: reserva antes do menor.
   - `IA_INDISPONIVEL` de servidor ou conexão passa à reserva.
   - `IA_TEMPO_ESGOTADO` com o sinal vivo passa à reserva. Hoje só existe o caso negativo, do sinal já abortado.
   - O 429 que sobra da repetição vale como "sem vaga".
   - A reserva é tentada uma vez só.
   - Reserva elegível que também falha: o interativo termina indisponível e o lote é adiado.
   - "Provedor de IA fora" dispara para os dois provedores, com rótulo próprio.

9. **A linha da chamada do principal que caiu antes da reserva** (PRD §6 "superestima, nunca subestima"; RF5 "cada chamada com o seu custo"; Tech Spec §3).
   - A Tech Spec não diz com que tokens e custo fica a linha do principal que estourou o prazo ou caiu por conexão. Também não há cenário da troca de modelo (menor) com o preço de cada um.
   - Exigido: definir a regra e escrever o cenário, com duas linhas, provedor e preço de cada uma, e custo nunca zero no prazo esgotado.

10. **Mutação que não derruba, em RF2** (cenarios.md linha 13). O principal exige todas as categorias de `TASK_CATALOG` (`categoriasEnviadasPelasTarefas()` em `packages/core/src/ia/soberania.ts`), e elas incluem `conversa_do_aluno`. Com a mutação "exigir só as categorias do principal", a reserva continua recusada e o teste continua verde.
    - Exigido: um controle positivo, com reserva só de `material_da_escola` e lista só `gerar_atividade_objetiva` sendo conferida.
    - Mutações nomeadas: "exigir as de todas as tarefas" (o controle positivo derruba) e "não exigir categoria" (o caso negativo derruba).

[… 51 linhas cortadas]

## infra-guardian · 1ª rodada · REPROVADO · 2026-11-20 22:37:50 · `tasks/prd-camada-ia/revisao-spec.md`

VEREDITO: REPROVADO
Caminho quente tocado: IA, fila, migration
Rate limit: ok
Fila e prioridade: ok
Concorrência: corrida em techspec §4 e §7c, na idempotência e na auditoria do `PUT …/orcamento-ia`
Índice e paginação: ok
Degradação de IA: ok
Migration: compatível
Métrica e alerta: ok
Bloqueantes:

1. **Techspec §4 ("O `PUT` é idempotente pela `chaveEnvio`"), §3 e §7c ("Corridas de concorrência"); cenários §3, linha 2.**
   - **O que está errado.** A §3 não diz onde a `chaveEnvio` fica gravada. Não há coluna nova em `configuracao_operacional_escola` nem em `rede`. A `auditoria` não tem chave única (`packages/core/src/db/schema/auditoria.ts`). A Operação não tem nenhum mecanismo de idempotência hoje (`apps/api/src/operacao/painel/painel.repository.ts`). Com isso, a "conferência da chave" do cenário só pode ser o padrão "busca, verifica, grava".
   - **O mesmo vale para o `antes` da auditoria.** Ele é lido antes do `on conflict … do update`. Com dois `PUT` concorrentes, os dois leem o mesmo `antes`, e o registro do segundo fica errado.
   - **O cenário fica incompleto.** O teste com chaves diferentes só exige "duas auditorias", não que o `antes` do segundo seja o `depois` do primeiro. O caminho da rede é um `UPDATE` sem `on conflict` e tem a mesma lacuna.
   - **Correção exigida.** Declarar na §3 onde a chave mora, com restrição ou comparação atômica. Exemplos:
     - uma coluna `orcamento_ia_chave_envio uuid` na linha da escola e na da rede, comparada dentro do mesmo `UPDATE … RETURNING`;
     - ou uma tabela com `unique (escola_id|rede_id, chave_envio)`.
   - **E fixar a ordem dentro de uma só transação:** garantir a linha, `select … for update`, conferir a chave, ler o `antes`, gravar, auditar.
   - **Nos cenários §3:** acrescentar a asserção "`antes` do segundo = `depois` do primeiro" e o mesmo par de corridas para `PUT …/redes/:id/orcamento-ia`.

2. **Techspec §3 ("A regra fixa e a interrompida não mudam") e §5 (2), a queda passando à reserva.**
   - **O que está errado.** A linha estimada da execução interrompida usa o destino do adaptador configurado, que é o principal (`consumoEstimadoDaInterrompida`, `packages/core/src/ia/consumo.ts`, e `ConsumoRepository.registrarEstimada`).
   - **O que acontece.** Se o worker morre ou o job é reentregue durante a chamada à reserva, a linha grava o provedor e o preço do principal. A lista de compartilhamento do aluno perde o suboperador que de fato recebeu o conteúdo (RF5, art. 18, VII). E o custo pode ficar abaixo do real se a reserva for mais cara, o que contraria a D14 ("superestima, nunca subestima").
   - **Correção exigida.** Antes de chamar a reserva, gravar na execução uma marca de que ela foi à reserva. A linha estimada lê essa marca e usa o provedor e o maior preço. A alternativa é a estimada da tarefa em `IA_RESERVA_TAREFAS` com reserva elegível gravar as duas linhas, principal e reserva.
   - **Teste.** Criar um cenário de integração "interrompida durante a chamada à reserva", que exija o provedor da reserva no compartilhamento e o custo pelo maior preço.

Recomendações:
- **Volume das somas (§7c, §13).** Pedir o `EXPLAIN (ANALYZE, BUFFERS)` com o volume de um ano da maior escola, cerca de 1,8 milhão de linhas, para três consultas:
  - `GET /v1/operacao/escolas/:id/uso-ia`, que soma 12 meses;
  - a soma do mês no lote;
  - `porFuncao` com `count(distinct execucao_id)`, que segue pelo `consumo_ia_funcao_idx` sem `execucao_id` nem tokens no índice e lê a tabela. Considerar incluir `funcao` no `include` do `consumo_ia_mes_idx`.
- **Migration do índice (§3).** Dizer, como a 0064, que o `consumo_ia_mes_idx` sai sem `concurrently` por causa da transação do `migrar`, com o `lock_timeout` de 5 s e deploy fora do horário letivo. E que, com volume de produção, ele vai para uma migration à parte com `concurrently`.
- **Tokens por minuto da reserva (§7c, cenários §5).**
  - Fixar o piso contratado de `LLM_RESERVA_TOKENS_POR_MINUTO` em `docs/infra.md` 5.4 e o valor dele em `infra/carga.env`.
  - Dizer se a fase `sala` roda com a reserva ligada, porque o transbordo do balde cheio do principal muda o resultado dela.
  - Acrescentar à fase `reserva` o caso de balde cheio no pico, além da queda.
- **Medida da chamada à reserva (§5).** Dizer que ela passa pelo mesmo `chamarModelo`, com o rótulo `provedor` da reserva, para ter latência e erro. Hoje só aparece `ia.degradacao{degrau="reserva"}`.
- **Contador do lote adiado (§7c).** Criar um contador para o adiamento por orçamento, que hoje só está no log `ia.lote.adiado_pelo_orcamento`.
- **Runbook do teto (§7c).** O lote adiado pelo teto vai disparar também "Classificação do material atrasada". O parágrafo de `uso_do_teto` deve citar esse alerta.
- **Ultrapassagem do teto (§5).** Registrar que o teto pode ser passado por no máximo as 2 vagas de lote por escola que conferem ao mesmo tempo, porque a conferência é leitura sem trava. É aceitável para um teto de segurança, mas tem de estar escrito.
- **Reserva que ninguém chama (§13).** A saúde da reserva só aparece quando ela é chamada, e `ia.reserva.conferida` cobre o contrato, não o provedor de pé. Registrar como risco.

O arquivo auditado é `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/techspec.md`, com os cenários em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/cenarios.md`.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-20 22:38:13 · `tasks/prd-camada-ia/revisao-spec.md`

VEREDITO: REPROVADO
Escopo: respeitado. Todos os RFs do PRD (RF1 a RF16) têm onde morar, e a Tech Spec não traz nada além do PRD.
Aderência à Tech Spec: divergência em §4, §5 e §6 da Tech Spec e em §1 e §4 dos cenários. A spec é incoerente consigo mesma em três pontos e com o código que já existe em um.
Portão local: não se aplica, porque é revisão de spec e ainda não há código. O `conferir` respondeu "nunca passou nesta árvore", o que é o esperado nesta fase.

**O que verifiquei**

Escopo contra o PRD:
- Fica implícito como a Operação vê os meses anteriores (bloqueante 3).
- A coordenação recebe o aviso no Painel, como o PRD pede.
- A §5 responde às perguntas 1 a 3 do PRD. A pergunta 4 parte de uma premissa errada: o `SinoDaCoordenacao` já existe (recomendação).

Regra 00:
- Controller sem regra de negócio: garante. A conta é uma função pura em `packages/shared`, e a §9 diz que nenhuma tela calcula porcentagem.
- Repository único no banco: garante para o lado da escola (`OrcamentoDoMesRepository`). Para a leitura entre escolas da Operação, fica implícito (bloqueante 1).
- Nada demorado em request: garante, pelo índice cobridor. A carga é do `infra-guardian`.
- DTO explícito: garante (§4 e §7).
- Contrato em `packages/shared`: implícito. Só `orcamento-de-ia.ts` está listado.
- Erro tipado: garante. `IA_ORCAMENTO_ESGOTADO`, `NAO_ENCONTRADO` e `IA_INDISPONIVEL` com `sem_vaga` já existem.

Regra 60:
- Vocabulário: falha (bloqueante 6).
- Ano letivo: implícito, e aceitável. O consumo é série no tempo, sem ano letivo, e o aluno ativo segue a regra da aba Escolas, que conta o ano em curso.
- Vínculo: garante, pelo cenário RF8 (vínculo encerrado não conta).

Reaproveitamento:
- Garante: `LLMGateway`, `ResilientAdapter`, `SoberaniaNaSubida` com `motivosDaD62`, os baldes `provedor:modelo` do `token-limiter`, `PRECO_DOS_MODELOS`, `OrcamentoRepository` e `OrcamentoQuery`, `JobAdiadoError`, `medir-classificacao` e `medir-risco-a-vida`. O Painel já lê `consumoQueryOptions`.
- Não reaproveita a rota `GET /v1/operacao/uso`, que já existe (bloqueante 1).

**Bloqueantes**

1. **§4, §6 e §9, rota de uso da IA na Operação.** Já existe `GET /v1/operacao/uso` (`painelQuerySchema` com ordem `nome|uso`, `PainelRepository.uso`). A spec cria ao lado uma `GET /v1/operacao/uso-ia` com paginação e ordem próprias (`nome|custo`) para mostrar a IA "ao lado da infra" na mesma aba. Com duas listas paginadas em ordens diferentes, a página 1 de cada uma traz escolas diferentes.
   - O teste I1 em `apps/api/test/architecture.test.ts` fixa o `PainelRepository` em exatamente três métodos `@Unscoped` e diz que "um quarto é mudança da spec". A regra 10, item 9, já está no limite de três. A §6 só diz "com `@Unscoped` justificado".
   - A §1 promete "a mesma soma do mês" para quatro leitores, mas a soma do painel é entre escolas, sem escopo, e a do lote é por escola, com escopo. Não podem ser a mesma consulta.
   - Correção exigida: escolher entre estender o `uso` com o grupo IA e acrescentar `custo` a `ORDENS_DO_PAINEL`, ou manter a rota própria com o motivo escrito. Nos dois casos, nomear os métodos novos do `PainelRepository`, registrar a revisão do I1 na própria spec e dizer como o painel conta alunos ativos e soma o mês de 25 escolas por página.

2. **§4 e §7c, `chaveEnvio` do `PUT` de orçamento.** A spec promete que o `PUT` é idempotente pela `chaveEnvio`, sem segunda auditoria, e o cenário de corrida 2 cobra isso. Mas a §3 não tem onde guardar a chave: o orçamento são só as duas colunas vigentes.
   - Correção exigida: declarar onde a chave fica, com a restrição única. Ou então tirar a chave e auditar só quando `antes ≠ depois`: o `PUT` já é idempotente por definição (D81).

3. **§4 e §5, meses anteriores.** O RF11 pede porcentagem e custo por aluno contra o valor "nos meses anteriores". O `GET …/:id/uso-ia` devolve "os 12 meses anteriores, com os mesmos números", e a Governança aceita `?mes=`. Mas o aluno ativo é "a contagem de hoje", e o valor por aluno não tem histórico. A porcentagem de um mês passado sairia com o número de alunos e o valor de hoje, o que dá um número errado.
   - Correção exigida: dizer o que o mês fechado mostra. Ou só execuções, tokens e reais, sem porcentagem e sem aviso, ou um retrato mensal do número de alunos e do valor. Dizer também o que vem em `orcamento` quando `mes` não é o mês corrente.

4. **§5 da Tech Spec contra o RF10 dos cenários (§1).** A §5 adia o lote quando o custo fica "acima de orçamento × teto ÷ 100", ou seja `>`. O cenário RF10 usa a mutação "`>=` trocado por `>`", ou seja, espera `>=` no limite exato.
   - Correção exigida: fixar um dos dois e alinhar o outro documento.

5. **§2 e §3, custo e provedor da execução interrompida.** O PRD §6 diz que o custo registrado "superestima, nunca subestima". Hoje `consumoEstimadoDaInterrompida` usa o `destino` do adaptador configurado, que é o principal. Se a reserva estava elegível para aquela tarefa e é mais cara, a linha estimada subestima. E o provedor gravado pode não ser o que recebeu o conteúdo (LGPD, art. 18, VII). Além disso, a §3 diz que "a interrompida não muda" e a §2 diz que ela ganha custo.
   - Correção exigida: declarar o preço da linha estimada (o maior entre principal, modelo menor e reserva elegível para a tarefa) e qual provedor ela grava quando a reserva é elegível.

6. **Regra 60, vocabulário (§2, linha `docs/`).** O glossário define "Orçamento de IA" como limite "com aviso antes do corte", o que contradiz o PRD §3 e a D40: nada é cortado. Termos novos ("teto de segurança", "valor de IA por aluno", "provedor de reserva") não entram no glossário. E "reserva" já tem dois sentidos no `llm-gateway.ts`: `ReservaDeTokens` do limitador, e `reservaQuandoInvalida` com o evento `ia.geracao.reserva`, que é a saída substituta da tarefa. A spec acrescenta um terceiro: `ia.geracao.reserva_usada`, `degrau="reserva"`, `pela_reserva`.
   - Correção exigida: pôr `docs/glossario.md` na §2, com a entrada revista e os termos novos. Dar ao conceito novo um nome sem ambiguidade (por exemplo `provedor_de_reserva`, `pelo_provedor_de_reserva` e o evento `ia.geracao.provedor_de_reserva`), ou renomear o sentido antigo.

**Recomendações**

- **RF2.** A spec é tudo ou nada: a reserva que não cobre uma das tarefas da lista sai do caminho para todas. O PRD prova o RF2 tarefa por tarefa. É mais seguro, mas é divergência e deve ser registrada na §11.
- **Unidades da contagem.** O PRD diz "chamadas" e a API diz `execucoes`. Falta dizer se `pelaReserva` conta linhas (chamadas) ou execuções.
- **Módulos que faltam na §2:**
  - `apps/api/src/ia/consumo.repository.ts`, que grava `custo_micros` e `pela_reserva`;
  - `packages/shared/src/operacao/painel.ts` e `packages/shared/src/governanca/governanca.ts`, que são contratos;
  - o repository que escreve em `rede`;
  - o catálogo de ações da auditoria;
  - o motivo `orcamento` do `JobAdiadoError`.
- **Uma unidade só no contrato.** A entrada usa `valorPorAlunoCentavos`, a saída usa `valorPorAlunoMicros` e a coluna guarda micros.
- **Chave do preço.** `PRECO_DOS_MODELOS` deveria usar `provedor:modelo`, como o balde. Dois provedores podem servir o mesmo modelo a preços diferentes.
- **Aviso fora do sino.** O `SinoDaCoordenacao` já existe. Vale dizer por que o aviso de 80% e 100% fica só no Painel.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/apps/api/src/operacao/painel/painel.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/apps/api/test/architecture.test.ts (I1, por volta da linha 234)
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/packages/core/src/ia/consumo.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/packages/core/src/ia/llm-gateway.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/docs/glossario.md (entrada "Orçamento de IA")

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-20 22:44:48 · `tasks/prd-camada-ia/revisao-spec.md`

VEREDITO: APROVADO
Tela vista: não. É revisão de spec, sem código nem fotos. Li o `techspec.md` §9 e o `cenarios.md` §4 como estão agora.
Estados: ok. O `cenarios.md` §4 exige carregando, vazio, erro e com dado em toda tela. O vazio convida: "Nenhuma escola criada ainda." e "Ainda não há mês fechado com retrato.". O erro diz o que fazer: "Tentar de novo" e "Atualize a página". Também há texto para `sem_orcamento` e `sem_aluno_ativo`.
Acessibilidade: ok. O diálogo tem rótulo por campo, erro ligado ao campo por `aria-describedby`, `role=alert` e foco devolvido ao gatilho. Aviso e porcentagem vão com texto, não só com cor. O e2e cobre "o erro anunciado e o foco" (`cenarios.md` §4, E2E).
Chromebook fraco: sem achado novo. A Uso lista escolas, e a lista dos 12 meses é curta. Nenhuma tela calcula porcentagem (§9), o que alivia o cliente.
Celular: ok. Sem rolagem horizontal a partir de 360 px no Uso (cartão), no diálogo, em "Ver meses", no Painel e na Governança. Alvo de 24 px, com 44 px em "Salvar orçamento". Nada só por hover. O e2e roda nos projetos `computador` e `celular`, com fotos `chromebook` e `celular` das quatro telas.
Ação oficial protegida: sim. O diálogo mostra "Antes: R$ 5,00 por aluno, teto 200%. Depois: R$ 4,00 por aluno, teto 200%." antes de "Salvar orçamento". Na rede acrescenta "Muda o orçamento de 3 escolas que usam o valor da rede.". O resultado vem como "Orçamento salvo.", e o 429 diz em quantos minutos tentar de novo.
Bloqueantes: nenhum. Os três da rodada 1 estão resolvidos:
- A confirmação do efeito está em `cenarios.md` §4 (diálogo) e `techspec.md` §9.
- Os 360 px das quatro telas estão em `cenarios.md` §4 ("Celular e acessibilidade") e no E2E.
- A acessibilidade do diálogo e do aviso está no mesmo parágrafo.
Recomendações (novas):
- "Teto de segurança (% do orçamento)" é jargão para o usuário da Operação. Prefira "Limite de uso (% do valor por aluno)", com uma linha de ajuda.
- A tarefa da tela deve fixar em `docs/interface.md` 5 a ordem dos campos e a prévia, para o diálogo não nascer com o rótulo e o "Antes/Depois" divergentes entre rede e escola.
- O `cenarios.md` §4 diz "foco devolvido ao gatilho" mas não menciona Esc para fechar nem foco preso dentro do diálogo. Vale uma linha no e2e. Usar o `<dialog>` ou o componente de diálogo existente já resolve.

## llm-integrator · 2ª rodada · APROVADO · 2026-11-20 22:45:00 · `tasks/prd-camada-ia/revisao-spec.md`

VEREDITO: APROVADO
Perfis usados: sem tarefa nova. Cada tarefa mantém o perfil do catálogo. A reserva usa o mesmo perfil e o modelo da variável `LLM_RESERVA_MODELO` (ou `LLM_RESERVA_MODELO_<PERFIL>`), desde que haja aprovação para o par tarefa e modelo. Nenhuma tarefa subiu de perfil.
Custo estimado por professor/mês: nenhuma chamada nova por professor ou aluno (techspec §8). A reserva custa só a diferença de preço, que o relatório de avaliação traz. A avaliação custa cerca de R$ 30 por finalista (~325 chamadas × ~3.250 tokens), uma vez, e não é por professor. A estimativa por professor/mês continua não calculada e a spec não precisa dela, porque não há chamada nova.
Prompt versionado: sim, sem alteração. Os prompts dos catálogos existentes ficam como estão.
Validação de schema: sim. A saída inválida repete no provedor que respondeu, grava `IA_SAIDA_INVALIDA`, e o caminho de erro está coberto no cenário RF3 (reserva inválida duas vezes).
Aprovação humana no caminho: sim, sem alteração. A reserva mantém o mesmo perfil, o mesmo schema e a mesma aprovação humana (§8). A exceção do Tutor (D47) continua como era.

1) O bloqueante da rodada 1 foi resolvido.
- `cenarios.md` §1, RF2, linha 20, cobre o ramo (1) "sem vaga": a geração vai à reserva e o Tutor termina `IA_INDISPONIVEL`/`sem_vaga` sem chamar a reserva.
- A mutação que derruba o cenário é conferir a elegibilidade só no ramo da queda.
- O ramo da queda está coberto na linha 19.
- O desenho garante o mesmo na `techspec.md` §5: "Uma função só confere a elegibilidade nos dois ramos" e "O Tutor nunca vai ao menor (D36)".

2) As mudanças de desenho não criaram problema novo.
- **`MODELOS_APROVADOS` no lugar de `IA_RESERVA_TAREFAS`:** a elegibilidade agora confere tarefa, provedor e modelo. Os cenários RF4 (linha 21, troca de `LLM_RESERVA_MODELO_RAPIDO` com o principal fora) e RF2 (linhas 17 e 18, controles negativo e positivo da subida) cobrem isso. A guarda da constante (tarefa fora de `TAREFAS_DE_IA`, sem `relatorio` ou `sha256`) tem teste próprio.
- **Máximo de quatro chamadas por execução, duas por provedor:** o limite por execução está declarado (§5) e testado (RF3, linhas 31 e 32). Isso fecha o item 10 do meu "O que verificar" para a camada de reserva.
- **`PRECO_DOS_MODELOS` por `provedor:modelo`:** os cenários RF6 (linhas 48 a 51) cobrem duas vigências, o mesmo modelo em dois provedores, a subida recusada sem preço (principal, reserva e reserva por perfil) e a interrompida com custo maior que zero. Isso responde à estimativa de custo e ao registro completo por chamada.
- **Estimativa (§3):** a regra "entrada contada, saída no teto, preço do modelo que recebeu" superestima, como a D14 manda, e não grava custo zero.
- **Teste:** todos os cenários usam `FakeAdapter` ou adaptador de teste, com `MODELOS_APROVADOS` injetado. Nenhum chama provedor pago.

Bloqueantes: nenhum.
Recomendações (novas, nenhuma bloqueia):
- `techspec.md` §3 diz que a estimativa usa "o preço do modelo que recebeu". `cenarios.md` linha 51 diz "ao maior preço envolvido". Na interrompida o destino pode ser desconhecido, então a segunda redação é a correta. Alinhar a §3 ao cenário.
- `techspec.md` §5 não diz se a chamada que sobra do 429, depois da espera, conta nas quatro chamadas. Uma frase fecha a dúvida, e um cenário curto prova o limite com o 429.

Arquivos lidos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/cenarios.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/prd.md`

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-20 22:45:19 · `tasks/prd-camada-ia/revisao-spec.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A F5 não grava `Nota` em nenhum caminho: nem job, nem seed, nem importação, nem webhook. Os caminhos de hoje seguem com autor humano ("o mesmo perfil, schema e aprovação humana", techspec §8). Todos com autor humano? sim
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Não há fluxo novo de saída de IA para o aluno. A exceção da D47 continua só no Tutor (§7b: "Sem função nova nem autonomia nova").
Supervisão do tutor: ok. A reserva usa o mesmo `chamarModelo`, perfil e schema. "Nenhum prompt muda", e a regra fixa da D36 vem antes de qualquer provedor (§5, §7b). O Tutor nunca vai ao modelo menor.
Autonomia declarada e visível: sim, sem mudança (D9, §7b)

**1) O bloqueante da rodada 1 foi resolvido.**
- `IA_RESERVA_TAREFAS` saiu de `techspec.md` e de `cenarios.md`. Só aparece no histórico do `revisao-spec.md`.
- Techspec §5, "A aprovação": `MODELOS_APROVADOS` traz `{ tarefa, provedorId, modelo, relatorio, sha256, aprovadoEm }`. A reserva só é elegível com uma entrada que bate na tarefa, no provedor e no modelo que ela usa no perfil da tarefa. Trocar o modelo de um perfil tira as tarefas dele do caminho até sair um relatório novo.
- §8 liga o relatório aprovado à entrada na constante. §7b diz "só por aprovação versionada (§5)". §11 registra preço e aprovação versionados.
- `cenarios.md` RF4, linhas 21 e 22: o Tutor aprovado para `(reserva, modelo-x)` com `LLM_RESERVA_MODELO_RAPIDO` trocado para `modelo-y` termina indisponível, sem chamar a reserva, e a D36 responde igual. A mutação "conferir só o nome da tarefa na aprovação" derruba o teste. O mesmo vale para `classificar_secoes`.
- `cenarios.md` RF4, linha 23: há guarda da constante para tarefa fora de `TAREFAS_DE_IA` e para entrada sem `relatorio` ou sem `sha256`.
- `cenarios.md` RF2, linhas 19 e 20: a elegibilidade é conferida tanto no ramo da queda quanto no do "sem vaga".

**2) Nenhum problema novo no meu domínio.**
- A estimativa da interrompida (§3) e a soberania da reserva (§5, "A subida") não criam decisão, nota nem saída nova para o aluno.
- A guarda de D55 nas amostras virou cenário (`cenarios.md` RF13, linha 90).
- A coordenação continua sem custo e sem tokens, e não há métrica por professor (RF12, D45, D64).

Bloqueantes: nenhum

Recomendações (todas novas; não repetem as da rodada 1):
- **Provedor diferente, mesmo modelo (`cenarios.md` RF4, linhas 21 e 22).** O cenário troca só o modelo. A mutação "conferir tarefa e modelo, sem o `provedorId`" passa sem derrubar nenhum teste, embora §5 diga que a entrada bate também no provedor. Falta uma variante com o mesmo modelo e `IA_RESERVA_PROVEDOR_ID` diferente da entrada: deve terminar indisponível, sem chamar a reserva.
- **O `sha256` da entrada (techspec §5 e `cenarios.md` RF4, linha 23).** A spec não diz de que arquivo é esse hash, se do `relatorio.md` ou das amostras. A guarda da constante também não confere se o hash bate com o arquivo apontado. A sugestão é fixar o arquivo e fazer a guarda recalcular o hash, para que a versão aprovada não mude sem uma entrada nova.
- **`aprovadoPor` na entrada de `MODELOS_APROVADOS` (techspec §5).** Hoje "quem aprovou" esse modelo para o Tutor só se responde pelo autor do commit e pela D37 revista. Com o campo, a pergunta "quem aprovou e quando" (regra 70, item 6) se responde pelo dossiê sem precisar abrir o git.

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/revisao-spec.md

## tenancy-guardian · 2ª rodada · REPROVADO · 2026-11-20 22:46:02 · `tasks/prd-camada-ia/revisao-spec.md`

VEREDITO: REPROVADO

Tabelas verificadas: `orcamento_ia_do_mes` (escola_id, mes; pk começa pela escola; série mensal sem `anoLetivoId`, aceito), `configuracao_operacional_escola` (+2 colunas), `rede` (+2 colunas, acima do tenant), `consumo_ia` (+`pelo_provedor_de_reserva`, índice `(escola_id, em)`), `auditoria` (`rede.orcamento_ia_alterado` com `escola_id` nulo: o check `auditoria_escola_ou_operacao_global` já permite entidade `rede` com autor operador).

Queries verificadas: as leituras do `OrcamentoDoMesRepository` (soma do mês, alunos ativos, configuração, rede) com `requireEscolaId()`; `PainelRepository.uso()`, `escolas()` e `redes()` estendidos sem quarto `@Unscoped`, só com id, nome e número; `GET …/escolas/:id/uso-ia` e `PUT …/escolas/:id/orcamento-ia` com `runInContext` da escola `:id`, que é o mesmo padrão do `generateConvite` da A0b; `PUT …/redes/:id/orcamento-ia` com `for update`; `OrcamentoQuery` do lote, com a escola vinda do job; `GET /v1/governanca/consumo` no contexto da coordenação.

Teste de isolamento: presente, mas efetivo só em parte. Os bloqueantes abaixo dizem onde.

Bloqueantes:

1. `cenarios.md` §2, linhas 94 a 102. O bloqueante da rodada 1 só foi resolvido para duas das quatro leituras.
   - **Soma do mês e alunos ativos:** agora são efetivos. Sem a cláusula de escola, A vai a 200% ou a 2%.
   - **"Configuração e rede":** a única coisa conferida é a porcentagem de A.
     - Sem a cláusula de escola, a leitura devolve uma linha qualquer. Se A foi semeada antes, essa linha é a de A, o teste passa e a mutação sobrevive conforme a ordem de inserção.
     - Pela precedência da §3 da Tech Spec (vale a escola, coluna a coluna), se A tem valor próprio a rede nunca é lida. A mutação "ler a rede por outro caminho" sobrevive. Se o valor de A vem da rede, quem sobrevive é a mutação da configuração.
   - **Teto:** os números do cenário se contradizem. B gasta R$ 900 contra R$ 7.200 de orçamento (12,5%), então não está "acima do teto" de 200%, e "o lote de B é adiado" não acontece com esses dados.
   - **Correção exigida:**
     - Conferir os dois lados: a coordenação de A lê 20% e a de B lê o percentual dela. O lote de B passa a ser adiado e o de A segue.
     - Separar duas variantes: uma com o valor e o teto próprios na escola (derruba a mutação da configuração) e outra com as escolas sem valor próprio e o valor só em cada rede (derruba a mutação da rede).
     - Acertar os números para que B fique de fato acima do próprio teto e A abaixo do dela.

2. `cenarios.md` §2, linha 103, e §1 RF7, linha 54. O `PUT` da rede não tem teste de isolamento.
   - A linha "`PUT`" cobre só a escola. O cenário RF7 da rede usa uma rede só.
   - Um `update rede set ia_valor_por_aluno_micros = …` sem `where rede.id = :id` passa em todos os testes listados. Ele muda o orçamento, e com isso o teto do lote, de todas as escolas de todas as redes.
   - **Correção exigida:** incluir em §2 a linha "o `PUT` na rede 1 não muda a rede 2 nem o orçamento vigente das escolas dela", com a mutação "`update` da rede sem `where` do id". O cenário de §2 já tem as duas redes.

Recomendações:
- Tech Spec §3, linha 38: escrever por que `orcamento_ia_do_mes` não tem `anoLetivoId` (série financeira por mês civil, e `alunos_ativos` é uma contagem do ano `em_curso` no momento do retrato), e levar o mesmo para `docs/modelo-de-dados.md`.
- `cenarios.md` §2, linha 105: a mutação "tirar o `runInContext`" quebra o teste por erro de contexto, não por isolamento. Declarar como mutação a retirada da cláusula de escola na leitura dos 12 meses, e deixar explícito que B tem retrato nos mesmos meses, com valores diferentes.
- `cenarios.md` §1 RF11, linha 76: o grupo `ia` de `uso()` é correlacionado por `e.id`, como as subconsultas da infra. Conferir, com A e B, que cada linha traz os números da própria escola, e não só a ordem por custo, que pode empatar com a correlação perdida.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/apps/api/src/operacao/painel/painel.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/apps/api/src/operacao/painel/painel.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/packages/core/src/db/schema/auditoria.ts

## privacy-guardian · 2ª rodada · REPROVADO · 2026-11-20 22:46:26 · `tasks/prd-camada-ia/revisao-spec.md`

VEREDITO: REPROVADO

O bloqueante da rodada 1 só foi corrigido em um dos dois caminhos, e a mudança na conferência da subida abriu um problema novo.

**1) O bloqueante da rodada 1: corrigido pela metade.**
Hoje a linha estimada da execução interrompida é gravada por dois caminhos:
- a reentrega do job, em `apps/api/src/ia/execucao.processor.ts:206-208` (`#aoReentregar`);
- a varredura, em `apps/api/src/ia/varredura-de-execucoes.ts`, no `#encerrarRandas` → `#encerrarRodandas`.

A linha 99 do `docs/lgpd.md` cita os dois. A Tech Spec §3 diz que só "a varredura grava também a linha estimada" da reserva, e o cenário RF5 (`cenarios.md` linha 39) prova só a varredura.

O caso comum é um deploy ou a queda de uma réplica. O job volta pela reentrega bem antes do limite de 300 s da varredura. Nesse caso a reserva some da lista de compartilhamento, e nenhum teste fica vermelho.

**2) Problema novo: a conferência da reserva fora do Brasil.**
A §5 ("A subida") mudou de "a mesma conferência" para "Brasil se alguma leva texto de aluno".
- "Texto de aluno" no código é o `levaTextoDeAluno`. Ele é falso em `relatorio_da_correcao` e em `resumo_do_analista`, que enviam `trabalho_do_aluno`: resposta e resultado de menor de idade.
- Com essa regra, uma reserva fora do Brasil aprovada só para essas duas tarefas passa na subida. Isso manda dado pessoal de menor para fora do país.
- Isso contraria o PRD §3 ("Provedor fora do Brasil, mesmo em tarefa sem dado pessoal: o piloto não usa", decisão sua de 20/11) e o `SoberaniaNaSubida` de hoje (`packages/core/src/ia/soberania.ts:44`), que exige `pais = 'BR'` sempre.
- O cenário RF1 de `pais_fora_do_brasil` não pega o problema se a reserva testada estiver aprovada para o Tutor.

**Os outros pontos que você pediu para conferir estão ok:**
- **`MODELOS_APROVADOS`:** guarda só tarefa, provedor, modelo, relatório, sha256 e data. Nenhum dado de pessoa.
- **`orcamento_ia_do_mes`:** só a escola, o mês, uma contagem, o valor, o teto e a origem. Nenhum dado de pessoa, e tem `escola_id`.
- **Auditoria só quando antes ≠ depois, fora da leitura da coordenação:** ok. A regra 20.10 não exige auditoria de orçamento, e a mudança sem efeito não altera nada.
- **"Provedor de reserva" nos logs:** os eventos levam ids, códigos e o `provedorId`. A `LLM_RESERVA_CHAVE_API` está na guarda de segredo (§2). A recomendação da rodada 1 sobre isso foi atendida.

```
VEREDITO: REPROVADO
Campos pessoais tocados: consumo_ia.provedor e consumo_ia.aluno_id (já existentes); o operador Turmma como autor de escola.orcamento_ia_alterado e rede.orcamento_ia_alterado. Sem pessoa: consumo_ia.pelo_provedor_de_reserva, orcamento_ia_do_mes, as colunas novas de configuracao_operacional_escola e de rede, MODELOS_APROVADOS
Fora da tabela de dados do docs/lgpd.md: nenhum campo de pessoa novo; a linha 99 tem de citar a estimada da reserva nos dois caminhos (§7 promete)
Autorização por objeto: ok (o operador nas rotas da Operação; a coordenação pela escola do contexto; os meses e o PUT em runInContext da escola :id, cenarios.md §2)
Logs: limpos no desenho (§7: ids, códigos e provedorId; nunca a chave)
Auditoria: presente (PUT da escola e da rede com antes, depois e o operador; nenhuma auditoria nova é exigida pela regra 20.10)
Envio externo: o de hoje, ao principal e ao provedor de reserva, só nas tarefas com entrada em MODELOS_APROVADOS que bate em provedor e modelo; registrado por chamada em consumo_ia com provedor e pelo_provedor_de_reserva; FALHA na interrompida pela reentrega e na conferência de país (bloqueantes)
Seed/fixture: sintético (FakeAdapters, MODELOS_APROVADOS injetado, amostras sintéticas, guarda D55)
Bloqueantes:
1. techspec.md §3, "A estimativa", última frase ("a varredura grava também a linha estimada dele"), e cenarios.md §1 RF5, linha 39. A reentrega do job (apps/api/src/ia/execucao.processor.ts:206-208) também encerra a interrompida e grava a estimada, e é o caminho comum depois de deploy ou de queda de réplica. Como está, só a varredura grava a linha da reserva, e a lista de compartilhamento perde a reserva justamente no caso mais frequente. Correção exigida: a §3 diz "a reentrega e a varredura", com o destino da reserva injetado nos dois, junto do DESTINO_DO_ADAPTADOR. O cenário RF5 ganha a variante pela reentrega (job entregue de novo com a execução rodando, tarefa aprovada para a reserva: duas estimadas, e o arquivo do titular lista as duas), com a mutação "estimada da reserva só na varredura".
2. techspec.md §5, "A subida" ("Brasil se alguma leva texto de aluno"), e §11 linha "PRD RF2". A condição solta o país para tarefas que enviam trabalho_do_aluno sem levaTextoDeAluno (relatorio_da_correcao, resumo_do_analista): resposta e resultado de menor iriam a provedor fora do Brasil. Isso contraria o PRD §3 (fora de escopo: provedor fora do Brasil, "o piloto não usa") e o SoberaniaNaSubida atual (packages/core/src/ia/soberania.ts:44, pais = 'BR' sempre). Correção exigida: a reserva exige pais = BR sempre, como o principal ("a mesma conferência", RF1). Cenário novo em soberania.test.ts: reserva com pais fora do Brasil aprovada só para relatorio_da_correcao, e outra só para gerar_atividade_objetiva, ambas não elegíveis, com a mutação "exigir Brasil só com levaTextoDeAluno".
Recomendações:
- §3: a varredura e a reentrega decidem pela configuração do momento em que rodam, e o deploy que interrompe a execução pode ser o mesmo que troca IA_RESERVA_PROVEDOR_ID ou o modelo da reserva. Ou a estimada da reserva olha só o provedor configurado, sem exigir que o modelo bata na aprovação (superestimar o destino é aceito pela D14), ou o runbook manda drenar as execuções antes de trocar provedor. O mesmo vale, desde a X6, para o principal.
- §3 ou §2: citar a classificação de orcamento_ia_do_mes como sem_pessoa em packages/shared/src/privacidade/classificacao.ts. O architecture.test.ts já obriga isso; a spec deveria dizer.
- RF15 e §5: o cadastro de suboperador não confere "contrato permite serviço usado por menor" (regra 20.13); para a reserva nova (Bedrock ou Magalu), isso fica só na conferência manual do RF15. Vale um campo e um motivo no SoberaniaNaSubida, ou ao menos a linha no runbook do cadastro.
```

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/revisao-spec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/apps/api/src/ia/execucao.processor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/apps/api/src/ia/varredura-de-execucoes.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/apps/api/src/ia/consumo.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/packages/core/src/ia/consumo.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/packages/core/src/ia/soberania.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/packages/shared/src/privacidade/classificacao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/docs/lgpd.md (linha 99)

## infra-guardian · 2ª rodada · REPROVADO · 2026-11-20 22:47:09 · `tasks/prd-camada-ia/revisao-spec.md`

VEREDITO: REPROVADO
Caminho quente tocado: IA, fila, migration
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ok
Migration: compatível
Métrica e alerta: ok

**Os bloqueantes da rodada 1**

1. **A `chaveEnvio` do `PUT` e o `antes` lido fora da trava (Tech Spec §5, "O `PUT`"; cenarios §3): resolvido.** A spec tira a `chaveEnvio`. O `PUT` passa a ser uma transação só: garante a linha com `on conflict do nothing`, faz `select … for update`, lê o `antes`, grava e audita só quando `antes ≠ depois`. Os cenários de corrida exigem que o `antes` da segunda gravação seja o `depois` da primeira, e cobrem a escola, o mesmo valor duas vezes e a rede, com a mutação que deixa cada um vermelho.
2. **A estimada da execução interrompida durante a chamada à reserva (Tech Spec §3, "A estimativa"; cenarios §1, RF5): resolvido em parte.** Ver o bloqueante abaixo.

**Bloqueantes**

1. **Tech Spec §3, linha 57, e `cenarios.md` §1, RF5, linha 39: a estimada da reserva está só na varredura.**
   - **O que está errado.** Hoje a execução interrompida grava a estimada por dois caminhos, e os dois chamam o mesmo `registrarEstimada`:
     - a varredura, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/apps/api/src/ia/varredura-de-execucoes.ts:105`;
     - a reentrega do job, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/apps/api/src/ia/execucao.processor.ts:208` (`#aoReentregar`).
   - **O que acontece.** Quando o worker morre, o BullMQ reentrega o job, e por isso a reentrega costuma chegar antes da varredura. A spec diz que "a varredura grava também a linha estimada" da reserva, e o cenário só cobre a varredura. A versão que grava a linha da reserva só na varredura passa em todos os testes. No caminho da reentrega, o compartilhamento do aluno perde o suboperador da reserva, que é o mesmo defeito da rodada 1 (art. 18, VII).
   - **Correção exigida.**
     - Na §3, a regra vale para toda execução interrompida. A linha da reserva sai do próprio `registrarEstimada`, ou de `consumoEstimadoDaInterrompida`, que recebe os dois destinos. Isso vale para a varredura e para a reentrega.
     - Em `cenarios.md` RF5, acrescentar o mesmo cenário pela reentrega: o job entregue de novo encontra a execução `rodando`. Mutação: gravar a linha da reserva só na varredura.

**Recomendações (só itens novos desta rodada)**

- **Preço da interrompida, contradição entre os dois documentos.** O cenário RF6, linha 51 ("ao maior preço envolvido"), contradiz a §3 ("ao preço do modelo que recebeu", uma linha por provedor). Fixar um dos dois. Com duas linhas, cada uma ao preço do seu provedor, a soma já superestima (D14).
- **Prazo da fase `reserva` sem limite que reprove (`cenarios.md` §5, "Queda por prazo").** O critério só manda pôr o número no relatório. O prazo da chamada do `rapido` é 20 s (`LLM_TIMEOUT_MS_RAPIDO`) e o da execução é 60 s (`PRAZO_DA_EXECUCAO_MS`). A reserva sempre tem uns 40 s, então o critério pode ser "zero indisponível no Tutor" e um teto de p95 enquanto o disjuntor não abre.
- **`EXPLAIN` da Tech Spec §7c.** Acrescentar a consulta do `uso()` com `ordem=custo`. Ela soma o mês e o dia de todas as escolas antes de cortar a página, e não só das 25 da página. Ela deve seguir a subconsulta correlacionada por `escola_id`, como a ordem `uso` de hoje (`painel.repository.ts:89`), e nunca um `group by` sobre a tabela inteira.
- **Índice novo de `consumo_ia` (Tech Spec §3).** Com ele, a tabela fica com nove índices, gravados a cada turno do Tutor. Avaliar se `consumo_ia_funcao_idx (escola_id, funcao, em)` fica redundante com o `consumo_ia_mes_idx`, que inclui `funcao`, e removê-lo na contração.
- **Chave do retrato (Tech Spec §3, `orcamento_ia_do_mes.mes`).** Dizer que a chave é o mês de São Paulo, como a soma, com um caso de relógio falso às 21h30 do último dia, horário de São Paulo, em `orcamento-gauge.int.test.ts`.
- **Medida `ia.provedor_de_reserva.conferido` (Tech Spec §5 e §7c).** Ela só deve existir com `LLM_RESERVA_BASE_URL` configurada. Senão o alerta "0 por 10 min" dispara sem parar até o contrato da reserva ser assinado.

Os demais pontos da sua lista não criaram problema novo:

- **A regravação de `orcamento_ia_do_mes`.** É um `upsert` por escola a cada 5 min, e a corrida entre duas réplicas está coberta em cenarios §3.
- **O máximo de quatro chamadas por execução.** O sinal do prazo único da execução limita todas.
- **A conferência do teto.** Ela é só da fila `lote`, e o Tutor não paga a soma do mês.
- **A fase `sala` sem reserva.** Ela continua comparável à X6.

## test-engineer · 2ª rodada · REPROVADO · 2026-11-20 22:47:21 · `tasks/prd-camada-ia/revisao-spec.md`

VEREDITO: REPROVADO

Dos 18 bloqueantes da rodada 1, 17 foram resolvidos. O nº 1 ficou pela metade: falta o PUT numa escola sem ano letivo em curso. As mudanças de desenho abriram 8 lacunas novas. Total: 9 bloqueantes.

**Cenários exigidos:** os da rodada 1, mais o que as mudanças de desenho pedem:
- a aprovação pelo trio tarefa, provedor e modelo;
- o que o `sha256` prende;
- a estimativa da interrompida nos dois caminhos que a gravam;
- o `uso()` sem escopo com o número certo de cada escola;
- os meses no contexto da escola;
- a auditoria "só se antes ≠ depois" na escola e na rede;
- a carga com aprovação injetada.

**Cobertos (rodada 1, conferidos):**
- 1 (contagem, `uso` e `governanca/consumo` sem ano em curso): RF8, RF11 e RF12.
- 2: §2 "Alunos ativos". Na conta, 20% contra 2% com os 900 de B.
- 3: RF11, a linha `…/escolas/:id/uso-ia`, mais §2 "Operação" e "Meses".
- 4: RF11, sem ano e sem valor; RF12.
- 5: RF9 API.
- 6: RF6, duas vigências.
- 7: RF6, os modelos da reserva sem preço; RF4, a guarda da constante.
- 8: RF3, de "IA_INDISPONIVEL de servidor" até "Provedor de IA fora".
- 9: RF5, "Troca para o menor" e "Principal com prazo esgotado".
- 10: RF2, controles positivo e negativo.
- 11: RF7, a precedência por coluna e as três mutações da auditoria.
- 12: §3, com o `antes` do segundo igual ao `depois` do primeiro, e a rede.
- 13: RF7, validação nos limites e 429.
- 14: RF10, limite exato, mais um micro, `mín` e virada.
- 15: as linhas sem mutação que sobram são guardas.
- 16: RF9, alertas e runbook; RF3, o alerta para cada provedor.
- 17: RF12, textos, e §4 das telas com o e2e.
- 18: §5, controle negativo e critério por tipo de queda.

**Bloqueantes:**

1. **O PUT numa escola sem ano letivo em curso continua sem cenário** (sobra do bloqueante 1 da rodada 1). Fica em cenarios.md §1 RF7 e Tech Spec §6, onde o PUT roda em `runInContext`.
   - O risco existe: se o contexto da escola exigir ano letivo, o PUT cai com 500 justamente na montagem da escola.
   - Exigido: escola sem ano `em_curso`; o PUT grava, audita e devolve o orçamento vigente.

2. **A estimativa da reserva só está prevista na varredura.** O código tem dois caminhos que gravam a estimada da interrompida:
   - `varredura-de-execucoes.ts:105`;
   - `execucao.processor.ts:208`, o `#aoReentregar`, quando o job é entregue de novo.

   A Tech Spec §3 diz "a varredura grava também a linha estimada dele", e o cenário RF5 "Interrompida (worker morto)" só exercita a varredura. A mutação "linha da reserva só na varredura" passa: a reentrega grava só o principal, e a lista de compartilhamento perde o suboperador. Exigido:
   - a §3 cobre os dois caminhos;
   - um cenário de reentrega, com as duas linhas e o compartilhamento listando as duas;
   - a mutação "linha da reserva só na varredura".

3. **cenarios.md §1, RF6 "A interrompida leva o custo do teto da tarefa, ao maior preço envolvido", contradiz a Tech Spec §3.** A §3 manda gravar uma linha por destino, "ao preço do modelo que recebeu"; o cenário é do desenho antigo, com uma linha só. Exigido: reescrever o cenário assim: uma linha por destino, cada uma ao seu preço, custo > 0. A mutação passa a ser "preço do principal na linha da reserva".

4. **Nenhum cenário prova que a elegibilidade confere o provedor** (Tech Spec §5 "A aprovação": a entrada "bate no provedor e no modelo"). O RF4 só troca o modelo (`LLM_RESERVA_MODELO_RAPIDO` para `modelo-y`). A mutação "comparar tarefa e modelo sem o `provedorId`" passa. Exigido: aprovação para `(outro-provedor, modelo-x)`, reserva configurada com `IA_RESERVA_PROVEDOR_ID` diferente e o mesmo `modelo-x`, principal fora; o resultado é indisponível, sem chamar a reserva.

5. **O `sha256` da aprovação não diz do que é, e a guarda só confere que ele existe.** Fica em Tech Spec §5 e §8, e em cenarios.md RF4, `modelos-aprovados.test.ts`.
   - Sem saber o que o hash prende, uma entrada com hash inventado passa no teste da constante, e a "aprovação versionada" fica sem prova.
   - Exigido: definir o alvo do hash, o `relatorio.md` ou o arquivo de amostras citado nele.
   - Exigido também: a guarda recalcula o hash e compara. Mutação: "hash qualquer".

6. **A carga e o e2e não têm como aprovar a reserva falsa** (Tech Spec §7c "Carga"; cenarios.md §5 "Controle negativo").
   - `MODELOS_APROVADOS` é constante versionada, e "é injetado no teste" só vale para unidade e integração. O worker real da fase `reserva` precisa de uma entrada para o provedor falso, e o controle negativo precisa tirá-la.
   - A saída fácil seria uma variável de ambiente que aprova modelo. Isso abre em produção o furo que a correção do `conformidade-reviewer` fechou.
   - Exigido: escrever o mecanismo. Por exemplo, uma entrada só para o provedor falso, recusada quando `AMBIENTE=producao`.
   - Exigido também: um cenário provando que a produção recusa a injeção ou a entrada falsa. Mutação: "aceitar em produção".

7. **O `GET /v1/operacao/uso` estendido não tem cenário que confira o número de cada escola** (Tech Spec §4 e §6; cenarios.md §1 RF11 e §2).
   - O `uso()` é uma consulta `@Unscoped` entre escolas, diferente da do `OrcamentoDoMesRepository`.
   - Só a consulta do repository tem testes de mês de São Paulo, de "hoje" às 23h30, de `em_curso` e de `distinct` (RF8).
   - Para o `uso()`, passam estas mutações: somar o mês em UTC; juntar vínculos sem a escola; somar a contagem sem o `distinct`.
   - A asserção de ordem por custo não pega número trocado.
   - Exigido, uma de duas saídas: (a) a Tech Spec diz que o `uso()` usa o mesmo trecho de consulta, com um teste que prova isso; ou (b) cenários no `uso()`, com A e B como na §2. Nesse segundo caso, cada linha traz o seu valor: A 20%, B 12,5%, e os alunos ativos de cada uma. O cenário cobre também a chamada de 23h30 no último dia do mês e o vínculo do ano anterior.

8. **A mutação da linha "Meses" da §2 deixa o teste vermelho pelo motivo errado.**
   - Sem o `runInContext`, `requireEscolaId()` lança e o teste vê um 500, não o retrato de B.
   - A linha também só confere o retrato. A soma de consumo dos meses não é conferida.
   - Exigido, a mutação: "tirar `eq(escola_id)` da leitura do retrato e da soma dos meses".
   - Exigido, a asserção: os 12 meses de A não trazem nem o retrato nem o custo de B, com B no mesmo mês.

9. **"Auditoria só quando antes ≠ depois" não tem cenário no PUT da rede** (Tech Spec §5 "O PUT", "na rede, igual"). O RF7 e a linha "mesmo valor" da §3 só cobrem a escola, e a rede grava por outro caminho (`UPDATE` na `rede`). A mutação "auditar sempre" passa na rede. Exigido: o mesmo PUT da rede duas vezes, uma auditoria só; e dois PUT da rede em paralelo com o mesmo valor, uma auditoria só.

**Recomendações (novas):**
- **RF11, escola sem ano em curso:** a linha cita `aviso` nulo, mas o DTO do `uso` (Tech Spec §4) não tem `aviso`. Alinhar.
[… 11 linhas cortadas]

## revisor-geral · 2ª rodada · REPROVADO · 2026-11-20 22:48:22 · `tasks/prd-camada-ia/revisao-spec.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em §2/§6, que esbarra no código (camadas e escrita da rede), e em §3 contra o `cenarios.md` §1 (a estimativa da interrompida)
Portão local: não se aplica. É revisão de spec e ainda não há código; o `conferir` respondeu "nunca passou nesta árvore", o esperado nesta fase.

**Os seis bloqueantes da rodada 1**

1. **Rota de uso duplicada contra o I1: resolvido.** A spec agora estende o `GET /v1/operacao/uso` com o grupo `ia` e a ordem `custo`, e a leitura entre escolas fica nos três `@Unscoped` do `PainelRepository`. As rotas novas entram em `ROTAS_DO_PAINEL` (§4, §6). Sobra uma lacuna no `PUT` da rede, no bloqueante B.
2. **`chaveEnvio`: resolvido.** O `PUT` faz uma transação com `insert … on conflict do nothing` e `for update`, e só audita quando `antes ≠ depois` (§5). O `cenarios.md` §3 tem as quatro corridas.
3. **Meses anteriores: resolvido.** Entrou o retrato `orcamento_ia_do_mes`. O mês fechado lê o retrato e o mês corrente é calculado na hora; o estado `sem_retrato` foi definido (§3, §4; cenários RF8 e RF11).
4. **`>` contra `>=`: resolvido.** O teto adia só acima (`>`) e o aviso vale a partir do limiar (`>=`). Os cenários RF9 e RF10 batem com a §5.
5. **Custo e provedor da interrompida: parcial.** Ver o bloqueante C.
6. **Vocabulário "reserva" e glossário: resolvido.** Os nomes passaram a `pelo_provedor_de_reserva`, `ia.geracao.provedor_de_reserva`, `degrau="provedor_de_reserva"` e `ia.provedor_de_reserva.conferido`. O glossário entrou na §2, e não sobrou nenhum `IA_RESERVA_TAREFAS`, `pela_reserva` nem `reserva_usada`.

**Bloqueantes novos**

- **A. Tech Spec §2 (linhas 23 e 26), com §3 (linha 46) e §6 (linha 109): o repository está num lugar que o gauge não pode importar.**
  - **O que está errado:** a §2 põe o `orcamento-do-mes.repository.ts` em `apps/api/src/ia/`. Mas quem regrava o retrato e soma o mês para os alertas é o `apps/worker/src/orcamento-gauge.ts` (a medida estende a `EscolaGauge`). A regra `app-nao-importa-app` (`tools/guardas/camadas.cjs:81`) proíbe o `apps/worker` de importar o `apps/api`.
  - **O efeito:** o implementador escreve a soma duas vezes (um segundo jeito de fazer a mesma coisa, que diverge com o tempo) ou cai na guarda. Os gauges que já existem leem por repository do `@educa/core` (`ClassificacaoGauge` usa o `ClassificacaoAtrasadaRepository`).
  - **Correção exigida:** pôr na §2 o `OrcamentoDoMesRepository` (soma do mês, alunos ativos, configuração e rede, retrato) em `packages/core`, para servir a API, o lote e o gauge. Ou dizer em que processo a medida roda, se não for o `apps/worker`.

- **B. Tech Spec §4 (linha 67) e §6 (linhas 109 e 110): o `PUT` da rede faz duas coisas sem escopo que a spec não declara.**
  - **A escrita:** o `PUT` da rede lê com `for update` e grava a linha de `rede`, que fica acima do tenant. Isso exige um método `@Unscoped` novo, que a §6 não declara. O `RedeEEscolaRepository` já tem dois, e a regra 10, item 9, manda olhar o desenho no terceiro.
  - **A contagem:** a resposta traz `escolasQueUsamOValorDaRede`, que é uma leitura entre escolas da `configuracao_operacional_escola`, uma tabela de tenant. A §6 diz que essa leitura só mora nos três métodos do I1. A implementação natural conta dentro da transação do `PUT`, fora do `PainelRepository`, e nenhuma guarda pega.
  - **Correção exigida:**
    - nomear o método que trava e grava a rede, com a justificativa do `@Unscoped`;
    - declarar que a contagem vem do `PainelRepository.redes()`, pelo `PainelService`, depois do commit, ou tirar o campo da resposta do `PUT`. O diálogo já recebe a contagem pelo `GET /v1/operacao/redes`.

- **C. Tech Spec §3, "A estimativa" (linhas 55 a 57), contra o `cenarios.md` §1: a interrompida ainda está incoerente.**
  - **O preço:** o cenário RF6 (linha 51) diz que a interrompida leva o custo "ao maior preço envolvido", ou seja, uma linha só. A §3 e o cenário RF5 (linha 39) gravam duas linhas, cada uma ao preço do seu modelo. O teste escrito pelo RF6 contradiz o do RF5.
  - **Os dois caminhos:** a §3 diz que "a varredura grava também" a linha da reserva, mas a interrompida tem dois caminhos que chamam o `ConsumoRepository.registrarEstimada`. Um é o `VarreduraDeExecucoes`; o outro é o `#aoReentregar` do `ExecucaoProcessor` (`apps/api/src/ia/execucao.processor.ts:208`). Se só a varredura mudar, o job entregue de novo grava só o principal, e a lista de compartilhamento perde a reserva. É o furo LGPD da rodada 1 por outro caminho.
  - **Correção exigida:**
    - alinhar a linha 51 com a §3 (cada linha ao preço do seu modelo);
    - dizer na §3 que a linha da reserva nasce no `registrarEstimada`, nos dois caminhos;
    - acrescentar ao RF5 o cenário da entrega repetida do job, com a mutação "estimada da reserva só na varredura".

**Tamanho:** a Tech Spec tem exatamente 2.000 palavras (`wc -w`), dentro do limite e sem folga.

Recomendações (só as novas):
- O `ORDENS_DO_PAINEL` e o `painelQuerySchema` servem ao `/escolas` e ao `/uso`. Vale dizer se o `/escolas` passa a aceitar `ordem=custo` ou se o `/uso` ganha um schema próprio.
- No dia 1, a mesma linha do Uso mostra a infra do mês anterior (o último dia fechado) e a IA do mês corrente. Vale dizer de que mês a `ordem=custo` soma o custo.
- `GET /v1/governanca/consumo?mes=` de um mês fechado: o `aviso` deveria ser `null`, porque o texto diz "neste mês".
- No `cenarios.md`, linha 29, "a reserva reserva no balde dela" volta à ambiguidade do bloqueante 6. Melhor escrever "o provedor de reserva usa o balde dele".
- Como a Tech Spec está no teto de palavras, cada correção acima precisa tirar palavra em outro trecho.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tools/guardas/camadas.cjs
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/apps/api/src/ia/execucao.processor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/apps/api/src/ia/consumo.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/apps/api/src/operacao/escola/escola.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/apps/api/src/operacao/painel/painel.repository.ts

## privacy-guardian · 3ª rodada · APROVADO · 2026-11-20 22:51:24 · `tasks/prd-camada-ia/revisao-spec.md`

VEREDITO: APROVADO

Os dois bloqueantes da rodada 2 estão resolvidos e não achei bloqueante novo.

**Bloqueante 1 (a estimada da reserva só na varredura): resolvido.**
- Tech Spec §3, "A estimativa" (`tasks/prd-camada-ia/techspec.md:55-58`): a segunda linha agora nasce dentro do `registrarEstimada`, "pela varredura e pela reentrega do job". Cada linha sai ao preço do seu modelo.
- O código atual confirma que esse é o lugar certo. Os dois caminhos já passam pelo mesmo método: a varredura em `apps/api/src/ia/varredura-de-execucoes.ts:105` e a reentrega em `apps/api/src/ia/execucao.processor.ts:208`.
- `cenarios.md` RF5 (`tasks/prd-camada-ia/cenarios.md:42-44`) cobre a varredura, a reentrega e o controle negativo da tarefa sem aprovação. A mutação "estimada da reserva só na varredura" derruba o cenário da reentrega.
- RF6 (`cenarios.md:55`) cobre o preço do modelo certo em cada linha.

**Bloqueante 2 (reserva fora do Brasil com tarefa que envia `trabalho_do_aluno`): resolvido.**
- Tech Spec §5, "A subida" (`techspec.md:91`): a reserva passa pela mesma conferência do principal, com "Brasil sempre, treinamento vedado".
- `cenarios.md` RF1 (`cenarios.md:16`) põe uma reserva com `pais_fora_do_brasil` aprovada só para `relatorio_da_correcao`, e outra só para `gerar_atividade_objetiva`. As duas ficam não elegíveis, e a mutação "exigir Brasil só com `levaTextoDeAluno`" derruba o cenário.
- RF1 (`cenarios.md:15`) cobre também `treinamento_nao_vedado` e o contrato vencido.

**Problema novo no meu domínio:** nenhum bloqueante.
- §5, "A aprovação": a entrada do provedor falso não vale com `AMBIENTE=producao` (RF4, `cenarios.md:26`).
- §7: o log leva só `provedorId` e nunca a chave de API.
- §4: os campos novos de `/v1/operacao/uso` e de `…/uso-ia` são números por escola, sem campo de pessoa, e o schema é estrito (RF11, `cenarios.md:81`).

```
VEREDITO: APROVADO
Campos pessoais tocados: consumo_ia.provedor e consumo_ia.aluno_id (já existentes); a linha estimada do provedor de reserva chega ao aluno pela execução, como a do principal. Nenhum campo novo de pessoa; orcamento_ia_do_mes e as colunas de orçamento são só da escola e da rede.
Fora da tabela de dados do docs/lgpd.md: nada. A linha 99 (consumo de IA por aluno) precisa citar a estimada do provedor de reserva, e a §7 já manda isso, na mesma tarefa.
Autorização por objeto: ok. A Operação fica atrás do OperadorGuard, com 404 igual ao do id inexistente (cenarios.md §2); a coordenação lê só a escola do contexto.
Logs: limpos (ids, códigos e provedorId; nunca a chave de API).
Auditoria: presente em escola.orcamento_ia_alterado e rede.orcamento_ia_alterado, gravada só quando antes ≠ depois.
Envio externo: o de hoje, mais o provedor de reserva, só para a tarefa e o modelo aprovados em MODELOS_APROVADOS, com Brasil e treinamento vedado conferidos na subida. Fica registrado em consumo_ia.provedor, inclusive na estimada da interrompida, pela varredura e pela reentrega, e chega à lista de compartilhamento do titular.
Seed/fixture: sintético (FakeAdapters; amostras escritas por subagente, com guarda contra correção de discursiva).
Bloqueantes: nenhum.
Recomendações:
- §3, "A estimativa" (techspec.md:57): a estimada da reserva entra quando a reserva está só configurada, sem exigir que tenha passado na conferência. Uma reserva recusada (por exemplo, fora do Brasil) pode aparecer na lista de compartilhamento do aluno sem ter recebido nada. Isso segue a D14 (superestimar, nunca subestimar), mas a escola teria de explicar um destino estrangeiro que não houve. Ou se exige a conferência válida no momento, ou se escreve a escolha na linha 99 do docs/lgpd.md.
```

Pergunta de fechamento: sim, o código responde. A lista de compartilhamento do aluno sai de `consumo_ia.provedor`, e agora cobre também a reserva na interrompida, pelos dois caminhos.

## tenancy-guardian · 3ª rodada · APROVADO · 2026-11-20 22:51:52 · `tasks/prd-camada-ia/revisao-spec.md`

VEREDITO: APROVADO

Tabelas verificadas: `orcamento_ia_do_mes` (tem `escola_id`, com pk `(escola_id, mes)`), `consumo_ia` (coluna nova e índice que começa por `escola_id`), `configuracao_operacional_escola` (colunas novas), `rede` (colunas novas, acima do tenant), `auditoria` (`rede.orcamento_ia_alterado` com `escola_id` nulo, que só passa com autor operador e com a entidade na lista sem escola do `auditoria-recorder.ts:64`).

Queries verificadas:
- **`OrcamentoDoMesRepository` em `packages/core` (techspec §2 e §6).** Lê soma do mês, alunos ativos, configuração e rede pela escola do contexto (`requireEscolaId()`). Quem o usa (API, lote, medida) não passa escola por argumento.
- **`PUT` da escola e meses de `GET …/escolas/:id/uso-ia` (§6).** Rodam com `runInContext` na escola `:id`, como o `naEscola`. Só o operador alcança. Coordenação recebe 404 com o mesmo corpo do id inexistente (cenarios §2, linha "Operação").
- **`OrcamentoDaRedeRepository` (§6).** Tem um único `@Unscoped`, só para gravar na `rede`, que não tem `escola_id`. Segue o precedente do `escola.repository.ts:25`. A contagem `escolasQueUsamOValorDaRede` ficou no `redes()` do I1, então não abre leitura nova entre escolas. Não criou problema de isolamento.
- **`uso()` do `PainelRepository` (§6).** Continua um dos três `@Unscoped` do I1 (`architecture.test.ts:235`). Usa os mesmos trechos da soma, correlacionados por `e.id`. Se o trecho comum perder a cláusula de escola, quebra tanto §2 quanto RF11 ("`uso()` com A e B": A 20% e 100 alunos, B 111% e 900 alunos).
- **`GET /v1/governanca/consumo`.** Escola vem do token, sem tokens nem custo na saída.

Bloqueantes da rodada 2:
- **§2 sem as duas escolas, com B abaixo do teto: resolvido** (cenarios §2). A fica em 20%, abaixo do teto. B fica em 111%, acima do teto de R$ 900. Removi mentalmente cada cláusula:
  - Soma sem escola: A soma R$ 1.100, vai a 220% e o lote é adiado.
  - Contagem de alunos sem escola: A cai a 2%, B cai a 100%, e o lote de B deixa de ser adiado, porque o teto é só acima (`>`).
  - Configuração lida sem escola (variante 1): as redes valem R$ 9 e R$ 2, então qualquer linha errada muda pelo menos uma das escolas.
  - Rede lida sem partir da escola (variante 2): uma só rede para as duas derruba uma delas.
- **`PUT` da rede sem isolamento: resolvido** (cenarios §2, linha "`PUT` da rede"). O `PUT` na rede 1 não muda a rede 2 nem o orçamento vigente de B. A mutação é "`update` da rede sem `where` do id". As corridas da rede estão em cenarios §3. Id inexistente devolve `NAO_ENCONTRADO` (RF7).

Teste de isolamento: presente e efetivo.

Bloqueantes: nenhum.

Recomendações:
- **Prender as contagens de `@Unscoped` no `apps/api/test/architecture.test.ts` (techspec §6, cenarios §2).** O §6 promete um único `@Unscoped` no `OrcamentoDaRedeRepository`, mas nenhum cenário trava isso. A casa já trava assim em `architecture.test.ts:235` e `:480`.
  - O `OrcamentoDaRedeRepository` tem exatamente um método `@Unscoped`, com justificativa "acima do tenant".
  - O `OrcamentoDoMesRepository` não tem nenhum.
- **Considerar a gravação da rede no `EscolaRepository` (techspec §2).** O módulo `operacao` já soma sete `@Unscoped` em três repositories, e o `EscolaRepository` já tem o `@Unscoped` da rede "acima do tenant". Pôr a gravação lá evita um quarto repository com exceção no módulo (regra 10, item 9).

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/revisao-spec.md

## infra-guardian · 3ª rodada · REPROVADO · 2026-11-20 22:52:03 · `tasks/prd-camada-ia/revisao-spec.md`

VEREDITO: REPROVADO
Caminho quente tocado: IA | fila | migration
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ok
Migration: compatível
Métrica e alerta: ok
Bloqueantes:
- `tasks/prd-camada-ia/cenarios.md:181` (§5, "Controle negativo"). A spec manda a carga rodar com `AMBIENTE=carga`, e esse ambiente não existe. Os valores aceitos são `local`, `staging` e `producao` (`packages/shared/src/system/status.ts:4`), e `llm-config.ts:74` e `validate-config.ts:51` os validam com `z.enum`. Hoje a carga sobe com `AMBIENTE=local`, tirado do `.env.example` pela lista `ARQUIVOS_AMBIENTE_CARGA` (`tools/ci/compose.ts:118`). Escrito assim, a fase `reserva` não sobe. Se alguém criar um ambiente `carga` para fazê-la subir, ele cai em todas as regras que hoje valem "fora de `local`" (Mailpit recusado no worker, `IA_PROVEDOR_ID` de exemplo recusado, entre outras), e a carga para de ser comparável à X6. Assim, o teste que prova a elegibilidade por aprovação sob carga fica sem um caminho que funcione. Correção exigida: a carga continua em `AMBIENTE=local`. A §5 do `cenarios.md` e a §5 da techspec dizem que a entrada do falso em `MODELOS_APROVADOS` vale fora de `producao`, ou seja, em `local` e `staging`. O cenário de RF4 com `AMBIENTE=producao` continua como está.
Recomendações:
- §2 da techspec: declarar `IA_FALHA_FALSA` em `config/llm-config.ts`, com efeito só no `FakeAdapter`. Dizer também por qual variável a carga liga a reserva falsa: a §2 só lista as variáveis `LLM_RESERVA_*` do `openai_compat`.

O bloqueante da rodada 2 foi resolvido. A §3 da techspec põe a linha da reserva no `registrarEstimada`, e ele é chamado tanto pela varredura quanto pela reentrega. A reentrega é coberta pelo cenário de RF5 (`cenarios.md:43`) e pela mutação "estimada da reserva só na varredura". Não há corrida nova: as duas linhas ficam na mesma transação que encerra a execução, e só quem ganha o `update` condicional grava (`apps/api/src/ia/execucao.processor.ts:205-209`, `apps/api/src/ia/varredura-de-execucoes.ts:102-106`).

O que mais mudou não trouxe problema no meu domínio:
- **`OrcamentoDoMesRepository` em `packages/core`:** fica no escopo da escola. A medida estende a `EscolaGauge`, que já existe em `apps/worker/src/escola-gauge.ts`. As duas réplicas que regravam o retrato estão cobertas pela linha "Retrato regravado por duas réplicas da medida" da §3 do `cenarios.md`. A soma por execução de lote já está coberta pelo `EXPLAIN` da §7c e pelo risco da §13.
- **`OrcamentoDaRedeRepository`:** os dois `PUT` da rede usam `for update`, com corrida na §3 do `cenarios.md`.

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/packages/shared/src/system/status.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tools/ci/compose.ts

## revisor-geral · 3ª rodada · REPROVADO · 2026-11-20 22:53:08 · `tasks/prd-camada-ia/revisao-spec.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em §3, "A estimativa": a frase sobre a interrompida contradiz o PRD, o `docs/lgpd.md` e o código
Portão local: não se aplica, porque é revisão de spec e ainda não há código. O `conferir` respondeu "nunca passou nesta árvore", que é o esperado nesta fase.

**Os três bloqueantes da rodada 2**

- **A. Resolvido.** A §2 põe o `orcamento-do-mes.repository.ts` em `packages/core/src/ia/`, e a API, o lote e a medida leem por ele. O `apps/worker` já importa o `@educa/core` (a `EscolaGauge` usa `CronEscolasRepository`), e o `camadas.cjs` aceita isso.
- **B. Resolvido.**
  - A escrita da rede fica no único `@Unscoped` de um `OrcamentoDaRedeRepository` novo (§6). O `RedeEEscolaRepository` não ganha um terceiro método.
  - A contagem `escolasQueUsamOValorDaRede` sai só do `GET …/redes`, dentro do `redes()` do I1 (§4, linha 68). O teste das três funções do `PainelRepository` (`apps/api/test/architecture.test.ts:239`) continua de pé.
  - A auditoria com `escola_id` nulo cabe no check `auditoria_escola_ou_operacao_global` (`packages/core/src/db/schema/auditoria.ts:67`).
- **C. Resolvido nos dois pontos que exigi.**
  - A linha da reserva nasce no `registrarEstimada`, pela varredura e pela reentrega (§3, linhas 56 a 58). Os dois caminhos já passam por esse método: `varredura-de-execucoes.ts:105` e `execucao.processor.ts:208`.
  - O RF6 (`cenarios.md:55`) agora grava cada linha ao preço do seu modelo.
  - O RF5 (`cenarios.md:43`) tem a reentrega, com a mutação "estimada da reserva só na varredura".

**Tamanho:** a Tech Spec tem 1.995 palavras, dentro do teto de 2.000.

**Bloqueantes**

- **`tasks/prd-camada-ia/techspec.md:55-56` (§3, "A estimativa"): a interrompida aparece com "entrada contada".**
  - **O que está errado:** a frase diz que "a chamada que saiu sem voltar com uso […] e a interrompida gravam entrada contada e saída no teto da tarefa". Para a interrompida, isso não pode ser feito e contradiz três fontes:
    - **O PRD:** a linha 77 diz que "a execução interrompida leva o teto da tarefa".
    - **O `docs/lgpd.md`:** a linha 99 diz "com os dois tetos da tarefa nos tokens", e a §7 manda editar justamente essa linha.
    - **O código:** `consumoEstimadoDaInterrompida` (`packages/core/src/ia/consumo.ts:80`) grava `maximoDeTokensDeEntrada`. A varredura e o `#aoReentregar` só recebem o `InterrompidaEncerrada` do `returning`, sem o prompt, e não têm o que contar.
  - **O efeito:** o `cenarios.md:55` ("o teto da tarefa") segue o código, e a §3 diz outra coisa. É o mesmo tipo de incoerência do bloqueante C, agora no número de tokens. Quem implementa pela §3 inventa onde guardar a contagem da entrada, ou para.
  - **Correção exigida:**
    - Na §3, separar os dois casos. A chamada que caiu grava entrada contada e saída no teto. A interrompida grava os dois tetos da tarefa, uma linha por destino, cada uma ao preço do seu modelo.
    - No `cenarios.md:55`, escrever "os dois tetos da tarefa" e acrescentar a mutação "entrada contada na interrompida".
    - Cabe nas 5 palavras de folga se a frase for reescrita, e não acrescentada.

**Recomendações (só as novas)**

- §2: o `apps/api/src/ia/varredura-de-execucoes.ts` não está na lista, mas hoje só recebe um `destino` no construtor e vai precisar receber também o do provedor de reserva. Vale dizer que o `registrarEstimada` recebe os dois destinos e a `MODELOS_APROVADOS`, ou que o `ia-do-worker.module.ts` os injeta na varredura e no processor.
- §7c e §6: a `EscolaGauge` publica uma métrica por instância, e a spec pede duas (`uso_do_mes` e `uso_do_teto`) e também a regravação do retrato. Com duas instâncias, a soma roda duas vezes por escola a cada 5 min, e não "uma soma" como a §7c diz. Vale dizer se é uma medida só, que estende a base para publicar duas séries, ou duas que dividem a soma.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/docs/lgpd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/packages/core/src/ia/consumo.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/apps/api/src/ia/varredura-de-execucoes.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/apps/api/src/ia/execucao.processor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/apps/worker/src/escola-gauge.ts

## test-engineer · 3ª rodada · REPROVADO · 2026-11-20 22:53:30 · `tasks/prd-camada-ia/revisao-spec.md`

VEREDITO: REPROVADO

Cenários exigidos: os nove bloqueantes da rodada 2, mais o que entrou de novo: o §2 com duas variantes, o `OrcamentoDaRedeRepository`, o `OrcamentoDoMesRepository` em `packages/core` e a reserva sempre no Brasil.

Cobertos:
- **Resolvidos sete dos nove da rodada 2:**
  - `PUT` numa escola sem ano em curso: cenarios.md:63.
  - Estimada da reserva pela reentrega: cenarios.md:43.
  - Preço da interrompida: cenarios.md:42 e :55.
  - Provedor na aprovação: cenarios.md:24.
  - O que o sha256 prende: cenarios.md:25.
  - Números de cada escola no `uso()`: cenarios.md:83, com a ressalva do bloqueante 4.
  - Auditoria do `PUT` da rede com o mesmo valor: cenarios.md:58 e §3:126.
- **Ficaram em aberto dois:** a aprovação do falso (bloqueantes 1 e 2) e a mutação dos meses (bloqueante 6).
- **O que está certo nas mudanças novas:**
  - Reserva sempre no Brasil: cenarios.md:15–16, com a mutação "exigir Brasil só com `levaTextoDeAluno`".
  - O §2 refeito: as duas escolas conferidas nas duas variantes. Cada mutação de soma, de alunos, de configuração e de rede deixa pelo menos uma das duas errada.
  - O `PUT` da rede tem isolamento (§2:113).
  - O aviso fica nulo no mês fechado (cenarios.md:68).

Bloqueantes:
1. **cenarios.md §5:181, "A carga roda com `AMBIENTE=carga`".** Esse valor não existe. `SYSTEM_ENVIRONMENTS` (packages/shared/src/system/status.ts:4) só tem `local`, `staging` e `producao`, e `llm-config.ts:74` valida com `z.enum(AMBIENTES)`. Hoje a carga roda com o `AMBIENTE=local` do `.env.example` (`ARQUIVOS_AMBIENTE_CARGA`, tools/ci/compose.ts:118). Do jeito que está escrito, a fase `reserva` não sobe. Correção: escrever que a carga roda com `AMBIENTE=local`, como hoje. Ou declarar o valor novo na §2 da Tech Spec, com o contrato de status e os testes que ele afeta.

2. **techspec.md §5:78 e cenarios.md:25–26, a entrada do falso em `MODELOS_APROVADOS`.**
   - Nada diz como essa entrada passa no teste da constante (cenarios.md:25). Pela spec, entrada sem `relatorio`, `sha256` ou `aprovadoPor`, ou com relatório inexistente, quebra o teste. Ou o falso tem relatório, ou ganha uma isenção que ninguém escreveu, e a mutação "isentar toda entrada" passaria verde.
   - O cenário de cenarios.md:26 ("a subida com o falso configurado como reserva") esbarra num bloqueio que já existe: `IA_ADAPTADOR=falso` já é recusado em produção (llm-config.ts:129). Por esse caminho, a mutação "aceitar a entrada do falso em produção" deixa o teste vermelho pelo motivo errado.
   - Correção, na §5 da Tech Spec: dizer o que identifica "o falso" (um `provedorId` fixo) e como a entrada dele satisfaz a guarda. Pode ser um relatório sintético versionado, ou uma isenção só para esse `provedorId`, com um teste de que a isenção não vale para outro. No cenarios.md:26: provar a recusa na função de elegibilidade, com `ambiente=producao`, e não pela subida.

3. **techspec.md §3:57, "(só tarefa e provedor)".** A cláusula é nova e não tem cenário. Pela cláusula, a estimada da reserva nasce mesmo quando o modelo configurado da reserva não bate com o aprovado, para o destino ficar superestimado (D14). Uma implementação que exigisse também o modelo, ou a reserva elegível, apagaria o suboperador da lista de compartilhamento, e nenhum teste ficaria vermelho. Correção: no cenarios.md, uma linha em RF5 com a aprovação `(tarefa, provedor da reserva, modelo-x)` e a reserva configurada com `modelo-y`. A interrompida grava as duas estimadas e o compartilhamento lista as duas. Mutação: "comparar também o modelo".

4. **cenarios.md:83, mutação "contagem sem `distinct`" no `uso()`.** O cenário não põe nenhum aluno de A em duas turmas, então a mutação não é alcançada e o bloco não fica vermelho. Correção: um aluno de A em duas turmas do ano, e A continua com 100 alunos ativos.

5. **techspec.md §6:112, "o único `@Unscoped` do `OrcamentoDaRedeRepository`".** A cláusula não tem teste. A guarda de escopo exige o motivo, não a unicidade. O padrão da casa já existe: `PainelRepository` com exatamente três (apps/api/test/architecture.test.ts:235) e `BnccRepository` com um só (:1606). Correção: no cenarios.md §2, uma linha de `architecture.test.ts` dizendo que o `OrcamentoDaRedeRepository` tem exatamente um método `@Unscoped`, com a justificativa. Mutação: um segundo método marcado.

6. **cenarios.md §2:115 (Meses), uma mutação só para duas cláusulas.** "Tirar `eq(escola_id)` da leitura do retrato e da soma dos meses" fica vermelha só pela soma, e a cláusula do retrato nunca se prova sozinha. Pior: com B tendo retrato nos mesmos meses de A, uma implementação que junta os meses num mapa pode manter a linha de A por acaso e passar. Correção:
   - dois blocos, um por cláusula;
   - B com retrato num mês em que A não tem nenhum;
   - a asserção diz que esse mês de A é `sem_retrato`, e que a lista tem exatamente 12 itens.

7. **cenarios.md:58 e techspec.md §4:66, `escolasQueUsamOValorDaRede` com precedência coluna a coluna (§3:46).** A escola com valor próprio e teto nulo usa o teto da rede. Um `PUT` da rede que muda só o teto muda o orçamento dela, e o diálogo escreve "Muda o orçamento de N escolas" (cenarios.md §4:152–153). Correção: definir na §4 se a contagem segue o valor, o teto ou qualquer um dos dois. Em cenarios.md:58, testar os dois casos mistos: valor próprio com teto da rede, e teto próprio com valor da rede. Mutação: "contar só pelo valor" (ou o inverso, conforme a definição).

Recomendações:
- **cenarios.md:55 e :42:** fixar preços diferentes para o modelo do principal e o da reserva. Sem isso, a mutação "preço do principal na linha da reserva" pode passar verde.
- **cenarios.md:83:** a chamada de A às 23h30 do último dia, no mês corrente, precisa de relógio falso. Escrever que o "agora" entra como parâmetro no `uso()` e no `OrcamentoDoMesRepository`, e não vem do `now()` do Postgres.

## infra-guardian · 4ª rodada · REPROVADO · 2026-11-20 22:55:46 · `tasks/prd-camada-ia/revisao-spec.md`

VEREDITO: REPROVADO
Caminho quente tocado: IA
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ausente
Migration: não se aplica
Métrica e alerta: faltando
Bloqueantes:
1. `tasks/prd-camada-ia/cenarios.md:183-186` (§5, "Controle negativo") e `tasks/prd-camada-ia/techspec.md:77-79` (§5, "A aprovação"): com `IA_RESERVA_PROVEDOR_ID=falso`, a reserva da carga fica com o mesmo nome e o mesmo balde do principal.
   - **O que está errado:** o `FakeAdapter` tem `origem = 'falso'`, `envio = SEM_ENVIO_EXTERNO` (sem `provedorId`) e `modeloDoPerfil` fixo em `MODELO_FALSO` (`packages/core/src/ia/fake-adapter.ts:41-47`). O gateway monta o nome do balde a partir de `provedorId ?? origem` (`packages/core/src/ia/llm-gateway.ts:460-463`), e o rótulo `provedor` da medida e do disjuntor sai do mesmo lugar (`llm-gateway.ts:393`, `resilient-adapter.ts:118`). Na fase `reserva`, principal falso e reserva falsa caem os dois em `falso:<MODELO_FALSO>`.
   - **Efeito:** o cenário "Balde cheio no pico" não consegue provar o transbordo, porque a reserva usa o balde que já está cheio e o aluno recebe `sem_vaga`. Ou então os dois limites (`LLM_TOKENS_POR_MINUTO` e `LLM_RESERVA_TOKENS_POR_MINUTO`) disputam o mesmo balde. O "Provedor de IA fora" por provedor também não separa os dois.
   - **Controle negativo:** "um falso sem entrada em `MODELOS_APROVADOS`" não tem como existir. O `FakeAdapter` não carrega o id configurado, então a elegibilidade compara sempre com `'falso'`, e o controle passa em vez de reprovar.
   - **Correção exigida:**
     - O §2 e o §5 da Tech Spec dizem que a reserva falsa recebe a identidade de `IA_RESERVA_PROVEDOR_ID`, e que essa identidade vale para a elegibilidade, o balde, o rótulo e o disjuntor.
     - A carga usa um id diferente do principal (por exemplo `falso-reserva`). A entrada sintética em `MODELOS_APROVADOS` é desse id, e a recusa em `producao` vale para ele.
     - A subida recusa reserva com o mesmo id do principal.
     - Entram dois cenários no `llm-gateway.test.ts`: o nome do balde da reserva é diferente do nome do principal, e a reserva com o id do principal é recusada na subida.
2. `tasks/prd-camada-ia/techspec.md:77-78` (§5, "A aprovação") e `tasks/prd-camada-ia/techspec.md:143` (§7c, "Métrica e alerta"): em produção, a reserva falsa some sem aviso.
   - **O que está errado:** com `AMBIENTE=producao`, a reserva falsa só deixa de ser elegível. Como a reserva falsa não envia nada para fora, ela já nasce conferida (`packages/core/src/ia/soberania.ts:121-122`). Então `ia.provedor_de_reserva.conferido` fica em 1, nenhum alerta dispara, e o operador acredita ter reserva às 10h sem ter nenhuma.
   - **Correção exigida:**
     - A subida recusa `IA_RESERVA_PROVEDOR_ID=falso` (e o adaptador falso na reserva) com `AMBIENTE=producao`, pelo mesmo caminho de `MOTIVO_ADAPTADOR_FALSO_EM_PRODUCAO` (`packages/core/src/config/llm-config.ts:129`), com cenário no teste do `llm-config`.
     - A recusa na elegibilidade continua como segunda trava.

Sobre o bloqueante da rodada 3: está resolvido. A carga roda em `AMBIENTE=local`, que existe em `SYSTEM_ENVIRONMENTS` (`packages/shared/src/system/status.ts:4`) e é o mesmo ambiente das fases de hoje. Os dois bloqueantes acima vieram da correção que trocou a reserva da carga pelo falso.

Recomendações: nenhuma nova.

## test-engineer · 4ª rodada · REPROVADO · 2026-11-20 22:55:57 · `tasks/prd-camada-ia/revisao-spec.md`

VEREDITO: REPROVADO

**Cenários exigidos:** os sete bloqueantes da rodada 3 e as lacunas que as correções abriram, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/techspec.md` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/cenarios.md`.

**Cobertos (os sete da rodada 3):**
1. **`AMBIENTE=carga`: resolvido.** A carga roda em `AMBIENTE=local`, a reserva falsa liga por `IA_RESERVA_PROVEDOR_ID=falso`, e `IA_FALHA_FALSA` só tem efeito no `FakeAdapter` (cenarios §5, linhas 183-186).
2. **A entrada do falso na guarda e a recusa na elegibilidade: parcial.** A função, com o ambiente como parâmetro, recusa em `producao` e aceita em `local` e `staging`, que existe em `SYSTEM_ENVIRONMENTS` (§1 RF4, linha 26). Faltam dois pontos, nos bloqueantes 1 e 2.
3. **A estimada só por tarefa e provedor: resolvido para o modelo.** Aprovação com `modelo-x` e reserva com `modelo-y` grava as duas linhas, e a mutação "comparar também o modelo" está listada (§1 RF5, linha 44). Os preços diferentes nos dois destinos estão nas linhas 42 e 56. O provedor ficou sem cenário: bloqueante 3.
4. **O `distinct` do `uso()`: resolvido.** Um aluno de A em duas turmas conta uma vez e A segue com 100 (§1 RF11, linha 84).
5. **O `@Unscoped` único: resolvido.** `architecture.test.ts` exige exatamente um método no `OrcamentoDaRedeRepository`, com a justificativa, e nenhum no `OrcamentoDoMesRepository` (§2, linha 118).
6. **Os meses numa mutação só: resolvido.** Retrato e consumo agora têm blocos separados, cada um com a sua mutação (§2, linhas 116 e 117). O relógio entra como parâmetro (linha 84).
7. **`escolasQueUsamOValorDaRede` coluna a coluna: resolvido.** Os dois casos mistos contam e a escola com os dois valores próprios não conta (§1 RF7, linha 59). Vale o mesmo para a techspec §4, linha 72. A contagem entre redes ficou sem cenário: bloqueante 4.

Também conferida a correção do `revisor-geral`. A chamada que caiu grava a entrada contada e a interrompida grava os dois tetos (techspec §3, linhas 55-58). Na linha 56 de cenarios.md, as mutações "entrada contada na interrompida" e "preço do principal na linha da reserva" caem com o cenário escrito.

**Bloqueantes:**

1. **cenarios.md §1 RF4, linha 26: a mutação "isentar a entrada do falso da guarda" não fica vermelha.**
   - O cenário só diz que o relatório sintético do falso passa na guarda. Se o código isentar o falso, ele continua passando, então o bloco fica verde com a mutação aplicada.
   - Correção: uma entrada `provedorId = 'falso'` com `sha256` que não bate com o `relatorio.md` sintético, ou com o relatório ausente, quebra o teste da constante.

2. **techspec §5, linhas 77-78, e cenarios §1 RF4, linha 26: a recusa em produção só está provada na função pura, com o ambiente passado à mão.**
   - Nada prova que o gateway ou o `ia-do-worker.module.ts` entregam à elegibilidade o `AMBIENTE` lido da configuração. A mutação "passar `'local'` fixo na montagem" sobrevive.
   - É o buraco que a regra existe para fechar. `IA_ADAPTADOR=falso` já é recusado em produção (`packages/core/src/config/llm-config.ts:129`), mas `IA_RESERVA_PROVEDOR_ID=falso` sobre um `openai_compat` real não é.
   - Correção: um cenário pela montagem real, com `AMBIENTE=producao`, `IA_RESERVA_PROVEDOR_ID=falso`, a entrada do falso em `MODELOS_APROVADOS` e o principal fora, que termina indisponível sem chamar a reserva. A alternativa é a subida recusar essa combinação em `llm-config.test.ts`, como já se faz com `provedor-de-exemplo`.

3. **cenarios.md §1 RF5, linha 45, contra techspec §3, linha 57 ("só tarefa e provedor"): a cláusula do provedor no `registrarEstimada` não tem bloco.**
   - A linha 45 usa uma tarefa sem aprovação nenhuma. Com isso, a mutação "comparar só a tarefa" fica verde.
   - A cláusula decide o que entra na lista de compartilhamento do titular.
   - Correção: uma variante com aprovação para a tarefa, mas com outro `provedorId` (como na linha 24). A interrompida grava só a estimada do principal, e o compartilhamento lista só o principal. Mutação: comparar sem o `provedorId`.

4. **cenarios.md §1 RF7, linha 59: `escolasQueUsamOValorDaRede` foi conferida com uma rede só.**
   - Uma escola da rede 2 que usa o valor da rede não pode contar na rede 1. A mutação "contar sem o filtro da rede" sobrevive.
   - Esse número é o que o diálogo mostra como efeito antes de salvar (cenarios §4, linha 156).
   - Correção: incluir no cenário uma escola de outra rede que usa o valor da própria rede, e conferir as duas contagens.

**Recomendações:**
- Na linha 84 de cenarios.md, listar a mutação "usar `now()` do Postgres". Hoje o cenário a derruba, mas a coluna de mutações não diz.

## revisor-geral · 4ª rodada · APROVADO · 2026-11-20 22:55:59 · `tasks/prd-camada-ia/revisao-spec.md`

VEREDITO: APROVADO

Escopo: respeitado. Esta é a revisão da spec, e ainda não existe código da funcionalidade.

Aderência à Tech Spec: ok. O bloqueante da rodada 3 foi resolvido. Com isso, `techspec.md`, `cenarios.md`, o PRD, a linha 99 do `docs/lgpd.md` e o código atual dizem a mesma coisa:
- **§3, "A estimativa":** são dois casos. A chamada que saiu e não voltou com uso grava a entrada contada e a saída no teto. A interrompida grava os dois tetos da tarefa, uma linha por destino, cada uma ao preço do seu modelo.
- **O que já existia:** o PRD, na §6 ("a execução interrompida leva o teto da tarefa"), e a linha 99 do `docs/lgpd.md` ("os dois tetos da tarefa nos tokens") já diziam isso. O código também: `consumoEstimadoDaInterrompida` em `packages/core/src/ia/consumo.ts:70` grava `maximoDeTokensDeEntrada` e `maximoDeTokensDeSaida`. O `registrarEstimada` que a §3 cita existe em `apps/api/src/ia/consumo.repository.ts:49`.
- **Os cenários batem com a §3:**
  - O RF6 de `cenarios.md:56` prova os dois tetos na interrompida. A mutação "entrada contada na interrompida" derruba exatamente a versão antiga.
  - O RF5 de `cenarios.md:40` prova a chamada que caiu.
  - O RF3 de `cenarios.md:34` ("a estimada do principal e as duas da reserva") cai no caso da chamada que saiu, então também é coerente.
- **Comparar só tarefa e provedor:** a §3 compara só tarefa e provedor para gravar a linha da reserva, e a §5 compara também o modelo para decidir se ela é elegível. É escolha declarada, e é ela que o RF5 de `cenarios.md:44` testa, com a mutação "comparar também o modelo". Não é contradição.
- **As outras correções da rodada 3 não criaram incoerência nova:**
  - O falso por `provedorId = 'falso'`, recusado na elegibilidade em produção (§5 e `cenarios.md:26`), é coerente.
  - A carga em `AMBIENTE=local` (`cenarios.md` §5) é coerente com `SYSTEM_ENVIRONMENTS = ['local', 'staging', 'producao']` em `packages/shared/src/system/status.ts:4`.
  - A contagem de `escolasQueUsamOValorDaRede` é coerente entre a §4 e `cenarios.md:59`.
  - Os testes do `uso()` estão em `cenarios.md:84` e a exceção `@Unscoped` única em `cenarios.md:118`.
- **Tamanho:** a Tech Spec tem 1.999 palavras pelo `wc -w`, dentro do teto de 2.000. O PRD tem 2.000.

Portão local: não se aplica a esta revisão, porque ainda não há código. O `conferir` responde "nunca passou nesta árvore". O carimbo passa a valer na primeira tarefa de implementação.

Bloqueantes: nenhum.

Recomendações:
- **`techspec.md:4`:** o cabeçalho de status ainda diz "com as correções da rodada 1". Atualizar para a rodada em que a spec for aprovada.
- **§3 com a §5:** a linha da reserva na interrompida só confere tarefa e provedor, e por isso não passa pela recusa do falso com `AMBIENTE=producao` que a elegibilidade faz. Se `IA_RESERVA_PROVEDOR_ID=falso` puder subir em produção, a interrompida gravaria uma linha estimada com esse provedor. Vale dizer na §5 se a configuração da reserva falsa é recusada na subida em produção, como já acontece com `IA_ADAPTADOR=falso` (`packages/core/src/config/llm-config.ts:129`).

Arquivos revisados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/cenarios.md`

```
VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: não se aplica (revisão de spec, sem código; o conferir responde "nunca passou nesta árvore")
Bloqueantes: nenhum
Recomendações: techspec.md:4, status preso na rodada 1; §3 com a §5, a linha da reserva na interrompida não passa pela recusa do falso em produção: dizer se IA_RESERVA_PROVEDOR_ID=falso é recusado na subida com AMBIENTE=producao
```

## infra-guardian · 5ª rodada · APROVADO · 2026-11-20 22:57:22 · `tasks/prd-camada-ia/revisao-spec.md`

VEREDITO: APROVADO
Caminho quente tocado: IA, fila, migration
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: ok
Migration: compatível
Métrica e alerta: ok
Bloqueantes: nenhum

Como fecharam os dois bloqueantes da rodada 4:
- **A reserva falsa com o id e o balde do principal.** Está corrigido em techspec.md §5, "A aprovação". A reserva falsa agora usa o id de `IA_RESERVA_PROVEDOR_ID` (`falso-reserva`) e tem balde, rótulo e disjuntor próprios. A subida recusa uma reserva com o mesmo id do principal. Os testes estão em cenarios.md, RF4, linha 29 (identidade própria no gateway, que cai se a identidade ficar fixa em `falso`) e linha 28 (dois ids iguais recusados em qualquer ambiente). A carga em cenarios.md §5, "Identidade", liga a reserva com `falso-reserva`. O "Controle negativo" usa `falso-sem-aprovacao` e precisa reprovar. Assim o balde cheio do principal transborda para um balde de verdade diferente, e não para o mesmo.
- **Em produção, a falsa sumia sem alerta.** Está corrigido em §5. A subida agora recusa a reserva falsa em produção. É o mesmo tipo de recusa que o código já faz com o principal falso (`MOTIVO_ADAPTADOR_FALSO_EM_PRODUCAO`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/packages/core/src/config/llm-config.ts:129`). Com isso o erro aparece no deploy, e não sem aviso às 10h. A elegibilidade também recusa a entrada falsa em produção (RF4, linha 26), e o teste confere a configuração real, não só a função pura (RF4, linha 28). O aviso para a falha da conferência do suboperador continua sendo `ia.provedor_de_reserva.conferido` (§7c). É um caminho separado e não muda.

A correção não criou problema no meu domínio. A recusa na subida usa um padrão que já existe, o limite de quatro chamadas por execução continua, e o balde da reserva tem chave e limite próprios (`LLM_RESERVA_TOKENS_POR_MINUTO`).

Recomendações:
- cenarios.md, RF4, linha 28: deixar explícito se a recusa de `IA_RESERVA_PROVEDOR_ID=falso-reserva` sobre `openai_compat` vale em todo ambiente ou só em produção. Fora de produção, um provedor real com esse id usaria a aprovação sintética. Recusar em todo ambiente fecha esse caso.

## test-engineer · 5ª rodada · REPROVADO · 2026-11-20 22:58:04 · `tasks/prd-camada-ia/revisao-spec.md`

VEREDITO: REPROVADO

Cenários exigidos: os quatro bloqueantes da rodada 4. Também conferi se as correções abriram lacuna nova em techspec.md §5 e §7c e em cenarios.md (RF4, RF5, RF7, RF9 e §5).

Cobertos:
- **Isenção do falso na guarda: resolvido.** Está em cenarios.md, RF4, linha 27. A entrada de `falso-reserva` com `sha256` que não bate, ou sem o relatório, quebra o teste da constante. A mutação "isentar a entrada do falso da guarda" está declarada. A linha 6 diz que `MODELOS_APROVADOS` é injetado no teste, então dá para montar a entrada errada.
- **Recusa em produção só na função pura: resolvido.** Está em cenarios.md, RF4, linha 28, em `packages/core/src/config/llm-config.test.ts`, pela configuração real. A subida recusa em `AMBIENTE=producao` nos dois casos: o adaptador falso na reserva, e `falso-reserva` sobre `openai_compat`. Cada caso derruba uma mutação diferente. A linha 26, a função de elegibilidade com o ambiente, passa a ser uma defesa a mais. Isso basta porque, com a subida recusando o id `falso-reserva` em produção, nenhuma reserva real consegue bater com a entrada do falso.
- **Estimada sem o caso de outro provedor: resolvido.** Está em RF5, linha 48: a aprovação com outro `provedorId` grava só a estimada do principal, e o compartilhamento lista só o principal. A mutação é "comparar sem o `provedorId`". A linha 47 continua cobrindo o caso inverso, com o modelo de fora da comparação. A linha 24, no gateway, cobre a mesma cláusula na chamada.
- **Contagem da rede com uma rede só: resolvido.** Está em RF7, linha 63. Uma escola da rede 2 que usa o valor da rede 2 não conta na rede 1, e as duas contagens são conferidas. A mutação é "contar sem o filtro da rede". A §2 agora põe A e B em redes diferentes, o que reforça a variante 2.
- **Identidade própria da reserva falsa: coberta.** A linha 29 de RF4 cobre balde, rótulo e disjuntor. A §5 da carga cobre o mesmo, com o controle negativo `falso-sem-aprovacao` na linha 190.

Bloqueantes:
- **techspec.md §7c, linha 143, contra cenarios.md RF9, linha 75.** A cláusula "`ia.provedor_de_reserva.conferido` (0 por 10 min, **só com reserva configurada**)" não tem teste. Hoje o cenário só prova que o alerta dispara com 0. Nenhum cenário prova que, sem reserva configurada, o alerta não dispara. Esse é o estado de produção previsto na §13 ("Sem segundo provedor no Brasil"). A mutação "publicar 0 sempre que não houver reserva" deixaria o alerta tocando direto em produção, e nenhum teste ficaria vermelho.
  - Correção exigida: uma linha em RF9, em `infra/test/alertas.test.ts` ou no teste da medida do worker. Worker sem `IA_RESERVA_*` não publica a série, ou publica um valor que a expressão ignora, e a regra do alerta não dispara. O par a declarar é a mutação "série publicada com 0 sem reserva" ou "alerta por `absent()`".

Recomendações (só as que não estavam registradas):
- **cenarios.md RF4, linha 28:** fixar que a recusa de `IA_RESERVA_PROVEDOR_ID` igual a `IA_PROVEDOR_ID` é testada com `AMBIENTE=local`, e não só em produção. O risco que a rodada 4 apontou está no `local` da carga. Se o teste rodar só em produção, a mutação "comparar os ids só em produção" passa sem ninguém ver.
- **cenarios.md §5, linha 190:** dizer por que o controle negativo reprova: indisponível acima de zero na janela da queda, com a reserva não elegível. Assim ele não fica vermelho pelo motivo errado, como uma recusa na subida.

O arquivo da tarefa é /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/revisao-spec.md. Os conferidos são /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/techspec.md e /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/cenarios.md.

```
VEREDITO: REPROVADO
Cenários exigidos: os quatro bloqueantes da rodada 4 e as lacunas novas das correções (techspec §5 e §7c; cenarios RF4, RF5, RF7, RF9, §5)
Cobertos: isenção do falso na guarda (RF4 l.27); recusa em produção pela configuração real (RF4 l.28); estimada com outro provedor (RF5 l.48, e RF4 l.24 no gateway); contagem com duas redes (RF7 l.63); identidade própria da reserva falsa (RF4 l.29, §5 l.187-190)
Bloqueantes: techspec.md §7c l.143 contra cenarios.md RF9 l.75: "só com reserva configurada" no alerta de ia.provedor_de_reserva.conferido sem cenário; exigir o teste "sem reserva configurada, a série não é publicada e o alerta não dispara", com a mutação "publicar 0 sem reserva"
Recomendações: RF4 l.28 testar a comparação dos dois ids com AMBIENTE=local; §5 l.190 dizer o motivo esperado da reprovação do controle negativo
```

## test-engineer · 6ª rodada · APROVADO · 2026-11-20 22:59:19 · `tasks/prd-camada-ia/revisao-spec.md`

VEREDITO: APROVADO

O bloqueante da rodada 5 foi resolvido e a correção não deixou nenhuma regra escrita sem cenário. Seção conferida: `tasks/prd-camada-ia/cenarios.md`, §1 "Custo e orçamento (RF6 a RF10)", linha 76.

Cenários exigidos:
- **O bloqueante da rodada 5 (techspec §7c, linha 143):** o alerta de `ia.provedor_de_reserva.conferido` só vale com reserva configurada.
- **Sem reserva configurada:** a série não é publicada e o alerta não dispara.
- **Reserva configurada e recusada:** a série publica 0 e o alerta dispara em 10 min.
- **As duas recomendações aplicadas:** a comparação dos ids em `AMBIENTE=local` e o motivo do controle negativo da carga.

Cobertos:
- **Linha 76 (RF9):** traz os dois lados, worker sem `LLM_RESERVA_BASE_URL` nem `IA_RESERVA_PROVEDOR_ID` e reserva configurada e recusada. Cada mutação ataca um lado:
  - "série publicada com 0 sem reserva" derruba o teste da medida no worker.
  - "alerta por `absent()`" derruba o `infra/test/alertas.test.ts`.
- **Por que o "não dispara" se prova:** o `alertas.test.ts` já exige `noDataState = OK` em toda regra (`infra/test/alertas.test.ts:336`). Assim, série ausente com regra de limiar não dispara, e só uma regra por `absent()` faria disparar. Essa é exatamente a mutação declarada.
- **Linha 28 (RF4):** a comparação `IA_RESERVA_PROVEDOR_ID` igual a `IA_PROVEDOR_ID` recusa em qualquer ambiente, com caso em `AMBIENTE=local`. A mutação "comparar só em produção" cai nesse caso.
- **§5, controle negativo (linhas 191-192):** reprova pelo critério certo. O worker sobe, a reserva fica não elegível e há indisponível acima de zero na janela da queda, e não falha de subida.
- **Nada saiu do diff:** os demais RF4 (linhas 22 a 29) continuam com teste e mutação.

Bloqueantes: nenhum.

Recomendações (novas, não estão no registro da rodada 5):
1. **Série presa em 0, `cenarios.md:17` (RF1):** depois do cadastro corrigido sem reiniciar, o cenário confere só que a chamada vai à reserva. Não confere que `ia.provedor_de_reserva.conferido` passa a 1. Se a série ficar presa em 0, o alerta dispara à toa com a reserva sã, e quem opera é uma pessoa só. Vale acrescentar a asserção, com a mutação "série não atualizada na reconferência". Não bloqueia porque a techspec só escreve o estado 0.
2. **Reserva meio configurada, `cenarios.md:76` e techspec §5 (linhas 91-93):** o cenário diz "sem `LLM_RESERVA_BASE_URL` **nem** `IA_RESERVA_PROVEDOR_ID`". Nem a techspec nem o cenário dizem o que acontece com só uma das duas. Contada como "não configurada", a série some e o alerta se cala com a reserva meio ligada. A sugestão é a subida recusar, citando a variável que falta, com um caso em `packages/core/src/config/llm-config.test.ts`.
3. **Caminho do teste, `cenarios.md:76`:** a camada aparece só como a pasta `apps/worker/test/`, sem nome de arquivo, ao contrário das outras linhas. O cabeçalho deixa a tarefa fixar o caminho, então isso só pede atenção para a tarefa citar o arquivo pelo nome.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/infra/test/alertas.test.ts
