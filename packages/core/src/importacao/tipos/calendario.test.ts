import { describe, expect, it } from 'vitest'
import type { AnoDeDestino, EventoGravado, ImportacaoRepository } from '../importacao.repository.js'
import { tipoCalendario } from './calendario.js'

const ANO: AnoDeDestino = { id: 'ano-1', inicio: '2026-02-01', fim: '2026-12-15', situacao: 'em_curso' }
const CABECALHO = 'inicio;fim;tipo;descricao'

/** Só o que o tipo lê do repositório: os eventos que o ano já tem. A escrita fica nos testes de integração. */
function repositorioCom(existentes: readonly EventoGravado[]): ImportacaoRepository {
  return { eventosDoAno: () => Promise.resolve([...existentes]) } as unknown as ImportacaoRepository
}

const evento = (id: string, inicio: string, descricao: string, tipo: EventoGravado['tipo'] = 'feriado'): EventoGravado => ({ id, tipo, inicio, fim: inicio, descricao })
const previa = (texto: string, existentes: readonly EventoGravado[] = []) => tipoCalendario.previa(repositorioCom(existentes), ANO, `${CABECALHO}\n${texto}`)

describe('tipoCalendario.previa', () => {
  it('lê a data em `AAAA-MM-DD` e em `DD/MM/AAAA` (com dia e mês de um dígito), e guarda a data normalizada e a descrição sem espaço a mais', async () => {
    const lida = await previa('2026-04-21;21/04/2026;Feriado;  Dia   de Tiradentes  \n1/5/2026;1/5/2026;feriado;Trabalho')
    expect(lida.guardado).toEqual([
      { tipo: 'feriado', inicio: '2026-04-21', fim: '2026-04-21', descricao: 'Dia de Tiradentes' },
      { tipo: 'feriado', inicio: '2026-05-01', fim: '2026-05-01', descricao: 'Trabalho' },
    ])
    expect(lida.contagens).toEqual({ entram: 2, ja_existem: 0, eventos_removidos: 0 })
    expect(lida.candidatos).toEqual([])
  })

  it('aponta o primeiro erro de cada linha com o código, e só as linhas boas vão para o que se guarda', async () => {
    const lida = await previa(
      [
        '31/02/2026;31/02/2026;evento;Dia que não existe',
        '2026-13-01;2026-13-01;evento;Mês que não existe',
        'amanhã;2026-05-01;evento;Não é data',
        '2026-05-10;2026-05-09;evento;Fim antes',
        '2026-01-31;2026-01-31;evento;Antes do ano',
        '2026-12-16;2026-12-16;evento;Depois do ano',
        '2026-05-10;2026-05-10;ferias;Tipo',
        '2026-05-10;2026-05-10;evento;   ',
        `2026-05-10;2026-05-10;evento;${'x'.repeat(121)}`,
        '2026-05-10;2026-05-10;evento;Boa',
        '2026-02-01;2026-12-15;evento;O ano todo',
        '2026-04-21 10:00;2026-04-21;evento;Com hora',
        '21/04/20266;21/04/2026;evento;Ano de cinco dígitos',
        '2026-05-13;2026-05-13;evento',
      ].join('\n'),
    )
    expect(lida.linhas.map((linha) => [linha.linha, linha.resultado, linha.erro])).toEqual([
      [2, 'erro', 'data_invalida'],
      [3, 'erro', 'data_invalida'],
      [4, 'erro', 'data_invalida'],
      [5, 'erro', 'fim_antes_do_inicio'],
      [6, 'erro', 'fora_do_ano'],
      [7, 'erro', 'fora_do_ano'],
      [8, 'erro', 'tipo_invalido'],
      [9, 'erro', 'descricao_vazia'],
      [10, 'erro', 'descricao_longa'],
      [11, 'entra', undefined],
      [12, 'entra', undefined],
      [13, 'erro', 'data_invalida'],
      [14, 'erro', 'data_invalida'],
      [15, 'erro', 'linha_incompleta'],
    ])
    expect(lida.guardado).toHaveLength(2)
  })

  it('a descrição com o texto de um código de erro não é tomada por erro (o erro e a descrição não se misturam)', async () => {
    const lida = await previa('2026-05-10;2026-05-10;evento;descricao_vazia')
    expect(lida.linhas).toEqual([{ linha: 2, resultado: 'entra' }])
  })

  it('o evento repetido na planilha é erro `repetida` na segunda ocorrência; o mesmo dia com outra descrição ou outro tipo é outro evento', async () => {
    const lida = await previa('2026-05-10;2026-05-10;evento;A\n2026-05-10;2026-05-10;evento;A\n2026-05-10;2026-05-10;evento;B\n2026-05-10;2026-05-10;feriado;A')
    expect(lida.linhas.map((linha) => linha.erro)).toEqual([undefined, 'repetida', undefined, undefined])
  })

  it('compara com o ano: o igual `ja_existe`, o novo `entra`, e o que a planilha não traz conta em `eventos_removidos`', async () => {
    const existentes = [evento('1', '2026-04-21', 'Tiradentes'), evento('2', '2026-05-01', 'Trabalho')]
    const lida = await previa('2026-04-21;2026-04-21;feriado;Tiradentes\n2026-09-07;2026-09-07;feriado;Independência', existentes)
    expect(lida.linhas.map((linha) => linha.resultado)).toEqual(['ja_existe', 'entra'])
    expect(lida.contagens).toEqual({ entram: 1, ja_existem: 1, eventos_removidos: 1 })
  })

  it('a assinatura muda com o que o ano tem e com o que a planilha traz, e é a mesma para o mesmo par', async () => {
    const planilha = '2026-04-21;2026-04-21;feriado;Tiradentes'
    const vazio = await previa(planilha)
    const outraVez = await previa(planilha)
    const comUmEvento = await previa(planilha, [evento('1', '2026-05-01', 'Trabalho')])
    const outraPlanilha = await previa('2026-04-22;2026-04-22;feriado;Outro')
    expect(outraVez.assinatura).toBe(vazio.assinatura)
    expect(comUmEvento.assinatura).not.toBe(vazio.assinatura)
    expect(outraPlanilha.assinatura).not.toBe(vazio.assinatura)
    // O mesmo conjunto com id diferente no banco é o mesmo retrato: o id não entra na assinatura.
    const trocaDeId = await previa(planilha, [evento('9', '2026-05-01', 'Trabalho')])
    expect(trocaDeId.assinatura).toBe(comUmEvento.assinatura)
  })

  it('a cópia a mais de um evento que já existe (feita à mão) sai, e a assinatura enxerga a cópia', async () => {
    const um = [evento('1', '2026-04-21', 'Tiradentes')]
    const dois = [...um, evento('2', '2026-04-21', 'Tiradentes')]
    const planilha = '2026-04-21;2026-04-21;feriado;Tiradentes'
    const comUm = await previa(planilha, um)
    const comDois = await previa(planilha, dois)
    expect(comUm.contagens).toEqual({ entram: 0, ja_existem: 1, eventos_removidos: 0 })
    expect(comDois.contagens).toEqual({ entram: 0, ja_existem: 1, eventos_removidos: 1 })
    expect(comDois.assinatura).not.toBe(comUm.assinatura)
  })
})

