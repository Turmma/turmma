import { TAMANHO_MAXIMO_DA_JUSTIFICATIVA, TAMANHO_MINIMO_DA_JUSTIFICATIVA } from '@educa/shared'
import { useRef, useState } from 'react'
import { Botao } from '../../components/ui/Botao'
import { Campo } from '../../components/ui/fields/Campo'
import { CampoLongo } from '../../components/ui/fields/CampoLongo'
import { Dialogo } from '../../components/ui/overlays/Dialogo'
import { DialogoDeConfirmacao } from '../../components/ui/overlays/DialogoDeConfirmacao'
import { ConfirmacaoDePerigo, DialogoDeFormulario } from '../../components/dialogs'
import { Menu } from '../../components/ui/overlays/Menu'
import { PainelLado } from '../../components/ui/overlays/PainelLado'
import { problemaDoTexto } from '../../components/ui/fields/text-limits'
import { TURMAS } from '../sample-data'
import { Secao } from '../GallerySection'

type Confirmacao = 'aprovar' | 'suspender' | 'andamento' | 'falha' | 'rejeitar'

const RESUMO_DO_LOTE = [
  { rotulo: 'Atividade', valor: 'Estequiometria: lista 3' },
  { rotulo: 'Turma', valor: '2ºB' },
  { rotulo: 'Correções', valor: '32' },
] as const

function DemonstracaoDaConfirmacao() {
  const [dialogo, definirDialogo] = useState<Confirmacao | undefined>(undefined)
  const [decisao, definirDecisao] = useState('')
  const [justificativa, definirJustificativa] = useState('')
  const resultado = useRef<HTMLParagraphElement>(null)
  const aprovado = decisao === 'Aprovado'
  const fechar = () => definirDialogo(undefined)
  const decidir = (texto: string) => {
    definirDecisao(texto)
    definirDialogo(undefined)
  }
  const justificativas = { minimo: TAMANHO_MINIMO_DA_JUSTIFICATIVA, maximo: TAMANHO_MAXIMO_DA_JUSTIFICATIVA }
  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        {/* Depois de aprovar, o gatilho desliga: o foco não tem como voltar para ele, e vai para o resultado. */}
        <Botao variante="oficial" disabled={aprovado} onClick={() => definirDialogo('aprovar')}>
          Aprovar 32 correções
        </Botao>
        <Botao variante="perigo" onClick={() => definirDialogo('rejeitar')}>
          Rejeitar o lote
        </Botao>
        <Botao variante="perigo" onClick={() => definirDialogo('suspender')}>
          Suspender a função
        </Botao>
        <Botao variante="secundario" onClick={() => definirDialogo('andamento')}>
          Ver a confirmação em andamento
        </Botao>
        <Botao variante="secundario" onClick={() => definirDialogo('falha')}>
          Ver a confirmação com falha
        </Botao>
      </div>
      <p ref={resultado} tabIndex={-1} role="status" data-decisao="" className="min-h-6 text-sm text-sutil">
        {decisao}
      </p>
      {(dialogo === 'aprovar' || dialogo === 'andamento' || dialogo === 'falha') && (
        <DialogoDeConfirmacao
          familia="oficial"
          titulo="Aprovar 32 correções"
          resumo={RESUMO_DO_LOTE}
          efeito="O diagnóstico por habilidade chega aos alunos da turma."
          rotuloDeConfirmar="Aprovar 32 correções"
          rotuloConfirmando="Aprovando…"
          confirmando={dialogo === 'andamento'}
          {...(dialogo === 'falha' ? { falha: 'Não foi possível aprovar. Tente de novo em instantes.' } : {})}
          aoConfirmar={() => (dialogo === 'aprovar' ? decidir('Aprovado') : undefined)}
          aoFechar={fechar}
          focoDeReserva={() => resultado.current?.focus()}
        />
      )}
      {dialogo === 'rejeitar' && (
        <DialogoDeConfirmacao
          familia="perigo"
          titulo="Rejeitar 32 correções"
          resumo={RESUMO_DO_LOTE}
          efeito="Nenhum diagnóstico chega aos alunos, e o Assistente recebe o motivo."
          rotuloDeConfirmar="Rejeitar 32 correções"
          impedido={problemaDoTexto(justificativa, justificativas) !== undefined}
          aoConfirmar={() => decidir('Rejeitado')}
          aoFechar={fechar}
        >
          <CampoLongo rotulo="Motivo da rejeição" obrigatorio dica="De 8 a 500 caracteres. O Assistente usa o motivo para refazer." valor={justificativa} aoMudar={definirJustificativa} {...justificativas} />
        </DialogoDeConfirmacao>
      )}
      {dialogo === 'suspender' && (
        <DialogoDeConfirmacao
          familia="perigo"
          titulo="Suspender a correção de objetiva"
          resumo={[{ rotulo: 'Função', valor: 'Assistente · correção de objetiva' }]}
          efeito="O Assistente para de corrigir atividades nesta escola até a função ser retomada."
          aviso="A suspensão fica na auditoria da escola."
          rotuloDeConfirmar="Suspender a função"
          aoConfirmar={() => decidir('Suspensa')}
          aoFechar={fechar}
        />
      )}
    </>
  )
}

