import type { OrdemDoPainel } from '@educa/shared'
import { EstadoVazio } from '../../components/states'
import { formatarNumero, formatarQuantidade } from '../../format'
import { SECONDARY_BUTTON_CLASSES } from '../../components/ui/button-variants'

/**
 * A ordem e as páginas das duas listas do painel, Escolas e Uso (Tech Spec da A0b, seção 9): a mesma consulta
 * (`pagina` e `ordem` na query string), os mesmos botões e os mesmos textos nas duas telas.
 */

const ROTULO_DA_ORDEM: Readonly<Record<OrdemDoPainel, string>> = { nome: 'Nome', uso: 'Mais uso no mês' }

/** "Nome" e "Mais uso no mês", com `aria-pressed` na escolhida: a escolha não é só cor. Alvo de toque de 44 px. */
export function SeletorDeOrdem({ ordem, aoEscolher }: { ordem: OrdemDoPainel; aoEscolher: (ordem: OrdemDoPainel) => void }) {
  return (
    <div role="group" aria-label="Ordenar as escolas por" className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-sutil" aria-hidden="true">
        Ordenar por
      </span>
      {(['nome', 'uso'] as const).map((opcao) => (
        <button
          key={opcao}
          type="button"
          aria-pressed={ordem === opcao}
          onClick={() => aoEscolher(opcao)}
          className={`inline-flex min-h-11 items-center justify-center rounded-full border px-4 py-2 text-sm font-medium ${
            ordem === opcao ? 'border-noite bg-noite text-sobre-grafite' : 'border-borda-campo bg-superficie text-tinta hover:bg-realce-suave'
          }`}
        >
          {ROTULO_DA_ORDEM[opcao]}
        </button>
      ))}
    </div>
  )
}

interface PropsDasPaginas {
  /** O nome da navegação para o leitor de tela: "Páginas da lista", "Páginas do uso". */
  readonly rotulo: string
  readonly pagina: number
  readonly paginas: number
  /** A página nova está a caminho, com a anterior na tela (`placeholderData`): os dois botões esperam. */
  readonly trocando: boolean
  readonly aoIr: (pagina: number) => void
}

/** "Anterior", "Página N de M" e "Próxima", com o "Carregando a página…" anunciado durante a troca. */
export function PaginasDaLista({ rotulo, pagina, paginas, trocando, aoIr }: PropsDasPaginas) {
  return (
    <nav aria-label={rotulo} className="flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        disabled={pagina <= 1 || trocando}
        onClick={() => aoIr(pagina - 1)}
        className={`${SECONDARY_BUTTON_CLASSES} disabled:border-inativo disabled:text-inativo`}
      >
        Anterior
      </button>
      <p className="text-sm text-apoio">
        Página {formatarNumero(pagina)} de {formatarNumero(paginas)}
        <span role="status" className="sr-only">
          {trocando ? 'Carregando a página…' : ''}
        </span>
      </p>
      <button
        type="button"
        disabled={pagina >= paginas || trocando}
        onClick={() => aoIr(pagina + 1)}
        className={`${SECONDARY_BUTTON_CLASSES} disabled:border-inativo disabled:text-inativo`}
      >
        Próxima
      </button>
    </nav>
  )
}

/** A página além da última (endereço digitado, escola que saiu): o vazio dela, com o caminho de volta à primeira. */
export function VazioAlemDaUltima({ paginas, aoIrParaAPrimeira }: { paginas: number; aoIrParaAPrimeira: () => void }) {
  return (
    <EstadoVazio
      titulo="Não há escolas nesta página."
      descricao={`A lista tem ${formatarQuantidade(paginas, 'página', 'páginas')}.`}
      acao={{ rotulo: 'Ir para a primeira página', aoAcionar: aoIrParaAPrimeira }}
    />
  )
}
