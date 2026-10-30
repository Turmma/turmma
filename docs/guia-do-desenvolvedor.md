# Guia do desenvolvedor

Para quem chega no código do Turmma. Em meia hora você sabe onde cada coisa fica, como uma requisição anda, como criar
um endpoint, uma tabela, um job ou uma tela, e o que a máquina não deixa você fazer errado.

A skill `receitas-de-codigo` aponta a receita da §5 pelo assunto, e a esteira confere que ela continua apontando para cá.

Antes deste guia, leia o `CLAUDE.md`, ao menos "Em uma frase" e "As seis regras que não se negociam". Depois deste,
leia a regra de `.claude/rules/` da área em que você vai mexer.

> **A regra de idioma (D81).** A peça técnica tem o nome do framework, em inglês: `Controller`, `Service`,
> `Repository`, `Module`, `Pipe`, `Guard`, os hooks `use…`. O conceito do domínio fica em português, pelo
> `docs/glossario.md`: `turma`, `nota`, `matricula`, `anoLetivo`. Por isso você vai ver `TurmaController` e
> `turma.repository.ts`. Algumas peças técnicas antigas têm nome em português, e a §9 traz o equivalente de mercado até a X8 renomeá-las (D81 revista).

---

## 1. Em cinco minutos

**Stack:**
- **Backend:** NestJS 12 e TypeScript, com Postgres 18 pelo Drizzle e BullMQ sobre Redis.
- **Frontend:** React 19, Vite, TanStack Query, wouter e Tailwind 4.
- **Testes:** Vitest e Playwright.
- **Infra:** tudo sobe com `docker compose up`.

É um monorepo com npm workspaces, o equivalente a um projeto Maven multi-módulo:

```
packages/shared      contrato: esquemas zod de pedido e resposta, ErrorCode, matriz de permissão, filas
packages/nucleo      infraestrutura do backend: contexto, guardas, erro, schema e migrations, fila, IA, log
apps/api             API REST (NestJS): controllers, services, repositories, por módulo de domínio
apps/despachante     lê o outbox (job_registro) e publica no BullMQ, respeitando as vagas de cada escola
apps/worker          executa os jobs do BullMQ, por fila (interativa, normal, lote)
apps/realtime        WebSocket (socket.io). Hoje só o canal /sistema
apps/web             SPA React: coordenação, professor e aluno; a operação Turmma em rota própria
e2e/                 testes Playwright do fluxo inteiro
infra/               compose, Dockerfiles, borda (Caddy), observabilidade, carga (k6), testes de infra
tools/               guardas de lint, scripts da esteira, apoio de teste, processo de construção
docs/                produto, decisões, LGPD, regulação, arquitetura, infra, runbook
```

**A direção das dependências é uma só: `shared` ← `nucleo` ← `apps`.** A web depende só de `shared` e nunca de
`nucleo`, porque o navegador não pode ver código de servidor. Os pacotes compilam nesta ordem: shared, nucleo, api,
realtime, despachante, worker, web.

**O que não muda nunca** (o motivo está no `CLAUDE.md`):
1. Uma escola não vê nada de outra. O escopo é aplicado no repository, a partir do contexto, nunca de um parâmetro
   do cliente.
2. Aluno não tem e-mail, telefone, CPF, foto, endereço, data de nascimento nem diagnóstico (regra 20.2). Log nunca
   leva nome, matrícula, resposta, nota, conversa de tutor nem conteúdo de prompt (regra 20.9).
3. Nota só existe com autor humano. Em redação e discursiva, a IA não corrige, não avalia, não dá nota nem conceito,
   e não pré-corrige nem sugere nota ao professor (D55, regra 70.2a).
4. Nenhum módulo chama o provedor de IA direto: tudo passa pela porta `LLMProvider`.
5. Teste prova regra de negócio, não "retornou 200".
6. O horário de aula é sagrado: nada demorado dentro de request, e limite por usuário e por escola.

---

## 2. Se você vem do Spring Boot

