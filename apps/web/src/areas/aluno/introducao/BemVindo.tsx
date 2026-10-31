import type { ReactNode } from 'react'
import { ROTAS_DO_ALUNO } from '../../../paths'
import { TamanhoDaLetra } from '../../../components/settings/TamanhoDaLetra'
import { IntroducaoDoPapel } from '../../../components/introducao/IntroducaoDoPapel'
import type { PassoDaIntroducao } from '../../../components/introducao/Introducao'
import { Linhas } from '../../../components/introducao/Linhas'
import { RegiaoQueRola } from '../../../components/introducao/RegiaoQueRola'
import { GRUPOS_DO_AVISO } from './aviso-de-privacidade'
import { FALA_DO_TUTOR, PASSOS_DO_ALUNO, TOTAL_DE_PASSOS, type PassoDoAluno } from './textos-da-introducao'

/**
 * O aviso de privacidade: quatro grupos, cada um com o título e as frases (`aviso-de-privacidade.ts`). São 17 frases, que não
 * cabem ao lado da onça, da fala e do botão em 1366 × 768 (RF20): **só o miolo rola**, e o "Continuar" fica à vista. A região
 * rolável (`RegiaoQueRola`, a mesma da introdução do professor) tem nome, entra no Tab e avisa "Role para ler mais" enquanto há
 * o que ler abaixo.
 */
function AvisoDePrivacidade() {
  return (
    <RegiaoQueRola nome="Aviso de privacidade" alturaMaxima="max-h-[28dvh]">
      {GRUPOS_DO_AVISO.map((grupo) => (
        <section key={grupo.titulo} className="flex min-w-0 flex-col gap-2">
          <h2 className="t-cartao min-w-0 break-words text-tinta">{grupo.titulo}</h2>
          <ul className="flex min-w-0 flex-col gap-2">
            {grupo.frases.map((frase) => (
              <li key={frase} className="t-corpo min-w-0 break-words text-tinta">
                {frase}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </RegiaoQueRola>
  )
}

/**
 * O tamanho da letra, com as três opções lado a lado a partir de 640 px: em coluna o passo passava de 940 px e rolava a 1366 × 768
 * (RF20). A peça é a mesma de "Ajustes"; quem a põe em linha é este passo, e abaixo de 640 px ela segue em coluna.
 */
function PassoDaLetra() {
  return (
    <div className="w-full min-w-0 sm:[&_fieldset]:flex-row sm:[&_fieldset]:flex-wrap sm:[&_label]:flex-1 sm:[&_legend]:w-full sm:[&_p]:w-full">
      <TamanhoDaLetra />
    </div>
  )
}

function conteudoDoPasso(passo: PassoDoAluno): ReactNode {
  if (passo.id === 'privacidade') return <AvisoDePrivacidade />
  if (passo.id === 'letra') return <PassoDaLetra />
  return <Linhas linhas={passo.linhas} />
}

function passosDoAluno(): readonly PassoDaIntroducao[] {
  return PASSOS_DO_ALUNO.map((passo) => ({ pose: passo.pose, fala: passo.fala, obrigatorio: passo.obrigatorio, conteudo: conteudoDoPasso(passo) }))
}

/**
 * A introdução do aluno (telas do aluno e primeiro acesso, 9.0; RF12 a RF14, RF16 a RF19; mockup 2.8): quatro passos numa
 * tela de foco, dentro da casca. O Tutor é um programa e pode errar; quem dá a aula acompanha; o aviso de privacidade; o
 * tamanho da letra. Os três primeiros são avisos e não se pulam na primeira vez; o último se pula.
 *
 * Os quatro estados (carregando, erro, data desconhecida e com dado), a gravação da data e a ida embora são de `IntroducaoDoPapel` e
 * de `useIntroducao`, que as três introduções usam. **Concluir e pular levam o aluno à abertura, mesmo se a gravação falhar**: a pessoa
 * nunca fica presa, e a introdução volta na entrada seguinte. Dois cliques seguidos fazem um POST só. "Sair" e fechar a aba não
 * gravam. Revendo, a data já existe: todo passo fecha, nada é gravado e a pessoa volta a Eu, de onde veio.
 */
export default function BemVindo() {
  return (
    <IntroducaoDoPapel
      agente="tutor"
      totalDePassos={TOTAL_DE_PASSOS}
      falaDoCarregando={FALA_DO_TUTOR}
      passosDe={passosDoAluno}
      aoTerminar={ROTAS_DO_ALUNO.inicio}
      aoRever={ROTAS_DO_ALUNO.eu}
    />
  )
}
