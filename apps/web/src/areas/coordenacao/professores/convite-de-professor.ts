import {
  ErrorCode,
  cadastrarProfessorRequestSchema,
  REFAZER_CONVITE_DE_PROFESSOR_POR_ESTADO,
  REVOGAR_CONVITE_DE_PROFESSOR_POR_ESTADO,
  VALIDADE_DO_CONVITE_HORAS_POR_TIPO,
  type EstadoDoProfessor,
  type CadastrarProfessorRequest,
} from '@educa/shared'
import type { FalhaDoConvite } from '../../../components/DialogoDoConvite'
import { pedidoDeConvitePelo, type ValidacaoDoConvite } from '../../../components/pedido-de-convite'
import type { StatusFamily } from '../../../components/ui/StatusBadge'
import { listChanged, errorText } from '../../../components/error-text'
import { TEXTO_DO_CONVITE_QUE_MUDOU, TEXTO_DO_CONVITE_QUE_NAO_VALE } from '../../../components/textos-do-convite'

/**
 * O convite do professor na tela Professores (A1, 14.0; RF6): o que a lista diz de cada estado, as ações que cada estado
 * oferece no painel dele (X2, 6.0), o pedido do cadastro e o texto de cada falha. Sem React aqui, para a regra ter teste de unidade.
 */

/**
 * O estado do professor como a coordenação o lê, em texto (regra 50, item 11), com o próximo passo quando há um. O
 * `aceito` junta quem já entrou e quem ainda espera a primeira entrada: a lista não os separa, para não dizer se o e-mail
 * tinha conta em outra escola (E11). A lista não traz o e-mail; quem foi revogado ou desativado volta pelo cadastro, com
 * o mesmo e-mail.
 */
export const TEXTO_DO_ESTADO_DO_PROFESSOR: Readonly<Record<EstadoDoProfessor, string>> = {
  pendente: 'Convite em aberto, ainda não aceito.',
  vencido: 'Convite vencido. Refaça o convite para gerar um link novo.',
  revogado: 'Convite revogado. Para convidar de novo, cadastre o mesmo e-mail.',
  aceito: 'Convite aceito.',
  ativo: 'Ativo.',
  desativado: 'Desativado. Para convidar de novo, cadastre o mesmo e-mail.',
}

/**
 * A família do selo de cada estado (X2, 6.0; `docs/interface.md` 9.1): o que espera a pessoa é `pendente`, o convite vencido é `erro`, quem
 * entrou é `ok`, e o convite revogado e o professor desativado são `info`, sem urgência. O texto do selo é o de cima: a cor nunca diz sozinha.
 */
export const FAMILIA_DO_ESTADO_DO_PROFESSOR: Readonly<Record<EstadoDoProfessor, StatusFamily>> = {
  pendente: 'pendente',
  vencido: 'erro',
  revogado: 'info',
  aceito: 'ok',
  ativo: 'ok',
  desativado: 'info',
}

/** As duas ações do convite do professor, no painel dele. Cadastrar é da tela, e não de um professor. */
export type AcaoDoConviteDeProfessor = 'refazer' | 'revogar'

/**
 * As ações que o painel do professor oferece, na ordem em que aparecem, pelas matrizes de `@educa/shared` — as mesmas
 * pelas quais o servidor decide. Quem recusa é o servidor; a tela só não oferece o que ele recusaria.
 */
export function acoesDoConviteDeProfessor(estado: EstadoDoProfessor): readonly AcaoDoConviteDeProfessor[] {
  const acoes: AcaoDoConviteDeProfessor[] = []
  if (REFAZER_CONVITE_DE_PROFESSOR_POR_ESTADO[estado] === 'refazer') acoes.push('refazer')
  if (REVOGAR_CONVITE_DE_PROFESSOR_POR_ESTADO[estado] === 'revogar') acoes.push('revogar')
  return acoes
}

/** O prazo do convite do professor em dias, do mesmo número que a API grava em `expira_em`. */
const VALIDADE_EM_DIAS = VALIDADE_DO_CONVITE_HORAS_POR_TIPO.professor / 24

/** O que é dito do link, antes de gerar e depois: vale 7 dias, entra uma vez, e aparece uma vez só. */
export const TEXTO_DA_VALIDADE_DO_CONVITE = `O convite vale ${String(VALIDADE_EM_DIAS)} dias e entra uma vez só.`
export const TEXTO_DO_LINK_UMA_VEZ = 'O link aparece uma vez, logo depois de gerar. Copie e mande à pessoa antes de fechar.'

