import type { ReactNode } from 'react'
import { ROTAS } from '../../../paths'
import { IntroducaoDoPapel } from '../../../components/introducao/IntroducaoDoPapel'
import type { PassoDaIntroducao } from '../../../components/introducao/Introducao'
import { Linhas } from '../../../components/introducao/Linhas'
import { OndeFicaCadaCoisa } from '../../../components/introducao/OndeFicaCadaCoisa'
import { RegiaoQueRola } from '../../../components/introducao/RegiaoQueRola'
import { NAVEGACAO } from '../../navigation'
import {
  AGENTE_DA_INTRODUCAO,
  DESCRICAO_DO_LUGAR,
  falaDoPasso1,
  falasDosPassos,
  PASSOS_DA_COORDENACAO,
  TITULO_DE_ONDE_FICA_CADA_COISA,
  TOTAL_DE_PASSOS,
} from './textos-da-introducao'

/**
 * O primeiro lugar da coordenação, lido da navegação (desde a X3, "Painel"): é para onde ela vai ao terminar, ao pular e ao fechar a
 * revisão. O `~` faz o endereço valer pela raiz do site, e não pela base `/coordenacao` em que a tela está.
 */
const PRIMEIRO_LUGAR = `~${NAVEGACAO.coordenador[0]?.caminho ?? ROTAS.painel}`

/** O que a IA nunca faz, em lista compacta: são onze frases, e o passo inteiro precisa caber ao lado da onça e do botão (RF20). */
function ListaDoQueANuncaFaz({ frases }: { readonly frases: readonly string[] }) {
  return (
    <ul className="flex w-full min-w-0 list-disc flex-col gap-1 pl-5 text-left">
      {frases.map((frase) => (
        <li key={frase} className="t-corpo min-w-0 break-words text-tinta">
          {frase}
        </li>
      ))}
    </ul>
  )
}

function conteudoDoPasso(linhas: readonly string[], ultimo: boolean): ReactNode {
  if (!ultimo) return <Linhas linhas={linhas} />
  // O último passo leva a lista do que a IA nunca faz e a de lugares: não cabem a 1366 × 768 ao lado da onça e do botão (RF20), e só o miolo rola.
  return (
    <RegiaoQueRola nome="Leia até o fim" alturaMaxima="max-h-[34dvh]">
      <ListaDoQueANuncaFaz frases={linhas} />
      <OndeFicaCadaCoisa titulo={TITULO_DE_ONDE_FICA_CADA_COISA} lugares={NAVEGACAO.coordenador} descricoes={DESCRICAO_DO_LUGAR} />
    </RegiaoQueRola>
  )
}

function passosDaCoordenacao(nomeDaEscola: string): readonly PassoDaIntroducao[] {
  const falas = falasDosPassos(nomeDaEscola)
  return PASSOS_DA_COORDENACAO.map((passo, indice) => ({
    pose: passo.pose,
    fala: falas[indice] ?? '',
    obrigatorio: passo.obrigatorio,
    conteudo: conteudoDoPasso(passo.linhas, indice === PASSOS_DA_COORDENACAO.length - 1),
  }))
}

/**
 * A introdução da coordenação (telas do aluno e primeiro acesso, 11.0; RF12, RF15 a RF19; mockup 7): quatro passos numa tela de foco,
 * dentro da casca. O Analista ajuda a ler os números da escola; a coordenação vê a escola em números agregados; o dado com nome só
 * abre com um motivo, e isso fica registrado; e a IA nunca faz o que a lista diz. **Os quatro se pulam**, e o último traz "onde fica
 * cada coisa", lida de `NAVEGACAO.coordenador`.
 *
 * Os quatro estados (carregando, erro, data desconhecida e com dado), a gravação da data e a ida embora são de `IntroducaoDoPapel` e
 * de `useIntroducao`, que as três introduções usam. **Concluir e pular levam a coordenação ao primeiro lugar dela, mesmo se a gravação
 * falhar.** Revendo (pelo menu da pessoa), a data já existe: todo passo fecha, nada é gravado e ela vai ao mesmo primeiro lugar. A
 * introdução só grava a data: não monta a escola, não liga resumo nem sino e não chama modelo.
 *
 * O aviso de incidente (`privacidade/AvisoDeIncidente`) é da área, e por isso aparece por cima desta tela quando há incidente pendente:
 * "Ver depois" o fecha e a introdução continua, e confirmar o incidente não a marca como vista.
 */
export default function BemVindo() {
  return (
    <IntroducaoDoPapel
      agente={AGENTE_DA_INTRODUCAO}
      totalDePassos={TOTAL_DE_PASSOS}
      falaDoCarregando={falaDoPasso1()}
      passosDe={(eu) => passosDaCoordenacao(eu.escola.nome)}
      aoTerminar={PRIMEIRO_LUGAR}
      aoRever={PRIMEIRO_LUGAR}
    />
  )
}
