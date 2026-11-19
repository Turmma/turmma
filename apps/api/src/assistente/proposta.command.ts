import { DomainException, LLMError, proporFerramenta, type AssistenteInput, type Database, type DatabaseTransaction } from '@educa/core'
import { ErrorCode, conteudoDaMensagemDoAgenteSchema, conteudoDaMensagemDoUsuarioSchema, type ExecucaoInput, type ResultadoGravado } from '@educa/shared'
import { contextoDaTarefa } from '../ia/contexto-da-tarefa.js'
import type { EntradaDaTarefa, ExecucaoCommand, ExecucaoLida, Preparado, SaidaDaTarefa } from '../ia/execucao-command.js'
import type { TrechoDoMaterial, TrechoSearch } from '../material/trecho-search.js'
import { exigirCitacoesEntregues } from './citacoes.js'
import { ConversaRepository, type MensagemGravada, type PerguntaDaExecucao } from './conversa.repository.js'
import { TurmaDoProfessorRepository } from './turma-do-professor.repository.js'

/** Quantos trechos do material acompanham a mensagem do professor (o teto de `assistenteInputSchema`). */
export const TRECHOS_NA_CONVERSA = 6
/** Quantas mensagens anteriores acompanham a nova, e o tamanho de cada uma (os tetos da tarefa). */
export const TURNOS_ANTERIORES_NA_CONVERSA = 8
const TAMANHO_MAXIMO_DO_TURNO = 2000

/** O texto de uma mensagem gravada, para acompanhar a próxima como turno anterior. */
function turnoAnterior(mensagem: MensagemGravada): AssistenteInput['turnosAnteriores'][number] {
  const texto = mensagem.autor === 'usuario' ? conteudoDaMensagemDoUsuarioSchema.parse(mensagem.conteudo).texto : conteudoDaMensagemDoAgenteSchema.parse(mensagem.conteudo).texto
  return { autor: mensagem.autor === 'usuario' ? 'professor' : 'assistente', texto: texto.slice(0, TAMANHO_MAXIMO_DO_TURNO) }
}

/** O que a execução leu antes de chamar o modelo, e que a conclusão usa: a pergunta gravada e os trechos entregues. */
export interface LidoDaProposta {
  readonly pergunta: PerguntaDaExecucao
  readonly entregues: readonly TrechoDoMaterial[]
}

/**
 * O Assistente de ensino (MVP, A2; D18, D55): responde em texto, ou propõe a ferramenta. A proposta **não gera nada**: gerar
 * é outro pedido, depois de a professora escolher. A turma e a disciplina da proposta são as da mensagem dela, nunca do
 * modelo. Pedido de julgar texto de aluno, ou de dar nota, é recusado por regra fixa da tarefa, e a resposta que trouxer
 * nota é recusada na conferência da saída: nada é gravado.
 */
export class ProporFerramentaCommand implements ExecucaoCommand<EntradaDaTarefa<typeof proporFerramenta>, SaidaDaTarefa<typeof proporFerramenta>, LidoDaProposta> {
  readonly tarefa = proporFerramenta
  readonly fila = 'ferramenta' as const

  constructor(
    private readonly banco: Database,
    private readonly trechos: TrechoSearch,
  ) {}

  /**
   * Roda depois do `202`, no contexto de quem pediu. A pergunta é a **gravada** com a execução (no reenvio com a mesma
   * chave, vale a que entrou na conversa), o vínculo é conferido de novo e o material da série também: o que saiu do
   * alcance entre o `202` e agora falha a execução, sem trecho, sem modelo e sem consumo (RF8).
   */
  async preparar(execucao: ExecucaoLida): Promise<Preparado<EntradaDaTarefa<typeof proporFerramenta>, LidoDaProposta>> {
    // O agendador já conferiu que a execução é da tarefa deste comando.
    const gravada = execucao.entrada as Extract<ExecucaoInput, { tarefa: 'propor_ferramenta' }>
    const conversa = new ConversaRepository(this.banco)
    const pergunta = await conversa.perguntaDaChave(execucao.chaveEnvio)
    if (pergunta === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const turma = await new TurmaDoProfessorRepository(this.banco).turmaComDisciplina(pergunta.turmaId, pergunta.disciplinaId)
    if (turma === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    if (!(await this.trechos.existeMaterialDaSerie({ serieId: turma.serieId, disciplinaId: pergunta.disciplinaId }))) throw new DomainException(ErrorCode.SEM_MATERIAL_DA_SERIE)
    const mensagem = conteudoDaMensagemDoUsuarioSchema.parse(pergunta.conteudo).texto
    const turnosAnteriores = (await conversa.anteriores(pergunta.id, TURNOS_ANTERIORES_NA_CONVERSA)).reverse().map(turnoAnterior)
    // "Só conversar" (D18): a marca gravada com a execução. A resposta é sobre o último pedido dela, e é para ele
    // que se buscam os trechos: a fala "só conversar" não diz de que assunto se trata.
    const semProposta = gravada.resposta === 'so_conversar'
    const ultimoPedido = turnosAnteriores.findLast((turno) => turno.autor === 'professor')?.texto
    const procurado = semProposta && ultimoPedido !== undefined ? `${ultimoPedido} ${mensagem}` : mensagem
    const entregues = await this.trechos.find({ texto: procurado, disciplinaId: pergunta.disciplinaId, serieId: turma.serieId, limite: TRECHOS_NA_CONVERSA })
    return {
      lido: { pergunta, entregues },
      entrada: {
        mensagem,
        contexto: contextoDaTarefa(turma),
        trechos: entregues.map(({ materialId, pagina, texto }) => ({ materialId, pagina, texto })),
        turnosAnteriores,
        ...(semProposta ? { semProposta } : {}),
      },
    }
  }

  async concluir(saida: SaidaDaTarefa<typeof proporFerramenta>, { pergunta, entregues }: LidoDaProposta, tx: DatabaseTransaction, execucaoId: string): Promise<ResultadoGravado> {
    if (saida.tipo === 'texto') exigirCitacoesEntregues(saida.citacoes, entregues)
    // A turma e a disciplina da proposta são as da mensagem do professor: o modelo não conhece id nenhum.
    const conteudo = conteudoDaMensagemDoAgenteSchema.safeParse(
      saida.tipo === 'texto' ? saida : { ...saida, proposta: { ferramenta: saida.proposta.ferramenta, parametros: { ...saida.proposta.parametros, turmaId: pergunta.turmaId, disciplinaId: pergunta.disciplinaId } } },
    )
    if (!conteudo.success) throw new LLMError('IA_SAIDA_INVALIDA')
    return { tipo: 'mensagem', mensagemId: await new ConversaRepository(tx).saveDoAgente(pergunta.threadId, execucaoId, conteudo.data) }
  }
}
