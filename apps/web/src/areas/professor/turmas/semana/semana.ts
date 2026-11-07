import { rotuloDoItem, type AulaDaSemana, type DiaDaSemana, type ItemDoDia, type SemanaResponse, type VinculoResponse } from '@educa/shared'
import { caminhoDaCorrecaoDoProfessor, caminhoDaTurmaDoProfessor, PROFESSOR_ROUTES } from '../../../../paths'

/**
 * As contas da Semana da professora que não precisam de tela (Tech Spec de semana-do-professor, seção 9): o endereço, as datas,
 * os textos e o vazio de cada caso. Só valor de lista fechada e data vão ao endereço, nunca texto da aula nem nome de aluno
 * (regra 50, item 7; regra 20, item 9). Toda data é `AAAA-MM-DD` e a aritmética é de calendário, sem fuso: quem diz o que é "hoje"
 * é a API, no fuso da escola; o navegador só chuta a semana do primeiro pedido.
 */

/** O fuso da escola, o mesmo de `FUSO_DO_USO` na API: só para o primeiro pedido, antes de a resposta trazer o `hoje` dela. */
const FUSO_DA_ESCOLA = 'America/Sao_Paulo'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const NOMES_DOS_DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const
const NOMES_CURTOS_DOS_DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const
const NOMES_DOS_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'] as const

/** `AAAA-MM-DD` que existe no calendário (`2026-02-30` não). */
export function ehDataValida(texto: string | null): texto is string {
  if (texto === null || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false
  const data = new Date(`${texto}T00:00:00Z`)
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === texto
}

/** Hoje no fuso da escola, `AAAA-MM-DD`: para o primeiro pedido da Semana, antes de a resposta dizer o `hoje` certo. */
export function hojeNoFusoDaEscola(agora: Date): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_DA_ESCOLA, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(agora)
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? ''
  return `${parte('year')}-${parte('month')}-${parte('day')}`
}

export function somarDias(data: string, dias: number): string {
  const resultado = new Date(`${data}T00:00:00Z`)
  resultado.setUTCDate(resultado.getUTCDate() + dias)
  return resultado.toISOString().slice(0, 10)
}

/** A segunda-feira da semana da data (a semana vai de segunda a domingo). */
export function segundaDe(data: string): string {
  const diaDaSemana = new Date(`${data}T00:00:00Z`).getUTCDay()
  return somarDias(data, diaDaSemana === 0 ? -6 : 1 - diaDaSemana)
}

/** "Terça". */
export function nomeDoDia(data: string): string {
  return NOMES_DOS_DIAS[new Date(`${data}T00:00:00Z`).getUTCDay()] ?? ''
}

/** "Ter". */
export function nomeCurtoDoDia(data: string): string {
  return NOMES_CURTOS_DOS_DIAS[new Date(`${data}T00:00:00Z`).getUTCDay()] ?? ''
}

/** O dia do mês, sem zero à esquerda: "9". */
export function diaDoMes(data: string): string {
  return String(Number(data.slice(8, 10)))
}

function mesDe(data: string): string {
  return NOMES_DOS_MESES[Number(data.slice(5, 7)) - 1] ?? ''
}

/** "10 de novembro". */
export function diaEMes(data: string): string {
  return `${diaDoMes(data)} de ${mesDe(data)}`
}

/** "Terça, 10 de novembro": o nome acessível do dia. */
export function nomeCompletoDoDia(data: string): string {
  return `${nomeDoDia(data)}, ${diaEMes(data)}`
}

/** O título da semana, de segunda a domingo: "9 a 15 de novembro", ou "30 de novembro a 6 de dezembro" quando atravessa o mês. */
export function tituloDaSemana(segunda: string): string {
  const domingo = somarDias(segunda, 6)
  return mesDe(segunda) === mesDe(domingo) ? `${diaDoMes(segunda)} a ${diaEMes(domingo)}` : `${diaEMes(segunda)} a ${diaEMes(domingo)}`
}