describe('tipoCalendario.planejar', () => {
  it('refaz o plano do que a prévia guardou, com a mesma assinatura se o ano não mudou', async () => {
    const lida = await previa('2026-04-21;2026-04-21;feriado;Tiradentes')
    const plano = await tipoCalendario.planejar(repositorioCom([]), ANO, lida.guardado)
    expect(plano?.assinatura).toBe(lida.assinatura)
    expect(plano?.resumo).toEqual({ entram: 1, ja_existem: 0, eventos_removidos: 0 })
    const outroEstado = await tipoCalendario.planejar(repositorioCom([evento('1', '2026-05-01', 'Trabalho')]), ANO, lida.guardado)
    expect(outroEstado?.assinatura).not.toBe(lida.assinatura)
  })

  it('o que foi guardado fora da forma (chave a mais, tipo fora da lista, data torta, descrição vazia, não é lista) não tem plano', async () => {
    const boa = { tipo: 'feriado', inicio: '2026-04-21', fim: '2026-04-21', descricao: 'Tiradentes' }
    for (const guardado of [{ ...boa, extra: 1 }, { ...boa, tipo: 'ferias' }, { ...boa, inicio: '21/04/2026' }, { ...boa, descricao: '' }, { ...boa, descricao: 'x'.repeat(121) }]) {
      expect(await tipoCalendario.planejar(repositorioCom([]), ANO, [guardado]), JSON.stringify(guardado)).toBeUndefined()
    }
    expect(await tipoCalendario.planejar(repositorioCom([]), ANO, boa)).toBeUndefined()
    expect(await tipoCalendario.planejar(repositorioCom([]), ANO, null)).toBeUndefined()
  })

  it('`aplicar` apaga o que sai antes de inserir o que entra, e só escreve o que o plano disse', async () => {
    const chamadas: string[] = []
    const gravacao = {
      apagarEventos: (_ano: string, ids: readonly string[]) => Promise.resolve(void chamadas.push(`apagar ${ids.join(',')}`)),
      inserirEventos: (_ano: string, eventos: readonly { descricao: string }[]) => Promise.resolve(void chamadas.push(`inserir ${eventos.map((e) => e.descricao).join(',')}`)),
    } as unknown as ImportacaoRepository
    const guardado = [{ tipo: 'feriado', inicio: '2026-04-21', fim: '2026-04-21', descricao: 'Tiradentes' }]
    const plano = await tipoCalendario.planejar(repositorioCom([evento('7', '2026-05-01', 'Trabalho')]), ANO, guardado)
    await plano?.aplicar(gravacao)
    expect(chamadas).toEqual(['apagar 7', 'inserir Tiradentes'])
  })
})
