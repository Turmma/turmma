# Tarefas — Acesso e convites

**PRD:** `prd.md` · **Tech Spec:** `techspec.md` · **Cenários:** `cenarios.md`
<!-- Quantas estão concluídas não se escreve aqui: `node tools/processo/estado.ts` conta pela lista. -->

## Lista

- [x] **1.0 — A porta de e-mail e o envio do convite pelo worker**
  - [ ] 1.1 Migration que só expande `convite` (`canal`, cifrados, `envio`, `envioReservadoEm`, `enviadoEm`) e o check dos cifrados
  - [ ] 1.2 `SecretCipher` em `packages/core/src/cripto/`, com cada chamador trocado
  - [ ] 1.3 `EmailSender`, `SmtpEmailSender`, `FakeEmailSender` com barreira e a trava de configuração; Mailpit no compose em `127.0.0.1`
  - [ ] 1.4 `EnvioRepository` e `enviar-email.ts`: reserva, envio fora da transação (10 s), `enviado` só com a minha reserva, 4xx/5xx
  - [ ] 1.5 `cancelado` na revogação, no refazer e na defesa do `desativar`; o expurgo de 24 h
  - [ ] 1.6 Testes: envio único, cancelamento, 4xx/5xx, expurgo, isolamento do job, as duas corridas

- [x] **2.0 — O envio adia sem prender a fila: `EMAIL_POR_MINUTO` e a saída de adiar**
  - [ ] 2.1 O limitador do `EMAIL_POR_MINUTO` no Redis de fila, com a metade reservada ao link da conta, sem seguro em memória; o ponto sem envio volta só na mesma janela
  - [ ] 2.2 A saída de adiar no `job-executor`: para a renovação, libera a vaga, linha a `publicado`, sem `uso.marcar('jobs')`, espera com o sorteio injetado
  - [ ] 2.3 Métricas de e-mail por resultado e de adiamento; alerta `falhou` acima de 20% em 1 h, com o parágrafo do `docs/runbook.md`
  - [ ] 2.4 Testes: adiamento sem tentativa, Redis fora, vaga liberada, sorteio, ponto devolvido, teto entre workers, métrica e alerta

- [x] **3.0 — A coordenação envia os convites por e-mail (API)**
  - [x] 3.1 Contrato em `packages/shared` e a rota
  - [x] 3.2 O filtro (pendente e vencido), o refazer em lote e o enfileiramento; "Copiar link" e "Reenviar" cancelam o envio antigo
  - [x] 3.3 A cota de 300/h: limitador novo no Redis de fila, N pontos atômicos, devolvidos no 429 e no rollback; Redis fora, 300 ÷ instâncias em memória
  - [x] 3.4 `convite.enviado`, gravado no pedido
  - [x] 3.5 Testes: filtro, cota de 300/h atômica, `convite.enviado`, isolamento, as duas corridas

- [ ] **4.0 — Professores mostra o envio, e o diálogo "Enviar convites"**
  - [ ] 4.1 O rótulo de cada um dos cinco estados, com `aria-live="polite"`
  - [ ] 4.2 O diálogo "Enviar convites" (contagem, aviso, 429) e o aviso no "Reenviar" e no "Copiar link"
  - [ ] 4.3 A releitura de 5 s, só com a aba visível e linha `na_fila`/`enviando`, parando em 5 min
  - [ ] 4.4 `docs/interface.md` (Parte A de Professores) e a busca dos textos novos em `e2e/`
  - [ ] 4.5 O `docs/roteiro-da-demonstracao.md` (seção 2, passos 6 e 7) conferido contra `e2e/roteiro-da-demonstracao.spec.ts`
  - [ ] 4.6 Testes: estados do envio, diálogo e avisos, releitura de 5 s, recomeço, 360 px e 1366 × 768

