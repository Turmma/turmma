import { ErrorCode, type Destaque, type DestaqueAbertoResponse } from '@educa/shared'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useSearch } from 'wouter'
import { abrirDestaque, aprovarLote, correcaoDoLoteQueryOptions, recarregarDepoisDoLote } from './api/atividades'
import { ApiError, errorMessage } from '../../../api/client'
import { entregasQueryOptions, decidirEntrega } from '../artefatos/api/entregas'
import { meusVinculosQueryOptions } from '../comum/api/vinculos'
import { Tabs } from '../../../components/ui/Tabs'
import { Alert } from '../../../components/ui/Alert'
import { StickyFooter } from '../../../components/ui/StickyFooter'
import { ProgressBar } from '../../../components/ui/ProgressBar'
import { Button } from '../../../components/ui/Button'
import { Textarea } from '../../../components/ui/fields/Textarea'
import { ConfirmDialog } from '../../../components/ui/overlays/ConfirmDialog'
import { LoadingState, ErrorState, EmptyState } from '../../../components/states/index'
import { AgentSignature } from '../../../components/ui/ai/AgentSignature'
import { ApprovalLine } from '../../../components/ui/ai/ApprovalLine'
import { ListItem } from '../../../components/ui/ListItem'
import { StatCard } from '../../../components/ui/StatCard'
import { Sheet } from '../../../components/ui/overlays/Sheet'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { Table } from '../../../components/ui/Table'
import { SectionHeader, Page } from '../../../components/ui/Page'
import { problemaDoTexto } from '../../../components/ui/fields/text-limits'
import { usePageTitle } from '../../../document-title'
import {
  ABAS_DA_CORRECAO,
  abaDoEndereco,
  acertosDoAluno,
  APOIO_DAS_OUTRAS,
  AVISO_DA_REJEICAO_DO_LOTE,
  AVISO_DO_GABARITO,
  caminhoDeVoltaDaCorrecao,
  contadorDosDestaques,
  destaqueDoEndereco,
  EFEITO_DE_APROVAR_O_LOTE,
  EFEITO_DE_REJEITAR_O_LOTE,
  enderecoDaCorrecao,
  estadoDoDestaque,
  explicacoesDoDestaque,
  letraDaAlternativa,
  motivosDoDestaque,
  numerosDoLote,
  outrasEmOrdemDeNome,
  resumoDoLote,
  rotuloDaFaixa,
  ROTULO_DAS_ABAS_DA_CORRECAO,
  ROTULO_DE_REJEITAR_O_LOTE,
  rotuloDeAprovar,
  textoDeAlunos,
  tituloDasOutras,
  tituloDosDestaques,
} from './aprovar'
import { aprovacaoDaEntrega, AUTOR_QUE_SAIU, LIMITES_DA_JUSTIFICATIVA, VERBO_DA_ENTREGA } from '../artefatos/entregas'
import { nomesDasTurmas } from '../comum/turmas-da-professora'

const idDoDestaque = (alunoId: string) => `destaque-${alunoId}`

/**
 * O que a tela diz quando a decisão não foi registrada por um motivo que não é erro de ninguém. O `CONFLITO` é o lote que
 * mudou desde a leitura (a aprovação vale para o que a pessoa leu: a API confere); o indisponível é o registro que não pôde
 * ser gravado agora. Em todos, **nada foi aprovado**, e a tela relê a correção.
 */
const AVISO_DA_DECISAO: Partial<Record<ErrorCode, string>> = {
  [ErrorCode.ENTREGA_JA_DECIDIDA]: 'Esta correção já tinha sido decidida. A tela foi atualizada com a decisão.',
  [ErrorCode.DESTAQUES_NAO_ABERTOS]: 'Ainda há destaque para abrir. A tela foi atualizada: abra o que falta e aprove de novo.',
  [ErrorCode.CONFLITO]: 'A correção mudou desde que você abriu esta tela, e nada foi aprovado. Ela foi atualizada: confira de novo e aprove.',
  [ErrorCode.INDISPONIVEL_TENTE_DE_NOVO]: 'Não foi possível registrar a decisão agora, e nada foi aprovado. Confira a correção e tente de novo em instantes.',
  [ErrorCode.TEMPO_ESGOTADO]: 'Não foi possível registrar a decisão agora, e nada foi aprovado. Confira a correção e tente de novo em instantes.',
}

