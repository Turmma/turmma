import { NOME_DO_MOTIVO_DE_DESTAQUE, type AtividadeAplicada, type Destaque, type MotivoDeDestaque, type CorrecaoDoLoteResponse, type ResumoDoLote } from '@educa/shared'
import { caminhoDaTurmaDoProfessor, ROTAS_DO_PROFESSOR } from '../../../paths'
import type { LinhaDoResumo } from '../../../components/ui/overlays/ConfirmDialog'
import { formatarDiaEHora } from '../../../format'

/**
 * O que a tela de aprovar a correção diz (`docs/interface.md` 11.5; D33, D46, D56). **É diagnóstico, não nota**: tudo
 * aqui fala em acertos, questões e habilidades. Nenhum texto desta tela usa "nota", "conceito" nem "pontuação", e o
 * teste confere.
 */

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

/**
 * Para onde "Voltar para a turma" leva, **relativo à área**: a turma da correção, quando a entrega inteira já a trouxe, e a
 * lista de turmas enquanto ela não chegou ou a leitura falhou. A correção em si não diz a turma.
 */
export function caminhoDeVoltaDaCorrecao(turmaId: string | undefined): string {
  return turmaId === undefined ? ROTAS_DO_PROFESSOR.turmas : caminhoDaTurmaDoProfessor(turmaId)
}

/** "3,4 de 5 questões": a média de acertos da turma, em questões. */
export function textoDaMedia(resumo: Pick<ResumoDoLote, 'mediaDeAcertos' | 'questoes'>): string {
  return `${numero.format(resumo.mediaDeAcertos)} de ${String(resumo.questoes)} ${resumo.questoes === 1 ? 'questão' : 'questões'}`
}

/**
 * Quem respondeu, e a turma de hoje à parte. Não é "N de M": `corrigidos` conta o trabalho feito, inclusive de quem saiu
 * da turma antes de a professora encerrar, e `alunosDaTurma` é a turma de agora. Juntos como fração, depois de uma
 * transferência a tela diria "5 de 4 alunos" (docblock de `resumoDoLote`, na API).
 */
export function textoDosCorrigidos(resumo: Pick<ResumoDoLote, 'corrigidos' | 'alunosDaTurma'>): string {
  const responderam = `${String(resumo.corrigidos)} ${resumo.corrigidos === 1 ? 'aluno respondeu' : 'alunos responderam'}`
  return `${responderam} · ${String(resumo.alunosDaTurma)} na turma hoje`
}

/** A faixa da distribuição: "0 a 1 acerto", "2 acertos", "4 a 5 acertos". */
export function rotuloDaFaixa(faixa: { readonly de: number; readonly ate: number }): string {
  if (faixa.de === faixa.ate) return `${String(faixa.de)} ${faixa.de === 1 ? 'acerto' : 'acertos'}`
  return `${String(faixa.de)} a ${String(faixa.ate)} acertos`
}

export function textoDeAlunos(quantos: number): string {
  return `${String(quantos)} ${quantos === 1 ? 'aluno' : 'alunos'}`
}

/**
 * O que cada motivo de destaque quer dizer, **como fato do trabalho, nunca como juízo sobre o aluno** (D57): o que se vê
 * nas respostas, e não o que isso diria da pessoa.
 */
export const EXPLICACAO_DO_MOTIVO: Readonly<Record<MotivoDeDestaque, string>> = {
  em_branco: 'Nenhuma questão foi respondida.',
  fora_do_historico: 'Os acertos ficaram bem acima ou bem abaixo dos que ele teve nas correções aprovadas desta disciplina.',
  padrao_de_erro: 'A mesma alternativa em todas as questões, ou erro em questões que quase toda a turma acertou.',
}

/** Por que a correção do aluno foi destacada, em texto: "Em branco · Padrão de erro para conferir". */
export function motivosDoDestaque(destaque: Pick<Destaque, 'motivos'>): string {
  return destaque.motivos.map((motivo) => NOME_DO_MOTIVO_DE_DESTAQUE[motivo]).join(' · ')
}

/** A explicação de cada motivo do destaque, uma frase por motivo. */
export function explicacoesDoDestaque(destaque: Pick<Destaque, 'motivos'>): string {
  return destaque.motivos.map((motivo) => EXPLICACAO_DO_MOTIVO[motivo]).join(' ')
}

/** "2 de 5 acertos", e quantas ficaram em branco quando ficou alguma. */
export function acertosDoAluno(correcao: { readonly acertos: number; readonly total: number; readonly emBranco: number }): string {
  const acertos = `${String(correcao.acertos)} de ${String(correcao.total)} ${correcao.total === 1 ? 'acerto' : 'acertos'}`
  return correcao.emBranco === 0 ? acertos : `${acertos} · ${String(correcao.emBranco)} em branco`
}

