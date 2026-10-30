import { ErroDeDominio, ErroDeIa, proporFerramenta, type Banco, type EntradaDoAssistente } from '@educa/nucleo'
import {
  ErrorCode,
  conteudoDaMensagemDoAgenteSchema,
  conteudoDaMensagemDoUsuarioSchema,
  conversaDoAssistenteResponseSchema,
  nomeDaSerie,
  type ConversaDoAssistenteQuery,
  type MensagemAoAssistenteRequest,
  type ConversaDoAssistenteResponse,
  type ExecucaoAceitaResponse,
} from '@educa/shared'
import type { AgendadorDeExecucoes } from '../ia/agendador-de-execucoes.js'
import type { BuscaDeTrechos, TrechoDoMaterial } from '../material/busca-de-trechos.js'
import { exigirCitacoesEntregues } from './citacoes.js'
import { ConversaRepository, type MensagemGravada, type PerguntaDaExecucao } from './conversa.repository.js'
import { ExecucaoDoPedidoRepository } from './execucao-do-pedido.repository.js'
import type { LimiteDePedidosDeIa } from './limite-de-pedidos-de-ia.js'
import { TurmaDoProfessorRepository } from './turma-do-professor.repository.js'

/** Quantos trechos do material acompanham a mensagem do professor (o teto de `esquemaEntradaDoAssistente`). */
export const TRECHOS_NA_CONVERSA = 6
/** Quantas mensagens anteriores acompanham a nova, e o tamanho de cada uma (os tetos da tarefa). */
export const TURNOS_ANTERIORES_NA_CONVERSA = 8
const TAMANHO_MAXIMO_DO_TURNO = 2000
const TAMANHO_MAXIMO_DO_CONTEXTO = 60

/** Série e disciplina como a tarefa as recebe: o nome que a escola deu, sem nome de turma nem de pessoa. */
export function contextoDaTarefa(turma: { serie: { etapa: 'ef_anos_finais' | 'em'; ano: number }; disciplina: string }): { serie: string; disciplina: string } {
  return { serie: nomeDaSerie(turma.serie).slice(0, TAMANHO_MAXIMO_DO_CONTEXTO), disciplina: turma.disciplina.slice(0, TAMANHO_MAXIMO_DO_CONTEXTO) }
}

function paraATela(mensagem: MensagemGravada): unknown {
  const comum = { id: mensagem.id, criadaEm: mensagem.criadaEm.toISOString() }
  if (mensagem.autor === 'usuario') {
    return { ...comum, autor: 'usuario', ...conteudoDaMensagemDoUsuarioSchema.parse(mensagem.conteudo), turmaId: mensagem.turmaId, disciplinaId: mensagem.disciplinaId }
  }
  // O conteúdo gravado é validado de novo na leitura (regra 30, item 7).
  return { ...comum, autor: 'agente', ...conteudoDaMensagemDoAgenteSchema.parse(mensagem.conteudo) }
}

/** O texto de uma mensagem gravada, para acompanhar a próxima como turno anterior. */
function turnoAnterior(mensagem: MensagemGravada): EntradaDoAssistente['turnosAnteriores'][number] {
  const texto = mensagem.autor === 'usuario' ? conteudoDaMensagemDoUsuarioSchema.parse(mensagem.conteudo).texto : conteudoDaMensagemDoAgenteSchema.parse(mensagem.conteudo).texto
  return { autor: mensagem.autor === 'usuario' ? 'professor' : 'assistente', texto: texto.slice(0, TAMANHO_MAXIMO_DO_TURNO) }
}

/**
 * A conversa do professor com o Assistente de ensino (MVP, A2; D18).
 *
 * - **Só o próprio professor a lê** (regra 70, item 8): escola, ano e dono vêm da sessão, e não há leitura por outra pessoa.
 * - **O envio grava a mensagem dele e a execução na mesma transação**, responde `202` e roda depois. A mesma
 *   `chaveEnvio` devolve a mesma execução, com uma mensagem e uma resposta (D49).
 * - **O Assistente responde com texto, ou com a proposta de ferramenta**: a pergunta "quer abrir a ferramenta?". A
 *   proposta **não gera nada**: gerar é outro pedido, `POST /v1/ferramentas/:ferramenta/gerar`, depois de o professor
 *   escolher. A turma e a disciplina da proposta são as da mensagem dele, nunca do modelo.
 * - **"Só conversar" é a outra opção da pergunta, com o mesmo peso**: a mensagem com `resposta: 'so_conversar'` é
 *   respondida em texto, sobre o último pedido dele, e nunca com outra proposta. Sem a marca, nada muda.
 * - **Pedido de adaptação vira texto que aponta a ferramenta** (a Adaptação recebe só o tipo, D67), e **pedido de
 *   julgar texto ou resposta de aluno, ou de dar nota, conceito ou pontuação, é recusado por regra fixa da tarefa**,
 *   sem chamar modelo; a resposta que trouxer nota é recusada na conferência da saída, e nada é gravado (D55).
 * - **O texto do professor mora só em `mensagem_agente`**: não vai para `execucao_agente.entrada`, consumo, auditoria
 *   nem log (regra 20, item 9).
 */
export class AssistenteService {
  constructor(
    private readonly banco: Banco,
    private readonly agendador: AgendadorDeExecucoes,
    private readonly limite: LimiteDePedidosDeIa,
    private readonly trechos: BuscaDeTrechos,
  ) {}

