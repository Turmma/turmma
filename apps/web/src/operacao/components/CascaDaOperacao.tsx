import { Lock } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useRoute } from 'wouter'
import { Aparencia } from '../../components/Aparencia'
import { Botao } from '../../components/ui/Botao'
import { CLASSES_DO_BOTAO_SECUNDARIO } from '../../components/ui/button-variants'
import { INICIO_DA_OPERACAO, ROTAS_DA_OPERACAO, USO_DA_OPERACAO } from '../paths'
import { TEXTO_DA_OPERACAO_SEM_DADO_DE_PESSOA, textoDaFalha } from '../textos'

/**
 * Os itens da navegação da operação (Tech Spec da A0b, seção 9). Cada item nasce com a tela dele (`docs/interface.md`
 * 11.1): Escolas chegou na tarefa 6.0, e Uso na 8.0.
 */
const ITENS_DA_NAVEGACAO: readonly PropsDoItem[] = [
  { rotulo: 'Escolas', rota: ROTAS_DA_OPERACAO.inicio, endereco: INICIO_DA_OPERACAO },
  { rotulo: 'Uso', rota: ROTAS_DA_OPERACAO.uso, endereco: USO_DA_OPERACAO },
]

interface PropsDoItem {
  readonly rotulo: string
  /** A rota relativa à área, que diz se a pessoa está nela. */
  readonly rota: string
  /** O endereço do link, pela raiz: `/operacao`, e não `/operacao/` com a barra no fim (`paths.ts`). */
  readonly endereco: string
}

/**
 * Um item da navegação. O selecionado não é só cor: leva o sublinhado de 3 px em `azul` sobre o fio de 2 px da lista (o
 * mesmo desenho das `Abas`) e o `aria-current`, que o leitor de tela anuncia. 44 px de altura em todo tamanho de tela.
 */
function ItemDaNavegacao({ rotulo, rota, endereco }: PropsDoItem) {
  const [aqui] = useRoute(rota)
  return (
    <Link
      to={endereco}
      aria-current={aqui ? 'page' : undefined}
      className={`t-rotulo relative inline-flex min-h-11 items-center px-3 ${aqui ? 'text-azul-texto' : 'text-sutil hover:text-tinta'}`}
    >
      {rotulo}
      {aqui && <span aria-hidden="true" className="absolute inset-x-2 -bottom-0.5 h-0.75 rounded-full bg-azul" />}
    </Link>
  )
}

/**
 * A barra de topo "Operação Turmma" (Tech Spec da X1, seção 9; `docs/interface.md` 5a e 11.4): a pele é a do produto, em
 * `fundo` com a borda de baixo de 2 px, nos dois temas, e o nome diz que ali é a operação, para ninguém confundir com a
 * tela de uma escola. 72 px a partir de 768 px, 56 no celular, contando a borda; quando a conta não cabe na linha, ela
 * desce, e a barra cresce. O anel de foco é o `foco` de 3 px de toda peça, sobre o `fundo` claro.
 */
function Barra({ children }: { children?: ReactNode }) {
  return (
    <header className="flex min-h-14 items-center border-b-2 border-borda bg-fundo text-tinta md:min-h-18">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2 sm:px-6">
        <p className="t-cartao inline-flex shrink-0 items-center gap-2">
          <img src="/marca/turmma-pinta.svg" alt="" width={24} height={24} className="h-6 w-6 shrink-0" />
          Operação Turmma
        </p>
        {children}
      </div>
    </header>
  )
}

/**
 * A casca das telas de fora da sessão da operação: entrar e o segundo fator. Coluna única a partir de 360 px, presa em
 * `max-w-md` para o formulário de dois campos não se espalhar no Chromebook (regra 50, item 2a). Sem "Sair": não há
 * sessão ainda.
 */
export function CascaPublicaDaOperacao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-fundo text-tinta">
      <Barra />
      <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-6 sm:px-6">
        <h1 className="t-titulo break-words">{titulo}</h1>
        {children}
      </main>
    </div>
  )
}

