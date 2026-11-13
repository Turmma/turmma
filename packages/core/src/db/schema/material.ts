import { sql } from 'drizzle-orm'
import { boolean, check, date, foreignKey, index, integer, pgTable, primaryKey, smallint, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import type { EstadoDeMaterial, FalhaDeMaterial, LicencaDeMaterial, TitularidadeDeMaterial } from '@educa/shared'
import { disciplina } from './disciplina.js'
import { escola } from './escola.js'
import { usuario } from './usuario.js'

/**
 * O material que a coordenação sobe (glossário, "Material"; MVP, A2; D5, D22, D75). **O arquivo só é guardado até a extração** (abaixo): aqui
 * ficam os metadados, a titularidade, a licença, a declaração e o estado; o texto, por página, vai para `trecho`
 * (`docs/mvp-rapido.md`, seção 4, item 3). Pertence ao tenant e nunca cruza para outra escola (regra 60, item 10). Não
 * varia por ano letivo: a apostila de 2026 continua valendo em 2027.
 *
 * - Check `material_com_declaracao`: não existe material sem a declaração de que a escola pode usá-lo. O envio sem
 *   licença ou sem declaração **não grava linha aqui**: grava auditoria (`material.recusado`) e responde
 *   `MATERIAL_SEM_LICENCA` antes de abrir o arquivo. O check segura o caminho que não passa pela API (seed, job, insert à mão).
 * - `licenca` só aceita as quatro com que um material entra; `sem_licenca`, que o formulário manda, não cabe na coluna.
 * - `licenciante` é o nome do dono do direito, e existe só, e sempre, no material de terceiro (check).
 * - `sha256` é o resumo do arquivo, que não fica: o índice único parcial `(escola_id, sha256)` entre os não excluídos e
 *   não falhos faz o mesmo PDF enviado duas vezes, mesmo ao mesmo tempo, entrar uma vez (regra 80, item 7). O que falhou
 *   pode ser enviado de novo, e o mesmo arquivo em outra escola é outro material.
 * - A disciplina por FK composta com a escola, sem ação: a disciplina com material não se exclui. `unique (escola_id,
 *   disciplina_id, id)` é o alvo do trecho, que carrega a disciplina para a busca.
 * - Exclusão lógica (`excluido_em`; regra 20, item 15): a linha fica enquanto a conversa do Tutor ou um sinal ainda a
 *   cita e até o prazo de `material_excluido` (F3, tarefa 5.0), e os trechos saem na mesma transação; depois disso a linha
 *   sai, e o artefato que a citava mostra «material da escola». Quem enviou e quem excluiu viram nulo se a pessoa for eliminada (`on delete set null
 *   (coluna)`, escrito à mão na 0022), e a autoria fica na auditoria (`material.enviado`, `material.excluido`).
 * - **O PDF fica no storage só até a extração** (ingestao-do-material, 1.0): o objeto `material-temporario/<escola>/<material>` nasce no envio e
 *   sai depois do commit da extração, da falha, da exclusão ou do expurgo. `processado_em` é o instante em que o material saiu de `processando`
 *   (`pronto` ou `falhou`), e `objeto_apagado_em`, o instante em que o objeto foi apagado: nulo é "o objeto pode ainda existir". O material de antes
 *   da F4 nasce com `objeto_apagado_em = enviado_em`, porque nunca teve objeto.
 * - `licenca_id` (ingestao-do-material, 5.0): a licença registrada (`licencaDeMaterial`), nula no material que não é de terceiro. `licenciante` continua gravado junto (o código grava as duas, e a contração é da F4b).
 * - Índice `(escola_id, disciplina_id, id)`: a listagem paginada, da coordenação e do professor pela disciplina dele.
 */
export const material = pgTable(
  'material',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    disciplinaId: uuid().notNull(),
    titulo: text().notNull(),
    titularidade: text().$type<TitularidadeDeMaterial>().notNull(),
    licenciante: text(),
    licenca: text().$type<LicencaDeMaterial>().notNull(),
    declaracao: boolean().notNull(),
    sha256: text().notNull(),
    tamanhoBytes: integer().notNull(),
    paginas: integer(),
    estado: text().$type<EstadoDeMaterial>().notNull().default('processando'),
    falha: text().$type<FalhaDeMaterial>(),
    enviadoPor: uuid(),
    enviadoEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
    excluidoPor: uuid(),
    excluidoEm: timestamp({ withTimezone: true }),
    processadoEm: timestamp({ withTimezone: true }),
    objetoApagadoEm: timestamp({ withTimezone: true }),
    licencaId: uuid(),
  },
  (tabela) => [
    unique('material_escola_id_unico').on(tabela.escolaId, tabela.id),
    unique('material_escola_disciplina_id_unico').on(tabela.escolaId, tabela.disciplinaId, tabela.id),
    foreignKey({ name: 'material_disciplina_da_escola_fk', columns: [tabela.escolaId, tabela.disciplinaId], foreignColumns: [disciplina.escolaId, disciplina.id] }),
    // A migration escreve `on delete set null ("enviado_por")` e `("excluido_por")`: o `set null` inteiro anularia também a escola.
    foreignKey({ name: 'material_enviado_por_da_escola_fk', columns: [tabela.escolaId, tabela.enviadoPor], foreignColumns: [usuario.escolaId, usuario.id] }).onDelete('set null'),
    foreignKey({ name: 'material_excluido_por_da_escola_fk', columns: [tabela.escolaId, tabela.excluidoPor], foreignColumns: [usuario.escolaId, usuario.id] }).onDelete('set null'),
    // A licença do material de terceiro (ingestao-do-material, 5.0): nula enquanto o código anterior grava, e preenchida pelo backfill da 0053 e pelo envio novo (7.0). Sem ação na FK: a
    // licença com material, vivo ou excluído, não sai (o expurgo só a apaga depois do material).
    foreignKey({ name: 'material_licenca_da_escola_fk', columns: [tabela.escolaId, tabela.licencaId], foreignColumns: [licencaDeMaterial.escolaId, licencaDeMaterial.id] }),
    // Quantos materiais a licença cobre (`GET /v1/licencas`) e o `not exists` do expurgo da licença: começa pela escola.
    index('material_licenca_idx').on(tabela.escolaId, tabela.licencaId).where(sql`${tabela.licencaId} is not null`),
    uniqueIndex('material_arquivo_na_escola_unico').on(tabela.escolaId, tabela.sha256).where(sql`${tabela.excluidoEm} is null and ${tabela.estado} <> 'falhou'`),
    index('material_disciplina_idx').on(tabela.escolaId, tabela.disciplinaId, tabela.id),
    // O expurgo do `material_excluido` (F3, tarefa 5.0): só o excluído, do mais antigo.
    index('material_excluido_idx').on(tabela.escolaId, tabela.excluidoEm).where(sql`${tabela.excluidoEm} is not null`),
    // A varredura do PDF que sobrou no storage (ingestao-do-material, 2.0): só o material cujo objeto ainda não foi apagado, e que já saiu de `processando` ou foi excluído.
    // Não começa por `escola_id` (regra 80, item 8) porque a varredura é a rotina nossa, entre escolas, `@Unscoped` e com a justificativa escrita na 2.0; o expurgo por
    // escola (`excluidosComObjeto`) se apoia no `material_excluido_idx`, que começa pela escola.
    index('material_objeto_a_apagar_idx').on(tabela.processadoEm, tabela.excluidoEm).where(sql`${tabela.objetoApagadoEm} is null`),
    // 160 e 120 são `TAMANHO_MAXIMO_TITULO_DO_MATERIAL` e `TAMANHO_MAXIMO_DO_LICENCIANTE` do contrato (`packages/shared`).
    check('material_titulo_preenchido', sql`char_length(btrim(${tabela.titulo})) between 1 and 160`),
    check('material_titularidade_valida', sql`${tabela.titularidade} in ('escola', 'professor', 'terceiro_com_licenca', 'dominio_publico')`),
    check('material_licenca_valida', sql`${tabela.licenca} in ('dominio_publico', 'autoria_da_escola', 'licenca_aberta', 'licenca_comercial_autorizada')`),
    check('material_com_declaracao', sql`${tabela.declaracao}`),
    check('material_licenciante_so_de_terceiro', sql`(${tabela.titularidade} = 'terceiro_com_licenca') = (${tabela.licenciante} is not null)`),
    check('material_licenciante_preenchido', sql`${tabela.licenciante} is null or char_length(btrim(${tabela.licenciante})) between 1 and 120`),
    check('material_sha256_formato', sql`${tabela.sha256} ~ '^[0-9a-f]{64}$'`),
    // 20 MB, `MAXIMO_DE_BYTES_DO_MATERIAL` do contrato.
    check('material_tamanho_valido', sql`${tabela.tamanhoBytes} between 1 and 20971520`),
    check('material_paginas_validas', sql`${tabela.paginas} is null or ${tabela.paginas} >= 1`),
    check('material_estado_valido', sql`${tabela.estado} in ('processando', 'pronto', 'falhou')`),
    check('material_falha_valida', sql`${tabela.falha} is null or ${tabela.falha} in ('arquivo_invalido', 'sem_texto', 'extracao_falhou')`),
    check('material_falha_so_no_que_falhou', sql`(${tabela.estado} = 'falhou') = (${tabela.falha} is not null)`),
    check('material_pronto_tem_paginas', sql`${tabela.estado} <> 'pronto' or ${tabela.paginas} is not null`),
    check('material_excluido_por_so_no_excluido', sql`${tabela.excluidoPor} is null or ${tabela.excluidoEm} is not null`),
  ],
)

