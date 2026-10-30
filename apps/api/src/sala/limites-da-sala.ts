import { DomainException, insuranceLimit, METRICS, retryAfterSeconds, type LoggerBase, type Meter } from '@educa/nucleo'
import { ErrorCode } from '@educa/shared'
import { Logger } from '@nestjs/common'
import type { GuardaDoCodigo } from '../sessao/index.js'
import type { ContadorEmJanela } from '../credencial/index.js'

/** A janela dos três contadores da sala (Tech Spec da A1, 7c): 10 min desde a primeira soma de cada chave. */
export const JANELA_DOS_LIMITES_DA_SALA_MS = 10 * 60_000
/** Códigos errados numa escola, na janela, antes de a busca pelo código passar a esperar. */
export const TETO_DE_CODIGOS_ERRADOS_POR_ESCOLA = 1_000
/** Matrículas erradas num nome livre, pelo mesmo acesso da turma, antes de o nome travar até o "Gerar novo". */
export const TETO_DE_MATRICULAS_ERRADAS_POR_NOME = 5
/** Hashes que rodaram sem criar pedido numa turma, na janela, antes de o hash da turma ir rebaixado. */
export const TETO_DE_HASHES_SEM_PEDIDO_POR_TURMA = 150
/** A espera da busca pelo código na escola acima do teto: atrasa o atacante, e o código certo continua entrando. */
export const ESPERA_ACIMA_DO_TETO_DA_ESCOLA_MS = 1_000

/** Os prefixos das chaves no Redis de fila: o resto da chave é o HMAC do identificador, nunca ele em texto. */
export const PREFIXO_CODIGO_ERRADO_POR_ESCOLA = 'sala:codigo-escola'
export const PREFIXO_MATRICULA_ERRADA_POR_NOME = 'sala:matricula-nome'
export const PREFIXO_HASH_SEM_PEDIDO_POR_TURMA = 'sala:hash-turma'
/** A marca de que a linha `sala.limite_atingido` daquela escola e daquele tipo já saiu nesta janela. */
export const PREFIXO_AVISO_DO_LIMITE = 'sala:aviso-limite'

/**
 * O evento da linha de log que um limite da sala escreve, uma por escola, tipo e janela. O `escolaId` dela é o que o
 * runbook ("Código da turma errado em massa numa escola") manda passar ao `ops:revogar-acessos-sala --escola` (9.0). A
 * chamada do log escreve o evento em texto literal, que a guarda do lint exige; o L11 (`infra/test/alertas.test.ts`)
 * confere que a linha escrita traz este valor.
 */
export const EVENTO_DO_LIMITE_DA_SALA = 'sala.limite_atingido'

const loggerDaSala = new Logger('sala')

/** O aviso espaçado do contador da sala contando no seguro em memória (Redis de fila fora). */
export const avisarSeguroDaSala = (): void => loggerDaSala.warn('sala.limite_no_seguro')

export type TipoDeLimiteDaSala = 'escola' | 'nome' | 'turma'
export const TIPOS_DE_LIMITE_DA_SALA: readonly TipoDeLimiteDaSala[] = ['escola', 'nome', 'turma']

/** O nome escolhido pelo acesso achado: é o que prende o contador do nome ao acesso e à linha da lista. */
export interface NomePeloAcesso {
  readonly acessoId: string
  readonly listaNomeId: string
}

/** O que os contadores dizem antes do hash de uma reivindicação. */
export interface AntesDoHash {
  /** Se a turma passou do teto de hashes sem pedido: o hash vai para o fim do balde da escola. */
  readonly rebaixado: boolean
}

export interface DependenciasDosLimites {
  /** O contador da sala, com a janela de 10 min, no Redis de fila (o mesmo cliente e a mesma chave de HMAC do login). */
  readonly janela: Pick<ContadorEmJanela, 'chaveDe' | 'ler' | 'somar' | 'restanteMs' | 'proporcaoDoSeguro'>
  /** Quantas instâncias da API dividem os tetos quando a contagem é do seguro em memória (`LIMITE_INSTANCIAS_API`). */
  readonly instancias: number
  readonly medidor: Meter
  /** O logger JSON do processo: a linha leva o `tipo` e o `escolaId`, que o `Logger` do Nest não carrega. */
  readonly logger: Pick<LoggerBase, 'warn'>
  /** Só o teste troca, para contar a espera sem dormir. */
  readonly esperar?: (ms: number) => Promise<void>
}

