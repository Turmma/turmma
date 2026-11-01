import type { ProfessorDaEscola } from '@educa/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useSearch } from 'wouter'
import { CHAVE_DA_ESTRUTURA, consultaAnosLetivos, consultaVinculos } from '../../../api/estrutura'
import { consultaProfessores, mutacaoDoCadastroDeProfessor, mutacaoDoRefazerConviteDoProfessor, revogarConviteDoProfessor } from './api/professores'
import { aoTrocarDeSessao } from '../../../api/sessao'
import { PARAMETRO_DO_PROFESSOR } from '../../../paths'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { Dialog } from '../../../components/ui/overlays/Dialog'
import { useDialogState } from '../../../components/ui/overlays/dialog-state'
import { DialogoDeConviteNovo, DialogoDeConviteRefeito } from '../../../components/DialogoDoConvite'
import { ConfirmacaoDePerigo } from '../../../components/dialogs'
import { EstadoCarregando, EstadoErro, EstadoVazio } from '../../../components/states/index'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { Table, type TableColumn } from '../../../components/ui/Table'
import {
  falhaDoCadastroDeProfessor,
  falhaDoRefazerConviteDeProfessor,
  FAMILIA_DO_ESTADO_DO_PROFESSOR,
  pedidoDeProfessor,
  temHomonimo,
  TEXTO_DA_VALIDADE_DO_CONVITE,
  TEXTO_DO_ESTADO_DO_PROFESSOR,
  TEXTO_DO_LINK_UMA_VEZ,
  TEXTO_DO_NOME_REPETIDO,
  TEXTOS_DO_CONVITE_QUE_MUDOU,
} from './convite-de-professor'
import { DialogoDeAlocacao } from '../estrutura/Alocacao'
import { enderecoComParametro } from '../comum/endereco-da-tela'
import { textoDaListaCurta } from '../estrutura/lista-curta'
import { useFocarOTituloDaMoldura } from '../comum/moldura'
import { AvisoDeListaIncompleta, CLASSES_DO_BOTAO_DA_LINHA } from '../comum/pecas-da-lista'
import { PainelDoProfessor } from './PainelDoProfessor'
import { contagemDeProfessores, professorAlocavel, professorDoEndereco, professoresDaTabela, type ProfessorDaTabela } from './professores-da-escola'

/** Os diálogos da tela, um por vez. O refazer, o revogar e o acrescentar turma levam o professor da linha, fotografado na abertura. */
type TipoDeDialogo = 'cadastrar' | 'refazer' | 'revogar' | 'acrescentar'
type ProfessorDaLinha = Pick<ProfessorDaEscola, 'usuarioId' | 'nome'>

/** A etapa do link e a pergunta de fechar, com quem entra pelo convite da coordenação. */
const TEXTOS_DO_LINK = { validade: TEXTO_DA_VALIDADE_DO_CONVITE, quemEntra: 'a pessoa convidada' } as const

/**
 * A quem mandar o link, na etapa do link: a pessoa, pelo nome que a coordenação digitou. No cadastro vai também o e-mail
 * com que ela entra, que a tela do convite e a entrada não dizem; no refazer não vai, porque a lista não traz e-mail.
 */
function mandeOLinkA(nome: string, email?: string) {
  return (
    <>
      Mande o link a <span className="font-medium text-tinta wrap-anywhere">{nome}</span>
      {email !== undefined && (
        <>
          , que entra com o e-mail <span className="font-medium text-tinta wrap-anywhere">{email}</span>
        </>
      )}
      .
    </>
  )
}