| No Spring Boot | Aqui | Onde ver |
|---|---|---|
| Projeto Maven multi-módulo | npm workspaces (`apps/*`, `packages/*`) | `package.json` |
| Módulo `-api` com os DTOs, compartilhado | `packages/shared` (esquemas zod) | `packages/shared/src/estrutura/disciplina.ts` |
| `@Configuration` + `@Bean` | `@Module` do NestJS; o módulo que recebe configuração usa `static com(config): DynamicModule` | `apps/api/src/app.module.ts`, `estrutura/estrutura.module.ts` |
| `@RestController` + `@RequestMapping("/v1/x")` | `@Controller('v1/x')` | `apps/api/src/estrutura/disciplina/disciplina.controller.ts` |
| `@Service` | classe de service, criada pelo módulo com `useFactory` | `estrutura/disciplina/disciplina.service.ts` |
| `@Repository` + filtro de tenant do Hibernate | repository do Drizzle que lê a escola por `requireEscolaId()` | `estrutura/disciplina/disciplina.repository.ts` |
| Entidade JPA | tabela do Drizzle, sem lazy loading e sem entidade gerenciada | `packages/nucleo/src/db/schema/disciplina.ts` |
| Flyway | migrations do `drizzle-kit`, aplicadas pelo serviço `migrar` do compose | `packages/nucleo/drizzle/` |
| Bean Validation (`@Valid` no `@RequestBody`) | esquema zod de `shared` com o `ZodValidationPipe` do NestJS | §5.1 |
| DTO de resposta (record) | esquema de resposta zod, aplicado com `.parse` no service | `disciplinaResponseSchema` |
| Spring Security filter chain | quatro guardas globais, nesta ordem: autenticação, limite, sessão, permissão | `app.module.ts`, `APP_GUARD` |
| `@PreAuthorize("hasRole(...)")` na rota | `@RequirePermissao('disciplina', 'criar')` sobre a `MATRIZ`: cobre **a rota e o papel**, não o objeto | `nucleo/src/permissao/permite.decorator.ts`, `shared/src/permissao/matriz.ts` |
| `@PostAuthorize` / `hasPermission(obj)` no objeto | o alcance `turma_vinculada` ou `proprio`, aplicado **no repository** com o usuário do contexto | `assistente/turma-do-professor.repository.ts` |
| `SecurityContextHolder` / `RequestContextHolder` (ThreadLocal) | contexto da requisição em `AsyncLocalStorage` | `nucleo/src/contexto/contexto.ts` |
| Exceção de negócio + `@ControllerAdvice` | `DomainException(ErrorCode.X)` + `AllExceptionsFilter` | `nucleo/src/erro/` |
| `@ConfigurationProperties` + `@Validated` | `config.ts` com zod, que lista todos os erros de uma vez | `apps/api/src/config.ts` |
| `ApplicationEventPublisher` transacional / outbox | `JobOutbox` (transactional outbox) + despachante | `nucleo/src/fila/enfileirador.ts`, `apps/despachante/` |
| `@RabbitListener` / `@KafkaListener` | processador do worker, registrado por tipo de job | `apps/worker/src/montagem.ts` |
| `@Scheduled` | `AGENDAMENTOS` (job scheduler do BullMQ) | `apps/worker/src/agendamentos.ts` |
| Spring AI `ChatClient` atrás de uma interface | porta `LLMProvider` e gateway `LLMGateway` | `nucleo/src/ia/porta.ts`, `provedor.ts` |
| Actuator `/health`, graceful shutdown | `/saude` e `ProntidaoController`; `GracefulShutdown` | `apps/api/src/sistema/prontidao.controller.ts`, `nucleo/src/instancia/drenagem.ts` |
| JUnit + Mockito | Vitest, projeto `unidade` (`x.test.ts`) | `vitest.config.ts` |
| `@SpringBootTest` + Testcontainers | Vitest, projeto `integracao` (`x.int.test.ts`), com Postgres e Redis reais no compose de teste | `tools/testes/integracao.setup.ts` |
| ArchUnit / Checkstyle | regras de ESLint em `tools/guardas/`, `dependency-cruiser` e testes de arquitetura | §7 |
| `mvn verify` | `npm run typecheck && npm run lint && npm run test` | §8 |

**O que é diferente de propósito:**
- **Outra escola responde 404, não 403** (regra 10.6): o 403 confirmaria que o id existe. O filtro global já
  converte o 403 do Nest em 404.
- **A guarda não protege o objeto.** A `PermissaoGuard` só barra o alcance `nunca`. Ter o papel de professor
  passa pela guarda; **aquela turma ser dele** é conferido no repository (regra 10.4). Sem isso, o professor lê
  qualquer turma da escola.
- **O service não recebe a escola por parâmetro.** O repository lê do contexto. Se você se pegar passando `escolaId`
  como argumento, pare e releia a regra 10.
- **A validação de saída é explícita.** O service passa a resposta pelo esquema de `shared`, e campo que não está no
  esquema não sai. Nunca se serializa a linha do banco.
- **Não há ORM com entidade gerenciada.** O Drizzle é SQL tipado: o que você escreve é a consulta que roda.

---

## 3. O caminho de uma requisição

