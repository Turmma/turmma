# Tarefa 19.0 — "Corrigir o e-mail" no painel do professor

**Funcionalidade:** acesso-e-convites · **Depende de:** 18.0, 4.0
**Subagentes obrigatórios:** `frontend-reviewer`, `privacy-guardian`, `test-engineer`
**Porte:** pequeno

## Objetivo

O painel do professor `pendente` ou `vencido` ganha "Corrigir o e-mail": a coordenação digita o e-mail certo, recebe o link uma vez e
reenvia por e-mail ou copia. O texto do `falhou` passa a apontar esse caminho. Fecha, com a 18.0, o maior 1 da validação.

## Contexto necessário

- `techspec.md` §9 (Professores) e §5 "Corrigir o e-mail"; `prd.md` §7 "E-mail que volta", RF18
- `cenarios.md`, "Telas" (linhas "Corrigir o e-mail" e "Professores, envio") e a linha [E] de "Corrigir o e-mail"
- `docs/interface.md`, Professores, item **(4)**, já com o desenho
- Regras 50 e 20 (o link fora do cache, da URL, do log e do armazenamento, como o do refazer)
- Em `apps/web/src/areas/coordenacao/professores/`: `PainelDoProfessor.tsx` ("Reenviar", "Refazer convite" e o link uma vez), `convite-de-professor.ts` (`TEXTO_DO_EMAIL_JA_CADASTRADO`, `TEXTOS_DO_CONVITE_QUE_MUDOU`), `envio-do-convite.ts` (o `falhou`)

## Subtarefas

- [ ] 19.1 — O botão secundário "Corrigir o e-mail" só no `pendente` e no `vencido`, e o diálogo com os estados da linha "Corrigir o e-mail" de "Telas"; o `CONFLITO` relê a lista e decide o texto pelo estado relido
- [ ] 19.2 — O sucesso: "E-mail corrigido", o link uma vez com "Copiar link", e "Enviar por e-mail", que abre o diálogo do "Reenviar" daquele professor; o texto do `falhou` vira "Não chegou. Corrija o e-mail e reenvie, ou copie o link"
- [ ] 19.3 — `docs/interface.md` conferido contra a tela; `grep -rn 'Confira o e-mail e reenvie' apps/web/src e2e/ docs/`, cada ocorrência trocada ou justificada aqui
- [ ] 19.4 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `apps/web/src/areas/coordenacao/professores/PainelDoProfessor.tsx`, `PainelDoProfessor.test.tsx` | alterado |
| `apps/web/src/areas/coordenacao/professores/DialogoDeCorrigirEmail.tsx`, `DialogoDeCorrigirEmail.test.tsx` | novo |
| `apps/web/src/areas/coordenacao/professores/convite-de-professor.ts`, `convite-de-professor.test.ts` | alterado |
| `apps/web/src/areas/coordenacao/professores/envio-do-convite.ts`, `envio-do-convite.test.ts` | alterado |
| `apps/web/src/areas/coordenacao/professores/api/` (a chamada nova) | alterado |
| `e2e/professores-envio.spec.ts` | alterado |
| `docs/interface.md` | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| ponta a ponta | e2e | `falhou` → corrigir → enviar → Mailpit no e-mail novo → aceita → vê a turma da grade | |
| botão por estado | unidade | só no `pendente` e no `vencido` | |
| e-mail de hoje | unidade | não aparece | |
| carregando | unidade | botão ocupado; clique duplo, uma chamada | |
| `CONFLITO` em aberto | unidade | lista relida; texto do e-mail; foco no campo | |
| `CONFLITO` com estado mudado, `NAO_ENCONTRADO` | unidade | texto do convite que mudou; fecha; foco no painel | |
| rede | unidade | "Tentar de novo"; a tentativa seguinte apaga o aviso | |
| sucesso | unidade | link uma vez, "Copiar link"; fechar tira o link; `pendente` sem envio | |
| link fora do navegador | unidade | fora do cache, da URL e do armazenamento | |
| "Enviar por e-mail" | e2e | abre o "Reenviar", que diz que o link mostrado caduca | |
| texto do `falhou` | unidade | o novo | |
| recomeço | e2e | outra coordenadora na aba; resposta atrasada (`page.route`); falha com o diálogo aberto e lista relida | |
| 360 px e 1366 × 768 | e2e | `paginaNaoRola`; 44 px nas ações principais, 24 px no resto | |

## Como testar

- e2e: `e2e/professores-envio.spec.ts` › "o professor abre o link do e-mail, cria a senha e aceita" (`mensagemChegou`, `mensagemDoMailpit`, `outroNavegador`); recomeço › "a leitura atrasada de antes do "Reenviar"…"; medida › "a 360 px não rola de lado…, no painel e no diálogo "Reenviar""
- Cena (`e2e/support/seed.ts`): `convidarProfessorNoBanco`, `definirOEnvioDoConvite(usuarioId, 'falhou')`, `criarAlocacaoDoProfessor`, `criarAulasNoBanco`
- Unidade: `PainelDoProfessor.test.tsx`, com o `FakeNetwork`
- Isolado: `node tools/ci/e2e.ts --manter-ambiente e2e/professores-envio.spec.ts`
- Armadilhas: a fatia 1 do e2e está no teto (27 de 27 min) e caso novo nela reprova `tools/ci/esteira.test.ts` (`tools/ci/prazo-do-e2e.ts`; `docs/runbook.md`, "Esteira vermelha no e2e"); o texto novo do `falhou` muda fotos e specs que o citam
- Telas: `coordenacao`, `/professores`, abrir a Ana (`falhou`) → "Corrigir o e-mail": vazio, `CONFLITO`, sucesso com o link

## Autoconferência

As 12 perguntas do `task-template.md`, no plano; pesam a 2 (o `falhou`), a 9 (reaproveite o "Reenviar" e o link do refazer) e a 10.

## Fora do escopo desta tarefa

A rota (18.0). Mostrar o e-mail de hoje. Corrigir o e-mail de quem já entrou.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
