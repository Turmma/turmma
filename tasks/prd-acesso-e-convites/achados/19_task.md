# Achados das revisões — `tasks/prd-acesso-e-convites/19_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-10 15:47:39 · `tasks/prd-acesso-e-convites/19_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A 19.0 só mexe na tela de Professores da coordenação e chama `POST /v1/professores/:usuarioId/email`, que troca o e-mail de quem foi convidado. Nenhum job, seed, importação ou webhook toca `Nota`. Todos com autor humano? sim (não há escrita).
Decisão autônoma sobre aluno: ausente. A tarefa não envolve aluno.
Aprovação registrada: ok. Não há saída de IA nesta tarefa. A correção do e-mail é um ato da coordenação, feito à mão.
Supervisão do tutor: ok. A tarefa não envolve o tutor.
Autonomia declarada e visível: sim. Nenhum agente foi criado ou alterado, e a declaração dos agentes que existem não mudou.

**Bloqueantes:** nenhum.

O que conferi no código e nas fotos, pela regra 70:

- **Item 8 (D45) e item 9 (D64), medir o professor.** O painel do professor mostra três coisas: a situação do convite, as turmas e os vínculos, e as ações que o estado permite. Não mostra uso, adoção nem desempenho. Na lista não há ranking nem alerta de "professor que não usa". Vi isso nas fotos `coordenacao--coordenacao-professores--computador.png`, `coordenacao--coordenacao-professores--Ana-convidado--computador.png` e `vazia--coordenacao--coordenacao-professores--Professora-Sintética-Rosa--celular.png`, e no código em `PainelDoProfessor.tsx:79` ("nunca uso nem desempenho") e `PainelDoProfessor.tsx:155-166`, o rodapé que só acrescenta o botão.
- **Itens 4b e D59, sair nunca mais difícil que entrar.** No diálogo, "Cancelar" e "Corrigir o e-mail" estão lado a lado, como mostra `coordenacao--coordenacao-professores--Ana-convidado-button-name-Corrigir-o-e-mail--celular.png`. A pergunta antes de fechar, em `DialogoDeCorrigirEmail.tsx:26-28`, só aparece quando o link do convite ainda não foi copiado. Ela protege uma credencial e não prende a pessoa: "Fechar de vez" sai em um clique (`DialogoDeCorrigirEmail.tsx:222-229`).
- **Regra 70 nas telas.** Em nenhuma foto há saída de IA, nota, conceito ou sugestão de nota. O texto do diálogo ("O professor continua o mesmo, com as turmas e as aulas dele", em `DialogoDeCorrigirEmail.tsx:107-109`) não fala do professor nem o avalia.
- **`docs/regulacao.md`:** a tarefa não altera o arquivo, e nada nela pede que ele mude.

Os estados do diálogo que só aparecem depois de digitar (formato errado, CONFLITO, link depois do sucesso, rede) não têm foto. Revisei-os pelo código: todos são texto operacional do convite, e nenhum fica perto do escopo da regra 70.