interface PropsDaCasca {
  /** O nome do operador, quando o `/eu` já respondeu. */
  readonly nome?: string | undefined
  readonly aoSair: () => void
  readonly saindo: boolean
  readonly children: ReactNode
}

/**
 * A casca da operação com a sessão aberta: a barra com o nome de quem entrou e o **Sair** a um clique, em toda tela,
 * do mesmo tamanho de qualquer outra ação (D59; PRD da A0, seção 6), e embaixo dela a página (X2, 14.0): o título
 * "Operação" à vista, a linha fixa de que a operação não vê dado de pessoa (D76) e a navegação, desenhada como abas.
 * Escolas e Uso são as duas telas dentro dela; o título da aba do navegador diz qual (`useTituloDaPagina`).
 *
 * A **Aparência** (RF3) fica na barra, ao lado do nome e do "Sair", com o nome só para o leitor de tela: a operação não
 * tem lateral, e a barra é o menu da conta do operador. Quando a largura não dá, a conta desce para uma segunda linha, e nada passa
 * da largura da tela (regra 50, item 2a). As telas de fora da sessão (entrar e o segundo fator) seguem o sistema, sem
 * controle: ninguém escolheu nada ainda.
 *
 * A partir de 768 px a janela é da página: a barra, o cabeçalho e as abas ficam onde estão e **a lista rola por dentro**
 * (`RegiaoDaLista`), em vez de a página inteira rolar (RF23).
 */
export function CascaDaOperacao({ nome, aoSair, saindo, children }: PropsDaCasca) {
  return (
    <div className="min-h-screen bg-fundo text-tinta md:flex md:h-svh md:min-h-0 md:flex-col">
      <Barra>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Aparencia rotuloVisivel={false} />
          {nome !== undefined && <span className="min-w-0 truncate text-apoio">{nome}</span>}
          <button type="button" onClick={aoSair} disabled={saindo} className={`${CLASSES_DO_BOTAO_SECUNDARIO} shrink-0`}>
            {saindo ? 'Saindo…' : 'Sair'}
          </button>
        </div>
      </Barra>
      <main className="mx-auto flex w-full max-w-[1200px] min-w-0 flex-col gap-4 px-4 py-6 md:min-h-0 md:flex-1 md:px-8">
        <div className="min-w-0">
          <h1 className="t-titulo break-words text-tinta">Operação</h1>
          <p className="mt-1 flex items-start gap-2 text-sm text-sutil">
            <Lock aria-hidden="true" size={18} strokeWidth={2.5} className="mt-px shrink-0" />
            <span className="min-w-0 break-words">{TEXTO_DA_OPERACAO_SEM_DADO_DE_PESSOA}</span>
          </p>
        </div>
        <nav aria-label="Operação" className="flex min-w-0 flex-wrap gap-x-1 border-b-2 border-borda">
          {ITENS_DA_NAVEGACAO.map((item) => (
            <ItemDaNavegacao key={item.rota} {...item} />
          ))}
        </nav>
        {children}
      </main>
    </div>
  )
}

/**
 * O erro de uma tela da operação: o 503 diz "O Turmma está indisponível agora…" e a tela **fica** (Tech Spec, seção 9),
 * com "Tentar de novo". O alerta é só a mensagem; o botão fica fora dele.
 */
export function ErroDaOperacao({ erro, aoTentarDeNovo, tentando = false }: { erro: unknown; aoTentarDeNovo: () => void; tentando?: boolean }) {
  return (
    <div className="rounded-cartao border-2 border-erro bg-erro-cx p-4">
      <p role="alert" className="t-apoio text-erro">
        {textoDaFalha(erro)}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Botao onClick={aoTentarDeNovo} disabled={tentando}>
          Tentar de novo
        </Botao>
        <span role="status" className="t-apoio text-erro">
          {tentando ? 'Tentando de novo…' : ''}
        </span>
      </div>
    </div>
  )
}
