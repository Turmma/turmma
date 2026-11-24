import { z } from 'zod'
import { ALTERNATIVAS_POR_QUESTAO, adaptacaoAplicadaSchema, citacaoSchema, habilidadeSchema, type ConteudoDeAtividade } from '../assistente/conteudo.js'
import { MAXIMO_DE_QUESTOES_POR_ATIVIDADE } from '../assistente/conversa.js'
import { paginationQuerySchema, pageSchema } from '../estrutura/pagination.js'
import { DURACAO_MAXIMA_DA_PROVA_MIN, DURACAO_MINIMA_DA_PROVA_MIN, ENVIOS_DA_TENTATIVA, ESTADOS_DE_ATIVIDADE_APLICADA, janelaDaProvaSchema } from './atividade-aplicada.js'

/**
 * O lado do aluno na atividade (MVP, A3): `GET /v1/minhas-atividades`, a prova, as respostas, o envio e o diagnóstico.
 * O aluno só alcança a si (`proprio`): nenhuma resposta daqui traz colega, média da turma, gabarito antes da hora nem
 * resultado de correção que o professor ainda não aprovou (regra 70, item 3).
 *
 * **Duas contagens, para ninguém errar por um:** `questao` é o **número** da questão, a partir de 1, como a turma a vê
 * (a posição em `questoes` mais um); `alternativa` é o **índice** da alternativa, de 0 a 3, o mesmo do `gabarito`.
 */

/** Quantas vezes por minuto o mesmo aluno pode chamar `comecar` (`rl:comecar-prova`, 429 acima): o clique repetido e o laço de reenvio não esgotam a cota dele nem a da escola. */
export const LIMITE_DO_COMECAR_POR_MINUTO = 30

/** O número da questão, de 1 a 20, no caminho (`/respostas/:questao`) e nos corpos. */
export const numeroDaQuestaoSchema = z.coerce.number().int().min(1).max(MAXIMO_DE_QUESTOES_POR_ATIVIDADE)

/**
 * A questão no caminho (`/respostas/:questao`): um ou dois dígitos, e então o intervalo acima. Só dígitos, porque o
 * `coerce` aceitaria `'0x3'`, `'+3'`, `'1e1'` e `'001'`, e nenhum desses é o número de uma questão. Só dígitos também garante
 * o inteiro, e por isso o intervalo não repete o `.int()`. Fora daí nenhuma questão existe assim.
 */
export const questaoDoCaminhoSchema = z
  .string()
  .regex(/^\d{1,2}$/)
  .transform(Number)
  .pipe(z.number().min(1).max(MAXIMO_DE_QUESTOES_POR_ATIVIDADE))

/** O índice da alternativa, de 0 a 3. */
export const alternativaSchema = z.number().int().min(0).max(ALTERNATIVAS_POR_QUESTAO - 1)

/**
 * `para_fazer`: aberta, e o aluno não começou. `em_andamento`: começou e não enviou. `enviada`: enviou, e o professor
 * ainda não aprovou a correção. `encerrada`: o professor encerrou antes de o aluno enviar. `com_diagnostico`: o lote foi
 * aprovado, e o diagnóstico está em `GET /v1/atividades-aplicadas/:id/meu-diagnostico`.
 */
export const SITUACOES_DA_MINHA_ATIVIDADE = ['para_fazer', 'em_andamento', 'enviada', 'encerrada', 'com_diagnostico'] as const
export type SituacaoDaMinhaAtividade = (typeof SITUACOES_DA_MINHA_ATIVIDADE)[number]

/**
 * A duração que o **aluno** lê (`prova` antes de começar e a lista): a da prova com o tempo adicional dele já somado, sem dizer que há tempo adicional nem
 * o percentual (D35). O teto é o dobro do da prova, porque +100% sobre 300 min passa dele; arredondada para cima, em minutos inteiros.
 */
export const duracaoDoAlunoSchema = z.number().int().min(DURACAO_MINIMA_DA_PROVA_MIN).max(DURACAO_MAXIMA_DA_PROVA_MIN * 2)

