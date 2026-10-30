import { VALIDADES_DO_ACESSO_DIAS, type AcessoGeradoResponse, type ValidadeDoAcessoDias } from '@educa/shared'
import { useQuery } from '@tanstack/react-query'
import { useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { consultaAcessoDaTurma, mutacaoDoGerarAcesso, revogarAcesso } from '../api/acesso'
import { caminhoDaSala } from '../../../../caminhos'
import { Botao } from '../../../../componentes/ui/Botao'
import { CLASSES_DO_BOTAO_PERIGO, CLASSES_DO_BOTAO_SECUNDARIO } from '../../../../componentes/ui/botao-secundario'
import { AvisoDaCopia, CampoDoLink, Falha, Pergunta, useCopia, useFechamento, useFocoDaEtapa } from '../../../../componentes/copia-unica'
import { Dialogo } from '../../../../componentes/ui/sobrepostos/Dialogo'
import { CorpoDaConfirmacaoDePerigo, useEnvioUnico } from '../../../../componentes/dialogos'
import { EstadoCarregando, EstadoErro } from '../../../../componentes/estado/index'
import { linkDoConvite } from '../../../../componentes/link-do-convite'
import { TurmaIndisponivel } from '../../../../componentes/TurmaIndisponivel'
import { formatarDataHora } from '../../../../formatar'
import {
  DITOS_DO_CONVITE_SEM_WHATSAPP,
  falhaDoGerarAcesso,
  codigoEmDoisGrupos,
  codigoSoletrado,
  rotuloDaValidade,
  TEXTO_DA_TURMA_INDISPONIVEL,
  TEXTO_DO_ACESSO_NOVO,
  TEXTO_DO_ACESSO_QUE_CAI,
  TEXTO_DO_ACESSO_QUE_JA_APARECEU,
  TEXTO_DO_ACESSO_UMA_VEZ,
  TEXTO_DE_QUEM_VE_A_LISTA,
  TEXTO_DO_REVOGAR,
  TEXTO_DO_WHATSAPP_ABERTO,
  textoDaPerguntaDeFechar,
  TEXTOS_DA_FALHA_DO_REVOGAR,
  turmaIndisponivel,
  VALIDADE_PADRAO_DO_ACESSO_DIAS,
} from './acesso-da-turma'
import { abrirWhatsApp, textoDoWhatsApp } from './texto-do-whatsapp'

/** A escola da sessão, como o `/v1/eu` a traz: o nome vai no texto do WhatsApp, e o endereço, no link da sala. */
export interface EscolaDaSessao {
  readonly nome: string
  readonly slug: string
}

/** Em que passo do convite a professora está, depois de o acesso ser lido. */
type Passo = { readonly tipo: 'vigente' } | { readonly tipo: 'gerar'; readonly substitui: boolean } | { readonly tipo: 'revogar' }

/** O que o diálogo mostra agora: o passo, mais o que vem antes dele (a leitura) e o que vem no meio (a pergunta de fechar). */
type Etapa = 'carregando' | 'erro' | 'vigente' | 'revogar' | 'escolher' | 'acesso' | 'pergunta'

/** O passo em que a leitura do acesso põe a professora: sem acesso, gerar o primeiro; com acesso, o que ela pode fazer com ele. */
function passoDoAcesso(lido: { readonly expiraEm: string | null } | undefined): Passo | undefined {
  if (lido === undefined) return undefined
  return lido.expiraEm === null ? { tipo: 'gerar', substitui: false } : { tipo: 'vigente' }
}

interface PropsDoConvite {
  readonly turmaId: string
  readonly escola: EscolaDaSessao
  /** Relê até quando vale o acesso, dê certo ou não: o `CONFLITO` e o `NAO_ENCONTRADO` dizem que a seção mudou. */
  readonly aoTerminar: () => Promise<void>
  readonly aoFechar: () => void
  /** O acesso foi revogado: quem desenha a seção anuncia e fecha só a abertura em que o pedido saiu. */
  readonly aoRevogar: () => void
  /** Para onde o foco vai ao fechar quando o botão "Convidar alunos" saiu da seção (a leitura caiu). */
  readonly focoDeReserva: () => void
}

/**
 * "Convidar alunos" (telas do professor, 13.0; RF19; A1, 15.0; RF9; W4, W7): o acesso dos alunos à turma num diálogo só, com
 * os passos trocando o conteúdo dele — nunca um diálogo dentro do outro. Cada abertura é uma instância nova (a `key` é de quem
 * desenha), e por isso o link e o código de uma abertura não existem na seguinte (regra 20, item 8).
 *
 * - **Sem acesso**, o primeiro passo é "Gerar acesso": a validade (1, 7 ou 30 dias, 7 já escolhidos), o que acontece e o botão.
 * - **Gerado**, "Acesso gerado" é a **tela inteira**: o link, o código em dois grupos e o WhatsApp. É o passo que a professora
 *   projeta, e por isso nada da página de trás fica legível (`Dialogo`, `inteira`). Os outros passos continuam na caixa de sempre.
 * - **Com acesso vigente**, só até quando vale, "Gerar novo acesso" e "Revogar o acesso", cada um com a pergunta de hoje. O link
 *   e o código **não voltam**: a leitura não os devolve, e o produto só os mostra no passo que os gerou.
 * - O título do diálogo é o do passo ("Gerar acesso", "Gerar novo acesso", "Revogar o acesso"), como era no diálogo de cada um.
 * - **Fechar com o link em risco pergunta antes**, pelo botão e pelo Esc (`useFechamento`); nos passos da caixa de sempre, também pelo
 *   toque fora. No "Acesso gerado", que é a janela inteira, não há "fora". Fechar solta a
 *   mutação: o token sai do diálogo e do cache (`gcTime: 0`).
 * - **O envio é único** (`useEnvioUnico`): dois pedidos de gerar ao mesmo tempo dariam um acesso e um `CONFLITO`.
 * - **A leitura decide só o passo de abertura.** Depois de o passo "Gerar" começar, ele fica: a releitura que o gerar dispara
 *   traz o acesso novo, e não pode trocar o passo debaixo do link que acabou de aparecer.
 */
export function ConvidarAlunos({ turmaId, escola, aoTerminar, aoFechar, aoRevogar, focoDeReserva }: PropsDoConvite) {
  const acesso = useQuery(consultaAcessoDaTurma(turmaId))
  const [passo, definirPasso] = useState<Passo | undefined>(() => passoDoAcesso(acesso.data))
  // A leitura que chega depois de o diálogo abrir (a rede lenta, o "Tentar de novo") escolhe o passo uma vez.
  if (passo === undefined && acesso.data !== undefined) definirPasso(passoDoAcesso(acesso.data))
  // O acesso que outra pessoa revogou com o passo "Vigente" na tela: sem o que revogar nem trocar, o que resta é gerar.
  if (passo?.tipo === 'vigente' && acesso.data?.expiraEm === null) definirPasso({ tipo: 'gerar', substitui: false })

  const [validadeDias, definirValidadeDias] = useState<ValidadeDoAcessoDias>(VALIDADE_PADRAO_DO_ACESSO_DIAS)
  const { enviar, mutacao: gerar } = useEnvioUnico(mutacaoDoGerarAcesso(turmaId, aoTerminar))
  const copia = useCopia()
  const fechamento = useFechamento(gerar.isPending || (gerar.isSuccess && !copia.copiado), gerar.reset, aoFechar)

  const semAlvo = useRef<HTMLElement>(null)
  const vigente = useRef<HTMLParagraphElement>(null)
  const revogar = useRef<HTMLParagraphElement>(null)
  const oQueAcontece = useRef<HTMLParagraphElement>(null)
  const tituloDoAcesso = useRef<HTMLHeadingElement>(null)
  const tituloDaPergunta = useRef<HTMLHeadingElement>(null)
  const idDaValidade = useId()

  const etapa: Etapa = fechamento.perguntando
    ? 'pergunta'
    : passo === undefined
      ? acesso.isError
        ? 'erro'
        : 'carregando'
      : passo.tipo === 'revogar'
        ? 'revogar'
        : passo.tipo === 'vigente'
          ? 'vigente'
          : gerar.isSuccess
            ? 'acesso'
            : 'escolher'
  const alvos: Record<Etapa, RefObject<HTMLElement | null>> = {
    carregando: semAlvo,
    erro: semAlvo,
    vigente,
    revogar,
    escolher: oQueAcontece,
    acesso: tituloDoAcesso,
    pergunta: tituloDaPergunta,
  }
  // Na abertura, no meio do caminho e na volta de uma falha: o foco é do passo, e da falha quando há uma (ela o toma sozinha).
  useFocoDaEtapa(etapa, alvos[etapa], gerar.isError, true)

  const substitui = passo?.tipo === 'gerar' && passo.substitui
  const rotuloDaAcao = substitui ? 'Gerar novo acesso' : 'Gerar acesso'
  const titulo = etapa === 'revogar' ? 'Revogar o acesso' : passo?.tipo === 'gerar' ? rotuloDaAcao : 'Convidar alunos'
  // O passo "Acesso gerado" é projetado: a janela inteira. A pergunta de fechar que vem dele fica na janela inteira também, para o
  // fundo não voltar a aparecer entre os dois; a pergunta de um pedido ainda no ar (sem acesso para esconder) fica na caixa de sempre.
  const inteira = etapa === 'acesso' || (etapa === 'pergunta' && gerar.isSuccess)

  function conteudo(): ReactNode {
    if (etapa === 'carregando')
      return (
        <div className="mt-4 flex min-w-0 flex-col gap-4">
          <EstadoCarregando rotulo="Carregando o acesso da turma…" />
          <BotaoDeFechar aoFechar={fechamento.pedirParaFechar} />
        </div>
      )

    if (etapa === 'erro')
      return (
        <div className="mt-4 flex min-w-0 flex-col gap-4">
          {turmaIndisponivel(acesso.error) ? (
            <TurmaIndisponivel texto={TEXTO_DA_TURMA_INDISPONIVEL} />
          ) : (
            <EstadoErro erro={acesso.error} tentando={acesso.isFetching} aoTentarDeNovo={() => void acesso.refetch({ cancelRefetch: false })} />
          )}
          <BotaoDeFechar aoFechar={fechamento.pedirParaFechar} />
        </div>
      )

    if (etapa === 'pergunta')
      return (
        <Pergunta
          titulo={tituloDaPergunta}
          texto={textoDaPerguntaDeFechar(gerar.isPending)}
          rotuloDeVoltar="Voltar ao acesso"
          aoVoltar={fechamento.voltar}
          aoFecharDeVez={fechamento.fecharDeVez}
        />
      )

    if (etapa === 'revogar')
      return (
        <CorpoDaConfirmacaoDePerigo
          inicio={revogar}
          texto={TEXTO_DO_REVOGAR}
          rotuloDaAcao="Revogar acesso"
          rotuloEmAndamento="Revogando…"
          acao={() => revogarAcesso(turmaId)}
          aoFechar={fechamento.pedirParaFechar}
          aoConcluir={aoRevogar}
          aoTerminar={aoTerminar}
          textosDaFalha={TEXTOS_DA_FALHA_DO_REVOGAR}
        />
      )

    if (etapa === 'acesso' && gerar.data !== undefined)
      return <AcessoGerado acesso={gerar.data} escola={escola} titulo={tituloDoAcesso} copia={copia} aoFechar={fechamento.pedirParaFechar} />

    if (etapa === 'vigente' && acesso.data !== undefined && acesso.data.expiraEm !== null)
      return (
        <div className="mt-4 flex min-w-0 flex-col gap-4">
          <p ref={vigente} tabIndex={-1} className="break-words font-medium text-tinta">
            Vale até {formatarDataHora(acesso.data.expiraEm)}.
          </p>
          <p className="break-words text-apoio">{TEXTO_DO_ACESSO_QUE_JA_APARECEU}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => definirPasso({ tipo: 'gerar', substitui: true })} className={CLASSES_DO_BOTAO_SECUNDARIO}>
              Gerar novo acesso
            </button>
            <button type="button" onClick={() => definirPasso({ tipo: 'revogar' })} className={CLASSES_DO_BOTAO_PERIGO}>
              Revogar o acesso
            </button>
            <button type="button" onClick={fechamento.pedirParaFechar} className={CLASSES_DO_BOTAO_SECUNDARIO}>
              Fechar
            </button>
          </div>
        </div>
      )

    const falha = gerar.isError ? falhaDoGerarAcesso(gerar.error) : undefined
    const semNovaTentativa = falha?.secaoMudou === true
    return (
      <div className="mt-4 flex min-w-0 flex-col gap-4">
        <p ref={oQueAcontece} tabIndex={-1} className="break-words text-apoio">
          {substitui ? TEXTO_DO_ACESSO_QUE_CAI : TEXTO_DO_ACESSO_NOVO}
        </p>
        {/* As três opções em linha: no celular baixo, uma embaixo da outra empurrava o "Cancelar" para fora da tela. */}
        <fieldset className="flex flex-wrap gap-x-6" disabled={gerar.isPending || semNovaTentativa}>
          <legend className="font-medium">Por quanto tempo o link e o código valem?</legend>
          {VALIDADES_DO_ACESSO_DIAS.map((dias) => (
            <label key={dias} className="flex min-h-11 items-center gap-3">
              <input
                type="radio"
                name={idDaValidade}
                value={dias}
                checked={validadeDias === dias}
                onChange={() => definirValidadeDias(dias)}
                className="h-6 w-6 accent-noite"
              />
              <span>{rotuloDaValidade(dias)}</span>
            </label>
          ))}
        </fieldset>
        <p className="text-apoio">{TEXTO_DO_ACESSO_UMA_VEZ}</p>
        {falha !== undefined && <Falha texto={falha.texto} erro={gerar.error} />}
        <div className="flex flex-wrap gap-3">
          {!semNovaTentativa && (
            <Botao onClick={() => enviar({ validadeDias })} disabled={gerar.isPending}>
              {gerar.isPending ? 'Gerando…' : rotuloDaAcao}
            </Botao>
          )}
          <button type="button" onClick={fechamento.pedirParaFechar} className={CLASSES_DO_BOTAO_SECUNDARIO}>
            {semNovaTentativa ? 'Fechar' : 'Cancelar'}
          </button>
        </div>
        <span role="status" className="sr-only">
          {gerar.isPending ? 'Gerando o acesso…' : ''}
        </span>
      </div>
    )
  }

  return (
    <Dialogo
      titulo={titulo}
      aoFechar={fechamento.pedirParaFechar}
      aoFecharPeloNavegador={fechamento.fecharDeVez}
      fecharAoClicarFora
      focoDeReserva={focoDeReserva}
      inteira={inteira}
    >
      {conteudo()}
    </Dialogo>
  )
}

