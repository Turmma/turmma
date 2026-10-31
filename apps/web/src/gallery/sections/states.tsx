import { ErrorCode } from '@educa/shared'
import { Clock, Eye, Inbox, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { ErroDaApi } from '../../api/client'
import { Abas } from '../../components/ui/Abas'
import { Aviso, TONS_DE_AVISO, type TomDeAviso } from '../../components/ui/Aviso'
import { BarraRotulada } from '../../components/ui/BarraRotulada'
import { Botao } from '../../components/ui/Botao'
import { Cartao } from '../../components/ui/Cartao'
import { Contador, FAMILIAS_DE_COR } from '../../components/ui/Contador'
import { EstadoCarregando, EstadoErro, EstadoVazio } from '../../components/states'
import { Faixa } from '../../components/ui/Faixa'
import { NumeroPainel } from '../../components/ui/NumeroPainel'
import { Estado } from '../../components/ui/SeloDeEstado'
import { Toque } from '../../components/ui/Toque'
import { Secao } from '../GallerySection'

const ABAS = [
  { id: 'visao-geral', rotulo: 'Visão geral' },
  { id: 'alunos', rotulo: 'Alunos', contador: 2, oQueConta: 'pedidos de nome' },
  { id: 'atividades', rotulo: 'Atividades' },
]

/** O que cada tom diz, com texto inventado: o título e o corpo mudam com o tom, e nenhum fala de pessoa de verdade. */
const AVISOS: Readonly<Record<TomDeAviso, { readonly titulo: string; readonly corpo: string }>> = {
  info: { titulo: 'A turma 2ºB tem um professor novo', corpo: 'A coordenação alocou você na turma. Confirme o vínculo para ver os alunos.' },
  atencao: { titulo: 'O prazo da lista 3 termina amanhã', corpo: 'Faltam quatro entregas. A correção só começa depois do prazo.' },
  erro: { titulo: 'Não foi possível salvar o plano', corpo: 'Tente de novo em instantes. O que você escreveu continua aqui.' },
  certo: { titulo: 'Correção da lista 2 aprovada', corpo: 'O diagnóstico por habilidade já aparece para a turma.' },
}

const NOMES_DAS_FAMILIAS: Readonly<Record<(typeof FAMILIAS_DE_COR)[number], string>> = {
  laranja: 'Laranja',
  azul: 'Azul',
  verde: 'Verde',
  amarelo: 'Amarelo',
  vermelho: 'Vermelho',
  roxo: 'Roxo',
  turquesa: 'Turquesa',
  anil: 'Anil',
  lima: 'Lima',
  rosa: 'Rosa',
}

const FILTROS = [
  { id: 'todas', rotulo: 'Todas' },
  { id: 'esperando', rotulo: 'Esperando você', icone: Clock },
  { id: 'sugeridas', rotulo: 'Sugeridas pelo Assistente', icone: Sparkles },
] as const

export default function SecoesDeEstado() {
  const [aba, definirAba] = useState('visao-geral')
  const [escolhidos, definirEscolhidos] = useState<ReadonlySet<string>>(new Set(['todas']))
  const [tentativas, definirTentativas] = useState(0)
  const [acionados, definirAcionados] = useState(0)

  function alternar(id: string, ligado: boolean): void {
    definirEscolhidos((atual) => {
      const proximo = new Set(atual)
      if (ligado) proximo.add(id)
      else proximo.delete(id)
      return proximo
    })
  }

  return (
    <>
      <Secao nome="estado" titulo="Selo de estado">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Estado familia="pendente" />
          <Estado familia="ok">Aprovado</Estado>
          <Estado familia="erro">Rejeitado</Estado>
          <Estado familia="info">Faz e avisa</Estado>
        </div>
        <Faixa icone={Eye}>Seu professor acompanha como você usa o Tutor.</Faixa>
      </Secao>

      <Secao nome="painel" titulo="Número de painel e barra">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <NumeroPainel rotulo="Gerado por IA" valor={1412} />
          <NumeroPainel rotulo="Consumo do mês" valor="61%" apoio={<BarraRotulada rotulo="Do orçamento" valor={61} />} />
        </div>
        <Cartao titulo="Acerto por habilidade" nivel={3}>
          <div className="flex min-w-0 flex-col gap-4">
            <BarraRotulada rotulo="Cálculo estequiométrico" valor={72} detalhe="EM13CNT101 · 4 questões" />
            <BarraRotulada rotulo="Hoje" valor={12} maximo={60} texto="12 de 60 perguntas" />
          </div>
        </Cartao>
        <EstadoVazio variante="tracejado" icone={Inbox} titulo="Nenhuma correção aprovada ainda" descricao="O acerto por habilidade aparece aqui depois que você aprova a correção de uma atividade da turma." />
      </Secao>

      <Secao nome="abas" titulo="Abas">
        <Abas rotulo="Seções da turma" abas={ABAS} ativa={aba} aoMudar={definirAba}>
          <p className="text-apoio">Conteúdo de {ABAS.find((item) => item.id === aba)?.rotulo}.</p>
        </Abas>
        {/* A aba ativa que não existe na lista: a primeira continua alcançável pelo Tab. */}
        <div data-abas="sem-ativa">
          <Abas rotulo="Abas com a ativa fora da lista" abas={ABAS} ativa="aba-que-sumiu" aoMudar={() => undefined}>
            <p className="text-apoio">Escolha uma aba.</p>
          </Abas>
        </div>
      </Secao>

      <Secao nome="aviso" titulo="Aviso, nos quatro tons">
        <div data-avisos className="flex min-w-0 flex-col gap-3">
          {TONS_DE_AVISO.map((tom) => (
            <Aviso
              key={tom}
              tom={tom}
              titulo={AVISOS[tom].titulo}
              {...(tom === 'erro' || tom === 'info' ? { acao: <Botao variante="secundario">{tom === 'erro' ? 'Tentar de novo' : 'Confirmar vínculo'}</Botao> } : {})}
            >
              {AVISOS[tom].corpo}
            </Aviso>
          ))}
          <Aviso tom="info">Um aviso sem título é só o corpo, com o glifo do tom.</Aviso>
        </div>
      </Secao>

      <Secao nome="contador" titulo="Contador">
        <ul data-contadores className="flex min-w-0 flex-wrap gap-x-4 gap-y-3">
          {FAMILIAS_DE_COR.map((familia, indice) => (
            <li key={familia} className="flex items-center gap-2 text-apoio">
              <Contador n={indice + 1} oQueConta="pedidos de nome" familia={familia} />
              {NOMES_DAS_FAMILIAS[familia]}
            </li>
          ))}
        </ul>
        {/* Zero não desenha: só o texto que o acompanha aparece. */}
        <p data-contador-zero className="flex items-center gap-2 text-apoio">
          <Contador n={0} oQueConta="pedidos de nome" />
          Sem pedidos esperando: nenhuma pílula.
        </p>
        <p className="flex items-center gap-2 text-apoio">
          <Contador n={128} oQueConta="entregas esperando você" />
          Três dígitos cabem na mesma pílula.
        </p>
      </Secao>

      <Secao nome="toque" titulo="Toque, para filtro e sugestão">
        <div role="group" aria-label="Filtros das atividades" data-toques className="flex min-w-0 flex-wrap gap-2">
          {FILTROS.map((filtro) => (
            <Toque
              key={filtro.id}
              selecionado={escolhidos.has(filtro.id)}
              aoMudar={(ligado) => alternar(filtro.id, ligado)}
              {...('icone' in filtro ? { icone: filtro.icone } : {})}
            >
              {filtro.rotulo}
            </Toque>
          ))}
        </div>
        <div role="group" aria-label="Filtros fora de uso" data-toques-desligados className="flex min-w-0 flex-wrap gap-2">
          <Toque selecionado={false} aoMudar={() => definirAcionados((atual) => atual + 1)} desligado>
            Corrigidas
          </Toque>
          <Toque selecionado aoMudar={() => definirAcionados((atual) => atual + 1)} desligado>
            Arquivadas
          </Toque>
        </div>
        <p data-toques-acionados={acionados} className="sr-only">
          {acionados} toques fora de uso acionados
        </p>
      </Secao>

      <Secao nome="estados-de-tela" titulo="Carregando, vazio e erro">
        <div data-estados className="flex min-w-0 flex-col gap-3">
          <EstadoCarregando rotulo="Carregando as atividades da turma…" />
          <EstadoVazio titulo="Nenhuma atividade ainda" descricao="As atividades que você aplicar à turma aparecem aqui, com a entrega de cada aluno." />
          <EstadoVazio
            titulo="Nenhum material enviado"
            descricao="Envie o PDF da apostila para o Assistente poder citar a página."
            acao={{ rotulo: 'Verificar de novo', aoAcionar: () => undefined }}
          />
          <EstadoVazio titulo="Nenhuma conversa" descricao="As conversas com o Assistente aparecem aqui. Se acabou de pedir uma, verifique de novo." acao={{ rotulo: 'Verificar de novo', aoAcionar: () => undefined, emAndamento: true }} />
          <EstadoErro erro={new ErroDaApi(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)} aoTentarDeNovo={() => definirTentativas((atual) => atual + 1)} />
          <EstadoErro erro={new ErroDaApi(ErrorCode.INDISPONIVEL_TENTE_DE_NOVO)} aoTentarDeNovo={() => undefined} tentando />
        </div>
        <p data-tentativas={tentativas} className="sr-only">
          {tentativas} tentativas
        </p>
      </Secao>
    </>
  )
}
