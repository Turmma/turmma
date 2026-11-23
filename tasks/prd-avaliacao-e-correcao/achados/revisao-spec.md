# Achados das revisões — `tasks/prd-avaliacao-e-correcao/revisao-spec.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · AJUSTES NECESSÁRIOS · 2026-11-23 12:59:54 · `tasks/prd-avaliacao-e-correcao/revisao-spec.md`

VEREDITO: AJUSTES NECESSÁRIOS
Tela vista: não. É revisão de spec e ainda não há tela para fotografar. Li o PRD, a Tech Spec (§4, §9) e os cenários (§4).
Estados: faltando, ver B2 e B3.
Acessibilidade: o desenho não garante, ver B4.
Chromebook fraco: ok. As listas têm 35 alunos, então virtualizar não se aplica. A releitura é a cada 30 s e o acompanhamento a cada 15 s, só à vista. Não há imagem, e o e2e roda no projeto `chromebook`. O throttling de CPU e de rede não está pedido no e2e (recomendação 4).
Celular: parcial, ver B5. A tela de foco do aluno está pensada e testada (§9, RF7). As telas do professor não têm layout a 360 px nem e2e em `celular`.
Ação oficial protegida: sim, em parte. O aplicar tem resumo (§9, cenários §4). A aprovação do lote segue como hoje. Estender mostra o efeito antes de confirmar. Faltam a confirmação de "Mudar janela" e de "Segunda chamada" (B3) e a de encerrar, que o PRD §7 pede.

Itens da lista:
- Item 2 (feed de agentes): não se aplica.
- Item 3 (seletor de escola): implícito. O painel e o aplicar herdam a escola ativa (D87), mas a §9 não diz isso. Recomendação 1.
- Item 6 (rótulo de campo e teclado): implícito, ver B4.
- Item 7 (português do Brasil): ok. Os textos da §4 dos cenários estão em português e o resumo usa data e hora locais. Os códigos `PROVA_*` e `TEMPO_ESGOTADO` não podem aparecer na tela, e a spec só diz que "a tela diz".

Bloqueantes:

1. **Dado sem rota (§9 contra §4).** "Antes de começar" mostra "Esta prova tem 40 minutos". O aluno com +50% deve ver 60, e a §9 não diz de onde esse valor vem.
   - `GET /v1/minhas-atividades` traz só janela e duração.
   - `GET …/prova` "não grava", mas devolve questões. Sem tentativa, o contrato não diz se ele serve ao "Antes de começar" nem se vaza o enunciado antes do clique. O cenário RF7 cobre só a tela, não a resposta da API.
   - Correção: a §4 define uma saída para a tela "Antes de começar" com `duracaoMin` e `limiteDoAlunoMin` já com o tempo adicional, e sem questões. Ou `GET …/prova` antes de `comecar` devolve só o cabeçalho.
   - O cenário de integração tem de provar que as questões só saem depois de `comecar`.

2. **Estados e erros do aluno sem texto (§9, cenários §4; item 1 e item 8).** Só o Acompanhar lista os quatro estados. Faltam:
   - Carregando e erro da prova e do "Antes de começar".
   - Queda de rede ou falha ao salvar, com a fila do cliente. Hoje só existe "Salvo" e "Salvando…". O aluno precisa ler algo como "Sem conexão. Suas respostas ficam guardadas e seguem quando a rede voltar. O tempo continua", e a fila (RF6) tem de ficar visível.
   - Texto de `PROVA_FORA_DA_JANELA`, dizendo quando abre ou que já fechou.
   - Texto de `TEMPO_ESGOTADO`, de `PROVA_JA_COMECOU` e de 429.
   - Prova com "Abre em dd/mm às hh:mm" na lista do aluno (estado vazio e futuro).
   - Segunda chamada para o convocado, e lista sem prova.
   - Correção: acrescentar essas linhas à §4 dos cenários. Cada uma deve dizer o que fazer, com um teste de unidade web ou e2e.

3. **Ação do professor sem o que é decidido à vista (§9, item 4).**
   - "Mudar janela" e "Segunda chamada" não têm resumo antes de confirmar. A segunda chamada precisa listar os alunos convocados, a janela, a duração e o tempo adicional.
   - A confirmação de encerrar com alunos fazendo ("diz quantos", PRD §7) não está na §9 nem nos cenários.
   - Correção: pôr o texto e o resumo dos três na §4 dos cenários, e um teste de que o botão só confirma depois do resumo.

4. **Acessibilidade da tela de foco não desenhada (§9, item 6).**
   - O relógio "Faltam 12 min" muda o tempo todo. Não pode ficar numa região `aria-live` que anuncia cada mudança. Defina um anúncio esparso (por exemplo a 10, 5 e 1 min, em `polite`) e um relógio sem anúncio contínuo.
   - Defina o foco ao entrar na prova, ao receber "O tempo acabou…" (que deve ser anunciado) e ao voltar de "Sair da prova".
   - "Salvo" e "Salvando…" são região `polite`, no padrão de `docs/interface.md:611`.
   - Os campos de data e hora, de duração e de percentual do aplicar precisam de rótulo e erro descritos (padrão `FormField`).
   - Correção: acrescentar esses pontos à §9, com teste (`ProvaEmFoco.test.tsx`) e passagem do axe no e2e.

5. **Celular sem cobertura para o professor (§9, §10; item 5a).**
   - O e2e em `celular` é só `aluno-prova.spec.ts`.
   - Aplicar (com a lista de tempo adicional por aluno), o painel (com a tabela de situação, limite e Estender) e a coluna "Saiu da aba" no aprovar não têm layout de 360 px nem teste.
   - Correção: a §9 define o layout de cartão ou de lista para essas três telas, sem rolagem horizontal. Pede alvo de 24 px, e de 44 px em Começar, Sair da prova, Estender e Confirmar.
   - A §10 passa a pedir e2e no projeto `celular` para as três telas do professor.

Recomendações:
1. A §9 deve dizer que o painel e o aplicar usam a escola ativa (D87) e que o seletor de escola filtra tudo.
2. O aviso fixo da D88 termina em "Não é prova de nada", frase ambígua. Revise o texto com o Joaquim, já que a pergunta em aberto 2 do PRD ainda trata do texto do aviso.
3. A pergunta em aberto 3 do PRD (tela de foco no celular) está respondida na §9. Feche-a no PRD.
4. Peça no e2e do `chromebook` o throttling de CPU e de rede, com a rede caindo.
5. "Fazendo · termina às 10:42" deve mostrar o horário no fuso da escola, e "Tempo esgotado" tem de diferenciar de "Enviou" por texto, não só por cor.
6. O aluno com tempo adicional vê "60 minutos" sem rótulo de adaptação. Vale um teste de que a tela não diz "tempo adicional" nem o percentual, para não expor a adaptação a quem olha a tela do colega.

Arquivos: `tasks/prd-avaliacao-e-correcao/techspec.md`, `tasks/prd-avaliacao-e-correcao/cenarios.md`, `tasks/prd-avaliacao-e-correcao/prd.md`.

## tenancy-guardian · 1ª rodada · REPROVADO · 2026-11-23 13:01:09 · `tasks/prd-avaliacao-e-correcao/revisao-spec.md`

VEREDITO: REPROVADO

Tabelas verificadas: `atividade_aplicada` (colunas novas; `segunda_chamada_de` com FK na mesma escola, ano, turma e artefato), `tentativa_atividade` (colunas novas), `tempo_adicional`, `extensao_de_tempo`, `convocado_da_segunda_chamada` (as três com `escola_id` e `ano_letivo_id`, FK composta e aluno pela FK `(escola, aluno)`), `pulso_da_api` e `indisponibilidade`. Essas duas ficam sem `escola_id`, com justificativa: são fato operacional global, sem dono e sem pessoa, e já estão nas exceções do item 1 de `docs/modelo-de-dados.md`, que o `architecture.test.ts` confere.

Queries verificadas: as dez rotas da §4. Nenhuma recebe `escolaId` no corpo ou na query: a escola vem do token por `requireEscolaId()` (§6). Também verifiquei `GET /v1/minhas-atividades` com o filtro de convocado, o começar com `for share` e `on conflict` (§5.2), o limite com as indisponibilidades globais (§5.3), a rotina `sistema.encerrar-provas-vencidas`, que é `@Unscoped` com justificativa e devolve só ids (§5.6, §6, §11), o job `atividade.encerrar-vencidas` por escola, o pulso, a saída da aba (§5.8) e a trava do Tutor (§5.10).

Teste de isolamento: presente, mas não é efetivo no ponto que mais importa, o job que roda depois da rotina sem escopo (bloqueante 2).

Bloqueantes:
1. **Tech Spec §5, passo 2 (Começar), e cenarios.md §1 RF10.** A ordem escrita confere a janela antes do convocado: "fora da janela, `PROVA_FORA_DA_JANELA`; não convocado, inexistente". Um aluno não convocado que chama `comecar` numa segunda chamada fora da janela recebe `PROVA_FORA_DA_JANELA` em vez de `NAO_ENCONTRADO`, e isso confirma que a aplicação existe (regra 10, item 6). O cenário RF10 roda dentro da janela, então não pega o erro.
   **Correção exigida:** a leitura da aplicação no `comecar` resolve escola, turma atual e convocado na mesma consulta, antes de qualquer conferência de janela. Escrever a ordem assim no §5.2 e acrescentar ao cenários o caso "não convocado e aluno de outra turma, fora da janela → `NAO_ENCONTRADO`". A mutação que derruba o caso é conferir a janela antes do alcance.
2. **cenarios.md §2, primeira linha, comparado com Tech Spec §6 ("o job de A não encerra prova de B").** O cenário põe a prova de B como "corrente", não vencida. Se a listagem de aplicações vencidas dentro do job `atividade.encerrar-vencidas` perder o `escola_id`, o teste continua verde, porque a prova de B nem está vencida. A única fronteira entre escolas depois de uma rotina `@Unscoped` fica sem teste que a prove.
   **Correção exigida:** um cenário com prova avaliativa vencida em A e outra em B, rodando só o job de A. A de B continua `aberta`, sem lote e sem auditoria. A mutação que o derruba é tirar o `escola_id` do `where` da listagem do job.

Recomendações:
- **§3:** declarar `id uuid` (uuidv7) em `tempo_adicional`, `extensao_de_tempo` e `convocado_da_segunda_chamada`. Hoje só as duas tabelas operacionais trazem o id.
- **§4 e §5.9:** validar que `alunoId` (em extensões) e `alunoIds` (na segunda chamada) são da turma da aplicação, como o RF3 já faz para o tempo adicional, e testar aluno de outra turma e de outra escola, com `ENTRADA_INVALIDA` e nada gravado. Hoje só a FK composta barra o aluno de outra escola, sem erro tipado definido.
- **§3, `extensao_de_tempo`:** a chave única é `(escola, chave)`. Na repetição, devolver só o acompanhamento do `:id` da rota e responder `CONFLITO` se a linha gravada for de outra aplicação ou de outro aluno, ou então mudar a chave única para `(escola, atividade_aplicada, chave)`.
- **§6:** a frase "tirar o `escola_id` do `where` de cada repository novo deixa o caso vermelho" exagera. Nas tabelas filhas a barreira real é a leitura da aplicação. Ou se acrescenta um teste no nível do repository (contexto de A, id de aplicação de B, resultado vazio), ou o texto passa a dizer que a guarda estática cobre essas tabelas.
- **Tech Spec:** listar as ações novas da matriz de permissão (`estender`, `mudar_janela`, `acompanhar`, `segunda_chamada`, `comecar`, `registrar_saida`), com `rede` e `coordenador` em `nunca`, e incluir a rede no contrato do RF9 ("nenhuma rota devolve `saidas`").
- **Cenários RF10:** cobrir também `GET /prova`, `PUT respostas` e `saidas-da-aba` feitos por um aluno não convocado, e não só o `comecar` e a lista.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-23 13:02:14 · `tasks/prd-avaliacao-e-correcao/revisao-spec.md`

VEREDITO: REPROVADO

**Cenários exigidos**

Cada RF do PRD (RF1 a RF10), em caminho feliz, permissão, isolamento e borda. Os sete casos da §7 do PRD. Para cada rota nova ou alterada da §4: o cenário na escola sem ano letivo em curso e, quando a rota lê vínculo ou turma, um vínculo encerrado ao lado de um aberto. Cada corrida da §7c com ordem forçada e mutação. Os fluxos de e2e da regra 40: aplicação e correção de avaliação em cada modo, e a rede caindo no meio da prova.

**Cobertos**

- **RF1:** janela, `min` com `fecha_em`, avaliativa sem janela.
- **RF2:** a janela muda antes do começo e é recusada depois.
- **RF3:** o percentual só para quem foi marcado, o `.strict()` sem motivo, aluno de outra turma recusado.
- **RF4:** extensão de um aluno, da turma, com prova encerrada, e a chave repetida.
- **RF5:** o PUT depois do limite, a tentativa vencida entrando na correção, o texto da tela.
- **RF6:** a unidade do `limiteDaTentativa` (com ponto fixo), o limiar do pulso, a fila do cliente.
- **RF7:** o e2e da tela de foco em `chromebook` e `celular`, e o GET que não grava.
- **RF8:** correção pelo índice original, retomada, começar duplo.
- **RF9:** chave idempotente, fora de prova dá `NAO_ENCONTRADO`, o `apresentado` sem contagem, o contrato do aluno e da coordenação, `blur` mais `visibilitychange` contando 1.
- **RF10:** original aberta, aluno que já enviou, convocado e não convocado, lote próprio.
- **Encerramento automático:** o job só de A e o aluno estendido além do `fecha_em`.
- **Trava do Tutor:** pela janela e só para o convocado.
- **Corridas:** a, b, e, f.
- **Isolamento entre escolas:** §6.
- **PRD §7:** "aluno faltou" (pelo RF10) e "feriado" (pelo RF2).

**Bloqueantes**

1. **Nenhuma rota nova tem cenário na escola sem ano letivo em curso, nem na virada** (cenarios.md §1 e §2; Tech Spec §5.6 e §6).
   - Faltam `comecar`, `prova`, `saidas-da-aba`, `janela`, `extensoes`, `acompanhamento`, `segunda-chamada`, e o que mudou em aplicar, PUT de resposta, `correcao` e `minhas-atividades`.
   - O caso grave é o job. A rotina `@Unscoped` lista (escola, aplicação) sem olhar o ano. O `atividade.encerrar-vencidas` passa pelo repository, que filtra por `requireAnoEmCurso()` (`atividade-aplicada.repository.ts:92`). Uma prova aberta quando o ano vira nunca encerra, e o alerta de 5 min dispara para sempre.
   - **Exigido:**
     - um cenário por rota, com escola sem ano em curso e a recusa esperada;
     - no `encerrar-provas.int.test.ts`, a avaliativa vencida em escola cujo ano encerrou, com o comportamento decidido na Tech Spec §5.6;
     - mutação: tirar o `anoLetivoId` do `where`.

