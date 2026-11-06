import type { CandidatoDaMarca, ErrorCode, PreviaDaPlanilhaResponse, PreviaDaPlanilhaRow, ResumoDaImportacao } from '@educa/shared'
import { useMutation } from '@tanstack/react-query'
import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent, type RefObject } from 'react'
import { Button } from '../../../components/ui/Button'
import { SECONDARY_BUTTON_CLASSES } from '../../../components/ui/button-variants'
import { useSingleSubmit } from '../../../components/dialogs'
import { EmptyState, LoadingState } from '../../../components/states/index'
import { formatNumber, formatQuantity } from '../../../format'
import { baixarModelo } from '../grade/modelos-de-planilha'
import { acompanharImportacao, gravarPlanilha, lerImportacao, previaDaPlanilha, type RotasDaPlanilha } from './api/importacao'
import { lerPlanilha, type MotivoDaPlanilhaRecusada } from './ler-planilha'
import {
  ACOES_DE_MARCA,
  alternarMarca,
  alternarTodos,
  candidatosDa,
  fatiaDaLista,
  frasesDasContagens,
  frasesDoResto,
  itensEscondidos,
  linhasDeErroEDeAviso,
  linhasDeFora,
  marcasParaEnviar,
  podeGravar,
  resumoDasMarcas,
  previaEnvelheceu,
  SEM_MARCAS,
  TEXTO_DA_CONFERENCIA,
  TEXTO_DA_PLANILHA_RECUSADA,
  textoDaConclusao,
  textoDoGrupoDeMarca,
  textoDaFalhaDaGravacao,
  textoDaFalhaDaPrevia,
  textoDoAviso,
  textoDoErro,
  totalDeMarcas,
  type AcaoDeMarca,
  type FrasesDoResumoDeMarcas,
  type MarcasEscolhidas,
  type TextoDoGrupoDeMarca,
  type TextosDosGruposDeMarca,
} from './previa-da-planilha'

/**
 * Subir uma planilha com prévia (F2, 13.0; RF2 a RF4 e RF15; Tech Spec, seção 9). A coordenação escolhe o CSV ou o XLSX; o navegador o
 * lê e manda **texto** à API (`ler-planilha.ts`); a prévia mostra os erros, os avisos e as marcas primeiro e o resto em contagem;
 * gravar enfileira o job e a tela acompanha até o fim. É a peça de Turmas (alunos) e da lista de uma turma; Professores e Grade e
 * calendário a usam com a configuração deles (14.0 e 15.0).
 *
 * - **Com erro na prévia, não há como gravar** (RF2): o botão nem aparece, e o motivo está no lugar dele.
 * - **A marca é da coordenação** (RF4; regra 70, item 2): transferir, desligar e encerrar chegam desmarcados, e o "marcar todos" também.
 *   O texto diz que a lista é conferência feita a partir da planilha. Sem marca, gravar não muda ninguém.
 * - **A prévia é do arquivo escolhido**: escolher outro (ou o mesmo de novo) recomeça, e a resposta de uma prévia anterior que chega
 *   depois não aparece. Nome e matrícula ficam só na memória da página (regra 20; regra 50, item 7): nada de `localStorage`,
 *   `sessionStorage` nem endereço, e a prévia não é guardada no cache do TanStack Query (`gcTime: 0`).
 * - **Um gravar só**: o clique duplo manda um pedido (`useSingleSubmit`). A tela acompanha a importação sem desistir e para de ler
 *   quando sai (o sinal cancela a leitura).
 * - **O foco vai para a resposta**: o título da prévia quando ela chega, o alerta quando falha, o título do resultado ao terminar.
 */

