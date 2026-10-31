import type { EstadoDeVinculo, VinculoDaCoordenacao } from '@educa/shared'
import { useQuery } from '@tanstack/react-query'
import { useId, type ReactNode } from 'react'
import { useLocation } from 'wouter'
import { consultaVinculos } from '../../../api/estrutura'
import { consultaProfessores } from '../professores/api/professores'
import { caminhoDoProfessor, ROTAS_DA_COORDENACAO } from '../../../paths'
import { EstadoCarregando, EstadoErro, EstadoVazio } from '../../../components/states/index'
import { Linha } from '../../../components/ui/Linha'
import { Estado } from '../../../components/ui/SeloDeEstado'
import { ordenarPeloNome, ordenarVinculos } from '../comum/ordem'
import { AvisoDeListaIncompleta } from '../comum/pecas-da-lista'

/**
 * O estado do vínculo como a coordenação o lê, em texto (regra 50, item 11), e a família do selo: quem decide agora é o
 * professor, e a contestação é a que pede ação da escola. O painel do professor (`PainelDoProfessor.tsx`) diz o mesmo com palavras mais curtas.
 */
const SELO_DO_VINCULO = {
  pendente: { familia: 'pendente', texto: 'Esperando o professor confirmar' },
  confirmado: { familia: 'ok', texto: 'Confirmado pelo professor' },
  contestado: { familia: 'erro', texto: 'Contestado pelo professor' },
  encerrado: { familia: 'info', texto: 'Encerrado' },
} as const satisfies Readonly<Record<EstadoDeVinculo, { readonly familia: 'pendente' | 'ok' | 'erro' | 'info'; readonly texto: string }>>

function SeloDoVinculo({ estado }: { readonly estado: EstadoDeVinculo }) {
  const { familia, texto } = SELO_DO_VINCULO[estado]
  return familia === 'pendente' ? <Estado familia="pendente">{texto}</Estado> : <Estado familia={familia}>{texto}</Estado>
}

/**
 * Os professores da turma aberta (X2, 9.0; RF16): um item por vínculo, com o nome, a disciplina e o estado do vínculo, e o
 * link para o painel do professor. O professor com duas disciplinas na turma aparece duas vezes, uma por disciplina.
 *
 * - **Nenhuma leitura auditada.** Os vínculos e os professores são as consultas da Estrutura (`consultaVinculos` e
 *   `consultaProfessores`), que não levam finalidade: a lista de nomes e os pedidos, que levam, são das outras seções.
 * - **Nome e id, nada mais do professor.** O complemento da contestação é só do painel dele (Tech Spec, seção 7), e o
 *   endereço do link leva só o id (`caminhoDoProfessor`).
 * - **Nada indica uso.** O que aparece é o vínculo que a escola criou e o que o professor respondeu a ele (D45, D64).
 * - **Sem leitura inteira, sem "Nenhum professor nesta turma"**: a lista de vínculos que bateu no teto de páginas pode não
 *   trazer o desta turma, e a tela diz que mostra só o começo em vez de afirmar que não há ninguém.
 */
export function ProfessoresDaTurma({ turmaId }: { turmaId: string }) {
  const idDoTitulo = useId()
  const [, navegar] = useLocation()
  const vinculos = useQuery(consultaVinculos)
  const professores = useQuery(consultaProfessores)

  const cabecalho = (
    <h2 id={idDoTitulo} className="text-lg font-semibold text-tinta">
      Professores da turma
    </h2>
  )
  const secao = (conteudo: ReactNode) => (
    <section aria-labelledby={idDoTitulo} className="flex min-w-0 flex-col gap-3">
      {cabecalho}
      {conteudo}
    </section>
  )

  if (vinculos.data === undefined || professores.data === undefined) {
    // A tela espera as duas leituras: a que falhou diz o erro, e "Tentar de novo" relê só ela, sem tocar na outra. Durante a releitura
    // a consulta sem dado volta a "pendente", então a tela diz "Carregando…" até a resposta: não há "tentando" a mostrar no erro.
    const falhas = [vinculos, professores].filter((consulta) => consulta.isError)
    const primeira = falhas[0]
    return secao(
      primeira === undefined ? (
        <EstadoCarregando rotulo="Carregando os professores da turma…" />
      ) : (
        <EstadoErro erro={primeira.error} aoTentarDeNovo={() => falhas.forEach((consulta) => void consulta.refetch({ cancelRefetch: false }))} />
      ),
    )
  }

  const nomes = new Map(professores.data.itens.map((professor) => [professor.usuarioId, professor.nome]))
  const nomeDe = (vinculo: VinculoDaCoordenacao): string => nomes.get(vinculo.usuarioId) ?? 'Nome não carregado'
  // Pelo professor, e dentro dele pela disciplina: as duas disciplinas do mesmo professor ficam juntas. A segunda ordenação é
  // estável, então ela mantém a ordem por disciplina que a primeira deu.
  const daTurma = ordenarPeloNome(
    ordenarVinculos(
      vinculos.data.itens.filter((vinculo) => vinculo.papel === 'professor' && vinculo.turma.id === turmaId),
      nomeDe,
    ).map((vinculo) => ({ nome: nomeDe(vinculo), vinculo })),
  )

  return secao(
    <>
      {daTurma.length === 0 ? (
        vinculos.data.completa && (
          <EstadoVazio
            titulo="Nenhum professor nesta turma"
            descricao="O professor aparece aqui quando a escola o aloca na turma, e o estado diz se ele já confirmou."
            acao={{ rotulo: 'Ver os professores', aoAcionar: () => navegar(ROTAS_DA_COORDENACAO.professores) }}
          />
        )
      ) : (
        <ul className="divide-y-2 divide-borda overflow-hidden rounded-cartao border-2 border-borda">
          {daTurma.map(({ nome, vinculo }) => (
            <li key={vinculo.id}>
              <Linha
                para={caminhoDoProfessor(vinculo.usuarioId)}
                titulo={nome}
                abaixo={
                  // O estado desce para baixo da disciplina em vez de ir ao `fim` da linha: a coluna tem 19 rem, e o `fim` da
                  // `Linha` (que fica ao lado do texto a partir de 640 px) tomaria a largura toda e espremeria o nome.
                  <span className="flex flex-col items-start gap-1">
                    <span>{vinculo.disciplina?.nome ?? 'Sem disciplina'}</span>
                    <SeloDoVinculo estado={vinculo.estado} />
                  </span>
                }
              />
            </li>
          ))}
        </ul>
      )}
      <AvisoDeListaIncompleta completa={vinculos.data.completa} />
    </>,
  )
}
