import type { ReactNode } from 'react'
import { Marca } from './ui/Marca'

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
 *   sem animação (`docs/interface.md` 9.6). Ela fica **no centro do painel**, nos dois eixos (`inset-0 m-auto`, sem
 *   `transform`), e por isso na mesma altura do centro do cartão, que também é centrado: os dois se leem como um par. Com
 *   384 px, o painel mais estreito (512 px, a 1024 de janela) ainda lhe deixa 64 px de cada lado. **O painel tem 40 rem de
 *   altura no mínimo** (`lg:min-h-[40rem]`): com a pinta no meio, é o que a mantém abaixo da marca, que ocupa os 108 px de
 *   cima (a pinta começa a 128 px do topo). Numa janela de computador mais baixa que isso a página rola, em vez de a pinta
 *   passar por cima da marca. Nenhuma parte dela passa para o lado do formulário nem dá rolagem de lado
 * - **Nenhuma delas tem "Sair"**: não há sessão ainda
 */
export function CascaPublica({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-fundo text-tinta lg:grid lg:grid-cols-2">
      <div data-painel-publico="" className="relative border-b-2 border-borda bg-papel lg:min-h-[40rem] lg:border-r-2 lg:border-b-0">
        <header className="relative px-4 py-3 sm:px-6 lg:px-10 lg:py-10">
          <Marca />
        </header>
        <img
          src="/marca/turmma-pinta.svg"
          alt=""
          width={384}
          height={384}
          className="pointer-events-none absolute inset-0 m-auto hidden size-96 opacity-15 select-none lg:block"
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
