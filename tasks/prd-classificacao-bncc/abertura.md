# Abertura — classificacao-bncc (F4b)

Esta spec nasceu do corte da F4 em 11/11/2026 (Joaquim), antes da Tech Spec: o PRD da F4 dava cerca de 21 tarefas. O
PRD está aprovado (`prd.md` aqui, que aponta os RF do PRD da F4). Ela começa **depois da F4** pousar. Ao abrir o andar,
o Arquiteto:

1. Lê o PRD da F4 inteiro, a Tech Spec da F4 (série, capítulo e edição, como ficaram) e o código que a F4 deixou.
2. Escreve a Tech Spec a partir da fase `sem-techspec`, com as perguntas dela ao Joaquim. A primeira: a IA no worker
   para a classificação em lote (gateway, consumo e suspensão do `packages/core`), sem o resto da 47.0 da X6.
3. Usa a pesquisa da BNCC de 11/11/2026 (resumo na seção 10 do PRD da F4): códigos, blocos `EF67`/`EF69`/`EF89`, EM por
   área, cerca de 1.300 habilidades no EF e 183 no EM, o dataset `bncc-dados` (CC BY 4.0), e o que ficou ⚠️ não
   verificado.
4. Põe na Tech Spec a contração que a F4 deixou (Tech Spec da F4, seção 3): o backfill de séries e licenças de novo,
   idempotente, para o que entrou na janela; o check `(titularidade = 'terceiro_com_licenca') = (licenca_id is not
   null)` com `NOT VALID` e `VALIDATE`; e a saída de `material.licenciante` e dos dois checks dele.
