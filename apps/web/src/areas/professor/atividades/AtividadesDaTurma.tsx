import type { AtividadeAplicada } from '@educa/shared'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation, useSearch } from 'wouter'
import { consultaAtividadesAplicadas } from './api/atividades'
import { consultaTurmaAberta } from '../../../api/estrutura'
import { caminhoDaCorrecaoDoProfessor, caminhoDoArtefatoDoProfessor, ROTAS_DO_PROFESSOR } from '../../../paths'
import { Button } from '../../../components/ui/Button'
import { SECONDARY_LINK_CLASSES } from '../../../components/ui/button-variants'
import { EstadoCarregando, EstadoErro, EstadoVazio } from '../../../components/states/index'
import { ListItem } from '../../../components/ui/ListItem'
import { Sheet } from '../../../components/ui/overlays/Sheet'
import { SegmentedControl } from '../../../components/ui/fields/SegmentedControl'
import { StatusBadge, type StatusFamily } from '../../../components/ui/StatusBadge'
import { textoDaFalha } from '../../../components/error-text'
import { SectionHeader } from '../../../components/ui/Page'
import { formatarDataHora } from '../../../format'
import { AVISO_DA_AVALIATIVA_ABERTA, semCorrecao, situacaoDaAplicacao, TEXTO_SEM_CORRECAO } from './aprovar'
import { useCorrigirDeNovo } from './corrigir-de-novo'
import { enderecoComFiltros } from '../artefatos/criados'
import { EncerramentoDaAtividade } from './EncerramentoDaAtividade'
import { IconeDeFerramenta } from '../ferramentas/icones-de-ferramenta'

/**
 * O estado de uma atividade aplicada, como a professora o lê: aberta, ou encerrada com a correção por revisar, aprovada,
 * rejeitada, ou sem correção (ninguém abriu a atividade, ou a coordenação suspendeu a função). Sai de `estado` e da entrega do
 * lote, e de mais nada: não há número de acerto aqui, e a lista não se ordena por ele (D46, D69).
 */
export type EstadoDaAtividade = 'aberta' | 'para_revisar' | 'aprovada' | 'rejeitada' | 'sem_correcao'

export function estadoDaAtividade(aplicada: Pick<AtividadeAplicada, 'estado' | 'entrega'>): EstadoDaAtividade {
  if (aplicada.estado === 'aberta') return 'aberta'
  if (aplicada.entrega === null) return 'sem_correcao'
  if (aplicada.entrega.estado === 'pendente') return 'para_revisar'
  return aplicada.entrega.estado === 'aprovada' ? 'aprovada' : 'rejeitada'
}

/** O selo de cada estado: o texto diz tudo, a família só repete (estado nunca é só cor). A correção por revisar é a que espera a professora. */
export const SELO_DA_ATIVIDADE: Readonly<Record<EstadoDaAtividade, { readonly familia: StatusFamily; readonly texto: string }>> = {
  aberta: { familia: 'info', texto: 'Aberta' },
  para_revisar: { familia: 'pendente', texto: 'Correção para revisar' },
  aprovada: { familia: 'ok', texto: 'Correção aprovada' },
  rejeitada: { familia: 'erro', texto: 'Correção rejeitada' },
  sem_correcao: { familia: 'info', texto: 'Sem correção' },
}

/** O que a professora faz com a atividade nesse estado, em texto: é a frase do painel, logo abaixo da situação. */
export function oQueFazer(aplicada: Pick<AtividadeAplicada, 'estado' | 'entrega' | 'participacao'>): string {
  const estado = estadoDaAtividade(aplicada)
  if (estado === 'aberta') return 'Os alunos estão respondendo. Quando a turma terminar, encerre a atividade: as respostas param e o Assistente corrige.'
  if (estado === 'para_revisar') return 'O Assistente corrigiu, e a correção espera você. Revise os destaques e aprove antes de os alunos verem o diagnóstico.'
  if (estado === 'aprovada') return 'Você aprovou a correção. O diagnóstico por habilidade já chegou aos alunos da turma.'
  return TEXTO_SEM_CORRECAO[semCorrecao(aplicada) ?? 'correcao_suspensa']
}

