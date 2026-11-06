import { ErrorCode, MAXIMO_DE_LINHAS_DA_PLANILHA_DE_PROFESSORES, previaDaPlanilhaResponseSchema, type EstadoDoProfessor, type MarcasDaPlanilha } from '@educa/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { convidarProfessorDaPlanilha } from '../../convite/convidar-professor-da-planilha.js'
import { DomainException } from '../../error/domain.exception.js'
import { ContaDaPlanilhaPerdidaError, DiferencaNaPlanilhaError } from '../erros.js'
import type { ImportacaoRepository, ProfessorDaEscola } from '../importacao.repository.js'
import type { AmbienteDaGravacao } from '../tipo.js'
import { classificar, tipoProfessores } from './professores.js'

vi.mock('../../convite/convidar-professor-da-planilha.js', () => ({ convidarProfessorDaPlanilha: vi.fn() }))
const convidar = vi.mocked(convidarProfessorDaPlanilha)

const CABECALHO = 'nome;email'
const SEM_MARCAS: MarcasDaPlanilha = { transferir: [], desligar: [], encerrar: [] }
const SEM_CONTAS = new Map<string, string>()

/** Só o que o tipo lê do repositório: os professores da escola. A escrita e as travas ficam nos testes de integração. */
function repositorioCom(professores: readonly ProfessorDaEscola[]): ImportacaoRepository {
  return { professoresDaEscola: () => Promise.resolve([...professores]) } as unknown as ImportacaoRepository
}

const professor = (usuarioId: string, email: string | null, estado: EstadoDoProfessor, nome = `Professor ${usuarioId}`): ProfessorDaEscola => ({ usuarioId, nome, email, estado })
const lido = (email: string, nome = 'Fulana') => ({ nome, email })
const previa = (texto: string, daEscola: readonly ProfessorDaEscola[] = []) => tipoProfessores.previa(repositorioCom(daEscola), `${CABECALHO}\n${texto}`)

describe('tipoProfessores.previa', () => {
  it('lê nome e e-mail, guarda o e-mail em minúsculas e o nome sem espaço a mais, e conta quem entra', async () => {
    const lida = await previa('  Ana   Souza ;  ANA@Escola.invalid \nBruno Lima;bruno@escola.invalid')
    expect(lida.guardado).toEqual([
      { nome: 'Ana Souza', email: 'ana@escola.invalid' },
      { nome: 'Bruno Lima', email: 'bruno@escola.invalid' },
    ])
    expect(lida.linhas.map((linha) => [linha.linha, linha.resultado])).toEqual([[2, 'entra'], [3, 'entra']])
    expect(lida.contagens).toEqual({ entram: 2, ja_existem: 0 })
    expect(lida.candidatos).toEqual([])
    expect(() => previaDaPlanilhaResponseSchema.parse({ linhas: lida.linhas, contagens: lida.contagens, candidatos: lida.candidatos })).not.toThrow()
  })

  it('aponta o primeiro erro de cada linha com o código, e só as linhas boas vão para o que se guarda', async () => {
    const lida = await previa(['   ;sem.nome@escola.invalid', `${'x'.repeat(201)};longo@escola.invalid`, 'Com\tcontrole;controle@escola.invalid'.replace('\t', '\u0007'), 'Sem arroba;sem-arroba', 'Sem e-mail;', 'Só uma coluna', 'Boa;boa@escola.invalid'].join('\n'))
    expect(lida.linhas.map((linha) => [linha.linha, linha.resultado, linha.erro])).toEqual([
      [2, 'erro', 'nome_vazio'],
      [3, 'erro', 'nome_invalido'],
      [4, 'erro', 'nome_invalido'],
      [5, 'erro', 'email_invalido'],
      [6, 'erro', 'email_invalido'],
      [7, 'erro', 'linha_incompleta'],
      [8, 'entra', undefined],
    ])
    expect(lida.guardado).toEqual([{ nome: 'Boa', email: 'boa@escola.invalid' }])
  })

  it('a 301ª linha é erro de teto, e as 300 primeiras entram', async () => {
    const linhas = Array.from({ length: MAXIMO_DE_LINHAS_DA_PLANILHA_DE_PROFESSORES + 1 }, (_, posicao) => `Professor ${String(posicao)};prof${String(posicao)}@escola.invalid`)
    const lida = await previa(linhas.join('\n'))
    expect(lida.linhas.filter((linha) => linha.resultado === 'entra')).toHaveLength(MAXIMO_DE_LINHAS_DA_PLANILHA_DE_PROFESSORES)
    expect(lida.linhas.at(-1)).toEqual({ linha: MAXIMO_DE_LINHAS_DA_PLANILHA_DE_PROFESSORES + 2, resultado: 'erro', erro: 'acima_do_teto' })
    const dentroDoTeto = await previa(linhas.slice(0, MAXIMO_DE_LINHAS_DA_PLANILHA_DE_PROFESSORES).join('\n'))
    expect(dentroDoTeto.linhas.some((linha) => linha.resultado === 'erro')).toBe(false)
  })

  it('o mesmo e-mail duas vezes, em qualquer caixa, é uma pessoa: a primeira linha vale e a outra é aviso, não erro', async () => {
    const lida = await previa('Ana Souza;ana@escola.invalid\nA. Souza;ANA@escola.invalid')
    expect(lida.guardado).toEqual([{ nome: 'Ana Souza', email: 'ana@escola.invalid' }])
    expect(lida.linhas).toEqual([
      { linha: 2, resultado: 'entra' },
      { linha: 3, resultado: 'ja_existe', aviso: 'email_repetido' },
    ])
    expect(lida.contagens).toEqual({ entram: 1, ja_existem: 0 })
  })

  it('o professor da escola é "já existe", e o candidato a desligar leva só o id e o nome: nunca o e-mail', async () => {
    const daEscola = [professor('u1', 'ana@escola.invalid', 'ativo'), professor('u2', 'ausente@escola.invalid', 'ativo', 'Dona Ausente')]
    const lida = await previa('Ana;ana@escola.invalid', daEscola)
    expect(lida.linhas).toEqual([{ linha: 2, resultado: 'ja_existe' }])
    expect(lida.candidatos).toEqual([{ id: 'u2', acao: 'desligar', rotulo: 'Dona Ausente' }])
    expect(JSON.stringify(lida.candidatos)).not.toContain('ausente@escola.invalid')
  })
})

