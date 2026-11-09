import { mensagemDaLigacao, PARAMETRO_DA_LIGACAO, RESULTADOS_DA_LIGACAO, type ProvedorDeContaDaEscola, type ResultadoDaLigacao } from '@educa/shared'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { acessoDaEscolaQueryOptions, enderecoParaLigarAConta, NOME_DO_PROVEDOR } from '../../api/escola'
import { euQueryOptions } from '../../api/eu'
import { ErrorState } from '../../components/states'
import { Button } from '../../components/ui/Button'

/**
 * Quanto a lista de provedores da escola vale antes de ser lida de novo (regra 80, item 1): a consulta é anônima e entra no balde por IP da escola, o mesmo da entrada dela, e os
 * provedores quase nunca mudam. Toda abertura de "Eu" dos alunos de uma manhã não pode custar uma chamada cada.
 */
export const PRAZO_DOS_PROVEDORES_MS = 10 * 60_000

/** O que a volta do provedor trouxe na barra (`?ligacao=`): um resultado conhecido, ou, para valor estranho, a queda do provedor, e a tela nunca fica sem explicação. */
function resultadoDaBarra(): ResultadoDaLigacao | undefined {
  const valor = new URL(window.location.href).searchParams.get(PARAMETRO_DA_LIGACAO)
  if (valor === null) return undefined
  return RESULTADOS_DA_LIGACAO.find((resultado) => resultado === valor) ?? 'provedor'
}

/**
 * O resultado da volta, tirado da barra (regra 50, item 7): fica no histórico do computador compartilhado e reapareceria em cada F5, e o colega que senta depois não pode ver o aviso
 * do anterior. A leitura é a da primeira renderização, e a limpeza, no efeito, como na entrada da escola.
 */
function useResultadoDaLigacao(): [ResultadoDaLigacao | undefined, () => void] {
  const [resultado, definirResultado] = useState(resultadoDaBarra)
  useEffect(() => {
    if (resultado === undefined) return
    const endereco = new URL(window.location.href)
    endereco.searchParams.delete(PARAMETRO_DA_LIGACAO)
    window.history.replaceState(null, '', `${endereco.pathname}${endereco.search}${endereco.hash}`)
  }, [resultado])
  return [resultado, () => definirResultado(undefined)]
}

/**
 * "Conta da escola" em "Eu" (acesso-e-convites, 15.0; RF14; `cenarios.md`, "Telas"): o aluno que entrou por matrícula liga a conta Google ou Microsoft da escola e passa a entrar por
 * ela. O botão é navegação do navegador (o `iniciar` com `intencao=ligar` responde ao provedor) e a volta traz o resultado no endereço (`?ligacao=`), que a tela mostra e tira da barra.
 *
 * - **Sem provedor liberado pela escola:** nada na tela. O botão aparece só para o que a escola liberou, como na entrada dela.
 * - **Carregando:** nada até saber a escola e os provedores; ao clicar, o botão fica ocupado ("Ligando…") até o navegador sair.
 * - **Rede:** a leitura dos provedores que falha mostra o erro com "Tentar de novo".
 * - **Com dado:** "Conta da escola ligada"; `conflito` e `recusada` dizem o próximo passo, sem dizer a quem a conta está ligada; `provedor` oferece "Tentar de novo".
 *   O aviso sai quando o aluno tenta de novo.
 */
export function ContaDaEscola() {
  const eu = useQuery(euQueryOptions)
  const slug = eu.data?.escola.slug
  const acesso = useQuery({ ...acessoDaEscolaQueryOptions(slug ?? ''), enabled: slug !== undefined, staleTime: PRAZO_DOS_PROVEDORES_MS })
  const [resultado, limparResultado] = useResultadoDaLigacao()

  if (slug === undefined) return null
  if (acesso.isError) return <ErrorState erro={acesso.error} tentando={acesso.isFetching} aoTentarDeNovo={() => void acesso.refetch({ cancelRefetch: false })} />
  const provedores = acesso.data?.provedores ?? []
  if (provedores.length === 0) return null
  return <SecaoDaConta slug={slug} provedores={provedores} resultado={resultado} aoLigar={limparResultado} />
}

type PropriedadesDaSecao = {
  slug: string
  provedores: readonly ProvedorDeContaDaEscola[]
  resultado: ResultadoDaLigacao | undefined
  aoLigar: () => void
}

/** A seção já com a escola e os provedores conhecidos: o que o aluno vê, e o estado do clique. */
function SecaoDaConta({ slug, provedores, resultado, aoLigar }: PropriedadesDaSecao) {
  const [ligando, definirLigando] = useState(false)

  // O botão "Voltar" do navegador restaura a página como estava, com o botão ocupado: o aluno que desistiu do provedor precisa poder tentar de novo.
  useEffect(() => {
    const restaurada = (evento: PageTransitionEvent) => {
      if (evento.persisted) definirLigando(false)
    }
    window.addEventListener('pageshow', restaurada)
    return () => window.removeEventListener('pageshow', restaurada)
  }, [])

  const ligar = (provedor: ProvedorDeContaDaEscola): void => {
    aoLigar()
    definirLigando(true)
    window.location.assign(enderecoParaLigarAConta(provedor, slug))
  }

  const rotulo = (provedor: ProvedorDeContaDaEscola) => {
    const deNovo = resultado === 'provedor'
    if (provedores.length === 1) return deNovo ? 'Tentar de novo' : 'Ligar a conta da escola'
    return deNovo ? `Tentar de novo com a conta ${NOME_DO_PROVEDOR[provedor]}` : `Ligar a conta ${NOME_DO_PROVEDOR[provedor]} da escola`
  }

  return (
    <section aria-labelledby="titulo-conta-da-escola" className="flex min-w-0 flex-col gap-3 rounded-cartao border-2 border-borda bg-superficie p-4">
      <h2 id="titulo-conta-da-escola" className="font-medium">
        Conta da escola
      </h2>
      <p className="t-apoio text-apoio">Ligue a conta da escola e entre por ela, sem digitar a matrícula.</p>
      {resultado !== undefined && (
        <p role={resultado === 'ligada' ? 'status' : 'alert'} className={resultado === 'ligada' ? 'font-medium' : 't-apoio text-erro'}>
          {mensagemDaLigacao(resultado)}
        </p>
      )}
      {resultado !== 'ligada' && (
        <div className="flex flex-wrap items-center gap-3">
          {provedores.map((provedor) => (
            <Button key={provedor} variante="secundario" disabled={ligando} onClick={() => ligar(provedor)}>
              {ligando ? 'Ligando…' : rotulo(provedor)}
            </Button>
          ))}
          <span role="status" className="sr-only">
            {ligando ? 'Ligando a conta da escola…' : ''}
          </span>
        </div>
      )}
    </section>
  )
}
