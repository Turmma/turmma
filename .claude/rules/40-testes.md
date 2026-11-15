---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "e2e/**"
  - "tools/**"
---

# Regra 40 — Testes

## Por que esta regra existe

Em um sistema escolar, o custo de um bug não é uma tela feia: é a nota errada de um aluno,
é um aviso de falta enviado à família errada, é dado de uma escola aparecendo em outra.
Nenhum desses erros aparece em teste de fumaça que só verifica se a rota respondeu.

Além disso, três dos nossos portões de qualidade são auditorias de segurança e
conformidade. Elas dependem de existir teste que prove o comportamento, não teste que prove
que o código roda.

## O que conta como teste aqui

A pergunta que decide: **se eu apagar a regra de negócio, este teste falha?** Se não falha,
não é teste, é decoração.

```ts
// não é teste: prova que o servidor está de pé
it('cria avaliação', async () => {
  const r = await api(token).post('/avaliacoes').send(payload)
  expect(r.status).toBe(201)
})

// é teste: prova a regra que importa
it('nota não é criada sem autor humano, mesmo vindo do agente', async () => {
  const correcao = await agenteCorretor.corrigir(avaliacao.id)
  expect(correcao.status).toBe('pendente')
  const notas = await repo.notasDa(avaliacao.id)
  expect(notas).toHaveLength(0)
})
```

## As camadas

| Camada | Para quê | Com o quê |
|---|---|---|
| Unidade | regra pura, cálculo, validação | sem banco |
| Integração | service + repository, o grosso do valor | Postgres real em container |
| E2E | o fluxo como o usuário faz | Playwright |
| Isolamento | escola A não alcança escola B | integração, obrigatório por módulo |

Mock de coisa nossa, quando dá para usar a coisa nossa, esconde justamente o erro que
importa. Mock é para o que está fora: provedor de IA, e-mail, storage externo.

## Os fluxos que exigem E2E

Onboarding completo (coordenador cria turma, sobe lista, professor convida, aluno
reivindica, professor aprova), importação de planilha suja, aplicação e correção de
avaliação em cada modo, aprovação de entrega de agente, login por matrícula, tutor
recusando entregar resposta.

## Casos de borda que este domínio sempre tem

Não invente casos genéricos. Use os que a escola produz de verdade:

aluno transferido no meio do bimestre · dois alunos com o mesmo nome na turma · aluno que
chega em maio · professor que dá duas disciplinas na mesma turma · turma sem professor
alocado · feriado no dia da prova · aluno que faltou à avaliação · planilha com a turma
escrita de três jeitos · matrícula repetida em escolas diferentes · virada de ano letivo ·
nota alterada depois de lançada · prova fotografada torta ou com sombra · aluno tentando
arrancar a resposta do tutor de três formas diferentes.

E os de carga, que só aparecem com a escola inteira usando ao mesmo tempo (regra 80):

dois alunos reivindicando o mesmo nome no mesmo segundo · professor clicando duas vezes em
aprovar o lote · job de correção executado duas vezes · rede da escola caindo no meio da
prova · 35 logins do mesmo IP em um minuto · provedor de IA recusando por limite no meio da
aula · uma escola ingerindo 300 apostilas enquanto outra usa o tutor.

E o do próprio ambiente de teste: banco de teste com milhares de escolas de outras execuções (a
lista global se filtra pelo que o teste criou; nunca se percorre inteira, e o id, que é v7, segue o
instante da criação: não é a ordem de negócio nem desempata duas linhas do mesmo milissegundo). O portão local começa com o banco limpo (`EDUCA_BANCO_NOVO=1`), mas só no `test`: o
e2e e o infra do portão rodam sobre o que a integração daquela execução deixou, e quem roda
`npm run test` sozinho acumula. Na esteira, cada job começa vazio. O teste precisa passar nos três.

## Testar coisa que é probabilística

Correção por IA, OCR e classificação por habilidade da BNCC não são determinísticos. Eles
são testados com um **conjunto fixo de amostras** e uma taxa de acerto mínima declarada. Se
a taxa cai abaixo do limite, a tarefa falha como qualquer outro teste vermelho.

Nenhum teste automatizado chama provedor pago. O adaptador falso devolve resposta fixa; o
Ollama local cobre o que precisa de modelo de verdade.

## O que é proibido

`.skip`, teste comentado, `any` para calar o compilador, asserção que sempre passa, e
desabilitar teste para "destravar a tarefa". Teste vermelho é informação, não obstáculo.

## As regras e a checagem de cada uma

1. **O teste prova a regra de negócio.** Apagada a regra, ele falha; "retornou 200" não conta.
   Checagem: `tools/processo/mutacoes.test.ts`, `test-engineer`.
2. **Todo módulo entrega o teste de isolamento** entre escolas, na camada de integração.
   Checagem: só a revisão garante (`tenancy-guardian`, `test-engineer`).
3. **Nenhum teste chama provedor pago.** O adaptador falso ou o Ollama local cobrem.
   Checagem: só a revisão garante (`llm-integrator`, `test-engineer`).
4. **O que é probabilístico tem amostra fixa e taxa mínima declarada.**
   Checagem: só a revisão garante (`test-engineer`).
