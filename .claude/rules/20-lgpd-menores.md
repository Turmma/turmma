# Regra 20 — Dado pessoal e menor de idade

## Por que esta regra existe

Vale começar pelo que costuma acontecer com produtos como o nosso.

SaaS de educação raramente fecha por falta de funcionalidade. Ele fecha porque um dia
alguém descobre que a lista de alunos de uma escola estava acessível trocando um número na
URL, ou que os dumps de banco estavam num bucket público, ou que o log tinha nome e nota de
menor de idade e esse log ia para um serviço terceiro em outro país. A partir daí é ANPD,
imprensa local, e o fim dos contratos. Escola é um mercado de relacionamento: o estrago não
fica contido.

Nossa situação é especialmente delicada por três motivos somados. Quase todo titular é
menor de idade, e o artigo 14 da LGPD dá proteção reforçada a criança e adolescente,
exigindo que o tratamento seja no melhor interesse do titular. Guardamos coisas que dizem
mais sobre a pessoa do que nome e nota: a conversa do aluno com o tutor mostra o que ele
não entende e como ele pensa. E enviamos parte disso a um provedor de IA de terceiro.

Por isso este documento vem antes de qualquer conveniência de implementação.

O documento operacional completo é `docs/lgpd.md`, com o mapa de dados e a lista de furos
conhecidos. Esta regra é o resumo executável dele.

## O modelo mental

**A escola é controladora, nós somos operadores.** Ela decide por que e como os dados são
tratados; nós só tratamos conforme a instrução dela, registrada em contrato. Isso tem uma
consequência prática que se esquece fácil: não inventamos finalidade nova. Usar dado de
aluno para melhorar nosso produto, treinar modelo ou fazer análise nossa não está na
instrução. Na dúvida, não use.

A pergunta que decide qualquer discussão de campo novo não é "isso é útil?". É **"o que
acontece se isso vazar?"**.

## Coleta

1. **Campo pessoal novo só entra se estiver na tabela de dados de `docs/lgpd.md`**, com
   finalidade e retenção preenchidas. Não está lá, não entra na migration. Atualizar a
   tabela faz parte da mesma tarefa, não de uma futura.
   Checagem: só a revisão garante (`privacy-guardian`).

2. **Aluno não tem** e-mail, telefone, CPF, foto, endereço, data de nascimento nem
   diagnóstico. O contato é sempre do responsável. Isso não é excesso de zelo: é o que faz
   um vazamento nosso ser muito menos grave que o de um concorrente. No login ou na
   importação pela conta Google ou Microsoft da escola (D48), guardamos só o identificador
   opaco da conta; e-mail e foto que o provedor devolve são descartados antes de gravar.
   Checagem: `apps/api/test/contratos.test.ts` (e-mail na saída), `packages/shared/src/estrutura/documento-na-matricula.test.ts` (CPF na importação); só a revisão garante o resto, telefone, foto, endereço e nascimento (`privacy-guardian`).

3. **Necessidade específica é dado sensível** (art. 11). A ferramenta de adaptação precisa
   saber *que adaptação fazer*, não *qual é o diagnóstico*. Guarde "prova com fonte ampliada
   e tempo adicional", não o laudo.
   Checagem: só a revisão garante (`privacy-guardian`); o que há de teste: `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts`.

## Exposição — onde o vazamento realmente acontece

4. **DTO de saída explícito.** Nunca serialize a entidade e confie no frontend.

   ```ts
   // errado: devolve senhaHash, matrícula, e o que mais existir na tabela
   return aluno

   // certo
   return { id: aluno.id, nome: aluno.nome, turmaId: aluno.turmaId }
   ```

   Checagem: `apps/api/test/contratos.test.ts`, `privacy-guardian`.

5. **Autorização por objeto, não só por rota.** Papel de professor não basta; aquele aluno
   precisa ser de uma turma dele. Faça sempre o teste de trocar o id na URL.
   Checagem: só a revisão garante (`privacy-guardian`, `tenancy-guardian`); o que há de teste: `apps/api/test/acesso-da-turma.int.test.ts`.

6. **"Não encontrado" e "sem permissão" respondem igual.** Respostas diferentes confirmam a
   existência do registro.
   Checagem: só a revisão garante (`privacy-guardian`); o que há de teste: `apps/api/test/borda-de-entrada-ultimos-modulos.int.test.ts`.

7. **Arquivo em bucket privado, com URL assinada de validade curta.** Nunca URL permanente,
   nunca bucket público "porque é só uma imagem de prova".
   Checagem: `packages/core/src/titular/s3-file-storage.test.ts`, `privacy-guardian`.

8. **Convite é token único, com expiração, uso único e revogação.** Link de sala sem
   validade circula em grupo de WhatsApp e vira porta aberta meses depois.
   Checagem: `apps/api/test/convite.int.test.ts`, `apps/api/test/login-convite-revogado.int.test.ts`.

