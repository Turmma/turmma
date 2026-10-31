import { ErrorCode } from '@educa/shared'
import { Controller, Get, Post, type ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { describe, expect, it } from 'vitest'
import { setContextSessao, runInContext } from '../context/context.js'
import { Public } from '../rate-limit/route-markers.decorator.js'
import { routesWithoutPermissao } from './permissao-boot-check.js'
import { PermissaoGuard } from './permissao.guard.js'
import { RequirePermissao } from './require-permissao.decorator.js'

@Controller('turmas')
class TurmasController {
  @Get(':id')
  @RequirePermissao('turma', 'ler')
  ler(): void {}

  @Post()
  @RequirePermissao('turma', 'criar')
  criar(): void {}

  @Get('sem-marcacao')
  esquecida(): void {}

  /** Método sem rota: não é endpoint, e não precisa de marcação. */
  auxiliar(): void {}
}

@RequirePermissao('sistema_contexto', 'ler')
@Controller('contexto')
class MarcadoNaClasseController {
  @Get()
  obter(): void {}
}

@Public()
@Controller('publico')
class AnonimoController {
  @Get()
  obter(): void {}
}

@Controller('misto')
class MistoController {
  @Public()
  @Get('aberta')
  aberta(): void {}

  @Get('fechada')
  fechada(): void {}
}

class BaseSemMarcacao {
  @Get('herdada')
  herdada(): void {}
}

@Controller('filho')
class FilhoController extends BaseSemMarcacao {
  @Get()
  @RequirePermissao('turma', 'ler')
  proprio(): void {}
}

function execucaoDe(controlador: new () => object, metodo: string): ExecutionContext {
  const handler = (controlador.prototype as Record<string, () => void>)[metodo]
  if (handler === undefined) throw new Error('método ausente')
  return { getHandler: () => handler, getClass: () => controlador, getType: () => 'http' } as unknown as ExecutionContext
}

const guarda = new PermissaoGuard(new Reflector())
const sessaoDo = (papel: 'coordenador' | 'professor' | 'aluno') => ({ escolaId: 'e', usuarioId: 'u', papel, sessaoId: 's', anoLetivoId: null })

function comPapel<T>(papel: 'coordenador' | 'professor' | 'aluno', funcao: () => T): T {
  return runInContext({ requisicaoId: 'r' }, () => {
    setContextSessao(sessaoDo(papel))
    return funcao()
  })
}

describe('GuardaDePermissao', () => {
  it('libera o papel cujo alcance na célula não é nunca', () => {
    expect(comPapel('coordenador', () => guarda.canActivate(execucaoDe(TurmasController, 'criar')))).toBe(true)
    expect(comPapel('professor', () => guarda.canActivate(execucaoDe(TurmasController, 'ler')))).toBe(true)
  })

  it('papel com alcance nunca recebe NAO_ENCONTRADO 404, igual a rota inexistente, nunca um 403', () => {
    for (const [papel, metodo] of [['professor', 'criar'], ['aluno', 'ler'], ['aluno', 'criar']] as const) {
      expect(() => comPapel(papel, () => guarda.canActivate(execucaoDe(TurmasController, metodo))), `${papel} ${metodo}`).toThrow(
        expect.objectContaining({ codigo: ErrorCode.NAO_ENCONTRADO, status: 404 }),
      )
    }
  })

  it('a marcação na classe vale para os métodos dela', () => {
    expect(comPapel('aluno', () => guarda.canActivate(execucaoDe(MarcadoNaClasseController, 'obter')))).toBe(true)
  })

  it('rota autenticada sem @Permite é recusada mesmo assim: nunca libera por omissão', () => {
    expect(() => comPapel('coordenador', () => guarda.canActivate(execucaoDe(TurmasController, 'esquecida')))).toThrow(
      expect.objectContaining({ codigo: ErrorCode.NAO_ENCONTRADO }),
    )
  })

  it('sem papel no contexto (guarda fora de ordem), NAO_AUTENTICADO', () => {
    expect(() => runInContext({ requisicaoId: 'r' }, () => guarda.canActivate(execucaoDe(TurmasController, 'ler')))).toThrow(
      expect.objectContaining({ codigo: ErrorCode.NAO_AUTENTICADO }),
    )
  })

  it('rota anônima passa sem papel', () => {
    expect(runInContext({ requisicaoId: 'r' }, () => guarda.canActivate(execucaoDe(AnonimoController, 'obter')))).toBe(true)
  })
})

describe('rotasSemPermissao', () => {
  it('aponta só as rotas sem @Permite e sem @RotaAnonima, no método ou na classe, e ignora método sem rota', () => {
    expect(routesWithoutPermissao([TurmasController, MarcadoNaClasseController, AnonimoController, MistoController])).toEqual([
      'TurmasController.esquecida',
      'MistoController.fechada',
    ])
  })

  it('rota herdada de controller base sem marcação também é apontada', () => {
    expect(routesWithoutPermissao([FilhoController])).toEqual(['FilhoController.herdada'])
  })
})
