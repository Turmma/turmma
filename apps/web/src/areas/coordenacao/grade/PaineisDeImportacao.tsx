import { CABECALHOS_DA_PLANILHA, MAXIMO_DE_LINHAS_DA_PLANILHA } from '@educa/shared'
import { Sheet } from '../../../components/ui/overlays/Sheet'
import { rotasDaPlanilha } from '../importacao/api/importacao'
import { ImportarPlanilha, type PlanilhaConfig } from '../importacao/ImportarPlanilha'
import { MODELO_DE_CADA_TIPO } from './modelos-de-planilha'
import { ERROS_DA_LINHA_DO_CALENDARIO, INSTRUCAO_DA_GRADE, INSTRUCAO_DO_CALENDARIO, textoDaConclusaoDaGrade, textoDaConclusaoDoCalendario, VAZIO_DO_PAINEL_DA_GRADE, VAZIO_DO_PAINEL_DO_CALENDARIO } from './textos-da-grade'

/**
 * Os painéis `?painel=importar-grade` e `?painel=importar-calendario` de Escola › Grade e calendário (F2, 14.0; RF7, RF9 e RF10): a
 * mesma peça da planilha de alunos, com a configuração de cada tipo. Abrem ao lado da tela; ao gravar, a grade e o calendário são lidos
 * de novo (`aoConcluir`). A importação vai ao ano em curso: o planejado só se lê.
 */
const CONFIGURACAO_DA_GRADE: PlanilhaConfig = {
  rotas: rotasDaPlanilha('grade'),
  cabecalhos: CABECALHOS_DA_PLANILHA.grade,
  nomeDoModelo: MODELO_DE_CADA_TIPO.grade.arquivo,
  instrucao: INSTRUCAO_DA_GRADE(MAXIMO_DE_LINHAS_DA_PLANILHA),
  vazio: { titulo: 'Nenhuma planilha escolhida', descricao: VAZIO_DO_PAINEL_DA_GRADE },
  rotuloDoGravar: 'Gravar grade',
  textoDaConclusao: textoDaConclusaoDaGrade,
}

const CONFIGURACAO_DO_CALENDARIO: PlanilhaConfig = {
  rotas: rotasDaPlanilha('calendario'),
  cabecalhos: CABECALHOS_DA_PLANILHA.calendario,
  nomeDoModelo: MODELO_DE_CADA_TIPO.calendario.arquivo,
  instrucao: INSTRUCAO_DO_CALENDARIO(MAXIMO_DE_LINHAS_DA_PLANILHA),
  vazio: { titulo: 'Nenhuma planilha escolhida', descricao: VAZIO_DO_PAINEL_DO_CALENDARIO },
  rotuloDoGravar: 'Gravar calendário',
  textoDaConclusao: textoDaConclusaoDoCalendario,
  textosDoErroDaLinha: ERROS_DA_LINHA_DO_CALENDARIO,
}

interface Props {
  readonly aoConcluir: () => unknown
  readonly aoFechar: () => void
  readonly focoDeReserva: () => void
}

export function PainelDaImportacaoDaGrade({ aoConcluir, aoFechar, focoDeReserva }: Props) {
  return (
    <Sheet titulo="Importar grade" aoFechar={aoFechar} focoDeReserva={focoDeReserva}>
      <ImportarPlanilha configuracao={CONFIGURACAO_DA_GRADE} aoConcluir={aoConcluir} />
    </Sheet>
  )
}

export function PainelDaImportacaoDoCalendario({ aoConcluir, aoFechar, focoDeReserva }: Props) {
  return (
    <Sheet titulo="Importar calendário" aoFechar={aoFechar} focoDeReserva={focoDeReserva}>
      <ImportarPlanilha configuracao={CONFIGURACAO_DO_CALENDARIO} aoConcluir={aoConcluir} />
    </Sheet>
  )
}
