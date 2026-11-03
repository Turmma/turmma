# Achados das revisões — `tasks/correcoes/2026-11-02-mutacao-diz-o-expect.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-02 23:11:54 · `tasks/correcoes/2026-11-02-mutacao-diz-o-expect.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A correção mexe só na ferramenta do processo (`tools/processo/mutacoes.ts`, o teste dela e duas skills). Nenhuma migration, entidade, DTO, rota ou repository foi tocado.

Fora da tabela de dados do docs/lgpd.md: nada. Não entra nenhum campo novo de pessoa.

Autorização por objeto: não se aplica. Não há rota nem acesso a dado de aluno.

Logs: limpos. O único texto novo que vai ao terminal, pelo `avisar`, sai do motivo "vermelho em outra asserção", em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-02-mutacao-diz-o-expect/tools/processo/mutacoes.ts:349` e `:489`. Esse motivo traz o número da linha e o texto do código-fonte do arquivo de teste (`fonte[primeira - 1]`), mais o trecho de `falha:` escrito no documento. Ele não repete as `failureMessages` nem as `errors[].message` do relatório. Essas mensagens podem conter valores de fixture, e o código só tira delas o número da linha, por `linhaNaPilha` e `linhaDoErro`. O relatório continua numa pasta temporária, apagada no `finally` de `rodarCalado` (`mutacoes.ts:722-724`, sem mudança). O comentário que cita a regra 20, item 17 (`mutacoes.ts:559-561`, em `prepararRelatorio`) não mudou e continua verdadeiro.

Auditoria: não se aplica. Nenhuma ação da lista do item 10 foi tocada.

Envio externo: nenhum. Nada sai da máquina, nada vai a provedor de IA e não há uso de `ExecucaoAgente`.

Seed/fixture: sintético. As fixtures novas de `mutacoes.test.ts` (`'insertAuditoria'`, `'abc'`, `expect(1).toBe(1)`, caminhos `/repo/...`) são texto de código, sem dado de pessoa.

Pergunta de fechamento: a correção não muda o mapa de dados nem o rastro de compartilhamento, então a resposta à secretaria continua a mesma de antes.

Bloqueantes: nenhum.

Recomendações:
- O comentário de `prepararRelatorio` (`mutacoes.ts:559-561`) poderia ganhar meia frase: o que o portão passa a mostrar é a linha do código de teste, e nunca a mensagem da asserção. Assim, quem mexer depois em `falhaNaLinhaCerta` não começa a mostrar `failureMessages` no motivo sem perceber que isso traz valores de fixture para o terminal.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-02 23:13:00 · `tasks/correcoes/2026-11-02-mutacao-diz-o-expect.md`

VEREDITO: APROVADO

Escopo: respeitado. A correção cumpre a M1 da retro da X8, e só ela. O bloco aceita uma linha opcional `falha:`, a corrida mutada confere essa linha no relatório do Vitest e do Playwright, um trecho que não existe no arquivo de teste é recusado antes de qualquer corrida, e `executar-task` e `corrigir` agora pedem a linha. Não há nada de tarefa futura.

Aderência à Tech Spec: ok. É uma correção de `tools/processo/`, sem Tech Spec. O mecanismo mudou um pouco em relação ao texto da M1: a M1 pedia ler o trecho de código que o runner imprime junto do erro, e a correção lê a linha do frame na pilha ou em `errors[].location`. O resultado é o mesmo, o caminho é mais robusto, e o documento da correção (seção "Correção") registra a escolha. Não foi decidido em silêncio.

Portão local: carimbo válido (`portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)`). O `--faltando` aponta 6 linhas e as 6 têm motivo escrito no documento. A conta da linha `--faltando: 31 linhas (28 blocos, 6 motivos)` fecha: 25 linhas distintas com bloco mais 6 com motivo.

Bloqueantes: nenhum.

Recomendações:
1. **Silêncio em `veredictoDaCorrida`** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-02-mutacao-diz-o-expect/tools/processo/mutacoes.ts`, linha `if (relatorio === null) return false`). Quando não há relatório, o bloco com `falha:` aceita o vermelho sem conferir a linha e não avisa. Hoje isso não acontece, porque `comandoDoTeste` só gera comandos de vitest e de playwright. Mesmo assim, devolver `{ outra: 'sem relatório, a linha não se confere' }` quando `falha` está presente fecha o buraco se surgir um tipo novo de teste.
2. **Comparação frouxa em `ehOArquivo`** (mesmo arquivo). A condição `alvo.endsWith(`/${achado}`)` aceita qualquer `location.file` relativo que só repete o fim do caminho, por exemplo outro `x.spec.ts` noutra subpasta do `testDir`. Não deixa passar falso positivo realista, mas é mais solta do que precisa.
3. **Template sem `falha:`** (`/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-02-mutacao-diz-o-expect/.claude/skills/criar-tasks/task-template.md:156`). A seção "Mutações" do template explica `projeto: celular` e não fala de `falha:`. Quem preenche a seção a partir do template não vê a exigência nova.
4. **Defesa antiga em `docs/processo-licoes.md:42`**. A linha da X8 ainda dá como defesa "ler a linha do `expect` que caiu". Vale citar a linha `falha:` e o portão.
5. **Expect em várias linhas**. Quando o `expect` se quebra em várias linhas, a pilha aponta a linha do matcher (`.not.toContain(...)`), não a do `expect(...)`. O texto de `executar-task` diz "trecho da linha do expect". Uma frase dizendo para copiar o trecho da linha do matcher evita recusas que confundem.
6. **Pendências fora desta revisão**. O item "(X8, retro, M1)" do `TODO.md:2529` continua aberto e fecha no pouso. O veredito de testes é do `test-engineer`.

