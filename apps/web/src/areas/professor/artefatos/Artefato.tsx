import { ErrorCode, renomearArtefatoRequestSchema, NOME_DA_FERRAMENTA, type ArtefatoResumido, type Entrega, type ArtefatoResponse } from '@educa/shared'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useSearch } from 'wouter'
import { consultaArtefato, renomearArtefato } from './api/artefatos'
import { CHAVE_DOS_ARTEFATOS } from '../../../api/chaves-do-professor'
import { ErroDaApi, mensagemDoErro } from '../../../api/client'
import { consultaEntregasDaTurma } from './api/entregas'
import { consultaTitulosDosMateriais } from './api/titulos-dos-materiais'
import { consultaMeusVinculos } from '../comum/api/vinculos'
import { caminhoDaAdaptacaoDoArtefato, caminhoDoArtefatoDoProfessor, ROTAS_DO_PROFESSOR } from '../../../paths'
import { Tabs, type TabItem } from '../../../components/ui/Tabs'
import { Button } from '../../../components/ui/Button'
import { FormField } from '../../../components/ui/fields/FormField'
import { EstadoCarregando, EstadoErro, EstadoVazio } from '../../../components/states/index'
import { AgentSignature } from '../../../components/ui/ai/AgentSignature'
import { ApprovalLine } from '../../../components/ui/ai/ApprovalLine'
import { Switch } from '../../../components/ui/fields/Switch'
import { SectionHeader, Page } from '../../../components/ui/Page'
import { formatarDataHora } from '../../../format'
import { useTituloDaTela } from '../../../document-title'
import { AplicacaoDoArtefato } from '../atividades/AplicacaoDoArtefato'
import { ConteudoDoArtefato } from './ConteudoDoArtefato'
import { aprovacaoDaEntrega, AVISO_DE_TEXTO_SEM_ALUNO, podeRenomear, saidaEmPdf, TEXTO_DA_REJEITADA_SEM_PDF, TEXTO_DO_RASCUNHO_EM_PDF, textoDaAdaptacao, VERBO_DA_ENTREGA } from './entregas'
import { ExportarPdf } from './ExportarPdf'
import { ferramentaDoCatalogo } from '../ferramentas/ferramentas'
import { Folha } from './Folha'
import { O_MIOLO_DO_DOCUMENTO, useTopoDoPainel } from './miolo-do-documento'
import { nomesDasDisciplinas, nomesDasTurmas } from '../comum/turmas-da-professora'


/** A situação da versão adaptada, com quem decidiu e quando, quando a leitura das entregas da turma a trouxe. */
function LinhaDaVersao({ versao, entregas, carregando }: { versao: Pick<ArtefatoResumido, 'entrega'>; entregas: readonly Entrega[] | undefined; carregando: boolean }) {
  if (versao.entrega === null) return null
  const completa = entregas?.find((entrega) => entrega.id === versao.entrega?.id)
  if (completa !== undefined) return <ApprovalLine aprovacao={aprovacaoDaEntrega(completa)} verbo={VERBO_DA_ENTREGA} />
  // A pendente não tem autor: a linha já pode dizer que espera a professora, sem a leitura das entregas.
  if (versao.entrega.estado === 'pendente') return <ApprovalLine aprovacao={{ estado: 'pendente' }} />
  // A decidida só é afirmada com quem decidiu (regra 70, item 6): sem a leitura, a tela diz onde ver, e não inventa.
  return <p className="text-sm text-sutil">{carregando ? 'Carregando quem decidiu…' : 'A decisão desta versão está em “O que o Assistente fez”, pelo sino.'}</p>
}

/**
 * As abas do documento (telas do professor, 6.0): **Conteúdo** sempre; **Versões adaptadas** só quando o documento já tem
 * versão; **Na turma** só na atividade objetiva, a única que vai à turma ("Aplicar à turma" é da atividade; o plano de aula
 * não tem o que aplicar). Aba que não existe para o documento não aparece e não abre.
 */
function abasDoDocumento(artefato: Pick<ArtefatoResponse, 'tipo' | 'versoesAdaptadas'>): readonly TabItem[] {
  return [
    { id: 'conteudo', rotulo: 'Conteúdo' },
    ...(artefato.versoesAdaptadas.length > 0 ? [{ id: 'versoes', rotulo: 'Versões adaptadas' }] : []),
    ...(artefato.tipo === 'atividade_objetiva' ? [{ id: 'turma', rotulo: 'Na turma' }] : []),
  ]
}

