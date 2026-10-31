# Infraestrutura, carga e operação

> **Leia isto antes de escrever código que roda no caminho quente:** login, tutor, modo
> sala, prova online, fila, ou qualquer query em tabela que cresce com o número de alunos.
>
> Depois da LGPD, a infra é o segundo jeito de perder uma escola. O vazamento acaba com a
> confiança da coordenação. A queda no meio da prova acaba com a confiança do professor, e
> sem ele a escola não renova.

Os números deste documento são **estimativas de desenho**, feitas antes de existir uma
escola real. Estão aqui para dimensionar e para o teste de carga ter um alvo. O piloto
substitui cada um por medida real, e quando isso acontecer este arquivo é atualizado.

---

## 1. O que muda quando cada escola traz centenas de usuários

Não importa se o sistema roda numa infra nossa atendendo várias escolas ou numa instalação
dedicada a uma rede: cada escola que entra traz uns 400 usuários de uma vez. Isso é pouco
para qualquer servidor web. O difícil está em outro lugar, e são quatro coisas que um
sistema comum não tem:

**O uso é concentrado.** Quase tudo acontece entre 7h e 18h, de segunda a sexta. Às 7h30
turmas inteiras fazem login no mesmo minuto, às 10h seis turmas usam o tutor ao mesmo
tempo, às 22h não tem quase ninguém. A infra é dimensionada para a manhã de segunda, não
para a média.

**A escola inteira sai por um único IP.** Os Chromebooks passam pelo NAT da rede da escola.
Para o servidor, 400 alunos parecem um usuário só fazendo 400 vezes mais requisições. Rate
limit por IP, que é o padrão de qualquer tutorial, derruba a escola inteira na primeira
aula.

**O gargalo é o provedor de IA, não o banco.** O tutor em sala gera centenas de chamadas de
modelo simultâneas no pico. O provedor tem limite de tokens por minuto, e quando estoura
ele não fica mais lento, ele recusa.

**Uma escola não pode prejudicar a outra.** Uma escola que sobe 300 apostilas ou corrige
900 provas na mesma tarde não pode deixar o tutor das outras nove esperando.

---

## 2. Alvo de escala do primeiro ano (D25)

| Grandeza | Valor de desenho |
|---|---|
| Escolas | até 10 |
| Alunos | ~4.000 (400 por escola) |
| Professores e coordenação | ~450 |
| Pico de alunos simultâneos | ~1.600 (40% dos alunos na manhã de pico) |
| Turmas usando tutor ao mesmo tempo | ~60 (6 por escola) |

A arquitetura precisa **crescer para uma rede municipal sem ser refeita** (D20), mas a
infra do primeiro ano não é dimensionada para isso. Quando um contrato de rede for fechado,
este documento é revisado antes da implantação. Isso vale também se a rede exigir uma
instalação dedicada em vez da infra compartilhada: a topologia da seção 4 é a mesma, só
muda quem é dono do servidor (D12).

---

## 3. Modelo de carga: a manhã de segunda

O cenário que a infra precisa aguentar, e que o teste de carga reproduz.

### 3.1 Login em rajada (7h30)

Sessenta turmas começam a aula e cerca de 2.100 alunos fazem login em uns cinco minutos:
**~7 logins por segundo**, com picos maiores no primeiro minuto.

Hash de senha é caro de propósito. A estimativa era argon2id de 100–250 ms de CPU, com o login
ocupando perto de dois núcleos nesse minuto. A calibração do cenário "login às 7h30" (F1, tarefa
16.0) fixou 30 ms (`t=12`) com 1 CPU por instância da API, porque o hash mais caro não sustentava
a rajada com ataque de dentro da escola; o motivo e a medida estão na Tech Spec da identidade,
seção 5, "Calibração", e o staging recalibra.

**Consequências:**
- O custo do hash é calibrado medindo a rajada no staging, não copiado de tutorial
- O login não compete por CPU com o resto da API. Instâncias separadas ou limite de
  concorrência do hash
- A sessão dura o dia letivo, com renovação silenciosa. Aluno não refaz login a cada aula

### 3.2 Tutor em sala (10h)