/** O que a tela que usa a peça sabe dizer sobre a planilha dela. */
export interface PlanilhaConfig {
  readonly rotas: RotasDaPlanilha
  /** As colunas do modelo para baixar, na ordem (`CABECALHOS_DA_PLANILHA`; a lista da turma leva só nome e matrícula). */
  readonly cabecalhos: readonly string[]
  readonly nomeDoModelo: string
  readonly instrucao: string
  readonly vazio: { readonly titulo: string; readonly descricao: string }
  readonly rotuloDoGravar: string
  /** Os textos da tela para um código de erro da API, no lugar dos gerais (a lista da turma diz "esta turma"). */
  readonly textosDaFalhaDaPrevia?: Partial<Record<ErrorCode, string>>
  readonly textosDaFalhaDoGravar?: Partial<Record<ErrorCode, string>>
  /** Os textos de erro de linha que a planilha diz do jeito dela, no lugar dos gerais (o calendário: o evento de um dia só é válido). */
  readonly textosDoErroDaLinha?: Readonly<Record<string, string>>
  /**
   * O que a tela diz ao terminar, quando não é a conclusão da planilha de alunos (a grade e o calendário contam aulas e eventos, e não
   * "alunos que entraram"). Sem ela, vale a dos alunos, que conta também as linhas que ficaram de fora.
   */
  readonly textoDaConclusao?: (resumo: ResumoDaImportacao | null) => string
  /** Os textos dos grupos de marca que a planilha diz do jeito dela, no lugar dos de aluno (a de professores desliga professor, e não aluno). */
  readonly textosDosGruposDeMarca?: TextosDosGruposDeMarca
  /** As frases do resumo das marcas ("Ao gravar, com as suas marcas: …") que a planilha diz do jeito dela. */
  readonly frasesDoResumoDeMarcas?: FrasesDoResumoDeMarcas
}

type AlvoDoFoco = 'previa' | 'alerta' | 'conclusao'

interface ArquivoEscolhido {
  readonly numero: number
  readonly nome: string
  /** Sem texto, o arquivo ainda está sendo lido no navegador. */
  readonly texto: string | undefined
}

/** Tudo o que a tela sabe do arquivo escolhido. Um arquivo novo (ou o mesmo de novo) volta a `PLANILHA_NOVA`. */
interface PlanilhaState {
  readonly escolha: ArquivoEscolhido | undefined
  readonly recusa: MotivoDaPlanilhaRecusada | undefined
  readonly previa: { readonly numero: number; readonly resposta: PreviaDaPlanilhaResponse } | undefined
  readonly marcas: MarcasEscolhidas
  readonly conclusao: string | undefined
  readonly demorando: boolean
}

const PLANILHA_NOVA: PlanilhaState = { escolha: undefined, recusa: undefined, previa: undefined, marcas: SEM_MARCAS, conclusao: undefined, demorando: false }

type Mudar = (parcial: Partial<PlanilhaState>) => void

/**
 * O foco vai para a resposta quando ela chega. O pedido fica numa `ref` e o efeito não tem lista de dependências, de propósito: o alvo só
 * entra na tela no render que a resposta provoca, e o efeito, a cada render, atende o pedido quando o alvo está lá. Um arquivo novo tira o
 * pedido (`pendente.current = undefined`), e a resposta atrasada de um arquivo antigo não acha alvo.
 */
function useFocoNaResposta() {
  const pendente = useRef<AlvoDoFoco | undefined>(undefined)
  const previa = useRef<HTMLHeadingElement>(null)
  const conclusao = useRef<HTMLHeadingElement>(null)
  const alerta = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    const pedido = pendente.current
    if (pedido === undefined) return
    const alvo = { previa, conclusao, alerta }[pedido].current
    if (alvo === null) return
    pendente.current = undefined
    alvo.focus()
  })
  /** Pede o foco para a resposta que está para chegar; `undefined` tira o pedido. */
  const pedir = useCallback((alvo: AlvoDoFoco | undefined) => {
    pendente.current = alvo
  }, [])
  return { pedir, previa, conclusao, alerta }
}
type Foco = ReturnType<typeof useFocoNaResposta>

interface PedidoDeGravar {
  readonly texto: string
  readonly marcadas: MarcasEscolhidas
  /** As linhas da prévia que o gravar viu: a conclusão as compara com o que a importação diz que gravou. */
  readonly linhas: readonly PreviaDaPlanilhaRow[]
}

