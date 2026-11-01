import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useId } from 'react'
import { useLocation } from 'wouter'
import { timeQueryOptions, funcaoSuspensa } from '../assistente/api/time'
import { meusVinculosQueryOptions } from '../comum/api/vinculos'
import { caminhoDaFerramentaDoProfessor, PROFESSOR_ROUTES } from '../../../paths'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { ListItem } from '../../../components/ui/ListItem'
import { StatusBadge } from '../../../components/ui/StatusBadge'
import { SectionHeader, Page } from '../../../components/ui/Page'
import { usePageTitle } from '../../../document-title'
import { AvisoDeSuspensao } from '../comum/avisos'
import { CATALOGO_DE_FERRAMENTAS, catalogoPorCategoria } from './ferramentas'
import { IconeDeFerramenta } from './icones-de-ferramenta'
import { turmasDaProfessora } from '../comum/turmas-da-professora'

/** As funções que assinam alguma ferramenta do catálogo, uma vez cada: são as que a escola pode ter suspendido e que a tela explica. */
const FUNCOES_DO_CATALOGO = [...new Set(CATALOGO_DE_FERRAMENTAS.map((item) => item.funcao))]

/**
 * "Ferramentas" (D74, D80; telas do professor, 7.0; `docs/interface.md` 1.2 e 11.2): o catálogo, **uma seção por categoria da
 * D74 que tem ferramenta**, e em cada uma um cartão por ferramenta, com o ícone ilustrado de 48 px, o nome e o que ela entrega
 * em até três linhas. **Só existem as que o produto tem** (atividade objetiva, plano de aula e Adaptação): "Corrigir" não
 * aparece, e nenhum cartão desligado ou "em breve" ocupa o lugar do que não existe. Cada cartão abre o formulário da
 * ferramenta, que é o mesmo motor do cartão da conversa (D18). O que a professora já gerou mora em Criados (5.0).
 *
 * O catálogo é fixo e não lê a lista de gerados. As duas leituras que a tela faz só **avisam**, nunca tiram um cartão:
 * - o time, para dizer a função que a coordenação suspendeu (o selo no cartão e a frase da suspensão no alto). Se a leitura
 *   falha, os cartões ficam e um aviso diz que não foi possível conferir, com "Tentar de novo": quem recusa de verdade é o
 *   servidor, ao gerar;
 * - os vínculos, para dizer que falta uma turma confirmada e levar a Turmas. O formulário de cada ferramenta tem o vazio dele.
 *   **Se a leitura dos vínculos falha, a página fica em silêncio, de propósito**: nem aviso nem "Tentar de novo", e os cartões
 *   ficam. Ela só serve para avisar, e dizer "falta turma" sem saber seria afirmar o que a tela não leu (o teste prova).
 */
export default function Ferramentas() {
  usePageTitle('Ferramentas')
  const [, navegar] = useLocation()
  const idDoCatalogo = useId()
  const time = useQuery(timeQueryOptions)
  const vinculos = useInfiniteQuery(meusVinculosQueryOptions)

  const turmas = turmasDaProfessora(vinculos.data?.pages.flatMap((pagina) => pagina.itens) ?? [])
  // Falhou e ainda não há resposta. Não é `time.isError`: "Tentar de novo" põe a consulta de volta em `pending` enquanto lê, e o
  // aviso, com o botão que acabou de ser apertado, sumiria e voltaria (o foco se perderia no meio). Com a resposta, o aviso sai.
  const leituraDoTimeFalhou = time.data === undefined && time.errorUpdateCount > 0
  const suspensas = FUNCOES_DO_CATALOGO.filter((funcao) => funcaoSuspensa(time.data, funcao))

  return (
    <Page titulo="Ferramentas">
      <div className="flex min-w-0 flex-col gap-6">
        {leituraDoTimeFalhou && (
          <Alert
            tom="atencao"
            titulo="Não foi possível conferir se alguma ferramenta está suspensa"
            acao={
              <>
                <Button variante="secundario" tamanho="compacto" onClick={() => void time.refetch()} disabled={time.isFetching}>
                  Tentar de novo
                </Button>
                <span role="status" className="t-apoio text-sutil">
                  {time.isFetching ? 'Tentando de novo…' : ''}
                </span>
              </>
            }
          >
            Os cartões continuam abertos. Se a coordenação tiver suspendido uma ferramenta, o Assistente avisa na hora de gerar.
          </Alert>
        )}
        {suspensas.map((funcao) => (
          <AvisoDeSuspensao key={funcao} funcao={funcao} />
        ))}
        {vinculos.data !== undefined && turmas.length === 0 && (
          <Alert
            tom="info"
            titulo="Falta uma turma confirmada"
            acao={
              <Button variante="secundario" tamanho="compacto" onClick={() => navegar(PROFESSOR_ROUTES.turmas)}>
                Ir para Turmas
              </Button>
            }
          >
            As ferramentas trabalham a partir do material de uma turma e de uma disciplina suas. Confirme as suas turmas em Turmas; se nenhuma aparece lá, quem aloca é a coordenação.
          </Alert>
        )}

        {catalogoPorCategoria().map((categoria) => (
          <section key={categoria.id} aria-labelledby={`${idDoCatalogo}-${categoria.id}`} className="flex min-w-0 flex-col gap-3">
            <SectionHeader id={`${idDoCatalogo}-${categoria.id}`} titulo={categoria.nome} />
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {categoria.ferramentas.map((item) => (
                // O cartão é a moldura da `ListItem`: o alvo é a linha inteira (um `<a>`), e a moldura só a desenha. 108 px no mínimo, todos iguais na fileira.
                <li key={item.ferramenta} data-ferramenta={item.ferramenta} className="min-w-0 overflow-hidden rounded-cartao border-2 border-borda bg-superficie [&>a]:h-full [&>a]:min-h-[108px]">
                  <ListItem
                    // Relativo à área: o `Route` aninhado em `/professor` resolve o `to` a partir da base dela.
                    para={caminhoDaFerramentaDoProfessor(item.ferramenta)}
                    titulo={item.nome}
                    inicio={<IconeDeFerramenta ferramenta={item.ferramenta} tamanho={48} />}
                    abaixo={
                      <>
                        <span title={item.descricao} className="line-clamp-3">
                          {item.descricao}
                        </span>
                        {/* Embaixo do texto, e não no `fim` da linha: a 768 px o cartão tem uns 340 px, e o selo ao lado deixaria o nome sem lugar. */}
                        {funcaoSuspensa(time.data, item.funcao) && (
                          <span className="mt-1 flex">
                            <StatusBadge familia="info">Suspensa pela coordenação</StatusBadge>
                          </span>
                        )}
                      </>
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Page>
  )
}