/**
 * A aba do endereço (`?aba=`). Sem o parâmetro, ou com valor que não é de nenhuma aba **deste** documento (um erro de
 * digitação, a aba das versões num documento sem versão), abre em Conteúdo: a página nunca fica sem aba nem pergunta nada.
 */
function abaDoEndereco(busca: string, abas: readonly TabItem[]): string {
  const pedida = new URLSearchParams(busca).get('aba')
  return abas.find((aba) => aba.id === pedida)?.id ?? 'conteudo'
}

/**
 * Um artefato aberto, como **documento** (telas do professor, 6.0; D80; `docs/interface.md` 11.2, tipo Documento): o voltar
 * para Criados, o título, a linha de dados e as ações no alto; embaixo, três abas guardadas no endereço (`?aba=`) — Conteúdo,
 * Versões adaptadas e Na turma — e, no Conteúdo, a **folha** de 760 px sobre a mesa, com o interruptor "Gabarito" e a página
 * de origem de cada questão (D6). Renomear, **exportar em PDF** e "Pedir versão adaptada" ficam onde estavam.
 *
 * A assinatura da IA e a situação da versão adaptada (pendente, aprovada por quem e quando, ou rejeitada com o motivo) ficam
 * **acima das abas**, à vista em todas: a decisão sobre a saída de IA não depende de qual aba está aberta (regra 70, itens 3 e
 * 6). A aba "Na turma" é a da atividade objetiva: "Aplicar à turma" é um ato à parte, com a pergunta "é avaliativa?", e nunca
 * acontece junto da aprovação da versão adaptada.
 *
 * Só o professor com vínculo confirmado na turma abre: o de outra turma, o de outra escola e o que não existe respondem
 * igual (regra 10, item 6), e a tela diz uma coisa só.
 */
