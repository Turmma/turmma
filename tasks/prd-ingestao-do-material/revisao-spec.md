# Revisão de spec — ingestao-do-material

**Subagentes obrigatórios:** `test-engineer`, `tenancy-guardian`, `privacy-guardian`, `infra-guardian`, `conformidade-reviewer`, `frontend-reviewer`, `revisor-geral`

## Rodada 1 — 11/11/2026

**Veredito: REPROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | REPROVADO | 18 |
| `tenancy-guardian` | REPROVADO | 1 |
| `privacy-guardian` | REPROVADO | 3 |
| `infra-guardian` | REPROVADO | 5 |
| `conformidade-reviewer` | REPROVADO | 2 |
| `frontend-reviewer` | AJUSTES NECESSÁRIOS | 4 |
| `revisor-geral` | REPROVADO | 7 |

### Correções exigidas na Tech Spec
- §5 Envio: o PDF fica órfão para sempre quando a transação falha (a varredura parte da linha). Id gerado na aplicação, bytes antes da transação e apagados no `catch`, regra de expiração do bucket no prefixo (infra, test-engineer, revisor-geral)
- §5 Envio e edição: a licença é conferida antes de ler o arquivo, com `material.recusado` fora da transação que desfaz; a transação reconfere (test-engineer, revisor-geral)
- §5 Busca: o filtro de série e de licença vale também em `paginasDoMaterial` (página aberta do Tutor), em `materialDaTurma` e na rota `GET /v1/materiais/busca`; "hoje" vem do `Clock`; `vigente_desde` também (revisor-geral, tenancy, infra, test-engineer)
- §5 Tutor: a checagem de material da série roda depois do encaminhamento de assunto delicado (D36), e o caminho escolhido não deixa troca com o Tutor invisível ao professor; dizer o modo livre (conformidade)
- §2: o repository do material (a parte da extração) vai para o `packages/core`, porque o worker não importa a API (revisor-geral)
- §3: FK de `substitui_id` e `substituido_por` com `set null`, senão o expurgo do material excluído trava; FK composta de `registrada_por` com `set null`; `unique (escola_id, id)` na licença; licença com retenção, classificação e saída no expurgo (privacy, tenancy)
- §3: o check `(titularidade = terceiro) = (licenca_id is not null)` e a saída de `licenciante` vão para a contração, num release posterior; o código novo continua gravando `licenciante` (infra)
- §4 e §6: série de outra escola no envio responde igual à inexistente, conferida antes de gravar; `serieIds` repetidas (tenancy, privacy, test-engineer)
- §4: `recusadosEm30Dias` por disciplina e série, com as séries na auditoria `material.recusado` (frontend, revisor-geral)
- §7c: edição só sobre material `pronto`, com `for update` do alvo na transação (corrida com a substituição) (infra, test-engineer, revisor-geral)
- §7c: os tetos de envio deixam entrar 300 apostilas, e o cenário de carga passa pela rota real, com limites para a outra escola e controle negativo (infra, test-engineer, revisor-geral, frontend)
- §7c: a vaga por escola é por fila, não por tipo; o alerta `pdf-esperando` dispararia em todo onboarding (infra)
- §5 Capítulos: marcador fora de ordem, título vazio ou longo, número grande, cabeçalho corrido e sumário não derrubam a extração (test-engineer)
- §9: textos do 429, 503 e dos erros novos; `capitulos` só no `GET /:id`; lista paginada na tela; o sexto tipo do sino no `docs/interface.md` (frontend, infra)
- §10: os cenários por RF, por corrida (com a ordem forçada e a troca que deixa vermelho), por chamador da busca, de permissão, de escola sem ano letivo, de vínculo encerrado, da migração e da onda 3b, linha a linha (test-engineer)

### Recomendações
- `ops:reprocessar-job` recusa `material.extrair-pdf`; `sem_texto` e `arquivo_invalido` são falha definitiva (infra, test-engineer)
- `fontes` sem a linha do material (depois do expurgo) mostram "material da escola", registrado como limite do RF11 (conformidade, test-engineer)
- `ChapterReader` no lugar de `LeitorDeCapitulos` (D81, revisor-geral)
- A nota do corte no PRD volta a mandar à F4b a classificação do RF20 e as perguntas da BNCC (revisor-geral)

## Rodada 2 — 11/11/2026

