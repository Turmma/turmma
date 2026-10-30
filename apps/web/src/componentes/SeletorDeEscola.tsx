import { AVISO_DA_TROCA_RECUSADA, ErrorCode, type AcessoDaConta } from '@educa/shared'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { useLocation } from 'wouter'
import { ErroDaApi, mensagemDoErro } from '../api/cliente'
import { trocarDeEscola } from '../api/sessao'
import { ROTA_DA_ETAPA } from '../caminhos'
import { NOME_DO_PAPEL } from '../papeis'

/**
 * O que a troca recusada diz. A API responde `NAO_ENCONTRADO` para a sessão que não troca (matrícula, conta da
 * escola) e para o usuário que deixou de existir naquela escola: o texto vale para os dois e não diz qual foi
 * (regra 10, item 6). Qualquer outra falha é a mensagem do catálogo, que já diz o que fazer.
 */
function mensagemDaTroca(erro: unknown): string {
  return erro instanceof ErroDaApi && erro.codigo === ErrorCode.NAO_ENCONTRADO ? AVISO_DA_TROCA_RECUSADA : mensagemDoErro(erro)
}

/**
 * O nome de uma escola para o leitor de tela: "Colégio Vista Alegre, Rede Vista Alegre · professor". É o mesmo texto das
 * duas linhas que a tela mostra, na mesma ordem (WCAG 2.5.3), com a vírgula que as separa: sem ela, o nome calculado
 * pelo conteúdo colaria a escola na rede.
 */
function nomeDaEscola(acesso: AcessoDaConta): string {
  return `${acesso.escolaNome}, ${acesso.redeNome} · ${NOME_DO_PAPEL[acesso.papel]}`
}

/** O conteúdo de uma escola, no botão que abre o seletor e em cada linha dele: o nome em cima e, embaixo, a rede e o papel (P30). */
function DadosDaEscola({ acesso }: { acesso: AcessoDaConta }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="t-apoio font-bold break-words text-tinta">{acesso.escolaNome}</span>
      <span className="text-sm break-words text-sutil">
        {acesso.redeNome} · {NOME_DO_PAPEL[acesso.papel]}
      </span>
    </span>
  )
}

interface Props {
  /** O nome da escola em que a pessoa está agora: é o que aparece quando não há outra para escolher. */
  escolaAtual: string
  /** Os usuários ativos da conta (`/v1/eu.acessos`), este incluído. O aluno não tem conta, e a lista vem vazia. */
  acessos: readonly AcessoDaConta[]
  usuarioAtual: string
}

/**
 * O seletor de escola do topo da lateral (regra 50, item 13; `docs/interface.md` 11.1; P30), no formato de seletor de
 * espaço de trabalho: a escola, a rede e o papel de cada acesso da conta, com a marca de escolhido na escola de agora. A
 * professora da rede pública dá aula em duas ou três escolas, e tudo abaixo daqui é da escola ativa. Sigla, turno e
 * número de turmas ficam fora: os dois primeiros não existem no modelo, e o número de turmas seria dado de dentro da
 * outra escola (Tech Spec da A1, seção 11).
 *
 * Trocar é uma entrada nova: a API cria a sessão na escola de destino e encerra a de origem, e a web esvazia o cache
 * **depois** de o token do destino estar em uso (`guardarToken`), porque nada da escola anterior pode sobreviver do lado
 * do cliente, e uma busca refeita com a credencial de origem traria o dado dela para o destino (regra 10, item 1). Com a
 * coordenação no destino, o caminho passa pelo segundo fator antes de qualquer sessão existir, e até lá a pessoa
 * continua na escola de origem, com a tela dela (Tech Spec do F1, seção 5, "Troca de escola"). Escolher a escola em que
 * já se está só fecha a lista: não há troca, nem token novo.
 *
 * É uma lista que abre e fecha (o botão com `aria-expanded`), e não um menu de setas: abre por clique, toque, Enter ou
 * Espaço, o foco vai para a escola de agora, o Tab percorre as outras, e o Esc fecha e devolve o foco ao botão — dentro
 * da gaveta, sem fechá-la junto. Enquanto uma troca está no ar, as linhas ficam em `aria-disabled`, e não `disabled`:
 * desabilitar a linha que tem o foco o jogaria no `body`, e o leitor de tela perderia onde estava.
 *
 * Com uma escola só, não há o que abrir: fica o nome dela, que é o que diz onde a pessoa está.
 */
