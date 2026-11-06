import { formatNumber, formatQuantity } from '../../../format'
import type { ResumoDaImportacao, TipoDeEventoDoCalendario } from '@educa/shared'

/**
 * O que a aba Grade e calendário diz (F2, 14.0), fora da tela para ser provado sem navegador: a conclusão de cada planilha, as
 * instruções e o nome de cada tipo de evento. O que a gravação fez sai das contagens do `resumo`, que a API guarda só em números
 * (regra 20, item 9).
 */

export const NOME_DO_TIPO_DE_EVENTO: Readonly<Record<TipoDeEventoDoCalendario, string>> = { feriado: 'Feriado', recesso: 'Recesso', evento: 'Evento' }

/**
 * O pedido de não escrever nome de pessoa nos dois textos livres das planilhas: a sala da aula (até 40 caracteres) e a descrição do
 * evento (até 120). O modelo traz só o cabeçalho, porque uma linha de exemplo seria lida como dado; o aviso fica na tela (regra 20,
 * item 1; `docs/lgpd.md`, linhas "Aula da grade" e "Evento do calendário").
 */
export const AVISO_DA_SALA = 'Na sala, escreva só o lugar, como “Lab 2” ou “Sala 12”, nunca o nome de uma pessoa.'
export const AVISO_DA_DESCRICAO = 'Na descrição, escreva só o que acontece, como “Feriado municipal”, nunca o nome de uma pessoa.'

/** Instrução da planilha de grade: uma aula por linha, e o que a avisa de horário quer dizer. */
export const INSTRUCAO_DA_GRADE = (maximo: number): string =>
  `Uma linha por aula, com a turma, a disciplina, o nome e o e-mail do professor, o dia, o início e o fim, e a sala, se houver. ${AVISO_DA_SALA} Escolha o CSV ou o Excel (.xlsx), até ${formatNumber(maximo)} linhas. Turma, disciplina e professor que ainda não existem nascem ao gravar. Importar de novo substitui a grade do ano.`

export const INSTRUCAO_DO_CALENDARIO = (maximo: number): string =>
  `Uma linha por feriado, recesso ou evento, com o início, o fim, o tipo e a descrição. ${AVISO_DA_DESCRICAO} Escolha o CSV ou o Excel (.xlsx), até ${formatNumber(maximo)} linhas. Importar de novo substitui os eventos do ano: o que a planilha não traz sai, e a prévia diz quantos.`

/** O que o vazio de cada painel de importação e de cada seção diz: o convite a baixar o modelo, e o aviso de não escrever nome de pessoa. */
export const VAZIO_DO_PAINEL_DA_GRADE = `Baixe o modelo da grade, preencha uma linha por aula e escolha o arquivo para ver a prévia. ${AVISO_DA_SALA}`
export const VAZIO_DO_PAINEL_DO_CALENDARIO = `Baixe o modelo do calendário, preencha uma linha por evento e escolha o arquivo para ver a prévia. ${AVISO_DA_DESCRICAO}`
export const VAZIO_DA_GRADE = `Baixe o modelo da grade, preencha uma linha por aula e use “Importar grade”. A grade nasce da planilha: aqui você só a lê. ${AVISO_DA_SALA}`
export const VAZIO_DO_CALENDARIO = `Baixe o modelo do calendário, preencha uma linha por feriado, recesso ou evento e use “Importar calendário”. ${AVISO_DA_DESCRICAO}`
export const TEXTO_DOS_MODELOS = `Os quatro modelos trazem só o cabeçalho. Preencha, salve como Excel ou CSV e importe: o modelo preenchido entra sem erro. ${AVISO_DA_SALA} ${AVISO_DA_DESCRICAO}`

/** O calendário diz do jeito dele o fim antes do início: o evento de um dia só, com início igual ao fim, é válido (RF10). */
export const ERROS_DA_LINHA_DO_CALENDARIO: Readonly<Record<string, string>> = { fim_antes_do_inicio: 'O fim vem antes do início. Confira as duas colunas: o evento de um dia só tem o mesmo dia nas duas.' }

/** O que a tela diz ao terminar a grade: as aulas que entraram, o que nasceu e o que saiu. "Aulas" sempre aparece, mesmo zero. */
export function textoDaConclusaoDaGrade(resumo: ResumoDaImportacao | null): string {
  const n = (chave: keyof ResumoDaImportacao): number => resumo?.[chave] ?? 0
  const contagens: readonly (readonly [number, string, string])[] = [
    [n('aulas'), 'aula gravada', 'aulas gravadas'],
    [n('aulas_removidas'), 'aula saiu da grade', 'aulas saíram da grade'],
    [n('turmas_novas'), 'turma nova foi criada', 'turmas novas foram criadas'],
    [n('disciplinas_novas'), 'disciplina nova foi criada', 'disciplinas novas foram criadas'],
    [n('professores_novos'), 'professor novo foi cadastrado', 'professores novos foram cadastrados'],
    [n('vinculos_criados'), 'vínculo de professor espera a confirmação dele', 'vínculos de professor esperam a confirmação deles'],
    [n('vinculos_encerrados'), 'vínculo de professor foi encerrado', 'vínculos de professor foram encerrados'],
  ]
  return contagens.flatMap(([quantos, um, varios], posicao) => (posicao === 0 || quantos > 0 ? [`${formatQuantity(quantos, um, varios)}.`] : [])).join(' ')
}

/** O que a tela diz ao terminar o calendário: os eventos que entraram e os que saíram do ano. */
export function textoDaConclusaoDoCalendario(resumo: ResumoDaImportacao | null): string {
  const n = (chave: keyof ResumoDaImportacao): number => resumo?.[chave] ?? 0
  const contagens: readonly (readonly [number, string, string])[] = [
    [n('entram'), 'evento entrou no calendário', 'eventos entraram no calendário'],
    [n('eventos_removidos'), 'evento saiu do calendário', 'eventos saíram do calendário'],
  ]
  return contagens.flatMap(([quantos, um, varios], posicao) => (posicao === 0 || quantos > 0 ? [`${formatQuantity(quantos, um, varios)}.`] : [])).join(' ')
}
