import { CABECALHOS_DA_PLANILHA, MAXIMO_DE_LINHAS_DA_PLANILHA } from '@educa/shared'
import { Sheet } from '../../../components/ui/overlays/Sheet'
import { formatNumber } from '../../../format'
import { rotasDaPlanilha } from './api/importacao'
import { ImportarPlanilha, type PlanilhaConfig } from './ImportarPlanilha'

/**
 * O painel `?painel=importar` de Escola › Turmas (F2, 13.0; RF2 a RF4): a planilha de alunos da escola inteira, com a turma em
 * cada linha. Abre ao lado da tela e deixa as turmas por trás; ao gravar, a tela das turmas é recarregada (`aoConcluir`).
 */
const CONFIGURACAO: PlanilhaConfig = {
  rotas: rotasDaPlanilha('alunos'),
  cabecalhos: CABECALHOS_DA_PLANILHA.alunos,
  nomeDoModelo: 'modelo-alunos.csv',
  instrucao: `Uma linha por aluno, com a turma, o nome e a matrícula. Escolha o CSV ou o Excel (.xlsx) da escola inteira, até ${formatNumber(MAXIMO_DE_LINHAS_DA_PLANILHA)} linhas por vez. Antes de gravar, você vê o que vai acontecer com cada linha.`,
  vazio: { titulo: 'Nenhuma planilha escolhida', descricao: 'Baixe o modelo, preencha com os alunos da escola e escolha o arquivo para ver a prévia.' },
  rotuloDoGravar: 'Gravar planilha',
}

export function PainelDaImportacaoDeAlunos({ aoConcluir, aoFechar, focoDeReserva }: { aoConcluir: () => unknown; aoFechar: () => void; focoDeReserva: () => void }) {
  return (
    <Sheet titulo="Importar alunos" aoFechar={aoFechar} focoDeReserva={focoDeReserva}>
      <ImportarPlanilha configuracao={CONFIGURACAO} aoConcluir={aoConcluir} />
    </Sheet>
  )
}
