import type { ReactNode } from 'react'
import { Logo } from './ui/Logo'

/**
 * A casca das telas de fora da sessão: entrada da equipe, endereço da escola, segundo fator, convite e página da turma
 * (`docs/interface.md` 11.3; D80).
 *
 * **A partir de 1024 px a tela se divide**: à esquerda o painel em `papel`, com a marca e a pinta parada e apagada; à
 * direita o cartão do formulário, centrado. **Abaixo disso empilha**: o painel vira uma faixa com a marca, e o
 * formulário vem embaixo, em coluna única a partir de 360 px, com a largura presa em `max-w-md` para o Chromebook de
 * 1366 px não espalhar um formulário de dois campos pela tela inteira (regra 50, item 2a).
 *
 * - **Um `banner`, um `main` e o `h1` do título.** O `banner` é só a marca: a pinta grande do painel fica **fora** dele, e
 *   por isso a página tem uma pinta no `banner` e outra, decorativa, ao lado (`alt=""` nas duas: o nome "Turmma" já diz
 *   o que a imagem é)
 * - **A pinta do painel não se mexe** e só aparece de 1024 px: é o mesmo `turmma-pinta.svg` da marca, sem imagem nova e
 *   sem animação (`docs/interface.md` 9.6). Ela fica inteira dentro do painel, a 40 px do canto de baixo e da direita:
 *   nenhuma parte dela passa para o lado do formulário nem dá rolagem de lado
 * - **Nenhuma delas tem "Sair"**: não há sessão ainda
 */
export function CascaPublica({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-fundo text-tinta lg:grid lg:grid-cols-2">
      <div data-painel-publico="" className="relative border-b-2 border-borda bg-papel lg:border-r-2 lg:border-b-0">
        <header className="relative px-4 py-3 sm:px-6 lg:px-10 lg:py-10">
          <Logo />
        </header>
        <img
          src="/marca/turmma-pinta.svg"
          alt=""
          width={320}
          height={320}
          className="pointer-events-none absolute right-10 bottom-10 hidden size-80 opacity-15 select-none lg:block"
        />
      </div>
      <div className="flex justify-center px-4 py-6 sm:px-6 lg:items-center lg:px-10 lg:py-12">
        <main data-cartao-publico="" className="flex w-full max-w-md flex-col gap-6 lg:rounded-cartao lg:border-2 lg:border-borda lg:bg-superficie lg:p-8">
          <h1 className="t-titulo break-words">{titulo}</h1>
          {children}
        </main>
      </div>
    </div>
  )
}
