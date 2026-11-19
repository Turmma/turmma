import { DomainException, proporFerramenta, type Database } from '@educa/core'
import {
  ErrorCode,
  conteudoDaMensagemDoAgenteSchema,
  conteudoDaMensagemDoUsuarioSchema,
  conversaDoAssistenteResponseSchema,
  type ConversaDoAssistenteQuery,
  type MensagemAoAssistenteRequest,
  type ConversaDoAssistenteResponse,
  type ExecucaoAceitaResponse,
} from '@educa/shared'
import { ExecucaoDaSessaoRepository } from '../ia/execucao.repository.js'
import type { ExecucaoScheduler } from '../ia/execucao.scheduler.js'
import type { TrechoSearch } from '../material/trecho-search.js'
import { ConversaRepository, type MensagemGravada } from './conversa.repository.js'
import type { IaRequestRateLimit } from './ai-request-rate-limit.js'
import { TurmaDoProfessorRepository } from './turma-do-professor.repository.js'

function paraATela(mensagem: MensagemGravada): unknown {
  const comum = { id: mensagem.id, criadaEm: mensagem.criadaEm.toISOString() }
  if (mensagem.autor === 'usuario') {
    return { ...comum, autor: 'usuario', ...conteudoDaMensagemDoUsuarioSchema.parse(mensagem.conteudo), turmaId: mensagem.turmaId, disciplinaId: mensagem.disciplinaId }
  }
  // O conteúdo gravado é validado de novo na leitura (regra 30, item 7).
  return { ...comum, autor: 'agente', ...conteudoDaMensagemDoAgenteSchema.parse(mensagem.conteudo) }
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
    private readonly banco: Database,
    private readonly agendador: ExecucaoScheduler,
    private readonly limite: IaRequestRateLimit,
    private readonly trechos: TrechoSearch,
  ) {}

  /** `GET /v1/assistente/conversa`: uma página da thread do professor, da mais antiga para a mais nova, e o `anterior` quando há mais para trás. */
  async conversa({ antes, limite }: ConversaDoAssistenteQuery): Promise<ConversaDoAssistenteResponse> {
    const linhas = await new ConversaRepository(this.banco).anteriores(antes?.toLowerCase(), limite + 1)
    const pagina = linhas.slice(0, limite)
    const anterior = linhas.length > limite ? pagina.at(-1)?.id : undefined
    return conversaDoAssistenteResponseSchema.parse({ mensagens: pagina.reverse().map(paraATela), ...(anterior === undefined ? {} : { anterior }) })
  }

  /** `POST /v1/assistente/mensagens`: grava a pergunta e a execução, e responde o id dela. */
  async send(pedido: MensagemAoAssistenteRequest): Promise<ExecucaoAceitaResponse> {
    await this.limite.count()
    const turmaId = pedido.turmaId.toLowerCase()
    const disciplinaId = pedido.disciplinaId.toLowerCase()
    // A turma e a disciplina de outra pessoa, de outra escola ou inexistentes respondem igual (regra 10, item 6).
    const daTurma = await new TurmaDoProfessorRepository(this.banco).turmaComDisciplina(turmaId, disciplinaId)
    if (daTurma === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    // O reenvio da chave que esta pessoa já teve aceita devolve a mesma execução, mesmo que o material tenha saído do alcance depois do `202`: o pedido existe, e quem decide o que ele vira é a execução.
    const reenvio = (await new ExecucaoDaSessaoRepository(this.banco).daChave(pedido.chaveEnvio))?.tarefa === proporFerramenta.nome
    // Antes do `202`: sem material da série, o chat não responde e nada é gravado nem gasto (RF8). A conversa em si não gera artefato, mas a resposta cita o material da escola.
    if (!reenvio && !(await this.trechos.existeMaterialDaSerie({ serieId: daTurma.serieId, disciplinaId }))) throw new DomainException(ErrorCode.SEM_MATERIAL_DA_SERIE)

    return this.agendador.agendar({
      comando: 'propor_ferramenta',
      chaveEnvio: pedido.chaveEnvio,
      // A marca de "só conversar" é de lista fechada, e fica com a execução; o texto da professora, só na conversa.
      entradaDaExecucao: { tarefa: 'propor_ferramenta', ...(pedido.resposta === undefined ? {} : { resposta: pedido.resposta }) },
      // A mensagem de quem pediu fica na requisição, na mesma transação do `pendente`: a execução a relê pelo id.
      aoGravar: async (tx, execucaoId) => {
        const conversa = new ConversaRepository(tx)
        await conversa.saveDoUsuario(await conversa.garantirThread(), execucaoId, { texto: pedido.texto, turmaId, disciplinaId })
      },
    })
  }
}
