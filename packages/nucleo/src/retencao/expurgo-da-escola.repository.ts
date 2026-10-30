import { AUTOR_DA_ROTINA, ErrorCode, HORAS_PARA_REENFILEIRAR_A_ELIMINACAO, TIPO_ELIMINAR_TITULAR, type CategoriaDeRetencao } from '@educa/shared'
import { and, desc, eq, sql, type SQL } from 'drizzle-orm'
import { CicloDeVidaService } from '../ciclo-de-vida/ciclo-de-vida.service.js'
import { requireEscolaId } from '../contexto/escola-do-contexto.js'
import type { Database } from '../db/banco.js'
import type { JobOutbox } from '../fila/enfileirador.js'
import { expurgoExecucao } from '../db/schema/expurgo-execucao.js'
import { pedidoTitular } from '../db/schema/pedido-titular.js'
import { usuario } from '../db/schema/usuario.js'
import { DomainException } from '../erro/erro-de-dominio.js'

/**
 * As categorias do catálogo que o expurgo da escola percorre, na ordem do catálogo (`CHAVES_DE_RETENCAO`): as que apagam
 * (F3, tarefa 3.0), as que anonimizam (tarefa 4.0) e as do trabalho do aluno e do cadastro (tarefa 5.0). Com a 5.0 é o
 * catálogo inteiro, e o teste de unidade confere que nenhuma ficou de fora.
 */
export const CATEGORIAS_DO_EXPURGO = [
  'conversa_tutor',
  'sinal_tutor',
  'conversa_professor',
  'execucao_agente',
  'texto_do_modelo',
  'consumo_por_aluno',
  'trabalho_do_aluno',
  'reivindicacao_decidida',
  'autoria_de_artefato',
  'material_excluido',
  'vinculo_encerrado',
  'pessoa_desativada',
] as const satisfies readonly CategoriaDeRetencao[]
export type CategoriaDoExpurgo = (typeof CATEGORIAS_DO_EXPURGO)[number]

/**
 * O que sai em cada passo de uma categoria, na ordem: a conversa do professor apaga as mensagens, e depois a thread vazia.
 * Os alvos de anonimização mantêm a linha e anulam a pessoa: `consumo_ia_texto` anula `entrada` e `saida`,
 * `consumo_ia_aluno` anula `aluno_id`, e `artefato_autoria` anula `criado_por`. O consumo por aluno anonimiza também a
 * execução do Tutor (`execucao_agente_do_tutor`): ela tem o aluno em `solicitada_por`, e o consumo do Tutor aponta para
 * ela, então sem isso o aluno voltaria ao consumo pela execução até o prazo de `execucao_agente`, que não é travado pela
 * conversa do Tutor.
 *
 * O trabalho do aluno e o cadastro (tarefa 5.0): `tentativa_atividade` (a resposta e a correção saem em cascata),
 * `reivindicacao`, `material` e `vinculo` apagam a linha; `usuario` elimina a pessoa pelo ciclo de vida, que é mais que um
 * `delete` (credencial, conta externa, sessões, vínculos, lista de nomes e a conta global que ficou sem uso).
 */
export const ALVOS_DO_EXPURGO_DA_ESCOLA = {
  conversa_tutor: ['mensagem_tutor'],
  sinal_tutor: ['sinal_tutor'],
  conversa_professor: ['mensagem_agente', 'thread_agente'],
  execucao_agente: ['execucao_agente'],
  texto_do_modelo: ['consumo_ia_texto'],
  consumo_por_aluno: ['consumo_ia_aluno', 'execucao_agente_do_tutor'],
  trabalho_do_aluno: ['tentativa_atividade'],
  reivindicacao_decidida: ['reivindicacao'],
  autoria_de_artefato: ['artefato_autoria'],
  material_excluido: ['material'],
  vinculo_encerrado: ['vinculo'],
  pessoa_desativada: ['usuario'],
} as const satisfies Record<CategoriaDoExpurgo, readonly string[]>
export type AlvoDoExpurgoDaEscola = (typeof ALVOS_DO_EXPURGO_DA_ESCOLA)[CategoriaDoExpurgo][number]

/**
 * O prazo de um lote: o `agora` do job (de onde o prazo conta), os meses da categoria e o fuso da escola. O fuso só vale
 * para a autoria, que conta de uma data (o `fim` do ano letivo): o dia de `agora` é o da parede da escola.
 */
export interface PrazoDoLote {
  readonly agora: Date
  readonly meses: number
  readonly fuso: string
}

/**
 * O tamanho máximo do lote de um alvo, quando é menor que o do job (`LOTE_DO_EXPURGO`). A eliminação da pessoa roda uma
 * transação por usuário, com a auditoria dentro: um lote de 5.000 seguraria o job por minutos sem olhar a janela letiva,
 * que o processador confere entre lotes.
 */
