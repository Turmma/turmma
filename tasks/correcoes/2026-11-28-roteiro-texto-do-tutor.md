# Correção — o roteiro da demonstração manda ler o texto antigo do Tutor na prova com janela

**Origem:** `tasks/prd-avaliacao-e-correcao/validacao.md` de `avaliacao-e-correcao` (rodada 2, §4, achado maior 2).
**Subagentes obrigatórios:** `test-engineer`, `revisor-geral`
<!-- Os guardiões vieram no PEDIDO do Orquestrador: `test-engineer` (de toda correção) e `revisor-geral`. A correção leva 1 arquivo
     fora de `tasks/`, só em `docs/`, e não toca `.github/`, `tools/ci/` nem `tools/processo/`: o `revisor-geral` vem do pedido, não
     do limite do passo 5. -->

## Sintoma

`docs/roteiro-da-demonstracao.md:226-227` (passo 3, item 2) manda a pessoa ver, na lista "Para fazer" da aluna, o texto
"Avaliação: o Tutor fica pausado até quem dá a aula encerrar". A atividade que o próprio passo aplica (seção 5, "Passo 3", item 1) é
avaliativa **com janela**, e a tela diz `AVISO_DA_PROVA`: "Avaliação: o Tutor fica pausado durante a prova, da abertura até
ela fechar." (`apps/web/src/areas/aluno/atividades.ts:27`). O e2e do roteiro já espera o texto novo
(`e2e/roteiro-da-demonstracao.spec.ts:482`). O roteiro é lido em voz alta na demonstração e contradiz a tela.

## Fora desta correção

Nada: a árvore estava limpa.

## Causa

A correção `2026-11-28-textos-do-tutor-na-prova` (`aa21262e`) trocou o aviso do aluno na prova com janela (`avisoDaAvaliacao`) e
acompanhou o e2e do roteiro, mas o documento `docs/roteiro-da-demonstracao.md`, que é lido por gente e não por teste, ficou com o
texto de antes. O `test-engineer` anotou o trecho na 2ª rodada daquela correção ("Recomendações sem aplicar"), e a validação o
registrou como achado maior. Nenhum teste confronta o texto do roteiro com o da tela: só o e2e, que cita a frase nova.

## Teste que reproduz

Não há teste determinístico para o texto de um documento de roteiro: nada lê `docs/roteiro-da-demonstracao.md` e o compara com a
tela (o e2e do roteiro prova a tela, não o documento), e criar uma guarda nova para uma frase é desenho, não esta correção. A
evidência que substitui o vermelho é a busca da frase antiga, que acha o trecho no HEAD e não acha depois:

```bash
grep -n "pausado até quem dá a aula" docs/roteiro-da-demonstracao.md   # antes: 226 · depois: nada
grep -n "AVISO_DA_PROVA\|durante a prova, da abertura" e2e/roteiro-da-demonstracao.spec.ts apps/web/src/areas/aluno/atividades.ts   # a frase certa, na tela e no e2e
```

## Correção

Só `docs/roteiro-da-demonstracao.md`, no passo 3, item 2: o texto entre aspas passa a ser o de `AVISO_DA_PROVA` ("Avaliação: o
Tutor fica pausado durante a prova, da abertura até ela fechar."), o mesmo que `e2e/roteiro-da-demonstracao.spec.ts:482` espera. A
frase do "Diga" ("Na avaliação o Tutor pausa sozinho, no servidor.") continua verdadeira e fica como está. Nenhum código, nenhum
contrato.

## Mutações

--faltando: 0 linhas (0 blocos, 0 motivos)

Nenhuma cláusula nova: a correção só troca o texto de um documento em `docs/`. Não há linha de código para mutar.

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| test-engineer (1ª) | "esta é a segunda vez que o roteiro descola da tela sem nenhum teste perceber. Vale registrar como candidata a desenho futuro uma guarda que confira as frases entre aspas do roteiro com as que o `e2e/roteiro-da-demonstracao.spec.ts` espera. Não é para esta correção." | `TODO.md` e a retro da funcionalidade: é guarda nova, desenho e não correção de texto; o próprio revisor diz que não é para esta correção. |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-28 12:41:06 | 2026-11-28 12:41:29 | `revisor-geral` | 1 | APROVADO | ada6896d08a005d25 |
| 2026-11-28 12:41:05 | 2026-11-28 12:41:36 | `test-engineer` | 1 | APROVADO | aabbcd66bdd5d67bf |
