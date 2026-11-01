import { MOTIVOS_DE_SUSPENSAO, NOME_DO_MOTIVO_DE_SUSPENSAO, NOMES_DOS_AGENTES, type Agente, type FuncaoDaGovernanca, type MotivoDeSuspensao } from '@educa/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { aplicarFuncao, consultaFuncoesDaGovernanca, retomarFuncao, suspenderFuncao } from './api/governanca'
import { ArrowLeft } from 'lucide-react'
import { Link, useLocation, useSearch } from 'wouter'
import { ROTAS_DA_COORDENACAO } from '../../../paths'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { ConfirmDialog } from '../../../components/ui/overlays/ConfirmDialog'
import { Anuncio, useEnvioUnico } from '../../../components/dialogs'
import { EstadoCarregando, EstadoErro } from '../../../components/states/index'
import { AgentSignature } from '../../../components/ui/ai/AgentSignature'
import { MEDIA_MD, useMediaQuery } from '../../../components/ui/media-query'
import { SegmentedControl, type SegmentedOptions } from '../../../components/ui/fields/SegmentedControl'
import { Select } from '../../../components/ui/fields/Select'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { Page } from '../../../components/ui/Page'
import { textoDaFalha } from '../../../components/error-text'
import { formatarDataHora } from '../../../format'
import { useTituloDaTela } from '../../../document-title'
import { enderecoComParametro } from '../comum/endereco-da-tela'
import { O_MIOLO_DOS_AGENTES } from '../comum/miolo-que-rola'
import { O_QUE_A_IA_NUNCA_FAZ } from './nunca-faz'
import { agenteDoEndereco, AVISO_DA_SUSPENSAO, EFEITO_DA_SUSPENSAO, NOME_DA_AUTONOMIA } from './textos-da-governanca'

/** As três IAs do seletor, com o nome de função de cada uma (D17) e o valor que o endereço leva (`?ia=tutor`). */
const OPCOES_DE_IA: SegmentedOptions<Agente> = [
  { valor: 'assistente_de_ensino', rotulo: NOMES_DOS_AGENTES.assistente_de_ensino },
  { valor: 'tutor', rotulo: NOMES_DOS_AGENTES.tutor },
  { valor: 'analista_de_desempenho_escolar', rotulo: NOMES_DOS_AGENTES.analista_de_desempenho_escolar },
]

const OPCOES_DE_MOTIVO = MOTIVOS_DE_SUSPENSAO.map((motivo) => ({ valor: motivo, rotulo: NOME_DO_MOTIVO_DE_SUSPENSAO[motivo] }))

function ehMotivo(valor: string): valor is MotivoDeSuspensao {
  return (MOTIVOS_DE_SUSPENSAO as readonly string[]).includes(valor)
}

interface FuncaoDoAgente {
  readonly funcao: FuncaoDaGovernanca
  readonly agente: string
}

/**
 * "Como cada IA trabalha" (X2, 11.0; MVP, A5; `docs/interface.md` 11.7; D9, D32, D60; regra 70, item 5): a página, dentro de Registros,
 * que responde "o que essa IA faz sozinha?". **Uma IA por vez**, escolhida no seletor "Qual IA" e guardada no endereço (`?ia=`): as
 * funções dela, com o que cada uma faz sozinha e o que espera uma pessoa, nas palavras do catálogo `FUNCOES` (as mesmas que o
 * professor lê), o selo de alto risco, e a suspensão **só daquela função**, que vale no servidor. Embaixo, o que nenhuma função faz.
 * A partir de 768 px só o miolo rola, abaixo do título e do seletor (RF23).
 */
