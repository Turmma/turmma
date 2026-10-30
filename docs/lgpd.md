# LGPD — documento de referência do Turmma

> **Leia isto antes de escrever qualquer código que toque dado de pessoa.**
> Não é anexo jurídico. É especificação técnica.

Quase todo titular aqui é **menor de idade**. O art. 14 da LGPD trata dado de criança e
adolescente com proteção reforçada e exige que o tratamento seja feito **no melhor
interesse do titular**. Vazamento nesse contexto não é incidente comum: é manchete,
notificação à ANPD, e fim do contrato com toda rede que nos conhecia.

SaaS de educação não costuma morrer por falta de funcionalidade. Morre por vazamento.

---

## 1. Papéis

| Papel | Quem | O que significa |
|---|---|---|
| **Controladora** | A escola (ou a rede) | Decide por que e como os dados são tratados. Responde pelo consentimento dos responsáveis. |
| **Operador** | Nós | Tratamos **apenas** conforme instrução da escola, registrada em contrato. |
| **Suboperador** | Provedor de IA, hospedagem, e-mail, provedor de busca (D68) | Só entram com contrato que replique nossas obrigações. Conversa de aluno só em provedor com processamento no Brasil (D62). |

**Ser operador não nos tira do ECA Digital.** A LGPD distribui responsabilidade entre
controlador e operador; a Lei 15.211/2025 fala de "fornecedor de produto ou serviço de
tecnologia da informação direcionado a crianças e adolescentes", e isso somos nós,
independente de quem contrata. As obrigações da seção 2 de `docs/regulacao.md` — privacidade
máxima por padrão, gerenciamento de risco, relatório de impacto, canal de denúncia,
transparência do caráter sintético da IA — recaem sobre nós **diretamente**, e nenhuma
cláusula de contrato com a escola as transfere.

Consequência prática: **não inventamos finalidade nova.** Usar dado de aluno para algo que
não está no contrato com a escola — inclusive melhorar nosso produto ou treinar modelo —
exige nova base legal e nova instrução. Na dúvida, não use.

---

## 2. Mapa de dados

Todo campo pessoal do sistema precisa estar nesta tabela. Campo que não está aqui não
deveria existir.

