import { AuditoriaRecorder, DomainException, insuranceLimit, METRICS, requestSessao, requireEscolaId, ROTULO_ESCOLA, type Database, type Meter } from '@educa/core'
import { CicloDeVidaRepository } from '@educa/core/ciclo-de-vida'
import {
  alcanceDe,
  ALFABETO_DA_SENHA_PROVISORIA,
  alvoDaSenhaProvisoriaResponseSchema,
  ErrorCode,
  FINALIDADE_DA_LEITURA_DO_ALVO,
  formatarSenhaProvisoria,
  LIMITE_DE_PROVISORIAS_POR_DIA_E_ALUNO,
  LIMITE_DE_PROVISORIAS_POR_HORA_E_USUARIO,
  senhaProvisoriaResponseSchema,
  TAMANHO_DA_SENHA_PROVISORIA,
  type AlvoDaSenhaProvisoriaResponse,
  type PapelQueGeraASenhaProvisoria,
  type SenhaProvisoriaResponse,
} from '@educa/shared'
import { randomInt } from 'node:crypto'
import { CredencialMatriculaRepository, type AlcanceDaProvisoria } from './credencial-matricula.repository.js'
import type { PasswordHasher } from './password-hasher.js'
import type { HashBulkhead } from './senha/hash-bulkhead.js'
import { escolaBucket } from './senha/login-buckets.js'
import type { WindowCounter } from './senha/window-counter.js'

const registro = new AuditoriaRecorder()

/** O balde por quem gera, 60 por hora, pelo HMAC do id do usuário. */
export const PREFIXO_DAS_PROVISORIAS_POR_USUARIO = 'rl:provisoria:usuario'
/** O balde por aluno, 5 por dia, pelo HMAC do id do aluno. */
export const PREFIXO_DAS_PROVISORIAS_POR_ALUNO = 'rl:provisoria:aluno'

/** Quem, na matriz, gera a senha provisória, e o papel que a auditoria guarda: a coordenação (toda a escola) ou o professor (a turma vinculada). */
const PAPEL_DO_ALCANCE: Readonly<Record<AlcanceDaProvisoria, PapelQueGeraASenhaProvisoria>> = { unidade: 'coordenador', turma_vinculada: 'professor' }

export interface SenhaProvisoriaDependencies {
  readonly banco: Database
  readonly hash: Pick<PasswordHasher, 'gerar'>
  /** O semáforo do argon2, o mesmo do login: o hash da provisória espera a vez no balde da escola. */
  readonly semaforo: Pick<HashBulkhead, 'executar'>
  /** A janela de uma hora, a da cota por quem gera. */
  readonly porHora: Pick<WindowCounter, 'chaveDe' | 'somar' | 'restanteMs'>
  /** A janela de um dia, a da cota por aluno. */
  readonly porDia: Pick<WindowCounter, 'chaveDe' | 'somar' | 'restanteMs'>
  /** Quantas instâncias da API dividem o limite quando a contagem é do seguro em memória. */
  readonly instancias: number
  readonly medidor: Meter
  /** Só o teste troca, para provar os caracteres sem depender do sorteio. */
  readonly sortear?: (maximo: number) => number
}

/**
 * Os `TAMANHO_DA_SENHA_PROVISORIA` caracteres sorteados do alfabeto sem confusão, sem viés (o `randomInt` do Node recusa o resto da divisão): é a senha
 * que a tela mostra, em claro, uma vez. Nunca vai a log, a auditoria nem a banco.
 */
export function sortearSenhaProvisoria(sortear: (maximo: number) => number = randomInt): string {
  let senha = ''
  for (let i = 0; i < TAMANHO_DA_SENHA_PROVISORIA; i++) senha += ALFABETO_DA_SENHA_PROVISORIA.charAt(sortear(ALFABETO_DA_SENHA_PROVISORIA.length))
  return senha
}

const naoEncontrado = () => new DomainException(ErrorCode.NAO_ENCONTRADO)

