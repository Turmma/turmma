import { FINALIDADES_DO_ARQUIVO_DA_ESCOLA, MAXIMO_DO_NOME_DO_TITULAR, type PedidoDoTitular } from '@educa/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { cancelarPedidoDoTitular, concluirPedidoDoTitular, corrigirNomeDoTitular, pedirArquivoDaEscola, relerPedidoDoTitular } from './api/privacidade'
import { baixarPorUrl } from '../../../components/download-from-url'
import { Botao } from '../../../components/ui/Botao'
import { Campo } from '../../../components/ui/fields/Campo'
import { useDialogoDaTela } from '../../../components/ui/overlays/dialog-state'
import { DialogoDeConfirmacao } from '../../../components/ui/overlays/DialogoDeConfirmacao'
import { useEnvioUnico } from '../../../components/dialogs'
import { listaMudou, textoDaFalha } from '../../../components/error-text'
import { formatarData } from '../../../format'
import { ROTULO_DE_QUEM_PEDIU, ROTULO_DO_TIPO, SITUACAO_DO_PEDIDO, TEXTO_DO_TITULAR_ELIMINADO } from './textos-dos-pedidos'
import {
  acoesDoPedido,
  ANUNCIO_DE_ELIMINACAO_CANCELADA,
  ANUNCIO_DE_NOME_CORRIGIDO,
  ANUNCIO_DE_PEDIDO_CONCLUIDO,
  anuncioDoArquivoBaixado,
  AVISO_DE_BAIXAR,
  AVISO_DE_CANCELAR,
  AVISO_DE_CONCLUIR,
  AVISO_DO_NOME_ANTERIOR,
  CODIGOS_QUE_MUDAM_O_PEDIDO,
  EFEITO_DE_BAIXAR,
  EFEITO_DE_CANCELAR,
  EFEITO_DE_CORRIGIR_NOME,
  efeitoDeConcluir,
  ROTULO_DA_FINALIDADE,
  TEXTOS_DA_FALHA_DE_BAIXAR,
  TEXTOS_DA_FALHA_DE_CANCELAR,
  TEXTOS_DA_FALHA_DE_CONCLUIR,
  TEXTOS_DA_FALHA_DE_CORRIGIR_NOME,
  nomeNovoDoTitular,
} from './textos-do-pedido'

type Janela = 'concluir' | 'cancelar' | 'corrigir_nome' | 'baixar'

interface PropsDosDialogos {
  readonly pedido: PedidoDoTitular
  /** O anúncio do que terminou, na seção onde a ação aconteceu. */
  readonly aoAnunciar: (texto: string) => void
  /** O foco, quando o botão que abriu o diálogo saiu da página junto com a ação (o pedido concluído não tem mais "Concluir"). */
  readonly focoDeReserva: () => void
}

/** O resumo que todo diálogo do pedido mostra antes de confirmar (regra 50, item 8): quem, qual pedido, quem pediu e a situação de agora. */
function resumoDoPedido(pedido: PedidoDoTitular) {
  return [
    {
      rotulo: 'Pessoa',
      valor: pedido.titular?.nome ?? TEXTO_DO_TITULAR_ELIMINADO,
    },
    { rotulo: 'Pedido', valor: ROTULO_DO_TIPO[pedido.tipo] },
    { rotulo: 'Quem pediu', valor: ROTULO_DE_QUEM_PEDIU[pedido.solicitante] },
    { rotulo: 'Chegou à escola em', valor: formatarData(pedido.chegouEm) },
    { rotulo: 'Situação', valor: SITUACAO_DO_PEDIDO[pedido.estado].texto },
  ] as const
}

/**
 * Concluir e cancelar têm o mesmo corpo: uma chamada sem corpo, a leitura nova da página e o anúncio. A leitura espera:
 * o estado que aparece é o do servidor, e o `onError` relê também quando a falha diz que o pedido mudou (outra pessoa
 * concluiu, a eliminação já começou): a página deixa de oferecer o que já não vale.
 */