/** O gravar: um pedido só (`useSingleSubmit`), a leitura da importação sem desistir, e o fim que cancela a leitura se a tela sai. */
function useGravacao(configuracao: PlanilhaConfig, aoConcluir: () => unknown, mudar: Mudar, foco: Foco) {
  // O controlador nasce no efeito, não na `ref`: em `StrictMode` o React monta, desmonta e monta de novo, e um controlador criado antes
  // do efeito sairia da primeira desmontagem já cancelado, e o acompanhamento da gravação que vai concluir falharia à toa.
  const controle = useRef<AbortController | undefined>(undefined)
  useEffect(() => {
    const daTela = new AbortController()
    controle.current = daTela
    return () => daTela.abort()
  }, [])
  return useSingleSubmit({
    mutationFn: async ({ texto, marcadas }: PedidoDeGravar) => {
      const { id } = await gravarPlanilha(configuracao.rotas, texto, marcasParaEnviar(marcadas))
      return acompanharImportacao((sinal) => lerImportacao(id, sinal), { sinal: controle.current?.signal, aoDemorar: () => mudar({ demorando: true }) })
    },
    onSuccess: async (importacao, { linhas, marcadas }) => {
      mudar({
        demorando: false,
        previa: undefined,
        conclusao: configuracao.textoDaConclusao?.(importacao.resumo) ?? textoDaConclusao(importacao.resumo, linhasDeFora(linhas, marcadas, importacao.resumo)),
      })
      foco.pedir('conclusao')
      await aoConcluir()
    },
    // A importação que ficou para trás (a escola mudou desde a prévia) tira a prévia; a queda de rede ou do servidor não diz nada dela.
    onError: (erro) => {
      mudar(previaEnvelheceu(erro) ? { demorando: false, previa: undefined } : { demorando: false })
      foco.pedir('alerta')
    },
  })
}

/** O arquivo escolhido e a prévia dele. Cada arquivo é um número: a resposta de um anterior, que chega depois, não é a deste. */
function useArquivoEPrevia(rotas: RotasDaPlanilha, mudar: Mudar, foco: Foco, aoRecomecar: () => void) {
  const contador = useRef(0)
  const controle = useRef<AbortController | undefined>(undefined)
  useEffect(() => () => controle.current?.abort(), [])
  const pedido = useMutation({
    mutationFn: ({ texto, sinal }: { numero: number; texto: string; sinal: AbortSignal }) => previaDaPlanilha(rotas, texto, sinal),
    gcTime: 0,
  })

  function enviar(numero: number, texto: string): void {
    controle.current?.abort()
    const daPrevia = new AbortController()
    controle.current = daPrevia
    pedido.mutate(
      { numero, texto, sinal: daPrevia.signal },
      {
        onSuccess: (resposta) => {
          if (numero !== contador.current) return
          mudar({ previa: { numero, resposta } })
          foco.pedir('previa')
        },
        onError: () => {
          if (numero === contador.current && !daPrevia.signal.aborted) foco.pedir('alerta')
        },
      },
    )
  }

  /** Um arquivo novo, ou o mesmo de novo: tudo o que era do anterior sai, e a prévia anterior no ar é cancelada. */
  function recomecar(): number {
    controle.current?.abort()
    contador.current += 1
    foco.pedir(undefined)
    mudar(PLANILHA_NOVA)
    pedido.reset()
    aoRecomecar()
    return contador.current
  }

  async function escolher(evento: ChangeEvent<HTMLInputElement>): Promise<void> {
    const arquivo = evento.target.files?.[0]
    // Limpa a escolha: a mesma planilha, corrigida e escolhida de novo, precisa disparar outra leitura.
    evento.target.value = ''
    if (arquivo === undefined) return
    const numero = recomecar()
    mudar({ escolha: { numero, nome: arquivo.name, texto: undefined } })
    const lida = await lerPlanilha(arquivo)
    if (numero !== contador.current) return
    if (!lida.ok) {
      mudar({ escolha: undefined, recusa: lida.motivo })
      foco.pedir('alerta')
      return
    }
    mudar({ escolha: { numero, nome: arquivo.name, texto: lida.texto } })
    enviar(numero, lida.texto)
  }

  return { pedido, enviar, escolher }
}