/**
 * A senha provisória do aluno (`POST /v1/usuarios/:usuarioId/senha-provisoria`; acesso-e-convites, tarefa 9.0, RF13; Tech Spec, seção 5, "Senha provisória"). A coordenação, ou o
 * professor com vínculo `confirmado` na turma do aluno, gera uma senha de 24 horas, mostrada uma vez, que derruba a senha e as sessões do aluno. Em três tempos, e o hash nunca espera com
 * conexão do pool nem com a linha do aluno travada (regra 80, item 5: o semáforo do login às 7h30 está cheio, e a leitura de sessão do login espera o pool):
 *
 * 1. **Conferência sem trava e sem cota** (`#conferir`): quem não alcança o aluno (inexistente, de outra escola, professor ou coordenador, pedido pendente, desativado, vínculo do professor que
 *    não é confirmado, aluno transferido para outra turma, escola sem ano em curso para o professor) recebe o `NAO_ENCONTRADO` de quem não existe. Depois, a conta da escola ligada:
 *    `ENTRA_PELA_CONTA_DA_ESCOLA` (409), só a quem alcança o aluno, para o código não revelar a conta, e a senha dele não muda. Depois, o `CONFLITO`: provisória não usada gerada há menos de 10 s, de
 *    qualquer autor. Nenhum dos três gasta cota nem ocupa o semáforo.
 * 2. **Sorteia a senha e faz o hash pelo semáforo do argon2**, fora de transação. O 503 do semáforo sai daqui, antes de qualquer cota.
 * 3. **Transação curta:** trava a linha do usuário do aluno (a mesma do "ligar" a conta da escola e da aprovação: a geração e a ligação do mesmo aluno se serializam), **confere tudo de novo** (a
 *    corrida: dois "gerar" passam pelo tempo 1 juntos, e quem espera a trava vê a provisória do outro e responde `CONFLITO`), só então **gasta as cotas** (60 por hora por quem gera e 5 por dia por aluno,
 *    `LIMITE_EXCEDIDO`, 429, com `Retry-After`), grava no lugar da senha, encerra as sessões do aluno e registra `senha_provisoria.gerada` com o papel de quem gerou. As cotas contam depois
 *    do escopo, do `CONFLITO` e do hash: quem não alcança o aluno, o conflito e o 503 não gastam ponto, e um 429 custa um hash.
 *
 * A senha só existe na resposta (`no-store`, no controller); o banco guarda o hash, e nada daqui vai a log.
 */
export class SenhaProvisoriaService {
  readonly #geradas: ReturnType<Meter['createCounter']>
  readonly #sortear: (maximo: number) => number

  constructor(private readonly dependencias: SenhaProvisoriaDependencies) {
    this.#geradas = dependencias.medidor.createCounter(METRICS.senhaProvisoriaGerada, { description: 'Senhas provisórias de aluno geradas, por escola' })
    this.#sortear = dependencias.sortear ?? randomInt
  }

  /**
   * `GET /v1/usuarios/:usuarioId/senha-provisoria` (tarefa 17.0, divergência da 12.0; Tech Spec, seção 5, "O alvo da provisória"): o aluno que a confirmação mostra antes de gerar, pelo
   * mesmo escopo da geração e sem trava, sem cota e sem semáforo. Quem não o alcança, e o aluno sem credencial nem conta da escola, recebe o `NAO_ENCONTRADO` do inexistente. A coordenação
   * (`unidade`) grava `senha_provisoria.alvo_lido` na mesma transação da leitura (regra 20, item 10): sem registro, sem leitura; o professor com vínculo na turma do aluno não grava.
   * O registro leva o aluno como alvo e a finalidade fixa, nunca o nome nem a matrícula.
   */
  async lerAlvo(alunoId: string): Promise<AlvoDaSenhaProvisoriaResponse> {
    const alcance = alcanceDaGeracao(requestSessao().papel)
    const alvo = await this.dependencias.banco.transaction(async (tx) => {
      const achado = await new CredencialMatriculaRepository(tx).lerAlvo(alunoId, alcance)
      if (achado === undefined) throw naoEncontrado()
      if (alcance === 'unidade') await registro.gravar(tx, 'senha_provisoria.alvo_lido', { entidadeId: alunoId, finalidade: FINALIDADE_DA_LEITURA_DO_ALVO })
      return achado
    })
    return alvoDaSenhaProvisoriaResponseSchema.parse(alvo)
  }