export const LOTE_MAXIMO_DO_ALVO: Readonly<Partial<Record<AlvoDoExpurgoDaEscola, number>>> = {
  usuario: 100,
}

/**
 * Quantos pedidos de eliminação vencidos o job da escola enfileira por noite: o resto fica para a noite seguinte, que o pega
 * pela mesma regra. Mil eliminações vencidas na mesma noite de uma escola só não existem; o teto protege a transação.
 */
export const LIMITE_DE_ELIMINACOES_ENFILEIRADAS_POR_NOITE = 500

/** O que o enfileiramento da noite fez: quantos jobs gravou e quantos já havia (a chave de idempotência colidiu). */
export interface EliminacoesEnfileiradas {
  readonly enfileirados: number
  readonly jaEnfileirados: number
}

/** Quanto tempo o registro do próprio expurgo (`expurgo_execucao`) fica: 5 anos, o prazo fixo dos registros de prestação de contas. */
export const RETENCAO_EXPURGO_EXECUCAO_MESES = 60

/** Um lote: quantas linhas saíram ou foram anonimizadas, e se o lote veio cheio (há mais no prazo vencido). */
export interface LoteDoExpurgo {
  readonly linhas: number
  readonly cheio: boolean
}

/** Uma das noites que o alerta olha: se ela conta (a escola já tinha rodado o expurgo), e quantas categorias terminaram. */
export interface NoiteDoExpurgo {
  /** A noite é anterior à primeira execução da escola: não conta, nem como incompleta. */
  readonly contada: boolean
  /** Quantas das categorias pedidas têm, naquela noite, ao menos uma linha `concluida`. */
  readonly concluidas: number
}

/** As noites que o alerta olha, de ontem para trás, no fuso da escola. */
export const NOITES_DO_ALERTA = 2

/** O instante do corte: o `agora` do job menos o prazo da categoria, em meses, pela aritmética de calendário do Postgres. */
const corte = (agora: Date, meses: number): SQL => sql`(${agora.toISOString()}::timestamptz - make_interval(months => ${meses}))`

/**
 * O ano letivo `al` da escola que está `encerrado` e cujo `fim`, somado o prazo, é anterior ao dia de `agora` no fuso da
 * escola (nunca o da sessão do banco, nem o de UTC, que já virou o dia às 21h de São Paulo, e o job segurado pela janela
 * letiva pode rodar a essa hora). É a idade da autoria de artefato e do trabalho do aluno: a do ano, não a da linha. O
 * fuso é o que o Node já aceitou para a janela; um nome que o tzdata do Postgres não tivesse faria o lote falhar, a
 * categoria ficaria `false` e o alerta de duas noites a mostraria.
 */
const ANO_ENCERRADO_ALEM_DO_PRAZO = (escolaId: string, { agora, meses, fuso }: PrazoDoLote): SQL => sql`
  al.escola_id = ${escolaId} and al.situacao = 'encerrado'
  and al.fim + make_interval(months => ${meses}) < (${agora.toISOString()}::timestamptz at time zone ${fuso})::date
`

