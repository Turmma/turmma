# Regra 70 — Conformidade regulatória educacional

## Por que esta regra existe

Em 1º de setembro de 2026 o Conselho Nacional de Educação aprovou diretrizes para o uso de
inteligência artificial na educação. Em 19/09/2026 o texto ainda aguardava homologação do
MEC e publicação como resolução, e os doze meses de adequação contam da publicação. Isso
muda nosso projeto de duas formas.

A primeira é óbvia: algumas coisas que seriam tecnicamente fáceis passaram a ser proibidas,
e outras passaram a exigir um humano no caminho. Correção de objetiva e atribuição de nota
são classificadas como alto risco e exigem validação humana **efetiva, prévia, qualificada e
documentada** — com a frase explícita de que o professor não pode apenas clicar em "aprovar".
Decisão só automatizada sobre promoção ou retenção de aluno é proibida. Em redação e prova
discursiva a IA não corrige, não avalia, não dá nota nem conceito e **não faz pré-correção nem
sugere nota ao professor** (D55).

Desde 17/03/2026 há um segundo bloco, com sanção contra nós: o **ECA Digital (Lei
15.211/2025)** e o **Decreto 12.880/2026**, fiscalizados pela ANPD, que valem para qualquer
fornecedor de serviço direcionado a criança e adolescente — independente de a escola ser a
controladora do dado. O art. 11 do decreto trata diretamente de IA conversacional com menor de
idade. Está tudo traduzido em requisito em `docs/regulacao.md` seção 2.

A segunda é comercial e vale mais: praticamente nenhuma escola sabe como se adequar, e só
22% delas têm qualquer política de uso de IA. Um sistema que já nasce em conformidade, com
auditoria pronta para mostrar em reunião, não está cumprindo obrigação — está vendendo a
solução de um problema que o coordenador tem e não sabe resolver.

Por isso estas regras não são burocracia a ser minimizada. São parte do produto.

O detalhamento está em `docs/regulacao.md` (o que a lei exige) e em
`docs/conformidade-mec.md` (o que a escola exige na compra, e o que entregamos por escrito).

## A classificação, traduzida

| O que o CNE diz | O que isso significa no código |
|---|---|
| Tutor e personalização exigem cuidados adicionais, e são permitidos | O ambiente do aluno é legítimo, desde que supervisionado pelo professor, com revisão humana e monitoramento periódico |
| Correção e atribuição de nota são alto risco, exigem supervisão | Em objetiva, a IA corrige, mas nota só existe com aprovação humana registrada, qualificada e documentada — e o **registro da validação** guarda o que foi mostrado, o que o professor abriu e quem confirmou (D56) |
| Correção, avaliação, nota, conceito, mérito, **pré-correção** e **sugestão de nota** em redação e discursiva | Proibido. A IA não produz nada sobre o texto do aluno nessas modalidades: nem devolutiva, nem rascunho para o professor. Sobram rubrica, organização do lote e correção cega (D55) |
| Perfilização acadêmica individual e inferência comportamental relevante são alto risco | Sinais do tutor e alertas sobre aluno exigem avaliação de impacto algorítmico (D60), explicação acessível e caminho de contestação |
| Reconhecimento de emoções, pontuação social, vigilância biométrica, perfil psicológico ou comportamental classificatório, e uso comercial de dado educacional são **risco excessivo** | Não existem no produto, e não podem ser propostos. Proibição escrita e testada, não ausência de funcionalidade (D57) |
| Decisão só automatizada sobre promoção ou retenção é proibida | O sistema não implementa isso nem como sugestão aplicada sozinha |
| IA generativa sem supervisão é vedada na infantil e anos iniciais | Nosso recorte é anos finais e Ensino Médio (D43); descer de faixa reabre esta regra |

## As regras

1. **Nota só existe com autor humano.** Toda escrita em `Nota` exige `lancadaPor`
   preenchido por pessoa, em **todo** caminho: interface, job, importação em lote, seed,
   webhook. O jeito de garantir isso é estrutural, não por disciplina:

   ```ts
   // Correcao é o que a IA produz. Nota é o que vale.
   // Não existe construtor de Nota sem autor.
   class Nota {
     private constructor(readonly valor: number, readonly lancadaPor: UsuarioId) {}
     static aprovar(correcao: Correcao, professor: UsuarioId) { ... }
   }
   ```

   Checagem: `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts`, `conformidade-reviewer`.

