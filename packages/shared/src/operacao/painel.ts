import { z } from 'zod'
import { tokenDeLinkSchema } from '../sessao/token.js'
import { FORMATO_SLUG, TAMANHO_MAXIMO_SLUG, TIPOS_DE_REDE } from '../estrutura/rede-e-escola.js'
import { TAMANHO_MAXIMO_EMAIL } from '../sessao/login.js'
import { orcamentoVigente, type OrcamentoDefinido, type SituacaoDoOrcamento } from '../governanca/orcamento-de-ia.js'

/** O maior nome de rede, de escola ou de pessoa convidada: o teto do check de `usuario.nome`, `rede.nome` e `escola.nome`. */
export const TAMANHO_MAXIMO_NOME_DIGITADO = 200

/** Quantas redes, no máximo, o `GET /v1/operacao/redes` devolve (Tech Spec da A0b, seção 4). */
export const MAXIMO_DE_REDES_DO_PAINEL = 200

/**
 * Nome de rede, de escola ou da pessoa convidada, digitado pelo operador no painel ou no `ops:*`: texto de uma linha, sem
 * caractere de controle, sem espaço nas pontas.
 */
export const nomeDigitadoSchema = z
  .string()
  .trim()
  .min(1)
  .max(TAMANHO_MAXIMO_NOME_DIGITADO)
  .regex(/^[^\p{Cc}]+$/u)

/**
 * O id que a web sorteia ao abrir o diálogo de rede ou de escola e manda no pedido (Tech Spec da A0b, seção 5,
 * "Idempotência"): o clique duplo repete o mesmo id, e o servidor devolve o que já criou. Só UUID v4 ou v7, os que se
 * sorteiam: nada de id escolhido à mão, sequencial ou nulo (regra 10, item 7).
 */
export const idDoPedidoSchema = z.union([z.uuidv4(), z.uuidv7()])

/** Endereço da escola (`/e/<slug>`), com o formato e o tamanho do check de `escola.slug`. */
export const slugDaEscolaSchema = z.string().max(TAMANHO_MAXIMO_SLUG).regex(FORMATO_SLUG)

/**
 * Corpo de `POST /v1/operacao/redes`. Estrito: campo a mais, como `autor`, é `ENTRADA_INVALIDA`. O autor da auditoria é
 * sempre o operador da sessão, conferido dentro da transação, nunca o corpo (RF6).
 */
export const criarRedeRequestSchema = z.strictObject({
  id: idDoPedidoSchema,
  nome: nomeDigitadoSchema,
  tipo: z.enum(TIPOS_DE_REDE),
})

export type CriarRedeRequest = z.infer<typeof criarRedeRequestSchema>

/** Corpo de `POST /v1/operacao/escolas`. Estrito, como o da rede. O slug não muda depois de criado. */
export const criarEscolaRequestSchema = z.strictObject({
  id: idDoPedidoSchema,
  redeId: z.uuid(),
  nome: nomeDigitadoSchema,
  slug: slugDaEscolaSchema,
})

export type CriarEscolaRequest = z.infer<typeof criarEscolaRequestSchema>

/** Resposta de `POST /v1/operacao/redes` e `/escolas`: só o id, o mesmo no pedido repetido. */
export const criadoNoPainelResponseSchema = z.strictObject({ id: z.uuid() })

export type CriadoNoPainelResponse = z.infer<typeof criadoNoPainelResponseSchema>

/** Quantos micros (milionésimos de real) vale um centavo: a Operação digita em centavos e a API grava e devolve em micros (camada-ia, 3.0; Tech Spec, seção 4). */
export const MICROS_POR_CENTAVO = 10_000

/** O menor e o maior valor de IA por aluno por mês que a Operação define, em centavos: R$ 0,01 e R$ 100,00 (a faixa da Tech Spec, seção 4). */
export const VALOR_MINIMO_DE_IA_POR_ALUNO_CENTAVOS = 1
export const VALOR_MAXIMO_DE_IA_POR_ALUNO_CENTAVOS = 10_000

/** O menor e o maior teto de segurança, em % do orçamento do mês: os do check `*_ia_teto_valido` do banco. */
export const TETO_MINIMO_DE_SEGURANCA_PERCENTUAL = 100
export const TETO_MAXIMO_DE_SEGURANCA_PERCENTUAL = 1000

