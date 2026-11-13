import type { Disciplina, MotivoDaRecusaDoMaterial } from '@educa/shared'
import { useEffect, useId, useRef } from 'react'
import { type CamposDoEnvioDeMaterial } from './api/material'
import { Button } from '../../../components/ui/Button'
import { Select } from '../../../components/ui/fields/Select'
import { Dialog } from '../../../components/ui/overlays/Dialog'
import { TEXTO_DA_PARADA } from './envio-em-lote'
import {
  AVISO_DE_SEM_LICENCA,
  motivoDaRecusa,
  OPCOES_DE_LICENCA,
  OPCOES_DE_TITULARIDADE,
  rotuloDoBotaoDeEnvio,
  textoDoLimiteDeEnvios,
  type RascunhoDoEnvio,
} from './material-envio'
import { AreaDeArquivos, CampoDeLicencaRegistrada, CampoDeSeries, ListaDoLote, type LoteDeMaterial } from './PartesDoEnvioDeMaterial'
import { useLoteDeMaterial } from './use-lote-de-material'

const SEM_ERROS: LoteDeMaterial['erros'] = { titulos: new Map<number, string>() }

interface Props {
  /** As disciplinas da escola: todo material é de uma. Sem nenhuma, o diálogo diz onde criá-las e não tem formulário. */
  readonly disciplinas: readonly Disciplina[]
  /** Com o que o formulário abre: vazio, ou o que o material que falhou declarava ("Tentar de novo"). */
  readonly inicial: RascunhoDoEnvio
  /** O material que falhou e que este envio substitui: ele sai da lista quando o novo entra. O envio de um material que substitui é de um arquivo só. */
  readonly substitui?: string
  /** O lote terminou sem pendência nem falha e a lista já foi relida: a tela fecha o diálogo e anuncia. */
  readonly aoConcluir: (resultado: { readonly enviados: number; readonly substituiu: string | undefined }) => void
  /** O envio foi recusado por falta de licença ou de declaração: a tela guarda a recusa na tabela, e o diálogo fica aberto com o motivo. */
  readonly aoRecusar: (campos: CamposDoEnvioDeMaterial, motivo: MotivoDaRecusaDoMaterial) => void
  /** Relê a lista de materiais (o envio mudou o que a escola tem). */
  readonly recarregar: () => Promise<void>
  readonly aoFechar: () => void
  /** Para onde o foco vai ao fechar quando quem abriu o diálogo já saiu da página (o "Enviar material" do vazio). */
  readonly focoDeReserva: () => void
}

/**
 * O diálogo "Enviar material" (X2, 8.0; ingestao-do-material, 7.0; RF3, RF14, RF16; D5, D22, D75): a coordenação envia **até 20 PDFs de uma vez**, com a mesma
 * disciplina, as mesmas séries, a mesma titularidade e a mesma licença; cada PDF vira um material, com o título tirado do nome do arquivo e editável.
 *
 * - **Um por vez** (`envio-em-lote.ts`): o que a API aceita num pedido é um arquivo, e o teto de envios dela vale para o lote. O que falha não derruba os outros; o repetido é
 *   "já enviado"; o 429 e a licença que venceu **param** o lote, os arquivos que faltam ficam na lista, e o envio continua no horário (429) ou pelo botão. Duplo clique no botão
 *   não abre dois lotes. Cada abertura é um formulário novo (`key` de quem o monta), e quem fecha o diálogo, ou muda de sessão, deixa de enviar os arquivos seguintes.
 * - **O material de terceiro cita uma licença registrada** (`GET /v1/licencas`), só as que **valem hoje**: a vencida não se escolhe. A lista é lida de novo ao abrir e quando a janela volta
 *   ao foco, porque a licença pode vencer com o diálogo aberto (R6); a que a pessoa tinha escolhido e que deixou de valer sai da escolha, dita. Sem nenhuma licença vigente, o diálogo diz
 *   "Registre a licença primeiro" e leva a Licenças.
 * - **Sem licença, ou sem a declaração, o envio é recusado**: a tela manda só o pedido, sem arquivo, para a recusa ficar na auditoria da escola, e o diálogo diz "Envio recusado" com o motivo.
 *   A recusa não vira material: ela vai à tabela como uma linha, até a pessoa dispensá-la (`Material.tsx`).
 * - O arquivo entra arrastado **ou** pelo botão: nada aqui só funciona arrastando (regra 50, item 2a). Uma região `aria-live` diz a situação de cada arquivo, e o foco vai ao resumo no fim.
 */
