import qrcode from 'qrcode-generator'
import { useMemo } from 'react'

/** Módulos claros em volta do código, como o padrão do QR pede para o leitor achar as bordas. */
const MARGEM_EM_MODULOS = 4

interface Props {
  /** O conteúdo codificado. Aqui é sempre a URI `otpauth://` do segundo fator. */
  conteudo: string
  /** O que o código é, para quem usa leitor de tela e não vai lê-lo: o texto ao lado é o caminho dessa pessoa. */
  descricao: string
}

/**
 * O QR do segredo do segundo fator, desenhado como um `<path>` de SVG, sem imagem, sem `canvas` e sem HTML montado à
 * mão: o desenho sai de um cálculo puro e o React escreve os atributos, então nada do conteúdo vira marcação.
 *
 * O QR é conveniência, nunca requisito: quem não tem celular — que é o caso em sala, pela Lei 15.100 — copia o
 * segredo em texto ao lado e cola no gerenciador de senhas do computador (regra 50, item 2).
 *
 * É a única peça que pinta com cor fixa, fora dos tokens: módulo quase preto sobre branco, **nos dois temas**. O leitor
 * de QR precisa do contraste e da polaridade (escuro sobre claro), e por isso o fundo não vira no escuro. A guarda de
 * `estilos.test.ts` conhece esta exceção pelo nome do arquivo.
 */
export function QrCode({ conteudo, descricao }: Props) {
  const { caminho, lado } = useMemo(() => desenho(conteudo), [conteudo])
  const inicio = -MARGEM_EM_MODULOS
  const total = lado + MARGEM_EM_MODULOS * 2
  return (
    <svg
      role="img"
      aria-label={descricao}
      viewBox={`${String(inicio)} ${String(inicio)} ${String(total)} ${String(total)}`}
      className="h-44 w-44 shrink-0 rounded-md bg-white p-1"
      shapeRendering="crispEdges"
    >
      <path d={caminho} fill="#0d0d0d" />
    </svg>
  )
}

/** Os módulos escuros do código, num caminho só: um `rect` por módulo custaria centenas de nós no Chromebook fraco. */
function desenho(conteudo: string): { caminho: string; lado: number } {
  // Tipo 0 é a menor versão que couber, e `M` é a correção de erro usual dos aplicativos autenticadores.
  const codigo = qrcode(0, 'M')
  codigo.addData(conteudo)
  codigo.make()
  const lado = codigo.getModuleCount()
  const partes: string[] = []
  for (let linha = 0; linha < lado; linha++) {
    for (let coluna = 0; coluna < lado; coluna++) {
      if (codigo.isDark(linha, coluna)) partes.push(`M${String(coluna)} ${String(linha)}h1v1h-1z`)
    }
  }
  return { caminho: partes.join(''), lado }
}