| Dado | Titular | Finalidade | Base legal (via escola) | Retenção |
|---|---|---|---|---|
| Nome | aluno | identificar na turma | execução de contrato educacional | enquanto a pessoa estiver ativa na escola; desativada, 60 meses (ajustável por escola, de 12 a 60), e então o expurgo noturno elimina o cadastro pelo ciclo de vida (categoria `pessoa_desativada`, F3, tarefa 5.0). O que o registro escolar manda guardar por mais tempo depende do parecer do advogado (PRD do F3, seção 10) |
| Matrícula | aluno | login e vínculo | idem | idem |
| Turma, série, disciplina | aluno | contexto pedagógico | idem | idem |
| Identificador opaco da conta Google ou Microsoft da escola (`conta_externa`: provedor, `sub` no Google, `oid` e `tid` na Microsoft; nunca e-mail, nome nem foto, que o login descarta antes de gravar e nunca loga) | aluno, professor | login e importação de turma (D48) | execução de contrato | enquanto houver vínculo: sai quando a escola desativa ou elimina o usuário, ou desliga a conta (17.0) |
| Resposta de avaliação e de atividade (no MVP, `resposta_atividade`: a alternativa marcada em cada questão objetiva, sem texto, e a `sequencia`, a ordem das escolhas na questão, que só existe para a escolha mais nova valer e entra no arquivo do titular; e `tentativa_atividade`: quando o aluno abriu e quando enviou) | aluno | correção e devolutiva | execução de contrato educacional | 12 meses do encerramento do ano letivo (ajustável por escola, de 6 a 60): o expurgo noturno da escola apaga a tentativa, e a resposta e a correção saem com ela (`on delete cascade`; categoria `trabalho_do_aluno`, F3, tarefa 5.0); o ano `em_curso` ou `planejado` nunca perde nada, mesmo com o `fim` vencido. Sai de fato com a eliminação do aluno, na mesma transação |
| Diagnóstico por habilidade (no MVP, `correcao`: acertos, total e questões em branco, o acerto por código de habilidade e os motivos de destaque, de lista fechada; sem nota, conceito nem texto sobre o aluno. O aluno só o alcança depois de o professor aprovar o lote; a coordenação lê o da turma com finalidade e auditoria, `turma.desempenho_lido`) | aluno | acompanhamento pedagógico formativo (D46) | idem | a correção sai junto com a tentativa, pelo mesmo prazo do trabalho do aluno (12 meses do encerramento do ano letivo, ajustável de 6 a 60; F3, tarefa 5.0); sai com a eliminação do aluno |
| Nota | aluno | registro escolar | obrigação legal da escola | conforme norma da escola |
| Conversa com o tutor (no MVP, `mensagem_tutor`: o que o aluno escreveu e o que o Tutor respondeu, com a turma e em que ele estava — a atividade e o número da questão, ou o material e a página —; **é o único lugar onde o texto do aluno fica**: não é copiado para `execucao_agente` nem para `consumo_ia`) | aluno | aprendizagem e supervisão docente | legítimo interesse da escola em supervisão pedagógica | 12 meses (ajustável por escola, de 6 a 24), contados de cada mensagem: apagada pelo expurgo noturno da escola (`retencao.expurgar-escola`, F3); sai com a eliminação do aluno. Nesta fatia o **texto** só o próprio aluno lê; o professor da turma vê o **uso**, sem o texto (linha abaixo) |
| Uso do Tutor por aluno, para o professor da turma (`GET /v1/tutor/uso`, lido de `mensagem_tutor`: as trocas do dia, a hora da última troca e em que o aluno estava nela — atividade e questão, ou material e página. **Sem conteúdo de conversa, sem tempo ocioso e sem histórico de navegação**: só a referência da última troca, e só de quem usou) | aluno | supervisão docente: não existe uso do Tutor invisível ao professor (D8, D47; regra 70, item 4) | legítimo interesse da escola em supervisão pedagógica | não é dado novo: é leitura da conversa, e segue os 12 meses dela. Só o professor com vínculo confirmado na turma lê; a coordenação vê a soma da escola, por função |
| Sinais de uso de IA (no MVP, `sinal_tutor`: um tipo de lista fechada — travou, pediu a resposta pronta, repetiu a dúvida — e a referência ao trabalho: atividade e questão, ou material e página. **Sem coluna de texto**) | aluno | supervisão docente | idem | 12 meses (ajustável por escola, de 6 a 24), contados de cada sinal: apagado pelo expurgo noturno da escola (F3); sai com a eliminação do aluno. Nomeado só ao professor da turma (D34) |
| Adaptação pedagógica necessária (ex.: linguagem direta, fonte ampliada, tempo extra), sempre como **tipo de adaptação** — **nunca diagnóstico nem texto livre sobre o aluno** (D35, D67) | aluno | adaptar prova, atividade e material (função de adaptação do Assistente de ensino) e ajustar a forma da conversa do Tutor, nunca o que é cobrado (D66) | dado sensível (art. 11), via obrigação da escola com inclusão; **a confirmar com advogado** | enquanto houver vínculo; revista a cada ano letivo |
| Memória do Tutor: alcança **toda a trajetória do aluno no sistema** (respostas, diagnóstico, devolutiva do professor, sinais e o resumo de cada sessão em formato fixo: assunto, habilidade, exercício, onde travou, como terminou). É leitura de dados que já estão neste mapa, mais o resumo de sessão; **não existe texto sobre o jeito, o humor ou o comportamento do aluno**, escrito por modelo ou por pessoa (D66) | aluno | orientar o estudo de forma individual; o aluno vê e contesta | legítimo interesse da escola em supervisão pedagógica; perfil acadêmico individual é alto risco no CNE: AIA antes de existir | cada dado segue a própria retenção; o resumo de sessão segue a conversa (12 meses) |
| Contexto do Tutor informado pelo professor: por turma (conteúdo atual, lista ativa, foco da semana) e por aluno (**habilidades a reforçar, escolhidas da lista; sem texto livre**) (D66) | aluno | direcionar o Tutor | execução de contrato educacional | ano letivo |
| Busca do Tutor: a consulta **escrita pelo modelo** e as fontes que o aluno abriu (D68) | aluno | supervisão docente e letramento em pesquisa | legítimo interesse da escola em supervisão pedagógica | 12 meses, como a conversa |
| Saída da aba durante avaliação: contagem **por avaliação**, nunca somada por aluno (D70) | aluno | integridade da avaliação, mostrada só ao professor da turma, com o aluno avisado antes | execução de contrato educacional; **a confirmar com advogado** | segue a resposta da avaliação (ano letivo + 1 ano); no registro da validação entra só que o destaque foi apresentado e aberto |
| Sinal "precisa de atenção humana" (sem conteúdo: no MVP o banco recusa, nesse sinal, a atividade, a questão, o material e a página) | aluno | encaminhar a um humano o aluno que pediu ajuda pessoal | proteção do titular, melhor interesse (art. 14) | 12 meses |
| Nome, e-mail | professor, coordenador | acesso e responsabilidade | execução de contrato | vigência + 5 anos |
| Indicadores de uso e das turmas do professor | professor | apoio pedagógico ao próprio professor e visão agregada da coordenação; **nunca decisão sobre o professor** (D45) | execução de contrato; **a confirmar com advogado** (CLT, convenção coletiva, estatuto do servidor) | ano letivo + 1 ano (proposta) |
| Conversa do professor com o chat (no MVP, `thread_agente` e `mensagem_agente`: o que ele escreveu ao Assistente de ensino, com a turma e a disciplina, e o que o Assistente respondeu) | professor | produzir o que ele pediu | execução de contrato | 12 meses (proposta; ajustável por escola, de 3 a 24), contados de cada mensagem: apagada pelo expurgo noturno da escola (F3), e a thread vazia sai junto; nunca visível à coordenação: nenhuma rota nem célula da matriz a entrega a outra pessoa; sai com a eliminação do professor |
| Nome, e-mail, telefone | responsável | comunicação escolar | execução de contrato | vigência do vínculo |
| Hash de senha (argon2id) | aluno, professor, coordenador | autenticar (F1) | execução de contrato; segurança (art. 46) | até desativar a credencial: o do aluno sai na desativação dele na escola (a matrícula fica); o da conta da equipe, na limpeza da conta (17.0) |
| E-mail de login na conta global | professor, coordenador | autenticar em uma ou mais escolas (F1) | execução de contrato | enquanto houver `usuario` ativo em alguma escola (ou convite ainda válido para um): quando não há mais, a limpeza da conta (17.0) apaga e-mail, senha e segundo fator na mesma transação da desativação ou da eliminação, ou, se um convite a segurava, na madrugada seguinte ao vencimento ou à revogação dele (`sistema.expurgar-acesso`), e a linha fica só com o id; a eliminação pedida por uma escola apaga só o `usuario` dela |
| Segredo TOTP cifrado e HMAC dos códigos de recuperação | coordenador | segundo fator (F1) | execução de contrato; segurança (art. 46) | até desativar a conta ou redefinir o MFA |
| Sessão (horários de início, uso e fim, método, motivo de encerramento, hash do cookie de renovação atual e anterior, família da sessão e conta; sem IP nem nome) | todos | manter e encerrar o acesso, inatividade (F1) | execução de contrato | 30 dias após encerrar ou, sem encerramento, após expirar; apagada pelo `sistema.expurgar-acesso` (17.0), de madrugada |
| Contador de tentativas de login (HMAC do identificador) | todos | proteção contra força bruta (F1) | legítimo interesse, segurança | 15 minutos |
| Contadores por IP do login (HMAC do IP, e da escola na matrícula; só o número de tentativas ou falhas no minuto) | todos | rebaixar, sem recusar, a prioridade de login de um IP com falhas demais numa escola ou acima do limite da rota de e-mail (F1, tarefa 15.0) | legítimo interesse, segurança (art. 46) | 1 minuto |
| Escolha pendente da prova no navegador (`sessionStorage`, uma chave por atividade: o id da atividade, o número da questão, o índice da alternativa, a `sequencia` e o identificador opaco do aluno da sessão, como `dono`; nunca nome, enunciado, texto nem o e-mail; lido por esquema estrito, e o que não passa ou é de outro `dono` é apagado e nunca mandado nem mostrado) | aluno | a escolha que o servidor ainda não confirmou sobreviver ao F5, à aba reaberta e à sessão que venceu com o mesmo aluno, sem perder resposta de prova (regra 80, item 6; 53.0) | execução de contrato educacional | até o servidor confirmar a escolha, o "Sair" ou a suspensão (apagam o de todas as atividades), a entrada de outra pessoa (a casca apaga o dos outros donos assim que o `/v1/eu` dela chega) ou o fechamento da aba sem reabrir, o que vier primeiro (o Chrome devolve o `sessionStorage` à aba reaberta, e quem a reabre é o mesmo navegador: vale a regra do dono); a sessão vencida **não** apaga, de propósito. Fica só no navegador, nunca no servidor, em `localStorage`, em URL ou em log |
| Cookie de dispositivo (até 50 HMACs com chave de escola+matrícula ou de e-mail que já entraram naquele navegador, sem nome; o servidor não guarda nem lê identidade a partir dele; o do operador Turmma usa chave própria, A0) | aluno, professor, coordenador, operador Turmma | manter a prioridade de login de quem já entrou quando há ataque na rede da escola (F1); nenhum outro uso | legítimo interesse, segurança (art. 46), no melhor interesse do titular (art. 14) | 30 dias por entrada, no navegador |
| Vínculo, estado e datas (desde a 13.0 da A1, o `pendente` pode existir para o professor com convite em aberto: não dá acesso antes do aceite e da confirmação, e sai na eliminação do usuário) | professor, aluno | acesso por objeto (F1) | execução de contrato | 60 meses depois do encerramento do vínculo (ajustável por escola, de 12 a 60): apagado pelo expurgo noturno da escola (categoria `vinculo_encerrado`, F3, tarefa 5.0); o vínculo ativo, pendente ou contestado nunca sai por prazo, só com a eliminação da pessoa |
| Motivo de contestação de vínculo (código e complemento de até 140 caracteres, sem nome de aluno) | professor | corrigir a alocação (F1) | execução de contrato | complemento: apagado na virada do ano letivo, na mesma transação do encerramento (10.0); código: fica com o vínculo, como já fica na auditoria `vinculo.contestado`, porque é o que impede o vínculo nunca aceito de abrir o ano encerrado; o complemento nunca em log nem em auditoria |
| Lista de nomes da turma (nome, matrícula, estado; a matrícula com forma de CPF ou de data é recusada pela API, na lista e no avulso, para o CPF e a data de nascimento não entrarem como matrícula (regra 20, item 2; correção `2026-10-03-trava-de-documento-so-na-tela`); aprovado, só o estado e o usuário, sem nome nem matrícula, que passam a viver no usuário e na credencial; quem gravou, que vira nulo se a pessoa for eliminada, e a auditoria guarda o id) | aluno, antes de ser usuário | o aluno reivindicar o próprio nome (A1, D3, D4). Os nomes livres, sem matrícula, aparecem a qualquer pessoa com o link ou o código vigente da turma | execução de contrato educacional | livre e reivindicado sem decisão: apagados no encerramento do ano letivo, na mesma transação; aprovado: sai junto com o usuário na eliminação, na mesma transação |
| Reivindicação (estado, datas, turma, quem decidiu e como; o nome escolhido só pela referência à linha da lista, enquanto ela existe; hash da senha enquanto pendente; chave de envio sorteada pelo navegador a cada envio, guardada só na memória da página e que não identifica ninguém; se houve tentativa com matrícula errada naquele nome pelo mesmo acesso da turma, nos 10 minutos até o fim do hash do pedido (as que chegaram junto com ele contam), só sim ou não, só enquanto pendente, sem número, hora nem matrícula tentada, e fora da auditoria da decisão) | aluno e quem decidiu | aprovação humana da identidade do aluno (D4) | execução de contrato | hash da senha, chave de envio e a marca de tentativa com matrícula errada: apagados na decisão ou no encerramento, na mesma transação (sem decisão, o encerramento do ano letivo fecha o pedido pendente como `encerrada`); o resto: 60 meses (ajustável por escola, de 12 a 60) contados da decisão, ou da solicitação no `encerrada`, que a virada do ano fecha sem decisão, sem nome depois que a linha da lista sai (a referência vira nula); o expurgo noturno da escola apaga o pedido decidido ou encerrado, por qualquer decisor (`professor` ou `coordenacao`), e nunca o `pendente` (categoria `reivindicacao_decidida`, F3, tarefa 5.0); sai junto com o usuário na eliminação do aluno aprovado, na mesma transação. Nada liga o pedido ao navegador nem ao IP: sem IP, sem marcador e sem registro de acesso |
| Acesso da turma: link e código da sala (hash do token, HMAC do código com chave própria, turma, validade, quem gerou) | professor, turma | entrada dos alunos pelo link ou pelo código (A1, P27). O link é de uso múltiplo por desenho: qualquer pessoa com ele, ou com o código, vê os nomes livres da turma; o único é a reivindicação de cada nome | execução de contrato | revogado no encerramento do ano letivo, na mesma transação; revogado também quando termina o último vínculo confirmado de quem o gerou na turma (encerramento pela coordenação, por desligamento ou realocação, ou eliminação do professor), na mesma transação, com `acesso_turma.revogado` (regra 20, item 18; correção `2026-10-03-acesso-sobrevive-ao-vinculo`), e o acesso gerado por outro professor que continua na turma fica (a desativação do professor ainda **não** revoga: ela não termina vínculo, `TODO.md`, F2); 30 dias após vencer ou ser revogado, pelo `sistema.expurgar-acesso`; o link e o código aparecem uma vez, só na resposta que os cria; quem gerou vira nulo se o professor for eliminado (a auditoria guarda o id). Na tela do professor (tarefa 15.0), o link e o código aparecem uma vez, só no diálogo que os pediu, fora do cache de consultas, de URL, de log e de armazenamento do navegador, e saem da tela quando a sessão da aba muda; a tela avisa, antes de o professor mandar, que quem tem o link ou o código vê os nomes livres. O botão do WhatsApp abre o `wa.me` no navegador do professor com um texto que leva só o nome da escola e o link, nunca nome de aluno nem matrícula: é o professor quem manda, e o nosso servidor não envia nada à Meta. O link vai na consulta do endereço do `wa.me`: chega ao servidor da Meta já no clique, e o endereço fica no histórico do navegador do professor enquanto o acesso valer (até 30 dias); "Gerar novo" o derruba na hora, e a tela diz isso |
| Convite de professor (hash do token, datas, tipo) | professor | primeiro acesso do professor cadastrado pela coordenação (A1); na tela Professores, o link aparece uma vez, só no diálogo que o pediu, fora do cache de consultas, de URL, de log e de armazenamento do navegador, e sai da tela quando a sessão da aba muda (tarefa 14.0) | execução de contrato | 30 dias após usar, revogar ou vencer, como o de coordenador; apagado pelo `sistema.expurgar-acesso`, e junto com o usuário na eliminação |
| Contadores da sala (A1): o número de códigos errados por escola, de matrículas erradas por nome livre da lista (por acesso da turma: um código novo começa do zero) e de tentativas que rodaram o hash sem criar pedido, por turma, numa janela de 10 minutos, e a marca de que a linha de log `sala.limite_atingido` daquela escola e daquele tipo já saiu na janela. A chave é HMAC da escola, da turma, do acesso e do id da linha da lista, ou do tipo e da escola. As de escola, de turma e a marca não identificam pessoa; a do nome aponta um aluno só pelo id da linha, sem nome nem matrícula. Nenhum cookie é lido. O log leva só o tipo e o id da escola | aluno | proteção contra força bruta no código da turma e na matrícula (A1); o contador do nome serve também para marcar o pedido pendente daquele nome com "houve tentativa com matrícula errada", só sim ou não, lido no momento do pedido | legítimo interesse, segurança (art. 46) | 10 minutos, no Redis de fila ou no seguro em memória |
| Convite de coordenador (hash do token, datas) | coordenador | primeiro acesso (F1), gerado ou refeito pelo comando do operador ou pelo painel da operação (A0b); no painel, o link aparece uma vez, só no diálogo que o pediu, fora do cache de consultas, de URL, de log e de armazenamento do navegador (tarefa 7.0) | execução de contrato | 30 dias após usar, revogar ou expirar, o que vier primeiro; apagado pelo `sistema.expurgar-acesso` (17.0), e junto com o usuário na eliminação |
| Registro da validação humana de correção (o que foi apresentado ao professor, quais destaques ele abriu, quem confirmou e quando; no MVP, `validacao_do_lote`, que guarda o resumo do lote em números e, dos destaques, só o id do aluno e o motivo de lista fechada, e `correcao.destaque_aberto_por`) | professor, e o aluno do destaque, só pelo id | provar validação efetiva, prévia, qualificada e documentada, exigida pelo CNE (D56) | execução de contrato e obrigação da escola | `validacao_do_lote`: igual à auditoria, vigência + 5 anos, e fica depois da eliminação do professor e do aluno, só com os ids; é ela que prova, pelo `aberto`, quais destaques foram abertos. `correcao.destaque_aberto_por` segue a correção em que está: sai com ela no prazo do trabalho do aluno (categoria `trabalho_do_aluno`, 12 meses do encerramento do ano letivo, ajustável por escola; F3) e com a eliminação do aluno |
| Marca de leitura do lote (no Redis de fila, `atividade:lote-lido:<chave>`: a chave é o hash SHA-256 da escola, do lote e do id do professor que leu a correção; o valor, o hash do que foi apresentado. Nenhum nome, nenhum dado de aluno, nenhum id em claro) | professor | provar que a validação do lote foi efetiva: só aprova quem leu a correção daquele lote, e leu o que fica registrado como apresentado (D56) | execução de contrato e obrigação da escola | 12 horas (expira sozinha, `PX`); a prova durável é a `validacao_do_lote` |
| Decisão sobre entrega da IA (`entrega`: quem aprovou ou rejeitou e quando; e a **justificativa da rejeição**, texto do professor sobre a saída da IA, de 8 a 500 caracteres, com aviso na tela para não escrever sobre aluno) | professor | aprovação humana registrada do que a IA produz, com autor e data (regra 70, item 3; D7) | execução de contrato e obrigação da escola | igual à auditoria: vigência + 5 anos; quem decidiu fica depois da eliminação dele, só com o id. A justificativa nunca vai a log, a auditoria nem à coordenação |
| Autoria de artefato e de aplicação (`artefato.criado_por`; `atividade_aplicada.aplicada_por` e a data: quem levou a atividade gerada pela IA à turma) | professor | o artefato é do professor (D63); aplicar é o ato humano registrado que leva saída de IA ao aluno (regra 70, item 3) | execução de contrato | 60 meses (ajustável por escola, de 12 a 60), contados do `fim` do ano letivo **encerrado**: o expurgo noturno da escola anula `criado_por` (categoria `autoria_de_artefato`, F3, tarefa 4.0), e o ano em curso nunca perde a autoria. O `titulo` e o `conteudo` do artefato são texto livre e podem trazer nome: eles ficam até a troca de nome da eliminação do titular (F3, tarefa 15.0), e anular `criado_por` não anonimiza o artefato inteiro. `criado_por` também vira nulo na eliminação do professor; o artefato fica para a escola, e `aplicada_por` fica, só com o id |
| Execução de agente (`execucao_agente`: quem pediu, a tarefa, o estado, as datas e os parâmetros do pedido — turma, disciplina, tema, tipos de adaptação; **nunca o texto da conversa**, e do resultado só o id do que foi gravado) | professor, aluno, coordenador | rodar o pedido e devolver o resultado só a quem pediu | execução de contrato | 12 meses (ajustável por escola, de 3 a 24, e nunca além da conversa do professor), contados da criação: o expurgo noturno da escola anonimiza a execução (categoria `execucao_agente`, F3, tarefa 4.0): a `entrada` fica só com a tarefa, quem pediu vira nulo e `anonimizada_em` registra quando; a linha, o estado, o resultado (só ids) e o erro ficam, ligados ao que foi gravado e aprovado (regra 70, item 6). A execução do Tutor, pedida pelo aluno, sai também no prazo do consumo por aluno (o menor dos dois), que nunca passa da conversa do Tutor. Quem pediu também vira nulo na eliminação da pessoa |
| Consumo de IA por aluno (`consumo_ia` nas funções do Tutor: o id do aluno com a tarefa, o modelo, os tokens, a duração e o resultado da chamada; e, de toda chamada de IA, `envio_externo` e `provedor` (o id de quem recebeu o conteúdo, a `IA_PROVEDOR_ID`, só quando houve envio externo; nulo no adaptador falso, no modelo local, na regra fixa e na chamada que falhou antes de sair); **`entrada` e `saida` nulas**, por check do banco) | aluno | freio diário por aluno (D38) e custo por aluno (D14); o `provedor` responde à escola e ao titular para onde foi o dado (lista de compartilhamento, LGPD art. 18, VII) | legítimo interesse da escola; segurança de custo | 12 meses (ajustável por escola, de 3 a 24, e nunca além da conversa do Tutor), contados da chamada: o expurgo noturno da escola anula `aluno_id` e, no mesmo prazo, o aluno da execução do Tutor a que o consumo aponta (categoria `consumo_por_aluno`, F3, tarefa 4.0), e a linha e os números da escola ficam. O aluno também vira nulo na eliminação. Não existe consumo por professor: a tabela não tem coluna de usuário (D64). O `provedor` fica com a linha: depois que o expurgo ou a eliminação anula `aluno_id`, ele deixa de se ligar a uma pessoa, e o id do provedor não é dado de pessoa |
| Entrada e saída das chamadas de IA (`consumo_ia.entrada` e `saida`: o que foi ao modelo e o que voltou na geração de atividade e de plano, na adaptação, no relatório da correção e no resumo do Analista: o **tema**, os parâmetros, trechos do material e, na correção e no resumo, números. **Ficam nulas, por check do banco, onde a chamada leva conversa de pessoa**: nas funções do Tutor e na proposta de ferramenta, que recebe a mensagem do professor ao Assistente. **O tema é texto livre do professor**: o schema estrito da tarefa recusa campo fora do contrato, mas não lê o que está escrito, e nada impede um nome ali. Por isso é tratado como conversa do professor) | professor | responder à escola por que a IA disse algo (regra 30, item 4) | execução de contrato | 12 meses (ajustável por escola, de 1 a 12, e nunca além da conversa do professor), contados da chamada: o expurgo noturno da escola anula `entrada` e `saida` (categoria `texto_do_modelo`, F3, tarefa 4.0), e a linha, com os tokens e o custo, fica; nenhuma rota as devolve, e a coordenação vê só a soma de tokens e custo por função. **A eliminação do aluno também troca o nome dele nesses textos** (`entrada` e `saida`; a lista completa das colunas de texto livre está em `COLUNAS_DA_TROCA_DE_NOME`), e o **professor é titular indireto** deles: o texto é trabalho dele, e o aluno citado ali sai pelo nome trocado, sem o professor perder o material (F3, tarefa 15.0) |
| Material da escola (`material`: quem enviou e quem excluiu, e o **licenciante**, o nome do dono do direito quando o material é de terceiro, que pode ser uma pessoa) | coordenador; o licenciante | registrar quem declarou a titularidade e a licença (D5, D75) | execução de contrato; obrigação da escola com o direito autoral | enquanto o material existir; o material **excluído** sai 60 meses depois da exclusão (ajustável por escola, de 12 a 60; categoria `material_excluido`, F3, tarefa 5.0), e só quando nenhuma conversa nem sinal do Tutor ainda o cita (a FK não tem ação; o material citado sai na noite em que a conversa sai); quem enviou e quem excluiu viram nulo na eliminação da pessoa, e a auditoria guarda o id (`material.enviado`, `material.excluido`, `material.recusado`) |
| Suspensão de função da IA (`suspensao_de_funcao`: quem suspendeu e quem retomou, quando, e o motivo de lista fechada) | coordenador | governança de IA da escola (D60) | execução de contrato e obrigação da escola | igual à auditoria: vigência + 5 anos; fica depois da eliminação, só com o id |
| Notificação de violação de direito de criança ou adolescente (quem notificou, o que apontou, o que foi feito) | quem notifica e quem é citado | canal exigido pelo ECA Digital, art. 28, e Decreto 12.880, art. 41 (D61) | obrigação legal | 5 anos; nunca anônima (ECA art. 29, § 2º) |
| Identificador do operador Turmma na auditoria | nossa equipe | prestação de contas à escola | legítimo interesse | vigência + 5 anos |
| Apelido do operador Turmma no ajuste de retenção da escola (`retencao_escola.alterada_por`, com a categoria, os meses, o número do contrato que pede o prazo e quando; nenhuma pessoa da escola) | nossa equipe | prestação de contas à escola sobre quem mudou o prazo de guarda dela, e por qual contrato (F3, RF2) | legítimo interesse; execução de contrato | enquanto o ajuste valer: o ajuste seguinte da mesma categoria troca a linha, e o histórico fica na auditoria da escola (`retencao.ajustada`, vigência + 5 anos) |
| Apelido do operador Turmma no cadastro do suboperador (`suboperador.registrado_por`, com o nome da empresa, o que ela faz, o país, as categorias de dado, o código do contrato, se o contrato veda treinamento e a vigência; nenhuma pessoa da escola) | nossa equipe | prestação de contas da operação: quem, da nossa equipe, cadastrou a empresa que recebe o dado das escolas (o apelido não sai para a escola), e informar o titular sobre o compartilhamento (F3, RF6; LGPD, art. 18, VII) | legítimo interesse; execução de contrato | o suboperador encerrado **não é apagado**: fica como histórico, porque a escola precisa dizer ao titular por onde o dado passou mesmo depois de a empresa sair; o cadastro e o encerramento ficam também na auditoria da operação, sem escola e sem texto livre (`suboperador.cadastrado` e `suboperador.encerrado`, vigência + 5 anos) |
| Registro de incidente de segurança (`incidente`: quando a Turmma soube e o apelido do operador que registrou; `incidente_escola`: por escola afetada, as circunstâncias, as categorias de dado alcançadas, o número estimado de titulares, o risco, a contenção, a correção e quando o aviso ficou visível; **nenhum dado de titular**: nem nome, nem matrícula, nem conversa) | nossa equipe; a escola afetada (só a seção dela) | a escola, como controladora, comunicar a ANPD e os titulares no prazo dela, e provarmos que a avisamos em 24 h da detecção (F3, RF8; LGPD, art. 48; Res. CD/ANPD 15/2024, art. 10) | obrigação legal | 5 anos do registro (Res. CD/ANPD 15/2024, art. 10), apagado pelo `sistema.expurgar-acesso`, que leva a seção de cada escola em cascata; a escola nunca lê a seção de outra, nem o id do incidente; o registro e a confirmação ficam também na auditoria da escola (`incidente.registrado` e `incidente.confirmado`, só com o risco e o número estimado, vigência + 5 anos) **A troca de nome da eliminação do titular não olha estas duas tabelas**: o texto é da nossa equipe e a regra "nenhum dado de titular" é de quem escreve (runbook, "Ao registrar o incidente"), então não há nome de titular ali para trocar (F3, tarefa 15.0) |
| Confirmação do aviso de incidente (`incidente_escola.confirmado_por`, o id do usuário da coordenação que o confirmou, e `confirmado_em`) | coordenador | provar quando a escola soube do incidente e quem recebeu o aviso (F3, RF9) | obrigação legal | 5 anos do registro do incidente; a eliminação da pessoa (F3) mantém a data e anula o id (`on delete set null`), e a auditoria da escola guarda o autor |
| Conta de operador Turmma (apelido, nome, e-mail de login, hash de senha, segredo do segundo fator cifrado, HMAC dos códigos de recuperação) | nossa equipe | entrar no painel da operação (A0, D76) | execução do contrato de trabalho; segurança (art. 46) | até desativar: nome, e-mail, senha, segredo e códigos são apagados na desativação, na mesma transação; o apelido fica, porque a auditoria o cita; cada código de recuperação sai ao ser usado |
| Convite de operador Turmma (hash do token, datas) | nossa equipe | primeiro acesso ao painel (A0) | execução do contrato de trabalho | 30 dias após usar, revogar ou vencer; apagado pelo `sistema.expurgar-acesso` |
| Sessão de operador Turmma (horários de início, uso e fim, motivo do fim — saída, reuso do refresh, desativação ou aceite de convite novo da conta —, hash do cookie de renovação; sem IP) | nossa equipe | manter e encerrar o acesso ao painel: 8 h, ou 30 min sem uso (A0); o aceite de convite novo, que troca a senha, encerra as abertas (A0b, tarefa 9.0) | execução do contrato de trabalho; segurança (art. 46) | 30 dias após encerrar ou, sem encerramento, após expirar; apagada pelo `sistema.expurgar-acesso` |
| Acesso à operação (entrada, falha de entrada e saída, com IP e data; nunca o e-mail digitado) | nossa equipe | segurança do painel e registro de acesso | obrigação legal (Marco Civil, art. 15); segurança | 6 meses, apagado pelo `sistema.expurgar-acesso`; a escola nunca lê |
| Auditoria da operação (autor, ação — operador criado ou desativado, segundo fator configurado, convite de operador gerado, revogado ou aceito —, operador alvo, data; nunca a senha nem o token do convite) | nossa equipe | prestação de contas sobre quem teve acesso ao painel, e quando | legítimo interesse; segurança (art. 46) | vigência + 5 anos, fora do expurgo de acesso |
| Registro de acesso à aplicação (IP, data e hora) | todos | segurança | obrigação legal (Marco Civil, art. 15) | 6 meses, inclusive a falha de login sem escola; apagado pelo `sistema.expurgar-acesso` (17.0); fica depois da eliminação do usuário, com o id |
| Registro do job (`job_registro`: o id, a escola, o tipo e a fila, o estado e as datas, o código tipado da falha e o `dados`, que leva **só ids e parâmetro técnico**: o id do pedido do titular, do material, da execução; nunca nome, matrícula, nota, conversa ou texto, regra 20, item 9; e a cópia `failed` que o BullMQ guarda no Redis de fila, com o código da falha e sem a mensagem de erro) | aluno, professor e coordenação, só pelos ids | provar que o trabalho pedido rodou, medir a fila e avisar o operador do job que falhou de vez (X5, RF18) | execução de contrato; segurança (art. 46) | `concluido`: 7 dias; `falhou`: 30 dias, **salvo `titular.*`, que fica até a ação do operador** (o pedido do titular é enfileirado uma vez só, e a linha é o único rastro de que o arquivo ou a eliminação não saiu); a cópia `failed` no Redis, 7 dias; apagado pelo `sistema.expurgar-jobs`, 5.000 linhas por instrução. |
| Auditoria (quem fez o quê, com finalidade; só ids, estados e datas, e na decisão da reivindicação o `alunoId` que a aprovação criou, o elo que liga o aluno à aprovação da identidade dele na pergunta de fechamento da regra 20) | todos | prestação de contas à escola e ao titular | execução de contrato e obrigação da escola | vigência + 5 anos |
| Pedido do titular (`pedido_titular`: o tipo do pedido, quem pediu — titular ou responsável legal, lista fechada —, quando chegou à escola, o estado, quem registrou, a foto de por quais empresas o dado passou e as marcas de homônimo e de nome trocado; **nenhuma coluna de nome, matrícula ou texto**: o nome do titular vive no `usuario`, e a lista e o detalhe o mostram só enquanto ele existe — depois, "Titular eliminado") | aluno, professor | registrar e conduzir o pedido de acesso, portabilidade, compartilhamento, correção e eliminação, e provar que ele foi atendido | execução de contrato e obrigação da escola (LGPD, arts. 18 e 19) | vigência + 5 anos (proposta), como a auditoria (grupo `registro_de_decisao`): a eliminação do titular não apaga o pedido, que fica com os ids, e a `chave_envio` nunca entra no arquivo do titular (F3, tarefa 11.0). **A foto do compartilhamento** (por empresa, a primeira e a última data de envio externo do aluno, com a origem `rastro` ou `periodo`) fica 5 anos com o pedido, e é **refeita antes** de a eliminação anonimizar o aluno (F3, tarefa 15.0): depois que o expurgo e a eliminação anulam `consumo_ia.aluno_id`, é ela que ainda responde por onde o dado passou. A eliminação conclui na mesma transação os outros pedidos abertos do titular, e o autor é a coordenação que registrou, se ainda ativa, ou a `rotina` (F3, tarefa 15.0) |
| Marca da eliminação agendada (`usuario.eliminacao_agendada_em`: só a data do registro do pedido de eliminação; **nenhum dado novo da pessoa**, a coluna é o espelho do pedido `agendado`) | aluno, professor | suspender o acesso da pessoa nos 7 dias entre o pedido e a eliminação, e permitir o cancelamento | execução de contrato e obrigação da escola (LGPD, arts. 18 e 19) | até o cancelamento (a marca é apagada) ou a eliminação do usuário (a linha sai com a pessoa); nunca fica depois (F3, tarefa 14.0) |
| Marca da introdução vista (`usuario.introducao_vista_em`: só a data em que a pessoa viu a introdução do papel dela; **nenhum conteúdo nem comportamento**, e o `GET /v1/eu` a devolve só à própria pessoa; a data de outra escola da mesma conta e do mesmo papel é lida sem sair em `acessos` nem no login) | aluno, professor, coordenador | não repetir a introdução a quem já a viu, inclusive quando o vínculo de uma escola termina e a pessoa segue em outra | execução de contrato | a da linha de `usuario` (`pessoa_desativada`): sai com ela, no expurgo e na eliminação; a versão `coordenacao` do arquivo do titular não traz a data do professor (D64) nem a do coordenador: só a do aluno passa (`case when`), o que é conservador; a data **nunca vira indicador de adoção** (regra 70 item 9, D64): nenhuma tela, painel ou alerta lista "quem ainda não viu a introdução", e pedido assim é recusado e sobe para produto (telas do aluno, tarefa 1.0) |
| Tamanho da letra do aluno (`localStorage['educa.letra']`, no navegador: `grande` ou `maior`; ausente é Padrão; só esses valores são lidos, o resto vale Padrão; **sem identificador de pessoa, de escola nem de papel**, e nunca vai à API, a URL, a log nem a cookie) | aluno | ler com conforto na área do aluno (acessibilidade, RF11 das telas do aluno); é preferência do computador, e o aluno seguinte no mesmo computador a herda | execução de contrato; não é dado pessoal por si: não liga a letra a ninguém. "Grande" ou "Maior" pode sugerir uma necessidade visual, e é por isso que a chave **nunca** ganha identificador nem vai ao servidor: sem pessoa, escola ou papel ao lado, o valor fica no computador e passa ao aluno seguinte sem apontar para ninguém; no servidor ela viraria indício de necessidade específica, que é dado sensível (regra 20, item 3) | só no navegador, até o aluno escolher Padrão (que apaga a chave) ou a pessoa limpar os dados do site; nada no servidor, e só a **escolha** grava (montar a tela, abrir "Ajustes" e entrar na área não escrevem). Faz parte da lista fechada de chaves do navegador de `docs/interface.md` 6 (telas do aluno, tarefa 8.0) |
| Arquivo do titular (`arquivo_titular`: de qual pedido e de qual versão — `completa` ou `coordenacao` —, onde o JSON está no storage privado, o tamanho e quando ficou pronto e até quando fica; **nenhum dado do titular na linha**: o conteúdo mora no objeto, e o campo `chave_objeto` nunca sai pela API (a URL assinada leva o caminho do objeto, que só tem ids)) | aluno, professor | entregar ao titular a cópia dos dados que a escola guarda dele (LGPD, art. 18, II e V): ele baixa a versão completa em "Meus dados", e a coordenação baixa a versão da escola só quando ele não tem conta ativa | obrigação da escola (LGPD, art. 18) | 7 dias depois de pronto, ou até a eliminação do titular (`apagado_em`): a rotina da escola apaga o objeto do storage e só então a linha; a noite seguinte repete o que o storage não deixou apagar (F3, tarefa 13.0) |

