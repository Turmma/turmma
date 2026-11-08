import { EMISSOR_TOKEN, iatDoDesafioConfere, systemClock, type Clock } from '@educa/core'
import { VALIDADE_DO_BILHETE_DA_TROCA_MINUTOS } from '@educa/shared'
import { errors, jwtVerify, SignJWT } from 'jose'
import { z } from 'zod'

/**
 * O bilhete da troca da senha provisória (acesso-e-convites, tarefa 10.0, RF13; Tech Spec, seção 5, "Senha provisória"): o JWT que o login de matrícula devolve, no lugar da
 * sessão, quando a senha certa é a provisória. Ele só serve para `trocar-senha` e `trocas`, no `Authorization`, e nunca vai na URL.
 *
 * `typ` e `aud` próprios o separam de tudo o que a API já emite com a mesma chave: a guarda de acesso só aceita `typ: JWT`, as rotas de etapa só `desafio+jwt` com `aud: sessao`, e o
 * bilhete do convite aceito (`convite+jwt`) tem a `aud` do desafio. Cada um dos dois campos, sozinho, já recusa o bilhete alheio (um caso de teste para cada um).
 */
export const TIPO_DO_BILHETE_DA_TROCA = 'troca-senha+jwt'
export const AUDIENCIA_DO_BILHETE_DA_TROCA = 'troca-de-senha'
/** O aluno troca a senha logo depois do login: 10 minutos cobrem o caminho, e o bilhete não vira porta depois. */
export const VALIDADE_DO_BILHETE_DA_TROCA_SEGUNDOS = VALIDADE_DO_BILHETE_DA_TROCA_MINUTOS * 60

/** A hora do vencimento da provisória como o banco a guarda, em UTC e com microssegundos (`to_char(… 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`): a troca a compara por igualdade. */
export const FORMATO_DA_VALIDADE_DA_PROVISORIA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/

/**
 * O que o bilhete leva: a escola, o aluno e o vencimento da provisória, que a identifica sem ser segredo. Nunca hash, senha, matrícula nem nome (regra 20): quem abre o bilhete
 * não sabe nada da pessoa além dos ids.
 */
export interface DadosDoBilheteDaTroca {
  readonly escolaId: string
  readonly usuarioId: string
  readonly provisoriaExpiraEm: string
}

const claimsSchema = z.object({ escola_id: z.uuid(), usuario_id: z.uuid(), provisoria_expira_em: z.string().regex(FORMATO_DA_VALIDADE_DA_PROVISORIA) })

export class BilheteDaTroca {
  constructor(
    private readonly chaveAssinatura: Uint8Array,
    private readonly relogio: Clock = systemClock,
  ) {}

  async emitir(dados: DadosDoBilheteDaTroca): Promise<string> {
    const emitidoEm = Math.floor(this.relogio.agora().getTime() / 1_000)
    return new SignJWT({ escola_id: dados.escolaId, usuario_id: dados.usuarioId, provisoria_expira_em: dados.provisoriaExpiraEm })
      .setProtectedHeader({ alg: 'HS256', typ: TIPO_DO_BILHETE_DA_TROCA })
      .setIssuer(EMISSOR_TOKEN)
      .setAudience(AUDIENCIA_DO_BILHETE_DA_TROCA)
      .setIssuedAt(emitidoEm)
      .setExpirationTime(emitidoEm + VALIDADE_DO_BILHETE_DA_TROCA_SEGUNDOS)
      .sign(this.chaveAssinatura)
  }

  /** O bilhete conferido (assinatura, `typ`, `aud`, prazo e conteúdo), ou `undefined`: quem chama responde `NAO_AUTENTICADO` sem dizer qual parte falhou. */
  async verificar(bilhete: string): Promise<DadosDoBilheteDaTroca | undefined> {
    const agora = this.relogio.agora()
    let claims: unknown
    try {
      const verificado = await jwtVerify(bilhete, this.chaveAssinatura, {
        algorithms: ['HS256'],
        typ: TIPO_DO_BILHETE_DA_TROCA,
        issuer: EMISSOR_TOKEN,
        audience: AUDIENCIA_DO_BILHETE_DA_TROCA,
        requiredClaims: ['exp', 'iat'],
        currentDate: agora,
      })
      // A idade, e não o `maxTokenAge` do `jose`, que recusa o `iat` à frente do relógio sem folga: duas instâncias da API não leem a mesma hora.
      if (!iatDoDesafioConfere(verificado.payload.iat, agora, VALIDADE_DO_BILHETE_DA_TROCA_SEGUNDOS)) return undefined
      claims = verificado.payload
    } catch (erro) {
      if (erro instanceof errors.JOSEError) return undefined
      throw erro
    }
    const resultado = claimsSchema.safeParse(claims)
    if (!resultado.success) return undefined
    return { escolaId: resultado.data.escola_id.toLowerCase(), usuarioId: resultado.data.usuario_id.toLowerCase(), provisoriaExpiraEm: resultado.data.provisoria_expira_em }
  }
}
