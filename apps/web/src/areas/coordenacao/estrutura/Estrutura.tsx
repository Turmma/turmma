import {
  ErrorCode,
  nomeDaSerie,
  TAMANHO_MAXIMO_NOME_DISCIPLINA,
  TAMANHO_MAXIMO_NOME_TURMA,
  TURNOS,
  type AnoLetivo,
  type Serie,
  type Turma,
  type Turno,
  type VinculoDaCoordenacao,
} from '@educa/shared'
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { Ellipsis } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation, useSearch } from 'wouter'
import {
  ESTRUTURA_QUERY_KEY,
  anosLetivosQueryOptions,
  disciplinasQueryOptions,
  seriesQueryOptions,
  turmasQueryOptions,
  vinculosQueryOptions,
  criarTurma,
  excluirDisciplina,
  excluirTurma,
  type ListaDaEstrutura,
  renomearDisciplina,
  renomearTurma,
} from '../../../api/estrutura'
import { professoresQueryOptions } from '../professores/api/professores'
import { caminhoDaTurmaNaEstrutura } from '../../../paths'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { SECONDARY_BUTTON_CLASSES } from '../../../components/ui/button-variants'
import { FormField } from '../../../components/ui/fields/FormField'
import { useDialogState } from '../../../components/ui/overlays/dialog-state'
import { DangerConfirmDialog, FormDialog, useSingleSubmit } from '../../../components/dialogs'
import { LoadingState, ErrorState, EmptyState } from '../../../components/states/index'
import { Menu } from '../../../components/ui/overlays/Menu'
import { SELECT_CLASSES } from '../../../components/ui/fields/field-styles'
import { SegmentedControl } from '../../../components/ui/fields/SegmentedControl'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { Table, type TableColumn } from '../../../components/ui/Table'
import { listChanged, errorText } from '../../../components/error-text'
import {
  PainelDoAnoEDisciplinas,
  NovaDisciplina,
  NovaSerie,
  NovoAnoLetivo,
  Secao,
  depoisDeCriar,
  type AlvoDoDialogo,
  type PropsDeCriar,
  type SecaoDaTela,
  type TipoDeDialogoDoPainel,
} from './AnoEDisciplinas'
import { enderecoComParametro } from '../comum/endereco-da-tela'
import { textoDaListaCurta } from './lista-curta'
import { NOME_DO_TURNO } from './nome-do-turno'
import { oQueFaltaDaEscola, passosDoRoteiro } from './o-que-falta-da-escola'
import { PainelDoQueFalta, Roteiro } from './OQueFalta'
import { ordenarSeries } from '../comum/ordem'
import { AvisoDeListaIncompleta } from '../comum/pecas-da-lista'
import { professorAlocavel } from '../professores/professores-da-escola'
import {
  agruparPorSerie,
  NOME_NAO_CARREGADO,
  painelDoEndereco,
  situacaoDoEndereco,
  turmasDaTabela,
  type PainelDaEstrutura,
  type SituacaoDasTurmas,
  type TurmaDaTabela,
} from './turmas-da-escola'

/** Os diálogos da tela, um por vez. Os de renomear e excluir levam o item da linha, fotografado na abertura. */
type TipoDeDialogo = TipoDeDialogoDoPainel | 'turma' | 'renomear_turma' | 'excluir_turma'

/**
 * O link da primeira célula da linha: ele se estende por ela toda (`after:inset-0`, sobre o `relative` da linha da `Table`), e o
 * anel do foco do teclado é desenhado por dentro dela, e não só em volta do nome.
 */
const CLASSES_DO_LINK_DA_LINHA =
  "inline-flex min-h-11 max-w-full min-w-0 items-center font-semibold wrap-anywhere text-tinta after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-none focus-visible:after:rounded-linha focus-visible:after:outline-3 focus-visible:after:-outline-offset-3 focus-visible:after:outline-foco"

const ITENS_DO_MENU_DA_TURMA = [
  { id: 'renomear', rotulo: 'Renomear' },
  { id: 'excluir', rotulo: 'Excluir', perigo: true },
] as const

