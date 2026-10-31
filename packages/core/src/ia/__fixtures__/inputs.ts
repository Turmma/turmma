import type { ConteudoDeAtividade } from '@educa/shared'
import type { AdaptacaoInput } from '../tasks/adaptar-atividade.js'
import { gerarAtividadeObjetiva, type AtividadeObjetivaInput } from '../tasks/gerar-atividade-objetiva.js'
import type { PlanoDeAulaInput } from '../tasks/gerar-plano-de-aula.js'
import type { AssistenteInput } from '../tasks/propor-ferramenta.js'
import type { RelatorioInput } from '../tasks/relatorio-da-correcao.js'
import type { AnalistaInput } from '../tasks/resumo-do-analista.js'
import type { TutorInput } from '../tasks/turno-do-tutor.js'
import { CONTEXTO_DE_QUIMICA, HABILIDADES_DE_ESTEQUIOMETRIA, trechosDeEstequiometria } from './estequiometria.js'

/** Uma entrada válida de cada tarefa, toda sintética, sobre o mesmo material de estequiometria. */

export const ESCOLA_A = '6f1d2c3b-4a59-4e68-8b7a-1c2d3e4f5a60'
export const ESCOLA_B = '7a2e3d4c-5b6a-4f79-9c8b-2d3e4f5a6b71'
export const ALUNO_1 = '8b3f4e5d-6c7b-4a8a-8d9c-3e4f5a6b7c82'
export const ALUNO_2 = '9c4a5f6e-7d8c-4b9b-9eab-4f5a6b7c8d93'

const habilidades = [...HABILIDADES_DE_ESTEQUIOMETRIA]

export const entradaDeAtividade = (): AtividadeObjetivaInput => ({
  tema: 'estequiometria',
  quantidade: 6,
  contexto: { ...CONTEXTO_DE_QUIMICA },
  habilidades,
  trechos: trechosDeEstequiometria(),
})

export const atividadeDeEstequiometria = (): ConteudoDeAtividade => gerarAtividadeObjetiva.falso(entradaDeAtividade())

export const entradaDePlano = (): PlanoDeAulaInput => ({
  tema: 'reagente limitante',
  duracaoMinutos: 50,
  contexto: { ...CONTEXTO_DE_QUIMICA },
  habilidades,
  trechos: trechosDeEstequiometria(),
})

export const entradaDeAdaptacao = (): AdaptacaoInput => ({
  conteudo: atividadeDeEstequiometria(),
  adaptacao: { tipos: ['linguagem_direta', 'tempo_adicional'], tempoExtraPercentual: 50 },
})

/** A questão do reagente limitante: a frase da página 5 é, palavra por palavra, a alternativa correta. */
export function questaoDoReagenteLimitante(): ConteudoDeAtividade['questoes'][number] {
  const questao = atividadeDeEstequiometria().questoes.find((candidata) => candidata.enunciado.includes('reagente limitante'))
  if (questao === undefined) throw new Error('a atividade de teste deveria ter a questão do reagente limitante')
  return questao
}

export function entradaDoTutor(duvida: string): TutorInput {
  const questao = questaoDoReagenteLimitante()
  return {
    duvida,
    contexto: { ...CONTEXTO_DE_QUIMICA },
    trechos: trechosDeEstequiometria(),
    questao: { numero: 5, enunciado: questao.enunciado, alternativas: questao.alternativas, habilidade: questao.habilidade },
    memoria: [
      { habilidade: questao.habilidade, acertos: 1, erros: 3 },
      { habilidade: habilidades[0] ?? questao.habilidade, acertos: 4, erros: 0 },
    ],
    turnosAnteriores: [],
  }
}

export const entradaDoAssistente = (mensagem = 'monta uma atividade com 5 questões sobre reagente limitante'): AssistenteInput => ({
  mensagem,
  contexto: { ...CONTEXTO_DE_QUIMICA },
  trechos: trechosDeEstequiometria([5, 6]),
  turnosAnteriores: [],
})

export const entradaDoRelatorio = (): RelatorioInput => ({
  titulo: 'Atividade — estequiometria',
  respondentes: 30,
  questoes: [
    { numero: 1, habilidade: habilidades[0] ?? { codigo: 'X', descricao: 'x' }, gabarito: 3, marcacoes: [2, 1, 2, 25], emBranco: 0 },
    { numero: 2, habilidade: habilidades[2] ?? { codigo: 'X', descricao: 'x' }, gabarito: 2, marcacoes: [3, 15, 8, 2], emBranco: 2 },
    { numero: 3, habilidade: habilidades[3] ?? { codigo: 'X', descricao: 'x' }, gabarito: 0, marcacoes: [30, 0, 0, 0], emBranco: 0 },
  ],
})

const SERIE_2 = { id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', etapa: 'em', ano: 2 } as const
const SERIE_1 = { id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', etapa: 'em', ano: 1 } as const
const QUIMICA = { id: 'c3d4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e7f', nome: 'Química' } as const
const FISICA = { id: 'd4e5f6a7-b8c9-4d0e-9f2a-3b4c5d6e7f80', nome: 'Física' } as const

/** Os agregados como o domínio os monta, nas formas do contrato: dois recortes com grupo mínimo e um que ficou de fora. */
export const entradaDoAnalista = (): AnalistaInput => ({
  periodo: { inicio: '2026-09-28', fim: '2026-10-02' },
  escola: {
    atividadesAplicadas: 7,
    lotesAprovados: 5,
    lotesEsperando: 2,
    versoesAdaptadasAprovadas: 1,
    trocasComOTutor: 312,
    sinais: { travou: 14, resposta_pronta: 9, duvida_repetida: 6, atencao_humana: 1 },
  },
  recortes: [
    {
      serie: { ...SERIE_2 },
      disciplina: { ...QUIMICA },
      professores: 2,
      alunos: 61,
      lotesAprovados: 4,
      acertoPercentual: 54,
      porHabilidade: [
        { habilidade: habilidades[0] ?? { codigo: 'X', descricao: 'x' }, acertos: 88, total: 180 },
        { habilidade: habilidades[2] ?? { codigo: 'X', descricao: 'x' }, acertos: 58, total: 90 },
      ],
    },
    {
      serie: { ...SERIE_1 },
      disciplina: { ...QUIMICA },
      professores: 3,
      alunos: 92,
      lotesAprovados: 1,
      acertoPercentual: 71,
      porHabilidade: [
        { habilidade: habilidades[1] ?? { codigo: 'X', descricao: 'x' }, acertos: 197, total: 240 },
        { habilidade: habilidades[3] ?? { codigo: 'X', descricao: 'x' }, acertos: 30, total: 60 },
      ],
    },
  ],
  recortesNominais: [{ serie: { ...SERIE_2 }, disciplina: { ...FISICA } }],
  limiarDeAcertoBaixoPercentual: 60,
})
