# Achados das revisões — `tasks/correcoes/2026-11-16-limite-do-ip-no-consultar-convite.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-16 04:16:21 · `tasks/correcoes/2026-11-16-limite-do-ip-no-consultar-convite.md`

VEREDITO: APROVADO

A correção mexe só no arquivo de teste `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/test/input-boundary-sessao.int.test.ts`. Antes dos casos, ele manda uma chamada a cada rota até o limite por IP passar a contar no Redis; enquanto conta no seguro em memória, ele espera e tenta de novo. Se o Redis não responder, o teste cai com a causa escrita. Nenhum arquivo de `apps/*/src` nem de `packages/*/src` foi alterado, então nada muda no que a API coleta, mostra, registra ou envia.

Campos pessoais tocados: nenhum. O aquecimento manda corpo vazio (`{}`) de um IP sorteado na faixa `10.x.x.x`. Os casos que já existiam continuam usando só dados inventados: `ninguem-<uuid>@turmma.invalid`, `m<uuid>`, `escola-<uuid>` e uma senha fixa de teste.
Fora da tabela de dados do docs/lgpd.md: nada (a tarefa não cria campo novo)
Autorização por objeto: ok (nenhuma rota, guarda ou repository foi alterado; as rotas do teste são as anônimas de convite e de sessão, que não abrem nenhum objeto por id)
Logs: limpos (o teste não grava log; a única mensagem nova é a do `expect`, linha 55, com o caminho da rota e nenhum dado de pessoa)
Auditoria: presente (nenhuma ação desta tarefa exige auditoria)
Envio externo: nenhum
Seed/fixture: sintético
Bloqueantes: nenhum

Recomendações:
- `apps/api/test/input-boundary-sessao.int.test.ts:33`: o sorteio de IP tem cerca de 15,6 milhões de valores, então a chance de o aquecimento cair no mesmo IP de um caso é desprezível. Ainda assim, uma faixa só do aquecimento, como `192.0.2.x` (reservada para documentação, RFC 5737), deixaria a separação garantida e não só provável, como a seção "Correção" da tarefa promete.
- A tarefa admite que não há vermelho que se possa provocar de propósito e usa como prova as vinte rodadas sob carga. Isso é matéria do `test-engineer` e do `infra-guardian`, não da regra 20.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-16 04:16:23 · `tasks/correcoes/2026-11-16-limite-do-ip-no-consultar-convite.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A correção mexe só em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/test/input-boundary-sessao.int.test.ts` e cria o arquivo da tarefa. Nada em `apps/*/src` nem em `packages/*/src` mudou (conferi com `git status`). Todos com autor humano? Sim. Nenhum caminho de Nota foi criado nem alterado.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. A tarefa não toca saída de IA, entrega nem artefato.
Supervisão do tutor: ok. A tarefa não toca o tutor.
Autonomia declarada e visível: sim. A tarefa não toca governança nem a declaração de autonomia dos agentes.
Bloqueantes: nenhum
Recomendações: nenhuma da regra 70.

