import { NOME_DA_CONTESTACAO, type EstadoDeVinculo, type ProfessorDaEscola, type VinculoDaCoordenacao } from '@educa/shared'
import { useQuery } from '@tanstack/react-query'
import { useId, type ReactNode, type RefObject } from 'react'
import { consultaAnosLetivos, consultaDisciplinas, consultaTurmas, consultaVinculos } from '../../../api/estrutura'
import { Botao } from '../../../components/ui/Botao'
import { Anuncio } from '../../../components/dialogs'
import { EstadoCarregando, EstadoErro, EstadoVazio } from '../../../components/states/index'
import { PainelLado } from '../../../components/ui/overlays/PainelLado'
import { Estado } from '../../../components/ui/SeloDeEstado'
import { acoesDoConviteDeProfessor, FAMILIA_DO_ESTADO_DO_PROFESSOR, TEXTO_DO_ESTADO_DO_PROFESSOR } from './convite-de-professor'
import { descricaoDoQueFalta, oQueFaltaParaAlocar, tituloDoQueFalta } from './o-que-falta-para-alocar'
import { AvisoDeListaIncompleta } from '../comum/pecas-da-lista'
import { MOTIVO_DO_ENCERRAMENTO, porQueNaoRecebeTurma, professorAlocavel, vinculosDoProfessor } from './professores-da-escola'

/**
 * O estado do vínculo como a coordenação o lê, em texto (regra 50, item 11), e a família do selo: quem decide agora é o professor,
 * e a contestação é a que pede ação da escola. É o texto do painel; o da lista da turma é o de `ProfessoresDaTurma`.
 */
const SELO_DO_VINCULO = {
  pendente: { familia: 'pendente', texto: 'Esperando o professor confirmar' },
  confirmado: { familia: 'ok', texto: 'Confirmou' },
  contestado: { familia: 'erro', texto: 'Contestou' },
  encerrado: { familia: 'info', texto: 'Encerrada' },
} as const satisfies Readonly<Record<EstadoDeVinculo, { readonly familia: 'pendente' | 'ok' | 'erro' | 'info'; readonly texto: string }>>

function SeloDoVinculo({ estado }: { readonly estado: EstadoDeVinculo }) {
  const { familia, texto } = SELO_DO_VINCULO[estado]
  return familia === 'pendente' ? <Estado familia="pendente">{texto}</Estado> : <Estado familia={familia}>{texto}</Estado>
}

/** Uma turma do professor: a turma, a disciplina, o estado em texto e, no contestado, o motivo e o que ele escreveu. */
function TurmaDoProfessor({ vinculo }: { readonly vinculo: VinculoDaCoordenacao }) {
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-cartao border-2 border-borda bg-superficie p-4">
      <div className="min-w-0">
        <p className="font-semibold break-words text-tinta">{vinculo.turma.nome}</p>
        <p className="text-sm break-words text-apoio">{vinculo.disciplina?.nome ?? 'Sem disciplina'}</p>
      </div>
      <div>
        <SeloDoVinculo estado={vinculo.estado} />
      </div>
      {vinculo.estado === 'contestado' && vinculo.contestacao !== undefined && <p className="text-sm break-words text-erro">Motivo: {NOME_DA_CONTESTACAO[vinculo.contestacao]}</p>}
      {vinculo.estado === 'contestado' && vinculo.complemento !== undefined && <p className="text-sm break-words text-apoio">Explicação do professor: “{vinculo.complemento}”</p>}
      {vinculo.motivoEncerramento !== undefined && <p className="text-sm break-words text-apoio">Motivo: {MOTIVO_DO_ENCERRAMENTO[vinculo.motivoEncerramento]}</p>}
    </li>
  )
}