const dormir = (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms))

/**
 * Os limites da página pública da sala (A1, tarefa 7.0; Tech Spec da A1, seções 5 e 7c; regra 80, itens 1 e 3). Nenhum
 * é por IP nem por navegador: 35 alunos atrás do mesmo IP da escola nunca recebem 429 por aqui. Três contadores, numa
 * janela de 10 min, no `ContadorEmJanela` da sala, cada chave o HMAC do identificador:
 *
 * | Conta | Teto | Acima dele |
 * |---|---|---|
 * | código errado, pela escola do slug | 1.000 | a busca pelo código espera 1 s antes de ir ao banco, sem conexão presa; o certo entra |
 * | matrícula errada em nome livre, por acesso e nome (somada antes do hash) | 5 | `LIMITE_EXCEDIDO` com `Retry-After` só àquele nome, até o "Gerar novo" |
 * | hash sem pedido criado, pela turma | 150 | o hash vai rebaixado no balde da escola; nunca recusa |
 *
 * "Acima" é a partir do teto: o 1.001º código, a 6ª matrícula e o 151º hash já são segurados. Com o Redis de fila fora,
 * o seguro em memória conta, e o teto cai para o dividido pelas instâncias (`insuranceLimit`).
 *
 * Cada vez que um limite segura um pedido soma em `sala.limite_atingido{tipo}`, sem escola, e a primeira de cada escola,
 * tipo e janela escreve a linha `sala.limite_atingido` com o `tipo` e o `escolaId` (a marca é mais uma chave do mesmo
 * contador, e vale para todas as instâncias). Nada de IP, código, matrícula nem nome: o runbook parte do `escolaId`.
 */
export class LimitesDaSala implements GuardaDoCodigo {
  readonly #limitesAtingidos: ReturnType<Meter['createCounter']>
  readonly #esperar: (ms: number) => Promise<void>
  #esperandoOCodigo = 0

  constructor(private readonly dependencias: DependenciasDosLimites) {
    this.#esperar = dependencias.esperar ?? dormir
    this.#limitesAtingidos = dependencias.medidor.createCounter(METRICS.limiteDaSala, { description: 'Pedidos da página da sala segurados por um limite, por tipo' })
    // As séries nascem em 0 no boot: a taxa do alerta de código errado em massa (9.0) conta o primeiro.
    for (const tipo of TIPOS_DE_LIMITE_DA_SALA) this.#limitesAtingidos.add(0, { tipo })
  }

  /** Das contagens dos últimos 30 s, a proporção que o seguro em memória atendeu (`limite.seguro_ativo`). */
  get proporcaoDoSeguro(): number {
    return this.dependencias.janela.proporcaoDoSeguro
  }

  /**
   * Quantas buscas pelo código estão na espera de 1 s agora, nesta instância. Só o teste do L3 lê (as 50 esperas sem
   * conexão presa). Não vira gauge (9.0): cada pedido que entra na espera já soma em `sala.limite_atingido{tipo="escola"}`,
   * que é o que o alerta de código errado em massa lê, e a resposta do runbook é revogar, não olhar o acúmulo.
   */
  get esperandoOCodigo(): number {
    return this.#esperandoOCodigo
  }

