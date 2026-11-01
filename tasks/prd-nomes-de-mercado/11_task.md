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

- [x] 11.1 — O mapa `tools/renomear/mapas/11.json`, com `"linha": true`
- [x] 11.2 — O `aplicar` e a classificação
- [x] 11.3 — As travas: o `travas.md` não lista nenhuma desta onda. A que o relatório achar ganha linha e bloco
- [x] 11.4 — O `conferir` e o `restos`. A busca dos nomes antigos em `e2e/`
- [x] 11.5 — O caso só renomeado que estoura a régua de duração fica marcado "só rename"
- [x] 11.6 — A seção "Mutações"

## Arquivos previstos

| Arquivo | Novo ou alterado |
|---|---|
| `e2e/**`, `playwright.config.ts` | alterado |
| `tools/ci/codigo-do-autenticador.test.ts` | sem diff no fim: ele importa de `e2e/support/seed.ts` só nomes que o mapa não troca (`codigoDoAutenticador`, `codigoDoPassoAnterior`, `esperaPelaViradaDoPasso`) |
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

01/11 — Triagem da divergência da 11.0 pelo Arquiteto (commit `96bb76a4`) e correção `2026-11-01-mapa-copias-do-mesmo-nome` (commit `ac520b2a`): o `portao` tem uma entrada por declaração (3 de `e2e/support/` e 17 de specs), todas → `gate`, cada uma com o seu `arquivo`; o `portao` de `tools/`, de `apps/api/test/` e de `.claude/settings.json` é `fica` (`inventario-web-e2e.md:556`, item a e b); `acionar`, `PRAZO_*` e `Cena` entram sem `arquivo`, com as cópias locais dos specs; `entrarComSegundoFator` fica fora do mapa; `PAGINA_*` segue a leitura da triagem (`WIDE_PAGE` e `HTML_PAGE_*`); a opção `perfil` → `profile` é troca à mão (`playwright.config.ts`, `profiles.ts`, `playwright.test.ts`, `components-gallery.spec.ts`, `guardas.spec.ts`); `tools/ci/playwright.test.ts` e `EmptyState.tsx` entram nos previstos.

01/11 — Homônimos que o relatório achou e que a lista do anexo (`:556`) não nomeia, classificados `fica` com a mesma linha do anexo, por serem o mesmo nome em outra declaração, que o `aplicar` não renomeia por ser de outro arquivo: `secao` (as variáveis e os parâmetros locais de `apps/`, `tools/` e dos specs, e o campo `secao` de `tools/demonstracao/conteudo-estequiometria.ts`; só o `secao` exportado de `e2e/support/gallery.ts` vira `gallerySection`) e `erroDaApi` (as duas funções locais de `apps/web/src/api/sessao.ts` e de `Atividade.test.tsx`; só a de `e2e/support/assistente.ts` vira `apiError`). O título de `test` e a mensagem de `expect` que citam `medirBlocosDaGaleria`, `carregarSemRedeLenta` e `vigiarODado` ficam (regra geral 2, `inventario-web-e2e.md:9`). O `t-secao` do comentário de `EmptyState.tsx` (CSS, `:556` d) o passo 5 trocou, a onda desfez, e o arquivo fica sem diff.

01/11 — Trava achada pelo relatório: `travas.md:198` (a opção `perfil` do Playwright). Tech Spec §5 e `travas.md`.

## Mutações

**`playwright.config.ts`** (`travas.md:198`, forma A). Com a chave antiga em cada projeto, o caso que lê `uso?.profile` do projeto fica vermelho. O `--faltando` não lista nenhuma linha nova de produção com condição: a onda só renomeia.

```mutacao
arquivo: playwright.config.ts
teste: tools/ci/playwright.test.ts › chromebook: Chromium com CPU ×4 e Fast 3G do DevTools
-      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 }, profile: CHROMEBOOK_PROFILE },
+      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 }, perfil: CHROMEBOOK_PROFILE },
```

```mutacao
arquivo: playwright.config.ts
teste: tools/ci/playwright.test.ts › celular: Chromium de 360 × 800 com toque e modo móvel, CPU ×4 e rede no máximo tão boa quanto o Fast 3G
-        profile: MOBILE_PROFILE,
+        perfil: MOBILE_PROFILE,
```