```
navegador ──HTTP──▶ borda (Caddy) ──▶ api
  1. contextMiddleware           abre o contexto com o requisicaoId
  2. AuthGuard                   confere o JWT do "Authorization: Bearer", sem tocar o banco
  3. RateLimitGuard              rate limit por usuário e por escola (nunca só por IP)
  4. SessaoGuard                 lê a sessão no Postgres e grava escola, ano letivo, papel e usuário no contexto
  5. PermissaoGuard              @RequirePermissao(recurso, acao) contra a MATRIZ; só barra "nunca", que vira 404
  6. Controller                  valida a entrada pelo esquema de shared e chama o service
  7. Service                     regra de negócio; valida a resposta pelo esquema de shared
  8. Repository                  SQL com o escopo da escola (e do ano letivo) lido do contexto, e o alcance do objeto
                                 (turma_vinculada, proprio) pelo usuário do contexto
  ◀── AllExceptionsFilter        DomainException vira { erro: { codigo, mensagem, requisicaoId } }
```

- **O boot falha** se uma rota não tiver `@RequirePermissao` nem `@Public` (`PermissaoBootCheck`).
- **O access token** é um JWT de vida curta, guardado só na memória da web. A renovação é pelo cookie `educa_sessao`
  (`HttpOnly`, `SameSite=Strict`, `Path=/v1/sessao`).
- **O erro tem código, nunca texto livre.** A web decide pelo `codigo` (`ENTRADA_INVALIDA`, `CONFLITO`,
  `NAO_ENCONTRADO`…), nunca pelo status nem pela mensagem.

---

## 4. Onde fica cada coisa

**Na API, uma pasta por módulo de domínio** e, nos módulos que têm vários recursos (`estrutura/`, `operacao/`, `sala/` e
`atividade/`), uma subpasta por recurso, como o `nest g resource`, com o controller, o service e o repository dele lado a lado
(`estrutura/turma/turma.controller.ts`, `turma.service.ts`, `turma.repository.ts`). **Na web, a pasta se parte por assunto**
quando passa de ~20 arquivos de produção. Em toda a API e na web, um teste reprova a pasta que passar de 25
(`tools/guardas/tamanho-das-pastas.test.ts`).

```
apps/api/src/
  app.module.ts                módulos montados, guardas globais
  <modulo>/                    estrutura, professores, material, ia, assistente, artefato, entrega,
                               atividade, tutor, governanca, privacidade, sala, operacao, sistema, sessao
    <modulo>.module.ts
    turma/                     um recurso: o trio abaixo e os testes dele (nos módulos com vários recursos)
      turma.controller.ts
      turma.service.ts
      turma.repository.ts
    *.test.ts                  unidade, ao lado do código
  sessao/                      uma subpasta por fluxo (login/, convite/, renovacao/, externa/...) e tenant/, a
                               resolução da escola antes de haver sessão; de fora, só pelo sessao/index.ts
  credencial/                  as primitivas da entrada, sem módulo Nest: senha, hash, cookie, desafio,
                               ContadorDeTentativas e, em senha/, ContadorEmJanela e SemaforoDeHash; de fora de
                               sessao/, só pelo credencial/index.ts
  http/paginacao.ts            paginar e paginarPor, o corte da página de uma listagem
  operacao/escola/             criarRede e criarEscola, que o painel e o comando ops:escola chamam
  ops/                         só os comandos de terminal (npm run ops:*) e os repositories deles; nada de
                               apps/api/src importa daqui
apps/api/test/                 testes de integração: entre outros, os que cruzam módulos, os de arquitetura e os
                               HTTP de vários módulos; muitos módulos também têm *.int.test.ts ao lado do código

packages/shared/src/<modulo>/  esquemas zod de pedido e resposta do módulo
packages/nucleo/src/
  db/schema/                   uma tabela por arquivo
  contexto/ identidade/ permissao/ erro/ fila/ ia/ limite/ log/ auditoria/ titular/ ...

apps/web/src/
  rotas.tsx                    as rotas de topo; cada área carrega as dela com lazy
  api/                         cliente HTTP (chamarApi), sessão, consultas comuns
  componentes/ui/              o kit visual: Botao, Campo, Dialogo, Abas, Tabela...
  componentes/                 peças de domínio usadas por mais de uma área
  areas/<papel>/<assunto>/     ex.: areas/professor/turmas/ — telas, hooks e consultas do assunto
  operacao/                    o painel da operação Turmma
```

---

## 5. Receitas

Cada receita aponta um exemplo real. Copie o exemplo e troque os nomes.

### 5.1 Um endpoint novo

Exemplo: a disciplina (`apps/api/src/estrutura/`, `packages/shared/src/estrutura/disciplina.ts`).

