import { ErrorCode, TAMANHO_MAXIMO_DA_COBERTURA, TAMANHO_MAXIMO_DA_REFERENCIA, TAMANHO_MAXIMO_DO_LICENCIANTE, type Licenca, type RegistrarLicencaRequest } from '@educa/shared'
import { useRef, useState } from 'react'
import { ApiError } from '../../../api/client'
import { FormDialog, useSingleSubmit } from '../../../components/dialogs'
import { errorText, listChanged } from '../../../components/error-text'
import { FormField } from '../../../components/ui/fields/FormField'
import { alterarLicenca } from './api/licencas'
import {
  CAMPOS_DA_LICENCA,
  efeitoDaVigencia,
  errosDaVigencia,
  errosDoRascunhoDaLicenca,
  pedidoDeRegistro,
  pedidoDeVigencia,
  RASCUNHO_DA_LICENCA_VAZIO,
  TEXTO_DA_ENTRADA_INVALIDA_DA_LICENCA,
  TEXTOS_DA_FALHA_DA_VIGENCIA,
  TEXTOS_DA_FALHA_DO_REGISTRO,
  textoDoEfeitoDaVigencia,
  vigenciaDoRascunho,
  type RascunhoDaLicenca,
  type ErrosDaLicenca,
  type RascunhoDaVigencia,
} from './licencas'

/**
 * Os dois diálogos da aba Licenças (ingestao-do-material, 6.0; RF16 e RF17): registrar uma licença e mudar a vigência de uma que existe.
 * Cada abertura é um formulário novo (`key` de quem o monta): o rascunho, o foco e o aviso da tentativa anterior não voltam.
 */

interface PropsDosCamposDaVigencia {
  readonly rascunho: RascunhoDaVigencia
  readonly aoMudar: (parte: Partial<RascunhoDaVigencia>) => void
  readonly erros: ErrosDaLicenca
  /** O erro do campo do fim: o do formulário, ou o que a API recusou (`ENTRADA_INVALIDA`), que a pessoa corrige ali. */
  readonly erroDoFim: string | undefined
}

/** O começo e o fim da vigência, os mesmos nos dois diálogos; o fim vazio quer dizer que a licença não tem fim. */
function CamposDaVigencia({ rascunho, aoMudar, erros, erroDoFim }: PropsDosCamposDaVigencia) {
  return (
    <>
      <div data-campo="vigenteDesde">
        <FormField rotulo="Começa em" type="date" value={rascunho.vigenteDesde} onChange={(evento) => aoMudar({ vigenteDesde: evento.target.value })} erro={erros.vigenteDesde} />
      </div>
      <div data-campo="vigenteAte">
        <FormField
          rotulo="Termina em"
          dica="Deixe vazio se a licença não tem fim."
          type="date"
          value={rascunho.vigenteAte}
          onChange={(evento) => aoMudar({ vigenteAte: evento.target.value })}
          erro={erroDoFim}
        />
      </div>
    </>
  )
}

interface PropsDoRegistro {
  /** O pedido está no ar (o da tela, que sobrevive ao diálogo): o botão fica desligado e o clique duplo não manda duas licenças. */
  readonly enviando: boolean
  /** A falha do último pedido desta abertura; a tela a zera ao abrir. */
  readonly erro: unknown
  readonly aoEnviar: (pedido: RegistrarLicencaRequest) => void
  readonly aoFechar: () => void
  readonly focoDeReserva: () => void
}

/**
 * "Registrar licença": o licenciante, o que ela cobre, a referência do documento (nunca o contrato) e a vigência, com o fim opcional. A
 * rota não tem idempotência, e por isso quem **envia** é a tela, que segura o pedido mesmo com o diálogo fechado. O que a API recusar
 * por `ENTRADA_INVALIDA` aparece no campo do fim da vigência, que a pessoa corrige com o foco nele.
 */
