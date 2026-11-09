import { ErrorCode, MAXIMO_DE_LINHAS_DA_LISTA, nomeDaSerie, pareceDocumento, TAMANHO_MAXIMO_MATRICULA, TAMANHO_MAXIMO_NOME_DIGITADO, type AlunoDaTurma, type AlunosDaTurmaResponse, type EstadoDoNomeDaLista, type NomeDaLista } from '@educa/shared'
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData, type UseInfiniteQueryResult } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useCallback, useId, useMemo, useRef, useState } from 'react'
import { Link } from 'wouter'
import { ApiError } from '../../../api/client'
import { turmaAbertaQueryOptions, turmasQueryOptions } from '../../../api/estrutura'
import { TEXTO_DO_ALUNO_QUE_SAIU_DA_TURMA } from '../../../api/senha-provisoria/senha-provisoria'
import { acrescentarNome, alunosAprovadosDaTurmaQueryOptions, listaDaTurmaQueryOptions, retirarNome } from './api/lista'
import { ImportarPlanilha, type PlanilhaConfig } from '../importacao/ImportarPlanilha'
import { COORDENACAO_ROUTES } from '../../../paths'
import { DANGER_BUTTON_CLASSES, SECONDARY_BUTTON_CLASSES } from '../../../components/ui/button-variants'
import { FormField } from '../../../components/ui/fields/FormField'
import { useDialogState } from '../../../components/ui/overlays/dialog-state'
import { StatusAnnouncement, DangerConfirmDialog, FormDialog, useSingleSubmit } from '../../../components/dialogs'
import { DialogoDaSenhaProvisoria } from '../../../components/senha-provisoria/DialogoDaSenhaProvisoria'
import { ITENS_DA_LINHA_DA_SENHA_PROVISORIA } from '../../../components/senha-provisoria/itens-do-menu'
import { LoadingState, ErrorState, EmptyState } from '../../../components/states/index'
import { Menu } from '../../../components/ui/overlays/Menu'
import { MEDIA_MD, useMediaQuery } from '../../../components/ui/media-query'
import { ListaDePedidos } from '../../../components/pedidos/ListaDePedidos'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { Table, type TableColumn } from '../../../components/ui/Table'
import { errorText } from '../../../components/error-text'
import { Page } from '../../../components/ui/Page'
import { TurmaIndisponivel } from '../../../components/TurmaIndisponivel'
import { formatNumber, formatQuantity } from '../../../format'
import { usePageTitle } from '../../../document-title'
import { O_MIOLO_QUE_ROLA } from '../comum/miolo-que-rola'
import { NOME_DO_TURNO } from './nome-do-turno'
import { ProfessoresDaTurma } from './ProfessoresDaTurma'

/**
 * O estado do nome em texto, para a coordenação (regra 50, item 11). O aprovado não tem linha na lista de nomes: a lista o traz sem
 * nome nem matrícula, que passaram a viver no usuário. Ele aparece na seção "Alunos aprovados", lida no clique (acesso-e-convites, 12.0),
 * onde cada linha tem o menu da senha provisória.
 */
const ESTADO_DO_NOME: Readonly<Record<Exclude<EstadoDoNomeDaLista, 'aprovado'>, string>> = {
  livre: 'Livre: esperando o aluno pedir o nome',
  reivindicado: 'O aluno pediu o nome: esperando a decisão',
}

/**
 * O nome que a lista ainda mostra: livre, ou pedido e esperando a decisão. Esses têm nome e matrícula (o check
 * `lista_nome_aprovado_sem_nome` só os tira do aprovado).
 */
type NomeAindaNaLista = NomeDaLista & { readonly estado: Exclude<EstadoDoNomeDaLista, 'aprovado'>; readonly nome: string; readonly matricula: string }

/** A turma que a API não acha para a coordenação: saiu do ano em curso, ou foi excluída por outra pessoa. */
const TEXTO_DA_TURMA_FORA_DO_ANO = 'Esta turma não está no ano letivo em curso: ela pode ter sido excluída. Volte para Escola › Turmas e abra a turma de novo.'

/** O que a matrícula que parece documento diz no nome avulso: a mesma trava da lista colada (regra 20, item 2). */
const TEXTO_DA_MATRICULA_QUE_PARECE_DOCUMENTO = 'Isto parece CPF ou data de nascimento, e não matrícula. A lista leva só o nome e a matrícula do aluno.'