/** `07:30` → "7h30"; hora cheia, `08:00` → "8h". */
export function horaDaAula(hora: string): string {
  const [h = '', m = ''] = hora.split(':')
  return m === '00' ? `${String(Number(h))}h` : `${String(Number(h))}h${m}`
}

/** O horário da aula para quem vê: "7h30 às 8h20". */
export function horarioDaAula(aula: Pick<AulaDaSemana, 'inicio' | 'fim'>): string {
  return `${horaDaAula(aula.inicio)} às ${horaDaAula(aula.fim)}`
}

/** O nome acessível do cartão: "Terça, 7h30, 7ºA, Matemática" (a Tech Spec, seção 9). */
export function nomeDaAula(data: string, aula: Pick<AulaDaSemana, 'inicio' | 'turma' | 'disciplina'>): string {
  return `${nomeDoDia(data)}, ${horaDaAula(aula.inicio)}, ${aula.turma}, ${aula.disciplina}`
}

/**
 * "Falta preencher" (RF6, D59): a aula de hoje ou futura sem texto. A passada sem texto não leva selo nenhum, e a fora da
 * grade só existe passada. É selo **por aula**: nenhuma conta soma quantas faltam (D64, regra 70, item 9).
 */
export function faltaPreencher(data: string, hoje: string, aula: Pick<AulaDaSemana, 'texto'>): boolean {
  return data >= hoje && aula.texto === null
}

/** O rótulo do texto da aula: "O que vou dar" até o dia da aula, "O que foi dado" depois (RF5). */
export function rotuloDoTexto(data: string, hoje: string): string {
  return data >= hoje ? 'O que vou dar' : 'O que foi dado'
}

/** A aula de hoje cujo horário contém o `agora` do fuso da escola: marcada "Agora" em texto (RF2). */
export function emAndamento(data: string, hoje: string, agora: string, aula: Pick<AulaDaSemana, 'inicio' | 'fim'>): boolean {
  return data === hoje && aula.inicio <= agora && agora < aula.fim
}

const ROTULO_DO_EVENTO = { feriado: 'Feriado', recesso: 'Recesso', evento: 'Evento' } as const

/** "Feriado", "Recesso" ou "Evento": o tipo que o dia mostra junto da descrição (RF3). */
export function rotuloDoEvento(tipo: keyof typeof ROTULO_DO_EVENTO): string {
  return ROTULO_DO_EVENTO[tipo]
}

/* ───────────────────────────── o endereço ───────────────────────────── */

/** A turma e a disciplina do filtro: `?turma=<turmaId>.<disciplinaId>`. */
export interface FiltroDaSemana {
  readonly turmaId: string
  readonly disciplinaId: string
}

/** A semana do endereço (`?semana=`), como segunda-feira. Sem o parâmetro, ou com texto que não é data, não há semana pedida. */
export function semanaDoEndereco(busca: string): string | undefined {
  const pedida = new URLSearchParams(busca).get('semana')
  return ehDataValida(pedida) ? segundaDe(pedida) : undefined
}

/** O filtro do endereço. Com o formato errado, é como se não houvesse filtro. */
export function filtroDoEndereco(busca: string): FiltroDaSemana | undefined {
  const [turmaId, disciplinaId, resto] = (new URLSearchParams(busca).get('turma') ?? '').split('.')
  if (resto !== undefined || turmaId === undefined || disciplinaId === undefined || !UUID.test(turmaId) || !UUID.test(disciplinaId)) return undefined
  return { turmaId, disciplinaId }
}

export function valorDoFiltro(filtro: FiltroDaSemana | undefined): string {
  return filtro === undefined ? '' : `${filtro.turmaId}.${filtro.disciplinaId}`
}

/**
 * O endereço da Semana com a mudança pedida, mantendo o resto do que já está nele. `undefined` tira o parâmetro. O `?aula=` sai
 * junto de qualquer troca de semana ou de filtro: a aula aberta é de uma semana só.
 */
