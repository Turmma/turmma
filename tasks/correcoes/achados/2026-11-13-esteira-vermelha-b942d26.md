# Achados das revisões — `tasks/correcoes/2026-11-13-esteira-vermelha-b942d26.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-13 23:01:05 · `tasks/correcoes/2026-11-13-esteira-vermelha-b942d26.md`

VEREDITO: APROVADO
Tabelas verificadas: nenhuma tabela nova e nenhuma migration. As mudanças estão só em teste e e2e: `apps/api/test/material-envio-orfao.int.test.ts`, `e2e/operacao-escolas.spec.ts` e `e2e/tamanho-da-letra.spec.ts`.
Queries verificadas: nenhum código de produção mudou, então nenhum repository ou endpoint foi alterado. Conferi o que o diff usa:
- `materiaisJaEnviados` (`apps/api/test/material.fixture.ts:266-282`) grava as linhas com o `escolaId` da sessão de coordenação da escola do caso, e aceita `enviadoHaMs`.
- O teto `MATERIAIS_EM_PROCESSAMENTO_POR_ESCOLA` (`apps/api/src/material/material.service.ts:50`) conta por escola. As 300 linhas enchem só a escola do próprio caso.
- As asserções finais (`objetosDaEscola`, `linhasDoEnvio`, `materiaisDa`) continuam presas ao `escolaId` do caso.
- `novoPainel('nenhum')` (`e2e/operacao-escolas.spec.ts:37`) semeia o painel e o remove no `afterEach`. O caso continua provando que o segundo operador não vê a lista do primeiro, e nenhuma asserção ficou mais fraca.
Teste de isolamento: não se aplica a esta correção, porque não há módulo, repository nem endpoint novo. Os testes de isolamento que já existem não foram tocados.
Bloqueantes: nenhum
Recomendações:
- `apps/api/test/material-envio-orfao.int.test.ts:207-208`: o caso agora grava 300 linhas uma a uma dentro do `guardarBytes`. Se esse caso ficar perto do tempo do portão, vale gravar em lote no fixture.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-13 23:01:08 · `tasks/correcoes/2026-11-13-esteira-vermelha-b942d26.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum. A tarefa mexe só em teste e e2e; nenhum arquivo de `apps/*/src` ou `packages/*/src` mudou.
Rate limit: ok. O caso de integração volta a provar o teto de processamento por escola com o valor real (`MATERIAIS_EM_PROCESSAMENTO_POR_ESCOLA` = 300), conferido sob a trava. A contagem `emProcessamento` em `apps/api/src/material/material.repository.ts:240` não depende da janela, e as linhas enviadas há duas horas continuam contando.
Fila e prioridade: ok, não muda.
Concorrência: protegida. O caso que prova a reconferência do `LIMITE_EXCEDIDO` sob a trava voltou a funcionar: quando o teto enche durante o `guardarBytes`, o objeto e a linha saem.
Índice e paginação: ok, não muda.
Degradação de IA: não se aplica.
Migration: não se aplica.
Métrica e alerta: ok, não muda.
Bloqueantes: nenhum.
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/test/material-envio-orfao.int.test.ts:204`: o comentário diz que, sem o `enviadoHaMs`, o `429` sairia pelo teto de 100 por pessoa. Em `apps/api/src/material/material.service.ts:359` o teto de processamento é conferido antes, então hoje o `429` já viria dele. O `enviadoHaMs` continua valendo, porque protege o teste contra uma troca de ordem no service. Ajuste o texto para dizer isso, para o motivo registrado bater com o código.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/e2e/tamanho-da-letra.spec.ts`, caso novo: a prova de que o toque não sai depende de um `waitForTimeout(800)` fixo. Funciona, mas numa máquina lenta a janela pode ser curta demais para mostrar o problema. Daria para medir a mesma coisa por evento, por exemplo conferindo que nenhuma navegação para `/entrar` aconteceu antes de soltar a resposta da turma.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-13 23:01:08 · `tasks/correcoes/2026-11-13-esteira-vermelha-b942d26.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta correção. A correção mexe só em testes e e2e e não toca `apps/*/src` nem `packages/*/src`. O fixture `materiaisJaEnviados` (/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/test/material.fixture.ts:266) grava só em `material`. O `semearPainel` (/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/e2e/support/painel.ts:133) grava só `conta`, `usuario`, `convite`, `rede`, `escola` e `uso_infra_diario`. Todos com autor humano? Não se aplica, porque nenhum caminho novo grava nota.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. Nenhum fluxo de saída de IA foi criado nem alterado.