/**
 * A turma aberta na Estrutura, com a lista de nomes dela (A1, 13.0; RF4 e RF5; W4, "Lista"; W10): escolher o arquivo (CSV ou
 * Excel), ver a prévia, com os erros primeiro e em texto, e gravar só sem erro (a peça `ImportarPlanilha`, F2, 13.0); acrescentar um nome
 * avulso; retirar um nome livre. A matrícula aparece aqui, para a coordenação, e em nenhuma tela do aluno. Os pedidos de
 * nome da turma, que a coordenação também decide (16.0; RF12), são lidos só no "Atualizar".
 *
 * **Duas colunas a partir de 1024 px** (X2, 9.0; RF16): à esquerda, o envio da lista e os nomes em tabela; à direita, os
 * professores da turma e os pedidos. Abaixo disso, uma coluna, nessa ordem. A 768 px ou mais **só o miolo rola**, e a página
 * fica parada (RF23).
 *
 * - **Nome e matrícula só na memória da página e no corpo das requisições**: nunca no endereço, em `localStorage` nem em
 *   `sessionStorage` (regra 20; regra 50, item 7).
 * - **A prévia é do arquivo escolhido**: escolher outro (ou o mesmo de novo) a descarta, e a resposta de uma prévia anterior que
 *   chega depois não aparece. A gravação manda o mesmo texto da prévia, e o servidor refaz a prévia ao gravar.
 * - **Um envio por vez**: o clique duplo em "Gravar lista" manda um pedido só (`useSingleSubmit`).
 * - **Cada leitura da lista é auditada** (`turma.lista_lida`, finalidade de conferência de cadastro): a lista é lida ao
 *   abrir a turma e depois de cada escrita, a decisão de um pedido inclusive, e não ao voltar para a aba.
 * - **A turma que sai com a tela aberta** (a leitura dos pedidos deixa de achá-la) tira a página, com o foco no aviso.
 */
export default function ListaDaTurma({ turmaId }: { turmaId: string }) {
  const turma = useQuery(turmaAbertaQueryOptions(turmaId))
  // O turno não vem na turma aberta, só na lista de turmas do ano. Ela é não auditada e, com a turma lida, o ano em curso existe.
  // O complemento do título é só apoio: a lista que falha, ou que não traz a turma, deixa só a série.
  const turmas = useQuery({ ...turmasQueryOptions, enabled: turma.data !== undefined })
  // A leitura dos pedidos deixou de achar a turma: a página diz isso, como quando é a leitura da turma que não a acha.
  const [perdida, definirPerdida] = useState(false)
  const perderATurma = useCallback(() => definirPerdida(true), [])
  // O mesmo nome na aba e no `h1`; sem a turma lida, ou com ela fora do ano, é só "Turma".
  const nomeDaTurma = turma.data === undefined || perdida ? 'Turma' : `Turma ${turma.data.nome}`
  usePageTitle(nomeDaTurma)

  const voltar = (
    // Relativo à área: o `Route` aninhado em `/coordenacao` resolve o `to` a partir da base dela.
    <Link to={COORDENACAO_ROUTES.estrutura} aria-label="Voltar para Escola" className="inline-flex min-h-11 items-center gap-2 self-start text-caramelo-texto underline">
      <ArrowLeft aria-hidden="true" size={18} />
      Escola
    </Link>
  )

  if (turma.isPending)
    return (
      <Page titulo={nomeDaTurma} antes={voltar}>
        <LoadingState rotulo="Carregando a turma…" />
      </Page>
    )
  if (turma.isError || perdida)
    return (
      <Page titulo={nomeDaTurma} antes={voltar}>
        {perdida || (turma.error instanceof ApiError && turma.error.codigo === ErrorCode.NAO_ENCONTRADO) ? (
          // Quando a turma sai com a tela aberta, o "Atualizar" que tinha o foco saiu com ela: o foco vem para o aviso.
          <TurmaIndisponivel texto={TEXTO_DA_TURMA_FORA_DO_ANO} comFoco={perdida} />
        ) : (
          <ErrorState erro={turma.error} tentando={turma.isFetching} aoTentarDeNovo={() => void turma.refetch({ cancelRefetch: false })} />
        )}
      </Page>
    )

  const turno = turmas.data?.itens.find((candidata) => candidata.id === turmaId)?.turno ?? null
  const serie = nomeDaSerie(turma.data.serie)
  return (
    <Page titulo={nomeDaTurma} descricao={turno === null ? serie : `${serie} · ${NOME_DO_TURNO[turno]}`} antes={voltar} idDoTitulo="titulo-da-turma">
      <ConteudoDaLista turmaId={turmaId} turmaNome={turma.data.nome} aoPerderATurma={perderATurma} />
    </Page>
  )
}

