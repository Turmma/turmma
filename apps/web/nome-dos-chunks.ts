/**
 * O nome dos arquivos de JS do build (Tech Spec da A0, seção 9, "Orçamento"; Tech Spec da A1, seção 9, "Fronteira"). O
 * `.size-limit.json` mede cada grupo pelo nome: a entrada sozinha (`index-*.js`), a área do operador (`operacao-*.js`), a
 * fachada de cada papel da escola (`coordenacao-*.js`, `professor-*.js`, `aluno-*.js`) e as peças (`pecas-*.js`).
 *
 * **O primeiro carregamento não é medido por nome.** Ele é o que a entrada baixa de verdade: `index-*.js` e os pedaços
 * que ela importa estaticamente, direta e transitivamente — e nada além. Somar `index-*` e `parte-*` por glob, como até
 * o MVP de apresentação, contava também o `parte-*` que só as áreas dividem e que o aluno nunca baixa na entrada, e com
 * duas áreas de telas o glob passou a medir 20 kB que ninguém baixa às 7h30. A conta de verdade, com o teto
 * `TETO_DO_PRIMEIRO_CARREGAMENTO_EM_BYTES`, está no teste do build (`nome-dos-chunks.test.ts`), que percorre os `import`
 * dos pedaços como o navegador faz. Os nomes precisam ser garantidos aqui, e não deixados ao acaso do nome do módulo:
 *
 * - o chunk carregado por `import()` leva o nome do módulo de onde saiu, e um `import()` de um `index.tsx` viraria
 *   `index-*.js` e contaria contra a entrada. Por isso todo chunk que não é entrada nem área ganha o prefixo `parte-`;
 * - o chunk que sai de `src/operacao/` é `operacao-*.js`, qualquer que seja o arquivo da fachada;
 * - a fachada de cada área, `src/areas/<pasta>/rotas.tsx`, é `<pasta>-*.js`: leva o que o `rotas.tsx` importa direto (as
 *   telas da A1), e o teto da área mede esse pedaço;
 * - a **tela** que a área carrega por `lazy(() => import('./Tela'))` é `tela-<pasta>-<Tela>-*.js`, e o que só as telas
 *   de uma área dividem entre si sai com o mesmo prefixo. Não casa com o glob da área, nem com o do primeiro
 *   carregamento: quem abre Turmas não baixa a tela de Aprovar. O teto de cada tela é `TETO_DE_UMA_TELA_EM_BYTES`,
 *   conferido pelo teste do build, porque o glob do `size-limit` soma os arquivos e não mede um por um;
 * - o que sai de `src/galeria/` é `galeria-*.js`: a galeria das peças está no build porque o e2e roda sobre ele, e só
 *   quem digita o endereço dela a baixa;
 * - o pedaço **sem fachada** que só tem peças do MVP de apresentação (`componentes/ui/ia/` e as peças gerais listadas em
 *   `PECAS_FORA_DA_ENTRADA`) é `pecas-*.js`. É o pedaço que o Rolldown cria sozinho para o que duas áreas dividem. Como
 *   `parte-*`, ele contaria no teto do primeiro carregamento sem nunca ser baixado nele: as peças só chegam por
 *   `import()`, com a tela que as usa. O teste do build de verdade prova as duas metades — nenhuma peça na entrada nem
 *   no que ela baixa junto, e nada do que ela baixa junto com outro nome que não `parte-*`;
 * - o pedaço **com fachada** que é peça e só tem peças — a `OncaDaMarca`, que a casca pública busca por `import()` — também é
 *   `pecas-*.js`, com o nome da peça (`pecas-OncaDaMarca-*`): a onça cai em Peças, e não nasce pedaço `parte-*` para ela;
 *
 * Por nome, e não por `manualChunks`: no Rolldown do Vite 8 ele vira um grupo que, por padrão, puxa junto as
 * dependências dos módulos capturados (React, os componentes da entrada), e a entrada passaria a importar o chunk da
 * operação — o contrário do que se quer.
 */

/** O mínimo de um chunk que o nome precisa: o módulo de fachada, quando ele existe, e os módulos que ele leva. */
export interface ChunkParaNomear {
  readonly facadeModuleId: string | null
  readonly moduleIds?: readonly string[]
}

/** A pasta da área do operador, como aparece no id do módulo (sempre com `/`, também no Windows do Vite). */
const PASTA_DA_OPERACAO = '/apps/web/src/operacao/'

