# Regra 10 — Isolamento entre escolas

## Por que esta regra existe

O produto é vendido a uma coordenadora que vai entregar a nós a lista com nome, turma e
notas de novecentos adolescentes. A decisão dela de assinar é uma decisão de confiança,
e ela vai ser cobrada pessoalmente se algo der errado.

Se um professor de uma escola conseguir ver, uma única vez, dado de outra escola, o
estrago não é um bug: é o fim da venda naquela rede inteira e provavelmente na cidade,
porque esse mercado funciona por relacionamento e a notícia corre. Não existe correção
técnica que recupere isso depois.

Por isso o isolamento vem antes de prazo, antes de elegância, e antes de qualquer outra
regra deste repositório, com exceção da regra 20.

## O modelo mental

**Cada escola é um mundo fechado.** Não existe "quase isolado", não existe "só o
administrador vê tudo", não existe endpoint de conveniência que ignora o escopo.

O ano letivo é a segunda dimensão: turma, vínculo e nota pertencem a um ano. Em janeiro
tudo vira, e um sistema que trata turma como permanente quebra inteiro na virada.

## As regras

1. **Toda tabela de domínio tem `escolaId`.** Sem exceção, inclusive em tabela auxiliar
   que "só guarda configuração". A exceção real é curta e fixa: tabela pública sem dono,
   como habilidades da BNCC e banco de questões público.
   Checagem: `apps/api/test/arquitetura.test.ts`, `tenancy-guardian`.

2. **Tabela que varia por período tem também `anoLetivoId`.**
   Checagem: só a revisão garante (`tenancy-guardian`).

3. **O escopo é aplicado no repository, a partir do token.** Nunca recebido por parâmetro
   do cliente, nunca confiado ao service que chamou.

   ```ts
   // errado: quem chamou decide o escopo
   findByTurma(turmaId: string) {
     return db.select().from(avaliacoes).where(eq(avaliacoes.turmaId, turmaId))
   }

   // errado de um jeito pior: o cliente manda a escola
   findByTurma(escolaId: string, turmaId: string) { ... }

   // certo: o escopo vem do contexto autenticado, não do argumento
   findByTurma(turmaId: string) {
     const { escolaId, anoLetivoId } = this.ctx
     return db.select().from(avaliacoes).where(and(
       eq(avaliacoes.escolaId, escolaId),
       eq(avaliacoes.anoLetivoId, anoLetivoId),
       eq(avaliacoes.turmaId, turmaId),
     ))
   }
   ```

   Checagem: `guardas/tabela-so-no-repository`, `tools/guardas/repositories-com-escopo.test.ts`, `tenancy-guardian`.

4. **Autorização por objeto, não só por rota.** Ter o papel de professor não basta: aquela
   turma precisa ser dele. Faça o teste mental de trocar o id na URL — o ataque mais comum
   e mais banal que existe.
   Checagem: só a revisão garante (`tenancy-guardian`); o que há de teste: `apps/api/test/acesso-da-turma.int.test.ts`.

5. **Todo módulo novo entrega um teste de isolamento.** E ele precisa ser efetivo: remova
   mentalmente a cláusula de escopo do repository e pergunte se o teste quebraria. Se não
   quebraria, ele não está testando nada.

   ```ts
   it('professor da escola A não alcança avaliação da escola B', async () => {
     const a = await criarEscolaComProfessor()
     const b = await criarEscolaComAvaliacao()
     const r = await api(a.token).get(`/avaliacoes/${b.avaliacao.id}`)
     expect(r.status).toBe(404)          // não 403: ver regra 6
   })
   ```

   Checagem: só a revisão garante (`tenancy-guardian`, `test-engineer`).

6. **"Não encontrado" e "sem permissão" respondem a mesma coisa.** Se a API devolve 404
   para id inexistente e 403 para id de outra escola, ela acabou de confirmar que aquele id
   existe. Isso é vazamento, mesmo sem devolver dado nenhum.
   Checagem: só a revisão garante (`tenancy-guardian`); o que há de teste: `apps/api/test/borda-de-entrada-ultimos-modulos.int.test.ts`.

7. **Id é UUID.** Id sequencial entrega volume de dados a quem olha a URL e facilita
   varredura. `aluno/1837` diz quantos alunos existem.
   Checagem: só a revisão garante (`tenancy-guardian`).

8. **A camada de rede lê apenas agregado.** Uma secretaria municipal não alcança nota
   individual nem conversa de tutor. Existe teste que prova isso, porque é a primeira coisa
   que um jurídico de prefeitura pergunta.
   Checagem: `packages/shared/src/permissao/matriz.test.ts`, `packages/core/src/identidade/tabelas-de-identidade.int.test.ts`, `tenancy-guardian`.

9. **Query sem escopo só em rotina administrativa nossa**, marcada com `@Unscoped()` e com
   uma linha de justificativa. Se aparecer uma terceira dessas no mesmo módulo, tem algo
   errado no desenho.
   Checagem: `tools/guardas/repositories-com-escopo.test.ts`, `apps/api/test/arquitetura.test.ts`.

## Como isso é checado

O subagente `tenancy-guardian` audita toda tarefa que cria migration, repository, query ou
endpoint. O veto dele é falha da tarefa, não sugestão de melhoria.
