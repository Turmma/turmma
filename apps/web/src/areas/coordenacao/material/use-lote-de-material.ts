import { ErrorCode, type MotivoDaRecusaDoMaterial } from '@educa/shared'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from 'react'
import { ApiError } from '../../../api/client'
import { errorText } from '../../../components/error-text'
import { enviarMaterial, excluirMaterial, type CamposDoEnvioDeMaterial } from './api/material'
import { licencasQueryOptions } from './api/licencas'
import { enviarOLote, type ParadaDoLote } from './envio-em-lote'
import {
  aceitarNoLote,
  camposDoEnvio,
  CAMPOS_DO_ENVIO,
  conferirArquivo,
  devePartir,
  errosDoRascunho,
  licencasQueValem,
  MAXIMO_DE_ARQUIVOS_DO_LOTE,
  motivoDaRecusa,
  resumoDoLote,
  temErro,
  TEXTO_DA_RECUSA,
  TEXTO_DE_UM_ARQUIVO_SO,
  textoDoItem,
  textoDoLimiteDeEnvios,
  textoDoLimiteDoLote,
  TEXTOS_DA_FALHA_DO_ENVIO,
  tituloDaRecusa,
  tituloDoNovoItem,
  type ArquivoConferido,
  type CampoDoEnvio,
  type ItemDoLote,
  type RascunhoDoEnvio,
} from './material-envio'

/**
 * O estado e o laço do diálogo "Enviar material" em lote (ingestao-do-material, 7.0; RF14), fora do desenho: o que é de cada arquivo, o que vale para o lote
 * todo, a trava do clique duplo, o fim da vida do diálogo (quem fecha, ou muda de sessão, deixa de enviar os arquivos seguintes) e o relógio do que continua
 * sozinho depois do 429. A lista vive numa `ref` **e** na tela: o laço de envio lê o que acabou de acontecer sem esperar a próxima renderização.
 */

export interface LoteDeMaterialOptions {
  readonly inicial: RascunhoDoEnvio
  readonly substitui: string | undefined
  readonly aoConcluir: (resultado: { readonly enviados: number; readonly substituiu: string | undefined }) => void
  readonly aoRecusar: (campos: CamposDoEnvioDeMaterial, motivo: MotivoDaRecusaDoMaterial) => void
  readonly recarregar: () => Promise<void>
  readonly formulario: RefObject<HTMLFormElement | null>
  readonly botaoDoArquivo: RefObject<HTMLButtonElement | null>
  readonly resumo: RefObject<HTMLParagraphElement | null>
}

/** O que o diálogo faz depois de a rodada do lote terminar. */
type FimDaRodada = 'limite' | 'parou' | 'concluir' | 'resumir'

export function fimDaRodada(parada: ParadaDoLote | undefined, finais: readonly Pick<ItemDoLote, 'situacao'>[]): FimDaRodada {
  if (parada?.tipo === 'limite') return 'limite'
  if (parada !== undefined) return 'parou'
  const semPendencia = finais.every((item) => item.situacao === 'enviado' || item.situacao === 'ja_enviado')
  return semPendencia && finais.some((item) => item.situacao === 'enviado') ? 'concluir' : 'resumir'
}

/** O que o leitor de tela ouve quando um arquivo muda de situação: o nome e o que aconteceu. Quando o arquivo só entra em fila ou em envio, nada. */
export function anuncioDoItem(nome: string | undefined, parte: Partial<Pick<ItemDoLote, 'situacao' | 'texto'>>): string | undefined {
  if (nome === undefined || parte.situacao === undefined || parte.situacao === 'enviando' || parte.situacao === 'pendente') return undefined
  return `${nome}: ${textoDoItem(parte.texto === undefined ? { situacao: parte.situacao } : { situacao: parte.situacao, texto: parte.texto })}`
}

function problemaDoConferido({ arquivo, problema }: ArquivoConferido): string[] {
  return problema === undefined ? [] : [`${arquivo.name}: ${problema}`]
}

/** O que a tela diz do envio em curso, e o que foi dito por último. */
interface SituacaoDoEnvio {
  readonly tentou: boolean
  readonly falha: string | undefined
  readonly parada: ParadaDoLote | undefined
  readonly limiteTexto: string | undefined
  readonly emCurso: boolean
  readonly anuncio: string
}

const SITUACAO_INICIAL: SituacaoDoEnvio = { tentou: false, falha: undefined, parada: undefined, limiteTexto: undefined, emCurso: false, anuncio: '' }

