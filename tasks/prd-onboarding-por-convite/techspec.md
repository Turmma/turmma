# Tech Spec — A escola inteira entra de uma vez

**PRD:** `tasks/prd-onboarding-por-convite/prd.md`
**Status:** rascunho
**Teto:** 2.700 palavras (Joaquim, 03/11/2026): o F2 junta planilhas, e-mail, senha e conta da escola
**Cenários:** `tasks/prd-onboarding-por-convite/cenarios.md`: testes, limites, corridas e auditoria

## 1. Resumo da abordagem

O navegador lê o CSV ou a primeira aba do XLSX
e manda **texto** à API (como na A1); a API classifica na hora (prévia), e gravar vira o job
`estrutura.gravar-planilha`, que refaz a classificação. O e-mail sai pela porta `EnvioDeEmail` (SMTP, Mailpit no compose), em
job; a API grava token e endereço cifrados na linha. No worker, a conta global só se alcança pelas exceções da seção 6 e pelo ciclo de vida.

## 2. Módulos afetados

| Módulo | Novo ou alterado | O quê |
|---|---|---|
| `packages/core/src/estrutura/` | novo, por **mudança de lugar** | sobem de `apps/api`, para haver um jeito só: os repositories de turma, série, disciplina, lista e vínculo; o `encerrar`; o `travarPendente` e o `fechar` da decisão; o cadastro do professor, com o `contaParaConvite` indo do `TenantResolutionRepository` para o `ContaGlobalRepository` |
| `packages/core/src/importacao/`, `cripto/` | novo | o motor; o `SecretCipher`, por mudança de lugar |
| `packages/core/src/email/` | novo | porta, adaptadores SMTP (`nodemailer`, sem `logger` nem `debug`) e falso; `EnvioRepository` |
| `apps/api/src/estrutura/importacao/`, `grade/`; `professores/`, `sessao/`, `sala/` | novo; alterado | rotas; seção 5 |
| `apps/worker/src/processors/`, `packages/core/src/titular/` | alterado | `gravar-planilha.ts`, `enviar-email.ts`, os dois expurgos (seção 5); leitura por alvo |
| `packages/core/src/ciclo-de-vida/` | alterado | `desativar` encerra os vínculos (turmas travadas em ordem de id, num comando, na ordem global), revoga o convite e cancela o envio (N1 da A1) |
| `packages/shared/src/importacao/`; `apps/web`, `compose.yaml` | novo; alterado | cabeçalhos das planilhas e contratos, com `resumo` estrito e os códigos `SEM_SENHA` e `VERIFICACAO_PENDENTE`; seção 9; `mailpit` |

## 3. Modelo de dados

Todo id é `uuid` com `uuidv7()`; toda tabela nova com ano tem FK composta `(escolaId, anoLetivoId)` para `ano_letivo`.

```
importacao_planilha  escolaId*, anoLetivoId?, tipo, estado (na_fila|concluida|desatualizada|falhou),
                     linhas jsonb?, marcas jsonb?, assinatura, resumo jsonb? (só contagens), erro (lista fechada, check)?,
                     criadoPor? (set null), criadoEm, concluidaEm?; único parcial (escolaId) onde na_fila;
                     índice parcial (criadoEm) onde na_fila. anoLetivoId nulo só no tipo professores
alocacao             escolaId*, anoLetivoId*, vinculoId* (FK composta com o ano, on delete cascade), diaSemana 1–7,
                     inicio, fim, sala?; check inicio < fim; único (vinculoId, diaSemana, inicio); índice (escolaId, anoLetivoId)
evento_calendario    escolaId*, anoLetivoId*, tipo (feriado|recesso|evento), inicio, fim, descricao ≤ 120; índice (escolaId, anoLetivoId)
link_da_conta        contaId* (on delete cascade), finalidade (redefinir|verificar), tokenHash único, tokenCifrado?,
                     destinoCifrado?, expiraEm, usadoEm?, envio, criadoEm; único parcial (contaId, finalidade) aberto;
                     índice (coalesce(usadoEm, expiraEm))
convite              + canal text not null default 'copiado' (check copiado|email), tokenCifrado?, destinoCifrado?, envio?, enviadoEm?
conta                + emailVerificadoEm?
credencial_matricula + provisoriaHash?, provisoriaExpiraEm?, provisoriaGeradaPor? (set null); índice parcial (escolaId, provisoriaExpiraEm)
turma                + chave? (a normalizada); único parcial (escolaId, anoLetivoId, chave) onde não nula
vinculo              + origem not null default 'coordenacao' (coordenacao|grade|lista)
reivindicacao        + contaExterna jsonb? (provedor, tenant, sujeito); único parcial (escolaId, provedor, tenant, sujeito) onde pendente
```

