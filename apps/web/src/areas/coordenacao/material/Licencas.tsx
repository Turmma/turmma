import type { Licenca, RegistrarLicencaRequest } from '@educa/shared'
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState, type Ref } from 'react'
import { errorMessage } from '../../../api/client'
import type { ListaDaEstrutura } from '../../../api/estrutura'
import { aoTrocarDeSessao } from '../../../api/sessao'
import { StatusAnnouncement, useSingleSubmit } from '../../../components/dialogs'
import { ErrorState, EmptyState, LoadingState } from '../../../components/states/index'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { useDialogState, type DialogOpening } from '../../../components/ui/overlays/dialog-state'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { Table, type TableColumn } from '../../../components/ui/Table'
import { useFocusPageHeading } from '../comum/moldura'
import { AvisoDeListaIncompleta } from '../comum/pecas-da-lista'
import { licencasQueryOptions, registrarLicenca } from './api/licencas'
import { DialogoDaVigencia, DialogoDeRegistroDeLicenca } from './DialogoDeLicenca'
import {
  dataDaLicenca,
  diaDeHojeEmSaoPaulo,
  FAMILIA_DA_SITUACAO_DA_LICENCA,
  registradaAntesDaF4,
  textoDaBuscaDaLicenca,
  textoDaSituacaoDaLicenca,
  textoDosMateriais,
} from './licencas'

/** Os diálogos da aba, um por vez. A vigência leva a licença da linha. */
type TipoDeDialogo = 'registrar' | 'vigencia'

interface Registro {
  readonly pedido: RegistrarLicencaRequest
  /** A abertura em que o pedido saiu: a resposta só fecha o diálogo se ele ainda é este. */
  readonly abertura: DialogOpening<TipoDeDialogo, Licenca>
}

const TEXTO_DO_REGISTRO = 'Licença registrada. Ela já pode ser escolhida no envio de material de terceiro.'
const TEXTO_DA_VIGENCIA = 'Vigência alterada. A busca do Assistente e do Tutor já segue a vigência nova.'
const TEXTO_DO_REGISTRO_QUE_FALHOU = 'A licença não foi registrada. Confira a lista antes de tentar de novo: se o pedido chegou, ela já está aqui.'

function colunasDasLicencas(aoMudarAVigencia: (licenca: Licenca) => void): readonly [TableColumn<Licenca>, ...TableColumn<Licenca>[]] {
  return [
    {
      chave: 'licenca',
      titulo: 'Licença',
      celula: (licenca) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-semibold break-words text-tinta">{licenca.licenciante}</span>
          <span className="text-sm break-words text-apoio">{licenca.cobertura}</span>
          <span className="text-sm break-words text-apoio">Documento: {registradaAntesDaF4(licenca) ? 'não informado' : licenca.referencia}</span>
          {registradaAntesDaF4(licenca) && (
            <span className="mt-1">
              <StatusBadge familia="pendente">Criada automaticamente · revise</StatusBadge>
            </span>
          )}
        </div>
      ),
    },
    {
      chave: 'situacao',
      titulo: 'Situação',
      celula: (licenca) => (
        <div className="flex min-w-0 flex-col items-start gap-2">
          <StatusBadge familia={FAMILIA_DA_SITUACAO_DA_LICENCA[licenca.situacao]}>{textoDaSituacaoDaLicenca(licenca)}</StatusBadge>
          <p className="max-w-prose text-sm break-words text-apoio">{textoDaBuscaDaLicenca(licenca)}</p>
        </div>
      ),
    },
    {
      chave: 'vigencia',
      titulo: 'Vigência',
      celula: (licenca) => (
        <div className="flex min-w-0 flex-col items-start gap-2">
          <dl className="flex min-w-0 flex-col gap-0.5 text-sm">
            <div className="flex flex-wrap gap-x-1.5">
              <dt className="text-apoio">Começa em</dt>
              <dd className="text-tinta">{dataDaLicenca(licenca.vigenteDesde)}</dd>
            </div>
            <div className="flex flex-wrap gap-x-1.5">
              <dt className="text-apoio">Termina em</dt>
              <dd className="text-tinta">{licenca.vigenteAte === null ? 'Sem data de fim' : dataDaLicenca(licenca.vigenteAte)}</dd>
            </div>
          </dl>
          <Button variante="secundario" onClick={() => aoMudarAVigencia(licenca)}>
            Mudar a vigência <span className="sr-only">da licença de {licenca.licenciante}</span>
          </Button>
        </div>
      ),
    },
    { chave: 'materiais', titulo: 'Materiais', celula: (licenca) => textoDosMateriais(licenca.materiais) },
  ]
}

