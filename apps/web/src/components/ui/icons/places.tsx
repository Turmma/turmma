import type { ReactElement } from 'react'

/**
 * Os ícones ilustrados dos lugares da navegação (`docs/interface.md` 9.4; D80, item 4): os quatro que a X1 desenha
 * (`inicio`, `turmas`, `tarefas`, `ferramentas`), os quatro que a coordenação ganha na X2 (`painel`, `ia`, `escola`,
 * `registros`) e o `criados` da professora (X3, 5.0). Os outros nascem com o lugar de cada um (X3 e X4).
 *
 * Cada desenho é **a grade de 48 por 48 e só as formas dela**: o `<svg>` é do `Icone`, que dá o tamanho, o `viewBox` e o
 * nome. Chapados, de duas a três cores, sem contorno, sem degradê e sem sombra.
 *
 * - **Nenhuma cor escrita.** A cor dominante é a face da família (`fill-laranja`, `fill-azul`…), e o papel e as linhas são
 *   `fill-icone-papel` e `fill-icone-linha`: tokens, que mudam com o tema. Por isso o ícone não leva hex, função de cor nem
 *   `style`, e a guarda de cor (`estilos.test.ts`) o varre como a qualquer outro arquivo, sem exceção na lista. O mapa de
 *   classes é literal: o Tailwind só gera a classe que acha escrita por inteiro.
 * - **Sem texto.** Nenhum `<title>`, `<desc>` nem `<text>`: quem dá nome é o `rotulo` do `Icone`, ou o texto ao lado.
 * - **Parados.** Nenhuma animação (D59).
 * - O visto é feito de dois retângulos de ponta redonda, e não de um traço, para a cor ser sempre `fill-*`.
 */

export const NOMES_DOS_LUGARES = ['inicio', 'turmas', 'tarefas', 'ferramentas', 'painel', 'ia', 'escola', 'registros', 'criados'] as const
export type NomeDoLugar = (typeof NOMES_DOS_LUGARES)[number]

/** Início, em laranja: a casa, com a porta e a chaminé na família e as janelas na linha. */
function Inicio() {
  return (
    <>
      <rect x="33" y="8" width="5" height="11" rx="1.5" className="fill-laranja" />
      <rect x="9" y="21" width="30" height="22" rx="4" className="fill-icone-papel" />
      <path d="M24 5 4 21.5a2.5 2.5 0 0 0 1.6 4.4h36.8a2.5 2.5 0 0 0 1.6-4.4z" className="fill-laranja" />
      <path d="M20 43V33a4 4 0 0 1 8 0v10z" className="fill-laranja" />
      <rect x="12.5" y="29" width="5" height="5" rx="1.5" className="fill-icone-linha" />
      <rect x="30.5" y="29" width="5" height="5" rx="1.5" className="fill-icone-linha" />
    </>
  )
}

/** Turmas, em turquesa: três pessoas, a do meio na frente, na família, e as duas de trás na linha. */
function Turmas() {
  return (
    <>
      <circle cx="10" cy="21" r="4.5" className="fill-icone-linha" />
      <path d="M2 43v-7a8 8 0 0 1 16 0v7z" className="fill-icone-linha" />
      <circle cx="38" cy="21" r="4.5" className="fill-icone-linha" />
      <path d="M30 43v-7a8 8 0 0 1 16 0v7z" className="fill-icone-linha" />
      <circle cx="24" cy="15" r="7" className="fill-turquesa" />
      <path d="M11 43v-8a13 13 0 0 1 26 0v8z" className="fill-turquesa" />
    </>
  )
}

/** Tarefas, em azul: a prancheta com a folha e o visto. A presilha é da linha. */
function Tarefas() {
  return (
    <>
      <rect x="9" y="7" width="30" height="37" rx="5" className="fill-azul" />
      <rect x="13" y="13" width="22" height="27" rx="2.5" className="fill-icone-papel" />
      <rect x="17" y="3" width="14" height="9" rx="3" className="fill-icone-linha" />
      <rect x="14" y="27.5" width="11" height="4" rx="2" transform="rotate(45 19.5 29.5)" className="fill-azul" />
      <rect x="18.1" y="25.5" width="16.8" height="4" rx="2" transform="rotate(-45 26.5 27.5)" className="fill-azul" />
    </>
  )
}

