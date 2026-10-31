import type { Locator, Page } from '@playwright/test'
import { mensagemDoSegundoFator } from '../../packages/shared/src/errors/messages.ts'
import { carregarSemRedeLenta, expect } from './profiles.ts'
import { campoCodigo } from './mfa.ts'
import { codigoDoAutenticador, criarEquipeComSenha, type ConviteDeCoordenadorDeTeste, type EquipeDeTeste } from './seed.ts'

/**
 * A casca da escola pela tela (A1, tarefa 11.0; X1, 13.0): abaixo de 768 px a lateral é uma gaveta que abre pelo botão do
 * menu, e os itens do professor e do aluno ficam na **barra de baixo**, sempre à vista; no computador a lateral já está
 * aberta. A coordenação tem os quatro lugares dela na barra de baixo, como o professor e o aluno. Os specs que andam pela navegação passam por aqui, para
 * o mesmo teste valer nos projetos `chromebook` e `celular` (D51).
 */

/**
 * A casca está na largura do celular: a barra do topo com o botão do menu e a lateral fechada, na gaveta. Não diz onde
 * estão os itens de `Seções` (a barra de baixo ou a gaveta): quem pergunta isso é `secoes`.
 */
export function naGaveta(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) < 768
}

/** A gaveta aberta, o `dialog` modal com a lateral dentro. */
export const gaveta = (page: Page): Locator => page.getByRole('dialog', { name: 'Menu' })

/**
 * Onde a lateral está agora: dentro da gaveta, quando é gaveta, ou a página. Com a gaveta aberta, o "Sair" da barra do
 * topo continua na página, atrás dela: procurar a partir daqui acha o da lateral. Vale para a escola, o
 * rodapé, "Sua conta" e o nome da pessoa; **não vale para `Seções` do professor e do aluno no celular**, que estão na
 * barra de baixo, fora da gaveta: para eles, `secoes`.
 */
export function lateral(page: Page): Locator {
  return naGaveta(page) ? gaveta(page) : page.locator('body')
}

/**
 * A `navigation "Seções"` que a pessoa vê: a barra de baixo (professor e aluno abaixo de 768 px, sempre à vista), a
 * lateral ou o trilho (a partir de 768 px) ou, com a gaveta aberta, a que está dentro dela (a coordenação no celular).
 * Fechada, a gaveta não expõe nada. É a única navegação com esse nome na página: o resto da casca tem os dela ("Rodapé",
 * "Sua conta").
 */
export const secoes = (page: Page): Locator => page.getByRole('navigation', { name: 'Seções', exact: true })

/**
 * O lugar que a barra de baixo toma da janela agora (X1, 13.0): a `--barra-baixo` do `<html>` e o `padding-bottom` do
 * `<main>`, que guarda a variável mais 32 px. Sem barra (a coordenação no celular, o trilho e o computador) a variável é
 * `0px` e o `<main>` guarda só os 32 px.
 */
export async function reservaDaBarraDeBaixo(page: Page): Promise<{ readonly variavel: string; readonly paddingDoMain: string }> {
  return page.evaluate(() => {
    const principal = document.querySelector('main')
    return {
      variavel: getComputedStyle(document.documentElement).getPropertyValue('--barra-baixo').trim(),
      paddingDoMain: principal === null ? '' : getComputedStyle(principal).paddingBottom,
    }
  })
}

/** Abre a gaveta, se a casca está nela e ela ainda está fechada; no computador não faz nada. */
export async function abrirNavegacao(page: Page, hasTouch: boolean): Promise<void> {
  if (!naGaveta(page) || (await gaveta(page).isVisible())) return
  const menu = page.getByRole('button', { name: 'Abrir o menu' })
  if (hasTouch) await menu.tap()
  else await menu.click()
  await expect(gaveta(page)).toBeVisible()
}

/**
 * A sessão chegou quando a barra do topo mostra o nome da escola, que vem do `/v1/eu`. Os itens da navegação só chegam com ela,
 * e a barra do topo com o botão do menu já está na tela antes: depois de um recarregamento, abrir a gaveta sem esperar a
 * deixaria aberta por cima da barra de baixo que aparece em seguida.
 */
async function esperarASessaoNaBarraDoTopo(page: Page): Promise<void> {
  await expect(page.getByRole('banner').locator('p').first(), 'a sessão (o /v1/eu) não chegou: a barra do topo está sem o nome da escola').not.toBeEmpty({
    timeout: PRAZO_DA_ENTRADA_MS,
  })
}

