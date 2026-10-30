# Fixture real do `aplicar`

Cópia, sem alteração, de quatro arquivos da árvore (30/10/2026) que declaram ou importam o schema `esquemaRespostaAvisos` do
`@educa/shared`, na API e na web, mais a linha do `index.ts` que o reexporta (só essa linha: o resto do `index.ts` exporta
centenas de nomes de arquivos que a fixture não traz). Os arquivos levam `.txt` no fim para os tipos, o lint e o `knip` da raiz
não os lerem como código; o teste (`aplicar.test.ts`) os copia para um repositório temporário sem o `.txt`.

O mapa do teste é a linha 883 de `tasks/prd-nomes-de-mercado/inventario-core-shared.md`:
`esquemaRespostaAvisos` → `avisosResponseSchema`.
