import { z } from 'zod'

/**
 * Por quanto tempo cada escola guarda o dado de pessoa (F3, RF1 a RF3; Tech Spec do F3, seção 3; regra 20, item 16).
 *
 * O catálogo mora em código: o padrão, o piso e o teto de cada categoria foram aprovados pelo Joaquim em 05/10/2026, e
 * a `retencao_escola` guarda só o ajuste que a operação fez numa escola, por contrato (`ops:retencao`). Categoria sem
 * ajuste usa o padrão. Os prazos fixos (registro de acesso, auditoria, sessão…) não se ajustam: vêm da lei ou de outra
 * fase, e aparecem à coordenação só para ela saber o que existe.
 */

/** As categorias que a escola pode ajustar, na ordem em que a coordenação as lê. */
export const CHAVES_DE_RETENCAO = [
  'conversa_tutor',
  'sinal_tutor',
  'conversa_professor',
  'execucao_agente',
  'texto_do_modelo',
  'consumo_por_aluno',
  'trabalho_do_aluno',
  'reivindicacao_decidida',
  'autoria_de_artefato',
  'material_excluido',
  'vinculo_encerrado',
  'pessoa_desativada',
] as const
export type CategoriaDeRetencao = (typeof CHAVES_DE_RETENCAO)[number]

export interface DefinicaoDaCategoria {
  /** O que se guarda, em linguagem comum: é o texto que a coordenação lê. */
  readonly descricao: string
  /** De quando o prazo conta, em linguagem comum. */
  readonly contaDe: string
  /** Meses, quando a escola não tem ajuste. */
  readonly padrao: number
  /** O menor prazo aceito: não mais curto que a obrigação da escola. */
  readonly piso: number
  /** O maior prazo aceito: não mais longo que o necessário. */
  readonly teto: number
}

/** O catálogo (Tech Spec do F3, seção 3), em meses. Padrão, piso e teto aprovados em 05/10/2026. */
export const CATEGORIAS_DE_RETENCAO: Readonly<Record<CategoriaDeRetencao, DefinicaoDaCategoria>> = {
  conversa_tutor: { descricao: 'Conversa do aluno com o Tutor', contaDe: 'cada mensagem', padrao: 12, piso: 6, teto: 24 },
  sinal_tutor: { descricao: 'Sinais do Tutor ao professor (travou, pediu a resposta pronta, repetiu a dúvida)', contaDe: 'cada sinal', padrao: 12, piso: 6, teto: 24 },
  conversa_professor: { descricao: 'Conversa do professor com o Assistente de ensino', contaDe: 'cada mensagem', padrao: 12, piso: 3, teto: 24 },
  execucao_agente: { descricao: 'Pedidos feitos à IA (o tema e os parâmetros de cada pedido)', contaDe: 'o pedido', padrao: 12, piso: 3, teto: 24 },
  texto_do_modelo: { descricao: 'O que foi enviado ao modelo de IA e o que ele respondeu', contaDe: 'a chamada', padrao: 12, piso: 1, teto: 12 },
  consumo_por_aluno: { descricao: 'Quanto cada aluno usou da IA', contaDe: 'a chamada', padrao: 12, piso: 3, teto: 24 },
  trabalho_do_aluno: { descricao: 'Respostas, correção e diagnóstico das atividades do aluno', contaDe: 'o encerramento do ano letivo', padrao: 12, piso: 6, teto: 60 },
  reivindicacao_decidida: { descricao: 'Pedidos de entrada do aluno na turma, depois de decididos', contaDe: 'a decisão (ou a solicitação, no pedido fechado na virada do ano)', padrao: 60, piso: 12, teto: 60 },
  autoria_de_artefato: { descricao: 'Quem criou cada material gerado com a IA', contaDe: 'o encerramento do ano letivo', padrao: 60, piso: 12, teto: 60 },
  material_excluido: { descricao: 'Registro do material da escola que foi excluído', contaDe: 'a exclusão', padrao: 60, piso: 12, teto: 60 },
  vinculo_encerrado: { descricao: 'Vínculos de alunos e professores com as turmas, depois de encerrados', contaDe: 'o fim do vínculo', padrao: 60, piso: 12, teto: 60 },
  pessoa_desativada: { descricao: 'Cadastro de quem foi desativado na escola', contaDe: 'a desativação', padrao: 60, piso: 12, teto: 60 },
}

