# Achados das revisões — `tasks/prd-reengenharia-continuacao/13_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-15 20:05:47 · `tasks/prd-reengenharia-continuacao/13_task.md`

VEREDITO: APROVADO
Tela vista: sim (4 fotos lidas, as duas telas a 1366 e a 360 px; "cheia e vazia" não se aplica, a tela é fora de área, sem papel nem escola). Não fotografei a falha dentro de uma área, com a casca de pé. Só a conferi pelo código e pelo teste unitário.
Estados: ok. Carregando e vazio não se aplicam à tela de falha. O estado de erro é a própria tela, e o código mostra que ela:
- diz o que fazer ("Tente de novo ou volte ao início");
- dá dois caminhos de volta com o mesmo peso (D59);
- usa `role="alert"`.
Acessibilidade: ok.
- O foco vai ao título (`AreaErrorBoundary.tsx:41-44`) e o anel está visível nas fotos.
- O título da aba é trocado pelo gancho `useTabTitle`.
- O texto em vermelho sobre fundo rosa tem contraste legível nas fotos.
- O "Voltar ao início" é um `<a>` de verdade, e o "Tentar de novo" é um `<button>`.
- O e2e roda axe (`seriousViolations`).
Chromebook fraco: sem peso novo. É uma fronteira de erro, sem lista e sem imagem. A página não rola a 1366 × 768 (medida de 768 px). Nenhum RF de "tela cabe" é violado, porque a lista `Rolam` está vazia.
Celular:
- A 360 px não há rolagem horizontal nem corte.
- Os botões quebram em coluna na foto e medem cerca de 48 px.
- O e2e lê o `min-height` de 44 px no estilo, e não só a altura da caixa, o que é a prova correta.
- O e2e também prova a quebra em linha a 280 px.
- Nada depende de hover ou de atalho.
Ação oficial protegida: sim (não há ação oficial na tela). O "Tentar de novo" só recarrega a página. O teste do espelho da fila confirma que a escolha da aluna sobrevive à recarga.
Bloqueantes: nenhum.
- Fotos: as quatro estão em português, sem id, sem chave de tradução e sem texto em inglês.
- Termos técnicos: o texto não tem "erro 500" nem termo técnico, e a regra 50, item 12, é provada por mutação com `TERMO_TECNICO`.
- Pele: os botões usam os tokens existentes, `Button` e `SECONDARY_LINK_CLASSES`, sem componente refeito.
- Código: `routes.tsx:69-78` e `routes.tsx:258-269` põem a fronteira de fora em volta das rotas, e `voltarPara={BASE_DA_OPERACAO}` está em `routes.tsx:213`.
- Teste unitário: `AreaErrorBoundary.test.tsx` passou (9 de 9). Não rodei o e2e. Li `e2e/tela-de-falha.spec.ts`, e as asserções cobrem foco, medidas, volta e operação.

Recomendações:
- As fotos mostram o conteúdo colado no canto superior, com a janela vazia embaixo. Centralizar na vertical, ou pôr o logotipo da Turmma no topo, daria mais cara de produto à falha de página inteira (`AreaErrorBoundary.tsx:63`, `min-h-screen` sem alinhamento). Não bloqueia.
- O bloco novo em `docs/interface.md` (cerca de 772-784) termina com a frase sobre o espelho da fila (`sessionStorage`). Isso é detalhe de implementação e pertence à seção da prova, não à da tela de falha.
- A falha dentro de uma área, com a casca de pé, continua só com prova unitária. Vale uma foto na validação.

Arquivos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/components/AreaErrorBoundary.tsx`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/routes.tsx`, `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/tela-de-falha.spec.ts`.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-15 20:05:59 · `tasks/prd-reengenharia-continuacao/13_task.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum. A mudança é só na web: a fronteira de erro de página inteira e o link "Voltar ao início". Não toca API, fila, IA, banco nem deploy.
Rate limit: ok. A tarefa não cria rota nem limite novo.
Fila e prioridade: ok. Não há job novo.
Concorrência: protegida. Não há operação que possa rodar duas vezes ao mesmo tempo. O "Voltar ao início" é um link comum e só recarrega a página, como o "Tentar de novo" que já existia.
Índice e paginação: ok. Não há query nova.
Degradação de IA: não se aplica.
Migration: não se aplica.
Métrica e alerta: ok. Não há código novo no servidor.
Bloqueantes: nenhum.
Recomendações:
- Na prova online, a escolha que o servidor ainda não confirmou continua no espelho (`sessionStorage`) depois do "Voltar ao início". Isso está provado em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/components/AreaErrorBoundary.test.tsx:187-199`, mas só no jsdom, que não navega. Falta um caso no `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/tela-de-falha.spec.ts` que recarregue a página de verdade e confira que a fila é reenviada depois. Esse caso fecharia a regra "nenhuma resposta de prova se perde" no navegador. Não bloqueia: a fila e o espelho não mudaram nesta tarefa.
- A tela de falha não registra no servidor que uma tela quebrou. Sem esse registro, uma falha que atinja todas as escolas às 10h só aparece quando alguém reclamar. Fica para uma tarefa futura de observabilidade da web, com runbook se ganhar alerta.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-15 20:06:01 · `tasks/prd-reengenharia-continuacao/13_task.md`

