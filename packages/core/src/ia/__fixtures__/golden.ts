import type { AssistenteInput } from '../tasks/propor-ferramenta.js'
import type { TutorInput } from '../tasks/turno-do-tutor.js'
import type { Amostra } from '../medida-do-ouro.js'

/**
 * O que o `golden.test.ts` e o `turno-do-tutor.test.ts` precisam para passar uma amostra do `ouro` à função de hoje: a entrada que o README do `ouro` ("O que a 1.0 passa à função") manda montar. A leitura do
 * corpus, a medida e o alvo moram em `../medida-do-ouro.ts` (a ferramenta da avaliação os lê também); este arquivo depende do tipo de entrada das tarefas, e por isso fica em fixture.
 */

/** A questão em andamento que o aluno tem diante de si quando o `ouro` diz `comQuestao: true`. Qualquer uma serve: a regra só olha se existe. */
const questaoEmAndamento: NonNullable<TutorInput['questao']> = {
  numero: 1,
  enunciado: 'Qual é a massa molar da água?',
  alternativas: ['10 g/mol', '18 g/mol', '20 g/mol', '32 g/mol'],
  habilidade: { codigo: 'EM13CNT104', descricao: 'Relacionar mol, massa molar e constante de Avogadro à quantidade de matéria' },
}

/** README do `ouro`, "O que a 1.0 passa à função": `comQuestao` é `questao` definida; `turnoAnteriorDoAluno` é o turno anterior do aluno. */
export function entradaDoPedidoDeRespostaPronta(amostra: Amostra): Pick<TutorInput, 'duvida' | 'questao' | 'turnosAnteriores'> {
  const anterior = amostra.contexto?.turnoAnteriorDoAluno
  const turnosAnteriores: TutorInput['turnosAnteriores'] = anterior === undefined ? [] : [{ autor: 'aluno', texto: anterior }]
  const entrada = { duvida: amostra.texto, turnosAnteriores }
  return amostra.contexto?.comQuestao === true ? { ...entrada, questao: questaoEmAndamento } : entrada
}

/** README do `ouro`: `turnosDoProfessor` são os turnos anteriores do professor, na ordem. */
export function turnosDoProfessor(amostra: Amostra): AssistenteInput['turnosAnteriores'] {
  return (amostra.contexto?.turnosDoProfessor ?? []).map((texto) => ({ autor: 'professor', texto }))
}
