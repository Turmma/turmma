import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { hashDoTokenDeConvite, sortearTokenDeConvite } from '../../apps/api/src/operacao/token-do-convite.ts'
import { lerAmbienteDeTeste, urlDoBancoDeTeste, valorObrigatorio } from '../../tools/ci/compose.ts'
import { codigoDoAutenticador } from './seed.ts'

/**
 * O operador Turmma do e2e (A0), com senha e segundo fator ativos, pronto para entrar pela tela de `/operacao/entrar`.
 *
 * Nasce como o `ops:operador criar` o faria (a linha e o convite no banco, o token só aqui) e passa pelas rotas de
 * verdade da API: aceitar o convite com a senha, configurar o segundo fator e ativá-lo com o primeiro código. As telas
 * do convite e do configurar têm o spec delas (`operacao-convite.spec.ts`); aqui elas são só o caminho até o operador
 * que entra.
 *
 * Tudo sintético: apelido e nome inventados, e-mail no domínio reservado `.invalid` (regra 20, item 17).
 */
export interface OperadorDeTeste {
  readonly operadorId: string
  readonly apelido: string
  readonly nome: string
  readonly email: string
  readonly senha: string
  /** O segredo em base32, que faz aqui o papel do aplicativo autenticador. */
  readonly segredo: string
}

/** Um passo do TOTP à frente: a ativação gravou o passo de agora, e só um passo maior entra depois. */
export const PASSO_SEGUINTE_SEGUNDOS = 30

const urlDaWeb = () => `http://127.0.0.1:${valorObrigatorio(lerAmbienteDeTeste(), 'WEB_PORTA_HOST')}`

async function comBanco<T>(tarefa: (banco: Client) => Promise<T>): Promise<T> {
  const banco = new Client({ connectionString: urlDoBancoDeTeste() })
  await banco.connect()
  try {
    return await tarefa(banco)
  } finally {
    await banco.end()
  }
}

