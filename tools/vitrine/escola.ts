import { hash, type Algorithm } from '@node-rs/argon2'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Secret, TOTP } from 'otpauth'
import { Client } from 'pg'
import { montarEscolaComEntregas } from '../../e2e/support/governanca.ts'
import { criarEquipeComSenha, porNaListaDaTurma, type EquipeDeTeste } from '../../e2e/support/seed.ts'
import { lerAmbienteDeTeste, urlDoBancoDeTeste, valorObrigatorio } from '../ci/compose.ts'
import { raizRepositorio } from '../ci/executar.ts'

// A vitrine: uma escola sintética montada no ambiente de teste (`educa-teste`), com um login de cada papel, para um
// agente abrir a tela de verdade numa página do Maestri e olhar o que a tarefa fez (D78). Não é seed do produto nem da
// demonstração (D71): mora só no banco de teste, que o portão recria, e some com ele.
//
// Os comandos estão em `tools/vitrine/vitrine.ts`.
//
// As escolas nascem das peças de semente do e2e (`e2e/support/`): a escola com a coordenadora, de `seed.ts`, e o
// miolo, de `governanca.ts`. O que elas gravam é o que os testes de tela já provam que a tela sabe mostrar. Aqui só entram
// os logins que as peças não dão. **Nenhum código daqui cria rede nem escola:** fora do repository do operador, isso é
// só da semente de teste, e a guarda da criação de rede e escola, em `apps/api/src/ops/`, varre esta pasta.
//
// `seed.ts` importa `packages/shared` pelo fonte, com o `.js` que o `tsc` pede: no `node` puro este arquivo só
// carrega depois de `./resolver.ts` registrado, que é o que `vitrine.ts` faz antes de importá-lo. No Vitest carrega direto.
// Tudo sintético, com e-mail no domínio reservado `.invalid` (regra 20, item 17).

export const ARQUIVO_DA_VITRINE = '.processo/vitrine.json'

/** O período do TOTP da API (`apps/api/src/credencial/totp.ts`): 30 s, com um passo de janela para cada lado. */
const PERIODO_TOTP_MS = 30_000
const JANELA_TOTP = 1

/** Uma escola da vitrine e o login de cada papel nela. */
export interface Acessos {
  readonly escola: { readonly id: string; readonly nome: string; readonly slug: string }
  readonly coordenacao: {
    readonly nome: string
    readonly email: string
    readonly senha: string
    /** O segredo do segundo fator em base32, ou `null` quando a API não estava de pé: aí a tela o configura na entrada. */
    readonly segredo: string | null
    /** O último passo do TOTP já usado: a API só aceita um passo maior (`mfa_ultimo_passo`). */
    readonly ultimoPasso: number
  }
  readonly professora: { readonly nome: string; readonly email: string; readonly senha: string; readonly turma: string; readonly disciplina: string }
  readonly aluno: { readonly nome: string; readonly matricula: string; readonly senha: string; readonly turma: string }
}

/**
 * As duas escolas da vitrine. A cheia, nos campos de cima, tem dado em toda tela. A `vazia` tem as mesmas três pessoas e
 * uma turma, e mais nada: é nela que se vê o estado vazio de cada tela, que é o que a escola nova encontra no primeiro dia.
 */
export interface Vitrine extends Acessos {
  readonly montadaEm: string
  /** A web do ambiente de teste, vista da máquina. */
  readonly url: string
  readonly vazia: Acessos
}

/** A escola pedida: a cheia, ou a vazia. */
export function acessosDa(vitrine: Vitrine, vazia: boolean): Acessos {
  return vazia ? vitrine.vazia : vitrine
}

/** A vitrine com aquele passo do segundo fator dado como gasto, na escola pedida. */
export function comPassoGasto(vitrine: Vitrine, vazia: boolean, passo: number): Vitrine {
  if (!vazia) return { ...vitrine, coordenacao: { ...vitrine.coordenacao, ultimoPasso: passo } }
  return { ...vitrine, vazia: { ...vitrine.vazia, coordenacao: { ...vitrine.vazia.coordenacao, ultimoPasso: passo } } }
}

