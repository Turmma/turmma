# Tarefa 11.0 — Onda do e2e, símbolos (linha web)

**Funcionalidade:** nomes-de-mercado · **Depende de:** 10.0 e a correção `2026-11-01-mapa-copias-do-mesmo-nome`
**Subagentes obrigatórios:** `tenancy-guardian`, `privacy-guardian`, `conformidade-reviewer`, `infra-guardian`, `test-engineer`, `revisor-geral`
**Porte:** grande

## Objetivo

As fixtures, os ajudantes e os page objects de `e2e/` passam ao nome de mercado. Os seletores, o texto dos casos e o
`esquemaDeCor` ficam como estão. Fecha a linha web, e o encontro das duas linhas na spec deixa a árvore sem resto.

## Contexto necessário

- `tasks.md`, "O procedimento de cada onda" (o mapa leva `"linha": true`)
- `techspec.md` §5, §7c e §13 (a régua de duração do e2e)
- `prd.md` RF3, RF6 e RF7
- `inventario-web-e2e.md` §12, mais "Não muda, mas parece". As duas linhas `e2e/` de `inventario-adenda-2.md`
- `guarda.md`, a exceção nominal `esquemaDeCor`
- A leitura do anexo (triagem da divergência da 11.0, 01/11/2026):
  - `portao` (`inventario-web-e2e.md:384`): uma entrada por declaração, todas → `gate`, cada uma com o seu `arquivo`
    (`support/assistente.ts`, `support/pedidos-do-titular.ts`, `support/professor/sino.ts` e cada spec que declara a cópia
    local); o mapa só passa depois da correção acima (Tech Spec §5). O `portao` de `tools/`, de `apps/api/test/` e de
    `.claude/settings.json` é `fica`, item "Homônimo e texto na 11.0" do anexo. Comentário com `portao` é troca à mão
  - opção `perfil` → `profile` (`:362`): fora do mapa, troca à mão da onda (o membro de `OpcoesDoPerfil`, a chave do
    `base.extend`, as duas de `playwright.config.ts`, as desestruturações da fixture em `profiles.ts`,
    `components-gallery.spec.ts` e `guardas.spec.ts`, a mensagem de `profiles.ts:70` e o `perfil?:` e as leituras de
    `tools/ci/playwright.test.ts`). É trava (11.3): linha nova em `travas.md` e bloco de mutação (o caso de
    `playwright.test.ts` que lê `uso?.profile` fica vermelho com a chave antiga em `playwright.config.ts`); as chaves e a
    mensagem vão para `excecoesDoConferir`. O outro `perfil` fica (anexo, item 11.0 c)
  - `PAGINA_*` (`:368`): vale o exemplo literal e, nas outras oito, o prefixo `HTML_PAGE_`: `PAGINA_MAIS_LARGA` →
    `WIDE_PAGE`, `PAGINA_DENTRO_DA_LARGURA` → `HTML_PAGE_WITHIN_WIDTH`, `PAGINA_BOTOES_DE_16_PX` → `HTML_PAGE_16_PX_BUTTONS`,
    `PAGINA_BOTOES_DE_44_PX` → `HTML_PAGE_44_PX_BUTTONS`, `PAGINA_SEM_CONTRASTE` → `HTML_PAGE_LOW_CONTRAST`,
    `PAGINA_COM_CONTRASTE` → `HTML_PAGE_GOOD_CONTRAST`, `PAGINA_COM_503_NO_NOME_DA_ESCOLA` → `HTML_PAGE_503_IN_SCHOOL_NAME`,
    `PAGINA_COM_O_503_CRU` → `HTML_PAGE_RAW_503`, `PAGINA_COM_O_503_COLADO_AO_BOTAO` → `HTML_PAGE_503_GLUED_TO_BUTTON`
  - `entrarComSegundoFator` (`:374`) não está no e2e: fora do mapa da 11.0 (anexo, item 11.0 e). As cópias locais de
    `acionar`, `PRAZO_*` e `Cena` nos specs entram junto, pela entrada sem `arquivo`

## Subtarefas

- [ ] 11.1 — O mapa `tools/renomear/mapas/11.json`, com `"linha": true`
- [ ] 11.2 — O `aplicar` e a classificação
- [ ] 11.3 — As travas: o `travas.md` não lista nenhuma desta onda. A que o relatório achar ganha linha e bloco
- [ ] 11.4 — O `conferir` e o `restos`. A busca dos nomes antigos em `e2e/`
- [ ] 11.5 — O caso só renomeado que estoura a régua de duração fica marcado "só rename"
- [ ] 11.6 — A seção "Mutações"

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `e2e/**`, `playwright.config.ts` | alterado |
| `tools/ci/codigo-do-autenticador.test.ts` | alterado |
| `tools/ci/playwright.test.ts` | alterado (a opção `perfil` → `profile`, à mão; triagem da divergência da 11.0) |
| `apps/web/src/components/states/EmptyState.tsx` | sem diff no fim: o passo 5 troca o `secao` de `` `t-secao` ``, a onda desfaz e registra `fica` (Tech Spec §5, passo 5; triagem da divergência da 11.0) |
| `tools/renomear/mapas/11.json`, `tools/renomear/mapas/11.relatorio.md` | novo |

## Testes que provam a regra

| Cenário | Tipo | O que prova | Caso |
|---|---|---|---|
| `conferir` | ferramenta | só nome, os mesmos casos (RF7) | |
| `restos` | ferramenta | nada sobra em código | |
| seletores | `conferir` | iguais | |
| `esquemaDeCor` | diff | intacto | |
| caso só renomeado acima da régua | marcação | marcado "só rename" (Tech Spec §13) | |
| encontro das linhas na spec | esteira | o `restos` dá zero sobre todos os mapas, e a esteira inteira, com `infra` e e2e, fica verde | |

## Como testar

- Um spec isolado: `node tools/ci/e2e.ts --manter-ambiente e2e/<arquivo>.spec.ts`.
- `tools/ci/codigo-do-autenticador.test.ts` importa `e2e/__fixtures__/sessao.ts`: por isso está nos previstos, e por
  isso a 11.0 não corre junto com a 7.0.
- O apoio do e2e é classificado por `tools/processo/mutacoes.ts` (linhas 681 e 696): a pasta mudou na 6.0.
- O encontro é na `spec/nomes-de-mercado`: ali o `restos` olha documento só com o `13.json` (2.0). Até lá, documento
  com nome de linha é esperado.

## Autoconferência

As 12 perguntas do modelo, no plano. Na 2: nenhum texto de seletor muda.

## Fora do escopo desta tarefa

A guarda (12.0) e os documentos (13.0).

## Divergências resolvidas nesta tarefa

## Mutações

**Sem mutação:** rename, sem condição nova. Vale enquanto o relatório não achar trava nova.

## Recomendações sem aplicar