/** O que a tabela dos nomes diz de cada coluna. A tabela vira lista no celular (`Table`), e o título da coluna passa a ser o rótulo do valor. */
function colunasDosNomes(aoRetirar: (nome: NomeAindaNaLista) => void): readonly [TableColumn<NomeAindaNaLista>, ...TableColumn<NomeAindaNaLista>[]] {
  return [
    { chave: 'nome', titulo: 'Nome', celula: (nome) => <span className="font-medium break-words">{nome.nome}</span> },
    { chave: 'matricula', titulo: 'Matrícula', celula: (nome) => <span className="break-words">{nome.matricula}</span> },
    {
      chave: 'situacao',
      titulo: 'Situação',
      celula: (nome) => (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {nome.estado === 'livre' ? <StatusBadge familia="info">{ESTADO_DO_NOME.livre}</StatusBadge> : <StatusBadge familia="pendente">{ESTADO_DO_NOME.reivindicado}</StatusBadge>}
          {nome.estado === 'livre' && (
            <button type="button" onClick={() => aoRetirar(nome)} className={DANGER_BUTTON_CLASSES}>
              {/* Com a matrícula: dois alunos com o mesmo nome na turma têm botões de nome diferente. */}
              Retirar
              <span className="sr-only">
                {' '}
                {nome.nome}, matrícula {nome.matricula} da lista
              </span>
            </button>
          )}
        </div>
      ),
    },
  ]
}

