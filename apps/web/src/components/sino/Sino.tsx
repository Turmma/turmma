import { Bell } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useSearch } from 'wouter'
import { Aviso } from '../ui/Aviso'
import { Botao } from '../ui/Botao'
import { CLASSES_DO_LINK_SECUNDARIO } from '../ui/button-variants'
import { Contador } from '../ui/Contador'
import { EstadoCarregando, EstadoErro } from '../states'
import { Icone } from '../ui/Icone'
import { Linha } from '../ui/Linha'
import { PainelLado } from '../ui/overlays/PainelLado'

/** Um item da lista "Esperando você": o que é, por que importa e a tela que o resolve. */
export interface ItemDoSino {
  readonly id: string
  readonly titulo: string
  readonly detalhe: string
  /** Vai para o grupo "Urgente"; os outros vão para o grupo deles (`grupo`) ou, sem ele, para "Da escola". */
  readonly urgente: boolean
  /**
   * O título do grupo do item que não é urgente: a turma, no sino do professor (X3). Os itens de mesmo `grupo` ficam juntos,
   * e os grupos seguem a ordem em que o primeiro item de cada um aparece em `itens`. Sem ele, o item é "Da escola".
   */
  readonly grupo?: string
  /** O endereço da tela que resolve o item, relativo à área onde o sino está. */
  readonly para: string
  /** Um número que o item carrega (as turmas sem professor), com o que ele conta, em texto, para o leitor de tela. */
  readonly contador?: { readonly n: number; readonly oQueConta: string }
}

/** Um link do pé do sino: o texto e o endereço da tela, relativo à área onde o sino está. */
export interface LinkDoPeDoSino {
  readonly rotulo: string
  readonly para: string
}

/** O pé do sino (X3): links que não são pendência, e por isso ficam fora dos itens e do contador. O título dá o nome do grupo. */
export interface PeDoSino {
  readonly titulo: string
  readonly links: readonly LinkDoPeDoSino[]
}

/** O que a leitura da lista diz: lendo, lida inteira, lida em parte (uma consulta falhou ou veio truncada), ou nada lido. */
export type SituacaoDoSino = 'carregando' | 'pronta' | 'parcial' | 'erro'

interface Props {
  readonly itens: readonly ItemDoSino[]
  readonly situacao: SituacaoDoSino
  /** A falha que explica `erro`, para a mensagem do catálogo. */
  readonly erro?: unknown
  readonly aoTentarDeNovo: () => void
  readonly tentandoDeNovo?: boolean
  readonly aoAtualizar: () => void
  readonly atualizando?: boolean
  /** Quando a lista foi lida pela última vez. Só muda quando quem usa a peça muda: ela não tem relógio. */
  readonly atualizadoEm?: Date | undefined
  /** Para onde "Ver o que falta para a escola" leva, no vazio. Sem ele, o vazio não tem o link (o sino do professor, X3). */
  readonly faltaPara?: string
  /** A frase do vazio, abaixo de "Tudo em dia". Sem ela, a da coordenação: o sino do professor diz a dele (X3). */
  readonly textoDoVazio?: string
  /** O que o aviso da lista lida em parte diz. Sem ele, "Parte da lista não carregou"; o do professor diz o que não leu (X3). */
  readonly avisoDaLeituraParcial?: string
  /** Os links do pé da lista (o professor leva dois: o que o Assistente fez e o que o Tutor viu). Sem ele, a lista não tem pé. */
  readonly pe?: PeDoSino
  /** O número de itens é um piso, porque uma leitura veio cheia e há mais (o professor, com 100 entregas esperando). Sem ele, o número é exato. */
  readonly ouMais?: boolean
}

/** O grupo dos itens que não dizem de que grupo são, e o aviso e o vazio de quem não troca o texto: os da coordenação (X2). */
const GRUPO_DA_ESCOLA = 'Da escola'
const AVISO_PARCIAL_PADRAO = 'Parte da lista não carregou'
const VAZIO_PADRAO = 'Nada espera a coordenação agora.'

