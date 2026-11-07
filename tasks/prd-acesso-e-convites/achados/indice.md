# Índice dos achados das revisões

Uma linha por rodada que exigiu alguma coisa. O texto inteiro está no arquivo do documento, nesta
pasta (`<documento>.md`), no bloco com o mesmo fim. Escrito pelo hook `tools/processo/revisoes.ts`.
Não edite à mão.

Leia este índice antes de codar, e abra só os blocos que interessam à tarefa de agora.

| Fim | Revisor | Rodada | Veredito | Documento | O que exigiu |
|---|---|---|---|---|---|
| 2026-11-07 10:39:12 | `frontend-reviewer` | 1ª | AJUSTES NECESSÁRIOS | `revisao-spec` | Tech Spec §9 e `cenarios.md`: os quatro estados e o texto de erro com próximo passo não estão definidos para esqueci, redefinir, verificar, conta da escola… |
| 2026-11-07 10:41:29 | `test-engineer` | 1ª | REPROVADO | `revisao-spec` | Cenários do `desativar` que não chegam à cláusula (cenarios.md, RF11, as duas linhas citadas acima; Tech Spec §2 "`ciclo-de-vida/`" e §5 "A revogação, o… |
| 2026-11-07 10:41:42 | `privacy-guardian` | 1ª | REPROVADO | `revisao-spec` | §5 "Senha provisória" e §7 "Retenção e eliminação"; `cenarios.md`, "Auditoria e dado". A D85 (`docs/decisoes.md:1637-1638`, de 06/11, posterior à aprovação… |
| 2026-11-07 10:41:57 | `tenancy-guardian` | 1ª | REPROVADO | `revisao-spec` | Tech Spec, seções 5 ("E-mail", "Esqueci", "Posse do e-mail") e 6: o job de sistema nasce de uma requisição HTTP, e o código atual recusa isso. |
| 2026-11-07 10:42:10 | `infra-guardian` | 1ª | REPROVADO | `revisao-spec` | Gerar a senha provisória duas vezes ao mesmo tempo não tem trava (techspec.md §5 "Senha provisória"; tabela "Corridas" do cenarios.md). |
| 2026-11-07 10:43:07 | `revisor-geral` | 1ª | REPROVADO | `revisao-spec` | A D85 foi atribuída a esta spec e não está na Tech Spec nem nos cenários. A D85 foi decidida em 06/11, depois desta Tech Spec. Ela diz que o código entra pela… |
| 2026-11-07 10:48:00 | `frontend-reviewer` | 2ª | APROVADO | `revisao-spec` | Em "Gerar provisória", o erro 429 diz só "o limite". Escreva o texto, por exemplo "Muitas tentativas. Espere alguns minutos e tente de novo". |
| 2026-11-07 10:49:34 | `infra-guardian` | 2ª | REPROVADO | `revisao-spec` | Tech Spec §4 e §7c; `cenarios.md`, "Limites", linha "Convites", e "Corridas". A spec agora recusa inteiro o lote acima da cota de 300/h, mas não diz como a… |
| 2026-11-07 10:49:47 | `revisor-geral` | 2ª | APROVADO | `revisao-spec` | §5, "Arquivo do titular". A spec não diz de onde vem o papel nas quatro ações da F2. Elas não guardam papel no `depois`, e o autor delas é sempre a coordenação… |
| 2026-11-07 10:49:49 | `tenancy-guardian` | 2ª | APROVADO | `revisao-spec` | §5, "Auditoria" (contexto por escola na rota anônima). O `AuditoriaRecorder` tira a escola e o autor do contexto, e o `naEscolaSemUsuario` não põe usuário,… |
| 2026-11-07 10:49:58 | `privacy-guardian` | 2ª | APROVADO | `revisao-spec` | que vocês adotaram, todas presentes: |
| 2026-11-07 10:50:30 | `test-engineer` | 2ª | REPROVADO | `revisao-spec` | A confirmação da provisória não separa homônimos de verdade (cenarios.md, "E2E (RF18)", caso dos homônimos, e "Telas", linha "Gerar provisória"). |
| 2026-11-07 10:54:24 | `test-engineer` | 3ª | REPROVADO | `revisao-spec` | . |
| 2026-11-07 10:54:37 | `infra-guardian` | 3ª | REPROVADO | `revisao-spec` | A saída de "adiar sem gastar tentativa" não diz o que acontece com a vaga da escola nem com o estado do job. Está na Tech Spec §2 (linha `job-executor.ts`) e… |
| 2026-11-07 10:56:12 | `infra-guardian` | 4ª | APROVADO | `revisao-spec` | Tech Spec §5 "E-mail": o job consome o ponto do `EMAIL_POR_MINUTO` antes de reservar a linha. Se a linha tem reserva alheia vigente, ou já está `enviado` ou… |
| 2026-11-07 10:56:21 | `test-engineer` | 4ª | REPROVADO | `revisao-spec` | A variação aleatória da espera não tem cenário que a prove. Fica em `cenarios.md`, "RF11", no [I] "Job adiado: … a espera é o `msBeforeNext` (ou o prazo da… |
| 2026-11-07 10:57:37 | `test-engineer` | 5ª | APROVADO | `revisao-spec` | Fixar o teto no limite no [I] "Ponto ... volta" (cenarios.md, RF11). Usar `EMAIL_POR_MINUTO` igual a 1 (ou com o minuto já cheio menos um) no teste. Assim "a… |
