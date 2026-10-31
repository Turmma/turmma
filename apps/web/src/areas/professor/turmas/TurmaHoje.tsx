import type { Sinal } from '@educa/shared'
import { useQuery } from '@tanstack/react-query'
import { ChartNoAxesColumn, ChevronRight, HeartHandshake } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { useLocation, useSearch } from 'wouter'
import { consultaAtividadesAplicadas, consultaDesempenhoDaTurma } from '../atividades/api/atividades'
import { mensagemDoErro } from '../../../api/client'
import { agenteDoTime, consultaTime } from '../assistente/api/time'
import { consultaTitulosDosMateriais } from '../artefatos/api/titulos-dos-materiais'
import { consultaSinais, consultaUsoDoTutor } from './api/tutor-da-turma'
import { BarraRotulada } from '../../../components/ui/BarraRotulada'
import { Botao } from '../../../components/ui/Botao'
import { EstadoCarregando, EstadoErro, EstadoVazio } from '../../../components/states/index'
import { AssinaturaIA } from '../../../components/ui/ai/AssinaturaIA'
import { Conversa, MensagemIA } from '../../../components/ui/ai/Message'
import { PainelLado } from '../../../components/ui/overlays/PainelLado'
import { Estado } from '../../../components/ui/SeloDeEstado'
import { Tabela } from '../../../components/ui/Tabela'
import { CabecalhoDeSecao } from '../../../components/ui/Tela'
import { formatarDiaEHora } from '../../../format'
import { textoDeAlunos } from '../atividades/aprovar'
import { turmaIndisponivel } from './acesso/acesso-da-turma'
import { enderecoComOPainelDoTutor, painelDoTutorPedido } from './endereco-da-turma'
import {
  emQueEstava,
  falaDoGrupo,
  horaDoUltimoAviso,
  porNome,
  QUANDO_O_TUTOR_AVISA,
  separarSinais,
  textoDaAtencaoHumana,
  textoDaHoraDoAviso,
  textoDoSinal,
  tituloDaAtencaoHumana,
  trocasDeHoje,
} from './sinais'

/** De quanto em quanto os sinais são relidos, com a aba à vista: não há WebSocket nesta fatia. */
const INTERVALO_DOS_SINAIS_MS = 15_000

type SinalDeAtencao = Extract<Sinal, { tipo: 'atencao_humana' }>
type SinalDeTrabalho = Exclude<Sinal, { tipo: 'atencao_humana' }>

/**
 * A aba Hoje da turma aberta (`docs/interface.md` 11.1; D8, D34, D36, D46, D47; regra 20, item 14; regra 50, item 10;
 * regra 70, itens 4 e 7): o que o Tutor viu no uso da turma e o acerto por habilidade. É a aba que a professora **projeta em
 * sala**, e por isso nada nela diz o nome de um aluno: **sinal, não conversa**.
 *
 * - **A atenção humana** (D36) vem no alto, sem abrir painel: quantos alunos precisam de um adulto, a hora do aviso mais
 *   recente e o que fazer, **sem nome e sem o que foi dito**. O nome só aparece por ação explícita, "Ver quem".
 * - **Os sinais da turma** são a soma ("8 alunos travaram na questão 3"), sem nome de ninguém.
 * - **O painel "O que o Tutor viu"** (`?ver=tutor`) é onde o nome chega: a atenção humana, os sinais por aluno e o uso do Tutor
 *   por aluno, em ordem de nome. Os sinais por aluno saem da mesma leitura que Hoje já fez, e só o uso espera o painel; com o
 *   painel fechado, nenhum nome vai à tela, e o uso sai da memória (`gcTime: 0`). Nada aqui abre a conversa de um aluno, e não
 *   há tempo parado, ordem por recência nem lista de quem não usou.
 * - **Os sinais são relidos aos 15 s, só com esta aba à vista.** A aba que sai da tela desmonta esta leitura, e a janela
 *   escondida a pausa (`refetchIntervalInBackground: false`). O aviso que chega entra sem piscar, sem som e sem mover o foco,
 *   em `aria-live="polite"` (D59).
 * - **O 404 da releitura** (o vínculo encerrado com a aba aberta) tira a página da turma, como a aba Alunos faz.
 * - **O acerto por habilidade** é só de lotes aprovados. As barras são neutras: nenhuma fica vermelha, e o número está no
 *   texto (D46, D69).
 */
