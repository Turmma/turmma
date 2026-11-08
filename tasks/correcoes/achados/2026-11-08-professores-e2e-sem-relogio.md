# Achados das revisões — `tasks/correcoes/2026-11-08-professores-e2e-sem-relogio.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-08 09:53:17 · `tasks/correcoes/2026-11-08-professores-e2e-sem-relogio.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova nem migration nesta correção. A função só escreve em `convite`, que já tem `escola_id` e FK composta `(escola_id, usuario_id)` para `usuario (escola_id, id)`, conforme `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/core/src/db/schema/convite.ts`.

Queries verificadas: uma só, o `update` de `anteciparOsConvitesDaPessoa` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/support/seed.ts`. É ajudante de semeadura do e2e, fora de repository e de endpoint. O filtro da escola aparece duas vezes: em `convite.escola_id = $1` e na subconsulta `usuario.escola_id = $1 and nome = $2`. Com isso, um nome repetido em outra escola não altera convite de lá. Nenhum repository, endpoint, DTO ou mensagem de erro de produto mudou, e não há `escolaId` vindo do cliente nem `@Unscoped()`. As duas chamadas em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/professores.spec.ts` (perto de :796 e :1357) passam o `escolaId` da coordenadora do próprio caso.

Teste de isolamento: não se aplica. A correção não cria módulo, query de produto nem endpoint. Ela só ajusta a ordem da validade dos convites da pessoa para os dois casos não dependerem do relógio, e nenhuma afirmação de isolamento dos casos mudou.

Bloqueantes: nenhum

Recomendações:
- O item novo do `TODO.md` está bem encaminhado ao Arquiteto. Quando a regra do "último convite" mudar em `apps/api/src/professores/professores.repository.ts`, a ordem nova (por `id` v7, por contador ou por data de criação) precisa manter o `escola_id` no `where` e no desempate da subconsulta. Ela também precisa de um teste de isolamento que prove que o convite de outra escola não entra na escolha, mesmo quando um usuário da escola B tem convite com validade maior.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-08 09:53:27 · `tasks/correcoes/2026-11-08-professores-e2e-sem-relogio.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta correção. `anteciparOsConvitesDaPessoa` só faz `update convite set expira_em = expira_em - interval '1 hour'`, filtrado por `escola_id` e `tipo = 'professor'`. Não grava `Nota`, `Correcao` nem nada que a IA produz. Todos com autor humano? Não se aplica, porque não há escrita em `Nota`.
Decisão autônoma sobre aluno: ausente. A correção trata só do convite de professor e da ordem em que a lista mostra os convites.
Aprovação registrada: ok. Nenhum fluxo de saída de IA foi tocado.
Supervisão do tutor: ok. O Tutor não foi tocado.
Autonomia declarada e visível: sim. Nada mudou em governança nem em `docs/agentes.md`.
Bloqueantes: nenhum.

O que conferi no recorte em revisão:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/support/seed.ts`, função `anteciparOsConvitesDaPessoa`: é código de teste e o dado é sintético. Os nomes dos professores levam `randomUUID` ou `marca`, então não pegam outra pessoa por acaso. A consulta e a subconsulta em `usuario` ficam presas à escola do caso.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/professores.spec.ts`, por volta de :796 (clique duplo) e :1357 (o professor cadastrado pela planilha): as duas chamadas usam o `escolaId` da coordenadora do próprio caso. O que cada caso afirma continua igual. Nenhum texto da tela ligado à regra 70 mudou, e nenhuma métrica, ranking ou dado nominal sobre o professor foi criado (itens 8 e 9).
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/TODO.md`: a seção nova só registra a pendência do "último convite" para o Arquiteto e não muda o produto.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-08-professores-e2e-sem-relogio.md`: a causa, a reprodução e o recorte estão coerentes. `docs/regulacao.md` e a regra 70 não mudaram.

Recomendações:
- O ajudante procura o professor pelo nome. Se um caso novo semear dois professores com o mesmo nome na mesma escola, os dois convites recuariam. Filtrar por `usuario_id` quando o caso já tiver esse id deixaria o alvo mais claro. Não bloqueia, porque os nomes de hoje são únicos.
- O comentário do ajudante cita a ordem do repository (`desc(expira_em), desc(id)`). Quando o Arquiteto decidir a pendência do `TODO.md`, esse comentário e o de `definirOEnvioDoConvite` precisam acompanhar a decisão.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-08 09:53:26 · `tasks/correcoes/2026-11-08-professores-e2e-sem-relogio.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. A correção mexe só em código de teste, não toca a regra do "último convite" no produto e leva a origem do problema ao Arquiteto pelo `TODO.md`, como o documento declara em "Fora desta correção".