export default function Artefato({ artefatoId }: { artefatoId: string }) {
  const cliente = useQueryClient()
  const [caminho, navegar] = useLocation()
  const busca = useSearch()
  const artefato = useQuery(consultaArtefato(artefatoId))
  const dados = artefato.data
  const materiais = useQuery(consultaTitulosDosMateriais)
  const vinculos = useInfiniteQuery(consultaMeusVinculos)
  const temVersao = dados !== undefined && (dados.entrega !== null || dados.versoesAdaptadas.length > 0)
  const entregas = useQuery({ ...consultaEntregasDaTurma(dados?.turmaId ?? ''), enabled: temVersao })
  const [novoTitulo, definirNovoTitulo] = useState<string | undefined>(undefined)
  // O gabarito é um modo de ver: começa ligado, como o artefato sempre foi, e é de quem está olhando (não vai ao endereço).
  const [comGabarito, definirComGabarito] = useState(true)
  const botaoDeRenomear = useRef<HTMLButtonElement>(null)
  // O formulário some com o foco dentro dele: o foco volta ao botão que o abriu, que só religa quando o render seguinte confirma
  // (o efeito abaixo), e não num quadro de animação, que pode vir antes dele.
  const focoPendente = useRef(false)
  const devolverOFoco = () => {
    focoPendente.current = true
  }
  useEffect(() => {
    if (novoTitulo !== undefined || !focoPendente.current) return
    focoPendente.current = false
    botaoDeRenomear.current?.focus()
  }, [novoTitulo])
  const topoDoPainel = useTopoDoPainel(dados !== undefined)
  const idDasVersoes = useId()
  useTituloDaTela(dados?.titulo ?? 'Artefato')

  const renomear = useMutation({
    mutationFn: (titulo: string) => renomearArtefato(artefatoId, titulo),
    onSuccess: (renomeado) => {
      cliente.setQueryData(consultaArtefato(artefatoId).queryKey, renomeado)
      void cliente.invalidateQueries({ queryKey: CHAVE_DOS_ARTEFATOS })
      definirNovoTitulo(undefined)
      devolverOFoco()
    },
  })

  const voltar = (
    // Relativo à área: o `Route` aninhado em `/professor` resolve o `to` a partir da base dela.
    <Link to={ROTAS_DO_PROFESSOR.criados} className="inline-flex min-h-11 items-center gap-2 self-start text-caramelo-texto underline">
      <ArrowLeft aria-hidden="true" size={18} />
      Voltar para Criados
    </Link>
  )

  if (dados === undefined) {
    const naoEncontrado = artefato.error instanceof ErroDaApi && artefato.error.codigo === ErrorCode.NAO_ENCONTRADO
    return (
      <Page titulo="Artefato" antes={voltar} largura="formulario">
        {artefato.isPending ? (
          <EstadoCarregando rotulo="Carregando o artefato…" />
        ) : naoEncontrado ? (
          <EstadoVazio titulo="Este artefato não está disponível" descricao="Ele pode ter sido gerado para uma turma que não é mais sua, ou o endereço está errado. O que você gerou está em Criados." />
        ) : (
          <EstadoErro erro={artefato.error} tentando={artefato.isFetching} aoTentarDeNovo={() => void artefato.refetch({ cancelRefetch: false })} />
        )}
      </Page>
    )
  }

  const itensDosVinculos = vinculos.data?.pages.flatMap((pagina) => pagina.itens) ?? []
  const turma = nomesDasTurmas(itensDosVinculos)[dados.turmaId]
  const disciplina = nomesDasDisciplinas(itensDosVinculos)[dados.disciplinaId]
  const adaptada = dados.origemId !== null
  const tipo = adaptada ? 'Versão adaptada' : NOME_DA_FERRAMENTA[dados.tipo]
  const descricao = [tipo, turma, disciplina, `gerado em ${formatarDataHora(dados.criadoEm)}`].filter((parte) => parte !== undefined).join(' · ')
  // Só a atividade objetiva que não é versão adaptada se adapta (o contrato recusa as outras).
  const podeAdaptar = dados.tipo === 'atividade_objetiva' && !adaptada
  const funcao = adaptada ? 'adaptacao' : ferramentaDoCatalogo(dados.tipo).funcao
  const abas = abasDoDocumento(dados)
  // A aba é do endereço, e não de `useState`: recarregar e voltar pelo histórico devolvem a mesma.
  const aba = abaDoEndereco(busca, abas)

  // O título é conferido pelo contrato da rota (`renomearArtefatoRequestSchema`): o limite é o dele, e não um número
  // repetido aqui.
  const tituloConferido = renomearArtefatoRequestSchema.safeParse({ titulo: novoTitulo ?? '' })
  const tituloLongo = (novoTitulo ?? '').trim() !== '' && !tituloConferido.success
  const pdf = saidaEmPdf(dados.entrega)

  function aoRenomear(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault()
    if (!tituloConferido.success || renomear.isPending) return
    renomear.mutate(tituloConferido.data.titulo)
  }

  return (
    <Page
      largura="formulario"
      titulo={dados.titulo}
      objeto
      descricao={descricao}
      antes={voltar}
    >
      {novoTitulo !== undefined && (
        <form onSubmit={aoRenomear} className="flex min-w-0 flex-col gap-3 rounded-cartao border border-linha bg-superficie p-4">
          <FormField
            rotulo="Novo título"
            dica={`${AVISO_DE_TEXTO_SEM_ALUNO} O título aparece no PDF e vai para o Assistente quando você pede a versão adaptada.`}
            erro={tituloLongo ? 'O título ficou comprido demais. Encurte e salve de novo.' : undefined}
            value={novoTitulo}
            onChange={(evento) => definirNovoTitulo(evento.target.value)}
            autoComplete="off"
            autoFocus
          />
          <p role="alert" className="rounded-controle bg-erro-cx p-3 break-words text-erro empty:hidden">
            {renomear.isError ? mensagemDoErro(renomear.error) : ''}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" variante="secundario" disabled={renomear.isPending || !tituloConferido.success}>
              {renomear.isPending ? 'Salvando…' : 'Salvar o título'}
            </Button>
            <Button
              variante="secundario"
              onClick={() => {
                definirNovoTitulo(undefined)
                renomear.reset()
                devolverOFoco()
              }}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}

      <div className="flex min-w-0 flex-col gap-2">
        {/* A assinatura e as ações na mesma linha: com as ações embaixo do título o cabeçalho passava de 370 px, e a mesa ficava com
            menos de 300 px a 1366 × 768 (RF22, `mockup.md` 10.2: a página não rola, rola a mesa). */}
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-6 gap-y-3">
          {/* Toda saída de IA leva a assinatura e o selo "IA", iguais em todo o produto. */}
          <AgentSignature funcao={funcao} />
          <div className="flex min-w-0 flex-wrap items-center gap-2">
              {/* A versão adaptada já decidida não muda de nome: a API recusaria, e a tela não oferece o que ela recusa. */}
              {podeRenomear(dados.entrega) && (
                <Button ref={botaoDeRenomear} variante="discreto" tamanho="compacto" onClick={() => definirNovoTitulo(dados.titulo)} disabled={novoTitulo !== undefined}>
                  <Pencil aria-hidden="true" size={16} strokeWidth={1.75} className="shrink-0" />
                  Renomear
                </Button>
              )}
              {/* A aprovada sai limpa; a pendente, como rascunho; a rejeitada não sai, e a tela diz por quê, logo abaixo. */}
              {pdf !== 'nao_exporta' && <ExportarPdf artefatoId={dados.id} titulo={dados.titulo} variante="secundario" rascunho={pdf === 'rascunho'} />}
              {podeAdaptar && (
                // Relativo à área, como os links: o `Route` aninhado em `/professor` resolve a partir da base dela.
                <Button onClick={() => navegar(caminhoDaAdaptacaoDoArtefato(dados.id))}>Pedir versão adaptada</Button>
              )}
          </div>
        </div>
        {dados.adaptacao !== null && (
          <p className="min-w-0 break-words text-apoio">
            <span className="font-medium text-tinta">Adaptação: </span>
            {textoDaAdaptacao(dados.adaptacao)}
          </p>
        )}
        {adaptada && (
          <div className="flex min-w-0 flex-col items-start gap-2">
            <LinhaDaVersao versao={dados} entregas={entregas.data?.itens} carregando={entregas.isPending} />
            {dados.entrega?.estado === 'pendente' && (
              <p className="min-w-0 text-sm break-words text-sutil">
                Esta versão só pode ir aos alunos depois que você aprovar.{' '}
                <Link to={ROTAS_DO_PROFESSOR.timeDoAssistente} className="text-caramelo-texto underline">
                  Ver e decidir
                </Link>
              </p>
            )}
            {pdf === 'rascunho' && <p className="min-w-0 text-sm break-words text-sutil">{TEXTO_DO_RASCUNHO_EM_PDF}</p>}
            {pdf === 'nao_exporta' && (
              <p data-sem-pdf="" className="min-w-0 text-sm break-words text-sutil">
                {TEXTO_DA_REJEITADA_SEM_PDF}
              </p>
            )}
            {dados.origemId !== null && (
              <Link to={caminhoDoArtefatoDoProfessor(dados.origemId)} className="inline-flex min-h-11 items-center text-sm text-caramelo-texto underline md:min-h-9">
                Abrir a atividade de origem
              </Link>
            )}
          </div>
        )}
      </div>

      <div ref={topoDoPainel} className="min-w-0">
        <Tabs rotulo="Seções do documento" abas={abas} ativa={aba} aoMudar={(id) => navegar(`${caminho}?aba=${id}`, { replace: true })} classeDoPainel={O_MIOLO_DO_DOCUMENTO}>
          {/* Só a aba à vista existe: a das versões e a da turma levam com elas as leituras e o que estiver aberto nelas. */}
          {aba === 'conteudo' && (
            <div className="flex min-w-0 flex-col gap-4">
              {dados.conteudo.tipo === 'atividade_objetiva' && (
                <div className="flex justify-end">
                  <label className="inline-flex min-h-11 cursor-pointer items-center gap-3">
                    <span className="t-rotulo text-tinta">Gabarito</span>
                    <Switch rotulo="Gabarito" ligado={comGabarito} aoMudar={definirComGabarito} />
                  </label>
                </div>
              )}
              <Folha rotulo={dados.titulo}>
                <ConteudoDoArtefato conteudo={dados.conteudo} materiais={materiais.data ?? {}} comGabarito={comGabarito} />
              </Folha>
            </div>
          )}
          {aba === 'versoes' && (
            <section aria-labelledby={idDasVersoes} className="flex min-w-0 flex-col gap-3">
              <SectionHeader id={idDasVersoes} titulo="Versões adaptadas" apoio="Cada uma só pode ir aos alunos depois de aprovada por você." />
              <ul className="flex min-w-0 flex-col gap-2">
                {dados.versoesAdaptadas.map((versao) => (
                  <li key={versao.id} className="flex min-w-0 flex-col items-start gap-2 rounded-cartao border-2 border-borda bg-superficie p-4">
                    <Link to={caminhoDoArtefatoDoProfessor(versao.id)} className="inline-flex min-h-11 items-center font-medium break-words text-caramelo-texto underline md:min-h-9">
                      {versao.adaptacao === null ? versao.titulo : textoDaAdaptacao(versao.adaptacao)}
                    </Link>
                    <LinhaDaVersao versao={versao} entregas={entregas.data?.itens} carregando={entregas.isPending} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {/* Aplicar à turma, a escolha "é avaliativa?", o que já foi atribuído e o encerrar (A3). */}
          {aba === 'turma' && <AplicacaoDoArtefato artefato={dados} nomeDaTurma={turma} />}
        </Tabs>
      </div>
    </Page>
  )
}
