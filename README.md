# Turmma

Este repositório contém o código e, junto dele, o **contexto, as regras e o processo** que
governam a construção do Turmma. A ideia é simples: nada é implementado antes de existir
um documento que diga o que fazer, outro que diga como fazer, e uma lista de tarefas
aprovada. É o que se chama de desenvolvimento guiado por especificação.

**Quem chega ao código começa por [`docs/guia-do-desenvolvedor.md`](docs/guia-do-desenvolvedor.md)**: onde fica cada
coisa, o caminho de uma requisição, as receitas de endpoint, tabela, job e tela, e o que a máquina não deixa passar.

O motivo de fazer assim, neste projeto especificamente: estamos lidando com dado de menor
de idade, com exigência legal de supervisão humana sobre IA, e com um comprador que cancela
o contrato se algo vazar. Improvisar arquitetura no meio da implementação sai caro aqui de
um jeito que não sai em um produto comum.

> **O produto se chama Turmma** (D54). O repositório, os pacotes, o banco, o compose e os
> comandos continuam `educa`: a renomeação técnica é trabalho próprio e não vale o risco no
> meio do F1. Quando você ler "Educa.ia" em nome de pasta, de imagem ou de projeto compose, é
> isso — o nome do produto, em texto, é Turmma.

---

## Rodando local

Pré-requisitos: Docker com Compose (v2.20 ou mais novo) e Node 22 (versão em `.nvmrc`).
Nenhuma conta em serviço externo e nenhum `.env` próprio: tudo sai de `.env.example`, que
só tem valor sintético.

```bash
npm ci
docker compose up        # Postgres (pgvector), Redis de fila, Redis de cache, storage S3, migrar, borda, 2 APIs, 2 realtimes, 2 despachantes, 2 workers interativos, 2 workers de lote, observabilidade e web
```

A web fica em http://127.0.0.1:58080, em pt-BR e responsiva até 360 px: `/entrar` é a entrada da
equipe por e-mail e senha, `/` é a área de quem entrou (o token fica só em memória, e a sessão volta
pelo cookie `HttpOnly` da renovação), e `/sistema` é a casca do estado do sistema, pública, que busca
`GET /v1/sistema/estado` e `/v1/sistema/avisos` (rotas anônimas; os avisos vêm de `AVISOS_SISTEMA`) e
mostra carregando, vazio, erro e com dado com os componentes de `apps/web/src/components/states/`; a API responde pela borda
(Caddy, `infra/Caddyfile`) em http://127.0.0.1:53000/saude, e o realtime em
http://127.0.0.1:53000/socket.io/, que autentica o handshake pela mesma sessão gravada da API. A borda balanceia duas instâncias de cada, e
`docker compose restart api-1` troca uma instância sem derrubar requisição. Antes das
instâncias, o serviço `migrar` aplica as migrations (`packages/nucleo/drizzle`) e sai. Todo
job nasce em `job_registro`, os dois despachantes o levam à fila dele no Redis (interativa,
normal ou lote) dentro das vagas da escola, e os workers de cada prioridade o executam; `POST /v1/sistema/jobs-sinteticos` (com token) cria um job de teste. O painel "Fundação — rota, fila e escola" fica no Grafana local, em
http://127.0.0.1:53300 (pasta Educa.ia), com latência e erro por rota, espera e tamanho da fila por
escola, vagas, realtime, pool e seguro de limite; o Prometheus da mesma imagem responde em
http://127.0.0.1:59090. As três regras de alerta (`infra/grafana/alertas/`) ficam na pasta Educa.ia
alertas do mesmo Grafana, cada uma com a sua entrada em `docs/runbook.md`, e `npm run ensaio:alertas`
provoca as três condições com o ambiente de pé e confere que disparam e voltam a normal. As portas publicadas escutam só no loopback e estão em
`.env.example`. Para mudar alguma na sua máquina, crie um `.env` na raiz: ele sobrepõe o
exemplo no `docker compose up`, mas testes e esteira usam sempre o `.env.example`.

Testes e esteira sobem um projeto compose separado, `educa-teste`, com as portas de
`infra/teste.env`. Os testes de integração param e pausam o Postgres desse projeto para
provar a saúde da API, e os `ci:*` apagam os volumes dele no fim, sem tocar no ambiente de
desenvolvimento.