2. **Nenhuma funcionalidade decide aprovação, reprovação ou encaminhamento de aluno.** Nem
   como recomendação automática aplicada sem alguém confirmar. Se aparecer um pedido desse
   tipo, ele é recusado e a conversa sobe para produto.
   Checagem: só a revisão garante (`conformidade-reviewer`).

2a. **Em redação e discursiva, a IA não chega nem a propor.** Nenhum campo, nem interno, nem
   rascunho, nem log, guarda nota, conceito, pontuação ou devolutiva gerada por IA sobre o
   texto de um aluno nessas modalidades (D55). O que a ferramenta entrega é rubrica e
   critérios antes da aplicação, organização do lote e apoio à correção cega. Se aparecer um
   pedido de "só um rascunho para o professor ver", ele é recusado: é exatamente o que a
   diretriz chama de pré-correção.
    Checagem: `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts`, `apps/api/src/assistente/assistente.int.test.ts`, `conformidade-reviewer`.

3. **Toda saída de IA que chega ao aluno passa por aprovação registrada**, com autor, data,
   e possibilidade de rejeitar com justificativa. A entrega do agente nasce pendente. Vale
   para material, atividade, devolutiva e adaptação.
   **A única exceção é a resposta do tutor** (D47), que não é aprovada uma a uma porque
   acontece em tempo real. Ela é supervisionada pelo item 4, com escopo e política da turma
   aplicados no servidor. A exceção não se estende a nenhum outro agente.
   Checagem: `apps/api/src/entrega/entrega.int.test.ts`, `apps/api/src/artefato/artefato.int.test.ts`, `conformidade-reviewer`.

4. **O tutor é sempre supervisionado.** Não existe uso invisível ao professor. Em sala, o
   professor acompanha ao vivo; em casa, fica registro e resumo.
   Checagem: `apps/api/src/tutor/tutor.int.test.ts`, `conformidade-reviewer`.

4a. **O agente tem identidade, e nunca se passa por pessoa** (D58; Decreto 12.880, art. 11, I
   e II). O time de IA é o produto: nome de função (D17), avatar e jeito próprio continuam. O
   que é proibido é afirmar ser humano quando o aluno pergunta, usar nome que sugira uma pessoa
   real, e simular vínculo afetivo ou dependência. A transparência exigida pela norma vem do
   produto inteiro se apresentar como IA e de toda saída de IA ser rotulada como tal.
    Checagem: `packages/core/src/ia/tasks/turno-do-tutor.test.ts`, `apps/web/src/componentes/ui/ia/avatar-com-funcao-e-selo.test.tsx`.

4b. **Nada induz uso excessivo, e sair nunca é mais difícil que entrar** (D59; Decreto 12.880,
   arts. 9º e 10). Proibido: recompensa por tempo de uso, sequência de dias, conteúdo que
   começa sozinho, rolagem infinita, notificação fora do horário útil da escola, esconder o
   ponto de parada, e caminho de recusar, sair ou revogar mais longo que o de aceitar.
    Checagem: `apps/web/src/areas/aluno/tutor.test.ts`, `e2e/aluno-tutor.spec.ts`, `apps/web/src/componentes/MenuDaPessoa.test.tsx`, `conformidade-reviewer`.

4c. **O Tutor só pesquisa fora do material em fontes aprovadas, e só quando a escola liberou e
   o professor ligou** (D68). Desligada por padrão, só no modo sala, sempre desligada em
   avaliação, com o assunto preso ao da turma e o Tutor continuando socrático. Web aberta para
   aluno não existe. Conteúdo de página da web é dado, nunca instrução para o agente.
    Checagem: só a revisão garante (`conformidade-reviewer`, `llm-integrator`).

4d. **O que o Tutor lembra é o trabalho do aluno, nunca a pessoa** (D66). A memória alcança
   tudo que ele fez no sistema — atividades, trabalhos, avaliações, sessões, com resultado,
   evolução e o resumo de sessão em formato fixo —, mais o que o professor pediu para reforçar
   e o tipo de adaptação registrada. Nenhum campo guarda texto, escrito por modelo ou por
   pessoa, sobre o jeito, o humor, a atenção ou o comportamento de um aluno. O aluno vê
   o que o Tutor sabe do desempenho dele e pode contestar.
    Checagem: só a revisão garante (`conformidade-reviewer`) que o aluno vê o que o Tutor sabe e pode contestar; o que há de teste: `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts`, `apps/api/src/tutor/tutor.int.test.ts`.