## Recomendações sem aplicar
| Revisor e rodada | Recomendação | Destino ou motivo |
|---|---|---|
| infra-guardian (1ª) | Conferir, na esteira do encontro das linhas, que o projeto `celular` continua aplicando a limitação de rede e de CPU | Não é correção, é conferência. Destino: o Validador, na esteira do encontro (a tabela "Testes que provam a regra" já exige a esteira verde); `profiles.ts` mantém `cpuMaisLenta: 4` e as redes, e a chave `profile` tem as duas mutações de `playwright.config.ts` |
| infra-guardian (1ª) | O título do caso em `tools/ci/playwright.test.ts` cita `e2e/__fixtures__/perfis.ts` e "test com perfil" | Recusada nesta tarefa: título de `test` fica (regra geral 2, `inventario-web-e2e.md:9`, e o item "Homônimo e texto na 11.0" do anexo). O caminho já estava desatualizado antes da onda (`e2e/__fixtures__/` não existe). Destino: `TODO.md` (corrigir o título quando o arquivo for tocado por outra razão) |
| test-engineer (1ª) | Só o `tsc` protege a chave `profile` do `base.extend` em `e2e/support/profiles.ts:68-69`, pelo tipo `ProfileOptions`; nenhum bloco de mutação de runtime a cobre | Recusada: o próprio revisor diz "Nada a corrigir" enquanto o `typecheck` estiver no portão, e `travas.md:198` já registra que quem pega é o `tsc`. Mutação de runtime exigiria teste novo fora do previsto (`prd.md` RF7: só nome muda) |
| test-engineer (1ª) | O "encontro das linhas na spec" só se prova na `spec/nomes-de-mercado`, com o `restos` sobre todos os mapas e a esteira com `infra` e e2e | Não é correção desta tarefa. Destino: o Validador confere o veredito da esteira no encontro |
| revisor-geral (1ª) | A seção "Troca à mão" de `tools/renomear/mapas/11.relatorio.md` lista `acionar` e `portão` que são prosa em comentários de `apps/` e `tools/`, e o relatório não diz que ficam | Recusada: o relatório é gerado por `tools/renomear/relatorio.ts` e as tabelas dele são lidas pelo `restos` (`restos.ts:53`); linha de prosa à mão se perde na próxima geração. Destino: nenhum, o motivo de cada linha está em "Divergências resolvidas nesta tarefa" do documento |
| test-engineer (2ª) | `11_task.md` cita `e2e/support/profiles.ts:68-69` para a chave `profile` do `base.extend`; o comentário novo deslocou o código em 3 linhas e o ponto certo agora é `e2e/support/profiles.ts:71-72`. "Vale acertar a citação quando o documento for tocado de novo." | Recusada nesta tarefa: é número de linha numa nota do próprio documento, que muda a cada edição do arquivo e não afeta nenhuma prova (a mutação e o `travas.md:198` citam arquivo e chave, não linha). Destino: corrigir se o documento for tocado de novo |
| revisor-geral (2ª) | Em "Como testar" de `11_task.md`, a frase diz que `tools/ci/codigo-do-autenticador.test.ts` importa `e2e/__fixtures__/sessao.ts`, e que "por isso está nos previstos". Essa pasta não existe; o arquivo importa de `e2e/support/seed.ts`, como a tabela de previstos já diz | Não aplicada, por ser a segunda rodada (recomendação de quem aprovou). Destino: `TODO.md`, para corrigir a frase na próxima vez que o documento for tocado; o desencontro não afeta código nem prova |

## Revisões

Preenchida pelo hook `tools/processo/revisoes.ts` quando cada revisor termina. Não edite à mão:
o commit fica bloqueado enquanto um revisor obrigatório não tiver rodada que valha para o código
atual, com APROVADO quando o revisor tem veto.

| Início | Fim | Revisor | Rodada | Veredito | Agente |
|---|---|---|---|---|---|
| 2026-11-01 15:25:20 | 2026-11-01 15:26:03 | `tenancy-guardian` | 1 | APROVADO | a595832817f88ea6d |
| 2026-11-01 15:25:48 | 2026-11-01 15:26:11 | `infra-guardian` | 1 | APROVADO | ab73d4681ddd28663 |
| 2026-11-01 15:25:29 | 2026-11-01 15:26:24 | `privacy-guardian` | 1 | APROVADO | ad6ef08e1f487b0e0 |
| 2026-11-01 15:25:39 | 2026-11-01 15:26:31 | `conformidade-reviewer` | 1 | APROVADO | a5df28d93749e78a6 |
| 2026-11-01 15:25:57 | 2026-11-01 15:27:50 | `test-engineer` | 1 | APROVADO | afb243e70fc6f48e8 |
| 2026-11-01 15:26:06 | 2026-11-01 15:28:07 | `revisor-geral` | 1 | APROVADO | acdb649af531bcfe3 |
| 2026-11-01 16:48:30 | 2026-11-01 16:48:54 | `test-engineer` | 2 | APROVADO | a8be7807d97e47f1f |
| 2026-11-01 16:48:46 | 2026-11-01 16:49:07 | `revisor-geral` | 2 | APROVADO | a033b65c9c81c7e62 |
