import type { Ferramenta } from '@educa/shared'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useLocation } from 'wouter'
import { consultaArtefato, consultaArtefatos } from '../artefatos/api/artefatos'
import { emCurso } from '../../../api/ciclo-de-execucao'
import { useCicloDeExecucao } from '../../../api/execucoes'
import { consultaTime, funcaoSuspensa } from '../assistente/api/time'
import { consultaMeusVinculos } from '../comum/api/vinculos'
import { caminhoDaFerramentaDoProfessor, ROTAS_DO_PROFESSOR } from '../../../paths'
import { EstadoCarregando, EstadoErro, EstadoVazio } from '../../../components/states/index'
import { QueueAlert } from '../../../components/ui/ai/QueueAlert'
import type { OpcaoDoCampo, ValoresValidados } from '../../../components/ui/ai/schema-form'
import { SchemaForm } from '../../../components/ui/ai/SchemaForm'
import type { HeadingLevel } from '../../../components/ui/Page'
import { AvisoDeSuspensao, FalhaDoPedido } from '../comum/avisos'
import { descricaoDaFerramenta, ferramentaDoCatalogo, montarPedido, type IniciaisDaFerramenta } from './ferramentas'
import { IconeDeFerramenta } from './icones-de-ferramenta'
import { CICLO_DA_FERRAMENTA, enviarPedidoDeFerramenta } from '../assistente/memoria-do-professor'
import { ResultadoDaFerramenta } from './ResultadoDaFerramenta'
import { nomesDasTurmas, turmasDaProfessora } from '../comum/turmas-da-professora'

interface PropsDoCartao {
  readonly ferramenta: Ferramenta
  /** O que o cartão já sabe do pedido: a turma da caixa, o tema que o Assistente entendeu, a atividade de onde se veio. */
  readonly iniciais?: IniciaisDaFerramenta
  /** Com ele, o formulário ganha o "Cancelar", do mesmo tamanho do botão que gera (D59). */
  readonly aoCancelar?: () => void
  /** O nível do título do formulário, para a ordem dos títulos da tela não pular. Sem ele, 3. */
  readonly nivel?: HeadingLevel
  /** O ícone ilustrado da ferramenta, de 32 px, antes do nome: o cabeçalho do cartão da conversa. O formulário de Ferramentas já tem o nome no `h1`, e fica sem. */
  readonly comIcone?: boolean
}

/**
 * **A ferramenta, num motor só** (D18; P23): o formulário de Ferramentas e o cartão dentro da conversa são esta mesma
 * peça, com os campos de `ferramentas.ts`, o mesmo pedido e o mesmo ciclo de execução. A geração em curso mora na
 * memória da aba, por ferramenta: quem saiu do cartão no meio da geração a encontra no formulário, e vice-versa.
 *
 * Os estados: carregando o que os campos precisam (as turmas dela; na Adaptação, as atividades); erro; vazio, que diz o
 * que falta e leva até lá; a função suspensa pela escola, que explica; e o motor, com o formulário, a geração e o
 * resultado.
 */