/**
 * O que o painel ao lado mostra de um destaque aberto: por que ele foi destacado (em texto, como fato do trabalho), as
 * respostas do aluno questão a questão e o acerto dele nos lotes aprovados antes.
 */
function DestaqueAberto({ aberto }: { aberto: DestaqueAbertoResponse }) {
  return (
    <div data-destaque-aberto="" className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm font-medium break-words text-apoio">{motivosDoDestaque(aberto.destaque)}</p>
        <p className="text-sm break-words text-apoio">{explicacoesDoDestaque(aberto.destaque)}</p>
        <p className="text-sm break-words text-sutil">{acertosDoAluno(aberto.destaque)}</p>
      </div>
      <Table
        rotulo={`Respostas de ${aberto.destaque.nome}`}
        colunas={[
          { chave: 'questao', titulo: 'Questão', celula: (resposta) => String(resposta.questao) },
          { chave: 'marcou', titulo: 'Marcou', celula: (resposta) => (resposta.alternativa === null ? 'Em branco' : letraDaAlternativa(resposta.alternativa)) },
          { chave: 'gabarito', titulo: 'Gabarito', celula: (resposta) => letraDaAlternativa(resposta.gabarito) },
          { chave: 'resultado', titulo: 'Resultado', celula: (resposta) => (resposta.correta ? 'Acertou' : resposta.alternativa === null ? 'Não respondeu' : 'Errou') },
        ]}
        linhas={aberto.respostas}
        chaveDaLinha={(resposta) => String(resposta.questao)}
      />
      {aberto.historico.length === 0 ? (
        <p className="text-sm text-sutil">Este aluno ainda não tem correção aprovada antes desta.</p>
      ) : (
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm font-medium text-tinta">Nas correções aprovadas antes</p>
          <ul className="flex min-w-0 flex-col gap-0.5 text-sm text-apoio">
            {aberto.historico.map((lote, indice) => (
              <li key={indice} className="break-words">
                {lote.titulo}: {String(lote.acertos)} de {String(lote.total)} {lote.total === 1 ? 'acerto' : 'acertos'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/**
 * **Aprovar a correção de objetiva** (`docs/interface.md` 11.5; D33, D46, D56; regra 50, item 8; regra 70): a tela em que
 * a supervisão humana não pode virar clique reflexo. O Assistente corrigiu pelo gabarito; quem faz o resultado valer é a
 * professora, depois de olhar o que precisa ser olhado.
 *
 * - **A faixa de números** abre a tela: quantas correções, quantos destaques já abertos e o acerto médio em questões.
 *   **É diagnóstico, não nota**: a tela fala em acertos e habilidades.
 * - **Três abas no endereço** (`?aba=destaques|outras|resumo`; trocar usa `replace`, e o que não é aba cai em Destaques):
 *   Destaques, com o "Abra estes N antes de aprovar"; Outras, em ordem de nome; Resumo, com a distribuição, o acerto por
 *   habilidade e por questão. A assinatura da função com o selo de IA fica no alto, fora das abas.
 * - **Abrir um destaque** chama a rota que registra a abertura (uma vez, mesmo com dois cliques) e mostra as respostas num
 *   painel ao lado (`?ver=<alunoId>`). O painel só abre pelo endereço para destaque **já aberto**: recarregar com `?ver=` de um
 *   destaque fechado não abre nada e não registra nada (D56).
 * - **O botão de aprovar é o único `oficial` da tela**, na barra presa, **fora das abas**: está nas três e fica desligado até
 *   o último destaque ser aberto, com o contador ao lado dizendo por quê. Quem libera é a API (`podeAprovar`).
 * - **Confirmar diz o que vai acontecer**: a atividade, a turma, quantas correções, e que o diagnóstico chega aos alunos.
 *   Depois, a tela mostra "Validação registrada por … · quando". **Rejeitar** é `perigo` e pede justificativa.
 *
 * A tela não manda o que mostrou: o "apresentado" do registro é montado pelo servidor.
 */
export default function Aprovar({ atividadeAplicadaId }: { atividadeAplicadaId: string }) {
  usePageTitle('Revisar a correção')
  const cliente = useQueryClient()
  const [caminho, navegar] = useLocation()
  const busca = useSearch()
  const correcao = useQuery(correcaoDoLoteQueryOptions(atividadeAplicadaId))
  const entregas = useInfiniteQuery(entregasQueryOptions)
  const vinculos = useInfiniteQuery(meusVinculosQueryOptions)
  const [abertos, definirAbertos] = useState<Readonly<Record<string, DestaqueAbertoResponse>>>({})
  const [decisao, definirDecisao] = useState<'aprovar' | 'rejeitar' | undefined>(undefined)
  const [justificativa, definirJustificativa] = useState('')
  const [tentouRejeitar, definirTentouRejeitar] = useState(false)
  const [aviso, definirAviso] = useState('')
  const decidindo = useRef(false)
  // A abertura que está no ar: o segundo clique, ou o endereço relido, não manda outra (regra 80, item 7).
  const emAbertura = useRef(new Set<string>())
  const situacao = useRef<HTMLDivElement>(null)
  const idDosDestaques = useId()
  const idDasOutras = useId()
  const idDoContador = useId()
  const dados = correcao.data
  const aba = abaDoEndereco(busca)
  const abertosAgora = useMemo(() => new Set(Object.keys(abertos)), [abertos])
  const doPainel = dados === undefined ? undefined : destaqueDoEndereco(busca, dados.destaques, abertosAgora)
  const verId = doPainel?.alunoId
  const doAberto = verId === undefined ? undefined : abertos[verId]

  const abrir = useMutation({
    mutationFn: (alunoId: string) => abrirDestaque(atividadeAplicadaId, alunoId),
    onSuccess: (aberto) => {
      definirAbertos((atuais) => ({ ...atuais, [aberto.destaque.alunoId]: aberto }))
      // A abertura ficou registrada: a tela relê o lote, que traz a hora e libera o botão quando for a última. O painel não espera por isso.
      void cliente.invalidateQueries({ queryKey: correcaoDoLoteQueryOptions(atividadeAplicadaId).queryKey })
    },
    onSettled: (_resposta, _erro, alunoId) => {
      emAbertura.current.delete(alunoId)
    },
  })
  const lerAbertura = abrir.mutate

  /** Abre o destaque: registra a abertura (a primeira vez) e depois mostra o painel. O que já foi lido nesta tela não chama a API de novo. */
  function abrirOuMostrar(alunoId: string): void {
    // O destaque que o endereço já mostra não ganha outro passo no histórico (o "Tentar de novo" do painel cai aqui).
    const mostrar = () => (verId === alunoId ? undefined : navegar(enderecoDaCorrecao(caminho, busca, { ver: alunoId })))
    if (abertos[alunoId] !== undefined) return mostrar()
    if (emAbertura.current.size > 0) return
    emAbertura.current.add(alunoId)
    abrir.mutate(alunoId, { onSuccess: mostrar })
  }

  // O endereço de um destaque que a lista já tem aberto, mas que esta tela ainda não leu (recarregar, ou o link): lê as respostas
  // de novo. A API devolve o mesmo e a primeira hora, e não registra outra abertura.
  useEffect(() => {
    if (verId === undefined || abertos[verId] !== undefined || emAbertura.current.size > 0) return
    emAbertura.current.add(verId)
    lerAbertura(verId)
  }, [verId, abertos, lerAbertura])

  const fecharPainel = (): void => navegar(enderecoDaCorrecao(caminho, busca, { ver: null }), { replace: true })
  const trocarAba = (id: string): void => {
    const nova = ABAS_DA_CORRECAO.find((candidata) => candidata.id === id)
    if (nova !== undefined) navegar(enderecoDaCorrecao(caminho, busca, { aba: nova.id }), { replace: true })
  }

  const fechar = () => definirDecisao(undefined)
  const decidir = useMutation({
    mutationFn: async (escolha: 'aprovar' | 'rejeitar') => {
      if (dados === undefined) throw new ApiError(ErrorCode.ERRO_INTERNO)
      if (escolha === 'aprovar') await aprovarLote(dados.entrega.id)
      else await decidirEntrega(dados.entrega.id, { decisao: 'rejeitar', justificativa: justificativa.trim() })
    },
    onSuccess: async () => {
      definirAviso('')
      // A tela relê o lote antes de o diálogo fechar: a barra de decisão já saiu, e o foco vai para a situação registrada.
      await recarregarDepoisDoLote(cliente)
      fechar()
    },
    onError: async (erro) => {
      if (!(erro instanceof ApiError)) return
      // Outra aba já decidiu, um destaque deixou de estar aberto, o lote mudou desde que a tela o leu, ou o registro não
      // pôde ser gravado agora: a tela se atualiza e diz o que houve, com calma, sem erro cru. Nada foi aprovado.
      const texto = AVISO_DA_DECISAO[erro.codigo]
      if (texto === undefined) return
      definirAviso(texto)
      await recarregarDepoisDoLote(cliente)
      fechar()
    },
    onSettled: () => {
      decidindo.current = false
    },
  })

  // A entrega inteira traz a turma; enquanto ela não chegou (ou se a leitura falhou), o caminho de volta é a lista de turmas.
  const entregaInteira = dados === undefined ? undefined : entregas.data?.pages.flatMap((pagina) => pagina.itens).find((entrega) => entrega.id === dados.entrega.id)
  const voltar = (
    // Relativo à área: o `Route` aninhado em `/professor` resolve o `to` a partir da base dela.
    <Link to={caminhoDeVoltaDaCorrecao(entregaInteira?.turmaId)} className="inline-flex min-h-11 items-center gap-2 self-start text-caramelo-texto underline">
      <ArrowLeft aria-hidden="true" size={18} />
      Voltar para a turma
    </Link>
  )

  if (dados === undefined) {
    const naoEncontrada = correcao.error instanceof ApiError && correcao.error.codigo === ErrorCode.NAO_ENCONTRADO
    return (
      <Page titulo="Revisar a correção" largura="leitura" antes={voltar}>
        {correcao.isPending ? (
          <LoadingState rotulo="Carregando a correção…" />
        ) : naoEncontrada ? (
          <EmptyState titulo="Esta correção não está disponível" descricao="A atividade pode ainda estar aberta, ser de uma turma que não é mais sua, ou o endereço está errado. A correção nasce quando você encerra a atividade, e aparece em “Esperando você”, no sino." />
        ) : (
          <ErrorState erro={correcao.error} tentando={correcao.isFetching} aoTentarDeNovo={() => void correcao.refetch({ cancelRefetch: false })} />
        )}
      </Page>
    )
  }

  const { resumo, destaques, outras } = dados
  const pendente = dados.entrega.estado === 'pendente'
  const contador = contadorDosDestaques(dados)
  const turma = entregaInteira === undefined ? undefined : nomesDasTurmas(vinculos.data?.pages.flatMap((pagina) => pagina.itens) ?? [])[entregaInteira.turmaId]
  const problemaDaJustificativa = problemaDoTexto(justificativa, LIMITES_DA_JUSTIFICATIVA)
  const falha = decidir.isError && !(decidir.error instanceof ApiError && AVISO_DA_DECISAO[decidir.error.codigo] !== undefined) ? errorMessage(decidir.error) : undefined

  function abrirDecisao(escolha: 'aprovar' | 'rejeitar'): void {
    decidir.reset()
    definirJustificativa('')
    definirTentouRejeitar(false)
    definirAviso('')
    definirDecisao(escolha)
  }

  function confirmar(): void {
    if (decisao === undefined || decidindo.current) return
    if (decisao === 'rejeitar') {
      definirTentouRejeitar(true)
      if (problemaDaJustificativa !== undefined) return
    }
    decidindo.current = true
    decidir.mutate(decisao)
  }

  function linhaDoDestaque(destaque: Destaque) {
    const estado = estadoDoDestaque(destaque)
    const abrindo = abrir.isPending && abrir.variables === destaque.alunoId
    // Abrir é o que fica registrado (D56). O já aberto pode ser visto de novo: a hora registrada continua a primeira. Lote já
    // decidido não abre o que ficou fechado: não há mais o que registrar.
    const acionavel = estado.aberto || pendente
    return (
      <li key={destaque.alunoId} id={idDoDestaque(destaque.alunoId)} data-destaque={estado.aberto ? 'aberto' : 'fechado'} className="flex min-w-0 flex-col">
        <ListItem
          titulo={destaque.nome}
          abaixo={`${motivosDoDestaque(destaque)} · ${acertosDoAluno(destaque)}`}
          fim={abrindo ? <StatusBadge familia="pendente">Abrindo…</StatusBadge> : estado.aberto ? <StatusBadge familia="ok">{estado.texto}</StatusBadge> : <StatusBadge familia="pendente">{estado.texto}</StatusBadge>}
          {...(acionavel ? { aoAcionar: () => abrirOuMostrar(destaque.alunoId) } : {})}
        />
        {abrir.isError && abrir.variables === destaque.alunoId && doPainel?.alunoId !== destaque.alunoId && (
          <p role="alert" className="mx-4 mb-3 rounded-controle bg-erro-cx p-3 break-words text-erro">
            {errorMessage(abrir.error)}
          </p>
        )}
      </li>
    )
  }

  const outrasEmOrdem = outrasEmOrdemDeNome(outras)

  return (
    <Page titulo="Revisar a correção" largura="leitura" objeto descricao={turma === undefined ? dados.titulo : `${dados.titulo} · ${turma}`} antes={voltar}>
      <div className="flex min-w-0 flex-col gap-2">
        {/* A correção é saída de IA: leva a assinatura da função e o selo, como toda saída de IA do produto. */}
        <AgentSignature funcao="correcao_de_objetiva" />
        <p className="min-w-0 text-sm break-words text-sutil">Corrigi pelo gabarito e somei os acertos por habilidade. É diagnóstico: o resultado só chega aos alunos depois que você aprovar.</p>
      </div>

      <div ref={situacao} tabIndex={-1} data-situacao-do-lote={dados.entrega.estado} className="flex min-w-0 flex-col items-start gap-2 rounded-cartao">
        {dados.validacao !== null ? (
          <ApprovalLine aprovacao={{ estado: 'aprovada', por: dados.validacao.confirmadaPor?.nome ?? AUTOR_QUE_SAIU, quando: dados.validacao.confirmadaEm }} verbo="Validação registrada por" />
        ) : dados.entrega.estado === 'pendente' ? (
          <ApprovalLine aprovacao={{ estado: 'pendente' }} />
        ) : entregaInteira !== undefined ? (
          <ApprovalLine aprovacao={aprovacaoDaEntrega(entregaInteira)} verbo={VERBO_DA_ENTREGA} />
        ) : (
          // A decisão só é afirmada com quem decidiu (regra 70, item 6): sem a leitura da entrega, a tela diz onde ver.
          <p className="text-sm text-sutil">{dados.entrega.estado === 'rejeitada' ? 'Esta correção foi rejeitada. Quem rejeitou e por quê está em “O que o Assistente fez”, pelo sino.' : 'Esta correção já foi decidida. A decisão está em “O que o Assistente fez”, pelo sino.'}</p>
        )}
        {dados.validacao !== null && <p className="text-sm break-words text-sutil">Os alunos já podem ver o diagnóstico deles. O registro guarda o que esta tela mostrou e os destaques que foram abertos.</p>}
      </div>

      <p role="status" className="rounded-controle bg-info-cx p-3 break-words text-info empty:hidden">
        {aviso}
      </p>

      <div role="group" aria-label="Números da correção" className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        {numerosDoLote(dados).map((numero) => (
          <StatCard key={numero.rotulo} rotulo={numero.rotulo} valor={numero.valor} apoio={numero.apoio} />
        ))}
      </div>

      <Tabs rotulo={ROTULO_DAS_ABAS_DA_CORRECAO} abas={ABAS_DA_CORRECAO} ativa={aba} aoMudar={trocarAba}>
        {aba === 'destaques' && (
          <section aria-labelledby={idDosDestaques} className="flex min-w-0 flex-col gap-3">
            <SectionHeader
              id={idDosDestaques}
              titulo={tituloDosDestaques(destaques.length)}
              apoio={destaques.length === 0 ? 'Nenhuma correção deste lote ficou fora do esperado. Confira o resumo e aprove.' : 'São as correções fora da curva. Abrir cada uma fica registrado, com a hora.'}
            />
            {destaques.length > 0 && <ul className="m-0 flex min-w-0 list-none flex-col divide-y-2 divide-borda overflow-hidden rounded-cartao border-2 border-borda bg-superficie p-0">{destaques.map(linhaDoDestaque)}</ul>}
          </section>
        )}

        {aba === 'outras' && (
          <section aria-labelledby={idDasOutras} className="flex min-w-0 flex-col gap-3">
            <SectionHeader id={idDasOutras} titulo={tituloDasOutras(outras.length)} apoio={outras.length === 0 ? 'Todas as correções deste lote estão nos destaques.' : APOIO_DAS_OUTRAS} />
            {outras.length > 0 && (
              <Table
                rotulo="As outras correções"
                colunas={[
                  { chave: 'nome', titulo: 'Aluno', celula: (aluno) => aluno.nome },
                  { chave: 'acertos', titulo: 'Acertos', celula: (aluno) => acertosDoAluno(aluno) },
                ]}
                linhas={outrasEmOrdem}
                chaveDaLinha={(aluno) => aluno.alunoId}
              />
            )}
          </section>
        )}

        {aba === 'resumo' && (
          <div className="flex min-w-0 flex-col gap-6">
            <section className="flex min-w-0 flex-col gap-3" aria-label="Distribuição dos acertos">
              <SectionHeader titulo="Distribuição dos acertos" apoio="Quantos alunos ficaram em cada faixa de acertos." />
              <div className="flex min-w-0 flex-col gap-3 rounded-cartao border-2 border-borda bg-superficie p-4">
                {resumo.distribuicao.map((faixa) => (
                  <ProgressBar key={`${String(faixa.de)}-${String(faixa.ate)}`} rotulo={rotuloDaFaixa(faixa)} valor={faixa.alunos} maximo={Math.max(resumo.corrigidos, 1)} texto={textoDeAlunos(faixa.alunos)} />
                ))}
              </div>
            </section>

            <section className="flex min-w-0 flex-col gap-3" aria-label="Acerto por habilidade">
              <SectionHeader titulo="Acerto por habilidade" apoio="As respostas certas da turma em cada habilidade, somadas." />
              <div className="flex min-w-0 flex-col gap-3 rounded-cartao border-2 border-borda bg-superficie p-4">
                {resumo.porHabilidade.map((item) => (
                  <ProgressBar key={item.habilidade.codigo} rotulo={`${item.habilidade.codigo} · ${item.habilidade.descricao}`} valor={item.acertos} maximo={item.total} texto={`${String(item.acertos)} de ${String(item.total)}`} />
                ))}
              </div>
            </section>

            <section className="flex min-w-0 flex-col gap-3" aria-label="Por questão">
              <SectionHeader titulo="Por questão" />
              <Alert tom="atencao">{AVISO_DO_GABARITO}</Alert>
              <Table
                rotulo="Acertos por questão"
                colunas={[
                  { chave: 'numero', titulo: 'Questão', celula: (questao) => String(questao.numero) },
                  { chave: 'habilidade', titulo: 'Habilidade', celula: (questao) => questao.habilidade.codigo },
                  { chave: 'gabarito', titulo: 'Gabarito', celula: (questao) => letraDaAlternativa(questao.gabarito) },
                  { chave: 'acertos', titulo: 'Acertaram', celula: (questao) => `${String(questao.acertos)} de ${String(resumo.corrigidos)}` },
                  { chave: 'marcacoes', titulo: 'Marcaram', celula: (questao) => questao.porAlternativa.map((quantos, alternativa) => `${letraDaAlternativa(alternativa)}: ${String(quantos)}`).join(' · ') },
                  { chave: 'branco', titulo: 'Em branco', celula: (questao) => String(questao.emBranco) },
                ]}
                linhas={resumo.porQuestao}
                chaveDaLinha={(questao) => String(questao.numero)}
              />
            </section>
          </div>
        )}
      </Tabs>

      {pendente && (
        <StickyFooter
          rotulo="Aprovação do lote"
          informacao={
            <span id={idDoContador} data-contador-dos-destaques="">
              <span className="font-medium text-tinta">{contador.texto}.</span> {contador.porQue ?? 'Tudo aberto: a aprovação está liberada.'}
            </span>
          }
        >
          <Button variante="perigo" onClick={() => abrirDecisao('rejeitar')}>
            {ROTULO_DE_REJEITAR_O_LOTE}
          </Button>
          {/* O contador diz por que o botão está desligado: o leitor de tela o lê junto do botão. */}
          <Button variante="oficial" disabled={!dados.podeAprovar} aria-describedby={idDoContador} onClick={() => abrirDecisao('aprovar')}>
            {rotuloDeAprovar(resumo.corrigidos)}
          </Button>
        </StickyFooter>
      )}

      {doPainel !== undefined && (
        <Sheet key={doPainel.alunoId} titulo={`Correção de ${doPainel.nome}`} aoFechar={fecharPainel} focoDeReserva={() => situacao.current?.focus()}>
          {doAberto !== undefined ? (
            <DestaqueAberto aberto={doAberto} />
          ) : abrir.isError && abrir.variables === doPainel.alunoId ? (
            <div className="flex min-w-0 flex-col items-start gap-3">
              <p role="alert" className="rounded-controle bg-erro-cx p-3 break-words text-erro">
                {errorMessage(abrir.error)}
              </p>
              <Button variante="secundario" onClick={() => abrirOuMostrar(doPainel.alunoId)}>
                Tentar de novo
              </Button>
            </div>
          ) : (
            <LoadingState rotulo="Abrindo a correção…" />
          )}
        </Sheet>
      )}

      {decisao === 'aprovar' && (
        <ConfirmDialog
          titulo={rotuloDeAprovar(resumo.corrigidos)}
          familia="oficial"
          resumo={resumoDoLote(dados, turma)}
          efeito={EFEITO_DE_APROVAR_O_LOTE}
          rotuloDeConfirmar={rotuloDeAprovar(resumo.corrigidos)}
          rotuloConfirmando="Aprovando…"
          aoConfirmar={confirmar}
          aoFechar={fechar}
          confirmando={decidir.isPending}
          focoDeReserva={() => situacao.current?.focus()}
          {...(falha === undefined ? {} : { falha })}
        />
      )}
      {decisao === 'rejeitar' && (
        <ConfirmDialog
          titulo={ROTULO_DE_REJEITAR_O_LOTE}
          familia="perigo"
          resumo={resumoDoLote(dados, turma)}
          efeito={EFEITO_DE_REJEITAR_O_LOTE}
          rotuloDeConfirmar={ROTULO_DE_REJEITAR_O_LOTE}
          rotuloConfirmando="Rejeitando…"
          aoConfirmar={confirmar}
          aoFechar={fechar}
          confirmando={decidir.isPending}
          focoDeReserva={() => situacao.current?.focus()}
          {...(falha === undefined ? {} : { falha })}
        >
          <Textarea
            rotulo="Por que você está rejeitando?"
            dica={AVISO_DA_REJEICAO_DO_LOTE}
            valor={justificativa}
            aoMudar={definirJustificativa}
            obrigatorio
            desligado={decidir.isPending}
            erro={tentouRejeitar ? problemaDaJustificativa : undefined}
            {...LIMITES_DA_JUSTIFICATIVA}
          />
        </ConfirmDialog>
      )}
    </Page>
  )
}