**Recomendações:** nenhuma pela regra 70. O que a tarefa tem de sensível é o link do convite, que é credencial: vida curta no cache (`gcTime: 0` em `api/professores.ts:91-97`) e nada no endereço nem no armazenamento do navegador. Isso é com o `privacy-guardian` e o `frontend-reviewer`, os revisores obrigatórios da tarefa.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/professores/PainelDoProfessor.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/professores/api/professores.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/professores/envio-do-convite.ts

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-10 15:47:39 · `tasks/prd-acesso-e-convites/19_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: o e-mail do professor (adulto), digitado pela coordenação e enviado no corpo de `POST /v1/professores/:usuarioId/email`. Ele aparece uma vez, na etapa "E-mail corrigido", como o endereço com que o professor vai entrar. O nome do professor já vinha da lista. O link do convite é credencial. Nenhum campo novo, nenhuma migration, nenhum dado de aluno.

Fora da tabela de dados do docs/lgpd.md: nada. O e-mail do professor e a auditoria `usuario.email_corrigido` já estão no mapa (linha 125), desde a 18.0.

Autorização por objeto: ok. A tela só chama a rota da 18.0, que checa a permissão `professor`/`corrigir_email` em `apps/api/src/professores/professores.controller.ts:66` e já foi auditada. O botão segue a mesma matriz do servidor (`CORRIGIR_EMAIL_DO_PROFESSOR_POR_ESTADO`, em `convite-de-professor.ts`). Isso é só conveniência de tela, e a decisão continua no servidor. `CONFLITO` e `NAO_ENCONTRADO` mostram o mesmo texto do convite que mudou, então a tela não confirma se o registro existe.

Logs: limpos. Não há `console` nem `logger` no diálogo, em `api/professores.ts` nem em `convite-de-professor.ts`.

Auditoria: presente. `apps/api/src/sessao/convite/convite-de-professor.service.ts:110` grava `usuario.email_corrigido` (18.0). A tela não cria nenhuma ação nova.

Envio externo: nenhum. O e-mail segue pelo caminho do "Reenviar" que já existia, pela fila, para o endereço corrigido. Não há envio a IA.

Seed/fixture: sintético. Os e-mails do e2e são `certo-<uuid>@educa.invalid`. As fotos mostram só nomes com sufixo de id ("Ana convidado afa2f045", "Professora Sintética Rosa 7f4b236b") e a escola "Colégio sintético da vitrine".

O que conferi no código e nas fotos:
- **Link fora do navegador:** o token vai no fragmento (`/convite#…`, em `components/link-do-convite.ts`) e vive só na mutação. A mutação tem `gcTime: 0` (`api/professores.ts`, `mutacaoDaCorrecaoDoEmail`). Fechar e "Enviar por e-mail" chamam `reset()` (`DialogoDeCorrigirEmail.tsx:199` e `:216`). Há teste que prova que o link não fica na URL, no `localStorage`, no `sessionStorage` nem no cache de mutações (`DialogoDeCorrigirEmail.test.tsx:248-257`, `api/professores.test.ts:107-133`). O e2e repete a prova com a resposta atrasada (`e2e/professores-envio.spec.ts`, por volta da linha 198).
- **E-mail atual:** não aparece em lugar nenhum. O campo abre vazio, nas fotos `coordenacao--coordenacao-professores--Ana-convidado-button-name-Corrigir-o-e-mail--computador.png` e `--celular.png`, e a lista não traz e-mail (E8).
- **Painel do professor ativo:** não tem o botão (`vazia--coordenacao--coordenacao-professores--Professora-Sintética-Rosa--celular.png`).
- **Erro:** o texto vem do catálogo, sem código cru e sem dado no corpo.

Bloqueantes: nenhum.

Recomendações:
1. `convite-de-professor.ts`, `TEXTO_DO_EMAIL_QUE_NAO_SERVE`: o `CONFLITO` deixa a coordenação descobrir se um e-mail é de algum professor da escola. Fica dentro da mesma escola e quem pergunta é o lado controlador, então o risco é baixo. O texto não diz qual dos dois casos é (E11), e o contrato é da 18.0. A decisão sobre o e-mail de coordenador já está no `TODO.md`, com o Joaquim como dono. Vale incluir lá também essa enumeração dentro da escola.
2. Não há foto da etapa "E-mail corrigido", com o link e o e-mail novo, nem do painel no estado `falhou`. As fotos mostram a Ana só como "Convite em aberto", sem o texto do envio. A vitrine não digita, então revisei essas etapas só pelo código e pelos testes. Fotografá-las numa rodada futura confirmaria que só o e-mail novo aparece e só para a coordenação.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/professores/api/professores.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/professores/convite-de-professor.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.test.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/professores-envio.spec.ts

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-10 15:47:40 · `tasks/prd-acesso-e-convites/19_task.md`

VEREDITO: APROVADO
Tela vista: sim (10 fotos lidas: lista, painel da Ana e diálogo "Corrigir o e-mail", em 1366 e 360 px na escola cheia; lista e painel da Rosa, em 1366 e 360 px na escola vazia). Não vi o e-mail fora do formato, o `CONFLITO`, o link nem a rede, que não têm foto. Os revisei pelo código e pelos testes.

