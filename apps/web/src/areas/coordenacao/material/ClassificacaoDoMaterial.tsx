import type { Material, MaterialComCapitulosResponse, SecaoDoMaterialResponse } from '@educa/shared'
import { MAXIMO_DE_HABILIDADES_POR_SECAO } from '@educa/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { ErrorAlert, useSingleSubmit } from '../../../components/dialogs'
import { SeletorDeHabilidades } from '../../../components/habilidades/SeletorDeHabilidades'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { corrigirSecaoDoMaterial, habilidadesDoMaterialQueryOptions, materialComCapitulosQueryOptions, MATERIAL_QUERY_KEY, reclassificarMaterial } from './api/material'
import {
  assinaturaDaSecao,
  codigosIniciaisDaCorrecao,
  contagemDoReclassificar,
  falhaMudouAClassificacao,
  paginasDaSecao,
  rotuloDaSecao,
  TEXTO_DA_CLASSIFICACAO_QUE_NAO_LEU,
  TEXTO_DA_CORRECAO_FINAL,
  TEXTO_DA_SUSPENSAO,
  TEXTO_DO_RECLASSIFICAR_SEM_O_QUE_REFAZER,
  TEXTO_DO_VAZIO_DA_CLASSIFICACAO,
  textoDaConfirmacaoDoReclassificar,
  textoDaFalhaDaCorrecao,
  textoDaFalhaDoReclassificar,
  textoDaOrigem,
  textoDoComponenteQueFalta,
  textoDoReclassificarPedido,
  tituloDaSecao,
} from './classificacao'

interface Props {
  readonly material: Pick<Material, 'id' | 'estado'>
  /** O nome da disciplina do material, para o aviso de quem não tem componente. */
  readonly disciplina: string
  /** A disciplina não tem componente da BNCC (`true`), tem (`false`), ou a lista de disciplinas ainda não chegou (`undefined`): sem saber, nada se corrige nem se reclassifica. */
  readonly semComponente: boolean | undefined
}

type Dados = MaterialComCapitulosResponse

/** O resultado de um pedido, dito dentro da seção: a região existe antes do texto, e o foco vai para ele quando chega (quem não o enxerga o ouve). */
function ResultadoDoPedido({ texto, falha }: { readonly texto: string | undefined; readonly falha: boolean }) {
  const aviso = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (texto !== undefined) aviso.current?.focus()
  }, [texto])
  const classes = falha ? 'border-erro bg-erro-cx text-erro' : 'border-ok bg-ok-cx text-ok'
  return (
    <p ref={aviso} tabIndex={-1} role={falha ? 'alert' : 'status'} className={`rounded-controle border p-3 break-words empty:hidden ${classes}`}>
      {texto}
    </p>
  )
}

interface EditorProps {
  readonly materialId: string
  readonly secao: SecaoDoMaterialResponse
  readonly titulo: string
  readonly suspensa: boolean
  readonly recarregar: () => Promise<unknown>
  /** Fecha o editor e devolve o foco ao "Corrigir" da linha. */
  readonly aoFechar: () => void
}

/**
 * O editor de um capítulo (RF6): o seletor de 0 a 5 habilidades, o que a correção significa (vale no lugar da IA e é final) e "Salvar correção". Lê as candidatas do recorte **toda vez que abre** (o recorte pode ter mudado). Sem tocar
 * em nada, "Salvar correção" também vale: é como a coordenação confirma o que a IA sugeriu, ou diz que o capítulo não tem habilidade. O que falha fica aqui, com o foco; a falha que muda o que a tela sabe (o capítulo saiu, o
 * recorte mudou, o material deixou de estar pronto) relê o material e as candidatas.
 */