export function DialogoDeEnvioDeMaterial({ disciplinas, inicial, substitui, aoConcluir, aoRecusar, recarregar, aoFechar, focoDeReserva }: Props) {
  const formulario = useRef<HTMLFormElement>(null)
  const botaoDoArquivo = useRef<HTMLButtonElement>(null)
  const resumo = useRef<HTMLParagraphElement>(null)
  const alerta = useRef<HTMLParagraphElement>(null)
  const lote = useLoteDeMaterial({ inicial, substitui, aoConcluir, aoRecusar, recarregar, formulario, botaoDoArquivo, resumo })
  const { falha } = lote

  // A falha do envio, e o que parou o lote, recebem o foco quando chegam: quem não a vê na tela a ouve.
  useEffect(() => {
    if (falha !== undefined) alerta.current?.focus()
  }, [falha])

  return (
    <Dialog titulo="Enviar material" aoFechar={aoFechar} focoInicial={botaoDoArquivo} focoDeReserva={focoDeReserva}>
      {disciplinas.length === 0 ? (
        <SemDisciplinas aoFechar={aoFechar} />
      ) : (
        <form ref={formulario} className="mt-4 flex min-w-0 flex-col gap-4" onSubmit={lote.aoEnviarOFormulario} noValidate>
          {substitui !== undefined && <p className="text-apoio">Escolha o arquivo de novo, marque a declaração e envie. O material que falhou sai da lista quando o novo entrar.</p>}
          <CorpoDoFormulario lote={lote} disciplinas={disciplinas} umArquivoSo={substitui !== undefined} botao={botaoDoArquivo} resumo={resumo} />
          <p ref={alerta} tabIndex={-1} role="alert" className="rounded-controle border border-erro bg-erro-cx p-3 break-words text-erro empty:hidden">
            {falha ?? textoDaParada(lote)}
          </p>
          <RodapeDoEnvio lote={lote} umArquivoSo={substitui !== undefined} aoFechar={aoFechar} />
          <span role="status" className="sr-only">
            {lote.emCurso ? 'Enviando os materiais…' : ''}
          </span>
          <span role="status" aria-live="polite" className="sr-only" data-testid="situacao-do-lote">
            {lote.anuncio}
          </span>
        </form>
      )}
    </Dialog>
  )
}

function textoDaParada({ parada, limiteTexto }: LoteDeMaterial): string | undefined {
  if (parada === undefined || parada.tipo === 'cancelado') return undefined
  return parada.tipo === 'limite' ? (limiteTexto ?? textoDoLimiteDeEnvios(undefined)) : TEXTO_DA_PARADA[parada.tipo]
}

function SemDisciplinas({ aoFechar }: { readonly aoFechar: () => void }) {
  return (
    <div className="mt-4 flex min-w-0 flex-col gap-4">
      <p className="text-apoio">Antes de enviar material, crie as disciplinas da escola em Escola › Turmas: todo material é de uma disciplina.</p>
      <div className="flex flex-wrap justify-end gap-3">
        <Button variante="secundario" onClick={aoFechar}>
          Fechar
        </Button>
      </div>
    </div>
  )
}

function RodapeDoEnvio({ lote, umArquivoSo, aoFechar }: { readonly lote: LoteDeMaterial; readonly umArquivoSo: boolean; readonly aoFechar: () => void }) {
  const jaSaiu = lote.itens.some((item) => item.situacao === 'enviado' || item.situacao === 'ja_enviado')
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <Button variante="secundario" onClick={aoFechar}>
        {jaSaiu ? 'Fechar' : 'Cancelar'}
      </Button>
      <Button type="submit" disabled={lote.emCurso || lote.conferindo}>
        {rotuloDoBotaoDeEnvio({ emCurso: lote.emCurso, parada: lote.parada, itens: lote.itens, umArquivoSo })}
      </Button>
    </div>
  )
}

interface CorpoProps {
  readonly lote: LoteDeMaterial
  readonly disciplinas: readonly Disciplina[]
  readonly umArquivoSo: boolean
  readonly botao: React.RefObject<HTMLButtonElement | null>
  readonly resumo: React.RefObject<HTMLParagraphElement | null>
}