/**
 * Cada lote segue o desenho do expurgo de acesso: `id = any(array(...))`, com a subconsulta rodando uma vez antes do
 * delete ou do update; `order by` pela data, que desce pelo índice `(escola_id, <data>)` das migrations 0025 e 0026 e para
 * no lote; e `skip locked`, para dois jobs da mesma escola ao mesmo tempo levarem linhas diferentes, sem um esperar o
 * outro. A escola entra nas duas cláusulas: na subconsulta, para o índice; na instrução de fora, para nenhuma linha de
 * outra escola mudar nem por um id que casasse.
 *
 * Os lotes de anonimização (F3, tarefa 4.0) mantêm a linha e anulam só a pessoa, e cada subconsulta lê só as linhas que
 * ainda a têm, pelo índice parcial da 0026: reexecutar não mexe no que já foi anonimizado. Eles travam com `for no key
 * update`, o mesmo que o próprio update toma (nenhuma coluna mudada está em índice único): a mensagem ou o consumo novo
 * que aponta para a execução, e a entrega que aponta para o artefato, conferem a FK sem esperar o lote, e o lote não pula
 * a linha só por isso.
 * - **`execucao_agente`**: `entrada` vira `{ tarefa }` (o check `execucao_agente_entrada_da_tarefa` exige a tarefa),
 *   `solicitada_por` vira nulo e `anonimizada_em` recebe o `agora` do job. O estado, o `resultado` e o `erro` ficam, e com
 *   eles todos os checks das migrations 0022 e 0023.
 * - **`execucao_agente_do_tutor`**: a mesma anonimização, só da execução do Tutor (`funcao = 'tutor_com_o_aluno'`, a única
 *   que o aluno pede), no prazo de `consumo_por_aluno`: a execução do Tutor perde o aluno no menor dos dois prazos.
 * - **`consumo_ia_texto`**: só as linhas com `entrada` ou `saida`; as do Tutor e da proposta de ferramenta já nascem sem
 *   texto (check `consumo_ia_sem_conversa_de_pessoa`) e não entram no lote nem na contagem.
 * - **`artefato_autoria`**: só o artefato de ano letivo `encerrado` cujo `fim`, somado o prazo, é anterior ao dia de
 *   `agora` no fuso da escola (`ANO_ENCERRADO_ALEM_DO_PRAZO`). Trava só o artefato (`of a`): o ano que a coordenação está
 *   encerrando não faz o lote pular os artefatos dele. Sem `order by`: o índice `(escola_id, ano_letivo_id)` não tem
 *   data, e a idade é a do ano, não a da linha.
 *
 * Os lotes que **apagam** a linha da tarefa 5.0 (`for update skip locked`, como os da 3.0):
 * - **`tentativa_atividade`** (`trabalho_do_aluno`): a tentativa do ano `encerrado` além do prazo, com a mesma regra da
 *   autoria. A resposta e a correção saem em cascata (`on delete cascade`), e o ano `em_curso` não perde nada mesmo com o
 *   `fim` vencido. O ano é o da tentativa, então o aluno transferido perde em A o que fez em A. Trava só a tentativa
 *   (`of t`). Sem `order by`, pelo mesmo motivo da autoria. O lote tem o tamanho do job: o teste da tarefa mede a cascata
 *   contra o `statement_timeout` de 2 s.
 * - **`reivindicacao`**: o pedido que não está `pendente`, pela data da decisão, ou pela da solicitação no `encerrada`, que
 *   a virada do ano fecha sem decisão (`decidida_em` nulo). Qualquer decisor (`professor` ou `coordenacao`) conta, e o
 *   pendente nunca sai. Nenhuma tabela aponta para o pedido.
 * - **`material`**: o material excluído (`excluido_em`) além do prazo e que nenhuma mensagem nem sinal do Tutor ainda cita:
 *   as duas FKs para ele não têm ação, e a conversa pode viver mais que o material (o piso do material é 12 meses, o teto
 *   da conversa, 24). O que a conversa cita sai na noite em que ela sai. Os trechos já saíram na exclusão e, se algum
 *   ficou, saem em cascata. O material vigente nunca entra.
 * - **`vinculo`**: o vínculo `encerrado` além do prazo, pela data do encerramento. O ativo, o pendente e o contestado ficam.
 */
