import { currentContext, DomainException, runInContext, AuditoriaRecorder, summarizeError, requestSessao, type Database, type LoggerBase } from '@educa/core'
import {
  alcanceDe,
  ErrorCode,
  InvariantException,
  buscaDeMaterialResponseSchema,
  listaDeMateriaisResponseSchema,
  materialResponseSchema,
  motivoDaRecusaDoMaterial,
  type BuscaDeMaterialQuery,
  type MateriaisQuery,
  type FalhaDeMaterial,
  type LicencaDeMaterial,
  type EnviarMaterialRequest,
  type BuscaDeMaterialResponse,
  type ListaDeMateriaisResponse,
  type MaterialResponse,
} from '@educa/shared'
import { createHash } from 'node:crypto'
import { DisciplinaRepository } from '../estrutura/disciplina/disciplina.repository.js'
import { paginar } from '../http/paginacao.js'
import { temAssinaturaDePdf, type ExtratorDePdf } from './extracao-de-pdf.js'
import { PRAZO_DA_EXTRACAO_MS, type FilaDeExtracao } from './fila-de-extracao.js'
import { MaterialParadoRepository, MaterialRepository, type AlcanceDoMaterial, type MaterialLido } from './material.repository.js'
import { trechoCitado } from './trecho-citado.js'

const registro = new AuditoriaRecorder()

/** A janela dos tetos de envio. */
export const JANELA_DOS_ENVIOS_MS = 60 * 60_000
/** Envios de uma pessoa na janela. O ano de uma disciplina cabe em bem menos; acima disso é laço ou engano. */
export const ENVIOS_POR_USUARIO_NA_JANELA = 30
/** Envios da escola inteira na janela, somando todas as pessoas da coordenação. */
export const ENVIOS_POR_ESCOLA_NA_JANELA = 60
/**
 * Materiais da escola sendo lidos ao mesmo tempo. É o que limita a memória: o PDF não é guardado, e os bytes de cada
 * material esperam a vez na instância que os recebeu (até 20 MB cada um).
 */
export const MATERIAIS_EM_PROCESSAMENTO_POR_ESCOLA = 3
/** Quanto esperar antes de enviar de novo quando o teto é o do processamento: o tempo de uma extração. */
const ESPERA_PELO_PROCESSAMENTO_S = 30
/**
 * A idade em que um material `processando` é dado por parado: os da escola que estavam na frente dele, mais ele, mais
 * uma folga. Nenhuma extração viva chega lá, porque o prazo a aborta antes; com duas instâncias, uma não encerra o que
 * a outra está lendo.
 */
export const IDADE_DO_MATERIAL_PARADO_MS = (MATERIAIS_EM_PROCESSAMENTO_POR_ESCOLA + 1) * PRAZO_DA_EXTRACAO_MS
/** De quanto em quanto tempo a varredura dos parados roda. */
export const INTERVALO_DA_VARREDURA_MS = 60_000

/** O arquivo como o recebimento o entrega: os bytes e o tamanho. O nome e o tipo declarado não entram em regra nenhuma. */
export interface ArquivoRecebido {
  readonly buffer: Buffer
  readonly size: number
}

function ehArquivoRecebido(valor: unknown): valor is ArquivoRecebido {
  return typeof valor === 'object' && valor !== null && 'buffer' in valor && Buffer.isBuffer(valor.buffer) && 'size' in valor && typeof valor.size === 'number'
}

/**
 * Como o papel da sessão alcança o material, pela célula da `MATRIZ`: `unidade` é a coordenação; `turma_vinculada` é o
 * professor, que alcança o material das disciplinas em que tem vínculo confirmado. Qualquer outro alcance não chega
 * aqui (a guarda de permissão barra o `nunca`) e, se chegasse, responderia como inexistente.
 */
function alcanceDoMaterial(acao: 'listar' | 'ler' | 'buscar'): AlcanceDoMaterial {
  const alcance = alcanceDe(requestSessao().papel, 'material', acao)
  if (alcance === 'unidade') return 'unidade'
  if (alcance === 'turma_vinculada') return 'disciplinas_vinculadas'
  throw new DomainException(ErrorCode.NAO_ENCONTRADO)
}