function ConteudoDaLista({ turmaId, turmaNome, aoPerderATurma }: { turmaId: string; turmaNome: string; aoPerderATurma: () => void }) {
  const cliente = useQueryClient()
  const nomes = useInfiniteQuery(listaDaTurmaQueryOptions(turmaId))
  const [anuncio, definirAnuncio] = useState('')
  const dialogo = useDialogState<'acrescentar' | 'retirar', NomeDaLista>()
  const aberta = dialogo.aberta
  // O nome da linha, fotografado na abertura: o diálogo de retirar só existe com ele.
  const alvo = aberta?.alvo
  const tituloDosNomes = useRef<HTMLHeadingElement>(null)
  const idDoTitulo = useId()
  // O miolo que rola recebe foco, para rolar pelo teclado, a partir de 768 px: abaixo disso rola a página, e não há o que focar.
  const comMiolo = useMediaQuery(MEDIA_MD)

  const recarregarNomes = () => cliente.invalidateQueries({ queryKey: listaDaTurmaQueryOptions(turmaId).queryKey })
  const itens = nomes.data?.pages.flatMap((pagina) => pagina.itens) ?? []
  // Os aprovados vêm sem nome nem matrícula: não são linha desta tabela, e a seção "Alunos aprovados" os lê pelo nome.
  const semAprovados = itens.filter((nome): nome is NomeAindaNaLista => nome.estado !== 'aprovado' && nome.nome !== null && nome.matricula !== null)

  function abrir(tipo: 'acrescentar' | 'retirar', item?: NomeDaLista): void {
    definirAnuncio('')
    dialogo.abrir(tipo, item)
  }

  return (
    <>
      <section
        aria-labelledby="titulo-da-turma"
        {...(comMiolo ? { tabIndex: 0 } : {})}
        className={`grid min-w-0 grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] ${O_MIOLO_QUE_ROLA}`}
      >
        <div className="flex min-w-0 flex-col gap-6">
          <SubirLista turmaId={turmaId} recarregarNomes={recarregarNomes} />

          <section aria-labelledby={idDoTitulo} className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 ref={tituloDosNomes} id={idDoTitulo} tabIndex={-1} className="text-lg font-semibold text-tinta">
                Nomes da turma
              </h2>
              <button type="button" onClick={() => abrir('acrescentar')} className={SECONDARY_BUTTON_CLASSES}>
                Acrescentar um nome
              </button>
            </div>
            {/* O anúncio fica aqui, com os nomes: é para onde o foco vai depois de gravar, acrescentar e retirar. */}
            <StatusAnnouncement texto={anuncio} />
            {nomes.isPending ? (
              <LoadingState rotulo="Carregando a lista de nomes…" />
            ) : nomes.isError ? (
              <ErrorState erro={nomes.error} tentando={nomes.isFetching} aoTentarDeNovo={() => void nomes.refetch({ cancelRefetch: false })} />
            ) : itens.length === 0 ? (
              <EmptyState titulo="Nenhum nome nesta turma ainda" descricao="Escolha o arquivo com o nome e a matrícula de cada aluno, um por linha, na seção acima." />
            ) : (
              <>
                <p className="text-sm text-sutil">
                  {nomes.hasNextPage ? `Mostrando os primeiros ${formatQuantity(itens.length, 'nome', 'nomes')}` : `${formatQuantity(itens.length, 'nome', 'nomes')} na lista`}
                </p>
                {/* Só aprovados: a tabela ficaria só com o cabeçalho, e os aprovados estão na seção própria. */}
                {semAprovados.length > 0 && (
                  <Table rotulo="Cada nome com a matrícula e a situação" colunas={colunasDosNomes((nome) => abrir('retirar', nome))} linhas={semAprovados} chaveDaLinha={(nome) => nome.id} />
                )}
                {nomes.hasNextPage && (
                  <button type="button" onClick={() => void nomes.fetchNextPage()} disabled={nomes.isFetchingNextPage} className={`${SECONDARY_BUTTON_CLASSES} self-start`}>
                    {nomes.isFetchingNextPage ? 'Carregando…' : 'Ver mais nomes'}
                  </button>
                )}
              </>
            )}
          </section>

          <AlunosAprovados turmaId={turmaId} />
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <ProfessoresDaTurma turmaId={turmaId} />
          <ListaDePedidos
            turma={{ id: turmaId, nome: turmaNome }}
            quem="coordenacao"
            vazio={{
              titulo: 'Nenhum pedido esperando',
              descricao: 'Os pedidos chegam quando o professor da turma gerar o acesso e os alunos pedirem o nome.',
            }}
            aoPerderATurma={aoPerderATurma}
            aoDecidir={recarregarNomes}
          />
        </div>
      </section>

      {aberta?.tipo === 'acrescentar' && (
        <NomeAvulso
          key={aberta.numero}
          turmaId={turmaId}
          aoFechar={dialogo.fechar}
          aoAcrescentar={() => {
            definirAnuncio('Nome acrescentado à lista da turma.')
            dialogo.fecharSeAinda(aberta)
          }}
          recarregar={recarregarNomes}
        />
      )}
      {aberta?.tipo === 'retirar' && alvo !== undefined && (
        <DangerConfirmDialog
          key={aberta.numero}
          titulo="Retirar o nome da lista"
          texto={
            <>
              <span className="font-medium text-tinta">{alvo.nome}</span>
              {alvo.matricula === null ? '' : `, matrícula ${alvo.matricula},`} sai da lista desta turma. Só sai o nome livre: o de quem já
              pediu o nome ou já foi aprovado fica.
            </>
          }
          rotuloDaAcao="Retirar da lista"
          rotuloEmAndamento="Retirando…"
          acao={() => retirarNome(alvo.id)}
          aoFechar={dialogo.fechar}
          aoConcluir={() => {
            definirAnuncio('Nome retirado da lista.')
            dialogo.fecharSeAinda(aberta)
          }}
          aoTerminar={recarregarNomes}
          textosDaFalha={{
            [ErrorCode.CONFLITO]: 'Este nome não está mais livre: o aluno já pediu o nome ou foi aprovado, e ele não sai por aqui. A lista foi atualizada.',
            [ErrorCode.NAO_ENCONTRADO]: 'Este nome já saiu da lista. A lista foi atualizada.',
          }}
          focoDeReserva={() => tituloDosNomes.current?.focus()}
        />
      )}
    </>
  )
}

