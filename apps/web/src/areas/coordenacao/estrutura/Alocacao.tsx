import { ErrorCode, type VinculoDaCoordenacao } from '@educa/shared'
import { useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { alocarProfessor, consultaDisciplinas, consultaTurmas } from '../../../api/estrutura'
import { DialogoDeFormulario, useEnvioUnico } from '../../../components/dialogs'
import { SELECT_CLASSES } from '../../../components/ui/fields/field-styles'
import { textoDaFalha } from '../../../components/error-text'
import { ordenarPeloNome, ordenarTurmas } from '../comum/ordem'

/** "7ºA · Matemática", ou só a turma quando o vínculo não tem disciplina. */
function turmaEDisciplina(vinculo: VinculoDaCoordenacao): string {
  return vinculo.disciplina === undefined ? vinculo.turma.nome : `${vinculo.turma.nome} · ${vinculo.disciplina.nome}`
}

/** O que a escolha incompleta diz: nada saiu para a API. */
const TEXTO_DA_ESCOLHA_INCOMPLETA = 'Escolha a turma e a disciplina.'

/** O `NAO_ENCONTRADO`: a turma ou a disciplina mudou com o diálogo aberto, e as escolhas já recarregaram. */
const TEXTO_DA_ALOCACAO_QUE_MUDOU = 'O professor, a turma ou a disciplina mudou enquanto você escolhia. A tela foi atualizada: confira e tente de novo.'

/** O convite do professor venceu, foi revogado ou a conta foi desativada com o diálogo aberto: a API o recusa, e o diálogo só oferece "Fechar". */
const TEXTO_DO_PROFESSOR_QUE_DEIXOU_DE_RECEBER = 'Este professor já não pode receber turma: o convite mudou. A tela foi atualizada.'

interface Props {
  /** O professor do painel, fotografado na abertura: o diálogo não escolhe professor, e quem é ele não muda enquanto está aberto. */
  readonly professor: { readonly usuarioId: string; readonly nome: string }
  /** O professor ainda pode receber turma, pela lista da escola **de agora**: o convite que venceu com o diálogo aberto tira o envio. */
  readonly alocavel: boolean
  readonly aoFechar: () => void
  /** O texto do anúncio da alocação feita; quem recebe fecha só a abertura em que o pedido saiu (`fecharSeAinda`). */
  readonly aoAlocar: (anuncio: string) => void
  readonly recarregar: () => unknown
  /** O foco ao fechar quando o botão que abriu saiu do painel (o professor deixou de receber turma). */
  readonly focoDeReserva: () => void
}

/**
 * "Acrescentar turma" (A1, 13.0; X2, 7.0; RF8, RF14; W4, "Alocação"): a coordenação liga o professor do painel a uma turma e a uma
 * disciplina. O vínculo nasce `pendente` e só dá acesso à turma depois de o professor confirmar (regra 60, item 8a); o anúncio
 * diz isso em texto.
 *
 * O professor com convite em aberto já pode ser alocado (decidido pelo Joaquim em 27/09/2026): quem recusa o vencido, o
 * revogado e o desativado é a API, com o mesmo `NAO_ENCONTRADO` do inexistente. O painel não oferece o botão a eles, e o
 * convite que vence com o diálogo aberto tira o envio.
 *
 * - **A escolha só vale enquanto o item está na lista:** a turma ou a disciplina que outra pessoa excluiu com o diálogo
 *   aberto sai da escolha quando a lista recarrega, e o envio seguinte pede a escolha de novo, em vez de mandar quem a API
 *   acabou de recusar.
 * - **Um pedido por vez:** o clique duplo em "Acrescentar" é um vínculo só (`useEnvioUnico`). A corrida entre duas pessoas é da
 *   API, que recusa o vínculo repetido com `CONFLITO`.
 * - **A turma de um vínculo encerrado também aparece:** a escolha é toda a lista de turmas e de disciplinas da escola.
 */
export function DialogoDeAlocacao({ professor, alocavel, aoFechar, aoAlocar, recarregar, focoDeReserva }: Props) {
  // As listas são as do painel (a mesma chave): ele só oferece o botão com as duas lidas.
  const turmas = ordenarTurmas(useQuery(consultaTurmas).data?.itens ?? [])
  const disciplinas = ordenarPeloNome(useQuery(consultaDisciplinas).data?.itens ?? [])
  const [turmaId, definirTurmaId] = useState('')
  const [disciplinaId, definirDisciplinaId] = useState('')
  const [faltando, definirFaltando] = useState(false)
  const escolhido = {
    turmaId: turmas.some((turma) => turma.id === turmaId) ? turmaId : '',
    disciplinaId: disciplinas.some((disciplina) => disciplina.id === disciplinaId) ? disciplinaId : '',
  }
  const campos = { turma: useId(), disciplina: useId() }
  const { enviar, mutacao } = useEnvioUnico({
    mutationFn: alocarProfessor,
    // Fecha com a lista já recarregada: o vínculo novo está na tela quando o diálogo sai.
    onSuccess: async (vinculo) => {
      await recarregar()
      aoAlocar(`Alocação feita: ${professor.nome} em ${turmaEDisciplina(vinculo)}. A turma abre depois que quem foi alocado confirmar.`)
    },
    onError: recarregar,
  })

  function acrescentar(): void {
    const completo = escolhido.turmaId !== '' && escolhido.disciplinaId !== ''
    definirFaltando(!completo)
    if (completo) enviar({ usuarioId: professor.usuarioId, ...escolhido, papel: 'professor' })
  }

  // Um aviso por vez: o professor que deixou de receber turma vale mais que a falha de antes; sem a escolha completa nada foi
  // enviado, e a falha do envio anterior já não vale.
  const falha = !alocavel
    ? TEXTO_DO_PROFESSOR_QUE_DEIXOU_DE_RECEBER
    : faltando
      ? TEXTO_DA_ESCOLHA_INCOMPLETA
      : mutacao.isError
        ? textoDaFalha(mutacao.error, {
            [ErrorCode.CONFLITO]: 'Este professor já está alocado nesta turma e nesta disciplina.',
            [ErrorCode.NAO_ENCONTRADO]: TEXTO_DA_ALOCACAO_QUE_MUDOU,
          })
        : undefined

  return (
    <DialogoDeFormulario
      titulo="Acrescentar turma"
      aoFechar={aoFechar}
      aoEnviar={acrescentar}
      enviando={mutacao.isPending}
      rotuloDoEnvio="Acrescentar"
      rotuloEnviando="Acrescentando…"
      semNovaTentativa={!alocavel}
      falha={falha}
      focoDeReserva={focoDeReserva}
    >
      <p className="break-words text-apoio">
        A turma de <span className="font-medium text-tinta">{professor.nome}</span>. Ela só abre para ele depois que ele aceitar o convite e confirmar.
      </p>
      <div className="flex flex-col gap-1">
        <label htmlFor={campos.turma} className="font-medium">
          Turma
        </label>
        <select id={campos.turma} value={escolhido.turmaId} onChange={(evento) => definirTurmaId(evento.target.value)} className={SELECT_CLASSES}>
          <option value="">Escolha a turma</option>
          {turmas.map((turma) => (
            <option key={turma.id} value={turma.id}>
              {turma.nome}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={campos.disciplina} className="font-medium">
          Disciplina
        </label>
        <select id={campos.disciplina} value={escolhido.disciplinaId} onChange={(evento) => definirDisciplinaId(evento.target.value)} className={SELECT_CLASSES}>
          <option value="">Escolha a disciplina</option>
          {disciplinas.map((disciplina) => (
            <option key={disciplina.id} value={disciplina.id}>
              {disciplina.nome}
            </option>
          ))}
        </select>
      </div>
    </DialogoDeFormulario>
  )
}
