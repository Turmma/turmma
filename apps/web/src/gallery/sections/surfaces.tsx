import { Ellipsis, FileDown, FileText } from 'lucide-react'
import { useState } from 'react'
import { Botao } from '../../components/ui/Botao'
import { BarraPresa } from '../../components/ui/BarraPresa'
import { BarraRotulada } from '../../components/ui/BarraRotulada'
import { Cartao } from '../../components/ui/Cartao'
import type { Aprovacao } from '../../components/ui/ai/approval'
import { AssinaturaIA } from '../../components/ui/ai/AssinaturaIA'
import { LinhaAprovacao } from '../../components/ui/ai/LinhaAprovacao'
import { Linha } from '../../components/ui/Linha'
import { Menu } from '../../components/ui/overlays/Menu'
import { NumeroPainel } from '../../components/ui/NumeroPainel'
import { Estado } from '../../components/ui/SeloDeEstado'
import { Tabela, type ColunaDaTabela } from '../../components/ui/Tabela'
import { QUANDO } from '../sample-data'
import { Secao } from '../GallerySection'

interface Registro {
  readonly id: string
  readonly oQue: string
  readonly funcao: 'correcao_de_objetiva' | 'adaptacao' | 'conversa_e_ferramentas'
  readonly turma: string
  readonly aprovacao: Aprovacao
}

const REGISTROS: readonly Registro[] = [
  { id: 'r1', oQue: 'Correção da lista 3', funcao: 'correcao_de_objetiva', turma: '2ºB', aprovacao: { estado: 'aprovada', por: 'Camila Souza', quando: QUANDO } },
  { id: 'r2', oQue: 'Versão com fonte ampliada', funcao: 'adaptacao', turma: '2ºB', aprovacao: { estado: 'pendente' } },
  { id: 'r3', oQue: 'Atividade de estequiometria', funcao: 'conversa_e_ferramentas', turma: '1ºA', aprovacao: { estado: 'rejeitada', por: 'Camila Souza', quando: QUANDO, motivo: 'A questão 3 não é do capítulo 7.' } },
]

const DESTAQUES = ['Ana B. · em branco', 'Caio M. · muito abaixo do histórico', 'Questão 7 · erro em 28 de 32', 'Davi R. · em branco', 'Elis T. · padrão de erro', 'Fábio L. · em branco']

const COLUNAS_SEM_MENU: readonly [ColunaDaTabela<Registro>, ...ColunaDaTabela<Registro>[]] = [
  { chave: 'oQue', titulo: 'O quê', celula: (registro) => registro.oQue },
  { chave: 'funcao', titulo: 'Agente e função', celula: (registro) => <AssinaturaIA funcao={registro.funcao} /> },
  { chave: 'turma', titulo: 'Turma', celula: (registro) => registro.turma },
  { chave: 'estado', titulo: 'Aprovação', celula: (registro) => <LinhaAprovacao aprovacao={registro.aprovacao} espera="Esperando o professor" /> },
]

const COLUNAS: readonly [ColunaDaTabela<Registro>, ...ColunaDaTabela<Registro>[]] = [
  ...COLUNAS_SEM_MENU,
  {
    chave: 'acoes',
    titulo: 'Ações',
    alinhamento: 'fim',
    celula: (registro) => <Menu rotulo={`Ações de ${registro.oQue}`} icone={Ellipsis} soIcone variante="discreto" alinhamento="fim" itens={[{ id: 'abrir', rotulo: 'Abrir' }, { id: 'exportar', rotulo: 'Exportar em PDF', icone: FileDown }]} aoEscolher={() => undefined} />,
  },
]

/** A moldura da lista de linhas: borda de 2 px, canto de 16 e o fio de 2 px entre uma linha e a de cima. */
const MOLDURA_DA_LISTA = 'm-0 min-w-0 list-none divide-y-2 divide-borda overflow-hidden rounded-cartao border-2 border-borda p-0'

const TITULO_COMPRIDO =
  'Relatório de laboratório sobre a titulação ácido-base com indicador de repolho roxo, entregue em três partes: o roteiro, as medidas da bureta e a discussão dos resultados com a turma inteira'