/** Uma atividade da turma do aluno, na lista dele. Sem acertos: o resultado só existe no diagnóstico, depois da aprovação. A janela e a duração são nulas na atividade sem prova online. */
export const minhaAtividadeSchema = z.strictObject({
  id: z.uuid(),
  titulo: z.string().min(1),
  disciplina: z.strictObject({ id: z.uuid(), nome: z.string().min(1) }),
  avaliativa: z.boolean(),
  situacao: z.enum(SITUACOES_DA_MINHA_ATIVIDADE),
  questoes: z.number().int().min(1),
  respondidas: z.number().int().nonnegative(),
  aplicadaEm: z.iso.datetime(),
  enviadaEm: z.iso.datetime().nullable(),
  janela: janelaDaProvaSchema.nullable(),
  duracaoMin: duracaoDoAlunoSchema.nullable(),
})
export type MinhaAtividade = z.infer<typeof minhaAtividadeSchema>

export const minhasAtividadesQuerySchema = paginationQuerySchema
export type MinhasAtividadesQuery = z.infer<typeof minhasAtividadesQuerySchema>
export const minhasAtividadesResponseSchema = pageSchema(minhaAtividadeSchema)
export type MinhasAtividadesResponse = z.infer<typeof minhasAtividadesResponseSchema>

/**
 * Uma questão como o aluno a recebe: o número, o enunciado e as alternativas. **Sem `gabarito`, sem `explicacao`, sem
 * habilidade e sem citação**: o objeto é estrito, e a questão do artefato inteira não passa por ele.
 */
export const questaoDaProvaSchema = z.strictObject({
  numero: numeroDaQuestaoSchema,
  enunciado: z.string().min(1),
  alternativas: z.array(z.string().min(1)).length(ALTERNATIVAS_POR_QUESTAO),
})
export type QuestaoDaProva = z.infer<typeof questaoDaProvaSchema>

/**
 * A ordem das escolhas do aluno numa questão (regra 80, item 6; RF21): cada escolha leva a sua, e o banco só grava a mais
 * nova. O reenvio atrasado, o F5 e a outra aba não trocam a escolha mais recente. É do aluno da sessão, por questão, e
 * começa em 0 (a linha que existia antes dela).
 */
export const sequenciaSchema = z.number().int().nonnegative()

/** A resposta que o aluno já salvou, para ele continuar de onde parou, com a `sequencia` com que ficou gravada. */
export const respostaSalvaSchema = z.strictObject({ questao: numeroDaQuestaoSchema, alternativa: alternativaSchema, sequencia: sequenciaSchema })
export type RespostaSalva = z.infer<typeof respostaSalvaSchema>

/**
 * O que o navegador guarda em `sessionStorage` da escolha que o servidor ainda não confirmou (53.0, RF21): só ids e
 * números, uma chave por atividade. `dono` é o identificador opaco do aluno da sessão, e é ele que separa "o mesmo aluno
 * voltou" de "sentou outra pessoa no Chromebook". **Estrito e sem coerção**: campo a mais (nome, texto), tipo errado ou
 * número em texto descarta o conjunto inteiro, e o que não passa aqui nunca é mandado nem mostrado (regra 20, item 1).
 */
export const espelhoDaFilaSchema = z.strictObject({
  dono: z.uuid(),
  atividade: z.uuid(),
  pendentes: z
    .array(
      z.strictObject({
        questao: z.number().int().min(1).max(MAXIMO_DE_QUESTOES_POR_ATIVIDADE),
        alternativa: alternativaSchema,
        sequencia: sequenciaSchema,
      }),
    )
    .max(MAXIMO_DE_QUESTOES_POR_ATIVIDADE),
})
export type EspelhoDaFila = z.infer<typeof espelhoDaFilaSchema>

/**
 * Resposta de `GET /v1/atividades-aplicadas/:id/prova`: a atividade como o aluno a faz. `adaptacao` traz só os **tipos**
 * da versão (para a tela ampliar a fonte ou mostrar o tempo extra), e vale para a turma inteira que recebeu a versão.
 * Quem cria a tentativa do aluno, uma só, é `comecar`; ler a prova não grava (avaliacao-e-correcao, 3.0).
 */