1. **Contrato em `shared`.** Escreva o esquema do pedido, sempre `.strict()`, e o da resposta. Exporte os dois em
   `packages/shared/src/index.ts`.
   ```ts
   export const criarDisciplinaRequestSchema = z
     .object({
       nome: z.string().trim().min(1).max(TAMANHO_MAXIMO_NOME_DISCIPLINA),
       area: z.enum(AREAS_DO_CONHECIMENTO).optional(),
     })
     .strict()
   export const disciplinaResponseSchema = disciplinaSchema
   ```
2. **Permissão.** Acrescente a ação na `MATRIZ` (`packages/shared/src/permissao/matriz.ts`), com o alcance de cada
   papel. O teste da matriz diz o que falta. **A guarda só aplica o `nunca`.** O `turma_vinculada` e o `proprio` são
   promessa da matriz que só o repository cumpre (passo 5): marcar a célula não protege nada sozinho.
3. **Controller.** Ele não tem regra: valida, chama o service e devolve.
   ```ts
   @Controller('v1/disciplinas')
   export class DisciplinaController {
     @Post()
     @RequirePermissao('disciplina', 'criar')
     criar(@Body(new ZodValidationPipe(criarDisciplinaRequestSchema)) pedido: CriarDisciplinaRequest) {
       return this.disciplinas.criar(pedido)
     }

     @Get(':id')
     @RequirePermissao('disciplina', 'ler')
     abrir(@Param('id', IdPipe) id: string) { ... }   // id fora do formato responde 404, como o inexistente
   }
   ```
   O `ZodValidationPipe` é o da documentação do NestJS (*Pipes → Object schema validation*). Entrada inválida
   responde `ENTRADA_INVALIDA`. Em todo `*.controller.ts` de `apps/api/src` o lint não deixa passar `@Body()`, `@Query()`
   nem `@Param()` sem pipe, nem `@Req()` cru (só `sessao/` e `operacao/` leem cookie e IP da requisição). O parâmetro
   de caminho que não é um id e que, fora do formato, deve responder como o inexistente (`ferramenta`, `questao`, `slug`)
   leva `new ZodValidationPipe(esquema, { errorCode: ErrorCode.NAO_ENCONTRADO })`. A rota que aceita não receber corpo
   usa o esquema vazio com `.default({})` (`emptyOrMissingBodyRequestSchema`).
4. **Service.** A regra de negócio fica aqui, e a resposta passa pelo esquema:
   `return disciplinaResponseSchema.parse(linha)`. Quando não achar, lance `new DomainException(ErrorCode.NAO_ENCONTRADO)`.
5. **Repository.** É o único lugar que toca o banco. A escola vem do contexto, nunca do argumento:
   ```ts
   .where(and(eq(disciplina.escolaId, requireEscolaId()), eq(disciplina.id, id)))
   ```
   Tabela que varia por ano usa também `requireAnoEmCurso()`. Listagem é paginada por cursor (`paginar`, de
   `apps/api/src/http/paginacao.ts`).
   **O alcance do objeto também é do repository**, e cada alcance tem o seu jeito:
   - **`turma_vinculada`:** um `exists` sobre o vínculo `confirmado` do usuário do contexto na turma da linha.
     - **Linha com disciplina** (artefato, atividade aplicada, entrega): o vínculo precisa ser também naquela
       disciplina. Use o `comVinculoConfirmadoDoProfessor` de `apps/api/src/assistente/turma-do-professor.repository.ts`.
     - **Linha sem disciplina** (a própria turma e os alunos dela): basta o vínculo na turma, em qualquer disciplina.
       Veja o `#comVinculoDoProfessor` de `apps/api/src/estrutura/turma/turma.repository.ts`.
     - **Linha com disciplina e sem turma** (o material): basta o vínculo confirmado naquela disciplina no ano em
       curso, sem olhar a turma (`#noAlcance` de `apps/api/src/material/material.repository.ts`).
     - No ano em curso, vínculo pendente, contestado ou encerrado não dá alcance. Na leitura de um ano encerrado, a
       turma aceita também o vínculo encerrado pela virada (`fim_do_ano`) que tinha sido confirmado e não foi
       contestado (`#confirmadoAteOFimDoAno`, no mesmo arquivo).
   - **`proprio`:** a coluna do dono da linha é o usuário do contexto. Por exemplo,
     `eq(threadAgente.usuarioId, exigirUsuarioDoContexto())` ou `eq(mensagemTutor.alunoId, exigirUsuarioDoContexto())`,
     em `apps/api/src/ia/execucao.repository.ts`. Aqui não há vínculo.
