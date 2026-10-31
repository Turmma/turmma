import { artefato } from '../artefato.js'
import { atividadeAplicada } from '../atividade-aplicada.js'
import { consumoIa } from '../consumo-ia.js'
import { correcao } from '../correcao.js'
import { entrega } from '../entrega.js'
import { execucaoAgente } from '../execucao-agente.js'
import { material } from '../material.js'
import { mensagemAgente } from '../mensagem-agente.js'
import { mensagemTutor } from '../mensagem-tutor.js'
import { respostaAtividade } from '../resposta-atividade.js'
import { resumoDoAnalista } from '../resumo-do-analista.js'
import { sinalTutor } from '../sinal-tutor.js'
import { suspensaoDeFuncao } from '../suspensao-de-funcao.js'
import { tentativaAtividade } from '../tentativa-atividade.js'
import { threadAgente } from '../thread-agente.js'
import { trecho } from '../trecho.js'
import { validacaoDoLote } from '../validacao-do-lote.js'

/**
 * As dezessete tabelas do MVP de apresentação (migration 0022; `docs/mvp-contratos.md`), num lugar só, para o pacote
 * exportá-las com uma linha (`export * from './db/schema/mvp/tabelas.js'` no `index.ts`) e para o `schema` do drizzle
 * recebê-las com `...mvpTables` (`db/banco.ts`).
 *
 * Fica nesta subpasta de propósito: o `drizzle.config.ts` lê `schema/*.ts`, e um arquivo ali que reexportasse as tabelas
 * as faria aparecer duas vezes na geração da migration.
 */
export { artefato, atividadeAplicada, consumoIa, correcao, entrega, execucaoAgente, material, mensagemAgente, mensagemTutor, respostaAtividade, resumoDoAnalista, sinalTutor, suspensaoDeFuncao, tentativaAtividade, threadAgente, trecho, validacaoDoLote }

export const mvpTables = {
  material,
  trecho,
  consumoIa,
  threadAgente,
  mensagemAgente,
  execucaoAgente,
  entrega,
  artefato,
  atividadeAplicada,
  tentativaAtividade,
  respostaAtividade,
  correcao,
  validacaoDoLote,
  mensagemTutor,
  sinalTutor,
  suspensaoDeFuncao,
  resumoDoAnalista,
}