Supervisão do tutor: ok. O caso novo de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/e2e/tamanho-da-letra.spec.ts` só segura a resposta de `GET /v1/minha-turma` e confere a saída pela tela de Eu. Ele não usa o tutor.

Autonomia declarada e visível: sim. Nada mudou aqui. Não há agente, nível nem tela de governança no diff.

Itens 6 a 9: o diff não toca auditoria, sinais sobre o aluno, discursiva ou redação (D55) nem indicador de professor (D45).

Bloqueantes: nenhum.

Recomendações: nenhuma pela regra 70. O `waitForTimeout(800)` no caso novo é decisão do `test-engineer`, não minha.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-13 23:01:09 · `tasks/correcoes/2026-11-13-esteira-vermelha-b942d26.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. A correção mexe só em teste de integração e em e2e. Nenhum arquivo em `apps/*/src` ou `packages/*/src` mudou, e não há migration nem DTO novo.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. Nenhuma rota nova e nenhuma alteração de rota. O caso de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/e2e/operacao-escolas.spec.ts:595` continua provando o que já provava: depois que o primeiro operador sai e o segundo entra na mesma aba, a lista do primeiro não aparece. Agora ele faz isso sobre um painel que ele mesmo semeia (`novoPainel('nenhum')`, que o `afterEach` remove), e não sobre o que outra suíte deixou no banco. Nenhuma asserção foi afrouxada. A espera nova (`expect.poll(...).not.toEqual([])`) só garante que a lista existe antes de o teste conferir que ela some.

Logs: limpos. Nenhum log foi acrescentado.

Auditoria: presente onde cabe. Nenhuma ação que a regra 20 item 10 obriga a auditar foi tocada. O caso de `material-envio-orfao.int.test.ts` continua conferindo que, quando o envio é recusado sob a trava, o objeto e a linha saem sem deixar resto.

Envio externo: nenhum. O e2e novo de `tamanho-da-letra.spec.ts` só segura e depois solta `GET /v1/minha-turma` dentro do navegador do teste (`rota.fallback()`). Nada sai para provedor de IA nem para terceiro.

Seed/fixture: sintético.
- `criarAlunoComMatricula` (`e2e/support/seed.ts:180`) monta "Aluno sintético <uuid>", com matrícula derivada de `Date.now()` e senha `senha-sintetica-<uuid>`.
- `semearPainel` (`e2e/support/painel.ts:145-152`) cria "Rede sintética do painel" e "Escola sintética do painel …".
- `materiaisJaEnviados` (`apps/api/test/material.fixture.ts:271-279`) grava hash aleatório e só ids, e já aceitava `enviadoHaMs`.

Bloqueantes: nenhum.

Recomendações:
- A pergunta de fechamento não se aplica a esta correção, porque nenhum dado de aluno novo é guardado ou enviado. Ela segue respondida pelo que já existe (`arquivo-do-titular.int.test.ts`).
- Em `e2e/tamanho-da-letra.spec.ts`, o caso novo usa `waitForTimeout(800)` como janela de prova. Isso é aceitável para provar uma espera, mas a decisão de quanto tempo basta é do `test-engineer`, não da regra 20.

## test-engineer · 1ª rodada · APROVADO · 2026-11-13 23:02:15 · `tasks/correcoes/2026-11-13-esteira-vermelha-b942d26.md`

VEREDITO: APROVADO

**Cenários exigidos:**
1. A reconferência do teto de materiais em leitura sob a trava recusa com `429 LIMITE_EXCEDIDO`, e não sobra nem o objeto nem a linha do envio. O teto agora é 300, e o 429 tem de vir desse teto, não do teto de 100 envios por pessoa por hora.
2. O "Sair" da tela Eu do aluno só é tocado depois que a turma carrega. Isso precisa valer quando a resposta de `/v1/minha-turma` demora e quando ela volta 404, que é o caso do aluno sem turma no ano.
3. O caso "recomeço" de `operacao-escolas` passa com o banco vazio, que é como cada job da esteira começa (regra 40). Nenhuma asserção do caso pode ser afrouxada.
4. Mutação: a correção não altera nada de produção. O diff só mexe em `apps/api/test/` e `e2e/`, então a linha "Sem mutação" está correta.

**Cobertos:**
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/apps/api/test/material-envio-orfao.int.test.ts:202-221`. Conferi no service: as duas recusas usam o mesmo código e só o `Retry-After` muda (`material.service.ts:359` e `:360-363`), mas as 300 linhas nascem há duas horas e ficam fora da janela de uma hora. Se a cláusula do teto de leitura for removida, o envio volta 201 e o teste falha. Sem o `enviadoHaMs`, o teto por pessoa seguraria o 429 e o teste não provaria nada, então o ajuste é necessário. Rodei o caso isolado e ele passou. Os outros testes que enchem esse teto já usam a constante e a janela fora do intervalo: `material.int.test.ts:1030` e `:1101`, e `material-isolamento.int.test.ts:150`.
2. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/e2e/tamanho-da-letra.spec.ts:61-67` faz a espera, e o caso novo `:70-94` a prova: segura `/v1/minha-turma`, confere que a página continua em `/aluno/eu` e só depois solta a resposta. Usar `/^Carregando/` com contagem 0 é o padrão de `aluno-eu.spec.ts:247`. O caso que falhou na esteira (antes na linha 110, agora na 139) passa por esse helper.
3. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specingestao-do-material--l2/e2e/operacao-escolas.spec.ts:599` chama `novoPainel('nenhum')`, que cria 30 escolas e as remove no `afterEach`. A linha `:630` espera a lista não vazia, e a asserção `toBeGreaterThan(0)` ficou como estava.
4. Cada item de "Teste que reproduz" no documento aponta o seu teste pelo nome. Não há `.skip`, teste comentado, mock que esconda a regra nem chamada a provedor de IA. Teste de concorrência não se aplica aqui.

