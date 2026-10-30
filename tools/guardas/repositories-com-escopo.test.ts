import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { raizRepositorio } from '../ci/executar.ts'
import { TAMANHO_MINIMO_JUSTIFICATIVA_SEM_ESCOPO } from '../../packages/nucleo/src/db/sem-escopo.decorator.ts'
import {
  analisarFonte,
  lerFontesDeProducao,
  REPOSITORIES_SEM_ESCOPO,
  verificarRepositories,
  type ArquivoFonte,
  type EntradaSemEscopo,
} from './escopo-dos-repositories.ts'

// Cada fixture de `__fixtures__/repositories/` traz, na linha do nome do método (ou da classe) que a trava reprova, a marca
// "reprova: <código>". O teste exige exatamente as marcas: nem método que escapa, nem método certo acusado. Fixture sem marca
// é o jeito certo (ou o limite declarado do analisador), e tem de passar limpa.

const CAMINHO_DE_REPOSITORY = 'apps/api/src/x/x.repository.ts'
const MOTIVO_DE_30 = 'abcdefghijklmnopqrstuvwxyz0123'

function fixture(nome: string, caminho: string = CAMINHO_DE_REPOSITORY): ArquivoFonte {
  return { caminho, texto: readFileSync(join(raizRepositorio, 'tools/guardas/__fixtures__/repositories', nome), 'utf8') }
}

/** `"8 sem-prova-de-escopo"`, uma entrada por marca, em ordem. */
function marcas(texto: string): string[] {
  return texto
    .split('\n')
    .flatMap((linha, indice) => {
      const marca = /reprova: (\S+)\s*$/.exec(linha)
      return marca?.[1] === undefined ? [] : [`${String(indice + 1)} ${marca[1]}`]
    })
    .sort()
}

/** O que a trava acusa na fixture: `"linha código"`, em ordem. */
function acusacoes(fonte: ArquivoFonte, lista: readonly EntradaSemEscopo[] = []): string[] {
  return verificarRepositories([fonte], lista)
    .map((violacao) => `${String(violacao.linha)} ${violacao.codigo}`)
    .sort()
}

/** A fixture reprova exatamente onde diz, e diz em algum lugar. */
function reprovaOndeDiz(nome: string, caminho?: string): void {
  const fonte = fixture(nome, caminho)
  expect(marcas(fonte.texto).length, `a fixture ${nome} perdeu as marcas`).toBeGreaterThan(0)
  expect(acusacoes(fonte)).toEqual(marcas(fonte.texto))
}

/** A fixture não tem marca nenhuma e passa limpa. */
function passaLimpa(nome: string): void {
  const fonte = fixture(nome)
  expect(marcas(fonte.texto), `a fixture ${nome} que devia passar tem marca`).toEqual([])
  expect(acusacoes(fonte)).toEqual([])
}