/**
 * O que sai para quem pede. O `licenciante` é de quem a escola licenciou o material, e pode ser nome de pessoa: é dado
 * da coordenação, que o declarou. O professor usa o título e a página, então recebe `null` no lugar (regra 20, item 4:
 * DTO mínimo). Quem decide é o alcance da célula da `MATRIZ`, não o nome do papel.
 */
function paraResposta(lido: MaterialLido, alcance: AlcanceDoMaterial): MaterialResponse {
  return materialResponseSchema.parse({ ...lido, licenciante: alcance === 'unidade' ? lido.licenciante : null, enviadoEm: lido.enviadoEm.toISOString() })
}

export interface DependenciasDoMaterial {
  readonly banco: Database
  readonly extrator: ExtratorDePdf
  readonly fila: FilaDeExtracao
  /** O logger JSON do processo: as linhas levam o id do material e medidas, que o `Logger` do Nest não carrega. */
  readonly logger: Pick<LoggerBase, 'info' | 'warn'>
}

/**
 * O material da escola (MVP, A2; D5, D22, D75): a coordenação envia o PDF com a titularidade e a licença declaradas, e
 * o professor lê e busca o das disciplinas dele. O aluno não alcança nenhuma rota (o Tutor lê por ele, no servidor,
 * por `BuscaDeTrechos`).
 *
 * **Nada disto loga título, licenciante, nome de arquivo nem texto de trecho** (regra 20, item 9): as linhas levam o
 * id do material, o tamanho, as páginas, a duração e o código. A auditoria leva ids e o que foi declarado.
 */
export class MaterialService {
  constructor(private readonly dependencias: DependenciasDoMaterial) {}

  /**
   * `POST /v1/materiais`. A ordem é a regra (D5, D75), e o teste a confere:
   *
   * 1. a disciplina é da escola da sessão, ou `NAO_ENCONTRADO` (a permissão já passou pela guarda);
   * 2. **a licença, antes de abrir o arquivo**: sem licença que permita o uso, ou sem a declaração marcada, grava
   *    `material.recusado` na auditoria e responde `MATERIAL_SEM_LICENCA`. Nenhuma linha em `material`, e nenhum byte
   *    do arquivo é lido — nem a assinatura. O pedido recusado nem precisa trazer arquivo;
   * 3. só então o arquivo: precisa existir e ter a assinatura de PDF no conteúdo, ou `ENTRADA_INVALIDA` (o tamanho já
   *    foi limitado no recebimento);
   * 4. os tetos de envio, com a escola travada, e a gravação do material `processando` com `material.enviado`, na
   *    mesma transação. O mesmo arquivo de novo na escola é `CONFLITO`, pelo índice único;
   * 5. a extração é agendada e a resposta sai, com o material ainda `processando` (regra 00, item 4).
   *
   * O arquivo **não é guardado**: os bytes ficam na memória desta instância até a extração terminar.
   */
  async enviar(pedido: EnviarMaterialRequest, arquivo: unknown): Promise<MaterialResponse> {
    const { banco, logger } = this.dependencias
    const disciplinaId = pedido.disciplinaId.toLowerCase()
    if ((await new DisciplinaRepository(banco).porId(disciplinaId)) === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)

    const motivo = motivoDaRecusaDoMaterial(pedido)
    if (motivo !== null) {
      await banco.transaction((tx) =>
        registro.gravar(tx, 'material.recusado', {
          entidadeId: disciplinaId,
          depois: { titularidade: pedido.titularidade, licenca: pedido.licenca, declaracao: pedido.declaracao, motivo },
        }),
      )
      const codigo: string = motivo
      logger.info({ evento: 'material.recusado', disciplinaId, codigo })
      throw new DomainException(ErrorCode.MATERIAL_SEM_LICENCA)
    }
    // Depois da recusa, a licença é uma das quatro com que um material entra.
    const licenca = pedido.licenca as LicencaDeMaterial

    if (!ehArquivoRecebido(arquivo) || arquivo.size === 0 || !temAssinaturaDePdf(arquivo.buffer)) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
    const bytes = arquivo.buffer
    const sha256 = createHash('sha256').update(bytes).digest('hex')

    const gravado = await banco.transaction(async (tx) => {
      const materiais = new MaterialRepository(tx)
      await materiais.travarEnviosDaEscola()
      await this.#exigirDentroDosTetos(materiais)
      const novo = await materiais.inserir({ disciplinaId, titulo: pedido.titulo, titularidade: pedido.titularidade, licenciante: pedido.licenciante ?? null, licenca, sha256, tamanhoBytes: bytes.byteLength })
      await registro.gravar(tx, 'material.enviado', { entidadeId: novo.id, depois: { disciplinaId, titularidade: pedido.titularidade, licenca, declaracao: true } })
      return novo
    })
    const tamanho = bytes.byteLength
    logger.info({ evento: 'material.enviado', materialId: gravado.id, tamanho })
    this.#agendarExtracao(gravado.id, bytes)
    // Quem envia é sempre a coordenação (a célula `material.enviar` é só dela): recebe o que declarou.
    return paraResposta(gravado, 'unidade')
  }