Portão local: carimbo válido ("portão local válido para o código atual", com typecheck, lint, segredo, dependencias, unidade e alvo).

Bloqueantes: nenhum.

O que conferi:
- **Causa:** a ordem `asc(convite.usuarioId), desc(convite.expiraEm), desc(convite.id)` está em `apps/api/src/professores/professores.repository.ts:53` hoje e já estava no HEAD, na linha 51. Bate com o que o documento descreve.
- **Caso do clique duplo:** a chamada em `e2e/professores.spec.ts:796` vem depois da resposta do cadastro e antes do Refazer, que começa na linha 808.
- **Caso da planilha:** a chamada em `e2e/professores.spec.ts:1357` vem depois da gravação pela planilha e antes do Refazer, na linha 1361.
- **O que os testes provam:** nenhuma asserção mudou. O ajudante só deixa o convite velho mais antigo que o novo.
- **Escopo do ajudante:** a função `anteciparOsConvitesDaPessoa` em `e2e/support/seed.ts` filtra por `escola_id` no convite e no usuário, e `usuario.escola_id` existe (`packages/core/src/db/schema/usuario.ts:27`). Assim, um nome repetido em outra escola do banco de teste não é afetado.
- **Mutação:** a linha "Sem mutação" vem com motivo, e a correção não tem linha própria em `apps/*/src` nem em `packages/*/src`.

Recomendações:
- `e2e/professores.spec.ts:14`: o import de `anteciparOsConvitesDaPessoa` está depois do de `definirOEnvioDoConvite`, fora da ordem alfabética do bloco. O lint aceitou, mas vale pôr em ordem.
- `TODO.md`, na seção nova: a frase "o `W14` (`:457`) refaz uns segundos depois e ficou sem ele e não toca o repository" junta dois sujeitos diferentes, o W14 e a correção. Separar em duas frases deixa claro que quem não toca o repository é a correção.
- `e2e/support/seed.ts`: o comentário de `anteciparOsConvitesDaPessoa` conta a história do problema, que já está no documento da correção e no `TODO.md`. Bastam duas linhas: o que a função faz e por que existe.
- O filtro pelo nome da pessoa depende de o nome ser único na escola. Nos dois casos ele é, porque leva um sufixo aleatório. Filtrar pelo `usuario_id`, quando o caso o tiver, dispensaria essa suposição.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-08 09:53:30 · `tasks/correcoes/2026-11-08-professores-e2e-sem-relogio.md`

VEREDITO: APROVADO

A correção mexe só em teste: um ajudante de semeadura e duas chamadas a ele. Nenhum campo pessoal foi criado, nenhuma rota, DTO, log ou envio externo mudou.

Campos pessoais tocados: nenhum campo novo. O ajudante `anteciparOsConvitesDaPessoa` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/support/seed.ts:766-774`) muda só `convite.expira_em`. Ele usa `usuario.nome` como filtro, passado por parâmetro (`$2`), e não grava nem devolve dado de pessoa.
Fora da tabela de dados do docs/lgpd.md: nada.
Autorização por objeto: ok. Nenhuma rota foi criada ou alterada. O `update` filtra por `escola_id = $1` no convite e também na subconsulta de `usuario`, então não alcança outra escola mesmo que o nome se repita.
Logs: limpos. `comBanco` (`seed.ts:64-72`) não registra a query nem os parâmetros. O único texto de erro do arquivo (`seed.ts:77`) traz a instrução SQL e não os parâmetros, e não é usado pelo ajudante.
Auditoria: não se aplica. É ajuste de teste, sem ação que a regra 10 obrigue a auditar.
Envio externo: nenhum.
Seed/fixture: sintético. Os nomes são `Professor do clique duplo <uuid>` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/professores.spec.ts:768`) e `Nina Nova <marca>`, com `emailSintetico('nina')` (`professores.spec.ts:1337`). Tudo roda contra o banco de teste (`urlDoBancoDeTeste()`).
Bloqueantes: nenhum.