## test-engineer · 1ª rodada · APROVADO · 2026-11-02 23:13:46 · `tasks/correcoes/2026-11-02-mutacao-diz-o-expect.md`

VEREDITO: APROVADO

Cenários exigidos:
- Caminho feliz: um bloco com `falha:` cujo caso cai na linha do trecho conta como vermelho. Isso vale no Vitest (a pilha) e no Playwright (`errors[].location`).
- O caso que cai numa asserção anterior, a positiva antes da negativa, que deu as cinco reprovações da X8, é recusado com "vermelho em outra asserção".
- Um trecho de `falha:` que não existe no arquivo de teste é recusado antes de qualquer corrida.
- Sem a linha, nada muda: a corrida não recebe trecho e vale o vermelho de qualquer caso.
- Casos de borda do leitor:
  - com vários casos vermelhos, basta um cair na linha certa;
  - a pilha sem frame do arquivo de teste não prova nada;
  - o relatório ilegível, `null` ou `{}` não prova nada;
  - o frame de outro arquivo cujo caminho só termina igual não conta;
  - o Playwright com o caminho absoluto, relativo ao `testDir` ou igual ao do bloco;
  - o caso `timedOut`, o campo antigo `error`, o erro lançado num apoio (vale a pilha), e o erro sem `location` nem pilha.
- O carimbo muda quando o trecho muda, e os blocos antigos não ganham o campo.
- A linha `falha:` depois do diff vira erro, e não some.
- O arquivo volta ao original na recusa.
- Isolamento entre escolas e permissão não se aplicam: é ferramenta de processo, sem dado de escola. Concorrência também não: a corrida é sequencial por desenho.

Cobertos: todos os acima, em `/home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-02-mutacao-diz-o-expect/tools/processo/mutacoes.test.ts`:
- `a linha "falha:" diz qual expect tem de cair…` e `"falha:" vazia ou depois do diff…`
- o grupo `"falha:" — o vermelho tem de ser o do expect que o bloco diz`, com quatro casos
- o grupo `falhaNaLinhaCerta: …`, com oito casos
- os dois casos com o Vitest e o Playwright de verdade: `vitest, com "falha:"` e `playwright, com "falha:"`

O que conferi:
- Rodei `npx vitest run tools/processo/mutacoes.test.ts`: 183 de 183 verdes.
- Rodei `--faltando`: devolve exatamente as 6 linhas que têm motivo no documento, e os motivos se sustentam. As linhas `objeto` e `?? null` são equivalentes de verdade. As outras quatro saíram de `conferirMutacoes` ou da linha que era uma só em `veredictoDaCorrida`, sem mudar de texto, e os casos antigos que as provam seguem verdes.
- A contagem fecha: 28 blocos, 25 linhas distintas (a linha de `ehOArquivo` tem três blocos e a do spread tem dois), mais os 6 motivos, dá as 31 linhas do documento.
- Li os 28 blocos contra os casos que eles citam. Cada um cai na asserção da cláusula. Quatro caem por TypeError da própria cláusula retirada, e não por um `expect`, mas no caso certo: `typeof file !== 'string'`, `pilha as string`, `lista` → `as unknown[]` e `if (!falha)`. Isso é aceitável.
- Não achei `.skip` nem teste comentado. Não há IA nem provedor pago. Os prazos dos casos com runner de verdade (120 s) seguem o padrão dos casos que já existiam, e não dependem de a máquina estar folgada.

