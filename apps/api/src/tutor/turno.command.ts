import {
  diaDeUso,
  DomainException,
  globalMeter,
  METRICS,
  requestSessao,
  systemClock,
  type Clock,
  type Database,
  type DatabaseTransaction,
  type Meter,
  type SuspensaoDeFuncao,
  type TutorInput,
  type TutorOutput,
  turnoDoTutor,
} from '@educa/core'
import {
  ErrorCode,
  conteudoDeAtividadeSchema,
  diagnosticoGravadoSchema,
  MAXIMO_DE_ITENS_NA_MEMORIA,
  nomeDaSerie,
  type Habilidade,
  type MensagemAoTutorRequest,
  type ResultadoGravado,
} from '@educa/shared'
import { exigirCitacoesEntregues } from '../assistente/citacoes.js'
import type { EntradaDaTarefa, ExecucaoCommand, ExecucaoLida, Preparado, SaidaDaTarefa } from '../ia/execucao-command.js'
import type { TrechoDoMaterial, TrechoSearch } from '../material/trecho-search.js'
import { sinaisDeTrabalhoDoTurno, TURNOS_QUE_A_REGRA_OLHA } from './sinais-do-turno.js'
import { TutorDoAlunoRepository, type AtividadeDaTurma, type MaterialDaTurma, type PerguntaGravada, type TrabalhoDoAluno, type TurmaDoAluno } from './tutor.repository.js'

/** Quantos trechos do material acompanham a dúvida, e quantos turnos anteriores (os tetos de `tutorInputSchema`). */
export const TRECHOS_NO_TURNO = 6
export const TURNOS_ANTERIORES_NO_TURNO = 8
/** Quantas habilidades a memória leva à tarefa (o teto de `tutorInputSchema`). */
export const HABILIDADES_NA_MEMORIA_DA_TAREFA = 12
const TAMANHO_MAXIMO_DO_TURNO = 2000
const TAMANHO_MAXIMO_DO_CONTEXTO = 60
const FUNCAO_DOS_SINAIS = 'sinais_para_o_professor'

/** O que o `POST` conferiu antes de aceitar a pergunta, e o comando confere de novo ao rodar: a turma do aluno e o que ele referenciou, já alcançado. */
export interface Alcance {
  readonly turma: TurmaDoAluno
  readonly atividade?: AtividadeDaTurma
  readonly material?: MaterialDaTurma
}

type MemoriaDoTrabalho = TutorInput['memoria']
type QuestaoEmAndamento = NonNullable<TutorInput['questao']>

const listaEmPortugues = new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' })

/** Fora do alcance, de outra escola, de outro ano ou inexistente: a mesma resposta (regra 10, item 6). */
function naoEncontrado(): never {
  throw new DomainException(ErrorCode.NAO_ENCONTRADO)
}

/** O material da turma precisa ser da disciplina da atividade, e a página aberta precisa existir nele. */
function conferirOMaterial(atividade: AtividadeDaTurma | undefined, material: MaterialDaTurma | undefined, pedido: Pick<MensagemAoTutorRequest, 'pagina'>): void {
  if (atividade !== undefined && material !== undefined && material.disciplinaId !== atividade.disciplinaId) naoEncontrado()
  if (material !== undefined && pedido.pagina !== undefined && pedido.pagina > (material.paginas ?? 0)) naoEncontrado()
}

/** As habilidades das questões de uma atividade, pelo código: é de onde sai a descrição que a correção não guarda. */
function habilidadesDaAtividade(conteudo: unknown): Map<string, Habilidade> {
  const lido = conteudoDeAtividadeSchema.safeParse(conteudo)
  return new Map(lido.success ? lido.data.questoes.map((questao) => [questao.habilidade.codigo, questao.habilidade]) : [])
}

