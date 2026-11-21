# Achados das revisões — `tasks/correcoes/2026-11-20-revisoes-nao-se-perdem-por-script.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-20 23:41:46 · `tasks/correcoes/2026-11-20-revisoes-nao-se-perdem-por-script.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. Todos com autor humano? Sim, porque nada no diff escreve em `Nota`. A mudança fica em `tools/processo/`, a ferramenta do processo de revisão, e não toca schema, repository, job, seed, importação nem webhook.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. Nenhum fluxo de saída de IA mudou. A tarefa protege a contagem de rodadas das revisões, inclusive do veto do `conformidade-reviewer`. Antes, uma rodada podia sumir quando um script reescrevia o documento. Agora a linha apagada volta da cópia em `.processo/revisoes/`, e o portão recusa o commit uma vez para o documento ser preparado de novo.

Supervisão do tutor: ok. Nada do tutor foi tocado.

Autonomia declarada e visível: sim. Nada em governança ou na declaração dos agentes foi alterado.

Bloqueantes: nenhum.

O que conferi:
- **Arquivos:** os cinco arquivos alterados (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/documento-de-revisao.ts`, `hook-revisoes.ts`, `portao.ts`, `revisoes.test.ts` e o `TODO.md`) e o teste novo `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/revisoes-nao-se-perdem.test.ts`. Nenhum toca nota, correção, tutor, autonomia de agente, decisão sobre aluno, indicador de professor, discursiva ou redação.
- **Conteúdo da cópia:** guarda só as linhas da tabela "Revisões" (data, revisor, veredito). Não tem dado de aluno nem de professor, e não alimenta métrica sobre o professor. Os itens 7 e 9 da regra 70 não são afetados.
- **Ordem do veto:** a restauração põe as linhas da cópia na ordem em que foram gravadas e depois as do documento que a cópia não tem. Como `lerRevisoes` usa a última rodada de cada revisor, uma reprovação mais nova continua valendo, e um veto apagado por script volta antes do commit.
- **Fotos da tela:** a tarefa não tem tela.

Recomendações:
- **Linha alterada à mão (limite (d) da tarefa):** é o caso de uma rodada REPROVADA trocada por APROVADA. A original volta ao documento, mas a alterada fica depois dela e passa a contar como a última rodada daquele revisor. Isso já era possível antes desta correção, então não é regressão. Ainda assim, vale registrar para a retro se o portão deveria comparar o veredito da cópia com o do documento quando a data e o revisor são os mesmos. O efeito seria um veto do `conformidade-reviewer` contornado à mão.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-20 23:42:10 · `tasks/correcoes/2026-11-20-revisoes-nao-se-perdem-por-script.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok (não se aplica: a correção não toca request, rota nem nada que rode em produção)
Fila e prioridade: ok (não se aplica: nenhum job novo)
Concorrência: protegida
Índice e paginação: ok (não se aplica: nenhuma query)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (não se aplica: é ferramenta local de processo e não roda no caminho quente)
Bloqueantes: nenhum

Como conferi:
- Nenhum arquivo de `apps/` ou de `packages/` mudou. A mudança fica em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/`, que roda só na máquina de quem desenvolve.
- Rodei `revisoes-nao-se-perdem.test.ts` e `revisoes.test.ts`: 356 casos, todos verdes. Nenhum teste chama provedor pago.
- Concorrência: os dois caminhos que gravam no documento usam a mesma trava, `comTrava` (em `tools/processo/caducidade.ts:186`). O `registrar` grava o documento e a cópia dentro dessa trava, e o portão do commit passa por ela via `restaurarRevisoesComTrava`. Cada documento tem a própria cópia, então dois documentos nunca disputam o mesmo arquivo.
- A pasta da cópia, `.processo/`, está no `.gitignore` (linha 26), então a cópia não entra em commit.

Recomendações:
- Não existe teste do `registrar` e do `restaurarRevisoesComTrava` rodando ao mesmo tempo sobre o mesmo documento, com dois processos. A trava já vinha de antes e protege o caminho novo, mas nenhum caso prova isso. Fica para a retro, não bloqueia.
- `gravarCopiaDasRevisoes` (`tools/processo/documento-de-revisao.ts`, cerca da linha 192) escreve a cópia direto no arquivo, sem gravar num temporário e renomear. Se o processo cair no meio, a cópia pode ficar truncada e devolver só parte da tabela. O efeito é baixo, porque os achados seguem como segunda fonte da contagem. Gravar num temporário e renomear elimina o caso.
- O hook escreve o `systemMessage` direto no stdout, em `tools/processo/hook-revisoes.ts`. Se outro ponto do mesmo modo `registrar` também escrever JSON no stdout, as duas saídas se juntam num JSON inválido. Hoje só há uma chamada, mas vale centralizar essa saída.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-20 23:42:31 · `tasks/correcoes/2026-11-20-revisoes-nao-se-perdem-por-script.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. É uma correção de processo e segue o item (X6, retro, M2) do `TODO.md`: cópia em `.processo/`, devolução a cada linha nova e antes do commit.
Portão local: carimbo válido

Bloqueantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/portao.ts:477` (chamada em `:491`). `bloqueioDeRevisoesPerdidas` procura o documento com `documentoDaMensagem(mensagem, raiz, [])`, sem a lista de arquivos alterados. Num commit de tarefa, essa lista é o que diz a qual pasta `prd-` o documento pertence. Os commits de tarefa deste repositório não citam `tasks/prd-…/` (`git log`: "… (tarefa 13.0)" e semelhantes). E o `N_task.md` existe em quase todas as pastas: o `2`, o `4`, o `5` e o `7` em 20 delas, o `10` em 19. Rodei a busca no repositório de verdade com `(tarefa 7.0)` e a lista vazia, e ela devolve `{"erro":"Não sei a qual funcionalidade pertence a tarefa 7.0. …"}`. Com esse erro, a função devolve `null` e não restaura nada.
  - **Consequência:** a parte "antes do commit" da correção nunca roda num commit de tarefa, e é justamente onde o defeito apareceu (X6 2.0/7.0/10.0, F4b 4.0/5.0/7.0). Ela só funciona em commit de correção, porque a marca de correção traz o nome do documento.
  - **Por que os testes não pegaram:** `revisoes-nao-se-perdem.test.ts` monta um repositório com uma única pasta `prd-exemplo`, e por isso o caso "sem a seção: devolve ao disco…" passa.
  - **Correção exigida:** calcular `arquivosAlterados(raiz)` antes da chamada e passá-los a `documentoDaMensagem`, como `decidirCommit` faz em `portao.ts:381`. Depois, acrescentar um caso com duas pastas `prd-` que tenham o mesmo `N_task.md`, um commit `(tarefa N.0)` sem o caminho, e o documento sem a seção, provando que a linha volta e o commit é recusado. Esse caso precisa de um bloco de mutação: sem a lista de alterados, ele fica vermelho.

Recomendações:
- O limite (d) do documento diz que uma linha alterada à mão volta como a original, ao lado da alterada. Vale deixar escrito em `protocolo.md` ou no aviso: quem edita uma linha da tabela de propósito vai ver a original voltar.
- `bloqueioDeRevisoesPerdidas` escreve no disco antes das outras recusas do portão. Hoje isso é inofensivo, porque só devolve linhas, mas a ordem "restaura, depois decide" merece uma linha no comentário da função. Hoje o comentário só explica o motivo de recusar uma vez.
- Pode haver chave de cópia velha: a cópia é chaveada pelo caminho e não expira. Um documento refeito no mesmo andar, com a tabela zerada de propósito, recebe as rodadas antigas de volta. O aviso mostra isso, mas cabe citar entre os limites declarados.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-20 23:42:42 · `tasks/correcoes/2026-11-20-revisoes-nao-se-perdem-por-script.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- Caminho feliz: um script reescreve o documento sem a seção "Revisões". Na rodada seguinte a 1ª linha volta, a nova é contada como 2ª e o hook avisa.
- O documento mantém a seção mas perdeu uma rodada: só a linha que sumiu volta, na ordem, e as outras ficam.
- Tabela inteira: nada muda e ninguém é avisado.
- Documento sem nenhuma rodada registrada, ou cópia de um documento que já não existe: nada é devolvido nem criado.
- Antes do commit: a linha volta ao disco, o commit é recusado uma vez e a segunda tentativa passa.
- Commit sem documento, e correção que não tem documento.
- Pontas da reconstrução: seção sem tabela, texto antes e depois da tabela, cabeçalho reescrito, arquivo sem quebra de linha no fim.
- A cópia fica fora de `tasks/` e o git a ignora.
- O aviso chega a quem roda o hook, que é executado como processo.
- Permissão e isolamento: não se aplicam, porque são ferramentas do processo e não tocam dado de escola.
- Concorrência: vários revisores do mesmo documento terminando ao mesmo tempo depois de a seção ter sumido, e o portão do commit devolvendo linhas enquanto o `registrar` escreve.

**Cobertos:** todos os cenários acima, menos o de concorrência. Rodei `npx vitest run tools/processo/revisoes-nao-se-perdem.test.ts` e os 23 casos passaram.
- Conferi os 18 blocos de mutação contra o `git diff`. Cada um chega à cláusula dele, e o motivo de `copia.length === 0` se sustenta.
- Três blocos ficam vermelhos por exceção, e não por asserção: o `existsSync` de `lerCopiaDasRevisoes`, o `existsSync` de `restaurarRevisoes` e o `'erro' in documento` do portão. Mesmo assim o caso roda e falha.
- A alteração em `revisoes.test.ts` (apagar `.processo/` antes da 2ª rodada) não esvazia o caso: ele continua provando que os achados seguram a contagem sem a cópia.
- Não há `.skip`, teste comentado nem mock da regra, e nenhum teste chama provedor de IA.

**Bloqueantes:**
1. **A restauração concorrente não tem teste de duas chamadas em paralelo.** Ela lê o documento, altera e grava, e essa operação é concorrente por desenho: esta tarefa tem seis revisores obrigatórios terminando juntos sobre o mesmo documento, e o próprio comentário de `restaurarRevisoesComTrava` diz que "o `registrar` escreve nele ao mesmo tempo".
   - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/documento-de-revisao.ts:254`: trocar `restaurarRevisoesComTrava` por `restaurarRevisoes` sem a trava deixa todos os testes verdes.
   - `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/documento-de-revisao.ts:490`: tirar o `restaurarAvisando` de dentro do `comTrava` do `registrar` também deixa tudo verde.
   - O único teste paralelo que existe (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/revisoes.test.ts:1422`) usa documentos diferentes, então não alcança a cópia nem o documento compartilhado.
   - **Correção exigida:** um caso em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/revisoes-nao-se-perdem.test.ts`, no padrão do teste da linha 1422 (N processos `node` com `spawn` e `Promise.all`). Ele registra uma rodada, reescreve o documento sem a seção e dispara N revisores distintos do mesmo documento em paralelo. Os tempos de fim precisam ser crescentes e de dia igual ao da 1ª rodada, senão a contagem compara pela hora. Esses processos rodam o `registrar`; o ideal é que um deles rode o `portao` do commit, ou o `restaurarRevisoesComTrava`, sobre o mesmo documento. O caso precisa afirmar quatro coisas:
     - a 1ª rodada aparece exatamente uma vez na tabela;
     - cada revisor tem a sua linha, sem nenhuma duplicada;
     - a contagem de rodadas está certa;
     - a cópia em `.processo/revisoes/` tem a tabela final inteira.

**Recomendações:**
- Do lado do commit, só o caso "sem a seção" tem teste. O segundo caso que o `TODO.md` pede ("com a seção sem uma rodada") só tem teste do lado do `registrar`. Um caso de `portao` com `semALinha` fecharia o par.
- O teste do hook como processo confere o `systemMessage` no stdout, mas não o stderr que a tarefa também promete (`revisoes: …`).
- Limite (b): o `registrar` grava a cópia na raiz da sessão (`CLAUDE_PROJECT_DIR`), e o portão a procura na árvore do commit (`arvoreDoCommit`). Num commit em outro checkout (`git -C`), a cópia não é achada. Vale escrever isso nos limites declarados.
- Para o vermelho ser por asserção e não por exceção, o bloco de `'erro' in documento` do portão poderia citar um caso que espere a mensagem de recusa de sempre.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-21 00:10:57 · `tasks/correcoes/2026-11-20-revisoes-nao-se-perdem-por-script.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. É correção de processo, sem seção da techspec. O documento da correção agora explica o novo jeito de achar o documento e a escrita atômica da cópia, e acrescenta os limites (e) e (f).