Estados: ok.
- **Vazio:** a escola vazia mostra a professora ativa, e o painel dela não tem o botão novo.
- **Carregando:** o botão vira "Corrigindo…" e há `role="status"` para leitor de tela. O segundo envio é travado pela referência `noAr`.
- **Erro:** o e-mail fora do formato, o `CONFLITO` no campo, o convite que mudou (fica só "Fechar"), a rede com "Tentar de novo" e o foco no aviso, tudo em texto que diz o que fazer.
- **Com dado:** a etapa "E-mail corrigido" mostra o link uma vez, com "Copiar link" e "Enviar por e-mail".

Acessibilidade: ok.
- O campo tem rótulo, `(obrigatório)` e dica.
- `type=email`, `inputMode=email`, `autoComplete=off` e `spellCheck=false` estão certos.
- O foco inicial vai ao campo, e o foco volta ao campo a cada recusa do e-mail.
- O foco inicial do campo está visível na foto, e os títulos das etapas recebem foco.
- O contraste segue os tokens da pele, sem cor nova.

Chromebook fraco: sem peso novo. É um diálogo pequeno, sem lista nem imagem. Não rodei throttling de rede e de CPU nesta rodada.

Celular: ok.
- Os arquivos `...Ana-convidado--celular.png` e `...Corrigir-o-e-mail--celular.png` não têm rolagem horizontal nem corte.
- As ações principais têm 44 px, e Cancelar e as secundárias passam de 24 px.
- Não há dependência de hover ou atalho, e nada exige o celular.
- As fotos de celular mostram a barra inferior no meio da página, mas isso vem da captura de página inteira e não é defeito.
- O e2e da medida (`professores-envio.spec.ts:615-641`) cobre as duas larguras com nome de 120 caracteres sem espaço.
- A lista `Rolam a 1366 × 768` veio vazia, então nenhum RF de "a tela cabe" é violado.

Ação oficial protegida: sim. A ação não é nota nem publicação. O diálogo mostra o nome do professor e diz antes que o link anterior deixa de valer. O e-mail de hoje não aparece em lugar nenhum. O link fica fora do cache (`gcTime: 0`), da URL e do armazenamento. Fechar sem copiar pergunta antes.

Bloqueantes: nenhum.

Verificações:
- `grep -rn 'Confira o e-mail e reenvie' apps/web/src e2e/ docs/` voltou vazio.
- O texto do `docs/interface.md` item (4), linha 584, confere com a tela.
- Rodei `vitest run src/areas/coordenacao/professores`: 182 testes passam. Na primeira execução 4 falharam, porque o `packages/shared/dist` estava velho e não exportava `CORRIGIR_EMAIL_DO_PROFESSOR_POR_ESTADO`. Reconstruí o `dist` (pasta ignorada pelo git, não é código-fonte) e passaram. Quem rodar o portão precisa do build do `shared` em dia.