**O arquivo do titular (F3, tarefa 13.0).** O pedido de acesso ou de portabilidade monta, fora da requisição, um JSON no storage
privado (`titular/<escola>/<pedido>/<versao>.json`) e passa o pedido de `em_preparacao` para `pronto`. O titular o baixa em "Meus dados"
por uma URL assinada de 5 minutos, com `no-store` e `attachment`, e a escola nunca o guarda em log, cache nem navegador. Duas versões:
a **completa**, só do titular, e a **da coordenação**, que só existe quando ele não tem conta ativa nesta escola (desativado, ou com a eliminação agendada: a pessoa suspensa conta como sem conta ativa, F3, tarefa 14.0) e **nunca** traz a
conversa dele com o Assistente de ensino, o tema que ele escreveu nos pedidos, o texto enviado ao modelo nem a justificativa das
entregas (regra 70, item 8); ela traz a conversa do Tutor, por exceção declarada no PRD, e o registro de uso do professor, por
exceção à D64, e as duas leituras são auditadas com finalidade. O critério de cada coluna é de lista permitida: entra o que é do
titular; o id de outra pessoa da escola (`criado_por`, `decidida_por`, `registrado_por`...) fica na auditoria; hash, segredo, chave
de envio, chave de objeto e `sub` da conta externa nunca entram; a correção de um lote que o professor não aprovou sai só como
"em validação" ou "rejeitada", sem acertos nem diagnóstico; o conteúdo de artefato nunca sai. O que **não** entra, e por quê: as
leituras que a coordenação fez sobre o titular (`titular.previa_lida`, `pedido.lido`), porque trariam o id de quem leu — a
auditoria em que ele é o autor entra, só com o ato (a ação, a entidade, a finalidade e o instante), sem o `antes` e o
`depois`, que podem levar o id e o motivo de outra pessoa.

