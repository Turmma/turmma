# Achados das revisões — `tasks/correcoes/2026-11-04-e2e-contrato-da-lista-8.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-04 03:37:16 · `tasks/correcoes/2026-11-04-e2e-contrato-da-lista-8.md`

VEREDITO: APROVADO

Tela vista: sim. Li as 6 fotos da lista da turma, no computador e no celular (2 partes), com a escola cheia (2ºB) e com a vazia (2ºA). A prévia e a gravação, que são o que a correção muda, não aparecem nas fotos. Conferi essas duas pelo código (`ListaDaTurma.tsx`, `api/lista.ts`, `ponte-da-lista.ts`) e pelo e2e que o documento diz ter rodado.

Estados: ok.
- **Carregando:** "Lendo a lista…" durante a prévia e "Gravando…" durante a gravação, com o botão desabilitado e a trava de envio único (`useSingleSubmit`, `ListaDaTurma.tsx:502`, `:563`).
- **Vazio:** convida a agir, em "Nenhum nome nesta turma ainda — Cole a lista ou envie o arquivo…" (foto vazia).
- **Com dado:** a lista de nomes com matrícula e situação aparece na foto cheia.
- **Erro:** diz o que fazer, com texto próprio em cada caso (`ListaDaTurma.tsx:446-449`).
  - `CONFLITO` vira "…Nada foi gravado: veja a prévia de novo". Na ponte, `desatualizada` vira `CONFLITO` e a tela descarta a prévia (`:388`).
  - A fila que não anda em 60 s vira `INDISPONIVEL_TENTE_DE_NOVO`. A prévia fica e "Gravar lista" tenta de novo, o que é seguro porque a gravação é idempotente.

Acessibilidade: sem regressão. Os campos têm rótulo e há `role="status"` nos avisos. A foto mostra foco e contraste normais, e nada na tela mudou nesta correção.

Chromebook fraco: a espera usa polling a cada 500 ms, por até 60 s, durante a gravação. É leve e com prazo. A lista longa não é tocada pela correção.

Celular: a 360 px não há rolagem horizontal nem texto cortado nas fotos. Os botões "Ver a prévia" e "Acrescentar um nome" parecem ter 44 px ou mais. A lista de nomes vira cartões, como a regra pede. O e2e `celular` ficou verde nos casos do documento (W1, W12, roteiro, lista 62, 519, 596 e 659). O caso `lista-da-turma.spec.ts:214` fica vermelho por desenho e foi registrado para a 13.0 no `TODO.md`.

Ação oficial protegida: sim. Gravar a lista só vale depois da prévia, que mostra nome, matrícula e resultado por linha. A ponte não grava marcas de transferência nem de desligamento, e "muda de turma" e "nome corrigido" viram "já existe", então nada oficial acontece sem a marca da coordenação. A prévia some se a API disser que envelheceu.

Bloqueantes: nenhum.

Recomendações (não bloqueiam):
1. `ListaDaTurma.tsx:446` e a ajuda ao lado do campo ("Até 200 nomes por vez", visível em todas as fotos) estão desatualizados. A 8.0 subiu o teto para 3.000 linhas e 512 KB, e a tela já aceita mais que isso. O texto não induz a erro, porque é mais restritivo que a regra real. Corrigir junto da 13.0, que o `TODO.md` já cobre com a reescrita do e2e `:214`.
2. "Choose File / No file chosen" aparece em inglês no computador e no celular. É a interface nativa do navegador na vitrine, que roda em inglês. Num Chrome em pt-BR sai "Escolher arquivo". Vale conferir `ListaDaTurma.tsx` perto do `campoDoArquivo`: `<html lang="pt-BR">` e um botão próprio que dispara o input (rotulado "Escolher arquivo") garantem o português em qualquer navegador. Não vem desta correção.
3. `ponte-da-lista.ts:125`: o laço de espera não cancela quando a pessoa sai da tela, e segue fazendo requisições por até 60 s. Um `AbortSignal` passado ao `ler` resolveria. É pouco relevante para uma ponte que sai na 13.0.
4. `ponte-da-lista.ts:44-61` repete no cliente a leitura de separador, aspas e cabeçalho do `lista-reader.ts` da API. Isso é aceitável enquanto a ponte for temporária e tiver testes de mutação. A remoção já está no `TODO.md` ("Da correção `e2e-contrato-da-lista-8`").
5. `.github/workflows/ci.yml:59-61`: o job de integração subiu de 20 para 30 min, com o comentário corrigido e o gatilho de dividir a suíte em fatias registrado (se passar de uns 25 min). Isso está certo para infra e não é assunto de interface.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/api/lista.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx`
- Fotos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/.processo/vitrine/coordenacao--coordenacao-estrutura--2ºB-fd819be7--*.png` e `vazia--coordenacao--coordenacao-estrutura--2ºA-9c906958--*.png`

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-04 03:37:27 · `tasks/correcoes/2026-11-04-e2e-contrato-da-lista-8.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta correção. A diff mexe só na lista de nomes da turma (prévia e gravação pela importação), no prazo do job de integração da esteira e no `TODO.md`. Nenhum desses caminhos chega a `Nota`, então não há autor humano a conferir.

Decisão autônoma sobre aluno: ausente.
- A ponte transforma "muda de turma" e "nome corrigido" em "já existe" e grava sem `marcas` (`apps/web/src/areas/coordenacao/estrutura/api/lista.ts:381`, corpo `{ texto }`).
- Ela transfere menos que antes e nunca mais, porque a transferência continua dependendo da marca da coordenação no serviço (`apps/api/src/estrutura/importacao/importacao.service.ts:34`).
- Nenhuma IA entra no fluxo.

Aprovação registrada: ok. Nenhuma saída de IA passa pelo fluxo alterado.

Supervisão do tutor: ok. O tutor não é tocado.

Autonomia declarada e visível: sim. Nenhum agente foi alterado.

Bloqueantes: nenhum.

Fotos da tela (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/.processo/vitrine/`, turma 2ºB da escola cheia e 2ºA da vazia, no computador e no celular):
- Mostram a página "Subir a lista de nomes", os professores da turma e os pedidos de nome.
- Nenhuma saída de IA aparece sem rótulo.
- Não há nota, conceito nem sugestão de nota.
- Não há indicador de professor nem ranking.
- Nada leva a usar mais.
- O aviso de que cada consulta aos pedidos fica registrada na auditoria está visível. Isso conta a favor da transparência.

Recomendações (nenhuma é da regra 70; ficam para a validação):
- O texto da tela ainda diz "Até 200 nomes por vez" (fotos `...2ºB-fd819be7--computador.png` e `...--celular-1.png`), mas o limite agora é o da planilha, 3.000 linhas. O próprio documento já registra que a tela não recusa mais 202 linhas, e o `TODO.md` manda reescrever o e2e `lista-da-turma.spec.ts:214` na 13.0. Vale pôr na mesma linha do `TODO.md` a troca desse texto, para a 13.0 não esquecer. Quem confere isso é o `frontend-reviewer` ou o `revisor-geral`.
- Quando a ponte for apagada na 13.0 e a tela nova mostrar "muda de turma" com a marca da coordenação, peça a auditoria da regra 70 nessa tarefa. A transferência de aluno fica perto da trajetória do aluno, e a decisão precisa continuar sendo humana e marcada pela coordenação. O pendente da 9.0 sobre o tutor da turma antiga já está no `TODO.md`.

Arquivos lidos:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/api/lista.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.test.tsx`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/tasks/correcoes/2026-11-04-e2e-contrato-da-lista-8.md`

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-04 03:37:40 · `tasks/correcoes/2026-11-04-e2e-contrato-da-lista-8.md`

VEREDITO: APROVADO

**Campos pessoais tocados:** nenhum campo novo. A correção só mexe no cliente web. A ponte (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts`) pega o nome e a matrícula do próprio texto que a coordenação colou e cola cada um na linha certa da prévia. Esses dados ficam só na memória do navegador. Não voltam ao servidor, não vão para localStorage e não chegam a log nenhum. A ponte não usa os `candidatos` (rótulo com nome e matrícula, contrato da 8.0, já auditado), então a tela não mostra nada além do que já mostrava.

**Fora da tabela de dados do docs/lgpd.md:** nada. Não há migration nem campo novo.

**Autorização por objeto:** ok.
- `GET /v1/importacoes/:id` já existia (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/api/src/estrutura/importacao/importacao.controller.ts:55`). Ele pede `importacao_planilha:ler`, filtra pela escola no repository e responde 404 tanto para id de outra escola quanto para id que não existe (`importacao.service.ts:38-42`).
- A resposta é só `estado`, `erro` (de uma lista fechada) e `resumo`. O esquema (`importacaoSchema`) só aceita chaves de contagem, então nome, matrícula ou e-mail não cabem nela.
- A ponte consulta essa rota a cada 500 ms por até 60 s. Ler esse resultado não precisa de auditoria, porque são só números e não dado de aluno.

