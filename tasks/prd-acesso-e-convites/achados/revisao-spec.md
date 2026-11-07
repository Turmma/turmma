# Achados das revisões — `tasks/prd-acesso-e-convites/revisao-spec.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · AJUSTES NECESSÁRIOS · 2026-11-07 10:39:12 · `tasks/prd-acesso-e-convites/revisao-spec.md`

VEREDITO: AJUSTES NECESSÁRIOS

Tela vista: não. É revisão de spec, sem código nem fotos. Li `prd.md`, `techspec.md` (seções 4, 5, 9, 10 e 13), `cenarios.md` e as partes de `docs/interface.md` que tocam o assunto: Convidar alunos (linha 369), Professores (linha 550), seção 6 (linha 685) e login (linha 1939).

A seção 9 tem quatro frases. O que as telas devem dizer e o que cada estado mostra fica quase todo implícito. Só duas telas têm descrição de estado em `cenarios.md`: a troca da provisória e o diálogo "Enviar convites".

**Estados: faltando**
- A Tech Spec §9 não nomeia carregando, vazio, erro e com dado de nenhuma tela nova. Só a troca da provisória tem estado descrito, em `cenarios.md` ("Senha provisória", [E]): primeira vez sem tabela vazia, aviso com "Tentar de novo", bilhete vencido.
- Ficam sem desenho:
  - **Esqueci:** a resposta é igual exista a conta ou não (RF12), então o texto não pode confirmar nada. Falta dizer o que o aluno vê se vier parar ali (§4 e RF12 só falam da equipe).
  - **Redefinir e verificar:** link vencido, já usado ou inválido. Falta o texto com a saída ("peça outro link").
  - **Redefinir:** senha fraca ou recusada.
  - **Conta da escola na sala:** domínio não liberado, cookie de 15 min vencido, conta ligada a outro (`CONFLITO` sem dizer a quem) e pedido pendente de aprovação. Cada um precisa de texto com próximo passo.
  - **"Eu":** carregando e erro ao ligar a conta.
  - **Estado do envio em Professores:** o rótulo de cada estado, em português. O PRD lista três (na fila, enviado, falhou), mas a coluna `envio` tem cinco valores. `enviando` e `cancelado` não têm rótulo definido.
  - **Mesma lista:** como "falhou" diz o que fazer (PRD §7: "corrigir e reenviar, ou copiar o link").
- Os códigos `SEM_SENHA` e `VERIFICACAO_PENDENTE` (§2) precisam virar frase em português com ação. `VERIFICACAO_PENDENTE` hoje não diz ao usuário que ele deve abrir o e-mail e voltar. O item 7 da lista (termo técnico vazando) fica sem garantia.

**Acessibilidade: implícita**
- O axe do e2e está em §10. Isso cobre contraste e rótulo, mas não o que a spec precisa decidir:
  - **Campos de senha:** rótulo, `autocomplete="new-password"` e "mostrar senha". Em Chromebook e celular a digitação às cegas é fonte de erro. A troca da provisória também precisa de confirmação da nova senha, ou do "mostrar".
  - **Estado do envio:** `aria-live` para a mudança de estado. O Convidar alunos já usa esse padrão em `docs/interface.md`.
  - **Foco:** para onde vai o foco ao falhar o "Tentar de novo" e ao abrir o aviso de bilhete vencido.
  - **Senha provisória:** "dois grupos" é decisão visual. Precisa de leitura por leitor de tela, e o tamanho de projeção deve ser como o do código da turma.

**Chromebook fraco: implícito**
- "Professores" mostra o `envio` de até 300 linhas (a planilha do F2). Falta dizer:
  - se a lista é virtualizada;
  - como o estado atualiza (polling?), com que intervalo e quanto custa por linha. Só `aria-live` e a leitura "sem prender a tela" aparecem, e nenhum cenário prova isso na lista longa.
- As telas anônimas (esqueci, redefinir, verificar) devem carregar separadas da casca, sem a área de papel.
- Não há foto de imagem nesta spec. O item de compressão não se aplica.

**Celular: parcial**
- Há uma frase de e2e (§10, e `cenarios.md` "E2E"): 360 px sem rolagem horizontal, alvo de 44 px nas ações principais e 24 px no resto. Mas ela está presa a "conta da escola em Eu".
- Os outros e2e ficam só no genérico "chromebook e celular, com axe". Faltam, a 360 px:
  - a provisória mostrada uma vez, a que se dita em sala;
  - o estado do envio em Professores;
  - o diálogo de confirmação;
  - o redefinir.
- A spec não diz se "Gerar senha provisória" no celular é folha de baixo ou diálogo (o padrão está em `docs/interface.md`, linhas 289 e 422). Nada depende de hover ou atalho, o que está correto.
- Nenhum fluxo exige o celular: ok. O link da sala e o código funcionam no computador da escola.

**Ação oficial protegida: parcial (sim para a provisória, não para os convites)**
- **Gerar provisória:** a spec confirma "nome e turma" antes. Falta dizer a consequência, pois o gesto apaga a senha atual do aluno, derruba as sessões e a nova senha não reaparece (§5). A confirmação deve dizer isso. Pelo padrão do Convidar alunos (linha 375), "Fechar" sem ter copiado deve perguntar antes. Na geração para quem tem conta da escola, o e2e prova a mensagem `SEM_SENHA`.
- **Enviar convites:** o diálogo avisa que os links anteriores caducam, e `cenarios.md` prova isso. Falta mostrar quantos e quais professores recebem (o botão tem seleção ou "sem aceite"), porque o e-mail sai e não volta.
- **"Copiar link":** faz o `convite/refazer`, e isso invalida o link do e-mail já enviado (§4). A §9 só põe o aviso em "Enviar". O mesmo aviso é necessário em "Copiar link" e "Reenviar".

**Bloqueantes**
1. Tech Spec §9 e `cenarios.md`: os quatro estados e o texto de erro com próximo passo não estão definidos para esqueci, redefinir, verificar, conta da escola (sala e Eu) e o estado do envio. A lista é a do bloco "Estados". Correção exigida: acrescentar à §9 uma tabela com as 8 telas, cada uma com carregando, vazio ou inicial, erro e com dado. Incluir a frase de cada recusa (token vencido ou usado, domínio, `CONFLITO`, `SEM_SENHA`, `VERIFICACAO_PENDENTE`, bilhete de 10 min) e o rótulo em português dos cinco estados do envio. E um cenário [E] por tela para os estados que não aparecem na foto (carregando e erro).
2. Tech Spec §9: o desenho da provisória não cobre a ação destrutiva. Correção exigida: a confirmação cita nome, turma e a consequência (senha atual deixa de valer, sessões caem, a nova aparece uma vez). Dizer onde o botão mora para professor e coordenação (a aba Alunos da turma? a lista da coordenação?). A senha aparece uma vez, grande, com "Copiar" e pergunta ao fechar sem copiar, como o Convidar alunos. Um [E] prova a confirmação antes da geração.
3. Tech Spec §9 e `cenarios.md` "E2E": "Copiar link" e "Reenviar" não avisam que invalidam o link já enviado, e o diálogo "Enviar" não mostra a contagem. Correção exigida: o aviso nas três ações, a contagem de destinatários no diálogo de "Enviar", e um [E] para cada (hoje só o do "Enviar").
4. Tech Spec §9: o estado do envio em Professores não diz como atualiza nem se a lista é virtualizada com 300 linhas. Correção exigida: virtualização, polling com intervalo e parada quando a aba some ou nenhuma linha está em `na_fila` ou `enviando`, `aria-live="polite"`. Teste de Chromebook (CPU e rede com throttling) com 300 linhas.
5. `cenarios.md` "E2E": o 360 px sem rolagem horizontal e os alvos de toque só estão provados para "Eu". Correção exigida: estender a cláusula para todas as telas novas, ou citar explicitamente cada uma (esqueci, redefinir, verificar, trocar a provisória, conta na sala, Professores, gerar provisória).

**Recomendações**
- `docs/interface.md` (linha 1939) descreve o login do aluno. A seção 9 deve dizer onde fica o link "Esqueci minha senha" na entrada da equipe e onde a troca da provisória entra na sequência do login (`etapa: 'trocar_senha'`). A atualização do `docs/interface.md` deve vir antes das tarefas de tela, não depois.
- Esqueci com aluno: uma linha na tela ("aluno: peça a senha provisória ao professor") sem revelar se a conta existe, nem como é o login do aluno.
- Troca da provisória: o campo da senha nova sem regra visível é fonte de erro. Mostrar a regra (tamanho mínimo) antes do envio.
- O alerta de `falhou` acima de 20% (§7c) vai para o runbook, mas a coordenação não vê o motivo. "Falhou" na lista só diz que o servidor de e-mail recusou. A tela deve evitar sugerir que o professor errou.
- Datas na troca da provisória já estão em português ("12/11/2026 às 14:05"). Padronizar o mesmo formato no estado do envio ("enviado em …").

Arquivos revisados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/techspec.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/cenarios.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/prd.md`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/docs/interface.md`

## test-engineer · 1ª rodada · REPROVADO · 2026-11-07 10:41:29 · `tasks/prd-acesso-e-convites/revisao-spec.md`

VEREDITO: REPROVADO

**Sobre o `desativar` com o convite em envio, que o Arquiteto deixou para eu julgar.** Conferi no código do F2. O `desativar` recusa qualquer inativo que não esteja esperando a primeira entrada (`ciclo-de-vida.service.ts:207`), e o professor pendente é recusado ali. O `refazer` só age sobre `pendente` e `vencido` (`REFAZER_CONVITE_DE_PROFESSOR_POR_ESTADO`), e todos os outros estados dão conflito. Então nenhuma rota deixa um convite aberto, com envio em andamento, num usuário que o `desativar` alcance. A cláusula `revogarConviteAberto` (`ciclo-de-vida.repository.ts:131`) só roda sobre um estado que nenhuma rota cria.

Por isso os dois cenários ("[P] `desativar` com o envio do convite `enviando`" e "[I] `desativar` cancela o envio na fila") só se montam com dado inserido direto no banco: um usuário ativo com um convite aberto e o envio `na_fila` ou `enviando`. Montados assim, provam uma coisa só: a cláusula de defesa passa a gravar `cancelado` e anular os cifrados, e o teste falha se isso for tirado dela. Montados do jeito que se leem, com o professor pendente que é quem de fato tem convite em envio, o `desativar` responde `NAO_ENCONTRADO` antes de chegar à cláusula. O teste fica vermelho pelo motivo errado. O [P] também não acrescenta nada ao [P] da revogação: o `enviado` do job não casa pelo mesmo mecanismo.

**Cenários exigidos:**
- RF11 a RF14, RF16, RF17, RF18.
- Os quatro casos de borda do PRD §7.
- Corridas: dois "Enviar", job duas vezes, revogação ou link novo durante o envio, dois aceites, dois "esqueci", dois "redefinir", duas trocas, a mesma conta em dois pedidos, clique duplo em aprovar, ligar a mesma conta duas vezes, gerar a provisória duas vezes.
- Toda rota nova na escola sem ano letivo em curso.
- Toda rota que lê vínculo, com um vínculo encerrado e outro aberto.
- Isolamento entre escolas em cada rota e em cada job.
- Uma linha de auditoria por ação.

**Cobertos:**
- **RF11:** corpo sem nome, exclusão de quem aceitou, revogação na fila e durante o envio, SMTP 5xx e 4xx, reserva, `EMAIL_POR_MINUTO`, expurgo de 24 h, dois "Enviar" em paralelo, escola do job vem do registro.
- **Posse do e-mail:** coberta inteira.
- **RF12:** coberto inteiro, com o piso provado por relógio falso.
- **RF13:** permissão, aluno transferido (vínculo encerrado e aberto), `SEM_SENHA`, bilhete, `/trocas`, expurgo, duas trocas em paralelo, cotas.
- **RF14:** cookie, check novo no banco, virada do ano e transferência, conta em dois pedidos, aprovar e ligar em paralelo.
- **RF16:** escola A contra B, professor da planilha e da grade.
- **RF18:** e2e em `chromebook` e `celular`, com axe.
- **Casos de borda do PRD §7:** os quatro têm cenário.
- **IA:** não há, e os adaptadores falsos (`EnvioDeEmail` falso, `oidc-falso`) são os certos.

**Bloqueantes:**

1. **Cenários do `desativar` que não chegam à cláusula** (cenarios.md, RF11, as duas linhas citadas acima; Tech Spec §2 "`ciclo-de-vida/`" e §5 "A revogação, o `desativar` e o link novo gravam `cancelado`"). Correções exigidas:
   - Reescrever os dois como um [I] só, com o dado declarado: "usuário ativo com convite aberto inserido direto no banco (a defesa do F2), envio `na_fila` e `enviando`: o `desativar` grava `cancelado`, anula os cifrados e zero envios".
   - Acrescentar o caminho real: "professor pendente com envio `na_fila`: o `desativar` responde `NAO_ENCONTRADO` e o envio não muda".
   - Corrigir a Tech Spec §2 e §5 para "a cláusula de defesa do `desativar` (`revogarConviteAberto`)".

2. **RF11 "aos selecionados" e "40 convites num clique" sem cenário** (PRD RF11, Tech Spec §4, `convites/enviar`). O único cenário com `usuarioIds` é o de isolamento. Exigir um [I] "Enviar com seleção":
   - a seleção mistura pendente, vencido, revogado, aceito, ativo e desativado;
   - só pendente e vencido entram na fila, e a contagem diz quantos;
   - nunca 409 pelo lote.

   Exigir também um [I] com 40 pendentes: 40 na fila, e a resposta volta com o SMTP falso preso numa barreira. É isso que prova "o envio não prende a tela". O cenário deve dizer ainda se "sem aceite" inclui o vencido.

