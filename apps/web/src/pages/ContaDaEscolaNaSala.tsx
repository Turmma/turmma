import type { ProvedorDeContaDaEscola } from '@educa/shared'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { acessoDaEscolaQueryOptions, NOME_DO_PROVEDOR } from '../api/escola'
import { enderecoParaProvarAContaNaSala } from '../api/salas'
import { Button } from '../components/ui/Button'
import { apagarCaminhoDaSala, guardarCaminhoDaSala, type Caminho } from './caminho-da-sala'

/**
 * Quanto a lista de provedores da escola vale antes de ser lida de novo **na mesma aba**: evita repetir a leitura quando a seção volta a montar. Não alivia o balde por IP da escola: cada
 * aluno está num computador, e cada um lê a lista uma vez (regra 80, item 1); no dimensionamento, conte uma leitura por aluno.
 */
const PRAZO_DOS_PROVEDORES_MS = 10 * 60_000

const SEM_ARMAZENAMENTO = 'Não foi possível entrar com a conta da escola agora. Use a matrícula e a senha.'

/**
 * "Entrar com a conta da escola" na página da sala (acesso-e-convites, 16.0; RF14; `cenarios.md`, "Telas"): o aluno prova a conta Google ou Microsoft da escola e
 * volta à sala para pedir o nome **sem criar senha**. O botão é navegação do navegador (o `iniciar` com `intencao=reivindicar` responde ao provedor); antes de sair, a tela guarda o
 * caminho da sala (`caminho-da-sala.ts`), porque o token do link não volta do provedor.
 *
 * - **Sem provedor liberado, enquanto a lista carrega e quando a leitura dela falha:** nada. A matrícula e a senha, que são o caminho de toda escola, seguem ali.
 * - **Ao clicar:** o botão fica ocupado ("Entrando…") até o navegador sair; voltar pelo botão do navegador o desocupa.
 * - **Sem `sessionStorage`:** o aluno não sai, porque a volta não teria como pedir o nome, e a tela diz para usar a matrícula e a senha.
 */
export function ContaDaEscolaNaSala({ slug, caminho }: { slug: string; caminho: Caminho }) {
  const acesso = useQuery({ ...acessoDaEscolaQueryOptions(slug), staleTime: PRAZO_DOS_PROVEDORES_MS })
  const [entrando, definirEntrando] = useState(false)
  const [semArmazenamento, definirSemArmazenamento] = useState(false)

  // O botão "Voltar" do navegador restaura a página como estava, com o botão ocupado: o aluno que desistiu do provedor precisa poder tentar de novo. O efeito da sala não roda numa
  // página restaurada, e o caminho gravado no clique ficaria no `sessionStorage` por até 15 min: apaga-se aqui, como `docs/lgpd.md` declara ("volte ou não o provedor").
  useEffect(() => {
    const restaurada = (evento: PageTransitionEvent) => {
      if (!evento.persisted) return
      definirEntrando(false)
      apagarCaminhoDaSala()
    }
    window.addEventListener('pageshow', restaurada)
    return () => window.removeEventListener('pageshow', restaurada)
  }, [])

  const provedores = acesso.data?.provedores ?? []
  if (provedores.length === 0) return null

  const entrar = (provedor: ProvedorDeContaDaEscola): void => {
    const guardado = guardarCaminhoDaSala(slug, caminho)
    definirSemArmazenamento(!guardado)
    if (!guardado) return
    definirEntrando(true)
    window.location.assign(enderecoParaProvarAContaNaSala(provedor, slug, caminho))
  }

  return (
    <section aria-labelledby="titulo-conta-na-sala" className="flex min-w-0 flex-col gap-3 rounded-cartao border-2 border-borda bg-superficie p-4">
      <h3 id="titulo-conta-na-sala" className="font-medium">
        Tem a conta da escola?
      </h3>
      <p className="t-apoio text-apoio">Entre com ela e peça o seu nome sem criar senha.</p>
      {semArmazenamento && (
        <p role="alert" className="rounded-controle border border-erro bg-erro-cx p-4 break-words text-erro">
          {SEM_ARMAZENAMENTO}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {provedores.map((provedor) => (
          <Button key={provedor} variante="secundario" disabled={entrando} onClick={() => entrar(provedor)} className="w-full sm:w-auto">
            {entrando ? 'Entrando…' : provedores.length === 1 ? 'Entrar com a conta da escola' : `Entrar com a conta ${NOME_DO_PROVEDOR[provedor]} da escola`}
          </Button>
        ))}
        <span role="status" className="sr-only">
          {entrando ? 'Entrando com a conta da escola…' : ''}
        </span>
      </div>
    </section>
  )
}
