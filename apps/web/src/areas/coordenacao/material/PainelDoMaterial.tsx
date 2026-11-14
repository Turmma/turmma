import { MENSAGEM_DA_FALHA_DE_MATERIAL, NOME_DA_LICENCA, NOME_DA_TITULARIDADE, TAMANHO_MAXIMO_TITULO_DO_MATERIAL, type Material } from '@educa/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Button } from '../../../components/ui/Button'
import { FormField } from '../../../components/ui/fields/FormField'
import { Sheet } from '../../../components/ui/overlays/Sheet'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { useSingleSubmit } from '../../../components/dialogs'
import { atualizarMaterial, materialComCapitulosQueryOptions } from './api/material'
import { RESUMO_DO_MATERIAL_QUERY_KEY } from './api/resumo'
import { FAMILIA_DA_SITUACAO_DO_MATERIAL, textoDaSituacaoDoMaterial } from './materiais-da-escola'
import {
  errosDoPainel,
  falhaMudouOMaterial,
  houveMudanca,
  paginasDoCapitulo,
  pedidoDoPatch,
  rascunhoDoMaterial,
  textoDaFalhaDoPatch,
  TEXTO_DA_EDICAO_EM_ANDAMENTO,
  TEXTO_DO_PATCH_SALVO,
  TEXTO_DOS_CAPITULOS_AINDA_NAO,
  TEXTO_SEM_CAPITULO,
  tituloDoCapitulo,
  type RascunhoDoPainel,
} from './material-painel'
import { CampoDeSeries } from './PartesDoEnvioDeMaterial'

interface Props {
  readonly material: Material
  /** O nome da disciplina do material, como a lista de disciplinas da escola o tem. */
  readonly disciplina: string
  /** Há uma edição sendo lida sobre este material (ou ele é essa edição): a API recusaria o `PATCH` e outra edição, e o painel nem os oferece. */
  readonly edicaoEmAndamento: boolean
  /** Relê a lista de materiais, deu certo ou não. */
  readonly recarregar: () => Promise<void>
  readonly aoFechar: () => void
  /** Abre o envio com o que o material declarava: só o material que falhou tem o botão. */
  readonly aoTentarDeNovo: () => void
  /** Abre o envio da edição nova: só o material `pronto`, sem edição em leitura. */
  readonly aoEnviarEdicao: () => void
  /** Abre a confirmação de excluir. */
  readonly aoExcluir: () => void
  /** Para onde o foco vai ao fechar quando quem abriu o painel já saiu da página (a linha do material excluído). */
  readonly focoDeReserva: () => void
}

function Dado({ rotulo, children }: { readonly rotulo: string; readonly children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="t-selo text-sutil">{rotulo}</dt>
      <dd className="break-words text-tinta">{children}</dd>
    </div>
  )
}