export function enderecoDaSemana(caminho: string, busca: string, mudanca: { readonly semana?: string | undefined; readonly turma?: string | undefined }): string {
  const parametros = new URLSearchParams(busca)
  parametros.set('ver', 'semana')
  for (const chave of ['semana', 'turma'] as const) {
    if (!(chave in mudanca)) continue
    const valor = mudanca[chave]
    if (valor === undefined || valor === '') parametros.delete(chave)
    else parametros.set(chave, valor)
  }
  parametros.delete('aula')
  return `${caminho}?${parametros.toString()}`
}

/** O endereço da aula aberta: `?aula=<vinculoId>.<data>.<HHMM>`, só ids, data e hora (o painel é da tarefa 7.0). */
export function enderecoDaAula(caminho: string, busca: string, aula: Pick<AulaDaSemana, 'vinculoId' | 'inicio'>, data: string): string {
  const parametros = new URLSearchParams(busca)
  parametros.set('ver', 'semana')
  parametros.set('aula', chaveDaAula(aula.vinculoId, data, aula.inicio))
  return `${caminho}?${parametros.toString()}`
}

/** A aula do `?aula=`: o vínculo, a data e o início (`HH:MM`). Só ids e hora, nunca texto (regra 20, item 9). */
export interface AulaDoEndereco {
  readonly vinculoId: string
  readonly data: string
  readonly inicio: string
}

/** O `?aula=<vinculoId>.<data>.<HHMM>`, ou `undefined` para o que não tem essa forma (e para a hora que não existe: `2561`). */
export function aulaDoEndereco(busca: string): AulaDoEndereco | undefined {
  const partes = (new URLSearchParams(busca).get('aula') ?? '').split('.')
  const [vinculoId, data, hora] = partes
  if (partes.length !== 3 || vinculoId === undefined || data === undefined || hora === undefined) return undefined
  if (!UUID.test(vinculoId) || !ehDataValida(data) || !/^([01]\d|2[0-3])[0-5]\d$/.test(hora)) return undefined
  return { vinculoId, data, inicio: `${hora.slice(0, 2)}:${hora.slice(2)}` }
}

/** O endereço sem o `?aula=`: fechar o painel. O resto (semana, filtro) fica como estava. */
export function enderecoSemAula(caminho: string, busca: string): string {
  const parametros = new URLSearchParams(busca)
  parametros.delete('aula')
  return `${caminho}?${parametros.toString()}`
}

/** A identidade de uma aula na tela: a mesma que o `?aula=` leva. Marca o cartão (`data-aula`), para o foco voltar a ele ao fechar o painel. */
export function chaveDaAula(vinculoId: string, data: string, inicio: string): string {
  return `${vinculoId}.${data}.${inicio.replace(':', '')}`
}

/**
 * A aula que o `?aula=` pede, entre as da semana lida. O que não está lá (de outra professora, de outra escola, de outra semana ou que
 * nunca existiu) não abre painel e não diz nada: a tela não confirma que a aula existe (regra 10, item 6).
 */
export function acharAula(dias: readonly DiaDaSemana[], pedida: AulaDoEndereco): AulaDaSemana | undefined {
  return dias.find((dia) => dia.data === pedida.data)?.aulas.find((aula) => aula.vinculoId === pedida.vinculoId && aula.inicio === pedida.inicio)
}

/** O que a API devolveu ao gravar o texto de uma aula (`PUT /v1/aulas`). `texto: null` é o registro apagado. */
export interface TextoGravado {
  readonly vinculoId: string
  readonly data: string
  readonly inicio: string
  readonly texto: string | null
}

/**
 * A semana lida com o texto gravado já nela: o cartão mostra o que a professora salvou sem uma leitura nova. Só a aula da gravação muda; a aula
 * que saiu da grade e ficou sem texto deixa de existir (o servidor apagou o registro, e era só ele que a mantinha).
 *
 * **A premissa de isolamento (regra 10, itens 3 e 7):** a resposta atrasada de uma gravação da escola A só não entra na semana da escola B porque o
 * `vinculoId` é um UUID e não se repete entre escolas. A data e o horário sozinhos não identificam a aula. Se o id um dia deixar de ser único por
 * escola, esta função passa a precisar da escola na comparação.
 */