O que conferi nos dois casos:
- **Nenhuma verificação de privacidade foi enfraquecida.** As que vêm depois das chamadas (`:796` e `:1357`) continuam iguais: link de uso único que vem uma vez, `not.toContain(token)`, revogação do convite velho, e a planilha que não guarda nome nem e-mail.
- **O ajudante não esconde a regra de expiração.** Ele recua a validade só em uma hora, numa validade de 7 dias, então o convite segue válido e nenhum caso de vencimento passa a depender dele.

Recomendações:
1. **O defeito de produto que está no `TODO.md` é também um furo da regra 20, item 8 (revogação).** Quando o relógio recua entre o cadastro e o "Refazer", a tela da coordenação mostra o convite velho como "Convite revogado" e esconde o botão "Revogar convite". O convite novo, que é válido e já tem link emitido, fica ativo sem poder ser revogado pela tela até expirar. O caso não depende só da máquina de desenvolvimento: basta duas instâncias da API com relógios um pouco diferentes. Peço que a entrada do `TODO.md` diga isso, para o Arquiteto dar a prioridade certa à troca da ordem `desc(expiraEm)` em `apps/api/src/professores/professores.repository.ts`. Falta também um teste de API que prove que o último convite é o mais novo, mesmo com a validade menor.
2. Para quando o repository mudar: o filtro por `nome` pode pegar um homônimo dentro da mesma escola. Hoje é inofensivo, porque os nomes têm sufixo aleatório. Filtrar por `usuarioId`, como já faz `definirOEnvioDoConvite`, deixaria o ajudante mais estreito.

Pergunta de fechamento: a correção não mexe no arquivo do titular nem na lista de compartilhamento, então a resposta à secretaria continua a mesma de antes.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/support/seed.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/professores.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/TODO.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-08-professores-e2e-sem-relogio.md`

## infra-guardian · 1ª rodada · APROVADO · 2026-11-08 09:53:36 · `tasks/correcoes/2026-11-08-professores-e2e-sem-relogio.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok (a correção não toca)
Fila e prioridade: ok (a correção não toca)
Concorrência: protegida (a correção não toca; o problema de ordem que ela contorna já está no TODO.md)
Índice e paginação: ok (só o ajudante de teste lê o banco, com escopo `escola_id`)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (não se aplica, só código de teste)
Bloqueantes: nenhum