2. **Vínculo encerrado ao lado de vínculo aberto, sem cenário, e o caso "aluno transferido com a prova aberta" (PRD §7) sem teste.**
   - Pede o aluno transferido do 7ºA para o 7ºB, com o vínculo encerrado em A e aberto em B, e tentativa em andamento em A.
   - Em A: `comecar`, PUT, `saidas-da-aba` e `prova` dão `NAO_ENCONTRADO`. A tentativa fica e entra na correção de A. O aluno não vê a prova de A em `minhas-atividades` e vê as de B.
   - O mesmo para o professor: vínculo encerrado na turma X e aberto na Y; em X, não estende, não muda janela, não lê acompanhamento nem abre segunda chamada.
   - Também o convocado transferido antes da segunda chamada.
   - Precedente: `atividade-isolamento.int.test.ts:244`.
   - Mutação: aceitar vínculo em qualquer estado.

3. **Permissão dentro da mesma escola sem teste** (Tech Spec §6 só cobre a outra escola).
   - O guia (§5.1, item 7) exige os dois casos: outra escola e professor da mesma escola sem vínculo.
   - Faltam:
     - o professor da turma em outra disciplina (professor com duas disciplinas na mesma turma) tentando estender, mudar janela, ler acompanhamento e abrir segunda chamada na prova da colega;
     - o aluno chamando `extensoes` e `janela`;
     - a coordenação chamando `acompanhamento` e `correcao`. O PRD §4 diz que ela não vê saída da aba **nem tempo adicional**, e o contrato do RF9 (cenarios.md:40) só cobre `saidas`. Falta `tempoAdicional` e `limiteEm` no contrato da coordenação.

4. **O limite efetivo existe em dois lugares e só um tem teste.**
   - A Tech Spec §5.3 define o limite em TypeScript (`limiteDaTentativa`). A §5.4 recusa "na mesma instrução, com o `now()` do banco", ou seja, em SQL. O job (§5.6) confere o "fim efetivo" por um terceiro caminho.
   - A indisponibilidade só tem teste de unidade (cenarios.md:26-27). Faltam, em integração:
     - **PUT:** indisponibilidade de 5 min dentro da tentativa, e o PUT depois do limite original grava. Mutação: o SQL do PUT sem indisponibilidade.
     - **Job:** prova com indisponibilidade dentro da janela não encerra no `fecha_em`. Mutação: o fim efetivo do job sem indisponibilidade.
     - **Ponto fixo em SQL**, se o PUT o calcula.

5. **Furo no desenho do RF6, sem cenário: a API cai e o worker fica de pé.**
   - A indisponibilidade só é registrada "no primeiro pulso de volta" (Tech Spec §5.7). Se a API cai perto do `fecha_em` e o worker segue, a rotina encerra e corrige antes de a lacuna existir, e o tempo devolvido se perde.
   - **Exigido:**
     - decidir na §5.6. Por exemplo: o job não encerra com `pulso_da_api.ultimo_em` mais velho que 30 s;
     - o cenário em `encerrar-provas.int.test.ts`, com o pulso parado;
     - mutação: o job sem olhar o pulso.

6. **O caso "job rodando duas vezes" não fica vermelho com a mutação declarada** (cenarios.md:52).
   - Em sequência, a segunda execução vê `estado = encerrada` e para. Tirar a trava do `encerrar` deixa o teste verde.
   - **Exigido:** duas execuções em paralelo com ordem forçada (`WriteBlockTrigger` na entrega). Ou manter em sequência e trocar a mutação para "tirar a conferência do estado".
   - Falta também o cron duplicado (entrega ao menos uma vez, D49): duas execuções de `sistema.encerrar-provas-vencidas` dão um lote por aplicação.

7. **Corridas sem ordem forçada** (cenarios.md §3).
   - **(d) estender × estender:** diz "duas transações", sem quem segura quem.
   - **(g) segunda chamada dupla:** diz "ao mesmo tempo", sem quem segura quem.
   - **(c):** não tem mutação, aceitável só se o `encerrar` não muda. Mas o job é um caller novo e o PUT ganhou a conferência do limite. Declare que o teste de hoje cobre os dois, ou acrescente "resposta × job".
   - **Corrida que falta, saída × saída:** a fila reenvia no prazo, ou o `blur` e o `visibilitychange` saem juntos.
     - Mesma chave, em paralelo: soma 1.
     - Chaves diferentes, em paralelo: soma 2.
     - Mutação: `saidas = valor lido + 1` (perde atualização).

8. **RF8: o teste de "ordens diferentes" depende de sorte** (cenarios.md:34).
   - Com o `crypto.randomInt` real, dois alunos podem sair com a mesma ordem, ou com a ordem original. Com 5 questões, a chance é de 1/120.
   - Nesse caso o teste falha à toa, e a mutação "correção pela posição na tela" sobrevive.
[… 50 linhas cortadas]

## privacy-guardian · 1ª rodada · REPROVADO · 2026-11-23 13:02:15 · `tasks/prd-avaliacao-e-correcao/revisao-spec.md`

VEREDITO: REPROVADO

Revisão do desenho em `tasks/prd-avaliacao-e-correcao/techspec.md`, junto com o PRD, o `cenarios.md` e as duas linhas novas de `docs/lgpd.md`. Conferi também o código que já existe e que o desenho reaproveita: `classificacao.ts`, `expurgo-da-escola.repository.ts`, `leitura-do-titular.ts`, `matriz.ts` e o `tutor.repository.ts`. Há três bloqueantes.

**Item por item**

| Item | Situação |
|---|---|
| Campo pessoal novo na tabela de dados | Garante pela linha "Tempo da prova online" (§7). A classificação e a retenção dessa linha estão erradas (B1 e B2) |
| Nenhum campo proibido para aluno | Garante. Não entra e-mail, telefone, CPF, foto, endereço, nascimento nem diagnóstico |
| Adaptação, não diagnóstico | Garante quanto ao motivo: `tempo_adicional` tem só o percentual, sem campo de motivo, e o cenário RF3 testa com `.strict()`. A classificação como dado sensível falta (B1) |
| DTO explícito | Garante (§4, §7 DTO). A prova do aluno não traz colega nem saídas, e há teste de contrato (cenário RF9) |
| Autorização por objeto | Garante pelo `canAplicarNaTurma` e pela turma atual mais os convocados (§6, §7). Na coordenação, `correcao.ler` já é `nunca` na matriz |
| Não encontrado igual a sem permissão | Fica implícito, com furo (B3) |
| Bucket privado / URL assinada | Não se aplica |
| Convite | Não se aplica |
| Exportação auditada | Não se aplica |
| Erro sem stack trace | Garante. São códigos tipados (§7c) |
| Logs | Garante: "só ids e códigos" (§7) |
| Auditoria obrigatória | Garante. Não há leitura da coordenação, nota nem permissão nova. As ações novas estão em §7, e `atividade.aplicada` leva a contagem de quem tem tempo adicional, sem dizer quem |
| IA / envio externo | Não se aplica (§8). A memória do Tutor seleciona colunas explícitas (`tutor.repository.ts`, perto da linha 441), então as colunas novas não chegam ao provedor |
| Conversa do Tutor e camada de rede | Não se aplica. Aqui só trava o Tutor |
| Exclusão e eliminação | Garante: aluno com `on delete cascade` (§3) |
| Retenção configurável por escola | Não garante (B2) |
| Seed e fixture | Sintéticos: o relógio dos testes é deslocado e as fixtures são as de hoje |
| Pergunta de fechamento | O arquivo do titular entra nas duas versões (§7), e o "para onde foi" é "nenhum provedor". Responde, mas guarda dado além do prazo prometido (B2) |

Campos pessoais tocados: em `tentativa_atividade`, entram `limite_base_em`, `ordem`, `envio`, `saidas_da_aba` e `ultima_chave_de_saida`. Tabelas novas: `tempo_adicional` (aluno, percentual, `concedido_por`), `extensao_de_tempo` (aluno ou a turma, minutos, `concedida_por`) e `convocado_da_segunda_chamada`. `pulso_da_api` e `indisponibilidade` não têm pessoa.

Fora da tabela de dados do docs/lgpd.md: nenhum campo. O problema é a classificação errada do tempo adicional (B1).

Autorização por objeto: ok, com a ordem das conferências no `comecar` errada (B3).

Logs: limpos no desenho.

Auditoria: presente.

Envio externo: nenhum. Não há IA nesta fase.

Seed/fixture: sintético.

Bloqueantes:

1. **O tempo adicional por aluno é adaptação, e adaptação é dado sensível (art. 11). O desenho o trata como dado comum.**
   - **Onde:** Tech Spec §3 (`tempo_adicional`) e §7; linha nova "Tempo da prova online" de `docs/lgpd.md`.
   - **O que está errado:**
     - O exemplo da D35 é literalmente "fonte ampliada, tempo +50%", classificado como dado sensível.
     - A linha 54 de `docs/lgpd.md` põe "tempo extra" como adaptação, sensível, com base em "obrigação da escola com inclusão".
     - A linha nova usa "execução de contrato educacional". Essa base não existe no art. 11.
     - O parágrafo da linha 175 ("Não existe vínculo entre aluno e adaptação, em tabela nem em coluna (D35)") deixa de ser verdade com esta tabela.
     - Um +100% por aluno diz quase tanto quanto o laudo.
   - **Correção exigida:**
     - Na linha nova, marcar o `tempo_adicional` como dado sensível (art. 11, adaptação, D35), com a mesma base e a mesma nota "a confirmar com advogado" da linha 54.
     - Reescrever o parágrafo da linha 175, dizendo que o vínculo existe só em `tempo_adicional`, preso à prova e sem motivo.
     - Dizer isso na §7 da Tech Spec.
     - Proibir que a auditoria `atividade.janela_alterada`, o log ou a métrica carreguem o percentual por aluno (hoje §7 diz só "nunca minutos por aluno junto do nome").

2. **A retenção prometida ("segue a tentativa") não tem mecanismo, e o desenho leva ao prazo errado.**
   - **Onde:** Tech Spec §3 e §7 (linha Retenção).
   - **O que está errado:**
     - `tempo_adicional`, `extensao_de_tempo` e `convocado_da_segunda_chamada` dependem da `atividade_aplicada`, não da tentativa.
     - A `atividade_aplicada` é `fixo('registro_de_decisao', FIM_DE_CONTRATO)` (`packages/shared/src/privacidade/classificacao.ts:108`).
     - O expurgo de `trabalho_do_aluno` apaga só `tentativa_atividade` (`packages/core/src/retencao/expurgo-da-escola.repository.ts:52`).
     - Resultado: o tempo adicional (sensível) e a convocação de quem faltou duram até o fim do contrato. O aluno que faltou e nunca teve tentativa fica com a linha sem ter "tentativa" a seguir. A retenção configurável por escola não vale para essas tabelas.
     - O teste de arquitetura obriga a classificar toda tabela, mas a spec não diz em qual classe.
   - **Correção exigida:**
     - Na §3 e na §7, classificar as três tabelas como `categoria(['trabalho_do_aluno'], 'aluno_id')`, com `concedido_por`, `concedida_por` e `chave` em `COLUNAS_FORA_DO_ARQUIVO`.
     - Pôr as três tabelas na categoria `trabalho_do_aluno` do expurgo, com a regra do ano `encerrado` além do prazo da escola. Elas já têm `ano_letivo_id`.
     - Decidir o que acontece com a extensão de turma (`aluno` nulo).
     - Acrescentar a `cenarios.md` o caso "ano encerrado além do prazo apaga tempo adicional, extensão e convocado; o ano `em_curso` não perde nada", com a mutação "tirar a tabela da lista do expurgo".

3. **"Não encontrado" e "fora da janela" podem responder diferente para quem não tem acesso.**
   - **Onde:** Tech Spec §5, passo 2, e §4 (`comecar`).
   - **O que está errado:** o texto confere a janela antes da convocação ("fora da janela, `PROVA_FORA_DA_JANELA`; não convocado, inexistente"). Um não convocado que chame `comecar` de uma segunda chamada fora da janela recebe `PROVA_FORA_DA_JANELA`, e isso confirma que o registro existe (regra 20, item 6; regra 10, item 6). O cenário RF10 só testa dentro da janela.
   - **Correção exigida:**
     - Fixar na §5 a ordem: primeiro acesso (escola, turma atual, convocado), depois janela, depois limite. Vale para `comecar`, `GET /prova`, `PUT respostas` e `saidas-da-aba`.
     - Acrescentar o cenário "não convocado e aluno de outra turma, fora da janela, recebem `NAO_ENCONTRADO`", com a mutação "conferir a janela antes do acesso".

Recomendações:
- **Matriz de permissões:** declarar nas §4 e §6 a entrada das rotas novas (`acompanhamento`, `extensoes`, `janela`, `segunda-chamada`), com coordenação e rede em `nunca`. O `contracts.test.ts` hoje cobre só `saidas`, e o PRD também nega à coordenação o tempo adicional e o limite.
[… 7 linhas cortadas]

## conformidade-reviewer · 1ª rodada · REPROVADO · 2026-11-23 13:02:37 · `tasks/prd-avaliacao-e-correcao/revisao-spec.md`

VEREDITO: REPROVADO

Caminhos de escrita em Nota: nenhum. A F6 não cria `Nota` (PRD §3 e §6; Tech Spec §1 e §8). O caminho novo, a rotina `atividade.encerrar-vencidas` (§5 itens 5 e 6), chama o `encerrar` atual. Ele grava a correção e o lote nasce `pendente`, sem `Nota`. Os caminhos para `Nota` com autor humano: não se aplica nesta spec.

Decisão autônoma sobre aluno: ausente. O envio no limite (§5.5) e o encerramento pela rotina (§5.6) não decidem aprovação, reprovação nem encaminhamento. A segunda chamada (§5.9) é ato do professor. A saída da aba não tem efeito automático (§7b).

Aprovação registrada: ok. Não há saída de IA nova (§8). O gabarito e a habilidade passam pelo professor ao aplicar. O lote da original e o da segunda chamada nascem pendentes, com destaques e registro da validação (§7b, cenários §1 RF10 e §2). A exceção da D47 não aparece fora do Tutor.

Supervisão do tutor: há uma lacuna na §5 item 10. O desenho não deixa claro quando a trava termina para o aluno que segue fazendo a prova depois do `fecha_em` (ver bloqueante 3).

Autonomia declarada e visível: sim. Não há agente nem nível novo. O texto atual de `correcao_de_objetiva` ("Corrige... e avisa o professor", nível 2, em `packages/shared/src/time/funcoes.ts`) continua verdadeiro com o encerramento pela rotina.

