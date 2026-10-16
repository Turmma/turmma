import { hash, type Algorithm } from '@node-rs/argon2'
import { createHmac, randomBytes, randomInt, randomUUID } from 'node:crypto'
import { Secret, TOTP } from 'otpauth'
import { Client } from 'pg'
import { BYTES_DO_TOKEN_DE_CONVITE, hashDoToken } from '../../apps/api/src/sessao/hash-do-token.ts'
import type { EstadoDoProfessor } from '../../packages/shared/src/professores/professores.ts'
import { ALFABETO_DO_CODIGO_DA_TURMA, normalizarCodigoDaTurma, TAMANHO_DO_CODIGO_DA_TURMA } from '../../packages/shared/src/sala/acesso.ts'
import { lerAmbienteDeTeste, urlDoBancoDeTeste, valorObrigatorio } from '../../tools/ci/compose.ts'

/**
 * As pessoas do e2e, criadas direto no Postgres do compose de teste, pelos mesmos campos do seed sintético
 * (`ops:sessao-sintetica`, tarefa 2.0): rede, escola, ano letivo em curso, conta da equipe e usuário.
 *
 * Tudo é sintético, com nome inventado e e-mail no domínio reservado `.invalid`, que não recebe mensagem: nenhum
 * dado de pessoa de verdade entra em ambiente de teste (regra 20, item 17). A API não tem rota que crie escola
 * (RF1), e por isso o seed é pelo banco, como nos testes de integração.
 */
export interface EquipeDeTeste {
  readonly escolaId: string
  readonly escolaNome: string
  /** O nome da rede da escola, único por chamada: é o que o seletor de escola mostra embaixo do nome dela (P30). */
  readonly redeNome: string
  /** O endereço da escola, por onde entram o aluno e quem usa a conta da escola (RF7, RF8). */
  readonly slug: string
  /** A conta é global e vale em todas as escolas da pessoa: é por ela que se cria o segundo vínculo. */
  readonly contaId: string
  readonly usuarioId: string
  readonly nome: string
  readonly email: string
  readonly senha: string
}

export interface UsuarioDeTeste {
  readonly escolaId: string
  readonly escolaNome: string
  readonly redeNome: string
  readonly usuarioId: string
}

/** `Algorithm.Argon2id`: o enum do pacote é `const` e ambiente, e não se lê com `isolatedModules`. */
const ARGON2ID = 2 as Algorithm

/** O hash guardado leva os próprios parâmetros, e a API confere com eles: aqui vale o mínimo da OWASP, como no `.env.example`. */
async function hashDaSenha(senha: string): Promise<string> {
  const ambiente = lerAmbienteDeTeste()
  return hash(senha, {
    algorithm: ARGON2ID,
    memoryCost: Number(valorObrigatorio(ambiente, 'LOGIN_ARGON2_MEMORIA_KIB')),
    timeCost: Number(valorObrigatorio(ambiente, 'LOGIN_ARGON2_ITERACOES')),
    parallelism: 1,
  })
}

async function comBanco<T>(tarefa: (banco: Client) => Promise<T>): Promise<T> {
  const banco = new Client({ connectionString: urlDoBancoDeTeste() })
  await banco.connect()
  try {
    return await tarefa(banco)
  } finally {
    await banco.end()
  }
}

async function id(banco: Client, instrucao: string, parametros: unknown[]): Promise<string> {
  const { rows } = await banco.query<{ id: string }>(instrucao, parametros)
  const criado = rows[0]?.id
  if (criado === undefined) throw new Error(`o seed do e2e não criou a linha: ${instrucao}`)
  return criado
}

/**
 * Se a pessoa semeada já viu a introdução do papel dela. Por padrão viu: as telas e os fluxos que não são o da
 * introdução continuam entrando em `/aluno/inicio`, `/professor/…`, e não em `<área>/bem-vindo`. `por_ver` deixa a data
 * nula, que é o usuário recém-criado (telas do aluno e primeiro acesso, tarefa 1.0).
 */
export type Introducao = 'vista' | 'por_ver'

/** O valor SQL da coluna `introducao_vista_em` para a opção; literal fixo, nunca texto vindo de fora. */
const introducaoVistaEm = (introducao: Introducao | undefined): string => (introducao === 'por_ver' ? 'null' : 'now()')

/**
 * Uma escola nova, com ano letivo em curso, e uma pessoa de equipe nela, com senha. É o que a entrada por e-mail
 * precisa (RF6): a conta é global, o usuário é da escola, e a guarda de sessão lê os dois.
 *
 * Cada chamada cria a própria escola, para dois testes em paralelo nunca disputarem a mesma conta.
 */
export async function criarEquipeComSenha(papel: 'professor' | 'coordenador' = 'professor', opcoes: { readonly semAnoLetivo?: boolean; readonly introducao?: Introducao } = {}): Promise<EquipeDeTeste> {
  const marca = randomUUID()
  // Nome de escola e de pessoa únicos: é o que deixa um teste afirmar que a tela não mostra a pessoa do teste ao lado,
  // nem a anterior no mesmo Chromebook.
  const escolaNome = `Colégio sintético ${marca.slice(0, 8)}`
  const redeNome = `Rede sintética do e2e ${marca.slice(0, 8)}`
  const slug = `e2e-${marca}`
  const nome = `${papel === 'professor' ? 'Professora' : 'Coordenadora'} sintética ${marca.slice(0, 8)}`
  const email = `${papel}-${marca}@educa.invalid`
  const senha = `senha-sintetica-${marca}`
  const senhaHash = await hashDaSenha(senha)

  return comBanco(async (banco) => {
    const redeId = await id(banco, "insert into rede (nome, tipo) values ($1, 'independente') returning id", [redeNome])
    const escolaId = await id(banco, 'insert into escola (rede_id, nome, slug) values ($1, $2, $3) returning id', [redeId, escolaNome, slug])
    // Sem ano letivo é a escola como o painel da operação a cria: a coordenação começa por ele (Estrutura, 13.0).
    if (opcoes.semAnoLetivo !== true)
      await banco.query("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2026, '2026-02-01', '2026-12-18', 'em_curso')", [escolaId])
    const contaId = await id(banco, 'insert into conta (email, senha_hash) values ($1, $2) returning id', [email, senhaHash])
    const usuarioId = await id(banco, `insert into usuario (escola_id, conta_id, papel, nome, introducao_vista_em) values ($1, $2, $3, $4, ${introducaoVistaEm(opcoes.introducao)}) returning id`, [escolaId, contaId, papel, nome])
    return { escolaId, escolaNome, redeNome, slug, contaId, usuarioId, nome, email, senha }
  })
}

/**
 * Outra escola, com outro usuário ativo da mesma conta: é assim que nasce a professora de rede pública que dá aula
 * em duas escolas (regra 50, item 13; regra 60, item 8a), e é o que leva o login à etapa `escolher`.
 */
export async function criarUsuarioEmOutraEscola(contaId: string, papel: 'professor' | 'coordenador' = 'professor', opcoes: { readonly introducao?: Introducao } = {}): Promise<UsuarioDeTeste> {
  const marca = randomUUID()
  const escolaNome = `Escola sintética da outra rede ${marca.slice(0, 8)}`
  const redeNome = `Outra rede sintética do e2e ${marca.slice(0, 8)}`

  return comBanco(async (banco) => {
    const redeId = await id(banco, "insert into rede (nome, tipo) values ($1, 'prefeitura') returning id", [redeNome])
    const escolaId = await id(banco, 'insert into escola (rede_id, nome, slug) values ($1, $2, $3) returning id', [redeId, escolaNome, `e2e-outra-${marca}`])
    await banco.query("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2026, '2026-02-01', '2026-12-18', 'em_curso')", [escolaId])
    const usuarioId = await id(banco, `insert into usuario (escola_id, conta_id, papel, nome, introducao_vista_em) values ($1, $2, $3, $4, ${introducaoVistaEm(opcoes.introducao)}) returning id`, [
      escolaId,
      contaId,
      papel,
      'Professora sintética na outra escola',
    ])
    return { escolaId, escolaNome, redeNome, usuarioId }
  })
}

/** Uma escola sintética, com o endereço dela: é o que a tela `/e/:slug` abre. */
export interface EscolaDeTeste {
  readonly escolaId: string
  readonly escolaNome: string
  readonly slug: string
}

/** O aluno do endereço da escola (RF7): matrícula e senha, sem conta e sem e-mail (regra 20, item 2). */
export interface AlunoDeTeste extends EscolaDeTeste {
  readonly usuarioId: string
  readonly nome: string
  readonly matricula: string
  readonly senha: string
}

/** O convite do primeiro coordenador (7.0), como o `ops:convite-coordenador` o cria, mas direto no banco. */
export interface ConviteDeTeste extends EscolaDeTeste {
  /** O token do link, que só existe aqui: o banco guarda o SHA-256 dele. */
  readonly token: string
  readonly usuarioId: string
}

