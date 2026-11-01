import type { PapelDeUsuario } from '@educa/shared'
import { BookOpen, FolderLock, UserRound, type LucideIcon } from 'lucide-react'
import { ROUTES } from '../paths'
// Só tipos, que o compilador apaga: o `CountBadge` e os ícones ilustrados são peças da entrada ou fora dela, e este arquivo
// não importa nenhuma (o item 4 do guia acima). O que ele diz é qual ícone e qual família, e a casca é quem desenha.
import type { ColorFamily } from '../components/ui/CountBadge'
import type { PlaceName } from '../components/ui/icons/places'

/*
 * COMO ENTRA UMA TELA NOVA NUMA ÁREA (MVP de apresentação; `apps/web/chunk-names.ts` e o teste dele sobre o build):
 * 1. A tela é um arquivo em `areas/<area>/` com `export default`, declarada no `routes.tsx` da área por `const Tela = lazy(() => import('./Tela'))`; o `Suspense` e a fronteira de erro da área já a cobrem. Sai em `tela-<area>-<Tela>-*.js`, com teto de 30 kB em brotli.
 * 2. Tela nova nunca entra por `import` direto no `routes.tsx`: o teto da fachada (`<area>-*.js`) é o das telas da A1, que ficam como estão.
 * 3. Peça se importa pelo arquivo dela (`../../components/ui/ai/PromptInput`, `../../components/ui/Card`), sem arquivo-barril.
 * 4. Nada da entrada (`src/routes.tsx`, `pages/`, a casca, este arquivo) importa peça de `components/ui/ai/` ou da lista `PECAS_FORA_DA_ENTRADA`, nem módulo de `areas/<area>/`.
 * 5. Tela de uma área não importa módulo de outra área: o que duas áreas dividem mora em `components/`. O build reprova a tela do professor que o aluno baixaria.
 * Como usar cada peça (aprovação, conversa, barra presa, o que a peça não dá): `src/components/ui/ai/README.md`.
 */

/**
 * O ícone de um lugar (`docs/interface.md` 9.4): o ilustrado, onde a D80 desenhou um (Início, Turmas, Ferramentas e
 * Atividades, que usa o `tarefas`), ou o do `lucide` dentro de um `IconTile`, na família do lugar. A família é categoria,
 * e nunca julgamento: os três agentes têm a deles (Assistente azul, Tutor laranja, Analista anil), e a gestão, a escola e os
 * registros, a que a 9.4 dá aos lugares correspondentes.
 */
export type NavItemIcon = { readonly lugar: PlaceName } | { readonly lucide: LucideIcon; readonly familia: ColorFamily }

/** Um item da lateral: o rótulo, o endereço pela raiz e o ícone (`docs/interface.md` 9.4). */
export interface NavItem {
  readonly rotulo: string
  readonly caminho: string
  readonly icone: NavItemIcon
  /**
   * Outros endereços, pela raiz, em que o item também fica selecionado: a conversa aberta dentro de "Início", o
   * artefato aberto dentro de "Ferramentas". Sem isto a lateral não diria onde a pessoa está nessas telas.
   */
  readonly tambemEm?: readonly string[]
}

/**
 * A navegação de cada papel (D73; `docs/interface.md` 11.1), numa tabela só. **Cada item nasce com a tela dele**, e
 * nenhum antes: item que leva a tela inexistente é o que o W2 reprova. A tarefa que entrega a tela acrescenta a linha
 * aqui — "Minha turma" do aluno veio na 12.0 e os quatro lugares da coordenação, na X2 — e na lista do papel em
 * `e2e/areas.spec.ts`, que o W2 percorre.
 *
 * É só o que a tela mostra. Quem decide o que cada papel alcança é a API, pela matriz de permissão: esconder um item não
 * protege nada (regra 00, item 1).
 */