Dois checkouts na mesma máquina não dividem esse projeto: cada um escolhe o seu **número de
ambiente de teste**, de 0 a 3, na variável `EDUCA_AMBIENTE_TESTE` ou, sem ela, no arquivo
`.processo/ambiente` da raiz do checkout (só o número; a pasta é ignorada pelo git). Sem os
dois vale o 0, que é o `educa-teste` acima e o da esteira. Com N de 1 a 3 o projeto é
`educa-teste-N` e toda porta de `infra/teste.env` sobe N × 1000 (a web do ambiente 1 fica em
`127.0.0.1:29090`). Número inválido é erro, e não cai no 0. Quem decide é
`tools/ci/compose.ts`, e integração, e2e e vitrine leem de lá. Medido em 11/10/2026: duas
integrações inteiras em paralelo levaram o mesmo que uma (709 e 711 s contra 726). Fora do ambiente
0, a imagem que o compose constrói leva a etiqueta do ambiente (`educa-api:teste-1`), para o e2e de
um checkout não rodar sobre o código de outro. É o que deixa as tarefas de uma spec correrem ao
mesmo tempo, cada uma na sua linha (D79).

| Comando | O que faz |
|---|---|
| `npm run typecheck` | tipos de todos os pacotes |
| `npm run lint` | ESLint |
| `npm run test` | unidade e integração; a integração sobe Postgres, Redis e storage sozinha |
| `npm run test:infra` | integração da borda, métricas, alertas e jobs contra o compose inteiro (uns 16 min); fica fora do `test` e roda quando a tarefa mexe em infra (D52) |
| `npm run test:e2e` | mede o teto do bundle da web (size-limit, 150 kB em brotli), sobe o compose de teste completo e roda o Playwright com axe nos projetos `chromebook` (CPU ×4, Fast 3G) e `celular` (360 × 800, toque, CPU ×4, rede móvel lenta), deixando o ambiente de pé |
| `npm run ci:verificar`, `ci:integracao`, `ci:infra`, `ci:e2e` | exatamente o que a esteira roda; derrubam o ambiente no fim. Na esteira o e2e roda em oito fatias, `ci:e2e -- --shard=<i>/8` |
| `npm run ci:conferir-entregas` | a terceira camada do RF14: confere, em `origin/develop..HEAD`, que todo commit com código tem a marca `(tarefa N.0)` ou `(correção <slug>)` e a linha `Revisões:`, ou `Fora do processo: <motivo>`. A esteira o roda só em `spec/**` e `correcao/**`; sai 2 sem a `origin/develop` |
| `npm run db:gerar` | gera a migration a partir do schema Drizzle (`packages/nucleo/src/db/schema`); revise o SQL antes de versionar |
| `OPERADOR=<voce> npm run -s ops:escola -- rede criar --nome <nome> --tipo prefeitura\|grupo\|independente` e `escola criar --rede <uuid> --nome <nome> --slug <endereco>` | cria a rede e a escola pelo comando, imprimindo só o id, e grava a auditoria com o operador; o painel da operação (A0b) cria pelo mesmo caso de uso. Não há outro caminho de criação |
| `OPERADOR=<voce> npm run -s ops:convite-coordenador -- --escola <slug> --email <e-mail> --nome <nome> --saida <arquivo>` | cria o convite do primeiro coordenador (72 h, uso único) e grava o token só no arquivo, com modo 0600; o terminal mostra o id do convite e o caminho do arquivo. Mande o link `/convite#<token>` à pessoa e apague o arquivo. Com convite em aberto (pendente ou vencido) ou coordenação ativa na escola, recusa com `CONFLITO`: revogue antes, ou refaça pelo painel |
| `OPERADOR=<voce> npm run -s ops:revogar-convite -- --convite <uuid>` | revoga o último convite da escola, pendente, vencido ou aceito sem a primeira entrada, grava a auditoria com o operador e imprime só `ok` ou o código do erro (`CONFLITO` com coordenação ativa, ou se o convite não é o último). Não desfaz uma ativação que já aconteceu: aí a escola desativa o usuário |
| `OPERADOR=<voce> npm run -s ops:retencao -- ajustar --escola <uuid> --categoria <categoria> --meses <n> --contrato <número>` | ajusta o prazo de uma categoria da retenção da escola (F3), dentro do piso, do teto e das travas do catálogo, e grava `retencao.ajustada` com o operador e o número do contrato; `listar --escola <uuid>` imprime o prazo efetivo de cada categoria. Fora do limite, ou numa categoria que não se ajusta: `RETENCAO_FORA_DO_LIMITE`, sem gravar nada |
| `OPERADOR=<voce> npm run -s ops:suboperador -- cadastrar --chave <chave> --nome <empresa> --finalidade <o que faz> --pais <BR> --categorias <a,b> --contrato <código> --veda-treinamento sim\|nao (--todas \| --escolas <uuid,uuid>)` e `encerrar --chave <chave>` | cadastra e encerra o suboperador, a empresa que recebe dado da escola (F3), com a auditoria do operador; a coordenação a vê em Privacidade, "Empresas que recebem dados". `--todas` é a que atende toda escola; `--escolas`, só as listadas. Já há vigente com a chave: `CONFLITO`; escola da lista inexistente, ou nada vigente para encerrar: `NAO_ENCONTRADO`. O encerrado fica no histórico, e a chave pode ser cadastrada de novo |
| `OPERADOR=<voce> npm run -s ops:incidente -- registrar --arquivo <incidente.json>` | registra um incidente de segurança (F3): o JSON traz `conhecidoEm` (quando a Turmma soube) e uma seção por escola afetada (`escola`, `circunstancias`, `categorias`, `titularesEstimados`, `risco`, `contencao`, `correcao`), sem dado de titular. Cada coordenação lê só a seção da escola dela, em Privacidade, "Incidentes", e confirma o recebimento; o alerta "Incidente sem confirmação em 24 h" mede da data do `conhecidoEm`. Texto que cita o nome ou o id de outra escola do mesmo arquivo, campo inválido ou arquivo acima de 256 KB: erro de argumento (código 2), sem gravar nada e sem repetir o conteúdo; escola inexistente: `NAO_ENCONTRADO`. Os textos descrevem o caminho e o volume, nunca quem: sem nome de aluno, professor ou responsável. O comando só recusa o nome inteiro ou o id de outra escola do arquivo, não o nome parcial dela nem o de uma pessoa, então revise os textos antes de registrar; rodar o mesmo arquivo duas vezes grava dois incidentes |
| `OPERADOR=<voce> npm run -s ops:privacidade -- --escola <uuid>` | imprime, em JSON, só as **contagens** da privacidade de uma escola (F3): pedidos por estado, eliminações agendadas e vencidas, arquivos ativos e vencidos, suboperadores vigentes, incidentes avisados e sem confirmação, e quantas categorias do expurgo terminaram na última vez, com a data. Nenhum nome, id de titular ou texto de pedido: a operação vê se o atendimento e o expurgo andam, e nunca de quem |
| `OPERADOR=<voce> npm run -s ops:redefinir-mfa -- --usuario <uuid> --pedido <número>` | apaga o segundo fator da conta do usuário, a pedido formal da escola (o número é o protocolo do pedido), grava a auditoria em cada escola da conta com o operador e imprime só `ok` ou o código do erro |
| `npm run -s ops:sessao-sintetica -- --escola <uuid> --papel aluno\|professor\|coordenador [--quantidade <n>]` | cria, na escola informada, `n` usuários sintéticos com sessão real e imprime o token de cada um, um por linha (vale 10 min; a sessão, 12 h); é o único token que a API e o realtime aceitam, e só roda com `AMBIENTE=local` |
| `npm run carga` | cenário de carga "justiça entre escolas": sobe o projeto `educa-carga` (portas de `infra/carga.env`, CPU fixa por serviço em `infra/compose.carga.yml`), roda o k6 (`infra/k6/justica-entre-escolas.js`) na fase base, na do expurgo e da troca de nome da escola A (1 milhão de linhas vencidas, com o `pg_stat_statements` do Postgres) e na de carga, confere `job_registro` e derruba tudo; sai vermelho se um critério falhar (uns 12 min). Manual: roda de novo quando uma tarefa mexe no caminho quente |
| `npm run carga:controle-negativo` | o mesmo cenário com a vaga por escola desligada (`VAGAS_POR_ESCOLA_DESLIGADAS=true`); sai verde só se o cenário reprovar pela justiça entre escolas |