interface Props {
  readonly professor: ProfessorDaEscola
  readonly aoFechar: () => void
  readonly aoRefazer: () => void
  readonly aoRevogar: () => void
  /** Abre o diálogo "Acrescentar turma" deste professor. */
  readonly aoAcrescentar: () => void
  /** O anúncio da ação que terminou: "Convite de … revogado.", "Alocação feita: …". Mora aqui, onde a pessoa está, e não na página atrás do painel. */
  readonly anuncio: string
  /** O título da seção da situação, para onde o foco vai quando o botão que abriu um diálogo saiu do rodapé (o "Revogar" do convite revogado). */
  readonly tituloDaSituacao: RefObject<HTMLHeadingElement | null>
  /** O título da seção das turmas, para onde o foco vai quando o "Acrescentar turma" saiu do rodapé (o convite venceu com o diálogo aberto). */
  readonly tituloDasTurmas: RefObject<HTMLHeadingElement | null>
  /** Para onde o foco vai ao fechar quando quem abriu o painel já saiu da página. */
  readonly focoDeReserva: () => void
}

/**
 * O painel do professor (X2, 6.0 e 7.0; RF13, RF14; `?professor=<usuarioId>`): o nome no título, a situação do convite em texto,
 * as turmas dele e, no rodapé, **só as ações que o estado permite** — as matrizes de `@educa/shared`, as mesmas do servidor
 * (`acoesDoConviteDeProfessor`) — e "Acrescentar turma" para quem pode receber turma (`professorAlocavel`). Quem não pode vê por quê,
 * na seção das turmas. Estado sem ação nenhuma (o revogado, o desativado) não tem rodapé. Cadastrar não é daqui: é da tela, e cadastra
 * outra pessoa.
 *
 * **As turmas são o vínculo que a escola criou e o que o professor respondeu a ele** (regra 60, item 8a; regra 70, itens 8 e 9; D45,
 * D64): um item por vínculo — o pendente, o confirmado, o contestado e o encerrado —, nunca uso nem desempenho. Elas são do ano
 * letivo em curso, lidas aqui (a mesma chave da tela). A seção espera as leituras de que depende (os anos, os vínculos e, para quem
 * recebe turma, as turmas e as disciplinas da escola) e só então diz "Nenhuma turma" ou o que falta criar: ler menos que isso
 * mandaria criar o que a escola já tem. As turmas e as disciplinas só são lidas para quem pode receber turma.
 *
 * **Nada de e-mail** (regra 20, itens 2 e 4; E11): a lista de professores não o traz e o painel não o pede. O link do convite nunca
 * mora aqui: ele vive só no diálogo que o pediu, e o painel não o guarda nem o repete (regra 20, item 8). O complemento da contestação
 * é texto do professor para a coordenação (`docs/lgpd.md`): é mostrado como texto, aqui, e não vai a log nem a endereço. Os diálogos
 * de refazer, de revogar e de acrescentar são os da tela, abertos por cima do painel, que fica onde está.
 */