function colunasDasTurmas(aoEscolher: (turma: Turma, acao: 'renomear' | 'excluir') => void): readonly [TableColumn<TurmaDaTabela>, ...TableColumn<TurmaDaTabela>[]] {
  return [
    {
      chave: 'turma',
      titulo: 'Turma',
      celula: ({ turma }) => (
        // O nome acessível leva o que o link faz; o texto à vista é só o nome da turma, que continua dentro dele (WCAG 2.5.3).
        <Link to={caminhoDaTurmaNaEstrutura(turma.id)} aria-label={`Lista de nomes da turma ${turma.nome}`} className={CLASSES_DO_LINK_DA_LINHA}>
          {turma.nome}
        </Link>
      ),
    },
    {
      chave: 'turno',
      titulo: 'Turno',
      celula: ({ turma }) => (turma.turno === null ? '—' : <span className="capitalize">{NOME_DO_TURNO[turma.turno]}</span>),
    },
    {
      chave: 'professores',
      titulo: 'Professores',
      celula: ({ professores }) => textoDaListaCurta(professores),
    },
    {
      chave: 'situacao',
      titulo: 'Situação',
      celula: ({ semProfessor }) =>
        semProfessor === undefined ? '—' : semProfessor ? <StatusBadge familia="pendente">Sem professor</StatusBadge> : <StatusBadge familia="ok">Com professor</StatusBadge>,
    },
    {
      chave: 'acoes',
      titulo: 'Ações',
      alinhamento: 'fim',
      celula: ({ turma }) => (
        <span className="relative inline-flex">
          <Menu
            rotulo={`Mais ações da turma ${turma.nome}`}
            icone={Ellipsis}
            soIcone
            variante="discreto"
            alinhamento="fim"
            itens={ITENS_DO_MENU_DA_TURMA}
            aoEscolher={(id) => aoEscolher(turma, id === 'excluir' ? 'excluir' : 'renomear')}
          />
        </span>
      ),
    },
  ]
}

/**
 * Escola › Turmas (X2, 5.0; RF11, RF12 e RF22; Tech Spec seções 5 e 9): as turmas do ano em tabela, por série, com a linha
 * inteira abrindo a lista da turma. O ano letivo, as séries e as disciplinas ficam num painel ao lado (`?painel=ano`), e "O
 * que falta para a escola começar" noutro (`?painel=falta`); o filtro "Situação" é `?situacao=sem-professor`. A alocação não
 * mora mais aqui: é o "Acrescentar turma" do painel do professor, em Professores (7.0). Tudo o que a Estrutura fazia continua: as
 * escritas, os diálogos, os anúncios e o foco de cada ação.
 *
 * - **Quatro estados** (RF22): carregando; erro com "Tentar de novo"; vazio, que é a escola sem ano letivo (o roteiro e o botão
 *   do primeiro passo) ou o ano sem turma; e com dado. Cada seção tem o seu carregando e o seu erro, e a tela continua em pé
 *   quando uma delas falha. "Falta" só se diz do que já foi lido.
 * - **Nenhuma leitura auditada** (regra 20, item 10): a tela não chama a lista de nomes, e por isso a tabela não tem contagem de
 *   nomes nem "sem lista". Os professores da linha vêm dos vínculos que a escola criou, e nada ali é uso nem desempenho (D45, D64).
 * - **O que a API decide, a tela não refaz**: "5º ano" nem aparece na escolha de série, mas quem recusa é a API (E1). As
 *   escritas passam por diálogos, um por vez; cada abertura nasce vazia.
 * - **O que abre por cima fica no endereço**, só com valor de lista fechada, e fecha tirando o parâmetro com `replace`. Valor
 *   desconhecido é ignorado, e como o painel só desenha depois da leitura dos anos, ele nunca mostra a escola anterior.
 */
