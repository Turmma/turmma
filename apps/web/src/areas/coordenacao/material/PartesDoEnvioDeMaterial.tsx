import { nomeDaSerie, TAMANHO_MAXIMO_TITULO_DO_MATERIAL } from '@educa/shared'
import { useQuery } from '@tanstack/react-query'
import { FileText, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type DragEvent, type RefObject } from 'react'
import { Link } from 'wouter'
import { seriesQueryOptions } from '../../../api/estrutura'
import { Button } from '../../../components/ui/Button'
import { SECONDARY_BUTTON_CLASSES, SECONDARY_LINK_CLASSES } from '../../../components/ui/button-variants'
import { FieldError, FormField, RequiredMark } from '../../../components/ui/fields/FormField'
import { Select } from '../../../components/ui/fields/Select'
import { caminhoDasLicencas, COORDENACAO_ROUTES } from '../../../paths'
import { textoDaSituacaoDaLicenca } from './licencas'
import { devePartir, MAXIMO_DE_ARQUIVOS_DO_LOTE, resumoDoLote, tamanhoPorExtenso, textoDoItem, type ItemDoLote } from './material-envio'
import type { useLoteDeMaterial } from './use-lote-de-material'

/** As peças do diálogo "Enviar material" (ingestao-do-material, 7.0): cada uma é uma parte do formulário, com o estado no `useLoteDeMaterial`. */

export type LoteDeMaterial = ReturnType<typeof useLoteDeMaterial>

interface AreaProps {
  readonly lote: LoteDeMaterial
  readonly erroDoArquivo: string | undefined
  readonly travado: boolean
  readonly umArquivoSo: boolean
  readonly botao: RefObject<HTMLButtonElement | null>
}

/** Onde o arquivo entra: arrastado **ou** pelo botão (nada aqui só funciona arrastando, regra 50, item 2a). */
export function AreaDeArquivos({ lote, erroDoArquivo, travado, umArquivoSo, botao }: AreaProps) {
  const [sobre, definirSobre] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)
  const idDoErro = 'erro-do-arquivo-do-material'
  const comErro = erroDoArquivo !== undefined || lote.problemas.length > 0
  const vazia = lote.itens.length === 0

  // O seletor de arquivo que se fecha sem escolha — ou com os mesmos arquivos de antes — faz o navegador disparar `cancel` no `input`,
  // e esse evento sobe até o `dialog`, cujo `cancel` é o Esc: o diálogo fecharia, com o formulário que a pessoa já preencheu.
  useEffect(() => {
    const campo = entrada.current
    if (campo === null) return
    const reter = (evento: Event): void => evento.stopPropagation()
    campo.addEventListener('cancel', reter)
    return () => campo.removeEventListener('cancel', reter)
  }, [])

  function aoSoltar(evento: DragEvent<HTMLDivElement>): void {
    evento.preventDefault()
    definirSobre(false)
    void lote.receberArquivos(evento.dataTransfer.files)
  }

  const moldura = sobre ? 'border-tinta bg-realce-suave' : comErro ? 'border-erro' : 'border-borda-campo'
  const dica = umArquivoSo ? 'Arraste o PDF para cá, ou escolha o arquivo. Com até 20 MB.' : `Arraste até ${String(MAXIMO_DE_ARQUIVOS_DO_LOTE)} PDFs para cá, ou escolha os arquivos. Cada um com até 20 MB.`
  return (
    <div
      onDragOver={(evento) => {
        evento.preventDefault()
        definirSobre(true)
      }}
      onDragLeave={() => definirSobre(false)}
      onDrop={aoSoltar}
      className={`flex min-w-0 flex-col items-center gap-2 rounded-cartao border border-dashed p-5 text-center ${moldura}`}
    >
      {vazia ? <Upload aria-hidden="true" size={24} strokeWidth={1.75} className="text-sutil" /> : <FileText aria-hidden="true" size={24} strokeWidth={1.75} className="text-ok" />}
      <p className="text-apoio">{dica}</p>
      <button
        ref={botao}
        type="button"
        className={`${SECONDARY_BUTTON_CLASSES} min-h-11`}
        disabled={travado || lote.conferindo}
        onClick={() => entrada.current?.click()}
        {...(comErro ? { 'aria-describedby': idDoErro } : {})}
      >
        {rotuloDoBotaoDeArquivo(vazia, umArquivoSo)}
      </button>
      <input
        ref={entrada}
        type="file"
        accept="application/pdf,.pdf"
        multiple={!umArquivoSo}
        hidden
        tabIndex={-1}
        onChange={(evento) => {
          void lote.receberArquivos(evento.target.files)
          evento.target.value = ''
        }}
        data-testid="arquivo-do-material"
      />
      <div id={idDoErro} role="alert" className="flex flex-col gap-1 text-sm text-erro empty:hidden">
        {erroDoArquivo !== undefined && <p>{erroDoArquivo}</p>}
        {lote.problemas.map((problema) => (
          <p key={problema} className="break-words">
            {problema}
          </p>
        ))}
      </div>
    </div>
  )
}