**Retenção por escola (F3).** Os prazos marcados como ajustáveis vivem num catálogo em código (`CATEGORIAS_DE_RETENCAO`,
em `packages/shared/src/privacidade`), com padrão, piso e teto aprovados em 05/10/2026: a conversa do Tutor e os sinais
(12 meses, de 6 a 24), a conversa do professor (12, de 3 a 24), os pedidos à IA (12, de 3 a 24), o texto do modelo (12,
de 1 a 12), o consumo por aluno (12, de 3 a 24), o trabalho do aluno (12 do encerramento do ano, de 6 a 60), e a
reivindicação decidida, a autoria de artefato, o material excluído, o vínculo encerrado e o cadastro de quem foi
desativado (60, de 12 a 60). A operação ajusta por escola, por contrato, com `ops:retencao`, e a escola sem ajuste usa o
padrão; o pedido à IA e o texto do modelo nunca ficam mais que a conversa do professor, e o consumo por aluno nunca mais
que a conversa do Tutor. O registro de acesso (6 meses), a auditoria e os outros prazos fixos não se ajustam. Toda tabela
das migrations está classificada em `CLASSIFICACAO_DAS_TABELAS`, conferida por teste de arquitetura; a coordenação lê os
prazos da escola em `GET /v1/privacidade/retencao`. Toda noite, à 1h, um job por escola (`retencao.expurgar-escola`, no contexto dela) apaga o
que passou do prazo, em lotes, fora do horário letivo, e registra em `expurgo_execucao` só a categoria e quantas linhas
saíram; duas noites seguidas sem terminar disparam alerta com runbook (F3, tarefa 3.0: conversa do Tutor, sinais e
conversa do professor; tarefa 4.0: as quatro que mantêm a linha e perdem a pessoa; tarefa 5.0: o trabalho do aluno, a
reivindicação decidida, o material excluído, o vínculo encerrado e a pessoa desativada além do prazo, que o ciclo de vida
**elimina** de fato — credencial, vínculos, conta externa e sessões —, com a auditoria `usuario.eliminado` assinada pela
rotina, e a conta global só cai se não serve a escola nenhuma). A noite termina apagando o próprio registro do expurgo
(`expurgo_execucao`) com mais de 5 anos.

