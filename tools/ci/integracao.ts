import { executarTestesComInfra } from './compose.ts'
import { encerrarCom, fatiaDosArgumentosDoVitest } from './executar.ts'

// Os testes de integração contra Postgres, Redis e storage. A esteira passa a fatia (`--shard=<i>/<n>`, que o Vitest reparte por arquivo; o porquê
// está em `.github/workflows/ci.yml`); sem fatia, o projeto inteiro, que é o `npm run ci:integracao` da máquina.
await encerrarCom(executarTestesComInfra('testes de integração', 'test:integracao', fatiaDosArgumentosDoVitest(process.argv.slice(2), 'integracao')))
