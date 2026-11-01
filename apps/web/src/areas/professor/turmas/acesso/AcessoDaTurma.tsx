import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { consultaAcessoDaTurma } from '../api/acesso'
import { Button } from '../../../../components/ui/Button'
import { useDialogState } from '../../../../components/ui/overlays/dialog-state'
import { Anuncio } from '../../../../components/dialogs'
import { EstadoCarregando, EstadoErro, EstadoVazio } from '../../../../components/states/index'
import { TurmaIndisponivel } from '../../../../components/TurmaIndisponivel'
import { formatarDataHora } from '../../../../format'
import { TEXTO_DA_TURMA_INDISPONIVEL, TEXTO_DO_ACESSO_QUE_JA_APARECEU, turmaIndisponivel } from './acesso-da-turma'
import { ConvidarAlunos, type EscolaDaSessao } from './ConvidarAlunos'

interface PropsDoAcesso {
  readonly turmaId: string
  readonly escola: EscolaDaSessao
  readonly titulo: RefObject<HTMLHeadingElement | null>
  /** O endereço pede o "Convidar alunos" (`?convidar=1`): o diálogo abre sozinho, uma vez por pedido. */
  readonly convidarPeloEndereco?: boolean
  /** O diálogo fechou, por qualquer caminho: quem lê o endereço tira o pedido dele (`replace`). */
  readonly aoFecharOConvite?: () => void
}

/**
 * O acesso dos alunos à turma, dentro da aba Alunos (A1, 15.0; telas do professor, 13.0; RF9, RF19; W4, "Acesso"): um **resumo**
 * e o botão "Convidar alunos", que abre o diálogo onde o acesso se gera, se troca e se revoga (`ConvidarAlunos`).
 *
 * Os quatro estados do resumo (W4): carregando; erro com "Tentar de novo"; vazio, "Sem acesso ativo"; e com dado, só até
 * quando vale. O link e o código não voltam na leitura: aparecem uma vez, no passo do diálogo que os gerou.
 *
 * - **O botão é um só e fica no mesmo lugar** em todos os estados com leitura boa: o foco volta para ele quando o diálogo fecha,
 *   com acesso ou sem. Na leitura em erro ele sai, e o foco vai para o título da seção.
 * - **A seção nunca mostra o estado de antes quando a releitura falha**: "Sem acesso ativo" logo depois de gerar negaria o
 *   acesso que acabou de nascer, e "Acesso ativo" depois de revogar, o contrário. Fica o erro, com "Tentar de novo".
 * - **A turma que saiu do alcance** (`NAO_ENCONTRADO`) diz a quem recorrer, sem "Tentar de novo".
 * - **A validade vem sempre da leitura**, e não da resposta do gerar: o gerar que responde atrasado não escreve por cima do que
 *   o servidor tem agora.
 * - **O link e o código saem com a sessão**: a turma aberta (`Turma.tsx`) só desenha esta seção com a turma e a escola lidas, e
 *   toda sessão que acaba ou muda esvazia as duas leituras; o diálogo aberto sai junto, e não fica atrás do login por cima
 *   (regra 20, item 8). O endereço, que pode pedir o diálogo, nunca leva token, link nem código.
 */
export function AcessoDaTurma({ turmaId, escola, titulo, convidarPeloEndereco = false, aoFecharOConvite }: PropsDoAcesso) {
  const cliente = useQueryClient()
  const acesso = useQuery(consultaAcessoDaTurma(turmaId))
  // O endereço pede o diálogo: ele abre na montagem da aba, uma vez. Fechar tira o pedido do endereço, e a aba que monta de novo
  // (a turma aberta outra vez) o abre só se o endereço ainda o pede.
  const { aberta, abrir: abrirDialogo, fechar: fecharDialogo, fecharSeAinda } = useDialogState<'convidar'>(convidarPeloEndereco ? 'convidar' : undefined)
  const [anuncio, definirAnuncio] = useState('')
  const idDoTitulo = useId()
  const botaoConvidar = useRef<HTMLButtonElement>(null)

  const recarregar = useCallback(() => cliente.invalidateQueries({ queryKey: consultaAcessoDaTurma(turmaId).queryKey }), [cliente, turmaId])
  // O foco quando ninguém abriu o diálogo (o endereço o pediu) ou o botão que o abriu saiu da seção (a leitura em erro tira o
  // "Convidar alunos"): vai para o botão, se ele está na tela, e senão para o título. O título é de quem desenha a página.
  const focarNaSecao = useCallback(() => (botaoConvidar.current ?? titulo.current)?.focus(), [titulo])

  /** Abrir o diálogo apaga o anúncio da ação anterior: o que ele dizia já não é o que a pessoa está fazendo. */
  const abrir = useCallback(() => {
    definirAnuncio('')
    abrirDialogo('convidar')
  }, [abrirDialogo])

  function fechar(): void {
    fecharDialogo()
    aoFecharOConvite?.()
  }

  function conteudo(): ReactNode {
    if (acesso.isPending) return <EstadoCarregando rotulo="Carregando o acesso da turma…" />
    if (acesso.isError) {
      if (turmaIndisponivel(acesso.error)) return <TurmaIndisponivel texto={TEXTO_DA_TURMA_INDISPONIVEL} />
      return <EstadoErro erro={acesso.error} tentando={acesso.isFetching} aoTentarDeNovo={() => void acesso.refetch({ cancelRefetch: false })} />
    }
    const { expiraEm } = acesso.data
    if (expiraEm === null)
      return (
        <EstadoVazio
          titulo="Sem acesso ativo"
          descricao="Gere o link da sala e o código da turma para os alunos entrarem e pedirem o nome. Você escolhe por quanto tempo os dois valem."
        />
      )
    return (
      <div className="flex min-w-0 flex-col gap-1 rounded-cartao border border-linha bg-superficie p-4">
        <p className="font-medium text-tinta">Acesso ativo</p>
        <p className="break-words text-apoio">Vale até {formatarDataHora(expiraEm)}.</p>
        <p className="mt-1 text-sm break-words text-apoio">{TEXTO_DO_ACESSO_QUE_JA_APARECEU}</p>
      </div>
    )
  }

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby={idDoTitulo}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 ref={titulo} id={idDoTitulo} tabIndex={-1} className="text-lg font-semibold text-tinta">
          Acesso dos alunos
        </h2>
        {acesso.isSuccess && <Button ref={botaoConvidar} onClick={abrir}>Convidar alunos</Button>}
      </div>
      <Anuncio texto={anuncio} />
      {conteudo()}

      {aberta?.tipo === 'convidar' && (
        <ConvidarAlunos
          key={aberta.numero}
          turmaId={turmaId}
          escola={escola}
          aoTerminar={recarregar}
          aoFechar={fechar}
          aoRevogar={() => {
            definirAnuncio('Acesso revogado. O link e o código não valem mais.')
            // Só a abertura em que o pedido saiu: o revogar que responde com outro diálogo aberto não o fecha.
            fecharSeAinda(aberta)
            aoFecharOConvite?.()
          }}
          focoDeReserva={focarNaSecao}
        />
      )}
    </section>
  )
}