export function comTextoGravado(resposta: SemanaResponse, gravado: TextoGravado): SemanaResponse {
  const dias = resposta.dias.map((dia) => {
    if (dia.data !== gravado.data) return dia
    const aulas = dia.aulas.flatMap((aula) => {
      if (aula.vinculoId !== gravado.vinculoId || aula.inicio !== gravado.inicio) return [aula]
      return gravado.texto === null && aula.foraDaGrade ? [] : [{ ...aula, texto: gravado.texto }]
    })
    return { ...dia, aulas }
  })
  return { ...resposta, dias }
}

/** O que o painel diz quando a gravação falha (RF5), e quando a aula saiu da grade no meio. O texto escrito fica no campo nos dois casos. */
export const FRASE_DA_FALHA_AO_SALVAR = 'Não foi possível salvar. Tente de novo em instantes.'
export const FRASE_DA_AULA_QUE_SAIU = 'Esta aula saiu da grade e o texto não foi salvo. Copie o que você escreveu, se quiser guardar.'

/** A dica do campo do painel: o aviso de não escrever nome de aluno (regra 20, item 3) e o que o "Fechar" faz com o que não foi salvo. */
export const DICA_DO_TEXTO_DA_AULA = 'Não escreva o nome de nenhum aluno. Fechar sem salvar descarta o que você escreveu.'

/* ───────────────────────────── o ano ───────────────────────────── */

type Ano = NonNullable<SemanaResponse['ano']>

/** A semana (segunda a domingo) tem algum dia dentro do ano letivo? */
export function semanaToca(segunda: string, ano: Ano): boolean {
  return somarDias(segunda, 6) >= ano.inicio && segunda <= ano.fim
}

/** A navegação é presa ao ano: não há "anterior" na semana que contém o começo dele (RF2). */
export function haSemanaAnterior(segunda: string, ano: Ano): boolean {
  return segundaDe(ano.inicio) < segunda
}

/** E não há "seguinte" na semana que contém o fim dele. */
export function haSemanaSeguinte(segunda: string, ano: Ano): boolean {
  return somarDias(segunda, 7) <= ano.fim
}

/**
 * A semana pedida no endereço não toca o ano em curso, e não é a de hoje: abre a de hoje (RF2). Sem `?semana=`, a de hoje já é a pedida, e não há
 * para onde ir; com o ano ainda não lido, não se sabe, e a tela espera a resposta.
 */
export function deveAbrirAdeHoje(pedida: string | undefined, segunda: string, resposta: SemanaResponse | undefined): boolean {
  if (pedida === undefined || resposta === undefined || resposta.ano === null) return false
  return !semanaToca(segunda, resposta.ano) && segundaDe(resposta.hoje) !== segunda
}

/** A grade está importada e o calendário não: as aulas aparecem, com o aviso de que feriado e recesso não entram (RF12). */
export function faltaOCalendario(resposta: SemanaResponse | undefined): boolean {
  return resposta !== undefined && resposta.ano !== null && resposta.gradeImportada && !resposta.calendarioImportado
}

/* ───────────────────────────── o que a tela mostra ───────────────────────────── */

/** Os dias da resposta só com as aulas e os itens do filtro (a mesma turma e a mesma disciplina); sem filtro, como vieram. */
export function diasFiltrados(dias: readonly DiaDaSemana[], filtro: FiltroDaSemana | undefined): readonly DiaDaSemana[] {
  if (filtro === undefined) return dias
  const doFiltro = (alvo: { readonly turmaId: string; readonly disciplinaId: string }) => alvo.turmaId === filtro.turmaId && alvo.disciplinaId === filtro.disciplinaId
  return dias.map((dia) => ({ ...dia, aulas: dia.aulas.filter(doFiltro), itens: dia.itens.filter(doFiltro) }))
}