Bloqueantes:

1. **Saída da aba ao vivo, sem o aviso fixo.** Tech Spec §4 (`GET …/acompanhamento`: "saídas (nome só aqui)") e §7 (DTO do acompanhamento).
   - O que está errado: a API entrega a contagem nominal de saídas no painel ao vivo, relido a cada 15 s (§7c) enquanto a prova acontece. O PRD (RF9) e a AIA `docs/aia/correcao-de-objetiva.md` (1.4, item 9) põem a contagem só no lote, "junto dos destaques". A §9 (Painel da atividade) e os cenários §4 ("Acompanhar") não mostram a coluna nem o aviso fixo, que a D88(4) exige "sempre". Uma contagem nominal que sobe durante a prova se aproxima da janela sobre o comportamento (regra 70, item 7) e chama o professor a agir durante a prova. Se a tela for projetada, expõe o aluno na frente da turma (D88(5)).
   - Correção exigida: tirar `saidas` do DTO do acompanhamento e mostrar a contagem só no lote, como estão o PRD e a AIA. Incluir no teste de contrato que o acompanhamento não traz `saidas`. Se o Joaquim quiser a contagem ao vivo, isso muda o RF9 e a AIA, e a tela precisa do aviso fixo e de teste.

2. **A regra "saída da aba sem consequência" não tem teste.** Cenários §1 RF9.
   - O que está errado: o PRD (RF9) diz "não é destaque nem trava a aprovação", e a AIA (N10) pede "o resultado da correção é idêntico com zero e com muitas saídas". Nenhum cenário prova isso. Também não há teste de que a coluna "Saiu da aba" só aparece com o aviso fixo da D88 e só em avaliativa.
   - Correção exigida: acrescentar três testes.
     - Integração: a mesma tentativa com 0 e com N saídas dá a mesma correção e os mesmos destaques. A mutação que derruba é somar saída ao destaque.
     - Integração: o lote com saídas > 0 e nenhum destaque aprova sem abrir nada. A mutação que derruba é travar a aprovação pela saída.
     - Unidade web na tela Aprovar: a coluna vem sempre com o aviso fixo e não aparece em lote não avaliativo.

3. **Fim da trava do Tutor.** Tech Spec §5 item 10 e cenários §2.
   - O que está errado: a §5.10 trava o Tutor "dentro da janela efetiva", mas não define se ela inclui a extensão de um só aluno ("inclusive além da janela", RF4) e o tempo devolvido por indisponibilidade (§5.3). Esses dois podem passar do `fecha_em`. Se o Tutor destrava, o aluno ainda em prova tem Tutor e, no modo sala, a busca na web. Isso fere a regra 30, item 10, e a regra 70, item 4c ("sempre desligada em avaliação"). A exceção da D47 depende da política aplicada no servidor.
   - Correção exigida: definir que, para cada aluno, a trava vai até o fim da janela da turma ou até o limite efetivo dele, o que vier depois, com extensões e indisponibilidades. A decisão do Joaquim de travar só na janela fica mantida. Acrescentar um cenário em `tutor.int.test.ts`: o aluno estendido além do `fecha_em` continua com o Tutor travado até o limite dele, e o colega sem extensão destrava. A mutação que derruba é usar só o `fecha_em` mais as extensões da turma.

4. **Suspensão da função no caminho da rotina.** Tech Spec §5 item 6 e cenários §2.
   - O que está errado: a rotina é um caminho novo que dispara a correção de objetiva, uma função de alto risco. Nenhum cenário prova que ela respeita a função suspensa. O PRD §7 promete "ao encerrar não há correção", e o procedimento de suspensão é parte da AIA (regra 70, item 6a). No `encerrar` atual, a checagem `exigirAtiva('correcao_de_objetiva')` depende do contexto da escola, que no job não vem do token.
   - Correção exigida: acrescentar um cenário em `apps/worker/test/encerrar-provas.int.test.ts`. Com `correcao_de_objetiva` suspensa na escola A, a rotina encerra a prova vencida, as respostas ficam e nenhum lote nem correção é criado. A mutação que derruba é chamar a correção sem a conferência.

5. **A AIA da função muda de escopo e a Tech Spec não a atualiza.** Tech Spec §7b e §11.
   - O que está errado: `docs/aia/correcao-de-objetiva.md` (1.4, item 1) diz que a correção "dispara... quando o professor a encerra". Pela §5.6, ela também dispara sozinha no fim da janela. A AIA, que a regra 70 (item 6a) e a D60 exigem, passa a descrever outra função. As etapas 2 a 6 ficam para a F6d, mas a etapa 1 precisa valer já.
   - Correção exigida: listar na Tech Spec a atualização da etapa 1 da AIA, nos itens 1.4/1 (o gatilho: o professor ou a rotina no fim efetivo) e 1.4/9 (onde a contagem aparece, conforme o bloqueante 1). Ela entra como entregável da tarefa que constrói a rotina.

Recomendações:

- **Métrica do PRD §9.** Reescrever "Provas com duração por professor por mês" como número agregado (total ou média por escola), nunca nominal (regra 70, item 9; D64). Nenhuma tela nem consulta nossa deve guardar a contagem por professor.
- **Tempo adicional limitado pela janela.** Com o `min(..., fecha_em)` da §5.2, o tempo adicional pode sumir sem aviso quando a janela é curta. O resumo de Aplicar deveria avisar quando o tempo de algum aluno marcado fica limitado pelo fim da janela.
- **Arquivo do titular.** A §7 inclui as colunas novas da tentativa no arquivo do titular, que a coordenação gera, e o cenário RF9 diz que nenhuma rota da coordenação devolve `saidas`. Vale declarar essa exceção (direito do titular, por tentativa, nunca somada) e listá-la no teste de contrato. A decisão é do `privacy-guardian`.
- **Segunda chamada.** Ao criar a aplicação nova (§5.9), reaproveitar as mesmas checagens do `aplicar`: só atividade objetiva, e versão adaptada só com a entrega `aprovada`, com cenário próprio. Hoje só o gatilho do banco cobre.
- **Registro da validação.** A §7, que diz que o `apresentado` "guarda só que a coluna foi mostrada", poderia citar o trecho da D70 ("junto do registro da validação") e explicar que a contagem fica na tentativa, que é imutável depois do envio. Isso evita reabrir a leitura na F6d.
- **Fora do meu escopo.** A §7b e a lista de discursiva e redação estão coerentes com o corte para a F6c: a prova aplica só `atividade_objetiva`, e não há campo nem prompt de nota. O D45 e o item 8 (conversa do professor com o chat) não são tocados.

Arquivos lidos:
- tasks/prd-avaliacao-e-correcao/prd.md
- tasks/prd-avaliacao-e-correcao/techspec.md
- tasks/prd-avaliacao-e-correcao/cenarios.md
- docs/aia/correcao-de-objetiva.md
- apps/api/src/atividade/atividade-aplicada/atividade-aplicada.service.ts
- apps/api/src/tutor/tutor.repository.ts

## infra-guardian · 1ª rodada · REPROVADO · 2026-11-23 13:02:50 · `tasks/prd-avaliacao-e-correcao/revisao-spec.md`

VEREDITO: REPROVADO

Caminho quente tocado: prova | fila | migration (e a trava do Tutor, que roda a cada turno)

Rate limit: ok. O limite por usuário e por escola de hoje continua valendo (`LIMITE_REQ_USUARIO_MIN=120`, `LIMITE_REQ_ESCOLA_MIN=30000`, pelo `sub` e pelo `esc` do token). Há ainda um balde de 30/min por usuário em `comecar` e `saidas-da-aba`. Nada é limitado por IP.

Fila e prioridade: ok, com ressalvas nas recomendações.

Concorrência: há corrida na §5, passo 6 (estender × rotina) e na §5, passo 8 (chave da saída da aba).

Índice e paginação: ok. Os laços têm teto (200 aplicações por job, uma turma no acompanhamento). Os ajustes estão nas recomendações.

Degradação de IA: não se aplica.

Migration: compatível.

Métrica e alerta: faltando.

Bloqueantes:

1. **§5, passos 6 e 7, e §7c "Dependência cai": a rotina encerra a prova durante a queda da API.** A indisponibilidade só é gravada "no primeiro pulso de volta". Com a API fora e o worker de pé, que é a queda mais comum (OOM, deploy que falhou), a rotina por minuto vê o limite vencido, encerra, corrige e cria o lote. Quando a API volta, o tempo devolvido chega com a prova já encerrada. O mesmo acontece quando o banco volta: a rotina pode rodar antes do primeiro pulso da API. E nos até 10 s entre a API subir e o primeiro pulso, o PUT recusa com `TEMPO_ESGOTADO` uma resposta que estava dentro do tempo, e a tela mostra "O tempo acabou". Isso viola a regra 80, item 6.
   - **Correção exigida:**
     - O `limiteDaTentativa` passa a tratar a lacuna aberta (`now() − pulso.ultimo_em > 30 s`) como indisponibilidade em curso, até agora. Vale no PUT, na leitura e na rotina.
     - A rotina não encerra nada com o pulso velho.
     - A instância dá o primeiro pulso antes de aceitar tráfego.
     - Sem um alerta, o pulso morto com a API respondendo estica toda prova sem fim (e deixa o Tutor da turma travado). Por isso: alerta "pulso parado com a API respondendo", com runbook, e um teto declarado para a lacuna aberta.
     - Testes, com ordem forçada: rotina com o pulso velho não encerra; PUT logo depois da volta, dentro do tempo devolvido, grava.

2. **§5, passo 6, e `cenarios.md` §3: o padrão "busca, verifica, grava" entre a rotina e a extensão.** O job "confere o fim efetivo e as tentativas e chama o `encerrar` de hoje". A trava (`lock`, `for update`) só é tomada dentro do `encerrar`. Uma extensão gravada entre a conferência e a trava faz o job encerrar uma prova que acabou de ser estendida. A lista de corridas da §7c não traz estender × rotina.
   - **Correção exigida:**
     - O fim efetivo é conferido dentro da transação, depois do `for update` da aplicação.
     - `estender` toma a aplicação em `for share` e confere o estado ali dentro.
     - Corrida nova, (h) estender × rotina, com ordem forçada e com a mutação "conferir antes da trava".

3. **§5, passo 8: a saída da aba não é idempotente sob reenvio.** A trava é só a última chave (`ultima_chave_de_saida is distinct from $chave`). Na sequência A, B e reenvio de A, que é exatamente a rede da escola oscilando, a contagem chega a 3 em vez de 2. É um fato sobre um menor, mostrado ao professor. O cenário do RF9 só cobre "a mesma chave de novo".
   - **Correção exigida, uma das duas:**
     - A §5 declara que o cliente envia as saídas em série: uma por vez, a seguinte só depois da confirmação da anterior, e reenvio antes da próxima. Teste na web com A, queda, B e A.
     - Ou o servidor guarda as chaves já contadas, com `unique (escola, tentativa, chave)`. Teste de integração com A, B, A.

4. **§5, passo 4, e §9: resposta de prova perdida no cliente.** A regra 80, item 6, diz que nenhuma resposta de prova se perde. Dois furos:
   - O aluno responde no minuto 38, a rede da escola cai e volta no 41 (limite no 40). A fila recebe `TEMPO_ESGOTADO`, o limite não andou, e a tela diz "suas respostas salvas foram enviadas" sem dizer que há respostas que não chegaram. A extensão do professor (o desvio declarado na §11) só recupera essas respostas se a fila continuar viva e a tela continuar relendo o limite. A spec não garante nenhum dos dois.
   - "Sair da prova", com um clique, joga fora a fila em memória se ela morar na rota.
   - **Correção exigida:**
     - A fila vive no nível do app e sobrevive ao fim do tempo e ao "Sair", enquanto a aba está aberta.
     - Com a fila pendente no fim, a tela diz quantas respostas não chegaram e pede para chamar o professor.
     - A tela segue relendo o limite e reenvia quando ele andar.
     - Textos novos em `cenarios.md` §4 e teste de unidade web: fila pendente, `TEMPO_ESGOTADO`, extensão, gravou.

5. **§7c, linha "Carga": o cenário de carga não prova o caminho quente.** O `prova-online.js` tem uma turma (35 × 20), sem critério de aprovação e sem queda da API. A própria §7c estima ~80 req/s com 60 turmas, e a `docs/infra.md` §10 pede prova junto da manhã de segunda.
   - **Correção exigida:**
     - Escala da §7c, ou pelo menos várias turmas por escola nas dez escolas, rodando junto da `FASE=sala`.
     - Passa quando:
       - o p95 do PUT de resposta fica abaixo de 500 ms;
       - nenhuma resposta se perde (enviadas pelo cliente = linhas gravadas);
       - um reinício da API no meio da prova anda o limite e não deixa nenhuma prova ser encerrada durante a queda.
     - Controle negativo que reprova.

6. **§7c, linha "Métrica e alerta": faltam alertas.**
   - O alerta de p95 do salvamento de prova, que a `docs/infra.md` §7 exige, não existe em `infra/grafana/alertas/`, e a spec não o cria agora que a prova é o caminho quente.
   - "Idade da prova vencida aberta" não diz se mede pelo `fecha_em` ou pelo fim efetivo. Medida pelo `fecha_em`, toda prova estendida dispara um alarme falso para quem opera sozinho.
   - **Correção exigida:** alerta de p95 de `PUT …/respostas/:questao` acima de 500 ms, com runbook. O alerta de prova vencida medido pelo fim efetivo, com o runbook dizendo o que fazer. E o alerta do pulso do bloqueante 1.

Recomendações:

- **Ida e volta da rotina (§5, passo 6):** a rotina lista por `fecha_em` passado, então uma prova estendida até 120 min gera um `atividade.encerrar-vencidas` por minuto, que não faz nada. Duas mudanças:
  - Chave de idempotência (escola, minuto) no job, para não acumular jobs com o worker parado.
  - Índice parcial `(fecha_em) where avaliativa and estado = 'aberta'` para a varredura `@Unscoped` entre escolas. O índice da §7c começa por `escola_id`, que não ajuda numa consulta sem escola. Pedir o `EXPLAIN` na tarefa.