Recomendações:
- No celular, o rodapé do painel da Ana empilha quatro botões alinhados à direita, com larguras diferentes. Ficaria mais limpo com largura total ou igual em 360 px (`PainelDoProfessor.tsx`, rodapé).
- Falta foto das etapas que exigem digitação (e-mail inválido, `CONFLITO`, link). A vitrine só clica, então a validação deve vê-las com um passo de digitação.
- A foto da Ana não tem o estado `falhou`, que é o gatilho do texto novo "Não chegou. Corrija o e-mail e reenvie, ou copie o link". O texto está coberto por `envio-do-convite.test.ts` e pelo e2e.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/professores/PainelDoProfessor.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/professores-envio.spec.ts`

## infra-guardian · 1ª rodada · APROVADO · 2026-11-10 15:48:09 · `tasks/prd-acesso-e-convites/19_task.md`

```
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
- O "Enviar por e-mail" leva ao "Reenviar", que refaz o convite. Assim, toda correção seguida de envio gasta dois tokens e duas gravações. Não pesa às 10h, porque é ação da coordenação, rara e fora da sala. Fica registrado para a retro, caso a rota do envio passe a aceitar o convite que acabou de ser refeito, sem refazê-lo de novo.
- O e2e ganhou quatro casos em e2e/professores-envio.spec.ts. Rodei tools/ci/esteira.test.ts e tools/ci/prazo-do-e2e.test.ts e os dois passam (27 de 27). Como a própria tarefa diz que a fatia 1 está no teto, vale olhar a duração real dessa fatia na próxima execução da esteira, antes de entrar outra spec nela.
```

A tarefa só mexe na tela: não cria rota, job, query, migration nem estado no servidor. A rota `POST /v1/professores/:usuarioId/email` e as proteções dela no banco são da 18.0, auditada antes, e o diff não as toca.

Os pontos que conferi no código:

- **Clique duplo:** a trava `noAr` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx:209-211` segura o segundo clique, e há teste de unidade para ele. A proteção de verdade contra corrida segue no servidor.
- **Releitura da lista:** depois da resposta, a tela relê a lista uma vez só (`onSettled` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/professores/api/professores.ts:175-181`), sem consulta repetida em intervalo.
- **Estado em memória:** o link e o e-mail novo vivem só na mutação do diálogo (`gcTime: 0`), dentro do navegador. Nada fica guardado no servidor que quebre com duas instâncias.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-10 15:48:13 · `tasks/prd-acesso-e-convites/19_task.md`

VEREDITO: APROVADO

Escopo: respeitado. A tarefa não mexe na rota, no contrato nem no servidor. A recusa do e-mail de coordenador (D11 do `TODO.md`) não foi decidida aqui e passou para a validação do F2c com o motivo escrito, e isso é o certo, porque a rota é da 18.0. As quatro subtarefas estão feitas. O `grep 'Confira o e-mail e reenvie'` em `apps/web/src`, `e2e/` e `docs/` volta vazio, e o texto antigo só sobra onde a 19.3 justifica: `validacao.md`, `tasks.md` e o próprio `19_task.md`.

Aderência à Tech Spec: ok. As três divergências do diálogo estão em `cenarios.md`, linha "Corrigir o e-mail" de "Telas": "Fechar" sozinho no convite que mudou, o aviso de rede com o foco nele e a pergunta antes de fechar com o link. A primeira está também na `techspec.md` §9. As fotos batem com a linha de "Telas" e com o `docs/interface.md` (4):
- `coordenacao--coordenacao-professores--Ana-convidado--computador.png` mostra o botão secundário no `pendente`.
- `coordenacao--coordenacao-professores--Ana-convidado-button-name-Corrigir-o-e-mail--celular.png` mostra o campo vazio, "O link anterior deixa de valer." e nenhum e-mail atual.
- `vazia--coordenacao--coordenacao-professores--Professora-Sintética-Rosa--computador.png` mostra o professor `ativo` sem o botão.

Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)").

Bloqueantes: nenhum.

Recomendações:
1. `tasks/prd-acesso-e-convites/19_task.md:94`: a coluna "Onde está na spec" cita `techspec.md` "§5, Corrigir o e-mail", mas a frase acrescentada está na §9 (Frontend), em `techspec.md:238-241`. A citação precisa dizer §9.
2. As divergências 2 e 3 (o aviso de rede com o foco e a pergunta de fechar com o link) estão só no `cenarios.md`. Vale uma frase na §9 da `techspec.md`, como a da divergência 1, para a spec não depender só da tabela de "Telas".
3. `apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx:186`: o docblock diz que o link "sai do cache de consultas na hora". O `gcTime: 0` e o `reset()` tiram o link do cache de **mutações**, e é isso que o teste de `api/professores.test.ts` prova. O comentário afirma algo diferente do que o código faz, e a pergunta 7 da autoconferência pede justamente essa conferência.
4. `DialogoDeCorrigirEmail.tsx:125`: depois do `CONFLITO` em aberto, o texto do e-mail que não serve continua no campo enquanto a pessoa digita outro e-mail. Ele só some no envio seguinte, porque `mudar` limpa só o `digitado.erro`. Se a intenção for limpar ao digitar, como já acontece com o erro de formato, isso precisa de uma linha no `cenarios.md` e de um caso de teste.
5. O `19_task.md` avisa que a fatia 1 do e2e está no teto, e a tarefa acrescenta quatro casos ao `e2e/professores-envio.spec.ts`. A integração fica fora do portão (D52), mas vale a esteira olhar o aviso de prazo do e2e (`tools/ci/prazo-do-e2e.ts`) na primeira execução depois do pouso.
6. A pergunta 2 da autoconferência diz que os estados com digitação foram fotografados, mas a vitrine desta rodada não tem essas fotos: e-mail fora do formato, `CONFLITO` e link. Revisei esses estados pelo código e pelos testes. A frase deve dizer o que de fato ficou registrado.

Arquivos citados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/19_task.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/techspec.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx

## test-engineer · 1ª rodada · REPROVADO · 2026-11-10 15:49:30 · `tasks/prd-acesso-e-convites/19_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:**
- Caminho feliz, ponta a ponta: o envio `falhou`, a coordenação corrige o e-mail e envia pelo "Reenviar", o Mailpit recebe no e-mail novo e não no velho, o professor aceita e vê a turma da grade.
- O botão por estado, nos seis estados.
- O e-mail de hoje não aparece.
- O pedido no ar: botão ocupado, clique duplo e o segundo envio no mesmo quadro.
- `CONFLITO` com o professor ainda em aberto: texto, foco no campo e a lista relida.
- `CONFLITO` com o estado mudado, professor fora da lista e `NAO_ENCONTRADO`.
- A rede: o aviso, "Tentar de novo" e o aviso apagado.
- O sucesso: link uma vez, "Copiar link", a pergunta antes de fechar, `pendente` sem envio.
- O link fora da URL, do armazenamento e do cache de mutações.
- "Enviar por e-mail".
- O novo texto do `falhou`.
- O recomeço: outra coordenadora revoga com o diálogo aberto, e a resposta chega atrasada com o diálogo já fechado.
- D64.
- 360 px e 1366 × 768.
- Permissão: quem já entrou não tem o botão (pela matriz) e a rota recusa (18.0).
- Isolamento: é tela, sem repository, e o isolamento é da 18.0.

**Cobertos:** todas as linhas da tabela têm caso citado pelo nome, e os casos existem.
- Os 9 arquivos de `apps/web/src/areas/coordenacao/professores/` passam: 182 de 182.
- `tools/ci/esteira.test.ts` › "o teto do e2e cobre a suíte…" passa com os 4 casos novos de e2e.
- Não há `.skip`, teste comentado nem mock que esconda a regra; o diálogo roda com a mutação de verdade sobre a rede falsa. Não há IA.
- O clique duplo e o segundo envio no mesmo quadro (`act` com dois `requestSubmit`) são concorrência real do lado do cliente.
- A resposta atrasada é segurada de verdade com `page.route`.
- Conferi as 41 mutações contra o `git diff`. Cada cláusula com condição tem bloco, e os três motivos de mutante equivalente se sustentam:
  - o rodapé: `pendente` e `vencido` sempre têm `acoes.length > 0`;
  - `corrigir.data` e `estadoAgora !== undefined`: só estreitam o tipo.
- O bloco `estadoAgora={alvo.estado}` fica vermelho pelo motivo certo. Em execução, o `alvo` é o objeto inteiro capturado na abertura, com `pendente`, e o texto passa a ser o do e-mail que não serve.

**Bloqueantes:**
1. `apps/web/src/areas/coordenacao/professores/PainelDoProfessor.test.tsx:140` e `:144`. Mesmo vício em `:175` e `:178`.
   - **O que está errado:** a asserção sempre passa (regra 40, item 5). `antes = vezes(rede, '/v1/professores')` é lido depois do `instalar`, mas antes de a tela montar, então vale 0. A primeira leitura da lista, ao abrir o painel dentro de `corrigirComOEmail`, já faz `vezes(...) > antes` ser verdadeiro, com ou sem a releitura do `CONFLITO`.
   - **Por que pesa:** a tabela, linha "`CONFLITO` em aberto", cita esse caso como a prova de "a lista lida de novo". Tirar o `recarregar` de `mutacaoDaCorrecaoDoEmail(alvo.usuarioId, recarregar)` em `Professores.tsx:364` deixa esse caso verde. A regra segue provada por outros caminhos: `api/professores.test.ts` (o `onSettled` no `CONFLITO`), o caso "aceito" (a ligação) e o caso "saiu de `pendente`". Mas o caso citado não prova nada.
   - **Correção exigida:**
     - Ler `antes` com o painel já aberto e as leituras terminadas, imediatamente antes do clique que envia. Por exemplo, devolver de `corrigirComOEmail` o número de leituras da lista antes do submit, ou dividir o helper.
     - Depois, exigir `vezes(...) > antes` com `waitFor`.
     - Fazer o mesmo no caso do `NAO_ENCONTRADO`, em `:175` e `:178`. Ali a regra já está provada pelo foco no título da lista, mas a linha continua sendo uma asserção que sempre passa.

**Recomendações:**
- **`DialogoDeCorrigirEmail.test.tsx:288`, "a rede…":** "a tentativa seguinte apaga o aviso" só é conferido depois do sucesso, quando a etapa do link já tirou o aviso de qualquer jeito. Segure a segunda resposta (`rede.segurar()`) e confira `queryByRole('alert')` nulo com o pedido no ar e o diálogo ainda no campo.
- **`19_task.md`, linha "`CONFLITO` com estado mudado":** a tabela diz "quatro estados e o fora da lista", mas o `it.each` em `DialogoDeCorrigirEmail.test.tsx:326` tem três (aceito, revogado, desativado) e o fora da lista. O `ativo` só está em `convite-de-professor.test.ts`. Acrescente o `ativo` ao `it.each` ou corrija o texto.
- **`e2e/professores-envio.spec.ts:761` e a autoconferência, item 10:** dizem "outra coordenadora, em outra aba", mas o caso usa `revogarConvite` direto no banco. O cenário (o estado muda no servidor com o diálogo aberto) está provado; só o texto afirma uma segunda aba que não existe.
- **`PainelDoProfessor.test.tsx:94`:** o `not.toMatch(/@/)` no `body` é fraco, porque as fixtures da lista não têm e-mail algum. A prova real é a do contrato (E8) e a do diálogo. Pode ficar, mas não conta como prova do "e-mail de hoje".
- **Fotos:** a vitrine não tem foto dos estados que exigem digitação (formato inválido, `CONFLITO`, link). A autoconferência, resposta 2, diz que foram fotografados. Ou anexe as fotos, ou corrija a frase.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-10 16:11:23 · `tasks/prd-acesso-e-convites/19_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum
Recomendações:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/TODO.md:2835`: o registro do `privacy-guardian` termina em "Decidir junto com o e-mail de coordenador", sem ponto e sem dizer o que se decide. Fechar a frase, por exemplo: "Decidir junto com o e-mail de coordenador se o `CONFLITO` muda."
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/professores/PainelDoProfessor.test.tsx:108`, `:123` e `:136`: o `vezes(...) > leiturasAntes` prova que houve uma releitura depois do envio, mas não diz de onde ela veio. Se a releitura de 5 s do envio estiver ativa no caso (linha `na_fila` ou `enviando`), ela pode deixar o caso verde sem o `onSettled`. Os dois blocos de mutação novos (`mutacaoDaCorrecaoDoEmail(alvo.usuarioId)` sem `recarregar`) saíram vermelhos, então hoje está provado. Quem montar caso novo com envio em curso deve se lembrar disso.

As seis recomendações da 1ª rodada foram atendidas:
1. A citação da divergência passou de §5 para §9 (`19_task.md`, tabela de divergências).
2. A §9 da `techspec.md` (linha 241) ganhou o aviso da rede com o foco nele e a pergunta antes de fechar. O termo é o mesmo do `cenarios.md` e da tabela da tarefa.
3. O docblock de `DialogoDeCorrigirEmail.tsx:186` diz "cache de mutações, nenhuma consulta o guarda", que é o que o `gcTime: 0` de `api/professores.ts:94` faz.
4. e 5. O texto do `CONFLITO` foi para o `TODO.md` com dono, e o prazo do e2e foi para a esteira com destino, os dois na tabela "Recomendações sem aplicar".
6. A frase das fotos, item 2 da autoconferência, deixou de dizer que a vitrine fotografou as etapas com digitação.

O diff fora de documento só mexe em teste, num comentário e no título do e2e, e nada disso muda a tela. O caso "Tentar de novo" de `DialogoDeCorrigirEmail.test.tsx` agora segura a segunda resposta e confere que o aviso já saiu com o pedido no ar. O `ativo` entrou no `it.each` do `CONFLITO` com o estado mudado. O título e o comentário do e2e (`e2e/professores-envio.spec.ts:540` e `:559`) agora descrevem o que o caso faz: a revogação é feita direto no banco, sem uma segunda aba.

O bloqueante do `test-engineer` na `PainelDoProfessor.test.tsx` não é meu e não pesou neste veredito.

## test-engineer · 2ª rodada · APROVADO · 2026-11-10 16:11:31 · `tasks/prd-acesso-e-convites/19_task.md`

VEREDITO: APROVADO

Cenários exigidos: os da 1ª rodada, sem mudança. Nesta rodada confiro só a correção exigida, o diff b72f5fd → cae9b8c e o que ele afeta.

Cobertos:
- **O bloqueante 1 está corrigido.** `corrigirComOEmail` agora recebe a rede e lê `leiturasAntes` imediatamente antes do clique que envia (`PainelDoProfessor.test.tsx:592`). Nesse ponto o painel já está aberto, as turmas foram lidas e o e-mail foi digitado, então a leitura de abertura já está somada.
  - Os três casos exigem `vezes(rede, '/v1/professores') > leiturasAntes` dentro de `waitFor`: o "aceito" (:650), o `CONFLITO` em aberto (:682) e o `NAO_ENCONTRADO` (:715).
  - A releitura só acontece pelo `recarregar` passado em `Professores.tsx:364`. Sem ele, nada invalida a consulta da lista depois do envio, o `waitFor` esgota o tempo e o caso fica vermelho.
  - Os dois blocos novos da seção "Mutações" do `19_task.md` tiram exatamente esse argumento e citam os casos pelo nome. O documento registra os dois como vermelhos na corrida do portão.
- **Recomendação (a):** a segunda resposta fica no ar (`DialogoDeCorrigirEmail.test.tsx:292-308`). Com o botão "Corrigindo…" desligado, o caso confere que o aviso já saiu e que o campo segue na tela, e só depois solta a resposta. Agora prova que o aviso some no reenvio, e não quando o link chega.
- **Recomendação (b):** `ativo` entrou no `it.each` do `CONFLITO` com o estado mudado (:336).
- **Recomendação (c):** o título do e2e (`e2e/professores-envio.spec.ts:540`), o comentário dele (:559), a linha "recomeço" da tabela e o item 10 do plano agora dizem que a revogação é feita direto no banco, sem segunda aba. O nome citado na tabela bate com o título do caso.
- **Recomendação (d):** a frase das fotos no item 2 está ajustada.
- **Execução:** `PainelDoProfessor.test.tsx` e `DialogoDeCorrigirEmail.test.tsx` passaram, 59 de 59. No diff não há `.skip`, teste comentado nem mock que esconda a regra.

Bloqueantes: nenhum.

Recomendações:
- No caso "Enviar por e-mail" (`PainelDoProfessor.test.tsx:663`), `corrigirComOEmail` é chamado sem a rede, e `leiturasAntes` vale 0 sem ser usado. É inofensivo, mas tornar o parâmetro obrigatório, ou devolver `undefined` sem a rede, evita que um caso futuro compare com esse 0 e repita a asserção que sempre passa.