const INSTRUCAO_DO_LOTE: Record<Exclude<AlvoDoExpurgoDaEscola, 'thread_agente' | 'usuario'>, (escolaId: string, prazo: PrazoDoLote, limite: number) => SQL> = {
  mensagem_tutor: (escolaId, { agora, meses }, limite) => sql`
    delete from mensagem_tutor
    where escola_id = ${escolaId} and id = any(array(
      select id from mensagem_tutor
      where escola_id = ${escolaId} and criada_em < ${corte(agora, meses)}
      order by criada_em
      limit ${limite}
      for update skip locked
    ))
  `,
  sinal_tutor: (escolaId, { agora, meses }, limite) => sql`
    delete from sinal_tutor
    where escola_id = ${escolaId} and id = any(array(
      select id from sinal_tutor
      where escola_id = ${escolaId} and criado_em < ${corte(agora, meses)}
      order by criado_em
      limit ${limite}
      for update skip locked
    ))
  `,
  mensagem_agente: (escolaId, { agora, meses }, limite) => sql`
    delete from mensagem_agente
    where escola_id = ${escolaId} and id = any(array(
      select id from mensagem_agente
      where escola_id = ${escolaId} and criada_em < ${corte(agora, meses)}
      order by criada_em
      limit ${limite}
      for update skip locked
    ))
  `,
  execucao_agente: (escolaId, { agora, meses }, limite) => sql`
    update execucao_agente
    set entrada = jsonb_build_object('tarefa', tarefa), solicitada_por = null, anonimizada_em = ${agora.toISOString()}::timestamptz
    where escola_id = ${escolaId} and id = any(array(
      select id from execucao_agente
      where escola_id = ${escolaId} and anonimizada_em is null and criada_em < ${corte(agora, meses)}
      order by criada_em
      limit ${limite}
      for no key update skip locked
    ))
  `,
  execucao_agente_do_tutor: (escolaId, { agora, meses }, limite) => sql`
    update execucao_agente
    set entrada = jsonb_build_object('tarefa', tarefa), solicitada_por = null, anonimizada_em = ${agora.toISOString()}::timestamptz
    where escola_id = ${escolaId} and id = any(array(
      select id from execucao_agente
      where escola_id = ${escolaId} and anonimizada_em is null and funcao = 'tutor_com_o_aluno' and criada_em < ${corte(agora, meses)}
      order by criada_em
      limit ${limite}
      for no key update skip locked
    ))
  `,
  consumo_ia_texto: (escolaId, { agora, meses }, limite) => sql`
    update consumo_ia
    set entrada = null, saida = null
    where escola_id = ${escolaId} and id = any(array(
      select id from consumo_ia
      where escola_id = ${escolaId} and (entrada is not null or saida is not null) and em < ${corte(agora, meses)}
      order by em
      limit ${limite}
      for no key update skip locked
    ))
  `,
  consumo_ia_aluno: (escolaId, { agora, meses }, limite) => sql`
    update consumo_ia
    set aluno_id = null
    where escola_id = ${escolaId} and id = any(array(
      select id from consumo_ia
      where escola_id = ${escolaId} and aluno_id is not null and em < ${corte(agora, meses)}
      order by em
      limit ${limite}
      for no key update skip locked
    ))
  `,
  artefato_autoria: (escolaId, prazo, limite) => sql`
    update artefato
    set criado_por = null
    where escola_id = ${escolaId} and id = any(array(
      select a.id from artefato a
      join ano_letivo al on al.escola_id = a.escola_id and al.id = a.ano_letivo_id
      where a.escola_id = ${escolaId} and a.criado_por is not null and ${ANO_ENCERRADO_ALEM_DO_PRAZO(escolaId, prazo)}
      limit ${limite}
      for no key update of a skip locked
    ))
  `,
  tentativa_atividade: (escolaId, prazo, limite) => sql`
    delete from tentativa_atividade
    where escola_id = ${escolaId} and id = any(array(
      select t.id from tentativa_atividade t
      join ano_letivo al on al.escola_id = t.escola_id and al.id = t.ano_letivo_id
      where t.escola_id = ${escolaId} and ${ANO_ENCERRADO_ALEM_DO_PRAZO(escolaId, prazo)}
      limit ${limite}
      for update of t skip locked
    ))
  `,
  reivindicacao: (escolaId, { agora, meses }, limite) => sql`
    delete from reivindicacao
    where escola_id = ${escolaId} and id = any(array(
      select id from reivindicacao
      where escola_id = ${escolaId} and estado <> 'pendente' and coalesce(decidida_em, solicitada_em) < ${corte(agora, meses)}
      order by coalesce(decidida_em, solicitada_em)
      limit ${limite}
      for update skip locked
    ))
  `,
  material: (escolaId, { agora, meses }, limite) => sql`
    delete from material
    where escola_id = ${escolaId} and id = any(array(
      select m.id from material m
      where m.escola_id = ${escolaId} and m.excluido_em < ${corte(agora, meses)}
        and not exists (select 1 from mensagem_tutor c where c.escola_id = ${escolaId} and c.material_id = m.id)
        and not exists (select 1 from sinal_tutor c where c.escola_id = ${escolaId} and c.material_id = m.id)
      order by m.excluido_em
      limit ${limite}
      for update of m skip locked
    ))
  `,
  vinculo: (escolaId, { agora, meses }, limite) => sql`
    delete from vinculo
    where escola_id = ${escolaId} and id = any(array(
      select id from vinculo
      where escola_id = ${escolaId} and estado = 'encerrado' and encerrado_em < ${corte(agora, meses)}
      order by encerrado_em
      limit ${limite}
      for update skip locked
    ))
  `,
}

/**
 * As pessoas da escola desativadas há mais de `meses` meses, as mais antigas primeiro: o lote da eliminação da pessoa.
 * **Fica de fora quem tem a eliminação agendada** (F3, 14.0): o pedido `agendado` tem o prazo de 7 dias e o job dele
 * (15.0) elimina e conclui com o autor `rotina`; a rotina por prazo não passa na frente, e o pedido não perde a pessoa.
 * O filtro está na escolha e não só no pulo, para a pessoa agendada não encher o lote e parar a noite.
 */
const PESSOAS_DESATIVADAS = (escolaId: string, { agora, meses }: PrazoDoLote, limite: number): SQL => sql`
  select id from usuario
  where escola_id = ${escolaId} and desativado_em < ${corte(agora, meses)}
    and eliminacao_agendada_em is null
    and not exists (select 1 from pedido_titular p where p.escola_id = usuario.escola_id and p.titular_id = usuario.id and p.estado = 'agendado')
  order by desativado_em, id
  limit ${limite}
`