- **§7c "Fila e limite":** dizer a fila do `sistema.encerrar-provas-vencidas`. O precedente é `lote` com `naoUrgente: false`, como a `sistema.varrer-temporarios-de-material`.
- **O `encerrar` de hoje no job:** ele filtra por `#noAlcance()` do professor e confere a suspensão no contexto da sessão. A §5 precisa dizer como o job chama o `encerrar` sem professor, sem abrir uma segunda `@Unscoped`.
- **Pulso:** dar conexão própria desde o início, e não "se aparecer" (§13). Com o pool cheio às 10h, a indisponibilidade falsa estica a prova de todas as escolas e o Tutor travado de cada turma.
- **Releitura a cada 30 s:** usar uma leitura leve só do limite (`limiteEm`, `agora`, `envio`), ou um ETag, em vez do `GET /prova` inteiro a cada 30 s com ~2.100 alunos.
- **Trava do Tutor:** `avaliativaAberta` roda a cada turno (~7,5/s no pico). A §5, passo 10, deve escrever a consulta da "janela efetiva" pelo índice `(escola_id, turma_id, …)`, sem o ponto fixo por tentativa, e medir a latência.
- **429 da saída da aba:** não pode parar a fila de respostas. As duas filas ficam separadas no cliente.
- **Migration:** fazer os checks novos em `tentativa_atividade` com `NOT VALID` e `VALIDATE` depois. Trocar o `atividade_aplicada_aberta_unica` criando o índice novo antes de derrubar o antigo.

Arquivos auditados:
- tasks/prd-avaliacao-e-correcao/techspec.md
- tasks/prd-avaliacao-e-correcao/cenarios.md
- tasks/prd-avaliacao-e-correcao/prd.md

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-23 13:09:02 · `tasks/prd-avaliacao-e-correcao/revisao-spec.md`

VEREDITO: APROVADO

Tela vista: não. É revisão de spec e não há tela. Li o diff, a Tech Spec §4 e §9 e os `cenarios.md` §4, e comparei com os 5 bloqueantes da rodada 1.

**Os cinco bloqueantes da rodada 1**
1. **Dado de "Antes de começar" sem rota: resolvido.** Em §4, `GET …/:id/prova` sem tentativa devolve só a janela e a `duracaoMin` do aluno, sem questões e sem gravar. A duração já inclui o tempo adicional e não diz que é adicional. O texto fora da janela ("abre em…" e "fechou às…") está em `cenarios.md` §4 e usa a mesma rota. §9 liga a tela a essa rota.
2. **Estados e erros do aluno: resolvido em quase tudo.**
   - Há texto para sem conexão, fim de tempo, fila pendente ("2 respostas não chegaram. Chame o professor."), 429, fora da janela e prova que ainda não abre.
   - A fila de respostas vive no app e sobrevive ao fim do tempo e ao "Sair" (§9).
   - Ficou uma lacuna menor, na recomendação 1.
3. **Resumo antes de confirmar: resolvido.** Aplicar, Estender ("Ana termina às 10:52 em vez de 10:42"), Mudar janela, Segunda chamada (convocados por nome) e Encerrar ("3 alunos ainda estão fazendo…") mostram o que será decidido antes do botão. O tempo adicional que não cabe na janela é recusado com mensagem que diz o que fazer.
4. **Acessibilidade da tela de foco: resolvido.**
   - O relógio fica fora de região viva. O anúncio `polite` vem a 10, 5 e 1 min, e o fim é `assertive`, com o foco levado ao aviso.
   - O foco entra no título da primeira questão e volta ao título da prova em Atividades.
   - Há teste em `ProvaEmFoco.test.tsx` e axe no e2e.
   - "Tempo esgotado" aparece em texto, não só por cor.
5. **360 px do professor: resolvido.** Aplicar vira lista de uma coluna. Acompanhar vira cartões por aluno. "Saiu da aba" fica dentro do cartão no Aprovar, que mantém o aviso fixo da D88. Os alvos são de 24 px, e de 44 px em Começar, Sair da prova, Estender e Confirmar. Há e2e `celular` das três telas.

**Buraco novo:** nenhum bloqueante.
- §4 tirou `saidas` do acompanhamento e a contagem ficou só em `…/correcao`. Isso é coerente com §9, onde a coluna está só no Aprovar.
- A confirmação de "Encerrar" e o "Sair da prova" de um clique não conflitam: Encerrar é do professor e Sair é do aluno, com o tempo seguindo (D59).

Estados: ok
Acessibilidade: ok
Chromebook fraco: ok. A releitura de `tempo` a cada 30 s é leve e a fila fica no cliente.
Celular: ok. As três telas do professor e a prova do aluno têm layout e e2e.
Ação oficial protegida: sim

Bloqueantes: nenhum

Recomendações:
1. `cenarios.md` §4 não tem texto de erro de carregamento para "Antes de começar" e para a prova. Também falta o erro ao tocar em Começar que não seja fora da janela, por exemplo 5xx ou rede. Acrescentar "Não foi possível abrir a prova. Tente de novo." com "Tentar de novo", como o Acompanhar já tem.
2. "Sair da prova" com fila de respostas pendente não avisa o aluno. Depois de sair, a lista de Atividades poderia mostrar "2 respostas ainda não chegaram" até a fila esvaziar. Sem confirmação extra, para não pesar a saída (D59).
3. A Segunda chamada não tem o 360 px dito de forma explícita, e a lista de convocados é longa. Pedir cartões ou lista de uma coluna, e incluir no e2e `celular`.
4. As recomendações da rodada 1 que ficaram em aberto seguem valendo:
   - horário no fuso da escola;
   - "Tempo esgotado" distinto por texto;
   - fechar a pergunta 3 do PRD.

Arquivos lidos:
- `tasks/prd-avaliacao-e-correcao/techspec.md`
- `tasks/prd-avaliacao-e-correcao/cenarios.md`
- `tasks/prd-avaliacao-e-correcao/revisao-spec.md`

## tenancy-guardian · 2ª rodada · REPROVADO · 2026-11-23 13:09:16 · `tasks/prd-avaliacao-e-correcao/revisao-spec.md`

VEREDITO: REPROVADO

Tabelas verificadas: `atividade_aplicada` (colunas novas e `segunda_chamada_de`), `tentativa_atividade` (colunas novas), `saida_da_aba` (nova), `tempo_adicional`, `extensao_de_tempo`, `convocado_da_segunda_chamada`, e `pulso_da_api` e `indisponibilidade` (as duas exceções declaradas na §11). Comparei com o schema de hoje em `packages/core/src/db/schema/tentativa-atividade.ts` e `resposta-atividade.ts`.

Queries verificadas: resolução do alcance nas rotas do aluno (`comecar`, `prova`, `tempo`, PUT, `saidas-da-aba`); rotas do professor pelo `canAplicarNaTurma`; a listagem `@Unscoped` da rotina e o job por escola; `encerrarPeloLimite`; a soma de saídas por chave nova; a validação de `alunoId` e `alunoIds` no tempo adicional, na extensão e na segunda chamada; `minhas-atividades` com o filtro de convocado; matriz com coordenação e rede em `nunca`.

Teste de isolamento: presente e efetivo. Conferi as duas correções da rodada 1:
- **Ordem do alcance (bloqueante 1): resolvido.** O alcance vem antes da janela em techspec §5.2 e §6. Há o cenário "não convocado e aluno de outra turma, fora da janela: `NAO_ENCONTRADO`, nunca `PROVA_FORA_DA_JANELA`" em cenarios §1b, linha 71, com a mutação "conferir a janela antes do alcance". Se a ordem se inverter, o teste quebra.
- **Job de A com provas vencidas em A e em B (bloqueante 2): resolvido.** Está em cenarios §2, linha 79, e em techspec §6. A prova de B segue aberta, sem lote e sem auditoria, com a mutação "tirar o `escola_id` da listagem do job". Sem a cláusula, o job de A encerraria a prova de B e o teste quebraria.

Bloqueantes:
1. A tabela nova da correção não tem `ano_letivo_id` e rompe o padrão da tentativa.
   - **Onde e o que está errado:** techspec §3, linha 35. A `saida_da_aba` foi definida como `escola*, tentativa*, chave* uuid, em*`. Isso tem quatro problemas:
     - Falta `ano_letivo_id`. A tabela pertence à tentativa, que pertence a um ano, então viola a regra 10, item 2.
     - Contradiz a própria spec: a §3 (linha 49) pede "FKs compostas com escola e ano" e a §6 (linha 106) diz que "tabela nova tem `escola_id` e `ano_letivo_id`". O texto da §6 passou de "fora as duas operacionais" para "fora as operacionais". Isso deixa a `saida_da_aba` passar como exceção sem estar declarada na §11.
     - O cenário "contexto de outro ano com id de B: vazio" (cenarios §1b, linha 73) não tem como filtrar o ano nessa tabela. O expurgo por ano encerrado (cenarios §2, linha 86) e o arquivo do titular "pelo `aluno_id`" (cenarios §2, linha 87) também ficam sem a coluna de que precisam.
     - A FK pelo par `(escola, tentativa)` aponta para um par que hoje não é único em `tentativa_atividade`. A spec também não declara o `on delete cascade` que leva a tabela junto na eliminação do aluno.
   - **Correção exigida:**
     - Em §3, a `saida_da_aba` passa a ter `id` uuidv7, `escola_id`, `ano_letivo_id`, `atividade_aplicada_id`, `aluno_id`, `chave` e `em`.
     - A FK é composta, `(escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id)`, para a chave única `tentativa_atividade_uma_por_aluno`, com `on delete cascade`. É o mesmo padrão de `resposta_atividade`.
     - A chave única fica `(escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id, chave)`.
     - Em §6, nomear as duas exceções (`pulso_da_api` e `indisponibilidade`) em vez de "as operacionais".
     - Em cenarios §1b, linha 73, incluir a `saida_da_aba` explicitamente no caso "repository com contexto de outro ano".

Recomendações:
- Na techspec §5.6, deixar escrito que o job por escola recebe o `escolaId` só no payload gravado pela rotina, monta o contexto a partir dele e lista de novo com o escopo da escola. Hoje isso está implícito.
- Em cenarios §3 (i), somar a mutação "tirar o índice único de `saida_da_aba`" à de `saidas = lido + 1`.

## conformidade-reviewer · 2ª rodada · REPROVADO · 2026-11-23 13:10:15 · `tasks/prd-avaliacao-e-correcao/revisao-spec.md`

VEREDITO: REPROVADO

Os cinco bloqueantes da rodada 1 foram resolvidos. A correção de idempotência da saída da aba, porém, abriu um bloqueante novo.

**Os cinco bloqueantes da rodada 1**

1. **Saídas no acompanhamento ao vivo: resolvido.** A rota `acompanhamento` (techspec §4, linha 61) agora diz "sem saídas". O §7 confirma que a contagem fica só no lote. O cenário que impede a volta está em `cenarios.md` §1, RF9, linha 53, com o teste de contrato e a mutação "expor no DTO". A linha 58 de `docs/lgpd.md` também passou a dizer "no lote".
2. **Saída sem consequência, sem teste: resolvido.** Os testes estão em `cenarios.md` §1, RF9:
   - linha 51: com 0 e com 9 saídas, a correção e os destaques são os mesmos; o lote aprova sem abrir ninguém; o PUT segue gravando;
   - linha 50: a prova 2 começa em 0;
   - linha 55: a coluna aparece só em avaliativa e sempre com o aviso fixo.
3. **Fim da trava do Tutor: resolvido.** A techspec §5.10 trava por aluno até o fim da janela ou o limite dele, o que vier depois, e o §5.4 põe o Tutor entre quem chama `limiteDaTentativa`. Os cenários estão em `cenarios.md` §2, linhas 89 a 91: o aluno estendido segue travado e o colega destrava; a mutação é a que eu pedi.
4. **Suspensão no caminho da rotina: resolvido.** A techspec §5.6 cria o `encerrarPeloLimite`, que confere a suspensão na escola do job. O cenário está em `cenarios.md` §2, linha 83: com a função suspensa, a prova encerra, as respostas ficam, não há lote e ela não volta a ser listada.
5. **Etapa 1 da AIA: resolvido.** A techspec §7b põe a atualização dos itens 1.4/1 e 1.4/9 como entregável da tarefa da rotina. Hoje `docs/aia/correcao-de-objetiva.md`, no item 1.4/1, ainda diz que a correção dispara "quando o professor a encerra". Isso é o que a tarefa vai mudar.

**O buraco novo**

Para não contar a mesma saída duas vezes, a correção criou a tabela `saida_da_aba` com uma coluna `em*`. Ela guarda o horário de cada saída da aba de um menor durante a prova. Isso deixa de ser "contagem" e vira uma linha do tempo da navegação dele.

```
caminhos de escrita em Nota: nenhum. A F6 não cria `Nota`, e a rotina só encerra e cria o lote pendente (techspec §5.6, §7b) — todos com autor humano? não se aplica
Decisão autônoma sobre aluno: ausente. O envio no limite e o encerramento pela rotina não decidem aprovação, reprovação nem encaminhamento; a segunda chamada é ato do professor
Aprovação registrada: ok. Não há IA nova (§8); o lote da original e o da segunda chamada nascem pendentes; a exceção da D47 não aparece fora do Tutor
Supervisão do tutor: ok. A trava é por aluno até o limite efetivo dele (§5.10), com cenário. Uma lacuna menor vai nas recomendações
Autonomia declarada e visível: sim. Não há agente nem nível novo; "corrige e avisa o professor" (nível 2) continua verdadeiro com o encerramento pela rotina
Bloqueantes:
1. tasks/prd-avaliacao-e-correcao/techspec.md:35 (§3, `saida_da_aba ... chave* uuid, em*`) e docs/lgpd.md:58.
   O que está errado: a coluna `em` grava a hora de cada saída da aba, por tentativa. A regra 70, item 7, diz que a navegação do aluno não é medida e que a única exceção é a *contagem* de saídas. A D70 diz que o registro nunca vira histórico do aluno. Uma série de horários de saída é exatamente a janela sobre o comportamento que a regra proíbe, só que mais fina que a contagem. A coluna também não está no mapa: a linha 58 do docs/lgpd.md declara `saida_da_aba` "só para não contar duas vezes", e para isso basta a chave (regra 20, item 1). Nenhum teste impede que um horário entre ali.
   Correção exigida: tirar `em` da `saida_da_aba`, que fica com `(escola, tentativa, chave)` e o índice único. Escrever no §3 que a tabela não guarda tempo. Acrescentar a cenarios.md um teste de schema, no padrão de `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts`: a `saida_da_aba` não tem coluna de tempo além das três. A mutação que o derruba é acrescentar uma coluna `timestamptz`.
Recomendações:
- O Tutor só tem teste da trava com extensão (cenarios.md §2:90). Falta o caso de uma indisponibilidade que empurra o limite do aluno além do `fecha_em`, com o Tutor ainda travado. Assim prova-se que o Tutor chama mesmo `limiteDaTentativa` e não uma conta própria.
- No celular, "Saiu da aba" fica dentro do cartão do aluno (cenarios.md §4, 360 px), mas o aviso fixo está descrito "acima da tabela". O teste em `Aprovar.test.tsx` deveria conferir o aviso também no layout de 360 px.
- O Acompanhar mostra "Fazendo · termina às 10:52" por aluno. Na tela projetada, isso revela quem tem tempo adicional, que é dado sensível pela D35. Vale levar ao `privacy-guardian` e ao `frontend-reviewer` um piso no mesmo espírito da D88(5).
- Em cenarios.md §2:87, o arquivo do titular fala de "as quatro tabelas pelo `aluno_id`", mas a `saida_da_aba` não tem `aluno_id`, só a tentativa. Dizer por onde ela entra, e confirmar com o `privacy-guardian`.
- A pergunta 2 do PRD (texto do aviso fixo) segue aberta. A proposta "Sozinho, não indica cola." é melhor que "Não é prova de nada", mas precisa da palavra do Joaquim antes da tarefa de tela.
```