| Suposição | Valor |
|---|---|
| Alunos em turmas com tutor liberado | ~1.800 |
| Ativos no tutor ao mesmo tempo | ~50% |
| Ritmo | 1 mensagem a cada 2 minutos |
| **Mensagens por segundo** | **~7,5** |
| Resposta em streaming | ~6 s |
| **Streams simultâneos** | **~45** |
| Tokens por mensagem | ~3.000 de entrada (material, histórico, instrução) + ~250 de saída |
| **Tokens por minuto no pico** | **~1,5 milhão** |

⚠️ Esse último número é o que decide o contrato com o provedor de modelo. O limite de
tokens por minuto padrão de uma conta nova é muito menor que isso. Cache de prompt (a parte
fixa: instrução e material do capítulo) reduz bastante a entrada e precisa ser usado desde
o início (regra 30, item 8).

### 3.3 Prova online (qualquer horário)

Uma turma de 35 alunos, com resposta salva a cada item. É carga pequena para o banco. O
risco aqui não é volume, é **perder resposta** quando a rede da escola oscila (seção 6).

### 3.4 Modo sala

Uns 1.800 WebSockets abertos no pico. Um nó aguenta, mas com mais de um nó as mensagens
precisam de um adaptador em Redis para chegar ao professor certo.

### 3.5 Onboarding de uma escola nova

- Lista de nomes da turma (A1, tarefa 2.0): roda **na hora, dentro do request, sem fila**, porque tem
  teto — até 200 linhas e 64 KB por envio, uma turma por vez, lida e conferida numa transação curta
  (duas buscas por índice que começa pela escola e um `insert` de até 200 linhas). Acima do teto,
  `ENTRADA_INVALIDA`, e nada é lido (Tech Spec da A1, seção 11, regra 00). Planilha da escola inteira
  (400 nomes ou mais, várias turmas) não existe na A1; quando existir, é um job na fila, não um request
- Convite de 40 professores: e-mail enviado pela fila, respeitando o limite do provedor
  de e-mail
- **Reivindicação em sala:** 35 alunos clicam na lista ao mesmo tempo, e dois podem clicar
  no mesmo nome. Resolve-se com restrição única no banco e resposta clara para o segundo
  ("esse nome já foi reivindicado, chame o professor"), não com verificação antes de gravar
- Ingestão de 300 apostilas: horas de CPU de extração. Vai para a fila de baixa prioridade,
  com limite de concorrência por escola

### 3.6 Crescimento de dado (primeiro ano)

| Tabela | Ordem de grandeza |
|---|---|
| `MensagemTutor` | ~7 milhões de linhas/ano (1.800 alunos × 20 mensagens × 200 dias) |
| `TrechoIndexado` | ~36 mil trechos por escola (~200 MB de embeddings), ~2 GB para 10 escolas |
| `Resposta` | centenas de milhares de linhas/ano |
| Storage de arquivos | apostilas em PDF e fotos de prova: dezenas de GB |

Nenhum desses é grande para Postgres, mas `MensagemTutor` precisa de índice por escola,
turma e data desde a primeira migration, e de expurgo pela retenção de 12 meses
(`docs/lgpd.md`).

⚠️ **Busca vetorial com filtro de escola.** Índice HNSW do pgvector com `WHERE escolaId =`
pode devolver menos resultados que o pedido, porque o filtro é aplicado depois da busca no
índice. A Tech Spec do F4 precisa escolher e testar a solução: varredura iterativa do
pgvector, índice parcial ou particionamento por escola. Não verificado.

---

## 4. Topologia

Para dez escolas, operada por uma pessoa (D26):

> **No início, a produção roda numa VM própria** (F18; D26, D31 e D42 revistas em 24/10/2026): o mesmo
> compose, com Postgres, Redis e storage em contêiner, backup diário fora da VM e só a borda exposta pelo túnel
> da Cloudflare. O desenho abaixo, com serviço gerenciado, é o da migração para a AWS.

```
                  ┌───────────────────── região Brasil (D28) ─────────────────────┐
Chromebooks ──▶   │  balanceador ─┬─▶ api (2 instâncias, sem estado)              │
                  │               └─▶ realtime (1–2, adaptador Redis)             │
                  │                                                               │
                  │  worker (1–2) ◀── filas por prioridade                        │
                  │                                                               │
                  │  Postgres gerenciado + pgvector, backup contínuo              │
                  │  Redis gerenciado: filas (sem expulsão de chave)              │
                  │  Redis gerenciado: cache, rate limit, sessão de sala          │
                  │  storage S3-compatível privado                                │
                  └───────────────────────────────────────────────────────────────┘
                                         │ dado minimizado, com contrato (D29)
                                         ▼
                           provedor de modelo principal + reserva
```

