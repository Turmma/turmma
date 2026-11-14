import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as esperar } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import pg from 'pg'
import { argumentosDoCompose, criarEscolasDoCenario, lerAmbienteDeCarga, rodar, type EscolasDoCenario } from './carga.ts'
import {
  aguardarExtracoesDaA,
  codigoDeSaidaDaIngestao,
  COORDENADORES_DA_A,
  julgarIngestao,
  lerEsperaDoPdfDaB,
  PDFS_POR_COORDENADOR,
  TOTAL_DE_PDFS,
  type EnviosDaA,
  type MedidaDaIngestao,
} from './conferir-carga-ingestao.ts'
import { urlDoBancoDoAmbiente } from './conferir-carga.ts'
import { agoraDoBanco, lerStatements, lerTurnoDaBNaJanela, prepararMedicaoDeStatements, semearTutorDaB } from './expurgo-da-carga.ts'

/**
 * Cenário de carga "300 apostilas numa noite" (ingestao-do-material, tarefa 9.0; Tech Spec, seção 7c; PRD, RF15), local e manual, no padrão da
 * "justiça entre escolas":
 *
 *   npm run carga:ingestao                    sobe o compose de carga, roda o cenário e reprova se um critério falhar
 *   npm run carga:ingestao:controle-negativo  o mesmo, com VAGAS_POR_ESCOLA_DESLIGADAS=true, e reprova se o cenário passar
 *
 * 1. sobe o projeto `educa-carga` (infra/compose.yml com infra/compose.carga.yml; o `worker-pdf` é **uma réplica**, com um PDF por vez);
 * 2. cria a rede e as escolas sintéticas pelo `ops:escola`, com as sessões de cada grupo pelo `ops:sessao-sintetica`: três coordenadores da A, um da B e
 *    trinta alunos da B (o Tutor);
 * 3. fase `base`: o k6 só com o Tutor da B (1,5 turno por segundo), e o p95 do turno que o banco registrou;
 * 4. fase `ingestao`: o mesmo k6 e, dez segundos depois, os três coordenadores da A enviam as 300 apostilas pela rota real (`POST /v1/materiais`, com o
 *    guard e o multipart como a tela manda; cada arquivo é o maior PDF do seed com um comentário final que o torna único), e o da B envia o dela quando a
 *    fila da A está cheia. Depois espera as extrações;
 * 5. o veredito (`conferir-carga-ingestao.ts`): os 300 aceitos e prontos, as 300 projetadas dentro das 10 h da noite com uma réplica, o p95 do turno da B
 *    até 500 ms acima da base, nenhum statement acima de 1,5 s e o PDF da B esperando no máximo duas extrações da A;
 * 6. derruba o projeto com os volumes, passe ou não.
 *
 * O controle negativo só passa se o cenário reprovar pela espera do PDF da B, com o envio e a extração limpos: reprovar porque o ambiente não funcionou não
 * prova que a vaga por escola importa.
 *
 * Nada de pessoa: escolas, alunos e PDFs sintéticos (regra 20, item 17). Nenhuma chamada a provedor de IA (regra 80, item 11): o adaptador falso do Tutor.
 */

export const SCRIPT_DO_K6_DA_INGESTAO = '/cenario/ingestao.js'
export const OPERADOR_DA_CARGA_DA_INGESTAO = 'carga-ingestao'
export const DURACAO_DA_BASE = '2m'
export const DURACAO_DO_K6_DA_INGESTAO = '3m'
/** O k6 já está no ritmo quando os envios começam. */
export const ATRASO_DOS_ENVIOS_MS = 10_000
/** Quantos envios cada coordenador mantém ao mesmo tempo: um onboarding de verdade manda em sequência, com a tela aberta. */
export const ENVIOS_SIMULTANEOS_POR_COORDENADOR = 2
/** O PDF da B sai quando a A já enviou esta fração das suas: a fila dela está cheia, e é aí que a vaga por escola faz falta. */
export const FRACAO_DA_A_ANTES_DO_PDF_DA_B = 0.9
export const PRAZO_DAS_EXTRACOES_MS = 20 * 60_000
export const PDF_DO_SEED = 'tools/demonstracao/quimica-2-cap-7-estequiometria.pdf'