Arquivos lidos: `tasks/prd-avaliacao-e-correcao/techspec.md`, `tasks/prd-avaliacao-e-correcao/cenarios.md`, `tasks/prd-avaliacao-e-correcao/prd.md`, `docs/lgpd.md`, `docs/aia/correcao-de-objetiva.md`, `docs/decisoes.md` (D70, D88).

## privacy-guardian · 2ª rodada · REPROVADO · 2026-11-23 13:10:21 · `tasks/prd-avaliacao-e-correcao/revisao-spec.md`

VEREDITO: REPROVADO

**Os três bloqueantes da rodada 1 foram resolvidos.** A troca de `ultima_chave_de_saida` pela tabela `saida_da_aba` abriu dois bloqueantes novos, os dois na Tech Spec §3, linha 35.

**Bloqueantes da rodada 1**

| Rodada 1 | Situação | Onde |
|---|---|---|
| B1 — tempo adicional como dado sensível | **Resolvido.** O tempo adicional tem linha própria como adaptação (art. 11, D35), com a mesma base da linha 54 e a nota "a confirmar com advogado". O parágrafo "não guarda" foi reescrito, a §7 diz "sensível", e a §7 junto com o cenário §2/85 proíbe o percentual por aluno em auditoria, log e métrica. | `docs/lgpd.md:60`, `:176-179`; techspec §7:115-116; cenarios §2:85 |
| B2 — retenção das três tabelas | **Resolvido para as três.** Elas ficam em `trabalho_do_aluno`, para classificação e expurgo, com a extensão da turma saindo junto. Há cenário de expurgo (ano encerrado contra ano em curso) e o arquivo do titular fica sem autor nem `chave`. | techspec §3:50, §7:118; cenarios §2:86-87 |
| B3 — ordem alcance/janela | **Resolvido.** A §5.2 fixa a ordem alcance, depois janela, depois limite, em todas as rotas do aluno. Os cenários pedidos estão lá. | techspec §5.2:78-79, §6:108; cenarios §1b:71, §1 RF10:57 |

**Bloqueantes novos (vieram da correção)**

1. **`saida_da_aba` não se liga ao aluno, não tem ano e não diz o que acontece quando a tentativa é apagada.** Techspec §3:35, §3:49-50, §6:106; cenarios §2:86-87.
   - **O que está errado:**
     - A tabela tem só `escola, tentativa, chave, em`.
     - A §3:49 garante o `on delete cascade` apenas pela coluna `aluno`, que esta tabela não tem.
     - Se a FK para `tentativa_atividade` não apagar em cascata, o problema aparece em dois lugares:
       - o expurgo de `trabalho_do_aluno`, que hoje apaga só `tentativa_atividade` (`packages/core/src/retencao/expurgo-da-escola.repository.ts:52`, `:265`), falha;
       - a eliminação do titular, que desce do aluno para a tentativa, também quebra. Isso fere o direito de eliminação.
     - O cenário §2:87 manda ler "as quatro tabelas pelo `aluno_id`", mas essa coluna não existe aqui.
     - A §6:106 promete `ano_letivo_id` em toda tabela nova que não seja operacional, e esta não tem.
   - **Correção exigida:**
     - Na §3, a FK composta `(escola_id, tentativa_id)` para `tentativa_atividade`, com `on delete cascade`.
     - A classificação fica `categoria(['trabalho_do_aluno'], 'tentativa_id')`, ligada pela tentativa, como `mensagem_agente` faz pela thread.
     - A §6 diz que a tabela segue o ano pela tentativa, ou a tabela ganha `ano_letivo_id`.
     - O cenário §2:87 é corrigido.
     - Acrescentar o cenário "eliminar aluno com saídas registradas apaga as linhas de `saida_da_aba`", com a mutação "FK sem cascade".

2. **`saida_da_aba.em` é um campo pessoal novo que não está declarado, e grava mais do que a D70 permite.** Techspec §3:35; `docs/lgpd.md:58`.
   - **O que está errado:**
     - A linha do mapa justifica a tabela só como "as chaves já contadas, só para não contar duas vezes".
     - `em` grava o instante de cada saída: vira uma linha do tempo do comportamento do aluno durante a prova.
     - A D70 e a regra 70, item 7, autorizam a contagem por avaliação, não o histórico. O falso positivo, segundo a própria D70, cai no aluno com adaptação.
     - Para não contar duas vezes, basta a `chave`.
   - **Correção exigida:**
     - Tirar `em` da §3.
     - Se houver motivo para manter, declarar o campo na linha de `docs/lgpd.md` com finalidade, dizer que nenhuma rota o devolve e pôr no teste de contrato.

**Respostas no formato**

- **Campos pessoais tocados:**
  - em `tentativa_atividade`: `limite_base_em`, `ordem`, `saidas_da_aba`, `envio`;
  - `saida_da_aba` (`chave`, `em`);
  - `tempo_adicional` (percentual, sensível);
  - `extensao_de_tempo`;
  - `convocado_da_segunda_chamada`;
  - `pulso_da_api` e `indisponibilidade` não têm pessoa.
- **Fora da tabela de dados do docs/lgpd.md:** `saida_da_aba.em` (bloqueante 2).
- **Autorização por objeto:** ok. Alcance antes da janela (§5.2), matriz com coordenação e rede em `nunca` (§7:119), cenários §1b.
- **Logs:** limpos no desenho. Só ids e códigos, nunca percentual nem minutos por aluno (§7:116).
- **Auditoria:** presente. `atividade.aplicada` leva quantos têm tempo adicional, sem dizer quem; há também `.janela_alterada`, `.tempo_estendido`, `.segunda_chamada_aplicada` e `.encerrada_pelo_limite`. Não há leitura nova da coordenação nem da rede.
- **Envio externo:** nenhum, sem IA nesta fase (§8). O que esta fase guarda não entra na memória do Tutor (cenario §2:88).
- **Seed/fixture:** sintético. O relógio do banco é deslocado e o sorteio é injetado.
- **Pergunta de fechamento:** responde para tempo adicional, extensão e convocado. Para as saídas da aba só responde depois da correção do bloqueante 1, porque hoje a ligação ao titular não existe.

**Bloqueantes:**
1. Techspec §3:35, §3:49-50, §6:106 e cenarios §2:87: `saida_da_aba` sem ligação ao titular, sem ano e sem cascade declarado, o que quebra a eliminação e o expurgo. Correção: FK com `on delete cascade`, classificação pela `tentativa_id`, cenário corrigido e cenário novo de eliminação.
2. Techspec §3:35 e `docs/lgpd.md:58`: o campo `em` não está declarado e grava o instante de cada saída. Correção: remover o campo, ou declará-lo com finalidade e teste de contrato.

**Recomendações:**
- O cenário §1 RF9:53 diz que "nenhuma rota do aluno devolve `limiteEm`", mas a §4 devolve o `limiteEm` do próprio aluno em `prova` e `tempo`. Trocar para "de colega", para o teste de contrato não contradizer a spec.
- O "Acompanhar" mostra "termina às 10:42" por aluno, o que revela na tela quem tem tempo adicional. Declarar que a tela não entra na aba projetada e não vai para a tela da sala, pelo mesmo raciocínio da D88 (5).
- O tempo adicional é sensível e o motivo de guardá-lo acaba com a prova. Avaliar um prazo mais curto que o de `trabalho_do_aluno`, ou registrar na linha do mapa por que ele fica com a tentativa (prova da integridade, contestação na F6d).

Arquivos consultados:
- tasks/prd-avaliacao-e-correcao/techspec.md
- tasks/prd-avaliacao-e-correcao/cenarios.md
- docs/lgpd.md
- packages/shared/src/privacidade/classificacao.ts
- packages/core/src/retencao/expurgo-da-escola.repository.ts

## test-engineer · 2ª rodada · REPROVADO · 2026-11-23 13:10:43 · `tasks/prd-avaliacao-e-correcao/revisao-spec.md`

VEREDITO: REPROVADO

**Cenários exigidos:** cada RF (RF1 a RF10) com caminho feliz, borda, permissão e isolamento. Para cada rota da §4: a escola sem ano em curso e o vínculo encerrado ao lado do aberto. `limiteDaTentativa` com indisponibilidade em cada chamador. A rotina com o pulso velho, a virada de ano, a função suspensa e duas escolas. As onze corridas, com ordem forçada e mutação que deixa vermelho. Os e2e da regra 40: aplicação e correção de avaliação, e a rede caindo no meio da prova. Saída da aba sem consequência. Expurgo e titular das quatro tabelas.

**Os 15 bloqueantes da rodada 1:**

| # | Situação |
|---|---|
| 1 ano em curso e virada | resolvido (§1b, 1ª linha; §2, linha "ano encerrou"; Tech Spec §5.6) |
| 2 vínculo encerrado, aluno transferido | resolvido (§1b, linhas 2 a 4) |
| 3 permissão na mesma escola, coordenação | resolvido em §1b. A linha de contrato do RF9 ficou contraditória (B7) |
| 4 limite em um lugar só, integração por chamador | **em parte**: só o PUT e a rotina têm cenário (B1) |
| 5 API cai, worker de pé | resolvido (§2, "pulso parado há 1 min"; RF6, lacuna aberta e "tráfego depois do primeiro pulso"). A decisão do teto abriu um buraco novo (B2) |
| 6 job duas vezes em paralelo, cron duplicado | resolvido (§3 f) |
| 7 corridas sem ordem | (d), (h) e (c) resolvidos. A saída × saída entrou sem ordem forçada (B3) |
| 8 sorteio | resolvido (RF8 e cabeçalho) |
| 9 saída sem consequência | resolvido (RF9, linhas 50, 51 e 55) |
| 10 429 por usuário | resolvido (§2, última linha) |
| 11 e2e da rede caindo e do professor aplicando | **não resolvido no `cenarios.md`** (B6) |
| 12 encerrar antes do fim | resolvido (RF5) |
| 13 função suspensa no job, auditoria sem `alunoId` | resolvido (§2) |
| 14 tempo adicional que não cabe | resolvido (RF3, com o limite de 50 contra 60 min) |
| 15 relógio adiantado | resolvido (RF6, `ProvaEmFoco.test.tsx`) |

**Cobertos:** os listados acima como resolvidos, mais as corridas (a), (b), (c), (d), (e), (f), (g) e (h), e a carga com controle negativo (§5).

**Bloqueantes:**

1. **Tech Spec §5.4 e §10, contra `cenarios.md` §1 RF6 e §2: só dois dos chamadores de `limiteDaTentativa` têm cenário com indisponibilidade.**
   - A §5.4 diz que a saída, `prova`, `tempo` e o Tutor chamam a mesma função. O `cenarios.md` só tem o PUT (RF6, linhas "PUT com uma indisponibilidade…" e "PUT logo depois da volta…") e a rotina (§2, "indisponibilidade dentro da janela").
   - **Correção exigida:** uma linha de integração para cada chamador que falta:
     - a saída aceita depois do limite original, com 5 min de indisponibilidade dentro da prova;
     - `tempo` e `prova` devolvem `limiteEm` com o tempo devolvido;
     - o Tutor segue travado durante o tempo devolvido.
   - **Mutação de cada uma:** aquele chamador calcula o limite sem `limiteDaTentativa`, ou sem a lacuna.
   - **Falta também o limiar da lacuna aberta:** com o pulso de 20 s atrás, o limite não anda. Mutação: lacuna aberta sem o limiar de 30 s. Sem isso, todo limite ganha até 10 s.

2. **Buraco novo, da decisão do teto de 15 min (Tech Spec §5.4, §5.7 e §13): o pulso que volta depois de mais de 15 min não tem comportamento definido nem cenário.**
   - Enquanto a lacuna está aberta, conta até 15 min. Quando o pulso volta, a §5.7 grava a lacuna inteira como `indisponibilidade` fechada, que conta sem teto.
   - Com o pulso morto 40 min e a API de pé, o aluno recebe `TEMPO_ESGOTADO` e "O tempo acabou" aos 15 min. Quando o pulso volta, o limite salta 40 min e a prova reabre.
   - **Correção exigida:**
     - decidir na §5.7 se a lacuna gravada também tem teto;
     - criar a linha em `pulso.int.test.ts`: pulso parado 40 min, volta, e o limite anda X;
     - mutação: o teto só na lacuna aberta, ou o contrário, conforme a decisão.

3. **`cenarios.md` §3 (i), saída × saída: "em paralelo", sem dizer quem segura quem.**
   - Com `Promise.all` as duas chamadas podem acabar em série, e a mutação `saidas = lido + 1` sobrevive.
   - **Correção exigida:** ordem forçada. A primeira lê a contagem e segura com `WriteBlockTrigger` no insert de `saida_da_aba`; a segunda, com chave diferente, grava; depois a primeira solta. Resultado esperado: 2.

4. **`cenarios.md` §3 (j), estender × rotina: a ordem escrita não derruba a mutação declarada.**
   - Na ordem escrita, a rotina segura o `for update` primeiro e só então confere o fim. A extensão espera e recebe `ATIVIDADE_ENCERRADA`. Com a mutação "conferir o fim antes da trava", o resultado é o mesmo.
   - **Correção exigida:** a extensão segura o `for share`, com `WriteBlockTrigger` em `extensao_de_tempo`. A rotina chega, espera o `for update`, a extensão confirma, e a rotina relê o fim e **não encerra**. Com a mutação, encerra.

5. **`cenarios.md` §3 (k), mudar janela × janela: "lê a primeira" não é resultado observável, e "sem trava" fica verde.**
   - Sem a trava, as duas gravam e vale a última, com ou sem a regra.
   - **Correção exigida:** um caso que só a trava separa. A primeira encurta a janela para 50 min e é segurada com `WriteBlockTrigger`. A segunda põe +50% sobre 40 min. Esperado: a segunda recebe `ENTRADA_INVALIDA`. Sem a trava, as duas gravam e a combinação guardada não cabe na janela.

