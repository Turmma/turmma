import { DEFAULT_RETRY_AFTER_SECONDS, DomainException, AuditoriaRecorder, FileStorageUnavailableError, JobOutbox, postgresErrorIn, summarizeError, requestSessao, type Database, type FileStorage, type LoggerBase } from '@educa/core'
import {
  alcanceDe,
  ErrorCode,
  TIPO_EXTRAIR_PDF,
  buscaDeMaterialResponseSchema,
  listaDeMateriaisResponseSchema,
  materialResponseSchema,
  motivoDaRecusaDoMaterial,
  type BuscaDeMaterialQuery,
  type MateriaisQuery,
  type LicencaDeMaterial,
  type EnviarMaterialRequest,
  type BuscaDeMaterialResponse,
  type ListaDeMateriaisResponse,
  type MaterialResponse,
} from '@educa/shared'
import { createHash } from 'node:crypto'
import { DisciplinaRepository } from '@educa/core/estrutura'
import { chaveDoTemporario, EnvioDeMaterialRepository, ExtracaoDoMaterialRepository, PRAZO_DO_OBJETO_DO_MATERIAL_MS, temAssinaturaDePdf, uuidV7 } from '@educa/core/material'
import { paginar } from '../http/pagination.js'
import { MaterialRepository, type AlcanceDoMaterial, type MaterialLido } from './material.repository.js'
import { trechoCitado } from './trecho-citado.js'

const registro = new AuditoriaRecorder()

/** SQLSTATE `lock_not_available`: o `lock_timeout` da linha do envio estourou, porque a varredura a segurava. */
const TRAVA_NAO_DISPONIVEL = '55P03'

/** A janela dos tetos de envio. */
export const JANELA_DOS_ENVIOS_MS = 60 * 60_000
/** Envios de uma pessoa na janela. O ano de uma disciplina cabe em bem menos; acima disso é laço ou engano. */
export const ENVIOS_POR_USUARIO_NA_JANELA = 30
/** Envios da escola inteira na janela, somando todas as pessoas da coordenação. */
export const ENVIOS_POR_ESCOLA_NA_JANELA = 60
/**
 * Materiais da escola esperando a extração ao mesmo tempo (`processando`). Não é mais a memória da API, porque o PDF espera no
 * storage; é o que impede uma escola de empilhar na fila `pdf` mais do que ela escoa, e a resposta diz quanto esperar.
 */
export const MATERIAIS_EM_PROCESSAMENTO_POR_ESCOLA = 3
/** Quanto esperar antes de enviar de novo quando o teto é o do processamento: o tempo de uma extração. */
const ESPERA_PELO_PROCESSAMENTO_S = 30

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

export interface MaterialDependencies {
  readonly banco: Database
  /** O storage privado: o PDF espera nele até o worker da fila `pdf` extrair (regra 20, item 7). */
  readonly armazem: FileStorage
  /** O outbox: o job `material.extrair-pdf` entra na mesma transação que a linha do material. */
  readonly enfileirador: Pick<JobOutbox, 'enfileirarUmaVez'>
  /** O logger JSON do processo: as linhas levam o id do material e medidas, que o `Logger` do Nest não carrega. */
  readonly logger: Pick<LoggerBase, 'info' | 'warn'>
}

/**
 * O material da escola (MVP, A2; D5, D22, D75): a coordenação envia o PDF com a titularidade e a licença declaradas, e
 * o professor lê e busca o das disciplinas dele. O aluno não alcança nenhuma rota (o Tutor lê por ele, no servidor,
 * por `TrechoSearch`).
 *
 * A extração do PDF é do worker (fila `pdf`, `material.extrair-pdf`): aqui o arquivo só é guardado e o job, pedido.
 *
 * **Nada disto loga título, licenciante, nome de arquivo nem texto de trecho** (regra 20, item 9): as linhas levam o
 * id do material, o tamanho, as páginas, a duração e o código. A auditoria leva ids e o que foi declarado.
 */
