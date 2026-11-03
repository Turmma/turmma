# Tech Spec — A escola inteira entra de uma vez

**PRD:** `tasks/prd-onboarding-por-convite/prd.md`
**Status:** rascunho

## 1. Resumo da abordagem

Um motor só de planilha, em `packages/core/src/importacao/`, com quatro tipos (`alunos`, `professores`, `grade`,
`calendario`): o navegador lê o CSV ou a primeira aba do XLSX e manda **texto** à API (o caminho da A1), a API classifica
na hora (prévia, só leitura), e gravar vira um job `estrutura.gravar-planilha` na fila `normal`, que refaz a
classificação e para se a escola mudou desde a prévia. A lista por turma da A1 vira o tipo `alunos` com a turma fixa. O e-mail sai por uma porta `EnvioDeEmail` com adaptador SMTP (Mailpit no compose, falso nos
testes), em job da fila `normal`, com o token cifrado na linha até o envio.

## 2. Módulos afetados

| Módulo | Novo ou alterado | O quê |
|---|---|---|
| `packages/core/src/importacao/`, `apps/api/src/estrutura/importacao/` | novo | motor de planilha (core, que o worker usa) e rotas; `lista/` passa a chamá-lo |
| `packages/core/src/email/` | novo | porta `EnvioDeEmail`, adaptadores SMTP (`nodemailer`) e falso |
| `apps/worker/src/processors/` | alterado | `gravar-planilha.ts`, `enviar-email.ts` |
| `apps/api/src/estrutura/grade/` | novo | leitura da grade e do calendário |
| `apps/api/src/professores/`, `sessao/convite/` | alterado | envio em lote, canal, posse do e-mail |
| `apps/api/src/sessao/senha/`, `credencial/`, `sessao/login/` | novo e alterado | esqueci, verificar, provisória |
| `apps/api/src/sessao/external/`, `sala/` | alterado | conta externa na reivindicação e em "Eu" |
| `packages/core/src/ciclo-de-vida/` | alterado | `desativar` encerra vínculos e revoga acesso (N1 da A1, `TODO.md`) |
| `apps/web`, `compose.yaml` | alterado | seção 9; serviço `mailpit` |

## 3. Modelo de dados

```
importacao_planilha  id, escolaId*, anoLetivoId*, tipo, estado (na_fila|concluida|desatualizada|falhou),
                     linhas jsonb?, marcas jsonb?, assinatura text, resumo jsonb?, erro text?, criadoPor*, criadoEm, concluidaEm?
                     único parcial (escolaId) onde estado = na_fila
alocacao             id, escolaId*, anoLetivoId*, vinculoId* (FK composta), diaSemana 1–7, inicio time, fim time, sala text?
                     check inicio < fim; índice (escolaId, anoLetivoId, vinculoId)
evento_calendario    id, escolaId*, anoLetivoId*, tipo (feriado|recesso|evento), inicio date, fim date, descricao ≤ 120
link_da_conta        id, contaId*, finalidade (redefinir|verificar), tokenHash único, tokenCifrado bytea?, expiraEm,
                     usadoEm?, envio (na_fila|enviado|falhou|cancelado), criadoEm; único parcial (contaId, finalidade) aberto
convite              + canal (copiado|email), tokenCifrado bytea?, envio?, enviadoEm?
conta                + emailVerificadoEm?
credencial_matricula + provisoriaHash?, provisoriaExpiraEm?, provisoriaGeradaPor?
vinculo              + origem (coordenacao|grade|lista), padrão coordenacao
reivindicacao        + contaExterna jsonb? (provedor, tenant, sujeito), só enquanto pendente; check: ou senha, ou conta
```

`alocacao` substitui as três tabelas da grade do `docs/modelo-de-dados.md`: a planilha traz o horário em cada linha. `link_da_conta` é da conta global (seção 11).
Migrations só expandem (regra 80, item 9).

