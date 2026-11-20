import { ROTULO_SEM_HABILIDADE, type ArtefatoResponse, type ConteudoDeAtividade, type SecaoDaQuestao } from '@educa/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import { ARTEFATOS_QUERY_KEY } from '../../../api/chaves-do-professor'
import { Button } from '../../../components/ui/Button'
import { SeletorDeHabilidades } from '../../../components/habilidades/SeletorDeHabilidades'
import { capituloDaQuestao } from '../../../components/habilidades/nome-da-secao'
import { artefatoQueryOptions, habilidadesDoArtefatoQueryOptions, trocarHabilidadeDaQuestao } from './api/artefatos'
import { candidatasEmOrdem, falhaMudouOArtefato, motivoDaTrocaFechada, ROTULO_DE_DEIXAR_SEM_HABILIDADE, ROTULO_DE_TROCAR, textoDaFalhaDaTroca } from './troca-de-habilidade'

type Questao = ConteudoDeAtividade['questoes'][number]

interface PropsDaHabilidade {
  readonly artefato: Pick<ArtefatoResponse, 'id' | 'origemId' | 'aplicacoes' | 'versoesAdaptadas' | 'classificacaoSuspensa'>
  readonly indice: number
  readonly questao: Pick<Questao, 'habilidade'>
  /** O capítulo da página que a questão cita, ou `null` (a página é de antes do primeiro capítulo, ou o material saiu ou foi excluído). */
  readonly secao: SecaoDaQuestao | null
}

/**
 * A habilidade da questão no artefato aberto (classificacao-bncc, 11.0; RF9; `docs/interface.md` 11.2): "Habilidade EM13CNT102: texto" com o capítulo ao lado, ou "Sem habilidade", e o botão **Trocar**, que abre o seletor da 8.0
 * com uma só escolha. Escolher uma habilidade troca na hora; "Deixar sem habilidade" tira a da questão; Esc ou Cancelar fecham e devolvem o foco ao botão. Depois da aplicação (ou com versão adaptada) o botão fica desligado e a linha diz por quê:
 * a troca só vale antes de a atividade ir à turma. A base da classificação não muda: o que muda é o artefato da professora, e o diagnóstico passa a usar a trocada.
 */
export function HabilidadeDaQuestao({ artefato, indice, questao, secao }: PropsDaHabilidade) {
  const cliente = useQueryClient()
  const [aberta, definirAberta] = useState(false)
  const botao = useRef<HTMLButtonElement>(null)
  const idDoMotivo = useId()
  const motivo = motivoDaTrocaFechada(artefato)
  const numero = indice + 1

  const trocar = useMutation({
    mutationFn: (codigo: string | null) => trocarHabilidadeDaQuestao(artefato.id, indice, codigo),
    onSuccess: (trocado) => {
      cliente.setQueryData(artefatoQueryOptions(artefato.id).queryKey, trocado)
      void cliente.invalidateQueries({ queryKey: ARTEFATOS_QUERY_KEY })
      close()
    },
    onError: (erro) => {
      // Aplicada ou adaptada por outra aba enquanto a tela estava aberta: a leitura é refeita e o botão se desliga com o motivo.
      if (falhaMudouOArtefato(erro)) void cliente.invalidateQueries({ queryKey: artefatoQueryOptions(artefato.id).queryKey })
    },
  })

  function close(): void {
    definirAberta(false)
    trocar.reset()
    // O painel some com o foco dentro dele: o foco volta ao botão que o abriu, no quadro seguinte ao render que o religa.
    requestAnimationFrame(() => botao.current?.focus())
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm break-words text-sutil">
          <p className="min-w-0">
            {questao.habilidade === null ? (
              <span className="font-medium">{ROTULO_SEM_HABILIDADE}</span>
            ) : (
              <>
                <span className="font-medium">Habilidade {questao.habilidade.codigo}: </span>
                {questao.habilidade.descricao}
              </>
            )}
          </p>
          {secao !== null && <p className="min-w-0">{capituloDaQuestao(secao)}</p>}
        </div>
        <Button ref={botao} variante="discreto" tamanho="compacto" disabled={motivo !== undefined} aria-describedby={motivo === undefined ? undefined : idDoMotivo} aria-expanded={aberta} aria-label={`${ROTULO_DE_TROCAR} a habilidade da questão ${String(numero)}`} onClick={() => definirAberta(true)}>
          {ROTULO_DE_TROCAR}
        </Button>
      </div>
      {motivo !== undefined && (
        <p id={idDoMotivo} className="min-w-0 text-sm break-words text-sutil">
          {motivo}
        </p>
      )}
      {aberta && motivo === undefined && <PainelDaTroca artefato={artefato} numero={numero} secao={secao} aoEscolher={(codigo) => trocar.mutate(codigo)} aoFechar={close} gravando={trocar.isPending} falha={trocar.isError ? textoDaFalhaDaTroca(trocar.error) : undefined} />}
    </div>
  )
}

interface PropsDoPainel {
  readonly artefato: Pick<ArtefatoResponse, 'id' | 'classificacaoSuspensa'>
  readonly numero: number
  readonly secao: SecaoDaQuestao | null
  readonly aoEscolher: (codigo: string | null) => void
  readonly aoFechar: () => void
  readonly gravando: boolean
  readonly falha: string | undefined
}

/** O painel aberto: lê as candidatas do recorte (só agora, ao abrir) e as põe no seletor da 8.0, as do capítulo primeiro. */
function PainelDaTroca({ artefato, numero, secao, aoEscolher, aoFechar, gravando, falha }: PropsDoPainel) {
  const candidatas = useQuery(habilidadesDoArtefatoQueryOptions(artefato.id))
  const itens = candidatas.data === undefined ? undefined : candidatasEmOrdem(candidatas.data.itens, secao, artefato.classificacaoSuspensa)
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-cartao border border-linha bg-superficie p-3">
      <SeletorDeHabilidades
        rotulo={`Habilidades para a questão ${String(numero)}`}
        itens={itens}
        carregando={candidatas.isPending}
        erro={candidatas.isError}
        aoTentarDeNovo={() => void candidatas.refetch({ cancelRefetch: false })}
        semComponente={candidatas.data?.semComponente === true}
        selecionados={[]}
        maximo={1}
        aoMudar={(codigos) => {
          const [codigo] = codigos
          if (codigo !== undefined && !gravando) aoEscolher(codigo)
        }}
        aoFechar={aoFechar}
      />
      <p role="alert" className="min-w-0 rounded-controle bg-erro-cx p-3 break-words text-erro empty:hidden">
        {falha ?? ''}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button variante="secundario" disabled={gravando} onClick={() => aoEscolher(null)}>
          {ROTULO_DE_DEIXAR_SEM_HABILIDADE}
        </Button>
        <Button variante="secundario" disabled={gravando} onClick={aoFechar}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
