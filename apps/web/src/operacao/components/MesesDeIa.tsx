import type { MesDoUsoDeIaDaEscola } from '@educa/shared'
import { useQuery } from '@tanstack/react-query'
import { RespostaForaDoContrato } from '../../api/contrato/resposta-fora-do-contrato'
import { EmptyState, LoadingState } from '../../components/states'
import { Button } from '../../components/ui/Button'
import { SECONDARY_BUTTON_CLASSES } from '../../components/ui/button-variants'
import { doUsoDeIaDaEscolaQueryOptions } from '../api/painel'
import { formatMes, formatNumber } from '../format'
import { TEXTO_DO_CARREGAMENTO_QUE_FALHOU, TEXTO_PARA_ATUALIZAR, TEXTO_SEM_MES_FECHADO, textoDoCustoPorAluno, textoDoOrcamentoDoMes, reais } from '../textos'
import { DialogoDaOperacao } from './DialogoDaOperacao'

interface Props {
  /** A escola da linha, fotografada na abertura: só o id e o nome (nenhuma pessoa). */
  readonly escola: { readonly id: string; readonly nome: string }
  readonly aoFechar: () => void
  /** O foco ao fechar quando o botão que abriu já saiu da página (`DialogoDaOperacao`). */
  readonly focoDeReserva?: () => void
}

/** Uma medida do mês, em duas linhas de leitura: o rótulo e o valor, sem rolagem horizontal a 360 px. */
function Medida({ rotulo, valor }: { readonly rotulo: string; readonly valor: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
      <dt className="t-apoio min-w-0 text-sutil">{rotulo}</dt>
      <dd className="t-apoio min-w-0 text-right font-bold tabular-nums text-tinta wrap-anywhere">{valor}</dd>
    </div>
  )
}

/**
 * Um mês fechado, **pelo retrato** que a medição gravou: o consumo e, com retrato, o custo por aluno contra o valor e a
 * porcentagem. O mês fechado antes da medição existir diz "sem retrato (antes da medição)" e mostra só o consumo.
 */
function Mes({ mes }: { readonly mes: MesDoUsoDeIaDaEscola }) {
  return (
    <li className="min-w-0 rounded-cartao border-2 border-borda bg-superficie p-3">
      <h3 className="t-cartao break-words text-tinta">{formatMes(mes.mes)}</h3>
      <p className="t-apoio mt-1 font-bold text-tinta">{textoDoOrcamentoDoMes(mes.situacao, mes.porcentagem)}</p>
      <dl className="mt-2 flex flex-col gap-1">
        <Medida rotulo="Chamadas" valor={formatNumber(mes.chamadas)} />
        <Medida rotulo="Tokens" valor={formatNumber(mes.tokens)} />
        <Medida rotulo="Reais" valor={reais(mes.custoMicros)} />
        {mes.situacao !== 'sem_retrato' && <Medida rotulo="Custo por aluno" valor={textoDoCustoPorAluno(mes.custoMicros, mes.alunosAtivos, mes.valorPorAlunoMicros)} />}
        <Medida rotulo="Chamadas da reserva" valor={formatNumber(mes.chamadasPeloProvedorDeReserva)} />
      </dl>
    </li>
  )
}

/**
 * "Ver meses" da aba Uso (camada-ia, 8.0; RF11): os 12 meses anteriores de uma escola, do mais recente ao mais antigo,
 * cada um pelo retrato. **Só número**, por escola, nunca pessoa (D76). Os quatro estados: carregando; erro, com "Tentar de
 * novo" (ou "Atualize a página", quando a web não reconhece a resposta); vazio, quando nenhum dos 12 meses tem retrato; e
 * com dado. A leitura só sai quando o diálogo abre.
 */
export function MesesDeIa({ escola, aoFechar, focoDeReserva }: Props) {
  const meses = useQuery(doUsoDeIaDaEscolaQueryOptions(escola.id))
  const forDoContrato = meses.error instanceof RespostaForaDoContrato
  const itens = meses.data?.meses
  return (
    <DialogoDaOperacao titulo="Meses de IA" aoFechar={aoFechar} {...(focoDeReserva === undefined ? {} : { focoDeReserva })}>
      <p className="mt-1 wrap-anywhere text-apoio">
        Escola <span className="font-medium text-tinta">{escola.nome}</span>: os 12 meses anteriores.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {itens !== undefined ? (
          itens.every((mes) => mes.situacao === 'sem_retrato') ? (
            <EmptyState titulo={TEXTO_SEM_MES_FECHADO} descricao="O retrato de cada mês é gravado quando a medição o fecha." />
          ) : (
            <ul aria-label="Meses de IA da escola" className="flex min-w-0 flex-col gap-3">
              {itens.map((mes) => (
                <Mes key={mes.mes} mes={mes} />
              ))}
            </ul>
          )
        ) : meses.isPending ? (
          <LoadingState rotulo="Carregando os meses…" />
        ) : (
          <>
            <p role="alert" className="rounded-controle border border-erro bg-erro-cx p-3 text-erro">
              {forDoContrato ? TEXTO_PARA_ATUALIZAR : TEXTO_DO_CARREGAMENTO_QUE_FALHOU}
            </p>
            {!forDoContrato && (
              <Button onClick={() => void meses.refetch()}>
                Tentar de novo
              </Button>
            )}
          </>
        )}
        <button type="button" onClick={aoFechar} className={SECONDARY_BUTTON_CLASSES}>
          Fechar
        </button>
      </div>
    </DialogoDaOperacao>
  )
}