function useAcaoDoPedido(pedido: PedidoDoTitular, chamar: (id: string) => Promise<void>, anuncio: string, props: PropsDosDialogos, fechar: () => void) {
  const cliente = useQueryClient()
  return useEnvioUnico({
    mutationFn: async () => {
      await chamar(pedido.id)
      await relerPedidoDoTitular(cliente, pedido.id)
    },
    onSuccess: () => {
      fechar()
      props.aoAnunciar(anuncio)
    },
    onError: (erro) => {
      if (listaMudou(erro, CODIGOS_QUE_MUDAM_O_PEDIDO)) void relerPedidoDoTitular(cliente, pedido.id)
    },
  })
}

function DialogoDeConcluir({ props, aoFechar, aoConcluido }: { readonly props: PropsDosDialogos; readonly aoFechar: () => void; readonly aoConcluido: () => void }) {
  const { pedido } = props
  const { enviar, mutacao } = useAcaoDoPedido(pedido, concluirPedidoDoTitular, ANUNCIO_DE_PEDIDO_CONCLUIDO, props, aoConcluido)
  const mudou = mutacao.isError && listaMudou(mutacao.error, CODIGOS_QUE_MUDAM_O_PEDIDO)
  return (
    <DialogoDeConfirmacao
      titulo={`Concluir o pedido: ${ROTULO_DO_TIPO[pedido.tipo]}`}
      familia="oficial"
      resumo={resumoDoPedido(pedido)}
      efeito={efeitoDeConcluir(pedido)}
      aviso={AVISO_DE_CONCLUIR}
      rotuloDeConfirmar="Concluir pedido"
      rotuloConfirmando="Concluindo…"
      rotuloDeCancelar={mudou ? 'Fechar' : 'Cancelar'}
      aoConfirmar={() => enviar(undefined)}
      aoFechar={aoFechar}
      confirmando={mutacao.isPending}
      impedido={mudou}
      focoDeReserva={props.focoDeReserva}
      {...(mutacao.isError ? { falha: textoDaFalha(mutacao.error, TEXTOS_DA_FALHA_DE_CONCLUIR) } : {})}
    />
  )
}

function DialogoDeCancelar({ props, aoFechar, aoConcluido }: { readonly props: PropsDosDialogos; readonly aoFechar: () => void; readonly aoConcluido: () => void }) {
  const { pedido } = props
  const { enviar, mutacao } = useAcaoDoPedido(pedido, cancelarPedidoDoTitular, ANUNCIO_DE_ELIMINACAO_CANCELADA, props, aoConcluido)
  const mudou = mutacao.isError && listaMudou(mutacao.error, CODIGOS_QUE_MUDAM_O_PEDIDO)
  return (
    <DialogoDeConfirmacao
      titulo="Cancelar a eliminação"
      familia="oficial"
      resumo={resumoDoPedido(pedido)}
      efeito={EFEITO_DE_CANCELAR}
      aviso={AVISO_DE_CANCELAR}
      rotuloDeConfirmar="Cancelar a eliminação"
      rotuloConfirmando="Cancelando…"
      // "Cancelar" ao lado de "Cancelar a eliminação" não diz qual desfaz o quê: o que fecha o diálogo diz o que mantém.
      rotuloDeCancelar={mudou ? 'Fechar' : 'Manter a eliminação'}
      aoConfirmar={() => enviar(undefined)}
      aoFechar={aoFechar}
      confirmando={mutacao.isPending}
      impedido={mudou}
      focoDeReserva={props.focoDeReserva}
      {...(mutacao.isError ? { falha: textoDaFalha(mutacao.error, TEXTOS_DA_FALHA_DE_CANCELAR) } : {})}
    />
  )
}