/** O que o lote todo declara: o rascunho, a licença registrada que ele cita (lida de novo ao abrir e ao voltar ao foco, nunca por tempo: R6, regra 80) e o que vale agora. */
function useRascunhoDoEnvio(inicial: RascunhoDoEnvio) {
  const [rascunho, definirRascunho] = useState<RascunhoDoEnvio>(inicial)
  const licencas = useQuery({ ...licencasQueryOptions, refetchOnMount: 'always', refetchOnWindowFocus: 'always' })
  const validas = useMemo(() => (licencas.data === undefined ? undefined : licencasQueValem(licencas.data.itens)), [licencas.data])
  /** A licença que a pessoa tinha escolhido e que a releitura mostrou que já não vale: sai da escolha, e a tela diz. */
  const licencaSumiu = rascunho.licencaId !== '' && validas !== undefined && !validas.some((licenca) => licenca.id === rascunho.licencaId)
  const efetivo: RascunhoDoEnvio = licencaSumiu ? { ...rascunho, licencaId: '' } : rascunho
  const rascunhoAgora = useRef(rascunho)
  const efetivoAgora = useRef(efetivo)
  useEffect(() => {
    rascunhoAgora.current = rascunho
    efetivoAgora.current = efetivo
  })
  const mudar = (parte: Partial<RascunhoDoEnvio>): void => definirRascunho((atual) => ({ ...atual, ...parte }))
  return { rascunho, efetivo, mudar, licencas, validas, licencaSumiu, rascunhoAgora, efetivoAgora }
}

interface ArquivosOptions {
  readonly substitui: string | undefined
  readonly rascunhoAgora: RefObject<RascunhoDoEnvio>
  readonly anunciar: (texto: string) => void
}

/** Os arquivos do lote. A lista vive numa `ref` **e** na tela: o laço de envio lê o que acabou de acontecer sem esperar a próxima renderização. */
function useArquivosDoLote({ substitui, rascunhoAgora, anunciar }: ArquivosOptions) {
  const [itens, definirItens] = useState<readonly ItemDoLote[]>([])
  const [problemas, definirProblemas] = useState<readonly string[]>([])
  const [conferindo, definirConferindo] = useState(false)
  const itensAgora = useRef<readonly ItemDoLote[]>([])
  const proximaChave = useRef(0)
  const maximo = substitui === undefined ? MAXIMO_DE_ARQUIVOS_DO_LOTE : 1

  const guardar = (novos: readonly ItemDoLote[]): void => {
    itensAgora.current = novos
    definirItens(novos)
  }
  const mudarItem = (chave: number, parte: Partial<ItemDoLote>): void => guardar(itensAgora.current.map((item) => (item.chave === chave ? { ...item, ...parte } : item)))
  const tirar = (chave: number): void => guardar(itensAgora.current.filter((item) => item.chave !== chave))

  /** O título do rascunho só existe no "Tentar de novo" (um arquivo só): é o do arquivo escolhido. No lote o rascunho nasce sem título, e o do arquivo é o do nome dele. */
  function novoItem({ arquivo }: ArquivoConferido): ItemDoLote {
    proximaChave.current += 1
    return { chave: proximaChave.current, arquivo, titulo: tituloDoNovoItem(arquivo, rascunhoAgora.current.titulo), situacao: 'pendente' }
  }

  /** Confere cada arquivo pelo conteúdo antes de aceitá-lo no lote. O que não passa fica de fora, com o motivo dito pelo nome do arquivo. */
  async function receberArquivos(arquivos: FileList | File[] | null): Promise<void> {
    const escolhidos = arquivos === null ? [] : [...arquivos]
    if (escolhidos.length === 0) return
    const { aceitos, excedente } = aceitarNoLote(itensAgora.current.length, escolhidos.length, maximo)
    definirConferindo(true)
    const conferidos = await Promise.all(escolhidos.slice(0, aceitos).map(conferirArquivo))
    definirConferindo(false)
    const doExcedente = substitui === undefined ? textoDoLimiteDoLote(excedente) : TEXTO_DE_UM_ARQUIVO_SO
    definirProblemas([...(excedente > 0 ? [doExcedente] : []), ...conferidos.flatMap(problemaDoConferido)])
    const novos = conferidos.filter((conferido) => conferido.problema === undefined).map(novoItem)
    if (novos.length === 0) return
    guardar([...itensAgora.current, ...novos])
    anunciar(novos.length === 1 ? 'Um arquivo na lista.' : `${String(novos.length)} arquivos na lista.`)
  }

  return { itens, itensAgora, problemas, conferindo, receberArquivos, mudarItem, tirar }
}

