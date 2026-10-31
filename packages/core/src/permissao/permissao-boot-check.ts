import type { OnModuleInit } from '@nestjs/common'
import { PATH_METADATA } from '@nestjs/common/constants.js'
import { Reflector, type DiscoveryService } from '@nestjs/core'
import { InvariantException } from '@educa/shared'
import { OPERACAO_ENTRY_KEY, OPERACAO_ROUTE_KEY } from '../identidade/operacao-markers.js'
import { IS_PUBLIC_KEY } from '../rate-limit/route-markers.decorator.js'
import { PERMISSAO_KEY } from './require-permissao.decorator.js'

type Controlador = abstract new (...argumentos: never[]) => unknown

const reflector = new Reflector()

/** Os nomes de método do protótipo e dos que ele herda, até `Object.prototype`: rota herdada de controller base conta. */
function metodosDaCadeia(prototipo: object): string[] {
  const nomes = new Set<string>()
  for (let atual: object | null = prototipo; atual !== null && atual !== Object.prototype; atual = Object.getPrototypeOf(atual) as object | null) {
    for (const nome of Object.getOwnPropertyNames(atual)) if (nome !== 'constructor') nomes.add(nome)
  }
  return [...nomes]
}

/** As marcações que dizem quem pode chamar a rota: a célula da matriz, a rota anônima e os dois marcadores da operação. */
const DECLARACOES_DE_ACESSO = [PERMISSAO_KEY, IS_PUBLIC_KEY, OPERACAO_ROUTE_KEY, OPERACAO_ENTRY_KEY] as const

/** Uma rota sem declaração de acesso: o nome da classe do controller e o do método. */
export interface UndeclaredRoute {
  readonly controller: string
  readonly metodo: string
}

/**
 * As rotas dos controllers que não declaram quem pode chamá-las — nem `@RequirePermissao`, nem `@Public`, nem um dos dois
 * marcadores da área da operação (`@OperacaoRoute`, `@OperacaoLoginRoute`, Tech Spec da A0) —, no método ou na classe.
 * Rota é o método com caminho registrado pelo `@Get`, `@Post` e afins.
 */
function rotasSemDeclaracao(controladores: readonly Controlador[]): UndeclaredRoute[] {
  return controladores.flatMap((controlador) => {
    const prototipo = controlador.prototype as Record<string, unknown>
    const marcadaNaClasse = (chave: string) => reflector.get<unknown>(chave, controlador) !== undefined
    return metodosDaCadeia(prototipo)
      .filter((nome) => typeof prototipo[nome] === 'function')
      .filter((nome) => {
        const metodo = prototipo[nome] as () => unknown
        if (reflector.get<unknown>(PATH_METADATA, metodo) === undefined) return false
        const marcadoNoMetodo = (chave: string) => reflector.get<unknown>(chave, metodo) !== undefined
        return !DECLARACOES_DE_ACESSO.some((chave) => marcadoNoMetodo(chave) || marcadaNaClasse(chave))
      })
      .map((nome) => ({ controller: controlador.name, metodo: nome }))
  })
}

/** As rotas sem declaração de acesso, como `Controller.metodo`. */
export function routesWithoutPermissao(controladores: readonly Controlador[]): string[] {
  return rotasSemDeclaracao(controladores).map(({ controller, metodo }) => `${controller}.${metodo}`)
}

/**
 * O boot recusado porque há rota sem declaração de acesso. A mensagem é fixa; o controller e o método de cada rota
 * ficam em `rotas`, que o teste lê sem depender do texto. O log do processo (`registerProcessErrorHandlers`) leva só o tipo e a
 * pilha do erro (`summarizeError`), então `rotas` aparece em quem captura o erro (o teste, o Nest com `abortOnError: false`), e
 * não no log do boot real.
 */
export class RoutesWithoutPermissaoError extends InvariantException {
  readonly codigo = 'ROTA_SEM_PERMISSAO'

  constructor(readonly rotas: readonly UndeclaredRoute[]) {
    super('rota sem @Permite, @RotaAnonima nem marcador da operação')
    this.name = 'RoutesWithoutPermissaoError'
  }
}

/**
 * Confere, no boot, que toda rota registrada declara quem pode chamá-la (RF17). Rota sem `@RequirePermissao`, sem
 * `@Public` e sem marcador da operação derruba a inicialização, com o nome do controller e do método: endpoint novo nasce fechado, e o
 * esquecimento aparece no primeiro `npm run test`, não em produção.
 */
export class PermissaoBootCheck implements OnModuleInit {
  constructor(private readonly descoberta: Pick<DiscoveryService, 'getControllers'>) {}

  onModuleInit(): void {
    const controladores = this.descoberta
      .getControllers()
      .map((embrulho) => embrulho.metatype)
      .filter((metatipo): metatipo is Controlador => typeof metatipo === 'function')
    const semPermissao = rotasSemDeclaracao(controladores)
    if (semPermissao.length > 0) throw new RoutesWithoutPermissaoError(semPermissao)
  }
}
