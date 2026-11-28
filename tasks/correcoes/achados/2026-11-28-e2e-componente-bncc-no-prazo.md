# Achados das revisões — `tasks/correcoes/2026-11-28-e2e-componente-bncc-no-prazo.md`

Escrito pelo hook `tools/processo/revisoes.ts`. O resumo de cada rodada está em `indice.md`, nesta pasta. Não edite à mão.

## conformidade-reviewer · 1ª rodada · APROVADO · 2026-11-28 09:22:02 · `tasks/correcoes/2026-11-28-e2e-componente-bncc-no-prazo.md`

VEREDITO: APROVADO

Caminhos de escrita em Nota: nenhum. A mudança é só de teste e mexe num caso de estrutura (componente da BNCC de disciplina), sem nota, correção ou avaliação. Todos com autor humano? Não se aplica.
Decisão autônoma sobre aluno: ausente
Aprovação registrada: ok. Nenhum fluxo de saída de IA foi tocado.
Supervisão do tutor: ok. O tutor não foi tocado.
Autonomia declarada e visível: sim. Nada mudou em `governanca` nem na declaração dos agentes.

Bloqueantes: nenhum

O que conferi:
- O diff em `e2e/estrutura.spec.ts` (linhas 1155-1165) só faz duas coisas:
  - O segundo fator de B agora é configurado pela API, com `configurarSegundoFatorPelaApi` (`e2e/support/mfa.ts:69`).
  - A entrada de B passou para `entrarPelaTelaComSegundoFator` (`e2e/support/casca.ts:418`). Ela continua pela tela e na mesma aba.
- As quatro asserções finais de isolamento ficaram iguais: nenhuma disciplina na lista de B e o `body` sem o nome de A nem "Geografia".
- Nenhum arquivo de produção mudou. Não entrou nenhum campo, tela ou prompt que proponha nota em discursiva ou redação (D55/D46).
- Nada de indicador de professor (D45), inferência emocional, medição de navegação ou mecânica que induza uso (D59).
- A tarefa não tem tela, então não havia fotos para conferir.

Recomendações:
- O comentário novo em `e2e/estrutura.spec.ts:1156-1157` diz que o `request` "não entrega cookie à aba". É verdade para a fixture `request` do Playwright, que tem armazenamento próprio. Mas essa garantia não é minha. Fica para o `tenancy-guardian` e o `test-engineer` confirmarem que a mutação descrita na tarefa, com o segredo trocado, de fato derruba o caso antes das asserções de isolamento.

## privacy-guardian · 1ª rodada · APROVADO · 2026-11-28 09:22:06 · `tasks/correcoes/2026-11-28-e2e-componente-bncc-no-prazo.md`

VEREDITO: APROVADO

Campos pessoais tocados: nenhum. A mudança fica só em `e2e/estrutura.spec.ts`, no caso `:1143`. Nenhuma migration, DTO, rota ou código de produção mudou.

Fora da tabela de dados do docs/lgpd.md: nada. Não há campo novo.

Autorização por objeto: ok. A prova de isolamento continua de pé e mais firme do que antes:
- B ainda entra pela tela, na mesma aba e sem recarregar, por `entrarPelaTelaComSegundoFator` (`e2e/support/casca.ts:418`). Assim o cache que A deixou na aba continua lá quando B entra, e é isso que o caso prova.
- Só a configuração do segundo fator de B mudou: agora vai pela API, por `configurarSegundoFatorPelaApi` (`e2e/support/mfa.ts:69`). Ela roda no `APIRequestContext` à parte, que não passa cookie para a aba.
- As três asserções finais ficaram como estavam (`estrutura.spec.ts:1168-1170`): a lista de disciplinas de B vem vazia, e o `body` não mostra o nome de A nem "Geografia".
- A mutação declarada (código de B gerado com outro segredo) faz o caso falhar antes das asserções de isolamento. Isso mostra que B precisa mesmo entrar para o caso passar.

Logs: limpos. Não entrou log, e os auxiliares usados não gravam segredo nem dado de pessoa.

Auditoria: nada mudou. A correção não toca ação auditável.

Envio externo: nenhum.

Seed/fixture: sintético. `criarEquipeComSenha` (`e2e/support/seed.ts:88`) gera "Coordenadora sintética <uuid>", e-mail em `@educa.invalid` e senha sintética. A disciplina leva o nome "Disciplina de A <uuid>".

Bloqueantes: nenhum.

Recomendações:
- O caso agora cobre a configuração do segundo fator de B só pela API. Isso só é aceitável porque essa configuração pela tela continua coberta por outros casos (`entrarComoCoordenacaoNaMesmaAba` e `entrarComoCoordenacaoPeloConvite` seguem em uso). Vale registrar essa dependência no comentário do caso, para que ninguém apague os outros casos achando que este cobre a tela.