/** Os jeitos de ver a lista, quando ela é longa. "Para revisar" é a que tem correção esperando a professora. */
export const FILTROS_DAS_ATIVIDADES = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'abertas', rotulo: 'Abertas' },
  { valor: 'para_revisar', rotulo: 'Para revisar' },
  { valor: 'encerradas', rotulo: 'Encerradas' },
] as const
export type FiltroDasAtividades = (typeof FILTROS_DAS_ATIVIDADES)[number]['valor']

/** Com mais linhas que isto a lista ganha o filtro; com até isto, ela cabe na vista e o filtro só atrapalharia. */
export const LIMITE_PARA_FILTRAR = 8

export function passaNoFiltro(aplicada: Pick<AtividadeAplicada, 'estado' | 'entrega'>, filtro: FiltroDasAtividades): boolean {
  if (filtro === 'todas') return true
  if (filtro === 'abertas') return aplicada.estado === 'aberta'
  if (filtro === 'para_revisar') return estadoDaAtividade(aplicada) === 'para_revisar'
  return aplicada.estado === 'encerrada'
}

/** A mais nova primeiro, pelo instante em que foi aplicada; instante igual desempata pelo id, para a ordem não depender de quem a API devolveu antes. */
export function maisNovaPrimeiro<A extends Pick<AtividadeAplicada, 'id' | 'aplicadaEm'>>(aplicadas: readonly A[]): A[] {
  return [...aplicadas].sort((a, b) => Date.parse(b.aplicadaEm) - Date.parse(a.aplicadaEm) || b.id.localeCompare(a.id))
}

/** O painel da atividade mora no endereço, como o resto da turma aberta: recarregar e o Voltar do navegador devolvem o mesmo painel. */
export const PARAMETRO_DA_ATIVIDADE = 'atividade'

/** A atividade que o endereço pede para abrir ao lado. Só o id: nunca o título nem nome de aluno (regra 20, item 9). */
export function atividadeDoEndereco(busca: string): string | null {
  return new URLSearchParams(busca).get(PARAMETRO_DA_ATIVIDADE)
}

/** O endereço da aba com o painel posto (`id`) ou tirado (`null`), sem mexer nos outros parâmetros. */
export function enderecoComAAtividade(caminho: string, busca: string, id: string | null): string {
  const parametros = new URLSearchParams(busca)
  parametros.set('aba', 'atividades')
  if (id === null) parametros.delete(PARAMETRO_DA_ATIVIDADE)
  else parametros.set(PARAMETRO_DA_ATIVIDADE, id)
  return `${caminho}?${parametros.toString()}`
}

/** "Aplicar uma atividade" leva a Criados já filtrado pela turma e pelo tipo, só com ids e valor de lista fechada no endereço. */
export function enderecoParaAplicar(turmaId: string): string {
  return enderecoComFiltros(ROTAS_DO_PROFESSOR.criados, '', { turma: turmaId, tipo: 'atividade_objetiva' })
}

/**
 * A aba Atividades da turma aberta (`docs/interface.md` 11.1; telas do professor, 11.0; RF17, RF22; D46, D55, D69): as atividades
 * aplicadas à turma, **uma linha por atividade, a mais nova primeiro**, com o estado em texto e quantos enviaram. A linha inteira
 * abre o painel ao lado, que fica no endereço (`?atividade=<id>`) e traz o que fazer: abrir a atividade, revisar a correção,
 * corrigir de novo e encerrar.
 *
 * - **Atividade é só objetiva** (D55): não há "para corrigir", prazo nem a discursiva. A tela não diz nota, média, conceito nem
 *   pontuação, e nada ordena por acerto.
 * - **O painel só abre atividade desta turma.** O id que a lista não tem (de outra turma, de outra escola, inventado) não abre nada,
 *   e a lista segue: a tela não confirma que o id existe (regra 10, item 6).
 * - **Encerrar é a mesma peça do documento** (`EncerramentoDaAtividade`), com a mesma confirmação que diz o que acontece.
 * - **O filtro** só existe com mais de oito linhas, é desta aba (não vai ao endereço) e não fecha o painel aberto.
 * - **Trocar de turma recomeça a aba** (`key`): o filtro, o pedido de encerrar que ainda está no ar e o aviso da correção são da turma
 *   que a professora saiu, e a resposta que chega depois não toca a turma nova.
 */
