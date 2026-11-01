import type { ReactNode, Ref } from 'react'

/**
 * As quatro larguras de conteúdo da 9.3 do `docs/interface.md`: 768 px na conversa, 880 px na leitura, 1040 px em
 * formulário e 1200 px em grade, a moldura inteira. Fluida até o teto: abaixo dele a tela ocupa o que a janela dá.
 */
const LARGURA_DA_TELA = {
  conversa: 'max-w-[768px]',
  leitura: 'max-w-[880px]',
  formulario: 'max-w-[1040px]',
  grade: 'max-w-[1200px]',
} as const
export type PageWidth = keyof typeof LARGURA_DA_TELA

interface PageProps {
  /**
   * O nome da tela, o `h1`: visível, em `t-titulo`, numa linha de no mínimo 64 px (RF12; `docs/interface.md` 11.2). O
   * título da aba do navegador continua com quem escreve a tela (`usePageTitle`).
   */
  readonly titulo: string
  readonly largura?: PageWidth
  /**
   * Aceita por quem a passa desde antes de o título de toda tela aparecer, e sem efeito: o cabeçalho, com a descrição e
   * as ações ao lado do título, é o mesmo em tela de objeto e em aba.
   */
  readonly objeto?: boolean
  /** Uma linha de apoio embaixo do título. Sem texto (`undefined`), a tela não a desenha: a turma ainda não lida não tem série. */
  readonly descricao?: string | undefined
  /** Os controles da tela, à direita do título: a ação cheia, abas, filtros e busca. */
  readonly acoes?: ReactNode
  /** O que vem antes do título: o "Voltar" da tela de objeto. */
  readonly antes?: ReactNode
  /**
   * A tela põe a margem da página ela mesma: 16 px no celular e 32 px a partir de 768 px. **Só fora da casca** (a galeria,
   * uma página pública): dentro da casca da escola a margem já é do `main` dela, e com as duas a tela ficaria com o
   * dobro.
   */
  readonly comMargem?: boolean
  /**
   * A exceção da conversa (`docs/interface.md` 11.2): o `h1` fica só para o leitor de tela, porque o Início e a conversa
   * com cada agente já começam pelo que o agente diz. Toda outra tela aberta pela lateral mostra o título.
   */
  readonly tituloSoParaLeitor?: boolean
  /** O `id` do `h1`, para a `section` da tela apontar para ele com `aria-labelledby`. */
  readonly idDoTitulo?: string
  /**
   * Para a tela levar o foco ao título depois de uma ação (o diálogo que fechou sem o botão que o abriu). Com ele o `h1`
   * ganha `tabIndex={-1}`: sem isso o `focus()` não faz nada.
   */
  readonly refDoTitulo?: Ref<HTMLHeadingElement>
  readonly children: ReactNode
}

/**
 * A moldura de toda tela, com o padrão de espaço do sistema (D72, D80; `docs/interface.md` 9.3 e 11.2): o cabeçalho com o
 * título visível, a coluna na largura da 9.3 e 16 px entre blocos. **A margem da página é da casca** (`CascaDaEscola`), e
 * por isso a `Page` não a repete; fora da casca, `comMargem` põe a mesma. A casca ainda limita o conteúdo a 1024 px: a
 * largura `grade` só passa disso quando a moldura de 1200 chegar (12.0).
 *
 * `min-w-0` na coluna é o que deixa um filho largo (tabela, linha de abas) rolar por dentro em vez de empurrar a página
 * a 360 px (regra 50, item 2a).
 */
export function Page({ titulo, largura = 'grade', descricao, acoes, antes, comMargem = false, tituloSoParaLeitor = false, idDoTitulo, refDoTitulo, children }: PageProps) {
  const controles = acoes === undefined ? undefined : <div className="flex min-w-0 flex-wrap items-center gap-2">{acoes}</div>
  return (
    <div data-tela={largura} className={`mx-auto flex w-full min-w-0 flex-col gap-4 ${comMargem ? 'px-4 pt-6 pb-8 md:px-8' : ''} ${LARGURA_DA_TELA[largura]}`}>
      {antes}
      {tituloSoParaLeitor ? (
        <>
          <h1 id={idDoTitulo} ref={refDoTitulo} tabIndex={refDoTitulo === undefined ? undefined : -1} className="sr-only">
            {titulo}
          </h1>
          {controles}
        </>
      ) : (
        <header className="flex min-h-16 min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 id={idDoTitulo} ref={refDoTitulo} tabIndex={refDoTitulo === undefined ? undefined : -1} className="t-titulo break-words text-tinta">
              {titulo}
            </h1>
            {descricao !== undefined && <p className="mt-1 text-sm break-words text-sutil">{descricao}</p>}
          </div>
          {controles}
        </header>
      )}
      {children}
    </div>
  )
}

/**
 * O nível do título de uma seção, de um cartão ou de um formulário. A peça não sabe onde foi posta: dentro de um cartão
 * que já é `h2`, o título de dentro é `h3`. Quem monta a tela diz o nível, para a ordem dos títulos não pular.
 */
export type HeadingLevel = 2 | 3 | 4

interface SectionHeaderProps {
  readonly titulo: string
  /** Sem ele, 2: a seção direto dentro da tela. */
  readonly nivel?: HeadingLevel
  /** O id do título, para a `section` de quem usa apontar para ele com `aria-labelledby`. */
  readonly id?: string
  readonly apoio?: string
  /** No máximo uma ação à direita, em `discreto` ou `secundario`. */
  readonly acao?: ReactNode
}

/** O cabeçalho de uma seção dentro da tela: título de cartão (16 px, peso 600), uma linha de apoio e, à direita, uma ação. */
export function SectionHeader({ titulo, nivel = 2, id, apoio, acao }: SectionHeaderProps) {
  const Titulo = `h${nivel}` as const
  return (
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <Titulo {...(id === undefined ? {} : { id })} className="text-base leading-snug font-semibold break-words text-tinta">
          {titulo}
        </Titulo>
        {apoio !== undefined && <p className="mt-0.5 text-sm break-words text-sutil">{apoio}</p>}
      </div>
      {acao}
    </div>
  )
}
