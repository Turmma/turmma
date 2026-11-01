import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  acrescentarRevisao,
  antesDoCommit,
  alteracaoQueCaduca,
  alteracoesDeCodigo,
  alvosDoPortao,
  arquivosAlterados,
  arvoreDoCommit,
  destinoProtegidoDoPush,
  arquivosDoCommit,
  arquivosPreparados,
  avaliarCarimbo,
  avaliarPortao,
  arquivosDaMensagem,
  arquivosQueMudaram,
  bloqueioDoForaDoProcesso,
  comandosDoShell,
  conteudoDoDisco,
  decidirCommit,
  desvioDoHook,
  ehCodigoParaAEsteira,
  ehPapelDoTime,
  textoDosArquivosDeMensagem,
  caminhoDaTarefa,
  carimbarSeNadaMudou,
  chaveDaRodada,
  CHAVE_DO_PORTAO,
  impressaoSemComentarios,
  instantaneoDe,
  ehCommit,
  extrairVeredito,
  gravarCarimbo,
  gravarInstantaneo,
  lerCarimbo,
  lerHora,
  lerInstantaneos,
  lerRevisoes,
  lerTranscript,
  linhaDosObrigatorios,
  obrigatoriosDoCommit,
  portao,
  registrar,
  revisoresObrigatorios,
  SUITES_DO_PORTAO_COMPLETO,
  SUITES_DO_PORTAO_DA_TAREFA,
  type Carimbo,
  type Revisao,
  ultimaRodadaNosAchados,
} from './revisoes.ts'
import { avaliarMutacoes } from './mutacoes.ts'
import { CODIGO_PARA_A_ESTEIRA, DOCUMENTO_PARA_A_ESTEIRA } from '../ci/caminhos-da-esteira.ts'

const TAREFA = `# Tarefa 9.0 — Exemplo

**Funcionalidade:** exemplo · **Depende de:** 7.0
**Subagentes obrigatórios:** \`infra-guardian\`, \`tenancy-guardian\`, \`frontend-reviewer\`, \`domain-researcher\`, \`test-engineer\`

## Critério de conclusão

- [ ] Revisão aprovada
`

const rodada = (revisor: string, veredito: string, inicio: string, fim = inicio): Omit<Revisao, 'rodada'> => ({
  revisor,
  veredito,
  inicio,
  fim,
  agente: `a-${revisor}`,
})

function tarefaCom(...revisoes: Omit<Revisao, 'rodada'>[]): string {
  return revisoes.reduce((conteudo, revisao) => acrescentarRevisao(conteudo, revisao), TAREFA)
}

const tudoAprovadoAs10 = tarefaCom(
  rodada('infra-guardian', 'APROVADO', '2026-09-13 10:00:00', '2026-09-13 10:05:00'),
  rodada('tenancy-guardian', 'APROVADO', '2026-09-13 10:00:00', '2026-09-13 10:04:00'),
  rodada('frontend-reviewer', 'AJUSTES NECESSÁRIOS', '2026-09-13 10:00:00', '2026-09-13 10:03:00'),
  rodada('test-engineer', 'APROVADO', '2026-09-13 10:00:00', '2026-09-13 10:06:00'),
  rodada('revisor-geral', 'APROVADO', '2026-09-13 10:00:00', '2026-09-13 10:07:00'),
)

// O portão local passou às 09:59:30, com o e2e e o infra que o frontend-reviewer e o infra-guardian exigem.
const carimboVerde: Carimbo = { inicio: new Date(lerHora('2026-09-13 09:59:30')).toISOString(), suites: ['typecheck', 'lint', 'segredo', 'dependencias', 'test', 'e2e', 'infra'] }

const portaoDe = (
  conteudo: string,
  alteradoEm: string | null,
  mensagem = 'Implementa x (tarefa 9.0)\n\nRevisões: ...',
  arquivo = 'apps/worker/src/job-executor.ts',
  carimbo: Carimbo | null = carimboVerde,
) =>
  avaliarPortao({
    obrigatorios: revisoresObrigatorios(conteudo),
    revisoes: lerRevisoes(conteudo),
    alteracoes: alteradoEm ? [{ arquivo, quando: lerHora(alteradoEm), hash: 'hash-do-conteudo-atual' }] : [],
    carimbo,
    mensagemCommit: mensagem,
    documento: 'tasks/prd-exemplo/9_task.md',
    instantaneos: {},
  })

describe('veredito e tarefa do revisor', () => {
  it('lê o veredito nos formatos que os revisores escrevem', () => {
    expect(extrairVeredito('VEREDITO: APROVADO')).toBe('APROVADO')
    expect(extrairVeredito('**VEREDITO:** REPROVADO\n\nProblemas...')).toBe('REPROVADO')
    expect(extrairVeredito('VEREDITO: **APROVADO**, desde que a integração, que ficou REPROVADO antes, passe')).toBe('APROVADO')
    expect(extrairVeredito('VEREDITO: VETO')).toBe('REPROVADO')
    expect(extrairVeredito('VEREDITO: AJUSTES NECESSÁRIOS')).toBe('AJUSTES NECESSÁRIOS')
    expect(extrairVeredito('Parece tudo certo, aprovado.')).toBeNull()
  })

  it('a linha "Tarefa:" do prompt vence a menção a outra tarefa usada como contexto', () => {
    const prompt = 'Contexto: o despachante de tasks/prd-fundacao-tecnica/7_task.md.\nTarefa: tasks/prd-fundacao-tecnica/9_task.md'
    expect(caminhoDaTarefa(prompt)).toBe('tasks/prd-fundacao-tecnica/9_task.md')
  })

  it('a rodada começa na última mensagem de quem chamou, não no último resultado de ferramenta', () => {
    const transcript = [
      { type: 'user', timestamp: '2026-09-13T13:00:00.000Z', message: { content: 'Tarefa: tasks/prd-x/9_task.md' } },
      { type: 'user', timestamp: '2026-09-13T13:01:00.000Z', message: { content: [{ type: 'tool_result', content: 'ok' }] } },
      { type: 'user', timestamp: '2026-09-13T13:20:00.000Z', message: { content: [{ type: 'text', text: 'Corrigido, revise de novo' }] } },
      { type: 'user', timestamp: '2026-09-13T13:21:00.000Z', message: { content: [{ type: 'tool_result', content: 'ok' }] } },
    ]
    const lido = lerTranscript(transcript.map((linha) => JSON.stringify(linha)).join('\n'))
    expect(lido.inicioDaRodada?.toISOString()).toBe('2026-09-13T13:20:00.000Z')
    expect(caminhoDaTarefa(lido.prompt)).toBe('tasks/prd-x/9_task.md')
  })
})

