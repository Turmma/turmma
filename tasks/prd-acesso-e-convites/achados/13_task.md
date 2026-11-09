# Achados das revisões — `tasks/prd-acesso-e-convites/13_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-09 13:22:24 · `tasks/prd-acesso-e-convites/13_task.md`

VEREDITO: APROVADO
Tela vista: sim (4 fotos lidas: computador e celular, na escola cheia e na vazia)
Estados: ok. Só carregando e erro ficaram fora das fotos, e esses li pelo código e pelo e2e.
- Carregando: `TrocarSenhaProvisoria.tsx:170` mostra duas barras paradas, sem animação (D59), com o texto só para o leitor de tela. O e2e "carregando" confere isso e confere que o campo de senha já está livre.
- Vazio: "É a primeira vez que você troca a senha." (`:157`), sem tabela, como mostra a foto vazia. É uma frase informativa e não pede desculpa. O próximo passo, criar a senha, está logo acima.
- Erro, lista: `ErrorState` com "Tentar de novo" (`:156`), e o campo de senha continua livre.
- Erro, troca: senha curta com mensagem sob o campo, foco e valor mantidos. Conta segurada tem aviso próprio com o tempo de espera. Falha de rede usa `ErrorState`. O bilhete vencido ou sem bilhete vira um aviso que diz o que fazer: "Peça a senha de novo ao professor" ou "Entre de novo…". Nenhum desses mostra código técnico.
- Com dado: as linhas "Gerada pela coordenação em 12/11/2026 às 14:05 · usada" estão em português do Brasil, com data e hora no formato local.

Acessibilidade: ok.
- O campo tem rótulo "Senha nova (obrigatório)", dica visível e `autocomplete="new-password"`.
- O foco vai ao campo ao abrir, e o anel de foco aparece nas fotos.
- O erro usa `role="alert"` e o salvamento usa `role="status"`.
- O botão "Mostrar" é um interruptor com `aria-pressed`, e o nome acessível "Mostrar a senha" contém o texto visível.
- As cores são tokens da paleta, e o e2e roda `seriousViolations`, sem violação grave.

Chromebook fraco:
- Não rodei throttling de rede nem de CPU. Esse item é só de revisão e fica registrado.
- A tela é leve: uma consulta com `staleTime` infinito, `gcTime: 0` e sem refetch ao voltar o foco (regra 80). Não há lista longa, porque a API devolve no máximo 10 itens. A onça carrega por `import()` e, se falhar, a tela segue sem ela.
- Na foto a 1366 × 768, a escola cheia rola 39 px (807 contra 768). O PRD e o `docs/interface.md` não dizem que esta tela cabe sem rolar. A única menção a "1366" na spec é a tarefa 12.0, que é outra tela. Por isso não é bloqueante. A vazia cabe.

Celular:
- A 360 px não há rolagem horizontal nem texto cortado, nas duas fotos.
- "Criar a senha e entrar" tem cerca de 44 px de altura na foto. "Mostrar", "Voltar à entrada" e "Tentar de novo" têm 24 px ou mais.
- O e2e `celular` mede tudo isso no 360 px (rolagem, alvos de 44 e 24 px, acessibilidade), inclusive nos avisos da lista que falhou e do bilhete que não vale.
- Nada depende de hover nem de atalho. A tela não exige celular: o aluno entra em qualquer computador, pelo endereço da escola.

Ação oficial protegida: sim, no que cabe a esta tela. Ela não aprova nota nem publica nada. A ação sensível é a troca da senha, e ela mostra o que vai acontecer antes do envio. A frase "Ela serve só para isto: criar a sua senha. Depois você entra com a nova." fica no alto, e o botão diz exatamente "Criar a senha e entrar".

Bloqueantes: nenhum.

Recomendações:
- `TrocarSenhaProvisoria.tsx:161`: a linha "Gerada pelo professor em … · não usada" avisa o aluno, mas não diz o que fazer se ele não reconhece essa senha. Uma frase curta sob o título da lista ajudaria, por exemplo "Não reconhece alguma? Avise o professor". Só vale se o produto quiser esse caminho.
- `TrocarSenhaProvisoria.tsx:60`: com a lista cheia a 1366 × 768 a página rola 39 px, e o "Voltar à entrada" sai da primeira dobra. O botão podia ficar antes da lista, ou a lista ficar mais compacta. Não é exigência, porque nenhum RF pede que a tela caiba.
- Na foto `aluno--trocar-senha--computador.png` a onça aparece esmaecida, como se tivesse sido tirada no meio da entrada de 240 ms. A foto da escola vazia a mostra inteira, então não é defeito de código. A próxima rodada de fotos pode esperar a animação terminar.