/** O estado do destaque: fechado, falta abrir; aberto, a hora em que foi aberto (é o que o registro da validação guarda). */
export function estadoDoDestaque(destaque: Pick<Destaque, 'abertoEm'>, opcoes: { fuso?: string; agora?: Date } = {}): { readonly aberto: boolean; readonly texto: string } {
  if (destaque.abertoEm === null) return { aberto: false, texto: 'Falta abrir' }
  return { aberto: true, texto: `Aberto · ${formatarDiaEHora(destaque.abertoEm, opcoes)}` }
}

export interface ContadorDosDestaques {
  /** "3 de 5 destaques abertos". */
  readonly texto: string
  /** Por que o botão de aprovar está desligado, ou `undefined` quando ele está ligado. */
  readonly porQue: string | undefined
}

/**
 * O contador ao lado do botão de aprovar, que **diz por que ele está desligado** (D33; regra 50, item 8): faltam destaques
 * para abrir. Quem libera o botão é a API (`podeAprovar`), e não a conta da tela: se as duas discordarem, vale a API, e o
 * texto manda atualizar.
 */
export function contadorDosDestaques(correcao: Pick<CorrecaoDoLoteResponse, 'destaques' | 'destaquesAbertos' | 'podeAprovar'>): ContadorDosDestaques {
  const total = correcao.destaques.length
  const faltam = total - correcao.destaquesAbertos
  const texto = total === 0 ? 'Nenhuma correção destacada neste lote' : `${String(correcao.destaquesAbertos)} de ${String(total)} ${total === 1 ? 'destaque aberto' : 'destaques abertos'}`
  if (correcao.podeAprovar) return { texto, porQue: undefined }
  if (faltam > 0) return { texto, porQue: faltam === 1 ? 'Abra o destaque que falta para liberar a aprovação.' : `Abra os ${String(faltam)} destaques que faltam para liberar a aprovação.` }
  return { texto, porQue: 'A aprovação ainda não foi liberada. Atualize a tela.' }
}

/** O nome do botão que recusa o lote. Está na barra presa, com o mesmo tamanho do que aprova (D59), e o diálogo se chama igual. */
export const ROTULO_DE_REJEITAR_O_LOTE = 'Rejeitar a correção'

/** "Aprovar 28 correções": o botão diz o que acontece, com a quantidade. */
export function rotuloDeAprovar(corrigidos: number): string {
  return corrigidos === 1 ? 'Aprovar 1 correção' : `Aprovar ${String(corrigidos)} correções`
}

/** O que o diálogo de aprovar mostra antes de confirmar: a atividade, a turma, quantas correções e os destaques abertos. */
export function resumoDoLote(correcao: Pick<CorrecaoDoLoteResponse, 'titulo' | 'resumo' | 'destaques' | 'destaquesAbertos'>, nomeDaTurma: string | undefined): readonly [LinhaDoResumo, ...LinhaDoResumo[]] {
  return [
    { rotulo: 'Atividade', valor: correcao.titulo },
    { rotulo: 'Turma', valor: nomeDaTurma ?? 'Turma da atividade' },
    { rotulo: 'Correções', valor: textoDosCorrigidos(correcao.resumo) },
    { rotulo: 'Destaques abertos', valor: `${String(correcao.destaquesAbertos)} de ${String(correcao.destaques.length)}` },
  ]
}

export const EFEITO_DE_APROVAR_O_LOTE =
  'O diagnóstico por habilidade chega aos alunos da turma. Fica registrado o que a tela mostrou, os destaques que você abriu e que você confirmou, com a data e a hora.'
export const EFEITO_DE_REJEITAR_O_LOTE = 'Nenhum aluno recebe o diagnóstico desta correção. Fica registrado que você rejeitou, com a data, a hora e o motivo.'
export const AVISO_DA_REJEICAO_DO_LOTE = 'Diga o que está errado na correção (o gabarito de uma questão, por exemplo). Não escreva nome de aluno.'

/** A letra da alternativa, pelo índice do contrato (0 a 3). Em branco, o travessão. */
export function letraDaAlternativa(alternativa: number | null): string {
  if (alternativa === null) return '—'
  return ['a', 'b', 'c', 'd'][alternativa] ?? String(alternativa + 1)
}

/**
 * A atividade aplicada, numa linha: se está aberta ou encerrada, se é avaliativa, e quantos já enviaram. Sem nome de
 * aluno e sem lista de quem não entregou: só a contagem.
 */
