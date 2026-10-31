import { DomainException, systemClock, type Database, type Clock } from '@educa/core'
import { ErrorCode, sinaisResponseSchema, usoDoTutorResponseSchema, MAXIMO_DE_ALUNOS_NO_USO, MAXIMO_DE_GRUPOS_DE_SINAL, type SinaisQuery, type UsoDoTutorQuery, type SinaisResponse, type UsoDoTutorResponse } from '@educa/shared'
import { SupervisaoDoTutorRepository, type SinalDaTurma } from './supervisao.repository.js'

/** O agrupado de "Seu time" olha os últimos sete dias (o contrato de `GET /v1/sinais`). */
export const DIAS_DO_AGRUPADO_DE_SINAIS = 7
const MS_POR_DIA = 86_400_000

/**
 * O sinal como o professor o recebe. O `atencao_humana` sai **só com o tipo, o aluno e a hora**: nem a atividade, nem a
 * questão, nem o material, nem a página, nem nada da conversa (D36). O schema estrito recusa qualquer campo a mais.
 */
function paraOProfessor(sinal: SinalDaTurma): unknown {
  const comum = { id: sinal.id, tipo: sinal.tipo, aluno: { id: sinal.alunoId, nome: sinal.nome }, criadoEm: sinal.criadoEm.toISOString() }
  if (sinal.tipo === 'atencao_humana') return comum
  return { ...comum, atividadeAplicadaId: sinal.atividadeAplicadaId, questao: sinal.questao, materialId: sinal.materialId, pagina: sinal.pagina }
}

/**
 * O que o professor da turma vê do Tutor (MVP, A4; D8, D34, D47; regra 70, itens 4 e 7): os sinais e o uso. É o que
 * faz o Tutor ser supervisionado, e não vigiado: o professor vê **que** o aluno usou, **onde** e **quando**, e os
 * quatro fatos que viram sinal; não lê a conversa, não vê tempo parado, navegação nem quem não usou.
 *
 * As duas rotas pedem a turma e conferem o vínculo confirmado do professor nela. A turma de outro professor, de outra
 * escola, de outro ano e a que não existe respondem igual, `NAO_ENCONTRADO` (regra 10, item 6). Dentro da turma, cada
 * professor vê o que é da disciplina dele (`SupervisaoDoTutorRepository`).
 *
 * As duas continuam respondendo com a função `sinais_para_o_professor` suspensa: suspender para de produzir sinal
 * novo, não apaga os que existem, e não tira do professor o uso do Tutor.
 */
export class SupervisaoDoTutorService {
  constructor(
    private readonly banco: Database,
    private readonly relogio: Clock = systemClock,
  ) {}

  async #turmaDoProfessor(repositorio: SupervisaoDoTutorRepository, turmaId: string): Promise<string> {
    const id = turmaId.toLowerCase()
    if (!(await repositorio.turmaDoProfessor(id))) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    return id
  }

  /** `GET /v1/sinais?turmaId=`: uma página dos sinais, do mais novo para o mais antigo, e o agrupado dos últimos sete dias. */
  async sinais({ turmaId, pagina, limite }: SinaisQuery): Promise<SinaisResponse> {
    const repositorio = new SupervisaoDoTutorRepository(this.banco, this.relogio)
    const turma = await this.#turmaDoProfessor(repositorio, turmaId)
    const linhas = await repositorio.sinais(turma, pagina?.toLowerCase(), limite + 1)
    const itens = linhas.slice(0, limite)
    const proxima = linhas.length > limite ? itens.at(-1)?.id : undefined
    const grupos = await repositorio.grupos(turma, new Date(this.relogio.agora().getTime() - DIAS_DO_AGRUPADO_DE_SINAIS * MS_POR_DIA), MAXIMO_DE_GRUPOS_DE_SINAL)
    return sinaisResponseSchema.parse({ itens: itens.map(paraOProfessor), ...(proxima === undefined ? {} : { proxima }), grupos })
  }

  /** `GET /v1/tutor/uso?turmaId=`: quem usou o Tutor, quantas trocas hoje, quando foi a última e em que estava; o freio do dia e o pacote do mês. */
  async uso({ turmaId }: UsoDoTutorQuery): Promise<UsoDoTutorResponse> {
    const repositorio = new SupervisaoDoTutorRepository(this.banco, this.relogio)
    const turma = await this.#turmaDoProfessor(repositorio, turmaId)
    const ultimas = await repositorio.ultimasTrocas(turma, MAXIMO_DE_ALUNOS_NO_USO)
    const trocasDeHoje = await repositorio.trocasDeHoje(ultimas.map((ultima) => ultima.alunoId))
    const { limiteDoDia, pacoteDaTurmaNoMes } = await repositorio.limites(turma)
    return usoDoTutorResponseSchema.parse({
      turmaId: turma,
      limiteDoDia,
      trocasDaTurmaNoMes: await repositorio.trocasDaTurmaNoMes(turma),
      pacoteDaTurmaNoMes,
      alunos: ultimas.map((ultima) => ({
        aluno: { id: ultima.alunoId, nome: ultima.nome },
        trocasHoje: trocasDeHoje.get(ultima.alunoId) ?? 0,
        ultimaTrocaEm: ultima.ultimaTrocaEm.toISOString(),
        ultimaReferencia: { atividadeAplicadaId: ultima.atividadeAplicadaId, questao: ultima.questao, materialId: ultima.materialId, pagina: ultima.pagina },
      })),
    })
  }
}