/**
 * Uma turma e disciplina de vínculo **confirmado**, que é o que dá aula (RF4): o valor do filtro da Semana (`<turmaId>.<disciplinaId>`) e o
 * rótulo "7ºA · Matemática". É a fonte única das opções do filtro e dos links "Ver a semana desta turma" de Hoje.
 */
export interface TurmaEDisciplina {
  readonly valor: string
  readonly turmaId: string
  readonly disciplina: string
  readonly rotulo: string
}

/** Os vínculos confirmados e com disciplina, na ordem em que vieram. Pendente, contestado e sem disciplina não dão aula e ficam de fora. */
export function turmasEDisciplinasDosVinculos(vinculos: readonly VinculoResponse[]): readonly TurmaEDisciplina[] {
  return vinculos.flatMap((vinculo) =>
    vinculo.estado === 'confirmado' && vinculo.disciplina !== undefined
      ? [{ valor: `${vinculo.turma.id}.${vinculo.disciplina.id}`, turmaId: vinculo.turma.id, disciplina: vinculo.disciplina.nome, rotulo: `${vinculo.turma.nome} · ${vinculo.disciplina.nome}` }]
      : [],
  )
}

/** O endereço da Semana filtrada por uma turma e disciplina, **relativo à área**: o "Ver a semana desta turma" de Hoje. A semana é a de hoje. */
export function enderecoDaSemanaDaTurma(valorDoFiltro: string): string {
  return enderecoDaSemana(PROFESSOR_ROUTES.turmas, '', { turma: valorDoFiltro })
}

/**
 * O nome acessível do item: o rótulo da tabela de `packages/shared` e o título, "Atividade aplicada: <título>". A correção do Assistente diz também que é
 * gerada por IA, como o selo "IA" que ela leva (regra 70, item 4a): o `aria-label` do link substitui o conteúdo dele, e o leitor de tela não ouviria o selo.
 */
export function nomeDoItem(item: Pick<ItemDoDia, 'tipo' | 'estado' | 'titulo'>): string {
  return `${rotuloDoItem(item)}${item.tipo === 'correcao' ? ', gerado por inteligência artificial' : ''}: ${item.titulo}`
}

/**
 * Onde cada item do dia leva (RF7): a atividade aplicada e a encerrada, ao painel da atividade na turma dela (`?aba=atividades&atividade=<id>`);
 * a correção, à revisão (o endereço do "Revisar" do sino). Só ids no endereço, nunca título nem nome (regra 20, item 9).
 */
export function enderecoDoItem(item: Pick<ItemDoDia, 'tipo' | 'turmaId' | 'atividadeAplicadaId'>): string {
  if (item.tipo === 'correcao') return caminhoDaCorrecaoDoProfessor(item.atividadeAplicadaId)
  return `${caminhoDaTurmaDoProfessor(item.turmaId)}?${new URLSearchParams({ aba: 'atividades', atividade: item.atividadeAplicadaId }).toString()}`
}

export interface VazioDaSemana {
  readonly titulo: string
  readonly descricao: string
}

/** A semana inteira em recesso (de segunda a sexta): o vazio com a descrição do recesso. */
function vazioDeRecesso(dias: readonly DiaDaSemana[]): VazioDaSemana | undefined {
  const diasDeAula = dias.filter((dia) => ![0, 6].includes(new Date(`${dia.data}T00:00:00Z`).getUTCDay()))
  if (diasDeAula.length === 0 || !diasDeAula.every((dia) => dia.eventos.some((evento) => evento.tipo === 'recesso'))) return undefined
  const descricao = diasDeAula[0]?.eventos.find((evento) => evento.tipo === 'recesso')?.descricao ?? ''
  return { titulo: 'Semana de recesso', descricao: descricao === '' ? 'A escola está em recesso nesta semana.' : `${descricao}: a escola está em recesso nesta semana.` }
}

/** A semana que não tem nenhum dia dentro do ano: antes de ele começar, ou depois. */
function vazioForaDoAno(ano: Ano, hoje: string): VazioDaSemana {
  return hoje < ano.inicio
    ? { titulo: 'O ano letivo ainda não começou', descricao: `As aulas aparecem aqui a partir de ${diaEMes(ano.inicio)}.` }
    : { titulo: 'Sem aulas nesta semana', descricao: 'Esta semana está fora do ano letivo em curso.' }
}