Portão local: carimbo válido. Cobre typecheck, lint, segredo, dependências, unidade e alvo, para o código atual.

Bloqueantes: nenhum.

A correção exigida na 1ª rodada foi feita:
- **Arquivos alterados passados à busca.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/portao.ts:495-496`, `bloqueioDoCommit` calcula `arquivosAlterados(raiz)` antes de chamar `bloqueioDeRevisoesPerdidas`. Na linha 481, a lista vai para `documentoDaMensagem`, como em `decidirCommit`. A mesma lista segue para a `EntradaDoCommit`, então a árvore não é lida duas vezes.
- **O caso pedido existe.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/revisoes-nao-se-perdem.test.ts`, o caso "duas funcionalidades com o mesmo 9_task.md" monta `tasks/prd-exemplo/9_task.md` e `tasks/prd-outro/9_task.md`. O commit `(tarefa 9.0)` não traz o caminho e o documento está sem a seção. O caso confere que a linha volta, que o motivo cita o documento certo e que `prd-outro` não é tocado.
- **O bloco de mutação está declarado.** O documento tem o bloco que troca `alterados` por `[]`. Com a lista vazia, a busca dá erro de ambiguidade, a função devolve `null` e `toContain('devolveu')` fica vermelho.

O resto do diff foi conferido:
- **Escrita da cópia.** `gravarCopiaDasRevisoes` grava num temporário com o pid e renomeia na mesma pasta. A mutação está declarada, e o caso que confere o inode e a pasta sem sobra prova a troca.
- **Testes de concorrência e da trava.** Os seis processos ao mesmo tempo e os dois casos da trava tomada provam que o `comTrava` envolve o portão e o `registrar`. Os dois blocos de mutação estão declarados.
- **`TODO.md`.** Entram duas linhas para a retro, com o que a Mesa recomendou e não coube na correção. Isso está dentro do escopo.