export function situacaoDaAplicacao(aplicada: Pick<AtividadeAplicada, 'estado' | 'avaliativa' | 'participacao'>): string {
  const partes = [aplicada.estado === 'aberta' ? 'Aberta para a turma' : 'Encerrada', aplicada.avaliativa ? 'avaliativa' : 'prática', `${String(aplicada.participacao.enviaram)} de ${textoDeAlunos(aplicada.participacao.alunos)} ${aplicada.participacao.enviaram === 1 ? 'enviou' : 'enviaram'}`]
  return partes.join(' · ')
}

/** O que a professora escolhe ao aplicar, e o que cada escolha faz com o Tutor (D36, regra 70, item 4c). */
export const ESCOLHA_DE_AVALIATIVA = [
  { valor: 'pratica', avaliativa: false, rotulo: 'É prática', descricao: 'O Tutor continua disponível para a turma, conduzindo por perguntas.' },
  { valor: 'avaliativa', avaliativa: true, rotulo: 'É avaliativa', descricao: 'O Tutor fica pausado para a turma até você encerrar a atividade.' },
] as const

/** A atividade avaliativa que está aberta: o Tutor da turma fica pausado até a professora encerrar (regra 70, item 4c). */
export const AVISO_DA_AVALIATIVA_ABERTA = 'É avaliativa: o Tutor está pausado para a turma até você encerrar.'

/**
 * A atividade encerrada que não tem correção para revisar, e por quê. A API encerra sem corrigir em dois casos: ninguém
 * abriu a atividade, ou a escola suspendeu a correção de objetiva. Com um lote rejeitado, encerrar de novo corrige de novo.
 */
export type SemCorrecao = 'ninguem_respondeu' | 'correcao_suspensa' | 'lote_rejeitado'

export function semCorrecao(aplicada: Pick<AtividadeAplicada, 'estado' | 'entrega' | 'participacao'>): SemCorrecao | undefined {
  if (aplicada.estado !== 'encerrada') return undefined
  if (aplicada.entrega === null) return aplicada.participacao.iniciaram === 0 ? 'ninguem_respondeu' : 'correcao_suspensa'
  return aplicada.entrega.estado === 'rejeitada' ? 'lote_rejeitado' : undefined
}

export const TEXTO_SEM_CORRECAO: Readonly<Record<SemCorrecao, string>> = {
  ninguem_respondeu: 'Nenhum aluno abriu a atividade: não há o que corrigir.',
  correcao_suspensa: 'A atividade encerrou sem corrigir: a coordenação suspendeu a correção de objetiva nesta escola. Quando a função voltar, peça a correção de novo.',
  lote_rejeitado: 'Você rejeitou a correção desta atividade. Peça a correção de novo quando o que estava errado for resolvido.',
}

export const EFEITO_DE_APLICAR = 'Os alunos da turma passam a ver a atividade e podem responder. Fica registrado que você aplicou, com a data e a hora.'
export const EFEITO_DE_ENCERRAR =
  'As respostas param agora: quem não enviou fica com o que respondeu até aqui. O Assistente corrige as objetivas, e a correção fica esperando você revisar e aprovar. Os alunos só veem o resultado depois disso.'

/** O nome do grupo de abas, para o leitor de tela. */
export const ROTULO_DAS_ABAS_DA_CORRECAO = 'Seções da correção'

/** As três abas, na ordem em que aparecem. A primeira é a que o endereço sem `?aba=` abre. */
export const ABAS_DA_CORRECAO = [
  { id: 'destaques', rotulo: 'Destaques' },
  { id: 'outras', rotulo: 'Outras' },
  { id: 'resumo', rotulo: 'Resumo' },
] as const
export type AbaDaCorrecao = (typeof ABAS_DA_CORRECAO)[number]['id']

/** Os dois parâmetros do endereço: a aba aberta e o destaque aberto ao lado. Só id e valor de lista fechada, nunca nome (regra 20, item 9). */
export const PARAMETRO_DA_ABA = 'aba'
export const PARAMETRO_DO_DESTAQUE = 'ver'

/** A aba do endereço (`?aba=`). Valor que não é de nenhuma aba cai em Destaques, sem erro. */
export function abaDoEndereco(busca: string): AbaDaCorrecao {
  const valor = new URLSearchParams(busca).get(PARAMETRO_DA_ABA)
  return ABAS_DA_CORRECAO.find((aba) => aba.id === valor)?.id ?? 'destaques'
}

/**
 * O destaque que o endereço pede para ver ao lado (`?ver=<alunoId>`): só um destaque **deste lote** e **já aberto**. O id que o
 * lote não tem não abre nada (regra 10, item 6), e o destaque ainda fechado também não: abrir é o clique, e é ele que fica
 * registrado (D56). Recarregar a página com `?ver=` de um destaque fechado, ou colar o endereço de outra pessoa, não registra
 * abertura nenhuma. `abertosAgora` são os que a tela acabou de abrir e que a leitura do lote ainda não trouxe.
 */