Arquivos principais:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/TrocarSenhaProvisoria.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/api/troca-da-provisoria.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/troca-da-provisoria.spec.ts`

## tenancy-guardian · 1ª rodada · APROVADO · 2026-11-09 13:22:31 · `tasks/prd-acesso-e-convites/13_task.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma tabela nova. A tarefa só mexe no frontend e no apoio do e2e. Os helpers de teste `gerarProvisoriaNoBanco` e `vencerAProvisoriaNoBanco`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/support/seed.ts`, gravam em `credencial_matricula` e `auditoria`, que já existem. Os dois filtram por `escola_id` e `usuario_id`, e as inserções na `auditoria` levam `escola_id`.

Queries verificadas: nenhum repository novo e nenhum endpoint novo (a API é da 10.0, fora do escopo). Do lado do cliente:
- `trocasDaProvisoriaQueryOptions` (`apps/web/src/api/troca-da-provisoria.ts`) e `trocarSenhaProvisoria` (`apps/web/src/api/sessao.ts`) se identificam só pelo bilhete no `Authorization`. Não mandam `escolaId`, `usuarioId` nem slug.
- O `:slug` de `/e/:slug/trocar-senha` só monta os links "Voltar à entrada". Não decide nenhuma leitura.
- O slug no corpo de `entrarPorMatricula` já existia: é o login pelo endereço da escola (RF7), ainda sem sessão aberta.
- A chave da lista leva o `numero` do bilhete, nunca o bilhete. Com `gcTime: 0`, a lista de um aluno não fica para o próximo no mesmo navegador.
- O bilhete vencido, o já usado e o substituído dão a mesma tela, "Peça a senha de novo ao professor". Isso atende a regra 10, item 6.
- A linha da lista mostra só o papel de quem gerou a senha, sem nome e sem id.

Teste de isolamento: presente e efetivo para o que a tarefa toca. No e2e, `› o colega no mesmo computador` e `› resposta atrasada` cobrem o aluno seguinte no mesmo navegador. No teste de unidade, `troca-da-provisoria.test.ts › o aluno seguinte no mesmo computador` derruba a mutação `numeroDoUltimoBilhete = 1`, e `› lê com o bilhete no Authorization` derruba a chave sem o número. O isolamento entre escolas do bilhete fica na API e é coberto por `apps/api/test/troca-da-provisoria.int.test.ts`, da 10.0. Não reauditei esse teste.

Bloqueantes: nenhum.

Recomendações:
- `e2e/support/seed.ts`: o comentário de `gerarProvisoriaNoBanco` pede, no imperativo, que as provisórias anteriores fiquem a mais de uma hora uma da outra. Uma checagem no próprio helper evitaria que um teste futuro grave um "usada" fora de ordem sem ninguém perceber.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-09 13:22:41 · `tasks/prd-acesso-e-convites/13_task.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A tarefa não grava em `Nota` por nenhum caminho: interface, job, importação, seed ou webhook. O que o seed do e2e grava fica em `credencial_matricula` e `auditoria`, com dado sintético. Todos com autor humano? Não se aplica.

Decisão autônoma sobre aluno: ausente. A tela só troca a senha provisória por uma nova e abre a sessão. Nada mexe em aprovação, reprovação ou encaminhamento do aluno.

Aprovação registrada: ok. Nenhuma saída de IA passa por este fluxo, nem para o aluno nem para outra pessoa.

Supervisão do tutor: ok. O tutor não aparece nesta tarefa.

Autonomia declarada e visível: sim, e não mudou. Nenhum agente foi criado ou alterado.

Bloqueantes: nenhum.

O que conferi nas fotos e no código:
- **Nas quatro fotos** (computador e celular, escola cheia e escola vazia), a tela não traz texto de IA nem nota, conceito ou sugestão de nota. A onça é ilustração da marca e não fala como agente. Também não há nada que induza uso (D59).
- **Saída da tela.** Há sempre o "Voltar à entrada", tanto no formulário quanto nos dois avisos (`TrocarSenhaProvisoria.tsx:61` e `:207`). Assim, sair não é mais difícil que entrar (regra 70, item 4b).
- **Carregamento sem animação.** O esqueleto da lista são barras paradas, sem pulso nem giro (`TrocarSenhaProvisoria.tsx:170-180`).
- **Sem vigilância (itens 7 e 9).** A lista "Senhas provisórias de antes" mostra só o papel de quem gerou, nunca o nome (`api/troca-da-provisoria.ts:34-39`). Não mede nada do aluno nem do professor, não infere emoção e não cria indicador de professor.
- **Seed.** As linhas de auditoria do e2e usam `autor_operador = 'teste-e2e'` e dado sintético (`e2e/support/seed.ts:844-867`). Não criam nenhum caminho de nota ou de decisão.
- **Documentos.** `docs/regulacao.md` não foi alterado. As mudanças em `docs/interface.md`, `docs/glossario.md`, `docs/roteiro-da-demonstracao.md`, `techspec.md` e `cenarios.md` não tocam a regra 70.

Recomendações:
- O aviso "Peça a senha de novo ao professor" (`TrocarSenhaProvisoria.tsx:21` e `:24`) aparece mesmo quando quem gerou a provisória foi a coordenação, como mostra a própria lista na foto. Não é tema da regra 70; fica para o `frontend-reviewer` e para o texto do PRD.

Arquivos auditados:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/TrocarSenhaProvisoria.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/api/troca-da-provisoria.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/api/sessao.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/support/seed.ts
- As quatro fotos em /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/.processo/vitrine/

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-09 13:23:00 · `tasks/prd-acesso-e-convites/13_task.md`

VEREDITO: APROVADO