  /**
   * Os tetos de envio antes de o corpo ser recebido (`GuardaDoEnvio`): quem já passou do teto não sobe 20 MB para
   * ouvir a recusa. É leitura sem trava; quem decide é a conferência dentro da transação do envio.
   */
  async exigirEnvioDentroDosTetos(): Promise<void> {
    await this.#exigirDentroDosTetos(new MaterialRepository(this.dependencias.banco))
  }

  /** Por pessoa e por escola, nunca por IP (regra 80, itens 1 e 3): a escola inteira sai pelo mesmo IP. */
  async #exigirDentroDosTetos(materiais: MaterialRepository): Promise<void> {
    const envios = await materiais.enviosNaJanela(new Date(Date.now() - JANELA_DOS_ENVIOS_MS))
    if (envios.emProcessamento >= MATERIAIS_EM_PROCESSAMENTO_POR_ESCOLA) throw new DomainException(ErrorCode.LIMITE_EXCEDIDO, undefined, ESPERA_PELO_PROCESSAMENTO_S)
    if (envios.doUsuario >= ENVIOS_POR_USUARIO_NA_JANELA || envios.daEscola >= ENVIOS_POR_ESCOLA_NA_JANELA) {
      const tipo = envios.daEscola >= ENVIOS_POR_ESCOLA_NA_JANELA ? 'escola' : 'usuario'
      this.dependencias.logger.warn({ evento: 'material.teto_de_envios', tipo })
      throw new DomainException(ErrorCode.LIMITE_EXCEDIDO, undefined, JANELA_DOS_ENVIOS_MS / 1_000)
    }
  }

  /**
   * A extração, depois de a requisição responder. O contexto é montado aqui, com a escola do material: a fila chama o
   * trabalho de dentro da cadeia assíncrona de **outra** requisição (a que liberou a vaga), e sem isto o repository
   * gravaria com a escola dela.
   */
  #agendarExtracao(materialId: string, bytes: Buffer): void {
    const { escolaId } = requestSessao()
    const requisicaoId = currentContext()?.requisicaoId
    if (requisicaoId === undefined) throw new InvariantException('contexto da requisição ausente')
    this.dependencias.fila.agendar(escolaId, (sinal) => runInContext({ requisicaoId, escolaId }, () => this.#extrair(materialId, bytes, sinal)))
  }

  /** Nunca rejeita: a falha vira estado do material e uma linha de log com o código. */
  async #extrair(materialId: string, bytes: Buffer, sinal: AbortSignal): Promise<void> {
    const { banco, extrator, logger } = this.dependencias
    const inicio = performance.now()
    const falhar = async (codigo: FalhaDeMaterial): Promise<void> => {
      const duracaoMs = Math.round(performance.now() - inicio)
      logger.warn({ evento: 'material.extracao_falhou', materialId, codigo, duracaoMs })
      // Sem conseguir gravar a falha, o material fica `processando` e a varredura o encerra.
      await new MaterialRepository(banco).marcarFalhou(materialId, codigo).catch(() => undefined)
    }
    try {
      // Chamado já abortado (o processo está descendo, e este esperava a vez): só grava a falha, sem ler nada.
      if (sinal.aborted) return await falhar('extracao_falhou')
      const resultado = await extrator.extrair(bytes, sinal)
      if (resultado.falha !== null) return await falhar(resultado.falha)
      const gravou = await banco.transaction(async (tx) => {
        const materiais = new MaterialRepository(tx)
        const disciplinaId = await materiais.marcarPronto(materialId, resultado.paginas)
        // Excluído, ou dado por falho pela varredura, enquanto era lido: nenhum trecho entra.
        if (disciplinaId === undefined) return false
        await materiais.gravarTrechos(materialId, disciplinaId, resultado.trechos)
        return true
      })
      const duracaoMs = Math.round(performance.now() - inicio)
      const paginasTotal = resultado.paginas
      const trechosTotal = resultado.trechos.length
      if (gravou) logger.info({ evento: 'material.extraido', materialId, paginasTotal, trechosTotal, duracaoMs })
      else logger.info({ evento: 'material.extracao_descartada', materialId, duracaoMs })
    } catch (erro) {
      logger.warn({ evento: 'material.extracao_erro', materialId, erro: summarizeError(erro) })
      await falhar('extracao_falhou')
    }
  }

  /**
   * A varredura do que ficou `processando` com o processo que o lia fora do ar. Nunca lança: banco fora é aviso no
   * log, e a próxima tenta de novo.
   */
  async varrerParados(agora: Date = new Date()): Promise<number> {
    const { banco, logger } = this.dependencias
    try {
      const total = await new MaterialParadoRepository(banco).falharParados(new Date(agora.getTime() - IDADE_DO_MATERIAL_PARADO_MS))
      if (total > 0) logger.warn({ evento: 'material.parados_encerrados', total })
      return total
    } catch (erro) {
      logger.warn({ evento: 'material.varredura_falhou', erro: summarizeError(erro) })
      return 0
    }
  }

  /** `GET /v1/materiais`: a coordenação, os da escola; o professor, os das disciplinas dele, com ou sem o filtro. */
  async listar(consulta: MateriaisQuery): Promise<ListaDeMateriaisResponse> {
    const filtro = { ...consulta, ...(consulta.disciplinaId === undefined ? {} : { disciplinaId: consulta.disciplinaId.toLowerCase() }) }
    const alcance = alcanceDoMaterial('listar')
    const linhas = await new MaterialRepository(this.dependencias.banco).listar(filtro, alcance)
    const { itens, proxima } = paginar(linhas, consulta.limite)
    return listaDeMateriaisResponseSchema.parse({ itens: itens.map((item) => paraResposta(item, alcance)), ...(proxima === undefined ? {} : { proxima }) })
  }

  /** `GET /v1/materiais/:id`. De outra escola, de disciplina sem vínculo, excluído ou inexistente: `NAO_ENCONTRADO`. */
  async ler(id: string): Promise<MaterialResponse> {
    const alcance = alcanceDoMaterial('ler')
    const lido = await new MaterialRepository(this.dependencias.banco).porId(id, alcance)
    if (lido === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    return paraResposta(lido, alcance)
  }

  /**
   * `DELETE /v1/materiais/:id`: exclusão lógica (regra 20, item 15). A linha fica, porque artefatos já citam o
   * material; os trechos saem de fato, e a auditoria `material.excluido` é gravada, tudo na mesma transação. De outra
   * escola, já excluído ou inexistente: `NAO_ENCONTRADO`, e nada muda.
   */
  async excluir(id: string): Promise<void> {
    const { banco, logger } = this.dependencias
    const trechosTotal = await banco.transaction(async (tx) => {
      const materiais = new MaterialRepository(tx)
      const excluido = await materiais.excluir(id)
      if (excluido === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const apagados = await materiais.apagarTrechos(id)
      await registro.gravar(tx, 'material.excluido', { entidadeId: id, antes: { disciplinaId: excluido.disciplinaId, estado: excluido.estado }, depois: { trechosApagados: apagados } })
      return apagados
    })
    logger.info({ evento: 'material.excluido', materialId: id, trechosTotal })
  }

  /**
   * `GET /v1/materiais/busca`: os trechos por relevância, com todas as palavras da busca
   * (`websearch_to_tsquery('portuguese', q)`), dentro da escola do contexto e do alcance de quem pede.
   */
  async buscar(consulta: BuscaDeMaterialQuery): Promise<BuscaDeMaterialResponse> {
    const achados = await new MaterialRepository(this.dependencias.banco).buscar(
      { texto: consulta.q, disciplinaId: consulta.disciplinaId?.toLowerCase(), limite: consulta.limite, palavras: 'todas' },
      alcanceDoMaterial('buscar'),
    )
    return buscaDeMaterialResponseSchema.parse({ itens: achados.map(({ materialId, titulo, pagina, texto }) => ({ materialId, titulo, pagina, trecho: trechoCitado(texto, consulta.q) })) })
  }
}