/** O que o alerta da tela diz, se há um: a planilha recusada, a prévia que falhou (do arquivo de agora) ou a gravação que falhou. */
function textoDoAlerta(configuracao: PlanilhaConfig, recusa: MotivoDaPlanilhaRecusada | undefined, falhaDaPrevia: Error | null, falhaDaGravacao: Error | null): string | undefined {
  if (recusa !== undefined) return TEXTO_DA_PLANILHA_RECUSADA[recusa]
  if (falhaDaPrevia !== null) return textoDaFalhaDaPrevia(falhaDaPrevia, configuracao.textosDaFalhaDaPrevia)
  return falhaDaGravacao === null ? undefined : textoDaFalhaDaGravacao(falhaDaGravacao, configuracao.textosDaFalhaDoGravar)
}

/** Sem arquivo e sem recusa (a prévia e o resultado só existem depois de um arquivo): a tela que convida a escolher a planilha. */
const estaVazia = ({ escolha, recusa }: PlanilhaState): boolean => escolha === undefined && recusa === undefined

/** O arquivo está sendo lido no navegador, ou a prévia dele está a caminho. */
const estaLendo = ({ escolha }: PlanilhaState, previaNoAr: boolean): boolean => escolha !== undefined && (escolha.texto === undefined || previaNoAr)

/** O convite do começo, ou o "carregando" de depois da escolha: um dos dois, ou nenhum. */
function ConviteOuLeitura({ configuracao, estado, previaNoAr }: { configuracao: PlanilhaConfig; estado: PlanilhaState; previaNoAr: boolean }) {
  if (estaVazia(estado)) return <EmptyState titulo={configuracao.vazio.titulo} descricao={configuracao.vazio.descricao} />
  if (!estaLendo(estado, previaNoAr)) return null
  return <LoadingState rotulo={estado.escolha?.texto === undefined ? 'Lendo a planilha…' : 'Conferindo a planilha com a escola…'} />
}

interface PropsDaPreviaDaEscolha {
  readonly configuracao: PlanilhaConfig
  readonly estado: PlanilhaState
  readonly mudar: Mudar
  readonly foco: Foco
  readonly gravar: (pedido: PedidoDeGravar) => void
  readonly gravando: boolean
}

/** A prévia do arquivo de agora, com as marcas e o gravar; nada, se a prévia ainda não chegou ou saiu. */
function PreviaDaEscolha({ configuracao, estado, mudar, foco, gravar, gravando }: PropsDaPreviaDaEscolha) {
  const { previa, marcas, escolha } = estado
  if (previa === undefined || escolha?.texto === undefined) return null
  const texto = escolha.texto
  return (
    <PreviaDaPlanilha
      previa={previa.resposta}
      tituloRef={foco.previa}
      rotuloDoGravar={configuracao.rotuloDoGravar}
      textosDoErroDaLinha={configuracao.textosDoErroDaLinha}
      textosDosGruposDeMarca={configuracao.textosDosGruposDeMarca}
      frasesDoResumoDeMarcas={configuracao.frasesDoResumoDeMarcas}
      gravando={gravando}
      demorando={estado.demorando}
      marcas={marcas}
      aoMarcar={(acao, id) => mudar({ marcas: alternarMarca(marcas, acao, id) })}
      aoMarcarTodos={(acao) => mudar({ marcas: alternarTodos(marcas, acao, previa.resposta.candidatos) })}
      aoGravar={() => gravar({ texto, marcadas: marcas, linhas: previa.resposta.linhas })}
    />
  )
}

/** A falha da prévia só vale para o arquivo de agora: a de um arquivo anterior não aparece. */
function falhaDaPreviaDe(pedido: { isError: boolean; error: Error | null; variables: { numero: number } | undefined }, escolha: ArquivoEscolhido | undefined): Error | null {
  return pedido.isError && pedido.variables?.numero === escolha?.numero ? pedido.error : null
}

