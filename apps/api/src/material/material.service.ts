import { AgendamentoDaClassificacaoRepository, ANTES_DA_PRIMEIRA_SECAO, BnccRepository, DEFAULT_RETRY_AFTER_SECONDS, DomainException, AuditoriaRecorder, AuditoriaRepository, diaDeUso, SECOES_POR_LOTE_DO_AGENDAMENTO, FileStorageUnavailableError, JobOutbox, postgresErrorIn, summarizeError, requestSessao, systemClock, type Clock, type Database, type DatabaseTransaction, type FileStorage, type LoggerBase } from '@educa/core'
import {
  alcanceDe,
  CODIGOS_DA_BNCC,
  DIAS_DAS_RECUSAS_NO_RESUMO,
  ErrorCode,
  FUNCAO_DA_TAREFA_DE_IA,
  InvariantException,
  MAXIMO_DE_HABILIDADES_POR_SECAO,
  habilidadeEhCandidata,
  habilidadesBnccResponseSchema,
  TIPO_AGENDAR_CLASSIFICACAO,
  TIPO_EXTRAIR_PDF,
  buscaDeMaterialResponseSchema,
  coberturaResponseSchema,
  grupoDaCoberturaDoComponente,
  nomeDoGrupoDaCobertura,
  listaDeMateriaisResponseSchema,
  materialComCapitulosResponseSchema,
  materialResponseSchema,
  motivoDaRecusaDoMaterial,
  MOTIVOS_DA_RECUSA_QUE_O_RESUMO_CONTA,
  resumoDoMaterialResponseSchema,
  secaoDoMaterialResponseSchema,
  situacaoDaLicenca,
  situacaoDaSecao,
  type BuscaDeMaterialQuery,
  type CoberturaQuery,
  type CoberturaResponse,
  type GrupoDaCobertura,
  type GrupoDaCoberturaResponse,
  type CorrigirSecaoRequest,
  type HabilidadesBnccQuery,
  type HabilidadesBnccResponse,
  type ReclassificarResponse,
  type SecaoDoMaterialResponse,
  type MateriaisQuery,
  type LicencaDeMaterial,
  type MotivoDaRecusaDoMaterial,
  type MotivoDaRecusaPelaLicencaRegistrada,
  type AtualizarMaterialRequest,
  type EnviarEdicaoRequest,
  type EnviarMaterialRequest,
  type BuscaDeMaterialResponse,
  type ListaDeMateriaisResponse,
  type MaterialComCapitulosResponse,
  type ResumoDoMaterialRow,
  type MaterialResponse,
  type ResumoDoMaterialResponse,
} from '@educa/shared'
import { createHash, randomUUID } from 'node:crypto'
import { DisciplinaRepository } from '@educa/core/estrutura'
import { chaveDoTemporario, EnvioDeMaterialRepository, ExtracaoDoMaterialRepository, PRAZO_DO_OBJETO_DO_MATERIAL_MS, hasAssinaturaDePdf, uuidV7 } from '@educa/core/material'
import { z } from 'zod'
import { paginar } from '../http/pagination.js'
import { SuspensaoRepository } from '../ia/suspensao.repository.js'
import { CoberturaRepository } from './cobertura.repository.js'
import { candidatasDoRecorte } from './habilidades-do-recorte.js'
import { LicencaRepository, type LicencaParaUso, type VigenciaDaLicenca } from './licenca.repository.js'
import { MaterialRepository, type AlcanceDoMaterial, type MaterialLido } from './material.repository.js'
import { SecoesRepository, type HabilidadeLida, type SecaoLida } from './secoes.repository.js'
import { trechoCitado } from './trecho-citado.js'

const registro = new AuditoriaRecorder()

/** SQLSTATE `lock_not_available`: o `lock_timeout` da linha do envio estourou, porque a varredura a segurava. */
const TRAVA_NAO_DISPONIVEL = '55P03'
/** SQLSTATE `unique_violation`, e o índice que admite uma edição em andamento por material: a segunda que passa pela checagem sob a trava cai nele. */
const VIOLACAO_DE_UNICO = '23505'
const INDICE_DA_EDICAO_EM_ANDAMENTO = 'material_uma_edicao_em_andamento'

/** A janela dos tetos de envio. */
export const JANELA_DOS_ENVIOS_MS = 60 * 60_000
/** Envios de uma pessoa na janela: 100 por hora (Tech Spec, 7c). O onboarding de 300 apostilas, por três coordenadores, cabe; acima disso é laço ou engano. */
export const ENVIOS_POR_USUARIO_NA_JANELA = 100
/** Envios da escola inteira na janela, somando todas as pessoas da coordenação: 300 por hora (Tech Spec, 7c). */
export const ENVIOS_POR_ESCOLA_NA_JANELA = 300
/**
 * Materiais da escola esperando a extração ao mesmo tempo (`processando`): 300, o onboarding inteiro (Tech Spec, 7c; a vaga `pdf` por escola é que impede a escola de tomar a fila). Não é mais a memória da API, porque o PDF espera no
 * storage; é o que impede uma escola de empilhar na fila `pdf` mais do que ela escoa, e a resposta diz quanto esperar.
 */
export const MATERIAIS_EM_PROCESSAMENTO_POR_ESCOLA = 300
/** Quanto esperar antes de enviar de novo quando o teto é o do processamento: o tempo de uma extração. */
const ESPERA_PELO_PROCESSAMENTO_S = 30
/** A janela dos tetos do `PATCH` do material (título e séries): a mesma hora dos envios, mas contada à parte (ingestao-do-material, 12.0; Tech Spec, 7c). */
export const JANELA_DAS_ATUALIZACOES_MS = 60 * 60_000
/** `PATCH` de uma pessoa na janela: 100 por hora. Corrigir as séries de 300 apostilas em lote cabe; acima disso é laço. */
export const ATUALIZACOES_POR_USUARIO_NA_JANELA = 100
/** `PATCH` da escola inteira na janela, somando as pessoas da coordenação: 300 por hora. */
export const ATUALIZACOES_POR_ESCOLA_NA_JANELA = 300

/** A janela dos tetos da correção da classificação e do reclassificar: a mesma hora, contada à parte (classificacao-bncc, 7.0; Tech Spec, seção 4: "contados na auditoria"). */
export const JANELA_DA_CLASSIFICACAO_MS = 60 * 60_000
/** Correções de habilidade de uma pessoa na janela: 300 por hora. Corrigir as 25 seções de 12 apostilas cabe; acima disso é laço. */
export const CORRECOES_POR_USUARIO_NA_JANELA = 300
/** Correções da escola inteira na janela, somando a coordenação: 900 por hora. */
export const CORRECOES_POR_ESCOLA_NA_JANELA = 900
/** Pedidos de reclassificar de uma pessoa na janela: 100 por hora. */
export const RECLASSIFICACOES_POR_USUARIO_NA_JANELA = 100
/** Pedidos de reclassificar da escola inteira na janela: 300 por hora. */
export const RECLASSIFICACOES_POR_ESCOLA_NA_JANELA = 300