/** A leitura da lista de licenças, como o TanStack Query a entrega: a tela decide o estado só pelo que ela diz. */
type LeituraDeLicencas = UseQueryResult<ListaDaEstrutura<Licenca>>

interface PropsDaListaComDado {
  readonly lista: ListaDaEstrutura<Licenca>
  readonly licencas: LeituraDeLicencas
  readonly emRegistro: boolean
  readonly aoRegistrar: () => void
  readonly aoMudarAVigencia: (licenca: Licenca) => void
  readonly tituloDaLista: Ref<HTMLHeadingElement>
}

/** O estado "com dado": o título, "Registrar licença", a faixa da migração, a falha da releitura e a tabela. */
function ListaComDado({ lista, licencas, emRegistro, aoRegistrar, aoMudarAVigencia, tituloDaLista }: PropsDaListaComDado) {
  const antesDaF4 = lista.itens.filter(registradaAntesDaF4).length
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 ref={tituloDaLista} tabIndex={-1} className="text-lg font-semibold text-tinta">
          Licenças de material
        </h2>
        <Button onClick={aoRegistrar} disabled={emRegistro}>
          {emRegistro ? 'Registrando…' : 'Registrar licença'}
        </Button>
      </div>
      {antesDaF4 > 0 && (
        <Alert tom="atencao" titulo={antesDaF4 === 1 ? 'Uma licença foi criada a partir do nome da editora de cada material' : `${String(antesDaF4)} licenças foram criadas a partir do nome da editora de cada material`}>
          Elas nasceram do nome do licenciante que cada material já tinha, sem data de fim. Revise a vigência de cada uma: a que vence tira da busca os materiais que cobre.
        </Alert>
      )}
      {/* Com a lista já na tela, a releitura que falhou é dita aqui: o `primario` da tela é um só, o "Registrar licença". */}
      {licencas.isError && <FalhaDaReleitura licencas={licencas} />}
      <Table rotulo="Lista de licenças" colunas={colunasDasLicencas(aoMudarAVigencia)} linhas={lista.itens} chaveDaLinha={(licenca) => licenca.id} />
      <AvisoDeListaIncompleta completa={lista.completa} />
    </>
  )
}

/** A releitura que falhou com a lista já na tela: a falha, "Tentar de novo" e o "Tentando de novo…" falado. */
function FalhaDaReleitura({ licencas }: { readonly licencas: LeituraDeLicencas }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-cartao border border-erro bg-erro-cx p-4">
      <p role="alert" className="min-w-0 flex-1 basis-56 break-words text-erro">
        {errorMessage(licencas.error)}
      </p>
      <Button variante="secundario" onClick={() => void licencas.refetch({ cancelRefetch: false })}>
        Tentar de novo
      </Button>
      <span role="status" className="text-erro">
        {licencas.isFetching ? 'Tentando de novo…' : ''}
      </span>
    </div>
  )
}

type PropsDoConteudo = Omit<PropsDaListaComDado, 'lista'>