/** Os itens agrupados pelo `grupo`, na ordem em que o primeiro de cada grupo aparece: a ordem dos itens é de quem monta a fila. */
function agruparPorGrupo(itens: readonly ItemDoSino[]): readonly { readonly titulo: string; readonly itens: readonly ItemDoSino[] }[] {
  const grupos = new Map<string, ItemDoSino[]>()
  for (const item of itens) {
    const titulo = item.grupo ?? GRUPO_DA_ESCOLA
    const grupo = grupos.get(titulo)
    if (grupo === undefined) grupos.set(titulo, [item])
    else grupo.push(item)
  }
  return [...grupos].map(([titulo, doGrupo]) => ({ titulo, itens: doGrupo }))
}

const HORA = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

/**
 * O nome do botão. Só duas formas existem para a lista lida: "Esperando você, N" e "Esperando você, nada". Com `ouMais`, o
 * número é um piso ("Esperando você, 100 ou mais"); sem item não há número a completar. Lista que não foi
 * lida inteira nunca diz "nada": lendo, parcial sem item e erro têm o nome do que falta, e a contagem de uma lista parcial
 * é a do que se leu.
 */
function nomeDoBotao(itens: number, situacao: SituacaoDoSino, ouMais: boolean): string {
  if (itens > 0) return `Esperando você, ${String(itens)}${ouMais ? ' ou mais' : ''}`
  if (situacao === 'carregando') return 'Esperando você, carregando'
  if (situacao === 'erro') return 'Esperando você, não carregou'
  if (situacao === 'parcial') return 'Esperando você, parte não carregou'
  return 'Esperando você, nada'
}