/** Uma escola nova, com rede, ano letivo em curso e endereço próprio. */
export async function criarEscolaSintetica(): Promise<EscolaDeTeste> {
  const marca = randomUUID()
  const escolaNome = `Colégio sintético ${marca.slice(0, 8)}`
  const slug = `e2e-${marca}`
  return comBanco(async (banco) => {
    const redeId = await id(banco, "insert into rede (nome, tipo) values ('Rede sintética do e2e', 'independente') returning id", [])
    const escolaId = await id(banco, 'insert into escola (rede_id, nome, slug) values ($1, $2, $3) returning id', [redeId, escolaNome, slug])
    await banco.query("insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, 2026, '2026-02-01', '2026-12-18', 'em_curso')", [escolaId])
    return { escolaId, escolaNome, slug }
  })
}

/**
 * Um aluno com matrícula e senha na escola dada (ou numa nova). A matrícula pode repetir entre escolas de propósito:
 * é com isso que o teste de isolamento prova que a senha de uma não abre a outra (RF7, regra 60, item 6).
 */
export async function criarAlunoComMatricula(opcoes: { escola?: EscolaDeTeste; matricula?: string; senha?: string; nome?: string; introducao?: Introducao } = {}): Promise<AlunoDeTeste> {
  const marca = randomUUID()
  const escola = opcoes.escola ?? (await criarEscolaSintetica())
  const matricula = opcoes.matricula ?? String(Date.now()).slice(-8)
  const senha = opcoes.senha ?? `senha-sintetica-${marca}`
  const nome = opcoes.nome ?? `Aluno sintético ${marca.slice(0, 8)}`
  const senhaHash = await hashDaSenha(senha)
  return comBanco(async (banco) => {
    const usuarioId = await id(banco, `insert into usuario (escola_id, papel, nome, introducao_vista_em) values ($1, 'aluno', $2, ${introducaoVistaEm(opcoes.introducao)}) returning id`, [escola.escolaId, nome])
    await banco.query('insert into credencial_matricula (escola_id, usuario_id, matricula, senha_hash) values ($1, $2, $3, $4)', [escola.escolaId, usuarioId, matricula, senhaHash])
    return { ...escola, usuarioId, nome, matricula, senha }
  })
}

/**
 * A inatividade que a escola configurou (`PUT /v1/escola/sessao`, Tech Spec, seção 3), gravada direto no banco: é ela
 * que o `/v1/eu` devolve e que o relógio da aba usa. Cada escola escolhe a sua, e é por isso que o teste precisa de
 * uma diferente do padrão para provar que a tela lê o valor do servidor, e não um número fixo.
 */
export async function definirInatividadeDaEscola(escolaId: string, minutos: { equipe?: number; aluno?: number }): Promise<void> {
  await comBanco(async (banco) => {
    await banco.query('update escola set inatividade_equipe_min = coalesce($2, inatividade_equipe_min), inatividade_aluno_min = coalesce($3, inatividade_aluno_min) where id = $1', [
      escolaId,
      minutos.equipe ?? null,
      minutos.aluno ?? null,
    ])
  })
}

/**
 * Dá à escola um nome comprido (de papel), como o de uma rede que escreve o nome por extenso: é o que a barra do topo do
 * celular precisa cortar com reticências sem empurrar o "Sair" para fora da janela (13.0, RF14).
 */
export async function renomearEscolaNoBanco(escolaId: string, nome: string): Promise<void> {
  await comBanco(async (banco) => {
    await banco.query('update escola set nome = $2 where id = $1', [escolaId, nome])
  })
}

/**
 * Um ajuste de retenção da escola, como o `ops:retencao` o grava (F3, 6.0): uma linha por escola e categoria, com o
 * contrato e o operador de teste. O comando confere piso, teto e travas; o teste que precisa de um ajuste válido escolhe um.
 */
export async function ajustarRetencaoDaEscola(escolaId: string, categoria: string, meses: number): Promise<void> {
  await comBanco(async (banco) => {
    await banco.query(
      'insert into retencao_escola (escola_id, categoria, meses, referencia_contrato, alterada_por) values ($1, $2, $3, 1, $4) on conflict (escola_id, categoria) do update set meses = excluded.meses',
      [escolaId, categoria, meses, 'equipe-de-teste'],
    )
  })
}

/** Um suboperador de teste (F3, 8.0): a empresa que recebe dado da escola, como o `ops:suboperador` a grava. */
export interface SuboperadorDeTeste {
  readonly nome: string
  readonly finalidade?: string
  readonly pais?: string
  readonly categorias?: readonly string[]
  readonly vedaTreinamento?: boolean
  /** As escolas que ele atende (`lista`), ou `todas`. */
  readonly escolas: readonly string[] | 'todas'
  /** `encerrado` é o histórico: começou há 30 dias e acabou há 10. */
  readonly encerrado?: boolean
}

/**
 * Cadastra o suboperador direto no banco, como o `ops:suboperador` o deixa: a linha, e a ligação com cada escola da lista.
 * O nome é do teste (único), porque `suboperador` é global e um de "todas" aparece em toda escola. Devolve a chave.
 */
export async function cadastrarSuboperadorDeTeste(dados: SuboperadorDeTeste): Promise<string> {
  const chave = `e2e-${randomUUID().slice(0, 8)}`
  return comBanco(async (banco) => {
    const inicio = dados.encerrado === true ? "now() - interval '30 days'" : 'now()'
    const fim = dados.encerrado === true ? "now() - interval '10 days'" : 'null'
    const suboperadorId = await id(
      banco,
      `insert into suboperador (chave, nome, finalidade, categorias, pais, contrato, veda_treinamento, alcance, inicio, fim, registrado_por)
       values ($1, $2, $3, $4, $5, 'DPA-E2E', $6, $7, ${inicio}, ${fim}, 'equipe-de-teste') returning id`,
      [chave, dados.nome, dados.finalidade ?? 'Hospedagem do banco e dos arquivos', dados.categorias ?? ['cadastro'], dados.pais ?? 'BR', dados.vedaTreinamento ?? true, dados.escolas === 'todas' ? 'todas' : 'lista'],
    )
    if (dados.escolas !== 'todas') {
      for (const escolaId of dados.escolas) {
        await banco.query(`insert into suboperador_escola (escola_id, suboperador_id, inicio, fim) values ($1, $2, ${inicio}, ${fim})`, [escolaId, suboperadorId])
      }
    }
    return chave
  })
}

/** O domínio Google ou o tenant Microsoft que a escola liberou (13.0): é dado da instituição, não de pessoa. */
export async function liberarProvedorDaEscola(escolaId: string, provedor: 'google' | 'microsoft', valor: string): Promise<void> {
  await comBanco(async (banco) => {
    await banco.query('insert into provedor_escola (escola_id, provedor, valor) values ($1, $2, $3)', [escolaId, provedor, valor])
  })
}

/**
 * A ligação entre a conta do provedor e o usuário da escola (RF10): sem ela, o aluno com conta válida do domínio é
 * recusado. Guarda só provedor e identificador estável, nunca e-mail, nome ou foto.
 */
export async function ligarContaExterna(escolaId: string, usuarioId: string, chave: { provedor: 'google' | 'microsoft'; sujeito: string; tenant?: string }): Promise<void> {
  await comBanco(async (banco) => {
    await banco.query('insert into conta_externa (escola_id, usuario_id, provedor, tenant, sujeito) values ($1, $2, $3, $4, $5)', [
      escolaId,
      usuarioId,
      chave.provedor,
      chave.tenant ?? null,
      chave.sujeito,
    ])
  })
}

/**
 * Um convite de coordenador válido por 72 h, na escola dada ou numa nova.
 *
 * - Sem `conta`, a conta nasce sem senha, como a de quem nunca usou o sistema: o aceite define a senha e leva ao
 *   segundo fator.
 * - Com `conta`, o convite é para quem já trabalha em outra escola cliente: o aceite não troca a senha dela e leva ao
 *   login, com o bilhete.
 */
export async function criarConviteDeCoordenador(opcoes: { conta?: EquipeDeTeste; expirado?: boolean; revogado?: boolean } = {}): Promise<ConviteDeTeste> {
  const marca = randomUUID()
  const escola = await criarEscolaSintetica()
  // O token e o hash pelas mesmas peças do `ops:convite-coordenador` e do aceite; o banco guarda só o hash.
  const token = randomBytes(BYTES_DO_TOKEN_DE_CONVITE).toString('base64url')
  const tokenHash = hashDoToken(token)
  const expiraEm = opcoes.expirado ? new Date(Date.now() - 60_000) : new Date(Date.now() + 72 * 60 * 60 * 1_000)
  return comBanco(async (banco) => {
    const contaId =
      opcoes.conta?.contaId ?? (await id(banco, 'insert into conta (email) values ($1) returning id', [`coordenador-${marca}@educa.invalid`]))
    const usuarioId = await id(banco, "insert into usuario (escola_id, conta_id, papel, nome, desativado_em, introducao_vista_em) values ($1, $2, 'coordenador', $3, now(), now()) returning id", [
      escola.escolaId,
      contaId,
      `Coordenadora sintética ${marca.slice(0, 8)}`,
    ])
    await banco.query("insert into convite (escola_id, token_hash, tipo, usuario_id, expira_em, revogado_em) values ($1, $2, 'coordenador', $3, $4, $5)", [
      escola.escolaId,
      tokenHash,
      usuarioId,
      expiraEm,
      opcoes.revogado === true ? new Date() : null,
    ])
    return { ...escola, token, usuarioId }
  })
}

