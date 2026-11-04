import { createHash } from 'node:crypto'
import {
  CABECALHOS_DA_PLANILHA,
  ErrorCode,
  MAXIMO_DE_LINHAS_DA_PLANILHA_DE_PROFESSORES,
  TAMANHO_MAXIMO_NOME_DIGITADO,
  emailConvidadoSchema,
  type CandidatoDaMarca,
  type EstadoDoProfessor,
  type MarcasDaPlanilha,
  type PreviaDaPlanilhaRow,
  type ResumoDaImportacao,
} from '@educa/shared'
import { z } from 'zod'
import { CicloDeVidaRepository } from '../../ciclo-de-vida/ciclo-de-vida.repository.js'
import { ConviteDaEscolaRepository } from '../../convite/convite-da-escola.repository.js'
import { convidarProfessorDaPlanilha } from '../../convite/convidar-professor-da-planilha.js'
import { DomainException } from '../../error/domain.exception.js'
import { ContaDaPlanilhaPerdidaError, DiferencaNaPlanilhaError } from '../erros.js'
import type { ProfessorDaEscola } from '../importacao.repository.js'
import { lerTabela } from '../leitor.js'
import type { ContasDoJob, PlanoDaImportacao, PreviaDoTipo, TipoSemAno } from '../tipo.js'

/**
 * A planilha de professores (F2, 6.0, RF6; Tech Spec, seção 5, "Planilha" e "Gravar"): nome e e-mail de cada professor, até 300
 * linhas. Gravar cadastra `pendente` pelo `convidar` da A1, com o token descartado, e o convite para copiar sai depois, pelo
 * "Copiar link" da lista. Quem fica de fora da planilha segue ativo, e só sai com a marca da coordenação, pelo `desativar`.
 *
 * - **A escola sabe quem é professor dela pelo `usuario`, nunca pela `conta`.** Conta de outra escola cliente com o mesmo e-mail
 *   não aparece na prévia, no `resumo` nem na auditoria: a linha é "entra" do mesmo jeito (E11 da A1). A conta global só é
 *   achada ou criada no passo (1) do job, e ganha o segundo vínculo no aceite do convite.
 * - **Quem "entra":** o e-mail sem professor na escola, ou de professor com o convite `revogado` ou `desativado`, que o cadastro
 *   avulso também chama de volta. Os outros estados (`ativo`, `aceito`, `pendente`, `vencido`) são "já existe": o convite em
 *   aberto sai pelo "Revogar" ou "Copiar link" da lista, e o professor ativo não muda de nome por aqui.
 * - **Quem pode ser marcado para desligar:** só o professor ausente que o `desativar` alcança, `ativo` ou `aceito` pelo
 *   `estadoDoProfessor`. O ausente `pendente`, `vencido`, `revogado` ou `desativado` não é candidato. Quem pode ser marcado
 *   não depende de uso nem de indicador (D64, regra 70, item 9): nenhum critério de adoção entra aqui.
 */

const TIPO = 'professores'

/** O professor de uma linha: já lido, com o nome sem espaço a mais e o e-mail como a conta o guarda. */
const professorGuardadoSchema = z.strictObject({
  nome: z.string().min(1).max(TAMANHO_MAXIMO_NOME_DIGITADO),
  email: z.string().min(3),
})
const guardadoSchema = z.array(professorGuardadoSchema).max(MAXIMO_DE_LINHAS_DA_PLANILHA_DE_PROFESSORES)

type ProfessorLido = z.infer<typeof professorGuardadoSchema>

/** Os estados em que o e-mail da planilha cadastra de novo; nos outros, o professor já existe. */
const ESTADOS_QUE_ENTRAM: ReadonlySet<EstadoDoProfessor> = new Set(['revogado', 'desativado'])
/** Os estados que o `desativar` alcança: só quem pode ser marcado para sair. */
const ESTADOS_QUE_SAEM: ReadonlySet<EstadoDoProfessor> = new Set(['ativo', 'aceito'])

/** Os códigos de erro de linha: palavra de lista fechada, nunca texto com o dado da linha. */
type ErroDaLinhaDeProfessor = 'linha_incompleta' | 'acima_do_teto' | 'nome_vazio' | 'nome_invalido' | 'email_invalido'