describe('o analisador enxerga o código real', () => {
  const fontes = lerFontesDeProducao(raizRepositorio)
  const repositories = fontes.filter((fonte) => fonte.caminho.endsWith('.repository.ts'))

  it('acha os repositories de sessao/ e de fila/, e são dezenas', () => {
    const caminhos = repositories.map((fonte) => fonte.caminho)
    expect(caminhos).toContain('apps/api/src/sessao/atividade/alunos-ativos.repository.ts')
    expect(caminhos).toContain('packages/nucleo/src/fila/job-registro.repository.ts')
    expect(repositories.length).toBeGreaterThan(60)
  })

  it('não lê teste, declaração de tipo, build nem node_modules', () => {
    expect(fontes.filter((fonte) => /\.test\.tsx?$|\.d\.ts$|\/dist\/|\/node_modules\//.test(fonte.caminho))).toEqual([])
    expect(fontes.every((fonte) => /^(apps|packages)\/[^/]+\/src\//.test(fonte.caminho))).toBe(true)
  })

  it('enxerga o banco de todo repository: cada arquivo tem método que o toca', () => {
    const cegos = repositories.filter((fonte) => !analisarFonte(fonte).metodos.some((metodo) => metodo.tocaBanco)).map((fonte) => fonte.caminho)
    expect(cegos).toEqual([])
  })

  it('AlunosAtivosRepository.contar é o caso conhecido: toca o banco e prova o escopo pelo contexto', () => {
    const fonte = repositories.find((candidato) => candidato.caminho === 'apps/api/src/sessao/atividade/alunos-ativos.repository.ts')
    expect(fonte).toBeDefined()
    const contar = analisarFonte(fonte as ArquivoFonte).metodos.find((metodo) => metodo.nome === 'contar')
    expect(contar).toMatchObject({ classe: 'AlunosAtivosRepository', tocaBanco: true, prova: 'contexto' })
  })

  it('todo método público real tem (a) a prova do contexto, (b) @SemEscopo com motivo ou (c) a entrada na lista', () => {
    expect(verificarRepositories(fontes, REPOSITORIES_SEM_ESCOPO)).toEqual([])
  })

  it('nenhuma classe *Repository mora fora de um *.repository.ts', () => {
    expect(verificarRepositories(fontes, REPOSITORIES_SEM_ESCOPO).filter((violacao) => violacao.codigo === 'repository-fora-do-arquivo')).toEqual([])
    expect(fontes.filter((fonte) => !fonte.caminho.endsWith('.repository.ts') && /\bclass\s+\w*Repository\b/.test(fonte.texto))).toEqual([])
  })
})

describe('a leitura das pastas', () => {
  const pastas: string[] = []
  afterAll(() => {
    for (const pasta of pastas) rmSync(pasta, { recursive: true, force: true })
  })

  it('lê só o .ts de produção de src de apps/* e packages/*: sem teste, .d.ts, dist, node_modules, outra extensão (inclusive .tsx), pasta sem src nem arquivo solto', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'repositories-com-escopo-'))
    pastas.push(raiz)
    const arquivos = [
      'apps/a/src/um.repository.ts',
      'apps/a/src/dois.service.ts',
      'apps/a/src/um.repository.test.ts',
      'apps/a/src/um.repository.int.test.ts',
      'apps/a/src/tipos.d.ts',
      'apps/a/src/leia.md',
      'apps/a/src/tela.tsx',
      'apps/a/src/dist/saida.ts',
      'apps/a/src/node_modules/pacote/x.ts',
      'apps/a/lib/fora-de-src.ts',
      'apps/sem-src/LEIAME.md',
      'apps/solto.txt',
      'packages/b/src/sub/tres.ts',
    ]
    for (const arquivo of arquivos) {
      mkdirSync(dirname(join(raiz, arquivo)), { recursive: true })
      writeFileSync(join(raiz, arquivo), `// ${arquivo}\n`)
    }
    expect(
      lerFontesDeProducao(raiz)
        .map((fonte) => fonte.caminho)
        .sort(),
    ).toEqual(['apps/a/src/dois.service.ts', 'apps/a/src/um.repository.ts', 'packages/b/src/sub/tres.ts'])
  })
})

describe('a lista real só encolhe', () => {
  it('é exatamente esta, por arquivo e por método: uma entrada a mais ou a menos muda este teste', () => {
    expect(REPOSITORIES_SEM_ESCOPO.map((entrada) => [entrada.arquivo, entrada.metodos])).toEqual([
      ['apps/api/src/assistente/turma-do-professor.repository.ts', ['comVinculoConfirmadoDoProfessor', 'disciplinaDoArtefato', 'disciplinaDaEntrega']],
      ['apps/api/src/ia/execucao.repository.ts', ['marcarRodando', 'marcarConcluida', 'concluirRodando', 'marcarFalhou']],
      ['apps/api/src/operacao/operador/operador.repository.ts', ['autorAtivoNaTransacao', 'travarOperadores', 'situacaoDoAutor', 'ativoParaAtualizar', 'contarAtivos', 'criar', 'criarConvite', 'revogarConvitePendente', 'desativar', 'apagarCodigosDeRecuperacao', 'encerrarSessoes', 'lerSessaoParaGuarda', 'marcarUsoDaSessao', 'sessaoParaRenovar', 'rotacionarSessao', 'encerrarSessao', 'encerrarSessaoPelaSaida', 'daSessao', 'conviteValidoPorHash', 'aceitarConvite', 'gravarSegredoParaConfigurar', 'trocarCodigosDeRecuperacao', 'ativoParaSegundoFator', 'avancarPassoDoSegundoFator', 'usarCodigoDeRecuperacao', 'ativarSegundoFator', 'abrirSessao', 'credencialDeEntrada', 'registrarFalhaDeEntrada', 'registrarAcesso', 'auditar']],
      ['apps/api/src/ops/operacao-privacidade.repository.ts', ['cadastrar', 'travarVigente', 'encerrar', 'registrarIncidente']],
      ['apps/api/src/privacidade/titulares.repository.ts', ['homonimo']],
      ['packages/nucleo/src/auditoria/auditoria.repository.ts', ['listarDaEscola']],
      ['packages/nucleo/src/auditoria/insercao-de-auditoria.repository.ts', ['insertAuditoria']],
      ['packages/nucleo/src/fila/job-registro.repository.ts', ['inserir', 'inserirUmaVez', 'buscarDaEscola', 'localizarParaExecucao', 'iniciarExecucao', 'concluir', 'avisarVagaLivre', 'registrarFalha']],
      ['packages/nucleo/src/identidade/sessao.repository.ts', ['lerParaGuarda', 'marcarAtualApresentado']],
      ['packages/nucleo/src/titular/compartilhamento.repository.ts', ['datasDeReferencia']],
    ])
  })

  it('cada entrada diz o motivo com pelo menos 30 caracteres', () => {
    expect(REPOSITORIES_SEM_ESCOPO.filter((entrada) => entrada.motivo.trim().length < TAMANHO_MINIMO_JUSTIFICATIVA_SEM_ESCOPO).map((entrada) => entrada.arquivo)).toEqual([])
  })
})

describe('o que reprova', () => {
  it('toca this.banco sem prova de escopo, com o arquivo e o método', () => {
    reprovaOndeDiz('sem-prova.repository.ts')
    const [violacao] = verificarRepositories([fixture('sem-prova.repository.ts')], [])
    expect(violacao).toMatchObject({ arquivo: CAMINHO_DE_REPOSITORY, codigo: 'sem-prova-de-escopo' })
    expect(violacao?.detalhe).toContain('SemProvaRepository.listar')
  })

  it('SQL cru pela transação também toca o banco', () => reprovaOndeDiz('sql-cru.repository.ts'))
  it('o banco recebido pelo tipo do executor de auditoria também', () => reprovaOndeDiz('executor-de-auditoria.repository.ts'))
  it('o banco recebido por parâmetro também', () => reprovaOndeDiz('banco-por-parametro.repository.ts'))
  it('a função exportada do módulo é ponto de entrada público, e a interna não', () => reprovaOndeDiz('funcao-exportada.repository.ts'))
  it('a prova só em comentário ou em texto não vale: é chamada', () => reprovaOndeDiz('prova-so-no-texto.repository.ts'))
  it('a cópia local de exigirEscolaDoContexto não vale: só a importada', () => reprovaOndeDiz('copia-local.repository.ts'))
  it('o @SemEscopo escrito no arquivo, que não é o importado, não vale', () => reprovaOndeDiz('sem-escopo-local.repository.ts'))
  it('o ajudante de outro arquivo não conta', () => reprovaOndeDiz('ajudante-de-outro-arquivo.repository.ts'))
  it('o escolaId por parâmetro não é prova', () => reprovaOndeDiz('escola-por-parametro.repository.ts'))
  it('a propriedade-função pública não escapa, de seta ou de function; a propriedade que não é função não é método', () => reprovaOndeDiz('propriedade-arrow.repository.ts'))
  it('o nome de texto ou calculado não escapa', () => reprovaOndeDiz('nome-especial.repository.ts'))
  it('o acessor get e o set são públicos', () => reprovaOndeDiz('acessor.repository.ts'))
  it('o banco guardado numa propriedade tipada, com ou sem #, é o banco', () => reprovaOndeDiz('propriedade-do-banco.repository.ts'))
  it('outro decorator, com ou sem chamada, não prova nada', () => reprovaOndeDiz('outros-decorators.repository.ts'))
  it('o banco devolvido por um acessor ou método também é o banco', () => reprovaOndeDiz('acessor-de-banco.repository.ts'))

  it('a classe sem nome também é lida, e a acusação diz (anônima)', () => {
    reprovaOndeDiz('classe-anonima.repository.ts')
    expect(verificarRepositories([fixture('classe-anonima.repository.ts')], [])[0]?.detalhe).toContain('(anônima).listar')
  })

  it('a função exportada sem nome também é ponto de entrada, e a acusação diz default', () => {
    reprovaOndeDiz('funcao-anonima.repository.ts')
    expect(verificarRepositories([fixture('funcao-anonima.repository.ts')], [])[0]?.detalhe).toContain('(módulo).default')
  })
  it('o motivo de 29 caracteres reprova, e o de 30 passa; o espaço das pontas não conta', () => reprovaOndeDiz('motivo.repository.ts'))
  it('o motivo precisa ser texto estático: import, substituição e chamada de função reprovam', () => reprovaOndeDiz('motivo-estatico.repository.ts'))

  it('o ajudante do mesmo arquivo que toca o banco sem prova reprova o público que o chama, e o método de outro objeto não é ajudante', () => {
    reprovaOndeDiz('ajudante-do-mesmo-arquivo.repository.ts')
  })

  it('XRepository em x.service.ts reprova, e o XService ao lado não', () => {
    reprovaOndeDiz('repository-no-service.ts', 'apps/api/src/x/x.service.ts')
  })

  it('a classe Repository que está no *.repository.ts não é "fora do arquivo"', () => {
    const fonte = fixture('repository-no-service.ts', CAMINHO_DE_REPOSITORY)
    expect(verificarRepositories([fonte], []).filter((violacao) => violacao.codigo === 'repository-fora-do-arquivo')).toEqual([])
  })

  it('arquivo que não é repository e não cita classe *Repository nem é lido', () => {
    expect(verificarRepositories([{ caminho: 'apps/api/src/x/x.ts', texto: 'export class {{{' }], [])).toEqual([])
  })

  it('arquivo que não compila reprova, e nada dele é lido', () => {
    const quebrado: ArquivoFonte = { caminho: CAMINHO_DE_REPOSITORY, texto: 'export class QuebradoRepository {\n  async listar( {\n' }
    expect(verificarRepositories([quebrado], [])).toEqual([expect.objectContaining({ codigo: 'erro-de-sintaxe', arquivo: CAMINHO_DE_REPOSITORY })])
    expect(analisarFonte(quebrado)).toMatchObject({ erroDeSintaxe: true, metodos: [] })
  })
})

describe('o que passa', () => {
  it('o alias de import conta: vale o nome exportado', () => passaLimpa('import-com-alias.repository.ts'))
  it('a prova no ajudante do mesmo arquivo (método privado, função de topo de seta ou de function, os dois encadeados, e o ciclo entre ajudantes)', () => {
    const fonte = fixture('ajudante-do-mesmo-arquivo.repository.ts')
    const provados = analisarFonte(fonte)
      .metodos.filter((metodo) => metodo.prova === 'contexto')
      .map((metodo) => metodo.nome)
    expect(provados).toEqual(['viaMetodoPrivado', 'viaFuncaoDeTopo', 'viaOsDoisEncadeados', 'viaSeta', 'viaExpressao', 'viaCicloDeAjudantes'])
  })
  it('só identidadeDaRequisicao, ou só escopoDoJobNoContexto, valem cada uma', () => passaLimpa('provas-do-contexto.repository.ts'))
  it('o método privado, o protegido e o #privado sem prova passam: só o público exige', () => passaLimpa('privado.repository.ts'))
  it('o público que não toca o banco não exige prova, mesmo com Map.delete, parâmetro de outro tipo e propriedade de outro objeto com o nome do banco', () =>
    passaLimpa('publico-sem-banco.repository.ts'))
  it('o parâmetro do construtor sem modificador não vira propriedade, e this.banco de outro tipo não é o banco', () => passaLimpa('parametro-sem-modificador.repository.ts'))
  it('a assinatura de sobrecarga não é método à parte: sobra um por nome', () => {
    passaLimpa('sobrecarga.repository.ts')
    expect(analisarFonte(fixture('sobrecarga.repository.ts')).metodos.map((metodo) => `${metodo.classe}.${metodo.nome}`)).toEqual(['SobrecargaRepository.achar', '(módulo).somar'])
  })
  it('decorator, satisfies e as const compilam no parser da raiz, e o @SemEscopo com motivo vale', () => passaLimpa('decorator-e-satisfies.repository.ts'))

  it('o limite declarado: chamar a prova e não usar o resultado passa', () => {
    passaLimpa('chama-e-nao-usa.repository.ts')
    expect(analisarFonte(fixture('chama-e-nao-usa.repository.ts')).metodos).toEqual([expect.objectContaining({ nome: 'listar', tocaBanco: true, prova: 'contexto' })])
  })

  it('o motivo literal, em template sem substituição, em const do arquivo ou em soma de literais', () => {
    const fonte = fixture('motivo-estatico.repository.ts')
    const validos = analisarFonte(fonte)
      .metodos.filter((metodo) => metodo.erroDoDecorator === null && metodo.prova === 'sem-escopo')
      .map((metodo) => metodo.nome)
    expect(validos).toEqual(['templateSemSubstituicao', 'constDoArquivo', 'mais'])
  })
})

describe('a lista de exceções (c)', () => {
  const sem = fixture('sem-prova.repository.ts')
  const comProva = fixture('import-com-alias.repository.ts')
  const entrada = (campos: Partial<EntradaSemEscopo>): EntradaSemEscopo => ({
    arquivo: CAMINHO_DE_REPOSITORY,
    motivo: MOTIVO_DE_30,
    metodos: ['listar'],
    ...campos,
  })

  it('a exceção vale só no arquivo da entrada: o mesmo nome de método em outro arquivo continua reprovado', () => {
    const outro = 'apps/api/src/y/y.repository.ts'
    const doOutro: ArquivoFonte = { ...sem, caminho: outro }
    const violacoes = verificarRepositories([sem, doOutro], [entrada({ arquivo: outro, metodos: ['listar', 'apagar'] })])
    expect(violacoes.map((violacao) => `${violacao.arquivo} ${String(violacao.linha)} ${violacao.codigo}`).sort()).toEqual(
      marcas(sem.texto)
        .map((marca) => `${CAMINHO_DE_REPOSITORY} ${marca}`)
        .sort(),
    )
  })

  it('o método na lista, sem prova, passa; o que está fora de `metodos` continua reprovado (a exceção é por método)', () => {
    expect(acusacoes(sem, [entrada({ metodos: ['listar', 'apagar'] })])).toEqual([])
    const linhaDoApagar = sem.texto.split('\n').findIndex((linha) => linha.includes('async apagar(')) + 1
    expect(linhaDoApagar).toBeGreaterThan(0)
    expect(acusacoes(sem, [entrada({ metodos: ['listar'] })])).toEqual([`${String(linhaDoApagar)} sem-prova-de-escopo`])
  })

  it('método que já tem prova reprova: a lista só encolhe', () => {
    expect(acusacoes(comProva, [entrada({ metodos: ['daEscola'] })])).toEqual(['1 lista-metodo-conforme'])
  })

  it('método que nem toca o banco reprova na lista', () => {
    const publico = fixture('publico-sem-banco.repository.ts')
    expect(acusacoes(publico, [entrada({ metodos: ['nomeDaTabela'] })])).toEqual(['1 lista-metodo-conforme'])
  })

  it('arquivo inexistente reprova', () => {
    expect(acusacoes(sem, [entrada({ metodos: ['listar', 'apagar'] }), entrada({ arquivo: 'apps/api/src/nao/existe.repository.ts' })])).toEqual(['1 lista-arquivo-inexistente'])
  })

  it('método inexistente reprova', () => {
    expect(acusacoes(sem, [entrada({ metodos: ['listar', 'apagar', 'fantasma'] })])).toEqual(['1 lista-metodo-inexistente'])
  })

  it('a entrada da lista com motivo de 29 caracteres reprova, e a de 30 passa', () => {
    const todos = ['listar', 'apagar']
    expect(acusacoes(sem, [entrada({ metodos: todos, motivo: MOTIVO_DE_30.slice(0, 29) })])).toEqual(['1 lista-motivo-curto'])
    expect(acusacoes(sem, [entrada({ metodos: todos, motivo: `${MOTIVO_DE_30.slice(0, 29)}    ` })])).toEqual(['1 lista-motivo-curto'])
    expect(acusacoes(sem, [entrada({ metodos: todos, motivo: MOTIVO_DE_30 })])).toEqual([])
  })
})