function colunasDosProfessores(aoAbrir: (usuarioId: string) => void): readonly [TableColumn<ProfessorDaTabela>, ...TableColumn<ProfessorDaTabela>[]] {
  return [
    {
      chave: 'nome',
      titulo: 'Nome',
      celula: ({ professor }) => (
        // O nome acessível é o nome da pessoa; o "›" só diz, a quem enxerga, que a linha abre algo ao lado.
        <button type="button" aria-haspopup="dialog" onClick={() => aoAbrir(professor.usuarioId)} className={CLASSES_DO_BOTAO_DA_LINHA}>
          <span className="min-w-0 break-words">{professor.nome}</span>
          <ChevronRight aria-hidden="true" size={16} strokeWidth={2.5} className="shrink-0 text-sutil" />
        </button>
      ),
    },
    { chave: 'disciplinas', titulo: 'Disciplinas', celula: ({ disciplinas }) => textoDaListaCurta(disciplinas) },
    { chave: 'turmas', titulo: 'Turmas', celula: ({ turmas }) => textoDaListaCurta(turmas) },
    {
      chave: 'situacao',
      titulo: 'Situação',
      celula: ({ professor }) => <StatusBadge familia={FAMILIA_DO_ESTADO_DO_PROFESSOR[professor.estado]}>{TEXTO_DO_ESTADO_DO_PROFESSOR[professor.estado]}</StatusBadge>,
    },
  ]
}

/**
 * Escola › Professores (A1, 14.0; X2, 6.0; `docs/interface.md` 3 e 11.1; RF6, RF13 e RF22): a coordenação cadastra o professor com o
 * nome e o e-mail de login, copia o link do convite, que aparece uma vez, e refaz ou revoga o convite em aberto. Não há envio de
 * e-mail: o link sai da escola pela mão da coordenação.
 *
 * Os professores estão numa tabela (Nome, Disciplinas, Turmas e Situação), pelo nome, e a linha inteira abre o painel dele ao lado
 * (`?professor=<usuarioId>`), onde ficam a situação, as turmas dele e as ações que o estado permite — entre elas "Acrescentar turma", que
 * é a alocação (7.0): o diálogo abre por cima do painel, e o vínculo nasce esperando o professor confirmar. "Cadastrar professor" é o único
 * botão cheio.
 * Sem e-mail, sem busca e sem ordem que não seja a do nome (regra 70, item 9; D64): a tabela diz o que a escola alocou, e nunca uso.
 *
 * - **Quatro estados** (W4): carregando; erro com "Tentar de novo"; vazio, "Nenhum professor ainda", com o Cadastrar; e com dado, o
 *   estado de cada convite em texto. A lista não traz e-mail nem diz se a conta do e-mail já existia (E11). As turmas e as
 *   disciplinas vêm dos vínculos do ano em curso, lidos à parte: se não vieram, a célula diz "—" e um aviso diz por quê, e a tabela
 *   continua em pé.
 * - **O diálogo do convite** é o de `components/DialogoDoConvite.tsx`, o mesmo da operação, aberto da tela (Cadastrar) ou do painel
 *   (refazer e revogar): o link vive só na mutação da abertura que o pediu, sai do cache ao fechar (`gcTime: 0` e `reset()`), e
 *   fechar sem copiar pergunta antes. Quando a sessão desta aba deixa de ser a mesma — venceu, ou outra pessoa entrou —, o
 *   diálogo aberto sai com o link: ele é credencial do professor, e não fica na tela atrás do login por cima (regra 20, item 8).
 * - **O que abre por cima fica no endereço**, só com o id: abrir é um passo no histórico, e fechar troca o endereço, sem passo novo.
 *   O id que a lista da escola não tem não abre nada (regra 10, item 6).
 */