export default function Agentes() {
  useTituloDaTela('Como cada IA trabalha')
  // O miolo que rola recebe foco, para rolar pelo teclado, a partir de 768 px: abaixo disso rola a página, e não há o que focar.
  const comMiolo = useMediaQuery(MEDIA_MD)
  const cliente = useQueryClient()
  const [caminho, navegar] = useLocation()
  const busca = useSearch()
  const ia = agenteDoEndereco(busca)
  const funcoes = useQuery(consultaFuncoesDaGovernanca)
  const [suspendendo, definirSuspendendo] = useState<FuncaoDoAgente | undefined>(undefined)
  const [anuncio, definirAnuncio] = useState('')
  // Para onde o foco vai se o botão que abriu a confirmação não estiver mais na tela quando ela fecha.
  const avisos = useRef<HTMLDivElement>(null)
  // Depois de suspender ou retomar, o botão daquela função troca por outro: o foco vai para o novo, e não cai no `body`.
  // A chave fica numa ref, e o efeito roda depois de cada render (o anúncio e a lista nova sempre renderizam de novo).
  const focarFuncao = useRef<string | undefined>(undefined)
  useEffect(() => {
    const chave = focarFuncao.current
    if (chave === undefined) return
    focarFuncao.current = undefined
    document.querySelector<HTMLButtonElement>(`[data-funcao="${chave}"] button[data-alternar-funcao]`)?.focus()
  })
  // A IA que está na tela agora: a resposta de uma retomada chega com o fecho da renderização em que saiu, e lê a IA por aqui.
  const iaNaTela = useRef(ia)
  useEffect(() => {
    iaNaTela.current = ia
  }, [ia])
  const retomada = useEnvioUnico({
    mutationFn: ({ funcao }: { funcao: FuncaoDaGovernanca; agente: Agente }) => retomarFuncao(funcao.chave),
    onSuccess: (nova, { agente }) => {
      aplicarFuncao(cliente, nova)
      // A resposta que chega com outra IA na tela não anuncia lá: a lista já mostra a função retomada quando a IA dela voltar.
      if (agente !== iaNaTela.current) return
      definirAnuncio(`A função "${nova.nome}" voltou a funcionar nesta escola.`)
      focarFuncao.current = nova.chave
    },
    // A que já tinha sido retomada em outra aba responde como inexistente: a lista é lida de novo e mostra como está.
    onError: () => void cliente.invalidateQueries({ queryKey: consultaFuncoesDaGovernanca.queryKey }),
  })

  // O anúncio e o aviso da retomada são de uma função da IA que estava na tela: ao trocar de IA saem, para não ficarem acima do cartão de outra.
  const escolherIA = (agente: Agente): void => {
    definirAnuncio('')
    retomada.mutacao.reset()
    iaNaTela.current = agente
    navegar(enderecoComParametro(caminho, busca, 'ia', agente), { replace: true })
  }

  // "‹ Registros" (X2, 3.0): a página fica dentro de Registros, que continua aceso na lateral.
  const voltar = (
    <Link to={ROTAS_DA_COORDENACAO.governanca} aria-label="Voltar para Registros" className="inline-flex min-h-11 items-center gap-2 self-start text-caramelo-texto underline">
      <ArrowLeft aria-hidden="true" size={18} />
      Registros
    </Link>
  )

  // O seletor e o miolo são os mesmos nos três estados: escolher a IA vale também enquanto a lista lê ou falha.
  let conteudo: ReactNode
  if (funcoes.isPending) {
    conteudo = <EstadoCarregando rotulo="Carregando os agentes…" />
  } else if (funcoes.isError) {
    conteudo = <EstadoErro erro={funcoes.error} tentando={funcoes.isFetching} aoTentarDeNovo={() => void funcoes.refetch({ cancelRefetch: false })} />
  } else {
    conteudo = (
      <>
        <p className="max-w-prose text-apoio">
          São três agentes, um para cada pessoa da escola. Cada função diz aqui o que faz sozinha e o que espera uma pessoa. A escola pode suspender uma função sem desligar as outras.
        </p>
        <div ref={avisos} tabIndex={-1}>
          <Anuncio texto={anuncio} />
        </div>
        {retomada.mutacao.isError && (
          <p role="alert" className="rounded-controle border border-erro bg-erro-cx p-3 break-words text-erro">
            {textoDaFalha(retomada.mutacao.error, { NAO_ENCONTRADO: 'Esta função já não estava suspensa. A lista foi atualizada.' })}
          </p>
        )}
        {funcoes.data.agentes
          .filter((agente) => agente.agente === ia)
          .map((agente) => (
            <CartaoDoAgente
              key={agente.agente}
              agente={agente.agente}
              nome={agente.nome}
              funcoes={agente.funcoes}
              retomando={retomada.mutacao.isPending ? retomada.mutacao.variables.funcao.chave : undefined}
              aoSuspender={(funcao) => {
                definirAnuncio('')
                retomada.mutacao.reset()
                definirSuspendendo({ funcao, agente: agente.nome })
              }}
              aoRetomar={(funcao) => {
                definirAnuncio('')
                retomada.enviar({ funcao, agente: agente.agente })
              }}
            />
          ))}

        <Card titulo="O que a IA nunca faz">
          <p className="text-apoio">Vale para os três agentes e para todas as funções, por lei ou por escolha do produto. Não há configuração que ligue isto.</p>
          <ul className="mt-3 flex min-w-0 list-disc flex-col gap-1.5 pl-5">
            {O_QUE_A_IA_NUNCA_FAZ.map((frase) => (
              <li key={frase} className="break-words text-tinta">
                {frase}
              </li>
            ))}
          </ul>
        </Card>
      </>
    )
  }

  return (
    <Page titulo="Como cada IA trabalha" largura="leitura" antes={voltar}>
      <SegmentedControl rotulo="Qual IA" opcoes={OPCOES_DE_IA} valor={ia} aoMudar={escolherIA} />
      <section aria-label="O que cada função da IA faz" {...(comMiolo ? { tabIndex: 0 } : {})} className={`flex min-w-0 flex-col gap-4 ${O_MIOLO_DOS_AGENTES}`}>
        {conteudo}
      </section>

      {suspendendo !== undefined && (
        <SuspenderFuncao
          key={suspendendo.funcao.chave}
          alvo={suspendendo}
          aoFechar={() => definirSuspendendo(undefined)}
          focoDeReserva={() => avisos.current?.focus()}
          aoSuspender={(nova) => {
            aplicarFuncao(cliente, nova)
            definirAnuncio(`A função "${nova.nome}" está suspensa nesta escola.`)
            focarFuncao.current = nova.chave
            definirSuspendendo(undefined)
          }}
        />
      )}
    </Page>
  )
}