/** Sessões por grupo: o k6 lê só `b_tutor`; os coordenadores são do driver. O papel do Tutor é aluno; o do envio, coordenação. */
export const SESSOES_POR_GRUPO = {
  a_coordenadores: { escola: 'A', papel: 'coordenador', quantidade: COORDENADORES_DA_A },
  b_coordenador: { escola: 'B', papel: 'coordenador', quantidade: 1 },
  b_tutor: { escola: 'B', papel: 'aluno', quantidade: 30 },
} as const satisfies Record<string, { escola: 'A' | 'B'; papel: 'aluno' | 'coordenador'; quantidade: number }>

type Grupo = keyof typeof SESSOES_POR_GRUPO

/** O maior PDF do seed, com um comentário final que muda o hash: o mesmo arquivo duas vezes na escola é `CONFLITO` (índice único). */
export function pdfUnico(base: Buffer, numero: number, escola: string): Buffer {
  return Buffer.concat([base, Buffer.from(`\n%carga-${escola}-${String(numero)}\n`)])
}

/** Os argumentos do `k6 run` de uma fase, dentro do container. */
export function argumentosDoK6DaIngestao(fase: 'base' | 'ingestao', duracao: string, turnoBaseP95Ms?: number): string[] {
  return [
    'run',
    '--quiet',
    '--no-usage-report',
    '--summary-export',
    `/execucao/resumo-${fase}.json`,
    '--env',
    `FASE=${fase}`,
    '--env',
    `DURACAO=${duracao}`,
    '--env',
    'API_URL=http://borda:8080',
    '--env',
    'ARQUIVO_DOS_TOKENS=/execucao/tokens.json',
    ...(turnoBaseP95Ms === undefined ? [] : ['--env', `TURNO_BASE_P95_MS=${Math.ceil(turnoBaseP95Ms)}`]),
    SCRIPT_DO_K6_DA_INGESTAO,
  ]
}

function escrever(linha: string): void {
  process.stdout.write(`${linha}\n`)
}

type Compose = (...argumentos: string[]) => Promise<{ codigo: number }>

/** Uma sessão real por token de cada grupo, pelo `ops:sessao-sintetica`: não existe mais token sem sessão gravada. */
async function gerarSessoes(ambiente: NodeJS.ProcessEnv, escolas: EscolasDoCenario): Promise<Record<Grupo, string[]>> {
  const tokens: Record<string, string[]> = {}
  for (const [grupo, { escola, papel, quantidade }] of Object.entries(SESSOES_POR_GRUPO)) {
    const argumentos = ['run', '-s', 'ops:sessao-sintetica', '--', '--escola', escolas[escola], '--papel', papel, '--quantidade', String(quantidade)]
    const { codigo, saida } = await rodar('npm', argumentos, ambiente, true)
    const linhas = saida.split('\n').filter((linha) => linha.startsWith('ey'))
    if (codigo !== 0 || linhas.length !== quantidade) throw new Error(`ops:sessao-sintetica não criou as ${String(quantidade)} sessões do grupo ${grupo}`)
    tokens[grupo] = linhas
  }
  return tokens as Record<Grupo, string[]>
}

interface EstruturaDaEscola {
  readonly disciplinaId: string
  readonly serieId: string
}

/** O ano letivo, a série e a disciplina que o envio de material pede, em uma escola do cenário; e, na B, os vínculos dos alunos do Tutor. */
async function prepararEscola(banco: pg.Client, escolaId: string): Promise<EstruturaDaEscola> {
  await semearTutorDaB(banco, escolaId)
  const serie = await banco.query<{ id: string }>('select id from serie where escola_id = $1 limit 1', [escolaId])
  const disciplina = await banco.query<{ id: string }>(
    `insert into disciplina (escola_id, nome) values ($1, 'Química') on conflict (escola_id, lower(nome)) do update set nome = excluded.nome returning id`,
    [escolaId],
  )
  const serieId = serie.rows[0]?.id
  const disciplinaId = disciplina.rows[0]?.id
  if (serieId === undefined || disciplinaId === undefined) throw new Error('a série ou a disciplina da escola do cenário não foi criada')
  return { serieId, disciplinaId }
}

