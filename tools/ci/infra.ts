import { executarTestesComInfra, fatiaDosArgumentosDaInfra } from './compose.ts'
import { encerrarCom } from './executar.ts'

// Borda, métricas, alertas e jobs contra o compose inteiro (D52): cada teste sobe o que precisa além da infra.
// Os arquivos rodam um por vez, e a soma passou dos 45 min (execução 43325031136): a esteira roda a infra em fatias, cada
// uma no seu runner (`--shard=<i>/<n>`, que o Vitest reparte por arquivo). Sem fatia, o projeto inteiro.
await encerrarCom(executarTestesComInfra('testes de integração da infra', 'test:infra', fatiaDosArgumentosDaInfra(process.argv.slice(2))))