type DialogoDaCaixa = 'formulario' | 'perigo' | 'menu'

/**
 * O diálogo comum nos três jeitos que as telas o usam: o formulário (os campos e os dois botões à direita), a confirmação
 * de perigo (o cheio vermelho, ao lado do "Cancelar" do mesmo tamanho) e o diálogo que carrega um menu dentro, onde o Esc
 * é do menu e não do diálogo. Nomes inventados (regra 20, item 17).
 */
function DemonstracaoDoDialogo() {
  const [dialogo, definirDialogo] = useState<DialogoDaCaixa | undefined>(undefined)
  const [disciplina, definirDisciplina] = useState('')
  const [turma, definirTurma] = useState(TURMAS[0]?.valor ?? '')
  const [resultado, definirResultado] = useState('')
  const textoDoResultado = useRef<HTMLParagraphElement>(null)
  const fechar = () => definirDialogo(undefined)
  const rotuloDaTurma = TURMAS.find((item) => item.valor === turma)?.rotulo ?? ''
  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <Botao variante="secundario" onClick={() => definirDialogo('formulario')}>
          Nova disciplina
        </Botao>
        {/* Depois de excluir, o gatilho desliga: o foco não tem como voltar para ele, e vai para o resultado. */}
        <Botao variante="perigo" disabled={resultado === 'Turma excluída: 2ºB'} onClick={() => definirDialogo('perigo')}>
          Excluir a turma 2ºB
        </Botao>
        <Botao variante="secundario" onClick={() => definirDialogo('menu')}>
          Atribuir à turma
        </Botao>
      </div>
      <p ref={textoDoResultado} tabIndex={-1} role="status" data-dialogo-resultado="" className="min-h-6 text-sm text-sutil">
        {resultado}
      </p>
      {dialogo === 'formulario' && (
        <DialogoDeFormulario
          titulo="Nova disciplina"
          aoFechar={fechar}
          aoEnviar={() => {
            definirResultado(`Disciplina criada: ${disciplina}`)
            definirDialogo(undefined)
          }}
          enviando={false}
          rotuloDoEnvio="Criar disciplina"
          rotuloEnviando="Criando…"
          falha={undefined}
        >
          <Campo rotulo="Nome da disciplina" value={disciplina} onChange={(evento) => definirDisciplina(evento.target.value)} />
        </DialogoDeFormulario>
      )}
      {dialogo === 'perigo' && (
        <ConfirmacaoDePerigo
          titulo="Excluir a turma 2ºB"
          texto="A turma 2ºB e as atividades dela saem da lista. Os alunos continuam no cadastro da escola."
          rotuloDaAcao="Excluir a turma"
          rotuloEmAndamento="Excluindo…"
          acao={() => Promise.resolve()}
          aoFechar={fechar}
          aoConcluir={() => {
            definirResultado('Turma excluída: 2ºB')
            definirDialogo(undefined)
          }}
          aoTerminar={() => undefined}
          textosDaFalha={{}}
          focoDeReserva={() => textoDoResultado.current?.focus()}
        />
      )}
      {dialogo === 'menu' && (
        <Dialogo titulo="Atribuir à turma" aoFechar={fechar}>
          <div className="mt-4 flex min-w-0 flex-col gap-4">
            <p className="text-apoio">Escolha a turma que recebe a atividade. O Esc de dentro do menu fecha só o menu.</p>
            <Menu rotulo={rotuloDaTurma} prefixo="Turma" titulo="Turmas" itens={TURMAS.map((item) => ({ id: item.valor, rotulo: item.rotulo }))} escolhido={turma} aoEscolher={definirTurma} />
            <div className="flex flex-wrap justify-end gap-3">
              <Botao variante="secundario" onClick={fechar}>
                Fechar
              </Botao>
            </div>
          </div>
        </Dialogo>
      )}
    </>
  )
}