**Campos pessoais tocados:** nenhum campo novo. A tela só lê o que a 10.0 já criou: o bilhete da troca, que é uma credencial parcial, e a lista das provisórias anteriores (`geradaEm`, `papel`, `usada`). O schema dessa lista é `.strict()` (`packages/shared/src/sessao/senha-provisoria.ts:90-96`) e não traz nome, id de quem gerou, matrícula nem escola. A senha nova vai só no corpo do POST e o campo é zerado quando a resposta chega (`TrocarSenhaProvisoria.tsx:97`).

**Fora da tabela de dados do docs/lgpd.md:** nada.

**Fotos da tela:** as quatro (`aluno--trocar-senha--computador.png`, `aluno--trocar-senha--celular.png`, `vazia--aluno--trocar-senha--computador.png`, `vazia--aluno--trocar-senha--celular.png`) mostram só o papel de quem gerou ("pela coordenação" ou "pelo professor"), a data e se a senha foi usada. Não aparece o nome do aluno, a matrícula, o nome de quem gerou nem a escola por extenso. Isso bate com a D85 (os atos sobre o titular, sem o autor) e com `troca-da-provisoria.ts:31-36`.

**Autorização por objeto:** ok. Não há id na URL. O aluno e a escola saem só do bilhete, que vai no `Authorization` (`sessao.ts:615`, `troca-da-provisoria.ts:23`), e o corpo da troca só aceita `senha`. Um bilhete vencido, uma provisória já usada ou uma provisória trocada por outra recebem a mesma resposta e o mesmo texto (`TrocarSenhaProvisoria.tsx:21`, `:48`, `:102`).

**Bilhete:**
- Fica só em memória (`sessao.ts:527`).
- A chave do cache de consultas leva um número que sobe a cada bilhete, nunca o bilhete (`troca-da-provisoria.ts:19`).
- `gcTime: 0` tira a lista do cache quando a tela sai.
- O bilhete é apagado quando qualquer sessão abre (`sessao.ts:560`).
- Vale 10 minutos (`apps/api/src/credencial/bilhete-da-troca.ts:15`).
- O e2e `o bilhete fica fora da URL…` (`e2e/troca-da-provisoria.spec.ts:186`) prova que ele não está na URL, no `localStorage`, no `sessionStorage` nem nos cookies, e que vai só no `Authorization`.

**Logs:** limpos. Os arquivos novos e alterados não têm `console.*` nem logger.

**Auditoria:** nesta tarefa não há ação que a exija. É o próprio aluno lendo os atos sobre ele. `senha_provisoria.gerada` e `.usada` são da 10.0 e já constam do arquivo do titular (`cenarios.md`, linha [I]).

**Envio externo:** nenhum. Não há IA nem terceiro nesta tarefa.

**Seed/fixture:** sintético. `criarAlunoComMatricula` é aleatório, a provisória é sorteada por `randomInt` (`e2e/support/seed.ts:845`) e as senhas são fixas e sintéticas (`frase-sintetica-da-senha-nova-do-aluno`, `ABCD-EFGH`, matrículas `1234` e `5678`). As linhas de auditoria do seed usam o autor operador `teste-e2e`, só no banco de teste.

**Pergunta de fechamento:** responde. A tarefa não cria dado novo nem envio novo, e os atos da provisória já entram no arquivo do titular pela 10.0.

**Bloqueantes:** nenhum.

**Recomendações:**
1. **O bilhete sobrevive ao botão "voltar" do navegador.** Hoje ele só é apagado pelo link "Voltar à entrada" (`TrocarSenhaProvisoria.tsx:61`, `:207`), por um novo login ou por recarregar a página. `EntrarNaEscola.tsx` não chama `esquecerBilheteDaTroca` ao montar.
   - O risco: o aluno A volta pelo navegador e sai. Por até 10 minutos, quem usar o botão "avançar" na mesma aba reabre a troca de A e pode criar a senha dele.
   - Por que não bloqueia: é preciso agir de propósito, dentro da validade e na mesma aba, e se o colega fizer login de qualquer jeito o bilhete já é apagado.
   - Correção sugerida: chamar `esquecerBilheteDaTroca()` ao montar `EntrarNaEscola` ou ao desmontar `TrocaDoAluno`, com um caso e2e "voltar pelo navegador e avançar cai em 'Entre de novo'".
   - Ajustar também o `docs/interface.md`, no item "Recomeço", que hoje só cita o link.
2. A chave dos itens da lista (`TrocarSenhaProvisoria.tsx:161`, `geradaEm-papel`) é estável e não carrega dado pessoal. Não precisa mudar nada; anoto só para o caso de a lista ganhar campos no futuro.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-09 13:23:08 · `tasks/prd-acesso-e-convites/13_task.md`

```
VEREDITO: APROVADO
Caminho quente tocado: login
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum
Recomendações:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/TrocarSenhaProvisoria.tsx:141, :102 e :21. Se a rede da escola cair depois que o servidor já gravou a troca, o aluno clica em "Tentar de novo" e reenvia o mesmo bilhete. A API então devolve `NAO_AUTENTICADO`, porque o `update` condicionado já gastou a provisória, e a tela mostra "Peça a senha de novo ao professor", mesmo com a senha nova do aluno já valendo. Nenhum dado se perde, mas numa manhã de rede instável isso manda alunos ao professor pedir uma provisória sem necessidade. Sugestão: quando o `NAO_AUTENTICADO` vier de uma nova tentativa depois de falha de rede, acrescentar "Se você já criou a sua senha, entre com ela".
- Não precisa mexer no cenário de carga `login às 7h30`. A troca da provisória acontece pouco por aluno e já passa pelo semáforo do hash e pelo contador da conta (tarefa 10.0). Vale registrar isso na Tech Spec para a validação não perguntar de novo.
```

