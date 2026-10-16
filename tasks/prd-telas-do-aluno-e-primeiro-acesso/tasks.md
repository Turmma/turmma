# Tarefas — Telas do aluno e primeiro acesso

**PRD:** `prd.md` · **Tech Spec:** `techspec.md` · **Mockup:** `mockup.md`
<!-- Quantas estão concluídas não se escreve aqui: `node tools/processo/estado.ts` conta pela lista. -->

## Lista

- [x] **1.0 — A pessoa marca que viu a introdução, e o `/v1/eu` devolve a data**
  - [x] 1.1 Coluna `usuario.introducao_vista_em`, migration e a coluna no arquivo do titular
  - [x] 1.2 `GET /v1/eu` devolve `introducaoVistaEm`, a mais antiga do mesmo papel na conta, e, se a data veio de outra escola e a própria linha está nula, grava `now()` nela, nunca o valor emprestado
  - [x] 1.3 `POST /v1/eu/introducao`, idempotente e sem ano letivo, com a ação `eu.concluir_introducao` na matriz
  - [x] 1.4 `concluirIntroducao()` no cliente da web; fixtures do e2e e vitrine criam pessoa com a introdução vista
  - [x] 1.5 `docs/lgpd.md` (linha nova no mapa) e `docs/modelo-de-dados.md`
  - [x] 1.6 Testes: repetida, em paralelo, dois usuários da mesma escola, sem ano em curso, vínculo encerrado, duas escolas, dois papéis, arquivo do titular

- [ ] **2.0 — O aluno navega por Início, Tarefas e Eu, e abre no Início**
  - [ ] 2.1 Os endereços novos em `caminhos.ts` (inclusive os três `bem-vindo` e `ehTelaDeFoco`)
  - [ ] 2.2 Os três lugares em `navegacao.ts`; "Privacidade" sai do rodapé
  - [ ] 2.3 `Inicio.tsx` e `Eu.tsx` com o que já existe; `/aluno/minha-turma` redireciona; "Sair" pelo contexto da casca
  - [ ] 2.4 O aluno abre em `/aluno/inicio`; fixtures e specs que esperavam "Atividades"
  - [ ] 2.5 `docs/interface.md` 11.1 e `docs/glossario.md`
  - [ ] 2.6 Testes: os lugares, cada endereço antigo, o redirecionamento, "Sair" e a segunda pessoa

- [ ] **3.0 — O Início mostra o Tutor, a faixa de supervisão e as próximas tarefas**
  - [ ] 3.1 O seed de `infra/scripts/carga-login.ts` com ano em curso, turma e atividades, e `infra/k6/login-7h30.js`: o aluno faz `/v1/eu` e `minhas-atividades` depois do login, com o p95 das autenticadas valendo na rajada
  - [ ] 3.2 A tela: saudação fixa, faixa presa, "Para fazer", os caminhos até o Tutor e o aviso da avaliação (sem `tutor/conversa`)
  - [ ] 3.3 Testes: os quatro estados, a rede sem `tutor/conversa`, a avaliativa, o aluno sem turma, a varredura de texto e o k6

- [ ] **4.0 — Tarefas em três grupos: Para fazer, Entregues e Corrigidas**
  - [ ] 4.1 `separarAtividades` em três grupos e os textos de estado
  - [ ] 4.2 `materia.ts`: do nome da disciplina para a cor e o ícone do ladrilho
  - [ ] 4.3 A lista com `Linha` e `Ladrilho`, o vazio de cada grupo e "Ver mais tarefas"
  - [ ] 4.4 Testes: a separação, os quatro estados, "Corrigida" só com correção aprovada

- [ ] **5.0 — As peças da introdução: tela de foco, balão, comemoração e a onça em três poses**
  - [ ] 5.1 As poses acenando, apontando e comemorando em `componentes/onca/`, com o mesmo rosto neutro
  - [ ] 5.2 `TelaDeFoco`, `Balao`, `Comemoracao` e `introducao/Introducao`
  - [ ] 5.3 A casca em modo de foco nos endereços de `ehTelaDeFoco`
  - [ ] 5.4 A seção da galeria, nos dois temas
  - [ ] 5.5 Testes: ordem, foco, botões iguais, passo obrigatório, movimento reduzido, rosto das poses, quem importa a onça e a `Comemoracao`, a casca em foco

- [ ] **6.0 — A tarefa aberta na pele nova, com a comemoração na entrega**
  - [ ] 6.1 A moldura da tarefa aberta com as peças da X1, sem mudar o fluxo
  - [ ] 6.2 A `Comemoracao`, uma vez, depois do envio confirmado nesta tela
  - [ ] 6.3 Testes: aparece no envio; não aparece ao reabrir, no resultado nem na encerrada

- [ ] **7.0 — Eu: a turma, como estou indo, Privacidade e Sair**
  - [ ] 7.1 `consultaMemoriaDoTutor` (só `trabalhos` com resultado)
  - [ ] 7.2 A tela: cartão da turma, "Como estou indo" e as linhas
  - [ ] 7.3 Testes: os quatro estados, sem turma no ano, só correção aprovada, nada de colega

