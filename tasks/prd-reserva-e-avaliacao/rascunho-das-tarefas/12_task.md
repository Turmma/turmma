# Tarefa 12.0 — A ferramenta de avaliação roda as amostras pelas tarefas reais e escreve o relatório do finalista

**Funcionalidade:** camada-ia · **Depende de:** nenhuma
**Subagentes obrigatórios:** `privacy-guardian`, `conformidade-reviewer`, `llm-integrator`, `pedagogia-reviewer`
**Porte:** grande

## Objetivo

`tools/ia/avaliar-modelos.ts`, rodado à mão com a chave de um finalista, passa cada amostra de `tools/ia/amostras/avaliacao-1.json`
pela tarefa real e grava em `docs/avaliacao/<finalista>/<data>/` as saídas, o julgamento e o relatório. Antes do crédito,
os eliminatórios contratuais são conferidos na fonte. Nenhum teste chama a ferramenta contra a rede.

## Contexto necessário

- `techspec.md` §1 (o segundo parágrafo), §7b, §8, §12
- `prd.md` RF13, RF14, RF15, §8b
- `cenarios.md` §1 "Avaliação (RF13 a RF16)"
- `docs/avaliacao-de-modelos.md` §1, §3 (a tabela e a 3.1), §4; `.claude/rules/30-camada-ia.md` (item 3)
- Código: `tools/ia/medir-classificacao.ts` e `tools/ia/medir-risco-a-vida.ts` (o formato, o hash, o "não roda no
  portão"), `packages/core/src/ia/openai-compat-adapter.ts`, `packages/core/src/ia/tasks/`, `docs/aia/ouro/` (os lotes já selados)

## Subtarefas

- [ ] 12.1 — `domain-researcher`: os eliminatórios da §3.1 na fonte, para Maritaca, AWS Bedrock `sa-east-1`, Magalu Cloud e
  a seção 20(d) do Google; a §1 de `docs/avaliacao-de-modelos.md` revista com fonte e data, e os ⚠️ da Tech Spec §12 respondidos
- [ ] 12.2 — `tools/ia/amostras/avaliacao-1.json` escrito por subagente em contexto limpo, que o Implementador não abre:
  as linhas da §3, sem correção de discursiva nem trecho de material de terceiro; referência aos lotes retidos da
  classificação e do risco à vida pelo sha256, sem copiá-los
- [ ] 12.3 — A ferramenta: recusa sem `AVALIACAO_BASE_URL`, `AVALIACAO_MODELO`, `AVALIACAO_CHAVE_API`; um `OpenAICompatAdapter`
  só dela; `saidas.jsonl`; o que a máquina mede (página, código BNCC por `medir-classificacao`, disparo da D36 por `medir-risco-a-vida`)
- [ ] 12.4 — O julgamento: `pedagogia-reviewer` e `conformidade-reviewer` em `julgamento.jsonl`; a lista para o Joaquim
  (reprovadas, duvidosas e 10% das aprovadas, sorteio com semente no relatório)
- [ ] 12.5 — `relatorio.md`: a taxa por linha contra o limiar, os eliminatórios, latência, tokens, custo, tokens por minuto
  oferecidos e o sha256 das amostras
- [ ] 12.6 — A guarda da D55 em `tools/guardas/`; a chave só por variável de ambiente, nunca em arquivo, com o `gitleaks` verde
- [ ] 12.7 — Testes

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `tools/ia/avaliar-modelos.ts`, `tools/ia/avaliar-modelos.test.ts` | novo |
| `tools/ia/amostras/avaliacao-1.json`, `tools/ia/amostras/README.md` | novo |
| `tools/guardas/amostras-sem-correcao-de-discursiva.test.ts` | novo |
| `docs/avaliacao-de-modelos.md` | alterado |
| `package.json` (o script `avaliar-modelos`) | alterado |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| sem `AVALIACAO_*`, a ferramenta recusa e não chama nada | U | RF14 | |
| o relatório grava o sha256 do arquivo lido; outro arquivo, outro hash | U | RF13 | |
| a ferramenta não importa nada de teste, e nenhum teste a executa contra a rede | U | regra 30.3 | |
| a conta da taxa por linha e o sorteio dos 10% com semente fixa | U | o relatório | |
| uma amostra que pede nota, correção ou devolutiva de discursiva ou redação quebra a guarda | U | D55 | |
| uma amostra com trecho de material de terceiro (marcado como tal no lote) quebra a guarda | U | licença (D5) | |
| a chave não entra no relatório nem em `docs/avaliacao/` | U | RF14 | |

## Como testar

- Hash e lote: `tools/ia/medir-classificacao.test.ts` › "um lote bem formado é lido…" e › "a mesma coisa escrita em outra
  ordem (linhas, listas e chaves) tem o mesmo hash"
- Medida sem modelo: `tools/ia/medir-risco-a-vida.test.ts`, com as respostas combinadas
- Guarda nova: `tools/guardas/executor-so-na-bancada.test.ts` (a forma de varrer arquivos)
- `npx vitest run --project unidade tools/ia/ tools/guardas/`
- Armadilha: as amostras e os lotes retidos não entram no contexto do Implementador; a tarefa trata o arquivo como opaco, como na classificacao-bncc 3.0

## Fora do escopo desta tarefa

Rodar a avaliação e registrar o resultado (13.0); `complexo` e `visao` (PRD §3).

## Autoconferência

As 12 perguntas do modelo (`.claude/skills/criar-tasks/task-template.md`), respondidas no plano antes de codar.

## Divergências resolvidas nesta tarefa

| Divergência | Motivo | Onde está na spec (`techspec.md` §, id do `cenarios.md`, documento da seção 11) |
|---|---|---|

## Mutações

```mutacao
arquivo:
teste:
```

## Recomendações sem aplicar

| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