A esteira (`.github/workflows/ci.yml`) roda em todo push no `main` e só chama os `ci:*`.
Enquanto não existe staging (D31), ela é o portão: commit vermelho no `main` segura a
próxima tarefa até voltar a verde.

---

## Por onde começar a ler

Na primeira vez, nesta ordem. São uns quarenta minutos e depois disso tudo o resto faz
sentido.

1. **`docs/visao-produto.md`** — o que estamos construindo, para quem, e por quê. Começa
   com um dia real de uma professora. Se você só puder ler um arquivo, leia este.
2. **`docs/fluxos.md`** — os sete caminhos que o sistema precisa fazer funcionar, narrados
   como acontecem na escola.
3. **`CLAUDE.md`** — o índice das decisões (número e título); o texto completo de cada
   decisão e os conflitos já resolvidos estão em `docs/decisoes.md`, e o que está em aberto, em
   `docs/decisoes-em-aberto.md`. É o que evita rediscutir a mesma coisa toda semana.
4. **`docs/lgpd.md`** — o documento mais importante do repositório. Leia antes de tocar em
   qualquer campo que guarde dado de pessoa.
5. **`docs/regulacao.md`** — o que a lei exige, virado em requisito: diretrizes do CNE, ECA
   Digital, Decreto 12.880/2026, direito autoral do material, risco à vida.
