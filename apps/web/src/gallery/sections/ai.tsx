import { ROTULOS_DA_ADAPTACAO, TIPOS_DE_ADAPTACAO, type Citacao } from '@educa/shared'
import { LayoutGrid, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import { Botao } from '../../components/ui/Botao'
import { Cartao } from '../../components/ui/Cartao'
import { AssinaturaIA, SeloIA } from '../../components/ui/ai/AssinaturaIA'
import { AvisoFila } from '../../components/ui/ai/AvisoFila'
import { CaixaPedido } from '../../components/ui/ai/CaixaPedido'
import { Escolha } from '../../components/ui/ai/Escolha'
import { LinhaAprovacao } from '../../components/ui/ai/LinhaAprovacao'
import { Conversa, MensagemIA, MensagemPessoa, Pensando } from '../../components/ui/ai/Message'
import type { DescricaoDeFerramenta, ValoresValidados } from '../../components/ui/ai/schema-form'
import { MotorFormulario, type EstadoDoMotor } from '../../components/ui/ai/MotorFormulario'
import { PaginaMini } from '../../components/ui/ai/PaginaMini'
import { TextoDaIA } from '../../components/ui/ai/TextoDaIA'
import { Menu } from '../../components/ui/overlays/Menu'
import { Selecao } from '../../components/ui/fields/Selecao'
import { QUANDO, TURMAS } from '../sample-data'
import { Secao } from '../GallerySection'

const QUIMICA = '0190a1b2-0000-7000-8000-000000000001'
const MATERIAIS = { [QUIMICA]: 'Química 2, cap. 7' }

const PAGINA_142: Citacao = {
  materialId: QUIMICA,
  pagina: 142,
  trecho: 'A proporção entre as quantidades de matéria de reagentes e produtos é dada pelos coeficientes da equação balanceada.',
}
const CITACOES: readonly Citacao[] = [
  PAGINA_142,
  { materialId: QUIMICA, pagina: 145, trecho: 'O reagente limitante é o que acaba primeiro e determina quanto produto se forma.' },
  { materialId: QUIMICA, pagina: 151, trecho: 'O rendimento é a razão entre a massa obtida e a massa prevista pela equação.' },
  // A mesma página citada de novo: a lista de fontes conta uma vez só.
  PAGINA_142,
]

/**
 * O texto como o modelo o devolve: com Markdown (título, negrito, lista), que a tela limpa; com uma conta, em que o
 * asterisco é conteúdo e fica; e, de propósito, com um pedaço com cara de HTML, que fica escrito.
 */
const TEXTO_DO_MODELO =
  '### Lista de estequiometria\n\n**Questão 1.** Qual a massa de CO₂ formada na queima de 24 g de carbono?\n**Questão 2.** Qual é o reagente limitante quando sobra oxigênio?\n\n- Lembre: 2 * 12 = 24 g de carbono.\n- Use <b>massa molar</b> e a proporção da equação balanceada.'

/**
 * O menu de ferramenta da caixa de pedido. **A Adaptação não está aqui**: ela não nasce de um texto livre, e sim do tipo
 * de adaptação, e abre direto no `MotorFormulario` (D35, D67). Ao lado de uma caixa de texto, ela convidaria a escrever
 * sobre o aluno.
 */
const FERRAMENTAS = [
  { id: 'conversa', rotulo: 'Só conversar', descricao: 'Responde aqui, sem salvar nada', icone: MessageSquare },
  { id: 'atividade_objetiva', rotulo: 'Atividade objetiva', descricao: 'Questões com a página de cada uma', icone: LayoutGrid },
  { id: 'plano_de_aula', rotulo: 'Plano de aula', descricao: 'Objetivos, etapas e avaliação', icone: LayoutGrid },
]

const ATIVIDADE: DescricaoDeFerramenta = {
  ferramenta: 'atividade_objetiva',
  nome: 'Atividade objetiva',
  verbo: 'Gerar atividade',
  campos: [
    { tipo: 'selecao', chave: 'turmaId', rotulo: 'Turma', opcoes: TURMAS, obrigatorio: true },
    { tipo: 'texto', chave: 'tema', rotulo: 'Tema', exemplo: 'Estequiometria: reagente limitante', obrigatorio: true },
    { tipo: 'numero', chave: 'quantidade', rotulo: 'Questões', minimo: 1, maximo: 20, padrao: 10 },
  ],
}

const ADAPTACAO: DescricaoDeFerramenta = {
  ferramenta: 'adaptacao',
  nome: 'Adaptação',
  verbo: 'Gerar versão adaptada',
  campos: [
    {
      tipo: 'multipla',
      chave: 'tipos',
      rotulo: 'Tipo de adaptação',
      dica: 'Escolha o que a versão precisa ter. Não escreva nada sobre o aluno.',
      minimo: 1,
      opcoes: TIPOS_DE_ADAPTACAO.map((valor) => ({ valor, rotulo: ROTULOS_DA_ADAPTACAO[valor] })),
    },
  ],
}

function DemonstracaoDaCaixa({ variante }: { variante: 'completa' | 'so-texto' }) {
  const [valor, definirValor] = useState('')
  const [enviado, definirEnviado] = useState('')
  const [gerando, definirGerando] = useState(false)
  const [ferramenta, definirFerramenta] = useState('conversa')
  const [turma, definirTurma] = useState('turma-2b')
  const comuns = {
    valor,
    aoMudar: definirValor,
    aoEnviar: (texto: string) => {
      definirEnviado(texto)
      definirValor('')
      definirGerando(true)
    },
    aoParar: () => definirGerando(false),
    estado: gerando ? 'gerando' : 'pronta',
  } as const
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {variante === 'so-texto' ? (
        <CaixaPedido variante="so-texto" rotulo="Pergunta para o Tutor" exemplo="Escreva a sua dúvida" {...comuns} />
      ) : (
        <CaixaPedido
          rotulo="Pedido ao Assistente de ensino"
          exemplo="Peça uma atividade, um plano de aula…"
          {...comuns}
          esquerda={<Menu rotulo={FERRAMENTAS.find((item) => item.id === ferramenta)?.rotulo ?? 'Ferramenta'} prefixo="Ferramenta" icone={LayoutGrid} titulo="Ferramentas" itens={FERRAMENTAS} escolhido={ferramenta} aoEscolher={definirFerramenta} />}
          direita={<Selecao variante="pilula" rotulo="Turma do pedido" opcoes={TURMAS} valor={turma} aoMudar={definirTurma} />}
        />
      )}
      <p role="status" data-enviado="" className="min-h-6 text-sm break-words whitespace-pre-wrap text-sutil">
        {enviado === '' ? '' : `Enviado: ${enviado}`}
      </p>
    </div>
  )
}