/** Os quatro estados da aba: carregando; erro com "Tentar de novo"; vazio, que convida a registrar; e com dado. */
function ConteudoDaAba({ licencas, emRegistro, aoRegistrar, aoMudarAVigencia, tituloDaLista }: PropsDoConteudo) {
  const lista = licencas.data
  const erroDaLeitura = <ErrorState erro={licencas.error} tentando={licencas.isFetching} aoTentarDeNovo={() => void licencas.refetch({ cancelRefetch: false })} />
  return licencas.isPending ? (
    <LoadingState rotulo="Carregando as licenças…" />
  ) : lista === undefined ? (
    erroDaLeitura
  ) : lista.itens.length === 0 ? (
    // A releitura que cai com a lista ainda vazia não afirma o vazio: a lista de antes já não vale.
    licencas.isError ? (
      erroDaLeitura
    ) : (
      <EmptyState
        titulo="Nenhuma licença registrada"
        descricao="Registre a licença de uma editora, de um sistema de ensino ou de um autor uma vez: o material de terceiro só entra citando uma licença vigente."
        acao={{ rotulo: 'Registrar licença', aoAcionar: aoRegistrar, desligada: emRegistro, emAndamento: emRegistro }}
      />
    )
  ) : (
    <ListaComDado lista={lista} licencas={licencas} emRegistro={emRegistro} aoRegistrar={aoRegistrar} aoMudarAVigencia={aoMudarAVigencia} tituloDaLista={tituloDaLista} />
  )
}

interface PropsDosDialogos {
  readonly aberta: DialogOpening<TipoDeDialogo, Licenca> | undefined
  readonly emRegistro: boolean
  readonly erroDoRegistro: unknown
  readonly aoEnviar: (registro: Registro) => void
  readonly aoFechar: () => void
  readonly aoAlterar: (abertura: DialogOpening<TipoDeDialogo, Licenca>) => void
  readonly recarregar: () => Promise<void>
  readonly focoDeReserva: () => void
}

/** Os dois diálogos da aba, um por vez; cada abertura é um formulário novo (`key`). */
function DialogosDeLicencas({ aberta, emRegistro, erroDoRegistro, aoEnviar, aoFechar, aoAlterar, recarregar, focoDeReserva }: PropsDosDialogos) {
  return (
    <>
      {aberta?.tipo === 'registrar' && (
        <DialogoDeRegistroDeLicenca
          key={aberta.numero}
          enviando={emRegistro}
          erro={erroDoRegistro ?? undefined}
          aoEnviar={(pedido) => aoEnviar({ pedido, abertura: aberta })}
          aoFechar={aoFechar}
          focoDeReserva={focoDeReserva}
        />
      )}
      {aberta?.tipo === 'vigencia' && aberta.alvo !== undefined && (
        <DialogoDaVigencia
          key={aberta.numero}
          licenca={aberta.alvo}
          hoje={diaDeHojeEmSaoPaulo()}
          recarregar={recarregar}
          aoAlterar={() => aoAlterar(aberta)}
          aoFechar={aoFechar}
          focoDeReserva={focoDeReserva}
        />
      )}
    </>
  )
}

/**
 * Escola › Material › Licenças (ingestao-do-material, 6.0; RF16 e RF17; D5, D75): a coordenação vê cada licença de material com a situação,
 * a vigência e quantos materiais ela cobre, registra uma nova e muda a vigência sabendo, antes de confirmar, quantos materiais saem da
 * busca ou voltam a ela. A licença não se exclui: encerra-se pelo fim da vigência.
 *
 * - **A situação é da API** (`situacao`, do dia de São Paulo) e se lê em texto e em cor. **Nada aqui bloqueia ou esconde material do
 *   aluno**: quem decide é a coordenação, ao mudar a vigência, e a tela só diz o que a mudança faz com a busca.
 * - **As licenças de antes da F4** (a rotina de migração as criou a partir do licenciante de cada material) vêm destacadas para a
 *   coordenação as revisar.
 * - **Registrar é um pedido por vez**: `POST /v1/licencas` não tem idempotência, e por isso o pedido vive na tela (`useSingleSubmit`),
 *   que o segura mesmo com o diálogo fechado, e o botão fica desligado enquanto ele corre.
 * - A lista se relê por ação da pessoa (registrar, vigência, "Tentar de novo") e nunca por tempo.
 *
 * Os quatro estados: carregando; erro com "Tentar de novo"; vazio, que convida a registrar a primeira licença; e com dado.
 */
