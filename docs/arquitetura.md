# Arquitetura

## Princípios

1. **Portabilidade.** Hospedagem e provedor de modelo em aberto; rede pública pode exigir
   dado no Brasil. Tudo em container, nada proprietário no caminho crítico.
2. **Isolamento por escola acima de tudo.** É a decisão que não pode ser retrabalhada.
3. **Web-first e responsiva**, do computador fraco de escola (Chromebook como referência)
   ao celular (D51). Sem app nativo, sem fluxo que dependa de celular (Lei 15.100/2025, D43).
4. **Aprovação humana no caminho de tudo que vale.** Exigência do CNE.

## Desenho

Quem chega ao código começa pelo `docs/guia-do-desenvolvedor.md`: onde fica cada coisa, o caminho de uma
requisição, as receitas e a tabela "se você vem do Spring Boot".

```
apps/web          React + Vite + TS   coordenação, professor, aluno, operação Turmma (família depois)
apps/api          NestJS + TS         API REST, domínio, autorização; hoje também executa as tarefas de IA (D77)
apps/despachante  Node + TS           lê o outbox (job_registro) e publica no BullMQ, por vaga de escola
apps/worker       BullMQ              executa os jobs: expurgo, retenção, pedidos do titular, rotinas
apps/realtime     socket.io           hoje só o canal /sistema; a sala ao vivo por turma é do F10
packages/shared   zod                 contrato de pedido e resposta, códigos de erro, matriz de permissão
packages/core   TS                  contexto, guardas, erro, schema e migrations, fila, IA, limite, log

Postgres 18 · Redis (fila e cache) · S3-compatível · LLMProvider (falso | OpenAI-compatível)
```

A direção das dependências é `shared ← core ← apps`, e a web depende só de `shared`. O `dependency-cruiser`
(`tools/guardas/camadas.cjs`, que o `npm run lint` roda pelo `guarda:camadas`) reprova o import contra essa direção, a
app que importa outra app, a produção que importa teste e qualquer ciclo de import.

## Camadas do backend

```
módulo/recurso
 ├── controller     HTTP: valida a entrada pelo esquema de shared, chama o service, zero regra
 ├── service        regra de negócio; valida a resposta pelo esquema de shared
 ├── repository     único acesso a dados, escopo de tenant sempre, lido do contexto
 └── contrato       esquema zod de pedido e resposta em packages/shared, nunca a linha serializada
```

Nas camadas, o mesmo `dependency-cruiser` reprova o controller que importa repository ou Drizzle, o service que importa
Drizzle e o repository que importa service ou controller. O tamanho tem catraca: função acima de 10 de complexidade, 80
linhas de código ou 4 níveis de aninhamento reprova o ESLint, e o que já passava disso em 22/10/2026 está em
`eslint-suppressions.json`, que só encolhe (`tools/guardas/catraca.test.ts`). Em produção só se lança erro com tipo:
`DomainException` com o `ErrorCode`, uma classe do módulo, ou `InvariantException` para o que não pode acontecer, com o
motivo em texto fixo (lint `guardas/erro-tipado`, regra 00, item 9).

**As pastas.** Uma por módulo de domínio. Nos módulos com vários recursos (`estrutura`, `operacao`, `sala` e
`atividade`), cada recurso tem a sua subpasta, com o controller, o service, o repository e os testes dele
(`estrutura/turma/`); a `sessao/` se parte por fluxo (`login/`, `convite/`, `refresh/`...), com a `tenant/`, que
resolve a escola antes de haver sessão. As primitivas da entrada (senha, hash, cookie, desafio, os contadores e o
semáforo do hash) ficam em `credencial/`, sem módulo Nest; de fora, `sessao/` e `credencial/` só se importam pelo
`index.ts` de cada uma. A paginação fica em `http/pagination.ts`, os casos de uso de rede e escola em `operacao/escola/`,
e `ops/` tem só os comandos de terminal e os repositories deles. Nenhuma pasta de produção da API ou da web passa de 25
arquivos direto nela (`tools/guardas/tamanho-das-pastas.test.ts`). O mapa completo está no guia, seção 4.

**A entrada.** O controller valida pelo `ZodValidationPipe` do NestJS, com o esquema de `shared`
(`packages/core/src/pipes/`), e o `IdPipe` lê o id do caminho. Todo controller de `apps/api/src` valida assim: o ESLint
reprova `@Body()`, `@Query()` e `@Param()` sem pipe, e `@Req()` cru fora de `sessao/` e `operacao/`. A resposta passa pelo
esquema de resposta no service, e o mesmo esquema valida a leitura na web (D81).

Módulos montados (`apps/api/src/app.module.ts`):
- de domínio: `estrutura` (escola, ano letivo, série, turma, disciplina, vínculo, lista), `professores`, `material`,
  `ia`, `assistente`, `artefato`, `entrega`, `atividade`, `tutor`, `governanca`, `privacidade`, `sala`, `operacao`,
  `sistema` e `sessao`;