function DemonstracaoDoMotor({ descricao }: { descricao: DescricaoDeFerramenta }) {
  const [estado, definirEstado] = useState<EstadoDoMotor>('formulario')
  const [pedido, definirPedido] = useState<ValoresValidados | undefined>(undefined)
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <MotorFormulario
        descricao={descricao}
        estado={estado}
        aoGerar={(valores) => {
          definirPedido(valores)
          definirEstado('gerando')
        }}
        aoCancelar={() => definirPedido(undefined)}
        aoEditar={() => definirEstado('formulario')}
      >
        <Cartao>
          <p className="text-apoio">O artefato gerado aparece aqui, com a assinatura da IA e as fontes.</p>
        </Cartao>
      </MotorFormulario>
      {estado === 'gerando' && (
        <div>
          <Botao variante="secundario" onClick={() => definirEstado('pronto')}>
            Simular a resposta
          </Botao>
        </div>
      )}
      <p data-pedido="" className="min-h-6 text-sm break-all text-sutil">
        {pedido === undefined ? '' : JSON.stringify(pedido)}
      </p>
    </div>
  )
}

export default function SecoesDeIA() {
  const [escolha, definirEscolha] = useState<string | undefined>(undefined)
  const [demorando, definirDemorando] = useState(false)
  return (
    <>
      <Secao nome="selo-de-ia" titulo="Selo de IA e assinatura">
        <div className="flex min-w-0 flex-wrap items-center gap-4">
          <SeloIA />
        </div>
        <AssinaturaIA agente="assistente_de_ensino" />
        <AssinaturaIA agente="tutor" />
        <AssinaturaIA agente="analista_de_desempenho_escolar" />
        <AssinaturaIA funcao="correcao_de_objetiva" />
        <div className="flex min-w-0 flex-col items-start gap-2">
          <LinhaAprovacao aprovacao={{ estado: 'aprovada', por: 'Camila Souza', quando: QUANDO }} />
          <LinhaAprovacao aprovacao={{ estado: 'pendente' }} />
          <LinhaAprovacao aprovacao={{ estado: 'rejeitada', por: 'Camila Souza', quando: QUANDO, motivo: 'A questão 3 não é do capítulo 7.' }} />
        </div>
      </Secao>

      <Secao nome="conversa" titulo="Conversa">
        <Conversa rotulo="Conversa com o Assistente de ensino" ocupada={demorando}>
          <MensagemPessoa>monta uma atividade de estequiometria pro 2ºB, dez questões</MensagemPessoa>
          <MensagemIA agente="assistente_de_ensino">
            <Escolha
              pergunta="Posso fazer isso com a ferramenta Atividade, ou só conversar."
              opcoes={[
                { id: 'ferramenta', titulo: 'Usar a ferramenta Atividade', descricao: 'Salva na biblioteca, liga ao 2ºB e cita a página.', icone: LayoutGrid },
                { id: 'conversa', titulo: 'Só conversar', descricao: 'Respondo aqui, sem salvar nada.', icone: MessageSquare },
              ]}
              escolhida={escolha}
              aoEscolher={definirEscolha}
            />
          </MensagemIA>
          <MensagemIA
            agente="assistente_de_ensino"
            aprovacao={{ aprovacao: { estado: 'aprovada', por: 'Camila Souza', quando: QUANDO }, verbo: 'Aprovada por' }}
            acoes={
              <>
                <Botao variante="discreto" tamanho="compacto">
                  Copiar
                </Botao>
                <Botao variante="discreto" tamanho="compacto">
                  Exportar em PDF
                </Botao>
              </>
            }
          >
            <TextoDaIA texto={TEXTO_DO_MODELO} citacoes={CITACOES} materiais={MATERIAIS} />
          </MensagemIA>
          <AvisoFila situacao="demora" />
          <AvisoFila situacao="falha" aoTentarDeNovo={() => undefined} />
          <MensagemIA
            variante="balao"
            funcao="correcao_de_objetiva"
            aprovacao={{ aprovacao: { estado: 'pendente' } }}
            acoes={
              <Botao variante="secundario" tamanho="compacto">
                Revisar
              </Botao>
            }
          >
            Corrigi as 32 atividades de estequiometria do 2ºB. Há 5 casos para você abrir antes de aprovar.
          </MensagemIA>
          <MensagemIA variante="balao" funcao="sinais_para_o_professor">
            Oito alunos travaram na questão 3.
          </MensagemIA>
          <Pensando agente="tutor" demorando={demorando} />
        </Conversa>
        <div>
          <Botao variante="secundario" tamanho="compacto" onClick={() => definirDemorando((estava) => !estava)}>
            Simular a demora
          </Botao>
        </div>
      </Secao>

      <Secao nome="escolha-estados" titulo="Escolha: desligada e escolhida">
        {/* A pergunta é outra da de cima: o e2e acha a Escolha aberta pelo nome do grupo, e dois com o mesmo nome o quebrariam. */}
        <Escolha
          pergunta="Posso montar o plano de aula com a ferramenta, ou só conversar."
          opcoes={[
            { id: 'ferramenta', titulo: 'Usar a ferramenta Plano de aula', descricao: 'Salva na biblioteca e liga à turma.', icone: LayoutGrid },
            { id: 'conversa', titulo: 'Só conversar', descricao: 'Respondo aqui, sem salvar nada.', icone: MessageSquare },
          ]}
          aoEscolher={() => undefined}
          desligada
        />
        <Escolha
          pergunta="Posso corrigir a lista objetiva com a ferramenta, ou só conversar."
          opcoes={[
            { id: 'ferramenta', titulo: 'Usar a ferramenta Correção', descricao: 'Organiza o lote e abre os casos para você.', icone: LayoutGrid },
            { id: 'conversa', titulo: 'Só conversar', descricao: 'Respondo aqui, sem salvar nada.', icone: MessageSquare },
          ]}
          escolhida="conversa"
          aoEscolher={() => undefined}
        />
      </Secao>

      <Secao nome="caixa-pedido" titulo="Caixa de pedido">
        <DemonstracaoDaCaixa variante="completa" />
      </Secao>

      <Secao nome="caixa-do-aluno" titulo="Caixa de pedido do aluno">
        <DemonstracaoDaCaixa variante="so-texto" />
      </Secao>

      <Secao nome="caixa-desligada" titulo="Caixa de pedido desligada">
        <CaixaPedido variante="so-texto" rotulo="Pergunta para o Tutor, desligada" exemplo="O Tutor está pausado nesta avaliação" valor="" aoMudar={() => undefined} aoEnviar={() => undefined} estado="desligada" />
      </Secao>

      <Secao nome="pagina-mini" titulo="Página de origem">
        <PaginaMini citacao={PAGINA_142} materiais={MATERIAIS} />
      </Secao>

      <Secao nome="motor" titulo="Motor de formulário">
        <Cartao>
          <DemonstracaoDoMotor descricao={ATIVIDADE} />
        </Cartao>
      </Secao>

      <Secao nome="motor-com-falha" titulo="Motor de formulário: o que deu errado">
        <Cartao>
          <MotorFormulario descricao={ATIVIDADE} estado="formulario" aoGerar={() => undefined} falha="Não foi possível gerar agora. Tente de novo em instantes." />
        </Cartao>
      </Secao>

      <Secao nome="motor-da-adaptacao" titulo="Motor de formulário: Adaptação">
        <Cartao>
          <DemonstracaoDoMotor descricao={ADAPTACAO} />
        </Cartao>
      </Secao>
    </>
  )
}
