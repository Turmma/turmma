import type { ItemDoPedido } from '@educa/shared'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'wouter'
import { consultaPedidosDoTitular } from './api/privacidade'
import { Botao } from '../../../components/ui/Botao'
import { CLASSES_DO_LINK_SECUNDARIO } from '../../../components/ui/button-variants'
import { Anuncio } from '../../../components/dialogs'
import { EstadoCarregando, EstadoErro, EstadoVazio } from '../../../components/states'
import { Faixa } from '../../../components/ui/Faixa'
import { Estado } from '../../../components/ui/SeloDeEstado'
import { Tabela, type ColunaDaTabela } from '../../../components/ui/Tabela'
import { CabecalhoDeSecao } from '../../../components/ui/Tela'
import { mensagemDoErro } from '../../../api/client'
import { caminhoDoPedidoDoTitular, ROTAS_DA_COORDENACAO } from '../../../paths'
import { formatarData } from '../../../format'
import { RegistrarPedido } from './RegistrarPedido'
import { prazoDoPedido, textoDoPrazo } from './textos-do-pedido'
import {
  AVISO_DO_ALUNO_DA_LISTA,
  hojeEmSaoPaulo,
  ordenarOsPedidos,
  ROTULO_DE_QUEM_PEDIU,
  ROTULO_DO_TIPO,
  SITUACAO_DO_PEDIDO,
  TEXTO_DO_TITULAR_ELIMINADO,
  textoDasTurmas,
} from './textos-dos-pedidos'

/** Na turma da lista, o titular eliminado não tem turma para mostrar: o nome e a turma saíram do sistema com ele (RF14). */
const TEXTO_SEM_TURMA_DO_ELIMINADO = 'Não consta'

/**
 * As colunas da lista. `hoje` é o dia de São Paulo (`AAAA-MM-DD`): o prazo de cada linha sai dele e da chegada do pedido
 * (`prazoDoPedido`), sem chamada a mais à API.
 *
 * - **A linha inteira abre o detalhe** (X2, 12.0): o link fica na célula da pessoa, e o `after:absolute after:inset-0` o
 *   estende pela linha, que a `Tabela` deixa `relative`. É um link só por linha, com o tipo do pedido no nome para quem
 *   ouve (uma pessoa pode ter dois pedidos; o texto à vista continua só o nome), e o endereço leva só o id do pedido.
 * - **O prazo é um selo de estado**: o vencido é `erro`, diz "vencido há N dias" e leva o ícone da família; estado nunca é só cor.
 */
function colunasDosPedidos(hoje: string): readonly [ColunaDaTabela<ItemDoPedido>, ...ColunaDaTabela<ItemDoPedido>[]] {
  return [
    {
      chave: 'pessoa',
      titulo: 'Pessoa',
      celula: (pedido) => {
        const nome = pedido.titular?.nome ?? TEXTO_DO_TITULAR_ELIMINADO
        return (
          <Link
            to={caminhoDoPedidoDoTitular(pedido.id)}
            aria-label={`${nome}, ${ROTULO_DO_TIPO[pedido.tipo]}`}
            className="inline-flex min-h-11 items-center text-caramelo-texto underline after:absolute after:inset-0"
          >
            {nome}
          </Link>
        )
      },
    },
    { chave: 'turma', titulo: 'Turma', celula: (pedido) => (pedido.titular === null ? TEXTO_SEM_TURMA_DO_ELIMINADO : textoDasTurmas(pedido.titular.turmas)) },
    { chave: 'tipo', titulo: 'Pedido', celula: (pedido) => ROTULO_DO_TIPO[pedido.tipo] },
    { chave: 'solicitante', titulo: 'Quem pediu', celula: (pedido) => ROTULO_DE_QUEM_PEDIU[pedido.solicitante] },
    { chave: 'chegouEm', titulo: 'Chegou em', celula: (pedido) => formatarData(pedido.chegouEm) },
    {
      chave: 'prazo',
      titulo: 'Prazo',
      celula: (pedido) => {
        const prazo = textoDoPrazo(prazoDoPedido(pedido, hoje))
        return <Estado familia={prazo.familia}>{prazo.texto}</Estado>
      },
    },
    {
      chave: 'situacao',
      titulo: 'Situação',
      celula: (pedido) => {
        const situacao = SITUACAO_DO_PEDIDO[pedido.estado]
        return <Estado familia={situacao.familia}>{situacao.texto}</Estado>
      },
    },
  ]
}