**VEREDITO: APROVADO**

A tarefa só mexe na web. Não há campo, rota de API, query, log nem envio novo, e a tela de falha não mostra nenhum dado de pessoa.

Campos pessoais tocados: nenhum. O diff só traz texto fixo da tela de falha (`FALHA_FORA_DE_AREA`, em `apps/web/src/routes.tsx:74-78`), a prop `voltarPara` e o link "Voltar ao início" (`apps/web/src/components/AreaErrorBoundary.tsx:55-60`).

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: não se aplica. A tarefa não cria rota nem leitura de objeto. A fronteira de fora não lê a sessão: o teste confere que `/v1/eu` não é chamado (`AreaErrorBoundary.test.tsx:253`). Também não mostra nome nem casca, provado por `:251-252`.

Logs: limpos. A fronteira não tem `componentDidCatch` (`AreaErrorBoundary.tsx:74-85`). O erro pego não é registrado nem mandado a terceiro, e a mensagem dele não chega à tela: `Falha` só recebe título e texto fixos.

Auditoria: não se aplica. A tarefa não tem ação que a regra 20, item 10, exija auditar.

Envio externo: nenhum.

Seed/fixture: sintéticos. "Camila Souza", "Colégio Vista Alegre" e os UUIDs `0197a1c0-…` no teste unitário são inventados. O e2e usa uma resposta inventada do `/v1/sistema/.../estado` e um módulo que lança.

Fotos da tela, conferidas.
- `.processo/vitrine/falha-sistema-computador.png` e `falha-sistema-celular.png` mostram só o título "Esta tela não abriu", o texto fixo e os dois botões.
- `falha-operacao-computador.png` e `falha-operacao-celular.png` mostram só "Operação Turmma", o texto fixo e os dois botões.
- Em nenhuma das quatro aparece nome, matrícula, id, stack trace, código de erro ou texto da exceção. Isso confere com `AreaErrorBoundary.tsx:48-60`, que mostra só as props fixas.

Erro sem stack trace e sem dado no corpo: ok. As fotos confirmam, e um teste prova que o texto não tem termo técnico (`AreaErrorBoundary.test.tsx:282-297`).

Pergunta de fechamento: a tarefa não muda o que o sistema guarda sobre um aluno nem para onde isso é enviado, então a resposta continua a mesma de antes.

Bloqueantes: nenhum.

Recomendações:
- O "Voltar ao início" deixa intacto o espelho da fila no `sessionStorage`, que guarda a escolha da aluna com `alunoId`, e o teste da `:316-328` prova isso. É comportamento que já existia, e numa recarga na mesma aba é o que se quer. Mesmo assim, vale conferir numa tarefa futura que sair da sessão limpa esse espelho, porque o computador da escola é usado por vários alunos (D43). Não é desta tarefa.
- Se um dia alguém puser `componentDidCatch` para mandar o erro a telemetria, a mensagem da exceção pode carregar dado de tela. Vale um comentário curto na classe dizendo que o erro não é registrado de propósito, ou que, se for, vai só com id e nome do componente.

Arquivos auditados:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/components/AreaErrorBoundary.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/routes.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/apps/web/src/components/AreaErrorBoundary.test.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/e2e/tela-de-falha.spec.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/docs/interface.md`

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-15 20:06:03 · `tasks/prd-reengenharia-continuacao/13_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A mudança é só na web: a tela de falha e a fronteira em volta das rotas, sem endpoint, job, seed, importação nem webhook. Todos com autor humano? Não se aplica, porque nenhum caminho foi criado nem alterado.

Decisão autônoma sobre aluno: ausente.