/**
 * Vai a uma seção pelo link dela em `Seções`. A gaveta só abre quando `Seções` não está à vista (a coordenação no
 * celular); a barra de baixo do professor e do aluno está sempre à vista. E com a gaveta aberta por outro motivo (o
 * teste foi ver a escola ou a conta), a barra fica inerte: o toque nela cairia no fundo da gaveta e só a fecharia. Por
 * isso a gaveta que não leva `Seções` fecha antes.
 */
export async function irPelaNavegacao(page: Page, rotulo: string, hasTouch: boolean): Promise<void> {
  if ((await gaveta(page).isVisible()) && (await gaveta(page).getByRole('navigation', { name: 'Seções', exact: true }).count()) === 0) {
    await page.keyboard.press('Escape')
    await expect(gaveta(page)).toBeHidden()
  }
  if (!(await secoes(page).first().isVisible())) {
    if (naGaveta(page)) await esperarASessaoNaBarraDoTopo(page)
    if (!(await secoes(page).first().isVisible())) await abrirNavegacao(page, hasTouch)
  }
  const item = secoes(page).getByRole('link', { name: rotulo })
  if (hasTouch) await item.tap()
  else await item.click()
}

/**
 * O botão que abre o seletor de escola, no topo da lateral (P30; A1, 12.0). Só existe para quem tem mais de uma escola;
 * com uma só, a lateral mostra o nome dela e não há o que abrir. O nome acessível começa por "Escola:", que as linhas da
 * lista não têm.
 */
export const botaoDoSeletor = (page: Page): Locator => lateral(page).getByRole('button', { name: /^Escola: / })

/** O nome acessível da linha de uma escola no seletor: a escola, a rede e o papel, como a lista os mostra. */
export function nomeNoSeletor(acesso: { readonly escolaNome: string; readonly redeNome: string }, papel: 'professor' | 'coordenação'): string {
  return `${acesso.escolaNome}, ${acesso.redeNome} · ${papel}`
}

/** A linha de uma escola na lista aberta do seletor, pelo nome exato (o botão que abre a lista leva o da escola de agora). */
export const linhaDoSeletor = (page: Page, nome: string): Locator => lateral(page).getByRole('button', { name: nome, exact: true })

/** Abre o seletor de escola, abrindo antes a gaveta quando a casca está nela. */
export async function abrirSeletorDeEscola(page: Page, hasTouch: boolean): Promise<void> {
  await abrirNavegacao(page, hasTouch)
  const botao = botaoDoSeletor(page)
  if (hasTouch) await botao.tap()
  else await botao.click()
  await expect(botao).toHaveAttribute('aria-expanded', 'true')
}

/** Abre o seletor e escolhe a escola daquela linha. */
export async function escolherNoSeletor(page: Page, nome: string, hasTouch: boolean): Promise<void> {
  await abrirSeletorDeEscola(page, hasTouch)
  const linha = linhaDoSeletor(page, nome)
  if (hasTouch) await linha.tap()
  else await linha.click()
}

/** O Chromebook com CPU ×4 e rede Fast 3G carrega a página e ainda faz o hash da senha no servidor. */
export const PRAZO_DA_ENTRADA_MS = 20_000

/** Um passo do TOTP à frente: a ativação grava o passo usado, e só um passo maior entra depois (6.0 do F1). */
const PASSO_SEGUINTE_SEGUNDOS = 30

/** A ativação do segundo fator tenta duas vezes: a segunda cobre o Redis de fila que parou por um instante na esteira. */
const TENTATIVAS_DA_ATIVACAO = 2

async function acionar(alvo: Locator, hasTouch: boolean): Promise<void> {
  if (hasTouch) await alvo.tap()
  else await alvo.click()
}

/** Entra por e-mail e senha a partir da tela de entrada já aberta, sem recarregar a página. */
export async function entrarPorEmail(page: Page, pessoa: Pick<EquipeDeTeste, 'email' | 'senha'>, hasTouch: boolean): Promise<void> {
  await page.getByLabel('E-mail').fill(pessoa.email)
  await page.getByLabel('Senha').fill(pessoa.senha)
  await acionar(page.getByRole('button', { name: /^Entrar$/ }), hasTouch)
}

/**
 * O título da aba na tela em que o professor abre: "Início" (D80; era "Nova conversa"), no mesmo endereço
 * `/professor/nova-conversa`. O nome da constante é o de antes, para os specs que a importam não mudarem.
 */
export const TITULO_DA_NOVA_CONVERSA = 'Início · Turmma'

