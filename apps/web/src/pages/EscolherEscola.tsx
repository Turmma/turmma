import { useEffect, useState } from 'react'
import { useLocation } from 'wouter'
import { errorMessage } from '../api/client'
import { acessosParaEscolher, desafioDaEtapa, escolherEscola } from '../api/sessao'
import { LOGIN_STEP_ROUTE } from '../paths'
import { CascaPublica } from '../components/CascaPublica'
import { EmptyState } from '../components/states'
import { ErrorState } from '../components/states/ErrorState'
import { ROLE_LABELS } from '../roles'
import { AvisoDaEspera, DESCARTADA, isIndisponivel, useEsperaDoIndisponivel } from './espera-do-indisponivel'
import { SemDesafio } from './SemDesafio'

/** O `id` do botão de uma escola: é por ele que o foco volta ao botão da escolha que falhou. */
const idDaEscola = (usuarioId: string): string => `escola-${usuarioId}`

interface FalhaProps {
  readonly falha: unknown
  readonly ocupado: boolean
  readonly aoTentarDeNovo: () => void
}

/** A falha da escolha: o 503 de queda vai ao `ErrorState`, que repete a escolha que falhou; o resto é a mensagem do catálogo. */
function FalhaDaEscolha({ falha, ocupado, aoTentarDeNovo }: FalhaProps) {
  if (isIndisponivel(falha)) return <ErrorState erro={falha} aoTentarDeNovo={aoTentarDeNovo} tentando={ocupado} />
  if (falha === undefined) return null
  return (
    <p role="alert" className="rounded-controle border border-erro bg-erro-cx p-4 text-erro">
      {errorMessage(falha)}
    </p>
  )
}

/**
 * A escolha da escola no login (RF14, Tech Spec, seção 5, "Etapas"). Chega aqui quem já provou a senha e tem usuário
 * ativo em mais de uma escola: o desafio `escolher` e a lista de acessos estão na memória desta aba, e nunca na URL
 * nem no armazenamento do navegador.
 *
 * Estados: "com dado" é a lista; carregando é o botão em "Entrando…"; erro é a mensagem que diz o que fazer; vazio é
 * a conta que perdeu o acesso entre a senha e esta tela, e ele convida a procurar a coordenação, que é quem resolve.
 * Sem desafio — um F5 —, a tela manda entrar de novo, que é o único caminho.
 *
 * **Redis de fila fora (54.0):** o 503 `INDISPONIVEL_TENTE_DE_NOVO` não gastou o desafio. A tela espera o `Retry-After` uma
 * vez (até 10 s), com os botões desabilitados e "Tentando de novo em instantes" em `role="status"`, e repete a mesma escolha;
 * o segundo 503, ou um `Retry-After` maior, vai ao `ErrorState`, que repete a escolha que falhou.
 */
export function EscolherEscola() {
  const [, navegar] = useLocation()
  const [entrando, definirEntrando] = useState<string | undefined>(undefined)
  const [falha, definirFalha] = useState<unknown>(undefined)
  // A última escolha, com o desafio de quando saiu: a falha e o "Tentar de novo" são dela, e não valem para a pessoa que chegou depois.
  const [ultima, definirUltima] = useState<{ readonly usuarioId: string; readonly desafio: string | undefined }>({ usuarioId: '', desafio: undefined })
  const espera = useEsperaDoIndisponivel()
  const acessos = acessosParaEscolher()

  // O botão desabilitado perde o foco; ao terminar com falha, o foco volta ao botão da escola que a pessoa escolheu. Com a escolha
  // no ar o botão está desabilitado e `focus()` não faz nada, e na abertura da tela não há escola escolhida (`ultima` vazia).
  useEffect(() => {
    document.getElementById(idDaEscola(ultima.usuarioId))?.focus()
  }, [falha, ultima])

  if (desafioDaEtapa('escolher') === undefined) {
    return <SemDesafio titulo="Escolher a escola" explicacao="Para continuar, entre de novo com o seu e-mail e a sua senha." />
  }

  async function entrar(usuarioId: string): Promise<void> {
    // O desafio vale uma vez: dois toques abririam duas sessões, e a segunda receberia o desafio já consumido.
    if (entrando !== undefined) return
    definirEntrando(usuarioId)
    const desafioDaTentativa = desafioDaEtapa('escolher')
    definirUltima({ usuarioId, desafio: desafioDaTentativa })
    definirFalha(undefined)
    try {
      // A repetição só sai se o desafio é o mesmo: a pessoa seguinte do computador não herda a escolha de quem saiu.
      const resposta = await espera.run(
        () => escolherEscola(usuarioId),
        () => desafioDaEtapa('escolher') === desafioDaTentativa,
      )
      if (resposta === DESCARTADA) return
      navegar(LOGIN_STEP_ROUTE[resposta.etapa], { replace: true })
    } catch (erro) {
      definirFalha(erro)
    } finally {
      definirEntrando(undefined)
    }
  }

  // A falha de outra pessoa não se mostra, e o "Tentar de novo" dela não manda a escolha dela com o desafio de quem chegou agora.
  const daPessoaDeAgora = (): boolean => ultima.desafio === desafioDaEtapa('escolher')
  function retry(): void {
    // Conferido no clique, e não só no desenho da tela: o desafio muda sem a tela desenhar de novo.
    if (daPessoaDeAgora()) void entrar(ultima.usuarioId)
    else definirFalha(undefined)
  }

  return (
    <CascaPublica titulo="Escolher a escola">
      {acessos.length === 0 ? (
        <EmptyState
          titulo="Nenhuma escola para entrar agora"
          descricao="A sua conta não tem acesso ativo em nenhuma escola neste momento. Procure a coordenação da escola para conferir o seu vínculo."
        />
      ) : (
        <>
          <p className="text-apoio">Você tem acesso em mais de uma escola. Escolha por onde quer entrar agora; dá para trocar depois, no topo da tela.</p>
          <ul className="flex flex-col gap-3">
            {acessos.map((acesso) => (
              <li key={acesso.usuarioId}>
                <button
                  id={idDaEscola(acesso.usuarioId)}
                  type="button"
                  onClick={() => void entrar(acesso.usuarioId)}
                  disabled={entrando !== undefined}
                  className="flex min-h-11 w-full items-center rounded-controle border border-borda-campo bg-superficie px-4 py-3 text-left break-words enabled:hover:bg-realce-suave enabled:active:bg-realce disabled:text-sutil"
                >
                  {entrando === acesso.usuarioId ? `Entrando em ${acesso.escolaNome}…` : `${acesso.escolaNome} · ${ROLE_LABELS[acesso.papel]}`}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <FalhaDaEscolha falha={daPessoaDeAgora() ? falha : undefined} ocupado={entrando !== undefined} aoTentarDeNovo={retry} />
      <AvisoDaEspera restante={espera.restante} repouso={entrando === undefined ? '' : 'Entrando…'} classe="t-apoio" />
    </CascaPublica>
  )
}
