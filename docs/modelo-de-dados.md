# Modelo de dados

Notação: `→` referência, `*` obrigatório.

## Estrutura institucional

```
Rede*            nome, tipo (prefeitura | grupo | independente), ipsSaida (IP público de saída
                 da rede, não é dado de pessoa)
Escola*          → rede*, nome, slug*, inatividadeAlunoMin (30), inatividadeEquipeMin (120)
AnoLetivo*       → escola*, ano, inicio, fim, situacao (planejado | em_curso | encerrado)
Serie*           → escola*, etapa (ef_anos_finais | em), ano (6–9 | 1–3)
Turma*           → escola*, anoLetivo*, serie*, nome (2ºB), turno?
Disciplina*      → escola*, nome, area? (área da BNCC)
```

Tudo isso existe desde o F1. `slug` é o endereço de entrada da escola (`/e/:slug`), e a
inatividade da sessão é configurável por escola, com padrão diferente para aluno e equipe.
`criada_em` (F3, correção da 8.0) é o instante em que a escola passou a existir: `timestamptz not null default now()`, preenchido
pelo banco na transação que cria a escola, a mesma da auditoria `escola.criada`; nenhum código a informa nem a altera, e não é
dado de pessoa. Existe para a vigência do suboperador de alcance `todas` nunca começar antes da escola (abaixo, "Os suboperadores").
`situacao` tem unicidade parcial: um `em_curso` por escola. `Periodo` (bimestre), `inep`,
`endereco` e a configuração de retenção entram quando a funcionalidade que os usa chegar.

Rede e escola nascem só pelo operador Turmma (`ops:escola` ou o painel da operação, A0b), e o
**id delas pode vir do pedido**: a web sorteia um UUID v4 ou v7 ao abrir o diálogo, e o comando
sorteia um v4 (`randomUUID()`) a cada execução. O clique duplo repete o mesmo id, que o banco
recebe com `on conflict do nothing` e devolve sem criar outra (Tech Spec da A0b, seções 5 e 7c).
Só esse id, e só nessas duas tabelas, vem de fora; o resto continua `uuidv7()` do banco. O cliente
não escolhe um id legível: o contrato só aceita v4 e v7.

## Pessoas e vínculos

Implementado no F1. A forma exata das tabelas, com unicidades, índices e checks, está na
seção 3 da Tech Spec do F1 (`tasks/prd-identidade-e-tenancy/techspec.md`); aqui fica o desenho.

```
Conta            email?, senhaHash?, mfaSegredoCifrado?, mfaAtivadoEm?, mfaUltimoPasso?
                 (global, sem escola: é a identidade de login da equipe)
CodigoRecuperacao* → conta*, hmac*, usadoEm?
Usuario*         → escola*, conta? (nulo no aluno), papel*, nome*, desativadoEm?,
                   eliminacaoAgendadaEm? (F3: a data do registro da eliminação; o acesso fica suspenso)
                   introducaoVistaEm? (telas do aluno, 1.0: quando a pessoa viu a introdução do papel dela; sem anoLetivoId)
CredencialMatricula* → escola*, usuario*, matricula*, senhaHash*
ContaExterna*    → escola*, usuario*, provedor* (google | microsoft), tenant?, sujeito*
ProvedorEscola*  → escola*, provedor*, valor* (hd | tid), removidoEm?
Vinculo*         → escola*, anoLetivo*, usuario*, turma*, disciplina?, papel*,
                   estado* (pendente | confirmado | contestado | encerrado),
                   contestacao? (nao_leciono | turma_errada | disciplina_errada | outro),
                   complemento?, motivoEncerramento? (fim_do_ano | desligamento | realocacao),
                   criadoPor*, decididoEm?, encerradoEm?
Sessao*          → escola*, conta?, usuario*, metodo* (email | matricula | externo), familia*,
                   refreshHash*, ultimoUsoEm*, expiraEm*, encerradaEm?, motivo?
RegistroAcesso*  → escola?, usuario?, evento* (login | login_falho | renovacao | saida), ip*, em*
Convite          → escola*, tokenHash*, tipo (coordenador | professor), usuario*, expiraEm,
                   usadoEm?, revogadoEm?
```

**A introdução vista** (telas do aluno e primeiro acesso, tarefa 1.0). `usuario.introducao_vista_em` é a data em que a pessoa
viu a introdução do papel dela, ou nula. Fica no usuário, e não no vínculo, porque o vínculo é por turma e ano e a introdução
voltaria em janeiro, e não na conta, porque o aluno não tem conta. Só a própria pessoa grava, por `POST /v1/eu/introducao`, com
`coalesce(introducao_vista_em, now())` na linha do contexto (`escola_id` e `id`): a primeira data nunca muda. O `GET /v1/eu`
devolve a mais antiga entre a da linha e a dos outros usuários ativos da mesma conta **com o mesmo papel**, e, quando a
data vem de outra escola e a linha está nula, grava nela o `now()` da própria escrita, nunca a data emprestada (dado de A não é
gravado em B); assim a introdução não reabre quando o vínculo de A termina. O usuário desativado ou com eliminação agendada não
empresta. Migration `0039`, só expande: coluna nula, sem índice nem valor padrão.

**A eliminação agendada** (F3, tarefa 14.0). O pedido de eliminação do titular nasce `agendado`, com
`eliminar_em = now() + 7 dias` pelo relógio do banco, e o mesmo registro grava `usuario.eliminacao_agendada_em` e
encerra as sessões abertas da pessoa naquela escola (motivo `eliminacao_agendada`). A coluna é o espelho do pedido,
na mesma transação: a guarda de sessão, a renovação, o login por matrícula, por e-mail e por conta externa e o seletor de
escola a leem, e a pessoa não entra enquanto ela existir; a credencial e o vínculo ficam, para o cancelamento devolver o
acesso. A unidade é o titular, não o pedido: o índice único parcial `pedido_titular_agendado_unico (escola_id, titular_id)
where estado = 'agendado'` decide, no banco, duas eliminações ao mesmo tempo, e a segunda responde
`PEDIDO_EM_ESTADO_INVALIDO`. O cancelamento trava o pedido e depois o usuário (a ordem do registro), só vale antes de
`eliminar_em` e antes de o job da eliminação ser enfileirado, e apaga a coluna. O expurgo de `pessoa_desativada` pula quem
tem pedido `agendado`: a pessoa sai pelo prazo do pedido, nunca pelo da desativação. Rollback do código: runbook, "Voltar o
código com eliminação agendada em curso".

**A eliminação no 8º dia** (F3, tarefa 15.0). A rotina da noite da escola marca `pedido_titular.eliminacao_enfileirada_em` (a
trava do cancelamento) e grava o job `titular.eliminar` na mesma transação, para o pedido `agendado` vencido que ainda não tem
marca ou cuja marca tem mais de 20 h, até 500 por noite. O job troca o nome completo do aluno por `[nome removido]` em
`execucao_agente.entrada`, `consumo_ia.entrada` e `saida`, `artefato.titulo` e `conteudo`, `mensagem_agente.conteudo` e
`entrega.justificativa`, em faixas de 1.000 linhas, com a janela letiva conferida entre elas, e grava `titular.nome_trocado` por
linha de execução, consumo, artefato e entrega. Depois, numa transação só, na ordem pedido → usuário: refaz o compartilhamento,
anonimiza as execuções do titular, elimina a pessoa, marca `apagado_em` nos arquivos dele, conclui os outros pedidos abertos e
conclui o pedido. O autor é quem registrou, se ainda é usuário ativo da escola, ou `rotina` (`autor_operador`, só em
`usuario.eliminado`, `acesso_turma.revogado`, `titular.nome_trocado` e `pedido.concluido`, por check do banco). O pedido guarda
só o id do titular e as duas marcas, `nome_trocado` e `homonimo`.