6. **Os e2e da regra 40 não têm linha no `cenarios.md`** (correção exigida na rodada 1, test-engineer 11).
   - A Tech Spec §10 os cita, mas o `cenarios.md` só tem "Antes de começar", a casca e o layout a 360 px. Nenhuma linha diz o que se afirma nem a mutação.
   - **Correção exigida, em `aluno-prova.spec.ts`:** a rede cai no meio da prova ("Sem conexão…"), a rede volta, e as respostas aparecem gravadas no banco uma vez. Mutação: descartar a fila na queda.
   - **Correção exigida, em `professor-prova.spec.ts`:** o professor aplica com janela e tempo adicional, o aluno faz, a prova encerra, e o professor aprova o lote com a coluna "Saiu da aba" e o aviso. Mutação: lote sem a coluna, ou nota sem aprovação.

7. **`cenarios.md` §1, RF9, linha de `contracts.test.ts`: contradiz a §4.**
   - "Nenhuma rota do aluno … devolve … `limiteEm` de aluno". Mas `prova` e `tempo` devolvem ao aluno o `limiteEm` dele.
   - Do jeito que está escrito, o teste não passa, ou é escrito frouxo.
   - **Correção exigida:** separar em duas regras.
     - Aluno: nunca `saidas`, `tempoAdicional` nem percentual; `limiteEm` só o dele, e nunca de colega.
     - Coordenação e rede: nenhum dos três.

8. **Cláusulas novas da Tech Spec sem cenário:**
   - **§7, "a validação guarda que a coluna foi mostrada" (D56, D70).** Nenhuma linha afirma isso; a linha do RF9 sobre o `apresentado` só afirma que ele não leva contagem.
     - Exigido: o registro da validação da avaliativa marca a coluna como mostrada, e o da não avaliativa não marca.
     - Mutação: não gravar a marca.
   - **§5.8, "o 429 não para a de respostas".**
     - Exigido: em unidade web, a fila de saídas recebe 429 e a de respostas segue gravando.
     - Mutação: uma fila só.

**Recomendações:**
- §1b, linha "escola sem ano em curso": fixar a recusa esperada por rota. Pela §5.2, nas rotas do aluno o ano entra no alcance e a recusa seria `NAO_ENCONTRADO`; a linha diz "`ANO_LETIVO_NAO_EM_CURSO` ou lista vazia".
- §2, auditoria `encerrada_pelo_limite` está com mutação "—". Ponha "gravar por tentativa" ou junte-a à (f).
[… 8 linhas cortadas]

## infra-guardian · 2ª rodada · REPROVADO · 2026-11-23 13:12:02 · `tasks/prd-avaliacao-e-correcao/revisao-spec.md`

VEREDITO: REPROVADO

Caminho quente tocado: prova | fila | migration (e a trava do Tutor)
Rate limit: ok
Fila e prioridade: problema
Concorrência: corrida em `tasks/prd-avaliacao-e-correcao/techspec.md:95-96`
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: compatível
Métrica e alerta: ok

**Os bloqueantes da rodada 1:**
- 1 (rotina encerrando durante a queda): resolvido no que foi pedido, mas a correção abriu os bloqueantes B2 e B3 abaixo.
- 2 (estender × rotina): resolvido, em §5.6 e na corrida (j).
- 3 (saída da aba sob reenvio): resolvido, com a tabela `saida_da_aba`, o envio em série e os cenários RF9 e (i).
- 4 (fila de respostas no cliente): resolvido, em §9, RF6 e §4.
- 5 (carga): resolvido, em `cenarios.md` §5.
- 6 (alertas): resolvido, em §7c.

Bloqueantes:

**B1. `techspec.md:89` (§5.6): a correção tirou o "urgente" da rotina, e a prova não encerra durante a aula.**
- Na rodada anterior, o texto dizia "cron `* * * * *`, urgente". Agora diz só "fila `lote`".
- No código, os jobs `sistema.*` agendados nascem não urgentes (comentário em `apps/worker/src/job-schedules.ts`). Na fila `lote`, o despachante segura o não urgente durante todo o horário letivo da escola (`apps/despachante/src/outbox-relay.ts`, passo 0).
- Se a tarefa seguir o precedente, o encerramento só sai depois das 18h. Até lá:
  - o lote não nasce;
  - a segunda chamada fica bloqueada, porque exige a original encerrada (§5.9);
  - o alerta "prova aberta 5 min além do fim efetivo" dispara em toda prova.
- **Correção exigida:**
  - §5.6 e §7c declaram `naoUrgente: false` para `sistema.encerrar-provas-vencidas` e para `atividade.encerrar-vencidas`, como a `sistema.varrer-temporarios-de-material`.
  - Cenário em `cenarios.md` §2: com a escola dentro do horário letivo, a prova vencida encerra no minuto. A mutação que o derruba é `naoUrgente: true`.

**B2. `techspec.md:95-96` e `:187` (§5.7, §13): o teto de 15 min não vale depois que o pulso volta.**
- O teto só limita a lacuna aberta. A lacuna fechada vira `indisponibilidade` inteira, sem teto.
- O caso concreto: a API segue de pé com o pulso morto, por exemplo com a conexão própria derrubada num reinício do Postgres, ou sem conseguir reconectar porque o `max_connections` estourou às 10h. Durante uma hora:
  - os PUTs recebem `TEMPO_ESGOTADO` depois de +15 min;
  - a tela mostra "O tempo acabou".
- Quando o pulso volta, grava 60 min de indisponibilidade. Toda prova daquela hora, em todas as escolas, ganha +60 min retroativos e reabre para quem já tinha visto o tempo acabar.
- O §13 diz "estica até 15 min", e isso é falso. Viola a regra 80, item 6, no sentido inverso: a lacuna gravada não corresponde a indisponibilidade real.
- **Correção exigida:**
  - A conexão do pulso reconecta sozinha.
  - A instância que não consegue pulsar por mais de 30 s deixa de aceitar as rotas de prova (readiness falha ou 503). Assim, toda lacuna gravada é indisponibilidade real.
  - Alternativa: declarar um teto também para a lacuna fechada, com o motivo.
  - §13 corrigido.
  - Cenários em `pulso.int.test.ts`:
    - conexão do pulso encerrada (`pg_terminate_backend`): reconecta em menos de 30 s e não grava indisponibilidade;
    - pulso impedido com a API de pé: as rotas de prova param de aceitar.

**B3. `techspec.md:95-96` (§5.7): o `update` do pulso e o `insert` da indisponibilidade não estão declarados como atômicos.**
- O CTE faz o `update … returning antes.ultimo_em`, e só depois "a lacuna vira `indisponibilidade`". Se forem duas instruções:
  - Um crash entre elas perde a queda para sempre: o pulso fica fresco, sem linha de indisponibilidade, e o pulso seguinte vê só 10 s.
  - A rotina que roda nesse intervalo vê o pulso fresco, calcula o limite sem a queda e encerra a prova. É exatamente o bloqueante 1 da rodada anterior.
- **Correção exigida:**
  - `update` e `insert` numa só instrução (CTE com `insert … select`) ou numa transação, escrito na §5.7.
  - Corrida nova em `cenarios.md` §3, (l) pulso × rotina: a rotina lê entre os dois passos e não encerra.
  - Teste com falha forçada depois do `update`: a lacuna não se perde.

Recomendações:
- **§5.6:** dizer o que é "pulso velho" (mais de 30 s, o mesmo limiar da §5.4). Conferir o pulso também dentro da transação do job por escola, porque a fila pode reter ou retentar um job gravado antes da queda.
- **`cenarios.md` §5:** declarar a queda da API no cenário de carga: todas as instâncias fora por mais de 30 s, por exemplo 90 s. Um reinício abaixo de 30 s não anda o limite, e o critério "o reinício anda o limite" fica instável.
- **§7c:** dizer qual processo exporta a métrica do alerta "prova aberta além do fim efetivo" e a idade do pulso. Com o pulso velho, a listagem não roda e não pode ser ela a fonte.
- **§9:** depois de "Sair da prova", com a fila presa em `TEMPO_ESGOTADO`, a própria fila deve reler `tempo` enquanto tiver pendência. Hoje a releitura está presa à tela da prova.
- **§11:** registrar o desvio de quem não começou por causa da queda. O `limite_base_em` é cortado pelo `fecha_em`, então quem não conseguiu começar durante a queda perde tempo. O PRD (RF6) cobre só prova em andamento; o remédio é o professor estender.
- **Acompanhamento:** calcular o limite da turma numa consulta só, e não 35 chamadas de `limiteDaTentativa` a cada 15 s.

Arquivos auditados:
- `tasks/prd-avaliacao-e-correcao/techspec.md`
- `tasks/prd-avaliacao-e-correcao/cenarios.md`
- `docs/lgpd.md` (diff)

## tenancy-guardian · 3ª rodada · APROVADO · 2026-11-23 13:14:35 · `tasks/prd-avaliacao-e-correcao/revisao-spec.md`

VEREDITO: APROVADO
Tabelas verificadas: `saida_da_aba`, `tempo_adicional`, `extensao_de_tempo`, `convocado_da_segunda_chamada`, `pulso_da_api`, `indisponibilidade` e as colunas novas de `atividade_aplicada` e `tentativa_atividade` (techspec §3). Também a chave única `tentativa_atividade_uma_por_aluno` em `packages/core/src/db/schema/tentativa-atividade.ts`, que é o alvo da FK composta.
Queries verificadas: a ordem alcance, janela e limite nas rotas do aluno (§5.2); a soma de saídas por chave nova (§5.8); a rotina `@Unscoped` com só ids e o job por escola, que confere o pulso de novo na transação (§5.6); o repository novo com `requireEscolaId()` (§6).
Teste de isolamento: presente e efetivo. Em `cenarios.md` §1b, a linha "Repository novo, inclusive o da `saida_da_aba`" quebra quando se tira o `escola_id`. A linha "Escola sem ano em curso" quebra quando se tira o `anoLetivoId`. O job de A com provas vencidas em A e B, em §2, quebra quando se tira o `escola_id` da listagem. O schema da `saida_da_aba` sem coluna de tempo está em §1 RF9. A eliminação do aluno apagando as linhas, com a mutação "FK sem cascade", está em §2.

As três correções exigidas na rodada 2:
- **`ano_letivo_id` na `saida_da_aba`**: feita. Techspec §3, linha 35.
- **FK composta para a tentativa, com `on delete cascade`**: feita. Techspec §3, linha 36, mais o item "FKs compostas com escola e ano" na linha 50. A chave única `(escola, ano, aplicação, aluno)` da tentativa já existe, então a FK é possível como está escrita.
- **§6 nomeando as exceções**: feita. Techspec §6, linha 109, nomeia `pulso_da_api` e `indisponibilidade`. Elas batem com `docs/modelo-de-dados.md:866` e com a §11.

Nenhuma das correções abriu buraco novo. A `indisponibilidade` é global, sem escola e sem pessoa. Ela só estica o limite e não expõe nada entre escolas.

Bloqueantes: nenhum.

Recomendações:
- **Techspec §3, linha 36**: escrever as colunas da FK, `(escola_id, ano_letivo_id, atividade_aplicada_id, aluno_id) → tentativa_atividade_uma_por_aluno`, e não só "FK → tentativa".
- **Techspec §3, linha 35**: a `saida_da_aba` é a única tabela nova sem `id`, embora a linha 46 diga "Ids uuidv7". Declarar a chave única como chave primária, ou acrescentar o `id`.
- **`cenarios.md` §1b, última linha**: "contexto de A ou de outro ano com id de B" mistura dois casos. Separar um caso da mesma escola em outro ano, com a mutação "tirar o `ano_letivo_id` do `where` do repository".
- **Tarefa da migration**: incluir `pulso_da_api` e `indisponibilidade` na lista de exceções do `apps/api/test/architecture.test.ts`, que hoje não as tem.

## privacy-guardian · 3ª rodada · REPROVADO · 2026-11-23 13:15:12 · `tasks/prd-avaliacao-e-correcao/revisao-spec.md`

**VEREDITO: REPROVADO**

Os dois bloqueantes da rodada 2 foram resolvidos. A correção, porém, deixou aberto um caminho para o instante de cada saída voltar ao banco, por baixo do teste que deveria impedir isso.

**Os bloqueantes da rodada 2**

| Rodada 2 | Situação | Onde |
|---|---|---|
| B1: `saida_da_aba` sem ligação ao titular, sem ano e sem cascade | **Resolvido.** A tabela tem escola, ano, aplicação, aluno e chave, com FK para a tentativa e `on delete cascade`. A FK fecha porque `tentativa_atividade` já tem o unique `(escola, ano, aplicação, aluno)` (`packages/core/src/db/schema/tentativa-atividade.ts:36`). A tabela entra nas "quatro tabelas com aluno" de `trabalho_do_aluno`. O cenário de eliminação tem a mutação "FK sem cascade". O arquivo do titular lê pelo `aluno_id`, que agora existe. O repository da `saida_da_aba` está no isolamento. | techspec §3 (linhas 35-36, 49-50), §6; cenarios §1b (linha 80), §2 (linhas 94-96) |
| B2: a coluna `em` | **Resolvido.** O `em` saiu da tabela. A linha do mapa diz "sem horário, só para não contar duas vezes". Há cenário de schema sem coluna de tempo. | techspec §3 (linha 35); `docs/lgpd.md:58`; cenarios §1 RF9 (linha 60) |

**Buraco novo**

O instante de cada saída pode voltar pelo id. O primeiro item depois do bloco da §3 diz "Ids uuidv7", sem exceção. No código, toda tabela usa `id uuid default uuidv7()` (`packages/core/src/db/schema/correcao.ts:33`, `tentativa-atividade.ts:25` e as demais). Quem implementar vai pôr esse id na `saida_da_aba`, e o uuidv7 guarda o milissegundo em que a linha nasceu. O resultado é a mesma linha do tempo que a rodada 2 mandou tirar.

O teste não pega isso. O cenário de schema da RF9 (cenarios.md, linha 60) usa a mutação "coluna `timestamptz`", e um `uuid` com default `uuidv7()` passa nele.

O arquivo do titular piora o caso. A leitura seleciona `'id'` em cada tabela (`packages/core/src/titular/leitura-do-titular.ts:308`), então os horários das saídas iriam também para a exportação.

---