## 4. API

| Método | Rota | Papel | Entrada | Saída |
|---|---|---|---|---|
| POST | `/v1/importacoes/:tipo/previa` | coordenador | `{ texto, turmaId? }`, até 512 KB | linhas classificadas, contagens, candidatos a marca |
| POST | `/v1/importacoes/:tipo` | coordenador | `{ texto, turmaId?, marcas }` | `{ id }`, 202 |
| GET | `/v1/importacoes/:id` | coordenador | — | estado e resumo |
| GET | `/v1/grade?turmaId=` e `/v1/calendario` | coordenador; professor (só turmas com vínculo confirmado) | — | alocações; eventos |
| POST | `/v1/professores/convites/enviar` | coordenador | `{ usuarioIds? }` | contagem na fila |
| POST | `/v1/alunos/:usuarioId/senha-provisoria` | coordenador; professor da turma | — | `{ senha }`, uma vez |
| POST | `/v1/sessao/matricula/trocar-senha` | anônimo com bilhete | `{ bilhete, senha }` | sessão |
| POST | `/v1/senha/esqueci`, `/v1/senha/redefinir` | anônimo | `{ email }`; `{ token, senha }` | 202 sempre; 204 |
| POST | `/v1/conta/verificar` | anônimo | `{ token }` | 204 |
| GET | `/v1/externo/:provedor/iniciar?intencao=reivindicar\|ligar` | anônimo com acesso da turma; aluno | — | redirecionamento |

## 5. Fluxo

**Planilha.** A prévia lê o texto, normaliza (turma: `^(\d)\s*[ºo°ª]?\s*(ano)?\s*([a-z])$` sem acento e sem caixa, com
6–9 Fundamental e 1–3 Médio; disciplina: nome sem acento e sem caixa) e classifica com buscas em lote, por índice da
escola. A prévia de alunos que mostra nome do banco ("nome corrigido", "fora da planilha") audita `turma.alunos_lidos`
(`conferencia_de_cadastro`). Gravar refaz a prévia; erro ou marca fora dos candidatos: `ENTRADA_INVALIDA`; senão grava
`importacao_planilha` com linhas, marcas e **assinatura** (hash da classificação) e enfileira o job. O job, numa transação,
refaz a classificação; assinatura diferente: `desatualizada`; igual, aplica em lotes de 500 e fecha com `update … set
estado = 'concluida', linhas = null, marcas = null where estado = 'na_fila'`. Erro não transitório ou tentativas
esgotadas: `falhou`, com o código e as linhas apagadas. A tela relê o estado a cada 2 s, com a aba visível.

**Gravar alunos:** turma e série novas; `lista_nome` nova; nome corrigido; transferência (vínculo `encerrado` com
`realocacao`, vínculo confirmado na nova, `lista_nome.turma_id` trocado, pedido pendente `encerrada`); desligamento
(`CicloDeVidaService.desativar`). **Professores:** `usuario` e `conta` sem senha, como o cadastro da A1. **Grade:** apaga as
alocações do ano, acha ou cria o vínculo pendente (`origem = grade`) por turma × disciplina × professor, insere as
alocações; encerra só os marcados. **Calendário:** apaga e insere.

**E-mail.** "Enviar convites" revoga o convite aberto, cria outro com `canal = email`, `tokenCifrado` (o `secret-cipher`
do MFA) e `envio = na_fila`, e enfileira `email.enviar` com o id. O worker decifra, monta o texto (escola e link, nada de
aluno), envia e grava `enviado` com `tokenCifrado = null`. Revogado no meio: `cancelado`. SMTP fora: novas
tentativas, depois `falhou`. Queda entre enviar e gravar reenvia o mesmo link (D49; aceito). "Esqueci" e "verificar" usam `link_da_conta` igual.

