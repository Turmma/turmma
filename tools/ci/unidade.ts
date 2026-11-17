import { encerrarCom, executarEtapas, fatiaDosArgumentosDoVitest } from './executar.ts'

// A unidade em fatias, cada uma no seu runner (`--shard=<i>/<n>`, que o Vitest reparte por arquivo): dentro do `verificar` ela
// levava 387 s num runner normal e 577 s num lento, e o job passou dos 15 min com a suíte inteira verde (execução 43965073602,
// tasks/correcoes/2026-11-16-teto-do-verificar-na-esteira.md). Sem fatia, o projeto inteiro, que é o `npm run ci:unidade` da máquina.
const fatia = fatiaDosArgumentosDoVitest(process.argv.slice(2), 'unidade')

await encerrarCom(
  executarEtapas([{ nome: 'testes de unidade', comando: 'npm', argumentos: ['run', 'test:unidade', ...(fatia === null ? [] : ['--', `--shard=${fatia}`])] }]),
)