/** Centavos digitados, em micros gravados. */
export const centavosParaMicros = (centavos: number): number => centavos * MICROS_POR_CENTAVO

/**
 * Corpo de `PUT /v1/operacao/escolas/:id/orcamento-ia` e `/redes/:id/orcamento-ia` (camada-ia, 3.0; RF7): o valor por aluno por mês, em centavos, e o teto de
 * segurança, em %. **Os dois campos são obrigatórios e o `PUT` troca os dois:** `null` é "sem valor próprio", e a escola volta a valer o da rede. Estrito:
 * campo a mais, como `autor` ou `escolaId`, é `ENTRADA_INVALIDA`; a escola ou a rede vem do caminho e o autor, da sessão.
 */
export const orcamentoDeIaRequestSchema = z.strictObject({
  valorPorAlunoCentavos: z.number().int().min(VALOR_MINIMO_DE_IA_POR_ALUNO_CENTAVOS).max(VALOR_MAXIMO_DE_IA_POR_ALUNO_CENTAVOS).nullable(),
  tetoDeSegurancaPercentual: z.number().int().min(TETO_MINIMO_DE_SEGURANCA_PERCENTUAL).max(TETO_MAXIMO_DE_SEGURANCA_PERCENTUAL).nullable(),
})

export type OrcamentoDeIaRequest = z.infer<typeof orcamentoDeIaRequestSchema>

/** O que a escola, ou a rede, define: o valor em micros e o teto em %, cada um nulo onde não definiu. */
export const orcamentoProprioDoPainelSchema = z.strictObject({
  valorPorAlunoMicros: z.number().int().positive().nullable(),
  tetoDeSegurancaPercentual: z.number().int().min(TETO_MINIMO_DE_SEGURANCA_PERCENTUAL).max(TETO_MAXIMO_DE_SEGURANCA_PERCENTUAL).nullable(),
})

/** O que vale hoje, com a origem de cada número: o valor é nulo (e a origem, `nenhuma`) quando nem a escola nem a rede definiram. */
export const orcamentoVigenteDoPainelSchema = z.strictObject({
  valorPorAlunoMicros: z.number().int().positive().nullable(),
  origemDoValor: z.enum(['escola', 'rede', 'nenhuma']),
  tetoDeSegurancaPercentual: z.number().int().min(TETO_MINIMO_DE_SEGURANCA_PERCENTUAL).max(TETO_MAXIMO_DE_SEGURANCA_PERCENTUAL),
  origemDoTeto: z.enum(['escola', 'rede', 'padrao']),
})

/** O orçamento de IA de uma escola ou de uma rede no painel: o próprio e o vigente. Só valor, teto e origem: nada de pessoa. */
export const orcamentoDeIaDoPainelSchema = z.strictObject({
  proprio: orcamentoProprioDoPainelSchema,
  vigente: orcamentoVigenteDoPainelSchema,
})

export type OrcamentoDeIaDoPainel = z.infer<typeof orcamentoDeIaDoPainelSchema>

const SEM_ORCAMENTO_DEFINIDO: OrcamentoDefinido = { valorPorAlunoMicros: null, tetoPercentual: null }

function orcamentoDoPainel(proprio: OrcamentoDefinido, vigente: ReturnType<typeof orcamentoVigente>): OrcamentoDeIaDoPainel {
  return {
    proprio: { valorPorAlunoMicros: proprio.valorPorAlunoMicros, tetoDeSegurancaPercentual: proprio.tetoPercentual },
    vigente: {
      valorPorAlunoMicros: vigente.valorPorAlunoMicros,
      origemDoValor: vigente.origemDoValor,
      tetoDeSegurancaPercentual: vigente.tetoPercentual,
      origemDoTeto: vigente.origemDoTeto,
    },
  }
}

/** O orçamento da escola no painel: o que ela define e o que vale, a escola sobre a rede, coluna a coluna (`orcamentoVigente`, a mesma conta do lote e da Governança). */
export function orcamentoDaEscolaNoPainel(escola: OrcamentoDefinido, rede: OrcamentoDefinido): OrcamentoDeIaDoPainel {
  return orcamentoDoPainel(escola, orcamentoVigente(escola, rede))
}