/**
 * O usuário deixa a escola (a coordenação o desativa): a conta continua com a senha, sem usuário ativo nele. É a pessoa
 * que já trabalhou numa escola cliente e recebe o convite de outra.
 */
export async function desativarUsuario(usuarioId: string): Promise<void> {
  await comBanco(async (banco) => {
    await banco.query('update usuario set desativado_em = now() where id = $1', [usuarioId])
  })
}

/**
 * A coordenação agendou a eliminação da pessoa (F3, 14.0): a marca que a guarda e a renovação leem, posta direto no
 * banco. Sem o pedido e sem o encerramento das sessões, de propósito — é o que a API faz com a marca, e não com o
 * registro: a requisição seguinte da aba recebe 401 e a renovação, 403 `ACESSO_SUSPENSO`, com a sessão ainda aberta no
 * servidor. É isso que prova que a recusa não depende de o registro ter encerrado nada.
 */
export async function agendarEliminacaoNoBanco(usuarioId: string): Promise<void> {
  await comBanco(async (banco) => {
    await banco.query('update usuario set eliminacao_agendada_em = now() where id = $1', [usuarioId])
  })
}

/**
 * A coordenação cancelou o pedido dentro do prazo: a marca sai, e a mesma senha volta a entrar. O que foi encerrado
 * enquanto ela esteve posta não volta (a sessão da aba era a anterior ao agendamento), e é por isso que o teste entra de novo.
 */
export async function cancelarEliminacaoNoBanco(usuarioId: string): Promise<void> {
  await comBanco(async (banco) => {
    await banco.query('update usuario set eliminacao_agendada_em = null where id = $1', [usuarioId])
  })
}

/**
 * O operador revoga o convite da coordenação, depois do aceite e antes da primeira entrada (A0b, estado `aceito`), como
 * o painel faz: o convite usado ganha `revogado_em`, e o bilhete do aceite deixa de ativar. Só o convite daquele usuário
 * convidado, na escola dele.
 */
export async function revogarConvite(convite: Pick<ConviteDeTeste, 'escolaId' | 'usuarioId'>): Promise<void> {
  await comBanco(async (banco) => {
    await banco.query('update convite set revogado_em = now() where escola_id = $1 and usuario_id = $2 and revogado_em is null', [convite.escolaId, convite.usuarioId])
  })
}

/**
 * O código que um aplicativo autenticador mostraria para aquele segredo. O e2e faz aqui o papel do KeePassXC do
 * computador da coordenadora: o `otpauth` com os valores padrão é o mesmo TOTP que a API confere (SHA1, 6 dígitos,
 * 30 s; Tech Spec, seção 5, "TOTP").
 *
 * `deslocamentoSegundos` pede o código de um passo à frente: a ativação grava o passo usado, e só um passo maior
 * entra depois (`mfa_ultimo_passo`), sem o teste esperar meio minuto de relógio real.
 */
export function codigoDoAutenticador(segredoBase32: string, deslocamentoSegundos = 0): string {
  return new TOTP({ secret: Secret.fromBase32(segredoBase32) }).generate({ timestamp: Date.now() + deslocamentoSegundos * 1_000 })
}

/** A turma com os vínculos que a coordenação alocou para o professor, como a tela "Turmas" do professor os recebe (RF4). */
export interface AlocacaoDeTeste {
  readonly turmaId: string
  readonly turmaNome: string
  /** Os ids dos vínculos criados, um por disciplina: é por eles que o teste procura dado desta escola na resposta de outra. */
  readonly vinculoIds: readonly string[]
  /** Um vínculo por disciplina, todos `pendente`: é o professor com duas disciplinas na mesma turma. */
  readonly disciplinas: readonly string[]
}

/**
 * Uma turma no ano em curso da escola, com um vínculo pendente por disciplina para aquele professor (RF3, RF4).
 *
 * Quem cria vínculo é a coordenação (regra 60, item 8a), e o banco exige que o autor seja usuário da mesma escola:
 * por isso a fixture cria também a coordenadora sintética que assina a alocação, como no onboarding de verdade.
 *
 * O nome da turma leva uma marca única: é com ele que o teste de isolamento afirma que nada da escola A aparece
 * depois da troca para a B. `nomeDaTurma` é para o teste que precisa de um nome próprio (o de 40 caracteres sem espaço,
 * que prova que a tela não estica).
 */
export async function criarAlocacaoDoProfessor(
  escolaId: string,
  usuarioId: string,
  disciplinas: readonly string[] = ['Matemática'],
  nomeDaTurma?: string,
): Promise<AlocacaoDeTeste> {
  const marca = randomUUID().slice(0, 8)
  const turmaNome = nomeDaTurma ?? `7ºA sintética ${marca}`
  return comBanco(async (banco) => {
    const { rows: anos } = await banco.query<{ id: string }>("select id from ano_letivo where escola_id = $1 and situacao = 'em_curso'", [escolaId])
    const anoLetivoId = anos[0]?.id
    if (anoLetivoId === undefined) throw new Error('a escola do e2e não tem ano letivo em curso')
    const contaDaCoordenacao = await id(banco, 'insert into conta (email) values ($1) returning id', [`coordenacao-${randomUUID()}@educa.invalid`])
    const coordenacaoId = await id(banco, "insert into usuario (escola_id, conta_id, papel, nome, introducao_vista_em) values ($1, $2, 'coordenador', 'Coordenação sintética', now()) returning id", [
      escolaId,
      contaDaCoordenacao,
    ])
    // A série é única por escola: a segunda turma do mesmo professor, na mesma escola, usa a mesma 7ª série.
    const serieId = await id(
      banco,
      "insert into serie (escola_id, etapa, ano) values ($1, 'ef_anos_finais', 7) on conflict (escola_id, etapa, ano) do update set ano = excluded.ano returning id",
      [escolaId],
    )
    const turmaId = await id(banco, 'insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, $4) returning id', [escolaId, anoLetivoId, serieId, turmaNome])
    const vinculoIds: string[] = []
    for (const disciplina of disciplinas) {
      const disciplinaId = await id(banco, 'insert into disciplina (escola_id, nome) values ($1, $2) returning id', [escolaId, disciplina])
      vinculoIds.push(
        await id(
          banco,
          "insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, disciplina_id, papel, criado_por) values ($1, $2, $3, $4, $5, 'professor', $6) returning id",
          [escolaId, anoLetivoId, usuarioId, turmaId, disciplinaId, coordenacaoId],
        ),
      )
    }
    return { turmaId, turmaNome, disciplinas, vinculoIds }
  })
}

/** A turma do aluno aprovado, como o `GET /v1/minha-turma` a devolve. */
export interface TurmaDoAlunoDeTeste {
  readonly turmaId: string
  readonly turmaNome: string
  /** A série por extenso, como a tela a escreve ("2º ano do Ensino Médio"). */
  readonly serieNome: string
}

/**
 * Põe o aluno numa turma do ano em curso da escola dele, com o vínculo `confirmado`, como a aprovação da reivindicação o
 * deixa (8.0): é o que a "Minha turma" mostra. Atalho só do e2e: grava direto no banco, sem a decisão humana nem a
 * auditoria dela, e não serve de modelo para seed de demonstração, que monta a escola pela tela (D71).
 *
 * Sem `turma`, cria uma de 2º ano do Ensino Médio, para a série na tela não ser um valor que a tela pudesse ter fixo; com
 * ela, põe o aluno como colega de quem já está lá. O vínculo é assinado por uma coordenadora sintética da mesma escola.
 */
export async function colocarAlunoNaTurma(aluno: Pick<AlunoDeTeste, 'escolaId' | 'usuarioId'>, turma?: TurmaDoAlunoDeTeste): Promise<TurmaDoAlunoDeTeste> {
  return comBanco(async (banco) => {
    const { rows: anos } = await banco.query<{ id: string }>("select id from ano_letivo where escola_id = $1 and situacao = 'em_curso'", [aluno.escolaId])
    const anoLetivoId = anos[0]?.id
    if (anoLetivoId === undefined) throw new Error('a escola do e2e não tem ano letivo em curso')
    const contaDaCoordenacao = await id(banco, 'insert into conta (email) values ($1) returning id', [`coordenacao-${randomUUID()}@educa.invalid`])
    const coordenacaoId = await id(banco, "insert into usuario (escola_id, conta_id, papel, nome, introducao_vista_em) values ($1, $2, 'coordenador', 'Coordenação sintética', now()) returning id", [
      aluno.escolaId,
      contaDaCoordenacao,
    ])
    let destino = turma
    if (destino === undefined) {
      const turmaNome = `2ºB sintética ${randomUUID().slice(0, 8)}`
      // A série é única por escola: o segundo aluno da mesma escola, numa turma nova, usa a mesma 2ª série.
      const serieId = await id(
        banco,
        "insert into serie (escola_id, etapa, ano) values ($1, 'em', 2) on conflict (escola_id, etapa, ano) do update set ano = excluded.ano returning id",
        [aluno.escolaId],
      )
      const turmaId = await id(banco, 'insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, $4) returning id', [aluno.escolaId, anoLetivoId, serieId, turmaNome])
      destino = { turmaId, turmaNome, serieNome: '2º ano do Ensino Médio' }
    }
    await banco.query(
      "insert into vinculo (escola_id, ano_letivo_id, usuario_id, turma_id, papel, estado, decidido_em, criado_por) values ($1, $2, $3, $4, 'aluno', 'confirmado', now(), $5)",
      [aluno.escolaId, anoLetivoId, aluno.usuarioId, destino.turmaId, coordenacaoId],
    )
    return destino
  })
}