/**
 * A licença do material de terceiro, registrada uma vez pela coordenação (ingestao-do-material, tarefa 5.0; Tech Spec, seções 3, 4 e 7; PRD, RF16, RF17 e RF20). Substitui o
 * `licenciante` solto de cada material: o material de terceiro aponta uma licença (`material.licenca_id`), e a que vence tira da busca o que ela cobre (7.0, 9.0).
 *
 * - Pertence ao tenant e não varia por ano letivo, como o material: a licença da editora vale por contrato, não por ano escolar (regra 10, itens 1 e 2).
 * - `licenciante` pode ser nome de pessoa (dado pessoal, `docs/lgpd.md`), e `referencia` é o número ou o apelido do documento, nunca o contrato: ambos ficam **fora** do arquivo do titular.
 * - `vigente_desde` e `vigente_ate` são datas do calendário, no dia de São Paulo; sem fim, `vigente_ate` é nulo e a licença fica até a coordenação a encerrar. Check `licenca_de_material_vigencia_valida`:
 *   o fim não vem antes do começo.
 * - `registrada_por` é a coordenação que a registrou: vira nulo se a pessoa for eliminada (`on delete set null ("registrada_por")`, escrito à mão como na 0022), e a autoria fica na auditoria
 *   (`licenca.registrada`, `licenca.alterada`). Quem alterou nunca é gravado na linha, só na auditoria.
 * - `unique (escola_id, id)` é o alvo da FK composta do material. A licença não se exclui pela API: sai no expurgo de `material_excluido`, contada de `vigente_ate`, depois do último material que a cite.
 * - Índice `(escola_id, vigente_ate)` parcial: o expurgo lê só a licença com fim, do mais antigo.
 */
