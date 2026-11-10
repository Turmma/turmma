# Achados das revisões — `tasks/correcoes/2026-11-10-e2e-professores-corrigir-email.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-10 16:57:36 · `tasks/correcoes/2026-11-10-e2e-professores-corrigir-email.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok

Portão local: carimbo válido (typecheck, lint, segredo, dependencias, unidade, alvo)

Bloqueantes: nenhum

O pedido da correção foi cumprido, e só ele:
- **A constante:** `ACOES_DO_ESTADO` (`e2e/professores.spec.ts:48-50`) agora lista `['Corrigir o e-mail', 'Refazer convite', 'Revogar convite']` em `pendente` e `vencido`. É a mesma ordem do painel nas fotos `coordenacao--coordenacao-professores--Ana-convidado--computador.png` e `--celular.png`. Os quatro estados sem ação seguem vazios.
- **O alvo de toque em `:1130`:** o caso já percorre `ACOES_DO_ESTADO.vencido` com `alvoDeToque` (`:1158`). Com a constante nova, passa a medir também o "Corrigir o e-mail", sem outra mudança.
- **Outros pontos que contam ações:** as asserções de zero ação (`:445`, `:611`, `:741`, `:846`, `:889`) caem em estados sem ação, como revogado e aceito, e não são afetadas.

Recomendações:
- **Comentário incompleto em `e2e/professores.spec.ts:44-47`:** ele explica por que o "Reenviar" não aparece, mas não diz por que o "Acrescentar turma" também não. Esse botão aparece na foto da vitrine, só que o professor criado no banco pelo teste não pode receber turma. Uma frase sobre isso evita que alguém tome a foto como divergência do teste.
- **Cobertura extra em `e2e/professores.spec.ts:684-687`:** o caso que só usa o teclado mede o alvo de toque só de "Refazer convite" e "Revogar convite". O painel do `pendente` agora tem também o "Corrigir o e-mail", que ficou de fora dessa medida. Não bloqueia, porque o `:1158` já mede esse botão no `vencido`.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/professores.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-10-e2e-professores-corrigir-email.md

## frontend-reviewer · 1ª rodada · APROVADO · 2026-11-10 16:57:36 · `tasks/correcoes/2026-11-10-e2e-professores-corrigir-email.md`

VEREDITO: APROVADO
Tela vista: sim (6 fotos lidas: lista de professores e painel do convite em aberto, no computador e no celular, na escola cheia; lista na escola vazia, no computador e no celular). Nenhuma delas é de tela que esta tarefa tenha alterado.
Estados: ok. A tarefa só mexe em `e2e/professores.spec.ts`, então carregando e erro seguem como estavam. O erro com "Tentar de novo" continua coberto no caso `:322`. Vazio e com dado aparecem nas fotos. A escola vazia mostra a tabela com a professora cadastrada e os botões "Importar professores" e "Cadastrar professor", sem tela em branco.
Acessibilidade: sem mudança no código da tela. Os casos continuam rodando `seriousViolations` (axe) e `horizontalOverflow`. Nas fotos, o foco, os rótulos e o contraste estão normais.
Chromebook fraco: não se aplica. Só mudou uma constante de teste.
Celular: ok nas fotos de 360 px.
- Não há rolagem horizontal, nem texto cortado ou sobreposto.
- O painel do convite vira folha de baixo, com "Corrigir o e-mail", "Refazer convite", "Revogar convite" e "Acrescentar turma" empilhados em largura cheia e com altura de 44 px ou mais.
- A barra de navegação aparece no meio da página nas fotos de página inteira. É efeito da captura com a barra fixa, não defeito da tela.
Ação oficial protegida: sim. "Revogar convite" e "Refazer convite" continuam passando por diálogo de confirmação, e o teste continua afirmando isso. A mudança não toca esse fluxo.

Bloqueantes: nenhum.