5. **É proibido** `.skip`, teste comentado, `any` para calar o compilador e asserção que sempre passa.
   Checagem: `guardas/teste-sem-desligar` pega o .skip e o .only; só a revisão garante o teste comentado, o any e a asserção que sempre passa (`test-engineer`).
6. **Os fluxos da seção "Os fluxos que exigem E2E" têm e2e.**
   Checagem: só a revisão garante (`test-engineer`).
7. **O portão da tarefa roda antes do commit, e código de produção sem mutação não recebe carimbo** (RF17).
   Checagem: `tools/processo/portao-local.test.ts`, `tools/processo/hook-portao.test.ts`, `tools/processo/mutacoes.test.ts`.

## O portão

Há dois, e o que muda entre eles é o quanto roda e quem espera (D78, D79).

**O portão da tarefa**, em toda tarefa e em toda correção:
`node tools/processo/portao-local.ts --tarefa <documento>`. Roda os tipos, o lint, as duas guardas da
esteira que não são teste (`guarda:segredo`, o gitleaks, e `guarda:dependencias`, o `npm audit`), a
unidade inteira, os testes de integração, de e2e e de infra **que a árvore alterou**, mais os e2e que citam um texto
que o diff tirou de `apps/web/src` (`tools/ci/e2e-que-cita-literal.ts`); o caso de e2e cujas linhas o
diff tocou, e só ele, fica vermelho se passar de **metade do prazo** dele na máquina: o runner leva perto do dobro e o prazo
é 30 s, ou o que o caso já declarava no HEAD com `test.slow()` ou `test.setTimeout()` (`tools/ci/duracao-do-e2e.ts`). Depois vêm as **mutações**
que o documento declara: aplica cada uma, roda o teste citado, exige vermelho e restaura
(`tools/processo/mutacoes.ts`). O vermelho que vale é o de um caso que rodou e falhou: a mutação que deixa o teste
vermelho por erro de carga (sintaxe, módulo que não carrega, nenhum caso rodou) é recusada com o motivo. Grava o carimbo que o hook exige antes do commit (D53). Leva minutos.
Enquanto um teste não passa, ele se roda isolado; o portão não é ferramenta de depuração.

**Código de produção sem mutação não recebe carimbo (RF17).** Tarefa ou correção que altera arquivo de
`apps/*/src` ou `packages/*/src` (fora teste e `.d.ts`) precisa, no documento dela, de ao menos um bloco
` ```mutacao ` ou da linha `**Sem mutação:** <motivo>`, com o motivo escrito. Sem um dos dois o portão fica
vermelho e o hook recusa o commit. `node tools/processo/mutacoes.ts --faltando <documento>` lista as linhas
novas com condição que nenhum bloco alcança, um item por termo da linha com vários (`and(...)`, `&&`, `||`) e também a linha
de SQL ou Lua em template string, também as do código de `tools/` (fora teste, `.d.ts`, as pastas `test/`, `tests/`,
`__tests__/`, `__fixtures__/` e `fixtures/`, e o que não é código); só informa, e a exigência acima segue só com `apps/*/src` e `packages/*/src`.

**A esteira**, em todo push da spec e da correção. Cada commit de tarefa vai para o GitHub logo depois de feito, na branch
da linha, e **a da spec** (`spec/<funcionalidade>`) recebe a soma das linhas no encontro
(`tools/processo/linhas.ts`, D79). O push da branch de linha (`spec/<funcionalidade>--l<n>`) **não** dispara a esteira: ela
repetiria o que a da spec roda no encontro e disputaria os mesmos runners (na X7, 34 das 83 execuções eram das linhas, e o veredito
chegou a levar 4 h 26). O repositório é público e a branch de linha continua indo ao GitHub: o gitleaks do portão da tarefa, antes do
commit, é a única checagem de segredo do commit da linha até o encontro, e por isso o `segredo` não sai das suítes do portão local.
O push da spec dispara tudo: `npm run typecheck`, `npm run lint`,
as duas guardas, `npm run test`, `npm run test:e2e` e `npm run test:infra` (D52). Ninguém espera por
ela: o Orquestrador lê o veredito ao fechar a tarefa seguinte (`tools/processo/esteira.ts`), e vermelho
vira correção antes de a linha andar. A spec só fecha com a esteira verde no último commit que alterou
código, e ela roda de novo em todo push na `develop`, na `release` e no `main`. O mesmo conjunto roda
na máquina com `node tools/processo/portao-local.ts --e2e --infra`, que vale no lugar dela quando o
GitHub não responde.

O preço: o que uma tarefa quebra **fora** dos testes que ela alterou aparece uma tarefa depois, na
esteira, e não antes do commit. Por isso a regra da tarefa precisa de teste criado ou alterado na
própria tarefa: é o único que roda antes dele.

Por que é assim: até 08/10/2026 toda tarefa rodava o portão inteiro, de 30 a 40 minutos, e esperava
a esteira. Até 11/10/2026 o conjunto inteiro só rodava no fim da spec: no F3 foram 74 minutos, duas
vezes, e três listas vermelhas por até quatro tarefas sem ninguém ver.