/** O orçamento da rede no painel: o que ela define e o que vale para uma escola sem nada próprio (a origem é `rede`, ou `nenhuma` e `padrao` onde a rede também não definiu). */
export function orcamentoDaRedeNoPainel(rede: OrcamentoDefinido): OrcamentoDeIaDoPainel {
  return orcamentoDoPainel(rede, orcamentoVigente(SEM_ORCAMENTO_DEFINIDO, rede))
}

/**
 * Uma rede na lista do painel: id, nome e tipo, o orçamento de IA dela e **quantas escolas usam o valor ou o teto da rede** (a escola sem valor próprio com a rede definindo valor,
 * ou sem teto próprio com a rede definindo teto): é o número que o diálogo mostra antes de salvar. Nada de escola nem de pessoa.
 */
export const redeDoPainelSchema = z.strictObject({
  id: z.uuid(),
  nome: z.string().min(1).max(TAMANHO_MAXIMO_NOME_DIGITADO),
  tipo: z.enum(TIPOS_DE_REDE),
  orcamento: orcamentoDeIaDoPainelSchema,
  escolasQueUsamOValorDaRede: z.number().int().nonnegative(),
})

export type RedeDoPainel = z.infer<typeof redeDoPainelSchema>

/** Resposta de `GET /v1/operacao/redes`: até 200 redes, por nome, para o diálogo Nova escola. */
export const redesDoPainelResponseSchema = z.strictObject({
  itens: z.array(redeDoPainelSchema).max(MAXIMO_DE_REDES_DO_PAINEL),
})

export type RedesDoPainelResponse = z.infer<typeof redesDoPainelResponseSchema>

/**
 * O estado da primeira coordenação de uma escola (Tech Spec da A0b, seção 5), que decide o que gerar, refazer e revogar
 * fazem, e que a lista mostra. Calculado só por `estadoDaCoordenacao`, em `@educa/core`: a escrita e a lista usam a
 * mesma função.
 */
export const ESTADOS_DA_COORDENACAO = ['sem_convite', 'pendente', 'vencido', 'revogado', 'aceito', 'sem_coordenacao', 'ativa'] as const

export type EstadoDaCoordenacao = (typeof ESTADOS_DA_COORDENACAO)[number]

/**
 * A matriz estado × ação do convite da coordenação (Tech Spec da A0b, seção 5), num lugar só: o servidor decide por ela,
 * sob a trava da escola, e a lista do painel mostra só as ações que ela permite no estado que a API deu (tarefa 7.0).
 * O que a tela oferece é espelho; quem recusa é o servidor, com `CONFLITO` ou `NAO_ENCONTRADO`.
 */

/** Gerar: cria; em `aceito` e `sem_coordenacao`, revoga o último convite na mesma transação e cria. */
export const GERAR_CONVITE_POR_ESTADO: Readonly<Record<EstadoDaCoordenacao, 'criar' | 'revogar_o_ultimo_e_criar' | 'conflito'>> = {
  sem_convite: 'criar',
  revogado: 'criar',
  sem_coordenacao: 'revogar_o_ultimo_e_criar',
  aceito: 'revogar_o_ultimo_e_criar',
  pendente: 'conflito',
  vencido: 'conflito',
  ativa: 'conflito',
}

/**
 * Refazer (do último convite): só o convite em aberto, pendente ou vencido. `sem_convite` não chega ao servidor com um
 * convite a passar: o id é o de um inexistente, e a resposta é `NAO_ENCONTRADO`.
 */
export const REFAZER_CONVITE_POR_ESTADO: Readonly<Record<EstadoDaCoordenacao, 'refazer' | 'conflito'>> = {
  pendente: 'refazer',
  vencido: 'refazer',
  sem_convite: 'conflito',
  revogado: 'conflito',
  aceito: 'conflito',
  sem_coordenacao: 'conflito',
  ativa: 'conflito',
}

/**
 * Revogar (o último convite). `revogado` fica `NAO_ENCONTRADO`, como no F1. `sem_convite` também: o id que a rota recebe
 * não acha convite de coordenação, e a resposta é `NAO_ENCONTRADO` antes de a matriz ser lida; a entrada diz o mesmo, para
 * a matriz ser a tabela da Tech Spec, e é o que valeria se o convite sumisse entre achar a escola e ler o estado.
 */
