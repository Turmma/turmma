# Estado da execução — onboarding-por-convite

## Agora
- **03/11 16:03:** F2 cortada em duas specs por decisão do Joaquim (`648bd616`); 16 tarefas geradas (`ebae5b1c`). Aviso da D79 dado; **a construção começa às 16:31**, na primeira vigia depois da hora, sem objeção do Joaquim no meu terminal nem no do Arquiteto (a pausa anterior era só para a VM). Vigia ligada. Próxima: tarefa 1.0 (grande)
- **03/11:** Revisão da spec aprovada na rodada 8 (`d8e435d7`). Ao gerar as tarefas, 7 saíram grandes demais; cortadas passam de 20 (limite do `criar-tasks`). **Aguardando o Joaquim no terminal do Arquiteto:** 1) duas specs (recomendado), 2) uma spec com 20 tarefas, 3) uma spec com o PRD recortado. Nada parte antes da resposta
- **03/11 (VM de volta):** Arquiteto reiniciado no andar; `PEDIDO de retomada` enviado (rodada 8 da revisão da spec só com o test-engineer, depois `criar-tasks`). **Espero:** o `/seguir RELATÓRIO` do Arquiteto. Construção não parte sem a palavra do Joaquim
- **03/11 (reinício da VM):** PRD (`a2afc042`, recorte 1: sem Semana, que vai à F2b, e sem Classroom) e Tech Spec (`7526c906`) feitos; revisão da spec na rodada 7. O Joaquim pediu um ponto seguro para reiniciar a VM e **não iniciar a F2** (construção). Rodada 7 **REPROVADA** (privacy e infra APROVADO; test-engineer REPROVADO em 2 cenários, já corrigidos no `cenarios.md`); o Arquiteto parou a pedido, em `be78072a` com push. **Na volta (`/seguir`):** reiniciar o Arquiteto no andar e mandar `PEDIDO de retomada` da revisão da spec: rodada 8 só com o test-engineer, depois o `criar-tasks` (Tech Spec em 2.696 de 2.700 palavras); a construção só parte com a palavra do Joaquim. Vigia desligada
- **03/11:** Andar aberto depois do pouso da X8 (`d39802c8`), da retro (`f6f5b135`) e da correção M1 (`a3119593`). Arquiteto reiniciado no andar, `PEDIDO` com a fase `sem-prd`. **Espero:** o Arquiteto; ele para nas perguntas e na aprovação do PRD com o Joaquim, no terminal dele, e avisa da Tech Spec e da lista de tarefas
- **Devo ainda (vindo da X8, adiado para depois do pouso dela):** (1) correção avulsa: renomear `apps/web/src/components/ui/onca/fidelidade-ao-mockup.test.tsx` (ex.: `traco-da-onca.test.tsx`; conferir o caminho depois da X8), cabeçalho sem mudar valor, nome em `docs/interface.md` 9.7 e no `TODO.md` (D80 revista); (2) dividir `docs/interface.md` em `docs/interface/` (Arquiteto divide; correção avulsa leva as ~200 citações e `apps/web/src/estilos.test.ts`), pedido do Joaquim em 30/10; (3) fotos do painel da Operação Turmma (abas Escolas e Uso, diálogo de nova escola) com o ambiente de teste livre, pedido do Joaquim em 30/10. Ordem: o Joaquim escolheu "M1, depois F2" em 02/11; estas três esperam um intervalo do F2 ou a palavra dele
- **Base:** `spec/onboarding-por-convite` em `a3119593`

## Concluídas
| Tarefa | Commit | Modelo | Rodadas | Observação |
|---|---|---|---|---|

## Esperando o Joaquim
## O que falhou
## O que decidi sem perguntar
- 02/11, fechamento da X8: o censo deu 25 casos acima de 2/3 do prazo em arquivos que a X8 tocou só no rename; tratei como dívida da `develop` (linha no `TODO.md`), sem correção, e disse no pedido de pouso
