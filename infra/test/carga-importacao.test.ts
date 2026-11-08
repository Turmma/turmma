import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { hashDoToken } from '../../apps/api/src/credencial/token-hash.ts'
import { NOME_SINTETICO } from '../../apps/api/src/sessao/tenant/synthetic-sessions.ts'
import { indiceDaTurma, nomeDaTurma } from '../../packages/core/src/importacao/tipos/alunos.ts'
import { lerTabela } from '../../packages/core/src/importacao/leitor.ts'
import { CABECALHOS_DA_PLANILHA } from '../../packages/shared/src/importacao/modelos.ts'
import { LIMITE_DA_PLANILHA_POR_MINUTO, MAXIMO_DE_DESLIGAMENTOS_POR_GRAVAR, MAXIMO_DE_LINHAS_DA_PLANILHA, MAXIMO_DE_LINHAS_DA_PLANILHA_DE_PROFESSORES } from '../../packages/shared/src/importacao/contratos.ts'
import { raizRepositorio } from '../../tools/ci/executar.ts'
import { CODIGO_THRESHOLD_CRUZADO } from '../scripts/carga.ts'
import type { ResumoDaFase } from '../scripts/carga-login.ts'
import {
  ACESSOS_POR_SEGUNDO,
  ALUNOS_DA_VIRADA,
  argumentosDoK6DaImportacao,
  chaveDaRajada,
  DESLIGAMENTOS,
  DESLIGAMENTOS_POR_GRAVAR,
  gravaresParaDesligar,
  descreverFase,
  DURACAO_DA_FASE_S,
  FASES_COM_RAJADA,
  FASES_DO_CENARIO,
  fasesPedidas,
  julgarCenarioDaImportacao,
  julgarEsperaDeTrava,
  LIMITE_DA_ESPERA_DE_TRAVA_MS,
  LINHAS_DA_PLANILHA,
  matriculaDaPedido,
  montarPlanilhaDaEquipe,
  montarPlanilhaDaVirada,
  montarPlanilhaDosPedidos,
  montarPlanilhaParaAprovar,
  montarPlanilhasDeAlunos,
  NOME_DO_ALUNO_SINTETICO,
  nomeDoPedido,
  PASSO_3_MINIMO,
  PEDIDOS_POR_LOTE,
  PEDIDOS_POR_TURMA,
  PROFESSORAS,
  PROFESSORES_QUE_JA_EXISTEM,
  REDEFINICOES_DA_FASE,
  REDEFINICOES_POR_SEGUNDO,
  resumosDaFase,
  semearLinksDeRedefinir,
  TRANSFERENCIAS_POR_VOLTA,
  turmaDaCarga,
  TURMAS_COM_PROFESSORA,
  TURMAS_DA_PLANILHA,
  TURMAS_DA_VIRADA,
  TURMAS_DOS_DESLIGAMENTOS,
  turmasDaProfessora,
  type FaseDaImportacao,
} from '../scripts/carga-importacao.ts'
import { julgarImportacoes, julgarPasso3, TETO_DO_PASSO_3_S, type ConferenciaDaImportacao } from '../scripts/conferir-carga-importacao.ts'

/**
 * O cenário "a escola inteira entra de uma vez" sem subir nada (F2, tarefa 16.0; Tech Spec do onboarding, 7c e 13; PRD, RF15): as
 * planilhas que ele gera, o veredito, a conferência e o que o k6 chama. A execução de verdade é `npm run carga:importacao`, manual, com o
 * resultado registrado na tarefa (runbook, "Rodar o cenário da importação").
 */

const lerArquivo = (caminho: string) => readFileSync(join(raizRepositorio, caminho), 'utf8')