/**
 * Encerra as sessões abertas de uma pessoa, como a coordenação faz ao desativar alguém ou como o expurgo faz com a
 * sessão vencida: a requisição seguinte da aba já não vale (RF5, Tech Spec, seção 5, "Requisição").
 */
export async function encerrarSessoesDoUsuario(usuarioId: string): Promise<void> {
  await comBanco(async (banco) => {
    await banco.query("update sessao set encerrada_em = now(), motivo = 'desativacao' where usuario_id = $1 and encerrada_em is null", [usuarioId])
  })
}

/** A estrutura que a coordenação já montou, gravada direto no banco: série, disciplina e turmas do ano em curso. */
export interface EstruturaDeTeste {
  readonly anoLetivoId: string
  readonly disciplina: { readonly id: string; readonly nome: string }
  readonly turmas: ReadonlyArray<{ readonly id: string; readonly nome: string }>
}

/**
 * Uma série de 7º ano, uma disciplina e as turmas dadas, no ano em curso da escola, como a Estrutura (13.0) as criaria.
 * Atalho do e2e para o teste que não é sobre criar: nomes com uma marca única, para o teste de isolamento procurá-los.
 * As turmas nascem na ordem dada, que é a ordem em que a API as lista (o id segue a criação): quem prova a ordem da tela
 * as dá fora da ordem do nome.
 */
export async function montarEstruturaNoBanco(escolaId: string, turmas: readonly string[] = ['7A']): Promise<EstruturaDeTeste> {
  const marca = randomUUID().slice(0, 8)
  return comBanco(async (banco) => {
    const { rows: anos } = await banco.query<{ id: string }>("select id from ano_letivo where escola_id = $1 and situacao = 'em_curso'", [escolaId])
    const anoLetivoId = anos[0]?.id
    if (anoLetivoId === undefined) throw new Error('a escola do e2e não tem ano letivo em curso')
    const serieId = await id(banco, "insert into serie (escola_id, etapa, ano) values ($1, 'ef_anos_finais', 7) on conflict (escola_id, etapa, ano) do update set ano = excluded.ano returning id", [escolaId])
    const disciplinaNome = `Ciências sintética ${marca}`
    const disciplinaId = await id(banco, 'insert into disciplina (escola_id, nome) values ($1, $2) returning id', [escolaId, disciplinaNome])
    const criadas: Array<{ id: string; nome: string }> = []
    for (const turma of turmas) {
      const nome = `${turma} ${marca}`
      criadas.push({ id: await id(banco, 'insert into turma (escola_id, ano_letivo_id, serie_id, nome) values ($1, $2, $3, $4) returning id', [escolaId, anoLetivoId, serieId, nome]), nome })
    }
    return { anoLetivoId, disciplina: { id: disciplinaId, nome: disciplinaNome }, turmas: criadas }
  })
}

/**
 * Nomes na lista da turma, livres como a gravação da lista (2.0) os deixa ou já reivindicados (o aluno pediu o nome, 6.0),
 * na ordem dada. Nome e matrícula inventados pelo teste.
 */
export async function porNaListaDaTurma(
  escolaId: string,
  turmaId: string,
  nomes: ReadonlyArray<{ readonly nome: string; readonly matricula: string; readonly estado?: 'livre' | 'reivindicado' }>,
): Promise<void> {
  await comBanco(async (banco) => {
    const { rows } = await banco.query<{ ano_letivo_id: string }>('select ano_letivo_id from turma where escola_id = $1 and id = $2', [escolaId, turmaId])
    const anoLetivoId = rows[0]?.ano_letivo_id
    if (anoLetivoId === undefined) throw new Error('turma do e2e não encontrada')
    for (const { nome, matricula, estado = 'livre' } of nomes)
      await banco.query('insert into lista_nome (escola_id, ano_letivo_id, turma_id, nome, matricula, estado) values ($1, $2, $3, $4, $5, $6)', [
        escolaId,
        anoLetivoId,
        turmaId,
        nome,
        matricula,
        estado,
      ])
  })
}

/** Uma disciplina a mais na escola, direto no banco: criada depois, vem depois na lista da API. */
export async function criarDisciplinaNoBanco(escolaId: string, nome: string): Promise<string> {
  return comBanco((banco) => id(banco, 'insert into disciplina (escola_id, nome) values ($1, $2) returning id', [escolaId, nome]))
}

/** Apaga a disciplina direto no banco: é a outra pessoa da coordenação que a excluiu enquanto a tela estava aberta. */
export async function apagarDisciplinaNoBanco(escolaId: string, disciplinaId: string): Promise<void> {
  await comBanco(async (banco) => {
    await banco.query('delete from disciplina where escola_id = $1 and id = $2', [escolaId, disciplinaId])
  })
}

/** As sete séries do recorte (D43), do 6º ano ao 3º do Ensino Médio, na escola. */
export async function criarTodasAsSeriesNoBanco(escolaId: string): Promise<void> {
  await comBanco(async (banco) => {
    await banco.query(
      "insert into serie (escola_id, etapa, ano) select $1, etapa, ano from (values ('ef_anos_finais', 6), ('ef_anos_finais', 7), ('ef_anos_finais', 8), ('ef_anos_finais', 9), ('em', 1), ('em', 2), ('em', 3)) as recorte(etapa, ano) on conflict (escola_id, etapa, ano) do nothing",
      [escolaId],
    )
  })
}

/** O professor da lista da coordenação, como a fixture o deixou: o e-mail só existe aqui, a lista não o mostra (E11). */
export interface ProfessorDeTeste {
  readonly usuarioId: string
  readonly nome: string
  readonly email: string
}

/** Os estados do professor na escola, como `estadoDoProfessor` os calcula (`packages/nucleo`, A1, 3.0): os do contrato. */
export type EstadoDoProfessorDeTeste = EstadoDoProfessor

const NOME_DO_ESTADO_NO_TESTE: Readonly<Record<EstadoDoProfessorDeTeste, string>> = {
  pendente: 'convidado',
  vencido: 'de convite vencido',
  revogado: 'de convite revogado',
  aceito: 'que aceitou',
  ativo: 'ativo',
  desativado: 'desativado',
}

/**
 * Um professor da escola no estado dado, como o cadastro pela coordenação (3.0) e o que veio depois o deixariam: o
 * usuário, ativo ou não, e o convite de professor em aberto, vencido, revogado ou já usado. É o que a alocação da
 * Estrutura oferece, ou não (13.0), e o que a tela Professores lista (14.0). O e-mail é do domínio reservado. O
 * `primeiroNome` é para o teste que prova a ordem: o nome inteiro continua com a marca única.
 *
 * - `pendente`, `vencido`, `revogado`: o usuário inativo e o convite não usado;
 * - `aceito`: o convite usado e o usuário ativo, como a conta nova fica no aceite;
 * - `ativo`: ativo sem convite de professor (o de antes da A1); `desativado`: inativo sem convite.
 */
export async function convidarProfessorNoBanco(escolaId: string, estado: EstadoDoProfessorDeTeste, primeiroNome = 'Professor'): Promise<ProfessorDeTeste> {
  const marca = randomUUID()
  const nome = `${primeiroNome} ${NOME_DO_ESTADO_NO_TESTE[estado]} ${marca.slice(0, 8)}`
  const email = `professor-${marca}@educa.invalid`
  const ativo = estado === 'aceito' || estado === 'ativo'
  return comBanco(async (banco) => {
    const contaId = await id(banco, 'insert into conta (email) values ($1) returning id', [email])
    const usuarioId = await id(banco, "insert into usuario (escola_id, conta_id, papel, nome, desativado_em, introducao_vista_em) values ($1, $2, 'professor', $3, $4, now()) returning id", [
      escolaId,
      contaId,
      nome,
      ativo ? null : new Date(),
    ])
    if (estado !== 'ativo' && estado !== 'desativado') {
      const expiraEm = estado === 'vencido' ? new Date(Date.now() - 60_000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000)
      await banco.query("insert into convite (escola_id, token_hash, tipo, usuario_id, expira_em, usado_em, revogado_em) values ($1, $2, 'professor', $3, $4, $5, $6)", [
        escolaId,
        hashDoToken(randomBytes(BYTES_DO_TOKEN_DE_CONVITE).toString('base64url')),
        usuarioId,
        expiraEm,
        estado === 'aceito' ? new Date() : null,
        estado === 'revogado' ? new Date() : null,
      ])
    }
    return { usuarioId, nome, email }
  })
}

