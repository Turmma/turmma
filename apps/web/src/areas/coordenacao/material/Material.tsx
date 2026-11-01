import { type Disciplina, type Material as MaterialDaEscola } from '@educa/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useSearch } from 'wouter'
import { errorMessage } from '../../../api/client'
import { disciplinasQueryOptions } from '../../../api/estrutura'
import { materiaisQueryOptions, excluirMaterial, type CamposDoEnvioDeMaterial } from './api/material'
import { aoTrocarDeSessao } from '../../../api/sessao'
import { MATERIAL_PARAM } from '../../../paths'
import { Button } from '../../../components/ui/Button'
import { useDialogState } from '../../../components/ui/overlays/dialog-state'
import { ConfirmDialog } from '../../../components/ui/overlays/ConfirmDialog'
import { StatusAnnouncement, useSingleSubmit } from '../../../components/dialogs'
import { LoadingState, ErrorState, EmptyState } from '../../../components/states/index'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { Table, type TableColumn } from '../../../components/ui/Table'
import { errorText } from '../../../components/error-text'
import { DialogoDeEnvioDeMaterial } from './DialogoDeEnvioDeMaterial'
import { enderecoComParametro } from '../comum/endereco-da-tela'
import { RASCUNHO_VAZIO, TEXTO_DA_RECUSA, TEXTOS_DA_FALHA_DA_EXCLUSAO } from './material-envio'
import { FAMILIA_DA_SITUACAO_DO_MATERIAL, linhasDosMateriais, materialDoEndereco, nomeDaLicenca, rascunhoDoMaterialQueFalhou, textoDaSituacaoDaRecusa, textoDaSituacaoDoMaterial, type MaterialRow, type RecusaDeEnvio } from './materiais-da-escola'
import { useFocusPageHeading } from '../comum/moldura'
import { AvisoDeListaIncompleta, CLASSES_DO_BOTAO_DA_LINHA } from '../comum/pecas-da-lista'
import { PainelDoMaterial } from './PainelDoMaterial'

/** Os diálogos da tela, um por vez. O envio leva, quando vem do painel de um material que falhou, esse material; a exclusão leva o da linha. */
type TipoDeDialogo = 'enviar' | 'excluir'

const TEXTO_DO_ENVIO = 'Material enviado. A leitura das páginas começa agora e leva alguns instantes.'

function colunasDosMateriais(
  nomeDaDisciplina: (disciplinaId: string) => string,
  aoAbrir: (materialId: string) => void,
  aoDispensar: (chave: number) => void,
): readonly [TableColumn<MaterialRow>, ...TableColumn<MaterialRow>[]] {
  return [
    {
      chave: 'material',
      titulo: 'Material',
      celula: (linha) =>
        linha.tipo === 'material' ? (
          // O nome acessível é o título; o "›" só diz, a quem enxerga, que a linha abre algo ao lado.
          <button type="button" aria-haspopup="dialog" onClick={() => aoAbrir(linha.material.id)} className={CLASSES_DO_BOTAO_DA_LINHA}>
            <span className="min-w-0 break-words">{linha.material.titulo}</span>
            <ChevronRight aria-hidden="true" size={16} strokeWidth={2.5} className="shrink-0 text-sutil" />
          </button>
        ) : (
          <span className="font-semibold break-words text-tinta">{linha.recusa.titulo}</span>
        ),
    },
    { chave: 'disciplina', titulo: 'Disciplina', celula: (linha) => nomeDaDisciplina(linha.tipo === 'material' ? linha.material.disciplinaId : linha.recusa.disciplinaId) },
    {
      chave: 'licenca',
      titulo: 'Licença',
      celula: (linha) => nomeDaLicenca(linha.tipo === 'material' ? linha.material.licenca : linha.recusa.licenca),
    },
    {
      chave: 'situacao',
      titulo: 'Situação',
      celula: (linha) =>
        linha.tipo === 'material' ? (
          <StatusBadge familia={FAMILIA_DA_SITUACAO_DO_MATERIAL[linha.material.estado]}>{textoDaSituacaoDoMaterial(linha.material)}</StatusBadge>
        ) : (
          <div className="flex min-w-0 flex-col items-start gap-2">
            <StatusBadge familia="erro">{textoDaSituacaoDaRecusa(linha.recusa)}</StatusBadge>
            <p className="max-w-prose text-sm break-words text-apoio">{TEXTO_DA_RECUSA[linha.recusa.motivo]}</p>
            <Button variante="discreto" onClick={() => aoDispensar(linha.recusa.chave)}>
              Dispensar <span className="sr-only">o aviso de {linha.recusa.titulo}</span>
            </Button>
          </div>
        ),
    },
  ]
}