export const REVOGAR_CONVITE_POR_ESTADO: Readonly<Record<EstadoDaCoordenacao, 'revogar' | 'conflito' | 'nao_encontrado'>> = {
  pendente: 'revogar',
  vencido: 'revogar',
  aceito: 'revogar',
  revogado: 'nao_encontrado',
  sem_convite: 'nao_encontrado',
  sem_coordenacao: 'conflito',
  ativa: 'conflito',
}

/**
 * O e-mail da pessoa convidada, digitado no painel ou no `ops:convite-coordenador`: sem espaço nas pontas, em minúsculas
 * (como o login o procura), no formato de e-mail e até 254.
 */
export const emailConvidadoSchema = z.string().trim().toLowerCase().pipe(z.email().max(TAMANHO_MAXIMO_EMAIL))

/**
 * Corpo de `POST /v1/operacao/escolas/:id/convite-coordenacao`: o nome e o e-mail da primeira coordenadora. Estrito: campo
 * a mais, como `autor` ou `escolaId`, é `ENTRADA_INVALIDA`. A escola vem do caminho; o autor, da sessão.
 */
export const conviteDaCoordenacaoRequestSchema = z.strictObject({
  nome: nomeDigitadoSchema,
  email: emailConvidadoSchema,
})

export type ConviteDaCoordenacaoRequest = z.infer<typeof conviteDaCoordenacaoRequestSchema>

/**
 * Resposta do gerar (`POST /v1/operacao/escolas/:id/convite-coordenacao`) e do refazer
 * (`POST /v1/operacao/convites/:id/refazer`): o id do convite novo (que o refazer e o revogar recebem) e o token, que só
 * existe nesta resposta (o banco guarda o SHA-256). A web monta o link `/convite#<token>`. Sai com `no-store`. Estrito:
 * nada da pessoa.
 */
export const conviteDaCoordenacaoResponseSchema = z.strictObject({
  conviteId: z.uuid(),
  token: tokenDeLinkSchema,
})

export type ConviteDaCoordenacaoResponse = z.infer<typeof conviteDaCoordenacaoResponseSchema>

/** Quantas escolas cada página da lista e do uso traz (Tech Spec da A0b, seções 4 e 5; D25). */
export const ESCOLAS_POR_PAGINA = 25

/** A maior página pedida: com 25 por página, 250 mil escolas, muito acima do primeiro ano (D25). O deslocamento fica limitado. */
export const MAXIMA_PAGINA_DO_PAINEL = 10_000

/**
 * As ordens da lista e do uso: `nome` (crescente), ou `uso`, pelas requisições do mês de referência (decrescente, calculado
 * para todas as escolas antes de paginar). Nas duas, o desempate é pelo `id`, e a página seguinte continua de onde a
 * anterior parou.
 */
export const ORDENS_DO_PAINEL = ['nome', 'uso'] as const

export type OrdemDoPainel = (typeof ORDENS_DO_PAINEL)[number]

/**
 * Consulta de `GET /v1/operacao/escolas` e `GET /v1/operacao/uso`: `?pagina=` (de 1, padrão 1) e `?ordem=` (padrão
 * `nome`). Estrita: nada de escola, rede ou filtro a mais, e o parâmetro repetido não passa.
 */
export const painelQuerySchema = z.strictObject({
  pagina: z.coerce.number().int().min(1).max(MAXIMA_PAGINA_DO_PAINEL).default(1),
  ordem: z.enum(ORDENS_DO_PAINEL).default('nome'),
})

export type PainelQuery = z.infer<typeof painelQuerySchema>

/**
 * As ordens do uso (camada-ia, 5.0): as da lista e `custo`, o custo de IA do mês corrente (decrescente, calculado para todas as escolas antes de paginar). O `custo` é **só do uso**: a aba Escolas
 * segue com `ORDENS_DO_PAINEL`, e `?ordem=custo` em `GET /v1/operacao/escolas` é `ENTRADA_INVALIDA`.
 */
export const ORDENS_DO_USO_DO_PAINEL = [...ORDENS_DO_PAINEL, 'custo'] as const

export type OrdemDoUso = (typeof ORDENS_DO_USO_DO_PAINEL)[number]