/** O convite de professor (A1, 3.0), como a coordenação o gera ao cadastrar, mas direto no banco: o link e quem é convidado. */
export interface ConviteDeProfessorDeTeste extends EscolaDeTeste {
  /** O token do link, que só existe aqui: o banco guarda o SHA-256 dele. */
  readonly token: string
  readonly usuarioId: string
  readonly nome: string
  readonly email: string
}

/**
 * Um convite de professor válido por 7 dias, numa escola nova.
 *
 * - Sem `conta`, a conta nasce sem senha: o aceite pede a senha nova e leva à entrada, porque o professor não tem segundo
 *   fator.
 * - Com `conta`, o convite é para quem já trabalha em outra escola cliente: o aceite não troca a senha dela e leva à
 *   entrada, com o bilhete.
 * - `expirado`, `revogado` e `usado` deixam o convite num dos estados em que ele não vale mais; o `usado` é o link que o
 *   professor abre de novo depois de já ter aceitado.
 */
export async function criarConviteDeProfessor(opcoes: { conta?: EquipeDeTeste; expirado?: boolean; revogado?: boolean; usado?: boolean } = {}): Promise<ConviteDeProfessorDeTeste> {
  const marca = randomUUID()
  const escola = await criarEscolaSintetica()
  const token = randomBytes(BYTES_DO_TOKEN_DE_CONVITE).toString('base64url')
  const nome = `Professor sintético ${marca.slice(0, 8)}`
  const email = opcoes.conta?.email ?? `professor-${marca}@educa.invalid`
  const expiraEm = opcoes.expirado ? new Date(Date.now() - 60_000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000)
  return comBanco(async (banco) => {
    const contaId = opcoes.conta?.contaId ?? (await id(banco, 'insert into conta (email) values ($1) returning id', [email]))
    const usuarioId = await id(banco, "insert into usuario (escola_id, conta_id, papel, nome, desativado_em, introducao_vista_em) values ($1, $2, 'professor', $3, now(), now()) returning id", [
      escola.escolaId,
      contaId,
      nome,
    ])
    await banco.query("insert into convite (escola_id, token_hash, tipo, usuario_id, expira_em, revogado_em, usado_em) values ($1, $2, 'professor', $3, $4, $5, $6)", [
      escola.escolaId,
      hashDoToken(token),
      usuarioId,
      expiraEm,
      opcoes.revogado === true ? new Date() : null,
      opcoes.usado === true ? new Date() : null,
    ])
    return { ...escola, token, usuarioId, nome, email }
  })
}

/** Quantos convites de professor a escola tem em aberto (nem usados, nem revogados): é o que o clique duplo não pode dobrar. */
export async function convitesDeProfessorEmAberto(escolaId: string): Promise<number> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ total: string }>("select count(*) as total from convite where escola_id = $1 and tipo = 'professor' and usado_em is null and revogado_em is null", [escolaId])
    return Number(rows[0]?.total ?? 0)
  })
}

/** O convite em aberto do professor passa do prazo, com a tela da coordenação aberta: ele deixa de ser alocável (13.0). */
export async function vencerConviteNoBanco(usuarioId: string): Promise<void> {
  await comBanco(async (banco) => {
    await banco.query("update convite set expira_em = now() - interval '1 minute' where usuario_id = $1 and tipo = 'professor' and usado_em is null and revogado_em is null", [usuarioId])
  })
}

/**
 * A turma sai da escola com os vínculos e os nomes da lista dela, direto no banco: outra pessoa da coordenação esvaziou e
 * excluiu a turma com esta tela aberta.
 */
export async function apagarTurmaNoBanco(escolaId: string, turmaId: string): Promise<void> {
  await comBanco(async (banco) => {
    await banco.query('delete from vinculo where escola_id = $1 and turma_id = $2', [escolaId, turmaId])
    await banco.query('delete from lista_nome where escola_id = $1 and turma_id = $2', [escolaId, turmaId])
    await banco.query('delete from turma where escola_id = $1 and id = $2', [escolaId, turmaId])
  })
}

/**
 * Um ano letivo da escola, direto no banco, na situação dada: o encerrado de antes da virada, o planejado ainda por abrir,
 * e o que outra pessoa da coordenação abriu com esta tela aberta.
 */
export async function criarAnoLetivoNoBanco(escolaId: string, ano: number, situacao: 'planejado' | 'em_curso' | 'encerrado'): Promise<void> {
  await comBanco(async (banco) => {
    await banco.query('insert into ano_letivo (escola_id, ano, inicio, fim, situacao) values ($1, $2, $3, $4, $5)', [escolaId, ano, `${String(ano)}-02-01`, `${String(ano)}-12-15`, situacao])
  })
}

/** A série sai da escola direto no banco: outra pessoa da coordenação a excluiu com o diálogo da turma nova aberto. */
export async function apagarSerieNoBanco(escolaId: string, etapa: 'ef_anos_finais' | 'em', ano: number): Promise<void> {
  await comBanco(async (banco) => {
    await banco.query('delete from serie where escola_id = $1 and etapa = $2 and ano = $3', [escolaId, etapa, ano])
  })
}

/**
 * O professor confirma os vínculos, direto no banco: é o que abre a turma para ele (E12, P2). Atalho do e2e para o teste
 * que não é sobre confirmar; a confirmação pela tela é provada em `e2e/areas.spec.ts` e `e2e/escola-e-vinculos.spec.ts`.
 */
export async function confirmarVinculosNoBanco(escolaId: string, vinculoIds: readonly string[]): Promise<void> {
  await comBanco(async (banco) => {
    await banco.query("update vinculo set estado = 'confirmado', decidido_em = now() where escola_id = $1 and id = any($2::uuid[])", [escolaId, [...vinculoIds]])
  })
}

/**
 * A coordenação encerra os vínculos do professor naquela turma, com a tela dele aberta: é o professor realocado em março,
 * que deixa de alcançar a turma na requisição seguinte.
 */
export async function encerrarVinculosNoBanco(escolaId: string, turmaId: string, usuarioId: string): Promise<void> {
  await comBanco(async (banco) => {
    await banco.query(
      "update vinculo set estado = 'encerrado', motivo_encerramento = 'realocacao', encerrado_em = now() where escola_id = $1 and turma_id = $2 and usuario_id = $3 and estado <> 'encerrado'",
      [escolaId, turmaId, usuarioId],
    )
  })
}

/** Quantos acessos vigentes (nem revogados, nem vencidos) a turma tem: é o que o clique duplo em "Gerar" não pode dobrar. */
export async function acessosVigentesDaTurma(escolaId: string, turmaId: string): Promise<number> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ total: string }>(
      'select count(*) as total from acesso_turma where escola_id = $1 and turma_id = $2 and revogado_em is null and expira_em > now()',
      [escolaId, turmaId],
    )
    return Number(rows[0]?.total ?? 0)
  })
}

/**
 * Outro professor da turma gera o acesso com esta tela aberta, direto no banco: o que estava vigente cai, e o novo vale
 * pelos dias dados. O token e o código são sorteados e não saem daqui: o banco guarda só o hash de um e um valor único no
 * lugar do HMAC do outro, que ninguém vai conferir. Devolve até quando ele vale, como a API o devolveria.
 */
export async function gerarAcessoNoBanco(escolaId: string, turmaId: string, validadeDias: 1 | 7 | 30): Promise<string> {
  return comBanco(async (banco) => {
    const { rows: turmas } = await banco.query<{ ano_letivo_id: string }>('select ano_letivo_id from turma where escola_id = $1 and id = $2', [escolaId, turmaId])
    const anoLetivoId = turmas[0]?.ano_letivo_id
    if (anoLetivoId === undefined) throw new Error('turma do e2e não encontrada')
    await banco.query('update acesso_turma set revogado_em = now() where escola_id = $1 and turma_id = $2 and revogado_em is null', [escolaId, turmaId])
    const { rows } = await banco.query<{ expira_em: Date }>(
      "insert into acesso_turma (escola_id, ano_letivo_id, turma_id, token_hash, codigo_hmac, validade_dias, expira_em) values ($1, $2, $3, $4, $5, $6, now() + make_interval(days => $6)) returning expira_em",
      [escolaId, anoLetivoId, turmaId, hashDoToken(randomBytes(BYTES_DO_TOKEN_DE_CONVITE).toString('base64url')), randomBytes(32).toString('hex'), validadeDias],
    )
    const expiraEm = rows[0]?.expira_em
    if (expiraEm === undefined) throw new Error('o seed do e2e não criou o acesso da turma')
    return expiraEm.toISOString()
  })
}

/** Outro professor da turma revoga o acesso vigente com esta tela aberta, direto no banco. */
export async function revogarAcessoNoBanco(escolaId: string, turmaId: string): Promise<void> {
  await comBanco(async (banco) => {
    await banco.query('update acesso_turma set revogado_em = now() where escola_id = $1 and turma_id = $2 and revogado_em is null', [escolaId, turmaId])
  })
}

