import { MENSAGEM_DA_FALHA_DE_MATERIAL, NOME_DA_LICENCA, NOME_DA_TITULARIDADE, type Material } from '@educa/shared'
import type { ReactNode } from 'react'
import { Botao } from '../../../components/ui/Botao'
import { PainelLado } from '../../../components/ui/overlays/PainelLado'
import { Estado } from '../../../components/ui/SeloDeEstado'
import { FAMILIA_DA_SITUACAO_DO_MATERIAL, textoDaSituacaoDoMaterial } from './materiais-da-escola'

interface Props {
  readonly material: Material
  /** O nome da disciplina do material, como a lista de disciplinas da escola o tem. */
  readonly disciplina: string
  readonly aoFechar: () => void
  /** Abre o envio com o que o material declarava: só o material que falhou tem o botão. */
  readonly aoTentarDeNovo: () => void
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

/**
 * O painel do material (X2, 8.0; RF15; `?material=<id>`): a situação em texto, o motivo da falha, o que a coordenação declarou ao
 * enviar — de quem é, quem deu a licença, a licença — e as páginas. No rodapé, "Tentar de novo", só no material que falhou, e
 * "Excluir material", que abre a confirmação de perigo de sempre (D5, D75).
 *
 * **Só o que está na lista** (regra 20, itens 4 e 9): o painel não pede nada à API. Nunca o texto lido, o hash do arquivo nem quem
 * enviou (`Material`, em `@educa/shared`, não os tem). O motivo da falha é o texto curto da API para cada código, que diz o que fazer.
 */
export function PainelDoMaterial({ material, disciplina, aoFechar, aoTentarDeNovo, aoExcluir, focoDeReserva }: Props) {
  return (
    <PainelLado
      titulo={material.titulo}
      aoFechar={aoFechar}
      focoDeReserva={focoDeReserva}
      rodape={
        <>
          {material.estado === 'falhou' && (
            <Botao variante="secundario" onClick={aoTentarDeNovo}>
              Tentar de novo
            </Botao>
          )}
          <Botao variante="perigo" onClick={aoExcluir}>
            Excluir material
          </Botao>
        </>
      }
    >
      <div className="flex min-w-0 flex-col gap-5">
        <section aria-label="Situação" className="flex min-w-0 flex-col gap-2">
          <div>
            <Estado familia={FAMILIA_DA_SITUACAO_DO_MATERIAL[material.estado]}>{textoDaSituacaoDoMaterial(material)}</Estado>
          </div>
          {material.falha !== null && <p className="break-words text-erro">{MENSAGEM_DA_FALHA_DE_MATERIAL[material.falha]}</p>}
        </section>
        <dl className="flex min-w-0 flex-col gap-4">
          <Dado rotulo="Disciplina">{disciplina}</Dado>
          <Dado rotulo="De quem é o material">{NOME_DA_TITULARIDADE[material.titularidade]}</Dado>
          {material.licenciante !== null && <Dado rotulo="Quem deu a licença">{material.licenciante}</Dado>}
          <Dado rotulo="Licença de uso">{NOME_DA_LICENCA[material.licenca]}</Dado>
          <Dado rotulo="Páginas">{material.paginas === null ? '—' : String(material.paginas)}</Dado>
        </dl>
      </div>
    </PainelLado>
  )
}