export function CartaoDeFerramenta({ ferramenta, iniciais, aoCancelar, nivel = 3, comIcone = false }: PropsDoCartao) {
  const item = ferramentaDoCatalogo(ferramenta)
  const adaptacao = ferramenta === 'adaptacao'
  const [, navegar] = useLocation()
  const vinculos = useInfiniteQuery(consultaMeusVinculos)
  const artefatos = useInfiniteQuery({ ...consultaArtefatos(), enabled: adaptacao })
  // A atividade de onde se veio ("Pedir versão adaptada") pode não estar na primeira página do que já foi gerado.
  const origem = useQuery({ ...consultaArtefato(iniciais?.origem ?? ''), enabled: adaptacao && iniciais?.origem !== undefined })
  const time = useQuery(consultaTime)
  const { ciclo, demorando, iniciar, repetir, limpar } = useCicloDeExecucao(CICLO_DA_FERRAMENTA[ferramenta], enviarPedidoDeFerramenta)
  const [problema, definirProblema] = useState<string | undefined>(undefined)

  if (funcaoSuspensa(time.data, item.funcao)) return <AvisoDeSuspensao funcao={item.funcao} />

  const falha = vinculos.isError ? vinculos : adaptacao && artefatos.isError ? artefatos : undefined
  if (falha !== undefined) return <EstadoErro erro={falha.error} tentando={falha.isFetching} aoTentarDeNovo={() => void falha.refetch({ cancelRefetch: false })} />
  if (vinculos.data === undefined || (adaptacao && (artefatos.isPending || (iniciais?.origem !== undefined && origem.isPending)))) return <EstadoCarregando rotulo="Carregando a ferramenta…" />

  const itensDosVinculos = vinculos.data.pages.flatMap((pagina) => pagina.itens)
  const turmas = turmasDaProfessora(itensDosVinculos)
  const nomes = nomesDasTurmas(itensDosVinculos)
  const gerados = [...(origem.data === undefined ? [] : [origem.data]), ...(artefatos.data?.pages.flatMap((pagina) => pagina.itens) ?? [])]
  const atividades: OpcaoDoCampo[] = []
  for (const artefato of gerados) {
    // Só a atividade objetiva que não é versão adaptada se adapta (o contrato recusa as outras).
    if (artefato.tipo !== 'atividade_objetiva' || artefato.origemId !== null || atividades.some((opcao) => opcao.valor === artefato.id)) continue
    const turma = nomes[artefato.turmaId]
    atividades.push({ valor: artefato.id, rotulo: turma === undefined ? artefato.titulo : `${artefato.titulo} · ${turma}` })
  }

  if (!adaptacao && turmas.length === 0)
    return (
      <EstadoVazio
        titulo="Falta uma turma confirmada"
        descricao="A ferramenta gera a partir do material de uma turma e de uma disciplina suas. Confirme as suas turmas em Turmas; se nenhuma aparece lá, quem aloca é a coordenação."
        acao={{ rotulo: 'Ir para Turmas', aoAcionar: () => navegar(ROTAS_DO_PROFESSOR.turmas) }}
      />
    )
  if (adaptacao && atividades.length === 0)
    return (
      <EstadoVazio
        titulo="Ainda não há atividade para adaptar"
        descricao="A Adaptação parte de uma atividade objetiva que você já gerou. Gere a atividade primeiro; depois escolha aqui o tipo de adaptação."
        acao={{ rotulo: 'Gerar uma atividade', aoAcionar: () => navegar(caminhoDaFerramentaDoProfessor('atividade_objetiva')) }}
      />
    )

  const descricao = descricaoDaFerramenta(ferramenta, { turmas: turmas.map((turma) => ({ valor: turma.valor, rotulo: turma.rotulo })), atividades, ...(iniciais === undefined ? {} : { iniciais }) })

  function aoGerar(valores: ValoresValidados): void {
    const montado = montarPedido(ferramenta, valores)
    if (!montado.ok) {
      definirProblema(montado.problema)
      return
    }
    definirProblema(undefined)
    // O estado muda aqui, na hora: `iniciar` grava o pedido como enviado antes de devolver, e o segundo toque não manda outro.
    iniciar(montado.pedido)
  }

  const gerando = emCurso(ciclo)
  const concluida = ciclo?.etapa === 'concluida' ? ciclo : undefined
  const artefatoGerado = concluida?.resultado.tipo === 'artefato' ? concluida.resultado : undefined
  const estado = gerando ? 'gerando' : artefatoGerado !== undefined ? 'pronto' : 'formulario'

  return (
    <div data-cartao-de-ferramenta={ferramenta} className="flex min-w-0 flex-col gap-3">
      <SchemaForm descricao={descricao} estado={estado} nivel={nivel} aoGerar={aoGerar} aoEditar={limpar} {...(comIcone ? { icone: <IconeDeFerramenta ferramenta={ferramenta} tamanho={32} /> } : {})} {...(aoCancelar === undefined ? {} : { aoCancelar })} {...(problema === undefined ? {} : { falha: problema })}>
        {artefatoGerado !== undefined && <ResultadoDaFerramenta artefatoId={artefatoGerado.artefatoId} entregaId={artefatoGerado.entregaId} funcao={item.funcao} />}
      </SchemaForm>
      {/* Para quem não vê a tela: a troca de "Gerando…" pelo resultado é dita uma vez, com calma. */}
      <span role="status" data-anuncio-do-resultado="" className="sr-only">
        {estado === 'pronto' ? `${descricao.nome}: geração concluída. O resultado está logo abaixo do pedido.` : ''}
      </span>
      {gerando && demorando && <QueueAlert situacao="demora" />}
      {ciclo?.etapa === 'falhou' && <FalhaDoPedido erro={ciclo.erro} funcao={item.funcao} aoTentarDeNovo={repetir} />}
    </div>
  )
}