Pergunta de fechamento: a correção não muda nada no que o sistema guarda sobre o aluno nem nos lugares para onde isso é enviado. A resposta continua a mesma de antes desta tarefa.

## revisor-geral · 1ª rodada · APROVADO · 2026-11-28 09:22:13 · `tasks/correcoes/2026-11-28-e2e-componente-bncc-no-prazo.md`

VEREDITO: APROVADO

Escopo: respeitado

Aderência à Tech Spec: ok. A correção mexe só no e2e (`e2e/estrutura.spec.ts:1143-1172` e os dois imports das linhas 5 e 7), nenhuma linha de produção muda e não há divergência a registrar.

Portão local: carimbo válido (`portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)`)

Bloqueantes: nenhum

O que conferi:
- **A troca preserva o que o caso prova.** O segundo fator de B passa a ser configurado pelo `request` do Playwright, um contexto à parte que não manda cookie à aba. A entrada de B continua pela tela, na mesma aba e sem recarregar. Por isso o cache que A deixou continua na aba quando B entra.
- **O código da entrada de B está certo.** `configurarSegundoFatorPelaApi` ativa com o código do passo de agora (`e2e/support/mfa.ts:80`), e `digitarOCodigoDaEntrada` digita o do passo seguinte (`e2e/support/casca.ts:404`). Não há reuso do mesmo código.
- **Nenhuma asserção saiu.** As quatro finais (linhas 1169-1171: lista vazia, `body` sem o nome de A e sem "Geografia") ficaram onde estavam. A checagem de URL que a função antiga fazia (`/coordenacao\/painel$/`) é coberta por `esperarPainel(page)` na linha 1166.
- **O import de `entrarComoCoordenacaoNaMesmaAba` continua em uso** no mesmo arquivo (linhas 118, 466, 891, 922 e outras), então não ficou import morto.
- **A receita é a que o projeto já usa.** É a mesma documentada em `e2e/support/mfa.ts:65-68`. Não é um segundo jeito de fazer a mesma coisa.

Recomendações:
- A mutação declarada (segredo errado na entrada de B) só prova que a entrada pela tela continua valendo. Ela não prova o isolamento, que já era coberto pelas asserções finais, inalteradas. Uma mutação que troque `deB` por `deA` na linha 1165 mostraria que as asserções de isolamento ficam vermelhas quando a segunda pessoa é da mesma escola. É cobertura extra, não bloqueia.
- O comentário das linhas 1156-1157 tem 2 linhas longas (mais de 140 colunas) e repete o que o documento da correção já explica. Basta uma linha dizendo que a configuração vai pela API e a entrada fica pela tela.

Arquivos:
- e2e/estrutura.spec.ts
- tasks/correcoes/2026-11-28-e2e-componente-bncc-no-prazo.md

## test-engineer · 1ª rodada · APROVADO · 2026-11-28 09:22:39 · `tasks/correcoes/2026-11-28-e2e-componente-bncc-no-prazo.md`

VEREDITO: APROVADO

**Cenários exigidos:** É uma correção só de teste e não muda nenhuma linha de produção. O caso `e2e/estrutura.spec.ts:1143` precisa continuar provando três coisas.
- **Isolamento (regra 10, item 5; regra 20, item 5):** a coordenação de B entra na mesma aba em que A esteve e não vê a disciplina nem o componente da BNCC de A.
- **Entrada pela tela:** B entra pela tela, sem recarregar a página, para que o cache de A continue na aba. Esse é o ponto que o comentário de `abrirPelaApiSemMedirAPrimeiraCarga` (`e2e/support/mfa.ts:130-132`) manda não trocar.
- **Prazo com folga:** o caso precisa caber no prazo de 30 s da esteira com margem, sem depender de a máquina estar folgada.

**Cobertos:**
- **As quatro asserções finais ficaram intactas** (`estrutura.spec.ts:1169-1171`): nenhum `li` na lista de B, e o `body` sem o nome de A nem "Geografia". Elas continuam onde estavam. Uma verificação saiu do ajudante, a de que a URL termina em `/coordenacao/painel$`, mas ela não se perdeu: `esperarPainel` (`casca.ts:295`) faz a mesma conferência logo em seguida.
- **Só a configuração do segundo fator de B foi para a API.** O ajudante `configurarSegundoFatorPelaApi(request, deB)` usa o `request` do teste, que é separado da aba e não leva cookie para ela. A sessão de B só nasce pela tela, em `entrarPelaTelaComSegundoFator` (`casca.ts:418-422`): senha e depois o código. A aba nunca recarrega, então o cache de A continua ali.
- **O passo do código está certo.** A ativação pela API usa o passo de agora (`mfa.ts:80`, sem `deixarOPassoSeguinteLivre`). A entrada pela tela digita o passo seguinte (`casca.ts:404`) e gera o código de novo a cada tentativa, então não quebra quando o relógio vira entre a ativação e a entrada.
- **Prazo:** o documento mediu 8,4 a 10,6 s com `--repeat-each 5 --workers 2`, nos dois projetos, e 10 de 10 passaram. Não é um teste que só passa com a máquina folgada: o tempo caiu porque saíram etapas de tela, sem afrouxar nenhuma espera.
- **Mutação:** com um segredo errado na entrada de B, o código é recusado e o caso fica vermelho antes das asserções de isolamento. Isso mostra que B entra de fato pela tela e não chega à aba por um atalho. Sem linha de produção nova, `--faltando` dá 0, então nada mais é exigido.
- Não há `.skip`, teste comentado nem mock. O caso não usa IA.

