# Tech Spec — A equipe e o aluno entram sem depender de ninguém

**PRD:** `tasks/prd-acesso-e-convites/prd.md`
**Status:** aprovada como parte da Tech Spec do F2 (`tasks/prd-onboarding-por-convite/revisao-spec.md`, rodadas 1 a 8);
separada dela no corte de 03/11/2026 (Joaquim), sem mudar regra
**Depende de:** F2 (`onboarding-por-convite`): `packages/core/src/estrutura/` (o `travarPendente`, o `fechar('encerrada')` e
o cadastro do professor), o `desativar` que encerra os vínculos na ordem global, e o `retencao.expurgar-escola` e o
`sistema.expurgar-acesso` com os alvos da importação
**Cenários:** `tasks/prd-acesso-e-convites/cenarios.md`

## 1. Resumo da abordagem

O e-mail sai pela porta `EnvioDeEmail` (SMTP, Mailpit no compose), em job; a API grava token e endereço cifrados na
linha. No worker, a conta global só se alcança pelas exceções da seção 6 e pelo ciclo de vida.

## 2. Módulos afetados

| Módulo | Novo ou alterado | O quê |
|---|---|---|
| `packages/core/src/cripto/` | novo, por mudança de lugar | o `SecretCipher`, de `apps/api/src/credencial/` |
| `packages/core/src/email/` | novo | porta, adaptadores SMTP (`nodemailer`, sem `logger` nem `debug`) e falso; `EnvioRepository` |
| `apps/api/src/professores/`, `sessao/`, `sala/`, `credencial/` | alterado | rotas; seção 5 |
| `apps/worker/src/processors/`, `packages/core/src/titular/` | alterado | `enviar-email.ts`, os dois expurgos (seção 5); leitura por alvo |
| `packages/core/src/ciclo-de-vida/` | alterado | o `desativar` também cancela o envio e anula a provisória |
| `packages/shared/`; `apps/web`, `compose.yaml` | alterado | contratos das rotas novas (seção 4) e os códigos `SEM_SENHA` e `VERIFICACAO_PENDENTE`; seção 9; `mailpit` |

## 3. Modelo de dados