/** Os capítulos que a leitura achou no PDF, ou o motivo de não haver: ainda lendo, sem capítulo, ou a leitura que não carregou. Só no material `pronto` a consulta existe. */
function Capitulos({ material }: { readonly material: Pick<Material, 'id' | 'estado'> }) {
  const capitulos = useQuery(materialComCapitulosQueryOptions(material.id, material.estado === 'pronto'))
  if (material.estado === 'falhou') return null
  return (
    <section aria-label="Capítulos" className="flex min-w-0 flex-col gap-2">
      <h3 className="t-selo text-sutil">Capítulos</h3>
      {material.estado === 'processando' ? (
        <p className="text-apoio">{TEXTO_DOS_CAPITULOS_AINDA_NAO}</p>
      ) : capitulos.isPending ? (
        <p role="status" className="text-apoio">
          Carregando os capítulos…
        </p>
      ) : capitulos.isError ? (
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <p role="alert" className="min-w-0 flex-1 basis-48 break-words text-erro">
            Não foi possível ler os capítulos.
          </p>
          <Button variante="secundario" onClick={() => void capitulos.refetch({ cancelRefetch: false })}>
            Tentar de novo <span className="sr-only">ler os capítulos</span>
          </Button>
        </div>
      ) : capitulos.data.capitulos.length === 0 ? (
        <p className="text-apoio">{TEXTO_SEM_CAPITULO}</p>
      ) : (
        <ol className="flex min-w-0 flex-col gap-2">
          {capitulos.data.capitulos.map((capitulo) => (
            <li key={capitulo.ordem} className="flex min-w-0 flex-col gap-0.5 rounded-controle border border-borda p-3">
              <span className="font-semibold break-words text-tinta">{tituloDoCapitulo(capitulo)}</span>
              <span className="text-sm text-apoio">{paginasDoCapitulo(capitulo)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

/** O resultado do `PATCH`, dito dentro do painel: a região existe antes do texto, e o foco vai para ele quando chega (quem não o enxerga o ouve). */
function ResultadoDaCorrecao({ falha, salvou }: { readonly falha: string | undefined; readonly salvou: boolean }) {
  const aviso = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (salvou || falha !== undefined) aviso.current?.focus()
  }, [salvou, falha])
  const classes = falha === undefined ? 'border-ok bg-ok-cx text-ok' : 'border-erro bg-erro-cx text-erro'
  return (
    <p ref={aviso} tabIndex={-1} role={falha === undefined ? 'status' : 'alert'} className={`rounded-controle border p-3 break-words empty:hidden ${classes}`}>
      {falha ?? (salvou ? TEXTO_DO_PATCH_SALVO : '')}
    </p>
  )
}

/**
 * O título e as séries que a coordenação pode corrigir (RF6): o formulário parte do que o material tem, e "Salvar alterações" manda só o que mudou (`PATCH`). Salvar trava enquanto o pedido está no ar
 * (o clique duplo manda um só) e enquanto há edição em leitura, que a API recusaria. O resultado, bom ou ruim, é dito aqui, e o foco vai para ele: quem não o enxerga o ouve.
 */
function CorrecaoDoMaterial({ material, edicaoEmAndamento, recarregar }: Pick<Props, 'material' | 'edicaoEmAndamento' | 'recarregar'>) {
  const cliente = useQueryClient()
  const [rascunho, definirRascunho] = useState<RascunhoDoPainel>(() => rascunhoDoMaterial(material))
  const [tentou, definirTentou] = useState(false)
  const [salvou, definirSalvou] = useState(false)
  const { enviar, mutacao } = useSingleSubmit({
    mutationFn: (pedido: NonNullable<ReturnType<typeof pedidoDoPatch>>) => atualizarMaterial(material.id, pedido),
    onSuccess: async () => {
      await recarregar()
      // As séries do material mudaram o que o resumo conta por série: ele se relê.
      void cliente.invalidateQueries({ queryKey: RESUMO_DO_MATERIAL_QUERY_KEY })
      definirSalvou(true)
    },
    onError: (erro) => {
      if (falhaMudouOMaterial(erro)) void recarregar()
    },
  })
  const falha = mutacao.isError ? textoDaFalhaDoPatch(mutacao.error) : undefined
  const erros = tentou ? errosDoPainel(rascunho) : {}
  const mudou = houveMudanca(material, rascunho)

  function mudar(parte: Partial<RascunhoDoPainel>): void {
    definirRascunho((atual) => ({ ...atual, ...parte }))
    definirSalvou(false)
    if (!mutacao.isPending) mutacao.reset()
  }

  function aoSalvar(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault()
    definirTentou(true)
    const pedido = pedidoDoPatch(material, rascunho)
    if (pedido !== undefined) enviar(pedido)
  }

  return (
    <form aria-label="Corrigir título e séries" className="flex min-w-0 flex-col gap-4" onSubmit={aoSalvar} noValidate>
      <fieldset disabled={edicaoEmAndamento} className="flex min-w-0 flex-col gap-4">
        <legend className="t-selo mb-2 text-sutil">Corrigir título e séries</legend>
        {edicaoEmAndamento && <p className="break-words text-apoio">{TEXTO_DA_EDICAO_EM_ANDAMENTO}</p>}
        <FormField rotulo="Título" value={rascunho.titulo} maxLength={TAMANHO_MAXIMO_TITULO_DO_MATERIAL} onChange={(evento) => mudar({ titulo: evento.target.value })} erro={erros.titulo} autoComplete="off" />
        <CampoDeSeries marcadas={rascunho.serieIds} aoMudar={(serieIds) => mudar({ serieIds })} erro={erros.serieIds} desligado={edicaoEmAndamento} />
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variante="secundario" disabled={edicaoEmAndamento || mutacao.isPending || !mudou}>
          {mutacao.isPending ? 'Salvando…' : 'Salvar alterações'}
        </Button>
      </div>
      <ResultadoDaCorrecao falha={falha} salvou={salvou} />
    </form>
  )
}

/**
 * O painel do material (X2, 8.0; 12.0; RF4, RF6, RF10, RF15; `?material=<id>`): a situação em texto, o motivo da falha, os capítulos que a leitura achou (ou "sem capítulo"), o que a coordenação declarou ao enviar,
 * o formulário que corrige o título e as séries e, no rodapé, "Enviar edição nova" (só no material `pronto`, sem edição em leitura), "Tentar de novo" (só no que falhou) e "Excluir material", que abre a
 * confirmação de perigo de sempre (D5, D75).
 *
 * **O que vem da API é só o que o painel mostra** (regra 20, itens 4 e 9): os capítulos (ordem, número, título e páginas, nunca o texto lido), o título e as séries. O hash do arquivo e quem enviou não existem em
 * `Material`. O motivo da falha é o texto curto da API para cada código, que diz o que fazer. Cada material é um painel novo (`key` de quem o monta): o rascunho, o foco e o aviso do anterior não sobram.
 */
export function PainelDoMaterial({ material, disciplina, edicaoEmAndamento, recarregar, aoFechar, aoTentarDeNovo, aoEnviarEdicao, aoExcluir, focoDeReserva }: Props) {
  return (
    <Sheet
      titulo={material.titulo}
      aoFechar={aoFechar}
      focoDeReserva={focoDeReserva}
      rodape={
        <>
          {material.estado === 'pronto' && !edicaoEmAndamento && (
            <Button variante="secundario" onClick={aoEnviarEdicao}>
              Enviar edição nova
            </Button>
          )}
          {material.estado === 'falhou' && (
            <Button variante="secundario" onClick={aoTentarDeNovo}>
              Tentar de novo
            </Button>
          )}
          <Button variante="perigo" onClick={aoExcluir}>
            Excluir material
          </Button>
        </>
      }
    >
      <div className="flex min-w-0 flex-col gap-5">
        <section aria-label="Situação" className="flex min-w-0 flex-col gap-2">
          <div>
            <StatusBadge familia={FAMILIA_DA_SITUACAO_DO_MATERIAL[material.estado]}>{textoDaSituacaoDoMaterial(material)}</StatusBadge>
          </div>
          {material.falha !== null && <p className="break-words text-erro">{MENSAGEM_DA_FALHA_DE_MATERIAL[material.falha]}</p>}
        </section>
        <Capitulos material={material} />
        <dl className="flex min-w-0 flex-col gap-4">
          <Dado rotulo="Disciplina">{disciplina}</Dado>
          <Dado rotulo="De quem é o material">{NOME_DA_TITULARIDADE[material.titularidade]}</Dado>
          {material.licenciante !== null && <Dado rotulo="Quem deu a licença">{material.licenciante}</Dado>}
          <Dado rotulo="Licença de uso">{NOME_DA_LICENCA[material.licenca]}</Dado>
          <Dado rotulo="Páginas">{material.paginas === null ? '—' : String(material.paginas)}</Dado>
        </dl>
        <CorrecaoDoMaterial material={material} edicaoEmAndamento={edicaoEmAndamento} recarregar={recarregar} />
      </div>
    </Sheet>
  )
}