O que conferi:
- `e2e/professores.spec.ts:48-55`: `ACOES_DO_ESTADO` agora lista `['Corrigir o e-mail', 'Refazer convite', 'Revogar convite']` em `pendente` e `vencido`. A ordem é a do `PainelDoProfessor.tsx` (linha 164 é o "Corrigir o e-mail"). `revogado`, `aceito`, `ativo` e `desativado` seguem vazios.
- Os três casos que a esteira reprovou (`:322`, `:1130`, `:1333`) leem essa constante em `:370`, `:1154` e `:1358`, e a correção os cobre.
- `:1158` percorre `ACOES_DO_ESTADO.vencido` com `alvoDeToque`, que exige 44 px de altura e de largura (`:158-163`). O "Corrigir o e-mail" passa a ter o alvo de toque medido sem alterar essa linha, como a tarefa pedia.
- Os `toHaveCount(0)` de `:445`, `:611`, `:741`, `:846` e `:889` acontecem depois de revogar ou aceitar, quando o painel não tem ação. Continuam corretos.
- A foto do painel do convite em aberto (`coordenacao--coordenacao-professores--Ana-convidado--computador.png` e a versão de celular) mostra o botão "Corrigir o e-mail". Isso bate com o código e com a constante nova.

Recomendações:
- Em `e2e/professores.spec.ts:686-687`, o caso de teclado no celular mede o alvo de toque só de "Refazer convite" e "Revogar convite". Dá para trocar por `ACOES_DO_ESTADO.pendente`, como já se fez em `:1158`.
- No painel no computador (`coordenacao--coordenacao-professores--Ana-convidado--computador.png`), os quatro botões do rodapé ocupam duas linhas desalinhadas. Isso é estética e fica fora desta tarefa.

## test-engineer · 1ª rodada · APROVADO · 2026-11-10 16:57:37 · `tasks/correcoes/2026-11-10-e2e-professores-corrigir-email.md`

VEREDITO: APROVADO

**Cenários exigidos**
- Caminho feliz: o painel de quem espera o convite (`pendente` e `vencido`) mostra exatamente "Corrigir o e-mail", "Refazer convite" e "Revogar convite", nessa ordem.
- Borda 1: quem foi cadastrado pela planilha, no estado `pendente` (RF6, "Copiar link"), mostra o mesmo conjunto.
- Borda 2: o convite vencido, aberto pela linha inteira, tem as três ações, cada uma com alvo de toque de pelo menos 44 × 44 px no `celular` e no `chromebook`.
- Permissão: `revogado`, `aceito`, `ativo` e `desativado` não oferecem ação nenhuma, nem o "Corrigir o e-mail", porque a matriz os manda ao `CONFLITO`.
- Isolamento: não se aplica. A correção mexe só na constante esperada de um e2e, sem repository, query ou endpoint.

**Cobertos**
- O caso `:322` percorre os seis estados. Para cada um, ele confere com `toHaveText` exato a lista `ACOES_DO_ESTADO[estado]` (`e2e/professores.spec.ts:370`). Os estados `pendente` e `vencido` cobrem o caminho feliz, e os quatro estados com lista vazia cobrem a permissão.
- O caso `:1130` confere o conjunto exato do `vencido` (`:1154`). Depois ele passa por cada ação da própria constante com `alvoDeToque` (`:1158`). Assim, o alvo de toque do "Corrigir o e-mail" passa a ser medido só por ele estar na lista, que é o que o documento pede.
- O caso `:1333` confere o conjunto exato do `pendente` (`:1358`).
- O teste falha se a regra for removida. A lista é conferida por igualdade exata, então quebra nestas três situações:
  - o botão some de `pendente` ou `vencido`;
  - o botão aparece em algum dos quatro estados vazios;
  - a ordem muda.
- A ordem bate com o `Professores.test.tsx:378,380` e com a foto do painel da "Ana convidado" no celular.
- Não há `.skip`, mock, IA nem operação que precise de teste de concorrência.
- Mutações: o diff não toca `apps/*/src` nem `packages/*/src`, então a RF17 não exige bloco.
- Não rodei o e2e, porque ele precisa do ambiente do compose. A causa e o diff esperado do documento batem com o que a esteira mostrou na run 42883481508.

**Bloqueantes:** nenhum.

**Recomendações**
- O caso das ações em `e2e/professores.spec.ts:686-688` mede o alvo de toque do "Refazer convite" e do "Revogar convite", mas não o do "Corrigir o e-mail". Hoje a medida existe só pelo `:1158`. Pôr uma linha ali deixaria os dois casos coerentes.
- No celular, a foto mostra também o "Acrescentar turma" quando a escola tem turmas, assim como o `Professores.test.tsx:378`. Os três casos do e2e passam porque a escola deles não tem turma, e o comentário de `ACOES_DO_ESTADO` (`:45-47`) não diz isso. Vale registrar no comentário que a lista vale para uma escola sem turma, para quem mudar os dados do teste não estranhar.

