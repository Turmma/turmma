import { useAparencia, type Aparencia as TipoDaAparencia } from '../theme'
import { Segmentado, type OpcoesDoSegmentado } from './ui/fields/Segmentado'

const OPCOES: OpcoesDoSegmentado<TipoDaAparencia> = [
  { valor: 'sistema', rotulo: 'Sistema' },
  { valor: 'claro', rotulo: 'Claro' },
  { valor: 'escuro', rotulo: 'Escuro' },
]

interface Props {
  /** Com `false`, o nome "Aparência" fica só para o leitor de tela: é o caso da barra de topo da operação, onde não cabe. */
  readonly rotuloVisivel?: boolean
}

/**
 * A escolha da aparência (RF3; `docs/interface.md` 10.2): Sistema, Claro ou Escuro, no menu da pessoa, em qualquer área.
 * Só a escolha explícita grava, e voltar a Sistema apaga a chave (`theme.ts`). Sem armazenamento, a escolha vale até a aba
 * fechar, e a peça não mostra erro nenhum.
 *
 * Mora na casca, que é da entrada: não importa peça que esteja fora dela (`PECAS_FORA_DA_ENTRADA`).
 */
export function Aparencia({ rotuloVisivel = true }: Props) {
  const { aparencia, escolher } = useAparencia()
  return <Segmentado rotulo="Aparência" rotuloVisivel={rotuloVisivel} opcoes={OPCOES} valor={aparencia} aoMudar={escolher} />
}
