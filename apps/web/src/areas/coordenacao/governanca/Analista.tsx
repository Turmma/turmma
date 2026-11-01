import { NOME_DO_ALERTA_DO_ANALISTA, TEXTO_DA_HIPOTESE, type ConteudoDoResumoDoAnalista } from '@educa/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { emCurso } from '../../../api/ciclo-de-execucao'
import { useExecutionLifecycle } from '../../../api/execucoes'
import { resumoDoAnalistaQueryOptions, gerarResumoDoAnalista, lugarDoResumoDoAnalista } from './api/governanca'
import { ProgressBar } from '../../../components/ui/ProgressBar'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { LoadingState, ErrorState, EmptyState } from '../../../components/states/index'
import { AgentSignature } from '../../../components/ui/ai/AgentSignature'
import { QueueAlert } from '../../../components/ui/ai/QueueAlert'
import { MEDIA_MD, useMediaQuery } from '../../../components/ui/media-query'
import { StatCard } from '../../../components/ui/StatCard'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { SectionHeader, Page } from '../../../components/ui/Page'
import { formatDate, formatDateTime, formatQuantity } from '../../../format'
import { usePageTitle } from '../../../document-title'
import { DadoNominal } from './DadoNominal'
import { O_MIOLO_SEM_ABAS_QUE_ROLA } from '../comum/miolo-que-rola'
import { acertoPercentual, AVISO_DE_HIPOTESE, falhaDoResumo, formatarPercentual, fraseDoAlerta, nomeDoRecorte } from './textos-da-governanca'

const enviarPedido = (_pedido: null, chaveEnvio: string) => gerarResumoDoAnalista(chaveEnvio)

/**
 * Analista de desempenho escolar (MVP, A5; `docs/interface.md` 3; D34, D45, D57, D64; regra 70, itens 7 a 9): o resumo
 * da escola, **sempre em agregado por série e disciplina**, e só do que os professores já aprovaram.
 *
 * - **O alerta é hipótese com contexto.** O resumo não tem texto livre: a tela monta a frase a partir do tipo, do
 *   número medido, da referência e das hipóteses de lista fechada. Nunca conclui sobre professor nem sobre aluno.
 * - **O recorte com menos de dois professores não tem número**, e a tela diz isso: o número dele seria o de uma pessoa.
 * - **"Gerar resumo"** segue o ciclo de execução das outras telas de IA: 202, consulta até terminar, e o resumo novo é
 *   lido. Função suspensa e limite de pedidos viram aviso, nunca erro cru.
 * - O dado nominal fica no fim da página, à parte, com o aviso de auditoria (`DadoNominal`; telas da coordenação, 4.0, RF9).
 * - **Não é conversa** (RF8): sem campo de texto, anexo, pergunta pronta nem relatório. O Analista em conversa é do F12.
 */