/** Um envio que já se sabe recusado vai sem arquivo: a recusa fica registrada, e nada sai do computador. Devolve o texto da falha, se houve. */
async function enviarARecusa(campos: CamposDoEnvioDeMaterial, motivo: MotivoDaRecusaDoMaterial, aoRecusar: LoteDeMaterialOptions['aoRecusar']): Promise<string | undefined> {
  try {
    await enviarMaterial(campos, undefined)
    return undefined
  } catch (erro) {
    // A recusa que chega com o diálogo já fechado entra na tabela da tela do mesmo jeito: quem a pediu quer vê-la.
    if (erro instanceof ApiError && erro.codigo === ErrorCode.MATERIAL_SEM_LICENCA) {
      aoRecusar(campos, motivo)
      return `Envio recusado. ${TEXTO_DA_RECUSA[motivo]}`
    }
    return errorText(erro, TEXTOS_DA_FALHA_DO_ENVIO)
  }
}

/** O que a tela diz quando a rodada acaba: o que parou o lote (com a hora, no 429) e, se o lote chegou a um resumo, o resumo. */
function situacaoDoFim(fim: FimDaRodada, parada: ParadaDoLote | undefined, finais: readonly Pick<ItemDoLote, 'situacao'>[]): Partial<SituacaoDoEnvio> {
  const limiteTexto = parada?.tipo === 'limite' ? textoDoLimiteDeEnvios(parada.esperaSegundos) : undefined
  const base = { emCurso: false, parada, limiteTexto }
  return fim === 'resumir' ? { ...base, anuncio: resumoDoLote(finais) } : base
}

/** O foco vai ao primeiro campo com erro, na ordem em que eles aparecem na tela. */
function focarNoPrimeiroErro(erros: ReturnType<typeof errosDoRascunho>, botaoDoArquivo: HTMLElement | null, formulario: HTMLFormElement | null): void {
  const primeiro = CAMPOS_DO_ENVIO.find((campo: CampoDoEnvio) => (campo === 'titulo' ? erros.titulos.size > 0 : erros[campo] !== undefined))
  if (primeiro === 'arquivo') botaoDoArquivo?.focus()
  else if (primeiro !== undefined) formulario?.querySelector<HTMLElement>(`[data-campo="${primeiro}"] input, [data-campo="${primeiro}"] select`)?.focus()
}

/** Quem fecha o diálogo, ou muda de sessão, deixa de enviar os arquivos seguintes e de esperar o relógio do 429. */
function useFimDaVida() {
  const fechado = useRef(false)
  const relogio = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const parar = (): void => clearTimeout(relogio.current)
  useEffect(() => {
    fechado.current = false
    return () => {
      fechado.current = true
      parar()
    }
  }, [])
  return { fechado, relogio }
}

interface EnvioDosPendentes {
  readonly alvo: readonly ItemDoLote[]
  readonly camposDe: (item: ItemDoLote) => CamposDoEnvioDeMaterial | undefined
  readonly substitui: string | undefined
  readonly cancelado: () => boolean
  readonly aoMudar: (chave: number, parte: Partial<ItemDoLote>) => void
}

/** Envia os arquivos um por vez e devolve o que parou o lote, quantos saíram e se a lista da escola mudou (o enviado, ou o repetido que mostrou o que ela já tinha). */
async function enviarOsPendentes({ alvo, camposDe, substitui, cancelado, aoMudar }: EnvioDosPendentes): Promise<{ parada: ParadaDoLote | undefined; enviados: number; mudouALista: boolean }> {
  const saldo = { enviados: 0, mudouALista: false }
  const parada = await enviarOLote({
    itens: alvo,
    camposDe,
    enviar: enviarMaterial,
    aoMudar: (chave, parte) => {
      if (cancelado()) return
      aoMudar(chave, parte)
      saldo.mudouALista ||= parte.situacao === 'ja_enviado'
    },
    aoEnviar: async () => {
      saldo.enviados += 1
      saldo.mudouALista = true
      if (substitui !== undefined) await excluirMaterial(substitui).catch(() => undefined)
    },
    cancelado,
  })
  return { parada, ...saldo }
}