/**
 * Escola › Material (MVP, A2; X2, 8.0; `docs/interface.md` 3; RF15; D5, D22, D75): a coordenação acompanha o que a escola enviou, o que
 * está sendo lido, o que não carregou e o que foi recusado por falta de licença, numa tabela, e envia o PDF pelo diálogo "Enviar
 * material", com a titularidade e a licença declaradas. "Enviar material" é o único botão cheio.
 *
 * - **A tabela** (Material, Disciplina, Licença e Situação) põe o que falhou primeiro e, depois, o mais novo. A linha inteira abre o
 *   painel do material ao lado (`?material=<id>`), com o que foi declarado e as ações: "Tentar de novo" (só no que falhou, que abre o
 *   envio com o que ele declarava) e "Excluir material", que é `perigo` e confirma antes (regra 50, item 8). O id que a lista da
 *   escola não tem não abre nada (regra 10, item 6).
 * - **Sem licença, ou sem a declaração, o envio é recusado** (`DialogoDeEnvioDeMaterial`): a recusa não vira material. Ela vive só nesta
 *   tela, como uma linha "Envio recusado" na tabela, até a pessoa dispensá-la ou sair.
 * - A lista é do TanStack Query, e se relê sozinha **só enquanto houver material `processando`** (`materiaisQueryOptions`).
 *
 * Os quatro estados: carregando; erro com "Tentar de novo"; vazio, que convida a enviar o primeiro material; e com dado.
 */