Arquivos lidos: `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/professores.spec.ts` e `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/tasks/correcoes/2026-11-10-e2e-professores-corrigir-email.md`.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-10 16:57:47 · `tasks/correcoes/2026-11-10-e2e-professores-corrigir-email.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum nesta tarefa. A mudança fica toda em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/professores.spec.ts` e só troca a lista esperada de botões do painel do professor. Nenhuma escrita em `Nota`, seed de nota, job, importação ou webhook foi criada ou alterada. Todos com autor humano? Sim, porque não há caminho novo.

Decisão autônoma sobre aluno: ausente. A tarefa trata só do convite e do e-mail do professor, uma ação administrativa da coordenação que nenhum agente executa.

Aprovação registrada: ok. Nenhuma saída de IA aparece no fluxo. Nas fotos (`coordenacao--coordenacao-professores--Ana-convidado--computador.png` e `--celular.png`), o painel de "Ana convidado" mostra só a situação do convite, as turmas e as ações humanas: "Corrigir o e-mail", "Refazer convite", "Revogar convite" e "Acrescentar turma". Não há conteúdo gerado nem nada para aprovar.

Supervisão do tutor: ok. O Tutor não participa desta tarefa.

Autonomia declarada e visível: sim, sem mudança. Nenhum agente foi tocado, e a governança continua coberta pelos testes de `governanca.int.test.ts`.

Bloqueantes: nenhum.

O que verifiquei nas fotos e no código:
- **Diff.** A constante `ACOES_DO_ESTADO` (linhas 44-50) passa a listar "Corrigir o e-mail" em `pendente` e `vencido`. Os estados `revogado`, `aceito`, `ativo` e `desativado` continuam vazios. Os três casos que leem a constante (linhas 370, 1154 e 1358) seguem conferindo o conjunto exato de botões.
- **Alvo de toque.** O caso da linha 1130 já percorre `ACOES_DO_ESTADO.vencido` com `alvoDeToque` (linha 1158). Com a nova lista, ele passa a medir também o "Corrigir o e-mail", como a correção pedia, sem outra linha nova.
- **Medir o professor não é vigiar (item 9, D45 e D64).** As seis fotos (escola cheia e vazia, computador e celular) mostram só nome, disciplinas, turmas e situação do convite. Não há ranking, métrica de uso ou adoção por professor, nem alerta de "professor que não usa". Não aparece conversa do professor com o chat.
- **Nota (item 8, D46 e D55).** Nenhuma nota, conceito ou sugestão de nota aparece em tela alguma.
- **D59.** "Revogar convite" está no mesmo painel e no mesmo nível que "Refazer convite". Cancelar não é mais difícil que agir.

Recomendações:
- O comentário novo em `e2e/professores.spec.ts:46` cita o "Reenviar", que não está na constante e não é lido em nenhum dos três casos. Vale tirar a frase ou apontar o caso que prova a ausência do "Reenviar", para o comentário não afirmar algo que o teste não verifica.
- Nas fotos, o painel também mostra "Acrescentar turma", e a lista do teste não inclui esse botão. É assunto do `frontend-reviewer` e do `test-engineer`, não da regra 70: confirmar que `acoesDoPainel` deixa esse botão de fora de propósito, e não por acaso.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-10 16:57:49 · `tasks/correcoes/2026-11-10-e2e-professores-corrigir-email.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A mudança fica só no teste: a constante `ACOES_DO_ESTADO` e o comentário dela, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/professores.spec.ts:44-50`. Os estados `pendente` e `vencido` passam a esperar `['Corrigir o e-mail', 'Refazer convite', 'Revogar convite']`. Nenhuma migration, DTO, rota ou tela muda.

Fora da tabela de dados do docs/lgpd.md: nada.

Autorização por objeto: ok, porque a correção não toca nenhuma rota. A asserção de que o endereço do painel leva só o id do usuário, e nunca o nome nem o e-mail, continua de pé (`e2e/professores.spec.ts:1150-1152`). A asserção de que a lista não mostra o e-mail de ninguém também continua (`:379`, `:1325`, `:1378`).