/**
 * A questão em que o aluno está, **campo a campo**: número, enunciado, alternativas e habilidade. O gabarito e a
 * explicação ficam no artefato, com a atividade aberta ou encerrada: o Tutor não tem como entregar o que não recebeu
 * (`docs/aia/tutor.md`, N4). Nunca espalhe a questão do artefato aqui.
 */
export function questaoSemGabarito(conteudo: unknown, numero: number): QuestaoEmAndamento | undefined {
  const lido = conteudoDeAtividadeSchema.safeParse(conteudo)
  const questao = lido.success ? lido.data.questoes[numero - 1] : undefined
  if (questao === undefined) return undefined
  return { numero, enunciado: questao.enunciado, alternativas: [...questao.alternativas], habilidade: { codigo: questao.habilidade.codigo, descricao: questao.habilidade.descricao } }
}

/**
 * A memória que vai à tarefa (D66): acertos e erros **por habilidade**, somados dos lotes aprovados. Só número e
 * habilidade do catálogo. O trabalho sem lote aprovado chega aqui com `porHabilidade` nulo e não entra na soma.
 */
export function memoriaDoTrabalho(trabalhos: readonly TrabalhoDoAluno[]): MemoriaDoTrabalho {
  const soma = new Map<string, { habilidade: Habilidade; acertos: number; erros: number }>()
  for (const trabalho of trabalhos) {
    if (trabalho.porHabilidade === null) continue
    const habilidades = habilidadesDaAtividade(trabalho.conteudo)
    for (const item of diagnosticoGravadoSchema.parse(trabalho.porHabilidade)) {
      const habilidade = habilidades.get(item.codigo)
      if (habilidade === undefined) continue
      const atual = soma.get(item.codigo) ?? { habilidade, acertos: 0, erros: 0 }
      soma.set(item.codigo, { habilidade, acertos: atual.acertos + item.acertos, erros: atual.erros + (item.total - item.acertos) })
    }
  }
  return [...soma.values()].sort((a, b) => b.erros - a.erros || a.habilidade.codigo.localeCompare(b.habilidade.codigo)).slice(0, HABILIDADES_NA_MEMORIA_DA_TAREFA)
}

/**
 * O que o aluno alcança, conferido no servidor: o `POST` o confere ao aceitar a pergunta, e o `preparar` do comando o repete ao
 * rodar. É uma peça só para as duas conferências não divergirem.
 */
export class AlcanceDoAluno {
  /** As recusas por falta de material da série, **por turma** (RF8): o único rótulo é a turma, nunca o aluno, a escola nem o texto. */
  readonly #recusasSemMaterial: ReturnType<Meter['createCounter']>

  constructor(
    private readonly banco: Database,
    private readonly trechos: TrechoSearch,
    private readonly relogio: Clock = systemClock,
    medidor: Meter = globalMeter(),
  ) {
    this.#recusasSemMaterial = medidor.createCounter(METRICS.tutorRecusadoSemMaterial, { description: 'Perguntas do Tutor recusadas por falta de material da série, por turma' })
  }

  /**
   * O que o aluno referencia **fora do material**, conferido: a turma dele, a atividade aplicada a ela e a questão. Fora do alcance, de outra escola, de outro ano ou inexistente:
   * `NAO_ENCONTRADO`, igual para todos (regra 10, item 6). O material vem depois, em `doMaterial`, porque a D36 passa na frente dele.
   */
  async alcance(pedido: Pick<MensagemAoTutorRequest, 'atividadeAplicadaId' | 'questao'>): Promise<Alcance> {
    const tutor = new TutorDoAlunoRepository(this.banco, this.relogio)
    const turma = (await tutor.turmaDoAluno()) ?? naoEncontrado()
    const atividade = pedido.atividadeAplicadaId === undefined ? undefined : ((await tutor.atividadeDaTurma(turma.turmaId, pedido.atividadeAplicadaId.toLowerCase())) ?? naoEncontrado())
    if (atividade !== undefined && pedido.questao !== undefined && questaoSemGabarito(atividade.conteudo, pedido.questao) === undefined) naoEncontrado()
    return { turma, ...(atividade === undefined ? {} : { atividade }) }
  }