/** Consulta de `GET /v1/operacao/uso`: a da lista, com a ordem por custo. Estrita, como a da lista. */
export const usoDoPainelQuerySchema = z.strictObject({
  pagina: painelQuerySchema.shape.pagina,
  ordem: z.enum(ORDENS_DO_USO_DO_PAINEL).default('nome'),
})

export type UsoDoPainelQuery = z.infer<typeof usoDoPainelQuerySchema>

const contagemSchema = z.number().int().nonnegative()

/**
 * Uma escola na lista do painel: id, nome, endereço, a rede, o estado da primeira coordenação (com o id do último convite
 * de coordenação, quando há, para refazer e revogar) e as contagens do ano letivo em curso. **Só número**: nada de nome,
 * e-mail ou matrícula de pessoa, nem nome de turma (RF3).
 */
export const escolaDoPainelSchema = z.strictObject({
  id: z.uuid(),
  nome: z.string().min(1).max(TAMANHO_MAXIMO_NOME_DIGITADO),
  slug: slugDaEscolaSchema,
  rede: z.strictObject({ id: z.uuid(), nome: z.string().min(1).max(TAMANHO_MAXIMO_NOME_DIGITADO) }),
  estado: z.enum(ESTADOS_DA_COORDENACAO),
  conviteId: z.uuid().optional(),
  turmas: contagemSchema,
  professores: contagemSchema,
  alunos: contagemSchema,
  orcamento: orcamentoDeIaDoPainelSchema,
})

export type EscolaDoPainel = z.infer<typeof escolaDoPainelSchema>

/** Resposta de `GET /v1/operacao/escolas`: a página (até 25), o número dela e o total de escolas. */
export const escolasDoPainelResponseSchema = z.strictObject({
  itens: z.array(escolaDoPainelSchema).max(ESCOLAS_POR_PAGINA),
  pagina: z.number().int().min(1),
  total: contagemSchema,
})

export type EscolasDoPainelResponse = z.infer<typeof escolasDoPainelResponseSchema>

/** O uso de infra de uma escola num período (D30): requisições, jobs e bytes de storage. */
export const usoDoPeriodoDoPainelSchema = z.strictObject({
  requisicoes: contagemSchema,
  jobs: contagemSchema,
  bytesStorage: contagemSchema,
})

export type UsoDoPeriodoDoPainel = z.infer<typeof usoDoPeriodoDoPainelSchema>

/**
 * O uso de IA de uma escola num período (camada-ia, 5.0; RF11): as execuções (uma por execução, e uma por linha sem execução), as chamadas (uma por linha de consumo), os tokens (entrada e saída), o custo em
 * micros e quantas chamadas a reserva atendeu. **Só número**: nenhuma pessoa, nenhuma função, nenhum modelo.
 */
export const usoDeIaDoPeriodoDoPainelSchema = z.strictObject({
  execucoes: contagemSchema,
  chamadas: contagemSchema,
  tokens: contagemSchema,
  custoMicros: contagemSchema,
  chamadasPeloProvedorDeReserva: contagemSchema,
})

export type UsoDeIaDoPeriodoDoPainel = z.infer<typeof usoDeIaDoPeriodoDoPainelSchema>

const valorPorAlunoMicrosSchema = z.number().int().positive().nullable()
const origemDoValorSchema = z.enum(['escola', 'rede', 'nenhuma'])
/** Como está o orçamento do mês corrente: o mês de agora nunca é `sem_retrato`, que é do mês fechado antes da medição. */
const situacaoDoMesCorrenteSchema = z.enum(['definido', 'sem_orcamento', 'sem_aluno_ativo'] satisfies readonly SituacaoDoOrcamento[])
const situacaoDoMesFechadoSchema = z.enum(['definido', 'sem_orcamento', 'sem_aluno_ativo', 'sem_retrato'] satisfies readonly SituacaoDoOrcamento[])
const porcentagemSchema = z.number().int().nonnegative().nullable()

/**
 * O grupo `ia` de uma escola no uso: `hoje` (o dia de São Paulo até agora) e `mes` (o mês de São Paulo de agora), os alunos ativos de hoje, o valor por aluno que vale com a origem dele, a porcentagem do
 * orçamento e a situação. A porcentagem é nula fora de `definido` (sem divisão por zero), e os reais seguem visíveis.
 */