**O que a operação vê do atendimento e do expurgo (F3, tarefa 19.0).** `ops:privacidade --escola <id>` imprime, para uma escola,
só contagens: pedidos por estado, eliminações agendadas e vencidas, arquivos ativos e vencidos, suboperadores vigentes, incidentes
avisados e sem confirmação, e quantas categorias do expurgo terminaram na última execução, com a data dela. Nunca nome, id de
titular, texto de pedido ou chave de objeto (D76: a operação acompanha o uso, sem ver dado de pessoa), e o erro não repete o que
foi digitado. A leitura é no contexto da escola, sem `@Unscoped`. **O expurgo não atrapalha a aula** é provado no cenário de
carga "justiça entre escolas" (`npm run carga`): a escola A expurga 1 milhão de linhas e troca um nome enquanto a B usa a fila
interativa e **o Tutor pela rota** (`POST /v1/tutor/mensagens`, com o adaptador falso de latência simulada), com nenhum statement
no teto de 1,5 s nem cancelado pelo `statement_timeout` de 2 s, a espera da B e o turno do Tutor da B até 500 ms acima da base
(`docs/infra.md`, seção 10).

**O que o MVP de apresentação (migration 0022) não guarda, por estrutura.** Não existe tabela `nota` (D46), e nenhuma coluna
guarda nota, conceito ou devolutiva sobre texto de aluno (D55). Nenhuma coluna guarda texto sobre a pessoa do aluno (D57,
D66): a memória do Tutor é leitura das tentativas, das correções de lote aprovado e dos sinais, e não uma tabela. Não
existe vínculo entre aluno e adaptação, em tabela nem em coluna (D35): a versão adaptada leva só os **tipos**, de lista
fechada, e é aplicada à turma. O resumo do Analista (`resumo_do_analista`) é agregado por série e disciplina, com números,
ids de série e disciplina e códigos, sem pessoa e sem texto livre, e por isso não tem linha no mapa. O dado é 100%
sintético nesta fatia (D71, D77); as retenções marcadas "proposta" e o expurgo delas fecham antes da primeira escola real.