6. **`docs/conformidade-mec.md`** — o que a escola pergunta na hora de comprar, e o que
   entregamos por escrito. Leia antes de PRD de governança, tutor, correção ou venda.
7. **`ROADMAP.md`** — a ordem de construção e o que significa "pronto" em cada etapa.

Os demais documentos são de consulta, não de leitura corrida. Para saber onde o projeto
está agora, rode `node tools/processo/estado.ts`, ou `/seguir`. Ao abrir uma sessão do Claude Code, um hook já mostra a
funcionalidade em andamento e o próximo passo.

---

## O que tem aqui

### Contexto
| Arquivo | O que responde |
|---|---|
| `docs/visao-produto.md` | O que é o produto, quem usa, o que o diferencia, onde pode dar errado |
| `docs/fluxos.md` | Os sete fluxos principais, com os casos de borda que eles trazem |
| `docs/glossario.md` | O vocabulário do domínio escolar que usamos no código |
| `docs/interface.md` | As telas por papel, o chat que abre ferramenta, o feed de agentes |
| `docs/negocio.md` | Mercado, preço, concorrência e como a venda acontece |
| `CLAUDE.md` | Índice das decisões (número e título), as seis regras, o recorte e o mapa |
| `docs/decisoes.md` | O texto completo de cada decisão, com o motivo e as revisões, e os conflitos já resolvidos |
| `docs/decisoes-em-aberto.md` | As decisões em aberto, cada uma com dono e momento |
| `TODO.md` | O que trava o projeto e não se resolve programando |

### Restrições
| Arquivo | O que responde |
|---|---|
| `docs/lgpd.md` | Como tratamos dado pessoal e por onde SaaS de educação vaza |
| `docs/regulacao.md` | O que o CNE e a lei exigem, traduzido em requisito |
| `docs/conformidade-mec.md` | O checklist de compra do MEC virado em requisito, o dossiê que a escola exige e a avaliação de impacto algorítmico |
| `docs/infra.md` | Modelo de carga, topologia, limites, disponibilidade e operação |
| `docs/runbook.md` | O que fazer quando cada alerta dispara |
| `.claude/rules/` | As regras que toda implementação respeita, com o porquê de cada uma |

### Desenho técnico
| Arquivo | O que responde |
|---|---|
| `docs/arquitetura.md` | Como o sistema é montado e por quê |
| `docs/modelo-de-dados.md` | As entidades e como elas se relacionam |
| `docs/agentes.md` | O que é um agente aqui e o que cada um pode fazer sozinho |
| `docs/ingestao.md` | Como o material da escola vira base de conhecimento |

### Processo
| Arquivo | O que responde |
|---|---|
| `.claude/skills/<comando>/` | Os comandos do fluxo, cada um com o seu template na mesma pasta |
| `.claude/skills/<técnica>/` | Skills de terceiros para a stack (NestJS, Drizzle, React…), versões em `skills-lock.json` |
| `.claude/agents/` | Os especialistas que auditam cada tarefa |
| `.claude/hooks/` | O hook que mostra o estado do projeto ao abrir a sessão |

---

## Como o fluxo funciona

O processo roda no Maestri (D78). Você digita um comando só, no terminal Maestro do térreo:

```
/seguir [funcionalidade]
    O Orquestrador lê a fase (tools/processo/estado.ts), monta o time e conduz até a próxima
    decisão que é sua. O mesmo comando começa, continua e retoma depois de uma queda.
```

Todos os papéis rodam no Claude Code (D78).

O time é fixo, no térreo: você vê sempre as mesmas cinco caixas (Orquestrador, Arquiteto,
Implementador, Mesa e Validador). O que muda a cada tarefa ou fase é a sessão dentro de cada uma,
reiniciada já apontada para o andar da spec. Cada fase tem o seu agente e o seu procedimento
(`.claude/skills/<nome>/`):

```
Arquiteto (Opus), falando direto com você
    criar-prd        o que vamos construir e por quê           → prd.md
    criar-techspec   como vamos construir                      → techspec.md
    revisar-spec     os guardiões auditam o desenho            → revisao-spec.md
    criar-tasks      tarefas entregáveis, com o porte          → tasks.md + N_task.md

Implementador (Sonnet) e Mesa de revisão (Sonnet)
    executar-task    uma tarefa, em processo novo, com portão local
    revisar-tarefa   a Mesa chama os revisores e devolve a ordem de correção exata
    corrigir         defeito fora de tarefa, com teste que reproduz

Validador (Opus), isolado de quem implementou
    validar          a funcionalidade inteira contra o PRD, RF a RF → validacao.md

Depois do pouso
    retro            mede rodadas e reprovações, por revisor e por modelo, e propõe ajustes

Orquestrador (Opus), enquanto o time trabalha
    vigia            a cada 30 minutos, confere se alguém está preso, sumiu ou espera resposta
```

Cada spec vive num **andar** do Maestri, com a branch `spec/<funcionalidade>`, e só entra na
`develop` por pouso, com a sua palavra. As tarefas correm em **linhas**, cada uma num andar próprio:
as que o Arquiteto autorizou em paralelo, até três ao mesmo tempo, e as outras uma por vez (D79). A
esteira roda em todo push da branch. O Orquestrador para em seis decisões: aprovação do PRD; mudança
de desenho ou de critério de aceite; ressalva da validação; propostas da retrospectiva; decisão de
produto; e o pouso. A Tech Spec e a lista de tarefas são aviso: a construção começa 30 minutos
depois da lista, sem objeção sua. O que espera você aparece no terminal do Orquestrador, com o andar marcado como bloqueado.

Defeito avulso e decisão de produto você pede em texto ao Orquestrador. Como os agentes conversam
está em `.claude/skills/seguir/protocolo.md`.

Cada etapa tem um motivo:

**O PRD existe para separar decisão de produto de decisão técnica.** Quando as duas se
misturam, você acaba com uma arquitetura que resolve um problema que ninguém tinha.

**A Tech Spec existe para que a arquitetura seja decidida com calma, uma vez.** Se ela for
decidida no meio da implementação, cada tarefa toma uma decisão diferente e o sistema fica
sem unidade.

**A lista de tarefas existe para que cada pedaço seja pequeno e verificável.** Vinte tarefas
de um dia são melhores que quatro de uma semana, porque cada uma passa por um portão.

**O contexto limpo por tarefa existe porque contexto acumulado polui.** Um subagente que já
implementou seis tarefas carrega detalhes irrelevantes e começa a improvisar.

**A validação existe porque "todas as tarefas feitas" não é "funcionalidade pronta".** Cada
portão de tarefa olhou um pedaço; só a validação confere o PRD inteiro, e é ela que pega o
RF que nenhuma tarefa cobriu.

---

## Os portões de qualidade

Nenhuma tarefa é concluída sem passar por estes. Quatro deles têm poder de veto, e veto é
falha da tarefa, não sugestão.

| Portão | O que impede | Veto |
|---|---|---|
| `tenancy-guardian` | Vazamento entre escolas | sim |
| `privacy-guardian` | Exposição de dado pessoal e de menor | sim |
| `conformidade-reviewer` | Descumprimento das diretrizes do CNE | sim |
| `infra-guardian` | Sistema que cai ou perde resposta na manhã de segunda | sim |
| `test-engineer` | Teste que não prova nada | não |
| `llm-integrator` | Chamada de IA sem perfil, sem orçamento, sem registro | não |
| `pedagogia-reviewer` | Conteúdo que um professor de verdade rejeitaria | não |
| `frontend-reviewer` | Tela que não funciona em Chromebook de escola ou no celular | não |
| `domain-researcher` | Regra externa inventada em vez de pesquisada | não |