6. **Registro.** Ponha o controller e o service no `<modulo>.module.ts`.
7. **Testes:**
   - integração (`*.int.test.ts`), com a regra e não com o status, no mesmo lugar em que o módulo já guarda os seus
     (§6);
   - o **teste de isolamento** (§5.6), com os dois casos: outra escola, e o professor da mesma escola sem vínculo;
   - um e2e em `e2e/` se for um fluxo que alguém faz na tela.

### 5.2 Uma tabela nova

Exemplo: `packages/nucleo/src/db/schema/disciplina.ts` e `turma.ts`.

1. **Dado pessoal primeiro.** Se a tabela guarda dado de pessoa, a linha vai antes para a tabela de
   `docs/lgpd.md`, com finalidade e retenção (regra 20.1). Sem isso o campo não entra.
2. **O arquivo do schema**, um por tabela:
   - id `uuid().primaryKey().default(sql\`uuidv7()\`)`;
   - `escolaId` sempre; `anoLetivoId` se a tabela varia por ano;
   - `unique(escola_id, id)` para servir de alvo;
   - **FK composta com a escola**, para que uma linha não aponte para outra escola;
   - índice que começa por `escola_id` (regra 80.8).
3. **A migration:** rode `npm run db:gerar`, leia o SQL gerado em `packages/nucleo/drizzle/` e faça o commit dele.
   Ela é aplicada pelo serviço `migrar` do compose e pela integração. A migration precisa ser compatível com a versão
   anterior do código: expandir, migrar, contrair.
4. **As classificações que o teste cobra:** o `apps/api/test/arquitetura.test.ts` reprova tabela sem `escola_id`
   fora das exceções de `docs/modelo-de-dados.md`, e tabela sem classificação de retenção e de arquivo do titular. A
   classificação fica em `packages/shared/src/privacidade/classificacao.ts`. Atualize também o
   `docs/modelo-de-dados.md`.

### 5.3 Um job novo

Exemplo: a montagem do arquivo do titular (`privacidade.service.ts`, `apps/worker/src/processadores/`).

1. **Declare o tipo em `JOB_DEFINITIONS`** (`packages/shared/src/system/job-definitions.ts`), com `defineJob`:
   as filas em que ele pode nascer (a primeira é a padrão), o escopo (`escola` ou `sistema`), quem executa, o esquema
   estrito dos `dados`, a retentativa, o prazo (`prazoMs`) e se é não urgente. Os `dados` levam **só ids**, nunca nome
   nem conteúdo (regra 20). Rotina sem escola tem escopo `sistema` e o tipo começa por `sistema.`.
2. **Enfileire na transação de quem pede:** `enfileirador.enfileirar(tx, tipo, dados)`, dentro do
   `banco.transaction`. O job existe se, e somente se, o que o originou foi gravado: é o transactional outbox. Os
   `dados` passam pelo esquema do tipo antes de gravar, e o pedido que a definição recusa lança `JobRequestRejectedError`.
   Se o mesmo pedido pode chegar duas vezes (dois cliques, reenvio do cliente), use
   `enfileirarUmaVez(tx, tipo, dados, chave)`: o id do job não deduplica dois jobs do mesmo pedido, e a chave sim.
3. **Escreva o processador** em `apps/worker/src/processadores/<nome>.ts`. Ele **precisa ser idempotente**: a entrega
   é pelo menos uma vez (D49), e a mesma execução pode rodar de novo com o mesmo id de job, que é a chave que o
   processador recebe.
4. **Registre o processador** em `apps/worker/src/montagem.ts`, na réplica que atende a fila. Se for periódico,
   acrescente em `agendamentos.ts`.
5. **Teste** em `apps/worker/test/*.int.test.ts`, com a reexecução: rodar duas vezes não pode duplicar efeito.

Qual fila usar:

| Fila | Para quê | Exemplo |
|---|---|---|
| `interativa` | alguém está esperando na tela | nenhum tipo hoje. A IA roda no processo da API (D77) até a 47.0, na X6 |
| `normal` | o resto | montar o arquivo do titular |
| `lote` | pesado e sem pressa; o não urgente espera o fim do horário letivo | expurgo da escola, eliminação do titular |

### 5.4 Chamar a IA

Exemplo: `apps/api/src/artefato/ferramentas.service.ts`.

1. **A tarefa** fica em `packages/nucleo/src/ia/tarefas/<tarefa>.ts`, com `defineTask`, o perfil (`rapido`,
   `padrao`, `complexo`, `visao`) e os esquemas de entrada e saída. O prompt é versionado em `ia/prompts/`. Registre
   em `TASK_CATALOG`.
2. **O módulo chama** o `AgendadorDeExecucoes.agendar({ tarefa, chaveEnvio, ... })`. A resposta é 202 com
   `execucaoId`, e a execução roda em segundo plano, passando pelo gateway: orçamento, suspensão da função, prazo e
   validação da saída.
