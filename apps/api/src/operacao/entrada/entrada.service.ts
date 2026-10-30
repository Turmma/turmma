import { ErroDeDominio, type Banco } from '@educa/nucleo'
import { ErrorCode, type EntradaDeOperadorRequest, type EntradaDeOperadorResponse } from '@educa/shared'
import { baldeDaEquipe, type ContadorDeTentativas, type CookieDeDispositivo, type HashDeSenha, ipParaRegistro, lerCookie, normalizarEmail, type PrefixoDoContador, type SemaforoDeHash } from '../../credencial/index.js'
import type { EmissorDeDesafioDeOperador, EtapaDoDesafioDeOperador } from '../desafio-de-operador.js'
import { COOKIE_DISPOSITIVO_DE_OPERADOR } from '../dispositivo-de-operador.js'
import type { FalhasDeEntradaDaOperacao } from '../falhas-de-entrada.js'
import { OperadorRepository, type CredencialDeEntrada } from '../operador/operador.repository.js'

/** O prefixo do contador de tentativas do operador: separado do `login` da escola (C24). */
export const PREFIXO_DO_CONTADOR_DA_OPERACAO: PrefixoDoContador = 'login-op'

export interface DependenciasDaEntrada {
  readonly banco: Banco
  /** O semáforo do hash do F1, o mesmo do login da escola: o teto é das threads da instância. */
  readonly semaforo: Pick<SemaforoDeHash, 'executar'>
  /** O contador do F1, com o prefixo `login-op`: uma instância só, e o seguro em memória dela vale para os dois. */
  readonly contador: Pick<ContadorDeTentativas, 'chaveDe' | 'reservar' | 'zerar'>
  readonly hash: Pick<HashDeSenha, 'verificar'>
  /** O cookie de dispositivo do operador, com a chave própria (`dispositivo-de-operador.ts`). */
  readonly dispositivo: Pick<CookieDeDispositivo, 'conhece'>
  readonly emissorDeDesafio: Pick<EmissorDeDesafioDeOperador, 'emitir'>
  /** A série `operacao.entrada_falha`, a mesma do `/sessao/mfa`. */
  readonly falhas: Pick<FalhasDeEntradaDaOperacao, 'somar'>
}

/** O que o controller tira da requisição: o IP, o cabeçalho `Cookie` e se o IP passou do limite das rotas de senha. */
export interface OrigemDaEntrada {
  readonly ip: string
  readonly cabecalhoCookie: string | undefined
  readonly acimaDoLimiteDoIp: boolean
}

/**
 * A etapa que a senha certa abre (Tech Spec da A0, seção 5, "Etapas"): `mfa` com o segundo fator ativo;
 * `configurar_mfa` sem ele, só se o convite foi aceito há menos de 72 h; fora disso, nenhuma, e a entrada responde
 * igual à senha errada.
 */
export function etapaDaEntrada(credencial: Pick<CredencialDeEntrada, 'mfaAtivo' | 'aceiteRecente'>): EtapaDoDesafioDeOperador | undefined {
  if (credencial.mfaAtivo) return 'mfa'
  return credencial.aceiteRecente ? 'configurar_mfa' : undefined
}

