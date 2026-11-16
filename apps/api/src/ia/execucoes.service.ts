import { DomainException, requireEscolaId, type Database, type LoggerBase } from '@educa/core'
import { ErrorCode, execucaoResponseSchema, type ExecucaoResponse, type ResultadoDaExecucao, type ResultadoGravado } from '@educa/shared'
import { ESPERA_MAXIMA_DA_INTERATIVA_SEGUNDOS, ExecucaoDaSessaoRepository, ExecucaoRepository } from './execucao.repository.js'
import type { MetricasDaExecucao } from './metricas-da-execucao.js'
import type { RegistroDeComandos } from './registro-de-comandos.js'

/**
 * `GET /v1/execucoes/:id`: o estado da execução **para quem a pediu**. A de outra pessoa, mesmo da mesma escola, a de
 * outra escola e a que não existe respondem igual, `NAO_ENCONTRADO` (regra 10, item 6). A resposta nunca leva a
 * entrada, o prompt, o modelo nem o custo: só o estado, o código do erro e o resultado.
 *
 * O `resultado` gravado é referência. A mensagem do Assistente e a do Tutor são lidas pelo id, no mesmo escopo: a
 * conversa de outra pessoa não sai por aqui nem que a referência aponte para ela.
 *
 * **O corte da espera (RF5).** A pergunta do Tutor (`interativa`) `pendente` há mais de 20 s é cortada aqui também, e só depois de lida no escopo de quem pediu: o `update`
 * condicional (`estado = 'pendente'` e a idade, do banco) a deixa `falhou IA_INDISPONIVEL`, sem modelo, e `ia.espera_estourada` soma só quando ele devolve a linha. É o que
 * mostra "Tentar de novo" com o Redis de fila fora, quando nenhum job chega ao processador. A `ferramenta` e a `normal` não têm corte, e a `concluida` e a `rodando` não são tocadas.
 */
export class ExecucoesService {
  constructor(
    private readonly banco: Database,
    private readonly comandos: RegistroDeComandos,
    private readonly metricas: MetricasDaExecucao,
    private readonly logger: LoggerBase,
  ) {}

  async ler(id: string): Promise<ExecucaoResponse> {
    const execucoes = new ExecucaoDaSessaoRepository(this.banco)
    let execucao = await execucoes.deQuemPediu(id)
    if (execucao === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    if (execucao.estado === 'pendente' && this.comandos.de(execucao.tarefa).fila === 'interativa') {
      if (await new ExecucaoRepository(this.banco).cortarEspera(id, ESPERA_MAXIMA_DA_INTERATIVA_SEGUNDOS)) {
        const escolaId = requireEscolaId()
        this.metricas.esperaEstourada(escolaId)
        const tipo = execucao.tarefa
        const codigo = ErrorCode.IA_INDISPONIVEL
        this.logger.warn({ evento: 'ia.execucao.espera_estourada', execucaoId: id, escolaId, tipo, codigo })
      }
      // O corte, o daqui ou o do processador, mudou a linha depois da leitura: a resposta é a de agora.
      execucao = (await execucoes.deQuemPediu(id)) ?? execucao
    }
    const resultado = execucao.resultado === null ? null : await this.resultadoParaATela(execucoes, execucao.resultado)
    return execucaoResponseSchema.parse({ id: execucao.id, tarefa: execucao.tarefa, estado: execucao.estado, resultado, erro: execucao.erro })
  }

  private async resultadoParaATela(execucoes: ExecucaoDaSessaoRepository, gravado: ResultadoGravado): Promise<ResultadoDaExecucao> {
    if (gravado.tipo === 'mensagem') {
      const mensagem = await execucoes.mensagemDoAssistente(gravado.mensagemId)
      if (mensagem === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      // O conteúdo gravado é validado de novo na leitura, pelo schema da resposta (regra 30, item 7).
      return { tipo: 'mensagem', mensagem: { id: mensagem.id, criadaEm: mensagem.criadaEm.toISOString(), autor: 'agente', ...(mensagem.conteudo as object) } } as ResultadoDaExecucao
    }
    if (gravado.tipo === 'mensagem_do_tutor') {
      const mensagem = await execucoes.mensagemDoTutor(gravado.mensagemId)
      if (mensagem === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const comum = { id: mensagem.id, criadaEm: mensagem.criadaEm.toISOString(), autor: 'tutor', texto: mensagem.texto }
      // A mensagem fixa de assunto delicado não tem citação: a tela a mostra com o botão de avisar um adulto.
      return { tipo: 'mensagem_do_tutor', mensagem: mensagem.tipo === 'assunto_delicado' ? { ...comum, tipo: 'assunto_delicado' } : { ...comum, tipo: 'texto', citacoes: mensagem.citacoes ?? [] } } as ResultadoDaExecucao
    }
    return gravado
  }
}
