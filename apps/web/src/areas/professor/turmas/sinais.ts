import { NOME_DO_SINAL, type GrupoDeSinais, type Sinal, type UsoDoAluno } from '@educa/shared'
import { formatDayAndTime } from '../../../format'

/**
 * O que a conversa do Tutor diz à professora da turma (`docs/interface.md` 11.4; D8, D36, D47; regra 50, item 10; regra
 * 70, itens 4 e 7): **sinal, não conversa**. Só o trabalho: onde o aluno travou, que pediu a resposta pronta, que repetiu
 * a dúvida. Nenhum texto conclui sobre a pessoa, conta tempo parado nem compara um aluno com outro.
 */

/** A atividade ou o material a que o sinal se refere: os títulos, pelo id, que a tela já leu. */
export interface ReferenciasDaTurma {
  readonly atividades: Readonly<Record<string, string>>
  readonly materiais: Readonly<Record<string, string>>
}

interface Referencia {
  readonly atividadeAplicadaId: string | null
  readonly questao: number | null
  readonly materialId: string | null
  readonly pagina: number | null
}

/** "na questão 3 de «Atividade — Estequiometria»", "na página 142 de «Química 2»", ou nada quando não há referência. */
export function ondeFoi(referencia: Referencia, { atividades, materiais }: ReferenciasDaTurma): string {
  if (referencia.atividadeAplicadaId !== null) {
    const titulo = atividades[referencia.atividadeAplicadaId]
    if (referencia.questao === null) return titulo === undefined ? 'em uma atividade' : `em "${titulo}"`
    return `na questão ${String(referencia.questao)} ${titulo === undefined ? 'de uma atividade' : `de "${titulo}"`}`
  }
  if (referencia.materialId !== null) {
    const material = materiais[referencia.materialId] ?? 'material da escola'
    return referencia.pagina === null ? `em "${material}"` : `na página ${String(referencia.pagina)} de "${material}"`
  }
  return ''
}

const VERBO_DO_GRUPO = {
  travou: ['travou', 'travaram'],
  resposta_pronta: ['pediu a resposta pronta', 'pediram a resposta pronta'],
  duvida_repetida: ['repetiu a mesma dúvida', 'repetiram a mesma dúvida'],
} as const

/** O que o Tutor diz de um grupo de sinais, sem nome de ninguém: "8 alunos travaram na questão 3 de «…»." */
export function falaDoGrupo(grupo: GrupoDeSinais, referencias: ReferenciasDaTurma): string {
  const [singular, plural] = VERBO_DO_GRUPO[grupo.tipo]
  // Os sinais de página de material caem num grupo só, sem atividade: a tela diz que foi no material, e não inventa a página.
  const onde = grupo.atividadeAplicadaId === null ? 'no material da turma' : ondeFoi({ atividadeAplicadaId: grupo.atividadeAplicadaId, questao: grupo.questao, materialId: null, pagina: null }, referencias)
  return `${String(grupo.alunos)} ${grupo.alunos === 1 ? `aluno ${singular}` : `alunos ${plural}`} ${onde}.`
}

/** O sinal de um aluno, para a professora da turma: o que aconteceu no trabalho, e onde. */
export function textoDoSinal(sinal: Exclude<Sinal, { tipo: 'atencao_humana' }>, referencias: ReferenciasDaTurma): string {
  const onde = ondeFoi(sinal, referencias)
  return onde === '' ? NOME_DO_SINAL[sinal.tipo] : `${NOME_DO_SINAL[sinal.tipo]} ${onde}`
}

/**
 * O sinal de atenção humana (D36): **sem o conteúdo, sem referência e sem caminho para conversa nenhuma**. A tela diz só
 * que um aluno precisa de um adulto, e o que a professora faz com isso.
 */
export function tituloDaAtencaoHumana(alunos: number): string {
  return alunos > 1 ? `${String(alunos)} alunos precisam de um adulto` : 'Um aluno precisa de um adulto'
}

export function textoDaAtencaoHumana(alunos: number): string {
  return alunos > 1
    ? 'O Tutor parou a conversa e mostrou a cada um como falar com um adulto. O que foi dito não aparece aqui: procure cada aluno pessoalmente, ou a coordenação.'
    : 'O Tutor parou a conversa e mostrou ao aluno como falar com um adulto. O que foi dito não aparece aqui: procure o aluno pessoalmente, ou a coordenação.'
}

/**
 * A hora do aviso de atenção humana mais recente, como hora ("05/10, 10h40"), e nunca "há X minutos": seria relógio de tempo
 * parado (D69). É o que o aviso de Hoje diz no lugar do nome, que só vem por "Ver quem" (D34, D36).
 */
export function horaDoUltimoAviso(atencao: readonly { readonly criadoEm: string }[]): string | undefined {
  let maisRecente: string | undefined
  for (const sinal of atencao) if (maisRecente === undefined || Date.parse(sinal.criadoEm) > Date.parse(maisRecente)) maisRecente = sinal.criadoEm
  return maisRecente === undefined ? undefined : formatDayAndTime(maisRecente)
}

/** "Aviso mais recente: 05/10, 10h40". */
export function textoDaHoraDoAviso(hora: string): string {
  return `Aviso mais recente: ${hora}`
}

/** Em ordem de nome (`pt-BR`, com os números por valor), a ordem estável: quem tem o mesmo nome fica na ordem em que a API o deu. */
export function porNome<Item>(itens: readonly Item[], nomeDe: (item: Item) => string): Item[] {
  return [...itens].sort((a, b) => nomeDe(a).localeCompare(nomeDe(b), 'pt-BR', { numeric: true }))
}

/** Os sinais separados em dois: os de atenção humana, que vêm primeiro e à parte, e os de trabalho. */
export function separarSinais(sinais: readonly Sinal[]): { readonly atencao: Extract<Sinal, { tipo: 'atencao_humana' }>[]; readonly trabalho: Exclude<Sinal, { tipo: 'atencao_humana' }>[] } {
  const atencao: Extract<Sinal, { tipo: 'atencao_humana' }>[] = []
  const trabalho: Exclude<Sinal, { tipo: 'atencao_humana' }>[] = []
  for (const sinal of sinais) {
    if (sinal.tipo === 'atencao_humana') atencao.push(sinal)
    else trabalho.push(sinal)
  }
  return { atencao, trabalho }
}

/** Em que o aluno estava na última troca com o Tutor: a atividade e a questão, ou o material e a página. */
export function emQueEstava(uso: Pick<UsoDoAluno, 'ultimaReferencia'>, referencias: ReferenciasDaTurma): string {
  const onde = ondeFoi(uso.ultimaReferencia, referencias)
  return onde === '' ? 'Sem atividade nem material' : onde.charAt(0).toLocaleUpperCase('pt-BR') + onde.slice(1)
}

/** Quando o Tutor avisa, para a professora saber o que o sinal quer dizer: os limiares que a API usa. */
export const QUANDO_O_TUTOR_AVISA = [
  'Travou: a quarta troca seguida na mesma questão ou página, no mesmo dia.',
  'Pediu a resposta pronta: o aluno pediu a resposta, e o Tutor não entregou.',
  'Repetiu a mesma dúvida: o aluno voltou a uma questão ou página em que já tinha pedido ajuda.',
] as const

/** "12 de 60": as trocas de hoje do aluno, contra o limite do dia da escola. */
export function trocasDeHoje(uso: Pick<UsoDoAluno, 'trocasHoje'>, limiteDoDia: number): string {
  return `${String(uso.trocasHoje)} de ${String(limiteDoDia)}`
}