export function destaqueDoEndereco<D extends Pick<Destaque, 'alunoId' | 'abertoEm'>>(busca: string, destaques: readonly D[], abertosAgora: ReadonlySet<string>): D | undefined {
  const alunoId = new URLSearchParams(busca).get(PARAMETRO_DO_DESTAQUE)
  const destaque = destaques.find((candidato) => candidato.alunoId === alunoId)
  if (destaque === undefined) return undefined
  return destaque.abertoEm !== null || abertosAgora.has(destaque.alunoId) ? destaque : undefined
}

/**
 * O endereço da tela com a aba posta e o destaque posto ou tirado, sem mexer no resto. `ver: null` tira o parâmetro; sem a
 * chave, ele fica como estava (trocar de aba não fecha nada que esteja aberto, e fechar o painel não troca a aba).
 */
export function enderecoDaCorrecao(caminho: string, busca: string, mudanca: { readonly aba?: AbaDaCorrecao; readonly ver?: string | null }): string {
  const parametros = new URLSearchParams(busca)
  if (mudanca.aba !== undefined) parametros.set(PARAMETRO_DA_ABA, mudanca.aba)
  if (mudanca.ver === null) parametros.delete(PARAMETRO_DO_DESTAQUE)
  else if (mudanca.ver !== undefined) parametros.set(PARAMETRO_DO_DESTAQUE, mudanca.ver)
  const resto = parametros.toString()
  return resto === '' ? caminho : `${caminho}?${resto}`
}

export interface NumeroDoLote {
  readonly rotulo: string
  readonly valor: string
  readonly apoio: string
}

/**
 * A faixa de números do alto da tela: quantas correções há, quantos destaques já foram abertos e o acerto médio **em
 * questões**. São contagens do trabalho da turma, nunca nota (D46): nenhum número aqui é um valor que o aluno "tirou".
 * Quem respondeu e a turma de hoje ficam em números separados (docblock de `textoDosCorrigidos`).
 */
export function numerosDoLote(correcao: Pick<CorrecaoDoLoteResponse, 'resumo' | 'destaques' | 'destaquesAbertos'>): readonly [NumeroDoLote, NumeroDoLote, NumeroDoLote] {
  const total = correcao.destaques.length
  return [
    { rotulo: 'Corrigidas', valor: String(correcao.resumo.corrigidos), apoio: `Na turma hoje: ${String(correcao.resumo.alunosDaTurma)}. Quem não abriu a atividade não tem correção.` },
    {
      rotulo: 'Destaques abertos',
      valor: total === 0 ? '0' : `${String(correcao.destaquesAbertos)} de ${String(total)}`,
      apoio: total === 0 ? 'Nenhum para abrir antes de aprovar.' : correcao.destaquesAbertos >= total ? 'Todos abertos.' : 'Abra todos antes de aprovar.',
    },
    { rotulo: 'Acerto médio', valor: textoDaMedia(correcao.resumo), apoio: 'Por aluno que respondeu.' },
  ]
}

/** "Abra estes 2 antes de aprovar": o título da aba Destaques, com a quantidade. */
export function tituloDosDestaques(quantos: number): string {
  if (quantos === 0) return 'Nenhuma correção para abrir antes de aprovar'
  return quantos === 1 ? 'Abra este antes de aprovar' : `Abra estes ${String(quantos)} antes de aprovar`
}

/** "As outras 2 correções": o título da aba Outras. */
export function tituloDasOutras(quantas: number): string {
  return quantas === 1 ? 'A outra correção' : `As outras ${String(quantas)} correções`
}

export const APOIO_DAS_OUTRAS = 'Dentro do esperado: não precisam ser abertas uma a uma. Estão em ordem de nome.'

/**
 * As outras correções **em ordem de nome**, e nunca de acerto: a ordem por acerto é um placar, e a lista é para a professora
 * conferir, não para comparar alunos (regra 50, item 9; D57). Nome igual desempata pelo id, para a ordem não depender de quem
 * a API devolveu primeiro.
 */
export function outrasEmOrdemDeNome<C extends { readonly alunoId: string; readonly nome: string }>(outras: readonly C[]): readonly C[] {
  return [...outras].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.alunoId.localeCompare(b.alunoId))
}

export const AVISO_DO_GABARITO = 'Uma questão em que quase todos erram a mesma alternativa pode ter o gabarito errado. Se for o caso, rejeite a correção e diga qual questão.'