/** Os códigos como a auditoria os aceita: a lista fechada da BNCC (a tabela e a lista andam juntas, `codigos-da-bncc.test.ts`), sem texto livre. */
const habilidadesDaAuditoriaSchema = z.array(z.enum(CODIGOS_DA_BNCC)).max(MAXIMO_DE_HABILIDADES_POR_SECAO)

/** A seção como o contrato a devolve: a situação sai da execução e das habilidades, e a correção vence. Nunca `corrigida_por` nem `execucao_id`. */
function paraSecaoResposta(secao: SecaoLida, habilidades: readonly HabilidadeLida[]): SecaoDoMaterialResponse {
  const dela = habilidades.filter((habilidade) => habilidade.secaoId === secao.id)
  return secaoDoMaterialResponseSchema.parse({
    id: secao.id,
    ordem: secao.ordem,
    paginaInicial: secao.paginaInicial,
    paginaFinal: secao.paginaFinal,
    capitulo: secao.capituloTitulo === null ? null : { numero: secao.capituloNumero, titulo: secao.capituloTitulo },
    situacao: situacaoDaSecao({ corrigida: secao.corrigida, estadoDaExecucao: secao.estadoDaExecucao, habilidades: dela.length }),
    habilidades: dela.map(({ codigo, descricao, origem }) => ({ codigo, descricao, origem })),
    corrigida: secao.corrigida,
  })
}

/** A licença registrada vale hoje? `futura` e `vencida` não valem: o dia do fim ainda vale, e a licença sem fim vale até a coordenação a encerrar (RF16 e RF17). */
function licencaValeEm(hoje: string, licenca: VigenciaDaLicenca): boolean {
  const situacao = situacaoDaLicenca(hoje, licenca.vigenteDesde, licenca.vigenteAte)
  return situacao === 'vigente' || situacao === 'vence_em_30_dias'
}

/** O que a recusa pela licença grava do que foi declarado: o pedido do envio, ou o que a edição herdou do material que substitui. */
type Declarado = Pick<EnviarMaterialRequest, 'titularidade' | 'licenca' | 'declaracao'>

/** A licença que valia ao ler o pedido já não vale na transação do envio (a coordenação encurtou a vigência no meio): o envio desfaz e responde `LICENCA_VENCIDA`. */
class LicencaDeixouDeValerNoEnvio extends Error {}

/** O arquivo como o recebimento o entrega: os bytes e o tamanho. O nome e o tipo declarado não entram em regra nenhuma. */
export interface ArquivoRecebido {
  readonly buffer: Buffer
  readonly size: number
}

function isArquivoRecebido(valor: unknown): valor is ArquivoRecebido {
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
  return materialResponseSchema.parse(daLinhaParaOContrato(lido, alcance))
}

/** O material como o contrato o espera, ainda por validar: quem devolve é quem escolhe o esquema que o fecha (`paraResposta`, ou `ler`, com os capítulos). */
function daLinhaParaOContrato(lido: MaterialLido, alcance: AlcanceDoMaterial) {
  return { ...lido, licenciante: alcance === 'unidade' ? lido.licenciante : null, enviadoEm: lido.enviadoEm.toISOString() }
}

export interface MaterialDependencies {
  readonly banco: Database
  /** O storage privado: o PDF espera nele até o worker da fila `pdf` extrair (regra 20, item 7). */
  readonly armazem: FileStorage
  /** O outbox: o job `material.extrair-pdf` entra na mesma transação que a linha do material. */
  readonly enfileirador: Pick<JobOutbox, 'enfileirarUmaVez'>
  /** O logger JSON do processo: as linhas levam o id do material e medidas, que o `Logger` do Nest não carrega. */
  readonly logger: Pick<LoggerBase, 'info' | 'warn'>
  /** O relógio da vigência da licença (o dia de São Paulo, `diaDeUso`): o teste injeta o dele; nunca vem do ambiente. Sem ele, o do sistema. */
  readonly relogio?: Clock
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