E o portão automático. Em cada tarefa, o **portão da tarefa**: tipos, lint, a unidade inteira, os
testes que a tarefa alterou e as mutações que ela declara (`node tools/processo/portao-local.ts
--tarefa`), em minutos. Em cada push da branch da spec, a **esteira**, com tudo, sem ninguém esperar
por ela (D79).

Em tarefa com tela, a revisão **vê a tela**: `tools/vitrine/` monta duas escolas sintéticas no ambiente
de teste, uma cheia e uma vazia, e fotografa a página como coordenação, professora ou aluno, no
computador e no celular. O Implementador olha antes do portão, a Mesa entrega as fotos a todos os
revisores, e o Validador fotografa cada requisito com tela no fim da spec. Serve também para você:
`node tools/vitrine/vitrine.ts mostrar` dá os logins para abrir no navegador.

---

## Um exemplo de ponta a ponta

Suponha que a próxima funcionalidade seja `onboarding-por-convite`.

1. Você roda `/seguir onboarding-por-convite`. O Orquestrador cria o andar da spec e põe o Arquiteto
   para trabalhar. O Arquiteto lê o contexto, confirma no
   roadmap que `identidade-e-tenancy` está concluída, e faz perguntas sobre o que ficou em
   aberto. Não pergunta o que o `CLAUDE.md` já decidiu.
2. Sai um PRD com os requisitos numerados, a matriz de quem pode fazer o quê, os casos de
   borda (aluno que chega em maio, dois nomes iguais na turma) e o dado pessoal envolvido.
3. Com o PRD aprovado, o Arquiteto segue para a Tech Spec: explora o código existente,
   pesquisa o que não sabe, e escreve como fazer: entidades de convite e lista de nomes,
   rotas, validade de token, o que vai para fila. As seções de isolamento, dado pessoal e
   conformidade são obrigatórias.
4. Com a spec revisada pelos guardiões, o Arquiteto consulta o `test-engineer` para definir os
   cenários, monta a lista com o porte de cada tarefa, e **mostra antes de gerar arquivo**. Você
   aprova ou corrige.
5. O Orquestrador executa uma tarefa por vez, sem você. Se a tarefa 3 reprovar no
   `privacy-guardian`, a Mesa de revisão devolve a ordem de correção ao Implementador; na segunda
   reprovação seguida a tarefa sobe de modelo, e na terceira o Orquestrador para e te chama. Não
   segue para a 4 com a 3 aberta.

---

## Regras de convivência com este repositório

- **Decisão nova vai para `docs/decisoes.md`**, com o motivo, e uma linha no índice do
  `CLAUDE.md`, pelo procedimento `registrar-decisao`. Decisão que não está escrita será rediscutida daqui a
  duas semanas.
- **Requisito que vem de lei cita a fonte.** `docs/regulacao.md` separa o que foi lido no
  texto oficial do que veio de imprensa, e marca o que está "a confirmar". Requisito legal sem
  fonte é achismo com cara de obrigação.
- **Campo pessoal novo vai para a tabela de `docs/lgpd.md`** na mesma tarefa em que é criado.
- **Termo novo vai para o glossário.** Metade dos bugs de domínio vem de duas pessoas
  chamando a mesma coisa de nomes diferentes.
- **Regra que atrapalhou três vezes deve ser discutida, não contornada em silêncio.**

---

## Começando agora

Rode `/seguir` no terminal Maestro para ver onde o projeto parou e continuar.

E não pule a `F3 — lgpd-e-titular` para o fim. Ela parece burocracia e é o que protege o
negócio: exportação e eliminação por titular construídas depois viram retrabalho em todas
as tabelas do sistema.

Três coisas que valem saber antes de escrever a primeira linha de qualquer funcionalidade:

**Nota nunca existe sem autor humano**, e em redação e discursiva a IA não chega nem a propor:
não corrige, não avalia, não pré-corrige (D55, regra 70).

**Cada funcionalidade de alto risco nasce com a avaliação de impacto escrita** — Tutor,
correção, diagnóstico, sinais, adaptação (D60, `docs/conformidade-mec.md` seção 7).

**A escola compra por documento, não por demonstração.** O que ela exige está listado em
`docs/conformidade-mec.md` seção 5, e boa parte disso é a tela de governança exportada.