export const licencaDeMaterial = pgTable(
  'licenca_de_material',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    licenciante: text().notNull(),
    cobertura: text().notNull(),
    referencia: text().notNull(),
    vigenteDesde: date({ mode: 'string' }).notNull(),
    vigenteAte: date({ mode: 'string' }),
    registradaPor: uuid(),
    registradaEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
    alteradaEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [
    unique('licenca_de_material_escola_id_unico').on(tabela.escolaId, tabela.id),
    // A migration escreve `on delete set null ("registrada_por")`: o `set null` inteiro anularia também a escola.
    foreignKey({ name: 'licenca_de_material_registrada_por_da_escola_fk', columns: [tabela.escolaId, tabela.registradaPor], foreignColumns: [usuario.escolaId, usuario.id] }).onDelete('set null'),
    index('licenca_de_material_vigente_ate_idx').on(tabela.escolaId, tabela.vigenteAte).where(sql`${tabela.vigenteAte} is not null`),
    // 120, 300 e 200 são `TAMANHO_MAXIMO_DO_LICENCIANTE`, `TAMANHO_MAXIMO_DA_COBERTURA` e `TAMANHO_MAXIMO_DA_REFERENCIA` do contrato (`packages/shared`).
    check('licenca_de_material_licenciante_preenchido', sql`char_length(btrim(${tabela.licenciante})) between 1 and 120`),
    check('licenca_de_material_cobertura_preenchida', sql`char_length(btrim(${tabela.cobertura})) between 1 and 300`),
    check('licenca_de_material_referencia_preenchida', sql`char_length(btrim(${tabela.referencia})) between 1 and 200`),
    check('licenca_de_material_vigencia_valida', sql`${tabela.vigenteAte} is null or ${tabela.vigenteAte} >= ${tabela.vigenteDesde}`),
  ],
)

