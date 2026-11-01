import { AVISO_DO_COMPLEMENTO, CONTESTACOES_DE_VINCULO, EFEITO_DA_CONTESTACAO, NOME_DA_CONTESTACAO, TAMANHO_MAXIMO_DO_COMPLEMENTO, type ContestacaoDeVinculo, type Vinculo } from '@educa/shared'
import { useId, type FormEvent } from 'react'
import { mensagemDoErro } from '../../../api/client'
import { Button } from '../../../components/ui/Button'
import { Sheet } from '../../../components/ui/overlays/Sheet'
import { LadrilhoDoVinculo, nomeDoVinculo } from './vinculo-na-tela'

/** A contestação que está sendo escrita, no estado de `Turmas`: a lista pode recarregar por baixo sem levá-la junto. */
export interface ContestacaoEmAndamento {
  readonly vinculoId: string
  /** Vazio enquanto nenhum motivo foi escolhido: sem ele, a contestação não é enviada. */
  readonly codigo: ContestacaoDeVinculo | ''
  readonly complemento: string
}

interface PropsDoPainel {
  vinculo: Vinculo
  contestacao: ContestacaoEmAndamento
  enviando: boolean
  falha: unknown
  aoMudar: (contestacao: ContestacaoEmAndamento) => void
  aoEnviar: (evento: FormEvent<HTMLFormElement>) => void
  aoFechar: () => void
  focoDeReserva: () => void
}

/**
 * A contestação, no painel ao lado (folha de baixo a 360 px): o motivo em código fechado, o complemento curto e, antes de enviar,
 * o que vai acontecer. Sem motivo escolhido nada é enviado — o `required` do grupo segura no navegador, e a página confere de novo
 * antes de chamar a API. "Fechar", Esc e "Cancelar" descartam o que foi escrito; enviar com a lista já relida o encerra.
 *
 * Os botões do rodapé ficam fora do `<form>` e o enviam pelo atributo `form`: o painel tem um miolo que rola e um rodapé que fica.
 */
export default function PainelDaContestacao({ vinculo, contestacao, enviando, falha, aoMudar, aoEnviar, aoFechar, focoDeReserva }: PropsDoPainel) {
  const campoComplemento = useId()
  const aviso = useId()
  const formulario = useId()
  return (
    <Sheet
      titulo="Contestar a turma"
      aoFechar={aoFechar}
      focoDeReserva={focoDeReserva}
      rodape={
        <>
          <Button variante="secundario" onClick={aoFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" form={formulario} disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar a contestação'}
          </Button>
        </>
      }
    >
      <form id={formulario} className="flex min-w-0 flex-col gap-4" onSubmit={aoEnviar}>
        <div className="flex min-w-0 items-center gap-3">
          <LadrilhoDoVinculo vinculo={vinculo} tamanho={40} />
          <p className="min-w-0 font-medium break-words text-tinta">{nomeDoVinculo(vinculo)}</p>
        </div>
        {/* Ação oficial: a professora vê o efeito antes de confirmar (regra 50, item 8). Fica no alto, acima dos motivos: a folha de baixo a 360 px rola, e o efeito no fim ficava abaixo da dobra, com o "Enviar" já à vista. */}
        <p className="rounded-controle border border-pendente bg-pendente-cx p-3 text-pendente">{EFEITO_DA_CONTESTACAO}</p>
        <fieldset className="flex flex-col gap-2">
          <legend className="font-medium">O que está errado neste vínculo?</legend>
          {CONTESTACOES_DE_VINCULO.map((codigo) => (
            <label key={codigo} className="flex min-h-11 items-center gap-3">
              <input type="radio" name={`contestacao-${contestacao.vinculoId}`} value={codigo} checked={contestacao.codigo === codigo} onChange={() => aoMudar({ ...contestacao, codigo })} required className="h-6 w-6 accent-noite" />
              <span>{NOME_DA_CONTESTACAO[codigo]}</span>
            </label>
          ))}
        </fieldset>
        <div className="flex flex-col gap-1">
          <label htmlFor={campoComplemento} className="font-medium">
            Quer explicar? (opcional)
          </label>
          <p id={aviso} className="text-sm text-apoio">
            {AVISO_DO_COMPLEMENTO} Até {TAMANHO_MAXIMO_DO_COMPLEMENTO} caracteres.
          </p>
          <textarea
            id={campoComplemento}
            aria-describedby={aviso}
            maxLength={TAMANHO_MAXIMO_DO_COMPLEMENTO}
            rows={3}
            value={contestacao.complemento}
            onChange={(evento) => aoMudar({ ...contestacao, complemento: evento.target.value })}
            className="rounded-controle border border-borda-campo bg-superficie px-3 py-2 text-base text-tinta"
          />
        </div>
        {falha !== undefined && (
          <p role="alert" className="rounded-controle border border-erro bg-erro-cx p-3 text-erro">
            {mensagemDoErro(falha)}
          </p>
        )}
      </form>
    </Sheet>
  )
}