export function ImportarPlanilha({ configuracao, aoConcluir = () => undefined }: { configuracao: PlanilhaConfig; aoConcluir?: () => unknown }) {
  const [estado, definirEstado] = useState<PlanilhaState>(PLANILHA_NOVA)
  const mudar = useCallback<Mudar>((parcial) => definirEstado((atual) => ({ ...atual, ...parcial })), [])
  const campoDoArquivo = useId()
  const foco = useFocoNaResposta()
  const gravar = useGravacao(configuracao, aoConcluir, mudar, foco)
  const { pedido, enviar, escolher } = useArquivoEPrevia(configuracao.rotas, mudar, foco, gravar.mutacao.reset)
  const { escolha } = estado
  const falhaDaPrevia = falhaDaPreviaDe(pedido, escolha)
  const alerta = textoDoAlerta(configuracao, estado.recusa, falhaDaPrevia, gravar.mutacao.error)
  const tentarDeNovo = falhaDaPrevia === null || escolha?.texto === undefined ? undefined : () => enviar(escolha.numero, escolha.texto ?? '')

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="text-apoio">{configuracao.instrucao}</p>
      <SeletorDoArquivo
        id={campoDoArquivo}
        desligado={gravar.mutacao.isPending}
        escolhido={escolha !== undefined}
        lido={escolha?.texto === undefined ? undefined : escolha.nome}
        aoEscolher={(evento) => void escolher(evento)}
        aoBaixar={() => baixarModelo(configuracao.cabecalhos, configuracao.nomeDoModelo)}
      />
      <ConviteOuLeitura configuracao={configuracao} estado={estado} previaNoAr={pedido.isPending} />
      {alerta !== undefined && <AlertaDaPlanilha texto={alerta} alvo={foco.alerta} aoTentarDeNovo={tentarDeNovo} tentando={pedido.isPending} />}
      <PreviaDaEscolha configuracao={configuracao} estado={estado} mudar={mudar} foco={foco} gravar={gravar.enviar} gravando={gravar.mutacao.isPending} />
      {estado.conclusao !== undefined && <ConclusaoDaPlanilha texto={estado.conclusao} tituloRef={foco.conclusao} />}
    </div>
  )
}

interface PropsDoSeletor {
  readonly id: string
  readonly desligado: boolean
  /** Há arquivo escolhido (lido ou ainda sendo lido): o botão passa a dizer "Trocar arquivo". */
  readonly escolhido: boolean
  /** O nome do arquivo já lido, para a tela dizer de onde veio a prévia. */
  readonly lido: string | undefined
  readonly aoEscolher: (evento: ChangeEvent<HTMLInputElement>) => void
  readonly aoBaixar: () => void
}

/**
 * O campo do arquivo fica escondido e o botão em português o abre: o seletor do navegador escreve "Choose File" e "No file chosen" no
 * idioma dele, e o produto não pode depender do idioma do computador da escola (regra 50, item 12). O rótulo continua ligado ao campo
 * (`htmlFor`) e descreve o botão, para o leitor de tela ler os dois juntos.
 */
function SeletorDoArquivo({ id, desligado, escolhido, lido, aoEscolher, aoBaixar }: PropsDoSeletor) {
  const campo = useRef<HTMLInputElement>(null)
  return (
    <section aria-labelledby={`${id}-titulo`} className="flex min-w-0 flex-col gap-3 rounded-cartao border border-linha bg-superficie p-4">
      <h3 id={`${id}-titulo`} className="font-semibold text-tinta">
        Escolher a planilha
      </h3>
      <div className="flex min-w-0 flex-col gap-2">
        <label htmlFor={id} id={`${id}-rotulo`} className="font-medium">
          Arquivo da planilha (Excel ou CSV)
        </label>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <button type="button" disabled={desligado} aria-describedby={`${id}-rotulo`} onClick={() => campo.current?.click()} className={SECONDARY_BUTTON_CLASSES}>
            {escolhido ? 'Trocar arquivo' : 'Escolher arquivo'}
          </button>
          {!escolhido && <span className="text-apoio">Nenhum arquivo escolhido.</span>}
        </div>
        <input
          ref={campo}
          id={id}
          type="file"
          accept=".xlsx,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain"
          hidden
          tabIndex={-1}
          disabled={desligado}
          onChange={aoEscolher}
        />
        <p role="status" className="text-sm break-words text-apoio empty:hidden">
          {lido !== undefined && `Arquivo lido: ${lido}.`}
        </p>
      </div>
      <div>
        <button type="button" onClick={aoBaixar} className={SECONDARY_BUTTON_CLASSES}>
          Baixar modelo
        </button>
      </div>
    </section>
  )
}

