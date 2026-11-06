import { CABECALHOS_DA_PLANILHA } from '@educa/shared'
import { Sheet } from '../../../components/ui/overlays/Sheet'
import { MODELO_DE_CADA_TIPO } from '../grade/modelos-de-planilha'
import { rotasDaPlanilha } from '../importacao/api/importacao'
import { ImportarPlanilha, type PlanilhaConfig } from '../importacao/ImportarPlanilha'
import {
  ERROS_DA_LINHA_DE_PROFESSORES,
  FRASES_DO_RESUMO_DAS_MARCAS_DE_PROFESSORES,
  INSTRUCAO_DA_PLANILHA_DE_PROFESSORES,
  TEXTOS_DAS_MARCAS_DE_PROFESSORES,
  textoDaConclusaoDeProfessores,
  VAZIO_DO_PAINEL_DE_PROFESSORES,
} from './importar-professores'

/**
 * O painel `?painel=importar` de Escola › Professores (F2, 15.0; RF4 e RF6): a mesma peça da planilha de alunos, com a configuração dos
 * professores. Abre ao lado da tela e deixa a lista por trás; ao gravar, a lista é lida de novo (`aoConcluir`) e o professor cadastrado
 * aparece `pendente`, sem recarregar a página. A planilha de professores não é de um ano: a tela não manda `anoLetivoId` nem `turmaId`.
 */
const CONFIGURACAO: PlanilhaConfig = {
  rotas: rotasDaPlanilha('professores'),
  cabecalhos: CABECALHOS_DA_PLANILHA.professores,
  nomeDoModelo: MODELO_DE_CADA_TIPO.professores.arquivo,
  instrucao: INSTRUCAO_DA_PLANILHA_DE_PROFESSORES,
  vazio: { titulo: 'Nenhuma planilha escolhida', descricao: VAZIO_DO_PAINEL_DE_PROFESSORES },
  rotuloDoGravar: 'Gravar professores',
  textoDaConclusao: textoDaConclusaoDeProfessores,
  textosDoErroDaLinha: ERROS_DA_LINHA_DE_PROFESSORES,
  textosDosGruposDeMarca: TEXTOS_DAS_MARCAS_DE_PROFESSORES,
  frasesDoResumoDeMarcas: FRASES_DO_RESUMO_DAS_MARCAS_DE_PROFESSORES,
}

export function PainelDaImportacaoDeProfessores({ aoConcluir, aoFechar, focoDeReserva }: { aoConcluir: () => unknown; aoFechar: () => void; focoDeReserva: () => void }) {
  return (
    <Sheet titulo="Importar professores" aoFechar={aoFechar} focoDeReserva={focoDeReserva}>
      <ImportarPlanilha configuracao={CONFIGURACAO} aoConcluir={aoConcluir} />
    </Sheet>
  )
}