export default function Estrutura() {
  const cliente = useQueryClient()
  const [caminho, navegar] = useLocation()
  const busca = useSearch()
  const painel = painelDoEndereco(busca)
  const situacao = situacaoDoEndereco(busca)
  const anos = useQuery(anosLetivosQueryOptions)
  const anoEmCurso = anos.data?.itens.find((ano) => ano.situacao === 'em_curso')
  const series = useQuery(seriesQueryOptions)
  const disciplinas = useQuery(disciplinasQueryOptions)
  // Turmas e vínculos são do ano em curso: sem ele a API responde como inexistente, e a tela nem pergunta.
  const turmas = useQuery({
    ...turmasQueryOptions,
    enabled: anoEmCurso !== undefined,
  })
  const professores = useQuery(professoresQueryOptions)
  const vinculos = useQuery({
    ...vinculosQueryOptions,
    enabled: anoEmCurso !== undefined,
  })
  const dialogo = useDialogState<TipoDeDialogo, AlvoDoDialogo>()
  const aberta = dialogo.aberta
  // O item da linha, fotografado na abertura: os diálogos de renomear e de excluir só existem com ele.
  const alvo = aberta?.alvo
  const [anuncio, definirAnuncio] = useState<{ secao: SecaoDaTela; texto: string } | undefined>(undefined)
  const anunciar = (secao: SecaoDaTela, texto: string) => definirAnuncio(texto === '' ? undefined : { secao, texto })
  const anuncioDa = (secao: SecaoDaTela) => (anuncio?.secao === secao ? anuncio.texto : '')
  const tituloDoAno = useRef<HTMLHeadingElement>(null)
  const tituloDasSeries = useRef<HTMLHeadingElement>(null)
  const tituloDasDisciplinas = useRef<HTMLHeadingElement>(null)
  const tituloDasTurmas = useRef<HTMLHeadingElement>(null)

  const recarregar = useCallback(() => cliente.invalidateQueries({ queryKey: ESTRUTURA_QUERY_KEY }), [cliente])

  /** Abrir um diálogo apaga o anúncio da ação anterior: o que ele dizia já não é o que a pessoa está fazendo. */
  function abrir(tipo: TipoDeDialogo, item?: AlvoDoDialogo): void {
    definirAnuncio(undefined)
    dialogo.abrir(tipo, item)
  }

  /** Abre ou fecha o que está por cima da tela. Abrir é um passo no histórico; fechar e filtrar trocam o endereço, sem passo novo. */
  const abrirPainel = (qual: PainelDaEstrutura): void => navegar(enderecoComParametro(caminho, busca, 'painel', qual))
  const fecharPainel = (): void =>
    navegar(enderecoComParametro(caminho, busca, 'painel', undefined), {
      replace: true,
    })
  const filtrarPor = (nova: SituacaoDasTurmas): void => navegar(enderecoComParametro(caminho, busca, 'situacao', nova === 'todas' ? undefined : nova), { replace: true })
  /** O foco de quem abriu o painel e saiu da página (o aviso que some com o último passo): o título das turmas. */
  const focoNoTituloDasTurmas = (): void => tituloDasTurmas.current?.focus()
  // A página aberta já com o painel (pelo endereço, ou o Voltar do histórico) não tem botão que o tenha aberto: o foco devolvido a "quem abriu" cai no
  // `body`. Quando o painel fecha e o foco está no `body`, ele vai ao título das turmas, e não se perde.
  const painelAnterior = useRef(painel)
  useEffect(() => {
    if (painelAnterior.current !== undefined && painel === undefined && document.activeElement === document.body) tituloDasTurmas.current?.focus()
    painelAnterior.current = painel
  }, [painel])

  if (anos.isPending) return <LoadingState rotulo="Carregando a estrutura da escola…" />

  if (anos.isError) return <ErrorState erro={anos.error} tentando={anos.isFetching} aoTentarDeNovo={() => void anos.refetch({ cancelRefetch: false })} />

  const alocaveis = professores.data?.itens.filter((professor) => professorAlocavel(professor.estado))
  // Turmas e vínculos são do ano em curso: sem ele não há leitura a esperar, e o passo falta de fato.
  const passos = passosDoRoteiro(
    anos.data.itens.length === 0
      ? undefined
      : {
          anoEmCurso: anoEmCurso !== undefined,
          series: series.data?.itens.length,
          disciplinas: disciplinas.data?.itens.length,
          turmas: anoEmCurso === undefined ? 0 : turmas.data?.itens.length,
          professores: alocaveis?.length,
          vinculos: anoEmCurso === undefined ? 0 : vinculos.data?.itens.length,
        },
  )
  const { faltam } = oQueFaltaDaEscola(passos)
  const semAno = anos.data.itens.length === 0

  return (
    <section className="flex min-w-0 flex-col gap-8">
      {semAno ? (
        <>
          <EmptyState
            titulo="Comece pelo ano letivo"
            descricao="A escola se monta nesta ordem, e cada passo abre o seguinte. As turmas nascem no ano letivo em curso."
            acao={{
              rotulo: 'Criar o ano letivo',
              aoAcionar: () => abrir('ano'),
            }}
          />
          <Roteiro titulo="O roteiro até a alocação" passos={passos} />
        </>
      ) : (
        <>
          {faltam.length > 0 && (
            <Alert
              tom="info"
              titulo="Para terminar a escola"
              acao={
                <button type="button" onClick={() => abrirPainel('falta')} className={SECONDARY_BUTTON_CLASSES}>
                  Ver o que falta
                </button>
              }
            >
              Falta: {faltam.map((passo) => passo.titulo).join(', ')}.
            </Alert>
          )}

          <Secao
            titulo={anoEmCurso === undefined ? 'Turmas' : `Turmas de ${String(anoEmCurso.ano)}`}
            tituloRef={tituloDasTurmas}
            anuncio={anuncioDa('turmas')}
            acao={
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => abrirPainel('ano')} className={SECONDARY_BUTTON_CLASSES}>
                  Ano letivo e disciplinas
                </button>
                {anoEmCurso !== undefined && <Button onClick={() => abrir('turma')}>Nova turma</Button>}
              </div>
            }
          >
            {anoEmCurso === undefined ? (
              <p className="text-apoio">As turmas nascem no ano letivo em curso. Abra o ano letivo acima para criar as turmas.</p>
            ) : turmas.isPending ? (
              <LoadingState rotulo="Carregando as turmas…" />
            ) : turmas.isError ? (
              <ErrorState erro={turmas.error} tentando={turmas.isFetching} aoTentarDeNovo={() => void turmas.refetch({ cancelRefetch: false })} />
            ) : turmas.data.itens.length === 0 ? (
              <EmptyState titulo="Nenhuma turma ainda" descricao="Crie cada turma numa série; depois abra a turma para subir a lista de nomes." />
            ) : (
              <TurmasDoAno
                turmas={turmas.data}
                vinculos={vinculos}
                nomes={new Map((professores.data?.itens ?? []).map((professor) => [professor.usuarioId, professor.nome]))}
                situacao={situacao}
                aoFiltrar={filtrarPor}
                aoEscolher={(turma, acao) => abrir(acao === 'excluir' ? 'excluir_turma' : 'renomear_turma', turma)}
              />
            )}
          </Secao>

          {painel === 'ano' && (
            <PainelDoAnoEDisciplinas
              anos={anos.data.itens}
              series={series}
              disciplinas={disciplinas}
              anuncioDa={anuncioDa}
              aoAnunciar={anunciar}
              aoAbrir={abrir}
              recarregar={recarregar}
              tituloDoAno={tituloDoAno}
              tituloDasSeries={tituloDasSeries}
              tituloDasDisciplinas={tituloDasDisciplinas}
              aoFechar={fecharPainel}
              focoDeReserva={focoNoTituloDasTurmas}
            />
          )}
          {painel === 'falta' && <PainelDoQueFalta passos={passos} aoFechar={fecharPainel} focoDeReserva={focoNoTituloDasTurmas} />}
        </>
      )}

      {aberta?.tipo === 'ano' && (
        <NovoAnoLetivo
          key={aberta.numero}
          aoFechar={dialogo.fechar}
          aoCriar={(ano) => {
            anunciar('ano', `Ano letivo ${String(ano.ano)} criado. Abra o ano para criar as turmas.`)
            dialogo.fecharSeAinda(aberta)
            // O ano criado a partir do vazio (a escola sem nenhum) leva ao painel dele: é nele que o ano se abre e que o anúncio mora.
            if (painel !== 'ano') abrirPainel('ano')
          }}
          recarregar={recarregar}
          // O "Criar o ano letivo" do vazio sai da tela quando o primeiro ano chega: o foco vai para a seção do ano.
          focoDeReserva={() => tituloDoAno.current?.focus()}
        />
      )}
      {aberta?.tipo === 'serie' && (
        <NovaSerie
          key={aberta.numero}
          existentes={series.data?.itens ?? []}
          aoFechar={dialogo.fechar}
          aoCriar={(serie) => {
            anunciar('series', `${nomeDaSerie(serie)} criado.`)
            dialogo.fecharSeAinda(aberta)
          }}
          recarregar={recarregar}
        />
      )}
      {aberta?.tipo === 'disciplina' && (
        <NovaDisciplina
          key={aberta.numero}
          aoFechar={dialogo.fechar}
          aoCriar={(disciplina) => {
            anunciar('disciplinas', `Disciplina ${disciplina.nome} criada.`)
            dialogo.fecharSeAinda(aberta)
          }}
          recarregar={recarregar}
        />
      )}
      {aberta?.tipo === 'turma' && anoEmCurso !== undefined && (
        <NovaTurma
          key={aberta.numero}
          anoLetivo={anoEmCurso}
          series={series.data?.itens ?? []}
          aoFechar={dialogo.fechar}
          aoCriar={(turma) => {
            anunciar('turmas', `Turma ${turma.nome} criada. Abra a turma para subir a lista de nomes.`)
            dialogo.fecharSeAinda(aberta)
          }}
          recarregar={recarregar}
        />
      )}
      {aberta?.tipo === 'renomear_disciplina' && alvo !== undefined && (
        <Renomear
          key={aberta.numero}
          titulo="Renomear a disciplina"
          rotulo="Nome da disciplina"
          atual={alvo.nome}
          maximo={TAMANHO_MAXIMO_NOME_DISCIPLINA}
          renomear={(nome) => renomearDisciplina(alvo.id, nome)}
          conflito="Já existe uma disciplina com este nome na escola. Escolha outro."
          aoFechar={dialogo.fechar}
          aoRenomear={(nome) => {
            anunciar('disciplinas', `Disciplina renomeada para ${nome}.`)
            dialogo.fecharSeAinda(aberta)
          }}
          recarregar={recarregar}
          focoDeReserva={() => tituloDasDisciplinas.current?.focus()}
        />
      )}
      {aberta?.tipo === 'renomear_turma' && alvo !== undefined && (
        <Renomear
          key={aberta.numero}
          titulo="Renomear a turma"
          rotulo="Nome da turma"
          atual={alvo.nome}
          maximo={TAMANHO_MAXIMO_NOME_TURMA}
          renomear={(nome) => renomearTurma(alvo.id, nome)}
          conflito="Já existe uma turma com este nome neste ano letivo. Escolha outro."
          aoFechar={dialogo.fechar}
          aoRenomear={(nome) => {
            anunciar('turmas', `Turma renomeada para ${nome}.`)
            dialogo.fecharSeAinda(aberta)
          }}
          recarregar={recarregar}
          focoDeReserva={() => tituloDasTurmas.current?.focus()}
        />
      )}
      {aberta?.tipo === 'excluir_disciplina' && alvo !== undefined && (
        <DangerConfirmDialog
          key={aberta.numero}
          titulo="Excluir a disciplina"
          texto={
            <>
              A disciplina <span className="font-medium text-tinta">{alvo.nome}</span> sai da escola. Só sai a disciplina sem professor alocado nela, nem em alocação já encerrada.
            </>
          }
          rotuloDaAcao="Excluir disciplina"
          rotuloEmAndamento="Excluindo…"
          acao={() => excluirDisciplina(alvo.id)}
          aoFechar={dialogo.fechar}
          aoConcluir={() => {
            anunciar('disciplinas', `Disciplina ${alvo.nome} excluída.`)
            dialogo.fecharSeAinda(aberta)
          }}
          aoTerminar={recarregar}
          textosDaFalha={{
            [ErrorCode.CONFLITO]: 'Esta disciplina não pode sair: há professor alocado nela, também em alocação já encerrada. A lista foi atualizada.',
            [ErrorCode.NAO_ENCONTRADO]: 'Esta disciplina já não existe. A lista foi atualizada.',
          }}
          focoDeReserva={() => tituloDasDisciplinas.current?.focus()}
        />
      )}
      {aberta?.tipo === 'excluir_turma' && alvo !== undefined && (
        <DangerConfirmDialog
          key={aberta.numero}
          titulo="Excluir a turma"
          texto={
            <>
              A turma <span className="font-medium text-tinta">{alvo.nome}</span> sai do ano letivo. Só sai a turma vazia: sem nomes na lista, sem professor alocado (também em
              alocação encerrada), sem pedido de aluno e sem acesso da turma em vigor.
            </>
          }
          rotuloDaAcao="Excluir turma"
          rotuloEmAndamento="Excluindo…"
          acao={() => excluirTurma(alvo.id)}
          aoFechar={dialogo.fechar}
          aoConcluir={() => {
            anunciar('turmas', `Turma ${alvo.nome} excluída.`)
            dialogo.fecharSeAinda(aberta)
          }}
          aoTerminar={recarregar}
          textosDaFalha={{
            [ErrorCode.CONFLITO]:
              'Esta turma não pode sair: ela ainda tem nomes na lista, professor alocado, pedido de aluno ou acesso da turma em vigor. Os nomes livres saem pela lista de nomes da turma; a alocação, o pedido e o acesso não se desfazem por esta tela. A lista foi atualizada.',
            [ErrorCode.NAO_ENCONTRADO]: 'Esta turma já não existe. A lista foi atualizada.',
          }}
          focoDeReserva={() => tituloDasTurmas.current?.focus()}
        />
      )}
    </section>
  )
}

