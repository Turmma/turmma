import {
  ANOS_DA_ETAPA,
  ErrorCode,
  ETAPAS,
  fimCaiAteOAnoSeguinte,
  fimDepoisDoInicio,
  inicioCaiNoAnoLetivo,
  MAIOR_ANO_LETIVO,
  MENOR_ANO_LETIVO,
  nomeDaSerie,
  TAMANHO_MAXIMO_NOME_DISCIPLINA,
  type AnoLetivo,
  type Disciplina,
  type Etapa,
  type Serie,
} from '@educa/shared'
import type { UseQueryResult } from '@tanstack/react-query'
import { useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { abrirAnoLetivo, criarAnoLetivo, criarDisciplina, criarSerie, type ListaDaEstrutura } from '../../../api/estrutura'
import { CLASSES_DO_BOTAO_PERIGO, CLASSES_DO_BOTAO_SECUNDARIO } from '../../../componentes/ui/botao-secundario'
import { Campo } from '../../../componentes/ui/campos/Campo'
import { AlertaDaFalha, Anuncio, DialogoDeFormulario, useEnvioUnico } from '../../../componentes/dialogos'
import { EstadoCarregando, EstadoErro } from '../../../componentes/estado/index'
import { PainelLado } from '../../../componentes/ui/sobrepostos/PainelLado'
import { CLASSES_DO_SELETOR } from '../../../componentes/ui/campos/seletor'
import { textoDaFalha } from '../../../componentes/texto-da-falha'
import { formatarData } from '../../../formatar'
import { ordenarPeloNome, ordenarSeries } from '../comum/ordem'
import { AvisoDeListaIncompleta, Linha } from '../comum/pecas-da-lista'

/**
 * O que a Estrutura abre por cima da tela com o ano letivo, as séries e as disciplinas (telas da coordenação, 5.0; RF12):
 * o painel "Ano letivo e disciplinas" (`?painel=ano`) e os diálogos de criar de cada seção. As escritas são as de antes,
 * com os mesmos textos, anúncios e focos: o que mudou foi o lugar, que saiu da página e foi para o painel ao lado.
 */

/** O item da linha de uma lista da tela, fotografado na abertura do diálogo que age sobre ele. */
export type AlvoDoDialogo = { readonly id: string; readonly nome: string }

/** Os diálogos que o painel abre. A Estrutura tem um só diálogo aberto de cada vez, e os da turma são dela. */
export type TipoDeDialogoDoPainel = 'ano' | 'serie' | 'disciplina' | 'renomear_disciplina' | 'excluir_disciplina'

/** As seções da tela que têm escrita: o anúncio de cada ação aparece na seção dela. */
export type SecaoDaTela = 'ano' | 'series' | 'disciplinas' | 'turmas'

export interface PropsDaSecao {
  readonly titulo: string
  readonly tituloRef: RefObject<HTMLHeadingElement | null>
  /** O anúncio da última ação desta seção, ou vazio. */
  readonly anuncio: string
  readonly acao?: ReactNode
  readonly children: ReactNode
}

/** Uma seção da tela, com o título que recebe o foco quando o botão que tinha o foco sai (o item excluído). */
export function Secao({ titulo, tituloRef, anuncio, acao, children }: PropsDaSecao) {
  const idDoTitulo = useId()
  return (
    <section aria-labelledby={idDoTitulo} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 ref={tituloRef} id={idDoTitulo} tabIndex={-1} className="text-lg font-semibold text-tinta">
          {titulo}
        </h2>
        {acao}
      </div>
      <Anuncio texto={anuncio} />
      {children}
    </section>
  )
}

/** Renomear e Excluir da linha, com o nome do item no nome acessível do botão (WCAG 2.5.3). */
function AcoesDaLinha({ nome, tipo, aoRenomear, aoExcluir }: { nome: string; tipo: string; aoRenomear: () => void; aoExcluir: () => void }) {
  return (
    <>
      <button type="button" onClick={aoRenomear} className={CLASSES_DO_BOTAO_SECUNDARIO}>
        Renomear
        <span className="sr-only">
          {' '}
          {tipo} {nome}
        </span>
      </button>
      <button type="button" onClick={aoExcluir} className={CLASSES_DO_BOTAO_PERIGO}>
        Excluir
        <span className="sr-only">
          {' '}
          {tipo} {nome}
        </span>
      </button>
    </>
  )
}

const SITUACAO_DO_ANO: Readonly<Record<AnoLetivo['situacao'], string>> = {
  planejado: 'Planejado',
  em_curso: 'Em curso',
  encerrado: 'Encerrado',
}

/** O ano letivo: os anos da escola, e "Abrir" no planejado quando nenhum está em curso. */
function AnosLetivos({
  anos,
  tituloRef,
  anuncio,
  aoCriar,
  aoAnunciar,
  recarregar,
}: {
  anos: readonly AnoLetivo[]
  tituloRef: RefObject<HTMLHeadingElement | null>
  anuncio: string
  aoCriar: () => void
  aoAnunciar: (texto: string) => void
  recarregar: () => unknown
}) {
  const temEmCurso = anos.some((ano) => ano.situacao === 'em_curso')
  // O "Abrir" sai da linha com o ano aberto: depois de recarregar, o foco vai para o título da seção.
  const { enviar, mutacao } = useEnvioUnico({
    mutationFn: abrirAnoLetivo,
    onSuccess: async (ano) => {
      await recarregar()
      aoAnunciar(`Ano letivo ${String(ano.ano)} aberto. Agora crie as turmas.`)
      tituloRef.current?.focus()
    },
    onError: recarregar,
  })
  const ordenados = [...anos].sort((a, b) => b.ano - a.ano)
  return (
    <Secao
      titulo="Ano letivo"
      tituloRef={tituloRef}
      anuncio={anuncio}
      acao={
        <button type="button" onClick={aoCriar} className={CLASSES_DO_BOTAO_SECUNDARIO}>
          Novo ano letivo
        </button>
      }
    >
      {mutacao.isError && (
        <AlertaDaFalha
          texto={textoDaFalha(mutacao.error, {
            [ErrorCode.CONFLITO]: 'Já há um ano letivo em curso na escola. Só um fica em curso por vez.',
            [ErrorCode.NAO_ENCONTRADO]: 'Este ano letivo já não existe. A lista foi atualizada.',
          })}
        />
      )}
      <ul className="flex flex-col gap-3">
        {ordenados.map((ano) => (
          <Linha key={ano.id} titulo={String(ano.ano)} detalhe={`${SITUACAO_DO_ANO[ano.situacao]} · de ${formatarData(ano.inicio)} a ${formatarData(ano.fim)}`}>
            {ano.situacao === 'planejado' && !temEmCurso && (
              <button type="button" onClick={() => enviar(ano.id)} disabled={mutacao.isPending} className={CLASSES_DO_BOTAO_SECUNDARIO}>
                {mutacao.isPending && mutacao.variables === ano.id ? 'Abrindo…' : `Abrir o ano letivo ${String(ano.ano)}`}
              </button>
            )}
          </Linha>
        ))}
      </ul>
    </Secao>
  )
}

/**
 * O diálogo de criar fecha com a lista já recarregada: o item novo está na tela quando o foco volta, e o "Criando…" fica
 * até lá. A falha também recarrega, porque o `NAO_ENCONTRADO` diz que a série ou o ano mudou.
 */
export function depoisDeCriar<Criado>(aoCriar: (criado: Criado) => void, recarregar: () => unknown) {
  return {
    onSuccess: async (criado: Criado) => {
      await recarregar()
      aoCriar(criado)
    },
    onError: recarregar,
  }
}

export interface PropsDeCriar<Criado> {
  readonly aoFechar: () => void
  readonly aoCriar: (criado: Criado) => void
  readonly recarregar: () => unknown
}

/** O período típico de um ano letivo, para a coordenação só conferir: o calendário de verdade vem no F2. */
function periodoTipico(ano: number): { inicio: string; fim: string } {
  return { inicio: `${String(ano)}-02-01`, fim: `${String(ano)}-12-15` }
}

/**
 * O ano letivo novo. O ano não se altera nem se exclui depois de criado, e por isso o diálogo não deixa o período
 * contradizer o ano calado: o início e o fim acompanham o ano digitado enquanto a pessoa não mexe neles (preparar 2027 em
 * novembro de 2026 não grava o período de 2026), o início precisa cair no ano digitado, e o fim, nele ou no seguinte (a
 * rede que termina o ano letivo em janeiro é normal). Quem recusa é a API, pelo mesmo contrato (`packages/shared`); aqui o
 * erro vai para o campo, em texto, antes de enviar.
 */
export function NovoAnoLetivo({ aoFechar, aoCriar, recarregar, focoDeReserva }: PropsDeCriar<AnoLetivo> & { focoDeReserva: () => void }) {
  const [ano, definirAno] = useState(() => String(new Date().getFullYear()))
  const [periodoDigitado, definirPeriodoDigitado] = useState<{ inicio: string; fim: string } | undefined>(undefined)
  const [erros, definirErros] = useState<{
    ano?: string
    inicio?: string
    fim?: string
  }>({})
  const campoDoAno = useRef<HTMLInputElement>(null)
  const campoDoInicio = useRef<HTMLInputElement>(null)
  const campoDoFim = useRef<HTMLInputElement>(null)
  const { enviar, mutacao } = useEnvioUnico({
    mutationFn: criarAnoLetivo,
    ...depoisDeCriar(aoCriar, recarregar),
  })

  const numero = Number(ano)
  const anoValido = Number.isInteger(numero) && numero >= MENOR_ANO_LETIVO && numero <= MAIOR_ANO_LETIVO
  const { inicio, fim } = periodoDigitado ?? periodoTipico(anoValido ? numero : new Date().getFullYear())

  function aoEnviar(): void {
    const erroDoInicio =
      inicio === '' ? 'Preencha o início.' : anoValido && !inicioCaiNoAnoLetivo(numero, inicio) ? `O início precisa cair em ${String(numero)}, o ano letivo digitado.` : undefined
    const erroDoFim =
      fim === ''
        ? 'Preencha o fim.'
        : inicio !== '' && !fimDepoisDoInicio(inicio, fim)
          ? 'O fim precisa ser depois do início.'
          : anoValido && !fimCaiAteOAnoSeguinte(numero, fim)
            ? `O fim precisa cair em ${String(numero)} ou em ${String(numero + 1)}.`
            : undefined
    const novos = {
      ...(anoValido
        ? {}
        : {
            ano: `Digite o ano com quatro algarismos, entre ${String(MENOR_ANO_LETIVO)} e ${String(MAIOR_ANO_LETIVO)}.`,
          }),
      ...(erroDoInicio === undefined ? {} : { inicio: erroDoInicio }),
      ...(erroDoFim === undefined ? {} : { fim: erroDoFim }),
    }
    definirErros(novos)
    // O foco vai para o primeiro campo com erro: o leitor de tela lê o erro ao chegar nele.
    if (novos.ano !== undefined) campoDoAno.current?.focus()
    else if (novos.inicio !== undefined) campoDoInicio.current?.focus()
    else if (novos.fim !== undefined) campoDoFim.current?.focus()
    else enviar({ ano: numero, inicio, fim })
  }

  return (
    <DialogoDeFormulario
      titulo="Novo ano letivo"
      aoFechar={aoFechar}
      focoDeReserva={focoDeReserva}
      aoEnviar={aoEnviar}
      enviando={mutacao.isPending}
      rotuloDoEnvio="Criar ano letivo"
      rotuloEnviando="Criando…"
      falha={
        mutacao.isError
          ? textoDaFalha(mutacao.error, {
              [ErrorCode.CONFLITO]: 'Este ano letivo já existe na escola.',
            })
          : undefined
      }
    >
      <Campo ref={campoDoAno} rotulo="Ano" name="ano" inputMode="numeric" autoComplete="off" value={ano} onChange={(evento) => definirAno(evento.target.value)} erro={erros.ano} />
      <Campo
        ref={campoDoInicio}
        rotulo="Início"
        name="inicio"
        type="date"
        value={inicio}
        onChange={(evento) => definirPeriodoDigitado({ inicio: evento.target.value, fim })}
        erro={erros.inicio}
      />
      <Campo
        ref={campoDoFim}
        rotulo="Fim"
        name="fim"
        type="date"
        value={fim}
        onChange={(evento) => definirPeriodoDigitado({ inicio, fim: evento.target.value })}
        erro={erros.fim}
      />
      <p className="text-sm text-apoio">
        O ano nasce planejado, e o ano e o período não se alteram depois: confira antes de criar. Depois de criado, abra o ano para criar as turmas nele.
      </p>
    </DialogoDeFormulario>
  )
}

/** As séries do recorte (D43), na ordem da escola, pelo `ANOS_DA_ETAPA` de `packages/shared`. */
const SERIES_DO_RECORTE: ReadonlyArray<{ etapa: Etapa; ano: number }> = ETAPAS.flatMap((etapa) =>
  Array.from({ length: ANOS_DA_ETAPA[etapa].maior - ANOS_DA_ETAPA[etapa].menor + 1 }, (_, posicao) => ({ etapa, ano: ANOS_DA_ETAPA[etapa].menor + posicao })),
)

export function NovaSerie({ existentes, aoFechar, aoCriar, recarregar }: PropsDeCriar<Serie> & { existentes: readonly Serie[] }) {
  const disponiveis = SERIES_DO_RECORTE.filter((serie) => !existentes.some((existente) => existente.etapa === serie.etapa && existente.ano === serie.ano))
  const [escolhida, definirEscolhida] = useState(() => (disponiveis[0] === undefined ? '' : `${disponiveis[0].etapa}:${String(disponiveis[0].ano)}`))
  const campo = useId()
  const { enviar, mutacao } = useEnvioUnico({
    mutationFn: criarSerie,
    ...depoisDeCriar(aoCriar, recarregar),
  })

  function aoEnviar(): void {
    const serie = disponiveis.find((opcao) => `${opcao.etapa}:${String(opcao.ano)}` === escolhida)
    if (serie !== undefined) enviar(serie.etapa === 'em' ? { etapa: 'em', ano: serie.ano } : { etapa: 'ef_anos_finais', ano: serie.ano })
  }

  return (
    <DialogoDeFormulario
      titulo="Nova série"
      aoFechar={aoFechar}
      aoEnviar={aoEnviar}
      enviando={mutacao.isPending}
      rotuloDoEnvio="Criar série"
      rotuloEnviando="Criando…"
      semNovaTentativa={disponiveis.length === 0}
      falha={
        mutacao.isError
          ? textoDaFalha(mutacao.error, {
              [ErrorCode.CONFLITO]: 'Esta série já existe na escola.',
            })
          : undefined
      }
    >
      {disponiveis.length === 0 ? (
        <p className="text-apoio">A escola já tem todas as séries do 6º ano ao 3º do Ensino Médio.</p>
      ) : (
        <div className="flex flex-col gap-1">
          <label htmlFor={campo} className="font-medium">
            Série
          </label>
          <select id={campo} value={escolhida} onChange={(evento) => definirEscolhida(evento.target.value)} className={CLASSES_DO_SELETOR}>
            {disponiveis.map((serie) => (
              <option key={`${serie.etapa}:${String(serie.ano)}`} value={`${serie.etapa}:${String(serie.ano)}`}>
                {nomeDaSerie(serie)}
              </option>
            ))}
          </select>
        </div>
      )}
    </DialogoDeFormulario>
  )
}

export function NovaDisciplina({ aoFechar, aoCriar, recarregar }: PropsDeCriar<Disciplina>) {
  const [nome, definirNome] = useState('')
  const [erroDoNome, definirErroDoNome] = useState<string | undefined>(undefined)
  const campo = useRef<HTMLInputElement>(null)
  const { enviar, mutacao } = useEnvioUnico({
    mutationFn: criarDisciplina,
    ...depoisDeCriar(aoCriar, recarregar),
  })

  function aoEnviar(): void {
    const limpo = nome.trim()
    definirErroDoNome(limpo === '' ? 'Digite o nome da disciplina.' : undefined)
    if (limpo !== '') enviar({ nome: limpo })
    else campo.current?.focus()
  }

  return (
    <DialogoDeFormulario
      titulo="Nova disciplina"
      aoFechar={aoFechar}
      aoEnviar={aoEnviar}
      enviando={mutacao.isPending}
      rotuloDoEnvio="Criar disciplina"
      rotuloEnviando="Criando…"
      falha={
        mutacao.isError
          ? textoDaFalha(mutacao.error, {
              [ErrorCode.CONFLITO]: 'Já existe uma disciplina com este nome na escola.',
            })
          : undefined
      }
    >
      <Campo
        ref={campo}
        rotulo="Nome da disciplina"
        dica="Como a escola chama: Matemática, Língua Portuguesa, Química."
        name="nome"
        autoComplete="off"
        maxLength={TAMANHO_MAXIMO_NOME_DISCIPLINA}
        value={nome}
        onChange={(evento) => definirNome(evento.target.value)}
        erro={erroDoNome}
      />
    </DialogoDeFormulario>
  )
}

interface PropsDoPainel {
  readonly anos: readonly AnoLetivo[]
  readonly series: UseQueryResult<ListaDaEstrutura<Serie>>
  readonly disciplinas: UseQueryResult<ListaDaEstrutura<Disciplina>>
  /** O anúncio da última ação da seção, ou vazio. */
  readonly anuncioDa: (secao: SecaoDaTela) => string
  readonly aoAnunciar: (secao: SecaoDaTela, texto: string) => void
  readonly aoAbrir: (tipo: TipoDeDialogoDoPainel, item?: AlvoDoDialogo) => void
  readonly recarregar: () => unknown
  readonly tituloDoAno: RefObject<HTMLHeadingElement | null>
  readonly tituloDasSeries: RefObject<HTMLHeadingElement | null>
  readonly tituloDasDisciplinas: RefObject<HTMLHeadingElement | null>
  readonly aoFechar: () => void
  /** Para onde o foco vai ao fechar quando o botão que abriu o painel saiu da página. */
  readonly focoDeReserva: () => void
}

/**
 * O painel "Ano letivo e disciplinas" (`?painel=ano`): as três seções de hoje, com os nomes de região de hoje ("Ano letivo",
 * "Séries", "Disciplinas") e as ações de hoje. Os diálogos (criar, renomear, excluir) abrem por cima dele e devolvem o foco
 * ao botão que os abriu; quando esse botão sai (a disciplina excluída), o foco vai para o título da seção.
 */
export function PainelDoAnoEDisciplinas({
  anos,
  series,
  disciplinas,
  anuncioDa,
  aoAnunciar,
  aoAbrir,
  recarregar,
  tituloDoAno,
  tituloDasSeries,
  tituloDasDisciplinas,
  aoFechar,
  focoDeReserva,
}: PropsDoPainel) {
  return (
    <PainelLado titulo="Ano letivo e disciplinas" aoFechar={aoFechar} focoDeReserva={focoDeReserva}>
      <div className="flex min-w-0 flex-col gap-8">
        <AnosLetivos
          anos={anos}
          tituloRef={tituloDoAno}
          anuncio={anuncioDa('ano')}
          aoCriar={() => aoAbrir('ano')}
          aoAnunciar={(texto) => aoAnunciar('ano', texto)}
          recarregar={recarregar}
        />

        <Secao
          titulo="Séries"
          tituloRef={tituloDasSeries}
          anuncio={anuncioDa('series')}
          acao={
            <button type="button" onClick={() => aoAbrir('serie')} className={CLASSES_DO_BOTAO_SECUNDARIO}>
              Nova série
            </button>
          }
        >
          {series.isPending ? (
            <EstadoCarregando rotulo="Carregando as séries…" />
          ) : series.isError ? (
            <EstadoErro erro={series.error} tentando={series.isFetching} aoTentarDeNovo={() => void series.refetch({ cancelRefetch: false })} />
          ) : series.data.itens.length === 0 ? (
            <p className="text-apoio">Nenhuma série ainda. Crie as séries que a escola tem, do 6º ano ao 3º do Ensino Médio.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {ordenarSeries(series.data.itens).map((serie) => (
                <li key={serie.id} className="rounded-controle border border-linha bg-superficie px-3 py-2 break-words">
                  {nomeDaSerie(serie)}
                </li>
              ))}
            </ul>
          )}
        </Secao>

        <Secao
          titulo="Disciplinas"
          tituloRef={tituloDasDisciplinas}
          anuncio={anuncioDa('disciplinas')}
          acao={
            <button type="button" onClick={() => aoAbrir('disciplina')} className={CLASSES_DO_BOTAO_SECUNDARIO}>
              Nova disciplina
            </button>
          }
        >
          {disciplinas.isPending ? (
            <EstadoCarregando rotulo="Carregando as disciplinas…" />
          ) : disciplinas.isError ? (
            <EstadoErro erro={disciplinas.error} tentando={disciplinas.isFetching} aoTentarDeNovo={() => void disciplinas.refetch({ cancelRefetch: false })} />
          ) : disciplinas.data.itens.length === 0 ? (
            <p className="text-apoio">Nenhuma disciplina ainda. Crie as que os professores dão, como Matemática e Língua Portuguesa.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-3">
                {ordenarPeloNome(disciplinas.data.itens).map((disciplina) => (
                  <Linha key={disciplina.id} titulo={disciplina.nome}>
                    <AcoesDaLinha
                      nome={disciplina.nome}
                      tipo="a disciplina"
                      aoRenomear={() => aoAbrir('renomear_disciplina', disciplina)}
                      aoExcluir={() => aoAbrir('excluir_disciplina', disciplina)}
                    />
                  </Linha>
                ))}
              </ul>
              <AvisoDeListaIncompleta completa={disciplinas.data.completa} />
            </>
          )}
        </Secao>
      </div>
    </PainelLado>
  )
}