export default function Analista() {
  usePageTitle('Analista')
  // O miolo que rola recebe foco, para rolar pelo teclado, a partir de 768 px: abaixo disso rola a página, e não há o que focar.
  const comMiolo = useMediaQuery(MEDIA_MD)
  const cliente = useQueryClient()
  const resumo = useQuery(resumoDoAnalistaQueryOptions)
  const { ciclo, demorando, iniciar, repetir, limpar } = useExecutionLifecycle(lugarDoResumoDoAnalista, enviarPedido)
  const gerando = emCurso(ciclo)
  const concluiu = ciclo?.etapa === 'concluida'
  // Quando o resumo novo chega, o foco vai para ele: o botão volta a dizer "Gerar resumo", e quem usa teclado não fica perdido.
  const resumoNovo = useRef<HTMLParagraphElement>(null)
  const focarResumo = useRef(false)

  // O resumo que a execução gravou é lido de novo quando ela conclui, e o pedido sai do lugar: o botão volta.
  useEffect(() => {
    if (!concluiu) return
    focarResumo.current = true
    void cliente.invalidateQueries({ queryKey: resumoDoAnalistaQueryOptions.queryKey })
    limpar()
  }, [concluiu, cliente, limpar])

  // O foco vai para o resumo depois que ele está na tela, já com o id novo: o efeito roda depois do render que o desenhou.
  const idDoResumo = resumo.data?.resumo?.id
  useEffect(() => {
    if (!focarResumo.current || idDoResumo === undefined) return
    focarResumo.current = false
    resumoNovo.current?.focus()
  }, [idDoResumo])

  const gerar = useCallback(() => {
    limpar()
    iniciar(null)
  }, [iniciar, limpar])

  const falha = ciclo?.etapa === 'falhou' ? falhaDoResumo(ciclo.erro) : undefined
  const rotuloDeGerar = gerando ? 'Gerando o resumo…' : 'Gerar resumo'
  // Sem resumo nenhum, o botão é o do vazio, e o do alto sai: um só "Gerar resumo" na tela, e um só primário.
  const semResumo = resumo.data !== undefined && resumo.data.resumo === null
  const acoes = semResumo ? undefined : (
    // Um `primario` por tela: com o erro na tela, o "Tentar de novo" dele é o primário.
    <Button variante={resumo.isError ? 'secundario' : 'primario'} onClick={gerar} disabled={gerando}>
      {rotuloDeGerar}
    </Button>
  )

  return (
    <Page titulo="Analista" largura="leitura" acoes={acoes}>
      <section aria-label="Resumo do Analista" {...(comMiolo ? { tabIndex: 0 } : {})} className={`flex min-w-0 flex-col gap-4 ${O_MIOLO_SEM_ABAS_QUE_ROLA}`}>
        <div className="flex min-w-0 flex-col gap-3 rounded-cartao border-2 border-borda bg-superficie p-4 lg:p-5">
          <AgentSignature agente="analista_de_desempenho_escolar" tamanho={48} />
          <p className="break-words text-apoio">
            Resume o desempenho por série e disciplina, a partir do que os professores já aprovaram. Feito de dado agregado: nenhum nome de aluno ou de professor entra nele. Só avisa a coordenação: nunca contata professor nem
            família.
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-3 empty:hidden">
          <p role="status" className="text-apoio empty:hidden">
            {gerando ? 'O Analista está montando o resumo. Você pode continuar nesta tela.' : ''}
          </p>
          {gerando && demorando && <QueueAlert situacao="demora" />}
          {falha !== undefined && (falha.repetivel ? <QueueAlert situacao="falha" aoTentarDeNovo={repetir} /> : <p role="alert" className="rounded-controle border border-pendente bg-pendente-cx p-3 break-words text-pendente">{falha.texto}</p>)}
        </div>

        {resumo.isPending && <LoadingState rotulo="Carregando o resumo…" />}
        {resumo.isError && <ErrorState erro={resumo.error} tentando={resumo.isFetching} aoTentarDeNovo={() => void resumo.refetch({ cancelRefetch: false })} />}
        {resumo.data !== undefined &&
          (resumo.data.resumo === null ? (
            <EmptyState
              variante="tracejado"
              titulo="Nenhum resumo gerado ainda"
              descricao="O Analista monta o acerto por habilidade de cada série e disciplina, com os alertas. Só entra o que os professores já aprovaram, e nenhum nome de aluno ou de professor."
              acao={{ rotulo: rotuloDeGerar, aoAcionar: gerar, desligada: gerando }}
            />
          ) : (
            <Resumo geradoEm={resumo.data.resumo.geradoEm} conteudo={resumo.data.resumo.conteudo} foco={resumoNovo} />
          ))}

        <DadoNominal />
      </section>
    </Page>
  )
}