**Logs:** limpos. Não há `console` nem envio de erro com conteúdo em `ponte-da-lista.ts`, `api/lista.ts` ou `ListaDaTurma.tsx`. O erro que a ponte lança é um `ApiError` com o código e mais nada.

**Auditoria:** presente. A gravação continua registrada no servidor (`planilha.gravada`, 8.0), e esta correção não mexe no servidor. Não há exportação, nota, permissão nem saída de IA envolvida.

**Envio externo:** nenhum. Não há IA nem terceiro.

**Seed/fixture:** sintético. Os nomes são "Ana Sintética", "Bia Sintética", "Caio Sintético" e "Ana Souza 2026001", com matrículas inventadas e UUIDs fixos.

**Fotos da tela:** as seis fotos (`.processo/vitrine/coordenacao--coordenacao-estrutura--2ºB-fd819be7--{computador,celular-1,celular-2}.png` e `vazia--…2ºA-9c906958--…`) mostram a coordenação vendo nome e matrícula só da turma da própria escola, e todos os dados são sintéticos ("Aluna Sintética Bia Vitrine", 90000001). Isso já era assim antes e vem da tela da A1. Nenhuma foto mostra outra escola, conteúdo de conversa ou dado proibido para aluno. "Pedidos de nome" continua só sob clique, e o aviso de auditoria está visível.