export function DialogoDeRegistroDeLicenca({ enviando, erro, aoEnviar, aoFechar, focoDeReserva }: PropsDoRegistro) {
  const [rascunho, definirRascunho] = useState<RascunhoDaLicenca>(RASCUNHO_DA_LICENCA_VAZIO)
  const [tentou, definirTentou] = useState(false)
  const corpo = useRef<HTMLDivElement>(null)
  const entradaInvalida = erro instanceof ApiError && erro.codigo === ErrorCode.ENTRADA_INVALIDA
  const erros = tentou ? errosDoRascunhoDaLicenca(rascunho) : {}
  const mudar = (parte: Partial<RascunhoDaLicenca>): void => definirRascunho((atual) => ({ ...atual, ...parte }))

  function aoEnviarOFormulario(): void {
    definirTentou(true)
    const comErro = errosDoRascunhoDaLicenca(rascunho)
    const primeiro = CAMPOS_DA_LICENCA.find((nome) => comErro[nome] !== undefined)
    if (primeiro !== undefined) {
      corpo.current?.querySelector<HTMLInputElement>(`[data-campo="${primeiro}"] input`)?.focus()
      return
    }
    const pedido = pedidoDeRegistro(rascunho)
    if (pedido !== undefined) aoEnviar(pedido)
  }

  return (
    <FormDialog
      titulo="Registrar licença"
      aoFechar={aoFechar}
      aoEnviar={aoEnviarOFormulario}
      enviando={enviando}
      rotuloDoEnvio="Registrar licença"
      rotuloEnviando="Registrando…"
      falha={erro === undefined || erro === null || entradaInvalida ? undefined : errorText(erro, TEXTOS_DA_FALHA_DO_REGISTRO)}
      focoDeReserva={focoDeReserva}
    >
      <p className="text-apoio">Registre a licença uma vez: os materiais de terceiro citam esta licença no envio. Não anexe o contrato, só indique o documento.</p>
      <div ref={corpo} className="contents">
        <div data-campo="licenciante">
          <FormField
            rotulo="Quem deu a licença"
            dica="O dono do conteúdo: a editora, o sistema de ensino ou o autor."
            value={rascunho.licenciante}
            maxLength={TAMANHO_MAXIMO_DO_LICENCIANTE}
            onChange={(evento) => mudar({ licenciante: evento.target.value })}
            erro={erros.licenciante}
            autoComplete="off"
          />
        </div>
        <div data-campo="cobertura">
          <FormField
            rotulo="O que a licença cobre"
            dica="Por exemplo: a coleção de Química do 1º ao 3º ano."
            value={rascunho.cobertura}
            maxLength={TAMANHO_MAXIMO_DA_COBERTURA}
            onChange={(evento) => mudar({ cobertura: evento.target.value })}
            erro={erros.cobertura}
            autoComplete="off"
          />
        </div>
        <div data-campo="referencia">
          <FormField
            rotulo="Documento da licença"
            dica="O número do contrato ou do termo de autorização. Por exemplo: Termo 2026/07."
            value={rascunho.referencia}
            maxLength={TAMANHO_MAXIMO_DA_REFERENCIA}
            onChange={(evento) => mudar({ referencia: evento.target.value })}
            erro={erros.referencia}
            autoComplete="off"
          />
        </div>
        <CamposDaVigencia rascunho={rascunho} aoMudar={mudar} erros={erros} erroDoFim={erros.vigenteAte ?? (entradaInvalida ? TEXTO_DA_ENTRADA_INVALIDA_DA_LICENCA : undefined)} />
      </div>
    </FormDialog>
  )
}

interface PropsDaVigencia {
  readonly licenca: Licenca
  /** O dia de São Paulo, `AAAA-MM-DD`, com que a tela calcula o que a vigência nova faz com a busca. */
  readonly hoje: string
  /** Relê a lista de licenças (e, com ela, o sino), deu certo ou não. */
  readonly recarregar: () => Promise<void>
  readonly aoAlterar: () => void
  readonly aoFechar: () => void
  readonly focoDeReserva: () => void
}

/**
 * "Mudar a vigência": o começo e o fim, e, **antes de confirmar**, quantos materiais saem da busca ou voltam a ela com a vigência escrita
 * (regra 50, item 8). A conta é só de leitura; quem decide é a API, e nenhum material é reenviado. O fim vazio tira o fim da licença.
 */
export function DialogoDaVigencia({ licenca, hoje, recarregar, aoAlterar, aoFechar, focoDeReserva }: PropsDaVigencia) {
  const [rascunho, definirRascunho] = useState<RascunhoDaVigencia>({ vigenteDesde: licenca.vigenteDesde, vigenteAte: licenca.vigenteAte ?? '' })
  const [tentou, definirTentou] = useState(false)
  const { enviar, mutacao } = useSingleSubmit({
    mutationFn: (pedido: NonNullable<ReturnType<typeof pedidoDeVigencia>>) => alterarLicenca(licenca.id, pedido),
    onSuccess: async () => {
      await recarregar()
      aoAlterar()
    },
    onError: (erro) => {
      if (listChanged(erro, [ErrorCode.NAO_ENCONTRADO])) void recarregar()
    },
  })
  const erros = tentou ? errosDaVigencia(rascunho) : {}
  const nova = vigenciaDoRascunho(rascunho)
  const efeito = nova === undefined ? undefined : textoDoEfeitoDaVigencia(efeitoDaVigencia(licenca, nova, hoje))
  const mudou = mutacao.isError && listChanged(mutacao.error, [ErrorCode.NAO_ENCONTRADO])

  function aoEnviarOFormulario(): void {
    definirTentou(true)
    const pedido = pedidoDeVigencia(rascunho)
    if (Object.keys(errosDaVigencia(rascunho)).length === 0 && pedido !== undefined) enviar(pedido)
  }

  return (
    <FormDialog
      titulo="Mudar a vigência"
      aoFechar={aoFechar}
      aoEnviar={aoEnviarOFormulario}
      enviando={mutacao.isPending}
      rotuloDoEnvio="Salvar vigência"
      rotuloEnviando="Salvando…"
      falha={mutacao.isError ? errorText(mutacao.error, TEXTOS_DA_FALHA_DA_VIGENCIA) : undefined}
      semNovaTentativa={mudou}
      focoDeReserva={focoDeReserva}
    >
      <p className="break-words text-apoio">
        Licença de <span className="font-semibold text-tinta">{licenca.licenciante}</span>. Material que a licença cobre sai da busca no dia seguinte ao fim, e volta quando a vigência passa a valer.
      </p>
      <CamposDaVigencia rascunho={rascunho} aoMudar={(parte) => definirRascunho((atual) => ({ ...atual, ...parte }))} erros={erros} erroDoFim={erros.vigenteAte} />
      {/* O que esta vigência faz com a busca, antes de salvar: a região existe antes do texto, e o leitor de tela o ouve mudar. */}
      <p role="status" className="rounded-controle border-2 border-borda p-3 break-words text-tinta empty:hidden">
        {efeito}
      </p>
    </FormDialog>
  )
}