export const provaResponseSchema = z.strictObject({
  atividadeAplicadaId: z.uuid(),
  titulo: z.string().min(1),
  avaliativa: z.boolean(),
  estado: z.enum(ESTADOS_DE_ATIVIDADE_APLICADA),
  adaptacao: adaptacaoAplicadaSchema.nullable(),
  questoes: z.array(questaoDaProvaSchema).min(1).max(MAXIMO_DE_QUESTOES_POR_ATIVIDADE),
  respostas: z.array(respostaSalvaSchema).max(MAXIMO_DE_QUESTOES_POR_ATIVIDADE),
  enviadaEm: z.iso.datetime().nullable(),
})
export type ProvaResponse = z.infer<typeof provaResponseSchema>

/**
 * As questões do artefato como o aluno as recebe. É por aqui que a API monta a prova: copia campo a campo, e por isso
 * gabarito, explicação, habilidade e citação não têm como ir junto, mesmo que o artefato ganhe campo novo.
 */
export function questoesDaProva(conteudo: ConteudoDeAtividade): QuestaoDaProva[] {
  return conteudo.questoes.map((questao, indice) => ({ numero: indice + 1, enunciado: questao.enunciado, alternativas: [...questao.alternativas] }))
}

/**
 * Corpo de `PUT /v1/atividades-aplicadas/:id/respostas/:questao`: a alternativa marcada e a `sequencia` dela. Gravação
 * idempotente (regra 80, item 6): a mesma resposta duas vezes é uma linha só, e só a `sequencia` maior troca a anterior:
 * o envio atrasado perde e recebe de volta o que ficou gravado. Sem `sequencia` (cliente antigo), a escolha vale como a
 * mais nova, uma acima da gravada. Depois do envio ou do encerramento responde `ATIVIDADE_ENCERRADA`.
 */
export const responderQuestaoRequestSchema = z.strictObject({ alternativa: alternativaSchema, sequencia: sequenciaSchema.optional() })
export type ResponderQuestaoRequest = z.infer<typeof responderQuestaoRequestSchema>

/**
 * Resposta de `PUT …/respostas/:questao`: o que ficou gravado, para a tela dizer "Resposta salva". Nunca se está certa.
 * Quando o pedido perde para uma `sequencia` maior, a resposta é **a gravada** (alternativa e `sequencia`), não a pedida.
 */
export const questaoSalvaResponseSchema = z.strictObject({
  questao: numeroDaQuestaoSchema,
  alternativa: alternativaSchema,
  sequencia: sequenciaSchema,
  respondidaEm: z.iso.datetime(),
})
export type QuestaoSalvaResponse = z.infer<typeof questaoSalvaResponseSchema>

/** Resposta de `POST /v1/atividades-aplicadas/:id/enviar`: quando foi enviada e quantas questões têm resposta. Enviar de novo devolve o mesmo. */
export const atividadeEnviadaResponseSchema = z.strictObject({
  enviadaEm: z.iso.datetime(),
  respondidas: z.number().int().nonnegative(),
  questoes: z.number().int().min(1),
})
export type AtividadeEnviadaResponse = z.infer<typeof atividadeEnviadaResponseSchema>

/** O acerto numa habilidade: quantas questões dela o aluno acertou, de quantas. Contagem, não nota (D46). */
export const acertoPorHabilidadeSchema = z.strictObject({
  /** `null` é a questão sem habilidade da BNCC (classificacao-bncc, 10.0): a contagem dela não se soma à de nenhuma habilidade. */
  habilidade: habilidadeSchema.nullable(),
  acertos: z.number().int().nonnegative(),
  total: z.number().int().min(1),
})
export type AcertoPorHabilidade = z.infer<typeof acertoPorHabilidadeSchema>

/** Uma questão no diagnóstico: o que o aluno marcou, o gabarito, a explicação e a página. Só existe depois da aprovação. */
export const questaoDoDiagnosticoSchema = z.strictObject({
  numero: numeroDaQuestaoSchema,
  alternativa: alternativaSchema.nullable(),
  gabarito: alternativaSchema,
  correta: z.boolean(),
  explicacao: z.string().min(1),
  citacao: citacaoSchema,
})

/**
 * Resposta de `GET /v1/atividades-aplicadas/:id/meu-diagnostico`: o diagnóstico formativo do próprio aluno, por
 * habilidade e por questão, com quem aprovou e quando. **Só existe com a entrega do lote `aprovada`**: antes disso (lote
 * pendente, rejeitado ou ainda não corrigido) a rota responde como inexistente, igual à atividade de outra turma. Não é
 * nota nem conceito, e não traz a turma nem colega.
 */