/** O estado e o laço do diálogo "Enviar material" em lote (ingestao-do-material, 7.0; RF14), fora do desenho. */
export function useLoteDeMaterial({ inicial, substitui, aoConcluir, aoRecusar, recarregar, formulario, botaoDoArquivo, resumo }: LoteDeMaterialOptions) {
  const [situacao, definirSituacao] = useState<SituacaoDoEnvio>(SITUACAO_INICIAL)
  const dizer = (parte: Partial<SituacaoDoEnvio>): void => definirSituacao((atual) => ({ ...atual, ...parte }))
  // O que o laço lê sem esperar a tela: a trava do clique duplo, o fim da vida do diálogo e o relógio do que continua sozinho.
  const noAr = useRef(false)
  const { fechado, relogio: relogioRef } = useFimDaVida()
  const continuar = useRef<() => void>(() => undefined)

  const declarado = useRascunhoDoEnvio(inicial)
  const { efetivo, efetivoAgora, rascunhoAgora } = declarado
  const arquivos = useArquivosDoLote({ substitui, rascunhoAgora, anunciar: (anuncio) => dizer({ anuncio }) })
  const { itens, itensAgora, mudarItem } = arquivos
  const erros = errosDoRascunho(efetivo, itens)

  /** Envia, um por vez, o que ainda não saiu, e diz o que aconteceu. */
  async function executar(): Promise<void> {
    const alvo = itensAgora.current.filter(devePartir)
    const { parada: paradaDoLote, enviados, mudouALista } = await enviarOsPendentes({
      alvo,
      camposDe: (item) => camposDoEnvio(efetivoAgora.current, item.titulo),
      substitui,
      cancelado: () => fechado.current,
      aoMudar: (chave, parte) => {
        mudarItem(chave, parte)
        const falado = anuncioDoItem(itensAgora.current.find((item) => item.chave === chave)?.arquivo.name, parte)
        if (falado !== undefined) dizer({ anuncio: falado })
      },
    })
    // A lista só é relida se o lote mudou o que a escola tem: o envio que deu certo, ou o repetido que mostrou o que ela já tinha.
    if (mudouALista) await recarregar()
    terminarARodada(paradaDoLote, enviados)
  }

  function terminarARodada(paradaDoLote: ParadaDoLote | undefined, enviados: number): void {
    // Quem fechou o diálogo deixou de acompanhar, mas o que já saiu saiu: a tela diz quantos (o que ela faz com o diálogo é dela).
    if (fechado.current) {
      if (enviados > 0) aoConcluir({ enviados, substituiu: substitui })
      return
    }
    noAr.current = false
    const finais = itensAgora.current
    const fim = fimDaRodada(paradaDoLote, finais)
    dizer(situacaoDoFim(fim, paradaDoLote, finais))
    if (paradaDoLote?.tipo === 'limite' && paradaDoLote.esperaSegundos !== undefined) relogioRef.current = setTimeout(() => continuar.current(), paradaDoLote.esperaSegundos * 1_000)
    if (fim === 'concluir') aoConcluir({ enviados: finais.filter((item) => item.situacao === 'enviado').length, substituiu: substitui })
    else if (fim === 'resumir') queueMicrotask(() => resumo.current?.focus())
  }

  function iniciar(): void {
    noAr.current = true
    clearTimeout(relogioRef.current)
    dizer({ emCurso: true, falha: undefined, parada: undefined, limiteTexto: undefined })
    void executar()
  }
  useEffect(() => {
    continuar.current = iniciar
  })

  function recusar(motivo: MotivoDaRecusaDoMaterial): void {
    const campos = camposDoEnvio(efetivoAgora.current, tituloDaRecusa(itensAgora.current.filter(devePartir)))
    if (campos === undefined) return
    noAr.current = true
    dizer({ emCurso: true })
    void enviarARecusa(campos, motivo, aoRecusar).then((falha) => {
      noAr.current = false
      dizer({ emCurso: false, falha })
    })
  }

  function aoEnviarOFormulario(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault()
    if (noAr.current) return
    dizer({ tentou: true, falha: undefined })
    const recusa = motivoDaRecusa(efetivo)
    if (temErro(erros)) focarNoPrimeiroErro(erros, botaoDoArquivo.current, formulario.current)
    else if (recusa === null) iniciar()
    else recusar(recusa)
  }

  return {
    ...declarado,
    ...arquivos,
    ...situacao,
    erros,
    mudarTitulo: (chave: number, titulo: string): void => mudarItem(chave, { titulo }),
    aoEnviarOFormulario,
  }
}
