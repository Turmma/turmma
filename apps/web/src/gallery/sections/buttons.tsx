import { Plus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { BUTTON_VARIANTS, type ButtonSize, type ButtonVariant } from '../../components/ui/button-variants'
import { Menu } from '../../components/ui/overlays/Menu'
import { Secao } from '../GallerySection'

/** Os tamanhos com texto: o `data-tamanho` que o e2e usa para achar a fileira (`e2e/components-button.spec.ts`). */
const TAMANHOS_COM_TEXTO: readonly Exclude<ButtonSize, 'icone'>[] = ['principal', 'compacto']

/** O texto de cada desenho, com acento: o id da variante é nome de código, e não rótulo (`data-variante` guarda o id). */
const ROTULO: Readonly<Record<ButtonVariant, string>> = {
  primario: 'Primário',
  oficial: 'Oficial',
  secundario: 'Secundário',
  discreto: 'Discreto',
  perigo: 'Perigo',
}

/**
 * Cada fileira alinha pelo alto: o degrau põe 4 px de margem embaixo de toda peça com face, e o `discreto`, que não tem
 * degrau, ficaria 2 px mais baixo que os vizinhos num `items-center`.
 */
const FILEIRA = 'flex min-w-0 flex-wrap items-start gap-3'

/**
 * Os seis desenhos do botão da D80 (`docs/interface.md` 10.2), cada um nos três tamanhos, ligado e desligado, com
 * glifo e sem: é o que o e2e mede (alvo de 44 px, canto de 12 px, degrau, apertado, foco). A fileira `principal`, a
 * `compacto` e a `desligado` são as que o grupo `botoes` afirma desde a 2.0; as outras são da 3.0 e têm `data-tamanho`
 * próprio, para não entrarem na contagem das de antes.
 */
export default function SecoesDosBotoes() {
  return (
    <Secao nome="botoes" titulo="Botões">
      {TAMANHOS_COM_TEXTO.map((tamanho) => (
        <div key={tamanho} data-tamanho={tamanho} className={FILEIRA}>
          {BUTTON_VARIANTS.map((variante) => (
            <Button key={variante} variante={variante} tamanho={tamanho} data-variante={variante}>
              {ROTULO[variante]}
            </Button>
          ))}
        </div>
      ))}
      <div data-tamanho="desligado" className={FILEIRA}>
        {BUTTON_VARIANTS.map((variante) => (
          <Button key={variante} variante={variante} disabled data-variante={variante}>
            {ROTULO[variante]}
          </Button>
        ))}
      </div>
      <div data-tamanho="compacto-desligado" className={FILEIRA}>
        {BUTTON_VARIANTS.map((variante) => (
          <Button key={variante} variante={variante} tamanho="compacto" disabled data-variante={variante}>
            {ROTULO[variante]}
          </Button>
        ))}
      </div>
      <div data-tamanho="com-glifo" className={FILEIRA}>
        {BUTTON_VARIANTS.map((variante) => (
          <Button key={variante} variante={variante} data-variante={variante}>
            <Plus size={20} strokeWidth={2.5} aria-hidden="true" />
            {ROTULO[variante]}
          </Button>
        ))}
      </div>
      <div data-tamanho="icone" className={FILEIRA}>
        {BUTTON_VARIANTS.map((variante) => (
          <Button key={variante} variante={variante} tamanho="icone" aria-label={`Adicionar, ${ROTULO[variante]}`} data-variante={variante}>
            <Plus size={20} strokeWidth={2.5} aria-hidden="true" />
          </Button>
        ))}
      </div>
      <div data-tamanho="icone-desligado" className={FILEIRA}>
        {BUTTON_VARIANTS.map((variante) => (
          <Button key={variante} variante={variante} tamanho="icone" disabled aria-label={`Adicionar, ${ROTULO[variante]}, desligado`} data-variante={variante}>
            <Plus size={20} strokeWidth={2.5} aria-hidden="true" />
          </Button>
        ))}
      </div>
      <div data-tamanho="perigo-cheio" className={FILEIRA}>
        <Button variante="perigo" cheio data-variante="perigo-cheio">
          Perigo cheio
        </Button>
        <Button variante="perigo" cheio disabled data-variante="perigo-cheio">
          Perigo cheio desligado
        </Button>
        <Menu rotulo="Menu desligado" itens={[{ id: 'nada', rotulo: 'Nada' }]} aoEscolher={() => undefined} desligado />
      </div>
    </Secao>
  )
}
