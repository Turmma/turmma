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
- `'Banco'` num array (palavra comum como literal inteiro);
- `/\bFila\b/` numa regex e `'migrar('` numa string (palavra comum colada);
- `'@Banco'` num literal que não é e-mail (precedida de `@`);
- `'./Fila/x'` numa string (segmento de caminho; `Fila` não tem arquivo nem pasta com o mesmo nome e a mesma caixa);
- `'dist/src/fila/x'`, com a pasta `packages/nucleo/src/fila` no mapa, e `'dist/credencial/hash-de-senha.js'`, com o
  arquivo `apps/api/src/credencial/hash-de-senha.ts` (pasta-mãe e nome, sem o caminho inteiro);
- `'@educa/nucleo'` numa string, com o pacote `@educa/nucleo` no mapa (o pacote inteiro);
- `'schema.Banco'` numa string e `/Banco\.x/` numa regex (acesso a membro);
- `'@SemEscopo('` numa string (identificador);
- um `-w` do `package.json` da raiz, um caminho antigo no `knip.json` e um caminho em `.github/`.

**Não listados (passo 6):**
- "com" numa string de tela, porque a palavra comum em prosa não é listada;
- `'teste@exemplo.com'` e `'https://github.com/x'` (e-mail e URL);
- `'hash-de-senha.js'` numa string, com o arquivo `apps/api/src/credencial/hash-de-senha.ts` no mapa (nome solto);
- `'nucleo'` numa string, com o pacote `@educa/nucleo` no mapa;
- `'./fila/x'` numa string, fora de import, com o símbolo `Fila` e a pasta `packages/nucleo/src/fila` no mapa: o nome solto da pasta é limite
  declarado, e em minúscula não é o símbolo;
- um arquivo não versionado da raiz.

## `reaplicar` (1.0)

- o `de` já renomeado não é erro;
- a ocorrência nova é renomeada.

## `conferir` (2.0)

**Vermelho quando:**
- muda uma string, uma regex, um `JsxText`, uma chave de objeto ou a parte fixa de um template;
- some um caso de teste;
- aparece um especificador ou um nome exportado fora do mapa;
- muda uma string em `infra/scripts/`.

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

A base é o `git ls-files`. O item que nomeia `__fixtures__/` ou `mockups/` confere contra a base inteira, e os demais
contra a base sem essas pastas e sem `dist/`. As fontes, cada uma com o seu mínimo de itens lidos (o número de hoje,
gravado no teste): `configuracaoDasGuardas`, `EXCECOES_DAS_GUARDAS`, `PASTA_DOS_ADAPTADORES`, `ESCOPO_DO_ERRO_TIPADO`,
os `path` do `camadas.cjs`, `guardioes-por-caminho.ts`, os `files` e os `ignores` do `eslint.config.mjs`, os
workspaces, as entries, o `project` e o `ignore` do `knip.json` (quatro fontes), o `paths:` das regras e os caminhos
de `dist` de `infra/scripts/` e de `tools/ia/medir-risco-a-vida.ts`, cada um com a fonte `.ts` em `src/` (revisão da
spec, rodada 9, recomendação do `infra-guardian`).

**Verde:**
- `tools/guardas/__fixtures__/**`, que casa na base inteira;
- `**/dist/**`, só pela exceção nominal declarada.

**Vermelho:**
- um glob que não casa nada;
- um array com um só item vazio;
- um `path` em regex do `camadas.cjs`;
- um `files` e um `ignores` do `eslint.config.mjs`;
- um workspace inexistente no `knip.json` e um glob de `project` com o caminho antigo;
- um glob inexistente no `paths:` de uma regra;
- uma fonte que rende menos itens que o mínimo dela, como as entries do `knip.json` puladas;
- um glob que só casa com arquivo dentro de `__fixtures__/` sem nomear a pasta.
- um caminho de `dist` cuja fonte em `src/` não existe.