  /** O instante de agora, do `Clock` injetado: o teste põe o dele, e o que conta dias (a licença, a janela do resumo) lê só dele, nunca do relógio do computador. */
  #agora(): Date {
    return (this.dependencias.relogio ?? systemClock).agora()
  }

  /** O dia de São Paulo em que a licença é conferida: às 23h do último dia ela ainda vale, e às 0h01 do seguinte não. */
  #hoje(): string {
    return diaDeUso(this.#agora())
  }

  /** A recusa fica na auditoria, fora de qualquer transação do envio (o `rollback` dela não a leva), com as séries **já conferidas** da escola. */
  async #registrarRecusa(pedido: Declarado, disciplinaId: string, serieIds: readonly string[], motivo: MotivoDaRecusaDoMaterial | MotivoDaRecusaPelaLicencaRegistrada): Promise<void> {
    await this.dependencias.banco.transaction((tx) =>
      registro.save(tx, 'material.recusado', {
        entidadeId: disciplinaId,
        depois: { titularidade: pedido.titularidade, licenca: pedido.licenca, declaracao: pedido.declaracao, serieIds: [...serieIds], motivo },
      }),
    )
    const codigo: string = motivo
    this.dependencias.logger.info({ evento: 'material.recusado', disciplinaId, codigo })
  }

  /**
   * A licença registrada que o material de terceiro cita, lida antes de o arquivo ser aberto: a que não é da escola ou não existe responde `NAO_ENCONTRADO` (a de outra escola, igual à
   * inexistente), e a vencida ou ainda não vigente, `LICENCA_VENCIDA`. As duas gravam a recusa. O que não é de terceiro nunca traz `licencaId` (o contrato o recusa).
   */
  async #exigirLicencaVigente(pedido: Declarado, disciplinaId: string, serieIds: readonly string[], licencaId: string): Promise<void> {
    const registrada = await new LicencaRepository(this.dependencias.banco).paraUso(licencaId, false)
    if (registrada === undefined) {
      await this.#registrarRecusa(pedido, disciplinaId, serieIds, 'licenca_inexistente')
      throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    }
    if (!licencaValeEm(this.#hoje(), registrada)) {
      await this.#registrarRecusa(pedido, disciplinaId, serieIds, 'licenca_vencida')
      throw new DomainException(ErrorCode.LICENCA_VENCIDA)
    }
  }

  /**
   * `POST /v1/materiais`. A ordem é a regra (D5, D75), e o teste a confere:
   *
   * 1. a disciplina e as séries são da escola da sessão, ou `NAO_ENCONTRADO` (a permissão já passou pela guarda): a série da outra escola responde como a inexistente, e a
   *    auditoria nunca leva o id dela;
   * 2. **a licença, antes de abrir o arquivo**: sem licença que permita o uso, sem a declaração marcada ou, no material de terceiro, sem licença registrada, grava
   *    `material.recusado` na auditoria (com as séries) e responde `MATERIAL_SEM_LICENCA`. A licença registrada que não é da escola ou não existe responde `NAO_ENCONTRADO`, e a vencida
   *    ou ainda não vigente, `LICENCA_VENCIDA`, as duas também gravadas. Nenhuma linha em `material`, e nenhum byte do arquivo é lido — nem a assinatura. O pedido recusado nem precisa
   *    trazer arquivo;
   * 3. só então o arquivo: precisa existir e ter a assinatura de PDF no conteúdo, ou `ENTRADA_INVALIDA` (o tamanho já
   *    foi limitado no recebimento);
   * 4. os tetos de envio, com a escola travada, **a licença de novo, `for share`** (um `PATCH` da vigência espera o envio; a que deixou de valer desfaz o envio, grava a recusa e responde
   *    `LICENCA_VENCIDA`), e a gravação do material `processando` com as séries e `material.enviado`, na mesma transação. O licenciante da resposta é o da licença, nunca o do pedido, e o material não o grava. O
   *    mesmo arquivo de novo na escola é `CONFLITO`, pelo índice único;
   * 5. o job de extração é pedido e a resposta sai, com o material ainda `processando` (regra 00, item 4).
   *
   * O arquivo é guardado no storage privado **antes** da transação, com o id do material na chave, e a linha de `envio_de_material` nasce **antes**
   * do arquivo (2.0): é ela que faz a varredura horária achar o objeto de um envio que nunca chegou ao commit. A transação a apaga no fim, sob
   * `lock_timeout` curto, e a linha precisa existir: se a varredura já a apagou (o envio foi lento), o envio desfaz com 503, para nunca haver material
   * cujo objeto a varredura levou. Toda saída depois do `guardarBytes` apaga o **objeto primeiro** (o objeto ausente conta) e só então a linha; o
   * `apagar` que falha deixa a linha, e a varredura apaga os dois. A falha do próprio `guardarBytes` tenta apagar o objeto e **deixa a linha**: o PUT
   * atrasado pode gravar depois do `apagar`. O job entra no outbox na mesma transação da linha, então não há material `processando` sem job (D49).
   */
  async send(pedido: EnviarMaterialRequest, arquivo: unknown): Promise<MaterialResponse> {
    const { banco, logger } = this.dependencias
    const disciplinaId = pedido.disciplinaId.toLowerCase()
    if ((await new DisciplinaRepository(banco).porId(disciplinaId)) === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    // Em minúsculas, como o banco as devolve: a resposta e a auditoria levam o mesmo texto que a lista do material.
    const serieIds = pedido.serieIds.map((id) => id.toLowerCase())
    if ((await new MaterialRepository(banco).seriesDaEscola(serieIds)).length !== serieIds.length) throw new DomainException(ErrorCode.NAO_ENCONTRADO)

    const motivo = motivoDaRecusaDoMaterial(pedido)
    if (motivo !== null) {
      await this.#registrarRecusa(pedido, disciplinaId, serieIds, motivo)
      throw new DomainException(ErrorCode.MATERIAL_SEM_LICENCA)
    }
    // Depois da recusa, a licença é uma das quatro com que um material entra.
    const licenca = pedido.licenca as LicencaDeMaterial
    const licencaId = pedido.licencaId?.toLowerCase()
    if (licencaId !== undefined) await this.#exigirLicencaVigente(pedido, disciplinaId, serieIds, licencaId)

    if (!isArquivoRecebido(arquivo) || arquivo.size === 0 || !hasAssinaturaDePdf(arquivo.buffer)) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
    const bytes = arquivo.buffer
    const sha256 = createHash('sha256').update(bytes).digest('hex')

    const gravado = await this.#saveEnvio(
      bytes,
      async (tx, id) => {
        const materiais = new MaterialRepository(tx)
        // A licença do envio, lida de novo e **travada** (`for share`): o `PATCH` que encurta a vigência (`for update`) espera este envio terminar.
        const vigente = await this.#licencaTravada(tx, licencaId)
        const novo = await materiais.insert({
          id,
          disciplinaId,
          titulo: pedido.titulo,
          titularidade: pedido.titularidade,
          licencaId: licencaId ?? null,
          licenca,
          sha256,
          tamanhoBytes: bytes.byteLength,
        })
        await materiais.saveSeries(novo.id, serieIds)
        await registro.save(tx, 'material.enviado', { entidadeId: novo.id, depois: { disciplinaId, titularidade: pedido.titularidade, licenca, declaracao: true } })
        await this.dependencias.enfileirador.enfileirarUmaVez(tx, TIPO_EXTRAIR_PDF, { materialId: novo.id }, novo.id)
        return { ...novo, licenciante: vigente?.licenciante ?? null, serieIds: serieIds.toSorted() }
      },
      () => this.#registrarRecusa(pedido, disciplinaId, serieIds, 'licenca_vencida'),
    )
    const tamanho = bytes.byteLength
    logger.info({ evento: 'material.enviado', materialId: gravado.id, tamanho })
    // Quem envia é sempre a coordenação (a célula `material.enviar` é só dela): recebe o que declarou.
    return paraResposta(gravado, 'unidade')
  }

  /**
   * `POST /v1/materiais/:id/edicoes` (ingestao-do-material, 8.0; RF10; Tech Spec, seção 5, "Envio e edição"): a edição nova de um material `pronto`. A anterior **segue na busca** até a nova ficar `pronta`, e sai na
   * transação da extração (`material.substituido`); se a nova falhar, a anterior segue. A edição herda do alvo a disciplina, as séries, a titularidade e a licença, e a ordem é a regra:
   *
   * 1. o alvo é da escola da sessão, não excluído e `pronto`, ou `NAO_ENCONTRADO` (o de outra escola, o excluído, o substituído e o inexistente respondem igual, e nenhum byte é lido); o alvo `processando`, `EDICAO_EM_ANDAMENTO`;
   * 2. **a licença do alvo, antes de abrir o arquivo**: a vencida ou que ainda não começou grava `material.recusado` (com as séries do alvo) e responde `LICENCA_VENCIDA`;
   * 3. só então o arquivo, como no envio, e os mesmos tetos e a mesma trava de envios da escola;
   * 4. na transação, o alvo é lido de novo, **`for update`**, e a edição herda o que lê **ali**: as séries que um `PATCH` confirmou entre o passo 1 e a transação entram. Com o alvo já substituído por outra edição que
   *    estava sendo gravada, a espera pelo `for update` termina sem linha, e a resposta é `NAO_ENCONTRADO`. Sob a mesma trava, uma edição `processando` sobre o alvo é `EDICAO_EM_ANDAMENTO`, e o índice
   *    `material_uma_edicao_em_andamento` repete a regra no banco.
   *
   * O arquivo igual ao de um material da escola é `CONFLITO` (índice `material_arquivo_na_escola_unico`), com o objeto e a linha do envio apagados, como no envio.
   */
  async sendEdicao(alvoId: string, pedido: EnviarEdicaoRequest, arquivo: unknown): Promise<MaterialResponse> {
    const { banco, logger } = this.dependencias
    const materiais = new MaterialRepository(banco)
    const alvo = await materiais.alvoDaEdicao(alvoId)
    if (alvo === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    if (alvo.estado === 'processando') throw new DomainException(ErrorCode.EDICAO_EM_ANDAMENTO)
    // `falhou` não tem edição: só o envio novo. Responde como o que não existe, igual ao excluído.
    if (alvo.estado !== 'pronto') throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const seriesDoAlvo = await materiais.seriesDoMaterial(alvo.id)
    const declarado: Declarado = { titularidade: alvo.titularidade, licenca: alvo.licenca, declaracao: true }
    if (alvo.licencaId !== null) await this.#exigirLicencaVigente(declarado, alvo.disciplinaId, seriesDoAlvo, alvo.licencaId)

    if (!isArquivoRecebido(arquivo) || arquivo.size === 0 || !hasAssinaturaDePdf(arquivo.buffer)) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
    const bytes = arquivo.buffer
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const gravado = await this.#saveEnvio(
      bytes,
      (tx, id) => this.#saveEdicao(tx, id, alvo.id, pedido, { sha256, tamanhoBytes: bytes.byteLength }),
      () => this.#registrarRecusa(declarado, alvo.disciplinaId, seriesDoAlvo, 'licenca_vencida'),
    )
    const tamanho = bytes.byteLength
    logger.info({ evento: 'material.edicao_enviada', materialId: gravado.id, substituiId: alvo.id, tamanho })
    return paraResposta(gravado, 'unidade')
  }

  /** A parte da transação do envio que é da edição: o alvo `for update`, a herança lida ali, a edição, as séries, a auditoria e o job. */
  async #saveEdicao(tx: DatabaseTransaction, id: string, alvoId: string, pedido: EnviarEdicaoRequest, arquivo: { sha256: string; tamanhoBytes: number }): Promise<MaterialLido> {
    const materiais = new MaterialRepository(tx)
    const alvo = await materiais.lockAlvoDaEdicao(alvoId)
    // Sem linha: o alvo foi excluído ou substituído enquanto este envio esperava a trava (um `pronto` nunca volta a `processando`).
    if (alvo === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    if (await materiais.edicaoEmAndamentoSobre(alvo.id)) throw new DomainException(ErrorCode.EDICAO_EM_ANDAMENTO)
    const herdadas = await materiais.seriesDoMaterial(alvo.id)
    const vigente = await this.#licencaTravada(tx, alvo.licencaId ?? undefined)
    const nova = await materiais.insert({
      id,
      disciplinaId: alvo.disciplinaId,
      titulo: pedido.titulo ?? alvo.titulo,
      titularidade: alvo.titularidade,
      licencaId: alvo.licencaId,
      licenca: alvo.licenca,
      sha256: arquivo.sha256,
      tamanhoBytes: arquivo.tamanhoBytes,
      edicao: pedido.edicao ?? null,
      substituiId: alvo.id,
    })
    if (herdadas.length > 0) await materiais.saveSeries(nova.id, herdadas)
    await registro.save(tx, 'material.edicao_enviada', {
      entidadeId: nova.id,
      depois: { substituiId: alvo.id, disciplinaId: alvo.disciplinaId, titularidade: alvo.titularidade, licenca: alvo.licenca, declaracao: true },
    })
    await this.dependencias.enfileirador.enfileirarUmaVez(tx, TIPO_EXTRAIR_PDF, { materialId: nova.id }, nova.id)
    return { ...nova, licenciante: vigente?.licenciante ?? null, serieIds: herdadas }
  }

  /** A licença registrada, lida **`for share`** dentro da transação do envio: a que deixou de valer entre a entrada e aqui (ou sumiu) desfaz o envio. Sem `licencaId`, nada a ler. */
  async #licencaTravada(tx: DatabaseTransaction, licencaId: string | undefined): Promise<LicencaParaUso | undefined> {
    if (licencaId === undefined) return undefined
    const vigente = await new LicencaRepository(tx).paraUso(licencaId, true)
    if (vigente === undefined || !licencaValeEm(this.#hoje(), vigente)) throw new LicencaDeixouDeValerNoEnvio()
    return vigente
  }

  /**
   * O objeto no storage, a transação do envio e a saída de quem não chegou ao commit: o que o envio e a edição fazem igual. A linha de `envio_de_material` nasce **antes** do arquivo (2.0), o objeto vai ao storage
   * **antes** da transação, com o id do material na chave, e a transação a apaga no fim, sob `lock_timeout` curto: a linha precisa existir, e se a varredura já a apagou (o envio foi lento) a transação desfaz com 503,
   * para nunca haver material cujo objeto a varredura levou. `gravar` é o que difere: o que entra na transação, depois da trava de envios, dos tetos e antes de a linha do envio sair.
   */
  async #saveEnvio(bytes: Buffer, gravar: (tx: DatabaseTransaction, id: string) => Promise<MaterialLido>, recusarPelaLicenca: () => Promise<void>): Promise<MaterialLido> {
    const { banco, armazem } = this.dependencias
    // O id nasce aqui, antes da linha: a chave do objeto o leva, e a varredura acha o órfão por ela.
    const id = uuidV7()
    // A linha do envio vem antes do objeto: sem ela, o PDF que chega ao storage e nunca tem commit não tem dono, e ninguém o procura.
    await new EnvioDeMaterialRepository(banco).registrar(id)
    await this.#guardarObjeto(armazem, id, bytes)
    return banco
      .transaction(async (tx) => {
        const materiais = new MaterialRepository(tx)
        await materiais.lockEnviosDaEscola()
        await this.#exigirDentroDosTetos(materiais)
        const gravado = await gravar(tx, id)
        // A linha sai com o commit. Sem ela, a varredura já a levou (e o objeto com ela): o envio foi lento demais e desfaz, sem material sem objeto.
        if (!(await new EnvioDeMaterialRepository(tx).deleteNoEnvio(id))) throw new DomainException(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, undefined, DEFAULT_RETRY_AFTER_SECONDS)
        return gravado
      })
      .catch(async (erro: unknown) => {
        // Teto, duplicado, licença, edição, trava ou banco fora: nenhuma linha de material ficou, então o objeto não tem dono. O objeto sai primeiro e a linha do envio só depois.
        await this.#desfazerEnvio(id)
        if (erro instanceof LicencaDeixouDeValerNoEnvio) {
          await recusarPelaLicenca()
          throw new DomainException(ErrorCode.LICENCA_VENCIDA)
        }
        if (postgresErrorIn(erro)?.code === TRAVA_NAO_DISPONIVEL) throw new DomainException(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO, undefined, DEFAULT_RETRY_AFTER_SECONDS)
        const doBanco = postgresErrorIn(erro)
        if (doBanco?.code === VIOLACAO_DE_UNICO && doBanco.constraint === INDICE_DA_EDICAO_EM_ANDAMENTO) throw new DomainException(ErrorCode.EDICAO_EM_ANDAMENTO)
        throw erro
      })
  }

  /**
   * Os tetos de envio antes de o corpo ser recebido (`MaterialUploadGuard`): quem já passou do teto não sobe 20 MB para
   * ouvir a recusa. É leitura sem trava; quem decide é a conferência dentro da transação do envio.
   */
  async exigirEnvioDentroDosTetos(): Promise<void> {
    await this.#exigirDentroDosTetos(new MaterialRepository(this.dependencias.banco))
  }

  /**
   * O teto do `PATCH` do material antes de o corpo ser lido (`MaterialAtualizarGuard`; regra 80, itens 1 e 3): 100 por hora por pessoa e 300 por escola, **à parte do teto de envios** (os dois não se
   * somam). Conta as alterações já gravadas (`material.atualizado`, na auditoria) na janela de uma hora. É leitura sem trava, como a dos envios: protege do laço, e as poucas alterações em voo ao mesmo
   * tempo podem passar um pouco do número. Acima do teto, `LIMITE_EXCEDIDO` com o `Retry-After` da janela inteira.
   */
  async exigirAtualizacaoDentroDosTetos(): Promise<void> {
    const feitas = await new AuditoriaRepository(this.dependencias.banco).countDaEscolaEDaPessoaDesde('material.atualizado', new Date(Date.now() - JANELA_DAS_ATUALIZACOES_MS))
    if (feitas.doUsuario >= ATUALIZACOES_POR_USUARIO_NA_JANELA || feitas.daEscola >= ATUALIZACOES_POR_ESCOLA_NA_JANELA) {
      const tipo = feitas.daEscola >= ATUALIZACOES_POR_ESCOLA_NA_JANELA ? 'escola' : 'usuario'
      this.dependencias.logger.warn({ evento: 'material.teto_de_atualizacoes', tipo })
      throw new DomainException(ErrorCode.LIMITE_EXCEDIDO, undefined, JANELA_DAS_ATUALIZACOES_MS / 1_000)
    }
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
      await armazem.delete(chaveDoTemporario(id)).catch((falha: unknown) => this.dependencias.logger.warn({ evento: 'material.objeto_nao_apagado', materialId: id, erro: summarizeError(falha) }))
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
      await armazem.delete(chaveDoTemporario(id))
    } catch (falha) {
      logger.warn({ evento: 'material.objeto_nao_apagado', materialId: id, erro: summarizeError(falha) })
      return
    }
    await new EnvioDeMaterialRepository(banco).delete(id).catch((falha: unknown) => logger.warn({ evento: 'material.envio_nao_apagado', materialId: id, erro: summarizeError(falha) }))
  }

  async #deleteObjetoDoExcluido(id: string): Promise<void> {
    const { banco, armazem, logger } = this.dependencias
    try {
      await armazem.delete(chaveDoTemporario(id))
      await new ExtracaoDoMaterialRepository(banco).marcarObjetoApagado(id)
    } catch (erro) {
      logger.warn({ evento: 'material.objeto_nao_apagado', materialId: id, erro: summarizeError(erro) })
    }
  }

  /**
   * `PATCH /v1/materiais/:id` (ingestao-do-material, 12.0; RF6; Tech Spec, seções 4 e 5): a coordenação corrige o título e as séries de um material. A ordem é a regra:
   *
   * 1. as séries pedidas são da escola da sessão, ou `NAO_ENCONTRADO` (a de outra escola responde como a inexistente, e a auditoria nunca leva o id dela);
   * 2. a transação trava a linha do material (`for update`): o de outra escola, o excluído, o substituído e o inexistente dão `NAO_ENCONTRADO`, **sempre antes** de `EDICAO_EM_ANDAMENTO` (regra 10, item 6: quem
   *    não alcança o material não descobre, pela outra resposta, que ele tem uma edição em andamento);
   * 3. a edição que ainda está `processando`, ou a que o material tem sobre si, dá `EDICAO_EM_ANDAMENTO`: a edição herda as séries do material que substitui, lidas sob esta mesma trava, e quem as
   *    altera no meio deixaria as duas fora de passo. A edição que está sendo gravada segura a linha do alvo até o commit, então este `PATCH` espera e, depois, já enxerga a edição;
   * 4. o título e as séries mudam e `material.atualizado` é gravado, na mesma transação. As séries tiradas deixam a busca e a página aberta na hora; o título não vai à auditoria.
   *
   * Dois `PATCH` do mesmo material passam um depois do outro: o último vale, sem `500`.
   */
  async update(id: string, pedido: AtualizarMaterialRequest): Promise<MaterialResponse> {
    const { banco, logger } = this.dependencias
    // Em minúsculas, como o banco as devolve: a auditoria leva o mesmo texto que a resposta.
    const serieIds = pedido.serieIds?.map((serieId) => serieId.toLowerCase())
    if (serieIds !== undefined && (await new MaterialRepository(banco).seriesDaEscola(serieIds)).length !== serieIds.length) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    await banco.transaction(async (tx) => {
      const materiais = new MaterialRepository(tx)
      const alvo = await materiais.lockParaAtualizar(id)
      if (alvo === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      if (alvo.estado === 'processando' && alvo.substitui !== null) throw new DomainException(ErrorCode.EDICAO_EM_ANDAMENTO)
      if (await materiais.edicaoEmAndamentoSobre(alvo.id)) throw new DomainException(ErrorCode.EDICAO_EM_ANDAMENTO)
      const antes = await materiais.seriesDoMaterial(alvo.id)
      if (pedido.titulo !== undefined) await materiais.renomear(alvo.id, pedido.titulo)
      if (serieIds !== undefined) await materiais.substituirSeries(alvo.id, serieIds)
      await registro.save(tx, 'material.atualizado', {
        entidadeId: alvo.id,
        antes: { serieIds: antes },
        depois: { serieIds: serieIds?.toSorted() ?? antes, tituloAlterado: pedido.titulo !== undefined },
      })
      await this.#refazAClassificacaoSeAsSeriesMudaram(tx, alvo.id, serieIds, antes)
    })
    logger.info({ evento: 'material.atualizado', materialId: id })
    const lido = await new MaterialRepository(banco).porId(id, 'unidade')
    if (lido === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    // Quem altera é sempre a coordenação (a célula `material.enviar` é só dela): recebe o que declarou.
    return paraResposta(lido, 'unidade')
  }

  /**
   * Só as séries mudam o recorte da classificação (classificacao-bncc, 6.0): o `PATCH` enfileira o job do material, na mesma transação, e é o job que limpa e agenda pelo recorte que estiver no banco. A chave é nova a cada troca.
   * O mesmo conjunto de séries, ou só o título, não refaz a classificação.
   */
  async #refazAClassificacaoSeAsSeriesMudaram(tx: DatabaseTransaction, materialId: string, pedidas: readonly string[] | undefined, antes: readonly string[]): Promise<void> {
    if (pedidas === undefined || pedidas.toSorted().join() === antes.toSorted().join()) return
    await this.dependencias.enfileirador.enfileirarUmaVez(tx, TIPO_AGENDAR_CLASSIFICACAO, { materialId }, randomUUID())
  }

  /** `GET /v1/materiais`: a coordenação, os da escola; o professor, os das disciplinas dele, com ou sem o filtro. */
  async list(consulta: MateriaisQuery): Promise<ListaDeMateriaisResponse> {
    const filtro = { ...consulta, ...(consulta.disciplinaId === undefined ? {} : { disciplinaId: consulta.disciplinaId.toLowerCase() }) }
    const alcance = alcanceDoMaterial('listar')
    const linhas = await new MaterialRepository(this.dependencias.banco).list(filtro, alcance)
    const { itens, proxima } = paginar(linhas, consulta.limite)
    return listaDeMateriaisResponseSchema.parse({ itens: itens.map((item) => paraResposta(item, alcance)), ...(proxima === undefined ? {} : { proxima }) })
  }

  /** `GET /v1/materiais/:id`, com os capítulos lidos do PDF. De outra escola, de disciplina sem vínculo, excluído ou inexistente: `NAO_ENCONTRADO`, sem capítulo. */
  async read(id: string): Promise<MaterialComCapitulosResponse> {
    const alcance = alcanceDoMaterial('ler')
    const materiais = new MaterialRepository(this.dependencias.banco)
    const lido = await materiais.porId(id, alcance)
    if (lido === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    // `porId` e `capitulos` são duas consultas, sem transação: se o expurgo apagar o material entre as duas, a resposta sai com o material e a lista vazia.
    // Aceito: o material vale até a exclusão, e uma lista vazia de um material que acabou de sumir não expõe nada a quem não o alcançava.
    // A resposta é validada uma vez só, pelo esquema estrito do contrato inteiro.
    const secoes = new SecoesRepository(this.dependencias.banco)
    const lidas = await secoes.doMaterial(id)
    const habilidades = await secoes.habilidadesDasSecoes(lidas.map((secao) => secao.id))
    return materialComCapitulosResponseSchema.parse({
      ...daLinhaParaOContrato(lido, alcance),
      capitulos: await materiais.capitulos(id),
      secoes: lidas.map((secao) => paraSecaoResposta(secao, habilidades)),
      classificacaoSuspensa: await new SuspensaoRepository(this.dependencias.banco).estaSuspensa(FUNCAO_DA_TAREFA_DE_IA.classificar_secoes),
    })
  }

  /**
   * `PUT /v1/materiais/:id/secoes/:secaoId/habilidades` (classificacao-bncc, 7.0; RF6; Tech Spec, seção 5, "Correção"): a coordenação troca as habilidades da seção por de zero a cinco códigos, e a correção é **final**: vence a
   * IA, e nem a classificação da noite, nem o reclassificar, nem a mudança de recorte a desfazem. A ordem é a regra (Tech Spec, seção 4):
   *
   * 1. o material é da escola da sessão e a seção é dele, ou `NAO_ENCONTRADO` (de outra escola, excluído, inexistente, e a seção de outro material respondem igual, antes de qualquer outra resposta);
   * 2. a transação trava a seção (`for update`): o `concluir` da classificação em andamento termina antes, e a correção aplica por cima; duas correções passam uma depois da outra, cada uma com o "antes" que de fato achou;
   * 3. disciplina sem componente: `CONFLITO` (o recorte não existe); com ele, código fora do recorte atual, de outra etapa ou que a tabela da BNCC não tem: `ENTRADA_INVALIDA`; depois, o material que não está `pronto`: `CONFLITO`.
   *
   * Grava `material.classificacao_corrigida` (a seção e os códigos de antes e de depois, nunca o título). Devolve a seção.
   */
  async corrigirSecao(materialId: string, secaoId: string, pedido: CorrigirSecaoRequest): Promise<SecaoDoMaterialResponse> {
    const { banco, logger } = this.dependencias
    const resposta = await banco.transaction(async (tx) => {
      const alvo = await new MaterialRepository(tx).porId(materialId, 'unidade')
      if (alvo === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const secoes = new SecoesRepository(tx)
      if ((await secoes.lockParaCorrigir(alvo.id, secaoId)) === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const recorte = await secoes.recorteDoMaterial(alvo.id, alvo.disciplinaId)
      if (recorte.componente === null) throw new DomainException(ErrorCode.CONFLITO)
      const { componente } = recorte
      if (pedido.codigos.some((codigo) => !habilidadeEhCandidata(codigo, componente, recorte.series))) throw new DomainException(ErrorCode.ENTRADA_INVALIDA)
      if (alvo.estado !== 'pronto') throw new DomainException(ErrorCode.CONFLITO)
      const antes = await secoes.codigosDaSecao(secaoId)
      await secoes.saveCorrecao(secaoId, pedido.codigos)
      await registro.save(tx, 'material.classificacao_corrigida', {
        entidadeId: alvo.id,
        antes: { secaoId, habilidades: habilidadesDaAuditoriaSchema.parse(antes) },
        depois: { secaoId, habilidades: [...pedido.codigos].sort() },
      })
      const [lida] = await secoes.doMaterial(alvo.id, secaoId)
      if (lida === undefined) throw new InvariantException('seção corrigida não lida')
      return paraSecaoResposta(lida, await secoes.habilidadesDasSecoes([secaoId]))
    })
    logger.info({ evento: 'material.classificacao_corrigida', materialId, secaoId })
    return resposta
  }

  /**
   * `POST /v1/materiais/:id/reclassificar` (classificacao-bncc, 7.0; RF12; Tech Spec, seção 5, "Reclassificar"): as seções **não corrigidas** do material ganham execução nova, para a classificação da noite, **sem reenviar o PDF**
   * (o texto vem dos `trecho`, e o storage nem é aberto). A que já tem execução `pendente` fica como está, e a correção da coordenação nunca é tocada. A ordem é a regra: o material da escola, senão `NAO_ENCONTRADO`; material que não
   * está `pronto` ou disciplina sem componente, `CONFLITO`; função suspensa, `FUNCAO_SUSPENSA`. O pedido só cria as execuções e os jobs (na fila `lote`, para fora do horário letivo): a classificação roda no worker. Responde 202.
   */
  async reclassificar(materialId: string): Promise<ReclassificarResponse> {
    const { banco, enfileirador, logger } = this.dependencias
    const resposta = await banco.transaction(async (tx) => {
      const alvo = await new MaterialRepository(tx).porId(materialId, 'unidade')
      if (alvo === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const secoes = new SecoesRepository(tx)
      const recorte = await secoes.recorteDoMaterial(alvo.id, alvo.disciplinaId)
      if (alvo.estado !== 'pronto' || recorte.componente === null) throw new DomainException(ErrorCode.CONFLITO)
      const agendamento = new AgendamentoDaClassificacaoRepository(tx)
      if (!(await agendamento.funcaoEstaAtiva())) throw new DomainException(ErrorCode.FUNCAO_SUSPENSA)
      let cursor = ANTES_DA_PRIMEIRA_SECAO
      let agendadas = 0
      let aguardando = 0
      for (;;) {
        const lote = await agendamento.lockParaReclassificar({ materialId: alvo.id }, SECOES_POR_LOTE_DO_AGENDAMENTO, cursor)
        if (lote.ultima === undefined) break
        cursor = lote.ultima
        aguardando += lote.aguardando
        agendadas += (await agendamento.agendar(lote.aReclassificar, enfileirador)).secoes
      }
      const saida = { secoes: agendadas + aguardando, preservadas: await secoes.countCorrigidas(alvo.id) }
      await registro.save(tx, 'material.reclassificado', { entidadeId: alvo.id, depois: saida })
      return saida
    })
    logger.info({ evento: 'material.reclassificado', materialId })
    return resposta
  }

  /**
   * `GET /v1/habilidades-bncc` (classificacao-bncc, 7.0; Tech Spec, seção 4): as candidatas do recorte atual de um material (a coordenação, e o professor da disciplina em que tem vínculo confirmado) ou do artefato do próprio
   * professor (componente da disciplina e série da turma). O objeto primeiro: o material de outra escola, de disciplina sem vínculo, o artefato de outra escola, de colega ou de outro ano, e o inexistente respondem igual
   * (`NAO_ENCONTRADO`). Sem componente na disciplina, a lista vem vazia com `semComponente`.
   */
  async listHabilidades(consulta: HabilidadesBnccQuery): Promise<HabilidadesBnccResponse> {
    const { banco } = this.dependencias
    const secoes = new SecoesRepository(banco)
    let recorte
    if ('materialId' in consulta) {
      const lido = await new MaterialRepository(banco).porId(consulta.materialId.toLowerCase(), alcanceDoMaterial('ler'))
      if (lido === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      recorte = await secoes.recorteDoMaterial(lido.id, lido.disciplinaId)
    } else {
      recorte = await secoes.recorteDoArtefato(consulta.artefatoId.toLowerCase())
      if (recorte === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    }
    if (recorte.componente === null) return habilidadesBnccResponseSchema.parse({ itens: [], semComponente: true })
    return habilidadesBnccResponseSchema.parse({ itens: await candidatasDoRecorte(new BnccRepository(banco), recorte.componente, recorte.series), semComponente: false })
  }

  /** O teto das correções antes de o corpo ser lido (`MaterialCorrigirGuard`): 300 por hora por pessoa e 900 por escola, contados na auditoria (`material.classificacao_corrigida`). */
  exigirCorrecaoDentroDosTetos(): Promise<void> {
    return this.#exigirDentroDoTetoDaAuditoria('material.classificacao_corrigida', CORRECOES_POR_USUARIO_NA_JANELA, CORRECOES_POR_ESCOLA_NA_JANELA, 'material.teto_de_correcoes')
  }

  /** O teto dos pedidos de reclassificar antes de o corpo ser lido (`MaterialReclassificarGuard`): 100 por hora por pessoa e 300 por escola, contados na auditoria (`material.reclassificado`). */
  exigirReclassificacaoDentroDosTetos(): Promise<void> {
    return this.#exigirDentroDoTetoDaAuditoria('material.reclassificado', RECLASSIFICACOES_POR_USUARIO_NA_JANELA, RECLASSIFICACOES_POR_ESCOLA_NA_JANELA, 'material.teto_de_reclassificacoes')
  }

  /** Por pessoa e por escola, nunca por IP (regra 80, itens 1 e 3). Leitura sem trava, como a do `PATCH`: protege do laço, e o excesso de pedidos simultâneos que passam juntos pela contagem (lê, depois grava) foi aceito, porque o teto não é cota. Acima do teto, `LIMITE_EXCEDIDO` com o `Retry-After` da janela inteira. */
  async #exigirDentroDoTetoDaAuditoria(acao: 'material.classificacao_corrigida' | 'material.reclassificado', porUsuario: number, porEscola: number, evento: string): Promise<void> {
    const feitas = await new AuditoriaRepository(this.dependencias.banco).countDaEscolaEDaPessoaDesde(acao, new Date(Date.now() - JANELA_DA_CLASSIFICACAO_MS))
    if (feitas.doUsuario >= porUsuario || feitas.daEscola >= porEscola) {
      this.dependencias.logger.warn({ evento })
      throw new DomainException(ErrorCode.LIMITE_EXCEDIDO, undefined, JANELA_DA_CLASSIFICACAO_MS / 1_000)
    }
  }

  /**
   * `DELETE /v1/materiais/:id`: exclusão lógica (regra 20, item 15). A linha fica, porque artefatos já citam o
   * material; os trechos saem de fato, e a auditoria `material.excluido` é gravada, tudo na mesma transação. De outra
   * escola, já excluído ou inexistente: `NAO_ENCONTRADO`, e nada muda.
   */
  async delete(id: string): Promise<void> {
    const { banco, logger } = this.dependencias
    const { trechosTotal, estado } = await banco.transaction(async (tx) => {
      const materiais = new MaterialRepository(tx)
      const excluido = await materiais.softDelete(id)
      if (excluido === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
      const apagados = await materiais.deleteTrechos(id)
      await registro.save(tx, 'material.excluido', { entidadeId: id, antes: { disciplinaId: excluido.disciplinaId, estado: excluido.estado }, depois: { trechosApagados: apagados } })
      return { trechosTotal: apagados, estado: excluido.estado }
    })
    logger.info({ evento: 'material.excluido', materialId: id, trechosTotal })
    // Só o `processando` ainda tem o objeto: o `pronto` e o `falhou` já o apagaram. Depois do commit, e sem poder desfazer a exclusão:
    // o que não saiu agora sai no expurgo noturno (`excluidosComObjeto`).
    if (estado === 'processando') await this.#deleteObjetoDoExcluido(id)
  }

  /**
   * `GET /v1/materiais/resumo` (ingestao-do-material, 11.0; RF18): só a coordenação (a célula `material.resumir`). Por disciplina e série, quantos materiais da escola estão `pronto`, `processando` e `falhou`
   * (o excluído e o substituído não contam, e o material de várias séries conta em cada uma), quantos envios foram recusados nos últimos `DIAS_DAS_RECUSAS_NO_RESUMO` dias por falta de licença, de declaração ou de vigência
   * (`MOTIVOS_DA_RECUSA_QUE_O_RESUMO_CONTA`, lidos da auditoria, na série que a recusa conferiu) e quantos materiais estão sem série. A janela é contada do `Clock` do serviço. Não depende do ano letivo: a escola sem ano em curso o vê.
   * Só ids e contagens (regra 70, itens 7 e 9): nenhum título, licenciante nem autor.
   */
  async resumir(): Promise<ResumoDoMaterialResponse> {
    const { banco } = this.dependencias
    const desde = new Date(this.#agora().getTime() - DIAS_DAS_RECUSAS_NO_RESUMO * 24 * 60 * 60_000)
    const [materiais, recusas] = await Promise.all([
      new MaterialRepository(banco).countPorDisciplinaESerie(),
      new AuditoriaRepository(banco).recusasDeMaterialDesde(desde, MOTIVOS_DA_RECUSA_QUE_O_RESUMO_CONTA),
    ])
    const linhas = new Map<string, ResumoDoMaterialRow>()
    const linhaDe = (disciplinaId: string, serieId: string | null): ResumoDoMaterialRow => {
      const chave = `${disciplinaId}|${serieId ?? ''}`
      const achada = linhas.get(chave)
      if (achada !== undefined) return achada
      const nova: ResumoDoMaterialRow = { disciplinaId, serieId, pronto: 0, processando: 0, falhou: 0, recusados30Dias: 0 }
      linhas.set(chave, nova)
      return nova
    }
    let semSerie = 0
    for (const contado of materiais) {
      linhaDe(contado.disciplinaId, contado.serieId)[contado.estado] += contado.total
      if (contado.serieId === null) semSerie += contado.total
    }
    for (const recusada of recusas) {
      linhaDe(recusada.disciplinaId, recusada.serieId).recusados30Dias += recusada.total
    }
    // A ordem é da tela, que a faz pelo nome da disciplina e pela posição da série (`linhasDoResumo`).
    return resumoDoMaterialResponseSchema.parse({ linhas: [...linhas.values()], semSerie })
  }

  /**
   * `GET /v1/materiais/cobertura?serieId=` (classificacao-bncc, 13.0; RF19; Tech Spec, seções 4 e 5, "Cobertura"): só a coordenação (a célula `material.resumir`). Por grupo (o componente no Fundamental, a área no Médio),
   * as habilidades da BNCC que a série tem e que nenhum material em uso cobre. Cobre a seção **classificada** (a corrigida pela coordenação, ou a que a execução concluiu) de material `pronto`, não excluído, declarado para
   * a série e próprio ou de licença vigente hoje, e só o código que é candidato do componente da disciplina do material nesta série (`habilidadeEhCandidata`: o `EF69LP01` num material só do 6º não cobre o 7º). Com a
   * função suspensa, vale só a correção. Além disso, quantas seções desses materiais ainda não terminaram a classificação. A série de outra escola e a inexistente respondem `NAO_ENCONTRADO`, igual (regra 10, item 6).
   * Só códigos e contagens: nenhum título de material. Sem paginação: a lista de uma série cabe em ~200 habilidades.
   */
  async cobertura(consulta: CoberturaQuery): Promise<CoberturaResponse> {
    const { banco } = this.dependencias
    const cobertura = new CoberturaRepository(banco)
    const serieId = consulta.serieId.toLowerCase()
    const recorte = await cobertura.serieDaEscola(serieId)
    if (recorte === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
    const suspensa = await new SuspensaoRepository(banco).estaSuspensa(FUNCAO_DA_TAREFA_DE_IA.classificar_secoes)
    const hoje = this.#hoje()
    const [materiaisEmUso, daSerie, cobertas, semClassificacao] = await Promise.all([
      cobertura.materiaisEmUso(serieId, hoje),
      new BnccRepository(banco).habilidades({ etapa: recorte.etapa, ano: recorte.ano }),
      cobertura.habilidadesCobertas(serieId, hoje, suspensa),
      cobertura.secoesSemClassificacao(serieId, hoje, suspensa),
    ])
    const codigosCobertos = new Set(cobertas.filter(({ componente, codigo }) => habilidadeEhCandidata(codigo, componente, [recorte])).map(({ codigo }) => codigo))
    // As seções sem classificação por grupo: a Química e a Física somam no mesmo grupo (Ciências no Fundamental), e o componente sem grupo na etapa (`null`) fica na chave dele, que nenhum grupo da série lê.
    const semClassificacaoPorGrupo = new Map<GrupoDaCobertura | null, number>()
    for (const { componente, total } of semClassificacao) {
      const grupo = grupoDaCoberturaDoComponente(componente, recorte.etapa)
      semClassificacaoPorGrupo.set(grupo, (semClassificacaoPorGrupo.get(grupo) ?? 0) + total)
    }
    const grupos = new Map<GrupoDaCobertura, GrupoDaCoberturaResponse>()
    for (const { codigo, descricao, grupo } of daSerie) {
      const atual = grupos.get(grupo) ?? { chave: grupo, total: 0, semMaterial: [], secoesSemClassificacao: semClassificacaoPorGrupo.get(grupo) ?? 0 }
      grupos.set(grupo, { ...atual, total: atual.total + 1, semMaterial: codigosCobertos.has(codigo) ? atual.semMaterial : [...atual.semMaterial, { codigo, descricao }] })
    }
    const ordenados = [...grupos.values()].sort((a, b) => nomeDoGrupoDaCobertura(a.chave, recorte.etapa).localeCompare(nomeDoGrupoDaCobertura(b.chave, recorte.etapa), 'pt-BR'))
    return coberturaResponseSchema.parse({ serieId, etapa: recorte.etapa, materiaisEmUso, grupos: ordenados, classificacaoSuspensa: suspensa })
  }

  /**
   * `GET /v1/materiais/busca`: os trechos por relevância, com todas as palavras da busca
   * (`websearch_to_tsquery('portuguese', q)`), dentro da escola do contexto e do alcance de quem pede, **só do material
   * próprio ou de licença vigente hoje** e, com `serieId`, só do declarado para a série (a série **filtra e não autoriza**: a de outra escola não acha nada).
   */
  async find(consulta: BuscaDeMaterialQuery): Promise<BuscaDeMaterialResponse> {
    const achados = await new MaterialRepository(this.dependencias.banco).get(
      { texto: consulta.q, disciplinaId: consulta.disciplinaId?.toLowerCase(), serieId: consulta.serieId?.toLowerCase(), hoje: this.#hoje(), limite: consulta.limite, palavras: 'todas' },
      alcanceDoMaterial('buscar'),
    )
    return buscaDeMaterialResponseSchema.parse({ itens: achados.map(({ materialId, titulo, pagina, texto }) => ({ materialId, titulo, pagina, trecho: trechoCitado(texto, consulta.q) })) })
  }
}