/**
 * O vazio que diz por quê (RF12). Vem do mais amplo ao mais estreito: sem ano em curso, sem grade importada, semana fora do ano,
 * semana inteira de recesso e semana sem aula nem evento. `dias` já traz o filtro. Semana com feriado ou evento, mas sem aula, não é vazio:
 * a tela mostra os dias com o que cai neles.
 */
export function vazioDaSemana(resposta: SemanaResponse, dias: readonly DiaDaSemana[]): VazioDaSemana | undefined {
  if (resposta.ano === null) return { titulo: 'O ano letivo ainda não começou', descricao: 'Quando a coordenação abrir o ano letivo, as suas aulas aparecem aqui, semana a semana.' }
  if (!resposta.gradeImportada) {
    return { titulo: 'A coordenação ainda não importou a grade', descricao: 'A grade de horários é da coordenação. Quando ela importar, as suas aulas aparecem aqui sozinhas; você não precisa cadastrar nada.' }
  }
  if (dias.length === 0) return vazioForaDoAno(resposta.ano, resposta.hoje)
  const recesso = vazioDeRecesso(dias)
  if (recesso !== undefined) return recesso
  if (dias.some((dia) => dia.aulas.length > 0 || dia.eventos.length > 0 || dia.itens.length > 0)) return undefined
  return { titulo: 'Sem aulas nesta semana', descricao: 'Nenhuma aula sua cai nesta semana. Use "Semana anterior" ou "Semana seguinte" para ver as outras.' }
}

/**
 * O que o leitor de tela ouve do cartão depois do nome: o horário inteiro, a sala, se está no ar, se saiu da grade e o texto (ou o que falta).
 * O nome ("Terça, 7h30, 7ºA, Matemática") é o `nomeDaAula`; o resto é descrição.
 */
export function descricaoDaAula(data: string, hoje: string, andamento: boolean, aula: AulaDaSemana): string {
  const texto = aula.texto === null ? (faltaPreencher(data, hoje, aula) ? 'Falta preencher' : undefined) : `${rotuloDoTexto(data, hoje)}: ${aula.texto}`
  return [horarioDaAula(aula), aula.sala === null ? undefined : `Sala ${aula.sala}`, andamento ? 'Em andamento' : undefined, aula.foraDaGrade ? 'Fora da grade' : undefined, texto]
    .filter((parte) => parte !== undefined)
    .join('. ')
}

/* ───────────────────────────── as abas de Turmas ───────────────────────────── */

/**
 * O que Turmas guarda no endereço (F2b, RF1): a aba em `?ver=` — Turmas, a lista de sempre, ou Semana, `?ver=semana`. Sem o parâmetro,
 * ou com valor que não é de nenhuma aba, abre em Turmas. Trocar de aba usa `replace`, e leva **só** o `ver`: o que a Semana põe por cima
 * (`semana`, `turma`, `aula`) não acompanha a pessoa à lista, nem o endereço antigo reabre o que ela já fechou.
 */

export const ABAS_DE_TURMAS = [
  { id: 'turmas', rotulo: 'Turmas' },
  { id: 'semana', rotulo: 'Semana' },
] as const

export type AbaDeTurmas = (typeof ABAS_DE_TURMAS)[number]['id']

/** A aba do endereço: `?ver=semana` abre a Semana, e qualquer outra coisa, Turmas. */
export function abaDeTurmasDoEndereco(busca: string): AbaDeTurmas {
  return new URLSearchParams(busca).get('ver') === 'semana' ? 'semana' : 'turmas'
}

/** O endereço de uma aba. Turmas é o caminho sem nada; a Semana leva `?ver=semana`. */
export function enderecoDaAbaDeTurmas(caminho: string, id: string): string {
  return id === 'semana' ? `${caminho}?ver=semana` : caminho
}