/** As pastas das áreas da escola, uma por papel, e o prefixo do chunk de cada uma, que é o nome da pasta. */
export const AREAS_DA_ESCOLA = ['coordenacao', 'professor', 'aluno'] as const

const PASTA_DAS_AREAS = '/apps/web/src/areas/'

export type AreaDaEscola = (typeof AREAS_DA_ESCOLA)[number]

/**
 * O teto de **uma** tela carregada por `import()`, em brotli: 30 kB. No Fast 3G do Chromebook de entrada são perto de
 * 0,2 s de rede e, com a CPU quatro vezes mais lenta, perto de 0,15 s para ler o JS, somados ao pedaço das peças que a
 * tela usa. É teto, não meta: as três telas da coordenação da A1, juntas, pesam 13 kB.
 */
export const TETO_DE_UMA_TELA_EM_BYTES = 30_000

/**
 * O teto do primeiro carregamento da escola, em brotli: 150 kB sobre a entrada e os pedaços que ela importa
 * estaticamente (regra 50, item 1; `docs/interface.md` 10.4). É o que o Chromebook do aluno baixa às 7h30 antes de ver
 * qualquer tela; o pedaço que só uma área usa não entra nesta conta, e responde ao teto dela.
 */
export const TETO_DO_PRIMEIRO_CARREGAMENTO_EM_BYTES = 150_000

/** A área a que um módulo pertence: a pasta dele em `src/areas/`. Fora delas, nenhuma. */
export function areaDoModulo(idDoModulo: string): AreaDaEscola | undefined {
  const id = idDoModulo.replaceAll('\\', '/')
  return AREAS_DA_ESCOLA.find((pasta) => id.includes(`${PASTA_DAS_AREAS}${pasta}/`))
}