O que conferi:
- **O que a mudança faz:** antes dos casos, o teste chama cada uma das cinco rotas de convite e sessão, de um IP sorteado, até o limite por IP passar a responder pelo Redis. Isso já acontecia de forma implícita. As rotas são de autenticação e de consulta de convite. Não envolvem nota, correção, tutor, autonomia de agente, decisão sobre aluno nem indicador de professor.
- **O getter `seguroAtivo`:** o teste lê o `RateLimiter.seguroAtivo`, que já existia e é público (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/packages/core/src/rate-limit/rate-limiter.ts:182`). O limitador não muda.
- **Vigilância (item 7):** o teste não mede o aluno nem o comportamento dele. Os IPs são sorteados e servem só ao teste.
- **Professor (item 8):** o teste não mede nem expõe nada sobre o professor.
- **Discursiva e redação (item 8, D46/D55):** nenhum campo, tela ou prompt de nota foi criado ou alterado.
- **Fotos da tela:** a tarefa não tem tela, então não houve fotos para ler.

O que vale para a esteira (tempo de teste, retentativas, aquecimento do Redis) não é desta regra. Cabe ao `test-engineer` e ao `infra-guardian`.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-16 04:16:28 · `tasks/correcoes/2026-11-16-limite-do-ip-no-consultar-convite.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum (só o arquivo de teste `apps/api/test/input-boundary-sessao.int.test.ts` muda; nada em `apps/*/src` nem em `packages/*/src`)
Rate limit: ok (o limite por IP só vale nas rotas anônimas e de login, que só rebaixam a tentativa; o desenho não mudou)
Fila e prioridade: ok (não tocada)
Concorrência: protegida (não tocada)
Índice e paginação: ok (não se aplica)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (não tocados; o teste lê `RateLimiter.seguroAtivo`, um getter público que já existe e que o `rate-limit.int.test.ts` usa)
Bloqueantes: nenhum

O diagnóstico está certo. Em `packages/core/src/rate-limit/rate-limiter.ts:182`, o `seguroAtivo` mostra se a última requisição limitada foi contada pelo seguro em memória. Por isso o laço de aquecimento termina quando a contagem volta para o Redis. Cada chamada de aquecimento usa um IP sorteado, então não gasta ponto de nenhum balde que os casos usam. O espião do `HashBulkhead` só é ligado dentro do caso, então o aquecimento também não mexe nele. O corte de 100 ms e o seguro (regra 80, item 5) ficaram como estavam.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/test/input-boundary-sessao.int.test.ts:59-65`: o aquecimento garante o Redis antes do primeiro caso, mas não durante ele. Com a máquina carregada, uma chamada no meio da sequência ainda pode passar dos 100 ms e cair no seguro, e o erro volta a ser o 400 no lugar do 429, sem a causa escrita. Vale conferir `seguroAtivo === 0` depois de cada `postar` dos casos, com a mesma mensagem `o Redis do limite não aqueceu`, para o vermelho continuar dizendo a causa.
- Na mesma linha, a esteira pode precisar do mesmo aquecimento em outros arquivos que contam N chamadas no Redis logo depois do `subirApi`, como `rate-limit.int.test.ts` e `password-attack.int.test.ts`. Se o padrão se repetir, vale um `aquecerORedisDoLimite` compartilhado em `apps/api/test/test-api.ts`, em vez de copiar o código em cada arquivo.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-16 04:16:31 · `tasks/correcoes/2026-11-16-limite-do-ip-no-consultar-convite.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. É uma correção que só mexe em teste. Não toca `apps/*/src` nem `packages/*/src`, e o corte de 100 ms e o seguro em memória da regra 80, item 5, ficam como estão.
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

O que conferi no código:
- **A sinalização que o aquecimento lê é a certa.** Em `packages/core/src/rate-limit/rate-limiter.ts:292-298`, o `seguroAtivo` mostra se a última requisição limitada foi contada pelo seguro em memória. As chamadas do aquecimento saem uma depois da outra, então o valor lido depois de cada `postar` é o da própria chamada.
- **Cada balde é aquecido separadamente.** As cinco rotas usam os baldes `ipAnonimo`, `ipDoLogin` e `ipDaOperacao`, cada um com o seu limitador Redis.
- **O aquecimento não consome a cota dos casos.** O IP de cada chamada é sorteado, e o balde é por IP.
- **A linha de "Sem mutação" é aceita.** A exigência do RF17 só vale quando a correção altera código de produção, e esta não altera.

Recomendações:
- `apps/api/test/input-boundary-sessao.int.test.ts:50`: a lista das cinco rotas repete as dos dois `it.each` (linhas 59 e 69-71). Se alguém incluir uma rota nos casos e esquecer de incluir no aquecimento, o mesmo problema volta. Melhor guardar as rotas em constantes e usar as mesmas nos dois lugares.
- `apps/api/test/input-boundary-sessao.int.test.ts:51`: a condição do `for` (`tentativa === 1 || limitador.seguroAtivo === 1`) é difícil de ler de primeira. Um `do { … } while (seguroAtivo === 1 && tentativa < TENTATIVAS_DE_AQUECIMENTO)` diz a mesma coisa de forma mais direta.
- O aquecimento só resolve a primeira chamada depois de a API subir. Se a máquina ficar ocupada no meio de um caso, uma das seis chamadas pode passar dos 100 ms, cair no seguro, e o 400 volta no lugar do 429. O documento da correção não fala desse caso. Se o problema reaparecer, olhar o `seguroAtivo` depois de cada chamada dentro dos casos mostraria a causa diretamente.

Arquivos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/test/input-boundary-sessao.int.test.ts`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/correcoes/2026-11-16-limite-do-ip-no-consultar-convite.md`

## test-engineer · 1ª rodada · APROVADO · 2026-11-16 04:17:45 · `tasks/correcoes/2026-11-16-limite-do-ip-no-consultar-convite.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- Caminho feliz: nas duas rotas de `consultar`, as cinco recusas por corpo inválido continuam 400 `ENTRADA_INVALIDA`, a sexta é 429 `LIMITE_EXCEDIDO`, o corpo válido acima do limite é recusado sem ser lido, e outro IP continua passando.
- Borda 1: a primeira requisição depois do boot cai no seguro em memória, com a conexão fria ou o script do limitador ainda por carregar.
- Borda 2: o Redis do limite não aquece. O teste tem de cair com a causa escrita, e não com um 400 no lugar do 429.
- Não mascarar a regra: o aquecimento não pode deixar verde um caso em que o corpo inválido saiu da contagem.
- Isolamento entre buckets: o aquecimento não pode gastar o balde do IP que um caso usa.
- Permissão e isolamento entre escolas: não se aplicam. A correção só muda um arquivo de teste e a rota é anônima, contada por IP.

**Cobertos:**
- O caminho feliz segue nos casos `it.each` das linhas 59-66 e 68-89, sem mudança. Rodei `npx vitest run apps/api/test/input-boundary-sessao.int.test.ts` uma vez: 5 de 5 verdes.
- As duas bordas ficam com `aquecerORedisDoLimite()`, nas linhas 48-57, e o `expect(seguroAtivo, '<rota>: o Redis do limite não aqueceu').toBe(0)`.
- O aquecimento não esconde a regra:
  - O guard (`packages/core/src/rate-limit/rate-limit.guard.ts:58-107`) consome um único limitador por requisição. Então `seguroAtivo` depois de cada chamada fala da rota aquecida.
  - Se o corpo inválido saísse da contagem, o limitador nem seria chamado e o aquecimento passaria. O caso, porém, continuaria vermelho no 400 em vez do 429.
  - Se o Redis estivesse sempre fora, o `beforeAll` cairia com a causa escrita.
- Isolamento entre buckets: cada chamada de aquecimento usa um IP sorteado em cerca de 15 milhões de valores, e as cinco rotas cobrem os três limitadores (`ipAnonimo`, `ipDoLogin`, `ipDaOperacao`).
- Mutações: a correção não toca `apps/*/src` nem `packages/*/src`. A linha `**Sem mutação:**` traz o motivo, e o RF17 não se aplica. Não há `.skip`, mock nem provedor de IA.

**Bloqueantes:** nenhum.

**Recomendações:**
1. O documento promete mais do que o teste entrega. A linha 38 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/correcoes/2026-11-16-limite-do-ip-no-consultar-convite.md` diz que "o seguro deixa de ser silencioso", mas isso só vale durante o aquecimento.
   - Se uma das seis chamadas do caso passar dos 100 ms sob carga, o vermelho volta a ser um 400 sem causa.
   - Correção barata: incluir `limitador.seguroAtivo` na mensagem do `expect` da linha 61 de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/test/input-boundary-sessao.int.test.ts` (por exemplo, `` `${caminho} vez ${vez} seguro=${limitador.seguroAtivo}` ``).
   - Outra saída: afirmar `proporcaoDoSeguro === 0` antes da sexta chamada.
   - A evidência de 20 verdes em 20 rodadas sob carga sustenta a correção, mas a garantia é estatística, não estrutural.
2. O lugar certo do aquecimento é o `subirApi` compartilhado. O `rate-limit.int.test.ts` já espera o cliente do limite ficar pronto no seu `subirApi` local (linhas 49 e 70, `clientePronto`), e o `subirApi` compartilhado de `apps/api/test/test-api.ts` não espera. Esse arquivo é usado por cerca de 18 testes que configuram `LIMITE_REQ_*`, entre eles:
   - `input-boundary-late-modules`
   - `sessao-operador`
   - `convite-operador`
   - `entrada-operador`

   Ao menos registrar no "Fora desta correção", que hoje diz "nada", ou no `TODO.md`, que a mesma suposição pode ficar intermitente nesses arquivos.
3. Detalhe: a primeira tentativa de aquecimento já carrega o script de contagem no Redis mesmo quando o cliente corta em 100 ms. Por isso o aquecimento resolve o "script por carregar", e não só a "conexão fria". Vale uma frase no comentário das linhas 41-47 para que o próximo leitor não ache que basta esperar o `ready`.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-16 04:35:29 · `tasks/correcoes/2026-11-16-limite-do-ip-no-consultar-convite.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok (a correção só mexe em arquivo de teste e no `TODO.md`)
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade e alvo)
Bloqueantes: nenhum

As recomendações da 1ª rodada foram aplicadas como o prompt descreve:
- **`seguroAtivo` conferido a cada chamada:** todas as chamadas dentro dos dois `it.each` agora passam por `postarContado`, que confere o `seguroAtivo` depois de cada uma (`apps/api/test/input-boundary-sessao.int.test.ts`, linhas 54-58 e 82-102). As asserções de status e de código continuam as mesmas.
- **Lista única de rotas:** as rotas estão em `ROTAS_DE_CONSULTA` e `ROTAS_DE_LOGIN` (linhas 19-25). O aquecimento e os dois casos usam essas mesmas constantes, então uma rota nova entra nos dois lugares ou em nenhum.
- **`do/while` no aquecimento:** o laço com a condição `tentativa === 1 || ...` virou `do/while` (linhas 71-76). O teste ainda cai com a causa escrita se o Redis não aquecer.
- **Recomendações deixadas de fora:** o aquecimento no `subirApi` compartilhado foi para o `TODO.md`, com dono e o motivo de ficar fora (toca cerca de 18 testes). A faixa de IP só do aquecimento foi recusada com motivo correto: uma faixa de 254 valores faria as até 150 chamadas do aquecimento colidirem entre si no balde de 5 por minuto. As duas decisões estão na seção "Sem aplicar" de `tasks/correcoes/2026-11-16-limite-do-ip-no-consultar-convite.md`.

Recomendações:
- `TODO.md`, linhas 3763-3768: a linha nova não segue o padrão das vizinhas, que começam com `(reengenharia-continuacao, <origem>, <revisor>, <rodada>, <data>)`. Faltam o nome da spec e a data `16/11/2026`.
- `apps/api/test/input-boundary-sessao.int.test.ts`, linha 77: o `expect` que encerra o aquecimento repete a mensagem de `postarContado`. Dá para extrair um ajudante `conferirRedisAquecido(caminho)` usado pelos dois. É só legibilidade.

## test-engineer · 2ª rodada · APROVADO · 2026-11-16 04:35:43 · `tasks/correcoes/2026-11-16-limite-do-ip-no-consultar-convite.md`

VEREDITO: APROVADO

**Cenários exigidos:** esta correção mexe só no teste, então o cenário exigido é o mesmo da 1ª rodada. A sexta recusa no mesmo IP precisa ser 429 `LIMITE_EXCEDIDO` nas duas rotas de consultar. O outro IP precisa continuar sendo lido. Nas três rotas de login, o corpo inválido conta no balde do IP, e a tentativa válida depois do limite sai rebaixada no semáforo do hash, nunca em 429. Nesta rodada eu conferi também se o teste deixou de falhar em silêncio quando uma chamada cai no seguro em memória.

**Cobertos:**
- Os cinco casos continuam com as mesmas asserções de status e código, e agora todos usam `postarContado`, que confere `seguroAtivo === 0` depois de cada chamada.
- Em `rate-limiter.ts:181-184` e `:292-298`, o `seguroAtivo` diz se a última requisição limitada foi contada pelo seguro. Nenhuma configuração roda os casos do arquivo em paralelo, então conferir depois de cada chamada mostra a requisição daquele caso.
- O aquecimento e os dois `it.each` leem as mesmas constantes, `ROTAS_DE_CONSULTA` e `ROTAS_DE_LOGIN`.
- No `do/while`, a primeira tentativa sempre acontece, e o laço repete até 30 vezes enquanto `seguroAtivo === 1`. O `expect` por rota continua lá, com a causa escrita.
- O comentário do aquecimento agora cita o script de contagem.
- A recomendação 2 da 1ª rodada está registrada no `TODO.md` (linhas novas no fim do arquivo) e na seção "Sem aplicar".
- Rodei `npx vitest run apps/api/test/input-boundary-sessao.int.test.ts` uma vez: 5 de 5 passaram.
- A seção "Mutações" declara "Sem mutação" com motivo. Isso se sustenta: as cláusulas novas são instrumentação do próprio teste, sem nenhuma regra nova em `src`, e o vermelho não se escolhe porque depende de a máquina estar ocupada no instante da chamada. Não há `.skip` nem mock que esconda a regra. O `vi.spyOn(HashBulkhead, 'executar')` só observa e continua chamando o código real.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Brecha no diagnóstico de `postarContado`.** A conferência vale para a última consulta ao limitador dentro da requisição. Se uma requisição consultar dois limites, e o primeiro cair no seguro e o segundo passar pelo Redis, o teste vê `seguroAtivo` em 0 e o desvio passa despercebido. A rota pode fazer isso na tentativa válida de login, se ela passar por um segundo limite além do balde do IP. Nesse caso o teste ainda cai, mas na asserção `rebaixado` de `[true]` (`input-boundary-sessao.int.test.ts:108`), sem a causa escrita. Pode ir junto com a linha do `TODO.md`, que já prevê levar o aquecimento para o `subirApi`. Uma saída é conferir também a `proporcaoDoSeguro`, que registra toda consulta feita pela requisição.
2. **`as const` em `ROTAS_DE_CONSULTA`.** Hoje ela é `string[]`, enquanto `ROTAS_DE_LOGIN` usa `as const`. Fica mais uniforme, e o `%s` dos nomes dos casos não muda.

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/api/test/input-boundary-sessao.int.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/packages/core/src/rate-limit/rate-limiter.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/tasks/correcoes/2026-11-16-limite-do-ip-no-consultar-convite.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/.processo/ordens/diff-limite-ip-r2.patch