**Veredito: REPROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | REPROVADO | 5 |
| `tenancy-guardian` | REPROVADO | 2 |
| `privacy-guardian` | REPROVADO | 2 |
| `infra-guardian` | REPROVADO | 3 |
| `conformidade-reviewer` | REPROVADO | 1 |
| `frontend-reviewer` | AJUSTES NECESSÁRIOS | 2 |
| `revisor-geral` | REPROVADO | 1 |

Os bloqueantes da rodada 1 foram atendidos; os de agora nasceram das correções.

### Correções exigidas na Tech Spec
- §5 Envio: a queda entre o upload e o commit cumpre as 25 h do RF13 sem a expiração do bucket (premissa não verificada; o storage do compose é o SeaweedFS). Registro do envio pendente antes do upload, achado pela varredura; objeto ausente no `lerBytes` é falha definitiva com código próprio (infra, privacy, test-engineer, revisor-geral)
- §5 e §6: toda leitura do alvo da edição, inclusive o `for update` e a do passo 1, com `escola_id` do contexto; alvo de outra escola responde `NAO_ENCONTRADO` antes de qualquer outra conferência (tenancy)
- §5 Tutor: o filtro do material em `materialDaTurma` não passa na frente da D36 (conformidade)
- §3 Retenção: a licença só sai sem nenhuma linha de material que a cite, inclusive excluída (privacy)
- §4 e §5 `PATCH`: `for update` do material; `serieIds` validadas como no envio; sobre material com edição em andamento, `EDICAO_EM_ANDAMENTO` (test-engineer, infra, tenancy)
- §7c: `pdf-parado` com o job mais antigo pendente há 15 min **e** nenhuma extração nos últimos 15; `prazoMs` e tentativas declarados (infra)
- §9: texto do 429; o item do sino com texto, destino, sem número por pessoa, sumindo com a vigência atualizada (frontend)
- `cenarios.md`: isolamento da edição sobre material da B em `processando` e com licença vencida, e do `PATCH` com série da B; D36 com página de edição substituída e de licença vencida; licença citada por material excluído; fila `pdf` com duas escolas e a configuração; alerta; corridas do `PATCH`; camada [U] ou [E] em cada item de tela e os quatro estados de cada peça nova (todos)

### Recomendações
- §5 Leitura: "material próprio, sem licença, **ou** licença vigente" (infra)
- §5: os tetos reconferidos sob a trava de envios, como hoje; a recusa reconferida na transação também grava `material.recusado` (test-engineer, revisor-geral)
- §11: a correção de série do RF6 fica na F4, porque o backfill precisa dela (revisor-geral)
- `worker-pdf` com um PDF por vez e limite de CPU no compose (infra)
- RF8 diz "o Tutor diz"; a spec escolheu um estado da tela, sem fala da IA, que é o caminho mais seguro (conformidade)

## Rodada 3 — 11/11/2026

**Veredito: REPROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | REPROVADO | 2 |
| `tenancy-guardian` | APROVADO | 0 |
| `privacy-guardian` | REPROVADO | 1 |
| `infra-guardian` | REPROVADO | 2 |
| `conformidade-reviewer` | APROVADO | 0 |
| `frontend-reviewer` | APROVADO | 0 |
| `revisor-geral` | REPROVADO | 1 |

### Correções exigidas na Tech Spec
- §5 Envio (4): o objeto sai primeiro, e a linha de `envio_de_material` só depois de o apagar dar certo (objeto já ausente conta); se falha, a linha fica para a varredura, que segue a mesma ordem. O 503 do storage é "nada em `material`", não "nada gravado"; cenário com o `apagar` falhando no `catch` e na varredura (privacy, infra, test-engineer, revisor-geral)
- §5 (3): as séries herdadas pela edição são lidas do alvo dentro da transação, depois do `for update`; o [P] com a edição parada depois do `guardarBytes` e o `PATCH` confirmando (test-engineer)
- §11: o `pdf-esperando` da 45.0 não é criado; no lugar, o `pdf-parado` (infra)

### Recomendações
- §5 (3): a transação exige que o `delete` de `envio_de_material` apague uma linha, ou desfaz com 503 (a varredura chegou antes) (infra, test-engineer, revisor-geral)
- `arquivo_ausente` em `FALHAS_DE_MATERIAL`, com texto; de material já excluído, conclui sem efeito (test-engineer, revisor-geral)
- `pdf-parado` conta extração `pronto` ou `falhou`; o `PATCH` com limite próprio, fora do teto de envios; `PATCH` sobre excluído ou substituído: `NAO_ENCONTRADO` (infra, revisor-geral)
- `envio_de_material` classificada sem pessoa; licença do backfill cujos materiais já estavam todos excluídos ganha `vigente_ate` na última exclusão (privacy, revisor-geral)
- O despachante também lê `VAGAS_ESCOLA_PDF`; o controle negativo da carga mede a espera do PDF da escola B (test-engineer)
- §11: o RF8 virou um estado da tela, sem fala do Tutor (conformidade, revisor-geral)

