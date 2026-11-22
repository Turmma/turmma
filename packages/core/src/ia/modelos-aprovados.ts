import { createHash } from 'node:crypto'
import { TAREFAS_DE_IA, type TarefaDeIa } from '@educa/shared'
import { IDENTIDADE_DA_RESERVA_FALSA } from '../config/llm-config.js'
import type { Environment } from '../config/validate-config.js'
import { MODELO_FALSO } from './fake-adapter.js'
import type { Perfil } from './perfis.js'
import type { DeclaracaoDeSoberania } from './port.js'
import { TASK_CATALOG } from './tasks/index.js'

/**
 * Um modelo aprovado para uma tarefa (F5b, `tasks/prd-reserva-e-avaliacao/techspec.md` §5, "A aprovação"): o provedor e o modelo que passaram na avaliação daquela tarefa, o relatório de onde saiu a
 * aprovação (`docs/avaliacao/<finalista>/<data>/relatorio.md`), o `sha256` dele, quem aprovou e quando. A aprovação é **por tarefa, provedor e modelo**: trocar o modelo de um perfil da reserva tira do
 * caminho as tarefas dele até um relatório novo. O `sha256` é do arquivo do relatório, e `problemasDosModelosAprovados` o recalcula: relatório editado depois da aprovação deixa de valer.
 */
export interface ModeloAprovado {
  readonly tarefa: TarefaDeIa
  /** A identidade do adaptador que atende (`adapter.ts`): o `provedorId` do envio, ou `falso-reserva`. */
  readonly provedorId: string
  readonly modelo: string
  /** O caminho do `relatorio.md`, a partir da raiz do repositório. */
  readonly relatorio: string
  readonly sha256: string
  readonly aprovadoPor: string
  /** A data da aprovação, `AAAA-MM-DD`. */
  readonly aprovadoEm: string
}

const RELATORIO_DA_RESERVA_FALSA = 'docs/avaliacao/falso-reserva/relatorio.md'
/** O `sha256` de `docs/avaliacao/falso-reserva/relatorio.md`: mudar o relatório sintético muda este número, e o teste da constante confere. */
const SHA256_DO_RELATORIO_DA_RESERVA_FALSA = '1dc61ab6de6fad0a1a43d737430a8e004e6a554ca43c562c964a8b6356ee729e'

/**
 * O que a reserva pode atender, tarefa a tarefa. Hoje só a reserva falsa, com o relatório sintético: ela vale fora de produção, e `reservaElegivel` a recusa em `AMBIENTE=producao`. A entrada de provedor
 * de verdade só nasce de um relatório de `tools/ia/avaliar-modelos.ts` aprovado pelo Joaquim (D37), e entra aqui junto da linha da D37 revista.
 */
export const MODELOS_APROVADOS: readonly ModeloAprovado[] = TAREFAS_DE_IA.map((tarefa) => ({
  tarefa,
  provedorId: IDENTIDADE_DA_RESERVA_FALSA,
  modelo: MODELO_FALSO,
  relatorio: RELATORIO_DA_RESERVA_FALSA,
  sha256: SHA256_DO_RELATORIO_DA_RESERVA_FALSA,
  aprovadoPor: 'sintetico',
  aprovadoEm: '2026-11-22',
}))

/**
 * O que está errado em cada entrada, uma frase por defeito, ou lista vazia: a tarefa fora de `TAREFAS_DE_IA`, a entrada sem `relatorio`, `sha256` ou `aprovadoPor`, o relatório que não existe e o que o
 * `sha256` não confere. `lerRelatorio` devolve o texto do arquivo, ou `undefined` se ele não existe; quem lê o disco é o teste, e a função fica pura. Vale também para a entrada do falso.
 */