**Pergunta de fechamento:** responde. A correção não guarda nada novo e não envia nada para lugar novo. O que existe sobre o aluno e o rastro da importação continuam no caminho da 8.0.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Se a ponte separar o texto de um jeito diferente do `lista-reader.ts` da API, a prévia mostra o nome de uma linha no resultado de outra. Só a própria coordenação vê isso, com os dados que ela mesma colou, então não é vazamento. Mesmo assim, vale um teste que compare a ponte e o leitor da API com os mesmos textos, até a 13.0 apagar a ponte. Hoje essa paridade só está garantida pelos casos escritos à mão em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts`.
2. Na hora de apagar a ponte (13.0, já anotado no `TODO.md`), conferir que a tela nova não volta a mostrar o `rotulo` dos `candidatos` de outra turma sem a marca da coordenação.

## revisor-geral · 1ª rodada · REPROVADO · 2026-11-04 03:38:06 · `tasks/correcoes/2026-11-04-e2e-contrato-da-lista-8.md`

VEREDITO: REPROVADO
Escopo: respeitado
Aderência à Tech Spec: divergência em `8_task.md`, linha 111 (a tela e o e2e ficariam no contrato antigo até a 13.0). A correção pôs uma ponte no cliente, e nem a `techspec.md` §4 nem o `13_task.md` falam dela. Fica como recomendação: quem pediu a ponte foi o Orquestrador, o documento da correção a explica, e o `TODO.md` registra que ela sai na 13.0.
Portão local: carimbo válido (typecheck, lint, segredo, dependências, unidade, alvo)

Bloqueantes:

1. **A prévia mostra "já está na lista" para uma linha que vai trocar o nome do aluno.**
   - **Onde:** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts:86`, onde `nome_corrigido` vira `'ja_existe'`.
   - **O que acontece:** depois da 8.0 (subtarefa 8.2), a gravação aplica o nome corrigido mesmo sem marca. Isso vale tanto para a linha da lista quanto para o aluno já aprovado. A prova está em `packages/core/src/importacao/tipos/alunos.ts:410`, onde `corrigirNomes` roda sempre dentro de `aplicar`, e o efeito aparece em `usuario.nome_corrigido` e `lista.nome_corrigido`.
   - **O que a tela da A1 faz com isso:** ela diz à coordenação que a linha "já está na lista". Grava, e o nome do aluno muda em silêncio. Na mensagem de depois, as contagens vêm só de `resumo.entram` e `resumo.ja_existem` (`ponte-da-lista.ts:140`), então os `nomes_corrigidos` do resumo somem.
   - **Por que bloqueia:** a prévia existe para mostrar o que vai ser gravado, e ela esconde uma escrita em dado de aluno.
   - **Afirmação falsa nos papéis:** o título do teste (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts:65`) e o documento da correção (`tasks/correcoes/2026-11-04-e2e-contrato-da-lista-8.md:43` e `:202`) dizem "sem a marca, nada é gravado". Isso só vale para `muda_de_turma`.
   - **Correção exigida:** a ponte não pode apresentar `nome_corrigido` como "já existe".
     - Ela deve tratar esse resultado como falha de contrato (`ApiError(ERRO_INTERNO)`), como já faz com `fora_da_planilha` e `turma_ambigua`. Assim a tela da A1 não grava uma troca de nome que ela não sabe mostrar. Outro caminho, só se o Orquestrador decidir e registrar na `techspec.md`: mostrar a troca de algum jeito.
     - Corrigir o título do teste e o texto do documento para separar os dois resultados. `muda_de_turma` sem marca de fato não grava; `nome_corrigido` grava.
     - Escrever um caso que prove o tratamento escolhido.

Recomendações:
- **Tipo redigitado:** `ponte-da-lista.ts:117` define `EstadoLido` à mão, e ele repete parte de `Importacao`. Melhor usar `Pick<Importacao, 'estado' | 'resumo'>` de `@educa/shared` (regra 00, item 6), para o cliente não se afastar do contrato sem ninguém perceber.
- **Leitor duplicado:** `ponte-da-lista.ts:16-62` é uma cópia, linha por linha, de `apps/api/src/estrutura/lista/lista-reader.ts`. É provisória, mas se o leitor da API mudar antes da 13.0, a ponte põe o nome na linha errada sem dar sinal. Ou se extrai a parte pura (`camposDa`, `normalizado` e a escolha de colunas) para `packages/shared`, ou o `TODO.md` ganha o aviso de que as duas cópias precisam andar juntas.
- **Tela desatualizada:** a foto `coordenacao--coordenacao-estrutura--2ºB-fd819be7--computador.png` (e as fotos de celular) mostra o texto de ajuda "Até 200 nomes por vez.", mas o teto desde a 8.0 é de 3.000 linhas. O texto vem de `ListaDaTurma.tsx`. Isso cabe na 13.0, junto do `e2e/lista-da-turma.spec.ts:214`. Vale citar no item do `TODO.md` que essa correção acrescentou.
- **13.0 não sabe da ponte:** acrescentar `ponte-da-lista.ts` e `api/lista.test.ts` aos arquivos previstos do `13_task.md`, e não só ao `TODO.md`. Assim quem implementar a 13.0 vê o que tem de apagar.
- **Contagem que não fecha:** depois de gravar, "N gravados · M já estavam" deixa de fora `nomes_corrigidos`, e a soma não bate com as linhas da prévia. Se o bloqueante for resolvido pela recusa, isso deixa de acontecer.

## infra-guardian · 1ª rodada · REPROVADO · 2026-11-04 03:38:25 · `tasks/correcoes/2026-11-04-e2e-contrato-da-lista-8.md`

VEREDITO: REPROVADO
Caminho quente tocado: fila (a tela da coordenação acompanha o job `estrutura.gravar-planilha`, que roda na fila `normal`)
Rate limit: ok no servidor (o limite é por usuário e por escola). O problema é o cliente da ponte, que pode gastar sozinho o limite do usuário (ver o bloqueante).
Fila e prioridade: ok
Concorrência: protegida (a gravação é idempotente no servidor, e esta correção não mexe no lado do servidor)
Índice e paginação: não se aplica (não há query nova)
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok (nada novo no servidor; o `timeout-minutes: 30` da integração tem justificativa e está no `TODO.md`)

Bloqueantes:
- **O polling da gravação esgota o limite por usuário, e isso acontece justamente com a fila cheia.** Arquivos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts:109-110` e `:125-131`.
  - **O que está errado:** a tela lê `GET /v1/importacoes/:id` a cada 500 ms por até 60 s. São até 120 leituras numa janela fixa de 60 s (`JANELA_LIMITE_SEGUNDOS = 60`, `packages/core/src/rate-limit/keys.ts:51`). O limite padrão por usuário também é 120 por minuto (`LIMITE_REQ_USUARIO_MIN=120`, `.env.example:66`). Somando o `POST /lista`, a prévia e a releitura da lista, a coordenadora passa do limite exatamente no caso para o qual o prazo de 60 s foi criado ("o prazo cobre a fila cheia"). Isso tem três efeitos:
    1. O job fica `na_fila` numa manhã de segunda e a gravação recebe 429 `LIMITE_EXCEDIDO` em vez do `INDISPONIVEL_TENTE_DE_NOVO` planejado.
    2. Toda outra requisição dessa coordenadora, em qualquer aba, é recusada até a janela virar.
    3. Cada leitura passa pela `SessaoGuard`, que lê o Postgres sem cache (regra 80, item 5, nota de 24/10). São 2 leituras por segundo por pessoa esperando.

    O 500 ms é metade do intervalo que a casa já usa para o mesmo padrão: `INTERVALO_DA_CONSULTA_DE_EXECUCAO_MS = 1000` em `packages/shared/src/time/execucao.ts:20`. A tela de material usa 1.500 ms.
  - **Correção exigida:**
    1. Usar o `INTERVALO_DA_CONSULTA_DE_EXECUCAO_MS` do `@educa/shared`, ou um recuo progressivo (por exemplo, 1 s subindo até 3 s), em vez da constante local de 500 ms. O número de leituras dentro de `PRAZO_DA_IMPORTACAO_MS` tem de ficar bem abaixo do limite por usuário. Uma referência é no máximo metade do limite, para sobrar espaço às outras requisições da mesma pessoa.
    2. Tratar `LIMITE_EXCEDIDO` recebido numa leitura do acompanhamento: esperar o `Retry-After` dentro do prazo, ou terminar em `INDISPONIVEL_TENTE_DE_NOVO`, e nunca repassar o 429 à tela.
    3. Em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts`, incluir um caso com relógio falso e importação sempre `na_fila`. Ele deve provar que o total de `GET /v1/importacoes/:id` no prazo inteiro fica abaixo do teto escolhido, e que um 429 numa leitura não chega à tela como `LIMITE_EXCEDIDO`.

Recomendações:
- **Abandono da tela:** em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts:125`, o `esperarAGravacao` não recebe `AbortSignal`. Se a pessoa sai da tela, a ponte continua consultando por até 60 s, e também com a aba escondida. Vale repassar o `signal` da mutação ao `authedGet`, como faz `execucaoQueryOptions` em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/api/execucoes.ts:31`.
- **Prazos diferentes:** o prazo do cliente é de 60 s e o do job é de 300 s (`job-definitions`). Com a planilha de 3.000 linhas, que agora cabe na tela, a coordenadora pode ver "tente de novo" enquanto o job ainda grava. Convém deixar isso registrado no `TODO.md` da 13.0, para a tela nova mostrar o estado da importação em vez de desistir.
- **Integração da esteira:** o `timeout-minutes: 30` está justificado. Vale manter na retro o gatilho já anotado no `TODO.md` (dividir a suíte em fatias se passar de uns 25 min).

## test-engineer · 1ª rodada · REPROVADO · 2026-11-04 03:39:48 · `tasks/correcoes/2026-11-04-e2e-contrato-da-lista-8.md`

VEREDITO: REPROVADO

Cenários exigidos: a prévia lida no contrato novo, com nome e matrícula tirados do texto pela linha · separador, aspas, cabeçalho, só CR e título antes, como a API lê · cada resultado e cada erro da planilha traduzidos para a tela antiga, com o que a tela promete batendo com o que o job grava · a gravação com 202 e a espera (concluída, envelhecida, falhou, prazo com relógio falso) · a matrícula que passa para outra turma entre a prévia e o "Gravar lista" (aluno transferido) · o nome corrigido na reimportação · o clique duplo e a nova tentativa depois do prazo, com outra importação já na fila · o e2e de ponta a ponta dos erros da gravação.

Cobertos: `apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts` cobre o contrato novo, a leitura do texto, os dois códigos traduzidos, o código ou resultado fora da lista virando `ERRO_INTERNO`, e os estados da importação. O prazo é provado com `vi.useFakeTimers`. A seção "Mutações" tem 23 blocos para as linhas novas, e as 2 linhas sem bloco têm motivo aceitável. Não há `.skip`, nem mock que esconda a ponte. A rede é falsa e nenhum provedor é chamado. O clique duplo já é barrado na tela (`useSingleSubmit` e `disabled={gravando}`). Rodei `lista.test.ts` e `ListaDaTurma.test.tsx`: 37 de 37 verdes.

Bloqueantes:

1. **`ponte-da-lista.ts:83-88`: a tela promete "nada muda" onde o job grava ou onde o aluno está em outra turma, e o teste prova essa promessa falsa** (`lista.test.ts:65-75`).
   - **`nome_corrigido` vira `ja_existe`.** A tela então mostra "Já está na lista desta turma, por esta matrícula: nada muda, nem o nome gravado." (`previa-da-lista.ts:23`). Só que o job corrige o nome sem marca nenhuma: `corrigirNomes` roda para toda linha `nome_corrigido` (`packages/core/src/importacao/tipos/alunos.ts:339-347`, chamado em `:410`). O nome do aluno muda depois de a coordenação ler que não mudaria, contra a regra 50, item 8. A frase do documento, "sem a marca, nada é gravado", está errada para este resultado.
   - **A mensagem do fim também erra a conta.** Ela usa só `resumo.ja_existem` e não diz quantos nomes foram corrigidos (`nomes_corrigidos`).
   - **`muda_de_turma` vira `ja_existe`.** A tela diz "já está na lista desta turma" de um aluno que está na lista de outra turma. A tela da A1 tem o código exato para este caso: `matricula_em_uso` ("…está na lista de outra turma", `previa-da-lista.ts:17`).
   - **Correção exigida:**
     - Traduzir `muda_de_turma` para `{ resultado: 'erro', erro: 'matricula_em_uso' }`.
     - Para `nome_corrigido`, a tela tem de dizer que o nome será corrigido, ou a gravação tem de ficar barrada. Nunca "nada muda".
     - Contar `nomes_corrigidos` na mensagem do fim.
     - Reescrever o teste para provar o texto verdadeiro de cada resultado.

2. **`e2e/lista-da-turma.spec.ts:214`, deixado vermelho "por desenho", para na linha 285 e esconde as duas únicas provas de ponta a ponta dos erros da gravação pela ponte.** Essas provas são a gravação recusada (`:395-411`) e o servidor fora do ar (`:423-437`).
   - **O caso não está vermelho só pelo teto, como o documento diz.** O gravar refaz a prévia no POST (`packages/core/src/importacao/motor.ts:94-105`). Por isso, a matrícula posta na outra turma em `:401` vira `muda_de_turma` no POST. A importação conclui com 0 nomes, e a tela diria "0 nomes gravados na lista." no lugar do `CONFLITO` esperado em `:404-407`.
   - **O efeito para a coordenação:** ela perde o aluno sem aviso.
   - **Correção exigida:**
     - Fazer o caso passar da linha 285: trocar a asserção do teto pelo teto atual (3.001 linhas, mais de 512 KB) ou separar o trecho do teto em outro caso.
     - Decidir e provar no e2e o que a tela mostra quando a matrícula muda de turma entre a prévia e o gravar. Com o bloqueante 1 corrigido, a prévia refeita já mostra o erro. Falta a gravação não terminar calada em "0 gravados".
     - O resto do caso (fora do ar, nome avulso, retirada, histórico) precisa voltar a rodar na esteira.

Recomendações:
- **Testar toda a tabela de erros.** `ERRO_DA_LISTA` (`ponte-da-lista.ts:67-76`) tem 8 entradas, e só 2 são provadas. Sem a entrada `matricula_repetida`, o caso comum da planilha com matrícula repetida derruba a prévia com `ERRO_INTERNO`. Vale um teste que percorra a tabela inteira, código por código.
- **A leitura do texto está duplicada.** A da ponte copia `apps/api/src/estrutura/lista/lista-reader.ts`. Uma tabela de amostras rodada nos dois lados, ou a leitura movida para `packages/shared`, impede que as duas divirjam até a 13.0.
- **O `CONFLITO` do POST engana.** Ele acontece quando a escola já tem uma importação na fila (`motor.ts:92`): outra coordenadora importando, ou a nova tentativa depois de `INDISPONIVEL_TENTE_DE_NOVO`. A tela responde com "Uma das matrículas passou a ser usada…" (`ListaDaTurma.tsx:446`). Vale um teste e um texto próprio para esse caso.
- **Texto velho.** `ListaDaTurma.tsx:439` ainda diz "não passa de 200 nomes", e o teto agora é 3.000.

## tenancy-guardian · 2ª rodada · APROVADO · 2026-11-04 04:38:36 · `tasks/correcoes/2026-11-04-e2e-contrato-da-lista-8.md`

VEREDITO: APROVADO

**Tabelas verificadas:** nenhuma. O diff desta rodada não cria nem altera migration ou schema, e nada mudou em `apps/api` nem em `packages` entre `5d201615` e `9045bc16`.

**Queries verificadas:** nenhuma query nova no servidor. Do lado do cliente, conferi as chamadas da ponte:
- `apps/web/src/areas/coordenacao/estrutura/api/lista.ts:188` só chama `POST /v1/turmas/:id/lista` e `GET /v1/importacoes/:id`. Nenhuma das duas manda `escolaId` no corpo ou na query.
- `apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts` não lê nem envia `escolaId`.
- `GET /v1/importacoes/:id` continua escopado pela sessão. Isso não mudou: `apps/api/src/estrutura/importacao/importacao.service.ts:38` diz "Id de outra escola é igual a inexistente".

**Teste de isolamento:** não se aplica a esta rodada. Não há repository, endpoint nem tabela nova. O isolamento das rotas usadas foi verificado na 1ª rodada, e essas rotas não mudaram.

**Bloqueantes:** nenhum.

Itens 5 e 7 conferidos no diff:
- **Item 5 (não revelar dado de outra escola):** a ponte agora traduz `muda_de_turma` para `matricula_em_uso`, mas isso fala de outra turma da mesma escola, então não confirma que existe dado de outra escola. A ponte também não repassa `candidatos` nem `rotulo`, então nada de outra turma chega à tela da A1.
- **Item 7 (camada rede):** nada no diff toca a camada de rede.

**Recomendações:**
- Quando a 13.0 apagar a ponte, a tela nova vai passar a mostrar `candidatos` e `rotulo`. Antes disso, alguém precisa confirmar que esses dados vêm só da escola da sessão. Hoje isso está no `TODO.md` só pelo lado do privacy-guardian; vale pedir também a auditoria de tenancy nessa tarefa.

## frontend-reviewer · 2ª rodada · APROVADO · 2026-11-04 04:38:53 · `tasks/correcoes/2026-11-04-e2e-contrato-da-lista-8.md`

VEREDITO: APROVADO

Tela vista: sim (6 fotos lidas: turma 2ºB cheia e turma 2ºA vazia, cada uma em computador, celular-1 e celular-2). O diff desta rodada não altera componente nem estilo. A tela é a mesma da rodada anterior, e as fotos só confirmam que ela segue íntegra.

Estados: ok.
- Com dado: lista de nomes (foto cheia), professores da turma, pedidos de nome.
- Vazio: "Nenhum nome nesta turma ainda", com o próximo passo ("Cole a lista ou envie o arquivo: nome; matrícula…"). Convida e não se desculpa.
- Carregando e erro, pelo código:
  - A gravação mostra "Gravando…" (`ListaDaTurma.tsx:563`) e a prévia mostra "Lendo a lista…" (`:503`).
  - Os erros `CONFLITO`, `ENTRADA_INVALIDA` e `NAO_ENCONTRADO` têm texto que diz o que fazer ("veja a prévia de novo", "Volte para Escola › Turmas") (`:445-448`).
  - A fila que não anda em 60 s vira `INDISPONIVEL_TENTE_DE_NOVO`, e "Gravar lista" fica disponível para tentar de novo.
  - O `LIMITE_EXCEDIDO` numa leitura da importação conta como "ainda na fila" e não chega à tela.

Acessibilidade: sem mudança nesta rodada. O campo "Lista colada" tem rótulo, o foco e o contraste nas fotos estão ok, e o rótulo do botão "Retirar" está legível.

Chromebook fraco:
- O polling começa em 1 s e cresce 1,5× até 3 s, por até 60 s. São umas 22 leituras em vez de 120, dentro do limite por usuário (`ponte-da-lista.ts`, bloco `ESPERA_ENTRE_LEITURAS…`).
- O e2e do teto passou a conferir o arquivo acima de 512 KB, e não mais 3.000 linhas coladas. Colar 3.002 linhas no campo leva uns 27 s. A prova das 3.000 linhas está em `lista-reader.test.ts` e em `importacao.int.test.ts`, e o `TODO.md` registra isso.

Celular: sem rolagem horizontal nem corte em 360 px, nas duas escolas. Os botões "Retirar" e "Atualizar" têm altura de toque adequada, e nada depende de hover. O passa-no-projeto `celular` está citado no documento da correção (62, 214, 543, 596 e 659, verdes nos dois projetos), mas não o reexecutei.

Ação oficial protegida: sim.
- "Muda de turma" sem a marca da coordenação vira erro `matricula_em_uso`, e nada é transferido.
- A conta da gravação que não fecha vira `CONFLITO` e manda refazer a prévia, em vez de dizer "0 nomes gravados" calado.
- A ponte não grava sozinha: a gravação continua exigindo a prévia e o clique em "Gravar lista".

Bloqueantes: nenhum.

Recomendações (nenhuma bloqueia; as quatro primeiras já têm destino na 13.0 no `TODO.md`):
1. `ponte-da-lista.ts` (`RESULTADO_DA_LISTA`, tratamento de `nome_corrigido`):
   - Hoje a prévia de uma lista reenviada com um nome corrigido de matrícula existente falha com `ERRO_INTERNO` e cai no texto genérico "Não foi possível concluir agora".
   - A mensagem sugere tentar de novo, mas isso nunca resolve, e a coordenadora fica sem caminho (item 8 da minha lista).
   - Fica como recomendação porque a tela é transitória e não tem usuário real, e porque a escolha de recusar, em vez de esconder uma escrita em dado de aluno, é a mais segura.
   - Se a 13.0 atrasar, vale um texto próprio nesse caso, no mínimo.
2. `ListaDaTurma.tsx:439` e `:476`: "Até 200 nomes por vez" está defasado. A API aceita 3.000 linhas, então o texto é conservador, mas contradiz o contrato novo.
3. `ListaDaTurma.tsx:488`: o campo de arquivo mostra "Choose File / No file chosen" nas fotos, que são de um navegador com localidade em inglês. É o controle nativo, e o `index.html` já tem `lang="pt-BR"`. Vale um botão com rótulo próprio em português na tela nova.
4. Divergência por cópia: o leitor da ponte copia `lista-reader.ts` da API. Se um mudar antes da 13.0, o nome cai na linha errada sem aviso.
5. O prazo da ponte (60 s) é menor que o do job (300 s). O `TODO.md` registra que a tela nova deve mostrar o estado da importação em vez de desistir.

Arquivos relevantes:
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/api/lista.ts`
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx`

## infra-guardian · 2ª rodada · APROVADO · 2026-11-04 04:38:56 · `tasks/correcoes/2026-11-04-e2e-contrato-da-lista-8.md`

VEREDITO: APROVADO
Caminho quente tocado: fila
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum

As três partes da correção exigida na 1ª rodada foram feitas:

1. **Intervalo do polling.** A espera em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts:287-336` começa em `INTERVALO_DA_CONSULTA_DE_EXECUCAO_MS` (1 s) e cresce 1,5 vez a cada leitura até 3 s. Nos 60 s do prazo isso dá umas 22 leituras. Somadas ao POST, à prévia e à releitura da lista, ficam abaixo de 30, menos da metade do limite de 120 por minuto.
2. **O 429 numa leitura.** O `lerSemOLimite` (`ponte-da-lista.ts:304-311`) trata o `LIMITE_EXCEDIDO` como "ainda na fila". Passado o prazo, termina em `INDISPONIVEL_TENTE_DE_NOVO`, e a tela não recebe o 429. Conferi em `apps/web/src/api/client.ts:48` que o status 429 sem corpo vira `LIMITE_EXCEDIDO`, então o caminho funciona também sem o envelope de erro.
3. **Testes.** `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts:175-215` tem três casos novos:
   - relógio falso com a importação sempre `na_fila`, contando de 11 a 30 leituras GET no prazo inteiro;
   - 429 em toda leitura, terminando em `INDISPONIVEL_TENTE_DE_NOVO`;
   - um 429 e depois a importação concluída, e a gravação conclui.
   
   As mutações que tiram o crescimento da espera e o tratamento do 429 têm bloco. Rodei o arquivo: 17 de 17 verdes.

Conferi também o efeito na carga da conta nova de `contagemDaGravacao` (`ponte-da-lista.ts:348-352`), que devolve `CONFLITO`. Ela não gera regravação em laço por engano, porque `podeGravar` (`previa-da-lista.ts:73-82`) só libera a gravação sem nenhuma linha com erro. Assim, todas as linhas de aluno do texto entram na conta.

Recomendações:
- Usar o `Retry-After` do 429 (`esperaSegundos` do `ApiError`) como piso da próxima espera, em vez de seguir com a espera de até 3 s. Hoje a coordenadora continua mandando uma leitura a cada 3 s enquanto está segurada. Pode ir para a 13.0, junto do item 6 do `TODO.md`.
- O `AbortSignal` no polling continua pendente e está registrado no `TODO.md` para a 13.0. `authedGet` já aceita um sinal (`apps/web/src/api/sessao.ts:519`), então a mudança na ponte é pequena se for antecipada.

## privacy-guardian · 2ª rodada · APROVADO · 2026-11-04 04:39:06 · `tasks/correcoes/2026-11-04-e2e-contrato-da-lista-8.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. A ponte só lê nome e matrícula do texto que a própria coordenadora colou e devolve o resultado para a tela, sem guardar nada. Nesta rodada não houve migration, esquema novo nem campo novo na API.

Fora da tabela de dados do docs/lgpd.md: nenhum

Autorização por objeto: ok. Nenhuma rota nova. A ponte chama `POST /v1/turmas/:id/lista` e `GET /v1/importacoes/:id`, que já existem e já têm escopo. Uma `muda_de_turma` agora aparece como o erro `matricula_em_uso`. Isso mostra à coordenadora apenas que a matrícula já é usada na própria escola, informação que a tela da A1 já dava. Não diz de qual turma ela é, nem nada de outra escola.

Logs: limpos. Não há `console`, `logger` nem gravação no armazenamento do navegador em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts`, `api/lista.ts` e `api/lista.test.ts`. O e2e continua conferindo que nome e matrícula não vão para o armazenamento do navegador nem para o endereço.

Auditoria: presente. Esta rodada não cria leitura nova de dado de aluno nem exportação. A gravação já passava pela importação, que é auditada desde a 8.0.

Envio externo: nenhum

Seed/fixture: sintético. Os nomes "Ana", "Bia", "Aluno antigo <marca>" e as matrículas 6600xx são inventados, e o CPF `123.456.789-09` é o de teste clássico. As fotos mostram "Colégio sintético da vitrine", "Aluna Sintética Bia Vitrine" e matrículas 9000000x.

Fotos: coordenação na lista da própria turma (`...--2ºB-fd819be7--celular-1.png`), com nome e matrícula. É o papel que monta a lista (A1, RF4), e esta rodada não muda essa tela. Na escola vazia não aparece dado de aluno.

Conferência do que mudou desde a 1ª rodada, pelo olhar da regra 20:
- `nome_corrigido` deixou de aparecer como "já existe" e passou a dar falha de contrato (`ponte-da-lista.ts`, a tabela `RESULTADO_DA_LISTA`). Antes, a ponte escondia uma escrita em dado de aluno atrás de "nada muda". Agora isso não acontece mais, o que melhora a transparência para a controladora. Há teste e mutação que provam.
- Quando a gravação deixa linhas de fora, a conta não fecha e a ponte devolve `CONFLITO`, em vez de dizer "0 gravados" sem avisar. Não envolve dado pessoal.
- O 429 tratado como "ainda na fila" e a espera que cresce a cada leitura não expõem dado nenhum. O erro que chega à tela continua curto e tipado (`INDISPONIVEL_TENTE_DE_NOVO`).
- O e2e só mudou de lugar o trecho que prova a coluna que parece CPF (agora no fim do caso 62). A prova de que aluno não tem CPF continua lá.

Bloqueantes: nenhum

Recomendações:
- O `TODO.md` (item 6) já guarda para a 13.0 o risco de as duas cópias do leitor saírem de sincronia, com a ponte pondo nome na linha errada, e a conferência do `rotulo` dos `candidatos` de outra turma. É preciso garantir que o Arquiteto inclua `ponte-da-lista.ts` nos arquivos previstos do `13_task.md`. Sem isso, a cópia do leitor pode sobreviver à tela nova.
- O texto "Até 200 nomes por vez", que aparece em todas as fotos, está desatualizado. Não é questão de privacidade e já está no `TODO.md`.

## conformidade-reviewer · 2ª rodada · APROVADO · 2026-11-04 04:39:10 · `tasks/correcoes/2026-11-04-e2e-contrato-da-lista-8.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta rodada. O diff mexe só na ponte da importação da lista da turma (nome e matrícula), no teste dela, no e2e da lista, no `TODO.md` e no documento da correção. Ninguém lê nem grava `Nota`, `Correcao` ou `lancadaPor`. Todos com autor humano? sim, porque não há escrita.

Decisão autônoma sobre aluno: ausente. Uma matrícula que já está em outra turma (`muda_de_turma`) agora aparece como o erro `matricula_em_uso` e não é gravada (`ponte-da-lista.ts:113`). Antes ela aparecia como "já existe". Sem a marca da coordenação nada é transferido, e a transferência continua sendo ato humano da coordenação. Quando a gravação não fecha a conta das linhas, o resultado é `CONFLITO` e a prévia tem de ser refeita (`contagemDaGravacao`). A tela não fica calada.

Aprovação registrada: ok. Não há saída de IA nesta rodada. Agentes e prompts não aparecem no diff, e a exceção do tutor (D47) não é usada.

Supervisão do tutor: ok. O tutor não é tocado.

Autonomia declarada e visível: sim, sem mudança. O diff não toca a governança nem a declaração de autonomia.

Itens 6 a 9: o diff não toca auditoria de IA, sinal sobre aluno, discursiva ou redação, nem indicador de professor. `docs/regulacao.md` também não mudou.

Fotos da tela (escola cheia e vazia, no computador e no celular). A tela da turma na Estrutura não mostra saída de IA, nota, conceito nem sugestão de nota. Também não tem nada que induza uso ou dificulte sair: "Sair" fica visível nas duas larguras. "Pedidos de nome" diz que cada consulta fica registrada na auditoria e só lê a lista quando a pessoa clica em Atualizar. É decisão humana, coerente com a D4. Nenhuma das fotos rola a 1366 × 768.

Bloqueantes: nenhum.

Recomendações:
- O texto "Até 200 nomes por vez" aparece nas fotos de computador e de celular (`coordenacao--coordenacao-estrutura--2ºB-fd819be7--computador.png`, `...--celular-1.png`, e as mesmas na escola vazia; produzido em `apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx:439` e `:476`). O teto agora é de 3.000 linhas. Não é regra 70, e já tem destino na 13.0 pelo `TODO.md`.
- Quando a 13.0 apagar a ponte, o `TODO.md` já pede a auditoria da regra 70 nessa tarefa. Mantenho o pedido: a tela nova vai mostrar `nome_corrigido` e `muda_de_turma` por extenso, e é preciso conferir que a mudança de turma continua só com a marca humana da coordenação. Nada pode ser aplicado sozinho.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/api/lista.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/e2e/lista-da-turma.spec.ts

## revisor-geral · 2ª rodada · APROVADO · 2026-11-04 04:39:33 · `tasks/correcoes/2026-11-04-e2e-contrato-da-lista-8.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

A correção exigida na 1ª rodada foi feita:
- A ponte não tem mais a entrada `nome_corrigido` na tabela de resultados. A linha com esse resultado cai em `ERRO_INTERNO` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts:117-118`), do mesmo jeito que `fora_da_planilha` e `turma_ambigua`.
- Um caso novo prova esse tratamento (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts:78`), e a seção "Mutações" tem um bloco que mata a volta de `nome_corrigido: 'ja_existe'`.
- O título que dizia "sem a marca, nada é gravado" saiu. O documento agora separa os dois resultados: `muda_de_turma` sem a marca não grava e vira `matricula_em_uso`; `nome_corrigido` grava, e a tela o recusa.
- Os `nomes_corrigidos` do resumo agora contam entre os gravados.

