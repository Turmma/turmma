import { ErrorCode, TAMANHO_MAXIMO_DO_LICENCIANTE, TAMANHO_MAXIMO_TITULO_DO_MATERIAL, type Disciplina, type Material, type MotivoDaRecusaDoMaterial } from '@educa/shared'
import { FileText, Upload } from 'lucide-react'
import { useEffect, useId, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { ErroDaApi } from '../../../api/client'
import { enviarMaterial, excluirMaterial, type CamposDoEnvioDeMaterial } from './api/material'
import { Botao } from '../../../components/ui/Botao'
import { CLASSES_DO_BOTAO_SECUNDARIO } from '../../../components/ui/button-variants'
import { Campo } from '../../../components/ui/fields/Campo'
import { Dialogo } from '../../../components/ui/overlays/Dialogo'
import { useEnvioUnico } from '../../../components/dialogs'
import { Selecao } from '../../../components/ui/fields/Selecao'
import { listaMudou, textoDaFalha } from '../../../components/error-text'
import {
  AVISO_DE_SEM_LICENCA,
  BYTES_DA_ASSINATURA,
  CAMPOS_DO_ENVIO,
  camposDoEnvio,
  errosDoRascunho,
  motivoDaRecusa,
  OPCOES_DE_LICENCA,
  OPCOES_DE_TITULARIDADE,
  problemaDoArquivo,
  tamanhoPorExtenso,
  TEXTO_DA_RECUSA,
  TEXTO_DE_UM_ARQUIVO_POR_VEZ,
  TEXTOS_DA_FALHA_DO_ENVIO,
  tituloPeloArquivo,
  type RascunhoDoEnvio,
} from './material-envio'

interface Envio {
  readonly campos: CamposDoEnvioDeMaterial
  readonly arquivo: File | undefined
}

interface Props {
  /** As disciplinas da escola: todo material é de uma. Sem nenhuma, o diálogo diz onde criá-las e não tem formulário. */
  readonly disciplinas: readonly Disciplina[]
  /** Com o que o formulário abre: vazio, ou o que o material que falhou declarava ("Tentar de novo"). */
  readonly inicial: RascunhoDoEnvio
  /** O material que falhou e que este envio substitui: ele sai da lista quando o novo entra. */
  readonly substitui?: string
  /** O envio deu certo e a lista já foi relida: a tela fecha o diálogo e anuncia. */
  readonly aoEnviar: (substituiu: string | undefined) => void
  /** O envio foi recusado por falta de licença ou de declaração: a tela guarda a recusa na tabela, e o diálogo fica aberto com o motivo. */
  readonly aoRecusar: (campos: CamposDoEnvioDeMaterial, motivo: MotivoDaRecusaDoMaterial) => void
  /** Relê a lista de materiais (o envio que deu conflito mudou o que a escola tem). */
  readonly recarregar: () => Promise<void>
  readonly aoFechar: () => void
  /** Para onde o foco vai ao fechar quando quem abriu o diálogo já saiu da página (o "Enviar material" do vazio). */
  readonly focoDeReserva: () => void
}

/**
 * O diálogo "Enviar material" (X2, 8.0; RF15; D5, D22, D75): o formulário de sempre, agora numa caixa por cima da tela. A coordenação
 * envia o PDF com a titularidade e a licença declaradas.
 *
 * - **Sem licença, ou sem a declaração, o envio é recusado**: a tela manda só o pedido, sem o arquivo, para a recusa ficar na
 *   auditoria da escola, e o diálogo diz "Envio recusado" com o motivo. A recusa não vira material: ela vai à tabela como uma
 *   linha, até a pessoa dispensá-la (`Material.tsx`).
 * - O arquivo entra arrastado **ou** pelo botão: nada aqui só funciona arrastando (regra 50, item 2a).
 * - **Cada abertura é um formulário novo** (`key` de quem o monta): o rascunho e o aviso da tentativa anterior não voltam.
 * - O pedido que está no ar não segura o diálogo: quem fecha desiste de acompanhar, e o resultado chega à tela pelas funções
 *   `aoEnviar` e `aoRecusar`, que vivem na tela e não no diálogo.
 */
export function DialogoDeEnvioDeMaterial({ disciplinas, inicial, substitui, aoEnviar, aoRecusar, recarregar, aoFechar, focoDeReserva }: Props) {
  const [rascunho, definirRascunho] = useState<RascunhoDoEnvio>(inicial)
  const [arquivo, definirArquivo] = useState<File | undefined>(undefined)
  const [erroDoArquivo, definirErroDoArquivo] = useState<string | undefined>(undefined)
  const [conferindo, definirConferindo] = useState(false)
  const [sobre, definirSobre] = useState(false)
  const [tentou, definirTentou] = useState(false)
  const [falha, definirFalha] = useState<string | undefined>(undefined)

  const formulario = useRef<HTMLFormElement>(null)
  const entradaDeArquivo = useRef<HTMLInputElement>(null)
  const botaoDoArquivo = useRef<HTMLButtonElement>(null)
  const alerta = useRef<HTMLParagraphElement>(null)
  const idDoErroDoArquivo = useId()
  const idDaDeclaracao = useId()
  const idDoAvisoDaLicenca = useId()

  const mudar = (parte: Partial<RascunhoDoEnvio>): void => definirRascunho((atual) => ({ ...atual, ...parte }))

  /** Confere o arquivo pelo conteúdo antes de aceitá-lo no formulário: tamanho e assinatura de PDF. */
  async function receberArquivos(arquivos: FileList | null): Promise<void> {
    definirFalha(undefined)
    if (arquivos === null || arquivos.length === 0) return
    if (arquivos.length > 1) return definirErroDoArquivo(TEXTO_DE_UM_ARQUIVO_POR_VEZ)
    const [escolhido] = arquivos
    if (escolhido === undefined) return
    definirConferindo(true)
    let comeco = new Uint8Array()
    try {
      comeco = new Uint8Array(await escolhido.slice(0, BYTES_DA_ASSINATURA).arrayBuffer())
    } catch {
      // Sem conseguir ler o começo, o arquivo é tratado como o que não se abre.
    }
    definirConferindo(false)
    const problema = problemaDoArquivo(escolhido.size, comeco)
    definirErroDoArquivo(problema)
    definirArquivo(problema === undefined ? escolhido : undefined)
    definirRascunho((atual) => ({ ...atual, temArquivo: problema === undefined, titulo: problema === undefined && atual.titulo.trim() === '' ? tituloPeloArquivo(escolhido.name) : atual.titulo }))
  }

  function aoSoltar(evento: DragEvent<HTMLDivElement>): void {
    evento.preventDefault()
    definirSobre(false)
    void receberArquivos(evento.dataTransfer.files)
  }

  const { enviar, mutacao } = useEnvioUnico<Envio, Material>({
    mutationFn: ({ campos, arquivo: doEnvio }) => enviarMaterial(campos, doEnvio),
    onSuccess: async () => {
      if (substitui !== undefined) await excluirMaterial(substitui).catch(() => undefined)
      await recarregar()
      aoEnviar(substitui)
    },
    onError: (erro, envio) => {
      if (erro instanceof ErroDaApi && erro.codigo === ErrorCode.MATERIAL_SEM_LICENCA) {
        const motivo = motivoDaRecusa(envio.campos) ?? 'sem_licenca'
        aoRecusar(envio.campos, motivo)
        definirFalha(`Envio recusado. ${TEXTO_DA_RECUSA[motivo]}`)
      } else {
        definirFalha(textoDaFalha(erro, TEXTOS_DA_FALHA_DO_ENVIO))
        if (listaMudou(erro, [ErrorCode.CONFLITO])) void recarregar()
      }
    },
  })

  // O seletor de arquivo que se fecha sem escolha — ou com o mesmo arquivo de antes — faz o navegador disparar `cancel` no `input`,
  // e esse evento sobe até o `dialog`, cujo `cancel` é o Esc: o diálogo fecharia, com o formulário que a pessoa já preencheu.
  // O `input` só existe com disciplina na escola.
  const comFormulario = disciplinas.length > 0
  useEffect(() => {
    const entrada = entradaDeArquivo.current
    if (entrada === null) return
    const reter = (evento: Event): void => evento.stopPropagation()
    entrada.addEventListener('cancel', reter)
    return () => entrada.removeEventListener('cancel', reter)
  }, [comFormulario])

  // A falha do envio recebe o foco quando chega: quem não a vê na tela a ouve.
  useEffect(() => {
    if (falha !== undefined) alerta.current?.focus()
  }, [falha])

  const erros = tentou ? errosDoRascunho(rascunho) : {}
  const recusa = motivoDaRecusa(rascunho)

  function aoEnviarOFormulario(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault()
    definirTentou(true)
    definirFalha(undefined)
    const campos = camposDoEnvio(rascunho)
    if (campos === undefined) {
      const comErro = errosDoRascunho(rascunho)
      const primeiro = CAMPOS_DO_ENVIO.find((campo) => comErro[campo] !== undefined)
      if (primeiro === 'arquivo') botaoDoArquivo.current?.focus()
      else if (primeiro !== undefined) formulario.current?.querySelector<HTMLElement>(`[data-campo="${primeiro}"] input, [data-campo="${primeiro}"] select`)?.focus()
      return
    }
    // O envio que será recusado vai sem o arquivo: a recusa fica registrada, e o arquivo não sai do computador.
    enviar({ campos, arquivo: recusa === null ? arquivo : undefined })
  }

  return (
    <Dialogo titulo="Enviar material" aoFechar={aoFechar} focoInicial={botaoDoArquivo} focoDeReserva={focoDeReserva}>
      {!comFormulario ? (
        <div className="mt-4 flex min-w-0 flex-col gap-4">
          <p className="text-apoio">Antes de enviar material, crie as disciplinas da escola em Escola › Turmas: todo material é de uma disciplina.</p>
          <div className="flex flex-wrap justify-end gap-3">
            <Botao variante="secundario" onClick={aoFechar}>
              Fechar
            </Botao>
          </div>
        </div>
      ) : (
        <form ref={formulario} className="mt-4 flex min-w-0 flex-col gap-4" onSubmit={aoEnviarOFormulario} noValidate>
          {substitui !== undefined && <p className="text-apoio">Escolha o arquivo de novo, marque a declaração e envie. O material que falhou sai da lista quando o novo entrar.</p>}
          <div
            onDragOver={(evento) => {
              evento.preventDefault()
              definirSobre(true)
            }}
            onDragLeave={() => definirSobre(false)}
            onDrop={aoSoltar}
            className={`flex min-w-0 flex-col items-center gap-2 rounded-cartao border border-dashed p-5 text-center ${sobre ? 'border-tinta bg-realce-suave' : erros.arquivo !== undefined || erroDoArquivo !== undefined ? 'border-erro' : 'border-borda-campo'}`}
          >
            {arquivo === undefined ? <Upload aria-hidden="true" size={24} strokeWidth={1.75} className="text-sutil" /> : <FileText aria-hidden="true" size={24} strokeWidth={1.75} className="text-ok" />}
            {arquivo === undefined ? (
              <p className="text-apoio">Arraste o PDF para cá, ou escolha o arquivo. Um por vez, com até 20 MB.</p>
            ) : (
              <p className="max-w-full font-medium break-words text-tinta">
                {arquivo.name} <span className="font-normal text-apoio">· {tamanhoPorExtenso(arquivo.size)}</span>
              </p>
            )}
            <button
              ref={botaoDoArquivo}
              type="button"
              className={CLASSES_DO_BOTAO_SECUNDARIO}
              onClick={() => entradaDeArquivo.current?.click()}
              {...(erros.arquivo !== undefined || erroDoArquivo !== undefined ? { 'aria-describedby': idDoErroDoArquivo } : {})}
            >
              {arquivo === undefined ? 'Escolher arquivo' : 'Trocar arquivo'}
            </button>
            <input ref={entradaDeArquivo} type="file" accept="application/pdf,.pdf" hidden tabIndex={-1} onChange={(evento) => void receberArquivos(evento.target.files)} data-testid="arquivo-do-material" />
            <p id={idDoErroDoArquivo} role="alert" className="text-sm text-erro empty:hidden">
              {erroDoArquivo ?? erros.arquivo}
            </p>
            <span role="status" className="sr-only">
              {conferindo ? 'Conferindo o arquivo…' : arquivo === undefined ? '' : `Arquivo escolhido: ${arquivo.name}`}
            </span>
          </div>

          <div data-campo="titulo">
            <Campo rotulo="Título" value={rascunho.titulo} maxLength={TAMANHO_MAXIMO_TITULO_DO_MATERIAL} onChange={(evento) => mudar({ titulo: evento.target.value })} erro={erros.titulo} autoComplete="off" />
          </div>
          <div className="grid min-w-0 gap-4">
            <div data-campo="disciplinaId" className="min-w-0">
              <Selecao
                rotulo="Disciplina"
                marcador="Escolha a disciplina"
                opcoes={disciplinas.map((disciplina) => ({ valor: disciplina.id, rotulo: disciplina.nome }))}
                valor={rascunho.disciplinaId}
                aoMudar={(disciplinaId) => mudar({ disciplinaId })}
                erro={erros.disciplinaId}
              />
            </div>
            <div data-campo="titularidade" className="min-w-0">
              <Selecao
                rotulo="De quem é o material"
                marcador="Escolha o dono do conteúdo"
                opcoes={OPCOES_DE_TITULARIDADE}
                valor={rascunho.titularidade}
                aoMudar={(valor) => mudar({ titularidade: OPCOES_DE_TITULARIDADE.find((opcao) => opcao.valor === valor)?.valor ?? '' })}
                erro={erros.titularidade}
              />
            </div>
          </div>
          {rascunho.titularidade === 'terceiro_com_licenca' && (
            <div data-campo="licenciante">
              <Campo
                rotulo="Quem deu a licença"
                dica="O dono do conteúdo: a editora, o sistema de ensino ou o autor."
                value={rascunho.licenciante}
                maxLength={TAMANHO_MAXIMO_DO_LICENCIANTE}
                onChange={(evento) => mudar({ licenciante: evento.target.value })}
                erro={erros.licenciante}
                autoComplete="organization"
              />
            </div>
          )}
          <div data-campo="licenca">
            <Selecao
              rotulo="Licença de uso (obrigatória)"
              marcador="Escolha a licença"
              opcoes={OPCOES_DE_LICENCA}
              valor={rascunho.licenca}
              aoMudar={(valor) => mudar({ licenca: OPCOES_DE_LICENCA.find((opcao) => opcao.valor === valor)?.valor ?? '' })}
              erro={erros.licenca}
              {...(recusa === 'sem_licenca' ? { dica: AVISO_DE_SEM_LICENCA } : {})}
            />
          </div>
          <div className="flex min-w-0 items-start gap-3">
            <input
              id={idDaDeclaracao}
              type="checkbox"
              checked={rascunho.declaracao}
              onChange={(evento) => mudar({ declaracao: evento.target.checked })}
              className="mt-0.5 size-6 shrink-0 accent-tinta"
              {...(recusa === 'sem_declaracao' && tentou ? { 'aria-describedby': idDoAvisoDaLicenca } : {})}
            />
            <label htmlFor={idDaDeclaracao} className="min-w-0 break-words text-tinta">
              Declaro que a escola pode usar este material com os professores e os alunos dela, pela licença indicada acima.
            </label>
          </div>
          <p id={idDoAvisoDaLicenca} className="text-sm text-apoio empty:hidden">
            {recusa === 'sem_declaracao' && tentou ? 'Sem a declaração marcada, o envio é recusado.' : ''}
          </p>

          <p ref={alerta} tabIndex={-1} role="alert" className="rounded-controle border border-erro bg-erro-cx p-3 break-words text-erro empty:hidden">
            {falha}
          </p>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Botao variante="secundario" onClick={aoFechar}>
              Cancelar
            </Botao>
            <Botao type="submit" disabled={mutacao.isPending || conferindo}>
              {mutacao.isPending ? 'Enviando…' : 'Enviar material'}
            </Botao>
          </div>
          <span role="status" className="sr-only">
            {mutacao.isPending ? 'Enviando o material…' : ''}
          </span>
        </form>
      )}
    </Dialogo>
  )
}
