import 'reflect-metadata'
import { OPERACAO_ENTRY_KEY, IS_PUBLIC_KEY, OPERACAO_ROUTE_KEY } from '@educa/core'
import { RequestMethod, type DynamicModule, type Type } from '@nestjs/common'
import { GUARDS_METADATA, METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants.js'
import { Reflector } from '@nestjs/core'
import { randomUUID } from 'node:crypto'
import { GuardaDeOperador } from '../src/operacao/operador.guard.js'

/** O que o `Reflector` lê: o handler ou a classe do controller. */
type Alvo = Type | ((...argumentos: never[]) => unknown)

/** Uma rota registrada na API: o controller, o método, o verbo HTTP e o caminho completo, como o Nest os monta. */
export interface RotaRegistrada {
  readonly controlador: Type
  readonly metodo: string
  readonly handler: Alvo
  readonly verbo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  readonly caminho: string
  /** O marcador da operação no handler ou na classe, como as guardas o resolvem (o do método vence). */
  readonly marcador: 'rota' | 'entrada' | undefined
  readonly anonima: boolean
  /** As guardas do handler resolvido: as da classe e as do método, que o Nest junta. */
  readonly guardas: readonly unknown[]
}

const reflector = new Reflector()

function paraLista(valor: unknown): string[] {
  if (valor === undefined) return ['']
  return Array.isArray(valor) ? (valor as string[]) : [valor as string]
}

function juntar(...partes: string[]): string {
  return `/${partes.flatMap((parte) => parte.split('/')).filter((parte) => parte !== '').join('/')}`
}

function metodosDaCadeia(prototipo: object): string[] {
  const nomes = new Set<string>()
  for (let atual: object | null = prototipo; atual !== null && atual !== Object.prototype; atual = Object.getPrototypeOf(atual) as object | null) {
    for (const nome of Object.getOwnPropertyNames(atual)) if (nome !== 'constructor') nomes.add(nome)
  }
  return [...nomes]
}

/** As rotas dos controllers, lidas dos mesmos metadados que o Nest usa para registrá-las. */
export function rotasDe(controladores: readonly Type[]): RotaRegistrada[] {
  return controladores.flatMap((controlador) => {
    const prototipo = controlador.prototype as Record<string, unknown>
    return metodosDaCadeia(prototipo).flatMap((metodo): RotaRegistrada[] => {
      const handler = prototipo[metodo]
      if (typeof handler !== 'function') return []
      const caminhoDoMetodo: unknown = Reflect.getMetadata(PATH_METADATA, handler)
      if (caminhoDoMetodo === undefined) return []
      const verbo = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod] as RotaRegistrada['verbo']
      const alvos: Alvo[] = [handler as (...argumentos: never[]) => unknown, controlador]
      const marcador = reflector.getAllAndOverride<boolean | undefined>(OPERACAO_ROUTE_KEY, alvos) === true
        ? 'rota'
        : reflector.getAllAndOverride<boolean | undefined>(OPERACAO_ENTRY_KEY, alvos) === true
          ? 'entrada'
          : undefined
      const anonima = reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, alvos) === true
      const guardas = [...((Reflect.getMetadata(GUARDS_METADATA, controlador) as unknown[] | undefined) ?? []), ...((Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[] | undefined) ?? [])]
      return paraLista(Reflect.getMetadata(PATH_METADATA, controlador)).flatMap((doControlador) =>
        paraLista(caminhoDoMetodo).map((doMetodo) => ({ controlador, metodo, handler: handler as (...argumentos: never[]) => unknown, verbo, caminho: juntar(doControlador, doMetodo), marcador, anonima, guardas })),
      )
    })
  })
}

function ehModuloDinamico(modulo: unknown): modulo is DynamicModule {
  return typeof modulo === 'object' && modulo !== null && 'module' in modulo
}

/**
 * Os controllers de um módulo e de tudo que ele importa, pelos metadados do `@Module` e pelo que o módulo dinâmico
 * devolve (`AppModule.com(config)`). É a lista que o Nest registra, sem subir a aplicação: serve ao teste de arquitetura,
 * que não tem banco nem Redis.
 */
export function controladoresDoModulo(raiz: DynamicModule | Type): Type[] {
  const achados = new Set<Type>()
  const vistos = new Set<unknown>()
  const visitar = (modulo: unknown): void => {
    if (modulo === undefined || vistos.has(modulo)) return
    vistos.add(modulo)
    const classe = ehModuloDinamico(modulo) ? modulo.module : (modulo as Type)
    const dinamicos: Pick<DynamicModule, 'controllers' | 'imports'> = ehModuloDinamico(modulo) ? modulo : {}
    for (const controlador of [...((Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, classe) as Type[] | undefined) ?? []), ...(dinamicos.controllers ?? [])]) achados.add(controlador)
    for (const importado of [...((Reflect.getMetadata(MODULE_METADATA.IMPORTS, classe) as unknown[] | undefined) ?? []), ...(dinamicos.imports ?? [])]) visitar(importado)
  }
  visitar(raiz)
  return [...achados]
}

/** Se a rota está sob `/v1/operacao`. */
export function daOperacao(rota: Pick<RotaRegistrada, 'caminho'>): boolean {
  return rota.caminho === '/v1/operacao' || rota.caminho.startsWith('/v1/operacao/')
}

/** C41: as rotas `@RotaDeOperacao` sem a `GuardaDeOperador` no handler resolvido, como `Controller.metodo`. */
export function rotasDeOperacaoSemGuarda(rotas: readonly RotaRegistrada[]): string[] {
  return rotas.filter((rota) => rota.marcador === 'rota' && !rota.guardas.includes(GuardaDeOperador)).map((rota) => `${rota.controlador.name}.${rota.metodo}`)
}

/** C42: os caminhos `/v1/operacao` sem marcador, e os marcadores fora de `/v1/operacao`, como `VERBO caminho`. */
export function rotasForaDaCerca(rotas: readonly RotaRegistrada[]): string[] {
  return rotas.filter((rota) => daOperacao(rota) !== (rota.marcador !== undefined)).map((rota) => `${rota.verbo} ${rota.caminho}`)
}

/** O caminho com cada parâmetro (`:id`) trocado por um UUID sorteado: o que o ataque de trocar o id na URL mandaria. */
export function caminhoConcreto(caminho: string): string {
  return caminho.replace(/:[A-Za-z0-9_]+/g, () => randomUUID())
}

/**
 * As oito rotas do painel da operação (Tech Spec da A0b, seção 4). A I3 prova que as varreduras C36, C41 e C46 enxergam
 * exatamente estas, e que as rotas `@RotaDeOperacao` são elas mais o `GET /v1/operacao/eu` da A0: rota nova do painel é
 * mudança da spec, e entra aqui.
 */
export const ROTAS_DO_PAINEL: readonly string[] = [
  'GET /v1/operacao/redes',
  'POST /v1/operacao/redes',
  'GET /v1/operacao/escolas',
  'POST /v1/operacao/escolas',
  'GET /v1/operacao/uso',
  'POST /v1/operacao/escolas/:id/convite-coordenacao',
  'POST /v1/operacao/convites/:id/refazer',
  'POST /v1/operacao/convites/:id/revogar',
]

/** As rotas `@RotaDeOperacao` da API: o `/eu` da A0 e as oito do painel, em ordem, para comparar com a lista registrada. */
export const ROTAS_COM_SESSAO_DE_OPERADOR: readonly string[] = ['GET /v1/operacao/eu', ...ROTAS_DO_PAINEL].toSorted()