**A identidade é global, os vínculos são por escola** (decidido na Tech Spec do F1). `Conta`
não tem `escolaId` porque é o login; `Usuario` é a pessoa *naquela* escola, com o papel dela.
Um professor em duas escolas é uma `Conta` com dois `Usuario`, e o escopo de tenant continua
inteiro na regra 10: toda tabela de domínio tem `escolaId`, e quem resolve a fronteira é a
`ResolucaoDeTenantRepository`, com `@Unscoped` e teste de arquitetura que prova que só `sessao`
a importa. Ela não é mais a única a alcançar a `Conta` sem escopo: as três operações sobre a
`Conta` global que o ciclo de vida faz (travar, limpar a conta sem uso e encerrar as sessões dela) moram
na `ContaGlobalRepository`, em `packages/nucleo/src/ciclo-de-vida`, desde que o ciclo de vida foi
para o `nucleo` (F3, tarefa 1.0): ela não sai pelo barrel do pacote, só pelo subcaminho
`@educa/nucleo/conta-global`, e o teste de arquitetura lista quem a importa — o
`CicloDeVidaService` e o `sessao` (a redefinição do MFA), e os testes deles. As três são exceções antigas que mudaram
de lugar, mas já estão no ponto que a regra 10, item 9 aponta como sinal de desenho errado (a
terceira no mesmo módulo): qualquer outra ali é mudança de spec, discutida antes, e não acréscimo
de tarefa. A única leitura nova (F3, tarefa 13.0) é a do e-mail da `Conta` pelo arquivo do titular
(`LeituraDoTitular`, tabela `conta`, que a Tech Spec do F3, seção 3, manda levar "só o e-mail, nas duas
versões"): ela **não é consulta sem escopo**, porque junta o `Usuario` da escola do contexto pelo id do
titular e devolve só `id` e `email` da conta dele; a conta de outra pessoa, ou a de quem não é usuário desta
escola, nunca chega. Por isso não passa pela `ContaGlobalRepository`, e o teste de arquitetura do arquivo
(`o arquivo do titular lê as tabelas da classificação`) confere que a leitura declara toda coluna da `Conta`
como entra ou fora (`senha_hash`, `mfa_*`).

**O aluno é `Usuario` sem `Conta`**, com `CredencialMatricula`. Não tem e-mail (regra 20).
Matrícula é única por `(escolaId, matricula)`, nunca globalmente: dois alunos em escolas
diferentes podem ter a mesma.

`ContaExterna.sujeito` é o identificador opaco da conta Google ou Microsoft da escola (D48);
e-mail, nome e foto que o provedor devolve são descartados antes de gravar. Uma conta externa
por usuário na escola. `ProvedorEscola` é a lista de domínios Google (`hd`) e tenants
Microsoft (`tid`) que a escola cadastrou: o que não está nela não entra, e o domínio retirado
ganha `removidoEm` em vez de ser apagado.

`Vinculo` é criado pela escola (coordenação, grade importada ou Classroom), nasce `pendente` e
só dá acesso quando o professor o confirma (D3 revista, regra 60 item 8a). O professor não cria
o próprio vínculo: confirma ou contesta. `complemento` é texto livre de até 140 caracteres, com
aviso de não escrever nome de aluno, e é apagado na virada do ano, quando o vínculo passa a
`encerrado` com motivo `fim_do_ano`.

`papel`: `rede` · `coordenador` · `professor` · `aluno` · `responsavel`. A matriz de quem
alcança o quê é declarada num lugar só, em `packages/shared/src/permissao/matriz.ts`.

### Lista de nomes da turma — A1

Implementado na A1 (tarefa 2.0). A forma exata está na seção 3 da Tech Spec da A1
(`tasks/prd-apresentacao-escola/techspec.md`) e na migration `0019_lista_nome.sql`.

```
ListaNome*       → escola*, anoLetivo*, turma*, nome?, matricula?,
                   estado* (livre | reivindicado | aprovado), usuario?, criadoPor?, criadoEm*
```

`ListaNome` é a lista que a coordenação sobe por turma, colada ou em arquivo (até 200 linhas e
64 KB por envio, com prévia linha a linha), ou nome a nome (o aluno que chega em maio). O aluno
entra pelo link ou pelo código da turma, reivindica um nome e só vira `Usuario` com matrícula e
senha **depois da aprovação humana** (D4). No F1 o aluno e o vínculo dele vêm do seed sintético.

- **Aprovado ⇔ usuário ⇔ nome e matrícula nulos**, por check no banco: o aprovado guarda só o
  estado e o usuário, e o nome e a matrícula passam a viver no `Usuario` e na
  `CredencialMatricula` (`docs/lgpd.md`). O livre e o reivindicado têm os dois, e nenhum usuário.
- **Matrícula única por escola e ano**, com `btrim`, nunca no sistema (regra 60, item 6). É o
  alvo do `on conflict do nothing` da gravação: a mesma lista enviada duas vezes, mesmo ao mesmo
  tempo, entra uma vez. Na prévia, a matrícula que já está na lista da turma, ou do aluno aprovado
  nesta turma (8.0), sai `ja_existe`; a da lista de outra turma da escola, ou de outro aluno da escola
  (`CredencialMatricula`), sai com erro. O nome avulso confere a credencial depois do `insert`, e a
  gravação lê a lista antes da credencial: a matrícula que está sendo aprovada nunca entra de novo
  como nome livre (C12).
- Turma, usuário e autor por FK composta com a escola. A turma com nome na lista não se exclui
  (`CONFLITO`). O autor (`criadoPor`) vira nulo se a pessoa for eliminada, e a autoria fica na
  auditoria (`lista.gravada`).
- **O nome livre sai de fato** quando a coordenação o retira (`lista_nome.retirado` na
  auditoria): é pré-cadastro, sem conta nem histórico, e a minimização vence a exclusão lógica.
  O reivindicado e o aprovado não saem por aí.
- A coordenação lê a lista com finalidade, e cada leitura grava `turma.lista_lida`. O professor
  não lê a lista.
- **Virada e eliminação** (10.0): o encerramento do ano apaga os nomes livres e reivindicados do
  ano, na mesma transação, depois de fechar os pedidos pendentes como `encerrada` e revogar os
  acessos; o aprovado fica. A gravação e o avulso travam o ano em curso em `FOR SHARE` antes da
  turma: o nome que nasce junto com o encerramento é alcançado por ele, ou não nasce. A eliminação
  do aluno aprovado apaga, antes do usuário, os pedidos da linha dele e a linha.

### Acesso da turma — A1

Implementado na A1 (tarefa 4.0). A forma exata está na seção 3 da Tech Spec da A1 e na migration
`0020_acesso_turma.sql`.

```
AcessoTurma*     → escola*, anoLetivo*, turma*, tokenHash*, codigoHmac*, validadeDias* (1 | 7 | 30),
                   expiraEm*, revogadoEm?, criadoPor?, criadoEm*
```

`AcessoTurma` é o link da sala e o código da turma que o professor com vínculo **confirmado** gera
(RF9), e que o aluno usa para abrir a turma e reivindicar o nome (5.0 e 6.0). Os dois valem juntos,
pela mesma validade. A coordenação não gera acesso.

- **O link e o código aparecem uma vez**, na resposta do gerar (`no-store`): o token do link (a web
  monta `/e/<slug>/turma#<token>`) e o código de 8 caracteres de um alfabeto de 31, sem 0, 1, I, L e
  O, mostrado em dois grupos de 4. O banco guarda só o SHA-256 do token (a mesma peça do convite) e
  o HMAC do código com `SALA_CHAVE_CODIGO`, uma chave só dele. A leitura devolve só `expiraEm`.
- **Vigente** é o não revogado e não vencido. "Gerar novo" revoga todo acesso não revogado da turma,
  também o de outro professor, na mesma transação do novo; a auditoria do novo
  (`acesso_turma.gerado`) lista os que ele derrubou. Revogar sem acesso vigente responde como
  inexistente.
- **Quem gerou e saiu**: quando termina o último vínculo `confirmado` do professor na turma (o
  encerrar da coordenação, por `desligamento` ou `realocacao`, ou a eliminação do usuário), o acesso
  vigente daquela turma que ele gerou é revogado na mesma transação, com `acesso_turma.revogado`.
  Outro vínculo confirmado dele na turma (outra disciplina) segura o acesso, e o acesso de outro
  professor não é tocado (correção `2026-10-03-acesso-sobrevive-ao-vinculo`).
- Índices únicos parciais entre os não revogados: um acesso por turma (dois gerar ao mesmo tempo:
  um grava, o outro `CONFLITO`) e o código único na escola (a colisão do sorteio sorteia de novo num
  savepoint, até três vezes, e depois 503). O token é único no sistema, porque o link não diz a escola.
- Turma por FK composta com a escola e o ano, `on delete cascade`: a turma só se exclui sem acesso
  vigente (`CONFLITO`), e o revogado ou vencido sai com ela. O autor (`criadoPor`) vira nulo se o
  professor for eliminado, e a autoria fica na auditoria.
- **Travas**: o gerar trava o ano em curso e a linha da turma em `FOR SHARE`, e reconfere o vínculo
  num comando próprio depois da trava; o excluir (`FOR UPDATE`), o encerrar do vínculo e a eliminação
  do professor (`FOR NO KEY UPDATE`) travam a turma num comando próprio, antes do vínculo, do
  `delete` e da revogação: a ordem é sempre turma → vínculo. O ano
  encerrado não ganha acesso novo, o excluir nunca leva, pela cascata, um acesso que acabou de ser
  entregue, e o acesso gerado no mesmo instante em que o vínculo termina cai com ele (ou o gerar sai
  inexistente).

**A página pública da sala** (`POST /v1/salas/abrir`, tarefa 5.0) não tem sessão: o aluno chega com o
slug da escola e o link ou o código, e a escola, o ano e a turma saem da linha do acesso vigente. As duas
consultas sem escopo que ela alcança são estas, cada uma com `@Unscoped` e a justificativa no código:

| Repository e método | O que faz | Justificativa |
|---|---|---|
| `ResolucaoDeTenantRepository.acessoDaSalaPorToken` | acha o acesso vigente pelo hash do token, conferido contra a escola do slug, no ano `em_curso` dela | o link e o código da sala não dizem a escola; o token é único no sistema, e o slug é conferido contra a escola da linha no mesmo comando; devolve só escola, ano e turma |
| `ResolucaoDeTenantRepository.acessoDaSalaPorCodigo` | acha o acesso vigente pelo HMAC do código, buscado já na escola do slug, no ano `em_curso` dela | o link e o código da sala não dizem a escola; o código é único só dentro da escola e a chave do HMAC é uma só, então o mesmo código em duas escolas tem o mesmo HMAC, e só o slug as separa; devolve só escola, ano e turma |

Ficam em `sessao`, e não em `sala`, porque a `ResolucaoDeTenantRepository` é a fronteira da resolução
de tenant e só `sessao` a importa (teste de arquitetura I1): o `sala` alcança as duas pelo `AcessoDaSala`,
de `apps/api/src/sessao/tenant/acesso-da-sala.ts`, que devolve só a escola, o ano e a turma e roda o resto no
contexto delas. Inexistente, vencido, revogado, de ano encerrado, de turma excluída (a cascata levou o
acesso), de outra escola e slug inexistente respondem o mesmo `NAO_ENCONTRADO`. A página mostra o nome
da turma e os nomes `livre` da lista, com id e nome, sem matrícula, em ordem de nome e até 500
(`MAXIMO_DE_NOMES_NA_SALA`), lidos a cada abertura; não grava registro de acesso nem lê cookie.

### Pedido de reivindicação — A1

Implementado na A1 (tarefa 6.0). A forma exata está na seção 3 da Tech Spec da A1 e na migration
`0021_reivindicacao.sql`.

```
Reivindicacao*   → escola*, anoLetivo*, turma*, listaNome?, chaveEnvio?, senhaHash?,
                   teveMatriculaErrada?, estado* (pendente | aprovada | recusada | encerrada),
                   solicitadaEm*, decididaEm?, decididaPor?, decididaComo? (professor | coordenacao)
```

`Reivindicacao` é o pedido do aluno pelo próprio nome da lista, pela página pública da sala
(`POST /v1/salas/reivindicar`), com a matrícula e a senha que ele cria. Só a aprovação de uma pessoa
cria o aluno (D4; 8.0). Não há `dispositivo`: nada liga o pedido ao navegador nem ao IP (PRD, 10.2).

- **O pedido nasce `pendente`** com o hash argon2id da senha, a `chaveEnvio` que a página sorteia a
  cada envio e `teveMatriculaErrada`, lido do contador de matrícula errada daquele nome pelo mesmo acesso da turma
  (7.0: sim se houve alguma na janela de 10 min, sem número nem hora). Os três
  existem só no pendente, e o pendente tem os três (check); a decisão e o encerramento os apagam. O
  pendente sempre aponta para o nome (check): o nome de um pendente não se apaga, e o encerramento e
  a eliminação fecham ou apagam o pedido antes.
- **Na mesma transação**, o `insert` do pedido e, depois, o `update` condicional do nome da lista
  para `reivindicado`, por id, escola, ano, turma do acesso, `livre` e matrícula. O hash roda antes,
  sempre, no semáforo do login, no balde da escola, fora da transação.
- **Uma resposta só**: nome inexistente, de outra turma ou escola, de ano encerrado, tomado ou com a
  matrícula errada dão o mesmo `REIVINDICACAO_RECUSADA`, sem gravar. A FK violada, qualquer 23505 ou o
  `update` sem linha voltam a transação, e um comando novo relê a chave na escola e na turma do
  acesso: achou, é o reenvio do mesmo envio (`enviado`, sem pedido novo); não achou, a recusa. O nome
  da restrição nunca é lido.
- Índices únicos parciais: a chave de envio, na escola (não no sistema); um pendente por nome.
  Índices pelo escopo: `(escola, turma, estado, solicitadaEm)`, para os pedidos da turma, e
  `(escola, listaNome)`, para o `set null` da FK achar os pedidos do nome que sai.
- Turma por FK composta com a escola e o ano, sem ação: a turma com pedido não se exclui
  (`CONFLITO`). O nome por FK composta com a escola, `on delete set null (lista_nome_id)`: o nome
  que sai deixa o pedido decidido sem nome. Quem decidiu, `on delete set null (decidida_por)`, com a
  autoria na auditoria.
- O reivindicado não se retira da lista (`CONFLITO`), e o login com a matrícula e a senha do pedido
  pendente responde como senha errada: a credencial só nasce na aprovação.
- **A decisão** (8.0): o professor com vínculo confirmado na turma e a coordenação leem os pendentes
  (a coordenação com finalidade, gravando `turma.reivindicacoes_lidas`) e decidem até 40 por vez, uma
  transação por pedido. A aprovação cria o `Usuario` aluno com o nome da lista, a `CredencialMatricula`
  com a matrícula da lista e o hash do pedido, o `Vinculo` de aluno `confirmado` com `decididoEm` e quem
  aprovou em `criadoPor`, e deixa o nome `aprovado`, sem nome nem matrícula; a recusa devolve o nome a
  `livre`. Nas duas, o hash, a chave e a marca saem, e `reivindicacao.decidida` guarda quem decidiu e
  como (`professor` ou `coordenacao`). O pedido fora do alcance de quem decide responde como o
  inexistente, e o já decidido que ele alcança, `ja_decidida`.
- **O ano travado** (10.0): a reivindicação e cada decisão travam o ano em curso em `FOR SHARE` no
  começo da transação. O encerramento, que muda o ano antes de tudo, ou espera e fecha o pedido
  pendente como `encerrada` (sem hash, chave, marca nem quem decidiu: não é decisão), ou chega antes e
  faz a reivindicação ser recusada e a decisão sair `nao_encontrada`, sem gravar. O pedido decidido ou
  encerrado fica sem nome quando a linha da lista sai, e não tem expurgo na A1 (`TODO.md`, F3).

### Ainda não existe — F2

```
Responsavel      → usuario*, aluno*, parentesco
```

`Convite` no F1 é só de coordenador, criado por comando do operador. Na A1 (tarefa 3.0) entra o tipo
`professor`: a coordenação cadastra o professor (nome e e-mail) e o convite nasce junto, válido por
7 dias (o de coordenador, 72 h; os dois em `VALIDADE_DO_CONVITE_HORAS_POR_TIPO`, de `@educa/shared`).
O convite de professor reusa a conta global: o e-mail que já tem conta em outra escola cliente
ganha outro `Usuario` na escola, com a mesma `Conta`, e aceita com a senha que já tinha; o que não
tem ganha a conta sem senha, definida no aceite. Nada na lista nem na auditoria da coordenação diz
qual dos dois foi (a conta global é o quarto afrouxamento da D71, só com dado sintético). O aceite do
professor não leva ao segundo fator. O `tipo` separa os dois convites em toda escrita: o operador só
alcança o de coordenador, e a coordenação só o de professor, com o filtro no `where` dos dois lados.
Cadastrar, refazer e revogar o de professor pegam a mesma trava por escola do de coordenador. O
convite `sala` não existe: o aluno entra pelo acesso da turma (`AcessoTurma`, A1).

Na A0b o convite da primeira coordenação também nasce pelo painel da operação, pelo mesmo caso de
uso do comando, e o painel também o refaz. Gerar, refazer e revogar pegam uma trava por escola (`pg_advisory_xact_lock(7_000_003,
hashtext(escola_id))`) e só então leem o estado da coordenação (`estadoDaCoordenacao`), que decide
pela matriz da Tech Spec da A0b (seção 5): no máximo um convite em aberto por escola. O índice
único parcial `convite_pendente_unico (escola_id, usuario_id) where usado_em is null and
revogado_em is null` é a rede de segurança da trava, e a recusa dele sai como `CONFLITO`. O refazer
revoga o convite de origem por um `update` condicional (só em aberto) e cria outro para o mesmo
usuário, com `convite.refeito` na auditoria (a origem, o usuário e a validade).

A lista do painel lê o mesmo estado para as escolas da página, e por isso `Usuario` ganhou o índice
parcial `usuario_coordenador_ativo_idx (escola_id) where papel = 'coordenador' and desativado_em is
null` (A0b, tarefa 5.0): sem ele, a pergunta "há coordenador ativo?" varre os usuários de todas as
escolas, que crescem com os alunos.

## Operação Turmma

Implementado na A0 (D76). A forma exata das tabelas, com unicidades, índices e checks, está na
seção 3 da Tech Spec da A0 (`tasks/prd-apresentacao-operacao/techspec.md`); aqui fica o desenho.

```
Operador                  apelido* (único), nome?, email? (único), senhaHash?, mfaSegredoCifrado?,
                          mfaChaveVersao?, mfaVersao*, mfaAtivadoEm?, mfaUltimoPasso?, criadoEm*,
                          desativadoEm?
CodigoRecuperacaoOperador → operador*, hmac*
ConviteOperador           → operador*, tokenHash*, expiraEm* (72 h), usadoEm?, revogadoEm?
SessaoOperador            → operador*, refreshHash*, refreshHashAnterior?, rotacionadoEm?, criadaEm*,
                            ultimoUsoEm*, expiraEm* (8 h), encerradaEm?, motivo?
AcessoOperacao            → operador?, evento* (entrada | entrada_falha | saida), ip*, em*
AuditoriaOperacao         autor* (apelido ou bootstrap), acao*, → operadorAlvo*, em*
```

**São da nossa equipe, não de escola**, e por isso não têm `escolaId` (Tech Spec da A0, seção 11).
O que impede que isso vire atalho para dado de escola é a cerca, provada por teste de arquitetura
(C45): só o `OperadorRepository` as toca, e ele não toca outra tabela; o expurgo só apaga, pelo
prazo, `AcessoOperacao`, `SessaoOperador` e `ConviteOperador`. O operador desativado não guarda
dado pessoal, por check no banco: fica o apelido, que é o que vai para `Auditoria.autorOperador`.
Um convite pendente por operador, por único parcial.

**O painel da operação** (A0b, D76) lê entre escolas, e é a exceção da regra 10, item 9. O desenho
está na Tech Spec da A0b (`tasks/prd-apresentacao-painel/techspec.md`, seções 6 e 11), e as consultas
sem escopo que uma rota do painel alcança são estas, cada uma com `@Unscoped` e a justificativa no
código:

| Repository e método | O que faz | Justificativa |
|---|---|---|
| `PainelRepository.redes` | a lista de redes para criar escola | acima do tenant; só id, nome e tipo, até 200, sem escola nem pessoa |
| `PainelRepository.escolas` | a lista de escolas, com o estado da coordenação e as contagens do ano em curso | só id, nome, endereço e número, sem pessoa |
| `PainelRepository.uso` | o uso de infra de cada escola no último dia fechado e no mês dele | só id, nome e número, sem pessoa |
| `RedeEEscolaRepository.criarRede`, `criarEscola` | cria, ou lê pelo id o pedido repetido | a rede fica acima do tenant, e a escola é o próprio tenant, que nasce ali; só o comando ou o painel cria, e devolve só o id |
| `ResolucaoDeTenantRepository.contaParaConvite` | acha ou cria a conta pelo e-mail no convite da coordenação | a conta é global e não tem escola; não lê nada dela e devolve só o id e se é nova |
| `ResolucaoDeTenantRepository.escolaDoConviteParaOperador` | a escola do convite de coordenação | recebe só o id do convite, e a escola dele vira o contexto, nunca o argumento |

O `PainelRepository` é o único lugar da leitura entre escolas: os três métodos dele são todos
`@Unscoped`, e só o `painel.service.ts` o importa (teste de arquitetura I1). Os outros quatro já
existiam para os comandos `ops:*` e passaram a servir também ao painel, com a justificativa "comando
ou painel" (o `ops` continua com os dois, I2, e o `sessao` não ganhou nenhum). Eles servem às
escritas: fora a leitura da escola do convite, que só devolve o `escola_id`, as escritas abrem o
contexto da escola antes de tocar qualquer tabela dela, e o resto do gerar, refazer e revogar roda
com escopo. Não há tabela nova: o painel lê `rede`, `escola`, `ano_letivo`, `turma`,
`vinculo`, `usuario`, `convite` e `uso_infra_diario`, e devolve só id, nome, endereço, estado e
número. A alternativa recusada, uma chamada por escola no contexto dela, espalharia a exceção por
todos os repositories que a lista toca.

## Grade horária e calendário

```
GradeHoraria*    → escola*, anoLetivo*, nome
TempoAula*       → gradeHoraria*, diaSemana*, ordem*, inicio*, fim*
Alocacao*        → tempoAula*, turma*, disciplina*, professor*, sala?
EventoCalendario → escola*, tipo (feriado | recesso | evento), inicio, fim
Aula             → alocacao*, data*, conteudo?, status, observacao?
```

`Aula` é a instância concreta gerada a partir de `Alocacao` mais o calendário escolar. É a
camada onde o professor registra o que deu e é a fonte do "seu dia e sua semana", função do
Assistente de ensino (`docs/agentes.md`).

## Conteúdo

```
FonteMaterial*   → escola*, tipo (scraper | upload), adaptador?, autorizacaoDoc*,
                   autorizadoPor*, autorizadoEm*,
                   titularidade* (escola | professor | licenciado | dominio_publico | enem),
                   licencaDoc?, licenciante?, licencaValidaAte?, ativo
Material*        → escola*, fonte*, titulo, versao*, disciplina?, serie?, arquivoUrl,
                   status (pendente | processado | falhou), processadoEm?
Capitulo         → material*, titulo, ordem, paginaInicio, paginaFim
HabilidadeBNCC   → codigo*, descricao, etapa, componente     (tabela pública, sem escola)
TrechoIndexado   → material*, capitulo?, texto, embedding, pagina*, habilidades[]
Questao*         → escola?|publica, enunciado*, tipo*, alternativas?, gabarito*,
                   disciplina, assunto, dificuldade, habilidades[],
                   fonte (propria | enem | vestibular), origemMaterial?, origemPagina?
```

`escola` nulo significa banco público (ENEM, vestibulares), visível a todos. Material
ingerido **nunca** cruza de escola. `autorizacaoDoc` registra a autorização escrita da
escola para a fonte. Quando `titularidade` é `licenciado`, `licencaDoc` e `licenciante` são
obrigatórios. Sem autorização e, quando couber, sem licença, nem o upload nem o adaptador
processam (D5 revista, `docs/regulacao.md` seção 5). **Quem sobe é a coordenação** (D75):
`autorizadoPor` é sempre alguém com papel de coordenação na escola, e professor e aluno não
criam `FonteMaterial` nem `Material`. `titularidade` diz de quem é o material — `professor`
é o material de autoria do professor, que entra pelas mãos da coordenação —, não quem subiu.

`origemMaterial` e `origemPagina` são a rastreabilidade: o professor confere de onde a
questão saiu.

## Avaliação

```
Avaliacao*       → turma*, disciplina*, professor*, periodo*, titulo*, modo*, peso,
                   dataAplicacao, status
ItemAvaliacao*   → avaliacao*, questao?, enunciado?, pontos*, ordem*
Aplicacao        → avaliacao*, aluno*, iniciadoEm, entregueEm, origem, saidasDaAba?
Resposta         → aplicacao*, item*, conteudo, arquivoUrl?
Correcao         → resposta*, pontosObtidos?, feedback?, origem (auto | ia | professor),
                   aprovadaPor?, aprovadaEm?
Diagnostico      → escola*, anoLetivo*, aplicacao*, habilidade*, acertos, total,
                   observacao?, geradoEm*
Nota*            → aluno*, avaliacao*, valor*, lancadaPor*, lancadaEm*
```

`Diagnostico` é o resultado formativo por habilidade, que existe antes da nota oficial (D46).
Em item discursivo ou de redação **não existe `Correcao` com `origem = ia`**: a IA não
corrige, não avalia, não pontua e não escreve `feedback` sobre o texto do aluno nessas
modalidades, nem como rascunho para o professor ver (D55, revisão da D46, ratificada em
23/09/2026). Ali a `Correcao` nasce com `origem = professor`. O que a IA produz
para discursiva e redação é a **rubrica da avaliação**, que pertence ao item e não à resposta
de ninguém.

`modo`: `online_objetiva` · `online_discursiva` · `papel_foto` · `entrega` · `presencial`

`saidasDaAba` é a contagem de vezes em que a aba da prova perdeu o foco, **só em avaliação
online**. Fica na `Aplicacao`, nunca no aluno: não é somada entre avaliações, não vira
indicador, e só o professor da turma lê (D70).

<critical>`Nota` só existe com `lancadaPor` preenchido por um humano. Correção de IA
preenche `Correcao`, nunca `Nota` diretamente.</critical>

## Correção por foto

```
FolhaResposta    → avaliacao*, aluno*, codigo*, versao
Captura          → folhaResposta*, imagemUrl*, status, confianca, revisadoPor?
```

`codigo` é impresso na folha e identifica aluno e avaliação sem depender de OCR de nome.

## Agentes

```
Agente*          → escola?, chave*, nome*, avatar, descricao, autonomia* (1..4), ativo
ThreadAgente*    → agente*, usuario*, ultimaLeitura
MensagemAgente*  → thread*, autor (agente | usuario), conteudo*, anexos?
Entrega          → mensagem*, tipo*, payload*, status (pendente | aprovada | rejeitada),
                   aprovadaPor?, aprovadaEm?, justificativa?
ExecucaoAgente   → agente*, escola*, gatilho*, entrada, saida, perfilIa, modelo, tokens,
                   custo, duracao, status, erro?, enviadoExternamente (bool)
OrcamentoIa      → escola*, anoLetivo*, limiteMensal, consumoAtual, alertaEm
PacoteTutor      → escola*, anoLetivo*, turma*, mes*, trocasPorAluno* (padrão 300),
                   freioDiarioPorAluno* (padrão 60), consumoTrocas
ConsumoIa        → escola*, usuario*, perfil*, tokens*, custo*, em*
```

`autonomia` é visível ao coordenador em tela. Nível 3 e 4 seguem `docs/agentes.md`.

**Autonomia e suspensão por função** (D9, D32 e D60 revistas em 23/09/2026). Com três agentes,
um por pessoa da escola, a autonomia deixa de caber num campo do `Agente`: ela é declarada por
**função** (correção de objetiva, adaptação, seu dia e sua semana…). O P01 de
`docs/pendencias-dos-mockups.md` pede `FuncaoAgente → agente*, chave*, nome*, autonomia*,
altoRisco*, ativo`; `funcao*` em `Entrega` e em `ExecucaoAgente`, que também filtra a thread do
Assistente; e a suspensão como registro próprio, `escola*, funcao*, suspensaPor*, em*, motivo`,
com auditoria. **Entregue na migration 0022** (`packages/nucleo/drizzle/0022_mvp_apresentacao.sql`)
e em `docs/mvp-contratos.md`, com uma diferença do P01: a função não virou tabela. O catálogo é
código, `FUNCOES` em `packages/shared/src/time/funcoes.ts`, e `funcao` é texto com restrição de
valor em `entrega`, `execucao_agente` e `consumo_ia`. A suspensão é a tabela `suspensao_de_funcao`
(`escola_id`, `funcao`, `motivo` de lista fechada, `suspensa_por`, `suspensa_em`, `retomada_por`,
`retomada_em`), com auditoria em `funcao.suspensa` e `funcao.retomada`. O bloco acima continua
sendo o desenho do F1 no que a 0022 não tocou.

```
AdaptacaoAluno*  → escola*, anoLetivo*, aluno*, tipos* (linguagem_direta | resposta_escrita |
                   fonte_ampliada | tempo_extra | enunciado_simplificado | leitor_de_tela |
                   outro), detalhe?,
                   registradaPor* (coordenação), registradaEm*, revisarEm*
```

`AdaptacaoAluno` guarda **o que adaptar, nunca o porquê**: sem diagnóstico, laudo ou CID
(D35). `detalhe` é texto curto e revisado; campo livre que vira prontuário é reprovação no
`privacy-guardian`. Leitura por professor é limitada às turmas dele e fica em auditoria. A
ferramenta Adaptação e o Tutor recebem só os `tipos` (D66, D67). A lista de tipos fecha no PRD;
precisa cobrir pelo menos o aluno surdo e o que não fala.

## Tutor, sala e supervisão

```
PoliticaTutor*   → turma*, modo* (bloqueado | socratico | livre), definidaPor*,
                   foraDaSala* (bool, padrão falso), foraDaSalaDefinidoPor?,
                   busca* (bool, padrão falso), buscaAte?, buscaDefinidaPor?
BuscaEscola*     → escola*, liberada* (bool, padrão falso), liberadaPor?, tetoDiarioPorAluno*
FonteAprovada*   → escola?, dominio*, faixa* (anos_finais | medio | ambas), ativa*
BuscaTutor       → sessao*, consulta* (escrita pelo modelo), fontesAbertas, criadaEm*
ContextoTurma*   → turma*, disciplina*, conteudoAtual, listaAtiva?, focoDaSemana,
                   definidoPor*, validoAte
ReforcoAluno*    → turma*, disciplina*, aluno*, habilidades* (códigos da lista),
                   definidoPor*, revisarEm*
SessaoTutor*     → aluno*, turma*, disciplina?, modo (sala | casa), iniciadaEm, encerradaEm
MensagemTutor*   → sessao*, autor (aluno | tutor), conteudo*, criadaEm*
SinalAluno       → sessao*, tipo (travado | pediu_resposta | fora_de_escopo | duvida |
                   atencao_humana),
                   detalhe, criadoEm*
SalaAoVivo       → turma*, professor*, abertaEm, fechadaEm
```

`MensagemTutor` tem retenção de 12 meses e acesso restrito ao professor da turma. A rede
nunca alcança conteúdo de conversa — apenas agregado.

A **memória do Tutor cobre a trajetória inteira do aluno**, e é quase toda leitura: `Aplicacao`,
`Resposta`, `Correcao` (com a devolutiva do professor), `Diagnostico`, `SinalAluno`,
`ContextoTurma`, `ReforcoAluno` e os `tipos` de `AdaptacaoAluno`. O que é novo é o resumo da
sessão, em formato fixo, e o índice para recuperar por relevância:

```
ResumoSessaoTutor → sessao*, assunto*, habilidades, exercicio?, ondeTravou?, comoTerminou*
```

Não existe campo de texto livre sobre o aluno, escrito por modelo ou por professor (D66).

A busca tem **duas chaves**: `BuscaEscola.liberada` é da coordenação, `PoliticaTutor.busca` é do
professor, com prazo; sem as duas, e sempre durante avaliação e no modo casa, a busca é
recusada no servidor. `FonteAprovada` sem `escola` é a lista padrão nossa. `BuscaTutor.consulta`
é a que o modelo escreveu, sem o texto do aluno (D68).

`foraDaSala` é decisão da escola, por turma, e nasce desligado (D19). O `modo` é do
professor; o `foraDaSala` é da coordenação. Sem ele ligado, `SessaoTutor` com modo `casa` é
recusada no servidor.

## MVP de apresentação (A2 a A5) — o que está implementado

Implementado na fatia única do MVP de apresentação (D77), nas migrations `0022_mvp_apresentacao.sql` e
`0023_mvp_restricoes.sql` (a segunda só aperta: FKs com o ano letivo e a turma, gatilhos e duas colunas nulas). A forma exata, com
colunas, unicidades, checks e gatilhos, está em `docs/mvp-contratos.md` e no docblock de cada tabela; os blocos de
"Conteúdo", "Avaliação", "Agentes" e "Tutor, sala e supervisão", acima, continuam sendo o desenho definitivo, que cada fase
completa.

```
Material*          → escola*, disciplina*, titulo*, titularidade*, licenciante?, licenca*, declaracao*,
                     sha256*, tamanhoBytes*, paginas?, estado* (processando | pronto | falhou), falha?,
                     enviadoPor?, enviadoEm*, excluidoPor?, excluidoEm?
Trecho*            → escola*, disciplina*, material*, pagina*, texto*, busca (tsvector, português)
ExecucaoAgente*    → escola*, anoLetivo*, funcao*, tarefa*, solicitadaPor?, chaveEnvio*,
                     estado* (pendente | rodando | concluida | falhou), entrada*, resultado?, erro?, datas,
                     anonimizadaEm? (F3)
ConsumoIa*         → escola*, aluno?, execucao?, tarefa*, funcao*, perfil*, origem*, modelo*, promptVersao*,
                     tokensDeEntrada*, tokensDeSaida*, custoMicros*, duracaoMs*, envioExterno*, provedor? (F3: só com
                     envioExterno; o id do provedor que recebeu o conteúdo), tentativas*,
                     estado*, codigoDeErro?, entrada?, saida?, em*
ThreadAgente*      → escola*, anoLetivo*, usuario*, agente*
MensagemAgente*    → escola*, anoLetivo*, thread*, execucao*, autor* (usuario | agente), conteudo*, turma?, disciplina?
Artefato*          → escola*, anoLetivo*, turma*, disciplina*, tipo*, titulo*, conteudo*, origem? (versão adaptada),
                     execucao?, criadoPor?
Entrega*           → escola*, anoLetivo*, turma*, funcao*, tipo* (versao_adaptada | lote_de_correcao), artefato?,
                     atividadeAplicada?, execucao?, estado* (pendente | aprovada | rejeitada), decididaPor?,
                     decididaEm?, justificativa?
AtividadeAplicada* → escola*, anoLetivo*, turma*, artefato*, avaliativa*, estado* (aberta | encerrada),
                     aplicadaPor*, aplicadaEm*, encerradaEm?
TentativaAtividade*→ escola*, anoLetivo*, atividadeAplicada*, aluno*, iniciadaEm*, enviadaEm?
RespostaAtividade* → escola*, anoLetivo*, atividadeAplicada*, aluno*, questao* (1..20), alternativa* (0..3)
Correcao*          → escola*, anoLetivo*, entrega* (lote), atividadeAplicada*, aluno*, acertos*, total*, emBranco*,
                     porHabilidade*, destaques*, destaqueAbertoEm?, destaqueAbertoPor?
ValidacaoDoLote*   → escola*, anoLetivo*, entrega*, atividadeAplicada*, apresentado*, aberto*, confirmadaPor*,
                     confirmadaEm*
MensagemTutor*     → escola*, anoLetivo*, turma*, aluno*, execucao*, atividadeAplicada?, questao?, material?,
                     pagina?, autor* (aluno | tutor), tipo* (texto | assunto_delicado), texto*, citacoes?
SinalTutor*        → escola*, anoLetivo*, turma*, aluno*, execucao?, tipo* (travou | resposta_pronta |
                     duvida_repetida | atencao_humana), atividadeAplicada?, questao?, material?, pagina?
SuspensaoDeFuncao* → escola*, funcao*, motivo?, suspensaPor*, suspensaEm*, retomadaPor?, retomadaEm?
ResumoDoAnalista*  → escola*, anoLetivo*, execucao?, conteudo*, geradoEm*
```

O que a fatia tem de diferente do desenho definitivo, e por quê:

- **`Material` junta a fonte e o material**, e o arquivo não é guardado: ficam os metadados, a titularidade, a licença e a
  declaração, e o texto por página vai para `Trecho`, sem `embedding` (busca por texto completo em português). Não existe
  material sem a declaração de licença (check), e a recusa não grava linha (D5, D75).
- **Não existe `Nota`** (D46). `Correcao` é o diagnóstico formativo de objetiva, por aluno e por lote; `AtividadeAplicada`,
  `TentativaAtividade` e `RespostaAtividade` são a `Avaliacao`, a `Aplicacao` e a `Resposta`, finas, só para objetiva online.
- **A função não é tabela**: é o catálogo `FUNCOES`, em código (`packages/shared/src/time/funcoes.ts`). `Entrega`,
  `ExecucaoAgente` e `ConsumoIa` levam a chave dela, e `SuspensaoDeFuncao` é o registro próprio da suspensão (D60).
- **A validação do lote é tabela própria** (D56), e o lote só fica aprovado com ela (gatilho no banco). A versão adaptada
  só é aplicada à turma com a entrega aprovada (gatilho no banco).
- **Não existe `AdaptacaoAluno`** nesta fatia: a versão adaptada leva só os tipos de adaptação e vai para a turma, sem
  vínculo com aluno (D35).
- **O Tutor não tem sessão, política nem resumo de sessão**: a conversa é `MensagemTutor`, por aluno, e a memória é leitura
  das tentativas, das correções de lote aprovado e dos sinais. `SinalTutor` não tem `detalhe`: é tipo fechado mais a
  referência ao trabalho, e `atencao_humana` não carrega referência nenhuma (D36, D57, D66).
- **O freio e o pacote do Tutor** são duas colunas de `configuracao_operacional_escola`, e não a `PacoteTutor` por turma.
- **`ConsumoIa` não tem usuário** (D64): só o aluno, nas funções do Tutor. `entrada` e `saida` ficam nulas onde a chamada
  leva conversa de pessoa (o Tutor e a proposta de ferramenta).
- **O uso do Tutor por turma** (`GET /v1/tutor/uso`) é leitura de `MensagemTutor`, sem tabela: por aluno, as trocas do dia,
  a última e em que ele estava (`questao`, `pagina`). É o que faz não existir uso invisível ao professor (D47).
- **Nada cruza de turma nem de ano letivo na mesma escola**: a entrega, a mensagem e o sinal do Tutor apontam para a
  aplicação com a turma, e as FKs para `Artefato` e `ExecucaoAgente` levam o ano.

## Comunicação, conta e conformidade

```
Evento*          → escola*, tipo*, entidade*, entidadeId*, payload, em*
Notificacao      → usuario*, evento*, titulo*, corpo*, canal*, lidaEm?, enviadaEm?
Contrato         → rede*|escola*, inicio, fim, licencas, valor, docTratamentoDados*
Auditoria*       → escola*, autorUsuario? | autorOperador?, acao*, entidade*, entidadeId,
                   antes?, depois?, finalidade?, requisicaoId*, em*    (F1)
SolicitacaoTitular → escola*, titular*, tipo (acesso | correcao | eliminacao |
                   portabilidade | compartilhamento), status, solicitadaEm*, atendidaEm?
RetencaoEscola*  → escola* + categoria* (chave), meses*, referenciaContrato*, alteradaEm*,
                   alteradaPor* (apelido do operador)    (F3)
ExpurgoExecucao* → escola*, categoria*, linhas*, concluida*, em*    (F3)
Suboperador      chave* (única entre os vigentes), nome*, finalidade*, categorias* (lista fechada), pais*,
                 contrato* (código, nunca texto), vedaTreinamento*, alcance* (todas | lista), inicio*, fim?,
                 registradoPor* (apelido do operador)    (F3, sem escolaId)
SuboperadorEscola → escola* + suboperador* (chave), inicio*, fim?    (F3, só no alcance "lista")
Incidente        conhecidoEm*, registradoPor* (apelido do operador), registradoEm*    (F3, sem escolaId)
IncidenteEscola  → escola* + incidente*, circunstancias*, categorias* (lista fechada), titularesEstimados*,
                 risco* (baixo | relevante | alto), contencao*, correcao*, avisadoEm*, confirmadoEm?, confirmadoPor?    (F3)
```

`RetencaoEscola` guarda só o **ajuste** da escola numa categoria do catálogo de retenção (`CATEGORIAS_DE_RETENCAO`, em
`packages/shared/src/privacidade`): sem linha, vale o padrão do catálogo. Só o `ops:retencao` escreve, no contexto da
escola, dentro do piso, do teto e das travas entre categorias, com `retencao.ajustada` na auditoria; o prazo efetivo
sai de `retencaoDaEscola`, e a escola lê pelo `RetencaoDaEscolaRepository`, com o escopo do contexto. O número do
contrato é inteiro, como o do pedido no `ops:redefinir-mfa`, porque vai também para a auditoria, que não aceita texto
livre. Não varia por ano letivo. Toda tabela das migrations está em `CLASSIFICACAO_DAS_TABELAS` (categoria do expurgo,
prazo fixo com quem o aplica, ou sem pessoa; se entra no arquivo do titular e por qual coluna se liga a ele), e as
colunas de segredo, em `COLUNAS_FORA_DO_ARQUIVO`; o teste de arquitetura confere as duas listas contra as migrations.

**Os suboperadores (F3, tarefa 8.0).** `Suboperador` é a empresa que recebe dado da escola (hospedagem, provedor de IA, e-mail,
busca) e **não tem `escolaId`**: a hospedagem atende toda escola, e uma linha por escola seria a mesma linha cem vezes. Só o
`ops:suboperador` escreve (`cadastrar` e `encerrar`), pelo `OperacaoPrivacidadeRepository` (o `encerrar` fecha as ligações de uma
empresa em todas as escolas, e é o **único `@Unscoped`** do F3 nos comandos `ops:*`: grava só a data de fim e devolve só a
contagem), e a escola lê pelo
`SuboperadorDaEscolaRepository`, que filtra por `(alcance = 'todas' or exists (ligação com a escola do contexto))` e é só
leitura; o teste de arquitetura procura outro uso, por import e por SQL. `SuboperadorEscola` liga o de alcance `lista` a cada
escola, escrita no contexto dela (o `escola_id` vem do contexto, nunca de argumento). A vigência que a escola lê é a da
ligação ou, em `todas`, a do suboperador, com o `fim` mais cedo entre os dois: quem saiu da lista com a empresa seguindo para
as outras a vê como passada. **A vigência nunca é anterior à escola** (correção da 8.0): como o `todas` não tem ligação, o
`SuboperadorDaEscolaRepository` compara, no banco e só para essa linha, com o `escola.criada_em` da escola do contexto: o início
é o maior entre o da empresa e o `criada_em`, e a empresa cujo `fim` é igual ou anterior ao `criada_em` não é devolvida, porque
nunca recebeu dado da escola. Com ligação (`lista`) nada muda.

**O incidente de segurança (F3, tarefa 9.0).** `Incidente` é o que as escolas afetadas dividem — quando a Turmma soube e quem da
equipe registrou — e **não tem `escolaId`**. Só o `ops:incidente registrar` o escreve, pelo `OperacaoPrivacidadeRepository`, com
uma seção por escola. `IncidenteEscola` é a seção de cada uma: os números e os textos **dela**, a categoria de dado alcançada
(lista fechada do mapa de dados), o risco, a contenção, a correção e a confirmação de quem, da coordenação, recebeu o aviso. Tem
`escolaId` e é escrita no contexto da escola, aberto antes; a escola lê e confirma pelo `IncidenteDaEscolaRepository`, que começa
toda consulta por ela. O `id` que a escola vê e confirma é o da **seção**, nunca o do incidente: o do incidente é dividido, e
mostrá-lo diria a uma escola que outra foi alcançada. O registro **não guarda dado de titular**: nem nome, nem matrícula, nem
conversa; só um número estimado. O comando recusa texto que cite o nome ou o id de outra escola afetada do mesmo registro.
`confirmadoPor` é a pessoa da coordenação (FK composta com a escola, `on delete set null`): a eliminação dela deixa a data e a
seção. A confirmação é `update … where confirmado_em is null`: a primeira fica, e a segunda responde igual, sem gravar de novo.
Retenção: 5 anos do `registradoEm` (Resolução CD/ANPD 15/2024, art. 10), pelo `sistema.expurgar-acesso`, que apaga o incidente e
leva as seções em cascata. A auditoria (`incidente.registrado`, pela operação, e `incidente.confirmado`, pela coordenação) é da
escola, com a seção por id e a finalidade fixa, e leva só o risco e o número estimado.
O encerrado **fica**, como histórico: a escola precisa dizer ao titular por onde o dado passou, mesmo depois de a empresa sair, e a
chave encerrada pode ser cadastrada de novo. A `chave` tem o formato do `IA_PROVEDOR_ID`
(tarefa 7.0), que é como o compartilhamento do titular casa uma chamada com o suboperador; o `contrato` é um código de
referência, nunca texto, e não sai para a escola. Nenhuma pessoa da escola: as duas tabelas são `sem_pessoa` na classificação.
A auditoria (`suboperador.cadastrado` e `suboperador.encerrado`) é **sem escola**, porque o ato é da operação e a empresa pode
atender toda escola: o check `auditoria_escola_ou_operacao_global` aceita sem escola, além da rede criada, a entidade
`suboperador`, sempre com `autor_operador`; ela leva só o alcance e contagens, porque a auditoria não aceita texto livre
(a chave, o nome e o contrato ficam na tabela, pelo id).

**A leitura da operação (F3, tarefa 19.0).** O `ops:privacidade --escola <id>` mostra à equipe, para uma escola, só **contagens**:
os pedidos do titular por estado (`recebido`, `em_preparacao`, `pronto`, `agendado`, `concluido`, `cancelado`), as eliminações
agendadas e quantas já venceram, os arquivos ativos e os vencidos que a rotina ainda não apagou, os suboperadores vigentes
para a escola, os incidentes avisados e os sem confirmação, e, do expurgo, quantas categorias terminaram na última execução,
quantas pararam e quando foi a mais recente. Não há nome, id de titular, texto de pedido nem chave de objeto na saída, e o
erro não repete o que o operador digitou. Abre o contexto da escola do pedido, na mesma transação que confere o `OPERADOR`, e
lê pelo `ContagensDePrivacidadeRepository` (`pedido_titular`, `arquivo_titular` e `expurgo_execucao`, cada leitura com o
`escola_id` do contexto, nenhuma coluna de pessoa) e pelos leitores que a escola já usa, `SuboperadorDaEscolaRepository` e
`IncidenteDaEscolaRepository`, que ele só conta: **nenhum `@Unscoped` novo**, e as quatro tabelas da operação continuam
com dono único no teste de arquitetura. Escola que não existe responde `NAO_ENCONTRADO`, igual a qualquer outra.

**O expurgo noturno da escola (F3, tarefa 3.0).** À 1h, a rotina do sistema `sistema.expurgar-dado-pessoal` lista as
escolas pela `CronEscolasRepository` (em `packages/nucleo/src/rotina`), a **única consulta sem escopo do expurgo**:
`listarIds`, `@Unscoped` com a justificativa da rotina, devolve só os ids. Ela não é de retenção: é a infraestrutura de
que a rotina, sem escola, precisa para abrir o contexto de cada escola, e o teste de arquitetura confere que só o
worker-lote a usa (a rotina e a medição do alerta). No contexto de cada escola, a rotina grava um
`retencao.expurgar-escola` na fila de lote, não urgente, pelo `JobOutbox.enfileirarUmaVez`, com a **chave de
idempotência** "data local da noite" no fuso da escola: `JobRegistro.chaveIdempotencia`, única por escola e tipo entre os
jobs não finalizados (índice parcial), e só em job de escola (check). O job da escola roda com a escola do
`job_registro`, e o `ExpurgoDaEscolaRepository` tira o escopo do contexto, sem nenhum `@Unscoped`: apaga a conversa do
Tutor, os sinais e a conversa do professor vencidos (a thread vazia e criada antes do corte sai depois), em lotes de
5.000 pelo índice `(escola_id, <data>)`, confere a janela letiva antes de cada lote e grava uma linha de
`ExpurgoExecucao` por categoria percorrida, mesmo com zero: `concluida` é `true` quando a categoria terminou e `false`
quando a janela abriu no meio; a noite seguinte começa pela categoria pendente. `ExpurgoExecucao` guarda só a categoria e
a contagem, sem pessoa, por 5 anos (o próprio expurgo apaga as linhas com mais que isso, no fim da noite, tarefa 5.0), e é dela
que o worker-lote mede as noites do alerta.

**As categorias que mantêm a linha e anulam a pessoa (F3, tarefa 4.0).** No mesmo job, depois das três que apagam, o
`ExpurgoDaEscolaRepository` anonimiza, cada uma pelo seu índice parcial da migration 0026 (só as linhas que ainda têm
pessoa, então reexecutar não relê nada): `ExecucaoAgente` (`entrada` só com a tarefa, `solicitadaPor` nulo e
`anonimizadaEm`; o estado, o resultado, o erro e as FKs de quem aponta para ela ficam), `ConsumoIa.entrada` e `saida`
(`texto_do_modelo`), `ConsumoIa.aluno` e a execução do Tutor a que ele aponta (`consumo_por_aluno`) e
`Artefato.criadoPor` do ano letivo **encerrado** (`autoria_de_artefato`, contada do `fim` do ano, no dia do fuso da
escola). O prazo efetivo vem das travas: o tema e o texto do modelo não passam da conversa do professor, e o aluno do
consumo não passa da conversa do Tutor. Os lotes travam com `for no key update skip locked`: a FK de quem aponta para a
linha não segura o lote, e o lote não segura quem grava a mensagem nova. Uma execução ainda aberta (`pendente` ou
`rodando`) e vencida também é anonimizada e não volta a rodar: a varredura do executor a encerra como `falhou`, e a
releitura da entrada pela chave dá `NAO_ENCONTRADO`, porque `solicitadaPor` ficou nulo.

**O trabalho do aluno e o cadastro (F3, tarefa 5.0).** No fim da ordem do catálogo o mesmo job apaga, cada um pelo seu índice
parcial da migration 0027: a `TentativaAtividade` do ano letivo **encerrado** (a `RespostaAtividade` e a `Correcao` saem em
cascata; o ano `em_curso` ou `planejado` nunca perde nada, e a atividade aplicada e o lote de correção, que são registro de
decisão, ficam sem o aluno), a `Reivindicacao` que não está `pendente` (contada da decisão, e da solicitação no `encerrada`,
que a virada do ano fecha sem decisão), o `Material` excluído (só o que nenhuma `MensagemTutor` nem `SinalTutor` ainda cita:
as duas FKs não têm ação) e o `Vinculo` encerrado. A **pessoa desativada** além do prazo é eliminada pelo
`CicloDeVidaService.eliminar`, numa transação por pessoa (a que o repositório do expurgo abre, trava e reconfere o prazo, e que o `eliminar` reutiliza) e em lotes de até 100, com a auditoria `usuario.eliminado` assinada
pelo apelido `rotina` (`AUTOR_DA_ROTINA`): credencial, vínculos, conta externa, sessões e a linha da lista saem com ela, e
a conta global só cai se não serve a escola nenhuma. A pessoa que sumiu entre a escolha do lote e a trava (eliminada por
outro job) ou que voltou a ser ativa (convite aceito) é pulada sem erro, sem auditoria e fora da contagem. Os índices por `(escola_id, material_id)` em `MensagemTutor` e `SinalTutor` e por
`(escola_id, aluno_id)` em `TentativaAtividade` servem à conferência das FKs de `Material` e de `Usuario`, e os de `(escola_id, solicitada_por)` em `ExecucaoAgente` e `(escola_id, criado_por)` em `Artefato`, à do `set null` da pessoa eliminada.

`Evento` é o motor: nota aprovada, tarefa não entregue, aluno travado. A `Notificacao` é
uma leitura dele. Isso permite construir o motor agora e ligar o canal da família depois
sem refazer nada.

## Indicadores de desempenho

```
IndicadorProfessor → escola*, anoLetivo*, professor*, periodo*, tipo*, valor*, calculadoEm*
IndicadorTurma     → escola*, anoLetivo*, turma*, disciplina*, habilidade?, periodo*, tipo*,
                     valor*, calculadoEm*
```

Os tipos concretos, os limiares e o texto dos alertas estão em aberto (`CLAUDE.md`, decisões em
aberto): os de turma e aluno fecham antes do PRD do F6, porque "Turmas" nasce lá (D69, D73);
os de professor, antes do PRD do F12. A coordenação só lê agregado de recorte com dois ou mais
professores (D45 revista). Tempo ocioso do aluno não é tipo de indicador. `IndicadorProfessor` é lido pelo próprio professor; a
coordenação lê agregado e o nominal com `Auditoria`; a rede só agregado; nenhum caminho o
liga a decisão sobre o professor (D45, regra 70 item 8). Os dois estão no mapa de dados de
`docs/lgpd.md`.

## Regras transversais

1. Toda tabela de domínio tem `escolaId`. As que variam por período têm `anoLetivoId`. As
   exceções são curtas e fixas, e esta lista é conferida contra as migrations por teste de
   arquitetura (`apps/api/test/arquitetura.test.ts`):
   - o próprio tenant: `Escola` e a `Rede` acima dela — ver "Estrutura institucional";
   - tabela pública sem dono (habilidades da BNCC, banco de questões público);
   - a identidade de login (`Conta`, `CodigoRecuperacao`), que é global por desenho e só é
     alcançada pelo módulo `sessao` e pelo `nucleo/ciclo-de-vida` (a `ContaGlobalRepository`),
     além da limpeza noturna do expurgo de acesso — ver "Pessoas e vínculos";
   - as tabelas da operação Turmma (`Operador`, `CodigoRecuperacaoOperador`, `ConviteOperador`,
     `SessaoOperador`, `AcessoOperacao`, `AuditoriaOperacao`), da nossa equipe e não de escola,
     só alcançadas pelo `OperadorRepository` e pelo expurgo — ver "Operação Turmma";
   - o `Suboperador` (F3), a empresa que recebe dado da escola, da nossa operação: atende toda escola ou só as listadas em
     `SuboperadorEscola` (esta tem `escolaId`), e só o `OperacaoPrivacidadeRepository` escreve e o
     `SuboperadorDaEscolaRepository` lê — ver "Comunicação, conta e conformidade";
   - o `Incidente` (F3), o que as escolas afetadas por um incidente de segurança dividem, da nossa operação: só o
     `OperacaoPrivacidadeRepository` escreve, o `IncidenteDaEscolaRepository` lê pela `IncidenteEscola` (esta tem `escolaId`) e
     o expurgo de acesso apaga por prazo — ver "Comunicação, conta e conformidade".
   A lista de escolas da rotina noturna (`CronEscolasRepository.listarIds`, F3) não é tabela sem escola: é a
   consulta sem escopo que abre o contexto de cada escola — ver "Comunicação, conta e conformidade".
2. Id é UUID. Nunca sequencial.
3. Nada é apagado de verdade: exclusão é lógica, com data e autor — exceto em pedido de
   eliminação do titular, que apaga de fato e propaga para backup na próxima rotação, e no nome
   livre da lista de nomes, pré-cadastro sem conta nem histórico, que sai de fato com a autoria na
   auditoria (A1, Tech Spec da A1, seção 7).
4. `Auditoria` registra toda escrita que afeta nota, vínculo ou permissão, **e toda leitura
   de dado de aluno por coordenador ou rede**, e toda exportação.
5. Aluno não tem e-mail nem telefone. Contato é do responsável.
6. Todo campo pessoal precisa estar na tabela de dados de `docs/lgpd.md`, com finalidade e
   retenção. Campo fora da tabela não entra em migration.
7. DTO de saída explícito. Nunca serialize a entidade inteira.
8. Seed de desenvolvimento e de demonstração é **sempre sintético**. Dump de produção em
   máquina de desenvolvimento é proibido.
