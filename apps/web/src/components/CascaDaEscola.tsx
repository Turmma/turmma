import { useQuery } from '@tanstack/react-query'
import { Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react'
import { Link, useLocation } from 'wouter'
import { consultaEu } from '../api/eu'
import { esquecerEspelhosDeOutroDono } from '../api/espelho-da-fila'
import { assinarSessao, estadoDaSessao, lembrarQuemEsta, sair } from '../api/sessao'
import { MENU_DA_PESSOA, NAVEGACAO, NOME_DO_RODAPE, RODAPE_DA_LATERAL, type ItemDaNavegacao } from '../areas/navigation'
import { ehTelaDeFoco, ROTAS } from '../paths'
import { NOME_DO_PAPEL } from '../roles'
import { useInatividade } from '../sessao/idle-timeout'
import { ContextoDaAncoraDoSino, type AncoraDoSino } from './sino-anchor-context'
import { BarraDeBaixo, ondeFicamOsItens } from './BarraDeBaixo'
import { CLASSES_DO_BOTAO_SECUNDARIO } from './ui/button-variants'
import { ContextoDaGaveta, type Gaveta } from './drawer-context'
import { Dica, ItemDaLateral, ListaDeItens } from './itens-da-lateral'
import { guardarRecolhida, lerRecolhida } from './lateral-recolhida'
import { Marca } from './ui/Marca'
import { MenuDaPessoa } from './MenuDaPessoa'
import { ContextoDaSaida, type SaidaDaCasca } from './sign-out-context'
import { SeletorDeEscola } from './SeletorDeEscola'

/**
 * As três larguras da casca (`docs/interface.md` 11.1, "Responsivo"; D51): abaixo de 768 px, a barra no topo com a
 * gaveta; de 768 a 1023 px, o trilho de 88 px, que abre a lateral por cima do conteúdo; a partir de 1024 px (o
 * Chromebook de 1366 × 768 cai aqui), a lateral aberta de 256 px, que recolhe para o trilho por escolha.
 *
 * Decidido em JavaScript, e não só no CSS, para existir na página **uma** lateral por vez: esconder as outras com
 * `display: none` deixaria dois seletores de escola e duas navegações no DOM, com os mesmos ids.
 */
type Faixa = 'estreita' | 'media' | 'larga'

const CONSULTA_MEDIA = '(min-width: 768px)'
const CONSULTA_LARGA = '(min-width: 1024px)'

function faixaDeAgora(): Faixa {
  if (window.matchMedia(CONSULTA_LARGA).matches) return 'larga'
  return window.matchMedia(CONSULTA_MEDIA).matches ? 'media' : 'estreita'
}

function assinarFaixa(aoMudar: () => void): () => void {
  const consultas = [CONSULTA_MEDIA, CONSULTA_LARGA].map((consulta) => window.matchMedia(consulta))
  for (const consulta of consultas) consulta.addEventListener('change', aoMudar)
  return () => {
    for (const consulta of consultas) consulta.removeEventListener('change', aoMudar)
  }
}

/** O botão só de ícone da lateral: 44 px, o nome para o leitor de tela e, no computador, a dica. */
const CLASSE_DO_BOTAO_DE_ICONE = 'group relative flex size-11 shrink-0 items-center justify-center rounded-controle text-sutil hover:bg-fundo-suave hover:text-tinta'

interface DadosDaPessoa {
  readonly nome: string
  readonly papel: string
}

interface PropsDaLateralAberta {
  readonly pessoa: DadosDaPessoa | undefined
  readonly itens: (typeof NAVEGACAO)[keyof typeof NAVEGACAO]
  /** O rodapé fixo (aluno: "Privacidade") e os links do menu da pessoa (professor: "Meus dados"); vazios, nada aparece. */
  readonly rodape: readonly ItemDaNavegacao[]
  readonly menuDaPessoa: readonly ItemDaNavegacao[]
  readonly seletor: ReactNode
  /** O botão do topo, ao lado da marca: "Recolher a lateral" no computador, "Fechar o menu" na gaveta. */
  readonly botaoDoTopo: ReactNode
  readonly aoSair: () => void
  readonly saindo: boolean
}

/**
 * A lateral aberta, de 256 px no computador e dentro da gaveta: marca, escola, navegação e a pessoa no pé. Só o alto rola
 * (marca, escola e navegação), e é o `flex-1 min-h-0` dele que segura o pé, com a pessoa, a Aparência e o
 * "Sair", dentro da janela em qualquer altura (RF15, A18; D59): o alto encolhe e rola, o pé não. A folga de 6 px do alto
 * guarda o anel de foco (3 px de contorno e 2 de afastamento), que o `overflow` cortaria.
 */
function LateralAberta({ pessoa, itens, rodape, menuDaPessoa, seletor, botaoDoTopo, aoSair, saindo }: PropsDaLateralAberta) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-3">
      <div className="-m-1.5 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-1.5">
        <div className="flex items-center justify-between gap-2">
          <Link to={ROTAS.inicio} aria-label="Turmma, página inicial" className="rounded-controle px-2 py-1.5 hover:bg-fundo-suave">
            <Marca />
          </Link>
          {botaoDoTopo}
        </div>
        <div>{seletor}</div>
        {itens.length > 0 && (
          <nav aria-label="Seções">
            <ul className="flex flex-col gap-2">
              {itens.map((item) => (
                <ItemDaLateral key={item.caminho} item={item} trilho={false} />
              ))}
            </ul>
          </nav>
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-2">
        <ListaDeItens itens={rodape} rotulo={NOME_DO_RODAPE} trilho={false} />
        <MenuDaPessoa nome={pessoa?.nome} papel={pessoa?.papel} aoSair={aoSair} saindo={saindo} itens={menuDaPessoa} />
      </div>
    </div>
  )
}

interface PropsDoTrilho {
  readonly itens: (typeof NAVEGACAO)[keyof typeof NAVEGACAO]
  readonly rodape: readonly ItemDaNavegacao[]
  readonly menuDaPessoa: readonly ItemDaNavegacao[]
  readonly botaoDeAbrir: RefObject<HTMLButtonElement | null>
  readonly aoAbrir: () => void
  readonly lateralAberta: boolean
  readonly aoSair: () => void
  readonly saindo: boolean
}

/**
 * O trilho de 88 px (D80): a pinta e o "Abrir a lateral", de 44 px, e os ícones com a dica de cada um e o "Sair", do
 * tamanho de um lugar (52 px). Nenhum rótulo sobra cortado (P04): ou aparece inteiro, na dica, ou não aparece. Não anima a
 * largura. Não rola (a dica `absolute` seria cortada): o "Sair" fica à vista porque a pilha inteira cabe em 600 px de
 * altura, o que o e2e de A18 mede; um lugar a mais na coordenação pede medir de novo.
 */
function Trilho({ itens, rodape, menuDaPessoa, botaoDeAbrir, aoAbrir, lateralAberta, aoSair, saindo }: PropsDoTrilho) {
  return (
    <div className="sticky top-0 z-10 flex h-screen w-22 shrink-0 flex-col items-center gap-3 self-start border-r-2 border-borda bg-lateral py-3">
      <Link to={ROTAS.inicio} aria-label="Turmma, página inicial" className="flex size-11 items-center justify-center rounded-controle hover:bg-fundo-suave">
        <img src="/marca/turmma-pinta.svg" alt="" width={28} height={28} className="h-7 w-7" />
      </Link>
      <button ref={botaoDeAbrir} type="button" onClick={aoAbrir} aria-expanded={lateralAberta} className={CLASSE_DO_BOTAO_DE_ICONE}>
        <PanelLeftOpen aria-hidden="true" size={20} strokeWidth={2.5} />
        <span className="sr-only">Abrir a lateral</span>
        <Dica>Abrir a lateral</Dica>
      </button>
      {itens.length > 0 && (
        <nav aria-label="Seções">
          <ul className="flex flex-col items-center gap-2">
            {itens.map((item) => (
              <ItemDaLateral key={item.caminho} item={item} trilho />
            ))}
          </ul>
        </nav>
      )}
      <div className="mt-auto flex shrink-0 flex-col items-center gap-2">
        <ListaDeItens itens={rodape} rotulo={NOME_DO_RODAPE} trilho />
        <MenuDaPessoa aoSair={aoSair} saindo={saindo} itens={menuDaPessoa} trilho />
      </div>
    </div>
  )
}

/**
 * A casca da escola, igual nos três papéis (`docs/interface.md` 11.1; D72, D73): a lateral com a marca, o seletor de
 * escola (regra 50, item 13), a navegação do papel (`areas/navigation.ts`) e a pessoa no rodapé, com o "Sair" a um
 * clique (P18, D59). O conteúdo da rota vem no `<main>`, em coluna, na moldura de 1200 px, com a margem de 16 px no
 * celular e 32 px a partir de 768 px (`docs/interface.md` 9.3; P03).
 *
 * Abaixo de 768 px a lateral vira **gaveta**, num `dialog` modal: o navegador prende o foco nela, o Esc fecha, e o que
 * está atrás fica inerte. A barra do topo, de 56 px, mostra o botão do menu, a pinta, a escola (cortada com reticências
 * quando não cabe) e o **Sair**, que continua a um toque também no celular (D59). Os itens de navegação do professor e do
 * aluno (de um a quatro) ficam na **barra de baixo**, fixa, e saem da gaveta, que leva o resto: a escola, o
 * rodapé e a conta. A coordenação, com os quatro lugares dela (X2), também fica na barra de baixo; só quem passa de quatro itens
 * mantém os itens na gaveta (`ondeFicamOsItens`, `MAXIMO_NA_BARRA`). A gaveta fecha ao escolher
 * um item, e fecha sozinha quando uma fronteira de erro assume a tela (`FronteiraDaArea`).
 *
 * Esta é a única peça que existe em toda tela com sessão, e por isso é daqui que saem o relógio de inatividade (RF13
 * do F1) e a memória de quem está na aba, que o login por cima usa para reconhecer quem volta. Os dois dependem do
 * `/v1/eu`, que é a mesma consulta da navegação.
 *
 * "Sair" encerra a sessão na API, o que apaga o cookie de renovação, e só então volta à entrada: no Chromebook do
 * carrinho, o aluno seguinte não herda nada do anterior.
 */
export function CascaDaEscola({ children }: { children: ReactNode }) {
  const [caminho, navegar] = useLocation()
  const [saindo, definirSaindo] = useState(false)
  const estado = useSyncExternalStore(assinarSessao, estadoDaSessao)
  const eu = useQuery(consultaEu)
  const dados = eu.data
  const faixa = useSyncExternalStore(assinarFaixa, faixaDeAgora)
  const [recolhida, definirRecolhida] = useState(lerRecolhida)
  const [gavetaAberta, definirGavetaAberta] = useState(false)
  const gaveta = useRef<HTMLDialogElement>(null)
  const botaoDeAbrir = useRef<HTMLButtonElement>(null)
  const botaoDeRecolher = useRef<HTMLButtonElement>(null)
  // Recolher ou abrir troca a lateral inteira, e o botão que tinha o foco sai da página com ela: o foco vai para o
  // botão que faz o contrário, e não se perde no `body`.
  const focarAposTrocar = useRef(false)

  useEffect(() => {
    if (dados === undefined) return
    // Outra pessoa entrou depois de a sessão anterior vencer: é o Chromebook do carrinho passando de mão. A tela que
    // estava aberta sai da frente dela, e com ela o que a pessoa anterior tinha escrito (RF13 do F1).
    if (lembrarQuemEsta(dados)) navegar(ROTAS.inicio, { replace: true })
    // A escolha de prova que a pessoa anterior deixou no espelho não fica ao alcance de quem entrou, abra ela uma atividade ou não (53.0).
    esquecerEspelhosDeOutroDono(dados.usuarioId)
  }, [dados, navegar])
  // Com a sessão já vencida, o relógio para: quem conta o tempo daí em diante é o login por cima da tela.
  useInatividade({ inatividadeMin: dados?.inatividadeMin, ativa: estado === 'aberta' })

  const fecharGaveta = useCallback(() => {
    // `close()` devolve o foco ao botão que abriu a gaveta, e o `onClose` do `dialog` atualiza o estado. Com a gaveta
    // já fechada, não faz nada.
    gaveta.current?.close()
  }, [])
  const contextoDaGaveta = useMemo<Gaveta>(() => ({ fechar: fecharGaveta }), [fecharGaveta])
  // A âncora do sino: o elemento vazio de cada largura (`sino-anchor-context.ts`). Estado, e não ref: o sino só se desenha quando ele existe.
  const [ancora, definirAncora] = useState<HTMLElement | null>(null)
  const contextoDaAncora = useMemo<AncoraDoSino>(() => ({ elemento: ancora }), [ancora])

  function abrirGaveta(): void {
    // Com a gaveta aberta, o resto da página fica inerte: o botão que a abre não é tocado duas vezes.
    gaveta.current?.showModal()
    definirGavetaAberta(true)
  }

  // A gaveta não sobrevive à troca de rota, à de pessoa (o login por cima) nem à de largura: a tela nova aparece sem nada por
  // cima dela. A troca de escola pelo seletor a fecha porque muda a rota ou a pessoa, e não pela escola em si; quem prova isso é o
  // e2e `areas.spec.ts › troca de escola pelo seletor…`. O usuário entra nas dependências só para disparar o fechamento.
  // A pessoa que a consulta ainda não trouxe (`undefined`) não é outra pessoa: o `/v1/eu` que volta depois do toque no menu
  // (CPU lenta, rede de escola) passa de ninguém a alguém e deixa a gaveta onde está. Só a troca de uma pessoa por outra a fecha.
  const usuarioDaSessao = dados?.usuarioId
  const usuarioDaGaveta = useRef(usuarioDaSessao)
  useEffect(() => {
    if (usuarioDaSessao === undefined) return
    const trocouDePessoa = usuarioDaGaveta.current !== undefined && usuarioDaGaveta.current !== usuarioDaSessao
    usuarioDaGaveta.current = usuarioDaSessao
    if (trocouDePessoa) fecharGaveta()
  }, [usuarioDaSessao, fecharGaveta])
  const caminhoDaGaveta = useRef(caminho)
  useEffect(() => {
    if (caminhoDaGaveta.current === caminho) return
    caminhoDaGaveta.current = caminho
    fecharGaveta()
  }, [caminho, fecharGaveta])
  // Entrar na largura do computador desmonta a gaveta sem o `onClose`: o estado acompanha já no render, como a React
  // recomenda para estado que depende de outro valor, e não num efeito que pintaria a tela duas vezes. Entre o celular e
  // o trilho a gaveta continua montada, e aberta se estava: o estado fica como está.
  const [faixaDaGaveta, definirFaixaDaGaveta] = useState(faixa)
  if (faixaDaGaveta !== faixa) {
    definirFaixaDaGaveta(faixa)
    if (faixa === 'larga') definirGavetaAberta(false)
  }

  useEffect(() => {
    if (!focarAposTrocar.current) return
    focarAposTrocar.current = false
    ;(recolhida ? botaoDeAbrir : botaoDeRecolher).current?.focus()
  }, [recolhida])

  function recolher(valor: boolean): void {
    focarAposTrocar.current = true
    definirRecolhida(valor)
    guardarRecolhida(valor)
  }

  async function encerrar(): Promise<void> {
    if (saindo) return
    definirSaindo(true)
    // `sair` não lança: a sessão desta aba é esquecida mesmo se a API não respondeu, e a entrada é o lugar certo de
    // qualquer jeito. Quando o encerramento não foi confirmado, é lá que o aviso aparece.
    await sair()
    navegar(ROTAS.entrar, { replace: true })
  }
  const aoSair = () => void encerrar()
  const saida: SaidaDaCasca = { sair: aoSair, saindo }

  const itens = dados === undefined ? [] : NAVEGACAO[dados.papel]
  // Só abaixo de 768 px os itens saem da gaveta: de 768 a 1023 px o trilho abre por cima com todos eles (A20).
  const naBarraDeBaixo = faixa === 'estreita' && ondeFicamOsItens(itens) === 'barra'
  const rodape = dados === undefined ? [] : RODAPE_DA_LATERAL[dados.papel]
  const menuDaPessoa = dados === undefined ? [] : MENU_DA_PESSOA[dados.papel]
  const pessoa = dados === undefined ? undefined : { nome: dados.nome, papel: NOME_DO_PAPEL[dados.papel] }
  const seletor = dados !== undefined && <SeletorDeEscola escolaAtual={dados.escola.nome} acessos={dados.acessos} usuarioAtual={dados.usuarioId} />

  const conteudo = (
    <main className="mx-auto flex w-full max-w-[1200px] min-w-0 flex-1 flex-col gap-6 px-4 pt-4 pb-[calc(var(--barra-baixo,0px)+2rem)] md:px-8 md:pt-5">
      {/* A âncora do sino, no canto de cima do conteúdo (a partir de 768 px); vazia, não ocupa nada. Abaixo disso ela está na barra do topo. */}
      {faixa !== 'estreita' && <div ref={definirAncora} data-ancora-do-sino="" className="-mb-2 flex justify-end empty:hidden" />}
      {children}
    </main>
  )

  // A tela de foco (a introdução de cada papel): sem lateral, trilho, barra do topo, gaveta nem barra de baixo. Fica o `<main>`,
  // o "Sair" (que a `TelaDeFoco` desenha pelo contexto) e, acima, o relógio de inatividade e a memória de quem está na aba.
  if (ehTelaDeFoco(caminho)) {
    return (
      <ContextoDaSaida value={saida}>
        <main className="flex min-h-screen w-full min-w-0 flex-col bg-fundo px-4 py-4 text-tinta md:px-8 md:py-6">{children}</main>
      </ContextoDaSaida>
    )
  }

  const gavetaNaPagina = faixa !== 'larga' && (
    // O `dialog` fica na página fechado e só abre por `showModal()`: fechado, é `display: none`, e nem o leitor de tela
    // nem o Tab o alcançam. O clique fora da lateral cai no próprio `dialog` (o fundo escurecido) e fecha.
    <dialog
      ref={gaveta}
      aria-label="Menu"
      onClose={() => definirGavetaAberta(false)}
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) fecharGaveta()
      }}
      className="m-0 h-full max-h-none w-[260px] max-w-[85vw] bg-lateral p-0 text-tinta shadow-flutua"
    >
      <LateralAberta
        pessoa={pessoa}
        itens={naBarraDeBaixo ? [] : itens}
        rodape={rodape}
        menuDaPessoa={menuDaPessoa}
        seletor={seletor}
        aoSair={aoSair}
        saindo={saindo}
        botaoDoTopo={
          <button type="button" onClick={fecharGaveta} className={CLASSE_DO_BOTAO_DE_ICONE}>
            <X aria-hidden="true" size={20} strokeWidth={2.5} />
            <span className="sr-only">Fechar o menu</span>
          </button>
        }
      />
    </dialog>
  )

  return (
    <ContextoDaAncoraDoSino value={contextoDaAncora}>
      <ContextoDaGaveta value={contextoDaGaveta}>
        <ContextoDaSaida value={saida}>
        <div className="flex min-h-screen flex-col bg-fundo text-tinta md:flex-row">
          {faixa === 'estreita' && (
            <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b-2 border-borda bg-fundo px-2">
              <button
                type="button"
                onClick={abrirGaveta}
                aria-haspopup="dialog"
                aria-expanded={gavetaAberta}
                className={CLASSE_DO_BOTAO_DE_ICONE}
              >
                <Menu aria-hidden="true" size={20} strokeWidth={2.5} />
                <span className="sr-only">Abrir o menu</span>
              </button>
              <Link to={ROTAS.inicio} aria-label="Turmma, página inicial" className="flex size-11 shrink-0 items-center justify-center rounded-controle hover:bg-fundo-suave">
                <img src="/marca/turmma-pinta.svg" alt="" width={24} height={24} className="h-6 w-6" />
              </Link>
              <p className="t-cartao min-w-0 flex-1 truncate">{dados?.escola.nome}</p>
              <div ref={definirAncora} data-ancora-do-sino="" className="flex shrink-0 empty:hidden" />
              <button type="button" onClick={aoSair} disabled={saindo} className={`${CLASSES_DO_BOTAO_SECUNDARIO} shrink-0`}>
                {saindo ? 'Saindo…' : 'Sair'}
              </button>
            </header>
          )}
          {faixa === 'larga' && !recolhida ? (
            <div className="sticky top-0 flex h-screen w-64 shrink-0 flex-col self-start border-r-2 border-borda bg-lateral">
              <LateralAberta
                pessoa={pessoa}
                itens={itens}
                rodape={rodape}
                menuDaPessoa={menuDaPessoa}
                seletor={seletor}
                aoSair={aoSair}
                saindo={saindo}
                botaoDoTopo={
                  <button ref={botaoDeRecolher} type="button" onClick={() => recolher(true)} className={CLASSE_DO_BOTAO_DE_ICONE}>
                    <PanelLeftClose aria-hidden="true" size={20} strokeWidth={2.5} />
                    <span className="sr-only">Recolher a lateral</span>
                  </button>
                }
              />
            </div>
          ) : (
            faixa !== 'estreita' && (
              <Trilho
                itens={itens}
                rodape={rodape}
                menuDaPessoa={menuDaPessoa}
                botaoDeAbrir={botaoDeAbrir}
                // No computador, abrir desfaz a escolha de recolher; entre 768 e 1023 px, a lateral abre por cima.
                aoAbrir={() => (faixa === 'larga' ? recolher(false) : abrirGaveta())}
                lateralAberta={faixa === 'media' && gavetaAberta}
                aoSair={aoSair}
                saindo={saindo}
              />
            )
          )}
          {gavetaNaPagina}
          {conteudo}
          {naBarraDeBaixo && <BarraDeBaixo itens={itens} />}
        </div>
        </ContextoDaSaida>
      </ContextoDaGaveta>
    </ContextoDaAncoraDoSino>
  )
}