/** O arquivo, a lista do lote e o que vale para o lote todo: disciplina, séries, de quem é, licença registrada, licença de uso e declaração. */
function CorpoDoFormulario({ lote, disciplinas, umArquivoSo, botao, resumo }: CorpoProps) {
  const { efetivo, rascunho, mudar, emCurso, itens } = lote
  const mostrados = lote.tentou ? lote.erros : SEM_ERROS
  /** O lote já começou: o que vale para ele todo não muda mais; só a licença registrada, que pode ter vencido no meio. */
  const travado = emCurso || itens.some((item) => item.situacao !== 'pendente')
  return (
    <>
      <AreaDeArquivos lote={lote} erroDoArquivo={mostrados.arquivo} travado={travado} umArquivoSo={umArquivoSo} botao={botao} />
      <ListaDoLote lote={lote} errosDosTitulos={mostrados.titulos} umArquivoSo={umArquivoSo} resumo={resumo} />
      <div className="grid min-w-0 gap-4">
        <div data-campo="disciplinaId" className="min-w-0">
          <Select
            rotulo="Disciplina"
            obrigatoria
            marcador="Escolha a disciplina"
            opcoes={disciplinas.map((disciplina) => ({ valor: disciplina.id, rotulo: disciplina.nome }))}
            valor={rascunho.disciplinaId}
            aoMudar={(disciplinaId) => mudar({ disciplinaId })}
            erro={mostrados.disciplinaId}
            desligada={travado}
          />
        </div>
        <CampoDeSeries marcadas={rascunho.serieIds} aoMudar={(serieIds) => mudar({ serieIds })} erro={mostrados.serieIds} desligado={travado} />
        <div data-campo="titularidade" className="min-w-0">
          <Select
            rotulo="De quem é o material"
            obrigatoria
            marcador="Escolha o dono do conteúdo"
            opcoes={OPCOES_DE_TITULARIDADE}
            valor={rascunho.titularidade}
            aoMudar={(valor) => mudar({ titularidade: OPCOES_DE_TITULARIDADE.find((opcao) => opcao.valor === valor)?.valor ?? '' })}
            erro={mostrados.titularidade}
            desligada={travado}
          />
        </div>
      </div>
      {efetivo.titularidade === 'terceiro_com_licenca' && <CampoDeLicencaRegistrada lote={lote} erro={mostrados.licencaId} />}
      <LicencaDeUsoEDeclaracao lote={lote} erro={mostrados.licenca} travado={travado} />
    </>
  )
}

function LicencaDeUsoEDeclaracao({ lote, erro, travado }: { readonly lote: LoteDeMaterial; readonly erro: string | undefined; readonly travado: boolean }) {
  const { rascunho, efetivo, mudar, tentou } = lote
  const idDaDeclaracao = useId()
  const idDoAviso = useId()
  const recusa = motivoDaRecusa(efetivo)
  const avisoDaDeclaracao = recusa === 'sem_declaracao' && tentou
  return (
    <>
      <div data-campo="licenca">
        <Select
          rotulo="Licença de uso (obrigatória)"
          marcador="Escolha a licença"
          opcoes={OPCOES_DE_LICENCA}
          valor={rascunho.licenca}
          aoMudar={(valor) => mudar({ licenca: OPCOES_DE_LICENCA.find((opcao) => opcao.valor === valor)?.valor ?? '' })}
          erro={erro}
          desligada={travado}
          {...(recusa === 'sem_licenca' ? { dica: AVISO_DE_SEM_LICENCA } : {})}
        />
      </div>
      <div className="flex min-w-0 items-start gap-3">
        <input
          id={idDaDeclaracao}
          type="checkbox"
          checked={rascunho.declaracao}
          disabled={travado}
          onChange={(evento) => mudar({ declaracao: evento.target.checked })}
          className="mt-0.5 size-6 shrink-0 accent-tinta"
          {...(avisoDaDeclaracao ? { 'aria-describedby': idDoAviso } : {})}
        />
        <label htmlFor={idDaDeclaracao} className="flex min-h-11 min-w-0 items-center break-words text-tinta">
          Declaro que a escola pode usar este material com os professores e os alunos dela, pela licença indicada acima.
        </label>
      </div>
      <p id={idDoAviso} className="text-sm text-apoio empty:hidden">
        {avisoDaDeclaracao ? 'Sem a declaração marcada, o envio é recusado.' : ''}
      </p>
    </>
  )
}