export const NAVIGATION: Readonly<Record<PapelDeUsuario, readonly NavItem[]>> = {
  // X2 (D80; `docs/interface.md` 11.1): quatro lugares, Painel, Analista, Escola e Registros. O Painel é onde a coordenação abre.
  // Escola e Registros são molduras com abas (`areas/coordenacao/Escola.tsx` e `Registros.tsx`) que ficam nos endereços de
  // hoje: o lugar fica aceso por `caminho` e `tambemEm`, e nenhum endereço mudou. A Estrutura abre a lista da turma abaixo
  // dela, e a Governança é a aba IA de Registros; os Agentes ficam acesos em Registros.
  coordenador: [
    { rotulo: 'Painel', caminho: ROUTES.painel, icone: { lugar: 'painel' } },
    { rotulo: 'Analista', caminho: ROUTES.analista, icone: { lugar: 'ia' } },
    { rotulo: 'Escola', caminho: ROUTES.estrutura, icone: { lugar: 'escola' }, tambemEm: [ROUTES.professores, ROUTES.material] },
    { rotulo: 'Registros', caminho: ROUTES.governanca, icone: { lugar: 'registros' }, tambemEm: [ROUTES.agentes, ROUTES.privacidade] },
  ],
  // A2 (D73): Início, Turmas e Ferramentas. Calendário nasce com a grade (F8) e Histórico, com o F5: nenhum aparece antes da
  // tela dele. X1 (12.0): "Nova conversa" virou "Início", no mesmo endereço, com os ícones ilustrados da D80. X3 (2.0): a ordem
  // é a da D80, e "Seu time" saiu da lateral: o Assistente e o Tutor abrem pelo pé do sino (`areas/professor/inicio/SinoDoProfessor.tsx`). X3 (5.0): Criados é o quarto lugar,
  // o último dos quatro que cabem na barra de baixo. O documento aberto (6.0) acende Criados, que é a lista de onde ele vem.
  // As telas deles (`/professor/time/assistente` e `/professor/time/tutor`) não são lugar de nenhum item.
  professor: [
    { rotulo: 'Início', caminho: ROUTES.novaConversa, icone: { lugar: 'inicio' }, tambemEm: [ROUTES.conversa] },
    { rotulo: 'Turmas', caminho: ROUTES.turmas, icone: { lugar: 'turmas' } },
    { rotulo: 'Ferramentas', caminho: ROUTES.ferramentas, icone: { lugar: 'ferramentas' } },
    { rotulo: 'Criados', caminho: ROUTES.criados, icone: { lugar: 'criados' }, tambemEm: [ROUTES.artefatos] },
  ],
  // X4 (2.0; `docs/interface.md` 11.1): Início, Tarefas e Eu. "Avisar um adulto" e "Meu desempenho" nascem com a tela de cada um
  // (F9): nesta fatia não existem, e por isso não aparecem. O Tutor deixou de ser lugar: a escolha da atividade é o Início, e a
  // conversa abre por ele ou por uma tarefa, de modo que `/aluno/tutor` e a conversa aberta acendem "Início". "Privacidade" é uma
  // linha de Eu e acende Eu; "Minha turma" é o cartão de Eu. A tarefa aberta fica abaixo do endereço de Tarefas.
  aluno: [
    { rotulo: 'Início', caminho: ROUTES.inicioDoAluno, icone: { lugar: 'inicio' }, tambemEm: [ROUTES.tutor] },
    { rotulo: 'Tarefas', caminho: ROUTES.atividades, icone: { lugar: 'tarefas' } },
    { rotulo: 'Eu', caminho: ROUTES.euDoAluno, icone: { lucide: UserRound, familia: 'turquesa' }, tambemEm: [ROUTES.privacidadeDoAluno] },
  ],
}

/**
 * O rodapé fixo da lateral (`docs/interface.md` 11.1): os itens que ficam **embaixo**, acima da pessoa, e não entram na
 * lista de seções. Hoje nenhum papel tem: o aluno tinha "Privacidade" (F3, 18.0), que na X4 virou uma linha de Eu. O
 * "Sair" nunca entra aqui nem na lista: é do menu da pessoa, sempre à vista (D59).
 */
export const SIDEBAR_FOOTER: Readonly<Record<PapelDeUsuario, readonly NavItem[]>> = {
  coordenador: [],
  professor: [],
  aluno: [],
}

/**
 * O que o menu da pessoa, no rodapé da lateral, leva além do "Sair" (P18; `docs/interface.md` 11.1): os links dela. O
 * "Sair" nunca entra aqui, porque é o último e está sempre à vista (D59). O professor tem "Meus dados" desde o F3 (18.0) e "Rever a introdução"
 * desde a X4 (10.0), nesta ordem, antes do "Sair". A coordenação tem só "Rever a introdução", desde a X4 (11.0): não é titular de pedido (a API não lhe dá `meus_dados`). O aluno acha os dados dele em Eu (a linha Privacidade).
 */
export const PERSON_MENU: Readonly<Record<PapelDeUsuario, readonly NavItem[]>> = {
  // X4 (11.0): rever a introdução é o mesmo endereço da primeira entrada; revendo, todo passo fecha e a data não muda.
  coordenador: [{ rotulo: 'Rever a introdução', caminho: ROUTES.bemVindoDaCoordenacao, icone: { lucide: BookOpen, familia: 'lima' } }],
  professor: [
    { rotulo: 'Meus dados', caminho: ROUTES.meusDadosDoProfessor, icone: { lucide: FolderLock, familia: 'verde' } },
    // X4 (10.0): rever a introdução é o mesmo endereço da primeira entrada; revendo, todo passo fecha e a data não muda.
    { rotulo: 'Rever a introdução', caminho: ROUTES.bemVindoDoProfessor, icone: { lucide: BookOpen, familia: 'lima' } },
  ],
  aluno: [],
}

/** O nome de cada um desses grupos para o leitor de tela: o que a navegação "Seções" já faz. */
export const NOME_DO_RODAPE = 'Rodapé'
export const NOME_DO_MENU_DA_PESSOA = 'Sua conta'

/**
 * O item está selecionado no endereço dele e em qualquer um abaixo dele (a turma aberta dentro de Turmas, na 15.0), e
 * nos endereços que ele declara em `tambemEm`, do mesmo jeito.
 */
export function estaNoItem(caminho: string, item: Pick<NavItem, 'caminho' | 'tambemEm'>): boolean {
  return [item.caminho, ...(item.tambemEm ?? [])].some((base) => caminho === base || caminho.startsWith(`${base}/`))
}