  async antesDaBusca(escolaId: string): Promise<void> {
    if (!(await this.#noTeto(this.chaveDaEscola(escolaId), TETO_DE_CODIGOS_ERRADOS_POR_ESCOLA))) return
    await this.#atingido('escola', escolaId)
    this.#esperandoOCodigo++
    try {
      await this.#esperar(ESPERA_ACIMA_DO_TETO_DA_ESCOLA_MS)
    } finally {
      this.#esperandoOCodigo--
    }
  }

  async codigoErrado(escolaId: string): Promise<void> {
    await this.dependencias.janela.somar(this.chaveDaEscola(escolaId))
  }

  /**
   * Antes do hash da reivindicação, no contexto da escola do acesso. A matrícula errada num nome livre (`matriculaErrada`,
   * que o serviço leu no banco) soma no contador do nome **antes** do hash, numa operação atômica, e é segurada se a soma
   * passa do teto: dez erradas ao mesmo tempo no mesmo nome dão cinco recusas e cinco `LIMITE_EXCEDIDO`, e não dez hashes
   * (regra 80, item 7). As outras só leem: com o nome no teto, também a matrícula certa sai com `LIMITE_EXCEDIDO`. As duas
   * com o `Retry-After` do resto da janela, sem hash e sem gravar. A turma no teto manda o hash rebaixado.
   */
  async antesDoHash(nome: NomePeloAcesso, turmaId: string, escolaId: string, matriculaErrada: boolean): Promise<AntesDoHash> {
    const { janela, instancias } = this.dependencias
    const chaveDoNome = this.chaveDoNome(nome)
    const [doNome, daTurma] = await Promise.all([matriculaErrada ? janela.somar(chaveDoNome) : janela.ler(chaveDoNome), janela.ler(this.chaveDaTurma(turmaId))])
    const efetivo = (teto: number, doSeguro: boolean) => (doSeguro ? insuranceLimit(teto, instancias) : teto)
    // A soma já conta esta tentativa: ela passa enquanto não exceder o teto. A leitura conta só as anteriores.
    const anteriores = matriculaErrada ? doNome.valor - 1 : doNome.valor
    if (anteriores >= efetivo(TETO_DE_MATRICULAS_ERRADAS_POR_NOME, doNome.doSeguro)) {
      await this.#atingido('nome', escolaId)
      throw new DomainException(ErrorCode.LIMITE_EXCEDIDO, undefined, retryAfterSeconds(await janela.restanteMs(chaveDoNome)))
    }
    const rebaixado = daTurma.valor >= efetivo(TETO_DE_HASHES_SEM_PEDIDO_POR_TURMA, daTurma.doSeguro)
    if (rebaixado) await this.#atingido('turma', escolaId)
    return { rebaixado }
  }

  /**
   * Se o nome teve matrícula errada pelo mesmo acesso nesta janela: o `teve_matricula_errada` do pedido, lido depois do
   * hash, logo antes da transação. As erradas que chegaram junto com a certa já somaram antes do hash delas.
   */
  async teveMatriculaErrada(nome: NomePeloAcesso): Promise<boolean> {
    return (await this.dependencias.janela.ler(this.chaveDoNome(nome))).valor > 0
  }

  /** O hash rodou e nenhum pedido foi criado (a recusa): conta no teto da turma. */
  async hashSemPedido(turmaId: string): Promise<void> {
    await this.dependencias.janela.somar(this.chaveDaTurma(turmaId))
  }

  async #noTeto(chave: string, teto: number): Promise<boolean> {
    const { valor, doSeguro } = await this.dependencias.janela.ler(chave)
    return valor >= (doSeguro ? insuranceLimit(teto, this.dependencias.instancias) : teto)
  }

  async #atingido(tipo: TipoDeLimiteDaSala, escolaId: string): Promise<void> {
    this.#limitesAtingidos.add(1, { tipo })
    const { janela, logger } = this.dependencias
    const { valor } = await janela.somar(janela.chaveDe(PREFIXO_AVISO_DO_LIMITE, `${tipo}|${escolaId}`))
    // O texto do evento é o de `EVENTO_DO_LIMITE_DA_SALA`, que o runbook e o L11 usam: troque os dois juntos.
    if (valor === 1) logger.warn({ evento: 'sala.limite_atingido', tipo, escolaId })
  }

  /** A chave de cada contador (o teste também a usa para ler o Redis): o prefixo e o HMAC do identificador. */
  chaveDaEscola(escolaId: string): string {
    return this.dependencias.janela.chaveDe(PREFIXO_CODIGO_ERRADO_POR_ESCOLA, escolaId)
  }

  chaveDoNome({ acessoId, listaNomeId }: NomePeloAcesso): string {
    return this.dependencias.janela.chaveDe(PREFIXO_MATRICULA_ERRADA_POR_NOME, `${acessoId}|${listaNomeId}`)
  }

  chaveDaTurma(turmaId: string): string {
    return this.dependencias.janela.chaveDe(PREFIXO_HASH_SEM_PEDIDO_POR_TURMA, turmaId)
  }
}