3. **"O link novo grava `cancelado`" sem cenário no convite** (Tech Spec §5 e §4: "Copiar link" faz o `convite/refazer`). Só o dois-"Enviar" em paralelo passa por esse caminho. Exigir um [I]: "'Copiar link' com o envio do convite `na_fila`: o envio antigo termina `cancelado`, com os cifrados nulos, e zero envios". Sem ele, cancelar só no caminho do "Enviar" passa verde.

4. **Autor e escola indefinidos na auditoria** (cenarios.md, tabela "Auditoria"; Tech Spec §7 "Auditoria"). O schema exige `escola_id`, ou operador com entidade `rede` ou `suboperador`, e um único autor que seja usuário da escola (`packages/core/src/db/schema/auditoria.ts:55-64`). Três ações não cabem nisso como estão:
   - `convite.enviado` é gravado pelo job, que não tem pessoa; o autor `rotina` é barrado pelo check.
   - `senha.redefinida` e `conta.email_verificado` vêm de rotas anônimas sobre a conta global.

   Assim, "um registro por ação, com autor e data" não tem resposta certa. Exigido:
   - **`convite.enviado`:** definir o autor (por exemplo, o coordenador que clicou, levado no `job_registro` e nunca no payload) ou passar o registro para o enfileiramento.
   - **`senha.redefinida` e `conta.email_verificado`:** dizer em qual escola cada uma grava quando a conta tem usuário em duas, e quem é o autor.
   - **Cenário:** acrescentar um com conta de duas escolas.

5. **Aprovar pedido cuja conta já foi ligada a outro aluno, sem cenário** (Tech Spec §5 "Conta da escola do aluno"). O caso: o único parcial vale só entre pedidos pendentes, e enquanto o pedido espera, outro aluno liga a mesma conta em "Eu". O aprovar então cria o usuário sem senha e esbarra na `conta_externa` única. Se não desfizer tudo, deixa um aluno sem nenhuma credencial. Exigir um [I]: "aprovar com a conta já ligada a outro: `CONFLITO` sem nome, nenhum usuário criado, pedido segue pendente". Exigir também a linha correspondente na tabela "Corridas".

6. **Dois "gerar provisória" ao mesmo tempo, sem trava nem [P]** (Tech Spec §5 "Senha provisória"; tabela "Corridas"). É o clique duplo em sala: duas senhas aparecem, e só uma vale. Exigido:
   - declarar a trava, com a linha da credencial travada;
   - um [P]: "duas gerações em paralelo: exatamente uma senha entra, e é a da última `.gerada` na auditoria; nunca 500; as duas contam na cota".

7. **Escola sem ano em curso sem resultado esperado** (cenarios.md, RF16, "provisória e login seguem o ano em curso"). Do jeito que está, o teste não tem o que afirmar. Exigido: o resultado por rota.
   - `senha-provisoria`: o que a coordenação recebe, e o professor recebe 404.
   - Login com a provisória, `/trocas`, `trocar-senha`.
   - `intencao=ligar`.

8. **"A provisória confirma nome e turma antes de gerar" sem cenário** (Tech Spec §9). É a defesa contra dois alunos com o mesmo nome. Exigir um [E]: dois homônimos em turmas diferentes, o diálogo mostra a turma, e cancelar não gera nada (sem auditoria, e a senha anterior continua valendo).

9. **RF14 "Antes da aprovação, recusada" sem a metade "antes"** (PRD RF14, "Como se prova"). Exigir um [I]: "com o pedido pendente, o login pela conta da escola é recusado como credencial inválida". Exigir também: "o aluno que já tem conta ligada tenta ligar outra em 'Eu': recusado" (uma conta por aluno).

**Recomendações:**
- "[P] Dois aceites que precisam de verificação" deveria afirmar também que fica um link aberto e quantos envios saem, além do "nunca 500".
- O job do convite poderia conferir na reserva se o convite ainda está aberto. Hoje, se o job morre depois de enviar e o professor aceita antes da retomada, sai um segundo e-mail com o link já usado. Se o `aceito` for desativado em seguida, a cláusula de defesa não pega esse convite (já está usado), e o e-mail vai para quem a escola tirou. Sugiro um cenário para isso, ou o aceite anulando os cifrados.
- O balde `rl:ip:senha` (100/h) é só por IP. Na rede da escola, uma pessoa pode esgotá-lo, e o "esqueci" do resto da equipe vira 202 sem envio, em silêncio. Vale o `infra-guardian` olhar à luz da regra 80, item 1.
- Falta dizer o que acontece com 300 convites por hora numa escola com mais de 300 pendentes num clique só: 429 no lote inteiro ou envio parcial.
- Um cenário de matrícula repetida em duas escolas: a provisória da escola A não abre a matrícula igual da escola B.

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/revisao-spec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/packages/core/src/ciclo-de-vida/ciclo-de-vida.repository.ts
[… 2 linhas cortadas]

## privacy-guardian · 1ª rodada · REPROVADO · 2026-11-07 10:41:42 · `tasks/prd-acesso-e-convites/revisao-spec.md`

VEREDITO: REPROVADO

**Campos pessoais tocados:** `link_da_conta` (hash do token, token e endereço cifrados, envio), `convite.canal`, `envio`, `enviadoEm` e os cifrados, `conta.emailVerificadoEm`, `credencial_matricula.provisoria*` (hash, validade, quem gerou), `reivindicacao.contaExterna`, o cookie `educa_conta_provada`, o e-mail e o texto que vão ao provedor de e-mail, o bilhete da troca (cifrado, 10 min) e os contadores novos de limite (seção "Limites" do `cenarios.md`).

**Fora da tabela de dados do docs/lgpd.md:** os contadores novos. Faltam o balde `rl:ip:senha` (100/h), o contador de 3/h pelo hash do e-mail, o de 3/h por conta no verificar e os da provisória (60/h por usuário e 5/dia por aluno). Os campos de banco e o cookie estão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/docs/lgpd.md:77-83`. A §8 do PRD ainda diz "não" para a linha do provedor de e-mail, que já existe em `docs/lgpd.md:78`.

**Autorização por objeto:** ok no desenho.
- Provisória: 404 igual para quem está fora do escopo (pendente, contestado, encerrado, outra turma, outra escola, turma antiga do transferido). O `SEM_SENHA` só aparece para quem tem escopo.
- `convites/enviar` com id de outra escola responde como inexistente.
- `ligar` exige sessão de aluno.
- `/trocas` não alcança outro aluno e recusa o bilhete na query.
- `CONFLITO` não diz nome nem id.
- O "esqueci" responde 202 igual, com piso de tempo.
- O `VERIFICACAO_PENDENTE` revela que existe conta para aquele e-mail. É risco aceito e escrito (§13): só quem tem o link copiado vê, e o titular é adulto.

**Logs:** limpos no desenho. A §7 diz "ids e código; nunca e-mail, token nem resposta do SMTP". O `nodemailer` fica sem logger nem debug, e há cenário para o log do worker. O job leva só ids e lê o resto pela linha (§5), então o Redis não recebe e-mail nem token.

**Auditoria:** presente na lista do RF17, mas indefinida (e não gravável como está) em `senha.redefinida`, em `conta.email_verificado` quando vem do verificar ou do redefinir, e em `convite.enviado` gravado pelo job. Detalhe no bloqueante 3.

**Envio externo:** vão ao provedor de e-mail o endereço e o texto de professor e coordenador (a escola e o link), nunca dado de aluno, com teste do corpo. Fica registrado no estado `envio` e em `convite.enviado`. O "para onde" sai do cadastro de suboperador por período, pelo `Compartilhamento` (`packages/core/src/titular/compartilhamento.ts:76-88`), que é sempre por período para o professor.

Sobre o provedor de produção, o tratamento está correto como premissa com portão:
- Mailpit só no compose local (`infra/compose.yml` é o ambiente local).
- O provedor fica em §12, com dono e prazo em `docs/decisoes-em-aberto.md:13`.
- O suboperador entra antes da primeira escola real, conforme `docs/lgpd.md:78`.

O que falta é uma trava de configuração parecida com a da IA (recomendação 1). Não há IA no caminho, então `ExecucaoAgente` não se aplica.

**Seed/fixture:** sintético. O e2e usa Mailpit e `oidc-falso`, e nada no desenho pede dado real.

**Bloqueantes:**

1. **§5 "Senha provisória" e §7 "Retenção e eliminação"; `cenarios.md`, "Auditoria e dado".** A D85 (`docs/decisoes.md:1637-1638`, de 06/11, posterior à aprovação desta Tech Spec) põe nesta spec a leitura "por alvo" do arquivo do titular. Ela traz as duas ações da provisória **e também as quatro do F2**: `aluno.transferido`, `lista.transferida`, `usuario.nome_corrigido` e `lista.nome_corrigido`. A `docs/lgpd.md:120` confirma: "a implementar na F2c". A Tech Spec e os cenários só cobrem `senha_provisoria.gerada` e `.usada`. Sem as quatro, o arquivo do aluno mostra o estado final e não o tratamento que levou até ali, e a pergunta de fechamento fica sem resposta para transferência e correção de nome.
   - **Correção exigida:** listar as seis ações na §5 e na §7, cada uma com o caminho até o titular, só com o papel de quem fez, sem id, sem `antes` nem `depois`, e sem as leituras.
   - **Teste exigido:** um cenário [I] por ação. Cada um prova que a ação aparece no arquivo do alvo, que não aparece no de outro aluno e que não traz o autor.

2. **§7c "Limites e corridas"; `cenarios.md`, "Limites".** O desenho cria dados de segurança novos e nenhum está no mapa de dados:
   - o `rl:ip:senha`, que guarda o IP numa janela de 1 h. Isso contradiz a `docs/lgpd.md:172-190`, que promete IP só por um minuto e lista balde por balde;
   - o contador de 3/h pelo hash do e-mail digitado, que alcança e-mail de quem nem tem conta;
   - o de 3/h por conta no verificar;
   - os da provisória, de 60/h por usuário e 5/dia por aluno (este último chaveado pelo id do aluno).

   A regra 20, item 1, exige que o dado entre no mapa na mesma tarefa.
   - **Correção exigida:** pôr cada contador na `docs/lgpd.md`, com a chave (HMAC de quê), a finalidade, a base, a janela ou retenção e "ninguém lê à mão". Também é preciso corrigir o parágrafo "IP só em memória", ou trocar o `rl:ip:senha` por uma janela de um minuto.

3. **§7 "Auditoria", que remete à tabela RF17 do `cenarios.md`.** A tabela não diz qual escola nem qual autor recebem três registros, e o banco recusa os jeitos óbvios de gravar:
   - `senha.redefinida` e `conta.email_verificado` pelo verificar ou pelo redefinir são atos da conta global, que pode ter usuário em várias escolas. O check `auditoria_escola_ou_operacao_global` (`packages/core/src/db/schema/auditoria.ts:55`) proíbe escola nula fora da operação.
   - `convite.enviado` é gravado pelo job, que não tem pessoa. O `auditoria_um_autor` exige autor, e o `auditoria_rotina_so_nas_acoes` (`:62-65`) não deixa a `rotina` assinar.

   Como está, o implementador ou esbarra no banco ou escolhe uma escola e um autor arbitrários, e "um registro por ação" fica ambíguo.
   - **Correção exigida:** definir na §7, por exemplo, um registro por escola em que a conta tem usuário ativo, na mesma transação, com autor e `entidadeId` igual ao usuário daquela escola.
   - Para `convite.enviado`: autor igual ao `criadoPor` do convite refeito, ou gravar o pedido de envio na requisição (o `convite.refeito` já existe) e deixar o job só no estado `envio`.
   - O cenário [I] precisa provar a conta com duas escolas e a escola sem usuário ativo.

**Recomendações:**
- **Trava de configuração para o e-mail fora do ambiente local**, como já existe para a IA com `IA_PROVEDOR_ID` (`packages/core/src/config/llm-config.test.ts:126`): exigir `EMAIL_PROVEDOR_ID` em staging e produção, exigir TLS, e recusar a subida com o host do Mailpit ou com o id de exemplo. Isso transforma o "suboperador antes do portão" em código.
- No compose local, ligar a porta da interface do Mailpit só em `127.0.0.1`, como o Postgres. Ela mostra tokens vivos.
- Cadastrar o suboperador de e-mail só com categorias de equipe e sem `alcance = 'todas'`. Senão ele aparece na foto de compartilhamento do aluno, porque a hospedagem entra sempre (`compartilhamento.ts:44-45, 87`). Isso declara a mais, sem vazar nada.
- Escrever na §5 que os links de redefinir e verificar levam o token no fragmento (`#token`), como o convite já faz (`apps/web/src/components/link-do-convite.ts:2`).
- Pôr `Cache-Control: no-store` nas respostas de `senha-provisoria`, `trocar-senha` e `/trocas`.
- Alinhar a §8 do PRD (a linha do provedor de e-mail já está no mapa) e a redação do portão: "da F2c" em `docs/decisoes-em-aberto.md` contra "da primeira escola real" em `docs/lgpd.md:78`.

## tenancy-guardian · 1ª rodada · REPROVADO · 2026-11-07 10:41:57 · `tasks/prd-acesso-e-convites/revisao-spec.md`

