import { turnoDoTutor } from '@educa/core'
import { TAREFAS_DE_IA, type TarefaDeIa } from '@educa/shared'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, expectTypeOf, it } from 'vitest'
import type { ExecucaoCommand } from './execucao-command.js'
import type { ExecucaoComComando } from './execucao.scheduler.js'
import { comRegistro, RegistroDeComandos, TAREFAS_SEM_CHAMADOR, tarefasSemComando } from './registro-de-comandos.js'

const RAIZ_DA_API = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Os arquivos `.ts` de uma pasta, por dentro das subpastas, sem os de teste. */
function arquivosDeProducao(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true, recursive: true })
    .filter((entrada) => entrada.isFile() && entrada.name.endsWith('.ts') && !entrada.name.endsWith('.test.ts') && !entrada.name.endsWith('.d.ts'))
    .map((entrada) => join(entrada.parentPath, entrada.name))
}

/**
 * As tarefas que os módulos **registram na subida**, lidas do que eles escrevem: cada `comRegistro(registro, new <Comando>(…))` de um
 * `*.module.ts` aponta uma classe, e a classe, de um `*.command.ts`, diz a tarefa. É o que a API monta, sem subir a API, e por isso o
 * comando que sai de um módulo (ou que nunca entrou) aparece aqui. Sem módulo ou sem comando achado, é o alvo que sumiu: lança.
 */
async function tarefasRegistradasPelosModulos(raiz: string): Promise<TarefaDeIa[]> {
  const arquivos = arquivosDeProducao(raiz)
  const classes = arquivos
    .filter((arquivo) => arquivo.endsWith('.module.ts'))
    .flatMap((arquivo) => [...readFileSync(arquivo, 'utf8').matchAll(/comRegistro\(\s*\w+\s*,\s*new\s+(\w+)\(/gu)].map((achado) => achado[1] as string))
  if (classes.length === 0) throw new Error('nenhum módulo registra comando')
  const tarefas: TarefaDeIa[] = []
  for (const classe of classes) {
    const arquivo = arquivos.find((candidato) => candidato.endsWith('.command.ts') && new RegExp(`export class ${classe}\\b`, 'u').test(readFileSync(candidato, 'utf8')))
    if (arquivo === undefined) throw new Error(`o comando ${classe} não está em nenhum *.command.ts`)
    const modulo = (await import(pathToFileURL(arquivo).href)) as Record<string, new () => { readonly tarefa: { readonly nome: TarefaDeIa } }>
    const Comando = modulo[classe]
    if (Comando === undefined) throw new Error(`o arquivo do comando ${classe} não o exporta`)
    // Os construtores só guardam o que recebem: a tarefa é da classe, e não do banco.
    tarefas.push(new Comando().tarefa.nome)
  }
  return tarefas
}

describe('o registro de comandos de IA', () => {
  it('toda tarefa do catálogo que alguém chama tem o comando que um módulo registra, e só a que ninguém chama fica sem', async () => {
    const registradas = await tarefasRegistradasPelosModulos(RAIZ_DA_API)
    expect(tarefasSemComando(registradas)).toEqual([])
    expect([...registradas].sort()).toEqual(['adaptar_atividade', 'gerar_atividade_objetiva', 'gerar_plano_de_aula', 'propor_ferramenta', 'resumo_do_analista', 'turno_do_tutor'])
    expect(TAREFAS_DE_IA.filter((tarefa) => !registradas.includes(tarefa))).toEqual(TAREFAS_SEM_CHAMADOR)
    // A conferência não é "vazia por padrão": tirar um registro deixa a tarefa descoberta.
    expect(tarefasSemComando(registradas.filter((tarefa) => tarefa !== 'turno_do_tutor'))).toEqual(['turno_do_tutor'])
  })

  it('o alvo que some reprova em vez de passar em branco: registro vazio, catálogo vazio e pasta sem módulo', async () => {
    expect(() => tarefasSemComando([])).toThrow(/nenhum comando registrado/u)
    expect(() => tarefasSemComando(['turno_do_tutor'], [])).toThrow(/catálogo de tarefas de IA está vazio/u)
    const vazia = mkdtempSync(join(tmpdir(), 'registro-vazio-'))
    await expect(tarefasRegistradasPelosModulos(vazia)).rejects.toThrow(/nenhum módulo registra comando/u)
    // Um módulo que cita o comando e uma pasta sem o arquivo dele: o alvo sumiu, e a leitura não o inventa.
    mkdirSync(join(vazia, 'tutor'))
    writeFileSync(join(vazia, 'tutor', 'x.module.ts'), 'const c = comRegistro(registro, new ComandoQueNaoExiste(banco))\n')
    await expect(tarefasRegistradasPelosModulos(vazia)).rejects.toThrow(/não está em nenhum \*\.command\.ts/u)
  })

  it('quem contorna reprova: comando de tarefa fora do catálogo, e a mesma tarefa registrada duas vezes', () => {
    expect(() => tarefasSemComando([...TAREFAS_DE_IA, 'tarefa_inventada' as TarefaDeIa])).toThrow(/fora do catálogo/u)
    const comando: ExecucaoCommand<unknown, unknown, unknown> = { tarefa: turnoDoTutor as never, fila: 'interativa', preparar: () => Promise.reject(new Error('não roda')), concluir: () => Promise.reject(new Error('não roda')) }
    const registro = new RegistroDeComandos()
    comRegistro(registro, comando)
    expect(() => comRegistro(registro, comando)).toThrow(/já tem comando/u)
    expect(registro.tarefas()).toEqual(['turno_do_tutor'])
  })

  it('a exceção é uma só, e fica de fora porque ninguém a chama: nenhum arquivo da API usa o `relatorio_da_correcao`', () => {
    expect(TAREFAS_SEM_CHAMADOR).toEqual(['relatorio_da_correcao'])
    const comChamador = arquivosDeProducao(RAIZ_DA_API).filter((arquivo) => !arquivo.endsWith('registro-de-comandos.ts') && /relatorio_da_correcao|relatorioDaCorrecao/u.test(readFileSync(arquivo, 'utf8')))
    expect(comChamador).toEqual([])
  })

  it('o pedido de IA não leva closure de entrada nem de conclusão: só a chave, a entrada gravada e o que grava junto do pendente', () => {
    // A prova é do compilador (o `tsc` do portão): o tipo não tem as duas closures, e o literal que as leva não compila.
    expectTypeOf<ExecucaoComComando>().not.toHaveProperty('aoConcluir')
    expectTypeOf<ExecucaoComComando>().not.toHaveProperty('entrada')
    expectTypeOf<ExecucaoComComando>().toHaveProperty('aoGravar')
    const aceita = (_pedido: ExecucaoComComando): void => undefined
    aceita({
      comando: 'turno_do_tutor',
      chaveEnvio: 'chave',
      entradaDaExecucao: { tarefa: 'turno_do_tutor' },
      // @ts-expect-error a conclusão é do comando registrado, e não do pedido
      aoConcluir: () => Promise.resolve({ tipo: 'mensagem_do_tutor', mensagemId: 'x' }),
    })
    aceita({
      comando: 'turno_do_tutor',
      chaveEnvio: 'chave',
      entradaDaExecucao: { tarefa: 'turno_do_tutor' },
      // @ts-expect-error a entrada é lida pelo comando, e não montada pelo pedido
      entrada: () => Promise.resolve({}),
    })
  })
})
