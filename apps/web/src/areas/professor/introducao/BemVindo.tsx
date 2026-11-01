import type { ReactNode } from 'react'
import { ROUTES } from '../../../paths'
import { IntroducaoDoPapel } from '../../../components/introducao/IntroducaoDoPapel'
import type { PassoDaIntroducao } from '../../../components/introducao/Introducao'
import { Linhas } from '../../../components/introducao/Linhas'
import { OndeFicaCadaCoisa } from '../../../components/introducao/OndeFicaCadaCoisa'
import { ScrollArea } from '../../../components/introducao/ScrollArea'
import { NAVIGATION } from '../../navigation'
import { AGENTE_DA_INTRODUCAO, DESCRICAO_DO_LUGAR, FALA_DO_PASSO_1, PASSOS_DO_PROFESSOR, TITULO_DE_ONDE_FICA_CADA_COISA, TOTAL_DE_PASSOS, type PassoDoProfessor } from './textos-da-introducao'

/**
 * O primeiro lugar do professor, lido da navegação: é para onde ele vai ao terminar, ao pular e ao fechar a revisão. O `~` faz o
 * endereço valer pela raiz do site, e não pela base `/professor` em que a tela está.
 */
const PRIMEIRO_LUGAR = `~${NAVIGATION.professor[0]?.caminho ?? ROUTES.novaConversa}`

function conteudoDoPasso(passo: PassoDoProfessor, ultimo: boolean): ReactNode {
  if (!ultimo) return <Linhas linhas={passo.linhas} />
  // O último passo leva a lista de lugares: não cabe a 1366 × 768 ao lado da onça e do botão (RF20), e só o miolo rola.
  return (
    <ScrollArea nome="Leia até o fim" alturaMaxima="max-h-[34dvh]">
      <Linhas linhas={passo.linhas} />
      <OndeFicaCadaCoisa titulo={TITULO_DE_ONDE_FICA_CADA_COISA} lugares={NAVIGATION.professor} descricoes={DESCRICAO_DO_LUGAR} />
    </ScrollArea>
  )
}

function passosDoProfessor(): readonly PassoDaIntroducao[] {
  return PASSOS_DO_PROFESSOR.map((passo, indice) => ({
    pose: passo.pose,
    fala: passo.fala,
    obrigatorio: passo.obrigatorio,
    conteudo: conteudoDoPasso(passo, indice === PASSOS_DO_PROFESSOR.length - 1),
  }))
}

/**
 * A introdução do professor (telas do aluno e primeiro acesso, 10.0; RF12, RF15 a RF19; mockup 14): quatro passos numa tela de foco,
 * dentro da casca. O Assistente prepara e ele aprova; só a resposta do Tutor chega ao aluno sem a aprovação dele, uma a uma; a IA
 * não corrige redação nem discursiva; e usar ou não a ferramenta não gera número sobre ele. **Os quatro se pulam**, e o último traz
 * "onde fica cada coisa", lida de `NAVIGATION.professor`.
 *
 * Os quatro estados (carregando, erro, data desconhecida e com dado), a gravação da data e a ida embora são de `IntroducaoDoPapel` e
 * de `useIntroducao`, que as três introduções usam. **Concluir e pular levam o professor ao primeiro lugar dele, mesmo se a gravação
 * falhar.** Revendo (pelo menu da pessoa), a data já existe: todo passo fecha, nada é gravado e ele vai ao mesmo primeiro lugar,
 * porque o menu da pessoa está em toda tela e não há uma única de onde ele veio. A introdução só grava a data: não confirma turma,
 * não liga nada e não gera documento.
 */
export default function BemVindo() {
  return (
    <IntroducaoDoPapel
      agente={AGENTE_DA_INTRODUCAO}
      totalDePassos={TOTAL_DE_PASSOS}
      falaDoCarregando={FALA_DO_PASSO_1}
      passosDe={passosDoProfessor}
      aoTerminar={PRIMEIRO_LUGAR}
      aoRever={PRIMEIRO_LUGAR}
    />
  )
}
