# Tech Spec — A equipe e o aluno entram sem depender de ninguém

**PRD:** `tasks/prd-acesso-e-convites/prd.md`
**Status:** do F2, separada em 03/11/2026; revista
**Depende de:** F2: o `travarPendente`, o `fechar('encerrada')`, o cadastro do professor, o `desativar` e os dois expurgos
**Cenários:** `tasks/prd-acesso-e-convites/cenarios.md`

## 1. Resumo da abordagem

O e-mail sai pela porta `EmailSender` (SMTP; D81), em job; a API grava token e endereço cifrados na
linha.

## 2. Módulos afetados

| Módulo | Novo ou alterado | O quê |
|---|---|---|
| `packages/core/src/cripto/` | movido | o `SecretCipher`, de `apps/api/src/credencial/` |
| `packages/core/src/email/` | novo | porta `EmailSender`, adaptadores `SmtpEmailSender` (`nodemailer`, sem `logger` nem `debug`) e `FakeEmailSender`; `EnvioRepository`; fora do ambiente local, `EMAIL_PROVEDOR_ID` e TLS obrigatórios, e o Mailpit recusado (como a `IA_PROVEDOR_ID`) |
| `apps/api/src/professores/`, `sessao/`, `sala/`, `credencial/` | alterado | rotas; seção 5. A provisória mora em `credencial/` |
| `packages/core/src/queue/` | alterado | o job de sistema que nasce de requisição (seção 6) |
| `apps/worker/src/processors/`, `apps/worker/src/job-executor.ts` | alterado | `enviar-email.ts`, os dois expurgos, a saída de adiar (seção 5) |
| `packages/core/src/titular/leitura-do-titular.ts` | alterado | a leitura por alvo da D85 (seção 5, "Arquivo do titular") |
| `packages/core/src/ciclo-de-vida/` | alterado | o `desativar` anula a provisória; a cláusula de defesa (`revogarConviteAberto`) também cancela o envio |
| `packages/shared/`; `apps/web`, `compose.yaml` | alterado | contratos novos e alterados (seção 4) e os códigos `ENTRA_PELA_CONTA_DA_ESCOLA` e `VERIFICACAO_PENDENTE`; seção 9; `mailpit`, com a interface só em `127.0.0.1` |

## 3. Modelo de dados

```
link_da_conta        id uuidv7, contaId* (on delete cascade), finalidade (redefinir|verificar), tokenHash único, tokenCifrado?,
                     destinoCifrado?, expiraEm, usadoEm?, envio, criadoEm; único parcial (contaId, finalidade) aberto;
                     índice (coalesce(usadoEm, expiraEm))
convite              + canal text not null default 'copiado' (check copiado|email), tokenCifrado?, destinoCifrado?, envio?, enviadoEm?
conta                + emailVerificadoEm?
credencial_matricula + provisoriaHash?, provisoriaExpiraEm?, provisoriaGeradaPor? (set null); índice parcial (escolaId, provisoriaExpiraEm)
reivindicacao        + contaExterna jsonb? (provedor, tenant, sujeito); único parcial (escolaId, provedor, tenant, sujeito) onde pendente
auditoria            + índice parcial (escolaId, entidadeId, em) nas ações da lista por alvo (seção 5), como o 0034
```

`envio`: `na_fila|enviando|enviado|falhou|cancelado`, com `envioReservadoEm`. Cifrados: AES-GCM, chave `EMAIL_TOKEN_KEY`, o
id da linha como dado autenticado, nulos fora de `na_fila` e `enviando`. O check `reivindicacao_segredo_so_pendente` vira
(`not valid` + `validate`): pendente ⇔ chave e marca presentes e exatamente uma de senha ou `contaExterna`; fora do
pendente, as quatro nulas; o `fechar('encerrada')` do F2 passa a anular também a `contaExterna`. Migrations só expandem;
voltar a versão: o runbook recusa os pedidos de conta pendentes.

## 4. API

