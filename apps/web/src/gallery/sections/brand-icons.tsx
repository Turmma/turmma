import { BookOpen, Settings } from 'lucide-react'
import { FAMILIAS_DE_COR } from '../../components/ui/Contador'
import { Icone, type TamanhoDoIcone } from '../../components/ui/Icone'
import { NOMES_DOS_LUGARES, type NomeDoLugar } from '../../components/ui/icons/places'
import { Ladrilho, type TamanhoDoLadrilho } from '../../components/ui/Ladrilho'
import { Secao } from '../GallerySection'

/** Os tamanhos em que o ícone ilustrado aparece na casca e nas telas: o menor da lista, o da lateral e o grande. */
const TAMANHOS_DO_ICONE: readonly TamanhoDoIcone[] = [24, 32, 48]
const TAMANHOS_DO_LADRILHO: readonly TamanhoDoLadrilho[] = [32, 36, 40, 44, 48, 56]

/** O texto que acompanha cada ícone nos blocos, com o que o lugar é para a pessoa. */
const ROTULOS: Readonly<Record<NomeDoLugar, string>> = {
  inicio: 'Início',
  turmas: 'Turmas',
  tarefas: 'Atividades',
  ferramentas: 'Ferramentas',
  painel: 'Painel',
  ia: 'Analista',
  escola: 'Escola',
  registros: 'Registros',
  criados: 'Criados',
}

/**
 * Os ícones ilustrados dos lugares e o ladrilho, como o produto os mostra (`docs/interface.md` 9.4 e 10.2; D80, item 4):
 * os quatro desenhos a 24, 32 e 48 px; o ladrilho em seis tamanhos, com o ícone ilustrado e com o do `lucide`; as dez
 * famílias; e o ladrilho com nome, sozinho, e sem nome, ao lado do texto. Dado inventado, e nenhum ícone mexe.
 */
export default function SecoesDaMarcaIcones() {
  return (
    <Secao nome="marca-icones" titulo="Ícones dos lugares e ladrilho">
      {TAMANHOS_DO_ICONE.map((tamanho) => (
        <div key={tamanho} data-icones-do-tamanho={tamanho} className="flex min-w-0 flex-wrap items-center gap-6">
          {NOMES_DOS_LUGARES.map((nome) => (
            <Icone key={nome} nome={nome} tamanho={tamanho} />
          ))}
        </div>
      ))}

      <div data-ladrilhos-ilustrados="" className="flex min-w-0 flex-wrap items-center gap-4">
        {TAMANHOS_DO_LADRILHO.map((tamanho) => (
          <Ladrilho key={tamanho} familia="laranja" tamanho={tamanho}>
            <Icone nome="inicio" tamanho={24} />
          </Ladrilho>
        ))}
      </div>

      <div data-ladrilhos-do-lucide="" className="flex min-w-0 flex-wrap items-center gap-4">
        {TAMANHOS_DO_LADRILHO.map((tamanho) => (
          <Ladrilho key={tamanho} familia="azul" tamanho={tamanho}>
            <BookOpen aria-hidden="true" strokeWidth={2.5} />
          </Ladrilho>
        ))}
      </div>

      <div data-ladrilhos-das-familias="" className="flex min-w-0 flex-wrap items-center gap-3">
        {FAMILIAS_DE_COR.map((familia) => (
          <Ladrilho key={familia} familia={familia} tamanho={40}>
            <Settings aria-hidden="true" strokeWidth={2.5} />
          </Ladrilho>
        ))}
      </div>

      <div data-ladrilhos-com-nome="" className="flex min-w-0 flex-wrap items-center gap-6">
        <Ladrilho familia="turquesa" tamanho={44} rotulo="Turmas">
          <Icone nome="turmas" tamanho={24} />
        </Ladrilho>
        <div className="flex min-w-0 items-center gap-3">
          <Ladrilho familia="verde" tamanho={36}>
            <Icone nome="ferramentas" tamanho={24} />
          </Ladrilho>
          <span className="min-w-0 break-words text-tinta">{ROTULOS.ferramentas}</span>
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <Icone nome="tarefas" tamanho={32} />
          <span className="min-w-0 break-words text-tinta">{ROTULOS.tarefas}</span>
        </div>
        <Icone nome="inicio" tamanho={40} rotulo={ROTULOS.inicio} />
      </div>
    </Secao>
  )
}
