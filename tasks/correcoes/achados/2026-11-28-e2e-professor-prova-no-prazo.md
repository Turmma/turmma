# Achados das revisões — `tasks/correcoes/2026-11-28-e2e-professor-prova-no-prazo.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-28 11:17:02 · `tasks/correcoes/2026-11-28-e2e-professor-prova-no-prazo.md`

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
- A mudança só toca `e2e/professor-prova.spec.ts:42-44`. Ela intercepta os `/assets/**` com o mesmo padrão de `e2e/aluno-prova.spec.ts:51`, e nenhuma rota da API casa com esse padrão.
- A carga do aplicativo na rede lenta continua coberta por `e2e/casca.spec.ts`, que não intercepta os `/assets/`.
- O caso de indisponibilidade de `extensoes`, que devolve 503 com `INDISPONIVEL_TENTE_DE_NOVO` em `e2e/professor-prova.spec.ts:241`, continua com a rede do perfil.
- O cenário do teste de carga não precisa mudar, porque nenhum código de produção mudou. Nenhum teste chama provedor pago.
- Se um terceiro arquivo de e2e precisar servir os `/assets/` direto, vale extrair um helper compartilhado com `aluno-prova.spec.ts`, para o comentário e o padrão não se desencontrarem. Fica para a retro e não bloqueia.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-28 11:17:05 · `tasks/correcoes/2026-11-28-e2e-professor-prova-no-prazo.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. A correção mexe só no teste: não toca código de produção, não muda contrato nem arquitetura.
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum
Recomendações:
- `e2e/professor-prova.spec.ts:16`: o cabeçalho continua dizendo que a carga do aplicativo "já custa uns 8 s". Com os `/assets/` servidos direto, esse número era o custo antigo. Além disso, a frase "por isso os casos são curtos" ficou presa a uma causa que a correção acabou de tirar. Vale reescrever a frase para descrever a situação nova (casos curtos, uma coisa por caso, abaixo de 15 s), sem dar o custo de carga como premissa.
- `e2e/professor-prova.spec.ts:42`: o comentário é cópia literal do que está em `aluno-prova.spec.ts:49`, e a mesma linha de `page.route('**/assets/**', ...)` aparece nos dois arquivos. Se um terceiro spec precisar dela, ela pode virar um auxiliar comum em `e2e/` (por exemplo, `servirAssetsDireto(page)`), com o motivo explicado uma vez só. Com dois usos ainda não precisa.
- O cenário em que o `**/assets/**` e as rotas de `:219` e `:241` disputariam o mesmo endereço não acontece: os padrões não se cruzam e todo `montarEscola` roda antes do `goto`. Fica registrado só para a validação.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-28 11:17:06 · `tasks/correcoes/2026-11-28-e2e-professor-prova-no-prazo.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum novo. A tarefa mexe só no teste `e2e/professor-prova.spec.ts` (4 linhas a mais, 1 a menos) e não toca em `apps/*/src`, `packages/*/src`, migration, seed nem job. A aprovação do lote continua sendo feita pelo professor na tela (`:166-172`, botão "Aprovar 2 correções"). Todos com autor humano? sim

Decisão autônoma sobre aluno: ausente. A tarefa não muda nenhum fluxo.

Aprovação registrada: ok. Nenhuma asserção foi tirada nem afrouxada. O caso `:138` continua provando que a saída da aba aparece só ao professor, com o aviso fixo e sem consequência automática: ela não trava a aprovação, como pede a D70.

Supervisão do tutor: ok. Este teste não envolve o tutor.

Autonomia declarada e visível: sim, e a tarefa não a altera.

Bloqueantes: nenhum.

- A nova linha `e2e/professor-prova.spec.ts:44` (`page.route('**/assets/**', ...)`) só faz os arquivos do aplicativo chegarem sem a rede lenta do perfil.
- As chamadas à API, que são o que os casos provam, continuam na rede do perfil. O padrão `**/assets/**` não pega os endereços `/v1/...`, então as interceptações próprias de `:219` e `:241` seguem como estavam.

Recomendações: nenhuma pela regra 70. O que fica para quem decide é só a medida de tempo da tarefa (de 7,3 a 9,2 s por caso, a maior com 12,2 s no portão), e conferi-la é trabalho do `test-engineer` e do `infra-guardian`, não meu.

Arquivos:
- e2e/professor-prova.spec.ts
- tasks/correcoes/2026-11-28-e2e-professor-prova-no-prazo.md

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-28 11:17:06 · `tasks/correcoes/2026-11-28-e2e-professor-prova-no-prazo.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A mudança fica só no teste. Ela serve os `/assets/**` (os arquivos estáticos do aplicativo) sem a emulação de rede lenta do perfil e corrige o comentário de cabeçalho. Não há migration, DTO, rota, log, storage nem código de `apps/*/src` ou `packages/*/src`.
Fora da tabela de dados do docs/lgpd.md: nenhum campo novo.
Autorização por objeto: não se aplica, nenhuma rota foi alterada. A interceptação só pega o padrão `**/assets/**`, e nenhuma rota da API em `apps/api/src` usa `/assets/`. As chamadas à API continuam passando pela rede do perfil e pela autorização real. Os casos que interceptam rotas próprias (`acompanhamento`, `extensoes`) usam outro padrão e não foram tocados.
Logs: limpos. Nenhum log novo.
Auditoria: não se aplica, nenhuma ação auditável foi criada ou alterada.
Envio externo: nenhum. O `rota.fetch()` busca o próprio pacote do front no servidor local de teste, e nada sai do ambiente.
Seed/fixture: sintético. "Ana Souza" e "Bia Lima" já estavam no arquivo e são criados por `criarAlunoComMatricula`, sem nenhum dado real.
Bloqueantes: nenhum.
Recomendações: há uma, que não bloqueia. A mesma interceptação de `/assets/**` com o mesmo comentário longo agora está repetida em `e2e/aluno-prova.spec.ts:49-51` e em `e2e/professor-prova.spec.ts:42-44`. Vale levar isso para um utilitário compartilhado do `e2e/` quando aparecer o terceiro arquivo. A recomendação é de organização, não da regra 20, e fica para a retro.

Pergunta de fechamento: a mudança não altera o que o sistema guarda sobre um aluno nem para onde isso é enviado. A resposta continua a mesma de antes da tarefa.

Arquivos auditados:
- e2e/professor-prova.spec.ts
- tasks/correcoes/2026-11-28-e2e-professor-prova-no-prazo.md

## test-engineer · 1ª rodada · APROVADO · 2026-11-28 11:17:36 · `tasks/correcoes/2026-11-28-e2e-professor-prova-no-prazo.md`

VEREDITO: APROVADO

Cenários exigidos: os 6 casos de `e2e/professor-prova.spec.ts` (acompanhar e estender, encerrar, o lote com "Saiu da aba", 360 px e 1366 × 768, segunda chamada, recomeço) continuam nos dois projetos com as mesmas asserções, e cada um fica bem abaixo de 15 s. A correção também não pode fazer o teste deixar de provar a regra. Esta correção é só de duração, então não pede cenário novo de borda, de permissão nem de isolamento: nenhuma regra de negócio mudou e nenhum código de produção foi tocado.

Cobertos:
- **O diff é só o `e2e/` e não mexe em nenhuma asserção.** Ele acrescenta uma linha em `montarEscola` (`:44`, a rota `**/assets/**` com `rota.fulfill({ response: await rota.fetch() })`, a mesma do `aluno-prova.spec.ts:51`) e troca um comentário (`:16`). Os 6 casos e as asserções deles estão iguais aos do HEAD. Se alguém apagar a regra que cada um prova, ele continua vermelho, como antes.
- **A rota nova não cruza com as do caso do recomeço.** Elas são `**/v1/atividades-aplicadas/<id>/acompanhamento` (`:219`) e `/extensoes` (`:241`). A rota de assets não cobre nada da API, então a leitura segurada e o 503 de estender seguem como estavam.
- **A CPU ×4 e a rede do perfil continuam valendo** para as chamadas à API e para a tela. A carga do aplicativo na rede lenta já é coberta pelo `casca.spec.ts`.
- **Não há `.skip`, `.only`, teste comentado, mock da regra nem provedor de IA.**
- **A linha `**Sem mutação:**` tem motivo escrito.** Nenhum arquivo de `apps/*/src` ou `packages/*/src` mudou, então isso atende ao RF17.
- **Não há concorrência a provar aqui.**

Bloqueantes: nenhum.

Recomendações:
1. **O documento diz que o portão confere a duração, e com este diff ele não confere.** A frase está em `tasks/correcoes/2026-11-28-e2e-professor-prova-no-prazo.md:23` e `:26`. O `tools/ci/duracao-do-e2e.ts` só mede o caso cujas linhas o diff tocou (`casosAlterados`, `:181-195`; o comentário em `:36` diz que linha antes do primeiro caso não é de caso nenhum). As linhas tocadas (`:16`, `:42-44`) estão todas antes do primeiro `test(` (`:90`). Então nenhum dos 12 casos conta como tocado, e "o `duracao-do-e2e.ts` não reprovou nenhum" é verdade só porque ele não mediu nenhum. A prova da correção são as medidas feitas à mão (de 7,3 a 9,2 s, e 8,3 s com `--repeat-each 3 --workers 2`). Se a carga voltar a ficar lenta, só o prazo de 30 s da esteira vai acusar. O texto deveria dizer isso, para a validação não ler ali uma garantia que o portão não deu.
2. **O comentário de cabeçalho ficou com um número errado** (`e2e/professor-prova.spec.ts:16`). Ele ainda diz que a carga do aplicativo "já custa uns 8 s", mas com os `/assets/` direto o caso inteiro leva de 7 a 9 s. Melhor dizer quanto a carga custa agora, ou tirar o número.
3. **A origem cita as linhas antigas dos casos** (`:87`, `:121`…), que agora começam em `:90`, `:124`, `:138`, `:175`, `:192` e `:210`. O texto veio da validação, então é só para quem for conferir.

Não rodei o e2e. Ele precisa subir o ambiente inteiro e poria a máquina sob carga, e as medidas já estão no documento. O que conferi foi o `git diff`, a leitura do spec e a regra do `duracao-do-e2e.ts`.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-28 11:32:59 · `tasks/correcoes/2026-11-28-e2e-professor-prova-no-prazo.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo, conferidos sobre o código atual)