Por que assim:

- **Duas instâncias de API desde o início.** Não é pela carga, é para o deploy trocar uma
  de cada vez e para uma instância travada não derrubar a escola
- **API, realtime e worker separados.** A correção de 900 provas não pode tirar CPU do
  login das 7h30. É também o que deixa crescer para rede sem refazer
- **Serviço gerenciado para banco, Redis e storage.** Uma pessoa sem plantão não mantém
  Postgres com replicação e backup na mão. Isso não fere a regra 00: Postgres, Redis e S3
  são padrões abertos, e o sistema continua subindo com `docker compose up`
- **Dois Redis.** BullMQ exige que o Redis nunca expulse chave. Cache e rate limit precisam
  expulsar. No mesmo Redis, um dos dois está configurado errado

### Threads e DNS

Nos processos Node (api, realtime, despachante e worker), a resolução de nome (`dns.lookup`) roda nas
threads do libuv, que são 4 por padrão. Nome que não resolve segura uma thread até o resolvedor desistir,
e são 5 s por padrão. Na esteira de 15/09/2026, com Redis, storage e observabilidade parados, os clientes
Redis e o exportador de métricas reconectando ocuparam as 4 threads. Resolver `postgres` esperou 15 s na
fila, a conexão nova ao banco estourou `BANCO_TIMEOUT_CONEXAO_MS` e o `/saude` foi a 503 com a API de
pé. O banco caiu por causa do DNS de outro serviço.

A correção vale em qualquer lugar em que os processos sobem:

- `UV_THREADPOOL_SIZE=16` (`.env.example`, no compose de cada processo Node)
- resolvedor com `timeout:1` e `attempts:2` (`dns_opt` no compose): nome que não resolve falha em 1 s.
  No musl da imagem alpine, `timeout` é o prazo total e `attempts` só reenvia dentro dele (aos 500 ms),
  então um pacote UDP perdido não derruba a consulta. Em imagem glibc `attempts` multiplica o prazo:
  trocar de imagem exige rever a opção
- a esteira confere as duas (`tools/ci/ambiente.test.ts`). O teste RF2 da borda
  (`infra/test/borda.int.test.ts`), com os serviços parados, derruba as conexões das APIs com o
  Postgres e exige `GET /saude` 200 direto na api-2 durante a janela: é ele que prova a API. Uma sonda
  num processo à parte no mesmo contêiner prova o ambiente: o tamanho real das threads (12 `pbkdf2`
  ocupando, e a resolução de `postgres` sem esperar) e o prazo do resolvedor. Localmente, no Docker
  Desktop, nome parado já falha rápido, e só a medida das threads distingue a correção

Com serviço gerenciado (D26), Postgres, Redis, S3, OTLP e o provedor de IA são nomes externos, e 1 s
passa a ser o teto de resolução deles. O gateway de IA (F5) trata `EAI_AGAIN` como falha do provedor,
que cai na degradação declarada (regra 80, item 4), e não como erro cru.

**Orçamento das threads, por processo.** O que ocupa as 16:

- **Cliente que reconecta, até uma thread cada, por até 1 s:** os 2 Redis, o exportador de métricas e,
  no worker-lote, o storage. São 3 ou 4
- **Rajada de conexões quando o Postgres volta:** até `BANCO_POOL_MAXIMO` resoluções de `postgres` ao
  mesmo tempo (10 na API, 80 no worker-interativo). O nome resolve em milissegundos, então a fila
  passa rápido, mas nesse instante ela disputa as mesmas threads
- **`jwtVerify` do jose:** usa `crypto.subtle`, que roda nas mesmas threads, em toda requisição
  autenticada. HS256 é curto, mas no pico de login entra na fila atrás do hash
- **arquivo** (`fs`), raro no caminho quente

O hash de senha do F1 (tarefa 14.0, `LOGIN_HASH_CONCORRENCIA`) usa as mesmas threads. Por isso ele cabe
em `UV_THREADPOOL_SIZE − 8`, e não em `− 2`. As 8 de folga cobrem os 4 reconectando mais uma fila
curta de verificação de token e de conexão nova. Com o Redis fora durante o login das 7h30, o hash não
tira a vez da conexão ao banco. A Tech Spec do F1 usa concorrência 2, bem abaixo desse teto, e a
calibração da 16.0 confirma o número.