/** O texto sem os comentários: o cabeçalho do cenário diz o que ele *não* chama, e isso não é chamada. */
const stripComments = (texto: string) => texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const limpo = (valores: Record<string, number> = {}): ResumoDaFase => ({ codigo: 0, cruzados: [], valores })
const cruzado = (...metricas: string[]): ResumoDaFase => ({ codigo: CODIGO_THRESHOLD_CRUZADO, cruzados: metricas.map((metrica) => ({ metrica, criterio: 'x' })), valores: {} })
const conferencia = (...reprovacoes: string[]): ConferenciaDaImportacao => ({ linhas: [], reprovacoes })
/** A base e o job da espera de trava: p95 do gerar acesso e da decisão. */
const espera = (acesso: number, decisao: number): ResumoDaFase => limpo({ 'gerar_acesso_duracao p(95)': acesso, 'decidir_duracao p(95)': decisao })
function todosOsResumos(trocas: Record<string, ResumoDaFase> = {}): Map<string, ResumoDaFase> {
  const padrao: Record<string, ResumoDaFase> = { previa_e_gravar: limpo(), rajada: limpo(), rajada_professores: limpo(), transferencias_base: espera(40, 50), transferencias: espera(120, 140), desligamentos_e_virada: limpo(), professores: limpo() }
  return new Map(Object.entries({ ...padrao, ...trocas }))
}

/** As linhas de uma planilha de alunos, lidas pelo mesmo leitor do servidor. */
function linhasDeAlunos(texto: string): Array<{ turma: string; nome: string; matricula: string }> {
  return lerTabela(texto, CABECALHOS_DA_PLANILHA.alunos).linhas.map(({ campos }) => {
    if (campos === null) throw new Error('linha com número de campos errado')
    return { turma: campos['turma'] ?? '', nome: campos['nome'] ?? '', matricula: campos['matricula'] ?? '' }
  })
}
const chaveDaTurma = (turma: string) => indiceDaTurma(nomeDaTurma(turma), null)