/**
 * O professor abre em "Início" (A2; D73; D80; `docs/interface.md` 11.1), a Home com a caixa de pedido, e não numa página
 * de passagem: o endereço (`/professor/nova-conversa`, que não mudou), a saudação com o primeiro nome dele e, na lateral,
 * o nome inteiro de quem entrou. É o que prova que a sessão vale e de quem ela é: a saudação sozinha não distingue duas
 * professoras de mesmo primeiro nome.
 *
 * No celular a lateral é a gaveta, fechada: o nome está nela, fora da vista, e o teste o lê sem abri-la. A escola ativa
 * está na barra de topo.
 */
export async function esperarNovaConversa(page: Page, nome: string, opcoes: { readonly timeout?: number; readonly escolaNome?: string } = {}): Promise<void> {
  const timeout = opcoes.timeout ?? PRAZO_DA_ENTRADA_MS
  await expect(page).toHaveURL(/\/professor\/nova-conversa$/, { timeout })
  const primeiroNome = (nome.trim().split(/\s+/)[0] ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  await expect(page.getByText(new RegExp(`^(Bom dia|Boa tarde|Boa noite), ${primeiroNome}\\.$`))).toBeVisible({ timeout })
  await expect(naGaveta(page) ? page.locator('dialog[aria-label="Menu"]') : page.locator('body')).toContainText(nome, { timeout })
  if (opcoes.escolaNome !== undefined) await expect(page.getByText(opcoes.escolaNome).first()).toBeVisible({ timeout })
}

/**
 * Na turma aberta do professor, o acesso da sala e os pedidos de nome ficam na aba **"Alunos"** (A3; D69): a turma abre
 * em Hoje, com o acerto por habilidade. Cada vez que a turma é aberta de novo (outro endereço, voltar pelo
 * histórico), ela abre em Hoje outra vez (a menos que o endereço guarde a aba).
 */
export async function abrirAbaAlunos(page: Page, hasTouch: boolean): Promise<void> {
  const aba = page.getByRole('tab', { name: 'Alunos' })
  if (hasTouch) await aba.tap({ timeout: PRAZO_DA_ENTRADA_MS })
  else await aba.click({ timeout: PRAZO_DA_ENTRADA_MS })
  await expect(aba).toHaveAttribute('aria-selected', 'true')
}

/** A professora de uma escola só, em "Início", onde ela abre. */
export async function entrarComoProfessora(page: Page, hasTouch: boolean): Promise<EquipeDeTeste> {
  const professora = await criarEquipeComSenha()
  await page.goto('/entrar')
  await entrarPorEmail(page, professora, hasTouch)
  await esperarNovaConversa(page, professora.nome)
  return professora
}

/**
 * A mesma entrada pela API, com a **primeira carga** (o endereço e a primeira tela, que `aguardar` espera) sem a rede do perfil
 * (`carregarSemRedeLenta`): a receita de `abrirPelaApiSemMedirAPrimeiraCarga` (`mfa.ts`) para quem não tem segundo
 * fator. A CPU do perfil continua, e a rede do perfil volta quando a função devolve.
 *
 * **O que ele não mede:** quanto a aplicação leva para baixar e abrir na rede lenta, nem a entrada pela tela (senha, escolha de
 * escola), que tem os casos dela em `entrar.spec.ts`. Caso cujo assunto é um desses dois não usa este ajudante.
 *
 * **Segunda pessoa na mesma aba:** o caso sobre isolamento (a aba não mostra dado da pessoa anterior) continua com o login da segunda
 * pessoa **pela tela**; só a primeira pode entrar por aqui. Trocar esse login pela API num ajuste de prazo esvazia a prova da regra 10
 * (item 5) e da regra 20 (item 5): ele é o que faz a aba ter o cache da primeira.
 */
export async function entrarPelaApiSemMedirAPrimeiraCarga(
  page: Page,
  pessoa: Pick<EquipeDeTeste, 'email' | 'senha'>,
  endereco: string,
  aguardar?: () => Promise<void>,
  usuarioId?: string,
): Promise<void> {
  await carregarSemRedeLenta(page, async () => {
    await entrarPelaApi(page, pessoa, endereco, usuarioId)
    await aguardar?.()
  })
}

/** `entrarComoProfessora` sem pagar a entrada pela tela nem a rede lenta na primeira carga: para o caso cujo assunto vem depois da entrada. */
export async function entrarComoProfessoraPelaApi(page: Page): Promise<EquipeDeTeste> {
  const professora = await criarEquipeComSenha()
  await entrarPelaApiSemMedirAPrimeiraCarga(page, professora, '/professor/nova-conversa', () => esperarNovaConversa(page, professora.nome))
  return professora
}

/**
 * A coordenação abre no Painel (telas da coordenação, 3.0; D80; `docs/interface.md` 11.1), e não mais em Governança: o endereço e a
 * tela. O endereço vem da página inicial, na entrada; a tela, do pedaço dela, que a área carrega por `import()`, e por isso o teste
 * que segura o chunk da área confere só o endereço. **É o único lugar** que diz onde a coordenação abre.
 */
export async function esperarPainel(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/coordenacao\/painel$/, { timeout: PRAZO_DA_ENTRADA_MS })
  await expect(page.getByRole('heading', { level: 1, name: 'Painel' })).toBeAttached({ timeout: PRAZO_DA_ENTRADA_MS })
}

