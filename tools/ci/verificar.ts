import { ETAPAS_DE_GUARDA } from './etapas-de-guarda.ts'
import { encerrarCom, executarEtapas } from './executar.ts'

await encerrarCom(
  executarEtapas([
    { nome: 'tipos', comando: 'npm', argumentos: ['run', 'typecheck'] },
    { nome: 'lint e guardas', comando: 'npm', argumentos: ['run', 'lint'] },
    ...ETAPAS_DE_GUARDA,
    // A unidade tem job próprio, em fatias (`ci:unidade`): com ela aqui o job passou dos 15 min (execução 43965073602).
    // O git hook contra um git de verdade: não sobe o compose, e por isso roda aqui, e não na integração.
    { nome: 'testes do processo', comando: 'npm', argumentos: ['run', 'test:processo'] },
  ]),
)