describe('seção Revisões', () => {
  it('cria a seção uma vez e numera a rodada por revisor', () => {
    const conteudo = tarefaCom(
      rodada('infra-guardian', 'REPROVADO', '2026-09-13 09:00:00'),
      rodada('test-engineer', 'APROVADO', '2026-09-13 09:01:00'),
      rodada('infra-guardian', 'APROVADO', '2026-09-13 09:30:00'),
    )
    expect(conteudo.match(/## Revisões/g)).toHaveLength(1)
    expect(lerRevisoes(conteudo).map((revisao) => [revisao.revisor, revisao.rodada, revisao.veredito])).toEqual([
      ['infra-guardian', 1, 'REPROVADO'],
      ['test-engineer', 1, 'APROVADO'],
      ['infra-guardian', 2, 'APROVADO'],
    ])
  })

  it('a rodada não recomeça do 1 quando a seção some', () => {
    // O Implementador reescreveu o documento inteiro: a tabela voltou vazia, mas o hook já tinha guardado a reprovação.
    const achados =
      '# Achados das revisões — `tasks/prd-exemplo/9_task.md`\n\n' +
      '## revisor-geral · 1ª rodada · REPROVADO · 2026-09-13 10:00:00 · `tasks/prd-exemplo/9_task.md`\n\nBloqueantes:\n- x\n\n' +
      '## test-engineer · 1ª rodada · APROVADO · 2026-09-13 10:01:00 · `tasks/prd-exemplo/9_task.md`\n\nRecomendações:\n- y\n\n' +
      '## revisor-geral · 2ª rodada · REPROVADO · 2026-09-13 10:30:00 · `tasks/prd-exemplo/9_task.md`\n\nBloqueantes:\n- z\n'
    const semASecao = acrescentarRevisao(TAREFA, rodada('revisor-geral', 'APROVADO', '2026-09-13 11:00:00'), undefined, achados)
    expect(lerRevisoes(semASecao).map((revisao) => [revisao.revisor, revisao.rodada])).toEqual([['revisor-geral', 3]])
    // Quem não tem bloco nos achados continua do que a tabela diz, e o outro revisor não empresta a contagem.
    const outro = acrescentarRevisao(semASecao, rodada('infra-guardian', 'APROVADO', '2026-09-13 11:01:00'), undefined, achados)
    expect(lerRevisoes(outro).map((revisao) => [revisao.revisor, revisao.rodada])).toEqual([
      ['revisor-geral', 3],
      ['infra-guardian', 1],
    ])
    // Com a tabela intacta e maior que os achados (rodada aprovada limpa não deixa bloco), vale a tabela.
    const intacta = tarefaCom(
      rodada('test-engineer', 'REPROVADO', '2026-09-13 09:00:00'),
      rodada('test-engineer', 'APROVADO', '2026-09-13 09:30:00'),
    )
    const seguinte = acrescentarRevisao(intacta, rodada('test-engineer', 'APROVADO', '2026-09-13 10:00:00'), undefined, achados)
    expect(lerRevisoes(seguinte).map((revisao) => revisao.rodada)).toEqual([1, 2, 3])
  })

  it('limite conhecido: a seção que some depois de uma aprovação limpa perde essa rodada, porque ela não deixa bloco nos achados', () => {
    // A aprovada limpa não é guardada em `achados/` (`achadoDaRodada`), então a tabela é a única que a conhece.
    // Isto fixa o limite escrito no documento da correção e no TODO.md; se a contagem passar a achá-la, o teste muda.
    const achadosSemBlocos = '# Achados das revisões — `tasks/prd-exemplo/9_task.md`\n'
    const semASecao = acrescentarRevisao(TAREFA, rodada('revisor-geral', 'APROVADO', '2026-09-13 11:00:00'), undefined, achadosSemBlocos)
    expect(lerRevisoes(semASecao).map((revisao) => revisao.rodada)).toEqual([1])
  })

  it('o cabeçalho de seção dentro do texto do revisor não conta como rodada', () => {
    const achados =
      '## revisor-geral · 1ª rodada · REPROVADO · 2026-09-13 10:00:00 · `tasks/prd-exemplo/9_task.md`\n\n' +
      '## revisor-geral · 7ª rodada · da outra tarefa, citada como exemplo\n\n' +
      '## frontend-reviewer · 4ª rodada · AJUSTES NECESSÁRIOS · 2026-09-13 10:30:00 · `tasks/prd-exemplo/9_task.md`\n'
    expect(ultimaRodadaNosAchados(achados, 'revisor-geral')).toBe(1)
    // O veredito de duas palavras também é lido.
    expect(ultimaRodadaNosAchados(achados, 'frontend-reviewer')).toBe(4)
    expect(ultimaRodadaNosAchados('', 'revisor-geral')).toBe(0)
  })

  it('obrigatórios são só os revisores, não o pesquisador, e toda tarefa tem revisor-geral', () => {
    expect(revisoresObrigatorios(TAREFA)).toEqual(['infra-guardian', 'tenancy-guardian', 'frontend-reviewer', 'test-engineer', 'revisor-geral'])
    expect(revisoresObrigatorios('**Subagentes obrigatórios:** `tenancy-guardian`')).toEqual(['tenancy-guardian', 'test-engineer', 'revisor-geral'])
    expect(revisoresObrigatorios('**Subagentes obrigatórios:** `privacy-guardian`', 'correcao')).toEqual(['privacy-guardian', 'test-engineer'])
  })

  it('reconhece a revisão de spec e a correção como documentos, e não o arquivo de achados', () => {
    expect(caminhoDaTarefa('Tarefa: tasks/prd-x/revisao-spec.md')).toBe('tasks/prd-x/revisao-spec.md')
    expect(caminhoDaTarefa('Tarefa: tasks/correcoes/2026-09-15-dns-lento.md')).toBe('tasks/correcoes/2026-09-15-dns-lento.md')
    expect(caminhoDaTarefa('Veja tasks/correcoes/achados-revisoes.md')).toBeNull()
  })
})

describe('portão do commit', () => {
  it('passa com todos os obrigatórios revisados depois da última alteração e a linha de revisões', () => {
    expect(portaoDe(tudoAprovadoAs10, '2026-09-13 09:59:00').bloqueios).toEqual([])
  })

  it('bloqueia revisor obrigatório que nunca rodou', () => {
    const semTenancy = tarefaCom(
      rodada('infra-guardian', 'APROVADO', '2026-09-13 10:00:00'),
      rodada('frontend-reviewer', 'APROVADO', '2026-09-13 10:00:00'),
      rodada('test-engineer', 'APROVADO', '2026-09-13 10:00:00'),
      rodada('revisor-geral', 'APROVADO', '2026-09-13 10:00:00'),
    )
    const { bloqueios } = portaoDe(semTenancy, '2026-09-13 09:00:00')
    expect(bloqueios).toHaveLength(1)
    expect(bloqueios[0]).toMatch(/^tenancy-guardian: nenhuma rodada/)
  })

  it('bloqueia quando a última rodada de um revisor com veto reprovou, mesmo com aprovação antes (caso da 5.0)', () => {
    const conteudo = acrescentarRevisao(tudoAprovadoAs10, rodada('infra-guardian', 'REPROVADO', '2026-09-13 10:20:00'))
    const { bloqueios } = portaoDe(conteudo, '2026-09-13 09:59:00')
    expect(bloqueios).toHaveLength(1)
    expect(bloqueios[0]).toMatch(/^infra-guardian: a última rodada \(2ª/)
  })

  it('bloqueia aprovação anterior a uma correção: a revisão vale para o código que o revisor viu', () => {
    const { bloqueios } = portaoDe(tudoAprovadoAs10, '2026-09-13 10:30:00')
    expect(bloqueios.map((bloqueio) => bloqueio.split(':')[0])).toEqual([
      'infra-guardian',
      'tenancy-guardian',
      'frontend-reviewer',
      'test-engineer',
      'revisor-geral',
      'portão local',
    ])
  })

  it('correção só em teste caduca test-engineer e revisor-geral, e não os guardiões', () => {
    const { bloqueios } = portaoDe(tudoAprovadoAs10, '2026-09-13 10:30:00', undefined, 'apps/api/test/sessao-guard.int.test.ts')
    expect(bloqueios.map((bloqueio) => bloqueio.split(':')[0])).toEqual(['test-engineer', 'revisor-geral', 'portão local'])
  })

  it('bloqueia sem carimbo do portão local, com carimbo velho, e com carimbo sem a suíte que a tarefa exige', () => {
    expect(portaoDe(tudoAprovadoAs10, '2026-09-13 09:59:00', undefined, undefined, null).bloqueios).toEqual([
      expect.stringMatching(/^portão local: nunca passou.*portao-local\.ts --tarefa/),
    ])
    const velho = { ...carimboVerde, inicio: new Date(lerHora('2026-09-13 09:58:00')).toISOString() }
    expect(portaoDe(tudoAprovadoAs10, '2026-09-13 09:59:00', undefined, undefined, velho).bloqueios).toEqual([
      expect.stringMatching(/^portão local: apps\/worker\/src\/job-executor.ts mudou/),
    ])
    const semTeste = { ...carimboVerde, suites: ['typecheck', 'lint', 'segredo', 'dependencias'] }
    expect(portaoDe(tudoAprovadoAs10, '2026-09-13 09:59:00', undefined, undefined, semTeste).bloqueios).toEqual([
      expect.stringMatching(/^portão local: o último não rodou test\./),
    ])
  })

  it('o commit da tarefa aceita o portão da tarefa: e2e e infra inteiros ficam para o portão completo do fim da spec', () => {
    // A tarefa do fixture marca frontend-reviewer e infra-guardian, que até 08/10/2026 exigiam e2e e infra inteiros.
    const daTarefa = { ...carimboVerde, suites: [...SUITES_DO_PORTAO_DA_TAREFA], alvos: ['apps/worker/test/executor.int.test.ts'] }
    expect(portaoDe(tudoAprovadoAs10, '2026-09-13 09:59:00', undefined, undefined, daTarefa).bloqueios).toEqual([])
    const semE2eNemInfra = { ...carimboVerde, suites: ['typecheck', 'lint', 'segredo', 'dependencias', 'test'] }
    expect(portaoDe(tudoAprovadoAs10, '2026-09-13 09:59:00', undefined, undefined, semE2eNemInfra).bloqueios).toEqual([])
    // Os alvos sem a unidade inteira não valem por `test`, e a unidade sem os alvos também não.
    for (const suites of [['typecheck', 'lint', 'segredo', 'dependencias', 'alvo'], ['typecheck', 'lint', 'segredo', 'dependencias', 'unidade']]) {
      expect(portaoDe(tudoAprovadoAs10, '2026-09-13 09:59:00', undefined, undefined, { ...carimboVerde, suites }).bloqueios).toEqual([
        expect.stringMatching(/^portão local: o último não rodou test\./),
      ])
    }
    // As duas guardas da esteira que não são teste entram em todo portão: sem elas o commit não passa.
    const semGuardas = { ...carimboVerde, suites: ['typecheck', 'lint', 'unidade', 'alvo'] }
    expect(portaoDe(tudoAprovadoAs10, '2026-09-13 09:59:00', undefined, undefined, semGuardas).bloqueios).toEqual([
      expect.stringMatching(/^portão local: o último não rodou segredo, dependencias\./),
    ])
    // Mudou depois do portão da tarefa, ele caduca como o completo.
    const velho = { ...daTarefa, inicio: new Date(lerHora('2026-09-13 09:58:00')).toISOString() }
    expect(portaoDe(tudoAprovadoAs10, '2026-09-13 09:59:00', undefined, undefined, velho).bloqueios).toEqual([
      expect.stringMatching(/^portão local: apps\/worker\/src\/job-executor.ts mudou.*--tarefa/),
    ])
  })

  it('o portão completo só é atendido pelo carimbo que rodou tudo, e o da tarefa não passa por ele', () => {
    const completo: Carimbo = { inicio: '2026-09-13T12:59:30.000Z', suites: [...SUITES_DO_PORTAO_COMPLETO] }
    expect(avaliarCarimbo(completo, SUITES_DO_PORTAO_COMPLETO, [])).toBeNull()
    const daTarefa: Carimbo = { inicio: '2026-09-13T12:59:30.000Z', suites: [...SUITES_DO_PORTAO_DA_TAREFA] }
    expect(avaliarCarimbo(daTarefa, SUITES_DO_PORTAO_COMPLETO, [])).toMatch(/^portão local: o último não rodou e2e, infra\. Rode `node tools\/processo\/portao-local\.ts --e2e --infra`/)
    expect(avaliarCarimbo(null, SUITES_DO_PORTAO_COMPLETO, [])).toMatch(/nunca passou.*--e2e --infra/)
  })

  it('os alvos do portão da tarefa são os testes alterados, cada um na sua suíte, sem repetir', () => {
    const alterados = [
      'apps/worker/src/processors/expurgar-escola.ts',
      'apps/worker/test/expurgo-da-escola.int.test.ts',
      'packages/core/src/retencao/expurgo-da-escola.test.ts',
      'packages/core/src/retencao/retencao.int.test.ts',
      'e2e/privacidade.spec.ts',
      'e2e/support/seed.ts',
      'infra/alertas/expurgo.int.test.ts',
      'apps/api/dist/x.int.test.ts',
      'node_modules/pacote/y.int.test.ts',
      'tools/ci/fixtures/z.int.test.ts',
      'docs/lgpd.md',
      'e2e/privacidade.spec.ts',
    ]
    expect(alvosDoPortao(alterados)).toEqual({
      integracao: ['apps/worker/test/expurgo-da-escola.int.test.ts', 'packages/core/src/retencao/retencao.int.test.ts'],
      e2e: ['e2e/privacidade.spec.ts'],
      infra: ['infra/alertas/expurgo.int.test.ts'],
      processo: [],
    })
    // Teste de unidade não é alvo: a unidade roda inteira sempre.
    expect(alvosDoPortao(['packages/shared/src/a.test.ts', 'apps/web/src/b.test.tsx'])).toEqual({ integracao: [], e2e: [], infra: [], processo: [] })
  })

  it('o teste do git hook entra nos alvos sempre que algo de tools/processo/ muda, e o teste do processo não vai para a integração com compose (RF14)', () => {
    const doHook = 'tools/processo/hook-git.int.test.ts'
    // Qualquer arquivo da pasta puxa o teste do hook, também o que não é teste e o script do git hook.
    for (const arquivo of ['tools/processo/portao.ts', 'tools/processo/git-hooks/commit-msg', 'tools/processo/harness/rotulos.test.ts']) {
      expect(alvosDoPortao([arquivo])).toEqual({ integracao: [], e2e: [], infra: [], processo: [doHook] })
    }
    // O que está fora da pasta, e o fixture de CI, não o puxa.
    expect(alvosDoPortao(['tools/ci/verificar.ts', 'tools/guardas/gitleaks.int.test.ts', 'tools/ci/fixtures/x.int.test.ts', '.claude/hooks/contexto-inicial.sh']).processo).toEqual([])
    // O outro teste de integração do processo vai para o mesmo projeto, e o do hook não repete quando ele mesmo mudou.
    expect(alvosDoPortao([doHook, 'tools/processo/portao.ts', 'tools/processo/zeta.int.test.ts'])).toEqual({
      integracao: [],
      e2e: [],
      infra: [],
      processo: ['tools/processo/hook-git.int.test.ts', 'tools/processo/zeta.int.test.ts'],
    })
    // Sem repetir o do hook, e na ordem do nome, venha o outro por onde vier.
    expect(alvosDoPortao(['tools/processo/zeta.int.test.ts']).processo).toEqual(['tools/processo/hook-git.int.test.ts', 'tools/processo/zeta.int.test.ts'])
    // Os de `tools/` fora do processo continuam na integração com compose.
    expect(alvosDoPortao(['tools/guardas/gitleaks.int.test.ts']).integracao).toEqual(['tools/guardas/gitleaks.int.test.ts'])
  })

  it('bloqueia correção feita enquanto a rodada corria, mesmo que o veredito tenha saído depois', () => {
    // infra começou 10:00 e aprovou 10:05; a alteração é de 10:02.
    const { bloqueios } = portaoDe(tudoAprovadoAs10, '2026-09-13 10:02:00')
    expect(bloqueios.some((bloqueio) => bloqueio.startsWith('infra-guardian:'))).toBe(true)
  })

  it('revisor-geral reprovado bloqueia como veto', () => {
    const conteudo = acrescentarRevisao(tudoAprovadoAs10, rodada('revisor-geral', 'REPROVADO', '2026-09-13 10:20:00'))
    expect(portaoDe(conteudo, '2026-09-13 09:59:00').bloqueios).toEqual([expect.stringMatching(/^revisor-geral: a última rodada \(2ª/)])
  })

  it('revisor sem veto com AJUSTES NECESSÁRIOS não bloqueia, se rodou sobre o código atual', () => {
    const { bloqueios } = portaoDe(tudoAprovadoAs10, '2026-09-13 09:59:00')
    expect(bloqueios.some((bloqueio) => bloqueio.startsWith('frontend-reviewer'))).toBe(false)
  })

  it('bloqueia a mensagem sem a linha de revisões e sugere a linha', () => {
    const { bloqueios, linhaResumo } = portaoDe(tudoAprovadoAs10, '2026-09-13 09:59:00', 'Implementa x (tarefa 9.0)')
    expect(bloqueios).toHaveLength(1)
    expect(linhaResumo).toBe(
      'Revisões: infra-guardian APROVADO (1ª rodada), tenancy-guardian APROVADO (1ª rodada), frontend-reviewer AJUSTES NECESSÁRIOS (1ª rodada), test-engineer APROVADO (1ª rodada), revisor-geral APROVADO (1ª rodada)',
    )
  })
})

describe('hooks sobre um repositório de verdade', () => {
  function repositorio() {
    const raiz = mkdtempSync(join(tmpdir(), 'revisoes-'))
    const git = (...args: string[]) => execFileSync('git', args, { cwd: raiz, stdio: 'pipe' })
    git('init', '-q')
    mkdirSync(join(raiz, 'tasks/prd-exemplo'), { recursive: true })
    mkdirSync(join(raiz, 'apps'), { recursive: true })
    writeFileSync(join(raiz, 'tasks/prd-exemplo/9_task.md'), TAREFA.replace(', `frontend-reviewer`', ''))
    writeFileSync(join(raiz, 'apps/codigo.ts'), 'export const a = 1\n')
    return raiz
  }

  // O transcript mora fora do repositório, como em ~/.claude/projects.
  const pastaTranscripts = mkdtempSync(join(tmpdir(), 'transcripts-'))
  function transcript(_raiz: string, nome: string, inicio: string) {
    const caminho = join(pastaTranscripts, `${nome}-${Math.random().toString(36).slice(2)}.jsonl`)
    const prompt = 'Audite a tarefa.\nTarefa: tasks/prd-exemplo/9_task.md\nVeja também tasks/prd-exemplo/7_task.md'
    writeFileSync(caminho, JSON.stringify({ type: 'user', timestamp: new Date(inicio).toISOString(), message: { content: prompt } }))
    return caminho
  }

  /** A mesma mensagem dos outros casos deste describe, numa constante para o comando não repetir a marca. */
  const COMMIT_DA_TAREFA = 'git add -A && git commit -m "Implementa x (tarefa 9.0)\n\nRevisões: ok"'

  const tocar = (raiz: string, arquivo: string, quando: string) => {
    const data = new Date(quando)
    utimesSync(join(raiz, arquivo), data, data)
  }

  /**
   * Uma correção de verdade: conteúdo novo e o `mtime` no instante pedido. `tocar` sozinho não serve para representar
   * uma correção desde que o portão passou a olhar o conteúdo — e é esse o ponto: o revisor que muta e restaura move
   * só o `mtime`, e isso não pode caducar rodada nenhuma.
   */
  const corrigir = (raiz: string, arquivo: string, quando: string, conteudo: string) => {
    writeFileSync(join(raiz, arquivo), conteudo)
    tocar(raiz, arquivo, quando)
  }

  it('o revisor registra a própria rodada, e o commit só passa quando todos aprovaram depois da correção', () => {
    const raiz = repositorio()
    const commit = { tool_input: { command: 'git add -A && git commit -m "Implementa x (tarefa 9.0)\n\nRevisões: ok"' } }
    tocar(raiz, 'apps/codigo.ts', '2026-09-13T09:00:00')

    expect(portao(commit, raiz)).toMatch(/nenhuma rodada/)

    for (const revisor of ['infra-guardian', 'tenancy-guardian', 'privacy-guardian', 'conformidade-reviewer', 'test-engineer', 'revisor-geral']) {
      const veredito = revisor === 'tenancy-guardian' ? 'REPROVADO' : 'APROVADO'
      const mensagem = veredito === 'REPROVADO' ? 'VEREDITO: REPROVADO\nBloqueantes:\n- apps/codigo.ts:1 sem escopo de escola' : `VEREDITO: ${veredito}`
      registrar(
        { agent_type: revisor, agent_id: `a-${revisor}`, agent_transcript_path: transcript(raiz, revisor, '2026-09-13T10:00:00'), last_assistant_message: mensagem },
        raiz,
        new Date('2026-09-13T10:05:00'),
      )
    }
    // Quem não é revisor não escreve na tarefa.
    registrar({ agent_type: 'Explore', last_assistant_message: 'VEREDITO: APROVADO Tarefa: tasks/prd-exemplo/9_task.md' }, raiz)

    const registradas = lerRevisoes(readFileSync(join(raiz, 'tasks/prd-exemplo/9_task.md'), 'utf8'))
    expect(registradas.map((revisao) => `${revisao.revisor} ${revisao.veredito} ${revisao.inicio}`)).toEqual([
      'infra-guardian APROVADO 2026-09-13 10:00:00',
      'tenancy-guardian REPROVADO 2026-09-13 10:00:00',
      'privacy-guardian APROVADO 2026-09-13 10:00:00',
      'conformidade-reviewer APROVADO 2026-09-13 10:00:00',
      'test-engineer APROVADO 2026-09-13 10:00:00',
      'revisor-geral APROVADO 2026-09-13 10:00:00',
    ])
    expect(portao(commit, raiz)).toMatch(/tenancy-guardian: a última rodada/)
    // Só a rodada que reprovou vai para os achados, com o que o revisor exigiu.
    const achados = readFileSync(join(raiz, 'tasks/prd-exemplo/achados/9_task.md'), 'utf8')
    expect(achados).toMatch(/## tenancy-guardian · 1ª rodada · REPROVADO · 2026-09-13 10:05:00 · `tasks\/prd-exemplo\/9_task.md`/)
    expect(achados).toMatch(/sem escopo de escola/)
    expect(achados).not.toMatch(/infra-guardian/)

    // Corrige às 10:10 e só o tenancy revisa de novo: infra e test-engineer viram código antigo.
    corrigir(raiz, 'apps/codigo.ts', '2026-09-13T10:10:00', 'export const corrigido = true\n')
    registrar(
      { agent_type: 'tenancy-guardian', agent_transcript_path: transcript(raiz, 'tenancy-2', '2026-09-13T10:11:00'), last_assistant_message: 'VEREDITO: APROVADO' },
      raiz,
      new Date('2026-09-13T10:15:00'),
    )
    const motivo = portao(commit, raiz)
    expect(motivo).toMatch(/infra-guardian: apps\/codigo.ts mudou/)
    expect(motivo).toMatch(/privacy-guardian: apps\/codigo.ts mudou/)
    expect(motivo).toMatch(/conformidade-reviewer: apps\/codigo.ts mudou/)
    expect(motivo).toMatch(/test-engineer: apps\/codigo.ts mudou/)
    expect(motivo).toMatch(/revisor-geral: apps\/codigo.ts mudou/)
    expect(motivo).not.toMatch(/tenancy-guardian/)

    for (const revisor of ['infra-guardian', 'privacy-guardian', 'conformidade-reviewer', 'test-engineer', 'revisor-geral']) {
      registrar(
        { agent_type: revisor, agent_transcript_path: transcript(raiz, `${revisor}-2`, '2026-09-13T10:12:00'), last_assistant_message: 'VEREDITO: APROVADO' },
        raiz,
        new Date('2026-09-13T10:16:00'),
      )
    }
    expect(portao(commit, raiz)).toMatch(/portão local: nunca passou/)
    gravarCarimbo(raiz, { inicio: new Date('2026-09-13T10:11:00').toISOString(), suites: ['typecheck', 'lint', 'segredo', 'dependencias', 'test', 'infra'] })
    expect(portao(commit, raiz)).toBeNull()
    // A conferência a mais de quem chama (a das mutações) segura o commit que os revisores e o carimbo liberariam, e
    // recebe o carimbo, o documento e o conteúdo dele.
    const vista: unknown[] = []
    const comConferencia = portao(commit, raiz, undefined, (carimbo, documento, conteudo) => {
      vista.push(carimbo?.suites.length, documento, conteudo.includes('Subagentes obrigatórios'))
      return 'portão local: as mutações não foram conferidas'
    })
    expect(comConferencia).toMatch(/^Commit bloqueado: revisões de tasks\/prd-exemplo\/9_task\.md incompletas\.\n- portão local: as mutações não foram conferidas$/)
    expect(vista).toEqual([6, 'tasks/prd-exemplo/9_task.md', true])
  })

  it('o commit com código de produto sem bloco de mutação nem a linha "Sem mutação" é recusado, e o carimbo tem de ser deste documento (RF17)', () => {
    const raiz = repositorio()
    const documento = 'tasks/prd-exemplo/9_task.md'
    const commit = { tool_input: { command: COMMIT_DA_TAREFA } }
    mkdirSync(join(raiz, 'apps/api/src'), { recursive: true })
    writeFileSync(join(raiz, 'apps/api/src/pedidos.ts'), 'export const a = 1\n')
    tocar(raiz, 'apps/api/src/pedidos.ts', '2026-09-13T09:00:00')
    tocar(raiz, 'apps/codigo.ts', '2026-09-13T09:00:00')
    for (const revisor of ['infra-guardian', 'tenancy-guardian', 'privacy-guardian', 'conformidade-reviewer', 'test-engineer', 'revisor-geral']) {
      registrar(
        { agent_type: revisor, agent_transcript_path: transcript(raiz, revisor, '2026-09-13T10:00:00'), last_assistant_message: 'VEREDITO: APROVADO' },
        raiz,
        new Date('2026-09-13T10:05:00'),
      )
    }
    const suites = ['typecheck', 'lint', 'segredo', 'dependencias', 'test', 'infra']
    const inicio = new Date('2026-09-13T10:06:00').toISOString()
    gravarCarimbo(raiz, { inicio, suites, documento })
    // Os revisores e o carimbo liberariam; a conferência das mutações é quem segura, e vê a produção da árvore.
    const alterados: string[][] = []
    expect(portao(commit, raiz, undefined, (_carimbo, _documento, _conteudo, arquivos) => (alterados.push(arquivos), null))).toBeNull()
    expect(alterados[0]).toEqual(expect.arrayContaining(['apps/api/src/pedidos.ts', 'apps/codigo.ts']))
    expect(portao(commit, raiz, undefined, avaliarMutacoes)).toMatch(/^Commit bloqueado: revisões de tasks\/prd-exemplo\/9_task\.md incompletas\.\n- portão local: a árvore altera código de produto \(apps\/api\/src\/pedidos\.ts\)/)
    // A linha com motivo atende, com o carimbo deste documento.
    writeFileSync(join(raiz, documento), `${readFileSync(join(raiz, documento), 'utf8')}\n**Sem mutação:** só o valor de uma constante\n`)
    expect(portao(commit, raiz, undefined, avaliarMutacoes)).toBeNull()
    // O mesmo carimbo de outro portão, ou de um portão sem documento, não serve.
    gravarCarimbo(raiz, { inicio, suites, documento: 'tasks/prd-exemplo/8_task.md' })
    expect(portao(commit, raiz, undefined, avaliarMutacoes)).toMatch(/o último portão não foi o de tasks\/prd-exemplo\/9_task\.md/)
    gravarCarimbo(raiz, { inicio, suites })
    expect(portao(commit, raiz, undefined, avaliarMutacoes)).toMatch(/o último portão não foi o de tasks\/prd-exemplo\/9_task\.md/)
    // Sem produção na árvore, nada é cobrado: o código fora de src fica como estava.
    rmSync(join(raiz, 'apps/api'), { recursive: true })
    expect(portao(commit, raiz, undefined, avaliarMutacoes)).toBeNull()
  })

  it('o hook, no repositório de verdade, deixa passar o arquivo mutado e restaurado, e barra o editado durante o portão', () => {
    // É o caminho que roda de verdade: `portao()`, com os instantâneos em disco. O caso de unidade prova o repasse
    // dentro do `avaliarPortao`; este prova que a fiação do hook o alcança. Sem ele, tirar o repasse — exatamente a
    // linha que causou a correção 2026-09-22-hook-do-commit-ignora-o-instantaneo-de-conteudo — não deixa nada vermelho.
    const raiz = repositorio()
    const commit = { tool_input: { command: COMMIT_DA_TAREFA } }
    corrigir(raiz, 'apps/codigo.ts', '2026-09-13T09:00:00', 'export const original = true\n')
    for (const revisor of ['infra-guardian', 'tenancy-guardian', 'privacy-guardian', 'conformidade-reviewer', 'test-engineer', 'revisor-geral']) {
      registrar(
        { agent_type: revisor, agent_transcript_path: transcript(raiz, revisor, '2026-09-13T10:00:00'), last_assistant_message: 'VEREDITO: APROVADO' },
        raiz,
        new Date('2026-09-13T10:05:00'),
      )
    }
    gravarCarimbo(raiz, { inicio: new Date('2026-09-13T10:06:00').toISOString(), suites: ['typecheck', 'lint', 'segredo', 'dependencias', 'test', 'infra'] })
    gravarInstantaneo(raiz, CHAVE_DO_PORTAO, alteracoesDeCodigo(raiz, arquivosAlterados(raiz)))
    expect(portao(commit, raiz)).toBeNull()

    // O revisor prova a guarda mutando e restaurando: o mtime anda muito depois de tudo, o conteúdo volta ao mesmo.
    corrigir(raiz, 'apps/codigo.ts', '2026-09-13T11:00:00', 'export const original = true\n')
    expect(portao(commit, raiz)).toBeNull()

    // E o conteúdo que nenhuma suíte rodou continua barrado, nas rodadas e no carimbo.
    corrigir(raiz, 'apps/codigo.ts', '2026-09-13T11:10:00', 'export const editado_durante = true\n')
    const motivo = portao(commit, raiz)
    expect(motivo).toMatch(/infra-guardian: apps\/codigo.ts mudou/)
    expect(motivo).toMatch(/portão local: apps\/codigo.ts mudou/)
  })

  it('o portão recusa o carimbo quando o código muda enquanto ele roda, e carimba o conteúdo do início', () => {
    // A classe oposta à do mtime: antes invalidava sem motivo, e o instantâneo gravado no fim validava sem prova.
    // Editar com o portão rodando fazia o arquivo entrar no instantâneo como se as suítes o tivessem visto.
    const raiz = repositorio()
    corrigir(raiz, 'apps/codigo.ts', '2026-09-13T09:00:00', 'export const original = true\n')
    const noInicio = alteracoesDeCodigo(raiz, arquivosAlterados(raiz))
    const carimbo = { inicio: new Date('2026-09-13T10:00:00').toISOString(), suites: ['typecheck', 'lint', 'segredo', 'dependencias', 'test'] }

    corrigir(raiz, 'apps/codigo.ts', '2026-09-13T10:00:30', 'export const editado_no_meio = true\n')
    expect(carimbarSeNadaMudou(raiz, carimbo, noInicio)).toMatch(/apps\/codigo.ts mudou enquanto o portão rodava/)
    expect(lerCarimbo(raiz)).toBeNull()
    expect(lerInstantaneos(raiz)[CHAVE_DO_PORTAO]).toBeUndefined()

    // De volta ao conteúdo que as suítes rodaram, carimba — e o instantâneo é o do início, não o de agora.
    corrigir(raiz, 'apps/codigo.ts', '2026-09-13T10:00:40', 'export const original = true\n')
    expect(carimbarSeNadaMudou(raiz, carimbo, noInicio)).toBeNull()
    expect(lerCarimbo(raiz)?.inicio).toBe(carimbo.inicio)
    expect(lerInstantaneos(raiz)[CHAVE_DO_PORTAO]).toEqual(instantaneoDe(noInicio))
  })

  /**
   * Uma árvore em que a tarefa 9.0 altera o documento e acrescenta produção com um `if`, pronta para o portão da tarefa rodar
   * como processo. A base já tem outro documento de tarefa, com bloco, que a tarefa não altera.
   */
  function arvoreDoPortaoDaTarefa() {
    const script = join(import.meta.dirname, 'portao-local.ts')
    const documento = 'tasks/prd-exemplo/9_task.md'
    const raiz = repositorio()
    const git = (...args: string[]) => execFileSync('git', args, { cwd: raiz, stdio: 'pipe' })
    // Cada suíte do portão da tarefa deixa uma marca: o vermelho do documento tem de vir antes de todas elas.
    const scripts = Object.fromEntries(['typecheck', 'lint', 'guarda:segredo', 'guarda:dependencias', 'test:unidade', 'test', 'test:e2e', 'test:infra'].map((nome) => [nome, 'touch suite-rodou']))
    writeFileSync(join(raiz, 'package.json'), JSON.stringify({ scripts }))
    writeFileSync(join(raiz, 'package-lock.json'), '{}\n')
    mkdirSync(join(raiz, 'node_modules'), { recursive: true })
    writeFileSync(join(raiz, 'node_modules/.package-lock.json'), '{}\n')
    writeFileSync(join(raiz, '.gitignore'), 'node_modules/\nsuite-rodou\n')
    const blocoDaBase = ['```mutacao', 'arquivo: apps/api/src/pedidos.ts', 'teste: tools/processo/mutacoes.test.ts', '- export const f', '+ export const g', '```'].join('\n')
    writeFileSync(join(raiz, 'tasks/prd-exemplo/7_task.md'), `# Tarefa 7.0\n\n${blocoDaBase}\n`)
    git('config', 'user.email', 'teste@exemplo.com')
    git('config', 'user.name', 'Teste')
    git('add', '-A')
    git('commit', '-q', '-m', 'base')
    // A tarefa altera o documento e acrescenta produção com um `if`.
    writeFileSync(join(raiz, documento), `${readFileSync(join(raiz, documento), 'utf8')}\n## Mutações\n\nNenhuma.\n`)
    mkdirSync(join(raiz, 'apps/api/src'), { recursive: true })
    writeFileSync(join(raiz, 'apps/api/src/pedidos.ts'), 'export const f = (x: number) => { if (x) return 1 }\n')
    const fila = join(mkdtempSync(join(tmpdir(), 'fila-')), 'carga.lock')
    const ambiente = { ...process.env, CLAUDE_PROJECT_DIR: raiz, EDUCA_FILA_DE_CARGA: fila }
    const portaoDaTarefa = (...argumentos: string[]) => spawnSync('node', [script, '--tarefa', ...argumentos], { env: ambiente, encoding: 'utf8' })
    const subcomando = (nome: 'conferir' | 'revisores') => spawnSync('node', [script, nome, documento], { env: ambiente, encoding: 'utf8' })
    const semLinha = readFileSync(join(raiz, documento), 'utf8')
    const comLinha = `${semLinha}\n**Sem mutação:** o valor padrão de uma constante\n`
    return { script, documento, raiz, ambiente, portaoDaTarefa, subcomando, semLinha, comLinha }
  }

  it('o portão da tarefa, rodado como processo, fica vermelho com produção sem bloco nem linha antes de qualquer suíte, e acha o documento pela alteração (RF17)', () => {
    const { script, documento, raiz, ambiente, portaoDaTarefa, comLinha } = arvoreDoPortaoDaTarefa()

    const sem = portaoDaTarefa()
    expect(sem.status).toBe(1)
    expect(sem.stdout).toMatch(/portão local vermelho: a árvore altera código de produto \(apps\/api\/src\/pedidos\.ts\) e no documento não há bloco de mutação nem a linha/)
    expect(existsSync(join(raiz, 'suite-rodou'))).toBe(false)
    expect(lerCarimbo(raiz)).toBeNull()

    // Com a linha e o motivo, passa, e o carimbo diz de que documento é. A lista das linhas sem bloco aparece antes das suítes.
    // O outro documento da base, com bloco e não alterado (7_task.md), não é tomado pelo da tarefa.
    writeFileSync(join(raiz, documento), comLinha)
    const com = portaoDaTarefa()
    expect(com.status).toBe(0)
    expect(com.stdout).not.toMatch(/nenhum documento de tarefa achado/)
    expect(com.stdout).toMatch(/Linhas novas de produção com condição que nenhum bloco de tasks\/prd-exemplo\/9_task\.md alcança \(1\):\n {2}apps\/api\/src\/pedidos\.ts:1 {2}\[if\]/)
    expect(existsSync(join(raiz, 'suite-rodou'))).toBe(true)
    expect(lerCarimbo(raiz)).toMatchObject({ documento })
    expect(lerCarimbo(raiz)?.mutacoes).toBeUndefined()

    // Outro documento alterado, este com bloco: sem dizer qual, o portão não escolhe por ter bloco, e pede o documento.
    const bloco = ['```mutacao', 'arquivo: apps/api/src/pedidos.ts', 'teste: tools/processo/mutacoes.test.ts', '- export const f', '+ export const g', '```'].join('\n')
    writeFileSync(join(raiz, 'tasks/prd-exemplo/8_task.md'), `# Tarefa 8.0\n\n${bloco}\n`)
    const ambiguo = portaoDaTarefa()
    expect(ambiguo.status).toBe(1)
    expect(ambiguo.stdout).toMatch(/nenhum documento de tarefa achado \(ou mais de um alterado\)/)
    expect(ambiguo.stdout).toMatch(/não achei o documento da tarefa entre os alterados/)
    expect(portaoDaTarefa(documento).status).toBe(0)

    // O portão completo não é o da tarefa: não procura documento nem cobra mutação, ainda que a árvore tenha produção.
    const completo = spawnSync('node', [script, '--e2e', '--infra'], { env: ambiente, encoding: 'utf8' })
    expect(completo.status).toBe(0)
    expect(completo.stdout).not.toMatch(/nenhum documento de tarefa achado|portão local vermelho/)
    // Cinco processos do portão em série: com a máquina carregada passam dos 5 s do padrão.
  }, 30_000)

  it('o portão da tarefa, rodado como processo, fica vermelho quando as mutações do documento não passam, e não grava carimbo (M5 da retro da X7)', () => {
    const { documento, raiz, portaoDaTarefa, semLinha } = arvoreDoPortaoDaTarefa()
    // Um bloco cujo teste não existe é recusado sem rodar nada (nem o `npx`): a mutação não prova a cláusula, e o portão tem de reprovar.
    const bloco = ['```mutacao', 'arquivo: apps/api/src/pedidos.ts', 'teste: tools/processo/nao-existe.test.ts', '- export const f', '+ export const g', '```'].join('\n')
    writeFileSync(join(raiz, documento), `${semLinha}\n## Mutações\n\n${bloco}\n`)

    const vermelho = portaoDaTarefa(documento)
    expect(vermelho.status).toBe(1)
    expect(vermelho.stdout).toContain('▶ mutações de tasks/prd-exemplo/9_task.md (1)')
    expect(vermelho.stdout).toMatch(/✗ portão local vermelho nas mutações de tasks\/prd-exemplo\/9_task\.md: 1 de 1 mutações não deixaram o teste vermelho ou foram recusadas\. Nenhum carimbo gravado\./)
    // As suítes rodaram antes (as mutações vêm depois delas), e mesmo assim nada foi carimbado.
    expect(existsSync(join(raiz, 'suite-rodou'))).toBe(true)
    expect(lerCarimbo(raiz)).toBeNull()
    // E o arquivo de produção voltou ao que era.
    expect(readFileSync(join(raiz, 'apps/api/src/pedidos.ts'), 'utf8')).toBe('export const f = (x: number) => { if (x) return 1 }\n')
    // Bloco malformado é o outro vermelho do mesmo ramo: o motivo vem do leitor, sem rodar nada.
    const semTeste = ['```mutacao', 'arquivo: apps/api/src/pedidos.ts', '- export const f', '```'].join('\n')
    writeFileSync(join(raiz, documento), `${semLinha}\n## Mutações\n\n${bloco}\n\n${semTeste}\n`)
    const malformado = portaoDaTarefa(documento)
    expect(malformado.status).toBe(1)
    expect(malformado.stdout).toMatch(/✗ portão local vermelho nas mutações de tasks\/prd-exemplo\/9_task\.md: mutação 2: falta a linha "teste:"\. Nenhum carimbo gravado\./)
    expect(lerCarimbo(raiz)).toBeNull()
  }, 30_000)

  it('o conferir e o revisores veem a produção sem bloco como o hook vê, e o documento pedido por outro caminho é o mesmo (RF17)', () => {
    const { documento, raiz, portaoDaTarefa, subcomando, semLinha, comLinha } = arvoreDoPortaoDaTarefa()

    // Com a linha e o portão verde, os dois dizem que não há pendência de mutação.
    writeFileSync(join(raiz, documento), comLinha)
    expect(portaoDaTarefa().status).toBe(0)
    expect(subcomando('conferir').status).toBe(0)
    expect(subcomando('revisores').stdout).not.toMatch(/código de produto/)
    // Tirada a linha, o carimbo continua válido para o código, mas o documento já não atende o RF17: o que a Mesa e quem
    // implementa consultam tem de coincidir com o que o hook recusa.
    writeFileSync(join(raiz, documento), semLinha)
    const conferir = subcomando('conferir')
    expect(conferir.status).toBe(1)
    expect(conferir.stdout).toMatch(/a árvore altera código de produto \(apps\/api\/src\/pedidos\.ts\)/)
    const revisores = subcomando('revisores')
    expect(revisores.status).toBe(1)
    expect(revisores.stdout).toMatch(/a árvore altera código de produto \(apps\/api\/src\/pedidos\.ts\)/)

    // `./tasks/…` e o caminho absoluto são o documento da tarefa, e o carimbo o guarda como o hook o compara no commit.
    // Com outro documento de tarefa alterado, só o pedido acha o da tarefa: sem ele, o portão pede o documento.
    writeFileSync(join(raiz, documento), comLinha)
    writeFileSync(join(raiz, 'tasks/prd-exemplo/8_task.md'), '# Tarefa 8.0\n')
    for (const pedido of [`./${documento}`, join(raiz, documento)]) {
      expect(portaoDaTarefa(pedido).status).toBe(0)
      expect(lerCarimbo(raiz)).toMatchObject({ documento })
    }
  }, 60_000)

  it('o portão da tarefa e o subcomando revisores imprimem a lista unida: os marcados mais os que o caminho alterado pede (RF15)', () => {
    const { documento, raiz, portaoDaTarefa, subcomando, comLinha } = arvoreDoPortaoDaTarefa()
    // O documento do fixture marca `infra-guardian`, `tenancy-guardian` e `test-engineer`; produção em apps/ pede também os outros dois guardiões.
    const lista = 'Revisores obrigatórios: infra-guardian, tenancy-guardian, test-engineer, revisor-geral, privacy-guardian, conformidade-reviewer'
    writeFileSync(join(raiz, documento), comLinha)
    const portao = portaoDaTarefa()
    expect(portao.status).toBe(0)
    expect(portao.stdout).toContain(`▶ ${lista}\n`)
    const revisores = subcomando('revisores')
    expect(revisores.stdout.split('\n')[0]).toBe(lista)
    // E é a lista que o subcomando cobra: sem rodada nenhuma, todos os seis faltam, os dois que só o caminho pede inclusive.
    expect(revisores.stdout).toContain('- privacy-guardian: nenhuma rodada registrada')
    expect(revisores.stdout).toContain('- conformidade-reviewer: nenhuma rodada registrada')
    // Sem código alterado, a lista volta a ser a do documento.
    rmSync(join(raiz, 'apps/api/src/pedidos.ts'))
    expect(subcomando('revisores').stdout.split('\n')[0]).toBe('Revisores obrigatórios: infra-guardian, tenancy-guardian, test-engineer, revisor-geral')
  }, 60_000)

  it('o portão local, rodado como processo, não carimba o que a suíte editou no meio da corrida', () => {
    // O caso acima prova a decisão; este prova **onde** o conteúdo é lido. Mover a leitura do início para o fim
    // mantinha tudo verde e trazia o defeito inteiro de volta (`test-engineer`, 2ª rodada). O portão do fixture roda
    // em menos de um segundo: quem decide as suítes é o package.json que o script recebe.
    const script = join(import.meta.dirname, 'portao-local.ts')

    // Só a suíte `test` recebe EDUCA_BANCO_NOVO=1 (banco limpo, como a esteira); as outras, nem herdada. O portão roda
    // aqui com a variável herdada, como o próprio `npm run test` desta suíte roda quando é o portão que o chama. O e2e e
    // o infra são o motivo da regra: com a variável, o `globalSetup` do infra derrubaria o ambiente que o e2e deixou.
    const comSuiteDeTeste = (comandoDoTeste: string, flags: string[] = []) => {
      const raiz = repositorio()
      const semBancoNovo = 'test -z "$EDUCA_BANCO_NOVO"'
      const scripts = {
        typecheck: semBancoNovo,
        lint: semBancoNovo,
        'guarda:segredo': semBancoNovo,
        'guarda:dependencias': semBancoNovo,
        test: `test "$EDUCA_BANCO_NOVO" = 1 && ${comandoDoTeste}`,
        'test:e2e': semBancoNovo,
        'test:infra': semBancoNovo,
      }
      writeFileSync(join(raiz, 'package.json'), JSON.stringify({ scripts }))
      // O portão só pula o `npm ci` com o lock do node_modules presente e não mais velho que o da raiz.
      writeFileSync(join(raiz, 'package-lock.json'), '{}\n')
      mkdirSync(join(raiz, 'node_modules'), { recursive: true })
      writeFileSync(join(raiz, 'node_modules/.package-lock.json'), '{}\n')
      // Sem isto, `node_modules` entra no instantâneo do início: no dia em que o npm escrever lá durante a corrida,
      // o controle negativo viraria recusa e o vermelho pareceria do produto (`test-engineer`).
      writeFileSync(join(raiz, '.gitignore'), 'node_modules/\n')
      const noInicio = instantaneoDe(alteracoesDeCodigo(raiz, arquivosAlterados(raiz)))
      // A fila de carga é de um arquivo à parte, fora da raiz (que o portão lê como código): o teste não pode ficar preso à
      // trava de verdade da máquina quando outra linha está no portão ou no e2e (`tools/ci/fila-de-carga.ts`).
      const fila = join(mkdtempSync(join(tmpdir(), 'fila-')), 'carga.lock')
      const saida = spawnSync('node', [script, ...flags], { env: { ...process.env, CLAUDE_PROJECT_DIR: raiz, EDUCA_BANCO_NOVO: '1', EDUCA_FILA_DE_CARGA: fila }, encoding: 'utf8' })
      return { raiz, noInicio, saida }
    }

    // A suíte edita o código enquanto roda: não há o que carimbar, e nada do `.processo` é escrito.
    const editou = comSuiteDeTeste("printf 'export const editado_pela_suite = true\\n' > apps/codigo.ts")
    expect(editou.saida.status).not.toBe(0)
    expect(editou.saida.stdout).toMatch(/apps\/codigo.ts mudou enquanto o portão rodava/)
    expect(lerCarimbo(editou.raiz)).toBeNull()
    expect(lerInstantaneos(editou.raiz)[CHAVE_DO_PORTAO]).toBeUndefined()

    // Sem edição, carimba — e o instantâneo é o conteúdo que as suítes rodaram.
    const limpo = comSuiteDeTeste('true')
    expect(limpo.saida.status).toBe(0)
    expect(lerCarimbo(limpo.raiz)?.suites).toEqual(['typecheck', 'lint', 'segredo', 'dependencias', 'test'])
    expect(lerInstantaneos(limpo.raiz)[CHAVE_DO_PORTAO]).toEqual(limpo.noInicio)

    // O `conferir` que o revisor-geral roda não tem a exceção de comentário: comentário muda lint e teste que varre o
    // fonte, e o carimbo só vale para o que as suítes viram.
    mkdirSync(join(limpo.raiz, 'tasks/correcoes'), { recursive: true })
    writeFileSync(join(limpo.raiz, 'tasks/correcoes/2026-09-25-x.md'), '# Correção\n\n**Subagentes obrigatórios:** `test-engineer`\n')
    const conferir = () => spawnSync('node', [script, 'conferir', 'tasks/correcoes/2026-09-25-x.md'], { env: { ...process.env, CLAUDE_PROJECT_DIR: limpo.raiz }, encoding: 'utf8' })
    expect(conferir().status).toBe(0)
    writeFileSync(join(limpo.raiz, 'apps/codigo.ts'), '// comentário novo, e só ele\nexport const a = 1\n')
    const soComentario = conferir()
    expect(soComentario.status).toBe(1)
    expect(soComentario.stdout).toMatch(/apps\/codigo.ts mudou em/)

    // Com --e2e e --infra, a variável herdada não chega a nenhuma das duas.
    const completo = comSuiteDeTeste('true', ['--e2e', '--infra'])
    expect(completo.saida.status).toBe(0)
    expect(lerCarimbo(completo.raiz)?.suites).toEqual(['typecheck', 'lint', 'segredo', 'dependencias', 'test', 'e2e', 'infra'])
  }, 60_000)

  it('correção passa pelo mesmo portão, com o documento em tasks/correcoes', () => {
    const raiz = repositorio()
    tocar(raiz, 'apps/codigo.ts', '2026-09-13T09:00:00')
    const commit = { tool_input: { command: 'git add apps/codigo.ts && git commit -m "Corrige x (correção 2026-09-13-x)\n\nRevisões: ok"' } }
    expect(portao(commit, raiz)).toMatch(/não tem tasks\/correcoes\/2026-09-13-x.md/)

    mkdirSync(join(raiz, 'tasks/correcoes'), { recursive: true })
    writeFileSync(join(raiz, 'tasks/correcoes/2026-09-13-x.md'), '# Correção\n\n**Subagentes obrigatórios:** `tenancy-guardian`\n')
    expect(portao(commit, raiz)).toMatch(/tenancy-guardian: nenhuma rodada[\s\S]*test-engineer: nenhuma rodada/)
    expect(portao(commit, raiz)).not.toMatch(/revisor-geral/)
  })

  it('bloqueia commit que leva código sem tarefa nem correção, e deixa passar o que não é código', () => {
    const raiz = repositorio()
    writeFileSync(join(raiz, 'docs.md'), 'texto\n')
    expect(portao({ tool_input: { command: 'git add apps/codigo.ts && git commit -m "Ajusta x"' } }, raiz)).toMatch(/leva código \(apps\/codigo.ts\)/)
    expect(portao({ tool_input: { command: 'git add -A && git commit -m "Ajusta x"' } }, raiz)).toMatch(/leva código/)
    expect(portao({ tool_input: { command: 'git add docs.md && git commit -m "Ajusta o texto"' } }, raiz)).toBeNull()
    // Código sujo de outra tarefa na árvore não bloqueia o commit que não o leva.
    expect(portao({ tool_input: { command: 'git commit -m "Registra decisão D53"' } }, raiz)).toBeNull()
  })

  // O `(mvp: …)` (D77) saiu na 14.0 (RF18). Este é o único teste existente que mudou: os casos que aceitavam o commit marcado viraram este, que o recusa.
  describe('o marcador da fatia do MVP saiu (RF18)', () => {
    /** O repositório de fixture numa branch `mvp/…`, com o código salvo antes do portão. */
    function repositorioDaFatia(branch = 'mvp/apresentacao') {
      const raiz = repositorio()
      execFileSync('git', ['checkout', '-q', '-b', branch], { cwd: raiz, stdio: 'pipe' })
      tocar(raiz, 'apps/codigo.ts', '2026-09-13T09:00:00')
      return raiz
    }
    /** O portão local passou às 09:59:30 sobre o conteúdo de agora, com as três suítes que o caminho do MVP exigia. */
    const carimbar = (raiz: string) => {
      gravarCarimbo(raiz, { inicio: new Date('2026-09-13T09:59:30').toISOString(), suites: ['typecheck', 'lint', 'test'] })
      gravarInstantaneo(raiz, CHAVE_DO_PORTAO, alteracoesDeCodigo(raiz, arquivosAlterados(raiz)))
    }
    const commitCom = (mensagem: string) => ({ tool_input: { command: `git add apps/codigo.ts && git commit -m "${mensagem}"` } })
    const COMMIT_DO_MVP = commitCom('Cria os contratos do time (mvp: contratos do time)')
    const SEM_TAREFA = /^Commit bloqueado: ele leva código \(apps\/codigo\.ts\) sem "\(tarefa N\.0\)" nem "\(correção <slug>\)"\./

    it.each(['mvp/apresentacao', 'mvp/material', 'develop', 'spec/exemplo'])('em %s, "(mvp: algo)" com código e carimbo válido é código sem tarefa', (branch) => {
      const raiz = repositorioDaFatia(branch)
      carimbar(raiz)
      for (const papel of ['', 'implementador']) {
        const bloqueio = portao(COMMIT_DO_MVP, raiz, papel)
        expect(bloqueio).toMatch(SEM_TAREFA)
        // A mensagem não ensina mais o caminho que saiu.
        expect(bloqueio).not.toMatch(/mvp|D77/i)
      }
    })

    it('o git hook decide igual: a decisão não tem caminho do MVP', () => {
      const raiz = repositorioDaFatia()
      carimbar(raiz)
      const decisao = decidirCommit({ mensagem: 'Cria os contratos do time (mvp: contratos do time)', arquivos: ['apps/codigo.ts'], conteudoDe: conteudoDoDisco(raiz), raiz, papel: 'implementador' })
      expect(decisao).toMatch(SEM_TAREFA)
    })

    it('o marcador ao lado da marca de tarefa não muda nada: os revisores da tarefa continuam exigidos', () => {
      const raiz = repositorioDaFatia()
      carimbar(raiz)
      const comando = COMMIT_DA_TAREFA.replace('(tarefa 9.0)', '(tarefa 9.0) (mvp: atalho)')
      expect(comando).toContain('(mvp: atalho)')
      expect(portao({ tool_input: { command: comando } }, raiz)).toMatch(/revisões de tasks\/prd-exemplo\/9_task.md incompletas[\s\S]*nenhuma rodada registrada/)
    })

    it('commit que não leva código passa com ou sem o marcador, sem portão', () => {
      const raiz = repositorioDaFatia()
      writeFileSync(join(raiz, 'docs.md'), 'texto\n')
      expect(portao({ tool_input: { command: 'git add docs.md && git commit -m "Atualiza o estado (mvp: estado)"' } }, raiz, '')).toBeNull()
      expect(portao({ tool_input: { command: 'git add docs.md && git commit -m "Atualiza o estado"' } }, raiz, '')).toBeNull()
    })
  })

  it('lê do comando os arquivos que o commit leva', () => {
    const alterados = ['apps/a.ts', 'apps/b/c.ts', '.claude/x.md', 'tools/y.ts']
    expect(arquivosDoCommit('git add .claude tools/y.ts && git commit -m "x"', '/r', alterados, [])).toEqual(['.claude/x.md', 'tools/y.ts'])
    expect(arquivosDoCommit('git add "apps/b/" && git commit -F- <<EOF', '/r', alterados, [])).toEqual(['apps/b/c.ts'])
    expect(arquivosDoCommit('git commit -am "x -a"', '/r', alterados, [])).toEqual(alterados)
    expect(arquivosDoCommit('git commit -m "use git commit -a"', '/r', alterados, ['tools/y.ts'])).toEqual(['tools/y.ts'])
    expect(arquivosDoCommit('git add /r/apps/a.ts && git commit -m x', '/r', alterados, [])).toEqual(['apps/a.ts'])
  })

  it('reconhece commit em posição de comando, não texto que só menciona commit', () => {
    expect(ehCommit('git commit -m "x (tarefa 9.0)"')).toBe(true)
    expect(ehCommit('git add a b && git commit -F- <<EOF')).toBe(true)
    expect(ehCommit('cd /repo; GIT_EDITOR=true git -C /repo commit')).toBe(true)
    expect(ehCommit('echo \'{"command":"git commit -m (tarefa 9.0)"}\' | node hook.ts')).toBe(false)
    expect(ehCommit('git log --grep "git commit"')).toBe(false)
  })

  it('não interfere em comando que não é commit de tarefa', () => {
    const raiz = repositorio()
    expect(portao({ tool_input: { command: 'npm run test' } }, raiz)).toBeNull()
    expect(portao({ tool_input: { command: 'git commit -m "Registra decisão D43"' } }, raiz)).toBeNull()
  })
})

describe('o que conta como alteração depois do portão e da rodada', () => {
  // As três correções vieram da retrospectiva do F1: 10 reprovações por carimbo, 6 delas sem nenhum
  // bloqueante de código, e 63 das 200 rodadas caducadas sem reprovação.

  const carimbo: Carimbo = { inicio: '2026-09-20T10:00:00.000Z', suites: ['typecheck', 'lint', 'segredo', 'dependencias', 'test'] }
  const exigidas = ['typecheck', 'lint', 'test']

  it('arquivo salvo no mesmo segundo, mas antes do início do portão, não invalida o carimbo', () => {
    // O caso real das tarefas 7.0 e 16.0: 39 ms antes do início, recusado porque a comparação
    // truncava para segundo inteiro. Duas rodadas de revisão gastas por arredondamento.
    const antes = [{ arquivo: 'apps/api/src/ops/command.ts', quando: Date.parse('2026-09-20T10:00:00.000Z') - 39, hash: 'a' }]
    expect(avaliarCarimbo(carimbo, exigidas, antes)).toBeNull()
    const depois = [{ arquivo: 'apps/api/src/ops/command.ts', quando: Date.parse('2026-09-20T10:00:00.000Z') + 1, hash: 'a' }]
    expect(avaliarCarimbo(carimbo, exigidas, depois)).toContain('mudou em')
  })

  it('arquivo que voltou ao mesmo conteúdo não invalida o carimbo nem a rodada', () => {
    // O revisor prova a guarda mutando o arquivo e restaurando. O mtime anda, o conteúdo não.
    const alteracao = { arquivo: '.github/workflows/ci.yml', quando: Date.parse('2026-09-20T11:00:00.000Z'), hash: 'mesmo-conteudo' }
    const alteracoes = [alteracao]
    const instantaneo = { '.github/workflows/ci.yml': 'mesmo-conteudo' }
    expect(avaliarCarimbo(carimbo, exigidas, alteracoes, instantaneo)).toBeNull()
    expect(alteracaoQueCaduca('test-engineer', '2026-09-20 07:00:00', alteracoes, instantaneo)).toBeNull()

    // E continua pegando a mudança de verdade.
    const outroConteudo = [{ ...alteracao, hash: 'conteudo-novo' }]
    expect(avaliarCarimbo(carimbo, exigidas, outroConteudo, instantaneo)).toContain('mudou em')
    expect(alteracaoQueCaduca('test-engineer', '2026-09-20 07:00:00', outroConteudo, instantaneo)?.arquivo).toBe('.github/workflows/ci.yml')
  })

  it('arquivo que o revisor não viu caduca a rodada, mesmo com instantâneo gravado', () => {
    // O `anterior === undefined` de `mudouDeVerdade` é o que garante isto: arquivo criado depois da rodada não está
    // no instantâneo dela, e não pode contar como inalterado só por não estar lá. Sem essa leitura, uma rodada
    // valeria para código que o revisor nunca abriu.
    const novo = { arquivo: 'apps/worker/src/novo.ts', quando: Date.parse('2026-09-20T11:00:00.000Z'), hash: 'conteudo-do-arquivo-novo' }
    const instantaneo = { 'apps/worker/src/antigo.ts': 'outro-conteudo' }
    expect(alteracaoQueCaduca('test-engineer', '2026-09-20 07:00:00', [novo], instantaneo)?.arquivo).toBe('apps/worker/src/novo.ts')
    expect(avaliarCarimbo(carimbo, exigidas, [novo], instantaneo)).toContain('mudou em')
  })

  it('arquivo editado enquanto o portão rodava não entra no instantâneo como provado', () => {
    // O instantâneo do portão é o conteúdo do início, que é o que as suítes rodaram. `arquivosQueMudaram` é o que o
    // `portao-local.ts` usa para recusar o carimbo quando alguém edita no meio da corrida.
    const noInicio = { 'apps/api/src/a.ts': 'hash-a', 'apps/api/src/b.ts': 'hash-b' }
    expect(arquivosQueMudaram(noInicio, { ...noInicio })).toEqual([])
    expect(arquivosQueMudaram(noInicio, { ...noInicio, 'apps/api/src/b.ts': 'hash-b-editado' })).toEqual(['apps/api/src/b.ts'])
    // Arquivo que entrou e arquivo que saiu no meio da corrida também contam.
    expect(arquivosQueMudaram(noInicio, { ...noInicio, 'apps/api/src/c.ts': 'hash-c' })).toEqual(['apps/api/src/c.ts'])
    expect(arquivosQueMudaram(noInicio, { 'apps/api/src/a.ts': 'hash-a' })).toEqual(['apps/api/src/b.ts'])
    expect(instantaneoDe([{ arquivo: 'apps/api/src/a.ts', quando: 1, hash: 'hash-a' }])).toEqual({ 'apps/api/src/a.ts': 'hash-a' })
  })

  it('o hook não caduca revisão nem carimbo por arquivo restaurado ao mesmo conteúdo', () => {
    // O caso acima prova a regra nos dois avaliadores. Este prova que ela chega ao `avaliarPortao`, que é o que o
    // hook do commit chama: os dois revisores desta casa provam a guarda mutando o arquivo e restaurando, e sem o
    // instantâneo o `mtime` sozinho bloqueava o commit para sempre, empurrando para a revisão sem mutação.
    const documento = 'tasks/correcoes/2026-09-22-exemplo.md'
    const arquivo = 'apps/worker/src/job-executor.ts'
    const depoisDaRodada = { arquivo, quando: lerHora('2026-09-13 10:30:00'), hash: 'mesmo-conteudo' }
    const aprovada = tarefaCom(rodada('infra-guardian', 'APROVADO', '2026-09-13 10:00:00', '2026-09-13 10:05:00'), rodada('test-engineer', 'APROVADO', '2026-09-13 10:00:00', '2026-09-13 10:06:00'))
    const comum = {
      obrigatorios: ['infra-guardian', 'test-engineer'],
      revisoes: lerRevisoes(aprovada),
      carimbo: carimboVerde,
      mensagemCommit: 'Corrige x (correção 2026-09-22-exemplo)\n\nRevisões: ...',
      documento,
    }
    const instantaneos = {
      [CHAVE_DO_PORTAO]: { [arquivo]: 'mesmo-conteudo' },
      [chaveDaRodada(documento, 'infra-guardian', 1)]: { [arquivo]: 'mesmo-conteudo' },
      [chaveDaRodada(documento, 'test-engineer', 1)]: { [arquivo]: 'mesmo-conteudo' },
    }
    expect(avaliarPortao({ ...comum, alteracoes: [depoisDaRodada], instantaneos }).bloqueios).toEqual([])
    // E continua pegando a mudança de verdade, nos três: as duas rodadas e o carimbo.
    const mudou = avaliarPortao({ ...comum, alteracoes: [{ ...depoisDaRodada, hash: 'conteudo-novo' }], instantaneos }).bloqueios
    expect(mudou).toHaveLength(3)
    for (const bloqueio of mudou) expect(bloqueio).toContain('mudou em')
  })

  it('documento que nenhuma suíte lê não é código; o runbook, que uma guarda lê, é', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'retro-'))
    for (const arquivo of ['TODO.md', 'docs/runbook.md', 'apps/api/src/x.ts']) {
      mkdirSync(join(raiz, dirname(arquivo)), { recursive: true })
      writeFileSync(join(raiz, arquivo), 'conteúdo')
    }
    const alteracoes = alteracoesDeCodigo(raiz, ['TODO.md', 'docs/runbook.md', 'apps/api/src/x.ts'])
    expect(alteracoes.map(({ arquivo }) => arquivo).sort()).toEqual(['apps/api/src/x.ts', 'docs/runbook.md'])
    expect(alteracoes.every(({ hash }) => hash.length === 64)).toBe(true)
  })
})

describe('mudança só de comentário', () => {
  // Retrospectiva da A0b: recomendação barata ficava sem aplicar porque "anularia as aprovações", inclusive o
  // comentário falso de `eu.ts` que quatro revisores apontaram. Só comentário não muda o que os guardiões aprovaram
  // nem o que as suítes provaram; o `revisor-geral` lê o comentário como parte da regra e continua caducando.
  const documento = 'tasks/prd-exemplo/9_task.md'
  const arquivo = 'apps/api/src/regra.ts'
  const obrigatorios = ['tenancy-guardian', 'privacy-guardian', 'test-engineer', 'revisor-geral']
  const ORIGINAL = [
    '/** Só a própria escola: o escopo vem do token. */',
    "const BASE = 'https://a.example/escola'",
    'export function podeVer(escolaId: string, alvo: string): boolean {',
    '  // @ts-expect-error o alvo pode faltar',
    '  const nada: number = alvo',
    '  return escolaId === alvo // e só ela',
    '}',
    'export const endereco = (id: string) => `${BASE}/${id}`',
    '',
  ].join('\n')

  /** O portão depois de trocar o conteúdo, com as rodadas e o carimbo gravados sobre o ORIGINAL pelo mesmo caminho do hook. */
  function bloqueiosDepoisDe(novo: string, semOPar = false): string[] {
    const raiz = mkdtempSync(join(tmpdir(), 'comentario-'))
    mkdirSync(join(raiz, dirname(arquivo)), { recursive: true })
    writeFileSync(join(raiz, arquivo), ORIGINAL)
    const revisoes = lerRevisoes(tarefaCom(...obrigatorios.map((revisor) => rodada(revisor, 'APROVADO', '2026-09-13 10:00:00', '2026-09-13 10:05:00'))))
    for (const chave of [CHAVE_DO_PORTAO, ...obrigatorios.map((revisor) => chaveDaRodada(documento, revisor, 1))]) {
      gravarInstantaneo(raiz, chave, alteracoesDeCodigo(raiz, [arquivo]))
    }
    const gravados = lerInstantaneos(raiz)
    const instantaneos = semOPar ? Object.fromEntries(Object.entries(gravados).filter(([chave]) => !chave.endsWith('|sem-comentarios'))) : gravados
    writeFileSync(join(raiz, arquivo), novo)
    const depois = new Date(lerHora('2026-09-13 10:30:00'))
    utimesSync(join(raiz, arquivo), depois, depois)
    return avaliarPortao({
      obrigatorios,
      revisoes,
      alteracoes: alteracoesDeCodigo(raiz, [arquivo]),
      carimbo: carimboVerde,
      mensagemCommit: 'Implementa x (tarefa 9.0)\n\nRevisões: ...',
      documento,
      instantaneos,
    }).bloqueios
  }

  const quem = (bloqueios: string[]) => bloqueios.map((bloqueio) => (bloqueio.startsWith('portão local') ? 'carimbo' : bloqueio.split(':')[0])).sort()
  const TODOS = ['carimbo', 'privacy-guardian', 'revisor-geral', 'tenancy-guardian', 'test-engineer']

  it('só comentário mudou: os guardiões e o test-engineer mantêm a rodada; o revisor-geral e o carimbo caducam', () => {
    const novo = ORIGINAL.replace('Só a própria escola: o escopo vem do token.', 'O escopo vem do token, nunca do cliente.')
      .replace('// e só ela', '// e nenhuma outra')
      .replace('export function', '\n// linha nova de comentário\nexport function')
    // O carimbo continua estrito: comentário muda lint (`no-irregular-whitespace`) e teste que varre o texto do fonte.
    expect(quem(bloqueiosDepoisDe(novo))).toEqual(['carimbo', 'revisor-geral'])
  })

  it('dois arquivos, um só com comentário e outro com código: tudo caduca', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'comentario-'))
    const outro = 'apps/api/src/outra.ts'
    for (const caminho of [arquivo, outro]) {
      mkdirSync(join(raiz, dirname(caminho)), { recursive: true })
      writeFileSync(join(raiz, caminho), ORIGINAL)
    }
    const revisoes = lerRevisoes(tarefaCom(...obrigatorios.map((revisor) => rodada(revisor, 'APROVADO', '2026-09-13 10:00:00', '2026-09-13 10:05:00'))))
    for (const revisor of obrigatorios) gravarInstantaneo(raiz, chaveDaRodada(documento, revisor, 1), alteracoesDeCodigo(raiz, [arquivo, outro]))
    writeFileSync(join(raiz, arquivo), ORIGINAL.replace('// e só ela', '// e nenhuma outra'))
    writeFileSync(join(raiz, outro), ORIGINAL.replace('escolaId === alvo', 'escolaId !== alvo'))
    // O de comentário depois do de código: é ele o mais recente, e mesmo assim o que caduca todos é o outro.
    utimesSync(join(raiz, outro), new Date(lerHora('2026-09-13 10:30:00')), new Date(lerHora('2026-09-13 10:30:00')))
    utimesSync(join(raiz, arquivo), new Date(lerHora('2026-09-13 10:31:00')), new Date(lerHora('2026-09-13 10:31:00')))
    const { bloqueios } = avaliarPortao({
      obrigatorios,
      revisoes,
      alteracoes: alteracoesDeCodigo(raiz, [arquivo, outro]),
      carimbo: null,
      mensagemCommit: 'Implementa x (tarefa 9.0)\n\nRevisões: ...',
      documento,
      instantaneos: lerInstantaneos(raiz),
    })
    const porRevisor = bloqueios.filter((bloqueio) => !bloqueio.startsWith('portão local'))
    expect(porRevisor).toHaveLength(obrigatorios.length)
    // Os guardiões caducam pelo arquivo de código; o revisor-geral, pelo mais recente, que é o de comentário.
    for (const bloqueio of porRevisor.filter((texto) => !texto.startsWith('revisor-geral'))) expect(bloqueio).toContain(outro)
  })

  it('código mudou: tudo caduca', () => {
    expect(quem(bloqueiosDepoisDe(ORIGINAL.replace('escolaId === alvo', 'escolaId !== alvo')))).toEqual(TODOS)
  })

  it('comentário com diretiva mudou, antes ou depois: tudo caduca', () => {
    expect(quem(bloqueiosDepoisDe(ORIGINAL.replace('o alvo pode faltar', 'o alvo nunca falta')))).toEqual(TODOS)
    // A diretiva que aparece num comentário comum, e a que some dele.
    expect(quem(bloqueiosDepoisDe(ORIGINAL.replace('// e só ela', '// eslint-disable-line')))).toEqual(TODOS)
    expect(quem(bloqueiosDepoisDe(ORIGINAL.replace('// @ts-expect-error o alvo pode faltar', '// o alvo pode faltar')))).toEqual(TODOS)
  })

  it('string com // mudou: tudo caduca', () => {
    expect(quem(bloqueiosDepoisDe(ORIGINAL.replace('https://a.example/escola', 'https://b.example/escola')))).toEqual(TODOS)
  })

  it('instantâneo gravado antes do par sem comentários: a leitura é a restrita, e tudo caduca', () => {
    expect(quem(bloqueiosDepoisDe(ORIGINAL.replace('// e só ela', '// e nenhuma outra'), true))).toEqual(TODOS)
  })

  describe('a impressão sem comentários', () => {
    const igual = (arquivoDoCaso: string, antes: string, depois: string) => {
      const a = impressaoSemComentarios(arquivoDoCaso, antes)
      expect(a).not.toBeNull()
      return a === impressaoSemComentarios(arquivoDoCaso, depois)
    }

    it('o docblock e o comentário dentro do JSX são comentário', () => {
      expect(igual('a.ts', '/** um */\nexport const a = 1\n', '/** outro */\nexport const a = 1\n')).toBe(true)
      expect(igual('a.tsx', 'export const A = () => <a>{/* um */}</a>\n', 'export const A = () => <a>{/* outro */}</a>\n')).toBe(true)
    })

    it('o // de expressão regular e o texto do JSX são código, espaço incluído', () => {
      expect(igual('a.ts', 'export const r = /[//]a/\n', 'export const r = /[//]b/\n')).toBe(false)
      expect(igual('a.tsx', 'export const A = () => <a>// um</a>\n', 'export const A = () => <a>// outro</a>\n')).toBe(false)
      expect(igual('a.tsx', 'export const A = () => <a> x</a>\n', 'export const A = () => <a>x</a>\n')).toBe(false)
    })

    it('a quebra de linha que muda a árvore conta, e o shebang é diretiva', () => {
      // `return\nx` devolve undefined: os tokens são os mesmos, a árvore não.
      expect(igual('a.ts', 'export function f(x: number) { return x }\n', 'export function f(x: number) { return\nx }\n')).toBe(false)
      expect(igual('a.ts', '#!/usr/bin/env node\nexport const a = 1\n', '#!/usr/bin/env -S node\nexport const a = 1\n')).toBe(false)
    })

    // Montado em partes: escrito por inteiro neste arquivo, o próprio Vitest leria a diretiva e trocaria o ambiente dele.
    const VITEST_ENVIRONMENT = ['@vitest', 'environment node'].join('-')
    // As cinco da retrospectiva, mais o comentário de configuração do ESLint e o ambiente do Vitest. Cada uma, sozinha,
    // num comentário comum que antes não tinha nada: tirar uma da lista deixa a sua linha vermelha.
    it.each(['@ts-ignore', '@ts-expect-error', 'eslint-disable-next-line', 'eslint no-console: off', '/// <reference types="vite/client" />', '@jsx h', '#!', VITEST_ENVIRONMENT])(
      'comentário que passa a ter %s conta como código',
      (diretiva) => {
        expect(igual('a.ts', '// um\nexport const a = 1\n', `// ${diretiva}\nexport const a = 1\n`)).toBe(false)
      },
    )

    it('.mts e .cts também são TypeScript', () => {
      expect(igual('a.mts', '// um\nexport const a = 1\n', '// outro\nexport const a = 1\n')).toBe(true)
      expect(igual('a.cts', '// um\nexport const a = 1\n', '// outro\nexport const a = 2\n')).toBe(false)
    })

    it('sem o compilador instalado (antes do npm ci), não se aplica', () => {
      // O mesmo módulo, copiado para fora do repositório: dali não há `node_modules` para achar o `typescript`.
      const pasta = mkdtempSync(join(tmpdir(), 'sem-typescript-'))
      writeFileSync(join(pasta, 'caducidade.ts'), readFileSync(join(import.meta.dirname, 'caducidade.ts')))
      const programa = "import { impressaoSemComentarios } from './caducidade.ts'\nconsole.log(String(impressaoSemComentarios('a.ts', 'export const a = 1\\n')))\n"
      writeFileSync(join(pasta, 'rodar.ts'), programa)
      const saida = spawnSync('node', ['rodar.ts'], { cwd: pasta, encoding: 'utf8' })
      expect(saida.stderr).toBe('')
      expect(saida.stdout.trim()).toBe('null')
    })

    it('não se aplica fora de .ts e .tsx, nem a arquivo com erro de sintaxe', () => {
      expect(impressaoSemComentarios('a.js', 'export const a = 1 // um\n')).toBeNull()
      expect(impressaoSemComentarios('a.ts', 'export const a = (\n')).toBeNull()
    })
  })
})