/** `Algorithm.Argon2id`: o enum do pacote é `const` e ambiente, e não se lê com `isolatedModules`. */
const ARGON2ID = 2 as Algorithm

/** O hash com os parâmetros do ambiente de teste, como o das peças do e2e: é com eles que a API confere a senha. */
async function hashDaSenha(senha: string): Promise<string> {
  const ambiente = lerAmbienteDeTeste()
  return hash(senha, {
    algorithm: ARGON2ID,
    memoryCost: Number(valorObrigatorio(ambiente, 'LOGIN_ARGON2_MEMORIA_KIB')),
    timeCost: Number(valorObrigatorio(ambiente, 'LOGIN_ARGON2_ITERACOES')),
    parallelism: 1,
  })
}

async function comBanco<T>(tarefa: (banco: Client) => Promise<T>): Promise<T> {
  const banco = new Client({ connectionString: urlDoBancoDeTeste() })
  await banco.connect()
  try {
    return await tarefa(banco)
  } finally {
    await banco.end()
  }
}

async function id(banco: Client, instrucao: string, parametros: unknown[]): Promise<string> {
  const { rows } = await banco.query<{ id: string }>(instrucao, parametros)
  const criado = rows[0]?.id
  if (criado === undefined) throw new Error(`a vitrine não criou a linha: ${instrucao}`)
  return criado
}

/**
 * A escola sintética com ano letivo em curso e a coordenadora com senha, pela semente do e2e, e o nome trocado para
 * dizer qual das duas escolas da vitrine ela é: é o que aparece no topo de toda tela e de toda foto.
 */
async function criarEscolaComCoordenadora(rotulo: 'cheia' | 'vazia'): Promise<EquipeDeTeste> {
  const coordenadora = await criarEquipeComSenha('coordenador')
  const escolaNome = `Colégio sintético da vitrine ${rotulo} ${coordenadora.slug.slice(-8)}`
  await comBanco((banco) => banco.query('update escola set nome = $2 where id = $1', [coordenadora.escolaId, escolaNome]))
  return { ...coordenadora, escolaNome }
}

/** A senha da professora que a governança criou sem senha: devolve o e-mail da conta dela, que é com o que ela entra. */
async function darSenhaAProfessora(escolaId: string, nome: string, senha: string): Promise<string> {
  const senhaHash = await hashDaSenha(senha)
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ email: string }>(
      "update conta set senha_hash = $3 where id = (select conta_id from usuario where escola_id = $1 and nome = $2 and papel = 'professor') returning email",
      [escolaId, nome, senhaHash],
    )
    const email = rows[0]?.email
    if (email === undefined) throw new Error(`a vitrine não achou a conta da professora "${nome}"`)
    return email
  })
}

/** A matrícula e a senha do aluno que a governança criou sem credencial (o aluno não tem conta nem e-mail; regra 20, item 2). */
async function darMatriculaAoAluno(escolaId: string, nome: string, matricula: string, senha: string): Promise<void> {
  const senhaHash = await hashDaSenha(senha)
  await comBanco(async (banco) => {
    const { rowCount } = await banco.query(
      "insert into credencial_matricula (escola_id, usuario_id, matricula, senha_hash) select $1, id, $3, $4 from usuario where escola_id = $1 and nome = $2 and papel = 'aluno'",
      [escolaId, nome, matricula, senhaHash],
    )
    if (rowCount !== 1) throw new Error(`a vitrine não achou o aluno "${nome}"`)
  })
}

export function passoDeAgora(agoraMs: number): number {
  return Math.floor(agoraMs / PERIODO_TOTP_MS)
}

/**
 * O passo do próximo código que a API aceita: o de agora, ou o seguinte ao último usado, porque o mesmo passo não entra
 * duas vezes. `esperarSegundos` é quanto falta para esse passo caber na janela de um passo à frente; zero na entrada
 * comum, e maior que zero só para quem pede três códigos no mesmo meio minuto.
 */
export function proximoPasso(agoraMs: number, ultimoPasso: number): { readonly passo: number; readonly esperarSegundos: number } {
  const agora = passoDeAgora(agoraMs)
  const passo = Math.max(agora, ultimoPasso + 1)
  const abreEm = (passo - JANELA_TOTP) * PERIODO_TOTP_MS
  return { passo, esperarSegundos: Math.max(0, Math.ceil((abreEm - agoraMs) / 1_000)) }
}

