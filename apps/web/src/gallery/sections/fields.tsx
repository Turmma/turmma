import { Camera, FileDown, FileText, Monitor, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { Botao } from '../../components/ui/Botao'
import { Busca } from '../../components/ui/fields/Busca'
import { Campo } from '../../components/ui/fields/Campo'
import { CampoDeSenha } from '../../components/ui/fields/CampoDeSenha'
import { CampoLongo } from '../../components/ui/fields/CampoLongo'
import { Interruptor } from '../../components/ui/fields/Interruptor'
import { Menu } from '../../components/ui/overlays/Menu'
import { Opcao } from '../../components/ui/fields/Opcao'
import { Selecao } from '../../components/ui/fields/Selecao'
import { TURMAS } from '../sample-data'
import { Secao } from '../GallerySection'

const DISCIPLINAS = [
  { valor: 'quimica', rotulo: 'Química' },
  { valor: 'fisica', rotulo: 'Física' },
]

const ENTREGAS = [
  { valor: 'papel', rotulo: 'Em papel', icone: <FileText size={28} /> },
  { valor: 'tela', rotulo: 'Na tela', icone: <Monitor size={28} /> },
  { valor: 'foto', rotulo: 'Por foto da folha', icone: <Camera size={28} /> },
] as const

const COLUNAS = [
  { valor: 'turma', rotulo: 'A turma' },
  { valor: 'entrega', rotulo: 'A entrega' },
  { valor: 'prazo', rotulo: 'O prazo' },
]

/** Cada peça de campo, com os estados dela lado a lado: vazio, preenchido, com erro e desligado. Dado inventado. */
function CamposDeTexto() {
  const [justificativa, definirJustificativa] = useState('curta')
  const [disciplina, definirDisciplina] = useState('')
  return (
    <Secao nome="campos" titulo="Campos de texto">
      <div className="grid min-w-0 gap-x-6 gap-y-4 md:grid-cols-2">
        <div data-estado="vazio" className="min-w-0">
          <Campo rotulo="Título da atividade" dica="O que a turma vê na lista." placeholder="Lista de estequiometria" />
        </div>
        <div data-estado="preenchido" className="min-w-0">
          <Campo rotulo="Nome da turma" defaultValue="2ºB · Química" obrigatorio />
        </div>
        <div data-estado="erro" className="min-w-0">
          <Campo rotulo="Código da atividade" defaultValue="AB1" erro="O código tem 6 letras ou números." obrigatorio />
        </div>
        <div data-estado="desligado" className="min-w-0">
          <Campo rotulo="Escola" defaultValue="Escola Municipal Inventada" disabled />
        </div>
        <div data-estado="senha" className="min-w-0">
          <CampoDeSenha rotulo="Senha nova" dica="Pelo menos 12 caracteres." defaultValue="senha-inventada-123" />
        </div>
        <div data-estado="longo-erro" className="min-w-0">
          <CampoLongo
            rotulo="Justificativa"
            dica="De 8 a 200 caracteres."
            valor={justificativa}
            aoMudar={definirJustificativa}
            minimo={8}
            maximo={200}
            erro={justificativa.trim().length < 8 ? 'Escreva pelo menos 8 caracteres.' : undefined}
            obrigatorio
          />
        </div>
        <div data-estado="longo-desligado" className="min-w-0">
          <CampoLongo rotulo="Comentário do professor" valor="Entrega fechada em 19/09." aoMudar={() => undefined} maximo={200} desligado />
        </div>
        <div data-estado="selecao-erro" className="min-w-0">
          <Selecao rotulo="Disciplina" marcador="Escolha a disciplina" opcoes={DISCIPLINAS} valor={disciplina} aoMudar={definirDisciplina} erro={disciplina === '' ? 'Escolha uma disciplina.' : undefined} obrigatoria />
        </div>
        <div data-estado="selecao-desligada" className="min-w-0">
          <Selecao rotulo="Período" opcoes={[{ valor: '3', rotulo: '3º bimestre' }]} valor="3" aoMudar={() => undefined} desligada />
        </div>
      </div>
    </Secao>
  )
}

function CampoDeBusca() {
  const [termo, definirTermo] = useState('')
  const [preenchida, definirPreenchida] = useState('estequiometria')
  return (
    <Secao nome="busca" titulo="Busca">
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <div data-estado="vazia" className="min-w-0">
          <Busca valor={termo} aoMudar={definirTermo} rotulo="Buscar atividades" />
        </div>
        <div data-estado="preenchida" className="min-w-0">
          <Busca valor={preenchida} aoMudar={definirPreenchida} rotulo="Buscar na biblioteca" />
        </div>
      </div>
    </Secao>
  )
}

function Interruptores() {
  const [desligado, definirDesligado] = useState(false)
  const [ligado, definirLigado] = useState(true)
  return (
    <Secao nome="interruptor" titulo="Interruptor">
      <div className="flex min-w-0 flex-col gap-3">
        <div data-estado="desligado" className="flex min-w-0 items-center gap-3">
          <Interruptor rotulo="Mostrar a data de entrega" ligado={desligado} aoMudar={definirDesligado} />
          <span className="t-corpo">Mostrar a data de entrega</span>
        </div>
        <div data-estado="ligado" className="flex min-w-0 items-center gap-3">
          <Interruptor rotulo="Avisar a turma ao publicar" ligado={ligado} aoMudar={definirLigado} />
          <span className="t-corpo">Avisar a turma ao publicar</span>
        </div>
        <div data-estado="fora-de-uso-desligado" className="flex min-w-0 items-center gap-3">
          <Interruptor rotulo="Liberar para a turma toda" ligado={false} aoMudar={() => undefined} desligado />
          <span className="t-corpo">Liberar para a turma toda</span>
        </div>
        <div data-estado="fora-de-uso-ligado" className="flex min-w-0 items-center gap-3">
          <Interruptor rotulo="Guardar o rascunho" ligado aoMudar={() => undefined} desligado />
          <span className="t-corpo">Guardar o rascunho</span>
        </div>
      </div>
    </Secao>
  )
}

function Opcoes() {
  const [entrega, definirEntrega] = useState<string>('papel')
  const [colunas, definirColunas] = useState<readonly string[]>(['turma'])
  return (
    <Secao nome="opcao" titulo="Opção">
      <div className="grid min-w-0 gap-6 md:grid-cols-2">
        <fieldset data-grupo="radio" className="flex min-w-0 flex-col gap-3 border-0 p-0">
          <legend className="t-cartao mb-3">Como a turma entrega</legend>
          {ENTREGAS.map((opcao) => (
            <Opcao key={opcao.valor} tipo="radio" nome="entrega" valor={opcao.valor} rotulo={opcao.rotulo} icone={opcao.icone} marcada={entrega === opcao.valor} aoMudar={(marcada) => marcada && definirEntrega(opcao.valor)} />
          ))}
          <Opcao tipo="radio" nome="entrega" valor="oral" rotulo="Por apresentação oral" marcada={false} aoMudar={() => undefined} desligada />
        </fieldset>
        <fieldset data-grupo="checkbox" className="flex min-w-0 flex-col gap-3 border-0 p-0">
          <legend className="t-cartao mb-3">O que mostrar na lista</legend>
          {COLUNAS.map((opcao) => (
            <Opcao
              key={opcao.valor}
              tipo="checkbox"
              nome="colunas"
              valor={opcao.valor}
              rotulo={opcao.rotulo}
              marcada={colunas.includes(opcao.valor)}
              aoMudar={(marcada) => definirColunas((atuais) => (marcada ? [...atuais, opcao.valor] : atuais.filter((valor) => valor !== opcao.valor)))}
            />
          ))}
          <Opcao tipo="checkbox" nome="colunas" valor="nota" rotulo="A nota" marcada aoMudar={() => undefined} desligada />
        </fieldset>
      </div>
    </Secao>
  )
}

export default function SecoesDeCampos() {
  const [turma, definirTurma] = useState('')
  const [acao, definirAcao] = useState('')
  const [observacao, definirObservacao] = useState('')
  return (
    <>
      <Secao nome="selecao-e-menu" titulo="Seleção e menu">
        <Selecao rotulo="Turma" obrigatoria marcador="Escolha a turma" opcoes={TURMAS} valor={turma} aoMudar={definirTurma} dica="A turma em que a atividade vai ser aplicada." />
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Menu
            rotulo="Ações da atividade"
            variante="discreto"
            itens={[
              { id: 'exportar', rotulo: 'Exportar em PDF', icone: FileDown },
              { id: 'adaptar', rotulo: 'Gerar versão adaptada', icone: SlidersHorizontal },
              { id: 'aplicar', rotulo: 'Aplicar à turma', descricao: 'Só depois de aprovada', desabilitado: true },
              { id: 'excluir', rotulo: 'Excluir', perigo: true },
            ]}
            aoEscolher={definirAcao}
          />
          {/* Um botão ao lado do menu, para o e2e provar que o toque fora do menu aberto só o fecha, sem acionar o vizinho. */}
          <Botao variante="secundario" tamanho="compacto" onClick={() => definirAcao('vizinho')}>
            Vizinho
          </Botao>
          <p role="status" data-acao="" className="text-sm text-sutil">
            {acao === '' ? '' : `Escolhido: ${acao}`}
          </p>
        </div>
        <CampoLongo rotulo="Observação" dica="Até 200 caracteres." valor={observacao} aoMudar={definirObservacao} maximo={200} />
      </Secao>
      <CamposDeTexto />
      <CampoDeBusca />
      <Interruptores />
      <Opcoes />
    </>
  )
}