Recomendações:
- **Temporário que pode sobrar.** Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/documento-de-revisao.ts`, se o `writeFileSync` do temporário falhar no meio (disco cheio, por exemplo), o arquivo `.tmp` fica em `.processo/`. Não é lido como cópia, mas acumula. Um `try`/`finally` que apague o temporário quando o `rename` não acontecer resolve.
- **Testes que dependem de tempo.** Os casos da trava esperam 2500 ms e dão o processo por vivo se ele não terminou. Numa máquina carregada, o portão sem trava poderia passar desse prazo, e então a mutação sobreviveria por tempo, não por desenho. Nada vira vermelho à toa por isso, mas vale registrar.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-21 00:11:19 · `tasks/correcoes/2026-11-20-revisoes-nao-se-perdem-por-script.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. O diff desta rodada só mexe em ferramentas do processo: a cópia da tabela de revisões, o portão do commit, o hook do `SubagentStop`, os testes dessas peças, o documento da correção e uma linha nova no `TODO.md`. Nenhum código de produto, schema, migration, DTO ou rota foi alterado.

Fora da tabela de dados do docs/lgpd.md: nada. O código não cria campo pessoal. O que circula é o caminho do documento, o nome do revisor, a rodada, o veredito, o id do agente e a hora, todos sobre o processo e nenhum sobre um titular.