describe('as planilhas do cenário "a escola inteira entra de uma vez"', () => {
  it('a planilha de alunos tem as 3.000 linhas do teto, em 100 turmas de 30, com matrícula única e todas as linhas bem formadas', () => {
    const { base } = montarPlanilhasDeAlunos()
    const linhas = linhasDeAlunos(base)
    expect(linhas).toHaveLength(LINHAS_DA_PLANILHA)
    expect(LINHAS_DA_PLANILHA).toBe(MAXIMO_DE_LINHAS_DA_PLANILHA)
    expect(new Set(linhas.map((linha) => linha.matricula)).size).toBe(LINHAS_DA_PLANILHA)
    const porTurma = new Map<string, number>()
    for (const { turma } of linhas) porTurma.set(chaveDaTurma(turma), (porTurma.get(chaveDaTurma(turma)) ?? 0) + 1)
    expect(porTurma.size).toBe(TURMAS_DA_PLANILHA)
    expect([...porTurma.values()].every((quantidade) => quantidade === 30)).toBe(true)
  })

  it('a planilha movida põe 300 alunos em outra turma, com a mesma matrícula e o mesmo nome: é isso que a prévia oferece como transferência', () => {
    const { base, movida, transferidas } = montarPlanilhasDeAlunos()
    const antes = linhasDeAlunos(base)
    const depois = linhasDeAlunos(movida)
    expect(depois).toHaveLength(antes.length)
    const mudaram = antes.flatMap((linha, posicao) => {
      const outra = depois[posicao]
      if (outra === undefined || outra.matricula !== linha.matricula || outra.nome !== linha.nome) throw new Error('a movida troca matrícula ou nome')
      return chaveDaTurma(outra.turma) === chaveDaTurma(linha.turma) ? [] : [posicao]
    })
    expect(mudaram).toHaveLength(TRANSFERENCIAS_POR_VOLTA)
    expect(transferidas).toBe(TRANSFERENCIAS_POR_VOLTA)
    expect(TRANSFERENCIAS_POR_VOLTA).toBe(300)
  })

  it('as transferências saem das turmas onde a professora gera o acesso e decide, e as turmas de destino também existem na planilha (Autoconferência 4)', () => {
    const { base, movida } = montarPlanilhasDeAlunos()
    const antes = linhasDeAlunos(base)
    const depois = linhasDeAlunos(movida)
    const turmasDeOrigem = new Set(antes.flatMap((linha, posicao) => (chaveDaTurma(depois[posicao]?.turma ?? '') === chaveDaTurma(linha.turma) ? [] : [chaveDaTurma(linha.turma)])))
    const turmasDasProfessoras = Array.from({ length: PROFESSORAS }, (_, professora) => turmasDaProfessora(professora)).flat().map((turma) => chaveDaTurma(turmaDaCarga(turma)))
    expect(turmasDasProfessoras).toHaveLength(TURMAS_COM_PROFESSORA)
    for (const turma of turmasDasProfessoras) expect(turmasDeOrigem.has(turma), turma).toBe(true)
    const turmasDaPlanilha = new Set(antes.map((linha) => chaveDaTurma(linha.turma)))
    for (const { turma } of depois) expect(turmasDaPlanilha.has(chaveDaTurma(turma))).toBe(true)
  })

  it('os pedidos pendentes são nomes que as duas planilhas de alunos não citam, nas turmas das professoras: a decisão não desatualiza o job', () => {
    const { base, movida } = montarPlanilhasDeAlunos()
    const pedidos = linhasDeAlunos(montarPlanilhaDosPedidos())
    expect(pedidos).toHaveLength(TURMAS_COM_PROFESSORA * PEDIDOS_POR_TURMA)
    const citadas = new Set([...linhasDeAlunos(base), ...linhasDeAlunos(movida)].flatMap((linha) => [linha.matricula, linha.nome]))
    for (const pedido of pedidos) {
      expect(citadas.has(pedido.matricula)).toBe(false)
      expect(citadas.has(pedido.nome)).toBe(false)
    }
    expect(pedidos[0]?.matricula).toBe(matriculaDaPedido(0, 0))
    expect(pedidos[0]?.nome).toBe(nomeDoPedido(0, 0))
    expect(new Set(pedidos.map((pedido) => pedido.matricula)).size).toBe(pedidos.length)
    // Os lotes de decisão: cada lote de uma professora só, de até cinco pedidos.
    expect((TURMAS_COM_PROFESSORA * PEDIDOS_POR_TURMA) / PEDIDOS_POR_LOTE).toBe(36)
  })

  it('o teto por gravar do cenário é o do contrato, e nenhuma escola da fase pede mais que ele num gravar: a de 300 sai em três de 100', () => {
    expect(DESLIGAMENTOS_POR_GRAVAR).toBe(MAXIMO_DE_DESLIGAMENTOS_POR_GRAVAR)
    expect(DESLIGAMENTOS).toEqual([100, 300])
    expect(DESLIGAMENTOS.map(gravaresParaDesligar)).toEqual([1, 3])
    const k6 = lerArquivo('infra/k6/importacao-7h30.js')
    expect(k6).toContain('trabalho.marcarAte')
    expect(k6).toContain('trabalho.rodadas')
  })

  it('cada escola de desligamento tem os aprovados que o cenário diz, e a planilha que fica cita dez turmas com um aluno cada: o resto, 100 a 300, é candidato a desligar', () => {
    expect(DESLIGAMENTOS).toEqual([100, 300])
    for (const desligamentos of DESLIGAMENTOS) {
      const { texto, matriculas, quemFica } = montarPlanilhaParaAprovar(desligamentos)
      expect(linhasDeAlunos(texto)).toHaveLength(desligamentos + TURMAS_DOS_DESLIGAMENTOS)
      expect(matriculas).toHaveLength(desligamentos + TURMAS_DOS_DESLIGAMENTOS)
      const fica = linhasDeAlunos(quemFica)
      expect(fica).toHaveLength(TURMAS_DOS_DESLIGAMENTOS)
      expect(new Set(fica.map((linha) => chaveDaTurma(linha.turma))).size).toBe(TURMAS_DOS_DESLIGAMENTOS)
      // Quem fica é aluno aprovado: a planilha o chama pelo nome do cadastro dele, que é o da conta sintética.
      expect(fica.every((linha) => linha.nome === NOME_DO_ALUNO_SINTETICO)).toBe(true)
      // Cada um dos que ficam está na lista inicial, na mesma turma: a linha é "já existe", não transferência.
      const inicial = new Map(linhasDeAlunos(texto).map((linha) => [linha.matricula, chaveDaTurma(linha.turma)]))
      for (const linha of fica) expect(inicial.get(linha.matricula), linha.matricula).toBe(chaveDaTurma(linha.turma))
    }
  })

  it('a virada traz 900 alunos em 30 turmas do ano planejado, com o nome do cadastro e matrícula única', () => {
    const { texto, matriculas } = montarPlanilhaDaVirada()
    const linhas = linhasDeAlunos(texto)
    expect(linhas).toHaveLength(ALUNOS_DA_VIRADA)
    expect(ALUNOS_DA_VIRADA).toBe(900)
    expect(new Set(matriculas).size).toBe(ALUNOS_DA_VIRADA)
    expect(linhas.map((linha) => linha.matricula)).toEqual(matriculas)
    expect(new Set(linhas.map((linha) => chaveDaTurma(linha.turma))).size).toBe(TURMAS_DA_VIRADA)
    expect(linhas.every((linha) => linha.nome === NOME_DO_ALUNO_SINTETICO)).toBe(true)
  })

  it('a planilha da equipe tem uma linha por professor que já tem conta, só com e-mail do domínio que não recebe mensagem, e cabe com os novos de cada volta no teto de 300', () => {
    const emails = Array.from({ length: 200 }, (_, posicao) => `sintetico-${String(posicao)}@educa.invalid`)
    const tabela = lerTabela(montarPlanilhaDaEquipe(emails), CABECALHOS_DA_PLANILHA.professores)
    expect(tabela.linhas).toHaveLength(200)
    expect(tabela.linhas.every(({ campos }) => campos !== null && (campos['email'] ?? '').endsWith('@educa.invalid'))).toBe(true)
    const k6 = lerArquivo('infra/k6/importacao-7h30.js')
    expect(lerArquivo('infra/scripts/carga-importacao.ts')).toMatch(/PROFESSORES_QUE_JA_EXISTEM = 200/)
    expect(lerArquivo('infra/scripts/carga-importacao.ts')).toMatch(/PROFESSORES_NOVOS_POR_VOLTA = 100/)
    expect(200 + 100).toBe(MAXIMO_DE_LINHAS_DA_PLANILHA_DE_PROFESSORES)
    expect(k6).toContain('novo-${volta}-${posicao}@educa.invalid')
  })

  it('o nome do aluno sintético da planilha é o da conta sintética que o seed cria: a linha de quem fica é "já existe"', () => {
    expect(NOME_DO_ALUNO_SINTETICO).toBe(NOME_SINTETICO)
  })

  it('as fases cabem na rajada de login (5 min) e a prévia e o gravar não passam de 20 por minuto por coordenação', () => {
    expect(DURACAO_DA_FASE_S.previa_e_gravar).toBeLessThanOrEqual(300)
    const k6 = lerArquivo('infra/k6/importacao-7h30.js')
    const espera = Number(/const ESPERA_ENTRE_CHAMADAS_S = ([\d.]+)/.exec(k6)?.[1])
    // Cada volta faz duas chamadas do balde (a prévia e o gravar contam juntos) e espera `espera` segundos além do job: abaixo de `LIMITE_DA_PLANILHA_POR_MINUTO` (20).
    expect((2 * 60) / espera).toBeLessThan(LIMITE_DA_PLANILHA_POR_MINUTO)
    expect(ACESSOS_POR_SEGUNDO).toBeGreaterThan(0)
  })
})