VEREDITO: REPROVADO

Tabelas verificadas: `link_da_conta` (global, sem `escolaId`). A exceção está declarada na seção 11 e entra no `docs/modelo-de-dados.md`, e o teste `architecture.test.ts › toda tabela sem escola_id está nas exceções` a cobra. A tabela não varia por período. `convite` (+canal, cifrados, envio), `conta` (+`emailVerificadoEm`, global), `credencial_matricula` (+provisória; tem `escolaId` e FK composta para o usuário da escola), `reivindicacao` (+`contaExterna`; tem `escolaId` e `anoLetivoId`; o único parcial começa por `escolaId`), `conta_externa` (já é única por escola, então o `CONFLITO` não sai da escola).

Queries verificadas: `convites/enviar` (escola do contexto, sem `escolaId` na entrada), `alunos/:usuarioId/senha-provisoria` (coordenação pela escola; professor pelo vínculo confirmado no ano em curso; 404 igual), `email.enviar-convite` (escola do `job_registro`, que o `job-executor.ts:230` põe no contexto), `sistema.enviar-email-da-conta` (`@Unscoped` justificado), `TenantResolutionRepository` para `link_da_conta` (cerca em `sessao/`, que confere), `ContaGlobalRepository.encerrarSessoesDaConta` no redefinir (já existe), cookie `educa_conta_provada` (AES-GCM como o `educa_oidc`, conferido contra a escola e o acesso da sala), `trocar-senha` e `/trocas`, as novas escritas do `retencao.expurgar-escola`.

Teste de isolamento: presente, mas incompleto. Os casos de RF16 que existem são efetivos: `usuarioIds` da escola B, provisória, ligação de conta e id de convite da B num job da A quebrariam sem a cláusula de escopo. Três caminhos com escopo ficam sem teste que quebre (bloqueante 3).

Bloqueantes:

1. **Tech Spec, seções 5 ("E-mail", "Esqueci", "Posse do e-mail") e 6: o job de sistema nasce de uma requisição HTTP, e o código atual recusa isso.**
   - **O que está errado:** `packages/core/src/queue/job-outbox.repository.ts:74-78` recusa job `sistema.*` fora de contexto `rotinaDoSistema`, e esse contexto nenhuma requisição HTTP tem. A recusa também vale com `escolaId` no contexto. Pela spec, `sistema.enviar-email-da-conta` nasce no `/v1/senha/esqueci` (anônimo) e no aceite com `VERIFICACAO_PENDENTE` (contexto de escola). A spec não diz como passar pela recusa. O caminho mais curto, marcar a requisição como `rotinaDoSistema`, daria a uma rota anônima o escopo de toda a fila de sistema (`jobScopeInContext`) e o que mais essa marca libera. Isso é escalada de privilégio.
   - **Correção exigida:** a seção 6 declara o mecanismo. Uma opção é uma lista fechada de tipos que podem nascer sem rotina, só `sistema.enviar-email-da-conta`, sem marcar o contexto da requisição como `rotinaDoSistema`. A outra é a API gravar só `envio = 'na_fila'` e uma rotina do sistema varrer. O `cenarios.md` ganha dois casos: outro `sistema.*` pedido por rota HTTP continua recusado, e a requisição que enfileira o job não alcança job de sistema.

2. **Tech Spec, seção 5 ("Senha provisória") e seção 4 (`trocar-senha`, `/trocas`): o escopo das rotas do bilhete fica implícito.**
   - **O que está errado:** o bilhete leva "o aluno e o hash da provisória", sem a escola. As duas rotas não têm slug nem sessão. O `CredencialMatriculaRepository` e a auditoria (`/trocas` lê o `depois` da `.gerada` por alvo) só têm escopo com a escola no contexto. Sem ela, sobra uma leitura por `usuarioId` sem escopo, que não está entre as exceções da seção 11.
   - **Correção exigida:** a seção 5 diz que o bilhete cifrado leva `escolaId`, e que as duas rotas rodam em `naEscolaSemUsuario({ escolaId do bilhete })`, com a credencial e a auditoria lidas no repository com escopo. A seção 11 continua sem exceção nova.

3. **`cenarios.md`, "Isolamento e ano letivo (RF16)": faltam casos que quebrem sem a cláusula de escopo.**
   - **O que está errado:** os casos do expurgo do envio de convite (mais de 24 h) e da provisória vencida no `retencao.expurgar-escola` não têm a linha de outra escola. Tirada a cláusula de escola das duas novas escritas do expurgo, nenhum cenário quebra. Também não há caso de escopo para `trocar-senha` e `/trocas` entre escolas.
   - **Correção exigida:**
     - Os dois novos alvos do expurgo entram no padrão "a de outra escola, com a mesma idade, fica" (o `it.each(CATEGORIAS_DO_EXPURGO)` de `apps/worker/test/expurgo-da-escola.int.test.ts:589`).
     - Um caso de integração no repository: com o contexto da escola A, a credencial e a auditoria do aluno da B devolvem zero linhas, na troca (`update` com zero linhas: recusa) e em `/trocas`.

Recomendações:
- Seção 6: `cerca-conta-global` não é a regra que cerca o `EnvioRepository`. O `to` dela é o `conta-global.repository.ts`, e o `pathNot` libera `sessao/` e `ciclo-de-vida/`. A spec deveria nomear uma regra nova em `tools/guardas/camadas.cjs` (por exemplo `cerca-envio`), com o arquivo do repository no `to` e só `apps/worker/src/processors/enviar-email.ts` e o expurgo de acesso no `pathNot`. Dito como está, o implementador pode alargar a cerca da conta global para o worker.
- A seção 6 deveria dizer se o expurgo de acesso grava o `falhou` de 24 h do `link_da_conta` pelo `EnvioRepository` ou pelo `ExpurgoDeAcessoRepository`, que já existe e tem `@Unscoped`. A zona da cerca depende disso.
- Seção 3: declarar `id uuid default uuidv7()` em `link_da_conta`. O id não sai do servidor, mas a regra 10, item 7, deve estar escrita.
- Seção 5 ("Conta da escola do aluno"): escrever que o `iniciar` com `intencao=reivindicar` resolve o acesso pelo token ou código da sala, pela `TenantResolutionRepository`, na escola do slug e no ano em curso, e nunca por um id na query.
- O `cenarios.md` poderia dizer que a resposta `VERIFICACAO_PENDENTE` não traz id, nome nem quantidade da outra escola. O risco já está aceito na seção 13.
- Novo `MotivoDeEncerramento` para o redefinir (por exemplo `senha_redefinida`), em vez de reaproveitar `mfa_redefinido`.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/packages/core/src/queue/job-outbox.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/apps/worker/src/job-executor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tools/guardas/camadas.cjs
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/apps/api/test/architecture.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/apps/worker/test/expurgo-da-escola.int.test.ts

## infra-guardian · 1ª rodada · REPROVADO · 2026-11-07 10:42:10 · `tasks/prd-acesso-e-convites/revisao-spec.md`

VEREDITO: REPROVADO
Caminho quente tocado: login | fila | migration
Rate limit: ok
Fila e prioridade: ok
Concorrência: corrida em techspec.md §5 "Senha provisória", que não aparece na tabela "Corridas" do cenarios.md
Índice e paginação: faltando
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok

Bloqueantes:

1. **Gerar a senha provisória duas vezes ao mesmo tempo não tem trava** (techspec.md §5 "Senha provisória"; tabela "Corridas" do cenarios.md).
   - **O que está errado:** a spec diz que "Gerar confere o escopo e a conta ligada antes de apagar `senha_hash`". É o padrão "busca, verifica, grava" sem trava, e a regra 80 (item 7) cita esse caso ("dois cliques em aprovar").
   - **Clique duplo do professor:** as duas gravações passam. Só a última provisória vale, mas a tela pode mostrar a outra. O professor dita em sala uma senha que não funciona, e a cota de 5 por dia do aluno conta duas vezes.
   - **Gerar junto com o "ligar em Eu":** o aluno pode terminar com conta da escola ligada e provisória ao mesmo tempo. Isso contradiz o `SEM_SENHA` do PRD §7.
   - **Correção exigida:**
     - Gerar trava a linha do aluno (`credencial_matricula ... for update`) e confere `conta_externa` dentro da mesma transação. O "ligar" e a aprovação com conta pegam a mesma trava.
     - Dois "gerar" simultâneos para o mesmo aluno: um gera, o outro recebe erro tipado (ou resposta idempotente com a mesma senha). Nunca uma segunda senha que invalida a mostrada.
     - Novas linhas na tabela "Corridas" e cenários [P]: "dois gerar: a senha mostrada é a que entra" e "gerar × ligar: nunca conta ligada com provisória".

2. **A leitura da auditoria pelo alvo não tem índice, e o `/trocas` não tem limite** (techspec.md §3, §4 `/v1/sessao/matricula/trocas`, §5 "Senha provisória"; §2 `packages/core/src/titular/`, "leitura por alvo").
   - **O que está errado:** o `/trocas` lê a auditoria por `entidade_id` (o aluno) e `acao`. O arquivo do titular passa a ler "por alvo" também.
   - A auditoria cresce com cada ação de aluno e guarda 5 anos. Hoje ela só tem `auditoria_escola_em_idx (escola_id, em)` e `auditoria_escola_autor_idx (escola_id, autor_usuario_id, em)`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/packages/core/src/db/schema/auditoria.ts`.
   - Sem índice pelo alvo, cada abertura da tela de troca percorre a auditoria inteira da escola, numa rota anônima com bilhete. A lista também não tem limite: um aluno pode chegar a 5 provisórias por dia o ano inteiro.
   - **Correção exigida:**
     - §3 declara o índice `auditoria (escola_id, entidade_id, em)`, de preferência parcial em `acao in ('senha_provisoria.gerada','senha_provisoria.usada')`, no padrão de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/packages/core/drizzle/0034_indices_da_leitura_do_arquivo.sql`.
     - §4/§5 limitam o `/trocas`, por exemplo às N mais recentes ou às provisórias desde a última troca do próprio aluno.
     - Cenário [I] que prova o limite.

3. **Não está escrito onde mora o `EMAIL_POR_MINUTO`, nem como ele é consumido** (techspec.md §5 "E-mail"; linha `EMAIL_POR_MINUTO` da tabela "Limites").
   - **O que está errado:** a spec diz só "global, com metade reservada ao link da conta". Não diz onde fica o contador nem que o consumo é atômico.
   - Com dois workers e um contador em memória (ou um "confere e depois incrementa"), o teto dobra. O provedor passa a recusar, a linha entra em 4xx e termina em `falhou`.
   - A regra 80 (item 5) exige limite em Redis. Como a regra tem veto, deixar isso implícito é bloqueante.
   - **Correção exigida:**
     - §5 fixa o contador no Redis de fila, que não expulsa chave, com consumo atômico (INCR com TTL ou Lua, como o `concurrency-slot.lua`), incluindo a reserva da metade.
     - §5 diz o que acontece se o Redis não responder: adia, nunca envia sem contar.
     - Cenário [P] com dois workers dividindo o mesmo minuto, sem passar do teto.

Recomendações:
- O balde `rl:ip:senha` cheio (100/h) faz o "esqueci" responder 202 sem enviar para toda a equipe atrás do IP da escola. Um aluno com um script cala as redefinições da escola por 1 h. O desenho segue o `docs/infra.md` §5.1, porque é rota anônima e o login segue. Vale considerar:
  - deixar 1 envio por hora por conta mesmo com o balde do IP cheio;
  - uma métrica de "balde do esqueci cheio".