```
VEREDITO: REPROVADO
Campos pessoais tocados: tentativa_atividade (limite_base_em, ordem, saidas_da_aba, envio);
  saida_da_aba (escola, ano, aplicação, aluno, chave); tempo_adicional (percentual, sensível);
  extensao_de_tempo; convocado_da_segunda_chamada. pulso_da_api e indisponibilidade sem pessoa.
Fora da tabela de dados do docs/lgpd.md: nenhum declarado. Risco: um id uuidv7 implícito
  na saida_da_aba (bloqueante 1)
Autorização por objeto: ok (§5.2 alcance antes da janela; §6; cenarios §1b com o repository da saida_da_aba)
Logs: limpos no desenho (§7: só ids e códigos, nunca percentual nem minutos por aluno)
Auditoria: presente (atividade.aplicada com contagem, .janela_alterada, .tempo_estendido,
  .segunda_chamada_aplicada, .encerrada_pelo_limite; nenhuma com alunoId e percentual)
Envio externo: nenhum; nada entra na memória do Tutor (cenarios §2)
Seed/fixture: sintético (relógio deslocado, sorteio injetado)
Bloqueantes:
  1. techspec §3, item "Ids uuidv7" (linha 40) e bloco da saida_da_aba (linhas 35-36);
     cenarios §1 RF9 (linha 60); docs/lgpd.md:58.
     O que está errado: a §3 manda uuidv7 em todo id e não exclui a saida_da_aba.
     O padrão da casa é `id default uuidv7()`. Um id assim grava o milissegundo de cada
     saída, e o arquivo do titular o exporta (leitura-do-titular.ts seleciona 'id').
     A mutação do cenário de schema ("coluna timestamptz") não detecta isso. É o mesmo
     dado que a D70 e a correção B2 da rodada 2 vedaram.
     Correção exigida:
     (a) Na §3, a saida_da_aba fica sem `id`, com chave primária composta igual ao unique
         (escola, ano, aplicação, aluno, chave). Há precedente: material_serie_pk e
         retencao_escola_pk.
     (b) No cenário RF9 de schema, a asserção passa a ser "nenhuma coluna de tempo e
         nenhuma coluna com default uuidv7() ou com data dentro", com uma mutação a mais:
         "id uuidv7".
     (c) Na linha do docs/lgpd.md:58, "sem horário, nem no id".
Recomendações:
  - §5.8: dizer que a `chave` da saída é gerada no cliente por `crypto.getRandomValues`
    (uuid v4, como apps/web/src/components/request-id.ts). Assim nenhuma biblioteca v7
    entra pela chave. O servidor pode recusar outra versão.
  - Arquivo do titular: deixar explícito que a saida_da_aba aparece lá só como a
    contagem de cada tentativa (saidas_da_aba), sem linha por saída. Declarar esta
    exceção ao "coordenação e rede: nenhum dos três" do contrato, por ser direito do
    titular e por tentativa.
  - Seguem abertas as da rodada 2: o Acompanhar fora da tela projetada, e o prazo do
    tempo adicional mais curto ou justificado na linha do mapa.
```

Arquivos consultados:
- tasks/prd-avaliacao-e-correcao/techspec.md
- tasks/prd-avaliacao-e-correcao/cenarios.md
- docs/lgpd.md
- packages/core/src/db/schema/tentativa-atividade.ts
- packages/core/src/titular/leitura-do-titular.ts
- packages/shared/src/privacidade/classificacao.ts

## conformidade-reviewer · 3ª rodada · APROVADO · 2026-11-23 13:15:20 · `tasks/prd-avaliacao-e-correcao/revisao-spec.md`

VEREDITO: APROVADO

O bloqueante da rodada 2 foi resolvido, e a correção não abriu buraco novo.

**O que estava errado.** A tabela `saida_da_aba` gravava, na coluna `em`, o horário de cada saída da aba.

**O que mudou na Tech Spec §3** (`techspec.md:35-36`):
- A tabela ficou com escola, ano, aplicação, aluno e chave, e a spec escreve "(sem coluna de tempo)".
- Tem FK para a tentativa com `on delete cascade` e índice único na chave.
- §5.8 só conta chave nova, e só em prova em andamento.
- §7 e §7b deixam a contagem no lote, sem destaque e sem bloqueio.
- §9 mostra a coluna "Saiu da aba" só em avaliativa, sempre com o aviso fixo.

**O teste que impede a volta.** Fica em `cenarios.md` §1 RF9, linha 60. Ele afirma que a tabela tem só essas cinco colunas, e a mutação que o derruba é acrescentar uma coluna `timestamptz`. Como o teste confere a lista inteira, uma coluna de tempo de outro tipo também o derruba. O §2 completa a cobertura:
- linha 94: o expurgo apaga `saida_da_aba`;
- linha 95: eliminar o aluno apaga as linhas;
- linha 96: no arquivo do titular, as quatro tabelas saem pelo `aluno_id`, sem `chave`;
- linha 98: a contagem não entra na memória do Tutor;
- §1b, linha 80: a tabela tem cenário de isolamento.

`docs/lgpd.md` também foi corrigido: diz "sem horário, só para não contar duas vezes", e a retenção é a do trabalho do aluno.

**Procurei buraco novo e não achei:**
- O registro de acesso (`apps/api/src/credencial/registro-de-acesso.repository.ts`) só grava login, renovação e saída. Não há log por requisição que montasse uma linha do tempo de `POST …/saidas-da-aba`.
- Nenhuma guarda exige `criado_em` em toda tabela.
- `saidas_da_aba smallint` não estoura: 30 por minuto durante 300 minutos dá 9.000.
- As recomendações da rodada 2 também foram atendidas:
  - a trava do Tutor com indisponibilidade tem cenário (§1 RF6, linha 34);
  - o aviso fixo aparece a 360 px (linha 62);
  - o Acompanhar fica "nunca na tela da sala" (§9);
  - `saida_da_aba` agora tem `aluno_id`, então o arquivo do titular sai pelo `aluno_id`.

```
VEREDITO: APROVADO
Caminhos de escrita em Nota: nenhum. A F6 não cria `Nota` (D46); a rotina só encerra e cria o lote pendente (techspec §5.6, §7b) — todos com autor humano? não se aplica
Decisão autônoma sobre aluno: ausente. O envio no limite, o encerramento pela rotina e a saída da aba não decidem aprovação, reprovação nem encaminhamento; a segunda chamada é ato do professor (§5.9)
Aprovação registrada: ok. Não há IA nova (§8); o lote da original e o da segunda chamada nascem pendentes; o registro da validação marca que a coluna foi mostrada (cenarios §1 RF9, linha 58); a exceção da D47 não aparece fora do Tutor
Supervisão do tutor: ok. Trava por aluno até o limite efetivo pela `limiteDaTentativa` (§5.4, §5.10), com cenário de extensão e de indisponibilidade (cenarios §1 RF6 linha 34; §2 linhas 99-101)
Autonomia declarada e visível: sim. Não há agente nem nível novo; "corrige e avisa o professor" continua verdadeiro com o encerramento pela rotina
Bloqueantes: nenhum
Recomendações:
- techspec §4 (linha 68) e cenarios §1 RF9: a spec não diz de que versão é a `chave` da saída. Um UUID v7 traz o milissegundo de cada saída e refaria a linha do tempo pela chave, com o teste de schema continuando verde. Fixar no contrato de `packages/shared` que a chave é UUID v4 (como `apps/web/src/components/request-id.ts`) e acrescentar um teste de unidade em que a chave v7 recebe `ENTRADA_INVALIDA`.
- cenarios §1 RF9, linha 60: escrever o teste como igualdade com a lista das cinco colunas, não como "não há `timestamptz`". Assim uma coluna de tempo em `bigint` ou `date` também derruba o teste.
- O texto do aviso fixo (pergunta 2 do PRD; proposta em cenarios §4) precisa da palavra do Joaquim antes da tarefa de tela.
```

Li `tasks/prd-avaliacao-e-correcao/techspec.md` e `tasks/prd-avaliacao-e-correcao/cenarios.md`. Também consultei a diferença em `docs/lgpd.md`, a D70 e a D88 em `docs/decisoes.md`, o PRD, `docs/aia/correcao-de-objetiva.md` e o meu achado da rodada 2 em `tasks/prd-avaliacao-e-correcao/achados/revisao-spec.md`.

## infra-guardian · 3ª rodada · APROVADO · 2026-11-23 13:16:49 · `tasks/prd-avaliacao-e-correcao/revisao-spec.md`

VEREDITO: APROVADO

Caminho quente tocado: prova | fila | migration

Rate limit: ok

Fila e prioridade: ok

Concorrência: protegida

Índice e paginação: ok

Degradação de IA: não se aplica

Migration: compatível

Métrica e alerta: ok

Bloqueantes: nenhum. Os três bloqueantes da rodada 2 foram corrigidos:
1. **`naoUrgente: false`:** a rotina e o job por escola ficam na fila `lote` com `naoUrgente: false`. Já existe precedente disso em `packages/shared/src/system/job-definitions.ts` (o expurgo horário). O pulso velho é conferido de novo na transação do job. Está em `tasks/prd-avaliacao-e-correcao/techspec.md` §5.6, e os cenários em `tasks/prd-avaliacao-e-correcao/cenarios.md` §2 (linhas 88 e 89).
2. **Teto de 15 min:** saiu. A instância que não pulsa há 30 s responde 503 nas rotas de prova, então toda lacuna gravada é queda real. A lacuna aberta e a fechada contam igual. Está em techspec §5.7 e §13. Cenários em cenarios §1 RF6: 40 min, `pg_terminate_backend`, 503 só nas rotas de prova, pulso antes do `listen`.
3. **`update` e `insert` do pulso:** agora são uma instrução só, com CTE e `for update`. Está em techspec §5.7, com a falha forçada em cenarios §1 RF6 e as corridas (g) e (l) em cenarios §3. Em leitura confirmada (read committed), o `for update` do CTE relê a versão nova depois da espera, e é isso que faz a (g) passar.

Recomendações (nenhuma bloqueia; ficam registradas para a validação e a retro):
- **techspec §5.4 e §5.6, ordem de leitura:** `limiteDaTentativa` deve ler o pulso e as indisponibilidades numa consulta só, com uma única visão do banco. Na transação de cada aplicação da rotina, o pulso deve ser conferido antes do fim efetivo, ou com `for share` na linha do pulso. Na ordem inversa existe um caso estreito: a rotina lê as indisponibilidades, o pulso da volta confirma em seguida, a rotina então vê o pulso fresco e encerra sem o tempo devolvido. A escrita atômica do bloqueante 3 resolve só metade disso. A (l) não pega esse caso, porque testa só a escrita.
- **techspec §3 e §5.7, linha do pulso:** dizer quem cria a linha única, de preferência a migration. Dizer também o que vale quando ela falta. Hoje o CTE com a tabela vazia nunca grava nada, e fica em aberto se isso conta como pulso parado (rotas de prova em 503 e a rotina parada) ou como pulso em dia.
- **techspec §5.7:** fixar `ultimo_em = now()` do banco, nunca o relógio da instância. A VM já teve relógio adiantado. Fixar também que só as instâncias HTTP da API pulsam, nunca o `main-worker` nem o despachante. Um pulso vindo do worker esconderia a queda da API.
- **techspec §7c e §13, alerta do pulso:** o alerta deve olhar o pulso de cada instância, e não só a linha compartilhada. Hoje, com uma instância parada e a outra pulsando, a linha segue fresca e esse alerta não dispara. Só o alerta de taxa 5xx de `docs/runbook.md` pega o caso, depois de 5 min. O runbook do alerta novo deve citar o 503 das rotas de prova.
- **techspec §5.7:** listar quais são as "rotas de prova" que recusam com o pulso parado: `comecar`, `prova`, `tempo`, o PUT, `saidas-da-aba` e o envio pelo aluno.
- **cenarios §2, linha 89:** a mutação `naoUrgente: true` só fica vermelha se o teste passar pelo despachante. Apontar também o resumo de `packages/shared/src/system/job-definitions.test.ts` (linha 81) ou `apps/despachante/test/janela.int.test.ts`.
- **cenarios §1 RF6, linha 36:** o caso "PUT logo depois da volta, com o pulso parado há 3 min" só existe com o pulso forjado no teste, porque a API só aceita tráfego depois do primeiro pulso. Escrever isso no cenário, para ninguém ler como fluxo real.

## test-engineer · 3ª rodada · REPROVADO · 2026-11-23 13:17:11 · `tasks/prd-avaliacao-e-correcao/revisao-spec.md`

VEREDITO: REPROVADO

Cenários exigidos: os 8 da rodada 2. São eles: (1) indisponibilidade em cada chamador de `limiteDaTentativa`, com o limiar de 30 s da lacuna aberta; (2) pulso de volta depois de 40 min, reconexão, rotas de prova recusando, falha entre o `update` e o `insert`, e a corrida (l); (3) a corrida (i), (4) a (j) e (5) a (k), cada uma com uma ordem forçada que só a trava separa; (6) os dois E2E; (7) o contrato dividido; (8) a marca da coluna na validação e o 429 das saídas que não para as respostas. Entram também os itens dos outros revisores que caíram no `cenarios.md` (rotina no horário letivo, eliminação, schema da `saida_da_aba`) e o que a decisão nova cria: 503 nas rotas de prova e pulso antes de aceitar tráfego.

Cobertos:
- **Item 2:** quase todo. Linhas 38 a 42 e corrida (l) na linha 119. A (l) só pega a mutação porque o `WriteBlockTrigger` é `after`, então o `update` do pulso fica aplicado e ainda não confirmado. O prazo real fica no bloqueante 2.
- **Item 3, corrida (i):** linha 116. A trava é `after`, a linha já está no índice, e `lido + 1` dá 1 em vez de 2.
- **Item 4, corrida (j):** linha 117.
- **Item 6, E2E:** §4b.
- **Item 7, contrato dividido:** linha 59, junto com a matriz da linha 77.
- **Item 8:** linhas 58 e 46.
- **Pedidos dos outros revisores:** linha 89 (`naoUrgente`), linha 95 (eliminação), linha 60 (schema sem coluna de tempo).
- **Tech Spec:** §3, §5.6 (pulso conferido de novo no job, linha 88), §5.7, §6 e §13 estão como pedidos.
- **Não resolvidos:** o item 1 (bloqueante 1) e o item 5 (bloqueante 4).

Bloqueantes:

1. **`cenarios.md` §1, linhas 34 e 36 (item 1 não resolvido, e a correção abriu um buraco).**
   - A linha 34 usa uma indisponibilidade **fechada** de 5 min. Mesmo assim, a coluna de mutação diz que ela derruba "sem a lacuna", e ela não derruba. Na saída, em `prova`, em `tempo` e no Tutor, um chamador que não passa o pulso para `limiteDaTentativa` continua verde.
   - A linha 36 diz "PUT logo depois da volta da API, com o pulso parado há 3 min". Pela §5.7 nova, a instância pulsa antes de aceitar tráfego. Esse primeiro pulso fecha a lacuna, e o PUT passa a ver uma indisponibilidade fechada. Escrito assim, o teste não chega à cláusula: o PUT sem a lacuna aberta continua gravando.
   - Com o 503, a lacuna aberta só aparece numa requisição real pelo Tutor, que não é rota de prova e segue servindo com o pulso parado.
   - **Correção:** a linha 36 passa a dizer como o estado é montado: a linha do pulso envelhecida à mão, com o pulso da instância fresco e o tique parado.
   - **Correção:** a linha 34 ganha a variante com a lacuna aberta, ao menos para o Tutor ("pulso velho posto à mão: o Tutor segue travado além do limite original"). Para saída, `prova` e `tempo`, ou ganha a mesma variante, ou tira "sem a lacuna" da coluna de mutação, com o motivo (o 503 já cobre).