describe('classificar', () => {
  const todos: EstadoDoProfessor[] = ['ativo', 'aceito', 'pendente', 'vencido', 'revogado', 'desativado']

  it('só o e-mail sem professor, ou de professor `revogado` ou `desativado`, entra; os outros estados já existem', () => {
    const daEscola = todos.map((estado) => professor(estado, `${estado}@escola.invalid`, estado))
    const { entram, jaExistem } = classificar([...todos.map((estado) => lido(`${estado}@escola.invalid`)), lido('novo@escola.invalid')], daEscola)
    expect(entram.map((entra) => entra.email)).toEqual(['desativado@escola.invalid', 'novo@escola.invalid', 'revogado@escola.invalid'])
    expect(jaExistem).toBe(4)
  })

  it('só o ausente `ativo` ou `aceito` é candidato a desligar; `pendente`, `vencido`, `revogado` e `desativado` ausentes não são', () => {
    const daEscola = todos.map((estado) => professor(estado, `${estado}@escola.invalid`, estado))
    expect(classificar([], daEscola).candidatos.map((candidato) => candidato.estado)).toEqual(['ativo', 'aceito'])
  })

  it('o professor presente na planilha não é candidato, e o sem e-mail (conta limpa) ausente, sim', () => {
    const daEscola = [professor('u1', 'ana@escola.invalid', 'ativo'), professor('u2', null, 'ativo')]
    expect(classificar([lido('ana@escola.invalid')], daEscola).candidatos.map((candidato) => candidato.usuarioId)).toEqual(['u2'])
  })

  it('a assinatura não depende da ordem das linhas, e muda com o estado de quem a planilha casa e com o conjunto de candidatos', () => {
    const daEscola = [professor('u1', 'ana@escola.invalid', 'ativo'), professor('u2', 'bia@escola.invalid', 'ativo')]
    const base = classificar([lido('ana@escola.invalid'), lido('novo@escola.invalid')], daEscola).assinatura
    expect(classificar([lido('novo@escola.invalid'), lido('ana@escola.invalid')], daEscola).assinatura).toBe(base)
    expect(classificar([lido('ana@escola.invalid'), lido('novo@escola.invalid')], [professor('u1', 'ana@escola.invalid', 'desativado'), daEscola[1] as ProfessorDaEscola]).assinatura).not.toBe(base)
    expect(classificar([lido('ana@escola.invalid'), lido('novo@escola.invalid')], [daEscola[0] as ProfessorDaEscola, professor('u2', 'bia@escola.invalid', 'desativado')]).assinatura).not.toBe(base)
    expect(classificar([lido('ana@escola.invalid'), lido('novo@escola.invalid')], [daEscola[0] as ProfessorDaEscola]).assinatura).not.toBe(base)
  })
})