| Método | Rota | Papel | Entrada | Saída |
|---|---|---|---|---|
| POST | `/v1/professores/convites/enviar` | coordenador | `{ usuarioIds? }` | contagem |
| POST | `/v1/usuarios/:usuarioId/senha-provisoria` | coordenador; professor da turma | — | `{ senha, expiraEm }` |
| POST | `/v1/sessao/matricula/trocar-senha` | bilhete no `Authorization` | `{ senha }` | sessão |
| GET | `/v1/sessao/matricula/trocas` | bilhete no `Authorization` | — | até 10 provisórias anteriores: data, papel, se usada |
| POST | `/v1/senha/esqueci`, `/redefinir`; `/v1/conta/verificar` | anônimo | `{ email }`; `{ token, senha }`; `{ token }` | 202; 204; 204 |
| GET | `/v1/sessao/externa/:provedor/iniciar?intencao=reivindicar\|ligar` | a rota que existe | — | redirecionamento |

Mudam: login de matrícula (`trocar_senha`), aceite (`VERIFICACAO_PENDENTE`), `GET /v1/professores`
(`envio`), `externa/iniciar` (`intencao`), pedido de nome (conta provada).
"Enviar", "Reenviar" e o "Copiar link" fazem o `convite/refazer` (linha nova). Links com o token no fragmento; provisória,
troca e `/trocas` com `no-store`.

## 5. Fluxo

**E-mail.** `email.enviar-convite` leva a escola do convite no registro do job e lê o convite por id e escola.
`sistema.enviar-email-da-conta`, de escola nula, lê e grava o `link_da_conta` só no `EnvioRepository`,
`@Unscoped` (conta global, lida pelo id do job). Os dois consomem o `EMAIL_POR_MINUTO` (global, com metade
reservada ao link da conta), atômico no Redis de fila, sem o seguro em memória; estourado ou Redis fora, adia, nunca
envia sem contar. Adiar libera a vaga, volta a `publicado`, não conta tentativa nem uso, e espera o `msBeforeNext` ou o
prazo da reserva (Redis fora: 30 s), mais até 5 s sorteados. Ponto sem envio volta. Depois reservam a linha numa transação curta (`enviando`, hora,
cifrados); reserva alheia vigente: adia até o prazo. Enviam fora dela (timeout de 10 s) e
gravam `enviado`, cifrados nulos, `where envio = 'enviando' and envioReservadoEm = :minha`. Revogação, link novo (refazer,
"esqueci", verificar) e a defesa do `desativar` gravam `cancelado` na hora: o link que sair não vale. SMTP 5xx: `falhou`; 4xx ou queda: devolve a linha a
`na_fila` (mesma condição) e tenta de novo, depois `falhou`. Morto após enviar: reenvia (D49).

| Estado | Entra | Sai | Prazo e falha |
|---|---|---|---|
| envio `na_fila`, `enviando` | enviar, refazer, esqueci, aceite pendente; a reserva | o job de e-mail | reserva de mais de 2 min volta a ser retomada; mais de 24 h: o expurgo grava `falhou` e anula os cifrados (até ~48 h) |
| `enviado`, `falhou`, `cancelado` | o job; a revogação ou o link novo, na hora | — | o do convite ou do link |

Expurgos (`skip locked`): convite parado e provisória vencida, `retencao.expurgar-escola`; `link_da_conta`, `sistema.expurgar-acesso`.

**Enviar.** A cota de 300/h consome, de uma vez e atômico, um ponto por convite que entra (pendente ou vencido); o lote
recusado e a transação desfeita devolvem os pontos. Limitador novo, no Redis de fila, janela de 1 h; Redis fora: seguro
em memória, 300 ÷ instâncias.

**Posse do e-mail.** O aceite de convite por e-mail grava `emailVerificadoEm`. Conta com senha e sem verificação que
aceita convite copiado de outra escola (o do painel também): `VERIFICACAO_PENDENTE` e link de `verificar` (24 h) no lugar
do aberto, como no "esqueci", com teto de 3 por hora por conta, que rebaixa. Verificada, o aceite segue. Redefinir
também verifica.