- [ ] **8.0 — O aluno escolhe o tamanho da letra, em Ajustes**
  - [ ] 8.1 `letra.ts`, o script em linha e o CSS do `<html>`
  - [ ] 8.2 `TamanhoDaLetra` e o diálogo "Ajustes" em Eu, com a `Aparencia`
  - [ ] 8.3 `docs/interface.md`
  - [ ] 8.4 Testes: antes do primeiro quadro, só grava ao escolher, armazenamento recusando, 360 px com Maior

- [ ] **9.0 — A introdução do aluno, com o aviso de privacidade em linguagem de 11 anos**
  - [ ] 9.1 `aviso-de-privacidade.ts` e `textos-da-introducao.ts`, com teste
  - [ ] 9.2 `BemVindo.tsx` do aluno, a rota e o desvio da primeira entrada em `paginas/Inicio.tsx`
  - [ ] 9.3 "Rever a introdução" em Eu
  - [ ] 9.4 `docs/aia/tutor.md`, `docs/lgpd.md` (seção 9) e `docs/conformidade-mec.md`
  - [ ] 9.5 Testes: primeira e segunda entrada (contexto novo), avisos sem "pular", passo 4, sair no meio, rever, estados da `BemVindo`, o texto do aviso

- [ ] **10.0 — A introdução do professor**
  - [ ] 10.1 `textos-da-introducao.ts` e `BemVindo.tsx` do professor, com a rota
  - [ ] 10.2 "Rever a introdução" no menu da pessoa
  - [ ] 10.3 Testes: primeira entrada pelo convite, pular, rever, estados da `BemVindo`, o professor de duas escolas

- [ ] **11.0 — A introdução da coordenação**
  - [ ] 11.1 `textos-da-introducao.ts` e `BemVindo.tsx` da coordenação, com a rota
  - [ ] 11.2 "Rever a introdução" no menu da pessoa
  - [ ] 11.3 Testes: primeira entrada pelo convite e pelo segundo fator, pular, rever, estados da `BemVindo`, o aviso de incidente por cima

## Dependências e paralelismo

| Tarefa | Depende de | Pode correr em paralelo com |
|---|---|---|
| 1.0 | — | — |
| 2.0 | 1.0 | — |
| 3.0 | 2.0 | 4.0 a 11.0 |
| 4.0 | 2.0 | 3.0, 5.0, 7.0, 8.0 |
| 5.0 | 2.0 | 3.0, 4.0, 7.0, 8.0 |
| 6.0 | 4.0, 5.0 | 3.0, 7.0 a 11.0 |
| 7.0 | 2.0 | 3.0, 4.0, 5.0, 6.0 |
| 8.0 | 7.0 | 3.0, 4.0, 5.0, 6.0 |
| 9.0 | 5.0, 8.0 | 3.0, 6.0 |
| 10.0 | 9.0 | 3.0, 6.0 |
| 11.0 | 10.0 | 3.0, 6.0 |

A 9.0, a 10.0 e a 11.0 não correm juntas: as três editam `paginas/Inicio.tsx`, `e2e/__fixtures__/casca.ts`,
`e2e/escola-montada.spec.ts` e `e2e/roteiro-da-demonstracao.spec.ts`. A 4.0 também edita o roteiro, e por isso não
corre com elas.

## Subagentes por tarefa

| Tarefa | Subagentes obrigatórios |
|---|---|
| 1.0 | `tenancy-guardian`, `privacy-guardian`, `infra-guardian` |
| 2.0 | `frontend-reviewer`, `conformidade-reviewer` |
| 3.0 | `frontend-reviewer`, `conformidade-reviewer`, `infra-guardian` |
| 4.0 | `frontend-reviewer`, `conformidade-reviewer` |
| 5.0 | `frontend-reviewer`, `conformidade-reviewer` |
| 6.0 | `frontend-reviewer`, `conformidade-reviewer` |
| 7.0 | `frontend-reviewer`, `conformidade-reviewer`, `privacy-guardian` |
| 8.0 | `frontend-reviewer`, `privacy-guardian` |
| 9.0 | `frontend-reviewer`, `conformidade-reviewer`, `privacy-guardian` |
| 10.0 | `frontend-reviewer`, `conformidade-reviewer` |
| 11.0 | `frontend-reviewer`, `conformidade-reviewer` |

`test-engineer` e `revisor-geral` entram em todas.

## Critério de pronto da funcionalidade

Do `ROADMAP.md`, X4:

- O aluno faz, por Início, Tarefas e Eu, tudo o que faz hoje, com "Sair" à vista e a faixa de supervisão presa
- Nenhuma tela do aluno mostra dado de colega, sequência de dias, pontos ou ranking (D59; regra 50, item 9)
- A introdução aparece uma vez por pessoa, pode ser pulada onde não é aviso obrigatório, e pode ser revista
- O aviso de privacidade está em linguagem de 11 anos
- O e2e do aluno e das páginas públicas continua provando as mesmas regras, nos projetos `chromebook` e `celular`

E, desta spec: os 21 requisitos do PRD com evidência; a esteira verde no último commit que alterou código; o
primeiro carregamento em até 150 kB e cada tela nova em até 30 kB; `docs/lgpd.md`, `docs/modelo-de-dados.md`,
`docs/interface.md`, `docs/glossario.md`, `docs/aia/tutor.md` e `docs/conformidade-mec.md` atualizados; e as
pendências do aviso de privacidade fechadas nos três documentos que as listam.