/** O alerta da planilha ou da gravação; só a falha da prévia se tenta de novo (a recusa do arquivo pede outro arquivo). */
function AlertaDaPlanilha({ texto, alvo, aoTentarDeNovo, tentando }: { texto: string; alvo: RefObject<HTMLParagraphElement | null>; aoTentarDeNovo: (() => void) | undefined; tentando: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-controle border border-erro bg-erro-cx p-3">
      <p ref={alvo} tabIndex={-1} role="alert" className="break-words text-erro">
        {texto}
      </p>
      {aoTentarDeNovo !== undefined && (
        <div>
          <Button onClick={aoTentarDeNovo} disabled={tentando}>
            Tentar de novo
          </Button>
        </div>
      )}
    </div>
  )
}

function ConclusaoDaPlanilha({ texto, tituloRef }: { texto: string; tituloRef: RefObject<HTMLHeadingElement | null> }) {
  const idDoTitulo = useId()
  return (
    <section aria-labelledby={idDoTitulo} className="flex min-w-0 flex-col gap-2 rounded-controle border border-ok bg-ok-cx p-4 text-ok">
      <h3 ref={tituloRef} id={idDoTitulo} tabIndex={-1} className="font-semibold">
        Planilha gravada
      </h3>
      <p className="break-words">{texto}</p>
    </section>
  )
}

interface PropsDaPrevia {
  readonly previa: PreviaDaPlanilhaResponse
  /** O título recebe o foco quando a prévia chega: o leitor de tela lê o resumo e as listas em seguida. */
  readonly tituloRef: RefObject<HTMLHeadingElement | null>
  readonly marcas: MarcasEscolhidas
  readonly aoMarcar: (acao: AcaoDeMarca, id: string) => void
  readonly aoMarcarTodos: (acao: AcaoDeMarca) => void
  readonly gravando: boolean
  readonly demorando: boolean
  readonly rotuloDoGravar: string
  readonly textosDoErroDaLinha: Readonly<Record<string, string>> | undefined
  readonly textosDosGruposDeMarca: TextosDosGruposDeMarca | undefined
  readonly frasesDoResumoDeMarcas: FrasesDoResumoDeMarcas | undefined
  readonly aoGravar: () => void
}

function PreviaDaPlanilha({
  previa,
  tituloRef,
  marcas,
  aoMarcar,
  aoMarcarTodos,
  gravando,
  demorando,
  rotuloDoGravar,
  textosDoErroDaLinha,
  textosDosGruposDeMarca,
  frasesDoResumoDeMarcas,
  aoGravar,
}: PropsDaPrevia) {
  const idDoTitulo = useId()
  const { erros, avisos } = linhasDeErroEDeAviso(previa.linhas)
  return (
    <section aria-labelledby={idDoTitulo} className="flex min-w-0 flex-col gap-4 rounded-cartao border border-linha bg-superficie p-4">
      <h3 ref={tituloRef} id={idDoTitulo} tabIndex={-1} className="font-semibold text-tinta">
        Prévia
      </h3>
      <p role="status" className="text-apoio">
        {formatQuantity(previa.linhas.length, 'linha lida', 'linhas lidas')} · {formatQuantity(erros.length, 'com erro', 'com erro')} · {formatQuantity(avisos.length, 'com aviso', 'com aviso')}
      </p>
      {erros.length > 0 && <ListaDeLinhas titulo="Linhas com erro" linhas={erros} textoDe={(linha) => textoDoErro(linha.erro, textosDoErroDaLinha)} tom="erro" />}
      {avisos.length > 0 && <ListaDeLinhas titulo="Linhas com aviso" linhas={avisos} textoDe={(linha) => textoDoAviso(linha.aviso)} tom="aviso" />}
      {previa.candidatos.length > 0 && (
        <MarcasDaPrevia candidatos={previa.candidatos} marcas={marcas} textos={textosDosGruposDeMarca} aoMarcar={aoMarcar} aoMarcarTodos={aoMarcarTodos} />
      )}
      <RestoDaPlanilha linhas={previa.linhas} contagens={previa.contagens} />
      <GravarDaPrevia gravacao={podeGravar(previa, totalDeMarcas(marcas))} resumoDasMarcas={resumoDasMarcas(marcas, frasesDoResumoDeMarcas)} rotulo={rotuloDoGravar} gravando={gravando} demorando={demorando} aoGravar={aoGravar} />
    </section>
  )
}

