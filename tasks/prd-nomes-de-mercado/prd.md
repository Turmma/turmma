# PRD — Nomes de mercado (X8)

**Status:** aprovado (Joaquim, 29/10/2026, junto com o inventário); RF7 revisto por ele na revisão da spec
**Funcionalidade do roadmap:** X8 `nomes-de-mercado`
**Depende de:** X4 (`83f1c6d8`, pousada em 26/10/2026). O F2 espera esta pousar.

Fontes: a D81 revista (24/10/2026), o item X8 do `ROADMAP.md` e as respostas do Joaquim de 29/10/2026 sobre o
alcance, o kit, as pastas e os testes. O inventário, aprovado junto com este PRD, está em `inventario.md`.

## 1. Problema

O dev que entra no Turmma vem do NestJS, do React e do BullMQ. Ele procura `AuthGuard`, `DomainError`, `Button` e
`InMemory…`, e o que encontra é `GuardaDeAutenticacao`, `ErroDeDominio`, `Botao` e `…EmMemoria`. Quando a peça
técnica está traduzida, ele a lê como mecanismo próprio e vai procurar o que ela tem de diferente. Hoje a base está
em dois idiomas: o código novo já nasce em inglês (D81) e o antigo continua em português, e o rename gradual
deixaria as coisas assim por tempo indefinido. Nas palavras do Joaquim: "coisa de software podia ser inglês, como
geralmente é chamado".

## 2. Objetivo

Toda peça técnica de `apps/`, `packages/` e `e2e/` passa a ter o nome de mercado. O domínio continua em português,
e o comportamento do sistema não muda em nada.

## 3. Fora de escopo

- **Domínio.** Os termos do glossário continuam em português: turma, nota, ferramenta, artefato, entrega, função,
  autonomia, orçamento, sessão, convite, auditoria, titular, os nomes dos agentes e os demais. O prefixo de domínio
  também fica (`TurmaController`, `EliminacaoDoTitular`). "Ferramenta" não vira `Tool` (D81)
- **Métodos e variáveis.** `criar`, `listar`, `buscar`, `travarAnoEmCurso` e as variáveis locais ficam como estão.
  Mudam só a função que é a própria peça ou a fábrica dela, o utilitário genérico e o `forRoot` do módulo dinâmico
  (inventário §2, itens 2 e 3)
- **A casca e as telas da web.** `CascaDaEscola`, `MenuDaPessoa`, `BarraDeBaixo` e os componentes e pastas das áreas
  têm nome de produto e ficam. A onça também fica, porque é a marca
- **O que é lido ou gravado fora do código:** tabela e coluna do banco, rota HTTP, evento do WebSocket, código de
  erro, texto de tela, nome de fila no Redis, variável de ambiente, nome de métrica que os alertas leem, nome de
  evento de log, nome de serviço no compose, `data-testid`, seletor do e2e, token e classe de CSS
- **`apps/despachante` e `@educa/despachante`.** O nome aparece no compose de produção, no runbook e nos alertas.
  O guia passa a dizer que esse app é o outbox relay
- **Renomear o `tools/`**, inclusive `tools/processo/` e `tools/guardas/`. O que lá cita uma peça renomeada passa
  ao nome novo (RF11)
- **O texto de `describe`, `it` e `test`**, que é a frase da regra (regra 40) e continua em português
- A renomeação técnica de `educa` para `turmma` (D54), que é trabalho próprio
- Mover arquivo de lugar, juntar ou partir módulo, refatorar ou corrigir aproveitando a passagem. O diff é só de
  nome
- Os documentos das specs fechadas (`tasks/prd-*`, exceto este) e o texto de `docs/decisoes.md`. São histórico

## 4. Papéis envolvidos

O usuário da escola não percebe nenhuma diferença. Os papéis aqui são os do time.

| Papel | O que pode fazer | O que não pode |
|---|---|---|
| Joaquim | aprovar, cortar ou trocar qualquer linha do inventário antes do rename; aprovar o pouso | — |
| Implementador | renomear o que está no inventário aprovado, com os imports, caminhos e documentos que o citam | renomear o que não está no inventário; mudar comportamento, teste ou string de fora (§3) |
| Revisores | recusar diff que não é só de nome | dispensar guardião que o caminho alterado exige (X7, RF15) |