**Esqueci.** 202 igual, piso de 400 ms, também no perdedor do índice único; conta ativa ganha link (1 h). Redefinir
confere o token antes do argon2, troca a senha com a conta travada, encerra as sessões e verifica o e-mail; o MFA fica.

**Senha provisória.** Oito caracteres de `23456789ABCDEFGHJKMNPQRSTUVWXYZ`, em dois grupos. Gerar trava a linha do usuário do aluno
(a mesma do "ligar"; na aprovação, decide a `conta_externa` única), confere o escopo e a conta ligada, e só então apaga `senha_hash` e a
provisória anterior, encerra as sessões e audita (papel de quem gerou no `depois`); conta da escola ligada:
`ENTRA_PELA_CONTA_DA_ESCOLA` (PRD §7). Provisória não usada de menos de 10 s, de qualquer autor: `CONFLITO`. O hash passa pelo semáforo do argon2. O login com a provisória devolve
`{ etapa: 'trocar_senha', bilhete }`: JWT assinado (`jose`, `aud` própria, não o desafio), de 10 min, com a escola, o aluno e a
`provisoriaExpiraEm` (identifica a provisória sem ser segredo); vai no `Authorization`, nunca na URL. `trocar-senha`
e `/trocas` rodam em `naEscolaSemUsuario` com a escola do bilhete, com escopo no repository; qualquer outra falha, inclusive aluno só com conta externa (contra um hash fixo, no mesmo tempo), é a credencial
inválida. `/trocas` lista as 10 provisórias mais recentes: data, papel de quem
gerou, se usada. A troca é `update … where id = … and provisoria_expira_em = :doBilhete and provisoria_expira_em > now()`;
zero linhas, recusa. A troca e o `desativar` anulam as três colunas.

**Arquivo do titular (D85).** A leitura por alvo traz, numa lista fechada, `aluno.transferido`, `lista.transferida`,
`usuario.nome_corrigido`, `lista.nome_corrigido` (o `lista_nome` só com o nome aprovado, pelo `alunoId` da decisão),
`senha_provisoria.gerada` e `.usada`: ação, entidade, finalidade, data e o papel de quem fez; nunca o id nem o nome do
autor, o `antes` ou o `depois`, nem as leituras. O papel é fixo por ação nas quatro da F2 (coordenação) e vem do `depois` na
`.gerada`; a `.usada` sai uma vez.

**Auditoria.** `convite.enviado` é gravado no pedido ("Enviar", "Reenviar"), autora a coordenação; o job só muda o `envio`. `senha.redefinida` e `conta.email_verificado` vindos de rota anônima gravam um registro por escola em que
a conta tem usuário ativo, com esse usuário como autor e alvo, na mesma transação, no contexto montado no próprio fluxo pelo `usuariosAtivosDaConta`
da conta do token; sem usuário ativo, nenhum. O aceite
de convite grava só na escola do convite.

**Conta da escola do aluno.** `intencao=reivindicar` resolve o acesso pelo token ou código da sala,
na `TenantResolutionRepository`, na escola do slug e no ano em curso, e o guarda no cookie OIDC. No retorno, com domínio
liberado e conta sem ligação, grava `educa_conta_provada` (como o `educa_oidc`, mais `Path=/v1/salas` e 15 min; escola,
acesso e conta, sem e-mail). O pedido confere escola e acesso (senão, cookie inválido), grava `contaExterna` no lugar do
hash (a invariante do `travarPendente` passa a senha ou conta) e apaga o cookie. Aprovar cria o usuário sem senha e a
`conta_externa`, na decisão; conta já ligada a outro aluno: `CONFLITO` sem nome, a transação desfaz e o pedido segue
pendente. `intencao=ligar` exige sessão de aluno.

## 6. Isolamento