Aprovação registrada: ok. Nenhuma saída de IA é criada nem mostrada. A exceção do tutor (D47) não aparece em lugar nenhum.

Supervisão do tutor: ok. A fronteira de fora só pega a tela que quebra fora de uma área: a entrada, a sala pública, a troca da senha, o estado do sistema e a operação. Dentro da área do aluno, a fronteira da área continua pegando primeiro, e o teste "dentro de uma área, a fronteira da área pega primeiro" prova isso com a área do professor. Nada abre um uso do tutor que o professor não veja.

Autonomia declarada e visível: sim, e sem mudança. Nenhum agente foi tocado.

O que vi nas fotos:
- Na foto `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/.processo/vitrine/falha-sistema-computador.png` e na do celular, o título é "Esta tela não abriu", com uma linha em português comum e os botões "Tentar de novo" e "Voltar ao início". Não há saída de IA, nota, conceito nem sugestão de nota. O texto vem de `apps/web/src/routes.tsx:72-76`.
- Na foto `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/.processo/vitrine/falha-operacao-computador.png` e na do celular, o título é "Operação Turmma", com o mesmo par de botões. A tela não induz uso e não dificulta sair: o "Voltar ao início" está à vista, sai com um clique a 1366 px e a 360 px, e na operação leva a `/operacao` (`apps/web/src/routes.tsx:213`).
- A guarda contra vocabulário de nota no texto da falha está testada (`apps/web/src/components/AreaErrorBoundary.test.tsx:289-304`, `VOCABULARIO_DE_NOTA`), e a mutação correspondente está registrada na tarefa.

Supervisão e vigilância: a fronteira não registra nem envia o erro a lugar nenhum. `apps/web/src/components/AreaErrorBoundary.tsx:77` só guarda `{ falhou: boolean }`. Nada mede navegação ou comportamento do aluno.

Medir o professor: não se aplica. Não há métrica, painel, ranking nem conversa do chat.

Bloqueantes: nenhum.

Recomendações:
- Em `apps/web/src/components/AreaErrorBoundary.tsx:54` o comentário diz "Os dois têm o mesmo peso (D59)", e `docs/interface.md:126` diz "dois botões do mesmo peso". As fotos mostram outra coisa: "Tentar de novo" é o principal, em laranja, e "Voltar ao início" é o secundário, em branco. A D59 pede que sair não dê mais passos que ficar, e isso a tela cumpre. Sugiro trocar "mesmo peso" por "o mesmo número de passos" nos dois lugares, para que ninguém leia depois a frase como regra visual contrariada pela tela.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-15 20:06:18 · `tasks/prd-reengenharia-continuacao/13_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

As quatro divergências estão registradas no `13_task.md`, na `techspec.md` §5 ("A web (52.0, 56.0)") e no `cenarios.md` §7. A tarefa não entra no prazo das chamadas (12.0). Nas quatro fotos aparecem só o que o RF12 e a §5 pedem: título, texto em português comum, "Tentar de novo" e "Voltar ao início", sem casca e com foco no título. Na operação, o destino é `/operacao`.

Recomendações:

1. **A documentação diz uma coisa sobre os 360 px e a foto mostra outra.**
   - A `techspec.md` §5 e o `cenarios.md` §7 dizem que a 360 px os dois botões "somam 290 px em 328 e cabem lado a lado". A mesma justificativa está na tabela de divergências do `13_task.md`.
   - O `docs/interface.md` (linha nova da tela de falha) diz que eles quebram em linha a 360 px.
   - Nas fotos `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/.processo/vitrine/falha-sistema-celular.png` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l2/.processo/vitrine/falha-operacao-celular.png`, os botões aparecem um sobre o outro a 360 px. No computador, eles medem cerca de 173 e 182 px.
   - O comportamento está correto e o teste a 280 px prova a quebra de qualquer jeito. O que precisa mudar é o texto: deixar a medida igual nos três documentos, ou dizer que ela depende da fonte carregada.

2. **Comentários desatualizados em `apps/web/src/components/AreaErrorBoundary.tsx`.**
   - Linha 16: o docblock de `paginaInteira` ainda diz "para a área que não tem casca em volta (a operação)". Agora a fronteira de fora do `AppRoutes` também usa essa prop.
   - Linhas 67–73: o docblock da classe ainda fala só de "uma área carregada por `import()`" e diz que "a tela que não carregou não tem o que perder na recarga". Isso não vale mais para a fronteira de fora, que pega um componente que lançou, por exemplo na troca de senha.
   - Os dois comentários devem descrever os dois usos.