/** `POST /v1/materiais` como a tela manda: multipart, os campos antes do arquivo. Devolve o status. */
async function enviarPdf(borda: string, token: string, estrutura: EstruturaDaEscola, titulo: string, pdf: Buffer): Promise<number> {
  const formulario = new FormData()
  formulario.append('titulo', titulo)
  formulario.append('disciplinaId', estrutura.disciplinaId)
  formulario.append('titularidade', 'escola')
  formulario.append('licenca', 'autoria_da_escola')
  formulario.append('declaracao', 'true')
  formulario.append('serieIds', estrutura.serieId)
  formulario.append('arquivo', new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }), 'apostila.pdf')
  const resposta = await fetch(`${borda}/v1/materiais`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formulario })
  await resposta.arrayBuffer()
  return resposta.status
}

/**
 * Os três coordenadores da A enviam as 300 (100 cada), e o da B envia o PDF dele quando a A já mandou a fração pedida. Devolve o que a rota respondeu
 * e o instante do envio da B.
 */
async function enviarAsApostilas(borda: string, tokens: Record<Grupo, string[]>, estruturas: { A: EstruturaDaEscola; B: EstruturaDaEscola }, base: Buffer): Promise<EnviosDaA> {
  let aceitos = 0
  let enviadosDaA = 0
  const recusados: Record<string, number> = {}
  let pdfDaBEnviado: Promise<void> | undefined
  const registrar = (status: number): void => {
    if (status === 201) aceitos += 1
    else recusados[String(status)] = (recusados[String(status)] ?? 0) + 1
  }
  const enviarPdfDaB = (): void => {
    const token = tokens.b_coordenador[0]
    if (token === undefined) throw new Error('sem sessão do coordenador da B')
    pdfDaBEnviado = enviarPdf(borda, token, estruturas.B, 'Apostila da escola B', pdfUnico(base, 1, 'B')).then((status) => {
      escrever(`  o PDF da B enviado: ${String(status)}`)
      if (status !== 201) throw new Error(`o PDF da B foi recusado: ${String(status)}`)
    })
  }
  const aMeta = Math.floor(TOTAL_DE_PDFS * FRACAO_DA_A_ANTES_DO_PDF_DA_B)
  const coordenadores = tokens.a_coordenadores.map(async (token, indice) => {
    let proximo = 0
    const trabalhador = async (): Promise<void> => {
      while (proximo < PDFS_POR_COORDENADOR) {
        const numero = indice * PDFS_POR_COORDENADOR + proximo
        proximo += 1
        registrar(await enviarPdf(borda, token, estruturas.A, `Apostila ${String(numero + 1)}`, pdfUnico(base, numero, 'A')))
        enviadosDaA += 1
        if (enviadosDaA === aMeta) enviarPdfDaB()
      }
    }
    await Promise.all(Array.from({ length: ENVIOS_SIMULTANEOS_POR_COORDENADOR }, trabalhador))
  })
  await Promise.all(coordenadores)
  await pdfDaBEnviado
  return { aceitos, recusados }
}

/** Os thresholds que o k6 cruzou, do resumo que ele gravou; sem o arquivo, a falta dele é a reprovação. */
function lerThresholdsCruzados(pasta: string, resumo: string): string[] {
  try {
    const metricas = (JSON.parse(readFileSync(join(pasta, `${resumo}.json`), 'utf8')) as { metrics?: Record<string, { thresholds?: Record<string, boolean> }> }).metrics ?? {}
    return Object.entries(metricas).flatMap(([metrica, valores]) =>
      Object.entries(valores.thresholds ?? {})
        .filter(([, cruzado]) => cruzado)
        .map(([criterio]) => `${metrica} ${criterio}`),
    )
  } catch {
    return ['sem resumo do k6']
  }
}

async function rodarK6(compose: Compose, pasta: string, argumentos: string[], resumo: string): Promise<{ codigo: number; cruzados: string[] }> {
  const { codigo } = await compose('run', '--rm', '--no-deps', 'k6', ...argumentos)
  return { codigo, cruzados: lerThresholdsCruzados(pasta, resumo) }
}

interface Resultado {
  readonly reprovacoes: ReturnType<typeof julgarIngestao>['reprovacoes']
  readonly k6Reprovou: string[]
}

