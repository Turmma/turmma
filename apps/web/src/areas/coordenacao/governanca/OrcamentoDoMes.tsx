import type { OrcamentoDoConsumo } from '@educa/shared'
import { RespostaForaDoContrato, TEXTO_PARA_ATUALIZAR } from '../../../api/contrato/resposta-fora-do-contrato'
import { ErrorState } from '../../../components/states/index'
import { Alert } from '../../../components/ui/Alert'
import { textoDoOrcamento } from './textos-da-governanca'

/**
 * O orçamento de IA do mês, como a coordenação o lê no Painel e na Governança (camada-ia, 6.0; RF9 e RF12; D40; `docs/interface.md` 3): "IA do mês: N% do previsto." e, a 80% e a 100%, o aviso de que
 * **nada é cortado**. Sem valor, sem aluno ou sem retrato, a frase que diz por que não há porcentagem. Aviso e porcentagem são texto, o aviso leva o glifo do `Alert` (não é só cor), e nada aqui depende de hover. **Nenhum real e nenhum
 * token**: a conta é do servidor.
 */
export function OrcamentoDoMes({ orcamento }: { readonly orcamento: OrcamentoDoConsumo }) {
  const { linha, aviso } = textoDoOrcamento(orcamento)
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="t-apoio text-apoio">{linha}</p>
      {aviso !== null && <Alert tom="atencao">{aviso}</Alert>}
    </div>
  )
}

/**
 * A falha de ler o consumo do mês: a comum diz o que fazer e oferece "Tentar de novo"; a resposta que o contrato da web não reconhece (a web antiga com a API nova) diz "Atualize a página" e **não oferece
 * tentar de novo**, que traria a mesma resposta.
 */
export function FalhaDoConsumo({ erro, tentando, aoTentarDeNovo }: { readonly erro: unknown; readonly tentando: boolean; readonly aoTentarDeNovo: () => void }) {
  if (erro instanceof RespostaForaDoContrato) {
    return (
      <div className="rounded-cartao border-2 border-erro bg-erro-cx p-4">
        <p role="alert" className="t-apoio text-erro">
          {TEXTO_PARA_ATUALIZAR}
        </p>
      </div>
    )
  }
  return <ErrorState erro={erro} tentando={tentando} aoTentarDeNovo={aoTentarDeNovo} />
}
