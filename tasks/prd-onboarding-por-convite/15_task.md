# Tarefa 15.0 — Professores importa a planilha da equipe

**Funcionalidade:** onboarding-por-convite · **Depende de:** 6.0, 13.0
**Subagentes obrigatórios:** `frontend-reviewer`
**Porte:** pequeno

## Objetivo

Na aba Professores, a coordenação sobe a planilha de professores pelo `ImportarPlanilha`, marca quem desligar, e vê os
cadastrados `pendente`, cada um com o convite para copiar (o `convite/refazer`).

## Contexto necessário

- `techspec.md` §9 (o `ImportarPlanilha` em Professores; o convite para copiar do cadastrado pela planilha), §4 (o
  "Copiar link" faz o `convite/refazer`)
- `prd.md` RF6, RF4 (marca)
- `docs/interface.md` §3 (Professores)
- Código: `apps/web/src/areas/coordenacao/professores/Professores.tsx`, `convite-de-professor.ts`, `api/professores.ts`;
  o `ImportarPlanilha` da 13.0

## Subtarefas

- [ ] 15.1 — "Importar professores" na aba, com a marca de desligar rotulada com nome e e-mail
- [ ] 15.2 — O cadastrado pela planilha aparece `pendente`, com "Copiar link" pelo `convite/refazer`
- [ ] 15.3 — `docs/interface.md` §3 (Professores)
- [ ] 15.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/areas/coordenacao/professores/Professores.tsx`, `convite-de-professor.ts`, `api/professores.ts` | alterado |
| `e2e/professores.spec.ts` | alterado |
| `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| Importar a planilha de professores com prévia e gravar | e2e | caminho feliz (RF6) | |
| A marca de desligar é rotulada com nome e e-mail, e sem marca ninguém sai | e2e | RF4 | |
| O cadastrado aparece `pendente` sem recarregar a página | e2e | | |
| "Copiar link" do cadastrado faz o `convite/refazer` | e2e | §4 | |
| Carregando | e2e | estados | |
| Erro com "Tentar de novo" | e2e | estados | |
| Vazio com "Baixar modelo" | e2e | estados | |
| Com dado | e2e | estados | |
| Recomeço: a lista recarrega com o diálogo aberto | e2e | | |
| Recomeço: resposta atrasada | e2e | | |
| Recomeço: a segunda pessoa na mesma aba | e2e | | |
| Recomeço: o mesmo arquivo de novo | e2e | | |
| 360 px sem rolagem horizontal | e2e | | |
| Cabe em 1366 × 768 sem a página rolar (`paginaNaoRola`) | e2e | | |
| Alvos de 44 e 24 px | e2e | | |
| axe | e2e | | |
| Uma ação cheia por tela | e2e | | |

## Como testar

- Estados: `e2e/professores.spec.ts › carregando; o vazio "Nenhum professor ainda" com o Cadastrar; o erro com "Tentar de novo"; …`; o link: `› W14: o resumo antes de enviar, o link uma vez com "Link copiado"; …`; 360 px e alvos: `› sem rolagem horizontal, também no diálogo; cartões e alvos de 44 px; …`
- O componente: o spec da 13.0 (`e2e/importar-alunos.spec.ts`)
- Comando: `node tools/ci/e2e.ts --manter-ambiente e2e/professores.spec.ts`
- **Telas:** `coordenacao`, `/coordenacao/professores`, `text=Professores` → "Importar professores" → prévia com marca; → lista com o cadastrado `pendente`; sem mockup

## Autoconferência

As 12 perguntas do modelo, no plano. Na 2, procure em `e2e/` os textos da lista de professores que contam linhas.

## Fora do escopo desta tarefa

"Enviar convites" e o estado do envio (F2c).

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