**IP só em memória, no login** (F1, tarefas 14.0 e 15.0). Além do registro de acesso, o IP de quem pede é usado sem ser
gravado, com a finalidade de segurança, e esquecido por instância:
- na vez do login por e-mail no semáforo do hash, que roda por IP no balde da equipe: fica na memória da instância até
  dois minutos depois da última vez daquele IP (a roda esquece, a cada minuto, quem não esperou nem foi atendido no
  minuto anterior, e todos que não esperam, se passar de 10.000 entradas), ou até o login seguinte, se a instância
  ficar sem login;
- no número de escolas da rede do IP de saída (`rede.ips_saida`), lido só quando um IP passa do limite da rota de
  e-mail: vale por um minuto e sai da memória na varredura do minuto seguinte, ou no login seguinte, se a instância
  ficar sem login;
- nos contadores por IP, o Redis de fila e o seguro em memória recebem só o HMAC do IP, com prazo de um minuto (o
  limite por IP das rotas de login, do rate limit do F0, no Redis de cache, também vive só a janela de um minuto);
- no `rl:ip`, o limite anônimo por IP do rate limit do F0, que conta também as rotas da sala (`salas/abrir` e
  `salas/reivindicar`, A1): o IP é a chave do contador no Redis de cache e no seguro em memória, só pela janela de um
  minuto, e só o limitador a lê;