**Posse do e-mail.** Aceitar convite de canal `email` grava `emailVerificadoEm`. Conta sem verificação que aceita convite
de outra escola por link copiado recebe `VERIFICACAO_PENDENTE`, e um `link_da_conta` de `verificar` vai ao e-mail; o
aceite volta depois de verificado. Redefinir pelo "esqueci" também verifica.

**Esqueci.** 202 igual, com piso de 400 ms; com conta ativa, cria `link_da_conta` (1 h). Redefinir, com a conta travada:
troca a senha, encerra as sessões, verifica o e-mail; o MFA fica.

**Senha provisória.** Oito caracteres de `23456789ABCDEFGHJKMNPQRSTUVWXYZ`, em dois grupos; argon2 no semáforo. Gerar apaga `senha_hash`, encerra as sessões do aluno e audita. Login por matrícula com a provisória certa e
vigente devolve `{ etapa: 'trocar_senha', bilhete }` (10 min, como o `convite-ticket`), não
sessão; a troca grava a senha, apaga a provisória e abre a sessão. Aluno só com conta externa: `SEM_SENHA`.

**Conta da escola do aluno.** `intencao=reivindicar` guarda no cookie OIDC o acesso da turma; no retorno, sem ligação, o
domínio liberado vira um cookie assinado de 15 min com a conta provada (sem e-mail), e a página da sala segue com nome e
matrícula; o pedido grava `contaExterna` no lugar do hash. Aprovar cria o usuário com `senha_hash` nulo e a
`conta_externa`, na transação da decisão. `intencao=ligar` exige sessão de aluno e liga à conta dela; a restrição única
de `conta_externa` decide a corrida.

## 6. Isolamento

Repository novo lê escola e ano do contexto; o job, da linha de `importacao_planilha`, nunca do payload. `link_da_conta` só é lido pelo hash do token ou pela conta do contexto verificado. Testes: A não lê nem
grava importação, grade, calendário, provisória e envio da B; marca com id da B é `ENTRADA_INVALIDA`; "8A" da B não casa
com planilha da A; professor não gera provisória fora das turmas confirmadas (404 igual); conta externa da A não entra na
B; token de uma conta não altera outra.

## 7. Dado pessoal

| Item | Resposta |
|---|---|
| Campos pessoais tocados | nome e matrícula do aluno; nome e e-mail do professor; conta da escola (identificador opaco) |
| Novos campos (atualizar `docs/lgpd.md`) | os da seção 3; `importacao_planilha.linhas` até o fim do job (o expurgo apaga a parada há 24 h); `reivindicacao.contaExterna` até a decisão |
| Log | ids, tipo, contagens, código de erro; nunca linha, e-mail nem token |
| Auditoria | `planilha.gravada` (tipo, contagens), `aluno.transferido`, `usuario.desativado`, `vinculo.criado`/`encerrado`, `convite.enviado`, `senha_provisoria.gerada`, `senha.redefinida`, `conta.email_verificado`, `conta_externa.ligada` |
| Provedor externo | o de e-mail recebe endereço e texto da equipe: cadastrado em `suboperador` antes do portão |
| Retenção | as da seção 8 do PRD; `link_da_conta` sai 30 dias após uso ou vencimento, no `sistema.expurgar-acesso` |
| Autorização por objeto | provisória e grade: turma em que o professor tem vínculo confirmado |
| DTO de saída | prévia: linha, nome, matrícula, resultado, erro; candidatos com id, nome e turma |

## 7b. Conformidade CNE

Sem IA.

## 7c. Carga e falha