export function SeletorDeEscola({ escolaAtual, acessos, usuarioAtual }: Props) {
  const [, navegar] = useLocation()
  const [aberto, definirAberto] = useState(false)
  // A escola cuja troca está no ar: o texto "Abrindo …" da linha, do nome dela e da região de status sai daqui só.
  const [trocando, definirTrocando] = useState<AcessoDaConta | undefined>(undefined)
  const [falha, definirFalha] = useState<unknown>(undefined)
  const idDaLista = useId()
  const botao = useRef<HTMLButtonElement>(null)
  const escolhida = useRef<HTMLButtonElement>(null)
  const atual = acessos.find((acesso) => acesso.usuarioId === usuarioAtual)
  const abrindo = trocando === undefined ? '' : `Abrindo ${trocando.escolaNome}…`

  if (atual === undefined || acessos.length < 2) {
    return (
      <p className="min-w-0 break-words px-2 py-1">
        <span className="sr-only">Escola: </span>
        <span className="t-apoio font-bold">{escolaAtual}</span>
      </p>
    )
  }

  function abrir(): void {
    // Reabrir começa de novo: o aviso da troca recusada é da tentativa anterior, e o foco vai para a escola de agora, e
    // não para a linha que falhou.
    definirFalha(undefined)
    definirAberto(true)
    // O foco só pode ir para a linha depois de a lista estar na página.
    requestAnimationFrame(() => escolhida.current?.focus())
  }

  function fechar(): void {
    definirAberto(false)
    botao.current?.focus()
  }

  async function escolher(acesso: AcessoDaConta): Promise<void> {
    // Dois toques no mesmo cartão abririam duas sessões na escola de destino e encerrariam a de origem duas vezes.
    if (trocando !== undefined) return
    // A escola em que já se está: nada a trocar. Trocar mesmo assim gravaria uma sessão nova e esvaziaria a tela à toa.
    if (acesso.usuarioId === usuarioAtual) {
      fechar()
      return
    }
    definirTrocando(acesso)
    definirFalha(undefined)
    try {
      const resposta = await trocarDeEscola(acesso.usuarioId)
      // `pronta` volta à página inicial, já da escola de destino; a coordenação passa antes pelo segundo fator.
      navegar(ROTA_DA_ETAPA[resposta.etapa], { replace: true })
    } catch (erro) {
      definirFalha(erro)
    } finally {
      definirTrocando(undefined)
    }
  }

  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>): void {
    if (evento.key !== 'Escape' || !aberto) return
    // Dentro da gaveta, o Esc fecharia o `dialog` inteiro: aqui ele fecha só a lista.
    evento.preventDefault()
    evento.stopPropagation()
    fechar()
  }

  return (
    <div className="flex min-w-0 flex-col gap-2" onKeyDown={aoTeclar}>
      <button
        ref={botao}
        type="button"
        aria-label={`Escola: ${nomeDaEscola(atual)}`}
        aria-expanded={aberto}
        aria-controls={idDaLista}
        onClick={() => (aberto ? fechar() : abrir())}
        className="degrau degrau-borda flex min-h-12 w-full min-w-0 items-center gap-2 rounded-controle border-2 border-borda bg-fundo px-3 py-2 text-left hover:bg-fundo-suave"
      >
        <DadosDaEscola acesso={atual} />
        <ChevronsUpDown aria-hidden="true" size={18} strokeWidth={2.5} className="shrink-0 text-sutil" />
      </button>
      {aberto && (
        <ul id={idDaLista} aria-label="Suas escolas" className="flex flex-col gap-1 rounded-cartao bg-fundo p-1 shadow-flutua">
          {acessos.map((acesso) => {
            const eAtual = acesso.usuarioId === usuarioAtual
            const estaAbrindo = trocando?.usuarioId === acesso.usuarioId
            return (
              <li key={acesso.usuarioId}>
                <button
                  ref={eAtual ? escolhida : undefined}
                  type="button"
                  aria-label={estaAbrindo ? abrindo : nomeDaEscola(acesso)}
                  aria-current={eAtual ? 'true' : undefined}
                  aria-disabled={trocando !== undefined}
                  onClick={() => void escolher(acesso)}
                  className="flex min-h-12 w-full min-w-0 items-center gap-2 rounded-controle px-2 py-2 text-left hover:bg-fundo-suave aria-disabled:cursor-wait"
                >
                  {/* A marca de escolhido: o ícone e, para o leitor de tela, o `aria-current`. As outras linhas guardam o
                      mesmo espaço, para os nomes ficarem alinhados. */}
                  <span className="flex size-[18px] shrink-0 items-center justify-center" aria-hidden="true">
                    {eAtual && <Check size={18} strokeWidth={2.5} className="text-tinta" />}
                  </span>
                  {estaAbrindo ? (
                    <span className="min-w-0 flex-1 break-words font-medium">{abrindo}</span>
                  ) : (
                    <DadosDaEscola acesso={acesso} />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {/* A troca no ar anunciada a todo leitor de tela: a troca do nome da linha com o foco, sozinha, cada um lê de um
          jeito. A região existe antes do texto, para a mudança ser anunciada. */}
      <p role="status" className="sr-only">
        {abrindo}
      </p>
      {falha !== undefined && (
        <p role="alert" className="rounded-controle border-2 border-erro bg-erro-cx p-3 text-erro">
          {mensagemDaTroca(falha)}
        </p>
      )}
    </div>
  )
}