Bloqueantes: nenhum.

Recomendações:
1. **Trecho ambíguo** (`tools/processo/mutacoes.ts:673` e `:347`). O `includes(trecho)` aceita um trecho que também aparece na linha positiva. Por exemplo, `falha: toContain('x')` casa com `.toContain('x')` e com `.not.toContain('x')`. É o mesmo furo que a correção diz fechar, só que agora depende de quem escreve o bloco. Sugestão: em `recusaDaFalhaQueNaoExiste`, recusar o trecho que aparece em mais de uma linha do arquivo de teste (ou do caso), com um teste.
2. **A obrigação fica só no texto.** "Toda asserção negativa leva `falha:`" está só em `executar-task/SKILL.md` e em `corrigir/SKILL.md`, e nenhuma ferramenta a cobra. Um aviso do `--faltando`, ou do portão, para bloco sem `falha:` cujo caso tem `.not.` ou `toHaveLength(0)` deixaria de depender da revisão.
3. **Mutar o próprio arquivo de teste.** Se o `arquivo:` do bloco for o arquivo de teste, `veredictoDaCorrida` lê a fonte depois da corrida, e as linhas podem ter mudado. Hoje é caso de borda sem uso. Vale um comentário, ou recusar o `falha:` nesse caso.
4. **Basename igual no Playwright** (`tools/processo/mutacoes.ts:631`). O `alvo.endsWith('/' + achado)` com um `achado` só de basename aceita um apoio em outra pasta com o mesmo nome de arquivo. É improvável: anotar como limite conhecido.
5. **Bloco 4, `...({ falha: falha ?? undefined })`.** Não muda a impressão, porque o `JSON.stringify` descarta `undefined`. Ele só cai pelo `'falha' in`. Está certo como trava de forma, mas o comentário do teste ("o carimbo vê a linha") não é o que esse bloco prova.

## revisor-geral · 2ª rodada · APROVADO · 2026-11-02 23:20:38 · `tasks/correcoes/2026-11-02-mutacao-diz-o-expect.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. A correção não tem Tech Spec. Desde a 1ª rodada só mudaram comentários, texto das skills e o destino das recomendações, e nada disso muda comportamento ou contrato do bloco.

Portão local: carimbo válido ("portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)")

Bloqueantes: nenhum

O que conferi neste diff:
- **As quatro recomendações baratas foram aplicadas.**
  - `prepararRelatorio`, em `tools/processo/mutacoes.ts:558-563`: o comentário diz que o terminal mostra só a linha do código e o número dela, nunca `failureMessages`. É o que `falhaNaLinhaCerta` faz.
  - `ehOArquivo`, em `tools/processo/mutacoes.ts:628-632`: o limite está no comentário.
  - `veredictoDaCorrida`, em `tools/processo/mutacoes.ts:694`: o limite da fonte lida depois da corrida está no comentário.
  - O caso `'falha' in`, em `tools/processo/mutacoes.test.ts:139-140`: o comentário diz certo que `JSON.stringify` descarta `undefined`.
  - As duas skills ganharam a frase sobre o matcher no `expect` quebrado em várias linhas. A frase confere: o V8 aponta a chamada pela linha da propriedade chamada.
- **As sete recomendações restantes têm destino.** Estão na tabela "Recomendações sem aplicar" (`tasks/correcoes/2026-11-02-mutacao-diz-o-expect.md:265-275`) e nas sete entradas novas do `TODO.md`. O item "(X8, retro, M1)" está marcado como feito.

Recomendações:
- `TODO.md`, na entrada do trecho ambíguo da seção nova: o texto diz "junto da linha "(X8, retro, M1)" acima", mas essa linha agora está marcada `[x]`. Vale dizer "como continuação de" ou citar a correção, para que ninguém procure ali um item que ainda esteja aberto.

Arquivos:
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-02-mutacao-diz-o-expect/tools/processo/mutacoes.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-02-mutacao-diz-o-expect/tools/processo/mutacoes.test.ts
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-02-mutacao-diz-o-expect/.claude/skills/corrigir/SKILL.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-02-mutacao-diz-o-expect/.claude/skills/executar-task/SKILL.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-02-mutacao-diz-o-expect/TODO.md
- /home/joaquimdp/Documents/git/.maestri/floors/educaia--correcao2026-11-02-mutacao-diz-o-expect/tasks/correcoes/2026-11-02-mutacao-diz-o-expect.md