/** Ferramentas, os quatro quadradinhos: laranja, azul, verde e roxo. É o único dos quatro com mais de três cores. */
function Ferramentas() {
  return (
    <>
      <rect x="5" y="5" width="17" height="17" rx="5" className="fill-laranja" />
      <rect x="26" y="5" width="17" height="17" rx="5" className="fill-azul" />
      <rect x="5" y="26" width="17" height="17" rx="5" className="fill-verde" />
      <rect x="26" y="26" width="17" height="17" rx="5" className="fill-roxo" />
    </>
  )
}

/** Painel, em anil: o cartão com as três colunas de um gráfico. O papel é o fundo do gráfico. */
function Painel() {
  return (
    <>
      <rect x="5" y="7" width="38" height="34" rx="6" className="fill-anil" />
      <rect x="9" y="11" width="30" height="26" rx="3" className="fill-icone-papel" />
      <rect x="13" y="26" width="6" height="7" rx="1.5" className="fill-anil" />
      <rect x="21" y="19" width="6" height="14" rx="1.5" className="fill-anil" />
      <rect x="29" y="15" width="6" height="18" rx="1.5" className="fill-anil" />
    </>
  )
}

/** IA, em anil: o balão de fala com as reticências no papel. É o lugar do Analista, que escreve e não conversa. */
function Ia() {
  return (
    <>
      <path d="M13 7h22a8 8 0 0 1 8 8v12a8 8 0 0 1-8 8H24l-9 7v-7h-2a8 8 0 0 1-8-8V15a8 8 0 0 1 8-8z" className="fill-anil" />
      <circle cx="16" cy="21" r="2.5" className="fill-icone-papel" />
      <circle cx="24" cy="21" r="2.5" className="fill-icone-papel" />
      <circle cx="32" cy="21" r="2.5" className="fill-icone-papel" />
    </>
  )
}

/** Escola, em azul: o prédio com a torre do meio, a bandeira na linha e as janelas e a porta no papel. */
function Escola() {
  return (
    <>
      <rect x="22.5" y="3" width="2.5" height="9" rx="1" className="fill-icone-linha" />
      <rect x="18" y="10" width="12" height="16" rx="2" className="fill-azul" />
      <rect x="5" y="22" width="38" height="20" rx="3" className="fill-azul" />
      <rect x="20" y="31" width="8" height="11" rx="2" className="fill-icone-papel" />
      <rect x="9" y="28" width="5" height="5" rx="1.5" className="fill-icone-papel" />
      <rect x="34" y="28" width="5" height="5" rx="1.5" className="fill-icone-papel" />
    </>
  )
}

/** Registros, em amarelo: a folha de registro, com as três linhas escritas na linha neutra. */
function Registros() {
  return (
    <>
      <rect x="9" y="5" width="30" height="38" rx="5" className="fill-amarelo" />
      <rect x="13" y="9" width="22" height="30" rx="2.5" className="fill-icone-papel" />
      <rect x="17" y="15" width="14" height="3" rx="1.5" className="fill-icone-linha" />
      <rect x="17" y="22" width="14" height="3" rx="1.5" className="fill-icone-linha" />
      <rect x="17" y="29" width="9" height="3" rx="1.5" className="fill-icone-linha" />
    </>
  )
}

/** Criados, em amarelo: a pasta com duas folhas saindo dela, a da frente com a linha escrita. A de trás é da linha neutra. */
function Criados() {
  return (
    <>
      <path d="M4 14a5 5 0 0 1 5-5h9a4 4 0 0 1 3.2 1.6l2 2.4H39a5 5 0 0 1 5 5V38a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" className="fill-amarelo" />
      <rect x="10" y="5" width="20" height="24" rx="4" transform="rotate(-10 20 18)" className="fill-icone-linha" />
      <rect x="19" y="7" width="20" height="24" rx="4" transform="rotate(8 29 20)" className="fill-icone-papel" />
      <rect x="23" y="12" width="12" height="3.5" rx="1.75" transform="rotate(8 29 20)" className="fill-icone-linha" />
      <rect x="4" y="21" width="40" height="22" rx="5" className="fill-amarelo" />
    </>
  )
}

/** O desenho de cada lugar. A chave é o `nome` do `Icone`. */
export const DESENHO_DO_LUGAR: Readonly<Record<NomeDoLugar, () => ReactElement>> = {
  inicio: Inicio,
  turmas: Turmas,
  tarefas: Tarefas,
  ferramentas: Ferramentas,
  painel: Painel,
  ia: Ia,
  escola: Escola,
  registros: Registros,
  criados: Criados,
}