- O executor do worker hoje só adia o job quando falta vaga (`esperarVaga`, `moveToDelayed` seguido de `DelayedError` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/apps/worker/src/job-executor.ts:394-401`). O "adia sem gastar tentativa e solta a vaga" do §5 precisa de uma saída nova para o processador. Vale nomeá-la no §2/§5.
- §7c: medir os adiamentos pelo `EMAIL_POR_MINUTO`. O alerta "`falhou` acima de 20% em 1 h" não dispara enquanto os jobs só são adiados. Vale apontar o alerta de idade da fila por escola como o que cobre esse caso.
- `convites/enviar`: contar o limite de 300/h por convite e recusar antes de gravar o pedido que passa do que resta da cota. Assim o tamanho do lote dentro do request fica explícito.
- O hash da provisória na geração passa pelo mesmo semáforo do argon2 (`LOGIN_HASH_CONCORRENCIA`). Hoje isso está implícito.
- Todo `sistema.enviar-email-da-conta` divide a vaga `vaga:normal:sistema` (padrão 5), já suportada em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/packages/core/src/queue/escola-concurrency-limiter.ts:43`. Isso pode ficar registrado no §7c.

Spec auditada: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/techspec.md`, com o `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/cenarios.md` ao lado.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-07 10:43:07 · `tasks/prd-acesso-e-convites/revisao-spec.md`

VEREDITO: REPROVADO
Escopo: incompleto
Aderência à Tech Spec: divergência em §5 e §7 (falta a D85) e em §1 e §2 (nome da porta contra a D81)
Portão local: não se aplica. É revisão de spec e não há código. O `conferir` responde "nunca passou nesta árvore", o que é esperado nesta etapa.

Bloqueantes:

1. **A D85 foi atribuída a esta spec e não está na Tech Spec nem nos cenários.** A D85 foi decidida em 06/11, depois desta Tech Spec. Ela diz que o código entra pela F2c "levando junto as quatro ações da F2". O `ROADMAP.md`, seção F2c, diz "Leva também a D85 … com as quatro ações da F2". O `TODO.md:2784-2788` diz que "a Tech Spec dela, escrita antes da D85, ganha as quatro ações da F2 (`aluno.transferido`, `lista.transferida`, `usuario.nome_corrigido`, `lista.nome_corrigido`), o caminho de cada uma até o titular (`lista_nome` só depois de aprovado o nome) e o caso em `apps/api/test/arquivo-do-titular.int.test.ts` que prova o papel sem o id de quem fez. Dono: Arquiteto, na conferência da F2c".
   - A §5 (fim de "Senha provisória") e a §7 ("Retenção e eliminação") só levam `senha_provisoria.gerada` e `.usada`.
   - O `cenarios.md`, em "Auditoria e dado (RF17)", não tem o caso das quatro ações.
   - A "Conferência com o código do F2" do `revisao-spec.md` não menciona a D85.
   - Sem isso, o `criar-tasks` não gera a tarefa, e uma decisão do Joaquim fica sem dono no código.
   - **Correção:**
     - Na §5 (ou numa §5 própria, "Arquivo do titular"), pôr a lista fechada das seis ações, o caminho por alvo de cada uma, só com o papel de quem fez e sem `antes`, `depois` nem id do autor, e a regra de que `lista_nome` só entra depois de aprovado o nome.
     - Na §2, pôr `packages/core/src/titular/leitura-do-titular.ts`.
     - Nos cenários, um [I] por ação e o caso que prova o papel sem o id de quem fez.
     - Registrar no PRD (RF17, ou uma regra de negócio) que a D85 entra aqui.
     - Marcar o item do `TODO.md` com o lugar onde ficou.

2. **A porta de e-mail tem nome em português, contra a D81, item (2).** A Tech Spec chama a porta de `EnvioDeEmail` (§1, §2). A D81 e `docs/guia-do-desenvolvedor.md:11` ("a regra de idioma") pedem que a peça técnica nova tenha o nome do padrão, em inglês. As portas que já existem seguem isso (`LLMProvider`, `FileStorage`, `Clock`, `PasswordHasher`), e a X8 acabou de renomear o resto. Uma porta nova em português reabre o que a X8 fechou.
   - **Correção:** renomear na §1 e na §2 para `EmailSender`, com adaptadores `SmtpEmailSender` e `FakeEmailSender`. Os nomes do banco (`envio`, `link_da_conta`) e os códigos de erro ficam, porque a D81 os mantém.

Item por item da lista que você pediu:
- **RF11:** está na §4 (`convites/enviar`, `envio` em Professores), na §5 (E-mail) e na §9.
- **RF12:** está na §4 e na §5 (Esqueci).
- **RF13:** está na §4 e na §5 (Senha provisória).
- **RF14:** está na §5 (Conta da escola do aluno). O desligar já existe no `ciclo-de-vida.service.ts`.
- **RF16:** está na §6.
- **RF17:** está na §7 e na tabela do `cenarios.md`, mas falta a D85 (bloqueante 1).
- **RF18:** está na §10 e no E2E dos cenários.
- **Casos de borda do PRD:** os quatro têm lugar. "E-mail que volta" está declarado na §11, mas o `TODO.md` citado lá não tem a linha do webhook (ver recomendação).
- **Regra 00:** nenhum controller ganha regra. Nada demorado vai para o request (o e-mail vai em job). O banco só é tocado em repository (`EnvioRepository`, `TenantResolutionRepository`). O DTO está na §7, sem cifrado. Os erros são tipados: `SEM_SENHA` e `VERIFICACAO_PENDENTE` são novos; `CONFLITO` e `LIMITE_EXCEDIDO` já existem.
- **Regra 60:** o vocabulário do glossário está respeitado. O vínculo é definido pela escola: só gera a provisória o professor com vínculo confirmado. O ano letivo segue o ano em curso.

Recomendações:
- **Contratos alterados, não só os novos.** A §2 diz "contratos das rotas novas", mas rotas que já existem mudam de contrato e só aparecem na §5. Listar na §4:
  - o login de matrícula (etapa nova `trocar_senha`);
  - o aceite de convite (`VERIFICACAO_PENDENTE`);
  - `GET /v1/professores` (`envio` e como cada estado aparece na tela: `enviando` e `cancelado` não estão no PRD);
  - `externa/iniciar` (`intencao`);
  - o pedido de nome da sala (`contaExterna`).
- **Por onde viaja o bilhete no `GET /v1/sessao/matricula/trocas`.** A §4 tem a entrada "—", e a query é recusada. O padrão do projeto é o desafio no `Authorization` (`packages/shared/src/sessao/mfa.ts:18`). Escrever isso, ou trocar o GET por POST.
- **O bilhete é um mecanismo próprio sem motivo escrito (D81).** É token cifrado com `BILHETE_KEY` nova, ao lado do desafio (`apps/api/src/credencial/challenge.ts`) e do `ConviteTicket`, que são JWT assinados pelo `jose`. Há motivo possível (o aluno não tem `contaId`, e o bilhete leva o hash), mas ele não está na §5 nem na §11. Escrever o motivo, ou prender o bilhete à provisória por um valor que não é segredo (o `provisoriaExpiraEm`, por exemplo) num JWT assinado.
- **`EMAIL_POR_MINUTO`:** dizer que o contador é o `RateLimiter` de `packages/core/src/rate-limit/` e que o adiamento é o `moveToDelayed` com `DelayedError`, como o `esperarVaga` de `apps/worker/src/job-executor.ts:394-401`. Isso não pode virar `worker.rateLimit()`: a fila `normal` inteira pararia junto.
- **Reserva `enviando` com `envioReservadoEm`:** escrever na §5 por que o estado do `job_registro` e o lock do BullMQ não bastam (a corrida com a revogação). É o motivo que a D81 pede.
- **Módulo da rota da provisória.** `/v1/alunos/:usuarioId/senha-provisoria` não tem módulo na §2 (não existe controller `alunos`), e o precedente é `/v1/usuarios/:id/mfa/redefinir`. Dizer o módulo e alinhar o caminho.
- **`SEM_SENHA` engana quando o aluno tem senha e conta.** O código também responde ao aluno que tem as duas. Um nome como `ENTRA_PELA_CONTA_DA_ESCOLA` diz o que a tela mostra.
- **Lista das provisórias anteriores fora do PRD.** O `GET /trocas` e a lista na tela de troca são função visível que só está na Tech Spec e nos cenários. Pôr no PRD RF13.
- **Métrica do PRD §9 sem lugar.** "Senhas provisórias por semana por escola" não está na §7c.
- **"Senha provisória" fora do glossário.** É termo de tela e de banco novo; entra no `docs/glossario.md`.
- **Linha que falta no `TODO.md`.** A §11 cita o `TODO.md` para o webhook de devolução tardia, mas o `TODO.md` não tem essa linha. Escrevê-la.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/TODO.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/ROADMAP.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/docs/decisoes.md

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-07 10:48:00 · `tasks/prd-acesso-e-convites/revisao-spec.md`

VEREDITO: APROVADO
Tela vista: não. Ainda não existe código, então revisei só a Tech Spec §9 e o `cenarios.md` ("Telas", "E2E" e "E-mail, convite e posse").
Estados: ok. A tabela "Telas" cobre carregando, vazio ou inicial, erro e com dado nas oito telas novas ou alteradas. O estado vazio é um convite à ação, por exemplo "Ligar a conta da escola" e a linha "Aluno: peça a senha provisória ao professor". Há um [E] para os estados de carregando e de erro.
Acessibilidade: ok. A tabela prevê `autocomplete="new-password"`, "mostrar senha", `aria-live="polite"` no envio e a senha lida grupo a grupo pelo leitor de tela. O axe roda nos [E].
Chromebook fraco: ok. A lista de Professores já é paginada, então não há virtualização. A releitura a cada 5 s só roda com a aba visível e linha `na_fila` ou `enviando` (§9). O lote de 40 envia sem esperar o SMTP, e isso tem teste.
Celular: ok. Há um [E] para toda tela nova e alterada a 360 px, sem rolagem horizontal, com 44 px na ação principal e 24 px no resto.
Ação oficial protegida: sim. A confirmação da provisória mostra nome, turma e a consequência: "a senha atual deixa de valer, e ela sai da conta em todo lugar". Cancelar não gera nada, e fechar sem copiar pergunta antes.

Conferência dos 5 bloqueantes da rodada 1:
1. Estados e textos das telas: resolvido pela tabela "Telas" em `cenarios.md` e pelo [E] de carregando e erro.
2. Confirmação da provisória e onde o botão mora: resolvido. A confirmação está em "Telas" ("Gerar provisória") e no [E] dos alunos homônimos. O botão fica no menu da linha do aluno aprovado, na aba Alunos da turma (§9).
3. Aviso no "Copiar link" e no "Reenviar" e contagem no "Enviar": resolvido no [E] do diálogo, que diz quantos recebem e que o link anterior deixa de valer. A contagem tem respaldo no caso [I] do "Enviar" com mistura de estados.
4. Atualização da lista em Professores: resolvido pela releitura a cada 5 s em §9 e pelo `aria-live`.
5. 360 px em toda tela nova: resolvido pelo [E] de 360 px com a lista de telas.

Bloqueantes: nenhum.
Recomendações:
- Em "Gerar provisória", o erro 429 diz só "o limite". Escreva o texto, por exemplo "Muitas tentativas. Espere alguns minutos e tente de novo".
- Em "Aceite com `VERIFICACAO_PENDENTE`", diga que o e-mail pode demorar alguns minutos e que dá para pedir outro link.
- O erro de rede em "Conta da escola na sala" não tem "Tentar de novo". Acrescente.

## infra-guardian · 2ª rodada · REPROVADO · 2026-11-07 10:49:34 · `tasks/prd-acesso-e-convites/revisao-spec.md`

VEREDITO: REPROVADO
Caminho quente tocado: login | fila | migration
Rate limit: ok
Fila e prioridade: ok
Concorrência: há corrida na cota de 300/h do "Enviar convites" (Tech Spec §4 e §7c; `cenarios.md`, tabela "Limites", linha "Convites", e RF11, "Lote maior que o que resta da cota")
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok

**Bloqueantes:**

1. **Tech Spec §4 e §7c; `cenarios.md`, "Limites", linha "Convites", e "Corridas".** A spec agora recusa inteiro o lote acima da cota de 300/h, mas não diz como a cota é consumida.
   - **Corrida.** "Ver quanto resta, comparar com o lote, gravar" é o padrão sem trava. Dois "Enviar" juntos com 300 restantes e lotes de 200 passam os dois, e saem 400 convites na hora.
   - **Bug com o limitador atual.** O `RateLimiter` (`packages/core/src/rate-limit/rate-limiter.ts`) usa o `rate-limiter-flexible`. No `consume(chave, N)`, os pontos ficam contados mesmo quando ele recusa. Um lote de 40 com 30 restantes leva 429 e leva junto a sobra da escola. Até o fim da hora, até um único "Reenviar" é recusado.
   - **Correção exigida:** a §5 ou a §7c precisa dizer quatro coisas:
     - a cota é consumida pelo número de convites que de fato entram (depois do filtro de pendente e vencido), em um consumo atômico de N pontos;
     - o lote recusado devolve o que contou, como já faz o `#devolver`;
     - se a transação falha depois do consumo, a cota também é devolvida;
     - com o Redis fora, vale um comportamento declarado.
   - **Cenários a acrescentar:**
     - [I] lote de 40 com 30 restantes leva 429, e logo depois um lote de 30 passa;
     - [P] dois lotes de 200 ao mesmo tempo com 300 restantes: um passa e o outro leva 429, a soma na fila não passa de 300 e nunca há 500.

**Os três bloqueantes da rodada 1:**
- **Trava da provisória:** resolvido. A geração trava a linha do usuário do aluno, a mesma trava do "ligar" e da aprovação com conta. O mesmo autor em menos de 10 s recebe `CONFLITO`. Os cenários [P] de "gerar duas vezes" e de "gerar × ligar" existem (Tech Spec §5, "Senha provisória"; `cenarios.md`, "Corridas").
- **Índice e limite da leitura por alvo:** resolvido. O índice parcial `(escolaId, entidadeId, em)` cobre as ações da lista por alvo, e o `/trocas` traz no máximo 10, com cenário de 12 anteriores (Tech Spec §3 e §5). Criar o índice sem `concurrently` segue o precedente do 0034, que vale enquanto não há homologação nem piloto.
- **`EMAIL_POR_MINUTO`:** resolvido. A cota fica no Redis de fila, com consumo atômico. Estourada ou com o Redis fora, o job adia sem gastar tentativa e nunca envia sem contar. Há cenários [I] e [P] (Tech Spec §5, "E-mail"; `cenarios.md`, RF11 e "Corridas").

**As outras correções:** `rl:ip:senha` a 10 por minuto, com o teto de 3/h por e-mail e 202 sem envio, segue o `docs/infra.md` §5.1 e só serve à equipe. O `convite.enviado` gravado no pedido e o `senha.redefinida` por escola na mesma transação não pesam no request. Nenhum dos dois traz problema de carga.

**Recomendações:**
- Tech Spec §5, "E-mail": dizer que o `EMAIL_POR_MINUTO` não usa o seguro em memória do `RateLimiter`. Do jeito que a classe está, com o Redis fora ela conta em memória e aceita, o contrário do que a spec quer. O cenário "Redis de fila fora: adiado" pega isso, mas o texto deveria evitar o caminho errado.
- Tech Spec §9: pôr um teto no polling de 5 s de Professores, com intervalo crescente ou parada depois de alguns minutos. Uma linha pode ficar `na_fila` até 24 h com o SMTP fora, e a aba aberta faria 12 requisições por minuto o dia todo.
- Tech Spec §5, "Senha provisória": o `CONFLITO` de 10 s vale só para o mesmo autor. Se coordenação e professor geram juntos, a senha que o primeiro mostrou não entra. Estender a janela a qualquer autor, ou registrar o caso como aceito.
- A recomendação da rodada 1 (um envio por hora por conta com o balde cheio) não foi adotada, e o motivo é válido. Não é bloqueante.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/packages/core/src/rate-limit/rate-limiter.ts

## revisor-geral · 2ª rodada · APROVADO · 2026-11-07 10:49:47 · `tasks/prd-acesso-e-convites/revisao-spec.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. Os dois bloqueantes da rodada 1 foram corrigidos e entraram em todos os documentos que precisavam deles:
- **D85.** A Tech Spec traz a D85 em três seções: a §2 (`leitura-do-titular.ts`), a §3 (índice parcial da auditoria pelo alvo) e a §5, "Arquivo do titular". Essa seção lista as seis ações da D85, com o papel de quem fez e sem o id, o nome, o `antes` e o `depois`; também diz que as leituras não entram. A D85 também está no cenarios.md (seção "Arquivo do titular", um caso por ação), no PRD RF17 e no item do TODO.md, marcado como levado à F2c.
- **D81.** A porta agora se chama `EmailSender`, com `SmtpEmailSender` e `FakeEmailSender` (§1 e §2). `EnvioDeEmail` e `BILHETE_KEY` não aparecem mais.

As recomendações que vocês adotaram estão todas lá:
- os contratos que mudam, na §4;
- o bilhete como JWT do `jose`, no `Authorization`, com a escola, o aluno e a `provisoriaExpiraEm`, rodando em `naEscolaSemUsuario` (§5);
- o código `ENTRA_PELA_CONTA_DA_ESCOLA` (§2 e §5);
- a rota `/v1/usuarios/:usuarioId/senha-provisoria`, com a provisória em `credencial/` (§2 e §4);
- a lista das provisórias no PRD RF13;
- a métrica "provisórias por escola" (§7c);
- a "Senha provisória" no glossário;
- a linha do webhook no TODO.md.

O `wc -w` da techspec.md dá exatamente 2000 palavras, no teto. As correções dos outros revisores não contradizem a Tech Spec. Isso vale para a trava na geração, o `EMAIL_POR_MINUTO` atômico, o `SISTEMA_DA_REQUISICAO`, a autoria por escola na rota anônima e a cláusula de defesa do `desativar`.

Portão local: não se aplica, porque é revisão de spec e ainda não há código. O `conferir` responde "nunca passou nesta árvore".

Bloqueantes: nenhum.

Recomendações:
1. **§5, "Arquivo do titular".** A spec não diz de onde vem o papel nas quatro ações da F2. Elas não guardam papel no `depois`, e o autor delas é sempre a coordenação que gravou a planilha (`packages/core/src/auditoria/acoes.ts`, comentários das ações). Basta escrever que o papel é fixo por ação, para ninguém montar um join com `usuario`, que some quando o autor é eliminado.
2. **§5, "Senha provisória", e cenarios.md, "Corridas".** A frase "a mesma trava do 'ligar' e da aprovação com conta" não tem efeito na aprovação. A aprovação cria o usuário, e o aluno pendente já recebe 404 ao gerar. Quem resolve a corrida da aprovação é a `conta_externa` única. Vale tirar a aprovação da frase da trava.
3. **§5, bilhete.** O "como o desafio" deveria dizer que o bilhete tem `audience` própria, separada da `CHALLENGE_AUDIENCE` (`apps/api/src/credencial/challenge.ts`). Também falta no cenarios.md o caso inverso: um desafio de login ou de convite não pode valer como bilhete.
4. **docs/lgpd.md, seção "IP só em memória".** O texto contradiz a si mesmo. A linha nova diz que o `rl:ip:senha` funciona "como o `rl:ip:op`, pelo HMAC do IP", mas o `rl:ip:op` usa o IP puro como chave, no Redis de cache. É preciso dizer qual dos dois vale: o balde do rate limit do F0, com o IP como chave, ou o contador com HMAC no Redis de fila. O cenarios.md ("Limites") repete o HMAC.
5. **§5, "Arquivo do titular".** O `.usada` tem o aluno como autor, então ele já entra pela leitura que existe hoje, a do que o titular fez. A junção pelo `id` evita a linha repetida, e um caso pode provar que ela aparece uma vez só.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-07 10:49:49 · `tasks/prd-acesso-e-convites/revisao-spec.md`

VEREDITO: APROVADO

**Tabelas verificadas:**
- `link_da_conta`: tabela global. Já tem a exceção na §11 e no `docs/modelo-de-dados.md`. O id é uuidv7 e a tabela não varia por período.
- `convite`: ganha `canal`, os cifrados e o `envio`. Continua com escopo da escola.
- `conta`: ganha `emailVerificadoEm`. É global.
- `credencial_matricula`: ganha a provisória e tem `escolaId`.
- `reivindicacao`: ganha `contaExterna`. Tem `escolaId` e `anoLetivoId`, e o único parcial começa por `escolaId`.
- `auditoria`: ganha um índice parcial `(escolaId, entidadeId, em)`. Ele começa pela escola e não abre leitura fora dela.

**Queries verificadas:**
- **Bloqueante 1 da rodada 1 (job de sistema nascido de requisição): corrigido.** A §6 cria a lista fechada `SISTEMA_DA_REQUISICAO`, só com `sistema.enviar-email-da-conta`, e a requisição não ganha `rotinaDoSistema`. O cenário em RF16 prova que outro `sistema.*` continua recusado.
- **Bloqueante 2 (escopo das rotas do bilhete): corrigido.** Na §5, "Senha provisória", o bilhete passa a ser JWT com a escola. `trocar-senha` e `/trocas` rodam em `naEscolaSemUsuario` com a escola do bilhete e escopo no repository. A §11 não ganha exceção nova.
- **Auditoria de `senha.redefinida` e `conta.email_verificado` vinda de rota anônima (§5, "Auditoria"):** a escola e o autor saem do servidor. A conta vem do token verificado, e o `usuariosAtivosDaConta`, que já é `@Unscoped` com justificativa, diz em quais escolas ela tem usuário ativo. O precedente é o `ops:redefinir-mfa`. Nada vem do cliente.
- **Leitura por alvo da D85 (§5, "Arquivo do titular"):** segue o padrão de `leitura-do-titular.ts`, com `t.escola_id = ${escolaId}`. A lista de ações é fechada e não leva o id do autor.
- **`cerca-envio` (§6):** é uma regra própria, com o `EnvioRepository` no `to` e só `enviar-email.ts` fora. Tem fixture do arquivo vizinho e não alarga a `cerca-conta-global`. O `falhou` de 24 h do `link_da_conta` vai pelo `ExpurgoDeAcessoRepository`.
- **Demais:**
  - `convites/enviar` e `/v1/usuarios/:usuarioId/senha-provisoria`: as cotas contam só depois do escopo, então o 429 não serve para descobrir se um id de outra escola existe.
  - `email.enviar-convite`: a escola vem do `job_registro`.
  - `intencao=reivindicar` resolve o acesso pela `TenantResolutionRepository`.
  - Cookie `educa_conta_provada`: conferido contra a escola e o acesso.

**Teste de isolamento:** presente e efetivo.
- **Bloqueante 3 da rodada 1 (casos do expurgo e do bilhete): corrigido.** Os dois alvos novos do `retencao.expurgar-escola` entram no `it.each(CATEGORIAS_DO_EXPURGO)` com a linha da outra escola. Com o contexto da escola A, a troca e o `/trocas` sobre o aluno da B dão zero linhas. Há também o caso de matrícula igual nas escolas A e B.
- O caso da conta com usuário nas escolas A e B (RF17) quebra se o registro cair na escola errada ou com o autor errado.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **§5, "Auditoria" (contexto por escola na rota anônima).** O `AuditoriaRecorder` tira a escola e o autor do contexto, e o `naEscolaSemUsuario` não põe usuário, então a gravação seria recusada com `sem_autor`. Convém a §6 dizer que o contexto de cada escola, com escola e usuário, é montado só a partir do `usuariosAtivosDaConta` da conta do token verificado, dentro do próprio fluxo de redefinir e verificar. Também convém dizer se a escola com eliminação agendada recebe o registro (`comSuspensos`). Sem isso, nasce um ajudante genérico de "rodar como usuário X" que poderia ser reaproveitado.
2. **`cenarios.md`, "Auditoria e dado".** No caso das escolas A e B, conferir que o registro da A não traz no `antes`, no `depois` nem na finalidade nada que aponte para a B: id, quantidade de escolas ou a outra escola.
3. **`cenarios.md`, "Arquivo do titular".** Os ids são UUID, então tirar `escola_id` da leitura por alvo não quebra nenhum caso hoje. Convém um caso com uma linha de auditoria da escola B inserida direto com o mesmo `entidade_id` do aluno da A, que não pode entrar no arquivo da A. Ela pode ir na sentinela da escola B que já existe em `arquivo-do-titular.int.test.ts`.
4. **§6 e "Isolamento e ano letivo".** Escrever que `sistema.enviar-email-da-conta` grava escola nula mesmo quando nasce no aceite com `VERIFICACAO_PENDENTE`, em que a escola do convite já está no contexto. Hoje o `inserir` copia `contexto.escolaId`. Ponha no cenário "tem escola nula" a origem pelo aceite, além do "esqueci".
5. **§5, "Senha provisória".** Dar ao bilhete chave ou `aud` próprio, o `BILHETE_KEY`, separado do desafio. Ponha no cenário [U] que um JWT de desafio não serve como bilhete.
6. **`cenarios.md`, "Senha provisória".** `:usuarioId` de professor ou de coordenador da mesma escola: 404 igual ao inexistente. É autorização por objeto: a rota é `/usuarios`, e não `/alunos`.
7. **§6.** O método novo do `ExpurgoDeAcessoRepository` que grava o `falhou` leva o seu próprio `@Unscoped` com a linha de justificativa, e não herda o dos métodos que já existem.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/packages/core/src/queue/job-outbox.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/packages/core/src/auditoria/auditoria-recorder.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/apps/api/src/sessao/tenant/tenant-resolution.repository.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/packages/core/src/titular/leitura-do-titular.ts

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-07 10:49:58 · `tasks/prd-acesso-e-convites/revisao-spec.md`

VEREDITO: APROVADO

Rodada 2 da revisão da spec. Ainda não existe código desta funcionalidade, então apontei a seção em vez de `arquivo:linha`.

**Os três bloqueantes da rodada 1 foram corrigidos:**
1. **Arquivo do titular com as quatro ações da F2 (D85).** Está na Tech Spec, §5 "Arquivo do titular", com a lista fechada das seis ações. O arquivo traz ação, entidade, finalidade, data e o papel de quem fez, sem o id dele e sem `antes` nem `depois`. A leitura auditada não entra. O nome corrigido na lista só entra depois de aprovado. A auditoria ganhou um índice pelo alvo, que começa pela escola (§3). O mesmo aparece no PRD (RF17), no `cenarios.md` (seção "Arquivo do titular", com um caso por ação), no `docs/lgpd.md` (parágrafo "O arquivo do titular") e no `TODO.md`. Bate com o texto da D85 em `docs/decisoes.md`.
2. **Contadores novos e o balde `rl:ip:senha`.** O `docs/lgpd.md` ganhou a linha "Contadores do acesso (F2c)", com finalidade, base legal e janela. O `rl:ip:senha` está na lista do IP só em memória, com janela de um minuto, e bate com a tabela "Limites" do `cenarios.md`.
3. **Escola e autor da auditoria.** Está na Tech Spec, §5 "Auditoria". Quem assina o `convite.enviado` é a coordenação, no pedido; o job só muda o estado do envio. `senha.redefinida` e `conta.email_verificado` geram um registro por escola em que a conta tem usuário ativo, com esse usuário como autor e alvo. Isso passa pelo gatilho `auditoria_autor_da_escola_fk` e pelo check do autor `rotina` em `packages/core/src/db/schema/auditoria.ts`. Cada escola só vê o seu próprio usuário. Há cenário com uma conta em duas escolas, em "Auditoria e dado".

**Recomendações que vocês adotaram, todas presentes:**
- **Trava de configuração do e-mail:** Tech Spec §2, linha do `packages/core/src/email/`.
- **Mailpit só em `127.0.0.1`:** Tech Spec §2.
- **Token no fragmento do link e `no-store`:** Tech Spec §4.
- **Bilhete como JWT assinado, sem hash:** Tech Spec §5, mais o [U] em "Senha provisória". Nenhum resto de `BILHETE_KEY`, `SEM_SENHA`, `EnvioDeEmail` ou `/v1/alunos/:usuarioId` nos documentos.

**Seção "Telas" do `cenarios.md`:** nada exposto que não devia.
- O texto do "Esqueci" é o mesmo para todos.
- No "Redefinir", link vencido, usado ou inválido recebem a mesma mensagem.
- O `CONFLITO` na sala e em "Eu" não diz a quem a conta está ligada.
- A tela do `VERIFICACAO_PENDENTE` não diz de qual escola a conta é. Esse risco foi aceito na Tech Spec §12.
- A troca da provisória mostra só o papel de quem gerou, como manda a D85.
- O `ENTRA_PELA_CONTA_DA_ESCOLA` só aparece a quem já passou pela checagem de escopo; os outros recebem 404.

```
VEREDITO: APROVADO
Campos pessoais tocados: link_da_conta (hash, token e endereço cifrados, envio); convite (canal, cifrados, envio, enviadoEm); conta.emailVerificadoEm; credencial_matricula (provisoriaHash, validade, quem gerou); reivindicacao.contaExterna; cookie educa_conta_provada; contadores do acesso; balde rl:ip:senha; bilhete JWT (escola, aluno, provisoriaExpiraEm, só na memória do navegador por 10 min)
Fora da tabela de dados do docs/lgpd.md: nenhum
Autorização por objeto: ok (provisória: escopo e vínculo antes de tudo, 404 igual; /trocas e trocar-senha no escopo da escola do bilhete; convites/enviar com usuarioIds de outra escola igual a inexistente; os dois jobs leem a escola do registro, nunca do payload)
Logs: limpos (só ids e código; nunca e-mail, token nem resposta do SMTP; contadores fora de log e de métrica com pessoa)
Auditoria: presente (convite.enviado, senha_provisoria.gerada e .usada, senha.redefinida, conta.email_verificado e conta_externa.ligada, com escola e autor definidos; leitura por alvo da D85)
Envio externo: endereço e texto de convite, redefinição e verificação ao provedor de e-mail, nunca dado de aluno; o provedor entra como suboperador antes do portão; sem IA
Seed/fixture: sintético (oidc-falso, SMTP falso, Mailpit local)
Bloqueantes: nenhum
Recomendações:
1. Senha provisória na tela (cenarios.md "Telas", linha "Gerar provisória"; docs/lgpd.md, linha da senha provisória): escrever para ela a mesma cláusula do link do convite e do código da turma. Fora do cache de consultas, de URL, de log e de armazenamento do navegador; sai da tela quando a sessão da aba muda; nenhuma leitura a devolve de novo. Somar um caso que prove o "mostrada uma vez" do RF13.
2. Tela "Redefinir" (cenarios.md "Telas"): "entra na tela inicial do papel" contradiz o 204 da Tech Spec §4 e o "o MFA fica" da §5. Trocar por "volta à entrada, com aviso", para ninguém implementar um login automático que pule o segundo fator.
3. Faltam cenários para três coisas adotadas na Tech Spec §2 e §4: (a) [U] fora do ambiente local, sem EMAIL_PROVEDOR_ID ou sem TLS, ou apontando para o Mailpit, não sobe; (b) [I] o link capturado pelo falso leva o token depois do "#"; (c) [I] Cache-Control no-store na provisória, na troca e no /trocas.
4. docs/lgpd.md, lista do IP em memória: "como o rl:ip:op, pelo HMAC do IP" se contradiz, porque o rl:ip:op usa o IP puro no Redis de cache. Escrever direto: HMAC do IP, em qual Redis, janela de um minuto.
5. Tech Spec §5 "Arquivo do titular": dizer de onde vem o papel de quem fez nas quatro ações da F2. A auditoria não tem coluna de papel, e o autor eliminado some do usuario. As quatro vêm da importação pela coordenação, então o papel pode ser fixo por ação na lista fechada, como a provisória faz pelo `depois`. Somar o caso de autor eliminado nessas quatro.
6. cenarios.md "Arquivo do titular": o caso do nome ainda não aprovado cobre só lista.nome_corrigido; repetir para lista.transferida.
```

Pergunta de fechamento: o código responde. Com a leitura por alvo da D85, o arquivo do aluno passa a trazer o que a escola fez sobre ele, incluindo as provisórias geradas e usadas. O e-mail nunca leva dado de aluno, e o provedor entra como suboperador antes da primeira escola real.

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/prd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/docs/lgpd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/packages/core/src/db/schema/auditoria.ts

## test-engineer · 2ª rodada · REPROVADO · 2026-11-07 10:50:30 · `tasks/prd-acesso-e-convites/revisao-spec.md`

VEREDITO: REPROVADO

**Cenários exigidos:** cenarios.md e Tech Spec §5, §9 e §11, comparados com o `git diff` desta rodada e relidos inteiros.

**Cobertos (os 9 bloqueantes da rodada 1):**
1. **`desativar`:** está resolvido. Em cenarios.md, "RF11", a cláusula de defesa tem dois casos: o convite aberto inserido direto no banco, com envio `na_fila` e `enviando`, termina `cancelado` com zero envios, e o professor pendente recebe `NAO_ENCONTRADO`. O caminho de todo dia, a revogação, também tem caso: entre a fila e o envio, e com a barreira.
2. **"Enviar":** está resolvido. Há a seleção mista (só pendente e vencido entram, com a contagem e nunca 409), os 40 com o SMTP falso preso na barreira, o vencido no "sem aceite" e o lote acima da cota com 429 inteiro.
3. **"Copiar link":** está resolvido. O envio `na_fila` termina `cancelado`, com os cifrados nulos e zero envios.
4. **Escola e autor da auditoria:** em parte. A conta de duas escolas está coberta no "esqueci", incluindo o usuário da B desativado. O resto está no bloqueante 3.
5. **Aprovar com conta já ligada:** está resolvido em sequência. A corrida está no bloqueante 2.
6. **Dois "gerar":** está resolvido. O [P] cai na mutação, porque sem a trava saem dois `.gerada`, e o caso dos 10 s está lá.
7. **Escola sem ano em curso:** está resolvido em "Senha provisória (RF13)" e "RF14".
8. **Homônimos [E]:** o cenário existe, mas não chega ao risco (bloqueante 1).
9. **RF14:** está resolvido. Há o login recusado com o pedido pendente e a segunda conta em "Eu" recusada.

**Correções dos outros revisores:**
- **Bilhete JWT:** o [U] confere o conteúdo e a assinatura, e o bilhete de provisória substituída é recusado. Falta a cláusula do vencimento (bloqueante 4).
- **`/trocas` limitado a 10:** coberto pelo caso "com 12 anteriores, traz as 10".
- **D85 por alvo:** coberto, com um caso por ação, o `lista_nome` aprovado ou não, e as leituras fora.
- **`EMAIL_POR_MINUTO`:** o atômico, o Redis fora e a metade reservada estão cobertos (ressalva no bloqueante 5).
- **Lista fechada do `sistema.*`:** coberta em "Isolamento e ano letivo".
- **Seção "Telas":** existe e é citada no E2E.

**Bloqueantes:**

1. **A confirmação da provisória não separa homônimos de verdade** (cenarios.md, "E2E (RF18)", caso dos homônimos, e "Telas", linha "Gerar provisória").
   - O [E] usa dois alunos de mesmo nome em turmas diferentes. Pela Tech Spec §9, a provisória fica no menu da linha, na aba Alunos de uma turma, então esses dois nunca aparecem na mesma tela e o teste não prova nada.
   - O risco real é o homônimo na mesma turma. O `docs/interface.md` registra que dois alunos de mesmo nome são duas linhas, e aí "nome e turma" mostram exatamente o mesmo texto.
   - Correção: o [E] passa a usar dois homônimos na mesma turma. A confirmação precisa mostrar o que os diferencia, por exemplo a matrícula, como já faz o pedido do titular em `docs/interface.md` ("cada pessoa se escolhe pela turma e pela matrícula", com aviso de homônimo).

2. **Falta a corrida entre aprovar e ligar a mesma conta** (cenarios.md, "Conta da escola do aluno (RF14)" e "Corridas", linhas "Gerar × ligar × aprovar" e "Aprovar com a conta já ligada a outro").
   - Hoje só existe o caso em sequência. Se a implementação conferir com um `select` antes de gravar, esse caso passa, e em paralelo a violação do índice único vira 500 e deixa um usuário criado sem conta.
   - Correção: um [P] em que o professor aprova o pedido com a conta C enquanto outro aluno liga C em "Eu". Uma das duas liga; a outra recebe `CONFLITO` sem nome, nunca 500, nenhum usuário criado e o pedido continua pendente.

3. **Duas cláusulas da auditoria estão sem cenário** (Tech Spec §5, "Auditoria"; cenarios.md, "Auditoria e dado (RF17)").
   - A conta de duas escolas só foi testada no "esqueci". O `/v1/conta/verificar`, que também é rota anônima e grava `conta.email_verificado`, não tem o caso. Correção: conta com usuário ativo em A e C verifica o e-mail, e sai um registro em cada escola, com autor e alvo o usuário daquela escola.
   - "O aceite de convite grava só na escola do convite" também não tem caso. Correção: conta com usuário em A aceita por e-mail um convite da B, e a auditoria da A fica sem registro novo.

4. **A troca com a provisória já vencida não tem cenário** (Tech Spec §5, "Senha provisória"; cenarios.md, "Senha provisória (RF13)", caso das duas trocas).
   - A condição `provisoria_expira_em > now()` no `update` da troca só é testada no `/trocas`. Se alguém apagar essa condição na troca, nenhum teste quebra.
   - Correção: bilhete emitido 5 minutos antes de a provisória vencer, troca 1 minuto depois do vencimento (relógio falso, bilhete ainda dentro dos 10 min). Resultado esperado: recusada, a senha não muda e nenhum `.usada` é gravado.

5. **O "adia sem gastar tentativa" não quebra na mutação** (cenarios.md, "RF11": o caso do `EMAIL_POR_MINUTO` estourado e o da reserva de outro processo ainda vigente).
   - Do jeito que está escrito, um adiamento só e "nenhum `falhou`" passam mesmo se cada adiamento gastar uma tentativa.
   - Correção: adiar mais vezes que o número de tentativas do job. Conferir que as tentativas não mudaram, que a linha não virou `falhou` e que o envio sai quando a vaga abre.

6. **Quatro cláusulas novas desta rodada estão sem cenário:**
   - Tech Spec §2: fora do ambiente local, `EMAIL_PROVEDOR_ID` e TLS são obrigatórios e o Mailpit é recusado. Falta um [U] que recuse a partida nos três casos, como o da `IA_PROVEDOR_ID`.
   - Tech Spec §4: o token vai no fragmento do link. Falta um [I] em que o corpo capturado pelo falso traz o token depois do `#` e nunca na query.
   - Tech Spec §4: `no-store` na provisória, na troca e no `/trocas`. Falta um [I] que confira o `Cache-Control` das três respostas.
   - Tech Spec §5 e §9: o hash da provisória passa pelo semáforo do argon2 (falta o caso com espião no semáforo, como o do "token inválido"), e Professores relê o envio a cada 5 s só com a aba visível e com linha `na_fila` ou `enviando`. Para a releitura, falta um [U] com relógio falso e `visibilityState`: aba oculta ou nenhuma linha em envio, zero leituras.

**Recomendações:**
- **[P] dos dois workers no `EMAIL_POR_MINUTO`:** disparar mais consumos simultâneos que o teto e conferir o número exato. Com só dois workers, um consumo que não seja atômico pode passar por sorte.
- **Escola sem ano em curso:** "Isolamento e ano letivo" diz "provisória e login seguem o ano em curso", e "RF13" diz que a coordenação gera e o login funciona. Vale alinhar os dois textos ao que diz o RF13.
- **`.usada` no arquivo do titular:** o autor é o próprio aluno, então a ação entra tanto pela leitura do que o titular fez quanto pela leitura por alvo. Vale conferir que aparece uma vez só.
- **`convite.enviado`:** depois de o job rodar, conferir que continua um registro só.
- **Tech Spec §5, "Senha provisória":** dizer qual linha a aprovação com conta trava. Antes de aprovar o usuário ainda não existe, então não há linha de usuário para travar.
- **`intencao=reivindicar`:** caso com o token da sala da B sob o slug da A, recusado já no `iniciar`.
- **Painel do coordenador:** caso explícito com o convite do painel na posse do e-mail ("o do painel também").
- **Dois autores diferentes gerando ao mesmo tempo:** vale a última provisória, saem dois `.gerada` e nunca 500.
- **"Copiar link" com o envio `enviando`:** caso com a barreira, como o da revogação.
- **Os 40 com barreira:** dizer que a API usa o mesmo `FakeEmailSender`, para que um envio síncrono fique preso na barreira.

Arquivos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/cenarios.md`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/techspec.md`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/docs/interface.md`

```
VEREDITO: REPROVADO
Cenários exigidos: os da rodada 1 e as cláusulas novas da Tech Spec (§2, §4, §5 "Senha provisória", "Arquivo do titular", "Auditoria", "Conta da escola do aluno", §6, §9)
Cobertos: desativar pela cláusula de defesa e pela revogação; "Enviar" com seleção, os 40 com barreira, o vencido e o 429; "Copiar link" cancelando; conta de duas escolas no "esqueci"; aprovar com conta já ligada (em sequência); dois "gerar"; escola sem ano em curso; RF14 antes da aprovação e segunda conta; bilhete JWT (exceto o vencimento); /trocas com 10; D85 por alvo; EMAIL_POR_MINUTO atômico e Redis fora; lista fechada do sistema.*; seção "Telas"
Bloqueantes:
1. cenarios.md "E2E (RF18)" e "Telas" (Gerar provisória): os homônimos estão em turmas diferentes, que nunca aparecem na mesma tela; o caso tem de ser na mesma turma, com a matrícula (ou outro dado que diferencie) na confirmação
2. cenarios.md "RF14" e "Corridas": falta o [P] de aprovar com a conta C enquanto outro aluno liga C em "Eu": um liga, o outro CONFLITO, nunca 500, nenhum usuário órfão
3. Tech Spec §5 "Auditoria": faltam o verificar com conta ativa em duas escolas (um registro por escola) e o aceite que grava só na escola do convite
4. Tech Spec §5 "Senha provisória": a condição provisoria_expira_em > now() da troca não tem cenário (bilhete válido, provisória vencida: recusada)
5. cenarios.md "RF11" (EMAIL_POR_MINUTO estourado, reserva de outro processo vigente): adiar mais vezes que o número de tentativas e conferir que nenhuma tentativa foi gasta
6. Cláusulas novas sem cenário: §2 (EMAIL_PROVEDOR_ID, TLS, Mailpit recusado), §4 (token no fragmento, no-store), §5 (hash da provisória pelo semáforo do argon2), §9 (releitura a cada 5 s só com a aba visível e linha em envio)
Recomendações: [P] do EMAIL_POR_MINUTO com mais consumos que o teto; alinhar "Isolamento e ano letivo" ao RF13 na escola sem ano; .usada uma vez só no arquivo; convite.enviado continua um depois do job; dizer o que a aprovação trava; token da B sob o slug da A recusado no iniciar; convite do painel na posse do e-mail; dois autores gerando ao mesmo tempo; "Copiar link" com o envio em `enviando`; o fake compartilhado no caso dos 40
```

## test-engineer · 3ª rodada · REPROVADO · 2026-11-07 10:54:24 · `tasks/prd-acesso-e-convites/revisao-spec.md`

VEREDITO: REPROVADO

**Cenários exigidos.** Os seis bloqueantes da rodada 2: homônimos na mesma turma; [P] aprovar × ligar; verificar com conta de duas escolas e aceite só na escola do convite; troca com a provisória vencida; adiar mais vezes que as tentativas; e os casos da configuração do e-mail, do fragmento, do `no-store`, do semáforo e da releitura de 5 s. Também as cinco cláusulas novas da Tech Spec: a cota de 300/h atômica e devolvida; o `CONFLITO` de 10 s de qualquer autor; a `aud` própria do bilhete; o papel fixo por ação nas quatro da F2; e o contexto por escola na auditoria anônima.

**Cobertos.** Os seis bloqueantes da rodada 2 estão corrigidos:
- **Homônimos:** está em `cenarios.md`, "E2E (RF18)", no [E] "Dois alunos de mesmo nome na mesma turma". A confirmação mostra a matrícula e a consequência, e cancelar não gera nada.
- **[P] aprovar × ligar:** está em `cenarios.md`, "Conta da escola do aluno (RF14)", no [P] da conta C. Quem perde a aprovação não cria usuário, e o pedido segue pendente.
- **Duas escolas e aceite:** estão em `cenarios.md`, "Auditoria e dado (RF17)".
  - Esqueci e verificar com usuário ativo na A e na B gravam um registro por escola, com autor e alvo o usuário dela. Com o usuário da B desativado, só a A grava. O registro da A não traz nada da B.
  - O aceite por e-mail de um convite da B grava só na B.
- **Provisória vencida:** está em `cenarios.md`, "Senha provisória (RF13)". O bilhete é emitido 5 min antes de a provisória vencer, e a troca 1 min depois do vencimento é recusada. Apagar o `provisoria_expira_em > now()` faz esse caso quebrar.
- **Adiar mais que as tentativas:** está em "RF11". O `EMAIL_POR_MINUTO` estourado e a reserva alheia adiam o job sem mudar as tentativas e sem gravar `falhou`. Com o Redis de fila fora, nada é enviado.
- **Cláusulas da rodada 2:** cada uma tem o seu caso.
  - Configuração do e-mail: o [U] dos três casos de recusa.
  - Fragmento: o token depois do `#`, também no redefinir e no verificar.
  - `no-store`: na geração, na troca e no `/trocas`.
  - Semáforo do argon2: o espião no semáforo.
  - Releitura de 5 s: o [U] com relógio falso e `visibilityState`.

Das cláusulas novas desta rodada, quatro estão provadas e uma em parte:
- **`CONFLITO` de 10 s:** está em "Senha provisória (RF13)", no [P] "Dois 'gerar'", do mesmo autor e de autores diferentes, e com "depois de 10 s, gerar de novo vale".
  - Sem a regra, a trava só põe as duas chamadas em fila e a segunda gera senha, então o caso quebra.
  - Se a regra valer só para o mesmo autor, o caso de autores diferentes quebra.
- **`aud` própria:** está no [U] do bilhete JWT, em que um desafio de login ou de convite não vale como bilhete. Há também o [I] "o bilhete não abre outra rota".
- **Papel fixo:** está em "Arquivo do titular (D85)", no caso do autor das quatro ações da F2 eliminado. Se o papel fosse lido do autor, o caso quebraria.
- **Contexto por escola:** é coberto pelo caso das escolas A e B citado acima.
- **Cota de 300/h:**
  - Estão cobertos o 429 inteiro, o lote de 40 com 30 restantes seguido de um de 30, a transação desfeita, o [P] de dois lotes de 200 e o caso "a outra escola segue".
  - Falta o que está no primeiro bloqueante.

**Bloqueantes.**
1. **Cota contada pelo tamanho da seleção.** A Tech Spec, §5 "Enviar", diz que a cota consome "um ponto por convite que entra (pendente ou vencido)". Em `cenarios.md`, "RF11", nenhum cenário quebra se a implementação consumir pelo tamanho da seleção (`usuarioIds.length`) ou por todos os professores da escola.
   - O "lote de 40 com 30 restantes" passa do mesmo jeito.
   - O caso da "seleção que mistura" confere a fila e a contagem, mas não a cota.
   - É defeito real: a coordenação seleciona 400 professores, só 40 estão pendentes, e ela recebe 429.
   - **Correção exigida:** pôr no [I] da seleção mista uma cota só do que entra. Por exemplo: seleção de 6, com 2 pendentes ou vencidos e 4 aceitos, revogados ou desativados, e 2 pontos restantes na cota. O lote passa, e depois sobram 0 pontos.

**Recomendações.**
- **`aud` sozinha no [U] do bilhete.** No código que existe (`apps/api/src/sessao/convite/convite-ticket.ts`), o bilhete do convite se separa do desafio por `typ` e por `aud`, com a mesma chave. Se o bilhete novo seguir esse padrão, o [U] continua vermelho mesmo sem a checagem de `aud`, porque o `typ` já recusa: a `aud` não fica provada sozinha.
  - Dizer na §5 "`typ` e `aud` próprios, mesma chave".
  - No [U], assinar um token com o `typ` do bilhete e a `aud` do desafio, e o inverso.
  - Pôr também a direção contrária: o bilhete não vale como desafio, como bilhete de convite nem como token de acesso.
- **Papel da `.gerada` no arquivo do titular.** O papel vem do `depois`. Em "Arquivo do titular (D85)", fazer a `.gerada` por um professor: se o teste usar só a coordenação, uma leitura com "coordenação" fixa para todas as ações passa.
- **Auditoria sem usuário ativo.** A §5 diz "sem usuário ativo, nenhum". Pôr um caso: o link foi emitido e o usuário foi desativado antes do redefinir ou do verificar. O resultado esperado é sem 500 e sem registro, e a spec precisa dizer se o redefinir passa ou é recusado.
- **Barreira nos [P] que provam trava.** "Dois 'gerar'", "Gerar × ligar" e "Dois lotes de 200" dependem da ordem de chegada das chamadas.
  - Com uma barreira entre a checagem e a gravação, como o SMTP falso já usa, o caso fica vermelho sempre que a trava for removida, e não só às vezes.
  - Sem a barreira, o teste só pega a falta da trava se a ordem ajudar, o que conta como teste que só passa com a máquina folgada.
- **`CONFLITO` e as cotas.** Dizer se o `CONFLITO` de 10 s gasta ponto das cotas de 60/h e de 5/dia, e pôr o caso. O clique duplo do professor não deveria gastar ponto do dia do aluno.
- **Métricas e fila.** A §8 cita métrica de adiamento e de provisórias por escola e a vaga `vaga:normal:sistema`, e nenhum cenário as cobre. Vale um [I] que leia a métrica, como o `apps/realtime/test/metrics.int.test.ts`, e outro que mostre o job da conta ocupando a vaga própria.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/revisao-spec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/docs/lgpd.md

```
VEREDITO: REPROVADO
Cenários exigidos: os seis bloqueantes da rodada 2 (homônimos; [P] aprovar × ligar; verificar com conta de duas escolas e aceite só na escola do convite; troca com a provisória vencida; adiar mais que as tentativas; configuração do e-mail, fragmento, no-store, semáforo, releitura de 5 s) e as cláusulas novas da §5: cota de 300/h atômica e devolvida; CONFLITO de 10 s de qualquer autor; aud própria do bilhete; papel fixo por ação nas quatro da F2; contexto por escola na auditoria anônima.
Cobertos: os seis bloqueantes da rodada 2; CONFLITO de 10 s ([P] do mesmo autor e de autores diferentes, e depois de 10 s); aud ([U] do desafio recusado como bilhete); papel fixo (autor eliminado); auditoria anônima (A e B, B desativado, aceite só na B); a cota em parte (429 inteiro, 40 com 30, rollback, [P] de dois lotes de 200, a outra escola segue).
Bloqueantes: 1) Tech Spec §5 "Enviar", "um ponto por convite que entra (pendente ou vencido)": nenhum cenário em cenarios.md "RF11" quebra se a cota for consumida pelo tamanho da seleção. Correção: no [I] da seleção mista, cota de 2 restantes, seleção de 6 com 2 pendentes ou vencidos e 4 aceitos, revogados ou desativados: o lote passa e a cota zera.
Recomendações: [U] do bilhete com typ e aud separados, um de cada vez, e a direção contrária (bilhete como desafio, como bilhete de convite e como token de acesso); a .gerada feita por professor em "Arquivo do titular"; caso "sem usuário ativo, nenhum" (usuário desativado entre o link e o redefinir ou o verificar); barreira nos [P] que provam trava (gerar × gerar, gerar × ligar, lotes de 200); dizer se o CONFLITO gasta ponto das cotas de 60/h e 5/dia; [I] das métricas novas da §8 e da vaga:normal:sistema.
```

## infra-guardian · 3ª rodada · REPROVADO · 2026-11-07 10:54:37 · `tasks/prd-acesso-e-convites/revisao-spec.md`

VEREDITO: REPROVADO
Caminho quente tocado: login | fila | migration
Rate limit: ok
Fila e prioridade: problema
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok

**O bloqueante da rodada 2 (cota de 300/h do "Enviar"): resolvido.** A Tech Spec §5 "Enviar" diz que a cota consome um ponto por convite que entra (pendente ou vencido), de uma vez e atômico. Diz também que o lote recusado e a transação desfeita devolvem os pontos. Os cenários pedidos existem: no `cenarios.md`, RF11 tem o [I] do lote de 40 com 30 restantes e da transação desfeita, e o [P] dos dois lotes de 200; na tabela "Corridas" há a linha "Dois Enviar disputando a cota". Faltou uma das quatro coisas exigidas: o comportamento com o Redis fora não está na §5. Ele aparece só no `docs/lgpd.md`, na linha "Contadores do acesso": "no Redis de fila ou no seguro em memória". Aceito por isso, e a frase fica como recomendação.

**Bloqueantes:**

1. **A saída de "adiar sem gastar tentativa" não diz o que acontece com a vaga da escola nem com o estado do job.** Está na Tech Spec §2 (linha `job-executor.ts`) e §5 "E-mail", e no `cenarios.md`, RF11, caso "`EMAIL_POR_MINUTO` estourado […] adiado mais vezes que o número de tentativas".
   - **O problema.** O `esperarVaga`, que a spec usa de modelo, roda *antes* de o job tomar a vaga e de ser marcado `ativo`. O adiamento do e-mail acontece *dentro* do processador, quando três coisas já aconteceram:
     - o job já tomou a vaga `vaga:normal:{escola}` (ou `vaga:normal:sistema`);
     - o `iniciarExecucao` já marcou a linha `ativo`;
     - o `uso.marcar('jobs')` já contou a tentativa.
   - **O efeito.** Uma vaga que não é liberada vale 60 s (`VALIDADE_DA_VAGA_MS`), e o `tomar` devolve a vaga ao mesmo job quando ele volta. Basta o `EMAIL_POR_MINUTO` estourar, ou a reserva de outro processo continuar vigente, para cinco convites adiados ocuparem as cinco vagas da fila `normal` da escola. Isso pode durar vários minutos, porque agora o adiamento passa do número de tentativas. Nesse tempo, a correção que o professor pediu agora fica parada. Viola a regra 80, item 3.
   - **Segundo problema.** Se o adiamento usar a espera fixa de 1 s do `esperarVaga`, cada volta grava `ativo` no Postgres e consome do Redis uma vez por segundo, por job, enquanto a cota não abre.
   - **Correção exigida na §5 (ou §2):** a saída de adiar
     - para a renovação e libera a vaga;
     - devolve a linha a `publicado` (sem `ativo`);
     - não marca `uso.marcar('jobs')`;
     - espera o `msBeforeNext` do `EMAIL_POR_MINUTO`, ou o prazo da reserva de outro processo, com variação aleatória. Nunca a espera fixa de 1 s.
   - **Cenários a acrescentar no `cenarios.md`, RF11:**
     - [I] Escola com limite `normal` = 1 e um `email.enviar-convite` adiado: outro job `normal` da mesma escola roda sem esperar a validade da vaga. O mesmo para o `vaga:normal:sistema` com o `sistema.enviar-email-da-conta`.
     - [I] Job adiado: a linha volta a `publicado` e o contador `jobs` da escola não muda.

**As outras mudanças da rodada:**
- **"Adiar mais vezes que as tentativas":** a ideia está certa. O limite de tempo continua dado pelo expurgo, que grava `falhou` depois de 24 h, e pelo alerta de idade da fila. O defeito é só o do bloqueante 1.
- **Releitura de 5 s em Professores:** só lê com a aba visível e com linha `na_fila` ou `enviando`. O `GET /v1/professores` é paginado (`paginationQuerySchema`) e conta no limite do usuário e no da escola. Não pesa na carga.
- **`rl:ip:senha` no Redis de fila, pelo HMAC do IP:** o "esqueci" segue limitado pelo HMAC do e-mail (3/h) e responde 202 sem envio, nunca 429. Não bloqueia o login. Nada a exigir.
- **`EMAIL_POR_MINUTO` sem o seguro em memória:** a §5 e o cenário "Redis de fila fora: adiado, nenhum envio" estão certos.
- **`CONFLITO` de 10 s de qualquer autor:** a §5 e o [P] de autores diferentes em "Senha provisória" resolvem a recomendação.

**Recomendações:**
- Tech Spec §5 "Enviar": escrever o que acontece com o Redis fora, por exemplo "Redis fora: o seguro em memória, 300 ÷ instâncias". Acrescentar um [I] em RF11. O `RateLimiter` de hoje vive no Redis de cache e trabalha com janela de 1 min. A cota de 300/h, no Redis de fila e com janela de 1 h, pede um limitador novo, e a spec deveria dizer isso para ninguém reaproveitar o `#escola`.
- Tech Spec §7c, "Dependência cai": com o Redis de fila fora, o `moveToDelayed` também falha. Vale uma linha dizendo que o job fica como travado (stalled) no BullMQ e é retomado pelo registro no Postgres, sem virar `falhou`.
- Tech Spec §9: a recomendação da rodada 2 continua aberta. Pôr um teto na releitura de 5 s, com intervalo crescente ou parada depois de alguns minutos. Uma linha pode ficar `na_fila` por muito tempo enquanto o `EMAIL_POR_MINUTO` adia.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/docs/lgpd.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/apps/worker/src/job-executor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/packages/core/src/queue/escola-concurrency-limiter.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/packages/core/src/rate-limit/rate-limiter.ts

## infra-guardian · 4ª rodada · APROVADO · 2026-11-07 10:56:12 · `tasks/prd-acesso-e-convites/revisao-spec.md`

VEREDITO: APROVADO
Caminho quente tocado: login | fila
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok
Bloqueantes: nenhum. A correção exigida na rodada 3 foi feita.
- Tech Spec §5 "E-mail": adiar libera a vaga, devolve a linha a `publicado`, não conta tentativa nem uso, e espera o `msBeforeNext` ou o prazo da reserva, com variação aleatória.
- `cenarios.md` RF11 tem os dois [I] pedidos. O primeiro é a escola com limite `normal` = 1 cujo outro job roda sem esperar, também na `vaga:normal:sistema`. O segundo é a linha que volta a `publicado`, com o contador `jobs` intacto e espera que nunca é de 1 s fixo.
- O adiamento não entra em conflito com a reconciliação de hoje. O despachante só republica o job se a fila confirmar que não o tem, e o job adiado continua na fila com o mesmo id.
- As recomendações da rodada 3 entraram:
  - a cota de 300/h é um limitador novo no Redis de fila, com seguro em memória de 300 ÷ instâncias e o [I] correspondente;
  - Redis fora aparece no §7c;
  - a releitura de 5 s para em 5 min (§9 e o [U] de "Telas").

Recomendações:
- Tech Spec §5 "E-mail": o job consome o ponto do `EMAIL_POR_MINUTO` antes de reservar a linha. Se a linha tem reserva alheia vigente, ou já está `enviado` ou `cancelado`, o ponto se perde e o envio não sai. Reservar antes de consumir, ou devolver o ponto nesses casos, evita que uma rajada de reentregas esgote o teto global sem mandar e-mail.
- Tech Spec §5 "E-mail": com o Redis de fila fora não existe `msBeforeNext`. Vale dizer qual é a espera nesse caso (um piso fixo com variação aleatória) para o implementador não inventar uma.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/packages/core/src/queue/dispatch.repository.ts (a reconciliação conferida contra o adiamento)

## test-engineer · 4ª rodada · REPROVADO · 2026-11-07 10:56:21 · `tasks/prd-acesso-e-convites/revisao-spec.md`

VEREDITO: REPROVADO

Cenários exigidos: o bloqueante da rodada 3 (a cota de 300/h conta o que entra, não a seleção) e as cláusulas novas desta rodada. As da Tech Spec §5 "E-mail": adiar libera a vaga, a linha volta a `publicado`, não conta tentativa nem uso, a espera é o `msBeforeNext` ou o prazo da reserva com variação aleatória, e Redis fora adia sem enviar. A do §5 "Enviar": limitador novo no Redis de fila, janela de 1 h, consumo atômico, devolução no 429 e no rollback, e seguro em memória com o Redis fora. Também conferi as recomendações adotadas na rodada 3: `typ` e `aud` um de cada vez, `.gerada` por professor no arquivo, usuário desativado entre o link e o redefinir, barreira nos [P] de trava, `CONFLITO` sem gastar cota, métricas, `vaga:normal:sistema` e a releitura de 5 s que para em 5 min.

Cobertos:
- **Bloqueante da rodada 3, resolvido.** Em `cenarios.md`, "RF11", está o caso da seleção mista: 6 selecionados, 2 que entram e 2 pontos restantes, e a seleção passa. Se a cota contasse a seleção, seriam 6 pontos contra 2 restantes, e o resultado seria 429. Se não consumisse nada, a asserção "a cota zera" quebraria. Os dois erros fazem o cenário falhar.
- **Libera a vaga:** o [I] "Escola com limite `normal` = 1 e um `email.enviar-convite` adiado…", com o par `vaga:normal:sistema`.
- **Volta a `publicado` e não conta uso:** o [I] "Job adiado: a linha volta a `publicado`, o contador `jobs` da escola não muda…".
- **Não conta tentativa:** o [I] "`EMAIL_POR_MINUTO` estourado… adiado mais vezes que o número de tentativas…".
- **Redis fora adia sem enviar:** a segunda frase desse mesmo [I].
- **Prazo da reserva:** o [P] "Reentrega com a reserva de outro processo ainda vigente".
- **Limitador novo:** o [I] 40 contra 30 restantes, a devolução no rollback, o [P] de dois lotes de 200 e o [I] do seguro em memória com o Redis fora.
- **Recomendações da rodada 3:** todas presentes ("RF13", "RF14", "Auditoria e dado", "Arquivo do titular", "Telas").

Bloqueantes:
1. **A variação aleatória da espera não tem cenário que a prove.** Fica em `cenarios.md`, "RF11", no [I] "Job adiado: … a espera é o `msBeforeNext` (ou o prazo da reserva), nunca 1 s fixo", contra a Tech Spec §5 "E-mail", em "espera o `msBeforeNext` ou o prazo da reserva, com variação aleatória".
   - Do jeito que o cenário está escrito, uma asserção de igualdade ao `msBeforeNext` contradiz a própria variação.
   - Uma asserção de "pelo menos o `msBeforeNext`" passa com a variação apagada. A cláusula é nova e nenhum cenário quebra se ela sair. Ela é regra de carga (regra 80): sem a variação, todos os jobs adiados acordam juntos quando a janela abre.
   - Correção exigida: um [U] com a fonte de aleatoriedade injetada.
     - Com o sorteio no mínimo, a espera é o `msBeforeNext` (nunca menos). Com o sorteio no máximo, é o `msBeforeNext` mais o teto da variação. Dois sorteios diferentes dão esperas diferentes, e o mesmo vale para o prazo da reserva.
     - O [I] passa a dizer "entre o `msBeforeNext` e o `msBeforeNext` mais o teto da variação". A Tech Spec §5 "E-mail" diz qual é esse teto.

Recomendações:
- **Seleção mista, "a cota zera":** dizer como se observa. Por exemplo, logo depois, um "Enviar" de 1 pendente recebe 429. Assim o teste não depende de ler a chave do Redis.
- **[P] "Dois 'Enviar convites' ao mesmo tempo":** afirmar também a cota. Quem perde o `convite_pendente_unico` só consome pelo que de fato ficou na fila. Hoje a devolução no rollback está provada só no caso genérico.
- **Janela de 1 h do limitador novo:** um [I] com relógio falso. A cota se esgota, depois de 59 min continua 429 e depois de 61 min volta a passar. Hoje nenhum cenário quebra se a janela virar um dia.
- **"Redis de fila fora: adiado, nenhum envio":** completar com o que a Tech Spec §7c promete. Nada vira `falhou`, e quando o Redis volta o job é retomado e envia uma vez.
- **Seguro em memória "300 ÷ instâncias":** dizer de onde vem o número de instâncias no teste (configuração injetada). Sem isso, o [I] não tem como errar a divisão.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/cenarios.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/revisao-spec.md

## test-engineer · 5ª rodada · APROVADO · 2026-11-07 10:57:37 · `tasks/prd-acesso-e-convites/revisao-spec.md`

VEREDITO: APROVADO

Cenários exigidos (desta rodada):
- O bloqueante da rodada 4: a variação sorteada da espera precisava de teto e de cenário que quebre se o sorteio sumir ou se o teto for apagado.
- A cláusula nova da Tech Spec §5 "E-mail", "Ponto sem envio volta", precisava de cenário que fique vermelho quando a regra for apagada.
- As recomendações da rodada 4 que o documento diz ter adotado.

Cobertos:
- **Bloqueante da rodada 4: resolvido.**
  - A Tech Spec §5 "E-mail" agora fixa a base (o `msBeforeNext`, o prazo da reserva ou 30 s com o Redis fora) e o teto ("mais até 5 s sorteados").
  - O cenarios.md, em "E-mail, convite e posse", RF11, tem um [U] com o sorteio injetado. Ele confere o mínimo e o máximo nas três bases e a regra "dois sorteios diferentes, esperas diferentes".
  - O [U] fica vermelho nas três mutações que importam: tirar o sorteio (cai a regra das esperas diferentes), tirar o teto ou aumentá-lo (cai o máximo) e trocar a base, por exemplo por 1 s fixo (cai o mínimo).
  - O [I] "Job adiado" repete a faixa com o worker de verdade e mantém o "nunca 1 s fixo".
  - O [P] "Reentrega com a reserva de outro processo" ("adia até o prazo") não contradiz a regra nova, porque o [U] cobre o prazo da reserva mais o sorteio.
- **"Ponto sem envio volta": tem cenário.** É o [I] "Ponto do `EMAIL_POR_MINUTO` consumido e a linha com reserva alheia, `enviado` ou `cancelado`" (RF11).
  - Ele confere duas coisas: que o ponto volta e que a vaga do minuto segue para o envio seguinte.
  - Se a devolução for apagada, o ponto fica consumido e a primeira conferência falha. Cobre os três caminhos em que o ponto é consumido antes da reserva da linha e não há envio.
- **Recomendações da rodada 4: todas estão no cenarios.md.**
  - "A cota zera" é observada por um 429 seguinte (RF11, seleção mista).
  - A janela de 1 h é testada com relógio falso, 59 min contra 61 min.
  - Com o Redis fora, o job é adiado sem virar `falhou` e é retomado com um envio só.
  - O número de instâncias é injetado no seguro de 300/h.

Bloqueantes: nenhum

Recomendações:
1. **Fixar o teto no limite no [I] "Ponto ... volta" (cenarios.md, RF11).** Usar `EMAIL_POR_MINUTO` igual a 1 (ou com o minuto já cheio menos um) no teste. Assim "a vaga segue para o envio seguinte" fica vermelho sozinho quando a devolução some. Com folga no teto, só a leitura do contador no Redis pega a mutação, e isso é asserção sobre a parte interna, não sobre o efeito.
2. **Cobrir o link da conta no mesmo [I].** Repetir o cenário com o `sistema.enviar-email-da-conta`, cuja vaga é a metade reservada ao link da conta. A devolução pode ser escrita num processador e esquecida no outro.
3. **Ponto devolvido depois da virada do minuto (Tech Spec §5 "E-mail").** Se a janela já virou quando o ponto volta, a devolução desconta da janela nova e deixa um envio a mais que o teto. Isso contradiz o [P] "o número exato de envios é o teto". Vale escrever que só se devolve na mesma janela (ou aceitar a sobra por escrito) e pôr um [I] com relógio falso que consome no segundo 59 e devolve no minuto seguinte.
4. **Dizer na §5 se SMTP 4xx, 5xx e queda contam como envio para o ponto.** A frase "Ponto sem envio volta" deixa em aberto se a tentativa recusada pelo provedor devolve o ponto. Pela intenção, ela conta, porque o provedor também contou. Escrito, o Implementador não devolve o ponto nesses casos por engano.

Arquivos: /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/techspec.md (§5 "E-mail"), /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites/tasks/prd-acesso-e-convites/cenarios.md ("E-mail, convite e posse", RF11).