3. **Volta para a mesma tela quebrada.** Se é a própria `/entrar` (ou `/operacao/entrar`) que lança, o "Voltar ao início" leva a `/` (ou `/operacao`), e isso redireciona de volta para a mesma tela quebrada. A tarefa não pede outra coisa, então não bloqueia. Vale uma nota no `docs/interface.md` para ninguém ler isso como defeito depois.

4. **Teste fraco no `apps/web/src/components/AreaErrorBoundary.test.tsx`.** O caso "a escolha guardada no espelho continua lá…" monta a fronteira sozinha, com uma tela de teste, e não a atividade real. Também clica num link que o `jsdom` não segue. Ele prova pouco além de que o clique não apaga o `sessionStorage`. Quem decide isso é o `test-engineer`; fica só registrado para ele.

## test-engineer · 1ª rodada · APROVADO · 2026-11-15 20:06:29 · `tasks/prd-reengenharia-continuacao/13_task.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- **Caminho feliz:** um componente lança numa rota sem área (a entrada, a sala pública, a troca da senha, o sistema). Aparece a `Falha` de página inteira, sem casca, com os dois botões, o título na aba e o foco no título.
- **Volta:** "Voltar ao início" é um link para `/` que recarrega a página e tira a tela da `Falha`.
- **Operação:** lá o destino é `/operacao`.
- **Dentro de uma área:** a fronteira da área pega primeiro e a casca fica de pé.
- **A prova não perde resposta:** a escolha que está no espelho da fila sobrevive.
- **Texto:** sem termo técnico e sem vocabulário de nota.
- **Medidas:** a 1366 × 768 a página não rola; a 360 px os botões têm 44 px, sem corte, sem rolagem horizontal e com axe; a 280 px os botões quebram em linha.
- **Permissão e isolamento:** não se aplicam, porque a tarefa é só da web, sem repository, rota da API nem dado de escola.
- **Concorrência:** não se aplica, porque um link de navegação clicado duas vezes não muda nada.

**Cobertos:** todas as linhas da tabela têm caso nomeado, que confere com o arquivo:
- `apps/web/src/components/AreaErrorBoundary.test.tsx`: o `it.each` das quatro rotas, o link para a raiz com o clique não impedido, a operação, a área do professor, o texto e o espelho.
- `e2e/tela-de-falha.spec.ts`: foco, medida (o ramo do computador, o de 360 px e o de 280 px), volta e operação.

A unidade passou, 9 de 9 (`npx vitest run --project unidade .../AreaErrorBoundary.test.tsx`). O e2e não rodei: confiei no portão da tarefa.

Os 11 blocos de mutação conferem com o `git diff`, e cada um chega à sua cláusula pelo motivo certo:
- **Tirar a fronteira, trocar `paginaInteira` ou trocar o texto pelo da área:** o `findByRole` do título ou o `getByRole('main')` falha.
- **Título da aba:** cai no `document.title`.
- **Texto com vocabulário de nota ou com termo técnico:** cai nos dois `not.toMatch`.
- **`voltarPara` da operação ou `href` fixo em `/`:** a operação espera `/operacao`.
- **Destino padrão trocado:** a entrada espera `/`.
- **Link trocado por botão:** o `getByRole('link')` falha.
- **Classe do link tirada:** o `min-height` lido no estilo deixa de ser 44 px.
- **`flex-wrap` tirado:** a 280 px o segundo botão passa da janela.

O `RouteSwitch` só moveu o corpo do `<Switch>` e não trouxe linha nova com condição.

O e2e de volta prova de verdade que a página recarrega. Se alguém trocar o link por um `Link` do wouter, que só muda de rota, a fronteira mantém a falha e o título "Esta tela não abriu" continua na tela, então o teste fica vermelho.