describe('o veredito do cenário "a escola inteira entra de uma vez"', () => {
  it('passa com todas as fases limpas, a espera de trava abaixo de 300 ms e a conferência sem reprovação', () => {
    const veredito = julgarCenarioDaImportacao(FASES_DO_CENARIO, todosOsResumos(), conferencia())
    expect(veredito.reprovacoes).toEqual([])
    expect(veredito.passou).toBe(true)
    expect(veredito.espera.map((item) => Math.round(item.diferenca))).toEqual([80, 90])
  })

  it('a espera de trava de 300 ms ou mais sobre a base reprova, no gerar acesso e na decisão, cada uma por si; abaixo disso, passa', () => {
    const noTeto = julgarEsperaDeTrava(espera(40, 50), espera(40 + LIMITE_DA_ESPERA_DE_TRAVA_MS, 50 + LIMITE_DA_ESPERA_DE_TRAVA_MS - 1))
    expect(noTeto.reprovacoes.map((item) => item.criterio)).toEqual(['espera:gerar acesso'])
    expect(julgarEsperaDeTrava(espera(40, 50), espera(40 + LIMITE_DA_ESPERA_DE_TRAVA_MS - 1, 50 + LIMITE_DA_ESPERA_DE_TRAVA_MS)).reprovacoes.map((item) => item.criterio)).toEqual(['espera:decidir'])
    expect(julgarEsperaDeTrava(espera(40, 50), espera(339, 349)).reprovacoes).toEqual([])
  })

  it('a espera que não foi medida de um dos lados reprova: a fase que não mediu não passa por não ter medido', () => {
    expect(julgarEsperaDeTrava(limpo(), espera(100, 100)).reprovacoes).toHaveLength(2)
    expect(julgarEsperaDeTrava(espera(40, 50), undefined).reprovacoes).toHaveLength(2)
    const veredito = julgarCenarioDaImportacao(FASES_DO_CENARIO, todosOsResumos({ transferencias: limpo() }), conferencia())
    expect(veredito.passou).toBe(false)
  })

  it('fase pedida que não rodou, ou a rajada de login que não rodou ao lado da prévia, reprova', () => {
    const semRajada = todosOsResumos()
    semRajada.delete('rajada')
    expect(julgarCenarioDaImportacao(['previa_e_gravar'], semRajada, conferencia()).reprovacoes.map((item) => item.criterio)).toEqual(['rajada:k6'])
    const semFase = todosOsResumos()
    semFase.delete('professores')
    expect(julgarCenarioDaImportacao(['professores'], semFase, conferencia()).reprovacoes.map((item) => item.criterio)).toEqual(['professores:k6'])
    expect(resumosDaFase('previa_e_gravar')).toEqual(['previa_e_gravar', 'rajada'])
    expect(resumosDaFase('professores')).toEqual(['professores', 'rajada_professores'])
    expect(resumosDaFase('transferencias')).toEqual(['transferencias'])
  })

  it('a fase dos professores sem a rajada de login ao lado reprova, e a rajada dela não apaga a da prévia: cada uma tem a sua chave', () => {
    const semRajada = todosOsResumos()
    semRajada.delete('rajada_professores')
    expect(julgarCenarioDaImportacao(['professores'], semRajada, conferencia()).reprovacoes.map((item) => item.criterio)).toEqual(['rajada_professores:k6'])
    expect(julgarCenarioDaImportacao(['professores'], todosOsResumos({ rajada_professores: cruzado('login_erro_final{grupo:rajada}') }), conferencia()).reprovacoes.map((item) => item.criterio)).toEqual([
      'rajada_professores:login_erro_final{grupo:rajada}',
    ])
    expect(FASES_COM_RAJADA).toEqual(['previa_e_gravar', 'professores'])
    expect(chaveDaRajada('previa_e_gravar')).toBe('rajada')
    expect(chaveDaRajada('professores')).toBe('rajada_professores')
  })

  it('o threshold cruzado de uma fase reprova com o nome da métrica, e o código de saída que não concorda com o resumo também', () => {
    const fases: FaseDaImportacao[] = ['transferencias_base', 'transferencias']
    const cruzada = julgarCenarioDaImportacao(fases, todosOsResumos({ transferencias: { ...cruzado('respostas_5xx'), valores: espera(120, 140).valores } }), conferencia())
    expect(cruzada.reprovacoes.map((item) => item.criterio)).toEqual(['transferencias:respostas_5xx'])
    // Resumo sem threshold cruzado, mas o k6 saiu com 99: o resumo não conta tudo.
    const incoerente = julgarCenarioDaImportacao(['professores'], todosOsResumos({ professores: { codigo: CODIGO_THRESHOLD_CRUZADO, cruzados: [], valores: {} } }), conferencia())
    expect(incoerente.reprovacoes.map((item) => item.criterio)).toEqual(['professores:k6'])
  })

  it('a conferência que não rodou, ou que reprova, reprova o cenário', () => {
    expect(julgarCenarioDaImportacao(['professores'], todosOsResumos(), undefined).reprovacoes.map((item) => item.criterio)).toEqual(['conferencia'])
    expect(julgarCenarioDaImportacao(['professores'], todosOsResumos(), conferencia('x')).passou).toBe(false)
  })

  it('a espera de trava só se julga quando a fase de transferências foi pedida', () => {
    const veredito = julgarCenarioDaImportacao(['professores'], todosOsResumos({ transferencias_base: limpo(), transferencias: limpo() }), conferencia())
    expect(veredito.passou).toBe(true)
    expect(veredito.espera).toEqual([])
  })

  it('--fases pede só as fases certas; a transferência leva a base junto, que é a régua dela; fase que não existe falha', () => {
    expect(fasesPedidas([])).toEqual(FASES_DO_CENARIO)
    expect(fasesPedidas(['--fases', 'transferencias'])).toEqual(['transferencias_base', 'transferencias'])
    expect(fasesPedidas(['--fases', 'professores,previa_e_gravar'])).toEqual(['previa_e_gravar', 'professores'])
    expect(() => fasesPedidas(['--fases', 'nada'])).toThrow(/--fases aceita só/)
    expect(() => fasesPedidas(['--fases', ''])).toThrow(/--fases aceita só/)
  })

  it('o registro de uma fase lista o que o cenário mede: p95 da prévia e do gravar, da espera, o máximo do job e as contagens', () => {
    const linhas = descreverFase(
      'transferencias',
      limpo({ 'previa_duracao p(95)': 900, 'gerar_acesso_duracao p(95)': 120, 'job_duracao{trabalho:transferencias} max': 6000, 'respostas_5xx count': 0, 'jobs_concluidos count': 11, 'http_reqs count': 5 }),
    )
    expect(linhas.join('\n')).toContain('previa_duracao p(95) = 900')
    expect(linhas.join('\n')).toContain('job_duracao{trabalho:transferencias} max = 6000')
    expect(linhas.join('\n')).toContain('jobs_concluidos count = 11')
    expect(linhas.join('\n')).not.toContain('http_reqs')
  })
})