`envio`: `na_fila|enviando|enviado|falhou|cancelado`, com `envioReservadoEm`. Cifrados: AES-GCM, chave `EMAIL_TOKEN_KEY`, o id da linha como dado
autenticado, nulos fora de `na_fila` e `enviando`. O check `reivindicacao_segredo_so_pendente` vira (`not valid` + `validate`): pendente ⇔ chave
e marca presentes e exatamente uma de senha ou `contaExterna`; fora do pendente, as quatro nulas. A `turma.chave` nasce
na criação e é recalculada na renomeação, no mesmo `update` (fora do padrão: nula; único violado: `CONFLITO`); a
migration a preenche só onde é única no ano, e a classificação calcula pelo nome quando ela é nula. Migrations só expandem; voltar a versão: o runbook recusa os pedidos de
conta pendentes e recalcula a `chave`.

`alocacao` substitui as três tabelas da grade do `docs/modelo-de-dados.md`; a reimportação **mantém o id** por (vínculo,
dia, início); a `Aula` da F2b aponta para ela. Glossário: "Grade horária" são as alocações do ano.

## 4. API

| Método | Rota | Papel | Entrada | Saída |
|---|---|---|---|---|
| POST | `/v1/importacoes/:tipo/previa` | coordenador | `{ texto, turmaId?, anoLetivoId? }`, até 512 KB | linhas, contagens, candidatos |
| POST | `/v1/importacoes/:tipo` | coordenador | idem + `marcas` | `{ id }`, 202 |
| GET | `/v1/importacoes/:id` | coordenador | — | id, tipo, estado, resumo, erro, datas |
| GET | `/v1/grade?turmaId=`, `/v1/calendario` | coordenador (com `anoLetivoId?`); professor com vínculo confirmado | — | aula (professor só com id e nome); evento |
| POST | `/v1/professores/convites/enviar` | coordenador | `{ usuarioIds? }` | contagem |
| POST | `/v1/alunos/:usuarioId/senha-provisoria` | coordenador; professor da turma | — | `{ senha, expiraEm }` |
| POST | `/v1/sessao/matricula/trocar-senha` | bilhete | `{ bilhete, senha }` | sessão |
| GET | `/v1/sessao/matricula/trocas` | bilhete | — | provisórias anteriores: data, papel, se usada |
| POST | `/v1/senha/esqueci`, `/redefinir`; `/v1/conta/verificar` | anônimo | `{ email }`; `{ token, senha }`; `{ token }` | 202; 204; 204 |
| GET | `/v1/sessao/externa/:provedor/iniciar?intencao=reivindicar\|ligar` | a rota que existe | — | redirecionamento |

`anoLetivoId` é filtro validado no servidor (como o de turma): sem ele, o ano em curso;
com ele, só o `planejado` da escola da sessão; outro valor, `NAO_ENCONTRADO`, como o `turmaId` fora da escola ou do ano.
Professores ganha `envio`. `/v1/turmas/:id/lista/previa` e `/lista` ficam, com o contrato da importação
(202). "Enviar", "Reenviar" e o "Copiar link" fazem o `convite/refazer` (linha nova).

## 5. Fluxo

**Planilha.** A prévia normaliza (turma: `^(\d)\s*[ºo°ª]?\s*(ano)?\s*([a-z])$`, sem acento nem caixa, 6–9 Fundamental e
1–3 Médio; disciplina sem acento nem caixa) e classifica em lote, com a escola do contexto: aluno aprovado pela
`credencial_matricula` e pelo `usuario`, não aprovado pela `lista_nome`; professor pelo `usuario` da escola, nunca pela
`conta`. Gravar
refaz a prévia (erro ou marca fora dos candidatos: `ENTRADA_INVALIDA`), fecha `falhou` a `na_fila` de mais de 1 h (`for
update nowait`; travada: `CONFLITO`) e enfileira.