  /**
   * O material que o aluno referencia, e a série dele. O material precisa ser da turma: da disciplina que ela tem, **declarado para a série dela e próprio ou de licença vigente hoje**; com atividade
   * e material juntos, da disciplina da atividade. Fora disso, `NAO_ENCONTRADO` (a página aberta de uma edição substituída responde como o inexistente, como antes da F4).
   *
   * Com atividade ou material, a disciplina é conhecida, e a escola precisa ter material **da série** dela: senão, `SEM_MATERIAL_DA_SERIE`, contado por turma (nunca por aluno) e sem nada na conversa.
   * Sem atividade e sem material é o modo livre, que não muda.
   */
  async doMaterial(base: Alcance, pedido: Pick<MensagemAoTutorRequest, 'materialId' | 'pagina'>): Promise<Alcance> {
    const tutor = new TutorDoAlunoRepository(this.banco, this.relogio)
    const { turma, atividade } = base
    const material = pedido.materialId === undefined ? undefined : ((await tutor.materialDaTurma(turma.turmaId, turma.serieId, this.trechos.hoje(), pedido.materialId.toLowerCase())) ?? naoEncontrado())
    conferirOMaterial(atividade, material, pedido)
    const disciplinaId = atividade?.disciplinaId ?? material?.disciplinaId
    await this.#exigirMaterialDaSerie(turma, disciplinaId)
    return { ...base, ...(material === undefined ? {} : { material }) }
  }

  /** Com atividade ou material a disciplina é conhecida, e a escola precisa ter material da série dela: senão, `SEM_MATERIAL_DA_SERIE`, contado por turma. Sem disciplina é o modo livre, que não muda. */
  async #exigirMaterialDaSerie(turma: TurmaDoAluno, disciplinaId: string | undefined): Promise<void> {
    if (disciplinaId !== undefined && !(await this.trechos.existeMaterialDaSerie({ serieId: turma.serieId, disciplinaId }))) {
      this.#recusasSemMaterial.add(1, { turma_id: turma.turmaId })
      throw new DomainException(ErrorCode.SEM_MATERIAL_DA_SERIE)
    }
  }

  /** Série e disciplina como a tarefa as recebe: o nome que a escola deu, sem nome de turma nem de pessoa. */
  async contexto(alcance: Alcance): Promise<TutorInput['contexto']> {
    let disciplina = alcance.atividade?.disciplina ?? alcance.material?.disciplina
    // Sem atividade e sem material, o Tutor não sabe de que disciplina é a dúvida: recebe as da turma, e pergunta onde o aluno está.
    if (disciplina === undefined) {
      const daTurma = await new TutorDoAlunoRepository(this.banco, this.relogio).disciplinasDaTurma(alcance.turma.turmaId)
      disciplina = daTurma.length === 0 ? 'estudo' : listaEmPortugues.format(daTurma)
    }
    return { serie: nomeDaSerie(alcance.turma.serie).slice(0, TAMANHO_MAXIMO_DO_CONTEXTO), disciplina: disciplina.slice(0, TAMANHO_MAXIMO_DO_CONTEXTO) }
  }
}

/** O que o `preparar` leu antes de chamar o modelo, e que o `concluir` usa: a pergunta gravada e os trechos entregues. */
export interface LidoDoTurno {
  readonly pergunta: PerguntaGravada
  readonly entregues: readonly TrechoDoMaterial[]
}

/**
 * O turno do Tutor como comando registrado (X6, 2.0; D8, D36, D38, D47, D66; regra 70, itens 3 e 4). O `preparar` relê a
 * pergunta **pelo id da execução**, repete o alcance do `POST` e a avaliação aberta, e monta a entrada (trechos, memória,
 * turnos anteriores); o `concluir` grava a resposta e os sinais do turno na transação que conclui a execução.
 *
 * **A D36 não depende da execução.** O `assunto_delicado` que o modelo classifica grava a mensagem fixa e o sinal
 * `atencao_humana` numa transação **própria**, antes de a conclusão condicional correr: a execução que o prazo, a varredura ou a
 * prova que abriu já encerraram não desfaz o encaminhamento do aluno em risco. A avaliação aberta se confere no `preparar` e,
 * de novo, no `concluir`, e só o assunto delicado passa por ela.
 */