interface PropsDasTurmasDoAno {
  readonly turmas: ListaDaEstrutura<Turma>
  readonly vinculos: UseQueryResult<ListaDaEstrutura<VinculoDaCoordenacao>>
  /** O nome de cada professor, pelo id do usuário, da lista de professores da escola. */
  readonly nomes: ReadonlyMap<string, string>
  readonly situacao: SituacaoDasTurmas
  readonly aoFiltrar: (situacao: SituacaoDasTurmas) => void
  readonly aoEscolher: (turma: Turma, acao: 'renomear' | 'excluir') => void
}

/**
 * O filtro "Situação" e a tabela de cada série. A marca "Sem professor" e o filtro saem da mesma conta do sino
 * (`turmasSemProfessor`), e só quando os vínculos vieram **inteiros**: sem eles a tela não afirma que a turma está sem professor,
 * e o filtro diz isso em vez de mostrar uma lista que pode estar errada.
 */
function TurmasDoAno({ turmas, vinculos, nomes, situacao, aoFiltrar, aoEscolher }: PropsDasTurmasDoAno) {
  const linhas = turmasDaTabela(turmas.itens, vinculos.data, (usuarioId) => nomes.get(usuarioId) ?? NOME_NAO_CARREGADO)
  const filtrando = situacao === 'sem-professor'
  const exibidas = filtrando ? linhas.filter((linha) => linha.semProfessor === true) : linhas
  const colunas = colunasDasTurmas(aoEscolher)

  let corpo
  if (filtrando && vinculos.data === undefined) {
    corpo = vinculos.isError ? (
      <ErrorState erro={vinculos.error} tentando={vinculos.isFetching} aoTentarDeNovo={() => void vinculos.refetch({ cancelRefetch: false })} />
    ) : (
      <LoadingState rotulo="Carregando os professores das turmas…" />
    )
  } else if (filtrando && vinculos.data?.completa === false) {
    corpo = <Alert tom="atencao">A escola tem mais vínculos do que esta tela lê, e por isso ela não diz quais turmas estão sem professor.</Alert>
  } else if (exibidas.length === 0) {
    corpo = <EmptyState titulo="Nenhuma turma sem professor" descricao="Toda turma do ano tem professor alocado, esperando a confirmação ou já confirmado." />
  } else {
    corpo = (
      <div className="flex min-w-0 flex-col gap-6">
        {agruparPorSerie(exibidas).map((grupo) => (
          <div key={grupo.serie.id} className="flex min-w-0 flex-col gap-2">
            <h3 className="t-cartao text-tinta">{nomeDaSerie(grupo.serie)}</h3>
            <Table rotulo={`Turmas do ${nomeDaSerie(grupo.serie)}`} colunas={colunas} linhas={grupo.turmas} chaveDaLinha={(linha) => linha.turma.id} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="max-w-sm">
        <SegmentedControl
          rotulo="Situação"
          rotuloVisivel
          opcoes={[
            { valor: 'todas', rotulo: 'Todas' },
            { valor: 'sem-professor', rotulo: 'Sem professor' },
          ]}
          valor={situacao}
          aoMudar={aoFiltrar}
        />
      </div>
      {!filtrando && vinculos.data === undefined && vinculos.isError && (
        <Alert
          tom="atencao"
          acao={
            <Button variante="secundario" disabled={vinculos.isFetching} onClick={() => void vinculos.refetch({ cancelRefetch: false })}>
              {vinculos.isFetching ? 'Tentando de novo…' : 'Tentar de novo'}
            </Button>
          }
        >
          Os professores das turmas não carregaram
        </Alert>
      )}
      {corpo}
      <AvisoDeListaIncompleta completa={turmas.completa} />
    </>
  )
}

function NovaTurma({ anoLetivo, series, aoFechar, aoCriar, recarregar }: PropsDeCriar<Turma> & { anoLetivo: AnoLetivo; series: readonly Serie[] }) {
  const ordenadas = ordenarSeries(series)
  const [serieId, definirSerieId] = useState(() => ordenadas[0]?.id ?? '')
  // A série escolhida só vale enquanto está na lista: a que outra pessoa excluiu com o diálogo aberto sai da escolha
  // quando a lista recarrega, e o envio seguinte manda a série que a tela mostra, e não a que a API acabou de recusar.
  const serieEscolhida = ordenadas.some((serie) => serie.id === serieId) ? serieId : (ordenadas[0]?.id ?? '')
  const [nome, definirNome] = useState('')
  const [turno, definirTurno] = useState<Turno | ''>('')
  const [erroDoNome, definirErroDoNome] = useState<string | undefined>(undefined)
  const campoDaSerie = useId()
  const campoDoTurno = useId()
  const campoDoNome = useRef<HTMLInputElement>(null)
  const { enviar, mutacao } = useSingleSubmit({
    mutationFn: criarTurma,
    ...depoisDeCriar(aoCriar, recarregar),
  })

  function aoEnviar(): void {
    const limpo = nome.trim()
    definirErroDoNome(limpo === '' ? 'Digite o nome da turma, como 7ºA.' : undefined)
    if (limpo === '') campoDoNome.current?.focus()
    if (limpo === '' || serieEscolhida === '') return
    // O ano vai só para conferir: se ele deixou de estar em curso, a API responde como inexistente, em vez de a turma
    // cair calada noutro ano.
    enviar({
      serieId: serieEscolhida,
      nome: limpo,
      anoLetivoId: anoLetivo.id,
      ...(turno === '' ? {} : { turno }),
    })
  }

  const falha = mutacao.isError
    ? errorText(mutacao.error, {
        [ErrorCode.CONFLITO]: 'Já existe uma turma com este nome neste ano letivo.',
        [ErrorCode.NAO_ENCONTRADO]: 'A série ou o ano letivo mudou enquanto você preenchia. A tela foi atualizada: confira e tente de novo.',
      })
    : undefined

  return (
    <FormDialog
      titulo={`Nova turma em ${String(anoLetivo.ano)}`}
      aoFechar={aoFechar}
      aoEnviar={aoEnviar}
      enviando={mutacao.isPending}
      rotuloDoEnvio="Criar turma"
      rotuloEnviando="Criando…"
      semNovaTentativa={ordenadas.length === 0}
      falha={falha}
    >
      {ordenadas.length === 0 ? (
        <p className="text-apoio">Crie a série primeiro: toda turma pertence a uma série.</p>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <label htmlFor={campoDaSerie} className="font-medium">
              Série
            </label>
            <select id={campoDaSerie} value={serieEscolhida} onChange={(evento) => definirSerieId(evento.target.value)} className={SELECT_CLASSES}>
              {ordenadas.map((serie) => (
                <option key={serie.id} value={serie.id}>
                  {nomeDaSerie(serie)}
                </option>
              ))}
            </select>
          </div>
          <FormField
            ref={campoDoNome}
            rotulo="Nome da turma"
            dica="Como a escola chama: 7ºA, 2ºB."
            name="nome"
            autoComplete="off"
            maxLength={TAMANHO_MAXIMO_NOME_TURMA}
            value={nome}
            onChange={(evento) => definirNome(evento.target.value)}
            erro={erroDoNome}
          />
          <div className="flex flex-col gap-1">
            <label htmlFor={campoDoTurno} className="font-medium">
              Turno (opcional)
            </label>
            <select
              id={campoDoTurno}
              value={turno}
              onChange={(evento) => definirTurno(evento.target.value === '' ? '' : (TURNOS.find((opcao) => opcao === evento.target.value) ?? ''))}
              className={SELECT_CLASSES}
            >
              <option value="">Sem turno</option>
              {TURNOS.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {NOME_DO_TURNO[opcao]}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
    </FormDialog>
  )
}

interface PropsDeRenomear {
  readonly titulo: string
  readonly rotulo: string
  readonly atual: string
  readonly maximo: number
  readonly renomear: (nome: string) => Promise<unknown>
  /** O texto do `CONFLITO`: o nome já é de outro item. Ele fica no campo, com o foco nele, para a pessoa trocar. */
  readonly conflito: string
  readonly aoFechar: () => void
  readonly aoRenomear: (nome: string) => void
  readonly recarregar: () => unknown
  readonly focoDeReserva: () => void
}

function Renomear({ titulo, rotulo, atual, maximo, renomear, conflito, aoFechar, aoRenomear, recarregar, focoDeReserva }: PropsDeRenomear) {
  const [nome, definirNome] = useState(atual)
  const [erroDoNome, definirErroDoNome] = useState<string | undefined>(undefined)
  const campo = useRef<HTMLInputElement>(null)
  const { enviar, mutacao } = useSingleSubmit({
    mutationFn: renomear,
    onSuccess: async (_resposta, enviado: string) => {
      await recarregar()
      aoRenomear(enviado)
    },
    onError: recarregar,
  })
  const conflitou = mutacao.isError && listChanged(mutacao.error, [ErrorCode.CONFLITO])
  const sumiu = mutacao.isError && listChanged(mutacao.error, [ErrorCode.NAO_ENCONTRADO])
  // O nome já é de outro item: o erro fica no campo, e o foco volta para ele, para a pessoa trocar o nome ali mesmo.
  useEffect(() => {
    if (conflitou) campo.current?.focus()
  }, [conflitou, mutacao.submittedAt])

  function aoEnviar(): void {
    const limpo = nome.trim()
    if (limpo === '') {
      definirErroDoNome('Digite o nome novo.')
      campo.current?.focus()
      return
    }
    definirErroDoNome(undefined)
    enviar(limpo)
  }

  return (
    <FormDialog
      titulo={titulo}
      aoFechar={aoFechar}
      aoEnviar={aoEnviar}
      enviando={mutacao.isPending}
      rotuloDoEnvio="Salvar nome"
      rotuloEnviando="Salvando…"
      semNovaTentativa={sumiu}
      falha={
        mutacao.isError && !conflitou
          ? errorText(mutacao.error, {
              [ErrorCode.NAO_ENCONTRADO]: 'Este item já não existe. A lista foi atualizada.',
            })
          : undefined
      }
      focoDeReserva={focoDeReserva}
    >
      <FormField
        ref={campo}
        rotulo={rotulo}
        name="nome"
        autoComplete="off"
        maxLength={maximo}
        value={nome}
        onChange={(evento) => definirNome(evento.target.value)}
        erro={erroDoNome ?? (conflitou ? conflito : undefined)}
      />
    </FormDialog>
  )
}