function rotuloDoBotaoDeArquivo(vazia: boolean, umArquivoSo: boolean): string {
  if (vazia) return umArquivoSo ? 'Escolher arquivo' : 'Escolher arquivos'
  return umArquivoSo ? 'Trocar arquivo' : 'Escolher mais arquivos'
}

interface ListaProps {
  readonly lote: LoteDeMaterial
  readonly errosDosTitulos: ReadonlyMap<number, string>
  readonly umArquivoSo: boolean
  readonly resumo: RefObject<HTMLParagraphElement | null>
}

/** Os arquivos do lote: o nome, o tamanho, o título editável e o que aconteceu com cada um. */
export function ListaDoLote({ lote, errosDosTitulos, umArquivoSo, resumo }: ListaProps) {
  if (lote.itens.length === 0) return null
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p ref={resumo} tabIndex={-1} className="font-semibold text-tinta">
        {resumoDoLote(lote.itens)}
      </p>
      <ul aria-label="Arquivos do lote" className="flex min-w-0 flex-col gap-3">
        {lote.itens.map((item) => (
          <ItemDaLista key={item.chave} item={item} editavel={devePartir(item) && !lote.emCurso} podeTirar={!umArquivoSo} erro={errosDosTitulos.get(item.chave)} lote={lote} />
        ))}
      </ul>
    </div>
  )
}

function corDoItem(situacao: ItemDoLote['situacao']): string {
  if (situacao === 'falhou') return 'text-erro'
  return situacao === 'enviado' ? 'text-ok' : 'text-apoio'
}

function ItemDaLista({ item, editavel, podeTirar, erro, lote }: { readonly item: ItemDoLote; readonly editavel: boolean; readonly podeTirar: boolean; readonly erro: string | undefined; readonly lote: LoteDeMaterial }) {
  return (
    <li data-situacao={item.situacao} className="flex min-w-0 flex-col gap-2 rounded-cartao border border-borda-campo p-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 break-words font-medium text-tinta">
          {item.arquivo.name} <span className="font-normal text-apoio">· {tamanhoPorExtenso(item.arquivo.size)}</span>
        </p>
        {editavel && podeTirar && (
          <Button variante="discreto" onClick={() => lote.tirar(item.chave)}>
            Tirar <span className="sr-only">{item.arquivo.name} do lote</span>
          </Button>
        )}
      </div>
      <div data-campo="titulo">
        <FormField
          rotulo="Título"
          aria-label={`Título de ${item.arquivo.name}`}
          value={item.titulo}
          maxLength={TAMANHO_MAXIMO_TITULO_DO_MATERIAL}
          disabled={!editavel}
          onChange={(evento) => lote.mudarTitulo(item.chave, evento.target.value)}
          erro={erro}
          autoComplete="off"
        />
      </div>
      <p className={`text-sm break-words ${corDoItem(item.situacao)}`}>{textoDoItem(item)}</p>
    </li>
  )
}

interface SeriesProps {
  readonly marcadas: readonly string[]
  readonly aoMudar: (serieIds: string[]) => void
  readonly erro: string | undefined
  readonly desligado: boolean
}

const ID_DO_ERRO_DAS_SERIES = 'erro-das-series-do-material'

/** As séries que enxergam o material (de 1 a 7): lidas da escola, marcadas uma a uma. O erro descreve o grupo (`aria-describedby`): `aria-invalid` não vale no papel de grupo. */
export function CampoDeSeries({ marcadas, aoMudar, erro, desligado }: SeriesProps) {
  return (
    <fieldset data-campo="serieIds" className="flex min-w-0 flex-col gap-1" disabled={desligado} {...(erro === undefined ? {} : { 'aria-describedby': ID_DO_ERRO_DAS_SERIES })}>
      <legend className="t-apoio font-bold text-tinta">
        Séries do material
        <RequiredMark />
      </legend>
      <p className="t-apoio text-apoio">Quem enxerga o material é o professor e o Tutor da série marcada.</p>
      <SeriesLidas marcadas={marcadas} aoMudar={aoMudar} />
      {erro !== undefined && <FieldError id={ID_DO_ERRO_DAS_SERIES}>{erro}</FieldError>}
    </fieldset>
  )
}