export class MaterialService {
  constructor(private readonly dependencias: MaterialDependencies) {}

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
   * 5. o job de extração é pedido e a resposta sai, com o material ainda `processando` (regra 00, item 4).
   *
   * O arquivo é guardado no storage privado **antes** da transação, com o id do material na chave, e a linha de `envio_de_material` nasce **antes**
   * do arquivo (2.0): é ela que faz a varredura horária achar o objeto de um envio que nunca chegou ao commit. A transação a apaga no fim, sob
   * `lock_timeout` curto, e a linha precisa existir: se a varredura já a apagou (o envio foi lento), o envio desfaz com 503, para nunca haver material
   * cujo objeto a varredura levou. Toda saída depois do `guardarBytes` apaga o **objeto primeiro** (o objeto ausente conta) e só então a linha; o
   * `apagar` que falha deixa a linha, e a varredura apaga os dois. A falha do próprio `guardarBytes` tenta apagar o objeto e **deixa a linha**: o PUT
   * atrasado pode gravar depois do `apagar`. O job entra no outbox na mesma transação da linha, então não há material `processando` sem job (D49).
   */
  async enviar(pedido: EnviarMaterialRequest, arquivo: unknown): Promise<MaterialResponse> {
    const { banco, armazem, enfileirador, logger } = this.dependencias
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

    // O id nasce aqui, antes da linha: a chave do objeto o leva, e a varredura acha o órfão por ela.
    const id = uuidV7()
    // A linha do envio vem antes do objeto: sem ela, o PDF que chega ao storage e nunca tem commit não tem dono, e ninguém o procura.
    await new EnvioDeMaterialRepository(banco).registrar(id)
    await this.#guardarObjeto(armazem, id, bytes)
    const gravado = await banco
      .transaction(async (tx) => {
        const materiais = new MaterialRepository(tx)
        await materiais.travarEnviosDaEscola()
        await this.#exigirDentroDosTetos(materiais)
        const novo = await materiais.inserir({ id, disciplinaId, titulo: pedido.titulo, titularidade: pedido.titularidade, licenciante: pedido.licenciante ?? null, licenca, sha256, tamanhoBytes: bytes.byteLength })
        await registro.gravar(tx, 'material.enviado', { entidadeId: novo.id, depois: { disciplinaId, titularidade: pedido.titularidade, licenca, declaracao: true } })
        await enfileirador.enfileirarUmaVez(tx, TIPO_EXTRAIR_PDF, { materialId: novo.id }, novo.id)
        // A linha sai com o commit. Sem ela, a varredura já a levou (e o objeto com ela): o envio foi lento demais e desfaz, sem material sem objeto.
        if (!(await new EnvioDeMaterialRepository(tx).apagarNoEnvio(id))) throw new DomainException(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, undefined, DEFAULT_RETRY_AFTER_SECONDS)
        return novo
      })
      .catch(async (erro: unknown) => {
        // Teto, duplicado, trava ou banco fora: nenhuma linha de material ficou, então o objeto não tem dono. O objeto sai primeiro e a linha do envio só depois.
        await this.#desfazerEnvio(id)
        if (postgresErrorIn(erro)?.code === TRAVA_NAO_DISPONIVEL) throw new DomainException(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, undefined, DEFAULT_RETRY_AFTER_SECONDS)
        throw erro
      })
    const tamanho = bytes.byteLength
    logger.info({ evento: 'material.enviado', materialId: gravado.id, tamanho })
    // Quem envia é sempre a coordenação (a célula `material.enviar` é só dela): recebe o que declarou.
    return paraResposta(gravado, 'unidade')
  }

  /**
   * Os tetos de envio antes de o corpo ser recebido (`MaterialUploadGuard`): quem já passou do teto não sobe 20 MB para
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
   * O PDF no storage, com prazo curto; o storage fora é 503 com `Retry-After`. A falha do `guardarBytes` não diz se o objeto chegou (o PUT atrasado pode
   * gravar depois): tenta apagar o objeto e **deixa a linha do envio**, para a varredura apagar de novo quando a hora passar.
   */
  async #guardarObjeto(armazem: FileStorage, id: string, bytes: Buffer): Promise<void> {
    try {
      await armazem.guardarBytes(chaveDoTemporario(id), bytes, { prazoMs: PRAZO_DO_OBJETO_DO_MATERIAL_MS })
    } catch (erro) {
      await armazem.apagar(chaveDoTemporario(id)).catch((falha: unknown) => this.dependencias.logger.warn({ evento: 'material.objeto_nao_apagado', materialId: id, erro: summarizeError(falha) }))
      if (erro instanceof FileStorageUnavailableError) throw new DomainException(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, undefined, DEFAULT_RETRY_AFTER_SECONDS)
      throw erro
    }
  }

  /**
   * A saída de um envio que passou do `guardarBytes` sem virar material: o objeto sai primeiro (ausente conta) e só então a linha do envio. Se o `apagar`
   * falha, a linha fica, com o id no log, e a varredura horária apaga o objeto e a linha; se é a linha que não sai, o objeto já saiu e a varredura a apaga.
   */
  async #desfazerEnvio(id: string): Promise<void> {
    const { banco, armazem, logger } = this.dependencias
    try {
      await armazem.apagar(chaveDoTemporario(id))
    } catch (falha) {
      logger.warn({ evento: 'material.objeto_nao_apagado', materialId: id, erro: summarizeError(falha) })
      return
    }
    await new EnvioDeMaterialRepository(banco).apagar(id).catch((falha: unknown) => logger.warn({ evento: 'material.envio_nao_apagado', materialId: id, erro: summarizeError(falha) }))
  }

  async #apagarObjetoDoExcluido(id: string): Promise<void> {
    const { banco, armazem, logger } = this.dependencias
    try {
      await armazem.apagar(chaveDoTemporario(id))
      await new ExtracaoDoMaterialRepository(banco).marcarObjetoApagado(id)
    } catch (erro) {
      logger.warn({ evento: 'material.objeto_nao_apagado', materialId: id, erro: summarizeError(erro) })
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
    const { trechosTotal, estado } = await banco.transaction(async (tx) => {
      const materiais = new MaterialRepository(tx)
      const excluido = await materiais.excluir(id)
      if (excluido === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const apagados = await materiais.apagarTrechos(id)
      await registro.gravar(tx, 'material.excluido', { entidadeId: id, antes: { disciplinaId: excluido.disciplinaId, estado: excluido.estado }, depois: { trechosApagados: apagados } })
      return { trechosTotal: apagados, estado: excluido.estado }
    })
    logger.info({ evento: 'material.excluido', materialId: id, trechosTotal })
    // Só o `processando` ainda tem o objeto: o `pronto` e o `falhou` já o apagaram. Depois do commit, e sem poder desfazer a exclusão:
    // o que não saiu agora sai no expurgo noturno (`excluidosComObjeto`).
    if (estado === 'processando') await this.#apagarObjetoDoExcluido(id)
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