A tarefa só muda a web. A API das duas rotas veio da 10.0 e não está neste diff.

- **Rate limit:** a troca fica no contador da conta (escola + matrícula). Nada é limitado por IP.
- **Erro 503 do semáforo do hash:** a troca reaproveita a mesma espera da entrada (`comFilaDoSemaforo`, que respeita o `Retry-After` até 30 s), em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/api/sessao.ts`. Há teste para isso em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/api/troca-da-provisoria.test.ts`.
- **Clique duplo:** o navegador trava o segundo envio (`noAr`) e o servidor também, com o `update` condicionado na transação. O teste "dois envios seguidos mandam uma troca só" cobre o lado da tela.
- **Lista de provisórias anteriores:** `GET` lido uma vez, com `staleTime` infinito, sem nova leitura ao voltar o foco e `gcTime: 0`. A repetição automática segue o padrão do app (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/api/query-client.ts`): uma vez, e nunca em 4xx.
- **Estado em memória:** só no navegador (o bilhete da troca). O servidor não guarda nada em memória.
- **Testes:** nenhum chama provedor pago.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-09 13:24:11 · `tasks/prd-acesso-e-convites/13_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok. O que saiu do plano é o `ReauthDialog` virar o segundo chamador da troca, e isso está registrado na `techspec.md` §9 (último parágrafo), no `cenarios.md` (o novo [E] do bilhete, RF13) e na tabela de divergências do `13_task.md`.
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum

O bilhete fica só em memória e vai só no `Authorization`. As quatro situações da lista seguem a linha "Trocar a provisória" do `cenarios.md`, e a lista que falha não trava o campo. Os textos nas fotos são os do glossário e os da tabela de telas, e a tela não mostra nada fora do RF13.

Recomendações:
1. **Seed fora do que a tarefa pedia.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/support/seed.ts:210` (`gerarProvisoriaNoBanco`) grava a provisória e a auditoria direto no banco. Em "Como testar", a tarefa pedia "a provisória gerada pela API como na 10.0". As datas das provisórias de antes justificam gravar a auditoria à mão, mas a provisória atual podia sair da API. Do jeito que está, o helper repete o `gravarProvisoria` do repository e já difere dele: não grava `provisoria_gerada_por`. Uma mudança na geração da API não derrubaria este e2e. Vale gerar a atual pela API e deixar no banco só as de antes, ou registrar a escolha no `13_task.md`.
2. **O texto do "número do aluno".** `docs/interface.md` e `techspec.md` §9 dizem que a chave da lista leva "o número do aluno do bilhete". É um contador da aba (`numeroDoUltimoBilhete`, em `apps/web/src/api/sessao.ts:118`), não um dado do aluno, e quem lê pode tomá-lo pela matrícula. Sugestão: "o número de ordem do bilhete nesta aba".
3. **Leitura da lista com o bilhete de outro aluno.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/api/troca-da-provisoria.ts:21` pega o bilhete da memória na hora da chamada, sem conferir se o `numero` dele é o da chave. Hoje está protegido porque o TanStack cancela a consulta sem observador (o `signal` é usado). Ainda assim, um `bilhete.numero !== numeroDoBilhete → NAO_AUTENTICADO` impediria que uma nova tentativa atrasada da chave de A saísse com o bilhete de B.
4. **Dois "Tentar de novo" na mesma tela.** Se a lista e a troca falharem juntas, aparecem dois botões com o mesmo nome acessível (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/TrocarSenhaProvisoria.tsx:141` e `:156`). Quem usa leitor de tela não sabe qual repete o quê. Fica para o `frontend-reviewer`.
5. **Nome da função de caminho.** `caminhoDaEtapaDaEntradaPorMatricula` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/paths.ts:311`) também roteia a entrada por e-mail no `ReauthDialog.tsx:62`, e o nome diz só matrícula. Um nome neutro ("caminhoDaEtapaDaEntrada") leria melhor.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-09 13:24:26 · `tasks/prd-acesso-e-convites/13_task.md`

VEREDITO: REPROVADO

**Cenários exigidos (13.0; `cenarios.md` linhas 130, 133, 269 e 271):**
- **Caminho feliz:** o aluno entra com a provisória, troca a senha e cai em "Início", e a senha nova passa a valer.
- **Borda:**
  - primeira troca, sem tabela vazia;
  - a lista falha e o campo de senha continua livre;
  - datas em pt-BR com o ano, inclusive perto da meia-noite;
  - carregando;
  - senha curta;
  - conta segurada;
  - a rede cai e o aluno usa "Tentar de novo";
  - o 503 do semáforo do hash;
  - recarregar a tela perde o bilhete;
  - o colega usa o mesmo computador em seguida;
  - a resposta da lista de quem saiu chega atrasada.
- **Permissão:**
  - a tela aberta sem bilhete;
  - a lista recusada com 401;
  - o bilhete vencido na hora de trocar.
- **Privacidade:**
  - o bilhete fica fora da URL, do storage e dos cookies;
  - ele vai só no `Authorization` de `/trocas` e de `trocar-senha`;
  - ele sai da memória quando a sessão abre.
- **Concorrência:** dois envios seguidos mandam uma troca só.
- **Diálogo "Sua sessão expirou":** o aluno que recebe `trocar_senha` vai para a troca, e o diálogo da equipe cai em `/entrar`.
- **360 px, nos projetos `chromebook` e `celular`:** sem rolagem horizontal, ação principal com 44 px e o resto com 24 px.
- **Isolamento:** a tela não lê dado de escola sem o bilhete. O isolamento entre escolas fica na API (10.0) e já está provado em `apps/api/test/troca-da-provisoria.int.test.ts:291` e `:700`, com a troca em paralelo em `:828`.

**Cobertos:**
- Cada uma das 11 linhas da tabela tem o seu caso em `e2e/troca-da-provisoria.spec.ts`, com o nome citado. No `portao-13.log` os 26 casos passam nos dois projetos, e o mais lento leva 12,4 s, abaixo da metade do prazo.
- As 56 mutações ficaram vermelhas no portão.
- O `--faltando` só lista `TrocarSenhaProvisoria.tsx:101`, e o documento justifica essa linha.
- Rodei os 5 arquivos de unidade e de componente: 45 de 45 passam.
- Os dois envios no mesmo tick são concorrência de verdade: `TrocarSenhaProvisoria.test.tsx:265`, com dois `fireEvent.submit` seguidos.
- O 503 se prova com relógio falso, sem pôr a máquina sob carga.
- Não há `.skip`, teste comentado nem provedor de IA. A rede falsa só substitui o `fetch`: o módulo de sessão, o cliente de consultas e a tela são os de verdade.

**Bloqueantes:**
1. **`tasks/prd-acesso-e-convites/cenarios.md:133-135`**
   - **O que está errado:** esta tarefa acrescentou um item `[E]` com uma frase própria: "O diálogo 'Sua sessão expirou' do aluno, que recebe `trocar_senha`, leva à mesma tela". Nenhum e2e prova isso. `grep` por `trocar-senha` em `e2e/` só acha `troca-da-provisoria.spec.ts`, e nele nenhum caso passa pelo diálogo. Esse item também não tem linha na tabela "Testes que provam a regra" do `13_task.md`. O que existe é:
     - `apps/web/src/components/ReauthDialog.test.tsx:40`, que só confere o caminho calculado sem renderizar as rotas;
     - `paths.test.ts`, de unidade.
   - É o caso da X3: um item juntado a outros na mesma linha, sem o seu teste.
   - **Correção exigida:** uma das duas.
     - (a) Um caso de e2e: o aluno com sessão aberta deixa a sessão vencer, digita a provisória no diálogo e cai em `/e/:slug/trocar-senha` com "Crie a sua senha".
     - (b) Tirar a frase do diálogo do item `[E]` e escrevê-la como caso de componente, citando `ReauthDialog.test.tsx › o aluno que digita a senha provisória`. Junto, acrescentar à tabela da 13.0 a linha do diálogo (componente) e a linha do diálogo da equipe (`paths.test.ts › sem o endereço da escola`).

**Recomendações:**
- **Asserção que sempre passa:** em `TrocarSenhaProvisoria.test.tsx:219`, `document.body.textContent` nunca contém o valor de um `<input>`, então a linha passa sempre. Quem prova a regra é a `:218`, onde o campo some. Troque por uma asserção sobre o valor de algum input, ou tire a linha.
- **Teste de bilhete no jsdom:** em `TrocarSenhaProvisoria.test.tsx:353`, `window.location.href` no jsdom não é a `memoryLocation` da tela, e o caso pouco prova além do e2e. Remova-o ou deixe dito que ele é complementar.
- **Título do e2e do bilhete:** em `e2e/troca-da-provisoria.spec.ts:186`, o título diz "do cache de consultas", mas o caso não confere o cache. Quem prova isso é a asserção da chave em `troca-da-provisoria.test.ts:180`. Ajuste o título.
- **A resposta atrasada prova o resultado, não a chave:** `e2e/troca-da-provisoria.spec.ts:239` e `TrocarSenhaProvisoria.test.tsx:321` passam também porque o TanStack aborta a leitura de quem saiu ao desmontar a tela (o `signal` é usado). Sem o número na chave eles provavelmente continuariam verdes. O número na chave só é derrubado pela asserção estrutural (`queryKey(2)` diferente de `queryKey(1)`). Vale escrever isso no documento.
- **Linha faltando na tabela:** "recarregar a tela perde o bilhete" (`:171`) está no `[E]` da linha 133 e tem teste, mas não tem linha na tabela da tarefa. Acrescente.
- **Chamada sem bloco:** `EntrarNaEscola.tsx:113`, a chamada com `slug`, não tem bloco. Ela não é condição, e o `entrarComAProvisoria` do e2e a derrubaria. Um bloco trocando `slug` por `undefined`, apontado para `provisória → troca → entra`, deixaria isso registrado.
- **Duplo clique no e2e:** um caso de duplo clique em "Criar a senha e entrar", como o precedente "clique repetido em Entrar", fecharia o caso no navegador. Hoje ele só está no componente.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-09 14:15:08 · `tasks/prd-acesso-e-convites/13_task.md`

VEREDITO: APROVADO
Tela vista: sim (4 fotos lidas: computador e celular, escola cheia e vazia). Não abri o `.tsx` nesta rodada, porque a rodada 1 já o aprovou e ele não mudou. Revisei o diff da rodada 2.
Estados: ok. Com dado, a lista de provisórias de antes aparece com data, hora e "usada" ou "não usada". Vazio mostra "É a primeira vez que você troca a senha.", que diz o que está acontecendo e não pede desculpa. Carregando, erro e bilhete vencido ficam com o e2e e o teste de componente, e eu não os vi na foto.
Acessibilidade: ok pelas fotos. O campo tem rótulo visível com "(obrigatório)" e a dica de 12 caracteres. O foco aparece em azul no campo. O botão "Mostrar" é um controle à parte. O texto tem contraste bom. O e2e confere o alvo mínimo de 24 px.
Chromebook fraco: sem achado. A tela é um formulário curto e a lista é de poucas linhas, então não precisa de virtualização. Não há upload de imagem.
Celular: sem rolagem horizontal e sem corte a 360 px. O botão principal "Criar a senha e entrar" tem cerca de 44 px de altura e ocupa a largura toda. "Mostrar" e "Voltar à entrada" passam de 24 px. Nada depende de hover. A página mede 862 px na cheia e 800 px na vazia, e rola na vertical, o que é normal no celular.
Ação oficial protegida: sim. A ação é criar a própria senha, não nota nem publicação. O botão fica desabilitado enquanto o pedido está em andamento, e o e2e novo prova que vai uma troca só. A foto não mostra nenhuma ação oficial sobre terceiros nem saída de IA.

Bloqueantes: nenhum. As correções exigidas na rodada anterior eram nenhuma, e o diff desta rodada não mexe em tela.
- O diff é o renome `caminhoDaEtapaDaEntradaPorMatricula` para `caminhoDaEtapaDaEntrada` em `paths.ts`, `ReauthDialog.tsx`, `EntrarNaEscola.tsx` e `paths.test.ts`. Procurei o nome antigo no código, no e2e, nos docs e nas tasks. Só sobrou no histórico `tasks/prd-acesso-e-convites/achados/13_task.md`, o que é aceitável.
- O resto do diff é ajuste de teste (a asserção de `window.location.href` saiu do componente e ficou no e2e), o e2e de clique repetido e uma guarda no `e2e/support/seed.ts`. Nada disso muda o que o usuário vê.
- A página cheia rola a 1366 × 768 (807 px, com 39 px a mais que a janela). Procurei `1366`, `cabe` e `sem rolagem` no `prd.md` da spec e não achei nenhum RF que diga que a tela cabe. Por isso a rolagem não bloqueia. A vazia cabe em 768 px.
- A onça aparece esmaecida na foto da cheia. Isso é a animação de entrada de 240 ms, o código vale mais que a foto, e na vazia ela aparece inteira. Não é defeito.
- Não vi texto técnico, id, chave de tradução, texto em inglês, cor fora da paleta nem logotipo diferente do padrão. Datas saem como 12/11/2026 às 14:05.

Recomendações (nenhuma bloqueia):
- O `TODO.md` já registra a rolagem de 39 px na cheia a 1366 × 768, que tira "Voltar à entrada" da primeira dobra. Uma saída é compactar o espaçamento da lista.
- O `TODO.md` também já registra os dois botões "Tentar de novo" com o mesmo nome acessível, quando a lista e a troca falham juntas. Vale diferenciar o nome acessível dos dois.

## test-engineer · 2ª rodada · APROVADO · 2026-11-09 14:15:23 · `tasks/prd-acesso-e-convites/13_task.md`

VEREDITO: APROVADO

Cenários exigidos (o que esta rodada confere):
- A correção da 1ª rodada: o diálogo "Sua sessão expirou" que recebe `trocar_senha` precisa de um teste citado pelo nome, no `cenarios.md` e na tabela da 13.0. A correção podia vir pela opção (a), um e2e, ou pela (b), o caso de componente com as duas linhas na tabela.
- O que o diff novo afeta:
  - a troca de nome de `caminhoDaEtapaDaEntradaPorMatricula` para `caminhoDaEtapaDaEntrada`;
  - o bloco de mutação novo em `EntrarNaEscola.tsx`;
  - o e2e novo do clique repetido em "Criar a senha e entrar";
  - a checagem de datas acrescentada a `gerarProvisoriaNoBanco`;
  - as duas asserções tiradas de `TrocarSenhaProvisoria.test.tsx`.

Cobertos:
- **Correção 1, feita pela opção (b).**
  - Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/cenarios.md`, a frase do diálogo saiu do item `[E]` e virou um item `[U]` próprio. Ele cita `ReauthDialog.test.tsx › o aluno que digita a senha provisória…` e `paths.test.ts › sem o endereço da escola`.
  - A tabela de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/13_task.md` ganhou as duas linhas: o diálogo do aluno (componente) e o diálogo da equipe (unidade).
  - O teste citado existe em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/components/ReauthDialog.test.tsx:40`. Ele confere o resultado nas duas pontas: o último endereço do histórico é `/e/colegio-a/trocar-senha`, e o bilhete fica em memória (`bilheteDaTroca()?.valor`).
  - Os dois blocos de mutação do `ReauthDialog.tsx` (`!==` trocado por `===`, e o slug trocado por `undefined`) foram atualizados para o nome novo da função.
- **Bloco novo de `EntrarNaEscola.tsx`.** O slug trocado por `undefined` manda o aluno para `/entrar`. Com isso, `e2e/troca-da-provisoria.spec.ts › provisória → troca → entra` (linha 83, nome conferido) fica vermelho pelo motivo certo. A linha alterada tem bloco.
- **Clique repetido em "Criar a senha e entrar"** (`e2e/troca-da-provisoria.spec.ts:99`). A rota fica segurada enquanto o teste confere que o botão está desabilitado, depois abre, e o teste exige `pedidos === 1`. Se o `disabled` sair do botão, o `toBeDisabled()` falha. A linha correspondente está na tabela.
- **Asserções retiradas de `TrocarSenhaProvisoria.test.tsx`.**
  - `document.body.textContent` nunca contém o valor de um `<input>`, então essa asserção passava sempre. Tirá-la limpa o teste.
  - `window.location.href` no jsdom não é a localização que a tela lê (`memoryLocation`), então também não provava nada. A URL continua provada no e2e do bilhete.
- **`gerarProvisoriaNoBanco`.** As datas de `DE_ANTES` (`2026-11-10T15:30` e `2026-11-12T17:05`) estão a mais de uma hora uma da outra, e a checagem nova não as recusa.
- **Execução.** `npx vitest run` em `ReauthDialog.test.tsx`, `paths.test.ts` e `TrocarSenhaProvisoria.test.tsx` passou: 3 arquivos, 27 testes. Não há `.skip` nem teste comentado no diff.

Bloqueantes: nenhum.

Recomendações:
1. `e2e/troca-da-provisoria.spec.ts:106`: o `dispatchEvent('click')` sobre o botão já desabilitado acrescenta pouco à prova. No Chromium, um botão de formulário desabilitado não dispara o envio, então o `pedidos === 1` só repete o que o `toBeDisabled()` já prova. Se a intenção é provar que um segundo pedido não sai, uma trava no envio que não dependa do `disabled` seria derrubável por mutação própria. Não bloqueia: o título e a tabela dizem "com o pedido em andamento, o botão fica desabilitado", e isso está provado.
2. A tabela da 13.0 cita `ReauthDialog.test.tsx › o aluno que digita a senha provisória…` com reticências. O nome inteiro ajudaria a busca: "o aluno que digita a senha provisória vai para a troca na escola dele, e o bilhete fica na memória".

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-09 14:15:23 · `tasks/prd-acesso-e-convites/13_task.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. A tela só mostra as provisórias de antes: o papel de quem gerou ("coordenação", "professor"), a data e o estado ("usada" ou "não usada"). Não aparecem nome, matrícula nem o bilhete.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok. O diff desta rodada não toca API nem a decisão de quem pode o quê. A mudança em `apps/web` é só o novo nome de `caminhoDaEtapaDaEntradaPorMatricula` para `caminhoDaEtapaDaEntrada` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/paths.ts:311`), e o comportamento não mudou. Procurei o nome antigo e não sobrou nenhuma ocorrência em `apps/web/src` nem em `e2e`. O bilhete vencido continua com uma resposta só para todos os casos.

Logs: limpos. Nenhum `console` ou `logger` nos arquivos da tarefa.

Auditoria: não se aplica a esta rodada. Não há leitura por coordenação ou rede, nem exportação, nota ou permissão.

Envio externo: nenhum.

Seed/fixture: sintético. `e2e/support/seed.ts:210-215` só acrescenta uma checagem: as datas das provisórias de antes precisam estar a mais de uma hora uma da outra. Não entra dado real.

Fotos da tela: as quatro, nos arquivos `.processo/vitrine/aluno--trocar-senha--{computador,celular}.png` e `vazia--aluno--trocar-senha--{computador,celular}.png`, estão de acordo com a regra 20. Não mostram nome, matrícula nem bilhete, e quem gerou a provisória aparece só pelo papel. O campo da senha aparece vazio.

Dois testes perderam uma asserção. Conferi os dois e nenhum enfraquece a prova:
- `apps/web/src/pages/TrocarSenhaProvisoria.test.tsx:216` saiu `document.body.textContent not.toContain(SENHA_NOVA)`. Essa asserção nunca podia falhar, porque o texto da página não inclui o que está digitado num campo. O que prova que a senha sai da tela continua no teste: `queryByLabelText(/^Senha nova/)` deve dar nulo.
- A checagem da URL saiu do teste de componente, onde o `window.location` do jsdom não é o endereço que a tela usa. Ela já está no e2e: `e2e/troca-da-provisoria.spec.ts:229-240` confere `page.url()`, o armazenamento, os cookies e a URL de cada chamada contra o bilhete, a senha nova e a provisória. Também confere que o bilhete vai só no `Authorization`.

O e2e novo do clique repetido (`e2e/troca-da-provisoria.spec.ts:99-119`) usa um aluno sintético e não vaza nada. A frase nova do `docs/interface.md:2020`, "número de ordem do bilhete nesta aba", corresponde ao código (`apps/web/src/api/troca-da-provisoria.ts:17-19`). A chave da consulta leva esse número, e o bilhete não entra nela.

Pergunta de fechamento: esta rodada não muda o que se guarda sobre o aluno nem para onde vai. A resposta continua no arquivo do titular, com `senha_provisoria.gerada` e `.usada`.

Bloqueantes: nenhum.

Recomendações:
- As recomendações da 1ª rodada continuam valendo como estão. A principal: o bilhete ainda sobrevive ao botão "voltar" do navegador. Ela já está no `TODO.md`, para o Arquiteto tratar como tarefa própria.
- `apps/web/src/pages/TrocarSenhaProvisoria.test.tsx:209`: o título do teste ainda diz "a senha digitada sai da tela". Fica mais exato dizer "o campo da senha sai da tela", porque é isso que a asserção que restou prova.

## infra-guardian · 2ª rodada · APROVADO · 2026-11-09 14:15:35 · `tasks/prd-acesso-e-convites/13_task.md`

VEREDITO: APROVADO
Caminho quente tocado: login
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum

O diff desta rodada não muda nada no servidor. Ele renomeia `caminhoDaEtapaDaEntradaPorMatricula` para `caminhoDaEtapaDaEntrada`, e nenhuma referência ao nome antigo sobrou em `apps`, `e2e` ou `packages`. Ele também ajusta testes, acrescenta uma checagem de datas no apoio do e2e e atualiza a documentação. A rodada anterior não exigiu correções, então não havia nada a conferir.

Recomendações:
- Clique duplo: o caso novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/troca-da-provisoria.spec.ts` prova a trava da tela. O botão fica desabilitado enquanto o pedido anda (`disabled={salvando}`, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/pages/TrocarSenhaProvisoria.tsx:143`) e só uma troca sai. O que protege de verdade, se duas trocas chegarem juntas, é a provisória valer uma vez só no servidor. Isso já foi auditado na 1ª rodada e não mudou. Vale um teste de integração da API com duas chamadas a `trocar-senha` ao mesmo tempo, na tarefa da 10.0, se ainda não existir.
- Continua valendo o que ficou da 1ª rodada: registrar na Tech Spec que o cenário de carga `login às 7h30` não muda.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-09 14:15:54 · `tasks/prd-acesso-e-convites/13_task.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual", com typecheck, lint, segredo, dependências, unidade e alvo)
Bloqueantes: nenhum
Recomendações:
- **Itens para o `TODO.md` ainda não escritos.** O `TODO.md` não mudou na árvore, mas seis linhas de "Recomendações sem aplicar" em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/13_task.md` têm destino `TODO.md` (por volta das linhas 489 a 502). São estas: o botão "voltar" do navegador, o reenvio depois de a troca já estar gravada, a frase "Não reconhece alguma?", a rolagem de 39 px, a conferência do `numeroDoBilhete` e os dois "Tentar de novo". O modelo da tarefa (`.claude/skills/criar-tasks/task-template.md:178`) exige que o destino `TODO.md` seja "a linha já escrita no `TODO.md`, no commit da tarefa, e não promessa". Quem fizer o commit tem de escrever essas linhas.
- **Texto da Tech Spec, que é do Arquiteto.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/prd-acesso-e-convites/techspec.md:208` ainda diz "o número do aluno do bilhete". Na mesma frase diz que o bilhete fica "nunca no cache de consultas", e o título do e2e deixou de afirmar isso. Essa garantia agora vem só da asserção estrutural da chave em `api/troca-da-provisoria.test.ts`. Ao corrigir o texto, alinhar as duas coisas.

Conferi o diff desta rodada:
- **Novo nome da função.** `caminhoDaEtapaDaEntradaPorMatricula` virou `caminhoDaEtapaDaEntrada` em todos os pontos. O nome antigo só sobra no registro dos revisores, em `achados/13_task.md`.
- **Asserção retirada da tela de troca.** Saiu `document.body.textContent` sem a senha nova, no caso do bilhete vencido. Ela passava sempre, porque o que se digita no campo não entra no `textContent`. O que o caso afirma continua coberto pelo campo que some da tela.
- **Asserção retirada do jsdom.** Saiu `window.location.href` do teste no jsdom. Que o bilhete e a senha nova não vão para a URL continua provado no e2e, por `page.url()`.
- **Conferência de datas no `gerarProvisoriaNoBanco`.** É nova e o `DE_ANTES` atende: as duas datas estão a cerca de dois dias uma da outra.
- **Novo e2e do clique repetido.** Segue o precedente de `entrar-na-escola.spec.ts` e prova que vai uma troca só (`pedidos === 1`).
- **Novo bloco de mutação de `EntrarNaEscola.tsx`.** Aponta um caso de e2e que existe.
- **Mudança no `cenarios.md`.** O diálogo "Sua sessão expirou" saiu do [E] e virou um [U] próprio. Bate com a tabela de divergências e com o §9 da Tech Spec.

As fotos (lista cheia no computador, primeira troca no celular) mostram o que o RF13 e o `cenarios.md` descrevem, com os nomes do glossário, e nada além do que a tarefa pede.