Em provedor gerenciado, o nome do Redis continua resolvendo quando ele cai. Mas o deploy em um servidor
só com `docker compose` (regra 00) tem exatamente o comportamento da esteira.

---

## 5. Limites e justiça entre escolas

### 5.1 Rate limit

- **Por usuário e por escola. Nunca só por IP** (seção 1)
- IP só entra em rota pública e anônima, com limite alto o bastante para uma escola inteira
  atrás de um NAT
- Proteção de força bruta no login é por conta (escola + matrícula), com espera crescente.
  Bloquear o IP da escola bloqueia 400 alunos por causa de um

### 5.2 Filas por prioridade

| Prioridade | O quê | Regra |
|---|---|---|
| interativa | tutor em sala, ferramenta que o professor está esperando na tela | nunca espera trabalho de lote |
| normal | correção que o professor pediu agora, notificação | minutos |
| lote | ingestão, correção em massa, agentes noturnos, expurgo, exportação | preferencialmente fora do horário letivo |

Trabalho de lote que não é urgente roda à noite. Isso tira carga do pico, usa a capacidade
ociosa do provedor e, em provedor que oferece API de lote, custa menos.

O login também mora no Redis de fila (identidade, tarefa 15.0): o contador de tentativas, os contadores por IP
(rebaixamento da escola e limite da rota de e-mail) e a marca de desafio usado ficam nele, porque ele não expulsa
chave. Os contadores da página da sala (A1, tarefa 7.0: código errado por escola, matrícula errada por nome e hash sem
pedido por turma, em 10 min) usam o mesmo cliente. O cliente do login desiste em 100 ms por comando, de propósito, e aí o contador cai no seguro em memória e o
desafio é recusado. Um `addBulk` grande ou um script de fila longo às 7h30 é exatamente o que faria esses 100 ms
cortarem no meio da entrada dos alunos. Mais um motivo para lote ficar fora do horário letivo.

Quem diz o prazo é `LOGIN_REDIS_PRAZO_MS`, e **ela só aperta**: em produção e no staging a API não sobe com mais que
os 100 ms. Na máquina de desenvolvimento e no compose de teste, que é o que o e2e sobe, são 2 s — ali o Postgres, os
dois Redis, a observabilidade, os nossos contêineres e a suíte dividem a mesma CPU, e uma resposta acima de 100 ms é
rotina da máquina, não sinal de Redis travado. O cenário de carga é a exceção: `infra/carga.env` fixa os 100 ms,
porque é nele que o corte é medido com a rajada das 7h30 descrita acima.

### 5.3 Concorrência por escola

Cada escola tem limite de jobs simultâneos por fila, para uma escola barulhenta não ocupar
todos os workers.

O recurso de grupos do BullMQ, que resolveria isso direto, é da versão paga (Pro). O F0
resolveu com um limitador próprio, sem licença (regra 00). O desenho completo está na seção
5 da Tech Spec do F0 (`tasks/prd-fundacao-tecnica/techspec.md`):

- **Todo job nasce no Postgres**, em `job_registro`, na transação de quem pediu. O Redis de
  fila só recebe o que já tem vaga
- **Dois despachantes** reservam a linha com `FOR UPDATE SKIP LOCKED`, em rodízio de escolas,
  e só então tomam a vaga
- **A vaga é um ZSET por fila e escola** (`vaga:{fila}:{escola}`), tomada em Lua
  (`packages/core/src/queue/concurrency-slot.lua`), com validade de 60 s renovada pelo worker a cada
  15 s. Vaga de worker morto vence sozinha. Liberar a vaga acorda o despachante na hora
- **Padrões por escola:** interativa 5, normal 5, lote 2, com pools de 50, 30 e 10. É
  configuração por escola em `configuracao_operacional_escola`, nunca constante (D41)
- **Lote não urgente** só é reservado fora do horário letivo da escola (seção 5.2)
- **Entrega pelo menos uma vez** (D49): o processador recebe a chave de idempotência, igual
  em toda reexecução

O cenário de carga "justiça entre escolas" (`infra/k6/justica-entre-escolas.js`) prova o
limitador, e o controle negativo, com a vaga desligada, reprova.

### 5.4 Gateway de IA

Toda chamada de modelo já passa pela porta `LLMProvider` (regra 30). É ali que ficam:

- **Limitador global de concorrência e de tokens por minuto**, com margem abaixo do limite
  contratado
- **Prioridade:** tutor em sala passa na frente de agente noturno
- **Degradação no pico (D29):** a mensagem espera na fila por alguns segundos com o aviso
  "o tutor está pensando". Se passar do limite, cai para um modelo menor do mesmo perfil.
  Se o provedor principal falhar, vai para o de reserva. O professor vê o sinal de
  sobrecarga no modo sala
- **Timeout e circuit breaker:** provedor lento não segura conexão da API

---

## 6. Disponibilidade (D27)

**Meta: 99,5% no horário letivo.** Horário letivo é configurável por escola, com padrão de
segunda a sexta, das 7h às 18h. São uns 66 minutos de indisponibilidade tolerada por mês,
contados só dentro desse horário.

### 6.1 Prova resiliente

Queda curta da rede da escola ou do sistema não pode fazer aluno perder resposta nem tempo.

- A resposta é salva no servidor a cada item, e a gravação é idempotente
- No cliente, a resposta não enviada fica numa fila em memória e é reenviada quando a
  conexão volta, com indicador visível de "salvo" ou "salvando"
- O relógio da prova é do servidor. Queda do sistema não conta como tempo do aluno, e o
  professor pode estender o prazo de um aluno ou da turma
- Ao reabrir, o aluno volta ao item onde parou
- O reenvio vale também para rede móvel instável, quando a prova for feita fora da escola
  (D51)
- Persistir resposta no disco do Chromebook ou do celular (IndexedDB) só com aprovação do
  `privacy-guardian`: é dado de menor numa máquina compartilhada (regra 50, item 7)

### 6.2 Deploy

- O merge na `main`, com a esteira verde, sobe sozinho na VM de produção (F18, D31 revista). Não há
  staging; a esteira do GitHub é o portão
- A produção só recebe deploy **fora do horário letivo**: o merge feito dentro dele espera a janela
- Migration é compatível com a versão anterior do código (expandir, migrar, contrair).
  Nunca uma migration que obriga API e banco a mudarem no mesmo segundo
- Rollback é um comando, e foi ensaiado

### 6.3 Backup e recuperação

| Métrica | Meta |
|---|---|
| RPO (quanto dado se pode perder) | ≤ 5 minutos, com backup contínuo do Postgres |
| RTO (quanto tempo para voltar) | ≤ 1 hora |

Backup criptografado, em região Brasil, com restauração **executada** antes de entrar a
primeira escola real e depois repetida a cada trimestre (`docs/lgpd.md`).

---

## 7. Observabilidade para quem opera sozinho

Uma pessoa sem plantão só consegue operar se o sistema avisar antes da escola ligar.

**Métrica:**
- Latência e taxa de erro por rota (p95), separando login, tutor e prova
- Fila: tamanho e idade do job mais antigo, **por escola e por prioridade**
- IA: tokens por minuto usados contra o limite, latência do provedor, taxa de fallback,
  custo por escola
- WebSocket: conexões abertas por turma
- Banco: conexões do pool, queries lentas, espaço
- Custo de infra por escola por mês (seção 8)

**Alerta**, só o que exige ação, direto no celular do Joaquim:
- Check externo de disponibilidade falhando no horário letivo
- p95 do tutor ou do salvamento de prova acima do limite
- Tokens por minuto acima de 80% do contratado
- Job interativo esperando mais de 30 segundos, por 1 minuto seguido (dispara com uns 90 s de
  espera; regra em `infra/grafana/alertas/`)
- Backup do dia não concluído

**Log e rastreio** seguem a regra 20: id, nunca nome, resposta, nota ou conversa. A
instrumentação usa OpenTelemetry como porta, e a ferramenta que recebe os dados é escolhida
junto com a hospedagem, em região Brasil ou hospedada por nós.

**Runbook:** para cada alerta, um parágrafo em `docs/runbook.md` dizendo o que olhar e o
que fazer. Escrito quando o alerta é criado, não depois do primeiro incidente.

---

## 8. Custo (D30)

**Teto de infra, sem contar IA: R$ 2 por aluno por mês.** Com 4.000 alunos, uns R$ 8 mil
por mês, com folga para serviço gerenciado em região Brasil.

