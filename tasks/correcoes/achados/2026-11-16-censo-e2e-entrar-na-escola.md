# Achados das revisões — `tasks/correcoes/2026-11-16-censo-e2e-entrar-na-escola.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-16 22:41:41 · `tasks/correcoes/2026-11-16-censo-e2e-entrar-na-escola.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. A correção não toca a arquitetura. Ela reaproveita `loadUnthrottled` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/support/profiles.ts:244`), a receita que as correções `2026-10-26-areas-entrar-estoura-o-prazo` e `2026-11-10-censo-e2e-convite-mfa` já usaram e que também aparece em `acesso-suspenso.spec.ts` e `professor-ferramentas.spec.ts`. O projeto não ganha um segundo jeito de fazer a mesma coisa.
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)
Bloqueantes: nenhum.

Conferi o diff em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/entrar-na-escola.spec.ts:94-104`:
- As três asserções continuam iguais e na mesma ordem: o campo da matrícula aparece, nenhum link "Entrar com a conta" e nenhum aviso de liberação da TI. A espera do campo foi para dentro do `loadUnthrottled` com o mesmo `SIGN_IN_TIMEOUT_MS`.
- Só a rede do perfil sai, e o `finally` a devolve. A CPU do perfil continua.
- A carga na rede lenta continua medida por `:65` e `:104`, como o documento diz. Esses dois casos abrem a mesma tela com `page.goto` direto e sem `loadUnthrottled`.

Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/entrar-na-escola.spec.ts:102`: o `toHaveCount(0)` do link "Entrar com a conta" passa assim que o campo da matrícula aparece. Se os botões de provedor dependem de uma chamada separada que pode chegar depois, a asserção pode passar antes da hora. A correção não criou isso, já era assim antes. Mas, com a primeira carga mais rápida, a janela pode ficar mais curta. Uma tarefa futura pode esperar um sinal de que a configuração de entrada da escola já chegou antes de afirmar a ausência.
- Na tabela de medição do documento, a coluna "Depois" mistura duas condições diferentes: o spec inteiro com 6 trabalhadores e o caso repetido com 2. Vale dizer na própria linha qual valor entra no censo.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-16 22:41:43 · `tasks/correcoes/2026-11-16-censo-e2e-entrar-na-escola.md`

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
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/correcoes/2026-11-16-censo-e2e-entrar-na-escola.md`, seções "Causa" e "Correção": o documento diz que a carga sob a rede do perfil continua coberta por ":65 e :104". Depois da mudança, o caso de toque fica na linha `:106` (`e2e/entrar-na-escola.spec.ts:106`). Vale corrigir a citação para `:65` e `:106`, para quem procurar quem ainda mede a primeira carga na rede lenta.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/entrar-na-escola.spec.ts:98-101`: a trava rara do `goto` sob a rede emulada continua possível nos casos que ainda carregam com a rede do perfil (`:65`, `:106`, `:218`). O `:218` já está em 17,8 s, perto do limite de 20 s do censo. Fica para a retro decidir se a nova tentativa do `gotoComNovaTentativa` deve contar menos no censo, em vez de tratar caso a caso.

## test-engineer · 1ª rodada · APROVADO · 2026-11-16 22:42:00 · `tasks/correcoes/2026-11-16-censo-e2e-entrar-na-escola.md`

VEREDITO: APROVADO

Cenários exigidos (correção só de e2e, sem regra de negócio nova):
- Caminho: a escola sem provedor liberado mostra só a matrícula, sem o botão "Entrar com a conta" e sem o aviso da TI.
- Borda: a escola revoga o app no meio do ano (o próprio caso diz isso).
- Contraprova: com o provedor liberado, o botão aparece.
- Carga da tela na rede do perfil: precisa continuar medida em outro caso.
- Não muda permissão nem isolamento: o caso de isolamento (`:128`, matrícula 1234 em escolas diferentes) fica igual.

Cobertos:
- **As asserções não mudaram.** O diff de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/entrar-na-escola.spec.ts:98-103` só põe o `page.goto` e a espera do campo da matrícula dentro de `loadUnthrottled`. As três afirmações continuam, na mesma ordem e com o mesmo `timeout`.
- **A tela de entrada não mudou** (é o `EntrarNaEscola.tsx`). O `toHaveCount(0)` do botão continua pegando a ausência de verdade. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/pages/EntrarNaEscola.tsx:53-54`, o formulário e os botões dos provedores aparecem juntos, quando `acesso.data` chega. Por isso, com o campo da matrícula visível, a lista de provedores já está na tela. A asserção não tem como passar antes de os botões aparecerem. Se a escola liberasse um provedor, o caso ficaria vermelho.
- **Contraprova:** o caso `:218`, com `liberarProvedorDaEscola` na linha 214, prova que o botão aparece quando a escola libera. A regra "só aparece o que a escola liberou" tem os dois lados.
- **A nova tentativa do `goto` continua.** O `page.goto` ainda é o embrulhado por `gotoComNovaTentativa` (`e2e/support/profiles.ts:226`), e `loadUnthrottled` só troca a rede na mesma sessão do CDP. A CPU do perfil fica, e a rede do perfil volta no `finally` (`profiles.ts:244-253`).
- **A carga na rede lenta continua medida** pelos casos `:65` e `:106`, que fazem o `goto` sem `loadUnthrottled`, e pelo `tools/ci/tamanho-web.test.ts`. O documento diz isso por inteiro.
- **"Sem mutação" está justificado.** Nenhum arquivo de `apps/*/src` nem de `packages/*/src` mudou, e o `--faltando` deu 0 linhas.
- **Nada proibido:** sem `.skip`, sem teste comentado e sem mock novo. Não há IA nem concorrência neste caso.
- **Prazo:** a correção não pede carga na máquina. Ela tira a exposição à trava rara da rede emulada, sem depender da máquina estar folgada. A evidência medida (20 de 20 verdes, de 0,74 a 1,2 s) está no documento.

Bloqueantes: nenhum.

Recomendações:
- Os números da tabela da seção "Correção" (o "depois" e as 20 repetições) são da máquina local. O lugar que confirma que o caso saiu do censo é a esteira, numa próxima execução do `--censo`. Vale citar no fechamento a execução da esteira que confirmar.
- `gotoComNovaTentativa` continua ativo dentro de `loadUnthrottled`. Se a trava do `goto` cair também sem a rede do perfil, a linha `primeira-carga-travou` ainda sai como aviso. Isso é bom, mas o documento poderia dizer que a correção diminui a chance da trava, sem eliminá-la.

Não rodei o teste: o portão da tarefa já mediu, e rodar e2e aqui poria a máquina sob carga, o que esta revisão não deve fazer.