Bloqueantes: nenhum

**As três correções da ordem r1 foram feitas:**
1. **Cabeçalho** de `e2e/professor-prova.spec.ts:16`: o número "uns 8 s" saiu. A frase agora diz que a CPU ×4 pesa e que por isso os `/assets/` vêm direto. Diz também que a carga na rede lenta é testada no `casca.spec.ts` e que os casos ficam abaixo de 15 s. Isso descreve o estado de agora, e a frase "por isso os casos são curtos" não depende mais de uma causa que a correção já tirou.
2. **Portão e duração:** o documento agora diz que o `duracao-do-e2e.ts` não mede nenhum caso com este diff, porque as linhas tocadas ficam antes do primeiro `test(`. Diz que a prova são as medidas feitas à mão e que, se a carga voltar a ficar lenta, só o prazo de 30 s da esteira acusa.
3. **Origem:** cita as duas numerações. Conferi no arquivo: os seis casos começam em `:90`, `:124`, `:138`, `:175`, `:192` e `:210`, como o documento diz.

A tabela "Recomendações sem aplicar" está preenchida igual ao "Sem aplicar" da ordem. Entre a rodada aprovada e agora, o único código que mudou foi a linha 16 do spec, e é só comentário.

Recomendações:
- O comentário em `e2e/professor-prova.spec.ts:42` diz que a carga "sozinha leva uns 10 s de um caso de 15 s". Esse número é o motivo da interceptação, então pode ficar. Se alguém mexer ali, vale deixar claro que ele mede a situação de antes, quando os `/assets/` passavam pela rede do perfil.
