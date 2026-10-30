import { FINALIDADES_DA_LEITURA_NOMINAL, NOME_DA_FINALIDADE_NOMINAL, nomeDaSerie, type FinalidadeDaLeituraNominal, type AnalistaNominalResponse } from '@educa/shared'
import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { consultaTurmas } from '../../../api/estrutura'
import { lerDadoNominal } from './api/governanca'
import { BarraRotulada } from '../../../componentes/ui/BarraRotulada'
import { Botao } from '../../../componentes/ui/Botao'
import { Cartao } from '../../../componentes/ui/Cartao'
import { DialogoDeConfirmacao } from '../../../componentes/ui/sobrepostos/DialogoDeConfirmacao'
import { useEnvioUnico } from '../../../componentes/dialogos'
import { Selecao } from '../../../componentes/ui/campos/Selecao'
import { CabecalhoDeSecao } from '../../../componentes/ui/Tela'
import { textoDaFalha } from '../../../componentes/texto-da-falha'
import { formatarQuantidade } from '../../../formatar'
import { ordenarTurmas } from '../comum/ordem'
import { acertoPercentual, AVISO_DO_NOMINAL, EFEITO_DO_NOMINAL, formatarPercentual } from './textos-da-governanca'

function ehFinalidade(valor: string): valor is FinalidadeDaLeituraNominal {
  return (FINALIDADES_DA_LEITURA_NOMINAL as readonly string[]).includes(valor)
}

const OPCOES_DE_FINALIDADE = FINALIDADES_DA_LEITURA_NOMINAL.map((finalidade) => ({ valor: finalidade, rotulo: NOME_DA_FINALIDADE_NOMINAL[finalidade] }))

/**
 * O pedido de dado nominal (D45; regra 20, item 10; regra 70, item 8), no fim da página do Analista: fica **à
 * parte** do agregado, atrás de um botão `oficial` e de uma confirmação que diz, antes, que a abertura vai para a
 * auditoria, e que pede a turma e a finalidade (lista fechada, nunca texto livre).
 *
 * Cada confirmação é uma leitura auditada, e por isso o resultado não fica em cache: vive enquanto esta seção está na
 * tela, e some no "Fechar" ou ao sair. A resposta nomeia os professores da turma; não traz aluno, e a tela não ordena nem
 * compara professores.
 */
export function DadoNominal() {
  const [aberto, definirAberto] = useState(false)
  // Fechar o resultado desmonta o botão que tinha o foco: ele volta para quem abriu (regra 50, item 11).
  const abrir = useRef<HTMLButtonElement>(null)
  const { enviar, mutacao } = useEnvioUnico({
    mutationFn: ({ turmaId, finalidade }: { turmaId: string; finalidade: FinalidadeDaLeituraNominal }) => lerDadoNominal(turmaId, finalidade),
    onSuccess: () => definirAberto(false),
  })

  return (
    <section className="flex min-w-0 flex-col gap-3" aria-labelledby="titulo-dado-nominal">
      <CabecalhoDeSecao
        id="titulo-dado-nominal"
        titulo="Dado nominal"
        apoio="Tudo nesta tela é agregado, sem nome de professor nem de aluno. O detalhe de uma turma, que identifica os professores dela, só abre por aqui, com a finalidade registrada na auditoria."
      />
      <div>
        <Botao
          ref={abrir}
          variante="oficial"
          onClick={() => {
            mutacao.reset()
            definirAberto(true)
          }}
        >
          Abrir dado nominal de uma turma
        </Botao>
      </div>
      {mutacao.data !== undefined && !aberto && <ResultadoNominal
          dado={mutacao.data}
          aoFechar={() => {
            mutacao.reset()
            abrir.current?.focus()
          }}
        />}
      {aberto && (
        <PedidoNominal
          aoFechar={() => definirAberto(false)}
          aoConfirmar={enviar}
          confirmando={mutacao.isPending}
          falha={mutacao.isError ? textoDaFalha(mutacao.error, { NAO_ENCONTRADO: 'Esta turma não está mais na escola. Feche e escolha outra.' }) : undefined}
        />
      )}
    </section>
  )
}

interface PropsDoPedido {
  readonly aoFechar: () => void
  readonly aoConfirmar: (pedido: { turmaId: string; finalidade: FinalidadeDaLeituraNominal }) => void
  readonly confirmando: boolean
  readonly falha: string | undefined
}