**Bloqueantes:** nenhum.

**Recomendações:**
1. A mutação prova a entrada pela tela, não o isolamento. Ela é suficiente para esta correção, porque nenhuma asserção mudou e o isolamento foi provado quando o caso nasceu (tarefa 1.0 de `classificacao-bncc`). Mesmo assim, vale citar no documento o bloco original que provou as asserções, para a validação não ter de procurar.
2. O outro caso de duas pessoas no mesmo arquivo (`estrutura.spec.ts:891` e `:922`) continua com `entrarComoCoordenacaoNaMesmaAba` nas duas entradas. Ele paga a mesma configuração pela tela, duas vezes. Vale medir esse caso no celular e, se estiver perto do prazo, aplicar a mesma receita. O que está no `tasks/correcoes/2026-11-28-e2e-componente-bncc-no-prazo.md:59` diz o contrário ("Nenhuma até aqui"), então essa linha está incompleta.
3. Minúcia: o texto da seção "Correção" diz que a configuração de B acontece "depois de A terminar e antes do 'Sair'". No código é exatamente assim (`:1158-1162`), mas o comentário em `:1156-1157` poderia dizer explicitamente que a ordem não importa, por ser um contexto à parte. Assim um ajuste futuro não move a linha achando que ela depende da sessão de A.

Arquivos auditados:
- `e2e/estrutura.spec.ts`
- `e2e/support/casca.ts`
- `e2e/support/mfa.ts`
- `tasks/correcoes/2026-11-28-e2e-componente-bncc-no-prazo.md`

## revisor-geral · 2ª rodada · APROVADO · 2026-11-28 09:40:59 · `tasks/correcoes/2026-11-28-e2e-componente-bncc-no-prazo.md`

VEREDITO: APROVADO
Escopo: respeitado
Aderência à Tech Spec: ok (é uma correção só de teste e não muda nenhuma linha do produto)
Portão local: carimbo válido (`portão local válido para o código atual (typecheck, lint, segredo, dependencias, unidade, alvo)`)
Bloqueantes: nenhum
Recomendações:
- No comentário novo, em `e2e/estrutura.spec.ts:1156`, o parêntese "(a ordem não depende da sessão de A)" é curto demais. Quem chegar sem o contexto da 1ª rodada não entende de que ordem se trata. Uma redação mais clara seria: "configurar antes ou depois de A sair dá no mesmo, porque o contexto da API não passa cookie à aba".

Conferi o que esta rodada mudou:
- **Comentário do caso :1143:** foi encurtado e agora diz que a configuração do segundo fator pela tela é coberta por outros casos (`entrarComoCoordenacaoNaMesmaAba` e o convite), com o aviso para não apagá-los. As asserções e o fluxo do caso continuam iguais.
- **Onde está a prova do isolamento:** as referências do novo parágrafo do documento batem com o código. O caso `isolamento: a coordenação da A não alcança a disciplina da B…` está em `apps/api/test/estrutura.int.test.ts:778`. As linhas "`PATCH` da B no contexto da A" e "recomeço: segunda pessoa" estão na tabela de testes de `tasks/prd-classificacao-bncc/1_task.md` (linhas 54 e 59), e os blocos de mutação desse arquivo cobrem `disciplina.repository.ts` e o `NAO_ENCONTRADO` do `disciplina.service.ts`.
- **Recomendações sem aplicar:** a tabela registra a recusa da mutação `deB` para `deA` com motivo, e o motivo é aceitável, porque nenhuma asserção de isolamento mudou nesta correção. A recomendação do `test-engineer` foi para o `TODO.md`.
- **Linha nova do `TODO.md`:** os números `:882`, `:891` e `:922` estão certos. São o caso "segunda pessoa: a coordenação de B entra na aba da de A…" e as duas chamadas de `entrarComoCoordenacaoNaMesmaAba` dele.

Arquivos lidos:
- e2e/estrutura.spec.ts
- tasks/correcoes/2026-11-28-e2e-componente-bncc-no-prazo.md
- TODO.md