describe('a conferência do cenário "a escola inteira entra de uma vez"', () => {
  it('o passo (3) que não rodou o mínimo da fase reprova: o job não chegou a ele, e o cenário não mediu o [C]', () => {
    expect(julgarPasso3('transferencias', PASSO_3_MINIMO.transferencias, 0, 0)).toHaveLength(1)
    expect(julgarPasso3('transferencias', PASSO_3_MINIMO.transferencias, PASSO_3_MINIMO.transferencias, PASSO_3_MINIMO.transferencias)).toEqual([])
    // Um passo (3) por gravar (1 de 100 e 3 de 100) e o da virada.
    expect(PASSO_3_MINIMO.desligamentos_e_virada).toBe(1 + 3 + 1)
  })

  it('um passo (3) acima de 1 s reprova, e o teto é o do alerta da Tech Spec', () => {
    expect(TETO_DO_PASSO_3_S).toBe(1)
    const reprovacoes = julgarPasso3('desligamentos_e_virada', 5, 5, 4)
    expect(reprovacoes).toHaveLength(1)
    expect(reprovacoes[0]).toContain('acima de 1 s')
  })

  it('importação que falhou reprova, e a fase com menos importações concluídas do que pede também', () => {
    expect(julgarImportacoes('professores', 3, { concluida: 5 })).toEqual([])
    expect(julgarImportacoes('professores', 3, { concluida: 5, falhou: 1 })).toHaveLength(1)
    expect(julgarImportacoes('professores', 3, { concluida: 2 })).toHaveLength(1)
    expect(julgarImportacoes('professores', 3, {})).toHaveLength(1)
  })

  it('o 5xx da API é medido nas rotas que o cenário chama, com o login por e-mail e o por matrícula entre elas', () => {
    const conferir = lerArquivo('infra/scripts/conferir-carga-importacao.ts')
    expect(conferir).toContain("ROTAS_DO_CENARIO = '/v1/importacoes.*|/v1/turmas/:id/acesso|/v1/reivindicacoes/decidir|/v1/sessao/(email|matricula(/trocar-senha)?)|/v1/senha/redefinir'")
    expect(conferir).toContain('http_response_status_code=~"5.."')
  })
})