Logs: limpos. A mudança não acrescenta nenhum log nem `console`.

Auditoria: nenhuma ação desta correção exige auditoria. A regra do "Corrigir o e-mail" vem da 19.0, que já foi validada, e esta correção não a altera.

Envio externo: nenhum.

Seed/fixture: sintético. Os nomes vêm de `convidarProfessorNoBanco` com sufixo aleatório, e os e-mails usam `@educa.invalid` (`e2e/professores.spec.ts:220`, `e2e/support/seed.ts:723`). Esta correção não mexe nessa geração.

Fotos da tela, conferidas para a regra 20:
- `coordenacao--coordenacao-professores--computador.png` e `--celular.png`: a lista mostra nome sintético, disciplina, turma e situação, sem e-mail.
- `coordenacao--coordenacao-professores--Ana-convidado--computador.png` e `--celular.png`: o painel do convite em aberto mostra o nome, a situação, as turmas e os botões "Corrigir o e-mail", "Refazer convite", "Revogar convite" e "Acrescentar turma". O e-mail atual não aparece no painel, e nenhum dado de aluno aparece.
- `vazia--coordenacao--coordenacao-professores--computador.png` e `--celular.png`: um professor sintético, sem e-mail.

A tela confirma o que o teste passou a afirmar, e só a coordenação vê o dado do professor.

Pergunta de fechamento: esta correção não muda o que o sistema guarda sobre um aluno nem para onde isso vai. A resposta do código continua a que a validação da 19.0 já aprovou.

Bloqueantes: nenhum.