/** O "Fechar" dos passos que não têm outra saída (a leitura em andamento, ou caída). */
function BotaoDeFechar({ aoFechar }: { aoFechar: () => void }) {
  return (
    <div className="flex flex-wrap gap-3">
      <button type="button" onClick={aoFechar} className={CLASSES_DO_BOTAO_SECUNDARIO}>
        Fechar
      </button>
    </div>
  )
}

/**
 * O acesso gerado, uma vez: o código da turma, grande e nos dois grupos de quatro, para projetar; o link da sala, para
 * copiar; e o WhatsApp, com o texto de `textoDoWhatsApp`, que leva só o nome da escola e o link. Sem o WhatsApp (o
 * navegador não abriu a aba nova), o mesmo botão copia o texto; sem área de transferência, seleciona o link no campo.
 * A tela diz o que o link abre e o que vai pelo WhatsApp, antes de a professora mandar (regra 20, item 8).
 */
function AcessoGerado({
  acesso,
  escola,
  titulo,
  copia,
  aoFechar,
}: {
  acesso: AcessoGeradoResponse
  escola: EscolaDaSessao
  titulo: RefObject<HTMLHeadingElement | null>
  copia: ReturnType<typeof useCopia>
  aoFechar: () => void
}) {
  const campo = useRef<HTMLInputElement>(null)
  const idDoCodigo = useId()
  const caminho = caminhoDaSala(escola.slug)
  const link = linkDoConvite(window.location.origin, caminho, acesso.token)

  async function compartilhar(): Promise<void> {
    const texto = textoDoWhatsApp({ escolaNome: escola.nome, link })
    if (abrirWhatsApp(texto, window)) {
      copia.saiu(TEXTO_DO_WHATSAPP_ABERTO)
      return
    }
    await copia.copiar(texto, campo.current, DITOS_DO_CONVITE_SEM_WHATSAPP)
  }

  return (
    <div className="mt-4 flex min-w-0 flex-col gap-4">
      <h3 ref={titulo} tabIndex={-1} className="font-semibold">
        Acesso gerado
      </h3>
      <p className="break-words text-apoio">Vale até {formatarDataHora(acesso.expiraEm)}. Depois de fechar, o link e o código não aparecem de novo.</p>
      <div role="group" aria-labelledby={idDoCodigo} className="flex min-w-0 flex-col gap-1">
        <p id={idDoCodigo} className="font-medium">
          Código da turma
        </p>
        {/* Grande, para projetar. O leitor de tela leria os dois grupos como palavras: para ele vai o código soletrado. */}
        <p aria-hidden="true" className="font-mono text-4xl font-semibold tracking-widest text-tinta sm:text-6xl lg:text-8xl">
          {codigoEmDoisGrupos(acesso.codigo)}
        </p>
        <p className="sr-only">{codigoSoletrado(acesso.codigo)}</p>
        <p className="text-sm text-apoio">
          Para entrar com o código, os alunos abrem <span className="font-medium text-tinta wrap-anywhere">{`${window.location.host}${caminho}`}</span>.
        </p>
      </div>
      <CampoDoLink ref={campo} rotulo="Link da sala" link={link} aoCopiarAMao={copia.copiadoAMao} />
      <p className="text-sm text-apoio">{TEXTO_DE_QUEM_VE_A_LISTA}</p>
      <AvisoDaCopia texto={copia.texto} vez={copia.vez} copiado={copia.copiado} />
      <div className="flex flex-wrap gap-3">
        <Botao onClick={() => void copia.copiar(link, campo.current)}>Copiar link</Botao>
        <button type="button" onClick={() => void compartilhar()} className={CLASSES_DO_BOTAO_SECUNDARIO}>
          Compartilhar pelo WhatsApp
        </button>
        <button type="button" onClick={aoFechar} className={CLASSES_DO_BOTAO_SECUNDARIO}>
          Fechar
        </button>
      </div>
    </div>
  )
}