- [x] **5.0 — O link da conta e o "esqueci a senha" (API e worker)**
  - [x] 5.1 Migration `link_da_conta` e a exceção no `docs/modelo-de-dados.md`
  - [x] 5.2 `SISTEMA_DA_REQUISICAO` no `JobOutboxRepository.inserir`; `sistema.enviar-email-da-conta`, escola nula, no `EnvioRepository`
  - [x] 5.3 `cerca-envio` em `camadas.cjs` e a zona no `architecture.test.ts`, com as fixtures
  - [x] 5.4 As rotas: `rl:ip:senha`, 3/h pelo HMAC do e-mail, piso de 400 ms, link novo cancela o antigo; `senha.redefinida` por escola
  - [x] 5.5 O expurgo de acesso (30 dias; `falhou` de 24 h, `@Unscoped` próprio)
  - [x] 5.6 Testes: resposta igual com piso, limites, link de 1 h, auditoria por escola, a cerca, expurgo, as três corridas

- [ ] **6.0 — As telas "Esqueci a senha" e "Redefinir"**
  - [ ] 6.1 A tela "Esqueci a senha" e o link na entrada da equipe
  - [ ] 6.2 A tela "Redefinir", que lê o token do fragmento e o tira da barra
  - [ ] 6.3 `docs/interface.md`: as duas telas e a entrada
  - [ ] 6.4 Testes: esqueci → redefinir pelo Mailpit, estados, recomeço, 360 px

- [x] **7.0 — Posse do e-mail: verificar antes de a conta cruzar escolas (API)**
  - [ ] 7.1 Migration `conta.emailVerificadoEm`
  - [ ] 7.2 O aceite: verifica pelo canal `email`; `VERIFICACAO_PENDENTE` e o link (24 h, 3/h por conta) no copiado de outra escola
  - [ ] 7.3 `POST /v1/conta/verificar`; o redefinir também verifica; `conta.email_verificado` por escola
  - [ ] 7.4 Os casos da A1 (`convite.int.test.ts:320`, `:377`, `:447`) e o do RF6 do F2 (`professores.int.test.ts:900`) com a regra nova, e o nome do caso trocado
  - [ ] 7.5 Testes: verificação no aceite e no verificar, teto de 3/h, auditoria por escola, os casos da A1 e do F2, as duas corridas

- [ ] **8.0 — A tela "Verificar" e o aviso de `VERIFICACAO_PENDENTE` no aceite**
  - [ ] 8.1 A tela "Verificar"
  - [ ] 8.2 O aviso no aceite
  - [ ] 8.3 `docs/interface.md`
  - [ ] 8.4 O `docs/roteiro-da-demonstracao.md` (seção 2, passo 8) conferido contra `e2e/roteiro-da-demonstracao.spec.ts`
  - [ ] 8.5 Testes: verificar pelo Mailpit, aviso no aceite, recomeço, 360 px

- [ ] **9.0 — Gerar a senha provisória (API)**
  - [ ] 9.1 Migration que só expande `credencial_matricula` (`provisoriaHash`, `provisoriaExpiraEm`, `provisoriaGeradaPor` com `set null`, índice parcial do expurgo)
  - [ ] 9.2 A rota em `credencial/`: trava da linha do usuário do aluno, escopo (vínculo confirmado ou coordenação), conta ligada, `CONFLITO` de 10 s; só então as cotas (60/h por usuário, 5/dia por aluno), a senha, as sessões e `senha_provisoria.gerada` com o papel no `depois`
  - [ ] 9.3 O `desativar` anula as três colunas; o alvo novo no `retencao.expurgar-escola`; a métrica de provisórias por escola
  - [ ] 9.4 Testes: quem gera, `ENTRA_PELA_CONTA_DA_ESCOLA`, cotas, semáforo, expurgo, auditoria, dois "gerar"

- [ ] **10.0 — O aluno entra com a provisória e troca a senha (API)**
  - [ ] 10.1 O bilhete (`jose`, `typ` e `aud` próprios, 10 min, escola, aluno, `provisoriaExpiraEm`), só no `Authorization`
  - [ ] 10.2 A etapa `trocar_senha` no login de matrícula; o aluno sem `senha_hash` contra o hash fixo
  - [ ] 10.3 `trocar-senha` e `/trocas` em `naEscolaSemUsuario` com a escola do bilhete; o `update` condicionado; `.usada`; `no-store`
  - [ ] 10.4 O roteiro de carga com a provisória e a conta externa na rajada (`infra/scripts/carga-login.ts`)
  - [ ] 10.5 Testes: bilhete, troca condicionada, `/trocas`, isolamento, duas trocas, o [C] de carga

