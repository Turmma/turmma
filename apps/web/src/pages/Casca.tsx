import type { Aviso, SystemComponent, SystemStatusResponse } from '@educa/shared'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { avisosQueryOptions, estadoQueryOptions } from '../api/sistema'
import { LoadingState, ErrorState, EmptyState } from '../components/states'
import { Logo } from '../components/ui/Logo'
import { formatDate, formatDateTime, formatQuantity } from '../format'

const NOME_DO_COMPONENTE: Record<SystemComponent['nome'], string> = { api: 'API', banco: 'Banco de dados' }
const NOME_DO_AMBIENTE: Record<SystemStatusResponse['ambiente'], string> = { local: 'Local', staging: 'Homologação', producao: 'Produção' }

/**
 * Busca de novo sem cancelar a busca em andamento: em rede lenta, toques repetidos em "Tentar de novo"
 * reiniciariam a busca a cada toque, e a resposta nunca chegaria.
 */
function buscarDeNovo(consulta: UseQueryResult): void {
  void consulta.refetch({ cancelRefetch: false })
}

/**
 * Quando o erro some porque o dado chegou, o botão "Tentar de novo" some junto, e o foco cairia no `body`.
 * Leva o foco para o título da seção, para quem usa teclado ou leitor de tela continuar de onde estava.
 */
function useFocoAoRecuperar(consulta: UseQueryResult, titulo: RefObject<HTMLHeadingElement | null>): void {
  const estavaComErro = useRef(false)
  const comErro = consulta.isError
  useEffect(() => {
    if (estavaComErro.current && !comErro && (document.activeElement === null || document.activeElement === document.body)) {
      titulo.current?.focus()
    }
    estavaComErro.current = comErro
  }, [comErro, titulo])
}

function Secao({ titulo, id, refTitulo, children }: { titulo: string; id: string; refTitulo: RefObject<HTMLHeadingElement | null>; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <h2 id={id} ref={refTitulo} tabIndex={-1} className="text-lg font-semibold text-tinta">
        {titulo}
      </h2>
      {children}
    </section>
  )
}

function Estado({ estado }: { estado: SystemStatusResponse }) {
  return (
    <div className="rounded-cartao border border-linha bg-superficie p-4">
      <p className="text-apoio">
        Versão <span className="font-medium break-all text-tinta">{estado.versao}</span> · Ambiente{' '}
        <span className="font-medium text-tinta">{NOME_DO_AMBIENTE[estado.ambiente]}</span>
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {estado.componentes.map((componente) => (
          <li key={componente.nome} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="font-medium text-tinta">{NOME_DO_COMPONENTE[componente.nome]}</span>
            {/* A situação é texto, não só cor. */}
            <span className={componente.situacao === 'disponivel' ? 'text-ok' : 'text-erro'}>
              {componente.situacao === 'disponivel' ? 'Disponível' : 'Indisponível'}
            </span>
            <span className="w-full text-sm text-sutil">Verificado em {formatDateTime(componente.verificadoEm)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Avisos({ itens }: { itens: Aviso[] }) {
  return (
    <div className="rounded-cartao border border-linha bg-superficie p-4">
      <p className="text-sm text-sutil">{formatQuantity(itens.length, 'aviso', 'avisos')}</p>
      <ul className="mt-2 flex flex-col gap-3">
        {itens.map((aviso) => (
          <li key={aviso.id}>
            <p className="break-words text-tinta">{aviso.texto}</p>
            <p className="text-sm text-sutil">Publicado em {formatDate(aviso.publicadoEm)}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Os quatro estados de uma consulta. Com dado já na tela, uma falha passageira na rede da escola não o apaga:
 * o dado fica, com o erro e o "Tentar de novo" acima dele.
 */
function ConteudoDaConsulta<T>({
  consulta,
  carregando,
  vazio,
  comDado,
}: {
  consulta: UseQueryResult<T>
  carregando: string
  vazio: (dado: T) => ReactNode | null
  comDado: (dado: T) => ReactNode
}) {
  if (consulta.isPending) return <LoadingState rotulo={carregando} />
  const erro = consulta.isError ? (
    <ErrorState erro={consulta.error} tentando={consulta.isFetching} aoTentarDeNovo={() => buscarDeNovo(consulta)} />
  ) : null
  if (consulta.data === undefined) return erro
  return (
    <>
      {erro}
      {vazio(consulta.data) ?? comDado(consulta.data)}
    </>
  )
}

/**
 * Casca da web do F0: busca o estado do sistema e os avisos na API e mostra os quatro estados de cada um.
 * Coluna única a partir de 360 px, duas colunas em tela larga (D51).
 */
export function Casca() {
  const estado = useQuery(estadoQueryOptions)
  const avisos = useQuery(avisosQueryOptions)
  const tituloComponentes = useRef<HTMLHeadingElement>(null)
  const tituloAvisos = useRef<HTMLHeadingElement>(null)
  useFocoAoRecuperar(estado, tituloComponentes)
  useFocoAoRecuperar(avisos, tituloAvisos)

  return (
    <div className="min-h-screen bg-fundo text-tinta">
      <header className="border-b border-linha bg-fundo">
        <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6">
          <Logo />
        </div>
      </header>
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
        <h1 className="text-xl font-semibold sm:text-2xl">Estado do sistema</h1>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Secao titulo="Componentes" id="titulo-componentes" refTitulo={tituloComponentes}>
            <ConteudoDaConsulta
              consulta={estado}
              carregando="Carregando o estado do sistema…"
              vazio={(dado) =>
                dado.componentes.length === 0 ? (
                  <EmptyState
                    titulo="Nenhum componente informado"
                    descricao="A API respondeu sem a situação dos componentes. Verifique de novo em instantes."
                    acao={{ rotulo: 'Verificar de novo', aoAcionar: () => buscarDeNovo(estado), emAndamento: estado.isFetching && !estado.isError }}
                  />
                ) : null
              }
              comDado={(dado) => <Estado estado={dado} />}
            />
          </Secao>
          <Secao titulo="Avisos" id="titulo-avisos" refTitulo={tituloAvisos}>
            <ConteudoDaConsulta
              consulta={avisos}
              carregando="Carregando os avisos…"
              vazio={(dado) =>
                dado.itens.length === 0 ? (
                  <EmptyState
                    titulo="Nenhum aviso por enquanto"
                    descricao="Manutenção e atualização do sistema são avisadas aqui. Verifique de novo quando quiser."
                    acao={{ rotulo: 'Verificar de novo', aoAcionar: () => buscarDeNovo(avisos), emAndamento: avisos.isFetching && !avisos.isError }}
                  />
                ) : null
              }
              comDado={(dado) => <Avisos itens={dado.itens} />}
            />
          </Secao>
        </div>
      </main>
    </div>
  )
}
