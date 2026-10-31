import { join } from 'node:path'
import { createVitest } from 'vitest/node'
import { describe, expect, it } from 'vitest'
import { raizRepositorio } from './executar.ts'

// O `globalSetup` da integração e da infra (`tools/testes/integracao.setup.ts`) carrega `packages/core` pelo runner do
// Vitest, que resolve pelo environment `__vitest__` e não pelo `ssr`. Se a condição `source` do `vitest.config.ts` não
// chega a ele, `@educa/shared` cai no `default` (`./dist/index.js`): na máquina de quem já construiu o `dist` passa, e na
// esteira, que não o constrói, a subida da integração e da infra morre com `ERR_RESOLVE_PACKAGE_ENTRY_FAIL` (a esteira
// 39896272821, depois que a 25.0 trocou um `import type` de `contexto.ts` por import de valor).
//
// Este teste depende de API interna do Vitest 5 e do Vite 8: o environment `__vitest__` (o nome está em `vitest.config.ts`),
// `vite.environments` e `pluginContainer.resolveId`. Quem atualizar uma das duas e vir este teste vermelho deve olhar primeiro
// se a chave mudou de nome ou de lugar: o `?.` abaixo faz a ausência do environment virar vermelho, e não passar calada. A
// regra que ele prova é só uma: o runner de quem roda o `globalSetup` resolve `@educa/shared` para o `src`.
describe('resolução dos pacotes do monorepo no runner do globalSetup', () => {
  // Quem roda o `globalSetup` são os projetos `integracao` e `infra`, e não o projeto raiz: cada um é conferido pelo nome.
  it.each(['integracao', 'infra'])('@educa/shared resolve para o src no projeto %s, sem depender de dist construído', async (nome) => {
    const vitest = await createVitest('test', { watch: false, root: raizRepositorio, config: join(raizRepositorio, 'vitest.config.ts') })
    try {
      const projeto = vitest.projects.find((candidato) => candidato.name === nome)
      expect(projeto, `o projeto ${nome} não está em vitest.config.ts`).toBeDefined()
      const origem = join(raizRepositorio, 'packages/core/src/context/context.ts')
      const resolvido = await projeto?.vite.environments.__vitest__?.pluginContainer.resolveId('@educa/shared', origem)
      expect(resolvido?.id).toBe(join(raizRepositorio, 'packages/shared/src/index.ts'))
    } finally {
      await vitest.close()
    }
  }, 60_000)
})
