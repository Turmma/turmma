# Casos das ferramentas — Nomes de mercado (X8)

Anexo da Tech Spec §10. Os casos do `tools/renomear/` (tarefas 1.0 e 2.0) e da trava contra filtro vazio (2.0). Os da
guarda estão em `guarda.md`.

Cada cláusula da Tech Spec §5 tem ao menos um caso que a deixa vermelha, se for retirada.

## `aplicar` (1.0)

**Rename e move:**
- o símbolo do `shared` renomeado nos dois projetos que o usam, com o comentário composto, e a string igual ao nome
  intacta;
- a forma curta `{ esquemaTurma }`, que fica com a chave mantida;
- o move com o import relativo, o import de pacote e o `vi.mock`;
- o rename só de caixa.

**Comentário e documento:**
- "com" num comentário e "Banco público" num `.md` ficam intactos.

**Recusas:**
- cada um dos seis casos de recusa;
- a ocorrência não classificada, que deixa o relatório vermelho.

**Listados (passo 6):**
- `/\bX\b/` e `x\.repository` numa regex;
- `startsWith('esquemaResposta')` e um `endsWith` com o sufixo da gramática;
- `'Banco'` num array e `'@SemEscopo('` numa string (palavra comum colada);
- um `-w` do `package.json` da raiz e um caminho em `.github/`.

**Não listados (passo 6):**
- "com" numa string de tela, porque a palavra comum em prosa não é listada.

## `reaplicar` (1.0)

- o `de` já renomeado não é erro;
- a ocorrência nova é renomeada.

## `conferir` (2.0)

**Vermelho quando:**
- muda uma string, uma regex, um `JsxText`, uma chave de objeto ou a parte fixa de um template;
- some um caso de teste;
- aparece um especificador ou um nome exportado fora do mapa.

**Verde quando:**
- o especificador e o nome exportado são os renomeados;
- a string mudada está declarada como exceção;
- um arquivo de teste foi movido e tem os mesmos casos.

## `restos` (2.0)

**Vermelho:**
- `Banco` como tipo no código;
- `` `Fila` `` entre crases num documento;
- um `.js` de `dist` com o nome antigo em `infra/`;
- na 13.0, o caminho antigo num README do ouro.

**Verde:**
- "Fila de jobs" em prosa;
- "com" numa string de tela;
- a chave mantida pelo passo 2;
- o texto de `describe`;
- o `fica`;
- `docs/decisoes.md`;
- a troca à mão registrada no relatório;
- um documento com o nome antigo numa onda de linha;
- o README do ouro numa onda que não é a 13.0.

## Trava contra filtro vazio (2.0)

A base de busca é o `git ls-files` da raiz, sem `__fixtures__/`, `mockups/` nem `dist/`.

**Vermelho:**
- um glob que não casa nada;
- um array com um só item vazio;
- um `path` em regex do `camadas.cjs`;
- um `files` e um `ignores` do `eslint.config.mjs`;
- um workspace inexistente no `knip.json`;
- um glob inexistente no `paths:` de uma regra;
- uma fonte que rende zero itens. Cada fonte tem um mínimo de itens lidos.