/** A fachada da área é o `rotas.tsx` da pasta dela, e só ele: qualquer outro módulo de lá que vire pedaço é tela. */
function ehFachadaDaArea(idDoModulo: string, area: AreaDaEscola): boolean {
  return new RegExp(`${PASTA_DAS_AREAS}${area}/rotas\\.tsx?$`).test(idDoModulo.replaceAll('\\', '/').replace(/[?#].*$/, ''))
}

/** A área de um pedaço sem fachada: a única que tem módulo nele. Com módulos de duas áreas, ou de nenhuma, não é de área. */
function areaDoPedacoDividido(idsDosModulos: readonly string[]): AreaDaEscola | undefined {
  const areas = new Set(idsDosModulos.map(areaDoModulo).filter((area) => area !== undefined))
  return areas.size === 1 ? [...areas][0] : undefined
}

/** A pasta da galeria das peças, que só existe para o e2e e para quem desenvolve. */
const PASTA_DA_GALERIA = '/apps/web/src/galeria/'

const PASTA_DA_WEB = '/apps/web/src/'
const PASTA_DOS_COMPONENTES = '/apps/web/src/componentes/'
const PASTA_DAS_PECAS_DE_IA = '/apps/web/src/componentes/ui/ia/'

/**
 * As peças gerais do MVP de apresentação (`docs/mvp-rapido.md` 9.3) que **não** estão no primeiro carregamento: os
 * arquivos de `src/componentes/`, sem a extensão. As de IA são a pasta `componentes/ui/ia/` inteira. O `Botao`, o `Dialogo`,
 * o `Campo` e os estados não entram na lista: a entrada os usa, e eles pesam no teto dela.
 *
 * A peça que uma tela da entrada passar a usar **sai daqui**: o teste do build reprova a peça da lista que aparecer no
 * primeiro carregamento, em vez de deixá-la passar sem ser medida.
 */
export const PECAS_FORA_DA_ENTRADA = [
  'ajustes/TamanhoDaLetra',
  'introducao/Balao',
  'introducao/Introducao',
  'introducao/TelaDeFoco',
  'sino/leitura-do-sino',
  'sino/Sino',
  'ui/Abas',
  'ui/Aviso',
  'ui/barra',
  'ui/BarraPresa',
  'ui/BarraRotulada',
  'ui/campos/Busca',
  'ui/campos/CampoLongo',
  'ui/campos/Interruptor',
  'ui/campos/Opcao',
  'ui/campos/Selecao',
  'ui/campos/texto-longo',
  'ui/Cartao',
  'ui/Comemoracao',
  'ui/Contador',
  'ui/Faixa',
  'ui/Linha',
  'ui/midia',
  'ui/NumeroPainel',
  'ui/onca/CabecaOnca',
  'ui/onca/DesenhoDaOnca',
  'ui/onca/geometria',
  'ui/onca/movimento-da-onca',
  'ui/onca/Onca',
  'ui/onca/OncaDaMarca',
  'ui/SeloDeEstado',
  'ui/sobrepostos/DialogoDeConfirmacao',
  'ui/sobrepostos/flutuante',
  'ui/sobrepostos/Menu',
  'ui/sobrepostos/PainelLado',
  'ui/sobrepostos/teclado-do-menu',
  'ui/Tabela',
  'ui/teclado-das-abas',
  'ui/Tela',
  'ui/Toque',
] as const

/** O módulo é uma peça que fica fora do primeiro carregamento? */
export function ehPecaForaDaEntrada(idDoModulo: string): boolean {
  const id = idDoModulo.replaceAll('\\', '/').replace(/[?#].*$/, '')
  if (id.includes(PASTA_DAS_PECAS_DE_IA)) return true
  const posicao = id.indexOf(PASTA_DOS_COMPONENTES)
  if (posicao === -1) return false
  // O estilo que mora ao lado da peça (`onca/Onca.css`) é da peça: sem ele, o pedaço que a galeria e a tarefa aberta dividem
  // deixaria de ser `pecas-*` e cairia em `parte-*`, que o teto do primeiro carregamento mediria sem ela estar nele.
  const arquivo = id.slice(posicao + PASTA_DOS_COMPONENTES.length).replace(/\.(?:tsx?|css)$/, '')
  return (PECAS_FORA_DA_ENTRADA as readonly string[]).includes(arquivo)
}

/**
 * O pedaço só tem peças? Conta o código da web: os módulos de fora (`node_modules`, `packages/shared`) acompanham quem
 * os usa. Pedaço sem nenhum módulo da web não é de peças.
 */
function soTemPecas(idsDosModulos: readonly string[]): boolean {
  const daWeb = idsDosModulos.filter((id) => id.replaceAll('\\', '/').includes(PASTA_DA_WEB))
  return daWeb.length > 0 && daWeb.every(ehPecaForaDaEntrada)
}

/** O nome do pedaço sem fachada: o que as telas de uma área dividem é da área, o que só tem peças é `pecas-*`, e o resto é `parte-*`. */
function nomeDoPedacoSemFachada(modulos: readonly string[]): string {
  // O que duas telas da mesma área dividem é pedaço daquela área. Com módulo de duas áreas, o pedaço fica `parte-*`, e
  // o teste do build o reprova: tela de uma área não importa módulo de outra.
  const areaDoDividido = areaDoPedacoDividido(modulos)
  if (areaDoDividido !== undefined) return `assets/tela-${areaDoDividido}-[name]-[hash].js`
  return soTemPecas(modulos) ? 'assets/pecas-[name]-[hash].js' : 'assets/parte-[name]-[hash].js'
}

/** O nome do pedaço que tem fachada fora da operação e da galeria: a fachada de uma área, uma tela dela, uma peça ou o resto. */
function nomeDoPedacoComFachada(fachada: string, modulos: readonly string[] | undefined): string {
  const area = areaDoModulo(fachada)
  if (area !== undefined) return ehFachadaDaArea(fachada, area) ? `assets/${area}-[hash].js` : `assets/tela-${area}-[name]-[hash].js`
  // A peça que a entrada busca por `import()` (a onça da marca da `CascaPublica`) tem fachada, e por isso o ramo do pedaço sem
  // fachada não a alcança: sem esta linha ela cairia em `parte-*`, que o teto do primeiro carregamento mede sem ela estar nele.
  if (ehPecaForaDaEntrada(fachada) && soTemPecas(modulos ?? [fachada])) return 'assets/pecas-[name]-[hash].js'
  return 'assets/parte-[name]-[hash].js'
}

export function nomeDoChunk(chunk: ChunkParaNomear): string {
  const fachada = chunk.facadeModuleId?.replaceAll('\\', '/')
  if (fachada === undefined) return nomeDoPedacoSemFachada(chunk.moduleIds ?? [])
  if (fachada.includes(PASTA_DA_OPERACAO)) return 'assets/operacao-[hash].js'
  if (fachada.includes(PASTA_DA_GALERIA)) return 'assets/galeria-[hash].js'
  return nomeDoPedacoComFachada(fachada, chunk.moduleIds)
}
