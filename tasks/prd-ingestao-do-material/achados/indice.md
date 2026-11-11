# Índice dos achados das revisões

Uma linha por rodada que exigiu alguma coisa. O texto inteiro está no arquivo do documento, nesta
pasta (`<documento>.md`), no bloco com o mesmo fim. Escrito pelo hook `tools/processo/revisoes.ts`.
Não edite à mão.

Leia este índice antes de codar, e abra só os blocos que interessam à tarefa de agora.

| Fim | Revisor | Rodada | Veredito | Documento | O que exigiu |
|---|---|---|---|---|---|
| 2026-11-11 10:19:30 | `frontend-reviewer` | 1ª | AJUSTES NECESSÁRIOS | `revisao-spec` | Seção 7c, seção 9 e RF14 (limite de envio sem tratamento na tela). |
| 2026-11-11 10:20:21 | `conformidade-reviewer` | 1ª | REPROVADO | `revisao-spec` | Seção 5, "Busca", ordem em relação à D36. A spec manda checar `existeMaterialDaSerie(disciplinaId, serieId)` "antes de chamar o modelo" e devolver ao Tutor "a… |
| 2026-11-11 10:20:33 | `tenancy-guardian` | 1ª | REPROVADO | `revisao-spec` | techspec.md seção 6 ("`serieIds` de B;") e seção 4 (POST /v1/materiais): o caso de isolamento da série não tem resultado esperado, e a Tech Spec não diz como… |
| 2026-11-11 10:20:35 | `privacy-guardian` | 1ª | REPROVADO | `revisao-spec` | A licença não tem retenção, classificação nem saída na eliminação. (§3, `licenca_de_material`; §7, "Retenção e expurgo") |
| 2026-11-11 10:23:15 | `infra-guardian` | 1ª | REPROVADO | `revisao-spec` | techspec §5 "Envio" e §7c "Quando cada dependência cai": o PDF fica órfão para sempre se o commit falha. |
| 2026-11-11 10:23:39 | `test-engineer` | 1ª | REPROVADO | `revisao-spec` | O envio deixa PDF órfão no storage, e nenhum teste pega isso (seção 5, "Envio"; seção 7c). |
| 2026-11-11 10:24:05 | `revisor-geral` | 1ª | REPROVADO | `revisao-spec` | §5 "Busca" e §6, RF7, RF8 e RF17: o filtro por série e por licença vigente só cobre a busca por texto. O desenho põe os dois filtros em… |
| 2026-11-11 10:32:44 | `frontend-reviewer` | 2ª | AJUSTES NECESSÁRIOS | `revisao-spec` | Seção 9 e `cenarios.md` "Telas" (texto do 429). |
| 2026-11-11 10:33:52 | `tenancy-guardian` | 2ª | REPROVADO | `revisao-spec` | Tech Spec §5 "Envio e edição", passos (1) e (3), e `cenarios.md` "Isolamento". |
| 2026-11-11 10:34:13 | `conformidade-reviewer` | 2ª | REPROVADO | `revisao-spec` | Seção 5, "Leitura de página", e seção 7b. O filtro de série, de licença e de substituição em `materialDaTurma` passa na frente da D36. |
| 2026-11-11 10:35:14 | `privacy-guardian` | 2ª | REPROVADO | `revisao-spec` | §3 "Retenção" (problema novo): a licença sai "contada do mais tardio entre vigente_ate e a exclusão do último |
| 2026-11-11 10:35:57 | `revisor-geral` | 2ª | REPROVADO | `revisao-spec` | Tech Spec §5 "Envio e edição" (4) e §7, linha "Retenção e expurgo": prazo do órfão de 48 h contra os 25 h do PRD, sem registro. |
| 2026-11-11 10:36:15 | `test-engineer` | 2ª | REPROVADO | `revisao-spec` | TS §5 Envio (4), §7 "Retenção e expurgo" e §11, contra o RF13 e o PRD §8: a queda entre o envio ao storage e o commit fica sem prova, e o prazo diverge do PRD. |
| 2026-11-11 10:36:41 | `infra-guardian` | 2ª | REPROVADO | `revisao-spec` | techspec §5 "Envio e edição", passo 4; §2 (`infra/`, `compose`); §12: a expiração do bucket é premissa não verificada, sem dono e sem teste. O caminho do… |
| 2026-11-11 10:41:36 | `frontend-reviewer` | 3ª | APROVADO | `revisao-spec` | , sem bloqueio: |
| 2026-11-11 10:42:03 | `conformidade-reviewer` | 3ª | APROVADO | `revisao-spec` | TS §5, "Leitura de página": dizer que a conferência depois do `202` (`entrada`, linha 206 de `tutor.service.ts`) também aplica o filtro novo. Se o material… |
| 2026-11-11 10:42:14 | `tenancy-guardian` | 3ª | APROVADO | `revisao-spec` | da rodada 2, conferidos |
| 2026-11-11 10:43:06 | `privacy-guardian` | 3ª | REPROVADO | `revisao-spec` | techspec.md:83 (§5 "Envio e edição", passo 4) e cenarios.md:26 (problema novo da correção do órfão): |
| 2026-11-11 10:43:35 | `infra-guardian` | 3ª | REPROVADO | `revisao-spec` | techspec.md:83 (§5, passo 4) e cenarios.md:19-26: a spec não define a ordem entre apagar o objeto e apagar a linha de `envio_de_material`, e o cenário do 503… |
| 2026-11-11 10:43:45 | `test-engineer` | 3ª | REPROVADO | `revisao-spec` | TS §5 Envio (4) e cenarios "Envio" l.26: o `catch` pode deixar o PDF órfão para sempre. |
| 2026-11-11 10:44:38 | `revisor-geral` | 3ª | REPROVADO | `revisao-spec` | TS §5 "Envio e edição" (4), e `cenarios.md` "Envio", linha 26: a ordem entre apagar o objeto e apagar a linha de `envio_de_material` não está definida, e o… |
| 2026-11-11 10:47:27 | `privacy-guardian` | 4ª | APROVADO | `revisao-spec` | TS §5, passo 4 (techspec.md:83): quando o guardarBytes não terminou com sucesso (prazo estourado ou conexão |
| 2026-11-11 10:47:29 | `infra-guardian` | 4ª | REPROVADO | `revisao-spec` | techspec.md:83-84 (§5, passo 4) e cenarios.md:26-30: depois de uma falha no próprio `guardarBytes`, o `catch` ainda apaga a linha, e o PUT atrasado deixa o… |
| 2026-11-11 10:47:43 | `test-engineer` | 4ª | APROVADO | `revisao-spec` | Varredura contra commit, intercalados (TS §5 (4), cenarios.md:31-32). O cenário só cobre a varredura que termina inteira antes da transação. Pode haver outra… |
| 2026-11-11 10:49:01 | `revisor-geral` | 4ª | REPROVADO | `revisao-spec` | TS §5 "Extração", linhas 90 e 91: a regra nova de objeto ausente só poupa o material excluído. Na entrega repetida, um material `pronto` pode virar `falhou`. |
| 2026-11-11 10:51:39 | `revisor-geral` | 5ª | APROVADO | `revisao-spec` | TS §5 "Extração", linha 87. O texto da transição traz só `estado` e `excluido_em`. A §6 já obriga o escopo, mas a regra 10 fica mais visível com `where… |
| 2026-11-11 10:51:59 | `infra-guardian` | 5ª | REPROVADO | `revisao-spec` | techspec.md:91-92 (TS §5 Extração) e TS §3 "Migrations" (techspec.md:48-51): o código novo grava `falha = 'arquivo_ausente'`, e o código anterior não consegue… |
| 2026-11-11 10:54:27 | `infra-guardian` | 6ª | APROVADO | `revisao-spec` | cenarios.md:157-158, o [I] da volta do código. |
| 2026-11-11 11:02:35 | `test-engineer` | 5ª | SEM VEREDITO | `revisao-spec` | As tabelas de "Testes que provam a regra" das 12 tarefas estão abaixo. Usei as legendas do `cenarios.md` (I, U, E, P, C). "Mutação" diz o que se tira para o… |