/** O que a seção diz antes do clique: nada foi lido, e cada leitura fica na auditoria em nome de quem lê (regra 20, item 10). */
const TEXTO_ANTES_DOS_APROVADOS =
  'Os alunos aprovados entram com a matrícula e a senha. Clique em Mostrar alunos aprovados para ver o nome deles e gerar uma senha provisória. Cada consulta fica registrada na auditoria, em seu nome.'

/** Em ordem de nome, no português do Brasil; o id desempata dois alunos de mesmo nome. */
function porNome(a: AlunoDaTurma, b: AlunoDaTurma): number {
  return a.nome.localeCompare(b.nome, 'pt-BR') || (a.usuarioId < b.usuarioId ? -1 : a.usuarioId > b.usuarioId ? 1 : 0)
}

type LeituraDosAprovados = UseInfiniteQueryResult<InfiniteData<AlunosDaTurmaResponse>>

/** A tabela dos aprovados lidos, com o menu de cada linha, e o "Ver mais alunos" quando a leitura tem mais páginas. */
function ListaDosAprovados({ alunos, lidos, aoGerarASenha }: { alunos: LeituraDosAprovados; lidos: readonly AlunoDaTurma[]; aoGerarASenha: (usuarioId: string) => void }) {
  return (
    <>
      <p className="text-sm text-sutil">{alunos.hasNextPage ? `Mostrando os primeiros ${formatQuantity(lidos.length, 'aluno', 'alunos')}` : formatQuantity(lidos.length, 'aluno aprovado', 'alunos aprovados')}</p>
      <Table
        rotulo="Alunos aprovados da turma"
        colunas={[
          { chave: 'nome', titulo: 'Aluno', celula: (aluno) => <span className="font-medium break-words">{aluno.nome}</span> },
          {
            chave: 'acoes',
            titulo: 'Ações',
            celula: (aluno) => <Menu rotulo="Ações" prefixo={aluno.nome} itens={ITENS_DA_LINHA_DA_SENHA_PROVISORIA} aoEscolher={() => aoGerarASenha(aluno.usuarioId)} />,
          },
        ]}
        linhas={lidos}
        chaveDaLinha={(aluno) => aluno.usuarioId}
      />
      {alunos.hasNextPage && (
        <button type="button" onClick={() => void alunos.fetchNextPage()} disabled={alunos.isFetchingNextPage} className={`${SECONDARY_BUTTON_CLASSES} self-start`}>
          {alunos.isFetchingNextPage ? 'Carregando…' : 'Ver mais alunos'}
        </button>
      )}
    </>
  )
}

/** O que a seção mostra depois do clique: carregando, a falha, o vazio ou os alunos. */
function CorpoDosAprovados({ alunos, aoGerarASenha }: { alunos: LeituraDosAprovados; aoGerarASenha: (usuarioId: string) => void }) {
  if (alunos.data === undefined)
    return alunos.isError ? (
      <ErrorState erro={alunos.error} tentando={alunos.isFetching} aoTentarDeNovo={() => void alunos.refetch({ cancelRefetch: false })} />
    ) : (
      <LoadingState rotulo="Carregando os alunos aprovados…" />
    )
  const lidos = alunos.data.pages.flatMap((pagina) => pagina.itens).sort(porNome)
  if (lidos.length === 0)
    return <EmptyState titulo="Nenhum aluno aprovado ainda" descricao="Os alunos aparecem aqui quando o pedido de nome deles é aprovado, pela coordenação ou pelo professor da turma." />
  return <ListaDosAprovados alunos={alunos} lidos={lidos} aoGerarASenha={aoGerarASenha} />
}

/**
 * A seção "Alunos aprovados" da turma aberta (acesso-e-convites, 12.0; RF13, RF18; Tech Spec, seção 9): os alunos que já entram, lidos de `GET /v1/turmas/:id/alunos` **só no clique** em "Mostrar
 * alunos aprovados", porque cada leitura é auditada em nome de quem a faz. No lugar da contagem de aprovados que a lista de nomes mostrava, cada linha tem o menu "Ações" com "Gerar senha provisória",
 * a mesma confirmação do professor (`DialogoDaSenhaProvisoria`). O nome e a matrícula só passam pela memória da página: nunca no endereço nem no armazenamento (regra 20; regra 50, item 7).
 * O aluno que a confirmação descobre fora da turma (404) fecha o diálogo, diz o aviso e lê a lista de novo.
 */
