import type { DecisaoDePedido, DecisorDaReivindicacao, PedidoDaTurma, DecisaoResponse } from '@educa/shared'
import { useRef, type ReactNode } from 'react'
import { decidirPedidos } from '../../api/pedidos'
import { CLASSES_DO_BOTAO_OFICIAL, CLASSES_DO_BOTAO_PERIGO_CHEIO, CLASSES_DO_BOTAO_SECUNDARIO } from '../ui/botao-secundario'
import { Falha, useFocoDaEtapa } from '../copia-unica'
import { Dialogo } from '../ui/sobrepostos/Dialogo'
import { useEnvioUnico } from '../dialogos'
import { pedidosQueContinuam } from './atualizacao-dos-pedidos'
import {
  EFEITO_DA_DECISAO,
  ROTULO_EM_ANDAMENTO,
  rotuloDaDecisao,
  TEXTO_DA_AUDITORIA_DA_DECISAO,
  TEXTO_DA_MATRICULA_ERRADA,
  TEXTO_DE_QUE_TODOS_SAIRAM,
  textoDaFalhaDaDecisao,
  textoDoQueVaiSerDecidido,
  textoDoResultado,
  textoDosQueSairam,
  TITULO_DA_DECISAO,
} from './textos'

interface PropsDaDecisao {
  readonly decisao: DecisaoDePedido
  /** Os ids marcados quando o diálogo abriu. */
  readonly ids: readonly string[]
  /** A lista de agora: o diálogo mostra, dos marcados, os que continuam nela. */
  readonly pedidos: readonly PedidoDaTurma[]
  readonly turmaNome: string
  readonly quem: DecisorDaReivindicacao
  /** A decisão respondeu: a lista tira o que foi decidido, mesmo com o diálogo já fechado. */
  readonly aoDecidir: (resposta: DecisaoResponse) => Promise<void>
  /** A decisão falhou: a lista da tela deixou de valer. */
  readonly aoFalhar: () => Promise<void>
  readonly aoFechar: () => void
  readonly focoDeReserva: () => void
}

/**
 * A decisão sobre os pedidos marcados (A1, 16.0; RF12; W6; `docs/interface.md` 8.4 e 11.1). Aprovar é decisão oficial:
 * cria a conta do aluno, e o botão é o preto (`oficial`). Recusar devolve o nome à lista, e o botão é o `perigo`. Nos
 * dois, antes de confirmar, a tela diz a turma, cada nome, com a marca da tentativa com matrícula errada, e o efeito; para
 * a coordenação, também que a decisão fica na auditoria. O foco começa no texto, e não no botão que decide (regra 50,
 * item 8).
 *
 * - **Um pedido por vez no ar** (`useEnvioUnico`): o clique duplo em confirmar manda uma decisão só.
 * - **O diálogo acompanha a lista**: o pedido que outra pessoa decidiu com ele aberto sai dele, e o que vai no envio são
 *   os que continuam. Sem nenhum, só resta fechar.
 * - **Depois, o resultado de cada pedido, em texto**, com o nome que foi enviado: a lista já não os tem.
 * - **A falha diz o que aconteceu com a lista**, e a nova tentativa manda só os pedidos que continuam nela.
 *
 * Os nomes enviados ficam nas variáveis da mutação só enquanto o diálogo existe (`gcTime: 0` do `useEnvioUnico`).
 */
