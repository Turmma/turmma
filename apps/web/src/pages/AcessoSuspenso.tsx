import { MENSAGENS_DE_ERRO } from '@educa/shared'
import { Link } from 'wouter'
import { quemEstaNaSessao, sairDaSessaoSuspensa } from '../api/sessao'
import { caminhoDaEscola, ROUTES } from '../paths'
import { CascaPublica } from '../components/CascaPublica'
import { usePageTitle } from '../document-title'

/**
 * A renovação da sessão respondeu `ACESSO_SUSPENSO` (F3, 20.0; Tech Spec, seção 9, "Login suspenso"): quem estava nesta
 * aba tem a eliminação dos dados agendada a pedido, e a API já encerrou as sessões e apagou o cookie. É o que
 * `Protegida` mostra no estado `suspensa`, no lugar da área inteira.
 *
 * O texto é o do catálogo, o mesmo que as telas de entrada mostram para a mesma recusa. Sem "Tentar de novo" e sem
 * formulário de propósito: repetir não adianta, e a senha certa devolveria o mesmo texto. Também não mostra o nome
 * da pessoa nem o da escola dela: no Chromebook do carrinho, quem olha a tela em seguida pode ser outra pessoa. O
 * único rastro da escola é o endereço de entrada do aluno, no `href` do link (`/e/<slug>`), que é público.
 *
 * O caminho de volta é o endereço da escola quando a aba sabe que quem estava era aluno (ele entra pela matrícula, e
 * `/entrar` pede e-mail, que ele não tem), e a entrada da equipe no resto — inclusive depois de recarregar, quando a
 * memória da aba já não sabe quem era.
 */
export function AcessoSuspenso() {
  usePageTitle('Acesso suspenso')
  // Lê a memória da aba sem assinar a sessão, de propósito: em `suspensa` ela não muda até o clique no link, que a
  // esquece e tira a aba de `suspensa` (a tela deixa de ser montada).
  const quem = quemEstaNaSessao()
  const entrada = quem?.papel === 'aluno' ? caminhoDaEscola(quem.escolaSlug) : ROUTES.entrar
  return (
    <CascaPublica titulo="Acesso suspenso">
      <p role="alert" className="rounded-controle border border-pendente bg-pendente-cx p-4 text-pendente">
        {MENSAGENS_DE_ERRO.ACESSO_SUSPENSO}
      </p>
      {/* `replace`: o Voltar do navegador não remonta a área da pessoa que estava aqui. */}
      <Link
        to={entrada}
        replace
        onClick={sairDaSessaoSuspensa}
        className="inline-flex min-h-11 items-center justify-center self-start rounded-full bg-caramelo px-4 py-2 text-base font-medium text-sobre-cor hover:bg-caramelo-claro active:bg-caramelo-fundo"
      >
        Ir para a entrada
      </Link>
    </CascaPublica>
  )
}