O resto do diff atende aos bloqueantes do infra-guardian e do test-engineer: a espera entre leituras cresce de 1 s até 3 s, o `LIMITE_EXCEDIDO` não chega à tela, a soma do resumo é conferida com as linhas de aluno do texto, e o caso 214 do e2e volta a rodar até o fim. Nenhuma tarefa futura foi adiantada. O trecho tirado do e2e (`'/'` → Painel → Voltar) continua provado em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/pages/Inicio.test.tsx:104`. As fotos mostram a mesma tela da 1ª rodada, porque esta correção não muda o que aparece.

Recomendações:
- **"Nada foi gravado" pode ser falso.** Em `ponte-da-lista.ts:187-191`, quando a soma não fecha (uma matrícula passou para outra turma entre a prévia e o POST), a ponte lança `CONFLITO`. A tela então mostra "…Nada foi gravado: veja a prévia de novo" (`ListaDaTurma.tsx:446`). Com mais de uma linha, porém, o job já gravou as linhas `entra`, porque o POST refaz a prévia e a linha `muda_de_turma` sem marca não vira erro. Os nomes gravados estavam na prévia que a coordenação viu, então nenhuma escrita fica escondida. Só a frase é falsa. Vale registrar no item da 13.0 do `TODO.md` que a tela nova diga o que entrou e o que ficou de fora, ou cobrir esse caso com mais de uma linha.
- **O erro do nome corrigido não diz o que fazer.** A prévia com uma única linha `nome_corrigido` falha inteira com a mensagem genérica de erro interno, e a coordenadora não fica sabendo que basta escrever o nome como já está gravado. Fica aceito até a 13.0 (o `TODO.md` já registra que a tela nova mostra `nome_corrigido`). Vale conferir se a 13.0 cobre esse caso.
- **Recomendações da 1ª rodada.** O texto "Até 200 nomes por vez" ainda aparece nas fotos (computador e celular). O leitor de texto continua duplicado em relação a `lista-reader.ts`. Os dois já estão encaminhados no `TODO.md` para a 13.0, sem pendência nova.

## test-engineer · 2ª rodada · REPROVADO · 2026-11-04 04:39:38 · `tasks/correcoes/2026-11-04-e2e-contrato-da-lista-8.md`

VEREDITO: REPROVADO

Cenários exigidos:
1. Na prévia, `muda_de_turma` sem a marca vira o erro `matricula_em_uso`, e não "já existe".
2. Na prévia, `nome_corrigido` nunca aparece como "nada muda": ou a tela diz que o nome será corrigido, ou a gravação fica barrada.
3. A conta do fim inclui `nomes_corrigidos`.
4. O e2e `lista-da-turma.spec.ts:269` (antigo 214) passa da asserção do teto e volta a provar a gravação recusada, o servidor fora do ar, o nome avulso, a retirada e o histórico.
5. Matrícula que muda de turma entre a prévia e o gravar não termina em "0 gravados" calado.
6. Para o que entrou nesta rodada: a espera entre as leituras cresce, e o 429 numa leitura não chega à tela.

Cobertos:
- **Correção 1, `muda_de_turma`:** feita. O teste `a matrícula que muda de turma sem a marca vira o erro "em uso"…` (`api/lista.test.ts:66`) tem mutação que volta a linha a `ja_existe`.
- **Correção 1, `nome_corrigido`:** feita pela segunda saída que a correção permitia. A prévia recusa com `ERRO_INTERNO` e a gravação fica barrada. Teste em `api/lista.test.ts:83`, com mutação que devolve a linha à tabela.
- **Correção 1, conta do fim:** feita. Os nomes corrigidos contam entre os gravados, e as transferências entre as linhas atendidas (`api/lista.test.ts:101`). Uma mutação cobre cada parcela.
- **Correção 1, tabela `ERRO_DA_LISTA`:** testada inteira (`api/lista.test.ts:90`). A recomendação da 1ª rodada ficou aplicada.
- **Correção 2:** feita. O caso agora confere o arquivo acima de 512 KB. Com uma linha só, a matrícula posta na outra turma em `:410` vira `CONFLITO` pela conta que não fecha, e o texto em `:413-416` é verdadeiro. O resto do caso volta a rodar: fora do ar (`:432-446`), avulso, retirada e histórico. O trecho do `'/'` para o Painel e o Voltar saiu do e2e. A prova dele existe em `apps/web/src/pages/Inicio.test.tsx:104`.
- **Espera e 429:** a espera que cresce é provada com relógio falso, com contagem fechada de leituras. Isso também pega a retirada do teto de 3 s, porque sem ele o teste passa a esperar para sempre. O 429 virando indisponibilidade depois do prazo e o 429 seguido de conclusão têm teste, e há mutação no `LIMITE_EXCEDIDO`.
- **Verificação:** rodei `npx vitest run` em `api/lista.test.ts` e `ListaDaTurma.test.tsx`: 43 de 43 verdes. Não há `.skip` nem mock que esconda a regra, e não há provedor de IA no caminho.

Bloqueantes:
1. **`apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts:189`, o teste `api/lista.test.ts:109-117` e o texto em `ListaDaTurma.tsx:446`: a tela diz "Nada foi gravado" quando parte da lista foi gravada.**
   - Este bloqueante é da mesma classe do bloqueante 1 da 1ª rodada.
   - O gravar refaz a prévia no POST (`motor.ts:95-96`). A linha que virou `muda_de_turma` não é erro, então o job roda e grava as linhas `entra` e `nome_corrigido`. Só a transferida fica de fora, sem marca (`alunos.ts:355-358`, `:410-411`).
   - A ponte devolve `CONFLITO` sempre que a conta não fecha, e para `CONFLITO` a tela diz "Uma das matrículas passou a ser usada em outra turma ou por um aluno depois da prévia. **Nada foi gravado**: veja a prévia de novo."
   - O primeiro caso do teste `:116` (duas linhas, `entram: 1`) prova exatamente essa mensagem falsa: um nome foi escrito na lista e a coordenação lê que nada foi.
   - O e2e só cobre o caso de uma linha, em que a frase é verdadeira, e por isso não vê o defeito.
   - Correção exigida:
     - A gravação parcial não pode terminar em "Nada foi gravado". Uma saída: trocar o texto do `CONFLITO` da gravação (`ListaDaTurma.tsx:446`) por um que seja verdadeiro nos dois casos, por exemplo "…depois da prévia, e essa linha não foi gravada: veja a prévia de novo.", e ajustar `e2e/lista-da-turma.spec.ts:414` junto. Outra: distinguir na ponte o caso com `entram + corrigidos > 0`.
     - Reescrever o caso `:109` para provar o texto que a tela mostra em cada um dos dois casos, com uma linha e com gravação parcial, e não só o código `CONFLITO`.

Recomendações:
- O `nome_corrigido` barrado como `ERRO_INTERNO` dá à coordenadora uma mensagem genérica de erro, e tentar de novo não resolve. Na reimportação, que é justamente o que a 8.0 trouxe, um acento corrigido trava a lista inteira até a 13.0. Isso fica registrado para a validação e para a 13.0. Também falta um teste de tela que mostre o texto que aparece nesse caso.
- `ESPERA_ENTRE_LEITURAS_DA_IMPORTACAO_MS` não tem mutação que a pegue: com 500 ms no lugar de 1 s, a contagem continua dentro de 10 a 30. Um limite mais justo, ou a conferência da primeira espera, fecharia isso.
- O caso 269 leva 43,3 s no celular contra os 45 s da metade do prazo, com 4% de folga. No runner, que leva perto do dobro, chega a uns 87 de 90 s. Vale entrar no lote de e2e perto do prazo, ou a 13.0 o encurtar quando reescrever o caso.

## revisor-geral · 3ª rodada · APROVADO · 2026-11-04 04:58:10 · `tasks/correcoes/2026-11-04-e2e-contrato-da-lista-8.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)
Bloqueantes: nenhum