## Log e rastro

9. **Nunca logue** nome, matrícula, resposta, nota, conversa de tutor ou conteúdo de prompt.
   Log usa id.

   ```ts
   // errado
   logger.info(`Corrigindo prova de ${aluno.nome}, nota ${nota}`)

   // certo
   logger.info('correcao.concluida', { escolaId, avaliacaoId, alunoId })
   ```

   Checagem: `guardas/log-sem-dado-pessoal`, `guardas/log-sem-conteudo-montado`.

10. **Auditoria obrigatória** em: leitura de dado de aluno por coordenação ou rede,
    leitura nominal de indicador de professor pela coordenação (D45), exportação, alteração
    de nota, alteração de permissão, aprovação de saída de IA. Auditoria não é log: é
    registro consultável, com autor, data e finalidade. O registro de acesso exigido pelo
    Marco Civil (art. 15, 6 meses) é outra coisa e tem retenção própria.
    Checagem: `packages/core/src/auditoria/porta-unica.test.ts`, `packages/core/src/auditoria/acoes.test.ts`, `privacy-guardian`.

10a. **Indicador de professor é dado pessoal do professor.** Entra no mapa de dados de
     `docs/lgpd.md` com finalidade de apoio pedagógico, nunca de decisão sobre o professor,
     antes de qualquer migration. Métrica que forma perfil profissional dá ao professor o
     direito de pedir revisão (art. 20).
     Checagem: só a revisão garante (`privacy-guardian`, `conformidade-reviewer`).

11. **Erro para o cliente é curto e tipado.** Stack trace nunca sai da API.
    Checagem: `guardas/erro-tipado`, `apps/api/test/erro.int.test.ts`.

## IA

12. **Envio externo leva o mínimo, com identificador em vez de nome.** O modelo não precisa
    saber que é a Maria; precisa da dúvida e do trecho do material.
    Checagem: `apps/api/src/tutor/tutor-modelo.int.test.ts`, `packages/core/src/ia/llm-gateway.test.ts`, `privacy-guardian`, `llm-integrator`.

13. **Sem contrato vedando treinamento com nosso dado, use o provedor local.** Não existe
    exceção "só para testar com dado real". O contrato também precisa permitir serviço
    usado por menor de idade e dizer onde o dado é processado: os termos da Gemini API
    (AI Studio) vedam serviço "provável de ser acessado" por menor de 18, e o DPA da
    Maritaca lista processamento no Brasil, nos EUA e na UE.
    Checagem: `packages/core/src/ia/llm-gateway.test.ts`, `privacy-guardian`.

14. **Conversa de tutor tem retenção curta e acesso restrito ao professor da turma.** A
    camada de rede nunca alcança conteúdo de conversa, só agregado.
    Checagem: só a revisão garante (`privacy-guardian`) que a camada de rede não chega à conversa; o que há de teste: `apps/api/test/retencao.int.test.ts`, `apps/api/src/tutor/tutor.int.test.ts`.

## Ciclo de vida

15. Exclusão é lógica e auditada. Eliminação a pedido do titular apaga de fato e propaga
    para backup na próxima rotação.
    Checagem: `apps/api/test/ciclo-de-vida.int.test.ts`, `apps/api/test/eliminacao-agendada.int.test.ts`.

16. Rotina de expurgo conforme a retenção, que é configurável por escola, porque o prazo de
    guarda de registro escolar varia por rede.
    Checagem: `apps/api/test/retencao.int.test.ts`, `apps/worker/test/expurgo.int.test.ts`.

17. **Seed de desenvolvimento e de demonstração é sintético.** Dump de produção em máquina
    de desenvolvedor é proibido, mesmo "só para depurar um caso". É uma das formas mais
    comuns de vazamento e uma das mais fáceis de evitar.
    Checagem: só a revisão garante (`privacy-guardian`).

18. Fim de vínculo desativa a conta. Professor que saiu em março não continua vendo a turma
    em outubro.
    Checagem: `apps/api/test/acesso-fim-do-vinculo.int.test.ts`.

## Direitos do titular

19. Acesso, correção, eliminação, portabilidade e lista de compartilhamento precisam ser
    atendidos **por código**. Processo manual não escala e não sobrevive a auditoria.
    Checagem: `apps/api/test/arquivo-do-titular.int.test.ts`, `apps/api/test/pedido-titular.int.test.ts`.

## O teste de fechamento

Se a secretaria de educação pedisse hoje tudo o que o sistema guarda sobre um aluno
específico, e para onde isso já foi enviado, o código responde em minutos?

Se não responde, a implementação está incompleta, por mais que a funcionalidade funcione.

## Como isso é checado

O subagente `privacy-guardian` audita toda tarefa que toca dado de pessoa, log, storage,
exportação ou envio externo. O veto dele é falha da tarefa.
