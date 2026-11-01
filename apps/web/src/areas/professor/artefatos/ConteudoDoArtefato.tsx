import type { Citacao, ConteudoDoArtefato as Conteudo, ConteudoDeAtividade, ConteudoDePlanoDeAula } from '@educa/shared'
import { Check } from 'lucide-react'
import { CitationChip } from '../../../components/ui/ai/CitationChip'
import { Sources } from '../../../components/ui/ai/Sources'
import { PageThumbnail } from '../../../components/ui/ai/PageThumbnail'
import type { TitulosDosMateriais } from '../../../components/ui/ai/source-labels'

/** A letra de cada alternativa, pelo índice que o contrato usa (0 a 3). */
const LETRAS = ['a', 'b', 'c', 'd'] as const

/** As citações de um artefato, na ordem em que aparecem: as das questões, ou as do plano. */
export function citacoesDoConteudo(conteudo: Conteudo): readonly Citacao[] {
  return conteudo.tipo === 'atividade_objetiva' ? conteudo.questoes.map((questao) => questao.citacao) : conteudo.citacoes
}

interface PropsDoConteudo {
  readonly conteudo: Conteudo
  readonly materiais: TitulosDosMateriais
  /**
   * `resumido` é o que cabe na resposta dentro da conversa: os enunciados com a página de cada um, ou os objetivos e as
   * etapas do plano. O artefato aberto mostra tudo: alternativas, gabarito, explicação e a miniatura da página.
   */
  readonly resumido?: boolean
  /**
   * O gabarito à vista (o padrão): a alternativa certa marcada, em texto e em cor, e a explicação, que o diz por extenso.
   * O interruptor "Gabarito" do documento aberto o desliga para a professora projetar ou imprimir a atividade sem a resposta
   * (telas do professor, 6.0). Só muda o que se vê: o conteúdo é o mesmo, e a página de origem de cada questão fica.
   */
  readonly comGabarito?: boolean
}

function Atividade({ conteudo, materiais, resumido, comGabarito }: { conteudo: ConteudoDeAtividade; materiais: TitulosDosMateriais; resumido: boolean; comGabarito: boolean }) {
  return (
    <ol className="flex min-w-0 flex-col gap-4">
      {conteudo.questoes.map((questao, indice) => (
        // A posição é a identidade da questão: o contrato a numera pela posição (`docs/mvp-contratos.md`, seção 2).
        <li key={indice} className={`flex min-w-0 flex-col gap-3 ${resumido ? '' : 'rounded-cartao border border-linha bg-superficie p-4 lg:p-5'}`}>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <p className="min-w-0 break-words whitespace-pre-wrap text-tinta">
                <span className="font-semibold">{indice + 1}. </span>
                {questao.enunciado} <CitationChip citacao={questao.citacao} materiais={materiais} />
              </p>
              {!resumido && (
                <>
                  <ol className="flex min-w-0 flex-col gap-1.5">
                    {questao.alternativas.map((alternativa, posicao) => {
                      const certa = comGabarito && posicao === questao.gabarito
                      return (
                        <li key={posicao} className={`flex min-w-0 items-start gap-2 rounded-linha px-2.5 py-1.5 ${certa ? 'bg-ok-cx text-ok' : 'text-apoio'}`}>
                          <span className="shrink-0 font-medium">{LETRAS[posicao] ?? String(posicao + 1)})</span>
                          <span className="min-w-0 flex-1 break-words">{alternativa}</span>
                          {/* O gabarito é dito em texto e em ícone, e não só pela cor (regra 50, item 11). */}
                          {certa && (
                            <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium">
                              <Check aria-hidden="true" size={14} strokeWidth={2.4} />
                              Gabarito
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ol>
                  {comGabarito && (
                    <p className="min-w-0 text-sm break-words text-apoio">
                      <span className="font-medium text-tinta">Explicação: </span>
                      {questao.explicacao}
                    </p>
                  )}
                  <p className="min-w-0 text-sm break-words text-sutil">
                    <span className="font-medium">Habilidade {questao.habilidade.codigo}: </span>
                    {questao.habilidade.descricao}
                  </p>
                </>
              )}
            </div>
            {!resumido && <PageThumbnail citacao={questao.citacao} materiais={materiais} />}
          </div>
        </li>
      ))}
    </ol>
  )
}

function Plano({ conteudo, materiais, resumido }: { conteudo: ConteudoDePlanoDeAula; materiais: TitulosDosMateriais; resumido: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="text-sm text-sutil">Duração: {conteudo.duracaoMinutos} min</p>
      <section className="flex min-w-0 flex-col gap-1.5">
        <h3 className="text-base font-semibold text-tinta">Objetivos</h3>
        <ul className="flex min-w-0 list-disc flex-col gap-1 pl-5 text-apoio">
          {conteudo.objetivos.map((objetivo, indice) => (
            <li key={indice} className="break-words">
              {objetivo}
            </li>
          ))}
        </ul>
      </section>
      <section className="flex min-w-0 flex-col gap-2">
        <h3 className="text-base font-semibold text-tinta">Etapas</h3>
        <ol className="flex min-w-0 flex-col gap-3">
          {conteudo.etapas.map((etapa, indice) => (
            <li key={indice} className="flex min-w-0 flex-col gap-1">
              <p className="min-w-0 break-words text-tinta">
                <span className="font-medium">
                  {indice + 1}. {etapa.titulo}
                </span>{' '}
                <span className="text-sm text-sutil">· {etapa.minutos} min</span>
              </p>
              {!resumido && (
                <p className="min-w-0 break-words whitespace-pre-wrap text-apoio">
                  {etapa.descricao}
                  {etapa.citacao !== undefined && (
                    <>
                      {' '}
                      <CitationChip citacao={etapa.citacao} materiais={materiais} />
                    </>
                  )}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>
      {!resumido && (
        <>
          <section className="flex min-w-0 flex-col gap-1.5">
            <h3 className="text-base font-semibold text-tinta">Como avaliar</h3>
            <p className="min-w-0 break-words whitespace-pre-wrap text-apoio">{conteudo.avaliacao}</p>
          </section>
          <section className="flex min-w-0 flex-col gap-1.5">
            <h3 className="text-base font-semibold text-tinta">Habilidades</h3>
            <ul className="flex min-w-0 flex-col gap-1 text-sm text-sutil">
              {conteudo.habilidades.map((habilidade) => (
                <li key={habilidade.codigo} className="break-words">
                  <span className="font-medium">{habilidade.codigo}: </span>
                  {habilidade.descricao}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}

/**
 * O que o Assistente gerou, como a professora o lê: a atividade (questões, alternativas, gabarito e explicação, que são
 * dela e nunca do aluno) ou o plano de aula. **Toda questão e toda etapa dizem de que página saíram** (D6): o chip no
 * texto, a miniatura ao lado e a lista de fontes no fim.
 *
 * O texto do modelo entra como texto, com as quebras de linha dele, e nunca como HTML. A assinatura da IA é de quem usa
 * a peça: o artefato aberto e a resposta da conversa a põem em cima.
 */
export function ConteudoDoArtefato({ conteudo, materiais, resumido = false, comGabarito = true }: PropsDoConteudo) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {conteudo.tipo === 'atividade_objetiva' ? <Atividade conteudo={conteudo} materiais={materiais} resumido={resumido} comGabarito={comGabarito} /> : <Plano conteudo={conteudo} materiais={materiais} resumido={resumido} />}
      <Sources citacoes={citacoesDoConteudo(conteudo)} materiais={materiais} />
    </div>
  )
}