A rodada pedia uma correção, a do `test-engineer`, e ela foi feita:
- **O texto.** O `CONFLITO` da gravação (`apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx:446`) não diz mais "Nada foi gravado". Diz que a linha não foi gravada e aponta a lista. A frase é verdadeira nos três casos: gravação parcial, gravação que não gravou nada e prévia `desatualizada`. Ela bate com o `onError` (`:387-390`), que relê os nomes e descarta a prévia.
- **O teste da tela.** O `it.each` novo (`ListaDaTurma.test.tsx:502-565`) cobre os três casos. Confere o texto inteiro, a lista relida (na parcial, "Ana Souza" aparece), o "Gravar lista" que sai e o campo que guarda o texto. As três mutações declaradas no documento (texto, `recarregarNomes`, `definirPrevia`) são pegas por ele.
- **O e2e.** `e2e/lista-da-turma.spec.ts:414` acompanha o texto novo. Não sobrou "Nada foi gravado" ligado a esse `CONFLITO` no código.
- **O teste novo da espera.** O de 1 s e depois 1,5 s (`api/lista.test.ts`) prova o que o documento já declarava. Não invade escopo.
- **Documento e `TODO.md`.** O documento da correção foi atualizado (descrição, Mutações, Recomendações sem aplicar). As recomendações da 2ª rodada foram para o item da 13.0 no `TODO.md`. Nada ficou só no documento da tarefa.
- **Fotos.** Estado inicial igual ao da rodada anterior, na escola cheia e na vazia, no computador e no celular. A correção não mexe no estado inicial.