function AlunosAprovados({ turmaId }: { turmaId: string }) {
  const [mostrando, definirMostrando] = useState(false)
  const [aviso, definirAviso] = useState('')
  const alunos = useInfiniteQuery({ ...alunosAprovadosDaTurmaQueryOptions(turmaId), enabled: mostrando })
  const dialogo = useDialogState<'provisoria', string>()
  const aberta = dialogo.aberta
  const tituloDaSecao = useRef<HTMLHeadingElement>(null)
  const idDoTitulo = useId()

  function abrirProvisoria(usuarioId: string): void {
    definirAviso('')
    dialogo.abrir('provisoria', usuarioId)
  }

  return (
    <section aria-labelledby={idDoTitulo} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 ref={tituloDaSecao} id={idDoTitulo} tabIndex={-1} className="text-lg font-semibold text-tinta">
          Alunos aprovados
        </h2>
        {mostrando ? (
          <button type="button" onClick={() => void alunos.refetch({ cancelRefetch: false })} disabled={alunos.isFetching} className={SECONDARY_BUTTON_CLASSES}>
            Atualizar<span className="sr-only"> os alunos aprovados</span>
          </button>
        ) : (
          <button type="button" onClick={() => definirMostrando(true)} className={SECONDARY_BUTTON_CLASSES}>
            Mostrar alunos aprovados
          </button>
        )}
      </div>
      <StatusAnnouncement texto={aviso} />
      {mostrando ? <CorpoDosAprovados alunos={alunos} aoGerarASenha={abrirProvisoria} /> : <p className="text-sm text-sutil">{TEXTO_ANTES_DOS_APROVADOS}</p>}
      {aberta?.tipo === 'provisoria' && aberta.alvo !== undefined && (
        <DialogoDaSenhaProvisoria
          key={aberta.numero}
          usuarioId={aberta.alvo}
          aoFechar={dialogo.fechar}
          aoPerderOAluno={() => {
            definirAviso(TEXTO_DO_ALUNO_QUE_SAIU_DA_TURMA)
            dialogo.fecharSeAinda(aberta)
            void alunos.refetch({ cancelRefetch: false })
          }}
          focoDeReserva={() => tituloDaSecao.current?.focus()}
        />
      )}
    </section>
  )
}

/**
 * Subir a lista de uma turma (RF4, W10): o mesmo envio da planilha da escola (`ImportarPlanilha`), com as rotas da turma. A lista
 * é de nome e matrícula, sem coluna de turma: a prévia e o gravar são os de `/v1/turmas/:id/lista`, e os nomes acompanham o fim da
 * gravação.
 */
function SubirLista({ turmaId, recarregarNomes }: { turmaId: string; recarregarNomes: () => unknown }) {
  const configuracao = useMemo<PlanilhaConfig>(
    () => ({
      rotas: { previa: `/v1/turmas/${encodeURIComponent(turmaId)}/lista/previa`, gravar: `/v1/turmas/${encodeURIComponent(turmaId)}/lista` },
      cabecalhos: ['nome', 'matricula'],
      nomeDoModelo: 'modelo-lista-da-turma.csv',
      instrucao: `Um aluno por linha: o nome e a matrícula. Escolha o CSV ou o Excel (.xlsx); a primeira linha pode ser o cabeçalho "nome; matrícula". Até ${formatNumber(MAXIMO_DE_LINHAS_DA_LISTA)} linhas por vez.`,
      vazio: { titulo: 'Nenhuma planilha escolhida', descricao: 'Escolha o arquivo com o nome e a matrícula de cada aluno da turma para ver a prévia antes de gravar.' },
      rotuloDoGravar: 'Gravar lista',
      textosDaFalhaDaPrevia: {
        [ErrorCode.ENTRADA_INVALIDA]: `Não deu para ler a lista. Confira se cada linha tem o nome e a matrícula, se há ao menos um aluno e se ela não passa de ${formatNumber(MAXIMO_DE_LINHAS_DA_LISTA)} linhas.`,
        [ErrorCode.NAO_ENCONTRADO]: 'Esta turma não está mais no ano letivo em curso. Volte para Escola › Turmas.',
      },
      textosDaFalhaDoGravar: {
        [ErrorCode.NAO_ENCONTRADO]: 'Esta turma não está mais no ano letivo em curso. Nada foi gravado.',
      },
    }),
    [turmaId],
  )
  const idDoTitulo = useId()
  return (
    <section aria-labelledby={idDoTitulo} className="flex min-w-0 flex-col gap-4 rounded-cartao border border-linha bg-superficie p-4">
      <h2 id={idDoTitulo} className="text-lg font-semibold text-tinta">
        Subir a lista de nomes
      </h2>
      <ImportarPlanilha configuracao={configuracao} aoConcluir={recarregarNomes} />
    </section>
  )
}