/**
 * `POST /v1/operacao/sessao/email` (Tech Spec da A0, seções 4 e 5): o operador informa e-mail e senha e recebe o
 * desafio da etapa seguinte, sem sessão e sem cookie.
 *
 * - **Respostas iguais:** e-mail que não existe, operador desativado, senha errada e senha certa fora das 72 h sem
 *   segundo fator levam um hash cada, contam no contador do e-mail e respondem `NAO_AUTENTICADO`: nem o corpo, nem o
 *   status, nem o bloqueio dizem se a conta existe.
 * - **Contador por conta, nunca por IP** (regra 80, item 1): `login-op:{HMAC(e-mail)}:{conhecido|outro}`, reservado
 *   antes do hash, dentro da vez no semáforo. A origem `conhecido` vem do cookie de dispositivo do operador. Segurada,
 *   a conta responde 429 `CONTA_SEGURADA` com `Retry-After`, sem ler a credencial nem fazer o hash. O contador por
 *   `operador.id` é o do segundo fator (tarefa 7.0, C34), que não passa por aqui.
 * - **Limite por IP que rebaixa** (`@LimiteQueRebaixa`): acima dele, a tentativa vai para o fim do balde da equipe no
 *   semáforo, nunca 429; quem traz o cookie de dispositivo daquela conta mantém a vez.
 * - **Registro:** a falha que passou pelo hash grava `entrada_falha` em `acesso_operacao`, com IP e data, sem o e-mail
 *   e sem operador; a tentativa com a conta já segurada não grava (o hash é o que freia o ritmo das gravações). Toda
 *   falha soma em `operacao.entrada_falha`. A entrada que dá certo só é registrada quando abre a sessão, no `/sessao/mfa`.
 * - **Semáforo:** a vez é a do balde `equipe`, e por isso a espera do operador soma em `login.hash_espera{equipe}` com a
 *   da equipe das escolas; o volume da nossa equipe não muda a leitura dessa série.
 *
 * Não usa a `ConferenciaNaVez` do F1 porque ela soma em `login.falhas` e `login.conta_segurada`, as séries das escolas:
 * a falha do operador ficaria contada como falha da equipe de uma escola no painel.
 */
export class EntradaDoOperadorService {
  constructor(private readonly dependencias: DependenciasDaEntrada) {}

  async entrar(pedido: EntradaDeOperadorRequest, origem: OrigemDaEntrada): Promise<EntradaDeOperadorResponse> {
    const { banco, semaforo, contador, hash, dispositivo, emissorDeDesafio } = this.dependencias
    const email = normalizarEmail(pedido.email)
    const conhecido = dispositivo.conhece(lerCookie(origem.cabecalhoCookie, COOKIE_DISPOSITIVO_DE_OPERADOR), email)
    const chave = contador.chaveDe(email, conhecido ? 'conhecido' : 'outro', PREFIXO_DO_CONTADOR_DA_OPERACAO)
    const balde = baldeDaEquipe(origem.ip, !conhecido && origem.acimaDoLimiteDoIp)

    // A vez vem antes da tentativa, como no F1: o 503 de quem esperou demais não conta como senha errada.
    const resultado = await semaforo.executar(balde, async () => {
      const reserva = await contador.reservar(chave)
      if (!reserva.liberada) return { seguradaPorMs: reserva.esperaMs }
      const credencial = await new OperadorRepository(banco).credencialDeEntrada(email)
      return { reserva, credencial, confere: await hash.verificar(credencial?.senhaHash, pedido.senha) }
    })
    // A conta segurada responde sem gravar: sem hash, nada a frearia, e cada repetição seria uma escrita no banco das
    // escolas (regra 80, itens 1 e 3). Ela soma só na métrica, como o F1 faz com o `login_falho`.
    if ('seguradaPorMs' in resultado) return this.#falhar(resultado.seguradaPorMs)

    const { reserva, credencial, confere } = resultado
    const etapa = confere && credencial !== undefined ? etapaDaEntrada(credencial) : undefined
    if (credencial === undefined || etapa === undefined) {
      await new OperadorRepository(banco).registrarFalhaDeEntrada(ipParaRegistro(origem.ip))
      return this.#falhar(reserva.esperaSeFalharMs)
    }

    await contador.zerar(chave)
    return { etapa, desafio: await emissorDeDesafio.emitir({ operadorId: credencial.operadorId, etapa }) }
  }

  /** `NAO_AUTENTICADO`, ou `CONTA_SEGURADA` com a espera se a conta está ou ficou segurada; antes, a métrica. */
  #falhar(esperaMs: number): never {
    this.dependencias.falhas.somar()
    if (esperaMs <= 0) throw new ErroDeDominio(ErrorCode.NAO_AUTENTICADO)
    throw new ErroDeDominio(ErrorCode.CONTA_SEGURADA, undefined, Math.max(1, Math.ceil(esperaMs / 1_000)))
  }
}