export default function Material() {
  const cliente = useQueryClient()
  const [caminho, navegar] = useLocation()
  const busca = useSearch()
  const materiais = useQuery(materiaisQueryOptions)
  const disciplinas = useQuery(disciplinasQueryOptions)
  const dialogo = useDialogState<TipoDeDialogo, MaterialDaEscola>()
  const aberta = dialogo.aberta
  const alvo = aberta?.alvo
  const fecharDialogo = dialogo.fechar

  const [recusas, definirRecusas] = useState<readonly RecusaDeEnvio[]>([])
  const [anuncio, definirAnuncio] = useState('')
  const ultimaRecusa = useRef(0)
  const focarOTituloDaMoldura = useFocusPageHeading()
  const tituloDaLista = useRef<HTMLHeadingElement>(null)

  const lista = materiais.data
  const doPainel = lista === undefined ? undefined : materialDoEndereco(busca, lista.itens)
  const painelAberto = doPainel !== undefined

  const recarregar = useCallback(() => cliente.invalidateQueries({ queryKey: materiaisQueryOptions.queryKey }), [cliente])
  // O foco quando o botão que abriu o diálogo ou o painel saiu da tela: o "Enviar material" do vazio, a linha do material excluído.
  // Sem a lista na tela (a releitura caiu com ela ainda vazia), vai para o título da tela, e não para o `body`.
  const focarNaLista = useCallback(() => (tituloDaLista.current === null ? focarOTituloDaMoldura() : tituloDaLista.current.focus()), [focarOTituloDaMoldura])
  // A sessão que acaba ou muda de dono leva o que a pessoa fazia: o diálogo fecha e as recusas da tabela — que carregam o título e a
  // disciplina que ela declarou — saem, para não passarem à pessoa seguinte do mesmo computador (regra 20, item 15).
  useEffect(
    () =>
      aoTrocarDeSessao(() => {
        fecharDialogo()
        definirRecusas([])
      }),
    [fecharDialogo],
  )

  // O painel aberto já pelo endereço (o link do sino, ou o Voltar do histórico) não tem botão que o tenha aberto: o foco devolvido a
  // "quem abriu" cai no `body`. Quando o painel fecha e o foco está no `body`, vai ao título da lista, e não se perde.
  useEffect(() => {
    const titulo = tituloDaLista.current
    return () => {
      if (document.activeElement === document.body) titulo?.focus()
    }
  }, [painelAberto])

  const abrirPainel = (materialId: string): void => navegar(enderecoComParametro(caminho, busca, MATERIAL_PARAM, materialId))
  const fecharPainel = (): void => navegar(enderecoComParametro(caminho, busca, MATERIAL_PARAM, undefined), { replace: true })
  /** O material saiu da lista (excluído, ou trocado pelo envio novo): o endereço que o abria deixa de apontar para ele. */
  const tirarDoEndereco = (materialId: string): void => {
    if (new URLSearchParams(busca).get(MATERIAL_PARAM) === materialId) fecharPainel()
  }

  /** Abrir um diálogo apaga o anúncio da ação anterior: o que ele dizia já não é o que a pessoa está fazendo. */
  function abrir(tipo: TipoDeDialogo, material?: MaterialDaEscola): void {
    definirAnuncio('')
    dialogo.abrir(tipo, material)
  }

  const erroDaLeitura = (
    <ErrorState
      erro={materiais.error ?? disciplinas.error}
      tentando={materiais.isFetching || disciplinas.isFetching}
      aoTentarDeNovo={() => {
        void materiais.refetch({ cancelRefetch: false })
        void disciplinas.refetch({ cancelRefetch: false })
      }}
    />
  )

  const dasDisciplinas = disciplinas.data
  const nomeDaDisciplina = new Map((dasDisciplinas?.itens ?? []).map((disciplina: Disciplina) => [disciplina.id, disciplina.nome]))
  const nomeDe = (disciplinaId: string): string => nomeDaDisciplina.get(disciplinaId) ?? 'Disciplina'
  const emLeitura = lista === undefined ? 0 : lista.itens.filter((material) => material.estado === 'processando').length
  const semNada = lista !== undefined && lista.itens.length === 0 && recusas.length === 0

  function registrarRecusa(campos: CamposDoEnvioDeMaterial, motivo: RecusaDeEnvio['motivo']): void {
    ultimaRecusa.current += 1
    const recusa: RecusaDeEnvio = { chave: ultimaRecusa.current, titulo: campos.titulo, disciplinaId: campos.disciplinaId, licenca: campos.licenca, motivo }
    definirRecusas((atuais) => [recusa, ...atuais])
  }

  return (
    <section className="flex min-w-0 flex-col gap-6" aria-label="Materiais da escola">
      {materiais.isPending || disciplinas.isPending ? (
        <LoadingState rotulo="Carregando os materiais…" />
      ) : lista === undefined || dasDisciplinas === undefined ? (
        erroDaLeitura
      ) : semNada ? (
        // A releitura que cai com a lista ainda vazia não afirma o vazio: a lista de antes já não vale.
        materiais.isError ? (
          erroDaLeitura
        ) : (
          <EmptyState
            titulo="Nenhum material ainda"
            descricao="Envie o primeiro PDF da escola, com a licença declarada. É dele que o Assistente e o Tutor tiram as atividades e as explicações, sempre citando a página."
            acao={{ rotulo: 'Enviar material', aoAcionar: () => abrir('enviar') }}
          />
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 ref={tituloDaLista} tabIndex={-1} className="text-lg font-semibold text-tinta">
              Materiais da escola
            </h2>
            <Button onClick={() => abrir('enviar')}>Enviar material</Button>
          </div>
          {/*
            Com a lista já na tela, a releitura que falhou é dita aqui com o "Tentar de novo" em `secundario`: o `primario`
            da tela é um só, o "Enviar material".
          */}
          {materiais.isError && (
            <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-cartao border border-erro bg-erro-cx p-4">
              <p role="alert" className="min-w-0 flex-1 basis-56 break-words text-erro">
                {errorMessage(materiais.error)}
              </p>
              <Button variante="secundario" onClick={() => void materiais.refetch({ cancelRefetch: false })}>
                Tentar de novo
              </Button>
              <span role="status" className="text-erro">
                {materiais.isFetching ? 'Tentando de novo…' : ''}
              </span>
            </div>
          )}
          <Table
            rotulo="Lista de materiais"
            colunas={colunasDosMateriais(nomeDe, abrirPainel, (chave) => definirRecusas((atuais) => atuais.filter((outra) => outra.chave !== chave)))}
            linhas={linhasDosMateriais(lista.itens, recusas)}
            chaveDaLinha={(linha) => (linha.tipo === 'material' ? linha.material.id : `recusa-${String(linha.recusa.chave)}`)}
          />
          <AvisoDeListaIncompleta completa={lista.completa} />
        </>
      )}
      <StatusAnnouncement texto={anuncio} />
      <span role="status" className="sr-only">
        {emLeitura === 0 ? '' : emLeitura === 1 ? 'Um material está sendo lido.' : `${String(emLeitura)} materiais estão sendo lidos.`}
      </span>

      {doPainel !== undefined && (
        <PainelDoMaterial
          key={doPainel.id}
          material={doPainel}
          disciplina={nomeDe(doPainel.disciplinaId)}
          aoFechar={fecharPainel}
          aoTentarDeNovo={() => abrir('enviar', doPainel)}
          aoExcluir={() => abrir('excluir', doPainel)}
          focoDeReserva={focarNaLista}
        />
      )}

      {aberta?.tipo === 'enviar' && dasDisciplinas !== undefined && (
        <DialogoDeEnvioDeMaterial
          key={aberta.numero}
          disciplinas={dasDisciplinas.itens}
          inicial={alvo === undefined ? RASCUNHO_VAZIO : rascunhoDoMaterialQueFalhou(alvo)}
          {...(alvo === undefined ? {} : { substitui: alvo.id })}
          aoEnviar={(substituiu) => {
            dialogo.fecharSeAinda(aberta)
            definirAnuncio(TEXTO_DO_ENVIO)
            if (substituiu !== undefined) tirarDoEndereco(substituiu)
          }}
          aoRecusar={registrarRecusa}
          recarregar={recarregar}
          aoFechar={fecharDialogo}
          focoDeReserva={focarNaLista}
        />
      )}
      {aberta?.tipo === 'excluir' && alvo !== undefined && (
        <ExcluirMaterial
          key={aberta.numero}
          material={alvo}
          disciplina={nomeDe(alvo.disciplinaId)}
          aoFechar={fecharDialogo}
          aoTerminar={recarregar}
          aoExcluir={() => {
            dialogo.fecharSeAinda(aberta)
            tirarDoEndereco(alvo.id)
            definirAnuncio('Material excluído. A busca do Assistente e do Tutor deixou de achá-lo.')
          }}
          focoDeReserva={focarNaLista}
        />
      )}
    </section>
  )
}

interface PropsDoExcluir {
  readonly material: MaterialDaEscola
  readonly disciplina: string
  readonly aoFechar: () => void
  /** Recarrega a lista depois do pedido, deu certo ou não. */
  readonly aoTerminar: () => Promise<void>
  readonly aoExcluir: () => void
  readonly focoDeReserva: () => void
}

/** A confirmação de excluir: diz o que acontece com o que já foi gerado e com a busca, antes de confirmar. */
function ExcluirMaterial({ material, disciplina, aoFechar, aoTerminar, aoExcluir, focoDeReserva }: PropsDoExcluir) {
  const { enviar, mutacao } = useSingleSubmit({
    mutationFn: (): Promise<void> => excluirMaterial(material.id),
    onSuccess: async () => {
      await aoTerminar()
      aoExcluir()
    },
    onError: () => void aoTerminar(),
  })
  return (
    <ConfirmDialog
      titulo="Excluir material"
      familia="perigo"
      resumo={[
        { rotulo: 'Material', valor: material.titulo },
        { rotulo: 'Disciplina', valor: disciplina },
        { rotulo: 'Situação', valor: textoDaSituacaoDoMaterial(material) },
      ]}
      efeito="As atividades e os planos já gerados continuam citando a página deste material. Daqui em diante, a busca do Assistente e do Tutor deixa de achá-lo, e o texto lido dele é apagado."
      rotuloDeConfirmar="Excluir material"
      rotuloConfirmando="Excluindo…"
      aoConfirmar={() => enviar(undefined)}
      aoFechar={aoFechar}
      confirmando={mutacao.isPending}
      {...(mutacao.isError ? { falha: errorText(mutacao.error, TEXTOS_DA_FALHA_DA_EXCLUSAO) } : {})}
      focoDeReserva={focoDeReserva}
    />
  )
}
