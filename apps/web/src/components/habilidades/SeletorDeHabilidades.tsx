import type { HabilidadeCandidataBncc } from '@educa/shared'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Button } from '../ui/Button'
import { SearchInput } from '../ui/fields/SearchInput'

/**
 * O seletor de habilidades da BNCC (classificacao-bncc, 8.0; `docs/interface.md` 3, "O painel do material"; a 11.0 o reaproveita na troca da habilidade da questão): um campo de filtro e a lista de habilidades do recorte, cada
 * uma com o **código sempre ao lado da descrição**, para marcar de 0 até `maximo`. Não é um `select`: são até ~300 habilidades, e o que a pessoa sabe é o código ou uma palavra do texto.
 *
 * - **O filtro** acha por código ou por texto, sem acento nem caixa, com todas as palavras digitadas. O que a pessoa já escolheu fica sempre à vista, no alto, mesmo quando o filtro não o acha: não há escolha que se perca de vista.
 * - **O teto** é `maximo`: com o número escolhido, as outras caixas desligam e a peça diz por quê. Tirar uma escolha as liga de novo.
 * - **A lista mostra até 50 por vez** (`MAXIMO_DE_LINHAS_DO_SELETOR`) e diz quantas há: o computador fraco da escola não desenha 300 linhas, e quem procura filtra.
 * - **O foco entra no filtro** quando a peça abre, e o Esc a fecha (`aoFechar`) sem fechar o painel que a contém: quem a abriu devolve o foco ao botão de onde veio.
 * - **Os quatro estados** são de quem lê as candidatas (`carregando`, `erro`, `itens`) e a peça os desenha; o sem componente da disciplina e o sem resultado do filtro também.
 *
 * Não busca nada: quem a usa lê `GET /v1/habilidades-bncc` (Query) e passa o resultado.
 */

export const MAXIMO_DE_LINHAS_DO_SELETOR = 50
export const TEXTO_CARREGANDO_DO_SELETOR = 'Carregando as habilidades…'
export const TEXTO_ERRO_DO_SELETOR = 'Não foi possível ler as habilidades da BNCC.'
export const TEXTO_SEM_RESULTADO_DO_SELETOR = 'Nenhuma habilidade com esse código ou texto.'
export const TEXTO_SEM_COMPONENTE_DO_SELETOR = 'Esta disciplina não tem componente da BNCC. A questão fica sem habilidade.'

