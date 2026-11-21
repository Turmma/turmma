import {
  centavosParaMicros,
  orcamentoDaEscolaNoPainel,
  orcamentoDaRedeNoPainel,
  type OrcamentoDefinido,
  type OrcamentoDeIaDoPainel,
  type OrcamentoDeIaRequest,
  type RedeDoPainel,
} from '@educa/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleAlert } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { LoadingState } from '../../components/states'
import { Button } from '../../components/ui/Button'
import { SECONDARY_BUTTON_CLASSES } from '../../components/ui/button-variants'
import { FormField } from '../../components/ui/fields/FormField'
import { ESCOLAS_QUERY_KEY, REDES_QUERY_KEY, USO_QUERY_KEY, dasRedesQueryOptions, definirOrcamentoNoPainel } from '../api/painel'
import { pedidoDeOrcamento, type CampoDoOrcamento } from '../pedidos-do-painel'
import {
  DICA_DO_TETO_DA_ESCOLA,
  DICA_DO_TETO_DA_REDE,
  DICA_DO_VALOR_DA_ESCOLA,
  DICA_DO_VALOR_DA_REDE,
  TEXTO_DO_CARREGAMENTO_QUE_FALHOU,
  RespostaForaDoContrato,
  TEXTO_PARA_ATUALIZAR,
  textoDoErroAoSalvar,
  textoDasEscolasQueMudam,
  textoDoAntesEDepois,
  textoDoValeHoje,
  valorDoCampoEmReais,
} from '../textos'
import { DialogoDaOperacao } from './DialogoDaOperacao'

/**
 * De quem é o orçamento que o diálogo define. A rede vem pelo id e pelo nome, e o orçamento dela, pela lista de redes
 * (`GET /v1/operacao/redes`, que traz também quantas escolas usam o valor dela). A escola traz o orçamento da linha que
 * o operador acionou, fotografado na abertura, e a rede dela, para o "Usar o valor da rede" e o "Depois".
 */
export type AlvoDoOrcamento =
  | { readonly tipo: 'rede'; readonly id: string; readonly nome: string }
  | { readonly tipo: 'escola'; readonly id: string; readonly nome: string; readonly redeId: string; readonly orcamento: OrcamentoDeIaDoPainel }

interface Props {
  readonly alvo: AlvoDoOrcamento
  /** Quem fecha é quem desmonta: a tela que abriu o diálogo, pela abertura dele. */
  readonly aoFechar: () => void
  /** O orçamento foi salvo, e as listas já foram marcadas para ler de novo: a tela anuncia e fecha este diálogo. */
  readonly aoSalvar: () => void
  /** O foco ao fechar quando o botão que abriu já saiu da linha (`DialogoDaOperacao`). */
  readonly focoDeReserva?: () => void
}

