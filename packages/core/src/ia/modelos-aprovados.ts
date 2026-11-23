import { createHash } from 'node:crypto'
import { posix } from 'node:path'
import { FUNCAO_DA_TAREFA_DE_IA, FUNCOES, TAREFAS_DE_IA, type ChaveDeFuncao, type TarefaDeIa } from '@educa/shared'
import { z } from 'zod'
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
const SHA256_DO_RELATORIO_DA_RESERVA_FALSA = '8ad9e23f22de8b35c8680704bfd659370af7b33b520853d78fdf1feb06237928'

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

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
// A cadeia do RF16: entrada → relatório → `resultado.json` aprovado → AIA da função

/** A AIA de cada função de alto risco (`docs/aia/`): o modelo aprovado para a tarefa dela tem de estar citado ali, como `provedorId:modelo`. */
export const AIA_DA_FUNCAO: Readonly<Partial<Record<ChaveDeFuncao, string>>> = {
  tutor_com_o_aluno: 'docs/aia/tutor.md',
  correcao_de_objetiva: 'docs/aia/correcao-de-objetiva.md',
  adaptacao: 'docs/aia/adaptacao.md',
  classificacao_do_material: 'docs/aia/diagnostico-por-habilidade.md',
  resumo_e_alerta: 'docs/aia/sinais-e-alertas.md',
  sinais_para_o_professor: 'docs/aia/sinais-e-alertas.md',
}

/** As duas linhas da D55 da `propor_ferramenta` (`avaliacao.md`): sem as duas aprovadas, a tarefa não tem entrada. Linha **ausente** do `resultado.json` quebra como a reprovada. */
export const LINHAS_DA_D55 = ['d55_amostras', 'd55_retidos'] as const

/** A linha da classificação do material, que carrega o perfil em que foi decidida. */
const LINHA_DA_CLASSIFICACAO = 'classificacao'

/** Do `resultado.json` que `tools/ia/avaliar-modelos.ts` grava, só o que a cadeia lê. */
const resultadoGravadoSchema = z.looseObject({
  eliminado: z.boolean(),
  linhas: z.array(z.looseObject({ id: z.string(), tarefa: z.string(), situacao: z.enum(['aprovada', 'reprovada', 'nao_medida']), eliminada: z.boolean(), perfil: z.enum(['rapido', 'padrao']).optional() })),
})

const HASH_DO_RESULTADO_NO_RELATORIO = /sha256 do `resultado\.json`: `([0-9a-f]{64})`/u

/**
 * A cadeia que liga uma entrada de `MODELOS_APROVADOS` ao que a aprovou (RF16; Tech Spec §5): o `resultado.json` ao lado do relatório tem o `sha256` que o relatório traz (editado depois, deixa de valer), o finalista
 * não foi eliminado, **toda linha da tarefa** está aprovada (a ausente e a `nao_medida` quebram como a reprovada), a `propor_ferramenta` tem a D55 aprovada (`LINHAS_DA_D55`), a classificação aprovada no `padrao`
 * só vale com o perfil de `classificar_secoes` trocado no código para o `padrao` (e a do `rapido`, com o do `rapido`), e a função de alto risco tem o `provedorId:modelo` na AIA dela. A reserva falsa fica fora da AIA
 * (ela não é modelo): o resto da cadeia vale também para ela, com o `resultado.json` sintético.
 *
 * `lerTexto` devolve o texto de um arquivo a partir da raiz, ou `undefined` se ele não existe; a função fica pura. O que a guarda do relatório (`problemasDosModelosAprovados`) já recusa não é repetido aqui.
 */
export function problemasDaCadeiaDeAprovacao(
  aprovados: readonly ModeloAprovado[],
  lerTexto: (caminho: string) => string | undefined,
  perfilDaTarefa: (tarefa: TarefaDeIa) => Perfil = (tarefa) => TASK_CATALOG[tarefa].perfil,
): string[] {
  const problemas: string[] = []
  for (const entrada of aprovados) {
    const quem = `${entrada.provedorId}:${entrada.modelo}:${entrada.tarefa}`
    const problema = (motivo: string): void => {
      problemas.push(`${quem}: ${motivo}`)
    }
    const relatorio = entrada.relatorio === '' ? undefined : lerTexto(entrada.relatorio)
    if (relatorio === undefined) continue
    const caminhoDoResultado = posix.join(posix.dirname(entrada.relatorio), 'resultado.json')
    const textoDoResultado = lerTexto(caminhoDoResultado)
    if (textoDoResultado === undefined) {
      problema(`resultado_ausente:${caminhoDoResultado}`)
    } else {
      const declarado = HASH_DO_RESULTADO_NO_RELATORIO.exec(relatorio)?.[1]
      if (declarado === undefined) problema(`relatorio_sem_sha256_do_resultado:${entrada.relatorio}`)
      else if (createHash('sha256').update(textoDoResultado).digest('hex') !== declarado) problema(`sha256_do_resultado_diferente:${caminhoDoResultado}`)
      problemasDoResultado(entrada, textoDoResultado, perfilDaTarefa).forEach(problema)
    }
    problemasDaAia(entrada, lerTexto).forEach(problema)
  }
  return problemas
}