- [ ] **11.0 — O arquivo do titular traz os atos sobre ele (D85)**
  - [ ] 11.1 Migration do índice parcial `auditoria (escolaId, entidadeId, em)` nas seis ações
  - [ ] 11.2 A leitura por alvo: o papel fixo por ação nas quatro da F2, do `depois` na `.gerada`; o `lista_nome` só aprovado, pelo `alunoId` da decisão
  - [ ] 11.3 Testes: as seis ações por alvo, sem autor, nome não aprovado fora, linha da B fora

- [ ] **12.0 — A tela "Gerar senha provisória"**
  - [ ] 12.1 O item no menu da linha e o diálogo de confirmação
  - [ ] 12.2 A senha fora do cache de consultas, da URL, do log e do armazenamento; "fechar sem copiar" pergunta antes
  - [ ] 12.3 `docs/interface.md`
  - [ ] 12.4 O `docs/roteiro-da-demonstracao.md` (seção 2, passos 9 e 11) conferido contra `e2e/roteiro-da-demonstracao.spec.ts`
  - [ ] 12.5 Testes: confirmação com matrícula, senha fora do navegador, recusas, recomeço, 360 px e 1366 × 768

- [ ] **13.0 — A tela "Trocar a senha provisória"**
  - [ ] 13.1 A tela, com o bilhete só em memória
  - [ ] 13.2 A lista: esqueleto, "primeira vez", "Tentar de novo"
  - [ ] 13.3 `docs/interface.md`
  - [ ] 13.4 O `docs/roteiro-da-demonstracao.md` (seção 2, passo 12) conferido contra `e2e/roteiro-da-demonstracao.spec.ts`
  - [ ] 13.5 Testes: troca de ponta a ponta, lista e falhas, recomeço, 360 px

- [ ] **14.0 — A conta da escola no pedido do nome (API)**
  - [ ] 14.1 Migration `reivindicacao.contaExterna`, o único parcial e o check novo (`not valid` + `validate`)
  - [ ] 14.2 `intencao=reivindicar` no `externa/iniciar` (o acesso na `TenantResolutionRepository`) e o cookie `educa_conta_provada`
  - [ ] 14.3 O pedido com a conta; aprovar cria o usuário sem senha e a `conta_externa`, com `CONFLITO` que desfaz; `conta_externa.ligada`
  - [ ] 14.4 O `fechar('encerrada')` anula a `contaExterna`; `contaExterna` em `COLUNAS_FORA_DO_ARQUIVO`; `docs/lgpd.md` (o cookie); o runbook recusa os pedidos de conta na volta de versão
  - [ ] 14.5 Testes: cookie e escola, pedido com a conta, aprovação com `CONFLITO`, check, encerramento, corridas

- [ ] **15.0 — Ligar a conta da escola em "Eu" (API e tela)**
  - [ ] 15.1 `intencao=ligar` com sessão de aluno, na trava da linha do usuário
  - [ ] 15.2 O botão e os estados em "Eu"
  - [ ] 15.3 `docs/interface.md`
  - [ ] 15.4 Testes: ligar em "Eu", uma conta por aluno, gerar × ligar, aprovar × ligar, a tela

- [ ] **16.0 — A tela "Conta da escola na sala"**
  - [ ] 16.1 O botão e o retorno do provedor na sala
  - [ ] 16.2 Os estados
  - [ ] 16.3 `docs/interface.md`
  - [ ] 16.4 O `docs/roteiro-da-demonstracao.md` (seção 2, passo 10) conferido contra `e2e/roteiro-da-demonstracao.spec.ts`
  - [ ] 16.5 Testes: reivindicar com o `oidc-falso` até entrar, estados, recomeço, 360 px

## Dependências e paralelismo