/** O código que o aplicativo autenticador mostraria naquele passo (SHA1, 6 dígitos, 30 s: os padrões do `otpauth`). */
export function codigoDoPasso(segredoBase32: string, passo: number): string {
  return new TOTP({ secret: Secret.fromBase32(segredoBase32) }).generate({ timestamp: passo * PERIODO_TOTP_MS })
}

async function pedir<T>(url: string, corpo: unknown, desafio?: string): Promise<T> {
  const resposta = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(desafio === undefined ? {} : { authorization: `Bearer ${desafio}` }) },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(20_000),
  })
  if (!resposta.ok) throw new Error(`POST ${new URL(url).pathname} respondeu ${String(resposta.status)}`)
  return (await resposta.json()) as T
}

/**
 * Ativa o segundo fator da coordenadora pelas rotas de verdade (entrar, configurar, ativar), como a tela faria no
 * primeiro acesso. Sem isso o agente teria de configurar pela tela toda vez que a vitrine é montada. Devolve o segredo
 * e o passo que a ativação gastou.
 */
export async function ativarSegundoFator(url: string, email: string, senha: string, agoraMs = Date.now()): Promise<{ segredo: string; passo: number }> {
  const entrada = await pedir<{ etapa: string; desafio?: string }>(`${url}/v1/sessao/email`, { email, senha })
  if (entrada.etapa !== 'configurar_mfa' || entrada.desafio === undefined) throw new Error(`a entrada da coordenação parou na etapa "${entrada.etapa}", e não em "configurar_mfa"`)
  const { segredo } = await pedir<{ segredo: string }>(`${url}/v1/conta/mfa/configurar`, {}, entrada.desafio)
  const passo = passoDeAgora(agoraMs)
  await pedir<unknown>(`${url}/v1/conta/mfa/ativar`, { codigo: codigoDoPasso(segredo, passo) }, entrada.desafio)
  return { segredo, passo }
}

/** A web do ambiente de teste responde? Tarefa só de integração sobe o banco e deixa a web fora do ar. */
export async function webResponde(url: string): Promise<boolean> {
  try {
    return (await fetch(`${url}/entrar`, { signal: AbortSignal.timeout(5_000) })).ok
  } catch {
    return false
  }
}

export function urlDaWebDeTeste(): string {
  return `http://127.0.0.1:${valorObrigatorio(lerAmbienteDeTeste(), 'WEB_PORTA_HOST')}`
}

/**
 * A escola vazia: a coordenadora, uma professora com a turma dela confirmada e um aluno nessa turma. Sem lista de nomes,
 * sem material, sem atividade, sem entrega e sem consumo de IA: cada tela abre no estado vazio.
 */