/**
 * A aba "Pedidos" (F3, 16.0; X2, 12.0; RF10, RF14, RF16, RF20 e RF22): os pedidos dos titulares desta escola, o mais recente
 * primeiro, com o prazo de cada um, e o "Registrar pedido" que abre a busca e a confirmação. A linha inteira abre o detalhe do
 * pedido (17.0, `DetalheDoPedido.tsx`).
 *
 * - **Sempre relê ao abrir**: a lista não fica guardada fora da tela (`gcTime: 0`, em `api/privacidade.ts`), então cada
 *   abertura é uma leitura nova. Outra pessoa da coordenação pode ter registrado, e a eliminação muda de estado sozinha (o
 *   prazo de 7 dias passa na fila, não na tela). Nenhuma leitura sai sozinha depois: nem pelo foco, nem pela rede.
 * - **Os quatro estados**: carregando, erro com "Tentar de novo", vazio (um convite: nenhum pedido ainda) e o dado.
 * - **Páginas de 50**: "Ver mais pedidos" lê a seguinte. A API entrega cada página na chegada mais recente primeiro, com o id no
 *   empate, que é a ordem da tela: o pedido recém-registrado abre a primeira página, e a seguinte só traz os mais antigos.
 * - **Aviso fixo** do aluno da lista: ele não tem conta e não aparece na busca, e o caminho dele é a lista da turma.
 */
export default function Pedidos() {
  const consulta = useInfiniteQuery(consultaPedidosDoTitular)
  const [anuncio, definirAnuncio] = useState('')
  const pedidos = useMemo(() => ordenarOsPedidos((consulta.data?.pages ?? []).flatMap((pagina) => pagina.itens)), [consulta.data])
  const hoje = hojeEmSaoPaulo()
  const colunas = useMemo(() => colunasDosPedidos(hoje), [hoje])

  if (consulta.isPending) return <EstadoCarregando rotulo="Carregando os pedidos…" />
  // Sem página nenhuma e fora do carregamento, só resta a falha. A falha de "Ver mais" fica abaixo da lista, com o que já foi lido.
  if (consulta.data === undefined) {
    return <EstadoErro erro={consulta.error} tentando={consulta.isFetching} aoTentarDeNovo={() => void consulta.refetch({ cancelRefetch: false })} />
  }

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby="titulo-dos-pedidos">
      <CabecalhoDeSecao
        id="titulo-dos-pedidos"
        titulo="Pedidos dos titulares"
        apoio="Acesso, portabilidade, compartilhamento, correção e eliminação de dados, pedidos pela própria pessoa ou pelo responsável."
        acao={<RegistrarPedido aoRegistrado={definirAnuncio} />}
      />
      <Anuncio texto={anuncio} />
      <Faixa>{AVISO_DO_ALUNO_DA_LISTA}</Faixa>
      <div>
        <Link to={ROTAS_DA_COORDENACAO.estrutura} className={CLASSES_DO_LINK_SECUNDARIO}>
          Ir para as turmas
        </Link>
      </div>
      {pedidos.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum pedido registrado"
          descricao="Quando uma pessoa ou o responsável pedir acesso, correção ou eliminação dos dados, registre aqui: a Turmma monta o arquivo, guarda a lista de quem recebeu dado e agenda a eliminação."
        />
      ) : (
        <Tabela rotulo="Pedidos dos titulares" colunas={colunas} linhas={pedidos} chaveDaLinha={(pedido) => pedido.id} />
      )}
      {consulta.isFetchNextPageError && (
        <p role="alert" className="rounded-controle border border-erro bg-erro-cx p-3 break-words text-erro">
          {mensagemDoErro(consulta.error)}
        </p>
      )}
      {consulta.hasNextPage && (
        <div className="flex flex-wrap items-center gap-3">
          <Botao variante="secundario" disabled={consulta.isFetchingNextPage} onClick={() => void consulta.fetchNextPage()}>
            {consulta.isFetchingNextPage ? 'Carregando…' : 'Ver mais pedidos'}
          </Botao>
        </div>
      )}
    </section>
  )
}
