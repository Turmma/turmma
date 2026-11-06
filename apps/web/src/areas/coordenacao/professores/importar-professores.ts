import { MAXIMO_DE_LINHAS_DA_PLANILHA_DE_PROFESSORES, type ResumoDaImportacao } from '@educa/shared'
import { formatNumber, formatQuantity } from '../../../format'
import type { FrasesDoResumoDeMarcas, TextoDoGrupoDeMarca, TextosDosGruposDeMarca } from '../importacao/previa-da-planilha'

/**
 * O que o painel "Importar professores" da aba Professores diz (F2, 15.0; RF4 e RF6), fora da tela para ser provado sem navegador. A peça
 * é a `ImportarPlanilha` da 13.0; aqui ficam as palavras da planilha de professores, que diz "professor" onde a de alunos diz "aluno".
 *
 * **A marca de desligar é rotulada só com o nome** que a API devolve (`rotulo` do candidato): a API não manda o e-mail, de propósito (E11;
 * 6.0; Tech Spec, seção 9), e a tela não o pede nem o mostra.
 */

/** A instrução do painel: uma linha por professor, o teto, o que acontece com quem entra e com quem não está na planilha. */
export const INSTRUCAO_DA_PLANILHA_DE_PROFESSORES = `Uma linha por professor, com o nome e o e-mail com que a pessoa vai entrar. Escolha o CSV ou o Excel (.xlsx), até ${formatNumber(MAXIMO_DE_LINHAS_DA_PLANILHA_DE_PROFESSORES)} linhas. Quem ainda não está na escola é cadastrado com o convite em aberto, e o link você pega depois, abrindo o professor na lista. Quem já está na escola e não aparece na planilha continua, e só sai com a sua marca.`

export const VAZIO_DO_PAINEL_DE_PROFESSORES = 'Baixe o modelo, preencha uma linha por professor, com o nome e o e-mail, e escolha o arquivo para ver a prévia.'

/** Os erros de linha que a planilha de professores diz do jeito dela: a coluna do nome é "nome", e o teto é de 300 linhas, e não de 3.000. */
export const ERROS_DA_LINHA_DE_PROFESSORES: Readonly<Record<string, string>> = {
  nome_vazio: 'Falta o nome do professor. Preencha a coluna "nome".',
  acima_do_teto: `A planilha de professores aceita até ${formatNumber(MAXIMO_DE_LINHAS_DA_PLANILHA_DE_PROFESSORES)} linhas, e esta linha passou do teto. Divida em partes e envie uma de cada vez.`,
}

const DESLIGAR_PROFESSOR: TextoDoGrupoDeMarca = {
  titulo: 'Estão na escola, mas não aparecem na planilha',
  explicacao:
    'Marque só quem saiu da escola: o professor desligado perde o acesso e os vínculos dele com as turmas são encerrados. Esta lista sai só da comparação com a planilha, e não do uso nem do desempenho de ninguém. Quem você não marcar continua na escola, mesmo ausente da planilha.',
  rotuloDoTodos: 'Marcar todos para desligar',
}

/** A planilha de professores só tem a marca de desligar; os textos dela dizem "professor". */
export const TEXTOS_DAS_MARCAS_DE_PROFESSORES: TextosDosGruposDeMarca = { desligar: DESLIGAR_PROFESSOR }

export const FRASES_DO_RESUMO_DAS_MARCAS_DE_PROFESSORES: FrasesDoResumoDeMarcas = {
  desligar: ['professor será desligado e perde o acesso', 'professores serão desligados e perdem o acesso'],
}

/**
 * O que a tela diz ao terminar: quantos professores foram cadastrados com o convite em aberto (sempre, mesmo zero), quantos já estavam
 * na escola e quantos saíram. Quando alguém foi cadastrado, diz onde está o link, que a gravação não mostra.
 */
export function textoDaConclusaoDeProfessores(resumo: ResumoDaImportacao | null): string {
  const n = (chave: keyof ResumoDaImportacao): number => resumo?.[chave] ?? 0
  const contagens: readonly (readonly [number, string, string])[] = [
    [n('entram'), 'professor cadastrado, com o convite em aberto', 'professores cadastrados, com o convite em aberto'],
    [n('ja_existem'), 'professor já estava na escola, e nada mudou', 'professores já estavam na escola, e nada mudou'],
    [n('desligados'), 'professor foi desligado', 'professores foram desligados'],
  ]
  const partes = contagens.flatMap(([quantos, um, varios], posicao) => (posicao === 0 || quantos > 0 ? [`${formatQuantity(quantos, um, varios)}.`] : []))
  if (n('entram') > 0) partes.push('Para pegar o link de cada um, abra o professor na lista e use “Refazer convite”: o link aparece uma vez.')
  return partes.join(' ')
}