export default function TurmaHoje({ turmaId, aoPerderATurma }: { turmaId: string; aoPerderATurma: () => void }) {
  const [caminho, navegar] = useLocation()
  const busca = useSearch()
  const painelAberto = painelDoTutorPedido(busca)
  const sinais = useQuery({ ...consultaSinais(turmaId), refetchInterval: INTERVALO_DOS_SINAIS_MS, refetchIntervalInBackground: false })
  const desempenho = useQuery(consultaDesempenhoDaTurma(turmaId))
  const atividades = useQuery(consultaAtividadesAplicadas(turmaId))
  const time = useQuery(consultaTime)
  const idDosSinais = useId()
  const idDasHabilidades = useId()
  const botaoDoPainel = useRef<HTMLButtonElement>(null)

  const { atencao, trabalho } = separarSinais(sinais.data?.itens ?? [])
  // O título e o texto no plural quando há mais de um aluno: os sinais repetidos de um aluno contam uma vez.
  const alunosQuePrecisam = new Set(atencao.map((sinal) => sinal.aluno.id)).size
  const horaDoAviso = horaDoUltimoAviso(atencao)
  const grupos = sinais.data?.grupos ?? []
  const titulosDasAtividades = Object.fromEntries((atividades.data?.itens ?? []).map((atividade) => [atividade.id, atividade.titulo]))
  const tutor = agenteDoTime(time.data, 'tutor')
  const dados = desempenho.data
  // A releitura dos sinais deixou de achar a turma (o vínculo encerrado com a tela aberta): vale como a releitura da turma que deixa de
  // achá-la, e a página sai inteira, com os nomes que o painel "Ver quem" tinha aberto (regra 20, item 18). Só o 404 vale: rede e servidor
  // com o dado na tela não desmontam nada.
  const semATurma = turmaIndisponivel(sinais.error)
  useEffect(() => {
    if (semATurma) aoPerderATurma()
  }, [semATurma, aoPerderATurma])
  // As duas leituras da aba caíram juntas: um erro só, e "Tentar de novo" lê as duas (um botão principal por tela).
  const caiuTudo = sinais.isError && sinais.data === undefined && desempenho.isError && dados === undefined

  const abrirOPainel = (): void => navegar(enderecoComOPainelDoTutor(caminho, busca, true))
  const fecharOPainel = (): void => navegar(enderecoComOPainelDoTutor(caminho, busca, false), { replace: true })

  // O painel aberto pelo endereço (recarregar, ou o Voltar do histórico) não tem botão que o tenha aberto, e o "Ver quem" pode ter
  // saído da tela com o painel aberto (o aviso resolvido): o foco devolvido a "quem abriu" cai no `body`. Ao fechar, se ele está
  // no `body`, vai ao botão do painel, e não se perde.
  useEffect(() => {
    const botao = botaoDoPainel.current
    return () => {
      if (document.activeElement === document.body) botao?.focus()
    }
  }, [painelAberto])

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* A região existe sempre: o aviso que entra depois, nela, é anunciado sem tirar o foco de onde ele está. */}
      <div aria-live="polite">
        {alunosQuePrecisam > 0 && (
          <section data-atencao-humana="" aria-label={tituloDaAtencaoHumana(alunosQuePrecisam)} className="flex min-w-0 flex-col gap-2 rounded-cartao border border-pendente bg-pendente-cx p-4">
            <h2 className="flex min-w-0 items-center gap-2 text-base font-semibold text-pendente">
              <HeartHandshake aria-hidden="true" size={18} strokeWidth={1.75} className="shrink-0" />
              {tituloDaAtencaoHumana(alunosQuePrecisam)}
            </h2>
            {horaDoAviso !== undefined && <p className="min-w-0 text-sm break-words text-tinta">{textoDaHoraDoAviso(horaDoAviso)}</p>}
            <p className="min-w-0 text-sm break-words text-tinta">{textoDaAtencaoHumana(alunosQuePrecisam)}</p>
            <div>
              <Botao variante="secundario" onClick={abrirOPainel}>
                Ver quem
              </Botao>
            </div>
          </section>
        )}
      </div>

      <section aria-labelledby={idDosSinais} className="flex min-w-0 flex-col gap-3">
        <CabecalhoDeSecao
          id={idDosSinais}
          titulo="Sinais da turma"
          apoio="O que o Tutor viu no trabalho dos alunos: onde travaram, quem pediu a resposta pronta, a dúvida que se repetiu."
          acao={
            <Botao ref={botaoDoPainel} variante="secundario" onClick={abrirOPainel}>
              Ver o uso do Tutor por aluno
            </Botao>
          }
        />
        {sinais.isPending && <EstadoCarregando rotulo="Carregando os sinais…" />}
        {sinais.isError && sinais.data === undefined && (
          <EstadoErro
            erro={sinais.error}
            tentando={sinais.isFetching || desempenho.isFetching}
            aoTentarDeNovo={() => {
              void sinais.refetch({ cancelRefetch: false })
              if (desempenho.isError) void desempenho.refetch({ cancelRefetch: false })
            }}
          />
        )}
        {/* Sem sinal nenhum a tela não fica vazia: diz o que o Tutor avisa e quando (regra 50, item 6). */}
        {sinais.data !== undefined && grupos.length === 0 && trabalho.length === 0 && (
          <EstadoVazio
            titulo="Nenhum sinal desta turma ainda"
            descricao="Quando um aluno travar numa questão, pedir a resposta pronta ou repetir a mesma dúvida, o Tutor avisa aqui, com a questão ou a página. Ele conduz por perguntas e não entrega a resposta."
          />
        )}
        {/* Os sinais de trabalho são de qualquer data, e o agrupado é só dos últimos 7 dias: sem grupo e com sinal antigo a seção diz isso, e não fica em branco. */}
        {sinais.data !== undefined && grupos.length === 0 && trabalho.length > 0 && (
          <p className="min-w-0 text-sm break-words text-sutil">
            Nenhum sinal agrupado da turma nos últimos 7 dias. Os sinais mais antigos, por aluno, estão em “Ver o uso do Tutor por aluno”.
          </p>
        )}
        {grupos.length > 0 && (
          <Conversa rotulo="O que o Tutor viu na turma">
            {grupos.map((grupo, indice) => (
              // O grupo é a soma da turma, sem nome de ninguém: é o que a professora leva para a aula seguinte.
              <MensagemIA key={`${grupo.tipo}-${grupo.atividadeAplicadaId ?? ''}-${String(grupo.questao ?? '')}-${String(indice)}`} variante="balao" funcao="sinais_para_o_professor">
                {falaDoGrupo(grupo, { atividades: titulosDasAtividades, materiais: {} })}
              </MensagemIA>
            ))}
          </Conversa>
        )}
        {sinais.data?.proxima !== undefined && <p className="text-sm text-sutil">Estes são os sinais mais recentes da turma.</p>}
      </section>

      <section aria-label="O que o Tutor faz sozinho" className="flex min-w-0 flex-col gap-2">
        <AssinaturaIA agente="tutor" tamanho={32} />
        <details className="group min-w-0 rounded-cartao border border-linha bg-superficie">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 px-4 text-sm font-medium text-tinta hover:bg-realce-suave">
            <ChevronRight aria-hidden="true" size={16} strokeWidth={1.75} className="shrink-0 group-open:rotate-90" />
            O que o Tutor faz sozinho, e o que você vê aqui
          </summary>
          <div className="flex min-w-0 flex-col gap-3 border-t border-linha p-4">
            {time.isPending && <p className="text-apoio">Carregando as funções…</p>}
            {time.isError && (
              <div className="flex min-w-0 flex-wrap items-center gap-3 text-erro">
                <p role="alert" className="min-w-0 break-words">
                  {mensagemDoErro(time.error)}
                </p>
                <Botao variante="secundario" onClick={() => void time.refetch({ cancelRefetch: false })}>
                  Tentar de novo
                </Botao>
              </div>
            )}
            {tutor?.funcoes.map((funcao) => (
              <div key={funcao.chave} data-funcao={funcao.chave} className="flex min-w-0 flex-col gap-1">
                <p className="flex min-w-0 flex-wrap items-center gap-2 font-medium text-tinta">
                  {funcao.nome}
                  {funcao.suspensa && <Estado familia="info">Suspensa pela coordenação</Estado>}
                </p>
                <p className="min-w-0 text-sm break-words text-apoio">
                  <span className="font-medium">Faz sozinha: </span>
                  {funcao.fazSozinha}
                </p>
                <p className="min-w-0 text-sm break-words text-apoio">
                  <span className="font-medium">Com você: </span>
                  {funcao.esperaAprovacao}
                </p>
              </div>
            ))}
            <div className="flex min-w-0 flex-col gap-1">
              <p className="font-medium text-tinta">Quando o Tutor avisa você</p>
              <ul className="flex min-w-0 list-disc flex-col gap-1 pl-5 text-sm text-apoio">
                {QUANDO_O_TUTOR_AVISA.map((quando) => (
                  <li key={quando} className="break-words">
                    {quando}
                  </li>
                ))}
              </ul>
            </div>
            <p className="min-w-0 text-sm break-words text-sutil">Você vê aqui os sinais e o uso da turma na sua disciplina. A conversa de um aluno com o Tutor não abre nesta tela.</p>
          </div>
        </details>
      </section>

      <section aria-labelledby={idDasHabilidades} className="flex min-w-0 flex-col gap-3">
        <CabecalhoDeSecao id={idDasHabilidades} titulo="Acerto por habilidade" apoio="Só das correções que você já aprovou, na sua disciplina." />
        {desempenho.isPending && <EstadoCarregando rotulo="Carregando o desempenho da turma…" />}
        {desempenho.isError && dados === undefined && !caiuTudo && (
          <EstadoErro erro={desempenho.error} tentando={desempenho.isFetching} aoTentarDeNovo={() => void desempenho.refetch({ cancelRefetch: false })} />
        )}
        {caiuTudo && <p className="text-sm break-words text-sutil">Também não foi possível carregar o acerto por habilidade. “Tentar de novo”, acima, lê os dois.</p>}
        {dados !== undefined && dados.lotesAprovados === 0 && (
          <EstadoVazio
            variante="tracejado"
            icone={ChartNoAxesColumn}
            titulo="Ainda não há correção aprovada nesta turma"
            descricao="O acerto por habilidade aparece aqui depois que você aprovar a correção de uma atividade aplicada à turma. Correção que ainda espera você não entra na conta."
          />
        )}
        {dados !== undefined && dados.lotesAprovados > 0 && (
          <div className="flex min-w-0 flex-col gap-3 rounded-cartao border border-linha bg-superficie p-4">
            {dados.porHabilidade.map((item) => (
              <BarraRotulada
                key={item.habilidade.codigo}
                rotulo={`${item.habilidade.codigo} · ${item.habilidade.descricao}`}
                valor={item.acertos}
                maximo={item.total}
                texto={`${String(item.acertos)} de ${String(item.total)}`}
                // De onde vem o número: a metade é o limiar provisório (os limiares são decisão em aberto), e a tela diz qual é.
                detalhe={
                  item.alunosAbaixoDaMetade === 0
                    ? 'Nenhum aluno acertou menos da metade das questões desta habilidade nas atividades aprovadas.'
                    : `${textoDeAlunos(item.alunosAbaixoDaMetade)} ${item.alunosAbaixoDaMetade === 1 ? 'acertou' : 'acertaram'} menos da metade das questões desta habilidade nas atividades aprovadas.`
                }
              />
            ))}
          </div>
        )}
      </section>

      {painelAberto && (
        <PainelDoTutor
          turmaId={turmaId}
          lendoOsSinais={sinais.isPending}
          falhouOsSinais={sinais.isError && sinais.data === undefined}
          atencao={atencao}
          alunosQuePrecisam={alunosQuePrecisam}
          trabalho={trabalho}
          titulosDasAtividades={titulosDasAtividades}
          aoFechar={fecharOPainel}
        />
      )}
    </div>
  )
}