/**
 * O envio de material em andamento (ingestao-do-material, tarefa 2.0; Tech Spec, seções 3 e 5, "Envio e edição"; onda 3b, 3. Falha). A
 * linha nasce **antes** do `guardarBytes` e sai na transação do envio: ela é o que faz o PDF que chegou ao storage e nunca teve commit
 * (a API caiu, o PUT atrasado gravou depois do `apagar`) ser achado e apagado pela varredura horária. Sem a linha, o objeto de um envio
 * que não chegou a virar `material` não tem dono e ninguém o procura.
 *
 * - Chave `(escola_id, material_id)`, sem FK para `material`: o material ainda não existe quando a linha nasce, e na maioria dos envios
 *   nunca existirá. A escola tem FK (regra 10, item 1); o id é o UUIDv7 que a aplicação gerou e que a chave do objeto leva.
 * - `criado_em` é o relógio do banco; a varredura o compara com o relógio dela, com uma hora de folga, que cobre o prazo do envio.
 * - Sem pessoa nenhuma: só ids e um instante (`sem_pessoa`, `packages/shared/src/privacidade/classificacao.ts`). Ninguém a lê pela API.
 * - Índice `(criado_em)`: a varredura é rotina nossa, entre escolas (`@Unscoped`, só escola e id), e a tabela é de linhas que duram minutos.
 */
export const envioDeMaterial = pgTable(
  'envio_de_material',
  {
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    materialId: uuid().notNull(),
    criadoEm: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (tabela) => [primaryKey({ name: 'envio_de_material_pk', columns: [tabela.escolaId, tabela.materialId] }), index('envio_de_material_criado_em_idx').on(tabela.criadoEm)],
)

/**
 * Os capítulos que a extração leu do PDF (ingestao-do-material, tarefa 4.0; Tech Spec, seções 3 e 5, "Capítulos"; PRD, RF4): número, título e a faixa de
 * páginas de cada um, do marcador de primeiro nível do PDF ou da linha "Capítulo N" no topo da página. Gravados na transação que tira o material de
 * `processando`, depois da transição, e lidos por `GET /v1/materiais/:id`. Material sem capítulo não tem linha aqui, e termina `pronto` do mesmo jeito.
 *
 * - FK composta `(escola_id, material_id)` para o material, `on delete cascade` (regra 10, item 1): o capítulo nunca aponta para o material de outra escola e
 *   sai com a linha dele, no expurgo de `material_excluido`. Na exclusão lógica ele fica, como o próprio material, até o expurgo.
 * - Único `(escola_id, material_id, ordem)`: a ordem é a posição no material, a partir de 1, e a faixa de páginas não se sobrepõe porque o leitor
 *   a calcula assim. Também é o índice da leitura, que começa pela escola (regra 80, item 8). Gravar os capítulos duas vezes é a violação dele, e não
 *   duas linhas: quem chega depois da transição não grava.
 * - `numero` é o que o PDF escreve ("Capítulo 7"), nulo quando não há número ou ele não cabe em `int`; `titulo` tem de 1 a 200 caracteres.
 * - Sem dado de pessoa: título do material didático da escola. Não varia por ano letivo, como o material.
 */
export const capituloDoMaterial = pgTable(
  'capitulo_do_material',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    escolaId: uuid()
      .notNull()
      .references(() => escola.id),
    materialId: uuid().notNull(),
    ordem: smallint().notNull(),
    numero: integer(),
    titulo: text().notNull(),
    paginaInicial: integer().notNull(),
    paginaFinal: integer().notNull(),
  },
  (tabela) => [
    unique('capitulo_do_material_ordem_unica').on(tabela.escolaId, tabela.materialId, tabela.ordem),
    foreignKey({ name: 'capitulo_do_material_da_escola_fk', columns: [tabela.escolaId, tabela.materialId], foreignColumns: [material.escolaId, material.id] }).onDelete('cascade'),
    // 200 é `TAMANHO_MAXIMO_DO_TITULO_DO_CAPITULO` do contrato (`packages/shared`).
    check('capitulo_do_material_titulo_preenchido', sql`char_length(${tabela.titulo}) between 1 and 200`),
    check('capitulo_do_material_paginas_validas', sql`${tabela.paginaFinal} >= ${tabela.paginaInicial}`),
  ],
)