function EditorDaSecao({ materialId, secao, titulo, suspensa, recarregar, aoFechar }: EditorProps) {
  const cliente = useQueryClient()
  const candidatas = useQuery(habilidadesDoMaterialQueryOptions(materialId))
  const itens = candidatas.data?.itens
  const [escolha, definirEscolha] = useState<string[] | undefined>(undefined)
  const escolhidos = escolha ?? (itens === undefined ? [] : codigosIniciaisDaCorrecao(secao, suspensa, new Set(itens.map((item) => item.codigo))))
  const { enviar, mutacao } = useSingleSubmit({
    mutationFn: (codigos: string[]) => corrigirSecaoDoMaterial(materialId, secao.id, codigos),
    onSuccess: async () => {
      await recarregar()
      aoFechar()
    },
    onError: (erro) => {
      if (!falhaMudouAClassificacao(erro)) return
      void recarregar()
      void cliente.invalidateQueries({ queryKey: [...MATERIAL_QUERY_KEY, 'habilidades-bncc', materialId] })
    },
  })

  function mudar(codigos: string[]): void {
    definirEscolha(codigos)
    if (!mutacao.isPending) mutacao.reset()
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-controle border border-borda p-3">
      <p className="text-apoio">{TEXTO_DA_CORRECAO_FINAL}</p>
      <SeletorDeHabilidades
        rotulo={`Habilidades de ${titulo}`}
        itens={itens}
        carregando={candidatas.isPending}
        erro={candidatas.isError}
        aoTentarDeNovo={() => void candidatas.refetch({ cancelRefetch: false })}
        selecionados={escolhidos}
        maximo={MAXIMO_DE_HABILIDADES_POR_SECAO}
        aoMudar={mudar}
        aoFechar={aoFechar}
      />
      {mutacao.isError && <ErrorAlert texto={textoDaFalhaDaCorrecao(mutacao.error)} />}
      <div className="flex flex-wrap items-center gap-3">
        <Button variante="secundario" disabled={itens === undefined || mutacao.isPending} onClick={() => enviar(escolhidos)}>
          {mutacao.isPending ? 'Salvando…' : 'Salvar correção'}
        </Button>
        <Button variante="secundario" disabled={mutacao.isPending} onClick={aoFechar}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}

interface PropsRow {
  readonly materialId: string
  readonly secao: SecaoDoMaterialResponse
  readonly suspensa: boolean
  readonly semComponente: boolean | undefined
  /** O capítulo aberto para corrigir, com o que ele mostrava ao abrir: se o que ele mostra muda por fora, o editor deixa de valer. */
  readonly editando: { readonly secaoId: string; readonly assinatura: string } | undefined
  readonly aoEditar: (aberto: { readonly secaoId: string; readonly assinatura: string } | undefined) => void
  readonly aoReclassificar: () => void
  /** O pedido de "Reclassificar" está à espera da confirmação ou no ar: nada o repete, nem o botão do capítulo. */
  readonly reclassificando: boolean
  readonly recarregar: () => Promise<unknown>
}

function CapituloRow({ materialId, secao, suspensa, semComponente, editando, aoEditar, aoReclassificar, reclassificando, recarregar }: PropsRow) {
  const botao = useRef<HTMLButtonElement>(null)
  const assinatura = assinaturaDaSecao(secao)
  const aberta = editando?.secaoId === secao.id
  const editorVale = aberta && editando.assinatura === assinatura
  const titulo = tituloDaSecao(secao)
  const paginas = paginasDaSecao(secao)
  const rotulo = rotuloDaSecao(secao, suspensa)

  // O capítulo mudou por fora enquanto o editor estava aberto (outra aba, a classificação da noite): o editor e a falha dele saem, e o foco volta ao "Corrigir".
  useEffect(() => {
    if (aberta && !editorVale) {
      aoEditar(undefined)
      botao.current?.focus()
    }
  }, [aberta, editorVale, aoEditar])

  function fechar(): void {
    aoEditar(undefined)
    botao.current?.focus()
  }

  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-controle border border-borda p-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-semibold break-words text-tinta">{titulo}</span>
        <span className="text-sm text-apoio empty:hidden">{paginas}</span>
      </div>
      {/* Só a `nao_classificada` pede "Reclassificar" na linha: o capítulo corrigido nunca está nela, e com a função suspensa o rótulo dela não existe (`rotuloDaSecao`). */}
      {rotulo !== undefined && (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <StatusBadge familia={rotulo.familia}>{rotulo.texto}</StatusBadge>
          {secao.situacao === 'nao_classificada' && (
            <Button variante="secundario" onClick={aoReclassificar} disabled={semComponente !== false || reclassificando}>
              Reclassificar <span className="sr-only">o material</span>
            </Button>
          )}
        </div>
      )}
      {secao.habilidades.length > 0 && (
        <ul className="flex min-w-0 flex-col gap-2">
          {secao.habilidades.map((habilidade) => (
            <li key={habilidade.codigo} className="flex min-w-0 flex-col gap-1">
              <span className="break-words text-tinta">
                <span className="font-semibold">{habilidade.codigo}</span> {habilidade.descricao}
              </span>
              <span className={`t-selo w-fit max-w-full rounded-selo px-2 py-1 break-words ${habilidade.origem === 'ia' ? 'bg-ia-cx text-ia' : 'bg-ok-cx text-ok'}`}>{textoDaOrigem(habilidade.origem, suspensa)}</span>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button ref={botao} variante="secundario" aria-expanded={editorVale} disabled={semComponente !== false} onClick={() => aoEditar({ secaoId: secao.id, assinatura })}>
          Corrigir <span className="sr-only">as habilidades de {titulo}</span>
        </Button>
      </div>
      {editorVale && <EditorDaSecao materialId={materialId} secao={secao} titulo={titulo} suspensa={suspensa} recarregar={recarregar} aoFechar={fechar} />}
    </li>
  )
}

interface LidaProps extends Pick<Props, 'disciplina' | 'semComponente'> {
  readonly materialId: string
  readonly dados: Dados
  readonly recarregar: () => Promise<unknown>
}

/** O pedido de "Reclassificar": a confirmação do que ele refaz, o pedido em si e o foco que vai e volta. Quem o abre é o botão do alto e o do capítulo que não terminou. */
function useReclassificar(materialId: string, recarregar: () => Promise<unknown>) {
  const [confirmando, definirConfirmando] = useState(false)
  const botao = useRef<HTMLButtonElement>(null)
  const confirmacao = useRef<HTMLParagraphElement>(null)
  const devolverFoco = useRef(false)
  const { enviar, mutacao } = useSingleSubmit({
    mutationFn: () => reclassificarMaterial(materialId),
    // A confirmação fica à vista até a leitura nova chegar: "Reclassificar" não volta a ligar com o pedido ainda a caminho.
    onSuccess: async () => {
      await recarregar()
      definirConfirmando(false)
    },
    onError: (erro) => {
      definirConfirmando(false)
      if (falhaMudouAClassificacao(erro)) void recarregar()
    },
  })

  useEffect(() => {
    if (confirmando) confirmacao.current?.focus()
    else if (devolverFoco.current) {
      devolverFoco.current = false
      botao.current?.focus()
    }
  }, [confirmando])

  function pedir(): void {
    mutacao.reset()
    definirConfirmando(true)
  }

  function cancelar(): void {
    devolverFoco.current = true
    definirConfirmando(false)
  }

  return { confirmando, botao, confirmacao, enviar, mutacao, pedir, cancelar }
}

interface BlocoProps {
  readonly reclassificar: ReturnType<typeof useReclassificar>
  readonly semComponente: boolean | undefined
  readonly refeitos: number
  readonly corrigidos: number
}

/** O "Reclassificar" do alto, com a confirmação do que refaz e do que fica (regra 50, item 8) e o que a API respondeu. */
function BlocoDoReclassificar({ reclassificar, semComponente, refeitos, corrigidos }: BlocoProps) {
  const { confirmando, botao, confirmacao, enviar, mutacao, pedir, cancelar } = reclassificar
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button ref={botao} variante="secundario" disabled={semComponente !== false || refeitos === 0 || confirmando} onClick={pedir}>
          Reclassificar
        </Button>
        {refeitos === 0 && <p className="min-w-0 flex-1 basis-48 text-apoio">{TEXTO_DO_RECLASSIFICAR_SEM_O_QUE_REFAZER}</p>}
      </div>
      {confirmando && (
        <div role="group" aria-label="Confirmar a classificação de novo" className="flex min-w-0 flex-col gap-3 rounded-controle border border-borda p-3">
          <p ref={confirmacao} tabIndex={-1} className="break-words text-tinta">
            {textoDaConfirmacaoDoReclassificar(refeitos, corrigidos)}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button variante="secundario" disabled={mutacao.isPending} onClick={() => enviar(undefined)}>
              {mutacao.isPending ? 'Pedindo…' : 'Confirmar'}
            </Button>
            <Button variante="secundario" disabled={mutacao.isPending} onClick={cancelar}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
      <ResultadoDoPedido texto={mutacao.isError ? textoDaFalhaDoReclassificar(mutacao.error) : mutacao.isSuccess ? textoDoReclassificarPedido(mutacao.data) : undefined} falha={mutacao.isError} />
    </div>
  )
}

/** As seções lidas: os avisos, o "Reclassificar" com a confirmação do que ele refaz, e uma linha por capítulo (RF6, RF12). */
function CapitulosClassificados({ materialId, dados, disciplina, semComponente, recarregar }: LidaProps) {
  const { secoes, classificacaoSuspensa: suspensa } = dados
  const [editando, definirEditando] = useState<{ readonly secaoId: string; readonly assinatura: string } | undefined>(undefined)
  const reclassificar = useReclassificar(materialId, recarregar)
  const { refeitos, corrigidos } = contagemDoReclassificar(secoes)

  if (secoes.length === 0) return <p className="text-apoio">{TEXTO_DO_VAZIO_DA_CLASSIFICACAO}</p>
  return (
    <>
      {suspensa && <Alert tom="atencao">{TEXTO_DA_SUSPENSAO}</Alert>}
      {semComponente === true && <Alert tom="atencao">{textoDoComponenteQueFalta(disciplina)}</Alert>}
      {!suspensa && <BlocoDoReclassificar reclassificar={reclassificar} semComponente={semComponente} refeitos={refeitos} corrigidos={corrigidos} />}
      <ol className="flex min-w-0 flex-col gap-2">
        {secoes.map((secao) => (
          <CapituloRow
            key={secao.id}
            materialId={materialId}
            secao={secao}
            suspensa={suspensa}
            semComponente={semComponente}
            editando={editando}
            aoEditar={definirEditando}
            aoReclassificar={reclassificar.pedir}
            reclassificando={reclassificar.confirmando}
            recarregar={recarregar}
          />
        ))}
      </ol>
    </>
  )
}

/**
 * A classificação do material pela BNCC no painel (classificacao-bncc, 8.0; RF6, RF12; `docs/interface.md` 3): cada capítulo (ou "Páginas X a Y") com a situação **em texto**, as habilidades com o código e a descrição, e de quem
 * são ("Sugerida pela IA" ou "Corrigida pela coordenação"). A coordenação corrige pelo seletor de 0 a 5 habilidades, e a correção é final; "Reclassificar" mostra quantos capítulos refaz e quantos ficam como estão antes de confirmar.
 * **Só no material `pronto`**: é o que tem seções. Lê o mesmo `GET /v1/materiais/:id` dos capítulos (uma consulta só).
 *
 * Com a função suspensa, a tela diz que valem só as habilidades corrigidas e não oferece "Reclassificar" (a API o recusaria). Sem componente na disciplina, diz o que definir na Estrutura e desliga "Corrigir" e "Reclassificar":
 * sem componente não há recorte para escolher. Quem manda a classificação é a API; a tela não a decide.
 */
export function ClassificacaoDoMaterial({ material, disciplina, semComponente }: Props) {
  const consulta = useQuery(materialComCapitulosQueryOptions(material.id, material.estado === 'pronto'))
  if (material.estado !== 'pronto') return null
  return (
    <section aria-label="Habilidades da BNCC" className="flex min-w-0 flex-col gap-3">
      <h3 className="t-selo text-sutil">Habilidades da BNCC</h3>
      {consulta.data !== undefined ? (
        <CapitulosClassificados materialId={material.id} dados={consulta.data} disciplina={disciplina} semComponente={semComponente} recarregar={() => consulta.refetch({ cancelRefetch: false })} />
      ) : consulta.isError ? (
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <p role="alert" className="min-w-0 flex-1 basis-48 break-words text-erro">
            {TEXTO_DA_CLASSIFICACAO_QUE_NAO_LEU}
          </p>
          <Button variante="secundario" onClick={() => void consulta.refetch({ cancelRefetch: false })}>
            Tentar de novo <span className="sr-only">ler as habilidades</span>
          </Button>
        </div>
      ) : (
        <p role="status" className="text-apoio">
          Carregando as habilidades…
        </p>
      )}
    </section>
  )
}