async function rodarCenario(compose: Compose, pasta: string, doArquivo: Record<string, string>, ambienteDosOps: NodeJS.ProcessEnv): Promise<Resultado> {
  const subida = await compose('up', '--detach', '--build', '--wait')
  if (subida.codigo !== 0) throw new Error('o compose de carga não subiu')
  escrever('\n▶ escolas do cenário')
  const escolas = await criarEscolasDoCenario(ambienteDosOps)
  const banco = new pg.Client({ connectionString: urlDoBancoDoAmbiente(doArquivo) })
  await banco.connect()
  try {
    const estruturas = { A: await prepararEscola(banco, escolas.A), B: await prepararEscola(banco, escolas.B) }
    const base = readFileSync(PDF_DO_SEED)
    const borda = `http://127.0.0.1:${doArquivo['BORDA_PORTA_HOST'] ?? ''}`
    const arquivoDosTokens = join(pasta, 'tokens.json')

    /** Sessões novas antes de cada fase: o token de acesso vale 10 min, e os alunos novos da B precisam do vínculo antes do k6. */
    const sessoes = async (fase: string): Promise<Record<Grupo, string[]>> => {
      escrever(`\n▶ sessões da fase ${fase}`)
      const tokens = await gerarSessoes(ambienteDosOps, escolas)
      writeFileSync(arquivoDosTokens, JSON.stringify(tokens))
      chmodSync(arquivoDosTokens, 0o644)
      await semearTutorDaB(banco, escolas.B)
      return tokens
    }

    await sessoes('base')
    escrever(`\n▶ k6, fase base (${DURACAO_DA_BASE})`)
    const inicioDaBase = await agoraDoBanco(banco)
    const daBase = await rodarK6(compose, pasta, argumentosDoK6DaIngestao('base', DURACAO_DA_BASE), 'resumo-base')
    const fimDaBase = await agoraDoBanco(banco)
    const turnoDaBase = await lerTurnoDaBNaJanela(banco, escolas.B, { inicioMs: inicioDaBase, fimMs: fimDaBase })
    escrever(`p95 do turno do Tutor da B na base: ${turnoDaBase.p95Ms === null ? '-' : `${String(turnoDaBase.p95Ms)} ms`} (${String(turnoDaBase.amostras)} turnos)`)

    const tokens = await sessoes('ingestao')
    await prepararMedicaoDeStatements(banco).catch((erro: unknown) => escrever(`  medição de statements indisponível: ${erro instanceof Error ? erro.message : String(erro)}`))
    escrever(`\n▶ k6, fase ingestao (${DURACAO_DO_K6_DA_INGESTAO}), e as ${String(TOTAL_DE_PDFS)} apostilas da A depois de ${String(ATRASO_DOS_ENVIOS_MS / 1_000)} s`)
    const inicioDaIngestao = await agoraDoBanco(banco)
    const k6 = rodarK6(compose, pasta, argumentosDoK6DaIngestao('ingestao', DURACAO_DO_K6_DA_INGESTAO, turnoDaBase.p95Ms ?? 0), 'resumo-ingestao')
    await esperar(ATRASO_DOS_ENVIOS_MS)
    const envios = await enviarAsApostilas(borda, tokens, estruturas, base)
    escrever(`  ${String(envios.aceitos)} envios aceitos${Object.keys(envios.recusados).length === 0 ? '' : `, recusados ${JSON.stringify(envios.recusados)}`}`)
    escrever('\n▶ espera das extrações')
    const extracoes = await aguardarExtracoesDaA(banco, escolas.A, PRAZO_DAS_EXTRACOES_MS, () => esperar(2_000))
    const fimDasExtracoes = await agoraDoBanco(banco)
    const resultadoDoK6 = await k6
    const fimDoK6 = await agoraDoBanco(banco)

    // Os statements primeiro: as conferências abaixo também são statements, e não são do cenário.
    const statements = await lerStatements(banco).catch(() => undefined)
    const piorStatement = statements?.piores[0] === undefined ? undefined : { forma: statements.piores[0].forma, maximoMs: statements.piores[0].maximoMs }
    const turnoNaIngestao = await lerTurnoDaBNaJanela(banco, escolas.B, { inicioMs: inicioDaIngestao, fimMs: Math.min(fimDasExtracoes, fimDoK6) })
    const medida: MedidaDaIngestao = {
      envios,
      extracoes,
      pdfDaB: await lerEsperaDoPdfDaB(banco, escolas.A, escolas.B),
      turnoDaBNaBase: { amostras: turnoDaBase.amostras, p95Ms: turnoDaBase.p95Ms },
      turnoDaBNaIngestao: { amostras: turnoNaIngestao.amostras, p95Ms: turnoNaIngestao.p95Ms },
      piorStatement,
    }
    const veredito = julgarIngestao(medida)
    for (const linha of veredito.linhas) escrever(linha)
    return {
      reprovacoes: veredito.reprovacoes,
      k6Reprovou: [...daBase.cruzados.map((c) => `base: ${c}`), ...resultadoDoK6.cruzados.map((c) => `ingestao: ${c}`)],
    }
  } finally {
    await banco.end().catch(() => undefined)
  }
}