/**
 * O professor contesta o vínculo, direto no banco: ele continua esperando a correção da coordenação, e não abre a turma
 * (E12, P2). A contestação pela tela é provada em `e2e/areas.spec.ts` e `e2e/escola-e-vinculos.spec.ts`.
 */
export async function contestarVinculosNoBanco(escolaId: string, vinculoIds: readonly string[]): Promise<void> {
  await comBanco(async (banco) => {
    await banco.query("update vinculo set estado = 'contestado', contestacao = 'nao_leciono', decidido_em = now() where escola_id = $1 and id = any($2::uuid[])", [escolaId, [...vinculoIds]])
  })
}

/**
 * Uma coordenadora a mais na escola de alguém que o teste já criou, com conta e senha próprias: é a segunda pessoa da
 * **mesma** escola na mesma aba, a que alcança a mesma turma por outro papel (16.0). O nome leva uma marca única.
 */
export async function criarCoordenadoraNaEscola(escola: Pick<EquipeDeTeste, 'escolaId' | 'escolaNome' | 'redeNome' | 'slug'>): Promise<EquipeDeTeste> {
  const marca = randomUUID()
  const nome = `Coordenadora sintética ${marca.slice(0, 8)}`
  const email = `coordenador-${marca}@educa.invalid`
  const senha = `senha-sintetica-${marca}`
  const senhaHash = await hashDaSenha(senha)
  return comBanco(async (banco) => {
    const contaId = await id(banco, 'insert into conta (email, senha_hash) values ($1, $2) returning id', [email, senhaHash])
    const usuarioId = await id(banco, "insert into usuario (escola_id, conta_id, papel, nome, introducao_vista_em) values ($1, $2, 'coordenador', $3, now()) returning id", [escola.escolaId, contaId, nome])
    return { escolaId: escola.escolaId, escolaNome: escola.escolaNome, redeNome: escola.redeNome, slug: escola.slug, contaId, usuarioId, nome, email, senha }
  })
}

/** Um pedido de nome pendente, como a página pública da sala o deixa (6.0): o id dele e o do nome da lista. */
export interface PedidoDeTeste {
  readonly id: string
  readonly listaNomeId: string
  readonly nome: string
  readonly matricula: string
}

/**
 * Pedidos de nome pendentes na turma, direto no banco, na ordem dada (o id segue a criação, e é a ordem em que a API os
 * lista): o nome entra na lista já `reivindicado`, e o pedido, com a chave de envio, o hash de uma senha inventada e a
 * marca da tentativa com matrícula errada que o teste pedir. Nome e matrícula inventados pelo teste. Atalho só do e2e: o
 * pedido de verdade nasce na página pública (17.0).
 */
export async function criarPedidosNoBanco(
  escolaId: string,
  turmaId: string,
  pedidos: ReadonlyArray<{ readonly nome: string; readonly matricula: string; readonly teveMatriculaErrada?: boolean }>,
): Promise<PedidoDeTeste[]> {
  const senhaHash = await hashDaSenha(`senha-sintetica-${randomUUID()}`)
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ ano_letivo_id: string }>('select ano_letivo_id from turma where escola_id = $1 and id = $2', [escolaId, turmaId])
    const anoLetivoId = rows[0]?.ano_letivo_id
    if (anoLetivoId === undefined) throw new Error('turma do e2e não encontrada')
    const criados: PedidoDeTeste[] = []
    for (const { nome, matricula, teveMatriculaErrada = false } of pedidos) {
      const listaNomeId = await id(banco, "insert into lista_nome (escola_id, ano_letivo_id, turma_id, nome, matricula, estado) values ($1, $2, $3, $4, $5, 'reivindicado') returning id", [
        escolaId,
        anoLetivoId,
        turmaId,
        nome,
        matricula,
      ])
      const pedidoId = await id(
        banco,
        'insert into reivindicacao (escola_id, ano_letivo_id, turma_id, lista_nome_id, chave_envio, senha_hash, teve_matricula_errada) values ($1, $2, $3, $4, $5, $6, $7) returning id',
        [escolaId, anoLetivoId, turmaId, listaNomeId, randomUUID(), senhaHash, teveMatriculaErrada],
      )
      criados.push({ id: pedidoId, listaNomeId, nome, matricula })
    }
    return criados
  })
}

/**
 * Outra pessoa recusa o pedido com esta tela aberta, direto no banco: o pedido fecha sem o hash, a chave e a marca, e o
 * nome volta a `livre`, como a decisão da API o deixa (8.0).
 */
export async function recusarPedidoNoBanco(escolaId: string, pedido: Pick<PedidoDeTeste, 'id' | 'listaNomeId'>): Promise<void> {
  await comBanco(async (banco) => {
    await banco.query(
      "update reivindicacao set estado = 'recusada', senha_hash = null, chave_envio = null, teve_matricula_errada = null, decidida_em = now(), decidida_como = 'coordenacao' where escola_id = $1 and id = $2",
      [escolaId, pedido.id],
    )
    await banco.query("update lista_nome set estado = 'livre' where escola_id = $1 and id = $2", [escolaId, pedido.listaNomeId])
  })
}

/** O pedido deixa de existir com esta tela aberta, direto no banco, e o nome volta a `livre`: para quem decide, é o `nao_encontrada`. */
export async function apagarPedidoNoBanco(escolaId: string, pedido: Pick<PedidoDeTeste, 'id' | 'listaNomeId'>): Promise<void> {
  await comBanco(async (banco) => {
    await banco.query('delete from reivindicacao where escola_id = $1 and id = $2', [escolaId, pedido.id])
    await banco.query("update lista_nome set estado = 'livre' where escola_id = $1 and id = $2", [escolaId, pedido.listaNomeId])
  })
}

/** Quantos alunos a turma tem com vínculo confirmado: é o que a aprovação cria, e o que o clique duplo não pode dobrar. */
export async function alunosDaTurmaNoBanco(escolaId: string, turmaId: string): Promise<number> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ total: string }>("select count(*) as total from vinculo where escola_id = $1 and turma_id = $2 and papel = 'aluno' and estado = 'confirmado'", [
      escolaId,
      turmaId,
    ])
    return Number(rows[0]?.total ?? 0)
  })
}

/** O estado de cada nome da lista da turma, pelo nome: `null` é o aprovado, que a lista guarda sem nome. */
export async function estadosDaListaNoBanco(escolaId: string, turmaId: string): Promise<Array<{ nome: string | null; estado: string }>> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ nome: string | null; estado: string }>('select nome, estado from lista_nome where escola_id = $1 and turma_id = $2 order by id', [escolaId, turmaId])
    return rows
  })
}

/** As leituras dos pedidos da turma que ficaram na auditoria (`turma.reivindicacoes_lidas`, A2): quem leu e para quê. */
export async function leiturasDePedidosNaAuditoria(escolaId: string, turmaId: string): Promise<Array<{ autor: string | null; finalidade: string | null }>> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ autor: string | null; finalidade: string | null }>(
      "select autor_usuario_id as autor, finalidade from auditoria where escola_id = $1 and acao = 'turma.reivindicacoes_lidas' and entidade_id = $2 order by em",
      [escolaId, turmaId],
    )
    return rows
  })
}

/** O ano letivo em curso da escola é encerrado com a tela aberta, direto no banco: as turmas dele saem do alcance de todos. */
export async function encerrarAnoNoBanco(escolaId: string): Promise<void> {
  await comBanco(async (banco) => {
    await banco.query("update ano_letivo set situacao = 'encerrado' where escola_id = $1 and situacao = 'em_curso'", [escolaId])
  })
}

/**
 * Alunos já aprovados na lista da turma, direto no banco, como a aprovação (8.0) deixa a linha: só o estado e o usuário,
 * sem nome nem matrícula. O usuário é um aluno inventado da escola.
 */
export async function porAprovadosNaListaDaTurma(escolaId: string, turmaId: string, quantos: number): Promise<void> {
  await comBanco(async (banco) => {
    const { rows } = await banco.query<{ ano_letivo_id: string }>('select ano_letivo_id from turma where escola_id = $1 and id = $2', [escolaId, turmaId])
    const anoLetivoId = rows[0]?.ano_letivo_id
    if (anoLetivoId === undefined) throw new Error('turma do e2e não encontrada')
    for (let vez = 0; vez < quantos; vez++) {
      const usuarioId = await id(banco, "insert into usuario (escola_id, papel, nome, introducao_vista_em) values ($1, 'aluno', $2, now()) returning id", [escolaId, `Aluno aprovado sintético ${randomUUID().slice(0, 8)}`])
      await banco.query("insert into lista_nome (escola_id, ano_letivo_id, turma_id, estado, usuario_id) values ($1, $2, $3, 'aprovado', $4)", [escolaId, anoLetivoId, turmaId, usuarioId])
    }
  })
}

/** O link e o código de uma sala, como o professor os recebe no "Gerar acesso" (4.0): só existem aqui. */
export interface AcessoDaSalaDeTeste {
  readonly token: string
  readonly codigo: string
}

