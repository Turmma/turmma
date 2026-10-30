// Violações de propósito fora de um *.repository.ts, de teste e de packages/nucleo/src/db. Toda linha marcada com
// "reprova:" precisa sair com a regra citada; linha sem marca não pode sair com guarda nenhuma.
// Fora daqueles lugares, do @educa/nucleo só se importa pelo nome o que não leva tabela, e o texto do pacote não aparece em
// nenhum outro ponto do código. O uso depois do import não reprova de novo.
import { escola } from '@educa/nucleo' // reprova: guardas/tabela-so-no-repository
import { usuario as apelido } from '@educa/nucleo' // reprova: guardas/tabela-so-no-repository
import type { turma } from '@educa/nucleo' // reprova: guardas/tabela-so-no-repository
import { vinculo, type suspensaoDeFuncao, disciplina } from '@educa/nucleo' // reprova: guardas/tabela-so-no-repository, guardas/tabela-so-no-repository, guardas/tabela-so-no-repository
import { 'serie' as comoTexto } from '@educa/nucleo' // reprova: guardas/tabela-so-no-repository
import { schema, schema as esquema } from '@educa/nucleo' // reprova: guardas/tabela-so-no-repository, guardas/tabela-so-no-repository
import { default as padrao } from '@educa/nucleo' // reprova: guardas/tabela-so-no-repository
import type { Schema } from '@educa/nucleo' // reprova: guardas/tabela-so-no-repository
import doNucleo from '@educa/nucleo' // reprova: guardas/tabela-so-no-repository
import * as nucleo from '@educa/nucleo' // reprova: guardas/tabela-so-no-repository
import type * as tiposDoNucleo from '@educa/nucleo' // reprova: guardas/tabela-so-no-repository
import nucleoPorRequire = require('@educa/nucleo') // reprova: guardas/tabela-so-no-repository
import { conta as daSubpasta } from '@educa/nucleo/ciclo-de-vida' // reprova: guardas/tabela-so-no-repository
import * as cicloDeVida from '@educa/nucleo/ciclo-de-vida' // reprova: guardas/tabela-so-no-repository
import { requireEscolaId, type Database } from '@educa/nucleo'
import { CicloDeVidaService } from '@educa/nucleo/ciclo-de-vida'
import '@educa/nucleo'
import { escola as deOutroNucleo } from '@educa/nucleo-legado'
import * as outroPacote from 'outro-pacote'
import { schema as esquemaDeOutro, default as padraoDeOutro } from 'outro-pacote'
import { sessao } from 'outro-pacote'
import moduloDeOutro = require('outro-pacote')

export { rede } from '@educa/nucleo' // reprova: guardas/tabela-so-no-repository
export { conta as contaReexportada } from '@educa/nucleo' // reprova: guardas/tabela-so-no-repository
export type { convite } from '@educa/nucleo' // reprova: guardas/tabela-so-no-repository
export { schema } from '@educa/nucleo' // reprova: guardas/tabela-so-no-repository
export { schema as todasAsTabelas } from '@educa/nucleo' // reprova: guardas/tabela-so-no-repository
export { default as moduloPadrao } from '@educa/nucleo' // reprova: guardas/tabela-so-no-repository
export { usuario as daSubpastaReexportado } from '@educa/nucleo/auditoria' // reprova: guardas/tabela-so-no-repository
export * from '@educa/nucleo' // reprova: guardas/tabela-so-no-repository
export * as todoOPacote from '@educa/nucleo' // reprova: guardas/tabela-so-no-repository
export type * from '@educa/nucleo' // reprova: guardas/tabela-so-no-repository
export * as deOutroPacote from 'outro-pacote'
export * from 'outro-pacote'
export { requireAnoEmCurso } from '@educa/nucleo'
export { registroAcesso, schema as esquemaReexportadoDeOutro } from 'outro-pacote'

const trecho = 1
export { trecho }

declare const especificadorEmVariavel: string
declare const condicao: boolean
export const dinamicos = async () => [
  await import('@educa/nucleo'), // reprova: guardas/tabela-so-no-repository
  await import(`@educa/nucleo/auditoria`), // reprova: guardas/tabela-so-no-repository
  require('@educa/nucleo'), // reprova: guardas/tabela-so-no-repository
  require.resolve('@educa/nucleo'), // reprova: guardas/tabela-so-no-repository
  createRequire(import.meta.url)('@educa/nucleo'), // reprova: guardas/tabela-so-no-repository
  module.require('@educa/nucleo/ciclo-de-vida'), // reprova: guardas/tabela-so-no-repository
  carregar('@educa/nucleo'), // reprova: guardas/tabela-so-no-repository
  import('@educa/nucleo' as string), // reprova: guardas/tabela-so-no-repository
  require('@educa/nucleo' satisfies string), // reprova: guardas/tabela-so-no-repository
  require('@educa/nucleo'!), // reprova: guardas/tabela-so-no-repository
  require(<string>'@educa/nucleo'), // reprova: guardas/tabela-so-no-repository
  require.call(null, '@educa/nucleo'), // reprova: guardas/tabela-so-no-repository
  Reflect.apply(require, null, ['@educa/nucleo']), // reprova: guardas/tabela-so-no-repository
  ['@educa/nucleo/ciclo-de-vida'].map(require), // reprova: guardas/tabela-so-no-repository
  require(condicao ? '@educa/nucleo' : 'outro-pacote'), // reprova: guardas/tabela-so-no-repository
  require((0, '@educa/nucleo')), // reprova: guardas/tabela-so-no-repository
  require`@educa/nucleo`, // reprova: guardas/tabela-so-no-repository
  new Carregador('@educa/nucleo'), // reprova: guardas/tabela-so-no-repository
  await import('outro-pacote'),
  require('outro-pacote'),
  createRequire(import.meta.url)('outro-pacote'),
  require(),
  carregar(1, 'outro-pacote'),
  Reflect.apply(require, null, ['outro-pacote']),
  require(condicao ? 'outro-pacote' : '@educa/nucleo-legado'),
  // O pacote que não está escrito como texto é o limite declarado: em variável, montado, ou só num comentário.
  await import(especificadorEmVariavel),
  require('@educa/' + 'nucleo'),
  import(`@educa/${'nucleo'}`),
  // require('@educa/nucleo')
]
const textoDoPacote = '@educa/nucleo' // reprova: guardas/tabela-so-no-repository
type TudoDoNucleo = typeof import('@educa/nucleo') // reprova: guardas/tabela-so-no-repository
type DaSubpasta = typeof import('@educa/nucleo/ciclo-de-vida') // reprova: guardas/tabela-so-no-repository
type TudoDeOutro = typeof import('outro-pacote')

// O uso depois do import que já reprovou não reprova de novo: a guarda não segue valor.
export const depoisDoImport = [nucleo.escola, nucleo.schema.turma, schema.escola, esquema['usuario'], padrao, doNucleo, nucleoPorRequire]
type PeloTipo = typeof tiposDoNucleo.vinculo | typeof nucleo.schema.escola
const { escola: desestruturada, ...resto } = nucleo

export type { TudoDoNucleo, DaSubpasta, TudoDeOutro, PeloTipo, Schema }
export { textoDoPacote }
export { escola, apelido, vinculo, disciplina, comoTexto, requireEscolaId, sessao, daSubpasta, cicloDeVida, CicloDeVidaService }
export { deOutroNucleo, outroPacote, esquemaDeOutro, padraoDeOutro, moduloDeOutro, desestruturada, resto }
export type { turma, suspensaoDeFuncao, Database }