- no `rl:ip:op`, o balde próprio das sete rotas de entrada da operação (A0b, tarefa 9.0): como o `rl:ip`, o IP é a chave
  do contador no Redis de cache e no seguro em memória, só pela janela de um minuto. Não é dado novo: é o mesmo IP que
  essas rotas já contavam no `rl:ip` e no `rl:ip-login`, em outro balde.

Nenhum desses vira rótulo de métrica, linha de log, auditoria ou tabela. Ninguém lê as chaves `rl:ip`, nem as dos outros
baldes por IP, à mão, nem durante um alerta: elas guardam o IP de todo visitante anônimo de todas as escolas no último minuto, e não só o de um ataque. O
alerta traz a escola. O IP de um ataque às rotas de login, quando preciso, é consultado no registro de acesso, só para
a investigação; as rotas da sala não gravam registro de acesso, e o ataque a elas se responde pela escola, revogando os
acessos dela (`docs/runbook.md`, "Código da turma errado em massa numa escola"). Bloquear IP na borda não existe na A1;
quando existir, com o staging e o provedor (D42), entra aqui antes, com finalidade e prazo, e fora de arquivo versionado.

**O painel da operação não vê pessoa da escola** (A0b, D76). A equipe Turmma vê, por escola, só id, nome, endereço, rede,
o estado da primeira coordenação e números: turmas, professores ativos e alunos ativos do ano letivo em curso, e o uso de
infra (requisições, jobs e bytes de storage) do último dia fechado e do mês dele. Nada de nome, e-mail ou matrícula de
pessoa, nem nome de turma; o contrato de saída é estrito, e o teste I6 da A0b semeia sentinelas em cada tabela de pessoa e
confere que nenhuma resposta nem linha de log as traz. A contagem não identifica ninguém e não gera auditoria de leitura.
O único dado de pessoa da escola que passa pelo painel é o nome e o e-mail da coordenadora que o operador digita no
convite (linha "Convite de coordenador" e a conta global, acima); o do próprio operador (e-mail, senha e segundo fator,
na entrada, e o nome e o apelido, na sessão) está na linha "Conta de operador Turmma".
É o que respondemos quando a escola pergunta o que nós, como operadores, vemos (D61).

**Aluno não tem e-mail nem telefone no sistema.** Contato é sempre do responsável. Quem
propuser adicionar precisa justificar por escrito e atualizar esta tabela.

---

## 3. Minimização, na prática

A pergunta certa não é "esse campo é útil?", é "**o que acontece se ele vazar?**".

- Não colete data de nascimento se série já resolve
- Não colete CPF de aluno. Nunca. Não precisamos
- Não colete foto de aluno. Se um dia precisar, vira projeto próprio com avaliação de impacto
- Não colete endereço, renda, raça, religião, saúde
- **Dado de PEI e necessidade específica é dado sensível** (art. 11). Se a ferramenta de
  adaptação precisar dele, guarde a *adaptação necessária*, não o diagnóstico. A ferramenta
  Adaptação recebe o **tipo de adaptação**; campo de texto livre sobre o aluno é onde o
  diagnóstico acaba escrito, e por isso não existe (D67)
- Não meça tempo ocioso nem acompanhe a navegação do aluno. A única exceção é a contagem de
  saídas da aba **durante uma avaliação** (D70)
- Resposta de prova não precisa virar perfil comportamental. Mais do que "não precisa":
  **perfil comportamental de menor é vedado** (ECA Digital, art. 26; Decreto 12.880, art. 10;
  e uso de risco excessivo pelo CNE). Vale para qualquer agregação que classifique o aluno por
  comportamento, humor, atenção ou personalidade, inclusive rótulo interno (D57)

---

## 4. Onde SaaS vaza — e como cada furo é fechado aqui

Esta lista é o que mais aparece em incidente real. Cada linha vira teste.

| Furo | Como acontece | Nossa defesa |
|---|---|---|
| **Falta de escopo de tenant** | Query sem `escolaId`; alguém troca o id na URL e lê outra escola | Escopo no repository, a partir do token. Teste de isolamento por módulo. `rules/10` |
| **IDOR** | `GET /alunos/:id` devolve qualquer aluno | Autorização por objeto, não só por rota. Id UUID. Erro de "não existe" e "sem permissão" idênticos |
| **Bucket público** | Foto de prova em storage aberto, indexada pelo Google | Bucket privado, URL assinada com validade curta, nunca URL permanente |
| **Log com dado pessoal** | Nome e resposta no log, log vai para serviço terceiro | Log só com id. Revisão automática proíbe campo pessoal em logger |
| **Backup exposto** | Dump sem criptografia, em disco compartilhado | Backup criptografado, acesso restrito, restauração testada |
| **Dado real em desenvolvimento** | Dump de produção na máquina do dev | **Proibido.** Ambiente de dev usa seed sintético. `docs/` e seed de demonstração são fictícios |
| **Provedor de IA treinando com nosso dado** | Termo padrão permite | Contrato que veda treinamento. Enquanto não houver contrato, use provedor local |
| **Prompt vazando dado demais** | Conversa do tutor envia turma inteira no contexto | Envie o mínimo: id, não nome. Recuperação limitada ao necessário |
| **Resposta de API larga demais** | Endpoint devolve objeto inteiro, front esconde no CSS | DTO de saída explícito. Nunca serialize a entidade |
| **Convite eterno** | Link de convite sem validade circula em grupo de WhatsApp | Token único, expiração curta, uso único, revogável |
| **Exportação sem controle** | Coordenador baixa planilha com tudo | Exportação registrada em auditoria, com escopo e finalidade |
| **Mensagem de erro** | Stack trace com dado no corpo da resposta | Erro tipado, sem detalhe interno para o cliente |
| **Conta compartilhada** | Coordenação inteira usa um login | Usuário nomeado por pessoa. Ação sempre com autor |
| **Ex-funcionário com acesso** | Professor sai, conta fica | Desativação obrigatória no fim do vínculo, com rotina que sinaliza contas inativas |
| **CPF ou nascimento entrando como matrícula** | A coordenação cola a exportação da secretaria com `nome;CPF` ou `nome;nascimento`, e a segunda coluna vira matrícula | A API recusa a matrícula com forma de CPF pontuado ou de data, na lista e no avulso, e a lista com mais da metade das matrículas (e pelo menos duas) em CPF sem pontuação, pelo contrato de `packages/shared` (correção `2026-10-03-trava-de-documento-so-na-tela`). **Risco aceito:** o CPF sem pontuação sozinho, no avulso ou em lista sem maioria, passa, porque não se distingue de matrícula numérica de 11 algarismos; e o CPF que perdeu o zero à esquerda (10 algarismos) ainda não é reconhecido (`TODO.md`). A conversar com o advogado e com a escola piloto. A prévia devolve a linha recusada só na resposta à própria coordenação, que não a grava em cache, URL nem armazenamento do navegador |

---

## 5. Medidas técnicas obrigatórias

**Acesso**
- Senha com hash forte (argon2id ou bcrypt com custo alto)
- Sessão curta com renovação; token de aluno mais curto ainda
- Segundo fator para coordenador e para nosso admin
- Menor privilégio: o papel define exatamente o que alcança

**Dados**
- Criptografia em trânsito sempre; em repouso no banco e no storage
- Escopo de tenant em toda query; id UUID
- Exclusão lógica com autor e data; exclusão real só a pedido do titular
- Pseudonimização no que for analítico: agregado não carrega nome

**Observabilidade sem exposição**
- Log estruturado com `escolaId` e `usuarioId`. Nunca nome, resposta, nota ou conversa
- Auditoria obrigatória: leitura de dado de aluno por coordenador ou rede, leitura nominal
  de indicador de professor pela coordenação, exportação, alteração de nota, alteração de
  permissão, aprovação de conteúdo de IA

**Ciclo de vida**
- Rotina de expurgo automática, conforme a tabela da seção 2
- Fim de contrato: exportação completa entregue à escola e eliminação em prazo definido
- Seed de desenvolvimento e demonstração **sempre sintético**

---

## 6. IA e dado pessoal

Este é o ponto em que somos diferentes de um SaaS comum, e onde o risco é maior.