**Bloqueantes:** nenhum.

**Recomendações:**
- `material-envio-orfao.int.test.ts:217`: verificar também o `Retry-After`, que deve ser `ESPERA_PELO_PROCESSAMENTO_S`. Hoje, saber qual teto recusou depende só do `enviadoHaMs` da fixture. Se o padrão da fixture ou a janela mudar, o 429 do teto por pessoa passaria por este sem ninguém notar.
- `tamanho-da-letra.spec.ts:89-90`: os 800 ms são uma janela fixa. Se a espera estiver no lugar, o teste sempre passa. Se alguém a tirar, numa máquina lenta o toque pode não terminar em 800 ms, e o teste fica verde mesmo sem a correção. A prova seria mais firme se olhasse um efeito do toque, por exemplo que nenhum pedido de saída à API saiu enquanto a turma estava presa, em vez de depender do tempo.
- O caso novo de `tamanho-da-letra.spec.ts:70` prova o helper do teste, não uma regra do produto. Vale um comentário dizendo isso, para ninguém o ler como requisito da tela Eu.
- `operacao-escolas.spec.ts:631-632`: depois do `expect.poll` da linha 630, a leitura e a asserção seguintes repetem a mesma verificação. Não atrapalha, só pode ser enxugado.
- O vermelho do caso de `operacao-escolas` não foi reproduzido na máquina. Ele sairia rodando o caso sem o `novoPainel` sobre um banco recém-limpo (`EDUCA_BANCO_NOVO=1` seguido do e2e só desse caso). Fica como evidência para a validação, não como exigência.

Não rodei os e2e para não carregar a máquina. Para eles conto com a medição do documento (`--repeat-each 10`, 60 de 60 verdes) e com o portão da tarefa.

