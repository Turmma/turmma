import { VALIDADE_DO_CONVITE_HORAS, type EscolaDoPainel } from '@educa/shared'
import { useQueryClient } from '@tanstack/react-query'
import { DialogoDeConviteNovo, DialogoDeConviteRefeito } from '../../components/DialogoDoConvite'
import { CHAVE_DAS_ESCOLAS, mutacaoDoGerarConvite, mutacaoDoRefazerConvite } from '../api/painel'
import { pedidoDeConvite } from '../pedidos-do-painel'
import { falhaDoConvite } from '../textos'
import { DialogoDaOperacao } from './DialogoDaOperacao'

/** O que é dito do link, antes de gerar e depois: vale 72 h, entra uma vez, e aparece uma vez só. */
const TEXTO_DA_VALIDADE = `O convite vale ${String(VALIDADE_DO_CONVITE_HORAS)} horas e entra uma vez só.`
const TEXTO_DO_LINK_UMA_VEZ = 'O link aparece uma vez, logo depois de gerar. Copie e mande à coordenadora antes de fechar.'

/** A etapa do link e a pergunta de fechar, com quem entra pelo convite da operação. */
const TEXTOS_DO_LINK = { validade: TEXTO_DA_VALIDADE, quemEntra: 'a coordenadora' } as const

type EscolaDoConvite = Pick<EscolaDoPainel, 'id' | 'nome' | 'estado'>

interface Props {
  readonly escola: EscolaDoConvite
  /** Quem fecha é quem desmonta: a tela Escolas, pela abertura deste diálogo. */
  readonly aoFechar: () => void
  /** O foco ao fechar quando o botão que abriu já saiu da linha (`DialogoDaOperacao`). */
  readonly focoDeReserva?: () => void
}

/** A quem mandar o link, na etapa do link: a coordenadora daquela escola. */
function mandeACoordenadora(escolaNome: string) {
  return (
    <>
      Mande à coordenadora de <span className="font-medium text-tinta wrap-anywhere">{escolaNome}</span>.
    </>
  )
}

/**
 * Gerar o convite da primeira coordenação (Tech Spec da A0b, seção 9; RF2; tarefa 7.0): nome e e-mail, o resumo do que
 * vai acontecer, e o link, uma vez. O diálogo é o de `components/DialogoDoConvite.tsx`, o mesmo com que a coordenação
 * convida o professor (A1, 14.0); daqui vêm a moldura da operação, com o aviso de inatividade, os textos e a mutação do
 * painel. O token vive só na mutação deste diálogo: cada abertura é outra instância (a `key` da abertura), e a resposta
 * que chega depois de o diálogo fechar não cai em nenhum outro — nem num aberto para outra escola. Por isso o gerar não
 * chama o `fecharSeAinda` da tela: a resposta dele não fecha nada, e só preenche o diálogo que a pediu.
 */
export function GerarConvite({ escola, aoFechar, focoDeReserva }: Props) {
  const clienteDeConsultas = useQueryClient()
  return (
    <DialogoDeConviteNovo
      Moldura={DialogoDaOperacao}
      titulo="Convidar a coordenação"
      apresentacao={
        <>
          Para <span className="font-medium text-tinta wrap-anywhere">{escola.nome}</span>. A coordenadora recebe o link de você e cria a senha dela.
        </>
      }
      rotulos={{ nome: 'Nome da coordenadora', email: 'E-mail da coordenadora' }}
      validar={pedidoDeConvite}
      tituloDaRevisao="Confira antes de gerar"
      resumo={(pedido) => [
        { rotulo: 'Escola', valor: escola.nome },
        { rotulo: 'Nome da coordenadora', valor: pedido.nome },
        { rotulo: 'E-mail', valor: pedido.email },
      ]}
      avisos={[TEXTO_DA_VALIDADE, TEXTO_DO_LINK_UMA_VEZ, ...(escola.estado === 'aceito' ? ['O convite aceito antes deixa de ativar a conta: só este novo ativa.'] : [])]}
      acao={{ confirmar: 'Gerar convite', confirmando: 'Gerando…', anuncio: 'Gerando o convite…' }}
      // A lista muda (o estado, ou o que outra pessoa fez): recarrega, dê certo ou não. As opções são as de `api/painel.ts`,
      // sem nada por cima: é lá que o `gcTime: 0` tira o token do cache.
      mutacao={mutacaoDoGerarConvite(escola.id, () => clienteDeConsultas.invalidateQueries({ queryKey: CHAVE_DAS_ESCOLAS }))}
      falha={(erro) => falhaDoConvite('gerar', erro)}
      mandePara={() => mandeACoordenadora(escola.nome)}
      link={TEXTOS_DO_LINK}
      aoFechar={aoFechar}
      focoDeReserva={focoDeReserva}
    />
  )
}

interface PropsDoRefazer extends Props {
  /** O último convite de coordenação da escola, como a lista o trouxe. */
  readonly conviteId: string
}

/**
 * Refazer o convite (Tech Spec da A0b, seção 9; tarefa 7.0): confirma antes, dizendo que o link anterior para de valer,
 * e então mostra o link novo, uma vez, como o gerar. O `CONFLITO` (outra pessoa refez ou revogou antes) e o
 * `NAO_ENCONTRADO` têm o texto da W10 dentro do diálogo, e a lista recarrega.
 */
export function RefazerConvite({ escola, conviteId, aoFechar, focoDeReserva }: PropsDoRefazer) {
  const clienteDeConsultas = useQueryClient()
  return (
    <DialogoDeConviteRefeito
      Moldura={DialogoDaOperacao}
      titulo="Refazer o convite"
      confirmacao={
        <>
          Um link novo para a coordenação de <span className="font-medium text-tinta wrap-anywhere">{escola.nome}</span>. O link mandado antes para de valer na
          hora.
        </>
      }
      avisos={[TEXTO_DA_VALIDADE, TEXTO_DO_LINK_UMA_VEZ]}
      acao={{ confirmar: 'Refazer convite', confirmando: 'Refazendo…', anuncio: 'Refazendo o convite…' }}
      mutacao={mutacaoDoRefazerConvite(conviteId, () => clienteDeConsultas.invalidateQueries({ queryKey: CHAVE_DAS_ESCOLAS }))}
      falha={(erro) => falhaDoConvite('refazer', erro)}
      mandePara={mandeACoordenadora(escola.nome)}
      link={TEXTOS_DO_LINK}
      aoFechar={aoFechar}
      focoDeReserva={focoDeReserva}
    />
  )
}