describe('alterações com um merge em curso', () => {
  // O conserto de um encontro de linhas: a linha traz a branch da spec, o merge para no conflito e o Implementador
  // resolve. O que a outra linha fez já passou pelo hook lá; o que o hook cobra aqui é o que divergiu dos dois lados.
  function duasLinhas() {
    const raiz = mkdtempSync(join(tmpdir(), 'merge-'))
    const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=teste', '-c', 'user.email=teste@exemplo.invalid', ...args], { cwd: raiz, stdio: 'pipe' })
    const escrever = (arquivo: string, conteudo: string) => {
      mkdirSync(dirname(join(raiz, arquivo)), { recursive: true })
      writeFileSync(join(raiz, arquivo), conteudo)
    }
    git('init', '-q', '-b', 'spec/exemplo')
    escrever('apps/registro.ts', 'a\nb\nc\nd\ne\nf\ng\n')
    escrever('apps/base.ts', 'base\n')
    git('add', '-A')
    git('commit', '-q', '-m', 'base')
    git('checkout', '-q', '-b', 'spec/exemplo--l2')
    escrever('apps/da-linha.ts', 'linha\n')
    escrever('apps/registro.ts', 'a\nb\nc\nd\ne\nf\ng da linha\n')
    escrever('apps/conflito.ts', 'linha\n')
    git('add', '-A')
    git('commit', '-q', '-m', 'tarefa da linha')
    git('checkout', '-q', 'spec/exemplo')
    escrever('apps/da-spec.ts', 'spec\n')
    escrever('apps/registro.ts', 'a da spec\nb\nc\nd\ne\nf\ng\n')
    escrever('apps/conflito.ts', 'spec\n')
    git('add', '-A')
    git('commit', '-q', '-m', 'tarefa da outra linha')
    git('checkout', '-q', 'spec/exemplo--l2')
    return { raiz, git, escrever }
  }

  it('o que veio igual do outro lado não conta; o conflito e o arquivo que os dois tocaram, sim', () => {
    const { raiz, git, escrever } = duasLinhas()
    expect(() => git('merge', '--no-edit', 'spec/exemplo')).toThrow()
    expect(arquivosAlterados(raiz).sort()).toEqual(['apps/conflito.ts', 'apps/registro.ts'])
    // Resolvido e no índice, continua sendo o que o commit do conserto leva de novo; e o arquivo criado no conserto entra.
    escrever('apps/conflito.ts', 'linha e spec\n')
    escrever('apps/novo-no-conserto.ts', 'novo\n')
    git('add', 'apps/conflito.ts')
    expect(arquivosAlterados(raiz).sort()).toEqual(['apps/conflito.ts', 'apps/novo-no-conserto.ts', 'apps/registro.ts'])
  })

  it('arquivo do outro lado editado no conserto volta a contar', () => {
    const { raiz, git, escrever } = duasLinhas()
    expect(() => git('merge', '--no-edit', 'spec/exemplo')).toThrow()
    escrever('apps/da-spec.ts', 'spec, mexido no conserto\n')
    expect(arquivosAlterados(raiz)).toContain('apps/da-spec.ts')
  })

  it('sem merge em curso, nada muda: o alterado é o alterado', () => {
    const { raiz, escrever } = duasLinhas()
    escrever('apps/base.ts', 'mexido\n')
    expect(arquivosAlterados(raiz)).toEqual(['apps/base.ts'])
  })
})