/** O erro de um campo, no desenho do `FieldError`, mas **anunciado**: `role="alert"` e o `id` que o campo aponta pelo `aria-describedby` (cenário da seção 4). */
function ErroDoCampo({ id, children }: { readonly id: string; readonly children: string }) {
  return (
    <p id={id} role="alert" className="t-apoio flex min-w-0 items-start gap-1.5 font-bold break-words text-vermelho-texto">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4.5 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

/** O orçamento da rede como a conta do contrato o lê: valor em micros e teto em %, nulo onde não definiu. */
function definidoPelaRede(rede: RedeDoPainel): OrcamentoDefinido {
  return { valorPorAlunoMicros: rede.orcamento.proprio.valorPorAlunoMicros, tetoPercentual: rede.orcamento.proprio.tetoDeSegurancaPercentual }
}

/**
 * O diálogo "Orçamento de IA" da Operação (camada-ia, 7.0; RF7): o valor de IA por aluno por mês e o teto de segurança da
 * rede ou da escola, com o que vale hoje e, **antes** de "Salvar orçamento", o antes e o depois; na rede, quantas
 * escolas mudam junto (regra 50, item 8). Na escola, "Usar o valor da rede" tira o valor próprio e a escola volta a valer
 * o da rede. A Tela Escolas o abre da linha da rede e da linha da escola; a aba Uso, de "Definir orçamento" (8.0).
 *
 * A lista de redes é lida aqui (a mesma do Nova escola, no mesmo cache): é dela que vêm o orçamento da rede, para o
 * "Depois" da escola, e a contagem de escolas. Os quatro estados: carregando, erro com "Tentar de novo", a resposta que a
 * web não reconhece ("Atualize a página") e o formulário.
 */
export function DialogoDoOrcamento({ alvo, aoFechar, aoSalvar, focoDeReserva }: Props) {
  const redes = useQuery(dasRedesQueryOptions)
  const redeId = alvo.tipo === 'rede' ? alvo.id : alvo.redeId
  const rede = redes.data?.itens.find((candidata) => candidata.id === redeId)
  // A web antiga lendo a API nova: atualizar a página resolve, e "Tentar de novo" não.
  const forDoContrato = redes.error instanceof RespostaForaDoContrato
  return (
    <DialogoDaOperacao titulo="Orçamento de IA" aoFechar={aoFechar} {...(focoDeReserva === undefined ? {} : { focoDeReserva })}>
      <p className="mt-1 wrap-anywhere text-apoio">
        {alvo.tipo === 'rede' ? 'Rede ' : 'Escola '}
        <span className="font-medium text-tinta">{alvo.nome}</span>
      </p>
      {rede !== undefined ? (
        <FormularioDoOrcamento alvo={alvo} rede={rede} aoFechar={aoFechar} aoSalvar={aoSalvar} />
      ) : redes.isPending ? (
        <div className="mt-4">
          <LoadingState rotulo="Carregando o orçamento…" />
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <p role="alert" className="rounded-controle border border-erro bg-erro-cx p-3 text-erro">
            {forDoContrato ? TEXTO_PARA_ATUALIZAR : TEXTO_DO_CARREGAMENTO_QUE_FALHOU}
          </p>
          <div className="flex flex-wrap gap-3">
            {!forDoContrato && (
              <Button onClick={() => void redes.refetch()} disabled={redes.isFetching}>
                Tentar de novo
              </Button>
            )}
            <button type="button" onClick={aoFechar} className={SECONDARY_BUTTON_CLASSES}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </DialogoDaOperacao>
  )
}

interface PropsDoFormulario {
  readonly alvo: AlvoDoOrcamento
  readonly rede: RedeDoPainel
  readonly aoFechar: () => void
  readonly aoSalvar: () => void
}

type Vigente = OrcamentoDeIaDoPainel['vigente']

/** A ajuda abaixo de cada campo, por quem define: a rede deixa o valor em branco para não definir, e a escola, o teto para valer o da rede. */
const DICAS = {
  rede: { valor: DICA_DO_VALOR_DA_REDE, teto: DICA_DO_TETO_DA_REDE },
  escola: { valor: DICA_DO_VALOR_DA_ESCOLA, teto: DICA_DO_TETO_DA_ESCOLA },
} as const

/**
 * O que vale **depois** do pedido, pela mesma conta da API (`orcamentoDaRedeNoPainel` e `orcamentoDaEscolaNoPainel`, de
 * `packages/shared`): a escola sobre a rede, coluna a coluna. A tela não tem conta própria.
 */
function vigenteDepoisDe(alvo: AlvoDoOrcamento, rede: RedeDoPainel, pedido: OrcamentoDeIaRequest): Vigente {
  const { valorPorAlunoCentavos, tetoDeSegurancaPercentual } = pedido
  const definido: OrcamentoDefinido = {
    valorPorAlunoMicros: valorPorAlunoCentavos === null ? null : centavosParaMicros(valorPorAlunoCentavos),
    tetoPercentual: tetoDeSegurancaPercentual,
  }
  return (alvo.tipo === 'rede' ? orcamentoDaRedeNoPainel(definido) : orcamentoDaEscolaNoPainel(definido, definidoPelaRede(rede))).vigente
}

/** O valor ou o teto vigente mudou? É o que decide dizer "Muda o orçamento de N escolas". */
function mudaOVigente(antes: Vigente, depois: Vigente): boolean {
  return depois.valorPorAlunoMicros !== antes.valorPorAlunoMicros || depois.tetoDeSegurancaPercentual !== antes.tetoDeSegurancaPercentual
}

/** `PUT` do orçamento: ao dar certo, as três listas que o mostram deixam de valer e a tela anuncia e fecha. */
function useSalvarOrcamento(alvo: AlvoDoOrcamento, aoSalvar: () => void) {
  const clienteDeConsultas = useQueryClient()
  return useMutation({
    mutationFn: (pedido: OrcamentoDeIaRequest) => definirOrcamentoNoPainel({ tipo: alvo.tipo, id: alvo.id }, pedido),
    onSuccess: async () => {
      // O orçamento aparece na lista de redes, na de escolas e no Uso: as três deixam de valer, e a próxima leitura as traz.
      await Promise.all([ESCOLAS_QUERY_KEY, REDES_QUERY_KEY, USO_QUERY_KEY].map((queryKey) => clienteDeConsultas.invalidateQueries({ queryKey })))
      aoSalvar()
    },
  })
}

interface PropsDoCampo {
  readonly rotulo: string
  readonly dica: string
  readonly name: string
  readonly inputMode: 'decimal' | 'numeric'
  readonly valor: string
  readonly aoMudar: (valor: string) => void
  readonly erro: string | undefined
  readonly desligado?: boolean
}

/** Um campo do diálogo: rótulo, dica, e o erro **anunciado** ligado a ele por `aria-describedby`. */
function CampoDoDialogo({ rotulo, dica, name, inputMode, valor, aoMudar, erro, desligado = false }: PropsDoCampo) {
  const idDoErro = useId()
  return (
    <div className="flex flex-col gap-1">
      <FormField
        rotulo={rotulo}
        dica={dica}
        name={name}
        type="text"
        inputMode={inputMode}
        autoComplete="off"
        value={valor}
        onChange={(evento) => aoMudar(evento.target.value)}
        disabled={desligado}
        descritoTambemPor={erro === undefined ? '' : idDoErro}
        {...(erro === undefined ? {} : { 'aria-invalid': true })}
      />
      {erro !== undefined && <ErroDoCampo id={idDoErro}>{erro}</ErroDoCampo>}
    </div>
  )
}

interface PropsDoAntesEDepois {
  readonly id: string
  readonly antes: Vigente
  readonly depois: Vigente
  /** Quantas escolas usam o valor ou o teto da rede; só o diálogo da rede o traz. */
  readonly escolasDaRede: number | undefined
}

/** O que vai acontecer ao salvar (regra 50, item 8): o antes e o depois e, na rede, quantas escolas mudam junto. */
function AntesEDepois({ id, antes, depois, escolasDaRede }: PropsDoAntesEDepois) {
  // A escola não tem a contagem: zero escolas, e a frase de quem muda não aparece.
  const quantas = escolasDaRede ?? 0
  const escolasQueMudam = quantas > 0 && mudaOVigente(antes, depois)
  return (
    <div id={id} className="flex flex-col gap-1 rounded-controle border-2 border-borda bg-fundo-suave p-3">
      <p className="wrap-anywhere">{textoDoAntesEDepois(antes, depois)}</p>
      {escolasQueMudam && <p className="wrap-anywhere">{textoDasEscolasQueMudam(quantas)}</p>}
    </div>
  )
}

/** "Usar o valor da rede": a escola sem valor próprio. Caixa de 24 px, na linha de 44 (regra 50, item 2a). */
function CaixaDoValorDaRede({ marcada, aoMudar }: { readonly marcada: boolean; readonly aoMudar: (marcada: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center gap-3">
      <input type="checkbox" checked={marcada} onChange={(evento) => aoMudar(evento.target.checked)} className="h-6 w-6 shrink-0" />
      Usar o valor da rede
    </label>
  )
}

/** A recusa do `PUT` (o 429 com os minutos, o 503, a resposta fora do contrato), anunciada; "Salvar orçamento" tenta de novo. */
function FalhaAoSalvar({ erro }: { readonly erro: unknown }) {
  return (
    <p role="alert" className="rounded-controle border border-erro bg-erro-cx p-3 text-erro">
      {textoDoErroAoSalvar(erro)}
    </p>
  )
}

interface PropsDasAcoes {
  readonly salvando: boolean
  /** O id do antes e depois, quando ele está na tela: o leitor de tela o lê ao chegar em "Salvar orçamento". */
  readonly descritoPor: string | undefined
  readonly aoFechar: () => void
}

/** Salvar e Cancelar, do mesmo tamanho (D59), e o aviso do envio para o leitor de tela. */
function AcoesDoOrcamento({ salvando, descritoPor, aoFechar }: PropsDasAcoes) {
  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={salvando} aria-describedby={descritoPor}>
          {salvando ? 'Salvando…' : 'Salvar orçamento'}
        </Button>
        <button type="button" onClick={aoFechar} className={SECONDARY_BUTTON_CLASSES}>
          Cancelar
        </button>
      </div>
      <span role="status" className="sr-only">
        {salvando ? 'Salvando o orçamento…' : ''}
      </span>
    </>
  )
}

/** Na escola, quem decide é a caixa; na rede, o campo em branco é "a rede não define valor". */
function semValorDoFormulario(alvo: AlvoDoOrcamento, daRede: boolean, valor: string): boolean {
  return alvo.tipo === 'escola' ? daRede : valor.trim() === ''
}

/** Os erros só aparecem depois da primeira tentativa de salvar; daí em diante seguem o que está digitado. */
function errosDaTela(tentou: boolean, validacao: ReturnType<typeof pedidoDeOrcamento>): Partial<Record<CampoDoOrcamento, string>> {
  return tentou && !validacao.ok ? validacao.erros : {}
}

/** O que está gravado vira o que o formulário mostra ao abrir: o valor em reais, o teto em %, e a caixa marcada quando a escola não tem valor próprio. */
function camposDoOrcamentoGravado({ proprio }: OrcamentoDeIaDoPainel) {
  return {
    valor: proprio.valorPorAlunoMicros === null ? '' : valorDoCampoEmReais(proprio.valorPorAlunoMicros),
    teto: proprio.tetoDeSegurancaPercentual === null ? '' : String(proprio.tetoDeSegurancaPercentual),
    daRede: proprio.valorPorAlunoMicros === null,
  }
}

/** O formulário já com o orçamento à mão: o que o operador vê ao abrir é o que está gravado, e o que digita é só dele até salvar. */
function FormularioDoOrcamento({ alvo, rede, aoFechar, aoSalvar }: PropsDoFormulario) {
  const atual = alvo.tipo === 'rede' ? rede.orcamento : alvo.orcamento
  const [inicial] = useState(() => camposDoOrcamentoGravado(atual))
  const [valor, definirValor] = useState(inicial.valor)
  const [teto, definirTeto] = useState(inicial.teto)
  const [daRede, definirDaRede] = useState(inicial.daRede)
  const [tentou, definirTentou] = useState(false)
  // O pedido no ar, na hora: o `isPending` da mutação só chega à tela no próximo render, e o segundo clique de um clique
  // duplo chega antes dele. O `PUT` é idempotente; aqui o segundo nem sai.
  const noAr = useRef(false)
  const formulario = useRef<HTMLFormElement>(null)
  const idDoAntesEDepois = useId()
  const salvar = useSalvarOrcamento(alvo, aoSalvar)

  // A lista de redes chega depois de o diálogo abrir: o foco, que ficou no próprio diálogo, vai ao primeiro campo que aceita
  // digitação. Com o diálogo ainda fechando a montagem (lista em cache), quem escolhe é o navegador, ao abrir, e o foco de
  // quem abriu não se perde.
  useEffect(() => {
    const aberto = formulario.current?.closest('dialog')?.open === true
    if (aberto) formulario.current?.querySelector<HTMLElement>('input:not(:disabled)')?.focus()
  }, [])

  const validacao = pedidoDeOrcamento({ valor, teto, semValor: semValorDoFormulario(alvo, daRede, valor) })
  const erros = errosDaTela(tentou, validacao)
  const depois = validacao.ok ? vigenteDepoisDe(alvo, rede, validacao.pedido) : undefined

  function send(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault()
    if (noAr.current) return
    definirTentou(true)
    if (!validacao.ok) return
    noAr.current = true
    salvar.mutate(validacao.pedido, { onSettled: () => (noAr.current = false) })
  }

  return (
    <form ref={formulario} className="mt-3 flex flex-col gap-4" onSubmit={send} noValidate>
      <p className="wrap-anywhere">{textoDoValeHoje(atual.vigente)}</p>
      <CampoDoDialogo
        rotulo="Valor por aluno por mês (R$)"
        dica={DICAS[alvo.tipo].valor}
        name="valor"
        inputMode="decimal"
        valor={valor}
        aoMudar={definirValor}
        erro={erros.valorPorAlunoCentavos}
        desligado={alvo.tipo === 'escola' && daRede}
      />
      {alvo.tipo === 'escola' && <CaixaDoValorDaRede marcada={daRede} aoMudar={definirDaRede} />}
      <CampoDoDialogo
        rotulo="Teto de segurança (% do orçamento)"
        dica={DICAS[alvo.tipo].teto}
        name="teto"
        inputMode="numeric"
        valor={teto}
        aoMudar={definirTeto}
        erro={erros.tetoDeSegurancaPercentual}
      />
      {depois !== undefined && <AntesEDepois id={idDoAntesEDepois} antes={atual.vigente} depois={depois} escolasDaRede={alvo.tipo === 'rede' ? rede.escolasQueUsamOValorDaRede : undefined} />}
      {salvar.isError && <FalhaAoSalvar erro={salvar.error} />}
      <AcoesDoOrcamento salvando={salvar.isPending} descritoPor={depois === undefined ? undefined : idDoAntesEDepois} aoFechar={aoFechar} />
    </form>
  )
}
