import { ErroDeDominio, type Banco } from '@educa/nucleo'
import { ErrorCode, execucaoResponseSchema, type ExecucaoResponse, type ResultadoDaExecucao, type ResultadoGravado } from '@educa/shared'
import { ExecucaoDaSessaoRepository } from './execucao.repository.js'

/**
 * `GET /v1/execucoes/:id`: o estado da execução **para quem a pediu**. A de outra pessoa, mesmo da mesma escola, a de
 * outra escola e a que não existe respondem igual, `NAO_ENCONTRADO` (regra 10, item 6). A resposta nunca leva a
 * entrada, o prompt, o modelo nem o custo: só o estado, o código do erro e o resultado.
 *
 * O `resultado` gravado é referência. A mensagem do Assistente e a do Tutor são lidas pelo id, no mesmo escopo: a
 * conversa de outra pessoa não sai por aqui nem que a referência aponte para ela.
 */
export class ExecucoesService {
  constructor(private readonly banco: Banco) {}

  async ler(id: string): Promise<ExecucaoResponse> {
    const execucoes = new ExecucaoDaSessaoRepository(this.banco)
    const execucao = await execucoes.deQuemPediu(id)
    if (execucao === undefined) throw new ErroDeDominio(ErrorCode.NAO_ENCONTRADO)
    const resultado = execucao.resultado === null ? null : await this.resultadoParaATela(execucoes, execucao.resultado)
    return execucaoResponseSchema.parse({ id: execucao.id, tarefa: execucao.tarefa, estado: execucao.estado, resultado, erro: execucao.erro })
  }

  private async resultadoParaATela(execucoes: ExecucaoDaSessaoRepository, gravado: ResultadoGravado): Promise<ResultadoDaExecucao> {
    if (gravado.tipo === 'mensagem') {
      const mensagem = await execucoes.mensagemDoAssistente(gravado.mensagemId)
      if (mensagem === undefined) throw new ErroDeDominio(ErrorCode.NAO_ENCONTRADO)
      // O conteúdo gravado é validado de novo na leitura, pelo schema da resposta (regra 30, item 7).
      return { tipo: 'mensagem', mensagem: { id: mensagem.id, criadaEm: mensagem.criadaEm.toISOString(), autor: 'agente', ...(mensagem.conteudo as object) } } as ResultadoDaExecucao
    }
    if (gravado.tipo === 'mensagem_do_tutor') {
      const mensagem = await execucoes.mensagemDoTutor(gravado.mensagemId)
      if (mensagem === undefined) throw new ErroDeDominio(ErrorCode.NAO_ENCONTRADO)
      const comum = { id: mensagem.id, criadaEm: mensagem.criadaEm.toISOString(), autor: 'tutor', texto: mensagem.texto }
      // A mensagem fixa de assunto delicado não tem citação: a tela a mostra com o botão de avisar um adulto.
      return { tipo: 'mensagem_do_tutor', mensagem: mensagem.tipo === 'assunto_delicado' ? { ...comum, tipo: 'assunto_delicado' } : { ...comum, tipo: 'texto', citacoes: mensagem.citacoes ?? [] } } as ResultadoDaExecucao
    }
    return gravado
  }
}
