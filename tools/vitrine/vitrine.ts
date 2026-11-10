import { resolverFonteComJs } from './resolver.ts'

// Os comandos da vitrine, a escola sintética do ambiente de teste que um agente abre para ver a tela (`./escola.ts`):
//
//   node tools/vitrine/vitrine.ts montar    monta as duas escolas, a cheia e a vazia, e escreve os logins em
//                                           `.processo/vitrine.json`; as duas liberam o Google (o botão "Entrar com a
//                                           conta da escola" aparece em `/e/<slug>`), e a cheia tem a sala aberta
//   node tools/vitrine/vitrine.ts mostrar   repete os logins, ou avisa que o banco foi recriado
//   node tools/vitrine/vitrine.ts codigo [--vazia]
//                                           o código do segundo fator da coordenação, para a entrada de agora
//   node tools/vitrine/vitrine.ts foto <papel> <endereço>… [--clicar <seletor>]… [--vazia] [--escuro]
//                                           entra como `coordenacao`, `professora` ou `aluno`, abre cada endereço e
//                                           grava a foto da página inteira, no computador e no celular; com
//                                           `--vazia`, na escola sem dado, para ver o estado vazio; com `--escuro`,
//                                           com o aparelho no tema escuro, que é o que a aparência Sistema segue;
//                                           termina com as telas cuja página rola a 1366 × 768, com a altura medida
//
// Precisa do ambiente de teste de pé, que é como o portão da tarefa com teste de tela o deixa
// (`node tools/ci/e2e.ts --manter-ambiente`).

// Antes de carregar `./escola.ts`, que traz as peças de semente do e2e: elas importam fonte com `.js` (`./resolver.ts`).
resolverFonteComJs()
const { acessosDa, codigoDoPasso, comPassoGasto, escolaExiste, gravarVitrine, lerVitrine, montarVitrine, proximoPasso, resumo, urlDaWebDeTeste, webResponde } = await import('./escola.ts')

const dizer = (texto: string): void => void process.stdout.write(`${texto}\n`)
const avisar = (texto: string): void => void process.stderr.write(`${texto}\n`)

const SEM_VITRINE = 'Não há vitrine montada neste checkout. Rode: node tools/vitrine/vitrine.ts montar'
const SEM_WEB =
  'A web do ambiente de teste não responde. Ela sobe com o e2e, que também a reconstrói: node tools/ci/e2e.ts --manter-ambiente e2e/<arquivo>.spec.ts'
const RECRIADO = 'A escola da vitrine não existe mais: o banco de teste foi recriado. Rode: node tools/vitrine/vitrine.ts montar'

async function principal(comando: string | undefined, argumentos: readonly string[]): Promise<number> {
  if ((comando === 'montar' || comando === 'foto') && !(await webResponde(urlDaWebDeTeste()))) {
    avisar(SEM_WEB)
    return 1
  }
  if (comando === 'montar') {
    const vitrine = await montarVitrine()
    gravarVitrine(vitrine)
    dizer(resumo(vitrine))
    return 0
  }
  const vitrine = lerVitrine()
  if (comando === 'mostrar') {
    if (vitrine === null || !(await escolaExiste(vitrine.escola.id))) {
      avisar(vitrine === null ? SEM_VITRINE : RECRIADO)
      return 1
    }
    dizer(resumo(vitrine))
    return 0
  }
  const vazia = argumentos.includes('--vazia')
  const escuro = argumentos.includes('--escuro')
  if (comando === 'codigo') {
    if (vitrine === null) {
      avisar(SEM_VITRINE)
      return 1
    }
    const { segredo, ultimoPasso } = acessosDa(vitrine, vazia).coordenacao
    if (segredo === null) {
      avisar('A coordenação da vitrine está sem segundo fator: a tela o configura no primeiro acesso.')
      return 1
    }
    const { passo, esperarSegundos } = proximoPasso(Date.now(), ultimoPasso)
    // Grava antes de mostrar: o código mostrado é dado como usado, para o pedido seguinte nunca repetir o passo.
    gravarVitrine(comPassoGasto(vitrine, vazia, passo))
    if (esperarSegundos > 0) avisar(`Este código só vale daqui a ${String(esperarSegundos)} s: espere antes de digitar.`)
    dizer(codigoDoPasso(segredo, passo))
    return 0
  }
  if (comando === 'foto') {
    // O Playwright só carrega para quem pede foto: montar e mostrar não precisam do navegador.
    const { ehPapel, fotografar, linhasDoResultado, PAPEIS } = await import('./foto.ts')
    const [papel, ...resto] = argumentos.filter((argumento) => argumento !== '--vazia' && argumento !== '--escuro')
    const cliques = resto.flatMap((argumento, indice) => (resto[indice - 1] === '--clicar' ? [argumento] : []))
    const caminhos = resto.filter((argumento, indice) => argumento !== '--clicar' && resto[indice - 1] !== '--clicar')
    if (!ehPapel(papel) || caminhos.length === 0) {
      avisar(`Uso: node tools/vitrine/vitrine.ts foto <${PAPEIS.join('|')}> <endereço>… [--clicar <seletor>]… [--vazia] [--escuro]`)
      return 2
    }
    if (vitrine === null || !(await escolaExiste(vitrine.escola.id))) {
      avisar(vitrine === null ? SEM_VITRINE : RECRIADO)
      return 1
    }
    const fotos = await fotografar(vitrine, papel, caminhos, { cliques, vazia, escuro })
    for (const linha of linhasDoResultado(fotos, vitrine.url, vazia)) dizer(linha)
    return 0
  }
  avisar('Uso: node tools/vitrine/vitrine.ts montar | mostrar | codigo | foto')
  return 2
}

if (import.meta.filename === process.argv[1]) {
  process.exitCode = await principal(process.argv[2], process.argv.slice(3))
}