/** O lote do registro do próprio expurgo (`expurgo_execucao`) com mais de 5 anos. */
const REGISTRO_DO_EXPURGO_VENCIDO = (escolaId: string, agora: Date, limite: number): SQL => sql`
  delete from expurgo_execucao
  where escola_id = ${escolaId} and id = any(array(
    select id from expurgo_execucao
    where escola_id = ${escolaId} and em < ${corte(agora, RETENCAO_EXPURGO_EXECUCAO_MESES)}
    order by em
    limit ${limite}
    for update skip locked
  ))
`

/** A thread sem mensagem, criada antes do corte, da escola. `t` é a thread. */
const THREAD_VAZIA_E_VENCIDA = (escolaId: string, agora: Date, meses: number): SQL => sql`
  t.escola_id = ${escolaId} and t.criada_em < ${corte(agora, meses)}
  and not exists (select 1 from mensagem_agente m where m.escola_id = t.escola_id and m.thread_id = t.id)
`

/**
 * O expurgo noturno da escola (F3, RF4 e RF5; Tech Spec do F3, seção 5), sempre no escopo da escola do contexto, que o
 * job tira do `job_registro` (regra 10, item 3): nenhum método recebe escola, e nenhum é `@Unscoped`. O processador
 * `retencao.expurgar-escola` percorre as categorias com o prazo efetivo e grava `expurgo_execucao`; a medição do alerta
 * lê as noites daqui.
 *
 * Conversa do Tutor, sinais e conversa do professor **saem do banco**, pelo prazo de cada linha, contado da data dela. A
 * thread do professor sai quando ficou vazia, e só se foi criada antes do corte: a thread que o professor acabou de
 * abrir, ainda sem mensagem, fica.
 *
 * Execução de agente, texto do modelo, consumo por aluno e autoria de artefato **ficam com a linha e perdem a pessoa**
 * (tarefa 4.0): o que a IA gerou, quem aprovou e a soma da governança continuam respondendo (regra 70, item 6).
 *
 * O trabalho do aluno, a reivindicação decidida, o material excluído e o vínculo encerrado **saem** (tarefa 5.0), e a
 * pessoa desativada além do prazo é **eliminada pelo ciclo de vida** (`CicloDeVidaService.eliminar`), com a auditoria
 * `usuario.eliminado` assinada pela rotina (`AUTOR_DA_ROTINA`). O ciclo de vida é o mesmo da eliminação do titular
 * (tarefa 12.0): a eliminação de uma pessoa tem um caminho só.
 */
export class ExpurgoDaEscolaRepository {
  readonly #cicloDeVida: CicloDeVidaService

  constructor(private readonly banco: Database) {
    this.#cicloDeVida = new CicloDeVidaService(banco)
  }

  /**
   * Apaga, ou anonimiza, como o alvo diz, até `limite` linhas de `alvo` da escola do contexto com mais de `prazo.meses`
   * meses contados de `prazo.agora` (o autor do artefato, do `fim` do ano encerrado, no dia do fuso da escola), numa
   * transação curta, e diz quantas linhas o lote alcançou e se ele veio cheio.
   *
   * A thread vazia sai em duas instruções numa transação, como a conta sem uso no expurgo de acesso: a primeira escolhe
   * e trava as candidatas (`for update skip locked`, e a thread em que o professor está gravando uma mensagem agora fica
   * para a noite seguinte); a segunda, com a visão do banco de depois da trava, confere de novo que ela continua vazia e
   * só então apaga. Numa instrução só, o `not exists` usaria a visão do começo dela, e uma mensagem confirmada entre esse
   * começo e a trava sairia junto, em cascata. Depois da trava, a mensagem nova espera o fim do lote e, sem a thread,
   * é recusada pela FK: o professor manda de novo e a thread nasce outra vez.
   *
   * `depoisDeTravar` é só do teste: é a janela entre a trava e a reconferência da thread vazia.
   */
  async expurgarLote(alvo: AlvoDoExpurgoDaEscola, prazo: PrazoDoLote, limite: number, depoisDeTravar?: () => Promise<void>): Promise<LoteDoExpurgo> {
    const { agora, meses } = prazo
    const escolaId = requireEscolaId()
    if (alvo === 'usuario') return this.#eliminarPessoasDesativadas(escolaId, prazo, Math.min(limite, LOTE_MAXIMO_DO_ALVO.usuario ?? limite))
    if (alvo !== 'thread_agente') {
      const resultado = await this.banco.execute(INSTRUCAO_DO_LOTE[alvo](escolaId, prazo, limite))
      const linhas = resultado.rowCount ?? 0
      return { linhas, cheio: linhas >= limite }
    }
    return this.banco.transaction(async (tx) => {
      const travadas = await tx.execute<{ id: string }>(sql`
        select t.id from thread_agente t
        where ${THREAD_VAZIA_E_VENCIDA(escolaId, agora, meses)}
        order by t.criada_em
        limit ${limite}
        for update of t skip locked
      `)
      const ids = travadas.rows.map(({ id }) => id)
      if (ids.length === 0) return { linhas: 0, cheio: false }
      if (depoisDeTravar !== undefined) await depoisDeTravar()
      const apagadas = await tx.execute(sql`
        delete from thread_agente t
        where t.id = any(${`{${ids.join(',')}}`}::uuid[]) and ${THREAD_VAZIA_E_VENCIDA(escolaId, agora, meses)}
      `)
      return { linhas: apagadas.rowCount ?? 0, cheio: ids.length >= limite }
    })
  }