function SeriesLidas({ marcadas, aoMudar }: Pick<SeriesProps, 'marcadas' | 'aoMudar'>) {
  const series = useQuery(seriesQueryOptions)
  const ordenadas = useMemo(() => (series.data?.itens ?? []).toSorted((a, b) => a.etapa.localeCompare(b.etapa) || a.ano - b.ano), [series.data])
  if (series.isPending)
    return (
      <p role="status" className="text-apoio">
        Carregando as séries…
      </p>
    )
  if (series.isError)
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <p role="alert" className="text-erro">
          Não foi possível ler as séries da escola.
        </p>
        <Button variante="secundario" onClick={() => void series.refetch({ cancelRefetch: false })}>
          Tentar de novo <span className="sr-only">ler as séries</span>
        </Button>
      </div>
    )
  if (ordenadas.length === 0)
    return (
      <div className="flex min-w-0 flex-col items-start gap-2">
        <p className="text-apoio">A escola ainda não tem séries. Crie as séries em Escola › Turmas antes de enviar material.</p>
        <Link to={COORDENACAO_ROUTES.estrutura} className={SECONDARY_LINK_CLASSES}>
          Ir para Escola
        </Link>
      </div>
    )
  return (
    <div className="flex min-w-0 flex-wrap gap-x-6">
      {ordenadas.map((serie) => (
        <label key={serie.id} className="flex min-h-11 min-w-0 items-center gap-3 text-tinta">
          <input
            type="checkbox"
            checked={marcadas.includes(serie.id)}
            onChange={(evento) => aoMudar(evento.target.checked ? [...marcadas, serie.id] : marcadas.filter((id) => id !== serie.id))}
            className="size-6 shrink-0 accent-tinta"
          />
          <span className="min-w-0 break-words">{nomeDaSerie(serie)}</span>
        </label>
      ))}
    </div>
  )
}

interface LicencaRegistradaProps {
  readonly lote: LoteDeMaterial
  readonly erro: string | undefined
}

/** A licença registrada que o material de terceiro cita: só as que valem hoje, lidas de novo ao abrir e ao voltar ao foco (R6). */
export function CampoDeLicencaRegistrada({ lote, erro }: LicencaRegistradaProps) {
  const { licencas, validas } = lote
  return (
    <div data-campo="licencaId" className="min-w-0">
      {licencas.isPending ? (
        <p role="status" className="text-apoio">
          Lendo as licenças registradas…
        </p>
      ) : validas === undefined ? (
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <p role="alert" className="text-erro">
            Não foi possível ler as licenças registradas.
          </p>
          <Button variante="secundario" onClick={() => void licencas.refetch({ cancelRefetch: false })}>
            Tentar de novo <span className="sr-only">ler as licenças</span>
          </Button>
        </div>
      ) : validas.length === 0 ? (
        <SemLicencaVigente />
      ) : (
        <Select
          rotulo="Licença registrada do material"
          marcador="Escolha a licença"
          opcoes={validas.map((licenca) => ({ valor: licenca.id, rotulo: `${licenca.licenciante} · ${textoDaSituacaoDaLicenca(licenca)}` }))}
          valor={lote.efetivo.licencaId}
          aoMudar={(licencaId) => lote.mudar({ licencaId })}
          dica={lote.licencaSumiu ? 'A licença que você tinha escolhido não vale mais. Escolha outra, ou atualize a vigência dela em Licenças.' : 'Só as licenças que valem hoje aparecem aqui. O dono do conteúdo vem da licença.'}
          erro={erro}
          desligada={lote.emCurso}
        />
      )}
    </div>
  )
}

function SemLicencaVigente() {
  return (
    <div className="flex min-w-0 flex-col items-start gap-2 rounded-cartao border border-erro bg-erro-cx p-3">
      <p role="alert" className="text-erro">
        Registre a licença primeiro. Não há licença vigente na escola, e o material de terceiro só entra citando uma.
      </p>
      <Link to={caminhoDasLicencas()} className={SECONDARY_LINK_CLASSES}>
        Ir para Licenças
      </Link>
    </div>
  )
}
