import type { ChaveDeFuncao } from '@educa/shared'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'wouter'
import { consultaArtefato } from '../artefatos/api/artefatos'
import { consultaTitulosDosMateriais } from '../artefatos/api/titulos-dos-materiais'
import { caminhoDoArtefatoDoProfessor, ROTAS_DO_PROFESSOR } from '../../../paths'
import { classesDoBotao } from '../../../components/ui/button-variants'
import { EstadoCarregando, EstadoErro } from '../../../components/states/index'
import { MensagemIA } from '../../../components/ui/ai/Message'
import { ConteudoDoArtefato } from '../artefatos/ConteudoDoArtefato'
import { saidaEmPdf, textoDaAdaptacao } from '../artefatos/entregas'
import { ExportarPdf } from '../artefatos/ExportarPdf'

interface PropsDoResultado {
  readonly artefatoId: string
  /** A entrega que nasceu com o artefato: só a versão adaptada tem, e ela nasce pendente. */
  readonly entregaId: string | null
  /** A função do Assistente que gerou: é ela que assina. */
  readonly funcao: ChaveDeFuncao
}

const CLASSES_DA_ACAO = `${classesDoBotao({ variante: 'discreto', tamanho: 'compacto' })} hover:bg-realce-suave hover:text-tinta`

/**
 * O que a ferramenta gerou, como resposta do Assistente (`docs/interface.md` 11.3): a **assinatura da IA**, o conteúdo
 * com a página de cada questão, as fontes e as ações, **sempre visíveis** (abrir o artefato, exportar em PDF). É a mesma
 * resposta no cartão dentro da conversa e no formulário de Ferramentas.
 *
 * A versão adaptada nasce **pendente** e diz isso aqui mesmo, com o caminho para decidir: ela não vai a aluno nenhum
 * antes da aprovação registrada (regra 70, item 3).
 */
export function ResultadoDaFerramenta({ artefatoId, entregaId, funcao }: PropsDoResultado) {
  const artefato = useQuery(consultaArtefato(artefatoId))
  const materiais = useQuery(consultaTitulosDosMateriais)
  if (artefato.isPending) return <EstadoCarregando rotulo="Carregando o que foi gerado…" />
  if (artefato.isError) return <EstadoErro erro={artefato.error} tentando={artefato.isFetching} aoTentarDeNovo={() => void artefato.refetch({ cancelRefetch: false })} />
  const { data } = artefato
  return (
    <MensagemIA
      funcao={funcao}
      // A entrega recém-nascida é sempre pendente: a aprovação só existe depois da decisão, em “O que o Assistente fez”.
      {...(entregaId === null ? {} : { aprovacao: { aprovacao: { estado: 'pendente' as const } } })}
      acoes={
        <>
          {/* Relativo à área: o `Route` aninhado em `/professor` resolve o `to` a partir da base dela. */}
          <Link to={caminhoDoArtefatoDoProfessor(data.id)} className={CLASSES_DA_ACAO}>
            Abrir o artefato
          </Link>
          {/* A versão adaptada recém-gerada ainda espera a decisão: sai como rascunho, e o botão diz isso. */}
          {saidaEmPdf(data.entrega) !== 'nao_exporta' && <ExportarPdf artefatoId={data.id} titulo={data.titulo} rascunho={saidaEmPdf(data.entrega) === 'rascunho'} />}
          {entregaId !== null && (
            <Link to={ROTAS_DO_PROFESSOR.timeDoAssistente} className={CLASSES_DA_ACAO}>
              Ver e decidir
            </Link>
          )}
        </>
      }
    >
      <div className="flex min-w-0 flex-col gap-3">
        <p className="min-w-0 font-semibold break-words text-tinta">{data.titulo}</p>
        {data.adaptacao !== null && <p className="min-w-0 text-sm break-words text-sutil">Adaptação: {textoDaAdaptacao(data.adaptacao)}</p>}
        <ConteudoDoArtefato conteudo={data.conteudo} materiais={materiais.data ?? {}} resumido />
        {entregaId !== null && <p className="min-w-0 text-sm break-words text-sutil">Esta versão só pode ir aos alunos depois que você aprovar. Até lá, o PDF dela sai marcado como rascunho.</p>}
      </div>
    </MensagemIA>
  )
}