  /**
   * Elimina, pelo ciclo de vida, até `limite` pessoas da escola desativadas há mais de `prazo.meses` meses, as mais antigas
   * primeiro. A **transação por pessoa** é aberta aqui (a eliminação de uma não desfaz a das outras, e um erro de SQL aborta
   * só a transação dela): ela trava a pessoa e reconfere que continua desativada além do prazo, e só então chama o `eliminar`,
   * que reutiliza a transação e grava a auditoria `usuario.eliminado` assinada pela rotina. O `eliminar` em si não confere o
   * prazo, porque também serve ao pedido do titular, de pessoa ativa. O usuário que sumiu entre a escolha e a trava
   * (eliminado por outro job da escola, ou pelo pedido do titular) ou que voltou a ser ativo (convite aceito) responde
   * `NAO_ENCONTRADO` e é pulado sem erro, sem auditoria e fora da contagem; o
   * lote diz `cheio` pelo número de escolhidos, e não pelo de eliminados, para o pulo não parar a noite. Qualquer outro
   * erro sobe: o job grava a categoria `false`, e a fila tenta de novo.
   *
   * A conta global só cai se não serve a escola nenhuma: o usuário ativo em outra escola mantém a dele (o ciclo de vida
   * confere). A pessoa com a eliminação `agendada` (14.0) não entra na escolha, e a que foi agendada entre a escolha e a
   * trava é pulada: o prazo dela é o do pedido, e quem a elimina é o job da 15.0.
   */
  async #eliminarPessoasDesativadas(escolaId: string, prazo: PrazoDoLote, limite: number): Promise<LoteDoExpurgo> {
    const escolhidos = await this.banco.execute<{ id: string }>(PESSOAS_DESATIVADAS(escolaId, prazo, limite))
    let eliminadas = 0
    for (const { id } of escolhidos.rows) {
      try {
        await this.banco.transaction(async (tx) => {
          const [ainda] = await tx
            .select({ desativadoEm: usuario.desativadoEm })
            .from(usuario)
            .where(
              and(
                eq(usuario.escolaId, escolaId),
                eq(usuario.id, id),
                sql`${usuario.desativadoEm} < ${corte(prazo.agora, prazo.meses)}`,
                // A pessoa que teve a eliminação agendada entre a escolha e a trava (14.0) é pulada como a que voltou a ser
                // ativa: a coluna é lida com a linha travada, e o pedido `agendado` cobre a linha sem a marca.
                sql`${usuario.eliminacaoAgendadaEm} is null`,
                sql`not exists (select 1 from pedido_titular p where p.escola_id = ${usuario.escolaId} and p.titular_id = ${usuario.id} and p.estado = 'agendado')`,
              ),
            )
            .limit(1)
            .for('no key update')
          if (ainda === undefined) throw new DomainException(ErrorCode.NAO_ENCONTRADO)
          await this.#cicloDeVida.eliminar(id, { autorOperador: AUTOR_DA_ROTINA }, tx)
        })
        eliminadas += 1
      } catch (erro) {
        if (!(erro instanceof DomainException) || erro.codigo !== ErrorCode.NAO_ENCONTRADO) throw erro
      }
    }
    return { linhas: eliminadas, cheio: escolhidos.rows.length >= limite }
  }

  /**
   * Enfileira a eliminação de cada pedido **vencido** da escola do contexto (F3, tarefa 15.0; Tech Spec do F3, seção 5): o
   * pedido `agendado` com `eliminar_em <= now()` cujo `eliminacao_enfileirada_em` é nulo ou tem mais de
   * `HORAS_PARA_REENFILEIRAR_A_ELIMINACAO` (20 h: o job que a janela letiva interrompeu, ou que se perdeu, volta na noite
   * seguinte; o que foi enfileirado há menos pode estar rodando). **Uma transação**: o `update` marca o instante e o job
   * `titular.eliminar` (fila de lote, não urgente, só com o id do pedido, chave de idempotência `eliminacao:<pedido>`) é
   * gravado nela, então não há pedido marcado sem job nem job sem marca.
   *
   * **A marca é a trava do cancelamento**: `cancelar` só vale com `eliminacao_enfileirada_em` nulo, e o `update` daqui só
   * pega o `agendado`: cancelar e enfileirar na fronteira do prazo têm um vencedor só, decidido pela linha. O relógio é o
   * do banco. `for update skip locked` entre as candidatas: a que o cancelamento está tocando agora fica para a noite
   * seguinte, e dois jobs da mesma escola ao mesmo tempo levam pedidos diferentes. A mesma chave colide só com o job ainda
   * não terminado do mesmo pedido, e conta como "já enfileirado".
   */
  async enfileirarEliminacoes(enfileirador: Pick<JobOutbox, 'enfileirarUmaVez'>): Promise<EliminacoesEnfileiradas> {
    const escolaId = requireEscolaId()
    return this.banco.transaction(async (tx) => {
      const marcados = await tx.execute<{ id: string }>(sql`
        update pedido_titular
        set eliminacao_enfileirada_em = now()
        where escola_id = ${escolaId} and estado = 'agendado' and eliminar_em <= now() and id = any(array(
          select id from pedido_titular
          where escola_id = ${escolaId} and estado = 'agendado' and eliminar_em <= now()
            and (eliminacao_enfileirada_em is null or eliminacao_enfileirada_em < now() - make_interval(hours => ${HORAS_PARA_REENFILEIRAR_A_ELIMINACAO}))
          order by eliminar_em, id
          limit ${LIMITE_DE_ELIMINACOES_ENFILEIRADAS_POR_NOITE}
          for update skip locked
        ))
        returning id
      `)
      let enfileirados = 0
      let jaEnfileirados = 0
      for (const { id } of marcados.rows) {
        const resultado = await enfileirador.enfileirarUmaVez(tx, TIPO_ELIMINAR_TITULAR, { pedidoId: id }, `eliminacao:${id}`)
        if (resultado.situacao === 'enfileirado') enfileirados += 1
        else jaEnfileirados += 1
      }
      return { enfileirados, jaEnfileirados }
    })
  }

  /**
   * Quando venceu o pedido `agendado` mais antigo da escola (o `eliminar_em` dele), ou `undefined` sem nenhum vencido. É o
   * que o alerta lê (Tech Spec do F3, seção 7c): as horas desde então passam de `HORAS_AGENDADO_PARA_ALERTAR`. O pedido
   * ainda dentro dos 7 dias não conta, e a escola sem eliminação vencida não tem série. O relógio da comparação é o do banco.
   */
  async vencimentoDoAgendadoMaisAntigo(): Promise<Date | undefined> {
    const [linha] = await this.banco
      .select({ vencimento: sql<Date | string | null>`min(${pedidoTitular.eliminarEm})` })
      .from(pedidoTitular)
      .where(and(eq(pedidoTitular.escolaId, requireEscolaId()), eq(pedidoTitular.estado, 'agendado'), sql`${pedidoTitular.eliminarEm} <= now()`))
    const valor = linha?.vencimento
    return valor === null || valor === undefined ? undefined : valor instanceof Date ? valor : new Date(valor)
  }

  /**
   * Apaga até `limite` linhas do `expurgo_execucao` da escola com mais de `RETENCAO_EXPURGO_EXECUCAO_MESES` meses (5 anos),
   * contados de `agora`: é o registro do próprio expurgo, que não tem categoria nem pessoa e sai por prazo fixo (Tech Spec
   * do F3, seção 3). Roda no fim da noite, depois das categorias, e não grava linha sobre si mesmo.
   */
  async expurgarRegistroDoExpurgo(agora: Date, limite: number): Promise<LoteDoExpurgo> {
    const escolaId = requireEscolaId()
    const resultado = await this.banco.execute(REGISTRO_DO_EXPURGO_VENCIDO(escolaId, agora, limite))
    const linhas = resultado.rowCount ?? 0
    return { linhas, cheio: linhas >= limite }
  }

  /** Grava o que a execução fez numa categoria: só a contagem e se terminou. */
  async registrar(categoria: CategoriaDeRetencao, linhas: number, concluida: boolean, em: Date): Promise<void> {
    await this.banco.insert(expurgoExecucao).values({ escolaId: requireEscolaId(), categoria, linhas, concluida, em })
  }

  /**
   * A categoria em que a última execução da escola parou pela janela letiva, ou `undefined` se a última linha terminou
   * (ou não há nenhuma). É por ela que a noite seguinte começa.
   */
  async categoriaPendente(): Promise<CategoriaDeRetencao | undefined> {
    const [ultima] = await this.banco
      .select({ categoria: expurgoExecucao.categoria, concluida: expurgoExecucao.concluida })
      .from(expurgoExecucao)
      .where(eq(expurgoExecucao.escolaId, requireEscolaId()))
      .orderBy(desc(expurgoExecucao.em), desc(expurgoExecucao.id))
      .limit(1)
    return ultima === undefined || ultima.concluida ? undefined : ultima.categoria
  }

  /**
   * As `NOITES_DO_ALERTA` noites antes da de `agora`, de ontem para trás, no `fuso` da escola: se cada uma conta e
   * quantas de `categorias` terminaram nela. `undefined` quando a escola nunca rodou o expurgo: não há o que alertar.
   *
   * A noite é o dia local de `em`, contado da meia-noite à meia-noite no fuso, pelo índice `(escola_id, em)`. A noite
   * anterior à primeira execução da escola não conta: a escola recém-criada, e a primeira noite depois do deploy, não
   * disparam o alerta.
   */
  async noitesDoAlerta(fuso: string, agora: Date, categorias: readonly CategoriaDeRetencao[]): Promise<NoiteDoExpurgo[] | undefined> {
    const escolaId = requireEscolaId()
    const [primeira] = await this.banco
      .select({ dia: sql<string>`(${expurgoExecucao.em} at time zone ${fuso})::date::text` })
      .from(expurgoExecucao)
      .where(eq(expurgoExecucao.escolaId, escolaId))
      .orderBy(expurgoExecucao.em)
      .limit(1)
    if (primeira === undefined) return undefined
    const lista = `{${categorias.join(',')}}`
    const noites = await this.banco.execute<{ contada: boolean; concluidas: number }>(sql`
      select noite.dia >= ${primeira.dia}::date as contada,
        (select count(distinct x.categoria)::int from expurgo_execucao x
          where x.escola_id = ${escolaId} and x.concluida and x.categoria = any(${lista}::text[])
            and x.em >= (noite.dia::timestamp at time zone ${fuso}) and x.em < ((noite.dia + 1)::timestamp at time zone ${fuso})
        ) as concluidas
      from (select (${agora.toISOString()}::timestamptz at time zone ${fuso})::date - n as dia, n from generate_series(1, ${NOITES_DO_ALERTA}) as n) as noite
      order by noite.n
    `)
    return noites.rows.map(({ contada, concluidas }) => ({ contada, concluidas }))
  }
}

