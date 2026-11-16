# Achados das revisões — `tasks/correcoes/2026-11-16-e2e-enviar-material-no-celular.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-16 18:51:43 · `tasks/correcoes/2026-11-16-e2e-enviar-material-no-celular.md`

VEREDITO: APROVADO
Tela vista: sim (4 fotos lidas: /coordenacao/material no computador e no celular, escola cheia e vazia)
Estados: ok. O vazio do resumo ("Ainda não há material para resumir.") não se desculpa, porque o convite vem logo abaixo, no card "Nenhum material ainda" com o botão "Enviar material". O carregando (`LoadingState` "Carregando o resumo…", `ResumoDoMaterial.tsx:148`) e o erro (`ErroDoResumo`, com tentar de novo) continuam como estavam. Conferi esses dois pelo código.
Acessibilidade: sem mudança. O "Carregando…" continua com `role="status"`, e o teste novo acha o resumo pela região nomeada.
Chromebook fraco: sem impacto. A mudança só encurta um texto.
Celular: a 360 px não há rolagem horizontal nem texto cortado, e "Enviar material" tem cerca de 44 px de altura. O resumo agora ocupa uma linha no celular, então o botão não desce quando o resumo chega. Esse deslocamento de 40 px era a causa do toque perdido na esteira. No computador a tela é a mesma de antes. A tela não rola a 1366 × 768, e nenhuma tela da lista `Rolam` é alvo de RF de "cabe".
Ação oficial protegida: sim. Nada oficial muda nesta tarefa. O envio de material continua passando pelo diálogo.
Bloqueantes: nenhum.
Recomendações:
- O deslocamento continua possível na escola com material. A tabela do resumo, ao chegar, tem altura diferente da do "Carregando…" e empurra a lista e o botão. A correção já registra isso como fora do escopo. Vale a spec seguinte considerar o resumo depois da lista, ou uma altura mínima reservada.
- A frase `ResumoDoMaterial.tsx:74` poderia ser curta no código. O comentário é longo e repete o que está no documento da correção.
- O teste novo (`e2e/material-resumo.spec.ts:119`) compara `y` com `toBe` exato. Se o botão ganhar subpixel por zoom ou fonte, pode ficar instável. Considere uma tolerância de 1 px.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-16 18:51:57 · `tasks/correcoes/2026-11-16-e2e-enviar-material-no-celular.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A mudança troca um texto de tela e acrescenta um caso de e2e, sem tocar em API, banco, job, seed ou importação. Todos com autor humano? Não se aplica, porque nada aqui grava Nota.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhuma saída de IA nova nem alterada.
Supervisão do tutor: ok. Não foi tocada.
Autonomia declarada e visível: sim. Não mudou, e a tela de material não é onde ela aparece.
Bloqueantes: nenhum
Recomendações: nenhuma da regra 70.

**O que a mudança faz**
- Em `apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx:74-75`, o texto do resumo vazio fica só com "Ainda não há material para resumir.". A frase "Quando a escola enviar o primeiro PDF, os números aparecem aqui." saiu.
- Em `e2e/material-resumo.spec.ts:119-138`, o caso novo segura a resposta de `/v1/materiais/resumo` e exige que o botão "Enviar material" fique no mesmo lugar quando ela chega.
- Nenhum dos itens 1 a 9 é alcançado: não há Nota, decisão sobre aluno, saída de IA, tutor, autonomia, auditoria, vigilância, discursiva nem indicador de professor.

**O que as fotos mostram** (`coordenacao--coordenacao-material--{computador,celular}.png` e `vazia--coordenacao--coordenacao-material--{computador,celular}.png`)
- Não há saída de IA na tela. O resumo e a lista são dado da escola, então não precisam do rótulo de IA.
- Não há nota, conceito nem sugestão de nota.
- O texto do vazio da lista cita o Assistente e o Tutor pelo nome da função, que é o que a D58 pede, e diz que eles sempre citam a página. Não sugere nenhuma autonomia que eles não tenham.
- Nada puxa a pessoa a usar mais. O "Sair" continua visível no celular e no computador, como pede a D59.
- A foto da escola cheia está igual à da vazia, sem material. Isso é da vitrine e não da regra 70; fica para o `frontend-reviewer`, se ele achar que importa.

## infra-guardian · 1ª rodada · APROVADO · 2026-11-16 18:51:58 · `tasks/correcoes/2026-11-16-e2e-enviar-material-no-celular.md`

VEREDITO: APROVADO
Caminho quente tocado: nenhum
Rate limit: ok
Fila e prioridade: ok
Concorrência: protegida
Índice e paginação: ok
Degradação de IA: não se aplica
Migration: não se aplica
Métrica e alerta: ok
Bloqueantes: nenhum. A tarefa só encurta um texto que aparece quando a escola ainda não tem material (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx:74-75`) e acrescenta um caso no e2e (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/material-resumo.spec.ts:119-138`). Não mexe em endpoint, query, fila, IA, migration nem estado no servidor. A tela continua fazendo o mesmo pedido a `/v1/materiais/resumo`, sem pedido novo nem consulta repetida. O teste segura a resposta com `page.route` e depois a deixa seguir, sem chamar provedor pago.
Recomendações:
- Na escola que já tem material, o botão "Enviar material" continua mudando de lugar. A tabela do resumo, quando chega, tem altura diferente da linha "Carregando o resumo…" e empurra o botão para baixo. A tarefa já registra isso como fora do escopo. Às 10h, com rede lenta na escola, a resposta do resumo demora mais, a janela em que o toque cai ao lado do botão fica maior, e a coordenadora no celular pode perder o toque. Vale uma correção própria: pôr o resumo depois da lista e do botão, ou reservar espaço para ele.
- O teste compara o `y` do botão com igualdade exata (`toBe(antes?.y)`). Se o arredondamento de subpixel variar, ele pode falhar sem motivo real. Uma tolerância de 1 px evitaria isso sem tirar do teste o que ele prova, porque o defeito que ele pega é de 40 px.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-16 18:51:58 · `tasks/correcoes/2026-11-16-e2e-enviar-material-no-celular.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A tarefa só encurta o texto de uma linha que aparece quando a escola ainda não tem material e acrescenta um caso de e2e. Não muda campo, DTO, rota, consulta nem migration.

Fora da tabela de dados do docs/lgpd.md: nada. Nenhum campo novo.

Autorização por objeto: ok. Nenhuma rota nova nem alterada. O caso novo só segura a resposta de `/v1/materiais/resumo` com `page.route` e depois a deixa seguir, sem mudar o que a API devolve nem quem pode pedir. O caso que já existia, em que o professor não alcança o resumo, continua no arquivo.

Logs: limpos. O diff não tem nenhum log.

Auditoria: presente. Nenhuma ação que a regra 20, item 10, obriga a auditar foi tocada: leitura de dado de aluno, exportação, nota, permissão ou aprovação de saída de IA.

Envio externo: nenhum. A tarefa não chama modelo e não manda dado para fora.

Seed/fixture: sintético. O caso novo cria a coordenadora com `criarEquipeComSenha('coordenador')` e a estrutura com `montarEstruturaNoBanco`, e o arquivo declara que os nomes são inventados pelo teste. As quatro fotos (escola cheia e vazia, computador e celular) mostram só "Colégio sintético da vitrine cheia e312ec3d" ou "… vazia 14150ba9" e "Coordenadora sintética 898b0edb" ou "… 2e3a4f1f". Nada de dado real.

Fotos da tela: em `/coordenacao/material`, a coordenação vê o próprio nome no menu da pessoa, as abas, o resumo vazio ("Ainda não há material para resumir.") e o convite para enviar o material. Nenhuma tela mostra nome, matrícula ou conteúdo de aluno, e nenhum dado de pessoa aparece para um papel que não deveria vê-lo. O texto novo vem de `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx:75`.

Pergunta de fechamento: a tarefa não muda o que o sistema guarda sobre um aluno nem para onde isso vai. A resposta continua a mesma de antes, pelos caminhos do titular que já existem.

Bloqueantes: nenhum.

Recomendações:
- A foto da "escola cheia" em `/coordenacao/material` está igual à da escola vazia, sem nenhum material. Isso não afeta a regra 20, mas a vitrine deixa de mostrar como a tabela do resumo aparece para a coordenação numa escola com material. Fica para o `frontend-reviewer` e para a retro.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-16 18:52:00 · `tasks/correcoes/2026-11-16-e2e-enviar-material-no-celular.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. O vazio do resumo continua sendo um estado próprio, como pede o `cenarios.md` de ingestao-do-material (linha 223). Só o texto ficou mais curto, e nenhum documento de spec citava a frase que saiu: a busca só a encontrou em `achados/` e no próprio documento da correção.

Portão local: carimbo válido para o código atual (typecheck, lint, segredo, dependências, unidade, alvo).

Bloqueantes: nenhum

Fotos: nas quatro, o resumo vazio aparece em uma linha ("Ainda não há material para resumir.") e, logo abaixo, "Nenhum material ainda" com o convite e o "Enviar material". A tela mostra o que a correção descreve e mais nada. O convite para agir, que a regra 50 (item 5) exige do vazio, continua no vazio da lista, no mesmo campo de visão, inclusive a 360 px (`vazia--coordenacao--coordenacao-material--celular.png`).

Recomendações:
- O mesmo deslocamento acontece na escola com material: a tabela do resumo, ao chegar, tem altura diferente do "Carregando o resumo…" e ainda empurra o "Enviar material" no celular (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx:72`). A correção já registra isso como fora dela. Falta levar ao `TODO.md`, para não se perder: pôr o resumo depois da lista, ou reservar a altura dele.
- `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx:74` tem um comentário de linha única muito comprido. O motivo dele vale (prende o texto a uma linha), mas cabe em uma frase curta, com a explicação longa ficando no documento da correção.
- A garantia vale só por coincidência de texto: as duas mensagens cabem numa linha a 360 px. Se o vazio do resumo crescer de novo, o caso novo em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/material-resumo.spec.ts:119` pega a regressão. Mesmo assim, vale um comentário perto do teste de unidade (`ResumoDoMaterial.test.tsx`) avisando que esse texto tem limite de comprimento.

## test-engineer · 1ª rodada · APROVADO · 2026-11-16 18:52:17 · `tasks/correcoes/2026-11-16-e2e-enviar-material-no-celular.md`

VEREDITO: APROVADO

Cenários exigidos:
- Caminho feliz: numa escola nova, no celular, o "Enviar material" fica no mesmo `y` antes e depois de o resumo chegar.
- O caso exato da esteira: o toque que já saiu cai no botão, e `a2-assistente.spec.ts:174` passa no `celular`.
- Caso de borda: o resumo chega depois da lista, que é a ordem da esteira com CPU ×4.
- Caso de borda: escola com material, quando a tabela do resumo chega depois do "Carregando…".
- Caso de borda: o aviso da migração ou o erro da releitura aparecem acima do botão.
- Permissão e isolamento: a tarefa não mexe neles. O caso do professor e o da segunda pessoa no mesmo arquivo continuam como estavam.

Cobertos:
- O caminho feliz e o caso do resumo depois da lista, por `e2e/material-resumo.spec.ts` › "o "Enviar material" não sai do lugar quando o resumo termina de carregar: o toque que já saiu não cai ao lado dele".
  - O `page.route` é instalado no `antes` do `abrirMaterial`, antes de a sessão abrir. O teste segura a resposta, espera o "Carregando o resumo…" e o botão, mede, solta e compara o `y`.
  - É determinístico: não depende de relógio nem de a máquina estar folgada.
  - A asserção é sobre o resultado, a posição do botão, e não sobre o código ter rodado.
  - Se o botão sumir, `antes.y` (número) contra `undefined` falha. Não há caso em que `undefined === undefined` passe, porque o `toBeVisible` vem antes da primeira medida.
- O bloco de mutação é coerente com o `git diff`. Ele devolve o texto longo e declara `projeto: celular`, e o vermelho descrito é o motivo certo: `Expected: 580`, `Received: 620`. No `chromebook` o texto cabe numa linha, e por isso o caso passa lá; está correto declarar só o `celular`. `--faltando: 0`.
- O texto removido não é citado em nenhum teste, e-mail ou e2e (`grep`). Só aparece no documento da tarefa e no achado histórico `tasks/prd-ingestao-do-material/achados/11_task.md:256`.
- Não há `.skip`, teste comentado nem mock que esconda a regra. O `route.fallback()` deixa a API de verdade responder.
- O caso da esteira está no "Verde" do documento (18 passed, com `a2-assistente.spec.ts` incluído).
- A foto `vazia--coordenacao--coordenacao-material--celular.png` confirma que o vazio do resumo ocupa uma linha.

Bloqueantes: nenhum.

Recomendações:
1. **Escola com material (mesma classe de defeito, ainda aberta).** Quando a tabela do resumo chega, ou o aviso da migração aparece (`ResumoDoMaterial.tsx:67-72`), a altura muda e o botão continua descendo no celular. É o mesmo toque perdido para a coordenadora em rede lenta, só que na escola em uso. O documento já registra isso em "Fica de fora". Vale virar item no `TODO.md` ou uma tarefa, com um e2e como este: segurar o resumo com material, medir e soltar. Uma saída é pôr o resumo depois da lista.
2. **O erro da releitura também empurra o botão.** `ErroDoResumo` aparece ao lado do resumo que já está na tela (`ResumoDoMaterial.tsx:66`) e desloca o botão no meio do uso. Menos provável que o caso acima, mas é o mesmo mecanismo.
3. **Prova extra, opcional.** Além do `y` igual, o teste poderia tocar o botão logo depois de `segurada.abrir()` e exigir o diálogo, como o fluxo da esteira faz. A comparação de posição já prova a regra, então isso só fecharia o ciclo com o gesto real.
4. **Comentário de uma linha.** O comentário novo em `ResumoDoMaterial.tsx:74` fica dentro do JSX e explica o porquê, o que é bom. Ele depende de o "Carregando o resumo…" continuar com uma linha. Se o `LoadingState` mudar de altura, só este e2e avisa, o que é aceitável.

Arquivos relevantes:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/apps/web/src/areas/coordenacao/material/ResumoDoMaterial.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/e2e/material-resumo.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specreengenharia-continuacao--l1/tasks/correcoes/2026-11-16-e2e-enviar-material-no-celular.md