Recomendações:
- **`ListaDaTurma.tsx:446`, prévia envelhecida.** Na prévia `desatualizada` (`ponte-da-lista.ts:196`), o motivo pode ser outra pessoa ter mexido na lista, e não uma matrícula que mudou de turma. A primeira oração continua afirmando uma causa que talvez não seja a real. Isso já existia antes; vai para a 13.0, junto com o texto próprio do `CONFLITO` do POST com outra importação na fila.
- **`ListaDaTurma.tsx:446`, mais de uma linha.** O texto diz "Uma das matrículas… essa linha" quando mais de uma linha pode ter ficado de fora. A tela nova da 13.0 deveria dizer quantas linhas entraram e quantas ficaram de fora.

## infra-guardian · 3ª rodada · APROVADO · 2026-11-04 04:58:11 · `tasks/correcoes/2026-11-04-e2e-contrato-da-lista-8.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum. A mudança é só o texto do `CONFLITO` na tela da coordenação e mais testes. Nenhuma rota, fila, migration ou chamada de IA nova.
Rate limit: ok. O espaçamento entre as leituras de `GET /v1/importacoes/:id` não mudou: começa em 1 s, cresce 1,5 vez até 3 s e para em 60 s. Agora há um teste para ele (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/api/lista.test.ts`, "a primeira espera é de 1 s e a seguinte, de 1,5 s"). Ele roda com relógio falso e prova o padrão sem a opção `esperaMs`. O caso vizinho continua limitando o total de leituras.
Fila e prioridade: ok. Nada mudou do lado do servidor.
Concorrência: protegida. Quando a gravação falha, `onError` (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx:387-390`) relê a lista uma vez só, invalidando a consulta. Não há repetição em laço nem trabalho a mais no servidor.
Índice e paginação: ok. Não há query nova.
Degradação de IA: não se aplica.
Migration: não se aplica.
Métrica e alerta: ok. Nada novo no caminho quente.
Bloqueantes: nenhum. O bloqueante do `test-engineer` na 2ª rodada era a tela dizer "Nada foi gravado" mesmo com parte da lista já gravada. Está resolvido em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx:446`. O `it.each` novo de `ListaDaTurma.test.tsx` cobre três casos: gravação parcial, nada gravado e prévia que envelheceu. Em cada um ele confere o texto inteiro do aviso, a lista relida, a saída do "Gravar lista" e o texto que fica no campo. O e2e foi alinhado ao texto novo.
Recomendações: nenhuma nova. As da 2ª rodada (o `Retry-After` do 429 como piso da espera e o `AbortSignal` na consulta repetida) estão registradas no `TODO.md`, item "Da 13.0".

## frontend-reviewer · 3ª rodada · APROVADO · 2026-11-04 04:58:15 · `tasks/correcoes/2026-11-04-e2e-contrato-da-lista-8.md`

VEREDITO: APROVADO
Tela vista: sim (6 fotos lidas: computador, celular-1 e celular-2, com a escola cheia e com a vazia). O texto novo do `CONFLITO` só aparece depois de gravar uma lista que deixa uma linha de fora. Nenhuma foto mostra esse estado, então conferi o texto pelo código e pelos testes.
Estados: ok. Vazio: "Nenhum nome nesta turma ainda", com o próximo passo ("Cole a lista ou envie o arquivo…"). Com dado: três nomes. Carregando e erro conferi só pelo código: `ListaDaTurma.tsx` trata `falhaDaGravacao`, e a espera pela importação tem fim em `INDISPONIVEL_TENTE_DE_NOVO`.
Acessibilidade: ok. Rótulo "Lista colada" ligado ao campo por `htmlFor`. O alerta de falha leva `role="alert"` e recebe o foco (e2e, `toBeFocused`). O "Gravar lista" é recusado quando a falha invalida a prévia, e o campo mantém o texto digitado.
Chromebook fraco: a correção não mexe em lista nem em upload. A espera pela importação vai de 1 s a 3 s, em ritmo crescente, e agora tem teste que prova os 1 s e os 1,5 s. Isso evita martelar a rede da escola.
Celular: sem rolagem horizontal nem corte a 360 px. Os botões "Ver a prévia", "Acrescentar um nome" e "Retirar" têm altura de toque confortável.
Ação oficial protegida: sim. A gravação passa pela prévia, e a prévia que envelheceu sai da tela depois de uma falha.

**O que o diff muda e por que fecha o bloqueante do `test-engineer`**
- **Texto novo:** `ListaDaTurma.tsx:446` (`[ErrorCode.CONFLITO]`) deixa de dizer "Nada foi gravado". Passa a dizer: "…depois da prévia, e essa linha não foi gravada. A lista de nomes da turma mostra o que entrou: veja a prévia de novo." Está em português, diz o que aconteceu, onde conferir e o que fazer.
- **Verdade do texto:** vale na gravação parcial, na que não gravou nada e na prévia `desatualizada`. As outras duas falhas ainda dizem "Nada foi gravado" e continuam certas, porque `ENTRADA_INVALIDA` e `NAO_ENCONTRADO` vêm da recusa do POST, antes de existir job.
- **Teste de tela:** o `it.each` novo em `ListaDaTurma.test.tsx` cobre parcial, nada e `envelheceu`. Confere o texto inteiro, a lista relida (com a linha gravada aparecendo no caso parcial), a prévia que sai com o "Gravar lista" e o campo que mantém o texto. O documento traz mutações para cada um desses pontos.
- **e2e:** o texto do e2e (`e2e/lista-da-turma.spec.ts:414`) bate com o da tela.
- **Outros arquivos do diff:** o `TODO.md` e o documento da correção não afetam a tela. O novo caso de espera em `api/lista.test.ts` é puro teste.

Bloqueantes: nenhum.

Recomendações:
- A foto mostra "Choose File / No file chosen" em inglês. É o botão nativo do navegador da vitrine, que roda em en-US. Num navegador em português aparece em português. A linha já está recusada na tabela do documento. Mesmo assim, a 13.0 deveria trocar o campo por um botão próprio, "Escolher arquivo", para a tela não depender da língua do navegador.
- "Até 200 nomes por vez" e o leitor de CSV duplicado já estão no `TODO.md` para a 13.0. Acompanhar lá.
- O texto fala em "essa linha", no singular, mas o `CONFLITO` pode deixar mais de uma linha de fora. Vale "essa linha, ou mais de uma" ou "alguma linha" na 13.0, quando a ponte sair.
- O caso da lista paginada leva 43,3 s no celular, perto da metade do prazo. A 13.0 deve encurtá-lo.

## tenancy-guardian · 3ª rodada · APROVADO · 2026-11-04 04:58:22 · `tasks/correcoes/2026-11-04-e2e-contrato-da-lista-8.md`

VEREDITO: APROVADO

Tabelas verificadas: nenhuma. O diff desta rodada não tem migration nem schema.

Queries verificadas: nenhuma nova. A única leitura que a mudança envolve é a releitura da lista depois do erro (`recarregarNomes`, `ListaDaTurma.tsx:198`), e ela continua sendo `invalidateQueries` sobre a mesma query da turma, com o escopo dado pela sessão no servidor. O diff não toca na API, em repository, em endpoint nem no polling de `GET /v1/importacoes/:id`.

Teste de isolamento: presente e efetivo. Nada mudou nele desde a rodada 2. O diff é só de tela, texto e testes de frontend, sem nova superfície de escopo.

Bloqueantes: nenhum.
- O texto novo do `CONFLITO` (`ListaDaTurma.tsx:446`) não diz se existe dado de outra escola. A colisão de matrícula que ele descreve acontece dentro da escola da sessão, e a frase "em outra turma ou por um aluno" já estava no texto anterior. A única mudança é trocar "Nada foi gravado" por "essa linha não foi gravada".
- A árvore de trabalho só difere de `c0ffe87d` por uma linha que o hook gravou na tabela de Revisões do documento (`revisor-geral`, rodada 3). Não é código.

Recomendações:
- Fica como estava na rodada 2: quando a 13.0 apagar `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/ponte-da-lista.ts`, auditar `candidatos` e `rotulo`, que devem vir só da escola da sessão. Isso já está no `TODO.md`, item `Da 13.0`.

## privacy-guardian · 3ª rodada · APROVADO · 2026-11-04 04:58:28 · `tasks/correcoes/2026-11-04-e2e-contrato-da-lista-8.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum campo novo. O diff só troca o texto do `CONFLITO` da gravação (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx:446`) e acrescenta testes. Os dados de aluno que passam pela tela são os mesmos de antes: nome e matrícula na lista da turma, vistos pela coordenação da mesma escola.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok, porque o diff não toca rota nem consulta. O texto novo do `CONFLITO` não diz qual matrícula foi recusada, nem em que turma ou com que aluno ela está agora. Com isso, a recusa não revela a existência nem o lugar de outro registro, o mesmo que o texto anterior já garantia. A tela só manda a coordenadora reler a lista da própria turma, que o `onError` já relia (`ListaDaTurma.tsx:390`).

Logs: limpos. Nenhum `console` ou logger entrou no diff.

Auditoria: nada muda. Não há ação nova que a exija: nem exportação, nem alteração de nota ou de permissão, nem leitura nova de dado de aluno.

Envio externo: nenhum.

Seed/fixture: sintético. Os testes usam "Ana Souza", "Bia Lima" e matrículas 2026001/2026002 em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.test.tsx`. O e2e continua com "Aluno novo ${marca}" e "Chegou durante a prévia ${marca}".

Bloqueantes: nenhum.

O texto antigo ("Nada foi gravado") dizia uma coisa falsa sobre dado de aluno numa gravação parcial. Agora a tela diz que a linha não foi gravada e manda conferir a lista, que mostra o que entrou. Isso resolve o bloqueante do `test-engineer`. O `it.each` cobre os três casos (gravação parcial, nada gravado e prévia `desatualizada`) e confere o texto inteiro, a lista relida, a saída do "Gravar lista" e o texto que fica no campo. Os blocos de mutação novos do documento correspondem a esses testes.

Recomendações:
- Fica valendo o que as rodadas anteriores já mandaram para o `TODO.md`, no item "Da 13.0": ao apagar a ponte, incluir `ponte-da-lista.ts` e `api/lista.test.ts` nos arquivos previstos do `13_task.md` e pedir a auditoria de tenancy de `candidatos` e `rotulo`. Já está registrado, não há o que acrescentar.

## test-engineer · 3ª rodada · APROVADO · 2026-11-04 04:58:30 · `tasks/correcoes/2026-11-04-e2e-contrato-da-lista-8.md`

VEREDITO: APROVADO

**Cenários exigidos:**
- Gravação parcial: duas linhas, uma gravada e uma deixada de fora porque a matrícula passou a outra turma. A tela não pode dizer "Nada foi gravado", e a lista de nomes tem de ser relida e mostrar o nome que entrou.
- Gravação com uma linha, sem nada gravado.
- Prévia que envelheceu (`desatualizada`).
- Em todos os casos: a prévia sai com o "Gravar lista" e o campo mantém o texto.
- Recomendações que a ordem mandou aplicar: a espera inicial de 1 s e o crescimento de 1,5 vez, provados por mutação; os destinos novos no `TODO.md`.
- Permissão e isolamento: não se aplicam a este diff. A tarefa só muda o texto da tela e os testes, sem rota nem repository novos.

**Cobertos:**
- **Correção 1 da 2ª rodada, feita.**
  - O texto do `CONFLITO` da gravação mudou em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx:446`. Agora diz "essa linha não foi gravada. A lista de nomes da turma mostra o que entrou", e "Nada foi gravado" saiu desse caso.
  - Um `it.each` novo, nos casos parcial, nada e envelheceu, foi posto em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.test.tsx:513-565`. Ele confere:
    - o texto inteiro do alerta, com `toBe`;
    - no caso parcial, a lista relida com "Ana Souza";
    - a falta do "Gravar lista";
    - o campo que mantém o texto.
  - O caso de `api/lista.test.ts:148` foi renomeado. Continua provando só o código `CONFLITO` nos dois casos e aponta o teste da tela como o lugar onde a frase se prova.
  - O e2e (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/e2e/lista-da-turma.spec.ts:414`) foi acertado para o texto novo.
- **Mutações.** As cinco novas chegam às cláusulas certas e são pegas pelos casos citados:
  - o texto antigo, pego pelo `toBe`;
  - o `recarregarNomes` do `onError`, que é a única releitura no caminho do erro, pego pelo `waitFor` do caso parcial;
  - o `definirPrevia(undefined)`, pego pelo `queryByRole('button', { name: 'Gravar lista' })).toBeNull()`;
  - a espera de 500 ms, pega pelo `gets()` em 999 ms;
  - o crescimento de 2 vezes, pego por `gets() === 3` aos 2,5 s.
  - A seção "Mutações" passou de 32 para 37 blocos, o que confere com o diff.
- **Espera inicial.** O caso `a primeira espera é de 1 s e a seguinte, de 1,5 s` (`api/lista.test.ts:194`) usa relógio falso e o valor padrão, sem `esperaMs`. É prova de prazo dentro do teste, como a ordem pede.
- **`TODO.md`.** As recomendações da 2ª rodada têm destino escrito no item da 13.0: `nome_corrigido`, `Retry-After`, `AbortSignal`, a auditoria de tenancy, o `13_task.md` e o caso paginado a 43,3 s.
- **Testes.** Rodei `npx vitest run` nos dois arquivos: 2 arquivos e 47 testes, todos verdes. Não há `.skip` nem teste comentado. O mock é só a rede falsa, que é fronteira externa, e não esconde a regra.

**Bloqueantes:** nenhum.

**Recomendações (vão para a 13.0, junto com o item já registrado):**
1. **Causa que não confere no e2e.** No caso `desatualizada`, que é o do e2e (`lista-da-turma.spec.ts:401-414`), ninguém usou uma matrícula da lista em outra turma. Foi outra pessoa que pôs na lista um nome com outra matrícula (660070), e o job não gravou nada. A primeira oração do texto ("Uma das matrículas passou a ser usada…") já vinha da rodada anterior e não é falsa no ponto que bloqueava. Mas a causa que a tela dá não é a real. A tela nova da 13.0 deveria separar "a lista mudou desde a prévia" de "uma matrícula passou a outra turma".
2. **Singular no texto.** "essa linha" está no singular. Quando mais de uma linha fica de fora, a frase fica imprecisa. Vale um texto neutro ("as linhas com essas matrículas não foram gravadas") na tela nova.
3. **Mesmo texto para o 409 do POST.** O mesmo texto também aparece para o `CONFLITO` do POST quando há outra importação na fila. Já está no `TODO.md` pela 1ª rodada; só registro que o texto novo continua impreciso nesse caso.

## conformidade-reviewer · 3ª rodada · APROVADO · 2026-11-04 04:58:32 · `tasks/correcoes/2026-11-04-e2e-contrato-da-lista-8.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. O diff só mexe no texto do `CONFLITO` que a coordenação vê quando grava a lista de nomes da turma, mais testes, o e2e, o `TODO.md` e o documento da correção. Nada nele escreve em `Nota`, chama IA ou toca o tutor. Todos com autor humano? Não se aplica, porque não há caminho de escrita.
Decisão autônoma sobre aluno: ausente. A gravação parcial que o texto novo descreve é a importação da lista que a própria coordenação pediu, depois de ver a prévia. A linha recusada não é encaminhada para lugar nenhum: a tela manda refazer a prévia (`apps/web/src/areas/coordenacao/estrutura/ListaDaTurma.tsx:388`) e relê a lista (`:390`). Não é decisão sobre a trajetória do aluno.
Aprovação registrada: ok. Nenhuma saída de IA passa por este fluxo.
Supervisão do tutor: ok. O tutor está fora do diff.
Autonomia declarada e visível: sim, e não muda aqui. Nenhum agente foi tocado.
Bloqueantes: nenhum.
Recomendações:
- `ListaDaTurma.tsx:446` diz "Uma das matrículas… e essa linha não foi gravada". Se a prévia envelhecer com mais de uma linha afetada, o singular fica impreciso. É texto, não regra 70. Pode ir para a 13.0 junto com os textos que ela já reescreve; quem decide é o `frontend-reviewer`.
- O que a 1ª e a 2ª rodadas pediram continua no `TODO.md`, item `Da 13.0`: auditoria da regra 70 ao apagar a ponte. Nesta rodada só confirmei que o item segue lá.

Conferi o diff inteiro em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speconboarding-por-convite--l2/.processo/ordens/diff-correcao-lista8-r3.txt` e o `git diff --stat` entre as duas árvores, que bate com o resumo. Também procurei em `ListaDaTurma.tsx` e `ponte-da-lista.ts` por nota, IA, agente, tutor ou ranking, e não há nenhum. O único "nota" que aparece é "nota da 13.0", em comentário.