function Resumo({ geradoEm, conteudo, foco }: { readonly geradoEm: string; readonly conteudo: ConteudoDoResumoDoAnalista; readonly foco: RefObject<HTMLParagraphElement | null> }) {
  const { escola, recortes, recortesNominais, periodo } = conteudo
  // Só o tipo que a tela sabe dizer: os outros tipos do contrato não são produzidos nesta versão e não ganham frase.
  const alertas = conteudo.alertas.flatMap((alerta) => {
    const frase = fraseDoAlerta(alerta)
    return frase === null ? [] : [{ alerta, frase }]
  })
  const sinais = escola.sinais.travou + escola.sinais.resposta_pronta + escola.sinais.duvida_repetida
  return (
    <div data-resumo-do-analista className="flex min-w-0 flex-col gap-4">
      <p ref={foco} tabIndex={-1} className="text-sm text-sutil">
        Resumo gerado em {formatDateTime(geradoEm)} · de {formatDate(periodo.inicio)} a {formatDate(periodo.fim)}
      </p>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard rotulo="Atividades aplicadas" valor={escola.atividadesAplicadas} />
        <StatCard rotulo="Correções aprovadas" valor={escola.lotesAprovados} apoio={`${formatQuantity(escola.lotesEsperando, 'esperando', 'esperando')} o professor`} />
        <StatCard rotulo="Trocas com o Tutor" valor={escola.trocasComOTutor} apoio={`${formatQuantity(sinais, 'aviso', 'avisos')} aos professores`} />
        <StatCard rotulo="Versões adaptadas aprovadas" valor={escola.versoesAdaptadasAprovadas} />
      </div>

      <section className="flex min-w-0 flex-col gap-3" aria-labelledby="titulo-alertas">
        <SectionHeader id="titulo-alertas" titulo="Alertas" apoio={AVISO_DE_HIPOTESE} />
        {alertas.length === 0 ? (
          <EmptyState titulo="Nenhum alerta neste resumo" descricao="O Analista avisa quando o acerto de uma habilidade, numa série e disciplina com correção aprovada de dois ou mais professores, fica abaixo do limite provisório desta versão." />
        ) : (
          <ul className="flex min-w-0 flex-col gap-3">
            {alertas.map(({ alerta, frase }) => (
              <li key={`${alerta.serie.id}:${alerta.disciplina.id}:${alerta.habilidade?.codigo ?? ''}`} data-alerta={alerta.tipo} className="flex min-w-0 flex-col gap-2 rounded-cartao border-2 border-borda bg-superficie p-4 lg:p-5">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h3 className="min-w-0 font-medium break-words text-tinta">{NOME_DO_ALERTA_DO_ANALISTA[alerta.tipo]}</h3>
                  {/* O alerta é hipótese, e o selo diz isso em texto: a cor sozinha não diz (regra 50, item 11). */}
                  <StatusBadge familia="info">Hipótese</StatusBadge>
                </div>
                <p className="max-w-prose break-words text-tinta">{frase}</p>
                <div className="min-w-0 rounded-controle bg-info-cx p-3 text-info">
                  <p className="font-medium">Hipóteses a conferir</p>
                  <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
                    {alerta.hipoteses.map((hipotese) => (
                      <li key={hipotese} className="break-words">
                        {TEXTO_DA_HIPOTESE[hipotese]}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex min-w-0 flex-col gap-3" aria-labelledby="titulo-recortes">
        <SectionHeader id="titulo-recortes" titulo="Acerto por série e disciplina" apoio="Só das correções que os professores aprovaram. Um recorte só tem número quando dois ou mais professores aprovaram correção nele." />
        {recortes.length === 0 && recortesNominais.length === 0 && (
          <EmptyState titulo="Ainda não há correção aprovada" descricao="Quando um professor aprovar a correção de uma atividade objetiva, o acerto por habilidade da série e da disciplina aparece aqui no próximo resumo." />
        )}
        {recortes.map((recorte) => (
          <Card key={`${recorte.serie.id}:${recorte.disciplina.id}`} titulo={nomeDoRecorte(recorte)} nivel={3}>
            <p className="text-sm break-words text-sutil">
              {formatQuantity(recorte.alunos, 'aluno', 'alunos')} · {formatQuantity(recorte.lotesAprovados, 'correção aprovada', 'correções aprovadas')} · acerto de{' '}
              {formatarPercentual(recorte.acertoPercentual)}
            </p>
            <div className="mt-3 flex min-w-0 flex-col gap-3">
              {recorte.porHabilidade.map((medida) => (
                <ProgressBar
                  key={medida.habilidade.codigo}
                  rotulo={medida.habilidade.descricao}
                  valor={acertoPercentual(medida.acertos, medida.total)}
                  texto={`${formatarPercentual(acertoPercentual(medida.acertos, medida.total))} · ${String(medida.acertos)} de ${String(medida.total)}`}
                  detalhe={medida.habilidade.codigo}
                />
              ))}
            </div>
          </Card>
        ))}
        {recortesNominais.length > 0 && (
          <Card titulo="Recortes sem número" nivel={3}>
            <p className="break-words text-apoio">Estes recortes têm correção aprovada, mas de menos de dois professores. O número deles seria o resultado de um professor só, e por isso não aparece no agregado.</p>
            <ul className="mt-3 flex min-w-0 flex-col gap-2">
              {recortesNominais.map((recorte) => (
                <li key={`${recorte.serie.id}:${recorte.disciplina.id}`} data-recorte-nominal className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 break-words text-tinta">{nomeDoRecorte(recorte)}</span>
                  <StatusBadge familia="info">Menos de dois professores com correção aprovada: conta como nominal</StatusBadge>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  )
}