export function PainelDoProfessor({ professor, aoFechar, aoRefazer, aoRevogar, aoAcrescentar, anuncio, tituloDaSituacao, tituloDasTurmas, focoDeReserva }: Props) {
  const acoes = acoesDoConviteDeProfessor(professor.estado)
  const idDaSituacao = useId()
  const idDasTurmas = useId()
  const alocavel = professorAlocavel(professor.estado)

  const anos = useQuery(consultaAnosLetivos)
  const anoEmCurso = anos.data?.itens.some((ano) => ano.situacao === 'em_curso') === true
  // Vínculos, turmas e disciplinas são do ano em curso: sem ele a API responde como inexistente, e a tela nem pergunta.
  const vinculos = useQuery({ ...consultaVinculos, enabled: anoEmCurso })
  const turmas = useQuery({ ...consultaTurmas, enabled: anoEmCurso && alocavel })
  const disciplinas = useQuery({ ...consultaDisciplinas, enabled: anoEmCurso && alocavel })
  const consultas = [anos, ...(anoEmCurso ? [vinculos, ...(alocavel ? [turmas, disciplinas] : [])] : [])]
  const falhou = consultas.find((consulta) => consulta.isError)

  // O que falta criar antes de acrescentar, só com as duas listas lidas. O professor existe e recebe turma: ele conta como um.
  const faltam =
    anoEmCurso && alocavel && turmas.data !== undefined && disciplinas.data !== undefined
      ? oQueFaltaParaAlocar({ turmas: turmas.data.itens.length, disciplinas: disciplinas.data.itens.length, professores: 1 })
      : undefined
  const podeAcrescentar = faltam !== undefined && faltam.length === 0

  function turmasDoProfessor(): ReactNode {
    if (falhou !== undefined)
      return (
        <EstadoErro
          erro={falhou.error}
          tentando={consultas.some((consulta) => consulta.isFetching)}
          aoTentarDeNovo={() => {
            for (const consulta of consultas) if (consulta.isError) void consulta.refetch({ cancelRefetch: false })
          }}
        />
      )
    if (anos.data === undefined) return <EstadoCarregando rotulo="Carregando as turmas…" />
    if (!anoEmCurso) return <p className="text-apoio">As turmas são do ano letivo em curso. Abra o ano letivo na tela Turmas.</p>
    if (vinculos.data === undefined || (alocavel && (turmas.data === undefined || disciplinas.data === undefined))) return <EstadoCarregando rotulo="Carregando as turmas…" />
    const dele = vinculosDoProfessor(vinculos.data.itens, professor.usuarioId)
    const motivoDeNaoAcrescentar = porQueNaoRecebeTurma(professor.estado)
    return (
      <>
        {dele.length === 0 ? (
          vinculos.data.completa && <p className="text-apoio">Nenhuma turma.</p>
        ) : (
          <ul className="flex flex-col gap-3" aria-label="Turmas do professor">
            {dele.map((vinculo) => (
              <TurmaDoProfessor key={vinculo.id} vinculo={vinculo} />
            ))}
          </ul>
        )}
        <AvisoDeListaIncompleta completa={vinculos.data.completa} />
        {alocavel && dele.some((vinculo) => vinculo.estado === 'contestado') && <p className="text-sm text-apoio">Para corrigir uma turma contestada, acrescente a turma certa.</p>}
        {motivoDeNaoAcrescentar !== undefined && <p className="text-apoio">{motivoDeNaoAcrescentar}</p>}
        {faltam !== undefined && faltam.length > 0 && <EstadoVazio titulo={tituloDoQueFalta(faltam)} descricao={descricaoDoQueFalta(faltam)} />}
      </>
    )
  }

  return (
    <PainelLado
      titulo={professor.nome}
      aoFechar={aoFechar}
      focoDeReserva={focoDeReserva}
      rodape={
        acoes.length === 0 && !podeAcrescentar ? undefined : (
          <>
            {acoes.map((acao) =>
              acao === 'refazer' ? (
                <Botao key={acao} variante="secundario" onClick={aoRefazer}>
                  Refazer convite
                </Botao>
              ) : (
                <Botao key={acao} variante="perigo" onClick={aoRevogar}>
                  Revogar convite
                </Botao>
              ),
            )}
            {podeAcrescentar && (
              <Botao variante="secundario" onClick={aoAcrescentar}>
                Acrescentar turma
              </Botao>
            )}
          </>
        )
      }
    >
      <div className="flex min-w-0 flex-col gap-4">
        <section aria-labelledby={idDaSituacao} className="flex min-w-0 flex-col gap-2">
          <h3 ref={tituloDaSituacao} id={idDaSituacao} tabIndex={-1} className="t-selo text-sutil">
            Situação do convite
          </h3>
          <div>
            <Estado familia={FAMILIA_DO_ESTADO_DO_PROFESSOR[professor.estado]}>{TEXTO_DO_ESTADO_DO_PROFESSOR[professor.estado]}</Estado>
          </div>
        </section>
        <section aria-labelledby={idDasTurmas} className="flex min-w-0 flex-col gap-3">
          <h3 ref={tituloDasTurmas} id={idDasTurmas} tabIndex={-1} className="t-selo text-sutil">
            Turmas
          </h3>
          {turmasDoProfessor()}
        </section>
        <Anuncio texto={anuncio} />
      </div>
    </PainelLado>
  )
}