**O job** abre o contexto pela escola do outbox e roda em três passos. (1) As contas dos professores, pelo
`contaParaConvite`, cada uma numa transação curta, na ordem do e-mail. (2) Sem trava: lê a importação (fora de
`na_fila`, sai) e refaz a classificação; assinatura diferente: `desatualizada`. (3) Uma transação curta (`lock_timeout` de
1 s, `statement_timeout` de 1,5 s) trava na **ordem global**, que o `desativar` e o `eliminar` também seguem: a importação
(`for update`; fora de `na_fila`, sai), o ano (`FOR SHARE`), os usuários que vai escrever (`FOR NO KEY UPDATE`), as contas
(`FOR SHARE`), as turmas tocadas (destino, origem e turma de todo marcado), em ordem de id num comando só, em `FOR NO KEY UPDATE`
(barra o gerar acesso, não o `FOR KEY SHARE` das FKs da decisão e da reivindicação), e os pedidos pendentes
delas, relidos. Relê o estado de toda linha em que o (2) se baseou (turma, usuário, vínculo, `lista_nome`, pedido, conta)
e aplica em lotes de 500, com escrita condicional (`lista_nome` com `where estado = :lido`; `fechar('encerrada')` antes de
apagar a `lista_nome`). Diferença, zero linhas (inclusive o `encerrar` que devolve `false`) ou único violado (`chave`,
matrícula, `vinculo_ativo_unico`): a transação volta e a importação sai `desatualizada`; conta sem e-mail: nova tentativa,
que refaz o (1). Trava esgotada ou deadlock: nova tentativa com espera crescente. Falha definitiva ou `ultimaTentativa`:
`falhou`. Toda troca de estado: `where estado = 'na_fila'`, apagando `linhas` e `marcas`.

| Estado | Entra | Sai | Prazo e falha |
|---|---|---|---|
| `na_fila` | gravar | o job | Redis perdido: o despachante republica (D49); processo morto: o BullMQ reentrega; tentativas esgotadas: `falhou`; mais de 1 h: o gravar seguinte, ou o expurgo da 1h, fecha `falhou` (até ~25 h) |
| `concluida`, `desatualizada`, `falhou` | o job, o gravar, o expurgo | — | sai em 90 dias (`sistema.expurgar-acesso`); a auditoria fica |
| envio `na_fila`, `enviando` | enviar, refazer, esqueci, aceite pendente; a reserva | o job de e-mail | reserva de mais de 2 min volta a ser retomada; mais de 24 h: o expurgo grava `falhou` e anula os cifrados (até ~48 h) |
| `enviado`, `falhou`, `cancelado` | o job; a revogação ou o link novo, na hora | — | o do convite ou do link |

Importação e convite parados, e provisória vencida (as três colunas nulas): o `retencao.expurgar-escola` (1h, por escola,
com escopo); o `link_da_conta` e a importação final de 90 dias: o `sistema.expurgar-acesso`. Todos com `skip locked`.

**Gravar.** Alunos: turma (com a `chave`) e série novas; `lista_nome` nova; nome corrigido no `usuario.nome` do aprovado
(`usuario.nome_corrigido`) ou na `lista_nome` (`lista.nome_corrigido`), sem nome; transferência pelo `encerrar` (`realocacao`), vínculo confirmado na nova,
`lista_nome` na nova turma, pedido pendente encerrado pelo `fechar('encerrada')`, que grava só o estado e anula os quatro
segredos, sem `decidida*` (o `virarSala` usa a mesma função); desligar o aprovado pelo `desativar`; o não
aprovado apaga a `lista_nome` e encerra o pedido (`lista_nome.retirado`). Virada de ano: aprovado sem vínculo no ano de
destino "volta", confirmado e com o mesmo login; desativado é erro. Professores: o `convidar` da A1, token descartado (fica `pendente`).
Grade: linha sem professor é erro; reaproveita o vínculo aberto ou cria um pendente (`origem = grade`); encerra só o marcado. O vínculo do ano planejado só se confirma em curso. Calendário: substitui no ano.