1. **Contrato com provedor vedando treinamento** com nosso dado. Sem isso, só provedor local.
   O contrato também precisa **permitir serviço usado por menor** e dizer **onde o dado é
   processado**. Em 13/09/2026: os termos da Gemini API (AI Studio) vedam serviço "provável
   de ser acessado" por menor de 18, e não valem para o Vertex AI (termos do Vertex a
   verificar); o DPA da Maritaca proíbe treinamento e descarta o conteúdo após a geração,
   mas lista processamento no Brasil, nos EUA e na UE, e a variante no Brasil precisa estar
   escrita no contrato. Transferência internacional exige as cláusulas-padrão da ANPD.
2. **Envie o mínimo.** A memória do Tutor alcança tudo que o aluno fez no sistema (D66), mas
   cada chamada leva só o que importa para aquela dúvida — o trecho do histórico recuperado por
   relevância, as habilidades em jogo e o tipo de adaptação registrada —, nunca o histórico
   inteiro, nunca o nome, nunca o motivo da adaptação.
3. **Prefira identificador a nome.** O modelo não precisa saber que é a Maria.
4. **Registre todo envio externo** em `ExecucaoAgente`: o que foi enviado, para qual
   modelo, quanto custou, quem aprovou o resultado. No MVP de apresentação a medição de cada
   chamada fica em `consumo_ia` (`envio_externo`, `provedor` — o id de quem recebeu o conteúdo, só
   quando houve envio externo —, modelo, tokens, custo), ligada à
   `execucao_agente`; quem aprovou fica na `entrega`. Nas tarefas do Tutor, `entrada` e `saida`
   ficam nulas, e na proposta de ferramenta também: o que foi dito está em `mensagem_tutor` e em
   `mensagem_agente`, e conversa de pessoa não se duplica.
5. **Nada de treinar modelo próprio com dado de escola** sem nova base legal e instrução
   expressa. Isso inclui ajuste fino e memória de longo prazo entre escolas.
6. **Conversa do tutor é dado sensível na prática**, mesmo que a lei não a classifique
   assim: aluno escreve coisas que não escreveria em prova. Retenção curta, acesso
   restrito ao professor da turma, nunca exposta à rede.
7. **Conversa de aluno só em provedor com processamento no Brasil** (D62). Vale para o Tutor,
   para a classificação de sinais e para qualquer prompt que carregue texto escrito por menor
   de idade. Tarefa sem dado pessoal pode usar provedor fora, com as cláusulas-padrão da ANPD
   (Resolução CD/ANPD 19/2024) e informação à escola. O Referencial do MEC trata dado
   educacional de menor sob jurisdição estrangeira como risco de soberania, citando o Cloud
   Act, e a rede pública pergunta isso na primeira reunião.
8. **O aluno nunca é enganado sobre estar falando com IA** (Decreto 12.880, art. 11, I; D58):
   os agentes mantêm identidade de função, toda saída de IA é rotulada como tal, e nenhum
   agente afirma ser pessoa. E o risco algorítmico de cada funcionalidade de alto risco tem
   avaliação escrita antes de ela existir (D60). Não é cosmético: é o único artigo em vigor no Brasil que trata de agente
   conversacional com menor de idade, e a ANPD vai regulamentá-lo.
9. **O buscador é um terceiro fora do País** (D68). A consulta da busca do Tutor é escrita pelo
   modelo, sem o texto que o aluno digitou e sem identificador; sai do nosso servidor, nunca do
   navegador do aluno; e o provedor de busca entra no registro de suboperadores. Conteúdo de
   página da web é dado, nunca instrução para o agente.

---

## 7. Direitos do titular

O sistema precisa responder a estes pedidos **por código**, desde o começo — não como
funcionalidade futura:

| Direito | O que o sistema faz |
|---|---|
| Confirmação e acesso | Exporta tudo sobre um titular, em formato legível |
| Correção | Coordenador corrige nome, turma, vínculo, com auditoria |
| Eliminação | Apaga de verdade, inclusive em backup na próxima rotação, com registro |
| Portabilidade | Exportação estruturada |
| Informação sobre compartilhamento | Lista para quais suboperadores o dado foi |
| Revisão de decisão automatizada | Toda nota tem autor humano; a revisão já é o fluxo. Sinal ou alerta sobre aluno e indicador de professor têm explicação e caminho de contestação (art. 20; regra 70) |
| Notificar violação de direito de criança ou adolescente | Canal no produto, gratuito e divulgado, para aluno, professor, coordenação e família; retirada de conteúdo com motivo, informando se a análise foi humana ou automatizada, e direito de recurso (ECA arts. 28 a 30; Decreto art. 41; D61) |
| Levar o próprio dado embora | A coordenação exporta dado, artefato e histórico de uso em formato aberto a qualquer momento, sem depender de nós (D63) |

**Teste de fechamento:** se a secretaria de educação pedisse hoje tudo o que guardamos
sobre um aluno específico e para onde isso já foi enviado, o sistema responde em minutos?
Se não responde, a implementação está incompleta.

---

## 8. Incidente

1. Contenção imediata e preservação de evidência
2. Registro do que vazou, de quantos titulares, e por qual caminho
3. **Comunicação à escola controladora** — ela é quem notifica a ANPD e os titulares.
   Nosso prazo interno: 24 horas da detecção. É o registro por comando (`ops:incidente registrar`, uma seção por escola
   afetada, sem dado de titular) que o cumpre: a coordenação lê o aviso e confirma o recebimento, o sistema guarda quem e quando
   (5 anos), e o alerta "Incidente sem confirmação em 24 h" avisa a operação quando a escola não confirma (`docs/runbook.md`)
4. Correção, teste que prova a correção, e post-mortem escrito
5. Todo incidente vira um teste de regressão permanente

Ter esse processo escrito antes do primeiro cliente é o que separa um problema
administrável de uma crise.

---

## 9. Antes do primeiro cliente real

- [ ] Contrato de tratamento de dados com a escola, feito por advogado
- [ ] Contrato com provedor de IA vedando treinamento
- [ ] Política de privacidade e termos, com seção de menor de idade
- [ ] Encarregado (DPO) indicado e canal de contato publicado
- [ ] Relatório de impacto (RIPD) — obrigatório na prática aqui: dado de menor, volume
      alto, decisão apoiada por IA. Exigido pelo ECA Digital, art. 16, parágrafo único
- [ ] **Avaliação de Impacto Algorítmico** de cada funcionalidade de alto risco — Tutor,
      correção de objetiva, diagnóstico por habilidade, sinais e alertas, adaptação —, no
      roteiro de seis etapas de `docs/conformidade-mec.md` seção 7 (D60)
- [ ] **Dossiê de conformidade** entregue à escola: declaração de propósito com faixas
      etárias, documentação do funcionamento em linguagem simples, relatório de conformidade
      LGPD + ECA artigo por artigo, RIPD, AIA e relatório de uso legível (D61)
- [x] **Aviso de privacidade em linguagem de faixa etária**, para aluno de 11 anos, exigido
      pelo ECA Digital (art. 16) e pelas cláusulas sugeridas pelo MEC. Existe desde a X4 (tarefa 9.0, 25/10/2026): o
      passo 3 da introdução do aluno, que ele revê em Eu › "Rever a introdução"
      (`apps/web/src/areas/aluno/introducao/aviso-de-privacidade.ts`, com teste). Falta a revisão do texto por orientação
      educacional e por advogado antes do primeiro aluno real
- [ ] **Canal de notificação de violação** no produto, com retirada e recurso (D61)
- [ ] **Exportação em formato aberto** de dado, artefato e histórico de uso pela própria
      coordenação (D63)
- [ ] Parecer sobre o ECA Digital (Lei 15.211/2025) aplicado a plataforma contratada pela
      escola
- [ ] Guarda de registro de acesso por 6 meses (Marco Civil), separada da auditoria
- [ ] Base legal e desenho dos indicadores de professor revisados por advogado (D45)
- [ ] Rotina de expurgo implementada e testada
- [ ] Restauração de backup executada de verdade, não documentada
- [ ] Teste de isolamento entre escolas rodando na esteira