export const usoDeIaDaEscolaDoPainelSchema = z.strictObject({
  hoje: usoDeIaDoPeriodoDoPainelSchema,
  mes: usoDeIaDoPeriodoDoPainelSchema,
  alunosAtivos: contagemSchema,
  valorPorAlunoMicros: valorPorAlunoMicrosSchema,
  origemDoValor: origemDoValorSchema,
  porcentagem: porcentagemSchema,
  situacao: situacaoDoMesCorrenteSchema,
})

export type UsoDeIaDaEscolaDoPainel = z.infer<typeof usoDeIaDaEscolaDoPainelSchema>

/**
 * O uso de uma escola: o do último dia fechado e o do mês dele, até esse dia (requisições e jobs somados, e o pico de
 * bytes), mais o grupo `ia` de hoje e do mês corrente. Zero quando não há linha. Só id, nome e número.
 *
 * `rede` e `orcamento` (o próprio e o vigente) são os de `EscolaDoPainel`, fora do `ia` (camada-ia, 8.0): a aba Uso monta com eles o alvo do diálogo "Orçamento de IA" da própria linha, sem outra rota.
 */
export const usoDaEscolaDoPainelSchema = z.strictObject({
  id: z.uuid(),
  nome: z.string().min(1).max(TAMANHO_MAXIMO_NOME_DIGITADO),
  rede: escolaDoPainelSchema.shape.rede,
  orcamento: orcamentoDeIaDoPainelSchema,
  dia: usoDoPeriodoDoPainelSchema,
  mes: usoDoPeriodoDoPainelSchema,
  ia: usoDeIaDaEscolaDoPainelSchema,
})

export type UsoDaEscolaDoPainel = z.infer<typeof usoDaEscolaDoPainelSchema>

/**
 * Resposta de `GET /v1/operacao/uso`: a página, o total, e as referências: `dia`, o último dia fechado (o dia civil de
 * São Paulo anterior ao de hoje, `AAAA-MM-DD`), e `mes`, o mês dele (`AAAA-MM`), contado do dia 1 até `dia`. O dia de
 * hoje só aparece depois da consolidação.
 */
export const usoDoPainelResponseSchema = z.strictObject({
  itens: z.array(usoDaEscolaDoPainelSchema).max(ESCOLAS_POR_PAGINA),
  pagina: z.number().int().min(1),
  total: contagemSchema,
  dia: z.iso.date(),
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
})

export type UsoDoPainelResponse = z.infer<typeof usoDoPainelResponseSchema>

/** Quantos meses `GET /v1/operacao/escolas/:id/uso-ia` devolve: os 12 anteriores ao mês corrente (camada-ia, 5.0). */
export const MESES_DO_USO_DE_IA = 12

/**
 * Um mês fechado de uma escola, **pelo retrato**: o `AAAA-MM`, os números do consumo dele (os de `ia.mes`) e o orçamento que o retrato gravou (alunos, valor, origem, porcentagem, situação). O mês sem retrato
 * (fechado antes da medição) é `sem_retrato`, com só o consumo e o resto nulo. Nenhum aviso: ele só existe no mês corrente.
 */
export const mesDoUsoDeIaDaEscolaSchema = usoDeIaDoPeriodoDoPainelSchema.extend({
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  alunosAtivos: contagemSchema.nullable(),
  valorPorAlunoMicros: valorPorAlunoMicrosSchema,
  origemDoValor: origemDoValorSchema.nullable(),
  porcentagem: porcentagemSchema,
  situacao: situacaoDoMesFechadoSchema,
})

export type MesDoUsoDeIaDaEscola = z.infer<typeof mesDoUsoDeIaDaEscolaSchema>

/** Resposta de `GET /v1/operacao/escolas/:id/uso-ia`: exatamente os 12 meses anteriores ao corrente, do mais recente ao mais antigo. */
export const usoDeIaDaEscolaDoPainelResponseSchema = z.strictObject({
  meses: z.array(mesDoUsoDeIaDaEscolaSchema).length(MESES_DO_USO_DE_IA),
})

export type UsoDeIaDaEscolaDoPainelResponse = z.infer<typeof usoDeIaDaEscolaDoPainelResponseSchema>