/**
 * Quantas noites seguidas, de ontem para trás, a escola passou sem terminar todas as `categorias`: para na primeira
 * noite completa, ou na primeira que não conta. É o valor de `expurgo.noites_incompletas`, e o alerta dispara em 2.
 */
export function noitesSeguidasSemConcluir(noites: readonly NoiteDoExpurgo[], categorias: number): number {
  let seguidas = 0
  for (const noite of noites) {
    if (!noite.contada || noite.concluidas >= categorias) break
    seguidas += 1
  }
  return seguidas
}

/** A ordem da noite: começa pela categoria pendente, segue a do catálogo e dá a volta; sem pendente, a do catálogo. */
export function ordemDaNoite(pendente: CategoriaDeRetencao | undefined): CategoriaDoExpurgo[] {
  const inicio = CATEGORIAS_DO_EXPURGO.findIndex((categoria) => categoria === pendente)
  if (inicio <= 0) return [...CATEGORIAS_DO_EXPURGO]
  return [...CATEGORIAS_DO_EXPURGO.slice(inicio), ...CATEGORIAS_DO_EXPURGO.slice(0, inicio)]
}

/** A instrução do lote, para o teste conferir o plano sem mudar nada. A thread vazia e a pessoa não têm instrução única. */
export function expurgoSchoolBatchStatement(alvo: Exclude<AlvoDoExpurgoDaEscola, 'thread_agente' | 'usuario'>, escolaId: string, prazo: PrazoDoLote, limite: number): SQL {
  return INSTRUCAO_DO_LOTE[alvo](escolaId, prazo, limite)
}

/** A escolha das pessoas a eliminar, para o teste conferir o plano sem mudar nada. */
export function expurgoDeactivatedPeopleStatement(escolaId: string, prazo: PrazoDoLote, limite: number): SQL {
  return PESSOAS_DESATIVADAS(escolaId, prazo, limite)
}

/** A instrução do lote do registro do expurgo, para o teste conferir o plano sem mudar nada. */
export function expurgoRecordStatement(escolaId: string, agora: Date, limite: number): SQL {
  return REGISTRO_DO_EXPURGO_VENCIDO(escolaId, agora, limite)
}