  /** `GET /v1/assistente/conversa`: uma página da thread do professor, da mais antiga para a mais nova, e o `anterior` quando há mais para trás. */
  async conversa({ antes, limite }: ConversaDoAssistenteQuery): Promise<ConversaDoAssistenteResponse> {
    const linhas = await new ConversaRepository(this.banco).anteriores(antes?.toLowerCase(), limite + 1)
    const pagina = linhas.slice(0, limite)
    const anterior = linhas.length > limite ? pagina.at(-1)?.id : undefined
    return conversaDoAssistenteResponseSchema.parse({ mensagens: pagina.reverse().map(paraATela), ...(anterior === undefined ? {} : { anterior }) })
  }

  /** `POST /v1/assistente/mensagens`: grava a pergunta e a execução, e responde o id dela. */
  async enviar(pedido: MensagemAoAssistenteRequest): Promise<ExecucaoAceitaResponse> {
    await this.limite.contar()
    const turmaId = pedido.turmaId.toLowerCase()
    const disciplinaId = pedido.disciplinaId.toLowerCase()
    // A turma e a disciplina de outra pessoa, de outra escola ou inexistentes respondem igual (regra 10, item 6).
    if ((await new TurmaDoProfessorRepository(this.banco).turmaComDisciplina(turmaId, disciplinaId)) === undefined) throw new ErroDeDominio(ErrorCode.NAO_ENCONTRADO)

    // O que a execução leu antes de chamar o modelo, e que a conclusão usa: só existe depois de `entrada` rodar.
    let lido: { pergunta: PerguntaDaExecucao; entregues: readonly TrechoDoMaterial[] } | undefined
    return this.agendador.agendar({
      tarefa: proporFerramenta,
      chaveEnvio: pedido.chaveEnvio,
      // A marca de "só conversar" é de lista fechada, e fica com a execução; o texto da professora, só na conversa.
      entradaDaExecucao: { tarefa: 'propor_ferramenta', ...(pedido.resposta === undefined ? {} : { resposta: pedido.resposta }) },
      aoGravar: async (tx, execucaoId) => {
        const conversa = new ConversaRepository(tx)
        await conversa.gravarDoUsuario(await conversa.garantirThread(), execucaoId, { texto: pedido.texto, turmaId, disciplinaId })
      },
      entrada: async () => {
        const conversa = new ConversaRepository(this.banco)
        // A pergunta gravada, e não a do corpo: no reenvio com a mesma chave, vale a que entrou na conversa.
        const pergunta = await conversa.perguntaDaChave(pedido.chaveEnvio)
        if (pergunta === undefined) throw new ErroDeDominio(ErrorCode.NAO_ENCONTRADO)
        // O vínculo é conferido de novo na hora de rodar: quem saiu da turma depois do `202` não recebe resposta sobre ela.
        const turma = await new TurmaDoProfessorRepository(this.banco).turmaComDisciplina(pergunta.turmaId, pergunta.disciplinaId)
        if (turma === undefined) throw new ErroDeDominio(ErrorCode.NAO_ENCONTRADO)
        const mensagem = conteudoDaMensagemDoUsuarioSchema.parse(pergunta.conteudo).texto
        const turnosAnteriores = (await conversa.anteriores(pergunta.id, TURNOS_ANTERIORES_NA_CONVERSA)).reverse().map(turnoAnterior)
        // "Só conversar" (D18): a marca gravada com a execução. A resposta é sobre o último pedido dela, e é para ele
        // que se buscam os trechos: a fala "só conversar" não diz de que assunto se trata.
        const semProposta = (await new ExecucaoDoPedidoRepository(this.banco).entradaDaChave(pedido.chaveEnvio, 'propor_ferramenta')).resposta === 'so_conversar'
        const ultimoPedido = turnosAnteriores.findLast((turno) => turno.autor === 'professor')?.texto
        const procurado = semProposta && ultimoPedido !== undefined ? `${ultimoPedido} ${mensagem}` : mensagem
        const entregues = await this.trechos.buscar({ texto: procurado, disciplinaId: pergunta.disciplinaId, limite: TRECHOS_NA_CONVERSA })
        lido = { pergunta, entregues }
        return {
          mensagem,
          contexto: contextoDaTarefa(turma),
          trechos: entregues.map(({ materialId, pagina, texto }) => ({ materialId, pagina, texto })),
          turnosAnteriores,
          ...(semProposta ? { semProposta } : {}),
        }
      },
      aoConcluir: async (saida, tx, execucaoId) => {
        if (lido === undefined) throw new ErroDeIa('IA_ENTRADA_INVALIDA')
        const { pergunta, entregues } = lido
        if (saida.tipo === 'texto') exigirCitacoesEntregues(saida.citacoes, entregues)
        // A turma e a disciplina da proposta são as da mensagem do professor: o modelo não conhece id nenhum.
        const conteudo = conteudoDaMensagemDoAgenteSchema.safeParse(
          saida.tipo === 'texto' ? saida : { ...saida, proposta: { ferramenta: saida.proposta.ferramenta, parametros: { ...saida.proposta.parametros, turmaId: pergunta.turmaId, disciplinaId: pergunta.disciplinaId } } },
        )
        if (!conteudo.success) throw new ErroDeIa('IA_SAIDA_INVALIDA')
        return { tipo: 'mensagem', mensagemId: await new ConversaRepository(tx).gravarDoAgente(pergunta.threadId, execucaoId, conteudo.data) }
      },
    })
  }
}