## 5. Requisitos funcionais

**A. Inventário**

| # | Requisito | Como se prova |
|---|---|---|
| RF1 | O `inventario.md` lista cada peça técnica com nome em português em `apps/`, `packages/` e `e2e/`, com o nome atual, o nome novo, o tipo (classe, interface, tipo, constante, função, decorator, arquivo, pasta ou pacote) e o caminho, agrupada por tipo de peça e com a regra do grupo. Ele traz também a lista do que fica e do que parece mudar mas não muda | O documento existe com as colunas, e as dúvidas estão fechadas pelo Joaquim |
| RF2 | Nada é renomeado antes de o Joaquim aprovar o inventário (⛔). Peça achada depois da aprovação entra numa adenda, que ele também aprova antes do rename | Nenhum commit de rename é anterior ao commit que registra a aprovação; a adenda tem a data da aprovação |

**B. Rename**

| # | Requisito | Como se prova |
|---|---|---|
| RF3 | Nenhuma peça do inventário aprovado continua com o nome antigo em `apps/`, `packages/` e `e2e/`, seja no código, no nome de arquivo, no nome de pasta ou no comentário que a nomeia | Busca de cada nome antigo, como palavra inteira: zero ocorrência fora da lista do que fica (§3) |
| RF4 | `@educa/nucleo` vira `@educa/core`, e `packages/nucleo/` vira `packages/core/`. A imagem de cada app é construída, e o compose de desenvolvimento, o de teste e o de produção sobem com os mesmos serviços de antes | A esteira constrói as imagens; o compose de produção não tem diff de serviço |
| RF5 | O kit visual (`apps/web/src/componentes/ui/`, menos a onça) usa o nome que o shadcn e o Radix dão à mesma peça (`Button`, `Card`, `Tabs`, `Alert`, `Table`, `Dialog`) | Inventário × árvore: nenhum componente do kit com o nome antigo; o teste de fidelidade da onça continua verde sem alteração |
| RF6 | As peças de apoio dos testes (`apps/api/test/`, os `__fixtures__`, `e2e/__fixtures__`) usam o nome de mercado. O texto de `describe`, `it` e `test` não muda | Busca dos nomes antigos de apoio: zero; diff do texto dos casos: vazio |
| RF7 | O diff é só de nome. Nenhuma string de fora muda (§3), nenhum caso de teste entra ou sai, e nenhuma asserção muda, salvo o nome ou caminho renomeado que ela cita, declarado no mapa da onda com a prova (RF11; revisto pelo Joaquim em 29/10/2026). A tipagem, o lint, as guardas, a unidade, a integração e o e2e estão verdes antes da primeira onda e depois de cada onda | O gerador de migration não produz migration nova; a lista de rotas, de códigos de erro, de filas, de métricas e de eventos de log é igual antes e depois; o número de casos por suíte é igual; a esteira está verde em cada onda |

**C. Trava e documentos**

| # | Requisito | Como se prova |
|---|---|---|
| RF8 | Uma guarda recusa, em código novo, a declaração de peça com os prefixos e sufixos técnicos em português do inventário (`Adaptador…`, `…EmMemoria`, `Agendador…`, `Guarda…`, `Erro…` e os demais que o inventário listar). A mensagem dá o nome de mercado. O nome de domínio passa | Caso com `class AdaptadorX`: recusado, com a sugestão na mensagem; `class TurmaController` e `EliminacaoDoTitular`: passam; o código de hoje, depois do rename: verde |
| RF9 | O `docs/guia-do-desenvolvedor.md` (inteiro, e a §9 reescrita só com o que ainda é nosso e o padrão que implementa), o `docs/arquitetura.md`, o `docs/interface.md` e os README da camada de IA e do kit usam os nomes novos | Busca dos nomes antigos nesses documentos: zero |
| RF10 | As regras, as skills, os papéis e o `CLAUDE.md` que citam caminho ou peça renomeada passam ao nome novo | O teste de caminhos citados da X7 (RF24 dela) fica verde; a busca dos nomes antigos em `.claude/` e no `CLAUDE.md` dá zero |
| RF11 | Toda guarda, teste de arquitetura, supressão do lint e configuração que procura peça renomeada pelo nome ou pelo caminho (inventário §4) passa ao nome novo e continua recusando o que recusava | Para cada guarda afetada, um caso com o nome novo que a deixa vermelha; `eslint-suppressions.json` sem chave órfã |