interface PropsDoPainel {
  readonly turmaId: string
  readonly lendoOsSinais: boolean
  readonly falhouOsSinais: boolean
  readonly atencao: readonly SinalDeAtencao[]
  /** A contagem que o aviso de Hoje mostra: o painel diz o mesmo número, da mesma conta. */
  readonly alunosQuePrecisam: number
  readonly trabalho: readonly SinalDeTrabalho[]
  readonly titulosDasAtividades: Readonly<Record<string, string>>
  readonly aoFechar: () => void
}

/**
 * O painel "O que o Tutor viu" (`?ver=tutor`): o único lugar de Hoje em que o nome do aluno chega à tela, e só depois de
 * "Ver quem" ou "Ver o uso do Tutor por aluno" (D34, D36). Começa pela atenção humana, sem o que foi dito, e segue com os sinais
 * e o uso por aluno, **em ordem de nome** (D69: não é ranking nem recência).
 *
 * A leitura do uso é daqui: com o painel fechado ela não existe, e a que existia sai da memória com o painel (`gcTime: 0`).
 * Nenhuma linha, botão ou link leva à conversa de um aluno com o Tutor.
 */
function PainelDoTutor({ turmaId, lendoOsSinais, falhouOsSinais, atencao, alunosQuePrecisam, trabalho, titulosDasAtividades, aoFechar }: PropsDoPainel) {
  const uso = useQuery(consultaUsoDoTutor(turmaId))
  const materiais = useQuery(consultaTitulosDosMateriais)
  const idDaDescricao = useId()
  const idDosSinais = useId()
  const idDoUso = useId()
  const referencias = { atividades: titulosDasAtividades, materiais: materiais.data ?? {} }

  return (
    <PainelLado titulo="O que o Tutor viu" aoFechar={aoFechar} descritoPor={idDaDescricao}>
      <div className="flex min-w-0 flex-col gap-6">
        <p id={idDaDescricao} className="min-w-0 text-sm break-words text-apoio">
          Os nomes aparecem só aqui, para você, em ordem de nome. O que foi dito ao Tutor não aparece, e nada abre a conversa de um aluno.
        </p>

        {atencao.length > 0 && (
          <section aria-label="Alunos que precisam de um adulto" className="flex min-w-0 flex-col gap-2 rounded-cartao border border-pendente bg-pendente-cx p-4">
            <h3 className="flex min-w-0 items-center gap-2 text-base font-semibold text-pendente">
              <HeartHandshake aria-hidden="true" size={18} strokeWidth={1.75} className="shrink-0" />
              {tituloDaAtencaoHumana(alunosQuePrecisam)}
            </h3>
            <ul className="flex min-w-0 flex-col gap-1 text-tinta">
              {porNome(atencao, (sinal) => sinal.aluno.nome).map((sinal) => (
                <li key={sinal.id} className="break-words">
                  <span className="font-medium">{sinal.aluno.nome}</span> · {formatarDiaEHora(sinal.criadoEm)}
                </li>
              ))}
            </ul>
            <p className="min-w-0 text-sm break-words text-tinta">{textoDaAtencaoHumana(alunosQuePrecisam)}</p>
          </section>
        )}

        <section aria-labelledby={idDosSinais} className="flex min-w-0 flex-col gap-3">
          <CabecalhoDeSecao id={idDosSinais} nivel={3} titulo="Sinais por aluno" />
          {lendoOsSinais && <EstadoCarregando rotulo="Carregando os sinais…" />}
          {falhouOsSinais && <p className="text-sm break-words text-sutil">Não foi possível carregar os sinais. “Tentar de novo”, na tela, lê de novo.</p>}
          {!lendoOsSinais && !falhouOsSinais && trabalho.length === 0 && <p className="text-sm break-words text-sutil">Nenhum sinal de trabalho por aluno agora.</p>}
          {trabalho.length > 0 && (
            <Tabela
              rotulo="Sinais por aluno"
              colunas={[
                { chave: 'aluno', titulo: 'Aluno', celula: (sinal) => sinal.aluno.nome },
                { chave: 'sinal', titulo: 'O que aconteceu', celula: (sinal) => textoDoSinal(sinal, referencias) },
                { chave: 'quando', titulo: 'Quando', celula: (sinal) => formatarDiaEHora(sinal.criadoEm) },
              ]}
              linhas={porNome(trabalho, (sinal) => sinal.aluno.nome)}
              chaveDaLinha={(sinal) => sinal.id}
            />
          )}
        </section>

        <section aria-labelledby={idDoUso} className="flex min-w-0 flex-col gap-3">
          <CabecalhoDeSecao id={idDoUso} nivel={3} titulo="Uso do Tutor pela turma" apoio="Quem já conversou com o Tutor neste ano, em ordem de nome. Não há uso do Tutor que você não veja." />
          {uso.isPending && <EstadoCarregando rotulo="Carregando o uso do Tutor…" />}
          {uso.isError && uso.data === undefined && <EstadoErro erro={uso.error} tentando={uso.isFetching} aoTentarDeNovo={() => void uso.refetch({ cancelRefetch: false })} />}
          {uso.data !== undefined && (
            <>
              {uso.data.pacoteDaTurmaNoMes > 0 && (
                <div className="rounded-cartao border border-linha bg-superficie p-4">
                  <BarraRotulada
                    rotulo="Trocas da turma neste mês"
                    valor={uso.data.trocasDaTurmaNoMes}
                    maximo={uso.data.pacoteDaTurmaNoMes}
                    texto={`${String(uso.data.trocasDaTurmaNoMes)} de ${String(uso.data.pacoteDaTurmaNoMes)}`}
                    detalhe={`Cada aluno pode fazer até ${String(uso.data.limiteDoDia)} trocas por dia.`}
                  />
                </div>
              )}
              {uso.data.alunos.length === 0 ? (
                <EstadoVazio titulo="Nenhum aluno desta turma usou o Tutor ainda" descricao="Quando um aluno conversar com o Tutor, ele aparece aqui com as trocas de hoje e em que estava. O conteúdo da conversa não aparece." />
              ) : (
                <Tabela
                  rotulo="Uso do Tutor por aluno"
                  colunas={[
                    { chave: 'aluno', titulo: 'Aluno', celula: (aluno) => aluno.aluno.nome },
                    { chave: 'hoje', titulo: 'Trocas hoje', celula: (aluno) => trocasDeHoje(aluno, uso.data.limiteDoDia) },
                    // A hora, como hora ("05/10, 10h42"): nunca "há X minutos", que viraria relógio de tempo parado.
                    { chave: 'ultima', titulo: 'Última troca', celula: (aluno) => formatarDiaEHora(aluno.ultimaTrocaEm) },
                    { chave: 'onde', titulo: 'Em que estava', celula: (aluno) => emQueEstava(aluno, referencias) },
                  ]}
                  linhas={porNome(uso.data.alunos, (aluno) => aluno.aluno.nome)}
                  chaveDaLinha={(aluno) => aluno.aluno.id}
                />
              )}
            </>
          )}
        </section>
      </div>
    </PainelLado>
  )
}