## Rodada 4 — 11/11/2026

**Veredito: REPROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `test-engineer` | APROVADO | 0 |
| `privacy-guardian` | APROVADO | 0 |
| `infra-guardian` | REPROVADO | 1 |
| `revisor-geral` | REPROVADO | 1 |

### Correções exigidas na Tech Spec
- §5 (4): falha do próprio `guardarBytes` (prazo ou erro) tenta apagar o objeto e **deixa** a linha para a varredura, porque o PUT atrasado ainda pode gravar; nas falhas depois de o `guardarBytes` confirmar, a ordem atual (infra)
- §5 Extração: objeto ausente em material que já saiu de `processando` conclui sem efeito; só o `processando` não excluído vai a `falhou` com `arquivo_ausente`, pela transição de sempre; [P] com dois jobs do mesmo material (revisor-geral)

### Recomendações
- A varredura trava a linha com `for update skip locked` antes de apagar o objeto (infra, test-engineer, revisor-geral)
- §3: o check `material_falha_valida` ganha `arquivo_ausente`, com `NOT VALID` e `VALIDATE` (revisor-geral)
- `PATCH` com limite por pessoa também, e texto próprio do 429 (revisor-geral)
- `VAGAS_ESCOLA_PDF` no compose do worker e do despachante; mutação no [P] do material excluído (test-engineer)

## Rodada 5 — 11/11/2026

**Veredito: REPROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `infra-guardian` | REPROVADO | 1 |
| `revisor-geral` | APROVADO | 0 |

### Correções exigidas na Tech Spec
- §5 Extração e §3: o valor novo `arquivo_ausente` quebra a lista de materiais do código anterior na volta (regra 80, item 9). Objeto ausente passa a gravar `extracao_falhou`, que existe; nenhum valor novo de falha. O runbook ganha "Voltar o código depois da F4", com o [I] da volta em "Migração" (infra)

### Recomendações
- `lock_timeout` curto no `delete` da linha de envio e prazo curto no `apagar` da varredura (infra, revisor-geral)
- A transição da extração escrita com `escola_id` por extenso; o 429 do `PATCH` no [U] de textos (revisor-geral)

## Rodada 6 — 11/11/2026

**Veredito: APROVADA**

| Revisor | Veredito | Bloqueantes |
|---|---|---|
| `infra-guardian` | APROVADO | 0 |

Último veredito de cada revisor: `frontend-reviewer`, `conformidade-reviewer` e `tenancy-guardian` na rodada 3;
`test-engineer` e `privacy-guardian` na 4; `revisor-geral` na 5; `infra-guardian` na 6. Todos APROVADO.

