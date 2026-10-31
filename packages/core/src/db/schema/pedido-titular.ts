import type { Compartilhamento, EstadoDoPedido, PapelDoTitular, SolicitanteDoPedido, TipoDePedidoDoTitular } from '@educa/shared'
import { sql } from 'drizzle-orm'
import { boolean, check, index, jsonb, pgTable, text, timestamp, unique, uniqueIndex, uuid, date } from 'drizzle-orm/pg-core'
import { escola } from './escola.js'

/**
 * O pedido do titular à escola (F3, RF10 a RF16; Tech Spec do F3, seções 3, 4 e 5; `docs/lgpd.md`, "Pedido do
 * titular"). A coordenação registra e conduz o pedido de acesso, portabilidade, compartilhamento, correção ou
 * eliminação de um aluno ou de um professor, e o pedido guarda só id, tipo, quem pediu, datas, estado, autor e a foto
 * do compartilhamento: **nenhuma coluna de nome, matrícula ou texto**. O nome do titular vive no `usuario`, e a lista e
 * o detalhe o trazem só enquanto ele existe ("Titular eliminado" depois).
 *
 * - **`titular_id` e `registrado_por` não têm FK**, como o autor da auditoria (migration 0013): a eliminação da pessoa
 *   apaga o `usuario` e o pedido fica pela retenção legal, com os ids. O gatilho de inserção
 *   (`exigir_usuario_da_escola`, reutilizado de lá) mantém o que a FK garantia na escrita: os dois são usuário da
 *   escola do registro, conferidos na inserção.
 * - **`escola_id` e `titular_id` são imutáveis** (gatilho `pedido_titular_imutavel`, sem precedente no repositório):
 *   um `update` que troque um dos dois é recusado com o mesmo erro de um check. O pedido é sobre uma pessoa, e
 *   redirecioná-lo mudaria de quem é o atendimento.
 * - **`chave_envio`** é a chave que o navegador sorteia por diálogo e que decide a corrida: o `POST pedidos` faz
 *   `insert … on conflict (escola_id, chave_envio) do nothing` e, sem linha, devolve o pedido daquela chave. É a mesma
 *   regra da `execucao_agente.chave_envio`, e nunca entra no arquivo do titular (`COLUNAS_FORA_DO_ARQUIVO`).
 * - **`compartilhamento`** é a foto de por quais empresas o dado do titular passou, sem pessoa. É calculada e gravada no
 *   registro (`POST pedidos`, tarefa 12.0) e refeita na eliminação (15.0).
 * - `nome_trocado` e `homonimo` são marcas da eliminação (15.0): se o nome foi trocado nos textos livres, e se havia
 *   homônimo (quando não há troca). `homonimo` também é calculado na prévia e guardado no registro.
 * - `eliminar_em` e `eliminacao_enfileirada_em` são da eliminação agendada (14.0 e 15.0): os 7 dias e a trava contra
 *   enfileirar duas vezes. **O pedido de eliminação nasce `agendado`** (14.0), com `eliminar_em = now() + 7 dias`, e a
 *   pessoa fica com o acesso suspenso (`usuario.eliminacao_agendada_em`) até o cancelamento ou o 8º dia. `cancelar` só
 *   vale em `agendado`, antes de `eliminar_em` e antes de enfileirado; o único parcial `pedido_titular_agendado_unico`
 *   impede duas eliminações agendadas da mesma pessoa.
 * - `cancelado_por` passa pelo mesmo gatilho do `registrado_por` (14.0, recomendação da 11.0): quem cancelou é usuário da
 *   escola do pedido, conferido na escrita. O `concluido_por` não: o job da eliminação (15.0) conclui com o autor
 *   `rotina` quando quem registrou já saiu, e o gatilho o impediria.
 * - **`registrado_por`, `concluido_por` e `cancelado_por` não entram no arquivo do titular** (13.0): são o id de quem da
 *   coordenação atendeu o pedido, outra pessoa. O arquivo traz o pedido pelo `titular_id`, com o tipo, o estado e as datas.
 * - Retenção: vigência + 5 anos, no fim de contrato (F12), como a auditoria; a classe é `registro_de_decisao` em
 *   `CLASSIFICACAO_DAS_TABELAS`.
 * - A página por cursor (`proxima`, o id do último item) só é estável porque nenhum caminho muda `chegou_em` depois do registro
 *   e nenhum apaga a linha: hoje só há `update` de estado e das marcas da eliminação. Expurgo que passe a apagar pedido faz o
 *   cursor que apontava para ele devolver a página vazia, e a tela para de paginar no meio da lista.
 * - Índices começando pelo escopo (regra 80, item 8): `(escola_id, id)` para a página de pedidos, que sai na chegada mais recente
 *   primeiro e no id no empate: a ordenação roda sobre os pedidos de uma escola (dezenas por ano), e por isso não tem índice
 *   próprio (correção `2026-10-10-ordem-da-lista-de-pedidos`); `(escola_id,
 *   titular_id)` para os pedidos da pessoa, o único `(escola_id, chave_envio)` e o parcial dos agendados para o job da
 *   eliminação.
 */