export default function AtividadesDaTurma({ turmaId }: { turmaId: string }) {
  return <AbaDeAtividades key={turmaId} turmaId={turmaId} />
}

function AbaDeAtividades({ turmaId }: { turmaId: string }) {
  const [caminho, navegar] = useLocation()
  const busca = useSearch()
  const atividades = useQuery(consultaAtividadesAplicadas(turmaId))
  // A turma já foi lida pela moldura da página (a aba só existe com ela); aqui é leitura do cache, para o nome na confirmação.
  const turma = useQuery(consultaTurmaAberta(turmaId))
  const [filtro, definirFiltro] = useState<FiltroDasAtividades>('todas')
  const [pedidoDeFoco, definirPedidoDeFoco] = useState(0)
  const idDasAtividades = useId()
  const linhas = useRef(new Map<string, HTMLLIElement>())
  const filtroNaTela = useRef<HTMLDivElement>(null)

  const todas = maisNovaPrimeiro(atividades.data?.itens ?? [])
  const comFiltro = todas.length > LIMITE_PARA_FILTRAR
  // A lista que encolheu para o limite (a decisão de uma atividade não a encolhe, mas a releitura pode) volta a todas.
  const filtroEmUso = comFiltro ? filtro : 'todas'
  const visiveis = todas.filter((aplicada) => passaNoFiltro(aplicada, filtroEmUso))
  // O painel abre pela lista inteira, e não pela filtrada: o filtro não fecha o que a professora está lendo.
  const aberta = todas.find((aplicada) => aplicada.id === atividadeDoEndereco(busca))
  const idDoPainel = aberta?.id
  const lida = atividades.data !== undefined

  // O painel aberto pelo endereço (recarregar, ou o Voltar do histórico) não tem a linha que o tenha aberto: o foco devolvido a "quem
  // abriu" cai no `body`. Ao fechar, se ele está no `body`, vai à linha da atividade, e não se perde.
  useEffect(() => {
    if (idDoPainel === undefined) return
    const daLista = linhas.current
    return () => {
      if (document.activeElement === document.body) daLista.get(idDoPainel)?.querySelector('button')?.focus()
    }
  }, [idDoPainel])

  // "Limpar filtro" tira o vazio, e o botão que tinha o foco sai da tela: o foco vai ao filtro, que é onde a professora estava.
  useEffect(() => {
    if (pedidoDeFoco > 0) filtroNaTela.current?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]')?.focus()
  }, [pedidoDeFoco])

  const abrir = (id: string): void => navegar(enderecoComAAtividade(caminho, busca, id))
  const fechar = (): void => navegar(enderecoComAAtividade(caminho, busca, null), { replace: true })
  function limparOFiltro(): void {
    definirFiltro('todas')
    definirPedidoDeFoco((n) => n + 1)
  }

  return (
    <section aria-labelledby={idDasAtividades} className="flex min-w-0 flex-col gap-3">
      <SectionHeader
        id={idDasAtividades}
        titulo="Atividades da turma"
        // Sem atividade, a ação mora no vazio: um convite só, e não dois botões com o mesmo nome.
        {...(todas.length > 0
          ? {
              acao: (
                <Link to={enderecoParaAplicar(turmaId)} className={SECONDARY_LINK_CLASSES}>
                  Aplicar uma atividade
                </Link>
              ),
            }
          : {})}
      />
      {atividades.isPending && <EstadoCarregando rotulo="Carregando as atividades da turma…" />}
      {atividades.isError && !lida && <EstadoErro erro={atividades.error} tentando={atividades.isFetching} aoTentarDeNovo={() => void atividades.refetch({ cancelRefetch: false })} />}
      {lida && todas.length === 0 && (
        <EstadoVazio
          titulo="Nenhuma atividade aplicada a esta turma"
          descricao="Abra uma atividade objetiva em Criados e use “Aplicar à turma”, na aba “Na turma”. Ela aparece aqui, com quantos alunos já enviaram."
          acao={{ rotulo: 'Aplicar uma atividade', aoAcionar: () => navegar(enderecoParaAplicar(turmaId)) }}
        />
      )}
      {comFiltro && (
        <div ref={filtroNaTela}>
          <SegmentedControl rotulo="Filtrar as atividades" opcoes={FILTROS_DAS_ATIVIDADES} valor={filtroEmUso} aoMudar={definirFiltro} emDuasColunasNoCelular />
        </div>
      )}
      {todas.length > 0 && visiveis.length === 0 && (
        <EstadoVazio titulo="Nada com este filtro" descricao="Nenhuma atividade desta turma está nesta situação." acao={{ rotulo: 'Limpar filtro', aoAcionar: limparOFiltro }} />
      )}
      {visiveis.length > 0 && (
        <ul className="divide-y-2 divide-borda overflow-hidden rounded-cartao border-2 border-borda bg-superficie">
          {visiveis.map((aplicada) => {
            const selo = SELO_DA_ATIVIDADE[estadoDaAtividade(aplicada)]
            return (
              <li
                key={aplicada.id}
                ref={(elemento) => {
                  if (elemento === null) linhas.current.delete(aplicada.id)
                  else linhas.current.set(aplicada.id, elemento)
                }}
                data-atividade-aplicada={aplicada.estado}
                data-estado-da-atividade={estadoDaAtividade(aplicada)}
              >
                <ListItem
                  aoAcionar={() => abrir(aplicada.id)}
                  titulo={aplicada.titulo}
                  inicio={<IconeDeFerramenta ferramenta="atividade_objetiva" tamanho={40} />}
                  abaixo={situacaoDaAplicacao(aplicada)}
                  fim={<StatusBadge familia={selo.familia}>{selo.texto}</StatusBadge>}
                />
              </li>
            )
          })}
        </ul>
      )}
      {aberta !== undefined && <PainelDaAtividade aplicada={aberta} nomeDaTurma={turma.data?.nome ?? 'Turma da atividade'} turmaId={turmaId} aoFechar={fechar} />}
    </section>
  )
}