### Recomendações, para as tarefas
- O [I] da volta do código usa uma cópia congelada do schema anterior, com mutação; métrica e log com `arquivo_ausente` à parte de `extracao_falhou`; o runbook diz a ordem e o que o `varrerParados` antigo faz (infra)
- `lockDuration` e stalled da fila `pdf`; o disco do temporário no pior caso (cerca de 60 GB) em `docs/infra.md` (infra)
- Retomada do envio depois do 429 (automática ou botão); reler licenças ao abrir e ao voltar o foco (frontend)
- A conferência do Tutor depois do `202` também aplica o filtro novo, com um [P]; o código do `enviar` para página fora do alcance; RF8 alinhado; contagem de recusas por turma; `docs/regulacao.md` §5 apontando a licença (conformidade)
- Justificativa do `@Unscoped` novo no texto da 45.0, no mesmo método da varredura; `PATCH` fora da escola responde `NAO_ENCONTRADO` antes de `EDICAO_EM_ANDAMENTO` (tenancy, privacy)
- Licenças "registradas antes da F4" destacadas para revisão; `docs/lgpd.md` diz que a licença sem fim fica até a coordenação encerrar; PRD §8 alinhado à TS §3 (privacy)
- O 429 do `PATCH` no [U] de textos; a mutação do [P] do material excluído (revisor-geral, test-engineer)

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-11 10:18:37 | 2026-11-11 10:19:30 | `frontend-reviewer` | 1 | AJUSTES NECESSÁRIOS | a5739c6e66d82ee77 |
| 2026-11-11 10:18:33 | 2026-11-11 10:20:21 | `conformidade-reviewer` | 1 | REPROVADO | a15cc929867949e5b |
| 2026-11-11 10:18:23 | 2026-11-11 10:20:33 | `tenancy-guardian` | 1 | REPROVADO | a83073493f6bf80c4 |
| 2026-11-11 10:18:26 | 2026-11-11 10:20:35 | `privacy-guardian` | 1 | REPROVADO | a5fc2f16d8e25ae43 |
| 2026-11-11 10:18:31 | 2026-11-11 10:23:15 | `infra-guardian` | 1 | REPROVADO | a65b44a6154c00ee7 |
| 2026-11-11 10:18:19 | 2026-11-11 10:23:39 | `test-engineer` | 1 | REPROVADO | ac4b6bcc82da4d9e4 |
| 2026-11-11 10:18:41 | 2026-11-11 10:24:05 | `revisor-geral` | 1 | REPROVADO | a4da6e3c234d31aef |
| 2026-11-11 10:32:21 | 2026-11-11 10:32:44 | `frontend-reviewer` | 2 | AJUSTES NECESSÁRIOS | a44cf51f03eceb213 |
| 2026-11-11 10:32:03 | 2026-11-11 10:33:52 | `tenancy-guardian` | 2 | REPROVADO | afb7702308f5fb8d6 |
| 2026-11-11 10:32:17 | 2026-11-11 10:34:13 | `conformidade-reviewer` | 2 | REPROVADO | ae2c1fae2e4d9e102 |
| 2026-11-11 10:32:07 | 2026-11-11 10:35:14 | `privacy-guardian` | 2 | REPROVADO | afc350b4c2d1bfd88 |
| 2026-11-11 10:32:25 | 2026-11-11 10:35:57 | `revisor-geral` | 2 | REPROVADO | a0dfb2f9d15912d92 |
| 2026-11-11 10:31:58 | 2026-11-11 10:36:15 | `test-engineer` | 2 | REPROVADO | a56c98a3b8fb6c7ba |
| 2026-11-11 10:32:12 | 2026-11-11 10:36:41 | `infra-guardian` | 2 | REPROVADO | a7d8006b97886a3f0 |
| 2026-11-11 10:41:17 | 2026-11-11 10:41:36 | `frontend-reviewer` | 3 | APROVADO | a454d977900351e04 |
| 2026-11-11 10:41:12 | 2026-11-11 10:42:03 | `conformidade-reviewer` | 3 | APROVADO | a319e4d6cbab5d6b7 |
| 2026-11-11 10:40:58 | 2026-11-11 10:42:14 | `tenancy-guardian` | 3 | APROVADO | a5562e04af78496f6 |
| 2026-11-11 10:41:02 | 2026-11-11 10:43:06 | `privacy-guardian` | 3 | REPROVADO | a8cb9f1099e8d137d |
| 2026-11-11 10:41:08 | 2026-11-11 10:43:35 | `infra-guardian` | 3 | REPROVADO | ab68e86f488752c25 |
| 2026-11-11 10:40:53 | 2026-11-11 10:43:45 | `test-engineer` | 3 | REPROVADO | af1f0f66235aeda69 |
| 2026-11-11 10:41:23 | 2026-11-11 10:44:38 | `revisor-geral` | 3 | REPROVADO | a2592e03859f34071 |
| 2026-11-11 10:46:27 | 2026-11-11 10:47:27 | `privacy-guardian` | 4 | APROVADO | a3d975cba61a46ddc |
| 2026-11-11 10:46:32 | 2026-11-11 10:47:29 | `infra-guardian` | 4 | REPROVADO | a02ffc83c54456ca4 |
| 2026-11-11 10:46:22 | 2026-11-11 10:47:43 | `test-engineer` | 4 | APROVADO | a7e38e9b3c276867d |
| 2026-11-11 10:46:37 | 2026-11-11 10:49:01 | `revisor-geral` | 4 | REPROVADO | ae1e604dddd89b296 |
| 2026-11-11 10:50:25 | 2026-11-11 10:51:39 | `revisor-geral` | 5 | APROVADO | ae44f5ff933324ed8 |
| 2026-11-11 10:50:20 | 2026-11-11 10:51:59 | `infra-guardian` | 5 | REPROVADO | acac84479097adb11 |
| 2026-11-11 10:53:10 | 2026-11-11 10:54:27 | `infra-guardian` | 6 | APROVADO | abfd7f7d64f0428fc |