function DialogoDeCorrigirNome({ props, aoFechar, aoConcluido }: { readonly props: PropsDosDialogos; readonly aoFechar: () => void; readonly aoConcluido: () => void }) {
  const { pedido } = props
  const cliente = useQueryClient()
  const atual = pedido.titular?.nome ?? ''
  const [digitado, definirDigitado] = useState('')
  const nome = nomeNovoDoTitular(digitado, atual)
  const { enviar, mutacao } = useEnvioUnico({
    mutationFn: async (novo: string) => {
      await corrigirNomeDoTitular(pedido.id, novo)
      await relerPedidoDoTitular(cliente, pedido.id)
    },
    onSuccess: () => {
      aoConcluido()
      props.aoAnunciar(ANUNCIO_DE_NOME_CORRIGIDO)
    },
    onError: (erro) => {
      if (listaMudou(erro, CODIGOS_QUE_MUDAM_O_PEDIDO)) void relerPedidoDoTitular(cliente, pedido.id)
    },
  })
  const mudou = mutacao.isError && listaMudou(mutacao.error, CODIGOS_QUE_MUDAM_O_PEDIDO)

  function confirmar(): void {
    if (nome.ok) enviar(nome.nome)
  }
  function aoEnviarOForm(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault()
    confirmar()
  }

  return (
    <DialogoDeConfirmacao
      titulo="Corrigir o nome"
      familia="oficial"
      resumo={[
        { rotulo: 'Nome atual', valor: atual },
        { rotulo: 'Nome novo', valor: nome.ok ? nome.nome : '—' },
        { rotulo: 'Pedido', valor: ROTULO_DO_TIPO[pedido.tipo] },
      ]}
      efeito={EFEITO_DE_CORRIGIR_NOME}
      aviso={AVISO_DO_NOME_ANTERIOR}
      rotuloDeConfirmar="Corrigir o nome"
      rotuloConfirmando="Corrigindo…"
      rotuloDeCancelar={mudou ? 'Fechar' : 'Cancelar'}
      aoConfirmar={confirmar}
      aoFechar={aoFechar}
      confirmando={mutacao.isPending}
      impedido={!nome.ok || mudou}
      focoDeReserva={props.focoDeReserva}
      {...(mutacao.isError
        ? {
            falha: textoDaFalha(mutacao.error, TEXTOS_DA_FALHA_DE_CORRIGIR_NOME),
          }
        : {})}
    >
      <form onSubmit={aoEnviarOForm} noValidate className="flex min-w-0 flex-col gap-2">
        <Campo
          rotulo="Nome correto"
          dica="O nome completo, como deve ficar no cadastro."
          name="nome"
          type="text"
          autoComplete="off"
          maxLength={MAXIMO_DO_NOME_DO_TITULAR}
          value={digitado}
          onChange={(evento) => definirDigitado(evento.target.value)}
          {...(digitado !== '' && !nome.ok ? { erro: nome.erro } : {})}
        />
      </form>
    </DialogoDeConfirmacao>
  )
}

function DialogoDeBaixar({ props, aoFechar, aoConcluido }: { readonly props: PropsDosDialogos; readonly aoFechar: () => void; readonly aoConcluido: () => void }) {
  const { pedido } = props
  const [finalidade, definirFinalidade] = useState<(typeof FINALIDADES_DO_ARQUIVO_DA_ESCOLA)[number] | undefined>(undefined)
  const { enviar, mutacao } = useEnvioUnico({
    mutationFn: (escolhida: (typeof FINALIDADES_DO_ARQUIVO_DA_ESCOLA)[number]) => pedirArquivoDaEscola(pedido.id, escolhida),
    onSuccess: (arquivo) => {
      // O endereço assinado vale 5 minutos e sai daqui direto para o navegador: não vai a texto da tela nem a log, e só fica na resposta da mutação (`gcTime: 0`) enquanto o diálogo está montado.
      baixarPorUrl(arquivo.url, arquivo.nome)
      aoConcluido()
      props.aoAnunciar(anuncioDoArquivoBaixado(arquivo.nome))
    },
  })
  return (
    <DialogoDeConfirmacao
      titulo="Baixar a versão da escola"
      familia="oficial"
      resumo={resumoDoPedido(pedido)}
      efeito={EFEITO_DE_BAIXAR}
      aviso={AVISO_DE_BAIXAR}
      rotuloDeConfirmar="Baixar o arquivo"
      rotuloConfirmando="Preparando o arquivo…"
      aoConfirmar={() => {
        if (finalidade !== undefined) enviar(finalidade)
      }}
      aoFechar={aoFechar}
      confirmando={mutacao.isPending}
      impedido={finalidade === undefined}
      focoDeReserva={props.focoDeReserva}
      {...(mutacao.isError ? { falha: textoDaFalha(mutacao.error, TEXTOS_DA_FALHA_DE_BAIXAR) } : {})}
    >
      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="font-medium">Para que é o arquivo</legend>
        {FINALIDADES_DO_ARQUIVO_DA_ESCOLA.map((valor) => (
          <label
            key={valor}
            className={`flex min-h-11 min-w-0 cursor-pointer items-start gap-3 rounded-controle border border-borda-campo px-3 py-2 ${finalidade === valor ? 'bg-realce-suave' : 'bg-superficie'}`}
          >
            <input
              type="radio"
              name="finalidade"
              value={valor}
              checked={finalidade === valor}
              onChange={() => definirFinalidade(valor)}
              className="mt-0.5 size-6 shrink-0 accent-noite"
            />
            <span className="min-w-0 break-words">{ROTULO_DA_FINALIDADE[valor]}</span>
          </label>
        ))}
      </fieldset>
    </DialogoDeConfirmacao>
  )
}