**E-mail.** `email.enviar-convite` leva a escola do convite no registro do job e lê o convite por id e escola.
`sistema.enviar-email-da-conta`, de escola nula, lê e grava o `link_da_conta` só no
`EnvioRepository`, `@Unscoped('o link é da conta global: lido pelo id do job')`. Os dois
conferem o `EMAIL_POR_MINUTO` (global, com metade reservada ao link da conta; estourado, adia sem gastar tentativa) e
reservam a linha numa transação curta (`enviando`, hora da reserva, lê os cifrados); reserva alheia vigente: adia até o
prazo. Enviam fora da transação (timeout de 10 s) e gravam `enviado`, cifrados nulos, `where envio = 'enviando' and
envioReservadoEm = :minha`. A revogação, o `desativar` e o link novo gravam `cancelado` na hora: o link que sair não vale.
SMTP 5xx: `falhou`; 4xx ou queda: devolve a linha a `na_fila` (mesma condição) e tenta de novo, depois `falhou`. Morto
após enviar: reenvia (D49).

**Posse do e-mail.** O aceite de convite de canal `email` grava `emailVerificadoEm`. Conta com senha e sem verificação que
aceita convite copiado de outra escola (o do painel também): `VERIFICACAO_PENDENTE` e link de `verificar` (24 h)
no lugar do aberto, como no "esqueci", com teto de 3 por hora por conta, que rebaixa. Verificada, o aceite segue.
Redefinir também verifica.

**Esqueci.** 202 igual, piso de 400 ms, inclusive no perdedor do índice único; conta ativa ganha link (1 h). Redefinir
confere o token antes do argon2, troca a senha com a conta travada, encerra as sessões e verifica o e-mail; o MFA fica.

**Senha provisória.** Oito caracteres de `23456789ABCDEFGHJKMNPQRSTUVWXYZ`, em dois grupos. Gerar confere o escopo
e a conta ligada antes de apagar `senha_hash` e a provisória anterior, encerra as sessões e audita (papel de quem gerou no `depois`); conta da escola ligada: `SEM_SENHA`
(PRD §7).
O login com a provisória devolve `{ etapa: 'trocar_senha', bilhete }` (10 min, cifrado com `BILHETE_KEY`, com o aluno
e o hash da provisória, nunca na URL); qualquer outra falha, inclusive aluno só com conta externa (contra um hash fixo, no mesmo tempo), é a
credencial inválida. `/trocas`, com o bilhete conferido como na troca, lista as provisórias anteriores: data, papel de quem gerou, se usada. A troca é `update … where id = … and provisoria_hash = :doBilhete and provisoria_expira_em > now()`; zero
linhas, recusa. `senha_provisoria.gerada` e `.usada` (autor: o aluno) entram no arquivo do titular, por alvo, sem quem gerou.

**Conta da escola do aluno.** `intencao=reivindicar` guarda no cookie OIDC o acesso da turma. No retorno, com domínio
liberado e conta sem ligação, grava `educa_conta_provada` (como o `educa_oidc`, mais `Path=/v1/salas` e 15 min;
escola, acesso e conta, sem e-mail). O pedido confere escola e acesso (senão, cookie
inválido), grava `contaExterna` no lugar do hash (a invariante do `travarPendente` passa a senha ou conta) e apaga o
cookie. Aprovar cria o usuário sem senha e a `conta_externa`, na decisão. `intencao=ligar` exige sessão de aluno.

## 6. Isolamento

Escola e ano vêm do contexto; no job, da linha, nunca do payload. Duas exceções, cercadas **por arquivo**
nas duas guardas (`ZONAS_DAS_CLASSES_CERCADAS` do `architecture.test.ts` e `cerca-conta-global` de
`tools/guardas/camadas.cjs`, cada uma com fixture que reprova o arquivo vizinho) e no `docs/modelo-de-dados.md`:
- `link_da_conta`: na API, o `TenantResolutionRepository` (pelo hash e pela conta, como o `codigo_recuperacao`); no
  worker, o `EnvioRepository` (pelo id do job), zona `enviar-email.ts` e o expurgo de acesso, alvo também da
  `importacao_planilha` final
- `ContaGlobalRepository.contaParaConvite`, `@Unscoped('a conta é global: acha ou cria pelo e-mail')`, e o cadastro descarta o `nova`:
  zona `packages/core/src/estrutura/cadastro-de-professor.ts`

Os casos estão no `cenarios.md`.