describe('achados separados por documento, com índice', () => {
  // O arquivo único da pasta chegou a 646 KB / 158 rodadas no F1, e o passo 2 do /executar-task
  // manda lê-lo antes de cada tarefa. Ou não era lido, ou consumia a janela antes de começar.

  function repositorio() {
    const raiz = mkdtempSync(join(tmpdir(), 'achados-'))
    execFileSync('git', ['init', '-q'], { cwd: raiz, stdio: 'pipe' })
    mkdirSync(join(raiz, 'tasks/prd-exemplo'), { recursive: true })
    return raiz
  }

  // Seis revisores distintos: o hook só registra agent_type que ele conhece.
  const REVISORES_DE_TESTE_PARALELO = ['test-engineer', 'revisor-geral', 'tenancy-guardian', 'privacy-guardian', 'infra-guardian', 'conformidade-reviewer']

  const linhasDoIndice = (indice: string) => indice.split('\n').filter((linha) => /^\| 20\d\d-/.test(linha))

  // Um item como os revisores escrevem de verdade: caminho absoluto da máquina, `|` no meio, e
  // muito mais que os 160 caracteres que cabem numa linha de índice.
  const ITEM_LONGO =
    '`/home/joaquim/Documentos/git/Educa.ia/apps/api/src/sessao/login.service.ts:88` — começo do parágrafo: ' +
    'a guarda aceita `falhou() || vencido()` sem distinguir os dois casos, e quem lê o log não sabe qual ' +
    'aconteceu. Isso atrapalha o diagnóstico da manhã de segunda, quando sessenta turmas entram juntas e ' +
    'o socorro precisa saber se a conta travou ou se a sessão venceu. fim do parágrafo'

  const pasta = mkdtempSync(join(tmpdir(), 'transcripts-achados-'))
  let sequencia = 0

  function rodada(raiz: string, documento: string, revisor: string, mensagem: string, fim: string) {
    const conteudo = join(raiz, documento)
    if (!existsSync(conteudo)) writeFileSync(conteudo, `# ${documento}\n\n**Subagentes obrigatórios:** \`${revisor}\`\n`)
    const caminhoTranscript = join(pasta, `t-${String(sequencia++)}.jsonl`)
    writeFileSync(caminhoTranscript, JSON.stringify({ type: 'user', timestamp: new Date(fim).toISOString(), message: { content: `Tarefa: ${documento}` } }))
    registrar({ agent_type: revisor, agent_id: 'a1', agent_transcript_path: caminhoTranscript, last_assistant_message: mensagem }, raiz, new Date(fim))
  }

  it('a rodada continua dos achados quando o documento é reescrito sem a seção', () => {
    const raiz = repositorio()
    const documento = 'tasks/prd-exemplo/6_task.md'
    rodada(raiz, documento, 'revisor-geral', 'VEREDITO: REPROVADO\n\nBloqueantes:\n- falta o caso das duas turmas', '2026-09-13T10:00:00')
    // O Implementador reescreve o documento inteiro (Write): a seção "Revisões" some.
    writeFileSync(join(raiz, documento), `# ${documento}\n\n**Subagentes obrigatórios:** \`revisor-geral\`\n`)
    rodada(raiz, documento, 'revisor-geral', 'VEREDITO: APROVADO\n\nBloqueantes: nenhum\nRecomendações: nenhuma', '2026-09-13T11:00:00')

    const revisoes = lerRevisoes(readFileSync(join(raiz, documento), 'utf8'))
    expect(revisoes.map((revisao) => [revisao.revisor, revisao.rodada, revisao.veredito])).toEqual([['revisor-geral', 2, 'APROVADO']])
  })

  it('guarda o achado no arquivo do documento, não num arquivo único da pasta', () => {
    const raiz = repositorio()
    rodada(
      raiz,
      'tasks/prd-exemplo/3_task.md',
      'tenancy-guardian',
      'VEREDITO: REPROVADO\n\nBloqueantes:\n- `apps/api/src/turma.repository.ts:40` — query sem escopo de escola',
      '2026-09-13T10:05:00',
    )
    rodada(
      raiz,
      'tasks/prd-exemplo/20_task.md',
      'test-engineer',
      'VEREDITO: APROVADO\n\nBloqueantes: nenhum\n\nRecomendações:\n- `apps/web/src/sessao.ts:12` — o vencimento não tem folga de relógio',
      '2026-09-14T11:00:00',
    )

    const daTres = readFileSync(join(raiz, 'tasks/prd-exemplo/achados/3_task.md'), 'utf8')
    const daVinte = readFileSync(join(raiz, 'tasks/prd-exemplo/achados/20_task.md'), 'utf8')
    expect(daTres).toMatch(/query sem escopo de escola/)
    expect(daTres).not.toMatch(/folga de relógio/)
    expect(daVinte).toMatch(/folga de relógio/)
    expect(daVinte).not.toMatch(/query sem escopo de escola/)
    // O arquivo único da pasta deixa de existir: quem o lesse leria as vinte tarefas de uma vez.
    expect(existsSync(join(raiz, 'tasks/prd-exemplo/achados-revisoes.md'))).toBe(false)
  })

  it('o índice resume o que o revisor exigiu e aponta o bloco', () => {
    const raiz = repositorio()
    rodada(
      raiz,
      'tasks/prd-exemplo/3_task.md',
      'tenancy-guardian',
      'VEREDITO: REPROVADO\n\nBloqueantes:\n- `apps/api/src/turma.repository.ts:40` — query sem escopo de escola',
      '2026-09-13T10:05:00',
    )
    // As formas que os revisores usam de verdade: negrito, título, "(não bloqueiam)", item abaixo.
    rodada(
      raiz,
      'tasks/prd-exemplo/20_task.md',
      'revisor-geral',
      'VEREDITO: APROVADO\n\n**Bloqueantes:** nenhum.\n\n## Recomendações (não bloqueiam)\n\n1. `apps/web/src/sessao.ts:12` — o vencimento não tem folga de relógio',
      '2026-09-14T11:00:00',
    )
    // Revisor que escreve um parágrafo, com `|` no meio e caminho absoluto da máquina.
    rodada(raiz, 'tasks/prd-exemplo/4_task.md', 'infra-guardian', `VEREDITO: REPROVADO\n\nBloqueantes:\n- ${ITEM_LONGO}`, '2026-09-15T09:00:00')

    const indice = readFileSync(join(raiz, 'tasks/prd-exemplo/achados/indice.md'), 'utf8')
    const linhas = linhasDoIndice(indice)
    expect(linhas).toHaveLength(3)
    expect(linhas[0]).toContain('`tenancy-guardian`')
    expect(linhas[0]).toContain('REPROVADO')
    expect(linhas[0]).toContain('3_task')
    expect(linhas[0]).toContain('query sem escopo de escola')
    expect(linhas[1]).toContain('o vencimento não tem folga de relógio')
    // "nenhum" não vira resumo: a linha teria de dizer o que fazer, e diria "nenhum".
    expect(linhas[1]).not.toMatch(/nenhum/)

    // O parágrafo é cortado: sem corte, uma rodada sozinha põe 400 caracteres no índice.
    const longa = linhas[2] ?? ''
    expect(longa).toContain('começo do parágrafo')
    expect(longa).not.toContain('fim do parágrafo')
    expect(longa).toMatch(/…/)
    // O caminho absoluto da máquina sai; o do repositório fica, que é o que serve para abrir.
    expect(longa).toContain('apps/api/src/sessao/login.service.ts:88')
    expect(longa).not.toContain('/home/')
    // `|` no texto do revisor não abre coluna nova: a linha tem as seis colunas da tabela.
    const colunas = longa.split(/(?<!\\)\|/)
    expect(colunas).toHaveLength(8)
    // E o resumo cabe no limite: sem o corte, esta célula sozinha teria 380+ caracteres.
    expect((colunas[6] ?? '').trim().length).toBeLessThanOrEqual(161)
    expect(ITEM_LONGO.length).toBeGreaterThan(350)

    // Pelo fim da rodada se acha o bloco inteiro no arquivo do documento.
    expect(readFileSync(join(raiz, 'tasks/prd-exemplo/achados/3_task.md'), 'utf8')).toContain('2026-09-13 10:05:00')
    expect(linhas[0]).toContain('2026-09-13 10:05:00')
  })

  it('"nenhuma" é resposta quando vem pontuada, e é conteúdo quando continua a frase', () => {
    // A fronteira decide se o achado existe. `Recomendações: nenhuma` descarta a rodada aprovada;
    // `nenhuma das três guardas cobre a virada` é exigência e precisa sobreviver. Sem a pontuação
    // separando as duas, o segundo caso some sem deixar rastro — era o defeito do `TODO.md`.
    const raiz = repositorio()
    rodada(
      raiz,
      'tasks/prd-exemplo/5_task.md',
      'test-engineer',
      'VEREDITO: APROVADO\n\nBloqueantes: nenhum\n\nRecomendações:\n- nenhuma das três guardas cobre a virada de ano letivo; acrescente a quarta',
      '2026-09-16T10:00:00',
    )
    rodada(raiz, 'tasks/prd-exemplo/6_task.md', 'test-engineer', 'VEREDITO: APROVADO\n\nBloqueantes: nenhum\n\nRecomendações: nenhuma', '2026-09-16T11:00:00')

    // O que exigiu virou bloco e linha de índice.
    expect(readFileSync(join(raiz, 'tasks/prd-exemplo/achados/5_task.md'), 'utf8')).toContain('nenhuma das três guardas cobre a virada')
    // O que não exigiu nada não virou nem arquivo.
    expect(existsSync(join(raiz, 'tasks/prd-exemplo/achados/6_task.md'))).toBe(false)

    const linhas = linhasDoIndice(readFileSync(join(raiz, 'tasks/prd-exemplo/achados/indice.md'), 'utf8'))
    expect(linhas).toHaveLength(1)
    expect(linhas[0]).toContain('acrescente a quarta')
  })

  it('o revisor que resume dentro de uma cerca: a declaração vale, e a cerca não vira resumo', () => {
    // Forma real, em 9 lugares de 5 documentos: o resumo do veredito fica dentro de ``` e a prosa
    // vem depois. Guardar usa só a declaração — quem escreveu "nenhum/nenhuma" não exigiu nada, e a
    // prosa seguinte é justificativa. Já o resumo do índice recua para a prosa, porque a rodada que
    // reprovou vai ser guardada de qualquer jeito e a célula não pode sair vazia nem com ```.
    const raiz = repositorio()
    const cercado = (veredito: string) =>
      `VEREDITO: ${veredito}\n\n\`\`\`\nAuditoria: não se aplica ao diff\nBloqueantes: nenhum\nRecomendações: nenhuma\n\`\`\`\n\n` +
      '## Sobre o `useRef` do segredo TOTP\n\nO ref pertence ao fiber do componente e vai com a tela quando ela desmonta.'

    rodada(raiz, 'tasks/prd-exemplo/7_task.md', 'privacy-guardian', cercado('APROVADO'), '2026-09-17T10:00:00')
    rodada(raiz, 'tasks/prd-exemplo/8_task.md', 'privacy-guardian', cercado('REPROVADO'), '2026-09-17T11:00:00')

    // Aprovada e sem exigência: não guarda, mesmo com prosa depois da cerca.
    expect(existsSync(join(raiz, 'tasks/prd-exemplo/achados/7_task.md'))).toBe(false)
    // Reprovada: guarda, e o resumo é a prosa — nunca a linha da cerca.
    const linhas = linhasDoIndice(readFileSync(join(raiz, 'tasks/prd-exemplo/achados/indice.md'), 'utf8'))
    expect(linhas).toHaveLength(1)
    expect(linhas[0]).toContain('8_task')
    expect(linhas[0]).toContain('pertence ao fiber do componente')
    expect(linhas[0]).not.toMatch(/```/)

    // E a cerca de fechamento logo abaixo do cabeçalho da seção também não vira resumo: é a forma
    // que pôs uma célula com ``` no índice real (`tasks/correcoes/achados/indice.md`).
    rodada(
      raiz,
      'tasks/prd-exemplo/9_task.md',
      'infra-guardian',
      'VEREDITO: REPROVADO\n\n```\nBloqueantes: nenhum\nRecomendações:\n```\n\nA fila de lote não tem limite de concorrência por escola, e uma escola atrasa a outra.',
      '2026-09-17T12:00:00',
    )
    const comCerca = linhasDoIndice(readFileSync(join(raiz, 'tasks/prd-exemplo/achados/indice.md'), 'utf8'))[1] ?? ''
    expect(comCerca).toContain('9_task')
    expect(comCerca).not.toMatch(/```/)
    expect(comCerca).toContain('não tem limite de concorrência por escola')
  })

  it('seção escrita e vazia não é declaração de que nada foi exigido', () => {
    // Forma real: `test-engineer · 2ª rodada · APROVADO · 2026-09-21 17:26:58`, que tem
    // `Recomendações:` como última linha dentro da cerca e R1 a R5 em prosa depois dela. Tratar a
    // seção vazia como "declarou nada" descarta o bloco inteiro — cinco recomendações sumiram assim
    // quando o filtro de cerca entrou sozinho.
    const raiz = repositorio()
    rodada(
      raiz,
      'tasks/prd-exemplo/11_task.md',
      'test-engineer',
      'VEREDITO: APROVADO\n\n```\nBloqueantes: nenhum. Os dois da rodada 1 estão fechados\nRecomendações:\n```\n\n' +
        '**R1 — as três mutações que sobreviveram**, e as três morrem com uma mudança só: afirmar o argv inteiro, não a presença.',
      '2026-09-18T10:00:00',
    )

    // Aprovada, mas a seção existe e o conteúdo está fora dela: guarda, com a prosa no resumo.
    expect(existsSync(join(raiz, 'tasks/prd-exemplo/achados/11_task.md'))).toBe(true)
    expect(readFileSync(join(raiz, 'tasks/prd-exemplo/achados/11_task.md'), 'utf8')).toContain('as três mutações que sobreviveram')
    const linhas = linhasDoIndice(readFileSync(join(raiz, 'tasks/prd-exemplo/achados/indice.md'), 'utf8'))
    expect(linhas).toHaveLength(1)
    expect(linhas[0]).toContain('as três mutações que sobreviveram')
    expect(linhas[0]).not.toMatch(/```/)
  })

  it('o bloqueante vence a recomendação, e o corte recua até a fronteira de palavra', () => {
    // A precedência decide o texto de 63 das 241 células reais do corpus: invertê-la troca o
    // bloqueante por uma recomendação em todas elas, que é o defeito que esta correção fecha.
    const raiz = repositorio()
    const PALAVRA = 'abcdefghij'
    const LONGO = `${PALAVRA} `.repeat(30).trim()
    rodada(
      raiz,
      'tasks/prd-exemplo/12_task.md',
      'infra-guardian',
      `VEREDITO: REPROVADO\n\nBloqueantes:\n- o bloqueante que tem de aparecer\n\nRecomendações:\n- a recomendação que não pode roubar a célula`,
      '2026-09-19T10:00:00',
    )
    rodada(raiz, 'tasks/prd-exemplo/13_task.md', 'infra-guardian', `VEREDITO: REPROVADO\n\nBloqueantes:\n- ${LONGO}`, '2026-09-19T11:00:00')

    const celula = (linha: string) => (linha.split(/(?<!\\)\|/)[6] ?? '').trim()
    const linhas = linhasDoIndice(readFileSync(join(raiz, 'tasks/prd-exemplo/achados/indice.md'), 'utf8'))
    expect(celula(linhas[0] ?? '')).toBe('o bloqueante que tem de aparecer')
    expect(linhas[0]).not.toContain('roubar a célula')

    // O corte não parte palavra: ele recua até o último espaço, e o que sobra é prefixo do original.
    const cortada = celula(linhas[1] ?? '')
    expect(cortada.endsWith('…')).toBe(true)
    const semReticencias = cortada.slice(0, -1)
    expect(LONGO.startsWith(semReticencias)).toBe(true)
    expect(LONGO[semReticencias.length]).toBe(' ')
    expect(semReticencias.endsWith(PALAVRA)).toBe(true)
  })

  it('o índice compartilhado não perde linha com rodadas terminando ao mesmo tempo', async () => {
    // O índice é o único arquivo que dois documentos da mesma pasta escrevem. Não é hipótese: uma
    // tarefa e uma correção em sessões diferentes escrevem em `tasks/correcoes/achados/indice.md`
    // ao mesmo tempo. Sem a trava, a última escrita apaga a anterior (regra 80, item 7).
    const raiz = repositorio()
    const quantos = 6
    const corredor = join(raiz, 'corredor.ts')
    writeFileSync(
      corredor,
      `import { registrar } from ${JSON.stringify(join(import.meta.dirname, 'revisoes.ts'))}\n` +
        'const [, , raiz, revisor, transcript, fim] = process.argv\n' +
        "registrar({ agent_type: revisor, agent_id: 'a', agent_transcript_path: transcript, last_assistant_message: `VEREDITO: REPROVADO\\n\\nBloqueantes:\\n- achado de ${revisor}` }, raiz, new Date(fim))\n",
    )

    const processos = Array.from({ length: quantos }, (_, indice) => {
      const documento = `tasks/prd-exemplo/${String(indice + 1)}_task.md`
      writeFileSync(join(raiz, documento), `# ${documento}\n\n**Subagentes obrigatórios:** \`revisor-geral\`\n`)
      const caminhoTranscript = join(pasta, `paralelo-${String(indice)}-${String(sequencia++)}.jsonl`)
      const fim = `2026-09-13T1${String(indice)}:00:00`
      writeFileSync(caminhoTranscript, JSON.stringify({ type: 'user', timestamp: new Date(fim).toISOString(), message: { content: `Tarefa: ${documento}` } }))
      return new Promise<number>((resolve) => {
        spawn('node', [corredor, raiz, REVISORES_DE_TESTE_PARALELO[indice] ?? 'revisor-geral', caminhoTranscript, fim], { stdio: 'ignore' }).on('exit', (codigo) => {
          resolve(codigo ?? 1)
        })
      })
    })
    expect(await Promise.all(processos)).toEqual(Array.from({ length: quantos }, () => 0))

    // Uma linha por rodada, nenhuma sobrescrita, e cada bloco no arquivo do seu documento.
    const indice = readFileSync(join(raiz, 'tasks/prd-exemplo/achados/indice.md'), 'utf8')
    const linhas = linhasDoIndice(indice)
    expect(linhas).toHaveLength(quantos)
    // Os seis revisores distintos, um por linha: contagem sozinha deixaria passar linha duplicada.
    expect(REVISORES_DE_TESTE_PARALELO.filter((revisor) => linhas.some((linha) => linha.includes(`\`${revisor}\``)))).toEqual(REVISORES_DE_TESTE_PARALELO)
    for (let numero = 1; numero <= quantos; numero++) {
      expect(existsSync(join(raiz, `tasks/prd-exemplo/achados/${String(numero)}_task.md`))).toBe(true)
    }
    // O instantâneo de conteúdo é do mesmo tipo: um arquivo só, escrito por todas as rodadas. Perder a chave de uma
    // delas faz aquela rodada cair no `mtime` e voltar a bloquear o commit de quem fez teste de mutação. Cada rodada
    // grava duas chaves: o hash inteiro e o par sem comentários.
    const chaves = Object.keys(lerInstantaneos(raiz))
    expect(chaves.filter((chave) => !chave.endsWith('|sem-comentarios'))).toHaveLength(quantos)
    expect(chaves.filter((chave) => chave.endsWith('|sem-comentarios'))).toHaveLength(quantos)
  })

  it('o índice de uma funcionalidade inteira cabe no que se lê antes de cada tarefa', () => {
    const raiz = repositorio()
    const paragrafo = 'Texto do revisor com detalhe de arquivo e linha. '.repeat(120)
    for (let tarefa = 1; tarefa <= 20; tarefa++) {
      for (let numero = 1; numero <= 5; numero++) {
        // Uma rodada em cada cinco escreve um item longo: sem isso, a asserção da célula abaixo
        // passaria mesmo com `encurtar` desligado, e o teto do índice não estaria provado aqui.
        const exigencia = numero === 3 ? ITEM_LONGO : `exigência ${String(numero)} da tarefa ${String(tarefa)}`
        rodada(
          raiz,
          `tasks/prd-exemplo/${String(tarefa)}_task.md`,
          'revisor-geral',
          `VEREDITO: REPROVADO\n\nBloqueantes:\n- ${exigencia}\n\n${paragrafo}`,
          `2026-09-${String(tarefa).padStart(2, '0')}T1${String(numero)}:00:00`,
        )
      }
    }
    const achados = readdirSync(join(raiz, 'tasks/prd-exemplo/achados'))
      .filter((arquivo) => arquivo !== 'indice.md')
      .map((arquivo) => statSync(join(raiz, 'tasks/prd-exemplo/achados', arquivo)).size)
      .reduce((total, tamanho) => total + tamanho, 0)
    const indice = readFileSync(join(raiz, 'tasks/prd-exemplo/achados/indice.md'), 'utf8')

    // O corpo tem o tamanho do F1; o índice, que é o que se lê antes de cada tarefa, não.
    expect(achados).toBeGreaterThan(600_000)
    expect(indice.length).toBeLessThan(40_000)
    // O total sozinho é frouxo: o que decide o custo é o da rodada. Mas o teto por linha inteira não
    // serve de asserção, porque metade dela é o nome do documento, que é dado e não orçamento: o
    // máximo real vai de 238 bytes por linha (`N_task`) a 305 (slug de correção), e esse número mudou
    // três vezes numa semana. O que o código controla é a célula do resumo, e é ela que tem de caber
    // — sem `encurtar`, uma só passa de 380.
    const celulas = linhasDoIndice(indice).map((linha) => (linha.split(/(?<!\\)\|/)[6] ?? '').trim())
    expect(celulas).toHaveLength(100)
    expect(Math.max(...celulas.map((celula) => celula.length))).toBeLessThanOrEqual(161)
    // E o índice não perde rodada: uma linha para cada uma das 100.
    expect(linhasDoIndice(indice)).toHaveLength(100)
  })
})

describe('a árvore em que o commit acontece', () => {
  /** Um repositório com um andar: outra árvore de trabalho do mesmo repositório, em branch própria, com código sem commit. */
  function terreoEAndar() {
    const terreo = mkdtempSync(join(tmpdir(), 'terreo-'))
    const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, stdio: 'pipe' })
    git(terreo, 'init', '-q', '-b', 'develop')
    writeFileSync(join(terreo, 'LEIAME.md'), 'x\n')
    git(terreo, 'add', '-A')
    git(terreo, 'commit', '-q', '-m', 'início')
    const andar = join(mkdtempSync(join(tmpdir(), 'andares-')), 'spec')
    git(terreo, 'worktree', 'add', '-q', '-b', 'spec/exemplo', andar)
    mkdirSync(join(andar, 'apps'), { recursive: true })
    writeFileSync(join(andar, 'apps/codigo.ts'), 'export const a = 1\n')
    return { terreo, andar }
  }
  const comando = (command: string) => ({ tool_input: { command } })

  it('commit com -C é avaliado contra a árvore do andar, e não contra a da sessão, que está limpa', () => {
    const { terreo, andar } = terreoEAndar()
    expect(arvoreDoCommit(`git -C ${andar} commit -m "x"`, terreo)).toBe(andar)
    const motivo = portao(comando(`git -C ${andar} add -A && git -C ${andar} commit -m "fecha a spec"`), terreo)
    expect(motivo).toMatch(/Commit bloqueado: ele leva código \(apps\/codigo\.ts\)/)
    // O mesmo commit, só de documento, passa: é o fechamento que o Orquestrador faz no andar.
    rmSync(join(andar, 'apps'), { recursive: true })
    writeFileSync(join(andar, 'ROADMAP.md'), '# Roadmap\n')
    expect(portao(comando(`git -C ${andar} add ROADMAP.md && git -C ${andar} commit -m "fecha a spec"`), terreo)).toBeNull()
  })

  it('vale também o cd dentro do comando, o cd de um comando anterior, e o caminho entre aspas', () => {
    const { terreo, andar } = terreoEAndar()
    expect(portao(comando(`cd ${andar} && git add -A && git commit -m "x"`), terreo)).toMatch(/leva código/)
    expect(portao({ ...comando('git add -A && git commit -m "x"'), cwd: andar }, terreo)).toMatch(/leva código/)
    expect(portao(comando(`git -C "${andar}" commit -am "x"`), terreo)).toMatch(/leva código/)
    // O cd depois do commit não muda onde ele aconteceu.
    expect(arvoreDoCommit(`git commit -m "x" && cd ${andar}`, terreo)).toBe(terreo)
  })

  it('subpasta da própria árvore, caminho que não existe e repositório alheio continuam na árvore da sessão', () => {
    const { terreo, andar } = terreoEAndar()
    expect(arvoreDoCommit('git -C apps commit -m "x"', andar)).toBe(andar)
    expect(arvoreDoCommit('git -C /caminho/que/nao/existe commit -m "x"', terreo)).toBe(terreo)
    const alheio = mkdtempSync(join(tmpdir(), 'alheio-'))
    execFileSync('git', ['init', '-q'], { cwd: alheio })
    mkdirSync(join(alheio, 'apps'))
    writeFileSync(join(alheio, 'apps/outro.ts'), 'x\n')
    expect(arvoreDoCommit(`git -C ${alheio} commit -m "x"`, terreo)).toBe(terreo)
    expect(portao(comando(`git -C ${alheio} add -A && git -C ${alheio} commit -m "x"`), terreo)).toBeNull()
  })

  it('o comando do commit não faz mais nada antes dele: o que ele criasse entraria sem o hook ter visto', () => {
    const { terreo, andar } = terreoEAndar()
    // O caso da prova de 08/10/2026: o arquivo nasce no mesmo comando, e o hook lia a árvore sem ele.
    expect(portao(comando('echo prova > apps/novo.ts && git add apps/novo.ts && git commit -m "prova"'), terreo)).toMatch(/faz outra coisa antes do `git commit` \(echo prova > apps\/novo\.ts\)/)
    expect(portao(comando('cat > apps/novo.ts <<EOF\nexport const a = 1\nEOF\ngit add -A && git commit -m "x (tarefa 9.0)"'), terreo)).toMatch(/faz outra coisa antes/)
    expect(portao(comando('npm run lint -- --fix && git commit -am "x"'), terreo)).toMatch(/faz outra coisa antes do `git commit` \(npm run lint -- --fix\)/)
    expect(portao(comando('git checkout outra -- apps && git commit -am "x"'), terreo)).toMatch(/faz outra coisa antes/)
    expect(portao(comando('git add $(touch apps/z.ts; echo apps/z.ts) && git commit -m "x"'), terreo)).toMatch(/faz outra coisa antes/)
    expect(portao(comando('git status --short | tee apps/saida.txt && git commit -am "x"'), terreo)).toMatch(/faz outra coisa antes/)
    // Mudar de pasta, guardar um caminho, olhar e preparar não é "outra coisa", e o que vem depois do commit não conta.
    writeFileSync(join(terreo, 'docs.md'), 'x\n')
    expect(antesDoCommit('# fecha a spec\ngit status --short && git --no-pager diff --stat; git add docs.md && git commit -m "x"')).toBeNull()
    expect(portao(comando('git status --short && git add docs.md && git commit -m "x" && echo ok > apps/depois.txt'), terreo)).toBeNull()
    expect(portao(comando(`(cd ${andar} && git add -A && git commit -m "x")`), terreo)).toMatch(/leva código/)
    expect(antesDoCommit('git log --oneline -3')).toBeNull()
  })

  it('caminho em variável: vale a atribuída no próprio comando, e a que o hook não conhece bloqueia', () => {
    const { terreo, andar } = terreoEAndar()
    expect(portao(comando(`F=${andar}; git -C "$F" add -A && git -C "$F" commit -m "x"`), terreo)).toMatch(/leva código \(apps\/codigo\.ts\)/)
    expect(portao(comando(`F="${andar}"\ncd "\${F}" && git add -A && git commit -m "x"`), terreo)).toMatch(/leva código/)
    expect(portao(comando('git -C "$ANDAR" commit -am "x"'), terreo)).toMatch(/não sabe em que árvore este commit acontece, porque o caminho "\$ANDAR"/)
    expect(portao(comando('cd $(pwd)/../outro && git commit -am "x"'), terreo)).toMatch(/faz outra coisa antes/)
    expect(portao(comando('F=$(mktemp -d); git -C "$F" commit -am "x"'), terreo)).toMatch(/faz outra coisa antes/)
  })

  it('agente do time não empurra develop, release nem main; a branch do andar ele empurra', () => {
    const { terreo, andar } = terreoEAndar()
    const push =(command: string, raizDaSessao: string, papel: string) => portao(comando(command), raizDaSessao, papel)
    // No térreo a árvore está na develop: push sem branch escrita, com HEAD, ou com a branch por extenso.
    expect(push('git push', terreo, 'arquiteto')).toMatch(/Push bloqueado: este comando empurra `develop`.*papel `arquiteto`/)
    expect(push('git push -u origin HEAD', terreo, 'implementador')).toMatch(/empurra `develop`/)
    expect(push('git add docs.md && git commit -m "x" && git push origin develop', terreo, 'validador')).toMatch(/Push bloqueado/)
    // Do andar, a branch da spec passa; o que aponta para uma protegida, não.
    expect(push('git push -u origin HEAD', andar, 'implementador')).toBeNull()
    expect(push('git push origin spec/exemplo', andar, 'implementador')).toBeNull()
    expect(push('git push origin spec/exemplo:develop', andar, 'implementador')).toMatch(/empurra `develop`/)
    expect(push('git push origin +refs/heads/main', andar, 'mesa-de-revisao')).toMatch(/empurra `main`/)
    expect(push('git push origin HEAD:release --force', andar, 'implementador')).toMatch(/empurra `release`/)
    expect(push('git push --all origin', andar, 'implementador')).toMatch(/empurra todas as branches/)
    expect(push(`git -C ${terreo} push`, andar, 'implementador')).toMatch(/empurra `develop`/)
    expect(push(`cd ${terreo} && git push origin HEAD`, andar, 'implementador')).toMatch(/empurra `develop`/)
    expect(push('git -C "$OUTRO" push', andar, 'implementador')).toMatch(/uma branch que o hook não sabe qual é/)
    // O Orquestrador e a sessão de uma pessoa não têm papel: o push da develop é deles, com a palavra do Joaquim.
    // Sem papel é '' e não undefined: undefined cairia no padrão de `portao`, que lê CLAUDE_CODE_AGENT da sessão que roda o teste.
    expect(push('git push origin develop', terreo, '')).toBeNull()
    expect(push('git push origin develop', terreo, 'general-purpose')).toBeNull()
    // `git push` dentro de um texto não é push.
    expect(push('git log --grep "git push origin develop"', terreo, 'implementador')).toBeNull()
    expect(destinoProtegidoDoPush('git status', 'develop')).toBeNull()
  })

  it('sem papel passado, portao lê o papel de CLAUDE_CODE_AGENT, que é o caminho do hook', () => {
    const { terreo } = terreoEAndar()
    try {
      vi.stubEnv('CLAUDE_CODE_AGENT', 'implementador')
      expect(portao(comando('git push origin develop'), terreo)).toMatch(/empurra `develop`.*papel `implementador`/)
      vi.stubEnv('CLAUDE_CODE_AGENT', '')
      expect(portao(comando('git push origin develop'), terreo)).toBeNull()
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

describe('as palavras do comando do shell', () => {
  it('as aspas agrupam e saem, e o separador fora delas troca de comando', () => {
    expect(comandosDoShell('git commit -m "a b; c" && echo \'x | y\'')).toEqual([
      ['git', 'commit', '-m', 'a b; c'],
      ['echo', 'x | y'],
    ])
    expect(comandosDoShell('a;b\nc | d (e)')).toEqual([['a'], ['b'], ['c'], ['d'], ['e']])
    expect(comandosDoShell('')).toEqual([])
  })

  it('os pedaços colados viram uma palavra só', () => {
    expect(comandosDoShell('git -c core."hooksPath"=x commit -m"msg"')).toEqual([['git', '-c', 'core.hooksPath=x', 'commit', '-mmsg']])
    // Separados por espaço, são duas palavras.
    expect(comandosDoShell('a "b" c')).toEqual([['a', 'b', 'c']])
  })

  it('fora das aspas, a barra invertida tira o caractere seguinte e junta as linhas; $\'…\' vale o texto cru', () => {
    expect(comandosDoShell('git commi\\t --no-verif\\y')).toEqual([['git', 'commit', '--no-verify']])
    expect(comandosDoShell("git commit $'--no-verify' -m x")).toEqual([['git', 'commit', '--no-verify', '-m', 'x']])
    expect(comandosDoShell('git commit \\\n--no-verify')).toEqual([['git', 'commit', '--no-verify']])
    expect(comandosDoShell('git commit --no-\\\nverify')).toEqual([['git', 'commit', '--no-verify']])
    // O `$` só é da palavra quando não abre aspas: `$'y'` e `$"y"` coladas numa palavra viram o texto delas.
    expect(comandosDoShell("git commit --no-verif$'y' -m x")).toEqual([['git', 'commit', '--no-verify', '-m', 'x']])
    expect(comandosDoShell('git commit --no-verif$"y" -m x')).toEqual([['git', 'commit', '--no-verify', '-m', 'x']])
    expect(comandosDoShell('echo $HOME x$')).toEqual([['echo', '$HOME', 'x$']])
    // Dentro de aspas duplas, `\"` não fecha a palavra: a mensagem inteira é uma palavra só.
    expect(comandosDoShell('git commit -m "a \\" --no-verify"')).toEqual([['git', 'commit', '-m', 'a \\" --no-verify']])
  })
})

describe('o desvio do hook do git em sessão de papel (RF14)', () => {
  const negados = [
    { etiqueta: 'no-verify inteiro', comando: 'git commit --no-verify -m "x"', motivo: /--no-verify/ },
    { etiqueta: 'no-verify abreviado em verif', comando: 'git commit --no-verif -m "x"', motivo: /--no-verify/ },
    { etiqueta: 'no-verify abreviado em ver', comando: 'git commit --no-ver -m "x"', motivo: /--no-verify/ },
    { etiqueta: 'no-verify abreviado em v', comando: 'git commit --no-v -m "x"', motivo: /--no-verify/ },
    { etiqueta: 'no-verify no push', comando: 'git push --no-verify origin spec/x', motivo: /--no-verify/ },
    { etiqueta: 'no-verify depois de um add', comando: 'git add -A && git commit --no-verify -m "x"', motivo: /--no-verify/ },
    { etiqueta: 'n sozinho no commit', comando: 'git commit -n -m "x"', motivo: /-n, que é --no-verify/ },
    { etiqueta: 'n junto do m', comando: 'git commit -nm "x"', motivo: /-n, que é --no-verify/ },
    { etiqueta: 'n no meio do bloco', comando: 'git commit -anm "x"', motivo: /-n, que é --no-verify/ },
    { etiqueta: 'hookspath por c', comando: 'git -c core.hooksPath=/dev/null commit -m "x"', motivo: /core\.hooksPath/ },
    { etiqueta: 'hookspath em maiúsculas', comando: 'git -c core.HOOKSPATH=x commit -m "x"', motivo: /core\.hooksPath/ },
    { etiqueta: 'hookspath colado no c', comando: 'git -ccore.hooksPath=x commit -m "x"', motivo: /core\.hooksPath/ },
    { etiqueta: 'hookspath por config', comando: 'git config core.hookspath /tmp/x', motivo: /mexe no core\.hooksPath/ },
    { etiqueta: 'variável do papel vazia', comando: 'CLAUDE_CODE_AGENT= git commit -m "x"', motivo: /mexe em CLAUDE_CODE_AGENT/ },
    { etiqueta: 'unset do papel', comando: 'unset CLAUDE_CODE_AGENT', motivo: /mexe em CLAUDE_CODE_AGENT/ },
    { etiqueta: 'unset de GIT_CONFIG', comando: 'unset -v GIT_CONFIG_COUNT', motivo: /mexe em GIT_CONFIG_COUNT/ },
    { etiqueta: 'env com u', comando: 'env -u CLAUDE_CODE_AGENT git commit -m "x"', motivo: /mexe em CLAUDE_CODE_AGENT/ },
    { etiqueta: 'env com u colado', comando: 'env -uCLAUDE_CODE_AGENT git commit -m "x"', motivo: /mexe em CLAUDE_CODE_AGENT/ },
    { etiqueta: 'env com unset e igual', comando: 'env --unset=CLAUDE_CODE_AGENT git commit -m "x"', motivo: /mexe em CLAUDE_CODE_AGENT/ },
    { etiqueta: 'env com unset e espaço', comando: 'env --unset CLAUDE_CODE_AGENT git commit -m "x"', motivo: /mexe em CLAUDE_CODE_AGENT/ },
    { etiqueta: 'env que troca o papel', comando: 'env CLAUDE_CODE_AGENT=outro git commit -m "x"', motivo: /mexe em CLAUDE_CODE_AGENT/ },
    { etiqueta: 'GIT_CONFIG_COUNT', comando: 'GIT_CONFIG_COUNT=1 git commit -m "x"', motivo: /mexe em GIT_CONFIG_COUNT/ },
    { etiqueta: 'export de GIT_CONFIG', comando: 'export GIT_CONFIG_COUNT=1', motivo: /mexe em GIT_CONFIG_COUNT/ },
    { etiqueta: 'export só do nome', comando: 'export -n CLAUDE_CODE_AGENT', motivo: /mexe em CLAUDE_CODE_AGENT/ },
    { etiqueta: 'git pelo caminho absoluto', comando: '/usr/bin/git commit --no-verify -m "x"', motivo: /--no-verify/ },
    { etiqueta: 'git atrás do env', comando: 'env git commit -n -m "x"', motivo: /-n, que é --no-verify/ },
    { etiqueta: 'git atrás do command', comando: 'command git commit -n -m "x"', motivo: /-n, que é --no-verify/ },
    { etiqueta: 'git atrás de uma atribuição', comando: 'GIT_AUTHOR_DATE=x git commit -n -m "x"', motivo: /-n, que é --no-verify/ },
    { etiqueta: 'git com C antes do subcomando', comando: 'git -C ../outro commit -n -m "x"', motivo: /-n, que é --no-verify/ },
    { etiqueta: 'git com git-dir antes do subcomando', comando: 'git --git-dir .git commit -n -m "x"', motivo: /-n, que é --no-verify/ },
    { etiqueta: 'git com work-tree antes do subcomando', comando: 'git --work-tree /x commit -n -m "x"', motivo: /-n, que é --no-verify/ },
    { etiqueta: 'git com attr-source antes do subcomando', comando: 'git --attr-source HEAD commit -n -m x', motivo: /-n, que é --no-verify/ },
    { etiqueta: 'git com shallow-file antes do subcomando', comando: 'git --shallow-file x commit -n -m x', motivo: /-n, que é --no-verify/ },
    { etiqueta: 'git com super-prefix antes do subcomando', comando: 'git --super-prefix x/ commit -n -m x', motivo: /-n, que é --no-verify/ },
    { etiqueta: 'git com namespace antes do subcomando', comando: 'git --namespace n commit -n -m "x"', motivo: /-n, que é --no-verify/ },
    { etiqueta: 'git com config-env antes do subcomando', comando: 'git --config-env core.hooksPath=VAR commit -m "x"', motivo: /core\.hooksPath/ },
    { etiqueta: 'git depois do env que tira outra variável', comando: 'env -u FOO git commit -n -m "x"', motivo: /-n, que é --no-verify/ },
    { etiqueta: 'git depois do env com opção', comando: 'env -i git commit -n -m "x"', motivo: /-n, que é --no-verify/ },
    { etiqueta: 'atribuição solta do papel', comando: 'CLAUDE_CODE_AGENT=outro', motivo: /mexe em CLAUDE_CODE_AGENT/ },
    { etiqueta: 'barra invertida dentro da opção', comando: 'git commit --no-verif\\y -m x', motivo: /--no-verify/ },
    { etiqueta: 'barra invertida dentro do subcomando', comando: 'git commi\\t -n -m x', motivo: /-n, que é --no-verify/ },
    { etiqueta: 'aspas ANSI-C na opção', comando: "git commit $'--no-verify' -m x", motivo: /--no-verify/ },
    { etiqueta: 'ANSI-C colada no fim da opção', comando: "git commit --no-verif$'y' -m x", motivo: /--no-verify/ },
    { etiqueta: 'ANSI-C colada no n', comando: "git commit -$'n' -m x", motivo: /-n, que é --no-verify/ },
    { etiqueta: 'aspas duplas com cifrão na opção', comando: 'git commit --no-verif$"y" -m x', motivo: /--no-verify/ },
    { etiqueta: 'aspas duplas com cifrão no n', comando: 'git commit -$"n" -m x', motivo: /-n, que é --no-verify/ },
    { etiqueta: 'barra invertida antes da quebra de linha', comando: 'git commit \\\n--no-verify -m x', motivo: /--no-verify/ },
    { etiqueta: 'alias por c com no-verify dentro', comando: 'git -c alias.c="commit --no-verify" c -m x', motivo: /define um alias do git/ },
    { etiqueta: 'alias por c em maiúsculas', comando: 'git -c ALIAS.c=commit c -m x', motivo: /define um alias do git/ },
    { etiqueta: 'alias por config-env', comando: 'git --config-env alias.c=VAR c -m x', motivo: /define um alias do git/ },
    { etiqueta: 'alias por config-env com igual', comando: 'V="commit -n" git --config-env=alias.c=V c -m x', motivo: /define um alias do git/ },
    { etiqueta: 'hookspath por config-env com igual', comando: 'git --config-env=core.hooksPath=V commit -m x', motivo: /core\.hooksPath/ },
    { etiqueta: 'hookspath: desarmar o caminho', comando: 'git config --unset core.hooksPath', motivo: /mexe no core\.hooksPath/ },
    { etiqueta: 'hookspath: acrescentar um segundo caminho', comando: 'git config --add core.hooksPath /tmp/x', motivo: /mexe no core\.hooksPath/ },
    { etiqueta: 'hookspath: o --get com uma ação de escrita junto', comando: 'git config --get --unset core.hooksPath', motivo: /mexe no core\.hooksPath/ },
    { etiqueta: 'hookspath: o --get que leva um valor, que pode ser a escrita', comando: 'git config --get core.hooksPath /tmp/x', motivo: /mexe no core\.hooksPath/ },
    // O `git config` para de ler opções na primeira palavra que não é opção: com a chave antes, a ação vira o valor e o comando GRAVA.
    { etiqueta: 'hookspath: a chave antes do --get grava o valor --get', comando: 'git config core.hooksPath --get', motivo: /mexe no core\.hooksPath/ },
    { etiqueta: 'hookspath: o escopo antes e a chave antes do --get', comando: 'git config --local core.hooksPath --get', motivo: /mexe no core\.hooksPath/ },
    { etiqueta: 'hookspath: a chave antes do --get-all, com o --show-origin', comando: 'git config --show-origin core.hooksPath --get-all', motivo: /mexe no core\.hooksPath/ },
    { etiqueta: 'hookspath: o escopo depois da chave vira o valor', comando: 'git config --get core.hooksPath --local', motivo: /mexe no core\.hooksPath/ },
    { etiqueta: 'hookspath: o --get com a chave repetida como valor', comando: 'git config --get core.hooksPath core.hooksPath', motivo: /mexe no core\.hooksPath/ },
    { etiqueta: 'hookspath: ler e depois escrever no mesmo comando', comando: 'git config --get core.hooksPath && git config core.hooksPath /tmp/x', motivo: /mexe no core\.hooksPath/ },
    { etiqueta: 'hookspath: a leitura com um c que o troca', comando: 'git -c core.hooksPath=/tmp/x config --get core.hooksPath', motivo: /troca o core\.hooksPath/ },
    { etiqueta: 'alias por c junto do config', comando: 'git -c alias.x=y config --list', motivo: /define um alias do git/ },
    { etiqueta: 'alias por config', comando: 'git config alias.ci "commit -n"', motivo: /define um alias do git/ },
    { etiqueta: 'alias por config global', comando: 'git config --global alias.ci "commit -n"', motivo: /define um alias do git/ },
  ]

  it.each(negados)('negado: $etiqueta', ({ comando, motivo }) => {
    expect(desvioDoHook(comando)).toMatch(motivo)
  })

  const passam = [
    { etiqueta: 'git log com n', comando: 'git log -n 3' },
    { etiqueta: 'git diff com no-ext-diff', comando: 'git diff --no-ext-diff' },
    { etiqueta: 'git push com n, que é dry-run', comando: 'git push -n origin spec/x' },
    { etiqueta: 'o separador de caminhos', comando: 'git add -- docs.md' },
    { etiqueta: 'git com c de outra chave', comando: 'git -c user.name=x commit -m "x"' },
    { etiqueta: 'git com atribuição de outra variável', comando: 'GIT_AUTHOR_DATE=x git commit -m "x"' },
    { etiqueta: 'git com env de outra variável', comando: 'env FOO=1 git status' },
    { etiqueta: 'git config de outra chave', comando: 'git config user.name x' },
    // M5 da retro da X7: ler o caminho dos hooks não o troca (o `contexto-inicial.sh` e quem confere o checkout leem a chave).
    { etiqueta: 'leitura do hooksPath por --get', comando: 'git config --get core.hooksPath' },
    { etiqueta: 'leitura do hooksPath por --get-all, em minúsculas', comando: 'git config --get-all core.hookspath' },
    { etiqueta: 'leitura do hooksPath com escopo', comando: 'git config --global --get core.hooksPath' },
    { etiqueta: 'leitura do hooksPath com o escopo entre a ação e a chave', comando: 'git config --get --local core.hooksPath' },
    { etiqueta: 'grep na variável do papel', comando: 'grep CLAUDE_CODE_AGENT .claude/settings.json' },
    { etiqueta: 'printenv da variável do papel', comando: 'printenv CLAUDE_CODE_AGENT' },
    { etiqueta: 'unset de outra variável', comando: 'unset FOO' },
    { etiqueta: 'export de outra variável', comando: 'export PATH=/usr/bin' },
    { etiqueta: 'mensagem do commit que fala dos desvios', comando: 'git commit -m "não use --no-verify nem CLAUDE_CODE_AGENT= nem -n"' },
    { etiqueta: 'mensagem para outro agente', comando: 'maestri ask "Mesa" "o hook barra --no-verify e unset CLAUDE_CODE_AGENT"' },
    { etiqueta: 'a mensagem que é a letra n', comando: 'git commit -mn' },
    { etiqueta: 'untracked-files no', comando: 'git commit -uno -m "x"' },
    { etiqueta: 'a mensagem de arquivo', comando: 'git commit -F msg.txt' },
    { etiqueta: 'comando vazio', comando: '' },
    { etiqueta: 'outro programa com no-verify', comando: 'npx lint-staged --no-verify' },
    { etiqueta: 'palavra que só termina na atribuição', comando: 'x-GIT_CONFIG_COUNT=1 git commit -m "x"' },
    { etiqueta: 'mensagem que cita o hooksPath', comando: 'git commit -m "Instala o core.hooksPath no prepare"' },
    { etiqueta: 'mensagem que termina em n', comando: 'git commit -m "corrige x -n"' },
    // Dentro de aspas duplas, `\"` é um caractere da mensagem e não fecha a palavra: o `--no-verify` depois dele é texto.
    { etiqueta: 'aspas escapadas dentro da mensagem', comando: 'git commit -m "a \\" --no-verify"' },
    { etiqueta: 'mensagem que cita um alias', comando: 'git commit -m "remove o alias.ci do config"' },
    { etiqueta: 'mensagem que começa por alias', comando: 'git commit -m "alias.ci: remove do config"' },
    { etiqueta: 'busca de um alias no log', comando: 'git log --grep alias.ci' },
    { etiqueta: 'config de outra chave com alias no meio', comando: 'git config user.name "x alias.y"' },
    { etiqueta: 'aspas ANSI-C na mensagem', comando: "git commit -m $'corrige x'" },
    // Limite declarado: o que está dentro de `$'…'` não é decodificado (`\055` é o `-`), e o hook não alcança.
    { etiqueta: 'limite: octal dentro de ANSI-C', comando: "git commit $'\\055\\055no-verify' -m x" },
    { etiqueta: 'attr-source com igual é uma palavra só', comando: 'git --attr-source=HEAD commit -m x' },
    { etiqueta: 'git de um alias que já estava no config', comando: 'git ci -m x' },
    { etiqueta: 'mensagem com cifrão e número', comando: 'git commit -m "custa $5"' },
    // `\'` dentro de `$'…'` não fecha as aspas: o `--no-verify` depois dele ainda é a mensagem.
    { etiqueta: 'aspa escapada dentro de ANSI-C', comando: "git commit -m $'a\\' --no-verify'" },
    // Limite declarado (techspec §5(a), a gramática do leitor): expansão não é decodificada.
    { etiqueta: 'limite: expansão de parâmetro na opção', comando: 'git commit --no-verif${X}y -m x' },
    { etiqueta: 'limite: chaves na opção', comando: 'git commit --no-verif{y,} -m x' },
    // Limite declarado (techspec §5(a)): o `include.path` traz alias e `core.hooksPath` de um arquivo, e o hook não o lê.
    { etiqueta: 'limite: include.path por c', comando: 'git -c include.path=/tmp/cfg c -m x' },
  ]

  it.each(passam)('passa: $etiqueta', ({ comando }) => {
    expect(desvioDoHook(comando)).toBeNull()
  })

  it.each(['m', 'F', 'C', 'c', 't', 'S', 'u'])('passa: a letra %s leva o resto do bloco como argumento', (letra) => {
    // `-mn` é a mensagem "n", `-Fn` o arquivo "n": o `n` depois delas não é a opção.
    expect(desvioDoHook(`git commit -${letra}n`)).toBeNull()
  })

  it('limite declarado: aspas duplas em número ímpar dentro de $(cat <<EOF) desalinham a leitura, e a saída é a mensagem em arquivo', () => {
    // O shell lê o `$(…)` como um contexto à parte; o leitor não, e a aspa solta fecha a palavra antes do tempo.
    const heredoc = 'git commit -m "$(cat <<\'EOF\'\nCorrige o x\n\nUsa 5" de largura e fala do --no-verify\nEOF\n)"'
    expect(desvioDoHook(heredoc)).toMatch(/--no-verify/)
    // Com a mesma mensagem num arquivo, o desvio é o do comando, e o comando não tem nenhum.
    expect(desvioDoHook('git commit -F msg.txt')).toBeNull()
  })

  it('o papel do time é o que decide: portao nega com papel e deixa passar sem papel, ou com papel de fora do time', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'desvio-'))
    execFileSync('git', ['init', '-q'], { cwd: raiz })
    const comando = { tool_input: { command: 'git commit --no-verify -m "x"' } }
    expect(portao(comando, raiz, 'implementador')).toMatch(/Comando bloqueado: ele usa --no-verify.*papel `implementador`/)
    expect(portao(comando, raiz, 'arquiteto')).toMatch(/Comando bloqueado/)
    expect(portao(comando, raiz, '')).toBeNull()
    // Sem papel é '' e não undefined: undefined cai no padrão de `portao`, que lê CLAUDE_CODE_AGENT da sessão que roda o teste.
    expect(portao(comando, raiz, 'general-purpose')).toBeNull()
    expect(ehPapelDoTime('mesa-de-revisao')).toBe(true)
    expect(ehPapelDoTime('intruso')).toBe(false)
    expect(ehPapelDoTime(undefined)).toBe(false)
  })
})

describe('a mensagem do commit vem do comando ou do arquivo (RF14)', () => {
  it.each([
    { etiqueta: 'F separado', comando: 'git commit -F msg.txt', arquivos: ['msg.txt'] },
    { etiqueta: 'F colado', comando: 'git commit -Fmsg.txt', arquivos: ['msg.txt'] },
    { etiqueta: 'file com igual', comando: 'git commit --file=msg.txt', arquivos: ['msg.txt'] },
    { etiqueta: 'file separado', comando: 'git commit --file msg.txt', arquivos: ['msg.txt'] },
    { etiqueta: 'F depois do a', comando: 'git commit -aF msg.txt', arquivos: ['msg.txt'] },
    { etiqueta: 'F colado depois do a', comando: 'git commit -aFmsg.txt', arquivos: ['msg.txt'] },
    { etiqueta: 'F com C antes do subcomando', comando: 'git -C ../andar commit -F msg.txt', arquivos: ['msg.txt'] },
    { etiqueta: 'F de dois commits', comando: 'git commit -F um.txt && git commit -F dois.txt', arquivos: ['um.txt', 'dois.txt'] },
    { etiqueta: 'F entre aspas', comando: 'git commit -F "minha mensagem.txt"', arquivos: ['minha mensagem.txt'] },
    { etiqueta: 'F sem arquivo', comando: 'git commit -F', arquivos: [] },
    { etiqueta: 'mensagem que fala de F', comando: 'git commit -m "usa -F nao.txt"', arquivos: [] },
    { etiqueta: 'mensagem que começa por F', comando: 'git commit -mFoo', arquivos: [] },
    { etiqueta: 'mensagem sem arquivo', comando: 'git commit -m "x"', arquivos: [] },
    { etiqueta: 'F de outro subcomando', comando: 'git log -F x', arquivos: [] },
    { etiqueta: 'F de outro programa', comando: 'grep -F x y && git status', arquivos: [] },
  ])('acha o arquivo: $etiqueta', ({ comando, arquivos }) => {
    expect(arquivosDaMensagem(comando)).toEqual(arquivos)
  })

  it('lê os arquivos a partir da pasta do commit, junta os textos e trata o que não existe como vazio', () => {
    const pasta = mkdtempSync(join(tmpdir(), 'mensagem-'))
    writeFileSync(join(pasta, 'um.txt'), 'primeira\n')
    writeFileSync(join(pasta, 'dois.txt'), 'segunda\n')
    expect(textoDosArquivosDeMensagem('git commit -F um.txt', pasta)).toBe('primeira\n')
    expect(textoDosArquivosDeMensagem('git commit -F um.txt && git commit -F dois.txt', pasta)).toBe('primeira\n\nsegunda\n')
    expect(textoDosArquivosDeMensagem(`git commit -F ${join(pasta, 'um.txt')}`, '/outra/pasta')).toBe('primeira\n')
    expect(textoDosArquivosDeMensagem('git commit -F nao-existe.txt', pasta)).toBe('')
    expect(textoDosArquivosDeMensagem('git commit -F -', pasta)).toBe('')
    // O que não é arquivo regular (uma pasta, um fifo como `/dev/stdin`) não é lido: ler prenderia o hook.
    mkdirSync(join(pasta, 'uma-pasta'))
    expect(textoDosArquivosDeMensagem('git commit -F uma-pasta', pasta)).toBe('')
    const fifo = join(pasta, 'fila')
    execFileSync('mkfifo', [fifo])
    const escritor = spawn('sh', ['-c', 'echo texto > "$0"', fifo], { stdio: 'ignore' })
    try {
      expect(textoDosArquivosDeMensagem('git commit -F fila', pasta)).toBe('')
    } finally {
      escritor.kill() // o escritor espera um leitor para abrir o fifo, e ninguém vai lê-lo
    }
    expect(textoDosArquivosDeMensagem('git commit -m "x"', pasta)).toBe('')
  })

  it('a linha Fora do processo: é negada no comando e no arquivo, e a menção no meio de uma linha do arquivo passa', () => {
    expect(bloqueioDoForaDoProcesso('git commit -m "x"', '')).toBeNull()
    expect(bloqueioDoForaDoProcesso('git commit -m "x\n\nFora do processo: ajuste"', '')).toMatch(/essa linha é só do Joaquim.*git commit -F <arquivo>/)
    expect(bloqueioDoForaDoProcesso('git commit -m "x\n\nFORA DO PROCESSO: ajuste"', '')).toMatch(/essa linha é só do Joaquim/)
    // No comando vale o termo em qualquer lugar, não só no começo de uma linha: dentro de `-m "…"` não se separa linha de menção.
    expect(bloqueioDoForaDoProcesso('git commit -m "Recusa a linha Fora do processo: em papel"', '')).toMatch(/essa linha é só do Joaquim.*git commit -F <arquivo>/)
    const doArquivo = bloqueioDoForaDoProcesso('git commit -F msg.txt', 'x\n\nFora do processo: ajuste\n')
    expect(doArquivo).toMatch(/essa linha é só do Joaquim/)
    expect(doArquivo).not.toMatch(/git commit -F <arquivo>/)
    expect(bloqueioDoForaDoProcesso('git commit -F msg.txt', 'x\n\nfora do processo: ajuste\n')).toMatch(/essa linha é só do Joaquim/)
    expect(bloqueioDoForaDoProcesso('git commit -F msg.txt', 'Recusa a linha Fora do processo: nos commits de papel\n')).toBeNull()
  })

  /** Uma árvore com a mensagem em arquivo, e outra árvore (de outro repositório) com a mensagem do commit que ela recebe por `-C`. */
  function arvoreComMensagens() {
    const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, stdio: 'pipe' })
    const raiz = mkdtempSync(join(tmpdir(), 'mensagem-raiz-'))
    const outra = mkdtempSync(join(tmpdir(), 'mensagem-outra-'))
    git(raiz, 'init', '-q')
    git(outra, 'init', '-q')
    writeFileSync(join(raiz, 'com-a-linha.txt'), 'Corrige x\n\nFora do processo: ajuste do Joaquim\n')
    writeFileSync(join(raiz, 'com-a-mencao.txt'), 'Recusa a linha Fora do processo: nos commits de papel\n')
    writeFileSync(join(raiz, 'com-o-desvio.txt'), 'Explica que --no-verify e CLAUDE_CODE_AGENT= são barrados\n')
    // Só na outra árvore: ler da pasta errada (a da sessão) não acha o arquivo e deixa o commit passar.
    writeFileSync(join(outra, 'so-na-outra.txt'), 'Corrige x\n\nFora do processo: ajuste do Joaquim\n')
    return { raiz, outra }
  }

  it.each(['', 'implementador'])('portao, com o papel "%s": nega a linha no -m e nos arquivos de -F, e deixa passar o resto', (papel) => {
    const { raiz, outra } = arvoreComMensagens()
    const decidir = (command: string, cwd?: string) => portao({ tool_input: { command }, ...(cwd ? { cwd } : {}) }, raiz, papel)
    expect(decidir('git commit -m "x\n\nFora do processo: ajuste"')).toMatch(/Commit bloqueado: a mensagem traz "Fora do processo:".*git commit -F <arquivo>/)
    for (const forma of ['git commit -F com-a-linha.txt', 'git commit -Fcom-a-linha.txt', 'git commit --file=com-a-linha.txt', 'git commit --file com-a-linha.txt']) {
      const motivo = decidir(forma)
      expect(motivo, forma).toMatch(/Commit bloqueado: a mensagem traz "Fora do processo:"/)
      expect(motivo, forma).not.toMatch(/git commit -F <arquivo>/)
    }
    // O arquivo vale a partir da pasta em que o commit roda: o -C da outra árvore, e o cwd da sessão.
    expect(decidir(`git -C ${outra} commit -F so-na-outra.txt`)).toMatch(/Fora do processo:/)
    expect(decidir('git commit -F com-a-linha.txt', raiz)).toMatch(/Fora do processo:/)
    // O cwd do comando é a pasta do commit: `so-na-outra.txt` só existe na `outra`, e a raiz da sessão é a `raiz`.
    expect(decidir('git commit -F so-na-outra.txt', outra)).toMatch(/Fora do processo:/)
    expect(decidir('git commit -F so-na-outra.txt')).toBeNull()
    // A menção no meio da linha, e o `--no-verify` dentro do arquivo, passam: o hook lê a linha, e o desvio é o do comando.
    expect(decidir('git commit -F com-a-mencao.txt')).toBeNull()
    expect(decidir('git commit -F com-o-desvio.txt')).toBeNull()
    expect(decidir('git commit -F nao-existe.txt')).toBeNull()
  })

  it('a marca e a linha de revisões vêm do arquivo de -F, como vinham do -m', () => {
    const { raiz } = arvoreComMensagens()
    mkdirSync(join(raiz, 'tasks/prd-exemplo'), { recursive: true })
    writeFileSync(join(raiz, 'tasks/prd-exemplo/9_task.md'), TAREFA)
    mkdirSync(join(raiz, 'apps'), { recursive: true })
    writeFileSync(join(raiz, 'apps/codigo.ts'), 'export const a = 1\n')
    writeFileSync(join(raiz, 'da-tarefa.txt'), 'Implementa x (tarefa 9.0)\n\nRevisões: ok\n')
    const comando = (command: string) => ({ tool_input: { command } })
    // Sem a marca no comando, o commit de código só passava pela marca; agora o arquivo a traz, e a decisão segue para os revisores.
    expect(portao(comando('git add -A && git commit -F da-tarefa.txt'), raiz, '')).toMatch(/revisões de tasks\/prd-exemplo\/9_task\.md incompletas/)
    expect(portao(comando('git add -A && git commit -F com-a-mencao.txt'), raiz, '')).toMatch(/leva código \(apps\/codigo\.ts\) sem "\(tarefa N\.0\)"/)
  })
})