/** A Estrutura da coordenação aberta (A1, 13.0), que é a aba Turmas de Escola: o endereço e a moldura. */
export async function esperarEstrutura(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/coordenacao\/estrutura$/, { timeout: PRAZO_DA_ENTRADA_MS })
  await expect(page.getByRole('heading', { level: 1, name: 'Escola' })).toBeAttached({ timeout: PRAZO_DA_ENTRADA_MS })
}

/**
 * A coordenação que acabou de entrar vai à Estrutura: **confere que abriu no Painel** e segue pelo lugar Escola da lateral,
 * sem recarregar a página, que abre em Turmas. É o caminho de quem monta a escola.
 */
export async function abrirEstrutura(page: Page, hasTouch: boolean): Promise<void> {
  await esperarPainel(page)
  await irPelaNavegacao(page, 'Escola', hasTouch)
  await esperarEstrutura(page)
}

/** O aviso que a tela de ativação mostra quando a API recusa o código: o do código errado, o do já usado e o do Redis de fila parado são o mesmo. */
const RECUSA_DA_ATIVACAO = mensagemDoSegundoFator('NAO_AUTENTICADO')

/**
 * Digita o código e ativa o segundo fator, e espera a tela dizer o que aconteceu: o link "Ir para a entrada" (ativou) ou o aviso de recusa.
 *
 * Com o disco da esteira ocupado, o Redis de fila pode passar dos 2 s do compose de teste, e a API recusa o desafio sem a marca dele
 * (`login.desafio_sem_redis`, de propósito) **antes de gastar o código e o desafio**: a tela mostra o aviso do código errado, e o mesmo
 * código, no mesmo desafio, vale na tentativa seguinte. Por isso a recusa tem uma segunda tentativa, com o código do passo de agora. Uma recusa
 * que se repete é do código ou da API, e falha aqui, dizendo o que a tela mostrava, em vez de esperar o link até o fim do relógio do teste.
 */
async function ativarOSegundoFator(page: Page, segredo: string, hasTouch: boolean): Promise<void> {
  const ativou = page.getByRole('link', { name: 'Ir para a entrada' })
  const recusa = page.getByRole('alert').filter({ hasText: RECUSA_DA_ATIVACAO })
  for (let tentativa = 1; tentativa <= TENTATIVAS_DA_ATIVACAO; tentativa += 1) {
    await campoCodigo(page).fill(codigoDoAutenticador(segredo))
    await acionar(page.getByRole('button', { name: /Ativar o segundo fator|Ativando/ }), hasTouch)
    await expect(ativou.or(recusa)).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
    if (await ativou.isVisible()) return
  }
  throw new Error(`A API recusou a ativação do segundo fator ${String(TENTATIVAS_DA_ATIVACAO)} vezes seguidas, com o código do passo de agora: "${RECUSA_DA_ATIVACAO}"`)
}

/**
 * A coordenadora no primeiro acesso, a partir da tela de entrada já aberta e sem recarregar a página: configura o
 * segundo fator do jeito sem celular, volta à entrada e entra com o código. Sem recarga, o que o teste afirma sobre o
 * cache da pessoa anterior na mesma aba continua valendo. Termina com a aba no endereço do Painel, onde a coordenação
 * abre; quem precisa da tela chama `esperarPainel`, e quem vai montar a escola, `abrirEstrutura`.
 */