Escola vem do contexto; no job, da linha, nunca do payload. Exceção cercada **por arquivo** nas duas guardas
(`ZONAS_DAS_CLASSES_CERCADAS` do `architecture.test.ts` e a regra nova `cerca-envio` de `tools/guardas/camadas.cjs`, com o
`EnvioRepository` no `to` e só `enviar-email.ts` fora; cada uma com fixture que reprova o arquivo vizinho) e no
`docs/modelo-de-dados.md`:
- `link_da_conta`: na API, o `TenantResolutionRepository` (pelo hash e pela conta, como o `codigo_recuperacao`); no
  worker, o `EnvioRepository` (pelo id do job), e o `falhou` de 24 h por um método novo do `ExpurgoDeAcessoRepository`, com `@Unscoped` próprio

O `JobOutboxRepository.inserir` aceita fora de rotina só a lista fechada `SISTEMA_DA_REQUISICAO`
(`sistema.enviar-email-da-conta`), sempre com escola nula, mesmo nascido no aceite; a requisição não ganha `rotinaDoSistema`.

## 7. Dado pessoal

| Item | Resposta |
|---|---|
| Campos | os da seção 3 e o cookie, no `docs/lgpd.md` |
| Log | ids e código; nunca e-mail, token nem resposta do SMTP |
| Auditoria | tabela RF17 do `cenarios.md`; escola e autor na seção 5 |
| Provedor externo | o de e-mail, `suboperador` antes do portão: só dado da equipe |
| Retenção e eliminação | `docs/lgpd.md`, contadores inclusive; autores `set null`; cifrados e `contaExterna` em `COLUNAS_FORA_DO_ARQUIVO`; a lista por alvo na seção 5 |
| DTO | nenhuma saída com cifrado |

## 7b. Conformidade CNE

Sem IA.

## 7c. Carga e falha

| Item | Resposta |
|---|---|
| Caminho quente | login: provisória e conta externa na rajada (`cenarios.md`) |
| Fila | `normal`: `email.enviar-convite`, `sistema.enviar-email-da-conta` (na vaga `vaga:normal:sistema`) |
| Limites e corridas | tabelas do `cenarios.md`; limite por usuário, escola ou conta, nunca só por IP; o que manda e-mail rebaixa |
| Dependência cai | SMTP: `falhou`, "Reenviar"; Redis: o job fica no Postgres e é retomado, sem `falhou` |
| Métrica e alerta | e-mail por resultado e adiamento; provisórias por escola; alerta com runbook: `falhou` acima de 20% em 1 h; adiamento longo: o alerta de idade da fila |

## 9. Frontend

Estados e textos: `cenarios.md`, "Telas"; cada tela atualiza o `docs/interface.md` na sua tarefa.
Professores relê o envio a cada 5 s, só com a aba visível e linha `na_fila` ou `enviando`, e para depois de 5 min. A provisória fica no
menu da linha do aluno aprovado, na aba Alunos da turma. Novas: esqueci (link na entrada da equipe), redefinir,
verificar, trocar a provisória (depois do login), conta da escola na sala e em "Eu".

## 10. Testes

`cenarios.md`.

## 11. Conformidade com as regras

| Regra | Desvio e justificativa | Documento |
|---|---|---|
| 10, item 1 | `link_da_conta` é da conta global, como `codigo_recuperacao` | `docs/modelo-de-dados.md` |
| 10, item 9 | sem escopo, cercado (seção 6): `link_da_conta` | esta seção |
| PRD, "E-mail que volta" | "falhou" é a recusa SMTP; a devolução tardia espera o webhook do provedor (`TODO.md`) | esta seção |

## 12. Premissas não verificadas

- O provedor de e-mail de produção: Joaquim, antes do portão (`docs/decisoes-em-aberto.md`)

## 13. Riscos técnicos

- Quem gera a provisória pode entrar na conta do aluno. Mitigação: o aluno a vê na troca seguinte; auditoria; D81
- `VERIFICACAO_PENDENTE` revela a quem tem o link copiado que o e-mail tem conta: aceito