function semAcentoNemCaixa(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/** As habilidades que têm **todas** as palavras do filtro no código ou no texto, sem acento nem caixa. Filtro vazio: todas, na ordem em que vieram. */
export function filtrarHabilidades(itens: readonly HabilidadeCandidataBncc[], filtro: string): HabilidadeCandidataBncc[] {
  const palavras = semAcentoNemCaixa(filtro)
    .split(/\s+/)
    .filter((palavra) => palavra !== '')
  if (palavras.length === 0) return [...itens]
  return itens.filter((item) => {
    const alvo = semAcentoNemCaixa(`${item.codigo} ${item.descricao}`)
    return palavras.every((palavra) => alvo.includes(palavra))
  })
}

export interface EntradaDasLinhas {
  readonly itens: readonly HabilidadeCandidataBncc[]
  readonly filtro: string
  readonly selecionados: readonly string[]
}

/** As linhas da lista: as escolhidas (sempre, no alto), depois as que o filtro acha, até o teto de linhas; `total` é quantas havia antes do corte. */
export function linhasDoSeletor({ itens, filtro, selecionados }: EntradaDasLinhas): { readonly linhas: HabilidadeCandidataBncc[]; readonly total: number } {
  const escolhidas = itens.filter((item) => selecionados.includes(item.codigo))
  const achadas = filtrarHabilidades(itens, filtro).filter((item) => !selecionados.includes(item.codigo))
  const todas = [...escolhidas, ...achadas]
  return { linhas: todas.slice(0, MAXIMO_DE_LINHAS_DO_SELETOR), total: todas.length }
}

interface Props {
  /** O nome da lista e do filtro para o leitor de tela: "Habilidades do capítulo 3". */
  readonly rotulo: string
  /** As candidatas do recorte; `undefined` enquanto não chegaram. */
  readonly itens: readonly HabilidadeCandidataBncc[] | undefined
  readonly carregando: boolean
  readonly erro: boolean
  readonly aoTentarDeNovo: () => void
  /** A disciplina não tem componente: não há o que escolher, e a peça diz o que acontece. */
  readonly semComponente?: boolean
  readonly selecionados: readonly string[]
  /** O mais que se escolhe: 5 no capítulo do material, 1 na questão. */
  readonly maximo: number
  readonly aoMudar: (codigos: string[]) => void
  /** O Esc: quem abriu a peça a fecha e devolve o foco. */
  readonly aoFechar?: () => void
}

interface LinhasProps {
  readonly lista: { readonly linhas: readonly HabilidadeCandidataBncc[]; readonly total: number }
  readonly selecionados: readonly string[]
  readonly maximo: number
  readonly aoMudar: (codigos: string[]) => void
}

/** O contador e as linhas do seletor com a lista lida: as caixas, o teto e a nota de quantas há. */
function LinhasDoSeletor({ lista, selecionados, maximo, aoMudar }: LinhasProps) {
  const cheio = selecionados.length >= maximo

  function marcar(codigo: string, marcada: boolean): void {
    aoMudar(marcada ? [...selecionados, codigo] : selecionados.filter((escolhido) => escolhido !== codigo))
  }

  return (
    <>
      <p role="status" className="t-apoio text-apoio">
        {String(selecionados.length)} de {String(maximo)} escolhidas
        {cheio ? '. Tire uma para escolher outra.' : ''}
      </p>
      {lista.total === 0 ? (
        <p className="text-apoio">{TEXTO_SEM_RESULTADO_DO_SELETOR}</p>
      ) : (
        <ul className="flex min-w-0 flex-col">
          {lista.linhas.map((habilidade) => {
            const marcada = selecionados.includes(habilidade.codigo)
            return (
              <li key={habilidade.codigo}>
                <label className="flex min-h-11 min-w-0 items-start gap-3 py-2 text-tinta">
                  <input type="checkbox" checked={marcada} disabled={cheio && !marcada} onChange={(evento) => marcar(habilidade.codigo, evento.target.checked)} className="mt-0.5 size-6 shrink-0 accent-tinta" />
                  <span className="min-w-0 break-words">
                    <span className="font-semibold">{habilidade.codigo}</span> <span>{habilidade.descricao}</span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
      {lista.total > MAXIMO_DE_LINHAS_DO_SELETOR && (
        <p className="t-apoio text-apoio">
          Mostrando {String(MAXIMO_DE_LINHAS_DO_SELETOR)} de {String(lista.total)}. Escreva o código ou uma palavra do texto para achar as outras.
        </p>
      )}
    </>
  )
}

export function SeletorDeHabilidades({ rotulo, itens, carregando, erro, aoTentarDeNovo, semComponente = false, selecionados, maximo, aoMudar, aoFechar }: Props) {
  const raiz = useRef<HTMLDivElement>(null)
  const [filtro, definirFiltro] = useState('')
  useEffect(() => {
    const campo = raiz.current?.querySelector('input')
    ;(campo ?? raiz.current)?.focus()
  }, [])

  function aoTeclar(evento: KeyboardEvent<HTMLDivElement>): void {
    if (evento.key !== 'Escape' || aoFechar === undefined) return
    // O Esc é da peça: o painel que a contém só fecha quando ela não está aberta.
    evento.preventDefault()
    evento.stopPropagation()
    aoFechar()
  }

  const lista = itens === undefined ? undefined : linhasDoSeletor({ itens, filtro, selecionados })

  return (
    <div ref={raiz} role="group" aria-label={rotulo} tabIndex={-1} onKeyDown={aoTeclar} className="flex min-w-0 flex-col gap-3 outline-none">
      {semComponente ? (
        <p className="text-apoio">{TEXTO_SEM_COMPONENTE_DO_SELETOR}</p>
      ) : (
        <>
          <SearchInput valor={filtro} aoMudar={definirFiltro} rotulo="Filtrar por código ou texto" />
          {carregando ? (
            <p role="status" className="text-apoio">
              {TEXTO_CARREGANDO_DO_SELETOR}
            </p>
          ) : erro || lista === undefined ? (
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <p role="alert" className="min-w-0 flex-1 basis-48 break-words text-erro">
                {TEXTO_ERRO_DO_SELETOR}
              </p>
              <Button variante="secundario" onClick={aoTentarDeNovo}>
                Tentar de novo <span className="sr-only">ler as habilidades</span>
              </Button>
            </div>
          ) : (
            <LinhasDoSeletor lista={lista} selecionados={selecionados} maximo={maximo} aoMudar={aoMudar} />
          )}
        </>
      )}
    </div>
  )
}