O custo de IA é medido à parte (D14), porque varia com o uso e é o que mais ameaça a
margem. A soma dos dois por escola aparece no painel interno todo mês, e é o número que
valida os R$ 30 junto com a planilha de `docs/negocio.md`.

---

## 9. Ambientes (D31)

| Ambiente | Para quê | Dado |
|---|---|---|
| local | desenvolvimento, `docker compose up`, Ollama | seed sintético |
| homologação (opcional) | substitui o staging (D31 revista): pode nem existir; se existir, é uma VM ao lado da de produção, com o mesmo compose. Antes, o staging recebia todo commit do `main`, rodava e2e e teste de carga e espelhava a produção. Criado antes da primeira demonstração externa ou do piloto; até lá, o portão é a esteira do GitHub (D31) | **seed sintético, nunca dado real** (regra 20) |
| produção | escolas | real |

A demonstração de venda (F15) roda no staging com a seed completa, ou num espaço de escola
fictícia na produção. Isso se decide no PRD do F15.

---

## 10. Teste de carga

Ferramenta aberta, com script versionado no repositório (sugestão: k6). **Nenhum teste de
carga chama provedor de IA pago** (regra 30): o adaptador falso simula latência e streaming
com os tempos da seção 3.2.

**Cenário "manhã de segunda"**, em staging:

1. Dez escolas simuladas com a seed sintética
2. Rajada de login de 2.100 alunos em cinco minutos
3. Sessenta turmas no tutor com o ritmo da seção 3.2
4. Três turmas fazendo prova online, com queda de rede simulada no meio
5. **Ao mesmo tempo**, uma das escolas subindo 300 apostilas

**Passa quando:**
- p95 do login abaixo de 1 s
- p95 do primeiro token do tutor abaixo de 3 s
- p95 do salvamento de resposta abaixo de 500 ms, e nenhuma resposta perdida
- **As outras nove escolas não pioram** enquanto a décima ingere apostila

Roda antes da primeira escola real, e de novo sempre que uma funcionalidade mexer no
caminho quente.

**Cenário "justiça entre escolas" com o expurgo (F3, tarefa 19.0)**, local, em `npm run carga`: uma escola, a A, expurga
**1 milhão de linhas** vencidas e troca um nome (o `retencao.expurgar-escola` e o `titular.eliminar`, pelo worker de lote) enquanto a
B usa a fila interativa **e o Tutor pela rota** `POST /v1/tutor/mensagens` (30 alunos sintéticos, 1,5 turno por segundo, com o
adaptador falso de latência simulada: `IA_LATENCIA_FALSA_MS=300` em `infra/carga.env`, regra 80, item 11). **Passa quando**
nenhum statement chega a 1,5 s no `pg_stat_statements` e nenhum é cancelado pelo `statement_timeout` de 2 s (o cancelado não
entra no `max_exec_time`; ele aparece no log do Postgres), o p95 da espera da B e o p95 do turno do Tutor da B (da criação da
execução à conclusão) durante o trabalho da A ficam até 500 ms acima da base, tudo o que venceu sai e o nome some. A escrita
a mais dos índices por troca do Tutor é medida por linha, só para informar (`TODO.md`, "Escrita a mais por troca do Tutor").
Procedimento e critérios: `docs/runbook.md`, "Rodar o cenário de carga".

---

## 11. Portão da primeira escola real

Nenhum dado real de escola entra em produção antes de:

- [ ] Teste de carga "manhã de segunda" passando no staging
- [ ] Restauração de backup executada de verdade
- [ ] Alertas da seção 7 configurados e testados, com runbook
- [ ] Deploy e rollback ensaiados
- [ ] Contrato com o provedor de modelo com limite de tokens compatível com a seção 3.2, e
      provedor de reserva configurado
- [ ] Os itens de LGPD do `ROADMAP.md` (F3) e do `TODO.md` concluídos

---

## 12. Em aberto

- Provedor de nuvem em região Brasil: escolhido na migração para fora da VM própria, pelos
  critérios da D42, com a AWS São Paulo como candidata
- Provedor de modelo principal e de reserva: sai da avaliação de
  `docs/avaliacao-de-modelos.md` (D37). Se o escolhido processar fora do Brasil, a
  transferência internacional precisa constar do contrato com a escola, e rede pública pode
  não aceitar
- Solução para concorrência por escola nas filas (seção 5.3)
- Solução para busca vetorial filtrada por escola (seção 3.6)
- Ferramenta de observabilidade