/** As quatro formas da linha: link, botão, só de leitura e com título comprido. O botão diz, em texto, o que abriu. */
function LinhasDeExemplo() {
  const [aberta, definirAberta] = useState<string | null>(null)
  return (
    <>
      <ul data-linhas="" className={MOLDURA_DA_LISTA}>
        <li>
          <Linha
            para="/galeria"
            titulo="Lista de estequiometria"
            abaixo="2ºB · entregas até 24/10"
            inicio={<FileText aria-hidden="true" className="size-6 text-sutil" />}
            fim={<Estado familia="pendente">Esperando você</Estado>}
          />
        </li>
        <li>
          <Linha aoAcionar={() => definirAberta('Resultado da lista 3')} titulo="Resultado da lista 3" abaixo="Corrigida em 19/09" />
        </li>
        <li>
          <Linha titulo="Camila Souza" abaixo="Professora de Química, 2ºB e 1ºA" />
        </li>
        <li>
          <Linha para="/galeria" titulo={TITULO_COMPRIDO} abaixo="1ºA · Química" />
        </li>
      </ul>
      <p role="status" data-linha-aberta="" className="t-apoio text-sutil">
        {aberta === null ? 'Nenhuma linha aberta.' : `Aberta: ${aberta}`}
      </p>
    </>
  )
}

export default function SecoesDeSuperficies() {
  return (
    <>
      <Secao nome="cartao-e-numero" titulo="Cartão e número de painel">
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <Cartao titulo="Atividades da semana" acao={<Botao variante="discreto" tamanho="compacto">Ver todas</Botao>}>
            <p className="t-apoio text-sutil">Quatro atividades aplicadas, duas esperando a sua aprovação.</p>
          </Cartao>
          <Cartao>
            <p className="t-apoio text-sutil">Um cartão sem título é só a caixa.</p>
          </Cartao>
        </div>
        <div data-numeros="" className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">
          <NumeroPainel rotulo="Gerado por IA" valor={1284} apoio="Atividades, planos e correções" />
          <NumeroPainel rotulo="Média de acertos" valor="61%" apoio={<BarraRotulada rotulo="Turma 2ºB" valor={61} />} />
          <NumeroPainel rotulo="Esperando o professor" valor="—" />
        </div>
      </Secao>

      <Secao nome="barra-rotulada" titulo="Barra rotulada, sempre neutra">
        <Cartao>
          <div data-barras="" className="flex min-w-0 flex-col gap-4">
            <BarraRotulada rotulo="Habilidade EM13CNT101" valor={72} texto="72%" detalhe="3 questões" />
            <BarraRotulada rotulo="Consumo do mês" valor={188} maximo={300} texto="188 de 300 trocas" />
            <BarraRotulada rotulo="Hoje" valor={60} maximo={60} texto="60 de 60 perguntas" />
            <BarraRotulada rotulo="Ainda sem acerto" valor={0} texto="0%" />
          </div>
        </Cartao>
      </Secao>

      <Secao nome="linha" titulo="Linha de lista">
        <LinhasDeExemplo />
      </Secao>

      <Secao nome="barra-presa" titulo="Barra presa embaixo">
        {/* A lista rola dentro desta caixa, e a barra é o último filho dela: gruda no pé e não cobre o último item. */}
        <div data-rolagem="" className="flex h-64 min-w-0 flex-col overflow-y-auto rounded-cartao border border-linha px-4">
          <ul className="flex min-w-0 flex-1 flex-col gap-2 py-4">
            {DESTAQUES.map((destaque) => (
              <li key={destaque} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-controle border border-linha p-3">
                <span className="min-w-0 break-words">{destaque}</span>
                {/* Um controle em cada item: é o que o Tab alcança no meio da lista, atrás de onde a barra está. */}
                <Botao variante="secundario" tamanho="compacto">
                  Abrir
                </Botao>
              </li>
            ))}
          </ul>
          <BarraPresa rotulo="Aprovação do lote" informacao="3 de 5 destaques abertos">
            <Botao variante="perigo">Rejeitar</Botao>
            <Botao variante="oficial" disabled>
              Aprovar 32 correções
            </Botao>
          </BarraPresa>
        </div>
      </Secao>

      <Secao nome="tabela" titulo="Tabela que vira lista">
        <Tabela rotulo="O que a IA gerou e quem aprovou" colunas={COLUNAS} linhas={REGISTROS} chaveDaLinha={(registro) => registro.id} />
        {/* A mesma tabela num lugar onde não cabe: aí, e só aí, a região que rola recebe foco. */}
        <div data-tabela-estreita="" className="max-w-[280px]">
          <Tabela rotulo="Tabela que não cabe" colunas={COLUNAS_SEM_MENU} linhas={REGISTROS} chaveDaLinha={(registro) => registro.id} />
        </div>
      </Secao>
    </>
  )
}