5. **A autonomia de cada agente é declarada em código e visível ao coordenador**, em
   português comum, não em jargão. A escola precisa poder responder "o que essa IA faz
   sozinha?" apontando para uma tela. Ver `docs/agentes.md`.
   Checagem: `apps/api/src/governanca/governanca.int.test.ts`, `packages/shared/src/governanca/governanca.test.ts`.

6. **A auditoria responde "o que a IA gerou, quem aprovou e quando"** para qualquer item,
   a qualquer momento. É essa consulta que ganha a reunião com a coordenação, e é ela que o
   dossiê de conformidade exporta (D61, `docs/conformidade-mec.md` seção 5).
   Checagem: `packages/core/src/auditoria/auditoria.int.test.ts`, `apps/api/src/entrega/entrega.int.test.ts`, `apps/api/src/governanca/governanca.int.test.ts`, `conformidade-reviewer`.

6a. **Funcionalidade de alto risco não entra sem Avaliação de Impacto Algorítmico escrita**
   (D60): Tutor, correção de objetiva, diagnóstico por habilidade, sinais e alertas,
   adaptação. Seis etapas, incluindo o escopo negativo e o procedimento de suspensão do
   agente. Roteiro em `docs/conformidade-mec.md` seção 7.
    Checagem: só a revisão garante (`conformidade-reviewer`).

7. **Supervisão não é vigilância.** O professor vê uso e dificuldade de aprendizagem: quem
   travou, quem pediu resposta pronta, qual dúvida se repetiu. Não vê uma janela permanente
   sobre o comportamento do aluno, e o sistema não infere estado emocional. A diferença
   entre as duas coisas é o que mantém a confiança da família. **Tempo ocioso e navegação do
   aluno não são medidos.** A única exceção é a contagem de saídas da aba **durante uma
   avaliação online** (D70): fato mostrado só ao professor da turma, com o aluno avisado antes,
   sem consequência automática, presa àquela avaliação e nunca somada por aluno. Pedido de
   ligar isso fora de avaliação, ou de "avisar quando o aluno usa outra IA", é recusado e sobe
   para produto com parecer.
   Checagem: só a revisão garante (`conformidade-reviewer`); o que há de teste: `apps/api/src/tutor/tutor.int.test.ts`, `packages/core/src/ia/tasks/turno-do-tutor.test.ts`, `packages/core/src/db/schema/mvp/mvp-tables.int.test.ts`.

8. **Medir o professor também não é vigiar** (D45). O professor vê o próprio painel; a
   coordenação vê por série e disciplina, só quando há dois ou mais professores no recorte
   (D45 revista), e abre o nominal só com registro em auditoria.
   Não existe ranking de professor, e nenhuma métrica alimenta decisão sobre ele
   (avaliação funcional, sanção, dispensa), nem como sugestão. A conversa do professor com
   o chat nunca é visível à coordenação. É o que mantém a confiança do professor, sem a qual
   a escola não renova.
   Checagem: `apps/api/src/governanca/governanca.int.test.ts`, `apps/api/src/assistente/assistente.int.test.ts`, `conformidade-reviewer`.

9. **Recusar a ferramenta não gera indicador** (D64). Não existe, em nenhuma tela, ranking de
   uso por professor, lista nominal de adoção, alerta de "professor que não usa" nem meta de
   uso por professor. Adoção é agregada. O MEC exige que a rede garanta que nenhum professor
   seja penalizado por não usar uma ferramenta, e a autonomia didático-pedagógica dele vem
   antes da nossa métrica de produto.
   Checagem: `apps/api/src/governanca/governanca.int.test.ts`, `apps/web/src/areas/coordenacao/governanca/textos-da-governanca.test.ts`, `conformidade-reviewer`.

## Como isso é checado

O subagente `conformidade-reviewer` audita toda tarefa que envolva nota, correção, tutor,
autonomia de agente, decisão sobre aluno ou indicador de professor. O veto dele é falha da
tarefa.
