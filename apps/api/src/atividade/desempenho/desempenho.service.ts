import { ErroDeDominio, RegistroDeAuditoria, sessaoDaRequisicao, type Banco } from '@educa/nucleo'
import { alcanceDe, ErrorCode, desempenhoDaTurmaResponseSchema, MAXIMO_DE_HABILIDADES_NO_DESEMPENHO, type DesempenhoDaTurmaQuery, type DesempenhoDaTurmaResponse } from '@educa/shared'
import { DesempenhoRepository, type DisciplinasDaLeitura } from './desempenho.repository.js'

const registro = new RegistroDeAuditoria()

interface Soma {
  acertos: number
  total: number
}

/**
 * `GET /v1/turmas/:id/desempenho` (MVP, A3; D34, D45, D46): o acerto por habilidade da turma e de cada aluno dela,
 * **só de lote aprovado**. Correção pendente ou rejeitada não entra em número nenhum. São contagens de questões:
 * não há nota, conceito, faixa, posição nem texto sobre aluno.
 *
 * - **A professora** com vínculo `confirmado` na turma lê o desempenho **nas disciplinas dela** naquela turma, sem
 *   registro. A professora de outra turma responde como inexistente.
 * - **A coordenação** (`nominal_auditado`) é obrigada a dizer a finalidade, e a leitura grava `turma.desempenho_lido`
 *   **na mesma transação, a cada leitura, antes de responder** (regra 20, item 10): sem registro, sem resposta. A
 *   finalidade é conferida antes de procurar a turma, então a falta dela responde igual para qualquer id. A turma de
 *   outra escola responde como inexistente, **sem** gravar auditoria.
 * - Entram os alunos que estão na turma agora; a soma da turma é a soma deles, para o número da tela fechar.
 */
export class DesempenhoService {
  constructor(private readonly banco: Banco) {}

  async ler(turmaId: string, { finalidade }: DesempenhoDaTurmaQuery): Promise<DesempenhoDaTurmaResponse> {
    const alcance = alcanceDe(sessaoDaRequisicao().papel, 'desempenho_da_turma', 'ler')
    const nominalAuditado = alcance === 'nominal_auditado'
    if (!nominalAuditado && alcance !== 'turma_vinculada') throw new ErroDeDominio(ErrorCode.NAO_ENCONTRADO)
    if (nominalAuditado && finalidade === undefined) throw new ErroDeDominio(ErrorCode.ENTRADA_INVALIDA)

    const resposta = await this.banco.transaction(async (tx) => {
      const desempenho = new DesempenhoRepository(tx)
      let disciplinas: DisciplinasDaLeitura
      if (nominalAuditado) {
        if (!(await desempenho.turmaDaEscola(turmaId))) throw new ErroDeDominio(ErrorCode.NAO_ENCONTRADO)
        disciplinas = 'todas'
      } else {
        disciplinas = await desempenho.disciplinasDaProfessora(turmaId)
        if (disciplinas.length === 0) throw new ErroDeDominio(ErrorCode.NAO_ENCONTRADO)
      }

      const lotesAprovados = await desempenho.lotesAprovados(turmaId, disciplinas)
      const alunos = await desempenho.alunos(turmaId)
      const acertos = lotesAprovados === 0 ? [] : await desempenho.acertosPorAlunoEHabilidade(turmaId, disciplinas)
      const descricoes = lotesAprovados === 0 ? new Map<string, string>() : await desempenho.descricoesDasHabilidades(turmaId, disciplinas)

      const habilidade = (codigo: string) => ({ codigo, descricao: descricoes.get(codigo) ?? codigo })
      const daTurma = new Set(alunos.map((aluno) => aluno.alunoId))
      const porAluno = new Map<string, Map<string, Soma>>()
      const porHabilidade = new Map<string, Soma & { alunosAbaixoDaMetade: number }>()
      for (const linha of acertos) {
        // Quem saiu da turma não é mais aluno desta professora: o resultado dele sai do painel da turma (regra 20, item 5).
        if (!daTurma.has(linha.alunoId)) continue
        const doAluno = porAluno.get(linha.alunoId) ?? new Map<string, Soma>()
        doAluno.set(linha.codigo, { acertos: linha.acertos, total: linha.total })
        porAluno.set(linha.alunoId, doAluno)
        const soma = porHabilidade.get(linha.codigo) ?? { acertos: 0, total: 0, alunosAbaixoDaMetade: 0 }
        soma.acertos += linha.acertos
        soma.total += linha.total
        if (linha.acertos * 2 < linha.total) soma.alunosAbaixoDaMetade += 1
        porHabilidade.set(linha.codigo, soma)
      }
      const codigos = [...porHabilidade.keys()].sort().slice(0, MAXIMO_DE_HABILIDADES_NO_DESEMPENHO)

      const montada = {
        turmaId,
        lotesAprovados,
        porHabilidade: codigos.map((codigo) => ({ habilidade: habilidade(codigo), ...(porHabilidade.get(codigo) ?? { acertos: 0, total: 1, alunosAbaixoDaMetade: 0 }) })),
        alunos: alunos.map((aluno) => {
          const doAluno = porAluno.get(aluno.alunoId) ?? new Map<string, Soma>()
          const partes = codigos.flatMap((codigo) => {
            const soma = doAluno.get(codigo)
            return soma === undefined ? [] : [{ habilidade: habilidade(codigo), acertos: soma.acertos, total: soma.total }]
          })
          return { alunoId: aluno.alunoId, nome: aluno.nome, acertos: partes.reduce((soma, parte) => soma + parte.acertos, 0), total: partes.reduce((soma, parte) => soma + parte.total, 0), porHabilidade: partes }
        }),
      }
      if (nominalAuditado && finalidade !== undefined) {
        await registro.gravar(tx, 'turma.desempenho_lido', { entidadeId: turmaId, depois: { quantidade: montada.alunos.length, lotesAprovados }, finalidade })
      }
      return montada
    })
    return desempenhoDaTurmaResponseSchema.parse(resposta)
  }
}