interface PropsDoPainel {
  readonly aplicada: AtividadeAplicada
  readonly nomeDaTurma: string
  readonly turmaId: string
  readonly aoFechar: () => void
}

/**
 * O painel da atividade (`?atividade=<id>`; folha de baixo a 360 px): a situação, o que fazer e as ações. Abrir a atividade, revisar
 * ou ver a correção são links; "Corrigir de novo" só existe quando a atividade encerrou sem correção que valha (a função suspensa, ou
 * o lote rejeitado); "Encerrar a atividade" só existe na aberta, e passa pela confirmação. **Aprovar a correção não é daqui**: a
 * aprovação é a tela de revisar (14.0), onde a professora abre cada destaque.
 */
function PainelDaAtividade({ aplicada, nomeDaTurma, turmaId, aoFechar }: PropsDoPainel) {
  const idDaDescricao = useId()
  const reserva = useRef<HTMLElement>(null)
  const { corrigirDeNovo, aviso, falha, corrigindo } = useCorrigirDeNovo(turmaId)
  const estado = estadoDaAtividade(aplicada)
  const selo = SELO_DA_ATIVIDADE[estado]
  const motivo = semCorrecao(aplicada)

  // Encerrar e corrigir de novo mudam o estado e tiram do painel o botão que tinha o foco. O diálogo de encerrar fecha antes ou depois da
  // releitura, conforme a ordem das duas atualizações, e o foco pode voltar ao botão que está saindo: se ele acabou no corpo da página, vai
  // ao bloco "O que fazer", que continua ali (regra 50, item 11). Só na mudança: ao abrir o painel o foco é do miolo, e não se mexe.
  const estadoAnterior = useRef(estado)
  useEffect(() => {
    if (estadoAnterior.current === estado) return
    estadoAnterior.current = estado
    if (document.activeElement === document.body) reserva.current?.focus()
  }, [estado])

  return (
    <Sheet
      titulo={aplicada.titulo}
      aoFechar={aoFechar}
      descritoPor={idDaDescricao}
      focoDeReserva={() => reserva.current?.focus()}
      rodape={
        <>
          {/* Relativos à área: o `Route` aninhado em `/professor` resolve o `to` a partir da base dela. */}
          <Link to={caminhoDoArtefatoDoProfessor(aplicada.artefatoId)} className={SECONDARY_LINK_CLASSES}>
            Abrir a atividade
          </Link>
          {aplicada.entrega !== null && (
            <Link to={caminhoDaCorrecaoDoProfessor(aplicada.id)} className={SECONDARY_LINK_CLASSES}>
              {aplicada.entrega.estado === 'pendente' ? 'Revisar a correção' : 'Ver a correção'}
            </Link>
          )}
          {/* Encerrada sem lote que valha (função suspensa, ou lote rejeitado): encerrar de novo corrige de novo. */}
          {(motivo === 'correcao_suspensa' || motivo === 'lote_rejeitado') && (
            <Button variante="secundario" disabled={corrigindo !== undefined} onClick={() => corrigirDeNovo(aplicada)}>
              {corrigindo === aplicada.id ? 'Corrigindo…' : 'Corrigir de novo'}
            </Button>
          )}
          <EncerramentoDaAtividade aplicada={aplicada} nomeDaTurma={nomeDaTurma} focoDeReserva={() => reserva.current?.focus()} />
        </>
      }
    >
      <div className="flex min-w-0 flex-col gap-4">
        <p id={idDaDescricao} className="min-w-0 text-sm break-words text-apoio">
          Situação da atividade e o que fazer agora.
        </p>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <StatusBadge familia={selo.familia}>{selo.texto}</StatusBadge>
        </div>
        <p className="min-w-0 font-medium break-words text-tinta">{situacaoDaAplicacao(aplicada)}</p>
        <p className="min-w-0 text-sm break-words text-sutil">
          {nomeDaTurma} · aplicada em {formatarDataHora(aplicada.aplicadaEm)}
          {aplicada.encerradaEm !== null && ` · encerrada em ${formatarDataHora(aplicada.encerradaEm)}`}
        </p>
        {aplicada.avaliativa && aplicada.estado === 'aberta' && <p className="min-w-0 rounded-controle bg-info-cx p-3 break-words text-info">{AVISO_DA_AVALIATIVA_ABERTA}</p>}
        <section ref={reserva} tabIndex={-1} aria-label="O que fazer" className="flex min-w-0 flex-col gap-3 rounded-cartao outline-offset-4">
          <p data-o-que-fazer={estado} className="min-w-0 break-words text-tinta">
            {oQueFazer(aplicada)}
          </p>
          <p role="status" className="min-w-0 rounded-controle bg-info-cx p-3 break-words text-info empty:hidden">
            {aviso}
          </p>
          {falha !== undefined && (
            <p role="alert" className="min-w-0 rounded-controle bg-erro-cx p-3 break-words text-erro">
              {textoDaFalha(falha)}
            </p>
          )}
        </section>
      </div>
    </Sheet>
  )
}
