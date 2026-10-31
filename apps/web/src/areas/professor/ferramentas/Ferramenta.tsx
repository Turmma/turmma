import { ArrowLeft } from 'lucide-react'
import { useId, useLayoutEffect } from 'react'
import { Link, useSearch } from 'wouter'
import { PARAMETRO_DA_ORIGEM, ROTAS_DO_PROFESSOR } from '../../../paths'
import { ConteudoNaoEncontrado } from '../../../components/NotFound'
import { CabecalhoDeSecao, Tela } from '../../../components/ui/Tela'
import { useTituloDaTela } from '../../../document-title'
import { CartaoDeFerramenta } from './CartaoDeFerramenta'
import { COMO_VAI_SAIR, ehFerramenta, ferramentaDoCatalogo } from './ferramentas'
import { esquecerGeracaoTerminada } from '../assistente/memoria-do-professor'
import { O_MIOLO_DO_DOCUMENTO, useTopoDoMiolo } from '../artefatos/miolo-do-documento'

/** Um id de artefato tem a forma de UUID: o que vier diferente no endereço não vira escolha no formulário. */
const FORMA_DE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function Formulario({ ferramenta }: { ferramenta: Parameters<typeof ferramentaDoCatalogo>[0] }) {
  const item = ferramentaDoCatalogo(ferramenta)
  const idDoComoVaiSair = useId()
  useTituloDaTela(item.nome)
  // O formulário aberto de novo começa em branco: a geração que já terminou fica em Criados, e a que ainda
  // está no ar continua aqui. Antes da primeira pintura, para o resultado antigo não piscar na tela.
  useLayoutEffect(() => esquecerGeracaoTerminada(ferramenta), [ferramenta])
  // "Pedir versão adaptada", no artefato, traz a atividade de origem no endereço: só o id dela, e nada sobre aluno.
  const origem = new URLSearchParams(useSearch()).get(PARAMETRO_DA_ORIGEM)
  const miolo = useTopoDoMiolo<HTMLDivElement>()
  const iniciais = ferramenta === 'adaptacao' && origem !== null && FORMA_DE_ID.test(origem) ? { origem } : undefined
  return (
    <Tela
      largura="formulario"
      titulo={item.nome}
      objeto
      descricao={item.descricao}
      antes={
        // Relativo à área: o `Route` aninhado em `/professor` resolve o `to` a partir da base dela.
        <Link to={ROTAS_DO_PROFESSOR.ferramentas} className="inline-flex min-h-11 items-center gap-2 self-start text-caramelo-texto underline">
          <ArrowLeft aria-hidden="true" size={18} />
          Voltar para Ferramentas
        </Link>
      }
    >
      {/*
        A partir de 1024 px o formulário e, ao lado, "Como vai sair"; abaixo, uma coluna, com "Como vai sair" depois do formulário.
        A grade é o miolo: a partir de 768 px o título fica parado e só ela rola, e a página tem a altura da janela (RF22). O `md:pb-1` é o
        respiro de baixo: sem ele a borda do cartão fica colada no corte do miolo, sem pista de que há o que rolar.
      */}
      <div ref={miolo} data-miolo-da-ferramenta="" className={`grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start md:pb-1 ${O_MIOLO_DO_DOCUMENTO}`}>
        <div className="min-w-0 rounded-cartao border border-linha bg-superficie p-4 lg:p-5">
          {/* O título da ferramenta já é o `h1` da tela: o do formulário vem um nível abaixo. */}
          <CartaoDeFerramenta ferramenta={ferramenta} nivel={2} {...(iniciais === undefined ? {} : { iniciais })} />
        </div>
        {/* Fora do cartão: carregando, erro, sem turma e função suspensa não o tiram da tela. */}
        <aside aria-labelledby={idDoComoVaiSair} data-como-vai-sair={ferramenta} className="min-w-0 rounded-cartao border border-linha bg-superficie p-4">
          <CabecalhoDeSecao titulo="Como vai sair" id={idDoComoVaiSair} />
          <ul className="mt-2 flex flex-col gap-2 text-sm break-words text-tinta">
            {COMO_VAI_SAIR[ferramenta].map((linha) => (
              <li key={linha}>{linha}</li>
            ))}
          </ul>
        </aside>
      </div>
    </Tela>
  )
}

/**
 * O formulário de uma ferramenta (D18, D74; P23): **o mesmo motor do cartão da conversa**, com os mesmos campos e o
 * mesmo pedido, para quem prefere não conversar. O endereço de uma ferramenta que não existe (as do desenho que ficaram
 * fora do MVP, ou qualquer outra coisa) responde como página não encontrada.
 */
export default function Ferramenta({ ferramenta }: { ferramenta: string }) {
  if (!ehFerramenta(ferramenta)) return <ConteudoNaoEncontrado />
  return <Formulario ferramenta={ferramenta} />
}