O que conferi no código:
- `anteciparOsConvitesDaPessoa` é chamado depois do cadastro e antes do Refazer nos dois casos (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/professores.spec.ts:796` e `:1357`). O convite novo (agora + 7 dias) fica à frente do velho (validade recuada uma hora) mesmo que o relógio recue 2 s.
- O convite velho continua em aberto depois do recuo, porque ainda vence daqui a quase 7 dias. Assim `convitesDeProfessorEmAberto` segue igual a 1, e o que os casos afirmam não muda.
- A update em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/support/seed.ts:767-774` tem escopo `escola_id` tanto no convite quanto na subquery de `usuario`. Nenhum provedor pago é chamado.

Recomendações:
1. `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/support/seed.ts:767-774`: o ajudante não confere se alguma linha mudou. Se o nome não bater (texto da tela mudar, espaço a mais), a update não faz nada e o defeito intermitente volta sem nenhum aviso. Falhe quando `rowCount === 0`, ou devolva a contagem e verifique no caso.
2. Do ponto de vista de carga, o item no TODO.md (escolher o último convite por `desc(expiraEm)`) não é só problema de teste. Com duas instâncias da API e relógios diferentes entre elas, coordenadoras da mesma escola refazendo um convite em instâncias diferentes caem na mesma inversão em produção. O Arquiteto deve tratar esse item junto com o de NTP e limite de diferença entre relógios (correção desafio-com-folga-de-relogio), não como assunto à parte.
3. O caso `W14` (`:457`) ficou sem o ajudante por causa do limite de duração. Ele continua dependendo de o Refazer vir mais de 2 s depois do cadastro. Se ficar intermitente de novo, a explicação é essa, até a regra do "último convite" ser revista.

## test-engineer · 1ª rodada · APROVADO · 2026-11-08 09:53:44 · `tasks/correcoes/2026-11-08-professores-e2e-sem-relogio.md`

VEREDITO: APROVADO

Cenários exigidos:
- Caminho feliz: depois do Refazer, a lista, o painel e as ações mostram o convite novo ("Revogar convite"), e o revogado não volta.
- Borda 1: o relógio de parede recua entre o cadastro pela tela e o Refazer logo depois (o clique duplo, `:745`).
- Borda 2: a mesma coisa com o professor cadastrado pela planilha (`:1333`).
- Borda 3: o `W14` (`:457`) e os casos que semeiam pelo banco ficam sem o ajudante, com o motivo escrito.
- Permissão e isolamento: a correção não muda nenhum dos dois. O ajudante só atua dentro da escola indicada.
- Concorrência: o clique duplo em cadastrar, refazer e revogar continua com dois cliques no mesmo instante, e a correção não mexe nisso.

Cobertos:
- A chamada em `e2e/professores.spec.ts:796` vem depois do cadastro e antes de fechar. A em `:1357` vem depois de abrir o painel e antes do Refazer. Nas duas, o convite velho fica uma hora mais antigo antes de o Refazer criar o novo.
- As asserções dos dois casos não mudaram. O ajudante não esconde a regra do "último convite":
  - se o repository escolhesse o de menor validade, o convite velho venceria e os dois casos ficariam vermelhos;
  - se o Refazer não revogasse o velho, a contagem de convites em aberto (`toBe(1)` em `:821` e `:1374`) pegaria.
- Os convites recuados ainda valem quase 7 dias, então "pendente" e a contagem em aberto continuam verdadeiros pelo motivo certo.
- `e2e/support/seed.ts:768-774`: a escrita fica presa à escola (`escola_id = $1` no convite e na subconsulta de `usuario`) e ao tipo `professor`. As colunas `usuario.nome` e `convite.escola_id` já são usadas assim em outros pontos do seed (`:733` e `:1369`).
- Mutações: o documento traz a linha `**Sem mutação:**` com motivo. Pelo `git diff`, a correção só altera código de teste, sem nada dela em `apps/*/src` nem em `packages/*/src`.
- Não há `.skip`, teste comentado, mock da regra nem provedor de IA.
- A causa no produto (a ordem por `desc(expiraEm)`, que segue o relógio) entrou no `TODO.md` com dono, o Arquiteto.

Bloqueantes: nenhum.

Recomendações:
1. **O ajudante não falha quando não acha ninguém** (`e2e/support/seed.ts:768-774`). Se o nome gravado vier diferente do digitado (a API cortar espaços, por exemplo), o `update` não altera nenhuma linha e o caso volta a ser intermitente sem nada avisar. Vale conferir que `rowCount` é pelo menos 1 e lançar erro quando não for.
2. **O risco continua no produto.** Um relógio que recua (um salto de NTP na VPS) faz a coordenação ver o convite revogado depois de um Refazer rápido, e o clique duplo é justamente um caso de Refazer rápido. Os dois casos agora estabilizam o e2e, mas nenhum teste prova o comportamento com o relógio recuando. Quando o Arquiteto resolver o item do `TODO.md`, vale um teste de integração com o relógio falso recuando entre os dois convites.
3. **Texto do `TODO.md`.** A frase "o `W14` (`:457`) refaz uns segundos depois e ficou sem ele e não toca o repository" junta dois sujeitos e lê mal. "Não toca o repository" é da correção, não do `W14`.
4. **Ordem do import** em `e2e/professores.spec.ts:13-14`: `anteciparOsConvitesDaPessoa` entrou depois de `definirOEnvioDoConvite`, fora da ordem alfabética do bloco.

Não rodei o e2e. A estabilidade de 24 em 24 é a que o documento declara, e a medida não ficou mais sujeita à carga da máquina: o recuo de uma hora é determinístico e muito maior que os até 2 s de recuo do relógio.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-08-professores-e2e-sem-relogio.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/support/seed.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/professores.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/TODO.md

## revisor-geral · 2ª rodada · APROVADO · 2026-11-08 10:06:01 · `tasks/correcoes/2026-11-08-professores-e2e-sem-relogio.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. A correção altera só código de teste e o `TODO.md`. A tabela "Recomendações sem aplicar" no documento dá destino a cada recomendação que ficou de fora.

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

Bloqueantes: nenhum

Esta rodada conferiu só o diff desde a rodada 1. As cinco recomendações que o Implementador disse ter aplicado estão no código:
- **`rowCount` e falha alta:** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/support/seed.ts:765-772` agora falha quando nenhuma linha muda. Nas duas chamadas o convite já existe quando o ajudante roda, então a falha não dispara por corrida. Em `e2e/professores.spec.ts:796` a resposta do cadastro já chegou (`:785`). Em `:1357` a conclusão da planilha e o `convitesDeProfessorEmAberto` igual a 1 vêm antes.
- **Comentário:** reescrito e mais curto.
- **Ordem do import:** corrigida em `e2e/professores.spec.ts:9`.
- **Frase e entrada do `TODO.md`:** feitas. A entrada registra o furo de produto ligado à regra 20, item 8 (o convite novo que não pode ser revogado pela tela), o dono e os testes que a mudança de regra vai exigir.

Recomendações:
- **Números de linha velhos.** O `TODO.md` (entrada da correção) e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-08-professores-e2e-sem-relogio.md` ainda citam `professores.spec.ts:745`, `:1331` e `:457`. Na árvore atual as chamadas estão em `:796` e `:1357`, porque a tarefa 4.0 desloca as linhas. Vale citar o caso pelo nome, que não muda com as linhas.
- **Frase do comentário.** Em `e2e/support/seed.ts:761`, "para o que um 'Refazer' logo depois criar ser o último que a lista mostra" está truncada. Sugestão: "para que o convite que um 'Refazer' logo depois criar seja o último que a lista mostra".

## test-engineer · 2ª rodada · APROVADO · 2026-11-08 10:06:02 · `tasks/correcoes/2026-11-08-professores-e2e-sem-relogio.md`

VEREDITO: APROVADO

Cenários exigidos:
- Caminho feliz: depois do "Refazer", o painel mostra o convite novo, com "Revogar convite". Vale para o clique duplo no cadastro (`e2e/professores.spec.ts:745`) e para o professor cadastrado pela planilha (`:1331`).
- Borda: o relógio de parede recua entre o cadastro e o "Refazer", e o convite novo sai com validade menor que a do velho.
- Borda: o ajudante não acha a pessoa (nome errado, cadastro ainda não gravado). Nesse caso ele precisa falhar alto, e não passar sem efeito.
- Permissão e isolamento: o ajudante só mexe em convite de professor da escola do teste. A regra de produto (qual convite é o último, com escopo de escola) foi para o Arquiteto.

Cobertos:
- **O ajudante falha alto.** `e2e/support/seed.ts:764-773` agora devolve o `rowCount` pelo `comBanco<T>` (genérico, `seed.ts:64`) e lança erro quando nenhuma linha muda. Assim, nome errado ou chamada antes da hora derruba o caso em vez de ele voltar a ser intermitente sem aviso.
- **As duas chamadas acontecem depois de o convite existir.** Em `professores.spec.ts:796` a chamada vem depois do `await cadastrado` (`:785`) e do token conferido (`:792`). Em `:1357` vem depois de a lista mostrar o professor pendente e de `convitesDeProfessorEmAberto` dar 1 (`:1352-1353`). O erro novo, portanto, não dispara sem motivo.
- **O escopo de escola continua dos dois lados.** O `escola_id = $1` está no `update` e na subconsulta de `usuario`.
- **O import foi reordenado sem mudar comportamento** (`professores.spec.ts:9`).
- **O comentário do ajudante ficou curto e correto.** Ele descreve o que a função faz e quando falha.
- **A entrada do `TODO.md` dá o próximo passo ao Arquiteto.** Agora registra o furo de produto da regra 20, item 8: com o relógio recuado, o convite novo fica ativo sem poder ser revogado pela tela, e isso também acontece entre instâncias da API com relógios diferentes. A entrada também diz quais testes a mudança de regra precisa trazer: integração com relógio falso recuando e isolamento contra validade maior em outra escola.
- **As mutações estão justificadas.** A correção só altera código de teste, então o "Sem mutação" vale. A cláusula nova (falhar quando não acha a pessoa) também é de teste, e é o próprio caso que a usa que a prova.
- **Não há `.skip`, teste comentado nem mock que esconda a regra** no que mudou.

Bloqueantes: nenhum.

Recomendações:
- `e2e/support/seed.ts:772`: o teste do erro é `alteradas < 1`, então um homônimo na mesma escola (com 2 ou mais linhas alteradas) passaria sem aviso. Hoje o sufixo aleatório no nome torna isso improvável. Trocar o teste para "exatamente o número de convites da pessoa", ou filtrar por `usuario_id`, fecha de vez. A recusa disso já está registrada na tabela "Recomendações sem aplicar"; fica para a retro, se valer.
- Não rodei os e2e desta vez. O diff só mudou o retorno do ajudante e o import, e a estabilidade medida no documento (24 de 24) não é afetada por essa mudança.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/support/seed.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/professores.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/TODO.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-08-professores-e2e-sem-relogio.md