/**
 * As travas entre categorias: o prazo efetivo da categoria à esquerda é o menor entre o dela e o da categoria à
 * direita. O tema de um pedido e o texto do modelo são escritos pelo professor, então não sobrevivem à conversa dele;
 * o consumo por aluno não sobrevive à conversa do aluno.
 */
export const TRAVAS_DE_RETENCAO: Readonly<Partial<Record<CategoriaDeRetencao, CategoriaDeRetencao>>> = {
  execucao_agente: 'conversa_professor',
  texto_do_modelo: 'conversa_professor',
  consumo_por_aluno: 'conversa_tutor',
}

/** Os prazos que não se ajustam por escola, na ordem em que a coordenação os lê. */
export const CHAVES_DE_PRAZO_FIXO = [
  'registro_acesso',
  'sessao',
  'convite_e_acesso_da_turma',
  'credencial',
  'lista_de_nomes',
  'registro_de_decisao',
  'tarefa_em_segundo_plano',
  'equipe_turmma',
  'registro_de_incidente',
  'arquivo_do_titular',
] as const
export type ChaveDePrazoFixo = (typeof CHAVES_DE_PRAZO_FIXO)[number]

export interface DefinicaoDoPrazoFixo {
  readonly descricao: string
  /** O prazo, em linguagem comum. */
  readonly prazo: string
}

export const PRAZOS_FIXOS: Readonly<Record<ChaveDePrazoFixo, DefinicaoDoPrazoFixo>> = {
  registro_acesso: { descricao: 'Registro de acesso: data, hora e IP de cada entrada (exigido pelo Marco Civil da Internet)', prazo: '6 meses' },
  sessao: { descricao: 'Sessões abertas no sistema, sem IP', prazo: '30 dias depois de encerradas' },
  convite_e_acesso_da_turma: { descricao: 'Convites e links de entrada nas turmas', prazo: '30 dias depois de usados, revogados ou vencidos' },
  credencial: { descricao: 'Senha, segundo fator e ligação com a conta Google ou Microsoft da escola', prazo: 'até a pessoa ser desativada' },
  lista_de_nomes: { descricao: 'Lista de nomes das turmas, antes de o aluno entrar', prazo: 'até o encerramento do ano letivo' },
  registro_de_decisao: { descricao: 'Auditoria e registro das decisões sobre o que a IA produziu', prazo: 'enquanto durar o contrato com a escola, e mais 5 anos' },
  tarefa_em_segundo_plano: { descricao: 'Registro técnico das tarefas feitas em segundo plano, só com códigos', prazo: '7 dias; a que falhou, 30 dias; a do pedido de acesso ou de eliminação que falhou, até a equipe Turmma resolver' },
  equipe_turmma: { descricao: 'Contas e acessos da equipe Turmma ao painel da operação, sem dado da escola', prazo: 'acesso, 6 meses; conta, até a desativação; registro, enquanto durar o contrato, e mais 5 anos' },
  registro_de_incidente: { descricao: 'Registro dos incidentes de segurança que afetaram a escola e de quem confirmou o aviso (Resolução CD/ANPD nº 15/2024, art. 10)', prazo: '5 anos do registro' },
  arquivo_do_titular: { descricao: 'A cópia dos dados que o aluno ou o professor baixa em "Meus dados" depois de pedir acesso à escola', prazo: '7 dias depois de pronta, ou até a eliminação da pessoa' },
}

/** O ajuste da escola numa categoria, como a `retencao_escola` o guarda. */
export interface AjusteDeRetencao {
  readonly categoria: CategoriaDeRetencao
  readonly meses: number
}

/**
 * O autor, na auditoria, do que a rotina noturna faz sem ninguém pedir: a eliminação da pessoa desativada além do prazo
 * (`pessoa_desativada`, F3, tarefa 5.0). É o apelido de operador que a Tech Spec do F3 (seção 3) reserva à rotina e restringe, por
 * check da auditoria, a quatro ações (tarefa 15.0): a auditoria exige um autor, e nenhuma pessoa decidiu.
 */
export const AUTOR_DA_ROTINA = 'rotina'

/** A finalidade fixa do ajuste na auditoria (`retencao.ajustada`): cumprir o que o contrato da escola pede. */
export const FINALIDADE_DO_AJUSTE_DE_RETENCAO = 'contrato_da_escola'

