---
paths:
  - "apps/**"
  - "packages/**"
---

# Regra 60 — Domínio

## Por que esta regra existe

Software escolar erra de um jeito característico: alguém modela "turma" como algo
permanente, "nota" como um número solto, e "aula" como um evento que o professor cria. Em
janeiro, quando o ano vira, o sistema quebra inteiro. Quando um professor sai em março, sua
turma fica órfã. Quando dois módulos chamam a mesma coisa de `class` e `turma`, ninguém
percebe que são a mesma coisa até o bug aparecer em produção.

Estas regras existem para que o código fale a língua da escola, e para que as poucas
invariantes que realmente importam estejam garantidas por estrutura, não por atenção.

Contexto completo do domínio: `docs/visao-produto.md` e `docs/fluxos.md`. Vocabulário:
`docs/glossario.md`.

## As regras

1. **Use o vocabulário do glossário** no código, no banco e na interface. `turma`, não
   `class`. `nota`, não `grade`. `matricula`, não `enrollmentNumber`. E não misture os dois
   idiomas dentro da mesma entidade: `turmaId` e `gradeValue` na mesma tabela é como
   começam os mal-entendidos.
   Checagem: só a revisão garante (`revisor-geral`).

2. **Nota só existe com autor humano.** Ver regra 70. É a invariante mais importante do
   sistema e deve ser impossível de violar por construção, não por convenção.
   Checagem: `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts`, `conformidade-reviewer`.

3. **Avaliação tem modo**, e o modo define a trilha de aplicação e correção: online
   objetiva, online discursiva, papel com foto, trabalho de entrega, presencial. O núcleo é
   o mesmo nos cinco; o que muda é a entrada e a correção.
   Checagem: só a revisão garante (`revisor-geral`).

4. **Em todos os modos, o resultado termina dentro do sistema.** Primeiro como diagnóstico
   formativo por habilidade, depois também como nota oficial (D46). Um modo que deixa o
   resultado de fora quebra o painel do coordenador, a medição de desempenho e a
   notificação da família, que são justamente as partes que fecham o loop e vendem o
   produto.
   Checagem: só a revisão garante (`revisor-geral`).

5. **Turma, vínculo e nota pertencem a um ano letivo.** Nada é perpétuo. Modelar o ano
   letivo como dimensão desde o começo custa pouco; adicionar depois custa uma migration em
   quase todas as tabelas.
   Checagem: `apps/api/test/virada-do-ano.int.test.ts`, `tenancy-guardian`.

6. **Matrícula é única por escola, nunca globalmente.** Dois alunos em cidades diferentes
   podem ter a mesma matrícula, e isso é normal.
   Checagem: `apps/api/src/credencial/credencial-matricula.repository.int.test.ts`, `apps/api/test/salas-reivindicar.int.test.ts`.

7. **O aluno entra por reivindicação de nome aprovada pelo professor, ou pela conta da
   escola importada** (D48), nunca por autocadastro. Ver fluxo 1 em `docs/fluxos.md`.
   Checagem: `apps/api/test/salas-reivindicar.int.test.ts`, `privacy-guardian`.

8. **O calendário do professor deriva da estrutura da escola.** A coordenação importa grade
   e calendário no onboarding (D3 revista). Ele preenche o que vai dar em cada aula; ele não
   inventa a grade.
   Checagem: só a revisão garante (`revisor-geral`).

8a. **O vínculo do professor é definido pela escola**, pela coordenação ou pela grade
    importada, e o professor só confirma. Vínculo autodeclarado não dá acesso a aluno. Um
    usuário pode ter vínculo em mais de uma escola, e cada vínculo continua preso ao tenant
    e ao ano letivo dele.
    Checagem: `apps/api/test/vinculo.int.test.ts`, `tenancy-guardian`.

9. **Agente é thread com histórico e nível de autonomia declarado.** A entrega nasce
   pendente sempre que houver nota, comunicação com família ou decisão sobre o aluno.
   Checagem: `apps/api/src/entrega/entrega.int.test.ts`, `conformidade-reviewer`.

10. **Material ingerido pertence ao tenant da escola** e nunca cruza para outra, nem vira
    banco nosso. Ver `docs/regulacao.md` seção 5.
    Checagem: `apps/api/test/material-isolamento.int.test.ts`, `tenancy-guardian`.

11. **A matriz de visibilidade é esta, e exceção se discute antes:** rede vê agregado;
    coordenação vê a unidade; professor vê suas turmas; aluno vê a si; responsável vê o
    filho. Indicador de professor: o próprio professor vê o seu, a coordenação vê agregado
    e abre o nominal com auditoria, a rede vê só agregado (D45, regra 70 item 8).
    Checagem: `apps/api/src/governanca/governanca.int.test.ts`, `tenancy-guardian`, `conformidade-reviewer`.

12. **Toda funcionalidade nova responde a uma pergunta:** isso melhora o loop escola →
    professor → aluno → coordenação → família? Se não melhora, provavelmente é distração,
    por mais interessante que seja construir.
    Checagem: só a revisão garante (`revisor-geral`).