export async function entrarComoCoordenacaoNaMesmaAba(page: Page, coordenadora: EquipeDeTeste, hasTouch: boolean): Promise<void> {
  const respostaDoSegredo = page.waitForResponse((resposta) => new URL(resposta.url()).pathname === '/v1/conta/mfa/configurar')
  await entrarPorEmail(page, coordenadora, hasTouch)
  await expect(page.getByRole('heading', { name: 'Configurar o segundo fator' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
  const { segredo } = (await (await respostaDoSegredo).json()) as { segredo: string }
  await ativarOSegundoFator(page, segredo, hasTouch)
  await acionar(page.getByRole('link', { name: 'Ir para a entrada' }), hasTouch)
  await entrarPorEmail(page, coordenadora, hasTouch)
  await expect(page.getByRole('heading', { name: 'Segundo fator' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
  await campoCodigo(page).fill(codigoDoAutenticador(segredo, PASSO_SEGUINTE_SEGUNDOS))
  await acionar(page.getByRole('button', { name: /^Entrar$/ }), hasTouch)
  await expect(page).toHaveURL(/\/coordenacao\/painel$/, { timeout: PRAZO_DA_ENTRADA_MS })
}

/**
 * A coordenadora cujo segundo fator já está configurado (pela API) entra pela tela, a partir da tela de entrada já aberta e sem recarregar
 * a página: senha, e o código do passo seguinte ao da ativação. Termina na tela que a primeira entrada abre; quem chama confere qual é.
 */
export async function entrarPelaTelaComSegundoFator(page: Page, coordenadora: Pick<EquipeDeTeste, 'email' | 'senha'>, segredo: string, hasTouch: boolean): Promise<void> {
  await entrarPorEmail(page, coordenadora, hasTouch)
  await expect(page.getByRole('heading', { name: 'Segundo fator' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
  await campoCodigo(page).fill(codigoDoAutenticador(segredo, PASSO_SEGUINTE_SEGUNDOS))
  await acionar(page.getByRole('button', { name: /^Entrar$/ }), hasTouch)
}

/**
 * A coordenadora que chega pelo link do convite (`criarConviteDeCoordenador`): aceita, define a senha, configura o segundo fator do jeito
 * sem celular, volta à entrada e entra com o código. Termina na tela que a primeira entrada abre; quem chama confere qual é (a
 * introdução, se a pessoa ainda não a viu, ou o Painel).
 */
export async function entrarComoCoordenacaoPeloConvite(page: Page, convite: ConviteDeCoordenadorDeTeste, senha: string, hasTouch: boolean): Promise<void> {
  await page.goto(`/convite#${convite.token}`)
  await expect(page.getByRole('main')).toContainText(convite.escolaNome, { timeout: PRAZO_DA_ENTRADA_MS })
  await acionar(page.getByRole('button', { name: /Aceitar o convite|Aceitando/ }), hasTouch)
  await page.getByLabel('Senha nova').fill(senha, { timeout: PRAZO_DA_ENTRADA_MS })
  const respostaDoSegredo = page.waitForResponse((resposta) => new URL(resposta.url()).pathname === '/v1/conta/mfa/configurar')
  await acionar(page.getByRole('button', { name: /Definir a senha e continuar|Salvando/ }), hasTouch)
  await expect(page.getByRole('heading', { name: 'Configurar o segundo fator' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
  const { segredo } = (await (await respostaDoSegredo).json()) as { segredo: string }
  await ativarOSegundoFator(page, segredo, hasTouch)
  await acionar(page.getByRole('link', { name: 'Ir para a entrada' }), hasTouch)
  await entrarPorEmail(page, { email: convite.email, senha }, hasTouch)
  await expect(page.getByRole('heading', { name: 'Segundo fator' })).toBeVisible({ timeout: PRAZO_DA_ENTRADA_MS })
  await campoCodigo(page).fill(codigoDoAutenticador(segredo, PASSO_SEGUINTE_SEGUNDOS))
  await acionar(page.getByRole('button', { name: /^Entrar$/ }), hasTouch)
}

/** O título da aba na tela em que o aluno abre. */
export const TITULO_DO_INICIO_DO_ALUNO = 'Início · Turmma'

/**
 * O aluno abre em "Início" (X4, 2.0), e não mais em "Atividades" (A3) nem na página de passagem: o endereço, a tela e, na
 * lateral, o nome de quem entrou e o papel. É o que prova que a sessão vale e de quem ela é, como a saudação "Olá, <nome>"
 * provava antes. O `h1` de "Início" existe só para o leitor de tela (a conversa é a exceção do título visível), e por isso a
 * espera é por ele **no documento**, e não à vista.
 *
 * No celular a lateral é a gaveta, fechada: o nome está nela, fora da vista, e o teste o lê sem abri-la.
 */
export async function esperarInicioDoAluno(page: Page, nome: string, opcoes: { readonly timeout?: number; readonly escolaNome?: string } = {}): Promise<void> {
  const timeout = opcoes.timeout ?? PRAZO_DA_ENTRADA_MS
  const lateralDaCasca = naGaveta(page) ? page.locator('dialog[aria-label="Menu"]') : page.locator('body')
  // As esperas correm juntas: em série, cada uma pagaria a sua ida ao navegador, e o caso de 15 s não tem de sobra.
  await Promise.all([
    expect(page).toHaveURL(/\/aluno\/inicio$/, { timeout }),
    expect(page.getByRole('main').getByRole('heading', { level: 1, name: 'Início' })).toBeAttached({ timeout }),
    expect(lateralDaCasca).toContainText(nome, { timeout }),
    expect(lateralDaCasca).toContainText('aluno', { timeout }),
    ...(opcoes.escolaNome !== undefined ? [expect(lateralDaCasca).toContainText(opcoes.escolaNome, { timeout })] : []),
  ])
}

type DadosDeEntradaDoAluno = { readonly slug: string; readonly matricula: string; readonly senha: string; readonly nome: string }

/** Preenche a matrícula e a senha na entrada da escola e aciona "Entrar"; quem chama espera a tela em que a pessoa cai. */
async function entrarPelaTelaDaEscola(page: Page, aluno: Pick<DadosDeEntradaDoAluno, 'slug' | 'matricula' | 'senha'>, hasTouch: boolean): Promise<void> {
  await page.goto(`/e/${aluno.slug}`)
  await page.getByLabel('Matrícula').fill(aluno.matricula)
  await page.getByLabel('Senha').fill(aluno.senha)
  await acionar(page.getByRole('button', { name: /^Entrar$/ }), hasTouch)
}

/** O aluno entra pelo endereço da escola, com matrícula e senha, e chega a "Início", onde ele abre. */
export async function entrarComoAluno(page: Page, aluno: DadosDeEntradaDoAluno, hasTouch: boolean): Promise<void> {
  await entrarPelaTelaDaEscola(page, aluno, hasTouch)
  await esperarInicioDoAluno(page, aluno.nome)
}

/**
 * As quatro falas da introdução do aluno (telas do aluno e primeiro acesso, 9.0), na ordem dos passos: o Tutor, quem dá a aula, o
 * aviso de privacidade e o tamanho da letra. Texto de `areas/aluno/introducao/textos-da-introducao.ts`, copiado aqui porque
 * `e2e/` não importa a web. `textos-da-introducao.test.ts` confere esta lista com os passos: se o texto mudar num lugar só, ele reprova.
 */
export const FALAS_DA_INTRODUCAO_DO_ALUNO = [
  'Oi! Eu sou o Tutor, um programa da escola.',
  'Quem dá a aula acompanha como você usa o Tutor.',
  'Veja o que a escola guarda de você.',
  'Qual tamanho de letra fica bom para você?',
] as const

/** A fala do passo `n` (a partir de 1), o `h1` da tela de foco. */
export const falaDoPasso = (page: Page, n: number): Locator => page.getByRole('main').getByRole('heading', { level: 1, name: FALAS_DA_INTRODUCAO_DO_ALUNO[n - 1] ?? '', exact: true })

/**
 * A primeira entrada do aluno: o endereço é o da introdução e a fala do passo 1 está na tela. A espera é pelo endereço e pela
 * fala juntos (cada uma paga a sua ida ao navegador, e o caso de 15 s não tem de sobra).
 */
export async function esperarIntroducaoDoAluno(page: Page, opcoes: { readonly timeout?: number } = {}): Promise<void> {
  const timeout = opcoes.timeout ?? PRAZO_DA_ENTRADA_MS
  await Promise.all([expect(page).toHaveURL(/\/aluno\/bem-vindo$/, { timeout }), expect(falaDoPasso(page, 1)).toBeVisible({ timeout })])
}

/** O aluno entra pelo endereço da escola e cai na introdução, como na primeira entrada. */
export async function entrarComoAlunoNaPrimeiraVez(page: Page, aluno: Pick<DadosDeEntradaDoAluno, 'slug' | 'matricula' | 'senha'>, hasTouch: boolean): Promise<void> {
  await entrarPelaTelaDaEscola(page, aluno, hasTouch)
  await esperarIntroducaoDoAluno(page)
}

/** Os quatro "Continuar" da introdução, um por passo, e a chegada ao "Início". Quem chama já está no passo 1. */
export async function seguirAteOFimDaIntroducao(page: Page, hasTouch: boolean): Promise<void> {
  for (let passo = 1; passo <= FALAS_DA_INTRODUCAO_DO_ALUNO.length; passo++) {
    await expect(falaDoPasso(page, passo)).toBeVisible()
    await acionar(page.getByRole('button', { name: 'Continuar', exact: true }), hasTouch)
  }
}

/**
 * A aluna criada pela tela (reivindicou o nome, foi aprovada) entra pela primeira vez: passa pela introdução, e só então chega
 * ao "Início". O fluxo dela não prova a introdução (`aluno-introducao.spec.ts` prova), mas ela está no caminho.
 */
export async function passarPelaIntroducaoDoAluno(page: Page, nome: string, hasTouch: boolean): Promise<void> {
  await esperarIntroducaoDoAluno(page)
  await seguirAteOFimDaIntroducao(page, hasTouch)
  await esperarInicioDoAluno(page, nome)
}

/**
 * As quatro falas da introdução do professor (telas do aluno e primeiro acesso, 10.0), na ordem dos passos. Texto de
 * `areas/professor/introducao/textos-da-introducao.ts`, copiado aqui porque `e2e/` não importa a web. `textos-da-introducao.test.ts`
 * confere esta lista com os passos: se o texto mudar num lugar só, ele reprova.
 */
export const FALAS_DA_INTRODUCAO_DO_PROFESSOR = [
  'Eu preparo, você revê, e só então vai à turma.',
  'Só a resposta do Tutor chega ao aluno sem a sua aprovação, uma a uma.',
  'Eu não corrijo redação nem discursiva: ajudo com a rubrica e com a organização do lote.',
  'Usar ou não esta ferramenta não gera número sobre você.',
] as const

/** A fala do passo `n` (a partir de 1) da introdução do professor, o `h1` da tela de foco. */
export const falaDoPassoDoProfessor = (page: Page, n: number): Locator =>
  page.getByRole('main').getByRole('heading', { level: 1, name: FALAS_DA_INTRODUCAO_DO_PROFESSOR[n - 1] ?? '', exact: true })

/** A primeira entrada do professor: o endereço é o da introdução e a fala do passo 1 está na tela, esperados juntos. */
export async function esperarIntroducaoDoProfessor(page: Page, opcoes: { readonly timeout?: number } = {}): Promise<void> {
  const timeout = opcoes.timeout ?? PRAZO_DA_ENTRADA_MS
  await Promise.all([expect(page).toHaveURL(/\/professor\/bem-vindo$/, { timeout }), expect(falaDoPassoDoProfessor(page, 1)).toBeVisible({ timeout })])
}

/** Os quatro "Continuar" da introdução do professor, um por passo. Quem chama já está no passo 1; depois do último ele está no primeiro lugar. */
export async function seguirAteOFimDaIntroducaoDoProfessor(page: Page, hasTouch: boolean): Promise<void> {
  for (let passo = 1; passo <= FALAS_DA_INTRODUCAO_DO_PROFESSOR.length; passo++) {
    await expect(falaDoPassoDoProfessor(page, passo)).toBeVisible()
    await acionar(page.getByRole('button', { name: 'Continuar', exact: true }), hasTouch)
  }
}

/**
 * O professor criado pela tela (a coordenação o cadastrou, ele aceitou o convite) entra pela primeira vez: passa pela introdução, e só
 * então chega a "Início". O fluxo dele não prova a introdução (`professor-introducao.spec.ts` prova), mas ela está no caminho.
 */
export async function passarPelaIntroducaoDoProfessor(page: Page, nome: string, hasTouch: boolean): Promise<void> {
  await esperarIntroducaoDoProfessor(page)
  await seguirAteOFimDaIntroducaoDoProfessor(page, hasTouch)
  await esperarNovaConversa(page, nome)
}

/**
 * As falas da introdução da coordenação (telas do aluno e primeiro acesso, 11.0), na ordem dos passos. Texto de
 * `areas/coordenacao/introducao/textos-da-introducao.ts`, copiado aqui porque `e2e/` não importa a web: a do passo 1 leva o nome da
 * escola, e as outras três são fixas. `textos-da-introducao.test.ts` confere as duas cópias com os passos: se o texto mudar num lugar
 * só, ele reprova.
 */
export const falaDoPasso1DaCoordenacao = (escolaNome: string): string => `Eu ajudo a ler os números de ${escolaNome}.`
export const FALAS_DOS_PASSOS_2_A_4_DA_COORDENACAO = [
  'Você vê a escola em números agregados.',
  'Dado com nome só abre com um motivo, e isso fica registrado.',
  'Estas coisas a IA nunca faz.',
] as const
export const falasDaIntroducaoDaCoordenacao = (escolaNome: string): readonly string[] => [falaDoPasso1DaCoordenacao(escolaNome), ...FALAS_DOS_PASSOS_2_A_4_DA_COORDENACAO]

/** A fala do passo `n` (a partir de 1) da introdução da coordenação, o `h1` da tela de foco. */
export const falaDoPassoDaCoordenacao = (page: Page, n: number, escolaNome: string): Locator =>
  page.getByRole('main').getByRole('heading', { level: 1, name: falasDaIntroducaoDaCoordenacao(escolaNome)[n - 1] ?? '', exact: true })

/** A primeira entrada da coordenação: o endereço é o da introdução e a fala do passo 1 está na tela, esperados juntos. */
export async function esperarIntroducaoDaCoordenacao(page: Page, escolaNome: string, opcoes: { readonly timeout?: number } = {}): Promise<void> {
  const timeout = opcoes.timeout ?? PRAZO_DA_ENTRADA_MS
  await Promise.all([expect(page).toHaveURL(/\/coordenacao\/bem-vindo$/, { timeout }), expect(falaDoPassoDaCoordenacao(page, 1, escolaNome)).toBeVisible({ timeout })])
}

/** Os quatro "Continuar" da introdução da coordenação, um por passo. Quem chama já está no passo 1; depois do último ela está no Painel. */
export async function seguirAteOFimDaIntroducaoDaCoordenacao(page: Page, escolaNome: string, hasTouch: boolean): Promise<void> {
  for (let passo = 1; passo <= falasDaIntroducaoDaCoordenacao(escolaNome).length; passo++) {
    await expect(falaDoPassoDaCoordenacao(page, passo, escolaNome)).toBeVisible()
    await acionar(page.getByRole('button', { name: 'Continuar', exact: true }), hasTouch)
  }
}

/**
 * A coordenadora criada por convite entra pela primeira vez: passa pela introdução, e só então chega ao Painel. O fluxo dela não prova a
 * introdução (`coordenacao-introducao.spec.ts` prova), mas ela está no caminho.
 */
export async function passarPelaIntroducaoDaCoordenacao(page: Page, escolaNome: string, hasTouch: boolean): Promise<void> {
  await esperarIntroducaoDaCoordenacao(page, escolaNome)
  await seguirAteOFimDaIntroducaoDaCoordenacao(page, escolaNome, hasTouch)
  await esperarPainel(page)
}

/**
 * Entra pela API (`POST /v1/sessao/email`) no contexto da página e abre o endereço: o cookie de renovação fica no contexto, e a
 * aplicação restaura a sessão a partir dele, como num retorno à aba. É o atalho do caso que prova outra coisa que não a entrada
 * (a entrada pela tela tem os casos dela) e que, com o argon2 e a CPU ×4 do perfil, não cabe nos 15 s do portão com um login a mais.
 * Com a conta em mais de uma escola, `usuarioId` escolhe a escola (`POST /v1/sessao/escola`, com o desafio).
 */
export async function entrarPelaApi(page: Page, pessoa: Pick<EquipeDeTeste, 'email' | 'senha'>, endereco: string, usuarioId?: string): Promise<void> {
  const pedidos = page.context().request
  const entrada = await pedidos.post('/v1/sessao/email', { data: { email: pessoa.email, senha: pessoa.senha } })
  let corpo = (await entrada.json()) as { etapa?: string; desafio?: string }
  if (entrada.ok() && corpo.etapa === 'escolher' && usuarioId !== undefined && corpo.desafio !== undefined) {
    const escolha = await pedidos.post('/v1/sessao/escola', { headers: { Authorization: `Bearer ${corpo.desafio}` }, data: { usuarioId } })
    corpo = (await escolha.json()) as { etapa?: string }
    if (!escolha.ok()) throw new Error(`a escolha da escola pela API falhou: ${String(escolha.status())}`)
  }
  if (corpo.etapa !== 'pronta') throw new Error(`a entrada pela API não abriu sessão: ${String(entrada.status())} ${String(corpo.etapa)}`)
  await page.goto(endereco)
}