export const ORIGENS_DA_RETENCAO = ['padrao', 'ajustada'] as const
export type OrigemDaRetencao = (typeof ORIGENS_DA_RETENCAO)[number]

export interface RetencaoDaCategoria {
  readonly categoria: CategoriaDeRetencao
  /** O prazo que vale, em meses, já com a trava. */
  readonly meses: number
  /** `ajustada` quando a escola tem ajuste nesta categoria, mesmo que a trava o encurte. */
  readonly origem: OrigemDaRetencao
  /** A categoria cuja trava encurtou este prazo, ou nulo quando vale o da própria categoria. */
  readonly limitadaPor: CategoriaDeRetencao | null
}

function mesesProprios(categoria: CategoriaDeRetencao, ajustes: ReadonlyMap<CategoriaDeRetencao, number>): number {
  return ajustes.get(categoria) ?? CATEGORIAS_DE_RETENCAO[categoria].padrao
}

/**
 * O prazo efetivo de cada categoria da escola, a partir dos ajustes dela: o ajuste, ou o padrão, encurtado pela trava
 * (`TRAVAS_DE_RETENCAO`). É o que o expurgo aplica e o que a coordenação lê.
 */
export function retencaoDaEscola(ajustes: readonly AjusteDeRetencao[]): RetencaoDaCategoria[] {
  const porCategoria = new Map(ajustes.map((ajuste) => [ajuste.categoria, ajuste.meses]))
  return CHAVES_DE_RETENCAO.map((categoria) => {
    const proprio = mesesProprios(categoria, porCategoria)
    const mae = TRAVAS_DE_RETENCAO[categoria]
    const daMae = mae === undefined ? undefined : mesesProprios(mae, porCategoria)
    const limitada = mae !== undefined && daMae !== undefined && daMae < proprio
    return {
      categoria,
      meses: limitada ? daMae : proprio,
      origem: porCategoria.has(categoria) ? 'ajustada' : 'padrao',
      limitadaPor: limitada ? mae : null,
    }
  })
}

/**
 * Se o ajuste de `categoria` para `meses` cabe, com os ajustes que a escola já tem: dentro do piso e do teto, e nunca
 * acima do prazo da categoria que a trava (a dela, ajustada ou padrão). Baixar a categoria que trava outra sempre cabe:
 * o prazo efetivo da travada acompanha. Categoria fora do catálogo (um prazo fixo, ou um nome qualquer) nunca cabe.
 */
export function ajusteDeRetencaoCabe(categoria: string, meses: number, ajustes: readonly AjusteDeRetencao[]): boolean {
  const chave = CHAVES_DE_RETENCAO.find((candidata) => candidata === categoria)
  if (chave === undefined || !Number.isInteger(meses)) return false
  const { piso, teto } = CATEGORIAS_DE_RETENCAO[chave]
  if (meses < piso || meses > teto) return false
  const mae = TRAVAS_DE_RETENCAO[chave]
  if (mae === undefined) return true
  return meses <= mesesProprios(mae, new Map(ajustes.map((ajuste) => [ajuste.categoria, ajuste.meses])))
}

/** Uma categoria em `GET /v1/privacidade/retencao`: o texto comum, o prazo que vale e de onde ele vem. */
export const retencaoDaCategoriaSchema = z.strictObject({
  categoria: z.enum(CHAVES_DE_RETENCAO),
  descricao: z.string(),
  contaDe: z.string(),
  meses: z.number().int().positive(),
  origem: z.enum(ORIGENS_DA_RETENCAO),
  limitadaPor: z.enum(CHAVES_DE_RETENCAO).nullable(),
})

export const prazoFixoSchema = z.strictObject({
  chave: z.enum(CHAVES_DE_PRAZO_FIXO),
  descricao: z.string(),
  prazo: z.string(),
})

/**
 * Resposta de `GET /v1/privacidade/retencao` (Tech Spec do F3, seção 4): as categorias da escola e os prazos fixos.
 * Sem quem ajustou nem a referência do contrato, que são da operação.
 */
export const retencaoResponseSchema = z.strictObject({
  categorias: z.array(retencaoDaCategoriaSchema),
  prazosFixos: z.array(prazoFixoSchema),
})
export type RetencaoResponse = z.infer<typeof retencaoResponseSchema>
