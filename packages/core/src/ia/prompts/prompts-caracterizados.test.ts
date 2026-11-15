import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { TASK_CATALOG } from '../tasks/index.js'

/**
 * A caracterização dos prompts (regra 30, item 6; X6, 1.1): o texto que cada tarefa manda ao modelo como instrução de
 * sistema, preso ao hash e à `versao` que o registro de consumo grava. Escrito e rodado verde **antes** de a tarefa
 * mover o que cada módulo faz ao concluir uma execução (o comando registrado), e vale igual depois: o comando não mexe
 * em prompt.
 *
 * Mudar um prompt muda o hash, e este teste fica vermelho até a `versao` da tarefa e a linha daqui irem juntas: é o que
 * impede a instrução de mudar sem que `consumo_ia` possa dizer "com que instrução a IA disse isso?".
 */
const PROMPTS_CARACTERIZADOS = {
  propor_ferramenta: { versao: '2026-10-22.1', sha256: '9414fab889df02fb704f6b106b9aa851229f62eef1c16e594ea3d22abe06b685' },
  gerar_atividade_objetiva: { versao: '2026-10-04.2', sha256: '4ee752e054bae2cd295d1a298e86c71386d28f29606fcf0cf4c1102811d95963' },
  gerar_plano_de_aula: { versao: '2026-10-04.2', sha256: '7a5358f9974edc40037c76859ce6cda5bfbbf4994bf947ac42138b9a889c910e' },
  adaptar_atividade: { versao: '2026-10-04.2', sha256: '511761286495398542f2c84a0167dc6c1469183a6a19db28aca3f0674024c846' },
  turno_do_tutor: { versao: '2026-10-22.1', sha256: '7154c8e6a8dea0d595729215960dcc201755cc16fb8559d97df67a843251764c' },
  relatorio_da_correcao: { versao: '2026-10-04.2', sha256: '563f38c01f1effd63bf0d27081879a40f7431b235bd9b21e56c97856c9966d6a' },
  resumo_do_analista: { versao: '2026-10-04.3', sha256: '6be7fca96f41c1f9708053c07bd03fc8ec22fc2e169806324117c21bb8899abd' },
} as const

const sha256 = (texto: string): string => createHash('sha256').update(texto).digest('hex')

describe('os prompts caracterizados', () => {
  it('a tabela cobre toda tarefa do catálogo, e só elas', () => {
    expect(Object.keys(PROMPTS_CARACTERIZADOS).sort()).toEqual(Object.keys(TASK_CATALOG).sort())
  })

  it.each(Object.entries(TASK_CATALOG))('%s: a mensagem de sistema bate com o hash e a versão da tarefa', (nome, tarefa) => {
    const esperado = PROMPTS_CARACTERIZADOS[nome as keyof typeof PROMPTS_CARACTERIZADOS]
    expect({ versao: tarefa.prompt.versao, sha256: sha256(tarefa.prompt.sistema) }).toEqual(esperado)
  })
})