/**
 * Um acesso vigente da turma com link e código **conhecidos**, direto no banco, como o gerar da API o deixa (4.0): o banco
 * guarda o SHA-256 do token e o HMAC do código com a `SALA_CHAVE_CODIGO` do compose de teste, pelas mesmas peças da API.
 * O que estava vigente cai. É o que a página pública da turma (17.0) abre pelo link e pelo código.
 */
export async function gerarAcessoDaSalaNoBanco(escolaId: string, turmaId: string): Promise<AcessoDaSalaDeTeste> {
  // As contas de `apps/api/src/sala/codigo-da-sala.ts`, refeitas aqui: aquele módulo importa `@educa/shared` pelo nome, e o
  // Playwright o resolveria para o `dist`, que a esteira não constrói (correção 2026-10-03-e2e-sem-dist-do-shared). Se
  // divergirem da API, a página pública não acha o código e o `turma-publica.spec.ts` reprova.
  const token = randomBytes(BYTES_DO_TOKEN_DE_CONVITE).toString('base64url')
  const codigo = Array.from({ length: TAMANHO_DO_CODIGO_DA_TURMA }, () => ALFABETO_DO_CODIGO_DA_TURMA.charAt(randomInt(ALFABETO_DO_CODIGO_DA_TURMA.length))).join('')
  const chave = new TextEncoder().encode(valorObrigatorio(lerAmbienteDeTeste(), 'SALA_CHAVE_CODIGO'))
  const codigoHmac = createHmac('sha256', chave).update(normalizarCodigoDaTurma(codigo)).digest('base64url')
  await comBanco(async (banco) => {
    const { rows } = await banco.query<{ ano_letivo_id: string }>('select ano_letivo_id from turma where escola_id = $1 and id = $2', [escolaId, turmaId])
    const anoLetivoId = rows[0]?.ano_letivo_id
    if (anoLetivoId === undefined) throw new Error('turma do e2e não encontrada')
    await banco.query('update acesso_turma set revogado_em = now() where escola_id = $1 and turma_id = $2 and revogado_em is null', [escolaId, turmaId])
    await banco.query("insert into acesso_turma (escola_id, ano_letivo_id, turma_id, token_hash, codigo_hmac, validade_dias, expira_em) values ($1, $2, $3, $4, $5, 7, now() + interval '7 days')", [
      escolaId,
      anoLetivoId,
      turmaId,
      hashDoToken(token),
      codigoHmac,
    ])
  })
  return { token, codigo }
}

/** Os pedidos pendentes da turma, pela chave de envio: é o que prova que o reenvio com a mesma chave não dobra o pedido. */
export async function pedidosPendentesDaTurma(escolaId: string, turmaId: string): Promise<number> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ total: string }>("select count(*) as total from reivindicacao where escola_id = $1 and turma_id = $2 and estado = 'pendente'", [escolaId, turmaId])
    return Number(rows[0]?.total ?? 0)
  })
}

/** Outro aluno pede o nome com a página aberta, direto no banco: o nome deixa de ser livre, e a lista relida não o traz. */
export async function tomarNomeNoBanco(escolaId: string, listaNomeId: string): Promise<void> {
  await comBanco(async (banco) => {
    const { rowCount } = await banco.query("update lista_nome set estado = 'reivindicado' where escola_id = $1 and id = $2", [escolaId, listaNomeId])
    // Sem a linha, o teste seguiria com o nome livre e não provaria a corrida que diz provar.
    if (rowCount !== 1) throw new Error('o nome do e2e não foi tomado: id da lista não encontrado')
  })
}

/** Um incidente de teste (F3, 10.0): o aviso que a operação registraria pelo `ops:incidente`, gravado direto no banco. */
export interface IncidenteDeTeste {
  /** As escolas afetadas: uma seção para cada. */
  readonly escolas: readonly string[]
  /** O que a seção diz em `circunstancias`. Os testes põem uma marca única aqui, para achar o aviso na tela. */
  readonly circunstancias?: string
  readonly contencao?: string
  readonly correcao?: string
  readonly titularesEstimados?: number
  readonly risco?: 'baixo' | 'relevante' | 'alto'
  readonly categorias?: readonly string[]
  /** Há quantas horas a Turmma soube. Sem isto, 2. */
  readonly conhecidoHaHoras?: number
  /** A seção já nasce confirmada: é o segundo dado que mostra que a tela separa quem espera de quem já foi confirmado. */
  readonly confirmado?: boolean
}

/**
 * Registra o incidente direto no banco, como o `ops:incidente registrar` o deixa: a linha global e uma seção por escola, com os
 * números e os textos dela. `incidente` é global e o banco de teste acumula, então toda escola do teste é nova e o texto leva uma
 * marca única. Devolve o id da seção de cada escola, que é o que a coordenação vê e confirma.
 */
export async function criarIncidenteNoBanco(dados: IncidenteDeTeste): Promise<Readonly<Record<string, string>>> {
  return comBanco(async (banco) => {
    const horas = dados.conhecidoHaHoras ?? 2
    const incidenteId = await id(
      banco,
      "insert into incidente (conhecido_em, registrado_por, registrado_em) values (now() - ($1 || ' hours')::interval, 'equipe-de-teste', now()) returning id",
      [String(horas)],
    )
    const secoes: Record<string, string> = {}
    for (const escolaId of dados.escolas) {
      secoes[escolaId] = await id(
        banco,
        `insert into incidente_escola (incidente_id, escola_id, circunstancias, categorias, titulares_estimados, risco, contencao, correcao, confirmado_em)
         values ($1, $2, $3, $4, $5, $6, $7, $8, ${dados.confirmado === true ? 'now()' : 'null'}) returning id`,
        [
          incidenteId,
          escolaId,
          dados.circunstancias ?? 'Acesso indevido ao armazenamento de arquivos por uma credencial vazada.',
          dados.categorias ?? ['cadastro', 'conversa_do_aluno'],
          dados.titularesEstimados ?? 120,
          dados.risco ?? 'relevante',
          dados.contencao ?? 'A credencial foi revogada e o acesso foi bloqueado.',
          dados.correcao ?? 'Todas as credenciais estão sendo trocadas.',
        ],
      )
    }
    return secoes
  })
}

/** Quem confirmou o aviso e quando, como a API deixou na seção: o que o teste confere depois de a tela confirmar. */
export async function confirmacaoDoIncidenteNoBanco(secaoId: string): Promise<{ readonly confirmadoEm: Date | null; readonly confirmadoPor: string | null }> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ confirmado_em: Date | null; confirmado_por: string | null }>('select confirmado_em, confirmado_por from incidente_escola where id = $1', [secaoId])
    const linha = rows[0]
    if (linha === undefined) throw new Error('a seção do incidente não existe')
    return { confirmadoEm: linha.confirmado_em, confirmadoPor: linha.confirmado_por }
  })
}

/** O pedido do titular como o banco o guarda: é o que o teste confere depois do clique, sem confiar no que a tela diz. */
export interface PedidoDoTitularNoBanco {
  readonly id: string
  readonly titularId: string
  readonly papelTitular: string
  readonly tipo: string
  readonly solicitante: string
  readonly chegouEm: string
  readonly estado: string
  readonly chaveEnvio: string
  readonly registradoPor: string
}

/** Os pedidos do titular da escola, do mais antigo ao mais novo (F3, 16.0). */
export async function pedidosDoTitularNoBanco(escolaId: string): Promise<PedidoDoTitularNoBanco[]> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{
      id: string
      titular_id: string
      papel_titular: string
      tipo: string
      solicitante: string
      chegou_em: string
      estado: string
      chave_envio: string
      registrado_por: string
    }>(
      "select id, titular_id, papel_titular, tipo, solicitante, to_char(chegou_em, 'YYYY-MM-DD') as chegou_em, estado, chave_envio, registrado_por from pedido_titular where escola_id = $1 order by id",
      [escolaId],
    )
    return rows.map((linha) => ({
      id: linha.id,
      titularId: linha.titular_id,
      papelTitular: linha.papel_titular,
      tipo: linha.tipo,
      solicitante: linha.solicitante,
      chegouEm: linha.chegou_em,
      estado: linha.estado,
      chaveEnvio: linha.chave_envio,
      registradoPor: linha.registrado_por,
    }))
  })
}

/**
 * Pedidos já registrados de um titular, direto no banco, do mais antigo ao mais novo: o da posição `i` chegou
 * `maisRecenteHaDias + quantidade - 1 - i` dias antes de hoje (o dia de São Paulo, o mesmo de `hoje()` e do que a API aceita como chegada:
 * entre 21h e meia-noite, o `current_date` do banco, em UTC, já é o dia seguinte), e o id (uuidv7) segue a ordem de inserção. Atalho só do e2e: o pedido de
 * verdade nasce pela tela (16.0), que é onde o teste dele o registra.
 */