| Item | Resposta |
|---|---|
| Caminho quente | login (provisória, conta externa) |
| Manhã de segunda | a troca de senha entra no balde do login por matrícula |
| Fila e prioridade | `normal`: `estrutura.gravar-planilha` e `email.enviar` |
| Limite por escola | uma importação ativa (índice único); prévia ≤ 512 KB e 3.000 linhas; e-mail pelo `EscolaConcurrencyLimiter` |
| Rate limit | prévia 20/min por usuário e convites 300/h por escola, 429; esqueci: `rl:ip` e 3/h por e-mail, **rebaixa** (202 sem envio); provisória 60/h por usuário e 5/dia por aluno, 429; trocar-senha: o contador da conta |
| Corridas | gravar duas vezes: índice único parcial, perdedor `CONFLITO`; job duas vezes: o `update … where estado = 'na_fila'`, o segundo não aplica; dois "enviar": `convite_pendente_unico`, vale o último; redefinir duas vezes: `usado_em is null`; ligar a mesma conta: `conta_externa` única, perdedor `CONFLITO` sem nome. Cada uma com teste em paralelo |
| Índices | os da seção 3, todos começando por `escolaId` |
| Migration | só expande |
| Dependência cai | SMTP: `falhou` e "Reenviar"; Redis: o job espera no Postgres (D49); banco: erro tipado |
| Métrica e alerta | job e e-mail por resultado; alerta de `falhou` acima de 20% em 1 h, com parágrafo no `docs/runbook.md` |
| Carga | novo: 3.000 alunos e 1.800 aulas com a rajada de login em paralelo; nenhum statement acima de 1,5 s |

## 9. Frontend

Um componente `ImportarPlanilha` (arquivo, prévia, marcas, gravar, estado) em Turmas, Professores e na aba nova **Grade e
calendário** de `Escola.tsx`. A biblioteca de XLSX carrega sob demanda (`docs/interface.md` 10.4). A prévia mostra primeiro
erros, avisos e marcas; o resto em contagem, paginado de 100 em 100. A grade rola na horizontal dentro do cartão a 360 px.
Telas novas: esqueci, redefinir, verificar, trocar a provisória; "Entrar com a conta da escola" na sala; "Ligar a conta" em
"Eu"; "Gerar senha provisória" na lista de alunos. Cada tarefa de tela atualiza o
`docs/interface.md`.

## 10. Testes

| Camada | O que será testado |
|---|---|
| Unidade | normalização de turma, classificador, assinatura, provisória, leitor (`;`, tab, UTF-16, notação científica) |
| Integração | cada RF, com Postgres; job reexecutado; prévia desatualizada; e-mail falso; troca obrigatória; posse entre escolas; `desativar` |
| E2E | RF18, com Mailpit; planilha suja; esqueci a senha |
| Isolamento | seção 6 |

## 11. Conformidade com as regras

| Regra | Como é atendida | Desvio e justificativa | Documento |
|---|---|---|---|
| 10, item 1 | `escolaId` em toda tabela nova | `link_da_conta` é da conta global, como `codigo_recuperacao`; lida só pelo hash ou pela conta verificada | `docs/modelo-de-dados.md` |
| 10, item 9 | sem escopo só na conta global | `link_da_conta` soma leituras sem escopo ao repository da credencial global, discutidas aqui | esta seção |
| Modelo de dados | `alocacao` plana | substitui as três tabelas da grade (seção 3) | `docs/modelo-de-dados.md` |

## 12. Premissas não verificadas

- ⚠️ NÃO VERIFICADO: a biblioteca de XLSX no navegador (`read-excel-file`, MIT) devolve a célula de texto como texto e a
  numérica como número, e cabe sob demanda. Interface `lerPlanilha(arquivo): Promise<string[][]>`; falso nos testes de unidade
- ⚠️ NÃO VERIFICADO: a API HTTP do Mailpit (`/api/v1/messages`) para o e2e ler o link. Alternativa: o adaptador falso grava
  num arquivo do compose de teste

## 13. Riscos técnicos

- A transação do job segura turmas em transferência: com 3.000 linhas, medir no cenário de carga; se passar de 1,5 s por
  statement, quebrar por turma, com a assinatura conferida por lote
- Duas turmas existentes com a mesma chave normalizada: erro na prévia, nunca escolha