Autorização por objeto: não se aplica, porque não há rota nem endpoint. Tem uma ressalva. `bloqueioDeRevisoesPerdidas` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/portao.ts`) agora usa a lista dos arquivos alterados para achar o documento. Assim, quando duas pastas `prd-` têm o mesmo `9_task.md`, a linha volta para a pasta certa e a outra fica intacta. O teste "duas funcionalidades com o mesmo 9_task.md" prova isso, e existe um bloco de mutação para ele.

Logs: limpos. O aviso no stderr e o `systemMessage` mostram só o caminho do documento e quantas linhas voltaram.

Auditoria: não se aplica. Nenhuma das ações que a regra 20, item 10, manda auditar foi tocada.

Envio externo: nenhum. Não há chamada a provedor de IA nem a qualquer serviço de fora.

Seed/fixture: sintético. O teste novo (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/revisoes-nao-se-perdem.test.ts`) monta repositórios temporários com transcripts escritos no próprio teste ("Audite.", `a-<revisor>`, datas fixas). Nenhum dado de pessoa aparece ali.

Bloqueantes: nenhum.

Recomendações:
- A gravação da cópia por arquivo temporário renomeado (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/documento-de-revisao.ts`, `gravarCopiaDasRevisoes`) deixa um `.tmp` para trás se o processo cair entre gravar e renomear. Esse arquivo fica em `.processo/`, que é local e não vai para o commit. Não guarda dado pessoal, então não é um problema de privacidade. Se a retro tratar do item (a) do `TODO.md`, vale limpar `.tmp` antigos nessa mesma pasta.
- O limite (e) do documento da correção é uma questão de integridade do processo, não de privacidade. A cópia não expira, então um documento refeito pode receber rodadas antigas de volta. Acompanhe isso na mesma linha da retro.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-21 00:11:29 · `tasks/correcoes/2026-11-20-revisoes-nao-se-perdem-por-script.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum neste diff. Nem os seis arquivos alterados nem o teste novo tocam `Nota`, schema, seed, job, importação ou webhook. Todos com autor humano? Não se aplica, nada mudou desde a rodada aprovada.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. O diff não toca nenhuma saída de IA que chega ao aluno.
Supervisão do tutor: ok. O diff não toca o tutor.
Autonomia declarada e visível: sim. Nada mudou em `governanca`.

Audito o diff entre as árvores b901dd8a e 638134f4:

- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/documento-de-revisao.ts`: a cópia da tabela agora é gravada num temporário e renomeada. É integridade do registro das revisões e não toca a regra 70. O teste prova a troca de inode e que nenhum temporário fica, e o bloco de mutação está registrado.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/portao.ts`: `bloqueioDeRevisoesPerdidas` passa a achar o documento com `alterados`, como faz o `decidirCommit`. O comentário agora avisa que a função escreve no disco antes das outras recusas. Isso fecha o caso das duas pastas `prd-` com o mesmo `9_task.md`. O caso tem teste e mutação.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/TODO.md`: entrou a linha com o que a 1ª rodada recomendou e a correção não aplicou. Entre os itens está o meu, a comparação do veredito da cópia com o do documento. O destino é a retro e o motivo está registrado na seção "Recomendações sem aplicar" do documento da correção. Não é regressão: antes da correção, uma linha alterada à mão já podia passar do mesmo jeito.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/revisoes-nao-se-perdem.test.ts`: casos novos de concorrência (seis processos sobre o mesmo documento), da trava tomada de fora e do aviso no stderr. São testes de ferramenta do processo e não tocam a regra 70.

A 1ª rodada não exigiu correções, então não há nada a conferir desse lado.

Bloqueantes: nenhum

Recomendações:
- Quando a linha do `TODO.md` entrar, a comparação do veredito da cópia com o do documento (mesma data, mesmo revisor) precisa recusar o commit. Só avisar não basta. Essa tabela é o registro de que um revisor com veto aprovou, e uma REPROVADA trocada à mão por APROVADA anula o veto do `conformidade-reviewer` sem deixar rastro.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-21 00:11:40 · `tasks/correcoes/2026-11-20-revisoes-nao-se-perdem-por-script.md`

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
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/documento-de-revisao.ts:199-201`: se o processo cai entre o `writeFileSync` e o `renameSync`, o arquivo `<cópia>.<pid>.tmp` fica na pasta da cópia. A cópia continua íntegra, mas o órfão se acumula. Duas saídas: apagar `*.tmp` velho na próxima gravação, ou citar esse limite no documento da correção. O teste das linhas 101-109 confere que nenhum temporário fica, mas só quando a gravação termina bem.
- O item (a) que entrou no `TODO.md` está bem colocado: hoje uma linha REPROVADA trocada à mão por APROVADA volta ao documento ao lado da alterada, e as duas valem. Isso não muda nada no horário de aula. É do processo e fica registrado para a retro.

Esta tarefa é ferramenta de processo (os hooks do commit e das revisões) e não toca login, tutor, sala, prova, fila, IA, migration nem deploy. Não houve correção exigida na rodada anterior.

No diff, a concorrência está coberta por teste. Cinco revisores e um commit rodam como processos ao mesmo tempo e a 1ª rodada volta uma única vez. O portão e o `registrar` esperam a trava do documento antes de escrever nele. Nenhum teste chama provedor pago.

## test-engineer · 2ª rodada · APROVADO · 2026-11-21 00:12:21 · `tasks/correcoes/2026-11-20-revisoes-nao-se-perdem-por-script.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- A correção da 1ª rodada: rodadas restauradas ao mesmo tempo, com N processos em paralelo sobre o mesmo documento, entre eles um `registrar` e o `portao`.
- Os itens novos desta rodada:
  - o documento achado pela lista de arquivos alterados, quando duas pastas `prd-` têm o mesmo `9_task.md`;
  - a cópia gravada num temporário e renomeada;
  - o aviso também no stderr;
  - o portão diante de documento ausente ou de commit sem marca de tarefa;
  - a volta de uma linha só, quando a seção existe e falta uma rodada.

**Cobertos (o arquivo roda com 29 de 29 verdes):**
- **A correção exigida foi feita.** `tools/processo/revisoes-nao-se-perdem.test.ts`, no caso "cinco revisores e um commit ao mesmo tempo, sobre o documento sem a seção", sobe 5 processos `registrar` e 1 `portao` com `spawn` e `Promise.all`. O teste confere:
  - a 1ª rodada do `test-engineer` aparece exatamente uma vez, ainda como rodada 1 e com o veredito original;
  - cada revisor tem uma linha só, na rodada 1;
  - o total é de 6 linhas;
  - a cópia em `.processo/revisoes/` é igual à tabela final.
- **Sobre a ressalva dos tempos que eu pedi.** O texto dizia que os horários de fim precisavam ser crescentes e do mesmo dia. Ela não se aplica: `acrescentarRevisao` (`documento-de-revisao.ts:287`) conta as linhas por revisor e não compara horário. A asserção da contagem continua valendo.
- **As duas mutações da trava agora deixam um teste vermelho, e sem depender de corrida.** São os casos "com a trava do documento tomada, o portão do commit espera" e "… o registrar do revisor espera". Cada um prende a trava `${DOCUMENTO}.trava` por fora e confere que o processo continua vivo sem escrever no documento. Depois solta a trava e confere o resultado. Os dois blocos novos de mutação no documento apontam para esses casos. Juntos com o caso em paralelo, cobrem o que a 1ª rodada exigiu.
- **`portao.ts`, passar `alterados`:** o caso "duas funcionalidades com o mesmo 9_task.md" fica vermelho com `[]` no lugar da lista. Ele confere que a outra pasta não foi tocada.
- **`gravarCopiaDasRevisoes`, temporário e renomeado:** o caso compara o inode da cópia antes e depois. O `writeFileSync` direto mantém o inode e deixa o caso vermelho. O caso confere também que nenhum `.tmp` sobra na pasta.
- **O teste dos guardas `!documento` e `'erro' in documento` com `not.toThrow`:** o vermelho é o `TypeError` de `'erro' in undefined`. O cenário chega à cláusula, então o vermelho é pelo motivo certo.
- **Os demais itens:** o aviso no stderr com o prefixo `revisoes:`, e a volta de uma linha só com a seção presente ("1 linha da tabela"), têm asserção sobre o resultado.
- O documento da correção diz `--faltando: 0 linhas`, com 22 blocos. Não há `.skip`, nem mock de código da casa, nem chamada a provedor de IA.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Os dois casos da trava só pegam a mutação se a máquina for rápida.** Em `revisoes-nao-se-perdem.test.ts`, no `poucoDepois(2500)` dos dois casos, o código certo passa sempre. Já a mutação "sem trava" só fica vermelha se o processo `node hook-revisoes.ts` subir e escrever em menos de 2,5 s. Com a máquina carregada a mutação sobrevive: é um verde falso, e o portão da tarefa ficaria vermelho na prova de mutação. Há um jeito de não depender do relógio: manter a trava até o `comTrava` desistir (o limite é de 10 s, `caducidade.ts:188-195`). Aí o teste afirma que o processo saiu com status diferente de 0, por "trava presa", e que o documento ficou intacto. Assim o filho termina nos dois casos, com o código certo e com a mutação.
2. **O caso em paralelo não pega sozinho a retirada da trava.** Isso é por natureza, e o que prova a trava são os dois casos acima. Vale um comentário no caso apontando para eles.
3. **O caso em paralelo não afirma o que o `portao` fez.** Pode ter devolvido a linha ou não ter achado nada a devolver. Afirmar uma das duas saídas deixaria claro que ele chegou a `restaurarRevisoesComTrava`.
4. **As recomendações sem aplicar foram para o `TODO.md`:** comparar o veredito da cópia com o do documento, e centralizar a saída do `systemMessage`. Ficam registradas para a retro.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/revisoes-nao-se-perdem.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/documento-de-revisao.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tools/processo/portao.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia--l1/tasks/correcoes/2026-11-20-revisoes-nao-se-perdem-por-script.md`