export function Licencas() {
  const cliente = useQueryClient()
  const licencas = useQuery(licencasQueryOptions)
  const dialogo = useDialogState<TipoDeDialogo, Licenca>()
  const aberta = dialogo.aberta
  const fecharDialogo = dialogo.fechar
  const [anuncio, definirAnuncio] = useState('')
  const tituloDaLista = useRef<HTMLHeadingElement>(null)
  const focarOTituloDaMoldura = useFocusPageHeading()

  const recarregar = useCallback(() => cliente.invalidateQueries({ queryKey: licencasQueryOptions.queryKey, exact: true }), [cliente])
  // O foco quando o botão que abriu o diálogo saiu da tela (o "Registrar licença" do vazio): vai ao título da lista, ou ao da moldura.
  const focarNaLista = useCallback(() => (tituloDaLista.current === null ? focarOTituloDaMoldura() : tituloDaLista.current.focus()), [focarOTituloDaMoldura])

  const { enviar, mutacao: registro } = useSingleSubmit<Registro, Licenca>({
    mutationFn: ({ pedido }) => registrarLicenca(pedido),
    onSuccess: async (_licenca, { abertura }) => {
      await recarregar()
      dialogo.fecharSeAinda(abertura)
      definirAnuncio(TEXTO_DO_REGISTRO)
    },
    // Com a resposta perdida, o pedido pode ter chegado: a lista relida diz.
    onError: () => void recarregar(),
  })
  const reiniciarORegistro = registro.reset

  // A sessão que acaba ou muda de dono leva o que a pessoa fazia: o diálogo, o aviso e a falha do pedido anterior não passam à seguinte.
  useEffect(
    () =>
      aoTrocarDeSessao(() => {
        fecharDialogo()
        definirAnuncio('')
        reiniciarORegistro()
      }),
    [fecharDialogo, reiniciarORegistro],
  )

  const emRegistro = registro.isPending

  /**
   * Abrir um diálogo apaga o anúncio e a falha da ação anterior: o que eles diziam já não é o que a pessoa está fazendo. Com o registro no ar
   * a falha ainda não existe, e soltar o pedido do observador desligaria o "Registrando…" com ele ainda correndo.
   */
  function abrir(tipo: TipoDeDialogo, licenca?: Licenca): void {
    definirAnuncio('')
    if (!emRegistro) reiniciarORegistro()
    dialogo.abrir(tipo, licenca)
  }

  const doRegistroQueFalhou = registro.isError && aberta?.tipo !== 'registrar'

  return (
    <section className="flex min-w-0 flex-col gap-6" aria-label="Licenças de material">
      <ConteudoDaAba
        licencas={licencas}
        emRegistro={emRegistro}
        aoRegistrar={() => abrir('registrar')}
        aoMudarAVigencia={(licenca) => abrir('vigencia', licenca)}
        tituloDaLista={tituloDaLista}
      />
      <StatusAnnouncement texto={anuncio} />
      {/* O registro que falhou com o diálogo já fechado: a pessoa o vê aqui, e a lista relida diz se a licença chegou a ser criada. */}
      {doRegistroQueFalhou && (
        <AvisoDoRegistroQueFalhou aoDispensar={reiniciarORegistro} />
      )}
      <DialogosDeLicencas
        aberta={aberta}
        emRegistro={emRegistro}
        erroDoRegistro={registro.error}
        aoEnviar={enviar}
        aoFechar={fecharDialogo}
        aoAlterar={(abertura) => {
          dialogo.fecharSeAinda(abertura)
          definirAnuncio(TEXTO_DA_VIGENCIA)
        }}
        recarregar={recarregar}
        focoDeReserva={focarNaLista}
      />
    </section>
  )
}

/** O registro que falhou com o diálogo fechado: o aviso e o "Dispensar o aviso". */
function AvisoDoRegistroQueFalhou({ aoDispensar }: { readonly aoDispensar: () => void }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-cartao border border-erro bg-erro-cx p-4">
      <p role="alert" className="min-w-0 flex-1 basis-56 break-words text-erro">
        {TEXTO_DO_REGISTRO_QUE_FALHOU}
      </p>
      <Button variante="secundario" onClick={aoDispensar}>
        Dispensar o aviso
      </Button>
    </div>
  )
}