/** O nome sem espaço a mais, ou o erro dele: não vazio, até 200 caracteres e de uma linha. */
function lerNome(texto: string): { readonly nome: string } | { readonly erro: ErroDaLinhaDeProfessor } {
  const nome = texto.replace(/\s+/g, ' ').trim()
  if (nome === '') return { erro: 'nome_vazio' }
  return nome.length > TAMANHO_MAXIMO_NOME_DIGITADO || /\p{Cc}/u.test(nome) ? { erro: 'nome_invalido' } : { nome }
}

/** O professor da linha, ou o código do primeiro erro dela. O nome vem antes do e-mail: é a ordem em que a coordenação os lê. */
function lerLinha(campos: Readonly<Record<string, string>>): ProfessorLido | ErroDaLinhaDeProfessor {
  const nome = lerNome(campos['nome'] ?? '')
  if ('erro' in nome) return nome.erro
  const email = emailConvidadoSchema.safeParse(campos['email'] ?? '')
  return email.success ? { nome: nome.nome, email: email.data } : 'email_invalido'
}

/** O que a planilha faz contra os professores da escola, por e-mail. */
interface Classificacao {
  /** Quem a planilha cadastra, em ordem de e-mail: o e-mail sem professor, ou de professor chamado de volta. */
  readonly entram: readonly ProfessorLido[]
  readonly jaExistem: number
  /** Quem pode ser marcado para desligar: professor da escola, ausente da planilha, `ativo` ou `aceito`. Em ordem de id. */
  readonly candidatos: readonly ProfessorDaEscola[]
  readonly assinatura: string
}

/**
 * Classifica os professores lidos contra os da escola. A `assinatura` resume o que a coordenação viu: cada e-mail da planilha com o
 * resultado e o usuário que o casou, e os candidatos a sair. O job só grava se, no passo (3), ela é a mesma.
 */
export function classificar(lidos: readonly ProfessorLido[], daEscola: readonly ProfessorDaEscola[]): Classificacao {
  const porEmail = new Map(daEscola.flatMap((professor) => (professor.email === null ? [] : [[professor.email, professor] as const])))
  const casados = new Set<string>()
  const entram: ProfessorLido[] = []
  const vistos: Array<readonly [string, 'entra' | 'ja_existe', string | null]> = []
  for (const lido of lidos) {
    const existente = porEmail.get(lido.email)
    if (existente !== undefined) casados.add(existente.usuarioId)
    const entra = existente === undefined || ESTADOS_QUE_ENTRAM.has(existente.estado)
    if (entra) entram.push(lido)
    vistos.push([lido.email, entra ? 'entra' : 'ja_existe', existente?.usuarioId ?? null])
  }
  const candidatos = daEscola.filter((professor) => !casados.has(professor.usuarioId) && ESTADOS_QUE_SAEM.has(professor.estado))
  const assinatura = createHash('sha256')
    .update(JSON.stringify({ planilha: [...vistos].sort(([a], [b]) => (a < b ? -1 : 1)), candidatos: candidatos.map((candidato) => candidato.usuarioId).sort() }))
    .digest('hex')
  return { entram: [...entram].sort((a, b) => (a.email < b.email ? -1 : 1)), jaExistem: lidos.length - entram.length, candidatos, assinatura }
}

/** As contagens do que a planilha faria; com as marcas (o job), entram também os desligados. */
function resumoDe({ entram, jaExistem }: Classificacao, marcas?: MarcasDaPlanilha): ResumoDaImportacao {
  return { entram: entram.length, ja_existem: jaExistem, ...(marcas === undefined ? {} : { desligados: marcas.desligar.length }) }
}

function planejarContra(lidos: readonly ProfessorLido[], daEscola: readonly ProfessorDaEscola[], marcas: MarcasDaPlanilha, contas: ContasDoJob): PlanoDaImportacao {
  const classificacao = classificar(lidos, daEscola)
  return {
    assinatura: classificacao.assinatura,
    resumo: resumoDe(classificacao, marcas),
    aplicar: async (_gravacao, { tx, ciclo }) => {
      for (const professor of classificacao.entram) {
        const contaId = contas.get(professor.email)
        if (contaId === undefined) throw new ContaDaPlanilhaPerdidaError()
        if (!(await convidarProfessorDaPlanilha(tx, { contaId, nome: professor.nome }))) throw new DiferencaNaPlanilhaError()
      }
      for (const usuarioId of [...marcas.desligar].sort()) {
        try {
          await ciclo.desativar(usuarioId, {}, tx)
        } catch (erro) {
          if (erro instanceof DomainException && erro.codigo === ErrorCode.NAO_ENCONTRADO) throw new DiferencaNaPlanilhaError()
          throw erro
        }
      }
    },
  }
}