async function montarEscolaVazia(url: string, ativarMfa: boolean): Promise<Acessos> {
  const coordenadora = await criarEscolaComCoordenadora('vazia')
  const marca = randomUUID()
  const professora = { nome: `Professora Sintética Rosa ${marca.slice(0, 8)}`, email: `professor-${marca}@educa.invalid`, senha: `senha-sintetica-${marca}` }
  const aluno = { nome: `Aluno Sintético Téo ${marca.slice(0, 8)}`, matricula: String(Date.now() + 1).slice(-8), senha: `senha-sintetica-${randomUUID()}` }
  const turma = `2ºA ${marca.slice(0, 8)}`
  const hashDaProfessora = await hashDaSenha(professora.senha)
  const hashDoAluno = await hashDaSenha(aluno.senha)
  await comBanco(async (banco) => {
    const { escolaId } = coordenadora
    const anoLetivoId = await id(banco, "select id from ano_letivo where escola_id = $1 and situacao = 'em_curso'", [escolaId])
    const serieId = await id(banco, "insert into serie (escola_id, etapa, ano) values ($1, 'em', 2) returning id", [escolaId])
    const disciplinaId = await id(banco, 'insert into disciplina (escola_id, nome) values ($1, $2) returning id', [escolaId, 'Química'])
    const turmaId = await id(banco, 'insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, $4) returning id', [escolaId, anoLetivoId, serieId, turma])
    const contaId = await id(banco, 'insert into conta (email, senha_hash) values ($1, $2) returning id', [professora.email, hashDaProfessora])
    const professoraId = await id(banco, "insert into usuario (escola_id, conta_id, papel, nome, introducao_vista_em) values ($1, $2, 'professor', $3, now()) returning id", [escolaId, contaId, professora.nome])
    const alunoId = await id(banco, "insert into usuario (escola_id, papel, nome, introducao_vista_em) values ($1, 'aluno', $2, now()) returning id", [escolaId, aluno.nome])
    await banco.query('insert into credencial_matricula (escola_id, usuario_id, matricula, senha_hash) values ($1, $2, $3, $4)', [escolaId, alunoId, aluno.matricula, hashDoAluno])
    // Quem cria vínculo é a coordenação (regra 60, item 8a), e os dois nascem confirmados: a professora já vê a turma.
    for (const [usuarioId, daDisciplina, papel] of [
      [professoraId, disciplinaId, 'professor'],
      [alunoId, null, 'aluno'],
    ] as const) {
      await banco.query(
        "insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, estado, decidido_em, criado_por) values ($1, $2, $3, $4, $5, $6, 'confirmado', now(), $7)",
        [escolaId, anoLetivoId, usuarioId, turmaId, daDisciplina, papel, coordenadora.usuarioId],
      )
    }
  })
  const segundoFator = ativarMfa ? await ativarSegundoFator(url, coordenadora.email, coordenadora.senha) : null
  return {
    escola: { id: coordenadora.escolaId, nome: coordenadora.escolaNome, slug: coordenadora.slug },
    coordenacao: { nome: coordenadora.nome, email: coordenadora.email, senha: coordenadora.senha, segredo: segundoFator?.segredo ?? null, ultimoPasso: segundoFator?.passo ?? 0 },
    professora: { ...professora, turma, disciplina: 'Química' },
    aluno: { ...aluno, turma },
  }
}

/**
 * A escola cheia: a coordenadora com senha, a governança inteira (duas turmas do 2º ano, três professoras, alunos,
 * listas corrigidas com o lote aprovado, uma versão adaptada esperando e o consumo de IA do mês), nomes livres na lista
 * da turma, e a senha da professora de Química do 2ºB e do aluno dela.
 */
async function montarEscolaCheia(url: string, ativarMfa: boolean): Promise<Acessos> {
  const marca = randomUUID()
  const coordenadora = await criarEscolaComCoordenadora('cheia')
  const escola = await montarEscolaComEntregas(coordenadora.escolaId, coordenadora.usuarioId)
  await porNaListaDaTurma(coordenadora.escolaId, escola.turmas.doB.id, [
    { nome: 'Aluna Sintética Bia Vitrine', matricula: '90000001', estado: 'livre' },
    { nome: 'Aluno Sintético Davi Vitrine', matricula: '90000002', estado: 'livre' },
    { nome: 'Aluna Sintética Nina Vitrine', matricula: '90000003', estado: 'reivindicado' },
  ])

  const senhaDaProfessora = `senha-sintetica-${marca}`
  const emailDaProfessora = await darSenhaAProfessora(coordenadora.escolaId, escola.professoras.quimicaDoB, senhaDaProfessora)
  const matricula = String(Date.now()).slice(-8)
  const senhaDoAluno = `senha-sintetica-${randomUUID()}`
  await darMatriculaAoAluno(coordenadora.escolaId, escola.aluno, matricula, senhaDoAluno)

  const segundoFator = ativarMfa ? await ativarSegundoFator(url, coordenadora.email, coordenadora.senha) : null
  return {
    escola: { id: coordenadora.escolaId, nome: coordenadora.escolaNome, slug: coordenadora.slug },
    coordenacao: { nome: coordenadora.nome, email: coordenadora.email, senha: coordenadora.senha, segredo: segundoFator?.segredo ?? null, ultimoPasso: segundoFator?.passo ?? 0 },
    professora: { nome: escola.professoras.quimicaDoB, email: emailDaProfessora, senha: senhaDaProfessora, turma: escola.turmas.doB.nome, disciplina: 'Química' },
    aluno: { nome: escola.aluno, matricula, senha: senhaDoAluno, turma: escola.turmas.doB.nome },
  }
}

