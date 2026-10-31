---
paths:
  - "apps/web/**"
  - "e2e/**"
  - "**/*.tsx"
  - "playwright.config.ts"
---

# Regra 50 — Frontend

## Por que esta regra existe

Três realidades definem estas regras, e nenhuma delas é preferência estética.

O aluno usa **computador de escola** (Chromebook, notebook de carrinho, laboratório), que
costuma ser máquina fraca, em rede compartilhada por trinta pessoas ao mesmo tempo (D43). A
Lei 15.100/2025 tirou o aparelho pessoal da sala, então não existe plano B pelo telefone:
nem para autenticar, nem para receber código, nem para fotografar.

Fora da sala, a mesma web abre no **celular**: o aluno quando a escola liga o modo casa, o
professor no ônibus, a coordenadora em casa, e depois a família (D51). Tela pequena, toque e
rede móvel. O produto não depende do celular, mas não pode quebrar nele.

O professor abre o sistema **entre duas aulas**, com quarenta minutos de intervalo e uma
xícara de café na mão. Ele não vai explorar menu, não vai ler tutorial, e não vai perdoar
uma tela que o faz procurar.

E há uma ação no produto que não pode ser banalizada: **aprovar nota**. Se ela virar um
clique reflexo, a supervisão humana que a lei exige vira teatro, e a primeira nota errada
publicada destrói a confiança do professor no sistema inteiro.

## As regras

1. **Alvo é computador fraco de escola em rede instável**, com o Chromebook de entrada
   como referência de teste. Bundle enxuto, lista longa virtualizada,
   imagem comprimida antes do upload. Teste com throttling de rede e de CPU antes de
   considerar pronto. "Funciona no meu notebook" não é dado.
   Checagem: só a revisão garante (`frontend-reviewer`) o teste com throttling de rede e de CPU; o que há de teste: `tools/ci/tamanho-web.test.ts`.

2. **Web-first, sem dependência de celular** em nenhum ponto do fluxo: nada exige telefone
   para autenticar, receber código ou fotografar.
   Checagem: só a revisão garante (`frontend-reviewer`).

2a. **Responsiva e usável no celular desde a primeira versão de cada tela** (D51). Layout a
    partir de 360 px de largura sem rolagem horizontal; alvo de toque com pelo menos 24 × 24
    px (WCAG 2.5.8) e, em ação principal, 44 × 44 px; nada que só funcione com hover, clique
    direito ou atalho de teclado; campo com o `inputmode` e o `autocomplete` certos; tabela
    longa vira lista ou rola dentro do próprio contêiner. Toda tela é testada nos projetos
    Playwright `chromebook` e `celular`. Tela entregue só para desktop é tarefa incompleta,
    não "adaptação para depois".
    Checagem: `e2e/casca-no-celular.spec.ts`, `frontend-reviewer`.

3. **Estado de servidor é do TanStack Query.** Duplicar em `useState` é onde aparecem as
   telas que mostram nota antiga depois de aprovar.
   Checagem: só a revisão garante (`frontend-reviewer`).

4. **Tipos vêm de `packages/shared`.** Contrato redigitado é contrato que vai divergir.
   Checagem: só a revisão garante (`frontend-reviewer`).

5. **Toda tela tem os quatro estados**: carregando, vazio, erro e com dado. O estado vazio é
   um convite para agir, não um pedido de desculpas.
   Checagem: só a revisão garante (`frontend-reviewer`).

6. **O feed de agentes não pode aparecer vazio** para um professor com turmas. Se aparecer,
   a primeira impressão do produto é a de um chat comum, e o argumento inteiro se perde.
   Isso é requisito de produto, não detalhe de interface.
   Checagem: só a revisão garante (`frontend-reviewer`).

7. **Token em memória e cookie httpOnly.** Nada sensível em `localStorage` nem em URL.
   Checagem: só a revisão garante (`frontend-reviewer`, `privacy-guardian`).

8. **Ação oficial mostra o que vai acontecer antes de confirmar.** Aprovar nota exibe o
   valor, o aluno e a avaliação. Aprovar em lote mostra o resumo e destaca os casos fora da
   curva, que são os que o professor realmente precisa olhar.
   Checagem: `e2e/professor-aprovar.spec.ts`, `frontend-reviewer`.

9. **A tela do aluno não expõe dado de colega.** Nem ranking, nem média da turma que permita
   deduzir nota alheia, nem lista de quem entregou.
   Checagem: `apps/web/src/areas/aluno/atividades.test.ts`, `frontend-reviewer`.

10. **O modo sala mostra sinal, não conversa crua por padrão.** O professor abre a conversa
    quando precisa, e esse acesso fica em auditoria. É a diferença entre supervisão e
    vigilância, e ela precisa aparecer na interface.
    Checagem: só a revisão garante (`frontend-reviewer`, `conformidade-reviewer`).

11. **Acessibilidade real**: navegação por teclado, foco visível, contraste, rótulo em
    campo. Escola pública tem aluno com deficiência, e isso aparece em edital.
    Checagem: `apps/web/src/contraste.test.ts`, `frontend-reviewer`.

12. **Português do Brasil**, data e número no formato local. Erro diz o que fazer, não o
    código: "não foi possível salvar, tente de novo em instantes", não "erro 500".
    Checagem: `apps/web/src/format.test.ts`, `frontend-reviewer`.

13. **Seletor de escola no topo da área do professor**, filtrando tudo abaixo. Professor de
    rede pública dá aula em duas ou três escolas, e assumir escola única quebra o produto
    para ele.
    Checagem: só a revisão garante (`frontend-reviewer`).

## Como isso é checado

O subagente `frontend-reviewer` audita toda tarefa que cria ou altera tela.