3. **Nunca chame o adaptador nem a porta direto.** O lint barra só o import de SDK de IA. Chamar o
   `OpenAICompatAdapter` ou o `LLMProvider` sem passar pelo `AgendadorDeExecucoes` e pelo gateway não tem trava de
   máquina: é proibido pela regra 30, e quem segura é a revisão.
4. **Teste com o `FakeAdapter`.** Nenhum teste chama provedor pago.
5. **Funcionalidade de alto risco** só entra com a AIA escrita em `docs/aia/` (regra 70.6a). A lista da regra é:
   Tutor, correção de objetiva, diagnóstico por habilidade, sinais e alertas, e adaptação. Na dúvida, leia a regra e
   não a lista. Saída de IA que chega ao aluno nasce pendente de aprovação humana, com uma só exceção:
   a resposta do Tutor.

### 5.5 Uma tela nova

Exemplo: as disciplinas da coordenação (`apps/web/src/api/estrutura.ts` e a tela que usa `consultaDisciplinas`).

1. **A consulta**, com `queryOptions` e a chave do assunto:
   ```ts
   export const consultaDisciplinas = queryOptions({
     queryKey: [...CHAVE_DA_ESTRUTURA, 'disciplinas'],
     queryFn: ({ signal }) => lerPaginas<Disciplina>('/v1/disciplinas', listaDeDisciplinasResponseSchema, signal),
   })
   ```
   A resposta é validada pelo mesmo esquema de `shared` que a API usa.
2. **A tela** faz `useQuery(consultaDisciplinas)` e trata os quatro estados da regra 50.5:
   - carregando, com `EstadoCarregando`;
   - erro, com `EstadoErro`, que tem "Tentar de novo";
   - vazio, com `EstadoVazio`;
   - com dado.
   
   Os três primeiros ficam em `componentes/estado/`.
3. **A mutação** usa `useEnvioUnico` (`componentes/dialogos.tsx`), que trava o duplo clique, com `onSuccess`
   invalidando a chave do assunto.
4. **A rota** entra no `rotas.tsx` da área.
5. **O visual:**
   - só os tokens de `estilos.css`, porque o teste reprova cor fora da lista;
   - os componentes de `componentes/ui/`;
   - nada que pese no Chromebook (regra 50);
   - a tela funciona em 360 px de largura, com alvo de toque de pelo menos 24 px, e de 44 px na ação principal.
6. **Teste:**
   - de componente, para a regra da tela (`*.test.tsx`, com jsdom);
   - e2e em `e2e/`, que roda nos projetos `chromebook` (1366×768, CPU lenta) e `celular` (360×800, toque);
   - toda tela precisa funcionar nos dois (D51).

### 5.6 O teste de isolamento

Todo módulo novo entrega um (regra 10.5). Exemplo: `apps/api/test/estrutura-isolamento.int.test.ts`.

O exemplo monta duas escolas completas, A e B, com a `BancadaDeSessoes`:

```ts
const coordenacao = await bancada.escolaComSessao('coordenador')
const disciplina = await criado(post(coordenacao, '/v1/disciplinas', { nome: 'Química' }))
```

Depois, ele confere que a A não lê, não altera nem descobre nada da B: a resposta é 404, igual à de um id que não
existe, porque o 403 confirmaria que o id existe. Ele também confere que o estado da B no banco ficou idêntico.

**O segundo caso, que se esquece,** depende do alcance (§5.1, passo 5). A outra escola é barrada pelo `escolaId`; o
colega da mesma escola, só pelo alcance do objeto. Os dois recebem o mesmo 404:
- **`turma_vinculada`:** o professor da mesma escola sem vínculo confirmado naquela turma, ou com o vínculo pendente,
  contestado ou encerrado. Quando a linha tem disciplina, também o professor com vínculo na turma em **outra**
  disciplina.
- **`proprio`:** outra pessoa da mesma escola, com o mesmo papel, pedindo a linha que não é dela.

A pergunta que valida o teste: **se eu apagar o `eq(x.escolaId, requireEscolaId())`, ou a conferência do
vínculo, do repository, ele quebra?** Se não quebra, ele não testa nada.

---

## 6. Testes

| Projeto | Arquivo | O que tem | Comando |
|---|---|---|---|
| `unidade` | `x.test.ts`, ao lado do código | regra pura, sem banco. `.tsx` com `// @vitest-environment jsdom` | `npm run test:unidade` |
| `integracao` | `x.int.test.ts`, em dois lugares (abaixo) | service, repository e HTTP com Postgres e Redis reais | `npm run test:integracao` |
| `infra` | `infra/test/*.int.test.ts` | borda, métricas, alertas e jobs contra o compose inteiro | `npm run test:infra` |
| `processo` | `tools/processo/**/*.int.test.ts` | o git hook nativo contra um git de verdade, num repositório temporário, sem compose | `npm run test:processo` |
| e2e | `e2e/*.spec.ts` | o fluxo como a pessoa faz, em `chromebook` e `celular` | `npm run test:e2e` |