function GrupoDeItens({ titulo, itens }: { readonly titulo: string; readonly itens: readonly ItemDoSino[] }) {
  if (itens.length === 0) return null
  return (
    <section aria-label={titulo} className="flex min-w-0 flex-col gap-2">
      <h3 className="t-rotulo text-sutil">{titulo}</h3>
      <ul className="divide-y-2 divide-borda overflow-hidden rounded-cartao border-2 border-borda">
        {itens.map((item) => (
          <li key={item.id}>
            <Linha
              para={item.para}
              titulo={item.titulo}
              abaixo={item.detalhe}
              {...(item.contador === undefined ? {} : { fim: <Contador n={item.contador.n} oQueConta={item.contador.oQueConta} /> })}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** O pé: as linhas que levam a telas de acompanhamento, e não a uma decisão. Aparecem em qualquer situação da leitura. */
function PeDaLista({ titulo, links }: PeDoSino) {
  if (links.length === 0) return null
  return (
    <section aria-label={titulo} data-pe-do-sino="" className="flex min-w-0 flex-col gap-2">
      <h3 className="t-rotulo text-sutil">{titulo}</h3>
      <ul className="divide-y-2 divide-borda overflow-hidden rounded-cartao border-2 border-borda">
        {links.map((link) => (
          <li key={link.para}>
            <Linha para={link.para} titulo={link.rotulo} />
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * O sino da coordenação (D80; Tech Spec das telas da coordenação, seções 5 e 9): um botão "Esperando você, N" que abre a
 * lista num `PainelLado`. Recebe a lista por prop e não lê nada: quem a calcula é a área (`useFilaDaCoordenacao`), e
 * por isso a peça serve também ao sino do professor (X3).
 *
 * - **Não pisca, não soa e não anima**: o número é um `Contador` parado, e o botão não muda por tempo (D59). **Abrir a lista
 *   não faz leitura**; só "Tentar de novo" e "Atualizar" pedem (RF5).
 * - **Nunca diz "Tudo em dia" sem ter lido tudo**: a lista parcial mostra o que veio, com o aviso (por padrão, "Parte da lista
 *   não carregou"; o sino do professor diz o que não leu) e "Tentar de novo". O vazio é ícone ilustrado, sem mascote (a onça de corpo inteiro é decisão do Joaquim, seção 12).
 * - **A lista fecha ao se ir a um item**: o painel é modal, e a tela de destino nasce sem nada por cima dela.
 * - "Atualizado às HH:MM" é o que quem usa a peça entrega; a peça não tem temporizador.
 * - **Os dois sinos usam esta peça** (coordenação, X2; professor, X3). As quatro props opcionais do fim (`faltaPara`, `textoDoVazio`,
 *   `avisoDaLeituraParcial`, `pe`) e o `grupo` do item existem para o professor, e sem elas a peça é a da X2. O pé é fixo: dois
 *   links de acompanhamento que não contam no número do sino e não mudam com a leitura (carregando, erro, parcial ou em dia).
 */
export function Sino({ itens, situacao, erro, aoTentarDeNovo, tentandoDeNovo = false, aoAtualizar, atualizando = false, atualizadoEm, faltaPara, textoDoVazio = VAZIO_PADRAO, avisoDaLeituraParcial = AVISO_PARCIAL_PADRAO, pe, ouMais = false }: Props) {
  // O endereço em que a lista foi aberta. Ir a um item muda o endereço (o caminho ou só a consulta), e o painel modal sai da
  // frente da tela de destino; voltar a ele depois não o reabre.
  const [caminho] = useLocation()
  const busca = useSearch()
  const endereco = `${caminho}?${busca}`
  const [abertoEm, definirAbertoEm] = useState<string | null>(null)
  if (abertoEm !== null && abertoEm !== endereco) definirAbertoEm(null)
  const aberto = abertoEm !== null
  const definirAberto = (valor: boolean) => definirAbertoEm(valor ? endereco : null)

  const urgentes = itens.filter((item) => item.urgente)
  const gruposDosDemais = agruparPorGrupo(itens.filter((item) => !item.urgente))
  const nome = nomeDoBotao(itens.length, situacao, ouMais)

  return (
    <>
      <Botao variante="secundario" aria-label={nome} aria-haspopup="dialog" aria-expanded={aberto} onClick={() => definirAberto(true)} className="gap-2 px-3">
        <Bell aria-hidden="true" size={20} strokeWidth={2.5} />
        {/* O nome vem do `aria-label`, com o número; o texto à vista é o rótulo do botão a partir de 768 px, e abaixo disso só o ícone cabe. */}
        <span className="sr-only md:not-sr-only">Esperando você</span>
        <Contador n={itens.length} oQueConta="esperando você" ouMais={ouMais} />
      </Botao>
      {aberto && (
        <PainelLado
          titulo="Esperando você"
          aoFechar={() => definirAberto(false)}
          rodape={
            <>
              <p role="status" className="t-apoio mr-auto text-sutil">
                {atualizadoEm === undefined ? '' : `Atualizado às ${HORA.format(atualizadoEm)}`}
              </p>
              <Botao variante="secundario" disabled={atualizando} onClick={aoAtualizar}>
                {atualizando ? 'Atualizando…' : 'Atualizar'}
              </Botao>
            </>
          }
        >
          <div className="flex min-w-0 flex-col gap-4">
            {situacao === 'carregando' && <EstadoCarregando rotulo="Carregando o que espera você…" />}
            {situacao === 'erro' && <EstadoErro erro={erro} aoTentarDeNovo={aoTentarDeNovo} tentando={tentandoDeNovo} />}
            {situacao === 'parcial' && (
              <Aviso
                tom="atencao"
                acao={
                  <Botao variante="secundario" disabled={tentandoDeNovo} onClick={aoTentarDeNovo}>
                    {tentandoDeNovo ? 'Tentando de novo…' : 'Tentar de novo'}
                  </Botao>
                }
              >
                {avisoDaLeituraParcial}
              </Aviso>
            )}
            {(situacao === 'pronta' || situacao === 'parcial') && (
              <>
                <GrupoDeItens titulo="Urgente" itens={urgentes} />
                {gruposDosDemais.map((grupo) => (
                  <GrupoDeItens key={grupo.titulo} titulo={grupo.titulo} itens={grupo.itens} />
                ))}
              </>
            )}
            {situacao === 'pronta' && itens.length === 0 && (
              <div data-vazio-do-sino="" className="flex flex-col items-center gap-2 rounded-cartao border-2 border-dashed border-borda-campo bg-superficie px-4 py-10 text-center">
                <Icone nome="inicio" tamanho={48} />
                <p className="t-secao text-tinta">Tudo em dia</p>
                <p className="t-apoio max-w-prose text-apoio">{textoDoVazio}</p>
                {faltaPara !== undefined && (
                  <Link to={faltaPara} className={CLASSES_DO_LINK_SECUNDARIO}>
                    Ver o que falta para a escola
                  </Link>
                )}
              </div>
            )}
            {pe !== undefined && <PeDaLista {...pe} />}
          </div>
        </PainelLado>
      )}
    </>
  )
}