/** A confirmação: a turma, a finalidade, o que a resposta mostra e o aviso de que a abertura fica na auditoria. */
function PedidoNominal({ aoFechar, aoConfirmar, confirmando, falha }: PropsDoPedido) {
  const turmas = useQuery(consultaTurmas)
  const [turmaId, definirTurmaId] = useState('')
  const [finalidade, definirFinalidade] = useState('')
  const opcoesDeTurma = ordenarTurmas(turmas.data?.itens ?? []).map((turma) => ({ valor: turma.id, rotulo: `${turma.nome} · ${nomeDaSerie(turma.serie)}` }))
  const escolhida = opcoesDeTurma.find((opcao) => opcao.valor === turmaId)
  const semTurmas = turmas.isSuccess && opcoesDeTurma.length === 0
  return (
    <DialogoDeConfirmacao
      titulo="Abrir o dado nominal de uma turma"
      familia="oficial"
      resumo={[
        { rotulo: 'Turma', valor: escolhida?.rotulo ?? 'Ainda não escolhida' },
        { rotulo: 'Finalidade', valor: ehFinalidade(finalidade) ? NOME_DA_FINALIDADE_NOMINAL[finalidade] : 'Ainda não escolhida' },
      ]}
      efeito={EFEITO_DO_NOMINAL}
      aviso={AVISO_DO_NOMINAL}
      rotuloDeConfirmar="Abrir dado nominal"
      rotuloConfirmando="Abrindo…"
      aoConfirmar={() => {
        if (turmaId !== '' && ehFinalidade(finalidade)) aoConfirmar({ turmaId, finalidade })
      }}
      aoFechar={aoFechar}
      confirmando={confirmando}
      impedido={turmaId === '' || !ehFinalidade(finalidade)}
      {...(falha === undefined ? (turmas.isError ? { falha: 'Não foi possível ler as turmas da escola. Feche e tente de novo.' } : {}) : { falha })}
    >
      <div className="flex min-w-0 flex-col gap-3">
        <Selecao
          rotulo="Turma"
          opcoes={opcoesDeTurma}
          valor={turmaId}
          aoMudar={definirTurmaId}
          marcador={turmas.isPending ? 'Carregando as turmas…' : 'Escolha a turma'}
          desligada={turmas.isPending || semTurmas}
          obrigatoria
          {...(semTurmas ? { dica: 'A escola ainda não tem turma no ano letivo em curso.' } : {})}
        />
        <Selecao rotulo="Finalidade" opcoes={OPCOES_DE_FINALIDADE} valor={finalidade} aoMudar={definirFinalidade} marcador="Escolha a finalidade" obrigatoria dica="Fica registrada na auditoria, junto da abertura." />
      </div>
    </DialogoDeConfirmacao>
  )
}

interface PropsDoResultado {
  readonly dado: AnalistaNominalResponse
  readonly aoFechar: () => void
}

/** O que a leitura trouxe: a turma, os professores dela com a disciplina, o acerto por habilidade e os sinais de trabalho. */
function ResultadoNominal({ dado, aoFechar }: PropsDoResultado) {
  const sinais = [
    formatarQuantidade(dado.sinais.travou, 'aviso de aluno que travou', 'avisos de aluno que travou'),
    formatarQuantidade(dado.sinais.resposta_pronta, 'pedido de resposta pronta', 'pedidos de resposta pronta'),
    formatarQuantidade(dado.sinais.duvida_repetida, 'dúvida repetida', 'dúvidas repetidas'),
  ]
  return (
    <div data-dado-nominal role="region" aria-label={`Dado nominal da turma ${dado.turma.nome}`}>
      <Cartao
        titulo={`Turma ${dado.turma.nome} · ${nomeDaSerie(dado.turma.serie)}`}
        nivel={3}
        acao={
          <Botao variante="secundario" tamanho="compacto" onClick={aoFechar}>
            Fechar dado nominal
          </Botao>
        }
      >
        <div className="flex min-w-0 flex-col gap-4">
          <p role="status" className="rounded-controle border border-pendente bg-pendente-cx p-3 break-words text-pendente">
            Esta abertura foi registrada na auditoria da escola.
          </p>
          <div className="min-w-0">
            <h4 className="font-medium text-tinta">Professores da turma</h4>
            {dado.professores.length === 0 ? (
              <p className="mt-1 text-apoio">Nenhum professor confirmou vínculo nesta turma ainda.</p>
            ) : (
              <ul className="mt-1 flex min-w-0 flex-col gap-1">
                {dado.professores.map((professor) => (
                  <li key={`${professor.id}:${professor.disciplina.id}`} className="min-w-0 break-words text-tinta">
                    {professor.nome} <span className="text-apoio">· {professor.disciplina.nome}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="min-w-0">
            <h4 className="font-medium text-tinta">Acerto por habilidade</h4>
            {dado.porHabilidade.length === 0 ? (
              <p className="mt-1 text-apoio">A turma ainda não tem correção aprovada pelo professor: só o que foi aprovado vira número.</p>
            ) : (
              <div className="mt-2 flex min-w-0 flex-col gap-3">
                <p className="text-sm text-sutil">{formatarQuantidade(dado.lotesAprovados, 'correção aprovada', 'correções aprovadas')} na turma, somando as disciplinas.</p>
                {dado.porHabilidade.map((medida) => (
                  <BarraRotulada
                    key={medida.habilidade.codigo}
                    rotulo={medida.habilidade.descricao}
                    valor={acertoPercentual(medida.acertos, medida.total)}
                    texto={`${formatarPercentual(acertoPercentual(medida.acertos, medida.total))} · ${String(medida.acertos)} de ${String(medida.total)}`}
                    detalhe={medida.habilidade.codigo}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h4 className="font-medium text-tinta">Avisos do Tutor aos professores da turma</h4>
            <p className="mt-1 break-words text-apoio">{sinais.join(' · ')}. Só a contagem: os nomes chegam apenas aos professores da turma.</p>
          </div>
        </div>
      </Cartao>
    </div>
  )
}