export function DialogoDeDecisao({ decisao, ids, pedidos, turmaNome, quem, aoDecidir, aoFalhar, aoFechar, focoDeReserva }: PropsDaDecisao) {
  const inicio = useRef<HTMLParagraphElement>(null)
  const tituloDoResultado = useRef<HTMLHeadingElement>(null)
  const { enviar, mutacao } = useEnvioUnico({
    mutationFn: (enviados: readonly PedidoDaTurma[]) => decidirPedidos({ ids: enviados.map((pedido) => pedido.id), decisao }),
    // Nas opções do `useMutation`, e não nos callbacks do `mutate`: aqui ele roda na cadeia da mutação, antes de a tela
    // ver o resultado, e o e2e de pedidos para o relógio da aba contando com isso
    // (correção 2026-10-03-decididos-continuam-marcados).
    onSuccess: aoDecidir,
    onError: aoFalhar,
  })
  const etapa = mutacao.isSuccess ? 'resultado' : 'revisar'
  useFocoDaEtapa(etapa, etapa === 'resultado' ? tituloDoResultado : inicio, mutacao.isError)

  const moldura = (conteudo: ReactNode) => (
    <Dialogo titulo={TITULO_DA_DECISAO[decisao]} aoFechar={aoFechar} focoInicial={inicio} focoDeReserva={focoDeReserva}>
      <div className="mt-4 flex min-w-0 flex-col gap-4">{conteudo}</div>
    </Dialogo>
  )
  const fechar = (
    <div className="flex flex-wrap gap-3">
      <button type="button" onClick={aoFechar} className={CLASSES_DO_BOTAO_SECUNDARIO}>
        Fechar
      </button>
    </div>
  )

  if (mutacao.isSuccess) {
    const nomeDoPedido = new Map(mutacao.variables.map((pedido) => [pedido.id, pedido.nome]))
    return moldura(
      <>
        <h3 ref={tituloDoResultado} tabIndex={-1} className="font-semibold">
          Resultado
        </h3>
        <ul className="flex flex-col gap-2" aria-label="Resultado de cada pedido">
          {mutacao.data.resultados.map(({ id, resultado }) => (
            <li key={id} className="min-w-0 rounded-controle border border-linha p-3">
              <span className="block font-medium break-words text-tinta">{nomeDoPedido.get(id)}</span>
              <span className={`block text-sm ${resultado === 'decidida' ? 'text-ok' : 'text-pendente'}`}>{textoDoResultado(decisao, resultado)}</span>
            </li>
          ))}
        </ul>
        {fechar}
      </>,
    )
  }

  const continuam = pedidosQueContinuam(ids, pedidos)
  const sairam = ids.length - continuam.length
  const falha = mutacao.isError ? <Falha texto={textoDaFalhaDaDecisao(mutacao.error, quem)} erro={mutacao.error} /> : null

  if (continuam.length === 0)
    return moldura(
      <>
        {/* Com a falha, é ela que diz por que a lista saiu; sem falha, foi outra pessoa que decidiu antes. */}
        {falha ?? (
          <p ref={inicio} tabIndex={-1} className="break-words text-apoio">
            {TEXTO_DE_QUE_TODOS_SAIRAM}
          </p>
        )}
        {fechar}
      </>,
    )

  return moldura(
    <>
      <p ref={inicio} tabIndex={-1} className="break-words text-tinta">
        {textoDoQueVaiSerDecidido(decisao, continuam.length, turmaNome)}
      </p>
      <p role="status" className="text-sm break-words text-pendente empty:hidden">
        {sairam > 0 && textoDosQueSairam(sairam)}
      </p>
      <ul className="flex flex-col gap-2" aria-label="Pedidos desta decisão">
        {continuam.map((pedido) => (
          <li key={pedido.id} className="min-w-0 rounded-controle border border-linha p-3">
            <span className="block font-medium break-words text-tinta">{pedido.nome}</span>
            {pedido.teveMatriculaErrada && <span className="block text-sm break-words text-pendente">{TEXTO_DA_MATRICULA_ERRADA}</span>}
          </li>
        ))}
      </ul>
      <p className="break-words text-apoio">{EFEITO_DA_DECISAO[decisao]}</p>
      {quem === 'coordenacao' && <p className="rounded-controle border border-pendente bg-pendente-cx p-3 break-words text-pendente">{TEXTO_DA_AUDITORIA_DA_DECISAO}</p>}
      {falha}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => enviar(continuam)}
          disabled={mutacao.isPending}
          className={decisao === 'aprovar' ? CLASSES_DO_BOTAO_OFICIAL : CLASSES_DO_BOTAO_PERIGO_CHEIO}
        >
          {mutacao.isPending ? ROTULO_EM_ANDAMENTO[decisao] : rotuloDaDecisao(decisao, continuam.length)}
        </button>
        <button type="button" onClick={aoFechar} className={CLASSES_DO_BOTAO_SECUNDARIO}>
          Cancelar
        </button>
      </div>
      <span role="status" className="sr-only">
        {mutacao.isPending ? ROTULO_EM_ANDAMENTO[decisao] : ''}
      </span>
    </>,
  )
}