/** O resto da planilha em contagem, sem nome nem matrícula: o que entra, o que já existe, o que só muda com a marca. */
function RestoDaPlanilha({ linhas, contagens }: { linhas: readonly PreviaDaPlanilhaRow[]; contagens: ResumoDaImportacao }) {
  const idDoTitulo = useId()
  const resto = frasesDoResto(linhas)
  const efeitos = frasesDasContagens(contagens)
  if (resto.length === 0 && efeitos.length === 0) return null
  return (
    <section aria-labelledby={idDoTitulo} className="flex min-w-0 flex-col gap-1">
      <h4 id={idDoTitulo} className="font-medium text-tinta">
        O resto da planilha
      </h4>
      {resto.length > 0 && <p className="break-words text-apoio">{resto.join(' · ')}</p>}
      {efeitos.map((frase) => (
        <p key={frase} className="text-apoio">
          {frase}
        </p>
      ))}
    </section>
  )
}

interface PropsDoGravar {
  readonly gravacao: ReturnType<typeof podeGravar>
  /** O que as marcas escolhidas vão fazer ao gravar, em uma frase; `undefined` sem marca (regra 50, item 8). */
  readonly resumoDasMarcas: string | undefined
  readonly rotulo: string
  readonly gravando: boolean
  readonly demorando: boolean
  readonly aoGravar: () => void
}

/** Com erro na prévia o botão nem aparece, e o motivo está no lugar dele (RF2). */
function GravarDaPrevia({ gravacao, resumoDasMarcas, rotulo, gravando, demorando, aoGravar }: PropsDoGravar) {
  if (!gravacao.pode) return <p className="break-words text-apoio">{gravacao.motivo}</p>
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {resumoDasMarcas !== undefined && <p className="break-words font-medium text-tinta">{resumoDasMarcas}</p>}
      <div>
        <Button onClick={aoGravar} disabled={gravando}>
          {gravando ? 'Gravando…' : rotulo}
        </Button>
      </div>
      <p role="status" className="text-sm break-words text-apoio empty:hidden">
        {gravando && 'Gravando a planilha. Pode levar alguns segundos.'}
        {gravando && demorando && ' A fila está mais cheia que o normal: a gravação continua e você pode esperar aqui. Se sair desta tela, ela termina sozinha.'}
      </p>
    </div>
  )
}

/** Os erros (ou os avisos) um a um, de cem em cem: a planilha de 3.000 linhas com problema em todas não vira 3.000 cartões. */
function ListaDeLinhas({ titulo, linhas, textoDe, tom }: { titulo: string; linhas: readonly PreviaDaPlanilhaRow[]; textoDe: (linha: PreviaDaPlanilhaRow) => string; tom: 'erro' | 'aviso' }) {
  const [paginas, definirPaginas] = useState(1)
  const idDoTitulo = useId()
  const escondidos = itensEscondidos(linhas.length, paginas)
  const cores = tom === 'erro' ? 'border-erro bg-erro-cx text-erro' : 'border-pendente bg-pendente-cx text-pendente'
  return (
    <section aria-labelledby={idDoTitulo} className="flex min-w-0 flex-col gap-2">
      <h4 id={idDoTitulo} className="font-medium text-tinta">
        {titulo} ({formatNumber(linhas.length)})
      </h4>
      <ol className="flex flex-col gap-2">
        {fatiaDaLista(linhas, paginas).map((linha) => (
          <li key={linha.linha} className={`min-w-0 rounded-controle border p-3 break-words ${cores}`}>
            <span className="font-medium">Linha {linha.linha}</span>
            {': '}
            {textoDe(linha)}
          </li>
        ))}
      </ol>
      {escondidos > 0 && (
        <button type="button" onClick={() => definirPaginas((atual) => atual + 1)} className={`${SECONDARY_BUTTON_CLASSES} self-start`}>
          Ver mais ({formatNumber(escondidos)} restantes)
        </button>
      )}
    </section>
  )
}

