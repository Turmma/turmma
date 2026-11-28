# Achados das revisões — `tasks/correcoes/2026-11-28-roteiro-texto-do-tutor.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-28 12:41:29 · `tasks/correcoes/2026-11-28-roteiro-texto-do-tutor.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok
Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")
Bloqueantes: nenhum
Recomendações:
- `tasks/correcoes/2026-11-28-roteiro-texto-do-tutor.md`, seção "Sintoma": o texto diz que a atividade é aplicada no "passo 5, item 1". No roteiro, esse item é o 1 do Passo 3, que fica na seção 5. Basta ajustar a referência no registro da correção.

O que conferi:
- **A frase nova bate com a tela.** As linhas 226-227 de `docs/roteiro-da-demonstracao.md` trazem agora o mesmo texto de `AVISO_DA_PROVA` (`apps/web/src/areas/aluno/atividades.ts:27`). É a frase que a lista do aluno mostra quando a avaliação tem janela (`Atividades.tsx:46` chama `avisoDaAvaliacao`), e é a que o e2e espera (`e2e/roteiro-da-demonstracao.spec.ts:482`).
- **O caso do roteiro é o de prova com janela.** O Passo 3, item 1, exige "Abre em", "Fecha em" e duração. Por isso o aviso certo é o da prova, e não `AVISO_DA_AVALIACAO`.
- **Não sobrou a frase antiga no roteiro.** A busca por "pausa" no documento só acha as linhas 226-227. A frase antiga continua de propósito em `atividades.ts:21` e nos e2e `aluno-inicio`/`aluno-atividade`: ali ela é o aviso certo para a avaliação sem janela, então não é resto esquecido.
- **A frase do "Diga" continua certa.** "Na avaliação o Tutor pausa sozinho, no servidor." vale para os dois casos.
- **O diff é só isso.** São 2 linhas em um único arquivo de `docs/`, sem código e sem contrato. Não fez nada fora do que a correção pediu.

## test-engineer · 1ª rodada · APROVADO · 2026-11-28 12:41:36 · `tasks/correcoes/2026-11-28-roteiro-texto-do-tutor.md`

VEREDITO: APROVADO

**Cenários exigidos:** esta correção muda só um texto em `docs/roteiro-da-demonstracao.md`, sem código, regra nova, dado de escola, permissão ou concorrência. O único cenário que vale é este: a frase que o roteiro manda ler em voz alta, no passo 3, item 2, tem de ser igual à que a aluna vê na prova com janela. Essa frase é a constante `AVISO_DA_PROVA`.

**Cobertos:**
- **A frase bate com a tela e com o e2e.** O novo texto em `docs/roteiro-da-demonstracao.md:226-227` é "Avaliação: o Tutor fica pausado durante a prova, da abertura até ela fechar." É, palavra por palavra, o de `apps/web/src/areas/aluno/atividades.ts:27` e o que `e2e/roteiro-da-demonstracao.spec.ts:482` espera.
- **A atividade do roteiro tem janela.** O item 1 do mesmo passo (linhas 219-225) aplica a atividade como avaliativa, com "Abre em", "Fecha em" e 40 minutos. Então `avisoDaAvaliacao` devolve `AVISO_DA_PROVA`, e não `AVISO_DA_AVALIACAO` (`atividades.ts:31`).
- **A frase antiga sumiu do roteiro.** A busca por "pausado até quem dá a aula" não acha mais nada no documento, e nenhuma outra frase dele fala da pausa do Tutor.
- **A frase antiga que sobra no código está certa.** Ela continua em `e2e/aluno-inicio.spec.ts:18`, `e2e/aluno-atividade.spec.ts:19` e `atividades.ts:21`. É `AVISO_DA_AVALIACAO`, o aviso da avaliação sem janela, que segue válido e fica fora desta correção.
- **Mutações:** "--faltando: 0 linhas" está coerente com o diff, que não traz cláusula nova nem toca `apps/*/src` ou `packages/*/src`. Não falta nenhum bloco.
- **Sem teste de reprodução:** a justificativa é aceitável. Nenhum teste lê o documento, e criar uma guarda nova só para uma frase seria desenho novo, não correção. O grep antes e depois serve de evidência. Também não aparece `.skip`, mock nem provedor de IA.

**Bloqueantes:** nenhum.

**Recomendações:**
1. Em `docs/roteiro-da-demonstracao.md:227`, o trecho `fechar.".` deixa ponto final dentro e fora das aspas. Em texto lido em voz alta não muda nada, mas dá para tirar o ponto de fora, como nos outros "Aparece:" do roteiro. Não mexa no ponto de dentro: ele faz parte da frase da tela.
2. Para a retro: esta é a segunda vez que o roteiro descola da tela sem nenhum teste perceber. Vale registrar como candidata a desenho futuro uma guarda que confira as frases entre aspas do roteiro com as que o `e2e/roteiro-da-demonstracao.spec.ts` espera. Não é para esta correção.
