# Achados das revisões — `tasks/prd-camada-ia/6_task.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## test-engineer · 1ª rodada · REPROVADO · 2026-11-20 23:23:32 · `tasks/prd-camada-ia/6_task.md`

VEREDITO: REPROVADO

**Cenários exigidos:** as faltas da 7ª rodada para a 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0 e 9.0; as da 10.0, como o prompt as resume; e a carga da `cenarios.md` §5, agora na 11.0.

**Cobertos:** quase todas as faltas foram corrigidas.

- **2.0:** a precedência com R$ 3, o "hoje" de São Paulo, as duas vigências e o `EXPLAIN` num ano da maior escola.
- **3.0:** a corrida com a escola sem linha, o `GET /redes` e `/escolas`, a rede inexistente, e professor e aluno com 404. A referência "(7.0)" foi corrigida.
- **4.0:** o alerta do teto cita "Classificação do material atrasada" (linha 60).
- **5.0:** `ordem=custo` em `/escolas` e o 404 em `…/uso-ia`.
- **6.0:** os textos do Painel por estado, os estados da Governança, "Atualize a página", o e2e a 360 px e o `EXPLAIN` do `porFuncao`.
- **7.0:** os rótulos, "Vale hoje", "Orçamento salvo.", os limites com `aria-describedby` e `role=alert`, `Esc` com foco preso, os alvos de 24 px e "Atualize a página".
- **8.0:** "Ver meses" a 360 px, carregando e erro, o mês em pt-BR, a acessibilidade e "Atualize a página".
- **9.0:** cada recusa da subida tem linha própria (linhas 56 a 59), a chave nunca aparece no erro, produção aceita outro provedor e `staging` aceita o falso, a reserva recusada publica 0, e estão lá o reinício, as duas tarefas e o motivo `categoria_faltando:conversa_do_aluno`.
- **10.0:** a reserva recusada e depois corrigida no roteamento (linha 56), a repetição na reserva (53), `pelo_provedor_de_reserva` com `true` e `false` (58), o 429 sem quinta chamada (52) e `IA_FALHA_FALSA` recusado em produção (60).
- **11.0:** as três linhas de carga (55 a 57), com as subtarefas 11.5 e 11.6 e os arquivos `infra/scripts/carga.ts`, `infra/k6/reserva.js` e `infra/test/carga.test.ts`.

Todos os documentos ficaram dentro do teto: 1.0 e 3.0 estão em 800 palavras exatas, as outras entre 600 e 799.

**Bloqueantes:**

1. **A Governança não testa os textos do orçamento** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/6_task.md:54`).
   - **O problema:** a subtarefa 6.4 põe a porcentagem e o aviso na Governança, e a `cenarios.md` §4 dá os mesmos textos por estado a "Coordenação, Painel e Governança". A linha 54 só testa o Painel, e a linha 55 só testa o texto por função e os estados de carregamento. Se a Governança mostrar o aviso errado, ou não mostrar o aviso de 100, nenhum teste falha.
   - **A correção:** trocar "Painel, o texto exato…" por "Painel e Governança, o texto exato da `cenarios.md` §4 por estado…". São duas palavras a mais e o documento fica com 794.
   - Essa falta vem da minha 7ª rodada, não da correção: lá eu pedi só o texto do Painel.

2. **Referência deixada para trás quando a carga mudou de tarefa** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/9_task.md:75`).
   - **O problema:** "Fora do escopo" ainda diz "O roteamento e a carga (10.0)", mas a carga agora é da 11.0.
   - **A correção:** "O roteamento (10.0); a interrompida e a carga (11.0); os relatórios reais (13.0)."
   - Não falta teste aqui. Conto como bloqueante porque a correção desta rodada, que movia a carga, deixou esse erro, e a mesma classe de erro foi exigida na rodada anterior. É uma troca de uma linha.

**Recomendações:**

- **4.0, linha 55 ou uma linha nova:** a subtarefa 4.3 diz "sem série em escola `sem_orcamento` ou `sem_aluno_ativo`", mas a tabela não tem teste para isso. Se a medida dividir por zero alunos, a série pode dar infinito e o alerta de 100% dispara à toa. Sugiro `| escola sem_orcamento e sem_aluno_ativo: nenhuma série publicada | I | sem divisão por zero |`. Cabe, porque o documento fica em cerca de 799 palavras.
- **11.0, linha 56:** a queda por prazo e o balde cheio no pico estão juntos por ponto e vírgula. Os dois resultados estão escritos, então nenhum ficou sem teste, mas são duas situações diferentes da carga e cada uma deve dar o seu número no relatório.

Arquivos auditados, todos em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--speccamada-ia/tasks/prd-camada-ia/`: `tasks.md`, `1_task.md` a `13_task.md` e `cenarios.md`.