describe('o que o k6 do cenário chama e exige', () => {
  it('os argumentos do k6 levam a fase, a API pela borda e o arquivo da pasta temporária: nunca senha, token nem e-mail', () => {
    for (const fase of FASES_DO_CENARIO) {
      const argumentos = argumentosDoK6DaImportacao(fase)
      expect(argumentos).toContain(`FASE=${fase}`)
      expect(argumentos).toContain('API_URL=http://borda:8080')
      expect(argumentos).toContain(`ARQUIVO_DAS_CONTAS=/execucao/contas-${fase}.json`)
      expect(argumentos.join(' ')).not.toMatch(/senha|token|@|codigo/i)
    }
  })

  it('o cenário só chama a prévia, o gravar, a leitura da importação, o gerar acesso, o decidir, o login por e-mail e o redefinir: nada de provedor pago (regra 80, item 11)', () => {
    const script = lerArquivo('infra/k6/importacao-7h30.js')
    const rotas = new Set([...script.matchAll(/['"`](\/v1\/[^`'"?]*)/g)].map((achado) => achado[1]))
    expect([...rotas].sort()).toEqual(['/v1/importacoes/${id}', '/v1/importacoes/${trabalho.tipo}', '/v1/importacoes/${trabalho.tipo}/previa', '/v1/turmas/${turma.id}/acesso'].concat(['/v1/reivindicacoes/decidir', '/v1/sessao/email', '/v1/senha/redefinir']).sort())
    expect(stripComments(script)).not.toMatch(/openai|anthropic|gemini|maritaca|googleapis|api\.groq|oidc|\/v1\/tutor|\/v1\/assistente|\/v1\/ia\//i)
    expect(stripComments(lerArquivo('infra/scripts/carga-importacao.ts'))).not.toMatch(/openai|anthropic|gemini|maritaca|oidc-falso/i)
  })

  it('os thresholds são os do cenário: p95 de 2 s na prévia e no gravar, zero 5xx e zero resposta fora do esperado, job concluído e nenhum parado na fila', () => {
    const script = lerArquivo('infra/k6/importacao-7h30.js')
    expect(script).toMatch(/export const P95_MAXIMO_DA_PREVIA_E_DO_GRAVAR_MS = 2_000/)
    expect(script).toContain('previa_duracao: [`p(95)<${P95_MAXIMO_DA_PREVIA_E_DO_GRAVAR_MS}`]')
    expect(script).toContain('gravar_duracao: [`p(95)<${P95_MAXIMO_DA_PREVIA_E_DO_GRAVAR_MS}`]')
    expect(script).toContain("respostas_5xx: ['count==0']")
    expect(script).toContain("respostas_inesperadas: ['count==0']")
    expect(script).toContain("respostas_503: ['count==0']")
    expect(script).toContain("jobs_nao_concluidos: ['count==0']")
    expect(script).toContain('jobs_concluidos: [`count==${GRAVARES}`]')
    expect(script).toContain("marcas_fora_do_esperado: ['count==0']")
    expect(script).toMatch(/export const LINHAS_DA_PLANILHA = 3_000/)
  })

  it('o redefinir dos professores: um token semeado por redefinir, o SHA-256 que a API procura, usado uma vez, 204 em todos e zero 503 (acesso-e-convites, 10.0)', async () => {
    const consultas: Array<{ texto: string; valores: unknown[] }> = []
    const banco = {
      query: (texto: string, valores: unknown[]) => {
        consultas.push({ texto, valores })
        return Promise.resolve({ rows: [], rowCount: 0 })
      },
    }
    const contaIds = Array.from({ length: 3 }, (_, posicao) => `0190f5a0-0000-7000-8000-00000000000${String(posicao)}`)
    const redefinicoes = await semearLinksDeRedefinir(banco as never, contaIds)
    expect(redefinicoes).toHaveLength(3)
    expect(new Set(redefinicoes.map(({ token }) => token)).size).toBe(3)
    const [consulta] = consultas
    expect(consulta?.valores[0]).toEqual(contaIds)
    // O banco guarda o hash que a API procura, e nunca o token.
    expect(consulta?.valores[1]).toEqual(redefinicoes.map(({ token }) => hashDoToken(token)))
    expect(JSON.stringify(consulta?.valores)).not.toContain(redefinicoes[0]?.token ?? 'x')
    expect(consulta?.texto).toContain("'redefinir'")
    expect(consulta?.texto).toContain("'enviado'")

    // A fase gasta um token por segundo e semeia exatamente os que gasta; os professores que redefinem são dos que já têm conta.
    expect(REDEFINICOES_DA_FASE).toBe(REDEFINICOES_POR_SEGUNDO * DURACAO_DA_FASE_S.professores)
    expect(REDEFINICOES_DA_FASE).toBeLessThanOrEqual(PROFESSORES_QUE_JA_EXISTEM)
    const k6 = lerArquivo('infra/k6/importacao-7h30.js')
    expect(k6).toContain('redefinicoes_feitas: [`count==${REDEFINICOES.length}`]')
    expect(k6).toContain("contar(resposta, [204])")
    expect(k6).toContain("if (volta >= REDEFINICOES.length) return")
    expect(k6).toContain("respostas_503: ['count==0']")
    expect(argumentosDoK6DaImportacao('professores').join(' ')).not.toMatch(/token/i)
    expect(descreverFase('professores', limpo({ 'redefinicoes_feitas count': 90, 'redefinir_duracao p(95)': 120 })).join('\n')).toContain('redefinicoes_feitas count = 90')
  })

  it('a fase dos professores roda ao lado da rajada de login, do outro container, e o driver a prepara antes de montar a escola', () => {
    const driver = lerArquivo('infra/scripts/carga-importacao.ts')
    expect(driver).toContain("FASES_COM_RAJADA.includes(fase) ? iniciarARajada(compose, pasta)")
    expect(driver).toContain("if (FASES_COM_RAJADA.includes(fase)) await prepararARajada(pasta, contexto.doArquivo)")
    expect(driver).toContain("FASES_COM_RAJADA.includes(fase) ? 'k6-atacante' : 'k6'")
    expect(DURACAO_DA_FASE_S.professores).toBeLessThanOrEqual(300)
  })

  it('a rajada de login do F1 corre ao lado da prévia: o driver a chama pelo mesmo k6 do login, com as 2.100 contas', () => {
    const driver = lerArquivo('infra/scripts/carga-importacao.ts')
    expect(driver).toContain("argumentosDoK6DeLogin('rajada')")
    expect(driver).toContain('semearContas(doArquivo)')
    expect(lerArquivo('infra/k6/login-7h30.js')).toMatch(/export const CONTAS_NA_RAJADA = 2_100/)
  })
})
