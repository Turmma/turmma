import { Link } from 'wouter'
import { ROTAS } from '../paths'
import { CascaPublica } from '../components/CascaPublica'

/**
 * A tela de etapa aberta sem a credencial que leva a ela: um F5 na tela do segundo fator, o endereço digitado à mão,
 * ou o desafio gasto pelo quinto código errado (6.0).
 *
 * Perder o desafio ao recarregar é de propósito: ele é meia credencial, e no computador compartilhado da escola nada
 * disso pode sobreviver à aba (regra 50, item 7). A tela diz o que fazer, em vez de mostrar um formulário que só
 * responderia erro.
 */
export function SemDesafio({ titulo, explicacao }: { titulo: string; explicacao: string }) {
  return (
    <CascaPublica titulo={titulo}>
      <p role="alert" className="rounded-controle border border-pendente bg-pendente-cx p-4 text-pendente">
        {explicacao}
      </p>
      <Link to={ROTAS.entrar} className="inline-flex min-h-11 items-center justify-center self-start rounded-full bg-caramelo px-4 py-2 text-base font-medium text-sobre-cor hover:bg-caramelo-claro active:bg-caramelo-fundo">
        Ir para a entrada
      </Link>
    </CascaPublica>
  )
}