describe('decidirCommit e portao decidem igual (RF14)', () => {
  const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, stdio: 'pipe' })
  const DOCUMENTO = 'tasks/prd-exemplo/9_task.md'
  const REVISORES = ['infra-guardian', 'tenancy-guardian', 'privacy-guardian', 'conformidade-reviewer', 'test-engineer', 'revisor-geral']

  /** Uma árvore com a tarefa 9.0 revisada por todos às 10:05, o código salvo às 09:00 e o portão local carimbado às 09:59:30. */
  function arvoreRevisada() {
    const raiz = mkdtempSync(join(tmpdir(), 'paridade-'))
    git(raiz, 'init', '-q')
    mkdirSync(join(raiz, 'tasks/prd-exemplo'), { recursive: true })
    mkdirSync(join(raiz, 'apps'), { recursive: true })
    const revisada = tarefaCom(...REVISORES.map((revisor) => rodada(revisor, 'APROVADO', '2026-09-13 10:00:00', '2026-09-13 10:05:00')))
    writeFileSync(join(raiz, DOCUMENTO), revisada.replace(', `frontend-reviewer`', ''))
    writeFileSync(join(raiz, 'apps/codigo.ts'), 'export const a = 1\n')
    writeFileSync(join(raiz, 'docs.md'), 'texto\n')
    utimesSync(join(raiz, 'apps/codigo.ts'), new Date('2026-09-13T09:00:00'), new Date('2026-09-13T09:00:00'))
    gravarCarimbo(raiz, { inicio: new Date('2026-09-13T09:59:30').toISOString(), suites: ['typecheck', 'lint', 'segredo', 'dependencias', 'test'] })
    return raiz
  }

  /** Pelas duas entradas, com o que o comando levaria: tudo o que está alterado. */
  function pelasDuas(raiz: string, mensagem: string, conferencia?: Parameters<typeof portao>[3], conteudoDe = conteudoDoDisco(raiz)) {
    const comando = `git add -A && git commit -m "${mensagem}"`
    return {
      peloPortao: portao({ tool_input: { command: comando } }, raiz, '', conferencia),
      peloHook: decidirCommit({ mensagem: comando, arquivos: arquivosAlterados(raiz), conteudoDe, raiz, papel: '' }, conferencia),
    }
  }

  it('passam os dois, ou bloqueiam os dois com o mesmo motivo', () => {
    const raiz = arvoreRevisada()
    const marca = 'Implementa x (tarefa 9.0)\n\nRevisões: ok'
    const verde = pelasDuas(raiz, marca)
    expect(verde.peloPortao).toBeNull()
    expect(verde.peloHook).toBeNull()

    const semLinha = pelasDuas(raiz, 'Implementa x (tarefa 9.0)')
    expect(semLinha.peloPortao).toMatch(/A mensagem do commit precisa da linha de revisões/)
    expect(semLinha.peloHook).toBe(semLinha.peloPortao)

    const codigoSemMarca = pelasDuas(raiz, 'Ajusta x')
    expect(codigoSemMarca.peloPortao).toMatch(/leva código \(apps\/codigo\.ts\) sem "\(tarefa N\.0\)"/)
    expect(codigoSemMarca.peloHook).toBe(codigoSemMarca.peloPortao)

    const semDocumento = pelasDuas(raiz, 'Corrige x (correção 2026-09-13-x)')
    expect(semDocumento.peloPortao).toMatch(/não tem tasks\/correcoes\/2026-09-13-x\.md/)
    expect(semDocumento.peloHook).toBe(semDocumento.peloPortao)

    const conferencia = () => 'portão local: as mutações não foram conferidas'
    const comConferencia = pelasDuas(raiz, marca, conferencia)
    expect(comConferencia.peloPortao).toMatch(/revisões de tasks\/prd-exemplo\/9_task\.md incompletas\.\n- portão local: as mutações não foram conferidas$/)
    expect(comConferencia.peloHook).toBe(comConferencia.peloPortao)
  })

  it('o veto e o carimbo que não vale bloqueiam igual nas duas entradas', () => {
    const raiz = arvoreRevisada()
    const marca = 'Implementa x (tarefa 9.0)\n\nRevisões: ok'
    writeFileSync(join(raiz, DOCUMENTO), acrescentarRevisao(readFileSync(join(raiz, DOCUMENTO), 'utf8'), rodada('tenancy-guardian', 'REPROVADO', '2026-09-13 10:20:00')))
    const reprovado = pelasDuas(raiz, marca)
    expect(reprovado.peloPortao).toMatch(/tenancy-guardian: a última rodada \(2ª/)
    expect(reprovado.peloHook).toBe(reprovado.peloPortao)

    rmSync(join(raiz, '.processo/portao.json'))
    const semCarimbo = pelasDuas(raiz, marca)
    expect(semCarimbo.peloPortao).toMatch(/portão local: nunca passou/)
    expect(semCarimbo.peloHook).toBe(semCarimbo.peloPortao)
  })

  it('o revisor obrigatório sem rodada bloqueia igual nas duas entradas', () => {
    const raiz = arvoreRevisada()
    const semTestEngineer = tarefaCom(...REVISORES.filter((revisor) => revisor !== 'test-engineer').map((revisor) => rodada(revisor, 'APROVADO', '2026-09-13 10:00:00', '2026-09-13 10:05:00')))
    writeFileSync(join(raiz, DOCUMENTO), semTestEngineer.replace(', `frontend-reviewer`', ''))
    const sem = pelasDuas(raiz, 'Implementa x (tarefa 9.0)\n\nRevisões: ok')
    expect(sem.peloPortao).toMatch(/test-engineer: nenhuma rodada/)
    expect(sem.peloHook).toBe(sem.peloPortao)
  })

  it('o documento que a entrada não consegue ler bloqueia, e diz qual', () => {
    const raiz = arvoreRevisada()
    // Só o `peloHook` é conferido: o `portao` monta o `conteudoDe` do disco e sempre acha o documento, e a entrada que não o lê é a do git hook.
    const semDocumento = pelasDuas(raiz, 'Implementa x (tarefa 9.0)\n\nRevisões: ok', undefined, () => null)
    expect(semDocumento.peloHook).toBe(`Commit bloqueado: não achei ${DOCUMENTO} para conferir as revisões.`)
  })

  it('o que o commit leva decide se há código; os alterados da árvore decidem a caducidade e a conferência', () => {
    const raiz = arvoreRevisada()
    const conteudoDe = conteudoDoDisco(raiz)
    const marca = 'Implementa x (tarefa 9.0)\n\nRevisões: ok'
    // O código muda às 10:30, depois da rodada. O commit leva só o documento: sem `alterados`, a caducidade não o vê.
    writeFileSync(join(raiz, 'apps/codigo.ts'), 'export const a = 2\n')
    utimesSync(join(raiz, 'apps/codigo.ts'), new Date('2026-09-13T10:30:00'), new Date('2026-09-13T10:30:00'))
    const base = { mensagem: marca, conteudoDe, raiz, papel: undefined }
    expect(decidirCommit({ ...base, arquivos: [DOCUMENTO] })).toBeNull()
    expect(decidirCommit({ ...base, arquivos: [DOCUMENTO], alterados: ['apps/codigo.ts'] })).toMatch(/infra-guardian: apps\/codigo\.ts mudou/)
    // Sem marca, quem decide se há código é o que o commit leva, e não o que a árvore tem alterado.
    expect(decidirCommit({ ...base, mensagem: 'Atualiza o texto', arquivos: ['docs.md'], alterados: ['apps/codigo.ts'] })).toBeNull()
    expect(decidirCommit({ ...base, mensagem: 'Atualiza o texto', arquivos: ['apps/codigo.ts'], alterados: ['docs.md'] })).toMatch(/leva código \(apps\/codigo\.ts\)/)
    // Sem `alterados`, valem os arquivos do commit, e a conferência recebe o mesmo conjunto.
    expect(decidirCommit({ ...base, arquivos: ['apps/codigo.ts'] })).toMatch(/infra-guardian: apps\/codigo\.ts mudou/)
    const vistos: string[][] = []
    decidirCommit({ ...base, arquivos: [DOCUMENTO], alterados: ['apps/codigo.ts', 'docs.md'] }, (_carimbo, _documento, _conteudo, arquivos) => (vistos.push(arquivos), null))
    decidirCommit({ ...base, arquivos: [DOCUMENTO] }, (_carimbo, _documento, _conteudo, arquivos) => (vistos.push(arquivos), null))
    expect(vistos).toEqual([['apps/codigo.ts', 'docs.md'], [DOCUMENTO]])
  })

  it('o conteúdo do disco: o arquivo que existe, e null para o que não existe', () => {
    const raiz = arvoreRevisada()
    expect(conteudoDoDisco(raiz)('docs.md', 'indice')).toBe('texto\n')
    expect(conteudoDoDisco(raiz)('nao-existe.md', 'indice')).toBeNull()
    // Uma pasta não é arquivo: devolve null em vez de lançar.
    expect(conteudoDoDisco(raiz)('tasks', 'indice')).toBeNull()
  })
})