interface PropsDoCartaoDoAgente {
  readonly agente: Agente
  readonly nome: string
  readonly funcoes: readonly FuncaoDaGovernanca[]
  /** A função cuja retomada está no ar: o botão dela desliga. */
  readonly retomando: string | undefined
  readonly aoSuspender: (funcao: FuncaoDaGovernanca) => void
  readonly aoRetomar: (funcao: FuncaoDaGovernanca) => void
}

function CartaoDoAgente({ agente, nome, funcoes, retomando, aoSuspender, aoRetomar }: PropsDoCartaoDoAgente) {
  return (
    <section data-cartao-do-agente={agente} aria-label={nome} className="flex min-w-0 flex-col gap-4 rounded-cartao border-2 border-borda bg-superficie p-4 lg:p-5">
      {/* O nome da função é o título do cartão (`h2`), e vem com o avatar e o selo "IA" no mesmo bloco (RF10). */}
      <AgentSignature agente={agente} tamanho={48} titulo={2} />
      <ul className="flex min-w-0 flex-col gap-4">
        {funcoes.map((funcao) => (
          <li key={funcao.chave} data-funcao={funcao.chave} className="flex min-w-0 flex-col gap-2 border-t border-linha pt-4">
            <h3 className="font-medium break-words text-tinta">{funcao.nome}</h3>
            <div className="flex min-w-0 flex-wrap gap-2">
              <StatusBadge familia="info">{NOME_DA_AUTONOMIA[funcao.autonomia]}</StatusBadge>
              {funcao.altoRisco && <StatusBadge familia="info">Alto risco: tem avaliação de impacto</StatusBadge>}
              {funcao.suspensao !== null ? (
                <StatusBadge familia="pendente">{`Suspensa nesta escola desde ${formatarDataHora(funcao.suspensao.suspensaEm)}`}</StatusBadge>
              ) : (
                <StatusBadge familia="ok">Funcionando</StatusBadge>
              )}
            </div>
            {funcao.suspensao?.motivo != null && <p className="text-sm break-words text-apoio">Motivo: {NOME_DO_MOTIVO_DE_SUSPENSAO[funcao.suspensao.motivo]}</p>}
            <dl className="flex min-w-0 flex-col gap-2">
              <div className="min-w-0">
                <dt className="text-[13px] font-medium text-sutil">Faz sozinha</dt>
                <dd className="break-words text-tinta">{funcao.fazSozinha}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[13px] font-medium text-sutil">Espera aprovação</dt>
                <dd className="break-words text-tinta">{funcao.esperaAprovacao}</dd>
              </div>
            </dl>
            <div>
              {funcao.suspensao !== null ? (
                <Button variante="secundario" tamanho="compacto" data-alternar-funcao aria-label={`Retomar esta função: ${funcao.nome}`} onClick={() => aoRetomar(funcao)} disabled={retomando === funcao.chave}>
                  {retomando === funcao.chave ? 'Retomando…' : 'Retomar esta função'}
                </Button>
              ) : (
                <Button variante="perigo" tamanho="compacto" data-alternar-funcao aria-label={`Suspender esta função: ${funcao.nome}`} onClick={() => aoSuspender(funcao)}>
                  Suspender esta função
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

interface PropsDoSuspender {
  readonly alvo: FuncaoDoAgente
  readonly aoFechar: () => void
  readonly aoSuspender: (nova: FuncaoDaGovernanca) => void
  readonly focoDeReserva: () => void
}

/** A confirmação de suspender: diz o que acontece com os pedidos novos e com o que já foi feito, antes de confirmar. */
function SuspenderFuncao({ alvo, aoFechar, aoSuspender, focoDeReserva }: PropsDoSuspender) {
  const [motivo, definirMotivo] = useState('')
  const { enviar, mutacao } = useEnvioUnico({
    mutationFn: () => suspenderFuncao(alvo.funcao.chave, ehMotivo(motivo) ? motivo : undefined),
    onSuccess: aoSuspender,
  })
  return (
    <ConfirmDialog
      titulo={`Suspender a função ${alvo.funcao.nome}`}
      familia="perigo"
      resumo={[
        { rotulo: 'Função', valor: alvo.funcao.nome },
        { rotulo: 'Agente', valor: alvo.agente },
      ]}
      efeito={EFEITO_DA_SUSPENSAO[alvo.funcao.chave]}
      aviso={AVISO_DA_SUSPENSAO}
      rotuloDeConfirmar={`Suspender ${alvo.funcao.nome}`}
      rotuloConfirmando="Suspendendo…"
      aoConfirmar={() => enviar(undefined)}
      aoFechar={aoFechar}
      confirmando={mutacao.isPending}
      {...(mutacao.isError ? { falha: textoDaFalha(mutacao.error) } : {})}
      focoDeReserva={focoDeReserva}
    >
      <Select rotulo="Motivo" opcoes={OPCOES_DE_MOTIVO} valor={motivo} aoMudar={definirMotivo} marcador="Sem motivo registrado" dica="Opcional. Fica na auditoria, junto da suspensão." />
    </ConfirmDialog>
  )
}