export function problemasDosModelosAprovados(aprovados: readonly ModeloAprovado[], lerRelatorio: (caminho: string) => string | undefined): string[] {
  const problemas: string[] = []
  for (const entrada of aprovados) {
    const quem = `${entrada.provedorId}:${entrada.modelo}:${entrada.tarefa}`
    const problema = (motivo: string): void => {
      problemas.push(`${quem}: ${motivo}`)
    }
    if (!(TAREFAS_DE_IA as readonly string[]).includes(entrada.tarefa)) problema('tarefa_fora_de_TAREFAS_DE_IA')
    if (entrada.aprovadoPor === '') problema('sem_aprovadoPor')
    if (entrada.sha256 === '') problema('sem_sha256')
    if (entrada.relatorio === '') {
      problema('sem_relatorio')
      continue
    }
    const texto = lerRelatorio(entrada.relatorio)
    if (texto === undefined) problema(`relatorio_ausente:${entrada.relatorio}`)
    else if (entrada.sha256 !== '' && createHash('sha256').update(texto).digest('hex') !== entrada.sha256) problema(`sha256_diferente:${entrada.relatorio}`)
  }
  return problemas
}

/** A reserva como a elegibilidade a vê: a identidade e o modelo de cada perfil. O `ModelAdapter` da reserva já tem os dois. */
export interface ReservaDoGateway {
  readonly identidade: string
  modeloDoPerfil(perfil: Perfil): string
}

/** Da tarefa, só o que a aprovação lê: o nome e o perfil, que diz qual modelo da reserva a atenderia. */
export interface TarefaDaReserva {
  readonly nome: TarefaDeIa
  readonly perfil: Perfil
}

/**
 * A tarefa tem aprovação para **esta** reserva: entrada com o nome dela, a identidade da reserva e o modelo que a reserva usa no perfil dela. O `provedorId` e o modelo contam os dois: o mesmo modelo em outro
 * provedor, ou o mesmo provedor com outro modelo, não é o que foi avaliado. A entrada do `falso-reserva` não vale com `AMBIENTE=producao`.
 */
export function aprovadaParaAReserva(tarefa: TarefaDaReserva, reserva: ReservaDoGateway, ambiente: Environment, aprovados: readonly ModeloAprovado[] = MODELOS_APROVADOS): boolean {
  const modelo = reserva.modeloDoPerfil(tarefa.perfil)
  return aprovados.some(
    (entrada) => entrada.tarefa === tarefa.nome && entrada.provedorId === reserva.identidade && entrada.modelo === modelo && (ambiente !== 'producao' || entrada.provedorId !== IDENTIDADE_DA_RESERVA_FALSA),
  )
}

/** As tarefas que a reserva pode atender: são as que `categoriasDasTarefas` (`soberania.ts`) usa para dizer quais categorias o contrato dela tem de cobrir. */
export function tarefasAprovadasParaAReserva(reserva: ReservaDoGateway, ambiente: Environment, aprovados: readonly ModeloAprovado[] = MODELOS_APROVADOS): TarefaDeIa[] {
  return TAREFAS_DE_IA.filter((nome) => aprovadaParaAReserva({ nome, perfil: TASK_CATALOG[nome].perfil }, reserva, ambiente, aprovados))
}

export interface ContextoDaReserva {
  /** A reserva configurada. Ausente, nenhuma tarefa é elegível. */
  readonly reserva?: ReservaDoGateway
  /** A conferência da D62 **dela** (`SoberaniaNaSubida`, ligada na 2.0). Ausente vale não conferida: falha fechada. */
  readonly soberania?: DeclaracaoDeSoberania
  readonly ambiente: Environment
  /** `MODELOS_APROVADOS`, ou o que o teste injeta. */
  readonly aprovados?: readonly ModeloAprovado[]
}

/**
 * A reserva pode atender esta tarefa? Configurada, conferida na D62 e com aprovação para a tarefa, no provedor e no modelo que ela usa no perfil. Uma função só, e a do gateway a chama nos dois ramos
 * (a queda e a falta de vaga): a que confere só num deles deixa o Tutor chegar a modelo que não passou nas amostras dele (RF4).
 */
export function reservaElegivel(tarefa: TarefaDaReserva, contexto: ContextoDaReserva): boolean {
  const { reserva } = contexto
  if (reserva === undefined || contexto.soberania?.conferida !== true) return false
  return aprovadaParaAReserva(tarefa, reserva, contexto.ambiente, contexto.aprovados)
}
