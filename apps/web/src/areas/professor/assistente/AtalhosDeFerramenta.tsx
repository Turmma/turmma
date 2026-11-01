import type { ChaveDeFuncao, Ferramenta } from '@educa/shared'
import { ArrowRight } from 'lucide-react'
import { Link } from 'wouter'
import { PROFESSOR_ROUTES } from '../../../paths'
import { Button } from '../../../components/ui/Button'
import { SECONDARY_LINK_CLASSES } from '../../../components/ui/button-variants'
import { CATALOGO_DE_FERRAMENTAS } from '../ferramentas/ferramentas'
import { IconeDeFerramenta } from '../ferramentas/icones-de-ferramenta'

interface PropsDosAtalhos {
  /** A professora escolheu uma ferramenta: quem usa abre o cartão dela na conversa. */
  readonly aoAbrir: (ferramenta: Ferramenta) => void
  /**
   * A função que executa a ferramenta está desligada (suspensa pela escola, ou a caixa inteira parada): o atalho dela não
   * aciona. O da Adaptação segue as duas suspensões, a da própria função e a de `conversa_e_ferramentas`, porque a
   * ferramenta nasce na conversa (D60).
   */
  readonly desligado: (funcao: ChaveDeFuncao) => boolean
}

/**
 * Os atalhos do Início (`docs/interface.md` 11.5; D18, D74): **um por ferramenta que existe**, lidos do mesmo catálogo da
 * página de Ferramentas e do menu da conversa, e o link para a página inteira. Substituem o menu "Ferramenta" na caixa do
 * Início.
 *
 * O atalho é a **escolha explícita** da ferramenta: ele não decide por quem digitou. O pedido escrito e enviado sem
 * atalho vai ao Assistente, que pergunta antes de abrir uma (D18). Botão secundário, de 44 px, com o ícone ilustrado: as
 * ferramentas são alternativas do mesmo peso (D59), e a ação principal da tela continua sendo enviar o pedido. Quebram em
 * linhas, centrados, sem rolar de lado (regra 50, item 2a).
 */
export function AtalhosDeFerramenta({ aoAbrir, desligado }: PropsDosAtalhos) {
  return (
    <div role="group" aria-label="Atalhos de ferramenta" className="flex min-w-0 flex-wrap items-center justify-center gap-x-3 gap-y-4">
      {CATALOGO_DE_FERRAMENTAS.map((item) => (
        <Button key={item.ferramenta} variante="secundario" disabled={desligado(item.funcao)} onClick={() => aoAbrir(item.ferramenta)}>
          <IconeDeFerramenta ferramenta={item.ferramenta} tamanho={24} />
          {item.nome}
        </Button>
      ))}
      {/* Relativo à área: o `Route` aninhado em `/professor` resolve o `to` a partir da base dela. */}
      <Link to={PROFESSOR_ROUTES.ferramentas} className={`${SECONDARY_LINK_CLASSES} gap-2`}>
        Ferramentas
        <ArrowRight aria-hidden="true" size={18} strokeWidth={2} />
      </Link>
    </div>
  )
}