**Onde fica a integração da API.** Em dois lugares, e nos dois há teste que sobe a API com o `subirApi`:
- **Ao lado do módulo** (`apps/api/src/<modulo>/x.int.test.ts`): o do service e do repository, e muitas vezes também
  o HTTP. Por exemplo, `atividade/atividade-isolamento.int.test.ts` e `tutor/tutor.int.test.ts` sobem a API, e
  `sessao/convite/convite.repository.int.test.ts` testa o repository sem HTTP.
- **`apps/api/test/`:** o que cruza mais de um módulo (`virada-do-ano`, `ciclo-de-vida`), o `arquitetura.test.ts`, e os
  HTTP de módulos que já os guardavam lá (`sessao-matricula`, `estrutura`). A sessão usa os dois lugares.

Teste novo vai para onde o módulo já guarda os seus.

**Como a integração roda:**
- Ela sobe sozinha o compose de teste (`educa-teste`, com as portas de `infra/teste.env`) e aplica as migrations.
- `EDUCA_BANCO_NOVO=1` começa com o banco limpo.
- O banco de teste acumula escolas de outras execuções, então o teste filtra pelo que ele mesmo criou.

**Onde estão os apoios:**
- `apps/api/test/api-com-sessao.ts`: `subirApi` e `chamar`;
- `apps/api/test/sessao-de-teste.ts`: `BancadaDeSessoes`;
- `e2e/__fixtures__/`.

**O que é proibido:** `.skip`, `.only`, teste comentado, `any` para calar o compilador e asserção que sempre passa. O
lint barra parte disso. A pergunta da regra 40 vale para todo teste: **se eu apagar a regra de negócio, este teste
falha?**

---

## 7. As travas: o que a máquina não deixa passar

| Trava | O que barra | Onde |
|---|---|---|
| Boot da API | rota sem `@RequirePermissao` ou `@Public` | `PermissaoBootCheck` |
| Lint `guardas/log-sem-dado-pessoal` e `log-sem-conteudo-montado` | nome, nota ou conteúdo em log | `tools/guardas/regras-log.mjs` |
| Lint `guardas/sdk-de-ia-so-no-adaptador` | import de SDK de IA fora do adaptador (não a chamada ao adaptador: essa é da revisão) | `tools/guardas/regras-ia.mjs` |
| Lint `guardas/teste-sem-desligar` | `.skip`, `.only`, `.todo` | `tools/guardas/regras-teste.mjs` |
| Lint de entrada | `@Body()`, `@Query()` ou `@Param()` sem pipe em todo controller da API, e `@Req()` cru fora de `sessao/` e `operacao/` | `eslint.config.mjs` |
| Lint do kit | `componentes/ui/` importando `api/`, `areas/` ou `sessao/` | `eslint.config.mjs` |
| Lint de tabela | importar tabela do núcleo fora de um repository | `tools/guardas/tabelas-do-nucleo.mjs` |
| Lint `guardas/erro-tipado` | `throw new Error(...)` ou literal lançado em produção, e `InvariantException` com motivo que não é texto fixo | `tools/guardas/regras-erro.mjs` |
| `dependency-cruiser` | import contra a direção `shared ← nucleo ← apps`, app importando app, produção importando teste, controller importando repository ou Drizzle, service importando Drizzle, repository importando service, `sessao/` e `credencial/` por fora do `index.ts`, e ciclo | `tools/guardas/camadas.cjs`, `npm run guarda:camadas` (dentro do `npm run lint`) |
| ESLint `complexity`, `max-lines-per-function`, `max-depth` | função acima de 10 de complexidade, 80 linhas de código ou 4 níveis de aninhamento. O que já passava disso em 22/10/2026 está em `eslint-suppressions.json`, que só encolhe: supressão nova reprova | `eslint.config.mjs`, `tools/guardas/catraca.test.ts` |
| Teste dos repositories | repository sem prova de escopo nem motivo escrito | `tools/guardas/repositories-com-escopo.test.ts`, sobre `escopo-dos-repositories.ts` |
| Teste do tamanho de pasta | pasta de produção da API ou da web com mais de 25 arquivos direto nela | `tools/guardas/tamanho-das-pastas.test.ts` |
| `arquitetura.test.ts` | tabela sem `escola_id` fora das exceções, tabela sem classificação de retenção, leitura entre escolas fora do lugar certo, classe cercada (`PainelRepository`, `ContaGlobalRepository`, `ResolucaoDeTenantRepository`) citada fora da zona dela | `apps/api/test/arquitetura.test.ts` |
| Teste de tokens | cor fora da paleta | `apps/web/src/estilos.test.ts` |
| `size-limit` | bundle da web acima do teto | `.size-limit.json` |
| `gitleaks`, `npm audit` e `knip` | segredo no código, dependência vulnerável, dependência usada sem estar declarada ou declarada sem uso | `npm run guarda:segredo`, `guarda:dependencias` |