| Tarefa | Depende de | Pode correr em paralelo com |
|---|---|---|
| 1.0 | — | 12.0, 13.0, 15.0, 16.0 |
| 2.0 | 1.0 | 10.0, 11.0, 12.0, 13.0, 15.0, 16.0 |
| 3.0 | 2.0 | 6.0, 8.0, 12.0, 13.0, 15.0, 16.0 |
| 4.0 | 3.0 | 5.0, 7.0, 9.0, 10.0, 11.0, 14.0 |
| 5.0 | 2.0 | 4.0, 12.0, 13.0, 15.0, 16.0 |
| 6.0 | 5.0 | 3.0, 7.0, 9.0, 10.0, 11.0, 14.0 |
| 7.0 | 5.0 | 4.0, 6.0, 12.0, 13.0, 15.0, 16.0 |
| 8.0 | 7.0 | 3.0, 9.0, 10.0, 11.0, 14.0 |
| 9.0 | — | 4.0, 6.0, 8.0, 16.0 |
| 10.0 | 9.0 | 2.0, 4.0, 6.0, 8.0, 12.0, 15.0, 16.0 |
| 11.0 | 10.0 | 2.0, 4.0, 6.0, 8.0, 12.0, 13.0, 15.0, 16.0 |
| 12.0 | 9.0 | 1.0, 2.0, 3.0, 5.0, 7.0, 10.0, 11.0, 14.0 |
| 13.0 | 10.0 | 1.0, 2.0, 3.0, 5.0, 7.0, 11.0, 14.0 |
| 14.0 | — | 4.0, 6.0, 8.0, 12.0, 13.0 |
| 15.0 | 9.0, 14.0 | 1.0, 2.0, 3.0, 5.0, 7.0, 10.0, 11.0 |
| 16.0 | 14.0 | 1.0, 2.0, 3.0, 5.0, 7.0, 9.0, 10.0, 11.0 |

Migration, schema e `packages/shared` (1.0, 3.0, 5.0, 7.0, 9.0, 10.0, 11.0 e 14.0) correm uma de cada vez; as telas, uma de cada vez, porque todas editam a `docs/interface.md`. A 9.0 e a 14.0 não dependem do e-mail e podem partir cedo, entre as do tronco.

## Subagentes por tarefa

| Tarefa | Subagentes obrigatórios | Porte |
|---|---|---|
| 1.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `test-engineer` | grande |
| 2.0 | `infra-guardian`, `tenancy-guardian`, `test-engineer` | grande |
| 3.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `test-engineer` | grande |
| 4.0 | `frontend-reviewer`, `test-engineer` | pequeno |
| 5.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `test-engineer` | grande |
| 6.0 | `frontend-reviewer`, `privacy-guardian`, `test-engineer` | pequeno |
| 7.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `test-engineer` | grande |
| 8.0 | `frontend-reviewer`, `test-engineer` | pequeno |
| 9.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `test-engineer` | grande |
| 10.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `test-engineer` | grande |
| 11.0 | `privacy-guardian`, `tenancy-guardian`, `infra-guardian`, `test-engineer` | grande |
| 12.0 | `frontend-reviewer`, `privacy-guardian`, `test-engineer` | pequeno |
| 13.0 | `frontend-reviewer`, `privacy-guardian`, `test-engineer` | pequeno |
| 14.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `test-engineer` | grande |
| 15.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `frontend-reviewer`, `test-engineer` | grande |
| 16.0 | `frontend-reviewer`, `privacy-guardian`, `test-engineer` | pequeno |

## Critério de pronto da funcionalidade

Do `ROADMAP.md`: o professor recebe o convite por e-mail; a equipe redefine a senha sozinha; o coordenador ou o professor da turma dá ao aluno uma senha provisória, com auditoria; e o aluno entra pela conta da escola depois da aprovação. Em detalhe:

- O convite sai uma vez pelo worker, com o estado do envio na tela Professores; revogar ou refazer o cancela na hora, e o limite por minuto adia sem gastar tentativa (1.0 a 4.0)
- "Esqueci a senha" e "Redefinir" funcionam sem dizer se o e-mail tem conta; a conta só cruza escolas pelo link copiado com o e-mail verificado (5.0 a 8.0)
- A provisória é gerada só por quem alcança o aluno, vence em 24 h, obriga a troca, e o aluno vê quem a gerou; o arquivo do titular traz os atos sobre ele sem o autor (D85) (9.0 a 13.0)
- O aluno pede o nome com a conta da escola e entra por ela depois da aprovação, ou a liga em "Eu" (14.0 a 16.0)
- Os e2e do RF18 passam, a 360 px e em 1366 × 768; o `docs/roteiro-da-demonstracao.md` conferido nas telas que ele percorre; esteira verde no último commit que alterou código
- Antes do portão de produção: o provedor de e-mail escolhido pelo Joaquim e registrado como suboperador (`techspec.md` §12)