## 7. Dado pessoal

| Item | Resposta |
|---|---|
| Campos | os da seção 3 e o cookie, no `docs/lgpd.md` |
| Log | ids, contagens, código; nunca linha, e-mail, token nem resposta do SMTP |
| Auditoria | a tabela RF17 do `cenarios.md`, uma linha por ação |
| Provedor externo | o de e-mail, `suboperador` antes do portão: endereço e texto da equipe, nunca de aluno |
| Retenção e eliminação | `docs/lgpd.md`; `alocacao` em cascata com o vínculo; autores `set null`; cifrados e `contaExterna` em `COLUNAS_FORA_DO_ARQUIVO` |
| DTO | seção 4; a prévia sem e-mail de colega nem cifrado, fora do armazenamento do navegador |

## 7b. Conformidade CNE

Sem IA.

## 7c. Carga e falha

| Item | Resposta |
|---|---|
| Caminho quente | login: provisória e conta externa entram na rajada do login |
| Fila | `normal`: `estrutura.gravar-planilha`, `email.enviar-convite`, `sistema.enviar-email-da-conta` |
| Limites e corridas | tabelas do `cenarios.md`; limite por usuário, escola ou conta, nunca só por IP; o que manda e-mail rebaixa |
| Tempo | prévia e gravar com 3.000 linhas: p95 até 2 s com a rajada em paralelo; nenhum statement acima de 1,5 s |
| Dependência cai | SMTP: `falhou`, "Reenviar"; Redis: o job espera no Postgres |
| Métrica e alerta | job e e-mail por resultado, e o passo (3); alerta com runbook: `falhou` acima de 20% em 1 h, `na_fila` há 30 min, passo (3) acima de 1 s |

## 9. Frontend

`ImportarPlanilha` em Turmas, Professores e na aba nova **Grade e calendário** de
`Escola.tsx`; o XLSX carrega sob demanda (`docs/interface.md` 10.4). Prévia: erros, avisos e marcas primeiro, o resto em
contagem, paginado de 100; marca rotulada com nome e matrícula. Vazio com "Baixar
modelo"; falha com "Tentar de novo"; código de erro vira frase com o que fazer. A grade, tabela com cabeçalhos, rola no
cartão a 360 px. A provisória confirma nome e turma antes de gerar; "Enviar" avisa que os links anteriores caducam. Telas novas: esqueci, redefinir, verificar, trocar a
provisória, conta da escola na sala e em "Eu"; cada uma atualiza o `docs/interface.md`.

## 10. Testes

Um teste por cláusula, no `cenarios.md`; e2e em `chromebook` e `celular`, com axe; XLSX real na biblioteca real.

## 11. Conformidade com as regras

| Regra | Desvio e justificativa | Documento |
|---|---|---|
| 10, item 1 | `link_da_conta` é da conta global, como `codigo_recuperacao` | `docs/modelo-de-dados.md` |
| 10, item 9 | sem escopo, cercados (seção 6): `link_da_conta` e o `contaParaConvite`, que só muda de classe (quatro `@Unscoped` no `ContaGlobalRepository`; o total não muda) | esta seção |
| Modelo de dados | `alocacao` plana, com id estável | `docs/modelo-de-dados.md`, glossário |
| PRD, RF15 | o PRD admite 10 s; aqui o teto é 2 s (regra 00, item 4) | esta seção |
| PRD, "E-mail que volta" | "falhou" é a recusa na entrega SMTP; a devolução tardia espera o webhook do provedor escolhido (`TODO.md`) | esta seção |

## 12. Premissas não verificadas

- ⚠️ NÃO VERIFICADO: `read-excel-file` (MIT) devolve a célula de texto como texto
- O provedor de e-mail de produção: Joaquim, antes do portão (`docs/decisoes-em-aberto.md`)

## 13. Riscos técnicos

- O passo (3) do job trava turmas contra o gerar acesso das 7h30: o critério do cenário [C]; falhando, a spec volta à
  revisão
- Quem gera a provisória pode entrar na conta do aluno. Mitigação: na troca seguinte, o aluno vê a provisória que outro
  usou; auditoria e arquivo do titular; padrão de mercado (D81)
- `VERIFICACAO_PENDENTE` revela, a quem tem o link copiado, que o e-mail tem conta: aceito