## test-engineer · 2ª rodada · APROVADO · 2026-11-13 23:15:55 · `tasks/correcoes/2026-11-13-esteira-vermelha-b942d26.md`

VEREDITO: APROVADO

**Cenários exigidos:** nesta segunda rodada só olhei o diff de `.processo/ordens/diff-esteira-r1-r2.txt` e o que ele afeta. Conferi o diff contra a árvore de agora pelo `git diff HEAD` e ele bate.
- No caso `LIMITE_EXCEDIDO` reconferido sob a trava, o 429 tem que vir do teto de processamento e não dos tetos de envio, mesmo que a ordem das conferências no service mude.
- O caso novo de `e2e/tamanho-da-letra.spec.ts` tem que mostrar, por evento e não por espera fixa, que o "Sair" não sai enquanto a turma está presa.

**Cobertos:**
- `apps/api/test/material-envio-orfao.int.test.ts:219-221` agora confere o `Retry-After`, e as duas asserções separam os dois tetos:
  - O teto de processamento devolve `ESPERA_PELO_PROCESSAMENTO_S = 30` (`apps/api/src/material/material.service.ts:52` e `:359`).
  - Os tetos de envio devolvem `JANELA_DOS_ENVIOS_MS / 1_000 = 3600` (`:363`).
  - `toBeLessThan(3600)` fica vermelho se o 429 vier dos tetos de envio. `toBeGreaterThan(0)` fica vermelho se o cabeçalho sumir, porque `Number(null)` dá 0. A cláusula fica presa ao teto certo.
  - O tipo `Awaited<ReturnType<typeof enviarMaterial>>` bate com o retorno do ajudante (`apps/api/test/material.fixture.ts:106`, que lê o `Retry-After` na `:132`).
  - O comentário novo descreve a ordem real do service: o processamento é conferido na `:359`, antes dos envios na `:363`.
- `e2e/tamanho-da-letra.spec.ts:92`: o `waitForTimeout(800)` virou `expect(page.waitForURL(/\/entrar$/, { timeout: 800 })).rejects.toThrow()`. Se o ajudante deixasse de esperar o "Carregando…" sumir, a página iria a `/entrar` e a espera resolveria, deixando o teste vermelho. Esse uso de `rejects.toThrow` já aparece em outros e2e (`e2e/guardas.spec.ts:215`, `e2e/agentes.spec.ts:180`).
- O comentário das linhas 90-91 diz que o caso prova o ajudante `sairPelaLinha` e não um requisito do produto. É verdade, e evita que alguém tome o caso por regra da tela Eu.
- As quatro recomendações aplicadas pela Mesa foram cumpridas como descritas. Não há `.skip`, teste comentado nem mock que esconda a regra.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Em `e2e/tamanho-da-letra.spec.ts:92`, trocar o `.rejects.toThrow()` sem argumento por `.rejects.toThrow(/Timeout 800ms/)`, como em `e2e/guardas.spec.ts:215`. Hoje qualquer rejeição passa, inclusive página fechada ou contexto destruído. O teste tem que passar só pelo motivo esperado, que é o prazo esgotado.
2. Ainda em `:92`: provar que algo não aconteceu continua dependendo de uma janela de 800 ms. Com a máquina carregada, um toque indevido que leve mais de 800 ms para navegar passa despercebido e o teste fica verde. O erro só esconde o problema, não derruba a esteira, e o caso testa um ajudante do e2e, então não bloqueia. Uma prova mais firme seria contar as navegações (`page.on('framenavigated')`) até o `soltar()`. Fica registrado para a retro.

Não rodei os testes. O `npx vitest run test/material-envio-orfao.int.test.ts` falhou antes de carregar porque o pacote `@educa/core` não está compilado ("Failed to resolve entry for package"), e compilar escreveria arquivos na árvore que os outros revisores estão lendo. A auditoria foi feita pela leitura do código. O portão da tarefa (`tools/processo/mutacoes.ts`) já roda esse teste com o pacote compilado.
