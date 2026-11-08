# Achados das revisões — `tasks/correcoes/2026-11-07-servico-novo-no-compose.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-07 21:52:18 · `tasks/correcoes/2026-11-07-servico-novo-no-compose.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. A correção não toca a arquitetura. Ela atualiza a lista de serviços que o teste confere, depois que a tarefa 1.0 pôs o `mailpit` em `infra/compose.yml`.
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)").
Bloqueantes: nenhum.
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/compose.int.test.ts:224`: o comentário passou a dizer "Os 20", mas a linha seguinte ainda fala em "deixaria dezessete sem checar". Essa conta vinha de 19 menos 2. Com 20 serviços, ficariam dezoito sem checar. Troque "dezessete" por "dezoito", ou escreva a frase sem número, para que ela não fique errada de novo no próximo serviço.
- `tools/ci/compose.ts:133` (`SERVICOS_INFRA`) não inclui o `mailpit`, e nenhuma suíte de integração sobe o serviço hoje. Isso está certo agora, porque os testes de e-mail usam o adaptador falso ou só a configuração. Se uma tarefa futura da spec testar envio de verdade pelo `mailpit` na esteira, ele precisa entrar nessa lista. A tarefa 1.0 também deixou passar este teste de integração porque o portão dela não o roda. Vale levar isso para a retro: serviço novo no compose deveria fazer o portão rodar `tools/ci/compose.int.test.ts`.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-07 21:52:28 · `tasks/correcoes/2026-11-07-servico-novo-no-compose.md`

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
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/compose.int.test.ts:224`: o comentário passou a dizer "Os 20", mas a linha de baixo ainda diz "deixaria dezessete sem checar". Com 20 serviços, um `config` que devolvesse só dois deixaria dezoito sem checar. Só o texto está errado. O teste está certo.

O que conferi:
- Rodei o `docker compose config` com os mesmos argumentos do teste. Ele devolve exatamente os 20 serviços da lista nova, na mesma ordem do `sort()`, e nenhum deles declara `logging`.
- Pelo vitest direto, o caso ficou só como pulado, então a conferência foi feita fora dele.
- A correção mexe só em teste de infraestrutura e não muda nada que roda em produção.
- O `mailpit` (`infra/compose.yml:119`) serve só ao desenvolvimento e ao teste. A porta dele está presa ao `127.0.0.1` e o teto de CPU fica em `infra/compose.carga.yml:49`.

## test-engineer · 1ª rodada · APROVADO · 2026-11-07 21:52:42 · `tasks/correcoes/2026-11-07-servico-novo-no-compose.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- O inventário de serviços do `docker compose config` coincide com a lista fixa e inclui o `mailpit`. Sem ele, o caso fica vermelho, que é o defeito que a esteira 42425078992 pegou.
- O laço que proíbe `logging` passa a valer para o `mailpit`, porque ele entra em `servicos`.
- Um serviço que some ou é trocado continua vermelho com o nome dele, porque a comparação é por nome e não por contagem.
- Os cenários de permissão, isolamento e concorrência não se aplicam. A correção só mexe na lista de serviços de um teste de infraestrutura.

**Cobertos:**
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/compose.int.test.ts:189`, caso "nenhum serviço declara `logging`…".
  - A asserção é sobre o resultado: `toEqual` com a lista exata e ordenada, feita depois do laço `toBeUndefined()` sobre `logging`.
  - Rodei o caso sozinho e ele passou (1 passou, 12 ignorados pelo filtro `-t`, nenhum `.skip`).
  - O vermelho de antes está registrado na esteira: `+ "mailpit"`, 20 serviços recebidos contra 19 esperados.
  - O teste falharia sem a correção: tirar `'mailpit'` da lista volta ao vermelho da esteira.
- A correção não altera `apps/*/src` nem `packages/*/src`, então não precisa de bloco de mutação nem da linha "Sem mutação" (RF17).
- Conferi se faltava `mailpit` em outro lugar.
  - Nenhum teste de integração usa o `mailpit`: a porta de e-mail só aparece em testes de unidade (`packages/core/src/email/*.test.ts`).
  - Por isso `SERVICOS_INFRA` em `tools/ci/compose.ts:133` e a lista `SUBIR` em `tools/ci/compose.test.ts:62` não precisam dele.

**Bloqueantes:** nenhum.

**Recomendações:**
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/compose.int.test.ts:224`: o comentário passou a dizer "Os 20 pelo nome", mas a linha seguinte ainda diz "deixaria dezessete sem checar". Isso era 19 menos 2; agora são 20 menos 2, então o certo é "dezoito".
2. Na retro: a causa do defeito é um padrão. Um serviço novo no `infra/compose.yml` só aparece neste teste na esteira, porque o portão da tarefa não roda `tools/ci/compose.int.test.ts` quando o diff toca só `infra/compose.yml`. Vale incluir esse arquivo nos testes que o portão roda sempre que `infra/compose*.yml` mudar, para o vermelho aparecer antes do commit e não uma tarefa depois.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-07 21:59:06 · `tasks/correcoes/2026-11-07-servico-novo-no-compose.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. É uma correção de esteira, sem seção de Tech Spec envolvida. A mudança só põe o `mailpit` na lista de nomes e conserta os dois números do comentário.

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

Bloqueantes: nenhum.

- A correção que a rodada 1 pediu foi feita. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tools/ci/compose.int.test.ts:224`, o comentário agora diz "deixaria dezoito sem checar". A conta fecha com "Os 20 pelo nome" da linha 223 (20 menos 2).
- Contei a lista das linhas 226 a 230: são 20 nomes, e o `mailpit` está entre `despachante-2` e `migrar`, na ordem do `sort()`.
- A seção "Sem aplicar" do documento da correção (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-07-servico-novo-no-compose.md`) dá destino a cada recomendação que ficou de fora. Uma vai para a retro da spec, porque mudar o portão para rodar `compose.int.test.ts` quando `infra/compose*.yml` mudar é mexer no processo. A outra, `SERVICOS_INFRA` sem o `mailpit`, vai para a tarefa futura que testar envio real pelo `mailpit`. Os dois destinos estão certos.

Recomendações: nenhuma nova. Continua aberta, para a retro, a recomendação da rodada 1 de fazer o portão rodar `tools/ci/compose.int.test.ts` quando o diff tocar `infra/compose*.yml`. Foi essa falta que deixou o defeito chegar à esteira.