export const meuDiagnosticoResponseSchema = z.strictObject({
  atividadeAplicadaId: z.uuid(),
  titulo: z.string().min(1),
  acertos: z.number().int().nonnegative(),
  total: z.number().int().min(1),
  porHabilidade: z.array(acertoPorHabilidadeSchema).max(MAXIMO_DE_QUESTOES_POR_ATIVIDADE),
  questoes: z.array(questaoDoDiagnosticoSchema).min(1).max(MAXIMO_DE_QUESTOES_POR_ATIVIDADE),
  /** Nulo só se quem aprovou foi eliminado da escola depois: a aprovação e a data ficam. */
  aprovadoPor: z.strictObject({ nome: z.string().min(1) }).nullable(),
  aprovadoEm: z.iso.datetime(),
})
export type MeuDiagnosticoResponse = z.infer<typeof meuDiagnosticoResponseSchema>

/**
 * O tempo da prova, como o aluno o lê (`GET …/tempo` e dentro de `comecar` e `prova`): o `limiteEm` **dele** (com o tempo adicional, as
 * extensões e a queda do sistema já somados, sem dizer que há tempo adicional), o `agora` do servidor, que a tela usa para corrigir o desvio do
 * relógio do computador, e `envio`, que diz como a tentativa foi enviada (`aluno`, `limite` ou `encerramento`) ou nulo se ainda está em
 * andamento. `limiteEm` é nulo na prova sem duração nem janela. A tela relê a cada 30 s.
 */
export const tempoDaProvaSchema = z.strictObject({
  limiteEm: z.iso.datetime().nullable(),
  agora: z.iso.datetime(),
  envio: z.enum(ENVIOS_DA_TENTATIVA).nullable(),
})
export type TempoDaProva = z.infer<typeof tempoDaProvaSchema>

/**
 * `GET …/prova` antes de começar: **só a janela e a duração**, nenhuma questão, e nada se grava (U05-15). A duração é a do aluno: quem tem tempo
 * adicional lê a maior, sem saber que é adicional.
 */
export const provaAntesDeComecarResponseSchema = z.strictObject({
  comecou: z.literal(false),
  atividadeAplicadaId: z.uuid(),
  titulo: z.string().min(1),
  janela: janelaDaProvaSchema.nullable(),
  duracaoMin: duracaoDoAlunoSchema.nullable(),
})
export type ProvaAntesDeComecarResponse = z.infer<typeof provaAntesDeComecarResponseSchema>

/**
 * `POST …/comecar` e `GET …/prova` depois de começar: a prova na ordem do aluno (cada questão leva o **número original**; o embaralhamento
 * é só de apresentação) e o tempo. `comecar` é o que cria a tentativa; repetido, devolve a mesma.
 */
export const provaEmAndamentoResponseSchema = provaResponseSchema.extend({ comecou: z.literal(true), tempo: tempoDaProvaSchema }).strict()
export type ProvaEmAndamentoResponse = z.infer<typeof provaEmAndamentoResponseSchema>
export const comecarResponseSchema = provaEmAndamentoResponseSchema
export type ComecarResponse = ProvaEmAndamentoResponse

/** `GET …/prova` da prova online: antes de começar, só a janela e a duração; depois, as questões e o tempo. */
export const provaOnlineResponseSchema = z.discriminatedUnion('comecou', [provaAntesDeComecarResponseSchema, provaEmAndamentoResponseSchema])
export type ProvaOnlineResponse = z.infer<typeof provaOnlineResponseSchema>

/** Resposta de `GET …/tempo`. */
export const tempoResponseSchema = tempoDaProvaSchema
export type TempoResponse = TempoDaProva

/**
 * Corpo de `POST …/saidas-da-aba` (D70): a `chave` é um **uuid v4** gerado pela tela, só para a mesma saída reenviada não contar duas vezes. O v7
 * é recusado: ele carrega o instante da saída, e a saída não tem horário. A resposta é 204.
 */
export const registrarSaidaDaAbaRequestSchema = z.strictObject({ chave: z.uuid({ version: 'v4' }) })
export type RegistrarSaidaDaAbaRequest = z.infer<typeof registrarSaidaDaAbaRequestSchema>