/** Escreve o veredito e devolve o código de saída: com a vaga por escola o cenário passa; sem ela (controle negativo), reprova pela espera do PDF da B. */
function relatar(resultado: Resultado, controleNegativo: boolean, inicio: Date, inicioMonotonico: number): number {
  const duracao = Math.round((performance.now() - inicioMonotonico) / 60_000)
  const passou = resultado.reprovacoes.length === 0 && resultado.k6Reprovou.length === 0
  escrever(`\n■ resultado em ${inicio.toISOString()} (${String(duracao)} min): ${passou ? 'passou' : 'reprovou'}`)
  for (const reprovacao of resultado.reprovacoes) escrever(`  reprovado: ${reprovacao.detalhe}`)
  for (const cruzado of resultado.k6Reprovou) escrever(`  k6 reprovou: ${cruzado}`)
  const codigo = codigoDeSaidaDaIngestao(resultado.reprovacoes, controleNegativo)
  if (controleNegativo) {
    escrever(codigo === 0 ? '✔ controle negativo: sem a vaga por escola, o PDF da B esperou mais que duas extrações' : '✖ controle negativo: sem a vaga por escola, o cenário não reprovou pela espera do PDF da B')
    return codigo
  }
  escrever(passou ? '✔ cenário passou' : '✖ cenário reprovou')
  return passou ? 0 : 1
}

async function executar(controleNegativo: boolean): Promise<number> {
  const pasta = mkdtempSync(join(tmpdir(), 'educa-carga-ingestao-'))
  // O k6 do container roda com outro usuário: ele lê os tokens e grava o resumo nesta pasta. A pasta aberta só serve porque tudo aqui é sintético e sai no fim.
  // Não reaproveite este padrão: pasta `0o777` com token só vale num compose descartável, com sessão sintética, apagada no `finally`; com credencial real ou fora da carga, é arquivo aberto (regra 20, itens 7 e 17).
  chmodSync(pasta, 0o777)
  const doArquivo = lerAmbienteDeCarga()
  const ambiente: NodeJS.ProcessEnv = {
    ...Object.fromEntries(Object.entries(process.env).filter(([chave]) => !(chave in doArquivo))),
    CARGA_PASTA_DA_EXECUCAO: pasta,
    VAGAS_POR_ESCOLA_DESLIGADAS: controleNegativo ? 'true' : 'false',
  }
  const compose: Compose = (...argumentos) => rodar('docker', [...argumentosDoCompose(), ...argumentos], ambiente)
  const inicio = new Date()
  const inicioMonotonico = performance.now()
  let resultado: Resultado | undefined
  try {
    escrever(`\n▶ cenário "300 apostilas numa noite"${controleNegativo ? ', controle negativo (VAGAS_POR_ESCOLA_DESLIGADAS=true)' : ''}`)
    await compose('down', '--volumes', '--remove-orphans')
    resultado = await rodarCenario(compose, pasta, doArquivo, { ...ambiente, ...doArquivo, OPERADOR: OPERADOR_DA_CARGA_DA_INGESTAO })
  } catch (erro) {
    escrever(`\n✖ o cenário não terminou: ${erro instanceof Error ? erro.message : String(erro)}`)
    await compose('logs', '--no-color', '--tail', '100', 'api-1', 'api-2', 'worker-pdf', 'despachante-1')
  } finally {
    await compose('down', '--volumes', '--remove-orphans')
    rmSync(pasta, { recursive: true, force: true })
  }
  if (resultado === undefined) return 1
  return relatar(resultado, controleNegativo, inicio, inicioMonotonico)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await executar(process.argv.includes('--controle-negativo'))
}
