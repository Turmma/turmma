---
paths:
  - "apps/**"
  - "packages/**"
  - "infra/**"
---

# Regra 00 — Arquitetura

## Por que esta regra existe

Duas coisas ainda não estão decididas: onde vamos hospedar e qual provedor de IA vamos usar
em produção. E uma terceira é provável: venda para prefeitura costuma exigir que o dado
fique em território nacional.

Isso significa que qualquer decisão técnica que amarre o sistema a uma plataforma
específica pode custar o contrato mais importante do primeiro ano. A arquitetura inteira é
organizada em torno de conseguir subir tudo em um servidor em São Paulo, se for preciso.

O segundo motivo é mais mundano: o produto tem trabalho pesado por natureza — ingestão de
apostila, correção de turma inteira, agente rodando de madrugada. Se isso for parar dentro
de um request HTTP, a experiência quebra no primeiro cliente com novecentos alunos.

## As regras

1. **Backend e frontend são separados.** A web nunca fala com o banco. Toda leitura e
   escrita passa pela API, onde a autorização vive. Regra de negócio no frontend é regra
   que o usuário pode contornar abrindo o console.
   Checagem: `tools/guardas/camadas.test.ts`.

2. **Controller não tem regra de negócio.** Ele valida a entrada, chama o service e
   devolve. Quando regra vaza para o controller, ela deixa de ser testável sem HTTP e
   passa a ser duplicada em todo lugar que precisa dela.
   Checagem: só a revisão garante (`revisor-geral`); o que há de teste: `tools/guardas/camadas.test.ts`.

3. **Repository é o único lugar que toca o banco**, e é onde o escopo de tenant é aplicado
   (regra 10). Query solta no service é como o isolamento acaba furado.
   Checagem: `guardas/tabela-so-no-repository`, `tools/guardas/repositories-com-escopo.test.ts`.

4. **Nada demorado dentro de request.** Ingestão, correção, agente, OCR, notificação e
   exportação vão para fila. A referência prática: se pode passar de dois segundos com
   dado real de uma escola grande, vai para fila. A fila tem prioridade e limite por escola
   (regra 80).
   Checagem: só a revisão garante (`infra-guardian`).

5. **DTO de saída explícito.** Nunca serialize a entidade inteira e confie no frontend para
   esconder o que não deve aparecer. Campo escondido no CSS continua na resposta da API.
   Checagem: `apps/api/test/contracts.test.ts`, `privacy-guardian`.

6. **Contrato compartilhado** vive em `packages/shared`. Tipo de API redigitado no frontend
   é onde back e front começam a divergir sem ninguém perceber.
   Checagem: só a revisão garante (`revisor-geral`).

7. **Sem dependência de plataforma proprietária no caminho crítico.** Se uma biblioteca só
   funciona numa nuvem específica, ela está proibida. Isso vale especialmente para fila e
   para storage, que é onde a amarra costuma entrar sem alarde.
   Checagem: só a revisão garante (`infra-guardian`).

8. **Tudo sobe com `docker compose up`.** Se um desenvolvedor novo precisa de conta em
   serviço externo para rodar o projeto, a arquitetura está errada e o teste automatizado
   também vai depender daquilo um dia.
   Checagem: só a revisão garante (`infra-guardian`).

9. **Erro de domínio é tipado e tem código.** Nunca lance string. O frontend precisa
   distinguir "a matrícula já existe" de "você não pode fazer isso" sem ler mensagem.
   Checagem: `guardas/erro-tipado`.

## Onde ler o desenho

`docs/arquitetura.md` tem o desenho completo, com os módulos, as filas e as camadas.