export class TurnoDoTutorCommand implements ExecucaoCommand<EntradaDaTarefa<typeof turnoDoTutor>, SaidaDaTarefa<typeof turnoDoTutor>, LidoDoTurno> {
  readonly tarefa = turnoDoTutor
  readonly fila = 'interativa' as const

  constructor(
    private readonly banco: Database,
    private readonly alcance: AlcanceDoAluno,
    private readonly trechos: TrechoSearch,
    private readonly suspensao: SuspensaoDeFuncao,
    private readonly relogio: Clock = systemClock,
  ) {}

  /**
   * Roda depois do `202`, no contexto do aluno. A pergunta é a **gravada** com a execução; o alcance é conferido de novo, com o
   * mesmo filtro do `POST`: quem saiu da turma, o material que saiu do alcance (licença vencida, edição substituída) e a avaliação
   * que abriu entre o `202` e agora falham a execução, sem trecho, sem modelo e sem `consumo_ia`.
   */
  async preparar(execucao: ExecucaoLida): Promise<Preparado<EntradaDaTarefa<typeof turnoDoTutor>, LidoDoTurno>> {
    const tutor = new TutorDoAlunoRepository(this.banco, this.relogio)
    const pergunta = await tutor.perguntaDaExecucao(execucao.id)
    if (pergunta === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const pedidoGravado = { ...(pergunta.atividadeAplicadaId === null ? {} : { atividadeAplicadaId: pergunta.atividadeAplicadaId }), ...(pergunta.materialId === null ? {} : { materialId: pergunta.materialId }) }
    const agora = await this.alcance.doMaterial(await this.alcance.alcance(pedidoGravado), pedidoGravado)
    if (agora.turma.turmaId !== pergunta.turmaId) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    // A avaliação que abriu entre o `202` e agora trava o turno antes de qualquer trabalho: sem trecho, sem memória e sem
    // chamar o modelo. A execução falha com o código da pausa, `trocas()` a ignora e a pergunta fica só em `mensagem_tutor`.
    if ((await tutor.avaliativaAberta(agora.turma.turmaId)) !== undefined) throw new DomainException(ErrorCode.TUTOR_PAUSADO_EM_AVALIACAO)
    const questao = agora.atividade === undefined || pergunta.questao === null ? undefined : questaoSemGabarito(agora.atividade.conteudo, pergunta.questao)
    const entregues = await this.#trechosDoTurno(pergunta, agora, questao)
    const turnosAnteriores = (await tutor.turnosParaATarefa(pergunta, TURNOS_ANTERIORES_NO_TURNO)).reverse().map((turno) => ({ autor: turno.autor, texto: turno.texto.slice(0, TAMANHO_MAXIMO_DO_TURNO) }))
    return {
      lido: { pergunta, entregues },
      // O aluno e a turma vão ao modelo só para o freio do dia e o pacote do mês (D38): são os da sessão e os da pergunta gravada.
      alunoId: requestSessao().usuarioId,
      turmaId: pergunta.turmaId,
      entrada: {
        duvida: pergunta.texto,
        contexto: await this.alcance.contexto(agora),
        trechos: entregues.map(({ materialId, pagina, texto }) => ({ materialId, pagina, texto })),
        ...(questao === undefined ? {} : { questao }),
        memoria: memoriaDoTrabalho(await tutor.trabalhos(MAXIMO_DE_ITENS_NA_MEMORIA)),
        turnosAnteriores,
      },
    }
  }

  /**
   * Grava a resposta do Tutor e os sinais do turno.
   *
   * - **Assunto delicado** (pelos gatilhos, ou pela classificação do modelo), em `antesDeConcluir`, **antes** de a transação da conclusão abrir: a mensagem fixa, com `tipo =
   *   'assunto_delicado'`, e o sinal `atencao_humana`, **sem referência e sem conteúdo**, numa transação própria (D36): fica
   *   mesmo com a avaliação aberta e mesmo com a execução já encerrada. A reexecução relê o que já está gravado (chaves únicas).
   *   **De propósito, esse ramo vem antes de `exigirCitacoesEntregues` e não passa por ela**: a mensagem é fixa, não é escrita
   *   pelo modelo e não leva citação (a tarefa já zera as citações desse turno), então não há página a conferir. Não reordene
   *   nem "conserte": conferir a citação antes seria deixar uma saída inválida do modelo calar o encaminhamento do aluno (D36).
   * - **Atividade avaliativa aberta** descarta a resposta e desfaz a transação: nada é gravado e a troca não conta.
   * - **`resposta_pronta`**: a classificação que a regra da tarefa decidiu, e só com questão em andamento.
   * - **`travou` e `duvida_repetida`**: a regra de `sinais-do-turno.ts`, sobre onde o aluno pediu ajuda.
   *
   * Nenhum sinal leva texto. Com `sinais_para_o_professor` suspensa, os três sinais de aprendizagem não nascem; o `atencao_humana`
   * não depende dela: suspender os sinais de aprendizagem não cala o aviso de que um aluno precisa de um adulto.
   */
  async antesDeConcluir(saida: SaidaDaTarefa<typeof turnoDoTutor>, { pergunta }: LidoDoTurno): Promise<ResultadoGravado | undefined> {
    return saida.classificacao === 'assunto_delicado' ? { tipo: 'mensagem_do_tutor', mensagemId: await this.#encaminhar(pergunta, saida) } : undefined
  }

  async concluir(saida: SaidaDaTarefa<typeof turnoDoTutor>, { pergunta, entregues }: LidoDoTurno, tx: DatabaseTransaction, _execucaoId: string): Promise<ResultadoGravado> {
    // Sem trava, de propósito: a conferência lê e grava em READ COMMITTED, e a avaliação que comita logo depois da leitura ainda
    // deixa a resposta passar. A corrida é aceita: o resultado equivale à ordem serial "a resposta grava antes de a prova abrir"
    // (nenhuma transação lê o que a outra escreve), e a prova que abriu já pausou o Tutor para os turnos seguintes. Uma trava aqui
    // seguraria a escola inteira para fechar uma janela de milissegundos (regra 80); não ponha uma.
    const tutor = new TutorDoAlunoRepository(tx, this.relogio)
    if ((await tutor.avaliativaAberta(pergunta.turmaId)) !== undefined) throw new DomainException(ErrorCode.TUTOR_PAUSADO_EM_AVALIACAO)
    exigirCitacoesEntregues(saida.citacoes, entregues)
    return { tipo: 'mensagem_do_tutor', mensagemId: await this.#saveTurno(tutor, pergunta, saida) }
  }

  /**
   * O encaminhamento da D36, numa transação que não é a da conclusão: o que o `concluir` desfaz, ou o prazo que já encerrou a execução, não o leva junto.
   *
   * O sinal vai para a turma **da pergunta gravada** (`pergunta.turmaId`), sem conferir o vínculo de novo: o aluno transferido durante a chamada
   * ao modelo faz o aviso, sem conteúdo e sem referência, chegar ao professor da turma onde ele fez a pergunta. É escolha da D36: avisar um
   * professor que já não é o da turma é melhor que não avisar ninguém, e o caminho anterior à X6 fazia o mesmo.
   */
  #encaminhar(pergunta: PerguntaGravada, saida: TutorOutput): Promise<string> {
    return this.banco.transaction(async (proprio) => {
      const tutor = new TutorDoAlunoRepository(proprio, this.relogio)
      const mensagemId = await tutor.saveResposta(pergunta, { tipo: 'assunto_delicado', texto: saida.resposta })
      await tutor.tirarReferenciaDaPergunta(pergunta.id)
      await tutor.saveSinal(pergunta.execucaoId, pergunta.turmaId, { tipo: 'atencao_humana' })
      return mensagemId
    })
  }

  async #saveTurno(tutor: TutorDoAlunoRepository, pergunta: PerguntaGravada, saida: TutorOutput): Promise<string> {
    const { execucaoId, turmaId } = pergunta
    const mensagemId = await tutor.saveResposta(pergunta, { tipo: 'texto', texto: saida.resposta, citacoes: saida.citacoes })
    if (await this.suspensao.estaSuspensa(FUNCAO_DOS_SINAIS)) return mensagemId
    if (saida.classificacao === 'pediu_resposta_pronta' && pergunta.atividadeAplicadaId !== null && pergunta.questao !== null) {
      await tutor.saveSinal(execucaoId, turmaId, { tipo: 'resposta_pronta', atividadeAplicadaId: pergunta.atividadeAplicadaId, questao: pergunta.questao })
    }
    // Sob a trava do aluno: duas respostas concluindo juntas não contam a mesma sequência duas vezes.
    await tutor.lockAluno()
    const atual = { atividadeAplicadaId: pergunta.atividadeAplicadaId, questao: pergunta.questao, materialId: pergunta.materialId, pagina: pergunta.pagina, dia: diaDeUso(pergunta.criadaEm) }
    for (const sinal of sinaisDeTrabalhoDoTurno(atual, await tutor.turnosRespondidos(pergunta.id, TURNOS_QUE_A_REGRA_OLHA))) await tutor.saveSinal(execucaoId, turmaId, sinal)
    return mensagemId
  }

  /**
   * Os trechos do material para a dúvida: da disciplina da atividade ou do material, que o `alcance` já conferiu que a
   * turma do aluno tem (a `TrechoSearch` não confere quem pede). A busca leva a dúvida e o enunciado da questão, porque
   * "é a B, né?" sozinho não acha página nenhuma. Com a página que o aluno tem aberta, ela vem na frente. Sem atividade
   * e sem material não há disciplina, e não há trecho.
   */
  async #trechosDoTurno(pergunta: PerguntaGravada, alcance: Alcance, questao: QuestaoEmAndamento | undefined): Promise<TrechoDoMaterial[]> {
    const disciplinaId = alcance.atividade?.disciplinaId ?? alcance.material?.disciplinaId
    if (disciplinaId === undefined) return []
    const achados = await this.trechos.find({
      texto: `${pergunta.texto} ${questao?.enunciado ?? ''}`,
      disciplinaId,
      serieId: alcance.turma.serieId,
      ...(alcance.material === undefined ? {} : { materialId: alcance.material.id }),
      limite: TRECHOS_NO_TURNO,
    })
    return this.#comAPaginaAberta(pergunta, alcance, disciplinaId, achados)
  }

  /** Com a página que o aluno tem aberta, ela vem na frente, sem repetir. */
  async #comAPaginaAberta(pergunta: PerguntaGravada, alcance: Alcance, disciplinaId: string, achados: TrechoDoMaterial[]): Promise<TrechoDoMaterial[]> {
    if (alcance.material === undefined || pergunta.pagina === null) return achados
    // A disciplina vai para a porta, que filtra no repository: o material de outra disciplina não devolve página nenhuma.
    const aberta = (await this.trechos.doMaterial(alcance.material.id, disciplinaId, alcance.turma.serieId)).find((trecho) => trecho.pagina === pergunta.pagina)
    if (aberta === undefined) return achados
    return [aberta, ...achados.filter((trecho) => !(trecho.materialId === aberta.materialId && trecho.pagina === aberta.pagina))].slice(0, TRECHOS_NO_TURNO)
  }
}