2. **`cenarios.md` §1, linhas 40 e 41 (e o cabeçalho, linha 8): prazo provado com relógio real.**
   - A linha 40 diz "reconecta em menos de 30 s, sem indisponibilidade". Isso depende da máquina. Se a reconexão passar de 30 s numa máquina carregada, grava uma indisponibilidade e o teste fica vermelho sem defeito no código.
   - A linha 41 diz "depois de 30 s, as rotas de prova respondem 503". Esse prazo é medido pelo relógio da instância (o último pulso dela com sucesso), não pelo do banco. Por isso a premissa da linha 8, "o relógio é o do banco… nenhum teste dorme", não vale aqui.
   - **Correção:** declarar o tique do pulso e o relógio da instância como injetáveis. Na linha 40, a afirmação vira "o tique seguinte ao `pg_terminate_backend` grava com sucesso, sem indisponibilidade", sem prazo em tempo real. Na linha 41, o relógio injetado avança 31 s e a instância responde 503. Na §5.7 da Tech Spec, dizer que o relógio da recusa é injetável.

3. **Tech Spec §9 e `cenarios.md` §1, linhas 43 a 46: falta o lado do cliente do 503 (buraco novo).**
   - A §5.7 criou o 503 nas rotas de prova, mas nenhum cenário diz o que a fila de respostas e a de saídas fazem com ele. A linha 43 cobre só a falta de rede.
   - Uma fila que trata 5xx como erro final descarta a resposta e passa em toda a §1. É exatamente a regra 80, item 6: resposta de prova nunca se perde.
   - **Correção (Tech Spec §9):** "503 e 5xx mantêm o item na fila e reenviam".
   - **Correção (cenário de unidade web):** 3 respostas recebem 503, depois 200, e as 3 gravam uma vez. Uma saída que recebe 503 é reenviada com a mesma chave. `tempo` com 503 mantém o último limite na tela. Mutação: descartar o item no 5xx.

4. **Tech Spec §4 (`PATCH …/:id/janela`) e `cenarios.md` §3 (k): a corrida pode não existir.**
   - A (k) supõe que a segunda chamada muda só o tempo adicional, sem mandar janela.
   - A §4 lista "janela, duração, tempo adicional" sem dizer se o PATCH é parcial. Se o corpo é completo, cada chamada valida o próprio estado inteiro. A segunda, com janela de 60 min e +50%, deve passar, e o cenário afirma `ENTRADA_INVALIDA` contra a implementação certa.
   - Sem fixar isso, o item 5 não está resolvido: quem escrever o teste pode montar uma corrida que nenhuma trava separa.
   - **Correção (§4):** declarar o PATCH como parcial (campos opcionais, validação sobre o estado gravado relido depois do `for update`) e dizer na (k) que a segunda chamada só manda `tempoAdicional`. Ou então reescrever a (k) com os dois corpos completos e o resultado esperado.

Recomendações:
- **Linhas 39 e 119:** a mutação certa é "`update` e `insert` em commits separados". Duas instruções dentro de uma transação passam nos dois testes e também estão corretas. Na (l), a prova tem de estar vencida **só sem** o minuto de queda. Se estiver vencida mesmo com ele, encerrar seria o certo e o vermelho sairia pelo motivo errado.
- **Linha 41:** nomear as rotas que dão 503 (`comecar`, `prova`, `tempo`, PUT, `saidas-da-aba`) e afirmar a volta: o pulso retorna e elas aceitam de novo (mutação: a recusa fica presa).
- **Corrida (i):** ela só funciona se a saída não travar a tentativa antes do `insert`. Escrever isso, senão o teste trava esperando.
- **§4b, `professor-prova.spec.ts`:** dizer como a prova encerra (pelo botão "Encerrar", ou o teste chama o job, nunca espera o cron). Afirmar o valor "1" na coluna "Saiu da aba". A mutação "aprovar sem abrir os destaques" não casa com um lote sem destaque: trocar por "a coluna sem o aviso" ou "a contagem errada".
- **§13 e §7c (para o `infra-guardian`):** a correção prova que "toda lacuna gravada é queda real", mas não que "toda queda real é gravada". Com o pool principal esgotado e a conexão própria do pulso de pé, o PUT falha e nada devolve tempo. Com várias instâncias, uma travada também some do alerta, porque as outras mantêm a linha do pulso fresca. Vale nomear o risco e ligar a prontidão da instância ao pulso dela.
- **§3:** a `saida_da_aba` não tem chave primária declarada. O `unique` pode virar a chave primária.
- **Linha 59:** dizer como o `contracts.test.ts` sabe quais contratos chegam ao aluno. O mecanismo já existe na linha 319 de `apps/api/test/contracts.test.ts`.

Arquivos auditados: `tasks/prd-avaliacao-e-correcao/techspec.md`, `tasks/prd-avaliacao-e-correcao/cenarios.md`. A semântica da trava `after` foi conferida em `apps/api/test/write-block-trigger.ts`.

## privacy-guardian · 4ª rodada · APROVADO · 2026-11-23 13:19:18 · `tasks/prd-avaliacao-e-correcao/revisao-spec.md`

VEREDITO: APROVADO

O bloqueante da rodada 3 está resolvido, e a correção não abriu buraco novo de dado pessoal.

**A correção exigida, item por item**
- **Tech Spec §3 (linhas 35–36):** a `saida_da_aba` tem agora só `escola*, ano_letivo*, atividade_aplicada*, aluno*, chave* uuid v4`, marcada "(sem id nem tempo)". A chave primária cobre as cinco colunas. A FK para a tentativa tem `on delete cascade`. A frase "Ids uuidv7" da linha 46 fica para as outras tabelas. A `saida_da_aba` não tem `id`, então ela não a alcança.
- **Tech Spec §4 e `cenarios.md` §1 RF9 (linha 49):** a `chave` é uuid v4 gerada no cliente. Uma v7 é `ENTRADA_INVALIDA`. Nenhuma versão com tempo entra pela chave.
- **`cenarios.md` §1 RF9 (linha 63):** o teste de schema afirma a lista exata das cinco colunas e nenhum default `uuidv7()`. Ele derruba as duas mutações: uma coluna de tempo e um `id` uuidv7.
- **`docs/lgpd.md` (linha 58):** a linha diz "sem horário, nem no id, nem na chave, que é uuid v4, só para não contar duas vezes". A retenção passa a ser a do trabalho do aluno, e a contagem aparece só no lote.

**Procurei se a correção deixou horário em outro lugar**
- `tentativa_atividade` não tem coluna de atualização (`packages/core/src/db/schema/tentativa-atividade.ts`). Somar `saidas_da_aba` não grava horário.
- O registro de acesso do Marco Civil grava só login, renovação e saída (`apps/api/src/credencial/registro-de-acesso.repository.ts`), não cada requisição. A métrica HTTP é por rota, sem usuário (`apps/api/src/configure-app.ts`). O POST da saída não deixa horário por aluno em log.
- **Arquivo do titular (`cenarios.md` linha 99):** a `saida_da_aba` entra pelo `aluno_id`, sem a `chave`. **Eliminação (linha 98):** as linhas saem. **Expurgo (linha 97):** a tabela está na lista.

Campos pessoais tocados: `saida_da_aba` (escola, ano, aplicação, aluno e a chave v4, sem tempo); `tentativa_atividade.saidas_da_aba`. O resto não mudou desde a rodada 3.
Fora da tabela de dados do docs/lgpd.md: nenhum
Autorização por objeto: ok (§5.2 e §6, sem mudança)
Logs: limpos
Auditoria: presente (§7, sem mudança)
Envio externo: nenhum (§8)
Seed/fixture: sintético
Bloqueantes: nenhum
Recomendações:
- **v4 provada só na unidade (`cenarios.md` linha 49):** o teste roda em `packages/shared`. Se a rota não usar o schema compartilhado, uma v7 passa e nenhum teste quebra. Sugiro um `check` no banco sobre a versão da `chave` (o 13º caractere igual a `4`), ou um caso de integração em `saida-da-aba.int.test.ts` que manda uma v7 à rota.
- **Mutação da corrida (i) (`cenarios.md` linha 119):** o texto fala em "tirar o índice único". Desde a rodada 4 a unicidade vem da chave primária das cinco colunas, então a mutação passa a ser "tirar a chave primária".

Arquivos:
- tasks/prd-avaliacao-e-correcao/techspec.md
- tasks/prd-avaliacao-e-correcao/cenarios.md
- docs/lgpd.md

## test-engineer · 4ª rodada · APROVADO · 2026-11-23 13:20:17 · `tasks/prd-avaliacao-e-correcao/revisao-spec.md`

VEREDITO: APROVADO

**Cenários exigidos:** os quatro bloqueantes da rodada 3, e o que as correções podem ter afetado.
1. A lacuna aberta em cada chamador, e como montar o estado do PUT.
2. Os prazos sem relógio real nos cenários de reconexão e de 503.
3. O lado do cliente quando recebe 503.
4. O PATCH parcial da janela e a corrida (k).

Também conferi o que as correções tocam: o cabeçalho do `cenarios.md`, a §3 (`saida_da_aba` com chave primária nas cinco colunas e `chave` uuid v4), a corrida (i) com a chave primária nova, e as linhas 49 e 63.

**Cobertos:**
- **Bloqueante 1, resolvido.** `cenarios.md` §1, linha 35: a indisponibilidade fechada em cada chamador, com a mutação "aquele chamador sem `limiteDaTentativa`" (não diz mais "sem a lacuna").
  - Linha 36: a lacuna aberta montada à mão. A linha do pulso fica 3 min mais velha, o tique fica parado e o relógio da recusa continua fresco, então a cláusula é alcançada sem o 503 no caminho.
  - Ela vale para o Tutor e também para o PUT, a saída, `prova` e `tempo`.
- **Bloqueante 2, resolvido.**
  - O cabeçalho (linhas 8 a 10) e a Tech Spec §5.7 ("Tique e relógio injetáveis") dizem que tique e relógio são injetáveis.
  - Linha 41: "o tique seguinte (injetado) reconecta e grava", sem prazo em tempo real.
  - Linha 42: o relógio injetado avança 31 s, as seis rotas nomeadas respondem 503, e elas voltam a aceitar quando o tique volta (mutação "recusa presa").
- **Bloqueante 3, resolvido.**
  - Tech Spec §9: "503, 5xx e rede mantêm o item".
  - Linha 48: 3 respostas com 503 e depois 200 gravam uma vez; a saída volta com a mesma chave; `tempo` mantém o último limite. Mutação: descartar o item no 5xx.
  - O 5xx ao tocar em Começar tem texto na §4 (linha 146).
- **Bloqueante 4, resolvido.**
  - Tech Spec §4: o PATCH é "parcial".
  - Corrida (k), linha 121: a primeira chamada manda só a janela de 50 min; a segunda manda só `tempoAdicional` +50%, espera o `for update`, relê a janela e recebe `ENTRADA_INVALIDA`.
  - Conferi que a corrida existe e que só a trava separa os dois resultados: sem a trava, a segunda valida contra a janela antiga já gravada e as duas gravam. Validar antes de pegar a trava também fica vermelho.
  - O FK da `tempo_adicional` pega só `KEY SHARE` e não bloqueia contra o `NO KEY UPDATE` da primeira, então a mutação "sem trava" fica mesmo vermelha.
- **Buracos novos causados pelas correções: nenhum bloqueante.**
  - A chave primária nas cinco colunas mantém a (i): com outra chave, o resultado é 2 com `saidas + 1` e 1 com `lido + 1`; com a mesma chave, 1.
  - Linha 63: a lista exata das colunas derruba um `id` uuidv7.
  - Linha 49: a chave v7 é recusada.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **Tech Spec §5.7 contra a §13 e o `cenarios.md` linha 42.** A §5.7 diz que a instância recusa "as rotas do aluno (503)". A §13 diz "rotas de prova". A linha 42 lista seis rotas e afirma que "o resto da API segue", e a linha 36 chama o Tutor de "não é rota de prova".
   - Lida ao pé da letra, a §5.7 manda recusar também o Tutor e `minhas-atividades`. Um teste da linha 42 que use uma rota do aluno como "o resto" ficaria vermelho contra a implementação que segue a §5.7.
   - Correção sugerida: trocar "rotas do aluno" por "rotas de prova (`comecar`, `prova`, `tempo`, PUT, envio, `saidas-da-aba`)". Na linha 42, dizer que "o resto" inclui `minhas-atividades` e o Tutor.
2. **Linhas 35 e 36, no Tutor.** O Tutor trava até "o fim da janela ou o limite dele, o que vier depois" (§5.10). Se o limite original vence antes do `fecha_em`, a janela já mantém o Tutor travado, e a mutação passa verde.
   - Vale escrever que o limite original é o `fecha_em` (o aluno começa a menos de uma duração do fim) e que esse limite já passou.
   - No PUT e na saída da linha 36, a chamada também tem de vir depois do limite original e a menos de 3 min dele.
   - O portão de mutações pegaria isso, por isso fica como recomendação.
3. **Tech Spec §4 e §5.1.** Escrever ali o que hoje só a (k) diz: o PATCH valida sobre o estado relido depois do `for update`. Dizer também o que um `tempoAdicional` parcial faz com a lista gravada: se substitui ou se soma.
4. **Linha 42.** Acrescentar o limiar: com o relógio avançado 29 s, as rotas ainda aceitam. A mutação seria recusar no primeiro tique que falha.
5. **Linha 42, "envio" com 503.** Nem a §9 nem a §4 do `cenarios.md` dizem o que a tela faz quando "Enviar" recebe 503. As respostas não se perdem, porque são gravadas item a item e a rotina envia no limite, mas falta o texto do erro.
6. **Linha 49.** Junto do teste de unidade do schema, um caso de integração na rota `saidas-da-aba` com uma chave v7, para provar que a rota usa esse schema.
7. **Linha 49.** Está rotulada RF9 no meio das linhas RF6; vale mudá-la para junto das outras RF9.

Arquivos auditados:
- tasks/prd-avaliacao-e-correcao/techspec.md
- tasks/prd-avaliacao-e-correcao/cenarios.md
- tasks/prd-avaliacao-e-correcao/revisao-spec.md
- tasks/prd-avaliacao-e-correcao/achados/revisao-spec.md

Também li o diff do `prd.md` e o do `docs/lgpd.md`.