/**
 * Os botões do detalhe do pedido e os diálogos que eles abrem, um de cada vez (F3, 17.0; RF12, RF13b, RF14 e RF16). Cada
 * botão só existe quando a ação vale para o tipo e o estado de agora (`acoesDoPedido`): a página não oferece o que a API
 * recusaria. Cada abertura monta o diálogo do zero (`useDialogoDaTela`), e a falha e o campo de uma não vão para a seguinte.
 *
 * Cancelar, em qualquer um, fecha e esquece: sair nunca é mais difícil que entrar (D59). O aviso do que terminou fica na
 * seção do detalhe (`aoAnunciar`), e o foco volta ao botão que abriu o diálogo ou, quando ele saiu, a `focoDeReserva`.
 */
export function AcoesDoPedido(props: PropsDosDialogos) {
  const { pedido } = props
  const janela = useDialogoDaTela<Janela>()
  const acoes = acoesDoPedido(pedido)
  const { aberta } = janela
  const algumaAcao = acoes.concluir || acoes.cancelar || acoes.corrigirNome || acoes.baixar

  // Os botões saem quando o pedido muda por baixo (outra pessoa concluiu), mas o diálogo aberto não: é nele que a pessoa
  // lê o que mudou, e é ele que devolve o foco. Por isso o `return` não é antes dos diálogos.
  return (
    <>
      {algumaAcao && (
        <div className="flex flex-wrap gap-3" role="group" aria-label="O que fazer com este pedido">
          {acoes.baixar && (
            <Botao variante="oficial" onClick={() => janela.abrir('baixar')}>
              Baixar a versão da escola
            </Botao>
          )}
          {acoes.corrigirNome && (
            <Botao variante="secundario" onClick={() => janela.abrir('corrigir_nome')}>
              Corrigir nome
            </Botao>
          )}
          {acoes.concluir && (
            <Botao variante="secundario" onClick={() => janela.abrir('concluir')}>
              Concluir
            </Botao>
          )}
          {acoes.cancelar && (
            <Botao variante="secundario" onClick={() => janela.abrir('cancelar')}>
              Cancelar eliminação
            </Botao>
          )}
        </div>
      )}
      {aberta?.tipo === 'concluir' && <DialogoDeConcluir key={aberta.numero} props={props} aoFechar={janela.fechar} aoConcluido={() => janela.fecharSeAinda(aberta)} />}
      {aberta?.tipo === 'cancelar' && <DialogoDeCancelar key={aberta.numero} props={props} aoFechar={janela.fechar} aoConcluido={() => janela.fecharSeAinda(aberta)} />}
      {aberta?.tipo === 'corrigir_nome' && <DialogoDeCorrigirNome key={aberta.numero} props={props} aoFechar={janela.fechar} aoConcluido={() => janela.fecharSeAinda(aberta)} />}
      {aberta?.tipo === 'baixar' && <DialogoDeBaixar key={aberta.numero} props={props} aoFechar={janela.fechar} aoConcluido={() => janela.fecharSeAinda(aberta)} />}
    </>
  )
}