export default function Professores() {
  const cliente = useQueryClient()
  const [caminho, navegar] = useLocation()
  const busca = useSearch()
  const professores = useQuery(consultaProfessores)
  // Turmas e disciplinas são dos vínculos do ano em curso: sem ele a API responde como inexistente, e a tela nem pergunta.
  const anos = useQuery(consultaAnosLetivos)
  const vinculos = useQuery({ ...consultaVinculos, enabled: anos.data?.itens.some((ano) => ano.situacao === 'em_curso') === true })
  const dialogo = useDialogState<TipoDeDialogo, ProfessorDaLinha>()
  const aberta = dialogo.aberta
  const fechar = dialogo.fechar
  // O professor da linha, fotografado na abertura: os diálogos de refazer e de revogar só existem com ele.
  const alvo = aberta?.alvo
  // O anúncio é de um professor só: o painel de outro não repete o que a coordenação fez com este.
  const [anuncio, definirAnuncio] = useState<{ usuarioId: string; texto: string } | undefined>(undefined)
  const focarOTituloDaMoldura = useFocarOTituloDaMoldura()
  const tituloDaLista = useRef<HTMLHeadingElement>(null)
  const tituloDaSituacao = useRef<HTMLHeadingElement>(null)
  const tituloDasTurmas = useRef<HTMLHeadingElement>(null)

  const dados = professores.data
  const doPainel = dados === undefined ? undefined : professorDoEndereco(busca, dados.itens)
  const painelAberto = doPainel !== undefined

  const recarregar = useCallback(() => cliente.invalidateQueries({ queryKey: consultaProfessores.queryKey }), [cliente])
  // Acrescentar uma turma muda os vínculos, e a falha dela diz que a turma, a disciplina ou o convite mudou: a estrutura toda relê.
  const recarregarAEstrutura = useCallback(() => cliente.invalidateQueries({ queryKey: CHAVE_DA_ESTRUTURA }), [cliente])
  // O foco quando o botão que abriu o diálogo saiu da tela: o "Cadastrar" do vazio, ou a ação que o estado novo não tem.
  // Sem a lista na tela (a releitura caiu com ela ainda vazia), vai para o título da tela, e não para o `body`.
  const focarNaLista = useCallback(() => (tituloDaLista.current === null ? focarOTituloDaMoldura() : tituloDaLista.current.focus()), [focarOTituloDaMoldura])
  // Os diálogos abertos do painel: o "Refazer" e o "Revogar" saem do rodapé quando o estado muda, e o foco fica no painel, e não na página inerte atrás.
  const focarNoPainel = useCallback(() => (tituloDaSituacao.current === null ? focarNaLista() : tituloDaSituacao.current.focus()), [focarNaLista])
  // O "Acrescentar turma" que saiu do rodapé (o convite venceu com o diálogo aberto): o foco vai às turmas do painel.
  const focarNasTurmas = useCallback(() => (tituloDasTurmas.current === null ? focarNoPainel() : tituloDasTurmas.current.focus()), [focarNoPainel])

  useEffect(() => aoTrocarDeSessao(fechar), [fechar])

  // O painel aberto já pelo endereço (o link do sino, ou o Voltar do histórico) não tem botão que o tenha aberto: o foco devolvido a
  // "quem abriu" cai no `body`. Quando o painel fecha e o foco está no `body`, vai ao título da lista, e não se perde.
  useEffect(() => {
    const titulo = tituloDaLista.current
    return () => {
      if (document.activeElement === document.body) titulo?.focus()
    }
  }, [painelAberto])

  /** Abrir um diálogo apaga o anúncio da ação anterior: o que ele dizia já não é o que a pessoa está fazendo. */
  function abrir(tipo: TipoDeDialogo, professor?: ProfessorDaLinha): void {
    definirAnuncio(undefined)
    dialogo.abrir(tipo, professor)
  }

  const abrirPainel = (usuarioId: string): void => navegar(enderecoComParametro(caminho, busca, PARAMETRO_DO_PROFESSOR, usuarioId))
  const fecharPainel = (): void => navegar(enderecoComParametro(caminho, busca, PARAMETRO_DO_PROFESSOR, undefined), { replace: true })

  const erroDaLeitura = <EstadoErro erro={professores.error} tentando={professores.isFetching} aoTentarDeNovo={() => void professores.refetch({ cancelRefetch: false })} />
  // Os anos ou os vínculos que não vieram: a tabela continua com o que tem, e o aviso diz por que as células de turma e disciplina estão em "—".
  const turmasComFalha = anos.isError || vinculos.isError
  const lerTurmasDeNovo = () => void (anos.isError ? anos : vinculos).refetch({ cancelRefetch: false })
  const lendoTurmas = anos.isFetching || vinculos.isFetching
  // O professor do diálogo "Acrescentar turma" como a lista de agora o tem, e não como foi fotografado na abertura: o convite que
  // venceu com o diálogo aberto tira o envio.
  const alvoAgora = alvo === undefined ? undefined : dados?.itens.find((candidato) => candidato.usuarioId === alvo.usuarioId)
  const alvoRecebeTurma = alvoAgora !== undefined && professorAlocavel(alvoAgora.estado)

  return (
    <section className="flex min-w-0 flex-col gap-6" aria-label="Professores">
      {professores.isPending ? (
        <EstadoCarregando rotulo="Carregando os professores…" />
      ) : dados === undefined ? (
        erroDaLeitura
      ) : dados.itens.length === 0 ? (
        // A releitura que cai com a lista ainda vazia (logo depois do primeiro cadastro) não afirma o vazio: a lista de
        // antes já não vale, e "Nenhum professor ainda" negaria o cadastro que acabou de acontecer.
        professores.isError ? (
          erroDaLeitura
        ) : (
          <EstadoVazio
            titulo="Nenhum professor ainda"
            descricao="Cadastre cada professor com o nome e o e-mail dele. O link do convite aparece uma vez, para você copiar e mandar; a pessoa abre o link e cria a senha."
            acao={{ rotulo: 'Cadastrar professor', aoAcionar: () => abrir('cadastrar') }}
          />
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
              <h2 ref={tituloDaLista} tabIndex={-1} className="text-lg font-semibold text-tinta">
                Professores da escola
              </h2>
              <p className="t-apoio text-sutil">{contagemDeProfessores(dados.itens.length)}</p>
            </div>
            <Button onClick={() => abrir('cadastrar')}>Cadastrar professor</Button>
          </div>
          {professores.isError && erroDaLeitura}
          {turmasComFalha && (
            <Alert
              tom="atencao"
              acao={
                <Button variante="secundario" disabled={lendoTurmas} onClick={lerTurmasDeNovo}>
                  {lendoTurmas ? 'Tentando de novo…' : 'Tentar de novo'}
                </Button>
              }
            >
              As turmas e as disciplinas dos professores não carregaram
            </Alert>
          )}
          <Table rotulo="Professores da escola" colunas={colunasDosProfessores(abrirPainel)} linhas={professoresDaTabela(dados.itens, vinculos.data)} chaveDaLinha={(linha) => linha.professor.usuarioId} />
          <AvisoDeListaIncompleta completa={dados.completa} />
        </>
      )}

      {doPainel !== undefined && (
        <PainelDoProfessor
          key={doPainel.usuarioId}
          professor={doPainel}
          aoFechar={fecharPainel}
          aoRefazer={() => abrir('refazer', doPainel)}
          aoRevogar={() => abrir('revogar', doPainel)}
          aoAcrescentar={() => abrir('acrescentar', doPainel)}
          anuncio={anuncio?.usuarioId === doPainel.usuarioId ? anuncio.texto : ''}
          tituloDaSituacao={tituloDaSituacao}
          tituloDasTurmas={tituloDasTurmas}
          focoDeReserva={focarNaLista}
        />
      )}

      {/* O cadastro e o refazer não fecham sozinhos: a resposta deles só preenche o diálogo que a pediu. */}
      {aberta?.tipo === 'cadastrar' && (
        <DialogoDeConviteNovo
          key={aberta.numero}
          Moldura={Dialog}
          titulo="Cadastrar professor"
          apresentacao="O nome e o e-mail com que a pessoa vai entrar. Você copia o link do convite e manda a ela, que cria a senha ao abrir."
          rotulos={{ nome: 'Nome do professor', email: 'E-mail do professor' }}
          validar={pedidoDeProfessor}
          tituloDaRevisao="Confira antes de cadastrar"
          resumo={(pedido) => [
            { rotulo: 'Nome do professor', valor: pedido.nome },
            { rotulo: 'E-mail', valor: pedido.email },
          ]}
          avisos={[TEXTO_DA_VALIDADE_DO_CONVITE, TEXTO_DO_LINK_UMA_VEZ]}
          avisosDoPedido={(pedido) => (temHomonimo(dados?.itens ?? [], pedido.nome) ? [TEXTO_DO_NOME_REPETIDO] : [])}
          acao={{ confirmar: 'Cadastrar e gerar o link', confirmando: 'Cadastrando…', anuncio: 'Cadastrando o professor…' }}
          // A lista muda, dê certo ou não. As opções são as de `api/professores.ts`, sem nada por cima: é lá que o
          // `gcTime: 0` tira o token do cache.
          mutacao={mutacaoDoCadastroDeProfessor(recarregar)}
          falha={falhaDoCadastroDeProfessor}
          mandePara={(pedido) => mandeOLinkA(pedido.nome, pedido.email)}
          link={TEXTOS_DO_LINK}
          aoFechar={fechar}
          focoDeReserva={focarNaLista}
        />
      )}
      {aberta?.tipo === 'refazer' && alvo !== undefined && (
        <DialogoDeConviteRefeito
          key={aberta.numero}
          Moldura={Dialog}
          titulo="Refazer o convite"
          confirmacao={
            <>
              Um link novo para <span className="font-medium text-tinta wrap-anywhere">{alvo.nome}</span>. O link mandado antes para de valer na hora.
            </>
          }
          avisos={[TEXTO_DA_VALIDADE_DO_CONVITE, TEXTO_DO_LINK_UMA_VEZ]}
          acao={{ confirmar: 'Refazer convite', confirmando: 'Refazendo…', anuncio: 'Refazendo o convite…' }}
          mutacao={mutacaoDoRefazerConviteDoProfessor(alvo.usuarioId, recarregar)}
          falha={falhaDoRefazerConviteDeProfessor}
          mandePara={mandeOLinkA(alvo.nome)}
          link={TEXTOS_DO_LINK}
          aoFechar={fechar}
          focoDeReserva={focarNoPainel}
        />
      )}
      {aberta?.tipo === 'revogar' && alvo !== undefined && (
        <ConfirmacaoDePerigo
          key={aberta.numero}
          titulo="Revogar o convite"
          texto={
            <>
              O convite de <span className="font-medium text-tinta wrap-anywhere">{alvo.nome}</span> deixa de valer na hora: o link mandado não entra mais. As turmas já
              alocadas a essa pessoa continuam esperando. Para convidar de novo, cadastre o mesmo e-mail.
            </>
          }
          rotuloDaAcao="Revogar convite"
          rotuloEmAndamento="Revogando…"
          acao={() => revogarConviteDoProfessor(alvo.usuarioId)}
          aoFechar={fechar}
          aoConcluir={() => {
            definirAnuncio({ usuarioId: alvo.usuarioId, texto: `Convite de ${alvo.nome} revogado.` })
            dialogo.fecharSeAinda(aberta)
          }}
          aoTerminar={recarregar}
          textosDaFalha={TEXTOS_DO_CONVITE_QUE_MUDOU}
          focoDeReserva={focarNoPainel}
        />
      )}
      {aberta?.tipo === 'acrescentar' && alvo !== undefined && (
        <DialogoDeAlocacao
          key={aberta.numero}
          professor={alvo}
          alocavel={alvoRecebeTurma}
          aoFechar={fechar}
          aoAlocar={(texto) => {
            definirAnuncio({ usuarioId: alvo.usuarioId, texto })
            dialogo.fecharSeAinda(aberta)
          }}
          recarregar={recarregarAEstrutura}
          focoDeReserva={focarNasTurmas}
        />
      )}
    </section>
  )
}