const PELO_NOME = new Intl.Collator('pt-BR', { sensitivity: 'base' })

/** O nome sem os espaços das pontas e com um espaço só entre as palavras: "Maria  Silva" é "Maria Silva". */
const semEspacoSobrando = (nome: string) => nome.trim().replace(/\s+/g, ' ')

/**
 * Já há na lista um professor com este nome? Sem contar maiúscula nem acento ("jose silva" é "José Silva"), nem espaço
 * sobrando. A lista só mostra o nome (E11), e duas linhas iguais levam o link refeito de uma pessoa à outra. É um aviso, e
 * não uma garantia: só enxerga a lista que a tela leu.
 */
export function temHomonimo(professores: ReadonlyArray<{ readonly nome: string }>, nome: string): boolean {
  return professores.some((professor) => PELO_NOME.compare(semEspacoSobrando(professor.nome), semEspacoSobrando(nome)) === 0)
}

/**
 * O aviso do nome repetido, no resumo antes de cadastrar. Não impede: dois professores podem ter o mesmo nome, e quem foi
 * revogado ou desativado volta pelo cadastro com o mesmo e-mail e o mesmo nome, na mesma linha. A tela não sabe qual dos
 * dois casos é (a lista não traz e-mail), e o texto cobre os dois.
 */
export const TEXTO_DO_NOME_REPETIDO =
  'Já há um professor com este nome na lista. Se é a mesma pessoa voltando, pode seguir. Se é outra, acrescente um sobrenome: a lista mostra só o nome.'

/** O pedido de `POST /v1/professores`, pelo mesmo contrato estrito da API: é o que o resumo mostra e o que sai. */
export function pedidoDeProfessor(campos: { readonly nome: string; readonly email: string }): ValidacaoDoConvite<CadastrarProfessorRequest> {
  return pedidoDeConvitePelo(cadastrarProfessorRequestSchema, campos)
}

/**
 * O `CONFLITO` do cadastro: o e-mail é de um professor ativo na escola, ou com convite em aberto. A lista não mostra
 * e-mail, e o texto não diz de quem é: manda conferir o que foi digitado, e aponta o Refazer para o link novo.
 */
export const TEXTO_DO_EMAIL_JA_CADASTRADO =
  'Este e-mail já é de um professor desta escola, ativo ou com o convite em aberto. Confira o e-mail; para um link novo, use Refazer na lista.'

/**
 * O texto da falha do cadastro. O `CONFLITO` é do e-mail digitado: a pessoa volta e corrige, e por isso o diálogo
 * continua com os botões (`listChanged` falso). O resto (429, 503) é o texto do catálogo, e o mesmo botão tenta de novo.
 */
export function falhaDoCadastroDeProfessor(erro: unknown): FalhaDoConvite {
  return { texto: errorText(erro, { [ErrorCode.CONFLITO]: TEXTO_DO_EMAIL_JA_CADASTRADO }), listaMudou: false }
}

/**
 * O texto do `CONFLITO` e do `NAO_ENCONTRADO` do refazer e do revogar, que dizem que o convite daquela linha mudou: os
 * mesmos do convite da coordenação, na operação (`components/textos-do-convite.ts`).
 */
export const TEXTOS_DO_CONVITE_QUE_MUDOU: Readonly<Partial<Record<ErrorCode, string>>> = {
  [ErrorCode.CONFLITO]: TEXTO_DO_CONVITE_QUE_MUDOU,
  [ErrorCode.NAO_ENCONTRADO]: TEXTO_DO_CONVITE_QUE_NAO_VALE,
}

/**
 * O texto da falha do refazer, e se a lista deixou de valer: no `CONFLITO` e no `NAO_ENCONTRADO` ela recarrega, e sobra
 * só "Fechar". O resto é o texto do catálogo, e o mesmo botão tenta de novo. Nenhum texto diz o código.
 */
export function falhaDoRefazerConviteDeProfessor(erro: unknown): FalhaDoConvite {
  return { texto: errorText(erro, TEXTOS_DO_CONVITE_QUE_MUDOU), listaMudou: listChanged(erro, [ErrorCode.CONFLITO, ErrorCode.NAO_ENCONTRADO]) }
}