/**
 * O painel que abre ao lado da tela: a 768 px ou mais, 480 px colados à direita; abaixo, folha de baixo. O miolo é
 * comprido de propósito, para rolar por dentro, e leva um menu, para o Esc dele não fechar o painel. Nomes inventados.
 */
function DemonstracaoDoPainel() {
  const [aberto, definirAberto] = useState(false)
  const [decisao, definirDecisao] = useState('')
  const [ordem, definirOrdem] = useState('nome')
  const resultado = useRef<HTMLParagraphElement>(null)
  const fechar = () => definirAberto(false)
  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        {/* Depois de aplicar, o gatilho desliga: o foco vai para o resultado, pelo `focoDeReserva`. */}
        <Botao variante="secundario" disabled={decisao !== ''} onClick={() => definirAberto(true)}>
          Abrir o painel da turma 2ºB
        </Botao>
      </div>
      <p ref={resultado} tabIndex={-1} role="status" data-painel-resultado="" className="min-h-6 text-sm text-sutil">
        {decisao}
      </p>
      {aberto && (
        <PainelLado
          titulo="Turma 2ºB · Química"
          aoFechar={fechar}
          focoDeReserva={() => resultado.current?.focus()}
          rodape={
            <>
              <Botao variante="secundario" onClick={fechar}>
                Cancelar
              </Botao>
              <Botao
                onClick={() => {
                  definirDecisao('Painel aplicado: ordem por ' + ordem)
                  definirAberto(false)
                }}
              >
                Aplicar
              </Botao>
            </>
          }
        >
          <div className="flex min-w-0 flex-col gap-4">
            <p className="text-apoio">Quem está na turma, na ordem escolhida. O painel não fecha ao tocar fora dele.</p>
            <Menu
              rotulo={ordem === 'nome' ? 'Ordem por nome' : 'Ordem por entrega'}
              titulo="Ordem da lista"
              itens={[
                { id: 'nome', rotulo: 'Ordem por nome' },
                { id: 'entrega', rotulo: 'Ordem por entrega' },
              ]}
              escolhido={ordem}
              aoEscolher={definirOrdem}
            />
            <Campo rotulo="Buscar na turma" />
            <ul className="flex min-w-0 flex-col gap-2">
              {Array.from({ length: 24 }, (_, indice) => (
                <li key={indice} className="min-w-0 rounded-controle border-2 border-borda p-3 break-words">
                  Aluna Exemplo {String(indice + 1).padStart(2, '0')}
                </li>
              ))}
            </ul>
          </div>
        </PainelLado>
      )}
    </>
  )
}

export default function SecoesDeSobrepor() {
  return (
    <>
      <Secao nome="confirmacao" titulo="Diálogo de confirmação">
        <DemonstracaoDaConfirmacao />
      </Secao>
      <Secao nome="dialogo" titulo="Diálogo">
        <DemonstracaoDoDialogo />
      </Secao>
      <Secao nome="painel-lado" titulo="Painel ao lado">
        <DemonstracaoDoPainel />
      </Secao>
    </>
  )
}