type ResultLine = z.infer<typeof resultadoGravadoSchema>['linhas'][number]

/** Toda linha da tarefa aprovada e nenhuma eliminatória reprovada; a tarefa sem linha nenhuma não foi medida. */
function problemasDasLinhasDaTarefa(daTarefa: readonly ResultLine[]): string[] {
  if (daTarefa.length === 0) return ['tarefa_sem_linha_no_resultado']
  return daTarefa.flatMap((linha) => [...(linha.situacao === 'aprovada' ? [] : [`linha_${linha.situacao}:${linha.id}`]), ...(linha.eliminada ? [`linha_eliminatoria_reprovada:${linha.id}`] : [])])
}

/** A `propor_ferramenta` precisa das duas linhas da D55 **presentes** e aprovadas. */
const problemasDaD55 = (linhas: readonly ResultLine[]): string[] =>
  LINHAS_DA_D55.filter((id) => !linhas.some((linha) => linha.id === id && linha.situacao === 'aprovada')).map((id) => `d55_nao_aprovada:${id}`)

/** O perfil em que a classificação foi aprovada é o que o código usa hoje para `classificar_secoes`: o modelo avaliado é o que atende. */
function problemasDoPerfilDaClassificacao(linha: ResultLine | undefined, perfilNoCodigo: Perfil): string[] {
  if (linha === undefined) return []
  if (linha.perfil === undefined) return ['classificacao_sem_perfil']
  return linha.perfil === perfilNoCodigo ? [] : [`classificacao_aprovada_no_${linha.perfil}_com_o_perfil_${perfilNoCodigo}_no_codigo`]
}

function problemasDoResultado(entrada: ModeloAprovado, texto: string, perfilDaTarefa: (tarefa: TarefaDeIa) => Perfil): string[] {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    return ['resultado_ilegivel']
  }
  const lido = resultadoGravadoSchema.safeParse(bruto)
  if (!lido.success) return ['resultado_ilegivel']
  const { eliminado, linhas } = lido.data
  const daTarefa = linhas.filter((linha) => linha.tarefa === entrada.tarefa)
  return [
    ...(eliminado ? ['finalista_eliminado'] : []),
    ...problemasDasLinhasDaTarefa(daTarefa),
    ...(entrada.tarefa === 'propor_ferramenta' ? problemasDaD55(linhas) : []),
    ...(entrada.tarefa === 'classificar_secoes' ? problemasDoPerfilDaClassificacao(daTarefa.find((linha) => linha.id === LINHA_DA_CLASSIFICACAO), perfilDaTarefa(entrada.tarefa)) : []),
  ]
}

function problemasDaAia(entrada: ModeloAprovado, lerTexto: (caminho: string) => string | undefined): string[] {
  if (entrada.provedorId === IDENTIDADE_DA_RESERVA_FALSA) return []
  const funcao = FUNCAO_DA_TAREFA_DE_IA[entrada.tarefa]
  if (!FUNCOES[funcao].altoRisco) return []
  const caminho = AIA_DA_FUNCAO[funcao]
  if (caminho === undefined) return [`aia_da_funcao_desconhecida:${funcao}`]
  const aia = lerTexto(caminho)
  if (aia === undefined) return [`aia_ausente:${caminho}`]
  return citaOModelo(aia, `${entrada.provedorId}:${entrada.modelo}`) ? [] : [`aia_sem_o_modelo:${caminho}`]
}

/** A AIA cita `provedorId:modelo` por inteiro: `modelo-x` não vale como citação de `modelo-x-large` nem de `modelo-x2`, e `provedor:modelo` só vale com um limite de palavra dos dois lados. */
function citaOModelo(texto: string, identidade: string): boolean {
  const escapada = identidade.replace(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`)
  return new RegExp(String.raw`(?<![\w.-])${escapada}(?![\w-]|\.\w)`, 'u').test(texto)
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
