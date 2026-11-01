import { useState } from 'react'
import { useLocation } from 'wouter'
import { errorMessage } from '../api/client'
import { acessosParaEscolher, desafioDaEtapa, escolherEscola } from '../api/sessao'
import { LOGIN_STEP_ROUTE } from '../paths'
import { CascaPublica } from '../components/CascaPublica'
import { EmptyState } from '../components/states'
import { ROLE_LABELS } from '../roles'
import { SemDesafio } from './SemDesafio'

/**
 * A escolha da escola no login (RF14, Tech Spec, seção 5, "Etapas"). Chega aqui quem já provou a senha e tem usuário
 * ativo em mais de uma escola: o desafio `escolher` e a lista de acessos estão na memória desta aba, e nunca na URL
 * nem no armazenamento do navegador.
 *
 * Estados: "com dado" é a lista; carregando é o botão em "Entrando…"; erro é a mensagem que diz o que fazer; vazio é
 * a conta que perdeu o acesso entre a senha e esta tela, e ele convida a procurar a coordenação, que é quem resolve.
 * Sem desafio — um F5 —, a tela manda entrar de novo, que é o único caminho.
 */
export function EscolherEscola() {
  const [, navegar] = useLocation()
  const [entrando, definirEntrando] = useState<string | undefined>(undefined)
  const [falha, definirFalha] = useState<unknown>(undefined)
  const acessos = acessosParaEscolher()

  if (desafioDaEtapa('escolher') === undefined) {
    return <SemDesafio titulo="Escolher a escola" explicacao="Para continuar, entre de novo com o seu e-mail e a sua senha." />
  }

  async function entrar(usuarioId: string): Promise<void> {
    // O desafio vale uma vez: dois toques abririam duas sessões, e a segunda receberia o desafio já consumido.
    if (entrando !== undefined) return
    definirEntrando(usuarioId)
    definirFalha(undefined)
    try {
      const resposta = await escolherEscola(usuarioId)
      navegar(LOGIN_STEP_ROUTE[resposta.etapa], { replace: true })
    } catch (erro) {
      definirFalha(erro)
    } finally {
      definirEntrando(undefined)
    }
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
      {falha !== undefined && (
        <p role="alert" className="rounded-controle border border-erro bg-erro-cx p-4 text-erro">
          {errorMessage(falha)}
        </p>
      )}
      <span role="status" className="sr-only">
        {entrando !== undefined ? 'Entrando…' : ''}
      </span>
    </CascaPublica>
  )
}