As asserções de ausência ("sem casca", sem `/v1/eu`) só correm depois de o título estar na tela. O caso da área do professor, que mostra "Camila Souza", é o controle positivo. Não há `.skip` nem teste comentado. Os mocks trocam só as telas que precisam lançar; a fronteira, o `AppRoutes`, a casca e a rede falsa são as de verdade. A tarefa não chama IA.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **O teste do espelho prova pouco.** Fica em `apps/web/src/components/AreaErrorBoundary.test.tsx:187-199`, no caso "a escolha guardada no espelho continua lá depois do Voltar ao início". O `fireEvent.click` no `jsdom` não navega, então a leitura "depois" é igual à de antes. O teste só pegaria uma `Falha` que apagasse o espelho no clique. Que a escolha sobrevive à recarga vem do próprio `sessionStorage` do navegador, e não fica provado. Ele também monta a fronteira solta, fora do `AppRoutes` e da área do aluno. Vale registrar isso na validação. Se um dia houver um e2e de atividade com a `Falha`, a prova certa é recarregar de verdade e ler o espelho.
2. **Falta conferir a saída da falha na operação.** Em `e2e/tela-de-falha.spec.ts:116`, o caso da operação podia conferir também que o título "Operação Turmma" da falha some, como o caso de volta faz na linha 103.
3. **O comentário promete mais que a asserção.** Em `apps/web/src/components/AreaErrorBoundary.test.tsx:147`, o comentário fala em "sem o `<main>` de página inteira", mas o teste só confere a ausência do título de fora. Isso basta para a regra; o comentário é que deveria dizer só isso.
4. **Só quatro das rotas sem área são exercitadas.** O `it.each` cobre as quatro da tabela; as outras (mfa, convite, esqueci a senha, redefinir, verificar, escolher a escola, página não encontrada) ficam de fora. Elas estão cobertas pela estrutura, porque a fronteira envolve o `<Switch>` inteiro e a mutação que a tira já fica vermelha. Vale anotar para a retro, não para corrigir agora.

## test-engineer · 2ª rodada · APROVADO · 2026-11-15 20:20:44 · `tasks/prd-reengenharia-continuacao/13_task.md`

VEREDITO: APROVADO

Cenários exigidos: os mesmos da 1ª rodada, para a tela de falha fora de uma área (RF12, `docs/interface.md` seção 6).
- **Caminho feliz:** a falha toma a página, com o foco no título e o título na aba.
- **Borda:** o chunk da operação chega quebrado (rede da escola caindo). A hora não formata em `/sistema`. Os botões quebram em linha a 360 e a 280 px.
- **"Voltar ao início":** leva a `/`, e na operação a `/operacao`. A página nova limpa a falha.
- **Fronteiras:** dentro de uma área, a fronteira da área pega primeiro e a casca continua de pé.
- **Permissão e isolamento:** não se aplicam, porque a tela não carrega dado de escola.

Cobertos: nesta rodada conferi o diff `07c22bb..ff30cfa` e o que ele afeta.
- **`apps/web/src/components/AreaErrorBoundary.tsx`:** o diff muda só comentários e JSDoc. Não entrou cláusula nova, então a seção "Mutações" (11 blocos, `--faltando: 0`) continua valendo sem bloco novo.
- **`e2e/tela-de-falha.spec.ts:118`:** a asserção nova (`'Operação Turmma'` com contagem 0 depois da volta) prova o que diz. O "Operação Turmma" da casca pública da operação é um `<p>` (`apps/web/src/operacao/components/CascaDaOperacao.tsx:55-58`), e não um título. Por isso a asserção não fica vermelha por engano na tela de entrada e só pega o `h1` da falha. O `13_task.md` registra que ela é asserção de teste, sem cláusula de produção a mutar. Isso está correto.
- **Documentos:** a conta corrigida em `13_task.md`, `cenarios.md` §7 e `techspec.md` §5 ("a 360 px os dois já quebram", 173 + 181 + 12 > 328) bate com o teste. A posição do segundo botão só se lê a 280 px (`e2e/tela-de-falha.spec.ts:89-94`), que é onde a mutação do `flex-wrap` cai.
- **`docs/interface.md`:** a frase sobre o `sessionStorage` saiu da seção 6 e foi para a seção da tarefa aberta. É só lugar do texto, sem regra nova a testar.
- **Rodei** `npx vitest run apps/web/src/components/AreaErrorBoundary.test.tsx` e os 9 casos passaram.

Bloqueantes: nenhum.

Recomendações:
- `e2e/tela-de-falha.spec.ts:118`: a asserção nova repete a da linha 116. Como a falha toma a página inteira, "Entrar na operação" visível já quer dizer que ela saiu. Pode ficar, porque deixa a intenção explícita.
- `docs/interface.md` seção 6 agora diz que, se a própria `/entrar` quebra, "Voltar ao início" faz a falha reaparecer. Não há teste disso, e não precisa ser regra. Se um dia virar promessa (por exemplo, "Voltar ao início" levando a outro lugar quando a falha é na entrada), aí precisa de caso.