/** Os usuários que o passo (3) escreve ou desativa: os que casam com os e-mails da planilha e os marcados. */
function usuariosDoPassoTres(lidos: readonly ProfessorLido[], daEscola: readonly ProfessorDaEscola[], marcas: MarcasDaPlanilha): string[] {
  const emails = new Set(lidos.map((lido) => lido.email))
  const casados = daEscola.filter((professor) => professor.email !== null && emails.has(professor.email)).map((professor) => professor.usuarioId)
  return [...new Set([...casados, ...marcas.desligar])].sort()
}

export const tipoProfessores: TipoSemAno = {
  tipo: TIPO,
  usaTurma: false,
  usaAno: false,

  async previa(repositorio, texto): Promise<PreviaDoTipo> {
    const tabela = lerTabela(texto, CABECALHOS_DA_PLANILHA.professores)
    const lidas = tabela.linhas.map(({ linha, campos }, posicao) => ({
      linha,
      lido: posicao >= MAXIMO_DE_LINHAS_DA_PLANILHA_DE_PROFESSORES ? ('acima_do_teto' as const) : campos === null ? ('linha_incompleta' as const) : lerLinha(campos),
    }))
    // O e-mail repetido é a mesma pessoa: a primeira linha vale, e as outras são aviso, não erro.
    const validos: ProfessorLido[] = []
    const repetidas = new Set<number>()
    const vistos = new Set<string>()
    for (const { linha, lido } of lidas) {
      if (typeof lido === 'string') continue
      if (vistos.has(lido.email)) repetidas.add(linha)
      else validos.push(lido)
      vistos.add(lido.email)
    }
    const classificacao = classificar(validos, await repositorio.professoresDaEscola())
    const entram = new Set(classificacao.entram.map((professor) => professor.email))
    const linhas = lidas.map(({ linha, lido }): PreviaDaPlanilhaRow => {
      if (typeof lido === 'string') return { linha, resultado: 'erro', erro: lido }
      if (repetidas.has(linha)) return { linha, resultado: 'ja_existe', aviso: 'email_repetido' }
      return { linha, resultado: entram.has(lido.email) ? 'entra' : 'ja_existe' }
    })
    const candidatos: CandidatoDaMarca[] = classificacao.candidatos.map((candidato) => ({ id: candidato.usuarioId, acao: 'desligar', rotulo: candidato.nome }))
    return { linhas, contagens: resumoDe(classificacao), candidatos, guardado: validos, assinatura: classificacao.assinatura }
  },

  emailsDasContas(guardado) {
    const lido = guardadoSchema.safeParse(guardado)
    return lido.success ? lido.data.map((professor) => professor.email).sort() : undefined
  },

  async travar(repositorio, tx, guardado, marcas, contas, travarContas) {
    const lido = guardadoSchema.safeParse(guardado)
    if (!lido.success) return
    await new ConviteDaEscolaRepository(tx).travarEscola()
    const ciclo = new CicloDeVidaRepository(tx)
    for (const usuarioId of [...marcas.desligar].sort()) await ciclo.travarAnosDosVinculos(usuarioId, true)
    await repositorio.travarUsuarios(usuariosDoPassoTres(lido.data, await repositorio.professoresDaEscola(), marcas))
    if (!(await travarContas(contas))) throw new ContaDaPlanilhaPerdidaError()
    await ciclo.travarContraOGerarDosProfessores([...marcas.desligar].sort())
  },

  async planejar(repositorio, guardado, marcas, contas) {
    const lido = guardadoSchema.safeParse(guardado)
    return lido.success ? planejarContra(lido.data, await repositorio.professoresDaEscola(), marcas, contas) : undefined
  },
}