Recomendações:
- O caso `:1130` passa a medir o alvo de toque de "Corrigir o e-mail" sozinho, porque percorre `ACOES_DO_ESTADO.vencido` (`:1158`). Ele confere o que aparece, mas não abre o diálogo do corrigir. Abrir esse diálogo e afirmar que o e-mail digitado não fica na página nem no endereço, como já se faz no cadastro (`:540`), é cobertura extra para outra rodada. Isso não bloqueia.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-10 17:10:08 · `tasks/correcoes/2026-11-10-e2e-professores-corrigir-email.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok

Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")

Bloqueantes: nenhum

As duas recomendações da rodada 1 foram feitas:
- **(a) O comentário de `ACOES_DO_ESTADO`** (`e2e/professores.spec.ts:44-49`) agora explica por que o "Acrescentar turma" não aparece. Conferi cada afirmação no código e todas são verdadeiras:
  - **Ano em curso:** o `criarEquipeComSenha` cria o ano letivo em curso, salvo com `semAnoLetivo` (`e2e/support/seed.ts:104-105`).
  - **Sem envio por e-mail, por isso sem "Reenviar":** o `convidarProfessorNoBanco` grava o convite direto no banco, sem envio (`e2e/support/seed.ts:729-738`). O botão depende de `podeReenviar`.
  - **Quando o botão aparece:** só quando há ano em curso, o professor é alocável e a escola tem turma e disciplina (`apps/web/src/areas/coordenacao/professores/PainelDoProfessor.tsx:108-112`, `:178-182`).
  - **O vencido não é alocável:** a lista de alocáveis é `['pendente', 'aceito', 'ativo']` (`packages/shared/src/professores/professores.ts:113`).
  - **`acoesDoPainel` contaria o botão:** ele pega todo botão do painel menos o "Fechar" (`e2e/professores.spec.ts:150`).
  - **O botão vem no fim do rodapé:** confirmado em `PainelDoProfessor.tsx:178`.
- **(b) Alvo de toque no caso de teclado:** `e2e/professores.spec.ts:688` mede o "Corrigir o e-mail". O professor ali está `pendente` (`:672`), que tem o botão.

Recomendações:
- **`e2e/professores.spec.ts:48`, última frase do comentário.** O texto diz "Com turmas na escola, o `pendente` ganha esse botão no fim." Isso tem duas imprecisões:
  - Não é só o `pendente`: `aceito` e `ativo` também são alocáveis. Numa escola com turma e disciplina, os dois deixam de ter lista vazia e passam a ter `['Acrescentar turma']`. Quem acrescentar turma ao caso `:331` seguindo o comentário vai ajustar só o `pendente` e ver `aceito` e `ativo` falharem.
  - "Com turmas" deveria ser "com turma e disciplina", como a própria frase anterior diz.
  - Sugestão de texto: "Com turma e disciplina na escola, `pendente`, `aceito` e `ativo` ganham esse botão no fim."
- As recomendações que ficaram sem aplicar estão no documento da correção com destino ou motivo (rodapé visual e e-mail fora da página para o `TODO.md`; a do conformidade-reviewer, atendida pelo item 1). Nada a acrescentar.

Arquivos lidos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/professores.spec.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/apps/web/src/areas/coordenacao/professores/PainelDoProfessor.tsx
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/packages/shared/src/professores/professores.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--specacesso-e-convites--l1/e2e/support/seed.ts

## test-engineer · 2ª rodada · APROVADO · 2026-11-10 17:10:25 · `tasks/correcoes/2026-11-10-e2e-professores-corrigir-email.md`

VEREDITO: APROVADO

Cenários exigidos: nesta rodada, as duas recomendações da rodada 1. (a) O comentário de `ACOES_DO_ESTADO` deve dizer para que escola e professor a lista vale, e por que o "Acrescentar turma" fica de fora. (b) O caso de teclado no celular deve medir o alvo de toque do "Corrigir o e-mail". Os cenários da rodada 1 não mudaram: conjunto exato de botões por estado nos casos `:372`, `:1157` e `:1361`, e os quatro estados sem ação vazios.

Cobertos:
- (b) está feita. Em `e2e/professores.spec.ts:688`, `alvoDeToque` mede o "Corrigir o e-mail" no painel `pendente` aberto só com teclado a 360 px. O caso `:1161` já media as ações do `vencido`, e agora pega o "Corrigir o e-mail" pela constante.
- (a) está feita. Conferi cada afirmação do comentário (`e2e/professores.spec.ts:44-49`) contra o código:
  - **"com o ano em curso": verdadeira.** `criarEquipeComSenha` insere o `ano_letivo` com situação `em_curso` (`e2e/support/seed.ts:104-105`).
  - **"sem o Reenviar porque não houve envio": verdadeira.** O "Reenviar" exige `envio !== null` (`apps/web/src/areas/coordenacao/professores/envio-do-convite.ts:54-55`).
  - **"o Acrescentar turma só aparece quando o professor é alocável (o vencido não é) e a escola tem turma e disciplina": verdadeira.** `podeAcrescentar` depende de `anoEmCurso && alocavel` e de `oQueFaltaParaAlocar` sem pendência (`PainelDoProfessor.tsx:108-112, 178`). `ESTADOS_DO_PROFESSOR_ALOCAVEIS` é `['pendente', 'aceito', 'ativo']` (`packages/shared/src/professores/professores.ts:113`), então o `vencido` fica de fora.
  - **"`acoesDoPainel` o conta": verdadeira.** O seletor é `button:not([aria-label="Fechar"])` (`e2e/professores.spec.ts:150`).
  - **"o `pendente` ganha esse botão no fim": verdadeira.** Ele é o último do rodapé (`PainelDoProfessor.tsx:178`), como confirma `Professores.test.tsx:378`.
- A linha `**Sem mutação:**` do documento está correta: o diff não toca `apps/*/src` nem `packages/*/src`.
- Não há `.skip`, teste comentado nem mock novo. Nada envolve IA nem concorrência.
- Não rodei o e2e: ele precisa da pilha no ar. A prova de que passa é o portão da tarefa.

Bloqueantes: nenhum.

Recomendações:
1. `e2e/professores.spec.ts:48`: a frase "Com turmas na escola, o `pendente` ganha esse botão no fim" está certa, mas incompleta. O `aceito` e o `ativo` também são alocáveis e também ganham o "Acrescentar turma" (`Professores.test.tsx:381`), embora a constante os liste como `[]`. Melhor escrever "o `pendente`, o `aceito` e o `ativo` ganham esse botão no fim".
2. `e2e/professores.spec.ts:46`: "a lista vale para o professor semeado pelo banco" não cobre o caso `:1361`. Ali o professor pendente é cadastrado pela planilha (`:1349-1353`), não por `convidarProfessorNoBanco`. A condição que importa é "sem envio por e-mail", seja qual for a origem. O texto ficaria exato como "a lista vale para o professor sem envio por e-mail (o semeado pelo banco ou o cadastrado pela planilha)".

As duas são de texto de comentário e não mudam o que os casos provam.