describe('tipoProfessores.planejar e emailsDasContas', () => {
  const guardado = [lido('b@escola.invalid'), lido('a@escola.invalid')]

  it('os e-mails do passo (1) saem em ordem; o que não tem a forma do tipo é `undefined`, no passo (1) e no plano', async () => {
    expect(tipoProfessores.emailsDasContas(guardado)).toEqual(['a@escola.invalid', 'b@escola.invalid'])
    expect(tipoProfessores.emailsDasContas([{ tipo: 'inventado' }])).toBeUndefined()
    expect(await tipoProfessores.planejar(repositorioCom([]), [{ tipo: 'inventado' }], SEM_MARCAS, SEM_CONTAS)).toBeUndefined()
  })

  it('o resumo do job conta quem entra, quem já existe e quem as marcas desligam; a conta de ninguém entra nele', async () => {
    const daEscola = [professor('u1', 'a@escola.invalid', 'ativo'), professor('u2', 'ausente@escola.invalid', 'ativo')]
    const plano = await tipoProfessores.planejar(repositorioCom(daEscola), guardado, { ...SEM_MARCAS, desligar: ['u2'] }, SEM_CONTAS)
    expect(plano?.resumo).toEqual({ entram: 1, ja_existem: 1, desligados: 1 })
  })

  it('`aplicar` sem a conta do e-mail (o passo (1) não a trouxe) pede nova tentativa, antes de convidar quem quer que seja', async () => {
    const plano = await tipoProfessores.planejar(repositorioCom([]), guardado, SEM_MARCAS, new Map([['b@escola.invalid', 'conta-b']]))
    await expect(plano?.aplicar(repositorioCom([]), {} as unknown as AmbienteDaGravacao)).rejects.toBeInstanceOf(ContaDaPlanilhaPerdidaError)
  })

  describe('`aplicar` e o `convidar` da planilha', () => {
    beforeEach(() => convidar.mockReset())

    it('convida cada um que entra, em ordem de e-mail, com a conta que o passo (1) achou e o nome da planilha', async () => {
      convidar.mockResolvedValue(true)
      const contas = new Map([['a@escola.invalid', 'conta-a'], ['b@escola.invalid', 'conta-b']])
      const plano = await tipoProfessores.planejar(repositorioCom([]), [lido('b@escola.invalid', 'Bia'), lido('a@escola.invalid', 'Ana')], SEM_MARCAS, contas)

      await plano?.aplicar(repositorioCom([]), { tx: 'tx' } as unknown as AmbienteDaGravacao)

      expect(convidar.mock.calls).toEqual([['tx', { contaId: 'conta-a', nome: 'Ana' }], ['tx', { contaId: 'conta-b', nome: 'Bia' }]])
    })

    it('o `convidar` que não tinha o que convidar (devolve `false`) é diferença do que a prévia viu, não falha: a importação sai `desatualizada`', async () => {
      convidar.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
      const contas = new Map([['a@escola.invalid', 'conta-a'], ['b@escola.invalid', 'conta-b']])
      const plano = await tipoProfessores.planejar(repositorioCom([]), [lido('a@escola.invalid'), lido('b@escola.invalid')], SEM_MARCAS, contas)

      await expect(plano?.aplicar(repositorioCom([]), { tx: 'tx' } as unknown as AmbienteDaGravacao)).rejects.toBeInstanceOf(DiferencaNaPlanilhaError)
      expect(convidar).toHaveBeenCalledTimes(2)
    })
  })

  it('`aplicar` desliga os marcados em ordem de id pelo `desativar`, e o `NAO_ENCONTRADO` dele é diferença, não falha', async () => {
    const daEscola = [professor('u2', 'dois@escola.invalid', 'ativo'), professor('u1', 'um@escola.invalid', 'ativo')]
    const chamadas: string[] = []
    const ciclo = (falhaEm?: string) => ({
      desativar: (usuarioId: string) => {
        chamadas.push(usuarioId)
        return usuarioId === falhaEm ? Promise.reject(new DomainException(ErrorCode.NAO_ENCONTRADO)) : Promise.resolve()
      },
    })
    const plano = await tipoProfessores.planejar(repositorioCom(daEscola), [], { ...SEM_MARCAS, desligar: ['u2', 'u1'] }, SEM_CONTAS)

    await plano?.aplicar(repositorioCom([]), { ciclo: ciclo() } as unknown as AmbienteDaGravacao)
    expect(chamadas).toEqual(['u1', 'u2'])

    await expect(plano?.aplicar(repositorioCom([]), { ciclo: ciclo('u1') } as unknown as AmbienteDaGravacao)).rejects.toBeInstanceOf(DiferencaNaPlanilhaError)
  })

  it('erro do `desativar` que não é `NAO_ENCONTRADO` sobe como está, para a fila repetir', async () => {
    const plano = await tipoProfessores.planejar(repositorioCom([]), [], { ...SEM_MARCAS, desligar: ['u1'] }, SEM_CONTAS)
    const ciclo = { desativar: () => Promise.reject(new DomainException(ErrorCode.CONFLITO)) }
    await expect(plano?.aplicar(repositorioCom([]), { ciclo } as unknown as AmbienteDaGravacao)).rejects.toMatchObject({ codigo: ErrorCode.CONFLITO })
  })
})