function NomeAvulso({ turmaId, aoFechar, aoAcrescentar, recarregar }: { turmaId: string; aoFechar: () => void; aoAcrescentar: () => void; recarregar: () => unknown }) {
  const [nome, definirNome] = useState('')
  const [matricula, definirMatricula] = useState('')
  const [erros, definirErros] = useState<{ nome?: string; matricula?: string }>({})
  const campoDoNome = useRef<HTMLInputElement>(null)
  const campoDaMatricula = useRef<HTMLInputElement>(null)
  const { enviar, mutacao } = useSingleSubmit({
    mutationFn: (pedido: { nome: string; matricula: string }) => acrescentarNome(turmaId, pedido),
    onSuccess: async () => {
      await recarregar()
      aoAcrescentar()
    },
    onError: recarregar,
  })

  function aoEnviar(): void {
    const pedido = { nome: nome.trim(), matricula: matricula.trim() }
    const novos = {
      ...(pedido.nome === '' ? { nome: 'Digite o nome do aluno.' } : {}),
      ...(pedido.matricula === '' ? { matricula: 'Digite a matrícula do aluno.' } : pareceDocumento(pedido.matricula) ? { matricula: TEXTO_DA_MATRICULA_QUE_PARECE_DOCUMENTO } : {}),
    }
    definirErros(novos)
    // O foco vai para o primeiro campo com erro: o leitor de tela lê o erro ao chegar nele.
    if (novos.nome !== undefined) campoDoNome.current?.focus()
    else if (novos.matricula !== undefined) campoDaMatricula.current?.focus()
    else enviar(pedido)
  }

  return (
    <FormDialog
      titulo="Acrescentar um nome"
      aoFechar={aoFechar}
      aoEnviar={aoEnviar}
      enviando={mutacao.isPending}
      rotuloDoEnvio="Acrescentar"
      rotuloEnviando="Acrescentando…"
      falha={
        mutacao.isError
          ? errorText(mutacao.error, {
              [ErrorCode.CONFLITO]: 'Esta matrícula já está na lista de uma turma da escola ou é de um aluno da escola. Nada foi gravado.',
              [ErrorCode.NAO_ENCONTRADO]: 'Esta turma não está mais no ano letivo em curso. Nada foi gravado.',
              // A tela segura antes, com a mesma regra do contrato; se as duas divergirem, a recusa da API diz o que fazer.
              [ErrorCode.ENTRADA_INVALIDA]: 'Confira o nome e a matrícula: a matrícula não pode ter forma de CPF ou de data de nascimento. Nada foi gravado.',
            })
          : undefined
      }
    >
      <p className="text-sm text-apoio">Para o aluno que chega depois: ele aparece na lista da turma e pede o nome pelo acesso que já está valendo.</p>
      <FormField
        ref={campoDoNome}
        rotulo="Nome do aluno"
        name="nome"
        autoComplete="off"
        spellCheck={false}
        maxLength={TAMANHO_MAXIMO_NOME_DIGITADO}
        value={nome}
        onChange={(evento) => definirNome(evento.target.value)}
        erro={erros.nome}
      />
      <FormField
        ref={campoDaMatricula}
        rotulo="Matrícula"
        name="matricula"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        maxLength={TAMANHO_MAXIMO_MATRICULA}
        value={matricula}
        onChange={(evento) => definirMatricula(evento.target.value)}
        erro={erros.matricula}
      />
    </FormDialog>
  )
}