export const pedidoTitular = pgTable(
  'pedido_titular',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    titularId: uuid().notNull(),
    papelTitular: text().$type<PapelDoTitular>().notNull(),
    tipo: text().$type<TipoDePedidoDoTitular>().notNull(),
    solicitante: text().$type<SolicitanteDoPedido>().notNull(),
    chegouEm: date({ mode: 'string' }).notNull(),
    estado: text().$type<EstadoDoPedido>().notNull(),
    eliminarEm: timestamp({ withTimezone: true }),
    eliminacaoEnfileiradaEm: timestamp({ withTimezone: true }),
    compartilhamento: jsonb().$type<Compartilhamento>().notNull(),
    nomeTrocado: boolean(),
    homonimo: boolean(),
    registradoPor: uuid().notNull(),
    registradoEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
    concluidoEm: timestamp({ withTimezone: true }),
    concluidoPor: uuid(),
    canceladoEm: timestamp({ withTimezone: true }),
    canceladoPor: uuid(),
    chaveEnvio: uuid().notNull(),
  },
  (tabela) => [
    unique('pedido_titular_chave_envio_unico').on(tabela.escolaId, tabela.chaveEnvio),
    // O apoio da FK composta do `arquivo_titular` (13.0): o arquivo aponta para o pedido da própria escola.
    unique('pedido_titular_da_escola_unico').on(tabela.escolaId, tabela.id),
    index('pedido_titular_escola_id_idx').on(tabela.escolaId, tabela.id),
    index('pedido_titular_escola_titular_idx').on(tabela.escolaId, tabela.titularId),
    index('pedido_titular_agendado_idx')
      .on(tabela.escolaId, tabela.eliminarEm)
      .where(sql`estado = 'agendado'`),
    // Uma eliminação agendada por titular (F3, 14.0; RF19): duas chaves de envio diferentes para a mesma pessoa não agendam
    // duas vezes. A segunda cai aqui e responde `PEDIDO_EM_ESTADO_INVALIDO`.
    uniqueIndex('pedido_titular_agendado_unico')
      .on(tabela.escolaId, tabela.titularId)
      .where(sql`estado = 'agendado'`),
    check('pedido_titular_papel_valido', sql`${tabela.papelTitular} in ('aluno', 'professor')`),
    check('pedido_titular_tipo_valido', sql`${tabela.tipo} in ('acesso', 'portabilidade', 'compartilhamento', 'correcao', 'eliminacao')`),
    check('pedido_titular_solicitante_valido', sql`${tabela.solicitante} in ('titular', 'responsavel_legal')`),
    check('pedido_titular_estado_valido', sql`${tabela.estado} in ('recebido', 'em_preparacao', 'pronto', 'agendado', 'concluido', 'cancelado')`),
    // A chegada é uma data de calendário e não é futura: o pedido não pode chegar amanhã.
    check('pedido_titular_chegou_em_nao_futura', sql`${tabela.chegouEm} <= current_date`),
    // O fim guarda quando e quem, juntos: ou os dois, ou nenhum.
    check('pedido_titular_concluido_so_com_data', sql`(${tabela.concluidoEm} is null) = (${tabela.concluidoPor} is null)`),
    check('pedido_titular_cancelado_so_com_data', sql`(${tabela.canceladoEm} is null) = (${tabela.canceladoPor} is null)`),
    // A eliminação é agendada com o instante dela; a marca de enfileiramento só existe depois do agendamento.
    // Só a eliminação fica `agendado`, e sempre com o instante dela (14.0): a segunda camada do registro e do cancelamento.
    check('pedido_titular_agendado_com_prazo', sql`${tabela.estado} <> 'agendado' or (${tabela.tipo} = 'eliminacao' and ${tabela.eliminarEm} is not null)`),
    check('pedido_titular_enfileirado_so_agendado', sql`${tabela.eliminacaoEnfileiradaEm} is null or ${tabela.eliminarEm} is not null`),
  ],
)