  async gerar(alunoId: string): Promise<SenhaProvisoriaResponse> {
    const { banco, hash, semaforo } = this.dependencias
    const escolaId = requireEscolaId()
    const { usuarioId: quemGera, papel } = requestSessao()
    const alcance = alcanceDaGeracao(papel)
    await this.#conferir(new CredencialMatriculaRepository(banco), alunoId, alcance, false)
    const senha = sortearSenhaProvisoria(this.#sortear)
    const senhaHash = await semaforo.executar(escolaBucket(escolaId), () => hash.gerar(senha))
    const resposta = await banco.transaction(async (tx) => {
      const credenciais = new CredencialMatriculaRepository(tx)
      await this.#conferir(credenciais, alunoId, alcance, true)
      await this.#gastarAsCotas(quemGera, alunoId)
      const gravada = await credenciais.gravarProvisoria(alunoId, senhaHash, quemGera)
      if (gravada === undefined) throw naoEncontrado()
      await new CicloDeVidaRepository(tx).encerrarSessoesDoUsuario(alunoId, 'senha_redefinida')
      await registro.gravar(tx, 'senha_provisoria.gerada', { entidadeId: alunoId, depois: { papel: PAPEL_DO_ALCANCE[alcance] } })
      return senhaProvisoriaResponseSchema.parse({ senha: formatarSenhaProvisoria(senha), expiraEm: gravada.expiraEm.toISOString() })
    })
    this.#geradas.add(1, { [ROTULO_ESCOLA]: escolaId })
    return resposta
  }

  /**
   * As três conferências, na ordem em que uma esconde a outra: o escopo (404 igual ao inexistente), a conta ligada (409) e o `CONFLITO` (409). `travar` é a conferência da transação curta,
   * com a linha do usuário travada; sem ele, a primeira, que não segura nada.
   */
  async #conferir(credenciais: CredencialMatriculaRepository, alunoId: string, alcance: AlcanceDaProvisoria, travar: boolean): Promise<void> {
    const alcancou = travar ? await credenciais.travarAlunoParaProvisoria(alunoId, alcance) : await credenciais.alcancaAluno(alunoId, alcance)
    if (!alcancou) throw naoEncontrado()
    const estado = await credenciais.estadoDaProvisoria(alunoId)
    if (estado.contaLigada) throw new DomainException(ErrorCode.ENTRA_PELA_CONTA_DA_ESCOLA)
    if (!estado.temCredencial) throw naoEncontrado()
    if (estado.recente) throw new DomainException(ErrorCode.CONFLITO)
  }

  /** Soma um nas duas cotas, a de quem gera primeiro: acima de uma delas, `LIMITE_EXCEDIDO` com o tempo que falta, e a segunda nem é gasta. */
  async #gastarAsCotas(quemGera: string, alunoId: string): Promise<void> {
    const { porHora, porDia, instancias } = this.dependencias
    for (const [janela, prefixo, identificador, limite] of [
      [porHora, PREFIXO_DAS_PROVISORIAS_POR_USUARIO, quemGera, LIMITE_DE_PROVISORIAS_POR_HORA_E_USUARIO],
      [porDia, PREFIXO_DAS_PROVISORIAS_POR_ALUNO, alunoId, LIMITE_DE_PROVISORIAS_POR_DIA_E_ALUNO],
    ] as const) {
      const chave = janela.chaveDe(prefixo, identificador)
      const { valor, doSeguro } = await janela.somar(chave)
      if (valor > (doSeguro ? insuranceLimit(limite, instancias) : limite)) {
        throw new DomainException(ErrorCode.LIMITE_EXCEDIDO, undefined, Math.max(1, Math.ceil((await janela.restanteMs(chave)) / 1_000)))
      }
    }
  }
}

/** O alcance da célula `senha_provisoria.gerar` do papel da sessão; qualquer outro, que a guarda de permissão já barrou, responde como inexistente. */
function alcanceDaGeracao(papel: string): AlcanceDaProvisoria {
  const alcance = alcanceDe(papel, 'senha_provisoria', 'gerar')
  if (alcance === 'unidade' || alcance === 'turma_vinculada') return alcance
  throw naoEncontrado()
}