```
link_da_conta        contaId* (on delete cascade), finalidade (redefinir|verificar), tokenHash único, tokenCifrado?,
                     destinoCifrado?, expiraEm, usadoEm?, envio, criadoEm; único parcial (contaId, finalidade) aberto;
                     índice (coalesce(usadoEm, expiraEm))
convite              + canal text not null default 'copiado' (check copiado|email), tokenCifrado?, destinoCifrado?, envio?, enviadoEm?
conta                + emailVerificadoEm?
credencial_matricula + provisoriaHash?, provisoriaExpiraEm?, provisoriaGeradaPor? (set null); índice parcial (escolaId, provisoriaExpiraEm)
reivindicacao        + contaExterna jsonb? (provedor, tenant, sujeito); único parcial (escolaId, provedor, tenant, sujeito) onde pendente
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
| POST | `/v1/alunos/:usuarioId/senha-provisoria` | coordenador; professor da turma | — | `{ senha, expiraEm }` |
| POST | `/v1/sessao/matricula/trocar-senha` | bilhete | `{ bilhete, senha }` | sessão |
| GET | `/v1/sessao/matricula/trocas` | bilhete | — | provisórias anteriores: data, papel, se usada |
| POST | `/v1/senha/esqueci`, `/redefinir`; `/v1/conta/verificar` | anônimo | `{ email }`; `{ token, senha }`; `{ token }` | 202; 204; 204 |
| GET | `/v1/sessao/externa/:provedor/iniciar?intencao=reivindicar\|ligar` | a rota que existe | — | redirecionamento |

Professores ganha `envio`. "Enviar", "Reenviar" e o "Copiar link" fazem o `convite/refazer` (linha nova).

## 5. Fluxo

**E-mail.** `email.enviar-convite` leva a escola do convite no registro do job e lê o convite por id e escola.
`sistema.enviar-email-da-conta`, de escola nula, lê e grava o `link_da_conta` só no `EnvioRepository`,
`@Unscoped('o link é da conta global: lido pelo id do job')`. Os dois conferem o `EMAIL_POR_MINUTO` (global, com metade
reservada ao link da conta; estourado, adia sem gastar tentativa) e reservam a linha numa transação curta (`enviando`,
hora da reserva, lê os cifrados); reserva alheia vigente: adia até o prazo. Enviam fora da transação (timeout de 10 s) e
gravam `enviado`, cifrados nulos, `where envio = 'enviando' and envioReservadoEm = :minha`. A revogação, o `desativar` e
o link novo gravam `cancelado` na hora: o link que sair não vale. SMTP 5xx: `falhou`; 4xx ou queda: devolve a linha a
`na_fila` (mesma condição) e tenta de novo, depois `falhou`. Morto após enviar: reenvia (D49).

| Estado | Entra | Sai | Prazo e falha |
|---|---|---|---|
| envio `na_fila`, `enviando` | enviar, refazer, esqueci, aceite pendente; a reserva | o job de e-mail | reserva de mais de 2 min volta a ser retomada; mais de 24 h: o expurgo grava `falhou` e anula os cifrados (até ~48 h) |
| `enviado`, `falhou`, `cancelado` | o job; a revogação ou o link novo, na hora | — | o do convite ou do link |

Convite parado e provisória vencida (as três colunas nulas): o `retencao.expurgar-escola` (1h, por escola, com escopo);
o `link_da_conta`: o `sistema.expurgar-acesso`. Todos com `skip locked`.

**Posse do e-mail.** O aceite de convite de canal `email` grava `emailVerificadoEm`. Conta com senha e sem verificação que
aceita convite copiado de outra escola (o do painel também): `VERIFICACAO_PENDENTE` e link de `verificar` (24 h) no lugar
do aberto, como no "esqueci", com teto de 3 por hora por conta, que rebaixa. Verificada, o aceite segue. Redefinir
também verifica.

**Esqueci.** 202 igual, piso de 400 ms, inclusive no perdedor do índice único; conta ativa ganha link (1 h). Redefinir
confere o token antes do argon2, troca a senha com a conta travada, encerra as sessões e verifica o e-mail; o MFA fica.

**Senha provisória.** Oito caracteres de `23456789ABCDEFGHJKMNPQRSTUVWXYZ`, em dois grupos. Gerar confere o escopo e a
conta ligada antes de apagar `senha_hash` e a provisória anterior, encerra as sessões e audita (papel de quem gerou no
`depois`); conta da escola ligada: `SEM_SENHA` (PRD §7). O login com a provisória devolve
`{ etapa: 'trocar_senha', bilhete }` (10 min, cifrado com `BILHETE_KEY`, com o aluno e o hash da provisória, nunca na
URL); qualquer outra falha, inclusive aluno só com conta externa (contra um hash fixo, no mesmo tempo), é a credencial
inválida. `/trocas`, com o bilhete conferido como na troca, lista as provisórias anteriores: data, papel de quem gerou, se
usada. A troca é `update … where id = … and provisoria_hash = :doBilhete and provisoria_expira_em > now()`; zero linhas,
recusa. A troca e o `desativar` anulam as três colunas. `senha_provisoria.gerada` e `.usada` (autor: o aluno) entram no
arquivo do titular, por alvo, sem quem gerou.

**Conta da escola do aluno.** `intencao=reivindicar` guarda no cookie OIDC o acesso da turma. No retorno, com domínio
liberado e conta sem ligação, grava `educa_conta_provada` (como o `educa_oidc`, mais `Path=/v1/salas` e 15 min; escola,
acesso e conta, sem e-mail). O pedido confere escola e acesso (senão, cookie inválido), grava `contaExterna` no lugar do
hash (a invariante do `travarPendente` passa a senha ou conta) e apaga o cookie. Aprovar cria o usuário sem senha e a
`conta_externa`, na decisão. `intencao=ligar` exige sessão de aluno.

## 6. Isolamento

Escola vem do contexto; no job, da linha, nunca do payload. Uma exceção, cercada **por arquivo** nas duas guardas
(`ZONAS_DAS_CLASSES_CERCADAS` do `architecture.test.ts` e `cerca-conta-global` de `tools/guardas/camadas.cjs`, cada uma
com fixture que reprova o arquivo vizinho) e no `docs/modelo-de-dados.md`:
- `link_da_conta`: na API, o `TenantResolutionRepository` (pelo hash e pela conta, como o `codigo_recuperacao`); no
  worker, o `EnvioRepository` (pelo id do job), zona `enviar-email.ts` e o expurgo de acesso

Os casos estão no `cenarios.md`.

## 7. Dado pessoal

| Item | Resposta |
|---|---|
| Campos | os da seção 3 e o cookie, no `docs/lgpd.md` (escritos na revisão do F2) |
| Log | ids e código; nunca e-mail, token nem resposta do SMTP |
| Auditoria | a tabela RF17 do `cenarios.md`, uma linha por ação |
| Provedor externo | o de e-mail, `suboperador` antes do portão: endereço e texto da equipe, nunca de aluno |
| Retenção e eliminação | `docs/lgpd.md`; autores `set null`; cifrados e `contaExterna` em `COLUNAS_FORA_DO_ARQUIVO` |
| DTO | seção 4; nenhuma saída com cifrado |

## 7b. Conformidade CNE

Sem IA.

## 7c. Carga e falha

| Item | Resposta |
|---|---|
| Caminho quente | login: provisória e conta externa entram na rajada do login (seção "Carga" do `cenarios.md`) |
| Fila | `normal`: `email.enviar-convite`, `sistema.enviar-email-da-conta` |
| Limites e corridas | tabelas do `cenarios.md`; limite por usuário, escola ou conta, nunca só por IP; o que manda e-mail rebaixa |
| Dependência cai | SMTP: `falhou`, "Reenviar"; Redis: o job espera no Postgres |
| Métrica e alerta | e-mail por resultado; alerta com runbook: `falhou` acima de 20% em 1 h |

## 9. Frontend

Professores mostra o estado do envio; "Enviar" avisa que os links anteriores caducam. A provisória confirma nome e turma
antes de gerar. Telas novas: esqueci, redefinir, verificar, trocar a provisória, conta da escola na sala e em "Eu"; cada
uma atualiza o `docs/interface.md`.

## 10. Testes

Um teste por cláusula, no `cenarios.md`; e2e em `chromebook` e `celular`, com axe.

## 11. Conformidade com as regras

| Regra | Desvio e justificativa | Documento |
|---|---|---|
| 10, item 1 | `link_da_conta` é da conta global, como `codigo_recuperacao` | `docs/modelo-de-dados.md` |
| 10, item 9 | sem escopo, cercado (seção 6): `link_da_conta` | esta seção |
| PRD, "E-mail que volta" | "falhou" é a recusa na entrega SMTP; a devolução tardia espera o webhook do provedor escolhido (`TODO.md`) | esta seção |

## 12. Premissas não verificadas

- O provedor de e-mail de produção: Joaquim, antes do portão (`docs/decisoes-em-aberto.md`)

## 13. Riscos técnicos

- Quem gera a provisória pode entrar na conta do aluno. Mitigação: na troca seguinte, o aluno vê a provisória que outro
  usou; auditoria e arquivo do titular; padrão de mercado (D81)
- `VERIFICACAO_PENDENTE` revela, a quem tem o link copiado, que o e-mail tem conta: aceito