/**
 * As marcas: cada candidato com o rótulo que a API devolve, para a coordenação conferir: nome e matrícula no aluno, só o nome no
 * professor (o e-mail dele não sai da API, E11). Quem usa esta peça não acrescenta matrícula nem e-mail ao rótulo. Chegam desmarcados,
 * e o "marcar todos" também (regra 70, item 2). O rótulo só aparece aqui, nunca na contagem do resto.
 */
function MarcasDaPrevia({
  candidatos,
  marcas,
  textos,
  aoMarcar,
  aoMarcarTodos,
}: {
  candidatos: readonly CandidatoDaMarca[]
  marcas: MarcasEscolhidas
  textos: TextosDosGruposDeMarca | undefined
  aoMarcar: (acao: AcaoDeMarca, id: string) => void
  aoMarcarTodos: (acao: AcaoDeMarca) => void
}) {
  const idDoTitulo = useId()
  return (
    <section aria-labelledby={idDoTitulo} className="flex min-w-0 flex-col gap-3">
      <h4 id={idDoTitulo} className="font-medium text-tinta">
        Você decide
      </h4>
      <p className="text-sm break-words text-apoio">{TEXTO_DA_CONFERENCIA}</p>
      {ACOES_DE_MARCA.map((acao) => {
        const doGrupo = candidatosDa(candidatos, acao)
        return doGrupo.length === 0 ? null : <GrupoDeMarca key={acao} acao={acao} texto={textoDoGrupoDeMarca(acao, textos)} candidatos={doGrupo} escolhidos={marcas[acao]} aoMarcar={aoMarcar} aoMarcarTodos={aoMarcarTodos} />
      })}
    </section>
  )
}

function GrupoDeMarca({
  acao,
  texto,
  candidatos,
  escolhidos,
  aoMarcar,
  aoMarcarTodos,
}: {
  acao: AcaoDeMarca
  texto: TextoDoGrupoDeMarca
  candidatos: readonly CandidatoDaMarca[]
  escolhidos: ReadonlySet<string>
  aoMarcar: (acao: AcaoDeMarca, id: string) => void
  aoMarcarTodos: (acao: AcaoDeMarca) => void
}) {
  const [paginas, definirPaginas] = useState(1)
  const todos = candidatos.every(({ id }) => escolhidos.has(id))
  const escondidos = itensEscondidos(candidatos.length, paginas)
  return (
    <fieldset className="flex min-w-0 flex-col gap-2 rounded-controle border border-linha p-3">
      <legend className="px-1 font-medium text-tinta">
        {texto.titulo} ({formatNumber(candidatos.length)})
      </legend>
      <p className="text-sm break-words text-apoio">{texto.explicacao}</p>
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" checked={todos} onChange={() => aoMarcarTodos(acao)} className="size-5 shrink-0" />
        <span>{texto.rotuloDoTodos}</span>
      </label>
      <ul className="flex flex-col">
        {fatiaDaLista(candidatos, paginas).map((candidato) => (
          <li key={candidato.id}>
            <label className="flex min-h-11 items-center gap-3 break-words">
              <input type="checkbox" checked={escolhidos.has(candidato.id)} onChange={() => aoMarcar(acao, candidato.id)} className="size-5 shrink-0" />
              <span className="min-w-0">{candidato.rotulo}</span>
            </label>
          </li>
        ))}
      </ul>
      {escondidos > 0 && (
        <button type="button" onClick={() => definirPaginas((atual) => atual + 1)} className={`${SECONDARY_BUTTON_CLASSES} self-start`}>
          Ver mais ({formatNumber(escondidos)} restantes)
        </button>
      )}
    </fieldset>
  )
}