/**
 * Monta as duas escolas da vitrine, a cheia e a vazia.
 *
 * `ativarMfa: false` é para quem só tem o banco de pé (o teste de integração): a coordenação fica sem segundo fator, e
 * a tela pede a configuração na entrada.
 */
export async function montarVitrine(opcoes: { readonly ativarMfa?: boolean; readonly url?: string } = {}): Promise<Vitrine> {
  const url = opcoes.url ?? urlDaWebDeTeste()
  const ativarMfa = opcoes.ativarMfa !== false
  const cheia = await montarEscolaCheia(url, ativarMfa)
  const vazia = await montarEscolaVazia(url, ativarMfa)
  return { ...cheia, montadaEm: new Date().toISOString(), url, vazia }
}

function bloco(url: string, titulo: string, acessos: Acessos, sufixo: string): string[] {
  const { escola, coordenacao, professora, aluno } = acessos
  const segundoFator =
    coordenacao.segredo === null
      ? 'segundo fator: ainda não configurado; a tela pede no primeiro acesso'
      : `segundo fator: node tools/vitrine/vitrine.ts codigo${sufixo}   (um código por entrada)`
  return [
    `${titulo}: "${escola.nome}"`,
    `  Coordenação — ${coordenacao.nome}`,
    `    entrada: ${url}/entrar`,
    `    e-mail: ${coordenacao.email}`,
    `    senha: ${coordenacao.senha}`,
    `    ${segundoFator}`,
    `  Professora — ${professora.nome} (${professora.disciplina}, turma ${professora.turma})`,
    `    entrada: ${url}/entrar`,
    `    e-mail: ${professora.email}`,
    `    senha: ${professora.senha}`,
    `  Aluno — ${aluno.nome} (turma ${aluno.turma})`,
    `    entrada: ${url}/e/${escola.slug}`,
    `    matrícula: ${aluno.matricula}`,
    `    senha: ${aluno.senha}`,
  ]
}

/** O que se lê para entrar: as duas escolas, um bloco por papel, com o endereço da entrada e o que digitar. */
export function resumo(vitrine: Vitrine): string {
  return [
    `Vitrine montada em ${vitrine.montadaEm}. Web do ambiente de teste: ${vitrine.url}`,
    'Para ver uma tela, não é preciso digitar nada disto: `node tools/vitrine/vitrine.ts foto <papel> <endereço>` entra sozinho.',
    '',
    ...bloco(vitrine.url, 'Escola cheia (dado em toda tela)', vitrine, ''),
    '',
    ...bloco(vitrine.url, 'Escola vazia (o estado vazio de cada tela; nos comandos, `--vazia`)', vitrine.vazia, ' --vazia'),
    '',
    'Tudo aqui é sintético e vive só no banco de teste: o portão que recria o banco apaga as escolas, e aí é montar de novo.',
  ].join('\n')
}

function caminhoDoArquivo(raiz: string): string {
  return join(raiz, ARQUIVO_DA_VITRINE)
}

export function gravarVitrine(vitrine: Vitrine, raiz = raizRepositorio): void {
  const caminho = caminhoDoArquivo(raiz)
  mkdirSync(dirname(caminho), { recursive: true })
  writeFileSync(caminho, `${JSON.stringify(vitrine, null, 2)}\n`)
}

export function lerVitrine(raiz = raizRepositorio): Vitrine | null {
  const caminho = caminhoDoArquivo(raiz)
  return existsSync(caminho) ? (JSON.parse(readFileSync(caminho, 'utf8')) as Vitrine) : null
}

/** O portão da tarefa seguinte recria o banco: a escola do arquivo pode não existir mais. */
export async function escolaExiste(escolaId: string): Promise<boolean> {
  return comBanco(async (banco) => {
    const { rowCount } = await banco.query('select 1 from escola where id = $1', [escolaId])
    return rowCount === 1
  })
}