---

## 8. Comandos

```bash
npm ci                         # dependências (sempre ci, nunca install, para respeitar o lock)
docker compose up              # sobe tudo; web em http://127.0.0.1:58080, API pela borda em :53000/saude, Grafana em :53300
npm run build                  # compila os pacotes na ordem certa
npm run typecheck              # tipos da raiz, do e2e, da infra e de cada workspace
npm run lint                   # ESLint sem aviso tolerado, as guardas e o dependency-cruiser (guarda:camadas)
npm run test                   # unidade e integração
npm run test:e2e               # Playwright nos projetos chromebook e celular
npm run test:infra             # contra o compose inteiro (~16 min)
npm run guarda:dependencias    # npm audit e knip
npm run db:gerar               # gera a migration a partir do schema
npm run ops:<comando>          # operação de terminal (escola, convite, retenção...)
```

Ainda não há `npm run dev` com recarga a quente: a stack sobe pelo compose. O processo de construção com agentes
(portão da tarefa, esteira, revisores) está no `README.md` e em `.claude/skills/seguir/`.

---

## 9. Nomes nossos e o equivalente de mercado

| Aqui | Conceito de mercado |
|---|---|
| `JobOutbox` + tabela `job_registro` | Transactional outbox |
| despachante (`apps/despachante`) | Outbox relay |
| `Reconciliacao` | Outbox sweeper (republica o que o Redis perdeu) |
| `JobNotificationListener` | Listener de Postgres `LISTEN/NOTIFY` |
| `EscolaConcurrencyLimiter` | Limite de concorrência por tenant (semáforo distribuído no Redis, em Lua) |
| `ExecutorDeJobs` e `Processador` | Registro de job handlers por tipo |
| `DomainException` + `ErrorCode` | Domain exception com código de erro |
| `InvariantException` | `IllegalStateException`: o que não pode acontecer, com motivo em texto fixo |
| `AllExceptionsFilter` | Global exception handler (`@ControllerAdvice`) |
| `@RequirePermissao` + `MATRIZ` | Autorização declarativa (`@PreAuthorize`) com matriz de permissões |
| `AuthGuard`, `DeLimite`, `DeSessao`, `DePermissao` | Filter chain de segurança |
| `PermissaoBootCheck` | Verificação fail-fast no boot |
| contexto (`AsyncLocalStorage`) | ThreadLocal / TenantContext |
| `@Unscoped` | Bypass explícito e justificado do filtro de tenant |
| `RateLimiter` | Rate limiter (Redis, com reserva em memória) |
| `ContadorEmJanela` | Rate limiter por janela de tempo (login, sala e pedidos de IA do Assistente) |
| `ContadorDeTentativas` | Proteção contra força bruta / lockout de login |
| `SemaforoDeHash` | Bulkhead (limita o argon2 ao mesmo tempo) |
| `GracefulShutdown` | Graceful shutdown |
| `Heartbeat` | Heartbeat / liveness |
| `LLMProvider` / `LLMGateway` | Porta hexagonal e gateway de LLM |
| `FakeAdapter` | Fake adapter / test double |
| `AgendadorDeExecucoes` | Comando assíncrono idempotente (202 Accepted) |
| `AuditoriaRecorder` | Audit log |
| `UsageMeter` | Usage metering |
| `BancadaDeSessoes` | Test fixture builder |

---

## 10. Para ler depois

| Documento | O que tem |
|---|---|
| `docs/arquitetura.md` | o desenho e as camadas |
| `docs/modelo-de-dados.md` | as tabelas e as exceções de escopo |
| `docs/lgpd.md` | o mapa de dados pessoais; leitura obrigatória antes de tocar campo de pessoa |
| `docs/agentes.md` | os agentes de IA e a autonomia de cada um |
| `docs/infra.md` e `docs/runbook.md` | carga, topologia e o que fazer quando um alerta toca |
| `docs/decisoes.md` | toda decisão, com o motivo; leia antes de rediscutir uma |
| `.claude/rules/` | as regras de cada área, a resumida de cada documento |