export async function criarPedidosDoTitularNoBanco(escolaId: string, titularId: string, registradoPor: string, quantidade: number, maisRecenteHaDias = 0): Promise<void> {
  await comBanco(async (banco) => {
    for (let posicao = 0; posicao < quantidade; posicao += 1) {
      await banco.query(
        `insert into pedido_titular (escola_id, titular_id, papel_titular, tipo, solicitante, chegou_em, estado, compartilhamento, registrado_por, chave_envio)
         values ($1, $2, 'aluno', 'acesso', 'titular', (now() at time zone 'America/Sao_Paulo')::date - $3::int, 'recebido', '[]'::jsonb, $4, $5)`,
        [escolaId, titularId, maisRecenteHaDias + quantidade - 1 - posicao, registradoPor, randomUUID()],
      )
    }
  })
}

/**
 * Um pedido concluído de alguém que já não existe: o `usuario` do titular foi apagado e o pedido ficou só com os ids, que é o
 * que a eliminação deixa (F3, RF14 e RF15). Devolve o id do pedido.
 */
export async function criarPedidoDeTitularEliminadoNoBanco(escolaId: string, registradoPor: string, chegouHaDias = 9): Promise<string> {
  return comBanco(async (banco) => {
    const titularId = await id(banco, "insert into usuario (escola_id, papel, nome, introducao_vista_em) values ($1, 'aluno', $2, now()) returning id", [escolaId, `Eliminada ${randomUUID().slice(0, 8)}`])
    const pedidoId = await id(
      banco,
      `insert into pedido_titular (escola_id, titular_id, papel_titular, tipo, solicitante, chegou_em, estado, compartilhamento, registrado_por, chave_envio, concluido_em, concluido_por)
       values ($1, $2, 'aluno', 'eliminacao', 'responsavel_legal', (now() at time zone 'America/Sao_Paulo')::date - $5::int, 'concluido', '[]'::jsonb, $3, $4, now(), $3) returning id`,
      [escolaId, titularId, registradoPor, randomUUID(), chegouHaDias],
    )
    await banco.query('delete from usuario where escola_id = $1 and id = $2', [escolaId, titularId])
    return pedidoId
  })
}

/** O que o teste do detalhe do pedido semeia (F3, 17.0): o que muda de um pedido para outro, com o resto no valor de sempre. */
export interface PedidoDoTitularSemeado {
  readonly escolaId: string
  readonly titularId: string
  readonly registradoPor: string
  readonly tipo: 'acesso' | 'portabilidade' | 'compartilhamento' | 'correcao' | 'eliminacao'
  readonly estado: 'recebido' | 'em_preparacao' | 'pronto' | 'agendado' | 'concluido' | 'cancelado'
  /** Quantos dias antes de hoje o pedido chegou à escola: é o que o prazo do detalhe conta. */
  readonly chegouHaDias?: number
  readonly solicitante?: 'titular' | 'responsavel_legal'
  /** O papel da pessoa na escola: o aluno é o padrão, e o professor tem a mesma tela de "Meus dados" (F3, 18.0). */
  readonly papelDoTitular?: 'aluno' | 'professor'
  /** A foto do compartilhamento, como o `POST pedidos` a grava. */
  readonly compartilhamento?: readonly {
    readonly suboperadorId: string | null
    readonly chave: string
    readonly primeiroEm: string
    readonly ultimoEm: string
    readonly origem: 'rastro' | 'periodo'
  }[]
}

/**
 * Um pedido do titular com o estado e a chegada que o teste quer, direto no banco: atalho só do e2e para o que o
 * relógio ou o worker levariam dias ou minutos para produzir. O pedido que passa pelo caminho de verdade nasce pela tela
 * (16.0). Concluído ou cancelado leva o autor e a data, como o check do banco exige. Devolve o id.
 */
export async function criarPedidoDoTitularNoBanco(pedido: PedidoDoTitularSemeado): Promise<string> {
  return comBanco((banco) =>
    id(
      banco,
      `insert into pedido_titular (escola_id, titular_id, papel_titular, tipo, solicitante, chegou_em, estado, compartilhamento, registrado_por, chave_envio, eliminar_em, concluido_em, concluido_por, cancelado_em, cancelado_por)
       values ($1, $2, $10, $3, $4, (now() at time zone 'America/Sao_Paulo')::date - $5::int, $6, $7::jsonb, $8, $9,
               case when $6 = 'agendado' then now() + interval '6 days' end,
               case when $6 = 'concluido' then now() end, case when $6 = 'concluido' then $8::uuid end,
               case when $6 = 'cancelado' then now() end, case when $6 = 'cancelado' then $8::uuid end) returning id`,
      [
        pedido.escolaId,
        pedido.titularId,
        pedido.tipo,
        pedido.solicitante ?? 'titular',
        pedido.chegouHaDias ?? 0,
        pedido.estado,
        JSON.stringify(pedido.compartilhamento ?? []),
        pedido.registradoPor,
        randomUUID(),
        pedido.papelDoTitular ?? 'aluno',
      ],
    ),
  )
}

/** O estado do pedido no banco, e quem o concluiu ou cancelou: o que o clique fez, conferido por fora da tela. */
export async function situacaoDoPedidoNoBanco(escolaId: string, pedidoId: string): Promise<{ readonly estado: string; readonly concluidoPor: string | null; readonly canceladoPor: string | null }> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ estado: string; concluido_por: string | null; cancelado_por: string | null }>(
      'select estado, concluido_por, cancelado_por from pedido_titular where escola_id = $1 and id = $2',
      [escolaId, pedidoId],
    )
    const linha = rows[0]
    if (linha === undefined) throw new Error('o pedido não existe no banco')
    return { estado: linha.estado, concluidoPor: linha.concluido_por, canceladoPor: linha.cancelado_por }
  })
}

/** Outra pessoa da coordenação, ou o worker, muda o estado do pedido com a tela aberta: o teste do recomeço. */
export async function mudarEstadoDoPedidoNoBanco(escolaId: string, pedidoId: string, estado: PedidoDoTitularSemeado['estado']): Promise<void> {
  await comBanco(async (banco) => {
    await banco.query('update pedido_titular set estado = $3 where escola_id = $1 and id = $2', [escolaId, pedidoId, estado])
  })
}

/**
 * O arquivo montado do pedido, como o worker o deixa (F3, 13.0), direto no banco e **sem o objeto no armazém**: serve às
 * telas que só mostram o estado dele ("pronto para baixar", "disponível até") e ao diálogo de baixar com a API simulada na
 * resposta. Pronto há 1 dia, válido por mais 6 dias (7 no total). O download de verdade é o do worker e do armazém.
 */
export async function criarArquivoDoTitularNoBanco(escolaId: string, pedidoId: string): Promise<void> {
  await comBanco(async (banco) => {
    await banco.query(
      `insert into arquivo_titular (escola_id, pedido_id, versao, chave_objeto, bytes, pronto_em, expira_em)
       values ($1::uuid, $2::uuid, 'completa', $3, 120, now() - interval '1 day', now() + interval '6 days')`,
      [escolaId, pedidoId, `titular/${escolaId}/${pedidoId}/completa.json`],
    )
  })
}

/**
 * O arquivo do pedido que a escola apagou (a expiração ou a eliminação, F3, 13.0), direto no banco: o que levaria 7 dias.
 * `apagado_em` é o que a API lê como "expirado" (`situacao`), e o `baixar` passa a responder `NAO_ENCONTRADO` (18.0).
 */
export async function apagarArquivoDoTitularNoBanco(escolaId: string, pedidoId: string): Promise<void> {
  await comBanco(async (banco) => {
    const { rowCount } = await banco.query('update arquivo_titular set apagado_em = now() where escola_id = $1 and pedido_id = $2', [escolaId, pedidoId])
    if (rowCount === 0) throw new Error('o pedido não tem arquivo no banco')
  })
}

/** O nome que o cadastro da escola tem hoje: a correção do nome se confere aqui, e não no que a tela diz. */
export async function nomeDoUsuarioNoBanco(escolaId: string, usuarioId: string): Promise<string> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ nome: string }>('select nome from usuario where escola_id = $1 and id = $2', [escolaId, usuarioId])
    const linha = rows[0]
    if (linha === undefined) throw new Error('o usuário não existe no banco')
    return linha.nome
  })
}

/** Uma linha da auditoria do pedido: a ação, quem a fez, a finalidade e o que ficou registrado. */
export interface LinhaDaAuditoriaDoPedido {
  readonly acao: string
  readonly autor: string | null
  readonly finalidade: string | null
  readonly antes: unknown
  readonly depois: unknown
}

/** A auditoria da escola sobre o pedido, em ordem: `pedido.lido`, `pedido.concluido`, `titular.arquivo_baixado`… */
export async function auditoriaDoPedidoNoBanco(escolaId: string, pedidoId: string): Promise<LinhaDaAuditoriaDoPedido[]> {
  return comBanco(async (banco) => {
    const { rows } = await banco.query<{ acao: string; autor: string | null; finalidade: string | null; antes: unknown; depois: unknown }>(
      'select acao, autor_usuario_id as autor, finalidade, antes, depois from auditoria where escola_id = $1 and entidade_id = $2 order by em, id',
      [escolaId, pedidoId],
    )
    return rows
  })
}