describe('RF15: o commit exige o guardião que o caminho pede', () => {
  const DOCUMENTO = 'tasks/prd-exemplo/9_task.md'
  const MARCA = 'Implementa x (tarefa 9.0)\n\nRevisões: ok'
  const SEMPRE = ['test-engineer', 'revisor-geral']
  const GUARDIOES = ['tenancy-guardian', 'privacy-guardian', 'conformidade-reviewer', 'infra-guardian']
  const REPOSITORY = 'apps/api/src/pedidos/pedidos.repository.ts'

  /** Uma árvore com a tarefa 9.0 que marca só `marcados`, revisada às 10:05 por `revisados`, o código salvo às 09:00 e o portão carimbado às 09:59:30. */
  function arvore(marcados: string[], revisados: string[], arquivos: Record<string, string> = { [REPOSITORY]: 'export const a = 1\n' }) {
    const raiz = mkdtempSync(join(tmpdir(), 'guardioes-'))
    execFileSync('git', ['init', '-q'], { cwd: raiz, stdio: 'pipe' })
    mkdirSync(join(raiz, 'tasks/prd-exemplo'), { recursive: true })
    const documento = TAREFA.replace(/\*\*Subagentes obrigatórios:\*\*.*/, `**Subagentes obrigatórios:** ${marcados.map((nome) => `\`${nome}\``).join(', ')}`)
    const revisada = revisados.reduce((conteudo, revisor) => acrescentarRevisao(conteudo, rodada(revisor, 'APROVADO', '2026-09-13 10:00:00', '2026-09-13 10:05:00')), documento)
    writeFileSync(join(raiz, DOCUMENTO), revisada)
    for (const [arquivo, texto] of Object.entries(arquivos)) {
      mkdirSync(join(raiz, dirname(arquivo)), { recursive: true })
      writeFileSync(join(raiz, arquivo), texto)
      utimesSync(join(raiz, arquivo), new Date('2026-09-13T09:00:00'), new Date('2026-09-13T09:00:00'))
    }
    gravarCarimbo(raiz, { inicio: new Date('2026-09-13T09:59:30').toISOString(), suites: ['typecheck', 'lint', 'segredo', 'dependencias', 'test'] })
    return raiz
  }

  /** O commit da tarefa, levando `arquivos`. O conteúdo vem do disco, e o do HEAD de `doHead` (o repositório do teste não tem commit). */
  function decidir(raiz: string, arquivos: string[], doHead: (arquivo: string) => string | null = () => null, alterados?: string[]) {
    const doDisco = conteudoDoDisco(raiz)
    return decidirCommit({ mensagem: MARCA, arquivos, ...(alterados ? { alterados } : {}), conteudoDe: (arquivo, onde) => (onde === 'head' ? doHead(arquivo) : doDisco(arquivo, 'indice')), raiz, papel: '' })
  }

  it('repository alterado sem tenancy-guardian marcado e sem rodada dele é recusado; com a rodada APROVADO, passa', () => {
    const semRodada = arvore([], [...SEMPRE, 'privacy-guardian', 'conformidade-reviewer', 'infra-guardian'])
    const recusa = decidir(semRodada, [REPOSITORY])
    expect(recusa).toMatch(/^Commit bloqueado: revisões de tasks\/prd-exemplo\/9_task\.md incompletas\.\n- tenancy-guardian: nenhuma rodada registrada/)
    expect(recusa).not.toMatch(/privacy-guardian|conformidade-reviewer|infra-guardian|test-engineer|revisor-geral/)

    const comRodada = arvore([], [...SEMPRE, ...GUARDIOES])
    expect(decidir(comRodada, [REPOSITORY])).toBeNull()
  })

  it.each(GUARDIOES)('código de apps/ sem a rodada do %s é recusado, e só por ele', (faltante) => {
    const raiz = arvore([], [...SEMPRE, ...GUARDIOES.filter((guardiao) => guardiao !== faltante)])
    const recusa = decidir(raiz, [REPOSITORY])
    expect(recusa).toContain(`- ${faltante}: nenhuma rodada registrada`)
    expect(recusa?.match(/nenhuma rodada registrada/g)).toHaveLength(1)
  })

  it('o veto do guardião do caminho também vale: a última rodada reprovada recusa', () => {
    const raiz = arvore([], [...SEMPRE, ...GUARDIOES])
    writeFileSync(join(raiz, DOCUMENTO), acrescentarRevisao(readFileSync(join(raiz, DOCUMENTO), 'utf8'), rodada('privacy-guardian', 'REPROVADO', '2026-09-13 10:20:00')))
    expect(decidir(raiz, [REPOSITORY])).toMatch(/- privacy-guardian: a última rodada \(2ª/)
  })

  it('marcado e não pedido pelo caminho continua obrigatório', () => {
    // O commit leva só o documento e uma exceção sem guardião (`tema.ts`): o caminho não pede ninguém, e o Arquiteto marcou `infra-guardian`.
    const arquivos = { 'apps/web/src/theme.ts': 'export const a = 1\n' }
    const semRodada = arvore(['infra-guardian'], SEMPRE, arquivos)
    expect(decidir(semRodada, [DOCUMENTO, 'apps/web/src/theme.ts'])).toMatch(/- infra-guardian: nenhuma rodada registrada/)
    expect(decidir(semRodada, [DOCUMENTO])).toMatch(/- infra-guardian: nenhuma rodada registrada/)
    const comRodada = arvore(['infra-guardian'], [...SEMPRE, 'infra-guardian'], arquivos)
    expect(decidir(comRodada, [DOCUMENTO, 'apps/web/src/theme.ts'])).toBeNull()
  })

  it('a exceção não pede guardião, e a citação da regra no índice ou no HEAD o pede', () => {
    const raiz = arvore([], SEMPRE, { 'apps/web/src/theme.ts': 'export const a = 1\n' })
    expect(decidir(raiz, ['apps/web/src/theme.ts'])).toBeNull()
    // Citando "regra 70" no disco (o índice do `PreToolUse`).
    writeFileSync(join(raiz, 'apps/web/src/theme.ts'), '// regra 70\nexport const a = 1\n')
    utimesSync(join(raiz, 'apps/web/src/theme.ts'), new Date('2026-09-13T09:00:00'), new Date('2026-09-13T09:00:00'))
    expect(decidir(raiz, ['apps/web/src/theme.ts'])).toMatch(/- conformidade-reviewer: nenhuma rodada registrada/)
    // Citava "regra 20" no HEAD e não cita mais: o guardião continua pedido.
    writeFileSync(join(raiz, 'apps/web/src/theme.ts'), 'export const a = 1\n')
    utimesSync(join(raiz, 'apps/web/src/theme.ts'), new Date('2026-09-13T09:00:00'), new Date('2026-09-13T09:00:00'))
    expect(decidir(raiz, ['apps/web/src/theme.ts'], () => '// regra 20\n')).toMatch(/- privacy-guardian: nenhuma rodada registrada/)
  })

  it('o commit que não leva código não pede guardião, ainda que a árvore tenha', () => {
    const raiz = arvore([], SEMPRE)
    expect(decidir(raiz, [DOCUMENTO])).toBeNull()
    // O código alterado na árvore e fora do commit não pede o guardião: o commit pede o de quem ele leva.
    expect(decidir(raiz, [DOCUMENTO], () => null, [REPOSITORY])).toBeNull()
    expect(decidir(raiz, [DOCUMENTO, REPOSITORY], () => null, [REPOSITORY])).toMatch(/- tenancy-guardian: nenhuma rodada registrada/)
  })

  it('o arquivo movido no índice traz os dois caminhos, o de origem e o de destino', () => {
    const raiz = arvore([], SEMPRE, { 'apps/api/src/x.repository.ts': 'export const a = 1\n' })
    const git = (...args: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: raiz, stdio: 'pipe' })
    git('add', 'apps')
    git('commit', '-q', '-m', 'base')
    mkdirSync(join(raiz, 'apps/web/src/gallery'), { recursive: true })
    git('mv', 'apps/api/src/x.repository.ts', 'apps/web/src/gallery/x.tsx')
    expect(arquivosPreparados(raiz).sort()).toEqual(['apps/api/src/x.repository.ts', 'apps/web/src/gallery/x.tsx'])
  })

  describe('com um merge em curso, a conta é a do git hook: só o que diverge dos dois lados', () => {
    /** `main` tem `apps/comum.ts` mudado no fim e `outra` o muda no começo e traz `apps/outro.ts`: o merge é limpo e fica por concluir. */
    function mergePorConcluir() {
      const raiz = arvore([], SEMPRE, { 'apps/comum.ts': 'a\n1\n2\n3\n4\n5\n6\n7\n8\nb\n' })
      const git = (...args: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: raiz, stdio: 'pipe' })
      git('add', 'apps')
      git('commit', '-q', '-m', 'base')
      git('checkout', '-q', '-b', 'outra')
      writeFileSync(join(raiz, 'apps/comum.ts'), 'A\n1\n2\n3\n4\n5\n6\n7\n8\nb\n')
      writeFileSync(join(raiz, 'apps/outro.ts'), 'export const b = 1\n')
      git('add', 'apps')
      git('commit', '-q', '-m', 'outra linha')
      git('checkout', '-q', '-')
      writeFileSync(join(raiz, 'apps/comum.ts'), 'a\n1\n2\n3\n4\n5\n6\n7\n8\nB\n')
      git('add', 'apps')
      git('commit', '-q', '-m', 'esta linha')
      git('merge', '--no-commit', '--no-ff', 'outra')
      return raiz
    }

    it('o arquivo que só veio do outro lado não conta, e o que as duas linhas tocaram conta', () => {
      const raiz = mergePorConcluir()
      expect(arquivosPreparados(raiz)).toEqual(['apps/comum.ts'])
    })

    it('o portão do PreToolUse cobra só o que as duas linhas tocaram, e não o que veio do outro lado', () => {
      const raiz = mergePorConcluir()
      // Sem o merge em curso, `apps/outro.ts` e `apps/comum.ts` seriam código sem marca; com ele, só `apps/comum.ts` é do commit.
      const decisao = portao({ tool_input: { command: 'git commit -m "Traz a outra linha"' } }, raiz, 'implementador')
      expect(decisao).toMatch(/apps\/comum\.ts/)
      expect(decisao).not.toMatch(/apps\/outro\.ts/)
    })

    it('o conflito resolvido à mão num repository segue cobrando o tenancy-guardian no PreToolUse, e o que veio só do outro lado não', () => {
      const raiz = arvore([], SEMPRE, { [REPOSITORY]: 'export const a = 1\n' })
      const git = (...args: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: raiz, stdio: 'pipe' })
      git('add', 'apps')
      git('commit', '-q', '-m', 'base')
      git('checkout', '-q', '-b', 'outra')
      writeFileSync(join(raiz, REPOSITORY), 'export const a = 2\n')
      writeFileSync(join(raiz, 'apps/outro.ts'), 'export const b = 1\n')
      git('add', 'apps')
      git('commit', '-q', '-m', 'outra linha')
      git('checkout', '-q', '-')
      writeFileSync(join(raiz, REPOSITORY), 'export const a = 3\n')
      git('add', 'apps')
      git('commit', '-q', '-m', 'esta linha')
      expect(() => git('merge', '--no-commit', '--no-ff', 'outra')).toThrow()
      // O conflito resolvido à mão, salvo antes da rodada (09:00) para a rodada valer.
      writeFileSync(join(raiz, REPOSITORY), 'export const a = 4\n')
      utimesSync(join(raiz, REPOSITORY), new Date('2026-09-13T09:00:00'), new Date('2026-09-13T09:00:00'))
      git('add', REPOSITORY)
      const decisao = portao({ tool_input: { command: `git commit -m "${MARCA}"` } }, raiz, 'implementador')
      expect(decisao).toMatch(/- tenancy-guardian: nenhuma rodada registrada/)
      expect(decisao).not.toMatch(/apps\/outro\.ts/)
    })
  })

  it('o conteúdo do HEAD, lido do git de verdade, e o do disco são lidos de onde o nome diz', () => {
    const grande = 'x'.repeat(2_000_000)
    const raiz = arvore([], SEMPRE, { 'docs.md': 'no HEAD\n', 'grande.txt': grande })
    const git = (...args: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: raiz, stdio: 'pipe' })
    expect(conteudoDoDisco(raiz)('docs.md', 'head')).toBeNull()
    git('add', 'docs.md', 'grande.txt')
    git('commit', '-q', '-m', 'base')
    // Três versões: a do HEAD, a do índice e a do disco. O HEAD não é o índice, e o índice não é o disco.
    writeFileSync(join(raiz, 'docs.md'), 'no índice\n')
    git('add', 'docs.md')
    writeFileSync(join(raiz, 'docs.md'), 'no disco\n')
    expect(conteudoDoDisco(raiz)('docs.md', 'head')).toBe('no HEAD\n')
    expect(conteudoDoDisco(raiz)('docs.md', 'indice')).toBe('no disco\n')
    expect(conteudoDoDisco(raiz)('nao-existe.md', 'head')).toBeNull()
    // Arquivo maior que o padrão do Node (1 MB) é lido inteiro: o que não coubesse deixaria a citação sem ser vista.
    expect(conteudoDoDisco(raiz)('grande.txt', 'head')).toBe(grande)
  })

  it('o portão imprime a lista unida: os marcados, os de toda tarefa e os do caminho, sem repetir', () => {
    const conteudo = arvoreMarcando('`tenancy-guardian`, `frontend-reviewer`')
    const conteudoDe = () => 'export const a = 1\n'
    expect(obrigatoriosDoCommit(conteudo, 'tarefa', [REPOSITORY], conteudoDe)).toEqual([
      'tenancy-guardian',
      'frontend-reviewer',
      'test-engineer',
      'revisor-geral',
      'privacy-guardian',
      'conformidade-reviewer',
      'infra-guardian',
    ])
    expect(obrigatoriosDoCommit(conteudo, 'tarefa', ['docs/x.md'], conteudoDe)).toEqual(['tenancy-guardian', 'frontend-reviewer', 'test-engineer', 'revisor-geral'])
    expect(linhaDosObrigatorios(['tenancy-guardian', 'test-engineer'])).toBe('Revisores obrigatórios: tenancy-guardian, test-engineer')

    function arvoreMarcando(marcados: string): string {
      return TAREFA.replace(/\*\*Subagentes obrigatórios:\*\*.*/, `**Subagentes obrigatórios:** ${marcados}`)
    }
  })
})

describe('RF16: o código de processo exige revisão, só em sessão de papel', () => {
  const DOCUMENTO = 'tasks/prd-exemplo/9_task.md'
  const CORRECAO = 'tasks/correcoes/2026-09-13-x.md'
  const MARCA = 'Implementa x (tarefa 9.0)\n\nRevisões: ok'
  const SEMPRE = ['test-engineer', 'revisor-geral']
  const OS_QUATRO = ['tenancy-guardian', 'privacy-guardian', 'conformidade-reviewer', 'infra-guardian']
  const TEXTO = 'export const a = 1\n'

  /** O código de produto: conta em toda sessão, com ou sem papel. */
  const DE_PRODUTO = (arquivo: string) => ['apps/', 'packages/', 'infra/', 'e2e/'].some((pasta) => arquivo.startsWith(pasta))
  const escapar = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  /** Uma árvore com os `arquivos` salvos às 09:00, o portão carimbado às 09:59:30 e o documento (tarefa 9.0 ou correção) revisado às 10:05 pelos `revisados`. */
  function arvore(arquivos: string[], revisados: string[] = [], marcados: string[] = [], tipo: 'tarefa' | 'correcao' = 'tarefa') {
    const raiz = mkdtempSync(join(tmpdir(), 'rf16-'))
    execFileSync('git', ['init', '-q'], { cwd: raiz, stdio: 'pipe' })
    const caminho = tipo === 'tarefa' ? DOCUMENTO : CORRECAO
    mkdirSync(join(raiz, dirname(caminho)), { recursive: true })
    const linha = `**Subagentes obrigatórios:** ${marcados.map((nome) => `\`${nome}\``).join(', ')}`
    const base = tipo === 'tarefa' ? TAREFA.replace(/\*\*Subagentes obrigatórios:\*\*.*/, linha) : `# Correção\n\n${linha}\n`
    writeFileSync(join(raiz, caminho), revisados.reduce((conteudo, revisor) => acrescentarRevisao(conteudo, rodada(revisor, 'APROVADO', '2026-09-13 10:00:00', '2026-09-13 10:05:00')), base))
    for (const arquivo of arquivos) {
      mkdirSync(join(raiz, dirname(arquivo)), { recursive: true })
      writeFileSync(join(raiz, arquivo), TEXTO)
      utimesSync(join(raiz, arquivo), new Date('2026-09-13T09:00:00'), new Date('2026-09-13T09:00:00'))
    }
    gravarCarimbo(raiz, { inicio: new Date('2026-09-13T09:59:30').toISOString(), suites: ['typecheck', 'lint', 'segredo', 'dependencias', 'test'] })
    return raiz
  }

  /** O commit que leva `arquivos`, com a `mensagem`, na sessão do `papel` ('' é sem papel). */
  const decidir = (raiz: string, arquivos: string[], papel: string | undefined, mensagem = MARCA) =>
    decidirCommit({ mensagem, arquivos, conteudoDe: conteudoDoDisco(raiz), raiz, papel })

  describe('sem tarefa nem correção', () => {
    it.each(CODIGO_PARA_A_ESTEIRA)('em papel, %s é código: recusado', (arquivo) => {
      expect(decidir(arvore([]), [arquivo], 'implementador', 'Ajusta x')).toMatch(new RegExp(`^Commit bloqueado: ele leva código \\(${escapar(arquivo)}\\) sem "\\(tarefa N\\.0\\)"`))
    })

    it.each(DOCUMENTO_PARA_A_ESTEIRA)('em papel, %s é documento: passa', (arquivo) => {
      expect(decidir(arvore([]), [arquivo], 'implementador', 'Ajusta x')).toBeNull()
    })

    it('uma lista só: em papel, a decisão e a esteira contam o mesmo código, em todo papel do time', () => {
      const raiz = arvore([])
      for (const papel of ['arquiteto', 'implementador', 'mesa-de-revisao', 'validador']) {
        for (const arquivo of [...CODIGO_PARA_A_ESTEIRA, ...DOCUMENTO_PARA_A_ESTEIRA]) {
          expect({ arquivo, recusado: decidir(raiz, [arquivo], papel, 'Ajusta x') !== null }).toEqual({ arquivo, recusado: ehCodigoParaAEsteira(arquivo) })
        }
      }
    })

    it('sem papel, o §5(e) passa e só o código de produto é recusado', () => {
      const raiz = arvore([])
      for (const papel of ['', undefined, 'general-purpose']) {
        for (const arquivo of CODIGO_PARA_A_ESTEIRA) {
          const decisao = decidir(raiz, [arquivo], papel, 'Ajusta x')
          if (DE_PRODUTO(arquivo)) expect(decisao, arquivo).toMatch(/leva código/)
          else expect(decisao, arquivo).toBeNull()
        }
      }
    })

    it('o commit do papel que leva um documento e dois arquivos de processo é recusado por eles, e a mensagem os cita', () => {
      expect(decidir(arvore([]), ['docs/guia.md', 'tools/processo/x.ts', 'package.json'], 'implementador', 'Ajusta x')).toMatch(/leva código \(tools\/processo\/x\.ts, package\.json\)/)
    })

    it('pelo PreToolUse: o commit do papel com tools/ é recusado, e o mesmo comando sem papel passa', () => {
      const raiz = arvore(['tools/x.ts'])
      const comando = { tool_input: { command: 'git add tools/x.ts && git commit -m "Ajusta x"' } }
      expect(portao(comando, raiz, 'implementador')).toMatch(/leva código \(tools\/x\.ts\)/)
      expect(portao(comando, raiz, '')).toBeNull()
    })

    it('pelo caminho do hook, o papel vem de CLAUDE_CODE_AGENT: com `implementador` o commit com tools/ é recusado, sem o papel passa', () => {
      const raiz = arvore(['tools/x.ts'])
      const comando = { tool_input: { command: 'git add tools/x.ts && git commit -m "Ajusta x"' } }
      try {
        vi.stubEnv('CLAUDE_CODE_AGENT', 'implementador')
        expect(portao(comando, raiz)).toMatch(/leva código \(tools\/x\.ts\)/)
        vi.stubEnv('CLAUDE_CODE_AGENT', '')
        expect(portao(comando, raiz)).toBeNull()
      } finally {
        vi.unstubAllEnvs()
      }
    })
  })

  describe('com tarefa ou correção', () => {
    /** Cada linha da tabela do RF16: o arquivo e o conjunto exato que ela pede (o conjunto também vive, por caminho, em `harness/guardioes.test.ts`). */
    const TABELA: [string, string[]][] = [
      ['tools/processo/guardioes-por-caminho.ts', OS_QUATRO],
      ['tools/processo/portao.ts', OS_QUATRO],
      ['tools/processo/caducidade.ts', OS_QUATRO],
      ['tools/processo/documento-de-revisao.ts', OS_QUATRO],
      ['tools/processo/revisoes.ts', OS_QUATRO],
      ['tools/processo/hook-revisoes.ts', OS_QUATRO],
      ['tools/processo/comando-git.ts', OS_QUATRO],
      ['tools/processo/hook-git.ts', OS_QUATRO],
      ['tools/processo/git-hooks/commit-msg', OS_QUATRO],
      ['tools/processo/harness/guardioes.test.ts', OS_QUATRO],
      ['tools/ci/conferir-entregas.ts', OS_QUATRO],
      ['.claude/settings.json', OS_QUATRO],
      ['.claude/settings.local.json', OS_QUATRO],
      ['eslint.config.mjs', OS_QUATRO],
      ['eslint-suppressions.json', OS_QUATRO],
      ['tools/vitrine/escola.ts', ['privacy-guardian', 'conformidade-reviewer']],
      ['tools/ia/medir-risco-a-vida.ts', ['privacy-guardian', 'conformidade-reviewer']],
      ['docs/aia/ouro/x.json', ['conformidade-reviewer']],
      ['docs/aia/ouro-retido/x.json', ['conformidade-reviewer']],
      ['tools/ci/compose.ts', ['infra-guardian']],
      ['tools/ci/borda.test.ts', ['infra-guardian', 'privacy-guardian']],
      ['.github/workflows/ci.yml', ['infra-guardian', 'privacy-guardian']],
      ['playwright.config.ts', ['privacy-guardian']],
      ['compose.yaml', ['infra-guardian']],
      ['.env.example', ['infra-guardian']],
      ['tools/guardas/index.mjs', OS_QUATRO],
      ['infra/Caddyfile', ['privacy-guardian', 'infra-guardian']],
      ['infra/k6/x.js', ['infra-guardian', 'privacy-guardian']],
    ]

    it.each(TABELA)('%s: sem qualquer um dos guardiões da linha, recusado; com todos, e só eles, aceito', (arquivo, guardioes) => {
      for (const faltante of guardioes) {
        const raiz = arvore([arquivo], [...SEMPRE, ...guardioes.filter((guardiao) => guardiao !== faltante)])
        const recusa = decidir(raiz, [DOCUMENTO, arquivo], 'implementador')
        expect(recusa, `sem ${faltante}`).toContain(`- ${faltante}: nenhuma rodada registrada`)
        expect(recusa?.match(/nenhuma rodada registrada/g), `sem ${faltante}`).toHaveLength(1)
      }
      // Os da linha e mais nenhum: o guardião de fora da linha não é cobrado.
      expect(decidir(arvore([arquivo], [...SEMPRE, ...guardioes]), [DOCUMENTO, arquivo], 'implementador')).toBeNull()
    })

    it('o resto do §5(e) pede só os de toda tarefa: sem guardião com veto, aceito', () => {
      for (const arquivo of ['tools/processo/linhas.ts', '.claude/hooks/x.sh', 'package.json', 'vitest.config.ts', 'tsconfig.base.json', 'knip.json', '.gitleaks.toml', '.size-limit.json']) {
        expect(decidir(arvore([arquivo], SEMPRE), [DOCUMENTO, arquivo], 'implementador'), arquivo).toBeNull()
      }
    })

    it('entre as linhas: eslint sem tenancy, ouro sem conformidade, hook-git sem os quatro, borda sem privacy, guardas sem privacy', () => {
      const sem = (arquivo: string, ...faltantes: string[]) =>
        decidir(arvore([arquivo], [...SEMPRE, ...OS_QUATRO.filter((guardiao) => !faltantes.includes(guardiao))]), [DOCUMENTO, arquivo], 'implementador')
      expect(sem('eslint.config.mjs', 'tenancy-guardian')).toContain('- tenancy-guardian: nenhuma rodada')
      expect(sem('docs/aia/ouro/x.json', 'conformidade-reviewer')).toContain('- conformidade-reviewer: nenhuma rodada')
      expect(sem('tools/processo/hook-git.ts', ...OS_QUATRO)?.match(/nenhuma rodada registrada/g)).toHaveLength(4)
      expect(sem('tools/ci/borda.test.ts', 'privacy-guardian')).toContain('- privacy-guardian: nenhuma rodada')
      // `tools/guardas/` é o padrão (os quatro), e não o resto de `tools/`.
      expect(sem('tools/guardas/index.mjs', 'privacy-guardian')).toContain('- privacy-guardian: nenhuma rodada')
    })

    it('`infra/Caddyfile` sem privacy-guardian é recusado com e sem papel; `infra/k6/x.js` com infra-guardian e privacy-guardian passa', () => {
      for (const papel of ['implementador', '']) {
        const sem = arvore(['infra/Caddyfile'], [...SEMPRE, 'infra-guardian'])
        expect(decidir(sem, [DOCUMENTO, 'infra/Caddyfile'], papel)).toContain('- privacy-guardian: nenhuma rodada registrada')
        const com = arvore(['infra/k6/x.js'], [...SEMPRE, 'infra-guardian', 'privacy-guardian'])
        expect(decidir(com, [DOCUMENTO, 'infra/k6/x.js'], papel)).toBeNull()
      }
    })

    it('sem papel, o commit de tarefa com um arquivo do §5(e) cobra o guardião da linha dele do mesmo jeito', () => {
      const raiz = arvore(['eslint.config.mjs'], SEMPRE)
      expect(decidir(raiz, [DOCUMENTO, 'eslint.config.mjs'], '')).toContain('- tenancy-guardian: nenhuma rodada registrada')
    })

    it('a citação da regra soma o guardião também no resto de tools/', () => {
      const raiz = arvore([], SEMPRE)
      mkdirSync(join(raiz, 'tools/processo'), { recursive: true })
      writeFileSync(join(raiz, 'tools/processo/x.ts'), '// regra 20: o log leva só o id\nexport const a = 1\n')
      expect(decidir(raiz, [DOCUMENTO, 'tools/processo/x.ts'], 'implementador')).toContain('- privacy-guardian: nenhuma rodada registrada')
    })

    describe('a correção que leva código de processo exige o revisor-geral, marcado ou não', () => {
      const mensagem = 'Corrige x (correção 2026-09-13-x)\n\nRevisões: ok'
      /** O documento da correção marca só os guardiões, e nunca o `revisor-geral`: quem o cobra é o código. */
      const correcao = (arquivo: string, revisados: string[]) => arvore([arquivo], revisados, OS_QUATRO, 'correcao')

      it('sem a rodada do revisor-geral, recusada, e só por ele; com ela, aceita', () => {
        const sem = correcao('tools/processo/portao.ts', ['test-engineer', ...OS_QUATRO])
        expect(readFileSync(join(sem, CORRECAO), 'utf8')).not.toContain('revisor-geral')
        const recusa = decidir(sem, [CORRECAO, 'tools/processo/portao.ts'], 'implementador', mensagem)
        expect(recusa).toContain('- revisor-geral: nenhuma rodada registrada')
        expect(recusa?.match(/nenhuma rodada registrada/g)).toHaveLength(1)
        const com = correcao('tools/processo/portao.ts', ['test-engineer', 'revisor-geral', ...OS_QUATRO])
        expect(decidir(com, [CORRECAO, 'tools/processo/portao.ts'], 'implementador', mensagem)).toBeNull()
      })

      it.each(['tools/processo/linhas.ts', 'package.json', '.claude/hooks/x.sh', 'docs/aia/ouro/x.json', '.github/workflows/ci.yml', 'eslint.config.mjs'])('%s também o exige, e a sessão não importa', (arquivo) => {
        for (const papel of ['implementador', '']) {
          const sem = correcao(arquivo, ['test-engineer', ...OS_QUATRO])
          expect(decidir(sem, [CORRECAO, arquivo], papel, mensagem), `${arquivo} sem`).toContain('- revisor-geral: nenhuma rodada registrada')
          const com = correcao(arquivo, ['test-engineer', 'revisor-geral', ...OS_QUATRO])
          expect(decidir(com, [CORRECAO, arquivo], papel, mensagem), `${arquivo} com`).toBeNull()
        }
      })

      it('a correção que leva só código de produto não o ganha: continua como estava', () => {
        const raiz = correcao('apps/api/src/x.ts', ['test-engineer', ...OS_QUATRO])
        expect(decidir(raiz, [CORRECAO, 'apps/api/src/x.ts'], 'implementador', mensagem)).toBeNull()
        const infra = correcao('infra/Caddyfile', ['test-engineer', ...OS_QUATRO])
        expect(decidir(infra, [CORRECAO, 'infra/Caddyfile'], 'implementador', mensagem)).toBeNull()
      })

      it('a correção que leva só documento não o ganha, e a tarefa continua com ele sempre', () => {
        const doc = correcao('docs/guia.md', ['test-engineer', ...OS_QUATRO])
        expect(decidir(doc, [CORRECAO, 'docs/guia.md'], 'implementador', mensagem)).toBeNull()
        // O que o portão imprime: a correção de documento sem o revisor-geral; a de processo, com ele; a tarefa, sempre.
        const conteudo = '# Correção\n\n**Subagentes obrigatórios:** `infra-guardian`\n'
        const texto = () => 'export const a = 1\n'
        expect(obrigatoriosDoCommit(conteudo, 'correcao', ['docs/guia.md'], texto)).toEqual(['infra-guardian', 'test-engineer'])
        expect(obrigatoriosDoCommit(conteudo, 'correcao', ['tools/processo/linhas.ts'], texto)).toEqual(['infra-guardian', 'test-engineer', 'revisor-geral'])
        expect(obrigatoriosDoCommit(conteudo, 'tarefa', ['docs/guia.md'], texto)).toEqual(['infra-guardian', 'test-engineer', 'revisor-geral'])
      })
    })
  })
})