- de infraestrutura: `DatabaseModule`, `RateLimitModule` e `UsageModule`.

Os módulos de ingestão, questão, avaliação, correção, nota e notificação nascem nas fases deles (F4, F6, F13, F17).

## Multi-tenant

Escopo aplicado no repository, lido do contexto da requisição. O token só identifica: a `SessaoGuard` lê a sessão
no banco e grava no contexto a escola, o ano letivo e o papel, e o repository lê de lá com `requireEscolaId()`.
Nunca de parâmetro do cliente. Toda tabela de domínio tem `escolaId`;
as que variam por período têm `anoLetivoId`. Id é UUID. Teste de isolamento acompanha todo
módulo novo. Ver `.claude/rules/10-multitenancy.md`.

**O único alcance entre escolas é o módulo `operacao`** (A0b, painel da operação Turmma), e só
para o operador com sessão (`@OperacaoRoute`). Ele cria rede e escola pelos casos de uso do
`ops:escola`, e lê entre escolas por um só repository, o `PainelRepository`, em que cada método
é `@Unscoped` com a justificativa do painel (regra 10, item 9), devolvendo id, nome e número,
nunca pessoa. As escritas do painel alcançam mais quatro `@Unscoped` dos comandos `ops:*`,
listados com a justificativa em `docs/modelo-de-dados.md` ("Operação Turmma"). Nenhum outro
módulo lê fora da escola do token, e credencial de escola não alcança rota do painel (teste C46). O desenho está na Tech Spec da A0b
(`tasks/prd-apresentacao-painel/techspec.md`, seções 6 e 11).

O F3 acrescentou **um** `@Unscoped` aos comandos `ops:*`: o `ops:suboperador encerrar`, que fecha as ligações de uma
empresa em todas as escolas e devolve só a contagem (`OperacaoPrivacidadeRepository.encerrarLigacoes`). O `ops:privacidade`
(tarefa 19.0) não ganhou nenhum: abre o contexto da escola do pedido e lê só contagens, pelo repository de contagens e
pelos leitores que a escola já usa (`docs/modelo-de-dados.md`, "A leitura da operação").

## Autenticação e identidade

- **Coordenador, professor, responsável:** e-mail + senha. Segundo fator para coordenador.
- **Aluno:** escola + matrícula + senha. Sem e-mail, sem telefone.
- **Conta da escola (D48):** onde a escola tem Google Workspace ou Microsoft, professor e
  aluno entram com essa conta, por adaptador opcional (regra 00, item 7). Guardamos só o
  identificador opaco da conta; e-mail e foto do aluno são descartados antes de gravar.
  Importação de turmas e vínculos do Classroom pelo mesmo adaptador.
- **Entrada no sistema:** coordenador cria séries e turmas, sobe a lista de nomes, importa
  grade e calendário e aloca professor × turma × disciplina → professor entra por link de
  convite e **confirma** o vínculo → aluno entra pela conta da escola ou pelo link da sala,
  reivindica o próprio nome e **o professor aprova**. Só depois da aprovação o aluno define
  senha e existe de verdade. Vínculo não confirmado não dá acesso a aluno.
- Um usuário pode ter vínculo em mais de uma escola; o token carrega a escola ativa.
- Convite é token único, com validade curta, uso único e revogável.
- **O `SessaoModule` é global desde a A0**, como o `DatabaseModule` e o `RateLimitModule`. Ele exporta o
  semáforo do hash de senha, o hash, o contador de tentativas e o cliente do Redis de fila do login
  (as classes moram em `apps/api/src/credencial/` desde a X5),
  e o `OperacaoModule` (a entrada, o convite e o segundo fator do operador Turmma) recebe a **mesma
  instância**: o teto do semáforo é o das threads do processo, e dois semáforos dobrariam o argon2
  que a instância aceita ao mesmo tempo; o contador é um só, com o prefixo `login-op` separando as
  contas do operador das da escola, e o seguro em memória dele, com o Redis fora, vale para as duas.
  Montar outro `SessaoModule` na operação criaria a segunda instância de cada peça sem ninguém ver.
- **As rotas de entrada da operação contam por IP num balde próprio** (`rl:ip:op`, A0b), com o teto
  do limite anônimo: a rede de uma escola, que sai por um IP só, não recusa nem rebaixa o operador
  que está nela, e as tentativas contra a entrada do operador não gastam o limite dos alunos.

## Assíncrono

Nada demorado em request. São três filas, uma por prioridade: `interativa`, `normal` e `lote`. O trabalho se
distingue pelo **tipo** do job (`retencao.expurgar-escola`, `titular.montar-arquivo`…), não por uma fila própria.
Cada escola tem um limite de concorrência (`EscolaConcurrencyLimiter`), e o lote não urgente roda fora do horário letivo. No
compose, o `worker-interativo` atende `interativa` e `normal`, e o `worker-lote` atende `lote`.