/** Uma chamada às rotas de entrada da operação, pela mesma borda que o navegador usa. Falha alta se não for 2xx. */
async function pedirNaApi<T>(caminho: string, corpo: unknown, cookie?: string): Promise<{ corpo: T; cookies: string[] }> {
  const resposta = await fetch(`${urlDaWeb()}${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie === undefined ? {} : { Cookie: cookie }) },
    body: JSON.stringify(corpo),
  })
  if (!resposta.ok) throw new Error(`o seed do operador falhou em ${caminho}: ${String(resposta.status)}`)
  const texto = await resposta.text()
  return { corpo: (texto === '' ? undefined : JSON.parse(texto)) as T, cookies: resposta.headers.getSetCookie() }
}

/** O operador que acabou de ser criado pelo comando: a linha e o convite, sem senha nem segundo fator. */
export interface OperadorConvidado {
  readonly operadorId: string
  readonly apelido: string
  readonly nome: string
  readonly email: string
  /** O token do link, que o `ops:operador` escreve no arquivo 0600 e que a pessoa recebe no `#` do endereço. */
  readonly token: string
}

/** O convite como o comando o deixou, ou num dos três estados em que ele não vale mais (C9). */
export type EstadoDoConviteDeTeste = 'pendente' | 'usado' | 'vencido' | 'revogado'

/**
 * O operador como o `ops:operador criar` o deixa: a linha com apelido, nome e e-mail, e um convite de 72 h cujo banco
 * guarda só o hash do token, pelo `hashDoTokenDeConvite` do comando. Os outros estados são o mesmo convite depois de usado, vencido ou revogado.
 */
export async function criarOperadorConvidado(estado: EstadoDoConviteDeTeste = 'pendente'): Promise<OperadorConvidado> {
  const marca = randomUUID().replaceAll('-', '').slice(0, 12)
  const apelido = `e2e-${marca}`
  const nome = `Operadora sintética ${marca.slice(0, 6)}`
  const email = `${apelido}@turmma.invalid`
  // O token e o hash pelas mesmas peças do `ops:operador` e do aceite: um hash repetido aqui passaria a divergir calado.
  const token = sortearTokenDeConvite()
  const expira = estado === 'vencido' ? "now() - interval '1 minute'" : "now() + interval '72 hours'"
  const usado = estado === 'usado' ? 'now()' : 'null'
  const revogado = estado === 'revogado' ? 'now()' : 'null'

  const operadorId = await comBanco(async (banco) => {
    const { rows } = await banco.query<{ id: string }>('insert into operador (apelido, nome, email) values ($1, $2, $3) returning id', [apelido, nome, email])
    const id = rows[0]?.id
    if (id === undefined) throw new Error('o seed do e2e não criou o operador')
    await banco.query(`insert into convite_operador (operador_id, token_hash, expira_em, usado_em, revogado_em) values ($1, $2, ${expira}, ${usado}, ${revogado})`, [
      id,
      hashDoTokenDeConvite(token),
    ])
    return id
  })
  return { operadorId, apelido, nome, email, token }
}

export async function criarOperadorComSegundoFator(): Promise<OperadorDeTeste> {
  const marca = randomUUID().replaceAll('-', '').slice(0, 12)
  const apelido = `e2e-${marca}`
  const nome = `Operadora sintética ${marca.slice(0, 6)}`
  const email = `${apelido}@turmma.invalid`
  const senha = `senha-sintetica-de-operador-${marca}`
  // O token e o hash pelas mesmas peças do `ops:operador` e do aceite.
  const token = sortearTokenDeConvite()

  const operadorId = await comBanco(async (banco) => {
    const { rows } = await banco.query<{ id: string }>('insert into operador (apelido, nome, email) values ($1, $2, $3) returning id', [apelido, nome, email])
    const id = rows[0]?.id
    if (id === undefined) throw new Error('o seed do e2e não criou o operador')
    await banco.query("insert into convite_operador (operador_id, token_hash, expira_em) values ($1, $2, now() + interval '72 hours')", [
      id,
      hashDoTokenDeConvite(token),
    ])
    return id
  })

  const aceite = await pedirNaApi<{ desafio: string }>('/v1/operacao/convite/aceitar', { token, senha })
  const configurado = await pedirNaApi<{ segredo: string; desafio: string }>('/v1/operacao/sessao/mfa/configurar', { desafio: aceite.corpo.desafio })
  const ativacao = await pedirNaApi<unknown>('/v1/operacao/sessao/mfa', { desafio: configurado.corpo.desafio, codigo: codigoDoAutenticador(configurado.corpo.segredo) })
  // A sessão que a ativação abriu não é a do teste: sai, pelo cookie que ela devolveu.
  const cookie = ativacao.cookies.map((valor) => valor.split(';')[0]).join('; ')
  await pedirNaApi<unknown>('/v1/operacao/sessao/sair', {}, cookie)

  return { operadorId, apelido, nome, email, senha, segredo: configurado.corpo.segredo }
}

/**
 * Apaga o operador do e2e e tudo que aponta para ele, como a bancada dos testes de integração: o compose de teste é o
 * mesmo das duas suítes, e um operador ativo que sobrasse daqui mudaria o bootstrap dos `ops:*` que elas testam (sem
 * operador ativo, o comando aceita o `OPERADOR` do ambiente).
 */
export async function removerOperador(operadorId: string): Promise<void> {
  await comBanco(async (banco) => {
    await banco.query('delete from auditoria_operacao where operador_alvo_id = $1', [operadorId])
    await banco.query('delete from acesso_operacao where operador_id = $1', [operadorId])
    await banco.query('delete from sessao_operador where operador_id = $1', [operadorId])
    await banco.query('delete from convite_operador where operador_id = $1', [operadorId])
    await banco.query('delete from codigo_recuperacao_operador where operador_id = $1', [operadorId])
    await banco.query('delete from operador where id = $1', [operadorId])
  })
}

/** Encerra as sessões abertas do operador, como a saída de outra máquina ou o `desativar`: a próxima requisição da aba já não vale. */
export async function encerrarSessoesDoOperador(operadorId: string): Promise<void> {
  await comBanco(async (banco) => {
    await banco.query("update sessao_operador set encerrada_em = now(), motivo = 'saida' where operador_id = $1 and encerrada_em is null", [operadorId])
  })
}

/** O código do aplicativo para a entrada pela tela, um passo depois do que ativou o segundo fator. */
export function codigoDoOperador(operador: OperadorDeTeste): string {
  return codigoDoAutenticador(operador.segredo, PASSO_SEGUINTE_SEGUNDOS)
}