## 6. Regras de negócio

- **Glossário vence.** Na dúvida se a palavra é domínio ou técnica, vale o `docs/glossario.md`: se o termo está lá,
  ou se a coordenação, o professor ou o aluno o veem na tela, é domínio e fica
- **Nome misto:** o domínio fica em português e o sufixo técnico vai em inglês, como em `TurmaController` e
  `ZodValidationPipe` (D81, item 2). Os dois idiomas não se misturam dentro da mesma palavra (regra 60.1)
- **O nome novo é o da documentação** do framework ou do padrão (NestJS, Drizzle, BullMQ, React, shadcn, Playwright,
  transactional outbox). Nome inventado em inglês não serve: o teste é o da D81, "um dev que leu a documentação
  oficial reconhece isto sem ajuda?"
- **As regras 10, 20 e 70 não se afrouxam.** O que guarda o escopo de tenant (`@SemEscopo`, as guardas de
  repository), o DTO de saída, o log sem dado pessoal, a porta única de IA e a nota com autor humano muda só de nome.
  Os testes que provam essas regras continuam provando a mesma coisa
- **Cada onda termina verde e pousável.** O rename pode parar entre duas ondas sem deixar a base quebrada

## 7. Casos de borda

| Caso | Comportamento esperado |
|---|---|
| Uma correção pousa na `develop` no meio da X8 e traz código com o nome antigo | O merge da `develop` na spec leva o nome antigo para o nome novo, e a guarda (RF8) acusa o que escapar |
| O nome novo colide com um que já existe (`LLMProvider` e `ProvedorDeIa`, os dois hoje) | O inventário diz qual fica e qual some. Sem dois nomes para a mesma peça |
| O nome novo colide com o de uma biblioteca (`Logger` do Nest, `Queue` do BullMQ, `Table` do Drizzle) | O inventário dá um nome que não precisa de alias no import, ou registra o alias de propósito |
| A peça tem nome técnico e o arquivo dela grava uma string de fora (a classe da fila muda, o nome da fila no Redis fica) | Muda a classe. A string fica e está na lista do que parece mudar mas não muda |
| A classe de erro é uma recusa de domínio (`RenovacaoRecusada`, `OperadorRecusado`) | Segue a regra que o inventário aprovou para o grupo. O código de erro que ela carrega não muda |
| O sistema de arquivos não diferencia maiúscula e minúscula (macOS, no backup) e o rename é só de caixa | O rename passa por um nome intermediário, e o checkout limpo no Linux e no macOS dá a mesma árvore |

## 8. Dado pessoal envolvido

Nenhum dado novo. O rename passa por peças que tratam dado de aluno (auditoria, titular, log, storage), mas não muda
campo, finalidade nem retenção, e o `docs/lgpd.md` não muda.

## 8b. Risco regulatório

Sem IA no caminho do aluno e sem mudança de comportamento. O risco é o rename afrouxar sem querer uma checagem das
regras 10, 20 ou 70 (uma guarda que procura `…Repository` pelo nome, um teste de arquitetura que lê caminho). O RF7 e
o RF11 cobrem esse risco: as guardas e os testes dessas regras ficam verdes e continuam pegando o que pegavam.

## 9. Métricas

- O número de peças técnicas com nome em português em `apps/`, `packages/` e `e2e/`: o total do inventário antes,
  zero depois
- O número de linhas do diff que não é rename. Ele deve ser zero, fora os documentos e a guarda nova
- O número de casos por suíte, igual antes e depois

## 10. Perguntas em aberto

Nenhuma. O corte das ondas, a guarda do RF8 e a prova do "diff só de nome" estão na Tech Spec.
