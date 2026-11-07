# Revisão de spec — acesso-e-convites

**Subagentes obrigatórios:** `test-engineer`, `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `frontend-reviewer`, `revisor-geral`

PRD, Tech Spec e cenários vêm do F2, revisados lá nas rodadas 1 a 10 (`tasks/prd-onboarding-por-convite/revisao-spec.md`).
Esta revisão confere o desenho contra o código que o F2 deixou na `develop` (abertura, passo 1).

## Conferência com o código do F2 — 07/11/2026

| O que a spec cita | No código | Leitura |
|---|---|---|
| `travarPendente`, `fechar(…, 'encerrada')` | `packages/core/src/estrutura/decisao.repository.ts` (`fechar(onde, 'encerrada')`) | confere |
| `desativar` | `packages/core/src/ciclo-de-vida/ciclo-de-vida.service.ts`; o convite aberto sai em `revogarConviteAberto`, que o código chama de **defesa**: o professor pendente é recusado pelo `desativar` (`NAO_ENCONTRADO`) e o convite dele sai pelo `convite/revogar` da A1 | o "o `desativar` cancela o envio" só alcança o convite pela defesa; o caminho do dia a dia é a revogação |
| `retencao.expurgar-escola`, `sistema.expurgar-acesso` | `apps/worker/src/processors/expurgar-escola.ts`, `expurgar-acesso.ts` | confere |
| `SecretCipher` | `apps/api/src/credencial/secret-cipher.ts` | confere (a spec o muda para `packages/core/src/cripto/`) |
| `ZONAS_DAS_CLASSES_CERCADAS`, `cerca-conta-global` | `apps/api/test/architecture.test.ts`, `tools/guardas/camadas.cjs` | confere |
| `TenantResolutionRepository`, `codigo_recuperacao` | `apps/api/src/sessao/tenant/` | confere |
| `convite_pendente_unico`, `convite/refazer` | `packages/core/drizzle/0015_…`, `apps/api/src/professores/professores.controller.ts` | confere |
| validade do convite de professor | `VALIDADE_DO_CONVITE_HORAS_POR_TIPO.professor = 7 * 24` (`packages/shared/src/sessao/convite.ts`) | confere com o RF11 |
| `educa_oidc`, `oidc-falso`, `conta_externa` | `apps/api/src/credencial/`, `apps/api/src/sessao/external/` | confere; `intencao` ainda não existe |
| `reivindicacao_segredo_so_pendente`, `COLUNAS_FORA_DO_ARQUIVO`, `job_registro` | schema e testes | confere |
| `rl:ip:senha` | não existe; há `rl:ip`, `rl:ip:op` e `rl:ip-login` | balde novo desta spec |
| `EnvioDeEmail`, `nodemailer`, Mailpit, `EMAIL_TOKEN_KEY`, `BILHETE_KEY` | não existem | novos desta spec |
| `convite.int.test.ts` linhas 320, 377 e 447 | existem, com os casos citados | confere |
| caso do RF6 do F2 | `apps/api/test/professores.int.test.ts:900` | confere |
| provedor de e-mail de produção | aberto em `docs/decisoes-em-aberto.md`, "antes do portão da F2c" | segue aberto; segura o portão, não as tarefas |
| D85 (06/11, depois desta Tech Spec) | o arquivo do titular lê só o que o titular fez (`packages/core/src/titular/leitura-do-titular.ts`) | **faltava**: a F2c leva a leitura por alvo com as quatro ações da F2 (achado da rodada 1) |

## Rodada 1 — 07/11/2026

**Veredito: REPROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | REPROVADO | 9 |
| `tenancy-guardian` | REPROVADO | 3 |
| `privacy-guardian` | REPROVADO | 3 |
| `infra-guardian` | REPROVADO | 3 |
| `frontend-reviewer` | AJUSTES NECESSÁRIOS | 5 |
| `revisor-geral` | REPROVADO | 2 |

Nenhuma correção muda critério de aceite do PRD: preenchem o que a Tech Spec deixava implícito, ou aplicam a D85, já
decidida pelo Joaquim. Aviso, não parada (D79).

### Correções exigidas na Tech Spec
- §5 e §7, auditoria: o banco recusa `convite.enviado` gravado pelo job (sem pessoa; `rotina` não assina) e
  `senha.redefinida`/`conta.email_verificado` de rota anônima sobre a conta global (escola nula). Definir escola e autor;
  cenário com conta de duas escolas (test-engineer 4, privacy 3)
- §2, §5 e §7: a D85 inteira, com as quatro ações da F2, por alvo, papel sem id; índice da auditoria pelo alvo (revisor-geral 1,
  privacy 1, infra 2)
- §5 e §6: o `sistema.enviar-email-da-conta` nasce de requisição, e o `JobOutboxRepository.inserir` recusa `sistema.*` fora
  de rotina; declarar o mecanismo sem marcar a requisição como rotina (tenancy 1)
- §5: o bilhete leva a escola, e `/trocas` e `trocar-senha` rodam no escopo dela (tenancy 2); `/trocas` com limite (infra 2)
- §5: trava na geração da provisória, comum ao ligar e ao aprovar com conta; clique duplo não gera segunda senha (infra 1, test-engineer 6)
- §5: `EMAIL_POR_MINUTO` no Redis de fila, consumo atômico, Redis fora adia (infra 3)
- §2, §5: o `desativar` só alcança o convite pela cláusula de defesa (test-engineer 1)
- §1, §2: a porta em inglês, `EmailSender` (D81; revisor-geral 2)
- §7 e `docs/lgpd.md`: os contadores novos no mapa; `rl:ip:senha` em janela de um minuto, como os outros baldes por IP (privacy 2)
- §9 e `cenarios.md`: estados e textos de cada tela, rótulos dos cinco estados do envio, confirmação da provisória com a
  consequência, aviso no "Copiar link" e no "Reenviar", contagem no "Enviar", atualização da lista, 360 px em toda tela nova
  (frontend 1 a 5)
- `cenarios.md`: os casos que faltavam (test-engineer 2, 3, 5, 7, 8, 9; tenancy 3)

### Recomendações
- Bilhete como JWT assinado (`jose`, como o desafio), preso à provisória pela validade, no `Authorization` (revisor-geral, D81): adotada
- `SEM_SENHA` vira `ENTRA_PELA_CONTA_DA_ESCOLA`; a rota da provisória fica em `/v1/usuarios/:usuarioId/senha-provisoria`
  (precedente do `mfa/redefinir`): adotadas
- Trava de configuração do e-mail fora do ambiente local; Mailpit em `127.0.0.1`; token no fragmento; `no-store`: adotadas
- Contratos alterados listados na §4; métrica da provisória na §7c; "senha provisória" no glossário; linha do webhook no `TODO.md`: adotadas
- Cerca nova `cerca-envio` em vez de alargar a `cerca-conta-global`; o `falhou` de 24 h do link da conta pelo `ExpurgoDeAcessoRepository`: adotadas
- Um envio por hora por conta com o balde do IP cheio (infra): não adotada; o teto por e-mail (3/h) e o `EMAIL_POR_MINUTO` já
  limitam, e o balde por IP segue o `docs/infra.md` §5.1

## Rodada 2 — 07/11/2026

**Veredito: REPROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | REPROVADO | 6 |
| `tenancy-guardian` | APROVADO | 0 |
| `privacy-guardian` | APROVADO | 0 |
| `infra-guardian` | REPROVADO | 1 |
| `frontend-reviewer` | APROVADO | 0 |
| `revisor-geral` | APROVADO | 0 |

### Correções exigidas
- Tech Spec §5 "Enviar" e `cenarios.md`: a cota de 300/h consumida atômica por convite que entra, devolvida no 429 e no
  rollback; [I] 40 com 30 restantes, [P] dois lotes de 200 (infra 1)
- `cenarios.md`: homônimos na mesma turma, com a matrícula na confirmação; [P] aprovar × ligar a mesma conta; o verificar
  com conta de duas escolas e o aceite só na escola do convite; troca com a provisória vencida; adiar mais vezes que as
  tentativas; os casos da trava de configuração, do fragmento, do `no-store`, do semáforo e da releitura de 5 s (test-engineer 1 a 6)

### Recomendações adotadas
- `EMAIL_POR_MINUTO` sem o seguro em memória; `CONFLITO` de 10 s de qualquer autor (infra)
- Papel fixo por ação nas quatro da F2; a aprovação resolvida pela `conta_externa` única, fora da trava; `aud` própria do
  bilhete e o desafio recusado como bilhete; `rl:ip:senha` dito direto no `docs/lgpd.md` (revisor-geral, privacy)
- O contexto por escola da auditoria anônima montado no próprio fluxo; o job da conta com escola nula também no aceite;
  `@Unscoped` próprio no método novo do expurgo; a linha da B com o `entidade_id` da A; `:usuarioId` de professor: 404 (tenancy)
- A provisória fora de cache, URL, log e navegador; redefinir volta à entrada, sem login automático; `lista.transferida`
  de nome não aprovado; o autor eliminado (privacy)
- Textos do 429, do `VERIFICACAO_PENDENTE` e do "Tentar de novo" na sala (frontend); os casos recomendados do test-engineer

## Rodada 3 — 07/11/2026

**Veredito: REPROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | REPROVADO | 1 |
| `infra-guardian` | REPROVADO | 1 |

### Correções exigidas
- `cenarios.md` RF11: a cota conta o que entra, não a seleção (seleção de 6 com 2 que entram e 2 pontos restantes) (test-engineer 1)
- Tech Spec §5 "E-mail": adiar libera a vaga, volta a `publicado`, não conta tentativa nem uso, espera o `msBeforeNext`
  com variação; dois [I] em RF11 (infra 1)

### Recomendações adotadas
- `typ` e `aud` do bilhete provados um de cada vez, e a direção contrária; `.gerada` por professor no arquivo; usuário
  desativado entre o link e o redefinir; barreira nos [P] de trava; o `CONFLITO` não gasta cota; métricas e
  `vaga:normal:sistema` (test-engineer)
- Cota de 300/h num limitador novo no Redis de fila, Redis fora: seguro em memória; Redis fora no §7c; a releitura de 5 s
  para em 5 min (infra)

## Rodada 4 — 07/11/2026

**Veredito: REPROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | REPROVADO | 1 |
| `infra-guardian` | APROVADO | 0 |

### Correções exigidas
- Tech Spec §5 "E-mail": o teto da variação (até 5 s; Redis fora, 30 s de base); `cenarios.md` RF11: [U] com o sorteio
  injetado e o [I] com a faixa (test-engineer 1)

### Recomendações adotadas
- O ponto do `EMAIL_POR_MINUTO` sem envio volta; a espera com o Redis fora (infra)
- "A cota zera" observada por um 429 seguinte; a janela de 1 h com relógio falso; Redis fora sem `falhou` e retomado; as
  instâncias injetadas no teste (test-engineer)

## Rodada 5 — 07/11/2026

**Veredito: APROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | APROVADO | 0 |

Com a rodada 2 (`tenancy-guardian`, `privacy-guardian`, `frontend-reviewer`, `revisor-geral`) e a 4 (`infra-guardian`),
todos os revisores com APROVADO. Tamanho: PRD 1.097 palavras, Tech Spec 2.000.

### Recomendações adotadas (no `cenarios.md`)
- O [I] do ponto devolvido com `EMAIL_POR_MINUTO` = 1, também no link da conta; só se devolve na mesma janela; a
  tentativa recusada pelo SMTP conta como envio (test-engineer)

### Para o `criar-tasks`
- O provedor de e-mail de produção segue aberto (`docs/decisoes-em-aberto.md`): segura o portão da spec, não as tarefas
- As frases da seção "Telas" vão às tarefas de tela; cada uma atualiza o `docs/interface.md`

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-07 10:38:16 | 2026-11-07 10:39:12 | `frontend-reviewer` | 1 | AJUSTES NECESSÁRIOS | a385be92844554081 |
| 2026-11-07 10:38:01 | 2026-11-07 10:41:29 | `test-engineer` | 1 | REPROVADO | a2d14814c017b3c93 |
| 2026-11-07 10:38:07 | 2026-11-07 10:41:42 | `privacy-guardian` | 1 | REPROVADO | a5a8aeb5404cca5fe |
| 2026-11-07 10:38:05 | 2026-11-07 10:41:57 | `tenancy-guardian` | 1 | REPROVADO | a425240af0aa2baec |
| 2026-11-07 10:38:11 | 2026-11-07 10:42:10 | `infra-guardian` | 1 | REPROVADO | a328b151bd95951e0 |
| 2026-11-07 10:38:20 | 2026-11-07 10:43:07 | `revisor-geral` | 1 | REPROVADO | a9bc950db6e1fa896 |
| 2026-11-07 10:47:45 | 2026-11-07 10:48:00 | `frontend-reviewer` | 2 | APROVADO | a378083340ef3f7a5 |
| 2026-11-07 10:47:42 | 2026-11-07 10:49:34 | `infra-guardian` | 2 | REPROVADO | a024c6bc6fe460339 |
| 2026-11-07 10:47:50 | 2026-11-07 10:49:47 | `revisor-geral` | 2 | APROVADO | a56fb1fa352938532 |
| 2026-11-07 10:47:33 | 2026-11-07 10:49:49 | `tenancy-guardian` | 2 | APROVADO | aee6ae92087498c6c |
| 2026-11-07 10:47:37 | 2026-11-07 10:49:58 | `privacy-guardian` | 2 | APROVADO | aa71dfe0cc63393f1 |
| 2026-11-07 10:47:30 | 2026-11-07 10:50:30 | `test-engineer` | 2 | REPROVADO | ae1567832416e6ad0 |
| 2026-11-07 10:52:13 | 2026-11-07 10:54:24 | `test-engineer` | 3 | REPROVADO | a1f2997b5b0636e7b |
| 2026-11-07 10:52:18 | 2026-11-07 10:54:37 | `infra-guardian` | 3 | REPROVADO | a0e9579c3980276e8 |
| 2026-11-07 10:55:30 | 2026-11-07 10:56:12 | `infra-guardian` | 4 | APROVADO | a666841147749256e |
| 2026-11-07 10:55:28 | 2026-11-07 10:56:21 | `test-engineer` | 4 | REPROVADO | a89cf963be298fb58 |
| 2026-11-07 10:56:54 | 2026-11-07 10:57:37 | `test-engineer` | 5 | APROVADO | aa48bbab401e1cf05 |