**Exceção declarada:** as tarefas de IA (Tutor, ferramentas do professor) ainda rodam no processo da API, pelo
`ExecucaoScheduler`, que responde 202 e executa em segundo plano (D77). A ida para o worker está registrada na X6
(`reengenharia-continuacao`, 42.0 e 47.0), antes do portão do piloto.

No F3, o expurgo noturno (`retencao.expurgar-escola`, um job por escola, à 1h) e a eliminação do titular (`titular.eliminar`,
que o expurgo enfileira quando o prazo de 7 dias vence) são lote não urgente; a montagem do arquivo do titular
(`titular.montar-arquivo`) é da fila normal. O cenário de carga "justiça entre escolas" prova, com 1 milhão de linhas
vencidas e uma troca de nome na escola A, que nada disso atrasa o interativo da B nem o turno do Tutor dela (pela rota, com o
adaptador falso de latência simulada) e que nenhum statement chega a 1,5 s nem é cancelado pelo `statement_timeout` de 2 s
(`docs/infra.md`, seção 10).

A entrega é **pelo menos uma vez** (D49): o job nasce no Postgres, o despachante publica no
BullMQ quando a escola tem vaga, e a reconciliação republica o que o Redis perdeu. Por isso
todo processador recebe chave de idempotência e precisa tolerar reexecução sem duplicar
efeito, principalmente chamada de IA paga e aviso.

## Carga e operação

Cada escola entra com centenas de usuários, concentrados no horário de aula e atrás de um
único IP. O modelo de carga, a topologia, os limites, a meta de disponibilidade e o portão
da primeira escola real estão em `docs/infra.md` e na regra 80.

## Tempo real (modo sala)

O professor vê a turma usando o tutor ao vivo: quem está travado, quem pediu resposta
pronta, quais dúvidas se repetem. WebSocket com sala por turma, autorizada pelo vínculo do
professor. Fora da aula, modo casa: registro e resumo, sem tempo real.

**Hoje** o `apps/realtime` só tem o canal `/sistema`.
A sala por turma é do F10 (`modo-sala-tempo-real`).

Sinal é derivado de evento, não de vigilância: o professor vê **uso e dificuldade**, não
uma janela permanente sobre o comportamento do aluno.

## Camada de IA

```
Serviço de domínio → ExecucaoScheduler → LLMGateway (gateway: orçamento, suspensão, prazo, validação da saída)
                                              → LLMProvider (porta)
                                                  ├── FakeAdapter          testes e carga, custo zero (padrão)
                                                  └── OpenAICompatAdapter   produção, e o modelo local no
                                                                              desenvolvimento (llama-server)
```

Não há adaptador Ollama próprio: o modelo local fala o protocolo OpenAI-compatível e usa o mesmo adaptador. As tarefas
ficam em `packages/core/src/ia/tasks/`, com os prompts versionados em `ia/prompts/`.

Roteamento por perfil: `rapido`, `padrao`, `complexo`, `visao`. O perfil é declarado pelo
caso de uso; o modelo concreto é configuração.

**Orçamento de tokens** por aluno, por turma e por escola é obrigatório, com corte suave e
aviso ao coordenador antes do limite. O tutor tem pacote mensal por turma e freio diário por
aluno (D38). Teto de R$ 5 por aluno na particular (D39); na rede, derivado do contrato
(D41). Tudo é configuração, nunca constante. O tutor gasta muito mais que geração de prova — a margem do
R$ 30/aluno depende de medir isso desde a primeira chamada.

Guardrails: escopo de assunto por turma aplicado no servidor, detecção de pedido de
resposta pronta, filtro de conteúdo, recusa testada e não apenas pedida no prompt.

## Ingestão

Ver `docs/ingestao.md`. Pipeline único, adaptador por fonte, rastreabilidade até a página.

## Frontend

SPA com wouter nas rotas e TanStack Query para o estado de servidor (`queryOptions` por assunto). Os tipos e
esquemas vêm de `packages/shared`, e a resposta da API é validada na leitura. O access token fica só em memória, e
a sessão volta pelo cookie. Alvo de desempenho: o computador de escola, que é fraco, com o Chromebook de entrada como
referência, e o celular em rede móvel. Toda tela é responsiva desde a primeira versão (D51).

Lista longa é paginada na API, por cursor. A virtualização ainda não existe (`components/ui/Table.tsx` não pagina nem
virtualiza) e entra quando uma tela precisar mostrar centenas de linhas. O bundle tem teto no `.size-limit.json`, e
nada assume máquina boa.

## Observabilidade sem exposição

Log estruturado com `escolaId` e `usuarioId`. **Nunca nome, resposta, nota ou conversa.**
Métrica de custo de IA por escola, por perfil e por aluno. Alerta de falha em série de
agente. Auditoria de leitura de dado de aluno, exportação, alteração de nota e de permissão.
